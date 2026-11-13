/* EX-11 Homing (experimental): face the start after a passive route (pure; ARCHITECTURE.md §5, PLAN.md §3,
   research/B-tasks.md §10, §14c; v1.1: docs/research/v1.1/R1-path-integration.md §1, §7, §8.1(d)). Visual
   triangle completion (Loomis et al. 1993) on flat ground: the view carries the player along 2–4 straight
   legs with turns, first person, then the player turns on the spot to face the start. Far landmarks on
   some levels act as heading fixes: Homing is the landmark-aided stage before Reckon (EX-12), which has
   none. Viewing distance changes the task, so ratings are kept per screen class (perDisplay).

   Version 2 (v1.1): slower, smoother motion for phones and comfort (R1 §7.2): 1.8 m/s (was 3) and 45°/s
   (was 60), 0.4 s raised-cosine ramps on every start and stop, legs of 4–12 m (were 6–18) and a route of
   12–28 m in all, so the longest route takes about 29 s. Seeds give other items than in version 1.

   Answer: the turn (degrees clockwise from the final heading, 0–360) that faces the start; right when
   the absolute angular error is at most the tolerance; score value = the error. chance = 2 × tol / 360.

   Dims: route (ROUTES: legs × turn size merged into one dim, in order of difficulty; the turn sizes are
   small 30–60°, medium 60–120°, large 120–160°, each turn left or right at random; 2 legs with small
   turns is left out, see below); landmarks: several distant landmarks (3), one, none; tolerance
   40/30/20°. difficulty() keeps the per-dimension model of each combination (base at 2 legs with small
   turns, + 0.55 per extra leg, + 0.4 per turn size, + 0.4 per landmark level, + 0.9 per tolerance level).
   estMs(params): expected time from the first frame to the answer, for session timing.

   Answer and shortcut control (see build). Each item draws a target answer uniformly over the allowed
   directions; candidate routes steer their last leg onto it when a leg of allowed length can (a 2 × 2
   solve), so answers spread evenly wherever the geometry lets them. Two answers that ignore the path's
   shape must miss by more than the tolerance (+ 2°): "turn around" (180°; it may be right only when the
   target itself lies within the tolerance of 180°) and "the sum of the turns reversed" (180° − Σ turns,
   as if the whole walk had been along the first leg). Lower priority: turning alone, with the legs taken
   as equal, misses too. With 2 legs the start always lies between the two shortcut answers, which are
   the single turn t apart, so one of them is within the tolerance whenever t ≤ 2 × tol + 4: that is why
   the route dim has no "2 legs, small turns" level; DEGENERATE lists any remaining such cell (none).

   Shared model (lib, also used by Reckon, EX-12, and both views): deterministic trigonometry, route(),
   steer(), drawTarget(), search() (the candidate loop), routeOk(), and the motion model: every leg and
   turn is a list of pieces { dur, v0, v1 } whose rate moves from v0 to v1 along a raised cosine, so the
   distance of a piece is dur × (v0 + v1) / 2 exactly; plan(item) lays out the stand, legs and turns,
   poseAt(plan, t) gives the pose t seconds in.

   World: metres, x east, y north, start at (0, 0); headings and bearings in degrees clockwise from north.
   Item (JSON):
     { ex: 'homing', seed, params: { route, landmarks, tolerance }, key, tolerance, experimental: true,
       startHeading, legs: [m], turns: [deg, + = clockwise], path: [[x, y]] (start, then the end of each leg),
       heading (final), distance (end → start, m), returnBearing, pathLength (m),
       speed (m/s), turnRate (deg/s), ramp (s), duration (s: legs and turns with their ramps),
       landmarks: [{ id, name, bearing, dist, x, y }]   (distant: on a 400 m circle round the start) }

   validate recomputes the path, the final heading and the key from startHeading, legs and turns and checks
   them against the stored path; then: the key not within 20° of straight ahead or behind; the path stays
   at least NEAR_START from the start until the end, and the end is at least END_MIN away; legs and the
   whole route within their lengths; turns inside their band; speeds within the comfort limits; the
   duration as the motion model gives it; landmarks as the level says. */
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
  function asind(s) { return s >= 1 ? 90 : s <= -1 ? -90 : atan2d(s, Math.sqrt(1 - s * s)); } // degrees
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
  function sum(a) { var s = 0; for (var i = 0; i < a.length; i++) s += a[i]; return s; }
  function isNum(x) { return typeof x === 'number' && isFinite(x); }

  /* ------------------------------------------------------------ levels and constants */
  var LEGS = [2, 3, 4];
  var TURNS = [{ name: 'small', lo: 30, hi: 60 }, { name: 'medium', lo: 60, hi: 120 }, { name: 'large', lo: 120, hi: 160 }];
  var LANDMARKS = [{ name: 'several', n: 3 }, { name: 'one', n: 1 }, { name: 'none', n: 0 }];
  var TOLERANCES = [40, 30, 20];
  var LEG = [4, 12];         // leg lengths, m (≥ 2.6 s each at SPEED: long enough to see)
  var PATH = [12, 28];       // the whole route, m: 4 legs with large turns stay under 30 s (R1 §7.2, §8.3)
  var SPEED = 1.8;           // m/s along the legs (brisk walking; comfort limit V_MAX)
  var TURN_RATE = 45;        // deg/s when turning on the spot (comfort limit W_MAX)
  var RAMP = 0.4;            // s: raised-cosine start and stop of every leg and turn (no instant starts)
  var V_MAX = 2, W_MAX = 45; // comfort limits for every passive motion (R1 §7.2: ≤ 2 m/s, ≤ 45°/s)
  var NEAR_START = 3;        // until the end, the path keeps at least this far from the start (m)
  var END_MIN = 5;           // the end is at least this far from the start (m)
  var AXIS_GAP = 20;         // the key is never within 20° of straight ahead or behind
  var MARGIN = 2;            // a shortcut answer counts as defeated when it misses by more than tol + 2°
  var EQUAL_TRIES = 80;      // candidates looked at, after a good route, for one where equal legs also miss
  var TARGET_WIN = 8;        // the key should land within this of the item's target answer
  var TRIES = 2000;          // candidate routes per attempt
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

  /* ------------------------------------------------------------ routes (shared with Reckon) */
  // Path, final heading, key and distance from the start heading, the legs and the turns.
  function route(h0, legs, turns) {
    var x = 0, y = 0, h = h0, path = [[0, 0]];
    for (var i = 0; i < legs.length; i++) {
      if (i > 0) h += turns[i - 1];
      var sc = sincos(h);
      x += legs[i] * sc[0]; y += legs[i] * sc[1];
      path.push([x, y]);
    }
    for (var j = Math.max(0, legs.length - 1); j < turns.length; j++) h += turns[j]; // turns after the last leg
    var back = compass(-x, -y);
    return { path: path, heading: norm360(h), returnBearing: back, key: norm360(back - h), distance: Math.sqrt(x * x + y * y) };
  }
  function sumTurns(turns) { return sum(turns); }
  // The two shortcut answers.
  function shortcuts(turns) { return { around: 180, reversed: norm360(180 - sumTurns(turns)) }; }
  // opts: { gap (default AXIS_GAP), dMax (default none) }
  function routeOk(g, opts) {
    var gap = opts && isNum(opts.gap) ? opts.gap : AXIS_GAP, dMax = opts && isNum(opts.dMax) ? opts.dMax : Infinity;
    if (adiff(g.key, 0) < gap || adiff(g.key, 180) < gap) return false;
    if (g.distance < END_MIN || g.distance > dMax) return false;
    for (var i = 1; i < g.path.length - 1; i++) if (segDist([0, 0], g.path[i], g.path[i + 1]) < NEAR_START) return false;
    return true;
  }

  // Target answer, uniform over the allowed directions [gap, 180 − gap] ∪ [180 + gap, 360 − gap].
  function drawTarget(r, gap) { var g = isNum(gap) ? gap : AXIS_GAP, u = r.float(g, 180 - g); return r.chance(0.5) ? u : 360 - u; }

  // Length of the last leg that makes the key equal `key`, given P (the end of the leg before it) and the
  // final heading H: solve L·u(H) + m·u(H + key) = −P with u(b) = (sin b, cos b) and m > 0 (the start lies
  // ahead along the answer direction). null when no such leg exists.
  function steer(P, H, key) {
    var a = sincos(H), b = sincos(H + key), det = a[0] * b[1] - b[0] * a[1];
    if (Math.abs(det) < 1e-9) return null;
    var L = (-P[0] * b[1] + b[0] * P[1]) / det, m = (P[0] * a[1] - a[0] * P[1]) / det;
    return m > 0 ? L : null;
  }

  // The candidate loop shared by Homing and Reckon. Each candidate draws the first legs (short enough that
  // the whole route can stay within PATH) and all turns, then the last leg: steered onto spec.target when
  // that gives a leg of allowed length, else random. Candidates that fail routeOk(spec) are dropped; the
  // rest are scored by spec.score(g, legs, turns); the first scoring spec.full is taken, or, once one
  // scored spec.good, the best within spec.patience more candidates; else the best one seen.
  // spec: { n, band, h0, target, gap, dMax, score, good, full, patience, tries }
  function search(r, spec) {
    var n = spec.n, band = spec.band, h0 = spec.h0, best = null, bestScore = -1, goodAt = -1;
    var hiFirst = Math.min(LEG[1], (PATH[1] - LEG[0]) / Math.max(1, n - 1)), tries = spec.tries || TRIES;
    for (var i = 0; i < tries; i++) {
      var legs = [], turns = [], j;
      for (j = 0; j < n - 1; j++) legs.push(rnd(r.float(LEG[0], hiFirst), 10));
      for (j = 1; j < n; j++) turns.push(rnd((r.chance(0.5) ? 1 : -1) * r.float(band.lo, band.hi), 10));
      var sofar = sum(legs), lo = Math.max(LEG[0], PATH[0] - sofar), hi = Math.min(LEG[1], PATH[1] - sofar);
      if (hi < lo) continue;
      var head = route(h0, legs, turns.slice(0, n - 2)), H = h0 + sumTurns(turns);
      var Ls = steer(head.path[n - 1], H, spec.target), last = rnd(r.float(lo, hi), 10);
      if (Ls !== null && Ls >= lo + 0.05 && Ls <= hi - 0.05) last = rnd(Ls, 10);
      legs.push(last);
      var g = route(h0, legs, turns);
      if (!routeOk(g, spec)) continue;
      var sc = spec.score(g, legs, turns);
      if (sc >= spec.good && goodAt < 0) goodAt = i;
      if (sc > bestScore) { bestScore = sc; best = { legs: legs, turns: turns, g: g, score: sc }; }
      if (sc >= spec.full || (goodAt >= 0 && i - goodAt >= (spec.patience || 0))) break;
    }
    return best;
  }

  /* ------------------------------------------------------------ motion (shared with Reckon and the views) */
  // A piece { dur, v0, v1 }: the rate moves from v0 to v1 along a raised cosine (constant when equal).
  function piece(dur, v0, v1) { return { dur: dur, v0: v0, v1: v1 }; }
  function pieceDist(p) { return p.dur * (p.v0 + p.v1) / 2; }
  // Distance covered t seconds into a piece (for the views; Math.sin is fine here).
  function pieceAt(p, t) {
    if (!(p.dur > 0)) return 0;
    t = t < 0 ? 0 : t > p.dur ? p.dur : t;
    return p.v0 * t + (p.v1 - p.v0) * (t / 2 - p.dur / (2 * PI) * Math.sin(PI * t / p.dur));
  }
  function rateAt(p, t) { return p.v0 + (p.v1 - p.v0) * (1 - Math.cos(PI * Math.max(0, Math.min(1, t / p.dur)))) / 2; }
  // A move of `total` (m or deg) at `rate`, ramped up and down over `ramp` seconds: total / rate + ramp s.
  function rampPieces(total, rate, ramp) {
    return [piece(ramp, 0, rate), piece(total / rate - ramp, rate, rate), piece(ramp, rate, 0)];
  }
  // Two cruising rates in one move (Reckon's "varied within legs"): ramp up to r1, cruise, blend to r2 over
  // `blend` s, cruise, ramp down; the first cruise takes the share f of the cruising distance.
  function twoRatePieces(total, r1, r2, f, ramp, blend) {
    var C = total - r1 * ramp / 2 - blend * (r1 + r2) / 2 - r2 * ramp / 2;
    return [piece(ramp, 0, r1), piece(f * C / r1, r1, r1), piece(blend, r1, r2), piece((1 - f) * C / r2, r2, r2), piece(ramp, r2, 0)];
  }
  // The rates of leg i and turn i: Reckon items carry per-leg speeds (one or two) and splits, and per-turn
  // rates; Homing items one speed and one turn rate.
  function legPieces(item, i) {
    var v = Array.isArray(item.speeds) ? item.speeds[i] : [item.speed], ramp = item.ramp || RAMP;
    if (v.length > 1) return twoRatePieces(item.legs[i], v[0], v[1], item.splits[i], ramp, item.blend);
    return rampPieces(item.legs[i], v[0], ramp);
  }
  function turnPieces(item, i) {
    var w = Array.isArray(item.turnRates) ? item.turnRates[i] : item.turnRate;
    return rampPieces(Math.abs(item.turns[i]), w, item.ramp || RAMP);
  }
  function piecesDur(ps) { var d = 0; for (var i = 0; i < ps.length; i++) d += ps[i].dur; return d; }
  // The whole motion: { segs: [{ kind: 'stand' | 'walk' | 'turn', dur, pieces, x, y, h, sign }], total, motion }.
  // A leg walks along heading h from (x, y); a turn turns by sign × its pieces from h. leadSec: the stand.
  function plan(item, leadSec) {
    var P = item.path, h = item.startHeading, segs = [{ kind: 'stand', dur: leadSec || 0, pieces: [], x: P[0][0], y: P[0][1], h: h, sign: 0 }];
    // Positions are walked from the start (not read from the stored, rounded path), so segments join exactly.
    var n = item.legs.length, m = item.turns.length, i, x = P[0][0], y = P[0][1];
    function addTurn(j) {
      var tp = turnPieces(item, j);
      segs.push({ kind: 'turn', dur: piecesDur(tp), pieces: tp, x: x, y: y, h: h, sign: item.turns[j] < 0 ? -1 : 1 });
      h += item.turns[j];
    }
    for (i = 0; i < n; i++) {
      var lp = legPieces(item, i), sc = sincos(h);
      segs.push({ kind: 'walk', dur: piecesDur(lp), pieces: lp, x: x, y: y, h: h, sign: 1 });
      x += item.legs[i] * sc[0]; y += item.legs[i] * sc[1];
      if (i < m && i < n - 1) addTurn(i); // the turns between legs
    }
    for (i = Math.max(0, n - 1); i < m; i++) addTurn(i); // turns after the last leg (Reckon's turn-only items)
    var total = 0, motion = 0;
    segs.forEach(function (s) { total += s.dur; if (s.kind !== 'stand') motion += s.dur; });
    return { segs: segs, total: total, motion: motion };
  }
  // Distance (m) or angle (deg) covered t seconds into a segment.
  function segAt(s, t) {
    var d = 0;
    for (var i = 0; i < s.pieces.length; i++) {
      var p = s.pieces[i];
      if (t <= p.dur) return d + pieceAt(p, t);
      d += pieceDist(p);
      t -= p.dur;
    }
    return d;
  }
  // The pose t seconds into the plan (clamped to its ends): { x, y, h, seg (index), kind }.
  function poseAt(pl, t) {
    for (var i = 0; i < pl.segs.length; i++) {
      var s = pl.segs[i];
      if (t <= s.dur || i === pl.segs.length - 1) {
        var tt = t < 0 ? 0 : t > s.dur ? s.dur : t, d = segAt(s, tt);
        if (s.kind === 'walk') { var sc = sincos(s.h); return { x: s.x + d * sc[0], y: s.y + d * sc[1], h: s.h, seg: i, kind: s.kind }; }
        if (s.kind === 'turn') return { x: s.x, y: s.y, h: s.h + s.sign * d, seg: i, kind: s.kind };
        return { x: s.x, y: s.y, h: s.h, seg: i, kind: s.kind };
      }
      t -= s.dur;
    }
    return null;
  }
  // Duration of the route's motion (legs and turns with their ramps), s.
  function motionSeconds(item) { return plan(item, 0).motion; }

  /* ------------------------------------------------------------ Homing's items */
  // Scores a candidate (see search): 8 the shortcuts miss ("reversed" always; "turn around" unless the
  // target itself lies within the tolerance of 180°; in a DEGENERATE cell only the one drawn as `prefer`),
  // 4 the key lies within TARGET_WIN of the target, 2 turning alone with equal legs misses too.
  // strict: null unless the best candidate is on target (generate's first STRICT attempts: a target the
  // geometry cannot reach is redrawn instead of leaving an off-target key, which would bunch answers
  // where routes naturally end, mostly behind).
  function build(r, p, strict) {
    var rt = ROUTES[p.route], tol = TOLERANCES[p.tolerance], degen = degenerate(p);
    var h0 = rnd(r.float(0, 360), 100), target = drawTarget(r), prefer = r.chance(0.5) ? 'around' : 'reversed';
    var aroundFree = adiff(target, 180) <= tol + MARGIN;
    var best = search(r, {
      n: rt.legs, band: TURNS[rt.turns], h0: h0, target: target, good: 12, full: 14, patience: EQUAL_TRIES,
      score: function (g, legs, turns) {
        var sh = shortcuts(turns), missA = adiff(g.key, sh.around) > tol + MARGIN, missR = adiff(g.key, sh.reversed) > tol + MARGIN;
        var need = degen ? (prefer === 'around' ? missA : missR) : missR && (missA || aroundFree);
        var sc = (need ? 8 : 0) + (adiff(g.key, target) <= TARGET_WIN ? 4 : 0);
        if (sc >= 12) {
          var eq = route(h0, legs.map(function () { return 1; }), turns);
          if (adiff(g.key, eq.key) > tol + MARGIN) sc += 2;
        }
        return sc;
      },
    });
    if (!best || (strict && best.score < 12)) return null;
    stats.builds++; if (best.score >= 12) stats.onTarget++; if (best.score >= 14) stats.full++;
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
    var item = {
      ex: 'homing', params: { route: p.route, landmarks: p.landmarks, tolerance: p.tolerance },
      key: rnd(g.key, 100) % 360, tolerance: TOLERANCES[p.tolerance], experimental: true,
      startHeading: h0, legs: legs, turns: turns,
      path: g.path.map(function (q) { return [rnd(q[0], 1000), rnd(q[1], 1000)]; }),
      heading: rnd(g.heading, 100) % 360, distance: rnd(g.distance, 1000), returnBearing: rnd(g.returnBearing, 100) % 360,
      pathLength: rnd(sum(legs), 100), speed: SPEED, turnRate: TURN_RATE, ramp: RAMP, duration: 0, landmarks: lm,
    };
    item.duration = rnd(motionSeconds(item), 100);
    return item;
  }

  var stats = { fallbacks: 0, builds: 0, onTarget: 0, full: 0 };
  // Attempts that must land on their target before an off-target key is accepted, in the cells where
  // answers can spread (3–4 legs, medium or large turns). Elsewhere most targets far from 180° cannot be
  // reached, and redrawing them would pile the answers up behind, where "turn around" is right.
  var STRICT = 8;
  function spreads(p) { var rt = ROUTES[p.route]; return rt.legs >= 3 && rt.turns >= 1; }
  function generate(rng, params) {
    var p = normParams(params), item = null, strict = spreads(p) ? STRICT : 0;
    for (var i = 0; i < 50 && !item; i++) {
      var it = build(i === 0 ? rng : rng.fork('retry' + i), p, i < strict);
      if (it && validate(it) === true) item = it;
    }
    if (!item) { item = fallback(rng, p); item.fallback = true; } // ARCHITECTURE §5: the engine voids fallback trials
    item.seed = rng.seed;
    return item;
  }

  // Deterministic routes tried in order (leg patterns × turn sizes × turn sides); the tests check that one
  // is valid at every combination of levels.
  var FB_LEGS = [[8, 6, 7, 5], [6, 9, 6, 7], [10, 5, 8, 5], [5, 9, 5, 9]];
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
  function validate(item) {
    try { return check(item); } catch (e) { return 'validate threw: ' + (e && e.message); }
  }
  // The checks Homing and Reckon share: legs, turns, the path from them, distances and the motion's
  // comfort limits. Returns true or a reason; g (the recomputed route) is put on out.g.
  function checkRoute(item, n, band, out) {
    if (!Array.isArray(item.legs) || item.legs.length !== n) return 'the route needs ' + n + ' legs';
    if (!Array.isArray(item.turns) || item.turns.length !== n - 1) return 'the route needs ' + (n - 1) + ' turns';
    for (var i = 0; i < n; i++) if (!isNum(item.legs[i]) || item.legs[i] < LEG[0] - 1e-9 || item.legs[i] > LEG[1] + 1e-9) return 'leg ' + i + ' is too short to see or too long';
    var total = sum(item.legs);
    if (total < PATH[0] - 1e-9 || total > PATH[1] + 1e-9) return 'the route is shorter than ' + PATH[0] + ' m or longer than ' + PATH[1] + ' m';
    if (!isNum(item.pathLength) || Math.abs(item.pathLength - total) > 0.006) return 'pathLength does not match the legs';
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
    var E = item.path[n], back = compass(-E[0], -E[1]), dist = Math.sqrt(E[0] * E[0] + E[1] * E[1]);
    if (dist < END_MIN) return 'the route ends too close to the start';
    if (Math.abs(dist - item.distance) > 0.002) return 'distance does not match the route';
    for (i = 1; i < n; i++) if (segDist([0, 0], item.path[i], item.path[i + 1]) < NEAR_START - 1e-6) return 'leg ' + i + ' passes within ' + NEAR_START + ' m of the start';
    if (adiff(item.heading, item.startHeading + sumTurns(item.turns)) > 0.02 || adiff(item.returnBearing, back) > 0.02) return 'heading or returnBearing does not match the route';
    out.g = g; out.back = back; out.dist = dist;
    return true;
  }
  // Every piece of the motion lasts > 0 s, rates stay within the comfort limits, each leg covers its
  // length and each turn its angle (closed form: Σ dur × (v0 + v1) / 2), and duration matches.
  function checkMotion(item) {
    var pl = plan(item, 0), w = 0, k = 0;
    for (var i = 1; i < pl.segs.length; i++) {
      var s = pl.segs[i], want = s.kind === 'walk' ? item.legs[w++] : Math.abs(item.turns[k++]), lim = s.kind === 'walk' ? V_MAX : W_MAX, d = 0;
      for (var j = 0; j < s.pieces.length; j++) {
        var p = s.pieces[j];
        if (!(p.dur > 1e-6) || !(p.v0 >= 0) || !(p.v1 >= 0) || p.v0 > lim + 1e-9 || p.v1 > lim + 1e-9) return 'segment ' + i + ' breaks the motion limits (≤ ' + V_MAX + ' m/s, ≤ ' + W_MAX + '°/s, every piece longer than 0 s)';
        d += pieceDist(p);
      }
      if (Math.abs(d - want) > 1e-6) return 'segment ' + i + ' covers ' + d + ' instead of ' + want;
    }
    if (!isNum(item.duration) || Math.abs(item.duration - pl.motion) > 0.006) return 'duration does not match the motion';
    return true;
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
    var n = ROUTES[p.route].legs, out = {}, ok = checkRoute(item, n, TURNS[ROUTES[p.route].turns], out);
    if (ok !== true) return ok;
    var key = norm360(out.back - (item.startHeading + sumTurns(item.turns)));
    if (!isNum(item.key) || adiff(key, item.key) > 0.02) return 'the key does not match the route';
    if (adiff(key, 0) < AXIS_GAP || adiff(key, 180) < AXIS_GAP) return 'the start is within 20° of straight ahead or behind';
    if (!(item.speed > 0) || !(item.turnRate > 0) || !(item.ramp > 0)) return 'speed, turnRate and ramp must be positive';
    ok = checkMotion(item);
    if (ok !== true) return ok;
    var lm = item.landmarks, want = LANDMARKS[p.landmarks].n, ids = {}, known = {};
    LANDMARK_KINDS.forEach(function (k) { known[k.id] = true; });
    if (!Array.isArray(lm) || lm.length !== want) return 'the level needs ' + want + ' landmark(s)';
    for (var i = 0; i < lm.length; i++) {
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
  // Mean route length by number of legs (m), as the generator draws them (the node test keeps estMs
  // within 10 % of the generated routes' mean trial time).
  var MEAN_PATH = { 2: 17.0, 3: 23.4, 4: 24.7 };
  // Expected time from the first frame to the answer at these params: the lead-in, the route at SPEED and
  // TURN_RATE with their ramps (the mean route length, the band's mean turn), and the response.
  function estMs(params) {
    var rt = ROUTES[normParams(params).route], band = TURNS[rt.turns];
    var walk = MEAN_PATH[rt.legs] / SPEED, turn = (rt.legs - 1) * (band.lo + band.hi) / 2 / TURN_RATE, ramps = (2 * rt.legs - 1) * RAMP;
    return Math.round(LEAD_MS + 1000 * (walk + turn + ramps) + RESPONSE_MS);
  }

  function routeName(rt) { return rt.legs + ' legs, ' + TURNS[rt.turns].name + ' turns (' + TURNS[rt.turns].lo + '–' + TURNS[rt.turns].hi + '°)'; }

  PX.ex.define({
    id: 'homing', version: 2, code: 'EX-11', name: 'Homing (experimental)', short: 'Homing', experimental: true,
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
      ROUTES: ROUTES, MODEL: MODEL, LEGS: LEGS, TURNS: TURNS, LANDMARKS: LANDMARKS, TOLERANCES: TOLERANCES, LEG: LEG, PATH: PATH,
      SPEED: SPEED, TURN_RATE: TURN_RATE, RAMP: RAMP, V_MAX: V_MAX, W_MAX: W_MAX, LEAD_MS: LEAD_MS, RESPONSE_MS: RESPONSE_MS, MEAN_PATH: MEAN_PATH,
      NEAR_START: NEAR_START, END_MIN: END_MIN, AXIS_GAP: AXIS_GAP, MARGIN: MARGIN, TARGET_WIN: TARGET_WIN, TRIES: TRIES, EQUAL_TRIES: EQUAL_TRIES,
      LANDMARK_KINDS: LANDMARK_KINDS, DEGENERATE: DEGENERATE, degenerate: degenerate, spreads: spreads, STRICT: STRICT, routeCost: routeCost, stats: stats,
      // deterministic maths
      sincos: sincos, atan2d: atan2d, asind: asind, compass: compass, norm180: norm180, norm360: norm360, adiff: adiff, rnd: rnd, sum: sum, segDist: segDist,
      // routes
      route: route, sumTurns: sumTurns, steer: steer, drawTarget: drawTarget, shortcuts: shortcuts, routeOk: routeOk, search: search,
      build: build, assemble: assemble, fallback: fallback, normParams: normParams, checkRoute: checkRoute, checkMotion: checkMotion,
      // motion
      piece: piece, pieceDist: pieceDist, pieceAt: pieceAt, rateAt: rateAt, rampPieces: rampPieces, twoRatePieces: twoRatePieces,
      legPieces: legPieces, turnPieces: turnPieces, plan: plan, segAt: segAt, poseAt: poseAt, motionSeconds: motionSeconds,
    },
  });
})(window.PX);
