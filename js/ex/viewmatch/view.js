/* PR-2 View Match: view (3D through PX.core.stage3d; ARCHITECTURE.md §6, docs/dev/EXERCISE-GUIDE.md).
   layout 'stem+options': the stem is the overview (the table from the viewer's side, seen from
   above at an angle, with the flag on the rim), drawn live through the one renderer; the four
   options are snapshots taken in drawOption (ready phase), never while the answer clock runs.
   - Every number comes from the item: table radius, objects (shape, size s, height h, x, z, yaw),
     item.stem and item.camera (position (dist sin az, height, dist cos az), target, vertical fov,
     square pictures). These are the numbers validate() projects, so each picture is what was graded.
   - three.js conventions match lib: a model yaw turns local (x, z) by +yaw in the (x, z) plane,
     which is rotation.y = −yaw; the pyramid is a 4-sided cone turned 45° (base corners (±s, ±s)).
   - The flag is hidden in every option picture (seen from the flag it would stand in front of the
     camera; shown in the others only, it would mark the key).
   - Show me (for development; the Spatial Check gives no feedback) moves the overview camera to
     the flag and down to the option cameras' height, so it ends on the key's picture.
   - The item's time limit runs as a calm bar under the stem (CSS; paused with [data-paused] or the
     harness pause; stopped at reveal). */
(function (PX) {
  'use strict';

  var win = window, T = win.THREE, S3 = PX.core.stage3d, timing = PX.core.timing, h = PX.ui.h, U = PX.util;
  var def = PX.ex.get('viewmatch'), lib = def.lib;
  var DEG = Math.PI / 180;
  var COLORS = { red: '#C8483B', blue: '#3A6FB7', yellow: '#E0B43A', green: '#3F9A5A', purple: '#8457B0' };
  var st = null;

  function learn() { return PX.ex.learn('viewmatch') || {}; }
  function cap(key, a) { return String((learn().captions || {})[key] || '').replace('{a}', a === undefined ? '' : a); }

  /* ---------- the scene, from the item ---------- */

  function token(name, fallback) {
    var v = '';
    try { v = String(win.getComputedStyle(st.root).getPropertyValue(name) || '').trim(); } catch (e) { v = ''; }
    return v || fallback;
  }
  function color(value) { var c = new T.Color(); try { c.setStyle(value); } catch (e) { c.setStyle('#888888'); } return c; }

  function geometryOf(o) {
    if (o.shape === 'cube') return new T.BoxGeometry(2 * o.s, o.h, 2 * o.s);
    if (o.shape === 'pyramid') return new T.ConeGeometry(o.s * Math.SQRT2, o.h, 4, 1, false, Math.PI / 4);
    if (o.shape === 'cylinder') return new T.CylinderGeometry(o.s, o.s, o.h, 40);
    if (o.shape === 'cone') return new T.ConeGeometry(o.s, o.h, 40);
    return new T.SphereGeometry(o.s, 32, 20);
  }
  function objectMesh(o) {
    var g = geometryOf(o), group = new T.Group();
    var mesh = new T.Mesh(g, new T.MeshLambertMaterial({ color: color(token('--vm-' + o.color, COLORS[o.color])), polygonOffset: true, polygonOffsetFactor: 1, polygonOffsetUnits: 1 }));
    mesh.userData.colorName = o.color;
    group.add(mesh);
    if (o.shape !== 'sphere') group.add(new T.LineSegments(new T.EdgesGeometry(g, 25), new T.LineBasicMaterial({ color: S3.colors().edge.clone() })));
    group.position.set(o.x, o.shape === 'sphere' ? o.s : o.h / 2, o.z);
    group.rotation.y = -o.yaw * DEG;
    return group;
  }
  function flagGroup(item) {
    var a = item.flag.az * DEG, r = item.table.r, H = lib.FLAG_H, g = new T.Group();
    var ink = new T.MeshLambertMaterial({ color: S3.colors().edge.clone() });
    var pole = new T.Mesh(new T.CylinderGeometry(0.014, 0.014, H, 10), ink);
    pole.position.y = H / 2;
    var foot = new T.Mesh(new T.CylinderGeometry(0.045, 0.045, 0.012, 20), ink);
    var tri = new T.BufferGeometry();
    tri.setAttribute('position', new T.Float32BufferAttribute([0, H, 0, 0, H - 0.13, 0, 0.2, H - 0.065, 0], 3));
    tri.computeVertexNormals();
    var pennant = new T.Mesh(tri, new T.MeshBasicMaterial({ color: S3.colors().target.clone(), side: T.DoubleSide }));
    g.add(pole, foot, pennant);
    g.position.set(r * Math.sin(a), 0, r * Math.cos(a)); // the pennant faces the default view
    return g;
  }
  function buildScene(item) {
    var scene = new T.Scene();
    scene.background = S3.colors().ground.clone();
    S3.lights(scene);
    var r = item.table.r;
    var top = new T.Mesh(new T.CylinderGeometry(r, r, 0.05, 72), new T.MeshLambertMaterial({ color: color(token('--vm-table', '#D8D3C8')) }));
    top.position.y = -0.025;
    top.userData.isTable = true;
    var rimPts = [];
    for (var i = 0; i <= 72; i++) rimPts.push(new T.Vector3(r * Math.sin(i * 5 * DEG), 0.001, r * Math.cos(i * 5 * DEG)));
    var rim = new T.Line(new T.BufferGeometry().setFromPoints(rimPts), new T.LineBasicMaterial({ color: S3.colors().edge.clone() }));
    scene.add(top, rim);
    item.objects.forEach(function (o) { scene.add(objectMesh(o)); });
    var flag = flagGroup(item);
    scene.add(flag);
    return { scene: scene, flag: flag, table: top };
  }
  function recolor(sc) {
    sc.scene.background.copy(S3.colors().ground);
    sc.scene.traverse(function (o) {
      if (!o.material) return;
      if (o.userData.colorName) o.material.color.copy(color(token('--vm-' + o.userData.colorName, COLORS[o.userData.colorName])));
      else if (o.userData.isTable) o.material.color.copy(color(token('--vm-table', '#D8D3C8')));
      else if (o.isLine || o.isLineSegments || (o.material.isMeshLambertMaterial && o.parent === sc.flag)) o.material.color.copy(S3.colors().edge);
    });
  }

  /* ---------- cameras (the validator's: lib.optionCam / lib.stemCam) ---------- */

  function setCam(cam, pos, target, fov) {
    cam.position.set(pos[0], pos[1], pos[2]);
    cam.up.set(0, 1, 0);
    cam.fov = fov;
    cam.near = 0.05;
    cam.far = 30;
    cam.lookAt(target[0], target[1], target[2]);
    cam.updateProjectionMatrix();
  }
  function stemPose(item) { var e = item.stem.elev * DEG, d = item.stem.dist; return { pos: [0, d * Math.sin(e), d * Math.cos(e)], target: item.stem.target, fov: item.stem.fov }; }
  function optionPose(item, az) { var a = az * DEG, c = item.camera; return { pos: [c.dist * Math.sin(a), c.height, c.dist * Math.cos(a)], target: c.target, fov: c.fov }; }

  function renderStem() {
    if (!st || !st.v3 || !st.sc) return;
    var v = st.v3;
    if (!v.width || !v.height) v.resize();
    v.render(st.sc.scene, st.stemCam);
  }
  // Option i as a square 2D canvas (w CSS px), the flag hidden.
  function snapshotOption(item, i, w, canvas) {
    var p = optionPose(item, item.options[i].az);
    setCam(st.optCam, p.pos, p.target, p.fov);
    st.sc.flag.visible = false;
    var out = S3.snapshot(st.sc.scene, st.optCam, w, w, { fluid: true, canvas: canvas });
    st.sc.flag.visible = true;
    return out;
  }

  /* ---------- the countdown bar ---------- */

  function timerStart(item) {
    var ms = def.timeLimit(item.params);
    st.timer.hidden = !ms;
    st.timer.classList.remove('is-running', 'is-stopped');
    if (!ms) return;
    st.timerFill.style.animationDuration = ms + 'ms';
    void st.timerFill.offsetWidth;
    st.timer.classList.add('is-running');
  }
  function timerStop() { if (st) st.timer.classList.add('is-stopped'); }

  /* ---------- view functions ---------- */

  function describe(item) {
    var ms = def.timeLimit(item.params);
    return 'A table with ' + item.objects.length + ' objects, seen from your side, and a flag on its edge. Four pictures show the table from four places around it. ' +
      'Which picture was taken from the flag? Keys 1 to 4' + (ms ? '; up to ' + Math.round(ms / 1000) + ' seconds.' : '.');
  }

  function mount(ctx) {
    var root = h('div.ex-viewmatch-stem');
    var stage = h('div.ex-stage.ex-viewmatch-stage');
    var label = h('span.ex-label', 'Overview · seen from your side');
    var verdict = h('div.ex-verdict.vm-verdict', { hidden: true, role: 'status' });
    // px-keep-motion: base.css's reduced-motion rule would empty the bar at once, and the slow
    // sweep is information (the time left), not decoration.
    var timer = h('div.pr-timer.px-keep-motion', { 'aria-hidden': 'true', hidden: true }, h('div.pr-timer-fill'));
    var caption = h('p.ex-caption', { 'aria-live': 'polite' }), desc = h('p.px-sr');
    stage.appendChild(label);
    // The verdict goes under the bar, not over the overview (on a phone the table fills the stage).
    root.appendChild(stage); root.appendChild(timer); root.appendChild(verdict); root.appendChild(caption); root.appendChild(desc);
    ctx.host.appendChild(root);
    st = { ctx: ctx, root: root, stage: stage, label: label, verdict: verdict, caption: caption, desc: desc, timer: timer, timerFill: timer.firstChild,
      v3: null, sc: null, item: null, optItem: null, opts: [], offs: [], stemCam: null, optCam: null };
    if (!S3.available()) {
      stage.appendChild(h('p.ex-unavailable', { role: 'alert' }, 'This check needs 3D graphics, which are not available here: ' + S3.reason() + '.'));
      return;
    }
    st.v3 = S3.attach(stage);
    st.v3.redraw = renderStem;
    st.stemCam = new T.PerspectiveCamera(40, 1, 0.05, 30);
    st.optCam = new T.PerspectiveCamera(46, 1, 0.05, 30);
    st.offs.push(PX.bus.on('stage3d:theme', themeChanged));
    // Warm-up: compile the shaders and touch the snapshot path now, not in the first item.
    var warm = buildScene({ table: { r: 1 }, objects: [{ shape: 'cube', color: 'red', s: 0.1, h: 0.2, x: 0, z: 0, yaw: 0 }], flag: { az: 0 } });
    setCam(st.optCam, [0, 1, 3], [0, 0, 0], 46);
    S3.compile(warm.scene, st.optCam);
    S3.disposeTree(warm.scene);
  }

  // drawOption runs before present for a new item: the first call builds the item's scene.
  function newItem(item) {
    if (st.optItem === item) return;
    if (st.sc) S3.disposeTree(st.sc.scene);
    st.sc = st.v3 ? buildScene(item) : null;
    st.optItem = item;
    st.opts = [];
  }

  function drawOption(el, item, i, ctx) {
    if (!st) mount(ctx);
    newItem(item);
    var w = Math.max(96, Math.min(320, Math.round(el.clientWidth || 160)));
    var canvas = st.v3 ? snapshotOption(item, i, w) : h('canvas', { width: w, height: w });
    canvas.className = 'ex-thumb';
    canvas.setAttribute('aria-hidden', 'true');
    var tag = h('span.ex-tag', { hidden: true });
    el.appendChild(h('span.ex-opt', canvas, tag));
    st.opts[i] = { el: el, canvas: canvas, tag: tag, w: w };
  }
  function optionLabel(item, i) { return 'Picture ' + (i + 1); }
  function gridCols() { return 4; }

  function present(item, ctx) {
    if (!st) mount(ctx);
    newItem(item);
    st.item = item;
    st.root.classList.remove('is-revealed');
    st.verdict.hidden = true;
    st.verdict.textContent = '';
    st.caption.textContent = '';
    st.desc.textContent = describe(item);
    st.label.classList.remove('is-pointed');
    if (st.v3) {
      var p = stemPose(item);
      setCam(st.stemCam, p.pos, p.target, p.fov);
      st.sc.flag.visible = true;
      st.v3.resize();
      renderStem();
    }
    timerStart(item);
    return timing.nextPaint();
  }

  function themeChanged() {
    if (!st || !st.sc) return;
    recolor(st.sc);
    renderStem();
    // Pictures are drawn in the new colours (outside any stimulus phase: a theme change is the user's).
    if (st.item) st.opts.forEach(function (o, i) { if (o) snapshotOption(st.item, i, o.w, o.canvas); });
  }

  /* ---------- reveal (development; the Check shows nothing), ≤ 700 ms ---------- */

  function reveal(item, response, result, ctx) {
    if (!st) return Promise.resolve();
    timerStop();
    st.root.classList.add('is-revealed');
    st.opts.forEach(function (o, i) {
      if (!o) return;
      o.tag.textContent = i === item.key ? '✓ ' + cap('tagKey') : cap('tagOther');
      o.tag.setAttribute('data-kind', i === item.key ? 'same' : 'mirror');
      o.tag.hidden = false;
    });
    st.verdict.textContent = '✓ ' + cap('verdict', item.key + 1);
    st.verdict.setAttribute('data-kind', 'same');
    st.verdict.hidden = false;
    return timing.wait(ctx && ctx.fast ? 0 : 250);
  }

  /* ---------- show me and the worked example: walk the camera to the flag ---------- */

  function ease(k) { return k * k * (3 - 2 * k); }
  function focusOption(i) {
    st.opts.forEach(function (o, j) {
      var b = o && o.el.closest ? o.el.closest('.px-choice') : null;
      if (b) b.classList.toggle('ex-focus', j === i);
    });
  }
  // The overview camera at k ∈ [0, 1] of the way from the default view to the flag's camera.
  function walkPose(item, k) {
    var a = item.stem, c = item.camera, e = a.elev * DEG, az = item.flag.az * k * DEG;
    var dist = U.lerp(a.dist * Math.cos(e), c.dist, k), y = U.lerp(a.dist * Math.sin(e), c.height, k);
    var tg = [U.lerp(a.target[0], c.target[0], k), U.lerp(a.target[1], c.target[1], k), U.lerp(a.target[2], c.target[2], k)];
    return { pos: [dist * Math.sin(az), y, dist * Math.cos(az)], target: tg, fov: U.lerp(a.fov, c.fov, k) };
  }
  function walkSteps(item) {
    var ms = 1200 + 1800 * Math.abs(item.flag.az) / 180;
    function at(k) {
      var p = walkPose(item, k);
      setCam(st.stemCam, p.pos, p.target, p.fov);
      st.sc.flag.visible = k < 0.75; // close to the flag the camera stands where it is
      renderStem();
    }
    return [
      { ms: ms, caption: cap('walk'), enter: function () { focusOption(-1); at(0); }, update: function (k) { at(ease(k)); }, exit: function () { at(1); } },
      { ms: 1800, caption: cap('match', item.key + 1), enter: function () { at(1); focusOption(item.key); } },
    ];
  }
  function resetStem(item) {
    var p = stemPose(item);
    setCam(st.stemCam, p.pos, p.target, p.fov);
    st.sc.flag.visible = true;
    focusOption(-1);
    renderStem();
  }

  function runSteps(list, ctx, opts) { // minimal runner when the player has no ctx.play
    var scale = ctx && ctx.fast ? 0.02 : 1;
    return new Promise(function (resolve) {
      var i = -1, start = 0, go = true;
      function begin(now) {
        i++;
        if (i >= list.length) { resolve(); return false; }
        start = now;
        if (list[i].caption && opts.caption) opts.caption(list[i].caption);
        if (list[i].enter) list[i].enter();
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

  function showMe(item, response, ctx) {
    if (!st || !st.v3 || st.item !== item) return Promise.resolve();
    return play(walkSteps(item), ctx, { name: 'show-me' }).then(function () { resetStem(item); focusOption(item.key); });
  }

  // The one-screen instruction's worked example (learn.demo, a fixed seed the Check never scores).
  function demo(item, ctx, caption) {
    if (!st || !st.v3 || st.item !== item) return Promise.resolve();
    timerStop();
    var intro = [
      { ms: 2200, caption: cap('overview'), enter: function () { resetStem(item); st.label.classList.add('is-pointed'); }, exit: function () { st.label.classList.remove('is-pointed'); } },
      { ms: 2200, caption: cap('flag'), enter: function () { resetStem(item); } },
      { ms: 2200, caption: cap('options'), enter: function () { resetStem(item); } },
    ];
    var outro = { ms: 1800, caption: cap('answer', item.key + 1), enter: function () { focusOption(item.key); } };
    // Back to the overview, with the answer the last caption names still marked.
    return play(intro.concat(walkSteps(item), [outro]), ctx, { name: 'demo', caption: caption || null }).then(function () { if (st) { resetStem(item); focusOption(item.key); } });
  }

  function unmount() {
    if (!st) return;
    st.offs.forEach(function (off) { off(); });
    if (st.sc) S3.disposeTree(st.sc.scene);
    if (st.v3) st.v3.detach();
    if (st.root.parentNode) st.root.parentNode.removeChild(st.root);
    st = null;
  }

  PX.ex.view('viewmatch', {
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
    // for tests: the camera show me ends on (the key option's camera)
    walkPose: walkPose,
  });
})(window.PX);
