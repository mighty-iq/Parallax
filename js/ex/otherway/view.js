/* PR-6 Other Way Round: view (DOM and SVG; ARCHITECTURE.md §6, docs/dev/EXERCISE-GUIDE.md).
   layout 'stem+options': the stem holds the strand's question line and its picture; the grid holds four drawings
   (turn, fold back, cut back, net back) or four short labels (view from, where am I). Everything is drawn from the
   item with def.lib (no WebGL): isometric cube pictures from lib.iso, sheets, plans, solids with their cut, nets,
   a map with its arrow circle. The item's time limit runs as a calm bar under the stem; the Check gives no
   feedback (reveal is a development aid). */
(function (PX) {
  'use strict';

  var timing = PX.core.timing, h = PX.ui.h, SV = PX.core.svg;
  var def = PX.ex.get('otherway'), lib = def.lib;
  var st = null;

  var PROMPT = {
    turn: 'Turn the figure the way the arrow shows. Which picture shows it afterwards?',
    foldback: 'This sheet was folded, punched once and opened. Which plan made it?',
    cutback: 'This is a cut face, seen straight on. Which solid, cut along its shaded plane, gives it?',
    netback: 'Both pictures show one cube (the second one turned over). Which net folds into it?',
    viewfrom: 'The flat drawing shows the cubes from one side. Which side?',
    whereami: 'The circle shows what you see around you: ahead is up. Where on the map are you standing?',
  };
  var SIDE = { front: 'Front', right: 'Right', back: 'Back', left: 'Left' };
  var SPOT = ['A', 'B', 'C', 'D'];
  var MARK = ['1', '2', '3', '4', '5', '6', '7'];

  /* ---------- small SVG helpers ---------- */

  function fitSvg(pts, pad, cls) {
    var x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    pts.forEach(function (p) { x0 = Math.min(x0, p[0]); y0 = Math.min(y0, p[1]); x1 = Math.max(x1, p[0]); y1 = Math.max(y1, p[1]); });
    var w = x1 - x0 + 2 * pad, hh = y1 - y0 + 2 * pad;
    var s = SV.el('svg', { viewBox: [x0 - pad, y0 - pad, w, hh].join(' '), class: cls || null, 'aria-hidden': 'true', focusable: 'false', preserveAspectRatio: 'xMidYMid meet' });
    s.__w = w; s.__h = hh;
    return s;
  }
  function poly(pts, cls, extra) { return SV.path(pts, true, Object.assign({ class: cls }, extra || {})); }
  function line(a, b, cls) { return SV.el('line', { x1: a[0], y1: a[1], x2: b[0], y2: b[1], class: cls }); }

  /* ---------- cube pictures ---------- */

  function cubes(cells, extra) {
    var pic = lib.iso(cells), pts = [];
    pic.faces.forEach(function (f) { pts = pts.concat(f.pts); });
    if (extra && extra.pts) pts = pts.concat(extra.pts);
    var s = fitSvg(pts, 0.25, 'ow-cubes');
    pic.faces.forEach(function (f) { s.appendChild(poly(f.pts, 'ow-face ow-' + f.kind)); });
    return s;
  }
  // the turn's axis and arrow: a line through the figure along the axis, and an arc around it near its far end
  function turnStem(item) {
    var cells = item.fig, c = [0, 0, 0], ext = [0, 0, 0];
    cells.forEach(function (p) { for (var i = 0; i < 3; i++) { c[i] += (p[i] + 0.5) / cells.length; ext[i] = Math.max(ext[i], p[i] + 1); } });
    var a = item.axis, e = [0, 0, 0]; e[a] = 1;
    var e1 = [0, 0, 0], e2 = [0, 0, 0];
    e1[(a + 1) % 3] = 1; e2[(a + 2) % 3] = 1; // +90° about the axis carries e1 onto e2
    var reach = ext[a] / 2 + 1.1, tip = [c[0] + e[0] * reach, c[1] + e[1] * reach, c[2] + e[2] * reach];
    var tail = [c[0] - e[0] * reach, c[1] - e[1] * reach, c[2] - e[2] * reach];
    var R = 0.75, arc = [], dir = item.q === 3 ? -1 : 1, span = item.q === 2 ? Math.PI * 1.5 : Math.PI * 1.35;
    for (var k = 0; k <= 24; k++) {
      var t = dir * (0.15 + span * k / 24), p = [0, 0, 0];
      for (var i = 0; i < 3; i++) p[i] = tip[i] - e[i] * 0.35 + R * (Math.cos(t) * e1[i] + Math.sin(t) * e2[i]);
      arc.push(lib.isoPt(p));
    }
    var A = lib.isoPt(tail), B = lib.isoPt(tip);
    var s = cubes(cells, { pts: arc.concat([A, B]) });
    s.appendChild(line(A, B, 'ow-axis'));
    s.appendChild(SV.path(arc, false, { class: 'ow-arc' }));
    var n = arc.length, p1 = arc[n - 1], p0 = arc[n - 3], dx = p1[0] - p0[0], dy = p1[1] - p0[1], L = Math.sqrt(dx * dx + dy * dy) || 1;
    var ux = dx / L, uy = dy / L, hs = 0.28;
    s.appendChild(poly([[p1[0] + ux * hs, p1[1] + uy * hs], [p1[0] - uy * hs * 0.8, p1[1] + ux * hs * 0.8], [p1[0] + uy * hs * 0.8, p1[1] - ux * hs * 0.8]], 'ow-arrowhead'));
    s.appendChild(SV.text(arc[0][0] + (arc[0][0] >= B[0] ? 0.55 : -0.55), arc[0][1] - 0.3, item.q === 2 ? '180°' : '90°', { class: 'ow-angle' }));
    return s;
  }

  /* ---------- fold back ---------- */

  function sheet(item) {
    var n = item.n, s = fitSvg([[0, 0], [n, n]], 0.2, 'ow-sheet');
    s.appendChild(poly([[0, 0], [n, 0], [n, n], [0, n]], 'ow-paper'));
    for (var i = 1; i < n; i++) { s.appendChild(line([i, 0], [i, n], 'ow-grid')); s.appendChild(line([0, i], [n, i], 'ow-grid')); }
    item.holes.forEach(function (p) { s.appendChild(SV.el('circle', { cx: p[0] + 0.5, cy: p[1] + 0.5, r: 0.28, class: 'ow-hole' })); });
    return s;
  }
  function plan(pl, n) {
    var Rs = lib.rects(pl.folds), s = fitSvg([[0, 0], [n, n]], 0.6, 'ow-plan');
    s.appendChild(poly([[0, 0], [n, 0], [n, n], [0, n]], 'ow-outline'));
    var last = Rs[Rs.length - 1];
    s.appendChild(poly([[last[0], last[1]], [last[2], last[1]], [last[2], last[3]], [last[0], last[3]]], 'ow-folded'));
    pl.folds.forEach(function (f, i) {
      // the crease across the paper as it then was, numbered at one end; a straight arrow from the flap's side across
      // it shows which part folds over (move −1: the part before the line, +1: the part after it)
      var R = Rs[i], a, b, mid, d = f.move < 0 ? 1 : -1, from, to, off = (i - (pl.folds.length - 1) / 2) * 0.55;
      if (f.k === 'v') { a = [f.c, R[1]]; b = [f.c, R[3]]; mid = (R[1] + R[3]) / 2 + off; from = [f.c - d * 0.95, mid]; to = [f.c + d * 0.55, mid]; }
      else { a = [R[0], f.c]; b = [R[2], f.c]; mid = (R[0] + R[2]) / 2 + off; from = [mid, f.c - d * 0.95]; to = [mid, f.c + d * 0.55]; }
      s.appendChild(line(a, b, 'ow-crease'));
      s.appendChild(line(from, to, 'ow-flap'));
      var ux = (to[0] - from[0]) / 1.5, uy = (to[1] - from[1]) / 1.5;
      s.appendChild(poly([[to[0] + ux * 0.3, to[1] + uy * 0.3], [to[0] - uy * 0.22, to[1] + ux * 0.22], [to[0] + uy * 0.22, to[1] - ux * 0.22]], 'ow-arrowhead'));
      // the fold's place in the order: one dot for the first fold, two for the second, three for the third
      for (var j = 0; j <= i; j++) {
        var off2 = (j - i / 2) * 0.34, at = f.k === 'v' ? [f.c + off2, R[1] - 0.32] : [R[0] - 0.32, f.c + off2];
        s.appendChild(SV.el('circle', { cx: at[0], cy: at[1], r: 0.13, class: 'ow-stepdot' }));
      }
    });
    s.appendChild(SV.el('circle', { cx: pl.punch[0] + 0.5, cy: pl.punch[1] + 0.5, r: 0.3, class: 'ow-punch' }));
    return s;
  }

  /* ---------- cut back ---------- */

  var UNIT = 38; // px per unit, so the face and the solids share one scale
  function face(item) {
    var s = fitSvg(item.face, 0.3, 'ow-face2d');
    s.appendChild(poly(item.face, 'ow-cut'));
    s.style.width = Math.round(s.__w * UNIT) + 'px';
    return s;
  }
  function solidPic(o) {
    var S = lib.solid(o.kind, o.d), sec = lib.section(S, o.plane), V = S.V.map(lib.isoPt), pts = V.slice();
    var s = fitSvg(pts, 0.25, 'ow-solid');
    S.E.forEach(function (e) { s.appendChild(line(V[e[0]], V[e[1]], 'ow-edge')); });
    if (sec) s.appendChild(poly(sec.map(lib.isoPt), 'ow-cut'));
    s.style.maxWidth = Math.round(s.__w * UNIT) + 'px';
    return s;
  }

  /* ---------- net back ---------- */

  function net(cells, labels) {
    var s = fitSvg(cells.reduce(function (a, c) { return a.concat([[c[0], c[1]], [c[0] + 1, c[1] + 1]]); }, []), 0.08, 'ow-net');
    cells.forEach(function (c, i) {
      var k = lib.LABELS.indexOf(labels[i]);
      s.appendChild(poly([[c[0], c[1]], [c[0] + 1, c[1]], [c[0] + 1, c[1] + 1], [c[0], c[1] + 1]], 'ow-sq ow-c' + k));
      s.appendChild(SV.text(c[0] + 0.5, c[1] + 0.52, labels[i], { class: 'ow-lab' }));
    });
    return s;
  }
  function cubePic(view) { // [top, left-front, right-front]
    var pic = lib.iso([[0, 0, 0]]), s = fitSvg([].concat.apply([], pic.faces.map(function (f) { return f.pts; })), 0.12, 'ow-cubepic');
    var by = { top: view[0], left: view[1], right: view[2] };
    pic.faces.forEach(function (f) {
      var lab = by[f.kind], k = lib.LABELS.indexOf(lab), c = [0, 0];
      f.pts.forEach(function (p) { c[0] += p[0] / 4; c[1] += p[1] / 4; });
      s.appendChild(poly(f.pts, 'ow-face ow-' + f.kind + ' ow-c' + k));
      s.appendChild(SV.text(c[0], c[1], lab, { class: 'ow-lab ow-lab-' + f.kind }));
    });
    return s;
  }

  /* ---------- view from ---------- */

  function structure(item) {
    var cells = lib.cellsOfHeights(item.h), G = item.h.length, s = cubes(cells, { pts: [lib.isoPt([0, G + 0.9, 0]), lib.isoPt([G + 0.9, 0, 0])] });
    // name the two sides the picture shows (front: the lower left faces; right: the lower right faces)
    var f = lib.isoPt([G / 2, G + 0.55, 0]), r = lib.isoPt([G + 0.55, G / 2, 0]);
    s.appendChild(SV.text(f[0], f[1], 'Front', { class: 'ow-side' }));
    s.appendChild(SV.text(r[0], r[1], 'Right', { class: 'ow-side' }));
    return s;
  }
  function flatView(view) {
    var G = view.length, H = Math.max.apply(null, view), s = fitSvg([[0, 0], [G, H]], 0.15, 'ow-flat');
    view.forEach(function (hgt, x) {
      for (var z = 0; z < hgt; z++) s.appendChild(poly([[x, H - z - 1], [x + 1, H - z - 1], [x + 1, H - z], [x, H - z]], 'ow-sqflat'));
    });
    s.appendChild(line([-0.1, H], [G + 0.1, H], 'ow-ground'));
    return s;
  }
  function sideIcon(side) { // the footprint seen from above, an arrow coming in from that side
    var s = SV.el('svg', { viewBox: '-1.6 -1.6 3.2 3.2', class: 'ow-sideicon', 'aria-hidden': 'true', focusable: 'false' });
    s.appendChild(poly([[-0.7, -0.7], [0.7, -0.7], [0.7, 0.7], [-0.7, 0.7]], 'ow-foot'));
    var A = { front: [[0, 1.5], [0, 0.95]], right: [[1.5, 0], [0.95, 0]], back: [[0, -1.5], [0, -0.95]], left: [[-1.5, 0], [-0.95, 0]] }[side];
    s.appendChild(line(A[0], A[1], 'ow-sidearrow'));
    var dx = A[1][0] - A[0][0], dy = A[1][1] - A[0][1], L = Math.sqrt(dx * dx + dy * dy), ux = dx / L, uy = dy / L, t = A[1];
    s.appendChild(poly([[t[0] + ux * 0.25, t[1] + uy * 0.25], [t[0] - uy * 0.22, t[1] + ux * 0.22], [t[0] + uy * 0.22, t[1] - ux * 0.22]], 'ow-arrowhead'));
    return s;
  }

  /* ---------- where am I ---------- */

  var SHAPES = ['circle', 'square', 'triangle', 'diamond', 'hexagon', 'cross', 'star'];
  function markShape(s, i, x, y, r) {
    var k = SHAPES[i % SHAPES.length], pts = [];
    function ngon(n, rot, rr) { var out = []; for (var j = 0; j < n; j++) { var a = rot + j * 2 * Math.PI / n; out.push([x + rr * Math.cos(a), y + rr * Math.sin(a)]); } return out; }
    if (k === 'circle') s.appendChild(SV.el('circle', { cx: x, cy: y, r: r * 1.1, class: 'ow-mark' }));
    else if (k === 'square') s.appendChild(poly(ngon(4, Math.PI / 4, r * 1.25), 'ow-mark'));
    else if (k === 'triangle') s.appendChild(poly(ngon(3, -Math.PI / 2, r * 1.3), 'ow-mark'));
    else if (k === 'diamond') s.appendChild(poly(ngon(4, 0, r * 1.3), 'ow-mark'));
    else if (k === 'hexagon') s.appendChild(poly(ngon(6, 0, r * 1.15), 'ow-mark'));
    else if (k === 'cross') { pts = [[-1, -0.35], [-0.35, -0.35], [-0.35, -1], [0.35, -1], [0.35, -0.35], [1, -0.35], [1, 0.35], [0.35, 0.35], [0.35, 1], [-0.35, 1], [-0.35, 0.35], [-1, 0.35]]; s.appendChild(poly(pts.map(function (p) { return [x + p[0] * r * 1.15, y + p[1] * r * 1.15]; }), 'ow-mark')); }
    else { for (var j = 0; j < 10; j++) { var a = -Math.PI / 2 + j * Math.PI / 5, rr = j % 2 ? r * 0.55 : r * 1.3; pts.push([x + rr * Math.cos(a), y + rr * Math.sin(a)]); } s.appendChild(poly(pts, 'ow-mark')); }
    s.appendChild(SV.text(x, y + r * 0.08, MARK[i], { class: 'ow-marklab', 'font-size': r * 1.3 }));
  }
  function map(item) {
    var s = SV.el('svg', { viewBox: '0 0 100 100', class: 'ow-map', 'aria-hidden': 'true', focusable: 'false' });
    s.appendChild(poly([[0, 0], [100, 0], [100, 100], [0, 100]], 'ow-ground2'));
    s.appendChild(SV.text(50, 6, 'N', { class: 'ow-north' }));
    item.marks.forEach(function (m, i) { markShape(s, i, m[0], m[1], 5.6); });
    item.options.forEach(function (p, i) {
      s.appendChild(SV.el('circle', { cx: p[0], cy: p[1], r: 6.2, class: 'ow-spot', 'data-spot': i }));
      s.appendChild(SV.text(p[0], p[1] + 0.4, SPOT[i], { class: 'ow-spotlab' }));
    });
    return s;
  }
  function circle(item) {
    var s = SV.el('svg', { viewBox: '-52 -64 104 116', class: 'ow-circle', 'aria-hidden': 'true', focusable: 'false' });
    s.appendChild(SV.el('circle', { cx: 0, cy: 0, r: 36, class: 'ow-ring' }));
    s.appendChild(poly([[0, -46], [-6, -37], [6, -37]], 'ow-ahead'));
    s.appendChild(SV.text(0, -55, 'ahead', { class: 'ow-aheadlab' }));
    s.appendChild(SV.el('circle', { cx: 0, cy: 0, r: 3, class: 'ow-you' }));
    item.shown.forEach(function (mi, j) {
      var a = (item.rel[j] - 90) * Math.PI / 180, x = 36 * Math.cos(a), y = 36 * Math.sin(a);
      s.appendChild(line([0, 0], [x * 0.7, y * 0.7], 'ow-ray'));
      markShape(s, mi, x, y, 9.5);
    });
    return s;
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
    return PROMPT[item.strand] + ' Choose one of four (keys 1 to 4)' + (ms ? '; up to ' + Math.round(ms / 1000) + ' seconds.' : '.');
  }

  function mount(ctx) {
    var prompt = h('p.ow-prompt'), pic = h('div.ow-pic');
    var verdict = h('div.ex-verdict.ow-verdict', { hidden: true, role: 'status' });
    var stage = h('div.ex-stage.ow-stage', prompt, pic, verdict);
    var timer = h('div.pr-timer', { 'aria-hidden': 'true', hidden: true }, h('div.pr-timer-fill'));
    var caption = h('p.ex-caption', { 'aria-live': 'polite' }), desc = h('p.px-sr');
    var root = h('div.ex-otherway-stem', stage, timer, caption, desc);
    ctx.host.appendChild(root);
    st = { ctx: ctx, root: root, stage: stage, prompt: prompt, pic: pic, verdict: verdict, timer: timer, timerFill: timer.firstChild,
      caption: caption, desc: desc, item: null, opts: [] };
  }

  function present(item, ctx) {
    if (!st) mount(ctx);
    if (st.item !== item) { st.item = item; st.opts = []; }
    PX.ui.clear(st.pic);
    st.root.setAttribute('data-strand', item.strand);
    st.prompt.textContent = PROMPT[item.strand];
    var k = item.strand;
    if (k === 'turn') st.pic.appendChild(turnStem(item));
    else if (k === 'foldback') st.pic.appendChild(sheet(item));
    else if (k === 'cutback') st.pic.appendChild(face(item));
    else if (k === 'netback') { st.pic.appendChild(cubePic(item.views[0])); st.pic.appendChild(cubePic(item.views[1])); }
    else if (k === 'viewfrom') { st.pic.appendChild(structure(item)); st.pic.appendChild(flatView(item.view)); }
    else { st.pic.appendChild(map(item)); st.pic.appendChild(circle(item)); }
    st.root.classList.remove('is-revealed');
    st.verdict.hidden = true;
    st.verdict.textContent = '';
    st.caption.textContent = '';
    st.desc.textContent = describe(item);
    timerStart(item);
    return timing.nextPaint();
  }

  function drawOption(el, item, i, ctx) {
    if (!st) mount(ctx);
    if (st.item !== item) { st.item = item; st.opts = []; }
    var o = item.options[i], k = item.strand, box;
    if (k === 'turn') box = h('span.ex-answer.ow-answer', cubes(o));
    else if (k === 'foldback') box = h('span.ex-answer.ow-answer', plan(o, item.n));
    else if (k === 'cutback') box = h('span.ex-answer.ow-answer', solidPic(o));
    else if (k === 'netback') box = h('span.ex-answer.ow-answer', net(item.cells, o));
    else if (k === 'viewfrom') box = h('span.ex-answer.ow-answer.ow-text', sideIcon(o), h('span.ex-answer-text', SIDE[o]));
    else box = h('span.ex-answer.ow-answer.ow-text', h('span.ex-answer-text.ow-spotname', SPOT[i]));
    el.appendChild(box);
    st.opts[i] = box;
  }
  function optionLabel(item, i) {
    var k = item.strand;
    if (k === 'viewfrom') return SIDE[item.options[i]];
    if (k === 'whereami') return 'Spot ' + SPOT[i];
    return 'Option ' + (i + 1);
  }
  function gridCols(item) { return item && (item.strand === 'viewfrom' || item.strand === 'whereami') ? 4 : 2; }

  function focusOption(i) {
    st.opts.forEach(function (o, j) { var cell = o && o.closest ? o.closest('.px-choice') : null; if (cell) cell.classList.toggle('ex-focus', j === i); });
  }

  // development aid only: the Spatial Check shows nothing after an answer
  function reveal(item, response, result, ctx) {
    if (!st) return Promise.resolve();
    timerStop();
    st.root.classList.add('is-revealed');
    st.verdict.textContent = (result && result.correct ? '✓ ' : '→ ') + 'The answer is ' + optionLabel(item, item.key).toLowerCase() + '.';
    st.verdict.hidden = false;
    focusOption(item.key);
    return timing.wait(ctx && ctx.fast ? 0 : 250);
  }

  // The worked example (learn.demo, one per strand): what the question asks, then the answer and why.
  function demo(item, ctx, caption) {
    if (!st || st.item !== item) return Promise.resolve();
    timerStop();
    var L = PX.ex.learn('otherway') || {}, ex = (L.explain || {})[item.strand] || [];
    var steps = [{ ms: 2400, text: PROMPT[item.strand], at: -1 }].concat(ex.map(function (t, j) { return { ms: 2800, text: t, at: j === ex.length - 1 ? item.key : -1 }; }));
    steps.push({ ms: 2200, text: 'So the answer is ' + optionLabel(item, item.key).toLowerCase() + '.', at: item.key });
    var list = steps.map(function (s) {
      return { ms: s.ms, caption: s.text, enter: function () { focusOption(s.at); } };
    });
    var o = { name: 'demo', caption: caption || function (t) { if (st) st.caption.textContent = t; } };
    var run = ctx && typeof ctx.play === 'function' ? ctx.play(list, o) : new Promise(function (resolve) {
      var i = 0;
      (function nextStep() {
        if (i >= list.length) { resolve(); return; }
        var s = list[i++];
        if (o.caption) o.caption(s.caption);
        s.enter();
        timing.wait(ctx && ctx.fast ? 0 : s.ms).then(nextStep);
      })();
    });
    return run.then(function () { focusOption(-1); });
  }

  function unmount() {
    if (!st) return;
    if (st.root.parentNode) st.root.parentNode.removeChild(st.root);
    st = null;
  }

  PX.ex.view('otherway', {
    layout: 'stem+options',
    css: true,
    mount: mount,
    present: present,
    drawOption: drawOption,
    optionLabel: optionLabel,
    gridCols: gridCols,
    reveal: reveal,
    demo: demo,
    unmount: unmount,
  });
})(window.PX);
