/* EX-17 Hole Punch: the hole-punching format on Fold's exact paper model (pure; ARCHITECTURE.md §5,
   docs/research/v1.1/R3-dat-pat.md §2.2, §3.4, §8.1).

   The task. A square sheet of 4 × 4 cells is folded two or three times, then punched once
   through every layer. Which of five unfolded sheets shows the holes? Each option is the 4 × 4
   grid of 16 positions with the holes filled; every option has the same number of holes.

   Model. Fold's own model (js/ex/fold/gen.js), run on a 4 × 4 sheet through the export block at
   the end of that file (lib.sheet(4, fn, hooks)): the same fold classes (H straight, C corner,
   D diagonal), the same rule that a flap lands inside the paper (so the paper never leaves the
   original square and is never turned over as a whole), the same punch rule (never on a crease,
   always through whole cells) and the same show-me states. Fold's ids, ratings and items do not
   change: Hole Punch is its own exercise with its own rating.

   Two or three folds, never one: the official rules say every item has more than one fold
   (R3 §2.2), and with one fold the key is {punch, its mirror}, so two cheap rules ("the hole
   under the punch", "symmetric about the crease") cannot both be matched by any foil.

   Foils. Fold's neighbouring problems (a fold unfolded across a wrong line, two wrong lines, two
   folds in the wrong order, the punch one cell away, mirrors), widened for the small sheet with
   every other line for one unfolding, "the punch at another place" (the true holes of a punch at
   any other cell with as many layers) and its mirrors, and "the answer turned". Five options
   (prep sources describe four or five; R3 §2.2): a fifth leaves room to match both rules above
   when only one fold matters. The four foils are chosen against the cheap rules below, so that
   each lands on the key about one time in five:
   - "a hole under the punch": the key always has one (the bottom layer there never moves), so
     as many foils as possible share it, and at least one;
   - "most symmetric about the first crease" and "most symmetric about any axis of the sheet":
     the key's rank meets a random target, and a fully symmetric key gets as many equally
     symmetric foils as possible, and at least one;
   - "most like the others" / "odd one out" (total Hamming distance): a random target rank.
   With one fold that matters, the two capped rules share the foils (two each at best), so those
   items sit near one in three; the pool stays within chance + 10 points (node test).

   Crease symmetry is the format's method, not a shortcut (the lead's decision after
   RV-dat-style-A §1; DECISIONS.md): keep the sheets with a hole under the punch, then take the
   one most symmetric about the drawn creases (summed). Prep courses teach it (R3 §3.4) and the
   analytic strategy card describes it; on a 4 × 4 sheet the true holes are often the only sheet
   that passes it, so no choice of foils could hide it. It finds the key in 89 % of items (node
   test, information only): every time when each crease is a mirror line of the key (6 % of
   items), 91 % with an idle fold (57 %), 84 % with a partial flap (37 %: a fold that matters but
   whose crease is only partly a mirror line of the key, as the other folds' unfoldings put holes
   off it). Partial flaps are where it fails, not idle folds (by idle folds 0 / 1 / 2: 87 / 92 /
   84 %), together with the levels that already rate hardest: three folds (83 %) and mixed folds
   (71 %). There the layers have to be tracked, which is the skill the exercise trains.

   Difficulty (hand-set; refit from pooled exports): folds 2–3 (0.9: on a 4 × 4 sheet with one
   punch every fold that matters doubles the holes and adds an unfolding step for each; Fold uses
   0.6 on its 8 × 8 sheet), type half / corner / diagonal / mixed (0.45, Fold's order: diagonal
   folds mixed with straight ones are hardest, Burte et al. 2018), folds that do not matter 0–2
   (−0.45; at most folds − 1). Base −1.85 for two folds that both matter: the easiest item (two
   straight folds, one of them missing the punch) is about 90 % right at θ = 0 with 5 options.
   The range is 2.7 logits, under the usual 4: the format allows at most three folds and one
   punch, so the level scale tops out sooner than Fold's.

   Item: { ex: 'patfold', v: 1, seed, params, key, n: 4, nOptions: 5, holes, folds, punches: [[i, j]],
   options, why, steps } with folds, steps and why exactly as in Fold (cells [column, row], steps[k]
   the state after k folds with outline, holes and faces). validate re-runs Fold's independent
   triangle re-simulation on the item (as a 4 × 4 Fold item) and adds the PAT rules (one punch,
   two or three folds, five options, every hole on the 16 positions). */
(function (PX) {
  'use strict';

  var floor = Math.floor, abs = Math.abs, isArray = Array.isArray, isInt = Number.isInteger;
  var INF = Infinity, EPS = 1e-9;
  var SIZE = 4;
  var FOLDS = [2, 3];
  var TYPES = ['half', 'corner', 'diagonal', 'mixed'];
  var IDLE = [0, 1, 2];
  var NOPT = 5;
  var BASE = -1.85, STEP_FOLDS = 0.9, STEP_TYPE = 0.45, STEP_IDLE = -0.45;
  var AXES = [{ k: 'v', c: SIZE / 2 }, { k: 'h', c: SIZE / 2 }, { k: 'd', c: 0 }, { k: 'a', c: SIZE }];

  function foldLib() {
    var d = PX.ex.get('fold');
    if (!d || !d.lib || typeof d.lib.sheet !== 'function') throw new Error('patfold needs js/ex/fold/gen.js (with its v1.1 export block) loaded first');
    return d.lib;
  }

  function normParams(params) {
    var p = {};
    [['folds', FOLDS], ['type', TYPES], ['idle', IDLE]].forEach(function (d) {
      var v = params ? params[d[0]] : 0;
      p[d[0]] = isInt(v) && v >= 0 && v < d[1].length ? v : 0;
    });
    return p;
  }
  // Fold's params: its folds levels are [1, 2, 3, 4, 5], so 2 and 3 folds are its indices 1 and 2.
  function foldParams(p) { return { folds: p.folds + 1, type: p.type, punches: 0, idle: p.idle }; }
  function idleOf(p) { return Math.min(IDLE[p.idle], FOLDS[p.folds] - 1); }
  function difficulty(params) {
    var p = normParams(params);
    return BASE + STEP_FOLDS * p.folds + STEP_TYPE * p.type + STEP_IDLE * idleOf(p);
  }
  function rint(r, n) { return floor(r.next() * n); }
  function rankCost(t, lo, hi) { return t < lo ? lo - t : t > hi ? t - hi : 0; }

  /* ---------- the foil hooks (run inside lib.sheet(4, …), so N = 4 there) ---------- */

  var api = null; // the sheet API of the current lib.sheet call

  // Widens Fold's pool with neighbouring problems that a 4 × 4 sheet needs: "the punch at another
  // place" (the true holes of a punch at any other cell of the folded paper with as many layers;
  // layersAt lists the original cells lying there) and its mirrors across the sheet's axes, and
  // "the answer turned" (the paper turned a quarter or half turn, which the rules exclude).
  function turnCell(c, q) {
    var i = c[0], j = c[1], m = SIZE - 1;
    return q === 1 ? [m - j, i] : q === 2 ? [m - i, m - j] : [j, m - i];
  }
  function widenPool(ctx, pool) {
    var A = api, size = ctx.key.length, seen = {}, P = ctx.punches[0];
    function add(cells, why) {
      var m = A.maskOf(cells);
      if (!m || A.popcount(m[0]) + A.popcount(m[1]) !== size) return;
      var k = A.maskKey(m);
      if (seen[k]) return;
      seen[k] = true;
      pool.push({ mask: m, why: why });
    }
    seen[A.maskKey(ctx.keyMask)] = true;
    pool.forEach(function (f) { seen[A.maskKey(f.mask)] = true; });
    // Every wrong line for one unfolding (Fold tries parallel lines 1–3 cells away and lines
    // through the crease's middle; a 4 × 4 sheet needs them all to find enough sheets).
    var F = ctx.folds.length, order = [], k, kind, c;
    for (k = F - 1; k >= 0; k--) order.push(k);
    for (k = 0; k < F; k++) {
      for (kind = 0; kind < 4; kind++) {
        var kk = 'vhda'.charAt(kind), lo = kk === 'd' ? -SIZE + 1 : 1, hi = kk === 'a' ? 2 * SIZE - 1 : kk === 'd' ? SIZE - 1 : SIZE - 1;
        for (c = lo; c <= hi; c++) {
          var L0 = ctx.folds[k].line;
          if (L0.k === kk && L0.c === c) continue;
          var alt = {};
          alt[k] = { k: kk, c: c };
          var m = A.unfoldMask([P], ctx.steps, order, size, alt);
          if (m) add(A.maskCells(m), 'fold ' + (k + 1) + ' unfolded across another line');
        }
      }
    }
    for (var j = 0; j < SIZE; j++) {
      for (var i = 0; i < SIZE; i++) {
        if (i === P[0] && j === P[1]) continue;
        var lay = ctx.layersAt([i, j]);
        if (lay.length !== size) continue;
        add(lay, 'the holes of a punch at another place');
        AXES.forEach(function (ax) {
          add(lay.map(function (c) { return A.mirrorCell(ax.k, c[0], c[1]); }), 'the holes of a punch at another place, mirrored');
        });
      }
    }
    for (var q = 1; q <= 3; q++) add(ctx.key.map(function (c) { return turnCell(c, q); }), 'the answer turned');
    return pool;
  }

  // Scores of one hole set for the shortcut heuristics.
  function features(A, m, line1, punchMask) {
    var sa = 0;
    for (var a = 0; a < AXES.length; a++) { var s = A.symMask(m, AXES[a]); if (s > sa) sa = s; }
    return { s1: A.symMask(m, line1), sa: sa, up: (m[0] & punchMask[0]) === punchMask[0] && (m[1] & punchMask[1]) === punchMask[1] ? 1 : 0 };
  }
  // The key's place among the options on a "larger is better" score: [above, above + ties].
  function rankRange(keyV, vals) {
    var above = 0, tie = 0;
    for (var q = 0; q < vals.length; q++) { if (vals[q] > keyV + EPS) above++; else if (abs(vals[q] - keyV) <= EPS) tie++; }
    return [above, above + tie];
  }

  function selectFoils(r, keyCells, keyMask, pool, nf, line1, relaxed, punchMask) {
    var A = api;
    if (pool.length < nf) return null;
    var K = features(A, keyMask, line1, punchMask);
    pool.forEach(function (f) {
      var ft = features(A, f.mask, line1, punchMask);
      f.s1 = ft.s1; f.sa = ft.sa; f.up = ft.up;
      f.dk = A.hamming(f.mask, keyMask);
    });
    // Random target ranks (0 = the key scores best) for the rank heuristics; capped ones (the key
    // already has the largest possible score: the hole under the punch, full symmetry) want as
    // many ties as possible instead, and at least one: a key that alone has the punch hole or
    // alone is fully symmetric is rejected (the attempt fails and another fold is drawn). Where
    // the capped heuristics compete for the three foils (one fold that matters), a random tilt
    // decides which one gets the extra tie, so neither is favoured over the pool.
    var tc = rint(r, nf + 1), ts1 = rint(r, nf + 1), tsa = rint(r, nf + 1), tilt = rint(r, 2) * 0.6;
    var cap1 = K.s1 > 1 - EPS, capA = K.sa > 1 - EPS;
    var wU = 12 + tilt, wS = 12.6 - tilt;
    var best = null, bestCost = INF, n = pool.length, idx = new Array(nf);
    var tries = n <= 9 ? 240 : 600;
    for (var t = 0; t < tries; t++) {
      // nf distinct random pool entries
      for (var q = 0; q < nf; q++) {
        var v, dup;
        do { v = rint(r, n); dup = false; for (var w = 0; w < q; w++) if (idx[w] === v) dup = true; } while (dup);
        idx[q] = v;
      }
      var opt = idx.map(function (i2) { return pool[i2]; });
      // total Hamming distance of every option to the others ("most like the others")
      var tot = [0], q2, w2;
      for (q2 = 0; q2 < nf; q2++) { tot[0] += opt[q2].dk; tot.push(opt[q2].dk); }
      for (q2 = 0; q2 < nf; q2++) for (w2 = q2 + 1; w2 < nf; w2++) { var d = A.hamming(opt[q2].mask, opt[w2].mask); tot[q2 + 1] += d; tot[w2 + 1] += d; }
      var below = 0, tie = 0;
      for (q2 = 1; q2 <= nf; q2++) { if (tot[q2] < tot[0]) below++; else if (tot[q2] === tot[0]) tie++; }
      var r1 = rankRange(K.s1, opt.map(function (f) { return f.s1; }));
      var ra = rankRange(K.sa, opt.map(function (f) { return f.sa; }));
      var ups = 0;
      for (q2 = 0; q2 < nf; q2++) ups += opt[q2].up;
      if (!ups || (cap1 && !r1[1]) || (capA && !ra[1])) continue;
      var cost = rankCost(tc, below, below + tie)
        + (cap1 ? wS / (1 + r1[1]) : rankCost(ts1, r1[0], r1[1]))
        + (capA ? wS / (1 + ra[1]) : rankCost(tsa, ra[0], ra[1]))
        + wU / (1 + ups);
      if (cost < bestCost - EPS) { bestCost = cost; best = opt; }
    }
    return best;
  }
  var HOOKS = { pool: widenPool, select: selectFoils, nOptions: function () { return NOPT; } };

  /* ---------- items ---------- */

  function convert(raw, p, seed) {
    return {
      ex: 'patfold', v: 1, seed: seed, params: p, key: raw.key, n: raw.n, nOptions: raw.nOptions, holes: raw.holes,
      folds: raw.folds, punches: raw.punches, options: raw.options, why: raw.why, steps: raw.steps,
    };
  }
  function attempt(A, r, p, relaxed) {
    var raw = A.attempt(r, foldParams(p), relaxed);
    return raw ? convert(raw, p, 0) : null;
  }
  // Runs fn(A) on the 4 × 4 sheet with the hooks; nested calls reuse the open sheet.
  function onSheet(fn) {
    if (api) return fn(api);
    return foldLib().sheet(SIZE, function (A) {
      api = A;
      try { return fn(A); } finally { api = null; }
    }, HOOKS);
  }

  function generate(rng, params) {
    var p = normParams(params);
    return onSheet(function (A) {
      for (var i = 0; i < 50; i++) {
        var item = attempt(A, i === 0 ? rng : rng.fork('retry' + i), p, false);
        if (item) { item.seed = rng.seed; if (check(item) === true) return item; }
      }
      var fb = fallbackFor(p);
      fb.seed = rng.seed;
      return fb;
    });
  }

  // Fallback: a valid item for these params from a fixed search (the same for every seed, so
  // cached), soft limits relaxed after 200 tries; marked fallback: true (the engine voids it).
  // The node test finds one for every params combination within the first 400 tries.
  var fallbackCache = {};
  function fallbackFor(params) {
    var p = normParams(params), pk = PX.ex.paramsKey(p);
    return onSheet(function (A) {
      for (var i = 0; i < 2000 && !fallbackCache[pk]; i++) {
        var item = attempt(A, PX.rng(PX.rng.hash('patfold-fallback', pk, i)), p, i >= 200);
        if (item && check(item) === true) fallbackCache[pk] = item;
      }
      var out = PX.util.deepCopy(fallbackCache[pk] || null);
      if (out) out.fallback = true;
      return out;
    });
  }

  /* ---------- validator ---------- */

  function validate(item) {
    try { return check(item); } catch (e) { return 'validate threw: ' + (e && e.message); }
  }
  function check(item) {
    if (!item || item.ex !== 'patfold') return 'not a patfold item';
    var p = item.params || {};
    if (!(isInt(p.folds) && p.folds >= 0 && p.folds < FOLDS.length && isInt(p.type) && p.type >= 0 && p.type < TYPES.length
      && isInt(p.idle) && p.idle >= 0 && p.idle < IDLE.length)) return 'bad params';
    if (item.n !== SIZE) return 'the sheet must be 4 × 4';
    if (!(isInt(item.key) && item.key >= 0 && item.key < NOPT)) return 'key out of range';
    if (!isArray(item.punches) || item.punches.length !== 1) return 'one punch';
    if (!isArray(item.folds) || item.folds.length !== FOLDS[p.folds]) return 'expected ' + FOLDS[p.folds] + ' folds';
    if (!isArray(item.options) || item.options.length !== NOPT || item.nOptions !== NOPT) return 'expected ' + NOPT + ' options';
    for (var o = 0; o < NOPT; o++) {
      var opt = item.options[o];
      if (!isArray(opt) || !opt.length) return 'option ' + (o + 1) + ' has no holes';
      for (var q = 0; q < opt.length; q++) {
        var c = opt[q];
        if (!isArray(c) || !isInt(c[0]) || !isInt(c[1]) || c[0] < 0 || c[1] < 0 || c[0] >= SIZE || c[1] >= SIZE) return 'option ' + (o + 1) + ': a hole off the 16 positions';
      }
    }
    if (item.holes !== item.options[item.key].length) return 'hole count';
    // Fold's independent re-simulation on 4·16 triangles: legal folds of the stated classes, one
    // piece, a clean punch through whole cells, the folds that matter, exactly one option equal to
    // the true holes (the key), every option with that count, options pairwise different, and the
    // show-me states agreeing with the simulation.
    var asFold = {};
    Object.keys(item).forEach(function (k) { asFold[k] = item[k]; });
    asFold.ex = 'fold';
    asFold.params = foldParams(p);
    var v = onSheet(function (A) { return A.check(asFold); });
    if (v !== true) return 'fold model: ' + v;
    return checkSteps(item);
  }

  /* The drawn panels against an own simulation (RV-dat-style-A §4). Fold's check compares the
     show-me states by area and hole positions only, and the stem is drawn from item.steps. So every
     step is re-simulated here on the 64 triangles that the cells' diagonals cut the sheet into,
     each tracked by its centroid in sixths of a cell (exact integer reflections; no centroid lies
     on a grid line or on a 45° line through grid points, so every point-in-polygon test is exact).
     Per step: the outline holds exactly the positions that hold paper; the faces, rasterised at
     the centroids, are unions of whole triangles and cover each position once per layer there; at
     each position the faces taken by layer (top first) carry the simulated stack's flags (back
     up, moved by this fold); a moved face's `from` is its polygon reflected across the fold line
     and no other face has one; each face lists exactly the punched cells that lie on it. */
  var QX = [3, 5, 3, 1], QY = [1, 3, 5, 3], W6 = 6 * SIZE, NT = 4 * SIZE * SIZE;
  function polySix(P) {
    if (!isArray(P) || P.length < 3) return null;
    var out = [];
    for (var i = 0; i < P.length; i++) {
      var pt = P[i];
      if (!isArray(pt) || pt.length !== 2) return null;
      var x = Math.round(6 * pt[0]), y = Math.round(6 * pt[1]);
      if (!(abs(6 * pt[0] - x) < 1e-6 && abs(6 * pt[1] - y) < 1e-6)) return null;
      out.push([x, y]);
    }
    return out;
  }
  function twiceArea(P) {
    var s = 0;
    for (var i = 0, j = P.length - 1; i < P.length; j = i++) s += P[j][0] * P[i][1] - P[i][0] * P[j][1];
    return abs(s);
  }
  // Crossing number, exact in integers (the point is never on an edge).
  function inside(P, x, y) {
    var c = false;
    for (var i = 0, j = P.length - 1; i < P.length; j = i++) {
      var xi = P[i][0], yi = P[i][1], xj = P[j][0], yj = P[j][1];
      if ((yi > y) === (yj > y)) continue;
      var lhs = (x - xi) * (yj - yi), rhs = (y - yi) * (xj - xi);
      if (yj > yi ? lhs < rhs : lhs > rhs) c = !c;
    }
    return c;
  }
  function reflSix(L, x, y) {
    var c6 = 6 * L.c;
    return L.k === 'v' ? [2 * c6 - x, y] : L.k === 'h' ? [x, 2 * c6 - y] : L.k === 'd' ? [y + c6, x - c6] : [c6 - y, c6 - x];
  }
  function checkSteps(item) {
    var F = item.folds.length, X = [], Y = [], lay = [], flip = [], mv = [], t;
    for (t = 0; t < NT; t++) { var c0 = t >> 2; X.push(6 * (c0 % SIZE) + QX[t & 3]); Y.push(6 * floor(c0 / SIZE) + QY[t & 3]); lay.push(0); flip.push(0); mv.push(false); }
    if (!isArray(item.steps) || item.steps.length !== F + 1) return 'steps';
    for (var si = 0; si <= F; si++) {
      var L = si ? item.folds[si - 1].line : null;
      for (t = 0; t < NT; t++) mv[t] = false;
      if (L) {
        var m = item.folds[si - 1].move, c6 = 6 * L.c, top = 0;
        for (t = 0; t < NT; t++) if (lay[t] > top) top = lay[t];
        for (t = 0; t < NT; t++) {
          var s = L.k === 'v' ? X[t] - c6 : L.k === 'h' ? Y[t] - c6 : L.k === 'd' ? X[t] - Y[t] - c6 : X[t] + Y[t] - c6;
          if (m * s <= 0) continue;
          var q = reflSix(L, X[t], Y[t]);
          X[t] = q[0]; Y[t] = q[1]; lay[t] = 2 * top + 1 - lay[t]; flip[t] ^= 1; mv[t] = true;
        }
      }
      var r = checkStep(item.steps[si], L, X, Y, lay, flip, mv, item.options[item.key]);
      if (r !== true) return 'step ' + si + ': ' + r;
    }
    return true;
  }
  function checkStep(stp, L, X, Y, lay, flip, mv, keyCells) {
    var out = stp && polySix(stp.outline), i, j, q, t, x, y, fi;
    if (!out) return 'outline';
    if (!isArray(stp.faces) || !stp.faces.length) return 'faces';
    var stack = {}, cover = {}, faces = stp.faces, polys = [];
    for (t = 0; t < NT; t++) (stack[Y[t] * W6 + X[t]] = stack[Y[t] * W6 + X[t]] || []).push(t);
    for (fi = 0; fi < faces.length; fi++) {
      var fc = faces[fi], P = fc && polySix(fc.poly);
      if (!P || !isInt(fc.layer) || typeof fc.back !== 'boolean' || typeof fc.moved !== 'boolean' || !isArray(fc.holes)) return 'face ' + (fi + 1) + ' is malformed';
      polys.push(P);
    }
    for (j = 0; j < SIZE; j++) for (i = 0; i < SIZE; i++) for (q = 0; q < 4; q++) {
      x = 6 * i + QX[q]; y = 6 * j + QY[q];
      if (inside(out, x, y) !== !!stack[y * W6 + x]) return 'the outline differs from the paper';
      for (fi = 0; fi < faces.length; fi++) if (inside(polys[fi], x, y)) (cover[y * W6 + x] = cover[y * W6 + x] || []).push(fi);
    }
    var count = faces.map(function () { return 0; }), faceOf = [];
    for (var key in stack) {
      var ts = stack[key].slice().sort(function (a, b) { return lay[b] - lay[a]; });
      var fs = (cover[key] || []).slice().sort(function (a, b) { return faces[b].layer - faces[a].layer; });
      if (fs.length !== ts.length) return 'faces cover a place ' + fs.length + ' times, the paper has ' + ts.length + ' layers there';
      for (var k = 0; k < ts.length; k++) {
        var f = faces[fs[k]];
        if (k && faces[fs[k - 1]].layer === f.layer) return 'two faces share a layer';
        if (f.back !== !!flip[ts[k]]) return 'face ' + (fs[k] + 1) + ': back-up flag';
        if (f.moved !== mv[ts[k]]) return 'face ' + (fs[k] + 1) + ': moved flag';
        faceOf[ts[k]] = fs[k]; count[fs[k]]++;
      }
    }
    for (key in cover) if (!stack[key]) return 'a face covers a place without paper';
    for (fi = 0; fi < faces.length; fi++) {
      if (count[fi] * 18 !== twiceArea(polys[fi])) return 'face ' + (fi + 1) + ' is not a union of whole triangles on the sheet';
      var from = faces[fi].from;
      if (!faces[fi].moved || !L) { if (from !== undefined && from !== null) return 'face ' + (fi + 1) + ': an arrow on a face that did not move'; continue; }
      var Fr = polySix(from);
      if (!Fr || Fr.length !== polys[fi].length) return 'face ' + (fi + 1) + ': no arrow origin';
      for (q = 0; q < Fr.length; q++) {
        var e = reflSix(L, polys[fi][q][0], polys[fi][q][1]);
        if (Fr[q][0] !== e[0] || Fr[q][1] !== e[1]) return 'face ' + (fi + 1) + ': the arrow does not start where the flap was';
      }
    }
    // Holes: each punched cell is whole (its 4 triangles together) on one face.
    var want = faces.map(function () { return []; });
    for (q = 0; q < keyCells.length; q++) {
      var t0 = 4 * (keyCells[q][1] * SIZE + keyCells[q][0]), cx = floor(X[t0] / 6), cy = floor(Y[t0] / 6);
      for (t = t0 + 1; t < t0 + 4; t++) if (faceOf[t] !== faceOf[t0] || floor(X[t] / 6) !== cx || floor(Y[t] / 6) !== cy) return 'a punched cell is split';
      want[faceOf[t0]].push(cx + ',' + cy);
    }
    for (fi = 0; fi < faces.length; fi++) {
      var has = faces[fi].holes.map(function (c) { return isArray(c) ? c.join() : '?'; }).sort().join(' ');
      if (has !== want[fi].sort().join(' ')) return 'face ' + (fi + 1) + ': holes';
    }
    return true;
  }

  function score(item, response) { return { correct: isInt(response) && response === item.key }; }

  PX.ex.define({
    id: 'patfold', version: 1, code: 'EX-17', name: 'Hole punch', short: 'Hole Punch',
    abilities: ['Vz'], cell: 'intrinsic-dynamic', role: 'train', pat: true,
    requires: ['fold'], // Fold's paper model (lib.sheet), read at generate time
    answer: 'choice', nOptions: NOPT,
    dims: [
      { key: 'folds', label: 'Folds', levels: FOLDS, step: STEP_FOLDS },
      { key: 'type', label: 'Fold type', levels: TYPES, step: STEP_TYPE },
      { key: 'idle', label: 'Folds that do not matter', levels: IDLE, step: STEP_IDLE },
    ],
    base: BASE,
    difficulty: difficulty,
    chance: 1 / NOPT,
    generate: generate,
    validate: validate,
    score: score,
    lib: {
      SIZE: SIZE, FOLDS: FOLDS, TYPES: TYPES, IDLE: IDLE, AXES: AXES,
      norm: normParams, foldParams: foldParams, idleOf: idleOf, fallback: fallbackFor,
      // Fold's sheet helpers on the 4 × 4 sheet (maskOf, hamming, symScore, reflCell, …): fn(A).
      onSheet: onSheet,
      // Geometry that does not depend on the sheet size (for the view).
      reflPt: function (L, pt) { return foldLib().reflPt(L, pt); },
      reflCell: function (L, i, j) { return foldLib().reflCell(L, i, j); },
      clip: function (P, L, sgn) { return foldLib().clip(P, L, sgn); },
      grad: function (k) { return foldLib().grad(k); },
    },
  });
})(window.PX);
