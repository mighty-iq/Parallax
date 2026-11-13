/* EX-14 Openings (DAT-style format): view (DOM, SVG and 3D through PX.core.stage3d; ARCHITECTURE.md §6).
   layout 'stem+options'. The stem is the solid (its exact surface from lib.surface, flat shaded,
   with edge bars along lib.edges) in an orthographic view from the front-right-top, posed as the
   item says. Options are SVG openings: a plate with the outline cut out (dark, outlined), all at
   the stem's scale where the cell allows it.
   Show me (ctx.play steps, from the item's own model): the camera swings round to look straight
   along the fitting axis; the solid's outline is traced over it; the outline turns and flips onto
   the right opening; after a wrong pick, the nearest true outline is laid over the chosen opening
   so the difference shows. Every step's enter() sets its full starting state. */
(function (PX) {
  'use strict';

  var win = window, doc = document, T = win.THREE, S3 = PX.core.stage3d, timing = PX.core.timing, U = PX.util;
  var h = PX.ui.h, SV = PX.core.svg;
  var def = PX.ex.get('openings'), lib = def.lib;
  var st = null;
  var DEG = Math.PI / 180, CAM_D = 60, MARGIN = 1.12, BAR = 0.085, PAD = 0.6;
  var VIEW0 = { az: 35, el: 28 };
  var FACE = { x: 'side', y: 'top', z: 'front' };

  function learn() { return PX.ex.learn('openings') || {}; }
  function cap(key, vars) {
    var s = String((learn().captions || {})[key] || '');
    if (vars) for (var k in vars) s = s.split('{' + k + '}').join(String(vars[k]));
    return s;
  }
  function ease(k) { return k * k * (3 - 2 * k); }
  function dot(a, b) { return a[0] * b[0] + a[1] * b[1] + a[2] * b[2]; }

  /* ---------- camera on an orbit (az from +z toward +x, el up) ---------- */
  function basis(az, el) {
    var a = az * DEG, e = el * DEG, sa = Math.sin(a), ca = Math.cos(a), se = Math.sin(e), ce = Math.cos(e);
    return { dir: [sa * ce, se, ca * ce], right: [ca, 0, -sa], up: [-sa * se, ce, -ca * se] };
  }
  // World points of the posed solid's box (centred at the origin).
  function boxPts(item) {
    var R = lib.POSES[item.pose], out = [], W = item.W / 2, H = item.H / 2, D = item.D / 2;
    [-W, W].forEach(function (x) { [-H, H].forEach(function (y) { [-D, D].forEach(function (z) { out.push(rot(R, [x, y, z])); }); }); });
    return out;
  }
  function rot(R, v) { return [R[0] * v[0] + R[1] * v[1] + R[2] * v[2], R[3] * v[0] + R[4] * v[1] + R[5] * v[2], R[6] * v[0] + R[7] * v[1] + R[8] * v[2]]; }
  function frame(pts, b, Wpx, Hpx) {
    var x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
    pts.forEach(function (p) { var x = dot(p, b.right), y = dot(p, b.up); x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); });
    var aspect = Wpx / Math.max(1, Hpx), half = Math.max((y1 - y0) / 2, (x1 - x0) / 2 / aspect) * MARGIN;
    return { cx: (x0 + x1) / 2, cy: (y0 + y1) / 2, half: half };
  }
  function placeCam(cam, b, fr, Wpx, Hpx) {
    var aspect = Wpx / Math.max(1, Hpx), c = [b.right[0] * fr.cx + b.up[0] * fr.cy, b.right[1] * fr.cx + b.up[1] * fr.cy, b.right[2] * fr.cx + b.up[2] * fr.cy];
    cam.left = -fr.half * aspect; cam.right = fr.half * aspect; cam.top = fr.half; cam.bottom = -fr.half;
    cam.position.set(c[0] + b.dir[0] * CAM_D, c[1] + b.dir[1] * CAM_D, c[2] + b.dir[2] * CAM_D);
    cam.up.set(b.up[0], b.up[1], b.up[2]);
    cam.lookAt(c[0], c[1], c[2]);
    cam.near = 0.1; cam.far = 2 * CAM_D;
    cam.updateProjectionMatrix();
  }
  // px of a world point in the stage for a camera state.
  function toScreen(p, b, fr, Wpx, Hpx) {
    var k = Hpx / (2 * fr.half);
    return [Wpx / 2 + (dot(p, b.right) - fr.cx) * k, Hpx / 2 - (dot(p, b.up) - fr.cy) * k];
  }
  // The straight-on view of an axis, seen from the side that faces the original viewer.
  function axisView(item) {
    var a = lib.AXES.indexOf(item.keyAxis), e = [0, 0, 0];
    e[a] = 1;
    var w = rot(lib.POSES[item.pose], e);
    if (dot(w, lib.VIEW) < 0) w = [-w[0], -w[1], -w[2]];
    if (Math.abs(w[1]) > 0.5) return { az: 0, el: 90, w: w }; // square to the screen, the front at the bottom
    return { az: Math.atan2(w[0], w[2]) / DEG, el: 0, w: w };
  }

  /* ---------- the solid ---------- */
  function makeMaterials() {
    var face = { polygonOffset: true, polygonOffsetFactor: 1, polygonOffsetUnits: 1 };
    return { face: new T.MeshLambertMaterial(face), edge: new T.MeshBasicMaterial() };
  }
  function tint() {
    var c = S3.colors();
    st.mats.face.color.copy(c.face);
    st.mats.edge.color.copy(c.edge);
    if (st.scene) st.scene.background = c.ground.clone();
  }
  function buildSolid(item) {
    var g = lib.gridsOf(item), faces = lib.surface(g.F, g.T, g.S), E = lib.edges(faces);
    var pos = [], nrm = [], ox = item.W / 2, oy = item.H / 2, oz = item.D / 2;
    faces.forEach(function (f) {
      for (var i = 1; i + 1 < f.pts.length; i++) {
        [f.pts[0], f.pts[i], f.pts[i + 1]].forEach(function (p) { pos.push(p[0] - ox, p[1] - oy, p[2] - oz); nrm.push(f.n[0], f.n[1], f.n[2]); });
      }
    });
    var geo = new T.BufferGeometry();
    geo.setAttribute('position', new T.Float32BufferAttribute(pos, 3));
    geo.setAttribute('normal', new T.Float32BufferAttribute(nrm, 3));
    var grp = new T.Group(), mesh = new T.Mesh(geo, st.mats.face);
    var bars = new T.InstancedMesh(st.unit, st.mats.edge, Math.max(1, E.length)), M = new T.Matrix4(), q = new T.Quaternion(), X = new T.Vector3(1, 0, 0);
    E.forEach(function (e, i) {
      var a = new T.Vector3(e[0][0] - ox, e[0][1] - oy, e[0][2] - oz), b = new T.Vector3(e[1][0] - ox, e[1][1] - oy, e[1][2] - oz);
      var d = b.clone().sub(a), len = d.length();
      q.setFromUnitVectors(X, d.normalize());
      M.compose(a.clone().add(b).multiplyScalar(0.5), q, new T.Vector3(len + BAR, BAR, BAR));
      bars.setMatrixAt(i, M);
    });
    bars.count = E.length;
    bars.instanceMatrix.needsUpdate = true;
    grp.add(mesh, bars);
    var R = lib.POSES[item.pose];
    grp.matrixAutoUpdate = false;
    grp.matrix.set(R[0], R[1], R[2], 0, R[3], R[4], R[5], 0, R[6], R[7], R[8], 0, 0, 0, 0, 1);
    return grp;
  }
  function dropSolid() {
    if (!st.solid) return;
    st.scene.remove(st.solid);
    st.solid.children.forEach(function (c) { if (c.geometry && c.geometry !== st.unit) c.geometry.dispose(); });
    st.solid = null;
  }
  // Draws the 3D picture for camera state cur = { az, el, fr }.
  function render() {
    if (!st || !st.v3 || !st.cur) return;
    var v = st.v3;
    if (!v.width || !v.height) v.resize();
    var W = v.width || 1, H = v.height || 1, b = basis(st.cur.az, st.cur.el);
    st.cur.fr = frame(boxPts(st.item), b, W, H); // from the current size: a turn or resize never crops the solid
    placeCam(st.cam, b, st.cur.fr, W, H);
    v.render(st.scene, st.cam);
  }
  function camAt(az, el) {
    var W = st.v3.width || 1, H = st.v3.height || 1, b = basis(az, el);
    return { az: az, el: el, fr: frame(boxPts(st.item), b, W, H) };
  }

  /* ---------- openings (SVG) ---------- */
  function optScale(item) {
    var M = 0;
    item.options.forEach(function (o) { M = Math.max(M, o.w, o.h); });
    return M;
  }
  function polyD(p, hgt, ox, oy, k) {
    return SV.pathData(p.map(function (v) { return [ox + v[0] * k, oy + (hgt - v[1]) * k]; }), true);
  }
  function drawOption(el, item, i, ctx) {
    if (!st) mount(ctx);
    newItem(item);
    var o = item.options[i], M = st.M, size = M + 2 * PAD;
    var svg = SV.el('svg', { viewBox: [-PAD, -PAD, size, size], class: 'op-opt-svg', 'aria-hidden': 'true', focusable: 'false', preserveAspectRatio: 'xMidYMid meet' });
    var ox = (M - o.w) / 2, oy = (M - o.h) / 2;
    svg.appendChild(SV.el('rect', { x: -PAD * 0.6, y: -PAD * 0.6, width: M + 1.2 * PAD, height: M + 1.2 * PAD, rx: 0.25, class: 'op-plate' }));
    svg.appendChild(SV.el('path', { d: polyD(o.poly, o.h, ox, oy, 1), class: 'op-hole' }));
    var over = SV.el('g', { class: 'op-over' });
    svg.appendChild(over);
    if (st.k) svg.style.maxWidth = Math.round(size * st.k) + 'px';
    var tag = h('span.ex-tag', { hidden: true });
    el.appendChild(h('span.ex-opt.op-opt-cell', svg, tag));
    st.opts[i] = { el: el, svg: svg, over: over, tag: tag, ox: ox, oy: oy, size: size };
  }
  function optionLabel(item, i) { return 'Opening ' + (i + 1); }
  function gridCols(item) { return item.options.length; }

  /* ---------- mount, items ---------- */
  function describe(item) {
    return 'A solid block with ' + (item.feats.F.length + item.feats.T.length + item.feats.S.length) + ' notches, steps or slanted cuts that run straight through it, seen from above at the front right. Which of five openings, each possibly turned or flipped, does it pass through exactly?';
  }
  function mount(ctx) {
    var root = h('div.op-stem'), stage = h('div.ex-stage.op-stage'), d3 = h('div.op-3d');
    var ink = SV.el('svg', { class: 'op-ink', 'aria-hidden': 'true', focusable: 'false' });
    var label = h('span.ex-label.op-label', 'Solid');
    var caption = h('p.ex-caption', { 'aria-live': 'polite' }), verdict = h('div.ex-verdict.op-verdict', { hidden: true, role: 'status' }), desc = h('p.px-sr');
    stage.appendChild(d3); stage.appendChild(ink); stage.appendChild(label);
    root.appendChild(stage);
    root.appendChild(h('div.op-under', caption, verdict));
    root.appendChild(desc);
    ctx.host.appendChild(root);
    st = { ctx: ctx, root: root, stage: stage, d3: d3, ink: ink, label: label, caption: caption, verdict: verdict, desc: desc, v3: null, item: null, optItem: null, opts: [], offs: [], cur: null, solid: null, k: 0, M: 1 };
    if (!S3.available()) { stage.appendChild(h('p.ex-unavailable', { role: 'alert' }, 'This exercise needs 3D graphics, which are not available here: ' + S3.reason() + '.')); return; }
    st.v3 = S3.attach(d3);
    st.v3.redraw = render;
    st.scene = new T.Scene();
    S3.lights(st.scene);
    st.cam = new T.OrthographicCamera(-1, 1, 1, -1, 0.1, 2 * CAM_D);
    st.mats = makeMaterials();
    st.unit = new T.BoxGeometry(1, 1, 1);
    tint();
    st.offs.push(PX.bus.on('stage3d:theme', function () { if (st) { tint(); render(); } }));
  }
  function newItem(item) {
    if (st.optItem === item) return;
    st.optItem = item;
    st.opts = [];
    st.M = optScale(item);
    st.k = 0;
    if (st.v3) {
      st.item = item;
      dropSolid();
      st.solid = buildSolid(item);
      st.scene.add(st.solid);
      st.v3.resize();
      st.cur = camAt(VIEW0.az, VIEW0.el);
      st.k = (st.v3.height || 1) / (2 * st.cur.fr.half); // px per step in the picture: the openings use it too
    }
  }
  function present(item, ctx) {
    if (!st) mount(ctx);
    newItem(item);
    st.item = item;
    st.root.classList.remove('is-revealed');
    st.verdict.hidden = true;
    st.caption.textContent = '';
    st.desc.textContent = describe(item);
    PX.ui.clear(st.ink);
    if (st.v3) { st.cur = camAt(VIEW0.az, VIEW0.el); render(); }
    return timing.nextPaint();
  }

  function reveal(item, response, result, ctx) {
    if (!st) return Promise.resolve();
    st.root.classList.add('is-revealed');
    st.opts.forEach(function (o, i) {
      if (!o) return;
      var op = item.options[i];
      o.tag.textContent = i === item.key ? '✓ Fits, ' + FACE[faceAxis(item)] + ' first' : op.kind === 'proportion' ? 'Wrong size' : 'A feature differs';
      o.tag.setAttribute('data-kind', i === item.key ? 'key' : 'foil');
      o.tag.hidden = false;
    });
    st.verdict.textContent = '✓ Opening ' + (item.key + 1);
    st.verdict.setAttribute('data-kind', 'key');
    st.verdict.hidden = false;
    return timing.wait(ctx && ctx.fast ? 0 : 250);
  }
  // Which face of the picture the fitting outline belongs to (front, side or top as drawn).
  function faceAxis(item) { var w = axisView(item).w; return Math.abs(w[1]) > 0.5 ? 'y' : Math.abs(w[0]) > 0.5 ? 'x' : 'z'; }

  /* ---------- show me ---------- */
  function profOf(item, axis) { return lib.PROF_OF[axis]; }
  function profDims(item, name) { return name === 'F' ? [item.W, item.H] : name === 'T' ? [item.W, item.D] : [item.D, item.H]; }
  // A profile vertex as a point of the posed solid (on the face toward the viewer of that axis).
  function vertexWorld(item, name, v, side) {
    var p = name === 'F' ? [v[0] - item.W / 2, v[1] - item.H / 2, side * item.D / 2] : name === 'T' ? [v[0] - item.W / 2, side * item.H / 2, v[1] - item.D / 2] : [side * item.W / 2, v[1] - item.H / 2, v[0] - item.D / 2];
    return rot(lib.POSES[item.pose], p);
  }
  function stageOrigin() { var r = st.stage.getBoundingClientRect(); return [r.left + st.stage.clientLeft, r.top + st.stage.clientTop]; }
  // The key outline in page px, seen straight along its axis.
  function outlinePage(item) {
    var name = profOf(item, item.keyAxis), av = axisView(item), b = basis(av.az, av.el), cur = camAt(av.az, av.el), W = st.v3.width || 1, H = st.v3.height || 1, o = stageOrigin();
    var e = [0, 0, 0]; e[lib.AXES.indexOf(item.keyAxis)] = 1;
    var side = dot(rot(lib.POSES[item.pose], e), lib.VIEW) >= 0 ? 1 : -1;
    return item.prof[name].map(function (v) { var s = toScreen(vertexWorld(item, name, v, side), b, cur.fr, W, H); return [o[0] + st.d3.offsetLeft + s[0], o[1] + st.d3.offsetTop + s[1]]; });
  }
  // The same vertices on option i (turned and flipped as that option shows them), in page px.
  function optionPage(item, i) {
    var o = item.options[i], O = st.opts[i], name = profOf(item, item.keyAxis), dm = profDims(item, name);
    var r = O.svg.getBoundingClientRect(), s = Math.min(r.width, r.height) / O.size, l0 = r.left + (r.width - O.size * s) / 2, t0 = r.top + (r.height - O.size * s) / 2;
    return item.prof[name].map(function (v) {
      var q = lib.tfPoint(o.tf, v[0], v[1], dm[0], dm[1]);
      return [l0 + (O.ox + q[0] + PAD) * s, t0 + (O.oy + (o.h - q[1]) + PAD) * s];
    });
  }
  function clearFly() { if (st && st.fly && st.fly.parentNode) st.fly.parentNode.removeChild(st.fly); if (st) st.fly = null; }
  function flyAt(A, B, k) {
    if (!st.fly) {
      st.fly = SV.el('svg', { 'aria-hidden': 'true', focusable: 'false', class: 'op-fly' });
      st.fly.style.cssText = 'position:fixed;left:0;top:0;width:100vw;height:100vh;overflow:visible;pointer-events:none;z-index:60';
      st.fly.appendChild(SV.el('path', { class: 'op-fly-path' }));
      doc.body.appendChild(st.fly);
    }
    var pts = A.map(function (p, i) { return [p[0] + (B[i][0] - p[0]) * k, p[1] + (B[i][1] - p[1]) * k]; });
    st.fly.firstChild.setAttribute('d', SV.pathData(pts, true));
  }
  function inkOutline(item, alpha) {
    PX.ui.clear(st.ink);
    if (alpha <= 0) return;
    var o = stageOrigin(), pts = outlinePage(item).map(function (p) { return [p[0] - o[0], p[1] - o[1]]; });
    SV.attrs(st.ink, { viewBox: [0, 0, Math.max(1, st.stage.clientWidth), Math.max(1, st.stage.clientHeight)] });
    st.ink.appendChild(SV.el('path', { d: SV.pathData(pts, true), class: 'op-trace', style: 'opacity:' + alpha.toFixed(3) }));
  }
  function focusOption(i) {
    st.opts.forEach(function (o, j) {
      if (!o) return;
      var b = o.el.closest ? o.el.closest('.px-choice') : null;
      if (b) b.classList.toggle('ex-focus', j === i);
      PX.ui.clear(o.over);
    });
  }
  // Option i with an outline of the solid laid over it: the key's (ghost), or the nearest true one.
  function overlay(item, i, poly, A, B, k, cls) {
    var O = st.opts[i], o = item.options[i], q = lib.tfPoly(poly, k, A, B), sz = lib.tfSize(k, A, B);
    O.over.appendChild(SV.el('path', { d: polyD(q, sz[1], O.ox + (o.w - sz[0]) / 2, O.oy + (o.h - sz[1]) / 2, 1), class: cls }));
  }
  function nearest(item, i) {
    var o = item.options[i], R = lib.polyRaster(o.poly), best = null;
    ['F', 'T', 'S'].forEach(function (name) {
      var dm = profDims(item, name);
      for (var k = 0; k < 8; k++) {
        var t = lib.polyRaster(item.prof[name], k), d = Math.abs(t.w - R.w) * 40 + Math.abs(t.h - R.h) * 40, w = Math.min(t.w, R.w), hh = Math.min(t.h, R.h);
        for (var b = 0; b < hh; b++) for (var a = 0; a < w; a++) if (t.r[b * t.w + a] !== R.r[b * R.w + a]) d++;
        if (!best || d < best.d) best = { d: d, name: name, k: k, A: dm[0], B: dm[1] };
      }
    });
    return best;
  }
  function reset() { clearFly(); PX.ui.clear(st.ink); focusOption(-1); st.label.classList.remove('is-pointed'); }

  function steps(item, response) {
    var key = item.key, av = axisView(item), picked = typeof response === 'number' && response >= 0 && response < 5 && response !== key ? response : -1;
    var face = FACE[faceAxis(item)], name = profOf(item, item.keyAxis), dm = profDims(item, name);
    function at(az, el) { st.cur = camAt(az, el); render(); }
    function straight() { at(av.az, av.el); }
    var list = [
      { ms: 1300, caption: cap('solid'), enter: function () { reset(); at(VIEW0.az, VIEW0.el); st.label.classList.add('is-pointed'); }, exit: function () { st.label.classList.remove('is-pointed'); } },
      { ms: 1500, caption: cap('rules'), enter: function () { reset(); at(VIEW0.az, VIEW0.el); } },
      { ms: 2200, caption: cap('turn', { face: face }), enter: function () { reset(); at(VIEW0.az, VIEW0.el); }, update: function (k) { var e = ease(k); at(VIEW0.az + (av.az - VIEW0.az) * e, VIEW0.el + (av.el - VIEW0.el) * e); } },
      { ms: 1500, caption: cap('outline'), enter: function () { reset(); straight(); }, update: function (k) { inkOutline(item, Math.min(1, k * 1.6)); } },
      {
        ms: 1600, caption: cap('land', { n: key + 1 }),
        enter: function () { reset(); straight(); inkOutline(item, 1); st.flyA = outlinePage(item); st.flyB = optionPage(item, key); flyAt(st.flyA, st.flyB, 0); },
        update: function (k) { flyAt(st.flyA, st.flyB, ease(k)); },
        exit: function () { clearFly(); focusOption(key); overlay(item, key, item.prof[name], dm[0], dm[1], item.options[key].tf, 'op-ghost'); },
      },
    ];
    if (picked >= 0) {
      var kind = item.options[picked].kind;
      list.push({
        ms: 2600, caption: cap(kind === 'proportion' ? 'whyProportion' : 'whyFeature', { n: picked + 1 }),
        enter: function () {
          reset(); straight(); inkOutline(item, 1); focusOption(picked);
          var nb = nearest(item, picked);
          overlay(item, picked, item.prof[nb.name], nb.A, nb.B, nb.k, 'op-true');
          overlay(item, key, item.prof[name], dm[0], dm[1], item.options[key].tf, 'op-ghost');
        },
      });
    }
    return list;
  }

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
  function revealStage(ctx) {
    try {
      var r = st.stage.getBoundingClientRect(), vh = win.innerHeight || 640;
      if (r.top < 0 || r.bottom > vh) st.stage.scrollIntoView({ block: 'start', behavior: ctx && (ctx.fast || ctx.reducedMotion) ? 'auto' : 'smooth' });
    } catch (e) { /* not fatal */ }
  }
  function showMe(item, response, ctx) {
    if (!st || !st.v3 || st.item !== item) return Promise.resolve();
    revealStage(ctx);
    return play(steps(item, response), ctx, { name: 'show-me' });
  }
  function demo(item, ctx, caption) {
    if (!st || !st.v3 || st.item !== item) return Promise.resolve();
    revealStage(ctx);
    var list = steps(item, null), intro = { ms: 1700, caption: cap('openings'), enter: function () { reset(); st.cur = camAt(VIEW0.az, VIEW0.el); render(); } };
    return play(list.slice(0, 2).concat([intro], list.slice(2)), ctx, { name: 'demo', caption: caption || null });
  }
  function unmount() {
    if (!st) return;
    clearFly();
    st.offs.forEach(function (off) { off(); });
    if (st.v3) {
      dropSolid();
      st.unit.dispose();
      st.mats.face.dispose(); st.mats.edge.dispose();
      st.v3.detach();
    }
    if (st.root.parentNode) st.root.parentNode.removeChild(st.root);
    st = null;
  }

  PX.ex.view('openings', {
    layout: 'stem+options',
    needs: 'webgl',
    css: true,
    mount: mount, present: present, drawOption: drawOption, optionLabel: optionLabel, gridCols: gridCols,
    reveal: reveal, showMe: showMe, demo: demo, unmount: unmount,
    steps: function (item, response) { return st && st.item === item ? steps(item, response) : []; },
  });
})(window.PX);
