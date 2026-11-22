/* PR-7 Motion Graphs: motion pictures and graphs over time (pure; PLAN milestone 6, the ladder's far rung beside
   Mechanisms; note T1 §5.2; reserved formats: tests/node/formats.test.mjs). A probe: never trained, no feedback.

   A cart moves along a straight track; a strobe picture shows where it was at seven equal time steps (numbered
   dots). Four kinds of question (variants), read in turn in a block (def.cycle):
     pos     the strobe picture → which position–time graph?
     vel     the strobe picture → which velocity–time graph? (a zero line marks standing still)
     strobe  a position–time graph → which strobe picture?
     frame   the strobe picture and a bus passing at a steady speed → which strobe picture does someone on the bus see?
   No physics is needed: the dots fix the motion, and the worked example says what a graph over time is.
   Motions: steady, faster, slower (level 0), stop-and-go (level 1), out and back (level 2).
   Foils come from known reading errors: the graph as a picture of the track (flat for steady motion), the velocity's
   shape for the position (and the position's for the velocity), time reversed, curving the other way, the wrong frame,
   another motion. Graphs carry no numbers, so every foil must differ from the answer after any stretch of the vertical
   axis: by at least 0.2 of the height at two or more marked times (positions scaled to their range; velocities to
   their largest size, the zero line kept). Foils are picked so the answer's rank on the cheap cues is random.

   Item: { ex, v, seed, params, kind, motion, x: [7 positions], key, nOptions: 4, answer: 'choice', options: [[7 numbers]],
   why, bus (frame items: its step per tick) }. Hand-set item model: base + the kind's offset + 0.7 per level.
   Version 2 (RV-items M7): a velocity item has at least two foils on the answer's side of the zero line (never
   touching it, or touching or crossing it, as the answer does), so "the graph that never meets the zero line" finds
   the answer no more often than chance + 10 (version 1: 59.8 % at level 0, where every cart keeps one direction).
   Version 1's range stays in def.past. */
(function (PX) {
  'use strict';

  var mabs = Math.abs, mmin = Math.min, mmax = Math.max, mround = Math.round;
  var KINDS = ['pos', 'vel', 'strobe', 'frame'];
  var OFFSET = { pos: 0.0, vel: 0.4, strobe: 0.2, frame: 0.7 };
  var FORMAT = { pos: 'motiongraphs:graph-over-time', vel: 'motiongraphs:graph-over-time', strobe: 'motiongraphs:strobe-picture', frame: 'motiongraphs:moving-frame' };
  var N = 7, BASE = -1.2, STEP = 0.7, MARGIN = 0.2;
  var MOTIONS = [['steady', 'faster', 'slower'], ['steady', 'faster', 'slower', 'stopgo'], ['faster', 'slower', 'stopgo', 'reverse']];

  function kindOf(params) { return params && KINDS.indexOf(params.variant) >= 0 ? params.variant : 'pos'; }
  function levelOf(params) { var l = params ? params.level : 0; return l === 1 || l === 2 ? l : 0; }
  function r2(x) { return mround(x * 2) / 2; }

  // positions at the seven flashes (track 0 … 12, half steps)
  function motion(rng, type) {
    var x = [], x0, v, a, k;
    if (type === 'steady') { v = rng.pick([1, 1.5, 2]) * (rng.chance(0.5) ? -1 : 1); x0 = v > 0 ? rng.int(0, 2) : 12 - rng.int(0, 2); for (k = 0; k < N; k++) x.push(x0 + v * k); }
    else if (type === 'faster') { v = rng.pick([0, 0.5]); a = rng.pick([0.5, 0.6]); x0 = rng.int(0, 1); for (k = 0; k < N; k++) x.push(r2(x0 + v * k + a * k * k / 2)); }
    else if (type === 'slower') { v = rng.pick([3, 3.5]); a = -v / (N - 0.5); x0 = rng.int(0, 1); for (k = 0; k < N; k++) x.push(r2(x0 + v * k + a * k * k / 2)); }
    else if (type === 'stopgo') {
      var rest = rng.int(2, 3), first = rng.chance(0.5); v = rng.pick([1.5, 2]); x0 = rng.int(0, 2);
      for (k = 0; k < N; k++) x.push(first ? x0 + v * mmax(0, k - rest) : x0 + v * mmin(k, N - 1 - rest));
    } else { // reverse: out, slowing, and back, speeding up (constant acceleration through standing still)
      v = rng.pick([3, 3.5]); a = -2 * v / (N - 1); x0 = rng.int(0, 2);
      for (k = 0; k < N; k++) x.push(r2(x0 + v * k + a * k * k / 2));
    }
    if (x.some(function (p) { return p < -0.01 || p > 12.01; })) return null;
    if (type !== 'steady' && rng.chance(0.5)) x = x.map(function (p) { return 12 - p; }); // half the carts go the other way
    if (mmax.apply(null, x) - mmin.apply(null, x) < 3) return null;
    return { type: type, x: x };
  }
  function velOf(x) { var v = []; for (var k = 0; k < x.length - 1; k++) v.push(x[k + 1] - x[k]); return v; }
  // the velocity graph at the flashes: the mean of the steps either side (ends: their one step)
  function velAt(x) {
    var s = velOf(x), out = [];
    for (var k = 0; k < x.length; k++) out.push(k === 0 ? s[0] : k === x.length - 1 ? s[s.length - 1] : (s[k - 1] + s[k]) / 2);
    return out;
  }
  function normPos(y) { var lo = mmin.apply(null, y), hi = mmax.apply(null, y), d = hi - lo; return y.map(function (v) { return d > 1e-9 ? (v - lo) / d : 0.5; }); }
  function normVel(y) { var m = mmax.apply(null, y.map(mabs)); return y.map(function (v) { return m > 1e-9 ? v / m : 0; }); }
  // two graphs look different: by MARGIN of the height at two or more marked times
  function differ(a, b, norm) {
    var A = norm(a), B = norm(b), n = 0;
    for (var i = 0; i < A.length; i++) if (mabs(A[i] - B[i]) >= MARGIN) n++;
    return n >= 2;
  }
  function rev(y) { return y.slice().reverse(); }
  function bend(x) { // the same start and end, curving the other way (a straight line stays straight: no foil)
    var x0 = x[0], x1 = x[x.length - 1], out = [];
    for (var k = 0; k < x.length; k++) { var lin = x0 + (x1 - x0) * k / (x.length - 1); out.push(r2(2 * lin - x[k])); }
    return out;
  }

  /* ---------- choosing foils (the answer's rank on the cheap cues lands on a random target) ---------- */

  function choose(rng, arr, k) { return rng.shuffle(arr).slice(0, k); }
  // Foil triples where, on every cue, some foil is at least as high as the answer and some at least as low (so no
  // cue singles the answer out), scored by how near the answer's rank comes to a random target per cue.
  // comp(tri): a triple the item may use at all (velocity items: two foils on the answer's side of the zero line)
  function balanced(rng, keyOpt, pool, feats, comp) {
    if (pool.length < 3) return null;
    var targets = feats.map(function () { return rng.int(0, 3); }), best = null, bestScore = Infinity;
    for (var t = 0; t < 400; t++) {
      var tri = choose(rng, pool, 3);
      if (comp && !comp(tri)) continue;
      var opts = [keyOpt].concat(tri.map(function (c) { return c.opt; })), sc = 0;
      for (var fi = 0; fi < feats.length; fi++) {
        var vals = opts.map(function (o) { return feats[fi](o, opts); }), r = 0, up = 0, down = 0;
        for (var i = 1; i < 4; i++) {
          r += vals[i] < vals[0] - 1e-9 ? 1 : mabs(vals[i] - vals[0]) <= 1e-9 ? 0.5 : 0;
          if (vals[i] >= vals[0] - 1e-9) up++;
          if (vals[i] <= vals[0] + 1e-9) down++;
        }
        sc += mabs(r - targets[fi]) + (up ? 0 : 3) + (down ? 0 : 3);
      }
      if (sc < bestScore) { bestScore = sc; best = tri; if (sc === 0) break; }
    }
    return best;
  }
  function dist(norm) { return function (a, b) { var A = norm(a), B = norm(b), s = 0; for (var i = 0; i < A.length; i++) s += mabs(A[i] - B[i]); return s; }; }
  function totalTo(d) { return function (o, opts) { var s = 0; opts.forEach(function (x) { if (x !== o) s += d(o, x); }); return s; }; }
  function last(o) { return o[o.length - 1] - o[0]; }
  // how much a graph bends, to the eye (a tenth of its height)
  function curl(norm) { return function (o) { var n = norm(o), s = 0; for (var i = 1; i < n.length - 1; i++) s += mabs(n[i + 1] - 2 * n[i] + n[i - 1]); return mround(s * 10) / 10; }; }
  function rise(o) { var n = 0; for (var i = 1; i < o.length; i++) if (o[i] > o[i - 1] + 1e-9) n++; return n; }
  // a velocity graph's side of the zero line: 0 when it never meets it (always forward or always back), 1 when it
  // touches or crosses it (the cart stands still, or turns)
  function zeroSide(o) { var lo = mmin.apply(null, o), hi = mmax.apply(null, o); return lo > 1e-9 || hi < -1e-9 ? 0 : 1; }

  /* ---------- the generator ---------- */

  function generateOnce(rng, kind, level) {
    var m = null;
    for (var t = 0; t < 20 && !m; t++) m = motion(rng, rng.pick(MOTIONS[level]));
    if (!m) return null;
    var x = m.x, key, norm, pool = [], bus = null;
    function add(why, y) {
      if (!y || y.some(function (v) { return !isFinite(v); })) return;
      if (!differ(y, key, norm)) return;
      if (pool.some(function (c) { return !differ(c.opt, y, norm); })) return;
      pool.push({ opt: y, why: why });
    }
    // other motions of this level, as foils of their own kind
    var others = [];
    for (var t2 = 0; t2 < 16; t2++) { var o = motion(rng, rng.pick(['steady', 'faster', 'slower', 'stopgo', 'reverse'])); if (o) others.push(o); }
    if (kind === 'pos' || kind === 'strobe') {
      key = x.slice(); norm = normPos;
      if (kind === 'pos') add('picture', x.map(function () { return 5; })); // the straight track drawn as the graph: flat
      add('velocity-shape', velAt(x).map(function (v) { return v * 2; }));
      add('time-reversed', rev(x));
      add('other-curve', bend(x));
      add('mirrored', x.map(function (v) { return 12 - v; }));
      others.forEach(function (o) { add('other-motion', o.x); });
    } else if (kind === 'vel') {
      key = velAt(x); norm = normVel;
      add('position-shape', x.map(function (v) { return v - x[0]; }));
      add('time-reversed', rev(key));
      add('sign', key.map(function (v) { return -v; }));
      add('picture', key.map(function () { return 1; }));
      others.forEach(function (o) { add('other-motion', velAt(o.x)); });
    } else { // frame: seen from a bus that moves u per flash
      var u = (x[N - 1] - x[0] >= 0 ? 1 : -1) * (level ? 1.5 : 1);
      key = x.map(function (v, k) { return v - u * k; }); norm = normPos; bus = u;
      add('wrong-way', x.map(function (v, k) { return v + u * k; }));
      add('ground', x.slice());
      add('time-reversed', rev(key));
      add('double', x.map(function (v, k) { return v - 2 * u * k; }));
      others.forEach(function (o) { add('other-motion', o.x.map(function (v, k) { return v - u * k; })); });
    }
    // velocity: two foils on the answer's side of the zero line, three on one item in three (so the side gives the
    // answer away about 31 % of the time at level 0, against 25 % chance)
    var need = kind === 'vel' ? (rng.chance(1 / 3) ? 3 : 2) : 0;
    var same = need ? function (tri) { return tri.filter(function (c) { return zeroSide(c.opt) === zeroSide(key); }).length >= need; } : null;
    var pick = balanced(rng, key, pool, [totalTo(dist(norm)), last, rise, curl(norm)], same);
    if (!pick) return null;
    var order = rng.shuffle([0, 1, 2, 3]), options = [], why = [], keyAt = -1;
    order.forEach(function (o, i) { if (o === 0) { options.push(key); why.push(null); keyAt = i; } else { options.push(pick[o - 1].opt); why.push(pick[o - 1].why); } });
    return { kind: kind, motion: m.type, x: x, options: options, why: why, key: keyAt, bus: bus };
  }

  function generate(rng, params) {
    var kind = kindOf(params), level = levelOf(params), it = null;
    for (var t = 0; t < 30 && !it; t++) it = generateOnce(rng, kind, level);
    if (!it) { it = generateOnce(PX.rng(PX.rng.hash('motiongraphs-fallback', kind, level)), kind, 0); if (it) it.fallback = true; }
    it.ex = 'motiongraphs'; it.v = 2; it.seed = rng.seed; it.params = { variant: kind, level: level };
    it.answer = 'choice'; it.nOptions = 4;
    return it;
  }
  function keyOf(item) {
    var x = item.x;
    if (item.kind === 'vel') return velAt(x);
    if (item.kind === 'frame') return x.map(function (v, k) { return v - item.bus * k; });
    return x.slice();
  }
  function validate(item) {
    if (!item || KINDS.indexOf(item.kind) < 0 || !Array.isArray(item.options) || item.options.length !== 4) return 'a kind and four options';
    if (!(item.key >= 0 && item.key < 4)) return 'a key';
    var key = keyOf(item), norm = item.kind === 'vel' ? normVel : normPos;
    if (item.options[item.key].some(function (v, i) { return mabs(v - key[i]) > 1e-9; })) return 'the key is the motion\'s own graph or picture';
    for (var i = 0; i < 4; i++) {
      if (item.options[i].length !== N) return 'seven points';
      if (i !== item.key && !differ(item.options[i], key, norm)) return 'every foil differs from the answer after any stretch';
      for (var j = i + 1; j < 4; j++) if (!differ(item.options[i], item.options[j], norm)) return 'the options differ from each other';
    }
    // an independent check of the motion: equal time steps, so the strobe dots fix every step
    var steps = velOf(item.x);
    if (steps.length !== N - 1) return 'six steps';
    if (item.kind === 'frame' && !(mabs(item.bus) > 0)) return 'a moving bus';
    if (item.kind === 'vel' && item.options.filter(function (o, i) { return i !== item.key && zeroSide(o) === zeroSide(key); }).length < 2) return 'two foils on the answer\'s side of the zero line';
    return true;
  }
  function score(item, response) { return { correct: response === item.key }; }
  function difficulty(params) { return BASE + OFFSET[kindOf(params)] + STEP * levelOf(params); }

  PX.ex.define({
    id: 'motiongraphs', version: 2, code: 'PR-7', name: 'Motion Graphs', short: 'Motion Graphs',
    // version 1 (velocity foils not balanced on the zero line; test builds of 1.2 only): its range
    past: { 1: { min: -1.2, max: 0.9 } },
    abilities: ['MA'], cell: 'extrinsic-dynamic', role: 'probe', answer: 'choice', nOptions: 4,
    format: FORMAT, // v1.2 (W2-measure): reserved formats, never in training material (tests/node/formats.test.mjs)
    variants: KINDS.slice(),
    cycle: 'variant',
    dims: [{ key: 'level', label: 'Level', levels: [0, 1, 2], step: STEP }],
    base: BASE, difficulty: difficulty,
    chance: function () { return 0.25; },
    timeLimit: function (params) { return kindOf(params) === 'frame' ? 45000 : 35000; },
    generate: generate, validate: validate, score: score,
    lib: { KINDS: KINDS, N: N, MARGIN: MARGIN, zeroSide: zeroSide, velAt: velAt, velOf: velOf, normPos: normPos, normVel: normVel, differ: differ, keyOf: keyOf, motion: motion },
  });
})(window.PX);
