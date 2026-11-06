/* EX-09 Block Span: view (SVG; ARCHITECTURE.md §6, docs/dev/EXERCISE-GUIDE.md).
   layout 'custom': present() plays the stimulus and resolves with the paint timestamp of the
   recall board, so the answer clock starts when tapping can start:
     lead-in (pace.lead) → each block lit pace.on ms with a steady highlight, then dark pace.off ms
     (1 Hz, never faster than 3 Hz) → hold (pace.hold) → the board turns (pace.turnMs) → recall.
   Everything is drawn from the item: blocks at item.blocks, turning about the board centre to
   item.after (block ids stay on the blocks); the reveal numbers and show-me come from item.seq and
   item.key, the same data score() uses.
   - Recall: tap a block (the nearest centre within 95 board units, half the minimum spacing, so
     targets never overlap; the board is at least 232 px wide, so targets are ≥ 44 px) or press the
     number on it. Labels 1–9 appear only during recall, numbered in reading order of the board as
     it is then (after the turn), so they never encode the shown order. Backspace undoes the last
     tap, Enter ends early, and the last tap of the sequence submits.
   - Reveal: numbered feedback. Every block of the key shows its place in the right order (a solid
     disc where the tap was right, a dashed ring where it was missed); wrong taps get a ✗ tag with
     their tap number.
   - Show me and demo: steps for ctx.play: the path in the shown order, the turn, the order to tap.
   - The stimulus runs on timing.loop dt (paused while the tab is hidden); ctx.fast runs it at 2 %;
     reduced motion keeps it (the turn is the task) and only shortens show me (ctx.play). */
(function (PX) {
  'use strict';

  var timing = PX.core.timing, S = PX.core.svg, h = PX.ui.h;
  var def = PX.ex.get('span'), lib = def.lib;
  var SIZE = lib.SIZE, MID = SIZE / 2, HALF = lib.BLOCK / 2, HIT = lib.SEP / 2;
  var IDS = [0, 1, 2, 3, 4, 5, 6, 7, 8];
  var PHASES = { watch: 'Watch', turn: 'The board turns', recall: 'Your turn', reveal: 'Answer', showme: 'Show me' };
  var st = null; // the mounted view (the player mounts one exercise at a time)

  function learn() { return PX.ex.learn('span') || {}; }
  function cap(key, n) { return String((learn().captions || {})[key] || '').replace('{n}', n === undefined ? '' : n); }
  function ease(k) { return k * k * (3 - 2 * k); }
  function r2(x) { return Math.round(x * 100) / 100; }
  function finalDeg(item) { return item.turn * item.dir; }
  function turnName(item) { return item.turn === 180 ? 'halfway round (180°)' : 'a quarter turn ' + (item.dir > 0 ? 'clockwise' : 'anticlockwise'); }

  // Block id's centre with the board turned by a degrees (SVG rotate(): positive is clockwise,
  // y down). The end points are the item's own integer positions.
  function posAt(item, id, a) {
    if (!a) return item.blocks[id];
    if (a === finalDeg(item)) return item.after[id];
    var r = a * Math.PI / 180, c = Math.cos(r), s = Math.sin(r), p = item.blocks[id], x = p[0] - MID, y = p[1] - MID;
    return [MID + x * c - y * s, MID + x * s + y * c];
  }

  /* ---------- the board ---------- */

  function mount(ctx) {
    var svg = S.svg(SIZE, SIZE, { class: 'ex-span-board', 'aria-hidden': 'true' });
    var root = h('div.ex-span-stem');
    var phaseEl = h('p.ex-span-phase', { 'aria-hidden': 'true' });
    var stage = h('div.ex-stage.ex-span-stage', svg);
    var progress = h('div.ex-span-progress', { 'aria-hidden': 'true' });
    var count = h('span.px-sr', { 'aria-live': 'polite' });
    var undo = PX.ui.button('Undo', { kind: 'secondary', small: true, key: 'Backspace', onClick: function () { undoTap(); } });
    var done = PX.ui.button('Done', { kind: 'secondary', small: true, key: 'Enter', onClick: function () { finish('pointer'); } });
    var actions = h('div.ex-span-actions', progress, h('div.ex-span-buttons', undo, done));
    var hint = h('p.ex-span-hint');
    var verdict = h('div.ex-verdict.ex-span-verdict', { hidden: true, role: 'status' });
    var caption = h('p.ex-caption', { 'aria-live': 'polite' });
    var desc = h('p.px-sr');
    root.appendChild(phaseEl); root.appendChild(stage); root.appendChild(actions); root.appendChild(count); root.appendChild(hint);
    root.appendChild(verdict); root.appendChild(caption); root.appendChild(desc);
    ctx.host.appendChild(root);
    st = {
      ctx: ctx, root: root, stage: stage, svg: svg, phaseLabel: phaseEl, progress: progress, count: count,
      undo: undo, done: done, actions: actions, hint: hint, verdict: verdict, caption: caption, desc: desc,
      item: null, token: 0, blocks: [], angle: 0, taps: [], respond: null, popKeys: null, collecting: false,
      playing: false, byLabel: {}, revealed: null, stopLoop: null, pending: null,
    };
    svg.addEventListener('pointerdown', onPointer);
  }

  function phase(name) {
    st.root.setAttribute('data-phase', name);
    st.phaseLabel.textContent = PHASES[name] || '';
  }

  // Plate (it turns with the board; the notch shows how far), the path layer, the blocks (squares
  // turn with the board) and an upright layer per block for labels, tap marks and numbers.
  function build(item) {
    var svg = st.svg;
    while (svg.firstChild) svg.removeChild(svg.firstChild);
    st.plate = S.el('g', { class: 'ex-span-plate-g' }, [
      // Round, so the turning board never leaves its square stage; every block lies inside it at any
      // angle (gen.js keeps centres within RMAX). The notch marks the top as the board turns.
      S.el('circle', { class: 'ex-span-plate', cx: MID, cy: MID, r: lib.PLATE }),
      S.el('path', { class: 'ex-span-notch', d: 'M' + (MID - 30) + ' ' + (MID - lib.PLATE) + ' L' + MID + ' ' + (MID - lib.PLATE + 30) + ' L' + (MID + 30) + ' ' + (MID - lib.PLATE) + ' Z' }),
    ]);
    st.pathEl = S.el('polyline', { class: 'ex-span-path', points: '' });
    st.blocksG = S.el('g', { class: 'ex-span-blocks' });
    st.tagsG = S.el('g', { class: 'ex-span-tags' });
    svg.appendChild(st.plate); svg.appendChild(st.pathEl); svg.appendChild(st.blocksG); svg.appendChild(st.tagsG);
    st.blocks = item.blocks.map(function (p, id) {
      var g = S.el('g', { class: 'ex-span-block', 'data-id': id }, [
        S.el('rect', { x: -HALF, y: -HALF, width: lib.BLOCK, height: lib.BLOCK, rx: 12 }),
        S.el('circle', { class: 'ex-span-dot', r: 15 }),
      ]);
      var label = S.text(0, 2, '', { class: 'ex-span-label' });
      var tapped = S.el('circle', { class: 'ex-span-tapped', cx: HALF - 18, cy: HALF - 18, r: 9 });
      var tag = S.el('g', { class: 'ex-span-tag', 'data-id': id }, [label, tapped]);
      st.blocksG.appendChild(g);
      st.tagsG.appendChild(tag);
      return { g: g, tag: tag, label: label, marks: null };
    });
    st.pathN = 0;
    st.angle = 0;
  }

  // Draws the board turned by a degrees.
  function place(a) {
    var item = st.item;
    st.angle = a;
    if (a) st.plate.setAttribute('transform', 'rotate(' + r2(a) + ' ' + MID + ' ' + MID + ')');
    else st.plate.removeAttribute('transform');
    st.blocks.forEach(function (b, id) {
      var p = posAt(item, id, a), t = 'translate(' + r2(p[0]) + ' ' + r2(p[1]) + ')';
      b.g.setAttribute('transform', a ? t + ' rotate(' + r2(a) + ')' : t);
      b.tag.setAttribute('transform', t);
    });
    drawPath();
  }

  // The path through the shown order up to pathN steps (fractional: the last step part-drawn).
  function drawPath() {
    var item = st.item, n = st.pathN, pts = [];
    if (n > 0) {
      var seq = item.seq, whole = Math.floor(n);
      for (var i = 0; i <= Math.min(whole, seq.length - 1); i++) pts.push(posAt(item, seq[i], st.angle));
      if (whole < seq.length - 1 && n > whole) {
        var a = posAt(item, seq[whole], st.angle), b = posAt(item, seq[whole + 1], st.angle), f = n - whole;
        pts.push([a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f]);
      }
    }
    st.pathEl.setAttribute('points', pts.map(function (p) { return r2(p[0]) + ',' + r2(p[1]); }).join(' '));
  }

  function light(id) { st.blocks.forEach(function (b, j) { b.g.classList.toggle('is-lit', j === id); }); }

  // Keyboard labels 1–9 in reading order of the recall board (top to bottom, then left to right).
  function showLabels(on) {
    var order = lib.readingOrder(st.item.after, IDS);
    st.byLabel = {};
    order.forEach(function (id, rank) {
      st.byLabel[rank + 1] = id;
      st.blocks[id].label.textContent = on ? String(rank + 1) : '';
      st.blocks[id].tag.setAttribute('data-label', String(rank + 1));
    });
    st.root.classList.toggle('has-labels', !!on);
  }

  // Numbered marks on a block: { n, kind: 'right' | 'missed' } in the middle, wrong tap numbers
  // in a ✗ tag at the corner.
  function clearMarks() {
    st.numSig = null;
    st.blocks.forEach(function (b) {
      if (b.marks) { b.tag.removeChild(b.marks); b.marks = null; }
      b.g.classList.remove('is-lit', 'is-pressed', 'is-tapped');
      b.tag.classList.remove('is-tapped');
    });
  }
  function mark(id, disc, wrong) {
    var b = st.blocks[id], g = S.el('g', { class: 'ex-span-marks' });
    if (disc) {
      g.appendChild(S.el('circle', { class: 'ex-span-disc ex-span-disc--' + disc.kind, r: 38 }));
      g.appendChild(S.text(0, 2, String(disc.n), { class: 'ex-span-num ex-span-num--' + disc.kind }));
    }
    if (wrong && wrong.length) {
      // At the block's top right corner, or top left for blocks on the right, so it stays on the stage.
      var txt = '✗' + wrong.join(','), w = 30 + 22 * txt.length, p = st.item.after[id];
      var x0 = p && p[0] > MID + 200 ? -HALF + 14 - w : HALF - 14;
      g.appendChild(S.el('rect', { class: 'ex-span-wrongtag', x: x0, y: -HALF - 26, width: w, height: 46, rx: 8 }));
      g.appendChild(S.text(x0 + w / 2, -HALF - 2, txt, { class: 'ex-span-wrongtxt' }));
    }
    if (b.marks) b.tag.removeChild(b.marks);
    b.tag.appendChild(g);
    b.marks = g;
  }

  function describe(item) {
    return 'A board of nine blocks. ' + item.len + ' of them light up one at a time' +
      (item.turn ? ', then the board turns ' + turnName(item) : '') + '. Then tap them ' +
      (item.order === 'backward' ? 'in reverse order, the last one first' : 'in the same order') +
      ', or press the number shown on each block.';
  }

  /* ---------- present: the stimulus, then the recall board ---------- */

  function present(item, ctx) {
    if (!st) mount(ctx);
    stopAll();
    var token = ++st.token;
    st.item = item;
    st.ctx = ctx;
    st.taps = [];
    st.revealed = null;
    build(item);
    place(0);
    st.root.setAttribute('data-order', item.order);
    st.root.setAttribute('data-turn', String(item.turn));
    st.root.removeAttribute('data-input');
    st.verdict.hidden = true;
    st.caption.textContent = '';
    st.desc.textContent = describe(item);
    st.hint.textContent = '';
    setProgress();
    st.actions.hidden = true;
    showLabels(false);
    phase('watch');
    var scale = ctx && ctx.fast ? 0.02 : 1, p = item.pace, ev = [], t = p.lead * scale;
    item.seq.forEach(function (id) {
      ev.push({ at: t, id: id });
      t += p.on * scale;
      ev.push({ at: t, id: -1 });
      t += p.off * scale;
    });
    var turnAt = t + p.hold * scale, turnMs = p.turnMs * scale, end = turnAt + turnMs, a1 = finalDeg(item);
    return new Promise(function (resolve) {
      var k = 0, el = 0, turning = false;
      st.pending = resolve;
      st.stopLoop = timing.loop(function (dt) {
        if (!st || token !== st.token) return false;
        el += dt;
        while (k < ev.length && ev[k].at <= el) { light(ev[k].id); k++; }
        if (el >= turnAt && turnMs > 0 && el < end) {
          if (!turning) { turning = true; phase('turn'); }
          place(a1 * ease((el - turnAt) / turnMs));
        }
        if (el < end) return true;
        st.stopLoop = null;
        recallBoard();
        timing.nextPaint().then(function (ts) { if (st && st.pending === resolve) st.pending = null; resolve(ts); });
        return false;
      });
    });
  }

  // The board as it is for recall: turned to the end (the plate keeps its angle), labels shown.
  function recallBoard() {
    var item = st.item;
    light(-1);
    st.pathN = 0;
    place(finalDeg(item));
    showLabels(true);
    st.hint.textContent = 'Tap the blocks ' + (item.order === 'backward' ? 'in reverse order' : 'in order') +
      (st.ctx && st.ctx.settings && st.ctx.settings.keyHints === false ? '' : ' · or press their numbers 1–9');
    st.actions.hidden = false;
    setProgress();
    phase('recall');
  }

  function setProgress() {
    var L = st.item ? st.item.len : 0, n = st.taps.length;
    while (st.progress.firstChild) st.progress.removeChild(st.progress.firstChild);
    for (var i = 0; i < L; i++) st.progress.appendChild(h('span.ex-span-slot' + (i < n ? '.is-filled' : '')));
    st.count.textContent = n ? n + ' of ' + L + ' taps' : '';
    st.undo.disabled = !st.collecting || !n;
    st.done.disabled = !st.collecting;
  }

  /* ---------- recall: taps and keys ---------- */

  function collect(item, ctx, respond) {
    if (!st || st.item !== item) return;
    st.respond = respond;
    st.collecting = true;
    st.taps = [];
    var map = {
      Backspace: function () { return undoTap() ? undefined : false; },
      Enter: function () { return finish('key') ? undefined : false; },
    };
    for (var d = 1; d <= 9; d++) {
      map[String(d)] = (function (n) {
        return function () {
          var id = st && st.byLabel[n];
          return id !== undefined && tapBlock(id, 'key') ? undefined : false;
        };
      })(d);
    }
    st.popKeys = ctx && ctx.keys ? ctx.keys.push(map, { through: true }) : null;
    setProgress();
  }

  function toBoard(e) {
    var svg = st.svg;
    try {
      var m = svg.getScreenCTM && svg.getScreenCTM();
      if (m) {
        var pt = svg.createSVGPoint();
        pt.x = e.clientX; pt.y = e.clientY;
        var q = pt.matrixTransform(m.inverse());
        return [q.x, q.y];
      }
    } catch (err) { /* below: the box is square, so this mapping is exact too */ }
    var r = svg.getBoundingClientRect();
    return [(e.clientX - r.left) / r.width * SIZE, (e.clientY - r.top) / r.height * SIZE];
  }

  // The block whose centre is nearest, within half the minimum spacing (so never ambiguous).
  function nearest(p) {
    var best = -1, bd = HIT * HIT, pos = st.item.after;
    for (var id = 0; id < pos.length; id++) {
      var dx = pos[id][0] - p[0], dy = pos[id][1] - p[1], d = dx * dx + dy * dy;
      if (d <= bd) { bd = d; best = id; }
    }
    return best;
  }

  function onPointer(e) {
    if (!st || !st.collecting || st.playing || !st.item) return;
    var id = nearest(toBoard(e));
    if (id < 0) return;
    if (e.cancelable) e.preventDefault();
    tapBlock(id, e.pointerType === 'touch' ? 'touch' : 'pointer');
  }

  function tapBlock(id, source) {
    if (!st || !st.collecting || st.playing) return false;
    st.taps.push(id);
    var g = st.blocks[id].g, tok = st.token;
    g.classList.add('is-tapped', 'is-pressed'); // one steady 220 ms press highlight, never a flash cycle
    st.blocks[id].tag.classList.add('is-tapped');
    timing.wait(st.ctx && st.ctx.fast ? 0 : 220).then(function () { if (st && st.token === tok) g.classList.remove('is-pressed'); });
    st.lastSource = source;
    setProgress();
    if (st.taps.length >= st.item.len) finish(source);
    return true;
  }

  function undoTap() {
    if (!st || !st.collecting || st.playing || !st.taps.length) return false;
    var id = st.taps.pop();
    if (st.taps.indexOf(id) < 0) { st.blocks[id].g.classList.remove('is-tapped'); st.blocks[id].tag.classList.remove('is-tapped'); }
    setProgress();
    return true;
  }

  function finish(source) {
    if (!st || !st.collecting || st.playing) return false;
    var resp = st.taps.slice(), respond = st.respond;
    stopInput();
    st.root.setAttribute('data-input', source || st.lastSource || 'pointer');
    if (respond) respond(resp);
    return true;
  }

  function stopInput() {
    if (!st) return;
    st.collecting = false;
    st.respond = null;
    if (st.popKeys) { st.popKeys(); st.popKeys = null; }
    setProgress();
  }

  // Ends a running presentation (a stale promise resolves at once) and the input of the trial.
  function stopAll() {
    if (!st) return;
    st.token++;
    if (st.stopLoop) { st.stopLoop(); st.stopLoop = null; }
    if (st.pending) { var r = st.pending; st.pending = null; r(timing.now()); }
    stopInput();
  }

  /* ---------- reveal: numbered feedback, ≤ 700 ms ---------- */

  function reveal(item, response, result, ctx) {
    if (!st || st.item !== item) return Promise.resolve();
    stopInput();
    st.revealed = { response: Array.isArray(response) ? response.slice() : [], result: result || { correct: false, value: 0 } };
    paintReveal();
    return timing.wait(ctx && ctx.fast ? 0 : 250);
  }

  function paintReveal() {
    var item = st.item, rv = st.revealed, resp = rv.response, wrong = {};
    clearMarks();
    showLabels(false);
    st.root.classList.remove('is-faint-path');
    st.pathN = 0;
    place(finalDeg(item));
    phase('reveal');
    resp.forEach(function (id, i) {
      if (id !== item.key[i] && typeof id === 'number' && st.blocks[id]) (wrong[id] = wrong[id] || []).push(i + 1);
    });
    item.key.forEach(function (id, i) {
      mark(id, { n: i + 1, kind: resp[i] === id ? 'right' : 'missed' }, wrong[id]);
      delete wrong[id];
    });
    Object.keys(wrong).forEach(function (id) { mark(+id, null, wrong[id]); });
    var ok = !!rv.result.correct, v = typeof rv.result.value === 'number' ? rv.result.value : 0, L = item.len;
    st.verdict.textContent = ok ? '✓ All ' + L + ' in the right order'
      : v ? '✗ Right for the first ' + v + ' of ' + L + ': the numbers show the order'
        : '✗ Not this order: the numbers show the right one';
    st.verdict.setAttribute('data-kind', ok ? 'right' : 'wrong');
    st.verdict.hidden = false;
    st.actions.hidden = true;
    st.hint.textContent = 'Numbers give the right order: a solid disc where your tap was right, a dashed ring where it was missed' +
      (Object.keys(wrong).length || resp.some(function (id, i) { return id !== item.key[i]; }) ? '; ✗n marks where your tap n went.' : '.');
  }

  /* ---------- show me and demo (steps for ctx.play) ---------- */

  // Numbers on blocks: list of { id, n }, all of one kind ('seq' shown order, 'key' tap order).
  function setNums(list, kind) {
    var sig = kind + list.length;
    if (st.numSig === sig) return; // unchanged since the last frame: no DOM work
    st.numSig = sig;
    st.blocks.forEach(function (b) { if (b.marks) { b.tag.removeChild(b.marks); b.marks = null; } });
    list.forEach(function (x) { mark(x.id, { n: x.n, kind: kind }, null); });
  }
  function nums(order, upto) { return order.slice(0, upto).map(function (id, i) { return { id: id, n: i + 1 }; }); }

  // The full state of a show-me frame: board angle, path length, numbers; nothing lit.
  function showBoard(a, pathN, list, kind) {
    clearMarks();
    showLabels(false);
    st.root.classList.remove('is-faint-path');
    st.verdict.hidden = true;
    st.hint.textContent = ''; // the reveal legend does not apply here; the step caption explains
    st.pathN = pathN;
    place(a);
    setNums(list, kind || 'seq');
    phase('showme');
  }

  function steps(item, response, demoMode) {
    var L = item.len, a1 = finalDeg(item), list = [];
    list.push({
      ms: Math.max(1500, 450 * L),
      caption: cap('path'),
      enter: function () { showBoard(0, 0, nums(item.seq, 1)); },
      update: function (k) {
        var n = k * (L - 1);
        st.pathN = n;
        drawPath();
        setNums(nums(item.seq, Math.min(L, Math.floor(n + 1e-9) + 1)), 'seq');
      },
      exit: function () { st.pathN = L - 1; drawPath(); setNums(nums(item.seq, L), 'seq'); },
    });
    if (item.turn) {
      list.push({
        ms: 1300,
        caption: cap('turn', turnName(item)),
        enter: function () { showBoard(0, L - 1, nums(item.seq, L)); },
        update: function (k) { place(a1 * ease(k)); },
        exit: function () { place(a1); },
      });
    }
    list.push({
      ms: Math.max(1500, 400 * L),
      caption: item.order === 'backward' ? cap('backward') : item.turn ? cap('after') : cap('forward'),
      enter: function () { showBoard(a1, L - 1, nums(item.key, 1), 'key'); st.root.classList.add('is-faint-path'); },
      update: function (k) { setNums(nums(item.key, Math.min(L, Math.floor(k * L + 1e-9) + 1)), 'key'); },
      exit: function () { setNums(nums(item.key, L), 'key'); },
    });
    if (!demoMode && st.revealed) {
      var rv = st.revealed, v = typeof rv.result.value === 'number' ? rv.result.value : 0;
      list.push({ ms: 1800, caption: rv.result.correct ? cap('right') : v ? cap('compare', v) : cap('none'), enter: function () { paintReveal(); } });
    }
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
    st.playing = true;
    var p = ctx && typeof ctx.play === 'function' ? ctx.play(list, o) : runSteps(list, ctx, o);
    return Promise.resolve(p).then(function () { if (st) st.playing = false; }, function (e) { if (st) st.playing = false; throw e; });
  }

  function showMe(item, response, ctx) {
    if (!st || st.item !== item) return Promise.resolve();
    return play(steps(item, response, false), ctx, { name: 'show-me' }).then(function () {
      if (st && st.item === item && st.revealed) paintReveal();
    });
  }

  // Tutorial: the parts, the lighting again, the solution; then the board waits for taps.
  function demo(item, ctx, caption) {
    if (!st || st.item !== item) return Promise.resolve();
    var L = item.len, intro = [
      { ms: 1800, caption: cap('board'), enter: function () { showBoard(0, 0, []); st.phaseLabel.classList.add('is-pointed'); }, exit: function () { st.phaseLabel.classList.remove('is-pointed'); } },
      { // the real rhythm: each block on for 700 ms, then 300 ms off
        ms: L * (item.pace.on + item.pace.off), caption: cap('watch'), enter: function () { showBoard(0, 0, []); },
        update: function (k) {
          var t = k * L, i = Math.floor(t);
          light(i < L && t - i < item.pace.on / (item.pace.on + item.pace.off) ? item.seq[i] : -1);
        },
        exit: function () { light(-1); },
      },
    ];
    var list = intro.concat(steps(item, null, true), [{ ms: 1200, caption: cap('try'), enter: function () { clearMarks(); st.pathN = 0; place(finalDeg(item)); } }]);
    return play(list, ctx, { name: 'demo', caption: caption || null }).then(function () {
      if (!st || st.item !== item) return;
      clearMarks();
      st.root.classList.remove('is-faint-path');
      st.pathN = 0;
      place(finalDeg(item));
      if (st.collecting) recallBoard(); else if (st.revealed) paintReveal();
    });
  }

  function unmount() {
    if (!st) return;
    stopAll();
    st.svg.removeEventListener('pointerdown', onPointer);
    if (st.root.parentNode) st.root.parentNode.removeChild(st.root);
    st = null;
  }

  PX.ex.view('span', {
    layout: 'custom',
    css: true,
    mount: mount,
    present: present,
    collect: collect,
    reveal: reveal,
    showMe: showMe,
    demo: demo,
    unmount: unmount,
    // for tests: the steps show me would play (same data as the key)
    steps: function (item, response) { return st ? steps(item, response, false) : []; },
  });
})(window.PX);
