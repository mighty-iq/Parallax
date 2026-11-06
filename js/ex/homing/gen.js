/* EX-11 Homing (experimental): face the start after a passive route (pure; ARCHITECTURE.md §5, PLAN.md §3,
   research/B-tasks.md §10, §14c). Visual triangle completion (Loomis et al. 1993) on flat ground: the view
   carries the player along 2–4 straight legs with turns, first person, then the player turns on the spot
   to face the start. It measures visual path integration (no body-based cues), so it is labelled
   experimental; viewing distance changes it, so ratings are kept per screen class (perDisplay).

   Answer: the turn (degrees clockwise from the final heading, 0–360) that faces the start; right when
   the absolute angular error is at most the tolerance; score value = the error. chance = 2 × tol / 360.
   The item also carries the distance back to the start (for a later distance question).

   Dims: route (ROUTES: legs × turn size merged into one dim, in order of difficulty; the turn sizes are
   small 30–60°, medium 60–120°, large 120–160°, each turn left or right at random; 2 legs with small
   turns is left out, see below); landmarks: several distant landmarks (3), one, none; tolerance
   40/30/20°. difficulty() keeps the per-dimension model of each combination (base at 2 legs with small
   turns, + 0.55 per extra leg, + 0.4 per turn size, + 0.4 per landmark level, + 0.9 per tolerance level).
   estMs(params): expected time from the first frame to the answer (look at the start, the route, the
   turn to face it), for session timing.

   Answer and shortcut control (see build). Each item draws a target answer uniformly over the allowed
   directions; candidate routes steer their last leg onto it when a leg of allowed length can (a 2 × 2
   solve), so answers spread evenly wherever the geometry lets them. Two answers that ignore the path's
   shape must miss by more than the tolerance (+ 2°): "turn around" (180°; it may be right only when the
   target itself lies within the tolerance of 180°) and "the sum of the turns reversed" (180° − Σ turns,
   as if the whole walk had been along the first leg). Lower priority: turning alone, with the legs taken
   as equal, misses too. Geometry limits all this. With 2 legs the start always lies between the two
   shortcut answers, which are the single turn t apart, so one of them is within the tolerance whenever
   t ≤ 2 × tol + 4. That is why the route dim has no "2 legs, small turns" level (it could never be clean
   at tolerance 30–40°); DEGENERATE lists any remaining such cell (none). With 2 legs and medium turns at
   40° only turns above 84° can be clean, and the generator uses those. After a nearly straight walk the
   start is behind, so with small turns answers bunch 120–160° to either side and the legs hardly matter.
   That is accepted at these easy levels: which side the start lies on still has to be worked out from
   the turns. The tests report all of these.

   World: metres, x east, y north, start at (0, 0); headings and bearings in degrees clockwise from north.
   Item (JSON):
     { ex: 'homing', seed, params: { route, landmarks, tolerance }, key, tolerance, experimental: true,
       startHeading, legs: [m], turns: [deg, + = clockwise], path: [[x, y]] (start, then the end of each leg),
       heading (final), distance (end → start, m), returnBearing (bearing of the start from the end),
       speed (m/s), turnRate (deg/s), duration (s, legs and turns),
       landmarks: [{ id, name, bearing, dist, x, y }]   (distant: on a 400 m circle round the start) }
     PX.ex.get('homing').lib exposes the model for the view and tests.

   validate recomputes the path, the final heading and the key from startHeading, legs and turns and checks
   them against the stored path; then: the key not within 20° of straight ahead or behind; the path stays
   at least NEAR_START from the start until the end, and the end is at least END_MIN away; legs at least
   LEG[0] long (long enough to see); turns inside their band; landmarks as the level says. */
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
  function compass(east, north) { return norm360(atan2d(east, north)); } // bearing of a vector, [0, 360)
  function segDist(p, a, b) {
    var dx = b[0] - a[0], dy = b[1] - a[1], L2 = dx * dx + dy * dy, t = L2 ? ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / L2 : 0;
    t = t < 0 ? 0 : t > 1 ? 1 : t;
    var x = a[0] + t * dx - p[0], y = a[1] + t * dy - p[1];
    return Math.sqrt(x * x + y * y);
  }

  /* ------------------------------------------------------------ levels and constants */
  var LEGS = [2, 3, 4];
  var TURNS = [{ name: 'small', lo: 30, hi: 60 }, { name: 'medium', lo: 60, hi: 120 }, { name: 'large', lo: 120, hi: 160 }];
  var LANDMARKS = [{ name: 'several', n: 3 }, { name: 'one', n: 1 }, { name: 'none', n: 0 }];
  var TOLERANCES = [40, 30, 20];
  var LEG = [6, 18];         // leg lengths, m (≥ 2 s each at SPEED: long enough to see)
  var SPEED = 3;             // m/s along the legs
  var TURN_RATE = 60;        // deg/s when turning on the spot
  var NEAR_START = 3;        // until the end, the path keeps at least this far from the start (m)
  var END_MIN = 5;           // the end is at least this far from the start (m)
  var AXIS_GAP = 20;         // the key is never within 20° of straight ahead or behind
  var MARGIN = 2;            // a shortcut answer counts as defeated when it misses by more than tol + 2°
  var EQUAL_TRIES = 80;      // candidates looked at, after a good route, for one where equal legs also miss
  var TARGET_WIN = 8;       // the key should land within this of the item's target answer
  var TRIES = 600;           // candidate routes per attempt
  var LANDMARK_DIST = 400, LANDMARK_SEP = 60;
  var LANDMARK_KINDS = [
    { id: 'peak', name: 'mountain' }, { id: 'mast', name: 'radio mast' }, { id: 'mill', name: 'windmill' },
    { id: 'spire', name: 'spire' }, { id: 'dome', name: 'dome' },
  ];
  // Route levels in order of difficulty: legs and a turn size (index into TURNS). 2 legs with small turns
  // is left out (see the header).
  var ROUTES = [
    { legs: 2, turns: 1 }, { legs: 3, turns: 0 }, { legs: 2, turns: 2 }, { legs: 3, turns: 1 },
    { legs: 4, turns: 0 }, { legs: 3, turns: 2 }, { legs: 4, turns: 1 }, { legs: 4, turns: 2 },
  ];
  // The per-dimension model (logits): base at 2 legs with small turns, then these steps.
  var MODEL = { base: -2.25, leg: 0.55, turn: 0.4, landmarks: 0.4, tolerance: 0.9 };
  function routeCost(rt) { return MODEL.leg * (rt.legs - 2) + MODEL.turn * rt.turns; }
  function difficulty(params) {
    var p = normParams(params);
    return MODEL.base + routeCost(ROUTES[p.route]) + MODEL.landmarks * p.landmarks + MODEL.tolerance * p.tolerance;
  }
  // Cells where no valid route defeats both shortcuts (2 legs, the band's largest turn ≤ 2 × tol + 4).
  var DEGENERATE = [];
  ROUTES.forEach(function (rt, ri) {
    TOLERANCES.forEach(function (tol, oi) {
      if (rt.legs === 2 && TURNS[rt.turns].hi <= 2 * tol + 2 * MARGIN) DEGENERATE.push({ route: ri, tolerance: oi });
    });
  });
  function degenerate(p) {
    return DEGENERATE.some(function (d) { return d.route === p.route && d.tolerance === p.tolerance; });
  }

  function clampInt(x, n) { x = Number.isInteger(x) ? x : 0; return x < 0 ? 0 : x >= n ? n - 1 : x; }
  function normParams(params) {
    var p = params || {};
    return {
      route: clampInt(p.route, ROUTES.length),
      landmarks: clampInt(p.landmarks, LANDMARKS.length), tolerance: clampInt(p.tolerance, TOLERANCES.length),
    };
  }
  function chance(params) { return 2 * TOLERANCES[normParams(params).tolerance] / 360; }

  /* ------------------------------------------------------------ routes */
  // Path, final heading, key and distance from the start heading, the legs and the turns.
  function route(h0, legs, turns) {
    var x = 0, y = 0, h = h0, path = [[0, 0]];
    for (var i = 0; i < legs.length; i++) {
      if (i > 0) h += turns[i - 1];
      var sc = sincos(h);
      x += legs[i] * sc[0]; y += legs[i] * sc[1];
      path.push([x, y]);
    }
    var back = compass(-x, -y);
    return { path: path, heading: norm360(h), returnBearing: back, key: norm360(back - h), distance: Math.sqrt(x * x + y * y) };
  }
  function sumTurns(turns) { var s = 0; for (var i = 0; i < turns.length; i++) s += turns[i]; return s; }
  // The two shortcut answers.
  function shortcuts(turns) { return { around: 180, reversed: norm360(180 - sumTurns(turns)) }; }
  function routeOk(g) {
    if (adiff(g.key, 0) < AXIS_GAP || adiff(g.key, 180) < AXIS_GAP) return false;
    if (g.distance < END_MIN) return false;
    for (var i = 1; i < g.path.length - 1; i++) if (segDist([0, 0], g.path[i], g.path[i + 1]) < NEAR_START) return false;
    return true;
  }

  // Target answer, uniform over the allowed directions [20, 160] ∪ [200, 340].
  function drawTarget(r) { var u = r.float(AXIS_GAP, 180 - AXIS_GAP); return r.chance(0.5) ? u : 360 - u; }

  // Length of the last leg that makes the key equal `key`, given P (the end of the leg before it) and the
  // final heading H: solve L·u(H) + m·u(H + key) = −P with u(b) = (sin b, cos b) and m > 0 (the start lies
  // ahead along the answer direction). null when no such leg exists.
  function steer(P, H, key) {
    var a = sincos(H), b = sincos(H + key), det = a[0] * b[1] - b[0] * a[1];
    if (Math.abs(det) < 1e-9) return null;
    var L = (-P[0] * b[1] + b[0] * P[1]) / det, m = (P[0] * a[1] - a[0] * P[1]) / det;
    return m > 0 ? L : null;
  }

  // Each candidate draws the first legs and all turns, then the last leg: steered onto the item's target
  // answer when that gives a leg of allowed length, else random. Candidates are scored; the first that
  // meets every aim is taken, else the best one seen.
  //   8  shortcuts: "reversed" misses, and "turn around" misses unless the target itself lies within the
  //      tolerance of 180° (so "turn around" is right only about as often as that band is wide);
  //      in a DEGENERATE cell, only the shortcut drawn as `prefer` has to miss
  //   4  the key lies within TARGET_WIN of the target (answers spread evenly; no habitual turn pays)
  //   2  turning alone, with the legs taken as equal, misses (leg lengths matter where geometry allows)
  function build(r, p) {
    var rt = ROUTES[p.route], n = rt.legs, band = TURNS[rt.turns], tol = TOLERANCES[p.tolerance], degen = degenerate(p);
    var h0 = rnd(r.float(0, 360), 100), target = drawTarget(r), prefer = r.chance(0.5) ? 'around' : 'reversed';
    var aroundFree = adiff(target, 180) <= tol + MARGIN;
    var best = null, bestScore = -1, goodAt = -1;
    for (var i = 0; i < TRIES; i++) {
      var legs = [], turns = [], j;
      for (j = 0; j < n - 1; j++) legs.push(rnd(r.float(LEG[0], LEG[1]), 10));
      for (j = 1; j < n; j++) turns.push(rnd((r.chance(0.5) ? 1 : -1) * r.float(band.lo, band.hi), 10));
      var head = route(h0, legs, turns.slice(0, n - 2)), H = h0 + sumTurns(turns);
      var Ls = steer(head.path[n - 1], H, target), last = rnd(r.float(LEG[0], LEG[1]), 10);
      if (Ls !== null && Ls >= LEG[0] + 0.05 && Ls <= LEG[1] - 0.05) last = rnd(Ls, 10);
      legs.push(last);
      var g = route(h0, legs, turns);
      if (!routeOk(g)) continue;
      var sh = shortcuts(turns), missA = adiff(g.key, sh.around) > tol + MARGIN, missR = adiff(g.key, sh.reversed) > tol + MARGIN;
      var need = degen ? (prefer === 'around' ? missA : missR) : missR && (missA || aroundFree);
      var sc = (need ? 8 : 0) + (adiff(g.key, target) <= TARGET_WIN ? 4 : 0);
      if (sc >= 12) {
        var eq = route(h0, legs.map(function () { return 1; }), turns);
        if (adiff(g.key, eq.key) > tol + MARGIN) sc += 2;
        if (goodAt < 0) goodAt = i;
      }
      if (sc > bestScore) { bestScore = sc; best = { legs: legs, turns: turns }; }
      if (sc >= 14 || (goodAt >= 0 && i - goodAt >= EQUAL_TRIES)) break;
    }
    if (!best) return null;
    stats.builds++; if (bestScore >= 12) stats.onTarget++; if (bestScore >= 14) stats.full++;
    return assemble(r, p, h0, best.legs, best.turns);
  }

  function assemble(r, p, h0, legs, turns) {
    var g = route(h0, legs, turns), lm = [], kinds = r.shuffle(LANDMARK_KINDS), want = LANDMARKS[p.landmarks].n;
    for (var i = 0; i < 200 && lm.length < want; i++) {
      var b = rnd(r.float(0, 360), 10), ok = true;
      for (var j = 0; j < lm.length; j++) if (adiff(b, lm[j].bearing) < LANDMARK_SEP) ok = false;
      if (ok) {
        var sc = sincos(b);
        lm.push({ id: kinds[lm.length].id, name: kinds[lm.length].name, bearing: b, dist: LANDMARK_DIST, x: rnd(LANDMARK_DIST * sc[0], 100), y: rnd(LANDMARK_DIST * sc[1], 100) });
      }
    }
    var dur = 0;
    legs.forEach(function (L) { dur += L / SPEED; });
    turns.forEach(function (t) { dur += Math.abs(t) / TURN_RATE; });
    return {
      ex: 'homing', params: { route: p.route, landmarks: p.landmarks, tolerance: p.tolerance },
      key: rnd(g.key, 100) % 360, tolerance: TOLERANCES[p.tolerance], experimental: true,
      startHeading: h0, legs: legs, turns: turns,
      path: g.path.map(function (q) { return [rnd(q[0], 1000), rnd(q[1], 1000)]; }),
      heading: rnd(g.heading, 100) % 360, distance: rnd(g.distance, 1000), returnBearing: rnd(g.returnBearing, 100) % 360,
      speed: SPEED, turnRate: TURN_RATE, duration: rnd(dur, 100), landmarks: lm,
    };
  }

  var stats = { fallbacks: 0, builds: 0, onTarget: 0, full: 0 };
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

  // Deterministic routes tried in order (leg patterns × turn sizes × turn sides); the tests check that one
  // is valid at every combination of levels.
  var FB_LEGS = [[14, 10, 14, 10], [10, 15, 10, 15], [16, 8, 12, 8], [8, 16, 8, 16]];
  function fallback(rng, p) {
    stats.fallbacks++;
    var r = rng.fork('fallback'), n = ROUTES[p.route].legs, band = TURNS[ROUTES[p.route].turns], h0 = rnd(r.float(0, 360), 100);
    var sizes = [(band.lo + band.hi) / 2, band.lo + 5, band.hi - 5], last = null;
    for (var a = 0; a < FB_LEGS.length; a++) for (var b = 0; b < sizes.length; b++) for (var c = 0; c < 4; c++) {
      var legs = FB_LEGS[a].slice(0, n), turns = [];
      for (var j = 1; j < n; j++) turns.push((c & 1 ? -1 : 1) * (c & 2 && j % 2 === 0 ? -1 : 1) * sizes[b]);
      var it = assemble(r, p, h0, legs, turns);
      last = it;
      if (validate(Object.assign({ seed: 0 }, it)) === true) return it;
    }
    return last;
  }

  /* ------------------------------------------------------------ validation */
  function isNum(x) { return typeof x === 'number' && isFinite(x); }
  function validate(item) {
    try { return check(item); } catch (e) { return 'validate threw: ' + (e && e.message); }
  }
  function check(item) {
    if (!item || item.ex !== 'homing') return 'not a homing item';
    var p = item.params;
    if (!p) return 'params missing';
    var dims = [['route', ROUTES], ['landmarks', LANDMARKS], ['tolerance', TOLERANCES]];
    for (var d = 0; d < dims.length; d++) {
      var v = p[dims[d][0]];
      if (!Number.isInteger(v) || v < 0 || v >= dims[d][1].length) return 'params.' + dims[d][0] + ' out of range';
    }
    if (item.tolerance !== TOLERANCES[p.tolerance]) return 'tolerance does not match the level';
    var n = ROUTES[p.route].legs, band = TURNS[ROUTES[p.route].turns];
    if (!Array.isArray(item.legs) || item.legs.length !== n) return 'the route needs ' + n + ' legs';
    if (!Array.isArray(item.turns) || item.turns.length !== n - 1) return 'the route needs ' + (n - 1) + ' turns';
    for (var i = 0; i < n; i++) if (!isNum(item.legs[i]) || item.legs[i] < LEG[0] - 1e-9 || item.legs[i] > LEG[1] + 1e-9) return 'leg ' + i + ' is too short to see or too long';
    for (i = 0; i < n - 1; i++) {
      var t = item.turns[i];
      if (!isNum(t) || Math.abs(t) < band.lo - 1e-9 || Math.abs(t) > band.hi + 1e-9) return 'turn ' + i + ' is outside the ' + band.name + ' band';
    }
    if (!isNum(item.startHeading)) return 'startHeading missing';
    var g = route(item.startHeading, item.legs, item.turns);
    if (!Array.isArray(item.path) || item.path.length !== n + 1) return 'path has the wrong length';
    for (i = 0; i <= n; i++) {
      var q = item.path[i];
      if (!Array.isArray(q) || Math.abs(q[0] - g.path[i][0]) > 0.002 || Math.abs(q[1] - g.path[i][1]) > 0.002) return 'path point ' + i + ' does not follow from the legs and turns';
    }
    // The key from the stored path: bearing of the start from the end, minus the final heading.
    var E = item.path[n], back = compass(-E[0], -E[1]), key = norm360(back - (item.startHeading + sumTurns(item.turns)));
    if (!isNum(item.key) || adiff(key, item.key) > 0.02) return 'the key does not match the route';
    if (adiff(key, 0) < AXIS_GAP || adiff(key, 180) < AXIS_GAP) return 'the start is within 20° of straight ahead or behind';
    var dist = Math.sqrt(E[0] * E[0] + E[1] * E[1]);
    if (dist < END_MIN) return 'the route ends too close to the start';
    if (Math.abs(dist - item.distance) > 0.002) return 'distance does not match the route';
    for (i = 1; i < n; i++) if (segDist([0, 0], item.path[i], item.path[i + 1]) < NEAR_START - 1e-6) return 'leg ' + i + ' passes within ' + NEAR_START + ' m of the start';
    if (adiff(item.heading, item.startHeading + sumTurns(item.turns)) > 0.02 || adiff(item.returnBearing, back) > 0.02) return 'heading or returnBearing does not match the route';
    if (!(item.speed > 0) || !(item.turnRate > 0)) return 'speed and turnRate must be positive';
    var lm = item.landmarks, want = LANDMARKS[p.landmarks].n, ids = {}, known = {};
    LANDMARK_KINDS.forEach(function (k) { known[k.id] = true; });
    if (!Array.isArray(lm) || lm.length !== want) return 'the level needs ' + want + ' landmark(s)';
    for (i = 0; i < lm.length; i++) {
      var L = lm[i];
      if (!L || !known[L.id] || ids[L.id] || !isNum(L.bearing) || !(L.dist >= 200)) return 'landmark ' + i + ' is malformed or repeated';
      ids[L.id] = true;
      for (var j = 0; j < i; j++) if (adiff(L.bearing, lm[j].bearing) < LANDMARK_SEP - 0.05) return 'landmarks ' + j + ' and ' + i + ' are too close together';
      if (adiff(compass(L.x, L.y), L.bearing) > 0.05) return 'landmark ' + i + ' position does not match its bearing';
    }
    return true;
  }

  /* ------------------------------------------------------------ scoring */
  // response: the turn in degrees clockwise from the final heading (any real number; taken mod 360).
  function score(item, response) {
    if (!isNum(response)) return { correct: false, value: null, detail: { invalid: true } };
    var signed = norm180(response - item.key), error = Math.abs(signed);
    return { correct: error <= item.tolerance + 1e-9, value: rnd(error, 100), detail: { signed: rnd(signed, 100) } };
  }

  /* ------------------------------------------------------------ timing */
  var LEAD_MS = 1000;       // a look at the start before the walk begins (the view keeps to it)
  var RESPONSE_MS = 5000;   // typical time to turn on the spot to face the start and confirm
  // Expected time from the first frame to the answer at these params: the lead-in, the route at SPEED and
  // TURN_RATE with the mean leg length and the band's mean turn, and the response. The engine adds its
  // own measured extra (feedback, transitions).
  function estMs(params) {
    var rt = ROUTES[normParams(params).route], band = TURNS[rt.turns];
    var walk = rt.legs * (LEG[0] + LEG[1]) / 2 / SPEED, turn = (rt.legs - 1) * (band.lo + band.hi) / 2 / TURN_RATE;
    return Math.round(LEAD_MS + 1000 * (walk + turn) + RESPONSE_MS);
  }

  function routeName(rt) { return rt.legs + ' legs, ' + TURNS[rt.turns].name + ' turns (' + TURNS[rt.turns].lo + '–' + TURNS[rt.turns].hi + '°)'; }

  PX.ex.define({
    id: 'homing', version: 1, code: 'EX-11', name: 'Homing (experimental)', short: 'Homing', experimental: true,
    abilities: ['NAV'], cell: 'extrinsic-dynamic', role: 'train', answer: 'angle', perDisplay: true,
    // Steps document the main effects; difficulty() gives each route its legs × turns cost (see MODEL).
    dims: [
      { key: 'route', label: 'Route', levels: ROUTES.map(routeName), step: (routeCost(ROUTES[ROUTES.length - 1]) - routeCost(ROUTES[0])) / (ROUTES.length - 1) },
      { key: 'landmarks', label: 'Landmarks', levels: LANDMARKS.map(function (l) { return l.name; }), step: MODEL.landmarks },
      { key: 'tolerance', label: 'Tolerance', levels: TOLERANCES, step: MODEL.tolerance, unit: '°' },
    ],
    base: difficulty({ route: 0, landmarks: 0, tolerance: 0 }),
    difficulty: difficulty,
    chance: chance,
    estMs: estMs,
    generate: generate,
    validate: validate,
    score: score,
    lib: {
      ROUTES: ROUTES, MODEL: MODEL, LEGS: LEGS, TURNS: TURNS, LANDMARKS: LANDMARKS, TOLERANCES: TOLERANCES, LEG: LEG,
      SPEED: SPEED, TURN_RATE: TURN_RATE, LEAD_MS: LEAD_MS, RESPONSE_MS: RESPONSE_MS,
      NEAR_START: NEAR_START, END_MIN: END_MIN, AXIS_GAP: AXIS_GAP, MARGIN: MARGIN, LANDMARK_KINDS: LANDMARK_KINDS,
      DEGENERATE: DEGENERATE, degenerate: degenerate, routeCost: routeCost, stats: stats,
      sincos: sincos, atan2d: atan2d, compass: compass, norm180: norm180, norm360: norm360, adiff: adiff,
      route: route, steer: steer, drawTarget: drawTarget, shortcuts: shortcuts, routeOk: routeOk, build: build, assemble: assemble, fallback: fallback, normParams: normParams,
    },
  });
})(window.PX);
