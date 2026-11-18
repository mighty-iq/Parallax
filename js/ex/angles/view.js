/* EX-16 Angles: view (SVG; ARCHITECTURE.md §6, docs/dev/EXERCISE-GUIDE.md).
   layout 'stem+options': the stem is four cells lettered A–D (2 × 2 on phones, a row on wide
   screens), each with one angle drawn from the item's own endpoints (cell units, 1 × 1); the options
   are orderings of the letters, smallest angle first ("C – A – D – B"). Letters, not numbers, so an
   angle is never confused with an answer, whose keys are 1–4 (fresh-player test, RV-play-dat).
   - Strokes keep 2 CSS px at any size (vector-effect), anti-aliased; no arc at the vertex.
   - Reveal: every angle's size in degrees in a free corner of its cell, from the grading model.
   - Show me carries out the "Extremes first" card on the item (v1.2, docs/research/v1.2/
     D2-first-band.md §3.2), its captions numbered by the card's steps: the smallest angle marked
     and the answers that do not start with it crossed out, then the largest and the answers that do
     not end with it; if more than one answer is left, the pair they disagree on is laid on top of
     each other, corners and one arm lined up, so the wider opening shows; then the order and the
     answer. All from item.angles / lib.measure.
   - Try 1's first step done (ctx.assist = { smallest: true }; CONTRACT-v1.2 D): the smallest angle
     marked, the answers that do not start with it greyed and struck through (still answerable).
   - Rule figures (drawRule): the opening alone counts, under a straight line, smallest to largest.
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
  // The Watch and worked examples (v1.2, fresh-player check: at the 3-s floor a 20-word caption was
  // gone before it was read): a caption stays up for 1 s plus 0.27 s a word (about 220 words a
  // minute), at most 8 s; a step that moves keeps its pace and holds its last frame. Show me keeps
  // its pace: it replays steps already read, with Pause and Step.
  function readMs(text) {
    var n = String(text || '').split(/\s+/).filter(function (w) { return /[0-9A-Za-z]/.test(w); }).length;
    return Math.min(8000, 1000 + 270 * n);
  }
  function readable(list) {
    list.forEach(function (s) {
      if (!s || !s.caption) return;
      var m = s.ms || 0, need = readMs(s.read || s.caption), u = s.update;
      if (m >= need) return;
      s.ms = need;
      if (u && m > 0) s.update = function (k) { u(Math.min(1, k * need / m)); };
    });
    return list;
  }
  var LETTERS = ['A', 'B', 'C', 'D'];
  function letter(c) { return LETTERS[c]; }
  function listText(order) { return order.map(letter).join(' – '); }
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
    return 'Four angles, lettered A to D, each in its own box. Which list orders them from the smallest angle to the largest? ' +
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
      item: null, optItem: null, opts: [], cellEls: [], sizeEls: [], assist: false };
  }
  function setMode(mode) { st.cells.hidden = mode !== 'cells'; st.big.hidden = mode !== 'big'; }

  // Corners for the cell's number and the reveal's size label, clear of the arms. Boxes in cell
  // units, measured on a phone cell (about 150 px; on larger cells the labels take less room):
  // the number about 0.12 × 0.2 of the cell, the size about 0.38 × 0.16. A long arm reaches the
  // top-left number box in about 4 % of angles, and some corner is always free. Left corners come
  // first, so a moved number never sits right beside the next cell's number.
  var CORNERS = ['tl', 'bl', 'tr', 'br'];
  function segHitsBox(P, Q, x0, y0, x1, y1) {
    var t0 = 0, t1 = 1, dx = Q[0] - P[0], dy = Q[1] - P[1];
    var pp = [-dx, dx, -dy, dy], qq = [P[0] - x0, x1 - P[0], P[1] - y0, y1 - P[1]];
    for (var i = 0; i < 4; i++) {
      if (pp[i] === 0) { if (qq[i] < 0) return false; continue; }
      var r = qq[i] / pp[i];
      if (pp[i] < 0) { if (r > t1) return false; if (r > t0) t0 = r; } else { if (r < t0) return false; if (r < t1) t1 = r; }
    }
    return true;
  }
  function cornerFree(g, corner, w, hh) {
    var x0 = corner[1] === 'l' ? 0 : 1 - w, y0 = corner[0] === 't' ? 0 : 1 - hh;
    return !segHitsBox(g.v, g.a, x0, y0, x0 + w, y0 + hh) && !segHitsBox(g.v, g.b, x0, y0, x0 + w, y0 + hh);
  }
  function labelCorners(g) {
    var num = CORNERS.filter(function (k) { return cornerFree(g, k, 0.12, 0.2); })[0] || 'tl';
    var size = ['br', 'bl', 'tr', 'tl'].filter(function (k) { return k !== num && cornerFree(g, k, 0.38, 0.16); })[0] || (num === 'br' ? 'bl' : 'br');
    return [num, size];
  }

  function drawCells(item) {
    PX.ui.clear(st.cells);
    st.cellEls = []; st.sizeEls = [];
    item.angles.forEach(function (g, c) {
      var corners = labelCorners(g);
      var num = h('span.ex-label.ex-angles-n', { 'data-corner': corners[0] }, letter(c));
      var size = h('span.ex-angles-size', { hidden: true, 'data-corner': corners[1] });
      var cell = h('div.ex-angles-cell', { 'data-cell': letter(c) }, num, cellSvg(g), size);
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
    st.assist = !!(ctx && ctx.assist && ctx.assist.smallest);
    if (st.assist) {
      var small = item.order[0];
      st.cellEls[small].classList.add('is-assist');
      st.cellEls[small].appendChild(h('span.ex-angles-flag', { 'data-corner': st.sizeEls[small].getAttribute('data-corner') || 'br' }, 'smallest'));
      crossOut(item.options.map(function (o) { return o[0] !== small; }));
      st.caption.textContent = cap('assist');
      st.desc.textContent += ' The smallest angle is marked; the answers that do not start with it are greyed.';
    }
    return timing.nextPaint();
  }
  // Answers crossed out (greyed and struck through; still answerable): out[i] for option i.
  function crossOut(out) {
    st.opts.forEach(function (o, i) {
      if (!o) return;
      var b = o.el.closest ? o.el.closest('.px-choice') : null;
      if (b) b.classList.toggle('ex-angles-out', !!(out && out[i]));
    });
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
    // A no-break space binds each dash to the letter before it, so long text wraps after a dash.
    el.appendChild(h('span.ex-answer.ex-angles-opt', h('span.ex-answer-text', listText(item.options[i]).replace(/ –/g, '\u00a0–')), tag));
    st.opts[i] = { el: el, tag: tag };
  }
  function optionLabel(item, i) { return 'Smallest to largest: ' + item.options[i].map(letter).join(', '); }
  function gridCols() { return narrow() ? 2 : 4; }

  /* ---------- reveal ---------- */

  function showSizes(item, on) {
    var m = lib.measure(item);
    st.sizeEls.forEach(function (el, c) { el.textContent = fmtDeg(m[c].deg); el.hidden = !on; });
  }
  function reveal(item, response, result, ctx) {
    if (!st) return Promise.resolve();
    st.root.classList.add('is-revealed');
    crossOut(null); // the player's own marks on the answers stay fully visible
    Array.prototype.slice.call(st.cells.querySelectorAll('.ex-angles-flag')).forEach(function (f) { f.parentNode.removeChild(f); }); // the size label takes its corner
    showSizes(item, true);
    st.opts.forEach(function (o, i) {
      if (!o) return;
      var key = i === item.key;
      o.tag.textContent = key ? '✓ In order' : 'Out of order';
      o.tag.setAttribute('data-kind', key ? 'key' : 'foil');
      o.tag.hidden = false;
    });
    st.caption.textContent = ''; // Try 1's help caption gives way to the verdict, in the room kept for it
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
        st.big.appendChild(overlaySvg({ deg: m[pair.small].deg, n: letter(pair.small) }, { deg: m[pair.large].deg, n: letter(pair.large) }));
      },
    };
  }
  // demo (the Watch): no sizes in degrees on the angles, which are judged by eye as in every item;
  // after an answer (show me) the sizes confirm the order, as the reveal does.
  function steps(item, response, demo) {
    var m = lib.measure(item), out = [], order = item.order, small = order[0], large = order[3], sizes = !demo;
    var keepS = item.options.map(function (o) { return o[0] === small; });
    var keepSL = item.options.map(function (o) { return o[0] === small && o[3] === large; });
    var left = item.options.filter(function (o, i) { return keepSL[i]; });
    var outOf = function (keep) { return keep.map(function (k) { return !k; }); };
    out.push({
      ms: 2400, caption: cap('smallest', { a: letter(small) }),
      enter: function () { setMode('cells'); focusOption(-1); showSizes(item, sizes); point([small]); crossOut(outOf(keepS)); },
    });
    out.push({
      ms: 2400, caption: cap('largest', { b: letter(large) }),
      enter: function () { setMode('cells'); focusOption(-1); showSizes(item, sizes); point([small, large]); crossOut(outOf(keepSL)); },
      exit: function () { point([]); },
    });
    if (left.length > 1) {
      // The answers left disagree on a pair: the widest pair a remaining wrong answer gets wrong.
      var foil = left.filter(function (o) { return o.join() !== order.join(); })[0];
      var pair = foil ? widest(foil, m.map(function (x) { return x.deg; })) : deciding(item);
      if (pair) {
        var vars = { a: letter(pair.small), b: letter(pair.large), d: fmtDeg(pair.gap).replace('°', '') };
        out.push({ ms: 2400, caption: cap('disagree', vars), enter: function () { setMode('cells'); showSizes(item, sizes); point([pair.small, pair.large]); crossOut(outOf(keepSL)); }, exit: function () { point([]); } });
        out.push(overlayStep(item, pair, 1700, 'overlay', vars));
        out.push(overlayStep(item, pair, 1900, demo ? 'pairEye' : 'pair', vars));
      }
    } else {
      out.push({ ms: 1800, caption: cap('left', { order: listText(order) }), enter: function () { setMode('cells'); showSizes(item, sizes); point([]); crossOut(outOf(keepSL)); focusOption(item.key); } });
    }
    out.push({
      ms: 1800, caption: cap('done', { order: listText(item.order), n: item.key + 1 }),
      enter: function () { setMode('cells'); showSizes(item, sizes); point([]); crossOut(null); focusOption(item.key); },
    });
    var r = response;
    if (typeof r === 'number' && r !== item.key && r >= 0 && r < 4) {
      var wrong = deciding(item, r);
      if (wrong) {
        var wv = { n: r + 1, a: letter(wrong.small), b: letter(wrong.large), d: fmtDeg(wrong.gap).replace('°', '') };
        out.push({
          ms: 2400, caption: cap('chosen', wv),
          enter: function () {
            setMode('big'); crossOut(null); focusOption(r); PX.ui.clear(st.big);
            st.big.appendChild(overlaySvg({ deg: m[wrong.small].deg, n: letter(wrong.small) }, { deg: m[wrong.large].deg, n: letter(wrong.large) }));
          },
        });
      }
    }
    return out;
  }

  /* ---------- rule figures (the rules card; CONTRACT-v1.2 D) ---------- */

  // An angle drawn from vertex v: first arm at direction a0 (degrees, counterclockwise from +x, y
  // up on screen), opening deg, arms l1 and l2; with its arc.
  function ruleAngle(svg, v, a0, deg, l1, l2, rad) {
    var u = lib.sincos(a0), w = lib.sincos(a0 + deg);
    var A = [v[0] + l1 * u[1], v[1] - l1 * u[0]], B = [v[0] + l2 * w[1], v[1] - l2 * w[0]];
    svg.appendChild(S.el('path', { d: arcPath(v, [u[1], -u[0]], [w[1], -w[0]], rad || 0.15), class: 'ex-angles-arc ex-angles-rule-arc' }));
    svg.appendChild(S.el('path', { d: 'M' + A[0] + ' ' + A[1] + 'L' + v[0] + ' ' + v[1] + 'L' + B[0] + ' ' + B[1], class: 'ex-angles-arms ex-angles-rule-arms' }));
  }
  // Drawn in a 1 × 1 box shown at 72–96 px: few, bold strokes.
  function drawRule(el, fig) {
    if (!el) return;
    var svg = S.svg(1, 1, { viewBox: [0, 0, 1, 1], class: 'ex-angles-svg ex-angles-rule-svg', width: '100%' });
    if (fig === 'opening') { // the same opening: long arms, then short arms turned
      ruleAngle(svg, [0.07, 0.46], 0, 45, 0.44, 0.38);
      ruleAngle(svg, [0.6, 0.93], 60, 45, 0.24, 0.3);
      svg.appendChild(S.text(0.3, 0.76, '=', { class: 'ex-angles-num ex-angles-rule-sign' }));
    } else if (fig === 'straight') { // every angle opens less than a straight line
      ruleAngle(svg, [0.5, 0.58], 20, 140, 0.42, 0.42, 0.13);
      svg.appendChild(S.el('path', { d: 'M0.06 0.8L0.94 0.8', class: 'ex-angles-arms ex-angles-arms--large ex-angles-rule-arms' }));
      svg.appendChild(S.text(0.5, 0.92, '180°', { class: 'ex-angles-num ex-angles-rule-label' }));
    } else if (fig === 'order') { // three angles growing from left to right, then an arrow
      ruleAngle(svg, [0.04, 0.6], 0, 25, 0.26, 0.26, 0.1);
      ruleAngle(svg, [0.36, 0.6], 0, 60, 0.26, 0.26, 0.1);
      ruleAngle(svg, [0.72, 0.6], 0, 110, 0.24, 0.24, 0.1);
      svg.appendChild(S.el('path', { d: 'M0.08 0.82L0.9 0.82M0.82 0.76L0.9 0.82L0.82 0.88', class: 'ex-angles-arms ex-angles-rule-arms' }));
    } else return;
    el.appendChild(h('div.ex-angles.ex-angles-rulefig', svg));
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
  // After show me or a demo the last caption goes, so the stem returns to the room it keeps.
  function after() { if (st) { focusOption(-1); crossOut(null); point([]); setMode('cells'); st.caption.textContent = ''; } }
  function showMe(item, response, ctx) {
    if (!st || st.item !== item) return Promise.resolve();
    return play(steps(item, response), ctx, { name: 'show-me' }).then(after, after);
  }
  function demo(item, ctx, caption) {
    if (!st || st.item !== item) return Promise.resolve();
    var intro = [
      { ms: 2200, caption: cap('angles'), enter: function () { setMode('cells'); focusOption(-1); crossOut(null); showSizes(item, false); point([0, 1, 2, 3]); }, exit: function () { point([]); } },
      { ms: 2000, caption: cap('options'), enter: function () { setMode('cells'); crossOut(null); point([]); } },
    ];
    return play(readable(intro.concat(steps(item, null, true))), ctx, { name: 'demo', caption: caption || null }).then(after, after);
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
    reveal: reveal, showMe: showMe, demo: demo, unmount: unmount, drawRule: drawRule,
    steps: function (item, response) { return st ? steps(item, response) : []; },
  });
})(window.PX);
