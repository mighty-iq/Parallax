/* EX-10 Hidden Shapes: view (SVG; ARCHITECTURE.md §6, docs/dev/EXERCISE-GUIDE.md).
   layout 'stem+options': the figure is the stem and the five shapes are the options. Everything is
   drawn from the item's own segments (lattice units, y down) at ONE scale, u px per lattice unit,
   because the task is "the same size": u is chosen in the ready phase (the first drawOption, when
   the grid is laid out but hidden) so that a 3 × 3 shape frame fits every option cell and the
   figure fits the stage; both are then drawn with it. A window resize redraws both.
   - reveal: the hidden copy is drawn thick over the figure at item.place; the verdict names it.
   - show me (ctx.play): the copy traced segment by segment, then every other shape at its best
     place (item.near, the same exhaustive search validate() repeats) with its missing segments
     dashed and marked ✗: why it cannot fit. Picked wrong shape first.
   - Colour is never the only cue: the hidden copy is thick, missing lines are dashed and marked ✗.
   Theme changes need no redraw: every colour is a CSS token. */
(function (PX) {
  'use strict';

  var S = PX.core.svg, h = PX.ui.h, timing = PX.core.timing;
  var M = 0.3;               // margin around a drawing, lattice units
  var FRAME = 3 + 2 * M;     // an option frame: the largest shape (3 × 3) and its margins
  var UMAX = 38, UMIN = 14;  // px per lattice unit
  var VFIT = 0.47;           // wide screens: the figure and the row of shapes take ≤ 47 % of the window height
  var st = null;

  function learn() { return PX.ex.learn('hidden') || {}; }
  function cap(key, n) { return String((learn().captions || {})[key] || '').replace('{n}', n); }
  function r3(x) { return Math.round(x * 1000) / 1000; }
  function segId(s) { return s[0] < s[2] || (s[0] === s[2] && s[1] < s[3]) ? s.join(',') : [s[2], s[3], s[0], s[1]].join(','); }
  function shifted(s, d) { return [s[0] + d[0], s[1] + d[1], s[2] + d[0], s[3] + d[1]]; }

  /* ---------- drawing ---------- */

  // An <svg> showing w × hgt lattice units at u px per unit (plus the margin).
  function frame(w, hgt, u, cls) {
    var W = w + 2 * M, H = hgt + 2 * M, pw = Math.round(W * u), ph = Math.round(H * u);
    var svg = S.el('svg', { viewBox: [-M, -M, r3(W), r3(H)].join(' '), width: pw, height: ph, class: cls,
      'aria-hidden': 'true', focusable: 'false', style: 'width:' + pw + 'px;height:' + ph + 'px' });
    svg.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
    return svg;
  }
  function dots(parent, x0, y0, w, hgt) {
    var g = S.el('g', { class: 'ex-hidden-dots' });
    for (var x = 0; x <= w; x++) for (var y = 0; y <= hgt; y++) g.appendChild(S.el('circle', { cx: r3(x0 + x), cy: r3(y0 + y), r: 0.055 }));
    parent.appendChild(g);
    return g;
  }
  function lines(parent, segs, cls, d) {
    var g = S.el('g', { class: cls }), off = d || [0, 0];
    segs.forEach(function (s) {
      var t = shifted(s, off);
      g.appendChild(S.el('line', { x1: r3(t[0]), y1: r3(t[1]), x2: r3(t[2]), y2: r3(t[3]) }));
    });
    parent.appendChild(g);
    return g;
  }
  // Missing segments: dashed, with a ✗ at the middle (a shape cue, not only a colour).
  function missing(parent, segs) {
    var g = lines(parent, segs, 'ex-hidden-miss');
    // At least 13 px tall at any scale (small figures on phones); 0.42 units from 31 px per unit up.
    var fs = st.u > 0 && 0.42 * st.u < 13 ? r3(13 / st.u) + 'px' : '';
    segs.forEach(function (s) {
      var x = S.text(r3((s[0] + s[2]) / 2), r3((s[1] + s[3]) / 2), '✗', { class: 'ex-hidden-x' });
      if (fs) x.style.fontSize = fs;
      g.appendChild(x);
    });
    return g;
  }

  // One scale for the item: the option cells and the stage both fit. On wide screens (the shapes in
  // one row) the figure and the shapes also fit VFIT of the window height, so the answer bar stays
  // in view; phones (3 + 2 rows) scroll anyway and keep the width-based scale.
  function scaleFor(item, cellW) {
    var stageW = st.stage.clientWidth ? st.stage.clientWidth - 24 : 600;
    var uCell = cellW > 0 ? cellW / FRAME : UMAX, uStage = stageW / (item.grid + 2 * M), uView = UMAX;
    var narrow = !!(window.matchMedia && window.matchMedia('(max-width: 40rem)').matches);
    if (!narrow && window.innerHeight > 0) uView = window.innerHeight * VFIT / (item.grid + 2 * M + FRAME);
    return Math.max(UMIN, Math.min(UMAX, Math.floor(Math.min(uCell, uStage, uView))));
  }

  function drawFigure() {
    var item = st.item, u = st.u;
    while (st.figHost.firstChild) st.figHost.removeChild(st.figHost.firstChild);
    var svg = frame(item.grid, item.grid, u, 'ex-hidden-fig');
    dots(svg, 0, 0, item.grid, item.grid);
    lines(svg, item.figure, 'ex-hidden-seg');
    st.over = S.el('g', { class: 'ex-hidden-over' });
    svg.appendChild(st.over);
    st.figHost.appendChild(svg);
    st.figSvg = svg;
    if (st.revealed) markCopy();
  }

  function drawOptionSvg(o, item, i) {
    var opt = item.options[i], u = st.u, ox = (3 - opt.w) / 2, oy = (3 - opt.h) / 2;
    var svg = frame(3, 3, u, 'ex-hidden-opt');
    dots(svg, ox, oy, opt.w, opt.h);
    lines(svg, opt.segs, 'ex-hidden-seg', [ox, oy]);
    while (o.box.firstChild) o.box.removeChild(o.box.firstChild);
    o.box.appendChild(svg);
  }

  function clearOver() { if (st.over) while (st.over.firstChild) st.over.removeChild(st.over.firstChild); }
  function markCopy(n) {
    var item = st.item, segs = item.options[item.key].segs;
    lines(st.over, n === undefined ? segs : segs.slice(0, n), 'ex-hidden-hit', item.place);
  }

  function describe(item) {
    return 'A line figure on a ' + item.grid + ' by ' + item.grid + ' grid of dots, and five shapes of ' + item.n +
      ' lines each. One shape is hidden in the figure, at the same size and the same way up: every one of its lines is a line of the figure.';
  }

  /* ---------- view functions ---------- */

  function mount(ctx) {
    var root = h('div.ex-hidden-stem');
    var figHost = h('div.ex-hidden-fighost');
    var verdict = h('div.ex-verdict.ex-hidden-verdict', { hidden: true, role: 'status' });
    var label = h('span.ex-label', 'Figure');
    var stage = h('div.ex-stage.ex-hidden-stage', label, figHost, verdict);
    var caption = h('p.ex-caption', { 'aria-live': 'polite' });
    var desc = h('p.px-sr');
    root.appendChild(stage); root.appendChild(caption); root.appendChild(desc);
    ctx.host.appendChild(root);
    st = { ctx: ctx, root: root, stage: stage, figHost: figHost, verdict: verdict, label: label, caption: caption, desc: desc,
      item: null, optItem: null, u: UMAX, opts: [], over: null, revealed: false, resizeT: 0 };
    st.onResize = function () {
      if (st.resizeT) clearTimeout(st.resizeT);
      st.resizeT = setTimeout(function () { st.resizeT = 0; relayout(); }, 120);
    };
    window.addEventListener('resize', st.onResize);
  }

  // drawOption runs in the ready phase, before present: the first call for a new item fixes u.
  function newItem(item, cellW) {
    if (st.optItem === item) return;
    st.optItem = item;
    st.opts = [];
    st.revealed = false;
    st.u = scaleFor(item, cellW);
  }

  function drawOption(el, item, i, ctx) {
    if (!st) mount(ctx);
    newItem(item, el.clientWidth);
    var box = h('span.ex-hidden-optbox');
    el.appendChild(h('span.ex-opt.ex-hidden-optwrap', box));
    st.opts[i] = { el: el, box: box };
    drawOptionSvg(st.opts[i], item, i);
  }

  function optionLabel(item, i) { return 'Shape ' + (i + 1) + ', ' + item.options[i].segs.length + ' lines'; }
  function gridCols() { return 5; }

  function present(item, ctx) {
    if (!st) mount(ctx);
    if (st.optItem !== item) newItem(item, 0);
    st.item = item;
    st.revealed = false;
    st.verdict.hidden = true;
    st.caption.textContent = '';
    st.desc.textContent = describe(item);
    st.root.setAttribute('data-grid', String(item.grid));
    drawFigure();
    return timing.nextPaint();
  }

  // After a resize: a new scale for the figure and the options alike (outside any stimulus phase
  // only in the sense that the player resized the window; nothing else changes).
  function relayout() {
    if (!st || !st.item) return;
    var cell = st.opts[0] && st.opts[0].el, u = scaleFor(st.item, cell ? cell.clientWidth : 0);
    if (u === st.u) return;
    st.u = u;
    drawFigure();
    st.opts.forEach(function (o, i) { if (o) drawOptionSvg(o, st.item, i); });
  }

  function reveal(item, response, result, ctx) {
    if (!st || st.item !== item) return Promise.resolve();
    st.revealed = true;
    clearOver();
    markCopy();
    st.verdict.textContent = '✓ Shape ' + (item.key + 1) + ' is hidden here';
    st.verdict.setAttribute('data-kind', 'right');
    st.verdict.hidden = false;
    return timing.wait(ctx && ctx.fast ? 0 : 250);
  }

  /* ---------- show me and demo (steps for ctx.play) ---------- */

  function focus(i) {
    st.opts.forEach(function (o, j) {
      if (!o) return;
      var b = o.el.closest ? o.el.closest('.px-choice') : null;
      if (b) b.classList.toggle('ex-focus', j === i);
    });
  }

  // Lines of the figure that run on straight past an end of the hidden copy (allowed: worth a word).
  function runsOn(item) {
    var copy = {}, fig = {}, out = false;
    item.options[item.key].segs.forEach(function (s) { copy[segId(shifted(s, item.place))] = true; });
    item.figure.forEach(function (s) { fig[segId(s)] = true; });
    item.options[item.key].segs.forEach(function (s0) {
      var s = shifted(s0, item.place), dx = s[2] - s[0], dy = s[3] - s[1];
      [[s[2], s[3], s[2] + dx, s[3] + dy], [s[0] - dx, s[1] - dy, s[0], s[1]]].forEach(function (c) {
        if (fig[segId(c)] && !copy[segId(c)]) out = true;
      });
    });
    return out;
  }

  // The wrong shapes to explain: the picked one first, then the others in order.
  function wrongOrder(item, response) {
    var out = [];
    if (typeof response === 'number' && response !== item.key && response >= 0 && response < item.options.length) out.push(response);
    for (var i = 0; i < item.options.length; i++) if (i !== item.key && out.indexOf(i) < 0) out.push(i);
    return out;
  }

  function steps(item, response) {
    var k = item.key, ks = item.options[k].segs, n = ks.length, list = [];
    list.push({
      ms: Math.max(1400, 380 * n),
      caption: cap('found', k + 1),
      enter: function () { st.verdict.hidden = true; clearOver(); focus(k); },
      update: function (e) { clearOver(); markCopy(Math.max(1, Math.min(n, Math.ceil(e * n - 1e-9)))); },
      exit: function () { clearOver(); markCopy(); },
    });
    if (runsOn(item)) list.push({ ms: 1500, caption: cap('runOn'), enter: function () { clearOver(); focus(k); markCopy(); } });
    wrongOrder(item, response).forEach(function (j) {
      var nr = item.near[j], segs = item.options[j].segs;
      list.push({
        ms: 1700,
        caption: cap(nr.missing.length > 1 ? 'notFitMany' : 'notFit', j + 1),
        enter: function () {
          clearOver();
          focus(j);
          var miss = {};
          nr.missing.forEach(function (s) { miss[segId(s)] = true; });
          lines(st.over, segs.map(function (s) { return shifted(s, nr.at); }).filter(function (s) { return !miss[segId(s)]; }), 'ex-hidden-near');
          missing(st.over, nr.missing);
        },
      });
    });
    list.push({ ms: 1200, caption: cap('only', k + 1), enter: function () { clearOver(); focus(k); markCopy(); } });
    return list;
  }

  // Minimal runner for players without ctx.play (no controls; honours fast), as in Rotate.
  function runSteps(list, ctx, opts) {
    var scale = ctx && ctx.fast ? 0.02 : 1;
    return new Promise(function (resolve) {
      var i = -1, el = 0;
      function begin() {
        i++;
        if (i >= list.length) { resolve(); return false; }
        el = 0;
        if (list[i].caption && opts && opts.caption) opts.caption(list[i].caption);
        if (list[i].enter) list[i].enter();
        return true;
      }
      if (!begin()) return;
      timing.loop(function (dt) {
        el += dt;
        var s = list[i], k = Math.min(1, el / Math.max(1, s.ms * scale));
        if (s.update) s.update(k);
        if (k >= 1) { if (s.exit) s.exit(); return begin(); }
        return true;
      });
    });
  }

  function play(list, ctx, opts) {
    var o = opts || {};
    if (!o.caption) o.caption = function (text) { if (st) st.caption.textContent = text; };
    if (ctx && typeof ctx.play === 'function') return Promise.resolve(ctx.play(list, o));
    return runSteps(list, ctx, o);
  }

  // After show me: back to the revealed state (copy marked, verdict shown, no focus ring).
  function settle(item) {
    if (!st || st.item !== item) return;
    focus(-1);
    clearOver();
    if (st.revealed) { markCopy(); st.verdict.hidden = false; }
  }

  function showMe(item, response, ctx) {
    if (!st || st.item !== item) return Promise.resolve();
    return play(steps(item, response), ctx, { name: 'show-me' }).then(function () { settle(item); });
  }

  // Tutorial: the parts first, then the solution.
  function demo(item, ctx, caption) {
    if (!st || st.item !== item) return Promise.resolve();
    var intro = [
      { ms: 1800, caption: cap('figure'), enter: function () { clearOver(); focus(-1); st.label.classList.add('is-pointed'); }, exit: function () { st.label.classList.remove('is-pointed'); } },
      { ms: 2200, caption: cap('shapes'), enter: function () { clearOver(); focus(-1); } },
    ];
    return play(intro.concat(steps(item, null)), ctx, { name: 'demo', caption: caption || null }).then(function () {
      if (!st || st.item !== item) return;
      focus(-1);
      clearOver();
      if (st.revealed) markCopy();
    });
  }

  function unmount() {
    if (!st) return;
    window.removeEventListener('resize', st.onResize);
    if (st.resizeT) clearTimeout(st.resizeT);
    if (st.root.parentNode) st.root.parentNode.removeChild(st.root);
    st = null;
  }

  PX.ex.view('hidden', {
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
    // for tests: the steps show me would play, and the scale in use (px per lattice unit)
    steps: function (item, response) { return st ? steps(item, response) : []; },
    scale: function () { return st ? st.u : null; },
  });
})(window.PX);
