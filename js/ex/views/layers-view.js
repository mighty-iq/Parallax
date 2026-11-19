/* Views, the produce variant 'draw' (v1.2 wave 2, W2-bets; PLAN milestone 4, CONTRACT-v1.2 S, note T1 §4.3).
   The structure and its arrow stay as in a toview item; under them, a grid of 5 × 5 dots where the player
   draws the asked view. A tap between two dots draws a line there or erases it (every line's target is the
   area nearer to it than to any other line: about 64 px across); dragging along the dots draws several at
   once (or erases, when the first line it meets is drawn). Keys: arrows move the pen, Space puts it down or
   lifts it (down, each move draws or erases a line), Backspace undoes, Enter checks. The drawing may sit
   anywhere on the grid. The reveal lays the right drawing over the player's at the best match: right
   lines solid green, missing lines dashed, extra lines red, dash-dotted and crossed out (never colour alone). Show me turns the camera to the asked side and
   traces the view on the structure (the toview steps). js/ex/views/view.js calls these through its 'draw'
   block with its own pieces (api). */
(function (PX) {
  'use strict';
  var h = PX.ui.h, timing = PX.core.timing, SV = PX.core.svg;
  var GW = 4, GH = 4, M = 0.3, EW = 16; // the grid in cells, the margin in cells, the edge-id row width
  var cur = null;

  var T = {
    task: 'Draw the {view} view: tap or drag between dots.',
    keys: 'Keys: arrows move the pen, Space puts it down or lifts it, Backspace undoes, Enter checks.',
    done: 'That is the {view} view, traced on the structure. Below, your drawing: right lines solid green, missing lines dashed, extra lines crossed out.',
  };
  function fill(s, vars) { Object.keys(vars || {}).forEach(function (k) { s = s.split('{' + k + '}').join(String(vars[k])); }); return s; }
  function plural(n, one, many) { return n + ' ' + (n === 1 ? one : many); }

  // Edge ids: 2·(16y + x) for (x, y)–(x + 1, y), 2·(16y + x) + 1 for (x, y)–(x, y + 1); y up from the bottom row of dots.
  function idOf(x, y, vert) { return 2 * (y * EW + x) + (vert ? 1 : 0); }
  function xyOf(e) { var c = e >> 1, x = c % EW; return [x, (c - x) / EW, e & 1]; }
  // Board units (y up) to SVG units (y down).
  function sy(y) { return GH - y; }

  function prepare(item, ctx, api) {
    stop();
    var st = api.st();
    var svg = SV.el('svg', { viewBox: [-M, -M, GW + 2 * M, GH + 2 * M].join(' '), class: 'bets-views-svg', 'aria-hidden': 'true', focusable: 'false' });
    svg.appendChild(SV.el('rect', { x: -M, y: -M, width: GW + 2 * M, height: GH + 2 * M, class: 'bets-views-paper' }));
    var lines = SV.el('g', { class: 'bets-views-lines' }), marks = SV.el('g', { class: 'bets-views-marks' }), dots = SV.el('g', { class: 'bets-views-dots' });
    for (var y = 0; y <= GH; y++) for (var x = 0; x <= GW; x++) dots.appendChild(SV.el('circle', { cx: x, cy: sy(y), r: 0.065 }));
    var pen = SV.el('circle', { cx: 0, cy: sy(0), r: 0.2, class: 'bets-views-pen' });
    svg.appendChild(lines); svg.appendChild(marks); svg.appendChild(dots); svg.appendChild(pen);
    var wrap = h('div.bets-views-board', { tabindex: '0', role: 'group', 'aria-label': 'Grid of dots: draw the ' + item.view + ' view', 'data-px-keys': '' }, svg);
    var count = h('span.bets-draw-count', { 'aria-live': 'polite' }, 'Lines: 0');
    var undo = PX.ui.button('Undo', { kind: 'ghost', small: true, onClick: function () { undoOne(); } });
    var clear = PX.ui.button('Clear', { kind: 'ghost', small: true, onClick: function () { if (cur && cur.accepting && cur.n) { snapshot(); cur.edges = {}; paint(); } } });
    var check = PX.ui.button('Check', { kind: 'primary', key: 'Enter', onClick: function () { submit(); } });
    check.setAttribute('data-px-keys', '');
    var verdict = h('div.ex-verdict.bets-draw-verdict', { hidden: true, role: 'status' });
    var root = h('div.bets-draw.bets-views', { 'data-produce': 'views' },
      h('p.bets-draw-task', fill(T.task, { view: item.view })), wrap, h('div.bets-draw-actions', count, undo, clear, check), verdict, h('p.px-meta.bets-draw-keys', T.keys));
    st.root.appendChild(root);
    if (st.desc) st.desc.textContent = 'A structure of unit cubes on a ' + item.grid + ' by ' + item.grid + ' grid, seen from the front right corner, with an arrow from the ' + item.view +
      '. Draw its ' + item.view + ' view on the grid of dots: tap between two dots, or move the pen with the arrow keys, Space to put it down; check with Enter.';
    cur = { item: item, api: api, root: root, svg: svg, wrap: wrap, linesG: lines, marksG: marks, penEl: pen, count: count, undo: undo, clear: clear, check: check, verdict: verdict,
      edges: {}, n: 0, hist: [], pen: [0, 0], down: false, keyed: false, accepting: false, respond: null, popKeys: null, drag: null };
    svg.addEventListener('pointerdown', onDown);
    svg.addEventListener('pointermove', onMove);
    svg.addEventListener('pointerup', onUp);
    svg.addEventListener('pointercancel', function () { if (cur) cur.drag = null; });
    paint();
  }

  /* ---------- input ---------- */
  function boardPt(ev) {
    var r = cur.svg.getBoundingClientRect();
    if (!r.width || !r.height) return null;
    var x = (ev.clientX - r.left) / r.width * (GW + 2 * M) - M, y = GH - ((ev.clientY - r.top) / r.height * (GH + 2 * M) - M);
    return [x, y];
  }
  function clampI(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }
  // The line nearest a point: a horizontal one on the nearest row of dots, or a vertical one on the nearest column.
  function nearestEdge(p) {
    var hy = clampI(Math.round(p[1]), 0, GH), hx = clampI(Math.floor(p[0]), 0, GW - 1);
    var vx = clampI(Math.round(p[0]), 0, GW), vy = clampI(Math.floor(p[1]), 0, GH - 1);
    var dh = Math.abs(p[1] - hy) + (p[0] < 0 || p[0] > GW ? 1 : 0), dv = Math.abs(p[0] - vx) + (p[1] < 0 || p[1] > GH ? 1 : 0);
    return dh <= dv ? idOf(hx, hy, false) : idOf(vx, vy, true);
  }
  function snapshot() { cur.hist.push(Object.keys(cur.edges)); if (cur.hist.length > 60) cur.hist.shift(); }
  function setEdge(e, on) { if (on) cur.edges[e] = true; else delete cur.edges[e]; }
  function onDown(ev) {
    if (!cur || !cur.accepting) return;
    var p = boardPt(ev);
    if (!p) return;
    try { cur.svg.setPointerCapture(ev.pointerId); } catch (e) { /* capture is a convenience */ }
    cur.drag = { p0: p, dot: [clampI(Math.round(p[0]), 0, GW), clampI(Math.round(p[1]), 0, GH)], moved: false, mode: null, snap: false };
    ev.preventDefault();
  }
  function onMove(ev) {
    var d = cur && cur.drag;
    if (!d || !cur.accepting) return;
    var p = boardPt(ev);
    if (!p) return;
    if (!d.moved && Math.hypot(p[0] - d.p0[0], p[1] - d.p0[1]) > 0.3) d.moved = true;
    if (!d.moved) return;
    var dot = [clampI(Math.round(p[0]), 0, GW), clampI(Math.round(p[1]), 0, GH)];
    if (Math.hypot(p[0] - dot[0], p[1] - dot[1]) > 0.33 || (dot[0] === d.dot[0] && dot[1] === d.dot[1])) return;
    if (dot[0] !== d.dot[0] && dot[1] !== d.dot[1]) { d.dot = dot; return; } // diagonal: the pen moves, nothing is drawn
    if (!d.snap) { snapshot(); d.snap = true; }
    var vert = dot[0] === d.dot[0], a = vert ? Math.min(dot[1], d.dot[1]) : Math.min(dot[0], d.dot[0]), b = vert ? Math.max(dot[1], d.dot[1]) : Math.max(dot[0], d.dot[0]);
    for (var k = a; k < b; k++) {
      var e = vert ? idOf(dot[0], k, true) : idOf(k, dot[1], false);
      if (d.mode === null) d.mode = cur.edges[e] ? 'erase' : 'draw';
      setEdge(e, d.mode === 'draw');
    }
    d.dot = dot;
    paint();
  }
  function onUp(ev) {
    var d = cur && cur.drag;
    if (!d) return;
    cur.drag = null;
    if (!cur.accepting || d.moved) return;
    var e = nearestEdge(d.p0);
    snapshot();
    setEdge(e, !cur.edges[e]);
    cur.keyed = false;
    paint();
    void ev;
  }
  function undoOne() {
    if (!cur || !cur.accepting || !cur.hist.length) return;
    var prev = cur.hist.pop();
    cur.edges = {};
    prev.forEach(function (k) { cur.edges[k] = true; });
    paint();
  }
  function movePen(dx, dy) {
    var x = clampI(cur.pen[0] + dx, 0, GW), y = clampI(cur.pen[1] + dy, 0, GH);
    if (x === cur.pen[0] && y === cur.pen[1]) return;
    if (cur.down) {
      var e = dx ? idOf(Math.min(x, cur.pen[0]), y, false) : idOf(x, Math.min(y, cur.pen[1]), true);
      snapshot();
      setEdge(e, !cur.edges[e]);
    }
    cur.pen = [x, y];
    cur.keyed = true;
    paint();
  }

  function paint() {
    var g = cur.linesG, ids = Object.keys(cur.edges).map(Number);
    while (g.firstChild) g.removeChild(g.firstChild);
    ids.forEach(function (e) { g.appendChild(edgeEl(e, 'bets-views-line')); });
    cur.n = ids.length;
    cur.count.textContent = 'Lines: ' + ids.length;
    cur.check.disabled = !cur.accepting || !ids.length;
    cur.clear.disabled = !cur.accepting || !ids.length;
    cur.undo.disabled = !cur.accepting || !cur.hist.length;
    cur.penEl.setAttribute('cx', cur.pen[0]); cur.penEl.setAttribute('cy', sy(cur.pen[1]));
    cur.penEl.classList.toggle('is-on', !!cur.keyed && cur.accepting);
    cur.penEl.classList.toggle('is-down', !!cur.down);
  }
  function edgeEl(e, cls) {
    var p = xyOf(e), x1 = p[0], y1 = p[1], x2 = p[2] ? x1 : x1 + 1, y2 = p[2] ? y1 + 1 : y1;
    return SV.el('line', { x1: x1, y1: sy(y1), x2: x2, y2: sy(y2), class: cls });
  }

  function collect(item, ctx, respond, api) {
    if (!cur || cur.item !== item) prepare(item, ctx, api);
    cur.respond = respond;
    cur.accepting = true;
    if (cur.popKeys) cur.popKeys();
    cur.popKeys = ctx.keys && ctx.keys.push ? ctx.keys.push({
      ArrowLeft: function () { if (!cur || !cur.accepting) return false; movePen(-1, 0); },
      ArrowRight: function () { if (!cur || !cur.accepting) return false; movePen(1, 0); },
      ArrowUp: function () { if (!cur || !cur.accepting) return false; movePen(0, 1); },
      ArrowDown: function () { if (!cur || !cur.accepting) return false; movePen(0, -1); },
      Space: function () { if (!cur || !cur.accepting) return false; cur.down = !cur.down; cur.keyed = true; paint(); },
      Backspace: function () { if (!cur || !cur.accepting) return false; undoOne(); },
      Enter: function () { if (!cur || !cur.accepting) return false; submit(); },
      repeat: ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'],
    }, { through: true }) : null;
    paint();
  }

  function submit() {
    if (!cur || !cur.accepting || !cur.respond || !cur.n) return;
    var ids = Object.keys(cur.edges).map(Number).sort(function (a, b) { return a - b; }), respond = cur.respond;
    cur.respond = null;
    stopInput();
    paint();
    respond(ids, { amode: 'draw', frames: null }); // a still picture: no frame verdict (it cannot change what was seen)
  }
  function stopInput() {
    if (!cur) return;
    cur.accepting = false;
    cur.drag = null;
    if (cur.popKeys) { cur.popKeys(); cur.popKeys = null; }
  }
  function stop() {
    stopInput();
    if (cur && cur.root && cur.root.parentNode) cur.root.parentNode.removeChild(cur.root);
    cur = null;
  }

  /* ---------- reveal: the right drawing over the player's, at the best match ---------- */
  function reveal(item, response, result, ctx) {
    if (!cur || cur.item !== item) return Promise.resolve();
    stopInput();
    var mine = {}, key = item.key.map(xyOf), w = 0, hh = 0;
    (Array.isArray(response) ? response : []).forEach(function (e) { mine[e] = true; });
    key.forEach(function (p) { w = Math.max(w, p[0] + (p[2] ? 0 : 1)); hh = Math.max(hh, p[1] + (p[2] ? 1 : 0)); });
    var best = -1, at = [0, 0], dx, dy;
    for (dx = 0; dx <= GW - w; dx++) {
      for (dy = 0; dy <= GH - hh; dy++) {
        var n = 0;
        key.forEach(function (p) { if (mine[idOf(p[0] + dx, p[1] + dy, !!p[2])]) n++; });
        if (n > best) { best = n; at = [dx, dy]; }
      }
    }
    var g = cur.marksG, right = 0, missed = 0, extra = 0, inKey = {};
    while (g.firstChild) g.removeChild(g.firstChild);
    while (cur.linesG.firstChild) cur.linesG.removeChild(cur.linesG.firstChild);
    key.forEach(function (p) {
      var e = idOf(p[0] + at[0], p[1] + at[1], !!p[2]);
      inKey[e] = true;
      if (mine[e]) { right++; g.appendChild(edgeEl(e, 'bets-views-line is-right')); }
      else { missed++; g.appendChild(edgeEl(e, 'bets-views-line is-missed')); }
    });
    // extra lines: red, dash-dotted and crossed out at their middle (colour is never the only cue, CLAUDE.md rule 8)
    Object.keys(mine).forEach(function (k) {
      if (inKey[k]) return;
      extra++;
      g.appendChild(edgeEl(+k, 'bets-views-line is-extra'));
      var p = xyOf(+k), mx = p[0] + (p[2] ? 0 : 0.5), my = sy(p[1] + (p[2] ? 0.5 : 0)), r = 0.14;
      g.appendChild(SV.el('path', { d: 'M' + (mx - r) + ' ' + (my - r) + 'L' + (mx + r) + ' ' + (my + r) + 'M' + (mx - r) + ' ' + (my + r) + 'L' + (mx + r) + ' ' + (my - r), class: 'bets-views-cross' }));
    });
    cur.penEl.classList.remove('is-on');
    cur.check.disabled = true; cur.clear.disabled = true; cur.undo.disabled = true;
    var n = item.key.length, ok = !!(result && result.correct);
    cur.verdict.textContent = ok ? '✓ Every line right: the ' + item.view + ' view.'
      : right + ' of ' + plural(n, 'line', 'lines') + ' right' + (missed ? '; ' + missed + ' missing (dashed)' : '') + (extra ? '; ' + extra + ' extra (crossed out)' : '') + '.';
    cur.verdict.setAttribute('data-kind', ok ? 'key' : 'foil');
    cur.verdict.hidden = false;
    cur.root.classList.add('is-revealed');
    return timing.wait(ctx && ctx.fast ? 0 : 250);
  }

  // Show me: the toview steps up to the traced view (the camera turns to the asked side, the outline, then
  // the inner lines), then a last caption for the drawing below.
  function showMe(item, response, ctx, api) {
    var list = api.steps(item).slice(0, 4);
    list.push({ ms: 2600, caption: fill(T.done, { view: item.view }) });
    api.revealStage(ctx);
    return api.play(list, ctx, { name: 'show-me' }).then(api.cleanUp, api.cleanUp);
  }

  PX.ui.betsDraw = PX.ui.betsDraw || {};
  PX.ui.betsDraw.views = { prepare: prepare, collect: collect, reveal: reveal, showMe: showMe, stop: stop, T: T, idOf: idOf };
})(window.PX);
