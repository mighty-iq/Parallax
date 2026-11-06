/* EX-02 Rotate: view (DOM and 3D through PX.core.stage3d; ARCHITECTURE.md §6).
   layout 'stem+options': the player draws the choice grid (samediff: Same / Mirror; pick: four
   figure thumbnails), calls drawOption for every option in the ready phase (grid laid out but
   hidden), then present, and shows the grid in the same frame as the stem.
   - Everything is drawn from the item's model (cells + quaternions, def.lib): what is graded is
     what is shown, and show-me turns exactly the reference into the option's orientation.
   - Thumbnails are stage3d snapshots made in drawOption (ready phase), never while the answer
     clock runs; the stem is one live canvas (two scissor tiles for samediff).
   - showMe / demo build a list of steps and hand them to ctx.play(steps, opts), the player's
     step runner (Pause, Step, Replay, fast, reduced motion; tests/dev/harness.js has the
     reference implementation). Without ctx.play a minimal runner without controls is used.
   - Extra view fields: needs 'webgl' (the player shows the reason instead of a crash when 3D
     is unavailable), optionLabel(item, i) for the grid's accessible names, gridCols(item). */
(function (PX) {
  'use strict';

  var win = window, T = win.THREE, S3 = PX.core.stage3d, timing = PX.core.timing, U = PX.util;
  var h = PX.ui.h;
  var def = PX.ex.get('rotate'), lib = def.lib;
  var st = null; // the mounted view's state (the player mounts one exercise at a time)

  function learn() { return PX.ex.learn('rotate') || {}; }
  function cap(key, n) { return String((learn().captions || {})[key] || '').replace('{n}', n); }

  /* ---------- tiles: a scene, a camera and the figure groups ---------- */

  function tile() {
    var scene = new T.Scene();
    scene.background = S3.colors().ground.clone();
    S3.lights(scene);
    return { scene: scene, cam: new T.PerspectiveCamera(lib.FOV, 1, 0.1, 500), groups: [null, null] };
  }

  // The camera of the validator's model (gen.js): on +z at lib.distance(radius), the same
  // perspective as the model. Framing (lib.frameTan, lib.outline) only narrows the field of view
  // (tanV: tangent of the vertical half angle) and shifts the image plane so the centre of the
  // picture's outline box lands at (0, dy) of the frame (normalised, y up): the picture is
  // scaled and moved, never changed.
  function place(t, radius, aspect, tanV, box, dy) {
    var c = t.cam, D = lib.distance(radius);
    c.fov = 2 * Math.atan(tanV) * 180 / Math.PI;
    c.aspect = aspect;
    c.position.set(0, 0, D);
    c.up.set(0, 1, 0);
    c.lookAt(0, 0, 0);
    c.near = Math.max(0.1, D - 2 * radius);
    c.far = D + 2 * radius;
    // The outline's centre in the frame's normalised coordinates; three.js shifts the image
    // plane by offset / full size (and sets aspect = full width / full height).
    var k = lib.TAN_HALF / tanV;
    var cx = box ? (box[0] + box[2]) / 2 * k / aspect : 0, cy = box ? (box[1] + box[3]) / 2 * k : 0;
    c.setViewOffset(2 * aspect, 2, cx * aspect, (dy || 0) - cy, 2 * aspect, 2); // also updates the projection
  }

  // Outlines of the item's pictures (lib.outline), computed once per item: the reference, each
  // figure, and everything show-me's turns pass through (one fixed frame for a whole turn: the
  // camera does not follow the figure while it turns).
  function boxes(item) {
    if (st.boxItem === item) return st.boxes;
    var r = item.radius, turn = [];
    item.figs.forEach(function (f, k) { turn = turn.concat(lib.turnOutlines(item, k)); });
    st.boxItem = item;
    st.boxes = {
      ref: lib.outline(item.shapes[0], item.ref.q, r),
      figs: item.figs.map(function (f) { return lib.outline(item.shapes[f.s], f.q, r); }),
      turn: lib.unionOutline(turn),
    };
    return st.boxes;
  }

  function setQ(g, q) { g.quaternion.set(q[0], q[1], q[2], q[3]); }
  function quat(q) { return new T.Quaternion(q[0], q[1], q[2], q[3]); }

  // Replaces a tile's figure groups with the item's two shapes (the original and the mirror).
  function fill(t, item) {
    for (var s = 0; s < 2; s++) {
      if (t.groups[s]) S3.disposeTree(t.groups[s]);
      t.groups[s] = S3.cubeGroup(item.shapes[s]);
      t.groups[s].visible = false;
      t.scene.add(t.groups[s]);
    }
  }
  // A highlight always comes with the rest of the figure faded: contrast, not only colour.
  var FADE = { fade: true };
  function show(t, s, q, highlight) {
    t.groups[0].visible = s === 0;
    t.groups[1].visible = s === 1;
    setQ(t.groups[s], q);
    t.groups[s].setHighlight(highlight || [], FADE);
    return t.groups[s];
  }
  function dropTile(t) {
    if (!t) return;
    t.groups.forEach(function (g) { if (g) S3.disposeTree(g); });
    t.groups = [null, null];
  }

  /* ---------- drawing ---------- */

  // The stage's labels sit over the top of its tiles: pictures are framed in the part below
  // them (CSS px from the top; measured once per stage height).
  function labelBand(H) {
    if (st.bandH !== H) {
      var l = st.labels.ref;
      st.band = l && l.offsetHeight ? Math.min(H / 4, l.offsetTop + l.offsetHeight + 4) : 0;
      st.bandH = H;
    }
    return st.band;
  }

  // Trial: the reference centred and as large as its frame allows; samediff's two figures at
  // one scale. Show-me ('explain'): the frame of the whole turn, the compare figure at its scale.
  function render() {
    if (!st || !st.v3 || !st.item) return;
    var v = st.v3, item = st.item, W = v.width, H = v.height, b = boxes(item);
    if (!W || !H) { v.resize(); W = v.width; H = v.height; }
    var left = st.mode === 'explain' ? b.turn : b.ref, tanV;
    var top = labelBand(H), Hu = H - top, dy = -top / H; // the frame below the labels
    if (item.variant === 'samediff') {
      var w2 = Math.floor(W / 2);
      tanV = lib.frameTan([left, b.figs[0]], Math.min(w2, W - w2) / Hu) * H / Hu;
      place(st.tiles[0], item.radius, w2 / H, tanV, left, dy);
      place(st.tiles[1], item.radius, (W - w2) / H, tanV, b.figs[0], dy);
      v.renderTiles([
        { scene: st.tiles[0].scene, camera: st.tiles[0].cam, x: 0, y: 0, w: w2, h: H },
        { scene: st.tiles[1].scene, camera: st.tiles[1].cam, x: w2, y: 0, w: W - w2, h: H },
      ]);
    } else {
      place(st.tiles[0], item.radius, W / H, lib.frameTan([left], W / Hu) * H / Hu, left, dy);
      v.renderTiles([{ scene: st.tiles[0].scene, camera: st.tiles[0].cam, x: 0, y: 0, w: W, h: H }]);
    }
  }

  // Option i of a pick item as a 2D canvas (w × h CSS px); highlight = cell indices. The four
  // options share one scale (the largest fills its picture), each centred on its outline.
  function snapshotFig(item, i, w, hgt, highlight, canvas) {
    var o = st.opt, f = item.figs[i], b = boxes(item);
    show(o, f.s, f.q, highlight);
    place(o, item.radius, w / hgt, lib.frameTan(b.figs, w / hgt), b.figs[i]);
    // transparent: the choice cell's own background (and its right/wrong wash) shows through
    return S3.snapshot(o.scene, o.cam, w, hgt, { fluid: true, canvas: canvas, transparent: true });
  }

  function themeChanged() {
    if (!st) return;
    var g = S3.colors().ground;
    st.tiles.concat([st.opt]).forEach(function (t) { if (t) t.scene.background.copy(g); });
    render();
    // Thumbnails are pictures: repaint them in the new colours (outside any stimulus phase).
    if (st.item && st.item.variant === 'pick') {
      st.opts.forEach(function (o, i) { if (o) snapshotFig(st.item, i, o.w, o.w, o.hi, o.canvas); });
    }
  }

  function describe(item) {
    return item.variant === 'samediff'
      ? 'Two figures of ' + item.n + ' cubes each. Is the right one the left one turned, or its mirror image?'
      : 'A reference figure of ' + item.n + ' cubes and four options. Two options are the reference turned; two are its mirror image.';
  }

  /* ---------- view functions ---------- */

  function mount(ctx) {
    var root = h('div.ex-rotate-stem');
    var stage = h('div.ex-stage.ex-rotate-stage');
    var labels = {
      ref: h('span.ex-label.ex-rotate-label--ref', 'Reference'),
      cmp: h('span.ex-label.ex-rotate-label--cmp', 'Compare'),
    };
    var divider = h('span.ex-rotate-divider', { 'aria-hidden': 'true' });
    var verdict = h('div.ex-verdict.ex-rotate-verdict', { hidden: true, role: 'status' });
    var caption = h('p.ex-caption', { 'aria-live': 'polite' });
    var desc = h('p.px-sr');
    stage.appendChild(labels.ref); stage.appendChild(labels.cmp); stage.appendChild(divider);
    // Under the stage, never over the figures: the caption (show me) and the verdict (reveal).
    root.appendChild(stage);
    root.appendChild(h('div.ex-rotate-under', caption, verdict));
    root.appendChild(desc);
    ctx.host.appendChild(root);
    st = { ctx: ctx, root: root, stage: stage, labels: labels, verdict: verdict, caption: caption, desc: desc,
      v3: null, tiles: [], opt: null, item: null, optItem: null, opts: [], offs: [], mode: 'trial', boxItem: null, boxes: null,
      band: 0, bandH: -1 };
    if (!S3.available()) {
      stage.appendChild(h('p.ex-unavailable', { role: 'alert' }, 'This exercise needs 3D graphics, which are not available here: ' + S3.reason() + '.'));
      return;
    }
    st.v3 = S3.attach(stage);
    st.v3.redraw = render;
    st.tiles = [tile(), tile()];
    st.opt = tile();
    st.offs.push(PX.bus.on('stage3d:theme', themeChanged));
    // Warm-up: compile the shaders and touch the snapshot path now, not in the first trial.
    var g = S3.cubeGroup([[0, 0, 0], [1, 0, 0]]);
    st.opt.scene.add(g);
    place(st.opt, 2, 1, lib.TAN_HALF, null);
    S3.compile(st.opt.scene, st.opt.cam);
    S3.disposeTree(g);
  }

  function present(item, ctx) {
    if (!st) mount(ctx);
    newItem(item);
    st.item = item;
    st.mode = 'trial';
    st.root.setAttribute('data-variant', item.variant);
    st.verdict.hidden = true;
    st.verdict.textContent = '';
    st.caption.textContent = '';
    st.desc.textContent = describe(item);
    st.labels.cmp.hidden = item.variant !== 'samediff';
    st.root.classList.remove('is-revealed');
    if (!st.v3) return timing.nextPaint();
    fill(st.tiles[0], item);
    show(st.tiles[0], 0, item.ref.q);
    if (item.variant === 'samediff') {
      fill(st.tiles[1], item);
      show(st.tiles[1], item.figs[0].s, item.figs[0].q);
    } else dropTile(st.tiles[1]);
    st.v3.resize();
    render();
    return timing.nextPaint();
  }

  // An L-shaped glyph beside the same glyph or its mirror image: the meaning is in the shape.
  function sameMirrorIcon(mirror) {
    var S = PX.core.svg, d = 'M2 2h5v11h6v5H2z';
    var svg = S.svg(40, 20, { width: 40, height: 20, class: 'ex-glyph' });
    svg.appendChild(S.el('path', { d: d, class: 'ex-glyph-a' }));
    svg.appendChild(S.el('path', { d: d, class: 'ex-glyph-b', transform: mirror ? 'translate(40 0) scale(-1 1)' : 'translate(22 0)' }));
    return svg;
  }

  // drawOption runs in the ready phase, before present: the first call for a new item sets up
  // the offscreen option scene for that item.
  function newItem(item) {
    if (st.optItem === item) return;
    st.optItem = item;
    st.opts = [];
    if (st.v3 && item.variant === 'pick') fill(st.opt, item);
  }

  function drawOption(el, item, i, ctx) {
    if (!st) mount(ctx);
    newItem(item);
    if (item.variant === 'samediff') {
      el.appendChild(h('span.ex-answer', sameMirrorIcon(i === 1),
        h('span.ex-answer-text', i === 0 ? 'Same' : 'Mirror')));
      return;
    }
    var w = Math.max(72, Math.min(320, Math.round(el.clientWidth || 150)));
    var tag = h('span.ex-tag', { hidden: true });
    var canvas = st.v3 ? snapshotFig(item, i, w, w, []) : h('canvas', { width: w, height: w });
    canvas.className = 'ex-thumb';
    canvas.setAttribute('aria-hidden', 'true');
    el.appendChild(h('span.ex-opt', canvas, tag));
    st.opts[i] = { el: el, canvas: canvas, tag: tag, w: w, hi: [] };
  }

  function optionLabel(item, i) {
    if (item.variant === 'samediff') return i === 0 ? 'Same figure, turned' : 'Mirror image';
    return 'Option ' + (i + 1);
  }
  function gridCols(item) { return item.variant === 'samediff' ? 2 : 4; }

  /* ---------- reveal: the truth in place, ≤ 700 ms ---------- */

  function reveal(item, response, result, ctx) {
    if (!st) return Promise.resolve();
    st.root.classList.add('is-revealed');
    if (item.variant === 'samediff') {
      var f = item.figs[0];
      st.verdict.textContent = item.key
        ? '✓ Same figure, turned ' + f.deg + '°'
        : '⇋ Mirror image (turned ' + f.deg + '°)';
      st.verdict.setAttribute('data-kind', item.key ? 'same' : 'mirror');
      st.verdict.hidden = false;
    } else {
      st.opts.forEach(function (o, i) {
        if (!o) return;
        var copy = item.figs[i].s === 0;
        o.tag.textContent = copy ? '✓ Turned copy' : '⇋ Mirror';
        o.tag.setAttribute('data-kind', copy ? 'same' : 'mirror');
        o.tag.hidden = false;
      });
    }
    return timing.wait(ctx && ctx.fast ? 0 : 250);
  }

  /* ---------- show me: turn the reference into an option's orientation ---------- */

  function ease(k) { return k * k * (3 - 2 * k); }
  function turnMs(qa, qb) {
    var deg = 2 * Math.acos(Math.min(1, Math.abs(qa.dot(qb)))) * 180 / Math.PI;
    return 700 + 1300 * deg / 180; // 0.7–2 s: slow enough to follow
  }

  function focusOption(i) {
    st.opts.forEach(function (o, j) {
      if (!o) return;
      var b = o.el.closest ? o.el.closest('.px-choice') : null;
      if (b) b.classList.toggle('ex-focus', j === i);
    });
  }
  function highlightOption(i, cells) {
    var o = st.opts[i];
    if (!o) return;
    o.hi = cells || [];
    snapshotFig(st.item, i, o.w, o.w, o.hi, o.canvas);
  }
  // Back to the state of the trial: reference in its pose, nothing highlighted; mode 'explain'
  // frames the stage for a show-me turn.
  function resetStem(mode) {
    var item = st.item;
    st.mode = mode || 'trial';
    show(st.tiles[0], 0, item.ref.q);
    if (item.variant === 'samediff') show(st.tiles[1], item.figs[0].s, item.figs[0].q);
    st.opts.forEach(function (o, i) { if (o && o.hi.length) highlightOption(i, []); });
    focusOption(-1);
    render();
  }

  // The steps that turn the reference into figure k's orientation and say what that shows.
  function turnSteps(item, k, pick) {
    var f = item.figs[k], qRef = quat(item.ref.q), qFig = quat(f.q), g = st.tiles[0].groups[0];
    var q = new T.Quaternion(), copy = f.s === 0;
    return [
      {
        ms: turnMs(qRef, qFig),
        caption: pick ? cap('turnTo', k + 1) : cap('turn'),
        enter: function () { resetStem('explain'); if (pick) focusOption(k); },
        update: function (e) { q.slerpQuaternions(qRef, qFig, ease(e)); g.quaternion.copy(q); render(); },
        exit: function () { g.quaternion.copy(qFig); render(); },
      },
      {
        ms: 1500,
        caption: copy ? (pick ? cap('sameOption', k + 1) : cap('same')) : (pick ? cap('mirrorOption', k + 1) : cap('mirror')),
        enter: function () {
          st.mode = 'explain';
          g.quaternion.copy(qFig);
          if (pick) focusOption(k);
          // The model's answer: the arm that no turn can bring into place.
          g.setHighlight(copy ? [] : item.diff[0], FADE);
          if (!copy) { if (pick) highlightOption(k, item.diff[1]); else st.tiles[1].groups[1].setHighlight(item.diff[1], FADE); }
          render();
        },
      },
    ];
  }

  // Which options to explain: the copies that were missed, then the first mirror that was
  // picked; after a right answer both copies.
  function pickTargets(item, response) {
    var picked = Array.isArray(response) ? response : [];
    var out = item.key.filter(function (k) { return picked.indexOf(k) < 0; });
    var wrong = picked.filter(function (k) { return item.key.indexOf(k) < 0; });
    if (wrong.length) out.push(wrong[0]);
    return out.length ? out : item.key.slice();
  }

  function steps(item, response) {
    if (item.variant === 'samediff') return turnSteps(item, 0, false);
    var out = [];
    pickTargets(item, response).forEach(function (k) { out = out.concat(turnSteps(item, k, true)); });
    return out;
  }

  // Minimal step runner for players without ctx.play (no controls; honours fast).
  function runSteps(list, ctx, opts) {
    var scale = ctx && ctx.fast ? 0.02 : 1;
    return new Promise(function (resolve) {
      var i = -1, start = 0;
      function begin(now) {
        i++;
        if (i >= list.length) { resolve(); return false; }
        start = now;
        var s = list[i];
        if (s.caption && opts && opts.caption) opts.caption(s.caption);
        if (s.enter) s.enter();
        return true;
      }
      var go = true;
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
    return play(steps(item, response), ctx, { name: 'show-me' }).then(function () { focusOption(-1); });
  }

  // Tutorial: the same solution with captions that introduce the parts first.
  function demo(item, ctx, caption) {
    if (!st || !st.v3 || st.item !== item) return Promise.resolve();
    var intro = [
      { ms: 1800, caption: cap('reference'), enter: function () { resetStem(); st.labels.ref.classList.add('is-pointed'); }, exit: function () { st.labels.ref.classList.remove('is-pointed'); } },
      { ms: 2000, caption: item.variant === 'samediff' ? cap('compare') : cap('options'), enter: function () { if (item.variant === 'samediff') st.labels.cmp.classList.add('is-pointed'); }, exit: function () { st.labels.cmp.classList.remove('is-pointed'); } },
    ];
    var list = intro.concat(steps(item, null));
    return play(list, ctx, { name: 'demo', caption: caption || null });
  }

  function unmount() {
    if (!st) return;
    st.offs.forEach(function (off) { off(); });
    st.tiles.concat([st.opt]).forEach(dropTile);
    if (st.v3) st.v3.detach();
    if (st.root.parentNode) st.root.parentNode.removeChild(st.root);
    st = null;
  }

  PX.ex.view('rotate', {
    layout: 'stem+options',
    needs: 'webgl',
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
    steps: function (item, response) { return st ? steps(item, response) : []; },
  });
})(window.PX);
