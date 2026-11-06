/* EX-03 Spin: view (SVG; ARCHITECTURE.md §6, docs/dev/EXERCISE-GUIDE.md).
   layout 'stem+options': the player draws the choice grid (samediff: Same / Mirror, item.nOptions 2,
   option 1 = true; pick: four figure options, item.nOptions 4, nCorrect 2), calls drawOption for every
   option in the ready phase (grid laid out but hidden), then present, and shows the grid in the same
   frame as the stem. Spin is the Speed-mode exercise, so drawing is a handful of SVG polygons.
   - Everything is drawn from the item's model: every figure is the item's own polygon, and show me
     turns the reference outline by the figure's `turn` and then flips it across the item's mirror line
     (R(rot)·flip(outline), the construction gen.js grades), so the last frame is the drawn figure.
   - showMe / demo build steps and hand them to ctx.play(steps, opts) (Pause, Step, Replay, fast,
     reduced motion); without ctx.play a minimal runner is used. */
(function (PX) {
  'use strict';

  var S = PX.core.svg, timing = PX.core.timing, U = PX.util, h = PX.ui.h;
  var def = PX.ex.get('spin');
  var PAD = 1.14;   // a figure's box is 2 · radius · PAD: every figure of an item at the same scale
  var st = null;    // the mounted view's state

  function learn() { return PX.ex.learn('spin') || {}; }
  function cap(key, vars) {
    var s = String((learn().captions || {})[key] || '');
    for (var k in vars || {}) if (Object.prototype.hasOwnProperty.call(vars, k)) s = s.split('{' + k + '}').join(vars[k]);
    return s;
  }

  /* ---------- geometry from the item's model ---------- */

  // The outline turned by a (deg, clockwise on screen) after a partial flip f ∈ [0, 1] across the
  // shape's mirror line: the part across the line is scaled by 1 − 2f, so the figure turns over
  // edge-on and f = 1 is exactly the mirror image gen.js draws.
  function pts(shape, a, f) {
    var g = shape.mirrorAxis * Math.PI / 180, cg = Math.cos(g), sg = Math.sin(g), k = 1 - 2 * f;
    var r = a * Math.PI / 180, cr = Math.cos(r), sr = Math.sin(r);
    return shape.outline.map(function (p) {
      var u = p[0] * cg + p[1] * sg, v = (-p[0] * sg + p[1] * cg) * k;
      var x = u * cg - v * sg, y = u * sg + v * cg;
      return [x * cr - y * sr, x * sr + y * cr];
    });
  }
  function attr(points) { return points.map(function (q) { return q[0].toFixed(3) + ',' + q[1].toFixed(3); }).join(' '); }
  function viewBox(item) { var R = item.shape.radius * PAD; return [-R, -R, 2 * R, 2 * R].map(function (x) { return x.toFixed(3); }).join(' '); }
  // The mirror line of a figure turned by rot: through the centre at angle rot + mirrorAxis.
  function lineAttr(item, rot) {
    var a = (rot + item.shape.mirrorAxis) * Math.PI / 180, R = item.shape.radius * PAD;
    return { x1: -R * Math.cos(a), y1: -R * Math.sin(a), x2: R * Math.cos(a), y2: R * Math.sin(a) };
  }
  function ease(k) { return k * k * (3 - 2 * k); }
  function dirWord(turn) { return turn >= 0 ? 'clockwise' : 'counter-clockwise'; }

  // One figure panel: an SVG with the figure polygon, a dashed ghost and a mirror line (both hidden).
  function panel(item, cls) {
    // width/height given, so no inline size style: css/ex/spin.css sizes the panels.
    var svg = S.svg(1, 1, { viewBox: viewBox(item), width: '100%', height: '100%', class: 'ex-spin-svg ' + (cls || ''), 'aria-hidden': 'true', preserveAspectRatio: 'xMidYMid meet' });
    var fig = S.el('polygon', { class: 'ex-spin-fig' });
    var line = S.el('line', { class: 'ex-spin-line', visibility: 'hidden' });
    var ghost = S.el('polygon', { class: 'ex-spin-ghost', visibility: 'hidden' });
    svg.appendChild(fig); svg.appendChild(line); svg.appendChild(ghost);
    return { svg: svg, fig: fig, ghost: ghost, line: line };
  }
  function setPoly(node, points) { node.setAttribute('points', attr(points)); }
  function showGhost(p, item, a, f) {
    setPoly(p.ghost, pts(item.shape, a, f));
    p.ghost.setAttribute('visibility', 'visible');
  }
  function hideExtras(p) { p.ghost.setAttribute('visibility', 'hidden'); p.line.setAttribute('visibility', 'hidden'); }
  function showLine(p, item, rot) {
    var l = lineAttr(item, rot);
    for (var k in l) p.line.setAttribute(k, l[k].toFixed(3));
    p.line.setAttribute('visibility', 'visible');
  }

  function describe(item) {
    return item.variant === 'samediff'
      ? 'Two flat shapes of ' + item.shape.n + ' squares. Is the right one the left one turned, or its mirror image?'
      : 'A reference shape of ' + item.shape.n + ' squares and four options: two are the reference turned, two are its mirror image turned.';
  }

  /* ---------- view functions ---------- */

  function mount(ctx) {
    var root = h('div.ex-spin-stem');
    var stage = h('div.ex-stage.ex-spin-stage');
    var pair = h('div.ex-spin-pair');
    var labels = { ref: h('span.ex-label.ex-spin-label--ref', 'Reference'), cmp: h('span.ex-label.ex-spin-label--cmp', 'Compare') };
    var verdict = h('div.ex-verdict.ex-spin-verdict', { hidden: true, role: 'status' });
    var caption = h('p.ex-caption', { 'aria-live': 'polite' });
    var desc = h('p.px-sr');
    stage.appendChild(pair); stage.appendChild(labels.ref); stage.appendChild(labels.cmp);
    root.appendChild(stage);
    root.appendChild(h('div.ex-spin-under', caption, verdict));
    root.appendChild(desc);
    ctx.host.appendChild(root);
    st = { ctx: ctx, root: root, stage: stage, pair: pair, labels: labels, verdict: verdict, caption: caption, desc: desc,
      item: null, optItem: null, ref: null, probe: null, opts: [] };
  }

  // drawOption runs in the ready phase, before present: the first call for a new item resets the
  // option list for that item.
  function newItem(item) {
    if (st.optItem === item) return;
    st.optItem = item;
    st.opts = [];
  }

  function present(item, ctx) {
    if (!st) mount(ctx);
    newItem(item);
    st.item = item;
    st.root.setAttribute('data-variant', item.variant);
    st.root.classList.remove('is-revealed');
    st.verdict.hidden = true;
    st.verdict.textContent = '';
    st.caption.textContent = '';
    st.desc.textContent = describe(item);
    PX.ui.clear(st.pair);
    st.ref = panel(item, 'ex-spin-svg--ref');
    setPoly(st.ref.fig, item.ref.poly);
    st.pair.appendChild(st.ref.svg);
    st.probe = null;
    if (item.variant === 'samediff') {
      st.probe = panel(item, 'ex-spin-svg--cmp');
      setPoly(st.probe.fig, item.probe.poly);
      st.pair.appendChild(st.probe.svg);
    }
    st.labels.cmp.hidden = item.variant !== 'samediff';
    return timing.nextPaint();
  }

  // An L-shaped glyph beside the same glyph or its mirror image: the meaning is in the shape.
  function sameMirrorIcon(mirror) {
    var d = 'M2 2h5v11h6v5H2z', svg = S.svg(40, 20, { width: 40, height: 20, class: 'ex-glyph', 'aria-hidden': 'true' });
    svg.appendChild(S.el('path', { d: d, class: 'ex-glyph-a' }));
    svg.appendChild(S.el('path', { d: d, class: 'ex-glyph-b', transform: mirror ? 'translate(40 0) scale(-1 1)' : 'translate(22 0)' }));
    return svg;
  }

  function drawOption(el, item, i, ctx) {
    if (!st) mount(ctx);
    newItem(item);
    if (item.variant === 'samediff') {
      el.appendChild(h('span.ex-answer', sameMirrorIcon(i === 1), h('span.ex-answer-text', i === 0 ? 'Same' : 'Mirror')));
      return;
    }
    var p = panel(item, 'ex-spin-svg--opt'), tag = h('span.ex-tag', { hidden: true });
    setPoly(p.fig, item.options[i].poly);
    el.appendChild(h('span.ex-opt.ex-spin-opt', p.svg, tag));
    st.opts[i] = { el: el, p: p, tag: tag };
  }

  function optionLabel(item, i) {
    if (item.variant === 'samediff') return i === 0 ? 'Same shape, turned' : 'Mirror image';
    return 'Option ' + (i + 1);
  }
  // Four options in a row on wide screens; 2 × 2 on phones, so each figure stays large enough.
  function gridCols(item) {
    if (item.variant === 'samediff') return 2;
    var w = 1024;
    try { w = window.innerWidth || w; } catch (e) { /* default */ }
    return w < 600 ? 2 : 4;
  }

  /* ---------- reveal: the truth in place, ≤ 700 ms ---------- */

  function reveal(item, response, result, ctx) {
    if (!st) return Promise.resolve();
    st.root.classList.add('is-revealed');
    if (item.variant === 'samediff') {
      var t = item.probe.turn, deg = Math.round(Math.abs(t)), turned = deg ? 'turned ' + deg + '° ' + dirWord(t) : 'not turned';
      st.verdict.textContent = item.key ? '✓ Same shape, ' + turned : '⇋ Mirror image (' + turned + ')';
      st.verdict.setAttribute('data-kind', item.key ? 'same' : 'mirror');
      st.verdict.hidden = false;
    } else {
      st.opts.forEach(function (o, i) {
        if (!o) return;
        var copy = !item.options[i].mirror;
        o.tag.textContent = copy ? '✓ Turned copy' : '⇋ Mirror';
        o.tag.setAttribute('data-kind', copy ? 'same' : 'mirror');
        o.tag.hidden = false;
      });
    }
    return timing.wait(ctx && ctx.fast ? 0 : 250);
  }

  /* ---------- show me: turn the reference, compare, flip ---------- */

  function turnMs(turn) { return 700 + 1100 * Math.abs(turn) / 180; } // 0.7–1.8 s
  function focusOption(i) {
    st.opts.forEach(function (o, j) {
      var b = o && o.el.closest ? o.el.closest('.px-choice') : null;
      if (b) b.classList.toggle('ex-focus', j === i);
    });
  }
  // Back to the trial's picture: the reference in its pose, no ghosts, no lines.
  function resetStem() {
    var item = st.item;
    setPoly(st.ref.fig, item.ref.poly);
    hideExtras(st.ref);
    if (st.probe) hideExtras(st.probe);
    st.opts.forEach(function (o) { if (o) hideExtras(o.p); });
    focusOption(-1);
  }

  // The steps for figure `fig` drawn in panel `target`: turn the reference by fig.turn; lay the turned
  // reference over the figure as a dashed ghost; for a mirror, flip reference and ghost across the
  // mirror line until they match the figure.
  function figSteps(item, fig, target, k) {
    var a0 = item.ref.rot, a1 = item.ref.rot + fig.turn, copy = !fig.mirror, pick = k >= 0;
    var deg = Math.round(Math.abs(fig.turn)), vars = { n: k + 1, deg: deg, dir: dirWord(fig.turn) };
    var out = [
      {
        ms: turnMs(fig.turn),
        caption: deg === 0 ? cap(pick ? 'turnToNone' : 'turnNone', vars) || cap(pick ? 'turnTo' : 'turn', vars) : pick ? cap('turnTo', vars) : cap('turn', vars),
        enter: function () { resetStem(); if (pick) focusOption(k); },
        update: function (e) { setPoly(st.ref.fig, pts(item.shape, a0 + (a1 - a0) * ease(e), 0)); },
        exit: function () { setPoly(st.ref.fig, pts(item.shape, a1, 0)); },
      },
      {
        ms: 1300,
        caption: copy ? (pick ? cap('sameOption', vars) : cap('same', vars)) : (pick ? cap('notYetOption', vars) : cap('notYet', vars)),
        enter: function () {
          setPoly(st.ref.fig, pts(item.shape, a1, 0));
          if (pick) focusOption(k);
          showGhost(target, item, a1, 0);
        },
      },
    ];
    if (!copy) {
      out.push({
        ms: 1000,
        caption: pick ? cap('mirrorOption', vars) : cap('mirror', vars),
        enter: function () { showGhost(target, item, a1, 0); showLine(target, item, a1); showLine(st.ref, item, a1); if (pick) focusOption(k); },
        update: function (e) { var f = ease(e); setPoly(st.ref.fig, pts(item.shape, a1, f)); showGhost(target, item, a1, f); },
        exit: function () { setPoly(st.ref.fig, pts(item.shape, a1, 1)); showGhost(target, item, a1, 1); },
      });
    }
    return out;
  }

  // Which options to explain: the copies that were missed, then the first mirror picked; after a
  // right answer both copies.
  function pickTargets(item, response) {
    var picked = Array.isArray(response) ? response : [];
    var out = item.key.filter(function (k) { return picked.indexOf(k) < 0; });
    var wrong = picked.filter(function (k) { return item.key.indexOf(k) < 0; });
    if (wrong.length) out.push(wrong[0]);
    return out.length ? out : item.key.slice();
  }

  function steps(item, response) {
    if (item.variant === 'samediff') return figSteps(item, item.probe, st.probe, -1);
    var out = [];
    pickTargets(item, response).forEach(function (k) { if (st.opts[k]) out = out.concat(figSteps(item, item.options[k], st.opts[k].p, k)); });
    return out;
  }

  // Minimal step runner for players without ctx.play (no controls; honours fast).
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
    return play(steps(item, response), ctx, { name: 'show-me' }).then(function () { if (st) focusOption(-1); });
  }

  // Tutorial: the parts first, then the same solution.
  function demo(item, ctx, caption) {
    if (!st || st.item !== item) return Promise.resolve();
    var intro = [
      { ms: 1800, caption: cap('reference'), enter: function () { resetStem(); st.labels.ref.classList.add('is-pointed'); }, exit: function () { st.labels.ref.classList.remove('is-pointed'); } },
      { ms: 2000, caption: item.variant === 'samediff' ? cap('compare') : cap('options'), enter: function () { if (item.variant === 'samediff') st.labels.cmp.classList.add('is-pointed'); }, exit: function () { st.labels.cmp.classList.remove('is-pointed'); } },
    ];
    return play(intro.concat(steps(item, null)), ctx, { name: 'demo', caption: caption || null });
  }

  function unmount() {
    if (!st) return;
    if (st.root.parentNode) st.root.parentNode.removeChild(st.root);
    st = null;
  }

  PX.ex.view('spin', {
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
    // for tests: the outline under a turn and a partial flip (show me's model), and the steps
    pts: pts,
    steps: function (item, response) { return st ? steps(item, response) : []; },
  });
})(window.PX);
