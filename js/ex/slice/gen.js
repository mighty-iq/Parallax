/* EX-06 Slice: cross-sections (pure; ARCHITECTURE.md §5, PLAN.md §3, research/B-tasks.md §4 and §14c).

   A solid and a cutting plane: which shape is the cross-section, seen head-on? Structures follow the
   Santa Barbara Solids Test design (Cohen & Hegarty 2007): simple (one solid), joined (two solids
   joined into one), embedded (a solid inside another; the section shows nested outlines). Cuts:
   orthogonal (parallel to a face of the main solid or across its axis), oblique (tilted about one of
   its axes), double oblique (tilted about two axes).

   Geometry. Every solid is a closed triangle mesh with shared vertices (curved surfaces: 64 segments
   around, 32 rings on spheres). The section is exact for the mesh: each triangle edge crossing the
   plane gives one point keyed by the edge (so neighbouring triangles share it), each crossed triangle
   links two points, and the links are walked into closed loops. Loops are written in the plane's own
   2D frame (u, v): the head-on view reached from the camera by the smallest turn. They are normalised
   for display: centred on their bounding box and scaled uniformly so the larger half-extent is 1 (the
   aspect ratio never changes). Embedded solids give one loop per solid, nested. Coordinates: world
   y up; display x right, y up.

   Options: the key; the egocentric foil ('ego': the true section as it appears on the screen,
   foreshortened instead of turned to face the viewer: the most common SBST error, Cohen & Hegarty
   2012); and two foils from a pool of neighbouring problems, never small edits of the key: the same
   solid cut through the same point at another angle ('cut'), a related solid cut by the same plane
   ('solid'), the egocentric view of either ('cut-ego', 'solid-ego'), and the outline the solid
   presents to the viewer ('proj', the MCT's "answers that look like projections", Tsutsumi 2013).
   Options are visibly different: their descriptors differ (corners after simplification, loops,
   curved or straight, aspect ratio of the minimum-area bounding box by at least 1.3×) and their
   rasters overlap by at most 85 % at every nesting level. The pair of foils is chosen per item so
   that seven cheap shortcut solvers (SHORTCUTS: most corners, most like the silhouette, most like
   the others by descriptors and by rasters, the closest twin, the roundest, the fullest) land on the
   key about one time in four over the pool (BAL). The key is never the solid's own outline.

   validate (independent of the mesh): samples the plane on a 54 × 54 grid with analytic inside-tests
   of the primitives (union for joined solids, nesting depth for embedded ones); the key must agree
   with the samples (≥ 0.92 at every level) and no other option may (< 0.9); the key's areas and
   region counts must match the samples, inner outlines must not touch outer ones; the egocentric
   foil is re-derived from the key; options are pairwise distinct by descriptors and rasters.

   Item (JSON):
     { ex: 'slice', seed, params, key,                 key = index of the right option
       solid: { structure, kind, curved, yaw, lie, parts: [{ type, …size, pos, rot }] },
              parts are primitives in the solid's frame (rot row-major 3×3); world = R(yaw, lie)·local.
              Embedded: parts[0] outer, parts[1] inner (draw the outer translucent).
              Sizes: box {w,h,d}; prism {b,t,L,ax} (triangle base b on y = −t/2, apex (ax, t/2), along z);
              pyramid {ax,az,h} (apex +y); cylinder {r,h}; cone {r,h} (apex +y); sphere {r}.
       plane: { p, n, c, half },   a point, the unit normal (toward the viewer's side), and the centre
                                   and half-size of the square drawn for the plane (axes frame.u, frame.v)
       frame: { u, v },            in-plane axes of the head-on view (display x = u, y = v)
       view:  { dir, right, up },  camera: unit direction from the solid to the camera, screen axes
       norm:  { cx, cy, s },       key option: display = ((p→x)·u − cx, (p→x)·v − cy) · s
       sweep: { from, to },        show-me: move the plane along n from `from` (outside) to `to` (= p)
       options: [{ kind, loops: [[[x, y], …], …], n? (cut, cut-ego), solid? (solid, solid-ego) }] }
              kind: key | ego | cut | solid | cut-ego | solid-ego | proj; loops normalised as above.
     PX.ex.get('slice').lib exposes the model (mesh, section, describe, …) for the view and tests.

   Difficulty: see DIFF below (custom, with interaction terms). */
(function (PX) {
  'use strict';
  // Short local names for a few globals.
  var Mth = Math, INF = 1 / 0, isArr = Array.isArray, isFin = isFinite;

  /* ------------------------------------------------------------ deterministic maths */
  // Only + − × ÷, Mth.sqrt (correctly rounded) and Mth.round/floor/abs are used, so the same seed
  // gives the same item in every engine (Math.sin, cos, atan2 and log may differ in the last bit).
  var PI = Mth.PI, TAU = 2 * Mth.PI, HALF_PI = Mth.PI / 2, SQRT3 = Mth.sqrt(3), DEG = Mth.PI / 180;

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
  // [sin x, cos x]
  function sincos(x) {
    var r = x - Mth.round(x / TAU) * TAU;
    var q = Mth.round(r / HALF_PI);
    var y = r - q * HALF_PI, s = sinPoly(y), c = cosPoly(y);
    q = ((q % 4) + 4) % 4;
    return q === 0 ? [s, c] : q === 1 ? [c, -s] : q === 2 ? [-s, -c] : [-c, s];
  }
  function atanSmall(t) { // |t| ≤ tan 15°
    var t2 = t * t, s = 0;
    for (var k = 17; k >= 1; k -= 2) s = 1 / k - t2 * s;
    return t * s;
  }
  function atan(t) {
    var neg = t < 0; if (neg) t = -t;
    var inv = t > 1; if (inv) t = 1 / t;
    var a = t > 0.2679491924311227 ? PI / 6 + atanSmall((t * SQRT3 - 1) / (t + SQRT3)) : atanSmall(t);
    if (inv) a = HALF_PI - a;
    return neg ? -a : a;
  }
  function atan2(y, x) {
    if (x > 0) return atan(y / x);
    if (x < 0) return y >= 0 ? atan(y / x) + PI : atan(y / x) - PI;
    return y > 0 ? HALF_PI : y < 0 ? -HALF_PI : 0;
  }
  function rnd(x, dp) { var f = dp === 3 ? 1000 : dp === 4 ? 10000 : dp === 6 ? 1e6 : 1; return Mth.round(x * f) / f; }

  /* ------------------------------------------------------------ vectors and 3×3 matrices */
  function add(a, b) { return [a[0] + b[0], a[1] + b[1], a[2] + b[2]]; }
  function sub(a, b) { return [a[0] - b[0], a[1] - b[1], a[2] - b[2]]; }
  function mul(a, s) { return [a[0] * s, a[1] * s, a[2] * s]; }
  function dot(a, b) { return a[0] * b[0] + a[1] * b[1] + a[2] * b[2]; }
  function cross(a, b) { return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]; }
  function len(a) { return Mth.sqrt(dot(a, a)); }
  function unit(a) { var l = len(a); return [a[0] / l, a[1] / l, a[2] / l]; }
  function mmul(A, B) {
    var C = new Array(9);
    for (var r = 0; r < 3; r++) for (var c = 0; c < 3; c++) C[r * 3 + c] = A[r * 3] * B[c] + A[r * 3 + 1] * B[3 + c] + A[r * 3 + 2] * B[6 + c];
    return C;
  }
  function mvec(M, v) { return [M[0] * v[0] + M[1] * v[1] + M[2] * v[2], M[3] * v[0] + M[4] * v[1] + M[5] * v[2], M[6] * v[0] + M[7] * v[1] + M[8] * v[2]]; }
  function mtvec(M, v) { return [M[0] * v[0] + M[3] * v[1] + M[6] * v[2], M[1] * v[0] + M[4] * v[1] + M[7] * v[2], M[2] * v[0] + M[5] * v[1] + M[8] * v[2]]; }
  var I3 = [1, 0, 0, 0, 1, 0, 0, 0, 1];
  function yawM(deg) { var sc = sincos(deg * DEG); return [sc[1], 0, sc[0], 0, 1, 0, -sc[0], 0, sc[1]]; }
  // lie: the solid's local y axis along world +y ('y'), −y ('-y'), +x ('x') or +z ('z').
  var LIE = { y: I3, '-y': [1, 0, 0, 0, -1, 0, 0, 0, -1], x: [0, 1, 0, -1, 0, 0, 0, 0, 1], z: [1, 0, 0, 0, 0, -1, 0, 1, 0] };
  function solidRot(solid) { return mmul(yawM(solid.yaw || 0), LIE[solid.lie || 'y']); }
  // Rotate v about the unit axis k by angle a (radians), Rodrigues.
  function rotAbout(v, k, a) {
    var sc = sincos(a), kv = cross(k, v), kd = dot(k, v) * (1 - sc[1]);
    return [v[0] * sc[1] + kv[0] * sc[0] + k[0] * kd, v[1] * sc[1] + kv[1] * sc[0] + k[1] * kd, v[2] * sc[1] + kv[2] * sc[0] + k[2] * kd];
  }

  /* ------------------------------------------------------------ camera */
  // The stem is drawn from azimuth 35° (from +z toward +x) and elevation 28°, orthographic.
  var VIEW = (function () {
    var az = sincos(35 * DEG), el = sincos(28 * DEG);
    var dir = [az[0] * el[1], el[0], az[1] * el[1]];
    var right = unit([dir[2], 0, -dir[0]]);
    return { dir: dir, right: right, up: cross(dir, right) };
  })();

  /* ------------------------------------------------------------ meshes */
  var SEG = 64, RINGS = 32;
  var TRIG = null;
  function ringTrig() {
    if (!TRIG) { TRIG = []; for (var j = 0; j < SEG; j++) TRIG.push(sincos(TAU * j / SEG)); }
    return TRIG;
  }
  function Mesh() { this.V = []; this.T = []; }
  Mesh.prototype.v = function (x, y, z) { this.V.push(x, y, z); return this.V.length / 3 - 1; };
  Mesh.prototype.t = function (a, b, c) { this.T.push(a, b, c); };

  // A ring of SEG vertices around the vertical axis through (cx, cz); angle j·2π/SEG from +x toward +z.
  function ringV(m, cx, cz, r, y) {
    var tr = ringTrig(), idx = [];
    for (var j = 0; j < SEG; j++) idx.push(m.v(cx + r * tr[j][1], y, cz + r * tr[j][0]));
    return idx;
  }
  // Solid of revolution about the vertical axis through (cx, cz). profile: [[r, y], …] from bottom to
  // top; r = 0 is a pole. start: optional existing ring for profile[0] (shared with a face below).
  // Triangles wind counter-clockwise seen from outside.
  function revolve(m, profile, cx, cz, start) {
    var rows = [];
    for (var k = 0; k < profile.length; k++) {
      var r = profile[k][0], y = profile[k][1];
      if (k === 0 && start) rows.push(start);
      else rows.push(r <= 0 ? m.v(cx, y, cz) : ringV(m, cx, cz, r, y));
    }
    for (k = 0; k + 1 < rows.length; k++) {
      var A = rows[k], B = rows[k + 1];
      for (var j = 0; j < SEG; j++) {
        var j1 = (j + 1) % SEG;
        if (typeof A === 'number') m.t(A, B[j], B[j1]);
        else if (typeof B === 'number') m.t(B, A[j1], A[j]);
        else { m.t(A[j], B[j], B[j1]); m.t(A[j], B[j1], A[j1]); }
      }
    }
    return rows;
  }
  // Four corners of a horizontal rectangle: c0 (−x, −z), c1 (+x, −z), c2 (+x, +z), c3 (−x, +z).
  function rectV(m, cx, cz, ax, az, y) {
    return [m.v(cx - ax / 2, y, cz - az / 2), m.v(cx + ax / 2, y, cz - az / 2), m.v(cx + ax / 2, y, cz + az / 2), m.v(cx - ax / 2, y, cz + az / 2)];
  }
  function capDown(m, c) { m.t(c[0], c[1], c[2]); m.t(c[0], c[2], c[3]); }
  function capUp(m, c) { m.t(c[0], c[3], c[2]); m.t(c[0], c[2], c[1]); }
  function sidesBetween(m, lo, hi) {
    for (var i = 0; i < 4; i++) { var i1 = (i + 1) % 4; m.t(lo[i1], lo[i], hi[i]); m.t(lo[i1], hi[i], hi[i1]); }
  }
  function apexUp(m, c, apex) { for (var i = 0; i < 4; i++) m.t(c[(i + 1) % 4], c[i], apex); }
  // Horizontal face facing +y between an outer and an inner convex loop, both counter-clockwise seen
  // from above (2D coordinates (x, −z)); triangulated by merging the loops by angle around the inner
  // loop's centroid (valid for convex loops).
  function annulus(m, outer, inner) {
    var V = m.V;
    function xy(i) { return [V[3 * i], -V[3 * i + 2]]; }
    var cx = 0, cy = 0;
    inner.forEach(function (i) { var p = xy(i); cx += p[0]; cy += p[1]; });
    cx /= inner.length; cy /= inner.length;
    function ang(i) { var p = xy(i); return atan2(p[1] - cy, p[0] - cx); }
    var a0 = ang(outer[0]);
    function rel(i) { var a = ang(i) - a0; while (a < 0) a += TAU; while (a >= TAU) a -= TAU; return a; }
    var oa = outer.map(rel), ia = inner.map(rel), s = 0;
    for (var k = 1; k < inner.length; k++) if (ia[k] < ia[s]) s = k;
    var I = inner.slice(s).concat(inner.slice(0, s)), IA = ia.slice(s).concat(ia.slice(0, s));
    for (k = 1; k < IA.length; k++) while (IA[k] < IA[k - 1]) IA[k] += TAU;
    for (k = 1; k < oa.length; k++) while (oa[k] < oa[k - 1]) oa[k] += TAU;
    var no = outer.length, ni = I.length, i = 0, j = 0;
    while (i < no || j < ni) {
      var nextO = i < no ? (i + 1 < no ? oa[i + 1] : TAU) : INF;
      var nextI = j < ni ? (j + 1 < ni ? IA[j + 1] : IA[0] + TAU) : INF;
      if (nextO <= nextI) { m.t(outer[i % no], outer[(i + 1) % no], I[j % ni]); i++; }
      else { m.t(outer[i % no], I[(j + 1) % ni], I[j % ni]); j++; }
    }
  }
  // Ear clipping of a simple counter-clockwise polygon → index triples.
  function earClip(poly) {
    var idx = poly.map(function (_, i) { return i; }), out = [], guard = 0;
    function area2(a, b, c) { return (b[0] - a[0]) * (c[1] - a[1]) - (c[0] - a[0]) * (b[1] - a[1]); }
    while (idx.length > 3 && guard++ < 1000) {
      for (var k = 0; k < idx.length; k++) {
        var ia = idx[(k + idx.length - 1) % idx.length], ib = idx[k], ic = idx[(k + 1) % idx.length];
        var a = poly[ia], b = poly[ib], c = poly[ic];
        if (area2(a, b, c) <= 1e-12) continue;
        var ear = true;
        for (var q = 0; q < idx.length && ear; q++) {
          var p = poly[idx[q]];
          if (idx[q] === ia || idx[q] === ib || idx[q] === ic) continue;
          if (area2(a, b, p) >= 0 && area2(b, c, p) >= 0 && area2(c, a, p) >= 0) ear = false;
        }
        if (ear) { out.push([ia, ib, ic]); idx.splice(k, 1); break; }
      }
    }
    if (idx.length === 3) out.push(idx.slice());
    return out;
  }
  // Prism: polygon in the x-y plane (counter-clockwise seen from +z), extruded along z over [−L/2, L/2].
  function extrude(m, poly, L) {
    var back = [], front = [], n = poly.length, i;
    for (i = 0; i < n; i++) { back.push(m.v(poly[i][0], poly[i][1], -L / 2)); front.push(m.v(poly[i][0], poly[i][1], L / 2)); }
    earClip(poly).forEach(function (t) { m.t(front[t[0]], front[t[1]], front[t[2]]); m.t(back[t[0]], back[t[2]], back[t[1]]); });
    for (i = 0; i < n; i++) { var j = (i + 1) % n; m.t(back[i], back[j], front[j]); m.t(back[i], front[j], front[i]); }
  }
  function triPoly(p) { return [[-p.b / 2, -p.t / 2], [p.b / 2, -p.t / 2], [p.ax, p.t / 2]]; }
  function sphereProfile(r, y0) {
    var pr = [];
    for (var k = 0; k <= RINGS; k++) {
      var sc = sincos(PI * k / RINGS);
      pr.push([k === 0 || k === RINGS ? 0 : r * sc[0], y0 - r * sc[1]]);
    }
    return pr;
  }

  // Mesh of one primitive in its own frame (centred on its bounding box, apex/axis along +y).
  function primitiveMesh(p) {
    var m = new Mesh();
    switch (p.type) {
      case 'box': { var lo = rectV(m, 0, 0, p.w, p.d, -p.h / 2), hi = rectV(m, 0, 0, p.w, p.d, p.h / 2); capDown(m, lo); capUp(m, hi); sidesBetween(m, lo, hi); break; }
      case 'prism': extrude(m, triPoly(p), p.L); break;
      case 'pyramid': { var c = rectV(m, 0, 0, p.ax, p.az, -p.h / 2); capDown(m, c); apexUp(m, c, m.v(0, p.h / 2, 0)); break; }
      case 'cylinder': revolve(m, [[0, -p.h / 2], [p.r, -p.h / 2], [p.r, p.h / 2], [0, p.h / 2]], 0, 0); break;
      case 'cone': revolve(m, [[0, -p.h / 2], [p.r, -p.h / 2], [0, p.h / 2]], 0, 0); break;
      case 'sphere': revolve(m, sphereProfile(p.r, 0), 0, 0); break;
      default: throw new Error('slice: unknown primitive ' + p.type);
    }
    return m;
  }

  // Mesh of a joined solid in the solid's frame: one closed surface (the union), built per kind.
  function joinedMesh(solid) {
    var P = solid.parts, a = P[0], b = P[1], m = new Mesh();
    var y0 = a.pos[1] - a.h / 2, y1 = a.pos[1] + a.h / 2, lo, hi, top;
    switch (solid.kind) {
      case 'house':
        lo = rectV(m, 0, 0, a.w, a.d, y0); hi = rectV(m, 0, 0, a.w, a.d, y1);
        capDown(m, lo); sidesBetween(m, lo, hi); apexUp(m, hi, m.v(0, b.pos[1] + b.h / 2, 0));
        break;
      case 'barn':
        extrude(m, [[-a.w / 2, y0], [a.w / 2, y0], [a.w / 2, y1], [b.ax, b.pos[1] + b.t / 2], [-a.w / 2, y1]], a.d);
        break;
      case 'L': {
        var xr = b.pos[0] < a.pos[0]; // upright box at the left end?
        var W = a.w / 2, x1 = xr ? -W + b.w : W - b.w, y2 = b.pos[1] + b.h / 2;
        extrude(m, xr ? [[-W, y0], [W, y0], [W, y1], [x1, y1], [x1, y2], [-W, y2]]
          : [[-W, y0], [W, y0], [W, y2], [x1, y2], [x1, y1], [-W, y1]], a.d);
        break;
      }
      case 'step': case 'boxcyl': case 'boxcone': {
        lo = rectV(m, 0, 0, a.w, a.d, y0); hi = rectV(m, 0, 0, a.w, a.d, y1);
        capDown(m, lo); sidesBetween(m, lo, hi);
        var ox = b.pos[0], oz = b.pos[2], yt = b.pos[1] + b.h / 2, inner;
        if (solid.kind === 'step') {
          var blo = rectV(m, ox, oz, b.w, b.d, y1), bhi = rectV(m, ox, oz, b.w, b.d, yt);
          sidesBetween(m, blo, bhi); capUp(m, bhi);
          inner = [blo[0], blo[3], blo[2], blo[1]];
        } else {
          var ring = ringV(m, ox, oz, b.r, y1);
          revolve(m, solid.kind === 'boxcyl' ? [[b.r, y1], [b.r, yt], [0, yt]] : [[b.r, y1], [0, yt]], ox, oz, ring);
          inner = ring.slice().reverse();
        }
        annulus(m, [hi[0], hi[3], hi[2], hi[1]], inner);
        break;
      }
      case 'cylcone': case 'cyldome': case 'cylcyl': {
        var R = a.r, pr = [[0, y0], [R, y0], [R, y1]];
        if (solid.kind === 'cylcone') { if (b.r < R - 1e-9) pr.push([b.r, y1]); pr.push([0, y1 + b.h]); }
        else if (solid.kind === 'cylcyl') pr.push([b.r, y1], [b.r, y1 + b.h], [0, y1 + b.h]);
        else for (var k = 1; k <= RINGS / 2; k++) { var sc = sincos(HALF_PI * k / (RINGS / 2)); pr.push([k === RINGS / 2 ? 0 : R * sc[1], y1 + R * sc[0]]); }
        revolve(m, pr, 0, 0);
        break;
      }
      case 'bicone': // a: lower cone (apex down), b: upper cone
        revolve(m, [[0, y0], [a.r, y1], [0, y1 + b.h]], 0, 0);
        break;
      default: throw new Error('slice: unknown joined kind ' + solid.kind);
    }
    return m;
  }

  // World-space meshes of a solid: [{ V, T, mat }] (mat 1: the solid or the outer one; 2: the inner
  // one). memo (optional) reuses meshes of identical parts in the same pose within one item.
  function solidMeshes(solid, memo) {
    var R = solidRot(solid), out = [], pose = '|' + (solid.yaw || 0) + '|' + (solid.lie || 'y');
    function place(build, key, rot, pos, mat) {
      var k = key + pose;
      if (memo && memo[k]) { out.push({ V: memo[k].V, T: memo[k].T, mat: mat }); return; }
      var m = build(), V = m.V, W = new Array(V.length), A = rot ? mmul(R, rot) : R, t = rot ? mvec(R, pos) : [0, 0, 0];
      for (var i = 0; i < V.length; i += 3) {
        var x = V[i], y = V[i + 1], z = V[i + 2];
        W[i] = A[0] * x + A[1] * y + A[2] * z + t[0];
        W[i + 1] = A[3] * x + A[4] * y + A[5] * z + t[1];
        W[i + 2] = A[6] * x + A[7] * y + A[8] * z + t[2];
      }
      var res = { V: W, T: m.T, mat: mat };
      if (memo) memo[k] = res;
      out.push(res);
    }
    if (solid.structure === 'joined') place(function () { return joinedMesh(solid); }, 'J' + solid.kind + JSON.stringify(solid.parts), null, null, 1);
    else solid.parts.forEach(function (p, i) { place(function () { return primitiveMesh(p); }, JSON.stringify(p), p.rot, p.pos, i + 1); });
    return out;
  }

  /* ------------------------------------------------------------ plane sections of meshes */
  // Closed loops of 3D points where the plane (p, n) cuts one closed mesh, each counter-clockwise
  // seen from the side n points to; null when the walk does not close (degenerate geometry).
  function meshSection(mesh, p, n) {
    var V = mesh.V, T = mesh.T, nv = V.length / 3, d = new Float64Array(nv), i;
    var nx = n[0], ny = n[1], nz = n[2], off = p[0] * nx + p[1] * ny + p[2] * nz;
    for (i = 0; i < nv; i++) {
      var s = V[3 * i] * nx + V[3 * i + 1] * ny + V[3 * i + 2] * nz - off;
      d[i] = s === 0 ? 1e-12 : s; // a vertex exactly on the plane counts as above it
    }
    // One point per crossed edge (shared by the two triangles on it); nxt links the points.
    var ids = new Map(), P = [], nxt = [];
    function pt(a, b) {
      var k = a < b ? a * nv + b : b * nv + a, id = ids.get(k);
      if (id === undefined) {
        var t = d[a] / (d[a] - d[b]);
        id = nxt.length;
        P.push(V[3 * a] + (V[3 * b] - V[3 * a]) * t, V[3 * a + 1] + (V[3 * b + 1] - V[3 * a + 1]) * t, V[3 * a + 2] + (V[3 * b + 2] - V[3 * a + 2]) * t);
        nxt.push(-1);
        ids.set(k, id);
      }
      return id;
    }
    for (i = 0; i < T.length; i += 3) {
      var a = T[i], b = T[i + 1], c = T[i + 2], pa = d[a] > 0, pb = d[b] > 0, pc = d[c] > 0;
      if (pa === pb && pb === pc) continue;
      var k0, k1;
      if (pa === pb) { k0 = pt(b, c); k1 = pt(c, a); } else if (pb === pc) { k0 = pt(a, b); k1 = pt(c, a); } else { k0 = pt(a, b); k1 = pt(b, c); }
      // Boundary direction n × N keeps the inside of the solid on the left, seen from +n.
      var ax = V[3 * a], ay = V[3 * a + 1], az = V[3 * a + 2];
      var e1x = V[3 * b] - ax, e1y = V[3 * b + 1] - ay, e1z = V[3 * b + 2] - az, e2x = V[3 * c] - ax, e2y = V[3 * c + 1] - ay, e2z = V[3 * c + 2] - az;
      var Nx = e1y * e2z - e1z * e2y, Ny = e1z * e2x - e1x * e2z, Nz = e1x * e2y - e1y * e2x;
      var q0 = 3 * k0, q1 = 3 * k1;
      if ((P[q1] - P[q0]) * (ny * Nz - nz * Ny) + (P[q1 + 1] - P[q0 + 1]) * (nz * Nx - nx * Nz) + (P[q1 + 2] - P[q0 + 2]) * (nx * Ny - ny * Nx) < 0) { var tmp = k0; k0 = k1; k1 = tmp; }
      if (nxt[k0] !== -1) return null;
      nxt[k0] = k1;
    }
    var loops = [], seen = new Uint8Array(nxt.length);
    for (var s0 = 0; s0 < nxt.length; s0++) {
      if (seen[s0]) continue;
      var loop = [], k = s0, steps = 0;
      do {
        if (seen[k] || nxt[k] === -1 || steps++ > nxt.length) return null;
        seen[k] = 1;
        loop.push([P[3 * k], P[3 * k + 1], P[3 * k + 2]]);
        k = nxt[k];
      } while (k !== s0);
      loops.push(loop);
    }
    return loops;
  }

  // The head-on view of a plane: the camera orbits (azimuth, then elevation) until it faces the
  // plane from the viewer's side. Returns { n (toward the camera), u (right), v (up), az, el }.
  function planeFrame(n) {
    if (dot(n, VIEW.dir) < 0) n = mul(n, -1);
    var h = Mth.sqrt(n[0] * n[0] + n[2] * n[2]), u;
    if (h < 1e-6) u = VIEW.right.slice();
    else u = [n[2] / h, 0, -n[0] / h];
    var v = cross(n, u);
    var az = h < 1e-6 ? 35 : atan2(n[0], n[2]) / DEG, el = atan2(n[1], h) / DEG;
    return { n: n, u: u, v: v, az: az, el: el };
  }

  // Section of a solid (its world meshes) in the plane's 2D frame: [{ mat, loops: [[[x, y], …]] }].
  function sectionOf(meshes, p, f) {
    var out = [];
    for (var m = 0; m < meshes.length; m++) {
      var L = meshSection(meshes[m], p, f.n);
      if (!L) return null;
      out.push({ mat: meshes[m].mat, loops: L.map(function (loop) {
        return cleanLoop(loop.map(function (q) { var r = sub(q, p); return [dot(r, f.u), dot(r, f.v)]; }));
      }) });
    }
    return out;
  }
  // Every loop of a section, in drawing order (outer solid first).
  function flatLoops(sec) {
    var out = [];
    sec.forEach(function (s) { s.loops.forEach(function (l) { out.push(l); }); });
    return out;
  }

  /* ------------------------------------------------------------ 2D helpers */
  function area2(l) {
    var s = 0;
    for (var i = 0, n = l.length; i < n; i++) { var a = l[i], b = l[(i + 1) % n]; s += a[0] * b[1] - b[0] * a[1]; }
    return s / 2;
  }
  function perimeter(l) {
    var s = 0;
    for (var i = 0, n = l.length; i < n; i++) { var a = l[i], b = l[(i + 1) % n]; s += Mth.sqrt((b[0] - a[0]) * (b[0] - a[0]) + (b[1] - a[1]) * (b[1] - a[1])); }
    return s;
  }
  function turnAt(a, b, c) {
    var e1x = b[0] - a[0], e1y = b[1] - a[1], e2x = c[0] - b[0], e2y = c[1] - b[1];
    return atan2(e1x * e2y - e1y * e2x, e1x * e2x + e1y * e2y);
  }
  var SIN_STRAIGHT = 0.005235963831419537; // sin 0.3°
  function straight(a, b, c) {
    var e1x = b[0] - a[0], e1y = b[1] - a[1], e2x = c[0] - b[0], e2y = c[1] - b[1];
    var cr = e1x * e2y - e1y * e2x, dt = e1x * e2x + e1y * e2y;
    return dt > 0 && Mth.abs(cr) < SIN_STRAIGHT * Mth.sqrt((e1x * e1x + e1y * e1y) * (e2x * e2x + e2y * e2y));
  }
  // Drops repeated points and points where the outline runs straight on (turn under 0.3°).
  function cleanLoop(l) {
    var out = [], i, n;
    for (i = 0; i < l.length; i++) {
      var q = l[i], last = out[out.length - 1];
      if (!last || Mth.abs(q[0] - last[0]) + Mth.abs(q[1] - last[1]) > 1e-7) out.push(q);
    }
    while (out.length > 1 && Mth.abs(out[0][0] - out[out.length - 1][0]) + Mth.abs(out[0][1] - out[out.length - 1][1]) <= 1e-7) out.pop();
    for (var pass = 0; pass < 3; pass++) {
      n = out.length;
      if (n < 4) break;
      var keep = [];
      for (i = 0; i < n; i++) if (!straight(out[(i + n - 1) % n], out[i], out[(i + 1) % n])) keep.push(out[i]);
      if (keep.length === n) break;
      out = keep;
    }
    return out;
  }
  function bbox(loops) {
    var x0 = INF, y0 = INF, x1 = -INF, y1 = -INF;
    loops.forEach(function (l) { l.forEach(function (q) { if (q[0] < x0) x0 = q[0]; if (q[0] > x1) x1 = q[0]; if (q[1] < y0) y0 = q[1]; if (q[1] > y1) y1 = q[1]; }); });
    return { x0: x0, y0: y0, x1: x1, y1: y1 };
  }
  // Centred on the bounding box, scaled uniformly so the larger half-extent is 1; 6 decimals (the
  // validator's grid offset is far larger than the rounding).
  function normalize(loops) {
    var b = bbox(loops), cx = (b.x0 + b.x1) / 2, cy = (b.y0 + b.y1) / 2;
    var s = 1 / Mth.max((b.x1 - b.x0) / 2, (b.y1 - b.y0) / 2, 1e-9);
    return {
      cx: cx, cy: cy, s: s,
      loops: loops.map(function (l) { return l.map(function (q) { return [rnd((q[0] - cx) * s, 6), rnd((q[1] - cy) * s, 6)]; }); }),
    };
  }
  function hull(points) {
    var P = points.slice().sort(function (a, b) { return a[0] - b[0] || a[1] - b[1]; });
    if (P.length < 3) return P;
    function cr(o, a, b) { return (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]); }
    var lower = [], upper = [], i;
    for (i = 0; i < P.length; i++) { while (lower.length >= 2 && cr(lower[lower.length - 2], lower[lower.length - 1], P[i]) <= 0) lower.pop(); lower.push(P[i]); }
    for (i = P.length - 1; i >= 0; i--) { while (upper.length >= 2 && cr(upper[upper.length - 2], upper[upper.length - 1], P[i]) <= 0) upper.pop(); upper.push(P[i]); }
    lower.pop(); upper.pop();
    return lower.concat(upper);
  }
  // Minimum-area bounding rectangle of a point set (rotating calipers over the hull edges).
  function obb(points) {
    var H = hull(points), n = H.length, best = null;
    if (n < 3) return { area: 0, long: 0, short: 0 };
    // Rotating calipers: for each hull edge, the extreme points along the edge (jMax, jMin) and
    // away from it (k) only move forward as the edge turns.
    var jMax = 1, k = 1, jMin = 1, steps = 0;
    for (var i = 0; i < n; i++) {
      var a = H[i], b = H[(i + 1) % n], ex = b[0] - a[0], ey = b[1] - a[1], el = Mth.sqrt(ex * ex + ey * ey);
      if (el < 1e-12) continue;
      ex /= el; ey /= el;
      var pe = function (q) { return (q[0] - a[0]) * ex + (q[1] - a[1]) * ey; };
      var pn = function (q) { return (q[1] - a[1]) * ex - (q[0] - a[0]) * ey; };
      if (best === null) { jMax = (i + 1) % n; k = jMax; jMin = jMax; }
      steps = 0; while (steps++ < n && pe(H[(jMax + 1) % n]) >= pe(H[jMax]) - 1e-12) jMax = (jMax + 1) % n;
      if (best === null) k = jMax;
      steps = 0; while (steps++ < n && pn(H[(k + 1) % n]) >= pn(H[k]) - 1e-12) k = (k + 1) % n;
      if (best === null) jMin = k;
      steps = 0; while (steps++ < n && pe(H[(jMin + 1) % n]) <= pe(H[jMin]) + 1e-12) jMin = (jMin + 1) % n;
      var w = pe(H[jMax]) - pe(H[jMin]), h = pn(H[k]);
      if (best === null || w * h < best.area) best = { area: w * h, long: Mth.max(w, h), short: Mth.min(w, h) };
    }
    return best || { area: 0, long: 0, short: 0 };
  }

  /* ------------------------------------------------------------ shape descriptors */
  // Per loop: corners, smooth (degrees of turning along curves), gap (shortest outline between two
  // corners / perimeter), aspect (short / long side of the minimum-area bounding box), fill (area /
  // that box), area. A corner is a turn at least 15° above what the curvature around it explains
  // (strong from 30°); the curvature next to a vertex comes from its neighbours across short edges
  // that belong to a run of at least three short edges (< 6 % of the perimeter: a tessellated arc),
  // while long edges and lone short ones are straight, so polygon corners keep their full turn.
  // Turns closer together than 1.5 % of the perimeter are one corner (a corner can fall between two
  // tessellation points). Loops are sorted by area, largest first.
  var CORNER_WEAK = 15 * DEG, CORNER_STRONG = 30 * DEG, CORNER_SEED = 4 * DEG;
  function describeLoop(l) {
    var n = l.length, th = new Float64Array(n), el = new Float64Array(n), ex = new Float64Array(n), cum = new Float64Array(n + 1), i;
    for (i = 0; i < n; i++) {
      th[i] = Mth.abs(turnAt(l[(i + n - 1) % n], l[i], l[(i + 1) % n]));
      var nx = l[(i + 1) % n];
      el[i] = Mth.sqrt((nx[0] - l[i][0]) * (nx[0] - l[i][0]) + (nx[1] - l[i][1]) * (nx[1] - l[i][1])); // edge i → i+1
      cum[i + 1] = cum[i] + el[i];
    }
    var P = cum[n], shortE = 0.06 * P;
    function kappa(j) { var e = (el[(j + n - 1) % n] + el[j]) / 2; return e > 0 ? th[j] / e : 0; }
    // Runs of consecutive short edges: a tessellated arc has many in a row, a polygon at most two
    // (a corner next to a short straight edge stays a corner).
    var run = new Int32Array(n), allShort = true;
    for (i = 0; i < n; i++) if (el[i] >= shortE) { allShort = false; break; }
    if (allShort) run.fill(n);
    else {
      for (i = 0; i < n; i++) {
        if (el[i] >= shortE || el[(i + n - 1) % n] < shortE) continue;
        var len = 0;
        while (len < n && el[(i + len) % n] < shortE) len++;
        for (var q2 = 0; q2 < len; q2++) run[(i + q2) % n] = len;
      }
    }
    var lowest = 0;
    for (i = 0; i < n; i++) {
      var eL = el[(i + n - 1) % n], eR = el[i];
      var kL = eL < shortE && run[(i + n - 1) % n] >= 3 ? kappa((i + n - 1) % n) : 0, kR = eR < shortE && run[i] >= 3 ? kappa((i + 1) % n) : 0;
      ex[i] = th[i] - (kL * Mth.min(eL, shortE) + kR * Mth.min(eR, shortE)) / 2;
      if (ex[i] < ex[lowest]) lowest = i;
    }
    // Clusters of neighbouring turns, walking once round from the least turning vertex.
    var clusters = [], cur = null, smooth = 0;
    for (var k = 1; k <= n; k++) {
      i = (lowest + k) % n;
      var at = cum[i] + (i <= lowest ? P : 0); // arc position, unwrapped from the start
      if (ex[i] >= CORNER_SEED) {
        if (cur && at - cur.last < 0.015 * P) { cur.sum += ex[i]; cur.th += th[i]; cur.last = at; if (ex[i] > cur.peak) { cur.peak = ex[i]; cur.at = at; } }
        else { cur = { sum: ex[i], th: th[i], last: at, peak: ex[i], at: at }; clusters.push(cur); }
      } else smooth += th[i];
    }
    var corners = [], strong = 0;
    clusters.forEach(function (c) {
      if (c.sum >= CORNER_WEAK) { corners.push(c.at); if (c.sum >= CORNER_STRONG) strong++; } else smooth += c.th;
    });
    var gap = 1;
    for (i = 0; i < corners.length && corners.length > 1; i++) {
      var d = i + 1 < corners.length ? corners[i + 1] - corners[i] : corners[0] + P - corners[i];
      if (d / P < gap) gap = d / P;
    }
    var o = obb(l), A = Mth.abs(area2(l));
    return { corners: corners.length, strong: strong, smooth: smooth / DEG, gap: gap, aspect: o.long > 0 ? o.short / o.long : 0, fill: o.area > 0 ? A / o.area : 0, area: A };
  }
  function describe(loops) {
    var parts = loops.map(describeLoop).sort(function (a, b) { return b.area - a.area; });
    return { loops: loops.length, parts: parts };
  }
  function curvedOf(p) { return p.smooth >= 45 ? 1 : p.smooth <= 15 ? 0 : 0.5; }
  // Visibly different by the descriptors: loop count; corner counts that cannot be the same even
  // allowing for weak corners; curved against straight; or bounding-box aspect ratios ≥ 1.3× apart.
  function distinct(a, b) {
    if (a.loops !== b.loops) return true;
    for (var k = 0; k < a.parts.length; k++) {
      var p = a.parts[k], q = b.parts[k];
      if (p.corners < q.strong || q.corners < p.strong) return true;
      var cp = curvedOf(p), cq = curvedOf(q);
      if (cp !== 0.5 && cq !== 0.5 && cp !== cq) return true;
      if (Mth.max(p.aspect, q.aspect) >= 1.3 * Mth.min(p.aspect, q.aspect)) return true;
    }
    return false;
  }
  // Descriptor distance (shortcut solvers and foil balancing).
  function ddist(a, b) {
    var s = 2 * Mth.abs(a.loops - b.loops);
    for (var k = 0; k < Mth.min(a.parts.length, b.parts.length); k++) {
      var p = a.parts[k], q = b.parts[k];
      s += 0.5 * Mth.min(4, Mth.abs(p.corners - q.corners)) + Mth.abs(curvedOf(p) - curvedOf(q))
        + 2 * Mth.abs(PX.rng.ln(Mth.max(p.aspect, 1e-3) / Mth.max(q.aspect, 1e-3))) + 2 * Mth.abs(p.fill - q.fill);
    }
    return s;
  }

  /* ------------------------------------------------------------ rasters */
  // Nesting depth of option loops on an M × M grid over [−R, R]² (cell centres), by scanlines.
  // Cell centres sit at −R + (k + ½)·cell + GRID_OFF: the small offset keeps them off every
  // rounded coordinate, so an outline edge never runs exactly through a row of centres.
  var GRID = 54, GRID_R = 1.08, GRID_OFF = 0.0000173;
  function rasterize(loops, M, R) {
    M = M || GRID; R = R || GRID_R;
    var g = new Uint8Array(M * M), cell = 2 * R / M, rows = new Array(M), r, k;
    R -= GRID_OFF; // centres at −R + (k + ½)·cell from here on
    for (var li = 0; li < loops.length; li++) {
      var l = loops[li], n = l.length;
      for (r = 0; r < M; r++) rows[r] = null;
      for (var i = 0; i < n; i++) {
        var a = l[i], b = l[(i + 1) % n];
        if (a[1] === b[1]) continue;
        var lo = a[1] < b[1] ? a[1] : b[1], hi = a[1] < b[1] ? b[1] : a[1];
        // rows whose centre y satisfies lo <= y < hi (the half-open crossing rule)
        var r0 = Mth.max(0, Mth.ceil((lo + R) / cell - 0.5) - 1), r1 = Mth.min(M - 1, Mth.ceil((hi + R) / cell - 0.5));
        for (r = r0; r <= r1; r++) {
          var y = -R + (r + 0.5) * cell;
          if ((a[1] > y) !== (b[1] > y)) (rows[r] || (rows[r] = [])).push(a[0] + (y - a[1]) / (b[1] - a[1]) * (b[0] - a[0]));
        }
      }
      for (r = 0; r < M; r++) {
        var xs = rows[r];
        if (!xs) continue;
        xs.sort(function (p, q) { return p - q; });
        for (k = 0; k + 1 < xs.length; k += 2) {
          var c0 = Mth.max(0, Mth.ceil((xs[k] + R) / cell - 0.5)), c1 = Mth.min(M - 1, Mth.floor((xs[k + 1] + R) / cell - 0.5));
          for (var c = c0; c <= c1; c++) g[r * M + c]++;
        }
      }
    }
    return g;
  }
  // Agreement of two depth grids: the intersection over union of the cells inside at least L loops,
  // for every nesting level L present in either grid, and the smallest of these. For single outlines
  // it is the plain intersection over union; for nested ones the inner outline counts as much as
  // the outer one (the shared outer ring cannot hide a different inner shape).
  function agreement(g1, g2) {
    var both1 = 0, any1 = 0, both2 = 0, any2 = 0;
    for (var i = 0; i < g1.length; i++) {
      var a = g1[i], b = g2[i];
      if (a || b) { any1++; if (a && b) both1++; }
      if (a >= 2 || b >= 2) { any2++; if (a >= 2 && b >= 2) both2++; }
    }
    var r = any1 ? both1 / any1 : 1;
    if (any2) r = Mth.min(r, both2 / any2);
    return r;
  }

  /* ------------------------------------------------------------ solids */
  // No simple sphere: every section of a sphere is a circle that matches its silhouette.
  var SIMPLE = [['cube', 'box', 'pyramid', 'prism'], ['cylinder', 'cone', 'cylinder', 'cone']];
  var CONVEX_JOINED = { house: 1, barn: 1, cylcone: 1, cyldome: 1, bicone: 1 };
  var JOINED = [['house', 'barn', 'L', 'step'], ['boxcyl', 'boxcone', 'cylcone', 'cyldome', 'cylcyl', 'bicone']];
  // Embedded pairs [outer, inner]; curved when either is curved.
  var EMBEDDED = [
    [['box', 'box'], ['box', 'prism'], ['prism', 'box'], ['cube', 'pyramid'], ['pyramid', 'cube'], ['cube', 'box']],
    [['box', 'cylinder'], ['cube', 'sphere'], ['cylinder', 'box'], ['cylinder', 'cylinder'], ['cylinder', 'sphere'],
      ['cylinder', 'cone'], ['sphere', 'cube'], ['sphere', 'cylinder'], ['box', 'cone'], ['cone', 'sphere']],
  ];
  var CURVED_TYPES = { cylinder: 1, cone: 1, sphere: 1 };
  var FLIP = [1, 0, 0, 0, -1, 0, 0, 0, -1];

  function r3(x) { return Mth.round(x * 1000) / 1000; }
  function part(type, dims, pos, rot) {
    var p = { type: type };
    for (var k in dims) if (Object.prototype.hasOwnProperty.call(dims, k)) p[k] = r3(dims[k]);
    p.pos = (pos || [0, 0, 0]).map(function (x) { return Mth.round(x * 1e6) / 1e6; });
    p.rot = (rot || I3).map(function (x) { return Mth.round(x * 1e6) / 1e6; });
    return p;
  }
  // A primitive of the given kind filling the box W × H × D (local y up).
  function primInBox(kind, W, H, D, prismAx) {
    var m = Mth.min(W, D);
    switch (kind) {
      case 'cube': { var s = (W + H + D) / 3; return ['box', { w: s, h: s, d: s }]; }
      case 'box': return ['box', { w: W, h: H, d: D }];
      case 'cylinder': return ['cylinder', { r: m / 2, h: H }];
      case 'cone': return ['cone', { r: m / 2, h: H }];
      case 'sphere': return ['sphere', { r: Mth.min(m, H) / 2 }];
      case 'pyramid': return ['pyramid', { ax: m, az: m, h: H }];
      case 'prism': return ['prism', { b: W, t: H, L: D, ax: (prismAx || 0) * W }];
    }
    throw new Error('slice: unknown kind ' + kind);
  }
  function primExtent(p) { // half-extents of a primitive's own bounding box
    switch (p.type) {
      case 'box': return [p.w / 2, p.h / 2, p.d / 2];
      case 'prism': return [Mth.max(p.b / 2, Mth.abs(p.ax)), p.t / 2, p.L / 2];
      case 'pyramid': return [p.ax / 2, p.h / 2, p.az / 2];
      case 'cylinder': case 'cone': return [p.r, p.h / 2, p.r];
      case 'sphere': return [p.r, p.r, p.r];
    }
    return [1, 1, 1];
  }
  function boxDims(rng) { // a clearly non-cubic box
    for (var i = 0; i < 20; i++) {
      var w = rng.float(1.2, 2.2), h = rng.float(0.7, 1.8), d = rng.float(0.8, 1.6);
      var hi = Mth.max(w, h, d), lo = Mth.min(w, h, d);
      if (hi / lo >= 1.4) return [w, h, d];
    }
    return [2.0, 1.0, 1.3];
  }
  function randomBox(rng, kind) { // bounding box W, H, D of a simple solid of this kind
    switch (kind) {
      case 'cube': { var s = rng.float(1.5, 1.8); return [s, s, s]; }
      case 'box': return boxDims(rng);
      case 'cylinder': { var r = rng.float(0.55, 0.85); return [2 * r, rng.float(1.3, 2.0), 2 * r]; }
      case 'cone': { var rc = rng.float(0.65, 1.0); return [2 * rc, rng.float(1.4, 2.0), 2 * rc]; }
      case 'sphere': { var rs = rng.float(0.9, 1.1); return [2 * rs, 2 * rs, 2 * rs]; }
      case 'pyramid': { var a = rng.float(1.4, 1.9); return [a, rng.float(1.2, 1.9), a]; }
      case 'prism': return [rng.float(1.3, 1.9), rng.float(1.0, 1.6), rng.float(1.5, 2.2)];
    }
    return [1.6, 1.6, 1.6];
  }
  function lieFor(rng, kind) {
    if (kind === 'cylinder') return rng.pick(['y', 'y', 'x']);
    if (kind === 'prism') return rng.pick(['y', 'y', 'z']);
    if (kind === 'cone') return rng.pick(['y', 'y', 'y', '-y']);
    return 'y';
  }
  function simpleSolid(kind, W, H, D, prismAx) {
    var pr = primInBox(kind, W, H, D, prismAx);
    return { structure: 'simple', kind: kind, curved: CURVED_TYPES[pr[0]] ? 1 : 0, parts: [part(pr[0], pr[1])] };
  }

  // Joined solids: parts stacked along local y and centred on the whole bounding box.
  // Sizes are rounded when drawn and positions computed from the rounded sizes, so joined parts
  // touch exactly (the analytic union then has no sliver gap at the joint).
  function joinedSolid(kind, rng) {
    var s, W, D, hb, ht, R, r;
    function f(a, b) { return r3(rng.float(a, b)); }
    switch (kind) {
      case 'house': case 'barn': {
        W = f(1.3, 1.9); D = f(1.2, 1.9); hb = f(0.9, 1.3); ht = f(0.6, 1.0);
        var y0 = -(hb + ht) / 2;
        var top = kind === 'house' ? part('pyramid', { ax: W, az: D, h: ht }, [0, y0 + hb + ht / 2, 0])
          : part('prism', { b: W, t: ht, L: D, ax: rng.pick([0, 0, -0.25, 0.25]) * W }, [0, y0 + hb + ht / 2, 0]);
        s = [part('box', { w: W, h: hb, d: D }, [0, y0 + hb / 2, 0]), top];
        break;
      }
      case 'L': {
        W = f(1.7, 2.2); D = f(0.9, 1.4); var h1 = f(0.6, 0.9), h2 = f(0.8, 1.2), w2 = f(0.6, 0.9);
        var yb = -(h1 + h2) / 2, left = rng.chance(0.5);
        s = [part('box', { w: W, h: h1, d: D }, [0, yb + h1 / 2, 0]),
          part('box', { w: w2, h: h2, d: D }, [left ? -W / 2 + w2 / 2 : W / 2 - w2 / 2, yb + h1 + h2 / 2, 0])];
        break;
      }
      case 'step': case 'boxcyl': case 'boxcone': {
        W = f(1.5, 2.1); D = f(1.3, 1.9); hb = f(0.7, 1.1); ht = f(0.7, 1.1);
        var upper, uh;
        if (kind === 'step') {
          // Ledges at least 0.22 wide on every side, so the section's corners never crowd.
          var w3 = r3(rng.float(0.4, 0.6) * W), d3 = r3(rng.float(0.4, 0.62) * D);
          var ox = rng.float(-1, 1) * Mth.max(0, (W - w3) / 2 - 0.22), oz = rng.float(-1, 1) * Mth.max(0, (D - d3) / 2 - 0.22);
          uh = ht;
          upper = function (yS) { return part('box', { w: w3, h: uh, d: d3 }, [ox, yS + hb + uh / 2, oz]); };
        } else {
          r = r3(rng.float(0.28, 0.42) * Mth.min(W, D));
          var ox2 = rng.float(-1, 1) * (W / 2 - r) * 0.6, oz2 = rng.float(-1, 1) * (D / 2 - r) * 0.6;
          uh = kind === 'boxcone' ? r3(ht + 0.3) : ht;
          upper = function (yS) { return part(kind === 'boxcyl' ? 'cylinder' : 'cone', { r: r, h: uh }, [ox2, yS + hb + uh / 2, oz2]); };
        }
        var yS = -(hb + uh) / 2;
        s = [part('box', { w: W, h: hb, d: D }, [0, yS + hb / 2, 0]), upper(yS)];
        break;
      }
      case 'cylcone': case 'cylcyl': case 'cyldome': {
        R = f(0.6, 0.85); hb = r3(rng.float(Mth.max(1.0, R + 0.15), 1.4));
        ht = kind === 'cyldome' ? R : f(0.7, 1.0);
        r = kind === 'cylcone' ? (rng.chance(0.5) ? R : r3(rng.float(0.5, 0.7) * R)) : kind === 'cylcyl' ? r3(rng.float(0.45, 0.7) * R) : R;
        var yC = -(hb + ht) / 2, c0 = part('cylinder', { r: R, h: hb }, [0, yC + hb / 2, 0]);
        var c1 = kind === 'cyldome' ? part('sphere', { r: R }, [0, yC + hb, 0])
          : part(kind === 'cylcone' ? 'cone' : 'cylinder', { r: r, h: ht }, [0, yC + hb + ht / 2, 0]);
        s = [c0, c1];
        break;
      }
      case 'bicone': {
        R = f(0.7, 0.95); hb = f(0.7, 1.0); ht = f(0.8, 1.2);
        var yB = -(hb + ht) / 2;
        s = [part('cone', { r: R, h: hb }, [0, yB + hb / 2, 0], FLIP), part('cone', { r: R, h: ht }, [0, yB + hb + ht / 2, 0])];
        break;
      }
      default: throw new Error('slice: unknown joined kind ' + kind);
    }
    return { structure: 'joined', kind: kind, curved: JOINED[1].indexOf(kind) >= 0 ? 1 : 0, parts: s };
  }

  /* ------------------------------------------------------------ analytic inside tests (validate) */
  var EPS_IN = 1e-9;
  function insideXYZ(p, x, y, z) {
    var f;
    switch (p.type) {
      case 'box': return Mth.abs(x) <= p.w / 2 + EPS_IN && Mth.abs(y) <= p.h / 2 + EPS_IN && Mth.abs(z) <= p.d / 2 + EPS_IN;
      case 'prism':
        if (Mth.abs(z) > p.L / 2 || y < -p.t / 2 || y > p.t / 2) return false;
        f = (y + p.t / 2) / p.t;
        return x >= -p.b / 2 + (p.ax + p.b / 2) * f - EPS_IN && x <= p.b / 2 + (p.ax - p.b / 2) * f + EPS_IN;
      case 'pyramid':
        if (y < -p.h / 2 || y > p.h / 2) return false;
        f = (p.h / 2 - y) / p.h;
        return Mth.abs(x) <= p.ax / 2 * f + EPS_IN && Mth.abs(z) <= p.az / 2 * f + EPS_IN;
      case 'cylinder': return Mth.abs(y) <= p.h / 2 && x * x + z * z <= p.r * p.r;
      case 'cone':
        if (y < -p.h / 2 || y > p.h / 2) return false;
        f = p.r * (p.h / 2 - y) / p.h;
        return x * x + z * z <= f * f;
      case 'sphere': return x * x + y * y + z * z <= p.r * p.r;
    }
    return false;
  }
  function insidePrim(p, r) { return insideXYZ(p, r[0], r[1], r[2]); }
  // Depth of a world point: 0 outside; 1 inside (joined: inside any part); embedded: 2 inside the inner.
  function depthAt(solid, R, w) {
    var q = mtvec(R, w), d = 0;
    for (var i = 0; i < solid.parts.length; i++) {
      var p = solid.parts[i];
      if (insidePrim(p, mtvec(p.rot, sub(q, p.pos)))) d++;
    }
    return solid.structure === 'joined' ? (d > 0 ? 1 : 0) : d;
  }

  /* ------------------------------------------------------------ embedded solids */
  // The inner solid is scaled to the largest size that keeps every vertex of its mesh inside the
  // outer solid shrunk by a margin, then to 72–88 % of that, so the outlines never touch.
  // Points spanning a primitive's convex hull in its own frame (24 around on curved surfaces: the
  // true surface bulges at most 0.9 % of the radius beyond them, far below the margins used).
  var TRIG24 = null;
  function hullPoints(p) {
    var pts = [], i;
    if (!TRIG24) { TRIG24 = []; for (i = 0; i < 24; i++) TRIG24.push(sincos(TAU * i / 24)); }
    switch (p.type) {
      case 'box': for (i = 0; i < 8; i++) pts.push([(i & 1 ? 0.5 : -0.5) * p.w, (i & 2 ? 0.5 : -0.5) * p.h, (i & 4 ? 0.5 : -0.5) * p.d]); break;
      case 'prism': triPoly(p).forEach(function (q) { pts.push([q[0], q[1], -p.L / 2], [q[0], q[1], p.L / 2]); }); break;
      case 'pyramid': pts.push([0, p.h / 2, 0]); for (i = 0; i < 4; i++) pts.push([(i & 1 ? 0.5 : -0.5) * p.ax, -p.h / 2, (i & 2 ? 0.5 : -0.5) * p.az]); break;
      case 'cylinder': TRIG24.forEach(function (sc) { pts.push([p.r * sc[1], -p.h / 2, p.r * sc[0]], [p.r * sc[1], p.h / 2, p.r * sc[0]]); }); break;
      case 'cone': pts.push([0, p.h / 2, 0]); TRIG24.forEach(function (sc) { pts.push([p.r * sc[1], -p.h / 2, p.r * sc[0]]); }); break;
      case 'sphere':
        pts.push([0, -p.r, 0], [0, p.r, 0]);
        for (i = 1; i < 12; i++) {
          var la = sincos(PI * i / 12);
          TRIG24.forEach(function (sc) { pts.push([p.r * la[0] * sc[1], -p.r * la[1], p.r * la[0] * sc[0]]); });
        }
        break;
    }
    return pts;
  }
  function fits(outer, inner, margin) {
    var H = hullPoints(inner);
    for (var i = 0; i < H.length; i++) {
      var w = add(mvec(inner.rot, H[i]), inner.pos);
      // shrink test: the point pushed outward by `margin` in every axis direction must stay inside
      for (var a = 0; a < 6; a++) {
        var e = [0, 0, 0]; e[a >> 1] = a & 1 ? margin : -margin;
        if (!insidePrim(outer, mtvec(outer.rot, sub(add(w, e), outer.pos)))) return false;
      }
    }
    return true;
  }
  function embeddedSolid(pair, rng, W, H, D) {
    var outerP = primInBox(pair[0], W, H, D, rng.pick([0, 0.2, -0.2]));
    var outer = part(outerP[0], outerP[1]);
    // The inner's proportions: its own random box, placed near the outer's widest part.
    var b = randomBox(rng, pair[1]), yaw = rng.pick([0, 0, 30, 45, -30]);
    var cy = pair[0] === 'cone' || pair[0] === 'pyramid' ? -H * 0.2 : pair[0] === 'prism' ? -H * 0.12 : 0;
    var rot = pair[1] === 'sphere' ? I3 : yawM(yaw);
    var lo = 0.1, hi = 1.2, best = 0;
    for (var it = 0; it < 7; it++) {
      var mid = (lo + hi) / 2, ip = primInBox(pair[1], b[0] * mid, b[1] * mid, b[2] * mid, 0);
      if (fits(outer, part(ip[0], ip[1], [0, cy, 0], rot), 0.06)) { best = mid; lo = mid; } else hi = mid;
    }
    if (best <= 0.1) return null;
    var sc = best * rng.float(0.72, 0.88), inP = primInBox(pair[1], b[0] * sc, b[1] * sc, b[2] * sc, 0);
    var inner = part(inP[0], inP[1], [0, cy, 0], rot);
    if (!fits(outer, inner, 0.05)) return null;
    return {
      structure: 'embedded', kind: pair[0] + '>' + pair[1],
      curved: CURVED_TYPES[outer.type] || CURVED_TYPES[inner.type] ? 1 : 0, parts: [outer, inner],
    };
  }

  /* ------------------------------------------------------------ related solids ('solid' foils) */
  var RELATED = {
    cube: ['box', 'pyramid', 'prism', 'cylinder'], box: ['cube', 'prism', 'pyramid', 'cylinder'],
    pyramid: ['cone', 'box', 'prism'], prism: ['box', 'pyramid', 'cylinder'],
    cylinder: ['cone', 'box', 'sphere', 'prism'], cone: ['cylinder', 'pyramid', 'sphere'], sphere: ['cylinder', 'cube', 'cone'],
    house: ['barn', 'step'], barn: ['house', 'L'], L: ['step', 'barn'], step: ['L', 'boxcyl', 'house'],
    boxcyl: ['boxcone', 'step'], boxcone: ['boxcyl', 'house'], cylcone: ['cyldome', 'cylcyl', 'bicone'],
    cyldome: ['cylcone', 'cylcyl'], cylcyl: ['cylcone', 'cyldome', 'boxcyl'], bicone: ['cylcone', 'cyldome'],
  };
  function bboxOfParts(solid) {
    var lo = [INF, INF, INF], hi = [-INF, -INF, -INF];
    solid.parts.forEach(function (p) {
      var e = primExtent(p);
      for (var sx = -1; sx <= 1; sx += 2) for (var sy = -1; sy <= 1; sy += 2) for (var sz = -1; sz <= 1; sz += 2) {
        var w = add(mvec(p.rot, [sx * e[0], sy * e[1], sz * e[2]]), p.pos);
        for (var a = 0; a < 3; a++) { if (w[a] < lo[a]) lo[a] = w[a]; if (w[a] > hi[a]) hi[a] = w[a]; }
      }
    });
    return { lo: lo, hi: hi, size: sub(hi, lo) };
  }
  function withPose(s, solid) { s.yaw = solid.yaw; s.lie = solid.lie; return s; }
  // A related joined solid with the same bounding box (built from the same random stream, then
  // rescaled part by part to the original's bounding box).
  function rescaleJoined(s, target) {
    var bb = bboxOfParts(s), f = [target.size[0] / bb.size[0], target.size[1] / bb.size[1], target.size[2] / bb.size[2]];
    var c = mul(add(bb.lo, bb.hi), 0.5), tc = mul(add(target.lo, target.hi), 0.5);
    s.parts = s.parts.map(function (p) {
      var q = JSON.parse(JSON.stringify(p));
      ['w', 'h', 'd', 'b', 't', 'L', 'ax', 'az', 'r'].forEach(function (k) {
        if (q[k] === undefined) return;
        var fk = k === 'w' || k === 'b' || k === 'ax' ? f[0] : k === 'd' || k === 'L' || k === 'az' ? f[2] : k === 'r' ? Mth.min(f[0], f[2]) : f[1];
        q[k] = r3(q[k] * fk);
      });
      q.pos = [r3(tc[0] + (p.pos[0] - c[0]) * f[0]), r3(tc[1] + (p.pos[1] - c[1]) * f[1]), r3(tc[2] + (p.pos[2] - c[2]) * f[2])];
      return q;
    });
    if (s.kind === 'cyldome') { // keep the dome a hemisphere on the cylinder
      var cyl = s.parts[0], dome = s.parts[1];
      dome.r = cyl.r; dome.pos = [cyl.pos[0], r3(cyl.pos[1] + cyl.h / 2), cyl.pos[2]];
    }
    return s;
  }
  function relatedSolids(solid, rng) {
    var out = [], bb = bboxOfParts(solid), sz = bb.size, k;
    if (solid.structure === 'simple') {
      (RELATED[solid.kind] || []).forEach(function (kind) {
        var W = sz[0], H = sz[1], D = sz[2];
        if (kind === 'box' && solid.kind === 'cube') { W *= 1.35; H *= 0.7; }
        out.push(withPose(simpleSolid(kind, W, H, D, 0), solid));
      });
    } else if (solid.structure === 'joined') {
      (RELATED[solid.kind] || []).forEach(function (kind) {
        var j = joinedSolid(kind, rng.fork('rel-' + kind));
        out.push(withPose(rescaleJoined(j, bb), solid));
      });
      solid.parts.forEach(function (p) { // each part on its own
        out.push(withPose({ structure: 'simple', kind: p.type, curved: CURVED_TYPES[p.type] ? 1 : 0, parts: [JSON.parse(JSON.stringify(p))] }, solid));
      });
    } else {
      var outer = solid.parts[0], inner = solid.parts[1], ob = bboxOfParts({ parts: [outer] }).size, ib = bboxOfParts({ parts: [inner] }).size;
      var oKind = solid.kind.split('>')[0], iKind = solid.kind.split('>')[1];
      // another inner of the same size; another outer around the same inner; the outer alone
      (RELATED[iKind] || []).slice(0, 3).forEach(function (kind) {
        var ip = primInBox(kind, ib[0], ib[1], ib[2], 0), q = part(ip[0], ip[1], inner.pos, inner.rot);
        if (fits(outer, q, 0.03)) out.push(withPose({ structure: 'embedded', kind: oKind + '>' + kind, curved: 0, parts: [outer, q] }, solid));
      });
      (RELATED[oKind] || []).slice(0, 3).forEach(function (kind) {
        var op = primInBox(kind, ob[0], ob[1], ob[2], 0), q = part(op[0], op[1]);
        if (fits(q, inner, 0.03)) out.push(withPose({ structure: 'embedded', kind: kind + '>' + iKind, curved: 0, parts: [q, inner] }, solid));
      });
      out.push(withPose({ structure: 'simple', kind: oKind, curved: 0, parts: [outer] }, solid));
    }
    for (k = 0; k < out.length; k++) out[k].curved = out[k].parts.some(function (p) { return CURVED_TYPES[p.type]; }) ? 1 : 0;
    return out;
  }

  /* ------------------------------------------------------------ planes */
  var AX = [[1, 0, 0], [0, 1, 0], [0, 0, 1]];
  // The local axis a, tilted about local axis b by alpha degrees, then about c by beta degrees.
  function tilt(a, b, alpha, c, beta) {
    var n = AX[a].slice();
    if (alpha) n = rotAbout(n, AX[b], alpha * DEG);
    if (beta) n = rotAbout(n, AX[c], beta * DEG);
    return unit(n);
  }
  function signed(rng, lo, hi) { var x = rng.float(lo, hi); return rng.chance(0.5) ? x : -x; }
  function support(ext, n) { return Mth.abs(n[0]) * ext[0] + Mth.abs(n[1]) * ext[1] + Mth.abs(n[2]) * ext[2]; }

  // Polyhedral corners and apexes in world coordinates: planes keep away from them, where a tiny
  // shift changes the polygon (research/B-tasks.md §4).
  function featurePoints(solid) {
    var R = solidRot(solid), out = [];
    solid.parts.forEach(function (p) {
      var pts = [], i;
      switch (p.type) {
        case 'box': for (i = 0; i < 8; i++) pts.push([(i & 1 ? 0.5 : -0.5) * p.w, (i & 2 ? 0.5 : -0.5) * p.h, (i & 4 ? 0.5 : -0.5) * p.d]); break;
        case 'prism': triPoly(p).forEach(function (q) { pts.push([q[0], q[1], -p.L / 2], [q[0], q[1], p.L / 2]); }); break;
        case 'pyramid': pts.push([0, p.h / 2, 0]); for (i = 0; i < 4; i++) pts.push([(i & 1 ? 0.5 : -0.5) * p.ax, -p.h / 2, (i & 2 ? 0.5 : -0.5) * p.az]); break;
        case 'cone': pts.push([0, p.h / 2, 0]); break;
      }
      pts.forEach(function (q) { out.push(mvec(R, add(mvec(p.rot, q), p.pos))); });
    });
    return out;
  }

  // Section of a solid by the plane through p with normal n, checked for display:
  // → { f, loops (2D, plane frame), norm, desc } or null.
  function cutSolid(solid, meshes, p, n, nLoops, margin) {
    var f = planeFrame(n), fp = featurePoints(solid), i;
    for (i = 0; i < fp.length; i++) if (Mth.abs(dot(sub(fp[i], p), f.n)) < margin) return why('cut:vertex');
    var sec = sectionOf(meshes, p, f);
    if (!sec) return why('cut:open');
    var loops = flatLoops(sec);
    if (loops.length !== nLoops || sec.some(function (s) { return s.loops.length !== 1; })) return why('cut:loops');
    for (i = 0; i < loops.length; i++) if (loops[i].length < 3 || Mth.abs(area2(loops[i])) < 0.04) return why('cut:small');
    var nm = normalize(loops), desc = describe(nm.loops);
    for (i = 0; i < desc.parts.length; i++) if (desc.parts[i].aspect < 0.16) return why('cut:thin');
    return { f: f, p: p, loops: loops, norm: nm, desc: desc };
  }

  // The egocentric shape: the true section as it appears on the screen (foreshortened).
  function egoLoops(loops, f) {
    var ur = dot(f.u, VIEW.right), vr = dot(f.v, VIEW.right), uu = dot(f.u, VIEW.up), vu = dot(f.v, VIEW.up);
    return loops.map(function (l) { return l.map(function (q) { return [q[0] * ur + q[1] * vr, q[0] * uu + q[1] * vu]; }); });
  }

  /* ------------------------------------------------------------ difficulty (custom, with interactions) */
  // Logits; P(right) = g + (1 − g − 0.03)·σ(θ − b), g = .25 (four options); a beginner has θ ≈ 0.
  // base −2.2: simple, orthogonal, straight-sided ≈ .90 right at θ = 0.
  // cut: oblique +1.5 (SBST orthogonal ≈ .73 vs oblique ≈ .47 for simple and joined solids, Cohen &
  //   Hegarty 2007: 1.5 logits apart on this model); double oblique +2.6 (compound cuts as in the
  //   MCT, not in the SBST; DJ).
  // structure: joined +0.15 (≈ simple in the SBST); embedded +0.1 with an orthogonal cut
  //   (embedded-orthogonal ≈ .75, the easiest SBST cell), plus the interaction embedded × oblique
  //   +1.0 (embedded-oblique ≈ .36 is 2.5 logits below embedded-orthogonal, against 1.5 for the cut
  //   alone) and embedded × double oblique +1.2 (DJ).
  // curved: +0.6 (conic sections and "stereotyping" errors, Tsutsumi 2013; DJ) and curved × any
  //   oblique +0.3 (ellipses, truncated ellipses; DJ).
  // Range −2.2 (simple, orthogonal, straight) … +2.6 (embedded, double oblique, curved): 4.8 logits.
  var DIFF = { base: -2.2, cut: [0, 1.5, 2.6], structure: [0, 0.15, 0.1], curved: 0.6, embXcut: [0, 1.0, 1.2], curvedXcut: [0, 0.3, 0.3] };
  function difficulty(params) {
    var s = lvl(params, 'structure', 3), c = lvl(params, 'cut', 3), k = lvl(params, 'curved', 2);
    return DIFF.base + DIFF.cut[c] + DIFF.structure[s] + (s === 2 ? DIFF.embXcut[c] : 0) + (k ? DIFF.curved + DIFF.curvedXcut[c] : 0);
  }
  function lvl(params, k, n) { var x = params ? params[k] : 0; return Number.isInteger(x) && x >= 0 && x < n ? x : 0; }

  /* ------------------------------------------------------------ the solid for a problem */
  function chooseSolid(rng, structure, curved, cut) {
    var s, kind, b;
    if (structure === 0) {
      kind = rng.pick(SIMPLE[curved]);
      b = randomBox(rng, kind);
      s = simpleSolid(kind, b[0], b[1], b[2], rng.pick([0, 0, 0.2, -0.2]));
    } else if (structure === 1) {
      // Stacked cylinders, or a cylinder with a dome, cut vertically show their own outline.
      s = joinedSolid(rng.pick(JOINED[curved].filter(function (k) { return cut || (k !== 'cyldome' && k !== 'cylcyl'); })), rng);
    } else {
      var pair = rng.pick(EMBEDDED[curved]);
      kind = pair[0];
      b = randomBox(rng, kind);
      if (kind === 'box' || kind === 'cube') b = [b[0] * 1.15, b[1] * 1.1, b[2] * 1.15];
      s = embeddedSolid(pair, rng, b[0], b[1], b[2]);
      if (!s) return null;
    }
    s.yaw = rng.int(-20, 15);
    s.lie = structure === 0 ? lieFor(rng, s.kind) : structure === 2 && (kind === 'cylinder') ? rng.pick(['y', 'x']) : 'y';
    return s;
  }

  // Local plane normals for a cut level (in the frame of the solid; embedded: of the outer solid).
  function cutNormal(rng, cut, structure, solid) {
    var axes = structure === 1 ? [0, 2] : [0, 1, 2];
    if (cut === 0) return AX[rng.pick(axes)].slice();
    var a = rng.pick(axes), others = [0, 1, 2].filter(function (x) { return x !== a; });
    if (cut === 1) {
      var b = rng.pick(others);
      if (structure === 1 && b === 1) b = others[0] === 1 ? others[1] : others[0]; // a tilt about y keeps the plane vertical
      return tilt(a, b, signed(rng, 25, 55));
    }
    return tilt(a, others[0], signed(rng, 22, 45), others[1], signed(rng, 22, 45));
  }
  // The other cuts through the same point: every axis and a few tilts ('cut' foils).
  function neighbourNormals(rng, structure) {
    var axes = structure === 1 ? [0, 2] : [0, 1, 2], out = [];
    axes.forEach(function (a) {
      out.push(AX[a].slice());
      [0, 1, 2].forEach(function (b) { if (b !== a) out.push(tilt(a, b, signed(rng, 22, 38)), tilt(a, b, signed(rng, 42, 60))); });
    });
    for (var i = 0; i < 3; i++) out.push(tilt(i, (i + 1) % 3, signed(rng, 22, 45), (i + 2) % 3, signed(rng, 22, 45)));
    return out;
  }

  function solidCentre(solid) {
    var bb = bboxOfParts(solid);
    return mul(add(bb.lo, bb.hi), 0.5);
  }


  // The offset closest to t0 within [lo, hi] that keeps at least `margin` from every value in ds
  // (feature points projected on the normal), or null.
  function clearOffset(ds, t0, lo, hi, margin) {
    var cands = [t0], best = null;
    ds.forEach(function (d) { cands.push(d - margin - 1e-6, d + margin + 1e-6); });
    cands.forEach(function (c) {
      if (c < lo || c > hi) return;
      for (var i = 0; i < ds.length; i++) if (Mth.abs(ds[i] - c) < margin) return;
      if (best === null || Mth.abs(c - t0) < Mth.abs(best - t0)) best = c;
    });
    return best;
  }

  // The outline the solid presents to the viewer as an option (MCT "answers that look like
  // projections"): convex solids only (simple, embedded with the inner outline inside the outer
  // one, convex joined kinds); null otherwise.
  function projOption(solid) {
    if (solid.structure !== 'joined') return optionOf('proj', partOutlines(solid, solid.parts), null);
    if (CONVEX_JOINED[solid.kind]) return optionOf('proj', [hull([].concat.apply([], partOutlines(solid, solid.parts)))], null);
    return null;
  }

  // Every plane check and the key's section: → problem { solid, meshes, p, n, f, key } or null.
  function makeProblem(rng, params, memo) {
    var structure = lvl(params, 'structure', 3), cut = lvl(params, 'cut', 3), curved = lvl(params, 'curved', 2);
    var solid = chooseSolid(rng, structure, curved, cut);
    if (!solid) return why('solid');
    var R = solidRot(solid), meshes = solidMeshes(solid, memo), partMeshes = null, proj, fps = null;
    for (var attempt = 0; attempt < 10; attempt++) {
      // Seen neither head-on (the egocentric foil would equal the key) nor edge-on (a thin sliver):
      // normals are redrawn until one faces the viewer at |n·view| in [0.3, 0.82].
      var nl = null, n = null;
      for (var draw = 0; draw < 16; draw++) {
        nl = cutNormal(rng, cut, structure, solid); n = unit(mvec(R, nl));
        var facing = Mth.abs(dot(n, VIEW.dir));
        if (facing >= 0.3 && facing <= 0.82) break;
        nl = null;
      }
      if (!nl) { why('plane:view'); continue; }
      // The plane's offset along its normal: a random position in the allowed range, then slid to the
      // nearest position at least 0.1 away from every corner and apex (where a tiny shift would
      // change the polygon).
      var base, ext, lo, hi, t0;
      if (structure === 2) { // through the inner solid, near its centre
        base = solid.parts[1].pos; ext = support(primExtent(solid.parts[1]), mtvec(solid.parts[1].rot, nl));
        lo = -0.45 * ext; hi = 0.45 * ext; t0 = rng.float(-0.3, 0.3) * ext;
      } else if (structure === 1) { // through the joint, off the upper part's axis (and its apex)
        var up = solid.parts[1], low = solid.parts[0], yj = low.pos[1] + primExtent(low)[1];
        if (solid.kind === 'bicone') yj = low.pos[1] + low.h / 2;
        base = [up.pos[0], yj, up.pos[2]]; ext = support(primExtent(up), mtvec(up.rot, nl));
        t0 = signed(rng, 0.3, 0.7) * ext;
        lo = t0 > 0 ? 0.25 * ext : -0.78 * ext; hi = t0 > 0 ? 0.78 * ext : -0.25 * ext;
      } else {
        base = solidCentre(solid); ext = support(mul(bboxOfParts(solid).size, 0.5), nl);
        lo = -0.5 * ext; hi = 0.5 * ext; t0 = rng.float(-0.4, 0.4) * ext;
      }
      if (!fps) fps = featurePoints(solid).map(function (w) { return mtvec(R, w); });
      var t = clearOffset(fps.map(function (w) { return dot(w, nl) - dot(base, nl); }), t0, lo, hi, 0.1);
      if (t === null) { why('cut:vertex'); continue; }
      var pl = add(base, mul(nl, t));
      var p = mvec(R, pl).map(function (x) { return Mth.round(x * 1e4) / 1e4; });
      n = n.map(function (x) { return Mth.round(x * 1e6) / 1e6; });
      var key = cutSolid(solid, meshes, p, n, structure === 2 ? 2 : 1, 0.09);
      if (!key) continue;
      if (!clear(key.desc)) { why(key.desc.parts.some(function (q) { return q.gap < 0.03; }) ? 'key:crowded' : 'key:ambiguous'); continue; }
      var keyOpt = optionOf('key', key.loops, key.f, key.norm, key.desc), ego = optionOf('ego', egoLoops(key.loops, key.f), key.f);
      if (!visiblyDifferent(keyOpt, ego)) { why('ego:same'); continue; }
      // The key must not be the outline the solid presents to the viewer.
      if (proj === undefined) proj = projOption(solid);
      if (proj ? agreement(smallOf(keyOpt), smallOf(proj)) > SAME_SMALL : iou(smallOf(keyOpt), silhouetteGrid(solid, SMALL)) > SAME_SMALL) { why('key:silhouette'); continue; }
      if (!clear(ego.desc)) { why('ego:unclear'); continue; }
      if (ego.desc.parts[0].aspect < 0.2) { why('ego:thin'); continue; } // the plane is nearly edge-on
      if (structure === 2 && keyOpt.desc.parts[1].area < 0.06 * keyOpt.desc.parts[0].area) { why('key:inner'); continue; }
      if (structure === 1) {
        if (!partMeshes) partMeshes = solid.parts.map(function (q) { return solidMeshes({ structure: 'simple', yaw: solid.yaw, lie: solid.lie, parts: [q] }, memo)[0]; });
        if (!crossesBoth(partMeshes, p, key.f)) { why('key:joint'); continue; }
      }
      return { solid: solid, meshes: meshes, structure: structure, cut: cut, curved: curved, p: p, n: key.f.n, f: key.f, key: key, keyOpt: keyOpt, ego: ego, proj: proj };
    }
    return null;
  }
  // Corners not crowded together, and at most one corner per outline that could be read either way
  // (a turn 15–30° above the curvature around it).
  function clear(desc) {
    return desc.parts.every(function (q) { return q.corners - q.strong <= 1 && q.gap >= 0.03; });
  }
  // A joined solid's section must cross the joint: every part contributes a visible area.
  function crossesBoth(partMeshes, p, f) {
    for (var i = 0; i < partMeshes.length; i++) {
      var L = meshSection(partMeshes[i], p, f.n);
      if (!L || !L.length) return false;
      var A = 0;
      L.forEach(function (l) { A += Mth.abs(area2(l.map(function (q) { var r = sub(q, p); return [dot(r, f.u), dot(r, f.v)]; }))); });
      if (A < 0.12) return false;
    }
    return true;
  }

  /* ------------------------------------------------------------ options, foil pool and choice */
  var SMALL = 36; // grid of the shortcut checks; validation uses the 54-cell grid
  // An option: loops normalised for display, descriptors, rasters made when first needed; src and f
  // keep the unnormalised loops and their plane frame (to derive the egocentric view of a foil).
  function optionOf(kind, loops, f, nm, desc) {
    nm = nm || normalize(loops);
    return { kind: kind, loops: nm.loops, desc: desc || describe(nm.loops), src: loops, f: f, grid: null, small: null };
  }
  function gridOf(o) { return o.grid || (o.grid = rasterize(o.loops)); }
  function smallOf(o) { return o.small || (o.small = rasterize(o.loops, SMALL)); }
  // Generation compares rasters on the 36-cell grid with a margin (0.82) below the validator's 0.85
  // on the 54-cell grid.
  var SAME_SMALL = 0.82;
  function visiblyDifferent(a, b) { return distinct(a.desc, b.desc) && agreement(smallOf(a), smallOf(b)) <= SAME_SMALL; }
  function totalCorners(o) { var s = 0; o.desc.parts.forEach(function (q) { s += q.corners; }); return s; }

  // Outlines of the solid's parts as the viewer sees them. Every part is convex, so each outline is
  // the convex hull of the part's projected hull points.
  function partOutlines(solid, parts) {
    var R = solidRot(solid);
    return parts.map(function (p) {
      return hull(hullPoints(p).map(function (q) {
        var w = mvec(R, add(mvec(p.rot, q), p.pos));
        return [dot(w, VIEW.right), dot(w, VIEW.up)];
      }));
    });
  }
  // The silhouette (the outer solid's when embedded): the union of the parts' outlines, normalised
  // like an option and rasterised (M × M cells).
  function silhouetteGrid(solid, M) {
    M = M || GRID;
    var parts = solid.structure === 'embedded' ? [solid.parts[0]] : solid.parts;
    var nm = normalize(partOutlines(solid, parts)), g = new Uint8Array(M * M);
    nm.loops.forEach(function (l) { var h = rasterize([l], M); for (var i = 0; i < g.length; i++) if (h[i]) g[i] = 1; });
    return g;
  }
  // Overlap of two grids as shapes (inside any loop), intersection over union.
  function iou(g1, g2) {
    var both = 0, any = 0;
    for (var i = 0; i < g1.length; i++) if (g1[i] || g2[i]) { any++; if (g1[i] && g2[i]) both++; }
    return any ? both / any : 1;
  }

  // Shortcut picks over a set of options: the share of the pick that lands on set[0] (the key),
  // ties split evenly.
  // Values within tol of the best count as ties: a person cannot tell them apart.
  function pickShare(scores, keyIdx, better, tol) {
    var best = null, ties = 0, i;
    tol = tol || 1e-9;
    for (i = 0; i < scores.length; i++) if (best === null || better(scores[i], best) > 0) best = scores[i];
    for (i = 0; i < scores.length; i++) if (better(best, scores[i]) <= tol) ties++;
    return better(best, scores[keyIdx]) <= tol ? 1 / ties : 0;
  }
  var HIGH = function (a, b) { return a - b; }, LOW = function (a, b) { return b - a; };
  var SHORTCUTS = ['corners', 'silhouette', 'likeOthers', 'rasterLike', 'twin', 'roundest', 'fullest'];
  // Per-option values and pairwise tables over the pool (pool[0] key, pool[1] egocentric foil).
  function shortcutTables(pool, silSmall) {
    var n = pool.length, T = { corn: [], sil: [], round: [], fill: [], d: [], ag: [] }, i, j;
    for (i = 0; i < n; i++) {
      T.corn.push(totalCorners(pool[i])); T.sil.push(iou(smallOf(pool[i]), silSmall)); T.round.push(pool[i].desc.parts[0].aspect);
      T.fill.push(pool[i].desc.parts[0].fill);
      T.d.push(new Array(n)); T.ag.push(new Array(n));
    }
    for (i = 0; i < n; i++) {
      for (j = i; j < n; j++) {
        T.d[i][j] = T.d[j][i] = i === j ? 0 : ddist(pool[i].desc, pool[j].desc);
        T.ag[i][j] = T.ag[j][i] = i === j ? 1 : agreement(smallOf(pool[i]), smallOf(pool[j]));
      }
    }
    return T;
  }
  // The cheap solvers of SHORTCUTS on a set of pool indices (set[0] = the key): most corners; most
  // like the silhouette; most like the others by descriptors; most like the others by rasters; the
  // option with the closest twin; the roundest and the fullest (most rectangular) outline (the
  // "stereotyping" error, Tsutsumi 2013).
  function shortcutShares(set, T) {
    var n = set.length, corn = [], sil = [], dsum = [], asum = [], twin = [], round = [], fill = [];
    for (var i = 0; i < n; i++) {
      var a = set[i], ds = 0, as = 0, tw = INF;
      corn.push(T.corn[a]); sil.push(T.sil[a]); round.push(T.round[a]); fill.push(T.fill[a]);
      for (var j = 0; j < n; j++) {
        if (i === j) continue;
        var d = T.d[a][set[j]];
        ds += d; as += T.ag[a][set[j]]; if (d < tw) tw = d;
      }
      dsum.push(ds); asum.push(as); twin.push(tw);
    }
    var dt = 0.03 * Mth.max.apply(null, dsum), tt = 0.03 * Mth.max.apply(null, twin);
    return [pickShare(corn, 0, HIGH), pickShare(sil, 0, HIGH, TIE.sil), pickShare(dsum, 0, LOW, dt), pickShare(asum, 0, HIGH, TIE.raster),
      pickShare(twin, 0, LOW, tt), pickShare(round, 0, HIGH, TIE.aspect), pickShare(fill, 0, HIGH, TIE.fill)];
  }
  // Balancing of the shortcut solvers: per item, solver k is set to pick the key with probability
  // BAL.t[k] and the foil pair is chosen to match, weighting misses by BAL.w[k]. The targets are
  // calibrated (30 Oct, 1 080 items over all levels) so that each solver lands on the key about one
  // time in four over the pool: items where a solver cannot be stopped from picking the key (a
  // square or circular key is always among the roundest) are offset by lower targets elsewhere.
  var BAL = { t: [0.3, 0.18, 0.05, 0.15, 0.15, 0, 0.05], w: [1.5, 2, 3, 1, 1, 4, 2] };
  // Tie tolerances of the shortcut solvers (IoU, summed raster agreement, aspect ratio); the
  // descriptor distances tie within 3 % of the largest.
  var TIE = { sil: 0.03, raster: 0.03, aspect: 0.06, fill: 0.03 };

  function generateOnce(rng, params) {
    var memo = {}, pr = makeProblem(rng.fork('problem'), params, memo);
    if (!pr) return why('problem');
    var r2 = rng.fork('foils'), nLoops = pr.structure === 2 ? 2 : 1, R = solidRot(pr.solid);
    // The foil pool: options visibly different from the key, the egocentric foil and each other.
    var pool = [pr.keyOpt, pr.ego];
    function admit(o) {
      if (!o || !clear(o.desc)) return false;
      if (o.desc.parts[0].aspect < 0.2) return false;
      for (var i = 0; i < pool.length; i++) if (!distinct(o.desc, pool[i].desc)) return false;
      for (i = 0; i < pool.length; i++) if (agreement(smallOf(o), smallOf(pool[i])) > SAME_SMALL) return false;
      pool.push(o);
      return true;
    }
    // The outline the solid presents to the viewer (MCT "answers that look like projections");
    // convex solids only, with the inner solid's outline inside for embedded ones.
    if (pr.proj) admit(pr.proj);
    // Neighbouring problems: the same solid cut through the same point at other angles, related
    // solids cut by the same plane; each followed by its egocentric view.
    var cuts = r2.shuffle(neighbourNormals(r2, pr.structure)).slice(0, 9), sols = r2.shuffle(relatedSolids(pr.solid, r2.fork('related'))).slice(0, 5);
    for (var q = 0; q < Mth.max(cuts.length, sols.length) && pool.length < 9; q++) {
      var o = null;
      if (q < sols.length) {
        var s2 = sols[q], c = cutSolid(s2, solidMeshes(s2, memo), pr.p, pr.n, s2.structure === 'embedded' ? 2 : 1, 0.06);
        if (c) { o = optionOf('solid', c.loops, c.f, c.norm, c.desc); o.solid = s2; }
        if (admit(o)) { var e = optionOf('solid-ego', egoLoops(c.loops, c.f), null); e.solid = s2; admit(e); }
      }
      if (q < cuts.length) {
        var n = unit(mvec(R, cuts[q]));
        if (Mth.abs(dot(n, pr.n)) > 0.985) continue; // the key's own cut
        var c2 = cutSolid(pr.solid, pr.meshes, pr.p, n.map(function (x) { return Mth.round(x * 1e6) / 1e6; }), nLoops, 0.06);
        o = c2 ? optionOf('cut', c2.loops, c2.f, c2.norm, c2.desc) : null;
        if (o) o.n = c2.f.n;
        if (admit(o)) { var e2 = optionOf('cut-ego', egoLoops(c2.loops, c2.f), null); e2.n = c2.f.n; admit(e2); }
      }
    }
    if (pool.length < 4) return why('foils:few');
    // Shortcut targets, drawn per item: each cheap solver should land on the key one time in four
    // over the pool, so the pair of foils is chosen to make each solver pick the key (or not) as drawn.
    var T = shortcutTables(pool, silhouetteGrid(pr.solid, SMALL)), want = [], k;
    for (k = 0; k < SHORTCUTS.length; k++) want.push(r2.chance(BAL.t[k]) ? 1 : 0);
    var idx = r2.shuffle(pool.map(function (_, i) { return i; }).slice(2)), pairs = [];
    for (var a = 0; a < idx.length; a++) {
      for (var b = a + 1; b < idx.length; b++) {
        var sh = shortcutShares([0, 1, idx[a], idx[b]], T), score = pool[idx[a]].kind === pool[idx[b]].kind ? 0.1 : 0;
        for (k = 0; k < sh.length; k++) score += BAL.w[k] * Mth.abs(sh[k] - want[k]);
        pairs.push({ set: [0, 1, idx[a], idx[b]], score: score, order: pairs.length });
      }
    }
    pairs.sort(function (x, y) { return x.score - y.score || x.order - y.order; });
    // The best pair whose four options also differ on the validator's 54-cell grid.
    var best = null;
    for (var pi = 0; pi < pairs.length && !best; pi++) {
      var st = pairs[pi].set, okSet = true;
      for (var u = 0; u < 4 && okSet; u++) for (var w = u + 1; w < 4 && okSet; w++) if (agreement(gridOf(pool[st[u]]), gridOf(pool[st[w]])) > 0.85) okSet = false;
      if (okSet) best = st;
    }
    if (!best) return why('foils:pair');
    if (stats.bal) {
      var shb = shortcutShares(best, T);
      for (k = 0; k < shb.length; k++) { stats.bal.got[k] += shb[k]; stats.bal.want[k] += want[k]; stats.bal.miss[k] += Mth.abs(shb[k] - want[k]); }
      stats.bal.n++;
    }
    var perm = r2.shuffle([0, 1, 2, 3]), options = perm.map(function (i) { return pool[best[i]]; });
    return assemble(pr, options, perm.indexOf(0), params);
  }

  function assemble(pr, options, keyIdx, params) {
    var f = pr.f, bbC = mvec(solidRot(pr.solid), solidCentre(pr.solid));
    var c = sub(bbC, mul(f.n, dot(sub(bbC, pr.p), f.n)));
    var rad = 0;
    pr.meshes.forEach(function (m) { for (var i = 0; i < m.V.length; i += 3) { var d = len(sub([m.V[i], m.V[i + 1], m.V[i + 2]], bbC)); if (d > rad) rad = d; } });
    var far = 0;
    pr.meshes.forEach(function (m) { for (var i = 0; i < m.V.length; i += 3) { var d = dot(sub([m.V[i], m.V[i + 1], m.V[i + 2]], pr.p), f.n); if (d > far) far = d; } });
    var r6 = function (v) { return v.map(function (x) { return Mth.round(x * 1e6) / 1e6; }); };
    var r4 = function (v) { return v.map(function (x) { return Mth.round(x * 1e4) / 1e4; }); };
    return {
      ex: 'slice', params: params, key: keyIdx,
      solid: pr.solid,
      plane: { p: pr.p, n: r6(f.n), c: r4(c), half: rnd(rad * 1.2, 3) },
      frame: { u: r6(f.u), v: r6(f.v), az: rnd(f.az, 3), el: rnd(f.el, 3) },
      view: { dir: r6(VIEW.dir), right: r6(VIEW.right), up: r6(VIEW.up) },
      norm: { cx: rnd(pr.key.norm.cx, 6), cy: rnd(pr.key.norm.cy, 6), s: rnd(pr.key.norm.s, 6) },
      sweep: { from: r4(add(pr.p, mul(f.n, far + 0.25))), to: pr.p.slice() },
      options: options.map(function (o) {
        var out = { kind: o.kind, loops: o.loops };
        if (o.n) out.n = r6(o.n);
        if (o.solid) out.solid = o.solid;
        return out;
      }),
    };
  }

  /* ------------------------------------------------------------ validate (independent of the mesh) */
  // Nesting depth of the true solid sampled at the option grid's cell centres, mapped through the
  // key's normalisation onto the cutting plane.
  function sampleSection(item, M, Rg) {
    M = M || GRID; Rg = Rg || GRID_R;
    var solid = item.solid, R = solidRot(solid), p = item.plane.p, u = item.frame.u, v = item.frame.v, nm = item.norm;
    // Per part: local = A·(world) − rotᵀ·pos with A = (R·rot)ᵀ, so along the plane
    // local = o + du·a + dv·b for in-plane coordinates (a, b).
    var maps = solid.parts.map(function (q) {
      var A = mmul(R, q.rot), o = sub(mtvec(A, p), mtvec(q.rot, q.pos));
      return { q: q, o: o, du: mtvec(A, u), dv: mtvec(A, v) };
    });
    var joined = solid.structure === 'joined', S = new Uint8Array(M * M), cell = 2 * Rg / M;
    for (var r = 0; r < M; r++) {
      var b = (-Rg + GRID_OFF + (r + 0.5) * cell) / nm.s + nm.cy;
      for (var c = 0; c < M; c++) {
        var a = (-Rg + GRID_OFF + (c + 0.5) * cell) / nm.s + nm.cx, d = 0;
        for (var k = 0; k < maps.length; k++) {
          var m = maps[k];
          if (insideXYZ(m.q, m.o[0] + m.du[0] * a + m.dv[0] * b, m.o[1] + m.du[1] * a + m.dv[1] * b, m.o[2] + m.du[2] * a + m.dv[2] * b)) d++;
        }
        S[r * M + c] = joined ? (d > 0 ? 1 : 0) : d;
      }
    }
    return S;
  }
  // Number of connected regions of cells with lo ≤ depth ≤ hi (8-neighbour, or 4-neighbour with four).
  function components(S, M, lo, hi, four) {
    var seen = new Uint8Array(S.length), stack = new Int32Array(S.length), n = 0;
    for (var i = 0; i < S.length; i++) {
      if (seen[i] || S[i] < lo || S[i] > hi) continue;
      n++; seen[i] = 1;
      var top = 0;
      stack[top++] = i;
      while (top) {
        var k = stack[--top], r = (k / M) | 0, c = k - r * M;
        for (var dr = -1; dr <= 1; dr++) {
          var rr = r + dr;
          if (rr < 0 || rr >= M) continue;
          for (var dc = -1; dc <= 1; dc++) {
            if ((!dr && !dc) || (four && dr && dc)) continue;
            var cc = c + dc, q = rr * M + cc;
            if (cc < 0 || cc >= M || seen[q] || S[q] < lo || S[q] > hi) continue;
            seen[q] = 1; stack[top++] = q;
          }
        }
      }
    }
    return n;
  }
  function isVec(a) { return isArr(a) && a.length === 3 && a.every(function (x) { return typeof x === 'number' && isFin(x); }); }
  function isLoops(L) {
    return isArr(L) && L.length >= 1 && L.every(function (l) {
      return isArr(l) && l.length >= 3 && l.every(function (q) { return isArr(q) && q.length === 2 && isFin(q[0]) && isFin(q[1]) && Mth.abs(q[0]) <= 1.0001 && Mth.abs(q[1]) <= 1.0001; });
    });
  }

  function validate(item) {
    if (!item || !isArr(item.options) || item.options.length !== 4) return 'needs 4 options';
    if (!(Number.isInteger(item.key) && item.key >= 0 && item.key < 4)) return 'key out of range';
    if (!item.solid || !isArr(item.solid.parts) || !item.solid.parts.length) return 'no solid';
    if (!item.plane || !isVec(item.plane.p) || !isVec(item.plane.n) || !item.frame || !isVec(item.frame.u) || !isVec(item.frame.v)) return 'no plane';
    if (!item.norm || !(item.norm.s > 0)) return 'no normalisation';
    for (var i = 0; i < 4; i++) if (!isLoops(item.options[i].loops)) return 'option ' + i + ' has malformed loops';
    var n = item.plane.n, u = item.frame.u, v = item.frame.v;
    if (Mth.abs(len(n) - 1) > 1e-4 || Mth.abs(len(u) - 1) > 1e-4 || Mth.abs(len(v) - 1) > 1e-4) return 'the plane frame is not unit length';
    if (Mth.abs(dot(n, u)) > 1e-4 || Mth.abs(dot(n, v)) > 1e-4 || Mth.abs(dot(u, v)) > 1e-4) return 'the plane frame is not orthogonal';
    if (len(sub(cross(u, v), n)) > 1e-3) return 'the plane frame is not right-handed';
    if (dot(n, VIEW.dir) <= 0) return 'the plane is drawn from behind';
    if (Mth.abs(n[0]) + Mth.abs(n[2]) > 1e-6 && Mth.abs(u[1]) > 1e-4) return 'the head-on view is rolled';

    var keyOpt = item.options[item.key], nLoops = item.solid.structure === 'embedded' ? 2 : 1;
    if (keyOpt.loops.length !== nLoops) return 'the key has ' + keyOpt.loops.length + ' loops, the solid gives ' + nLoops;
    var M = GRID, cell = 2 * GRID_R / M, S = sampleSection(item);
    var grids = item.options.map(function (o) { return rasterize(o.loops); });
    // The key is the sampled section; no other option is.
    var agree = grids.map(function (g) { return agreement(S, g); });
    if (agree[item.key] < 0.92) return 'the key does not match the sampled section (' + agree[item.key].toFixed(3) + ')';
    for (i = 0; i < 4; i++) if (i !== item.key && agree[i] >= 0.9) return 'option ' + i + ' also matches the sampled section';
    // Areas and loop counts from the samples.
    var c1 = 0, c2 = 0;
    for (i = 0; i < S.length; i++) { if (S[i] >= 1) c1++; if (S[i] >= 2) c2++; }
    // Sampling error grows with the outline: allow 1 % of the area plus half a cell along the perimeter.
    var loopsBy = keyOpt.loops.slice().sort(function (a, b) { return Mth.abs(area2(b)) - Mth.abs(area2(a)); });
    var tol = function (l) { return 0.01 * Mth.abs(area2(l)) + 0.5 * cell * perimeter(l); };
    if (Mth.abs(c1 * cell * cell - Mth.abs(area2(loopsBy[0]))) > tol(loopsBy[0])) return 'the key\'s area differs from the sampled area';
    if (nLoops === 2 && Mth.abs(c2 * cell * cell - Mth.abs(area2(loopsBy[1]))) > tol(loopsBy[1])) return 'the inner loop\'s area differs from the sampled area';
    if (components(S, M, 1, 255) !== 1) return 'the sampled section is not one region';
    if (components(S, M, 2, 255) !== nLoops - 1) return 'the sampled section has the wrong number of inner regions';
    if (components(S, M, 0, 0, true) !== 1) return 'the sampled section has a hole';
    if (nLoops === 2) { // nested with a visible gap: no inner cell touches the outside
      for (i = 0; i < S.length; i++) {
        if (S[i] !== 2) continue;
        var r = (i / M) | 0, c = i % M;
        for (var dr = -1; dr <= 1; dr++) for (var dc = -1; dc <= 1; dc++) {
          var rr = r + dr, cc = c + dc;
          if (rr < 0 || cc < 0 || rr >= M || cc >= M || S[rr * M + cc] === 0) return 'the inner outline touches the outer one';
        }
      }
    }
    // The egocentric foil is the key as it appears on the screen.
    var egos = [];
    item.options.forEach(function (o, k) { if (o.kind === 'ego') egos.push(k); });
    if (egos.length !== 1 || egos[0] === item.key || keyOpt.kind !== 'key') return 'needs exactly one egocentric foil and a key';
    var egoGrid = rasterize(normalize(egoLoops(keyOpt.loops, { u: u, v: v })).loops);
    if (agreement(egoGrid, grids[egos[0]]) < 0.9) return 'the egocentric foil is not the key seen on the screen';
    // Options pairwise visibly different.
    var descs = item.options.map(function (o) { return describe(o.loops); });
    for (i = 0; i < 4; i++) for (var j = i + 1; j < 4; j++) {
      if (!distinct(descs[i], descs[j])) return 'options ' + i + ' and ' + j + ' have the same descriptors';
      if (agreement(grids[i], grids[j]) > 0.85) return 'options ' + i + ' and ' + j + ' look alike';
    }
    return true;
  }

  function score(item, response) { return { correct: response === item.key }; }

  /* ------------------------------------------------------------ generate */
  var stats = { tries: 0, nulls: 0, errors: 0, invalid: 0, fallbacks: 0, lastError: null, lastInvalid: null, why: {} };
  function why(reason) { stats.why[reason] = (stats.why[reason] || 0) + 1; return null; }
  function attempt(r, params) {
    stats.tries++;
    var item = null;
    try { item = generateOnce(r, params); } catch (e) { stats.errors++; stats.lastError = String(e && e.stack || e); return null; }
    if (!item) { stats.nulls++; return null; }
    var ok = validate(item);
    if (ok !== true) { stats.invalid++; stats.lastInvalid = ok; return null; }
    return item;
  }
  function cleanParams(params) {
    return { structure: lvl(params, 'structure', 3), cut: lvl(params, 'cut', 3), curved: lvl(params, 'curved', 2) };
  }
  function generate(rng, params) {
    var p = cleanParams(params), item = null;
    for (var i = 0; i < 50 && !item; i++) item = attempt(i === 0 ? rng : rng.fork('retry' + i), p);
    if (!item) item = fallback(p);
    item.seed = rng.seed;
    item.params = params ? PX.util.deepCopy(params) : p;
    return item;
  }
  // Fixed seeds per params (tested for every combination); then the easiest problem.
  function fallback(p) {
    stats.fallbacks++;
    var tries = [p, { structure: 0, cut: 0, curved: 0 }];
    for (var t = 0; t < tries.length; t++) {
      for (var k = 0; k < 200; k++) {
        var item = attempt(PX.rng(PX.rng.hash('slice-fallback', tries[t].structure, tries[t].cut, tries[t].curved, k)), tries[t]);
        if (item) return item;
      }
    }
    throw new Error('slice: no valid item could be built'); // unreachable while the fallback test passes
  }

  PX.ex.define({
    id: 'slice', version: 1, code: 'EX-06', name: 'Cross-sections', short: 'Slice',
    abilities: ['Vz'], cell: 'intrinsic-dynamic', role: 'train', answer: 'choice', nOptions: 4,
    // Steps document the main effects; difficulty() below adds the interactions (see DIFF).
    dims: [
      { key: 'structure', label: 'Structure', levels: ['simple', 'joined', 'embedded'], step: 0.4 },
      { key: 'cut', label: 'Cut', levels: ['orthogonal', 'oblique', 'double oblique'], step: 1.3 },
      { key: 'curved', label: 'Curved solid', levels: ['no', 'yes'], step: 0.75 },
    ],
    base: DIFF.base,
    difficulty: difficulty,
    generate: generate,
    validate: validate,
    score: score,
    lib: {
      VIEW: VIEW, DIFF: DIFF, GRID: GRID, GRID_R: GRID_R, stats: stats,
      sincos: sincos, atan2: atan2, solidRot: solidRot, solidMeshes: solidMeshes, primitiveMesh: primitiveMesh,
      meshSection: meshSection, planeFrame: planeFrame, sectionOf: sectionOf, flatLoops: flatLoops,
      normalize: normalize, describe: describe, distinct: distinct, ddist: ddist, obb: obb, hull: hull, area2: area2,
      rasterize: rasterize, agreement: agreement, iou: iou, silhouetteGrid: silhouetteGrid, egoLoops: egoLoops, partOutlines: partOutlines,
      SMALL: SMALL, SHORTCUTS: SHORTCUTS, TIE: TIE, BAL: BAL, shortcutShares: shortcutShares, pickShare: pickShare, hullPoints: hullPoints,
      depthAt: depthAt, insidePrim: insidePrim, sampleSection: sampleSection, components: components,
      generateOnce: generateOnce, fallback: fallback, featurePoints: featurePoints, relatedSolids: relatedSolids,
    },
  });
})(window.PX);
