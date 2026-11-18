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
    facts: { pullSum: pullSum, crossPoint: crossPoint, equalPulls: equalPulls, crossing: crossing, sides: sides }, // the drawing and the tests
  });

})(window.PX);
