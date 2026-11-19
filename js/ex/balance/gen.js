/* PR-8 Balance (a Lab check, never trained; PLAN milestone 6; note T1 §5.2): the bet-specific check of Central
   Point's `calibrate` bet. Pure (ARCHITECTURE.md §5). Two kinds of item, one tap each:
     centroid  dots on a board: tap the balance point, where the board would balance on a pin if every dot weighed
               the same (the mean of the dots). Most dots sit in a cluster; two or three far dots on one side pull
               the balance point out of it.
     median    houses along a street: tap where the bus stop should go so that the total walk from all the houses
               to it is as short as possible (the middle house: the median). Most houses crowd one end.
   Central Point trains the point of least total distance. The calibrate bet predicts better bus stops and unchanged
   balance points; negative transfer would show as far dots losing weight in the balance points (note T1 §5.2, after
   Drew et al. 2010's robust and anti-robust weighting). So each answer also gives a pull t along the item's axis
   (score's value2):
     centroid  t = (r − core) · (c − core) / |c − core|², core the cluster's own mean: 1 = far dots at their full
               weight (the right answer), 0 = far dots ignored, above 1 = far dots overweighted;
     median    t = (x − m) / (μ − m): 0 = the middle house (right), 1 = the mean of the houses.
   Units: the board is 100 × 100 (x right, y down), the street runs 0–100. Right within TOL (centroid 5, median 3).
   Every cheap answer stays out of the band by at least TOL + 2 (CHEAP_GAP): the board's centre, the dots' bounding-box
   centre, the cluster's mean and the point of least total distance (centroid items); the street's middle, the mean of
   the houses and the midpoint of the two end houses (median items).
   Item (JSON): { ex: 'balance', seed, params: { variant, level }, answer: 'point',
     centroid: dots [[x, y], …] (shuffled), far: [indices of the far dots], key { x, y }, core { x, y };
     median: houses [x, …] (sorted), key { x, y: 0 } (the street is the line y = 0), mean μ;
     cheap: { <name>: point }, wrongResponse: a cheap answer (the tests' and PX.debug's wrong answer) }
   validate recomputes the key, the core or the mean and every cheap answer from the dots or the houses. */
(function (PX) {
  'use strict';

  var VARIANTS = ['centroid', 'median'];
  var FORMAT = 'balance:balance-point'; // reserved with 'balance:average-marker' (tests/node/formats.test.mjs)
  var TOL = { centroid: 5, median: 3 }, CHEAP_GAP = 2;
  var NC = [8, 10, 12], FAR = [2, 3, 3];          // centroid: dots, far dots per level
  var NM = [5, 7, 9];                             // median: houses per level
  var MIN_GAP = { centroid: 5, median: 4 };       // between dots, between houses
  var EDGE = 6, MIN_PULL = 10;                    // margin to the board's edge; |c − core| at least this
  var BASE = -0.3, STEP = 0.35, OFFSET = { centroid: 0, median: 0.6 };

  function isNum(x) { return typeof x === 'number' && isFinite(x); }
  function variantOf(params) { return params && VARIANTS.indexOf(params.variant) >= 0 ? params.variant : VARIANTS[0]; }
  function levelOf(params) { var l = params && params.level; return Number.isInteger(l) && l >= 0 && l <= 2 ? l : 0; }
  function cleanParams(params) { return { variant: variantOf(params), level: levelOf(params) }; }
  function dist(a, b) { return Math.sqrt((a[0] - b[0]) * (a[0] - b[0]) + (a[1] - b[1]) * (a[1] - b[1])); }
  function mean2(pts) {
    var x = 0, y = 0;
    pts.forEach(function (p) { x += p[0]; y += p[1]; });
    return [x / pts.length, y / pts.length];
  }
  function mean1(xs) { var s = 0; xs.forEach(function (x) { s += x; }); return s / xs.length; }
  function bboxCentre(pts) {
    var x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
    pts.forEach(function (p) { x0 = Math.min(x0, p[0]); x1 = Math.max(x1, p[0]); y0 = Math.min(y0, p[1]); y1 = Math.max(y1, p[1]); });
    return [(x0 + x1) / 2, (y0 + y1) / 2];
  }
  // The point of least total distance (Weiszfeld's iteration from the mean; a dot hit exactly is nudged).
  function leastTotal(pts) {
    var p = mean2(pts);
    for (var it = 0; it < 500; it++) {
      var nx = 0, ny = 0, w = 0;
      pts.forEach(function (q) {
        var d = Math.max(1e-7, dist(p, q));
        nx += q[0] / d; ny += q[1] / d; w += 1 / d;
      });
      var np = [nx / w, ny / w], moved = dist(np, p);
      p = np;
      if (moved < 1e-9) break;
    }
    return p;
  }
  function r2(x) { return Math.round(x * 100) / 100; }

  /* ---------- generate ---------- */
  function centroidOnce(r, level) {
    var n = NC[level], m = FAR[level], k = n - m, dots = [], tries;
    var cx = r.float(28, 72), cy = r.float(28, 72), sd = r.float(6, 8.5);
    function free(p) {
      if (p[0] < EDGE || p[0] > 100 - EDGE || p[1] < EDGE || p[1] > 100 - EDGE) return false;
      for (var i = 0; i < dots.length; i++) if (dist(dots[i], p) < MIN_GAP.centroid) return false;
      return true;
    }
    for (var i = 0; i < k; i++) {
      for (tries = 0; tries < 200; tries++) {
        var p = [r2(r.normal(cx, sd)), r2(r.normal(cy, sd))];
        if (free(p)) { dots.push(p); break; }
      }
      if (tries >= 200) return null;
    }
    var ang = r.float(0, 2 * Math.PI);
    for (var j = 0; j < m; j++) {
      for (tries = 0; tries < 100; tries++) {
        var a = ang + r.float(-0.6, 0.6), d = r.float(40, 56), q = [r2(cx + d * Math.cos(a)), r2(cy + d * Math.sin(a))];
        if (free(q)) { dots.push(q); break; }
      }
      if (tries >= 100) return null;
    }
    var core = mean2(dots.slice(0, k)), key = mean2(dots);
    if (dist(key, core) < MIN_PULL) return null;
    var order = r.shuffle(dots.map(function (p, i) { return i; }));
    var shuffled = order.map(function (i) { return dots[i]; }), far = [];
    order.forEach(function (i, at) { if (i >= k) far.push(at); });
    var cheap = cheapCentroid(shuffled, far);
    for (var c in cheap) if (dist(cheap[c], key) < TOL.centroid + CHEAP_GAP) return null;
    for (var q = 0; q < dots.length; q++) if (dist(dots[q], key) < TOL.centroid + 1) return null; // tapping a dot is never right
    return { dots: shuffled, far: far.sort(function (a, b) { return a - b; }), key: { x: r2(key[0]), y: r2(key[1]) }, core: { x: r2(core[0]), y: r2(core[1]) },
      cheap: roundCheap(cheap), wrongResponse: { x: r2(cheap.cluster[0]), y: r2(cheap.cluster[1]) } };
  }
  function cheapCentroid(dots, far) {
    var isFar = {};
    far.forEach(function (i) { isFar[i] = true; });
    var core = mean2(dots.filter(function (p, i) { return !isFar[i]; }));
    return { board: [50, 50], box: bboxCentre(dots), cluster: core, leastTotal: leastTotal(dots) };
  }
  function roundCheap(cheap) {
    var out = {};
    for (var k in cheap) out[k] = Array.isArray(cheap[k]) ? [r2(cheap[k][0]), r2(cheap[k][1])] : r2(cheap[k]);
    return out;
  }

  function medianOnce(r, level) {
    // the crowd: a majority of h + 1 to h + 3 houses (so the middle house is not always the crowd's inner edge)
    var n = NM[level], h = (n - 1) / 2, crowd = h + 1 + r.int(0, Math.min(2, h - 1)), houses = [], tries;
    var c0 = r.float(5, 12), w = r.float(4 * crowd, 4 * crowd + 10);
    function free(x) {
      if (x < 4 || x > 96) return false;
      for (var i = 0; i < houses.length; i++) if (Math.abs(houses[i] - x) < MIN_GAP.median) return false;
      return true;
    }
    for (var i = 0; i < n; i++) {
      for (tries = 0; tries < 200; tries++) {
        var x = i < crowd ? r2(r.float(c0, c0 + w)) : r2(r.float(Math.min(80, c0 + w + 30), 96));
        if (free(x)) { houses.push(x); break; }
      }
      if (tries >= 200) return null;
    }
    if (r.chance(0.5)) houses = houses.map(function (x) { return r2(100 - x); }); // the crowd at either end
    houses.sort(function (a, b) { return a - b; });
    var key = houses[h], mean = mean1(houses);
    if (Math.abs(mean - key) < 12) return null;
    var cheap = cheapMedian(houses);
    for (var c in cheap) if (Math.abs(cheap[c] - key) < TOL.median + CHEAP_GAP) return null;
    return { houses: houses, key: { x: key, y: 0 }, mean: r2(mean), cheap: roundCheap(cheap), wrongResponse: { x: r2(mean), y: 0 } };
  }
  function cheapMedian(houses) {
    return { street: 50, mean: mean1(houses), ends: (houses[0] + houses[houses.length - 1]) / 2 };
  }

  var stats = { tries: 0, nulls: 0, invalid: 0, fallbacks: 0, lastInvalid: null };
  function attempt(r, p) {
    stats.tries++;
    var core = p.variant === 'median' ? medianOnce(r, p.level) : centroidOnce(r, p.level);
    if (!core) { stats.nulls++; return null; }
    var item = { ex: 'balance', seed: 0, params: p, answer: 'point' };
    for (var k in core) item[k] = core[k];
    var ok = validate(item);
    if (ok !== true) { stats.invalid++; stats.lastInvalid = ok; return null; }
    return item;
  }
  function fallback(p) {
    stats.fallbacks++;
    for (var k = 0; k < 500; k++) {
      var item = attempt(PX.rng(PX.rng.hash('balance-fallback', p.variant, p.level, k)), p);
      if (item) { item.fallback = true; return item; }   // the engine voids fallback trials (ARCHITECTURE §5)
    }
    throw new Error('balance: no valid item could be built');
  }
  function generate(rng, params) {
    var p = cleanParams(params), item = null;
    for (var i = 0; i < 150 && !item; i++) item = attempt(i === 0 ? rng : rng.fork('retry' + i), p);
    if (!item) item = fallback(p);
    item.seed = rng.seed;
    item.params = params ? PX.util.deepCopy(params) : p;
    return item;
  }

  /* ---------- validate (from the dots or the houses alone) ---------- */
  function near(a, b, eps) { return Math.abs(a - b) <= (eps || 0.006); }
  function validate(item) {
    if (!item || item.ex !== 'balance') return 'not a balance item';
    var p = cleanParams(item.params), c;
    if (p.variant === 'median') {
      var hs = item.houses, n = NM[p.level];
      if (!Array.isArray(hs) || hs.length !== n || !hs.every(isNum)) return 'a street needs ' + n + ' houses';
      for (var i = 0; i < n; i++) {
        if (hs[i] < 4 || hs[i] > 96) return 'a house is off the street';
        if (i && hs[i] - hs[i - 1] < MIN_GAP.median - 1e-9) return 'two houses are too close (or not sorted)';
      }
      var key = hs[(n - 1) / 2], mean = mean1(hs);
      if (!item.key || item.key.x !== key || item.key.y !== 0) return 'the key is not the middle house';
      if (!near(item.mean, mean)) return 'the mean is wrong';
      if (Math.abs(mean - key) < 12) return 'the mean is too near the middle house';
      var cm = cheapMedian(hs);
      for (c in cm) if (Math.abs(cm[c] - key) < TOL.median + CHEAP_GAP) return 'the cheap answer "' + c + '" is right';
      // the middle house beats every other spot on the street (sum of distances, checked on a 0.25 grid)
      var best = Infinity, at = null;
      for (var x = 0; x <= 100; x += 0.25) {
        var s = 0;
        hs.forEach(function (h) { s += Math.abs(h - x); });
        if (s < best - 1e-9) { best = s; at = x; }
      }
      if (Math.abs(at - key) > 0.25) return 'the least total walk is not at the middle house';
      return true;
    }
    var dots = item.dots, nc = NC[p.level], far = item.far;
    if (!Array.isArray(dots) || dots.length !== nc) return 'a board needs ' + nc + ' dots';
    if (!Array.isArray(far) || far.length !== FAR[p.level]) return 'the board needs ' + FAR[p.level] + ' far dots';
    for (var a = 0; a < nc; a++) {
      var d = dots[a];
      if (!Array.isArray(d) || !isNum(d[0]) || !isNum(d[1])) return 'a dot is not a point';
      if (d[0] < EDGE || d[0] > 100 - EDGE || d[1] < EDGE || d[1] > 100 - EDGE) return 'a dot is off the board';
      for (var b = a + 1; b < nc; b++) if (dist(d, dots[b]) < MIN_GAP.centroid - 1e-9) return 'two dots overlap';
    }
    var cen = mean2(dots);
    if (!item.key || !near(item.key.x, cen[0]) || !near(item.key.y, cen[1])) return 'the key is not the mean of the dots';
    var cc = cheapCentroid(dots, far);
    if (!item.core || !near(item.core.x, cc.cluster[0]) || !near(item.core.y, cc.cluster[1])) return 'the core is not the mean of the cluster';
    if (dist(cen, cc.cluster) < MIN_PULL) return 'the far dots hardly pull';
    // far dots: each is farther from the cluster's mean than every cluster dot
    var maxCore = 0, minFar = Infinity;
    dots.forEach(function (q, i) { var dd = dist(q, cc.cluster); if (far.indexOf(i) >= 0) minFar = Math.min(minFar, dd); else maxCore = Math.max(maxCore, dd); });
    if (minFar <= maxCore + 5) return 'a far dot is not clearly apart from the cluster';
    for (c in cc) if (dist(cc[c], cen) < TOL.centroid + CHEAP_GAP) return 'the cheap answer "' + c + '" is right';
    for (var e = 0; e < nc; e++) if (dist(dots[e], cen) < TOL.centroid + 1) return 'a dot sits on the balance point';
    return true;
  }

  /* ---------- score ---------- */
  function pointOf(response) {
    if (Array.isArray(response) && isNum(response[0])) return response;
    if (response && isNum(response.x)) return [response.x, isNum(response.y) ? response.y : 0];
    if (isNum(response)) return [response, 0];
    return null;
  }
  // { correct, value: the distance from the key in board units, value2: the pull t, at: the answer, rounded }
  function score(item, response) {
    var r = pointOf(response);
    if (!r) return { correct: false };
    if (variantOf(item.params) === 'median') {
      var m = item.key.x, e = Math.abs(r[0] - m);
      return { correct: e <= TOL.median, value: Math.round(e * 10) / 10, value2: r2((r[0] - m) / (item.mean - m)), at: [r2(r[0])] };
    }
    var k = [item.key.x, item.key.y], c = [item.core.x, item.core.y], ax = [k[0] - c[0], k[1] - c[1]], L2 = ax[0] * ax[0] + ax[1] * ax[1];
    var err = dist(r, k), t = ((r[0] - c[0]) * ax[0] + (r[1] - c[1]) * ax[1]) / L2;
    return { correct: err <= TOL.centroid, value: Math.round(err * 10) / 10, value2: r2(t), at: [r2(r[0]), r2(r[1])] };
  }

  function difficulty(params) { var p = cleanParams(params); return BASE + OFFSET[p.variant] + STEP * p.level; }

  PX.ex.define({
    id: 'balance', version: 1, code: 'PR-8', name: 'Balance', short: 'Balance',
    abilities: ['Vz'], cell: 'extrinsic-static', role: 'probe', answer: 'point',
    format: FORMAT, // v1.2 (W2-measure): reserved formats, never in training material (tests/node/formats.test.mjs)
    variants: VARIANTS.slice(),
    cycle: 'variant',
    dims: [{ key: 'level', label: 'Level', levels: [0, 1, 2], step: STEP }],
    base: BASE, difficulty: difficulty,
    chance: function (params) { return variantOf(params) === 'median' ? 0.07 : 0.01; },
    timeLimit: function () { return 30000; },
    generate: generate, validate: validate, score: score,
    lib: { VARIANTS: VARIANTS, TOL: TOL, CHEAP_GAP: CHEAP_GAP, NC: NC, FAR: FAR, NM: NM, MIN_PULL: MIN_PULL, mean2: mean2, leastTotal: leastTotal,
      cheapCentroid: cheapCentroid, cheapMedian: cheapMedian, cleanParams: cleanParams, stats: stats, fallback: fallback },
  });
})(window.PX);
