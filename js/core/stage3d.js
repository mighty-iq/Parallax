/* PX.core.stage3d: the one WebGL renderer of the app (ARCHITECTURE.md §4, spike/RESULTS.md).
   A page gets 16 WebGL contexts and the 17th silently kills the oldest, so exercises never
   create a WebGLRenderer: they own Scenes and Cameras and draw through this module.

   available() → boolean        three.js loaded and a WebGL 2 context starts (created lazily, once)
   reason() → string            why 3D is unavailable ('' when it is available)
   renderer() → WebGLRenderer | null
   attach(container) → view     moves the one canvas into container (absolutely filling it); a
                                second attach detaches the first view. view = {
                                  container, canvas, scene, camera (PerspectiveCamera 30°),
                                  width, height (CSS px), resize() → changed?, render(scene?, camera?),
                                  renderTiles([{ scene, camera, x, y, w, h }]) (CSS px, y from top),
                                  redraw: null | fn (set it: called after a theme change, a resize
                                  or a context restore), detach() }
   snapshot(scene, camera, w, h, opts?) → HTMLCanvasElement (2D, w × h CSS px at the stage pixel
                                ratio). Renders offscreen (MSAA sRGB target) and copies the pixels
                                synchronously: 7–21 ms each in software rendering, so call it in
                                the ready phase (drawOption), never during a stimulus phase.
                                opts: { canvas (reuse), pixelRatio, fluid (no inline CSS size),
                                transparent (no background: the page shows through) }
   compile(scene, camera)       warm-up (shader compile) at mount, so the first trial is not slow
   loop                         PX.core.timing.loop (motion from rAF timestamps)
   Builders (shared, theme-aware materials; dispose geometry with disposeTree(obj)):
     cubeGroup(cells, opts) → THREE.Group   unit cubes with dark outline bars, Shepard–Metzler look.
        opts: { center: true (centroid at the origin) | [x, y, z] offset, highlight: [cell indices],
                edge: 0.05 (outline bar width in cube units) }. group.setHighlight(indices,
        { fade }) colours those cubes with --stim-target (fade: the other cubes turn pale),
        group.userData = { n, center: [x, y, z], radius (bounding sphere of all corners) }.
     sphere(radius, kind) → Mesh (kind 'sphere' | 'target')   wireBox(size) → LineSegments
     lights(scene)              the standard flat-shading rig (light fixed to the viewer)
     colors() → { ground, face, face2, face3, edge, sphere, target } (THREE.Color, from --stim-*)
     refreshTheme()             re-reads the CSS tokens, recolours shared materials, emits
                                'stage3d:theme' and redraws the attached view
   Picking (Track spheres are 26–31 px on phones):
     project(view, point) → { x, y, depth } in CSS px inside the view's canvas
     pickNearest(view, items, clientX, clientY, maxPx = 36) → index | -1: the nearest item whose
        projected centre (minus its projected radius) lies within maxPx of the tap. items:
        THREE.Vector3 | Object3D | { position, radius }.
   Robustness:
     webglcontextlost → 'stage3d:lost' on PX.bus (timing.monitor marks the phase as stuttered:
        the trial is void); webglcontextrestored → 'stage3d:restored' and the view is redrawn;
        no restore within 3 s → 'stage3d:dead' (offer restart()). isLost(), restart().
     Quality: DPR capped at 2; antialiasing off when DPR ≥ 2 or the screen is phone-sized (fixed at
        context creation). noteTrial(stuttered): after two stuttered trials the stage steps down
        to DPR 1 without antialiasing ('stage3d:quality'; Settings shows quality()). setQuality(
        'auto' | 'low') does it by hand. A step-down recreates the canvas, so re-read view.canvas.
   A live WebGL canvas prints blank: guide figures are PNG files (snapshot → toDataURL). */
(function (PX) {
  'use strict';

  var win = window;
  var doc = win.document;
  var T = win.THREE || null;
  var bus = PX.bus;

  var FOV = 30;                 // degrees; low perspective like the classic drawings
  var PICK_PX = 36;             // CSS px: nearest object within this distance of a tap
  var DEAD_MS = 3000;           // no restore after this long: offer a restart
  var STEP_DOWN_AFTER = 2;      // stuttered trials before quality steps down

  var FALLBACK = {              // used when css/base.css (or a token) is missing
    light: { ground: '#F7F8F7', face: '#ECEEF0', face2: '#C9CED3', face3: '#A4ABB2', edge: '#22262A', sphere: '#C3C8CC', target: '#0B6A86' },
    dark: { ground: '#2A3035', face: '#D9DDE0', face2: '#AEB5BB', face3: '#899199', edge: '#101315', sphere: '#AAB1B8', target: '#5CC6E0' },
  };
  var TOKENS = { ground: '--stim-ground', face: '--stim-face', face2: '--stim-face-2', face3: '--stim-face-3', edge: '--stim-edge', sphere: '--stim-sphere', target: '--stim-target' };

  var R = null;                 // the WebGLRenderer
  var why = '';                 // reason when unavailable
  var probed = false;
  var lost = false, deadTimer = 0, tearingDown = false;
  var attached = null;          // the current view
  var rt = null, rtBuf = null;  // snapshot target and read buffer
  var qual = { level: 'high', forced: false, stutters: 0, dpr: 1, antialias: false };
  var palette = null;           // THREE.Color values
  var mats = null;              // shared materials

  /* ---------- environment ---------- */

  function devicePR() { return Math.max(1, win.devicePixelRatio || 1); }
  function phoneSized() {
    var s = win.screen;
    var short = s && s.width && s.height ? Math.min(s.width, s.height) : Math.min(win.innerWidth || 1024, win.innerHeight || 768);
    return short < 600;
  }
  function pixelRatio() { return qual.level === 'low' ? 1 : Math.min(devicePR(), 2); }
  function emit(evt, data) { if (bus) bus.emit(evt, data); }

  /* ---------- theme ---------- */

  function darkTheme() {
    var html = doc.documentElement, t = html.getAttribute('data-theme');
    if (t === 'dark') return true;
    if (t === 'light') return false;
    try { return !!(win.matchMedia && win.matchMedia('(prefers-color-scheme: dark)').matches); } catch (e) { return false; }
  }

  function readPalette() {
    var cs = null;
    try { cs = win.getComputedStyle(doc.documentElement); } catch (e) { cs = null; }
    var fb = darkTheme() ? FALLBACK.dark : FALLBACK.light, out = {};
    for (var k in TOKENS) {
      var v = cs ? String(cs.getPropertyValue(TOKENS[k]) || '').trim() : '';
      var c = new T.Color();
      try { c.setStyle(v || fb[k]); } catch (e) { c.setStyle(fb[k]); }
      out[k] = c;
    }
    return out;
  }

  function colors() {
    if (!T) return null;
    if (!palette) palette = readPalette();
    return palette;
  }

  // Highlighted cubes: --stim-target with some self-light, so shaded faces stay saturated.
  // Faded cubes (the rest of a figure while a part is highlighted) are unlit and pale: a flat
  // line drawing next to the shaded highlight, so contrast is a cue besides colour.
  function highlightTone(c) { return c.target.clone(); }
  function fadedTone(c) { return c.face.clone().lerp(c.ground, 0.35); }

  function materials() {
    if (mats) return mats;
    var c = colors(), hl = highlightTone(c);
    // polygonOffset pushes faces back so the outline bars never z-fight with them.
    var face = { polygonOffset: true, polygonOffsetFactor: 1, polygonOffsetUnits: 1 };
    mats = {
      face: new T.MeshLambertMaterial(Object.assign({ color: c.face.clone() }, face)),
      highlight: new T.MeshLambertMaterial(Object.assign({ color: hl, emissive: hl.clone().multiplyScalar(0.45) }, face)),
      faded: new T.MeshBasicMaterial(Object.assign({ color: fadedTone(c) }, face)),
      edge: new T.MeshBasicMaterial({ color: c.edge.clone() }),
      line: new T.LineBasicMaterial({ color: c.edge.clone() }),
      sphere: new T.MeshLambertMaterial({ color: c.sphere.clone() }),
      target: new T.MeshLambertMaterial({ color: c.target.clone() }),
    };
    return mats;
  }

  function refreshTheme() {
    if (!T) return;
    palette = readPalette();
    if (mats) {
      mats.face.color.copy(palette.face);
      var hl = highlightTone(palette);
      mats.highlight.color.copy(hl);
      mats.highlight.emissive.copy(hl).multiplyScalar(0.45);
      mats.faded.color.copy(fadedTone(palette));
      mats.edge.color.copy(palette.edge);
      mats.line.color.copy(palette.edge);
      mats.sphere.color.copy(palette.sphere);
      mats.target.color.copy(palette.target);
    }
    emit('stage3d:theme', { dark: darkTheme() });
    redrawAttached();
  }

  /* ---------- renderer ---------- */

  function onLost(e) {
    if (e && e.preventDefault) e.preventDefault(); // allows the browser to restore the context
    if (tearingDown) return;
    lost = true;
    emit('stage3d:lost', {});
    if (deadTimer) win.clearTimeout(deadTimer);
    deadTimer = win.setTimeout(function () { deadTimer = 0; if (lost) emit('stage3d:dead', {}); }, DEAD_MS);
  }
  function onRestored() {
    if (tearingDown) return;
    lost = false;
    if (deadTimer) { win.clearTimeout(deadTimer); deadTimer = 0; }
    if (rt) { rt.dispose(); rt = null; } // targets belong to the old context
    emit('stage3d:restored', {});
    redrawAttached();
  }

  function create() {
    var canvas = doc.createElement('canvas');
    canvas.className = 'px-stage3d-canvas';
    canvas.setAttribute('aria-hidden', 'true'); // views describe the stimulus in text next to it
    canvas.style.cssText = 'position:absolute;inset:0;display:block;width:100%;height:100%;touch-action:manipulation';
    var aa = qual.level !== 'low' && devicePR() < 2 && !phoneSized();
    var r = new T.WebGLRenderer({ canvas: canvas, antialias: aa, alpha: false, powerPreference: 'default' });
    var gl = r.getContext();
    if (!gl || typeof gl.texImage3D !== 'function') {
      try { r.dispose(); } catch (e) { /* ignore */ }
      throw new Error('WebGL 2 is not available');
    }
    r.setPixelRatio(pixelRatio());
    r.outputColorSpace = T.SRGBColorSpace;
    canvas.addEventListener('webglcontextlost', onLost, false);
    canvas.addEventListener('webglcontextrestored', onRestored, false);
    qual.dpr = pixelRatio();
    qual.antialias = !!(gl.getContextAttributes && gl.getContextAttributes().antialias);
    return r;
  }

  function probe() {
    if (probed) return R;
    probed = true;
    if (!T || typeof T.WebGLRenderer !== 'function') { why = 'three.js did not load'; return null; }
    if (!doc || !doc.createElement) { why = 'no document'; return null; }
    try { R = create(); } catch (e) {
      R = null;
      why = '3D needs WebGL 2, which did not start here' + (e && e.message ? ' (' + e.message + ')' : '');
    }
    return R;
  }

  function available() { return !!probe(); }
  function reason() { probe(); return R ? '' : why; }
  function renderer() { return probe(); }
  function isLost() { return lost; }

  // Replaces the renderer (quality step-down or a dead context). The old context is released
  // with forceContextLoss() first: dispose() alone does not free it (spike/RESULTS.md).
  function rebuild() {
    if (!R) return null;
    var old = R, oldCanvas = old.domElement;
    tearingDown = true;
    try { old.forceContextLoss(); } catch (e) { /* already lost */ }
    try { old.dispose(); } catch (e) { /* ignore */ }
    tearingDown = false;
    if (rt) { try { rt.dispose(); } catch (e) { /* ignore */ } rt = null; }
    oldCanvas.removeEventListener('webglcontextlost', onLost, false);
    oldCanvas.removeEventListener('webglcontextrestored', onRestored, false);
    lost = false;
    if (deadTimer) { win.clearTimeout(deadTimer); deadTimer = 0; }
    try { R = create(); } catch (e) { R = null; why = 'the 3D view could not restart (' + e.message + ')'; }
    if (attached) {
      if (oldCanvas.parentNode) oldCanvas.parentNode.removeChild(oldCanvas);
      if (R) {
        attached.canvas = R.domElement;
        attached.container.appendChild(R.domElement);
        attached.width = attached.height = 0; // force resize
        redrawAttached();
      }
    }
    return R;
  }

  function restart() { return rebuild(); }

  function quality() {
    return { level: qual.level, forced: qual.forced, stutters: qual.stutters, dpr: qual.dpr, antialias: qual.antialias };
  }

  function setQuality(level) {
    var want = level === 'low' ? 'low' : 'high';
    qual.forced = level === 'low';
    if (want === qual.level) return quality();
    qual.level = want;
    if (R) rebuild();
    emit('stage3d:quality', quality());
    return quality();
  }

  // The player reports every monitored trial; two stuttered ones step quality down (once).
  function noteTrial(stuttered) {
    if (!stuttered) return quality();
    qual.stutters++;
    if (qual.stutters >= STEP_DOWN_AFTER && qual.level !== 'low') {
      qual.level = 'low';
      if (R) rebuild();
      emit('stage3d:quality', quality());
    }
    return quality();
  }

  /* ---------- views ---------- */

  function redrawAttached() {
    var v = attached;
    if (!v || typeof v.redraw !== 'function' || lost) return;
    try { v.resize(); v.redraw(); } catch (e) { if (win.console) console.error('PX.core.stage3d: redraw failed', e); }
  }

  function aspectFor(camera, w, h) {
    if (camera && camera.isPerspectiveCamera && camera.userData.autoAspect !== false) {
      var a = w / Math.max(1, h);
      if (camera.aspect !== a) { camera.aspect = a; camera.updateProjectionMatrix(); }
    }
  }

  function attach(container) {
    if (!probe() || !container) return null;
    if (attached) attached.detach();
    try { if (win.getComputedStyle(container).position === 'static') container.style.position = 'relative'; } catch (e) { /* detached */ }
    var v = {
      container: container, canvas: R.domElement, width: 0, height: 0, redraw: null, holdResize: false,
      scene: new T.Scene(), camera: new T.PerspectiveCamera(FOV, 1, 0.1, 200),
    };
    v.scene.background = colors().ground.clone();
    lights(v.scene);
    v.camera.position.set(0, 0, 10);
    // Measures the container; returns true when the drawing buffer changed size.
    v.resize = function () {
      if (!R || attached !== v) return false;
      var w = Math.max(1, Math.round(container.clientWidth)), h = Math.max(1, Math.round(container.clientHeight));
      var pr = pixelRatio();
      if (w === v.width && h === v.height && R.getPixelRatio() === pr) return false;
      v.width = w; v.height = h;
      R.setPixelRatio(pr);
      R.setSize(w, h, false); // the canvas is styled to fill the container
      qual.dpr = pr;
      return true;
    };
    v.render = function (scene, camera) {
      if (!R || lost || attached !== v) return;
      scene = scene || v.scene; camera = camera || v.camera;
      if (!v.width) v.resize();
      aspectFor(camera, v.width, v.height);
      R.setScissorTest(false);
      R.setViewport(0, 0, v.width, v.height);
      R.render(scene, camera);
    };
    // Tiles in CSS px with y from the top; each tile is cleared with its scene's background.
    v.renderTiles = function (tiles) {
      if (!R || lost || attached !== v) return;
      if (!v.width) v.resize();
      R.setScissorTest(true);
      for (var i = 0; i < tiles.length; i++) {
        var t = tiles[i], yb = v.height - t.y - t.h;
        R.setViewport(t.x, yb, t.w, t.h);
        R.setScissor(t.x, yb, t.w, t.h);
        aspectFor(t.camera, t.w, t.h);
        R.render(t.scene, t.camera);
      }
      R.setScissorTest(false);
      R.setViewport(0, 0, v.width, v.height);
    };
    v.detach = function () {
      if (attached !== v) return;
      attached = null;
      if (v.canvas && v.canvas.parentNode === container) container.removeChild(v.canvas);
    };
    container.appendChild(R.domElement);
    attached = v;
    v.resize();
    installListeners();
    return v;
  }

  /* ---------- snapshots ---------- */

  function blank(out, W, H) {
    var g = out.getContext('2d'), c = colors();
    g.fillStyle = c ? '#' + c.ground.getHexString() : '#f7f8f7';
    g.fillRect(0, 0, W, H);
    out.setAttribute('data-blank', '1');
    return out;
  }

  function snapshot(scene, camera, w, h, opts) {
    opts = opts || {};
    var pr = opts.pixelRatio > 0 ? opts.pixelRatio : pixelRatio();
    var W = Math.max(1, Math.round(w * pr)), H = Math.max(1, Math.round(h * pr));
    var out = opts.canvas || doc.createElement('canvas');
    if (out.width !== W) out.width = W;
    if (out.height !== H) out.height = H;
    if (!opts.fluid) { out.style.width = w + 'px'; out.style.height = h + 'px'; }
    out.removeAttribute('data-blank');
    if (!probe() || lost) return blank(out, W, H);
    try {
      if (!rt) {
        rt = new T.WebGLRenderTarget(W, H, { samples: qual.antialias ? 4 : 0 });
        rt.texture.colorSpace = T.SRGBColorSpace; // without it the copy comes out too dark
      } else if (rt.width !== W || rt.height !== H) rt.setSize(W, H);
      var oldAspect = camera.isPerspectiveCamera ? camera.aspect : null;
      if (oldAspect !== null) { camera.aspect = W / H; camera.updateProjectionMatrix(); }
      var prev = R.getRenderTarget(), bg = scene.background, cc = null, ca = 1;
      if (opts.transparent) {
        cc = R.getClearColor(new T.Color()); ca = R.getClearAlpha();
        scene.background = null;
        R.setClearColor(0x000000, 0);
      }
      R.setRenderTarget(rt);
      R.render(scene, camera);
      R.setRenderTarget(prev);
      if (opts.transparent) { scene.background = bg; R.setClearColor(cc, ca); }
      if (oldAspect !== null) { camera.aspect = oldAspect; camera.updateProjectionMatrix(); }
      if (!rtBuf || rtBuf.length !== W * H * 4) rtBuf = new Uint8Array(W * H * 4);
      R.readRenderTargetPixels(rt, 0, 0, W, H, rtBuf);
      var g = out.getContext('2d'), img = g.createImageData(W, H), row = W * 4, px = img.data;
      for (var y = 0; y < H; y++) px.set(rtBuf.subarray((H - 1 - y) * row, (H - y) * row), y * row);
      if (opts.transparent) {
        // Antialiased edges come out premultiplied by their coverage; ImageData is straight alpha.
        for (var i = 0; i < px.length; i += 4) {
          var a = px[i + 3];
          if (a > 0 && a < 255) { px[i] = Math.min(255, px[i] * 255 / a); px[i + 1] = Math.min(255, px[i + 1] * 255 / a); px[i + 2] = Math.min(255, px[i + 2] * 255 / a); }
        }
      }
      g.putImageData(img, 0, 0);
    } catch (e) {
      if (win.console) console.error('PX.core.stage3d.snapshot failed', e);
      return blank(out, W, H);
    }
    return out;
  }

  // Shader compile plus one tiny offscreen render: takes the 80–160 ms first-use cost out of
  // the first trial (spike/RESULTS.md). Call it at mount.
  function compile(scene, camera) {
    if (!probe() || lost) return;
    try { R.compile(scene, camera); snapshot(scene, camera, 16, 16, { fluid: true }); } catch (e) { /* not fatal */ }
  }

  /* ---------- builders ---------- */

  var unitBox = null;
  function box() {
    if (!unitBox) { unitBox = new T.BoxGeometry(1, 1, 1); unitBox.userData.shared = true; }
    return unitBox;
  }

  function lights(scene) {
    // Flat shading with three clearly different face tones; the light is fixed to the viewer,
    // like the shading of the classic drawings. Top faces brightest, the left side darkest.
    var hemi = new T.HemisphereLight(0xffffff, 0x9aa0a6, 1.35);
    var key = new T.DirectionalLight(0xffffff, 1.75);
    key.position.set(0.45, 0.9, 0.55);
    scene.add(hemi, key);
    return scene;
  }

  // cells: [[x, y, z], …] integer lattice positions; one InstancedMesh per material (normal,
  // highlighted) and one for the outline bars, so a figure costs three draw calls.
  function cubeGroup(cells, opts) {
    opts = opts || {};
    var m = materials(), n = cells.length, i;
    var cx = 0, cy = 0, cz = 0;
    for (i = 0; i < n; i++) { cx += cells[i][0]; cy += cells[i][1]; cz += cells[i][2]; }
    cx /= n; cy /= n; cz /= n;
    var off = Array.isArray(opts.center) ? opts.center : opts.center === false ? [0, 0, 0] : [-cx, -cy, -cz];
    var g = new T.Group();
    var normal = new T.InstancedMesh(box(), m.face, n);
    var hi = new T.InstancedMesh(box(), m.highlight, n);
    var mat = new T.Matrix4();
    var radius = 0;
    for (i = 0; i < n; i++) {
      var x = cells[i][0] + off[0], y = cells[i][1] + off[1], z = cells[i][2] + off[2];
      radius = Math.max(radius, Math.sqrt(x * x + y * y + z * z) + 0.8660254037844386);
    }
    // Outline bars: every cube edge once (edges shared by neighbours are merged).
    var w = opts.edge > 0 ? opts.edge : 0.05, seen = {}, bars = [];
    for (i = 0; i < n; i++) {
      var c = cells[i];
      for (var a = 0; a < 3; a++) {
        var b1 = (a + 1) % 3, b2 = (a + 2) % 3;
        for (var s1 = -1; s1 <= 1; s1 += 2) {
          for (var s2 = -1; s2 <= 1; s2 += 2) {
            var p = [2 * c[0], 2 * c[1], 2 * c[2]];
            p[b1] += s1; p[b2] += s2;
            var key = a + ':' + p.join(',');
            if (seen[key]) continue;
            seen[key] = true;
            bars.push([a, p[0] / 2 + off[0], p[1] / 2 + off[1], p[2] / 2 + off[2]]);
          }
        }
      }
    }
    var edges = new T.InstancedMesh(box(), m.edge, bars.length);
    var pos = new T.Vector3(), q = new T.Quaternion(), scl = new T.Vector3();
    for (i = 0; i < bars.length; i++) {
      var e = bars[i];
      scl.set(w, w, w).setComponent(e[0], 1 + w);
      edges.setMatrixAt(i, mat.compose(pos.set(e[1], e[2], e[3]), q, scl));
    }
    edges.instanceMatrix.needsUpdate = true;
    g.add(normal, hi, edges);

    g.setHighlight = function (indices, hopts) {
      var on = {}, k, a2 = 0, b2 = 0;
      normal.material = hopts && hopts.fade && indices && indices.length ? m.faded : m.face;
      (indices || []).forEach(function (ix) { on[ix] = true; });
      for (k = 0; k < n; k++) {
        mat.makeTranslation(cells[k][0] + off[0], cells[k][1] + off[1], cells[k][2] + off[2]);
        if (on[k]) hi.setMatrixAt(b2++, mat); else normal.setMatrixAt(a2++, mat);
      }
      normal.count = a2; hi.count = b2;
      normal.visible = a2 > 0; hi.visible = b2 > 0;
      normal.instanceMatrix.needsUpdate = true; hi.instanceMatrix.needsUpdate = true;
      normal.computeBoundingSphere(); hi.computeBoundingSphere();
      g.userData.highlight = (indices || []).slice();
      return g;
    };
    g.userData = { n: n, center: [cx, cy, cz], offset: off, radius: radius, highlight: [] };
    g.setHighlight(opts.highlight || []);
    edges.computeBoundingSphere();
    return g;
  }

  function sphere(radius, kind) {
    var m = materials();
    return new T.Mesh(new T.SphereGeometry(radius, 32, 16), kind === 'target' ? m.target : m.sphere);
  }

  function wireBox(size) {
    return new T.LineSegments(new T.EdgesGeometry(new T.BoxGeometry(size, size, size)), materials().line);
  }

  // Frees geometry made for this object (shared geometry and shared materials are kept).
  function disposeTree(obj) {
    if (!obj) return;
    var shared = mats ? Object.keys(mats).map(function (k) { return mats[k]; }) : [];
    obj.traverse(function (o) {
      if (o.geometry && !(o.geometry.userData && o.geometry.userData.shared)) o.geometry.dispose();
      if (o.isInstancedMesh && o.dispose) o.dispose();
      var ml = Array.isArray(o.material) ? o.material : o.material ? [o.material] : [];
      ml.forEach(function (mt) { if (shared.indexOf(mt) < 0 && mt.dispose) mt.dispose(); });
    });
    if (obj.parent) obj.parent.remove(obj);
  }

  /* ---------- picking ---------- */

  var tmpV = null;
  function project(view, point, camera) {
    camera = camera || view.camera;
    tmpV = tmpV || new T.Vector3();
    var p = point.isVector3 ? tmpV.copy(point) : point.getWorldPosition ? point.getWorldPosition(tmpV) : tmpV.copy(point.position);
    p.project(camera);
    return { x: (p.x + 1) / 2 * view.width, y: (1 - p.y) / 2 * view.height, depth: p.z };
  }

  // Radius on screen of a world-space sphere at the given point (perspective cameras).
  function screenRadius(view, camera, point, r) {
    if (!(r > 0) || !camera.isPerspectiveCamera) return 0;
    var d = camera.position.distanceTo(point);
    var tanHalf = Math.tan(camera.fov * Math.PI / 360);
    return d > 0 ? r / (d * tanHalf) * (view.height / 2) : 0;
  }

  function pickNearest(view, items, clientX, clientY, maxPx, camera) {
    if (!view || !items || !items.length) return -1;
    camera = camera || view.camera;
    var lim = maxPx > 0 ? maxPx : PICK_PX;
    var rect = view.canvas.getBoundingClientRect();
    var px = clientX - rect.left, py = clientY - rect.top;
    var best = -1, bestD = Infinity, bestZ = Infinity, w = new T.Vector3();
    for (var i = 0; i < items.length; i++) {
      var it = items[i], r = 0;
      if (it.isVector3) w.copy(it);
      else if (it.getWorldPosition) {
        it.getWorldPosition(w);
        if (it.geometry) {
          if (!it.geometry.boundingSphere) it.geometry.computeBoundingSphere();
          var sc = it.getWorldScale ? it.getWorldScale(new T.Vector3()) : { x: 1 };
          r = it.geometry.boundingSphere.radius * Math.abs(sc.x);
        }
      } else { w.copy(it.position); r = it.radius || 0; }
      var s = project(view, w, camera);
      if (s.depth > 1) continue; // behind the camera
      var d = Math.max(0, Math.sqrt((px - s.x) * (px - s.x) + (py - s.y) * (py - s.y)) - screenRadius(view, camera, w, r));
      if (d <= lim && (d < bestD - 0.5 || (Math.abs(d - bestD) <= 0.5 && s.depth < bestZ))) { best = i; bestD = d; bestZ = s.depth; }
    }
    return best;
  }

  /* ---------- listeners ---------- */

  var listening = false, resizeQueued = false;
  function installListeners() {
    if (listening) return;
    listening = true;
    win.addEventListener('resize', function () {
      if (resizeQueued) return;
      resizeQueued = true;
      (win.requestAnimationFrame || win.setTimeout)(function () {
        resizeQueued = false;
        if (attached && !attached.holdResize && attached.resize()) redrawAttached();
      });
    });
    try {
      var mq = win.matchMedia && win.matchMedia('(prefers-color-scheme: dark)');
      if (mq && mq.addEventListener) mq.addEventListener('change', refreshTheme);
      else if (mq && mq.addListener) mq.addListener(refreshTheme);
    } catch (e) { /* no media queries: the theme only changes through refreshTheme() */ }
  }

  PX.core.stage3d = {
    available: available, reason: reason, renderer: renderer, isLost: isLost, restart: restart,
    attach: attach, snapshot: snapshot, compile: compile, loop: PX.core.timing ? PX.core.timing.loop : null,
    cubeGroup: cubeGroup, sphere: sphere, wireBox: wireBox, lights: lights, disposeTree: disposeTree,
    colors: colors, refreshTheme: refreshTheme, project: project, pickNearest: pickNearest,
    quality: quality, setQuality: setQuality, noteTrial: noteTrial, pixelRatio: pixelRatio,
    current: function () { return attached; },
    FOV: FOV, PICK_PX: PICK_PX,
  };
})(window.PX);
