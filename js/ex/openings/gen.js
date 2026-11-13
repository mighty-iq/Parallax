/* EX-14 Openings (DAT-style format): a pictured solid and five openings. The solid may be turned before it goes in
   and then passes straight through; which opening fits it exactly (same outline, same scale)?
   (pure; ARCHITECTURE.md §5; design: docs/research/v1.1/R3-dat-pat.md §8.5.)

   Solid: the intersection of three straight extrusions, so every feature runs right through
   (the rule that hidden parts hold no surprises holds by construction):
     F (x, y) extruded along z (front profile), T (x, z) along y (top), S (z, y) along x (side).
   Units: a lattice step is half a unit; the box is W × H × D steps (6–10, pairwise different).
   Profiles start as full rectangles and get features: notches (rectangular bites in a side), steps
   (bites at a corner) and 45° chamfers (dim 'edges'). No through-holes: an outline is always an
   outer outline. Each profile cell is empty, full or a half (cut on a diagonal); a cell is split
   into four quarters (bottom, right, top, left) and every region here is a union of quarters:
   the silhouette of the solid along an axis too, since a cell's piece of the solid is convex with
   corners at cell corners and the cell centre (silZ / silX / silY, exact).
   The outline of a quarter grid is its boundary (outline()), in steps (halves possible).

   Key: the silhouette along one axis (dim 'keyview': the axis of the face the picture shows most,
   then the side face, then the top face; dim 'pose': upright or lying). Foils: silhouettes of
   neighbouring solids (one feature moved, removed, resized or added, on any of the three
   profiles) and, at foil level 1, one proportion foil (the outline stretched by at least 25 %).
   Every option is shown under its own random turn or flip (the D4 group), as the solid may be
   turned before it enters, so orientation is never a cue.

   validate (independent): rebuilds the three silhouettes by casting rays through the stored
   profile polygons on a grid of twelfth units (point in polygon and exact intervals along the
   ray), rasterises every option at the same scale and compares under all eight turns and flips:
   a match is IoU ≥ .985 with equal boxes; a non-match needs a box off by half a unit or a
   difference of half a unit² that holds a disc of a quarter unit. Exactly one option matches any
   silhouette; options pairwise do not match; every feature of the solid shows in the picture
   (rays from its faces reach the viewer).

   Item: { ex: 'openings', seed, params, W, H, D, prof: { F, T, S } (polygons in steps, CCW),
           feats: { F: [...], T: [...], S: [...] }, pose, keyAxis, key, options: [{ kind, poly,
           tf, axis? }] }. PX.ex.get('openings').lib holds the model for the view and tests. */
(function (PX) {
  'use strict';
  var Mth = Math, INF = 1 / 0;

  function rint(rng, lo, hi) { return lo + Mth.floor(rng.next() * (hi - lo + 1)); }
  function rpick(rng, arr) { return arr[rint(rng, 0, arr.length - 1)]; }
  function rshuffle(rng, arr) {
    var out = arr.slice();
    for (var i = out.length - 1; i > 0; i--) { var j = rint(rng, 0, i), t = out[i]; out[i] = out[j]; out[j] = t; }
    return out;
  }

  /* ------------------------------------------------------------ quarter grids */
  // A region on an A × B cell grid: m[j * A + i] holds four bits, one per quarter of the cell
  // (0 bottom, 1 right, 2 top, 3 left). Profiles use 0, 15 and the halves 3 (t ≤ s), 6 (s + t ≥ 1),
  // 12 (t ≥ s) and 9 (s + t ≤ 1), (s, t) being the cell's own coordinates.
  function qgrid(A, B, fill) { var m = new Uint8Array(A * B); if (fill) m.fill(15); return { A: A, B: B, m: m }; }
  function qcopy(g) { return { A: g.A, B: g.B, m: new Uint8Array(g.m) }; }
  var QC = [[0.5, 1 / 6], [5 / 6, 0.5], [0.5, 5 / 6], [1 / 6, 0.5]];          // quarter centroids
  var QDIR = [[0, -1], [1, 0], [0, 1], [-1, 0]];
  // The t-interval of a profile cell at s, and the s-interval at t (cell coordinates).
  function tRange(m, s) { return m === 15 ? [0, 1] : m === 3 ? [0, s] : m === 6 ? [1 - s, 1] : m === 12 ? [s, 1] : m === 9 ? [0, 1 - s] : null; }
  function sRange(m, t) { return m === 15 ? [0, 1] : m === 3 ? [t, 1] : m === 6 ? [1 - t, 1] : m === 12 ? [0, t] : m === 9 ? [0, 1 - t] : null; }
  function over(a, b) { return !!(a && b) && Mth.min(a[1], b[1]) - Mth.max(a[0], b[0]) > 1e-9; }
  function area4(g) { var n = 0; for (var k = 0; k < g.m.length; k++) { var v = g.m[k]; n += (v & 1) + (v >> 1 & 1) + (v >> 2 & 1) + (v >> 3 & 1); } return n; }

  /* ------------------------------------------------------------ features on a profile */
  // notch { t, side 0 bottom 1 right 2 top 3 left, p, w, d }; step { t, c corner 0 BL 1 BR 2 TR 3 TL, a, b };
  // cham { t, c, L }. Cells a feature changes, with the half masks of a chamfer's diagonal.
  function featCells(A, B, f) {
    var out = [], i, j;
    function rect(i0, i1, j0, j1) { for (j = j0; j < j1; j++) for (i = i0; i < i1; i++) out.push([i, j, 0]); }
    if (f.t === 'notch') {
      if (f.side === 0) rect(f.p, f.p + f.w, 0, f.d);
      else if (f.side === 1) rect(A - f.d, A, f.p, f.p + f.w);
      else if (f.side === 2) rect(f.p, f.p + f.w, B - f.d, B);
      else rect(0, f.d, f.p, f.p + f.w);
    } else if (f.t === 'step') {
      var x0 = f.c === 0 || f.c === 3 ? 0 : A - f.a, y0 = f.c < 2 ? 0 : B - f.b;
      rect(x0, x0 + f.a, y0, y0 + f.b);
    } else {
      for (j = 0; j < f.L; j++) for (i = 0; i < f.L - j; i++) {
        var ci = f.c === 0 || f.c === 3 ? i : A - 1 - i, cj = f.c < 2 ? j : B - 1 - j;
        out.push([ci, cj, i + j === f.L - 1 ? [6, 12, 9, 3][f.c] : 0]);
      }
    }
    return out;
  }
  // A profile from its features, or null when a feature leaves the rectangle, two features touch,
  // or too little material stays (every feature keeps one step clear of the others).
  function profile(A, B, feats) {
    var g = qgrid(A, B, true), used = new Uint8Array(A * B);
    for (var n = 0; n < feats.length; n++) {
      var cells = featCells(A, B, feats[n]), mine = [];
      for (var k = 0; k < cells.length; k++) {
        var c = cells[k];
        if (c[0] < 0 || c[1] < 0 || c[0] >= A || c[1] >= B || used[c[1] * A + c[0]]) return null;
        mine.push(c);
      }
      mine.forEach(function (c) { g.m[c[1] * A + c[0]] = c[2]; });
      mine.forEach(function (c) {
        for (var dj = -1; dj <= 1; dj++) for (var di = -1; di <= 1; di++) {
          var ii = c[0] + di, jj = c[1] + dj;
          if (ii >= 0 && jj >= 0 && ii < A && jj < B) used[jj * A + ii] = 1;
        }
      });
    }
    // Every side of the rectangle keeps material (the box stays W × H × D), at least two steps of it.
    var rowB = 0, rowT = 0, colL = 0, colR = 0, i, j;
    for (i = 0; i < A; i++) { if (g.m[i] === 15) rowB++; if (g.m[(B - 1) * A + i] === 15) rowT++; }
    for (j = 0; j < B; j++) { if (g.m[j * A] === 15) colL++; if (g.m[j * A + A - 1] === 15) colR++; }
    if (rowB < 2 || rowT < 2 || colL < 2 || colR < 2) return null;
    return g;
  }
  function randomFeature(rng, A, B, cham) {
    var r = rng.next();
    if (cham && r < 0.4) return { t: 'cham', c: rint(rng, 0, 3), L: rint(rng, 2, 3) };
    if (r < 0.7) {
      var side = rint(rng, 0, 3), len = side % 2 ? B : A, dep = side % 2 ? A : B, w = rint(rng, 2, Mth.min(4, len - 4));
      if (w < 2 || dep < 4) return null;
      return { t: 'notch', side: side, w: w, d: rint(rng, 1, Mth.min(3, dep - 3)), p: rint(rng, 2, len - w - 2) };
    }
    var a = rint(rng, 2, Mth.min(4, A - 3)), b = rint(rng, 2, Mth.min(4, B - 3));
    if (a < 2 || b < 2) return null;
    return { t: 'step', c: rint(rng, 0, 3), a: a, b: b };
  }

  /* ------------------------------------------------------------ silhouettes (exact, by quarters) */
  // Along z (W × H): a quarter of F is lit when some cell along z holds T and S at once there.
  function silZ(F, T, S) {
    var W = F.A, H = F.B, D = T.B, out = qgrid(W, H), i, j, k, q;
    for (j = 0; j < H; j++) for (i = 0; i < W; i++) {
      var mF = F.m[j * W + i], mm = 0;
      for (q = 0; q < 4; q++) {
        if (!(mF >> q & 1)) continue;
        for (k = 0; k < D; k++) if (over(tRange(T.m[k * W + i], QC[q][0]), sRange(S.m[j * D + k], QC[q][1]))) { mm |= 1 << q; break; }
      }
      out.m[j * W + i] = mm;
    }
    return out;
  }
  // Along x (D × H, the side plane): a quarter of S is lit when some cell along x holds F and T.
  function silX(F, T, S) {
    var W = F.A, H = F.B, D = T.B, out = qgrid(D, H), i, j, k, q;
    for (j = 0; j < H; j++) for (k = 0; k < D; k++) {
      var mS = S.m[j * D + k], mm = 0;
      for (q = 0; q < 4; q++) {
        if (!(mS >> q & 1)) continue;
        for (i = 0; i < W; i++) if (over(sRange(F.m[j * W + i], QC[q][1]), sRange(T.m[k * W + i], QC[q][0]))) { mm |= 1 << q; break; }
      }
      out.m[j * D + k] = mm;
    }
    return out;
  }
  // Along y (W × D, the top plane): a quarter of T is lit when some cell along y holds F and S.
  function silY(F, T, S) {
    var W = F.A, H = F.B, D = T.B, out = qgrid(W, D), i, j, k, q;
    for (k = 0; k < D; k++) for (i = 0; i < W; i++) {
      var mT = T.m[k * W + i], mm = 0;
      for (q = 0; q < 4; q++) {
        if (!(mT >> q & 1)) continue;
        for (j = 0; j < H; j++) if (over(tRange(F.m[j * W + i], QC[q][0]), tRange(S.m[j * D + k], QC[q][1]))) { mm |= 1 << q; break; }
      }
      out.m[k * W + i] = mm;
    }
    return out;
  }
  function sils(P) { return { z: silZ(P.F, P.T, P.S), x: silX(P.F, P.T, P.S), y: silY(P.F, P.T, P.S) }; }

  /* ------------------------------------------------------------ outlines */
  // The boundary of a quarter grid as loops of points in steps (CCW), collinear points merged;
  // null when the region is empty or a vertex is shared by two loops.
  function outline(g) {
    var E = new Map(), A = g.A, i, j, q, V = 64; // vertices in doubled steps, as x * 64 + y
    function add(a, b) { var k = a * 4096 + b, r = b * 4096 + a; if (E.has(r)) E.delete(r); else E.set(k, b); }
    for (j = 0; j < g.B; j++) for (i = 0; i < A; i++) {
      var m = g.m[j * A + i];
      if (!m) continue;
      var c00 = 2 * i * V + 2 * j, c10 = c00 + 2 * V, c11 = c10 + 2, c01 = c00 + 2, cm = c00 + V + 1;
      var tri = [[c00, c10], [c10, c11], [c11, c01], [c01, c00]];
      for (q = 0; q < 4; q++) if (m >> q & 1) { add(tri[q][0], tri[q][1]); add(tri[q][1], cm); add(cm, tri[q][0]); }
    }
    if (!E.size) return null;
    var from = new Map(), bad = false;
    E.forEach(function (b, k) { var a = (k - b) / 4096; if (from.has(a)) bad = true; from.set(a, b); });
    if (bad) return null;
    var loops = [], done = new Set();
    from.forEach(function (b0, a0) {
      if (done.has(a0) || bad) return;
      var pts = [], a = a0;
      while (!done.has(a)) {
        done.add(a); pts.push([Mth.floor(a / V), a % V]);
        var nb = from.get(a);
        if (nb === undefined) { bad = true; return; }
        a = nb;
      }
      if (a !== a0) { bad = true; return; }
      loops.push(simplify(pts));
    });
    if (bad) return null;
    return loops;
  }
  function simplify(pts) {
    var out = [], n = pts.length;
    for (var i = 0; i < n; i++) {
      var a = pts[(i + n - 1) % n], b = pts[i], c = pts[(i + 1) % n];
      if ((b[0] - a[0]) * (c[1] - b[1]) - (b[1] - a[1]) * (c[0] - b[0]) !== 0) out.push([b[0] / 2, b[1] / 2]);
    }
    return out;
  }
  function polyArea(p) { var s = 0; for (var i = 0; i < p.length; i++) { var a = p[i], b = p[(i + 1) % p.length]; s += a[0] * b[1] - a[1] * b[0]; } return s / 2; }

  /* ------------------------------------------------------------ the eight turns and flips (D4) */
  // On points of an A × B box: k = 0 as is, 1 a quarter turn, 2 a half turn, 3 three quarters,
  // 4 flipped left-right, 5 flipped up-down, 6 and 7 the two diagonal flips.
  function tfPoint(k, x, y, A, B) {
    switch (k) {
      case 1: return [B - y, x]; case 2: return [A - x, B - y]; case 3: return [y, A - x];
      case 4: return [A - x, y]; case 5: return [x, B - y]; case 6: return [y, x]; case 7: return [B - y, A - x];
      default: return [x, y];
    }
  }
  function tfSize(k, A, B) { return k === 1 || k === 3 || k === 6 || k === 7 ? [B, A] : [A, B]; }
  var QMAP = []; // QMAP[k][q]: the quarter a quarter becomes
  (function () {
    for (var k = 0; k < 8; k++) {
      var row = [];
      for (var q = 0; q < 4; q++) {
        var p0 = tfPoint(k, 0, 0, 0, 0), p1 = tfPoint(k, QDIR[q][0], QDIR[q][1], 0, 0), d = [p1[0] - p0[0], p1[1] - p0[1]];
        for (var r = 0; r < 4; r++) if (QDIR[r][0] === d[0] && QDIR[r][1] === d[1]) row.push(r);
      }
      QMAP.push(row);
    }
  })();
  function tfGrid(g, k) {
    var sz = tfSize(k, g.A, g.B), out = qgrid(sz[0], sz[1]), i, j, q;
    for (j = 0; j < g.B; j++) for (i = 0; i < g.A; i++) {
      var m = g.m[j * g.A + i];
      if (!m) continue;
      var c = tfPoint(k, i + 0.5, j + 0.5, g.A, g.B), ni = Mth.floor(c[0]), nj = Mth.floor(c[1]), mm = 0;
      for (q = 0; q < 4; q++) if (m >> q & 1) mm |= 1 << QMAP[k][q];
      out.m[nj * out.A + ni] = mm;
    }
    return out;
  }
  function tfPoly(p, k, A, B) { var out = p.map(function (v) { return tfPoint(k, v[0], v[1], A, B); }); if (k >= 4) out.reverse(); return out; }
  // Cropped to its filled cells (an outline is compared by shape, wherever it sits).
  function crop(g) {
    var i0 = g.A, i1 = -1, j0 = g.B, j1 = -1, i, j;
    for (j = 0; j < g.B; j++) for (i = 0; i < g.A; i++) if (g.m[j * g.A + i]) { if (i < i0) i0 = i; if (i > i1) i1 = i; if (j < j0) j0 = j; if (j > j1) j1 = j; }
    if (i1 < 0) return qgrid(1, 1);
    var out = qgrid(i1 - i0 + 1, j1 - j0 + 1);
    for (j = j0; j <= j1; j++) for (i = i0; i <= i1; i++) out.m[(j - j0) * out.A + (i - i0)] = g.m[j * g.A + i];
    return out;
  }
  // Compare two cropped grids under every turn and flip of the first: 'match' (equal), 'differ'
  // (every alignment is off in size or in a whole cell and two units² of quarters), else 'close'.
  function compare(a, b) {
    var res = 'differ';
    for (var k = 0; k < 8 && res !== 'match'; k++) {
      var t = tfGrid(a, k);
      if (t.A !== b.A || t.B !== b.B) continue;
      var diff = 0, whole = false;
      for (var n = 0; n < t.m.length; n++) {
        var x = t.m[n] ^ b.m[n];
        if (!x) continue;
        diff += (x & 1) + (x >> 1 & 1) + (x >> 2 & 1) + (x >> 3 & 1);
        if (x === 15) whole = true;
      }
      if (!diff) res = 'match';
      else if (!(whole && diff >= 8)) res = 'close';
    }
    return res;
  }
  function dist(a, b) { // quarters that differ at the best alignment; another size counts as far (a constant)
    var best = 2000;
    for (var k = 0; k < 8; k++) {
      var t = tfGrid(a, k);
      if (t.A !== b.A || t.B !== b.B) continue;
      var d = 0;
      for (var n = 0; n < t.m.length; n++) { var x = t.m[n] ^ b.m[n]; d += (x & 1) + (x >> 1 & 1) + (x >> 2 & 1) + (x >> 3 & 1); }
      if (d < best) best = d;
    }
    return best;
  }

  /* ------------------------------------------------------------ poses and the camera */
  // World = R · solid (row-major integer rotations). Upright: as built, or turned a quarter about
  // the vertical; lying: on its side or its front. The camera looks from azimuth 35°, elevation 28°
  // (Slice's view), orthographic; VIEW points from the solid toward the viewer (literal constants).
  var POSES = {
    I: [1, 0, 0, 0, 1, 0, 0, 0, 1], Ry: [0, 0, 1, 0, 1, 0, -1, 0, 0],
    Rx: [1, 0, 0, 0, 0, -1, 0, 1, 0], Rxm: [1, 0, 0, 0, 0, 1, 0, -1, 0], Rz: [0, -1, 0, 1, 0, 0, 0, 0, 1], Rzm: [0, 1, 0, -1, 0, 0, 0, 0, 1],
  };
  var POSE_SETS = [['I', 'Ry'], ['Rx', 'Rxm', 'Rz', 'Rzm']];
  var VIEW = [0.50643758, 0.46947156, 0.72326798];
  var AXES = ['x', 'y', 'z'];
  function tmul(R, v) { return [R[0] * v[0] + R[3] * v[1] + R[6] * v[2], R[1] * v[0] + R[4] * v[1] + R[7] * v[2], R[2] * v[0] + R[5] * v[1] + R[8] * v[2]]; }
  // The solid's axis whose ends face world x (1), y (2) or z (0): the keyview levels front, side, top.
  function axisFacing(R, world) {
    for (var a = 0; a < 3; a++) { var e = [0, 0, 0]; e[a] = 1; var w = [R[0] * e[0] + R[1] * e[1] + R[2] * e[2], R[3] * e[0] + R[4] * e[1] + R[5] * e[2], R[6] * e[0] + R[7] * e[1] + R[8] * e[2]]; if (w[world] !== 0) return AXES[a]; }
    return 'z';
  }
  var KEYVIEW_WORLD = [2, 0, 1]; // front (world z), side (world x), top (world y)
  var PROF_OF = { z: 'F', y: 'T', x: 'S' }, AXIS_OF = { F: 'z', T: 'y', S: 'x' };

  /* ------------------------------------------------------------ polygons: inside tests and rays */
  function pip(p, x, y) {
    var c = false;
    for (var i = 0, j = p.length - 1; i < p.length; j = i++) {
      var a = p[i], b = p[j];
      if ((a[1] > y) !== (b[1] > y) && x < (b[0] - a[0]) * (y - a[1]) / (b[1] - a[1]) + a[0]) c = !c;
    }
    return c;
  }
  // t-intervals (t ≥ 0) where the 2D ray (px, py) + t (dx, dy) lies inside polygon p.
  function rayIntervals(p, px, py, dx, dy) {
    if (Mth.abs(dx) < 1e-12 && Mth.abs(dy) < 1e-12) return pip(p, px, py) ? [[0, INF]] : [];
    var ts = [0], i, n = p.length;
    for (i = 0; i < n; i++) {
      var a = p[i], b = p[(i + 1) % n], ex = b[0] - a[0], ey = b[1] - a[1], det = -dx * ey + ex * dy;
      if (Mth.abs(det) < 1e-12) continue;
      var ax = a[0] - px, ay = a[1] - py, t = (-ax * ey + ex * ay) / det, u = (dx * ay - dy * ax) / det;
      if (u >= -1e-9 && u <= 1 + 1e-9 && t > 1e-9) ts.push(t);
    }
    ts.sort(function (x, y) { return x - y; });
    ts.push(1e4);
    var out = [];
    for (i = 0; i + 1 < ts.length; i++) {
      if (ts[i + 1] - ts[i] < 1e-9) continue;
      var m = (ts[i] + ts[i + 1]) / 2;
      if (pip(p, px + m * dx, py + m * dy)) {
        if (out.length && Mth.abs(out[out.length - 1][1] - ts[i]) < 1e-9) out[out.length - 1][1] = ts[i + 1]; else out.push([ts[i], ts[i + 1]]);
      }
    }
    return out;
  }
  function meet(A, B) {
    var out = [];
    A.forEach(function (a) { B.forEach(function (b) { var lo = Mth.max(a[0], b[0]), hi = Mth.min(a[1], b[1]); if (hi - lo > 1e-7) out.push([lo, hi]); }); });
    return out;
  }
  // Does the ray from point o (solid coordinates, steps) along d pass through the solid's inside?
  function rayHits(prof, o, d) {
    var a = rayIntervals(prof.F, o[0], o[1], d[0], d[1]);
    if (!a.length) return false;
    a = meet(a, rayIntervals(prof.T, o[0], o[2], d[0], d[2]));
    if (!a.length) return false;
    return meet(a, rayIntervals(prof.S, o[2], o[1], d[2], d[1])).length > 0;
  }
  function inSolid(prof, x, y, z) { return pip(prof.F, x, y) && pip(prof.T, x, z) && pip(prof.S, z, y); }
  // Feature edges of a profile polygon: runs of edges off the bounding rectangle (one run = one feature).
  function featureRuns(p, A, B) {
    var n = p.length, on = [], i;
    for (i = 0; i < n; i++) {
      var a = p[i], b = p[(i + 1) % n];
      on.push((a[0] === 0 && b[0] === 0) || (a[0] === A && b[0] === A) || (a[1] === 0 && b[1] === 0) || (a[1] === B && b[1] === B));
    }
    var start = on.indexOf(true), runs = [], cur = null;
    if (start < 0) return [];
    for (var k = 1; k <= n; k++) {
      i = (start + k) % n;
      if (on[i]) { if (cur) { runs.push(cur); cur = null; } }
      else (cur = cur || []).push([p[i], p[(i + 1) % n]]);
    }
    if (cur) runs.push(cur);
    return runs;
  }
  // Every feature shows in the picture: some point on its faces (just outside them) sees the viewer.
  function featuresSeen(prof, W, H, D, poseKey) {
    var dir = tmul(POSES[poseKey], VIEW), dims = { F: [W, H, D], T: [W, D, H], S: [D, H, W] }, seen = [];
    ['F', 'T', 'S'].forEach(function (name) {
      var dm = dims[name];
      featureRuns(prof[name], dm[0], dm[1]).forEach(function (run) {
        var hits = 0;
        run.forEach(function (e) {
          var ex = e[1][0] - e[0][0], ey = e[1][1] - e[0][1], len = Mth.sqrt(ex * ex + ey * ey), nx = ey / len, ny = -ex / len;
          [0.21, 0.5, 0.79].forEach(function (u) {
            var a = e[0][0] + u * ex + 0.01 * nx, b = e[0][1] + u * ey + 0.01 * ny;
            for (var s = 0; s < 8; s++) {
              var c = (s + 0.37) / 8 * dm[2], o = name === 'F' ? [a, b, c] : name === 'T' ? [a, c, b] : [c, b, a];
              var face = name === 'F' ? pip(prof.T, o[0], o[2]) && pip(prof.S, o[2], o[1]) : name === 'T' ? pip(prof.F, o[0], o[1]) && pip(prof.S, o[2], o[1]) : pip(prof.F, o[0], o[1]) && pip(prof.T, o[0], o[2]);
              if (face && !rayHits(prof, o, dir)) hits++;
            }
            // The end of the extrusion that faces the viewer, just inside the outline here: its
            // visible surface along the axis shows the feature as part of its outline.
            var ax = name === 'F' ? 2 : name === 'T' ? 1 : 0, sg = dir[ax] >= 0 ? 1 : -1, ia = e[0][0] + u * ex - 0.02 * nx, ib = e[0][1] + u * ey - 0.02 * ny;
            var st = name === 'F' ? [ia, ib, 0] : name === 'T' ? [ia, 0, ib] : [0, ib, ia], dd = [0, 0, 0];
            st[ax] = sg > 0 ? dm[2] + 1 : -1; dd[ax] = -sg;
            var iv = meet(meet(rayIntervals(prof.F, st[0], st[1], dd[0], dd[1]), rayIntervals(prof.T, st[0], st[2], dd[0], dd[2])), rayIntervals(prof.S, st[2], st[1], dd[2], dd[1]));
            if (iv.length) {
              var t0 = Mth.min.apply(null, iv.map(function (q) { return q[0]; })), sp = st.slice();
              sp[ax] = st[ax] + dd[ax] * (t0 - 0.01);
              if (!rayHits(prof, sp, dir)) hits++;
            }
          });
        });
        seen.push({ prof: name, hits: hits });
      });
    });
    return seen;
  }

  /* ------------------------------------------------------------ the solid's surface (for the view) */
  // Faces of the boundary, exactly: on cell planes where one side's piece is present and the other
  // not (the region is the third profile's cell there), and the cut faces of half cells inside a
  // cell (the diagonal plane clipped by the other halves). Points in steps, CCW seen from outside.
  var ALL1 = [15, 3, 6], ALL0 = [15, 12, 9], ALLT1 = [15, 6, 12], ALLT0 = [15, 3, 9];
  function has(set, m) { return set.indexOf(m) >= 0; }
  function cellPoly(m) { // a profile cell's region in its own (s, t)
    return m === 15 ? [[0, 0], [1, 0], [1, 1], [0, 1]] : m === 3 ? [[0, 0], [1, 0], [1, 1]] : m === 6 ? [[1, 0], [1, 1], [0, 1]] : m === 12 ? [[0, 0], [1, 1], [0, 1]] : m === 9 ? [[0, 0], [1, 0], [0, 1]] : null;
  }
  function sub(a, b) { return [a[0] - b[0], a[1] - b[1], a[2] - b[2]]; }
  function cross(a, b) { return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]; }
  function dot(a, b) { return a[0] * b[0] + a[1] * b[1] + a[2] * b[2]; }
  function newell(pts) { var n = [0, 0, 0]; for (var i = 0; i < pts.length; i++) { var a = pts[i], b = pts[(i + 1) % pts.length]; n[0] += (a[1] - b[1]) * (a[2] + b[2]); n[1] += (a[2] - b[2]) * (a[0] + b[0]); n[2] += (a[0] - b[0]) * (a[1] + b[1]); } return n; }
  function orient(pts, nrm) { return dot(newell(pts), nrm) < 0 ? pts.slice().reverse() : pts; }
  // Half-space of a half cell in the cube's own (u, v, w): [a, b, c, d] with a·u + b·v + c·w + d ≥ 0.
  function halfOf(m, si, ti) {
    var h = [0, 0, 0, 0];
    if (m === 3) { h[si] = 1; h[ti] = -1; } else if (m === 12) { h[si] = -1; h[ti] = 1; }
    else if (m === 6) { h[si] = 1; h[ti] = 1; h[3] = -1; } else if (m === 9) { h[si] = -1; h[ti] = -1; h[3] = 1; } else return null;
    return h;
  }
  function clipPoly(pts, h) {
    var out = [], n = pts.length;
    function f(p) { return h[0] * p[0] + h[1] * p[1] + h[2] * p[2] + h[3]; }
    for (var i = 0; i < n; i++) {
      var a = pts[i], b = pts[(i + 1) % n], fa = f(a), fb = f(b);
      if (fa >= -1e-9) out.push(a);
      if ((fa > 1e-9 && fb < -1e-9) || (fa < -1e-9 && fb > 1e-9)) { var t = fa / (fa - fb); out.push([a[0] + t * (b[0] - a[0]), a[1] + t * (b[1] - a[1]), a[2] + t * (b[2] - a[2])]); }
    }
    return out;
  }
  function polyArea3(pts) { var n = newell(pts); return Mth.sqrt(dot(n, n)) / 2; }
  function surface(F, T, S) {
    var W = F.A, H = F.B, D = T.B, faces = [], i, j, k;
    function fm(a, b) { return a < 0 || b < 0 || a >= W || b >= H ? 0 : F.m[b * W + a]; }
    function tm(a, c) { return a < 0 || c < 0 || a >= W || c >= D ? 0 : T.m[c * W + a]; }
    function sm(c, b) { return c < 0 || b < 0 || c >= D || b >= H ? 0 : S.m[b * D + c]; }
    function push(pts, n) { if (pts.length >= 3 && polyArea3(pts) > 1e-9) faces.push({ pts: orient(pts, n), n: n }); }
    // planes x = i: region S(k, j) in (z, y)
    for (i = 0; i <= W; i++) for (j = 0; j < H; j++) for (k = 0; k < D; k++) {
      var ms = sm(k, j); if (!ms) continue;
      var L = i > 0 && has(ALL1, fm(i - 1, j)) && has(ALL1, tm(i - 1, k)), R = i < W && has(ALL0, fm(i, j)) && has(ALL0, tm(i, k));
      if (L !== R) push(cellPoly(ms).map(function (q) { return [i, j + q[1], k + q[0]]; }), [L ? 1 : -1, 0, 0]);
    }
    // planes y = j: region T(i, k) in (x, z)
    for (j = 0; j <= H; j++) for (i = 0; i < W; i++) for (k = 0; k < D; k++) {
      var mt = tm(i, k); if (!mt) continue;
      var Lo = j > 0 && has(ALLT1, fm(i, j - 1)) && has(ALLT1, sm(k, j - 1)), Up = j < H && has(ALLT0, fm(i, j)) && has(ALLT0, sm(k, j));
      if (Lo !== Up) push(cellPoly(mt).map(function (q) { return [i + q[0], j, k + q[1]]; }), [0, Lo ? 1 : -1, 0]);
    }
    // planes z = k: region F(i, j) in (x, y)
    for (k = 0; k <= D; k++) for (i = 0; i < W; i++) for (j = 0; j < H; j++) {
      var mf = fm(i, j); if (!mf) continue;
      var Bk = k > 0 && has(ALLT1, tm(i, k - 1)) && has(ALL1, sm(k - 1, j)), Fr = k < D && has(ALLT0, tm(i, k)) && has(ALL0, sm(k, j));
      if (Bk !== Fr) push(cellPoly(mf).map(function (q) { return [i + q[0], j + q[1], k]; }), [0, 0, Bk ? 1 : -1]);
    }
    // cut faces inside cells
    for (i = 0; i < W; i++) for (j = 0; j < H; j++) for (k = 0; k < D; k++) {
      var a = F.m[j * W + i], b = T.m[k * W + i], c = S.m[j * D + k];
      if (!a || !b || !c || (a === 15 && b === 15 && c === 15)) continue;
      var hs = [halfOf(a, 0, 1), halfOf(b, 0, 2), halfOf(c, 2, 1)];
      for (var e = 0; e < 3; e++) {
        var h = hs[e]; if (!h) continue;
        var free = e === 0 ? 2 : e === 1 ? 1 : 0, ends = [];
        // the diagonal of the profile cell: points of the cube with h = 0 at the free axis' 0 and 1
        [[0, 0], [1, 0], [1, 1], [0, 1]].forEach(function (q) {
          var p = [0, 0, 0], idx = [0, 1, 2].filter(function (x) { return x !== free; });
          p[idx[0]] = q[0]; p[idx[1]] = q[1];
          if (Mth.abs(h[0] * p[0] + h[1] * p[1] + h[2] * p[2] + h[3]) < 1e-9) ends.push(p);
        });
        if (ends.length !== 2) continue;
        var rect = [ends[0].slice(), ends[1].slice(), ends[1].slice(), ends[0].slice()];
        rect[0][free] = 0; rect[1][free] = 0; rect[2][free] = 1; rect[3][free] = 1;
        for (var o = 0; o < 3; o++) if (o !== e && hs[o]) rect = clipPoly(rect, hs[o]);
        if (rect.length < 3) continue;
        var nl = Mth.sqrt(h[0] * h[0] + h[1] * h[1] + h[2] * h[2]);
        push(rect.map(function (p) { return [i + p[0], j + p[1], k + p[2]]; }), [-h[0] / nl, -h[1] / nl, -h[2] / nl]);
      }
    }
    return faces;
  }
  // The solid's edges: unit lattice pieces of face borders where the faces on either side differ.
  function edges(faces) {
    var map = new Map();
    faces.forEach(function (f) {
      var nk = f.n.map(function (x) { return Mth.round(x * 1000); }).join(',');
      for (var a = 0; a < f.pts.length; a++) {
        var p = f.pts[a].map(function (x) { return Mth.round(x * 2); }), q = f.pts[(a + 1) % f.pts.length].map(function (x) { return Mth.round(x * 2); });
        var d = sub(q, p), g = gcd3(d), st = [d[0] / g, d[1] / g, d[2] / g];
        for (var s = 0; s < g; s++) {
          var u = [p[0] + st[0] * s, p[1] + st[1] * s, p[2] + st[2] * s], v = [u[0] + st[0], u[1] + st[1], u[2] + st[2]];
          var key = u.join(',') < v.join(',') ? u.join(',') + '|' + v.join(',') : v.join(',') + '|' + u.join(',');
          var e = map.get(key);
          if (!e) { e = { a: u, b: v, ns: {}, n: 0 }; map.set(key, e); }
          e.ns[nk] = 1; e.n++;
        }
      }
    });
    var out = [], open = 0;
    map.forEach(function (e) { if (e.n % 2) open++; if (Object.keys(e.ns).length > 1 || e.n === 1) out.push([e.a.map(function (x) { return x / 2; }), e.b.map(function (x) { return x / 2; })]); });
    out.open = open;
    return out;
  }
  function gcd(a, b) { a = Mth.abs(a); b = Mth.abs(b); while (b) { var t = a % b; a = b; b = t; } return a; }
  function gcd3(d) { return Mth.max(1, gcd(gcd(d[0], d[1]), d[2])); }

  /* ------------------------------------------------------------ rasters (validator) */
  var RES = 6; // samples per step: a twelfth of a unit
  // Samples sit a little off the lattice, so none lies on an edge (straight or 45°): a polygon and its
  // turned copy then give identical rasters when rasterised in place (rcompare turns the polygon).
  var DX = 0.0137, DY = 0.0071;
  // The silhouette along an axis by rays through the stored polygons: at each sample, the profile of
  // that axis holds the point and the other two profiles share some stretch of the ray.
  function intervalsAt(p, fixedIsX, c, lo, hi) { // stretches of the line (x = c) or (y = c) inside p
    var o = fixedIsX ? rayIntervals(p, c, lo - 1, 0, 1) : rayIntervals(p, lo - 1, c, 1, 0);
    return o.map(function (iv) { return [iv[0] + lo - 1, iv[1] + lo - 1]; });
  }
  function raySil(prof, W, H, D, axis) {
    var A = axis === 'z' ? W : axis === 'x' ? D : W, B = axis === 'z' ? H : axis === 'x' ? H : D, nA = A * RES, nB = B * RES;
    var r = new Uint8Array(nA * nB), a, b, colI = [], rowI = [];
    for (a = 0; a < nA; a++) {
      var u = (a + 0.5) / RES + DX;
      colI.push(axis === 'z' ? intervalsAt(prof.T, true, u, 0, D) : axis === 'x' ? intervalsAt(prof.T, false, u, 0, W) : intervalsAt(prof.F, true, u, 0, H));
    }
    for (b = 0; b < nB; b++) {
      var v = (b + 0.5) / RES + DY;
      rowI.push(axis === 'z' ? intervalsAt(prof.S, false, v, 0, D) : axis === 'x' ? intervalsAt(prof.F, false, v, 0, W) : intervalsAt(prof.S, true, v, 0, H));
    }
    var P = axis === 'z' ? prof.F : axis === 'x' ? prof.S : prof.T, inP = scanFill(P, nA, nB);
    for (b = 0; b < nB; b++) for (a = 0; a < nA; a++) {
      if (!inP[b * nA + a]) continue;
      if (meet(colI[a], rowI[b]).length) r[b * nA + a] = 1;
    }
    return cropRaster({ w: nA, h: nB, r: r });
  }
  // Samples of an nA × nB raster inside polygon q (origin at the raster's corner), filled row by row
  // between sorted edge crossings: the same rule as pip() (half-open in y), much faster.
  function scanFill(q, nA, nB) {
    var r = new Uint8Array(nA * nB), xs = [], n = q.length, b, i, a;
    for (b = 0; b < nB; b++) {
      var y = (b + 0.5) / RES + DY;
      xs.length = 0;
      for (i = 0; i < n; i++) {
        var u = q[i], v = q[(i + 1) % n];
        if ((u[1] > y) !== (v[1] > y)) xs.push(u[0] + (y - u[1]) * (v[0] - u[0]) / (v[1] - u[1]));
      }
      xs.sort(function (x1, x2) { return x1 - x2; });
      for (i = 0; i + 1 < xs.length; i += 2) {
        var a0 = Mth.max(0, Mth.ceil((xs[i] - DX) * RES - 0.5)), a1 = Mth.min(nA - 1, Mth.ceil((xs[i + 1] - DX) * RES - 0.5) - 1);
        for (a = a0; a <= a1; a++) r[b * nA + a] = 1;
      }
    }
    return r;
  }
  // A polygon rasterised over its own box, after turn or flip k (0–7).
  function polyRaster(p, k) {
    var x0 = INF, y0 = INF, x1 = -INF, y1 = -INF;
    p.forEach(function (v) { x0 = Mth.min(x0, v[0]); y0 = Mth.min(y0, v[1]); x1 = Mth.max(x1, v[0]); y1 = Mth.max(y1, v[1]); });
    var q = p.map(function (v) { return [v[0] - x0, v[1] - y0]; });
    if (k) q = tfPoly(q, k, x1 - x0, y1 - y0);
    var sz = tfSize(k || 0, x1 - x0, y1 - y0), nA = Mth.round(sz[0] * RES), nB = Mth.round(sz[1] * RES);
    return cropRaster({ w: nA, h: nB, r: scanFill(q, nA, nB) });
  }
  function cropRaster(R) {
    var a0 = R.w, a1 = -1, b0 = R.h, b1 = -1, a, b;
    for (b = 0; b < R.h; b++) for (a = 0; a < R.w; a++) if (R.r[b * R.w + a]) { if (a < a0) a0 = a; if (a > a1) a1 = a; if (b < b0) b0 = b; if (b > b1) b1 = b; }
    if (a1 < 0) return { w: 0, h: 0, r: new Uint8Array(0) };
    var w = a1 - a0 + 1, h = b1 - b0 + 1, out = new Uint8Array(w * h);
    for (b = 0; b < h; b++) for (a = 0; a < w; a++) out[b * w + a] = R.r[(b + b0) * R.w + a + a0];
    return { w: w, h: h, r: out };
  }
  function tfRaster(R, k) {
    var sz = tfSize(k, R.w, R.h), out = new Uint8Array(sz[0] * sz[1]);
    for (var b = 0; b < R.h; b++) for (var a = 0; a < R.w; a++) {
      if (!R.r[b * R.w + a]) continue;
      var c = tfPoint(k, a + 0.5, b + 0.5, R.w, R.h);
      out[Mth.floor(c[1]) * sz[0] + Mth.floor(c[0])] = 1;
    }
    return { w: sz[0], h: sz[1], r: out };
  }
  var DISC = [];
  (function () { for (var y = -3; y < 3; y++) for (var x = -3; x < 3; x++) { var cx = x + 0.5, cy = y + 0.5; if (cx * cx + cy * cy <= 9) DISC.push([x, y]); } })();
  // 'match' (equal boxes, IoU ≥ .985), 'differ' (boxes off by half a unit, or a difference of half a
  // unit² holding a disc of a quarter unit) or 'close', at the best of the eight alignments.
  // A: a polygon (turned and flipped here; cache: its rasters by turn), B: a raster.
  function rcompare(A, B, cache) {
    var res = 'differ', c = cache || {};
    if (!c.box) {
      var x0 = INF, y0 = INF, x1 = -INF, y1 = -INF;
      A.forEach(function (v) { x0 = Mth.min(x0, v[0]); y0 = Mth.min(y0, v[1]); x1 = Mth.max(x1, v[0]); y1 = Mth.max(y1, v[1]); });
      c.box = [Mth.round((x1 - x0) * RES), Mth.round((y1 - y0) * RES)];
    }
    for (var k = 0; k < 8 && res !== 'match'; k++) {
      var sz = tfSize(k, c.box[0], c.box[1]);
      if (Mth.abs(sz[0] - B.w) >= RES || Mth.abs(sz[1] - B.h) >= RES) continue;
      var t = c[k] || (c[k] = polyRaster(A, k));
      if (Mth.abs(t.w - B.w) >= RES || Mth.abs(t.h - B.h) >= RES) continue;
      if (t.w !== B.w || t.h !== B.h) { res = 'close'; continue; }
      var inter = 0, uni = 0, diff = new Uint8Array(t.r.length), nd = 0, n;
      for (n = 0; n < t.r.length; n++) { var x = t.r[n], y = B.r[n]; if (x && y) inter++; if (x || y) uni++; if (x !== y) { diff[n] = 1; nd++; } }
      if (uni && inter / uni >= 0.985) { res = 'match'; break; }
      // half a unit² (two steps²); samples on a diagonal edge may fall either way, so 0.45 here
      // (the generator keeps 0.5 on exact quarters)
      if (nd < 0.9 * 2 * RES * RES || !holdsDisc(diff, t.w, t.h)) res = 'close';
    }
    return res;
  }
  function holdsDisc(diff, w, h) {
    for (var b = 3; b <= h - 3; b++) for (var a = 3; a <= w - 3; a++) {
      var ok = true;
      for (var i = 0; i < DISC.length && ok; i++) if (!diff[(b + DISC[i][1]) * w + a + DISC[i][0]]) ok = false;
      if (ok) return true;
    }
    return false;
  }

  /* ------------------------------------------------------------ solids */
  var DIMS = [6, 7, 8, 9, 10];
  function profDims(W, H, D) { return { F: [W, H], T: [W, D], S: [D, H] }; }
  function buildProfiles(W, H, D, feats) {
    var dm = profDims(W, H, D), P = {};
    for (var n in dm) { P[n] = profile(dm[n][0], dm[n][1], feats[n]); if (!P[n]) return null; }
    return P;
  }
  function polysOf(P) {
    var out = {};
    for (var n in P) { var L = outline(P[n]); if (!L || L.length !== 1) return null; out[n] = L[0]; }
    return out;
  }
  // One random change to one profile's features: removed, moved, resized, added, or a corner swapped.
  function mutate(rng, feats, name, dm, cham) {
    var list = feats[name].map(function (f) { return Object.assign({}, f); }), r = rng.next(), A = dm[0], B = dm[1];
    if (!list.length || r < 0.18) { var f0 = randomFeature(rng, A, B, cham); if (!f0) return null; list.push(f0); }
    else {
      var i = rint(rng, 0, list.length - 1), f = list[i];
      if (r < 0.36 && list.length > 1) list.splice(i, 1);
      else if (f.t === 'notch') {
        var r2 = rng.next();
        if (r2 < 0.35) f.p += rpick(rng, [-2, -1, 1, 2]);
        else if (r2 < 0.6) f.w += rpick(rng, [-1, 1, 2]);
        else if (r2 < 0.85) f.d += rpick(rng, [-1, 1]);
        else f.side = (f.side + 2) % 4;
      } else if (f.t === 'step') {
        var r3 = rng.next();
        if (r3 < 0.35) f.a += rpick(rng, [-1, 1]); else if (r3 < 0.7) f.b += rpick(rng, [-1, 1]); else f.c = (f.c + rpick(rng, [1, 2, 3])) % 4;
      } else if (rng.next() < 0.5) f.L = f.L === 2 ? 3 : 2; else f.c = (f.c + rpick(rng, [1, 2, 3])) % 4;
      if ((f.w !== undefined && f.w < 2) || (f.d !== undefined && f.d < 1) || (f.a !== undefined && f.a < 2) || (f.b !== undefined && f.b < 2)) return null;
    }
    var out = {}; for (var n in feats) out[n] = n === name ? list : feats[n];
    return out;
  }
  // The outline stretched by at least 25 % along one of its axes: a column or row band repeated.
  function stretch(rng, g) {
    var horiz = rng.chance(0.5), A = g.A, B = g.B, n = horiz ? A : B, add = Mth.max(2, Mth.ceil(0.25 * n)), same = [], i, j;
    for (i = 1; i < n; i++) {
      var eq = true;
      for (j = 0; j < (horiz ? B : A) && eq; j++) { var a = horiz ? g.m[j * A + i] : g.m[i * A + j], b = horiz ? g.m[j * A + i - 1] : g.m[(i - 1) * A + j]; if (a !== b || (a !== 15 && a !== 0)) eq = false; }
      if (eq) same.push(i);
    }
    if (!same.length) return null;
    var at = rpick(rng, same), out = horiz ? qgrid(A + add, B) : qgrid(A, B + add);
    for (j = 0; j < out.B; j++) for (i = 0; i < out.A; i++) {
      var si = horiz ? (i < at ? i : i < at + add ? at : i - add) : i, sj = horiz ? j : (j < at ? j : j < at + add ? at : j - add);
      out.m[j * out.A + i] = g.m[sj * A + si];
    }
    return out;
  }

  /* ------------------------------------------------------------ shortcut solvers (options as grids) */
  function pickShare(scores, high) {
    var best = high ? -INF : INF, ties = 0, i;
    for (i = 0; i < scores.length; i++) if (high ? scores[i] > best : scores[i] < best) best = scores[i];
    for (i = 0; i < scores.length; i++) if (scores[i] === best) ties++;
    return scores[0] === best ? 1 / ties : 0;
  }
  var SOLVERS = ['largest area', 'smallest area', 'most corners', 'fewest corners', 'like the others', 'odd one out', 'box fits the solid'];
  function fitsBox(g, W, H, D) {
    var pairs = [[W, H], [W, D], [D, H]];
    return pairs.some(function (p) { return (g.A === p[0] && g.B === p[1]) || (g.A === p[1] && g.B === p[0]); }) ? 1 : 0;
  }
  function shares(set, W, H, D, M) { // set[0] is the key; entries { g, corners, id }; M: distances by id
    var ar = set.map(function (o) { return area4(o.g); }), co = set.map(function (o) { return o.corners; });
    var sum = set.map(function (a, i) { var s = 0; set.forEach(function (b, j) { if (i !== j) s += M ? M[a.id][b.id] : dist(a.g, b.g); }); return s; });
    var fit = set.map(function (o) { return fitsBox(o.g, W, H, D); });
    return [pickShare(ar, true), pickShare(ar, false), pickShare(co, true), pickShare(co, false), pickShare(sum, false), pickShare(sum, true), pickShare(fit, true)];
  }
  var WEIGHTS = [1, 1, 1, 1, 3, 1.5, 1.5];
  function chooseFoils(rng, key, pool, W, H, D, needProp) {
    var idx = rshuffle(rng, pool.map(function (_, i) { return i; })).slice(0, 12), best = null, bestScore = INF;
    var all = [key].concat(idx.map(function (i) { return pool[i]; })), M = [];
    all.forEach(function (o, i) { o.id = i; M.push([]); });
    all.forEach(function (a, i) { all.forEach(function (b, j) { M[i][j] = j < i ? M[j][i] : i === j ? 0 : dist(a.g, b.g); }); });
    var want = SOLVERS.map(function () { return rng.chance(0.2) ? 1 : 0; });
    for (var a = 0; a < idx.length; a++) for (var b = a + 1; b < idx.length; b++) for (var c = b + 1; c < idx.length; c++) for (var d = c + 1; d < idx.length; d++) {
      var set = [pool[idx[a]], pool[idx[b]], pool[idx[c]], pool[idx[d]]];
      var np = set.filter(function (o) { return o.kind === 'proportion'; }).length;
      if (np !== (needProp ? 1 : 0)) continue;
      var sh = shares([key].concat(set), W, H, D, M), score = 0;
      for (var k = 0; k < sh.length; k++) score += WEIGHTS[k] * Mth.abs(sh[k] - want[k]);
      if (score < bestScore - 1e-9) { bestScore = score; best = set; }
    }
    return best;
  }

  /* ------------------------------------------------------------ generate */
  var stats = { tries: 0, nulls: 0, invalid: 0, errors: 0, fallbacks: 0, unseen: 0, interact: 0, lastInvalid: null, lastError: null };
  function sameGrid(a, b) { if (a.A !== b.A || a.B !== b.B) return false; for (var k = 0; k < a.m.length; k++) if (a.m[k] !== b.m[k]) return false; return true; }
  var FEATURES = [1, 2, 3, 4], EDGES = ['straight', 'chamfers'], KEYVIEW = ['front', 'side', 'top'], POSE = ['upright', 'lying'], FOILS = ['features', 'proportion'];
  function lvl(params, k, n) { var x = params ? params[k] : 0; return Number.isInteger(x) && x >= 0 && x < n ? x : 0; }
  function cleanParams(params) {
    return { features: lvl(params, 'features', 4), edges: lvl(params, 'edges', 2), keyview: lvl(params, 'keyview', 3), pose: lvl(params, 'pose', 2), foils: lvl(params, 'foils', 2) };
  }
  function build(rng, p) {
    var dims = rshuffle(rng, DIMS).slice(0, 3), W = dims[0], H = dims[1], D = dims[2];
    var pose = rpick(rng, POSE_SETS[p.pose]), keyAxis = axisFacing(POSES[pose], KEYVIEW_WORLD[p.keyview]), keyProf = PROF_OF[keyAxis];
    var n = FEATURES[p.features], cham = p.edges === 1, dm = profDims(W, H, D), feats = { F: [], T: [], S: [] }, names = ['F', 'T', 'S'];
    for (var f = 0; f < n; f++) {
      // The first feature goes on the key's profile, later ones mostly on the other two, so the key
      // is not simply the profile with the most features.
      var others = names.filter(function (x) { return x !== keyProf; }), name = f === 0 ? keyProf : rng.chance(0.7) ? rpick(rng, others) : keyProf, placed = false;
      for (var t = 0; t < 12 && !placed; t++) {
        var nf = randomFeature(rng, dm[name][0], dm[name][1], cham);
        if (cham && f === 0 && nf && nf.t !== 'cham' && rng.chance(0.6)) nf = { t: 'cham', c: rint(rng, 0, 3), L: rint(rng, 2, 3) };
        if (!nf) continue;
        var trial = feats[name].concat([nf]);
        if (profile(dm[name][0], dm[name][1], trial)) { feats[name] = trial; placed = true; }
      }
      if (!placed) return null;
    }
    if (cham && !names.some(function (nm) { return feats[nm].some(function (x) { return x.t === 'cham'; }); })) return null;
    var P = buildProfiles(W, H, D, feats), polys = P && polysOf(P);
    if (!polys) return null;
    var seen = featuresSeen(polys, W, H, D, pose);
    if (seen.some(function (s) { return s.hits < 2; })) { stats.unseen++; return null; }
    // Each silhouette is its own profile: no profile cuts away another's outline (no interactions),
    // so every outline is a profile polygon spanning its full rectangle.
    var S3 = sils(P);
    if (!sameGrid(S3.z, P.F) || !sameGrid(S3.y, P.T) || !sameGrid(S3.x, P.S)) { stats.interact++; return null; }
    var crops = { z: P.F, y: P.T, x: P.S }, key = crops[keyAxis], keyL = [polys[keyProf]];
    // Foil candidates: neighbouring solids' outlines (every axis), and stretched key outlines.
    var pool = [];
    function admit(g, kind, axis) {
      if (AXES.some(function (a) { return compare(g, crops[a]) !== 'differ'; })) return;
      if (pool.some(function (o) { return compare(g, o.g) !== 'differ'; })) return;
      var L = outline(g);
      if (!L || L.length !== 1) return;
      pool.push({ g: g, kind: kind, axis: axis, corners: L[0].length, poly: L[0] });
    }
    // A hidden parent one change away from the key's profile: its other children are foils too, so
    // the key is not the centre of the family (the "most like the others" solver).
    // The key's own profile foils are its siblings (other children of the parent), never its children.
    var parent = null;
    for (var pt = 0; pt < 8 && !parent; pt++) { var fp = mutate(rng, feats, keyProf, dm[keyProf], cham); if (fp && profile(dm[keyProf][0], dm[keyProf][1], fp[keyProf])) parent = fp; }
    if (!parent) return null;
    var gp = profile(dm[keyProf][0], dm[keyProf][1], parent[keyProf]);
    if (gp) admit(gp, 'feature', keyAxis); // the parent itself: the centre of the key's family
    for (var m = 0; m < 44 && pool.length < 20; m++) {
      var r0 = rng.next(), nm = r0 < 0.88 ? keyProf : rpick(rng, names.filter(function (x) { return x !== keyProf; }));
      var fe = mutate(rng, nm === keyProf ? parent : feats, nm, dm[nm], cham);
      if (fe && nm === keyProf && rng.chance(0.4)) fe = mutate(rng, fe, nm, dm[nm], cham) || fe; // farther siblings too
      if (!fe) continue;
      var g2 = profile(dm[nm][0], dm[nm][1], fe[nm]);
      if (g2) admit(g2, 'feature', AXIS_OF[nm]);
    }
    if (p.foils === 1) for (var s = 0; s < 6; s++) { var st = stretch(rng, key); if (st) admit(st, 'proportion', keyAxis); }
    var keyO = { g: key, kind: 'key', axis: keyAxis, corners: keyL[0].length, poly: keyL[0] };
    if (pool.length < 4) return null;
    var set = chooseFoils(rng, keyO, pool, W, H, D, p.foils === 1);
    if (!set) return null;
    var perm = rshuffle(rng, [0, 1, 2, 3, 4]), all = [keyO].concat(set);
    var options = perm.map(function (i) {
      var o = all[i], k = rint(rng, 0, 7), sz = tfSize(k, o.g.A, o.g.B);
      return { kind: o.kind, axis: o.axis, tf: k, w: sz[0], h: sz[1], poly: tfPoly(o.poly, k, o.g.A, o.g.B) };
    });
    var fl = {};
    names.forEach(function (nm2) { fl[nm2] = feats[nm2].map(function (x) { return x.t; }); });
    return { W: W, H: H, D: D, prof: polys, feats: fl, pose: pose, keyAxis: keyAxis, key: perm.indexOf(0), options: options };
  }

  /* ------------------------------------------------------------ validate (independent) */
  function okPoly(p, A, B, lattice) {
    if (!Array.isArray(p) || p.length < 3 || p.length > 64) return false;
    for (var i = 0; i < p.length; i++) {
      var a = p[i], b = p[(i + 1) % p.length];
      if (!Array.isArray(a) || a.length !== 2 || !isFinite(a[0]) || !isFinite(a[1])) return false;
      if (a[0] < 0 || a[1] < 0 || a[0] > A || a[1] > B) return false;
      if (Mth.round(a[0] * lattice) !== a[0] * lattice || Mth.round(a[1] * lattice) !== a[1] * lattice) return false;
      var dx = Mth.abs(b[0] - a[0]), dy = Mth.abs(b[1] - a[1]);
      if (!(dx === 0 || dy === 0 || dx === dy) || dx + dy === 0) return false;
    }
    return polyArea(p) > 0;
  }
  function spans(p, A, B) {
    var x0 = INF, x1 = -INF, y0 = INF, y1 = -INF;
    p.forEach(function (v) { x0 = Mth.min(x0, v[0]); x1 = Mth.max(x1, v[0]); y0 = Mth.min(y0, v[1]); y1 = Mth.max(y1, v[1]); });
    return x0 === 0 && y0 === 0 && x1 === A && y1 === B;
  }
  function validate(item) {
    try {
      if (!item || !item.prof) return 'no profiles';
      var W = item.W, H = item.H, D = item.D;
      if (![W, H, D].every(function (v) { return DIMS.indexOf(v) >= 0; }) || W === H || W === D || H === D) return 'the box must be 6–10 steps on each side, all different';
      var dm = profDims(W, H, D), prof = item.prof;
      for (var n in dm) if (!okPoly(prof[n], dm[n][0], dm[n][1], 1) || !spans(prof[n], dm[n][0], dm[n][1])) return 'profile ' + n + ' is not a lattice polygon filling its rectangle';
      if (!POSES[item.pose] || AXES.indexOf(item.keyAxis) < 0) return 'bad pose or key axis';
      if (!Array.isArray(item.options) || item.options.length !== 5) return 'needs 5 options';
      if (!(Number.isInteger(item.key) && item.key >= 0 && item.key < 5)) return 'key out of range';
      var sil = {};
      AXES.forEach(function (a) { sil[a] = raySil(prof, W, H, D, a); });
      var rs = [], caches = [], i, j;
      for (i = 0; i < 5; i++) {
        var o = item.options[i], cache = {};
        if (!o || !okPoly(o.poly, 16, 16, 2)) return 'option ' + i + ' is not a lattice polygon';
        caches.push(cache);
        rs.push(cache[0] = polyRaster(o.poly));
        var m = AXES.map(function (a) { return rcompare(o.poly, sil[a], cache); });
        if (m.indexOf('close') >= 0) return 'option ' + i + ' is too close to a silhouette to tell';
        var hits = m.filter(function (x) { return x === 'match'; }).length;
        if (i === item.key && (hits < 1 || m[AXES.indexOf(item.keyAxis)] !== 'match')) return 'the key does not fit the solid along its axis';
        if (i !== item.key && hits) return 'option ' + i + ' also fits the solid';
      }
      for (i = 0; i < 5; i++) for (j = i + 1; j < 5; j++) if (rcompare(item.options[i].poly, rs[j], caches[i]) !== 'differ') return 'options ' + i + ' and ' + j + ' are not clearly different';
      var seen = featuresSeen(prof, W, H, D, item.pose);
      for (i = 0; i < seen.length; i++) if (seen[i].hits < 2) return 'a feature of profile ' + seen[i].prof + ' is hidden in the picture';
      return true;
    } catch (e) { return 'validate threw: ' + (e && e.message); }
  }
  function score(item, response) { return { correct: Number.isInteger(response) && response === item.key }; }

  function attempt(rng, p) {
    stats.tries++;
    var item;
    try { item = build(rng, p); } catch (e) { stats.errors++; stats.lastError = String(e && e.stack || e); return null; }
    if (!item) { stats.nulls++; return null; }
    item.ex = 'openings';
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
    var tries = [p, { features: 1, edges: 0, keyview: 0, pose: 0, foils: 0 }];
    for (var t = 0; t < tries.length; t++) for (var k = 0; k < 400; k++) {
      var q = tries[t], item = attempt(PX.rng(PX.rng.hash('openings-fallback', q.features, q.edges, q.keyview, q.pose, q.foils, k)), q);
      if (item && validate(item) === true) { item.fallback = true; return item; }
    }
    throw new Error('openings: no valid item could be built'); // unreachable while the fallback test passes
  }

  /* ------------------------------------------------------------ definition */
  // Logits; P(right) = g + (1 − g − 0.03)·σ(θ − b), g = .2. base −2.3: one feature, straight edges,
  // the key on the face the picture shows most, upright, feature foils: ≈ .90 right at θ = 0. Steps
  // hand-set (DJ, R3 §8.5 dims; to be refitted from pooled exports): features +0.6 each, chamfers
  // +0.5, key on the side face +0.4 and on the top face +0.8 (less of the face shows), lying +0.6,
  // a proportion foil +0.3 (same features, wrong size: a scale judgement). Range 4.0 logits.
  PX.ex.define({
    id: 'openings', version: 1, code: 'EX-14', name: 'Openings', short: 'Openings',
    abilities: ['Vz'], cell: 'intrinsic-dynamic', role: 'train', answer: 'choice', nOptions: 5, pat: true,
    dims: [
      { key: 'features', label: 'Features', levels: FEATURES.slice(), step: 0.6 },
      { key: 'edges', label: 'Edges', levels: EDGES.slice(), step: 0.5 },
      { key: 'keyview', label: 'Fitting face', levels: KEYVIEW.slice(), step: 0.4 },
      { key: 'pose', label: 'Pose', levels: POSE.slice(), step: 0.6 },
      { key: 'foils', label: 'Foils', levels: FOILS.slice(), step: 0.3 },
    ],
    base: -2.3,
    generate: generate, validate: validate, score: score,
    lib: {
      DIMS: DIMS, POSES: POSES, POSE_SETS: POSE_SETS, VIEW: VIEW, AXES: AXES, PROF_OF: PROF_OF, AXIS_OF: AXIS_OF, RES: RES, SOLVERS: SOLVERS, stats: stats,
      qgrid: qgrid, qcopy: qcopy, profile: profile, featCells: featCells, randomFeature: randomFeature, buildProfiles: buildProfiles, polysOf: polysOf,
      silZ: silZ, silX: silX, silY: silY, sils: sils, outline: outline, polyArea: polyArea, area4: area4, crop: crop,
      tfPoint: tfPoint, tfSize: tfSize, tfGrid: tfGrid, tfPoly: tfPoly, compare: compare, dist: dist, stretch: stretch, mutate: mutate,
      pip: pip, rayIntervals: rayIntervals, rayHits: rayHits, inSolid: inSolid, featureRuns: featureRuns, featuresSeen: featuresSeen, tmul: tmul, axisFacing: axisFacing,
      surface: surface, edges: edges, raySil: raySil, polyRaster: polyRaster, scanFill: scanFill, tfRaster: tfRaster, rcompare: rcompare, shares: shares, fitsBox: fitsBox,
      build: build, fallback: fallback, cleanParams: cleanParams,
      // the profiles of an item as quarter grids, from its stored polygons (centroid tests)
      gridsOf: function (item) {
        var dm = profDims(item.W, item.H, item.D), out = {};
        for (var nn in dm) {
          var g = qgrid(dm[nn][0], dm[nn][1]), poly = item.prof[nn];
          for (var jj = 0; jj < g.B; jj++) for (var ii = 0; ii < g.A; ii++) {
            var mm = 0;
            for (var q = 0; q < 4; q++) if (pip(poly, ii + QC[q][0], jj + QC[q][1])) mm |= 1 << q;
            g.m[jj * g.A + ii] = mm;
          }
          out[nn] = g;
        }
        return out;
      },
    },
  });
})(window.PX);
