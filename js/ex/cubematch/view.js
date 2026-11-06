/* PR-1 Cube Match: view (SVG; ARCHITECTURE.md §6, docs/dev/EXERCISE-GUIDE.md).
   layout 'stem+options': the stem shows the two drawings, each a cube seen from the corner
   (+x, +y, +z) in an orthographic isometric view; the grid has two answers (yes/no: option 1 =
   "Same cube" = true, option 2 = "Different cubes").
   - Everything is drawn from the item (def.lib): each drawn face takes its symbol and its top
     direction from lib.upOf(slot, rot), so what is shown is what validate() grades. Show me (for
     development; the Spatial Check gives no feedback) turns the first cube by item.turn.m, the
     turn that made the second drawing, and marks the faces that still differ.
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
  function cap(key, a) { return String((learn().captions || {})[key] || '').replace('{a}', a === undefined ? '' : a); }

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
  // The full first cube turned by q (show me): every face that faces the viewer.
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

  function redraw(left, right) {
    var svg = st.svg;
    while (svg.firstChild) svg.removeChild(svg.firstChild);
    svg.appendChild(left);
    svg.appendChild(right);
  }
  function drawItem(item, marks2) {
    st.cubes = [drawCube(drawnFaces(item.views[0]), HALF_W / 2), drawCube(drawnFaces(item.views[1]), HALF_W * 1.5, marks2)];
    redraw(st.cubes[0], st.cubes[1]);
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
    return 'Two drawings of cubes. Every cube has six different symbols, one on each face. Is the second drawing the first cube turned? ' +
      'Answer Same cube (key 1) or Different cubes (key 2)' + (ms ? '; up to ' + Math.round(ms / 1000) + ' seconds.' : '.');
  }

  function mount(ctx) {
    var root = h('div.ex-cubematch-stem');
    var stage = h('div.ex-stage.ex-cubematch-stage');
    var labels = [h('span.ex-label.cm-label--a', 'Drawing 1'), h('span.ex-label.cm-label--b', 'Drawing 2')];
    var svg = S.svg(2 * HALF_W, 3.9, { class: 'cm-svg', viewBox: '0 -1.95 ' + 2 * HALF_W + ' 3.9', 'aria-hidden': 'true', focusable: 'false' });
    var verdict = h('div.ex-verdict.cm-verdict', { hidden: true, role: 'status' });
    // px-keep-motion: base.css's reduced-motion rule would empty the bar at once, and the slow
    // sweep is information (the time left), not decoration.
    var timer = h('div.pr-timer.px-keep-motion', { 'aria-hidden': 'true', hidden: true }, h('div.pr-timer-fill'));
    stage.appendChild(labels[0]); stage.appendChild(labels[1]);
    stage.appendChild(h('span.cm-divider', { 'aria-hidden': 'true' }));
    stage.appendChild(svg);
    var caption = h('p.ex-caption', { 'aria-live': 'polite' }), desc = h('p.px-sr');
    // The verdict goes under the bar, not over the drawings (on a phone they fill the stage).
    root.appendChild(stage); root.appendChild(timer); root.appendChild(verdict); root.appendChild(caption); root.appendChild(desc);
    ctx.host.appendChild(root);
    st = { ctx: ctx, root: root, stage: stage, labels: labels, svg: svg, verdict: verdict, caption: caption, desc: desc,
      timer: timer, timerFill: timer.firstChild, item: null, cubes: [null, null] };
  }

  function present(item, ctx) {
    if (!st) mount(ctx);
    st.item = item;
    st.root.classList.remove('is-revealed');
    st.verdict.hidden = true;
    st.verdict.textContent = '';
    st.caption.textContent = '';
    st.desc.textContent = describe(item);
    st.labels.forEach(function (l) { l.classList.remove('is-pointed'); });
    drawItem(item);
    timerStart(item);
    return timing.nextPaint();
  }

  // Two small cube outlines with "=" or "≠" between them: the meaning is in the shape, not the colour.
  function answerIcon(different) {
    var svg = S.svg(40, 20, { width: 40, height: 20, class: 'ex-glyph' });
    var hex = function (x) { return 'M' + x + ' 4l5 -2.5l5 2.5v6l-5 2.5l-5 -2.5z'; };
    svg.appendChild(S.el('path', { d: hex(1) + hex(29), class: 'ex-glyph-a' }));
    svg.appendChild(S.el('path', { d: 'M16 8h8M16 12h8' + (different ? 'M22 5l-4 10' : ''), class: 'ex-glyph-a' }));
    return svg;
  }
  function drawOption(el, item, i, ctx) {
    if (!st) mount(ctx);
    el.appendChild(h('span.ex-answer', answerIcon(i === 1), h('span.ex-answer-text', i === 0 ? 'Same cube' : 'Different cubes')));
  }
  function optionLabel(item, i) { return i === 0 ? 'Same cube' : 'Different cubes'; }
  function gridCols() { return 2; }

  // Slots of drawing 2 that the turned first cube does not show the same way.
  function mismatches(item) {
    var M = item.turn.m, out = [];
    lib.SLOTS.forEach(function (s) {
      var dir = lib.DIRS[lib.SLOT_DIR[s]], body = lib.DIRS.findIndex(function (d) { return dot(mv(M, d), dir) > 0.5; });
      var f = item.cube[body], shown = item.views[1][s], up = mv(M, f.up), want = lib.upOf(s, shown.rot);
      if (f.sym !== shown.sym || dot(up, want) < 0.5) out.push(s);
    });
    return out;
  }

  /* ---------- reveal: the truth in place (development; the Check shows nothing), ≤ 700 ms ---------- */

  function reveal(item, response, result, ctx) {
    if (!st) return Promise.resolve();
    timerStop();
    st.root.classList.add('is-revealed');
    var marks = item.key ? [] : item.change.kind === 'swap' ? item.change.slots : [item.change.slot];
    drawItem(item, marks);
    st.verdict.textContent = item.key ? '✓ ' + cap('verdictSame') : '≠ ' + cap(item.change.kind === 'swap' ? 'verdictSwap' : 'verdictTurn');
    st.verdict.setAttribute('data-kind', item.key ? 'same' : 'mirror');
    st.verdict.hidden = false;
    return timing.wait(ctx && ctx.fast ? 0 : 250);
  }

  /* ---------- show me and the worked example: turn the first cube like the second ---------- */

  function ease(k) { return k * k * (3 - 2 * k); }
  function turnMs(q) { return 900 + 1300 * (2 * Math.acos(Math.min(1, Math.abs(q[3]))) * 180 / Math.PI) / 180; }

  function turnSteps(item) {
    var q = quatOf(item.turn.m), marks = mismatches(item);
    function pose(k, withMarks) {
      var faces = turnedFaces(item, slerpFromId(q, k));
      faces.forEach(function (f) { lib.SLOTS.forEach(function (s) { if (dot(f.n, lib.DIRS[lib.SLOT_DIR[s]]) > 0.999) f.slot = s; }); });
      st.cubes[0] = drawCube(faces, HALF_W / 2, withMarks ? marks : null);
      if (withMarks) st.cubes[1] = drawCube(drawnFaces(item.views[1]), HALF_W * 1.5, marks);
      redraw(st.cubes[0], st.cubes[1]);
    }
    return [
      { ms: turnMs(q), caption: cap('turn'), enter: function () { drawItem(item); }, update: function (k) { pose(ease(k), false); }, exit: function () { pose(1, false); } },
      {
        ms: 1800,
        caption: item.key ? cap('same') : cap(item.change.kind === 'swap' ? 'swapped' : 'turned'),
        enter: function () { drawItem(item); pose(1, !item.key); },
      },
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
    return play(turnSteps(item), ctx, { name: 'show-me' });
  }

  // The one-screen instruction's worked example (learn.demo, a fixed seed the Check never scores).
  function demo(item, ctx, caption) {
    if (!st || st.item !== item) return Promise.resolve();
    timerStop();
    function point(i) { st.labels.forEach(function (l, j) { l.classList.toggle('is-pointed', j === i); }); }
    var intro = [
      { ms: 2200, caption: cap('first'), enter: function () { drawItem(item); point(0); } },
      { ms: 2200, caption: cap('second'), enter: function () { point(1); }, exit: function () { point(-1); } },
    ];
    var outro = { ms: 1800, caption: item.key ? cap('answerSame') : cap('answerDifferent'), enter: function () {} };
    // Afterwards both drawings are as they were (the example can be answered or replayed).
    return play(intro.concat(turnSteps(item), [outro]), ctx, { name: 'demo', caption: caption || null })
      .then(function () { if (st && st.item === item) drawItem(item); });
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
    // for tests: what show me would mark (drawing 2's slots that differ from the turned first cube)
    mismatches: mismatches,
  });
})(window.PX);
