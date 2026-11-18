/* EX-20 Central Point: its add-on layers (v1.2 wave 2, W2-bets; PLAN milestone 4; note T1 §3.3, §4.1, §4.2).
   Pure: the facts a comparison round states about a solved item, each computed from the item's model, and
   the off-screen challenge. Drawing: layers-view.js.

   Principles (each sentence proved on the model, tests/node/layers-centralpoint.test.mjs):
     equal-pulls  at the best spot every target pulls equally hard, near or far: the unit vectors towards the
                  targets sum to zero at the continuous best spot (checked on every item; the spot is never on
                  a target on rated items)
     crossing     with four targets the best spot is where the lines joining opposite targets cross (four
                  points in convex position; checked on every rated four-target item)
   The average position is never drawn or offered (PLAN Defaults: the Balance check stays untrained); a
   statement about "the farthest target pulls hardest" names the habit in words only. */
(function (PX) {
  'use strict';

  var B = PX.engine && PX.engine.bets, def = PX.ex.get('centralpoint');
  if (!B || !def) return;
  var sqrt = Math.sqrt, abs = Math.abs;
  var CENTRE = 6; // half-steps

  // Σ of the unit vectors from p towards the targets (the pulls' sum; 0 at the best spot).
  function pullSum(t, p) {
    var sx = 0, sy = 0;
    for (var i = 0; i < t.length; i++) {
      var dx = t[i][0] - p[0], dy = t[i][1] - p[1], d = sqrt(dx * dx + dy * dy);
      if (d < 1e-9) return null; // on a target: no direction
      sx += dx / d; sy += dy / d;
    }
    return sqrt(sx * sx + sy * sy);
  }
  function equalPulls(it) {
    if (!it || !it.targets || !it.gm) return false;
    var s = pullSum(it.targets, it.gm);
    return s !== null && s < 1e-3;
  }
  // The two segments joining opposite targets of four in convex position, and where they cross.
  function crossPoint(t) {
    if (!t || t.length !== 4) return null;
    var pairs = [[[0, 1], [2, 3]], [[0, 2], [1, 3]], [[0, 3], [1, 2]]];
    for (var k = 0; k < 3; k++) {
      var a = t[pairs[k][0][0]], b = t[pairs[k][0][1]], c = t[pairs[k][1][0]], d = t[pairs[k][1][1]];
      var den = (b[0] - a[0]) * (d[1] - c[1]) - (b[1] - a[1]) * (d[0] - c[0]);
      if (abs(den) < 1e-12) continue;
      var u = ((c[0] - a[0]) * (d[1] - c[1]) - (c[1] - a[1]) * (d[0] - c[0])) / den;
      var v = ((c[0] - a[0]) * (b[1] - a[1]) - (c[1] - a[1]) * (b[0] - a[0])) / den;
      if (u > 1e-9 && u < 1 - 1e-9 && v > 1e-9 && v < 1 - 1e-9) return { at: [a[0] + u * (b[0] - a[0]), a[1] + u * (b[1] - a[1])], pairs: pairs[k] };
    }
    return null;
  }
  function crossing(it) {
    var x = it && crossPoint(it.targets);
    if (!x || !it.gm) return false;
    return abs(x.at[0] - it.gm[0]) < 1e-3 && abs(x.at[1] - it.gm[1]) < 1e-3;
  }
  function onTarget(it) { return it.targets.some(function (t) { return t[0] === it.key.x && t[1] === it.key.y; }); }
  function sides(it, axis) {
    var k = axis ? it.key.y : it.key.x, lo = 0, hi = 0;
    it.targets.forEach(function (t) { if (t[axis] < k) lo++; else if (t[axis] > k) hi++; });
    return [lo, hi];
  }
  function farthestPullsHarder() { return false; } // equal pulls: never true (proved by equal-pulls)

  // The menu's statements. Wrong ones are true of some items and false of others, or name a habit the
  // exercise corrects; their words overlap the tips as much as the right ones do (the shortcut test).
  function distances(it, p) { return it.targets.map(function (t) { var dx = t[0] - p[0], dy = t[1] - p[1]; return sqrt(dx * dx + dy * dy); }); }
  function onClosestPair(it) { // the best spot lies on the segment joining the two closest targets
    var t = it.targets, best = null;
    for (var i = 0; i < t.length; i++) for (var j = i + 1; j < t.length; j++) {
      var d = (t[i][0] - t[j][0]) * (t[i][0] - t[j][0]) + (t[i][1] - t[j][1]) * (t[i][1] - t[j][1]);
      if (!best || d < best.d) best = { d: d, a: t[i], b: t[j] };
    }
    if (!best) return false;
    var g = it.gm, ax = best.b[0] - best.a[0], ay = best.b[1] - best.a[1], L2 = ax * ax + ay * ay;
    var u = ((g[0] - best.a[0]) * ax + (g[1] - best.a[1]) * ay) / L2;
    var px = best.a[0] + u * ax, py = best.a[1] + u * ay;
    return u >= 0 && u <= 1 && sqrt((g[0] - px) * (g[0] - px) + (g[1] - py) * (g[1] - py)) < 0.25;
  }
  var STATEMENTS = [
    { id: 'equal-pulls', text: 'Every target pulls on the best spot equally hard, however far it is.', test: equalPulls },
    { id: 'crossing', text: 'The lines joining opposite targets cross right at the best spot.', test: crossing },
    { id: 'far-harder', text: 'The farthest target pulls hardest, so the best spot lies near it.', test: farthestPullsHarder },
    { id: 'near-harder', text: 'A near target pulls on the best spot harder than a far target.', test: farthestPullsHarder },
    { id: 'group-harder', text: 'The close group pulls on the best spot harder than the lone targets.', test: farthestPullsHarder },
    { id: 'equal-lines', text: 'The lines from the best spot to the targets are near the same length.', test: function (it) { var d = distances(it, it.gm); return Math.max.apply(null, d) / Math.min.apply(null, d) < 1.05; } },
    { id: 'closest-pair', text: 'The best spot lies on the line joining the two nearest targets.', test: onClosestPair },
    { id: 'on-target', text: 'The best spot is right on one of the targets, where the pulls meet.', test: onTarget },
    { id: 'centre', text: 'The best spot is the dot in the middle, wherever the targets are.', test: function (it) { return it.key.x === CENTRE && it.key.y === CENTRE; } },
    { id: 'more-left', text: 'More of the targets lie to the left of the best spot than to its right.', test: function (it) { var s = sides(it, 0); return s[0] > s[1]; } },
    { id: 'more-above', text: 'More of the targets lie above the best spot than below it.', test: function (it) { var s = sides(it, 1); return s[0] > s[1]; } },
  ];

  /* ---------- the bridge set "Meeting point" (note T1 §4.2; homes on a town map, straight-line walks) ----------
     A bridge item: 4–6 homes (a rated Central Point layout at its easiest settings, whose average position is
     6 % or more worse than the best spot), four lettered spots from
     the good region (within 35 % of the best total) and "where should the friends meet so that their walks
     add up to the least?". The key is the best of the four by total straight-line distance; every other
     spot is 5–30 % worse; spots are at least a dot apart, never within half a dot of the average position
     (the Balance check stays untrained, PLAN Defaults) and never on a home. The three foils are chosen against six cheap pickers (the spot nearest the map's middle, the spot
     nearest a home, the spot in the middle of the four, the spot with most homes within a dot, the spot
     nearest the homes' average position, which is the habit the exercise corrects, and the spot with most
     homes within two dots, a coarse total that is reported as partial skill, not bounded): per item
     each picker's target is hit with probability ¼ and the foil set closest to those targets is kept, so
     each lands on the key about one time in four. validateBridge() re-derives everything apart. */
  function total(T, x, y) { var s = 0; for (var j = 0; j < T.length; j++) { var dx = x - T[j][0], dy = y - T[j][1]; s += sqrt(dx * dx + dy * dy); } return s; }
  function mean(T) { var x = 0, y = 0; T.forEach(function (t) { x += t[0]; y += t[1]; }); return [x / T.length, y / T.length]; }
  function d2(a, b) { var dx = a[0] - b[0], dy = a[1] - b[1]; return dx * dx + dy * dy; }
  // The cheap pickers, as a score per spot (lower is preferred); pick(it) takes the first best, acc() the
  // chance that the key is picked when ties are broken at random (what the generator balances).
  var SCORES = {
    middle: function (it, p) { return d2(p, [CENTRE, CENTRE]); },
    nearHome: function (it, p) { return Math.min.apply(null, it.homes.map(function (h) { return d2(p, h); })); },
    midSpots: function (it, p) { return d2(p, mean(it.spots)); },
    crowd: function (it, p) { return -it.homes.filter(function (h) { return d2(p, h) <= 4; }).length; },   // homes within a dot (Central Point's group radius)
    crowd2: function (it, p) { return -it.homes.filter(function (h) { return d2(p, h) <= 16; }).length; }, // within two dots: a coarse total, reported (partial skill)
    average: function (it, p) { return d2(p, mean(it.homes)); },
  };
  var PICKERS = {};
  Object.keys(SCORES).forEach(function (k) {
    PICKERS[k] = function (it) { var b = 0, bv = Infinity; it.spots.forEach(function (p, i) { var v = SCORES[k](it, p); if (v < bv - 1e-9) { bv = v; b = i; } }); return b; };
  });
  function accOf(k, it, keyIndex) {
    var v = it.spots.map(function (p) { return SCORES[k](it, p); }), best = Math.min.apply(null, v);
    var ties = v.filter(function (x) { return Math.abs(x - best) <= 1e-9; }).length;
    return Math.abs(v[keyIndex] - best) <= 1e-9 ? 1 / ties : 0;
  }
  function bridgeItem(seed) {
    var r = PX.rng(PX.rng.hash('bets-bridge-cp', seed >>> 0)), keys = Object.keys(SCORES);
    for (var attempt = 0; attempt < 60; attempt++) {
      var it = def.generate(PX.rng(r.u32()), { variant: 'exact', targets: r.int(0, 2), band: 0 });
      if (!it || it.fallback) continue;
      var T = it.targets, avg = mean(T), best = total(T, it.key.x, it.key.y), pool = [];
      if (total(T, avg[0], avg[1]) / best - 1 < 0.06) continue; // a layout whose average misleads (so spots near it can be foils)
      for (var y = 0; y <= 12; y++) for (var x = 0; x <= 12; x++) {
        if (T.some(function (t) { return t[0] === x && t[1] === y; }) || d2([x, y], avg) < 1) continue;
        if (total(T, x, y) / best - 1 <= 0.35) pool.push([x, y]);
      }
      if (pool.length < 8) continue;
      // the key: one of the best spots (within 4 % of the best total). The foils are the natural wrong
      // answers: the centre of the closest group of homes (it ignores the far homes' pulls), a spot on the
      // far side (the middle of the homes' box, or the average without the farthest home: it lets the far
      // homes pull too hard, without marking the average itself) and one more spot from the good region;
      // each 5–30 % worse than the key. Among the valid sets, the one closest to the pickers' targets.
      var near = pool.filter(function (q) { return total(T, q[0], q[1]) / best - 1 <= 0.04; });
      if (!near.length) continue;
      var key = near[r.int(0, near.length - 1)], kt = total(T, key[0], key[1]);
      function fits(q) { var e = total(T, q[0], q[1]) / kt - 1; return !!q && e >= 0.05 && e <= 0.30 && d2(q, key) >= 4 && d2(q, avg) >= 1 && !T.some(function (t) { return t[0] === q[0] && t[1] === q[1]; }); }
      function snap(x, y) { return [Math.max(0, Math.min(12, Math.round(x))), Math.max(0, Math.min(12, Math.round(y)))]; }
      var dense = null, top = -1, spread = Infinity;
      T.forEach(function (t) {
        var mem = T.filter(function (o) { return d2(t, o) <= 4 + 1e-9; }), sp = mem.reduce(function (a, o) { return a + Math.sqrt(d2(t, o)); }, 0);
        if (mem.length > top || (mem.length === top && sp < spread)) { top = mem.length; spread = sp; dense = snap(mean(mem)[0], mean(mem)[1]); }
      });
      var xs = T.map(function (t) { return t[0]; }), ys = T.map(function (t) { return t[1]; });
      var far = [snap((Math.min.apply(null, xs) + Math.max.apply(null, xs)) / 2, (Math.min.apply(null, ys) + Math.max.apply(null, ys)) / 2)];
      var dists = T.map(function (t) { return d2(t, avg); }), fi = dists.indexOf(Math.max.apply(null, dists));
      far.push(snap.apply(null, mean(T.filter(function (t, i) { return i !== fi; }))));
      var f1 = [dense].concat(pool.filter(function (q) { return d2(q, dense) <= 2; })).filter(fits);
      var f2 = far.concat(pool.filter(function (q) { return far.some(function (fq) { return d2(q, fq) <= 2; }); })).filter(fits);
      var f3 = pool.filter(fits);
      if (!f1.length || !f2.length || f3.length < 3) continue;
      var targets = {};
      keys.forEach(function (k) { targets[k] = r.chance(0.25) ? 1 : 0; });
      var bestSet = null, bestCost = Infinity;
      for (var tries = 0; tries < 600; tries++) {
        var f = [f1[r.int(0, f1.length - 1)], f2[r.int(0, f2.length - 1)], f3[r.int(0, f3.length - 1)]];
        if (d2(f[0], f[1]) < 4 || d2(f[0], f[2]) < 4 || d2(f[1], f[2]) < 4) continue;
        var spots = [key].concat(f), probe = { homes: T, spots: spots }, cost = 0;
        keys.forEach(function (kk) { cost += Math.abs(accOf(kk, probe, 0) - targets[kk]); });
        if (cost < bestCost) { bestCost = cost; bestSet = spots; if (!cost) break; }
      }
      if (!bestSet) continue;
      var order = r.shuffle([0, 1, 2, 3]);
      return { kind: 'cp-meet', seed: seed >>> 0, homes: T.map(function (t) { return t.slice(); }), spots: order.map(function (i) { return bestSet[i].slice(); }), key: order.indexOf(0) };
    }
    return null;
  }
  // Written apart from bridgeItem: totals with plain arithmetic, the key the unique minimum with a margin,
  // the spots' spacing, homes and the average position kept clear.
  function validateBridge(it) {
    try {
      if (!it || !Array.isArray(it.homes) || it.homes.length < 3 || !Array.isArray(it.spots) || it.spots.length !== 4) return 'shape';
      var tot = it.spots.map(function (p) { return it.homes.reduce(function (s, h) { return s + Math.hypot(p[0] - h[0], p[1] - h[1]); }, 0); });
      var k = tot.indexOf(Math.min.apply(null, tot));
      if (k !== it.key) return 'the key is not the spot with the least total';
      for (var i = 0; i < 4; i++) {
        if (i === k) continue;
        var e = tot[i] / tot[k] - 1;
        if (!(e >= 0.05 - 1e-9 && e <= 0.30 + 1e-9)) return 'a foil is not 5–30 % worse (' + e.toFixed(3) + ')';
      }
      var mx = 0, my = 0;
      it.homes.forEach(function (h) { mx += h[0]; my += h[1]; });
      mx /= it.homes.length; my /= it.homes.length;
      for (var a = 0; a < 4; a++) {
        var P = it.spots[a];
        if (Math.hypot(P[0] - mx, P[1] - my) < 1 - 1e-9) return 'a spot marks the average position';
        if (it.homes.some(function (h) { return h[0] === P[0] && h[1] === P[1]; })) return 'a spot is on a home';
        for (var b = a + 1; b < 4; b++) if (Math.hypot(P[0] - it.spots[b][0], P[1] - it.spots[b][1]) < 2 - 1e-9) return 'two spots are closer than a dot';
      }
      return true;
    } catch (e) { return 'threw: ' + e.message; }
  }
  var BRIDGE = {
    id: 'cp-meet',
    title: 'Meeting point',
    pairText: 'A town map and a Central Point board with the same layout.',
    map: { q: 'On the town map, what plays the part of the targets?', options: [
      { id: 'homes', text: 'The friends’ homes', right: true },
      { id: 'streets', text: 'The streets between them' },
      { id: 'spot', text: 'The meeting point' },
      { id: 'edge', text: 'The edge of the map' },
    ], line: 'The homes are the targets, the meeting point is the best spot, and each walk is one of the lines. The same rule holds: every home pulls equally hard, near or far.' },
    q: 'The friends want to meet at one of the lettered spots, so that their walks, in straight lines, add up to the least. Where?',
    uses: [
      { id: 'meet', text: 'Choosing a café or a park to meet friends' },
      { id: 'shared', text: 'Placing a shared printer, bin or first-aid kit' },
      { id: 'stop', text: 'Placing a bus stop or a delivery point' },
      { id: 'other', text: 'Somewhere else' },
    ],
    item: bridgeItem, validate: validateBridge, pickers: PICKERS, total: total,
  };

  B.register('centralpoint', {
    compare: {
      principles: [
        { id: 'equal-pulls', claim: 'equal-pulls', anyItem: true,
          text: 'At the best spot every target pulls equally hard, however far away it is, and the pulls cancel. A far target pulls no harder than a near one.',
          vary: function (p, r) { var q = { variant: p.variant, band: p.band, targets: r.int(0, 4) }; if (p.task !== undefined) q.task = p.task; return q; } },
        { id: 'crossing', claim: 'crossing', applies: function (p) { return !p || p.targets === 0; },
          text: 'With four targets, join each target to the one across from it: the best spot is where the two lines cross.' },
      ],
      statements: STATEMENTS,
    },
    offscreen: {
      id: 'cp-meet', title: 'Find a meeting point on a real map',
      text: 'Mark three to five homes on a printed or phone map, guess the spot with the shortest total walk, then check it.',
      steps: [
        'Mark where three to five friends live, or a few shops you visit; straight lines are enough.',
        'Before measuring, put a coin where you think the total straight-line walk is shortest.',
        'Measure each line from the coin with a ruler or the map’s distance tool and add them up; then try a spot a little to each side.',
        'Move one far home farther away along its own line and check whether the best spot moved.',
      ],
      note: 'Real meeting choices use roads and travel times, and often care about whoever travels farthest; whether practice here changes them has not been tested.',
    },
    bridge: { b: -0.35, sets: { 'cp-meet': BRIDGE } }, // b: the bridge items' difficulty (exact form, 4–6 targets, the widest band)
    facts: { pullSum: pullSum, crossPoint: crossPoint, equalPulls: equalPulls, crossing: crossing, sides: sides }, // the drawing and the tests
  });

})(window.PX);
