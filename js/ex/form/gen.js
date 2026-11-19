/* EX-19 Form (DAT-style format): a flat pattern and four solids; which solid folds from it?
   (pure; ARCHITECTURE.md §5; design: docs/research/v1.1/R3-dat-pat.md §8.6.)

   Solids (convex, so every face facing the viewer is wholly seen): boxes with three different
   sides, prisms on a triangle, trapezoid or "house" pentagon, bevelled boxes (a box with one long
   edge cut away, version 3), pyramids on a rectangle or a triangle, rectangular frusta (dim
   'solid'). Never a cube: oriented marks on cubes belong to the
   Spatial Check's Cube Match probe (R3 §5.3). Built as vertices and faces (CCW from outside), sizes
   on a half-unit lattice.
   Net: the solid edge-unfolded along a random spanning tree of its faces (each child face swung
   flat about the edge it shares with its parent), kept only when no two faces overlap; from the plain
   kind on, also only when no cut edge lies along another face, so every line inside the pattern
   folds. The pattern is the outside surface; fold lines are dashed on the starter band and drawn
   plain, like cut edges, from the plain kind on (the test's look; note D1 §6.4, addendum A.1).
   Marks (dim 'marks', version 3: the test's kinds of item, note D1 §6.4): the starter band (one
   shaded face); plain (no marks: shapes and sizes decide); shaded faces (two whole faces); then the
   half marks, which lie beyond the test's range (prep sources only): one shaded face and one
   half-shaded; two shaded and one half; one shaded and two halves. A half-shaded face is a
   four-sided face shaded on one side of a diagonal: oriented, so it can tell a solid from its mirror
   image. A mark is a tone plus a hatch, never colour alone. Cube nets with whole faces shaded are
   left out: with one tone on six squares only two nets give one right picture, and the count of
   shaded faces seen in proportion to the pattern names it every time (DECISIONS).
   Options: four pictures of solids, each turned its own way (dim 'view': upright, on a side, upside
   down), showing at least three faces clearly. Foils (dim 'foil', 'clear' or 'close'): on marked
   kinds above the band, at level 0 one proportion foil (one size off by at least a quarter) with two
   mark foils; at level 1 three mark foils. The plain kind: at level 0 two kinds of solid, two of each
   (one length apart by half again or more within each pair); at level 1 the pattern's kind four
   times, each foil one or two lengths a quarter or more off. A mark foil
   moves marks only to congruent faces (R3 §8.6), a half mark possibly turned, so face shapes never
   tell a mark foil from the key; each foil is a different marked solid (the mirror image is one of
   them when it differs). A face counts as evidence only when it faces the viewer clearly (cos ≥ 0.2);
   a foil must be ruled out by such faces.

   validate (two independent checks that must agree on every option):
   1. folds the net in 3D about its hinges by the solid's own dihedral angles, checks that it closes
      (every corner lands on the solid's), then searches the proper rotations that carry the solid
      onto each pictured one (vertex triples) and compares the clearly seen marks;
   2. without the solid: lays the stored pieces onto each pictured solid face by face (congruent, not
      flipped; fold lines on shared edges) and compares the marks on the faces it shows clearly.
   Exactly one option is possible.

   Item: { ex: 'form', seed, params, solid: { kind, dims, verts, faces }, net: [{ face, poly, parent,
           hinge }], marks: [per face 0 | 1 | { h: i }], key, options: [{ kind, solid, marks, view }] }. */
(function (PX) {
  'use strict';
  var Mth = Math, INF = 1 / 0, EPS = 1e-6;

  function rint(rng, lo, hi) { return lo + Mth.floor(rng.next() * (hi - lo + 1)); }
  function rpick(rng, arr) { return arr[rint(rng, 0, arr.length - 1)]; }
  function rshuffle(rng, arr) {
    var out = arr.slice();
    for (var i = out.length - 1; i > 0; i--) { var j = rint(rng, 0, i), t = out[i]; out[i] = out[j]; out[j] = t; }
    return out;
  }
  function half(rng, lo, hi) { return rint(rng, lo * 2, hi * 2) / 2; } // a size on the half-unit lattice

  /* ------------------------------------------------------------ vectors */
  function add(a, b) { return [a[0] + b[0], a[1] + b[1], a[2] + b[2]]; }
  function sub(a, b) { return [a[0] - b[0], a[1] - b[1], a[2] - b[2]]; }
  function mul(a, s) { return [a[0] * s, a[1] * s, a[2] * s]; }
  function dot(a, b) { return a[0] * b[0] + a[1] * b[1] + a[2] * b[2]; }
  function cross(a, b) { return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]; }
  function len(a) { return Mth.sqrt(dot(a, a)); }
  function unit(a) { var l = len(a); return [a[0] / l, a[1] / l, a[2] / l]; }
  function mvec(M, v) { return [M[0] * v[0] + M[1] * v[1] + M[2] * v[2], M[3] * v[0] + M[4] * v[1] + M[5] * v[2], M[6] * v[0] + M[7] * v[1] + M[8] * v[2]]; }
  function mmul(A, B) { var C = []; for (var r = 0; r < 3; r++) for (var c = 0; c < 3; c++) C.push(A[r * 3] * B[c] + A[r * 3 + 1] * B[3 + c] + A[r * 3 + 2] * B[6 + c]); return C; }
  function newell(P) { var n = [0, 0, 0]; for (var i = 0; i < P.length; i++) { var a = P[i], b = P[(i + 1) % P.length]; n[0] += (a[1] - b[1]) * (a[2] + b[2]); n[1] += (a[2] - b[2]) * (a[0] + b[0]); n[2] += (a[0] - b[0]) * (a[1] + b[1]); } return n; }

  /* ------------------------------------------------------------ solids */
  // Faces are oriented CCW seen from outside (fixed against the centroid: every solid is convex).
  function finish(kind, dims, verts, faces) {
    var c = [0, 0, 0];
    verts.forEach(function (v) { c = add(c, v); });
    c = mul(c, 1 / verts.length);
    faces = faces.map(function (f) {
      var P = f.map(function (i) { return verts[i]; }), n = newell(P);
      return dot(n, sub(P[0], c)) < 0 ? f.slice().reverse() : f.slice();
    });
    return { kind: kind, dims: dims, verts: verts.map(function (v) { return [v[0] - c[0], v[1], v[2] - c[2]]; }), faces: faces };
  }
  function prism(kind, dims, poly, L) { // poly in (x, y), extruded along z
    var n = poly.length, verts = [], faces = [[], []], i;
    poly.forEach(function (p) { verts.push([p[0], p[1], L / 2]); });
    poly.forEach(function (p) { verts.push([p[0], p[1], -L / 2]); });
    for (i = 0; i < n; i++) { faces[0].push(i); faces[1].push(n + i); faces.push([i, n + i, n + (i + 1) % n, (i + 1) % n]); }
    return finish(kind, dims, verts, faces);
  }
  // v1.2 (version 3, O51): L-, T- and U-prisms, a non-convex cross-section (x, y) extruded along z.
  // Faces are oriented from the polygon's own winding (finish()'s centroid rule holds only for convex
  // solids): the near cap counterclockwise, the far cap reversed, the sides outward of a CCW outline.
  function ncPrism(kind, dims, poly, L) {
    var n = poly.length, verts = [], faces = [[], []], a2 = 0, i, cx = 0;
    for (i = 0; i < n; i++) a2 += poly[i][0] * poly[(i + 1) % n][1] - poly[(i + 1) % n][0] * poly[i][1];
    if (a2 < 0) poly = poly.slice().reverse();
    poly.forEach(function (q) { cx += q[0] / n; });
    poly.forEach(function (q) { verts.push([q[0] - cx, q[1], L / 2]); });
    poly.forEach(function (q) { verts.push([q[0] - cx, q[1], -L / 2]); });
    for (i = 0; i < n; i++) { faces[0].push(i); faces[1].push(n + (n - i) % n); faces.push([i, n + i, n + (i + 1) % n, (i + 1) % n]); }
    return { kind: kind, dims: dims, verts: verts, faces: faces };
  }
  function pyramid(kind, dims, base, apex) { // base in (x, z) at y = 0
    var verts = base.map(function (p) { return [p[0], 0, p[1]]; }).concat([apex]), n = base.length, faces = [base.map(function (_, i) { return i; })];
    for (var i = 0; i < n; i++) faces.push([i, (i + 1) % n, n]);
    return finish(kind, dims, verts, faces);
  }
  var BUILD = {
    box: function (d) { return prism('box', d, [[-d[0] / 2, 0], [d[0] / 2, 0], [d[0] / 2, d[1]], [-d[0] / 2, d[1]]], d[2]); },
    tri: function (d) { return prism('tri', d, [[-d[0] / 2, 0], [d[0] / 2, 0], [0, d[1]]], d[2]); },
    trap: function (d) { return prism('trap', d, [[-d[0] / 2, 0], [d[0] / 2, 0], [d[1] / 2, d[2]], [-d[1] / 2, d[2]]], d[3]); },
    wedge: function (d) { return prism('wedge', d, [[0, 0], [d[0], 0], [0, d[1]]], d[2]); },
    house: function (d) { return prism('house', d, [[-d[0] / 2, 0], [d[0] / 2, 0], [d[0] / 2, d[1]], [0, d[1] + d[2]], [-d[0] / 2, d[1]]], d[3]); },
    // v1.2 (version 3): a box with one long top edge bevelled away (a five-sided prism): d = [width,
    // height, bevel, length], the bevel cutting `bevel` off the width and the height
    bevel: function (d) { return prism('bevel', d, [[-d[0] / 2, 0], [d[0] / 2, 0], [d[0] / 2, d[1] - d[2]], [d[0] / 2 - d[2], d[1]], [-d[0] / 2, d[1]]], d[3]); },
    // d = [width, height, upright arm's thickness, foot's thickness, length]
    L: function (d) { return ncPrism('L', d, [[0, 0], [d[0], 0], [d[0], d[3]], [d[2], d[3]], [d[2], d[1]], [0, d[1]]], d[4]); },
    // d = [bar's width, height, stem's width, bar's thickness, length]
    T: function (d) { var w = d[0] / 2, a = d[2] / 2, y = d[1] - d[3]; return ncPrism('T', d, [[-a, 0], [a, 0], [a, y], [w, y], [w, d[1]], [-w, d[1]], [-w, y], [-a, y]], d[4]); },
    // d = [width, height, wall's thickness, floor's thickness, length]
    U: function (d) { var w = d[0] / 2, i = w - d[2]; return ncPrism('U', d, [[-w, 0], [w, 0], [w, d[1]], [i, d[1]], [i, d[3]], [-i, d[3]], [-i, d[1]], [-w, d[1]]], d[4]); },
    pyr: function (d) { return pyramid('pyr', d, [[-d[0] / 2, -d[1] / 2], [d[0] / 2, -d[1] / 2], [d[0] / 2, d[1] / 2], [-d[0] / 2, d[1] / 2]], [0, d[2], 0]); },
    tet: function (d) { return pyramid('tet', d, [[-d[0] / 2, -d[1] / 3], [d[0] / 2, -d[1] / 3], [0, 2 * d[1] / 3]], [0, d[2], 0]); },
    frus: function (d) {
      var a = d[0] / 2, b = d[1] / 2, s = d[3], H = d[2], verts = [[-a, 0, -b], [a, 0, -b], [a, 0, b], [-a, 0, b], [-a * s, H, -b * s], [a * s, H, -b * s], [a * s, H, b * s], [-a * s, H, b * s]];
      return finish('frus', d, verts, [[0, 1, 2, 3], [4, 5, 6, 7], [0, 1, 5, 4], [1, 2, 6, 5], [2, 3, 7, 6], [3, 0, 4, 7]]);
    },
  };
  // dim 'solid'. The three-sided pyramid ('tet') is built but not used: it has no four-sided face for
  // the half mark that every level now carries.
  var KINDS = [['box', 'tri', 'trap', 'bevel'], ['wedge', 'pyr'], ['frus', 'house'], ['L', 'T', 'U']];
  var NCK = { L: 1, T: 1, U: 1 }; // the non-convex kinds (version 3, O51)
  function isNC(s) { return !!(s && NCK[s.kind]); }
  // Sizes per kind, in units (half-unit lattice); the solid is never a cube.
  function randomDims(rng, kind) {
    var d;
    if (kind === 'box') { do { d = [half(rng, 1.5, 3.5), half(rng, 1.5, 3.5), half(rng, 1.5, 4)]; } while (d[0] === d[1] || d[1] === d[2] || d[0] === d[2]); return d; }
    if (kind === 'tri') return [half(rng, 2, 3.5), half(rng, 1.5, 3), half(rng, 2, 4)];
    if (kind === 'trap') { var w1 = half(rng, 2.5, 4); return [w1, half(rng, 1, w1 - 1), half(rng, 1.5, 2.5), half(rng, 2, 3.5)]; }
    if (kind === 'wedge') return [half(rng, 1.5, 3), half(rng, 1.5, 3), half(rng, 2, 4)];
    if (kind === 'house') return [half(rng, 2, 3), half(rng, 1.5, 2.5), half(rng, 1, 1.5), half(rng, 2, 3.5)];
    if (kind === 'pyr') { do { d = [half(rng, 2, 3.5), half(rng, 2, 3.5), half(rng, 1.5, 3)]; } while (d[0] === d[1]); return d; }
    if (kind === 'tet') return [half(rng, 2.5, 4), half(rng, 2, 3.5), half(rng, 1.5, 3)];
    if (kind === 'bevel') { do { d = [half(rng, 2, 3.5), half(rng, 2, 3.5), half(rng, 1, 1.5), half(rng, 2, 4)]; } while (d[2] > Mth.min(d[0], d[1]) - 1 || d[0] === d[3]); return d; }
    // small enough that a pattern of eight or ten faces keeps its unit edges readable on a phone
    if (kind === 'L') { do { d = [half(rng, 2, 3), half(rng, 2, 3), half(rng, 1, 1.5), half(rng, 1, 1.5), half(rng, 1.5, 2.5)]; } while (!okDims('L', d)); return d; }
    if (kind === 'T') { do { d = [half(rng, 3, 4), half(rng, 2, 3), half(rng, 1, 2), 1, half(rng, 1.5, 2.5)]; } while (!okDims('T', d)); return d; }
    if (kind === 'U') { do { d = [half(rng, 3, 4), half(rng, 2, 3), 1, 1, half(rng, 1.5, 2.5)]; } while (!okDims('U', d)); return d; }
    return [half(rng, 2, 3.5), half(rng, 2, 3.5), half(rng, 1.5, 2.5), 0.5];
  }
  function build(kind, dims) { return BUILD[kind](dims); }
  // One size changed by at least a quarter (the proportion foil): a new solid of the same kind.
  function stretched(rng, s) {
    for (var t = 0; t < 12; t++) {
      var d = s.dims.slice(), i = rint(rng, 0, s.kind === 'frus' ? 2 : d.length - 1), f = rpick(rng, [0.6, 0.7, 1.4, 1.5]);
      d[i] = Mth.round(d[i] * f * 2) / 2;
      if (d[i] < 1 || Mth.abs(d[i] - s.dims[i]) < Mth.max(0.5, 0.25 * s.dims[i])) continue;
      if (!okDims(s.kind, d)) continue;
      return build(s.kind, d);
    }
    return null;
  }
  // The sizes a kind of solid allows (a trapezoid's top narrower than its base by a unit or more; a box
  // never a cube; a bevel at least a unit short of the width and the height).
  function okDims(kind, d) {
    if (d.some(function (x) { return !(x >= 1); })) return false;
    if (kind === 'trap') return d[1] <= d[0] - 1;
    if (kind === 'box') return d[0] !== d[1] && d[1] !== d[2] && d[0] !== d[2];
    if (kind === 'bevel') return d[2] <= Mth.min(d[0], d[1]) - 1;
    if (kind === 'L' || kind === 'T') return d[2] <= d[0] - 1 && d[3] <= d[1] - 1;
    if (kind === 'U') return 2 * d[2] <= d[0] - 1 && d[3] <= d[1] - 1;
    return true;
  }
  function mirrored(s) { // reflected through x = 0, faces reoriented
    return { kind: s.kind, dims: s.dims, mirror: true, verts: s.verts.map(function (v) { return [-v[0], v[1], v[2]]; }), faces: s.faces.map(function (f) { return f.slice().reverse(); }) };
  }

  /* ------------------------------------------------------------ views (literal trig, exact everywhere) */
  // A picture turns the solid by Ry(yaw) · tilt and looks from azimuth 30° at elevation 35° or 60°.
  var VIEWS = [[0.4095760221, 0.5735764364, 0.7094064799], [0.25, 0.8660254038, 0.4330127019]], VIEW = VIEWS[0];
  var R3_2 = 0.8660254037844386;
  var YAW = [[1, 0], [R3_2, 0.5], [0.5, R3_2], [0, 1], [-0.5, R3_2], [-R3_2, 0.5], [-1, 0], [-R3_2, -0.5], [-0.5, -R3_2], [0, -1], [0.5, -R3_2], [R3_2, -0.5]]; // cos, sin of 30°·k
  var TILTS = { I: [1, 0, 0, 0, 1, 0, 0, 0, 1], X: [1, 0, 0, 0, 0, -1, 0, 1, 0], Xm: [1, 0, 0, 0, 0, 1, 0, -1, 0], Z: [0, -1, 0, 1, 0, 0, 0, 0, 1], Zm: [0, 1, 0, -1, 0, 0, 0, 0, 1], X2: [1, 0, 0, 0, -1, 0, 0, 0, -1], Z2: [-1, 0, 0, 0, -1, 0, 0, 0, 1] };
  var TILT_SETS = [['I'], ['X', 'Xm', 'Z', 'Zm'], ['X2', 'Z2']]; // dim 'view': upright, on a side, upside down
  // A face counts as seen at a cosine of 0.2 or more (about a fifth of its area shows; R3 asks for 15 %);
  // no face sits within 0.02 of that, so what counts as seen never hangs on rounding.
  var SEEN = 0.2, BAND = 0.02;
  function viewMatrix(v) { var c = YAW[v.yaw][0], s = YAW[v.yaw][1]; return mmul([c, 0, s, 0, 1, 0, -s, 0, c], TILTS[v.tilt]); }
  function faceNormal(s, f) { return unit(newell(s.faces[f].map(function (i) { return s.verts[i]; }))); }
  // Cosine of each face's outward normal with the direction toward the viewer. Normals are kept per solid
  // object (a WeakMap: nothing is added to the solid itself).
  var NORMALS = typeof WeakMap === 'function' ? new WeakMap() : null;
  function normalsOf(s) {
    var n = NORMALS && NORMALS.get(s);
    if (!n) { n = s.faces.map(function (_, f) { return faceNormal(s, f); }); if (NORMALS) NORMALS.set(s, n); }
    return n;
  }
  function facing(s, v) {
    var M = viewMatrix(v), V = VIEWS[v.el || 0], d = [M[0] * V[0] + M[3] * V[1] + M[6] * V[2], M[1] * V[0] + M[4] * V[1] + M[7] * V[2], M[2] * V[0] + M[5] * V[1] + M[8] * V[2]];
    return normalsOf(s).map(function (n) { return n[0] * d[0] + n[1] * d[1] + n[2] * d[2]; });
  }
  // On a non-convex prism a face turned toward the viewer may be partly hidden by another part of the
  // solid (version 3, O51). It counts as seen only when it shows wholly (VIS_SEEN of it or more), and a
  // marked face must show wholly or not at all (randomView), so a mark is never half hidden.
  var VIS_SEEN = 0.97, VIS_NONE = 0.02;
  function seenFaces(s, v) {
    var c = facing(s, v), vis = isNC(s) ? visible(s, v) : null;
    return c.map(function (x, f) { return x >= SEEN && (!vis || vis[f] >= VIS_SEEN) ? f : -1; }).filter(function (f) { return f >= 0; });
  }
  var RIGHT = [0.8660254038, 0, -0.5];
  // The corners in the picture: x right, y up, z toward the viewer (a right-handed frame).
  function screenPts(s, v) {
    var M = viewMatrix(v), V = VIEWS[v.el || 0], U = cross(V, RIGHT);
    return s.verts.map(function (q) { var w = mvec(M, q); return [dot(w, RIGHT), dot(w, U), dot(w, V)]; });
  }
  // A front face's depth at picture point (x, y), from its plane.
  function depthFn(Q) { var n = newell(Q); return function (x, y) { return Q[0][2] - (n[0] * (x - Q[0][0]) + n[1] * (y - Q[0][1])) / n[2]; }; }
  // Points over the face's picture (a 14 × 14 grid on its box, those inside); equal areas in the picture
  // are equal areas on the face (a parallel projection).
  function gridIn(P) {
    var x0 = INF, x1 = -INF, y0 = INF, y1 = -INF, out = [];
    P.forEach(function (q) { x0 = Mth.min(x0, q[0]); x1 = Mth.max(x1, q[0]); y0 = Mth.min(y0, q[1]); y1 = Mth.max(y1, q[1]); });
    for (var i = 0; i < 12; i++) for (var j = 0; j < 12; j++) { var x = x0 + (x1 - x0) * (i + 0.5) / 12, y = y0 + (y1 - y0) * (j + 0.5) / 12; if (pip2(P, x, y)) out.push([x, y]); }
    return out;
  }
  function boxOf(P) { var b = [INF, INF, -INF, -INF]; P.forEach(function (q) { b[0] = Mth.min(b[0], q[0]); b[1] = Mth.min(b[1], q[1]); b[2] = Mth.max(b[2], q[0]); b[3] = Mth.max(b[3], q[1]); }); return b; }
  var visCache = {}, visCount = 0;
  // Per face, the share of it the picture shows (0 for faces turned away); convex solids show every face
  // turned toward the viewer wholly.
  function visible(s, v) {
    var c = facing(s, v), key = s.kind + s.dims.join(',') + (s.mirror ? 'm' : '') + '|' + v.yaw + v.tilt + (v.el || 0);
    if (!isNC(s)) return c.map(function (x) { return x > 0 ? 1 : 0; });
    if (visCache[key]) return visCache[key];
    var Q = screenPts(s, v), front = [], poly = {}, dep = {}, box = {}, out = s.faces.map(function () { return 0; });
    s.faces.forEach(function (F, f) { if (c[f] > 1e-9) { front.push(f); poly[f] = F.map(function (i) { return Q[i]; }); dep[f] = depthFn(poly[f]); box[f] = boxOf(poly[f]); } });
    for (var a = 0; a < front.length; a++) {
      var f = front[a], pts = gridIn(poly[f]), shown = 0, near = [];
      for (var b = 0; b < front.length; b++) {
        var g = front[b], A = box[f], B = box[g];
        if (g !== f && A[0] < B[2] && B[0] < A[2] && A[1] < B[3] && B[1] < A[3]) near.push(g);
      }
      for (var k = 0; k < pts.length; k++) {
        var x = pts[k][0], y = pts[k][1], z = dep[f](x, y), hid = false;
        for (var m = 0; m < near.length && !hid; m++) { var h = near[m], H = box[h]; if (x > H[0] && x < H[2] && y > H[1] && y < H[3] && pip2(poly[h], x, y) && dep[h](x, y) > z + 1e-6) hid = true; }
        if (!hid) shown++;
      }
      out[f] = pts.length ? shown / pts.length : 0;
    }
    if (++visCount > 4000) { visCache = {}; visCount = 0; }
    visCache[key] = out;
    return out;
  }
  // The faces turned toward the viewer in the order to paint them (far first): convex solids in any
  // order; on a non-convex prism, a face is painted after every face it covers (orderPolys).
  function drawOrder(s, v) {
    var c = facing(s, v), front = s.faces.map(function (_, f) { return f; }).filter(function (f) { return c[f] > 1e-9; });
    if (!isNC(s)) return front;
    var Q = screenPts(s, v);
    return orderPolys(front.map(function (f) { return { id: f, pts: s.faces[f].map(function (i) { return Q[i]; }) }; }));
  }
  // Planar polygons in picture space (x right, y up, z toward the viewer) in the order to paint them: a
  // topological order of "covers" where two pictures overlap (depths compared at grid points of each);
  // a cycle falls back to mean depth. Also the fold-up's order (the view) on non-convex prisms.
  function orderPolys(list) {
    var P = list.filter(function (x) { return Mth.abs(newell(x.pts)[2]) > 1e-9; }), dep = {}, mean = {}, after = {}, deg = {}, box = {};
    P.forEach(function (x) {
      dep[x.id] = depthFn(x.pts); box[x.id] = boxOf(x.pts);
      mean[x.id] = x.pts.reduce(function (t, q) { return t + q[2]; }, 0) / x.pts.length; after[x.id] = []; deg[x.id] = 0;
    });
    for (var a = 0; a < P.length; a++) for (var b = a + 1; b < P.length; b++) {
      var f = P[a], g = P[b], A = box[f.id], B = box[g.id], vote = 0;
      if (!(A[0] < B[2] && B[0] < A[2] && A[1] < B[3] && B[1] < A[3])) continue;
      gridIn(f.pts).forEach(function (q) { if (pip2(g.pts, q[0], q[1])) { var d = dep[g.id](q[0], q[1]) - dep[f.id](q[0], q[1]); if (d > 1e-6) vote++; else if (d < -1e-6) vote--; } });
      gridIn(g.pts).forEach(function (q) { if (pip2(f.pts, q[0], q[1])) { var d = dep[g.id](q[0], q[1]) - dep[f.id](q[0], q[1]); if (d > 1e-6) vote++; else if (d < -1e-6) vote--; } });
      if (vote > 0) { after[f.id].push(g.id); deg[g.id]++; } else if (vote < 0) { after[g.id].push(f.id); deg[f.id]++; }
    }
    var out = [], ready = P.filter(function (x) { return !deg[x.id]; }).map(function (x) { return x.id; });
    while (ready.length) {
      ready.sort(function (x, y) { return mean[x] - mean[y]; });
      var f0 = ready.shift();
      out.push(f0);
      after[f0].forEach(function (g) { if (--deg[g] === 0) ready.push(g); });
    }
    var all = P.map(function (x) { return x.id; });
    if (out.length < all.length) return all.sort(function (x, y) { return mean[x] - mean[y]; });
    return out;
  }

  /* ------------------------------------------------------------ nets */
  function adjacency(s) { // [{ a, b, f, g }]: edges shared by faces f and g
    var map = {}, out = [];
    s.faces.forEach(function (F, f) {
      for (var i = 0; i < F.length; i++) {
        var a = F[i], b = F[(i + 1) % F.length], k = a < b ? a + ',' + b : b + ',' + a;
        if (map[k] !== undefined) out.push({ a: a, b: b, f: map[k], g: f }); else map[k] = f;
      }
    });
    return out;
  }
  // A face's own 2D shape: vertex 0 at the origin, edge 0→1 along +x, CCW.
  function flat(s, f) {
    var F = s.faces[f], P = F.map(function (i) { return s.verts[i]; }), n = unit(newell(P)), ex = unit(sub(P[1], P[0])), ey = cross(n, ex);
    return P.map(function (p) { var d = sub(p, P[0]); return [dot(d, ex), dot(d, ey)]; });
  }
  // Unfold along a random spanning tree; null when two faces overlap.
  // strict (every level whose fold lines are drawn plain): no two faces may touch along a stretch of edge
  // except at their hinge, since a cut lying inside the outline would read as a fold line
  function unfold(rng, s, strict) {
    if (isNC(s)) return unfoldNC(rng, s);
    var E = adjacency(s), nF = s.faces.length, root = rint(rng, 0, nF - 1), placed = {}, net = [], queue = [root];
    placed[root] = flat(s, root);
    net.push({ face: root, poly: placed[root], parent: -1, hinge: null });
    var order = rshuffle(rng, E);
    while (queue.length) {
      var f = queue.splice(rint(rng, 0, queue.length - 1), 1)[0];
      order.forEach(function (e) {
        var g = e.f === f ? e.g : e.g === f ? e.f : -1;
        if (g < 0 || placed[g]) return;
        var Pf = s.faces[f], Pg = s.faces[g], A = placed[f][Pf.indexOf(e.a)], B = placed[f][Pf.indexOf(e.b)];
        var loc = flat(s, g), a2 = loc[Pg.indexOf(e.a)], b2 = loc[Pg.indexOf(e.b)];
        // the isometry carrying (a2, b2) onto (A, B): a rotation and a shift
        var ang = Mth.atan2(B[1] - A[1], B[0] - A[0]) - Mth.atan2(b2[1] - a2[1], b2[0] - a2[0]), c = Mth.cos(ang), sn = Mth.sin(ang);
        placed[g] = loc.map(function (p) { var x = p[0] - a2[0], y = p[1] - a2[1]; return [A[0] + c * x - sn * y, A[1] + sn * x + c * y]; });
        net.push({ face: g, poly: placed[g], parent: f, hinge: [e.a, e.b] });
        queue.push(g);
      });
    }
    if (net.length !== nF || overlapping(net) || (strict && touchesOffHinge(net, s))) return null;
    // Rounded to a thousandth of a unit (stored); the validator folds what is stored.
    net.forEach(function (n) { n.poly = n.poly.map(function (p) { return [Mth.round(p[0] * 1000) / 1000, Mth.round(p[1] * 1000) / 1000]; }); });
    return net;
  }
  // Non-convex prisms (version 3, O51): random spanning trees almost always overlap, so pieces are laid
  // one at a time, each through a hinge (in random order) where it overlaps no piece already laid and
  // touches none along an edge but its parent; stuck, the attempt fails. Always strict (no cut inside).
  function unfoldNC(rng, s) {
    var E = rshuffle(rng, adjacency(s)), nF = s.faces.length, root = rint(rng, 0, nF - 1), placed = {}, net = [];
    placed[root] = flat(s, root);
    net.push({ face: root, poly: placed[root], parent: -1, hinge: null });
    while (net.length < nF) {
      var done = false;
      for (var x = 0; x < E.length && !done; x++) {
        var e = E[x], f = placed[e.f] && !placed[e.g] ? e.f : placed[e.g] && !placed[e.f] ? e.g : -1;
        if (f < 0) continue;
        var g = f === e.f ? e.g : e.f, Pf = s.faces[f], Pg = s.faces[g], A = placed[f][Pf.indexOf(e.a)], B = placed[f][Pf.indexOf(e.b)];
        var loc = flat(s, g), a2 = loc[Pg.indexOf(e.a)], b2 = loc[Pg.indexOf(e.b)];
        var ang = Mth.atan2(B[1] - A[1], B[0] - A[0]) - Mth.atan2(b2[1] - a2[1], b2[0] - a2[0]), c = Mth.cos(ang), sn = Mth.sin(ang);
        var poly = loc.map(function (q) { var dx = q[0] - a2[0], dy = q[1] - a2[1]; return [A[0] + c * dx - sn * dy, A[1] + sn * dx + c * dy]; });
        var bad = net.some(function (n) { return overlapPair(poly, n.poly) || (n.face !== f ? sharedRun(poly, n.poly) > 0.05 : sharedRun(poly, n.poly, Pg.indexOf(e.a), Pg.indexOf(e.b)) > 0.05); });
        if (bad) continue;
        placed[g] = poly;
        net.push({ face: g, poly: poly, parent: f, hinge: [e.a, e.b] });
        done = true;
        E = rshuffle(rng, E);
      }
      if (!done) return null;
    }
    net.forEach(function (n) { n.poly = n.poly.map(function (q) { return [Mth.round(q[0] * 1000) / 1000, Mth.round(q[1] * 1000) / 1000]; }); });
    return overlapping(net) || touchesOffHinge(net, s) || enclosesHole(net) ? null : net;
  }
  // A pattern must not close round a gap (a notch shut by a piece touching it at two corners reads as a
  // hole in a face): cells of a quarter unit, the background flooded from the border; any cell left is
  // a hole.
  function enclosesHole(net) {
    var b = [INF, INF, -INF, -INF], st = 0.25;
    net.forEach(function (n) { var q = boxOf(n.poly); b = [Mth.min(b[0], q[0]), Mth.min(b[1], q[1]), Mth.max(b[2], q[2]), Mth.max(b[3], q[3])]; });
    var W = Mth.ceil((b[2] - b[0]) / st) + 2, H = Mth.ceil((b[3] - b[1]) / st) + 2, cell = new Array(W * H), stack = [], i, j;
    for (i = 0; i < W; i++) for (j = 0; j < H; j++) {
      var x = b[0] + (i - 0.5) * st, y = b[1] + (j - 0.5) * st;
      cell[i * H + j] = net.some(function (n) { return pip2(n.poly, x, y); }) ? 1 : 0;
    }
    stack.push(0); cell[0] = 2;
    while (stack.length) {
      var k = stack.pop(), ci = Mth.floor(k / H), cj = k % H;
      [[1, 0], [-1, 0], [0, 1], [0, -1]].forEach(function (d) {
        var ni = ci + d[0], nj = cj + d[1];
        if (ni < 0 || nj < 0 || ni >= W || nj >= H || cell[ni * H + nj] !== 0) return;
        cell[ni * H + nj] = 2; stack.push(ni * H + nj);
      });
    }
    for (i = 0; i < cell.length; i++) if (cell[i] === 0) return true;
    return false;
  }
  // The longest stretch of polygon A's outline lying on polygon B's (collinear edges that overlap); with
  // ha, hb: A's edge between those corners (its hinge with B) left out.
  function sharedRun(A, B, ha, hb) {
    var best = 0;
    for (var k = 0; k < A.length; k++) for (var m = 0; m < B.length; m++) {
      if (ha !== undefined && ((k === ha && (k + 1) % A.length === hb) || (k === hb && (k + 1) % A.length === ha))) continue;
      var p = A[k], q = A[(k + 1) % A.length], r = B[m], t = B[(m + 1) % B.length], dx = q[0] - p[0], dy = q[1] - p[1], L = Mth.sqrt(dx * dx + dy * dy);
      if (L < 1e-9) continue;
      if (Mth.abs((r[0] - p[0]) * dy - (r[1] - p[1]) * dx) / L > 0.01 || Mth.abs((t[0] - p[0]) * dy - (t[1] - p[1]) * dx) / L > 0.01) continue;
      var ur = ((r[0] - p[0]) * dx + (r[1] - p[1]) * dy) / L, ut = ((t[0] - p[0]) * dx + (t[1] - p[1]) * dy) / L;
      best = Mth.max(best, Mth.min(L, Mth.max(ur, ut)) - Mth.max(0, Mth.min(ur, ut)));
    }
    return best;
  }
  function touchesOffHinge(net, s) {
    for (var i = 0; i < net.length; i++) for (var j = i + 1; j < net.length; j++) {
      var c = net[i].parent === net[j].face ? net[i] : net[j].parent === net[i].face ? net[j] : null;
      if (!c) { if (sharedRun(net[i].poly, net[j].poly) > 0.05) return true; continue; }
      // parent and child (non-convex pieces can also meet beyond their hinge): the child's hinge edge left out
      if (!s) continue;
      var F = s.faces[c.face], o = c === net[i] ? net[j] : net[i];
      if (sharedRun(c.poly, o.poly, F.indexOf(c.hinge[0]), F.indexOf(c.hinge[1])) > 0.05) return true;
    }
    return false;
  }
  function segCross(p, q, r, t) { // proper crossing of segments pq and rt (shared ends do not count)
    function o(a, b, c) { var v = (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]); return v > 1e-7 ? 1 : v < -1e-7 ? -1 : 0; }
    var d1 = o(p, q, r), d2 = o(p, q, t), d3 = o(r, t, p), d4 = o(r, t, q);
    return d1 * d2 < 0 && d3 * d4 < 0;
  }
  function pip2(P, x, y) {
    var c = false;
    for (var i = 0, j = P.length - 1; i < P.length; j = i++) { var a = P[i], b = P[j]; if ((a[1] > y) !== (b[1] > y) && x < (b[0] - a[0]) * (y - a[1]) / (b[1] - a[1]) + a[0]) c = !c; }
    return c;
  }
  function inner(P) { // a point well inside the polygon: its centroid, or (non-convex) an ear's centroid
    var x = 0, y = 0; P.forEach(function (p) { x += p[0]; y += p[1]; });
    var c = [x / P.length, y / P.length];
    if (pip2(P, c[0], c[1])) return c;
    for (var i = 0; i < P.length; i++) {
      var a = P[(i + P.length - 1) % P.length], b = P[i], d = P[(i + 1) % P.length];
      if ((b[0] - a[0]) * (d[1] - a[1]) - (b[1] - a[1]) * (d[0] - a[0]) <= 1e-9) continue; // a reflex corner
      var e = [(a[0] + b[0] + d[0]) / 3, (a[1] + b[1] + d[1]) / 3];
      if (pip2(P, e[0], e[1])) return e;
    }
    return c;
  }
  function convexPoly(A) {
    for (var i = 0; i < A.length; i++) { var a = A[i], b = A[(i + 1) % A.length], c = A[(i + 2) % A.length]; if ((b[0] - a[0]) * (c[1] - b[1]) - (b[1] - a[1]) * (c[0] - b[0]) < -1e-9) return false; }
    return true;
  }
  // A point just inside polygon A next to its corner k: toward the inner point c on a convex piece; on a
  // non-convex one along the corner's bisector, turned inward at a reflex corner.
  function nudgeIn(A, k, c) {
    var q = A[k];
    if (convexPoly(A)) return [q[0] + (c[0] - q[0]) * 0.02, q[1] + (c[1] - q[1]) * 0.02];
    var a = A[(k + A.length - 1) % A.length], b = A[(k + 1) % A.length], u = [a[0] - q[0], a[1] - q[1]], w = [b[0] - q[0], b[1] - q[1]];
    var lu = Mth.sqrt(u[0] * u[0] + u[1] * u[1]) || 1, lw = Mth.sqrt(w[0] * w[0] + w[1] * w[1]) || 1, d = [u[0] / lu + w[0] / lw, u[1] / lu + w[1] / lw], ld = Mth.sqrt(d[0] * d[0] + d[1] * d[1]);
    var cr = (q[0] - a[0]) * (b[1] - q[1]) - (q[1] - a[1]) * (b[0] - q[0]);
    if (ld < 1e-9) d = [-w[1] / lw, w[0] / lw]; else { d = [d[0] / ld, d[1] / ld]; if (cr < 0) d = [-d[0], -d[1]]; }
    return [q[0] + d[0] * 0.02, q[1] + d[1] * 0.02];
  }
  function midIn(A, k, B) {
    var p = A[k], q = A[(k + 1) % A.length], dx = q[0] - p[0], dy = q[1] - p[1], l = Mth.sqrt(dx * dx + dy * dy) || 1;
    return pip2(B, (p[0] + q[0]) / 2 - dy / l * 0.02, (p[1] + q[1]) / 2 + dx / l * 0.02);
  }
  function overlapping(net) {
    for (var i = 0; i < net.length; i++) for (var j = i + 1; j < net.length; j++) if (overlapPair(net[i].poly, net[j].poly)) return true;
    return false;
  }
  function overlapPair(A, B) {
    {
      var k, m;
      for (k = 0; k < A.length; k++) for (m = 0; m < B.length; m++) if (segCross(A[k], A[(k + 1) % A.length], B[m], B[(m + 1) % B.length])) return true;
      var ca = inner(A), cb = inner(B);
      if (pip2(B, ca[0], ca[1]) || pip2(A, cb[0], cb[1])) return true;
      // a vertex of one strictly inside the other (overlaps that cross no edge properly)
      for (k = 0; k < A.length; k++) { var qa = nudgeIn(A, k, ca); if (pip2(B, qa[0], qa[1])) return true; }
      for (m = 0; m < B.length; m++) { var qb = nudgeIn(B, m, cb); if (pip2(A, qb[0], qb[1])) return true; }
      // non-convex pieces: a point just inside each edge's middle (left of a CCW outline) inside the other
      if (A.length > 5 || B.length > 5) {
        for (k = 0; k < A.length; k++) if (midIn(A, k, B)) return true;
        for (m = 0; m < B.length; m++) if (midIn(B, m, A)) return true;
      }
    }
    return false;
  }

  /* ------------------------------------------------------------ rotations between solids */
  // Every proper rotation (with a shift) carrying solid S onto solid O, as a vertex map S → O.
  function matchings(S, O) {
    var V = S.verts, W = O.verts, out = [];
    if (V.length !== W.length || S.faces.length !== O.faces.length) return out;
    var F0 = S.faces[0], v0 = V[F0[0]], v1 = V[F0[1]], v2 = V[F0[2]], d01 = len(sub(v1, v0)), d12 = len(sub(v2, v1)), d02 = len(sub(v2, v0));
    function frame(a, b, c) { var e1 = unit(sub(b, a)), e2 = unit(cross(sub(b, a), sub(c, a))); return [e1, e2, cross(e2, e1)]; }
    var E = frame(v0, v1, v2);
    for (var i = 0; i < W.length; i++) for (var j = 0; j < W.length; j++) {
      if (j === i || Mth.abs(len(sub(W[j], W[i])) - d01) > EPS) continue;
      for (var k = 0; k < W.length; k++) {
        if (k === i || k === j || Mth.abs(len(sub(W[k], W[j])) - d12) > EPS || Mth.abs(len(sub(W[k], W[i])) - d02) > EPS) continue;
        var Fr = frame(W[i], W[j], W[k]), map = [], used = {}, ok = true;
        for (var n = 0; n < V.length && ok; n++) {
          var d = sub(V[n], v0), p = add(W[i], add(add(mul(Fr[0], dot(d, E[0])), mul(Fr[1], dot(d, E[1]))), mul(Fr[2], dot(d, E[2]))));
          var hit = -1;
          for (var m = 0; m < W.length; m++) if (len(sub(W[m], p)) < 1e-5) { hit = m; break; }
          if (hit < 0 || used[hit]) ok = false; else { used[hit] = 1; map.push(hit); }
        }
        if (ok) out.push(map);
      }
    }
    return out;
  }
  function faceKey(F) { return F.slice().sort(function (a, b) { return a - b; }).join(','); }
  // Marks: 0 plain, 1 shaded, { h: i } the triangle F[i], F[i+1], F[i+2] of a four-sided face shaded.
  function halfSet(F, h) { return [F[h % 4], F[(h + 1) % 4], F[(h + 2) % 4]]; }
  // Is the pictured solid O (marks mO, view v) the solid S with marks mS, turned? Only the faces O
  // shows clearly are evidence.
  function possible(S, mS, O, mO, v, known) { // known: the turns of S onto O, when already found
    var seen = seenFaces(O, v), maps = known || matchings(S, O);
    if (!maps.length) return false;
    var idx = {};
    O.faces.forEach(function (G, g) { idx[faceKey(G)] = g; });
    return maps.some(function (map) {
      var back = {}; // face of O → face of S
      S.faces.forEach(function (F, f) { back[idx[faceKey(F.map(function (i) { return map[i]; }))]] = f; });
      return seen.every(function (g) {
        var f = back[g], a = mS[f], b = mO[g];
        if (f === undefined) return false;
        if (typeof a !== 'object' || typeof b !== 'object') return a === b;
        return faceKey(halfSet(S.faces[f], a.h).map(function (i) { return map[i]; })) === faceKey(halfSet(O.faces[g], b.h));
      });
    });
  }

  /* ------------------------------------------------------------ marks and views */
  // Marks per level: one shaded face and one half-shaded face; two shaded and one half; one shaded and
  // two halves. Every level carries a half mark. A foil may move a mark only to a congruent face (R3
  // §8.6), and on these symmetric solids shaded faces alone then allow at most two different marked
  // solids (a box with one or two shaded faces has only one); the half mark, which is oriented, is what
  // makes three wrong arrangements possible.
  // Level 0 (v1.2, the starter band; note D2 §3.5): one shaded face and no half mark.
  // v1.2 (version 3; note D1 §6.4, addendum A.1 row 10): the test's kinds of item after the starter band:
  // plain (no marks: the options differ in shape or proportions, as in the official sample), shaded (two
  // whole faces shaded; a foil's shade may sit on a face of another shape, see buildMarked), then the half
  // marks, which only prep sources document (partial shading, last; marks moved to congruent faces only).
  // The net distance (R3 §8.6, O51): 'shaded faces' keeps two shades that meet on the solid joined by a fold
  // line in the pattern; 'shaded, apart in the pattern' puts two shades that meet on the solid on pieces
  // apart in the pattern (folding between them takes two hinges or more), the right solid shows them
  // meeting, and one wrong solid is the net-adjacency lure: the shades it shows do not meet (one in view,
  // or two apart), as the false rule "apart in the pattern, apart on the solid" expects.
  var MARKS = [['F'], [], ['F', 'F'], ['F', 'F'], ['F', 'H'], ['F', 'F', 'H'], ['F', 'H', 'H']];
  var MARK_LABELS = ['one shaded (starter)', 'plain', 'shaded faces', 'shaded, apart in the pattern', 'shaded and half', 'two shaded and half', 'shaded and two halves'];
  // Tags that describe format features only (note D1 §6.0): below the test (the starter band and its
  // scaffolds: dashed fold lines), the documented test range, or beyond it (half marks: prep sources only).
  // Never the real test's difficulty or a forecast.
  var LEVEL_TAGS = { solid: ['test', 'test', 'test', 'test'], marks: ['below', 'test', 'test', 'test', 'beyond', 'beyond', 'beyond'], view: ['test', 'test', 'test'], foil: ['test', 'test'] };
  // An item's range: the registry's rule (CONTRACT-v1.2 W3: beyond when any level is, else below when any is);
  // only the marks dimension carries tags other than 'test', so no item is both.
  function rangeOf(params) { return PX.ex.rangeTag('form', cleanParams(params)); }
  // Fold lines are drawn dashed only in the starter band (a scaffold); in the test range every line of
  // the pattern is plain, as on the official sheet (addendum A.1 row 9).
  function plainFolds(item) { return cleanParams(item && item.params).marks >= 1; }
  function quads(s) { return s.faces.map(function (F, f) { return F.length === 4 ? f : -1; }).filter(function (f) { return f >= 0; }); }
  // A face's shape whichever way it is turned or flipped: corner count, then its sides and diagonals,
  // sorted. Squared lengths ×16 are whole numbers here (corners on a quarter-unit lattice), so the key
  // never hangs on rounding.
  function shapeKey(s, f) {
    var P = s.faces[f].map(function (i) { return s.verts[i]; }), n = P.length, a = [], d = [], i, j;
    function q(u, v) { var w = sub(u, v); return Mth.round(dot(w, w) * 16); }
    for (i = 0; i < n; i++) { a.push(q(P[(i + 1) % n], P[i])); for (j = i + 2; j < n; j++) if (!(i === 0 && j === n - 1)) d.push(q(P[j], P[i])); }
    function k(list) { return list.sort(function (x, y) { return x - y; }).join(','); }
    return n + ':' + k(a) + '/' + k(d);
  }
  function shapeClasses(s) { return s.faces.map(function (_, f) { return shapeKey(s, f); }); }
  // Marks for the level. The first lands on a face of `seen` (the key's picture shows it); faces with a
  // congruent partner are preferred, so a marked face's shape alone rarely names it.
  function randomMarks(rng, s, setup0, seen, ok) { // ok: per face, whether a mark may sit there (markable)
    var setup = rshuffle(rng, setup0), m = s.faces.map(function () { return 0; }), cls = shapeClasses(s);
    function partnered(f) { return cls.some(function (c, g) { return g !== f && c === cls[f]; }); }
    for (var i = 0; i < setup.length; i++) {
      var cand = s.faces.map(function (F, f) { return !m[f] && (!ok || ok[f]) && (setup[i] === 'F' || F.length === 4) && (i > 0 || !seen || seen.indexOf(f) >= 0) ? f : -1; }).filter(function (f) { return f >= 0; });
      if (!cand.length) return null;
      var pref = cand.filter(partnered), f = rpick(rng, pref.length && rng.chance(0.7) ? pref : cand);
      m[f] = setup[i] === 'F' ? 1 : { h: rint(rng, 0, 3) };
    }
    return m;
  }
  // Every arrangement with each mark moved to a congruent face (a half mark turned any way). anyFace (the
  // shaded kind, v1.2): a whole shade may move to a face of another shape too.
  function arrangements(s, m, anyFace) {
    var cls = shapeClasses(s), out = [s.faces.map(function () { return 0; })];
    m.forEach(function (x, f) {
      if (!x) return;
      var next = [];
      out.forEach(function (cfg) {
        s.faces.forEach(function (_, g) {
          if ((!anyFace && cls[g] !== cls[f]) || cfg[g]) return;
          if (typeof x !== 'object') { var c1 = cfg.slice(); c1[g] = 1; next.push(c1); return; }
          for (var h = 0; h < 4; h++) { var c2 = cfg.slice(); c2[g] = { h: h }; next.push(c2); }
        });
      });
      out = next;
    });
    return out;
  }
  function faceMap(s, v) { var idx = {}; s.faces.forEach(function (G, g) { idx[faceKey(G)] = g; }); return s.faces.map(function (F) { return idx[faceKey(F.map(function (i) { return v[i]; }))]; }); }
  // The solid's turns onto itself, as vertex and face maps.
  function autos(s) { return matchings(s, s).map(function (v) { return { v: v, f: faceMap(s, v) }; }); }
  // A reflection of the solid onto itself (z → −z suits every kind here; x → −x is the spare).
  function reflection(s) {
    var tries = [[1, 1, -1], [-1, 1, 1]];
    for (var t = 0; t < tries.length; t++) {
      var M = tries[t], v = [];
      for (var i = 0; i < s.verts.length; i++) {
        var p = [s.verts[i][0] * M[0], s.verts[i][1] * M[1], s.verts[i][2] * M[2]], hit = -1;
        for (var j = 0; j < s.verts.length; j++) if (len(sub(s.verts[j], p)) < 1e-6) { hit = j; break; }
        if (hit < 0) break;
        v.push(hit);
      }
      if (v.length === s.verts.length) return { v: v, f: faceMap(s, v) };
    }
    return null;
  }
  // Marks m carried by a map a of the solid onto itself (a turn, or a reflection: then the mirror image).
  function carry(s, a, m) {
    var out = m.map(function () { return 0; });
    m.forEach(function (x, f) {
      if (!x) return;
      var g = a.f[f];
      if (typeof x !== 'object') { out[g] = 1; return; }
      var set = faceKey(halfSet(s.faces[f], x.h).map(function (i) { return a.v[i]; }));
      for (var h = 0; h < 4; h++) if (faceKey(halfSet(s.faces[g], h)) === set) out[g] = { h: h };
    });
    return out;
  }
  function mkey(m) { return m.map(function (x) { return typeof x === 'object' ? 'h' + x.h : String(x); }).join(','); }
  // One name per marked solid: arrangements that a turn of the solid carries onto each other share it.
  function canon(s, A, m) { var best = null; A.forEach(function (a) { var k = mkey(carry(s, a, m)); if (best === null || k < best) best = k; }); return best; }
  function markedSeen(s, m, v) { return seenFaces(s, v).filter(function (f) { return m[f]; }).length; }
  // A view of the level's kind showing at least three faces clearly and one mark; no face sits near
  // the threshold, so what counts as seen never hangs on rounding.
  // Non-convex prisms (version 3): a marked face shows wholly or not at all, and three faces show wholly.
  function randomView(rng, s, m, level) {
    var nc = isNC(s);
    for (var t = 0; t < (nc ? 40 : 24); t++) {
      var v = { yaw: rint(rng, 0, 11), tilt: rpick(rng, TILT_SETS[level]), el: rint(rng, 0, 1) }, c = facing(s, v);
      if (c.some(function (x) { return x > SEEN - BAND && x < SEEN + BAND; })) continue;
      if (nc) {
        var vis = visible(s, v);
        if (m && m.some(function (x, f) { return x && vis[f] > VIS_NONE && vis[f] < VIS_SEEN; })) continue;
        if (seenFaces(s, v).length < 3) continue;
      }
      if (c.filter(function (x) { return x >= SEEN; }).length >= 3 && (!m || !m.some(function (x) { return x; }) || markedSeen(s, m, v) >= 1) && looksSolid(s, v)) return v;
    }
    return null;
  }
  // The faces a mark may take on solid s in the key's picture v: on a non-convex prism, none that shows
  // only in part.
  function markable(s, v) { var vis = isNC(s) ? visible(s, v) : null; return s.faces.map(function (_, f) { return !vis || vis[f] <= VIS_NONE || vis[f] >= VIS_SEEN; }); }
  // v1.2 (fresh-player run, 19 Nov: a key drawn end-on looked like a flat rectangle): every picture shows the
  // solid as a solid. Three faces in sight meet as a corner's do (their normals span space, |det| ≥ LOOK_DET,
  // so a picture never shows only faces that share one direction, such as a prism's sides seen across), each
  // of them LOOK_MIN of the picture or more (projected areas), and no face takes more than LOOK_MAX of it.
  var LOOK_DET = 0.5, LOOK_MIN = 0.08, LOOK_MAX = 0.7;
  var AREAS = typeof WeakMap === 'function' ? new WeakMap() : null;
  function areasOf(s) {
    var a = AREAS && AREAS.get(s);
    if (!a) { a = s.faces.map(function (F) { return len(newell(F.map(function (i) { return s.verts[i]; }))) / 2; }); if (AREAS) AREAS.set(s, a); }
    return a;
  }
  function det3(a, b, c) { return dot(a, cross(b, c)); }
  function looksSolid(s, v) {
    var c = facing(s, v), vis = isNC(s) ? visible(s, v) : null, A = areasOf(s), N = normalsOf(s), tot = 0, seen = [];
    c.forEach(function (x, f) {
      if (!(x > 0)) return;
      var a = A[f] * x * (vis ? vis[f] : 1);
      tot += a;
      if (x >= SEEN && (!vis || vis[f] >= VIS_SEEN)) seen.push({ f: f, a: a });
    });
    if (seen.length < 3 || !(tot > 0) || seen.some(function (q) { return q.a > LOOK_MAX * tot + 1e-12; })) return false;
    var big = seen.filter(function (q) { return q.a >= LOOK_MIN * tot - 1e-12; });
    for (var i = 0; i < big.length; i++) for (var j = i + 1; j < big.length; j++) for (var k = j + 1; k < big.length; k++) {
      if (Mth.abs(det3(N[big[i].f], N[big[j].f], N[big[k].f])) >= LOOK_DET) return true;
    }
    return false;
  }

  /* ------------------------------------------------------------ shortcut solvers */
  function pickShare(scores, high) {
    var best = high ? -INF : INF, ties = 0, i;
    for (i = 0; i < scores.length; i++) if (high ? scores[i] > best : scores[i] < best) best = scores[i];
    for (i = 0; i < scores.length; i++) if (scores[i] === best) ties++;
    return scores[0] === best ? 1 / ties : 0;
  }
  // Balanced by the foil choice. The face-shape solvers (a seen face's shape decides its mark) need no
  // balancing: foils move marks only to congruent faces, so only the proportion foil fails them.
  var SOLVERS = ['most marks seen', 'fewest marks seen', 'most faces seen', 'fewest faces seen', 'like the others', 'odd one out', 'marks touch as in the net', 'a half mark seen'];
  function feats(o) { var seen = seenFaces(o.solid, o.view); return { seen: seen.length, marked: seen.filter(function (f) { return o.marks[f]; }).length, halves: seen.filter(function (f) { return typeof o.marks[f] === 'object'; }).length, shape: o.solid.kind + o.solid.dims.join(',') }; }
  function touchRule(o, netAdj) { // the false rule "marks that do not touch in the net do not touch on the solid"
    var seen = seenFaces(o.solid, o.view).filter(function (f) { return o.marks[f]; }), touch = false;
    adjacency(o.solid).forEach(function (e) { if (seen.indexOf(e.f) >= 0 && seen.indexOf(e.g) >= 0) touch = true; });
    return touch && !netAdj ? 0 : 1;
  }
  function optFeats(o, netAdj) { var f = feats(o); f.touch = touchRule(o, netAdj); return f; }
  // Shares of the key (F[0]) under each solver, from precomputed features.
  function shares(F) {
    var d = function (a, b) { return Mth.abs(a.marked - b.marked) + Mth.abs(a.seen - b.seen) + Mth.abs(a.halves - b.halves) + (a.shape !== b.shape ? 2 : 0); };
    var sum = F.map(function (a) { var s = 0; F.forEach(function (b) { s += d(a, b); }); return s; });
    function col(k) { return F.map(function (x) { return x[k]; }); }
    return [pickShare(col('marked'), true), pickShare(col('marked'), false), pickShare(col('seen'), true), pickShare(col('seen'), false),
      pickShare(sum, false), pickShare(sum, true), pickShare(col('touch'), true), pickShare(col('halves'), true)];
  }
  var WEIGHTS = [1.5, 1.5, 1, 1, 2, 1.5, 1.5, 1];
  function netTouch(net, marks) { // two marked faces joined by a fold line in the net
    return net.some(function (n) { return n.parent >= 0 && marks[n.face] && marks[n.parent]; });
  }

  /* ------------------------------------------------------------ generate */
  var stats = { tries: 0, nulls: 0, invalid: 0, errors: 0, fallbacks: 0, nets: 0, noView: 0, noMarks: 0, fewOrbits: 0, fewFoils: 0, noSet: 0, twins: 0, lastInvalid: null, lastError: null };
  var FOILS = ['shape', 'marks'];
  function lvl(params, k, n) { var x = params ? params[k] : 0; return Number.isInteger(x) && x >= 0 && x < n ? x : 0; }
  function cleanParams(params) { return { solid: lvl(params, 'solid', 4), marks: lvl(params, 'marks', 7), view: lvl(params, 'view', 3), foil: lvl(params, 'foil', 2) }; }
  /* ------------------------------------------------------------ the starter band (v1.2) */
  // One shaded face and no half mark (note D2 §3.5). With one shade a mark foil can only move it to a
  // face of another shape (on these solids a turn carries every face onto each congruent one), so face
  // shape decides it: the band's method, taught on the strategy card and reported, not bounded (DECISIONS).
  // Foil level 0: one mark foil and two wrong-size solids, one size twice or half the pattern's (both the same
  // stretched solid: one with the pattern's shade, one with the mark foil's), so the options form a
  // 2 × 2 of right or wrong size and right or wrong shaded face, and neither alone finds the key.
  // Foil level 1 keeps that design with the sizes closer (BAND_RATIO below): "marks only" cannot be built
  // with one shade, since upright pictures never show the base, so a solid has at most two other face
  // shapes a picture can carry the shade on (DECISIONS).
  var BAND_KINDS = [['box', 'tri'], ['wedge', 'pyr'], ['frus', 'house'], ['L', 'T', 'U']];
  // v1.2 (version 3, PLAN milestone 8: wrong-size foils at least 40 % off; a fresh player found a size
  // 25 % off hard to see on a phone). v1.2 (fresh-player run, 19 Nov: three wrong-size picks in a row on a
  // 390 px phone, at 1.5 to 1.75 times): the larger size over the smaller, level 0 twice or more (to 2.5),
  // level 1 one and a half times to under twice.
  var BAND_RATIO = [[2, 2.5], [1.5, 2]]; // per foil level: the changed size's ratio [at least, at most | under]
  var BAND_MAX = 5; // no size grows past this (the pictures' common scale)
  function classCount(s) { var c = {}; shapeClasses(s).forEach(function (k) { c[k] = 1; }); return Object.keys(c).length; }
  function bandRatioOk(r, foil) { var b = BAND_RATIO[foil]; return r >= b[0] - 1e-9 && (foil === 0 ? r <= b[1] + 1e-9 : r < b[1] - 1e-9); }
  function stretchedBand(rng, s, foil) {
    for (var t = 0; t < 8; t++) {
      var i = rint(rng, 0, s.kind === 'frus' ? 2 : s.dims.length - 1), d0 = s.dims[i], cand = [];
      for (var k = -10; k <= 10; k++) {
        var dd = d0 + k / 2;
        if (k && dd >= 1 && dd <= BAND_MAX && bandRatioOk(Mth.max(dd, d0) / Mth.min(dd, d0), foil)) cand.push(dd);
      }
      if (!cand.length) continue;
      var d = s.dims.slice();
      d[i] = rpick(rng, cand);
      if (!okDims(s.kind, d)) continue;
      return build(s.kind, d);
    }
    return null;
  }
  function buildBand(rng, p) {
    var kind = rpick(rng, BAND_KINDS[p.solid]), S = build(kind, randomDims(rng, kind)), net = null;
    for (var t = 0; t < 12 && !net; t++) net = unfold(rng, S);
    if (!net) { stats.nets++; return null; }
    var all1 = S.faces.map(function () { return 1; }), kv = randomView(rng, S, isNC(S) ? null : all1, p.view);
    if (!kv) { stats.noView++; return null; }
    var M = randomMarks(rng, S, MARKS[0], seenFaces(S, kv), markable(S, kv));
    if (!M) { stats.noMarks++; return null; }
    // per other face shape, the shade on each face of that shape in turn (a view must show it)
    var cls = shapeClasses(S), maps = autos(S).map(function (a) { return a.v; }), byCls = {}, others = [];
    rshuffle(rng, S.faces.map(function (_, g) { return g; })).forEach(function (g) {
      if (cls[g] === cls[M.indexOf(1)]) return;
      var m = S.faces.map(function () { return 0; });
      m[g] = 1;
      if (!byCls[cls[g]]) { byCls[cls[g]] = []; others.push(byCls[cls[g]]); }
      byCls[cls[g]].push(m);
    });
    if (!others.length) { stats.fewOrbits++; return null; }
    function withView(solid, list, kindName, orbit) {
      for (var q = 0; q < list.length; q++) for (var r = 0; r < 3; r++) {
        var v = randomView(rng, solid, list[q], p.view);
        if (v && !possible(S, M, solid, list[q], v, solid === S ? maps : null)) return { kind: kindName, solid: solid, marks: list[q], view: v, orbit: orbit };
      }
      return null;
    }
    var mf = others.map(function (list, c) { return withView(S, list, 'marks', 'm' + c); }), sets = [];
    for (var j = 0; j < 3; j++) {
      var st = stretchedBand(rng, S, p.foil);
      if (!st) continue;
      var sa = withView(st, [M], 'shape', 's' + j + 'k');
      if (!sa) continue;
      others.forEach(function (list, c) { var sc = mf[c] && withView(st, [mf[c].marks].concat(list), 'shape', 's' + j + 'm' + c); if (sc) sets.push([mf[c], sa, sc]); });
    }
    if (!sets.length) { stats.fewFoils++; return null; }
    var key = { kind: 'key', solid: S, marks: M, view: kv }, netAdj = netTouch(net, M), kf = optFeats(key, netAdj);
    var want = SOLVERS.map(function () { return rng.chance(0.25) ? 1 : 0; }), best = null, bestScore = INF;
    rshuffle(rng, sets).slice(0, 24).forEach(function (set) {
      var sh = shares([kf].concat(set.map(function (o) { return optFeats(o, netAdj); }))), score = 0;
      for (var k = 0; k < sh.length; k++) score += WEIGHTS[k] * Mth.abs(sh[k] - want[k]);
      if (score < bestScore - 1e-9) { bestScore = score; best = set; }
    });
    var perm = rshuffle(rng, [0, 1, 2, 3]), all = [key].concat(best);
    function pubSolid(s0) { return { kind: s0.kind, dims: s0.dims, verts: s0.verts, faces: s0.faces }; }
    return {
      solid: pubSolid(S), net: net, marks: M, key: perm.indexOf(0),
      options: perm.map(function (i) { var o = all[i]; return { kind: o.kind, solid: pubSolid(o.solid), marks: o.marks, view: o.view }; }),
    };
  }

  /* ------------------------------------------------------------ the plain kind (v1.2, version 3) */
  // No marks (note D1 §6.4 kind 1; the official sample: a bevelled box and solids of the same kind in
  // other proportions, addendum A.1 row 10). Foil level 0: one solid of the same kind with a size half
  // again or more off and two solids of other kinds; level 1: three of the same kind, each with one or
  // two sizes off by a quarter or more. Face shapes and sizes decide: the format's own method (Kaplan's
  // first landmark; DECISIONS), reported, not bounded; the size cues a solver can read without folding
  // (the largest or smallest solid, the one most like the others in its sizes) are balanced by the
  // choice of foils.
  function volume(s) {
    var v = 0;
    s.faces.forEach(function (F) { var a = s.verts[F[0]]; for (var k = 1; k + 1 < F.length; k++) v += dot(a, cross(s.verts[F[k]], s.verts[F[k + 1]])) / 6; });
    return Mth.abs(v);
  }
  // Sizes of s with `n` of them (one or two) changed by at least `lo` of their value (on the half lattice).
  function resized(rng, s, n, lo) {
    var nd = s.kind === 'frus' ? 3 : s.dims.length;
    for (var t = 0; t < 16; t++) {
      var d = s.dims.slice(), idx = rshuffle(rng, Array.from({ length: nd }, function (_, i) { return i; })).slice(0, n), ok = true;
      idx.forEach(function (i) {
        var cand = [];
        for (var k = -6; k <= 6; k++) { var x = s.dims[i] + k / 2, off = Mth.abs(x - s.dims[i]) / s.dims[i]; if (k && x >= 1 && off >= lo - 1e-9 && off <= 0.9) cand.push(x); }
        if (!cand.length) ok = false; else d[i] = rpick(rng, cand);
      });
      if (ok && okDims(s.kind, d)) return build(s.kind, d);
    }
    return null;
  }
  // Two solids of one kind that differ in exactly one length, by half again or more (the larger over the smaller).
  function pairedSizes(a, b) {
    if (a.kind !== b.kind) return false;
    var n = 0, far = true;
    for (var i = 0; i < a.dims.length; i++) {
      var r = Mth.max(a.dims[i], b.dims[i]) / Mth.min(a.dims[i], b.dims[i]);
      if (r > 1 + 1e-9) { n++; if (r < 1.5 - 1e-9) far = false; }
    }
    return n === 1 && far;
  }
  function plainFeats(o) {
    return { seen: seenFaces(o.solid, o.view).length, marked: 0, halves: 0, shape: o.solid.kind + o.solid.dims.join(','), vol: volume(o.solid), kind: o.solid.kind, dims: o.solid.dims };
  }
  // How far apart two solids' sizes are (log ratios summed; another kind counts as far).
  function sizeDist(a, b) {
    if (a.kind !== b.kind) return 6;
    var d = 0;
    for (var i = 0; i < a.dims.length; i++) d += Mth.abs(Mth.log(a.dims[i] / b.dims[i]));
    return d;
  }
  var PLAIN_SOLVERS = ['largest solid', 'smallest solid', 'most faces seen', 'fewest faces seen', 'most like the others in size', 'least like the others in size'];
  function plainShares(F) {
    var sum = F.map(function (a) { var t = 0; F.forEach(function (b) { t += sizeDist(a, b); }); return t; });
    function col(k) { return F.map(function (x) { return x[k]; }); }
    return [pickShare(col('vol'), true), pickShare(col('vol'), false), pickShare(col('seen'), true), pickShare(col('seen'), false), pickShare(sum, false), pickShare(sum, true)];
  }
  function buildPlain(rng, p) {
    var kind = rpick(rng, KINDS[p.solid]), S = build(kind, randomDims(rng, kind)), net = null;
    for (var t = 0; t < 12 && !net; t++) net = unfold(rng, S, true);
    if (!net) { stats.nets++; return null; }
    var M = S.faces.map(function () { return 0; }), kv = randomView(rng, S, null, p.view);
    if (!kv) { stats.noView++; return null; }
    var pool = [], seenSolid = {};
    function add(solid, kindName) {
      if (!solid) return;
      var sk = solid.kind + solid.dims.join(',');
      if (seenSolid[sk] || sk === S.kind + S.dims.join(',')) return;
      var zero = solid.faces.map(function () { return 0; }), v = randomView(rng, solid, null, p.view);
      if (!v || possible(S, M, solid, zero, v)) return;
      seenSolid[sk] = 1;
      pool.push({ kind: kindName, solid: solid, marks: zero, view: v, orbit: sk });
    }
    if (p.foil === 0) {
      // two kinds of solid, two of each: the pattern's kind (the key and one in other proportions) and one
      // other kind in two proportions, so counting kinds never points at the key
      for (var a = 0; a < 3; a++) add(resized(rng, S, 1, 0.5), 'shape');
      var others = rshuffle(rng, [].concat.apply([], KINDS.slice(0, p.solid + 1)).filter(function (k) { return k !== S.kind; }));
      others.slice(0, 3).forEach(function (k) { var O = build(k, randomDims(rng, k)); add(O, 'other'); for (var r = 0; r < 2; r++) add(resized(rng, O, 1, 0.5), 'other'); });
    } else {
      // more candidates than places: the key is the middle of its own resizings unless the triple is
      // chosen with care (the solver "most like the others in its sizes")
      for (var b = 0; b < 6; b++) add(resized(rng, S, 1, 0.25), 'shape');
      for (var c = 0; c < 6; c++) add(resized(rng, S, 2, 0.25), 'shape');
    }
    var key = { kind: 'key', solid: S, marks: M, view: kv }, kf = plainFeats(key), pf = pool.map(plainFeats);
    var want = PLAIN_SOLVERS.map(function () { return rng.chance(0.25) ? 1 : 0; }), best = null, bestScore = INF;
    var idx = rshuffle(rng, pool.map(function (_, i) { return i; })).slice(0, 12);
    for (var i = 0; i < idx.length; i++) for (var j = i + 1; j < idx.length; j++) for (var k = j + 1; k < idx.length; k++) {
      var tri = [idx[i], idx[j], idx[k]], set = tri.map(function (x) { return pool[x]; });
      var nSame = set.filter(function (o) { return o.kind === 'shape'; }).length;
      if (p.foil === 0) {
        var ot = set.filter(function (o) { return o.kind === 'other'; });
        if (nSame !== 1 || ot.length !== 2 || !pairedSizes(ot[0].solid, ot[1].solid)) continue;
      }
      var sh = plainShares([kf].concat(tri.map(function (x) { return pf[x]; }))), score = 0;
      for (var q = 0; q < sh.length; q++) score += Mth.abs(sh[q] - want[q]);
      if (score < bestScore - 1e-9) { bestScore = score; best = set; }
    }
    if (!best) { stats.noSet++; return null; }
    var perm = rshuffle(rng, [0, 1, 2, 3]), all = [key].concat(best);
    function pubSolid(s0) { return { kind: s0.kind, dims: s0.dims, verts: s0.verts, faces: s0.faces }; }
    return {
      solid: pubSolid(S), net: net, marks: M, key: perm.indexOf(0),
      options: perm.map(function (x) { var o = all[x]; return { kind: o.kind === 'other' ? 'shape' : o.kind, solid: pubSolid(o.solid), marks: o.marks, view: o.view }; }),
    };
  }

  function buildItem(rng, p) {
    if (p.marks === 0) return buildBand(rng, p);
    if (p.marks === 1) return buildPlain(rng, p);
    return buildMarked(rng, p, MARKS[p.marks]);
  }
  // Marked items (shaded faces, half marks): marks moved only to congruent faces, so face shapes never
  // tell a mark foil from the key (RV-B §1); each foil is a different marked solid.
  // Faces that share an edge, as a set of 'f,g' keys (f < g).
  function adjSet(s) { var o = {}; adjacency(s).forEach(function (e) { o[Mth.min(e.f, e.g) + ',' + Mth.max(e.f, e.g)] = 1; }); return o; }
  // The shaded kinds' two shades (version 3), the first on a face the key's picture shows: 'shaded faces'
  // keeps shades that meet on the solid joined by a fold line in the pattern; apart, they meet on the
  // solid, lie on pieces not joined in the pattern, and the key's picture shows both.
  function shadePair(rng, S, net, kv, apart) {
    var seen = seenFaces(S, kv), ok = markable(S, kv), adj = adjSet(S), hinge = {}, out = [];
    net.forEach(function (n) { if (n.parent >= 0) hinge[Mth.min(n.face, n.parent) + ',' + Mth.max(n.face, n.parent)] = 1; });
    for (var f = 0; f < S.faces.length; f++) for (var g = f + 1; g < S.faces.length; g++) {
      if (!ok[f] || !ok[g]) continue;
      var k = f + ',' + g, sf = seen.indexOf(f) >= 0, sg = seen.indexOf(g) >= 0;
      if (apart ? adj[k] && !hinge[k] && sf && sg : (!adj[k] || hinge[k]) && (sf || sg)) out.push([f, g]);
    }
    if (!out.length) return null;
    var pick = rpick(rng, out), m = S.faces.map(function () { return 0; });
    m[pick[0]] = 1; m[pick[1]] = 1;
    return m;
  }
  function buildMarked(rng, p, setup) {
    // a rectangular pyramid has one four-sided face, too few for two half marks
    var halves = setup.filter(function (x) { return x === 'H'; }).length;
    var kinds = KINDS[p.solid].filter(function (k) { return halves < 2 || k !== 'pyr'; });
    var kind = rpick(rng, kinds), S = build(kind, randomDims(rng, kind)), net = null;
    for (var t = 0; t < 12 && !net; t++) net = unfold(rng, S, true);
    if (!net) { stats.nets++; return null; }
    var all1 = S.faces.map(function () { return 1; }), kv = randomView(rng, S, isNC(S) ? null : all1, p.view);
    if (!kv) { stats.noView++; return null; }
    var shadedKind = p.marks === 2 || p.marks === 3, apart = p.marks === 3;
    var M = shadedKind ? shadePair(rng, S, net, kv, apart) : randomMarks(rng, S, setup, seenFaces(S, kv), markable(S, kv));
    if (!M) { stats.noMarks++; return null; }
    // Mark foils: each mark moved to a congruent face, one foil per different marked solid (turns of
    // the solid carry arrangements of one marked solid onto each other); the mirror image is one of them.
    var A = autos(S), maps = A.map(function (a) { return a.v; }), kc = canon(S, A, M), R = reflection(S);
    var mc = R ? canon(S, A, carry(S, R, M)) : null, groups = {}, names = [];
    // the shaded kind (whole shades only): on these symmetric solids moves to congruent faces leave at most
    // a mirror pair, so a shade may also move to a face of another shape, where the shaded face's shape
    // tells the foil (the band's method, now with two shades and plain fold lines; DECISIONS)
    var anyFace = shadedKind;
    arrangements(S, M, anyFace).forEach(function (cfg) {
      var c = canon(S, A, cfg);
      if (c === kc) return;
      if (!groups[c]) { groups[c] = []; names.push(c); }
      groups[c].push(cfg);
    });
    if (names.length < (p.foil === 0 ? 2 : 3)) { stats.fewOrbits++; return null; }
    names = rshuffle(rng, names);
    if (mc !== kc && groups[mc]) names = [mc].concat(names.filter(function (c) { return c !== mc; }));
    // apart: marked solids whose two shades do not meet come first (lures are among them)
    var adjS = adjSet(S);
    function meets(cfg) { var f = []; cfg.forEach(function (x, g) { if (x) f.push(g); }); return f.length === 2 && adjS[f[0] + ',' + f[1]]; }
    if (apart) { // up to three that do not meet (lures) and five that do
      var apartN = names.filter(function (c) { return !meets(groups[c][0]); }).slice(0, 3), meetN = names.filter(function (c) { return meets(groups[c][0]); }).slice(0, 5);
      names = apartN.concat(meetN);
    }
    var key = { kind: 'key', solid: S, marks: M, view: kv }, pool = [];
    names.slice(0, 8).forEach(function (c) {
      var reps = rshuffle(rng, groups[c]), got = 0;
      for (var r = 0; r < reps.length && r < 6 && got < 2; r++) {
        // apart: a wrong solid whose shades meet shows both, as the right one does (the marks a picture
        // shows never tell them apart); a lure may show any
        var v = null;
        for (var tv = 0; tv < (apart ? 4 : 1) && !v; tv++) { var vv = randomView(rng, S, reps[r], p.view); if (vv && (!apart || !meets(reps[r]) || markedSeen(S, reps[r], vv) === 2)) v = vv; }
        if (v && !possible(S, M, S, reps[r], v, maps)) {
          // the lure: its shades in view do not meet (one in view, or two apart), as the false rule expects
          var sv = seenFaces(S, v).filter(function (g) { return reps[r][g]; }), lure = apart && !(sv.length === 2 && adjS[Mth.min(sv[0], sv[1]) + ',' + Mth.max(sv[0], sv[1])]);
          pool.push({ kind: c === mc ? 'mirror' : 'marks', solid: S, marks: reps[r], view: v, orbit: c, lure: lure }); got++;
        }
      }
    });
    if (apart && !pool.some(function (o) { return o.lure; })) { stats.fewFoils++; return null; }
    // apart, foil level 0: the solid in other proportions is the lure (one shade in view), so that neither
    // the marks a picture shows nor its sizes single out the right solid among the other three
    if (p.foil === 0) for (var s = 0; s < 3; s++) {
      var st = stretched(rng, S), sv = null;
      for (var tw = 0; tw < (apart ? 6 : 1) && st && !sv; tw++) { var vw = randomView(rng, st, M, p.view); if (vw && (!apart || markedSeen(st, M, vw) < 2)) sv = vw; }
      if (sv && !possible(S, M, st, M, sv)) pool.push({ kind: 'shape', solid: st, marks: M, view: sv, orbit: 'shape' + s, lure: apart });
    }
    var nShape = pool.filter(function (o) { return o.kind === 'shape'; }).length, nOrb = {};
    pool.forEach(function (o) { if (o.kind !== 'shape') nOrb[o.orbit] = 1; });
    if (Object.keys(nOrb).length < (p.foil === 0 ? 2 : 3) || (p.foil === 0 && !nShape)) { stats.fewFoils++; return null; }
    var netAdj = netTouch(net, M), kf = optFeats(key, netAdj), pf = pool.map(function (o) { return optFeats(o, netAdj); });
    var want = SOLVERS.map(function () { return rng.chance(0.25) ? 1 : 0; }), best = null, bestScore = INF;
    var idx = rshuffle(rng, pool.map(function (_, i) { return i; })).slice(0, 14);
    for (var a = 0; a < idx.length; a++) for (var b = a + 1; b < idx.length; b++) for (var c = b + 1; c < idx.length; c++) {
      var tri = [idx[a], idx[b], idx[c]], set = tri.map(function (i) { return pool[i]; });
      if (set[0].orbit === set[1].orbit || set[0].orbit === set[2].orbit || set[1].orbit === set[2].orbit) continue;
      if (set.filter(function (o) { return o.kind === 'shape'; }).length !== (p.foil === 0 ? 1 : 0)) continue;
      if (apart && set.filter(function (o) { return o.lure; }).length !== 1) continue; // one lure; the others show both shades
      var sh = shares([kf].concat(tri.map(function (i) { return pf[i]; }))), score = 0;
      for (var k = 0; k < sh.length; k++) score += WEIGHTS[k] * Mth.abs(sh[k] - want[k]);
      if (set.some(function (o) { return o.kind === 'mirror'; })) score -= 0.15;
      if (score < bestScore - 1e-9) { bestScore = score; best = set; }
    }
    if (!best) { stats.noSet++; return null; }
    var perm = rshuffle(rng, [0, 1, 2, 3]), all = [key].concat(best);
    function pubSolid(s0) { return { kind: s0.kind, dims: s0.dims, verts: s0.verts, faces: s0.faces }; }
    return {
      solid: pubSolid(S), net: net, marks: M, key: perm.indexOf(0),
      options: perm.map(function (i) { var o = all[i]; return { kind: o.kind, solid: pubSolid(o.solid), marks: o.marks, view: o.view }; }),
    };
  }

  /* ------------------------------------------------------------ validate (independent: fold the net) */
  // Rotation about the unit axis k through point c, by angle a (Rodrigues), applied to point p.
  function turn(p, c, k, a) {
    var v = sub(p, c), cs = Mth.cos(a), sn = Mth.sin(a), kv = cross(k, v), kd = dot(k, v) * (1 - cs);
    return add(c, [v[0] * cs + kv[0] * sn + k[0] * kd, v[1] * cs + kv[1] * sn + k[1] * kd, v[2] * cs + kv[2] * sn + k[2] * kd]);
  }
  // Folds the stored net: the root lies in the plane z = 0 seen from +z (the outside up); every other
  // face turns about its hinge by the angle between its solid face's normal and its parent's, away
  // from the viewer. Returns per face the folded points, or a reason. frac (0–1, default 1): every
  // hinge turned by that share of its angle (the view's fold-up show-me; the validator uses 1).
  function fold(item, frac) {
    var share = frac === undefined ? 1 : frac;
    var S = item.solid, net = item.net, by = {}, pts = {}, i;
    if (!Array.isArray(net) || net.length !== S.faces.length) return 'the net must have one piece per face';
    net.forEach(function (n) { by[n.face] = n; });
    var root = net.filter(function (n) { return n.parent === -1; });
    if (root.length !== 1) return 'the net needs exactly one root';
    pts[root[0].face] = root[0].poly.map(function (p) { return [p[0], p[1], 0]; });
    var chain = {}; // per face: the list of turns (from the root down) that place it
    chain[root[0].face] = [];
    for (var pass = 0; pass < net.length; pass++) {
      net.forEach(function (n) {
        if (pts[n.face] || n.parent < 0 || !pts[n.parent]) return;
        var Fp = S.faces[n.parent], Fc = S.faces[n.face], pa = Fp.indexOf(n.hinge[0]), pb = Fp.indexOf(n.hinge[1]);
        var ca = Fc.indexOf(n.hinge[0]), cb = Fc.indexOf(n.hinge[1]);
        if (pa < 0 || pb < 0 || ca < 0 || cb < 0) { pts[n.face] = 'bad'; return; }
        var P = by[n.parent].poly, C = n.poly;
        if (Mth.abs(P[pa][0] - C[ca][0]) + Mth.abs(P[pa][1] - C[ca][1]) > 2e-3 || Mth.abs(P[pb][0] - C[cb][0]) + Mth.abs(P[pb][1] - C[cb][1]) > 2e-3) { pts[n.face] = 'bad'; return; }
        var np = faceNormal(S, n.parent), phi = Mth.acos(Mth.max(-1, Mth.min(1, dot(np, faceNormal(S, n.face)))));
        // the turn in the flat layout (z = 0), signed so the child leaves toward −z, or toward +z at a
        // reflex edge (a non-convex prism's inner corner: the child face rises out of the parent's plane)
        var A = [P[pa][0], P[pa][1], 0], B = [P[pb][0], P[pb][1], 0], k = unit(sub(B, A));
        // the child's inward direction at the hinge (left of the edge in its counterclockwise order)
        var h0 = Fc[ca], h1 = Fc[(ca + 1) % Fc.length] === Fc[cb] ? Fc[cb] : null;
        var inward = h1 !== null ? cross(faceNormal(S, n.face), sub(S.verts[h1], S.verts[h0])) : cross(faceNormal(S, n.face), sub(S.verts[Fc[ca]], S.verts[Fc[cb]]));
        var up = dot(np, inward) > 1e-9;
        // a point of the child just inside its hinge edge (the piece lies there, whatever its shape)
        var mx = (C[ca][0] + C[cb][0]) / 2, my = (C[ca][1] + C[cb][1]) / 2, ex = C[cb][0] - C[ca][0], ey = C[cb][1] - C[ca][1], el = Mth.sqrt(ex * ex + ey * ey) || 1;
        var cen = [mx - ey / el * 0.01, my + ex / el * 0.01, 0];
        if (!pip2(C, cen[0], cen[1])) cen = [mx + ey / el * 0.01, my - ex / el * 0.01, 0];
        var sgn = (turn(cen, A, k, phi)[2] < 0) !== up ? 1 : -1;
        chain[n.face] = chain[n.parent].concat([{ A: A, k: k, a: sgn * phi * share }]);
        pts[n.face] = C.map(function (q) {
          var p = [q[0], q[1], 0], L = chain[n.face];
          for (var t = L.length - 1; t >= 0; t--) p = turn(p, L[t].A, L[t].k, L[t].a); // innermost turn first
          return p;
        });
      });
    }
    for (i = 0; i < net.length; i++) if (!pts[net[i].face] || pts[net[i].face] === 'bad') return 'the net does not hang together at face ' + net[i].face;
    return pts;
  }
  function validNet(item) {
    var S = item.solid, pts = fold(item);
    if (typeof pts === 'string') return pts;
    // closure: every corner of the solid lands in one place, whichever faces bring it there
    var where = {};
    for (var f = 0; f < S.faces.length; f++) {
      var F = S.faces[f], P = pts[f];
      if (!P || P.length !== F.length) return 'face ' + f + ' has the wrong number of corners';
      for (var i = 0; i < F.length; i++) {
        var w = where[F[i]];
        if (!w) where[F[i]] = P[i]; else if (len(sub(w, P[i])) > 5e-3) return 'the net does not close at corner ' + F[i];
      }
    }
    // the folded shape is the solid itself (the same distances between all corners)
    for (var a = 0; a < S.verts.length; a++) for (var b = a + 1; b < S.verts.length; b++) {
      if (!where[a] || !where[b]) return 'corner ' + (where[a] ? b : a) + ' is never reached';
      if (Mth.abs(len(sub(where[a], where[b])) - len(sub(S.verts[a], S.verts[b]))) > 5e-3) return 'the folded net is not the solid';
    }
    if (overlapping(item.net)) return 'two pieces of the net overlap';
    return true;
  }
  function okSolid(s) {
    if (!s || !Array.isArray(s.verts) || !Array.isArray(s.faces) || s.verts.length < 4 || s.faces.length < 4 || !BUILD[s.kind]) return false;
    if (isNC(s)) return okClosed(s);
    // convex and closed: every face's plane has all corners on its inner side; Euler's formula holds
    var c = [0, 0, 0];
    s.verts.forEach(function (v) { c = add(c, mul(v, 1 / s.verts.length)); });
    for (var f = 0; f < s.faces.length; f++) {
      var F = s.faces[f], n = unit(newell(F.map(function (i) { return s.verts[i]; }))), o = s.verts[F[0]];
      if (dot(n, sub(o, c)) <= 0) return false;
      for (var i = 0; i < s.verts.length; i++) if (dot(n, sub(s.verts[i], o)) > 1e-6) return false;
    }
    return s.verts.length - adjacency(s).length + s.faces.length === 2;
  }
  // A non-convex solid: every edge met once each way (closed, consistently turned), flat faces, Euler's
  // formula, and a positive volume (faces turned outward).
  function okClosed(s) {
    var seen = {}, vol = 0;
    for (var f = 0; f < s.faces.length; f++) {
      var F = s.faces[f], P = F.map(function (i) { return s.verts[i]; }), n = unit(newell(P));
      for (var i = 0; i < F.length; i++) {
        var k = F[i] + '>' + F[(i + 1) % F.length];
        if (seen[k]) return false;
        seen[k] = 1;
        if (Mth.abs(dot(n, sub(P[i], P[0]))) > 1e-6) return false;
      }
      for (var j = 1; j + 1 < P.length; j++) vol += dot(P[0], cross(P[j], P[j + 1])) / 6;
    }
    for (var key in seen) { var ab = key.split('>'); if (!seen[ab[1] + '>' + ab[0]]) return false; }
    return vol > 1e-6 && s.verts.length - adjacency(s).length + s.faces.length === 2;
  }
  function okMarks(s, m) {
    return Array.isArray(m) && m.length === s.faces.length && m.every(function (x, f) { return x === 0 || x === 1 || (x && typeof x === 'object' && Number.isInteger(x.h) && x.h >= 0 && x.h < 4 && s.faces[f].length === 4); });
  }
  /* ------------------------------------------------------------ validate, check 2 (without the solid) */
  // The stored pieces are laid onto a pictured solid O face by face. A piece goes onto a face of O that
  // it fits exactly, turned in its plane but not flipped (the pattern is the outside surface; pieces
  // and faces both list corners counterclockwise seen from outside, so equal distances in the same
  // order mean the same side out). Two pieces joined by a fold line go onto two faces of O meeting
  // along the edge the fold line lands on. When every piece gets a face of its own, O folds from the
  // pattern (a convex solid is fixed by its faces and how they meet: Cauchy). The marks must then agree
  // on every face the picture shows clearly. Own code throughout: fold lines from the stored layout,
  // face normals by a fan of cross products, the picture's turn applied by hand.
  var FIT = 0.01;
  function d2(p, q) { return Mth.sqrt((p[0] - q[0]) * (p[0] - q[0]) + (p[1] - q[1]) * (p[1] - q[1])); }
  // Fold lines: edge a (corners a, a + 1) of piece i lies on edge b of piece j, the other way round.
  function foldLines(net) {
    var out = [];
    for (var i = 0; i < net.length; i++) for (var j = i + 1; j < net.length; j++) {
      var P = net[i].poly, Q = net[j].poly;
      for (var a = 0; a < P.length; a++) for (var b = 0; b < Q.length; b++)
        if (d2(P[a], Q[(b + 1) % Q.length]) < FIT && d2(P[(a + 1) % P.length], Q[b]) < FIT) out.push({ i: i, a: a, j: j, b: b });
    }
    return out;
  }
  function fitsFace(poly, Q, sh) { // piece corner k on Q[(k + sh) % n]: all distances equal
    var n = poly.length;
    if (Q.length !== n) return false;
    for (var a = 0; a < n; a++) for (var b = a + 1; b < n; b++) if (Mth.abs(d2(poly[a], poly[b]) - len(sub(Q[(a + sh) % n], Q[(b + sh) % n]))) > FIT) return false;
    return true;
  }
  function faceCos(O, v) {
    var c = YAW[v.yaw][0], sn = YAW[v.yaw][1], T = TILTS[v.tilt], V = VIEWS[v.el || 0];
    return O.faces.map(function (G) {
      var p0 = O.verts[G[0]], n = [0, 0, 0];
      for (var k = 1; k + 1 < G.length; k++) n = add(n, cross(sub(O.verts[G[k]], p0), sub(O.verts[G[k + 1]], p0)));
      n = unit(n);
      var t = [T[0] * n[0] + T[1] * n[1] + T[2] * n[2], T[3] * n[0] + T[4] * n[1] + T[5] * n[2], T[6] * n[0] + T[7] * n[1] + T[8] * n[2]];
      return (c * t[0] + sn * t[2]) * V[0] + t[1] * V[1] + (-sn * t[0] + c * t[2]) * V[2];
    });
  }
  // Every way to lay the pieces onto O: per piece { g: face of O, s: corner shift }.
  function layings(net, O, lines) {
    var Q = O.faces.map(function (G) { return G.map(function (i) { return O.verts[i]; }); }), owner = {}, adj = net.map(function () { return []; }), out = [];
    O.faces.forEach(function (G, g) { for (var k = 0; k < G.length; k++) owner[G[k] + '>' + G[(k + 1) % G.length]] = { g: g, k: k }; });
    lines.forEach(function (e) { adj[e.i].push({ me: e.a, to: e.j, them: e.b }); adj[e.j].push({ me: e.b, to: e.i, them: e.a }); });
    for (var g0 = 0; g0 < Q.length; g0++) for (var s0 = 0; s0 < Q[g0].length; s0++) {
      if (!fitsFace(net[0].poly, Q[g0], s0)) continue;
      var at = net.map(function () { return null; }), used = {}, ok = true, queue = [0];
      at[0] = { g: g0, s: s0 }; used[g0] = 1;
      while (queue.length && ok) {
        var i = queue.shift(), G = O.faces[at[i].g], n = G.length;
        for (var x = 0; x < adj[i].length && ok; x++) {
          var e = adj[i][x], u = G[(e.me + at[i].s) % n], v = G[(e.me + 1 + at[i].s) % n], w = owner[v + '>' + u];
          if (!w) { ok = false; break; }
          var m = O.faces[w.g].length, sh = ((w.k - e.them) % m + m) % m; // the neighbour's corner `them` lands on v
          if (at[e.to]) { if (at[e.to].g !== w.g || at[e.to].s !== sh) ok = false; continue; }
          if (used[w.g] || !fitsFace(net[e.to].poly, Q[w.g], sh)) { ok = false; break; }
          at[e.to] = { g: w.g, s: sh }; used[w.g] = 1; queue.push(e.to);
        }
      }
      if (ok && at.every(function (y) { return y; })) out.push(at);
    }
    return out;
  }
  // Check 2's own visibility on a non-convex prism: points on each face (a grid in the face's own plane),
  // a ray from each toward the viewer in the solid's frame, and whether it meets another face first.
  // Per face, the share of points not hidden (own code: rays in 3D, not the picture's 2D depths).
  function shownShare(O, v) {
    var c = YAW[v.yaw][0], sn = YAW[v.yaw][1], T = TILTS[v.tilt], V = VIEWS[v.el || 0];
    var r = [c * V[0] - sn * V[2], V[1], sn * V[0] + c * V[2]];
    var d = [T[0] * r[0] + T[3] * r[1] + T[6] * r[2], T[1] * r[0] + T[4] * r[1] + T[7] * r[2], T[2] * r[0] + T[5] * r[1] + T[8] * r[2]];
    function wind(Q, x, y) {
      var wn = 0;
      for (var i = 0; i < Q.length; i++) {
        var a = Q[i], b = Q[(i + 1) % Q.length], cr = (b[0] - a[0]) * (y - a[1]) - (x - a[0]) * (b[1] - a[1]);
        if (a[1] <= y) { if (b[1] > y && cr > 0) wn++; } else if (b[1] <= y && cr < 0) wn--;
      }
      return wn !== 0;
    }
    var Fs = O.faces.map(function (G) {
      var P = G.map(function (i) { return O.verts[i]; }), n = [0, 0, 0];
      for (var k = 1; k + 1 < P.length; k++) n = add(n, cross(sub(P[k], P[0]), sub(P[k + 1], P[0])));
      n = unit(n);
      var e1 = unit(sub(P[1], P[0])), e2 = cross(n, e1);
      return { P: P, n: n, e1: e1, e2: e2, Q: P.map(function (q) { var w = sub(q, P[0]); return [dot(w, e1), dot(w, e2)]; }) };
    });
    return Fs.map(function (F, g) {
      if (dot(F.n, d) <= 1e-9) return 0;
      var u0 = INF, u1 = -INF, w0 = INF, w1 = -INF, all = 0, shown = 0;
      F.Q.forEach(function (q) { u0 = Mth.min(u0, q[0]); u1 = Mth.max(u1, q[0]); w0 = Mth.min(w0, q[1]); w1 = Mth.max(w1, q[1]); });
      for (var i = 0; i < 9; i++) for (var j = 0; j < 9; j++) {
        var u = u0 + (u1 - u0) * (i + 0.5) / 9, w = w0 + (w1 - w0) * (j + 0.5) / 9;
        if (!wind(F.Q, u, w)) continue;
        all++;
        var X = add(F.P[0], add(mul(F.e1, u), mul(F.e2, w))), hid = false;
        for (var h = 0; h < Fs.length && !hid; h++) {
          if (h === g) continue;
          var H = Fs[h], dn = dot(H.n, d);
          if (Mth.abs(dn) < 1e-9) continue;
          var t = dot(H.n, sub(H.P[0], X)) / dn;
          if (t <= 1e-6) continue;
          var Y = sub(add(X, mul(d, t)), H.P[0]);
          if (wind(H.Q, dot(Y, H.e1), dot(Y, H.e2))) hid = true;
        }
        if (!hid) shown++;
      }
      return all ? shown / all : 0;
    });
  }
  function foldsOnto(item, o, lines) {
    var cs = faceCos(o.solid, o.view), net = item.net, sh = isNC(o.solid) ? shownShare(o.solid, o.view) : null;
    return layings(net, o.solid, lines).some(function (at) {
      for (var i = 0; i < net.length; i++) {
        var g = at[i].g, x = item.marks[net[i].face], y = o.marks[g];
        if (cs[g] < SEEN || (sh && sh[g] < 0.8)) continue;
        if (typeof x === 'object') { if (!y || typeof y !== 'object' || y.h !== (x.h + at[i].s) % 4) return false; } else if (y !== x) return false;
      }
      return true;
    });
  }
  // The fold lines found in the layout are exactly the hinges the pattern draws dashed.
  // Points every 0.02 units along each edge of one face that lie on another face's outline, faces not
  // joined by a hinge: a run of four or more is a cut inside the pattern (the validator's own check).
  function cutInside(net) {
    function onOutline(P, x, y) {
      for (var k = 0; k < P.length; k++) {
        var a = P[k], b = P[(k + 1) % P.length], vx = b[0] - a[0], vy = b[1] - a[1], ll = vx * vx + vy * vy;
        var u = ll ? Mth.max(0, Mth.min(1, ((x - a[0]) * vx + (y - a[1]) * vy) / ll)) : 0;
        if (Mth.hypot(x - a[0] - u * vx, y - a[1] - u * vy) < 0.006) return true;
      }
      return false;
    }
    for (var i = 0; i < net.length; i++) for (var j = 0; j < net.length; j++) {
      if (i === j) continue;
      var A = net[i].poly, B = net[j].poly, kin = net[i].parent === net[j].face || net[j].parent === net[i].face;
      for (var k = 0; k < A.length; k++) {
        var a = A[k], b = A[(k + 1) % A.length], n = Mth.max(2, Mth.ceil(Mth.hypot(b[0] - a[0], b[1] - a[1]) / 0.02)), run = 0;
        // parent and child: the fold line they share (the same edge both ways) is not a cut
        if (kin && B.some(function (q, m) { var r = B[(m + 1) % B.length]; return d2(a, r) < FIT && d2(b, q) < FIT; })) continue;
        for (var s0 = 1; s0 < n; s0++) {
          var x = a[0] + (b[0] - a[0]) * s0 / n, y = a[1] + (b[1] - a[1]) * s0 / n;
          run = onOutline(net[j].poly, x, y) ? run + 1 : 0;
          if (run >= 4) return true;
        }
      }
    }
    return false;
  }
  function linesMatchHinges(item, lines) {
    var hinge = {};
    item.net.forEach(function (n, i) { if (n.parent >= 0) hinge[i] = n.parent; });
    if (lines.length !== item.net.length - 1) return false;
    var at = {}; item.net.forEach(function (n, i) { at[n.face] = i; });
    return lines.every(function (e) { return at[item.net[e.i].parent] === e.j || at[item.net[e.j].parent] === e.i; });
  }

  function validate(item) {
    try {
      if (!item || !okSolid(item.solid) || item.solid.mirror) return 'the solid is not a closed convex solid';
      if (item.solid.kind === 'box' && new Set(item.solid.dims.slice(0, 3)).size < 3) return 'a box must not be a cube';
      var lv = cleanParams(item.params).marks;
      if (!okMarks(item.solid, item.marks) || (lv !== 1 && !item.marks.some(function (x) { return x; }))) return 'bad marks';
      var vn = validNet(item);
      if (vn !== true) return vn;
      if (!Array.isArray(item.options) || item.options.length !== 4) return 'needs 4 options';
      if (!(Number.isInteger(item.key) && item.key >= 0 && item.key < 4)) return 'key out of range';
      var lines = foldLines(item.net);
      if (!linesMatchHinges(item, lines)) return 'the fold lines in the layout are not the drawn hinges';
      if (plainFolds(item) && cutInside(item.net)) return 'a cut edge lies along another face (it would read as a fold line)';
      for (var i = 0; i < 4; i++) {
        var o = item.options[i];
        if (!o || !okSolid(o.solid) || !okMarks(o.solid, o.marks) || !o.view || !YAW[o.view.yaw] || !TILTS[o.view.tilt] || !VIEWS[o.view.el]) return 'option ' + i + ' is malformed';
        var c = facing(o.solid, o.view), sh = isNC(o.solid) ? shownShare(o.solid, o.view) : null;
        if (c.filter(function (x, g) { return x >= SEEN && (!sh || sh[g] >= 0.8); }).length < 3) return 'option ' + i + ' shows fewer than three faces clearly';
        if (sh && o.marks.some(function (x, g) { return x && c[g] > 0 && sh[g] > 0.1 && sh[g] < 0.85; })) return 'option ' + i + ' shows a mark only in part';
        if (c.some(function (x) { return x > SEEN - BAND && x < SEEN + BAND; })) return 'option ' + i + ' has a face at the edge of being seen';
        if (!looksSolid(o.solid, o.view)) return 'option ' + i + ' is drawn flat (no corner of three faces in sight)';
        if (lv !== 1 && !markedSeen(o.solid, o.marks, o.view)) return 'option ' + i + ' shows no mark';
        var ok = possible(item.solid, item.marks, o.solid, o.marks, o.view);
        if (ok !== foldsOnto(item, o, lines)) return 'option ' + i + ': the two checks disagree';
        if (i === item.key && !ok) return 'the key is not the folded net';
        if (i !== item.key && ok) return 'option ' + i + ' could also be the folded net';
      }
      if (!picturesApart(item)) return 'two options draw the same picture';
      if (lv === 0) return validBand(item);
      if (lv === 1) return validPlain(item);
      if (lv === 2 || lv === 3) return validShaded(item);
      return true;
    } catch (e) { return 'validate threw: ' + (e && e.message); }
  }
  // The starter band's promises, checked on what is stored: one shaded face and no half mark, on the
  // pattern and on every option; every option's corners are its stated sizes (rebuilt here), and a
  // wrong-size solid differs from the pattern in one size only, the larger over the smaller twice or more
  // (one and a half times to under twice at foil level 1); the easiest solids are boxes and triangular prisms.
  function validBand(item) {
    function one(m) { return m.filter(function (x) { return x === 1; }).length === 1 && !m.some(function (x) { return x && typeof x === 'object'; }); }
    if (!one(item.marks)) return 'starter: one shaded face and no half mark';
    var p = cleanParams(item.params), d0 = item.solid.dims;
    for (var i = 0; i < 4; i++) {
      var o = item.options[i];
      if (!one(o.marks)) return 'starter: option ' + i + ' must show one shaded face and no half mark';
      if (o.solid.kind !== item.solid.kind || o.solid.dims.length !== d0.length) return 'starter: option ' + i + ' is another kind of solid';
      var R = BUILD[o.solid.kind](o.solid.dims);
      if (R.verts.length !== o.solid.verts.length || R.verts.some(function (v, k) { return len(sub(v, o.solid.verts[k])) > 1e-9; })) return 'starter: option ' + i + '\'s corners are not its stated sizes';
      var off = o.solid.dims.map(function (d, k) { return Mth.abs(d - d0[k]); }), n = off.filter(function (x) { return x > 1e-9; }).length;
      if (n > 1) return 'starter: option ' + i + ' differs in more than one size';
      if (n === 1) {
        var k1 = off.findIndex(function (x) { return x > 1e-9; }), a = o.solid.dims[k1], r = Mth.max(a, d0[k1]) / Mth.min(a, d0[k1]);
        if (!bandRatioOk(r, p.foil)) return 'starter: option ' + i + '\'s size is ' + r.toFixed(2) + ' times the pattern\'s, outside ' + BAND_RATIO[p.foil].join(' to ');
      }
    }
    if (p.solid === 0 && item.solid.kind !== 'box' && item.solid.kind !== 'tri') return 'starter: a box or a triangular prism';
    return true;
  }
  // v1.2 (version 3): every option's corners are its stated sizes (rebuilt here); how many sizes differ
  // from the pattern's solid, and the least share by which a differing size is off.
  function sizeOff(item, o) {
    var R = BUILD[o.solid.kind](o.solid.dims);
    if (R.verts.length !== o.solid.verts.length || R.verts.some(function (v, k) { return len(sub(v, o.solid.verts[k])) > 1e-9; })) return null;
    if (o.solid.kind !== item.solid.kind) return { other: true };
    var d0 = item.solid.dims, n = 0, least = INF;
    o.solid.dims.forEach(function (d, k) { var off = Mth.abs(d - d0[k]) / d0[k]; if (off > 1e-9) { n++; least = Mth.min(least, off); } });
    return { n: n, least: least };
  }
  // The plain kind: no mark anywhere; foil level 0: two kinds of solid, two of each (one foil of the pattern's
  // kind with one length half again or more off; two of one other kind whose lengths differ in the same way);
  // level 1: every option of the pattern's kind, each foil with one or two lengths off by a quarter or more.
  function validPlain(item) {
    function none(m) { return !m.some(function (x) { return x; }); }
    if (!none(item.marks)) return 'plain: the pattern carries no mark';
    var p = cleanParams(item.params), same = 0, other = [];
    for (var i = 0; i < 4; i++) {
      var o = item.options[i];
      if (!none(o.marks)) return 'plain: option ' + i + ' carries a mark';
      var z = sizeOff(item, o);
      if (!z) return 'plain: option ' + i + '\'s corners are not its stated sizes';
      if (i === item.key) continue;
      if (z.other) { other.push(o.solid); continue; }
      if (z.n < 1 || z.n > 2) return 'plain: option ' + i + ' must differ in one or two sizes';
      if (z.least < (p.foil === 0 ? 0.5 : 0.25) - 1e-9) return 'plain: option ' + i + '\'s sizes are too close to the pattern\'s';
      if (p.foil === 0 && z.n !== 1) return 'plain: option ' + i + ' must differ in one size';
      same++;
    }
    if (p.foil === 1) return other.length ? 'plain: every option is the pattern\'s kind at this level' : true;
    if (same !== 1 || other.length !== 2) return 'plain: one foil of the pattern\'s kind and two of another kind';
    if (!pairedSizes(other[0], other[1])) return 'plain: the two other solids are one kind, one length apart by half again or more';
    return true;
  }
  // The shaded kind: two or three whole faces shaded on the pattern and on every option, no half mark;
  // foil level 1: every option the pattern's own solid; level 0: exactly one in other proportions.
  function validShaded(item) {
    function whole(m) { var n = m.filter(function (x) { return x === 1; }).length; return !m.some(function (x) { return x && typeof x === 'object'; }) ? n : -1; }
    var n0 = whole(item.marks);
    if (n0 < 2 || n0 > 3) return 'shaded: two or three whole faces shaded';
    var p = cleanParams(item.params), other = 0;
    for (var i = 0; i < 4; i++) {
      var o = item.options[i], z = sizeOff(item, o);
      if (whole(o.marks) !== n0) return 'shaded: option ' + i + ' must carry the same whole shades';
      if (!z || z.other) return 'shaded: option ' + i + ' must be the pattern\'s kind of solid at its stated sizes';
      if (z.n) other++;
    }
    if (other !== (p.foil === 0 ? 1 : 0)) return 'shaded: wrong number of solids in other proportions for the level';
    // the net distance, checked on what is stored (own code): faces sharing an edge from the corner lists,
    // pieces joined by a fold line from the stored parents, faces in view from the validator's own cosines
    // (and rays on non-convex prisms)
    function edgeSet(S) { var e = {}, out = {}; S.faces.forEach(function (F, f) { for (var i = 0; i < F.length; i++) { var a = F[i], b = F[(i + 1) % F.length], k = Mth.min(a, b) + '-' + Mth.max(a, b); if (e[k] !== undefined) out[Mth.min(e[k], f) + ',' + Mth.max(e[k], f)] = 1; else e[k] = f; } }); return out; }
    function shaded(m) { var f = []; m.forEach(function (x, g) { if (x === 1) f.push(g); }); return f; }
    function inView(o) { var c = faceCos(o.solid, o.view), sh = isNC(o.solid) ? shownShare(o.solid, o.view) : null; return function (g) { return c[g] >= SEEN && (!sh || sh[g] >= 0.8); }; }
    var pair = shaded(item.marks), E = edgeSet(item.solid), k0 = pair[0] + ',' + pair[1], joined = item.net.some(function (n) { return n.parent >= 0 && Mth.min(n.face, n.parent) + ',' + Mth.max(n.face, n.parent) === k0; });
    if (p.marks === 2) return !E[k0] || joined ? true : 'shaded: two shades that meet on the solid are joined by a fold line in the pattern';
    if (!E[k0] || joined) return 'apart: the two shades meet on the solid and lie apart in the pattern';
    var K = item.options[item.key], seenK = inView(K), kp = shaded(K.marks);
    if (!kp.every(seenK)) return 'apart: the right solid shows both shades';
    var lure = item.options.some(function (o, i) {
      if (i === item.key) return false; // at foil level 0 the lure is the solid in other proportions
      var q = shaded(o.marks).filter(inView(o));
      return q.length < 2 || !edgeSet(o.solid)[q[0] + ',' + q[1]];
    });
    return lure ? true : 'apart: one wrong solid shows shades that do not meet (the net-adjacency lure)';
  }
  function score(item, response) { return { correct: Number.isInteger(response) && response === item.key }; }

  function attempt(rng, p) {
    stats.tries++;
    var item;
    try { item = buildItem(rng, p); } catch (e) { stats.errors++; stats.lastError = String(e && e.stack || e); return null; }
    if (!item) { stats.nulls++; return null; }
    if (!picturesApart(item)) { stats.twins++; return null; }
    item.ex = 'form';
    return item;
  }
  // v1.2 (CLAUDE.md rule 4, found on 19 Nov: about 3 % of items, Try 4 among them, had two options that drew
  // the same picture, the same solid turned the same way with the same marks in sight and others hidden): the
  // four pictures differ. A picture: each face turned towards the viewer as drawn (its corners on screen,
  // from the picture's top left) with its mark.
  function pictureKey(o) {
    var c = facing(o.solid, o.view), P = screenPts(o.solid, o.view), x0 = INF, y0 = INF, out = [];
    c.forEach(function (x, f) { if (x > 1e-9) o.solid.faces[f].forEach(function (i) { x0 = Mth.min(x0, P[i][0]); y0 = Mth.min(y0, P[i][1]); }); });
    c.forEach(function (x, f) {
      if (!(x > 1e-9)) return;
      var q = o.solid.faces[f].map(function (i) { return Mth.round((P[i][0] - x0) * 1000) + ',' + Mth.round((P[i][1] - y0) * 1000); }).sort().join(' ');
      out.push(q + '|' + JSON.stringify(o.marks[f] || 0));
    });
    return out.sort().join(';');
  }
  function picturesApart(item) { var k = {}; item.options.forEach(function (o) { k[pictureKey(o)] = 1; }); return Object.keys(k).length === item.options.length; }
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
    var tries = [p, { solid: 0, marks: p.marks, view: 0, foil: p.foil }, { solid: 0, marks: 0, view: 0, foil: 0 }];
    for (var t = 0; t < tries.length; t++) for (var k = 0; k < 300; k++) {
      var q = tries[t], item = attempt(PX.rng(PX.rng.hash('form-fallback', q.solid, q.marks, q.view, q.foil, k)), q);
      if (item) item.params = q; // validate reads the level (the starter band's checks)
      if (item && validate(item) === true) { item.fallback = true; return item; }
    }
    throw new Error('form: no valid item could be built'); // unreachable while the fallback test passes
  }

  // v1.2 (fresh-player test: a scored item was the Watch's own item, answerable from memory): an item of
  // the tutorial (params.task 'tutorial': the Watch, the Try items and the worked examples in learn.js)
  // never comes back as a rated item. A rated item whose stem is one of theirs (TUTORIAL: hashes of
  // their stems; the node test recomputes them from learn.js) is drawn again from the seed's stream.
  var TUTORIAL = [1543916583, 3094203016, 203963846, 2157057468, 3655275672, 580503644];
  function stemSig(item) { return PX.rng.hash('form-stem', JSON.stringify([item.solid.kind, item.solid.verts, item.net, item.marks])); }
  function generateFresh(rng, params) {
    var item = generate(rng, params), sig;
    if (params && params.task === 'tutorial') return item;
    sig = stemSig(item);
    for (var k = 1; k <= 8 && TUTORIAL.indexOf(sig) >= 0; k++) { item = generate(rng.fork('fresh' + k), params); item.seed = rng.seed; sig = stemSig(item); }
    lastGen = { seed: rng.seed, params: params, sig: sig };
    return item;
  }
  // v1.2 (fresh-player run, 19 Nov): no stem twice in a session (js/ex/patviews/gen.js has the guard and the
  // reasons). Wedges and pyramids allow fewer patterns (fewStems: about 1 in 1,000 pairs of draws at one setting
  // came out the same, in 15 of the level's 42 settings); the other solids gave 60 different stems in 60 draws
  // at every setting (DECISIONS).
  var lastGen = null;
  function sigOf(seed, params) {
    var g = lastGen, s = PX.rng(seed).seed;
    if (g && g.seed === s && (g.params === params || PX.ex.paramsKey(g.params) === PX.ex.paramsKey(params))) return g.sig;
    return stemSig(generateFresh(PX.rng(s), params));
  }
  function fewStems(params) { return !!params && params.solid === 1; }

  /* ------------------------------------------------------------ definition */
  // Logits; P(right) = g + (1 − g − 0.03)·σ(θ − b), g = .25. base −2.2: a box or simple prism, one
  // shaded and one half-shaded face, upright pictures, a proportion foil among the foils: ≈ .90 right at
  // θ = 0. Steps hand-set (DJ, R3 §8.6 dims; to be refitted from pooled exports): solid +0.5 per level
  // (wedges and pyramids, then frusta and five-sided prisms: slanted faces to fold), marks +0.6 per
  // level (a third mark to place, then a second half mark: two turns to check), view +0.5 per level
  // (on a side, upside down), mark foils only +0.8 (no wrong shape to rule out first). Range 4.0.
  // v1.2 (version 2; note D2 §3.5, §3.8): a starter level in front of 'marks', one shaded face and no
  // half mark, Δ = −1.5 against today's level 0 (hand-set, to be refitted from pooled exports): the floor
  // moves from −2.2 to −3.7 and older combinations keep their exact difficulty. Range 5.5.
  // v1.2 (version 3; PLAN milestone 8, note D1 §6.4): 'marks' becomes the test's kinds of item: the starter
  // band (−1.5), plain (−0.9), shaded faces (−0.4), shaded faces apart in the pattern with the
  // net-adjacency lure (−0.15; the net distance, R3 §8.6), then the half marks at their old steps (0, 0.6, 1.2);
  // bevelled boxes join the first solids; L-, T- and U-prisms are a fourth solid level (O51; +1.5, the
  // step's 0.5 on); the band's wrong sizes are twice or half (foil 0), 1.5 to 2 times (foil 1). Hand-set, to be refitted from pooled
  // exports. The range grows to −3.7 … 2.3 (the new top); js/engine/rebase.js re-bases stored levels.
  PX.ex.define({
    id: 'form', version: 3, code: 'EX-19', name: 'Form', short: 'Form',
    abilities: ['Vz'], cell: 'intrinsic-dynamic', role: 'train', answer: 'choice', nOptions: 4, pat: true,
    bet: 'format', format: 'form:pattern-to-solid', // v1.2 wave 2 (W2-bets): PLAN milestone 4, CONTRACT-v1.2 S; note T1 §3.2
    starter: { dim: 'marks', levels: 1 },
    dims: [
      { key: 'solid', label: 'Solid', levels: ['boxes and prisms', 'wedges and pyramids', 'frusta and five-sided', 'L-, T- and U-prisms'], step: 0.5 },
      { key: 'marks', label: 'Marks', levels: MARK_LABELS.slice(), step: 0.6, at: [-1.5, -0.9, -0.4, -0.15, 0, 0.6, 1.2] },
      { key: 'view', label: 'Pictures', levels: ['upright', 'on a side', 'upside down'], step: 0.5 },
      // version 3: 'close' is the same kind of solid in every option (sizes nearer, or only the marks differ),
      // 'clear' another kind, a size well off or the marks (the old labels named marks, which the plain kind lacks)
      { key: 'foil', label: 'Foils', levels: ['clear', 'close'], step: 0.8 },
    ],
    base: -2.2,
    // Test range (CONTRACT-v1.2 W3; DECISIONS 19 Nov): format features only, never the test's difficulty
    testRange: {
      dims: LEVEL_TAGS,
      notes: {
        marks: 'One shaded face with dashed fold lines is a starter level. Half-shaded faces appear only in prep sources; the official sample shows plain patterns.',
        '*': 'From the plain kind on, fold lines are drawn plain and the solids are plain line drawings, as on the official sample.',
      },
    },
    generate: generateFresh, extraParams: ['task'], validate: validate, score: score,
    lib: {
      LEVEL_TAGS: LEVEL_TAGS, rangeOf: rangeOf, plainFolds: plainFolds, MARK_LABELS: MARK_LABELS, BAND_RATIO: BAND_RATIO, looksSolid: looksSolid, pictureKey: pictureKey, picturesApart: picturesApart, LOOK_DET: LOOK_DET, LOOK_MIN: LOOK_MIN, LOOK_MAX: LOOK_MAX, okDims: okDims,
      buildPlain: buildPlain, buildMarked: buildMarked, volume: volume, resized: resized, sizeDist: sizeDist, plainFeats: plainFeats,
      plainShares: plainShares, PLAIN_SOLVERS: PLAIN_SOLVERS, pairedSizes: pairedSizes, touchesOffHinge: touchesOffHinge, sharedRun: sharedRun, enclosesHole: enclosesHole, cutInside: cutInside, sizeOff: sizeOff, validPlain: validPlain, validShaded: validShaded,
      TUTORIAL: TUTORIAL, stemSig: stemSig, generateRaw: generate, sigOf: sigOf, fewStems: fewStems,
      KINDS: KINDS, VIEW: VIEW, VIEWS: VIEWS, YAW: YAW, TILTS: TILTS, TILT_SETS: TILT_SETS, SEEN: SEEN, SOLVERS: SOLVERS, MARKS: MARKS, stats: stats,
      build: build, randomDims: randomDims, stretched: stretched, mirrored: mirrored, adjacency: adjacency, flat: flat, unfold: unfold, overlapping: overlapping,
      viewMatrix: viewMatrix, faceNormal: faceNormal, facing: facing, seenFaces: seenFaces, matchings: matchings, possible: possible, halfSet: halfSet,
      randomMarks: randomMarks, arrangements: arrangements, autos: autos, reflection: reflection, carry: carry, canon: canon, shapeKey: shapeKey,
      randomView: randomView, feats: feats, isNC: isNC, NCK: NCK, visible: visible, drawOrder: drawOrder, orderPolys: orderPolys, screenPts: screenPts, shownShare: shownShare, okClosed: okClosed, markable: markable, VIS_SEEN: VIS_SEEN, VIS_NONE: VIS_NONE, touchRule: touchRule, netTouch: netTouch, shares: shares, optFeats: optFeats,
      foldLines: foldLines, layings: layings, foldsOnto: foldsOnto, faceCos: faceCos,
      fold: fold, validNet: validNet, okSolid: okSolid, buildItem: buildItem, fallback: fallback, cleanParams: cleanParams, mvec: mvec, newell: newell,
      buildBand: buildBand, validBand: validBand, classCount: classCount, shapeClasses: shapeClasses, BAND_KINDS: BAND_KINDS,
    },
  });
})(window.PX);
