/* EX-11 Homing (experimental): view, and the first-person kit Reckon (EX-12) reuses
   (3D through PX.core.stage3d; ARCHITECTURE.md §4, §6, docs/dev/EXERCISE-GUIDE.md; v1.1 phone design:
   docs/research/v1.1/R1-path-integration.md §7, I2-mobile-audit.md §3, §7, §11). layout 'custom', needs 'webgl'.

   The kit (PX.ex.view('homing').kit; every piece takes the exercise's own caption function `cap`):
   - stage(ctx, el, opts): a first-person view on an endless plain. The ground marks live on a 64 m tile
     drawn 2 × 2 round the viewer (so they never end and are never tied to the route) or, for Reckon's
     last flow level, as short-lived dots that fade in and out (≥ 0.8 s, out of phase: no flashing) and
     respawn round the viewer. Marks fade into the plain before they would be under ~3 device pixels
     tall (a shader fade from the screen's pixel density), which removes the shimmer of sub-pixel marks
     on phones. Flat sky, unlit materials, a fog horizon with no structure in azimuth.
   - dial(opts): the arrow circle (drag or tap; its top is straight ahead); fine(opts): ◀5° ◀1° 1°▶ 5°▶
     buttons with press-and-hold; drag(el, opts): drag the view sideways to turn (0.25° per CSS px).
   - walker(S, plan, opts): plays a motion plan (Homing's gen lib: legs and turns with raised-cosine
     ramps), integrated from rAF dt. A pause (the view's own, or the player's pause sheet, which makes
     ctx.host inert) freezes it. Void rule, from what harms the task (motion is integrated from clamped
     dt, so a slow frame slows the walk but never jumps it): a lost WebGL context; a freeze over
     FREEZE_MS while moving; more than SLOW_SHARE of the moving time shown in frames over 100 ms (under
     10 fps); the view changing shape (the phone turned); the page hidden or paused mid-walk.
   - map(item, opts) + mapSteps(...): show me, the route from above, leg by leg, then turned so you
     face up; Reckon adds the believed home vector.
   - layout(ctx, opts): the shared DOM: view on top (phones) or left (wide screens), captions as
     subtitles over the view, a one-row turn control (◀5° ◀1° circle 1°▶ 5°▶), the actions.

   Homing's view: present → the start ring, then the route (the answer clock starts at the first answer
   frame); collect → turn (drag, circle, buttons, ← → with Shift for 1°), Confirm (Enter); reveal → the
   start flag, the view turns to it, the circle shows the way back, the tolerance and the error;
   show me → the map; demo → the route with captions, the map, the turn to the start. */
(function (PX) {
  'use strict';

  var S2 = PX.core.svg, timing = PX.core.timing, h = PX.ui.h;
  var T = window.THREE || null;
  var TILE = 64;                         // ground tile (m); fades end well inside TILE / 2
  var MIN_PX = 3;                        // device pixels a mark's height may shrink to before it has faded
  var FADE = [8, 28];                    // bounds of the fade's far end (m)
  var FREEZE_MS = 1000, SLOW_SHARE = 0.5, SLOW_GAP = 100; // the walk's void rule (see the header)
  var DRAG_DEG = 0.25;                   // degrees turned per CSS px dragged
  var DIAL_R = 46, DIAL_BOX = 66, HUB = 7;

  function isNum(v) { return typeof v === 'number' && isFinite(v); }
  function rad(d) { return d * Math.PI / 180; }
  function f2(v) { return (Math.round(v * 100) / 100).toString(); }
  function norm360(a) { a %= 360; return a < 0 ? a + 360 : a; }
  function norm180(a) { a = norm360(a); return a > 180 ? a - 360 : a; }
  function adiff(a, b) { return Math.abs(norm180(a - b)); }
  function ease(k) { return k * k * (3 - 2 * k); }
  function clamp(x, a, b) { return x < a ? a : x > b ? b : x; }
  function polar(x, y, b, r) { return [x + r * Math.sin(rad(b)), y - r * Math.cos(rad(b))]; }
  function side(a) { a = norm360(Math.round(a)); return a <= 180 ? { deg: a, side: 'right' } : { deg: 360 - a, side: 'left' }; }
  function fill(s, vars) {
    s = String(s || '');
    for (var k in vars || {}) if (Object.prototype.hasOwnProperty.call(vars, k)) s = s.split('{' + k + '}').join(vars[k]);
    return s;
  }
  function capFor(id) {
    return function (key, vars) { var L = PX.ex.learn(id) || {}; return fill((L.captions || {})[key], vars); };
  }
  function sideText(kc, a) {
    a = norm360(Math.round(a));
    if (a === 0) return kc('ahead') || 'straight ahead';
    if (a === 180) return kc('behind') || 'straight behind';
    var s = side(a);
    return s.deg + '° ' + (kc(s.side) || s.side);
  }
  function hostPaused(ctx) {
    var host = ctx && ctx.host;
    return !!(host && (host.hasAttribute && host.hasAttribute('inert') || (host.closest && host.closest('[data-paused],[inert]'))));
  }
  function genLib() { var d = PX.ex.get('homing'); return (d && d.lib) || {}; }

  /* =====================================================================================
     The first-person stage
     ===================================================================================== */

  function lum(c) { return 0.2126 * c.r + 0.7152 * c.g + 0.0722 * c.b; }
  function palette(ctx) {
    var c = ctx.stage3d.colors(), dark = lum(c.ground) < 0.35, sky = c.ground.clone();
    var plain = sky.clone().lerp(c.face2, dark ? 0.24 : 0.42);
    return {
      sky: sky, plain: plain,
      marks: plain.clone().lerp(dark ? c.edge : c.face3, dark ? 0.6 : 0.75),
      land: dark ? c.face3.clone().lerp(sky, 0.2) : c.edge.clone().lerp(sky, 0.4),
      target: c.target.clone(),
      ink: dark ? c.face.clone() : c.edge.clone(),
    };
  }
  // Marks fade into the plain colour between uFade.x and uFade.y metres of view depth, before the scene's
  // fog, so the faded mark and the plain behind it are fogged alike (no seam at the horizon).
  function fadeMaterial(S, params) {
    var m = new T.MeshBasicMaterial(params);
    m.onBeforeCompile = function (sh) {
      sh.uniforms.uFadePlain = S.plainU;
      sh.uniforms.uFade = S.fadeU;
      sh.fragmentShader = 'uniform vec3 uFadePlain;\nuniform vec2 uFade;\n' + sh.fragmentShader.replace('#include <opaque_fragment>',
        '#ifdef USE_FOG\n\toutgoingLight = mix(outgoingLight, uFadePlain, smoothstep(uFade.x, uFade.y, vFogDepth));\n#endif\n#include <opaque_fragment>');
    };
    m.customProgramCacheKey = function () { return 'px-fp-fade'; };
    return m;
  }

  // The marks of one ground tile (TILE × TILE m): irregular pentagons at random places and turns (no
  // lines or lattice, so they give motion but no direction), from the ground's own seed.
  function blobTile(spec) {
    var r = PX.rng(spec.seed >>> 0), n = Math.round(spec.density * TILE * TILE), pos = new Float32Array(n * 27), o = 0, ring = [];
    var lo = spec.size[0] / 2, hi = spec.size[1] / 2;
    for (var i = 0; i < n; i++) {
      var x = r.float(0, TILE), y = r.float(0, TILE), s = r.float(lo, hi), rot = r.float(0, 2 * Math.PI), k;
      for (k = 0; k < 5; k++) {
        var q = rot + k * 2 * Math.PI / 5 + r.float(-0.25, 0.25), rr = s * r.float(0.75, 1.2);
        ring[k] = [x + rr * Math.cos(q), -(y + rr * Math.sin(q))];
      }
      for (k = 1; k < 4; k++) [ring[0], ring[k], ring[k + 1]].forEach(function (v) { pos[o++] = v[0]; pos[o++] = 0.012; pos[o++] = v[1]; });
    }
    var geo = new T.BufferGeometry();
    geo.setAttribute('position', new T.Float32BufferAttribute(pos, 3));
    geo.computeBoundingSphere();
    return geo;
  }

  function stage(ctx, el, opts) {
    var o = opts || {}, kc = o.cap || function () { return ''; };
    var S = { ctx: ctx, el: el, o: o, pose: { x: 0, y: 0, h: 0 }, hold: false, spec: null, tiles: [], dots: null, med: 0.6 };
    S.hfov = o.hfov || 74; S.pitch = isNum(o.pitch) ? o.pitch : -7; S.eye = o.eye || 1.6;
    var p = palette(ctx);
    S.pal = p;
    S.plainU = { value: p.plain.clone() };
    S.fadeU = { value: new T.Vector2(8, 16) };
    S.mats = {
      plain: new T.MeshBasicMaterial({ color: p.plain, polygonOffset: true, polygonOffsetFactor: 2, polygonOffsetUnits: 2 }),
      marks: fadeMaterial(S, { color: p.marks, side: T.DoubleSide }),
      dots: fadeMaterial(S, { color: 0xffffff, side: T.DoubleSide }),
      land: new T.MeshBasicMaterial({ color: p.land, fog: false }),
      start: new T.MeshBasicMaterial({ color: p.target, side: T.DoubleSide }),
      stop: new T.MeshBasicMaterial({ color: p.ink, side: T.DoubleSide }),
    };
    S.scene = new T.Scene();
    S.scene.background = p.sky;
    S.scene.fog = new T.Fog(p.sky.clone(), (o.fog || [18, 190])[0], (o.fog || [18, 190])[1]);
    S.cam = new T.PerspectiveCamera(50, 1.5, 0.1, 1500);
    S.plainGeo = new T.CircleGeometry(900, 64);
    S.plain = new T.Mesh(S.plainGeo, S.mats.plain);
    S.plain.rotation.x = -Math.PI / 2;
    S.scene.add(S.plain);
    S.groundG = new T.Group();
    S.scene.add(S.groundG);
    S.world = new T.Group();
    S.scene.add(S.world);
    // the overlay pieces of the stage (classes in css/ex/homing.css, shared by Reckon)
    S.notch = h('span.ex-fp-notch', { 'aria-hidden': 'true' });
    S.overlay = h('div.ex-fp-overlay', { hidden: true });
    S.pauseNote = h('p.ex-fp-pause', { hidden: true, role: 'status' });
    S.sub = h('p.ex-fp-sub', { 'aria-live': 'polite' });
    [S.notch, S.overlay, S.pauseNote, S.sub].forEach(function (x) { el.appendChild(x); });
    S.offTheme = PX.bus && PX.bus.on ? PX.bus.on('stage3d:theme', function () { S.recolour(); }) : null;

    S.attach = function () {
      if (!S.view || ctx.stage3d.current() !== S.view) { S.view = ctx.stage3d.attach(el); if (S.view) S.view.redraw = function () { S.render(); }; }
      return S.view;
    };
    S.recolour = function () {
      var q = palette(ctx);
      S.pal = q;
      S.mats.plain.color.copy(q.plain); S.mats.marks.color.copy(q.marks); S.mats.land.color.copy(q.land); S.mats.start.color.copy(q.target); S.mats.stop.color.copy(q.ink);
      S.plainU.value.copy(q.plain);
      S.scene.background = q.sky;
      S.scene.fog.color.copy(q.sky);
      if (S.dots) S.dots.paint();
      S.render();
    };
    S.setPose = function (x, y, hd) {
      S.pose = { x: x, y: y, h: hd };
      S.cam.position.set(x, S.eye, -y);
      S.cam.rotation.set(rad(S.pitch), -rad(hd), 0, 'YXZ');
    };
    S.size = function () { return { w: el.clientWidth, h: el.clientHeight }; };
    // The fade ends where a mark of the median size would be MIN_PX device pixels tall: its height on the
    // screen is about size × eye / distance² radians (seen at a grazing angle).
    S.fadeFor = function (widthCss) {
      var q = ctx.stage3d.quality ? ctx.stage3d.quality() : null, dpr = q && q.dpr > 0 ? q.dpr : 1;
      var pxPerRad = Math.max(1, widthCss) * dpr / rad(S.hfov);
      return clamp(Math.sqrt(S.med * S.eye * pxPerRad / MIN_PX), FADE[0], FADE[1]);
    };
    S.render = function () {
      var v = S.view;
      if (!v || ctx.stage3d.current() !== v) return;
      if (!S.hold) v.resize();
      var a = v.width / Math.max(1, v.height), vfov = Math.min(o.vfovMax || 80, 2 * Math.atan(Math.tan(rad(S.hfov / 2)) / a) * 180 / Math.PI);
      if (S.cam.fov !== vfov || S.cam.aspect !== a) { S.cam.fov = vfov; S.cam.aspect = a; S.cam.updateProjectionMatrix(); }
      var far = S.fadeFor(v.width);
      S.fadeU.value.set(0.5 * far, far);
      S.plain.position.set(S.pose.x, 0, -S.pose.y);
      placeTiles();
      v.render(S.scene, S.cam);
    };
    // The 2 × 2 tiles whose union covers [x − TILE/2, x + TILE/2] round the viewer.
    function placeTiles() {
      if (!S.tiles.length) return;
      var ox = Math.floor((S.pose.x - TILE / 2) / TILE) * TILE, oy = Math.floor((S.pose.y - TILE / 2) / TILE) * TILE;
      for (var i = 0; i < 4; i++) S.tiles[i].position.set(ox + (i & 1) * TILE, 0, -(oy + (i >> 1) * TILE));
    }
    S.setGround = function (spec) {
      clearGround();
      S.spec = spec || null;
      if (!spec) return;
      S.med = (spec.size[0] + spec.size[1]) / 2;
      if (spec.kind === 'dots') { S.dots = dotField(S, spec); S.groundG.add(S.dots.mesh); }
      else {
        S.tileGeo = blobTile(spec);
        for (var i = 0; i < 4; i++) { var m = new T.Mesh(S.tileGeo, S.mats.marks); m.frustumCulled = false; S.tiles.push(m); S.groundG.add(m); }
      }
    };
    function clearGround() {
      S.tiles.forEach(function (m) { S.groundG.remove(m); });
      S.tiles = [];
      if (S.tileGeo) { S.tileGeo.dispose(); S.tileGeo = null; }
      if (S.dots) { S.groundG.remove(S.dots.mesh); S.dots.dispose(); S.dots = null; }
    }
    // Advances what lives in the ground (the dots' fade cycles) by dt seconds; static marks ignore it.
    S.tick = function (dt) { if (S.dots) S.dots.step(dt); };
    // The start: a ring on the ground and a flag (shown at reveal).
    S.setStart = function (x, y, r) {
      if (S.ring) { S.world.remove(S.ring); S.ring.geometry.dispose(); }
      if (S.flag) { S.world.remove(S.flag); S.flag.traverse(function (q) { if (q.geometry) q.geometry.dispose(); }); }
      S.ring = new T.Mesh(new T.RingGeometry(r - 0.35, r, 48), S.mats.start);
      S.ring.rotation.x = -Math.PI / 2;
      S.ring.position.set(x, 0.02, -y);
      S.flag = flagGroup(S.mats.start);
      S.flag.position.set(x, 0, -y);
      S.flag.visible = false;
      S.world.add(S.ring, S.flag);
    };
    S.moveFlag = function (x, y) { if (S.flag) S.flag.position.set(x, 0, -y); };
    // Where the player stopped (Reckon's walk back): a small dark ring, unlike the start's.
    S.setStop = function (x, y) {
      if (!S.stop) { S.stop = new T.Mesh(new T.RingGeometry(0.32, 0.5, 32), S.mats.stop); S.stop.rotation.x = -Math.PI / 2; S.world.add(S.stop); }
      S.stop.position.set(x, 0.025, -y);
      S.stop.visible = true;
    };
    S.hideStop = function () { if (S.stop) S.stop.visible = false; };
    S.showRing = function (on) { if (S.ring) S.ring.visible = !!on; };
    S.showFlag = function (on) { if (S.flag) S.flag.visible = !!on; };
    // Turns the view smoothly to a heading (the answer while turning, the start at reveal).
    S.lookTo = function (hdg, ms) {
      if (S.lookStop) { S.lookStop(); S.lookStop = null; }
      var from = S.pose.h, d = norm180(hdg - from), t = 0, dur = ctx.fast || ctx.reducedMotion ? 0 : ms;
      if (!dur || Math.abs(d) < 0.05) { S.setPose(S.pose.x, S.pose.y, from + d); S.render(); return Promise.resolve(); }
      return new Promise(function (resolve) {
        S.lookStop = timing.loop(function (dt) {
          t += dt;
          var k = Math.min(1, t / dur);
          S.tick(dt / 1000);
          S.setPose(S.pose.x, S.pose.y, from + d * ease(k));
          S.render();
          if (k >= 1) { S.lookStop = null; resolve(); return false; }
          return true;
        });
      });
    };
    S.stopLook = function () { if (S.lookStop) { S.lookStop(); S.lookStop = null; } };
    S.dispose = function () {
      S.stopLook();
      if (S.offTheme) S.offTheme();
      clearGround();
      S.world.traverse(function (q) { if (q.geometry && !(q.geometry.userData && q.geometry.userData.shared)) q.geometry.dispose(); });
      S.plainGeo.dispose();
      Object.keys(S.mats).forEach(function (k) { S.mats[k].dispose(); });
      if (S.view) S.view.detach();
    };
    S.attach();
    S.setPose(0, 0, 0);
    ctx.stage3d.compile(S.scene, S.cam);
    return S;
  }

  function flagGroup(mat) {
    var flag = new T.Group();
    var pole = new T.Mesh(new T.CylinderGeometry(0.07, 0.07, 3.4, 8), mat);
    pole.position.y = 1.7;
    var cloth = new T.Mesh(new T.PlaneGeometry(1.5, 0.95), mat);
    cloth.position.set(0.75, 2.9, 0);
    var foot = new T.Mesh(new T.RingGeometry(0.9, 1.2, 32), mat);
    foot.rotation.x = -Math.PI / 2;
    foot.position.y = 0.02;
    flag.add(pole, cloth, foot);
    return flag;
  }

  // Short-lived dots (Reckon's last flow level): each fades in, holds and fades out over its life
  // (0.8–1.4 s, out of phase with the others: no flashing), then respawns at a random place within DOT_R
  // of the viewer. The colour runs from the plain's (invisible) to the marks' and back.
  var DOT_R = 24, DOT_FADE = 0.3;
  function dotField(S, spec) {
    var r = PX.rng((spec.seed ^ 0x5bd1e995) >>> 0), n = Math.round(spec.density * Math.PI * DOT_R * DOT_R);
    var geo = new T.CircleGeometry(0.5, 7);
    geo.rotateX(-Math.PI / 2);
    var mesh = new T.InstancedMesh(geo, S.mats.dots, n);
    mesh.frustumCulled = false;
    var x = new Float32Array(n), y = new Float32Array(n), age = new Float32Array(n), life = new Float32Array(n), size = new Float32Array(n);
    var M = new T.Matrix4(), C = new T.Color(), moved = false;
    function spawn(i, fresh) {
      var a = r.float(0, 2 * Math.PI), d = DOT_R * Math.sqrt(r.next());
      x[i] = S.pose.x + d * Math.cos(a); y[i] = S.pose.y + d * Math.sin(a);
      life[i] = r.float(spec.life[0], spec.life[1]);
      age[i] = fresh ? r.float(0, life[i]) : 0;
      size[i] = r.float(spec.size[0], spec.size[1]);
      M.makeScale(size[i], 1, size[i]);
      M.setPosition(x[i], 0.015, -y[i]);
      mesh.setMatrixAt(i, M);
      moved = true;
    }
    function env(i) { var t = age[i], L = life[i]; return ease(clamp(t / DOT_FADE, 0, 1)) * ease(clamp((L - t) / DOT_FADE, 0, 1)); }
    function paint() {
      var pl = S.pal.plain, mk = S.pal.marks;
      for (var i = 0; i < n; i++) { var e = env(i); C.setRGB(pl.r + (mk.r - pl.r) * e, pl.g + (mk.g - pl.g) * e, pl.b + (mk.b - pl.b) * e); mesh.setColorAt(i, C); }
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
      if (moved) { mesh.instanceMatrix.needsUpdate = true; moved = false; }
    }
    for (var i = 0; i < n; i++) spawn(i, true);
    paint();
    return {
      mesh: mesh,
      step: function (dt) {
        if (!(dt > 0)) return;
        for (var j = 0; j < n; j++) {
          age[j] += dt;
          var dx = x[j] - S.pose.x, dy = y[j] - S.pose.y;
          if (age[j] >= life[j] || dx * dx + dy * dy > DOT_R * DOT_R) spawn(j, false);
        }
        paint();
      },
      paint: paint,
      count: n,
      dispose: function () { geo.dispose(); mesh.dispose(); },
    };
  }

  /* =====================================================================================
     Controls: the arrow circle, the fine-turn buttons, dragging the view
     ===================================================================================== */

  function circle(r, cls, cx, cy) { return S2.el('circle', { cx: f2(cx || 0), cy: f2(cy || 0), r: f2(r), class: cls }); }
  function segment(a, b, cls) { return S2.el('line', { x1: f2(a[0]), y1: f2(a[1]), x2: f2(b[0]), y2: f2(b[1]), class: cls }); }
  function poly(points, cls) { return S2.el('polygon', { points: points.map(function (p) { return f2(p[0]) + ',' + f2(p[1]); }).join(' '), class: cls }); }
  function arrowHead(len, cls) { return S2.el('path', { d: 'M0 ' + (-len) + 'L-3.6 ' + (-len + 7.5) + 'L3.6 ' + (-len + 7.5) + 'Z', class: cls }); }
  function dialArrow(cls) {
    var g = S2.el('g', { class: cls, visibility: 'hidden' });
    g.appendChild(S2.el('line', { x1: 0, y1: 0, x2: 0, y2: -DIAL_R + 6, class: cls + '-line' }));
    g.appendChild(arrowHead(DIAL_R - 0.5, cls + '-head'));
    return g;
  }
  function setRot(g, deg) {
    if (!isNum(deg)) { g.setAttribute('visibility', 'hidden'); return; }
    g.setAttribute('transform', 'rotate(' + f2(norm360(deg)) + ')');
    g.setAttribute('visibility', 'visible');
  }
  // The arrow circle: its top is straight ahead at the end of the route. Your arrow (open head), the
  // key (filled), a tolerance wedge. Pointer: drag along it or tap it (opts.onAngle(deg, e)).
  function dial(opts) {
    var kc = opts.cap;
    var svg = S2.svg(2 * DIAL_BOX, 2 * DIAL_BOX, {
      viewBox: [-DIAL_BOX, -DIAL_BOX, 2 * DIAL_BOX, 2 * DIAL_BOX].join(' '), width: '100%', height: '100%', class: 'ex-fp-dial',
      role: 'slider', tabindex: 0, 'aria-label': kc('dialLabel') || 'Arrow circle', 'aria-valuemin': 0, 'aria-valuemax': 359, 'aria-valuetext': kc('notSet') || 'not set',
    });
    svg.appendChild(circle(DIAL_R, 'ex-fp-face'));
    for (var b = 0; b < 360; b += 30) svg.appendChild(segment(polar(0, 0, b, DIAL_R), polar(0, 0, b, DIAL_R - (b % 90 ? 3 : 6)), 'ex-fp-tick'));
    var wedge = S2.el('path', { class: 'ex-fp-wedge', visibility: 'hidden' });
    svg.appendChild(wedge);
    svg.appendChild(S2.el('line', { x1: 0, y1: -HUB, x2: 0, y2: -DIAL_R + 7, class: 'ex-fp-ahead-line' }));
    svg.appendChild(S2.text(0, -DIAL_R - 9.5, kc('aheadLabel') || 'ahead', { class: 'ex-fp-dial-name' }));
    svg.appendChild(S2.text(-DIAL_R - 2.5, 0, kc('left') || 'left', { class: 'ex-fp-dial-side', 'text-anchor': 'end' }));
    svg.appendChild(S2.text(DIAL_R + 2.5, 0, kc('right') || 'right', { class: 'ex-fp-dial-side', 'text-anchor': 'start' }));
    var key = dialArrow('ex-fp-key'), yours = dialArrow('ex-fp-arrow');
    svg.appendChild(key);
    svg.appendChild(yours);
    svg.appendChild(circle(HUB - 0.5, 'ex-fp-hub'));
    svg.appendChild(poly([[0, -4], [3.2, 3], [-3.2, 3]], 'ex-fp-hub-you'));
    var D = { svg: svg, live: false };
    D.set = function (deg, text) {
      setRot(yours, deg);
      if (isNum(deg)) { svg.setAttribute('aria-valuenow', String(norm360(Math.round(deg)))); svg.setAttribute('aria-valuetext', text || ''); }
      else { svg.removeAttribute('aria-valuenow'); svg.setAttribute('aria-valuetext', kc('notSet') || 'not set'); }
    };
    D.key = function (deg) { setRot(key, deg); };
    D.mark = function (cls) { yours.setAttribute('class', 'ex-fp-arrow' + (cls ? ' ' + cls : '')); };
    D.wedge = function (center, half) {
      if (!isNum(center)) { wedge.setAttribute('visibility', 'hidden'); return; }
      var a = polar(0, 0, center - half, DIAL_R - 1), c = polar(0, 0, center + half, DIAL_R - 1);
      wedge.setAttribute('d', 'M0 0L' + f2(a[0]) + ' ' + f2(a[1]) + 'A' + (DIAL_R - 1) + ' ' + (DIAL_R - 1) + ' 0 ' + (2 * half > 180 ? 1 : 0) + ' 1 ' + f2(c[0]) + ' ' + f2(c[1]) + 'Z');
      wedge.setAttribute('visibility', 'visible');
    };
    function angleAt(e) {
      var r = svg.getBoundingClientRect(), s = Math.min(r.width, r.height) / (2 * DIAL_BOX);
      if (!(s > 0)) return null;
      var dx = (e.clientX - (r.left + r.width / 2)) / s, dy = (e.clientY - (r.top + r.height / 2)) / s;
      if (dx * dx + dy * dy < HUB * HUB) return null;
      return Math.atan2(dx, -dy) * 180 / Math.PI;
    }
    var drag = null;
    svg.addEventListener('pointerdown', function (e) {
      if (!D.live || (e.button !== undefined && e.button > 0)) return;
      var a = angleAt(e);
      if (a === null) return;
      e.preventDefault();
      drag = e.pointerId;
      try { svg.setPointerCapture(e.pointerId); } catch (err) { /* capture is optional */ }
      opts.onAngle(a, e);
    });
    svg.addEventListener('pointermove', function (e) {
      if (drag === null || e.pointerId !== drag || !D.live) return;
      var a = angleAt(e);
      if (a !== null) opts.onAngle(a, e);
    });
    function up(e) { if (e.pointerId === drag) drag = null; }
    svg.addEventListener('pointerup', up);
    svg.addEventListener('pointercancel', up);
    svg.addEventListener('lostpointercapture', up);
    D.angleAt = angleAt;
    return D;
  }

  // Fine turns: ◀5° ◀1° 1°▶ 5°▶. A press turns once, holding repeats (after 400 ms, every 90 ms); keyboard
  // activation (a click with detail 0) turns once. opts: { cap, onTurn(deltaDeg, e) }.
  function fine(opts) {
    var kc = opts.cap, out = {};
    [[-5, 'l5'], [-1, 'l1'], [1, 'r1'], [5, 'r5']].forEach(function (d) {
      var deg = Math.abs(d[0]), left = d[0] < 0;
      var b = h('button.px-btn.px-btn--secondary.ex-fp-fine', { type: 'button', 'data-turn': String(d[0]),
        'aria-label': kc('fineLabel', { deg: deg, side: kc(left ? 'left' : 'right') || (left ? 'left' : 'right') }) || (deg + '° ' + (left ? 'left' : 'right')) },
      left ? '◀ ' + deg + '°' : deg + '° ▶');
      var timer = 0;
      function stop() { if (timer) { window.clearTimeout(timer); timer = 0; } }
      function rep() { opts.onTurn(d[0], null); timer = window.setTimeout(rep, 90); }
      b.addEventListener('pointerdown', function (e) {
        if (b.disabled || (e.button !== undefined && e.button > 0)) return;
        e.preventDefault();
        try { b.setPointerCapture(e.pointerId); } catch (err) { /* optional */ }
        opts.onTurn(d[0], e);
        stop();
        timer = window.setTimeout(rep, 400);
      });
      ['pointerup', 'pointercancel', 'lostpointercapture', 'pointerleave'].forEach(function (ev) { b.addEventListener(ev, stop); });
      b.addEventListener('click', function (e) { if (e.detail === 0 && !b.disabled) opts.onTurn(d[0], e); });
      b.stop = stop;
      out[d[1]] = b;
    });
    out.all = [out.l5, out.l1, out.r1, out.r5];
    out.disable = function (on) { out.all.forEach(function (b) { b.disabled = !!on; if (on) b.stop(); }); };
    return out;
  }

  // Drag sideways on the view to turn: the world follows the finger (DRAG_DEG per CSS px).
  // opts: { enabled() → bool, onTurn(deltaDeg, e) }.
  function drag(el, opts) {
    var id = null, lastX = 0;
    el.addEventListener('pointerdown', function (e) {
      if (!opts.enabled() || (e.button !== undefined && e.button > 0)) return;
      id = e.pointerId; lastX = e.clientX;
      try { el.setPointerCapture(e.pointerId); } catch (err) { /* optional */ }
      e.preventDefault();
    });
    el.addEventListener('pointermove', function (e) {
      if (id === null || e.pointerId !== id) return;
      var dx = e.clientX - lastX;
      lastX = e.clientX;
      if (dx && opts.enabled()) opts.onTurn(-dx * DRAG_DEG, e);
    });
    function up(e) { if (e.pointerId === id) id = null; }
    el.addEventListener('pointerup', up);
    el.addEventListener('pointercancel', up);
    el.addEventListener('lostpointercapture', up);
  }

  /* =====================================================================================
     The walker: plays a motion plan; pause freezes it; judges its own frames
     ===================================================================================== */

  // opts: { ctx, fast, paused() → bool, onFrame(pose, t), onVoid(reason, stats) }. Returns W with
  // W.done (Promise of the stats), W.stop(), W.stats().
  function walker(S, plan, opts) {
    var L = genLib(), ctx = opts.ctx, scale = opts.fast ? 0.02 : 1, t = 0, last = -1, done = false;
    var st = { frames: 0, moving: 0, motionMs: 0, slowMs: 0, maxFreezeMs: 0, hidden: false, lost: false, turned: false, paused: false, gaps: [] };
    var size0 = S.size(), doc = window.document, reason = null;
    var offLost = PX.bus && PX.bus.on ? PX.bus.on('stage3d:lost', function () { st.lost = true; judge(); }) : null;
    function onVis() { if (doc.hidden) { st.hidden = true; judge(); } last = -1; }
    doc.addEventListener('visibilitychange', onVis);
    // final: the share of slow frames is judged over the whole walk only.
    function judge(final) {
      var r = st.lost ? 'lost' : st.turned ? 'turned' : st.paused || st.hidden ? 'paused'
        : st.maxFreezeMs > FREEZE_MS || (final && st.motionMs > 0 && st.slowMs > SLOW_SHARE * st.motionMs) ? 'stutter' : null;
      if (r && !reason) { reason = r; if (opts.onVoid) opts.onVoid(r, summary()); }
      return reason;
    }
    function summary() {
      var g = st.gaps.slice().sort(function (a, b) { return a - b; }), q = function (p) { return g.length ? g[Math.min(g.length - 1, Math.floor(p * g.length))] : 0; };
      return { frames: st.frames, moving: st.moving, medianMs: Math.round(q(0.5) * 10) / 10, p95Ms: Math.round(q(0.95) * 10) / 10,
        maxGapMs: Math.round(st.maxFreezeMs), slowShare: st.motionMs ? Math.round(1000 * st.slowMs / st.motionMs) / 1000 : 0,
        motionMs: Math.round(st.motionMs), contextLost: st.lost, hidden: st.hidden, turned: st.turned, paused: st.paused,
        stutter: st.maxFreezeMs > timing.STUTTER_GAP || (st.motionMs > 0 && st.slowMs > 0.15 * st.motionMs) || st.lost };
    }
    var W = { stats: summary, reason: function () { return reason; } };
    W.done = new Promise(function (resolve) {
      function finish() {
        if (done) return;
        done = true;
        doc.removeEventListener('visibilitychange', onVis);
        if (offLost) offLost();
        judge(true);
        resolve(summary());
      }
      W.stop = function () { if (W.loopStop) W.loopStop(); finish(); };
      W.loopStop = timing.loop(function (dt, now) {
        if (done) return false;
        var gap = last < 0 ? 0 : now - last;
        last = now;
        if (opts.paused && opts.paused()) { if (!st.paused) { st.paused = true; judge(); } return true; }
        st.frames++;
        var pose = L.poseAt(plan, Math.min(t, plan.total)), moving = pose && pose.kind !== 'stand' && t < plan.total;
        if (moving && gap > 0) {
          st.moving++; st.motionMs += gap;
          if (gap > SLOW_GAP) st.slowMs += gap;
          if (gap > st.maxFreezeMs) st.maxFreezeMs = gap;
          if (st.gaps.length < 4000) st.gaps.push(gap);
        }
        var sz = S.size();
        if (Math.abs(sz.w - size0.w) >= 2 || Math.abs(sz.h - size0.h) > 0.15 * Math.max(1, size0.h)) { st.turned = true; judge(); }
        t += dt / 1000 / scale;
        S.tick(dt / 1000);
        pose = L.poseAt(plan, Math.min(t, plan.total));
        S.setPose(pose.x, pose.y, pose.h);
        if (opts.onFrame) opts.onFrame(pose, t);
        S.render();
        if (st.maxFreezeMs > FREEZE_MS) judge();
        if (t >= plan.total) { finish(); return false; }
        return true;
      });
    });
    return W;
  }

  /* =====================================================================================
     Show me: the route from above (start heading up), then turned so that you face up
     ===================================================================================== */

  // A map of one item in the stage's overlay. o: { cap, landmarks (draw them on the rim) }.
  function routeMap(item, o) {
    var kc = o.cap, P = item.path, h0 = item.startHeading, s = Math.sin(rad(h0)), c = Math.cos(rad(h0));
    function mp(p) { return [p[0] * c - p[1] * s, -(p[0] * s + p[1] * c)]; }
    var pts = P.map(mp), E = pts[pts.length - 1], R = 0;
    pts.forEach(function (q) { R = Math.max(R, Math.hypot(q[0] - E[0], q[1] - E[1])); });
    if (o.reach) R = Math.max(R, o.reach);
    // Landmarks sit on a ring outside the route (0.88 H, with H = 1.42 R + 2.5), so route labels and
    // landmark dots rarely meet; placeLabels keeps the movable labels clear of each other.
    var H = Math.max(9, R * 1.42 + 2.5), u = H / 50;
    // Text at least 12.5 CSS px on the screen (o.px: the overlay's smaller side), else 3.6 % of the map.
    var fs = Math.max(3.6 * u, 12.5 * 2 * H / Math.max(120, o.px || 400));
    var svg = S2.svg(2 * H, 2 * H, { viewBox: [E[0] - H, E[1] - H, 2 * H, 2 * H].map(f2).join(' '), width: '100%', height: '100%', class: 'ex-fp-map', 'aria-hidden': 'true' });
    svg.appendChild(S2.el('style', {}, '.ex-fp-map text{font-size:' + f2(fs) + 'px;stroke-width:' + f2(fs / 4) + 'px}'));
    var world = S2.el('g'), route = S2.el('g'), marks = S2.el('g');
    world.appendChild(route);
    world.appendChild(marks);
    svg.appendChild(world);
    var m = { item: item, kc: kc, svg: svg, world: world, route: route, marks: marks, pts: pts, E: E, H: H, u: u, fs: fs, rho: 0, mp: mp,
      uprights: [], fixed: [], lands: [], dots: [], labels: [], spots: [] };
    var end = P[P.length - 1], edge = S2.el('g', { class: 'ex-fp-maplandmarks' });
    (o.landmarks ? item.landmarks || [] : []).forEach(function (Lm) {
      var b = Math.atan2(Lm.x - end[0], Lm.y - end[1]) * 180 / Math.PI - h0, q = polar(E[0], E[1], b, H * 0.88);
      edge.appendChild(circle(1.5 * u, 'ex-fp-maplandmark', q[0], q[1]));
      m.dots.push(q);
      var lab = label(m, edge, q, Lm.name, 'ex-fp-maplabel');
      m.fixed.push(lab);
      m.lands.push(lab);
    });
    world.insertBefore(edge, route);
    return m;
  }
  // A text that stays upright while the map turns, anchored at the world point p.
  function label(m, parent, p, text, cls) {
    var outer = S2.el('g', { transform: 'translate(' + f2(p[0]) + ' ' + f2(p[1]) + ')' }), inner = S2.el('g', {});
    var t = S2.text(0, 0, text, { class: cls });
    inner.appendChild(t);
    outer.appendChild(inner);
    parent.appendChild(outer);
    inner.setAttribute('transform', m.rho ? 'rotate(' + f2(-m.rho) + ')' : '');
    return { inner: inner, text: t, p: p, w: (0.58 * String(text).length + 0.6) * m.fs, h: 1.3 * m.fs };
  }
  function setMapTurn(m, k) {
    m.rho = -norm180(m.item.heading - m.item.startHeading) * k;
    m.world.setAttribute('transform', m.rho ? 'rotate(' + f2(m.rho) + ' ' + f2(m.E[0]) + ' ' + f2(m.E[1]) + ')' : '');
    var keep = m.rho ? 'rotate(' + f2(-m.rho) + ')' : '';
    m.uprights.forEach(function (x) { x.inner.setAttribute('transform', keep); });
    placeLabels(m);
  }
  // Every map label moves to the candidate spot that overlaps least with the labels placed before it,
  // the route's corners and the dots, and stays inside the map (run after every change).
  var DOT_SPOTS = [[0, 1, 'middle'], [0, -1, 'middle'], [1, 0, 'start'], [-1, 0, 'end'],
    [0.7, 0.85, 'start'], [-0.7, 0.85, 'end'], [0.7, -0.85, 'start'], [-0.7, -0.85, 'end']];
  function candidates(m, l) {
    var u = m.u, out = [];
    if (l.bis !== undefined) {
      var g = Math.max(3.4 * u, 0.95 * m.fs);
      [l.r + g, l.r + 2 * g, l.r + 3 * g].forEach(function (rr, ri) {
        [0, -30, 30, -60, 60].forEach(function (dl, di) {
          var q = polar(0, 0, l.bis + dl + m.rho, rr);
          out.push({ dx: q[0], dy: q[1], anchor: 'middle', pref: ri * 0.6 + di * 0.15 });
        });
      });
      return out;
    }
    [1, 1.8].forEach(function (f, fi) {
      DOT_SPOTS.forEach(function (sp, i) { out.push({ dx: sp[0] * Math.max(2.6 * u, 0.7 * m.fs) * f, dy: sp[1] * Math.max(3.6 * u, m.fs) * f, anchor: sp[2], pref: fi * 0.8 + i * 0.01 }); });
    });
    return out;
  }
  function placeLabels(m) {
    var c = Math.cos(rad(m.rho)), s = Math.sin(rad(m.rho)), u = m.u, E = m.E, H = m.H;
    function rot(p) { var x = p[0] - E[0], y = p[1] - E[1]; return [E[0] + x * c - y * s, E[1] + x * s + y * c]; }
    function boxC(q, w, hh) { return { x0: q[0] - w / 2, x1: q[0] + w / 2, y0: q[1] - hh / 2, y1: q[1] + hh / 2 }; }
    function over(a, b) { var w = Math.min(a.x1, b.x1) - Math.max(a.x0, b.x0), hh = Math.min(a.y1, b.y1) - Math.max(a.y0, b.y0); return w > 0 && hh > 0 ? w * hh : 0; }
    var placed = [], u2 = u * u;
    var soft = m.pts.map(function (q) { var b = boxC(rot(q), 3.2 * u, 3.2 * u); b.at = q; return b; })
      .concat(m.dots.map(function (q) { var b = boxC(rot(q), 3.4 * u, 3.4 * u); b.at = q; return b; }));
    var order = (m.angle ? [m.angle] : []).concat(m.labels.filter(function (l) { return l !== m.angle; }), m.spots, m.lands);
    order.forEach(function (l) {
      var d = rot(l.p), best = null;
      candidates(m, l).forEach(function (cd) {
        var x0 = cd.anchor === 'middle' ? d[0] + cd.dx - l.w / 2 : cd.anchor === 'start' ? d[0] + cd.dx : d[0] + cd.dx - l.w;
        var b = { x0: x0, x1: x0 + l.w, y0: d[1] + cd.dy - l.h / 2, y1: d[1] + cd.dy + l.h / 2 };
        var cost = 50 * (Math.max(0, E[0] - H - b.x0) + Math.max(0, b.x1 - E[0] - H) + Math.max(0, E[1] - H - b.y0) + Math.max(0, b.y1 - E[1] - H)) + cd.pref * u2;
        placed.forEach(function (q) { cost += 4 * over(b, q); });
        soft.forEach(function (q) { if (q.at !== l.p) cost += 2 * over(b, q); });
        if (!best || cost < best.cost) best = { cost: cost, b: b, cd: cd };
      });
      l.text.setAttribute('x', f2(best.cd.dx));
      l.text.setAttribute('y', f2(best.cd.dy));
      l.text.setAttribute('text-anchor', best.cd.anchor);
      placed.push(best.b);
    });
  }
  function pointer(m, p, b, cls) {
    var u = m.u;
    m.marks.appendChild(poly([polar(p[0], p[1], b, 2.9 * u), polar(p[0], p[1], b + 145, 1.9 * u), polar(p[0], p[1], b - 145, 1.9 * u)], cls || 'ex-fp-you'));
  }
  function arcAt(m, p, b0, span, r, text, cls) {
    var a = polar(p[0], p[1], b0, r), b = polar(p[0], p[1], b0 + span, r);
    m.marks.appendChild(S2.el('path', { d: 'M' + f2(a[0]) + ' ' + f2(a[1]) + 'A' + f2(r) + ' ' + f2(r) + ' 0 0 ' + (span > 0 ? 1 : 0) + ' ' + f2(b[0]) + ' ' + f2(b[1]), class: cls }));
    var l = label(m, m.marks, p, text, cls + '-label');
    l.bis = b0 + span / 2;
    l.r = r;
    m.uprights.push(l);
    m.labels.push(l);
    return l;
  }
  // o: { legs, part: { i, k }, arcs, you: { at, k, b }, back, turn (0–1), angle, yours: { deg, r, k } }
  function mapScene(m, o) {
    var item = m.item, kc = m.kc, pts = m.pts, u = m.u, i;
    PX.ui.clear(m.route);
    PX.ui.clear(m.marks);
    m.uprights = m.fixed.slice();
    m.labels = [];
    m.spots = [];
    var beta = [0];
    for (i = 0; i < item.turns.length; i++) beta.push(beta[i] + item.turns[i]);
    for (i = 0; i < (o.legs || 0); i++) m.route.appendChild(segment(pts[i], pts[i + 1], 'ex-fp-leg'));
    if (o.part) {
      var a = pts[o.part.i], b = pts[o.part.i + 1];
      m.route.appendChild(segment(a, [a[0] + (b[0] - a[0]) * o.part.k, a[1] + (b[1] - a[1]) * o.part.k], 'ex-fp-leg'));
    }
    if (o.back) m.route.appendChild(segment(m.E, pts[0], 'ex-fp-back'));
    if (o.yours && isNum(o.yours.deg)) {
      // the believed home vector: an open arrow from the end (Reckon), to the stop when walked
      var by = beta[beta.length - 1] + o.yours.deg, len = (o.yours.r > 0.3 ? o.yours.r : item.distance) * (isNum(o.yours.k) ? o.yours.k : 1);
      var tip = polar(m.E[0], m.E[1], by, Math.max(0.01, len));
      m.route.appendChild(segment(m.E, tip, 'ex-fp-yours'));
      if (o.yours.r > 0.3) {
        m.marks.appendChild(circle(1.1 * u, 'ex-fp-stop', tip[0], tip[1]));
        if (!isNum(o.yours.k) || o.yours.k >= 1) m.route.appendChild(segment(tip, pts[0], 'ex-fp-miss'));
      } else pointer(m, tip, by, 'ex-fp-yours-head');
      var yl = label(m, m.marks, tip, kc('mapYou') || 'you', 'ex-fp-maplabel ex-fp-maplabel--you');
      m.uprights.push(yl);
      m.spots.push(yl);
    }
    for (i = 0; i < (o.arcs || 0); i++) arcAt(m, pts[i + 1], beta[i], item.turns[i], 3.8 * u, Math.round(Math.abs(item.turns[i])) + '°', 'ex-fp-turnarc');
    m.marks.appendChild(circle(1.4 * u, 'ex-fp-startdot', pts[0][0], pts[0][1]));
    var startLabel = label(m, m.marks, pts[0], kc('mapStart') || 'start', 'ex-fp-maplabel ex-fp-maplabel--start');
    m.uprights.push(startLabel);
    m.spots.push(startLabel);
    if (o.you) {
      var at = o.you.at, p = pts[at];
      if (o.you.k && at + 1 < pts.length) p = [p[0] + (pts[at + 1][0] - p[0]) * o.you.k, p[1] + (pts[at + 1][1] - p[1]) * o.you.k];
      pointer(m, p, o.you.b);
    }
    m.angle = o.angle ? arcAt(m, m.E, beta[beta.length - 1], norm180(keyOf(item)), 6 * u, Math.round(side(keyOf(item)).deg) + '°', 'ex-fp-anglearc') : null;
    setMapTurn(m, o.turn || 0);
  }
  function keyOf(item) { return typeof item.key === 'number' ? item.key : item.keyDeg; }
  function sweep(key, k) { return key <= 180 ? key * k : 360 - (360 - key) * k; }

  // The map in the stage's overlay, with the dial for the last step. o: { cap, landmarks, tools (the
  // Hide button's row) }. M.open(item, reach), M.close(), M.state(), M.steps(item, { yours, tol }).
  function mapper(S, D, o) {
    var kc = o.cap, M = { m: null };
    M.open = function (item, reach) {
      if (!M.m || M.m.item !== item || M.m.reach !== reach) {
        if (M.m && M.m.svg.parentNode) M.m.svg.parentNode.removeChild(M.m.svg);
        // px: the map's drawing box (the overlay less the subtitle's 2.75rem band), for 12.5 px labels
        M.m = routeMap(item, { cap: kc, landmarks: o.landmarks, reach: reach, px: Math.min(S.el.clientWidth, S.el.clientHeight - 44) });
        M.m.reach = reach;
        S.overlay.insertBefore(M.m.svg, S.overlay.firstChild);
      }
      S.overlay.hidden = false;
      if (o.tools) o.tools.hidden = false;
      return M.m;
    };
    M.close = function () {
      var a = document.activeElement; // a focused Hide button would keep Space and Enter from the player's keys
      if (o.tools && a && o.tools.contains(a) && a.blur) a.blur();
      S.overlay.hidden = true;
      if (o.tools) o.tools.hidden = true;
    };
    M.shown = function () { return !S.overlay.hidden; };
    M.reset = function () { if (M.m && M.m.svg.parentNode) M.m.svg.parentNode.removeChild(M.m.svg); M.m = null; M.close(); };
    // The steps of show me: the start, each leg and turn (the heading needle turns with you), the end,
    // the way back; then (Reckon) your answer; then the map turns so you face up and the angle is read off.
    M.steps = function (item, x) {
      x = x || {};
      var n = item.legs.length, beta = [0], out = [], i, key = keyOf(item), sd = side(key), reach = x.yours && x.yours.r > 0.3 ? x.yours.r : 0;
      for (i = 0; i < item.turns.length; i++) beta.push(beta[i] + item.turns[i]);
      var last = beta[n - 1], turnBack = Math.abs(norm180(item.heading - item.startHeading));
      function frame(sc) { return function () { var m = M.open(item, reach); D.key(null); D.wedge(null); mapScene(m, sc); }; }
      function plus(a, b) { var r = {}, k; for (k in a) r[k] = a[k]; for (k in b) r[k] = b[k]; return r; }
      out.push({ ms: 1400, caption: kc('mapIntro'), enter: frame({ you: { at: 0, b: 0 } }) });
      for (i = 0; i < n; i++) (function (i) {
        out.push({ ms: Math.round(500 + 45 * item.legs[i]), caption: kc(i ? 'mapLegThen' : 'mapLeg', { m: Math.round(item.legs[i]) }),
          enter: frame({ legs: i, arcs: i, part: { i: i, k: 0 }, you: { at: i, k: 0, b: beta[i] } }),
          update: function (k) { mapScene(M.m, { legs: i, arcs: i, part: { i: i, k: k }, you: { at: i, k: k, b: beta[i] } }); } });
        if (i < item.turns.length) {
          var t = item.turns[i];
          out.push({ ms: Math.round(500 + 450 * Math.abs(t) / 180), caption: kc('mapTurn', { deg: Math.round(Math.abs(t)), dir: t > 0 ? 'right' : 'left' }),
            enter: frame({ legs: i + 1, arcs: i, you: { at: i + 1, b: beta[i] } }),
            update: function (k) { mapScene(M.m, { legs: i + 1, arcs: i, you: { at: i + 1, b: beta[i] + t * ease(k) } }); },
            exit: function () { mapScene(M.m, { legs: i + 1, arcs: i + 1, you: { at: i + 1, b: beta[i + 1] } }); } });
        }
      })(i);
      var done = { legs: n, arcs: n - 1, you: { at: n, b: last } };
      out.push({ ms: 1300, caption: kc('mapEnd'), enter: frame(done) });
      out.push({ ms: 1500, caption: kc('mapBack', { dist: Math.round(item.distance) }), enter: frame(plus(done, { back: true })) });
      if (x.yours && isNum(x.yours.deg)) {
        var ys = side(x.yours.deg), yo = { deg: x.yours.deg, r: x.yours.r };
        out.push({ ms: 2200, caption: kc('mapYours', { deg: ys.deg, side: kc(ys.side) || ys.side }), enter: frame(plus(done, { back: true, yours: plus(yo, { k: 0 }) })),
          update: function (k) { mapScene(M.m, plus(done, { back: true, yours: plus(yo, { k: ease(k) }) })); } });
        if (x.yours.r > 0.3) out.push({ ms: 2000, caption: kc('mapYoursWalk', { r: Math.round(x.yours.r * 10) / 10, ep: Math.round(x.yours.ep * 10) / 10 }), enter: frame(plus(done, { back: true, yours: yo })) });
      }
      var keep = x.yours && isNum(x.yours.deg) ? { deg: x.yours.deg, r: x.yours.r } : null;
      out.push({ ms: Math.round(900 + 1300 * turnBack / 180), caption: kc('mapRotate'), enter: frame(plus(done, { back: true, yours: keep })),
        update: function (k) { setMapTurn(M.m, ease(k)); } });
      out.push({ ms: 1800, caption: kc('mapAngle', { deg: sd.deg, side: kc(sd.side) || sd.side }),
        enter: frame(plus(done, { back: true, turn: 1, angle: true, yours: keep })),
        update: function (k) { D.key(sweep(key, ease(k))); },
        exit: function () { if (isNum(x.tol)) D.wedge(key, x.tol); } });
      return out;
    };
    return M;
  }

  /* =====================================================================================
     The shared DOM, the step runner, input bookkeeping
     ===================================================================================== */

  // The view on top (phones) or left (wide screens) with captions as subtitles over it; the turn row
  // (◀5° ◀1° circle 1°▶ 5°▶), the readout, the actions, the hints, the verdict and notes.
  function layout(ctx, o) {
    var kc = o.cap, el = {};
    el.root = h('div.ex-fp.ex-' + o.id + '-stem');
    el.stage = h('div.ex-stage.ex-fp-stage.ex-' + o.id + '-stage');
    el.stage.appendChild(h('span.ex-label', kc('experimental') || 'Experimental'));
    el.hide = PX.ui.button(kc('hideMap') || 'Hide the map', { small: true, className: 'ex-fp-hide' });
    el.tools = h('div.ex-fp-maptools', { hidden: true }, el.hide);
    el.phase = h('p.ex-fp-phase', { 'aria-live': 'polite' });
    el.voidNote = h('p.ex-fp-void', { hidden: true, role: 'status' });
    el.dialbox = h('div.ex-fp-dialbox');
    el.turnrow = h('div.ex-fp-turnrow');
    el.readout = h('p.ex-fp-readout', { 'aria-hidden': 'true' });
    el.actions = h('div.ex-fp-actions');
    el.hint = h('p.ex-fp-hint', h('span.ex-fp-touch', kc('hintTouch')), ' ', h('span.ex-fp-keys', o.keysText || ''));
    el.verdict = h('div.ex-verdict.ex-fp-verdict', { hidden: true, role: 'status' });
    el.notes = h('div.ex-fp-notes', { hidden: true });
    el.desc = h('p.px-sr');
    // The phase line heads the controls (under the view on phones upright, beside it on their side and on
    // wide screens), so the view's column holds only the view (landscape: its full height).
    el.root.appendChild(h('div.ex-fp-body',
      h('div.ex-fp-viewcol', el.stage, el.tools),
      h('div.ex-fp-side', el.phase, el.voidNote, el.turnrow, el.readout, el.actions, el.hint, el.verdict, el.notes)));
    el.root.appendChild(el.desc);
    if (ctx.settings && ctx.settings.keyHints === false) el.root.classList.add('no-keyhints');
    ctx.host.appendChild(el.root);
    return el;
  }
  // The four fine buttons round the circle in the turn row.
  function turnRow(el, F) { [F.l5, F.l1, el.dialbox, F.r1, F.r5].forEach(function (x) { el.turnrow.appendChild(x); }); }

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
        var s = list[i], k = Math.min(1, Math.max(0, (now - start) / Math.max(1, s.ms * scale)));
        if (s.update) s.update(k);
        if (k >= 1) { if (s.exit) s.exit(); if (!begin(now)) return false; }
        return true;
      });
    });
  }
  // Show me and the demo through the player's runner; captions go to the subtitle over the view.
  function play(S, list, ctx, opts) {
    var o = opts || {};
    o.caption = function (text) { S.sub.textContent = text || ''; };
    if (ctx && typeof ctx.play === 'function') return ctx.play(list, o);
    return runSteps(list, ctx, o);
  }
  // 'touch' | 'mouse' | 'pen' from a pointer event, 'key' from a key event (the trial log's input column).
  function inputOf(e) {
    if (!e) return null;
    if (e.pointerType) return e.pointerType === 'touch' || e.pointerType === 'pen' ? e.pointerType : 'mouse';
    if (e.type && e.type.indexOf('key') === 0) return 'key';
    if (e.detail === 0) return 'key';
    return null;
  }

  // On phones the "how to turn" line sits over the view as a subtitle until the first input (no layout
  // height in the answer area); wider screens keep it under the controls.
  function narrow() { try { return !!(window.matchMedia && window.matchMedia('(max-width: 42rem), (pointer: coarse)').matches); } catch (e) { return false; } }
  function hintOn(S, text) { if (narrow() && text) { S.sub.textContent = text; S.subHint = true; } }
  function hintOff(S) { if (S.subHint) { S.sub.textContent = ''; S.subHint = false; } }

  var kit = {
    hintOn: hintOn, hintOff: hintOff, narrow: narrow,
    stage: stage, dial: dial, fine: fine, drag: drag, walker: walker, mapper: mapper, layout: layout, turnRow: turnRow,
    play: play, runSteps: runSteps, inputOf: inputOf, hostPaused: hostPaused, capFor: capFor, sideText: sideText, side: side,
    norm360: norm360, norm180: norm180, adiff: adiff, ease: ease, sweep: sweep, keyOf: keyOf,
    FREEZE_MS: FREEZE_MS, SLOW_SHARE: SLOW_SHARE, SLOW_GAP: SLOW_GAP, DRAG_DEG: DRAG_DEG, TILE: TILE, MIN_PX: MIN_PX, DOT_R: DOT_R,
  };

  /* =====================================================================================
     Homing's view
     ===================================================================================== */

  var EYE = 1.6, PITCH = -7, HFOV = 74, START_R = 4;
  var GROUND = { kind: 'blobs', density: 0.35, size: [0.3, 0.9] }; // as Reckon's textured level
  var cap = capFor('homing');
  var st = null;

  function leadSec() { return (genLib().LEAD_MS || 1000) / 1000; }
  function planOf(item) { return genLib().plan(item, leadSec()); }
  function endPose(item) { var E = item.path[item.path.length - 1]; return { x: E[0], y: E[1], h: item.heading }; }
  function live() { return !!(st && st.live && !st.playing); }

  function mount(ctx) {
    var el = layout(ctx, { id: 'homing', cap: cap, keysText: cap('hintKeys') });
    st = { ctx: ctx, el: el, item: null, value: null, raw: 0, live: false, playing: false, done: false, walking: false, paused: false, hostPause: false,
      voided: null, voidStats: null, frames: null, respond: null, popKeys: null, W: null, input: null, mode: null };
    st.S = stage(ctx, el.stage, { cap: cap, hfov: HFOV, pitch: PITCH, eye: EYE, fog: [18, 190] });
    st.D = dial({ cap: cap, onAngle: function (a, e) { setValue(a, 'dial', e); } });
    el.dialbox.appendChild(st.D.svg);
    st.F = fine({ cap: cap, onTurn: function (d, e) { turnBy(d, 'fine', e); } });
    turnRow(el, st.F);
    st.M = mapper(st.S, st.D, { cap: cap, landmarks: true, tools: el.tools });
    el.hide.addEventListener('click', function () { st.M.close(); });
    st.confirm = PX.ui.button(cap('confirm') || 'Confirm', { kind: 'primary', key: 'Enter', className: 'ex-fp-confirm', disabled: true, onClick: function (e) { st.input = inputOf(e) || st.input; confirm(); } });
    el.actions.appendChild(st.confirm);
    drag(el.stage, { enabled: live, onTurn: function (d, e) { turnBy(d, 'drag', e, true); } });
  }

  function landmark(kind) {
    var g = new T.Group(), m = st.S.mats.land;
    function add(geo, y) { var part = new T.Mesh(geo, m); part.position.y = y; g.add(part); return part; }
    if (kind === 'peak') add(new T.ConeGeometry(110, 75, 6), 37.5);
    else if (kind === 'mast') { add(new T.CylinderGeometry(1.6, 2.6, 82, 8), 41); add(new T.SphereGeometry(4.5, 12, 8), 84); }
    else if (kind === 'mill') {
      add(new T.CylinderGeometry(5, 8.5, 34, 10), 17);
      for (var i = 0; i < 4; i++) { var b = add(new T.BoxGeometry(2.6, 25, 1.2), 34); b.position.z = 7; b.rotation.z = i * Math.PI / 2 + Math.PI / 4; b.translateY(12.5); }
    } else if (kind === 'spire') { add(new T.CylinderGeometry(11, 11, 22, 8), 11); add(new T.ConeGeometry(9, 70, 8), 57); }
    else { add(new T.CylinderGeometry(30, 30, 12, 24), 6); add(new T.SphereGeometry(30, 24, 10, 0, 2 * Math.PI, 0, Math.PI / 2), 12); }
    return g;
  }
  function buildWorld(item) {
    var S = st.S;
    (st.lands || []).forEach(function (g) { S.world.remove(g); g.traverse(function (q) { if (q.geometry) q.geometry.dispose(); }); });
    st.lands = (item.landmarks || []).map(function (Lm) {
      var g = landmark(Lm.id);
      g.position.set(Lm.x, 0, -Lm.y);
      g.lookAt(0, g.position.y, 0); // blades and faces turn towards the walking area
      S.world.add(g);
      return g;
    });
    S.setPose(item.path[0][0], item.path[0][1], item.startHeading);
    S.setStart(item.path[0][0], item.path[0][1], START_R);
    S.setGround({ kind: GROUND.kind, density: GROUND.density, size: GROUND.size, seed: PX.rng.hash('homing-ground', item.seed || 0, item.startHeading) >>> 0 });
  }

  function describe(item) {
    return cap('describe', { legs: item.legs.length, landmarks: item.landmarks && item.landmarks.length ? cap('withLandmarks') : '' });
  }

  function voidTrial(reason, stats) {
    if (!st || st.voided) return;
    st.voided = reason;
    st.voidStats = stats || null;
    if (PX.bus) PX.bus.emit('trial:void', { ex: 'homing', seed: st.item && st.item.seed, reason: reason, stats: stats || null });
    if (st.ctx && typeof st.ctx.voidTrial === 'function') {
      try { st.ctx.voidTrial(reason, stats || null); } catch (e) { if (window.console) console.error('homing: ctx.voidTrial failed', e); }
    }
    st.el.voidNote.textContent = cap(reason === 'paused' ? 'voidPaused' : reason === 'turned' ? 'voidTurned' : 'voidStutter');
    st.el.voidNote.hidden = false;
  }
  function togglePause() {
    if (!st || !st.walking) return false;
    st.paused = !st.paused;
    st.S.pauseNote.textContent = cap('paused');
    st.S.pauseNote.hidden = !st.paused;
    return undefined;
  }

  // Draws the start, plays the route and resolves with the paint timestamp of the first answer frame.
  function present(item, ctx) {
    if (!st) mount(ctx);
    stopInput();
    if (st.W) { st.W.stop(); st.W = null; }
    st.S.stopLook();
    st.item = item; st.value = null; st.raw = 0; st.done = false; st.playing = false; st.respond = null; st.voided = null; st.voidStats = null;
    st.paused = false; st.hostPause = false; st.frames = null; st.input = null; st.mode = null;
    var S = st.S, el = st.el;
    S.attach();
    buildWorld(item);
    st.M.reset();
    st.D.set(null); st.D.key(null); st.D.wedge(null); st.D.mark('');
    el.root.classList.remove('is-revealed', 'is-answering');
    el.root.classList.add('is-watching');
    el.readout.textContent = cap('readoutWatch');
    st.confirm.hidden = false;
    st.confirm.disabled = true;
    st.F.disable(true);
    el.verdict.hidden = true; el.notes.hidden = true; el.voidNote.hidden = true;
    S.pauseNote.hidden = true;
    S.sub.textContent = '';
    el.phase.textContent = cap('phaseWatch');
    el.desc.textContent = describe(item);
    S.showRing(true);
    S.render();
    var popWalkKeys = ctx.keys.push({
      Escape: function () { return togglePause(); },
      Space: function () { return st && st.paused ? togglePause() : false; },
    }, { through: true });
    st.walking = true;
    var ringOn = true, S0 = item.path[0];
    return timing.nextPaint().then(function () {
      if (!st || st.item !== item) { popWalkKeys(); return timing.now(); }
      st.W = walker(S, planOf(item), {
        ctx: ctx, fast: ctx.fast,
        paused: function () { return !!(st && (st.paused || st.hostPause || hostPaused(ctx))); },
        onFrame: function (pose) { if (ringOn && Math.hypot(pose.x - S0[0], pose.y - S0[1]) > START_R + 0.3) { ringOn = false; S.showRing(false); } },
        onVoid: function (reason, stats) { voidTrial(reason, stats); },
      });
      return st.W.done.then(function (stats) {
        popWalkKeys();
        if (!st || st.item !== item) return timing.now();
        st.frames = stats;
        st.walking = false; st.paused = false;
        S.pauseNote.hidden = true;
        try { ctx.stage3d.noteTrial(!!stats.stutter); } catch (e) { /* quality bookkeeping is optional */ }
        var E = endPose(item);
        S.setPose(E.x, E.y, E.h);
        S.showRing(false);
        S.render();
        el.root.classList.remove('is-watching');
        el.phase.textContent = cap('phaseTurn');
        el.readout.textContent = cap('readoutNone');
        return timing.nextPaint();
      });
    });
  }

  /* ---------- input: drag the view, the circle, the fine buttons, keys; the view turns with the answer ---------- */

  // mode: 'drag' (the view follows at once), 'dial', 'fine' or 'keys' (the view eases to it in 160 ms).
  function setValue(v, mode, e, exact) {
    if (!live()) return;
    hintOff(st.S);
    st.raw = exact ? v : Math.round(v);
    st.value = norm360(Math.round(st.raw));
    var t = sideText(cap, st.value);
    st.D.set(st.value, t);
    st.el.readout.textContent = cap('readout', { dir: t }) || t;
    st.confirm.disabled = false;
    st.mode = mode;
    st.input = inputOf(e) || (mode === 'keys' ? 'key' : st.input);
    if (mode === 'drag') { st.S.stopLook(); st.S.setPose(st.S.pose.x, st.S.pose.y, st.item.heading + st.raw); st.S.render(); }
    else st.S.lookTo(st.item.heading + st.value, 160);
  }
  function turnBy(d, mode, e, exact) {
    if (!live()) return false;
    setValue((st.value === null ? 0 : exact ? st.raw : st.value) + d, mode, e, exact);
    return undefined;
  }
  function confirm() {
    if (!live() || st.value === null || !st.respond) return;
    st.respond(st.value, answerMeta());
  }
  // What an answer carries (Track's way): the walk's frame statistics and the view's own verdict, so the
  // player keeps this view's rule instead of its generic one; the input and the answer mode.
  function answerMeta() { return st ? { frames: st.frames || null, void: st.voided || null, input: st.input || null, mode: st.mode || null } : null; }
  function stopInput() {
    if (!st) return;
    st.live = false;
    st.D.live = false;
    st.F.disable(true);
    hintOff(st.S);
    st.el.root.classList.remove('is-answering');
    if (st.popKeys) { st.popKeys(); st.popKeys = null; }
  }

  function collect(item, ctx, respond) {
    if (!st || st.item !== item) return;
    st.respond = respond;
    st.live = true;
    st.D.live = true;
    st.F.disable(false);
    st.el.root.classList.add('is-answering');
    if (st.value === null) hintOn(st.S, cap('hintTouch'));
    if (st.popKeys) st.popKeys();
    st.popKeys = ctx.keys.push({
      ArrowLeft: function (e) { return turnBy(e && e.shiftKey ? -1 : -5, 'keys', e); },
      ArrowRight: function (e) { return turnBy(e && e.shiftKey ? 1 : 5, 'keys', e); },
      Enter: function (e) {
        if (!live()) return false;
        if (st.value === null) { st.el.readout.textContent = cap('setFirst'); return undefined; }
        st.input = 'key';
        confirm();
        return undefined;
      },
      repeat: ['ArrowLeft', 'ArrowRight'],
    }, { through: true });
  }

  function hintFor(item, resp, result) {
    if (!isNum(resp) || !result || result.correct) return '';
    var tol = item.tolerance, sum = item.turns.reduce(function (a, b) { return a + b; }, 0);
    if (adiff(resp, 180 - sum) <= tol && adiff(item.key, 180 - sum) > tol) return cap('hintReversed');
    if (adiff(resp, 180) <= tol && adiff(item.key, 180) > tol) return cap('hintAround');
    if (adiff(resp, 360 - item.key) <= tol) return cap('hintSides');
    return '';
  }

  // The start flag appears and the view turns to it (≤ 600 ms); the circle shows the truth.
  function reveal(item, response, result) {
    if (!st || st.item !== item) return Promise.resolve();
    stopInput();
    st.done = true;
    var resp = isNum(response) ? norm360(response) : null, res = result || { correct: false };
    var ok = !!res.correct, err = isNum(res.value) ? Math.round(res.value) : null, s = side(item.key), el = st.el;
    el.root.classList.add('is-revealed');
    st.D.mark(ok ? 'is-right' : 'is-wrong');
    st.D.set(resp, resp === null ? '' : sideText(cap, resp));
    st.D.key(item.key);
    st.D.wedge(item.key, item.tolerance);
    st.S.showFlag(true);
    st.confirm.hidden = true;
    el.phase.textContent = cap('phaseReveal');
    el.verdict.hidden = false;
    el.verdict.setAttribute('data-kind', ok ? 'right' : 'wrong');
    el.verdict.textContent = (ok ? '✓ ' : '✗ ') + (err === null ? cap('noAnswer') : cap(ok ? 'verdictRight' : 'verdictWrong', { err: err, tol: item.tolerance }));
    var lines = [cap('answerWas', { deg: s.deg, side: s.side, dist: Math.round(item.distance) }), cap('legend', { tol: item.tolerance })];
    var hint = hintFor(item, resp, res);
    if (hint) lines.push(hint);
    PX.ui.clear(el.notes).appendChild(h('p.ex-fp-note', lines.join(' ')));
    el.notes.hidden = false;
    el.readout.textContent = resp !== null ? cap('readoutYours', { dir: sideText(cap, resp) }) : '';
    return st.S.lookTo(item.heading + item.key, 600);
  }

  function showMe(item, response, ctx) {
    if (!st || st.item !== item) return Promise.resolve();
    return play(st.S, st.M.steps(item, { tol: item.tolerance }), ctx, { name: 'show-me' });
  }

  // Tutorial: the route again with captions, the same map explanation, then the turn to the start.
  // Keys and the pointer rest while it plays; afterwards the item is back in its answer state.
  function demo(item, ctx) {
    if (!st || st.item !== item) return Promise.resolve();
    var pl = planOf(item), E = endPose(item), s = side(item.key), S = st.S, L = genLib(), S0 = item.path[0];
    st.playing = true;
    function at(p, flag) {
      st.M.close(); st.D.key(null); st.D.wedge(null); S.showFlag(!!flag);
      S.setPose(p.x, p.y, p.h);
      S.showRing(Math.hypot(p.x - S0[0], p.y - S0[1]) < START_R + 0.3 && !flag);
      S.render();
    }
    var watch = [
      { ms: 2200, caption: cap('demoStart'), enter: function () { st.D.set(null); at(L.poseAt(pl, 0)); } },
      { ms: Math.round(pl.total * 1000), caption: cap('demoWalk'), enter: function () { at(L.poseAt(pl, 0)); },
        update: function (k) { var p = L.poseAt(pl, k * pl.total); at(p); } },
      { ms: 2000, caption: cap('demoEnd'), enter: function () { at(E); } },
    ];
    var answer = [
      { ms: 2600, caption: cap('demoTurn', { deg: s.deg, side: s.side }), enter: function () { at(E); st.D.set(0); },
        update: function (k) { var a = sweep(item.key, ease(k)); st.D.set(a); S.setPose(E.x, E.y, item.heading + a); S.render(); },
        exit: function () { S.showFlag(true); S.render(); } },
      { ms: 2400, caption: cap('demoAnswer'), enter: function () { at({ x: E.x, y: E.y, h: item.heading + item.key }, true); st.D.set(item.key); } },
    ];
    return play(S, watch.concat(st.M.steps(item, { tol: item.tolerance }), answer), ctx, { name: 'demo' }).then(function () {
      if (!st) return;
      st.playing = false;
      S.sub.textContent = '';
      if (st.item === item && !st.done) {
        st.value = null;
        at(E);
        st.D.set(null);
        st.el.readout.textContent = cap('readoutNone');
        st.confirm.disabled = true;
      }
    });
  }

  function unmount() {
    if (!st) return;
    stopInput();
    if (st.W) st.W.stop();
    st.S.dispose();
    if (st.el.root.parentNode) st.el.root.parentNode.removeChild(st.el.root);
    st = null;
  }

  PX.ex.view('homing', {
    layout: 'custom',
    needs: 'webgl',
    css: true,
    mount: mount,
    present: present,
    collect: collect,
    reveal: reveal,
    showMe: showMe,
    demo: demo,
    unmount: unmount,
    // the player's pause sheet during the walk (also detected through the inert host)
    pause: function () { if (st && st.walking) st.hostPause = true; },
    resume: function () { if (st) st.hostPause = false; },
    // for tests: the dial geometry, the walk model and the camera pose
    dial: { radius: DIAL_R, box: DIAL_BOX, hub: HUB },
    timeline: planOf,
    poseAt: function (pl, t) { return genLib().poseAt(pl, t); },
    mapSteps: function (item) { return st && st.item === item ? st.M.steps(item, { tol: item.tolerance }) : []; },
    pose: function () { return st && st.S ? { x: st.S.pose.x, y: st.S.pose.y, h: st.S.pose.h } : null; },
    state: function () {
      return st ? { walking: st.walking, paused: st.paused, hostPause: st.hostPause, voided: st.voided, voidStats: st.voidStats, live: st.live,
        flag: !!(st.S.flag && st.S.flag.visible), ring: !!(st.S.ring && st.S.ring.visible), map: st.M.shown(), frames: st.frames, input: st.input, mode: st.mode,
        fade: [st.S.fadeU.value.x, st.S.fadeU.value.y], ground: st.S.spec ? st.S.spec.kind : null } : null;
    },
    trialInfo: function () { return st ? { input: st.input, mode: st.mode, void: st.voided, frames: st.frames } : null; },
    sideText: function (a) { return sideText(cap, a); },
    answerMeta: answerMeta,
    kit: kit,
  });
})(window.PX);
