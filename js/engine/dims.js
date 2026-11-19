/* PX.engine.dims: progress on every dimension (PLAN milestone 7; note P1 §4.3–4.4 and its Addendum;
   docs/dev/CONTRACT-v1.2.md Q; docs/dev/ENGINE.md §19). Pure like the rest of the engine: it takes the
   record and `now`, never reads the clock, storage or the DOM, and draws randomness from PX.rng only.

   One rating θ and one level per exercise stay. Each dimension d with two or more levels and a step gets
   a person-specific offset o_d on that step (logits per level), a random-weights LLTM (Rijmen & De Boeck
   2002; note P1 §4.3), centred on the player's own recent answers so the rating holds the ability where
   the player plays and an offset only moves items away from there (DECISIONS, 18 Nov):
       b_person(params) = b(params) + Σ_d o_d · (lv_d − c_d),   c_d = state.c (the middle before a fit)
   State, rec.ex[id].dims (rec.ex[id].small.dims for the small screen class of an exercise rated per display):
       { v: the exercise's version, n: its rated untimed answers at the fit, at: ms of the fit,
         o: [offset per dimension; null for a dimension with one level or no step],
         cap: [1 where the offset sits at its cap, else 0], lead: the next leading dimension (index),
         c: [the centre per dimension: the mean level of the last config.dims.centre answers at the fit] }
   A state of another version is ignored and replaced at the next fit.

     state(rec, def, display) → { o, c, cap, n, at, active, lead } | null   active: n ≥ config.dims.from
     fit(rec, def, display, now) → state   stores a new state from the last config.dims.window rated untimed
           answers (Train and Path; fluency and Speed rows left out): ridge logistic regression with one
           ability level per session (solve()), prior SD config.dims.prior × |step| per dimension (or the
           dimension's pooled spread), each offset capped so it moves its dimension's top level by at most
           config.dims.cap logits relative to the middle; then the rating moves so that its predictions at
           the new centre stay the same (config.dims.shift)
     b(rec, def, display, params) → logits      the player's own difficulty of a combination
     pool(rec, def, display) → { list, byKey, groups, … } | null   the exercise's pool with the player's b
           (same candidates, same order; groups sorted by that b), for select.pick's opts.pool
     frontier(rec, def, display, opts) → [{ dim, key, label, level, value, of, top, floor }]: per
           dimension, the hardest level handled with the other dimensions at their easiest, i.e. predicted
           right at g + (1 − g)·k or better (opts.k, default the level reference 0.75; opts.sd: average over
           the rating's spread as item choice does; opts.st: a rating; opts.filter: candidates allowed)
     lead(rec, def, display, opts) → { dim, key, level } | null   the leading dimension next in turn and
           its frontier level at the item target (opts.k, opts.st), off the scoped cells as the leads are
     room(plan) → how many more of the current deck's target items may change kind (conflict 10: 3 of 8)
     fluencyOpen(rec, def, display) → bool      Speed is open for the exercise (and it has no Quick deadline)
     timedStep(plan, rec, def, step, now)       a fluency step's timed difficulty, prediction and target
     fluencyAnswer(plan, rec, step, ok, result, now, out)   the timed rating and the Speed deadline
   Hooks (CONTRACT-v1.2 Q): start (order 10) in Train: whether Speed is open for each exercise when the
   session starts (share.dimsOpen). kind (order 10) in Train: from the session after the exercise's first
   fit with config.dims.leadFrom answers, every config.dims.lead-th target item leads with one dimension, in
   turn, when an item of its frontier level sits near the target (planned here, so no later hook meets a
   kind taken back); the deck's easy item becomes a fluency item where Speed was open at the start
   (ctx.share.fluency, config.dims.fluency of a deck by default; more than the easy item comes from target
   items, within room()). pick (order 10): the person pool; a leading item's level filter; a fluency
   item's fluent zone, aim and Speed deadline. pick (order 90, the last): a leading or fluency item's
   filter, as the hooks after order 10 left it, keeps off the scoped shortcut cells and keeps a candidate
   (scopedPick). finish (order 10): the fit for every exercise answered in a Train or Path session
   (res.dims). */
(function (PX) {
  'use strict';

  // Local references (globals are slow to look up inside Node's vm contexts used by the tests).
  var isArray = Array.isArray, isFin = isFinite, hasOwn = Object.prototype.hasOwnProperty;

  var U = PX.util;
  var E = PX.engine;
  var C = E.config;
  var M = E.model;
  var mabs = Math.abs, mmax = Math.max, mmin = Math.min, mlog = Math.log, mpow = Math.pow, mround = Math.round;

  function isNum(x) { return typeof x === 'number' && isFin(x); }
  function isObj(x) { return !!x && typeof x === 'object' && !isArray(x); }

  // The config block (E.defaults keeps it across configure('reset'), which replaces the object: so every
  // function reads C.dims afresh through cfg()).
  E.defaults('dims', {
    on: true,          // false: no offsets, no leading or fluency items (the simulations' "engine before 1.2")
    from: 100,         // rated untimed answers of the exercise before its offsets apply (note P1 §4.3)
    window: 400,       // the last answers each fit uses
    prior: 0.5,        // ridge prior SD of an offset, × |step| (until pooled exports give each dimension a spread)
    cap: 0.75,         // logits: the most an offset may move its dimension's top level
    spread: {},        // { '<exId>': { '<dimKey>': SD of the step over players, logits } }: the pooled refit
    capSpread: 2.5,    // with a spread, the cap per level step is capSpread × spread (note P1 Addendum)
    ability: 'session', // the fit's ability term: 'session' (a level per session, fitted), 'trend' or 'rating' (solve)
    gap: 1800,         // seconds between answers that start a new session in the fit
    walk: 0.3,         // logits: the SD of the change of level from one session to the next in the fit
    centre: 50,        // the last answers whose mean level per dimension is the centre of the offsets
    shift: true,       // at a refit the rating moves so its predictions at the new centre stay the same
    intercept: true,   // with 'rating': a free intercept, so a rating that lags shifts no offset
    lead: 5,           // every 5th target item of an exercise in Train leads with one dimension
    leadFrom: 10,      // ... once a session's fit has found this many rated answers (so never in a first session)
    maxChanged: 3,     // at most 3 of a deck's 8 target items change kind (lead, fluency, drill; conflict 10)
    fluency: 0.1,      // fluency items per dealt item once Speed is open: the deck's easy item (note P1 §4.3)
  });
  function cfg() { return C.dims; }

  /* ---------- scoped shortcut exceptions (CLAUDE.md rule 5) ----------
     Every cell of an item pool where a DECISIONS line lets a cheap answer beat chance + 10 points, in one
     list: the tests read their caps from it (tests/node/shortcut-levels.test.mjs and the exercises' own
     tests), and leading and fluency items never land in these cells (rated items of the ordinary pool may).
     A new exception is added here. Per entry: ex, the exercise; when, the params that select the cell
     (level indices, a variant by name; every key must match); or item(def, params, seed), true for an item
     of the cell that params alone cannot name (checked on the seed before the step is made); solvers, the
     cheap answers the exception covers (the names of the exercise's test); cap, the accuracy they are held
     at (or over: points over chance); from, the DECISIONS line. Central Point's two partial-skill guesses
     (DECISIONS 18 Nov, W1-central) are reported in every cell, not scoped to one, so they are not listed. */
  var SCOPED = [
    { ex: 'nets', when: { variant: 'opposite', shape: 0, between: 1 }, solvers: ['farGraph'], cap: 0.55, from: 'DECISIONS 2026-11-19 (W2-progress): Nets, 1-4-1 with three faces between' },
    { ex: 'slice', when: { cut: 0 }, solvers: ['roundest', 'fullest'], cap: 0.40, from: 'DECISIONS 2026-11-19 (W2-progress): Slice, the first cut level' },
    { ex: 'slice', when: { structure: 1 }, solvers: ['roundest', 'fullest'], cap: 0.40, from: 'DECISIONS 2026-11-19 (W2-progress): Slice, joined solids' },
    { ex: 'fold', when: { folds: 0 }, solvers: ['sym1', 'punchHoles'], cap: 0.48, from: 'DECISIONS 2026-11-19 (W2-progress): Fold, one fold' },
    { ex: 'cubes', item: function (def, params, seed) { var L = def && def.lib; return !!(L && typeof L.setOf === 'function' && L.setOf(params, seed).five); },
      solvers: ['the most common answer'], cap: 0.38, from: 'DECISIONS 2026-11-19 (W3-bandA): Painted Cubes, five painted sides (a figure set\'s later question)' },
    { ex: 'homing', when: { route: 0 }, solvers: ['fixed angle'], from: 'DECISIONS 2026-11-13 (B3, decision (a)): Homing, a fixed angle on the easy routes' },
    { ex: 'homing', when: { route: 1 }, solvers: ['fixed angle'], from: 'DECISIONS 2026-11-13 (B3, decision (a))' },
    { ex: 'homing', when: { route: 4 }, solvers: ['fixed angle'], from: 'DECISIONS 2026-11-13 (B3, decision (a))' },
    { ex: 'homing', when: { route: 2, tolerance: 0 }, solvers: ['fixed angle'], from: 'DECISIONS 2026-11-13 (B3, decision (a))' },
    { ex: 'homing', when: { route: 2, tolerance: 1 }, solvers: ['fixed angle'], from: 'DECISIONS 2026-11-13 (B3, decision (a))' },
    { ex: 'cubematch', when: { rotation: 0, change: 0 }, solvers: ['how like the other options'], cap: 0.60, from: 'DECISIONS 2026-11-19 (W2-measure): Cube Match version 2, spin × swap' },
    { ex: 'cubematch', when: { rotation: 2, change: 0 }, solvers: ['how like the other options'], cap: 0.60, from: 'DECISIONS 2026-11-19 (W2-measure): Cube Match version 2, flip × swap' },
  ];
  [[0, 0], [0, 1], [2, 0], [2, 1], [2, 2], [2, 3]].forEach(function (x) { // Pattern Memory version 2: six levels
    SCOPED.push({ ex: 'patterns', when: { regularity: x[0], size: x[1] }, solvers: ['the squares filled most often'], over: 0.25, from: 'DECISIONS 2026-11-19 (W2-measure): Pattern Memory version 2' });
  });
  // Whether params (and, for an entry that needs it, the seed) fall in a scoped cell of the exercise.
  function inCell(e, params) {
    for (var k in e.when) if (hasOwn.call(e.when, k) && (!params || params[k] !== e.when[k])) return false;
    return true;
  }
  function scopedParams(def, params) {
    for (var i = 0; i < SCOPED.length; i++) {
      var e = SCOPED[i];
      if (e.ex === def.id && e.when && inCell(e, params)) return true;
    }
    return false;
  }
  function scopedSeed(def, params, seed) {
    for (var i = 0; i < SCOPED.length; i++) {
      var e = SCOPED[i];
      if (e.ex === def.id && typeof e.item === 'function' && (!e.when || inCell(e, params)) && e.item(def, params, seed)) return true;
    }
    return false;
  }
  function isScoped(def, params, seed) { return !!def && (scopedParams(def, params) || (isNum(seed) && scopedSeed(def, params, seed))); }
  function hasSeedCells(def) {
    for (var i = 0; i < SCOPED.length; i++) if (SCOPED[i].ex === def.id && typeof SCOPED[i].item === 'function') return true;
    return false;
  }
  // A candidate filter that keeps also f0 and leaves out the scoped cells.
  function offScoped(def, f0) {
    return function (c) { return (!f0 || f0(c)) && !scopedParams(def, c.params); };
  }
  // A fresh training seed whose item lies in no scoped cell (null: the exercise has none that need the seed,
  // so the step draws its own). Every draw is a counter value of E.select.seed, so replays hold.
  function seedFor(rec, def, params) {
    if (!def || !hasSeedCells(def)) return null;
    var seed = E.select.seed(rec);
    for (var tries = 0; tries < 12 && scopedSeed(def, params, seed); tries++) seed = E.select.seed(rec);
    return seed;
  }

  /* ---------- dimensions ---------- */

  var infoCache = typeof WeakMap === 'function' ? new WeakMap() : null;
  // Per dimension: its level count, middle, |step| and whether it takes an offset (two or more levels and a
  // step); hard: +1 when higher levels are harder (a positive step), −1 when easier.
  function info(def) {
    var hit = infoCache && infoCache.get(def);
    if (hit) return hit;
    var dims = def.dims.map(function (d, i) {
      var L = d.levels.length, st = isNum(d.step) ? d.step : 0;
      return { i: i, key: d.key, label: d.label || d.key, L: L, mid: (L - 1) / 2, step: mabs(st), hard: st < 0 ? -1 : 1, on: L > 1 && mabs(st) > 1e-9 };
    });
    var out = { dims: dims, on: dims.filter(function (x) { return x.on; }).map(function (x) { return x.i; }) };
    if (infoCache) infoCache.set(def, out);
    return out;
  }
  // The dimension's pooled spread (logits per level step), when pooled exports have given one.
  function spreadOf(def, dm) {
    var D = cfg();
    var s = D.spread && isObj(D.spread[def.id]) ? D.spread[def.id][dm.key] : undefined;
    return isNum(s) && s >= 0 ? s : null;
  }
  // config.dims.longPrior (a lever, off by default): a dimension with more than five levels gets the prior
  // of a five-level one at its top level, so its offset per level shrinks by 2 / ((levels − 1) / 2).
  function priorSd(def, dm) {
    var s = spreadOf(def, dm), D = cfg();
    if (s !== null) return s;
    var k = D.longPrior === true && dm.L > 5 ? 2 / ((dm.L - 1) / 2) : 1;
    return D.prior * dm.step * k;
  }
  function capStep(def, dm) {
    var D = cfg();
    var s = spreadOf(def, dm);
    return s !== null ? D.capSpread * s : D.cap / mmax(0.5, dm.L - 1 - dm.mid);
  }

  /* ---------- state ---------- */

  // The object that holds the state: the rating's own entry (rec.ex[id], or its .small for the small
  // screen class of an exercise rated per display). make: create it (fit, lead rotation).
  function host(rec, def, display, make) {
    var e;
    if (make) e = E.est.exEntry(rec, def.id);
    else e = rec && isObj(rec.ex) && isObj(rec.ex[def.id]) ? rec.ex[def.id] : null;
    if (!e) return null;
    if (def.perDisplay && display === 'small') {
      if (!isObj(e.small)) { if (!make) return null; e.small = {}; }
      return e.small;
    }
    return e;
  }
  function valid(s, def) {
    if (!isObj(s) || s.v !== (def.version || 1) || !isArray(s.o) || s.o.length !== def.dims.length) return false;
    for (var i = 0; i < s.o.length; i++) if (s.o[i] !== null && !isNum(s.o[i])) return false;
    return true;
  }
  // The centre of each dimension: the stored one (state.c, a level index) when valid, else its middle.
  function centres(inf, s) {
    var ok = s && isArray(s.c) && s.c.length === inf.dims.length;
    return inf.dims.map(function (dm, i) {
      if (!dm.on) return null;
      var c = ok ? s.c[i] : null;
      return isNum(c) ? U.clamp(c, 0, dm.L - 1) : dm.mid;
    });
  }
  function leadIndex(inf, x) {
    if (isNum(x) && x >= 0 && x < inf.dims.length && inf.dims[x].on) return x;
    return inf.on.length ? inf.on[0] : null;
  }
  function blank(def) {
    var inf = info(def);
    return {
      v: def.version || 1, n: 0, at: null, lead: leadIndex(inf, null),
      o: inf.dims.map(function (x) { return x.on ? 0 : null; }), cap: inf.dims.map(function () { return 0; }),
      c: inf.dims.map(function (x) { return x.on ? x.mid : null; }),
    };
  }

  function state(rec, def, display) {
    var D = cfg();
    if (!def || !isArray(def.dims)) return null;
    var h = host(rec, def, display, false), s = h && h.dims;
    if (!valid(s, def)) return null;
    var inf = info(def), o = [], cap = [];
    for (var i = 0; i < inf.dims.length; i++) {
      var dm = inf.dims[i], c = capStep(def, dm);
      o.push(dm.on ? (isNum(s.o[i]) ? U.clamp(s.o[i], -c, c) : 0) : null);
      cap.push(isArray(s.cap) && s.cap[i] === 1 ? 1 : 0);
    }
    var n = isNum(s.n) && s.n > 0 ? Math.floor(s.n) : 0;
    return { o: o, c: centres(inf, s), cap: cap, n: n, at: isNum(s.at) ? s.at : null, active: D.on !== false && n >= D.from, lead: leadIndex(inf, s.lead) };
  }

  // Σ o_d (lv_d − c_d) for a candidate's level indices (lv) or a params object; c: the centres (state.c).
  function offsetOf(def, o, lv, params, c) {
    var inf = info(def), sum = 0;
    for (var i = 0; i < inf.dims.length; i++) {
      var x = o[i];
      if (!x) continue;
      var l = lv ? lv[i] : params[inf.dims[i].key];
      if (isNum(l)) sum += x * (l - (c && isNum(c[i]) ? c[i] : inf.dims[i].mid));
    }
    return sum;
  }

  function bOf(rec, def, display, params) {
    var b = def.difficulty(params), s = state(rec, def, display);
    return s && s.active ? b + offsetOf(def, s.o, null, params, s.c) : b;
  }

  /* ---------- the fit ---------- */

  var SKIP_KIND = { fluency: true, timed: true, probe: true, daily: true, climb: true, threshold: true, fixed: true, set: true }; // set: W2-core, CONTRACT-v1.2 W4
  var SKIP_DL = { speed: true, limit: true };

  // The rated untimed answers of this exercise version (and screen class, for an exercise rated per
  // display), newest last: { rows (at most max), n (all of them) }.
  function rowsFor(rec, def, display, max) {
    var rows = rec && isArray(rec.trials) ? rec.trials : [], nm = E.log.names(rec), L = E.log;
    var ver = def.version || 1, exOk = [], modeOk = [], i;
    for (i = 0; i < nm.ex.length; i++) exOk[i] = nm.ex[i] === def.id && nm.ver[i] === ver;
    for (i = 0; i < nm.mode.length; i++) modeOk[i] = nm.mode[i] === 'train' || nm.mode[i] === 'path';
    var COL = L.COL || {}, cK = isNum(COL.kind) ? COL.kind : 13, cDl = isNum(COL.dl) ? COL.dl : 17;
    var kinds = isArray(L.KINDS) ? L.KINDS : null, dls = isArray(L.DEADLINES) ? L.DEADLINES : null;
    var small = !!def.perDisplay && display === 'small', out = [], n = 0;
    for (i = rows.length - 1; i >= 0; i--) {
      var r = rows[i];
      if (!isArray(r) || r.length < 9 || !exOk[r[1]] || !modeOk[r[2]] || (r[5] !== 0 && r[5] !== 1) || !isNum(r[8])) continue;
      if (def.perDisplay && (r[10] === 1) !== small) continue;
      var kc = r.length > cK ? r[cK] : 0, dc = r.length > cDl ? r[cDl] : 0;
      if (kinds && isNum(kc) && SKIP_KIND[kinds[kc]]) continue;
      if (dls && isNum(dc) && SKIP_DL[dls[dc]]) continue;
      n++;
      if (out.length < max) out.push(r);
    }
    out.reverse();
    return { rows: out, n: n };
  }

  // Solves A x = b for a small symmetric positive-definite A (Gaussian elimination, partial pivoting).
  function solveLin(A, b) {
    var n = b.length, m = A.map(function (row, j) { return row.concat([b[j]]); }), r, c, k;
    for (c = 0; c < n; c++) {
      var p = c;
      for (r = c + 1; r < n; r++) if (mabs(m[r][c]) > mabs(m[p][c])) p = r;
      var tmp = m[c]; m[c] = m[p]; m[p] = tmp;
      if (mabs(m[c][c]) < 1e-12) return null;
      for (r = 0; r < n; r++) {
        if (r === c) continue;
        var f = m[r][c] / m[c][c];
        if (f) for (k = c; k <= n; k++) m[r][k] -= f * m[c][k];
      }
    }
    return m.map(function (row, j) { return row[n] / row[j]; });
  }

  // Ridge logistic regression of the offsets on the answers:
  //   P(right) = g + (1 − g − lapse) σ(θ_i − b_i − Σ_d o_d x_d),  x_d = lv_d − mid_d,  o_d ~ N(0, priorSd²)
  // The ability θ_i, config.dims.ability:
  //   'session' (default): one level per session (answers more than config.dims.gap seconds apart start a
  //     new one), fitted with the offsets: the first ~ N(rating, 3²), each next one ~ N(the one before,
  //     config.dims.walk²), so learning between sessions and the day's form never pass for a dimension;
  //   'trend': α + β·u + γ·(u² − mean u²), u = answers from the window's middle / 100;
  //   'rating': the selector's own belief at each answer, read back from the row (θ_i − b_i =
  //     logit((pp − g)/(1 − g − lapse)) + bOff), with a free intercept when config.dims.intercept.
  // The rating is not a fair ability term: a rating that is high by chance (or behind a learner who is
  // improving) has chosen harder items, which then fail more often, and that would show up as offsets.
  // Newton steps, each move at most 0.3.
  function solve(def, inf, rows, mu, c) {
    var D = cfg();
    var act = inf.on.map(function (i) { return inf.dims[i]; }), J = act.length, mode = D.ability === 'rating' || D.ability === 'trend' ? D.ability : 'session';
    var lapse = C.lapse, COL = E.log.COL || {}, cOff = isNum(COL.bOff) ? COL.bOff : 18, gap = isNum(D.gap) ? D.gap : 1800;
    var ys = [], gs = [], As = [], zs = [], xs = [], us = [], ss = [], i, j, k, N = rows.length, S = 0, lastT = null;
    for (i = 0; i < N; i++) {
      var r = rows[i], params;
      try { params = PX.ex.decodeParams(def, r[3]); } catch (e) { params = null; }
      if (!params) continue;
      var g = def.chance(params), A = 1 - g - lapse;
      if (!(A > 0.01)) continue;
      if (mode !== 'rating') zs.push(-def.difficulty(params));
      else {
        var q = U.clamp((r[8] / 1000 - g) / A, 1e-3, 1 - 1e-3);
        zs.push(mlog(q / (1 - q)) + (r.length > cOff && isNum(r[cOff]) ? r[cOff] / 1000 : 0));
      }
      if (lastT === null || !isNum(r[0]) || r[0] - lastT > gap) S++;
      if (isNum(r[0])) lastT = r[0];
      ys.push(r[5]); gs.push(g); As.push(A); us.push((i - (N - 1) / 2) / 100); ss.push(S - 1);
      xs.push(act.map(function (dm) { var l = params[dm.key]; return isNum(l) ? l - (c && isNum(c[dm.i]) ? c[dm.i] : dm.mid) : 0; }));
    }
    // the ability terms: per answer the columns it loads on, with their priors (mean, SD) and a chain
    // between neighbouring session levels
    var abP = [], u2 = 0, at;
    for (i = 0; i < us.length; i++) u2 += us[i] * us[i];
    u2 = us.length ? u2 / us.length : 0;
    var m0 = isNum(mu) ? mu : 0;
    if (mode === 'trend') {
      abP = [{ m: m0, sd: 3 }, { m: 0, sd: 1 }, { m: 0, sd: 0.5 }];
      at = function (q) { return [[J, 1], [J + 1, us[q]], [J + 2, us[q] * us[q] - u2]]; };
    } else if (mode === 'session') {
      for (j = 0; j < S; j++) abP.push(j === 0 ? { m: m0, sd: 3 } : { m: m0, sd: 100 });
      at = function (q) { return [[J + ss[q], 1]]; };
    } else if (D.intercept !== false) {
      abP = [{ m: 0, sd: 2 }];
      at = function () { return [[J, 1]]; };
    } else at = function () { return []; };
    var walk = isNum(D.walk) && D.walk > 0 ? D.walk : 0.3, w2 = 1 / (walk * walk);
    var P = J + abP.length, pm = [], tau2 = [];
    act.forEach(function (dm) { var t = priorSd(def, dm); pm.push(0); tau2.push(mmax(t * t, 1e-8)); });
    abP.forEach(function (x) { pm.push(x.m); tau2.push(x.sd * x.sd); });
    var th = pm.slice(), a = new Array(J), ab;
    for (var it = 0; it < 50; it++) {
      var gr = [], H = [];
      for (j = 0; j < P; j++) { gr.push(-(th[j] - pm[j]) / tau2[j]); H.push(new Array(P).fill(0)); H[j][j] = 1 / tau2[j]; }
      if (mode === 'session') {
        for (j = J + 1; j < P; j++) { // α_s − α_{s−1} ~ N(0, walk²)
          var dd = th[j] - th[j - 1];
          gr[j] -= dd * w2; gr[j - 1] += dd * w2;
          H[j][j] += w2; H[j - 1][j - 1] += w2; H[j][j - 1] -= w2; H[j - 1][j] -= w2;
        }
      }
      for (i = 0; i < ys.length; i++) {
        for (j = 0; j < J; j++) a[j] = -xs[i][j];
        ab = at(i);
        var eta = zs[i];
        for (j = 0; j < J; j++) eta += th[j] * a[j];
        for (j = 0; j < ab.length; j++) eta += th[ab[j][0]] * ab[j][1];
        var s = M.sig(eta), Pp = U.clamp(gs[i] + As[i] * s, 1e-6, 1 - 1e-6);
        var dP = As[i] * s * (1 - s), w = dP * dP / (Pp * (1 - Pp)), rr = (ys[i] - Pp) * dP / (Pp * (1 - Pp));
        for (j = 0; j < J; j++) {
          if (!a[j]) continue;
          gr[j] += rr * a[j];
          for (k = 0; k < J; k++) if (a[k]) H[j][k] += w * a[j] * a[k];
          for (k = 0; k < ab.length; k++) { var v = w * a[j] * ab[k][1]; H[j][ab[k][0]] += v; H[ab[k][0]][j] += v; }
        }
        for (j = 0; j < ab.length; j++) {
          gr[ab[j][0]] += rr * ab[j][1];
          for (k = 0; k < ab.length; k++) H[ab[j][0]][ab[k][0]] += w * ab[j][1] * ab[k][1];
        }
      }
      var d = solveLin(H, gr);
      if (!d) break;
      var big = 0;
      for (j = 0; j < P; j++) { var dj = U.clamp(d[j], -0.3, 0.3); th[j] += dj; if (mabs(dj) > big) big = mabs(dj); }
      if (big < 1e-6) break;
    }
    var useA = abP.length > 0;
    var o = inf.dims.map(function (x) { return x.on ? 0 : null; }), cap = inf.dims.map(function () { return 0; });
    for (j = 0; j < J; j++) {
      var dm = act[j], c = capStep(def, dm), v = th[j];
      if (!isNum(v)) v = 0;
      if (mabs(v) >= c - 1e-9) { cap[dm.i] = 1; v = v > 0 ? c : -c; }
      o[dm.i] = U.round(v, 4);
    }
    return { o: o, cap: cap, intercept: useA ? U.round(th[J], 4) : 0, n: ys.length };
  }

  // The mean level index of each dimension over rows (the region the next items come from); null without rows.
  function meanLv(def, inf, rows) {
    var sum = inf.dims.map(function () { return 0; }), n = 0;
    for (var i = 0; i < rows.length; i++) {
      var params;
      try { params = PX.ex.decodeParams(def, rows[i][3]); } catch (e) { params = null; }
      if (!params) continue;
      n++;
      for (var d = 0; d < inf.dims.length; d++) if (inf.dims[d].on && isNum(params[inf.dims[d].key])) sum[d] += params[inf.dims[d].key];
    }
    return n ? sum.map(function (x, d) { return inf.dims[d].on ? U.round(x / n, 2) : null; }) : null;
  }

  function fit(rec, def, display, now) {
    var D = cfg();
    if (!def || !isArray(def.dims)) return null;
    var h = host(rec, def, display, true), prev = valid(h.dims, def) ? h.dims : null, before = state(rec, def, display);
    var inf = info(def), R = rowsFor(rec, def, display, mmax(1, D.window | 0));
    var s = blank(def);
    s.n = R.n;
    s.at = isNum(now) ? now : null;
    s.lead = leadIndex(inf, prev ? prev.lead : null);
    // the centre: where the recent answers lie (config.dims.centre rows), so the rating holds the ability
    // there and the offsets only move items away from it
    var c = meanLv(def, inf, R.rows.slice(-mmax(1, (isNum(D.centre) ? D.centre : 50) | 0)));
    if (c) s.c = c;
    if (D.on !== false && R.n >= D.from && inf.on.length) {
      var f = solve(def, inf, R.rows, E.est.get(rec, def, { display: display }).mu, s.c);
      s.o = f.o;
      s.cap = f.cap;
    }
    h.dims = s;
    var after = state(rec, def, display);
    // The rating was learnt under the offsets and centres in use so far: at the new centre the new offsets
    // add nothing, the old ones Σ o_old (c_new − c_old), so the rating moves by that much and its
    // predictions where the recent answers lie stay the same (config.dims.shift).
    if (D.shift !== false && after && before && before.active) {
      var delta = 0;
      for (var d = 0; d < inf.dims.length; d++) if (inf.dims[d].on && before.o[d]) delta -= before.o[d] * (after.c[d] - before.c[d]);
      if (mabs(delta) > 1e-9) {
        var slot = E.est.slot(rec, def, { display: display });
        slot.mu = U.clamp(slot.mu + delta, C.grid.lo, C.grid.hi);
      }
    }
    return after;
  }

  /* ---------- the person pool ---------- */

  var poolCache = typeof WeakMap === 'function' ? new WeakMap() : null;
  function pool(rec, def, display) {
    var s = state(rec, def, display);
    if (!s || !s.active || !s.o.some(function (x) { return !!x; })) return null;
    var key = s.o.map(function (x, i) { return x === null ? '-' : x.toFixed(4) + '@' + s.c[i]; }).join(',');
    var hit = poolCache && poolCache.get(def);
    if (hit && hit.map[key]) return hit.map[key];
    var base = M.poolEntry(def), inf = info(def);
    var list = base.list.map(function (c) {
      var off = 0;
      for (var i = 0; i < inf.dims.length; i++) if (s.o[i]) off += s.o[i] * (c.lv[i] - s.c[i]);
      return { params: c.params, key: c.key, code: c.code, b: c.b + off, b0: c.b, g: c.g, lv: c.lv, tags: c.tags, vtag: c.vtag, v: c.v, i: c.i };
    });
    var entry = { def: def, list: list, byKey: Object.create(null), refChance: base.refChance, groups: [], person: true, o: s.o.slice(), c: s.c.slice() };
    list.forEach(function (c) { entry.byKey[c.key] = c; });
    var byG = {};
    list.forEach(function (c) { var k = String(c.g); (byG[k] || (byG[k] = { g: c.g, list: [] })).list.push(c); });
    Object.keys(byG).sort().forEach(function (k) {
      var grp = byG[k];
      grp.list.sort(function (a, b) { return a.b - b.b || a.code - b.code; });
      grp.bs = grp.list.map(function (c) { return c.b; });
      entry.groups.push(grp);
    });
    if (poolCache) {
      if (!hit) poolCache.set(def, hit = { map: {}, keys: [] });
      hit.map[key] = entry;
      hit.keys.push(key);
      while (hit.keys.length > 6) delete hit.map[hit.keys.shift()];
    }
    return entry;
  }

  /* ---------- frontiers and the leading dimension ---------- */

  // Automatic choices keep to trainVariants (modes' autoFilter), so frontiers use what Train shows.
  function trainFilter(def) { return E.modes && E.modes._ && E.modes._.autoFilter ? E.modes._.autoFilter(def, null) : null; }

  // Per level of dimension i: the easiest candidate with that level (the other dimensions at their easiest).
  function easiest(list, i, L, filter) {
    var out = new Array(L);
    for (var q = 0; q < list.length; q++) {
      var c = list[q];
      if (filter && !filter(c)) continue;
      var lv = c.lv[i], cur = out[lv];
      if (!cur || c.b < cur.b - 1e-12 || (mabs(c.b - cur.b) <= 1e-12 && c.code < cur.code)) out[lv] = c;
    }
    return out;
  }
  function handled(st, c, k, useSd, tol) {
    var p = useSd ? M.pExp(st.mu, st.sd, c.b, c.g) : M.p(st.mu, c.b, c.g);
    return p >= M.target(c.g, k) - (tol || 0) - 1e-12;
  }
  // The hardest level of dimension i handled at k, scanning from the easiest level; −1 when none is.
  function hardestHandled(dm, low, st, k, useSd, tol) {
    var best = -1;
    for (var t = 0; t < dm.L; t++) {
      var lv = dm.hard > 0 ? t : dm.L - 1 - t, c = low[lv];
      if (c && handled(st, c, k, useSd, tol)) best = lv;
    }
    return best;
  }

  function frontier(rec, def, display, opts) {
    opts = opts || {};
    if (!def || !isArray(def.dims)) return [];
    var st = opts.st || E.est.get(rec, def, { display: display });
    var k = isNum(opts.k) ? opts.k : C.levelRef, useSd = opts.sd === true;
    var list = (pool(rec, def, display) || M.poolEntry(def)).list;
    var filter = opts.filter === undefined ? trainFilter(def) : opts.filter, inf = info(def), out = [];
    for (var q = 0; q < inf.on.length; q++) {
      var dm = inf.dims[inf.on[q]], low = easiest(list, dm.i, dm.L, filter);
      var lv = hardestHandled(dm, low, st, k, useSd, opts.tol);
      var dim = def.dims[dm.i], top = dm.hard > 0 ? dm.L - 1 : 0;
      out.push({ dim: dm.i, key: dm.key, label: dm.label, level: lv, value: lv >= 0 ? dim.levels[lv] : null, of: dm.L, top: lv === top, floor: lv < 0 });
    }
    return out;
  }

  // The leading dimension next in turn and its frontier level at the item target (the other dimensions easy).
  function lead(rec, def, display, opts) {
    opts = opts || {};
    if (!def || !isArray(def.dims)) return null;
    var inf = info(def);
    if (inf.on.length < 2) return null;
    var h = host(rec, def, display, false), s = h && valid(h.dims, def) ? h.dims : null;
    var d = leadIndex(inf, s ? s.lead : null), dm = inf.dims[d];
    var st = opts.st || E.est.get(rec, def, { display: display }), k = isNum(opts.k) ? opts.k : M.styleK(C.style);
    var list = (pool(rec, def, display) || M.poolEntry(def)).list;
    var filter = offScoped(def, opts.filter === undefined ? trainFilter(def) : opts.filter); // as leadPlan
    var lv = hardestHandled(dm, easiest(list, d, dm.L, filter), st, k, true, C.select.tol);
    return { dim: d, key: dm.key, level: lv };
  }
  function nextLead(inf, d) {
    var at = inf.on.indexOf(d);
    return inf.on[(at + 1) % inf.on.length];
  }

  /* ---------- deck room (conflict 10) ---------- */

  function room(plan) {
    var D = cfg();
    return mmax(0, (isNum(D.maxChanged) ? D.maxChanged : 3) - (plan && isNum(plan.deckChanged) ? plan.deckChanged : 0));
  }

  /* ---------- fluency items ---------- */

  // Speed is open for the exercise, and its Train items carry no Quick deadline of their own (def.pace:
  // every Train item of Central Point is already timed by its staircase).
  function fluencyOpen(rec, def, display) {
    if (!def || def.role !== 'train' || def.pace || !E.speed || typeof E.speed.open !== 'function') return false;
    var o = E.speed.open(rec, def, { display: display });
    return !!(o && o.ok);
  }

  function shareOf(ctx) {
    var D = cfg();
    var sh = ctx && isObj(ctx.share) ? ctx.share : {};
    return isNum(sh.fluency) && sh.fluency >= 0 ? sh.fluency : D.fluency;
  }

  function rngOf(plan) {
    if (!plan.dimsRng) plan.dimsRng = PX.rng(PX.rng.hash('px-dims', String(plan.id || ''), isNum(plan.start) ? plan.start : 0));
    return plan.dimsRng;
  }

  // The fluent zone of the Speed group (variant and guessing rate of Speed's staircase): settings whose
  // untimed success is predicted at g + (1 − g)·0.85 or better; the pick aims halfway to the ceiling, as
  // Speed does; the deadline is Speed's own for that variant, else 1.5 × the untimed reference time.
  function fluencyPick(plan, rec, def, o, ctx, pe) {
    var S = C.speed, tm = isObj(rec.timed) && isObj(rec.timed[def.id]) ? rec.timed[def.id] : {};
    var tg = E.modes._.timedGroup(def, typeof tm.variant === 'string' ? tm.variant : undefined);
    var u = ctx.st || E.est.get(rec, def, { display: plan.display }), fk = S.fluentK, f0 = o.filter;
    var ok = function (c) {
      return c.g === tg.g && (tg.variant === null || c.params.variant === tg.variant) && (!f0 || f0(c)) &&
        !scopedParams(def, c.params) && M.pExp(u.mu, u.sd, c.b, c.g) >= M.target(c.g, fk);
    };
    var list = (pe || M.poolEntry(def)).list, any = false;
    for (var q = 0; q < list.length && !any; q++) if (ok(list[q])) any = true;
    if (!any) { o.kind = 'easy'; return { kind: 'easy' }; } // nothing fluent in this run's settings: the deck's easy item after all (o.kind too, which scopedPick reads)
    var refRt = isNum(tm.refRt) && tm.refRt > 0 ? tm.refRt : E.speed.untimedRt(rec, def);
    var sameV = (typeof tm.variant === 'string' ? tm.variant : null) === tg.variant;
    var dl = sameV && isNum(tm.deadline) && tm.deadline > 0 ? tm.deadline : S.startFactor * refRt;
    o.filter = ok;
    o.k = (fk + 1 - C.lapse) / 2;
    return { deadlineMs: mround(U.clamp(dl, S.minDeadline, S.maxDeadline)), timed: true, refRt: mround(refRt), tgVariant: tg.variant };
  }

  // After makeStep (MODES.train.next): the timed rating starts from the untimed one, a little wider, as
  // Speed's does; the item's timed difficulty grows 1 logit per halving of the deadline against the
  // reference time (C.speed.perHalving); its prediction and target are the timed ones.
  function timedStep(plan, rec, def, step, now) {
    var S = C.speed, slot = E.est.slot(rec, def, { timed: true, display: plan.display });
    if (!(slot.n > 0)) {
      var u = E.est.get(rec, def, { display: plan.display });
      slot.mu = u.mu;
      slot.sd = mmax(u.sd, 0.8);
    }
    var tm = E.speed.state(rec, def.id);
    if (!isNum(tm.refRt) || tm.refRt <= 0) tm.refRt = isNum(step.refRt) && step.refRt > 0 ? step.refRt : mround(E.speed.untimedRt(rec, def));
    step.bTimed = step.b + S.perHalving * mlog(tm.refRt / step.deadlineMs) / Math.LN2;
    var tst = E.est.get(rec, def, { display: plan.display, timed: true }, now);
    step.pPred = M.pExp(tst.mu, tst.sd, step.bTimed, step.g);
    step.target = M.target(step.g, mmin(plan.k, S.maxK));
  }

  // A fluency answer (MODES.train.answer): right in time moves the timed rating up; a slow or wrong answer
  // down; the untimed rating, weak spots and blocks of 10 are not touched (out.rated stays false). The
  // Speed deadline moves as in Speed mode: 0.02 log10 shorter after an answer right in time, longer by
  // 0.02 × p*/(1 − p*) otherwise, so about p* of fluency items come right in time.
  function fluencyAnswer(plan, rec, step, ok, result, now, out) {
    var def = PX.ex.get(step.exId), S = C.speed;
    var rt = result && isNum(result.rt) ? result.rt : Infinity;
    var inTime = !!ok && !(result && result.timeout) && rt <= step.deadlineMs;
    out.rating = E.est.rate(rec, def, step.params, inTime, now, { display: plan.display, timed: true, b: isNum(step.bTimed) ? step.bTimed : step.b, g: step.g });
    out.rated = false;
    out.timed = true;
    out.inTime = inTime;
    var tm = E.speed.state(rec, def.id), p = M.target(step.g, mmin(plan.k, S.maxK));
    var x = mlog(step.deadlineMs) / Math.LN10 + (inTime ? -S.step : S.step * p / (1 - p));
    x = U.clamp(x, mlog(S.minDeadline) / Math.LN10, mlog(S.maxDeadline) / Math.LN10);
    tm.deadline = mround(mpow(10, x));
    if (typeof step.tgVariant === 'string') tm.variant = step.tgVariant; else delete tm.variant;
    out.deadlineMs = tm.deadline;
    out.fluency = { inTime: inTime, deadlineMs: step.deadlineMs, next: tm.deadline, target: p };
  }

  /* ---------- hooks ---------- */

  function kindHook(plan, rec, def, kind, ctx) {
    var D = cfg();
    if (D.on === false || !def || plan.mode !== 'train') return null;
    var f = shareOf(ctx), easy = isNum(C.mix.easy) && C.mix.easy > 0 ? C.mix.easy : 0.1;
    var sh = ctx && isObj(ctx.share) ? ctx.share : {};
    // Speed open when the session started (startHook), so a session never changes its mix half-way
    var open = typeof sh.dimsOpen === 'boolean' ? sh.dimsOpen : fluencyOpen(rec, def, plan.display);
    if (kind === 'easy') {
      if (!(f > 0) || !open) return null;
      return f >= easy - 1e-9 || rngOf(plan).chance(f / easy) ? 'fluency' : null;
    }
    if (kind !== 'target' || room(plan) <= 0) return null;
    // a larger fluency share (a plateau change) takes target items too: (f − easy) of the deck
    var nT = 10 * (1 - easy - (isNum(C.mix.stretch) ? C.mix.stretch : 0.1));
    if (f > easy + 1e-9 && nT > 0 && open && rngOf(plan).chance(mmin(1, (f - easy) * 10 / nT))) return 'fluency';
    // leading items from the session after the exercise's first fit with D.leadFrom answers
    var fs = state(rec, def, plan.display);
    if (!(isNum(D.lead) && D.lead >= 1) || !fs || !(fs.n >= D.leadFrom) || info(def).on.length < 2) return null;
    sh.dimsT = (isNum(sh.dimsT) ? sh.dimsT : 0) + 1;
    if (sh.dimsT % mround(D.lead) !== 0) return null;
    var lp = leadPlan(plan, rec, def, ctx);
    if (!lp) return null;
    plan.dimsLead = { pos: plan.pos, exId: def.id, d: lp.d, lv: lp.lv, key: lp.key }; // the pick hook leads only this item
    return 'lead';
  }

  // The leading item's plan, decided with the kind (so no later hook meets a kind taken back): the
  // dimension in turn, its frontier level at the item target with the other dimensions easy, and an item of
  // that level near the target in this run's settings; else null (the item stays a target item). The turn
  // passes either way.
  function leadPlan(plan, rec, def, ctx) {
    var inf = info(def);
    if (inf.on.length < 2) return null;
    var h = host(rec, def, plan.display, true);
    if (!valid(h.dims, def)) h.dims = blank(def);
    var s = h.dims, d = leadIndex(inf, s.lead), dm = inf.dims[d];
    s.lead = nextLead(inf, d);
    var st = ctx.st || E.est.get(rec, def, { display: plan.display }), k = plan.k, tol = C.select.tol;
    var run = ctx.run, rf = run && run.variant !== undefined ? function (c) { return c.params.variant === run.variant; } : null;
    // off the scoped shortcut cells (SCOPED): the frontier and the item both
    var f0 = offScoped(def, E.modes._.autoFilter(def, rf)), pe = pool(rec, def, plan.display), list = (pe || M.poolEntry(def)).list;
    var lv = hardestHandled(dm, easiest(list, d, dm.L, f0), st, k, true, tol);
    if (lv < 0) return null;
    for (var q = 0; q < list.length; q++) {
      var c = list[q];
      if (c.lv[d] !== lv || (f0 && !f0(c))) continue;
      if (mabs(M.pExp(st.mu, st.sd, c.b, c.g) - M.target(c.g, k)) <= tol) return { d: d, lv: lv, key: dm.key };
    }
    return null;
  }

  function pickHook(plan, rec, def, o, ctx) {
    var D = cfg();
    if (D.on === false || !def) return null;
    var pe = pool(rec, def, plan.display);
    if (pe) o.pool = pe;
    var L = plan.dimsLead;
    if (ctx && ctx.kind === 'lead' && L && L.pos === plan.pos && L.exId === def.id) {
      var f0 = o.filter, d = L.d, lv = L.lv;
      o.filter = function (c) { return c.lv[d] === lv && (!f0 || f0(c)) && !scopedParams(def, c.params); };
      return { lead: L.key };
    }
    if (ctx && ctx.kind === 'fluency') return fluencyPick(plan, rec, def, o, ctx, pe);
    return null;
  }

  // The last pick hook (order 90): a leading or fluency item stays off the scoped shortcut cells however
  // the hooks after order 10 left its filter (a plateau's wider mix or variant swap replaces it, which
  // dropped the exclusion), and its filter keeps a candidate, so modes' fallback, which drops every filter,
  // never deals it. When nothing off the cells passes the filter, the fallback's own steps are taken here
  // off the cells: the exercise's Train variants, then any setting. Exercises without such cells, and
  // every other kind, are left as they were. (Cells that only the seed names: seedFor, in MODES.train.next.)
  function scopedPick(plan, rec, def, o, ctx) {
    if (!def || !isObj(o) || (o.kind !== 'lead' && o.kind !== 'fluency') || !hasParamCells(def)) return null;
    var list = o.pool && isArray(o.pool.list) && o.pool.list.length === M.pool(def).length ? o.pool.list : M.pool(def);
    var f = offScoped(def, o.filter);
    if (!anyPasses(list, f)) {
      f = offScoped(def, E.modes._.autoFilter(def, null));
      if (!anyPasses(list, f)) f = offScoped(def, null);
      if (!anyPasses(list, f)) return null; // every setting is a scoped cell: never a dead end
    }
    o.filter = f;
    return null;
  }
  function hasParamCells(def) {
    for (var i = 0; i < SCOPED.length; i++) if (SCOPED[i].ex === def.id && SCOPED[i].when) return true;
    return false;
  }
  function anyPasses(list, f) {
    for (var q = 0; q < list.length; q++) if (f(list[q])) return true;
    return false;
  }

  // At a Train session's start: whether Speed is open for each of its exercises (fluency items then).
  function startHook(plan, rec) {
    var D = cfg();
    if (D.on === false || !plan || plan.mode !== 'train' || plan.unavailable || !isArray(plan.exs)) return;
    if (!isObj(plan.share)) plan.share = {};
    plan.exs.forEach(function (id) {
      var def = PX.ex.get(id);
      if (!def) return;
      var sh = isObj(plan.share[id]) ? plan.share[id] : (plan.share[id] = {});
      sh.dimsOpen = fluencyOpen(rec, def, plan.display);
    });
  }

  function finishHook(plan, rec, now, res) {
    var D = cfg();
    if (D.on === false || (plan.mode !== 'train' && plan.mode !== 'path')) return;
    var rated = isObj(plan.rated) ? plan.rated : {}, out = {};
    Object.keys(rated).forEach(function (id) {
      if (!(rated[id] && rated[id].n > 0)) return;
      var def = PX.ex.get(id);
      if (!def || def.role !== 'train') return;
      var s = fit(rec, def, plan.display, now);
      if (s) out[id] = { active: s.active, n: s.n, o: s.o.slice(), cap: s.cap.slice() };
    });
    if (res) res.dims = out;
  }

  var offScopedPick = null;
  if (E.modes && typeof E.modes.hook === 'function') {
    E.modes.hook('start', startHook, { id: 'dims.open', order: 10 });
    E.modes.hook('kind', kindHook, { id: 'dims.kind', order: 10 });
    E.modes.hook('pick', pickHook, { id: 'dims.pick', order: 10 });
    offScopedPick = E.modes.hook('pick', scopedPick, { id: 'dims.scoped', order: 90 });
    E.modes.hook('finish', finishHook, { id: 'dims.fit', order: 10 });
  }

  E.dims = {
    state: state, fit: fit, b: bOf, pool: pool, frontier: frontier, lead: lead, room: room,
    fluencyOpen: fluencyOpen, timedStep: timedStep, fluencyAnswer: fluencyAnswer,
    scoped: SCOPED, isScoped: isScoped, seedFor: seedFor, // the scoped shortcut cells (CLAUDE.md rule 5), for the tests too
    _: { info: info, rowsFor: rowsFor, solve: solve, offsetOf: offsetOf, priorSd: priorSd, capStep: capStep, kindHook: kindHook, pickHook: pickHook, finishHook: finishHook, startHook: startHook,
      scopedPick: scopedPick,
      // tests only: removes the order-90 hook in this context, to show what it guards (tests/node/dims-scoped.test.mjs)
      unhookScoped: function () { if (offScopedPick) { offScopedPick(); offScopedPick = null; } } },
  };
})(window.PX);
