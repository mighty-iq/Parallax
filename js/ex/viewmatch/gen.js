/* PR-2 View Match (probe): which picture shows the tabletop scene from the flag?
   Pure (ARCHITECTURE.md §5); PLAN.md §4; research/B-tasks.md §5 and §14b (P2). Never trained, no feedback.

   Task. A round table with 3–5 distinct simple objects is seen from above at an angle (the default view,
   from the viewer's side of the table). A flag on the table edge marks a camera position. Four pictures
   show the scene from four camera positions around the table; the key is the one from the flag. Foils
   are other positions: never a mirrored picture, never a tiny shift (at least MIN_SEP° away), and every
   picture differs from every other in the left-to-right order or the occlusion of some pair of objects.
   key: index of the right option (0–3).

   World (three.js convention): y up; the table top is the disc y = 0, radius TABLE_R; the default view
   looks from +z toward −z, so +x is to the viewer's right. An azimuth az (degrees) is the direction
   (sin az, 0, cos az): az 0 = the viewer's side, +90 = the right side, ±180 = the far side.
   Cameras (copied into each item, so a later change cannot alter an old item):
     camera (options): position (dist sin az, height, dist cos az), looking at target, vertical fov in
                       degrees, square picture (aspect 1), world up +y
     stem (default):   position (0, dist sin elev, dist cos elev), looking at target, vertical fov, aspect 1
   Objects { id, shape, color, size, x, z, yaw, s, h } stand on the table at (x, 0, z). Within a scene the
   shapes all differ, and so do the colours (colour is never the only cue):
     cube      side 2s, height h = 2s, turned by yaw (degrees, about +y; local x → (cos, sin) in (x, z))
     pyramid   square base 2s turned by yaw, apex at height h
     cylinder  radius s, height h          cone  base radius s, apex at height h
     sphere    radius s, centre (x, s, z) (h = 2s)
   The flag stands on the rim at (TABLE_R sin az, 0, TABLE_R cos az), az = flag.az; its top (FLAG_H high)
   is never hidden in the stem picture.

   Item (JSON):
     { ex: 'viewmatch', seed, params, key, table: { r }, camera: {…}, stem: {…},
       objects: [{ id, shape, color, size, x, z, yaw, s, h }], flag: { az }, options: [{ az }] }

   Generator: azimuths first (the flag in its angle band, the nearest foil in its gap band, with EGO_P a
   foil nearer the default view than the flag, the rest anywhere at least that far from the flag), then
   objects one at a time, each kept only if it leaves every object at least VIS_MIN visible in every
   option (STEM_VIS in the stem). Views are compared on projected convex hulls (exact corners, dense
   rings for curved solids): a pair is occluding when the hulls overlap by ≥ OCC_ON of the smaller one
   (the nearer object is the one on the camera's side of the vertical plane between the footprints),
   apart when the hulls are ≥ OCC_GAP apart, doubtful otherwise; an order counts when the centres are ≥
   ORDER_GAP apart in both views.
   Shortcuts: a foil nearer the default view than the flag (EGO_P) makes the egocentric pick fail; azimuth
   sets are drawn against targets for the flag's place among the options (pickAzimuths); and an item whose
   stem-blind odd one out is the key is redrawn with chance ODD_REJECT. Left in by geometry: with all
   foils 80°+ away the flag at about 45° is the option nearest the default view, and at about 160° the
   farthest (tests/node/viewmatch.test.mjs reports both per level).
   validate (independent of the hulls): casts rays through a GRID × GRID picture of every option and of
   the stem (an ID buffer with exact ray–solid intersections), and from the pixels checks visibility,
   framing, left-to-right order and occlusion, and that the options differ as above and none is the key
   mirrored; then the geometry of the level (flag angle, nearest-foil gap, objects, spacing). */
(function (PX) {
  'use strict';

  /* ------------------------------------------------------------------ deterministic maths */
  // Only + − × ÷ and Math.sqrt (correctly rounded): Math.sin and Math.cos may differ in the last bit
  // between engines, and the same seed must give the same item everywhere. Globals are cached because a
  // lookup of Math or Infinity in hot loops is about 100× slower in the tests' vm context.
  var sqrt = Math.sqrt, abs = Math.abs, min = Math.min, max = Math.max, round = Math.round, floor = Math.floor, ceil = Math.ceil;
  var INF = Infinity, SQRT2 = Math.SQRT2;
  var DEG = Math.PI / 180;
  function sincos(deg) {   // [sin, cos] of an angle in degrees
    var q = round(deg / 90), y = (deg - q * 90) * DEG, y2 = y * y;
    var s = y * (1 - y2 / 6 * (1 - y2 / 20 * (1 - y2 / 42 * (1 - y2 / 72 * (1 - y2 / 110 * (1 - y2 / 156))))));
    var c = 1 - y2 / 2 * (1 - y2 / 12 * (1 - y2 / 30 * (1 - y2 / 56 * (1 - y2 / 90 * (1 - y2 / 132)))));
    q = ((q % 4) + 4) % 4;
    return q === 0 ? [s, c] : q === 1 ? [c, -s] : q === 2 ? [-s, -c] : [-c, s];
  }
  function sub(a, b) { return [a[0] - b[0], a[1] - b[1], a[2] - b[2]]; }
  function dot(a, b) { return a[0] * b[0] + a[1] * b[1] + a[2] * b[2]; }
  function cross(a, b) { return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]; }
  function unit(a) { var l = sqrt(dot(a, a)); return [a[0] / l, a[1] / l, a[2] / l]; }
  function rnd3(x) { return round(x * 1000) / 1000; }
  function sep(a, b) { var d = (((a - b) % 360) + 360) % 360; return d > 180 ? 360 - d : d; }   // 0–180
  function wrap(a) { var d = (((a + 180) % 360) + 360) % 360 - 180; return d === -180 ? 180 : d; }

  /* ------------------------------------------------------------------ scene and cameras */
  var TABLE_R = 1;
  var RIM = 0.9;           // every footprint stays inside this radius
  var SPACING = 0.1;       // gap between footprints (validate accepts ≥ SPACING / 2)
  var SHAPES = ['cube', 'cylinder', 'cone', 'sphere', 'pyramid'];
  var COLORS = ['red', 'blue', 'yellow', 'green', 'purple'];
  var SIZES = ['small', 'medium', 'large'];
  var HALF = { small: 0.11, medium: 0.14, large: 0.175 };
  var TALL = { cube: 2, pyramid: 2.3, cylinder: 2.6, cone: 2.8, sphere: 2 };
  var CAMERA = { dist: 2.8, height: 0.9, target: [0, 0.12, 0], fov: 46, aspect: 1 };
  var STEM = { elev: 55, dist: 3.6, target: [0, 0, 0], fov: 40, aspect: 1 };
  var OBJECT_LEVELS = [3, 4, 5];
  var ANGLE_BINS = [[38, 52], [68, 82], [98, 112], [128, 142], [150, 165]];  // |flag azimuth|
  var NEAR_BINS = [[80, 110], [55, 75], [35, 50]];   // gap from the flag to the nearest foil: far, mid, near
  var MIN_SEP = 35;
  var EGO_P = 0.75, ODD_REJECT = 0.5;
  var ORDER_GAP = 0.08, OCC_ON = 0.15, OCC_GAP = 0.03, VIS_MIN = 0.55, STEM_VIS = 0.9, FRAME_IN = 0.94;

  function footprint(o) { return o.shape === 'cube' || o.shape === 'pyramid' ? o.s * SQRT2 : o.s; }
  function lookAt(pos, target, fov) {
    var f = unit(sub(target, pos)), r = unit(cross(f, [0, 1, 0])), u = cross(r, f), h = sincos(fov / 2);
    return { pos: pos, f: f, r: r, u: u, k: h[1] / h[0] };   // k = 1 / tan(fov / 2)
  }
  function optionCam(cam, az) { var a = sincos(az); return lookAt([cam.dist * a[0], cam.height, cam.dist * a[1]], cam.target, cam.fov); }
  function stemCam(st) { var e = sincos(st.elev); return lookAt([0, st.dist * e[0], st.dist * e[1]], st.target, st.fov); }
  function project(cam, p) {
    var dx = p[0] - cam.pos[0], dy = p[1] - cam.pos[1], dz = p[2] - cam.pos[2], f = cam.f, r = cam.r, u = cam.u;
    var z = dx * f[0] + dy * f[1] + dz * f[2];
    return [(dx * r[0] + dy * r[1] + dz * r[2]) / z * cam.k, (dx * u[0] + dy * u[1] + dz * u[2]) / z * cam.k, z];
  }
  // Local (x, z) of the object turned by yaw → world (x, z).
  function toWorld(o, lx, lz) { var a = sincos(o.yaw); return [o.x + lx * a[1] - lz * a[0], o.z + lx * a[0] + lz * a[1]]; }

  // Points on the surface whose projections span the silhouette.
  var RING24 = [], RING16 = [], LAT = [];
  (function () {
    for (var i = 0; i < 24; i++) RING24.push(sincos(i * 15));
    for (i = 0; i < 16; i++) RING16.push(sincos(i * 22.5));
    for (i = -2; i <= 2; i++) LAT.push(sincos(i * 30));
  })();
  function surfacePoints(o) {
    var s = o.s, h = o.h, pts = [], i, j;
    if (o.shape === 'cube' || o.shape === 'pyramid') {
      [[-s, -s], [s, -s], [s, s], [-s, s]].forEach(function (c) {
        var w = toWorld(o, c[0], c[1]);
        pts.push([w[0], 0, w[1]]);
        if (o.shape === 'cube') pts.push([w[0], h, w[1]]);
      });
      if (o.shape === 'pyramid') pts.push([o.x, h, o.z]);
    } else if (o.shape === 'sphere') {
      for (i = 0; i < 16; i++) for (j = 0; j < LAT.length; j++) pts.push([o.x + s * LAT[j][1] * RING16[i][1], s + s * LAT[j][0], o.z + s * LAT[j][1] * RING16[i][0]]);
      pts.push([o.x, 0, o.z], [o.x, 2 * s, o.z]);
    } else {
      for (i = 0; i < 24; i++) {
        pts.push([o.x + s * RING24[i][1], 0, o.z + s * RING24[i][0]]);
        if (o.shape === 'cylinder') pts.push([o.x + s * RING24[i][1], h, o.z + s * RING24[i][0]]);
      }
      if (o.shape === 'cone') pts.push([o.x, h, o.z]);
    }
    return pts;
  }

  /* ------------------------------------------------------------------ 2D polygons */
  function crs(o, a, b) { return (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]); }
  function hull(pts) {   // counter-clockwise convex hull (monotone chain)
    var p = pts.slice().sort(function (a, b) { return a[0] - b[0] || a[1] - b[1]; }), lo = [], up = [], i;
    for (i = 0; i < p.length; i++) { while (lo.length > 1 && crs(lo[lo.length - 2], lo[lo.length - 1], p[i]) <= 0) lo.pop(); lo.push(p[i]); }
    for (i = p.length - 1; i >= 0; i--) { while (up.length > 1 && crs(up[up.length - 2], up[up.length - 1], p[i]) <= 0) up.pop(); up.push(p[i]); }
    lo.pop(); up.pop();
    return lo.concat(up);
  }
  function area(poly) {
    var a = 0;
    for (var i = 0; i < poly.length; i++) { var p = poly[i], q = poly[(i + 1) % poly.length]; a += p[0] * q[1] - q[0] * p[1]; }
    return a / 2;
  }
  function clip(a, b) {   // the part of convex polygon a inside convex polygon b (Sutherland–Hodgman)
    var out = a;
    for (var i = 0; i < b.length && out.length; i++) {
      var p = b[i], q = b[(i + 1) % b.length], inp = out;
      out = [];
      for (var j = 0; j < inp.length; j++) {
        var c = inp[j], d = inp[(j + 1) % inp.length], sc = crs(p, q, c), sd = crs(p, q, d);
        if (sc >= 0) out.push(c);
        if ((sc >= 0) !== (sd >= 0)) { var t = sc / (sc - sd); out.push([c[0] + t * (d[0] - c[0]), c[1] + t * (d[1] - c[1])]); }
      }
    }
    return out;
  }
  function overlap(a, b) { var c = clip(a, b); return c.length > 2 ? area(c) : 0; }
  function insidePoly(poly, x, y) {
    for (var i = 0, n = poly.length; i < n; i++) {
      var p = poly[i], q = poly[(i + 1) % n];
      if ((q[0] - p[0]) * (y - p[1]) - (q[1] - p[1]) * (x - p[0]) < 0) return false;
    }
    return true;
  }
  function segDist(p, a, b) {
    var dx = b[0] - a[0], dy = b[1] - a[1], L = dx * dx + dy * dy, t = L ? ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / L : 0;
    t = t < 0 ? 0 : t > 1 ? 1 : t;
    var ex = a[0] + t * dx - p[0], ey = a[1] + t * dy - p[1];
    return sqrt(ex * ex + ey * ey);
  }
  function gap(a, b) {   // distance between two disjoint convex polygons
    var m = INF, i, j;
    for (i = 0; i < a.length; i++) for (j = 0; j < b.length; j++) {
      m = min(m, segDist(a[i], b[j], b[(j + 1) % b.length]), segDist(b[j], a[i], a[(i + 1) % a.length]));
    }
    return m;
  }
  function framed(poly, lim) {
    for (var i = 0; i < poly.length; i++) if (abs(poly[i][0]) > lim || abs(poly[i][1]) > lim) return false;
    return true;
  }
  function box(poly) {
    var b = [INF, INF, -INF, -INF];
    for (var i = 0; i < poly.length; i++) { b[0] = min(b[0], poly[i][0]); b[1] = min(b[1], poly[i][1]); b[2] = max(b[2], poly[i][0]); b[3] = max(b[3], poly[i][1]); }
    return b;
  }
  function boxesNear(a, b, m) { return a[0] <= b[2] + m && b[0] <= a[2] + m && a[1] <= b[3] + m && b[1] <= a[3] + m; }

  /* ------------------------------------------------------------------ hull descriptors (generator) */
  // a is in front of b seen from pos: pos lies on a's side of the vertical plane halfway across the gap
  // between their footprints (both convex and apart, so the order is the same along every ray).
  function inFront(a, b, pos) {
    var dx = b.x - a.x, dz = b.z - a.z, L = sqrt(dx * dx + dz * dz), nx = dx / L, nz = dz / L;
    var fa = footprint(a), m = fa + (L - fa - footprint(b)) / 2;
    return (pos[0] - (a.x + nx * m)) * nx + (pos[2] - (a.z + nz * m)) * nz < 0;
  }
  function pairKey(a, b) { return a < b ? a + '|' + b : b + '|' + a; }
  function hullOf(o, cam) { return hull(surfacePoints(o).map(function (p) { return project(cam, p); })); }
  function orderOf(objs, d) { return objs.map(function (o) { return o.id; }).sort(function (a, b) { return d.x[a] - d.x[b]; }); }
  // Per view: centre x of each object, pair status ('a>b' occluding, 'apart', '?' doubtful), visible share.
  function describe(objs, cam, hulls, noVis) {
    hulls = hulls || objs.map(function (o) { return hullOf(o, cam); });
    var n = objs.length, areas = hulls.map(area), boxes = hulls.map(box), front = [], d = { x: {}, pairs: {}, vis: {}, frame: true, order: null }, i, j;
    for (i = 0; i < n; i++) {
      d.x[objs[i].id] = project(cam, [objs[i].x, objs[i].h / 2, objs[i].z])[0];
      if (!framed(hulls[i], FRAME_IN)) d.frame = false;
      front.push([]);
      for (j = 0; j < n; j++) front[i].push(i !== j && inFront(objs[i], objs[j], cam.pos));
    }
    for (i = 0; i < n; i++) for (j = i + 1; j < n; j++) {
      var near = boxesNear(boxes[i], boxes[j], OCC_GAP), ov = near ? overlap(hulls[i], hulls[j]) : 0, f = front[i][j] ? i : j, b = f === i ? j : i;
      d.pairs[pairKey(objs[i].id, objs[j].id)] = ov >= OCC_ON * min(areas[i], areas[j]) ? objs[f].id + '>' + objs[b].id
        : ov === 0 && (!near || gap(hulls[i], hulls[j]) >= OCC_GAP) ? 'apart' : '?';
    }
    for (i = 0; i < n && !noVis; i++) {   // visible share, sampled on a 9 × 9 grid over the silhouette's box
      var H = hulls[i], B = boxes[i], inside = 0, seen = 0, cover = [];
      for (j = 0; j < n; j++) if (front[j][i] && boxesNear(B, boxes[j], 0)) cover.push(hulls[j]);
      for (var a = 0; a < 9; a++) for (var c = 0; c < 9; c++) {
        var x = B[0] + (a + 0.5) / 9 * (B[2] - B[0]), y = B[1] + (c + 0.5) / 9 * (B[3] - B[1]), hid = false;
        if (!insidePoly(H, x, y)) continue;
        inside++;
        for (j = 0; j < cover.length && !hid; j++) if (insidePoly(cover[j], x, y)) hid = true;
        if (!hid) seen++;
      }
      d.vis[objs[i].id] = inside ? seen / inside : 0;
    }
    d.order = orderOf(objs, d);
    return d;
  }
  // Pairs whose left–right order flips (firmly in both views) or whose occlusion differs (neither doubtful).
  function differences(D1, D2, ids, orderGap) {
    var n = 0;
    for (var i = 0; i < ids.length; i++) for (var j = i + 1; j < ids.length; j++) {
      var a = ids[i], b = ids[j], x1 = D1.x[a] - D1.x[b], x2 = D2.x[a] - D2.x[b], s1 = D1.pairs[pairKey(a, b)], s2 = D2.pairs[pairKey(a, b)];
      if (x1 * x2 < 0 && abs(x1) >= orderGap && abs(x2) >= orderGap) n++;
      if (s1 !== s2 && s1 !== '?' && s2 !== '?') n++;
    }
    return n;
  }
  // D2 looks like D1 flipped left to right: reversed order, same occlusions.
  function mirrorOf(D1, D2) {
    if (D1.order.slice().reverse().join() !== D2.order.join()) return false;
    return Object.keys(D1.pairs).every(function (k) { return D1.pairs[k] === D2.pairs[k]; });
  }

  /* ------------------------------------------------------------------ ray-cast ID buffer (validate) */
  // V_PIXELS: a small sphere at the far side covers about 10 pixels of the grid.
  var GRID = 48, V_ORDER_GAP = 0.05, V_OCC = 0.08, V_VIS = 0.45, V_STEM_VIS = 0.8, V_PIXELS = 5, FLAG_H = 0.55;
  var MASK = new Uint8Array(GRID * GRID);   // scratch: which objects each pixel's ray meets (bit per object)
  // Solids as world-space half-spaces n·x ≤ c (16-sided prisms and pyramids, their sides touching the
  // true surface, stand in for the cylinder and the cone), or a sphere; num caches c − n·P for the eye P.
  function solidOf(o, P) {
    var s = o.s, h = o.h, k = s / h, local = [], i;
    if (o.shape === 'sphere') { var q = [P[0] - o.x, P[1] - s, P[2] - o.z]; return { q: q, cc: dot(q, q) - s * s }; }
    if (o.shape === 'cube') local = [[1, 0, 0, s], [-1, 0, 0, s], [0, 0, 1, s], [0, 0, -1, s], [0, 1, 0, h], [0, -1, 0, 0]];
    else if (o.shape === 'pyramid') local = [[1, k, 0, s], [-1, k, 0, s], [0, k, 1, s], [0, k, -1, s], [0, -1, 0, 0]];
    else {
      local.push([0, -1, 0, 0]);
      if (o.shape === 'cylinder') local.push([0, 1, 0, h]);
      for (i = 0; i < 16; i++) local.push([RING16[i][1], o.shape === 'cone' ? k : 0, RING16[i][0], s]);
    }
    var a = sincos(o.yaw), planes = [], num = [];
    for (i = 0; i < local.length; i++) {
      var p = local[i], nx = p[0] * a[1] - p[2] * a[0], nz = p[0] * a[0] + p[2] * a[1], c = p[3] + nx * o.x + nz * o.z;
      planes.push([nx, p[1], nz]);
      num.push(c - (nx * P[0] + p[1] * P[1] + nz * P[2]));
    }
    return { planes: planes, num: num };
  }
  // Entry distance along the unit ray (dx, dy, dz) from the eye (t ≥ 0), or INF.
  function hit(so, dx, dy, dz) {
    if (!so.planes) {
      var b = so.q[0] * dx + so.q[1] * dy + so.q[2] * dz, disc = b * b - so.cc;
      if (disc < 0) return INF;
      var sq = sqrt(disc);
      return -b + sq < 0 ? INF : max(0, -b - sq);
    }
    var t0 = 0, t1 = INF, pl = so.planes, num = so.num;
    for (var i = 0; i < pl.length; i++) {
      var p = pl[i], den = p[0] * dx + p[1] * dy + p[2] * dz;
      if (den === 0) { if (num[i] < 0) return INF; continue; }
      var t = num[i] / den;
      if (den < 0) { if (t > t0) t0 = t; } else if (t < t1) t1 = t;
      if (t0 > t1) return INF;
    }
    return t0;
  }
  function rayDescribe(objs, cam) {
    var n = objs.length, S = [], C = [], cnt = [], vis = [], sx = [], edge = [], tt = [], cov = [], i, j;
    for (i = 0; i < n; i++) {
      var o = objs[i], fp = footprint(o), rho = sqrt(fp * fp + o.h * o.h / 4), pc = project(cam, [o.x, o.h / 2, o.z]);
      S.push(solidOf(o, cam.pos));
      // Pruning circle round the projected bounding sphere (with room for the perspective stretch).
      C.push([pc[0], pc[1], 1.2 * cam.k * rho / sqrt(max(1e-9, pc[2] * pc[2] - rho * rho)) + 2 / GRID]);
      cnt.push(0); vis.push(0); sx.push(0); edge.push(0); tt.push(INF);
    }
    for (i = 0; i < n * n; i++) cov.push(0);   // cov[i·n + j]: pixels where i is in front of j
    var f = cam.f, r = cam.r, u = cam.u, k = cam.k, X0 = GRID, X1 = -1, Y0 = GRID, Y1 = -1;
    for (i = 0; i < n; i++) {   // only the pixels inside some pruning circle's box can hit anything
      X0 = min(X0, floor((C[i][0] - C[i][2] + 1) / 2 * GRID)); X1 = max(X1, ceil((C[i][0] + C[i][2] + 1) / 2 * GRID));
      Y0 = min(Y0, floor((1 - C[i][1] - C[i][2]) / 2 * GRID)); Y1 = max(Y1, ceil((1 - C[i][1] + C[i][2]) / 2 * GRID));
    }
    X0 = max(0, X0); Y0 = max(0, Y0); X1 = min(GRID - 1, X1); Y1 = min(GRID - 1, Y1);
    var py, px, bits;
    for (py = Y0; py <= Y1; py++) for (px = X0; px <= X1; px++) MASK[py * GRID + px] = 0;
    for (py = Y0; py <= Y1; py++) for (px = X0; px <= X1; px++) {
      var x = (px + 0.5) / GRID * 2 - 1, y = 1 - (py + 0.5) / GRID * 2, ray = false, nh = 0, best = -1, rx = 0, ry = 0, rz = 0;
      for (i = 0; i < n; i++) {
        tt[i] = INF;
        var ex = x - C[i][0], ey = y - C[i][1];
        if (ex * ex + ey * ey > C[i][2] * C[i][2]) continue;
        if (!ray) {
          rx = f[0] + (r[0] * x + u[0] * y) / k; ry = f[1] + (r[1] * x + u[1] * y) / k; rz = f[2] + (r[2] * x + u[2] * y) / k;
          var len = sqrt(rx * rx + ry * ry + rz * rz);
          rx /= len; ry /= len; rz /= len; ray = true;
        }
        tt[i] = hit(S[i], rx, ry, rz);
        if (tt[i] < INF) { nh++; if (best < 0 || tt[i] < tt[best]) best = i; }
      }
      if (!nh) continue;
      var border = px === 0 || py === 0 || px === GRID - 1 || py === GRID - 1;
      bits = 0;
      for (i = 0; i < n; i++) if (tt[i] < INF) { cnt[i]++; sx[i] += x; bits |= 1 << i; if (border) edge[i]++; }
      MASK[py * GRID + px] = bits;
      vis[best]++;
      if (nh > 1) for (i = 0; i < n; i++) for (j = 0; j < n; j++) if (i !== j && tt[i] < tt[j] && tt[j] < INF) cov[i * n + j]++;
    }
    // Objects whose silhouettes come within one pixel of each other (so "apart" is not certain).
    var touch = [];
    for (i = 0; i < n; i++) touch.push(0);
    for (py = Y0; py <= Y1; py++) for (px = X0; px <= X1; px++) {
      bits = MASK[py * GRID + px];
      if (!bits) continue;
      var near = 0;
      for (var qy = max(Y0, py - 1); qy <= min(Y1, py + 1); qy++) for (var qx = max(X0, px - 1); qx <= min(X1, px + 1); qx++) near |= MASK[qy * GRID + qx];
      for (i = 0; i < n; i++) if (bits & (1 << i)) touch[i] |= near;
    }
    var d = { x: {}, pairs: {}, vis: {}, px: {}, frame: true, order: null };
    for (i = 0; i < n; i++) {
      var id = objs[i].id;
      d.px[id] = cnt[i];
      d.x[id] = cnt[i] ? sx[i] / cnt[i] : 0;
      d.vis[id] = cnt[i] ? vis[i] / cnt[i] : 0;
      if (edge[i]) d.frame = false;
    }
    for (i = 0; i < n; i++) for (j = i + 1; j < n; j++) {
      var ij = cov[i * n + j], ji = cov[j * n + i], a2 = objs[i].id, b2 = objs[j].id;
      d.pairs[pairKey(a2, b2)] = ij + ji === 0 ? (touch[i] & (1 << j) ? '?' : 'apart')
        : ij + ji >= V_OCC * min(cnt[i], cnt[j]) ? (ij >= ji ? a2 + '>' + b2 : b2 + '>' + a2) : '?';
    }
    d.order = orderOf(objs, d);
    return d;
  }
  // The flag top on the rim stands clear in the stem picture.
  function flagClear(objs, cam, az) {
    var a = sincos(az), v = sub([TABLE_R * a[0], FLAG_H, TABLE_R * a[1]], cam.pos), L = sqrt(dot(v, v));
    return objs.every(function (o) { return !(hit(solidOf(o, cam.pos), v[0] / L, v[1] / L, v[2] / L) < L); });
  }

  /* ------------------------------------------------------------------ generate */
  function lvl(params, key, n) { var v = params ? params[key] : 0; return Number.isInteger(v) && v >= 0 && v < n ? v : 0; }
  function cleanParams(params) {
    return { angle: lvl(params, 'angle', ANGLE_BINS.length), objects: lvl(params, 'objects', OBJECT_LEVELS.length), foils: lvl(params, 'foils', NEAR_BINS.length) };
  }
  function copy(o) { return JSON.parse(JSON.stringify(o)); }

  // The flag's place among the options by summed angular distance to the others ('odd' = most apart,
  // 'alike' = least, else 'mid'), and whether it is the farthest from the default view.
  function roles(list) {
    var iso = list.map(function (a) { return list.reduce(function (s, b) { return s + sep(a, b); }, 0); });
    var odd = true, alike = true, far = true;
    for (var i = 1; i < list.length; i++) {
      if (iso[i] >= iso[0]) odd = false;
      if (iso[i] <= iso[0]) alike = false;
      if (abs(list[i]) >= abs(list[0])) far = false;
    }
    return { iso: odd ? 'odd' : alike ? 'alike' : 'mid', far: far };
  }
  // Azimuth sets are drawn against targets (the flag most apart 1/4, least apart 1/4, the farthest from
  // the default view 1/4 where the level allows), so neither stem-blind picks (odd one out, most like the
  // others) nor "the least egocentric view" find the key more often than chance.
  function pickAzimuths(r, p) {
    var u = r.next(), want = u < 0.25 ? 'odd' : u < 0.5 ? 'alike' : 'mid', wantFar = r.chance(0.25), best = null, rank = -1;
    for (var t = 0; t < 24 && rank < 3; t++) {
      var list = drawAzimuths(r, p);
      if (!list) continue;
      var ro = roles(list);
      // 3: role and farthest both as wanted; 2: the role; 1: not 'odd' when 'odd' was not wanted; 0: any.
      var k = ro.iso === want ? (ro.far === wantFar ? 3 : 2) : want !== 'odd' && ro.iso !== 'odd' ? 1 : 0;
      if (k > rank) { rank = k; best = list; }
    }
    return best;
  }
  // [flag, nearest foil, …] in whole degrees; with EGO_P a foil nearer the default view than the flag.
  function drawAzimuths(r, p) {
    var bin = ANGLE_BINS[p.angle], nb = NEAR_BINS[p.foils];
    var key = r.int(bin[0], bin[1]) * (r.chance(0.5) ? 1 : -1), dn = r.int(nb[0], nb[1]);
    var list = [key, wrap(key + (r.chance(0.5) ? dn : -dn))];
    var fits = function (az) { return sep(az, key) >= dn && list.every(function (b) { return sep(az, b) >= MIN_SEP; }); };
    if (r.chance(EGO_P)) {
      var lim = abs(key) - 5, ego = [];
      for (var az = -lim; az <= lim; az++) if (fits(az)) ego.push(az);
      if (ego.length) list.push(r.pick(ego));
    }
    for (var k = 0; k < 300 && list.length < 4; k++) { var c = r.int(-179, 180); if (fits(c)) list.push(c); }
    return list.length === 4 ? list : null;
  }

  // Objects one at a time; a position is kept only if, in every view, no object is covered by more than
  // its budget (summed overlaps with nearer objects: an upper bound on the covered share).
  function placeObjects(r, n, cams) {
    var shapes = r.shuffle(SHAPES).slice(0, n), colors = r.shuffle(COLORS).slice(0, n), objs = [];
    var V = cams.map(function (c, v) { return { cam: c, hulls: [], areas: [], cover: [], budget: v === 0 ? 1 - STEM_VIS : 1 - VIS_MIN }; });
    for (var i = 0; i < n; i++) {
      var size = r.pick(SIZES), shape = shapes[i], s = HALF[size], done = false;
      var o = { id: 'o' + (i + 1), shape: shape, color: colors[i], size: size, x: 0, z: 0, yaw: shape === 'cube' || shape === 'pyramid' ? r.int(0, 89) : 0, s: s, h: rnd3(TALL[shape] * s) };
      var fp = footprint(o);
      for (var k = 0; k < 60 && !done; k++) {
        o.x = rnd3(r.float(-RIM, RIM));
        o.z = rnd3(r.float(-RIM, RIM));
        if (sqrt(o.x * o.x + o.z * o.z) + fp > RIM) continue;
        if (!objs.every(function (q) { var dx = q.x - o.x, dz = q.z - o.z; return sqrt(dx * dx + dz * dz) >= fp + footprint(q) + SPACING; })) continue;
        var pts = surfacePoints(o), cand = [], ok = true;
        for (var v = 0; v < V.length && ok; v++) {
          var W = V[v], hp = hull(pts.map(function (pt) { return project(W.cam, pt); })), a = area(hp), mine = 0, theirs = [];
          if (!framed(hp, FRAME_IN)) { ok = false; break; }
          for (var e = 0; e < i && ok; e++) {
            var ov = overlap(hp, W.hulls[e]);
            if (!ov) continue;
            if (inFront(objs[e], o, W.cam.pos)) mine += ov / a;
            else if (W.cover[e] + ov / W.areas[e] > W.budget) ok = false;
            else theirs.push([e, ov / W.areas[e]]);
          }
          if (mine > W.budget) ok = false;
          cand.push({ hp: hp, a: a, mine: mine, theirs: theirs });
        }
        if (!ok) continue;
        cand.forEach(function (c, v2) {
          var W2 = V[v2];
          W2.hulls.push(c.hp); W2.areas.push(c.a); W2.cover.push(c.mine);
          c.theirs.forEach(function (t) { W2.cover[t[0]] += t[1]; });
        });
        done = true;
      }
      if (!done) return null;
      objs.push(o);
    }
    return { objs: objs, views: V };
  }

  var stats = { tries: 0, nulls: 0, invalid: 0, fallbacks: 0, why: {}, lastInvalid: null };
  function no(reason) { stats.why[reason] = (stats.why[reason] || 0) + 1; return null; }
  function generateOnce(r, p) {
    var azs = pickAzimuths(r, p);
    if (!azs) return no('azimuths');
    var cams = [stemCam(STEM)].concat(azs.map(function (az) { return optionCam(CAMERA, az); }));
    var placed = placeObjects(r, OBJECT_LEVELS[p.objects], cams);
    if (!placed) return no('placement');
    var objs = placed.objs, ids = objs.map(function (o) { return o.id; }), i, j;
    // Framing and visibility are settled by the placement budget (covered share ≤ summed overlaps), so the
    // option views are described without sampling visibility; validate() measures it on rays.
    var D = cams.slice(1).map(function (c, v) { return describe(objs, c, placed.views[v + 1].hulls, true); });
    var tot = [0, 0, 0, 0];
    for (i = 0; i < 4; i++) for (j = i + 1; j < 4; j++) {
      if (differences(D[i], D[j], ids, ORDER_GAP) < 1) return no('alike');
      var d0 = differences(D[i], D[j], ids, 0);
      tot[i] += d0; tot[j] += d0;
    }
    for (i = 1; i < 4; i++) if (mirrorOf(D[0], D[i])) return no('mirror');
    // The stem-blind odd one out (the picture most unlike the other three) is the flag's view half as often.
    if (tot[0] > max(tot[1], tot[2], tot[3]) && r.chance(ODD_REJECT)) return no('odd');
    if (!flagClear(objs, cams[0], azs[0])) return no('flag');
    var order = r.shuffle([0, 1, 2, 3]);
    return {
      key: order.indexOf(0), table: { r: TABLE_R }, camera: copy(CAMERA), stem: copy(STEM), objects: objs,
      flag: { az: azs[0] }, options: order.map(function (k) { return { az: azs[k] }; }),
    };
  }

  /* ------------------------------------------------------------------ validate and score */
  function validate(item) {
    if (!item || item.ex !== 'viewmatch') return 'not a viewmatch item';
    var p = cleanParams(item.params), objs = item.objects, n = OBJECT_LEVELS[p.objects], i, j, seen = {};
    if (JSON.stringify(item.camera) !== JSON.stringify(CAMERA) || JSON.stringify(item.stem) !== JSON.stringify(STEM)) return 'unknown cameras';
    if (!Array.isArray(objs) || objs.length !== n) return 'the level needs ' + n + ' objects';
    for (i = 0; i < n; i++) {
      var o = objs[i];
      if (!o || seen['i' + o.id] || seen['s' + o.shape] || seen['c' + o.color]) return 'objects must differ in id, shape and colour';
      seen['i' + o.id] = seen['s' + o.shape] = seen['c' + o.color] = true;
      if (SHAPES.indexOf(o.shape) < 0 || COLORS.indexOf(o.color) < 0 || SIZES.indexOf(o.size) < 0) return 'unknown shape, colour or size';
      if (o.s !== HALF[o.size] || o.h !== rnd3(TALL[o.shape] * o.s)) return 'wrong dimensions for ' + o.id;
      if (!Number.isInteger(o.yaw) || o.yaw < 0 || o.yaw > 89) return 'bad yaw';
      if (sqrt(o.x * o.x + o.z * o.z) + footprint(o) > RIM + 1e-9) return o.id + ' is off the table';
      for (j = 0; j < i; j++) {
        var dx = objs[j].x - o.x, dz = objs[j].z - o.z;
        if (sqrt(dx * dx + dz * dz) < footprint(o) + footprint(objs[j]) + SPACING / 2) return o.id + ' and ' + objs[j].id + ' touch';
      }
    }
    var opts = item.options, flag = item.flag && item.flag.az, bin = ANGLE_BINS[p.angle], nb = NEAR_BINS[p.foils];
    if (!Array.isArray(opts) || opts.length !== 4) return 'four options are needed';
    if (!Number.isInteger(item.key) || item.key < 0 || item.key > 3) return 'bad key';
    if (!opts.every(function (x) { return x && Number.isInteger(x.az) && x.az > -180 && x.az <= 180; })) return 'bad azimuths';
    if (opts[item.key].az !== flag) return 'the key is not the view from the flag';
    if (abs(flag) < bin[0] || abs(flag) > bin[1]) return 'the flag angle is outside its level';
    var nearest = INF;
    for (i = 0; i < 4; i++) if (i !== item.key) nearest = min(nearest, sep(opts[i].az, flag));
    if (nearest < nb[0] || nearest > nb[1]) return 'the nearest foil is ' + nearest + '° away, outside its level';
    for (i = 0; i < 4; i++) for (j = i + 1; j < 4; j++) if (sep(opts[i].az, opts[j].az) < MIN_SEP) return 'options ' + i + ' and ' + j + ' are too close';
    // From rays: the stem shows every object, the whole table and the flag; every option every object.
    var ids = objs.map(function (x) { return x.id; }), sc = stemCam(STEM), st = rayDescribe(objs, sc);
    if (!st.frame || ids.some(function (id) { return st.vis[id] < V_STEM_VIS || st.px[id] < V_PIXELS; })) return 'the stem hides an object';
    if (!flagClear(objs, sc, flag)) return 'an object hides the flag';
    for (i = 0; i < 360; i += 15) {
      var rim = sincos(i), q = project(sc, [TABLE_R * rim[0], 0, TABLE_R * rim[1]]);
      if (abs(q[0]) > 0.98 || abs(q[1]) > 0.98) return 'the stem crops the table';
    }
    var R = opts.map(function (x) { return rayDescribe(objs, optionCam(CAMERA, x.az)); });
    for (i = 0; i < 4; i++) {
      if (!R[i].frame) return 'option ' + i + ' crops an object';
      for (j = 0; j < n; j++) if (R[i].vis[ids[j]] < V_VIS || R[i].px[ids[j]] < V_PIXELS) return 'option ' + i + ' hides ' + ids[j];
    }
    for (i = 0; i < 4; i++) for (j = i + 1; j < 4; j++) if (differences(R[i], R[j], ids, V_ORDER_GAP) < 1) return 'options ' + i + ' and ' + j + ' look alike';
    for (i = 0; i < 4; i++) if (i !== item.key && mirrorOf(R[item.key], R[i])) return 'option ' + i + ' is the key mirrored';
    return true;
  }

  function score(item, response) { return { correct: response === item.key }; }

  function attempt(r, p) {
    stats.tries++;
    var core = generateOnce(r, p);
    if (!core) { stats.nulls++; return null; }
    var item = { ex: 'viewmatch', seed: 0, params: p };
    for (var k in core) item[k] = core[k];
    var ok = validate(item);
    if (ok !== true) { stats.invalid++; stats.lastInvalid = ok; return null; }
    return item;
  }
  function fallback(p) {   // fixed seeds per params (the tests check every combination)
    stats.fallbacks++;
    for (var k = 0; k < 500; k++) {
      var item = attempt(PX.rng(PX.rng.hash('viewmatch-fallback', p.angle, p.objects, p.foils, k)), p);
      if (item) { item.fallback = true; return item; }   // the engine voids fallback trials (ARCHITECTURE §5)
    }
    throw new Error('viewmatch: no valid item could be built');
  }
  function generate(rng, params) {
    var p = cleanParams(params), item = null;
    for (var i = 0; i < 50 && !item; i++) item = attempt(i === 0 ? rng : rng.fork('retry' + i), p);
    if (!item) item = fallback(p);
    item.seed = rng.seed;
    item.params = params ? PX.util.deepCopy(params) : p;
    return item;
  }

  PX.ex.define({
    id: 'viewmatch', version: 1, code: 'PR-2', name: 'View Match', short: 'View Match',
    abilities: ['PT'], cell: 'extrinsic-dynamic', role: 'probe', answer: 'choice', nOptions: 4,
    // Hand-set item model (DJ, no pilot yet): base + Σ step × level.
    dims: [
      { key: 'angle', label: 'Flag angle', levels: ['about 45°', 'about 75°', 'about 105°', 'about 135°', 'about 160°'], step: 0.5 },
      { key: 'objects', label: 'Objects', levels: [3, 4, 5], step: 0.35 },
      { key: 'foils', label: 'Nearest other view', levels: ['80–110° away', '55–75° away', '35–50° away'], step: 0.7 },
    ],
    base: -2.0,
    timeLimit: function () { return 30000; },
    generate: generate,
    validate: validate,
    score: score,
    lib: {
      CAMERA: CAMERA, STEM: STEM, TABLE_R: TABLE_R, SHAPES: SHAPES, COLORS: COLORS, SIZES: SIZES, HALF: HALF, TALL: TALL,
      ANGLE_BINS: ANGLE_BINS, NEAR_BINS: NEAR_BINS, OBJECT_LEVELS: OBJECT_LEVELS, MIN_SEP: MIN_SEP, FLAG_H: FLAG_H, GRID: GRID,
      sincos: sincos, sep: sep, optionCam: optionCam, stemCam: stemCam, project: project, surfacePoints: surfacePoints,
      describe: describe, rayDescribe: rayDescribe, differences: differences, mirrorOf: mirrorOf, solidOf: solidOf, hit: hit,
      footprint: footprint, cleanParams: cleanParams, generateOnce: generateOnce, fallback: fallback, stats: stats,
    },
  });
})(window.PX);
