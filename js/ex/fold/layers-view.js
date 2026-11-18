/* Fold, the produce variant 'mark' (v1.2 wave 2, W2-bets; PLAN milestone 4, CONTRACT-v1.2 S, note T1 §4.3).
   The fold strip stays as in every Fold item; under it, a blank unfolded sheet where the player marks
   the holes: a tap marks a square, a second tap clears it; arrows move the cursor, Space marks, Enter
   checks. Every square is a whole target (the sheet spans the screen's width on a phone: 44 px and up).
   The reveal draws the truth on the same sheet: marks that are holes filled and ringed in green, missed
   holes as dashed rings, extra marks crossed out. Show me unfolds the paper as for the choose form.
   js/ex/fold/view.js calls these through its 'mark' block with its own pieces (api). */
(function (PX) {
  'use strict';
  var h = PX.ui.h, timing = PX.core.timing;
  var M = 0.06;   // the sheet's margin in cells: 8.12 cells across, so 44 px squares from 357 px wide
  var cur = null; // the item being marked

  var T = {
    task: 'Tap each square that will be a hole.',
    keys: 'Keys: arrows move, Space marks, Enter checks.',
    done: 'Flat again: these are all the holes. Your marks are on the sheet below.',
  };
  function plural(n, one, many) { return n + ' ' + (n === 1 ? one : many); }

  function prepare(item, ctx, api) {
    stop();
    var st = api.st(), S = api.S, N = api.N;
    var svg = api.sheet([], [-M, -M, N + 2 * M, N + 2 * M], 'bets-fold-svg');
    svg.setAttribute('aria-hidden', 'true');
    var marks = S.el('g', { class: 'bets-fold-marks' }), cursor = S.el('rect', { x: 0, y: 0, width: 1, height: 1, class: 'bets-fold-cursor' });
    svg.appendChild(marks); svg.appendChild(cursor);
    var wrap = h('div.bets-fold-board', { tabindex: '0', role: 'group', 'aria-label': 'Blank sheet: mark the holes', 'data-px-keys': '' }, svg);
    var count = h('span.bets-draw-count', { 'aria-live': 'polite' }, 'Marked: 0');
    var clear = PX.ui.button('Clear', { kind: 'ghost', small: true, onClick: function () { if (cur && cur.accepting) { cur.marks = {}; paint(); } } });
    var check = PX.ui.button('Check', { kind: 'primary', key: 'Enter', onClick: function () { submit(); } });
    check.setAttribute('data-px-keys', '');
    check.disabled = true;
    var verdict = h('div.ex-verdict.bets-draw-verdict', { hidden: true, role: 'status' });
    var root = h('div.bets-draw.bets-fold', { 'data-produce': 'fold' },
      h('p.bets-draw-task', T.task), wrap, h('div.bets-draw-actions', count, clear, check), verdict, h('p.px-meta.bets-draw-keys', T.keys));
    st.root.appendChild(root);
    if (st.desc) st.desc.textContent = 'A square sheet of ' + N + ' by ' + N + ' squares is folded ' + plural(item.folds.length, 'time', 'times') +
      ' and punched ' + plural(item.punches.length, 'time', 'times') + '. Mark the holes on the blank sheet: tap the squares, or move with the arrow keys and press Space; check with Enter.';
    cur = { item: item, api: api, root: root, svg: svg, wrap: wrap, marksG: marks, cursorEl: cursor, count: count, clear: clear, check: check, verdict: verdict,
      marks: {}, cursor: 0, accepting: false, respond: null, popKeys: null };
    wrap.addEventListener('click', function (ev) {
      if (!cur || !cur.accepting) return;
      var c = cellAt(ev);
      if (c === null) return;
      cur.cursor = c;
      toggle(c, false);
    });
    paint();
  }

  // The square under a click: anywhere on the sheet, margins included, belongs to its nearest square.
  function cellAt(ev) {
    var r = cur.svg.getBoundingClientRect(), N = cur.api.N, W = N + 2 * M;
    if (!r.width || !r.height) return null;
    var x = (ev.clientX - r.left) / r.width * W - M, y = (ev.clientY - r.top) / r.height * W - M;
    var i = Math.min(N - 1, Math.max(0, Math.floor(x))), j = Math.min(N - 1, Math.max(0, Math.floor(y)));
    return j * N + i;
  }

  function toggle(c, keyed) {
    if (cur.marks[c]) delete cur.marks[c]; else cur.marks[c] = true;
    paint(keyed);
  }

  function paint(showCursor) {
    var S = cur.api.S, N = cur.api.N, g = cur.marksG, ids = Object.keys(cur.marks);
    while (g.firstChild) g.removeChild(g.firstChild);
    ids.forEach(function (k) { var c = +k; g.appendChild(cur.api.hole([c % N, Math.floor(c / N)], 'bets-fold-mark')); });
    cur.count.textContent = 'Marked: ' + ids.length;
    cur.check.disabled = !cur.accepting || !ids.length;
    cur.clear.disabled = !cur.accepting || !ids.length;
    var i = cur.cursor % N, j = Math.floor(cur.cursor / N);
    cur.cursorEl.setAttribute('x', i); cur.cursorEl.setAttribute('y', j);
    cur.cursorEl.classList.toggle('is-on', !!showCursor);
    void S;
  }

  function collect(item, ctx, respond, api) {
    if (!cur || cur.item !== item) prepare(item, ctx, api);
    cur.respond = respond;
    cur.accepting = true;
    var N = api.N;
    function move(di, dj) {
      var i = cur.cursor % N, j = Math.floor(cur.cursor / N);
      i = Math.min(N - 1, Math.max(0, i + di)); j = Math.min(N - 1, Math.max(0, j + dj));
      cur.cursor = j * N + i;
      paint(true);
    }
    if (cur.popKeys) cur.popKeys();
    cur.popKeys = ctx.keys && ctx.keys.push ? ctx.keys.push({
      ArrowLeft: function () { move(-1, 0); }, ArrowRight: function () { move(1, 0); },
      ArrowUp: function () { move(0, -1); }, ArrowDown: function () { move(0, 1); },
      Space: function () { if (!cur || !cur.accepting) return false; toggle(cur.cursor, true); },
      Enter: function () { if (!cur || !cur.accepting) return false; submit(); },
      repeat: ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'],
    }, { through: true }) : null;
    paint(false);
  }

  function submit() {
    if (!cur || !cur.accepting || !cur.respond) return;
    var ids = Object.keys(cur.marks).map(Number).sort(function (a, b) { return a - b; });
    if (!ids.length) return;
    var respond = cur.respond;
    cur.respond = null;
    stopInput();
    paint(false);
    respond(ids, { amode: 'place', frames: null }); // still pictures: no frame verdict (it cannot change what was seen)
  }

  function stopInput() {
    if (!cur) return;
    cur.accepting = false;
    if (cur.popKeys) { cur.popKeys(); cur.popKeys = null; }
  }
  // Before every item (a choose item after a mark item keeps no board) and at unmount.
  function stop() {
    stopInput();
    if (cur && cur.root && cur.root.parentNode) cur.root.parentNode.removeChild(cur.root);
    cur = null;
  }

  function reveal(item, response, result, ctx, api) {
    if (!cur || cur.item !== item) return Promise.resolve();
    stopInput();
    var S = api.S, N = api.N, g = cur.marksG, got = {};
    (Array.isArray(response) ? response : []).forEach(function (c) { got[c] = true; });
    while (g.firstChild) g.removeChild(g.firstChild);
    var key = {}, right = 0, missed = 0, extra = 0;
    item.key.forEach(function (c) {
      key[c] = true;
      var cell = [c % N, Math.floor(c / N)];
      if (got[c]) { right++; g.appendChild(api.hole(cell, 'bets-fold-mark is-right')); g.appendChild(api.ring(cell, 'bets-fold-ring is-right')); }
      else { missed++; g.appendChild(api.ring(cell, 'bets-fold-ring is-missed')); }
    });
    Object.keys(got).forEach(function (k) {
      var c = +k;
      if (key[c]) return;
      extra++;
      var x = c % N + 0.5, y = Math.floor(c / N) + 0.5, r = 0.3;
      g.appendChild(api.hole([c % N, Math.floor(c / N)], 'bets-fold-mark is-extra'));
      g.appendChild(S.el('path', { d: 'M' + (x - r) + ' ' + (y - r) + 'L' + (x + r) + ' ' + (y + r) + 'M' + (x - r) + ' ' + (y + r) + 'L' + (x + r) + ' ' + (y - r), class: 'bets-fold-cross' }));
    });
    cur.cursorEl.classList.remove('is-on');
    cur.check.disabled = true; cur.clear.disabled = true;
    var n = item.key.length;
    cur.verdict.textContent = result && result.correct ? '✓ All ' + plural(n, 'hole', 'holes') + ', nothing extra.'
      : right + ' of ' + plural(n, 'hole', 'holes') + ' marked' + (missed ? '; ' + missed + ' missed (dashed rings)' : '') + (extra ? '; ' + extra + ' extra (crossed out)' : '') + '.';
    cur.verdict.setAttribute('data-kind', result && result.correct ? 'key' : 'foil');
    cur.verdict.hidden = false;
    cur.root.classList.add('is-revealed');
    return timing.wait(ctx && ctx.fast ? 0 : 250);
  }

  function showMe(item, response, ctx, api) {
    var clone = {};
    for (var k in item) if (Object.prototype.hasOwnProperty.call(item, k)) clone[k] = item[k];
    clone.key = 0; // the steps name the right sheet by its index: here it is the sheet below
    var list = api.steps(clone, null);
    if (list.length) list[list.length - 1].caption = T.done;
    return api.play(list, ctx, { name: 'show-me' });
  }

  PX.ui.betsDraw = PX.ui.betsDraw || {};
  PX.ui.betsDraw.fold = { prepare: prepare, collect: collect, reveal: reveal, showMe: showMe, stop: stop, T: T };
})(window.PX);
