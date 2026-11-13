/* EX-07 Views: orthographic projection of block structures (pure; ARCHITECTURE.md §5, PLAN.md §3,
   research/B-tasks.md §6 and §14c). Sorby's orthographic-projection modules; formats our own.

   Structures: 4–12 unit cubes on a 3 × 3 or 4 × 4 grid, every cube on the ground or on another cube,
   stored as a height map heights[z][x] (x = 0 left … G − 1 right, z = 0 back … G − 1 front, y up;
   at most 4 high) with a 4-connected footprint. The view draws them isometrically from the front-
   right-top corner (camera on +x, +y, +z: the front, +z, faces lower left; the right side, +x,
   faces lower right).

   Variants
     toview    the structure is shown; which line drawing is its top / front / right view?
     toobject  the top, front and right views are shown; which structure is it?
     count     the structure is shown; how many cubes? (every cube shows a whole face)

   Orthographic views (third-angle conventions): top from +y with the front at the bottom; front from
   +z (x to the right); right from +x (the front, +z, on the left); back and left are foils. A drawing
   is cropped to its filled cells and has unit edges wherever the nearness to the viewer changes
   between neighbouring cells (the silhouette included). Items carry drawing = { w, h, lines, area }:
   w × h cells, lines merged into maximal segments [x0, y0, x1, y1] in cells (origin bottom left, y
   up), area = filled cells. Internally a drawing also holds v[j][i] (the vertical edge left of cell
   (i, j)) and hz[j][i] (the horizontal edge below it) and a code for comparisons.

   Foils come from a family: a hidden structure and its variants (cubes moved, columns swapped, one
   cube more or fewer, re-heighted plateaus), every one with all cubes showing a whole face. The key
   is drawn from the family too, so it is neither the structure the others came from nor the
   simplest one, and the options are siblings.
     toview    the view from another direction ('direction'), the mirrored view ('mirror'), the view
               of a sibling structure ('neighbour', never a single-column edit of the key); each
               differs from the key by at least 5 unit edges and from the others by 3.
     toobject  siblings matching one or two of the three views ('match1', 'match2'), with at most one
               cube more or fewer than the key; isometric pictures pairwise different.
     count     four of the five numbers in the level's window (N is drawn from the same window), so
               neither the middle option nor the level's typical count gives the answer away.
   Foil sets are chosen per item so that the cheap shortcut solvers land on the key about one time in
   four over the pool (BAL).

   validate (independent): rebuilds the voxels and casts rays through them for every view and for
   isometric visibility; exactly one option matches; foils differ visibly; for count every cube shows
   a whole face and the key is the voxel count.

   Item: { ex: 'views', seed, params, variant, key, grid, heights (the shown or the key structure),
           iso: { from: [1, 1, 1] }, view?: 'top'|'front'|'right' (toview), views?: { top, front,
           right } (toobject stem), options: toview [{ kind, drawing }] | toobject [{ kind, heights,
           matches: [view names] }] | count [numbers, ascending] }
   PX.ex.get('views').lib exposes the model for the view and tests. */
(function (PX) {
  'use strict';
  var Mth = Math, INF = 1 / 0;

  // Integers, picks and shuffles drawn from rng.next() (the same sequence on every platform; the bias
  // against 2^32 is below 10^-8 for these small ranges).
  function rint(rng, lo, hi) { return lo + Mth.floor(rng.next() * (hi - lo + 1)); }
  function rpick(rng, arr) { return arr.length ? arr[rint(rng, 0, arr.length - 1)] : undefined; }
  function rshuffle(rng, arr) {
    var out = arr.slice();
    for (var i = out.length - 1; i > 0; i--) { var j = rint(rng, 0, i), t = out[i]; out[i] = out[j]; out[j] = t; }
    return out;
  }

  var HMAX = 4;
  var DIRS = ['top', 'front', 'right', 'back', 'left'];
  var ASKED = ['top', 'front', 'right'];
  var CUBES = [4, 6, 8, 10, 12];

  /* ------------------------------------------------------------ height maps */
  function zeros(G) { var h = []; for (var z = 0; z < G; z++) { h.push([]); for (var x = 0; x < G; x++) h[z].push(0); } return h; }
  function copyH(h) { return h.map(function (r) { return r.slice(); }); }
  function total(h) { var s = 0; h.forEach(function (r) { r.forEach(function (v) { s += v; }); }); return s; }
  function footprint(h) { var s = 0; h.forEach(function (r) { r.forEach(function (v) { if (v > 0) s++; }); }); return s; }
  var CSEEN = new Uint8Array(16), CSTACK = new Int32Array(16);
  function connected(h) {
    var G = h.length, n = 0, start = -1, z, x;
    for (z = 0; z < G; z++) for (x = 0; x < G; x++) if (h[z][x] > 0) { n++; if (start < 0) start = z * G + x; }
    if (start < 0) return false;
    CSEEN.fill(0);
    var top = 0, got = 0;
    CSTACK[top++] = start; CSEEN[start] = 1;
    while (top) {
      var c = CSTACK[--top], cz = (c / G) | 0, cx = c - cz * G;
      got++;
      if (cz > 0 && !CSEEN[c - G] && h[cz - 1][cx] > 0) { CSEEN[c - G] = 1; CSTACK[top++] = c - G; }
      if (cz < G - 1 && !CSEEN[c + G] && h[cz + 1][cx] > 0) { CSEEN[c + G] = 1; CSTACK[top++] = c + G; }
      if (cx > 0 && !CSEEN[c - 1] && h[cz][cx - 1] > 0) { CSEEN[c - 1] = 1; CSTACK[top++] = c - 1; }
      if (cx < G - 1 && !CSEEN[c + 1] && h[cz][cx + 1] > 0) { CSEEN[c + 1] = 1; CSTACK[top++] = c + 1; }
    }
    return got === n;
  }
  // Translated so the footprint starts at x = 0, z = 0 (structures are compared in this form).
  function normH(h) {
    var G = h.length, mx = G, mz = G, z, x;
    for (z = 0; z < G; z++) for (x = 0; x < G; x++) if (h[z][x] > 0) { if (x < mx) mx = x; if (z < mz) mz = z; }
    var out = zeros(G);
    for (z = mz; z < G; z++) for (x = mx; x < G; x++) out[z - mz][x - mx] = h[z][x];
    return out;
  }
  // A number for the normalised structure (base-5 digits, row by row): equal for translations.
  function keyH(h) {
    var G = h.length, mx = G, mz = G, z, x, k = G;
    for (z = 0; z < G; z++) for (x = 0; x < G; x++) if (h[z][x] > 0) { if (x < mx) mx = x; if (z < mz) mz = z; }
    for (z = 0; z < G; z++) for (x = 0; x < G; x++) k = k * 5 + (z + mz < G && x + mx < G ? h[z + mz][x + mx] : 0);
    return k;
  }
  // L1 distance of two structures in normalised form.
  function hdist(a, b) {
    var A = normH(a), B = normH(b), s = 0;
    for (var z = 0; z < A.length; z++) for (var x = 0; x < A.length; x++) s += Mth.abs(A[z][x] - B[z][x]);
    return s;
  }

  // A 4-connected footprint of F cells grown from a random cell, each new cell drawn from the
  // frontier (empty cells next to the footprint).
  function randomFootprint(rng, G, F) {
    var h = zeros(G), cells = [[rint(rng, 0, G - 1), rint(rng, 0, G - 1)]];
    h[cells[0][0]][cells[0][1]] = 1;
    while (cells.length < F) {
      var front = [];
      for (var z = 0; z < G; z++) for (var x = 0; x < G; x++) if (!h[z][x] && adjacent(h, z, x)) front.push([z, x]);
      var c = rpick(rng, front);
      h[c[0]][c[1]] = 1; cells.push(c);
    }
    return { h: h, cells: cells };
  }
  // A random structure of N cubes on a G × G grid: a footprint of F cells, every column at least one
  // high, the rest stacked at random (at most HMAX high).
  function randomStructure(rng, G, N) {
    var Fmin = Mth.max(2, Mth.ceil(N / 3)), Fmax = Mth.min(N - 1, G * G);
    if (Fmin > Fmax) Fmin = Fmax;
    var fp = randomFootprint(rng, G, rint(rng, Fmin, Fmax)), h = fp.h, cells = fp.cells;
    for (var k = cells.length; k < N; k++) {
      var open = cells.filter(function (q) { return h[q[0]][q[1]] < HMAX; });
      var q = rpick(rng, open);
      h[q[0]][q[1]]++;
    }
    return h;
  }

  /* ------------------------------------------------------------ orthographic views */
  // Depth image of a view: near[j][i] (−1 empty), image width W and height Hh, from the height map.
  function depthImage(h, dir) {
    var G = h.length, img = [], i, j, z, x, best;
    if (dir === 'top') {
      for (j = 0; j < G; j++) { img.push([]); for (i = 0; i < G; i++) { var v = h[G - 1 - j][i]; img[j].push(v > 0 ? v : -1); } }
      return img;
    }
    for (j = 0; j < HMAX; j++) {
      img.push([]);
      for (i = 0; i < G; i++) {
        best = -1;
        if (dir === 'front') { x = i; for (z = 0; z < G; z++) if (h[z][x] > j) best = z; }
        else if (dir === 'back') { x = G - 1 - i; for (z = G - 1; z >= 0; z--) if (h[z][x] > j) best = G - 1 - z; }
        else if (dir === 'right') { z = G - 1 - i; for (x = 0; x < G; x++) if (h[z][x] > j) best = x; }
        else if (dir === 'left') { z = i; for (x = G - 1; x >= 0; x--) if (h[z][x] > j) best = G - 1 - x; }
        img[j].push(best);
      }
    }
    return img;
  }
  // Cropped line drawing of a depth image.
  function drawing(img) {
    var Hh = img.length, W = img[0].length, i0 = W, i1 = -1, j0 = Hh, j1 = -1, i, j, area = 0;
    for (j = 0; j < Hh; j++) for (i = 0; i < W; i++) if (img[j][i] >= 0) { area++; if (i < i0) i0 = i; if (i > i1) i1 = i; if (j < j0) j0 = j; if (j > j1) j1 = j; }
    var w = i1 - i0 + 1, hh = j1 - j0 + 1;
    function at(ii, jj) { return ii < 0 || jj < 0 || ii >= w || jj >= hh ? -1 : img[jj + j0][ii + i0]; }
    var v = [], hz = [];
    for (j = 0; j < hh; j++) { v.push([]); for (i = 0; i <= w; i++) v[j].push(at(i - 1, j) !== at(i, j) ? 1 : 0); }
    for (j = 0; j <= hh; j++) { hz.push([]); for (i = 0; i < w; i++) hz[j].push(at(i, j - 1) !== at(i, j) ? 1 : 0); }
    return finishDrawing({ w: w, h: hh, v: v, hz: hz, area: area });
  }
  // Merged segments and the canonical code.
  function finishDrawing(d) {
    var lines = [], i, j, s;
    for (i = 0; i <= d.w; i++) { // vertical lines at x = i
      for (j = 0; j < d.h; j++) {
        if (!d.v[j][i]) continue;
        s = j; while (j + 1 < d.h && d.v[j + 1][i]) j++;
        lines.push([i, s, i, j + 1]);
      }
    }
    for (j = 0; j <= d.h; j++) { // horizontal lines at y = j
      for (i = 0; i < d.w; i++) {
        if (!d.hz[j][i]) continue;
        s = i; while (i + 1 < d.w && d.hz[j][i + 1]) i++;
        lines.push([s, j, i + 1, j]);
      }
    }
    d.lines = lines;
    d.code = d.w + 'x' + d.h + ':' + d.v.map(function (r) { return r.join(''); }).join('') + ':' + d.hz.map(function (r) { return r.join(''); }).join('');
    return d;
  }
  function view(h, dir) { return drawing(depthImage(h, dir)); }
  // The canonical code of a view only (no merged lines): for comparing many candidate structures.
  function viewCode(h, dir) {
    var img = depthImage(h, dir), Hh = img.length, W = img[0].length, i0 = W, i1 = -1, j0 = Hh, j1 = -1, i, j;
    for (j = 0; j < Hh; j++) for (i = 0; i < W; i++) if (img[j][i] >= 0) { if (i < i0) i0 = i; if (i > i1) i1 = i; if (j < j0) j0 = j; if (j > j1) j1 = j; }
    var w = i1 - i0 + 1, hh = j1 - j0 + 1, a = '', b = '';
    function at(ii, jj) { return ii < 0 || jj < 0 || ii >= w || jj >= hh ? -1 : img[jj + j0][ii + i0]; }
    for (j = 0; j < hh; j++) for (i = 0; i <= w; i++) a += at(i - 1, j) !== at(i, j) ? '1' : '0';
    for (j = 0; j <= hh; j++) for (i = 0; i < w; i++) b += at(i, j - 1) !== at(i, j) ? '1' : '0';
    return w + 'x' + hh + ':' + a + ':' + b;
  }
  function mirror(d) {
    var v = d.v.map(function (r) { return r.slice().reverse(); }), hz = d.hz.map(function (r) { return r.slice().reverse(); });
    return finishDrawing({ w: d.w, h: d.h, v: v, hz: hz, area: d.area });
  }
  function edgeCount(d) { var s = 0; d.v.forEach(function (r) { r.forEach(function (b) { s += b; }); }); d.hz.forEach(function (r) { r.forEach(function (b) { s += b; }); }); return s; }
  // Unit edges present in one drawing and not the other, both placed at the bottom-left corner.
  function ddist(a, b) {
    var W = Mth.max(a.w, b.w), H = Mth.max(a.h, b.h), s = 0, i, j;
    function vb(d, ii, jj) { return jj < d.h && ii <= d.w ? d.v[jj][ii] : 0; }
    function hb(d, ii, jj) { return jj <= d.h && ii < d.w ? d.hz[jj][ii] : 0; }
    for (j = 0; j < H; j++) for (i = 0; i <= W; i++) if (vb(a, i, j) !== vb(b, i, j)) s++;
    for (j = 0; j <= H; j++) for (i = 0; i < W; i++) if (hb(a, i, j) !== hb(b, i, j)) s++;
    return s;
  }
  // What the item stores for a drawing (the view draws lines; the validator re-derives the rest).
  function pub(d) { return { w: d.w, h: d.h, lines: d.lines, area: d.area }; }

  /* ------------------------------------------------------------ isometric visibility */
  // Camera on +x +y +z. A vertex (x, y, z) projects to the lattice point (p, q) = (x − z, 2y − x − z);
  // the cube at (x, y, z) covers six lattice triangles around C = the projection of its (x, y, z) and
  // (x + 1, y + 1, z + 1) corners. Each lattice triangle shows the nearest cube covering it (largest
  // x + y + z; cubes at equal depth never overlap). Faces: 0 top (+y), 1 right (+x), 2 front (+z);
  // two triangles each, given as vertex offsets from C.
  var TRI = [
    [[[-1, 1], [0, 2]], [[0, 2], [1, 1]]],
    [[[1, 1], [1, -1]], [[1, -1], [0, -2]]],
    [[[0, -2], [-1, -1]], [[-1, -1], [-1, 1]]],
  ];
  function cubesOf(h) {
    var out = [];
    for (var z = 0; z < h.length; z++) for (var x = 0; x < h.length; x++) for (var y = 0; y < h[z][x]; y++) out.push([x, y, z]);
    return out;
  }
  // Triangle keys 3 × centroid = (3p0 + a, 3q0 + b) are mapped to cells of a flat array: u in
  // −16 … 16, v in −40 … 32 for grids up to 4 and heights up to 4.
  var UW = 33, VOFF = 40, VH = 73, OWN_D = new Int16Array(UW * VH), OWN_C = new Int16Array(UW * VH);
  function triIndex(p0, q0, f, t) { var A = TRI[f][t][0], B = TRI[f][t][1]; return (3 * p0 + A[0] + B[0] + 16) * VH + (3 * q0 + A[1] + B[1] + VOFF); }
  function isoOwners(h) {
    var cubes = cubesOf(h), own = new Map(), used = [];
    OWN_D.fill(-1);
    cubes.forEach(function (c, ci) {
      var p0 = c[0] - c[2], q0 = 2 * c[1] - c[0] - c[2], d = c[0] + c[1] + c[2];
      for (var f = 0; f < 3; f++) {
        for (var t = 0; t < 2; t++) {
          var k = triIndex(p0, q0, f, t);
          if (OWN_D[k] < 0) used.push(k);
          if (d > OWN_D[k]) { OWN_D[k] = d; OWN_C[k] = ci * 3 + f; }
        }
      }
    });
    used.forEach(function (k) { own.set(k, { d: OWN_D[k], cube: (OWN_C[k] / 3) | 0, face: OWN_C[k] % 3 }); });
    return { cubes: cubes, own: own };
  }
  // Per cube: visible triangles of each face (0–2).
  function isoFaces(h) {
    var o = isoOwners(h), vis = o.cubes.map(function () { return [0, 0, 0]; });
    o.own.forEach(function (w) { vis[w.cube][w.face]++; });
    return vis;
  }
  // Every cube shows at least one whole face (the same lattice, without building the owner map).
  function allVisible(h) {
    var G = h.length, n = 0, z, x, y, f, t, k;
    OWN_D.fill(-1);
    for (z = 0; z < G; z++) for (x = 0; x < G; x++) for (y = 0; y < h[z][x]; y++) {
      var p0 = x - z, q0 = 2 * y - x - z, d = x + y + z;
      for (f = 0; f < 3; f++) for (t = 0; t < 2; t++) { k = triIndex(p0, q0, f, t); if (d > OWN_D[k]) { OWN_D[k] = d; OWN_C[k] = n * 3 + f; } }
      n++;
    }
    var i = 0;
    for (z = 0; z < G; z++) for (x = 0; x < G; x++) for (y = 0; y < h[z][x]; y++) {
      var P = x - z, Q = 2 * y - x - z, me = i * 3, whole = false;
      for (f = 0; f < 3 && !whole; f++) whole = OWN_C[triIndex(P, Q, f, 0)] === me + f && OWN_C[triIndex(P, Q, f, 1)] === me + f;
      if (!whole) return false;
      i++;
    }
    return true;
  }
  // The isometric picture as text: every visible face (cube and face) with its visible triangles,
  // in normalised position. Equal text means pictures that look the same (shading by face, outlines
  // around every face).
  function isoSignature(h) {
    var o = isoOwners(normH(h)), groups = {};
    o.own.forEach(function (w, key) { var g = w.cube + ':' + w.face; (groups[g] = groups[g] || []).push(key); });
    return Object.keys(groups).map(function (g) { return g.split(':')[1] + '@' + groups[g].sort(function (a, b) { return a - b; }).join(';'); }).sort().join('|');
  }

  /* ------------------------------------------------------------ neighbouring structures */
  function inside(G, z, x) { return z >= 0 && x >= 0 && z < G && x < G; }
  // One move that keeps the cube count: a cube from one column onto another (an occupied column or
  // an empty cell next to the footprint), or two columns swapping heights.
  function move(rng, h) {
    var G = h.length, occ = [], z, x;
    for (z = 0; z < G; z++) for (x = 0; x < G; x++) if (h[z][x] > 0) occ.push([z, x]);
    var g = copyH(h);
    if (rng.chance(0.35) && occ.length >= 2) {
      var a = rpick(rng, occ), b = rpick(rng, occ);
      if (g[a[0]][a[1]] === g[b[0]][b[1]]) return null;
      var t = g[a[0]][a[1]]; g[a[0]][a[1]] = g[b[0]][b[1]]; g[b[0]][b[1]] = t;
    } else {
      var src = rpick(rng, occ), targets = [];
      for (z = 0; z < G; z++) for (x = 0; x < G; x++) {
        if ((z === src[0] && x === src[1]) || g[z][x] >= HMAX) continue;
        if (g[z][x] > 0 || [[1, 0], [-1, 0], [0, 1], [0, -1]].some(function (d) { return inside(G, z + d[0], x + d[1]) && g[z + d[0]][x + d[1]] > 0; })) targets.push([z, x]);
      }
      if (!targets.length) return null;
      var dst = rpick(rng, targets);
      g[src[0]][src[1]]--; g[dst[0]][dst[1]]++;
    }
    return connected(g) ? g : null;
  }
  // Columns whose heights differ, and the total difference (same grid position).
  function editSize(a, b) {
    var cols = 0, sum = 0;
    for (var z = 0; z < a.length; z++) for (var x = 0; x < a.length; x++) { var d = Mth.abs(a[z][x] - b[z][x]); if (d) { cols++; sum += d; } }
    return { cols: cols, sum: sum };
  }


  /* ------------------------------------------------------------ shortcut solvers and balancing */
  // The share of a solver's pick that lands on set[0] (the key); exact ties split evenly.
  function pickShare(scores, high) {
    var best = high ? -INF : INF, ties = 0, i;
    for (i = 0; i < scores.length; i++) if (high ? scores[i] > best : scores[i] < best) best = scores[i];
    for (i = 0; i < scores.length; i++) if (scores[i] === best) ties++;
    return scores[0] === best ? 1 / ties : 0;
  }
  function sums(set, D) {
    return set.map(function (a) { var s = 0; set.forEach(function (b) { if (a !== b) s += D[a][b]; }); return s; });
  }
  // toview solvers: the option whose filled area equals the number of top cells (or comes closest);
  // the option most like the others (unit edges); the most lines; the fewest lines.
  function toviewShares(set, pool, D, T) {
    var lines = set.map(function (i) { return pool[i].edges; });
    return [
      pickShare(set.map(function (i) { return -Mth.abs(pool[i].d.area - T); }), true),
      pickShare(sums(set, D), false),
      pickShare(lines, true),
      pickShare(lines, false),
    ];
  }
  // toobject solvers: the structure most like the others (cubes moved); the cube count closest to
  // the options' mean; the most cubes; the fewest cubes; then checking one view only (top, front,
  // right: the share is 1 / the options matching it; reported, kept low but not balanced).
  function toobjectShares(set, pool, D) {
    var n = set.map(function (i) { return pool[i].n; }), mean = (n[0] + n[1] + n[2] + n[3]) / 4;
    var out = [pickShare(sums(set, D), false), pickShare(n.map(function (x) { return -Mth.abs(x - mean); }), true), pickShare(n, true), pickShare(n, false)];
    ASKED.forEach(function (v) { var k = 0; set.forEach(function (i) { if (pool[i].matches.indexOf(v) >= 0) k++; }); out.push(1 / k); });
    return out;
  }
  // Per item, solver k should pick the key with probability t[k] (one-view entries: shares to keep
  // low); the foils are chosen to match, misses weighted by w[k]. toview's area target depends on
  // the asked view: a top view's area always equals the number of top cells, so the best a foil set
  // can do there is a four-way tie.
  var BAL = {
    toview: { t: [0.25, 0.25, 0.25, 0.25], tAreaTop: 0, w: [2, 2, 1, 1.5] },
    toobject: { t: [0.15, 0.25, 0.25, 0.25, 0, 0, 0], w: [2, 1.5, 1.5, 1.5, 0.3, 0.3, 0.3] },
  };
  function chooseFoils(rng, pool, sharesOf, want, w) {
    var idx = rshuffle(rng, pool.map(function (_, i) { return i; }).slice(1)), best = null, bestScore = INF;
    for (var a = 0; a < idx.length; a++) {
      for (var b = a + 1; b < idx.length; b++) {
        for (var c = b + 1; c < idx.length; c++) {
          var set = [0, idx[a], idx[b], idx[c]], sh = sharesOf(set), score = 0;
          for (var k = 0; k < sh.length; k++) score += w[k] * Mth.abs(sh[k] - want[k]);
          var kinds = {};
          set.forEach(function (i) { kinds[pool[i].kind] = 1; });
          score -= 0.05 * Object.keys(kinds).length; // prefer a mix of foil kinds
          if (score < bestScore - 1e-9) { bestScore = score; best = set; }
        }
      }
    }
    return best;
  }
  function table(pool, dist) {
    return pool.map(function (a) { return pool.map(function (b) { return a === b ? 0 : dist(a, b); }); });
  }

  /* ------------------------------------------------------------ variants */
  var GRIDS = [3, 4];
  function lvl(params, k, n) { var x = params ? params[k] : 0; return Number.isInteger(x) && x >= 0 && x < n ? x : 0; }
  function cleanParams(params) {
    var v = params && VARIANTS.indexOf(params.variant) >= 0 ? params.variant : 'toview';
    return { cubes: lvl(params, 'cubes', CUBES.length), grid: lvl(params, 'grid', 2), view: lvl(params, 'view', 3), variant: v };
  }
  var VARIANTS = ['toview', 'toobject', 'count'];
  // toview and toobject: N within one of the level's count; count: the level's five-number window.
  function drawN(rng, p) {
    if (p.variant === 'count') return rint(rng, 4 + p.cubes, 8 + p.cubes);
    var L = CUBES[p.cubes];
    return rint(rng, Mth.max(4, L - 1), Mth.min(12, L + 1));
  }

  // A structure whose cubes all show a whole face in the isometric picture (the picture then
  // determines the structure, its views and its count).
  // Built cube by cube: a random footprint of flat cubes (all visible), then each further cube on a
  // random column where every cube stays readable.
  function visibleStructure(rng, G, N) {
    for (var a = 0; a < 20; a++) {
      var Fmin = Mth.max(2, Mth.ceil(N / 3)), Fmax = Mth.min(N - 1, G * G);
      var fp = randomFootprint(rng, G, rint(rng, Mth.min(Fmin, Fmax), Fmax)), h = fp.h, cells = fp.cells, ok = true;
      for (var k = cells.length; k < N && ok; k++) {
        var order = rshuffle(rng, cells), placed = false;
        for (var c = 0; c < order.length && !placed; c++) {
          var q = order[c];
          if (h[q[0]][q[1]] >= HMAX) continue;
          h[q[0]][q[1]]++;
          if (allVisible(h)) placed = true; else h[q[0]][q[1]]--;
        }
        ok = placed;
      }
      if (ok) return h;
    }
    return null;
  }
  function walk(rng, h, steps) {
    var g = h;
    for (var k = 0; k < steps; k++) { var m = move(rng, g); if (!m) return null; g = m; }
    return g;
  }
  // Plateaus of the top view: connected cells of equal height (4-neighbour).
  function plateaus(h) {
    var G = h.length, lab = zeros(G), out = [], z, x;
    for (z = 0; z < G; z++) for (x = 0; x < G; x++) {
      if (!h[z][x] || lab[z][x]) continue;
      var id = out.length + 1, cells = [], stack = [[z, x]];
      lab[z][x] = id;
      while (stack.length) {
        var c = stack.pop(); cells.push(c);
        [[1, 0], [-1, 0], [0, 1], [0, -1]].forEach(function (d) {
          var zz = c[0] + d[0], xx = c[1] + d[1];
          if (inside(G, zz, xx) && !lab[zz][xx] && h[zz][xx] === h[z][x]) { lab[zz][xx] = id; stack.push([zz, xx]); }
        });
      }
      out.push({ cells: cells, h: h[z][x] });
    }
    return out;
  }
  // Proposals that keep one view by construction (verified afterwards): two equal-sized plateaus
  // trade one level (top); one cube moves between columns hidden behind taller ones in front
  // (front) or to their right (right). The cube count never changes.
  function keepTop(rng, h) {
    var P = plateaus(h), pairs = [];
    for (var i = 0; i < P.length; i++) for (var j = 0; j < P.length; j++) if (i !== j && P[i].cells.length === P[j].cells.length && P[i].h < HMAX && P[j].h > 1) pairs.push([i, j]);
    if (!pairs.length) return null;
    var pr = rpick(rng, pairs), g = copyH(h);
    P[pr[0]].cells.forEach(function (c) { g[c[0]][c[1]]++; });
    P[pr[1]].cells.forEach(function (c) { g[c[0]][c[1]]--; });
    return g;
  }
  // Same top view, new heights: every plateau gets a random height (1–4) different from its
  // neighbours', and the cube count stays N.
  function reheight(rng, h) {
    var G = h.length, P = plateaus(h), N = total(h), lab = zeros(G), i, j;
    P.forEach(function (pl, k) { pl.cells.forEach(function (c) { lab[c[0]][c[1]] = k + 1; }); });
    var nb = P.map(function () { return {}; });
    for (var z = 0; z < G; z++) for (var x = 0; x < G; x++) {
      if (!lab[z][x]) continue;
      if (x + 1 < G && lab[z][x + 1] && lab[z][x + 1] !== lab[z][x]) { nb[lab[z][x] - 1][lab[z][x + 1] - 1] = 1; nb[lab[z][x + 1] - 1][lab[z][x] - 1] = 1; }
      if (z + 1 < G && lab[z + 1][x] && lab[z + 1][x] !== lab[z][x]) { nb[lab[z][x] - 1][lab[z + 1][x] - 1] = 1; nb[lab[z + 1][x] - 1][lab[z][x] - 1] = 1; }
    }
    for (var t = 0; t < 12; t++) {
      var hs = [], sum = 0, ok = true;
      for (i = 0; i < P.length && ok; i++) {
        var opts = [];
        for (var v = 1; v <= HMAX; v++) { var clash = false; for (j = 0; j < i; j++) if (nb[i][j] && hs[j] === v) clash = true; if (!clash) opts.push(v); }
        if (!opts.length) ok = false; else { hs.push(rpick(rng, opts)); sum += hs[i] * P[i].cells.length; }
      }
      if (!ok || sum !== N) continue;
      var g = zeros(G);
      P.forEach(function (pl, k) { pl.cells.forEach(function (c) { g[c[0]][c[1]] = hs[k]; }); });
      if (keyH(g) !== keyH(h)) return g;
    }
    return null;
  }
  function keepSide(rng, h, dir) {
    var G = h.length, hidden = [], z, x, k;
    for (z = 0; z < G; z++) for (x = 0; x < G; x++) {
      var cover = 0;
      if (dir === 'front') for (k = z + 1; k < G; k++) cover = Mth.max(cover, h[k][x]);
      else for (k = x + 1; k < G; k++) cover = Mth.max(cover, h[z][k]);
      if (cover >= 1 && h[z][x] <= cover) hidden.push({ z: z, x: x, hi: Mth.min(cover, HMAX) });
    }
    var up = hidden.filter(function (c) { return h[c.z][c.x] < c.hi && (h[c.z][c.x] > 0 || adjacent(h, c.z, c.x)); });
    var down = hidden.filter(function (c) { return h[c.z][c.x] > 0; });
    if (!up.length || !down.length) return null;
    var a = rpick(rng, up), b = rpick(rng, down);
    if (a.z === b.z && a.x === b.x) return null;
    var g = copyH(h);
    g[a.z][a.x]++; g[b.z][b.x]--;
    return connected(g) ? g : null;
  }
  function adjacent(h, z, x) {
    return [[1, 0], [-1, 0], [0, 1], [0, -1]].some(function (d) { return inside(h.length, z + d[0], x + d[1]) && h[z + d[0]][x + d[1]] > 0; });
  }

  // Proposals around a structure h: every single move (a cube onto another column, two columns
  // swapping heights), one cube more or fewer on a column, chains of one to three moves keeping the
  // front or the right view (mixed chains can keep both), plateau trades and re-heightings keeping
  // the top view, and free two- and three-move walks.
  function proposals(rng, h) {
    var G = h.length, cands = [], occ = [], z, x, z2, x2, k;
    for (z = 0; z < G; z++) for (x = 0; x < G; x++) if (h[z][x]) occ.push([z, x]);
    occ.forEach(function (a) {
      for (z2 = 0; z2 < G; z2++) for (x2 = 0; x2 < G; x2++) {
        if ((z2 === a[0] && x2 === a[1]) || h[z2][x2] >= HMAX) continue;
        var g = copyH(h);
        g[a[0]][a[1]]--; g[z2][x2]++;
        if (connected(g)) cands.push(g);
      }
    });
    for (z = 0; z < G; z++) for (x = 0; x < G; x++) {
      if (h[z][x] < HMAX && (h[z][x] > 0 || adjacent(h, z, x))) { var gu = copyH(h); gu[z][x]++; cands.push(gu); }
      if (h[z][x] > 0 && total(h) > 4) { var gd = copyH(h); gd[z][x]--; if (connected(gd)) cands.push(gd); }
    }
    for (var i = 0; i < occ.length; i++) for (var j = i + 1; j < occ.length; j++) {
      var A = occ[i], B = occ[j];
      if (h[A[0]][A[1]] === h[B[0]][B[1]]) continue;
      var g2 = copyH(h); g2[A[0]][A[1]] = h[B[0]][B[1]]; g2[B[0]][B[1]] = h[A[0]][A[1]];
      if (connected(g2)) cands.push(g2);
    }
    var keepF = function (r, hh) { return keepSide(r, hh, 'front'); }, keepR = function (r, hh) { return keepSide(r, hh, 'right'); };
    function chain(fs) {
      var g = h;
      for (var c = 0; c < fs.length && g; c++) { g = fs[c](rng, g); if (g) cands.push(g); }
    }
    for (k = 0; k < 14; k++) {
      chain([keepF, keepF, keepF].slice(0, rint(rng, 1, 3)));
      chain([keepR, keepR, keepR].slice(0, rint(rng, 1, 3)));
      chain(rng.chance(0.5) ? [keepF, keepR] : [keepR, keepF]);
      if (k < 8) chain([keepTop, keepTop].slice(0, rint(rng, 1, 2)));
      var rh = reheight(rng, h);
      if (rh) cands.push(rh);
    }
    for (k = 0; k < 16; k++) { var gw = walk(rng, h, rint(rng, 2, 3)); if (gw) cands.push(gw); }
    return cands;
  }
  // A family of structures: a hidden centre X and up to `max` different variants of it, every one
  // with all cubes visible and 4–12 cubes. The key and the foils are all drawn from the family, so
  // the key is not the one structure the others were derived from (nor the simplest of them).
  function family(rng, G, N, max) {
    var X = visibleStructure(rng, G, N);
    if (!X) return null;
    var fam = [X], seen = new Set([keyH(X)]);
    var props = rshuffle(rng, proposals(rng, X));
    for (var i = 0; i < props.length && fam.length < max; i++) {
      var g = props[i], kg = keyH(g), n = total(g);
      if (seen.has(kg) || n < 4 || n > 12) continue;
      seen.add(kg);
      if (allVisible(g)) fam.push(g);
    }
    return fam;
  }

  function genToview(rng, p) {
    var G = GRIDS[p.grid], dir = ASKED[p.view], fam = family(rng, G, drawN(rng, p), 16);
    if (!fam) return null;
    var ki = rint(rng, 0, fam.length - 1), h = fam[ki];
    if (total(h) < 4 || total(h) > 12) return null;
    var keyD = view(h, dir), pool = [{ kind: 'key', d: keyD }];
    function admit(o) {
      if (ddist(o.d, keyD) < 5) return false; // never a single-cell edit of the key's drawing
      for (var i = 1; i < pool.length; i++) if (ddist(o.d, pool[i].d) < 3) return false;
      pool.push(o);
      return true;
    }
    DIRS.forEach(function (d2) { if (d2 !== dir) admit({ kind: 'direction', from: d2, d: view(h, d2) }); });
    admit({ kind: 'mirror', d: mirror(keyD) });
    rshuffle(rng, fam.map(function (_, i) { return i; })).forEach(function (j) {
      if (j === ki || pool.length >= 14) return;
      var e = editSize(h, fam[j]);
      if (e.cols >= 2 && e.sum >= 2) admit({ kind: 'neighbour', d: view(fam[j], dir), heights: fam[j] }); // never a single-column edit
    });
    if (pool.length < 4) return null;
    pool.forEach(function (o) { o.edges = edgeCount(o.d); });
    var D = table(pool, function (a, b) { return ddist(a.d, b.d); }), T = footprint(h);
    var want = BAL.toview.t.map(function (t, k) { return rng.chance(k === 0 && dir === 'top' ? BAL.toview.tAreaTop : t) ? 1 : 0; });
    var set = chooseFoils(rng, pool, function (s) { return toviewShares(s, pool, D, T); }, want, BAL.toview.w);
    var perm = rshuffle(rng, [0, 1, 2, 3]);
    return {
      variant: 'toview', grid: G, heights: h, view: dir, key: perm.indexOf(0),
      options: perm.map(function (i) {
        var o = pool[set[i]], out = { kind: o.kind, drawing: pub(o.d) };
        if (o.from) out.from = o.from;
        if (o.heights) out.heights = o.heights;
        return out;
      }),
    };
  }

  function genToobject(rng, p) {
    var G = GRIDS[p.grid], fam = family(rng, G, drawN(rng, p), 30);
    if (!fam) return null;
    var codes = fam.map(function (g) { return ASKED.map(function (d) { return viewCode(g, d); }); });
    var order = rshuffle(rng, fam.map(function (_, i) { return i; }));
    for (var t = 0; t < order.length && t < 10; t++) {
      var ki = order[t], h = fam[ki], nk = total(h);
      if (nk < 4 || nk > 12) continue;
      var pool = [{ kind: 'key', heights: h, matches: ASKED.slice(), sig: isoSignature(h), n: nk }], m1 = [], m2 = [];
      for (var j = 0; j < fam.length; j++) {
        if (j === ki || Mth.abs(total(fam[j]) - nk) > 1) continue;
        var m = ASKED.filter(function (d, di) { return codes[j][di] === codes[ki][di]; });
        if (m.length === 1) m1.push({ j: j, m: m }); else if (m.length === 2) m2.push({ j: j, m: m });
      }
      // Foils matching two views first (the hard ones), then one; each must look different.
      rshuffle(rng, m2).concat(rshuffle(rng, m1)).forEach(function (c) {
        if (pool.length >= 13) return;
        var sig = isoSignature(fam[c.j]);
        if (pool.some(function (o) { return o.sig === sig; })) return;
        pool.push({ kind: c.m.length === 2 ? 'match2' : 'match1', heights: fam[c.j], matches: c.m, sig: sig, n: total(fam[c.j]) });
      });
      if (pool.length < 4) continue;
      var D = table(pool, function (a, b) { return hdist(a.heights, b.heights); });
      var want = BAL.toobject.t.map(function (tt, k) { return k < 4 ? (rng.chance(tt) ? 1 : 0) : tt; });
      var set = chooseFoils(rng, pool, function (s) { return toobjectShares(s, pool, D); }, want, BAL.toobject.w);
      var perm = rshuffle(rng, [0, 1, 2, 3]), V = {};
      ASKED.forEach(function (d) { V[d] = pub(view(h, d)); });
      return {
        variant: 'toobject', grid: G, heights: h, key: perm.indexOf(0), views: V,
        options: perm.map(function (i) { var o = pool[set[i]]; return { kind: o.kind, heights: o.heights, matches: o.matches }; }),
      };
    }
    return null;
  }

  function genCount(rng, p) {
    var G = GRIDS[p.grid], N = drawN(rng, p), h = visibleStructure(rng, G, N);
    if (!h) return null;
    var lo = 4 + p.cubes, hi = 8 + p.cubes, others = [], v;
    for (v = lo; v <= hi; v++) if (v !== N) others.push(v);
    var drop = rpick(rng, others), options = [];
    for (v = lo; v <= hi; v++) if (v !== drop) options.push(v);
    return { variant: 'count', grid: G, heights: h, key: options.indexOf(N), options: options };
  }

  /* ------------------------------------------------------------ validate (ray casting) */
  // An occupancy grid built from the heights, then rays cast through it, cell by cell.
  function voxels(h) {
    var G = h.length, O = new Uint8Array(G * HMAX * G), n = 0;
    for (var z = 0; z < G; z++) for (var x = 0; x < G; x++) for (var y = 0; y < h[z][x]; y++) { O[(x * HMAX + y) * G + z] = 1; n++; }
    return { G: G, n: n, has: function (x, y, z) { return O[(x * HMAX + y) * G + z] === 1; } };
  }
  // Nearness image of a view by marching from the viewer's side (first occupied cell).
  function rayImage(vx, dir) {
    var G = vx.G, rows = dir === 'top' ? G : HMAX, img = [], i, j, s, a;
    for (j = 0; j < rows; j++) {
      img.push([]);
      for (i = 0; i < G; i++) {
        a = -1;
        for (s = 0; s < (dir === 'top' ? HMAX : G) && a < 0; s++) {
          if (dir === 'top' && vx.has(i, HMAX - 1 - s, G - 1 - j)) a = HMAX - s;
          else if (dir === 'front' && vx.has(i, j, G - 1 - s)) a = G - 1 - s;
          else if (dir === 'back' && vx.has(G - 1 - i, j, s)) a = G - 1 - s;
          else if (dir === 'right' && vx.has(G - 1 - s, j, G - 1 - i)) a = G - 1 - s;
          else if (dir === 'left' && vx.has(s, j, i)) a = G - 1 - s;
        }
        img[j].push(a);
      }
    }
    return img;
  }
  // Unit edges of an image, cropped to its filled cells, as sorted text (its own routine: the
  // generator's drawing code is not used here).
  function imageEdges(img) {
    var H = img.length, W = img[0].length, i0 = INF, j0 = INF, i1 = -1, j1 = -1, i, j, out = [];
    for (j = 0; j < H; j++) for (i = 0; i < W; i++) if (img[j][i] >= 0) { i0 = Mth.min(i0, i); i1 = Mth.max(i1, i); j0 = Mth.min(j0, j); j1 = Mth.max(j1, j); }
    function n(ii, jj) { return ii < i0 || ii > i1 || jj < j0 || jj > j1 ? -1 : img[jj][ii]; }
    for (j = j0; j <= j1 + 1; j++) for (i = i0; i <= i1 + 1; i++) {
      if (j <= j1 && n(i - 1, j) !== n(i, j)) out.push('v' + (i - i0) + ',' + (j - j0));
      if (i <= i1 && n(i, j - 1) !== n(i, j)) out.push('h' + (i - i0) + ',' + (j - j0));
    }
    return (i1 - i0 + 1) + 'x' + (j1 - j0 + 1) + '|' + out.sort().join(' ');
  }
  // The same text from a stored drawing's merged lines.
  function linesEdges(d) {
    var out = [];
    d.lines.forEach(function (l) {
      if (l[0] === l[2]) for (var y = Mth.min(l[1], l[3]); y < Mth.max(l[1], l[3]); y++) out.push('v' + l[0] + ',' + y);
      else for (var x = Mth.min(l[0], l[2]); x < Mth.max(l[0], l[2]); x++) out.push('h' + x + ',' + l[1]);
    });
    return d.w + 'x' + d.h + '|' + out.sort().join(' ');
  }
  function edgeSet(text) { var s = {}; text.split('|')[1].split(' ').forEach(function (e) { if (e) s[e] = 1; }); return s; }
  // Unit edges in one drawing and not the other (both at the bottom-left corner).
  function edgeDiff(a, b) {
    var A = edgeSet(a), B = edgeSet(b), n = 0, k;
    for (k in A) if (!B[k]) n++;
    for (k in B) if (!A[k]) n++;
    return n;
  }
  // Isometric visibility by rays: from the centroid of each face triangle toward the camera (+x+y+z);
  // a triangle is seen when the ray meets no other cube. Returns per cube the seen triangles of each
  // face, and a picture text like isoSignature.
  var CENT = [ // per face, the two triangle centroids relative to the cube's (x, y, z) corner
    [[1 / 3, 1, 2 / 3], [2 / 3, 1, 1 / 3]],
    [[1, 2 / 3, 1 / 3], [1, 1 / 3, 2 / 3]],
    [[2 / 3, 1 / 3, 1], [1 / 3, 2 / 3, 1]],
  ];
  function rayHits(c, P) { // the ray P + s(1, 1, 1), s > 0, against the unit box at c
    var lo = 1e-9, hi = INF;
    for (var a = 0; a < 3; a++) {
      var t0 = c[a] - P[a], t1 = c[a] + 1 - P[a];
      if (t0 > lo) lo = t0;
      if (t1 < hi) hi = t1;
    }
    return lo < hi - 1e-9;
  }
  function rayVisibility(h) {
    var cubes = [], z, x, y;
    for (z = 0; z < h.length; z++) for (x = 0; x < h.length; x++) for (y = 0; y < h[z][x]; y++) cubes.push([x, y, z]);
    var faces = [], groups = [];
    cubes.forEach(function (c, ci) {
      var f3 = [0, 0, 0];
      for (var f = 0; f < 3; f++) {
        var keys = [];
        for (var t = 0; t < 2; t++) {
          var P = [c[0] + CENT[f][t][0], c[1] + CENT[f][t][1], c[2] + CENT[f][t][2]];
          var seen = true;
          for (var oi = 0; oi < cubes.length && seen; oi++) if (oi !== ci && rayHits(cubes[oi], P)) seen = false;
          if (seen) { f3[f]++; keys.push(Mth.round(3 * (P[0] - P[2])) + ',' + Mth.round(3 * (2 * P[1] - P[0] - P[2]))); }
        }
        if (keys.length) groups.push(f + '@' + keys.sort().join(';'));
      }
      faces.push(f3);
    });
    return { faces: faces, sig: groups.sort().join('|') };
  }

  function okHeights(h, G) {
    if (!Array.isArray(h) || h.length !== G) return false;
    for (var z = 0; z < G; z++) {
      if (!Array.isArray(h[z]) || h[z].length !== G) return false;
      for (var x = 0; x < G; x++) if (!(Number.isInteger(h[z][x]) && h[z][x] >= 0 && h[z][x] <= HMAX)) return false;
    }
    return connected(h);
  }

  function validate(item) {
    if (!item || VARIANTS.indexOf(item.variant) < 0) return 'unknown variant';
    var G = item.grid;
    if (GRIDS.indexOf(G) < 0) return 'grid must be 3 or 4';
    if (!okHeights(item.heights, G)) return 'the structure is not a connected height map';
    var N = voxels(item.heights).n;
    if (N < 4 || N > 12) return 'cube count out of range (' + N + ')';
    if (!Array.isArray(item.options) || item.options.length !== 4) return 'needs 4 options';
    if (!(Number.isInteger(item.key) && item.key >= 0 && item.key < 4)) return 'key out of range';
    var i, j;
    if (item.variant === 'count') {
      var o = item.options;
      if (!o.every(function (x) { return Number.isInteger(x); })) return 'count options must be integers';
      for (i = 1; i < 4; i++) if (!(o[i] > o[i - 1])) return 'count options must be distinct and ascending';
      if (o[3] - o[0] > 4) return 'count options must be nearby (within five numbers)';
      if (o[item.key] !== N) return 'the key is not the number of cubes (' + N + ')';
      var vis = rayVisibility(item.heights).faces;
      for (i = 0; i < vis.length; i++) if (!(vis[i][0] === 2 || vis[i][1] === 2 || vis[i][2] === 2)) return 'cube ' + i + ' shows no whole face';
      return true;
    }
    var vx = voxels(item.heights), seenAll = function (hh) { return rayVisibility(hh).faces.every(function (f) { return f[0] === 2 || f[1] === 2 || f[2] === 2; }); };
    if (item.variant === 'toview' && !seenAll(item.heights)) return 'a cube of the structure shows no whole face';
    if (item.variant === 'toview') {
      if (ASKED.indexOf(item.view) < 0) return 'unknown view';
      var want = imageEdges(rayImage(vx, item.view)), codes = [];
      for (i = 0; i < 4; i++) {
        var d = item.options[i].drawing;
        if (!d || !Array.isArray(d.lines)) return 'option ' + i + ' has no drawing';
        codes.push(linesEdges(d));
      }
      var hits = codes.filter(function (c) { return c === want; }).length;
      if (hits !== 1 || codes[item.key] !== want) return 'exactly one option must be the ' + item.view + ' view (' + hits + ')';
      for (i = 0; i < 4; i++) {
        if (i !== item.key && edgeDiff(codes[i], want) < 5) return 'option ' + i + ' is within a single-cell edit of the key';
        for (j = i + 1; j < 4; j++) if (edgeDiff(codes[i], codes[j]) < 3) return 'options ' + i + ' and ' + j + ' look alike';
      }
      return true;
    }
    // toobject
    if (!item.views) return 'no views';
    var stem = {};
    for (i = 0; i < ASKED.length; i++) {
      var dv = ASKED[i];
      if (!item.views[dv] || linesEdges(item.views[dv]) !== imageEdges(rayImage(vx, dv))) return 'the ' + dv + ' view in the stem is not the key\'s';
      stem[dv] = linesEdges(item.views[dv]);
    }
    var sigs = [], shapes = {};
    for (i = 0; i < 4; i++) {
      var hh = item.options[i].heights;
      if (!okHeights(hh, G)) return 'option ' + i + ' is not a connected height map';
      var vo = voxels(hh);
      var No = vo.n;
      if (Mth.abs(No - N) > 1 || No < 4 || No > 12) return 'option ' + i + ' must have 4–12 cubes, at most one more or fewer than the key';
      if (!seenAll(hh)) return 'a cube of option ' + i + ' shows no whole face';
      var m = ASKED.filter(function (dd) { return imageEdges(rayImage(vo, dd)) === stem[dd]; }).length;
      if (i === item.key && m !== 3) return 'the key does not match all three views';
      if (i !== item.key && (m < 1 || m > 2)) return 'option ' + i + ' matches ' + m + ' of the three views';
      var kh = keyH(hh);
      if (shapes[kh]) return 'options ' + shapes[kh] + ' and ' + i + ' are the same structure';
      shapes[kh] = String(i);
      sigs.push(rayVisibility(normH(hh)).sig);
    }
    for (i = 0; i < 4; i++) for (j = i + 1; j < 4; j++) if (sigs[i] === sigs[j]) return 'options ' + i + ' and ' + j + ' look the same in the isometric picture';
    return true;
  }

  function score(item, response) { return { correct: response === item.key }; }

  /* ------------------------------------------------------------ generate */
  var stats = { tries: 0, nulls: 0, invalid: 0, errors: 0, fallbacks: 0, lastInvalid: null, lastError: null };
  function attempt(rng, p) {
    stats.tries++;
    var item;
    try {
      item = p.variant === 'toview' ? genToview(rng, p) : p.variant === 'toobject' ? genToobject(rng, p) : genCount(rng, p);
    } catch (e) { stats.errors++; stats.lastError = String(e && e.stack || e); return null; }
    if (!item) { stats.nulls++; return null; }
    item.ex = 'views';
    item.iso = { from: [1, 1, 1] };
    var ok = validate(item);
    if (ok !== true) { stats.invalid++; stats.lastInvalid = ok; return null; }
    return item;
  }
  function generate(rng, params) {
    var p = cleanParams(params), item = null;
    for (var i = 0; i < 50 && !item; i++) item = attempt(i === 0 ? rng : rng.fork('retry' + i), p);
    if (!item) item = fallback(p);
    item.seed = rng.seed;
    item.params = params ? PX.util.deepCopy(params) : p;
    return item;
  }
  function fallback(p) {
    stats.fallbacks++;
    var tries = [p, { cubes: 0, grid: 0, view: 0, variant: p.variant }];
    for (var t = 0; t < tries.length; t++) {
      for (var k = 0; k < 300; k++) {
        var item = attempt(PX.rng(PX.rng.hash('views-fallback', tries[t].variant, tries[t].cubes, tries[t].grid, tries[t].view, k)), tries[t]);
        if (item) return item;
      }
    }
    throw new Error('views: no valid item could be built'); // unreachable while the fallback test passes
  }

  /* ------------------------------------------------------------ difficulty (custom) */
  // Logits; P(right) = g + (1 − g − 0.03)·σ(θ − b), g = .25. base −2.2: four cubes on a 3 × 3 grid,
  // asked for the top view, ≈ .90 right for a beginner (θ = 0). Cubes +0.65 per level (more blocks
  // to track, more hidden faces: Kurtuluş & Yolcu 2013), 4 × 4 grid +0.6, view (toview only): front
  // +0.45, right +0.9 (the right view needs the turned viewpoint; DJ). Variants: toobject +0.9 (three
  // views to combine), count −0.2 (every cube shows a face). Range −2.4 … +1.9 (4.3 logits); the
  // dims' steps alone span 4.1.
  var DIFF = { base: -2.2, cubes: 0.65, grid: 0.6, view: [0, 0.45, 0.9], variant: { toview: 0, toobject: 0.9, count: -0.2 } };
  function difficulty(params) {
    var p = cleanParams(params);
    return DIFF.base + DIFF.cubes * p.cubes + DIFF.grid * p.grid + (p.variant === 'toview' ? DIFF.view[p.view] : 0) + DIFF.variant[p.variant];
  }

  PX.ex.define({
    id: 'views', version: 1, code: 'EX-07', name: 'Orthographic views', short: 'Views',
    abilities: ['Vz'], cell: 'intrinsic-static', role: 'train', answer: 'choice', nOptions: 4,
    dims: [
      { key: 'cubes', label: 'Cubes', levels: CUBES.slice(), step: DIFF.cubes },
      { key: 'grid', label: 'Grid', levels: ['3 × 3', '4 × 4'], step: DIFF.grid },
      { key: 'view', label: 'View', levels: ASKED.slice(), step: 0.45 }, // asked view (toview only)
    ],
    base: DIFF.base,
    variants: VARIANTS.slice(),
    difficulty: difficulty,
    generate: generate,
    validate: validate,
    score: score,
    lib: {
      HMAX: HMAX, DIRS: DIRS, ASKED: ASKED, CUBES: CUBES, GRIDS: GRIDS, BAL: BAL, DIFF: DIFF, stats: stats,
      randomStructure: randomStructure, connected: connected, normH: normH, keyH: keyH, hdist: hdist, total: total, footprint: footprint,
      depthImage: depthImage, drawing: drawing, view: view, mirror: mirror, ddist: ddist, edgeCount: edgeCount,
      cubesOf: cubesOf, isoOwners: isoOwners, isoFaces: isoFaces, allVisible: allVisible, isoSignature: isoSignature,
      rayImage: rayImage, voxels: voxels, imageEdges: imageEdges, linesEdges: linesEdges, edgeDiff: edgeDiff, rayVisibility: rayVisibility,
      move: move, viewCode: viewCode, visibleStructure: visibleStructure, plateaus: plateaus, keepTop: keepTop, keepSide: keepSide, reheight: reheight, toviewShares: toviewShares, toobjectShares: toobjectShares, pickShare: pickShare,
      genToview: genToview, genToobject: genToobject, genCount: genCount, fallback: fallback, cleanParams: cleanParams,
    },
  });

  /* ===== v1.1 export block (owner: B6, for PAT-2 Missing View, js/ex/patviews/gen.js) =====
     Non-breaking: it only adds the block-model helpers that were private to Views' lib. Views' own
     definition, ids, ratings, generator and items do not change. Missing View reads them lazily
     through PX.ex.get('views').lib (its gen.js may load before this file in a node load check). */
  (function (L) {
    L.zeros = zeros; L.copyH = copyH; L.adjacent = adjacent; L.inside = inside;
    L.walk = walk; L.proposals = proposals; L.family = family; L.randomFootprint = randomFootprint;
  })(PX.ex.get('views').lib);
})(window.PX);
