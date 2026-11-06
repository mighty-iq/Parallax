/* PX.engine.staircase: adaptive staircases on one parameter (ARCHITECTURE §7, PLAN §5).
   Pure; the state is a plain JSON object, mutated by step().

   create(opts) → st
     rule 'weighted'  Kaernbach (1991) weighted up-down: after a success the parameter moves
                      harder by `step`, after a failure easier by step × p/(1 − p), so the
                      expected drift is zero where P(success) = p. Defaults: step 0.025 log10
                      (0.015 when p > 0.8); both steps doubled until 2 reversals (C §9b).
     rule 'standard'  transformed 1-up/1-down in 0.05 log10 steps, 20 trials; converges on 50 %
                      (Levitt 1971); threshold = geometric mean of the last 4 reversals
                      (Legault, Allard & Faubert 2013).
     rule 'discrete'  integer levels (Span length): n-down/1-up (n = 2 → 70.7 %, Levitt 1971),
                      with a fast start (1-down until the first error).
     opts: p, x0 (start; log10 units, or a level index for 'discrete'), dir (+1: larger x is
     harder, e.g. speed; −1: smaller x is harder, e.g. a deadline), step, min, max,
     grid (sorted allowed x values; the shown value snaps to the nearest), trials, double, down.
   value(st)          the x to present now (snapped to the grid, clamped)
   step(st, ok)       one answer → { moved, reversal, x }
   threshold(st)      { x, n, reversals, method, ok, atBound } in the x units
   fit(st, opts)      maximum-likelihood p-point with a fixed slope: opts { slope, g, lapse, p }
   done(st)           true after the planned trials */
(function (PX) {
  'use strict';

  // Local references (globals are slow to look up inside Node's vm contexts used by the tests).
  var isArray = Array.isArray, isFin = isFinite, hasOwn = Object.prototype.hasOwnProperty;

  var U = PX.util;
  var E = PX.engine;
  var C = E.config;

  function isNum(x) { return typeof x === 'number' && isFin(x); }

  function create(opts) {
    opts = opts || {};
    var rule = opts.rule === 'standard' || opts.rule === 'discrete' ? opts.rule : 'weighted';
    var SC = C.staircase;
    var p = rule === 'standard' ? 0.5 : U.clamp(isNum(opts.p) ? opts.p : 0.75, 0.05, 0.95);
    var step = isNum(opts.step) && opts.step > 0 ? opts.step :
      rule === 'standard' ? SC.standard.step : rule === 'discrete' ? 1 : (p > 0.8 ? SC.harderHigh : SC.harder);
    var st = {
      rule: rule, p: p, dir: opts.dir === -1 ? -1 : 1, step: step,
      down: rule === 'discrete' ? Math.max(1, Math.round(isNum(opts.down) ? opts.down : 2)) : 1,
      x: isNum(opts.x0) ? opts.x0 : 0,
      min: isNum(opts.min) ? opts.min : -Infinity,
      max: isNum(opts.max) ? opts.max : Infinity,
      grid: isArray(opts.grid) && opts.grid.length ? opts.grid.slice().sort(function (a, b) { return a - b; }) : null,
      trials: isNum(opts.trials) && opts.trials > 0 ? Math.round(opts.trials) : (rule === 'standard' ? SC.standard.trials : 20),
      double: rule === 'weighted' ? opts.double !== false : false,
      fast: rule === 'discrete' ? opts.fastStart !== false : false,
      n: 0, run: 0, lastMove: 0, rev: [], hist: [],
    };
    if (rule === 'discrete') st.x = Math.round(st.x);
    st.x = clampX(st, st.x);
    return st;
  }

  function clampX(st, x) {
    var lo = st.min, hi = st.max;
    if (st.grid) { lo = Math.max(lo, st.grid[0]); hi = Math.min(hi, st.grid[st.grid.length - 1]); }
    return U.clamp(x, lo, hi);
  }

  function snap(st, x) {
    if (st.rule === 'discrete') return Math.round(x);
    if (!st.grid) return x;
    var g = st.grid, lo = 0, hi = g.length - 1;
    if (x <= g[0]) return g[0];
    if (x >= g[hi]) return g[hi];
    while (hi - lo > 1) { var mid = (lo + hi) >> 1; if (g[mid] <= x) lo = mid; else hi = mid; }
    return x - g[lo] <= g[hi] - x ? g[lo] : g[hi];
  }

  function value(st) { return snap(st, clampX(st, st.x)); }

  function step(st, ok) {
    var shown = value(st);
    st.hist.push([U.round(shown, 6), ok ? 1 : 0]);
    st.n += 1;
    var move = 0, size = 0;
    if (st.rule === 'discrete') {
      if (ok) {
        st.run += 1;
        if (st.fast || st.run >= st.down) { move = 1; size = 1; st.run = 0; }
      } else { move = -1; size = 1; st.run = 0; st.fast = false; }
    } else {
      var k = st.double && st.rev.length < C.staircase.doubleUntil ? 2 : 1;
      if (ok) { move = 1; size = st.step * k; }
      else { move = -1; size = st.rule === 'standard' ? st.step * k : st.step * k * st.p / (1 - st.p); }
    }
    var reversal = false;
    if (move !== 0) {
      if (st.lastMove !== 0 && move !== st.lastMove) {
        st.rev.push({ i: st.n, x: U.round(shown, 6) });
        reversal = true;
      }
      var before = st.x;
      st.x = clampX(st, st.x + move * st.dir * size);
      if (st.rule === 'discrete') st.x = Math.round(st.x);
      // A move blocked by a bound is not a move: it neither counts nor sets a direction.
      if (st.x !== before || st.lastMove === 0) st.lastMove = move;
    }
    return { moved: move, reversal: reversal, x: value(st) };
  }

  function done(st) { return st.n >= st.trials; }

  function mean(a) { return a.length ? U.mean(a) : NaN; }

  function threshold(st) {
    var xs = st.rev.map(function (r) { return r.x; });
    var out = { x: NaN, n: st.n, reversals: st.rev.length, method: '', ok: false, atBound: false };
    if (st.rule === 'standard') {
      var last = C.staircase.standard.last;
      if (xs.length >= 2) {
        out.x = mean(xs.slice(-last));
        out.method = 'last ' + Math.min(last, xs.length) + ' reversals';
        out.ok = xs.length >= last;
      }
    } else if (xs.length >= 4) {
      out.x = mean(xs.slice(2)); // after the doubled steps or the fast start
      out.method = 'reversals after the first 2';
      out.ok = xs.length - 2 >= 2;
    }
    if (!isNum(out.x)) {
      var h = st.hist.slice(Math.floor(st.hist.length / 2)).map(function (r) { return r[0]; });
      out.x = h.length ? mean(h) : value(st);
      out.method = 'mean of the second half (few reversals)';
    }
    var lo = st.grid ? Math.max(st.min, st.grid[0]) : st.min;
    var hi = st.grid ? Math.min(st.max, st.grid[st.grid.length - 1]) : st.max;
    var tail = st.hist.slice(-5).map(function (r) { return r[0]; });
    out.atBound = tail.length > 0 && tail.every(function (x) { return x === lo || x === hi; });
    return out;
  }

  // ML location with a fixed slope; returns the x where P = opts.p (default st.p).
  function fit(st, opts) {
    opts = opts || {};
    var slope = isNum(opts.slope) ? opts.slope : C.staircase.slope;
    var g = isNum(opts.g) ? opts.g : 0, lapse = isNum(opts.lapse) ? opts.lapse : C.lapse;
    var p = isNum(opts.p) ? opts.p : st.p;
    var h = st.hist;
    if (!h.length) return NaN;
    var xs = h.map(function (r) { return r[0]; });
    var lo = Math.min.apply(null, xs) - 1, hi = Math.max.apply(null, xs) + 1;
    var best = lo, bestL = -Infinity;
    for (var i = 0; i <= 400; i++) {
      var m = lo + (hi - lo) * i / 400, L = 0;
      for (var j = 0; j < h.length; j++) {
        var q = g + (1 - g - lapse) * U.sigmoid(slope * st.dir * (m - h[j][0]));
        L += Math.log(h[j][1] ? q : 1 - q);
      }
      if (L > bestL) { bestL = L; best = m; }
    }
    var z = U.clamp((p - g) / (1 - g - lapse), 1e-6, 1 - 1e-6);
    return best - st.dir * U.logit(z) / slope;
  }

  E.staircase = { create: create, value: value, step: step, threshold: threshold, fit: fit, done: done, snap: snap };
})(window.PX);
