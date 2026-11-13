/* EX-05 Nets: view (SVG; ARCHITECTURE.md §6, docs/dev/EXERCISE-GUIDE.md).
   layout 'stem+options': the stem is the net (six coloured, named squares; folds dashed, cut
   edges solid) with the variant's marks: 'opposite' a thick frame on the marked square and four
   face swatches as options; 'edges' the shaded base square and two thick edges, Yes / No;
   'cube' the bare net, Yes / No. Yes/no items are 2-option choices (item.format 'yesno',
   option 1 = Yes); the grid sizes itself from item.options.length.
   - Show me folds the net into a cube along the item's own fold tree (def.lib.foldPose, the
     model the validator folds in 3D): the base stays on the table, the view tilts, then the
     squares fold up level by level from the base, and the answer is marked on the cube.
     Drawn as an orthographic SVG (painter's order, flat shading): crisp on phones, light
     and dark through CSS tokens, no WebGL context needed.
   - Reveal marks the stem in place (overlapping squares of a non-net, tags under swatches). */
(function (PX) {
  'use strict';

  var timing = PX.core.timing, U = PX.util, S = PX.core.svg;
  var h = PX.ui.h;
  var def = PX.ex.get('nets'), lib = def.lib;
  var SIDES = lib.SIDES, CORNERS = lib.CORNERS;
  var st = null; // the mounted view's state
  var uid = 0;   // pattern ids (unique in the document)

  function learn() { return PX.ex.learn('nets') || {}; }
  function cap(key, vars) {
    var s = String((learn().captions || {})[key] || '');
    Object.keys(vars || {}).forEach(function (k) { s = s.split('{' + k + '}').join(String(vars[k])); });
    return s;
  }
  function names(item, list) {
    var n = list.map(function (i) { return item.squares[i].name; });
    return n.length < 2 ? n.join('') : n.slice(0, -1).join(', ') + ' and ' + n[n.length - 1];
  }
  // 6 is underlined everywhere: on a turned face it must not read as 9.
  function nameCls(cls, name) { return name === '6' || name === '9' ? cls + ' ex-nets-u' : cls; }
  // Squares of a non-net that land on a side already taken (every square of each pair).
  function overlapSquares(item) {
    var out = [];
    (item.overlap || []).forEach(function (p) { p.forEach(function (i) { if (out.indexOf(i) < 0) out.push(i); }); });
    return out.sort(function (a, b) { return a - b; });
  }

  /* ---------- the flat net ---------- */

  var DXY = { N: [0, -1], E: [1, 0], S: [0, 1], W: [-1, 0] };
  function sideSeg(q, side, inset) {
    var e = inset || 0, x = q.x, y = q.y;
    switch (side) {
      case 'N': return [[x + e, y], [x + 1 - e, y]];
      case 'E': return [[x + 1, y + e], [x + 1, y + 1 - e]];
      case 'S': return [[x + e, y + 1], [x + 1 - e, y + 1]];
      default: return [[x, y + e], [x, y + 1 - e]];
    }
  }
  function netBox(item) {
    var b = [Infinity, Infinity, -Infinity, -Infinity];
    item.squares.forEach(function (q) { b[0] = Math.min(b[0], q.x); b[1] = Math.min(b[1], q.y); b[2] = Math.max(b[2], q.x + 1); b[3] = Math.max(b[3], q.y + 1); });
    return b;
  }
  function line(seg, cls) { return S.el('line', { x1: seg[0][0], y1: seg[0][1], x2: seg[1][0], y2: seg[1][1], class: cls }); }

  function netSvg(item) {
    var b = netBox(item), m = 0.3, v = item.variant, at = {};
    var svg = S.svg(b[2] - b[0] + 2 * m, b[3] - b[1] + 2 * m, { viewBox: [b[0] - m, b[1] - m, b[2] - b[0] + 2 * m, b[3] - b[1] + 2 * m], class: 'ex-nets-svg ex-nets-svg--net', width: '100%', height: '100%' });
    var hatch = 'exnets-h' + (++uid);
    svg.appendChild(S.el('defs', null, S.el('pattern', { id: hatch, patternUnits: 'userSpaceOnUse', width: 0.16, height: 0.16, patternTransform: 'rotate(45)' },
      S.el('line', { x1: 0, y1: 0, x2: 0, y2: 0.16, class: 'ex-nets-hatch' }))));
    var sqEls = item.squares.map(function (q, i) {
      at[q.x + ',' + q.y] = i;
      var g = S.el('g', { class: 'ex-nets-sqg', 'data-sq': i });
      g.appendChild(S.el('rect', { x: q.x, y: q.y, width: 1, height: 1, class: 'ex-nets-sq ex-nets-c' + q.colour }));
      if (v === 'edges' && i === item.base) g.appendChild(S.el('rect', { x: q.x, y: q.y, width: 1, height: 1, fill: 'url(#' + hatch + ')', class: 'ex-nets-base' }));
      g.appendChild(S.text(q.x + 0.5, q.y + 0.5, q.name, { class: nameCls('ex-nets-name', q.name) }));
      svg.appendChild(g);
      return g;
    });
    var hinges = '', cuts = '';
    item.squares.forEach(function (q) {
      SIDES.forEach(function (side) {
        var d = DXY[side], nb = at[(q.x + d[0]) + ',' + (q.y + d[1])], s = sideSeg(q, side);
        var seg = 'M' + s[0][0] + ' ' + s[0][1] + 'L' + s[1][0] + ' ' + s[1][1];
        if (nb === undefined) cuts += seg;
        else if (side === 'E' || side === 'S') hinges += seg;
      });
    });
    svg.appendChild(S.el('path', { d: hinges, class: 'ex-nets-hinge' }));
    svg.appendChild(S.el('path', { d: cuts, class: 'ex-nets-cut' }));
    var marks = S.el('g', { class: 'ex-nets-marks' });
    if (v === 'opposite') {
      var mq = item.squares[item.marked];
      marks.appendChild(S.el('rect', { x: mq.x + 0.09, y: mq.y + 0.09, width: 0.82, height: 0.82, class: 'ex-nets-marked' }));
    }
    if (v === 'edges') item.edges.forEach(function (e) { marks.appendChild(line(sideSeg(item.squares[e.sq], e.side, 0.07), 'ex-nets-edge')); });
    svg.appendChild(marks);
    return { svg: svg, squares: sqEls, marks: marks };
  }

  function describe(item) {
    var base = 'A net of six squares, ' + item.squares.map(function (q) { return q.name; }).join(', ') + '. ';
    if (item.variant === 'opposite') return base + 'Square ' + item.squares[item.marked].name + ' is marked. Which face is opposite it once the net is folded into a cube?';
    if (item.variant === 'edges') {
      var e = item.edges.map(function (x) { return 'the ' + { N: 'top', E: 'right', S: 'bottom', W: 'left' }[x.side] + ' edge of square ' + item.squares[x.sq].name; });
      return base + 'Square ' + item.squares[item.base].name + ' is shaded. Do ' + e[0] + ' and ' + e[1] + ' meet once the net is folded into a cube?';
    }
    return base + 'Does it fold into a closed cube?';
  }

  /* ---------- view functions ---------- */

  function mount(ctx) {
    var root = h('div.ex-nets-stem');
    var label = h('span.ex-label.ex-nets-label', 'Net');
    var stage = h('div.ex-stage.ex-nets-stage', label);
    var verdict = h('div.ex-verdict.ex-nets-verdict', { hidden: true, role: 'status' });
    var caption = h('p.ex-caption', { 'aria-live': 'polite' });
    var desc = h('p.px-sr');
    root.appendChild(stage);
    root.appendChild(h('div.ex-nets-under', caption, verdict));
    root.appendChild(desc);
    ctx.host.appendChild(root);
    st = { ctx: ctx, root: root, stage: stage, label: label, verdict: verdict, caption: caption, desc: desc,
      item: null, optItem: null, opts: [], net: null, cube: null };
  }

  // The flat net or the folding cube (style, not the hidden attribute: SVG elements ignore it).
  function showNet() {
    if (st.cube) st.cube.svg.style.display = 'none';
    if (st.net) st.net.svg.style.display = '';
    st.label.textContent = 'Net';
  }

  function present(item, ctx) {
    if (!st) mount(ctx);
    newItem(item);
    st.item = item;
    st.root.setAttribute('data-variant', item.variant);
    st.verdict.hidden = true;
    st.verdict.textContent = '';
    st.caption.textContent = '';
    st.desc.textContent = describe(item);
    st.root.classList.remove('is-revealed');
    if (st.net) st.stage.removeChild(st.net.svg);
    if (st.cube) { st.stage.removeChild(st.cube.svg); st.cube = null; }
    st.net = netSvg(item);
    st.stage.appendChild(st.net.svg);
    showNet();
    // Face names at least 13 px on screen (small nets on phones): before the first paint, so the
    // stimulus never changes once shown. The options are laid out already.
    textUnit(st.net.svg);
    st.opts.forEach(function (o) { var svg = o && o.el && o.el.querySelector('svg.ex-nets-svg'); if (svg) textUnit(svg); });
    return timing.nextPaint();
  }

  // --px-u: drawing units per CSS px, read by css/ex/nets.css for a 13 px floor on the labels.
  function textUnit(svg) {
    try {
      var r = svg.getBoundingClientRect(), vb = svg.viewBox && svg.viewBox.baseVal;
      if (r.width && r.height && vb && vb.width && vb.height) svg.style.setProperty('--px-u', String(Math.max(vb.width / r.width, vb.height / r.height)));
    } catch (e) { /* the labels keep their drawing size */ }
  }

  function newItem(item) {
    if (st.optItem === item) return;
    st.optItem = item;
    st.opts = [];
  }

  // Glyphs that carry the meaning in their shape (the word beside them says it too).
  function glyph(kind) {
    var g = S.svg(40, 20, { width: 40, height: 20, class: 'ex-glyph ex-nets-glyph' });
    var paths = {
      meet: ['M5 16L19 5L33 16'],
      apart: ['M4 16L14 7', 'M26 7L36 16'],
      cube: ['M20 2L29 6.5L29 15.5L20 20L11 15.5L11 6.5Z', 'M11 6.5L20 11L29 6.5M20 11L20 20'],
      open: ['M11 6.5L11 15.5L20 20L29 15.5L29 6.5', 'M20 11L20 20'],
    }[kind];
    paths.forEach(function (d) { g.appendChild(S.el('path', { d: d })); });
    if (kind === 'meet') g.appendChild(S.el('circle', { cx: 19, cy: 5, r: 2.2, class: 'ex-nets-glyph-dot' }));
    if (kind === 'open') g.appendChild(S.el('path', { d: 'M11 6.5L20 2L29 6.5L20 11Z', class: 'ex-nets-glyph-dash' }));
    return g;
  }

  function drawOption(el, item, i, ctx) {
    if (!st) mount(ctx);
    newItem(item);
    var o = item.options[i];
    if (item.format === 'yesno') {
      var yes = o.value === true, kind = item.variant === 'edges' ? (yes ? 'meet' : 'apart') : (yes ? 'cube' : 'open');
      el.appendChild(h('span.ex-answer.ex-nets-yesno', glyph(kind), h('span.ex-answer-text', o.label || (yes ? 'Yes' : 'No'))));
      st.opts[i] = { el: el, tag: null };
      return;
    }
    var svg = S.svg(1.2, 1.2, { viewBox: [-0.1, -0.1, 1.2, 1.2], class: 'ex-nets-svg ex-nets-svg--opt', width: '100%' });
    svg.appendChild(S.el('rect', { x: 0, y: 0, width: 1, height: 1, class: 'ex-nets-sq ex-nets-swatch ex-nets-c' + o.colour }));
    svg.appendChild(S.text(0.5, 0.5, o.name, { class: nameCls('ex-nets-name', o.name) }));
    var tag = h('span.ex-tag', { hidden: true });
    el.appendChild(h('span.ex-opt.ex-nets-opt', svg, tag));
    st.opts[i] = { el: el, tag: tag };
  }

  function optionLabel(item, i) {
    var o = item.options[i];
    if (item.format !== 'yesno') return 'Face ' + o.name;
    if (item.variant === 'edges') return o.value ? 'Yes, the edges meet' : 'No, the edges do not meet';
    return o.value ? 'Yes, it folds into a cube' : 'No, it does not fold into a cube';
  }
  function gridCols(item) { return item.options.length; }

  /* ---------- reveal: the truth in place, ≤ 700 ms ---------- */

  function verdictText(item) {
    if (item.variant === 'opposite') return '✓ Face ' + item.options[item.key].name + ' is opposite the marked face.';
    var yes = item.key === 0;
    if (item.variant === 'edges') return yes ? '✓ Yes: the two thick edges meet.' : '✓ No: the two thick edges end up apart.';
    if (yes) return '✓ Yes: it folds into a cube.';
    return item.block ? '✓ No: four squares meet at one corner.' : '✓ No: squares ' + names(item, overlapSquares(item)) + ' land on the same side.';
  }

  function reveal(item, response, result, ctx) {
    if (!st) return Promise.resolve();
    st.root.classList.add('is-revealed');
    if (item.variant === 'opposite') {
      st.opts.forEach(function (o, i) {
        if (!o || !o.tag) return;
        o.tag.textContent = i === item.key ? '✓ Opposite' : 'Shares an edge';
        o.tag.setAttribute('data-kind', i === item.key ? 'key' : 'foil');
        o.tag.hidden = false;
      });
    }
    if (item.variant === 'cube' && item.key === 1 && st.net) {
      // the squares that cannot all have a side of their own, framed with dashes in the net
      (item.block || overlapSquares(item)).forEach(function (i) {
        var q = item.squares[i];
        st.net.marks.appendChild(S.el('rect', { x: q.x + 0.1, y: q.y + 0.1, width: 0.8, height: 0.8, class: 'ex-nets-clash' }));
      });
    }
    st.verdict.textContent = verdictText(item);
    st.verdict.setAttribute('data-kind', 'key');
    st.verdict.hidden = false;
    return timing.wait(ctx && ctx.fast ? 0 : 250);
  }

  /* ---------- show me: fold the net into a cube (orthographic SVG) ---------- */

  var DEG = Math.PI / 180, TILT = 52 * DEG, YAWS = [-35 * DEG, 35 * DEG, -145 * DEG, 145 * DEG];
  var LIGHT = [-0.35, -0.45, 0.82]; // camera space (right, down, towards the viewer), unit length

  function ease(k) { return k * k * (3 - 2 * k); }
  function sub3(a, b) { return [a[0] - b[0], a[1] - b[1], a[2] - b[2]]; }
  function cross3(a, b) { return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]; }
  // World: the net on the table (x right, y down the screen), the cube rising along +z. Camera:
  // yaw psi about z, then tilt tau about the screen's x axis; tau = 0 is the stem's top view.
  // Returns [X, Y, D]: screen x, screen y (down) and closeness to the viewer.
  function project(p, cam) {
    var cs = Math.cos(cam.psi), sn = Math.sin(cam.psi), ct = Math.cos(cam.tau), stt = Math.sin(cam.tau);
    var x = p[0] - cam.c[0], y = p[1] - cam.c[1], z = p[2] - cam.c[2];
    var x1 = x * cs - y * sn, y1 = x * sn + y * cs;
    return [x1, y1 * ct - z * stt, y1 * stt + z * ct];
  }
  function closeness(n, cam) { // of a world direction
    var y1 = n[0] * Math.sin(cam.psi) + n[1] * Math.cos(cam.psi);
    return y1 * Math.sin(cam.tau) + n[2] * Math.cos(cam.tau);
  }
  function along(q, u, v) { return [q[0][0] + u * (q[1][0] - q[0][0]) + v * (q[3][0] - q[0][0]), q[0][1] + u * (q[1][1] - q[0][1]) + v * (q[3][1] - q[0][1])]; }
  function pts(list) { return list.map(function (p) { return p[0].toFixed(3) + ',' + p[1].toFixed(3); }).join(' '); }
  function inset(q, a) { return pts([along(q, a, a), along(q, 1 - a, a), along(q, 1 - a, 1 - a), along(q, a, 1 - a)]); }
  function edgeSeg(q, side, a) {
    var ix = CORNERS[SIDES.indexOf(side)], p = q[ix[0]], r = q[ix[1]];
    return [[p[0] + a * (r[0] - p[0]), p[1] + a * (r[1] - p[1])], [r[0] + a * (p[0] - r[0]), r[1] + a * (p[1] - r[1])]];
  }
  function setLine(el, s) { el.setAttribute('x1', s[0][0]); el.setAttribute('y1', s[0][1]); el.setAttribute('x2', s[1][0]); el.setAttribute('y2', s[1][1]); }

  // The plan of one show-me: the camera yaw that shows what the answer is about, the fold
  // levels (depth in the fold tree from the base) and the states between the steps.
  function planOf(item) {
    var sq = item.squares, n = sq.length, depth = [], i, L;
    for (i = 0; i < n; i++) { var d = 0, j = i; while (j !== item.base && d < n) { j = sq[j].parent; d++; } depth.push(d); }
    var maxD = Math.max.apply(null, depth), b = sq[item.base], c = [b.x + 0.5, b.y + 0.5, 0.5];
    var full = sq.map(function () { return Math.PI / 2; }), P = lib.foldPose(sq, item.base, full);
    var normal = function (cs) { // outward axis of a folded square (from the cube's centre)
      var m = [0, 1, 2].map(function (k) { return (cs[0][k] + cs[2][k]) / 2 - c[k]; });
      return m.map(function (v) { return Math.abs(v) > 0.25 ? Math.sign(v) : 0; });
    };
    var faces = P.map(normal), want = [];
    if (item.variant === 'edges') {
      item.edges.forEach(function (e) {
        var ix = CORNERS[SIDES.indexOf(e.side)], cs = P[e.sq], m = [0, 1, 2].map(function (k) { return (cs[ix[0]][k] + cs[ix[1]][k]) / 2 - c[k]; });
        want.push([0, 1, 2].filter(function (k) { return Math.abs(m[k]) > 0.25; }).map(function (k) { var v = [0, 0, 0]; v[k] = Math.sign(m[k]); return v; }));
      });
    }
    var missing = [];
    if (item.variant === 'cube' && item.key === 1) {
      [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]].forEach(function (a) {
        if (!faces.some(function (f) { return f[0] === a[0] && f[1] === a[1] && f[2] === a[2]; })) missing.push(a);
      });
      missing.forEach(function (a) { want.push([a]); });
      var ov = overlapSquares(item);
      if (ov.length) want.push([faces[ov[0]]]);
    }
    var yaw = YAWS[0], best = -1;
    YAWS.forEach(function (psi) {
      var cam = { psi: psi, tau: TILT }, s = 0;
      want.forEach(function (alts) { if (alts.some(function (v) { return closeness(v, cam) > 0.05; })) s++; });
      if (s > best) { best = s; yaw = psi; }
    });
    var zero = sq.map(function () { return 0; }), states = [{ psi: 0, tau: 0, ang: zero }, { psi: yaw, tau: TILT, ang: zero }];
    for (L = 1; L <= maxD; L++) states.push({ psi: yaw, tau: TILT, ang: depth.map(function (d) { return d <= L ? Math.PI / 2 : 0; }) });
    return { c: c, maxD: maxD, states: states, missing: missing, boxes: states.map(function (s) { return boxOf(item, s, c); }) };
  }
  function boxOf(item, s, c) {
    var b = [Infinity, Infinity, -Infinity, -Infinity], cam = { psi: s.psi, tau: s.tau, c: c };
    lib.foldPose(item.squares, item.base, s.ang).forEach(function (cs) {
      cs.forEach(function (p) { var q = project(p, cam); b[0] = Math.min(b[0], q[0]); b[1] = Math.min(b[1], q[1]); b[2] = Math.max(b[2], q[0]); b[3] = Math.max(b[3], q[1]); });
    });
    var m = 0.32;
    return [b[0] - m, b[1] - m, b[2] - b[0] + 2 * m, b[3] - b[1] + 2 * m];
  }
  function lerpState(a, b, e) {
    return { psi: a.psi + (b.psi - a.psi) * e, tau: a.tau + (b.tau - a.tau) * e, ang: a.ang.map(function (v, i) { return v + (b.ang[i] - v) * e; }) };
  }
  function lerpBox(a, b, e) { return a.map(function (v, i) { return v + (b[i] - v) * e; }); }

  function buildCube(item, plan) {
    var svg = S.svg(1, 1, { class: 'ex-nets-svg ex-nets-svg--cube', width: '100%', height: '100%' });
    var hatch = 'exnets-h' + (++uid), facesG = S.el('g'), top = S.el('g');
    svg.appendChild(S.el('defs', null, S.el('pattern', { id: hatch, patternUnits: 'userSpaceOnUse', width: 0.16, height: 0.16, patternTransform: 'rotate(45)' },
      S.el('line', { x1: 0, y1: 0, x2: 0, y2: 0.16, class: 'ex-nets-hatch' }))));
    var faces = item.squares.map(function (q, i) {
      var g = S.el('g', { class: 'ex-nets-face', 'data-sq': i }), f = { g: g, edges: [] };
      f.poly = S.el('polygon', { class: 'ex-nets-sq ex-nets-face-poly ex-nets-c' + q.colour });
      f.shade = S.el('polygon', { class: 'ex-nets-shade' });
      g.appendChild(f.poly); g.appendChild(f.shade);
      if (item.variant === 'edges' && i === item.base) { f.base = S.el('polygon', { class: 'ex-nets-base', fill: 'url(#' + hatch + ')' }); g.appendChild(f.base); }
      f.label = S.el('text', { x: 50, y: 50, class: nameCls('ex-nets-name3d', q.name), 'text-anchor': 'middle', 'dominant-baseline': 'central' }, q.name);
      g.appendChild(f.label);
      if (item.variant === 'opposite' && i === item.marked) { f.mark = S.el('polygon', { class: 'ex-nets-marked' }); g.appendChild(f.mark); }
      f.hl = S.el('polygon', { class: 'ex-nets-hl' });
      g.appendChild(f.hl);
      if (item.variant === 'edges') item.edges.forEach(function (e) { if (e.sq === i) { var l = S.el('line', { class: 'ex-nets-edge' }); g.appendChild(l); f.edges.push({ side: e.side, el: l }); } });
      facesG.appendChild(g);
      return f;
    });
    // On top: what may be hidden behind the cube, dashed (the marked face, the marked edges,
    // the side a non-net leaves open).
    var xray = [];
    if (item.variant === 'edges') item.edges.forEach(function (e) { var l = S.el('line', { class: 'ex-nets-edge ex-nets-xray' }); top.appendChild(l); xray.push({ edge: e, el: l }); });
    if (item.variant === 'opposite') { var mp = S.el('polygon', { class: 'ex-nets-xray ex-nets-xray-face' }); top.appendChild(mp); xray.push({ face: item.marked, el: mp, late: true }); }
    plan.missing.forEach(function (a) { var p = S.el('polygon', { class: 'ex-nets-xray ex-nets-open' }); top.appendChild(p); xray.push({ open: a, el: p, late: true }); });
    svg.appendChild(facesG);
    svg.appendChild(top);
    return { item: item, svg: svg, faces: faces, facesG: facesG, xray: xray, plan: plan, final: false, hl: [] };
  }

  function drawCube(cube, s, vb) {
    var item = cube.item, cam = { psi: s.psi, tau: s.tau, c: cube.plan.c };
    var proj = lib.foldPose(item.squares, item.base, s.ang).map(function (cs) { return cs.map(function (p) { return project(p, cam); }); });
    var order = proj.map(function (q, i) { return { i: i, d: (q[0][2] + q[1][2] + q[2][2] + q[3][2]) / 4 }; }).sort(function (a, b) { return a.d - b.d || a.i - b.i; });
    order.forEach(function (o) {
      var f = cube.faces[o.i], q = proj[o.i], p = pts(q);
      f.poly.setAttribute('points', p);
      f.shade.setAttribute('points', p);
      if (f.base) f.base.setAttribute('points', p);
      var nn = cross3(sub3(q[1], q[0]), sub3(q[3], q[0])), l = Math.sqrt(nn[0] * nn[0] + nn[1] * nn[1] + nn[2] * nn[2]) || 1;
      if (nn[2] < 0) l = -l; // the side that faces the viewer
      // Flat shading, relative to a square facing the viewer (so the flat net keeps the stem's colours).
      var lam = Math.max(0, (nn[0] * LIGHT[0] + nn[1] * LIGHT[1] + nn[2] * LIGHT[2]) / l);
      f.shade.setAttribute('opacity', (U.clamp((LIGHT[2] - lam) / LIGHT[2], 0, 1) * 0.5).toFixed(3));
      var e1 = [q[1][0] - q[0][0], q[1][1] - q[0][1]], e2 = [q[3][0] - q[0][0], q[3][1] - q[0][1]], cr = e1[0] * e2[1] - e1[1] * e2[0];
      if (Math.abs(cr) < 0.12) f.label.setAttribute('visibility', 'hidden');
      else {
        // seen from the back the letter would be mirrored: map it from the other corner
        var m = cr > 0 ? [e1[0], e1[1], e2[0], e2[1], q[0][0], q[0][1]] : [-e1[0], -e1[1], e2[0], e2[1], q[1][0], q[1][1]];
        f.label.setAttribute('transform', 'matrix(' + m.map(function (v, k) { return (k < 4 ? v / 100 : v).toFixed(4); }).join(' ') + ')');
        f.label.removeAttribute('visibility');
      }
      if (f.mark) f.mark.setAttribute('points', inset(q, 0.09));
      f.hl.setAttribute('points', inset(q, 0.1));
      f.hl.setAttribute('visibility', cube.final && cube.hl.indexOf(o.i) >= 0 ? 'visible' : 'hidden');
      f.edges.forEach(function (e) { setLine(e.el, edgeSeg(q, e.side, 0.07)); });
      cube.facesG.appendChild(f.g); // painter's order: far squares first
    });
    cube.xray.forEach(function (x) {
      x.el.setAttribute('visibility', !x.late || cube.final ? 'visible' : 'hidden');
      if (x.edge) setLine(x.el, edgeSeg(proj[x.edge.sq], x.edge.side, 0.07));
      else if (x.face !== undefined) x.el.setAttribute('points', inset(proj[x.face], 0.02));
      else {
        var a = x.open, c = cube.plan.c, k = a[0] ? 0 : a[1] ? 1 : 2, u = (k + 1) % 3, w = (k + 2) % 3, corners = [[-1, -1], [1, -1], [1, 1], [-1, 1]];
        x.el.setAttribute('points', pts(corners.map(function (s2) { var p3 = c.slice(); p3[k] += a[k] * 0.5; p3[u] += s2[0] * 0.5; p3[w] += s2[1] * 0.5; return project(p3, cam); })));
      }
    });
    cube.svg.setAttribute('viewBox', vb.map(function (v) { return v.toFixed(3); }).join(' '));
  }

  function show3d(item) {
    if (!st.cube || st.cube.item !== item) {
      if (st.cube) st.stage.removeChild(st.cube.svg);
      st.cube = buildCube(item, planOf(item));
      st.stage.appendChild(st.cube.svg);
    }
    if (st.net) st.net.svg.style.display = 'none';
    st.cube.svg.style.display = '';
    st.label.textContent = 'Folding';
    return st.cube;
  }
  function focusOption(i) {
    st.opts.forEach(function (o, j) {
      if (!o) return;
      var b = o.el.closest ? o.el.closest('.px-choice') : null;
      if (b) b.classList.toggle('ex-focus', j === i);
    });
  }

  function resultCaption(item) {
    if (item.variant === 'opposite') return cap('opposite', { n: item.options[item.key].name });
    if (item.variant === 'edges') return cap(item.key === 0 ? 'meet' : 'apart');
    if (item.key === 0) return cap('closes');
    return item.block ? cap('block') : cap('overlap', { n: names(item, overlapSquares(item)) });
  }

  function steps(item) {
    var plan = planOf(item), S0 = plan.states, B = plan.boxes, out = [];
    function tween(a, ms, caption) {
      return {
        ms: ms, caption: caption,
        enter: function () { var c = show3d(item); c.final = false; focusOption(-1); drawCube(c, S0[a], B[a]); },
        update: function (k) { var e = ease(k); drawCube(st.cube, lerpState(S0[a], S0[a + 1], e), lerpBox(B[a], B[a + 1], e)); },
        exit: function () { drawCube(st.cube, S0[a + 1], B[a + 1]); },
      };
    }
    out.push({
      ms: 1300, caption: cap(item.variant === 'opposite' ? 'marked' : item.variant === 'edges' ? 'base' : 'net'),
      enter: function () { var c = show3d(item); c.final = false; focusOption(-1); drawCube(c, S0[0], B[0]); },
    });
    out.push(tween(0, 1100, cap('tilt')));
    for (var L = 1; L <= plan.maxD; L++) out.push(tween(L, 900, cap('fold', { n: L, m: plan.maxD })));
    var last = S0.length - 1;
    out.push({
      ms: 2400, caption: resultCaption(item),
      enter: function () {
        var c = show3d(item);
        c.final = true;
        c.hl = item.variant === 'opposite' ? [item.options[item.key].sq] : item.variant === 'cube' && item.key === 1 ? (item.block || overlapSquares(item)) : [];
        drawCube(c, S0[last], B[last]);
        focusOption(item.key);
      },
    });
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
    return play(steps(item), ctx, { name: 'show-me' }).then(function () { if (st) focusOption(-1); });
  }

  // Tutorial: the parts of the screen first (on the flat net), then the same folding.
  function demo(item, ctx, caption) {
    if (!st || st.item !== item) return Promise.resolve();
    function pointAt(on, marks) {
      st.label.classList.toggle('is-pointed', on && !marks);
      if (st.net) st.net.marks.classList.toggle('is-pointed', !!(on && marks));
    }
    function part(ms, text, marks) {
      return { ms: ms, caption: text, enter: function () { showNet(); focusOption(-1); pointAt(true, marks); }, exit: function () { pointAt(false); } };
    }
    var v = item.variant, intro = [part(1800, cap('net'), false)];
    if (v === 'opposite') intro.push(part(1800, cap('marked'), true), part(1600, cap('options'), false));
    else if (v === 'edges') intro.push(part(1800, cap('base'), false), part(1800, cap('edges'), true));
    else intro.push(part(1600, cap('question'), false));
    return play(intro.concat(steps(item)), ctx, { name: 'demo', caption: caption || null }).then(function () { if (st) focusOption(-1); });
  }

  function unmount() {
    if (!st) return;
    if (st.root.parentNode) st.root.parentNode.removeChild(st.root);
    st = null;
  }

  PX.ex.view('nets', {
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
    // for tests: the steps show-me would play (folded with the validator's own model)
    steps: function (item) { return st ? steps(item) : []; },
    plan: planOf,
  });
})(window.PX);
