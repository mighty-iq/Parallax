/* EX-06 Slice: view (DOM, SVG and 3D through PX.core.stage3d; ARCHITECTURE.md §6).
   layout 'stem+options': the stem is the solid and a translucent cutting plane, drawn live in 3D
   from the item's own model (def.lib.solidMeshes: the meshes the generator cut); the four options
   are SVG outlines of the normalised section loops (nested loops: the inner solid's region in a
   darker grey inside the outer one, both outlined).
   - Camera: orthographic along item.view (the validator's VIEW), framed to fit the solid and the
     plane's rectangle; screen x = view.right, y = view.up, as in the egocentric foil.
   - The solid's edges are drawn after the translucent plane (never washed out under it), and the
     line where the plane meets the solid's camera-facing faces is drawn in the plane's colour: what
     an opaque plane would show where it enters the solid, nothing hidden (item-validity review).
   - Show me (ctx.play steps): the plane slides in from item.sweep.from to its place while the solid
     is cut on the CPU (the part in front of the plane turns into a ghost, the cut face is drawn from
     lib.sectionOf at every frame), the front piece is lifted away, the slanted cut face is compared
     with the egocentric option, the camera turns to face the plane (frame.az, frame.el: display
     x = frame.u, y = frame.v), and the cut face's outline flies onto the right option, where it
     lands exactly (both are the same loops up to item.norm).
   - Every step's enter() sets the full state of its start (apply()), so Step and Replay work from
     anywhere; nothing is computed while the answer clock runs (meshes are prepared in drawOption,
     the ready phase; show-me buffers on the first show-me). */
(function (PX) {
  'use strict';

  var win = window, doc = document, T = win.THREE, S3 = PX.core.stage3d, timing = PX.core.timing, U = PX.util;
  var h = PX.ui.h, SV = PX.core.svg;
  var def = PX.ex.get('slice'), lib = def.lib;
  var st = null; // the mounted view's state

  var DEG = Math.PI / 180;
  var CREASE = Math.cos(30 * DEG); // edges sharper than 30° are drawn
  var SMOOTH = Math.cos(40 * DEG); // shading is smoothed across facets closer than 40°
  var CAM_D = 30;                  // camera distance (orthographic: only near/far depend on it)
  var MARGIN = 1.12;               // framing margin
  var EDGE_PX = 1.6;               // outline width in CSS px
  var MEET_PX = 2.4;               // width of the line where the plane meets the solid
  var VB = 1.18;                   // option drawings: viewBox [−VB, VB]² around the normalised loops

  function learn() { return PX.ex.learn('slice') || {}; }
  function cap(key, vars) {
    var s = String((learn().captions || {})[key] || '');
    if (vars) for (var k in vars) s = s.split('{' + k + '}').join(String(vars[k]));
    return s;
  }

  /* ---------- small vector helpers (arrays) ---------- */
  function dot(a, b) { return a[0] * b[0] + a[1] * b[1] + a[2] * b[2]; }
  function add(a, b) { return [a[0] + b[0], a[1] + b[1], a[2] + b[2]]; }
  function sub(a, b) { return [a[0] - b[0], a[1] - b[1], a[2] - b[2]]; }
  function mul(a, s) { return [a[0] * s, a[1] * s, a[2] * s]; }
  function lerp3(a, b, k) { return [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k, a[2] + (b[2] - a[2]) * k]; }
  function ease(k) { return k * k * (3 - 2 * k); }

  // Camera basis on the orbit: azimuth from +z toward +x, elevation up (degrees), as lib.VIEW and
  // lib.planeFrame (dir = toward the camera; right horizontal; up = dir × right).
  function basis(az, el) {
    var a = az * DEG, e = el * DEG, sa = Math.sin(a), ca = Math.cos(a), se = Math.sin(e), ce = Math.cos(e);
    return { dir: [sa * ce, se, ca * ce], right: [ca, 0, -sa], up: [-sa * se, ce, -ca * se] };
  }
  function viewAngles(dir) {
    var hh = Math.sqrt(dir[0] * dir[0] + dir[2] * dir[2]);
    return { az: hh < 1e-6 ? 35 : Math.atan2(dir[0], dir[2]) / DEG, el: Math.atan2(dir[1], hh) / DEG };
  }

  /* ---------- meshes: shading normals, creases, silhouettes ---------- */

  // A closed mesh { V, T, mat } (world space) prepared for drawing: per-corner positions P and
  // normals N (smoothed across facets closer than 40°, so boxes stay crisp and cylinders round),
  // unit face normals FN, the edge list E ([a, b, t1, t2]) and the crease segments.
  function prep(m) {
    var V = m.V, Tr = m.T, nv = V.length / 3, nt = Tr.length / 3, t, k, i;
    var FN = new Float64Array(nt * 3), FA = new Float64Array(nt * 3);
    for (t = 0; t < nt; t++) {
      var a = 3 * Tr[3 * t], b = 3 * Tr[3 * t + 1], c = 3 * Tr[3 * t + 2];
      var e1x = V[b] - V[a], e1y = V[b + 1] - V[a + 1], e1z = V[b + 2] - V[a + 2];
      var e2x = V[c] - V[a], e2y = V[c + 1] - V[a + 1], e2z = V[c + 2] - V[a + 2];
      var nx = e1y * e2z - e1z * e2y, ny = e1z * e2x - e1x * e2z, nz = e1x * e2y - e1y * e2x;
      var len = Math.sqrt(nx * nx + ny * ny + nz * nz) || 1;
      FA[3 * t] = nx; FA[3 * t + 1] = ny; FA[3 * t + 2] = nz;
      FN[3 * t] = nx / len; FN[3 * t + 1] = ny / len; FN[3 * t + 2] = nz / len;
    }
    var start = new Int32Array(nv + 1), inc = new Int32Array(nt * 3), fillAt = new Int32Array(nv);
    for (i = 0; i < nt * 3; i++) start[Tr[i] + 1]++;
    for (i = 0; i < nv; i++) start[i + 1] += start[i];
    for (i = 0; i < nt * 3; i++) { var vv = Tr[i]; inc[start[vv] + fillAt[vv]++] = (i / 3) | 0; }
    var P = new Float32Array(nt * 9), N = new Float32Array(nt * 9);
    for (t = 0; t < nt; t++) {
      for (k = 0; k < 3; k++) {
        var v = Tr[3 * t + k], sx = 0, sy = 0, sz = 0, o = 9 * t + 3 * k;
        for (i = start[v]; i < start[v + 1]; i++) {
          var s = inc[i];
          if (FN[3 * t] * FN[3 * s] + FN[3 * t + 1] * FN[3 * s + 1] + FN[3 * t + 2] * FN[3 * s + 2] > SMOOTH) {
            sx += FA[3 * s]; sy += FA[3 * s + 1]; sz += FA[3 * s + 2];
          }
        }
        var l2 = Math.sqrt(sx * sx + sy * sy + sz * sz) || 1;
        P[o] = V[3 * v]; P[o + 1] = V[3 * v + 1]; P[o + 2] = V[3 * v + 2];
        N[o] = sx / l2; N[o + 1] = sy / l2; N[o + 2] = sz / l2;
      }
    }
    var ids = new Map(), E = [];
    for (t = 0; t < nt; t++) {
      for (k = 0; k < 3; k++) {
        var p0 = Tr[3 * t + k], p1 = Tr[3 * t + (k + 1) % 3], lo = Math.min(p0, p1), hi = Math.max(p0, p1);
        var key = lo * nv + hi, id = ids.get(key);
        if (id === undefined) { ids.set(key, E.length); E.push([lo, hi, t, -1]); } else E[id][3] = t;
      }
    }
    var crease = [], smooth = [];
    E.forEach(function (e) {
      var f1 = 3 * e[2], f2 = 3 * e[3];
      if (e[3] < 0 || FN[f1] * FN[f2] + FN[f1 + 1] * FN[f2 + 1] + FN[f1 + 2] * FN[f2 + 2] < CREASE) crease.push(e);
      else smooth.push(e);
    });
    var cx = 0, cy = 0, cz = 0, r = 0;
    for (i = 0; i < nv; i++) { cx += V[3 * i]; cy += V[3 * i + 1]; cz += V[3 * i + 2]; }
    cx /= nv; cy /= nv; cz /= nv;
    for (i = 0; i < nv; i++) r = Math.max(r, Math.hypot(V[3 * i] - cx, V[3 * i + 1] - cy, V[3 * i + 2] - cz));
    return { V: V, T: Tr, nt: nt, FN: FN, P: P, N: N, crease: crease, smooth: smooth, mat: m.mat, center: [cx, cy, cz], radius: r };
  }

  // Segments [ax, ay, az, bx, by, bz, …] of a prepared mesh's creases, plus its silhouette seen
  // along dir (facets turning away between neighbours), keeping only the part on the back side of
  // an optional cut (p, n): the front piece is a ghost without outlines.
  function outlineSegs(pm, dir, cut, out) {
    var V = pm.V, FN = pm.FN, i;
    function seg(e) {
      var a = 3 * e[0], b = 3 * e[1];
      var ax = V[a], ay = V[a + 1], az = V[a + 2], bx = V[b], by = V[b + 1], bz = V[b + 2];
      if (cut) {
        var da = ax * cut.n[0] + ay * cut.n[1] + az * cut.n[2] - cut.off, db = bx * cut.n[0] + by * cut.n[1] + bz * cut.n[2] - cut.off;
        if (da > 0 && db > 0) return;
        if (da > 0 || db > 0) {
          var k = da / (da - db), ix = ax + (bx - ax) * k, iy = ay + (by - ay) * k, iz = az + (bz - az) * k;
          if (da > 0) { ax = ix; ay = iy; az = iz; } else { bx = ix; by = iy; bz = iz; }
        }
      }
      out.push(ax, ay, az, bx, by, bz);
    }
    for (i = 0; i < pm.crease.length; i++) seg(pm.crease[i]);
    if (dir) {
      for (i = 0; i < pm.smooth.length; i++) {
        var e = pm.smooth[i], f1 = 3 * e[2], f2 = 3 * e[3];
        var s1 = FN[f1] * dir[0] + FN[f1 + 1] * dir[1] + FN[f1 + 2] * dir[2];
        var s2 = FN[f2] * dir[0] + FN[f2 + 1] * dir[1] + FN[f2 + 2] * dir[2];
        if ((s1 > 0) !== (s2 > 0)) seg(e);
      }
    }
    return out;
  }

  // Segments where the plane (n, off) meets the faces of a prepared mesh that turn toward the camera
  // (dir): the line an opaque plane would show where it enters the solid. Hidden faces are left out,
  // so nothing is shown that the picture itself does not show.
  function meetSegs(pm, n, off, dir, out) {
    var P = pm.P, FN = pm.FN, k, c;
    for (var t = 0; t < pm.nt; t++) {
      if (FN[3 * t] * dir[0] + FN[3 * t + 1] * dir[1] + FN[3 * t + 2] * dir[2] <= 1e-6) continue;
      var o = 9 * t, pts = [];
      for (k = 0; k < 3; k++) DS[k] = P[o + 3 * k] * n[0] + P[o + 3 * k + 1] * n[1] + P[o + 3 * k + 2] * n[2] - off;
      for (k = 0; k < 3; k++) {
        var j = (k + 1) % 3, a = DS[k], b = DS[j];
        if ((a < 0 && b > 0) || (a > 0 && b < 0)) {
          var s = a / (a - b), ok = o + 3 * k, oj = o + 3 * j;
          for (c = 0; c < 3; c++) pts.push(P[ok + c] + (P[oj + c] - P[ok + c]) * s);
        }
      }
      if (pts.length === 6) out.push(pts[0], pts[1], pts[2], pts[3], pts[4], pts[5]);
    }
    return out;
  }

  /* ---------- outline bars: thin boxes along segments (WebGL lines are 1 device px) ---------- */

  var BOX = null;
  function boxGeo() {
    if (!BOX) { BOX = new T.BoxGeometry(1, 1, 1); BOX.userData.shared = true; }
    return BOX;
  }
  function bars(mat, max) {
    var m = new T.InstancedMesh(boxGeo(), mat, max);
    m.count = 0;
    m.frustumCulled = false;
    m.userData.max = max;
    return m;
  }
  var M4 = null, QQ = null, PP = null, SS = null, DD = null, XX = null;
  function setBars(im, segs, w) {
    if (!M4) { M4 = new T.Matrix4(); QQ = new T.Quaternion(); PP = new T.Vector3(); SS = new T.Vector3(); DD = new T.Vector3(); XX = new T.Vector3(1, 0, 0); }
    var n = 0, max = im.userData.max;
    for (var i = 0; i + 5 < segs.length && n < max; i += 6) {
      var dx = segs[i + 3] - segs[i], dy = segs[i + 4] - segs[i + 1], dz = segs[i + 5] - segs[i + 2];
      var len = Math.sqrt(dx * dx + dy * dy + dz * dz);
      if (len < 1e-9) continue;
      QQ.setFromUnitVectors(XX, DD.set(dx / len, dy / len, dz / len));
      PP.set((segs[i] + segs[i + 3]) / 2, (segs[i + 1] + segs[i + 4]) / 2, (segs[i + 2] + segs[i + 5]) / 2);
      SS.set(len + w, w, w);
      im.setMatrixAt(n++, M4.compose(PP, QQ, SS));
    }
    im.count = n;
    im.instanceMatrix.needsUpdate = true;
  }

  /* ---------- materials (own, theme aware; shared ones in stage3d are not touched) ---------- */

  function makeMaterials() {
    var off = { polygonOffset: true, polygonOffsetFactor: 1, polygonOffsetUnits: 1 };
    return {
      solid: new T.MeshLambertMaterial(off),
      inner: new T.MeshLambertMaterial(off),
      outer: new T.MeshLambertMaterial({ transparent: true, opacity: 0.3, depthWrite: false }),
      ghost: new T.MeshLambertMaterial({ transparent: true, opacity: 0.16, depthWrite: false }),
      plane: new T.MeshBasicMaterial({ transparent: true, opacity: 0.26, depthWrite: false, side: T.DoubleSide }),
      planeEdge: new T.MeshBasicMaterial({ transparent: true, opacity: 0.6 }),
      // Outlines go in the transparent pass (opacity 1) so they can be drawn after the plane: the
      // solid's edges stay crisp under the translucent plane (still hidden by the solid itself).
      edge: new T.MeshBasicMaterial({ transparent: true }),
      edgeSoft: new T.MeshBasicMaterial({ transparent: true }),
      meet: new T.MeshBasicMaterial({ transparent: true }),
      cap: new T.MeshBasicMaterial({ side: T.DoubleSide }),
      capInner: new T.MeshBasicMaterial({ side: T.DoubleSide }),
    };
  }
  function tintMaterials(m) {
    var c = S3.colors();
    m.solid.color.copy(c.face); m.outer.color.copy(c.face); m.ghost.color.copy(c.face);
    m.inner.color.copy(c.face2);
    m.plane.color.copy(c.target); m.planeEdge.color.copy(c.target);
    m.edge.color.copy(c.edge); m.edgeSoft.color.copy(c.edge).lerp(c.ground, 0.55);
    // Where the plane meets the solid: the plane's colour (darker on the dark theme's light faces).
    m.meet.color.copy(c.target);
    if (c.ground.r + c.ground.g + c.ground.b < 1.2) m.meet.color.lerp(c.edge, 0.45);
    // The cut face: the plane's colour; an inner solid's region darker than the rest (as in the
    // options), with its own outline. Colours mix in linear light: small factors go a long way.
    var dark = c.ground.r + c.ground.g + c.ground.b < 1.2;
    m.cap.color.copy(c.target); m.capInner.color.copy(c.target);
    if (dark) m.capInner.color.lerp(c.edge, 0.5); else m.cap.color.lerp(c.ground, 0.15);
  }

  /* ---------- camera: orthographic, framed in the (right, up) coordinates of a basis ---------- */

  // Bounding box of points (flat array) in a basis: { cx, cy, hw, hh } (half sizes).
  function extent(pts, b) {
    var x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
    for (var i = 0; i + 2 < pts.length; i += 3) {
      var p = [pts[i], pts[i + 1], pts[i + 2]], x = dot(p, b.right), y = dot(p, b.up);
      if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y;
    }
    return { cx: (x0 + x1) / 2, cy: (y0 + y1) / 2, hw: Math.max(1e-3, (x1 - x0) / 2), hh: Math.max(1e-3, (y1 - y0) / 2) };
  }
  // A frame { center (3D), half (half height in world units) } that fits the extent in W × H px.
  function fitFrame(ex, b, W, H) {
    var aspect = W / Math.max(1, H), half = Math.max(ex.hh, ex.hw / aspect) * MARGIN;
    return { center: add(mul(b.right, ex.cx), mul(b.up, ex.cy)), half: half };
  }
  function placeCam(cam, b, fr, W, H) {
    var aspect = W / Math.max(1, H), c = fr.center;
    cam.left = -fr.half * aspect; cam.right = fr.half * aspect; cam.top = fr.half; cam.bottom = -fr.half;
    cam.position.set(c[0] + b.dir[0] * CAM_D, c[1] + b.dir[1] * CAM_D, c[2] + b.dir[2] * CAM_D);
    cam.up.set(b.up[0], b.up[1], b.up[2]);
    cam.lookAt(c[0], c[1], c[2]);
    cam.near = 0.1; cam.far = 2 * CAM_D;
    cam.updateProjectionMatrix();
  }
  // CSS px per world unit for a frame in a stage H px high.
  function pxPerUnit(fr, H) { return H / (2 * fr.half); }

  /* ---------- the item's scene ---------- */

  function v3(a) { return new T.Vector3(a[0], a[1], a[2]); }
  function geometry(P, N) {
    var g = new T.BufferGeometry();
    g.setAttribute('position', new T.BufferAttribute(P, 3));
    g.setAttribute('normal', new T.BufferAttribute(N, 3));
    return g;
  }
  function dropObject(o) {
    if (!o) return;
    if (o.parent) o.parent.remove(o);
    o.traverse(function (x) {
      if (x.geometry && !(x.geometry.userData && x.geometry.userData.shared)) x.geometry.dispose();
      if (x.isInstancedMesh && x.dispose) x.dispose();
    });
  }

  // Builds the scene for an item: the solid (prepared meshes), its outline bars, the plane's
  // square and border; the trial frame. Runs in the ready phase (drawOption) or at present.
  function buildItem(item) {
    dropItem();
    var M = st.mats, scene = st.scene, embedded = item.solid.structure === 'embedded';
    var pms = lib.solidMeshes(item.solid).map(prep);
    var root = new T.Group(), pts = [];
    pms.forEach(function (pm) {
      pm.outer = embedded && pm.mat === 1;
      pm.full = new T.Mesh(geometry(pm.P, pm.N), embedded ? (pm.outer ? M.outer : M.inner) : M.solid);
      pm.full.renderOrder = pm.outer ? 1 : 0;
      root.add(pm.full);
      for (var i = 0; i < pm.V.length; i++) pts.push(pm.V[i]);
    });
    // The plane is drawn as a rectangle in its own axes that sticks out of the solid's outline on
    // every side by a fixed margin (the item's square, plane.half, is larger: a tighter frame gives
    // the solid more room on screen).
    var pl = item.plane, f = item.frame, n = pl.n, a0 = Infinity, a1 = -Infinity, b0 = Infinity, b1 = -Infinity;
    for (var i = 0; i + 2 < pts.length; i += 3) {
      var r = [pts[i] - pl.c[0], pts[i + 1] - pl.c[1], pts[i + 2] - pl.c[2]], a = dot(r, f.u), bb = dot(r, f.v);
      if (a < a0) a0 = a; if (a > a1) a1 = a; if (bb < b0) b0 = bb; if (bb > b1) b1 = bb;
    }
    var hu = Math.min(pl.half, (a1 - a0) / 2 * 1.25 + 0.3), hv = Math.min(pl.half, (b1 - b0) / 2 * 1.25 + 0.3);
    var rc = add(pl.c, add(mul(f.u, (a0 + a1) / 2), mul(f.v, (b0 + b1) / 2)));
    var quad = new T.Mesh(new T.PlaneGeometry(2 * hu, 2 * hv), M.plane);
    quad.matrixAutoUpdate = false;
    quad.renderOrder = 2;
    root.add(quad);
    var corners = [];
    [[-1, -1], [1, -1], [1, 1], [-1, 1]].forEach(function (s) {
      var q = add(rc, add(mul(f.u, s[0] * hu), mul(f.v, s[1] * hv)));
      corners.push(q);
      pts.push(q[0], q[1], q[2]);
    });
    var edges = bars(M.edge, 6000), soft = bars(M.edgeSoft, 6000), planeBars = bars(M.planeEdge, 4), meet = bars(M.meet, 4000);
    edges.renderOrder = 4; soft.renderOrder = 4; meet.renderOrder = 5; // after the plane (2) and the ghost (3)
    root.add(edges, soft, planeBars, meet);
    scene.add(root);
    var view = item.view, vb = { dir: view.dir, right: view.right, up: view.up };
    st.it = {
      item: item, root: root, pms: pms, quad: quad, corners: corners, edges: edges, soft: soft, planeBars: planeBars, meet: meet,
      embedded: embedded, n: n, f: { n: n, u: f.u, v: f.v }, vb: vb, ext: extent(pts, vb), rc: rc,
      angles: viewAngles(view.dir), cut: null, sm: null, last: {},
    };
  }
  function dropItem() {
    if (!st || !st.it) return;
    var it = st.it;
    if (it.sm) dropShowMe(it);
    it.pms.forEach(function (pm) { if (pm.full) pm.full.geometry.dispose(); });
    dropObject(it.root);
    st.it = null;
  }

  // Puts the plane's square (and border) through point q of the plane's family (normal n).
  function placePlane(q, opacity) {
    var it = st.it, pl = it.item.plane, d = sub(q, pl.p), c = add(it.rc, d);
    it.quad.matrix.makeBasis(v3(it.f.u), v3(it.f.v), v3(it.n)).setPosition(c[0], c[1], c[2]);
    it.quad.matrixWorldNeedsUpdate = true;
    it.quad.visible = opacity > 0.01;
    st.mats.plane.opacity = 0.26 * opacity;
    st.mats.planeEdge.opacity = 0.6 * opacity; // lighter and thinner than the line where it meets the solid
    var segs = [];
    for (var i = 0; i < 4; i++) {
      var a = add(it.corners[i], d), b = add(it.corners[(i + 1) % 4], d);
      segs.push(a[0], a[1], a[2], b[0], b[1], b[2]);
    }
    setBars(it.planeBars, segs, 1.2 * st.edgeW);
    it.planeBars.visible = opacity > 0.01;
  }

  // Outline bars of the solid for a camera direction (and the cut, when show-me cuts the solid).
  function placeOutlines(dir, cut) {
    var it = st.it, hard = [], softS = [];
    it.pms.forEach(function (pm) { outlineSegs(pm, dir, cut, pm.outer ? softS : hard); });
    setBars(it.edges, hard, st.edgeW);
    setBars(it.soft, softS, st.edgeW);
  }

  /* ---------- the trial picture ---------- */

  function stageSize() {
    var v = st.v3;
    if (!v.width || !v.height) v.resize();
    return { W: v.width || 1, H: v.height || 1 };
  }
  // The trial frame: the validator's camera, fitted to the solid and the plane's square.
  function trialFrame() {
    var s = stageSize();
    return fitFrame(st.it.ext, st.it.vb, s.W, s.H);
  }
  function render() {
    if (!st || !st.v3 || !st.it) return;
    var s = stageSize(), it = st.it, cam = st.cam;
    var b = it.camB || it.vb, fr = it.camF || trialFrame();
    placeCam(cam, b, fr, s.W, s.H);
    st.v3.render(st.scene, cam);
  }
  function showTrial() {
    var it = st.it;
    if (it.sm) hideShowMe(it);
    it.camB = null; it.camF = null;
    it.pms.forEach(function (pm) { pm.full.visible = true; });
    st.edgeW = EDGE_PX / pxPerUnit(trialFrame(), stageSize().H);
    placePlane(it.item.plane.p, 1);
    placeOutlines(it.vb.dir, null);
    placeMeet();
    render();
  }
  // The line where the plane meets the solid's visible faces, for the trial picture.
  function placeMeet() {
    var it = st.it, n = it.n, off = dot(it.item.plane.p, n), segs = [];
    it.pms.forEach(function (pm) { meetSegs(pm, n, off, it.vb.dir, segs); });
    setBars(it.meet, segs, MEET_PX / pxPerUnit(trialFrame(), stageSize().H));
    it.meet.visible = true;
  }

  function themeChanged() {
    if (!st) return;
    tintMaterials(st.mats);
    st.scene.background.copy(S3.colors().ground);
    render();
  }

  var KIND = { box: 'box', prism: 'triangular prism', pyramid: 'pyramid', cylinder: 'cylinder', cone: 'cone', sphere: 'sphere' };
  function describe(item) {
    var s = item.solid, what;
    if (s.structure === 'embedded') what = 'A ' + (KIND[s.parts[1].type] || 'solid') + ' inside a see-through ' + (KIND[s.parts[0].type] || 'solid');
    else if (s.structure === 'joined') what = 'Two solids joined into one';
    else what = 'A ' + (KIND[s.parts[0].type] || 'solid');
    return what + ', with a flat cutting plane through it. Four outlines: which one is the cut face, seen straight on?';
  }

  /* ---------- view functions ---------- */

  function mount(ctx) {
    var root = h('div.ex-slice-stem');
    var stage = h('div.ex-stage.ex-slice-stage');
    var labels = {
      solid: h('span.ex-label.ex-slice-label--solid', 'Solid'),
      plane: h('span.ex-label.ex-slice-label--plane', h('span.ex-slice-swatch', { 'aria-hidden': 'true' }), 'Cutting plane'),
    };
    var caption = h('p.ex-caption', { 'aria-live': 'polite' });
    var desc = h('p.px-sr');
    stage.appendChild(labels.solid); stage.appendChild(labels.plane);
    root.appendChild(stage);
    root.appendChild(h('div.ex-slice-under', caption));
    root.appendChild(desc);
    ctx.host.appendChild(root);
    st = { ctx: ctx, root: root, stage: stage, labels: labels, caption: caption, desc: desc,
      v3: null, scene: null, cam: null, mats: null, it: null, optItem: null, opts: [], offs: [], fly: null, edgeW: 0.01 };
    if (!S3.available()) {
      stage.appendChild(h('p.ex-unavailable', { role: 'alert' }, 'This exercise needs 3D graphics, which are not available here: ' + S3.reason() + '.'));
      return;
    }
    st.v3 = S3.attach(stage);
    st.v3.redraw = render;
    st.scene = new T.Scene();
    st.scene.background = S3.colors().ground.clone();
    S3.lights(st.scene);
    st.cam = new T.OrthographicCamera(-1, 1, 1, -1, 0.1, 2 * CAM_D);
    st.mats = makeMaterials();
    tintMaterials(st.mats);
    st.offs.push(PX.bus.on('stage3d:theme', themeChanged));
    // Warm-up: compile the shaders (lit, flat, instanced bars, translucent) now, not in a trial.
    var wg = new T.BoxGeometry(1, 1, 1), warm = [
      new T.Mesh(wg, st.mats.solid), new T.Mesh(wg, st.mats.outer), new T.Mesh(wg, st.mats.cap),
      new T.Mesh(wg, st.mats.plane), bars(st.mats.edge, 1), bars(st.mats.edgeSoft, 1),
    ];
    warm.forEach(function (m) { if (m.isInstancedMesh) { m.count = 1; m.setMatrixAt(0, new T.Matrix4()); } st.scene.add(m); });
    placeCam(st.cam, basis(35, 28), { center: [0, 0, 0], half: 1 }, 1, 1);
    S3.compile(st.scene, st.cam);
    warm.forEach(function (m) { st.scene.remove(m); if (m.isInstancedMesh) m.dispose(); });
    wg.dispose();
  }

  // drawOption runs in the ready phase, before present: the first call for a new item builds
  // its scene (meshes, normals, outlines), so present only draws.
  function newItem(item) {
    if (st.optItem === item) return;
    st.optItem = item;
    st.opts = [];
    clearFly();
    if (st.v3) buildItem(item);
  }

  function present(item, ctx) {
    if (!st) mount(ctx);
    newItem(item);
    st.item = item;
    st.root.classList.remove('is-revealed');
    st.caption.textContent = '';
    st.desc.textContent = describe(item);
    if (!st.v3) return timing.nextPaint();
    st.v3.resize();
    showTrial();
    return timing.nextPaint();
  }

  /* ---------- options: the loops as SVG ---------- */

  function inPoly(p, poly) {
    var inside = false;
    for (var i = 0, j = poly.length - 1; i < poly.length; j = i++) {
      var a = poly[i], b = poly[j];
      if ((a[1] > p[1]) !== (b[1] > p[1]) && p[0] < (b[0] - a[0]) * (p[1] - a[1]) / (b[1] - a[1]) + a[0]) inside = !inside;
    }
    return inside;
  }
  // Nesting depth of each loop (0: outer outline; 1: an inner solid's outline inside it).
  function depths(loops) {
    return loops.map(function (l, i) {
      var d = 0;
      loops.forEach(function (m, j) { if (i !== j && m.length > 2 && inPoly(l[0], m)) d++; });
      return d;
    });
  }
  function loopsPath(loops, idx) { return idx.map(function (i) { return SV.pathData(loops[i], true); }).join(''); }

  // An outline drawing: regions filled (inner regions darker), every loop outlined.
  function outlineSvg(loops) {
    var dep = depths(loops), all = loops.map(function (l, i) { return i; });
    var odd = all.filter(function (i) { return dep[i] % 2 === 1; });
    var svg = SV.el('svg', { viewBox: [-VB, -VB, 2 * VB, 2 * VB], preserveAspectRatio: 'xMidYMid meet', class: 'ex-slice-svg', 'aria-hidden': 'true', focusable: 'false' });
    var g = SV.el('g', { transform: 'scale(1 -1)' });
    g.appendChild(SV.el('path', { d: loopsPath(loops, all), class: 'ex-slice-region', 'fill-rule': 'evenodd' }));
    if (odd.length) g.appendChild(SV.el('path', { d: loopsPath(loops, odd), class: 'ex-slice-region ex-slice-region--inner' }));
    g.appendChild(SV.el('path', { d: loopsPath(loops, all), class: 'ex-slice-outline' }));
    svg.appendChild(g);
    return { svg: svg, g: g };
  }

  function drawOption(el, item, i, ctx) {
    if (!st) mount(ctx);
    newItem(item);
    var o = item.options[i], pic = outlineSvg(o.loops);
    var tag = h('span.ex-tag', { hidden: true });
    el.appendChild(h('span.ex-opt.ex-slice-opt', pic.svg, tag));
    st.opts[i] = { el: el, svg: pic.svg, g: pic.g, tag: tag, ghost: null };
  }

  function optionLabel(item, i) { return 'Outline ' + (i + 1); }
  function gridCols() { return 4; }

  /* ---------- reveal: what every option is, ≤ 700 ms ---------- */

  var TAGS = { key: '✓ The cut face', ego: 'Seen at a slant', cut: 'Another cut', 'cut-ego': 'Another cut', solid: 'Another solid', 'solid-ego': 'Another solid', proj: 'Outline of the solid' };
  function reveal(item, response, result, ctx) {
    if (!st) return Promise.resolve();
    st.root.classList.add('is-revealed');
    st.opts.forEach(function (o, i) {
      if (!o) return;
      var kind = item.options[i].kind;
      o.tag.textContent = TAGS[kind] || '';
      o.tag.setAttribute('data-kind', i === item.key ? 'key' : 'foil');
      o.tag.hidden = false;
    });
    return timing.wait(ctx && ctx.fast ? 0 : 250);
  }

  /* ---------- show me: cut the solid on the CPU ---------- */

  // Splits every triangle of a prepared mesh by the plane (n, off): the back piece (n·x ≤ off) and
  // the front piece, written into preallocated buffers; returns the vertex counts.
  var SP = new Float64Array(12), SN = new Float64Array(12), DS = [0, 0, 0];
  function side(P, N, o, sign, outP, outN, at) {
    var m = 0, k, c;
    for (k = 0; k < 3; k++) {
      var j = (k + 1) % 3, dk = DS[k] * sign, dj = DS[j] * sign, ok = o + 3 * k, oj = o + 3 * j;
      if (dk >= 0) { for (c = 0; c < 3; c++) { SP[3 * m + c] = P[ok + c]; SN[3 * m + c] = N[ok + c]; } m++; }
      if ((dk > 0 && dj < 0) || (dk < 0 && dj > 0)) {
        var s = dk / (dk - dj);
        for (c = 0; c < 3; c++) { SP[3 * m + c] = P[ok + c] + (P[oj + c] - P[ok + c]) * s; SN[3 * m + c] = N[ok + c] + (N[oj + c] - N[ok + c]) * s; }
        m++;
      }
    }
    for (var q = 1; q + 1 < m; q++) {
      var ix = [0, q, q + 1];
      for (var r = 0; r < 3; r++) for (c = 0; c < 3; c++) { outP[at] = SP[3 * ix[r] + c]; outN[at++] = SN[3 * ix[r] + c]; }
    }
    return at;
  }
  function clipInto(pm, n, off, back, front) {
    var P = pm.P, N = pm.N, bi = 0, fi = 0, c;
    for (var t = 0; t < pm.nt; t++) {
      var o = 9 * t;
      for (var k = 0; k < 3; k++) DS[k] = P[o + 3 * k] * n[0] + P[o + 3 * k + 1] * n[1] + P[o + 3 * k + 2] * n[2] - off;
      if (DS[0] <= 0 && DS[1] <= 0 && DS[2] <= 0) { for (c = 0; c < 9; c++) { back.P[bi] = P[o + c]; back.N[bi++] = N[o + c]; } continue; }
      if (DS[0] >= 0 && DS[1] >= 0 && DS[2] >= 0) { for (c = 0; c < 9; c++) { front.P[fi] = P[o + c]; front.N[fi++] = N[o + c]; } continue; }
      bi = side(P, N, o, -1, back.P, back.N, bi);
      fi = side(P, N, o, 1, front.P, front.N, fi);
    }
    return [bi / 3, fi / 3];
  }
  function upload(g, count) {
    ['position', 'normal'].forEach(function (name) {
      var a = g.getAttribute(name);
      if (a.clearUpdateRanges) { a.clearUpdateRanges(); a.addUpdateRange(0, count * 3); }
      a.needsUpdate = true;
    });
    g.setDrawRange(0, count);
  }

  function initShowMe(it) {
    if (it.sm) return it.sm;
    var M = st.mats, sm = { parts: [], caps: new T.Group(), capBars: bars(M.edge, 4096), headOn: null };
    sm.capBars.renderOrder = 4;
    it.pms.forEach(function (pm) {
      var size = pm.nt * 18, back = { P: new Float32Array(size), N: new Float32Array(size) }, front = { P: new Float32Array(size), N: new Float32Array(size) };
      var gb = geometry(back.P, back.N), gf = geometry(front.P, front.N), sphere = new T.Sphere(v3(pm.center), pm.radius + 0.01);
      gb.boundingSphere = sphere; gf.boundingSphere = sphere.clone();
      var mb = new T.Mesh(gb, pm.outer ? M.outer : it.embedded ? M.inner : M.solid), mf = new T.Mesh(gf, M.ghost);
      mb.renderOrder = pm.outer ? 1 : 0;
      mf.renderOrder = 3;
      it.root.add(mb, mf);
      sm.parts.push({ pm: pm, back: back, front: front, gb: gb, gf: gf, mb: mb, mf: mf });
    });
    it.root.add(sm.caps, sm.capBars);
    it.sm = sm;
    return sm;
  }
  function clearCaps(sm) {
    while (sm.caps.children.length) { var c = sm.caps.children[0]; sm.caps.remove(c); c.geometry.dispose(); }
    sm.capBars.count = 0;
    sm.capSegs = null;
  }
  function hideShowMe(it) {
    var sm = it.sm;
    sm.parts.forEach(function (p) { p.mb.visible = false; p.mf.visible = false; });
    clearCaps(sm);
    it.cut = null;
  }
  function dropShowMe(it) {
    var sm = it.sm;
    clearCaps(sm);
    sm.parts.forEach(function (p) { p.gb.dispose(); p.gf.dispose(); dropObject(p.mb); dropObject(p.mf); });
    dropObject(sm.capBars);
    dropObject(sm.caps);
    it.sm = null;
  }

  function vec2s(l) { return l.map(function (q) { return new T.Vector2(q[0], q[1]); }); }
  // The cut face at plane point q: lib.sectionOf (the generator's own section) as filled shapes
  // in the plane, an inner solid's region in its own colour, every loop outlined.
  function placeCaps(q) {
    var it = st.it, sm = it.sm, M = st.mats, f = it.f;
    clearCaps(sm);
    var sec = null;
    try { sec = lib.sectionOf(it.pms, q, f); } catch (e) { sec = null; }
    if (!sec) return;
    var loops = [];
    sec.forEach(function (s) { s.loops.forEach(function (l) { if (l.length > 2) loops.push(l); }); });
    if (!loops.length) return;
    var dep = depths(loops), outer = [], inner = [], segs = [], eps = 0.002;
    loops.forEach(function (l, i) {
      var sh = new T.Shape(vec2s(l));
      if (dep[i] % 2 === 0) {
        loops.forEach(function (m, j) { if (dep[j] === dep[i] + 1 && inPoly(m[0], l)) sh.holes.push(new T.Path(vec2s(m))); });
        outer.push(sh);
      } else inner.push(sh);
      for (var k = 0; k < l.length; k++) {
        var a = l[k], b = l[(k + 1) % l.length];
        var A = add(q, add(add(mul(f.u, a[0]), mul(f.v, a[1])), mul(f.n, eps)));
        var B = add(q, add(add(mul(f.u, b[0]), mul(f.v, b[1])), mul(f.n, eps)));
        segs.push(A[0], A[1], A[2], B[0], B[1], B[2]);
      }
    });
    var mtx = new T.Matrix4().makeBasis(v3(f.u), v3(f.v), v3(f.n));
    var at = add(q, mul(f.n, eps));
    mtx.setPosition(at[0], at[1], at[2]);
    [[outer, M.cap], [inner, M.capInner]].forEach(function (pair) {
      if (!pair[0].length) return;
      var mesh = new T.Mesh(new T.ShapeGeometry(pair[0]), pair[1]);
      mesh.matrixAutoUpdate = false;
      mesh.matrix.copy(mtx);
      sm.caps.add(mesh);
    });
    sm.capSegs = segs;
  }

  // The head-on frame: the trial's scale (the cut face keeps its size on screen), centred on the
  // solid seen in the plane's own axes.
  function headOnFrame(it, W, H) {
    var sm = it.sm, k = W + 'x' + H;
    if (!sm.headOn || sm.headOn.k !== k) {
      var b = basis(it.item.frame.az, it.item.frame.el), pts = [];
      it.pms.forEach(function (pm) { for (var i = 0; i < pm.V.length; i++) pts.push(pm.V[i]); });
      var fr = fitFrame(extent(pts, b), b, W, H);
      fr.half = Math.max(fr.half, trialFrame().half);
      sm.headOn = { k: k, b: b, fr: fr };
    }
    return sm.headOn;
  }

  // The show-me picture for a state: sweep (plane from sweep.from to its place), lift (the front
  // piece and the plane fade away), cam (the camera turns from the trial view to face the plane).
  function apply(s) {
    var it = st.it, sm = initShowMe(it), item = it.item, last = it.last;
    var size = stageSize(), q = lerp3(item.sweep.from, item.sweep.to, s.sweep), off = dot(q, it.n);
    var a0 = it.angles, daz = ((item.frame.az - a0.az + 540) % 360) - 180;
    var b = basis(a0.az + daz * s.cam, a0.el + (item.frame.el - a0.el) * s.cam);
    var F0 = trialFrame(), F1 = headOnFrame(it, size.W, size.H).fr;
    var fr = { center: lerp3(F0.center, F1.center, s.cam), half: F0.half + (F1.half - F0.half) * s.cam };
    it.camB = b; it.camF = fr;
    st.edgeW = EDGE_PX / pxPerUnit(fr, size.H);
    it.pms.forEach(function (pm) { pm.full.visible = false; });
    it.meet.visible = false; // the cut face and its outline take over
    if (last.sweep !== s.sweep || !it.cut) {
      sm.parts.forEach(function (p) {
        var cnt = clipInto(p.pm, it.n, off, p.back, p.front);
        upload(p.gb, cnt[0]); upload(p.gf, cnt[1]);
        p.bCount = cnt[0]; p.fCount = cnt[1];
      });
      it.cut = { n: it.n, off: off };
      placeCaps(q);
    }
    setBars(sm.capBars, sm.capSegs || [], st.edgeW); // the outline width follows the zoom
    var ghost = 1 - s.lift;
    st.mats.ghost.opacity = 0.16 * ghost;
    sm.parts.forEach(function (p) { p.mb.visible = p.bCount > 0; p.mf.visible = ghost > 0.01 && p.fCount > 0; });
    placePlane(q, ghost);
    placeOutlines(b.dir, it.cut);
    it.last = { sweep: s.sweep };
    render();
  }

  /* ---------- show me: the cut face flies onto the right option ---------- */

  // Similarity maps from the normalised option coordinates N (x right, y up) to viewport px, as
  // { a, e, f } with x' = a·x + e, y' = −a·y + f: on the stage (head-on camera) and on an option.
  function stageMap() {
    var it = st.it, item = it.item, size = stageSize(), ho = headOnFrame(it, size.W, size.H), fr = ho.fr;
    var r = st.v3.canvas.getBoundingClientRect(), k = size.H / (2 * fr.half), nm = item.norm;
    var pc = sub(item.plane.p, fr.center);
    return {
      a: k / nm.s,
      e: r.left + size.W / 2 + (dot(pc, item.frame.u) + nm.cx) * k,
      f: r.top + size.H / 2 - (dot(pc, item.frame.v) + nm.cy) * k,
    };
  }
  function optionMap(i) {
    var o = st.opts[i], r = o.svg.getBoundingClientRect(), k = Math.min(r.width, r.height) / (2 * VB);
    var ox = r.left + (r.width - 2 * VB * k) / 2, oy = r.top + (r.height - 2 * VB * k) / 2;
    return { a: k, e: ox + VB * k, f: oy + VB * k };
  }
  function keyPath(item) { return loopsPath(item.options[item.key].loops, item.options[item.key].loops.map(function (l, i) { return i; })); }

  function clearFly() {
    if (!st) return;
    if (st.fly && st.fly.svg.parentNode) st.fly.svg.parentNode.removeChild(st.fly.svg);
    st.fly = null;
    st.opts.forEach(function (o) { if (o && o.ghost) { if (o.ghost.parentNode) o.ghost.parentNode.removeChild(o.ghost); o.ghost = null; } });
  }
  function flyBegin() {
    clearFly();
    var item = st.it.item;
    if (!st.opts[item.key]) return;
    var svg = SV.el('svg', { 'aria-hidden': 'true', focusable: 'false' });
    svg.style.cssText = 'position:fixed;left:0;top:0;width:100vw;height:100vh;overflow:visible;pointer-events:none;z-index:60';
    var g = SV.el('g');
    g.appendChild(SV.el('path', { d: keyPath(item), 'fill-rule': 'evenodd', style: 'fill:var(--stim-target,#0B6A86);fill-opacity:0.18;stroke:var(--stim-target,#0B6A86);stroke-width:3px;stroke-dasharray:7 4;stroke-linejoin:round;vector-effect:non-scaling-stroke' }));
    svg.appendChild(g);
    doc.body.appendChild(svg);
    st.fly = { svg: svg, g: g, A: stageMap(), B: optionMap(item.key) };
    flyAt(0);
  }
  function flyAt(k) {
    var F = st.fly;
    if (!F) return;
    var a = F.A.a + (F.B.a - F.A.a) * k, e = F.A.e + (F.B.e - F.A.e) * k, f = F.A.f + (F.B.f - F.A.f) * k;
    F.g.setAttribute('transform', 'matrix(' + [a, 0, 0, -a, e, f].map(function (x) { return x.toFixed(3); }).join(' ') + ')');
  }
  // The flown outline stays on the right option, drawn inside its own picture.
  function landed() {
    clearFly();
    var item = st.it.item, o = st.opts[item.key];
    if (!o) return;
    o.ghost = SV.el('path', { d: keyPath(item), 'fill-rule': 'evenodd', class: 'ex-slice-ghost' });
    o.g.appendChild(o.ghost);
  }

  function focusOption(i) {
    st.opts.forEach(function (o, j) {
      if (!o) return;
      var b = o.el.closest ? o.el.closest('.px-choice') : null;
      if (b) b.classList.toggle('ex-focus', j === i);
    });
  }
  function point(which) {
    Object.keys(st.labels).forEach(function (k) { st.labels[k].classList.toggle('is-pointed', k === which); });
  }
  // Back to a clean start for a step: no flight, no ghost, no focus, no pointed label.
  function reset() { clearFly(); focusOption(-1); point(null); }

  /* ---------- show me: the steps ---------- */

  var WHY = { cut: 'whyCut', 'cut-ego': 'whyCut', solid: 'whySolid', 'solid-ego': 'whySolid', proj: 'whyProj' };
  function steps(item, response) {
    var key = item.key, ego = -1;
    item.options.forEach(function (o, i) { if (o.kind === 'ego') ego = i; });
    var picked = typeof response === 'number' && response >= 0 && response < item.options.length ? response : -1;
    var deg = Math.acos(U.clamp(dot(item.view.dir, item.plane.n), -1, 1)) / DEG;
    var at = function (sweep, lift, cam) { return function () { reset(); apply({ sweep: sweep, lift: lift, cam: cam }); }; };
    var list = [
      { ms: 2600, caption: cap('sweep'), enter: at(0, 0, 0), update: function (k) { apply({ sweep: ease(k), lift: 0, cam: 0 }); } },
      { ms: 1200, caption: cap('lift'), enter: at(1, 0, 0), update: function (k) { apply({ sweep: 1, lift: k, cam: 0 }); } },
    ];
    if (ego >= 0) {
      list.push({
        ms: 2400, caption: cap(picked === ego ? 'slantPicked' : 'slant', { n: ego + 1 }),
        enter: function () { at(1, 1, 0)(); focusOption(ego); },
        exit: function () { focusOption(-1); },
      });
    }
    list.push({ ms: Math.round(900 + 1500 * Math.min(1, deg / 90)), caption: cap('turn'), enter: at(1, 1, 0), update: function (k) { apply({ sweep: 1, lift: 1, cam: ease(k) }); } });
    list.push({
      ms: 1500, caption: cap('land', { n: key + 1 }),
      enter: function () { at(1, 1, 1)(); flyBegin(); },
      update: function (k) { flyAt(ease(k)); },
      exit: function () { landed(); focusOption(key); },
    });
    if (picked >= 0 && picked !== key && picked !== ego && WHY[item.options[picked].kind]) {
      list.push({
        ms: 2400, caption: cap(WHY[item.options[picked].kind], { n: picked + 1 }),
        enter: function () { at(1, 1, 1)(); landed(); focusOption(picked); },
      });
    }
    return list;
  }

  // Minimal step runner for players without ctx.play (no controls; honours fast).
  function runSteps(list, ctx, opts) {
    var scale = ctx && ctx.fast ? 0.02 : 1;
    return new Promise(function (resolve) {
      var i = -1, start = 0, go = true;
      function begin(now) {
        i++;
        if (i >= list.length) { resolve(); return false; }
        start = now;
        var s = list[i];
        if (s.caption && opts && opts.caption) opts.caption(s.caption);
        if (s.enter) s.enter();
        return true;
      }
      timing.loop(function (dt, now) {
        if (go) { go = false; if (!begin(now)) return false; }
        var s = list[i], k = U.clamp((now - start) / Math.max(1, s.ms * scale), 0, 1);
        if (s.update) s.update(k);
        if (k >= 1) { if (s.exit) s.exit(); if (!begin(now)) return false; }
        return true;
      });
    });
  }
  function play(list, ctx, opts) {
    var o = opts || {};
    if (!o.caption) o.caption = function (text) { if (st) st.caption.textContent = text; };
    if (ctx && typeof ctx.play === 'function') return ctx.play(list, o);
    return runSteps(list, ctx, o);
  }

  // Show me plays on the stage: bring it into view first (on a phone the options and the feedback
  // bar can push it off the top of the screen).
  function revealStage(ctx) {
    try {
      var r = st.stage.getBoundingClientRect(), vh = win.innerHeight || doc.documentElement.clientHeight;
      if (r.top < 0 || r.bottom > vh) st.stage.scrollIntoView({ block: 'start', behavior: ctx && (ctx.fast || ctx.reducedMotion) ? 'auto' : 'smooth' });
    } catch (e) { /* not fatal */ }
  }

  function showMe(item, response, ctx) {
    if (!st || !st.v3 || !st.it || st.it.item !== item) return Promise.resolve();
    revealStage(ctx);
    return play(steps(item, response), ctx, { name: 'show-me' });
  }

  // Tutorial: the parts first, then the same solution.
  function demo(item, ctx, caption) {
    if (!st || !st.v3 || !st.it || st.it.item !== item) return Promise.resolve();
    var trial = function (which) { return function () { reset(); showTrial(); point(which); }; };
    var intro = [
      { ms: 1800, caption: cap('solid'), enter: trial('solid'), exit: function () { point(null); } },
      { ms: 2000, caption: cap('plane'), enter: trial('plane'), exit: function () { point(null); } },
      { ms: 2000, caption: cap('options'), enter: trial(null) },
    ];
    revealStage(ctx);
    return play(intro.concat(steps(item, null)), ctx, { name: 'demo', caption: caption || null });
  }

  function unmount() {
    if (!st) return;
    clearFly();
    st.offs.forEach(function (off) { off(); });
    dropItem();
    if (st.mats) Object.keys(st.mats).forEach(function (k) { st.mats[k].dispose(); });
    if (st.v3) st.v3.detach();
    if (st.root.parentNode) st.root.parentNode.removeChild(st.root);
    st = null;
  }

  PX.ex.view('slice', {
    layout: 'stem+options',
    needs: 'webgl',
    css: true,
    mount: mount,
    present: present,
    drawOption: drawOption,
    optionLabel: optionLabel,
    gridCols: gridCols,
    reveal: reveal,
    showMe: showMe,
    demo: demo,
    unmount: unmount,
    // for tests: the steps show-me would play (same model as the key)
    steps: function (item, response) { return st && st.it ? steps(item, response) : []; },
    // for tests: what the 3D picture draws now (outline bars, the plane's meet line)
    inspect: function () {
      if (!st || !st.it) return null;
      var it = st.it;
      return { edges: it.edges.count, soft: it.soft.count, meet: it.meet.visible ? it.meet.count : 0, edgeOrder: it.edges.renderOrder, planeOrder: it.quad.renderOrder };
    },
  });
})(window.PX);
