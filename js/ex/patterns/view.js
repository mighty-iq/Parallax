/* PR-4 Pattern Memory: view (SVG; layout 'custom'; ARCHITECTURE.md §6, docs/dev/EXERCISE-GUIDE.md).
   present() shows the pattern as a steady display and times it itself: from the paint timestamp
   of the first frame that shows it, the grid empties at the first frame that ends the exposure
   (item.exposureMs, 3 s; rAF timestamps, never setTimeout; the swap is requested at the first
   frame within half a frame of 3 s, so the pattern shows for 3 s ± half a frame); present
   resolves with the paint timestamp of the empty grid, so the answer clock starts when marking
   can start. During the
   exposure nothing else changes on the page. The measured exposure and whether a frame gap over
   100 ms happened (a hidden tab, a stall: the trial should be voided) are kept for the player
   (view.exposure()).
   collect() lets the player mark cells: tap or click toggles a cell; the arrow keys move a visible
   cursor, Space toggles, Enter (or Confirm) sends the sorted cell ids. Marks are a dot as well as a
   tint (colour never alone). Reveal and show me are for development (the Check gives no feedback):
   found cells keep their dot, missed cells get a dashed outline, extra marks a cross. The time limit
   for marking runs as a calm bar under the grid. */
(function (PX) {
  'use strict';

  var timing = PX.core.timing, S = PX.core.svg, h = PX.ui.h, U = PX.util;
  var def = PX.ex.get('patterns');
  var CELL = 10, GAP = 1.2, CELL_PX = 72; // drawing units; on-screen cell size cap (CSS px)
  var st = null;

  function learn() { return PX.ex.learn('patterns') || {}; }
  function cap(key, vars) {
    return String((learn().captions || {})[key] || '').replace(/\{(\w+)\}/g, function (m, k) { return vars && vars[k] !== undefined ? vars[k] : m; });
  }

  /* ---------- the grid ---------- */

  function cellXY(item, id) { return [GAP + (id % item.cols) * (CELL + GAP), GAP + Math.floor(id / item.cols) * (CELL + GAP)]; }
  function buildGrid(item) {
    var svg = st.svg, W = item.cols * (CELL + GAP) + GAP, H = item.rows * (CELL + GAP) + GAP;
    PX.ui.clear(svg);
    svg.setAttribute('viewBox', '0 0 ' + U.round(W, 2) + ' ' + U.round(H, 2));
    st.wrap.style.maxWidth = (item.cols * CELL_PX) + 'px';
    st.cells = [];
    for (var id = 0; id < item.rows * item.cols; id++) {
      var p = cellXY(item, id), g = S.el('g', { class: 'pm-cell', 'data-id': id });
      g.appendChild(S.el('rect', { class: 'pm-sq', x: p[0], y: p[1], width: CELL, height: CELL, rx: 0.8 }));
      g.appendChild(S.el('circle', { class: 'pm-dot', cx: p[0] + CELL / 2, cy: p[1] + CELL / 2, r: CELL * 0.17 }));
      g.appendChild(S.el('path', { class: 'pm-cross', d: 'M' + (p[0] + 2.6) + ' ' + (p[1] + 2.6) + 'l' + (CELL - 5.2) + ' ' + (CELL - 5.2) + 'M' + (p[0] + CELL - 2.6) + ' ' + (p[1] + 2.6) + 'l' + (5.2 - CELL) + ' ' + (CELL - 5.2) }));
      svg.appendChild(g);
      st.cells.push(g);
    }
    st.cursorEl = S.el('rect', { class: 'pm-cursor', x: 0, y: 0, width: CELL + 1.2, height: CELL + 1.2, rx: 1.2 });
    svg.appendChild(st.cursorEl);
  }
  // state: 'pattern' (the exposure), 'empty', 'reveal'; marks: a set of ids.
  function paint(item, mode, marks) {
    var key = {};
    item.key.forEach(function (id) { key[id] = true; });
    st.cells.forEach(function (g, id) {
      var on = !!(marks && marks[id]);
      g.classList.toggle('is-filled', mode === 'pattern' && !!key[id]);
      g.classList.toggle('is-marked', mode !== 'pattern' && on);
      g.classList.toggle('is-hit', mode === 'reveal' && on && !!key[id]);
      g.classList.toggle('is-miss', mode === 'reveal' && !on && !!key[id]);
      g.classList.toggle('is-extra', mode === 'reveal' && on && !key[id]);
    });
    st.mode = mode;
  }
  function showCursor(item, on) {
    var p = cellXY(item, st.cursor);
    st.cursorEl.setAttribute('x', U.round(p[0] - 0.6, 2));
    st.cursorEl.setAttribute('y', U.round(p[1] - 0.6, 2));
    st.cursorEl.classList.toggle('is-on', !!on);
  }
  function count() { return Object.keys(st.marks).length; }
  function updateCount() { st.counter.textContent = 'Marked: ' + count(); }

  /* ---------- the countdown bar (marking time) ---------- */

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
  function timerHide() { if (st) { st.timer.hidden = true; st.timer.classList.remove('is-running', 'is-stopped'); } }

  /* ---------- view functions ---------- */

  function describe(item) {
    var ms = def.timeLimit(item.params);
    return 'A grid of ' + item.rows + ' by ' + item.cols + ' squares. Some squares are filled for ' + Math.round(item.exposureMs / 1000) +
      ' seconds, then the grid empties. Mark the squares that were filled: tap them, or move with the arrow keys and press Space; confirm with Enter' +
      (ms ? '; up to ' + Math.round(ms / 1000) + ' seconds to mark.' : '.');
  }

  function mount(ctx) {
    var phase = h('p.pm-phase', { 'aria-live': 'polite' });
    var svg = S.svg(10, 10, { class: 'pm-svg', 'aria-hidden': 'true', focusable: 'false' });
    var wrap = h('div.pm-wrap', { tabindex: '0', role: 'group', 'aria-label': 'Pattern grid', 'data-px-keys': '' }, svg);
    var verdict = h('div.ex-verdict.pm-verdict', { hidden: true, role: 'status' });
    var stage = h('div.ex-stage.pm-stage', h('span.ex-label', 'Pattern'), wrap, verdict);
    var timer = h('div.pr-timer', { 'aria-hidden': 'true', hidden: true }, h('div.pr-timer-fill'));
    var counter = h('span.pm-count', { 'aria-live': 'polite' });
    var confirm = PX.ui.button('Confirm', { kind: 'primary', key: 'Enter', onClick: function () { submit('pointer'); } });
    confirm.setAttribute('data-px-keys', '');
    var bar = h('div.pm-actions', counter, confirm);
    var caption = h('p.ex-caption', { 'aria-live': 'polite' }), desc = h('p.px-sr');
    var root = h('div.ex-patterns-stem', phase, stage, timer, bar, caption, desc);
    ctx.host.appendChild(root);
    st = { ctx: ctx, root: root, phase: phase, svg: svg, wrap: wrap, verdict: verdict, stage: stage, timer: timer, timerFill: timer.firstChild,
      counter: counter, confirm: confirm, bar: bar, caption: caption, desc: desc, item: null, cells: [], marks: {}, cursor: 0,
      accepting: false, respond: null, popKeys: null, exposure: null, mode: null };
    // One listener for every cell: taps and clicks toggle (pointer targets are whole squares).
    svg.addEventListener('click', function (ev) {
      var g = ev.target && ev.target.closest ? ev.target.closest('.pm-cell') : null;
      if (!g || !st.accepting) return;
      st.cursor = Number(g.getAttribute('data-id'));
      toggle(st.item, st.cursor, false);
    });
  }

  function toggle(item, id, showCur) {
    if (st.marks[id]) delete st.marks[id]; else st.marks[id] = true;
    paint(item, 'empty', st.marks);
    showCursor(item, showCur);
    updateCount();
  }

  function present(item, ctx) {
    if (!st) mount(ctx);
    stopCollect();
    st.item = item;
    st.marks = {};
    st.cursor = 0;
    st.exposure = null;
    st.root.classList.remove('is-revealed');
    st.verdict.hidden = true;
    st.caption.textContent = '';
    st.desc.textContent = describe(item);
    buildGrid(item);
    paint(item, 'pattern', null);
    showCursor(item, false);
    timerHide();
    st.bar.hidden = true;
    st.phase.textContent = cap('exposeLook');
    var token = st.token = {};
    // The exposure: from the paint of the pattern to the frame that shows the empty grid.
    // Unmounted during it (Skip, Stop the check): unmount() stops the loop and resolves.
    return timing.nextPaint().then(function (t0) {
      return new Promise(function (resolve) {
        if (!st || st.token !== token) { resolve(t0); return; }
        var last = t0, maxGap = 0, half = 8;
        st.pending = function () { resolve(t0); };
        st.loopStop = timing.loop(function (dt, now) {
          if (!st || st.token !== token) { resolve(t0); return false; }
          maxGap = Math.max(maxGap, now - last);
          last = now;
          if (now - t0 < item.exposureMs - half) return true;
          var swap = now - t0; // the empty grid shows from the next frame on
          st.loopStop = null;
          paint(item, 'empty', null);
          st.phase.textContent = cap('exposeMark');
          st.bar.hidden = false;
          updateCount();
          timerStart(item);
          timing.nextPaint().then(function (t1) {
            if (st && st.token === token) st.exposure = { swapMs: Math.round(swap), paintMs: Math.round(t1 - t0), maxGapMs: Math.round(maxGap), stutter: maxGap > 100 };
            resolve(t1);
          });
          return false;
        });
      });
    });
  }

  function collect(item, ctx, respond) {
    if (!st || st.item !== item) return;
    st.respond = respond;
    st.accepting = true;
    var n = item.rows * item.cols;
    function move(dr, dc) {
      var r = Math.floor(st.cursor / item.cols), c = st.cursor % item.cols;
      r = U.clamp(r + dr, 0, item.rows - 1); c = U.clamp(c + dc, 0, item.cols - 1);
      st.cursor = r * item.cols + c;
      showCursor(item, true);
    }
    var map = {
      ArrowUp: function () { move(-1, 0); }, ArrowDown: function () { move(1, 0); },
      ArrowLeft: function () { move(0, -1); }, ArrowRight: function () { move(0, 1); },
      Space: function () { if (!st.accepting) return false; toggle(item, st.cursor, true); },
      Enter: function () { if (!st.accepting) return false; submit('key'); },
      repeat: ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'],
    };
    if (ctx.keys && ctx.keys.push) st.popKeys = ctx.keys.push(map, { through: true });
    try { st.wrap.focus({ preventScroll: true }); } catch (e) { /* focus is a convenience */ }
    void n;
  }
  function stopCollect() {
    if (!st) return;
    st.accepting = false;
    if (st.popKeys) { st.popKeys(); st.popKeys = null; }
  }
  function submit(source) {
    if (!st || !st.accepting || !st.respond) return;
    var ids = Object.keys(st.marks).map(Number).sort(function (a, b) { return a - b; }), respond = st.respond;
    st.respond = null;
    stopCollect();
    showCursor(st.item, false);
    respond(ids, source);
  }

  function marksOf(response) {
    var m = {};
    (Array.isArray(response) ? response : []).forEach(function (id) { if (Number.isInteger(id)) m[id] = true; });
    return m;
  }

  /* ---------- reveal (development; the Check shows nothing), ≤ 700 ms ---------- */

  function reveal(item, response, result, ctx) {
    if (!st) return Promise.resolve();
    stopCollect();
    timerStop();
    st.root.classList.add('is-revealed');
    st.bar.hidden = true;
    st.phase.textContent = '';
    paint(item, 'reveal', marksOf(response));
    showCursor(item, false);
    var d = (result && result.detail) || {};
    st.verdict.textContent = result && result.correct ? '✓ ' + cap('right', { k: item.k }) :
      '→ ' + (d.hits || 0) + ' of ' + item.k + ' found' + (d.falseAlarms ? ', ' + d.falseAlarms + ' extra' : '');
    st.verdict.setAttribute('data-kind', 'same');
    st.verdict.hidden = false;
    return timing.wait(ctx && ctx.fast ? 0 : 250);
  }

  /* ---------- show me and the worked example ---------- */

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
    var marks = marksOf(response), right = item.key.every(function (id) { return marks[id]; }) && Object.keys(marks).length === item.k;
    return play([
      { ms: 1600, caption: cap('again'), enter: function () { paint(item, 'pattern', null); } },
      { ms: 1800, caption: right ? cap('right', { k: item.k }) : cap('diff'), enter: function () { paint(item, 'reveal', marks); } },
    ], ctx, { name: 'show-me' });
  }

  // The one-screen instruction's worked example (learn.demo: a fixed seed the Check never scores):
  // the pattern for its real 3 s, the empty grid, the filled cells marked one by one, confirm.
  function demo(item, ctx, caption) {
    if (!st || st.item !== item) return Promise.resolve();
    var was = st.accepting;
    st.accepting = false;
    timerStop();
    var order = item.key.slice(), demoMarks = {};
    return play([
      { ms: item.exposureMs, caption: cap('look'), enter: function () { paint(item, 'pattern', null); showCursor(item, false); } },
      { ms: 1500, caption: cap('empty'), enter: function () { demoMarks = {}; paint(item, 'empty', demoMarks); } },
      {
        ms: 600 * order.length, caption: cap('mark'),
        enter: function () { demoMarks = {}; paint(item, 'empty', demoMarks); },
        update: function (k) {
          var n = Math.min(order.length, Math.floor(k * order.length + 1e-9));
          demoMarks = {};
          for (var i = 0; i < n; i++) demoMarks[order[i]] = true;
          paint(item, 'empty', demoMarks);
          if (n) { st.cursor = order[n - 1]; showCursor(item, true); }
        },
      },
      { ms: 1500, caption: cap('confirm'), enter: function () { paint(item, 'empty', demoMarks); } },
    ], ctx, { name: 'demo', caption: caption || null }).then(function () {
      if (!st) return;
      st.marks = {};
      paint(item, 'empty', st.marks);
      showCursor(item, false);
      updateCount();
      st.accepting = was;
    });
  }

  function unmount() {
    if (!st) return;
    stopCollect();
    st.token = null;
    if (st.loopStop) { st.loopStop(); st.loopStop = null; }
    var pending = st.pending;
    st.pending = null;
    if (st.root.parentNode) st.root.parentNode.removeChild(st.root);
    st = null;
    if (pending) pending(); // a present() cut short resolves (its caller has moved on)
  }

  PX.ex.view('patterns', {
    layout: 'custom',
    css: true,
    mount: mount,
    present: present,
    collect: collect,
    reveal: reveal,
    showMe: showMe,
    demo: demo,
    unmount: unmount,
    // for the player and tests: the measured exposure of the current item
    exposure: function () { return st && st.exposure ? Object.assign({}, st.exposure) : null; },
    marked: function () { return st ? Object.keys(st.marks).map(Number).sort(function (a, b) { return a - b; }) : []; },
  });
})(window.PX);
