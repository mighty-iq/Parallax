/* PAT-6 Form: view (DOM and SVG; ARCHITECTURE.md §6). layout 'stem+options'.
   The stem is the flat pattern (fold lines dashed, cut edges solid); options are SVG pictures of
   convex solids (orthographic, flat tones by face direction, outlines). The pattern and the solids
   share one scale (px per unit), so sizes compare directly. Marks: a darker tone plus a hatch;
   a half mark shades one side of a diagonal. Never colour alone.
   Show me (ctx.play steps, from the grading model: lib.matchings and lib.possible give the face
   map): a landmark face (a mark the right solid shows) is numbered in the pattern and in the solid,
   then its neighbours; after a wrong pick, the face that cannot be marked so (or the wrong size, or
   the mirror image) is marked in that solid and in the pattern. Every step's enter() sets its
   full state. */
(function (PX) {
  'use strict';

  var win = window, timing = PX.core.timing, U = PX.util, h = PX.ui.h, SV = PX.core.svg;
  var def = PX.ex.get('form'), lib = def.lib;
  var st = null, uid = 0;
  var RIGHT = [0.8660254038, 0, -0.5];

  function learn() { return PX.ex.learn('form') || {}; }
  function cap(key, vars) {
    var s = String((learn().captions || {})[key] || '');
    if (vars) for (var k in vars) s = s.split('{' + k + '}').join(String(vars[k]));
    return s;
  }
  function dot(a, b) { return a[0] * b[0] + a[1] * b[1] + a[2] * b[2]; }
  function cross(a, b) { return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]; }

  /* ---------- projection of an option ---------- */
  function project(o) {
    var M = lib.viewMatrix(o.view), dir = lib.VIEWS[o.view.el || 0], up = cross(dir, RIGHT);
    var P = o.solid.verts.map(function (v) { var w = lib.mvec(M, v); return [dot(w, RIGHT), -dot(w, up)]; });
    var faces = o.solid.faces.map(function (F, f) {
      var n = lib.mvec(M, lib.faceNormal(o.solid, f)), c = dot(n, dir);
      return { f: f, c: c, light: dot(n, [0.32, 0.86, 0.4]), pts: F.map(function (i) { return P[i]; }) };
    });
    var x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
    P.forEach(function (p) { x0 = Math.min(x0, p[0]); x1 = Math.max(x1, p[0]); y0 = Math.min(y0, p[1]); y1 = Math.max(y1, p[1]); });
    return { faces: faces, box: [x0, y0, x1, y1] };
  }
  function tone(light) { return light >= 0.7 ? 'px-fig-top' : light >= 0.25 ? 'px-fig-side' : 'px-fig-far'; }
  function hatchDefs(svg, pitch) {
    var id = 'fm-hatch-' + (++uid), defs = SV.el('defs'), pat = SV.el('pattern', { id: id, patternUnits: 'userSpaceOnUse', width: pitch, height: pitch, patternTransform: 'rotate(45)' });
    pat.appendChild(SV.el('rect', { x: 0, y: 0, width: pitch, height: pitch, class: 'fm-hatch-bg' }));
    pat.appendChild(SV.el('line', { x1: 0, y1: 0, x2: 0, y2: pitch, class: 'fm-hatch-line', style: 'stroke-width:' + (pitch * 0.42).toFixed(3) }));
    defs.appendChild(pat);
    svg.appendChild(defs);
    return 'url(#' + id + ')';
  }
  // The marked part of a face (a polygon), or null.
  function markPoly(pts, mark) {
    if (!mark) return null;
    if (typeof mark !== 'object') return pts;
    return [pts[mark.h % 4], pts[(mark.h + 1) % 4], pts[(mark.h + 2) % 4]];
  }

  /* ---------- the pattern ---------- */
  function netBox(net) {
    var x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
    net.forEach(function (n) { n.poly.forEach(function (p) { x0 = Math.min(x0, p[0]); x1 = Math.max(x1, p[0]); y0 = Math.min(y0, -p[1]); y1 = Math.max(y1, -p[1]); }); });
    return [x0, y0, x1, y1];
  }
  function drawNet(item) {
    var svg = st.svg, Wpx = Math.max(1, st.stage.clientWidth), Hpx = Math.max(1, st.stage.clientHeight), b = netBox(item.net), top = 22;
    PX.ui.clear(svg);
    var k = st.k, w = Wpx / k, hh = (Hpx - top) / k, cx = (b[0] + b[2]) / 2, cy = (b[1] + b[3]) / 2;
    SV.attrs(svg, { viewBox: [cx - w / 2, cy - hh / 2 - top / k, w, hh + top / k] });
    var fill = hatchDefs(svg, 5 / k), byFace = {};
    st.netG = {};
    item.net.forEach(function (n) { byFace[n.face] = n; });
    var g = SV.el('g', { class: 'fm-net' });
    item.net.forEach(function (n) {
      var pts = n.poly.map(function (p) { return [p[0], -p[1]]; }), fg = SV.el('g', { class: 'fm-netface' });
      fg.appendChild(SV.el('path', { d: SV.pathData(pts, true), class: 'fm-face' }));
      var mp = markPoly(pts, item.marks[n.face]);
      if (mp) fg.appendChild(SV.el('path', { d: SV.pathData(mp, true), class: 'fm-mark', style: 'fill:' + fill }));
      g.appendChild(fg);
      st.netG[n.face] = { g: fg, pts: pts };
    });
    // edges: a fold line where a face hangs from its parent, a cut edge elsewhere
    var folds = [], cuts = [];
    item.net.forEach(function (n) {
      var F = item.solid.faces[n.face];
      for (var i = 0; i < F.length; i++) {
        var a = F[i], c = F[(i + 1) % F.length], isFold = false;
        if (n.hinge && ((n.hinge[0] === a && n.hinge[1] === c) || (n.hinge[0] === c && n.hinge[1] === a))) isFold = true;
        item.net.forEach(function (m) { if (m.parent === n.face && m.hinge && ((m.hinge[0] === a && m.hinge[1] === c) || (m.hinge[0] === c && m.hinge[1] === a))) isFold = 'child'; });
        var seg = [[n.poly[i][0], -n.poly[i][1]], [n.poly[(i + 1) % F.length][0], -n.poly[(i + 1) % F.length][1]]];
        if (isFold === true) folds.push(seg); else if (!isFold) cuts.push(seg);
      }
    });
    function segsD(list) { return list.map(function (s) { return 'M' + SV.pathData(s).slice(1); }).join(''); }
    g.appendChild(SV.el('path', { d: segsD(cuts), class: 'fm-cut' }));
    g.appendChild(SV.el('path', { d: segsD(folds), class: 'fm-fold' }));
    svg.appendChild(g);
    st.netLabels = SV.el('g', { class: 'fm-labels' });
    svg.appendChild(st.netLabels);
  }

  /* ---------- options ---------- */
  function newItem(item) {
    if (st.optItem === item) return;
    st.optItem = item;
    st.opts = [];
    st.proj = item.options.map(project);
    var E = 0;
    st.proj.forEach(function (p) { E = Math.max(E, p.box[2] - p.box[0], p.box[3] - p.box[1]); });
    st.E = E * 1.12;
    var b = netBox(item.net), Wpx = Math.max(1, st.stage.clientWidth), Hpx = Math.max(1, st.stage.clientHeight - 22);
    var kNet = Math.min(Wpx / ((b[2] - b[0]) * 1.08), Hpx / ((b[3] - b[1]) * 1.08));
    st.k = Math.min(kNet, 60); // px per unit in the pattern; the solids use it too (max-width below)
  }
  function drawOption(el, item, i, ctx) {
    if (!st) mount(ctx);
    newItem(item);
    var o = item.options[i], P = st.proj[i], cx = (P.box[0] + P.box[2]) / 2, cy = (P.box[1] + P.box[3]) / 2, E = st.E;
    var svg = SV.el('svg', { viewBox: [cx - E / 2, cy - E / 2, E, E], class: 'fm-opt-svg', 'aria-hidden': 'true', focusable: 'false', preserveAspectRatio: 'xMidYMid meet' });
    var fill = hatchDefs(svg, 5 / st.k), g = SV.el('g', { class: 'fm-solid' }), faces = {};
    P.faces.filter(function (f) { return f.c > 0; }).forEach(function (f) {
      var fg = SV.el('g');
      fg.appendChild(SV.el('path', { d: SV.pathData(f.pts, true), class: 'px-fig-face ' + tone(f.light) }));
      var mp = markPoly(f.pts, o.marks[f.f]);
      if (mp) fg.appendChild(SV.el('path', { d: SV.pathData(mp, true), class: 'fm-mark', style: 'fill:' + fill }));
      fg.appendChild(SV.el('path', { d: SV.pathData(f.pts, true), class: 'fm-edge' }));
      g.appendChild(fg);
      faces[f.f] = { g: fg, pts: f.pts };
    });
    svg.appendChild(g);
    var labels = SV.el('g', { class: 'fm-labels' });
    svg.appendChild(labels);
    svg.style.maxWidth = Math.round(E * st.k) + 'px';
    var tag = h('span.ex-tag', { hidden: true });
    el.appendChild(h('span.ex-opt.fm-opt-cell', svg, tag));
    st.opts[i] = { el: el, svg: svg, faces: faces, labels: labels, tag: tag };
  }
  function optionLabel(item, i) { return 'Solid ' + (i + 1); }
  function gridCols() { return 4; }

  /* ---------- mount, present, reveal ---------- */
  function describe(item) {
    var n = item.marks.filter(function (x) { return x; }).length;
    return 'A flat pattern of ' + item.net.length + ' faces with ' + n + ' marked; dashed lines fold. Which of four pictured solids, each turned its own way, folds from it?';
  }
  function mount(ctx) {
    var root = h('div.fm-stem'), stage = h('div.ex-stage.fm-stage');
    var svg = SV.el('svg', { class: 'fm-svg', 'aria-hidden': 'true', focusable: 'false', preserveAspectRatio: 'xMidYMid meet' });
    var label = h('span.ex-label.fm-label', 'Pattern');
    stage.appendChild(svg); stage.appendChild(label);
    var caption = h('p.ex-caption', { 'aria-live': 'polite' }), verdict = h('div.ex-verdict.fm-verdict', { hidden: true, role: 'status' }), desc = h('p.px-sr');
    root.appendChild(stage);
    root.appendChild(h('div.fm-under', caption, verdict));
    root.appendChild(desc);
    ctx.host.appendChild(root);
    st = { ctx: ctx, root: root, stage: stage, svg: svg, label: label, caption: caption, verdict: verdict, desc: desc, item: null, optItem: null, opts: [], k: 30 };
  }
  function present(item, ctx) {
    if (!st) mount(ctx);
    newItem(item);
    st.item = item;
    st.root.classList.remove('is-revealed');
    st.verdict.hidden = true;
    st.caption.textContent = '';
    st.desc.textContent = describe(item);
    drawNet(item);
    return timing.nextPaint();
  }
  var WHY = { shape: 'Wrong size', marks: 'Marks do not fit', mirror: 'Mirror image' };
  function reveal(item, response, result, ctx) {
    if (!st) return Promise.resolve();
    st.root.classList.add('is-revealed');
    st.opts.forEach(function (o, i) {
      if (!o) return;
      o.tag.textContent = i === item.key ? '✓ Folds from it' : WHY[item.options[i].kind] || 'Does not fold';
      o.tag.setAttribute('data-kind', i === item.key ? 'key' : 'foil');
      o.tag.hidden = false;
    });
    st.verdict.textContent = '✓ Solid ' + (item.key + 1);
    st.verdict.setAttribute('data-kind', 'key');
    st.verdict.hidden = false;
    return timing.wait(ctx && ctx.fast ? 0 : 250);
  }

  /* ---------- show me ---------- */
  function faceKey(F) { return F.slice().sort(function (a, b) { return a - b; }).join(','); }
  // The face map (option face → solid face) of the turn that best fits option i's seen marks, and
  // the seen faces that still contradict the pattern under it.
  function bestMap(item, i) {
    var S = item.solid, o = item.options[i], O = o.solid, seen = lib.seenFaces(O, o.view), idx = {}, best = null;
    O.faces.forEach(function (G, g) { idx[faceKey(G)] = g; });
    lib.matchings(S, O).forEach(function (map) {
      var back = {};
      S.faces.forEach(function (F, f) { back[idx[faceKey(F.map(function (v) { return map[v]; }))]] = f; });
      var bad = seen.filter(function (g) {
        var f = back[g], a = item.marks[f], b = o.marks[g];
        if (typeof a !== 'object' || typeof b !== 'object') return a !== b;
        return faceKey(lib.halfSet(S.faces[f], a.h).map(function (v) { return map[v]; })) !== faceKey(lib.halfSet(O.faces[g], b.h));
      });
      if (!best || bad.length < best.bad.length) best = { back: back, bad: bad, seen: seen };
    });
    return best;
  }
  function centroid(pts) { var x = 0, y = 0; pts.forEach(function (p) { x += p[0]; y += p[1]; }); return [x / pts.length, y / pts.length]; }
  function label(group, pts, text, size, kind) {
    var c = centroid(pts), g = SV.el('g', { class: 'fm-tag' + (kind ? ' fm-tag--' + kind : '') });
    g.appendChild(SV.el('circle', { cx: c[0], cy: c[1], r: size * 0.78 }));
    g.appendChild(SV.text(c[0], c[1], text, { style: 'font-size:' + size.toFixed(3) + 'px' }));
    group.appendChild(g);
  }
  function optUnit(i) { var r = st.opts[i].svg.getBoundingClientRect(); return st.E / Math.max(1, Math.min(r.width, r.height)); }
  function clearMarks() {
    PX.ui.clear(st.netLabels);
    st.opts.forEach(function (o, j) {
      if (!o) return;
      PX.ui.clear(o.labels);
      var b = o.el.closest ? o.el.closest('.px-choice') : null;
      if (b) b.classList.remove('ex-focus');
      Object.keys(o.faces).forEach(function (f) { o.faces[f].g.classList.remove('is-pointed'); });
      void j;
    });
    Object.keys(st.netG || {}).forEach(function (f) { st.netG[f].g.classList.remove('is-pointed'); });
  }
  function focusOption(i) { var b = st.opts[i] && st.opts[i].el.closest ? st.opts[i].el.closest('.px-choice') : null; if (b) b.classList.add('ex-focus'); }
  // Faces f of the solid (with letters) shown in the pattern and, through the map, in option i.
  function tagFaces(item, i, map, list, kind) {
    var u = optUnit(i), sNet = 15 / st.k, sOpt = 15 * u;
    list.forEach(function (x) {
      var n = st.netG[x.f];
      if (n) { label(st.netLabels, n.pts, x.t, sNet, kind); n.g.classList.add('is-pointed'); }
      var g = null;
      Object.keys(map.back).forEach(function (k) { if (map.back[k] === x.f) g = +k; });
      var of = g !== null ? st.opts[i].faces[g] : null;
      if (of) { label(st.opts[i].labels, of.pts, x.t, sOpt, kind); of.g.classList.add('is-pointed'); }
    });
  }
  function steps(item, response) {
    var key = item.key, picked = typeof response === 'number' && response >= 0 && response < 4 && response !== key ? response : -1;
    var km = bestMap(item, key), S = item.solid, seenS = km ? km.seen.map(function (g) { return km.back[g]; }) : [];
    var land = seenS.filter(function (f) { return item.marks[f]; })[0];
    if (land === undefined) land = seenS[0];
    var nb = [];
    lib.adjacency(S).forEach(function (e) { var o = e.f === land ? e.g : e.g === land ? e.f : -1; if (o >= 0 && seenS.indexOf(o) >= 0 && nb.indexOf(o) < 0) nb.push(o); });
    var letters = 'ABCDEFG', tags = [{ f: land, t: 'A' }].concat(nb.slice(0, 3).map(function (f, j) { return { f: f, t: letters[j + 1] }; }));
    var list = [
      { ms: 1500, caption: cap('pattern'), enter: function () { clearMarks(); st.label.classList.add('is-pointed'); }, exit: function () { st.label.classList.remove('is-pointed'); } },
      { ms: 1400, caption: cap('solids'), enter: function () { clearMarks(); } },
      { ms: 1900, caption: cap('landmark', { f: 'A' }), enter: function () { clearMarks(); if (km) tagFaces(item, key, km, tags.slice(0, 1)); } },
      { ms: 2000, caption: cap('match', { n: key + 1 }), enter: function () { clearMarks(); focusOption(key); if (km) tagFaces(item, key, km, tags.slice(0, 1)); } },
      { ms: 2200, caption: cap('neighbours', { list: tags.slice(1).map(function (x) { return x.t; }).join(', ') || '—' }), enter: function () { clearMarks(); focusOption(key); if (km) tagFaces(item, key, km, tags); } },
      { ms: 1300, caption: cap('land', { n: key + 1 }), enter: function () { clearMarks(); focusOption(key); if (km) tagFaces(item, key, km, tags); } },
    ];
    if (picked >= 0) {
      var o = item.options[picked], why;
      if (o.kind === 'shape') {
        var d0 = item.solid.dims, d1 = o.solid.dims, j = 0;
        for (var q = 0; q < d0.length; q++) if (d0[q] !== d1[q]) { j = q; break; }
        why = { ms: 2600, caption: cap('whyShape', { n: picked + 1, dir: d1[j] > d0[j] ? 'longer' : 'shorter' }), enter: function () { clearMarks(); focusOption(picked); } };
      } else {
        var pm = bestMap(item, picked), g = pm && pm.bad.length ? pm.bad[0] : -1;
        why = {
          ms: 2600, caption: cap(o.kind === 'mirror' ? 'whyMirror' : 'whyMarks', { n: picked + 1, f: '✗' }),
          enter: function () {
            clearMarks(); focusOption(picked);
            if (pm && g >= 0) {
              var u = optUnit(picked), of = st.opts[picked].faces[g], nf = st.netG[pm.back[g]];
              if (of) { label(st.opts[picked].labels, of.pts, '✗', 15 * u, 'bad'); of.g.classList.add('is-pointed'); }
              if (nf) { label(st.netLabels, nf.pts, '✗', 15 / st.k, 'bad'); nf.g.classList.add('is-pointed'); }
            }
          },
        };
      }
      list.push(why);
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
    return play(steps(item, null), ctx, { name: 'demo', caption: caption || null });
  }
  function unmount() {
    if (!st) return;
    if (st.root.parentNode) st.root.parentNode.removeChild(st.root);
    st = null;
  }

  PX.ex.view('form', {
    layout: 'stem+options',
    css: true,
    mount: mount, present: present, drawOption: drawOption, optionLabel: optionLabel, gridCols: gridCols,
    reveal: reveal, showMe: showMe, demo: demo, unmount: unmount,
    steps: function (item, response) { return st && st.item === item ? steps(item, response) : []; },
  });
})(window.PX);
