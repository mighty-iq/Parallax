/* PR-7 Motion Graphs: view (DOM and SVG; ARCHITECTURE.md §6, docs/dev/EXERCISE-GUIDE.md).
   layout 'stem+options': the stem holds the question line and a strobe picture (a track with numbered dots, one per
   flash) or a graph over time; the grid holds four graphs or four strobe pictures. Graphs carry no numbers: each is
   drawn to its own height (velocities about a dashed zero line), as the validator compares them. The item's time
   limit runs as a calm bar under the stem; the Check gives no feedback (reveal is a development aid). */
(function (PX) {
  'use strict';

  var timing = PX.core.timing, h = PX.ui.h, SV = PX.core.svg;
  var def = PX.ex.get('motiongraphs'), lib = def.lib;
  var st = null;

  function prompt(item) {
    if (item.kind === 'pos') return 'The dots show where a cart was at seven flashes, one second apart. Which graph shows its position over time (higher: farther right)?';
    if (item.kind === 'vel') return 'The dots show where a cart was at seven flashes, one second apart. Which graph shows its velocity over time (above the dashed line: moving right; below: moving left; on it: standing still)?';
    if (item.kind === 'strobe') return 'The graph shows a cart\'s position over time (higher: farther right). Which strobe picture shows the same motion?';
    var u = Math.abs(item.bus);
    return 'A bus drives past ' + (item.bus > 0 ? 'to the right' : 'to the left') + ', ' + (u === 1 ? 'one mark' : u + ' marks') + ' per flash. Which strobe picture would someone on the bus see?';
  }

  function svgBox(x0, y0, w, hgt, cls) { return SV.el('svg', { viewBox: [x0, y0, w, hgt].join(' '), class: cls, 'aria-hidden': 'true', focusable: 'false', preserveAspectRatio: 'xMidYMid meet' }); }
  function line(a, b, cls) { return SV.el('line', { x1: a[0], y1: a[1], x2: b[0], y2: b[1], class: cls }); }

  // a strobe picture, in HTML so its numbers keep their size on any screen: the track from lo to hi (a tick at every
  // mark), a dot per flash (the first hollow), its number above or, where dots are close, in rows alternating below
  // and above; the bus (frame items) under the track with its arrow
  function strobe(xs, lo, hi, opts) {
    opts = opts || {};
    var pad = 0.7, W = hi - lo + 2 * pad, near = W / 11, rows = [], place = [];
    function pct(x) { return ((x - (lo - pad)) / W * 100).toFixed(2) + '%'; }
    xs.forEach(function (x) {
      var r = 0;
      while (rows[r] !== undefined && rows[r].some(function (p) { return Math.abs(p - x) < near; })) r++;
      (rows[r] = rows[r] || []).push(x);
      place.push(r);
    });
    var up = Math.ceil(Math.max(1, rows.length) / 2), down = Math.floor(rows.length / 2);
    var box = h('span.mg-strobe' + (opts.cls ? '.' + opts.cls : ''), { 'aria-hidden': 'true', style: '--up:' + up + ';--down:' + (down + (opts.bus ? 1 : 0)) });
    var track = h('span.mg-track');
    box.appendChild(track);
    for (var m = Math.ceil(lo); m <= Math.floor(hi); m++) track.appendChild(h('span.mg-tick', { style: 'left:' + pct(m) }));
    xs.forEach(function (x, k) {
      track.appendChild(h('span.mg-dot' + (k === 0 ? '.is-first' : ''), { style: 'left:' + pct(x) }));
      var r = place[k], side = r % 2 ? 'below' : 'above', lvl = Math.floor(r / 2);
      track.appendChild(h('span.mg-num.is-' + side, { style: 'left:' + pct(x) + ';--row:' + lvl }, String(k + 1)));
    });
    if (opts.bus) {
      var d = opts.bus > 0 ? 1 : -1, at = d > 0 ? lo + 0.4 : hi - 0.4;
      track.appendChild(h('span.mg-busbox' + (d > 0 ? '.is-right' : '.is-left'), { style: 'left:' + pct(at) + ';--row:' + down }, h('span.mg-bus'), h('span.mg-busarrow')));
    }
    return box;
  }

  // a graph over time: seven marked times; positions to their own range, velocities about the zero line
  function graph(ys, vel) {
    var W = 6, H = 3, s = svgBox(-0.5, -0.4, W + 1, H + 0.8, 'mg-graph' + (vel ? ' is-vel' : ''));
    var n = vel ? lib.normVel(ys) : lib.normPos(ys);
    var pts = n.map(function (v, k) { return [k, vel ? H / 2 - v * (H / 2 - 0.1) : H - 0.1 - v * (H - 0.2)]; });
    s.appendChild(line([0, -0.25], [0, H + 0.05], 'mg-axis'));
    s.appendChild(line([0, H + 0.05], [W + 0.3, H + 0.05], 'mg-axis'));
    for (var k = 0; k < 7; k++) s.appendChild(line([k, H - 0.05], [k, H + 0.15], 'mg-tick'));
    if (vel) s.appendChild(line([0, H / 2], [W + 0.2, H / 2], 'mg-zero'));
    s.appendChild(SV.path(pts, false, { class: 'mg-curve' }));
    pts.forEach(function (p) { s.appendChild(SV.el('circle', { cx: p[0], cy: p[1], r: 0.09, class: 'mg-pt' })); });
    return s;
  }
  function range(list) {
    var lo = Infinity, hi = -Infinity;
    list.forEach(function (xs) { xs.forEach(function (x) { lo = Math.min(lo, x); hi = Math.max(hi, x); }); });
    return [Math.floor(lo), Math.ceil(hi)];
  }

  function timerStart(item) {
    var ms = def.timeLimit(item.params) + (item.extraMs > 0 ? item.extraMs : 0); // extraMs: the Check's time for a kind's line
    st.timer.hidden = !ms;
    st.timer.classList.remove('is-running', 'is-stopped');
    if (!ms) return;
    st.timerFill.style.animationDuration = ms + 'ms';
    void st.timerFill.offsetWidth;
    st.timer.classList.add('is-running');
  }
  function timerStop() { if (st) st.timer.classList.add('is-stopped'); }

  function mount(ctx) {
    var q = h('p.mg-prompt'), hint = h('p.ex-kindhint', { hidden: true }), pic = h('div.mg-pic');
    var verdict = h('div.ex-verdict.mg-verdict', { hidden: true, role: 'status' });
    var stage = h('div.ex-stage.mg-stage', q, hint, pic, verdict);
    var timer = h('div.pr-timer', { 'aria-hidden': 'true', hidden: true }, h('div.pr-timer-fill'));
    var caption = h('p.ex-caption', { 'aria-live': 'polite' }), desc = h('p.px-sr');
    var root = h('div.ex-motiongraphs-stem', stage, timer, caption, desc);
    ctx.host.appendChild(root);
    st = { root: root, q: q, hint: hint, pic: pic, verdict: verdict, timer: timer, timerFill: timer.firstChild, caption: caption, desc: desc, item: null, opts: [] };
  }

  function present(item, ctx) {
    if (!st) mount(ctx);
    if (st.item !== item) { st.item = item; st.opts = []; }
    PX.ui.clear(st.pic);
    st.root.setAttribute('data-kind', item.kind);
    st.q.textContent = prompt(item);
    var t = typeof item.hint === 'string' ? item.hint : ''; // the first item of a kind in the Check: the kind's line
    PX.ui.clear(st.hint);
    if (t) { st.hint.appendChild(h('b', 'New kind. ')); st.hint.appendChild(document.createTextNode(t)); }
    st.hint.hidden = !t;
    st.root.classList.toggle('has-kindhint', !!t); // the picture gives up the line's height
    if (item.kind === 'strobe') st.pic.appendChild(graph(item.x, false));
    else st.pic.appendChild(strobe(item.x, 0, 12, { bus: item.kind === 'frame' ? item.bus : null, cls: 'is-stem' }));
    st.root.classList.remove('is-revealed');
    st.verdict.hidden = true;
    st.caption.textContent = '';
    var ms = def.timeLimit(item.params) + (item.extraMs > 0 ? item.extraMs : 0);
    st.desc.textContent = prompt(item) + (t ? ' ' + t : '') + ' Choose one of four (keys 1 to 4)' + (ms ? '; up to ' + Math.round(ms / 1000) + ' seconds.' : '.');
    timerStart(item);
    return timing.nextPaint();
  }

  function drawOption(el, item, i, ctx) {
    if (!st) mount(ctx);
    if (st.item !== item) { st.item = item; st.opts = []; }
    var o = item.options[i], pic;
    if (item.kind === 'pos') pic = graph(o, false);
    else if (item.kind === 'vel') pic = graph(o, true);
    else {
      // each picture to its own stretch of track (at least 6 marks): the shapes decide, as in the validator
      var r = range([o]);
      if (r[1] - r[0] < 6) { var c = (r[0] + r[1]) / 2; r = [Math.floor(c - 3), Math.ceil(c + 3)]; }
      pic = strobe(o, r[0], r[1]);
    }
    var box = h('span.ex-answer.mg-answer', pic);
    el.appendChild(box);
    st.opts[i] = box;
  }
  function optionLabel(item, i) { return (item.kind === 'pos' || item.kind === 'vel' ? 'Graph ' : 'Picture ') + (i + 1); }
  function gridCols() { return 2; }
  function focusOption(i) { st.opts.forEach(function (o, j) { var c = o && o.closest ? o.closest('.px-choice') : null; if (c) c.classList.toggle('ex-focus', j === i); }); }

  function reveal(item, response, result, ctx) {
    if (!st) return Promise.resolve();
    timerStop();
    st.verdict.textContent = (result && result.correct ? '✓ ' : '→ ') + optionLabel(item, item.key) + ' is the answer.';
    st.verdict.hidden = false;
    focusOption(item.key);
    return timing.wait(ctx && ctx.fast ? 0 : 250);
  }

  function demo(item, ctx, caption) {
    if (!st || st.item !== item) return Promise.resolve();
    timerStop();
    var L = PX.ex.learn('motiongraphs') || {}, ex = (L.explain || {})[item.kind] || [];
    var list = [{ ms: 2400, caption: prompt(item), at: -1 }].concat(ex.map(function (t) { return { ms: 3000, caption: t, at: -1 }; }))
      .concat([{ ms: 2400, caption: 'So the answer is ' + optionLabel(item, item.key).toLowerCase() + '.', at: item.key }])
      .map(function (s) { return { ms: s.ms, caption: s.caption, enter: function () { focusOption(s.at); } }; });
    var o = { name: 'demo', caption: caption || function (t) { if (st) st.caption.textContent = t; } };
    var run = ctx && typeof ctx.play === 'function' ? ctx.play(list, o) : new Promise(function (resolve) {
      var i = 0;
      (function step() {
        if (i >= list.length) { resolve(); return; }
        var s = list[i++];
        if (o.caption) o.caption(s.caption);
        s.enter();
        timing.wait(ctx && ctx.fast ? 0 : s.ms).then(step);
      })();
    });
    return run.then(function () { focusOption(-1); });
  }

  function unmount() {
    if (!st) return;
    if (st.root.parentNode) st.root.parentNode.removeChild(st.root);
    st = null;
  }

  PX.ex.view('motiongraphs', {
    layout: 'stem+options', css: true, mount: mount, present: present, drawOption: drawOption, optionLabel: optionLabel,
    gridCols: gridCols, reveal: reveal, demo: demo, unmount: unmount,
  });
})(window.PX);
