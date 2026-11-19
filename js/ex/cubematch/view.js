/* PR-1 Cube Match: view, version 2 (SVG; ARCHITECTURE.md §6, docs/dev/EXERCISE-GUIDE.md).
   layout 'stem+options': the stem shows the reference cube, seen from the corner (+x, +y, +z) in an orthographic
   isometric view; the grid has four drawings of a cube from the same corner (keys 1 to 4), one of them the reference
   cube turned.
   - Everything is drawn from the item (def.lib): each drawn face takes its symbol and its top
     direction from lib.upOf(slot, rot), so what is shown is what validate() grades. Show me (for
     development; the Spatial Check gives no feedback) turns the reference by item.turn.m, the
     turn that made the matching drawing.
   - The item's time limit runs as a calm bar under the stem (CSS animation, no ticks, no colour
     change); it pauses while an ancestor has [data-paused] or the harness is paused, and stops
     at reveal.
   Projection: view direction d = (1, 1, 1)/√3; screen right (1, 0, −1)/√2, screen up
   (−1, 2, −1)/√6 (SVG y = −up). Visible faces: normal · d > 0. Glyph point (x, y) on a face with
   outward normal n and top u: centre n + G·(x·(u × n) + y·u). */
(function (PX) {
  'use strict';

  var timing = PX.core.timing, S = PX.core.svg, h = PX.ui.h, U = PX.util;
  var def = PX.ex.get('cubematch'), lib = def.lib;
  var SQ2 = Math.sqrt(2), SQ6 = Math.sqrt(6), SQ3 = Math.sqrt(3);
  var VIEW = [1 / SQ3, 1 / SQ3, 1 / SQ3], RIGHT = [1 / SQ2, 0, -1 / SQ2], UP = [-1 / SQ6, 2 / SQ6, -1 / SQ6];
  var LIGHT = (function () { var l = [0.55, 0.9, 0.35], n = Math.sqrt(0.55 * 0.55 + 0.81 + 0.35 * 0.35); return [l[0] / n, l[1] / n, l[2] / n]; })();
  var G = 0.3;          // glyph lattice unit on a face of half-size 1 (|x|, |y| ≤ 2 → 0.6)
  var HALF_W = 3.7;     // viewBox width of one drawing
  var st = null;

  function learn() { return PX.ex.learn('cubematch') || {}; }
  function cap(key, a) { return String((learn().captions || {})[key] || '').replace(/\{a\}/g, a === undefined ? '' : a); }

  /* ---------- vectors and quaternions ---------- */
  function dot(a, b) { return a[0] * b[0] + a[1] * b[1] + a[2] * b[2]; }
  function cross(a, b) { return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]; }
  function mv(M, v) { return [M[0] * v[0] + M[1] * v[1] + M[2] * v[2], M[3] * v[0] + M[4] * v[1] + M[5] * v[2], M[6] * v[0] + M[7] * v[1] + M[8] * v[2]]; }
  function quatOf(m) { // [x, y, z, w] of a proper rotation (row-major 3 × 3)
    var tr = m[0] + m[4] + m[8], s;
    if (tr > 0) { s = Math.sqrt(tr + 1) * 2; return [(m[7] - m[5]) / s, (m[2] - m[6]) / s, (m[3] - m[1]) / s, 0.25 * s]; }
    if (m[0] > m[4] && m[0] > m[8]) { s = Math.sqrt(1 + m[0] - m[4] - m[8]) * 2; return [0.25 * s, (m[1] + m[3]) / s, (m[2] + m[6]) / s, (m[7] - m[5]) / s]; }
    if (m[4] > m[8]) { s = Math.sqrt(1 + m[4] - m[0] - m[8]) * 2; return [(m[1] + m[3]) / s, 0.25 * s, (m[5] + m[7]) / s, (m[2] - m[6]) / s]; }
    s = Math.sqrt(1 + m[8] - m[0] - m[4]) * 2;
    return [(m[2] + m[6]) / s, (m[5] + m[7]) / s, 0.25 * s, (m[3] - m[1]) / s];
  }
  function slerpFromId(q, t) { // identity → q
    var w = Math.max(-1, Math.min(1, q[3])), sign = w < 0 ? -1 : 1, a = Math.acos(w * sign);
    if (a < 1e-6) return [0, 0, 0, 1];
    var s0 = Math.sin((1 - t) * a) / Math.sin(a), s1 = sign * Math.sin(t * a) / Math.sin(a);
    return [s1 * q[0], s1 * q[1], s1 * q[2], s0 + s1 * q[3]];
  }
  function qrot(q, v) {
    var u = [q[0], q[1], q[2]], w = q[3], c = cross(u, v), cc = cross(u, c);
    return [v[0] + 2 * (w * c[0] + cc[0]), v[1] + 2 * (w * c[1] + cc[1]), v[2] + 2 * (w * c[2] + cc[2])];
  }
  function scr(p, ox) { return [ox + dot(p, RIGHT), -dot(p, UP)]; }

  /* ---------- drawing ---------- */

  // Faces of a drawing as 3D facts: [{ n, up, sym, slot }]: the three drawn faces.
  function drawnFaces(view) {
    return lib.SLOTS.map(function (s) { return { n: lib.DIRS[lib.SLOT_DIR[s]], up: lib.upOf(s, view[s].rot), sym: view[s].sym, slot: s }; });
  }
  // The full reference cube turned by q (show me): every face that faces the viewer.
  function turnedFaces(item, q) {
    return item.cube.map(function (f, i) { return { n: qrot(q, lib.DIRS[i]), up: qrot(q, f.up), sym: f.sym, body: i }; })
      .filter(function (f) { return dot(f.n, VIEW) > 1e-6; });
  }
  // Fill tone from the face's light: three stimulus tokens, mixed when the face is in between.
  function tone(n) {
    var t = U.clamp((dot(n, LIGHT) - 0.2) / 0.65, 0, 1);
    if (t >= 0.5) return 'color-mix(in srgb, var(--stim-face, #ECEEF0) ' + Math.round((t - 0.5) * 200) + '%, var(--stim-face-2, #C9CED3))';
    return 'color-mix(in srgb, var(--stim-face-2, #C9CED3) ' + Math.round(t * 200) + '%, var(--stim-face-3, #A4ABB2))';
  }
  function toneClass(n) { var d = dot(n, LIGHT); return d > 0.7 ? 'cm-face--top' : d > 0.42 ? 'cm-face--right' : 'cm-face--left'; }

  function drawFace(g, f, ox, mark) {
    // The face is the square n ± right ± up (half-size 1), right = up × n: the glyph's own axes.
    var right = cross(f.up, f.n), c = f.n, u = right, v = f.up;
    var corners = [[1, 1], [1, -1], [-1, -1], [-1, 1]].map(function (k) {
      return scr([c[0] + k[0] * u[0] + k[1] * v[0], c[1] + k[0] * u[1] + k[1] * v[1], c[2] + k[0] * u[2] + k[1] * v[2]], ox);
    });
    var face = S.el('g', { class: 'cm-face' + (mark ? ' is-marked' : ''), 'data-sym': f.sym, 'data-slot': f.slot || null });
    face.appendChild(S.path(corners, true, { class: 'cm-face-plate ' + toneClass(f.n), style: { fill: tone(f.n) } }));
    var glyph = lib.GLYPHS[f.sym];
    glyph.lines.forEach(function (line) {
      var pts = line.map(function (p) {
        var x = p[0] * G, y = p[1] * G;
        return scr([c[0] + x * right[0] + y * f.up[0], c[1] + x * right[1] + y * f.up[1], c[2] + x * right[2] + y * f.up[2]], ox);
      });
      face.appendChild(S.path(pts, false, { class: 'cm-glyph' }));
    });
    g.appendChild(face);
    return face;
  }

  // One drawing (faces → group) centred at ox in the viewBox.
  function drawCube(faces, ox, marks) {
    var g = S.el('g', { class: 'cm-cube' });
    faces.forEach(function (f) { drawFace(g, f, ox, marks && marks.indexOf(f.slot || f.sym) >= 0); });
    return g;
  }
  function cubeSvg(cls) {
    return S.svg(HALF_W, 3.9, { class: cls, viewBox: '0 -1.95 ' + HALF_W + ' 3.9', 'aria-hidden': 'true', focusable: 'false' });
  }
  function setCube(svg, g) {
    while (svg.firstChild) svg.removeChild(svg.firstChild);
    svg.appendChild(g);
  }
  function drawRef(item) { setCube(st.svg, drawCube(drawnFaces(item.ref), HALF_W / 2)); }
  // The slots a foil's differences touched (reveal and show me mark them).
  function changedSlots(item, i) {
    var out = [];
    (item.changes && item.changes[i] || []).forEach(function (c) {
      (c.kind === 'swap' ? c.slots : [c.slot]).forEach(function (s) { if (out.indexOf(s) < 0) out.push(s); });
    });
    return out;
  }

  /* ---------- the countdown bar (the item's time limit; calm: one slow linear sweep) ---------- */

  function timerStart(item) {
    var ms = def.timeLimit(item.params);
    st.timer.hidden = !ms;
    st.timer.classList.remove('is-running', 'is-stopped', 'is-done');
    if (!ms) return;
    st.timerFill.style.animationDuration = ms + 'ms';
    void st.timerFill.offsetWidth; // restart the animation for the new item
    st.timer.classList.add('is-running');
  }
  function timerStop() { if (st) st.timer.classList.add('is-stopped'); }

  /* ---------- view functions ---------- */

  function describe(item) {
    var ms = def.timeLimit(item.params);
    return 'A reference cube and four drawings of cubes. Every cube has six different symbols, one on each face. One drawing is the reference cube turned; ' +
      'choose it (keys 1 to 4)' + (ms ? '; up to ' + Math.round(ms / 1000) + ' seconds.' : '.');
  }

  function mount(ctx) {
    var root = h('div.ex-cubematch-stem');
    var stage = h('div.ex-stage.ex-cubematch-stage');
    var label = h('span.ex-label.cm-label--a', 'Reference');
    var svg = cubeSvg('cm-svg');
    var verdict = h('div.ex-verdict.cm-verdict', { hidden: true, role: 'status' });
    // px-keep-motion: base.css's reduced-motion rule would empty the bar at once, and the slow
    // sweep is information (the time left), not decoration.
    var timer = h('div.pr-timer.px-keep-motion', { 'aria-hidden': 'true', hidden: true }, h('div.pr-timer-fill'));
    stage.appendChild(label);
    stage.appendChild(svg);
    var caption = h('p.ex-caption', { 'aria-live': 'polite' }), desc = h('p.px-sr');
    // The verdict goes under the bar, not over the drawing.
    root.appendChild(stage); root.appendChild(timer); root.appendChild(verdict); root.appendChild(caption); root.appendChild(desc);
    ctx.host.appendChild(root);
    st = { ctx: ctx, root: root, stage: stage, label: label, svg: svg, verdict: verdict, caption: caption, desc: desc,
      timer: timer, timerFill: timer.firstChild, item: null, opts: [] };
  }

  function present(item, ctx) {
    if (!st) mount(ctx);
    if (st.item !== item) { st.item = item; st.opts = []; }
    st.root.classList.remove('is-revealed');
    st.verdict.hidden = true;
    st.verdict.textContent = '';
    st.caption.textContent = '';
    st.desc.textContent = describe(item);
    st.label.classList.remove('is-pointed');
    drawRef(item);
    timerStart(item);
    return timing.nextPaint();
  }

  function drawOption(el, item, i, ctx) {
    if (!st) mount(ctx);
    if (st.item !== item) { st.item = item; st.opts = []; }
    var svg = cubeSvg('cm-opt');
    setCube(svg, drawCube(drawnFaces(item.options[i]), HALF_W / 2));
    var box = h('span.ex-answer.cm-answer', svg);
    el.appendChild(box);
    st.opts[i] = svg;
  }
  function optionLabel(item, i) { return 'Drawing ' + (i + 1); }
  function gridCols() { return 2; }

  /* ---------- reveal: the truth in place (development; the Check shows nothing), ≤ 700 ms ---------- */

  function reveal(item, response, result, ctx) {
    if (!st) return Promise.resolve();
    timerStop();
    st.root.classList.add('is-revealed');
    item.options.forEach(function (o, i) {
      if (st.opts[i] && i !== item.key) setCube(st.opts[i], drawCube(drawnFaces(o), HALF_W / 2, changedSlots(item, i)));
    });
    st.verdict.textContent = '✓ ' + cap('verdict', item.key + 1);
    st.verdict.setAttribute('data-kind', 'same');
    st.verdict.hidden = false;
    return timing.wait(ctx && ctx.fast ? 0 : 250);
  }

  /* ---------- show me and the worked example: turn the reference like the matching drawing ---------- */

  function ease(k) { return k * k * (3 - 2 * k); }
  function turnMs(q) { return 900 + 1300 * (2 * Math.acos(Math.min(1, Math.abs(q[3]))) * 180 / Math.PI) / 180; }

  function turnSteps(item) {
    var q = quatOf(item.turn.m);
    function pose(k) { setCube(st.svg, drawCube(turnedFaces(item, slerpFromId(q, k)), HALF_W / 2)); }
    return [
      { ms: turnMs(q), caption: cap('turn'), enter: function () { drawRef(item); }, update: function (k) { pose(ease(k)); }, exit: function () { pose(1); } },
      { ms: 1800, caption: cap('match', item.key + 1), enter: function () { pose(1); } },
    ];
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
    if (!st || st.item !== item) return Promise.resolve();
    return play(turnSteps(item), ctx, { name: 'show-me' }).then(function () { if (st && st.item === item) drawRef(item); });
  }

  // The one-screen instruction's worked example (learn.demo, a fixed seed the Check never scores).
  function demo(item, ctx, caption) {
    if (!st || st.item !== item) return Promise.resolve();
    timerStop();
    var intro = [
      { ms: 2200, caption: cap('first'), enter: function () { drawRef(item); st.label.classList.add('is-pointed'); } },
      { ms: 2400, caption: cap('options'), enter: function () { st.label.classList.remove('is-pointed'); } },
    ];
    var outro = { ms: 2000, caption: cap('answer', item.key + 1), enter: function () {} };
    // Afterwards the reference is as it was (the example can be answered or replayed).
    return play(intro.concat(turnSteps(item), [outro]), ctx, { name: 'demo', caption: caption || null })
      .then(function () { if (st && st.item === item) drawRef(item); });
  }

  function unmount() {
    if (!st) return;
    if (st.root.parentNode) st.root.parentNode.removeChild(st.root);
    st = null;
  }

  PX.ex.view('cubematch', {
    layout: 'stem+options',
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
    // for tests: the slots each foil's differences touched
    changedSlots: changedSlots,
  });
})(window.PX);
