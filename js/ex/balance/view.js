/* PR-8 Balance: view (SVG; layout 'custom'; ARCHITECTURE.md §6, docs/dev/EXERCISE-GUIDE.md). A Lab check: no
   feedback, no worked example (learn.js says why).
   - centroid: a square board, 100 units a side, with its dots; median: a street from 0 to 100 with its houses above it.
   - collect(): a tap or click places the marker (a ring and cross on the board, a stop sign under the street) and a
     drag moves it; the arrow keys move it by one unit (Shift: five; the first press places it in the middle); Confirm
     (or Enter) answers once a marker is down. respond({ x, y }, { input, amode: 'place' | 'keys' }); y is 0 on the
     street.
   - The item's time limit runs as a calm bar under the figure (as in the other probes), paused with the player.
   - reveal (development only; the check shows nothing) marks the key and the answer. */
(function (PX) {
  'use strict';

  var timing = PX.core.timing, S = PX.core.svg, h = PX.ui.h, U = PX.util;
  var def = PX.ex.get('balance');
  var st = null;

  function learn() { return PX.ex.learn('balance') || {}; }
  function kindOf(item) { return item && item.params && item.params.variant === 'median' ? 'median' : 'centroid'; }
  function el(name, attrs) { return S.el(name, attrs || {}); }

  /* ---------- drawing ---------- */
  function drawBoard(item) {
    var svg = st.svg;
    svg.setAttribute('viewBox', '-3 -3 106 106');
    svg.appendChild(el('rect', { x: 0, y: 0, width: 100, height: 100, rx: 1.2, class: 'bl-board' }));
    item.dots.forEach(function (p) { svg.appendChild(el('circle', { cx: p[0], cy: p[1], r: 2.1, class: 'bl-dot' })); });
  }
  function house(x) {
    var g = el('g', { class: 'bl-house', transform: 'translate(' + x + ' 0)' });
    g.appendChild(el('path', { d: 'M -1.6 -1 L -1.6 -4.2 L 0 -6 L 1.6 -4.2 L 1.6 -1 Z', class: 'bl-house-body' }));
    return g;
  }
  function drawStreet(item) {
    var svg = st.svg;
    svg.setAttribute('viewBox', '-3 -9 106 21');
    svg.appendChild(el('rect', { x: -3, y: -9, width: 106, height: 21, class: 'bl-hit' }));
    svg.appendChild(el('line', { x1: 0, y1: 0, x2: 100, y2: 0, class: 'bl-street' }));
    item.houses.forEach(function (x) { svg.appendChild(house(x)); });
  }
  function marker(kind) {
    var g = el('g', { class: 'bl-marker', 'pointer-events': 'none' });
    if (kind === 'median') {
      g.appendChild(el('line', { x1: 0, y1: 0, x2: 0, y2: 6.2, class: 'bl-pole' }));
      g.appendChild(el('circle', { cx: 0, cy: 7.4, r: 1.7, class: 'bl-sign' }));
    } else {
      g.appendChild(el('circle', { cx: 0, cy: 0, r: 3.2, class: 'bl-ring' }));
      g.appendChild(el('path', { d: 'M -5 0 L -1.4 0 M 1.4 0 L 5 0 M 0 -5 L 0 -1.4 M 0 1.4 L 0 5', class: 'bl-cross' }));
    }
    return g;
  }
  function place(x, y) {
    var item = st.item, med = kindOf(item) === 'median';
    x = U.clamp(Math.round(x * 10) / 10, 0, 100);
    y = med ? 0 : U.clamp(Math.round(y * 10) / 10, 0, 100);
    st.at = { x: x, y: y };
    if (!st.mark) { st.mark = marker(kindOf(item)); st.svg.appendChild(st.mark); }
    st.mark.setAttribute('transform', 'translate(' + x + ' ' + y + ')');
    st.confirm.disabled = false;
    st.root.classList.add('has-marker');
  }
  function toUnits(ev) {
    var m = st.svg.getScreenCTM && st.svg.getScreenCTM();
    if (!m) return null;
    var pt = st.svg.createSVGPoint ? st.svg.createSVGPoint() : null;
    if (!pt) return null;
    pt.x = ev.clientX; pt.y = ev.clientY;
    var p = pt.matrixTransform(m.inverse());
    return { x: p.x, y: p.y };
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
  function prompt(item) {
    var g = learn().goals || {};
    return kindOf(item) === 'median' ? 'Where should the bus stop go, so that the total walk from all the houses is as short as possible?' :
      'Where is the balance point of these dots, if every dot weighs the same?';
  }
  function describe(item) {
    var ms = def.timeLimit(item.params);
    return (kindOf(item) === 'median' ? 'A street with ' + item.houses.length + ' houses. Tap the street where the bus stop should go so that the total walk from all the houses is least.' :
      'A board with ' + item.dots.length + ' dots. Tap the balance point, where the board would balance if every dot weighed the same.') +
      ' Arrow keys move the marker; Enter confirms' + (ms ? '; up to ' + Math.round(ms / 1000) + ' seconds.' : '.');
  }

  function mount(ctx) {
    var q = h('p.bl-prompt');
    var svg = S.svg(100, 100, { class: 'bl-svg', 'aria-hidden': 'true', focusable: 'false' });
    var wrap = h('div.bl-wrap', { tabindex: '0', role: 'group', 'aria-label': 'Answer area', 'data-px-keys': '' }, svg);
    var verdict = h('div.ex-verdict.bl-verdict', { hidden: true, role: 'status' });
    var stage = h('div.ex-stage.bl-stage', wrap, verdict);
    var timer = h('div.pr-timer', { 'aria-hidden': 'true', hidden: true }, h('div.pr-timer-fill'));
    var hint = h('span.bl-hint', 'Tap to place · drag or arrow keys to adjust');
    var confirm = PX.ui.button('Confirm', { kind: 'primary', key: 'Enter', onClick: function () { submit('pointer'); } });
    confirm.setAttribute('data-px-keys', '');
    var bar = h('div.bl-actions', hint, confirm);
    var caption = h('p.ex-caption', { 'aria-live': 'polite' }), desc = h('p.px-sr');
    var root = h('div.ex-balance-stem', q, stage, timer, bar, caption, desc);
    ctx.host.appendChild(root);
    st = { ctx: ctx, root: root, q: q, svg: svg, wrap: wrap, verdict: verdict, stage: stage, timer: timer, timerFill: timer.firstChild,
      hint: hint, confirm: confirm, bar: bar, caption: caption, desc: desc, item: null, at: null, mark: null, accepting: false,
      respond: null, popKeys: null, drag: false, how: 'place' };
    svg.addEventListener('pointerdown', function (ev) {
      if (!st || !st.accepting) return;
      var p = toUnits(ev);
      if (!p) return;
      st.drag = true;
      st.how = 'place';
      st.input = ev.pointerType || 'pointer';
      try { svg.setPointerCapture(ev.pointerId); } catch (e) { /* capture is a convenience */ }
      place(p.x, p.y);
      ev.preventDefault();
    });
    svg.addEventListener('pointermove', function (ev) {
      if (!st || !st.accepting || !st.drag) return;
      var p = toUnits(ev);
      if (p) place(p.x, p.y);
    });
    function up() { if (st) st.drag = false; }
    svg.addEventListener('pointerup', up);
    svg.addEventListener('pointercancel', up);
  }

  function present(item, ctx) {
    if (!st) mount(ctx);
    stopCollect();
    st.item = item;
    st.at = null;
    st.mark = null;
    st.root.classList.remove('is-revealed', 'has-marker');
    st.root.setAttribute('data-kind', kindOf(item));
    PX.ui.clear(st.svg);
    if (kindOf(item) === 'median') drawStreet(item); else drawBoard(item);
    st.q.textContent = prompt(item);
    st.desc.textContent = describe(item);
    st.verdict.hidden = true;
    st.caption.textContent = '';
    st.bar.hidden = false;
    st.confirm.disabled = true;
    timerStart(item);
    return timing.nextPaint();
  }

  function collect(item, ctx, respond) {
    if (!st || st.item !== item) return;
    st.respond = respond;
    st.accepting = true;
    function move(dx, dy, ev) {
      if (!st.accepting) return false;
      var k = ev && ev.shiftKey ? 5 : 1;
      st.how = 'keys';
      st.input = 'key';
      if (!st.at) place(50, kindOf(item) === 'median' ? 0 : 50);
      else place(st.at.x + dx * k, st.at.y + dy * k);
    }
    var map = {
      ArrowUp: function (ev) { return move(0, -1, ev); }, ArrowDown: function (ev) { return move(0, 1, ev); },
      ArrowLeft: function (ev) { return move(-1, 0, ev); }, ArrowRight: function (ev) { return move(1, 0, ev); },
      Enter: function () { if (!st.accepting) return false; submit('key'); },
      repeat: ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'],
    };
    if (ctx.keys && ctx.keys.push) st.popKeys = ctx.keys.push(map, { through: true });
    try { st.wrap.focus({ preventScroll: true }); } catch (e) { /* focus is a convenience */ }
  }
  function stopCollect() {
    if (!st) return;
    st.accepting = false;
    st.drag = false;
    if (st.popKeys) { st.popKeys(); st.popKeys = null; }
  }
  function submit(source) {
    if (!st || !st.accepting || !st.respond || !st.at) return;
    var respond = st.respond, at = { x: st.at.x, y: st.at.y };
    st.respond = null;
    stopCollect();
    respond(at, { input: source === 'key' ? 'key' : st.input || source, amode: st.how === 'keys' ? 'keys' : 'place' });
  }

  /* ---------- reveal (development; the check shows nothing), ≤ 700 ms ---------- */
  function reveal(item, response, result, ctx) {
    if (!st) return Promise.resolve();
    stopCollect();
    timerStop();
    st.root.classList.add('is-revealed');
    st.bar.hidden = true;
    var k = item.key, g = el('g', { class: 'bl-key', transform: 'translate(' + k.x + ' ' + k.y + ')', 'pointer-events': 'none' });
    g.appendChild(el('circle', { cx: 0, cy: 0, r: kindOf(item) === 'median' ? 1.2 : 1.6, class: 'bl-key-dot' }));
    st.svg.appendChild(g);
    st.verdict.textContent = (result && result.correct ? '✓ ' : '→ ') + (kindOf(item) === 'median' ? 'The middle house: the least total walk.' : 'The mean of the dots.');
    st.verdict.hidden = false;
    return timing.wait(ctx && ctx.fast ? 0 : 250);
  }

  function unmount() {
    if (!st) return;
    stopCollect();
    if (st.root.parentNode) st.root.parentNode.removeChild(st.root);
    st = null;
  }

  PX.ex.view('balance', {
    layout: 'custom',
    css: true,
    mount: mount,
    present: present,
    collect: collect,
    reveal: reveal,
    unmount: unmount,
    // for tests: where the marker is
    marker: function () { return st && st.at ? { x: st.at.x, y: st.at.y } : null; },
  });
})(window.PX);
