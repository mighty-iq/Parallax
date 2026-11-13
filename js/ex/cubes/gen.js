/* EX-18 Painted Cubes: how many cubes have exactly N painted sides? (pure; ARCHITECTURE.md §5,
   docs/research/v1.1/R3-dat-pat.md §3.5, §8.4).

   The figure. Equal cubes stacked on a G × G grid as a height map heights[z][x] (x = 0 left …
   G − 1 right, z = 0 back … G − 1 front, y up; 1–4 high), with a 4-connected footprint: every
   cube stands on the ground or on another cube. The figure is painted on every exposed side
   except the bottom it rests on, so a cube's painted sides are its top (when nothing sits on it)
   and each of its four sides with no neighbour: 0–5. Cubes carry no marks at all: oriented marks
   on cubes belong to the Spatial Check's Cube Match probe (R3 §5.3).

   The view. A parallel (axonometric) projection from the front right, 31° round from the front
   and 33.5° above the ground. Not isometric: in true isometric a cube one step right, up and
   forward lands on the same spot, so a column can pass for a shorter one in front of it. At this
   angle no two lattice points of a 5 × 5 × 4 figure come closer than 0.35 cube edges on screen
   (the node test searches every pair). Faces are drawn in three tones with outlines.

   The rules the viewer relies on (taught in learn.js): the only hidden cubes are the ones needed
   to hold up others. So every column's top cube must be visible: validate renders the figure into
   a software z-buffer and requires at least half of every column's top face to show, so the
   visible tops fix every column's height and the figure has exactly one reading.

   The question. N is asked only when 1–5 cubes have exactly N painted sides (the format's no-zero
   rule); the options are 1, 2, 3, 4 and 5 cubes. Each item draws N from its class and the count k
   evenly from N's range at that size (KRANGE) first, then searches figures with exactly k such
   cubes, so neither N nor the figure's size points to an answer. The classic novice error, counting cubes that *show* N painted faces in
   the picture (Kurtuluş & Yolcu 2013), is held near chance: an item where that count equals the
   key is redrawn three times in four; counting visible cubes only, or counting the bottom of
   ground cubes as painted, are redrawn more than half the time.

   Dims (hand-set; refit from pooled exports): cubes 6–9, 10–13, 14–17, 18–22 (0.85: accuracy
   falls with more cubes and more hidden faces, Kurtuluş & Yolcu 2013; hidden supports come with
   size, since a figure whose every top shows hides only cubes under taller back columns, so they
   are not a separate dim: a "no hidden cube" level is out of reach above about ten cubes);
   tallest column 2, 3, 4 (0.3); asked N 3–4 or 1–2 (0.85: cubes with few painted sides sit inside
   the figure or under others, R3 §8.4). Base −2.3: the easiest item is about 90 % right at θ = 0
   with 5 options; the range is 4.0 logits.

   Section mode asks several questions about one figure: params.ask (an extra param, not a dim)
   picks the i-th question of item.asks (every N with a count of 1–5, in a seeded order) about the
   figure the seed draws, which does not depend on ask.

   Item: { ex: 'cubes', v: 1, seed, params, key, grid, heights, ask: N, count, asks, options:
   [1, 2, 3, 4, 5], hidden (cubes with no visible pixel) }. key = count − 1. */
(function (PX) {
  'use strict';

  var Mth = Math, floor = Mth.floor, abs = Mth.abs, sqrt = Mth.sqrt, isArray = Array.isArray, isInt = Number.isInteger;

  var CUBES = [[6, 9], [10, 13], [14, 17], [18, 22]];
  var HEIGHT = [2, 3, 4];
  var ASKED = ['many', 'few'];
  var ASK_OF = { many: [3, 4], few: [1, 2] };
  // The counts each question can have at each size (measured over random valid figures: every k in
  // the range turns up in at least 3 % of them). The key is drawn evenly from N's range, so the
  // question alone never points to an answer; N without a range of three or more is not asked.
  // N = 5 (all five sides painted) needs a column taller than all four neighbours, and figures
  // rarely hold more than two, so asking it would give the answer away: it is never asked.
  var KRANGE = [
    { 2: [1, 4], 3: [1, 5], 4: [1, 4] },                  // 6–9 cubes (one painted side: almost never)
    { 1: [1, 3], 2: [1, 5], 3: [1, 5], 4: [1, 5] },       // 10–13
    { 1: [1, 5], 2: [2, 5], 3: [2, 5], 4: [1, 5] },       // 14–17
    { 1: [1, 5], 2: [3, 5], 3: [3, 5], 4: [1, 5] },       // 18–22
  ];
  // Later questions about the same figure (Section mode, params.ask ≥ 1). NAT: how often each
  // count 1–5 turns up for a later question N at each size (per mille of the generator's figures,
  // all heights and classes pooled; measured over 6,000 items, B5.md). Only N in KRANGE at that
  // size with a count in its range is asked later, and it is kept with probability KEEP[size][N]
  // [count], which flattens the counts so that none is more than 28 % of that question's later
  // answers (a range of three counts is made even). So neither "1 cube" nor any other answer is
  // a safe guess for a later question (RV-dat-style-A §5).
  var NAT = [
    { 2: [360, 252, 117, 31, 0], 3: [183, 274, 263, 170, 76], 4: [76, 363, 389, 124, 4] },
    { 1: [400, 194, 49, 2, 0], 2: [109, 179, 259, 215, 130], 3: [37, 98, 221, 291, 204], 4: [100, 217, 323, 249, 91] },
    { 1: [212, 296, 228, 141, 25], 2: [26, 62, 101, 146, 238], 3: [3, 24, 102, 224, 268], 4: [95, 178, 306, 261, 121] },
    { 1: [50, 107, 188, 206, 229], 2: [3, 7, 27, 43, 98], 3: [1, 11, 44, 107, 201], 4: [84, 188, 257, 249, 155] },
  ];
  var LATER_MAX = 0.28;
  // The largest cap t with max(min(nat, t)) / Σ min(nat, t) ≤ smax (bisection; the share grows with t).
  function capFor(nat, smax) {
    var lo = Mth.min.apply(null, nat), hi = Mth.max.apply(null, nat);
    var share = function (t) { var s = 0; nat.forEach(function (v) { s += Mth.min(v, t); }); return Mth.min(hi, t) / s; };
    if (share(hi) <= smax) return hi;
    for (var i = 0; i < 50; i++) { var mid = (lo + hi) / 2; if (share(mid) <= smax + 1e-12) lo = mid; else hi = mid; }
    return lo;
  }
  var KEEP = KRANGE.map(function (KR, c) {
    var out = {};
    Object.keys(KR).forEach(function (key) {
      var n = +key, lo = KR[n][0], hi = KR[n][1], nat = NAT[c][n].slice(lo - 1, hi), keep = [0, 0, 0, 0, 0, 0];
      var cap = capFor(nat, Mth.max(LATER_MAX, 1 / nat.length));
      for (var j = lo; j <= hi; j++) keep[j] = Mth.min(1, cap / NAT[c][n][j - 1]);
      out[n] = keep;
    });
    return out;
  });
  var GRIDS = [[3, 4], [4], [4, 5], [5]];
  var OPTIONS = [1, 2, 3, 4, 5];
  var TOP_SHOW = 0.5, CLEAR = 0.2;
  var AZ = 31, EL = 33.5;
  // Camera basis (constants, so items are identical in every engine): d points from the figure to
  // the viewer; R is screen right, U screen up. Values for az 31°, el 33.5°.
  var D = [0.42948294849226226, 0.5519369853120581, 0.7147796591950765];
  var R = [0.8571673007021123, 0, -0.5150380749100542];
  var U = [-0.2842685623867813, 0.8338858220671682, -0.4731023358575983];
  var SCALE = 14; // raster pixels per cube edge (validator and generator checks)

  function rint(r, n) { return floor(r.next() * n); }
  function shuffle(r, arr) {
    var out = arr.slice();
    for (var i = out.length - 1; i > 0; i--) { var j = floor(r.next() * (i + 1)), t = out[i]; out[i] = out[j]; out[j] = t; }
    return out;
  }
  function normParams(params) {
    var p = {};
    [['cubes', CUBES], ['height', HEIGHT], ['asked', ASKED]].forEach(function (d) {
      var v = params ? params[d[0]] : 0;
      p[d[0]] = isInt(v) && v >= 0 && v < d[1].length ? v : 0;
    });
    if (params && isInt(params.ask) && params.ask >= 0) p.ask = params.ask;
    return p;
  }

  /* ---------- the model: painted sides by neighbour tests ---------- */

  function hAt(H, x, z) { var G = H.length; return x < 0 || z < 0 || x >= G || z >= G ? 0 : H[z][x]; }
  // Every cube as { x, y, z, painted, sides: [top, front +z, right +x, back −z, left −x] exposed }.
  function cubesOf(H) {
    var G = H.length, out = [];
    for (var z = 0; z < G; z++) for (var x = 0; x < G; x++) {
      for (var y = 0; y < H[z][x]; y++) {
        var s = [y === H[z][x] - 1, hAt(H, x, z + 1) <= y, hAt(H, x + 1, z) <= y, hAt(H, x, z - 1) <= y, hAt(H, x - 1, z) <= y];
        var n = 0;
        for (var k = 0; k < 5; k++) if (s[k]) n++;
        out.push({ x: x, y: y, z: z, painted: n, sides: s });
      }
    }
    return out;
  }
  function histogram(H) {
    var c = [0, 0, 0, 0, 0, 0];
    cubesOf(H).forEach(function (q) { c[q.painted]++; });
    return c;
  }
  function total(H) { var n = 0; H.forEach(function (row) { row.forEach(function (h) { n += h; }); }); return n; }
  function maxH(H) { var m = 0; H.forEach(function (row) { row.forEach(function (h) { if (h > m) m = h; }); }); return m; }
  function connected(H) {
    var G = H.length, seen = {}, stack = [], cells = 0, start = null, x, z;
    for (z = 0; z < G; z++) for (x = 0; x < G; x++) if (H[z][x] > 0) { cells++; if (!start) start = [x, z]; }
    if (!start) return false;
    stack.push(start); seen[start[0] + ',' + start[1]] = true;
    var reached = 0;
    while (stack.length) {
      var c = stack.pop();
      reached++;
      [[1, 0], [-1, 0], [0, 1], [0, -1]].forEach(function (d) {
        var nx = c[0] + d[0], nz = c[1] + d[1], k = nx + ',' + nz;
        if (hAt(H, nx, nz) > 0 && !seen[k]) { seen[k] = true; stack.push([nx, nz]); }
      });
    }
    return reached === cells;
  }

  /* ---------- the view: faces, projection and a software z-buffer ---------- */

  function proj(P) { return [P[0] * R[0] + P[1] * R[1] + P[2] * R[2], -(P[0] * U[0] + P[1] * U[1] + P[2] * U[2])]; }
  function depth(P) { return P[0] * D[0] + P[1] * D[1] + P[2] * D[2]; }
  // The exposed faces that turn towards the viewer (top, front, right), as 3D corner lists
  // [origin, edge u, edge v] with the cube index; painted faces only (every exposed face is).
  function facesOf(cubes) {
    var out = [];
    cubes.forEach(function (q, i) {
      var x = q.x, y = q.y, z = q.z;
      if (q.sides[0]) out.push({ cube: i, side: 0, o: [x, y + 1, z], u: [1, 0, 0], v: [0, 0, 1] });
      if (q.sides[1]) out.push({ cube: i, side: 1, o: [x, y, z + 1], u: [1, 0, 0], v: [0, 1, 0] });
      if (q.sides[2]) out.push({ cube: i, side: 2, o: [x + 1, y, z], u: [0, 0, 1], v: [0, 1, 0] });
    });
    return out;
  }
  // Visible pixels per face (z-buffer at SCALE px per edge; a pixel belongs to the nearest face
  // whose parallelogram contains its centre).
  function render(H) {
    var cubes = cubesOf(H), faces = facesOf(cubes), G = H.length;
    var x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    faces.forEach(function (f) {
      f.p0 = proj(f.o); f.pu = proj(f.u); f.pv = proj(f.v);
      var pts = [f.p0, [f.p0[0] + f.pu[0], f.p0[1] + f.pu[1]], [f.p0[0] + f.pv[0], f.p0[1] + f.pv[1]], [f.p0[0] + f.pu[0] + f.pv[0], f.p0[1] + f.pu[1] + f.pv[1]]];
      f.box = [Infinity, Infinity, -Infinity, -Infinity];
      pts.forEach(function (q) { f.box[0] = Mth.min(f.box[0], q[0]); f.box[1] = Mth.min(f.box[1], q[1]); f.box[2] = Mth.max(f.box[2], q[0]); f.box[3] = Mth.max(f.box[3], q[1]); });
      x0 = Mth.min(x0, f.box[0]); y0 = Mth.min(y0, f.box[1]); x1 = Mth.max(x1, f.box[2]); y1 = Mth.max(y1, f.box[3]);
      f.d0 = depth(f.o); f.du = depth(f.u); f.dv = depth(f.v);
      f.det = f.pu[0] * f.pv[1] - f.pu[1] * f.pv[0];
    });
    var W = Mth.ceil((x1 - x0) * SCALE) + 1, Ht = Mth.ceil((y1 - y0) * SCALE) + 1, n = W * Ht;
    var zb = new Float64Array(n), own = new Int32Array(n), i, f, px, py;
    for (i = 0; i < n; i++) { zb[i] = -Infinity; own[i] = -1; }
    for (var fi = 0; fi < faces.length; fi++) {
      f = faces[fi];
      var ax = Mth.max(0, floor((f.box[0] - x0) * SCALE)), bx = Mth.min(W - 1, Mth.ceil((f.box[2] - x0) * SCALE));
      var ay = Mth.max(0, floor((f.box[1] - y0) * SCALE)), by = Mth.min(Ht - 1, Mth.ceil((f.box[3] - y0) * SCALE));
      for (py = ay; py <= by; py++) {
        for (px = ax; px <= bx; px++) {
          var sx = x0 + (px + 0.5) / SCALE - f.p0[0], sy = y0 + (py + 0.5) / SCALE - f.p0[1];
          var a = (sx * f.pv[1] - sy * f.pv[0]) / f.det, b = (f.pu[0] * sy - f.pu[1] * sx) / f.det;
          if (a < 0 || a > 1 || b < 0 || b > 1) continue;
          var dz = f.d0 + a * f.du + b * f.dv, k = py * W + px;
          if (dz > zb[k] + 1e-9) { zb[k] = dz; own[k] = fi; }
        }
      }
    }
    var total0 = faces.map(function () { return 0; }), shown = faces.map(function () { return 0; });
    // a face's full area in pixels: |det| · SCALE²
    faces.forEach(function (fc, j) { total0[j] = abs(fc.det) * SCALE * SCALE; });
    for (i = 0; i < n; i++) if (own[i] >= 0) shown[own[i]]++;
    var perCube = cubes.map(function () { return { best: 0, any: 0, faces: [0, 0, 0] }; });
    faces.forEach(function (fc, j) {
      var frac = Mth.min(1, shown[j] / total0[j]), pc = perCube[fc.cube];
      pc.faces[fc.side] = frac;
      if (frac > pc.best) pc.best = frac;
      pc.any += shown[j];
    });
    return { cubes: cubes, faces: faces, perCube: perCube, G: G };
  }
  // What the picture shows: the top-face share of every column's top cube, the hidden cubes, and
  // how many painted faces each cube shows clearly (for the novice-error shortcut).
  function sight(H) {
    var rr = render(H), tops = [], hidden = 0, faint = 0, showN = [], hid = [];
    rr.cubes.forEach(function (q, i) {
      var pc = rr.perCube[i];
      if (q.sides[0]) tops.push(pc.faces[0]);
      if (pc.any === 0) hidden++; else if (pc.best < CLEAR) faint++;
      hid.push(pc.any === 0);
      var sN = 0;
      for (var s = 0; s < 3; s++) if (pc.faces[s] >= CLEAR) sN++;
      showN.push(sN);
    });
    return { minTop: tops.length ? Mth.min.apply(null, tops) : 0, hidden: hidden, faint: faint, showN: showN, hid: hid, cubes: rr.cubes };
  }

  /* ---------- generator ---------- */

  // A random figure: a connected footprint grown from a random cell, with columns raised more
  // often towards the back left. Tall columns at the back keep their tops in view over the front
  // ones, and the cubes under them become the hidden supports the format allows.
  function randomFigure(r, G, nLo, nHi, hMax) {
    var target = nLo + rint(r, nHi - nLo + 1), H = [], x, z;
    for (z = 0; z < G; z++) { H.push([]); for (x = 0; x < G; x++) H[z].push(0); }
    var cells = [[rint(r, G), rint(r, G)]];
    H[cells[0][1]][cells[0][0]] = 1;
    var count = 1, guard = 0;
    while (count < target && guard++ < 400) {
      // grow sideways (a new column) or up (a taller column)
      var up = r.next() < 0.5;
      if (up) {
        var c = cells[rint(r, cells.length)];
        var bias = (G - 1 - c[1]) + (G - 1 - c[0]);
        if (H[c[1]][c[0]] < hMax && r.next() < 0.35 + 0.65 * bias / (2 * (G - 1) || 1)) { H[c[1]][c[0]]++; count++; }
      } else {
        var from = cells[rint(r, cells.length)], d = [[1, 0], [-1, 0], [0, 1], [0, -1]][rint(r, 4)];
        var nx = from[0] + d[0], nz = from[1] + d[1];
        if (nx >= 0 && nz >= 0 && nx < G && nz < G && H[nz][nx] === 0) { H[nz][nx] = 1; cells.push([nx, nz]); count++; }
      }
    }
    return count === target ? H : null;
  }

  function figureOk(H, p) {
    var n = total(H), cr = CUBES[p.cubes];
    return n >= cr[0] && n <= cr[1] && maxH(H) === HEIGHT[p.height] && connected(H);
  }
  // Cubes that show exactly N painted faces in the picture (the novice error).
  function shownCount(s, N) { var c = 0; s.showN.forEach(function (v) { if (v === N) c++; }); return c; }

  // The question: N from the level's class, the count k evenly from N's range at this size.
  function question(r, p) {
    var KR = KRANGE[p.cubes], asks0 = ASK_OF[ASKED[p.asked]].filter(function (n) { return KR[n]; });
    var N = asks0[rint(r, asks0.length)], kr = KR[N];
    return [N, kr[0] + rint(r, kr[1] - kr[0] + 1)];
  }
  function build(r, p, N, k) {
    var Gs = GRIDS[p.cubes], cr = CUBES[p.cubes], hMax = HEIGHT[p.height];
    for (var t = 0; t < 400; t++) {
      var G = Gs[rint(r, Gs.length)];
      var H = randomFigure(r, G, cr[0], cr[1], hMax);
      if (!H || !figureOk(H, p)) continue;
      var hist = histogram(H);
      if (hist[N] !== k) continue;
      var s = sight(H);
      if (s.minTop < TOP_SHOW) continue;
      if (shownCount(s, N) === k && r.next() < 0.75) continue;
      // Two partial readings are held near chance as well: counting visible cubes only (the
      // hidden supports missed) and counting the bottom of ground cubes as painted.
      var visOnly = 0, bottom = 0;
      s.cubes.forEach(function (q, i) { if (q.painted === N && !s.hid[i]) visOnly++; if (q.painted + (q.y === 0 ? 1 : 0) === N) bottom++; });
      if (visOnly === k && r.next() < 0.6) continue;
      if (bottom === k && r.next() < 0.5) continue;
      return finish(r, p, H, N, hist, s.hidden);
    }
    return null;
  }
  // The question list (Section mode) and the item; ask (params.ask) re-asks about the same figure.
  // Later questions: N in KRANGE at this size with a count in its range, kept by KEEP (see NAT).
  function finish(r, p, H, N, hist, hidden) {
    var KR = KRANGE[p.cubes], keep = KEEP[p.cubes], asks = [N];
    shuffle(r, Object.keys(KR).map(Number)).forEach(function (n) {
      var c = hist[n];
      if (n !== N && c >= KR[n][0] && c <= KR[n][1] && r.next() < keep[n][c]) asks.push(n);
    });
    var ask = isInt(p.ask) ? asks[p.ask % asks.length] : N;
    return {
      ex: 'cubes', v: 1, seed: 0, params: p, key: hist[ask] - 1, grid: H.length, heights: H.map(function (row) { return row.slice(); }),
      ask: ask, count: hist[ask], asks: asks, options: OPTIONS.slice(), hidden: hidden,
    };
  }

  // N and k are drawn once and kept across retries (only the figure search is retried), so hard
  // counts are not under-represented in any level (RV-dat-style-A §12).
  function generate(rng, params) {
    var p = normParams(params), q = question(rng, p), item;
    for (var i = 0; i < 50; i++) {
      item = build(i === 0 ? rng : rng.fork('retry' + i), p, q[0], q[1]);
      if (item) { item.seed = rng.seed; if (validate(item) === true) return item; }
    }
    item = fallbackFor(p);
    item.seed = rng.seed;
    return item;
  }
  var fallbackCache = {};
  function fallbackFor(params) {
    var p = normParams(params), base = { cubes: p.cubes, height: p.height, asked: p.asked }, pk = PX.ex.paramsKey(base);
    for (var i = 0; i < 300 && !fallbackCache[pk]; i++) {
      var r = PX.rng(PX.rng.hash('cubes-fallback', pk, i)), q = question(r, base), it = build(r, base, q[0], q[1]);
      if (it && validate(it) === true) fallbackCache[pk] = it;
    }
    var out = PX.util.deepCopy(fallbackCache[pk]);
    if (isInt(p.ask)) { out.params.ask = p.ask; out.ask = out.asks[p.ask % out.asks.length]; out.count = histogram(out.heights)[out.ask]; out.key = out.count - 1; }
    out.fallback = true;
    return out;
  }

  /* ---------- validator ---------- */

  // The validator's own view, independent of the generator's z-buffer (R3 §8.4; RV-dat-style-A
  // §13): a ray cast. From RAYS × RAYS points on each face that turns towards the viewer, a ray
  // runs towards the viewer (D, which points right, up and to the front); it is blocked when it
  // crosses a column's footprint below that column's top (the ray climbs, so inside a footprint it
  // is lowest where it enters). Returns the smallest share of a column top in view and the number
  // of cubes with no ray getting out.
  var RAYS = 8, EPS_RAY = 1e-7;
  function blocked(H, px, py, pz) {
    var G = H.length, x0 = Mth.max(0, floor(px)), z0 = Mth.max(0, floor(pz));
    for (var z = z0; z < G; z++) for (var x = x0; x < G; x++) {
      var h = H[z][x];
      if (!h) continue;
      var tIn = Mth.max(0, (x - px) / D[0], (z - pz) / D[2]), tOut = Mth.min((x + 1 - px) / D[0], (z + 1 - pz) / D[2]);
      if (tIn < tOut && py + tIn * D[1] < h) return true;
    }
    return false;
  }
  // Rays out of one face (side 0 top, 1 front, 2 right) of the cube at x, y, z: how many are free.
  function freeRays(H, x, y, z, side, stopAtOne) {
    var free = 0;
    for (var i = 0; i < RAYS; i++) for (var j = 0; j < RAYS; j++) {
      var a = (i + 0.5) / RAYS, b = (j + 0.5) / RAYS, P;
      if (side === 0) P = [x + a, y + 1 + EPS_RAY, z + b];
      else if (side === 1) P = [x + a, y + b, z + 1 + EPS_RAY];
      else P = [x + 1 + EPS_RAY, y + a, z + b];
      if (!blocked(H, P[0], P[1], P[2])) { free++; if (stopAtOne) return 1; }
    }
    return free;
  }
  function rayView(H) {
    var G = H.length, minTop = 1, hidden = 0;
    for (var z = 0; z < G; z++) for (var x = 0; x < G; x++) {
      var h = H[z][x];
      if (!h) continue;
      minTop = Mth.min(minTop, freeRays(H, x, h - 1, z, 0, false) / (RAYS * RAYS));
      // A column's top cube shows its top (held to TOP_SHOW above); the others show a front or a
      // right side or nothing.
      for (var y = 0; y < h - 1; y++) {
        if (!((hAt(H, x, z + 1) <= y && freeRays(H, x, y, z, 1, true)) || (hAt(H, x + 1, z) <= y && freeRays(H, x, y, z, 2, true)))) hidden++;
      }
    }
    return { minTop: minTop, hidden: hidden };
  }

  function validate(item) {
    try { return check(item); } catch (e) { return 'validate threw: ' + (e && e.message); }
  }
  function check(item) {
    if (!item || item.ex !== 'cubes') return 'not a cubes item';
    var p = item.params || {};
    if (!(isInt(p.cubes) && p.cubes >= 0 && p.cubes < CUBES.length && isInt(p.height) && p.height >= 0 && p.height < HEIGHT.length && isInt(p.asked) && p.asked >= 0 && p.asked < ASKED.length)) return 'bad params';
    var H = item.heights, G = item.grid;
    if (!isInt(G) || GRIDS[p.cubes].indexOf(G) < 0 || !isArray(H) || H.length !== G) return 'grid size';
    for (var z = 0; z < G; z++) {
      if (!isArray(H[z]) || H[z].length !== G) return 'grid row ' + z;
      for (var x = 0; x < G; x++) if (!isInt(H[z][x]) || H[z][x] < 0 || H[z][x] > 4) return 'height at ' + x + ',' + z;
    }
    var n = total(H), cr = CUBES[p.cubes];
    if (n < cr[0] || n > cr[1]) return n + ' cubes, expected ' + cr[0] + '–' + cr[1];
    if (maxH(H) !== HEIGHT[p.height]) return 'tallest column ' + maxH(H) + ', expected ' + HEIGHT[p.height];
    if (!connected(H)) return 'the footprint is not one piece';
    // Painted sides, recounted cube by cube from the voxels with neighbour tests.
    var counts = [0, 0, 0, 0, 0, 0];
    for (z = 0; z < G; z++) for (x = 0; x < G; x++) for (var y = 0; y < H[z][x]; y++) {
      var c = 0;
      if (y + 1 >= H[z][x]) c++;                       // top: nothing above
      if (!(hAt(H, x, z + 1) > y)) c++;                // front
      if (!(hAt(H, x, z - 1) > y)) c++;                // back
      if (!(hAt(H, x + 1, z) > y)) c++;                // right
      if (!(hAt(H, x - 1, z) > y)) c++;                // left (the bottom is never painted)
      counts[c]++;
    }
    var N = item.ask;
    if (!isInt(N) || N < 1 || N > 5) return 'asked N out of 1–5';
    if (counts[N] < 1 || counts[N] > 5) return counts[N] + ' cubes have ' + N + ' painted sides (must be 1–5)';
    if (item.count !== counts[N]) return 'stated count differs from the recount';
    if (!(isInt(item.key) && item.key === counts[N] - 1)) return 'key does not match the recount';
    if (!isArray(item.options) || item.options.join() !== '1,2,3,4,5') return 'options must be 1–5 cubes';
    // The questions: the first from the level's class, later ones (Section mode) any N in KRANGE
    // at this size with a count in its range; all different, never N = 5.
    var KR = KRANGE[p.cubes], asks = item.asks, seenN = {};
    if (!isArray(asks) || !asks.length) return 'asks';
    if (ASK_OF[ASKED[p.asked]].indexOf(asks[0]) < 0 || !KR[asks[0]]) return 'N ' + asks[0] + ' not asked at this level';
    for (var a = 0; a < asks.length; a++) {
      var na = asks[a];
      if (!isInt(na) || seenN[na] || !KR[na] || counts[na] < KR[na][0] || counts[na] > KR[na][1]) return 'asks: N ' + na;
      seenN[na] = true;
    }
    if (N !== (isInt(p.ask) ? asks[p.ask % asks.length] : asks[0])) return 'the asked N is not the question params.ask picks';
    // The picture: every column's top at least half visible, so the tops fix every height and
    // the only hidden cubes are supports.
    var s = rayView(H);
    if (s.minTop < TOP_SHOW) return 'a column top is only ' + (100 * s.minTop).toFixed(0) + ' % visible (ray cast)';
    if (item.hidden !== s.hidden) return 'stated hidden count differs from the ray cast (' + s.hidden + ')';
    return true;
  }

  function score(item, response) { return { correct: isInt(response) && response === item.key }; }

  PX.ex.define({
    id: 'cubes', version: 1, code: 'EX-18', name: 'Painted cubes', short: 'Painted Cubes',
    abilities: ['Vz'], cell: 'intrinsic-static', role: 'train', pat: true,
    answer: 'choice', nOptions: 5,
    extraParams: ['ask'],
    dims: [
      { key: 'cubes', label: 'Cubes', levels: ['6–9', '10–13', '14–17', '18–22'], step: 0.85 },
      { key: 'height', label: 'Tallest column', levels: HEIGHT, step: 0.3 },
      { key: 'asked', label: 'Painted sides asked', levels: ['3–4', '1–2'], step: 0.85 },
    ],
    base: -2.3,
    chance: 0.2,
    generate: generate,
    validate: validate,
    score: score,
    lib: {
      CUBES: CUBES, HEIGHT: HEIGHT, ASKED: ASKED, ASK_OF: ASK_OF, KRANGE: KRANGE, GRIDS: GRIDS, AZ: AZ, EL: EL, D: D, R: R, U: U,
      cubesOf: cubesOf, histogram: histogram, total: total, connected: connected, proj: proj, depth: depth, facesOf: facesOf,
      render: render, sight: sight, rayView: rayView, shownCount: shownCount, norm: normParams, fallback: fallbackFor, KEEP: KEEP, NAT: NAT,
    },
  });
})(window.PX);
