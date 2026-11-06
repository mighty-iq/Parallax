/* PX.engine.bandit: learning progress per exercise and weighted choices (C §4, §9d; PLAN §5).
   Learning progress (LP) is measured on the rating, not on success (success is held near the
   target by design, so a success-based signal would collapse):
     LP = (μ now − μ 60 rated trials ago) / √(σ²now + σ²then), clipped to ±2.
   An exercise with fewer than 60 rated trials gets the optimistic default 1.5, so new exercises
   are tried. The rating keeps a snapshot [n, μ, σ] every 10 rated trials (estimator.js).

     lp(rec, def, opts) → { lp, fresh, n }        opts.display for perDisplay exercises
     score(rec, def, now, opts) → number           LP + 1 if a review is due + (1 − e^(−days/7))
     softmax(xs, temp) → probabilities
     shares(weights, min, max) → shares summing to 1, each inside [min, max] when feasible
     choose(rng, weights, explore) → index         uniform with probability `explore`, else ∝ weight */
(function (PX) {
  'use strict';

  // Local references (globals are slow to look up inside Node's vm contexts used by the tests).
  var isArray = Array.isArray, isFin = isFinite, hasOwn = Object.prototype.hasOwnProperty;

  var U = PX.util;
  var E = PX.engine;
  var C = E.config;

  function isNum(x) { return typeof x === 'number' && isFin(x); }

  function lp(rec, def, opts) {
    var st = E.est.get(rec, def, opts), raw = E.est.peek(rec, def, opts), B = C.bandit;
    if (st.n < B.window) return { lp: B.fresh, fresh: true, n: st.n };
    var snaps = raw && isArray(raw.snap) ? raw.snap : [], then = null;
    for (var i = snaps.length - 1; i >= 0; i--) {
      var s = snaps[i];
      if (!isArray(s) || !isNum(s[0]) || !isNum(s[1]) || !isNum(s[2])) continue;
      if (s[0] <= st.n - B.window) { then = s; break; }
    }
    if (!then) {
      for (var j = 0; j < snaps.length; j++) if (isArray(snaps[j]) && isNum(snaps[j][1])) { then = snaps[j]; break; }
    }
    if (!then || then[0] >= st.n) return { lp: B.fresh, fresh: true, n: st.n };
    var v = U.clamp((st.mu - then[1]) / Math.sqrt(st.sd * st.sd + then[2] * then[2]), -B.clip, B.clip);
    return { lp: v, fresh: false, n: st.n };
  }

  function score(rec, def, now, opts) {
    var x = lp(rec, def, opts).lp;
    var due = E.schedule ? E.schedule.due(rec, def, now) : null;
    if (due && due.due) x += 1;
    var e = rec.ex && rec.ex[def.id];
    var last = e && isNum(e.last) ? e.last : null;
    var days = last === null || !isNum(now) ? 30 : Math.max(0, (now - last) / E.DAY);
    return x + (1 - Math.exp(-days / 7));
  }

  function softmax(xs, temp) {
    var t = isNum(temp) && temp > 0 ? temp : C.bandit.temp;
    var m = -Infinity, i;
    for (i = 0; i < xs.length; i++) if (xs[i] > m) m = xs[i];
    var w = xs.map(function (x) { return Math.exp((x - m) / t); });
    var s = U.sum(w);
    return w.map(function (x) { return x / s; });
  }

  // Water-filling: shares proportional to the weights, with every share clipped to [min, max].
  // Each pass fixes the shares above max first (then those below min) and spreads the rest.
  function shares(weights, min, max) {
    var n = weights.length, i;
    if (!n) return [];
    if (n * min >= 1 || n * max <= 1) return weights.map(function () { return 1 / n; });
    var fixed = [], out = [];
    for (i = 0; i < n; i++) fixed.push(null);
    for (var it = 0; it <= 2 * n; it++) {
      var free = 0, rest = 1;
      for (i = 0; i < n; i++) { if (fixed[i] === null) free += Math.max(weights[i], 1e-12); else rest -= fixed[i]; }
      for (i = 0; i < n; i++) out[i] = fixed[i] !== null ? fixed[i] : rest * Math.max(weights[i], 1e-12) / free;
      var over = false, under = false;
      for (i = 0; i < n; i++) if (fixed[i] === null && out[i] > max + 1e-12) { fixed[i] = max; over = true; }
      if (over) continue;
      for (i = 0; i < n; i++) if (fixed[i] === null && out[i] < min - 1e-12) { fixed[i] = min; under = true; }
      if (!under) break;
    }
    return out;
  }

  function choose(rng, weights, explore) {
    var idx = [], i;
    for (i = 0; i < weights.length; i++) if (weights[i] > 0) idx.push(i);
    if (!idx.length) return weights.length ? 0 : -1;
    if (isNum(explore) && explore > 0 && rng.chance(explore)) return rng.pick(idx);
    var total = 0;
    for (i = 0; i < idx.length; i++) total += weights[idx[i]];
    var r = rng.next() * total;
    for (i = 0; i < idx.length; i++) {
      r -= weights[idx[i]];
      if (r < 0) return idx[i];
    }
    return idx[idx.length - 1];
  }

  E.bandit = { lp: lp, score: score, softmax: softmax, shares: shares, choose: choose };
})(window.PX);
