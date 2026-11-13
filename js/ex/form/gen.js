/* EX-19 Form (DAT-style format): a flat pattern and four solids; which solid folds from it?
   (pure; ARCHITECTURE.md §5; design: docs/research/v1.1/R3-dat-pat.md §8.6.)

   Solids (convex, so every face facing the viewer is wholly seen): boxes with three different
   sides, prisms on a triangle, trapezoid or "house" pentagon, pyramids on a rectangle or a
   triangle, rectangular frusta (dim 'solid'). Never a cube: oriented marks on cubes belong to the
   Spatial Check's Cube Match probe (R3 §5.3). Built as vertices and faces (CCW from outside), sizes
   on a half-unit lattice.
   Net: the solid edge-unfolded along a random spanning tree of its faces (each child face swung
   flat about the edge it shares with its parent), kept only when no two faces overlap. The pattern
   is the outside surface; fold lines are dashed, cut edges solid.
   Marks (dim 'marks'): one shaded face and one half-shaded face; two shaded and one half; one shaded
   and two halves. A half-shaded face is a four-sided face shaded on one side of a diagonal: oriented,
   so it can tell a solid from its mirror image. A mark is a tone plus a hatch, never colour alone.
   Options: four pictures of solids, each turned its own way (dim 'view': upright, on a side, upside
   down), showing at least three faces clearly. Foils (dim 'foil'): at level 0 one proportion foil
   (one size off by at least a quarter) with two mark foils; at level 1 three mark foils. A mark foil
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
    pyr: function (d) { return pyramid('pyr', d, [[-d[0] / 2, -d[1] / 2], [d[0] / 2, -d[1] / 2], [d[0] / 2, d[1] / 2], [-d[0] / 2, d[1] / 2]], [0, d[2], 0]); },
    tet: function (d) { return pyramid('tet', d, [[-d[0] / 2, -d[1] / 3], [d[0] / 2, -d[1] / 3], [0, 2 * d[1] / 3]], [0, d[2], 0]); },
    frus: function (d) {
      var a = d[0] / 2, b = d[1] / 2, s = d[3], H = d[2], verts = [[-a, 0, -b], [a, 0, -b], [a, 0, b], [-a, 0, b], [-a * s, H, -b * s], [a * s, H, -b * s], [a * s, H, b * s], [-a * s, H, b * s]];
      return finish('frus', d, verts, [[0, 1, 2, 3], [4, 5, 6, 7], [0, 1, 5, 4], [1, 2, 6, 5], [2, 3, 7, 6], [3, 0, 4, 7]]);
    },
  };
  // dim 'solid'. The three-sided pyramid ('tet') is built but not used: it has no four-sided face for
  // the half mark that every level now carries.
  var KINDS = [['box', 'tri', 'trap'], ['wedge', 'pyr'], ['frus', 'house']];
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
    return [half(rng, 2, 3.5), half(rng, 2, 3.5), half(rng, 1.5, 2.5), 0.5];
  }
  function build(kind, dims) { return BUILD[kind](dims); }
  // One size changed by at least a quarter (the proportion foil): a new solid of the same kind.
  function stretched(rng, s) {
    for (var t = 0; t < 12; t++) {
      var d = s.dims.slice(), i = rint(rng, 0, s.kind === 'frus' ? 2 : d.length - 1), f = rpick(rng, [0.6, 0.7, 1.4, 1.5]);
      d[i] = Mth.round(d[i] * f * 2) / 2;
      if (d[i] < 1 || Mth.abs(d[i] - s.dims[i]) < Mth.max(0.5, 0.25 * s.dims[i])) continue;
      if (s.kind === 'trap' && !(d[1] <= d[0] - 1)) continue;
      if (s.kind === 'box' && (d[0] === d[1] || d[1] === d[2] || d[0] === d[2])) continue;
      return build(s.kind, d);
    }
    return null;
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
  // Cosine of each face's outward normal with the direction toward the viewer.
  function facing(s, v) {
    var M = viewMatrix(v);
    var V = VIEWS[v.el || 0];
    return s.faces.map(function (_, f) { return dot(mvec(M, faceNormal(s, f)), V); });
  }
  function seenFaces(s, v) { return facing(s, v).map(function (c, f) { return c >= SEEN ? f : -1; }).filter(function (f) { return f >= 0; }); }

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
  function unfold(rng, s) {
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
    if (net.length !== nF || overlapping(net)) return null;
    // Rounded to a thousandth of a unit (stored); the validator folds what is stored.
    net.forEach(function (n) { n.poly = n.poly.map(function (p) { return [Mth.round(p[0] * 1000) / 1000, Mth.round(p[1] * 1000) / 1000]; }); });
    return net;
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
  function inner(P) { // a point well inside a convex polygon (its centroid)
    var x = 0, y = 0; P.forEach(function (p) { x += p[0]; y += p[1]; }); return [x / P.length, y / P.length];
  }
  function overlapping(net) {
    for (var i = 0; i < net.length; i++) for (var j = i + 1; j < net.length; j++) {
      var A = net[i].poly, B = net[j].poly, k, m;
      for (k = 0; k < A.length; k++) for (m = 0; m < B.length; m++) if (segCross(A[k], A[(k + 1) % A.length], B[m], B[(m + 1) % B.length])) return true;
      var ca = inner(A), cb = inner(B);
      if (pip2(B, ca[0], ca[1]) || pip2(A, cb[0], cb[1])) return true;
      // a vertex of one strictly inside the other (overlaps that cross no edge properly)
      for (k = 0; k < A.length; k++) { var pa = A[k], qa = [pa[0] + (ca[0] - pa[0]) * 0.02, pa[1] + (ca[1] - pa[1]) * 0.02]; if (pip2(B, qa[0], qa[1])) return true; }
      for (m = 0; m < B.length; m++) { var pb = B[m], qb = [pb[0] + (cb[0] - pb[0]) * 0.02, pb[1] + (cb[1] - pb[1]) * 0.02]; if (pip2(A, qb[0], qb[1])) return true; }
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
  var MARKS = [['F', 'H'], ['F', 'F', 'H'], ['F', 'H', 'H']];
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
  function randomMarks(rng, s, level, seen) {
    var setup = rshuffle(rng, MARKS[level]), m = s.faces.map(function () { return 0; }), cls = shapeClasses(s);
    function partnered(f) { return cls.some(function (c, g) { return g !== f && c === cls[f]; }); }
    for (var i = 0; i < setup.length; i++) {
      var cand = s.faces.map(function (F, f) { return !m[f] && (setup[i] === 'F' || F.length === 4) && (i > 0 || !seen || seen.indexOf(f) >= 0) ? f : -1; }).filter(function (f) { return f >= 0; });
      if (!cand.length) return null;
      var pref = cand.filter(partnered), f = rpick(rng, pref.length && rng.chance(0.7) ? pref : cand);
      m[f] = setup[i] === 'F' ? 1 : { h: rint(rng, 0, 3) };
    }
    return m;
  }
  // Every arrangement with each mark moved to a congruent face (a half mark turned any way).
  function arrangements(s, m) {
    var cls = shapeClasses(s), out = [s.faces.map(function () { return 0; })];
    m.forEach(function (x, f) {
      if (!x) return;
      var next = [];
      out.forEach(function (cfg) {
        s.faces.forEach(function (_, g) {
          if (cls[g] !== cls[f] || cfg[g]) return;
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
  function randomView(rng, s, m, level) {
    for (var t = 0; t < 24; t++) {
      var v = { yaw: rint(rng, 0, 11), tilt: rpick(rng, TILT_SETS[level]), el: rint(rng, 0, 1) }, c = facing(s, v);
      if (c.some(function (x) { return x > SEEN - BAND && x < SEEN + BAND; })) continue;
      if (c.filter(function (x) { return x >= SEEN; }).length >= 3 && markedSeen(s, m, v) >= 1) return v;
    }
    return null;
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
  var stats = { tries: 0, nulls: 0, invalid: 0, errors: 0, fallbacks: 0, nets: 0, noView: 0, noMarks: 0, fewOrbits: 0, fewFoils: 0, noSet: 0, lastInvalid: null, lastError: null };
  var FOILS = ['shape', 'marks'];
  function lvl(params, k, n) { var x = params ? params[k] : 0; return Number.isInteger(x) && x >= 0 && x < n ? x : 0; }
  function cleanParams(params) { return { solid: lvl(params, 'solid', 3), marks: lvl(params, 'marks', 3), view: lvl(params, 'view', 3), foil: lvl(params, 'foil', 2) }; }
  function buildItem(rng, p) {
    // a rectangular pyramid has one four-sided face, too few for two half marks
    var kinds = KINDS[p.solid].filter(function (k) { return p.marks < 2 || k !== 'pyr'; });
    var kind = rpick(rng, kinds), S = build(kind, randomDims(rng, kind)), net = null;
    for (var t = 0; t < 12 && !net; t++) net = unfold(rng, S);
    if (!net) { stats.nets++; return null; }
    var all1 = S.faces.map(function () { return 1; }), kv = randomView(rng, S, all1, p.view);
    if (!kv) { stats.noView++; return null; }
    var M = randomMarks(rng, S, p.marks, seenFaces(S, kv));
    if (!M) { stats.noMarks++; return null; }
    // Mark foils: each mark moved to a congruent face, one foil per different marked solid (turns of
    // the solid carry arrangements of one marked solid onto each other); the mirror image is one of them.
    var A = autos(S), maps = A.map(function (a) { return a.v; }), kc = canon(S, A, M), R = reflection(S);
    var mc = R ? canon(S, A, carry(S, R, M)) : null, groups = {}, names = [];
    arrangements(S, M).forEach(function (cfg) {
      var c = canon(S, A, cfg);
      if (c === kc) return;
      if (!groups[c]) { groups[c] = []; names.push(c); }
      groups[c].push(cfg);
    });
    if (names.length < (p.foil === 0 ? 2 : 3)) { stats.fewOrbits++; return null; }
    names = rshuffle(rng, names);
    if (mc !== kc && groups[mc]) names = [mc].concat(names.filter(function (c) { return c !== mc; }));
    var key = { kind: 'key', solid: S, marks: M, view: kv }, pool = [];
    names.slice(0, 8).forEach(function (c) {
      var reps = rshuffle(rng, groups[c]), got = 0;
      for (var r = 0; r < reps.length && r < 6 && got < 2; r++) {
        var v = randomView(rng, S, reps[r], p.view);
        if (v && !possible(S, M, S, reps[r], v, maps)) { pool.push({ kind: c === mc ? 'mirror' : 'marks', solid: S, marks: reps[r], view: v, orbit: c }); got++; }
      }
    });
    if (p.foil === 0) for (var s = 0; s < 3; s++) {
      var st = stretched(rng, S), sv = st && randomView(rng, st, M, p.view);
      if (sv && !possible(S, M, st, M, sv)) pool.push({ kind: 'shape', solid: st, marks: M, view: sv, orbit: 'shape' + s });
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
  // from the viewer. Returns per face the folded points, or a reason.
  function fold(item) {
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
        var phi = Mth.acos(Mth.max(-1, Mth.min(1, dot(faceNormal(S, n.parent), faceNormal(S, n.face)))));
        // the turn in the flat layout (z = 0), signed so the child leaves toward −z
        var A = [P[pa][0], P[pa][1], 0], B = [P[pb][0], P[pb][1], 0], k = unit(sub(B, A)), cen = [0, 0, 0];
        C.forEach(function (q) { cen = add(cen, [q[0] / C.length, q[1] / C.length, 0]); });
        var sgn = turn(cen, A, k, phi)[2] < 0 ? 1 : -1;
        chain[n.face] = chain[n.parent].concat([{ A: A, k: k, a: sgn * phi }]);
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
  function foldsOnto(item, o, lines) {
    var cs = faceCos(o.solid, o.view), net = item.net;
    return layings(net, o.solid, lines).some(function (at) {
      for (var i = 0; i < net.length; i++) {
        var g = at[i].g, x = item.marks[net[i].face], y = o.marks[g];
        if (cs[g] < SEEN) continue;
        if (typeof x === 'object') { if (!y || typeof y !== 'object' || y.h !== (x.h + at[i].s) % 4) return false; } else if (y !== x) return false;
      }
      return true;
    });
  }
  // The fold lines found in the layout are exactly the hinges the pattern draws dashed.
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
      if (!okMarks(item.solid, item.marks) || !item.marks.some(function (x) { return x; })) return 'bad marks';
      var vn = validNet(item);
      if (vn !== true) return vn;
      if (!Array.isArray(item.options) || item.options.length !== 4) return 'needs 4 options';
      if (!(Number.isInteger(item.key) && item.key >= 0 && item.key < 4)) return 'key out of range';
      var lines = foldLines(item.net);
      if (!linesMatchHinges(item, lines)) return 'the fold lines in the layout are not the drawn hinges';
      for (var i = 0; i < 4; i++) {
        var o = item.options[i];
        if (!o || !okSolid(o.solid) || !okMarks(o.solid, o.marks) || !o.view || !YAW[o.view.yaw] || !TILTS[o.view.tilt] || !VIEWS[o.view.el]) return 'option ' + i + ' is malformed';
        var c = facing(o.solid, o.view);
        if (c.filter(function (x) { return x >= SEEN; }).length < 3) return 'option ' + i + ' shows fewer than three faces clearly';
        if (c.some(function (x) { return x > SEEN - BAND && x < SEEN + BAND; })) return 'option ' + i + ' has a face at the edge of being seen';
        if (!markedSeen(o.solid, o.marks, o.view)) return 'option ' + i + ' shows no mark';
        var ok = possible(item.solid, item.marks, o.solid, o.marks, o.view);
        if (ok !== foldsOnto(item, o, lines)) return 'option ' + i + ': the two checks disagree';
        if (i === item.key && !ok) return 'the key is not the folded net';
        if (i !== item.key && ok) return 'option ' + i + ' could also be the folded net';
      }
      return true;
    } catch (e) { return 'validate threw: ' + (e && e.message); }
  }
  function score(item, response) { return { correct: Number.isInteger(response) && response === item.key }; }

  function attempt(rng, p) {
    stats.tries++;
    var item;
    try { item = buildItem(rng, p); } catch (e) { stats.errors++; stats.lastError = String(e && e.stack || e); return null; }
    if (!item) { stats.nulls++; return null; }
    item.ex = 'form';
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
    var tries = [p, { solid: 0, marks: p.marks, view: 0, foil: p.foil }, { solid: 0, marks: 0, view: 0, foil: 0 }];
    for (var t = 0; t < tries.length; t++) for (var k = 0; k < 300; k++) {
      var q = tries[t], item = attempt(PX.rng(PX.rng.hash('form-fallback', q.solid, q.marks, q.view, q.foil, k)), q);
      if (item && validate(item) === true) { item.fallback = true; return item; }
    }
    throw new Error('form: no valid item could be built'); // unreachable while the fallback test passes
  }

  /* ------------------------------------------------------------ definition */
  // Logits; P(right) = g + (1 − g − 0.03)·σ(θ − b), g = .25. base −2.2: a box or simple prism, one
  // shaded and one half-shaded face, upright pictures, a proportion foil among the foils: ≈ .90 right at
  // θ = 0. Steps hand-set (DJ, R3 §8.6 dims; to be refitted from pooled exports): solid +0.5 per level
  // (wedges and pyramids, then frusta and five-sided prisms: slanted faces to fold), marks +0.6 per
  // level (a third mark to place, then a second half mark: two turns to check), view +0.5 per level
  // (on a side, upside down), mark foils only +0.8 (no wrong shape to rule out first). Range 4.0.
  PX.ex.define({
    id: 'form', version: 1, code: 'EX-19', name: 'Form', short: 'Form',
    abilities: ['Vz'], cell: 'intrinsic-dynamic', role: 'train', answer: 'choice', nOptions: 4, pat: true,
    dims: [
      { key: 'solid', label: 'Solid', levels: ['boxes and prisms', 'wedges and pyramids', 'frusta and five-sided'], step: 0.5 },
      { key: 'marks', label: 'Marks', levels: ['shaded and half', 'two shaded and half', 'shaded and two halves'], step: 0.6 },
      { key: 'view', label: 'Pictures', levels: ['upright', 'on a side', 'upside down'], step: 0.5 },
      { key: 'foil', label: 'Foils', levels: ['shape and marks', 'marks only'], step: 0.8 },
    ],
    base: -2.2,
    generate: generate, validate: validate, score: score,
    lib: {
      KINDS: KINDS, VIEW: VIEW, VIEWS: VIEWS, YAW: YAW, TILTS: TILTS, TILT_SETS: TILT_SETS, SEEN: SEEN, SOLVERS: SOLVERS, MARKS: MARKS, stats: stats,
      build: build, randomDims: randomDims, stretched: stretched, mirrored: mirrored, adjacency: adjacency, flat: flat, unfold: unfold, overlapping: overlapping,
      viewMatrix: viewMatrix, faceNormal: faceNormal, facing: facing, seenFaces: seenFaces, matchings: matchings, possible: possible, halfSet: halfSet,
      randomMarks: randomMarks, arrangements: arrangements, autos: autos, reflection: reflection, carry: carry, canon: canon, shapeKey: shapeKey,
      randomView: randomView, feats: feats, touchRule: touchRule, netTouch: netTouch, shares: shares, optFeats: optFeats,
      foldLines: foldLines, layings: layings, foldsOnto: foldsOnto, faceCos: faceCos,
      fold: fold, validNet: validNet, okSolid: okSolid, buildItem: buildItem, fallback: fallback, cleanParams: cleanParams, mvec: mvec, newell: newell,
    },
  });
})(window.PX);
