/* EX-08 Orient: perspective taking on a map (pure; ARCHITECTURE.md §5, PLAN.md §3, research/B-tasks.md §5, §14c).

   A top-down map of 5, 7 or 9 distinct, non-directional objects (Friedman et al. 2020 replaced directional
   and animate objects because they bias answers). Question: "Imagine you are at A, facing B. Point to C."
   The answer is an angle in degrees clockwise from straight ahead (the direction of B), 0–360; it is right
   when the absolute angular error is at most the tolerance. chance = 2 × tolerance / 360.

   Dims: perspective shift = the angle between the imagined heading (A → B) and the map's up direction,
   in four bins (0–45, 45–90, 90–135, 135–180°); objects 5/7/9; tolerance 40/30/20°.

   Construction: the heading, the answer and two distances are drawn first and A, B, C placed to match;
   the other objects are scattered after. The answer is uniform over the allowed directions (never within
   20° of straight ahead or behind, so A, B and C are never nearly collinear). The egocentric error
   (pointing to C as drawn on the map, ignoring the imagined heading) is off by exactly the shift, so in
   the first bin, shifts within the tolerance are drawn only with probability chance (2 × tol / 360): the
   egocentric answer is then right about as often as a guess.

   Coordinates: map units, x right, y down, 100 × 100; bearings in degrees clockwise from map up.
   Item (JSON):
     { ex: 'orient', seed, params: { shift, objects, tolerance }, key, tolerance,
       map: { w, h, margin },
       objects: [{ id, name, x, y }],   id: a glyph id from GLYPHS (the view draws them); names are distinct
       at, facing, target,              indices into objects (A, B, C)
       heading,                         bearing of B from A (−180, 180]; shift = |heading|
       shift, targetBearing,            bearing of C from A on the map (the egocentric answer)
       text }                           the question in words
     PX.ex.get('orient').lib exposes the model for the view and tests.

   validate recomputes the heading, the shift and the key from the positions alone and checks: A, B, C
   distinct; the key not within 20° of ahead or behind; every pair of objects at least MIN_SEP apart and
   inside the map; A–B and A–C long enough; other objects clear of the A–B and A–C sight lines; distinct
   glyphs and names; the shift inside its bin. */
(function (PX) {
  'use strict';

  /* ------------------------------------------------------------ deterministic maths */
  // Only + − × ÷, Math.sqrt and Math.round/floor/abs, so a seed gives the same item in every engine.
  var PI = Math.PI, TAU = 2 * Math.PI, HALF_PI = Math.PI / 2, SQRT3 = Math.sqrt(3), DEG = Math.PI / 180;
  function sinPoly(y) {
    var y2 = y * y;
    return y * (1 - y2 / 6 * (1 - y2 / 20 * (1 - y2 / 42 * (1 - y2 / 72 * (1 - y2 / 110 *
      (1 - y2 / 156 * (1 - y2 / 210 * (1 - y2 / 272 * (1 - y2 / 342)))))))));
  }
  function cosPoly(y) {
    var y2 = y * y;
    return 1 - y2 / 2 * (1 - y2 / 12 * (1 - y2 / 30 * (1 - y2 / 56 * (1 - y2 / 90 *
      (1 - y2 / 132 * (1 - y2 / 182 * (1 - y2 / 240 * (1 - y2 / 306))))))));
  }
  function sincos(d) { // degrees → [sin, cos]; exact at multiples of 90°
    if (d % 90 === 0) {
      var k = ((d / 90) % 4 + 4) % 4;
      return k === 0 ? [0, 1] : k === 1 ? [1, 0] : k === 2 ? [0, -1] : [-1, 0];
    }
    var x = d * DEG, r = x - Math.round(x / TAU) * TAU, q = Math.round(r / HALF_PI);
    var y = r - q * HALF_PI, s = sinPoly(y), c = cosPoly(y);
    q = ((q % 4) + 4) % 4;
    return q === 0 ? [s, c] : q === 1 ? [c, -s] : q === 2 ? [-s, -c] : [-c, s];
  }
  function atanSmall(t) { var t2 = t * t, s = 0; for (var k = 29; k >= 1; k -= 2) s = 1 / k - t2 * s; return t * s; }
  function atan(t) {
    var neg = t < 0; if (neg) t = -t;
    var inv = t > 1; if (inv) t = 1 / t;
    var a = t > 0.2679491924311227 ? PI / 6 + atanSmall((t * SQRT3 - 1) / (t + SQRT3)) : atanSmall(t);
    if (inv) a = HALF_PI - a;
    return neg ? -a : a;
  }
  function atan2d(y, x) { // degrees in (−180, 180]
    var a;
    if (x > 0) a = atan(y / x);
    else if (x < 0) a = y >= 0 ? atan(y / x) + PI : atan(y / x) - PI;
    else a = y > 0 ? HALF_PI : y < 0 ? -HALF_PI : 0;
    return a / DEG;
  }
  function norm360(a) { a %= 360; return a < 0 ? a + 360 : a; }
  function norm180(a) { a = norm360(a); return a > 180 ? a - 360 : a; } // (−180, 180]
  function adiff(a, b) { return Math.abs(norm180(a - b)); }            // [0, 180]
  function rnd(x, f) { return Math.round(x * f) / f; }

  // Bearing of (dx, dy) clockwise from map up (screen y down), (−180, 180].
  function bearing(dx, dy) { return atan2d(dx, -dy); }
  function step(p, b, d) { var sc = sincos(b); return [p[0] + d * sc[0], p[1] - d * sc[1]]; }
  function dist(a, b) { var dx = a[0] - b[0], dy = a[1] - b[1]; return Math.sqrt(dx * dx + dy * dy); }
  function segDist(p, a, b) {
    var dx = b[0] - a[0], dy = b[1] - a[1], L2 = dx * dx + dy * dy, t = L2 ? ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / L2 : 0;
    t = t < 0 ? 0 : t > 1 ? 1 : t;
    var x = a[0] + t * dx - p[0], y = a[1] + t * dy - p[1];
    return Math.sqrt(x * x + y * y);
  }

  /* ------------------------------------------------------------ levels and constants */
  var SHIFTS = ['0–45°', '45–90°', '90–135°', '135–180°'];
  var OBJECTS = [5, 7, 9];
  var TOLERANCES = [40, 30, 20];
  var MAP = { w: 100, h: 100, margin: 8 };
  var MIN_SEP = 15;         // objects at least this far apart (glyphs and labels never touch)
  var MIN_ARM = 20;         // A–B and A–C at least this long
  var ARM = [22, 46];       // A–B and A–C drawn from this range
  var LINE_CLEAR = 6;       // other objects stay this far from the A–B and A–C sight lines
  var AXIS_GAP = 20;        // the key is never within 20° of straight ahead or behind
  // Non-directional objects (no fronts, faces or arrows); the view draws each id as a distinct glyph.
  var GLYPHS = [
    { id: 'tree', name: 'tree' }, { id: 'well', name: 'well' }, { id: 'rock', name: 'rock' },
    { id: 'lamp', name: 'lamp' }, { id: 'tower', name: 'tower' }, { id: 'barrel', name: 'barrel' },
    { id: 'fountain', name: 'fountain' }, { id: 'bush', name: 'bush' }, { id: 'silo', name: 'silo' },
    { id: 'stump', name: 'stump' }, { id: 'bell', name: 'bell' }, { id: 'cairn', name: 'cairn' },
  ];

  function clampInt(x, n) { x = Number.isInteger(x) ? x : 0; return x < 0 ? 0 : x >= n ? n - 1 : x; }
  function normParams(params) {
    var p = params || {};
    return { shift: clampInt(p.shift, SHIFTS.length), objects: clampInt(p.objects, OBJECTS.length), tolerance: clampInt(p.tolerance, TOLERANCES.length) };
  }
  function chance(params) { return 2 * TOLERANCES[normParams(params).tolerance] / 360; }
  function inMap(p) { return p[0] >= MAP.margin && p[0] <= MAP.w - MAP.margin && p[1] >= MAP.margin && p[1] <= MAP.h - MAP.margin; }

  // Shift (0–180) for a level: uniform in its bin, except in the first bin, where values within the
  // tolerance (the egocentric answer would be right) are drawn only with probability chance.
  function drawShift(r, p) {
    var lo = 45 * p.shift, hi = lo + 45, tol = TOLERANCES[p.tolerance];
    if (tol > lo && tol < hi) {
      var low = r.chance(2 * tol / 360);
      return low ? r.float(lo, tol) : r.float(tol + 0.5, hi);
    }
    return r.float(lo, hi);
  }
  // Key uniform over [20, 160] ∪ [200, 340].
  function drawKey(r) {
    var u = r.float(AXIS_GAP, 180 - AXIS_GAP);
    return r.chance(0.5) ? u : 360 - u;
  }

  function article(name) { return 'the ' + name; }
  function textOf(objs, a, b, c) {
    return 'Imagine you are at ' + article(objs[a].name) + ', facing ' + article(objs[b].name) + '. Point to ' + article(objs[c].name) + '.';
  }

  /* ------------------------------------------------------------ items */
  function build(r, p) {
    var n = OBJECTS[p.objects], tol = TOLERANCES[p.tolerance];
    var shift = drawShift(r, p), heading = r.chance(0.5) ? shift : -shift, key = drawKey(r);
    var dB = r.float(ARM[0], ARM[1]), dC = r.float(ARM[0], ARM[1]), A = null, B, C, i;
    for (i = 0; i < 200 && !A; i++) {
      var a = [r.float(MAP.margin, MAP.w - MAP.margin), r.float(MAP.margin, MAP.h - MAP.margin)];
      B = step(a, heading, dB); C = step(a, heading + key, dC);
      if (inMap(B) && inMap(C) && dist(B, C) >= MIN_SEP) A = a;
    }
    if (!A) return null;
    var pts = [A, B, C];
    for (i = 0; i < 400 && pts.length < n; i++) {
      var q = [r.float(MAP.margin, MAP.w - MAP.margin), r.float(MAP.margin, MAP.h - MAP.margin)], ok = true;
      for (var j = 0; j < pts.length && ok; j++) if (dist(q, pts[j]) < MIN_SEP + 1) ok = false;
      if (ok && (segDist(q, A, B) < LINE_CLEAR + 1 || segDist(q, A, C) < LINE_CLEAR + 1)) ok = false;
      if (ok) pts.push(q);
    }
    if (pts.length < n) return null;
    // Glyphs and the order of the objects are random; A, B, C are wherever they land.
    var glyphs = r.shuffle(GLYPHS).slice(0, n), order = r.shuffle(pts.map(function (_, k) { return k; }));
    var objects = order.map(function (k, slot) {
      return { id: glyphs[slot].id, name: glyphs[slot].name, x: rnd(pts[k][0], 10), y: rnd(pts[k][1], 10) };
    });
    var at = order.indexOf(0), facing = order.indexOf(1), target = order.indexOf(2);
    var geo = geometry(objects, at, facing, target);
    return {
      ex: 'orient', params: { shift: p.shift, objects: p.objects, tolerance: p.tolerance },
      key: geo.key, tolerance: tol, map: { w: MAP.w, h: MAP.h, margin: MAP.margin },
      objects: objects, at: at, facing: facing, target: target,
      heading: geo.heading, shift: geo.shift, targetBearing: geo.targetBearing,
      text: textOf(objects, at, facing, target),
    };
  }

  // Heading, shift, key and the egocentric answer from the positions (rounded as stored).
  function geometry(objects, at, facing, target) {
    var A = objects[at], B = objects[facing], C = objects[target];
    var heading = bearing(B.x - A.x, B.y - A.y), tb = bearing(C.x - A.x, C.y - A.y);
    var key = rnd(norm360(tb - heading), 100);
    if (key >= 360) key -= 360;
    return { heading: rnd(heading, 100), shift: rnd(Math.abs(heading), 100), targetBearing: rnd(norm360(tb), 100), key: key };
  }

  var stats = { fallbacks: 0 };
  function generate(rng, params) {
    var p = normParams(params), item = null;
    for (var i = 0; i < 50 && !item; i++) {
      var it = build(i === 0 ? rng : rng.fork('retry' + i), p);
      if (it && validate(it) === true) item = it;
    }
    if (!item) { item = fallback(rng, p); item.fallback = true; } // ARCHITECTURE §5: the engine voids fallback trials
    item.seed = rng.seed;
    return item;
  }

  // A fixed layout that is valid for every level: A at the centre-left, B and C placed for the bin's
  // middle shift and a key of 110° (or 250°), distractors on a fixed ring of slots.
  var SLOTS = [];
  [10, 30, 50, 70, 90].forEach(function (y) { [10, 30, 50, 70, 90].forEach(function (x) { SLOTS.push([x, y]); }); });
  function fallback(rng, p) {
    stats.fallbacks++;
    var r = rng.fork('fallback'), n = OBJECTS[p.objects], shift = 45 * p.shift + 22.5;
    var heading = r.chance(0.5) ? shift : -shift, key = r.chance(0.5) ? 110 : 250;
    var A = [50, 50], B = step(A, heading, 30), C = step(A, heading + key, 30), pts = [A, B, C];
    for (var i = 0; i < SLOTS.length && pts.length < n; i++) {
      var q = SLOTS[i], ok = true;
      for (var j = 0; j < pts.length && ok; j++) if (dist(q, pts[j]) < MIN_SEP + 1) ok = false;
      if (ok && (segDist(q, A, B) < LINE_CLEAR + 1 || segDist(q, A, C) < LINE_CLEAR + 1)) ok = false;
      if (ok) pts.push(q);
    }
    var glyphs = GLYPHS.slice(0, pts.length);
    var objects = pts.map(function (q, k) { return { id: glyphs[k].id, name: glyphs[k].name, x: rnd(q[0], 10), y: rnd(q[1], 10) }; });
    var geo = geometry(objects, 0, 1, 2);
    return {
      ex: 'orient', params: { shift: p.shift, objects: p.objects, tolerance: p.tolerance },
      key: geo.key, tolerance: TOLERANCES[p.tolerance], map: { w: MAP.w, h: MAP.h, margin: MAP.margin },
      objects: objects, at: 0, facing: 1, target: 2,
      heading: geo.heading, shift: geo.shift, targetBearing: geo.targetBearing, text: textOf(objects, 0, 1, 2),
    };
  }

  /* ------------------------------------------------------------ validation (from the positions) */
  function isNum(x) { return typeof x === 'number' && isFinite(x); }
  function validate(item) {
    try { return check(item); } catch (e) { return 'validate threw: ' + (e && e.message); }
  }
  function check(item) {
    if (!item || item.ex !== 'orient') return 'not an orient item';
    var p = item.params;
    if (!p || !Number.isInteger(p.shift) || p.shift < 0 || p.shift >= SHIFTS.length) return 'params.shift out of range';
    if (!Number.isInteger(p.objects) || p.objects < 0 || p.objects >= OBJECTS.length) return 'params.objects out of range';
    if (!Number.isInteger(p.tolerance) || p.tolerance < 0 || p.tolerance >= TOLERANCES.length) return 'params.tolerance out of range';
    if (item.tolerance !== TOLERANCES[p.tolerance]) return 'tolerance does not match the level';
    var objs = item.objects, n = OBJECTS[p.objects];
    if (!Array.isArray(objs) || objs.length !== n) return 'the map needs ' + n + ' objects';
    var ids = {}, names = {}, known = {};
    GLYPHS.forEach(function (g) { known[g.id] = true; });
    for (var i = 0; i < n; i++) {
      var o = objs[i];
      if (!o || !isNum(o.x) || !isNum(o.y)) return 'object ' + i + ' has no position';
      if (!inMap([o.x, o.y])) return 'object ' + i + ' is outside the map';
      if (!known[o.id]) return 'object ' + i + ' has an unknown glyph';
      if (typeof o.name !== 'string' || !o.name) return 'object ' + i + ' has no name';
      if (ids[o.id] || names[o.name]) return 'two objects share a glyph or a name';
      ids[o.id] = names[o.name] = true;
      for (var j = 0; j < i; j++) if (dist([o.x, o.y], [objs[j].x, objs[j].y]) < MIN_SEP - 0.2) return 'objects ' + j + ' and ' + i + ' are too close';
    }
    var a = item.at, b = item.facing, c = item.target;
    if (![a, b, c].every(function (k) { return Number.isInteger(k) && k >= 0 && k < n; })) return 'A, B or C is not an object';
    if (a === b || a === c || b === c) return 'A, B and C must be three different objects';
    var A = [objs[a].x, objs[a].y], B = [objs[b].x, objs[b].y], C = [objs[c].x, objs[c].y];
    if (dist(A, B) < MIN_ARM - 0.2 || dist(A, C) < MIN_ARM - 0.2) return 'B or C is too close to A';
    for (i = 0; i < n; i++) {
      if (i === a || i === b || i === c) continue;
      var q = [objs[i].x, objs[i].y];
      if (segDist(q, A, B) < LINE_CLEAR - 0.2 || segDist(q, A, C) < LINE_CLEAR - 0.2) return 'object ' + i + ' stands on a sight line';
    }
    var heading = bearing(B[0] - A[0], B[1] - A[1]), shift = Math.abs(heading);
    if (shift < 45 * p.shift - 0.01 || shift > 45 * (p.shift + 1) + 0.01) return 'the perspective shift ' + rnd(shift, 10) + '° is outside its bin';
    var key = norm360(bearing(C[0] - A[0], C[1] - A[1]) - heading);
    if (!isNum(item.key) || adiff(key, item.key) > 0.02) return 'the key does not match the map';
    if (adiff(key, 0) < AXIS_GAP || adiff(key, 180) < AXIS_GAP) return 'C is within 20° of straight ahead or behind (A, B, C nearly collinear)';
    if (adiff(item.heading, heading) > 0.02 || Math.abs(item.shift - shift) > 0.02) return 'heading or shift does not match the map';
    if (adiff(item.targetBearing, bearing(C[0] - A[0], C[1] - A[1])) > 0.02) return 'targetBearing does not match the map';
    return true;
  }

  /* ------------------------------------------------------------ scoring */
  // response: degrees clockwise from straight ahead (any real number; taken mod 360).
  function score(item, response) {
    if (!isNum(response)) return { correct: false, value: null, detail: { invalid: true } };
    var signed = norm180(response - item.key), error = Math.abs(signed);
    return { correct: error <= item.tolerance + 1e-9, value: rnd(error, 100), detail: { signed: rnd(signed, 100), frontBack: error > 90 } };
  }

  PX.ex.define({
    id: 'orient', version: 1, code: 'EX-08', name: 'Perspective taking', short: 'Orient',
    abilities: ['PT'], cell: 'extrinsic-dynamic', role: 'train', answer: 'angle',
    dims: [
      { key: 'shift', label: 'Perspective shift', levels: SHIFTS, step: 0.8 },
      { key: 'objects', label: 'Objects', levels: OBJECTS, step: 0.3 },
      { key: 'tolerance', label: 'Tolerance', levels: TOLERANCES, step: 0.8, unit: '°' },
    ],
    base: -2.25,
    chance: chance,
    generate: generate,
    validate: validate,
    score: score,
    lib: {
      SHIFTS: SHIFTS, OBJECTS: OBJECTS, TOLERANCES: TOLERANCES, MAP: MAP, MIN_SEP: MIN_SEP, MIN_ARM: MIN_ARM,
      LINE_CLEAR: LINE_CLEAR, AXIS_GAP: AXIS_GAP, GLYPHS: GLYPHS, stats: stats,
      sincos: sincos, atan2d: atan2d, bearing: bearing, norm180: norm180, norm360: norm360, adiff: adiff,
      geometry: geometry, build: build, fallback: fallback, normParams: normParams,
    },
  });
})(window.PX);
