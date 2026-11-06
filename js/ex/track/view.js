/* EX-01 Track: view (DOM and 3D through PX.core.stage3d; ARCHITECTURE.md §6, PLAN.md §8).
   layout 'custom': present() plays the whole stimulus and resolves with the paint timestamp of
   the first response frame (the answer clock starts there); collect() takes the picks.
   Phases of a trial (phase()):
     notice   before the first trial of a page load: one line about the motion and pausing
     cue      item.cue = 2 s: every sphere still, the targets in the target colour with a ring
     track    item.dur s: the marks go away and everything moves; positions are lib.sim(item)
              sampled at the elapsed tracking time (rAF dt), the orbit camera at lib.camAz
     respond  the spheres stop at item.end with numbers 1–N (left to right); pick exactly K: a
              tap toggles the nearest sphere within 36 px; digits toggle (0 = 10); Enter confirms
     reveal   found ✓, picked but not a target ✗, missed target ○; the targets in their colour
   Void trials: timing.monitor() runs over the tracking phase and Track's own rule judges it (see
   jumpMax): a jump in one frame of more than min(3r, 0.75 d_min) cube widths ('jump'), a lost 3D
   context ('lost'), a pause (Esc or the Pause button during the stimulus, 'paused') or a fallback
   item ('fallback') voids the trial: the stage says so, PX.bus emits 'trial:void' { ex, seed,
   reason, stats }, and ctx.voidTrial(reason, stats) is called when the player provides it. Late
   frames alone never void (motion is time-based); their share is logged. collect's
   respond(response, meta) passes meta = { frames, jump, late, void } either way, for the log.
   stage3d.noteTrial(stats.stutter) hears about every trial.
   Camera: the reference camera of gen.js (lib.camera(az): eye, target, up). The field of view
   fits the cube at every azimuth (one framing for both variants, fixed during a trial) and a
   view offset centres the cube's image: a uniform scale and a shift, so the separations the
   validator checked in the image plane hold on screen. No resizing while the stimulus runs and
   nothing but drawing during cue and tracking (overlays are placed before and after).
   Show me (ctx.play): the targets at the start, fast-forward to the closest call (a missed target
   and a wrong pick, else the nearest target–distractor pass), that moment in slow motion, the
   rest, then the picks against the targets. Everything comes from lib.sim(item).
   Test helpers on the view: phase(), points(), picks(), trialInfo(). */
(function (PX) {
  'use strict';

  var win = window, T = win.THREE, S3 = PX.core.stage3d, timing = PX.core.timing;
  var h = PX.ui.h;
  var def = PX.ex.get('track'), lib = def.lib;
  var MARGIN = 1.06;        // room around the cube's image
  var FAST = 20;            // ctx.fast (tests): the stimulus plays 20× faster (same positions)
  var PICK_PX = 36;         // ARCHITECTURE §4: the nearest sphere within 36 px of a tap
  var DEMO_END_MS = 3000;   // the demo's answer holds ≥ 2 s even at reduced motion's 75 %
  // Track's void rule (not the generic stutter flag): motion is time-based, so a slow frame never
  // misplaces a sphere; only a visible jump harms tracking. Void when the largest jump in one
  // frame (speed × the longest frame gap, in cube widths) exceeds 1.5 sphere diameters (3r) or,
  // to stay safe near close passes, 0.75 × d_min for the item's sphere count, whichever is less;
  // or when the 3D context was lost; a pause or a fallback item voids too. Late frames are logged
  // (meta.late), never voided: the trial counts even when timing.monitor sets its stutter flag.
  var JUMP_R = 3 * lib.R, JUMP_DMIN = 0.75;
  function jumpMax(item) {
    var d = item.dmin || lib.DMIN[item.n];
    return d ? Math.min(JUMP_R, JUMP_DMIN * d) : JUMP_R; // 6 → 0.15, 8 → 0.1365, 10 → 0.12675
  }
  var noticeSeen = false;   // the motion notice shows once per page load
  var st = null;            // the mounted view (one exercise at a time)

  function learn() { return PX.ex.learn('track') || {}; }
  function cap(key, vars) {
    var s = String((learn().captions || {})[key] || '');
    return s.replace(/\{(\w+)\}/g, function (m, k) { return vars && vars[k] !== undefined ? String(vars[k]) : m; });
  }
  function plural(n, one, many) { return n + ' ' + (n === 1 ? one : many); }

  /* ---------- framing: the cube's image over every azimuth (image plane, focal length 1) ---------- */

  var EXT = (function () {
    var c = [], az, i, ext = { hx: 0, up: 0, down: 0 };
    for (var x = -0.5; x <= 0.5; x += 1) for (var y = -0.5; y <= 0.5; y += 1) for (var z = -0.5; z <= 0.5; z += 1) c.push(x, y, z);
    for (az = 0; az < 360; az += 3) {
      var pr = lib.project(az, c, 8);
      for (i = 0; i < 8; i++) {
        ext.hx = Math.max(ext.hx, Math.abs(pr[i].x));
        ext.up = Math.max(ext.up, pr[i].y);
        ext.down = Math.max(ext.down, -pr[i].y);
      }
    }
    return ext;
  })();

  // Vertical field of view and a view offset so the cube's image fills the W × H stage.
  function fit(cam, W, H) {
    var A = W / Math.max(1, H);
    var hx = EXT.hx * MARGIN, hy = (EXT.up + EXT.down) / 2 * MARGIN, cy = (EXT.up - EXT.down) / 2;
    var ty = Math.max(hy, hx / A); // tan of the vertical half-angle
    cam.aspect = A;
    cam.fov = 2 * Math.atan(ty) * 180 / Math.PI;
    cam.setViewOffset(W, H, 0, -cy / ty * (H / 2), W, H); // move the image of the cube's middle to the middle
    cam.near = 0.5;
    cam.far = 6;
    cam.updateProjectionMatrix();
  }

  /* ---------- scene ---------- */

  // Lines that read on the ground: the dark edge colour on a light ground, a light face tone on
  // a dark one (the shared edge colour is meant for outlines on light faces).
  function lineColour() {
    var c = S3.colors(), g = c.ground;
    return (0.2126 * g.r + 0.7152 * g.g + 0.0722 * g.b) < 0.35 ? c.face2 : c.edge;
  }
  function floorGrid(n) {
    // A faint grid on the floor of the cube: a depth cue, drawn with lines only.
    var pts = [], y = -0.5, k, s;
    for (k = 1; k < n; k++) {
      s = -0.5 + k / n;
      pts.push(s, y, -0.5, s, y, 0.5, -0.5, y, s, 0.5, y, s);
    }
    var g = new T.BufferGeometry();
    g.setAttribute('position', new T.Float32BufferAttribute(pts, 3));
    var m = new T.LineBasicMaterial({ color: lineColour().clone(), transparent: true, opacity: 0.24 });
    return new T.LineSegments(g, m);
  }
  function wireCube() {
    var box = new T.BoxGeometry(1, 1, 1), edges = new T.EdgesGeometry(box);
    box.dispose();
    return new T.LineSegments(edges, new T.LineBasicMaterial({ color: lineColour().clone() }));
  }

  function buildScene() {
    var scene = new T.Scene();
    scene.background = S3.colors().ground.clone();
    S3.lights(scene);
    var cube = wireCube();
    var floor = floorGrid(4);
    scene.add(cube, floor);
    var meshes = [], probe = { sphere: S3.sphere(lib.R, 'sphere'), target: S3.sphere(lib.R, 'target') };
    for (var i = 0; i < 10; i++) {
      var m = S3.sphere(lib.R, 'sphere');
      m.visible = false;
      scene.add(m);
      meshes.push(m);
    }
    var cam = new T.PerspectiveCamera(40, 1, 0.5, 6);
    cam.userData.autoAspect = false; // fit() owns aspect, field of view and the view offset
    return {
      scene: scene, cube: cube, floor: floor, meshes: meshes, cam: cam,
      mat: { sphere: probe.sphere.material, target: probe.target.material }, probes: probe,
    };
  }

  function setCamera(az) {
    var c = lib.camera(az), cam = st.g.cam;
    cam.position.set(c.eye[0], c.eye[1], c.eye[2]);
    cam.up.set(0, 1, 0);
    cam.lookAt(0, 0, 0);
  }
  function place(flat, n) {
    for (var i = 0; i < n; i++) st.g.meshes[i].position.set(flat[3 * i], flat[3 * i + 1], flat[3 * i + 2]);
  }
  function showSpheres(n) {
    st.g.meshes.forEach(function (m, i) { m.visible = i < n; m.material = st.g.mat.sphere; });
  }
  // Targets in the target colour (marks on) or every sphere alike (marks off).
  function colourTargets(item, on) {
    var isT = {};
    item.key.forEach(function (k) { isT[k] = true; });
    for (var i = 0; i < item.n; i++) st.g.meshes[i].material = on && isT[i] ? st.g.mat.target : st.g.mat.sphere;
  }
  function render() {
    if (!st || !st.v3) return;
    if (!st.v3.width) st.v3.resize();
    st.v3.render(st.g.scene, st.g.cam);
  }
  // The trial's picture at tracking time t: positions, camera, one frame.
  function pose(run, t) {
    var item = run.item, tt = t > 0 ? (t < item.dur ? t : item.dur) : 0;
    run.sim.at(tt, run.buf);
    place(run.buf, item.n);
    setCamera(lib.camAz(item, tt));
    render();
  }
  function relayout() {
    if (!st || !st.v3) return;
    st.v3.resize();
    fit(st.g.cam, st.v3.width, st.v3.height);
  }
  function redraw() {
    if (!st || !st.v3) return;
    fit(st.g.cam, st.v3.width, st.v3.height);
    render();
    if (st.run && st.run.marks) drawMarks(st.run, st.run.marks);
  }
  function themeChanged() {
    if (!st || !st.g) return;
    st.g.scene.background.copy(S3.colors().ground);
    st.g.floor.material.color.copy(lineColour());
    st.g.cube.material.color.copy(lineColour());
    render();
  }

  /* ---------- overlays: rings, numbers and marks over the spheres (DOM) ---------- */

  var tmpV = null;
  // Sphere i on screen: centre and radius in CSS px inside the stage.
  function screenOf(i) {
    var m = st.g.meshes[i], cam = st.g.cam, W = st.v3.width, H = st.v3.height;
    tmpV = tmpV || new T.Vector3();
    tmpV.copy(m.position).project(cam);
    var d = cam.position.distanceTo(m.position), tanHalf = Math.tan(cam.fov * Math.PI / 360);
    return { x: (tmpV.x + 1) / 2 * W, y: (1 - tmpV.y) / 2 * H, r: lib.R / (d * tanHalf) * (H / 2) };
  }

  // marks: { <sphere id>: { kind, text?, badge? } }; kind = cue | pick | label | found | wrong |
  // missed | focus; text = the sphere's number (on it), badge = ✓ ✗ ○ (on the ring's edge)
  function drawMarks(run, marks) {
    run.marks = marks;
    var ov = st.overlay;
    PX.ui.clear(ov);
    Object.keys(marks).forEach(function (k) {
      var i = +k, mk = marks[k], s = screenOf(i), d = Math.round(2 * s.r + 14);
      var el = h('span.ex-track-mark', { 'data-kind': mk.kind, 'data-id': String(i) },
        mk.text ? h('span.ex-track-num', mk.text) : null, mk.badge ? h('span.ex-track-badge', mk.badge) : null);
      el.style.width = el.style.height = d + 'px';
      el.style.left = Math.round(s.x - d / 2) + 'px';
      el.style.top = Math.round(s.y - d / 2) + 'px';
      ov.appendChild(el);
    });
  }
  function clearMarks(run) { run.marks = null; PX.ui.clear(st.overlay); }
  function ringTargets(run, kind) {
    var m = {};
    run.item.key.forEach(function (k) { m[k] = { kind: kind || 'cue' }; });
    drawMarks(run, m);
  }

  // Numbers 1–N from left to right at the response (sphere ids are arbitrary; reading order helps).
  function numberSpheres(run) {
    var item = run.item, xs = [];
    for (var i = 0; i < item.n; i++) xs.push({ id: i, x: screenOf(i).x });
    xs.sort(function (a, b) { return a.x - b.x || a.id - b.id; });
    run.order = xs.map(function (o) { return o.id; });
    run.label = {};
    run.order.forEach(function (id, j) { run.label[id] = j + 1; });
  }
  function responseMarks(run) {
    var m = {};
    for (var i = 0; i < run.item.n; i++) {
      m[i] = { kind: run.picks.indexOf(i) >= 0 ? 'pick' : 'label', text: String(run.label[i]) };
    }
    drawMarks(run, m);
  }
  // After the answer every sphere keeps its number (show me and its captions refer to them).
  function verdictMarks(run, response) {
    var item = run.item, picked = Array.isArray(response) ? response : [], m = {}, i;
    for (i = 0; i < item.n; i++) {
      var t = item.key.indexOf(i) >= 0, p = picked.indexOf(i) >= 0, n = String(lab(run, i));
      if (t && p) m[i] = { kind: 'found', text: n, badge: '✓' };
      else if (p) m[i] = { kind: 'wrong', text: n, badge: '✗' };
      else if (t) m[i] = { kind: 'missed', text: n, badge: '○' };
      else m[i] = { kind: 'label', text: n };
    }
    return m;
  }

  /* ---------- texts ---------- */

  function describe(item) {
    return item.n + ' identical spheres in a cube. ' + plural(item.k, 'sphere is', 'spheres are') + ' marked for ' + item.cue +
      ' seconds, then every sphere moves for ' + item.dur + ' seconds' + (item.cam.dir ? ' while the view turns slowly' : '') +
      '. Then pick the ' + item.k + ' marked spheres by their numbers.';
  }
  function pickText(run) { return cap('pick', { k: run.item.k, p: run.picks.length }); }
  function keysHint(run) { return run.item.n >= 10 ? cap('keys10') : cap('keys', { n: run.item.n }); }
  // The tracking phase's frames against Track's rule: { reason: 'lost' | 'jump' | null, jump (cube
  // widths in the longest frame), limit (jumpMax), late (share of late frames: logged only) }.
  function judge(item, stats) {
    var limit = jumpMax(item);
    if (!stats) return { reason: null, jump: 0, late: 0, limit: limit };
    var jump = item.speed * stats.maxGapMs / 1000, late = stats.frames ? stats.dropped / stats.frames : 0;
    var reason = stats.contextLost ? 'lost' : jump > limit ? 'jump' : null;
    return { reason: reason, jump: jump, late: late, limit: limit };
  }
  // Says which rule fired.
  function voidText(v) {
    if (!v) return '';
    var s = v.stats || {};
    if (v.reason === 'lost') return cap('voidLost');
    if (v.reason === 'jump') return cap('voidJump', { ms: Math.round(s.maxGapMs) });
    return cap(v.reason === 'paused' ? 'voidPaused' : 'voidFallback');
  }

  /* ---------- the trial: notice → cue → track → respond ---------- */

  // The line under the phase text: key hints (hidden on phones) or the legend of the marks.
  function setHint(text, kind) {
    st.hint.textContent = text;
    st.hint.setAttribute('data-kind', kind);
  }

  function setPhase(run, phase, text) {
    run.phase = phase;
    st.root.setAttribute('data-phase', phase);
    if (text !== undefined) st.phaseText.textContent = text;
  }

  function newRun(item, ctx) {
    return {
      item: item, ctx: ctx, sim: lib.sim(item), buf: new Float64Array(3 * item.n), rate: ctx && ctx.fast ? FAST : 1,
      phase: 'ready', t: 0, paused: false, void: null, frames: null, picks: [], order: [], label: {}, marks: null,
      stop: null, monitor: null, popKeys: null, popResp: null, resolve: null, respond: null, answered: false,
      input: null, cancelled: false,
    };
  }

  // A new item (or unmount) ends the running one: loops, monitor, keys; a pending present resolves.
  function cancelRun() {
    var run = st && st.run;
    if (!run) return;
    run.cancelled = true;
    if (run.stop) { run.stop(); run.stop = null; }
    if (run.monitor) { run.monitor.stop(); run.monitor = null; }
    if (run.popKeys) { run.popKeys(); run.popKeys = null; }
    if (run.popResp) { run.popResp(); run.popResp = null; }
    if (run.resolve) { var r = run.resolve; run.resolve = null; r(timing.now()); }
    if (st.v3) st.v3.holdResize = false;
    st.notice.hidden = true;
    st.pauseBox.hidden = true;
    st.pauseBtn.hidden = true;
    st.run = null;
  }

  function present(item, ctx) {
    if (!st) mount(ctx);
    cancelRun();
    var run = st.run = newRun(item, ctx);
    st.root.setAttribute('data-variant', item.params.variant);
    st.verdict.hidden = true;
    st.voidBox.hidden = true;
    st.caption.textContent = '';
    setHint('', '');
    st.confirm.hidden = true;
    st.desc.textContent = describe(item);
    st.label.textContent = 'Track · ' + item.k + ' of ' + item.n + ' · ' + item.dur + ' s' + (item.cam.dir ? ' · orbit' : '');
    if (!st.v3) { setPhase(run, 'respond', ''); return timing.nextPaint(); }
    showSpheres(item.n);
    clearMarks(run);
    relayout();
    pose(run, 0);
    if (ctx && ctx.keys) {
      run.popKeys = ctx.keys.push({
        Escape: function () { return togglePause(run); },
        Enter: function () { return startFromNotice(run); },
        Space: function () { return startFromNotice(run); },
      }, { through: true });
    }
    return new Promise(function (resolve) {
      run.resolve = resolve;
      // Once per person when the player remembers it (ctx.seen / ctx.markSeen), else once per page load.
      var seenBefore = noticeSeen || !!(ctx && ctx.seen && ctx.seen.motionNotice);
      if (!seenBefore) showNotice(run); else { noticeSeen = true; startCue(run); }
    });
  }

  function showNotice(run) {
    setPhase(run, 'notice', '');
    st.noticeText.textContent = cap('notice');
    st.notice.hidden = false;
    try { st.startBtn.focus({ preventScroll: true }); } catch (e) { /* not focusable yet */ }
  }
  function startFromNotice(run) {
    if (!run || run.cancelled || run.phase !== 'notice') return false;
    noticeSeen = true;
    if (run.ctx && typeof run.ctx.markSeen === 'function') { try { run.ctx.markSeen('motionNotice'); } catch (e) { /* storage may be blocked */ } }
    st.notice.hidden = true;
    startCue(run);
    return true;
  }

  function startCue(run) {
    if (run.cancelled) return;
    st.v3.holdResize = true;
    st.pauseBtn.hidden = false;
    setHint(cap('keysStim'), 'keys');
    colourTargets(run.item, true);
    pose(run, 0);
    ringTargets(run, 'cue');
    setPhase(run, 'cue', cap('cue', { k: run.item.k }));
    var left = run.item.cue * 1000 / run.rate;
    run.stop = timing.loop(function (dt) {
      if (run.cancelled) return false;
      if (run.paused) return true;
      left -= dt;
      if (left > 0) return true;
      run.stop = null;
      startTracking(run);
      return false;
    });
  }

  // The stimulus: positions from the simulation at the elapsed tracking time, nothing else.
  function startTracking(run) {
    if (run.cancelled) return;
    var item = run.item, rate = run.rate;
    clearMarks(run);
    colourTargets(item, false);
    setPhase(run, 'track', cap('track'));
    run.t = 0;
    pose(run, 0);
    run.monitor = timing.monitor();
    run.stop = timing.loop(function (dt) {
      if (run.cancelled) return false;
      if (run.paused) return true;
      run.t += dt * rate / 1000;
      pose(run, run.t);
      if (run.t < item.dur) return true;
      run.stop = null;
      endTracking(run);
      return false;
    });
  }

  function endTracking(run) {
    var stats = run.monitor ? run.monitor.stop() : null;
    run.monitor = null;
    run.frames = stats;
    // Render quality follows the generic flag (a slow device gets DPR 1 sooner); the trial follows
    // Track's rule.
    if (stats) S3.noteTrial(!!stats.stutter);
    run.judge = judge(run.item, stats);
    if (run.judge.reason) setVoid(run, run.judge.reason, stats);
    if (run.item.fallback) setVoid(run, 'fallback', stats);
    st.v3.holdResize = false;
    st.pauseBtn.hidden = true;
    relayout(); // a resize held back during the stimulus
    pose(run, run.item.dur); // exactly item.end, the camera at the end angle
    numberSpheres(run);
    responseMarks(run);
    setPhase(run, 'respond', pickText(run));
    setHint(keysHint(run), 'keys');
    st.confirm.hidden = false;
    st.confirm.disabled = true;
    if (run.void) showVoid(run);
    timing.nextPaint().then(function (ts) {
      if (run.cancelled || !run.resolve) return;
      var r = run.resolve;
      run.resolve = null;
      r(ts);
    });
  }

  // Esc or the Pause button during the cue or the motion: everything holds; the trial no longer counts.
  function togglePause(run) {
    if (!run || run.cancelled || (run.phase !== 'cue' && run.phase !== 'track')) return false;
    run.paused = !run.paused;
    if (run.paused) {
      setVoid(run, 'paused', null);
      st.pauseBox.hidden = false;
      try { st.resumeBtn.focus({ preventScroll: true }); } catch (e) { /* ignore */ }
    } else st.pauseBox.hidden = true;
    return true;
  }

  function setVoid(run, reason, stats) {
    if (run.void) return;
    run.void = { reason: reason, stats: stats || null };
    if (PX.bus) PX.bus.emit('trial:void', { ex: 'track', seed: run.item.seed, reason: reason, stats: stats || null });
    if (run.ctx && typeof run.ctx.voidTrial === 'function') {
      try { run.ctx.voidTrial(reason, stats || null); } catch (e) { if (win.console) console.error('track: ctx.voidTrial failed', e); }
    }
  }
  function showVoid(run) {
    st.voidBox.textContent = voidText(run.void);
    st.voidBox.hidden = false;
  }

  /* ---------- respond: pick exactly K ---------- */

  function collect(item, ctx, respond) {
    var run = st && st.run;
    if (!run || run.item !== item || run.phase !== 'respond') return;
    run.respond = respond;
    if (!ctx || !ctx.keys) return;
    var map = {
      Enter: function () { return confirm(run, 'key'); },
      Backspace: function () { if (!run.picks.length || run.answered || run.demo) return false; toggle(run, run.picks[run.picks.length - 1], 'key'); return true; },
    };
    for (var d = 0; d <= 9; d++) map[String(d)] = keyPick(run, d);
    run.popResp = ctx.keys.push(map, { through: true });
  }
  function keyPick(run, d) {
    return function () {
      var j = d === 0 ? 10 : d;
      if (run.phase !== 'respond' || run.answered || run.demo || j > run.item.n) return false;
      toggle(run, run.order[j - 1], 'key');
      return true;
    };
  }
  function toggle(run, id, input) {
    // The demo's answer stays until the first pick, which starts the answer on a plain stage.
    if (run.shown) { run.shown = false; colourTargets(run.item, false); render(); responseMarks(run); }
    var at = run.picks.indexOf(id);
    if (at >= 0) run.picks.splice(at, 1);
    else if (run.picks.length < run.item.k) run.picks.push(id);
    else { st.phaseText.textContent = cap('full', { k: run.item.k }); return; }
    run.input = input;
    responseMarks(run);
    st.phaseText.textContent = pickText(run);
    st.confirm.disabled = run.picks.length !== run.item.k;
  }
  function confirm(run, input) {
    if (!run || run.phase !== 'respond' || run.answered || run.demo || !run.respond || run.picks.length !== run.item.k) return false;
    run.answered = true;
    run.input = input || run.input;
    if (run.popResp) { run.popResp(); run.popResp = null; }
    st.confirm.disabled = true;
    // The frame statistics go with the response whether the trial counts or not (for the log).
    run.respond(run.picks.slice().sort(function (a, b) { return a - b; }), {
      frames: run.frames, jump: run.judge ? run.judge.jump : null, late: run.judge ? run.judge.late : null,
      void: run.void ? run.void.reason : null,
    });
    return true;
  }
  function onStageClick(e) {
    var run = st && st.run;
    if (!run || run.phase !== 'respond' || run.answered || run.demo || !st.v3) return;
    var i = S3.pickNearest(st.v3, st.g.meshes.slice(0, run.item.n), e.clientX, e.clientY, PICK_PX, st.g.cam);
    if (i >= 0) toggle(run, i, 'pointer');
  }

  /* ---------- reveal: the truth in place, ≤ 700 ms ---------- */

  function reveal(item, response, result, ctx) {
    var run = st && st.run;
    if (!run || run.item !== item) return Promise.resolve();
    if (run.popResp) { run.popResp(); run.popResp = null; }
    run.answered = true;
    var found = result && typeof result.value === 'number' ? result.value : 0;
    setPhase(run, 'reveal', result && result.correct ? cap('right', { k: item.k }) : cap('wrong', { found: found, k: item.k }));
    setHint(cap('legend'), 'legend');
    st.confirm.hidden = true;
    if (st.v3) {
      colourTargets(item, true);
      render();
      drawMarks(run, verdictMarks(run, response));
    }
    st.verdict.textContent = (result && result.correct ? '✓ ' : '✗ ') + found + ' of ' + item.k;
    st.verdict.setAttribute('data-kind', result && result.correct ? 'right' : 'wrong');
    st.verdict.hidden = false;
    if (run.void) showVoid(run);
    return timing.wait(ctx && ctx.fast ? 0 : 250);
  }

  /* ---------- show me: replay with the targets marked, then the picks against the targets ---------- */

  // The moment (tracking time) when a sphere of `as` and one of `bs` come closest in the image,
  // measured as the gap between centres over the sum of the projected radii (every second step).
  function closestCall(item, as, bs) {
    var sim = lib.sim(item), best = { t: 0, a: as[0], b: bs[0], gap: Infinity };
    for (var k = 0; k <= sim.steps; k += 2) {
      sim.stepTo(k);
      var t = k / lib.HZ, pr = lib.project(lib.camAz(item, t), sim.p, item.n);
      for (var x = 0; x < as.length; x++) {
        for (var y = 0; y < bs.length; y++) {
          var a = pr[as[x]], b = pr[bs[y]];
          var gap = Math.sqrt((a.x - b.x) * (a.x - b.x) + (a.y - b.y) * (a.y - b.y)) / (a.rad + b.rad);
          if (gap < best.gap) best = { t: t, a: as[x], b: bs[y], gap: gap };
        }
      }
    }
    return best;
  }

  function lab(run, id) { return run.label[id] !== undefined ? run.label[id] : id + 1; }
  // The targets by the numbers on screen, ascending; spoken() lists them: "2, 4, 5 and 7".
  function targetNumbers(run) { return run.item.key.map(function (id) { return lab(run, id); }).sort(function (a, b) { return a - b; }); }
  function spoken(nums) { return nums.length < 2 ? nums.join('') : nums.slice(0, -1).join(', ') + ' and ' + nums[nums.length - 1]; }
  function compareText(run, picked) {
    var item = run.item, found = 0, wrong = 0;
    picked.forEach(function (p) { if (item.key.indexOf(p) >= 0) found++; else wrong++; });
    if (found === item.k) return cap('smAll', { k: item.k });
    return cap('smCompare', { found: found, wrong: wrong, missed: item.k - found });
  }

  function showSteps(run, response) {
    var item = run.item, key = item.key, picked = Array.isArray(response) ? response : [], i;
    var missed = key.filter(function (k) { return picked.indexOf(k) < 0; });
    var wrong = picked.filter(function (p) { return key.indexOf(p) < 0; });
    var others = [];
    for (i = 0; i < item.n; i++) if (key.indexOf(i) < 0) others.push(i);
    var swap = missed.length > 0 && wrong.length > 0;
    var call = swap ? closestCall(item, missed, wrong) : closestCall(item, key, others);
    var D = item.dur, w0 = Math.max(0, call.t - 1.5), w1 = Math.min(D, call.t + 1.5);
    function marked(t) { pose(run, t); ringTargets(run, 'cue'); }
    function focus(t) {
      pose(run, t);
      var m = {};
      key.forEach(function (k) { m[k] = { kind: 'cue' }; });
      m[call.a] = { kind: 'cue', text: String(lab(run, call.a)) };
      m[call.b] = { kind: 'focus', text: String(lab(run, call.b)) };
      drawMarks(run, m);
    }
    var steps = [{
      ms: 1800, caption: cap('smStart', { k: item.k }),
      enter: function () { colourTargets(item, true); marked(0); },
    }];
    if (w0 > 0.15) {
      steps.push({
        ms: Math.min(2600, Math.max(600, w0 / 3 * 1000)), caption: cap('smForward'),
        enter: function () { colourTargets(item, true); }, update: function (k) { marked(k * w0); },
      });
    }
    steps.push({
      ms: Math.max(1200, Math.min(4000, (w1 - w0) / 0.75 * 1000)), // slow motion: 3/4 of real speed
      caption: cap(swap ? 'smSwap' : 'smClose', { a: lab(run, call.a), b: lab(run, call.b) }),
      enter: function () { colourTargets(item, true); }, update: function (k) { focus(w0 + k * (w1 - w0)); },
    });
    if (D - w1 > 0.15) {
      steps.push({
        ms: Math.min(2600, Math.max(600, (D - w1) / 3 * 1000)), caption: cap('smToEnd'),
        enter: function () { colourTargets(item, true); }, update: function (k) { marked(w1 + k * (D - w1)); },
      });
    }
    steps.push({
      ms: 2600, caption: compareText(run, picked),
      enter: function () { colourTargets(item, true); pose(run, D); drawMarks(run, verdictMarks(run, picked)); },
    });
    return steps;
  }

  // Minimal step runner for players without ctx.play (no controls; honours fast).
  function runSteps(list, ctx, opts) {
    var scale = ctx && ctx.fast ? 0.02 : 1;
    return new Promise(function (resolve) {
      var i = -1, start = 0, first = true;
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
        if (first) { first = false; if (!begin(now)) return false; }
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
    var run = st && st.run;
    if (!run || run.item !== item || !st.v3) return Promise.resolve();
    var picked = Array.isArray(response) ? response : [];
    setPhase(run, 'showme');
    return play(showSteps(run, picked), ctx, { name: 'show-me' }).then(function () {
      if (st && st.run === run) {
        setPhase(run, 'reveal');
        colourTargets(item, true);
        pose(run, item.dur);
        drawMarks(run, verdictMarks(run, picked));
      }
    });
  }

  // Tutorial: the whole trial once more with captions. It ends the way a right answer ends: the
  // targets in their colour, each marked ✓ with its number as in the reveal, and the caption
  // names them; that last step holds 3 s (2.25 s with reduced motion, where steps run at 75 %),
  // and stays on screen after the demo until the first pick (run.shown). Picks and Confirm wait
  // while it plays (run.demo), so no answer is lost mid-demo.
  function demo(item, ctx, caption) {
    var run = st && st.run;
    if (!run || run.item !== item || !st.v3) return Promise.resolve();
    var D = item.dur;
    var list = [
      { ms: 2200, caption: cap('dSpheres', { n: item.n }), enter: function () { colourTargets(item, false); pose(run, 0); clearMarks(run); } },
      { ms: 2400, caption: cap('dTargets', { k: item.k }), enter: function () { colourTargets(item, true); pose(run, 0); ringTargets(run, 'cue'); } },
      { ms: D * 1000, caption: cap('dFollow'), enter: function () { colourTargets(item, false); clearMarks(run); }, update: function (k) { pose(run, k * D); } },
      { ms: 2400, caption: cap('dPick', { k: item.k }), enter: function () { colourTargets(item, false); pose(run, D); responseMarks(run); } },
      {
        ms: DEMO_END_MS, caption: cap('dAnswer', { k: item.k, list: spoken(targetNumbers(run)) }),
        enter: function () { colourTargets(item, true); pose(run, D); drawMarks(run, verdictMarks(run, item.key)); run.shown = true; },
      },
    ];
    run.demo = true;
    st.confirm.disabled = true;
    return play(list, ctx, { name: 'demo', caption: caption || null }).then(function () {
      run.demo = false;
      if (st && st.run === run && run.phase === 'respond' && !run.answered) {
        st.confirm.disabled = run.picks.length !== run.item.k;
        st.phaseText.textContent = pickText(run);
      }
    });
  }

  /* ---------- mount ---------- */

  function mount(ctx) {
    var root = h('div.ex-track-root');
    var stage = h('div.ex-stage.ex-track-stage');
    var label = h('span.ex-label', 'Track');
    var overlay = h('div.ex-track-overlay', { 'aria-hidden': 'true' });
    var verdict = h('div.ex-verdict.ex-track-verdict', { hidden: true, role: 'status' });
    var pauseBtn = PX.ui.button('Pause', { kind: 'secondary', small: true, key: 'Escape', className: 'ex-track-pause', onClick: function () { togglePause(st && st.run); } });
    var resumeBtn = PX.ui.button('Resume', { kind: 'primary', key: 'Escape', onClick: function () { togglePause(st && st.run); } });
    var pauseBox = h('div.ex-track-paused', { hidden: true, role: 'status' }, h('p', cap('paused')), resumeBtn);
    var startBtn = PX.ui.button('Start', { kind: 'primary', key: 'Enter', onClick: function () { startFromNotice(st && st.run); } });
    var noticeText = h('p.ex-track-notice-text');
    var notice = h('div.ex-track-notice', { hidden: true, role: 'group', 'aria-label': 'Before the first trial' }, h('span.ex-track-notice-icon', { 'aria-hidden': 'true' }, '◎'), noticeText, startBtn);
    [label, overlay, verdict, pauseBtn, pauseBox, notice].forEach(function (x) { stage.appendChild(x); });
    pauseBtn.hidden = true;
    var voidBox = h('p.ex-track-void', { hidden: true, role: 'status' });
    var phaseText = h('p.ex-track-phase', { 'aria-live': 'polite' });
    var hint = h('span.ex-track-keys');
    var confirmBtn = PX.ui.button('Confirm', { kind: 'primary', key: 'Enter', className: 'ex-track-confirm', onClick: function () { confirm(st && st.run, 'pointer'); } });
    confirmBtn.hidden = true;
    var bar = h('div.ex-track-bar', h('div.ex-track-status', phaseText, hint), confirmBtn);
    var caption = h('p.ex-caption', { 'aria-live': 'polite' });
    var desc = h('p.px-sr');
    [stage, voidBox, bar, caption, desc].forEach(function (x) { root.appendChild(x); });
    ctx.host.appendChild(root);
    st = {
      ctx: ctx, root: root, stage: stage, label: label, overlay: overlay, verdict: verdict, pauseBtn: pauseBtn,
      resumeBtn: resumeBtn, pauseBox: pauseBox, startBtn: startBtn, noticeText: noticeText, notice: notice,
      voidBox: voidBox, phaseText: phaseText, hint: hint, confirm: confirmBtn, caption: caption, desc: desc,
      v3: null, g: null, run: null, offs: [],
    };
    if (!S3.available()) {
      stage.appendChild(h('p.ex-unavailable', { role: 'alert' }, 'This exercise needs 3D graphics, which are not available here: ' + S3.reason() + '.'));
      return;
    }
    st.v3 = S3.attach(stage);
    st.v3.redraw = redraw;
    st.g = buildScene();
    stage.addEventListener('click', onStageClick);
    st.offs.push(PX.bus.on('stage3d:theme', themeChanged));
    st.offs.push(function () { stage.removeEventListener('click', onStageClick); });
    // Warm-up: compile the shaders now, not in the first trial.
    relayout();
    setCamera(0);
    S3.compile(st.g.scene, st.g.cam);
  }

  function unmount() {
    if (!st) return;
    cancelRun();
    st.offs.forEach(function (off) { off(); });
    if (st.g) {
      st.g.meshes.forEach(function (m) { S3.disposeTree(m); });
      S3.disposeTree(st.g.probes.sphere);
      S3.disposeTree(st.g.probes.target);
      [st.g.cube, st.g.floor].forEach(function (o) { o.geometry.dispose(); o.material.dispose(); });
    }
    if (st.v3) st.v3.detach();
    if (st.root.parentNode) st.root.parentNode.removeChild(st.root);
    st = null;
  }

  /* ---------- test helpers ---------- */

  function phase() { return st && st.run ? st.run.phase : 'idle'; }
  // The spheres on screen (client px) with their numbers, for pointer tests.
  function points() {
    var run = st && st.run;
    if (!run || !st.v3) return [];
    var rect = st.v3.canvas.getBoundingClientRect(), out = [];
    for (var i = 0; i < run.item.n; i++) {
      var s = screenOf(i);
      out.push({ id: i, n: run.label[i] || null, x: rect.left + s.x, y: rect.top + s.y, r: s.r });
    }
    return out;
  }
  function picks() { return st && st.run ? st.run.picks.slice().sort(function (a, b) { return a - b; }) : []; }
  function trialInfo() {
    var run = st && st.run;
    return run ? {
      phase: run.phase, void: run.void, frames: run.frames, judge: run.judge || null, input: run.input,
      order: run.order.slice(), noticeSeen: noticeSeen, shown: !!run.shown,
      coloured: st.g ? st.g.meshes.filter(function (m, i) { return i < run.item.n && m.material === st.g.mat.target; }).length : 0,
    } : null;
  }
  // The meta confirm() sends, for an answer that reaches the player another way (PX.debug.answer).
  function answerMeta() {
    var run = st && st.run;
    return run ? { frames: run.frames, jump: run.judge ? run.judge.jump : null, late: run.judge ? run.judge.late : null, void: run.void ? run.void.reason : null } : null;
  }

  PX.ex.view('track', {
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
    phase: phase,
    points: points,
    picks: picks,
    trialInfo: trialInfo,
    answerMeta: answerMeta,
    steps: function (item, response) { return st && st.run && st.run.item === item ? showSteps(st.run, response) : []; },
  });
})(window.PX);
