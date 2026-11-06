/* EX-04 Fold: view (SVG; ARCHITECTURE.md §6, docs/dev/EXERCISE-GUIDE.md).
   layout 'stem+options': the stem is a strip of panels, one per fold (the paper before that
   fold, the crease dashed, the flap shaded, an arrow to where it lands) and a last panel with
   the folded paper and the punch; the options are unfolded sheets (4, or 5 from 4 folds up:
   the grid sizes itself from item.options.length). Option sheets carry no creases: foils come
   from other fold lines, so creases would give them away.
   - Everything is drawn from the item's own model (item.steps, item.folds, def.lib): the
     shown folds are the graded folds, and show-me unfolds exactly those layers.
   - Show me: one large panel starts from the punched paper and undoes the folds in reverse
     order; each flap turns back over its crease (the 2D view of a 180° turn) carrying its
     holes, so the holes multiply layer by layer; then the flat sheet is set beside the key
     (and beside the chosen sheet after a wrong answer, with what made that sheet).
   - SVG only (no WebGL); colours come from CSS tokens (css/ex/fold.css), so a theme change
     needs no redraw. */
(function (PX) {
  'use strict';

  var timing = PX.core.timing, U = PX.util, S = PX.core.svg;
  var h = PX.ui.h;
  var def = PX.ex.get('fold'), lib = def.lib, N = lib.N;
  var M = 0.8, VB = [-M, -M, N + 2 * M, N + 2 * M]; // panels: the sheet plus room for arrows
  var OVB = [-0.3, -0.3, N + 0.6, N + 0.6];          // option sheets
  var HOLE_R = 0.3;
  var st = null; // the mounted view's state
  var uid = 0;   // clip-path ids (unique in the document)

  function learn() { return PX.ex.learn('fold') || {}; }
  function cap(key, vars) {
    var s = String((learn().captions || {})[key] || '');
    Object.keys(vars || {}).forEach(function (k) { s = s.split('{' + k + '}').join(String(vars[k])); });
    return s;
  }
  function plural(n, one, many) { return n + ' ' + (n === 1 ? one : many); }

  /* ---------- geometry ---------- */

  function centroid(P) {
    var a = 0, cx = 0, cy = 0;
    for (var i = 0, n = P.length; i < n; i++) {
      var p = P[i], q = P[(i + 1) % n], w = p[0] * q[1] - q[0] * p[1];
      a += w; cx += (p[0] + q[0]) * w; cy += (p[1] + q[1]) * w;
    }
    if (Math.abs(a) < 1e-9) return [P[0][0], P[0][1]];
    return [cx / (3 * a), cy / (3 * a)];
  }
  function bbox(P) {
    var b = [Infinity, Infinity, -Infinity, -Infinity];
    P.forEach(function (p) { b[0] = Math.min(b[0], p[0]); b[1] = Math.min(b[1], p[1]); b[2] = Math.max(b[2], p[0]); b[3] = Math.max(b[3], p[1]); });
    return b;
  }
  // The flap of fold k (1-based): the part of the paper before the fold on the moving side.
  function flapOf(item, k) {
    var f = item.folds[k - 1];
    return lib.clip(item.steps[k - 1].outline, f.line, f.move);
  }
  // Turning a flap back over line L: the normal part of every point scaled by lam (1 = as it
  // lies, folded; −1 = mirrored, unfolded; 0 = edge-on). An SVG matrix.
  function turnMatrix(L, lam) {
    var c = L.c, mu = (lam - 1) / 2;
    switch (L.k) {
      case 'v': return [lam, 0, 0, 1, c * (1 - lam), 0];
      case 'h': return [1, 0, 0, lam, 0, c * (1 - lam)];
      case 'd': return [1 + mu, -mu, -mu, 1 + mu, -mu * c, mu * c];
      default: return [1 + mu, mu, mu, 1 + mu, -mu * c, -mu * c];
    }
  }
  function cellKey(c) { return c[0] + ',' + c[1]; }

  /* ---------- drawing ---------- */

  function panelSvg(cls, vb) {
    // An explicit width keeps PX.core.svg from adding inline sizing: css/ex/fold.css sizes it.
    return S.svg(vb[2], vb[3], { viewBox: vb, class: 'ex-fold-svg ' + (cls || ''), width: '100%' });
  }
  function ghostSheet() {
    return S.el('rect', { x: 0, y: 0, width: N, height: N, class: 'ex-fold-ghost' });
  }
  function gridPath(b) {
    var d = '', x, y;
    for (x = Math.ceil(b[0]); x <= Math.floor(b[2]); x++) d += 'M' + x + ' ' + b[1] + 'V' + b[3];
    for (y = Math.ceil(b[1]); y <= Math.floor(b[3]); y++) d += 'M' + b[0] + ' ' + y + 'H' + b[2];
    return d;
  }
  function hole(c, cls) {
    return S.el('circle', { cx: c[0] + 0.5, cy: c[1] + 0.5, r: HOLE_R, class: cls || 'ex-fold-hole' });
  }
  function ring(c, cls) {
    return S.el('circle', { cx: c[0] + 0.5, cy: c[1] + 0.5, r: HOLE_R + 0.2, class: cls || 'ex-fold-ring' });
  }
  // One piece of paper: its fill, the squared-paper grid clipped to it, its edge and (when
  // asked) its holes. The group is what an unfolding turns.
  function faceGroup(face, withHoles) {
    var g = S.el('g', { class: 'ex-fold-face' + (face.back ? ' is-back' : '') });
    var d = S.pathData(face.poly, true), id = 'exfold-c' + (++uid);
    g.appendChild(S.el('path', { d: d, class: 'ex-fold-paper' }));
    g.appendChild(S.el('clipPath', { id: id }, S.el('path', { d: d })));
    g.appendChild(S.el('path', { d: gridPath(bbox(face.poly)), class: 'ex-fold-grid', 'clip-path': 'url(#' + id + ')' }));
    g.appendChild(S.el('path', { d: d, class: 'ex-fold-edge' }));
    if (withHoles) face.holes.forEach(function (c) { g.appendChild(hole(c)); });
    return g;
  }
  function creaseLine(f) {
    var a = f.seg[0], b = f.seg[1], dx = b[0] - a[0], dy = b[1] - a[1], l = Math.sqrt(dx * dx + dy * dy) || 1, e = 0.35 / l;
    return S.el('line', { x1: a[0] - dx * e, y1: a[1] - dy * e, x2: b[0] + dx * e, y2: b[1] + dy * e, class: 'ex-fold-crease' });
  }
  // A curved arrow from the flap's centre to where it lands, bulging along the crease (a turn
  // over the crease, not a slide), on the side towards the middle of the sheet.
  function arrow(c0, c1) {
    var dx = c1[0] - c0[0], dy = c1[1] - c0[1], len = Math.sqrt(dx * dx + dy * dy);
    if (len < 0.3) return null;
    var mx = (c0[0] + c1[0]) / 2, my = (c0[1] + c1[1]) / 2, tx = -dy / len, ty = dx / len;
    var bulge = 0.3 * len, s = ((N / 2 - mx) * tx + (N / 2 - my) * ty) >= 0 ? 1 : -1;
    var cx = mx + s * tx * bulge, cy = my + s * ty * bulge;
    var ex = c1[0] - cx, ey = c1[1] - cy, el = Math.sqrt(ex * ex + ey * ey) || 1, ux = ex / el, uy = ey / el;
    var hl = Math.min(0.6, 0.4 * len), hw = hl * 0.6, bx = c1[0] - ux * hl, by = c1[1] - uy * hl;
    var g = S.el('g', { class: 'ex-fold-arrow' });
    g.appendChild(S.el('path', { d: 'M' + c0[0] + ' ' + c0[1] + 'Q' + cx + ' ' + cy + ' ' + bx + ' ' + by, class: 'ex-fold-arrow-line' }));
    g.appendChild(S.path([c1, [bx - uy * hw, by + ux * hw], [bx + uy * hw, by - ux * hw]], true, { class: 'ex-fold-arrow-head' }));
    return g;
  }
  // Panel k (1..F): the paper before fold k with that fold marked. Panel F + 1: the folded
  // paper and the punches. No holes before the punch: they would give the answer away.
  function foldPanel(item, k) {
    var s = item.steps[k - 1], f = item.folds[k - 1], svg = panelSvg('ex-fold-svg--panel', VB);
    svg.appendChild(ghostSheet());
    s.faces.forEach(function (face) { svg.appendChild(faceGroup(face, false)); });
    var flap = flapOf(item, k);
    if (flap) {
      svg.appendChild(S.path(flap, true, { class: 'ex-fold-flap' }));
      var c0 = centroid(flap), a = arrow(c0, lib.reflPt(f.line, c0));
      svg.appendChild(creaseLine(f));
      if (a) svg.appendChild(a);
    } else svg.appendChild(creaseLine(f));
    return svg;
  }
  function punchPanel(item) {
    var s = item.steps[item.steps.length - 1], svg = panelSvg('ex-fold-svg--panel', VB);
    svg.appendChild(ghostSheet());
    s.faces.forEach(function (face) { svg.appendChild(faceGroup(face, false)); });
    item.punches.forEach(function (c) { svg.appendChild(ring(c, 'ex-fold-punch-ring')); svg.appendChild(hole(c)); });
    return svg;
  }
  // An unfolded sheet with holes (an option, or the result in show me).
  function sheet(cells, vb, cls) {
    var svg = panelSvg(cls, vb);
    svg.appendChild(faceGroup({ poly: [[0, 0], [N, 0], [N, N], [0, N]], back: false, holes: cells }, true));
    return svg;
  }

  var DIRS = { '-1,0': 'to the left', '1,0': 'to the right', '0,-1': 'up', '0,1': 'down',
    '-1,-1': 'up and to the left', '1,-1': 'up and to the right', '-1,1': 'down and to the left', '1,1': 'down and to the right' };
  function describeFold(f, k) {
    var L = f.line, where = L.k === 'v' ? 'a vertical crease ' + plural(L.c, 'cell', 'cells') + ' from the left edge'
      : L.k === 'h' ? 'a horizontal crease ' + plural(L.c, 'cell', 'cells') + ' from the top edge' : 'a diagonal crease';
    var d = [Math.sign(f.dir[0]), Math.sign(f.dir[1])].join(',');
    return 'Fold ' + k + ': ' + where + ', the flap goes ' + (DIRS[d] || 'over') + '.';
  }
  function describe(item) {
    var F = item.folds.length, P = item.punches.length;
    return 'A square sheet of ' + N + ' by ' + N + ' cells is folded ' + plural(F, 'time', 'times') + ' and then punched ' +
      plural(P, 'time', 'times') + ' through every layer. ' + item.folds.map(function (f, i) { return describeFold(f, i + 1); }).join(' ') + // numbered from 1, like the panels
      ' Which of the ' + item.options.length + ' unfolded sheets shows the holes?';
  }

  /* ---------- view functions ---------- */

  function mount(ctx) {
    var root = h('div.ex-fold-stem');
    var strip = h('div.ex-fold-strip');
    var big = h('div.ex-fold-big', { hidden: true });
    var stage = h('div.ex-stage.ex-fold-stage', strip, big);
    var verdict = h('div.ex-verdict.ex-fold-verdict', { hidden: true, role: 'status' });
    var caption = h('p.ex-caption', { 'aria-live': 'polite' });
    var desc = h('p.px-sr');
    root.appendChild(stage);
    root.appendChild(h('div.ex-fold-under', caption, verdict));
    root.appendChild(desc);
    ctx.host.appendChild(root);
    st = { ctx: ctx, root: root, stage: stage, strip: strip, big: big, verdict: verdict, caption: caption, desc: desc,
      item: null, optItem: null, opts: [], labels: [], bigSvg: null };
  }

  function setMode(mode) {
    st.strip.hidden = mode !== 'strip';
    st.big.hidden = mode !== 'big';
  }

  function drawStrip(item) {
    PX.ui.clear(st.strip);
    st.labels = [];
    var F = item.folds.length;
    st.strip.setAttribute('data-n', String(F + 1));
    for (var k = 1; k <= F + 1; k++) {
      var label = h('span.ex-label.ex-fold-plabel', k <= F ? 'Fold ' + k : 'Punch');
      st.labels.push(label);
      st.strip.appendChild(h('div.ex-fold-panel', label, k <= F ? foldPanel(item, k) : punchPanel(item)));
    }
  }

  function present(item, ctx) {
    if (!st) mount(ctx);
    newItem(item);
    st.item = item;
    st.root.setAttribute('data-folds', String(item.folds.length));
    st.verdict.hidden = true;
    st.verdict.textContent = '';
    st.caption.textContent = '';
    st.desc.textContent = describe(item);
    st.root.classList.remove('is-revealed');
    drawStrip(item);
    PX.ui.clear(st.big);
    st.bigSvg = null;
    setMode('strip');
    return timing.nextPaint();
  }

  // drawOption runs in the ready phase, before present: the first call for a new item resets
  // the per-item option state.
  function newItem(item) {
    if (st.optItem === item) return;
    st.optItem = item;
    st.opts = [];
  }

  function drawOption(el, item, i, ctx) {
    if (!st) mount(ctx);
    newItem(item);
    var svg = sheet(item.options[i], OVB, 'ex-fold-svg--opt');
    var tag = h('span.ex-tag', { hidden: true });
    el.appendChild(h('span.ex-opt.ex-fold-opt', svg, tag));
    st.opts[i] = { el: el, tag: tag };
  }

  function optionLabel(item, i) { return 'Sheet ' + (i + 1); }
  function gridCols(item) { return item.options.length; }

  /* ---------- reveal: the truth in place, ≤ 700 ms ---------- */

  // A short name for what made a wrong sheet (the full text is in item.why, read by show me).
  function shortWhy(why) {
    var w = String(why || '');
    if (/wrong order/.test(w)) return 'Wrong order';
    if (/one cell away/.test(w)) return 'Punch moved';
    if (/^the answer mirrored/.test(w)) return 'Mirrored';
    if (/across/.test(w)) return 'Wrong crease';
    if (/mirrored/.test(w)) return 'Mirrored';
    return 'Other holes';
  }

  // item.why in words for the caption (the generator's text names the neighbouring problem).
  function whyText(item, i) {
    var w = String(item.why[i] || 'other holes'), one = item.punches.length === 1;
    w = w.replace(/punch (\d+) one cell away/g, function (m, p) { return one ? 'the holes of a punch one cell away' : 'punch ' + p + ' one cell away'; })
      .replace(/across another line/g, 'across a different crease').replace(/across other lines/g, 'across different creases')
      .replace(/^the answer mirrored/, 'the right sheet mirrored').replace(/, mirrored$/, ', then mirrored');
    if (one) return w.replace(/^punch 1: /, '');
    // The same mistake for every punch is said once.
    var parts = w.split('; ').map(function (x) { return x.replace(/^punch \d+: /, ''); });
    return parts.length === item.punches.length && parts.length > 1 && parts.every(function (x) { return x === parts[0]; })
      ? 'every punch: ' + parts[0] : w;
  }

  function reveal(item, response, result, ctx) {
    if (!st) return Promise.resolve();
    st.root.classList.add('is-revealed');
    st.opts.forEach(function (o, i) {
      if (!o) return;
      var key = i === item.key;
      o.tag.textContent = key ? '✓ Unfolded' : shortWhy(item.why[i]);
      o.tag.setAttribute('data-kind', key ? 'key' : 'foil');
      o.tag.hidden = false;
    });
    st.verdict.textContent = '✓ Sheet ' + (item.key + 1) + ' unfolds from these folds: ' + plural(item.holes, 'hole', 'holes') + '.';
    st.verdict.setAttribute('data-kind', 'key');
    st.verdict.hidden = false;
    return timing.wait(ctx && ctx.fast ? 0 : 250);
  }

  /* ---------- show me: unfold in reverse, the holes multiplying layer by layer ---------- */

  function ease(k) { return k * k * (3 - 2 * k); }
  function empty(node) { while (node.firstChild) node.removeChild(node.firstChild); return node; }

  function clearBig() {
    if (!st.bigSvg) { st.bigSvg = panelSvg('ex-fold-svg--big', VB); st.big.appendChild(st.bigSvg); }
    empty(st.bigSvg).appendChild(ghostSheet());
    return st.bigSvg;
  }
  // State k (0 = flat sheet … F = folded and punched) with every layer's holes; rings mark
  // `fresh` cells (the holes that just appeared, or the punches).
  function drawState(item, k, fresh) {
    var svg = clearBig();
    item.steps[k].faces.forEach(function (face) { svg.appendChild(faceGroup(face, true)); });
    (fresh || []).forEach(function (c) { svg.appendChild(ring(c)); });
    return svg;
  }
  function focusOption(i) {
    st.opts.forEach(function (o, j) {
      if (!o) return;
      var b = o.el.closest ? o.el.closest('.px-choice') : null;
      if (b) b.classList.toggle('ex-focus', j === i);
    });
  }
  function point(list) {
    st.labels.forEach(function (l, i) {
      var on = list.indexOf(i) >= 0;
      l.classList.toggle('is-pointed', on);
      if (l.parentNode) l.parentNode.classList.toggle('is-pointed', on);
    });
  }

  // Fold k turned back: the faces it moved (steps[k], moved) turn over line k from where they
  // lie to where they were (`from`), carrying their holes. Past the edge-on point the stack
  // shows its other side and its bottom layer comes on top.
  function unfoldStep(item, k) {
    var f = item.folds[k - 1], s = item.steps[k], anim = null;
    var moving = s.faces.filter(function (x) { return x.moved; });
    function pose(e) {
      if (!anim) return;
      var x = ease(e), lam = Math.cos(Math.PI * x);
      if (Math.abs(lam) < 0.02) lam = lam < 0 ? -0.02 : 0.02;
      anim.g.setAttribute('transform', 'matrix(' + turnMatrix(f.line, lam).join(' ') + ')');
      var flip = x >= 0.5;
      if (flip !== anim.flipped) {
        anim.flipped = flip;
        anim.g.classList.toggle('is-flipped', flip);
        Array.prototype.slice.call(anim.g.childNodes).reverse().forEach(function (c) { anim.g.appendChild(c); });
      }
    }
    return {
      ms: f.matters ? 1600 : 1200,
      caption: cap(f.matters ? 'unfold' : 'unfoldIdle', { n: k }),
      enter: function () {
        setMode('big');
        focusOption(-1);
        var svg = clearBig();
        s.faces.forEach(function (face) { if (!face.moved) svg.appendChild(faceGroup(face, true)); });
        var g = S.el('g', { class: 'ex-fold-moving' });
        moving.forEach(function (face) { g.appendChild(faceGroup(face, true)); });
        svg.appendChild(g);
        svg.appendChild(creaseLine(f));
        anim = { g: g, flipped: false };
      },
      update: pose,
      exit: function () { pose(1); },
    };
  }
  // After a fold that matters: the sheet as it is now, with the new holes ringed.
  function holdStep(item, k) {
    var f = item.folds[k - 1], fresh = [], seen = {};
    item.steps[k].faces.forEach(function (face) {
      if (!face.moved) return;
      face.holes.forEach(function (c) {
        var r = lib.reflCell(f.line, c[0], c[1]), key = cellKey(r);
        if (!seen[key]) { seen[key] = true; fresh.push(r); }
      });
    });
    return { ms: 900, enter: function () { setMode('big'); focusOption(-1); drawState(item, k - 1, fresh); } };
  }

  function steps(item, response) {
    var F = item.folds.length, out = [];
    out.push({
      ms: 1600,
      caption: cap(item.punches.length === 1 ? 'punched' : 'punchedMany', { n: item.holes }),
      enter: function () { setMode('big'); focusOption(-1); drawState(item, F, item.punches); },
    });
    for (var k = F; k >= 1; k--) {
      out.push(unfoldStep(item, k));
      if (item.folds[k - 1].matters) out.push(holdStep(item, k));
    }
    out.push({
      ms: 1800,
      caption: cap('done', { n: item.key + 1 }),
      enter: function () { setMode('big'); drawState(item, 0, []); focusOption(item.key); },
    });
    // After a wrong answer: the chosen sheet's other holes as dashed rings, and what made it.
    var r = response;
    if (typeof r === 'number' && r !== item.key && r >= 0 && r < item.options.length) {
      out.push({
        ms: 2400,
        caption: cap('chosen', { n: r + 1, why: whyText(item, r) }),
        enter: function () {
          setMode('big');
          var svg = drawState(item, 0, []), keyCells = {};
          item.options[item.key].forEach(function (c) { keyCells[cellKey(c)] = true; });
          item.options[r].forEach(function (c) { if (!keyCells[cellKey(c)]) svg.appendChild(ring(c, 'ex-fold-other')); });
          focusOption(r);
        },
      });
    }
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

  // Tutorial: the parts first (fold panels, punch panel, options), then the same solution.
  function demo(item, ctx, caption) {
    if (!st || st.item !== item) return Promise.resolve();
    var F = item.folds.length, folds = [];
    for (var k = 0; k < F; k++) folds.push(k);
    var intro = [
      { ms: 2200, caption: cap('folds'), enter: function () { setMode('strip'); focusOption(-1); point(folds); }, exit: function () { point([]); } },
      { ms: 1800, caption: cap('punch'), enter: function () { setMode('strip'); point([F]); }, exit: function () { point([]); } },
      { ms: 1800, caption: cap('options'), enter: function () { setMode('strip'); point([]); } },
    ];
    return play(intro.concat(steps(item, null)), ctx, { name: 'demo', caption: caption || null })
      .then(function () { if (st) focusOption(-1); });
  }

  function unmount() {
    if (!st) return;
    if (st.root.parentNode) st.root.parentNode.removeChild(st.root);
    st = null;
  }

  PX.ex.view('fold', {
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
    // for tests: the steps show-me would play (from the item's own fold model)
    steps: function (item, response) { return st ? steps(item, response) : []; },
  });
})(window.PX);
