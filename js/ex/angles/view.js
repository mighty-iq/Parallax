/* EX-16 Angles: view (SVG; ARCHITECTURE.md §6, docs/dev/EXERCISE-GUIDE.md).
   layout 'stem+options': the stem is four numbered cells (2 × 2 on phones, a row on wide screens),
   each with one angle drawn from the item's own endpoints (cell units, 1 × 1); the options are
   orderings of the numbers, smallest angle first.
   - Strokes keep 2 CSS px at any size (vector-effect), anti-aliased; no arc at the vertex.
   - Reveal: every angle's size in degrees under its number, from the grading model.
   - Show me: the angles in order with their sizes, then the pair that decides the item (the one
     the key's nearest wrong list swaps) laid on top of each other, corners and one arm lined up,
     so the wider opening shows; then the order and the answer. All from item.angles / lib.measure.
   - Colours come from CSS tokens (css/ex/angles.css), so a theme change needs no redraw. */
(function (PX) {
  'use strict';

  var timing = PX.core.timing, U = PX.util, S = PX.core.svg;
  var h = PX.ui.h;
  var def = PX.ex.get('angles'), lib = def.lib;
  var st = null;

  function learn() { return PX.ex.learn('angles') || {}; }
  function cap(key, vars) {
    var s = String((learn().captions || {})[key] || '');
    Object.keys(vars || {}).forEach(function (k) { s = s.split('{' + k + '}').join(String(vars[k])); });
    return s;
  }
  function fmtDeg(d) { return (Math.round(d * 10) / 10).toFixed(1).replace(/\.0$/, '') + '°'; }
  function listText(order) { return order.map(function (c) { return c + 1; }).join(' – '); }
  function narrow() { return (window.innerWidth || 1024) < 720; }

  /* ---------- drawing ---------- */

  function cellSvg(g, cls) {
    var svg = S.svg(1, 1, { viewBox: [0, 0, 1, 1], class: 'ex-angles-svg ' + (cls || ''), width: '100%' });
    svg.appendChild(S.el('path', { d: 'M' + g.a[0] + ' ' + g.a[1] + 'L' + g.v[0] + ' ' + g.v[1] + 'L' + g.b[0] + ' ' + g.b[1], class: 'ex-angles-arms' }));
    return svg;
  }
  // An arc of radius rad at vertex v from direction u to direction w (unit vectors), the short way.
  function arcPath(v, u, w, rad) {
    var p0 = [v[0] + rad * u[0], v[1] + rad * u[1]], p1 = [v[0] + rad * w[0], v[1] + rad * w[1]];
    var cr = u[0] * w[1] - u[1] * w[0];
    return 'M' + p0[0] + ' ' + p0[1] + 'A' + rad + ' ' + rad + ' 0 0 ' + (cr > 0 ? 1 : 0) + ' ' + p1[0] + ' ' + p1[1];
  }
  function unitOf(v, p) { var dx = p[0] - v[0], dy = p[1] - v[1], l = Math.sqrt(dx * dx + dy * dy) || 1; return [dx / l, dy / l]; }

  // Two angles laid corner on corner, first arms along +x: the smaller in ink, the larger dashed,
  // and the extra opening between their free arms shaded. Sizes in degrees from the model. The
  // view box fits the figure, so obtuse pairs stay in view.
  function overlaySvg(small, large) {
    var R = 1, v = [0, 0];
    function dir(d) { var sc = lib.sincos(d); return [sc[1], -sc[0]]; }
    var u0 = [1, 0], uS = dir(small.deg), uL = dir(large.deg);
    var pts = [v, [R, 0], [R * uS[0], R * uS[1]], [R * uL[0], R * uL[1]]];
    var x0 = Math.min.apply(null, pts.map(function (q) { return q[0]; })), x1 = Math.max.apply(null, pts.map(function (q) { return q[0]; }));
    var y0 = Math.min.apply(null, pts.map(function (q) { return q[1]; })), y1 = Math.max.apply(null, pts.map(function (q) { return q[1]; }));
    var m = 0.2, vb = [x0 - m, y0 - m, x1 - x0 + 2 * m, y1 - y0 + 2 * m];
    var svg = S.svg(vb[2], vb[3], { viewBox: vb, class: 'ex-angles-svg ex-angles-svg--big', width: '100%' });
    var wedge = 'M0 0L' + R * uS[0] + ' ' + R * uS[1] + 'L' + R * uL[0] + ' ' + R * uL[1] + 'Z';
    svg.appendChild(S.el('path', { d: wedge, class: 'ex-angles-wedge' }));
    svg.appendChild(S.el('path', { d: 'M' + R * u0[0] + ' 0L0 0L' + R * uS[0] + ' ' + R * uS[1], class: 'ex-angles-arms' }));
    svg.appendChild(S.el('path', { d: 'M0 0L' + R * uL[0] + ' ' + R * uL[1], class: 'ex-angles-arms ex-angles-arms--large' }));
    svg.appendChild(S.el('path', { d: arcPath(v, uS, uL, 0.4), class: 'ex-angles-arc' }));
    svg.appendChild(S.text(1.1 * uS[0], 1.1 * uS[1] + 0.03, String(small.n), { class: 'ex-angles-num' }));
    svg.appendChild(S.text(1.1 * uL[0], 1.1 * uL[1] + 0.03, String(large.n), { class: 'ex-angles-num ex-angles-num--large' }));
    svg.style.aspectRatio = vb[2] + ' / ' + vb[3];
    return svg;
  }

  function describe(item) {
    return 'Four angles, numbered 1 to 4, each in its own box. Which list orders them from the smallest angle to the largest? ' +
      item.options.map(function (o, i) { return 'Answer ' + (i + 1) + ': ' + listText(o) + '.'; }).join(' ');
  }

  /* ---------- view functions ---------- */

  function mount(ctx) {
    var root = h('div.ex-angles-stem');
    var cells = h('div.ex-angles-cells');
    var big = h('div.ex-angles-big', { hidden: true });
    var stage = h('div.ex-stage.ex-angles-stage', cells, big);
    var verdict = h('div.ex-verdict.ex-angles-verdict', { hidden: true, role: 'status' });
    var caption = h('p.ex-caption', { 'aria-live': 'polite' });
    var desc = h('p.px-sr');
    root.appendChild(stage);
    root.appendChild(h('div.ex-angles-under', caption, verdict));
    root.appendChild(desc);
    ctx.host.appendChild(root);
    st = { ctx: ctx, root: root, stage: stage, cells: cells, big: big, verdict: verdict, caption: caption, desc: desc,
      item: null, optItem: null, opts: [], cellEls: [], sizeEls: [] };
  }
  function setMode(mode) { st.cells.hidden = mode !== 'cells'; st.big.hidden = mode !== 'big'; }

  function drawCells(item) {
    PX.ui.clear(st.cells);
    st.cellEls = []; st.sizeEls = [];
    item.angles.forEach(function (g, c) {
      var num = h('span.ex-label.ex-angles-n', String(c + 1));
      var size = h('span.ex-angles-size', { hidden: true });
      var cell = h('div.ex-angles-cell', { 'data-cell': String(c + 1) }, num, cellSvg(g), size);
      st.cellEls.push(cell); st.sizeEls.push(size);
      st.cells.appendChild(cell);
    });
  }

  function present(item, ctx) {
    if (!st) mount(ctx);
    newItem(item);
    st.item = item;
    st.verdict.hidden = true;
    st.verdict.textContent = '';
    st.caption.textContent = '';
    st.desc.textContent = describe(item);
    st.root.classList.remove('is-revealed');
    drawCells(item);
    PX.ui.clear(st.big);
    setMode('cells');
    return timing.nextPaint();
  }

  function newItem(item) {
    if (st.optItem === item) return;
    st.optItem = item;
    st.opts = [];
  }
  function drawOption(el, item, i, ctx) {
    if (!st) mount(ctx);
    newItem(item);
    var tag = h('span.ex-tag', { hidden: true });
    el.appendChild(h('span.ex-answer.ex-angles-opt', h('span.ex-answer-text', listText(item.options[i])), tag));
    st.opts[i] = { el: el, tag: tag };
  }
  function optionLabel(item, i) { return 'Smallest to largest: ' + item.options[i].map(function (c) { return c + 1; }).join(', '); }
  function gridCols() { return narrow() ? 2 : 4; }

  /* ---------- reveal ---------- */

  function showSizes(item, on) {
    var m = lib.measure(item);
    st.sizeEls.forEach(function (el, c) { el.textContent = fmtDeg(m[c].deg); el.hidden = !on; });
  }
  function reveal(item, response, result, ctx) {
    if (!st) return Promise.resolve();
    st.root.classList.add('is-revealed');
    showSizes(item, true);
    st.opts.forEach(function (o, i) {
      if (!o) return;
      var key = i === item.key;
      o.tag.textContent = key ? '✓ In order' : 'Out of order';
      o.tag.setAttribute('data-kind', key ? 'key' : 'foil');
      o.tag.hidden = false;
    });
    st.verdict.textContent = '✓ Smallest to largest: ' + listText(item.order) + '.';
    st.verdict.setAttribute('data-kind', 'key');
    st.verdict.hidden = false;
    return timing.wait(ctx && ctx.fast ? 0 : 250);
  }

  /* ---------- show me ---------- */

  function focusOption(i) {
    st.opts.forEach(function (o, j) {
      if (!o) return;
      var b = o.el.closest ? o.el.closest('.px-choice') : null;
      if (b) b.classList.toggle('ex-focus', j === i);
    });
  }
  function point(cells) {
    st.cellEls.forEach(function (el, c) { el.classList.toggle('is-pointed', cells.indexOf(c) >= 0); });
  }
  // The pair a list orders wrongly by the largest margin (the easiest way to rule it out).
  function widest(o, m) {
    var best = null;
    for (var i = 0; i < 4; i++) for (var j = i + 1; j < 4; j++) {
      if (m[o[i]] > m[o[j]]) { var gap = m[o[i]] - m[o[j]]; if (!best || gap > best.gap) best = { small: o[j], large: o[i], gap: gap }; }
    }
    return best;
  }
  // The pair that decides the item: of the wrong lists, the one whose easiest refutation is the
  // closest (the judgement that has to be made); for a wrong answer, that answer's clearest error.
  function deciding(item, foil) {
    var m = lib.measure(item).map(function (x) { return x.deg; });
    if (foil !== undefined) return widest(item.options[foil], m);
    var best = null;
    item.options.forEach(function (o, i) {
      if (i === item.key) return;
      var w = widest(o, m);
      if (w && (!best || w.gap < best.gap)) best = w;
    });
    return best;
  }
  function overlayStep(item, pair, ms, captionKey, vars) {
    var m = lib.measure(item);
    return {
      ms: ms, caption: cap(captionKey, vars),
      enter: function () {
        setMode('big');
        PX.ui.clear(st.big);
        st.big.appendChild(overlaySvg({ deg: m[pair.small].deg, n: pair.small + 1 }, { deg: m[pair.large].deg, n: pair.large + 1 }));
      },
    };
  }
  function steps(item, response) {
    var m = lib.measure(item), out = [], pair = deciding(item);
    out.push({
      ms: 2200, caption: cap('order', { order: listText(item.order) }),
      enter: function () { setMode('cells'); focusOption(-1); showSizes(item, true); point(item.order.slice(0, 1)); },
      update: function (k) { point(item.order.slice(0, 1 + Math.min(3, Math.floor(k * 4)))); },
      exit: function () { point([]); },
    });
    if (pair) {
      var vars = { a: pair.small + 1, b: pair.large + 1, d: fmtDeg(pair.gap).replace('°', '') };
      out.push(overlayStep(item, pair, 1700, 'overlay', vars));
      out.push(overlayStep(item, pair, 1900, 'pair', vars));
    }
    out.push({
      ms: 1800, caption: cap('done', { order: listText(item.order), n: item.key + 1 }),
      enter: function () { setMode('cells'); showSizes(item, true); point([]); focusOption(item.key); },
    });
    var r = response;
    if (typeof r === 'number' && r !== item.key && r >= 0 && r < 4) {
      var wrong = deciding(item, r);
      if (wrong) {
        var wv = { n: r + 1, a: wrong.small + 1, b: wrong.large + 1, d: fmtDeg(wrong.gap).replace('°', '') };
        out.push({
          ms: 2400, caption: cap('chosen', wv),
          enter: function () {
            setMode('big'); focusOption(r); PX.ui.clear(st.big);
            st.big.appendChild(overlaySvg({ deg: m[wrong.small].deg, n: wrong.small + 1 }, { deg: m[wrong.large].deg, n: wrong.large + 1 }));
          },
        });
      }
    }
    return out;
  }

  function runSteps(list, ctx, opts) {
    var scale = ctx && ctx.fast ? 0.02 : 1;
    return new Promise(function (resolve) {
      var i = -1, start = 0, go = true;
      function begin(now) {
        i++;
        if (i >= list.length) { resolve(); return false; }
        start = now;
        var s = list[i];
        if (s.caption && opts && opts.caption) opts.caption(s.caption);
        if (s.enter) s.enter();
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
    return play(steps(item, response), ctx, { name: 'show-me' }).then(function () { if (st) { focusOption(-1); setMode('cells'); } });
  }
  function demo(item, ctx, caption) {
    if (!st || st.item !== item) return Promise.resolve();
    var intro = [
      { ms: 2200, caption: cap('angles'), enter: function () { setMode('cells'); focusOption(-1); showSizes(item, false); point([0, 1, 2, 3]); }, exit: function () { point([]); } },
      { ms: 2000, caption: cap('options'), enter: function () { setMode('cells'); point([]); } },
    ];
    return play(intro.concat(steps(item, null)), ctx, { name: 'demo', caption: caption || null })
      .then(function () { if (st) { focusOption(-1); setMode('cells'); } });
  }

  function unmount() {
    if (!st) return;
    if (st.root.parentNode) st.root.parentNode.removeChild(st.root);
    st = null;
  }

  PX.ex.view('angles', {
    layout: 'stem+options',
    css: true,
    mount: mount, present: present, drawOption: drawOption, optionLabel: optionLabel, gridCols: gridCols,
    reveal: reveal, showMe: showMe, demo: demo, unmount: unmount,
    steps: function (item, response) { return st ? steps(item, response) : []; },
  });
})(window.PX);
