/* EX-11 Homing (experimental): view (3D through PX.core.stage3d; ARCHITECTURE.md §4, §6,
   docs/dev/EXERCISE-GUIDE.md). layout 'custom', needs 'webgl'.
   - present: first person at eye height on a plain. The ground carries scattered marks for optic flow,
     not a grid (grid lines would give a compass modulo 90° and undo the landmark-free levels); distant
     landmarks stand on the horizon as the item's level says. You stand in the start ring for LEAD_MS,
     then the route plays at the item's speed and turn rate (motion integrated from rAF dt, never wall
     time; fast: 2 % of the time). present resolves with the paint timestamp of the first frame of the
     answer phase, so the answer clock starts when the walk has ended.
   - collect: the arrow circle (pointer drag or tap, ← → 5°, Shift 1°, Enter or Confirm); the view
     turns with the arrow. The response is degrees clockwise from the final heading (0–359).
   - reveal: the start flag appears and the view turns to face it; the circle shows the way back, the
     tolerance and the error.
   - show me: the route from above, leg by leg, the way back, then the map turned so that the final
     heading is up and the angle read off (path, heading and key from the item: the grading model).
   - Small screens get a notice, not a block: the task is easier to judge on a larger screen. */
(function (PX) {
  'use strict';

  var S = PX.core.svg, timing = PX.core.timing, h = PX.ui.h;
  var EYE = 1.6, PITCH = -7, HFOV = 74, VFOV_MAX = 80;  // metres, degrees (the horizontal field is fixed)
  var START_R = 4;                                       // the start ring (m): visible from inside it
  var MARKS_R = 75, MARKS_DENSITY = 0.32;                // ground marks round the route (per m²)
  var FREEZE_MS = 400, SLOW_SHARE = 0.25;                // void rule for the route (see present)
  var DIAL_R = 46, DIAL_BOX = 66, HUB = 7;
  var T = window.THREE || null;
  var st = null;

  function learn() { return PX.ex.learn('homing') || {}; }
  function lib() { var d = PX.ex.get('homing'); return (d && d.lib) || {}; }
  function leadMs() { return lib().LEAD_MS || 1000; }
  function cap(key, vars) {
    var s = String((learn().captions || {})[key] || '');
    for (var k in vars || {}) if (Object.prototype.hasOwnProperty.call(vars, k)) s = s.split('{' + k + '}').join(vars[k]);
    return s;
  }
  function isNum(v) { return typeof v === 'number' && isFinite(v); }
  function rad(d) { return d * Math.PI / 180; }
  function f2(v) { return (Math.round(v * 100) / 100).toString(); }
  function norm360(a) { a %= 360; return a < 0 ? a + 360 : a; }
  function norm180(a) { a = norm360(a); return a > 180 ? a - 360 : a; }
  function adiff(a, b) { return Math.abs(norm180(a - b)); }
  function ease(k) { return k * k * (3 - 2 * k); }
  function polar(x, y, b, r) { return [x + r * Math.sin(rad(b)), y - r * Math.cos(rad(b))]; }
  function side(a) { a = norm360(Math.round(a)); return a <= 180 ? { deg: a, side: 'right' } : { deg: 360 - a, side: 'left' }; }
  function sideText(a) {
    a = norm360(Math.round(a));
    if (a === 0) return cap('ahead') || 'straight ahead';
    if (a === 180) return cap('behind') || 'straight behind';
    var s = side(a);
    return s.deg + '° ' + s.side;
  }
  function smallScreen() {
    var s = window.screen, w = s && s.width ? Math.min(s.width, s.height) : Math.min(window.innerWidth || 1024, window.innerHeight || 768);
    return w < 600;
  }

  /* ---------- the 3D scene ---------- */

  function lum(c) { return 0.2126 * c.r + 0.7152 * c.g + 0.0722 * c.b; }
  function palette() {
    var c = st.ctx.stage3d.colors(), dark = lum(c.ground) < 0.35, sky = c.ground.clone();
    var plain = sky.clone().lerp(c.face2, dark ? 0.24 : 0.42);
    return {
      sky: sky, plain: plain,
      marks: plain.clone().lerp(dark ? c.edge : c.face3, dark ? 0.6 : 0.75),
      land: dark ? c.face3.clone().lerp(sky, 0.2) : c.edge.clone().lerp(sky, 0.4),
      target: c.target.clone(),
    };
  }
  function makeMaterials() {
    var p = palette();
    return {
      plain: new T.MeshBasicMaterial({ color: p.plain, polygonOffset: true, polygonOffsetFactor: 2, polygonOffsetUnits: 2 }),
      marks: new T.MeshBasicMaterial({ color: p.marks, side: T.DoubleSide }),
      land: new T.MeshBasicMaterial({ color: p.land, fog: false }),
      start: new T.MeshBasicMaterial({ color: p.target, side: T.DoubleSide }),
    };
  }
  function recolour() {
    if (!st || !st.mats) return;
    var p = palette();
    st.mats.plain.color.copy(p.plain);
    st.mats.marks.color.copy(p.marks);
    st.mats.land.color.copy(p.land);
    st.mats.start.color.copy(p.target);
    st.scene.background = p.sky;
    st.scene.fog.color.copy(p.sky);
  }
  function shared(geo) { geo.userData.shared = true; return geo; }
  // Frees per-item geometry; materials and shared geometry stay (they belong to the view).
  function freeTree(obj) {
    obj.traverse(function (o) { if (o.geometry && !(o.geometry.userData && o.geometry.userData.shared)) o.geometry.dispose(); });
    if (obj.parent) obj.parent.remove(obj);
  }

  // Distant landmarks: different silhouettes, flat tone, no fog (they stand on the horizon).
  function landmark(kind) {
    var g = new T.Group(), m = st.mats.land, part;
    function add(geo, y) { part = new T.Mesh(shared(geo), m); part.position.y = y; g.add(part); return part; }
    if (kind === 'peak') add(new T.ConeGeometry(110, 75, 6), 37.5);
    else if (kind === 'mast') { add(new T.CylinderGeometry(1.6, 2.6, 82, 8), 41); add(new T.SphereGeometry(4.5, 12, 8), 84); }
    else if (kind === 'mill') {
      add(new T.CylinderGeometry(5, 8.5, 34, 10), 17);
      for (var i = 0; i < 4; i++) { var b = add(new T.BoxGeometry(2.6, 25, 1.2), 34); b.position.z = 7; b.rotation.z = i * Math.PI / 2 + Math.PI / 4; b.translateY(12.5); }
    } else if (kind === 'spire') { add(new T.CylinderGeometry(11, 11, 22, 8), 11); add(new T.ConeGeometry(9, 70, 8), 57); }
    else { add(new T.CylinderGeometry(30, 30, 12, 24), 6); add(new T.SphereGeometry(30, 24, 10, 0, 2 * Math.PI, 0, Math.PI / 2), 12); }
    return g;
  }

  // Ground marks: small irregular pebbles (pentagons of 3 triangles) at random places and turns: no
  // lines, no lattice, so they give motion but no direction. Fixed by the item.
  function groundMarks(item) {
    var P = item.path, cx = 0, cy = 0;
    P.forEach(function (p) { cx += p[0] / P.length; cy += p[1] / P.length; });
    var r = PX.rng((Math.round(item.key * 1000) ^ Math.round(item.startHeading * 977) ^ (item.legs.length << 20)) >>> 0);
    var n = Math.round(MARKS_DENSITY * Math.PI * MARKS_R * MARKS_R), pos = new Float32Array(n * 27), o = 0, ring = [];
    for (var i = 0; i < n; i++) {
      var a = r.float(0, 2 * Math.PI), d = MARKS_R * Math.sqrt(r.next()), x = cx + d * Math.cos(a), y = cy + d * Math.sin(a);
      var s = r.float(0.1, 0.24), rot = r.float(0, 2 * Math.PI), k;
      for (k = 0; k < 5; k++) {
        var q = rot + k * 2 * Math.PI / 5 + r.float(-0.25, 0.25), rr = s * r.float(0.75, 1.2);
        ring[k] = [x + rr * Math.cos(q), -(y + rr * Math.sin(q))];
      }
      for (k = 1; k < 4; k++) {
        [ring[0], ring[k], ring[k + 1]].forEach(function (v) { pos[o++] = v[0]; pos[o++] = 0.012; pos[o++] = v[1]; });
      }
    }
    var geo = new T.BufferGeometry();
    geo.setAttribute('position', new T.Float32BufferAttribute(pos, 3));
    return new T.Mesh(geo, st.mats.marks);
  }

  // The start: a ring on the ground (seen while you stand in it) and a flag shown at reveal.
  function startMarks(item) {
    var S0 = item.path[0], ring = new T.Mesh(new T.RingGeometry(START_R - 0.35, START_R, 48), st.mats.start);
    ring.rotation.x = -Math.PI / 2;
    ring.position.set(S0[0], 0.02, -S0[1]);
    var flag = new T.Group();
    var pole = new T.Mesh(new T.CylinderGeometry(0.07, 0.07, 3.4, 8), st.mats.start);
    pole.position.y = 1.7;
    var cloth = new T.Mesh(new T.PlaneGeometry(1.5, 0.95), st.mats.start);
    cloth.position.set(0.75, 2.9, 0);
    var foot = new T.Mesh(new T.RingGeometry(0.9, 1.2, 32), st.mats.start);
    foot.rotation.x = -Math.PI / 2;
    foot.position.y = 0.02;
    flag.add(pole, cloth, foot);
    flag.position.set(S0[0], 0, -S0[1]);
    return { ring: ring, flag: flag };
  }

  function buildWorld(item) {
    if (st.world) freeTree(st.world);
    var w = new T.Group();
    var plain = new T.Mesh(shared(st.plainGeo), st.mats.plain);
    plain.rotation.x = -Math.PI / 2;
    w.add(plain);
    w.add(groundMarks(item));
    (item.landmarks || []).forEach(function (L) {
      var g = landmark(L.id);
      g.position.set(L.x, 0, -L.y);
      g.lookAt(0, g.position.y, 0); // blades and faces turn towards the walking area
      w.add(g);
    });
    var sm = startMarks(item);
    w.add(sm.ring, sm.flag);
    st.ring = sm.ring;
    st.flag = sm.flag;
    st.flag.visible = false;
    st.scene.add(w);
    st.world = w;
  }

  function setPose(x, y, hdg) {
    st.pose = { x: x, y: y, h: hdg };
    st.cam.position.set(x, EYE, -y);
    st.cam.rotation.set(rad(PITCH), -rad(hdg), 0, 'YXZ');
  }
  function render() {
    if (!st || !st.view) return;
    var v = st.view;
    v.resize();
    var a = v.width / Math.max(1, v.height);
    var fov = Math.min(VFOV_MAX, 2 * Math.atan(Math.tan(rad(HFOV / 2)) / a) * 180 / Math.PI);
    if (st.cam.fov !== fov || st.cam.aspect !== a) { st.cam.fov = fov; st.cam.aspect = a; st.cam.updateProjectionMatrix(); }
    v.render(st.scene, st.cam);
  }

  /* ---------- the walk: stand in the ring, then legs and turns at the item's speed ---------- */

  function timeline(item) {
    var P = item.path, hd = item.startHeading, segs = [{ kind: 'stand', dur: leadMs() / 1000, x: P[0][0], y: P[0][1], h0: hd, h1: hd }];
    for (var i = 0; i < item.legs.length; i++) {
      segs.push({ kind: 'walk', dur: item.legs[i] / item.speed, x0: P[i][0], y0: P[i][1], x1: P[i + 1][0], y1: P[i + 1][1], h0: hd });
      if (i < item.turns.length) {
        segs.push({ kind: 'turn', dur: Math.abs(item.turns[i]) / item.turnRate, x: P[i + 1][0], y: P[i + 1][1], h0: hd, h1: hd + item.turns[i] });
        hd += item.turns[i];
      }
    }
    return { segs: segs, total: segs.reduce(function (s, g) { return s + g.dur; }, 0) };
  }
  // The pose t seconds into the timeline (clamped to its ends).
  function poseAt(tl, t) {
    for (var i = 0; i < tl.segs.length; i++) {
      var g = tl.segs[i];
      if (t <= g.dur || i === tl.segs.length - 1) {
        var k = Math.max(0, Math.min(1, g.dur > 0 ? t / g.dur : 1));
        if (g.kind === 'walk') return { x: g.x0 + (g.x1 - g.x0) * k, y: g.y0 + (g.y1 - g.y0) * k, h: g.h0 };
        return { x: g.x, y: g.y, h: g.h0 + (g.h1 - g.h0) * k };
      }
      t -= g.dur;
    }
    return null;
  }
  function endPose(item) { var E = item.path[item.path.length - 1]; return { x: E[0], y: E[1], h: item.heading }; }
  function showPose(item, p) {
    setPose(p.x, p.y, p.h);
    var S0 = item.path[0];
    st.ring.visible = Math.hypot(p.x - S0[0], p.y - S0[1]) < START_R + 0.5;
  }

  function walk(item) {
    var tl = timeline(item), scale = st.ctx.fast ? 0.02 : 1, t = 0;
    return new Promise(function (resolve) {
      st.walkEnd = resolve;
      st.walkStop = timing.loop(function (dt) {
        if (!st || st.item !== item) { resolve(); return false; }
        if (st.paused) return true;
        t += dt / 1000 / scale;
        showPose(item, poseAt(tl, Math.min(t, tl.total)));
        render();
        if (t >= tl.total) { st.walkStop = null; st.walkEnd = null; resolve(); return false; }
        return true;
      });
    });
  }
  function stopWalk() {
    if (st && st.walkStop) { st.walkStop(); st.walkStop = null; }
    if (st && st.walkEnd) { var r = st.walkEnd; st.walkEnd = null; r(); }
  }

  // Turns the view smoothly towards a heading (the arrow while answering, the start at reveal).
  function lookTo(hdg, ms) {
    if (!st) return Promise.resolve();
    if (st.lookStop) { st.lookStop(); st.lookStop = null; }
    var from = st.pose.h, d = norm180(hdg - from), t = 0, dur = st.ctx.fast || st.ctx.reducedMotion ? 0 : ms;
    if (!dur || Math.abs(d) < 0.05) { setPose(st.pose.x, st.pose.y, from + d); render(); return Promise.resolve(); }
    return new Promise(function (resolve) {
      st.lookStop = timing.loop(function (dt) {
        if (!st) { resolve(); return false; }
        t += dt;
        var k = Math.min(1, t / dur);
        setPose(st.pose.x, st.pose.y, from + d * ease(k));
        st.pose.h = from + d * ease(k);
        render();
        if (k >= 1) { st.lookStop = null; resolve(); return false; }
        return true;
      });
    });
  }

  /* ---------- the arrow circle (as in Orient; its top is straight ahead at the end of the route) ---------- */

  function circle(r, cls, cx, cy) { return S.el('circle', { cx: f2(cx || 0), cy: f2(cy || 0), r: f2(r), class: cls }); }
  function segment(a, b, cls) { return S.el('line', { x1: f2(a[0]), y1: f2(a[1]), x2: f2(b[0]), y2: f2(b[1]), class: cls }); }
  function poly(points, cls) { return S.el('polygon', { points: points.map(function (p) { return f2(p[0]) + ',' + f2(p[1]); }).join(' '), class: cls }); }
  function head(len, cls) { return S.el('path', { d: 'M0 ' + (-len) + 'L-3.6 ' + (-len + 7.5) + 'L3.6 ' + (-len + 7.5) + 'Z', class: cls }); }
  function arrow(cls) {
    var g = S.el('g', { class: cls, visibility: 'hidden' });
    g.appendChild(S.el('line', { x1: 0, y1: 0, x2: 0, y2: -DIAL_R + 6, class: cls + '-line' }));
    g.appendChild(head(DIAL_R - 0.5, cls + '-head'));
    return g;
  }
  function drawDial() {
    var svg = S.svg(2 * DIAL_BOX, 2 * DIAL_BOX, {
      viewBox: [-DIAL_BOX, -DIAL_BOX, 2 * DIAL_BOX, 2 * DIAL_BOX].join(' '), width: '100%', height: '100%', class: 'ex-homing-dial',
      role: 'slider', tabindex: 0, 'aria-label': cap('dialLabel') || 'Arrow circle', 'aria-valuemin': 0, 'aria-valuemax': 359,
      'aria-valuetext': cap('notSet') || 'not set',
    });
    svg.appendChild(circle(DIAL_R, 'ex-homing-face'));
    for (var b = 0; b < 360; b += 30) svg.appendChild(segment(polar(0, 0, b, DIAL_R), polar(0, 0, b, DIAL_R - (b % 90 ? 3 : 6)), 'ex-homing-tick'));
    var wedge = S.el('path', { class: 'ex-homing-wedge', visibility: 'hidden' });
    svg.appendChild(wedge);
    svg.appendChild(S.el('line', { x1: 0, y1: -HUB, x2: 0, y2: -DIAL_R + 7, class: 'ex-homing-ahead-line' }));
    svg.appendChild(S.text(0, -DIAL_R - 9.5, cap('aheadLabel') || 'ahead', { class: 'ex-homing-dial-name' }));
    // left and right upright, just outside the ring (sized in CSS to stay ≥ 12 px on screen)
    svg.appendChild(S.text(-DIAL_R - 2.5, 0, cap('left') || 'left', { class: 'ex-homing-dial-side', 'text-anchor': 'end' }));
    svg.appendChild(S.text(DIAL_R + 2.5, 0, cap('right') || 'right', { class: 'ex-homing-dial-side', 'text-anchor': 'start' }));
    var key = arrow('ex-homing-key'), yours = arrow('ex-homing-arrow');
    svg.appendChild(key);
    svg.appendChild(yours);
    svg.appendChild(circle(HUB - 0.5, 'ex-homing-hub'));
    svg.appendChild(poly([[0, -4], [3.2, 3], [-3.2, 3]], 'ex-homing-hub-you'));
    return { svg: svg, arrow: yours, key: key, wedge: wedge };
  }
  function setArrow(g, deg) {
    if (!isNum(deg)) { g.setAttribute('visibility', 'hidden'); return; }
    g.setAttribute('transform', 'rotate(' + f2(norm360(deg)) + ')');
    g.setAttribute('visibility', 'visible');
  }
  function setWedge(center, half) {
    var w = st.dial.wedge;
    if (!isNum(center)) { w.setAttribute('visibility', 'hidden'); return; }
    var a = polar(0, 0, center - half, DIAL_R - 1), b = polar(0, 0, center + half, DIAL_R - 1);
    w.setAttribute('d', 'M0 0L' + f2(a[0]) + ' ' + f2(a[1]) + 'A' + (DIAL_R - 1) + ' ' + (DIAL_R - 1) + ' 0 ' + (2 * half > 180 ? 1 : 0) + ' 1 ' + f2(b[0]) + ' ' + f2(b[1]) + 'Z');
    w.setAttribute('visibility', 'visible');
  }
  function sweep(key, k) { return key <= 180 ? key * k : 360 - (360 - key) * k; }

  /* ---------- input: pointer on the circle, keys, Confirm; the view turns with the arrow ---------- */

  function live() { return !!(st && st.live && !st.playing); }
  function setValue(v) {
    st.value = norm360(Math.round(v));
    setArrow(st.dial.arrow, st.value);
    var t = sideText(st.value);
    st.readout.textContent = cap('readout', { dir: t }) || t;
    st.dial.svg.setAttribute('aria-valuenow', String(st.value));
    st.dial.svg.setAttribute('aria-valuetext', t);
    st.confirm.disabled = false;
    lookTo(st.item.heading + st.value, 160);
  }
  function turnBy(d) {
    if (!live()) return false;
    setValue((st.value === null ? 0 : st.value) + d);
    return undefined;
  }
  function confirm() {
    if (!live() || st.value === null || !st.respond) return;
    st.respond(st.value, answerMeta());
  }
  // What an answer carries, like Track's: the walk's frame statistics and Homing's own verdict, so
  // the player keeps this view's rule (a freeze over FREEZE_MS) instead of its generic one.
  function answerMeta() { return st ? { frames: st.frames || null, void: st.voided || null } : null; }
  function angleAt(e) {
    var r = st.dial.svg.getBoundingClientRect(), s = Math.min(r.width, r.height) / (2 * DIAL_BOX);
    if (!(s > 0)) return null;
    var dx = (e.clientX - (r.left + r.width / 2)) / s, dy = (e.clientY - (r.top + r.height / 2)) / s;
    if (dx * dx + dy * dy < HUB * HUB) return null;
    return Math.atan2(dx, -dy) * 180 / Math.PI;
  }
  function bindDial() {
    var svg = st.dial.svg, drag = null;
    svg.addEventListener('pointerdown', function (e) {
      if (!live() || (e.button !== undefined && e.button > 0)) return;
      var a = angleAt(e);
      if (a === null) return;
      e.preventDefault();
      drag = e.pointerId;
      try { svg.setPointerCapture(e.pointerId); } catch (err) { /* capture is optional */ }
      setValue(a);
    });
    svg.addEventListener('pointermove', function (e) {
      if (drag === null || e.pointerId !== drag || !live()) return;
      var a = angleAt(e);
      if (a !== null) setValue(a);
    });
    function up(e) { if (e.pointerId === drag) drag = null; }
    svg.addEventListener('pointerup', up);
    svg.addEventListener('pointercancel', up);
    svg.addEventListener('lostpointercapture', up);
  }
  function stopInput() {
    if (!st) return;
    st.live = false;
    if (st.popKeys) { st.popKeys(); st.popKeys = null; }
  }

  /* ---------- show me: the route from above (start heading up), then turned so you face up ---------- */

  function routeMap(item) {
    var P = item.path, h0 = item.startHeading, s = Math.sin(rad(h0)), c = Math.cos(rad(h0));
    function mp(p) { return [p[0] * c - p[1] * s, -(p[0] * s + p[1] * c)]; }
    var pts = P.map(mp), E = pts[pts.length - 1], R = 0;
    pts.forEach(function (q) { R = Math.max(R, Math.hypot(q[0] - E[0], q[1] - E[1])); });
    // Landmarks sit on a ring outside the route (0.88 H, with H = 1.42 R + 2.5), so route labels and
    // landmark dots rarely meet; placeLabels keeps the movable labels clear of each other.
    var H = Math.max(9, R * 1.42 + 2.5), u = H / 50;
    var svg = S.svg(2 * H, 2 * H, { viewBox: [E[0] - H, E[1] - H, 2 * H, 2 * H].map(f2).join(' '), width: '100%', height: '100%', class: 'ex-homing-map', 'aria-hidden': 'true' });
    svg.appendChild(S.el('style', {}, '.ex-homing-map text{font-size:' + f2(3.6 * u) + 'px;stroke-width:' + f2(0.9 * u) + 'px}'));
    var world = S.el('g'), route = S.el('g'), marks = S.el('g'), m;
    world.appendChild(route);
    world.appendChild(marks);
    svg.appendChild(world);
    m = { item: item, svg: svg, world: world, route: route, marks: marks, pts: pts, E: E, H: H, u: u, rho: 0,
      uprights: [], fixed: [], lands: [], dots: [], labels: [], spots: [] };
    // distant landmarks on a ring round the map, in their direction from the end of the route
    var end = P[P.length - 1], edge = S.el('g', { class: 'ex-homing-maplandmarks' });
    (item.landmarks || []).forEach(function (L) {
      var b = Math.atan2(L.x - end[0], L.y - end[1]) * 180 / Math.PI - h0, q = polar(E[0], E[1], b, H * 0.88);
      edge.appendChild(circle(1.5 * u, 'ex-homing-maplandmark', q[0], q[1]));
      m.dots.push(q);
      var lab = label(m, edge, q, L.name, 'ex-homing-maplabel');
      m.fixed.push(lab);
      m.lands.push(lab);
    });
    world.insertBefore(edge, route);
    return m;
  }
  // A text that stays upright while the map turns, anchored at the world point p. w and h estimate
  // its size (map units) for placeLabels.
  function label(m, parent, p, text, cls) {
    var outer = S.el('g', { transform: 'translate(' + f2(p[0]) + ' ' + f2(p[1]) + ')' }), inner = S.el('g', {});
    var t = S.text(0, 0, text, { class: cls });
    inner.appendChild(t);
    outer.appendChild(inner);
    parent.appendChild(outer);
    inner.setAttribute('transform', m.rho ? 'rotate(' + f2(-m.rho) + ')' : '');
    return { inner: inner, text: t, p: p, w: (0.58 * String(text).length + 0.6) * 3.6 * m.u, h: 1.3 * 3.6 * m.u };
  }
  function setMapTurn(item, k) {
    var m = st.mapv;
    m.rho = -norm180(item.heading - item.startHeading) * k;
    m.world.setAttribute('transform', m.rho ? 'rotate(' + f2(m.rho) + ' ' + f2(m.E[0]) + ' ' + f2(m.E[1]) + ')' : '');
    var keep = m.rho ? 'rotate(' + f2(-m.rho) + ')' : '';
    m.uprights.forEach(function (x) { x.inner.setAttribute('transform', keep); });
    placeLabels(m);
  }
  // Every map label moves to the candidate spot that overlaps least with the labels placed before it,
  // the route's corners and the dots, and stays inside the map: first the angle and turn sizes (along
  // their arc's bisector, a little round it, or further out), then the start and the landmarks (beside
  // their dot, on screen; further off only if every near spot is taken). Run after every change, so it
  // also holds while the map turns.
  var DOT_SPOTS = [[0, 1, 'middle'], [0, -1, 'middle'], [1, 0, 'start'], [-1, 0, 'end'],
    [0.7, 0.85, 'start'], [-0.7, 0.85, 'end'], [0.7, -0.85, 'start'], [-0.7, -0.85, 'end']];
  function candidates(m, l) {
    var u = m.u, out = [];
    if (l.bis !== undefined) {
      [l.r + 3.4 * u, l.r + 6.8 * u, l.r + 10.2 * u].forEach(function (rr, ri) {
        [0, -30, 30, -60, 60].forEach(function (dl, di) {
          var q = polar(0, 0, l.bis + dl + m.rho, rr);
          out.push({ dx: q[0], dy: q[1], anchor: 'middle', pref: ri * 0.6 + di * 0.15 });
        });
      });
      return out;
    }
    [1, 1.8].forEach(function (f, fi) {
      DOT_SPOTS.forEach(function (sp, i) { out.push({ dx: sp[0] * 2.6 * u * f, dy: sp[1] * 3.6 * u * f, anchor: sp[2], pref: fi * 0.8 + i * 0.01 }); });
    });
    return out;
  }
  function placeLabels(m) {
    var c = Math.cos(rad(m.rho)), s = Math.sin(rad(m.rho)), u = m.u, E = m.E, H = m.H;
    function rot(p) { var x = p[0] - E[0], y = p[1] - E[1]; return [E[0] + x * c - y * s, E[1] + x * s + y * c]; }
    function boxC(q, w, h) { return { x0: q[0] - w / 2, x1: q[0] + w / 2, y0: q[1] - h / 2, y1: q[1] + h / 2 }; }
    function over(a, b) { var w = Math.min(a.x1, b.x1) - Math.max(a.x0, b.x0), h = Math.min(a.y1, b.y1) - Math.max(a.y0, b.y0); return w > 0 && h > 0 ? w * h : 0; }
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
        placed.forEach(function (o) { cost += 4 * over(b, o); });
        soft.forEach(function (o) { if (o.at !== l.p) cost += 2 * over(b, o); });
        if (!best || cost < best.cost) best = { cost: cost, b: b, cd: cd };
      });
      l.text.setAttribute('x', f2(best.cd.dx));
      l.text.setAttribute('y', f2(best.cd.dy));
      l.text.setAttribute('text-anchor', best.cd.anchor);
      placed.push(best.b);
    });
  }
  function pointer(m, p, b) {
    var u = m.u;
    m.marks.appendChild(poly([polar(p[0], p[1], b, 2.9 * u), polar(p[0], p[1], b + 145, 1.9 * u), polar(p[0], p[1], b - 145, 1.9 * u)], 'ex-homing-you'));
  }
  // An arc at p (a turn, or the angle back to the start) with its size as a label; placeLabels puts the
  // label on the arc's bisector, or near it when that spot is taken.
  function arcAt(m, p, b0, span, r, text, cls) {
    var a = polar(p[0], p[1], b0, r), b = polar(p[0], p[1], b0 + span, r);
    m.marks.appendChild(S.el('path', { d: 'M' + f2(a[0]) + ' ' + f2(a[1]) + 'A' + f2(r) + ' ' + f2(r) + ' 0 0 ' + (span > 0 ? 1 : 0) + ' ' + f2(b[0]) + ' ' + f2(b[1]), class: cls }));
    var l = label(m, m.marks, p, text, cls + '-label');
    l.bis = b0 + span / 2;
    l.r = r;
    m.uprights.push(l);
    m.labels.push(l);
    return l;
  }
  // o: { legs (whole legs drawn), part: { i, k }, arcs (turn arcs drawn), you: { at, k, b }, back, turn (0–1), angle }
  function mapScene(item, o) {
    var m = st.mapv, pts = m.pts, u = m.u, i;
    PX.ui.clear(m.route);
    PX.ui.clear(m.marks);
    m.uprights = m.fixed.slice();
    m.labels = [];
    m.spots = [];
    var beta = [0];
    for (i = 0; i < item.turns.length; i++) beta.push(beta[i] + item.turns[i]);
    for (i = 0; i < (o.legs || 0); i++) m.route.appendChild(segment(pts[i], pts[i + 1], 'ex-homing-leg'));
    if (o.part) {
      var a = pts[o.part.i], b = pts[o.part.i + 1];
      m.route.appendChild(segment(a, [a[0] + (b[0] - a[0]) * o.part.k, a[1] + (b[1] - a[1]) * o.part.k], 'ex-homing-leg'));
    }
    if (o.back) m.route.appendChild(segment(m.E, pts[0], 'ex-homing-back'));
    for (i = 0; i < (o.arcs || 0); i++) arcAt(m, pts[i + 1], beta[i], item.turns[i], 3.8 * u, Math.round(Math.abs(item.turns[i])) + '°', 'ex-homing-turnarc');
    m.marks.appendChild(circle(1.4 * u, 'ex-homing-startdot', pts[0][0], pts[0][1]));
    var startLabel = label(m, m.marks, pts[0], cap('mapStart') || 'start', 'ex-homing-maplabel ex-homing-maplabel--start');
    m.uprights.push(startLabel);
    m.spots.push(startLabel);
    if (o.you) {
      var at = o.you.at, p = pts[at];
      if (o.you.k && at + 1 < pts.length) p = [p[0] + (pts[at + 1][0] - p[0]) * o.you.k, p[1] + (pts[at + 1][1] - p[1]) * o.you.k];
      pointer(m, p, o.you.b);
    }
    m.angle = o.angle ? arcAt(m, m.E, beta[beta.length - 1], norm180(item.key), 6 * u, Math.round(side(item.key).deg) + '°', 'ex-homing-anglearc') : null;
    setMapTurn(item, o.turn || 0);
  }
  function openMap(item) {
    if (!st.mapv || st.mapv.item !== item) {
      st.mapv = routeMap(item);
      if (st.mapSvg) st.overlay.removeChild(st.mapSvg);
      st.mapSvg = st.mapv.svg;
      st.overlay.insertBefore(st.mapSvg, st.overlay.firstChild);
    }
    st.overlay.hidden = false;
    st.mapTools.hidden = false;
  }
  function closeMap() {
    if (!st || !st.overlay) return;
    // a focused Hide button would keep Space and Enter from the player's keys once it is hidden
    var a = document.activeElement;
    if (a && st.mapTools.contains(a) && a.blur) a.blur();
    st.overlay.hidden = true;
    st.mapTools.hidden = true;
  }

  function mapSteps(item) {
    var n = item.legs.length, beta = [0], out = [], i, s = side(item.key);
    for (i = 0; i < item.turns.length; i++) beta.push(beta[i] + item.turns[i]);
    var last = beta[n - 1], turnBack = Math.abs(norm180(item.heading - item.startHeading));
    function frame(o) { return function () { openMap(item); setArrow(st.dial.key, null); setWedge(null); mapScene(item, o); }; }
    out.push({ ms: 1400, caption: cap('mapIntro'), enter: frame({ you: { at: 0, b: 0 } }) });
    for (i = 0; i < n; i++) (function (i) {
      out.push({ ms: Math.round(500 + 45 * item.legs[i]), caption: cap(i ? 'mapLegThen' : 'mapLeg', { m: Math.round(item.legs[i]) }),
        enter: frame({ legs: i, arcs: i, part: { i: i, k: 0 }, you: { at: i, k: 0, b: beta[i] } }),
        update: function (k) { mapScene(item, { legs: i, arcs: i, part: { i: i, k: k }, you: { at: i, k: k, b: beta[i] } }); } });
      if (i < item.turns.length) {
        var t = item.turns[i];
        out.push({ ms: Math.round(500 + 450 * Math.abs(t) / 180), caption: cap('mapTurn', { deg: Math.round(Math.abs(t)), dir: t > 0 ? 'right' : 'left' }),
          enter: frame({ legs: i + 1, arcs: i, you: { at: i + 1, b: beta[i] } }),
          update: function (k) { mapScene(item, { legs: i + 1, arcs: i, you: { at: i + 1, b: beta[i] + t * ease(k) } }); },
          exit: function () { mapScene(item, { legs: i + 1, arcs: i + 1, you: { at: i + 1, b: beta[i + 1] } }); } });
      }
    })(i);
    var done = { legs: n, arcs: n - 1, you: { at: n, b: last } };
    function plus(o, extra) { var r = {}, k; for (k in o) r[k] = o[k]; for (k in extra) r[k] = extra[k]; return r; }
    out.push({ ms: 1300, caption: cap('mapEnd'), enter: frame(done) });
    out.push({ ms: 1500, caption: cap('mapBack', { dist: Math.round(item.distance) }), enter: frame(plus(done, { back: true })) });
    out.push({ ms: Math.round(900 + 1300 * turnBack / 180), caption: cap('mapRotate'), enter: frame(plus(done, { back: true })),
      update: function (k) { setMapTurn(item, ease(k)); } });
    out.push({ ms: 1800, caption: cap('mapAngle', { deg: s.deg, side: s.side }),
      enter: frame(plus(done, { back: true, turn: 1, angle: true })),
      update: function (k) { setArrow(st.dial.key, sweep(item.key, ease(k))); },
      exit: function () { setWedge(item.key, item.tolerance); } });
    return out;
  }

  /* ---------- void trials: a stutter or a pause during the route (the answer never counts) ---------- */

  function voidTrial(reason, stats) {
    if (!st || st.voided) return;
    st.voided = reason;
    st.voidStats = stats ? { frames: stats.frames, maxGapMs: Math.round(stats.maxGapMs), dropped: stats.dropped, medianMs: Math.round(stats.medianMs * 10) / 10 } : null;
    if (PX.bus) PX.bus.emit('trial:void', { ex: 'homing', seed: st.item && st.item.seed, reason: reason, stats: stats || null });
    if (st.ctx && typeof st.ctx.voidTrial === 'function') {
      try { st.ctx.voidTrial(reason, stats || null); } catch (e) { if (window.console) console.error('homing: ctx.voidTrial failed', e); }
    }
    st.voidNote.textContent = cap(reason === 'paused' ? 'voidPaused' : 'voidStutter');
    st.voidNote.hidden = false;
  }
  function togglePause() {
    if (!st || !st.walking) return false;
    st.paused = !st.paused;
    if (st.paused) voidTrial('paused');
    st.pauseNote.hidden = !st.paused;
    return undefined;
  }

  /* ---------- view functions ---------- */

  function mount(ctx) {
    var root = h('div.ex-homing-stem');
    var notice = h('p.ex-homing-notice', { hidden: !smallScreen() }, cap('smallScreen'));
    var stage = h('div.ex-stage.ex-homing-stage');
    var overlay = h('div.ex-homing-overlay', { hidden: true });
    var mapTools = h('div.ex-homing-maptools', { hidden: true },
      PX.ui.button(cap('hideMap') || 'Hide the map', { small: true, className: 'ex-homing-hide', onClick: function () { closeMap(); } }));
    var pauseNote = h('p.ex-homing-pause', { hidden: true, role: 'status' }, cap('paused'));
    stage.appendChild(h('span.ex-label', cap('experimental') || 'Experimental'));
    stage.appendChild(overlay);
    stage.appendChild(pauseNote);
    var phase = h('p.ex-homing-phase', { 'aria-live': 'polite' });
    var voidNote = h('p.ex-homing-void', { hidden: true, role: 'status' });
    var dialbox = h('div.ex-homing-dialbox'), readout = h('p.ex-homing-readout', { 'aria-hidden': 'true' });
    var confirmBtn = PX.ui.button(cap('confirm') || 'Confirm', { kind: 'primary', key: 'Enter', className: 'ex-homing-confirm', disabled: true, onClick: function () { confirm(); } });
    var hint = h('p.ex-homing-hint', h('span.ex-homing-touch', cap('hintPointer')), ' ', h('span.ex-homing-keys', cap('hintKeys')));
    var verdict = h('div.ex-verdict.ex-homing-verdict', { hidden: true, role: 'status' }), note = h('p.ex-homing-note', { hidden: true });
    var caption = h('p.ex-caption', { 'aria-live': 'polite' }), desc = h('p.px-sr');
    root.appendChild(notice);
    root.appendChild(h('div.ex-homing-body', h('div.ex-homing-view', stage, mapTools, phase, voidNote),
      h('div.ex-homing-side', dialbox, h('div.ex-homing-ctl', readout, confirmBtn, hint, verdict), note)));
    root.appendChild(caption);
    root.appendChild(desc);
    if (ctx.settings && ctx.settings.keyHints === false) root.classList.add('no-keyhints');
    ctx.host.appendChild(root);
    st = { ctx: ctx, root: root, stage: stage, overlay: overlay, mapTools: mapTools, pauseNote: pauseNote, phase: phase, voidNote: voidNote, dialbox: dialbox,
      readout: readout, confirm: confirmBtn, verdict: verdict, note: note, caption: caption, desc: desc,
      item: null, value: null, response: null, result: null, live: false, playing: false, done: false, walking: false, paused: false,
      voided: null, respond: null, popKeys: null, walkStop: null, walkEnd: null, lookStop: null, mapv: null, mapSvg: null, world: null };
    st.mats = makeMaterials();
    var p = palette();
    st.scene = new T.Scene();
    st.scene.background = p.sky;
    st.scene.fog = new T.Fog(p.sky.clone(), 18, 190);
    st.cam = new T.PerspectiveCamera(50, 1.5, 0.1, 1500);
    st.plainGeo = shared(new T.CircleGeometry(900, 64));
    st.offTheme = PX.bus && PX.bus.on ? PX.bus.on('stage3d:theme', recolour) : null;
    st.view = ctx.stage3d.attach(stage);
    if (st.view) st.view.redraw = render;
    setPose(0, 0, 0);
    ctx.stage3d.compile(st.scene, st.cam);
  }

  function describe(item) {
    return cap('describe', { legs: item.legs.length, landmarks: item.landmarks && item.landmarks.length ? cap('withLandmarks') : '' });
  }

  // Draws the start, plays the route and resolves with the paint timestamp of the first answer frame.
  function present(item, ctx) {
    if (!st) mount(ctx);
    stopInput();
    stopWalk();
    if (st.lookStop) { st.lookStop(); st.lookStop = null; }
    st.item = item; st.value = null; st.response = null; st.result = null; st.done = false; st.playing = false;
    st.respond = null; st.voided = null; st.voidStats = null; st.paused = false; st.frames = null;
    if (!st.view || ctx.stage3d.current() !== st.view) { st.view = ctx.stage3d.attach(st.stage); if (st.view) st.view.redraw = render; }
    buildWorld(item);
    closeMap();
    st.mapv = null;
    st.dial = drawDial();
    PX.ui.clear(st.dialbox).appendChild(st.dial.svg);
    bindDial();
    st.root.classList.remove('is-revealed');
    st.root.classList.add('is-watching');
    st.readout.textContent = cap('readoutWatch');
    st.confirm.hidden = false;
    st.confirm.disabled = true;
    st.verdict.hidden = true;
    st.note.hidden = true;
    st.voidNote.hidden = true;
    st.pauseNote.hidden = true;
    st.caption.textContent = '';
    st.phase.textContent = cap('phaseWatch');
    st.desc.textContent = describe(item);
    showPose(item, poseAt(timeline(item), 0));
    render();
    var popWalkKeys = ctx.keys.push({
      Escape: function () { return togglePause(); },
      Space: function () { return st && st.paused ? togglePause() : false; },
    }, { through: true });
    st.walking = true;
    return timing.nextPaint().then(function () {
      if (!st || st.item !== item) { popWalkKeys(); return timing.now(); }
      var mon = timing.monitor();
      return walk(item).then(function () {
        var stats = mon.stop();
        popWalkKeys();
        if (!st || st.item !== item) return timing.now();
        st.frames = stats;
        st.walking = false;
        st.paused = false;
        st.pauseNote.hidden = true;
        try { ctx.stage3d.noteTrial(!!stats.stutter); } catch (e) { /* quality bookkeeping is optional */ }
        // Motion is integrated from clamped dt (≤ 100 ms: 0.3 m or 6° at most), so a slow frame never
        // jumps the view; only a visible freeze, a mostly slow route or a lost context voids the trial.
        if (stats.contextLost || stats.maxGapMs > FREEZE_MS || (stats.frames > 10 && stats.dropped > SLOW_SHARE * stats.frames)) voidTrial('stutter', stats);
        showPose(item, endPose(item));
        render();
        st.root.classList.remove('is-watching');
        st.phase.textContent = cap('phaseTurn');
        st.readout.textContent = cap('readoutNone');
        return timing.nextPaint();
      });
    });
  }

  function collect(item, ctx, respond) {
    if (!st || st.item !== item) return;
    st.respond = respond;
    st.live = true;
    if (st.popKeys) st.popKeys();
    st.popKeys = ctx.keys.push({
      ArrowLeft: function (e) { return turnBy(e && e.shiftKey ? -1 : -5); },
      ArrowRight: function (e) { return turnBy(e && e.shiftKey ? 1 : 5); },
      Enter: function () {
        if (!live()) return false;
        if (st.value === null) { st.readout.textContent = cap('setFirst'); return undefined; }
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
    st.response = isNum(response) ? norm360(response) : null;
    st.result = result || { correct: false };
    var ok = !!st.result.correct, err = isNum(st.result.value) ? Math.round(st.result.value) : null, s = side(item.key);
    st.root.classList.add('is-revealed');
    st.dial.arrow.setAttribute('class', 'ex-homing-arrow ' + (ok ? 'is-right' : 'is-wrong'));
    setArrow(st.dial.arrow, st.response);
    setArrow(st.dial.key, item.key);
    setWedge(item.key, item.tolerance);
    st.flag.visible = true;
    st.confirm.hidden = true;
    st.phase.textContent = cap('phaseReveal');
    st.verdict.hidden = false;
    st.verdict.setAttribute('data-kind', ok ? 'right' : 'wrong');
    st.verdict.textContent = (ok ? '✓ ' : '✗ ') + (err === null ? cap('noAnswer') : cap(ok ? 'verdictRight' : 'verdictWrong', { err: err, tol: item.tolerance }));
    var lines = [cap('answerWas', { deg: s.deg, side: s.side, dist: Math.round(item.distance) }), cap('legend', { tol: item.tolerance })];
    var hint = hintFor(item, st.response, st.result);
    if (hint) lines.push(hint);
    st.note.textContent = lines.join(' ');
    st.note.hidden = false;
    st.readout.textContent = st.response !== null ? cap('readoutYours', { dir: sideText(st.response) }) : '';
    return lookTo(item.heading + item.key, 600);
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
        var s = list[i], k = Math.min(1, Math.max(0, (now - start) / Math.max(1, s.ms * scale)));
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

  function showMe(item, response, ctx) {
    if (!st || st.item !== item) return Promise.resolve();
    return play(mapSteps(item), ctx, { name: 'show-me' });
  }

  // Tutorial: the route again with captions, the same map explanation, then the turn to the start.
  // Keys and the pointer rest while it plays; afterwards the item is back in its answer state.
  function demo(item, ctx, caption) {
    if (!st || st.item !== item) return Promise.resolve();
    var tl = timeline(item), E = endPose(item), s = side(item.key);
    st.playing = true;
    function at(p, flag) { closeMap(); setArrow(st.dial.key, null); setWedge(null); st.flag.visible = !!flag; showPose(item, p); render(); }
    var watch = [
      { ms: 2200, caption: cap('demoStart'), enter: function () { setArrow(st.dial.arrow, null); at(poseAt(tl, 0)); } },
      { ms: Math.round(tl.total * 1000), caption: cap('demoWalk'), enter: function () { at(poseAt(tl, 0)); },
        update: function (k) { showPose(item, poseAt(tl, k * tl.total)); render(); } },
      { ms: 2000, caption: cap('demoEnd'), enter: function () { at(E); } },
    ];
    var answer = [
      { ms: 2600, caption: cap('demoTurn', { deg: s.deg, side: s.side }), enter: function () { at(E); setArrow(st.dial.arrow, 0); },
        update: function (k) { var a = sweep(item.key, ease(k)); setArrow(st.dial.arrow, a); setPose(E.x, E.y, item.heading + a); render(); },
        exit: function () { st.flag.visible = true; render(); } },
      { ms: 2400, caption: cap('demoAnswer'), enter: function () { at({ x: E.x, y: E.y, h: item.heading + item.key }, true); setArrow(st.dial.arrow, item.key); } },
    ];
    return play(watch.concat(mapSteps(item), answer), ctx, { name: 'demo', caption: caption || null }).then(function () {
      if (!st) return;
      st.playing = false;
      if (st.item === item && !st.done) {
        st.value = null;
        at(E);
        setArrow(st.dial.arrow, null);
        st.readout.textContent = cap('readoutNone');
        st.confirm.disabled = true;
      }
    });
  }

  function unmount() {
    if (!st) return;
    stopInput();
    stopWalk();
    if (st.lookStop) st.lookStop();
    if (st.offTheme) st.offTheme();
    if (st.world) freeTree(st.world);
    if (st.plainGeo) st.plainGeo.dispose();
    Object.keys(st.mats || {}).forEach(function (k) { st.mats[k].dispose(); });
    if (st.view) st.view.detach();
    if (st.root.parentNode) st.root.parentNode.removeChild(st.root);
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
    // for tests: the dial geometry, the walk model and the camera pose
    dial: { radius: DIAL_R, box: DIAL_BOX, hub: HUB },
    timeline: timeline,
    poseAt: poseAt,
    mapSteps: function (item) { return st && st.item === item ? mapSteps(item) : []; },
    pose: function () { return st && st.pose ? { x: st.pose.x, y: st.pose.y, h: st.pose.h } : null; },
    state: function () {
      return st ? { walking: st.walking, paused: st.paused, voided: st.voided, voidStats: st.voidStats, live: st.live,
        flag: !!(st.flag && st.flag.visible), map: !!(st.overlay && !st.overlay.hidden) } : null;
    },
    sideText: sideText,
    answerMeta: answerMeta,
  });
})(window.PX);
