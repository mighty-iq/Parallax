/* EX-17 Hole Punch: view (SVG; ARCHITECTURE.md §6, docs/dev/EXERCISE-GUIDE.md).
   layout 'stem+options': the stem is a strip of panels in the format's look, one per fold (the
   paper's position before the fold dashed, the folded paper solid, the flap that just moved
   shaded, an arrow from where it was) and a last panel with the folded paper and the punch; the
   options are 4 × 4 sheets with all 16 positions drawn: a filled circle is a hole, an open ring
   is no hole (shape, not only colour).
   - Everything comes from the item's own model (item.steps: Fold's face states, the same states
     Fold's re-simulation checks), so the shown folds are the graded folds.
   - Show me: one large panel starts from the punched paper and undoes the folds in reverse order;
     each flap turns back over its crease carrying its holes, then the flat sheet is set beside the
     key (and the chosen sheet's extra holes after a wrong answer).
   - Drawing code is this file's own (Fold's view stays B2's); colours from css/ex/patfold.css. */
(function (PX) {
  'use strict';

  var timing = PX.core.timing, U = PX.util, S = PX.core.svg;
  var h = PX.ui.h;
  var def = PX.ex.get('patfold'), lib = def.lib, N = lib.SIZE;
  var M = 0.6, VB = [-M, -M, N + 2 * M, N + 2 * M];
  var OVB = [-0.25, -0.25, N + 0.5, N + 0.5];
  var HOLE_R = 0.24, RING_R = 0.26;
  var st = null, uid = 0;

  function learn() { return PX.ex.learn('patfold') || {}; }
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
  // Turning a flap back over line L: lam = 1 as it lies (folded), −1 unfolded, 0 edge-on.
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

  function panelSvg(cls, vb) { return S.svg(vb[2], vb[3], { viewBox: vb, class: 'ex-patfold-svg ' + (cls || ''), width: '100%' }); }
  function outline(P, cls) { return S.path(P, true, { class: cls }); }
  function hole(c, cls) { return S.el('circle', { cx: c[0] + 0.5, cy: c[1] + 0.5, r: HOLE_R, class: cls || 'ex-patfold-hole' }); }
  function ring(c, cls) { return S.el('circle', { cx: c[0] + 0.5, cy: c[1] + 0.5, r: RING_R + 0.16, class: cls || 'ex-patfold-ring' }); }
  // One piece of paper: fill and solid edge, with its holes when asked; faint cell lines inside.
  function faceGroup(face, withHoles, cls) {
    var g = S.el('g', { class: 'ex-patfold-face' + (face.back ? ' is-back' : '') + (cls ? ' ' + cls : '') });
    var d = S.pathData(face.poly, true), id = 'expatfold-c' + (++uid);
    g.appendChild(S.el('path', { d: d, class: 'ex-patfold-paper' }));
    g.appendChild(S.el('clipPath', { id: id }, S.el('path', { d: d })));
    var grid = '';
    for (var x = 1; x < N; x++) grid += 'M' + x + ' 0V' + N;
    for (var y = 1; y < N; y++) grid += 'M0 ' + y + 'H' + N;
    g.appendChild(S.el('path', { d: grid, class: 'ex-patfold-grid', 'clip-path': 'url(#' + id + ')' }));
    g.appendChild(S.el('path', { d: d, class: 'ex-patfold-edge' }));
    if (withHoles) face.holes.forEach(function (c) { g.appendChild(hole(c)); });
    return g;
  }
  function arrow(c0, c1) {
    var dx = c1[0] - c0[0], dy = c1[1] - c0[1], len = Math.sqrt(dx * dx + dy * dy);
    if (len < 0.3) return null;
    var mx = (c0[0] + c1[0]) / 2, my = (c0[1] + c1[1]) / 2, tx = -dy / len, ty = dx / len;
    var bulge = 0.3 * len, s = ((N / 2 - mx) * tx + (N / 2 - my) * ty) >= 0 ? 1 : -1;
    var cx = mx + s * tx * bulge, cy = my + s * ty * bulge;
    var ex = c1[0] - cx, ey = c1[1] - cy, el = Math.sqrt(ex * ex + ey * ey) || 1, ux = ex / el, uy = ey / el;
    var hl = Math.min(0.5, 0.4 * len), hw = hl * 0.6, bx = c1[0] - ux * hl, by = c1[1] - uy * hl;
    var g = S.el('g', { class: 'ex-patfold-arrow' });
    g.appendChild(S.el('path', { d: 'M' + c0[0] + ' ' + c0[1] + 'Q' + cx + ' ' + cy + ' ' + bx + ' ' + by, class: 'ex-patfold-arrow-line' }));
    g.appendChild(S.path([c1, [bx - uy * hw, by + ux * hw], [bx + uy * hw, by - ux * hw]], true, { class: 'ex-patfold-arrow-head' }));
    return g;
  }
  // Panel k (1..F): the paper after fold k: where it was before the fold dashed, the folded paper
  // solid, the flap shaded, an arrow from the flap's old place. No holes before the punch.
  function foldPanel(item, k) {
    var s = item.steps[k], prev = item.steps[k - 1], svg = panelSvg('ex-patfold-svg--panel', VB);
    svg.appendChild(outline(prev.outline, 'ex-patfold-was'));
    s.faces.forEach(function (face) { svg.appendChild(faceGroup(face, false, face.moved ? 'is-flap' : '')); });
    var moved = s.faces.filter(function (f) { return f.moved && f.from; });
    if (moved.length) {
      var big = moved.reduce(function (a, b) { return Math.abs(polyArea(b.poly)) > Math.abs(polyArea(a.poly)) ? b : a; });
      var a = arrow(centroid(big.from), centroid(big.poly));
      if (a) svg.appendChild(a);
    }
    return svg;
  }
  function polyArea(P) { var s = 0; for (var i = 0; i < P.length; i++) { var p = P[i], q = P[(i + 1) % P.length]; s += p[0] * q[1] - q[0] * p[1]; } return s / 2; }
  function punchPanel(item) {
    var s = item.steps[item.steps.length - 1], svg = panelSvg('ex-patfold-svg--panel', VB);
    svg.appendChild(outline([[0, 0], [N, 0], [N, N], [0, N]], 'ex-patfold-was'));
    s.faces.forEach(function (face) { svg.appendChild(faceGroup(face, false)); });
    item.punches.forEach(function (c) { svg.appendChild(hole(c, 'ex-patfold-hole ex-patfold-punch')); });
    return svg;
  }
  // An unfolded sheet: the 16 positions, holes filled, the rest as open rings.
  function sheet(cells, vb, cls) {
    var svg = panelSvg(cls, vb), on = {};
    cells.forEach(function (c) { on[cellKey(c)] = true; });
    svg.appendChild(S.el('rect', { x: 0, y: 0, width: N, height: N, class: 'ex-patfold-sheet' }));
    for (var j = 0; j < N; j++) for (var i = 0; i < N; i++) {
      svg.appendChild(on[i + ',' + j] ? hole([i, j]) : S.el('circle', { cx: i + 0.5, cy: j + 0.5, r: HOLE_R, class: 'ex-patfold-pos' }));
    }
    return svg;
  }

  var DIRS = { '-1,0': 'to the left', '1,0': 'to the right', '0,-1': 'up', '0,1': 'down',
    '-1,-1': 'up and to the left', '1,-1': 'up and to the right', '-1,1': 'down and to the left', '1,1': 'down and to the right' };
  function describe(item) {
    var F = item.folds.length;
    return 'A square sheet of 4 by 4 cells is folded ' + plural(F, 'time', 'times') + ', then punched once through every layer. ' +
      item.folds.map(function (f, i) {
        var L = f.line, where = L.k === 'v' ? 'a vertical crease ' + plural(L.c, 'cell', 'cells') + ' from the left edge'
          : L.k === 'h' ? 'a horizontal crease ' + plural(L.c, 'cell', 'cells') + ' from the top edge' : 'a slanted crease';
        return 'Fold ' + (i + 1) + ': ' + where + ', the flap goes ' + (DIRS[[Math.sign(f.dir[0]), Math.sign(f.dir[1])].join(',')] || 'over') + '.';
      }).join(' ') + ' The punch is in column ' + (item.punches[0][0] + 1) + ', row ' + (item.punches[0][1] + 1) + '. Which of the 5 unfolded sheets shows the holes?';
  }

  /* ---------- view functions ---------- */

  function mount(ctx) {
    var root = h('div.ex-patfold-stem');
    var strip = h('div.ex-patfold-strip');
    var big = h('div.ex-patfold-big', { hidden: true });
    var stage = h('div.ex-stage.ex-patfold-stage', strip, big);
    var verdict = h('div.ex-verdict.ex-patfold-verdict', { hidden: true, role: 'status' });
    var caption = h('p.ex-caption', { 'aria-live': 'polite' });
    var desc = h('p.px-sr');
    root.appendChild(stage);
    root.appendChild(h('div.ex-patfold-under', caption, verdict));
    root.appendChild(desc);
    ctx.host.appendChild(root);
    st = { ctx: ctx, root: root, stage: stage, strip: strip, big: big, verdict: verdict, caption: caption, desc: desc,
      item: null, optItem: null, opts: [], labels: [], bigSvg: null };
  }
  function setMode(mode) { st.strip.hidden = mode !== 'strip'; st.big.hidden = mode !== 'big'; }
  function drawStrip(item) {
    PX.ui.clear(st.strip);
    st.labels = [];
    var F = item.folds.length;
    st.strip.setAttribute('data-n', String(F + 1));
    for (var k = 1; k <= F + 1; k++) {
      var label = h('span.ex-label.ex-patfold-plabel', k <= F ? 'Fold ' + k : 'Punch');
      st.labels.push(label);
      st.strip.appendChild(h('div.ex-patfold-panel', label, k <= F ? foldPanel(item, k) : punchPanel(item)));
    }
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
    drawStrip(item);
    PX.ui.clear(st.big);
    st.bigSvg = null;
    setMode('strip');
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
    el.appendChild(h('span.ex-opt.ex-patfold-opt', sheet(item.options[i], OVB, 'ex-patfold-svg--opt'), tag));
    st.opts[i] = { el: el, tag: tag };
  }
  function optionLabel(item, i) {
    return 'Sheet ' + (i + 1) + ': holes at ' + item.options[i].map(function (c) { return 'column ' + (c[0] + 1) + ' row ' + (c[1] + 1); }).join(', ');
  }
  function gridCols(item) { return item.options.length; }

  /* ---------- reveal ---------- */

  function shortWhy(why) {
    var w = String(why || '');
    if (/wrong order/.test(w)) return 'Wrong order';
    if (/one cell away|another place/.test(w)) return 'Punch moved';
    if (/turned/.test(w)) return 'Turned';
    if (/mirrored/.test(w)) return 'Mirrored';
    if (/across/.test(w)) return 'Wrong crease';
    return 'Other holes';
  }
  function whyText(item, i) {
    return String(item.why[i] || 'other holes').replace(/^punch 1: /, '').replace(/punch 1 one cell away/, 'the holes of a punch one cell away')
      .replace(/across another line/g, 'across a different crease').replace(/across other lines/g, 'across different creases')
      .replace(/^the answer mirrored/, 'the right sheet mirrored').replace(/^the answer turned/, 'the right sheet turned').replace(/, mirrored$/, ', then mirrored');
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

  /* ---------- show me ---------- */

  function ease(k) { return k * k * (3 - 2 * k); }
  function clearBig() {
    if (!st.bigSvg) { st.bigSvg = panelSvg('ex-patfold-svg--big', VB); st.big.appendChild(st.bigSvg); }
    PX.ui.clear(st.bigSvg);
    st.bigSvg.appendChild(outline([[0, 0], [N, 0], [N, N], [0, N]], 'ex-patfold-was'));
    return st.bigSvg;
  }
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
  function crease(f) {
    var a = f.seg[0], b = f.seg[1], dx = b[0] - a[0], dy = b[1] - a[1], l = Math.sqrt(dx * dx + dy * dy) || 1, e = 0.3 / l;
    return S.el('line', { x1: a[0] - dx * e, y1: a[1] - dy * e, x2: b[0] + dx * e, y2: b[1] + dy * e, class: 'ex-patfold-crease' });
  }
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
        setMode('big'); focusOption(-1);
        var svg = clearBig();
        s.faces.forEach(function (face) { if (!face.moved) svg.appendChild(faceGroup(face, true)); });
        var g = S.el('g', { class: 'ex-patfold-moving' });
        moving.forEach(function (face) { g.appendChild(faceGroup(face, true)); });
        svg.appendChild(g);
        svg.appendChild(crease(f));
        anim = { g: g, flipped: false };
      },
      update: pose,
      exit: function () { pose(1); },
    };
  }
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
    out.push({ ms: 1600, caption: cap('punched', { n: item.holes }), enter: function () { setMode('big'); focusOption(-1); drawState(item, F, item.punches); } });
    for (var k = F; k >= 1; k--) {
      out.push(unfoldStep(item, k));
      if (item.folds[k - 1].matters) out.push(holdStep(item, k));
    }
    out.push({ ms: 1800, caption: cap('done', { n: item.key + 1 }), enter: function () { setMode('big'); drawState(item, 0, []); focusOption(item.key); } });
    var r = response;
    if (typeof r === 'number' && r !== item.key && r >= 0 && r < item.options.length) {
      out.push({
        ms: 2400, caption: cap('chosen', { n: r + 1, why: whyText(item, r) }),
        enter: function () {
          setMode('big');
          var svg = drawState(item, 0, []), keyCells = {};
          item.options[item.key].forEach(function (c) { keyCells[cellKey(c)] = true; });
          item.options[r].forEach(function (c) { if (!keyCells[cellKey(c)]) svg.appendChild(ring(c, 'ex-patfold-other')); });
          focusOption(r);
        },
      });
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
    return play(steps(item, response), ctx, { name: 'show-me' }).then(function () { if (st) focusOption(-1); });
  }
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

  PX.ex.view('patfold', {
    layout: 'stem+options',
    css: true,
    mount: mount, present: present, drawOption: drawOption, optionLabel: optionLabel, gridCols: gridCols,
    reveal: reveal, showMe: showMe, demo: demo, unmount: unmount,
    steps: function (item, response) { return st ? steps(item, response) : []; },
  });
})(window.PX);
