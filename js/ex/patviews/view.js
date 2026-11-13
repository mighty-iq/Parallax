/* EX-15 Missing View (DAT-style format): view (DOM and SVG; ARCHITECTURE.md §6). layout 'stem+options'.
   The stem is one SVG in third-angle layout at one scale: TOP upper left, FRONT lower left, END
   lower right; the missing slot is a dashed frame of the missing view's size with a "?". Solid
   lines are seen edges, dotted lines hidden ones, a light tone fills each outline. Options are the
   four drawings at the stem's scale where the cell allows it.
   Show me (ctx.play steps, drawn from the item's own model): the given views → projection lines
   from their lines into the empty slot (through the 45° mitre line between top and end) → the key's
   lines appear on them, solid first, then dotted → the structure itself (an isometric drawing of
   item.heights) → the drawing lands on its option; after a wrong pick, that drawing is laid over the
   slot and the lines that differ are marked, with the validator's reason (hull, align, search).
   Every step's enter() redraws the overlay from scratch, so Replay and Step work from anywhere. */
(function (PX) {
  'use strict';

  var win = window, timing = PX.core.timing, U = PX.util, h = PX.ui.h, SV = PX.core.svg;
  var def = PX.ex.get('patviews'), lib = def.lib;
  var st = null;
  var NAMES = { top: 'Top', front: 'Front', end: 'End' };
  var GAP = 1, PAD = 0.45;

  function learn() { return PX.ex.learn('patviews') || {}; }
  function cap(key, vars) {
    var s = String((learn().captions || {})[key] || '');
    if (vars) for (var k in vars) s = s.split('{' + k + '}').join(String(vars[k]));
    return s;
  }

  /* ---------- geometry of the stem ---------- */

  // Bottom-left corner (px, y down) of each slot, the scale c (px per unit) and the mitre corner.
  function layout(item, Wpx, Hpx) {
    var W = item.W, H = item.H, D = item.D, lab = 18, pad = 10, top0 = 20; // top0: room for the stage label
    Hpx -= top0;
    var c = Math.max(8, Math.min((Wpx - 2 * pad) / (W + GAP + D), (Hpx - 2 * pad - 2 * lab) / (D + GAP + H), 46));
    var totW = (W + GAP + D) * c, totH = (D + GAP + H) * c;
    var x0 = (Wpx - totW) / 2, y0 = top0 + Math.max(lab + 2, (Hpx - totH) / 2);
    var base = y0 + totH, xe = x0 + (W + GAP) * c, yt = y0 + D * c;
    return {
      c: c, W: Wpx, H: Hpx,
      top: { x: x0, y: yt, w: W, h: D, label: [x0 + W * c / 2, y0 - 9] },
      front: { x: x0, y: base, w: W, h: H, label: [x0 + W * c / 2, base + 11] },
      end: { x: xe, y: base, w: D, h: H, label: [xe + D * c / 2, base + 11] },
      mitre: [xe, yt + GAP * c], free: { x: xe, y: y0 - lab, w: D * c, h: (D + GAP) * c + lab - 4 },
    };
  }
  function segPath(segs, ox, oy, c, style) {
    return segs.filter(function (q) { return !style || q[4] === style; }).map(function (q) {
      return 'M' + SV.pathData([[ox + q[0] * c, oy - q[1] * c], [ox + q[2] * c, oy - q[3] * c]]).slice(1);
    }).join('');
  }
  function fillPath(d, ox, oy, c) {
    var out = '', e = 0.02 * c;
    for (var v = 0; v < d.h; v++) for (var u = 0; u < d.w; u++) {
      if (d.fill[v * d.w + u] !== '1') continue;
      var a = u; while (u + 1 < d.w && d.fill[v * d.w + u + 1] === '1') u++;
      var x = ox + a * c - e, y = oy - (v + 1) * c - e, w = (u + 1 - a) * c + 2 * e, hh = c + 2 * e;
      out += 'M' + SV.pathData([[x, y], [x + w, y], [x + w, y + hh], [x, y + hh]], true).slice(1);
    }
    return out;
  }
  // A drawing as an SVG group at origin (ox, oy) and scale c.
  function drawingGroup(d, ox, oy, c, cls) {
    var g = SV.el('g', { class: cls || '' });
    g.appendChild(SV.el('path', { d: fillPath(d, ox, oy, c), class: 'pv-fill' }));
    g.appendChild(SV.el('path', { d: segPath(d.segs, ox, oy, c, 2), class: 'pv-line pv-dot' }));
    g.appendChild(SV.el('path', { d: segPath(d.segs, ox, oy, c, 1), class: 'pv-line pv-solid' }));
    return g;
  }

  /* ---------- the stem ---------- */

  function drawStem(item) {
    var svg = st.svg, Wpx = Math.max(1, st.stage.clientWidth), Hpx = Math.max(1, st.stage.clientHeight - 4);
    PX.ui.clear(svg);
    SV.attrs(svg, { viewBox: [0, 0, Wpx, Hpx] });
    var Lo = st.L = layout(item, Wpx, Hpx), c = Lo.c;
    st.groups = {};
    lib.VIEWS.forEach(function (v) {
      var at = Lo[v], g;
      if (v === item.missing) {
        g = SV.el('g', { class: 'pv-slot' });
        g.appendChild(SV.el('rect', { x: at.x, y: at.y - at.h * c, width: at.w * c, height: at.h * c, class: 'pv-slot-frame' }));
        g.appendChild(SV.text(at.x + at.w * c / 2, at.y - at.h * c / 2, '?', { class: 'pv-q' }));
      } else g = drawingGroup(item.given[v], at.x, at.y, c, 'pv-given');
      g.appendChild(SV.text(at.label[0], at.label[1], NAMES[v], { class: 'pv-label' + (v === item.missing ? ' pv-label--miss' : '') }));
      svg.appendChild(g);
      st.groups[v] = g;
    });
    // The mitre line between top and end (used by the projection lines of show me).
    var m = Lo.mitre, k = Math.min(item.D + 0.4, item.D + GAP) * c;
    svg.appendChild(SV.el('path', { d: 'M' + SV.pathData([[m[0] - 0.2 * c, m[1] + 0.2 * c], [m[0] + k, m[1] - k]]).slice(1), class: 'pv-mitre' }));
    st.over = SV.el('g', { class: 'pv-over' });
    svg.appendChild(st.over);
  }

  function describe(item) {
    var gv = lib.VIEWS.filter(function (v) { return v !== item.missing; });
    return 'Two views of a block structure are drawn: the ' + gv[0] + ' view and the ' + gv[1] + ' view. Solid lines are seen edges, dotted lines hidden ones. Which of four drawings is its ' + item.missing + ' view?';
  }

  /* ---------- view functions ---------- */

  function mount(ctx) {
    var root = h('div.pv-stem');
    var stage = h('div.ex-stage.pv-stage');
    var svg = SV.el('svg', { class: 'pv-svg', 'aria-hidden': 'true', focusable: 'false' });
    var label = h('span.ex-label.pv-stage-label', 'Two views');
    stage.appendChild(svg);
    stage.appendChild(label);
    var caption = h('p.ex-caption', { 'aria-live': 'polite' });
    var verdict = h('div.ex-verdict.pv-verdict', { hidden: true, role: 'status' });
    var desc = h('p.px-sr');
    root.appendChild(stage);
    root.appendChild(h('div.pv-under', caption, verdict));
    root.appendChild(desc);
    ctx.host.appendChild(root);
    st = { ctx: ctx, root: root, stage: stage, svg: svg, label: label, caption: caption, verdict: verdict, desc: desc, item: null, optItem: null, opts: [], L: null, groups: {}, over: null };
  }

  function newItem(item) {
    if (st.optItem === item) return;
    st.optItem = item;
    st.opts = [];
    // The scale the stem will use (the stage is laid out, hidden, in the ready phase).
    var Lo = layout(item, Math.max(1, st.stage.clientWidth), Math.max(1, st.stage.clientHeight - 4));
    st.optC = Lo.c;
  }

  function drawOption(el, item, i, ctx) {
    if (!st) mount(ctx);
    newItem(item);
    var d = item.options[i].drawing, wU = d.w + 2 * PAD, hU = d.h + 2 * PAD;
    var svg = SV.el('svg', { viewBox: [-PAD, -PAD, wU, hU], class: 'pv-opt-svg', 'aria-hidden': 'true', focusable: 'false', preserveAspectRatio: 'xMidYMid meet' });
    var g = drawingGroup(d, 0, d.h, 1, 'pv-opt');
    svg.appendChild(g);
    // The stem's scale where the cell is wide enough (the same px per unit), else as large as fits.
    svg.style.maxWidth = Math.round(wU * st.optC) + 'px';
    svg.style.aspectRatio = wU + ' / ' + hU;
    var tag = h('span.ex-tag', { hidden: true });
    el.appendChild(h('span.ex-opt.pv-opt-cell', svg, tag));
    st.opts[i] = { el: el, svg: svg, g: g, tag: tag, ghost: null };
  }
  function optionLabel(item, i) { return 'Drawing ' + (i + 1); }
  function gridCols() { return 4; }

  function present(item, ctx) {
    if (!st) mount(ctx);
    newItem(item);
    st.item = item;
    st.root.classList.remove('is-revealed');
    st.verdict.hidden = true;
    st.caption.textContent = '';
    st.desc.textContent = describe(item);
    drawStem(item);
    return timing.nextPaint();
  }

  var WHY = { hull: 'Outline cannot fit', align: 'Lines do not line up', search: 'No structure fits' };
  function reveal(item, response, result, ctx) {
    if (!st) return Promise.resolve();
    st.root.classList.add('is-revealed');
    st.opts.forEach(function (o, i) {
      if (!o) return;
      var op = item.options[i];
      o.tag.textContent = i === item.key ? '✓ ' + NAMES[item.missing] + ' view' : WHY[op.why] || 'Does not fit';
      o.tag.setAttribute('data-kind', i === item.key ? 'key' : 'foil');
      o.tag.hidden = false;
      if (i !== item.key) markDiff(item, i, 'pv-diff'); // where this drawing differs from the right one
    });
    st.verdict.textContent = '✓ Drawing ' + (item.key + 1) + ' is the ' + item.missing + ' view';
    st.verdict.setAttribute('data-kind', 'key');
    st.verdict.hidden = false;
    return timing.wait(ctx && ctx.fast ? 0 : 250);
  }

  /* ---------- show me ---------- */

  // Projection lines into the missing slot from the given views' line positions.
  function projectors(item) {
    var Lo = st.L, c = Lo.c, miss = item.missing, out = [], g = item.given, s;
    function hset(d) { var o = {}; d.segs.forEach(function (q) { if (q[1] === q[3]) o[q[1]] = 1; }); return Object.keys(o).map(Number); }
    function vset(d) { var o = {}; d.segs.forEach(function (q) { if (q[0] === q[2]) o[q[0]] = 1; }); return Object.keys(o).map(Number); }
    var T = Lo.top, F = Lo.front, E = Lo.end, m = Lo.mitre;
    if (miss === 'end') {
      hset(g.front).forEach(function (v) { out.push([[F.x + F.w * c, F.y - v * c], [E.x + E.w * c + 0.3 * c, E.y - v * c]]); });
      hset(g.top).forEach(function (v) { var y = T.y - v * c, x = m[0] + v * c; out.push([[T.x + T.w * c, y], [x, y], [x, E.y + 0.3 * c]]); });
    } else if (miss === 'front') {
      vset(g.top).forEach(function (u) { out.push([[T.x + u * c, T.y], [F.x + u * c, F.y + 0.3 * c]]); });
      hset(g.end).forEach(function (v) { out.push([[E.x, E.y - v * c], [F.x - 0.3 * c, F.y - v * c]]); });
    } else {
      vset(g.front).forEach(function (u) { out.push([[F.x + u * c, F.y - F.h * c], [T.x + u * c, T.y - T.h * c - 0.3 * c]]); });
      vset(g.end).forEach(function (u) { var x = E.x + u * c, y = m[1] - u * c; out.push([[x, E.y - E.h * c], [x, y], [T.x - 0.3 * c, y]]); });
    }
    s = out.map(function (pts) { return 'M' + SV.pathData(pts).slice(1); });
    return s;
  }
  // Key segments in drawing order: solid first, then dotted.
  function keySegs(item) {
    var d = item.options[item.key].drawing;
    return d.segs.filter(function (q) { return q[4] === 1; }).concat(d.segs.filter(function (q) { return q[4] === 2; }));
  }
  // The structure drawn isometrically (front-right-top corner), fitted into box b.
  function isoGroup(item, b) {
    var rows = item.heights, cubes = [], z, x, y, sx = 0.866;
    for (z = 0; z < item.D; z++) for (x = 0; x < item.W; x++) for (y = 0; y < rows[z][x]; y++) cubes.push([x, y, z]);
    cubes.sort(function (a, b2) { return (a[0] + a[1] + a[2]) - (b2[0] + b2[1] + b2[2]) || a[1] - b2[1]; });
    function P(p) { return [(p[0] - p[2]) * sx, (p[0] + p[2]) * 0.5 - p[1]]; }
    var xs = [], ys = [];
    [[0, 0, 0], [item.W, 0, 0], [0, 0, item.D], [item.W, 0, item.D], [0, item.H, 0], [item.W, item.H, 0], [0, item.H, item.D], [item.W, item.H, item.D]].forEach(function (p) { var q = P(p); xs.push(q[0]); ys.push(q[1]); });
    var x0 = Math.min.apply(null, xs), x1 = Math.max.apply(null, xs), y0 = Math.min.apply(null, ys), y1 = Math.max.apply(null, ys);
    var k = Math.min(b.w / (x1 - x0), b.h / (y1 - y0)), ox = b.x + (b.w - (x1 - x0) * k) / 2 - x0 * k, oy = b.y + (b.h - (y1 - y0) * k) / 2 - y0 * k;
    var g = SV.el('g', { class: 'pv-iso' });
    function face(pts, cls) { g.appendChild(SV.el('path', { d: SV.pathData(pts.map(function (p) { var q = P(p); return [ox + q[0] * k, oy + q[1] * k]; }), true), class: cls })); }
    cubes.forEach(function (q) {
      var a = q[0], b2 = q[1], cz = q[2];
      face([[a, b2 + 1, cz], [a + 1, b2 + 1, cz], [a + 1, b2 + 1, cz + 1], [a, b2 + 1, cz + 1]], 'px-fig-face px-fig-top');
      face([[a + 1, b2, cz], [a + 1, b2 + 1, cz], [a + 1, b2 + 1, cz + 1], [a + 1, b2, cz + 1]], 'px-fig-face px-fig-side');
      face([[a, b2, cz + 1], [a + 1, b2, cz + 1], [a + 1, b2 + 1, cz + 1], [a, b2 + 1, cz + 1]], 'px-fig-face px-fig-far');
    });
    return g;
  }

  function focusOption(i) {
    st.opts.forEach(function (o, j) {
      if (!o) return;
      var b = o.el.closest ? o.el.closest('.px-choice') : null;
      if (b) b.classList.toggle('ex-focus', j === i);
      if (o.ghost && o.ghost.parentNode) o.ghost.parentNode.removeChild(o.ghost);
      o.ghost = null;
    });
  }
  // The overlay for one state: { pointed, proj (0–1), built (count), dotted, object, ghostKey, picked }.
  function draw(item, s) {
    var Lo = st.L, c = Lo.c, at = Lo[item.missing], ov = st.over;
    PX.ui.clear(ov);
    lib.VIEWS.forEach(function (v) { if (st.groups[v]) st.groups[v].classList.toggle('is-pointed', !!(s.pointed && v !== item.missing) || !!(s.slot && v === item.missing)); });
    if (st.groups[item.missing]) st.groups[item.missing].classList.toggle('is-filled', !!s.built || s.picked >= 0);
    if (s.proj) {
      var pr = projectors(item), n = Math.ceil(U.clamp(s.proj, 0, 1) * pr.length);
      if (n) ov.appendChild(SV.el('path', { d: pr.slice(0, n).join(''), class: 'pv-proj' }));
    }
    if (s.object) {
      ov.appendChild(SV.el('rect', { x: Lo.free.x - 4, y: Lo.free.y, width: Lo.free.w + 8, height: Lo.free.h, class: 'pv-cover' }));
      ov.appendChild(isoGroup(item, { x: Lo.free.x, y: Lo.free.y + 2, w: Lo.free.w, h: Lo.free.h - 4 }));
    }
    if (s.built) {
      var segs = keySegs(item).slice(0, s.built);
      ov.appendChild(SV.el('path', { d: segPath(segs, at.x, at.y, c, 2), class: 'pv-line pv-dot pv-trace' + (s.dotted ? ' pv-hl' : '') }));
      ov.appendChild(SV.el('path', { d: segPath(segs, at.x, at.y, c, 1), class: 'pv-line pv-solid pv-trace' }));
    }
    if (s.dotted) { // every dotted line on the stem stands out: the given views' and the missing view's
      Object.keys(item.given).forEach(function (v) {
        var gd = item.given[v], ga = Lo[v];
        ov.appendChild(SV.el('path', { d: segPath(gd.segs, ga.x, ga.y, c, 2), class: 'pv-line pv-dot pv-trace pv-hl' }));
      });
    }
    if (s.picked >= 0) {
      var pd = item.options[s.picked].drawing, kd = item.options[item.key].drawing;
      ov.appendChild(drawingGroup(pd, at.x, at.y, c, 'pv-picked'));
      var diff = unitDiff(pd, kd);
      if (diff.length) ov.appendChild(SV.el('path', { d: segPath(diff, at.x, at.y, c), class: 'pv-diff' }));
    }
    focusOption(s.focus === undefined ? -1 : s.focus);
    if (s.mark >= 0 && s.mark !== undefined) markDiff(item, s.mark, 'pv-diff pv-diff--show');
    if (s.ghostKey) {
      var o = st.opts[item.key], d = item.options[item.key].drawing;
      o.ghost = SV.el('path', { d: segPath(d.segs, 0, d.h, 1), class: 'pv-ghost' });
      o.svg.appendChild(o.ghost);
    }
  }
  // Unit segments present in one drawing and not the other, or with another style.
  function unitDiff(a, b) {
    function units(d) {
      var m = {};
      d.segs.forEach(function (q) {
        if (q[1] === q[3]) for (var u = q[0]; u < q[2]; u++) m['h' + u + ',' + q[1]] = [u, q[1], u + 1, q[1], q[4]];
        else for (var v = q[1]; v < q[3]; v++) m['v' + q[0] + ',' + v] = [q[0], v, q[0], v + 1, q[4]];
      });
      return m;
    }
    var A = units(a), B = units(b), out = [], k;
    for (k in A) if (!B[k] || B[k][4] !== A[k][4]) out.push(A[k]);
    for (k in B) if (!A[k]) out.push(B[k]);
    return out;
  }

  // Marks, on option i, the unit lines where it differs from the right drawing (thick dots: a shape
  // as well as a colour). One mark group per option; drawn again replaces it.
  function markDiff(item, i, cls) {
    var o = st.opts[i];
    if (!o || i === item.key) return;
    if (o.diff && o.diff.parentNode) o.diff.parentNode.removeChild(o.diff);
    var d = item.options[i].drawing, diff = unitDiff(d, item.options[item.key].drawing);
    o.diff = diff.length ? SV.el('path', { d: segPath(diff, 0, d.h, 1), class: cls }) : null;
    if (o.diff) o.svg.appendChild(o.diff);
  }
  // What the marked lines of a wrong drawing get wrong: drawn the wrong way (solid or dotted), a line
  // too many, or one missing.
  function diffCaption(item, i) {
    function units(d) {
      var m = {};
      d.segs.forEach(function (q) {
        if (q[1] === q[3]) for (var u = q[0]; u < q[2]; u++) m['h' + u + ',' + q[1]] = q[4];
        else for (var v = q[1]; v < q[3]; v++) m['v' + q[0] + ',' + v] = q[4];
      });
      return m;
    }
    var A = units(item.options[i].drawing), B = units(item.options[item.key].drawing), extra = 0, missing = 0, toDot = 0, toSolid = 0, k;
    for (k in A) { if (!B[k]) extra++; else if (A[k] !== B[k]) { if (B[k] === 2) toDot++; else toSolid++; } }
    for (k in B) if (!A[k]) missing++;
    if (!extra && !missing && toDot && !toSolid) return cap('diffDotted');
    if (!extra && !missing && toSolid && !toDot) return cap('diffSolid');
    if (!toDot && !toSolid && extra && !missing) return cap('diffExtra');
    if (!toDot && !toSolid && missing && !extra) return cap('diffMissing');
    return cap('diffMixed');
  }

  function steps(item, response) {
    var miss = item.missing, key = item.key, segs = keySegs(item), nd = segs.filter(function (q) { return q[4] === 2; }).length;
    var picked = typeof response === 'number' && response >= 0 && response < 4 && response !== key ? response : -1;
    var all = segs.length;
    function S(extra) { var o = { picked: -1 }; for (var k in extra) o[k] = extra[k]; return o; }
    var list = [
      { ms: 1500, caption: cap('views'), enter: function () { draw(item, S({ pointed: true })); } },
      { ms: 1100, caption: cap('slot'), enter: function () { draw(item, S({ slot: true })); } },
      { ms: 1400 + 110 * projectors(item).length, caption: cap('project'), enter: function () { draw(item, S({ proj: 0.001 })); }, update: function (k) { draw(item, S({ proj: Math.max(0.001, k) })); } },
      { ms: 900 + 140 * all, caption: cap('build', { view: miss }), enter: function () { draw(item, S({ proj: 1, built: 0 })); }, update: function (k) { draw(item, S({ proj: 1, built: Math.ceil(Math.min(1, k * 1.15) * all) })); } },
    ];
    list.push({ ms: 2000, caption: cap('object'), enter: function () { draw(item, S({ built: all, object: true })); } });
    // Dotted lines often decide the item: a long step, the structure in view, every dotted line marked.
    var ndAll = nd + Object.keys(item.given).reduce(function (a, v) { return a + item.given[v].segs.filter(function (q) { return q[4] === 2; }).length; }, 0);
    if (ndAll) list.push({ ms: 4200, caption: cap('dotted'), enter: function () { draw(item, S({ built: all, object: true, dotted: true })); } });
    list.push({ ms: 1300, caption: cap('land', { n: key + 1 }), enter: function () { draw(item, S({ built: all, focus: key, ghostKey: true })); } });
    if (picked >= 0) {
      var why = item.options[picked].why;
      list.push({ ms: 3200, caption: cap(why === 'hull' ? 'whyHull' : why === 'align' ? 'whyAlign' : 'whySearch', { n: picked + 1 }) + ' ' + diffCaption(item, picked), enter: function () { draw(item, S({ picked: picked, focus: picked, ghostKey: true, mark: picked })); } });
    }
    return list;
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
  function revealStage(ctx) {
    try {
      var r = st.stage.getBoundingClientRect(), vh = win.innerHeight || 640;
      if (r.top < 0 || r.bottom > vh) st.stage.scrollIntoView({ block: 'start', behavior: ctx && (ctx.fast || ctx.reducedMotion) ? 'auto' : 'smooth' });
    } catch (e) { /* not fatal */ }
  }
  function showMe(item, response, ctx) {
    if (!st || st.item !== item) return Promise.resolve();
    revealStage(ctx);
    return play(steps(item, response), ctx, { name: 'show-me' });
  }
  function demo(item, ctx, caption) {
    if (!st || st.item !== item) return Promise.resolve();
    revealStage(ctx);
    var intro = [{ ms: 1700, caption: cap('options'), enter: function () { draw(item, { picked: -1 }); } }];
    return play(steps(item, null).slice(0, 2).concat(intro, steps(item, null).slice(2)), ctx, { name: 'demo', caption: caption || null });
  }
  function unmount() {
    if (!st) return;
    if (st.root.parentNode) st.root.parentNode.removeChild(st.root);
    st = null;
  }

  PX.ex.view('patviews', {
    layout: 'stem+options',
    css: true,
    mount: mount, present: present, drawOption: drawOption, optionLabel: optionLabel, gridCols: gridCols,
    reveal: reveal, showMe: showMe, demo: demo, unmount: unmount,
    steps: function (item, response) { return st && st.item === item ? steps(item, response) : []; },
  });
})(window.PX);
