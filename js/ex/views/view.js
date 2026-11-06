/* EX-07 Views: view (DOM, SVG and 3D through PX.core.stage3d; ARCHITECTURE.md §6).
   layout 'stem+options', drawn from the item's own model (def.lib):
   - toview: the structure in 3D (unit cubes with outlines on a grid plate, orthographic camera
     from the front-right-top corner, as the validator's isometric model) with an arrow from the
     asked side; options are SVG line drawings at one common scale.
   - toobject: the stem is the three views in third-angle layout (top above front, right beside
     front, one common scale); options are structures (stage3d snapshots made in drawOption, the
     ready phase).
   - count: the structure in 3D; options are numbers.
   Show me (ctx.play steps): the camera moves from the corner to the view direction, the drawing
   (lib.view of the same height map) is traced over the picture line by line, the cubes fade, and
   the drawing flies onto the right option (toview) or onto each stem drawing (toobject, for the
   key structure and for a wrongly chosen one); count highlights the columns one by one with their
   heights and ends on the top view. Every step's enter() sets the full state of its start. */
(function (PX) {
  'use strict';

  var win = window, doc = document, T = win.THREE, S3 = PX.core.stage3d, timing = PX.core.timing, U = PX.util;
  var h = PX.ui.h, SV = PX.core.svg;
  var def = PX.ex.get('views'), lib = def.lib;
  var st = null;

  var DEG = Math.PI / 180;
  var ISO = { az: 45, el: Math.atan(1 / Math.SQRT2) / DEG };            // camera on +x +y +z
  var DIRS = { top: { az: 0, el: 90 }, front: { az: 0, el: 0 }, right: { az: 90, el: 0 }, back: { az: 180, el: 0 }, left: { az: -90, el: 0 } };
  var NAMES = { top: 'top', front: 'front', right: 'right', back: 'back', left: 'left' };
  var CAM_D = 40, MARGIN = 1.14;

  function learn() { return PX.ex.learn('views') || {}; }
  function cap(key, vars) {
    var s = String((learn().captions || {})[key] || '');
    if (vars) for (var k in vars) s = s.split('{' + k + '}').join(String(vars[k]));
    return s;
  }
  function ease(k) { return k * k * (3 - 2 * k); }
  function dot(a, b) { return a[0] * b[0] + a[1] * b[1] + a[2] * b[2]; }
  function add(a, b) { return [a[0] + b[0], a[1] + b[1], a[2] + b[2]]; }
  function mul(a, s) { return [a[0] * s, a[1] * s, a[2] * s]; }
  function lerp3(a, b, k) { return [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k, a[2] + (b[2] - a[2]) * k]; }
  function upper(s) { return s.charAt(0).toUpperCase() + s.slice(1); }
  function maxH(hm) { var m = 0; hm.forEach(function (r) { r.forEach(function (v) { if (v > m) m = v; }); }); return m; }

  /* ---------- camera: orthographic on an orbit (az from +z toward +x, el up, degrees) ---------- */

  function basis(az, el) {
    var a = az * DEG, e = el * DEG, sa = Math.sin(a), ca = Math.cos(a), se = Math.sin(e), ce = Math.cos(e);
    return { dir: [sa * ce, se, ca * ce], right: [ca, 0, -sa], up: [-sa * se, ce, -ca * se] };
  }
  function extent(pts, b) {
    var x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
    pts.forEach(function (p) {
      var x = dot(p, b.right), y = dot(p, b.up);
      if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y;
    });
    return { cx: (x0 + x1) / 2, cy: (y0 + y1) / 2, hw: Math.max(0.5, (x1 - x0) / 2), hh: Math.max(0.5, (y1 - y0) / 2) };
  }
  function fitFrame(pts, b, W, H, margin) {
    var ex = extent(pts, b), aspect = W / Math.max(1, H);
    return { center: add(mul(b.right, ex.cx), mul(b.up, ex.cy)), half: Math.max(ex.hh, ex.hw / aspect) * (margin || MARGIN) };
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
  // Viewport px of a world point for a camera state (basis, frame) in a stage rect.
  function toScreen(p, b, fr, rect) {
    var k = rect.height / (2 * fr.half), q = [p[0] - fr.center[0], p[1] - fr.center[1], p[2] - fr.center[2]];
    return [rect.left + rect.width / 2 + dot(q, b.right) * k, rect.top + rect.height / 2 - dot(q, b.up) * k];
  }

  /* ---------- the scene: cubes on a grid plate, centred on the plate ---------- */

  // World: cube (x, y, z) of the height map is centred at (x − (G − 1)/2, y + ½, z − (G − 1)/2);
  // the plate lies on y = 0 from −G/2 to G/2; +z is the front, +x the right.
  function cubes(hm) { return lib.cubesOf(hm); }
  function makeStructure(hm) {
    var G = hm.length, g = S3.cubeGroup(cubes(hm), { center: false });
    g.position.set(-(G - 1) / 2, 0.5, -(G - 1) / 2);
    return g;
  }
  // The base board: grid lines over cells x0…x1, z0…z1 of a G × G grid (default: all of it) on a
  // board PAD wider on every side, whose front edge is drawn thick (the side the drawings call
  // "front"; in front of the cubes, so it shows even when the front row is full).
  var PAD = 0.35;
  function makePlate(G, M, r) {
    r = r || { x0: 0, x1: G - 1, z0: 0, z1: G - 1 };
    var o = (G - 1) / 2, X0 = r.x0 - o - 0.5, X1 = r.x1 - o + 0.5, Z0 = r.z0 - o - 0.5, Z1 = r.z1 - o + 0.5;
    var g = new T.Group(), w = X1 - X0, d = Z1 - Z0;
    var plate = new T.Mesh(new T.PlaneGeometry(w + 2 * PAD, d + 2 * PAD), M.plate);
    plate.rotation.x = -Math.PI / 2;
    plate.position.set((X0 + X1) / 2, -0.004, (Z0 + Z1) / 2);
    var pts = [], i;
    for (i = 0; i <= w + 1e-9; i++) pts.push(X0 + i, 0, Z0, X0 + i, 0, Z1);
    for (i = 0; i <= d + 1e-9; i++) pts.push(X0, 0, Z0 + i, X1, 0, Z0 + i);
    var lg = new T.BufferGeometry();
    lg.setAttribute('position', new T.Float32BufferAttribute(pts, 3));
    var lines = new T.LineSegments(lg, M.grid);
    lines.position.y = 0.002;
    var front = new T.Mesh(new T.BoxGeometry(w + 2 * PAD, 0.05, 0.09), M.edge);
    front.position.set((X0 + X1) / 2, 0, Z1 + PAD);
    g.add(plate, lines, front);
    g.userData.rect = { X0: X0 - PAD, X1: X1 + PAD, Z0: Z0 - PAD, Z1: Z1 + PAD };
    return g;
  }
  // An arrow pointing at the structure from the asked side (shaft and head along −dir).
  function makeArrow(M) {
    var g = new T.Group();
    var shaft = new T.Mesh(new T.CylinderGeometry(0.07, 0.07, 1, 16), M.arrow);
    var head = new T.Mesh(new T.ConeGeometry(0.2, 0.45, 20), M.arrow);
    g.add(shaft, head);
    g.userData = { shaft: shaft, head: head };
    return g;
  }
  // Tail and tip of the arrow for a view of a structure (grid G, height H).
  function arrowEnds(view, G, H) {
    var y = Math.max(0.8, Math.min(H, 2) / 2 + 0.3), s = G / 2 + PAD;
    if (view === 'top') return { tail: [0, H + 2.3, 0], tip: [0, H + 0.45, 0] };
    if (view === 'front') return { tail: [0, y, s + 1.9], tip: [0, y, s + 0.15] };
    return { tail: [s + 1.9, y, 0], tip: [s + 0.15, y, 0] };
  }
  function placeArrow(a, ends) {
    var tail = ends.tail, tip = ends.tip, d = [tip[0] - tail[0], tip[1] - tail[1], tip[2] - tail[2]];
    var len = Math.sqrt(dot(d, d)), u = mul(d, 1 / len), headLen = 0.45;
    var q = new T.Quaternion().setFromUnitVectors(new T.Vector3(0, 1, 0), new T.Vector3(u[0], u[1], u[2]));
    a.userData.shaft.quaternion.copy(q);
    a.userData.shaft.scale.set(1, len - headLen, 1);
    var mid = add(tail, mul(u, (len - headLen) / 2));
    a.userData.shaft.position.set(mid[0], mid[1], mid[2]);
    a.userData.head.quaternion.copy(q);
    var hp = add(tip, mul(u, -headLen / 2));
    a.userData.head.position.set(hp[0], hp[1], hp[2]);
  }

  function makeMaterials() {
    return {
      plate: new T.MeshBasicMaterial(),
      grid: new T.LineBasicMaterial(),
      edge: new T.MeshBasicMaterial(),
      arrow: new T.MeshLambertMaterial(),
    };
  }
  function tintMaterials(M) {
    var c = S3.colors(), dark = c.ground.r + c.ground.g + c.ground.b < 1.2;
    M.plate.color.copy(c.ground).lerp(c.face3, dark ? 0.18 : 0.16);
    M.grid.color.copy(c.ground).lerp(c.edge, dark ? 0.35 : 0.28);
    M.edge.color.copy(c.edge);
    M.arrow.color.copy(c.target);
    M.arrow.emissive.copy(c.target).multiplyScalar(0.35);
  }

  // Points that a frame must contain: the plate, the structure's box, the arrow.
  function framePoints(G, H, ends) {
    var s = G / 2 + PAD, pts = [];
    [-s, s].forEach(function (x) { [-s, s].forEach(function (z) { pts.push([x, 0, z], [x, H, z]); }); });
    if (ends) {
      pts.push(ends.tail, ends.tip);
      // The asked-view tag sits 0.45 beyond the tail (render): keep it and its half height inside.
      var d = [ends.tail[0] - ends.tip[0], ends.tail[1] - ends.tip[1], ends.tail[2] - ends.tip[2]], l = Math.sqrt(dot(d, d)) || 1;
      pts.push(add(ends.tail, mul(d, 1.05 / l)));
    }
    return pts;
  }
  // The structure's own box (for views straight on: the drawing fills the frame).
  function boxPoints(hm) {
    var G = hm.length, x0 = G, x1 = -1, z0 = G, z1 = -1, H = 0;
    for (var z = 0; z < G; z++) for (var x = 0; x < G; x++) if (hm[z][x] > 0) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); z0 = Math.min(z0, z); z1 = Math.max(z1, z); H = Math.max(H, hm[z][x]); }
    var o = (G - 1) / 2, pts = [];
    [x0 - 0.5 - o, x1 + 0.5 - o].forEach(function (x) { [z0 - 0.5 - o, z1 + 0.5 - o].forEach(function (zz) { pts.push([x, 0, zz], [x, H, zz]); }); });
    return pts;
  }

  /* ---------- drawings: lines in cells (origin bottom left, y up), one scale per item ---------- */

  // Crop offsets and filled cells of a view of a height map, in the drawing's own cells.
  function viewCells(hm, dir, mirrored) {
    var img = lib.depthImage(hm, dir), i0 = Infinity, j0 = Infinity, i1 = -1, cells = [], i, j;
    for (j = 0; j < img.length; j++) for (i = 0; i < img[j].length; i++) if (img[j][i] >= 0) { i0 = Math.min(i0, i); j0 = Math.min(j0, j); i1 = Math.max(i1, i); }
    for (j = 0; j < img.length; j++) for (i = 0; i < img[j].length; i++) if (img[j][i] >= 0) cells.push([mirrored ? i1 - i : i - i0, j - j0]);
    return { i0: i0, j0: j0, cells: cells };
  }
  function sameLines(a, b) { return JSON.stringify(a.lines) === JSON.stringify(b.lines) && a.w === b.w && a.h === b.h; }
  // Where an option's drawing comes from (to fill its cells): checked against the stored lines.
  function sourceOf(item, o) {
    var src = o.kind === 'direction' ? { hm: item.heights, dir: o.from } :
      o.kind === 'mirror' ? { hm: item.heights, dir: item.view, mirrored: true } :
      o.kind === 'neighbour' ? { hm: o.heights, dir: item.view } : { hm: item.heights, dir: item.view };
    if (!src.hm || !src.dir) return null;
    var d = lib.view(src.hm, src.dir);
    if (src.mirrored) d = lib.mirror(d);
    return sameLines(d, o.drawing) ? src : null;
  }
  function linesPath(d, ox, oy, k) {
    return d.lines.map(function (l) {
      return 'M' + SV.pathData([[ox + l[0] * k, oy - l[1] * k], [ox + l[2] * k, oy - l[3] * k]]).slice(1);
    }).join('');
  }
  function cellsPath(cells, ox, oy, k) {
    var e = 0.02 * k; // a hair of overlap, so neighbouring cells show no seam
    return cells.map(function (c) {
      var x = ox + c[0] * k - e, y = oy - (c[1] + 1) * k - e, s = k + 2 * e;
      return 'M' + SV.pathData([[x, y], [x + s, y], [x + s, y + s], [x, y + s]], true).slice(1);
    }).join('');
  }
  // An option drawing: M × M cells (the item's largest drawing), centred.
  function drawingSvg(d, M, cells) {
    var pad = 0.4, size = M + 2 * pad;
    var svg = SV.el('svg', { viewBox: [-pad, -pad, size, size], preserveAspectRatio: 'xMidYMid meet', class: 'ex-views-svg', 'aria-hidden': 'true', focusable: 'false' });
    var ox = (M - d.w) / 2, oy = (M - d.h) / 2 + d.h, g = SV.el('g');
    if (cells) g.appendChild(SV.el('path', { d: cellsPath(cells, ox, oy, 1), class: 'ex-views-fill' }));
    g.appendChild(SV.el('path', { d: linesPath(d, ox, oy, 1), class: 'ex-views-line' }));
    svg.appendChild(g);
    return { svg: svg, g: g, pad: pad, size: size, ox: ox, oy: oy };
  }

  // Third-angle layout of the three views in a W × H box: top above front, right beside front.
  function threeLayout(views, W, H) {
    var t = views.top, f = views.front, r = views.right, lab = 22, gapC = 1.1;
    var cw = (W - 24) / (f.w + r.w + gapC), ch = (H - 24 - 2 * lab) / (t.h + f.h + gapC);
    var c = Math.max(6, Math.min(cw, ch, 52)), gap = gapC * c;
    var totW = (f.w + r.w) * c + gap, totH = (t.h + f.h) * c + gap + 2 * lab;
    var x0 = (W - totW) / 2, y0 = (H - totH) / 2 + lab;
    var fy = y0 + t.h * c + gap + f.h * c; // the front and right views' bottom line
    return {
      c: c,
      top: { x: x0, y: y0 + t.h * c, label: [x0 + t.w * c / 2, y0 - 8] },
      front: { x: x0, y: fy, label: [x0 + f.w * c / 2, fy + lab - 4] },
      right: { x: x0 + f.w * c + gap, y: fy, label: [x0 + f.w * c + gap + r.w * c / 2, fy + lab - 4] },
    };
  }
  function drawThree(item, box) {
    var svg = st.drawSvg;
    PX.ui.clear(svg);
    SV.attrs(svg, { viewBox: [0, 0, box.w, box.h] });
    place(svg, box.x, box.y, box.w, box.h);
    var L = threeLayout(item.views, box.w, box.h);
    st.three = { L: L, box: box, marks: {} };
    ['top', 'front', 'right'].forEach(function (v) {
      var d = item.views[v], at = L[v], cells = viewCells(item.heights, v).cells;
      var g = SV.el('g', { class: 'ex-views-three ex-views-three--' + v });
      g.appendChild(SV.el('path', { d: cellsPath(cells, at.x, at.y, L.c), class: 'ex-views-fill' }));
      g.appendChild(SV.el('path', { d: linesPath(d, at.x, at.y, L.c), class: 'ex-views-line' }));
      g.appendChild(SV.text(at.label[0], at.label[1], upper(v), { class: 'ex-views-dlabel' }));
      svg.appendChild(g);
      st.three.marks[v] = g;
    });
  }

  /* ---------- labels on the 3D picture (HTML, placed at projected points) ---------- */

  function setTag(el, p, on) {
    if (!on) { el.hidden = true; return; }
    el.hidden = false;
    el.style.left = Math.round(p[0]) + 'px';
    el.style.top = Math.round(p[1]) + 'px';
  }
  function local(p) { return [p[0] + st.d3.offsetLeft, p[1] + st.d3.offsetTop]; }
  // Keeps a tag wholly inside the 3D picture (W × H), its size estimated from its text (mono,
  // upper case, 0.75 rem, letter-spaced), so the stage edge never cuts it.
  function inside(p, text, W, H) {
    var w = String(text || '').length * 8 + 14, hh = 20, ox = st.d3.offsetLeft, oy = st.d3.offsetTop;
    return [U.clamp(p[0], ox + w / 2 + 2, ox + Math.max(w / 2 + 2, W - w / 2 - 2)), U.clamp(p[1], oy + hh / 2 + 2, oy + Math.max(hh / 2 + 2, H - hh / 2 - 2))];
  }
  // Removes an object made here (geometry freed; the view's own materials are kept for reuse).
  function dropTree(obj) {
    if (!obj) return;
    if (obj.parent) obj.parent.remove(obj);
    obj.traverse(function (x) { if (x.geometry && !(x.geometry.userData && x.geometry.userData.shared)) x.geometry.dispose(); });
  }

  // Draws the 3D picture for the current camera state and moves the labels along.
  function render() {
    if (!st || !st.v3 || !st.cur || !st.cur.b) return;
    var v = st.v3, c = st.cur;
    if (!v.width || !v.height) v.resize();
    var W = v.width || 1, H = v.height || 1;
    placeCam(st.cam, c.b, c.fr, W, H);
    v.render(st.scene, st.cam);
    var item = st.item, G = item.grid, rect = { left: 0, top: 0, width: W, height: H };
    var show = !!c.labels, ends = st.arrowEnds, asking = !!(ends && st.arrow.visible && show);
    // The asked view's tag names its side, so that side's floor label steps aside (no overlap).
    setTag(st.tags.front, local(toScreen([0, 0, G / 2 + PAD + 0.45], c.b, c.fr, rect)), show && c.b.dir[2] > -0.2 && !(asking && st.askView === 'front'));
    setTag(st.tags.right, local(toScreen([G / 2 + PAD + 0.45, 0, 0], c.b, c.fr, rect)), show && c.b.dir[0] > -0.2 && !(asking && st.askView === 'right'));
    var pa = ends ? local(toScreen(add(ends.tail, mul(st.askDir, 0.45)), c.b, c.fr, rect)) : [0, 0];
    setTag(st.tags.ask, asking ? inside(pa, st.tags.ask.textContent, W, H) : pa, asking);
    (st.colTags || []).forEach(function (t) { setTag(t.el, local(toScreen(t.p, c.b, c.fr, rect)), t.on); });
  }

  /* ---------- modes of the stage: the 3D picture, the three drawings, or both side by side ---------- */

  var TOP_PAD = 22;
  function stageBox() { return { w: Math.max(1, st.stage.clientWidth), h: Math.max(1, st.stage.clientHeight) }; }
  function px(v) { return typeof v === 'number' ? v + 'px' : v; }
  function place(el, x, y, w, hh) { el.style.left = px(x); el.style.top = px(y); el.style.width = px(w); el.style.height = px(hh); }
  // mode: 'iso' (3D only), 'draw' (three drawings only), 'split' (drawings and 3D, for show me).
  function setMode(mode) {
    var b = stageBox(), item = st.item;
    st.mode = mode;
    st.root.setAttribute('data-mode', mode);
    st.d3.hidden = mode === 'draw';
    st.drawSvg.style.display = mode === 'iso' ? 'none' : '';
    // Full-stage layers follow the stage's size through CSS (the drawings scale with their viewBox);
    // the split layout of show me is laid out in px when it starts.
    // The drawings keep clear of the stage label (TOP_PAD px at the top).
    if (mode === 'iso') st.d3.style.cssText = '';
    else if (mode === 'draw') { drawThree(item, { x: 0, y: TOP_PAD, w: b.w, h: b.h - TOP_PAD }); place(st.drawSvg, 0, TOP_PAD, '100%', 'calc(100% - ' + TOP_PAD + 'px)'); }
    else {
      var wide = b.w >= 1.25 * b.h;
      if (wide) { var w1 = Math.round(b.w * 0.5); drawThree(item, { x: 0, y: TOP_PAD, w: w1, h: b.h - TOP_PAD }); place(st.d3, w1, 0, b.w - w1, b.h); }
      else { var h1 = Math.round(b.h * 0.5); drawThree(item, { x: 0, y: TOP_PAD, w: b.w, h: h1 - TOP_PAD }); place(st.d3, 0, h1, b.w, b.h - h1); }
    }
    if (st.v3) st.v3.resize();
    SV.attrs(st.ink, { viewBox: [0, 0, b.w, b.h] });
  }

  // Shows height map hm in the 3D picture (with the grid plate), with or without the arrow.
  function showStructure(hm, view) {
    if (st.group) S3.disposeTree(st.group);
    st.group = makeStructure(hm);
    st.scene.add(st.group);
    st.shownH = hm;
    if (st.plate) { dropTree(st.plate); st.plate = null; }
    st.plate = makePlate(hm.length, st.mats);
    st.scene.add(st.plate);
    var H = Math.max(2, maxH(hm));
    st.arrowEnds = view ? arrowEnds(view, hm.length, H) : null;
    st.askDir = null;
    st.askView = view || null;
    st.arrow.visible = !!view;
    if (view) {
      placeArrow(st.arrow, st.arrowEnds);
      var e = st.arrowEnds, d = [e.tail[0] - e.tip[0], e.tail[1] - e.tip[1], e.tail[2] - e.tip[2]], l = Math.sqrt(dot(d, d));
      st.askDir = mul(d, 1 / l);
      st.tags.ask.textContent = upper(view) + ' view';
    }
  }
  // The trial camera: the corner view, fitted to the plate, the structure and the arrow.
  function isoState(hm) {
    var v = st.v3, W = v.width || 1, H = v.height || 1, b = basis(ISO.az, ISO.el);
    return { b: b, fr: fitFrame(framePoints(hm.length, Math.max(2, maxH(hm)), st.arrowEnds), b, W, H), labels: true };
  }

  function themeChanged() {
    if (!st) return;
    tintMaterials(st.mats);
    var g = S3.colors().ground;
    st.scene.background.copy(g);
    render();
    // Thumbnails are pictures: repaint them in the new colours (outside any stimulus phase).
    if (st.item && st.item.variant === 'toobject') st.opts.forEach(function (o, i) { if (o && o.canvas) snapshotOption(st.item, i, o.w, o.canvas); });
  }

  function describe(item) {
    var n = lib.total(item.heights);
    if (item.variant === 'toview') return 'A structure of ' + n + ' cubes on a ' + item.grid + ' by ' + item.grid + ' grid, seen from the front right corner, with an arrow from the ' + item.view + '. Which of four line drawings is its ' + item.view + ' view?';
    if (item.variant === 'toobject') return 'The top, front and right views of a structure. Which of four structures, seen from the front right corner, has exactly these views?';
    return 'A structure of cubes on a ' + item.grid + ' by ' + item.grid + ' grid, seen from the front right corner; every cube shows at least one face. How many cubes are there?';
  }

  /* ---------- view functions ---------- */

  function mount(ctx) {
    var root = h('div.ex-views-stem');
    var stage = h('div.ex-stage.ex-views-stage');
    var d3 = h('div.ex-views-3d');
    var drawSvg = SV.el('svg', { class: 'ex-views-draw', 'aria-hidden': 'true', focusable: 'false' });
    var ink = SV.el('svg', { class: 'ex-views-ink', 'aria-hidden': 'true', focusable: 'false' });
    var label = h('span.ex-label.ex-views-label', 'Structure');
    var tags = {
      front: h('span.ex-views-tag', { hidden: true }, 'Front'),
      right: h('span.ex-views-tag', { hidden: true }, 'Right'),
      ask: h('span.ex-views-tag.ex-views-tag--ask', { hidden: true }, ''),
    };
    var caption = h('p.ex-caption', { 'aria-live': 'polite' });
    var verdict = h('div.ex-verdict.ex-views-verdict', { hidden: true, role: 'status' });
    var hint = h('p.ex-views-hint', { hidden: true }, 'In the options, the thick edge of each base is the front.');
    var desc = h('p.px-sr');
    [d3, drawSvg, ink, label, tags.front, tags.right, tags.ask].forEach(function (x) { stage.appendChild(x); });
    root.appendChild(stage);
    root.appendChild(h('div.ex-views-under', h('div.ex-views-lines', hint, caption), verdict));
    root.appendChild(desc);
    ctx.host.appendChild(root);
    st = { ctx: ctx, root: root, stage: stage, d3: d3, drawSvg: drawSvg, ink: ink, label: label, tags: tags, caption: caption,
      verdict: verdict, hint: hint, desc: desc, v3: null, scene: null, cam: null, mats: null, group: null, plate: null, arrow: null,
      item: null, optItem: null, opts: [], offs: [], cur: null, mode: 'iso', colTags: [], fly: null, opt: null };
    if (!S3.available()) {
      stage.appendChild(h('p.ex-unavailable', { role: 'alert' }, 'This exercise needs 3D graphics, which are not available here: ' + S3.reason() + '.'));
      return;
    }
    st.v3 = S3.attach(d3);
    st.v3.redraw = render;
    st.scene = new T.Scene();
    st.scene.background = S3.colors().ground.clone();
    S3.lights(st.scene);
    st.cam = new T.OrthographicCamera(-1, 1, 1, -1, 0.1, 2 * CAM_D);
    st.mats = makeMaterials();
    tintMaterials(st.mats);
    st.arrow = makeArrow(st.mats);
    st.arrow.visible = false;
    st.scene.add(st.arrow);
    st.offs.push(PX.bus.on('stage3d:theme', themeChanged));
    // The offscreen scene for option thumbnails (toobject).
    var os = new T.Scene();
    os.background = S3.colors().ground.clone();
    S3.lights(os);
    st.opt = { scene: os, cam: new T.OrthographicCamera(-1, 1, 1, -1, 0.1, 2 * CAM_D), group: null, plate: null };
    // Warm-up: compile the shaders and touch the snapshot path now, not in the first trial.
    showStructure([[1, 0], [0, 0]], 'top');
    st.cur = isoState([[1, 0], [0, 0]]);
    placeCam(st.cam, st.cur.b, st.cur.fr, 1, 1);
    S3.compile(st.scene, st.cam);
    st.cur = null;
  }

  function isoLike(item) { return item.variant !== 'toobject'; }

  // drawOption runs in the ready phase, before present: the first call for a new item sets the
  // item up (structure in the scene; for toobject the thumbnails' common frame).
  function newItem(item) {
    if (st.optItem === item) return;
    st.optItem = item;
    st.opts = [];
    clearFly();
    if (item.variant === 'toview') st.M = Math.max.apply(null, item.options.map(function (o) { return Math.max(o.drawing.w, o.drawing.h); }));
    if (item.variant === 'toobject') {
      // Thumbnails share one frame: the cells any option uses (its plate) and the tallest stack.
      var G = item.grid, r = { x0: G, x1: -1, z0: G, z1: -1 }, H = 2;
      item.options.forEach(function (o) {
        for (var z = 0; z < G; z++) for (var x = 0; x < G; x++) if (o.heights[z][x] > 0) {
          r.x0 = Math.min(r.x0, x); r.x1 = Math.max(r.x1, x); r.z0 = Math.min(r.z0, z); r.z1 = Math.max(r.z1, z); H = Math.max(H, o.heights[z][x]);
        }
      });
      st.optRect = r; st.optH = H;
    }
  }

  function snapshotOption(item, i, w, canvas) {
    var o = st.opt, hm = item.options[i].heights;
    if (o.group) S3.disposeTree(o.group);
    if (o.plate) dropTree(o.plate);
    o.group = makeStructure(hm); o.plate = makePlate(hm.length, st.mats, st.optRect);
    o.scene.add(o.group, o.plate);
    var b = basis(ISO.az, ISO.el), R = o.plate.userData.rect, pts = [];
    [R.X0, R.X1].forEach(function (x) { [R.Z0, R.Z1].forEach(function (z) { pts.push([x, 0, z], [x, st.optH, z]); }); });
    placeCam(o.cam, b, fitFrame(pts, b, 1, 1, 1.04), 1, 1); // a tight frame: the cubes as large as the thumbnail allows
    // transparent: the choice cell's own background (and its right/wrong wash) shows through
    return S3.snapshot(o.scene, o.cam, w, w, { fluid: true, canvas: canvas, transparent: true });
  }

  function drawOption(el, item, i, ctx) {
    if (!st) mount(ctx);
    newItem(item);
    var tag = h('span.ex-tag', { hidden: true }), o = item.options[i];
    if (item.variant === 'count') {
      el.appendChild(h('span.ex-answer.ex-views-count', h('span.ex-answer-text', String(o)), h('span.ex-views-unit', 'cubes')));
      st.opts[i] = { el: el, tag: null };
      return;
    }
    if (item.variant === 'toview') {
      var src = sourceOf(item, o), cells = src ? viewCells(src.hm, src.dir, src.mirrored).cells : null;
      var pic = drawingSvg(o.drawing, st.M, cells);
      el.appendChild(h('span.ex-opt.ex-views-opt', pic.svg, tag));
      st.opts[i] = { el: el, tag: tag, pic: pic, ghost: null };
      return;
    }
    var w = Math.max(72, Math.min(320, Math.round(el.clientWidth || 150)));
    var canvas = st.v3 ? snapshotOption(item, i, w) : h('canvas', { width: w, height: w });
    canvas.className = 'ex-thumb';
    canvas.setAttribute('aria-hidden', 'true');
    el.appendChild(h('span.ex-opt.ex-views-opt', canvas, tag));
    st.opts[i] = { el: el, tag: tag, canvas: canvas, w: w };
  }

  function optionLabel(item, i) {
    if (item.variant === 'count') return item.options[i] + ' cubes';
    return (item.variant === 'toview' ? 'Drawing ' : 'Structure ') + (i + 1);
  }
  function gridCols() { return 4; }

  function present(item, ctx) {
    if (!st) mount(ctx);
    newItem(item);
    st.item = item;
    st.root.setAttribute('data-variant', item.variant);
    st.root.classList.remove('is-revealed');
    st.verdict.hidden = true;
    st.caption.textContent = '';
    st.desc.textContent = describe(item);
    st.label.textContent = item.variant === 'toobject' ? 'Three views' : 'Structure';
    st.hint.hidden = item.variant !== 'toobject';
    clearInk();
    clearColTags();
    if (!st.v3) return timing.nextPaint();
    trialState();
    return timing.nextPaint();
  }
  // The trial picture (also the start of show me and demo).
  function trialState() {
    var item = st.item;
    clearInk();
    if (isoLike(item)) {
      setMode('iso');
      showStructure(item.heights, item.variant === 'toview' ? item.view : null);
      st.cur = isoState(item.heights);
      render();
    } else {
      setMode('draw');
      st.cur = null;
      Object.keys(st.tags).forEach(function (k) { st.tags[k].hidden = true; });
    }
  }

  /* ---------- reveal: what every option is, ≤ 700 ms ---------- */

  function reveal(item, response, result, ctx) {
    if (!st) return Promise.resolve();
    st.root.classList.add('is-revealed');
    if (item.variant === 'count') {
      st.verdict.textContent = '✓ ' + item.options[item.key] + ' cubes';
      st.verdict.setAttribute('data-kind', 'key');
      st.verdict.hidden = false;
    } else {
      st.opts.forEach(function (o, i) {
        if (!o || !o.tag) return;
        var op = item.options[i], text;
        if (i === item.key) text = item.variant === 'toview' ? '✓ ' + upper(item.view) + ' view' : '✓ All three views';
        else if (item.variant === 'toview') text = op.kind === 'direction' ? upper(op.from) + ' view' : op.kind === 'mirror' ? 'Flipped' : 'Other structure';
        else text = 'Differs: ' + ['top', 'front', 'right'].filter(function (v) { return (op.matches || []).indexOf(v) < 0; }).join(', ');
        o.tag.textContent = text;
        o.tag.setAttribute('data-kind', i === item.key ? 'key' : 'foil');
        o.tag.hidden = false;
      });
    }
    return timing.wait(ctx && ctx.fast ? 0 : 250);
  }

  /* ---------- show me: camera moves, tracing, flights ---------- */

  function stageOrigin() { var r = st.stage.getBoundingClientRect(); return [r.left + st.stage.clientLeft, r.top + st.stage.clientTop]; }
  function rect3() {
    var o = stageOrigin(), v = st.v3;
    return { left: o[0] + st.d3.offsetLeft, top: o[1] + st.d3.offsetTop, width: v.width || 1, height: v.height || 1 };
  }
  // The camera looking straight at a side, fitted to the structure itself.
  function viewState(hm, v) {
    var W = st.v3.width || 1, H = st.v3.height || 1, b = basis(DIRS[v].az, DIRS[v].el);
    return { b: b, fr: fitFrame(boxPoints(hm), b, W, H, 1.3), labels: true };
  }
  // The camera k of the way from the corner (A) to a side (B): az, el and frame interpolated.
  function camBetween(A, B, k) {
    var a0 = A.az, a1 = B.az, daz = ((a1 - a0 + 540) % 360) - 180;
    var b = basis(a0 + daz * k, A.el + (B.el - A.el) * k);
    return { b: b, fr: { center: lerp3(A.fr.center, B.fr.center, k), half: A.fr.half + (B.fr.half - A.fr.half) * k }, labels: true };
  }
  function moveCam(hm, v, k) {
    var I = isoState(hm), F = viewState(hm, v);
    I.az = ISO.az; I.el = ISO.el; F.az = DIRS[v].az; F.el = DIRS[v].el;
    st.cur = camBetween(I, F, k);
    // On the way the frame keeps the whole board in view, then closes in on the structure.
    var W = st.v3.width || 1, H = st.v3.height || 1, mid = fitFrame(framePoints(hm.length, Math.max(2, maxH(hm)), st.arrowEnds), st.cur.b, W, H);
    st.cur.fr = { center: lerp3(mid.center, F.fr.center, k), half: mid.half + (F.fr.half - mid.half) * k };
    st.cur.labels = k < 0.9; // straight on, the plate's edge labels would sit on the drawing
    st.arrow.visible = !!st.arrowEnds && k < 0.85;
    render();
  }
  // Drawing cells → viewport px for the view straight on (world corners of the cropped cells).
  function drawingMap(hm, v) {
    var vc = viewCells(hm, v, false), G = hm.length, o = (G - 1) / 2, top = maxH(hm);
    function world(a, b) {
      var I = a + vc.i0, J = b + vc.j0;
      if (v === 'top') return [I - o - 0.5, top, G - 0.5 - J - o];
      if (v === 'front') return [I - o - 0.5, J, G / 2];
      return [G / 2, J, G - 0.5 - I - o];
    }
    var cur = viewState(hm, v), r = rect3(), p0 = toScreen(world(0, 0), cur.b, cur.fr, r), p1 = toScreen(world(1, 0), cur.b, cur.fr, r);
    return { a: p1[0] - p0[0], e: p0[0], f: p0[1] };
  }
  function optionMap(i) {
    var p = st.opts[i].pic, r = p.svg.getBoundingClientRect(), k = Math.min(r.width, r.height) / p.size;
    var l0 = r.left + (r.width - p.size * k) / 2, t0 = r.top + (r.height - p.size * k) / 2;
    return { a: k, e: l0 + (p.ox + p.pad) * k, f: t0 + (p.oy + p.pad) * k };
  }
  function stemMap(v) {
    var T3 = st.three, at = T3.L[v], o = stageOrigin();
    return { a: T3.L.c, e: o[0] + T3.box.x + at.x, f: o[1] + T3.box.y + at.y };
  }
  function mapPath(d, A, n, ox, oy) {
    var k = A.a, x0 = A.e - (ox || 0), y0 = A.f - (oy || 0);
    return d.lines.slice(0, n === undefined ? d.lines.length : n).map(function (l) {
      return 'M' + SV.pathData([[x0 + l[0] * k, y0 - l[1] * k], [x0 + l[2] * k, y0 - l[3] * k]]).slice(1);
    }).join('');
  }

  function clearInk() { if (st) PX.ui.clear(st.ink); }
  // The traced drawing on the stage: the first n lines, over a cover that fades the cubes.
  function inkDraw(d, A, n, cover) {
    clearInk();
    var o = stageOrigin();
    if (cover > 0) {
      st.ink.appendChild(SV.el('rect', { x: st.d3.offsetLeft, y: st.d3.offsetTop, width: st.v3.width, height: st.v3.height, class: 'ex-views-cover', style: 'opacity:' + cover.toFixed(3) }));
    }
    if (n > 0) st.ink.appendChild(SV.el('path', { d: mapPath(d, A, n, o[0], o[1]), class: 'ex-views-trace' }));
  }

  function clearFly() {
    if (!st) return;
    if (st.fly && st.fly.svg.parentNode) st.fly.svg.parentNode.removeChild(st.fly.svg);
    st.fly = null;
    st.opts.forEach(function (o) { if (o && o.ghost) { if (o.ghost.parentNode) o.ghost.parentNode.removeChild(o.ghost); o.ghost = null; } });
  }
  function flyBegin(d, A, B) {
    clearFly();
    var svg = SV.el('svg', { 'aria-hidden': 'true', focusable: 'false' });
    svg.style.cssText = 'position:fixed;left:0;top:0;width:100vw;height:100vh;overflow:visible;pointer-events:none;z-index:60';
    var g = SV.el('g');
    g.appendChild(SV.el('path', { d: mapPath(d, { a: 1, e: 0, f: 0 }), style: 'fill:none;stroke:var(--stim-target,#0B6A86);stroke-width:3px;stroke-dasharray:7 4;stroke-linecap:square;vector-effect:non-scaling-stroke' }));
    svg.appendChild(g);
    doc.body.appendChild(svg);
    st.fly = { svg: svg, g: g, A: A, B: B };
    flyAt(0);
  }
  function flyAt(k) {
    var F = st.fly;
    if (!F) return;
    var a = F.A.a + (F.B.a - F.A.a) * k, e = F.A.e + (F.B.e - F.A.e) * k, f = F.A.f + (F.B.f - F.A.f) * k;
    F.g.setAttribute('transform', 'matrix(' + [a, 0, 0, a, e, f].map(function (x) { return x.toFixed(3); }).join(' ') + ')');
  }
  // The flown drawing stays on the option it landed on (inside that option's own picture).
  function landedOption(i, d) {
    clearFly();
    var o = st.opts[i];
    if (!o || !o.pic) return;
    o.ghost = SV.el('path', { d: linesPath(d, o.pic.ox, o.pic.oy, 1), class: 'ex-views-ghost' });
    o.pic.g.appendChild(o.ghost);
  }
  // Unit edges of a drawing, as keys 'h:x,y' / 'v:x,y' (placed at its bottom-left corner).
  function unitEdges(d) {
    var s = {};
    d.lines.forEach(function (l) {
      if (l[1] === l[3]) for (var x = Math.min(l[0], l[2]); x < Math.max(l[0], l[2]); x++) s['h:' + x + ',' + l[1]] = [x, l[1], x + 1, l[1]];
      else for (var y = Math.min(l[1], l[3]); y < Math.max(l[1], l[3]); y++) s['v:' + l[0] + ',' + y] = [l[0], y, l[0], y + 1];
    });
    return s;
  }
  // On a stem drawing: the flown view laid over it; where it differs, the extra and the missing
  // unit edges in the "wrong" style (thick and dotted: a shape as well as a colour).
  function landedStem(v, d, ok) {
    clearFly();
    var T3 = st.three, at = T3.L[v], c = T3.L.c, g = T3.marks[v];
    if (!g) return;
    g.appendChild(SV.el('path', { d: linesPath(d, at.x, at.y, c), class: 'ex-views-ghost ex-views-overlay' }));
    if (ok) { g.appendChild(SV.text(at.label[0] + 34, at.label[1], '✓', { class: 'ex-views-dlabel ex-views-ok' })); return; }
    var a = unitEdges(d), b = unitEdges(st.item.views[v]), diff = [];
    Object.keys(a).forEach(function (k) { if (!b[k]) diff.push(a[k]); });
    Object.keys(b).forEach(function (k) { if (!a[k]) diff.push(b[k]); });
    if (diff.length) g.appendChild(SV.el('path', { d: linesPath({ lines: diff }, at.x, at.y, c), class: 'ex-views-diff ex-views-overlay' }));
    g.appendChild(SV.text(at.label[0] + 34, at.label[1], '✗', { class: 'ex-views-dlabel ex-views-bad' }));
  }
  function clearStemMarks() {
    if (!st.three) return;
    Object.keys(st.three.marks).forEach(function (v) {
      var g = st.three.marks[v];
      Array.prototype.slice.call(g.querySelectorAll('.ex-views-overlay, .ex-views-ok, .ex-views-bad')).forEach(function (n) { g.removeChild(n); });
    });
  }

  function focusOption(i) {
    st.opts.forEach(function (o, j) {
      if (!o) return;
      var b = o.el.closest ? o.el.closest('.px-choice') : null;
      if (b) b.classList.toggle('ex-focus', j === i);
    });
  }
  function clearColTags() {
    (st.colTags || []).forEach(function (t) { if (t.el.parentNode) t.el.parentNode.removeChild(t.el); });
    st.colTags = [];
  }
  // Back to a clean start for a step.
  function reset() {
    clearFly(); clearInk(); focusOption(-1); clearColTags(); clearStemMarks();
    st.tags.ask.classList.remove('is-pointed');
    st.label.classList.remove('is-pointed');
  }

  /* ---------- show me: the steps ---------- */

  function pickedOf(item, response) { return typeof response === 'number' && response >= 0 && response < item.options.length ? response : -1; }

  function toviewSteps(item, response) {
    var v = item.view, hm = item.heights, d = lib.view(hm, v), key = item.key, picked = pickedOf(item, response);
    var n = d.lines.length;
    var traced = function () { moveCam(hm, v, 1); inkDraw(d, drawingMap(hm, v), n, 0.86); };
    var list = [
      { ms: 1600, caption: cap('look', { view: v }), enter: function () { reset(); trialState(); st.tags.ask.classList.add('is-pointed'); }, exit: function () { st.tags.ask.classList.remove('is-pointed'); } },
      { ms: 1900, caption: cap('move', { view: v }), enter: function () { reset(); trialState(); }, update: function (k) { moveCam(hm, v, ease(k)); } },
      {
        ms: 1300 + 90 * n, caption: cap('trace'),
        enter: function () { reset(); trialState(); moveCam(hm, v, 1); },
        update: function (k) { inkDraw(d, drawingMap(hm, v), Math.ceil(Math.min(1, k * 1.15) * n), 0.86 * Math.max(0, (k - 0.55) / 0.45)); },
      },
      {
        ms: 1400, caption: cap('land', { n: key + 1 }),
        enter: function () { reset(); trialState(); traced(); flyBegin(d, drawingMap(hm, v), optionMap(key)); },
        update: function (k) { flyAt(ease(k)); },
        exit: function () { landedOption(key, d); focusOption(key); },
      },
    ];
    if (picked >= 0 && picked !== key) {
      var o = item.options[picked], why = o.kind === 'direction' ? 'whyDirection' : o.kind === 'mirror' ? 'whyMirror' : 'whyNeighbour';
      list.push({ ms: 2400, caption: cap(why, { n: picked + 1, from: o.from || '' }), enter: function () { reset(); trialState(); traced(); landedOption(key, d); focusOption(picked); } });
    }
    return list;
  }

  // toobject: the key structure's three views, traced and laid onto the drawings; then, after a
  // wrong pick, the first view of the picked structure that does not fit.
  var THREE_V = ['top', 'front', 'right'];
  function toobjectSteps(item, response) {
    var key = item.key, picked = pickedOf(item, response), list = [];
    function setup(k, done) {
      reset();
      setMode('split');
      showStructure(item.options[k].heights, null);
      st.cur = isoState(item.options[k].heights);
      render();
      (done || []).forEach(function (v) { landedStem(v, lib.view(item.options[key].heights, v), true); });
      focusOption(k);
    }
    function check(k, v, ok, done) {
      var hm = item.options[k].heights, d = lib.view(hm, v), n = d.lines.length;
      return [
        { ms: 1300, caption: cap('objMove', { view: v, n: k + 1 }), enter: function () { setup(k, done); }, update: function (e) { moveCam(hm, v, ease(e)); } },
        {
          ms: 900 + 70 * n, caption: cap('objTrace', { view: v }),
          enter: function () { setup(k, done); moveCam(hm, v, 1); },
          update: function (e) { inkDraw(d, drawingMap(hm, v), Math.ceil(Math.min(1, e * 1.15) * n), 0.86 * Math.max(0, (e - 0.55) / 0.45)); },
        },
        {
          ms: 1300, caption: ok ? cap('objMatch', { view: v }) : cap('objDiffer', { view: v, n: k + 1 }),
          enter: function () { setup(k, done); moveCam(hm, v, 1); inkDraw(d, drawingMap(hm, v), n, 0.86); flyBegin(d, drawingMap(hm, v), stemMap(v)); },
          update: function (e) { flyAt(ease(e)); },
          exit: function () { landedStem(v, d, ok); },
        },
      ];
    }
    list.push({ ms: 1800, caption: cap('objIntro', { n: key + 1 }), enter: function () { setup(key, []); } });
    THREE_V.forEach(function (v, i) { list = list.concat(check(key, v, true, THREE_V.slice(0, i))); });
    if (picked >= 0 && picked !== key) {
      var miss = THREE_V.filter(function (v) { return (item.options[picked].matches || []).indexOf(v) < 0; })[0] || 'top';
      list.push({ ms: 1700, caption: cap('objWrong', { n: picked + 1 }), enter: function () { setup(picked, []); } });
      list = list.concat(check(picked, miss, false, []));
    }
    return list;
  }

  // count: column by column with each column's height, then the top view with the heights.
  function countSteps(item) {
    var hm = item.heights, G = hm.length, o = (G - 1) / 2, cols = [], idx = 0, z, x, y;
    for (z = 0; z < G; z++) for (x = 0; x < G; x++) {
      var ids = [];
      for (y = 0; y < hm[z][x]; y++) ids.push(idx++);
      if (ids.length) cols.push({ x: x, z: z, h: hm[z][x], ids: ids });
    }
    var N = lib.total(hm), key = item.key;
    function tags(upto) {
      clearColTags();
      cols.forEach(function (c, i) {
        if (i > upto) return;
        var el = h('span.ex-views-tag.ex-views-tag--n', String(c.h));
        st.stage.appendChild(el);
        st.colTags.push({ el: el, p: [c.x - o, c.h + 0.12, c.z - o], on: true });
      });
    }
    function at(i, hl) { reset(); trialState(); tags(i); if (st.group) st.group.setHighlight(hl ? cols[i].ids : [], { fade: true }); render(); }
    var list = [{ ms: 1500, caption: cap('countIntro'), enter: function () { at(-1, false); } }];
    var run = [];
    cols.forEach(function (c, i) {
      run.push(c.h);
      var sum = run.length > 1 ? run.join(' + ') + ' = ' + run.reduce(function (a, b) { return a + b; }, 0) : String(c.h);
      list.push({ ms: 750, caption: cap('countCol', { sum: sum }), enter: function () { at(i, true); } });
    });
    list.push({
      ms: 1800, caption: cap('countTop', { n: N }),
      enter: function () { at(cols.length - 1, false); },
      update: function (k) { moveCam(hm, 'top', ease(k)); },
    });
    list.push({ ms: 1400, caption: cap('countKey', { n: N, k: key + 1 }), enter: function () { at(cols.length - 1, false); moveCam(hm, 'top', 1); focusOption(key); } });
    return list;
  }

  function steps(item, response) {
    if (item.variant === 'toview') return toviewSteps(item, response);
    if (item.variant === 'toobject') return toobjectSteps(item, response);
    return countSteps(item);
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
    if (!st || !st.v3 || st.item !== item) return Promise.resolve();
    revealStage(ctx);
    return play(steps(item, response), ctx, { name: 'show-me' });
  }

  // Tutorial: the parts first, then the same solution.
  function demo(item, ctx, caption) {
    if (!st || !st.v3 || st.item !== item) return Promise.resolve();
    function part(fn) { return function () { reset(); trialState(); if (fn) fn(); }; }
    var intro = [{ ms: 1800, caption: cap(item.variant === 'toobject' ? 'threeViews' : 'structure'), enter: part(function () { st.label.classList.add('is-pointed'); }) }];
    if (item.variant === 'toview') intro.push({ ms: 2000, caption: cap('arrow'), enter: part(function () { st.tags.ask.classList.add('is-pointed'); }) });
    intro.push({ ms: 1800, caption: cap('options' + upper(item.variant)), enter: part(null) });
    revealStage(ctx);
    return play(intro.concat(steps(item, null)), ctx, { name: 'demo', caption: caption || null });
  }

  function unmount() {
    if (!st) return;
    clearFly();
    clearColTags();
    st.offs.forEach(function (off) { off(); });
    [st.group, st.opt && st.opt.group].forEach(function (g) { if (g) S3.disposeTree(g); });
    [st.plate, st.arrow, st.opt && st.opt.plate].forEach(dropTree);
    Object.keys(st.mats || {}).forEach(function (k) { st.mats[k].dispose(); });
    if (st.v3) st.v3.detach();
    if (st.root.parentNode) st.root.parentNode.removeChild(st.root);
    st = null;
  }

  PX.ex.view('views', {
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
    steps: function (item, response) { return st && st.item === item ? steps(item, response) : []; },
  });
})(window.PX);
