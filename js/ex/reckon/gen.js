/* EX-12 Reckon (experimental): dead reckoning with no landmarks (pure; ARCHITECTURE.md §5; design:
   docs/research/v1.1/R1-path-integration.md §6, §8; PLAN.md M3). The view carries the player along a
   passive route of 2–4 straight legs with turns on the spot, first person, across an endless plain that
   holds no fix of any kind: no objects, a flat sky, unlit ground whose marks are re-seeded every item and
   wrap round the viewer, no start marker once you leave it, and speeds that vary so that time is not
   distance. Then the player answers in the body frame:
     point   turn to face the start (answer 'angle': degrees clockwise from the final heading);
     return  turn, then walk back and stop where the start is (answer 'position': { x, z } in metres in
             the item's frame 'end': origin at the end of the route, x to the right, z straight ahead).
   Homing (EX-11) is the landmark-aided stage before it. Ratings are kept per screen class (perDisplay).

   Right or wrong (R1 §6.2): point items are right when the angular error is at most the tolerance (40,
   30, 20°); return items when the stop lies within a disk round the start whose radius is a share of
   the home distance d (50, 35, 25 %), which never contains the end itself. The continuous errors go to
   score().detail and the view's feedback: angle error, distance ratio, position error and drift.
   value: point → the absolute angular error (°); return → the position error as a share of d.
   chance: point 2τ/360; return 2·asin(τ)/360 (an upper bound: a guesser who knew d exactly).

   Dims: route (Homing's 8 levels: legs × turn size), flow (textured blobs, sparse blobs, short-lived
   dots), speed (steady with ±10 % jitter; varied between legs, 1.2–2.0 m/s, turns 30–45°/s; varied
   within legs: two speeds per leg at least 0.4 m/s apart), tolerance (as above); variants point and
   return (+0.5 logit). Initial steps (hand-set, R1 §8.4; to be refitted from pooled exports): 0.55 per
   extra leg, 0.4 per turn size, 0.35 per flow level, 0.3 per speed level, 0.9 per tolerance level.
   extraParams.task: 'heading' (turn on the spot, then face the way you started) and 'distance' (walk,
   then walk the same distance again at another speed): tutorial items only, never chosen by the engine.

   Generation reuses Homing's route model (PX.ex.get('homing').lib: route, steer, drawTarget, search,
   routeOk, checkRoute, checkMotion, the motion pieces), with Reckon's own rules on top (R1 §6.4, §8.4):
   the shortcut answers "turns reversed" (180° − Σ turns), "heading not updated" (key + Σ turns, as if
   no turn had happened) and "mirror" (360° − key, sides swapped) miss by more than the tolerance + 2°
   (for return items the tolerance in angle is 2·asin(τ/2), the miss of a perfect distance at the disk's
   edge); "turn around" (180°) misses unless the drawn target lies within it; the key is never within
   max(20°, (tol + 2°)/2) of straight ahead or behind; home distance 5–20 m; routes 12–28 m in all.

   Item (JSON): { ex: 'reckon', seed, params: { variant, route, flow, speed, tolerance }, task?, answer,
     key (deg | { x, z }), keyDeg, tolerance (deg | share), tolDeg, frame: 'end', experimental: true,
     startHeading, legs, turns, path, heading, distance, returnBearing, pathLength,
     speeds: [[m/s] or [m/s, m/s]] per leg, splits: [share | null] per leg, turnRates: [deg/s], ramp, blend,
     duration (s), walkSpeed (m/s, the walk back), ground: { seed, kind, density, size, life? } }
   The ground seed comes from its own fork of the item's stream, so the marks carry no route information. */
(function (PX) {
  'use strict';

  var HOMING = PX.ex.get('homing');
  if (!HOMING || !HOMING.lib || typeof HOMING.lib.search !== 'function') {
    throw new Error('js/ex/reckon/gen.js needs Homing\'s route model: load js/ex/homing/gen.js first');
  }
  var H = HOMING.lib;
  var sincos = H.sincos, compass = H.compass, norm180 = H.norm180, norm360 = H.norm360, adiff = H.adiff, rnd = H.rnd, sum = H.sum, asind = H.asind;
  function isNum(x) { return typeof x === 'number' && isFinite(x); }

  /* ------------------------------------------------------------ levels and constants */
  var VARIANTS = ['point', 'return'];
  var TASKS = ['heading', 'distance'];
  var ROUTES = H.ROUTES, TURNS = H.TURNS;
  var FLOWS = [
    { name: 'textured', kind: 'blobs', density: 0.35, size: [0.3, 0.9] },
    { name: 'sparse', kind: 'blobs', density: 0.12, size: [0.3, 0.9] },
    { name: 'short-lived dots', kind: 'dots', density: 0.6, size: [0.3, 0.5], life: [0.8, 1.4] },
  ];
  var SPEEDS = ['steady', 'varied between legs', 'varied within legs'];
  var TOL_POINT = [40, 30, 20];          // degrees
  var TOL_RETURN = [0.5, 0.35, 0.25];    // share of the home distance
  var MODEL = { base: -2.25, leg: 0.55, turn: 0.4, flow: 0.35, speed: 0.3, tolerance: 0.9, ret: 0.5 };
  var STEADY = 1.8, JITTER = 0.1;        // m/s, ± share per item at the steady level (R1 §9 risk 7)
  var V = [1.2, 2.0], V_GAP = 0.4;       // varied speeds (m/s); two speeds in one leg differ by ≥ V_GAP
  var W = [30, 45];                      // varied turn rates (deg/s)
  var BLEND = 0.8, SPLIT = [0.3, 0.7];   // s to change speed within a leg; share of the leg at the first speed
  var WALK = [1.05, 1.95];               // the walk back (m/s): 1.5 ± 30 %, new every item
  var D_MAX = 20;                        // home distance (m): 5–20
  var LEAD_MS = 1200;                    // standing in the start ring before the walk
  var MARGIN = H.MARGIN, TARGET_WIN = H.TARGET_WIN, STRICT = H.STRICT || 8;
  var HEADING_TURN = [70, 150];          // the heading task's one turn (deg)
  var DIST_LEG = [6, 10];                // the distance task's walk (m)

  function clampInt(x, n) { x = Number.isInteger(x) ? x : 0; return x < 0 ? 0 : x >= n ? n - 1 : x; }
  function normParams(params) {
    var p = params || {};
    var out = {
      variant: VARIANTS.indexOf(p.variant) >= 0 ? p.variant : VARIANTS[0],
      route: clampInt(p.route, ROUTES.length), flow: clampInt(p.flow, FLOWS.length),
      speed: clampInt(p.speed, SPEEDS.length), tolerance: clampInt(p.tolerance, TOL_POINT.length),
    };
    if (TASKS.indexOf(p.task) >= 0) out.task = p.task;
    return out;
  }
  function routeCost(rt) { return MODEL.leg * (rt.legs - 2) + MODEL.turn * rt.turns; }
  function difficulty(params) {
    var p = normParams(params);
    return MODEL.base + routeCost(ROUTES[p.route]) + MODEL.flow * p.flow + MODEL.speed * p.speed + MODEL.tolerance * p.tolerance + (p.variant === 'return' ? MODEL.ret : 0);
  }
  // The tolerance in angle: point items their own; return items the direction error that, with a perfect
  // distance, puts the stop on the disk's edge (chord 2·d·sin(e/2) = τ·d): 29.0°, 20.1°, 14.4°.
  function tolDeg(p) { return p.variant === 'point' ? TOL_POINT[p.tolerance] : 2 * asind(TOL_RETURN[p.tolerance] / 2); }
  function axisGap(tol) { return Math.max(H.AXIS_GAP, (tol + MARGIN) / 2 + 0.5); }
  function chance(params) {
    var p = normParams(params);
    return p.variant === 'point' ? 2 * TOL_POINT[p.tolerance] / 360 : 2 * asind(TOL_RETURN[p.tolerance]) / 360;
  }

  /* ------------------------------------------------------------ the shortcut answers (R1 §6.4) */
  // In degrees clockwise from the final heading, for a route with these turns and this key.
  function shortcuts(key, turns) {
    var S = sum(turns);
    return { around: 180, reversed: norm360(180 - S), notUpdated: norm360(key + S), mirror: norm360(360 - key) };
  }
  // The rules every scored item meets (the validator checks them; "turn around" is checked by the tests).
  // extra: the generator asks for SAFE degrees more, so the rounded stored route still passes.
  var SAFE = 0.1;
  function shortcutsMiss(key, turns, tol, extra) {
    var s = shortcuts(key, turns), lim = tol + MARGIN + (extra || 0);
    return adiff(key, s.reversed) > lim && adiff(key, s.notUpdated) > lim && adiff(key, s.mirror) > lim;
  }

  /* ------------------------------------------------------------ items */
  var stats = { fallbacks: 0, builds: 0, onTarget: 0, full: 0 };
  function spreads(p) { var rt = ROUTES[p.route]; return rt.legs >= 3 && rt.turns >= 1; }

  // Scores a candidate route (Homing's search): 8 the shortcuts miss (and "turn around" unless the target
  // lies within it), 4 the key lands on the target, 2 turning alone with equal legs misses too.
  function build(r, p, strict) {
    var rt = ROUTES[p.route], tol = tolDeg(p), gap = axisGap(tol);
    var h0 = rnd(r.float(0, 360), 100), target = H.drawTarget(r, gap), aroundFree = adiff(target, 180) <= tol + MARGIN;
    var best = H.search(r, {
      n: rt.legs, band: TURNS[rt.turns], h0: h0, target: target, gap: gap, dMax: D_MAX, good: 12, full: 14, patience: H.EQUAL_TRIES,
      score: function (g, legs, turns) {
        var need = shortcutsMiss(g.key, turns, tol, SAFE) && (adiff(g.key, 180) > tol + MARGIN || aroundFree) && adiff(g.key, 0) >= gap + SAFE && adiff(g.key, 180) >= gap + SAFE;
        var sc = (need ? 8 : 0) + (adiff(g.key, target) <= TARGET_WIN ? 4 : 0);
        if (sc >= 12) {
          var eq = H.route(h0, legs.map(function () { return 1; }), turns);
          if (adiff(g.key, eq.key) > tol + MARGIN) sc += 2;
        }
        return sc;
      },
    });
    if (!best || best.score < 8 || (strict && best.score < 12)) return null;
    stats.builds++; if (best.score >= 12) stats.onTarget++; if (best.score >= 14) stats.full++;
    return assemble(r, p, h0, best.legs, best.turns);
  }

  // Speeds, turn rates and splits of the route (their own stream: independent of the geometry, so the
  // outbound time says little about the distance back), redrawn until the motion lasts at most
  // MAX_MOTION s (R1 §7.2: never over 30 s); after 30 draws the slowest plan is sped up to fit.
  var MAX_MOTION = 30;
  function speedPlan(r, level, legs, turns) {
    var best = null;
    for (var k = 0; k < 30; k++) {
      var sp = drawSpeeds(k ? r.fork('again' + k) : r, level, legs.length, turns.length), s = motionOf(legs, turns, sp);
      if (s <= MAX_MOTION) return sp;
      if (!best || s < best.s) best = { sp: sp, s: s };
    }
    var f = best.s / MAX_MOTION + 0.01;
    best.sp.speeds = best.sp.speeds.map(function (v) { return v.map(function (x) { return Math.min(V[1], rnd(x * f, 100)); }); });
    best.sp.rates = best.sp.rates.map(function (w) { return Math.min(W[1], rnd(w * f, 10)); });
    return best.sp;
  }
  function motionOf(legs, turns, sp) {
    return H.motionSeconds({ legs: legs, turns: turns, speeds: sp.speeds, splits: sp.splits, turnRates: sp.rates, ramp: H.RAMP, blend: BLEND,
      startHeading: 0, path: [[0, 0]] });
  }
  function drawSpeeds(r, level, nLegs, nTurns) {
    var out = { speeds: [], splits: [], rates: [] }, i;
    var steady = rnd(STEADY * (1 + r.float(-JITTER, JITTER)), 100);
    for (i = 0; i < nLegs; i++) {
      if (level === 0) { out.speeds.push([steady]); out.splits.push(null); }
      else if (level === 1) { out.speeds.push([rnd(r.float(V[0], V[1]), 100)]); out.splits.push(null); }
      else {
        var a = rnd(r.float(V[0], V[1] - V_GAP), 100), b = rnd(r.float(a + V_GAP, V[1]), 100);
        out.speeds.push(r.chance(0.5) ? [a, b] : [b, a]);
        out.splits.push(rnd(r.float(SPLIT[0], SPLIT[1]), 100));
      }
    }
    for (i = 0; i < nTurns; i++) out.rates.push(level === 0 ? W[1] : rnd(r.float(W[0], W[1]), 10));
    return out;
  }
  function groundFor(r, flow) {
    var f = FLOWS[flow], g = { seed: r.int(1, 2147483646), kind: f.kind, density: f.density, size: f.size.slice() };
    if (f.life) g.life = f.life.slice();
    return g;
  }
  function keyXZ(k, d) { var sc = sincos(k); return { x: rnd(d * sc[0], 1000), z: rnd(d * sc[1], 1000) }; }

  function base(r, p, extra) {
    var it = {
      ex: 'reckon', params: { variant: p.variant, route: p.route, flow: p.flow, speed: p.speed, tolerance: p.tolerance },
      answer: p.variant === 'point' ? 'angle' : 'position', experimental: true, frame: 'end',
    };
    for (var k in extra) if (Object.prototype.hasOwnProperty.call(extra, k)) it[k] = extra[k];
    it.ramp = H.RAMP; it.blend = BLEND;
    it.walkSpeed = rnd(r.fork('walk').float(WALK[0], WALK[1]), 100);
    it.ground = groundFor(r.fork('ground'), p.flow);
    it.duration = rnd(H.motionSeconds(it), 100);
    return it;
  }
  function assemble(r, p, h0, legs, turns) {
    var g = H.route(h0, legs, turns), sp = speedPlan(r.fork('speeds'), p.speed, legs, turns), k = rnd(g.key, 100) % 360;
    return base(r, p, {
      key: p.variant === 'point' ? k : keyXZ(g.key, g.distance), keyDeg: k,
      tolerance: p.variant === 'point' ? TOL_POINT[p.tolerance] : TOL_RETURN[p.tolerance], tolDeg: rnd(tolDeg(p), 100),
      startHeading: h0, legs: legs, turns: turns,
      path: g.path.map(function (q) { return [rnd(q[0], 1000), rnd(q[1], 1000)]; }),
      heading: rnd(g.heading, 100) % 360, distance: rnd(g.distance, 1000), returnBearing: rnd(g.returnBearing, 100) % 360,
      pathLength: rnd(sum(legs), 100), speeds: sp.speeds, splits: sp.splits, turnRates: sp.rates,
    });
  }

  // Tutorial items (extraParams.task; never rated). heading: stand in the ring, turn once on the spot,
  // then face the way you faced at the start (key −T). distance: walk straight, then walk the same
  // distance again at another speed (key { x: 0, z: L }: L ahead of where the first walk ended).
  function taskItem(r, p) {
    var h0 = rnd(r.float(0, 360), 100), sp = drawSpeeds(r.fork('speeds'), p.speed, p.task === 'distance' ? 1 : 0, p.task === 'heading' ? 1 : 0);
    if (p.task === 'heading') {
      var T = rnd((r.chance(0.5) ? 1 : -1) * r.float(HEADING_TURN[0], HEADING_TURN[1]), 10), key = rnd(norm360(-T), 100) % 360;
      return base(r, { variant: 'point', route: p.route, flow: p.flow, speed: p.speed, tolerance: p.tolerance }, {
        task: 'heading', key: key, keyDeg: key, tolerance: TOL_POINT[p.tolerance], tolDeg: TOL_POINT[p.tolerance],
        startHeading: h0, legs: [], turns: [T], path: [[0, 0]], heading: rnd(norm360(h0 + T), 100) % 360, distance: 0,
        returnBearing: null, pathLength: 0, speeds: [], splits: [], turnRates: sp.rates,
      });
    }
    var L = rnd(r.float(DIST_LEG[0], DIST_LEG[1]), 10), sc = sincos(h0);
    var it = base(r, { variant: 'return', route: p.route, flow: p.flow, speed: p.speed, tolerance: p.tolerance }, {
      task: 'distance', key: { x: 0, z: L }, keyDeg: 0, tolerance: TOL_RETURN[p.tolerance], tolDeg: rnd(tolDeg({ variant: 'return', tolerance: p.tolerance }), 100),
      startHeading: h0, legs: [L], turns: [], path: [[0, 0], [rnd(L * sc[0], 1000), rnd(L * sc[1], 1000)]], heading: h0, distance: L,
      returnBearing: null, pathLength: L, speeds: sp.speeds, splits: sp.splits, turnRates: [],
    });
    // The second walk at a clearly different speed (≥ 0.4 m/s apart), so counting seconds misleads.
    var v1 = it.speeds[0][0], wr = r.fork('walk2');
    it.walkSpeed = v1 <= 1.55 ? rnd(wr.float(v1 + 0.4, WALK[1]), 100) : rnd(wr.float(WALK[0], v1 - 0.4), 100);
    return it;
  }

  function generate(rng, params) {
    var p = normParams(params), item = null;
    if (p.task) { item = taskItem(rng, p); item.seed = rng.seed; return item; }
    var strict = spreads(p) ? STRICT : 0;
    for (var i = 0; i < 50 && !item; i++) {
      var it = build(i === 0 ? rng : rng.fork('retry' + i), p, i < strict);
      if (it && validate(it) === true) item = it;
    }
    if (!item) { item = fallback(rng, p); item.fallback = true; } // ARCHITECTURE §5: the engine voids fallback trials
    item.seed = rng.seed;
    return item;
  }

  // A construction known to be valid: Homing's search from fixed forks of the item's stream, without
  // the target and patience rules, tried in order; the tests check that one is valid at every
  // combination of levels.
  function fallback(rng, p) {
    stats.fallbacks++;
    var last = null;
    for (var k = 0; k < 40; k++) {
      var it = build(rng.fork('fallback' + k), p, false);
      if (it) { last = it; if (validate(Object.assign({ seed: 0 }, it)) === true) return it; }
    }
    return last || build(rng.fork('fallback-last'), Object.assign({}, p, { route: 0 }), false);
  }

  /* ------------------------------------------------------------ validation */
  function validate(item) {
    try { return check(item); } catch (e) { return 'validate threw: ' + (e && e.message); }
  }
  function within(x, lo, hi) { return isNum(x) && x >= lo - 1e-9 && x <= hi + 1e-9; }
  // Speeds by level: steady (one speed for every leg, 1.8 ± 10 %, turns at 45°/s); varied between legs
  // (one speed per leg in 1.2–2.0, turns 30–45°/s); varied within legs (two speeds ≥ 0.4 apart, a split).
  function checkSpeeds(item, level) {
    var n = item.legs.length, m = item.turns.length, i;
    if (!Array.isArray(item.speeds) || item.speeds.length !== n || !Array.isArray(item.splits) || item.splits.length !== n || !Array.isArray(item.turnRates) || item.turnRates.length !== m) {
      return 'speeds, splits and turnRates need one entry per leg or turn';
    }
    for (i = 0; i < n; i++) {
      var v = item.speeds[i], f = item.splits[i];
      if (!Array.isArray(v) || v.length !== (level === 2 ? 2 : 1)) return 'leg ' + i + ' needs ' + (level === 2 ? 'two speeds' : 'one speed');
      if (level === 0 && (!within(v[0], STEADY * (1 - JITTER), STEADY * (1 + JITTER)) || v[0] !== item.speeds[0][0])) return 'the steady level walks every leg at one speed of 1.8 m/s ± 10 %';
      if (level > 0 && !(within(v[0], V[0], V[1]) && (v.length < 2 || within(v[1], V[0], V[1])))) return 'leg ' + i + ' speed outside ' + V[0] + '–' + V[1] + ' m/s';
      if (level === 2 && (Math.abs(v[0] - v[1]) < V_GAP - 1e-9 || !within(f, SPLIT[0], SPLIT[1]))) return 'leg ' + i + ' needs two speeds ' + V_GAP + ' m/s apart and a split in ' + SPLIT.join('–');
      if (level < 2 && f !== null) return 'leg ' + i + ' has a split but one speed';
    }
    for (i = 0; i < m; i++) {
      var w = item.turnRates[i];
      if (level === 0 ? w !== W[1] : !within(w, W[0], W[1])) return 'turn ' + i + ' rate does not match the speed level';
    }
    if (item.ramp !== H.RAMP || item.blend !== BLEND) return 'ramp and blend must be the model\'s';
    if (!within(item.walkSpeed, WALK[0], WALK[1])) return 'walkSpeed outside ' + WALK.join('–') + ' m/s';
    return H.checkMotion(item);
  }
  // Nothing in the item can be a fix: no objects, and ground marks of the level's kind from their own seed.
  function checkGround(item, flow) {
    var g = item.ground, f = FLOWS[flow];
    if (item.landmarks !== undefined || item.objects !== undefined) return 'Reckon items carry no landmarks or objects';
    if (!g || g.kind !== f.kind || g.density !== f.density || !Array.isArray(g.size) || g.size[0] !== f.size[0] || g.size[1] !== f.size[1]) return 'the ground does not match the flow level';
    if (!Number.isInteger(g.seed) || g.seed < 1 || g.seed > 2147483646) return 'the ground needs its own seed';
    if (f.life ? !(Array.isArray(g.life) && g.life[0] === f.life[0] && g.life[1] === f.life[1]) : g.life !== undefined) return 'the ground marks\' lifetime does not match the flow level';
    return true;
  }
  function checkTask(item, p) {
    var ok;
    if (item.task === 'heading') {
      if (item.answer !== 'angle' || item.legs.length !== 0 || !Array.isArray(item.turns) || item.turns.length !== 1) return 'a heading item turns once on the spot and answers an angle';
      var T = item.turns[0];
      if (!within(Math.abs(T), HEADING_TURN[0], HEADING_TURN[1])) return 'the heading item\'s turn is outside ' + HEADING_TURN.join('–') + '°';
      if (adiff(item.key, -T) > 0.02 || item.keyDeg !== item.key || item.tolerance !== TOL_POINT[p.tolerance]) return 'the heading item\'s key is −turn';
      if (adiff(item.heading, item.startHeading + T) > 0.02) return 'heading does not match the turn';
    } else if (item.task === 'distance') {
      if (item.answer !== 'position' || item.legs.length !== 1 || item.turns.length !== 0) return 'a distance item walks one leg and answers a position';
      var L = item.legs[0];
      if (!within(L, DIST_LEG[0], DIST_LEG[1]) || !item.key || item.key.x !== 0 || item.key.z !== L || item.distance !== L) return 'the distance item\'s key is L straight ahead';
      if (item.tolerance !== TOL_RETURN[p.tolerance]) return 'tolerance does not match the level';
    } else return 'unknown task';
    ok = checkSpeeds(item, p.speed);
    if (ok !== true) return ok;
    if (item.task === 'distance' && Math.abs(item.walkSpeed - item.speeds[0][0]) < 0.4 - 1e-9) return 'the second walk needs another speed';
    return checkGround(item, p.flow);
  }
  function check(item) {
    if (!item || item.ex !== 'reckon') return 'not a reckon item';
    var p = item.params;
    if (!p) return 'params missing';
    if (VARIANTS.indexOf(p.variant) < 0) return 'unknown variant';
    var dims = [['route', ROUTES], ['flow', FLOWS], ['speed', SPEEDS], ['tolerance', TOL_POINT]];
    for (var d = 0; d < dims.length; d++) {
      var v = p[dims[d][0]];
      if (!Number.isInteger(v) || v < 0 || v >= dims[d][1].length) return 'params.' + dims[d][0] + ' out of range';
    }
    if (item.experimental !== true || item.frame !== 'end') return 'experimental and frame missing';
    if (item.task !== undefined) return checkTask(item, p);
    if (item.answer !== (p.variant === 'point' ? 'angle' : 'position')) return 'the answer type does not match the variant';
    var tol = tolDeg(p);
    if (item.tolerance !== (p.variant === 'point' ? TOL_POINT : TOL_RETURN)[p.tolerance] || Math.abs(item.tolDeg - tol) > 0.006) return 'tolerance does not match the level';
    var rt = ROUTES[p.route], out = {}, ok = H.checkRoute(item, rt.legs, TURNS[rt.turns], out);
    if (ok !== true) return ok;
    if (out.dist > D_MAX + 1e-9) return 'the route ends more than ' + D_MAX + ' m from the start';
    // The key from the stored path: bearing of the start from the end, minus the final heading.
    var key = norm360(out.back - (item.startHeading + sum(item.turns)));
    if (!isNum(item.keyDeg) || adiff(key, item.keyDeg) > 0.02) return 'the key does not match the route';
    if (p.variant === 'point' ? item.key !== item.keyDeg : !(item.key && Math.abs(item.key.x - out.dist * Math.sin(key * Math.PI / 180)) < 0.003 && Math.abs(item.key.z - out.dist * Math.cos(key * Math.PI / 180)) < 0.003)) {
      return 'the answer key does not match the route';
    }
    var gap = axisGap(tol);
    if (adiff(key, 0) < gap - 1e-9 || adiff(key, 180) < gap - 1e-9) return 'the start is within ' + rnd(gap, 10) + '° of straight ahead or behind';
    if (!shortcutsMiss(key, item.turns, tol)) return 'a shortcut answer (turns reversed, heading not updated or mirror) lands within the tolerance';
    ok = checkSpeeds(item, p.speed);
    if (ok !== true) return ok;
    if (item.duration > MAX_MOTION + 1e-9) return 'the route moves for more than ' + MAX_MOTION + ' s';
    return checkGround(item, p.flow);
  }

  /* ------------------------------------------------------------ scoring */
  // point: degrees clockwise from the final heading. return: { x, z } in the frame 'end' (x right, z ahead).
  function score(item, response) {
    var bad = { correct: false, value: null, detail: { invalid: true } };
    if (item.answer === 'angle') {
      if (!isNum(response)) return bad;
      var signed = norm180(response - item.key), error = Math.abs(signed);
      // value: the signed angle error (degrees, + clockwise of the start); the trial log keeps it as is
      return { correct: error <= item.tolerance + 1e-9, value: rnd(signed, 100), detail: { signed: rnd(signed, 100), error: rnd(error, 100) } };
    }
    if (!response || typeof response !== 'object' || !isNum(response.x) || !isNum(response.z)) return bad;
    var dx = response.x - item.key.x, dz = response.z - item.key.z, posErr = Math.sqrt(dx * dx + dz * dz), d = item.distance;
    var r = Math.sqrt(response.x * response.x + response.z * response.z), dir = r > 1e-6 ? compass(response.x, response.z) : null;
    // value: the signed angle error of the way walked (degrees; null without a walk); value2 (trial column
    // 13): the distance ratio, walked ÷ true. The position error stays in the detail (posErr, rel).
    var signedR = dir === null ? null : rnd(norm180(dir - item.keyDeg), 10);
    return {
      correct: posErr <= item.tolerance * d + 1e-9, value: signedR, value2: rnd(r / d, 1000),
      detail: { posErr: rnd(posErr, 100), rel: rnd(posErr / d, 1000), dist: rnd(r, 100), ratio: rnd(r / d, 1000), dir: dir === null ? null : rnd(dir, 10), signed: signedR },
    };
  }

  /* ------------------------------------------------------------ the player's own errors (feedback) */
  // One entry per answered scored item, kept by the view (last HIST_N): [tSec, variant (0 point, 1
  // return), key (deg), answer direction (deg, null if none), home distance d (m), walked r (m; −1 for
  // point items), route length (m), right (1/0), display class (0 phone, 1 wide; entries without it are
  // older)]. Reckon is rated per display, so the bias line counts one class at a time.
  var HIST_N = 40;
  function entry(item, response, result, tSec, display) {
    if (!item || item.task || item.fallback || !result || !result.detail || result.detail.invalid) return null;
    var ret = item.answer === 'position', dir = ret ? result.detail.dir : norm360(response);
    var e = [Math.round(tSec || 0), ret ? 1 : 0, item.keyDeg, dir === null || dir === undefined ? null : rnd(dir, 10), rnd(item.distance, 100),
      ret ? rnd(result.detail.dist, 100) : -1, rnd(item.pathLength, 10), result.correct ? 1 : 0];
    if (display === 0 || display === 1) e.push(display);
    return e;
  }
  function median(a) { if (!a.length) return null; var s = a.slice().sort(function (x, y) { return x - y; }), m = s.length >> 1; return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; }
  // A robust summary of the last n entries (R1 §8.1(c), §9 risk 6: worded as a tendency):
  //   turn: median overshoot of the homing turn (|answer| − |key|, same side only; + = turned too far)
  //   ratio: median walked / home distance over return items; swaps: answers on the other side
  // display (0 or 1): only that class's entries (older entries without a class count for both).
  function bias(hist, n, display) {
    var list = (Array.isArray(hist) ? hist : []).filter(function (e) { return Array.isArray(e) && e.length >= 8 && (display === undefined || e.length < 9 || e[8] === display); }).slice(-(n || 20));
    var over = [], ratios = [], swaps = 0, sides = 0;
    list.forEach(function (e) {
      if (e[3] === null) return;
      var k = norm180(e[2]), q = norm180(e[3]);
      if (Math.abs(k) >= 20 && Math.abs(k) <= 160 && Math.abs(q) >= 5 && Math.abs(q) <= 175) {
        sides++;
        if ((k < 0) === (q < 0)) over.push(Math.abs(q) - Math.abs(k)); else swaps++;
      }
      if (e[1] === 1 && e[5] >= 0 && e[4] > 0) ratios.push(e[5] / e[4]);
    });
    return {
      n: list.length, turnN: over.length, turn: over.length >= 5 ? rnd(median(over), 1) : null,
      ratioN: ratios.length, ratio: ratios.length >= 3 ? rnd(median(ratios), 100) : null, swaps: swaps, sides: sides,
    };
  }

  /* ------------------------------------------------------------ timing */
  var RESPONSE_MS = 5000;   // typical time to turn to face the start and confirm
  var STOP_MS = 2000;       // after the walk back: stopping and confirming
  // Mean route length (m) and home distance (m) by number of legs, as the generator draws them (the node
  // test keeps estMs within 15 % of the generated items' mean).
  var MEAN_PATH = { 2: 16.8, 3: 23.0, 4: 24.5 }, MEAN_D = { 2: 8.8, 3: 10.8, 4: 10.6 };
  function estMs(params) {
    var p = normParams(params), rt = ROUTES[p.route], band = TURNS[rt.turns];
    var v = p.speed === 0 ? STEADY : (V[0] + V[1]) / 2, w = p.speed === 0 ? W[1] : (W[1] - W[0]) / Math.log(W[1] / W[0]);
    var motion = MEAN_PATH[rt.legs] / v + (rt.legs - 1) * (band.lo + band.hi) / 2 / w + (2 * rt.legs - 1) * H.RAMP;
    var answer = RESPONSE_MS + (p.variant === 'return' ? 1000 * MEAN_D[rt.legs] / ((WALK[0] + WALK[1]) / 2) + STOP_MS : 0);
    return Math.round(LEAD_MS + 1000 * motion + answer);
  }

  function routeName(rt) { return rt.legs + ' legs, ' + TURNS[rt.turns].name + ' turns (' + TURNS[rt.turns].lo + '–' + TURNS[rt.turns].hi + '°)'; }

  PX.ex.define({
    id: 'reckon', version: 1, code: 'EX-12', name: 'Reckon (experimental)', short: 'Reckon', experimental: true,
    abilities: ['NAV'], cell: 'extrinsic-dynamic', role: 'train', answer: 'angle', answers: { point: 'angle', return: 'position' },
    perDisplay: true, variants: VARIANTS.slice(), extraParams: ['task'],
    requires: ['homing'], // its route model (gen.js) and its 3D kit (view.js): load Homing's files first
    dims: [
      { key: 'route', label: 'Route', levels: ROUTES.map(routeName), step: (routeCost(ROUTES[ROUTES.length - 1]) - routeCost(ROUTES[0])) / (ROUTES.length - 1) },
      { key: 'flow', label: 'Ground', levels: FLOWS.map(function (f) { return f.name; }), step: MODEL.flow },
      { key: 'speed', label: 'Speed', levels: SPEEDS.slice(), step: MODEL.speed },
      { key: 'tolerance', label: 'Tolerance', levels: TOL_POINT.map(function (t, i) { return '±' + t + '° or ' + Math.round(100 * TOL_RETURN[i]) + ' % of the way back'; }), step: MODEL.tolerance },
    ],
    base: difficulty({ variant: 'point', route: 0, flow: 0, speed: 0, tolerance: 0 }),
    difficulty: difficulty,
    chance: chance,
    estMs: estMs,
    generate: generate,
    validate: validate,
    score: score,
    lib: {
      VARIANTS: VARIANTS, TASKS: TASKS, ROUTES: ROUTES, TURNS: TURNS, FLOWS: FLOWS, SPEEDS: SPEEDS, TOL_POINT: TOL_POINT, TOL_RETURN: TOL_RETURN,
      MODEL: MODEL, STEADY: STEADY, JITTER: JITTER, V: V, V_GAP: V_GAP, W: W, BLEND: BLEND, SPLIT: SPLIT, WALK: WALK, D_MAX: D_MAX,
      LEAD_MS: LEAD_MS, MAX_MOTION: MAX_MOTION, RESPONSE_MS: RESPONSE_MS, STOP_MS: STOP_MS, MEAN_PATH: MEAN_PATH, MEAN_D: MEAN_D, HEADING_TURN: HEADING_TURN, DIST_LEG: DIST_LEG,
      MARGIN: MARGIN, SAFE: SAFE, HIST_N: HIST_N, stats: stats, homing: H,
      normParams: normParams, routeCost: routeCost, tolDeg: tolDeg, axisGap: axisGap, shortcuts: shortcuts, shortcutsMiss: shortcutsMiss, spreads: spreads,
      build: build, assemble: assemble, speedPlan: speedPlan, drawSpeeds: drawSpeeds, taskItem: taskItem, fallback: fallback, keyXZ: keyXZ,
      entry: entry, bias: bias, median: median,
    },
  });
})(window.PX);
