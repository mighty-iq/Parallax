/* EX-19 Form (DAT-style format): view (DOM and SVG; ARCHITECTURE.md §6). layout 'stem+options'.
   The stem is the flat pattern (fold lines dashed, cut edges solid); options are SVG pictures of
   convex solids (orthographic, flat tones by face direction, outlines). The pattern and the solids
   share one scale (px per unit), so sizes compare directly. Marks: a darker tone plus a hatch;
   a half mark shades one side of a diagonal. Never colour alone.
   Show me (ctx.play steps, from the grading model: lib.matchings and lib.possible give the face
   map): a landmark face (a mark the right solid shows) is numbered in the pattern and in the solid,
   then its neighbours; after a wrong pick, the face that cannot be marked so (or the mirror image)
   is marked in that solid and in the pattern, or, for a wrong size, the edge that differs is marked
   in both. The Watch adds both kinds of wrong solid (foilTour). Every step's enter() sets its full
   state.
   Fold-up (O51, v1.2): after the landmark steps the pattern itself folds up about its hinges
   (lib.fold with a fold fraction, the validator's own folding), seen at a slant, then turns to the
   right solid's pose and size, so it lands on the picture of that solid. Drawn in its own SVG
   layer over the pattern (depth-sorted faces; marks only on the outside).
   Try 1 (ctx.assist = { letters: true }): the faces that share an edge with the shaded face once
   folded are lettered in the pattern, the second step of the card "Shape, then one landmark" done. */
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
    return { faces: faces, box: [x0, y0, x1, y1], P: P };
  }
  function tone(light) { return light >= 0.7 ? 'px-fig-top' : light >= 0.25 ? 'px-fig-side' : 'px-fig-far'; }
  // A hatch pattern in user units; set(pitch) resizes it (the options' pitch follows their drawn size).
  function hatchDefs(svg, pitch) {
    var id = 'fm-hatch-' + (++uid), defs = SV.el('defs'), pat = SV.el('pattern', { id: id, patternUnits: 'userSpaceOnUse', patternTransform: 'rotate(45)' });
    var rect = SV.el('rect', { x: 0, y: 0, class: 'fm-hatch-bg' }), line = SV.el('line', { x1: 0, y1: 0, x2: 0, class: 'fm-hatch-line' });
    function set(p) { SV.attrs(pat, { width: p, height: p }); SV.attrs(rect, { width: p, height: p }); SV.attrs(line, { y2: p }); line.setAttribute('style', 'stroke-width:' + (p * 0.42).toFixed(3)); }
    set(pitch);
    pat.appendChild(rect); pat.appendChild(line);
    defs.appendChild(pat);
    svg.appendChild(defs);
    return { url: 'url(#' + id + ')', set: set };
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
    var fill = hatchDefs(svg, 5 / k).url, byFace = {};
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
    var hatch = hatchDefs(svg, 5 / st.k), fill = hatch.url, g = SV.el('g', { class: 'fm-solid' }), faces = {};
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
    st.opts[i] = { el: el, svg: svg, faces: faces, labels: labels, tag: tag, hatch: hatch };
  }
  // The hatch keeps a 5 px pitch however small an option is drawn (R3 §8.6: at least 4 px).
  function fitHatches() {
    st.opts.forEach(function (o) {
      if (!o) return;
      var r = o.svg.getBoundingClientRect(), w = Math.min(r.width, r.height); // the square viewBox fits the smaller side
      if (w > 0) o.hatch.set(5 * st.E / w);
    });
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
    var foldSvg = SV.el('svg', { class: 'fm-fold', 'aria-hidden': 'true', focusable: 'false' });
    foldSvg.style.display = 'none';
    stage.appendChild(svg); stage.appendChild(foldSvg); stage.appendChild(label);
    var caption = h('p.ex-caption', { 'aria-live': 'polite' }), verdict = h('div.ex-verdict.fm-verdict', { hidden: true, role: 'status' }), desc = h('p.px-sr');
    root.appendChild(stage);
    root.appendChild(h('div.fm-under', caption, verdict));
    root.appendChild(desc);
    ctx.host.appendChild(root);
    st = { ctx: ctx, root: root, stage: stage, svg: svg, foldSvg: foldSvg, label: label, caption: caption, verdict: verdict, desc: desc, item: null, optItem: null, opts: [], k: 30 };
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
    showFold(false);
    if (ctx && ctx.assist && ctx.assist.letters) { letterNeighbours(item); st.caption.textContent = cap('assist'); }
    if (ctx && ctx.assist && ctx.assist.half) { dotHalfCorner(item); st.caption.textContent = cap('assistHalf'); }
    fitHatches();
    return timing.nextPaint();
  }
  // Try 3's first look at a half mark: its shaded corner dotted in the pattern (which way it is turned).
  function dotHalfCorner(item) {
    item.net.forEach(function (n) {
      var m = item.marks[n.face], g = st.netG[n.face];
      if (!m || typeof m !== 'object' || !g) return;
      var c = g.pts[(m.h + 1) % 4], q = centroid(g.pts), r = 6 / st.k;
      st.netLabels.appendChild(SV.el('circle', { cx: c[0] + (q[0] - c[0]) * 0.18, cy: c[1] + (q[1] - c[1]) * 0.18, r: r, class: 'fm-corner' }));
    });
  }
  // Try 1's step done: the faces that meet the shaded face once folded, lettered where they lie in the
  // pattern (they need not touch it there).
  function letterNeighbours(item) {
    var f0 = item.marks.indexOf(1), letters = 'ABCDEFG', n = 0, size = 15 / st.k;
    if (f0 < 0) return;
    lib.adjacency(item.solid).forEach(function (e) {
      var o = e.f === f0 ? e.g : e.g === f0 ? e.f : -1, nf = o >= 0 ? st.netG[o] : null;
      if (nf && n < letters.length) label(st.netLabels, nf.pts, letters[n++], size);
    });
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
    showFold(false);
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
  // The edge of a wrong-size solid that differs most from the pattern's, preferring one on a face the
  // picture shows clearly (vertex ids match: the same kind of solid built with another size).
  function changedEdge(item, i) {
    var S = item.solid, o = item.options[i], O = o.solid, c = lib.facing(O, o.view), best = null;
    function d(s0, a, b) { var p = s0.verts[a], q = s0.verts[b]; return Math.sqrt((p[0] - q[0]) * (p[0] - q[0]) + (p[1] - q[1]) * (p[1] - q[1]) + (p[2] - q[2]) * (p[2] - q[2])); }
    lib.adjacency(O).forEach(function (e) {
      var lo = d(O, e.a, e.b), ls = d(S, e.a, e.b), seen = Math.max(c[e.f], c[e.g]);
      if (Math.abs(lo - ls) < 0.05 || seen <= 0) return;
      var score = (seen >= lib.SEEN ? 10 : 0) + Math.abs(lo - ls) / Math.max(lo, ls);
      if (!best || score > best.score) best = { a: e.a, b: e.b, f: e.f, g: e.g, longer: lo > ls, score: score };
    });
    return best;
  }
  // That edge marked (thick dots) in solid i and wherever it lies in the pattern.
  function markEdge(item, i, e) {
    var P = st.proj[i].P;
    st.opts[i].labels.appendChild(SV.el('path', { d: 'M' + SV.pathData([P[e.a], P[e.b]]).slice(1), class: 'fm-edge-hl' }));
    [e.f, e.g].forEach(function (f) {
      var n = st.netG[f], F = item.solid.faces[f], ia = F.indexOf(e.a), ib = F.indexOf(e.b);
      if (!n || ia < 0 || ib < 0) return;
      st.netLabels.appendChild(SV.el('path', { d: 'M' + SV.pathData([n.pts[ia], n.pts[ib]]).slice(1), class: 'fm-edge-hl' }));
    });
  }
  // Why foil i does not fold from the pattern: the wrong size (the edge that differs, marked in both
  // places), or a face whose mark cannot look like that (✗ in the solid and in the pattern).
  function whyStep(item, i, ms) {
    var o = item.options[i];
    if (o.kind === 'shape') {
      var e = changedEdge(item, i);
      return { ms: ms, caption: e ? cap('whyShape', { n: i + 1, dir: e.longer ? 'longer' : 'shorter' }) : cap('whyShapeAny', { n: i + 1 }), enter: function () { clearMarks(); focusOption(i); if (e) markEdge(item, i, e); } };
    }
    var pm = bestMap(item, i), g = pm && pm.bad.length ? pm.bad[0] : -1;
    return {
      ms: ms, caption: cap(o.kind === 'mirror' ? 'whyMirror' : 'whyMarks', { n: i + 1, f: '✗' }),
      enter: function () {
        clearMarks(); focusOption(i);
        if (pm && g >= 0) {
          var u = optUnit(i), of = st.opts[i].faces[g], nf = st.netG[pm.back[g]];
          if (of) { label(st.opts[i].labels, of.pts, '✗', 15 * u, 'bad'); of.g.classList.add('is-pointed'); }
          if (nf) { label(st.netLabels, nf.pts, '✗', 15 / st.k, 'bad'); nf.g.classList.add('is-pointed'); }
        }
      },
    };
  }
  // The Watch also shows why two wrong ones are wrong: the wrong-size solid and the mirror image (or,
  // without a mirror image, marks in the wrong place).
  function foilTour(item) {
    var shape = -1, other = -1;
    item.options.forEach(function (o, i) {
      if (i === item.key) return;
      if (o.kind === 'shape' && shape < 0) shape = i;
      if (o.kind === 'mirror') other = i;
    });
    if (other < 0) item.options.forEach(function (o, i) { if (i !== item.key && o.kind === 'marks' && other < 0) other = i; });
    var list = [];
    if (shape >= 0 || other >= 0) list.push({ ms: 1600, caption: cap('foils'), enter: function () { clearMarks(); } });
    if (shape >= 0) list.push(whyStep(item, shape, 3400));
    if (other >= 0) list.push(whyStep(item, other, 3400));
    return list;
  }
  // The Watch: the landmark method and the fold-up, then both kinds of wrong solid, then back to the
  // right one so the Watch ends on the answer.
  function demoList(item) {
    var base = steps(item, null), tour = foilTour(item);
    return tour.length ? base.concat(tour, [base.landStep]) : base;
  }

  /* ---------- the fold-up (O51) ---------- */
  function sub3(a, b) { return [a[0] - b[0], a[1] - b[1], a[2] - b[2]]; }
  function unit3(a) { var l = Math.sqrt(dot(a, a)) || 1; return [a[0] / l, a[1] / l, a[2] / l]; }
  function mat3(rows) { return [rows[0][0], rows[0][1], rows[0][2], rows[1][0], rows[1][1], rows[1][2], rows[2][0], rows[2][1], rows[2][2]]; }
  function mm3(A, B) { var C = []; for (var r = 0; r < 3; r++) for (var c = 0; c < 3; c++) C.push(A[r * 3] * B[c] + A[r * 3 + 1] * B[3 + c] + A[r * 3 + 2] * B[6 + c]); return C; }
  function mv3(M, v) { return [M[0] * v[0] + M[1] * v[1] + M[2] * v[2], M[3] * v[0] + M[4] * v[1] + M[5] * v[2], M[6] * v[0] + M[7] * v[1] + M[8] * v[2]]; }
  // rotation matrix ↔ unit quaternion [w, x, y, z], and slerp between two rotations
  function quatOf(m) {
    var t = m[0] + m[4] + m[8], q;
    if (t > 0) { var s0 = Math.sqrt(t + 1) * 2; q = [s0 / 4, (m[7] - m[5]) / s0, (m[2] - m[6]) / s0, (m[3] - m[1]) / s0]; }
    else if (m[0] > m[4] && m[0] > m[8]) { var s1 = Math.sqrt(1 + m[0] - m[4] - m[8]) * 2; q = [(m[7] - m[5]) / s1, s1 / 4, (m[1] + m[3]) / s1, (m[2] + m[6]) / s1]; }
    else if (m[4] > m[8]) { var s2 = Math.sqrt(1 + m[4] - m[0] - m[8]) * 2; q = [(m[2] - m[6]) / s2, (m[1] + m[3]) / s2, s2 / 4, (m[5] + m[7]) / s2]; }
    else { var s3 = Math.sqrt(1 + m[8] - m[0] - m[4]) * 2; q = [(m[3] - m[1]) / s3, (m[2] + m[6]) / s3, (m[5] + m[7]) / s3, s3 / 4]; }
    return q;
  }
  function matOf(q) {
    var w = q[0], x = q[1], y = q[2], z = q[3];
    return [1 - 2 * (y * y + z * z), 2 * (x * y - z * w), 2 * (x * z + y * w), 2 * (x * y + z * w), 1 - 2 * (x * x + z * z), 2 * (y * z - x * w), 2 * (x * z - y * w), 2 * (y * z + x * w), 1 - 2 * (x * x + y * y)];
  }
  function slerpM(A, B, t) {
    var a = quatOf(A), b = quatOf(B), d = a[0] * b[0] + a[1] * b[1] + a[2] * b[2] + a[3] * b[3];
    if (d < 0) { b = b.map(function (x) { return -x; }); d = -d; }
    var q;
    if (d > 0.9995) q = a.map(function (x, i) { return x + (b[i] - x) * t; });
    else { var th = Math.acos(d), sa = Math.sin((1 - t) * th) / Math.sin(th), sb = Math.sin(t * th) / Math.sin(th); q = a.map(function (x, i) { return x * sa + b[i] * sb; }); }
    var l = Math.sqrt(q[0] * q[0] + q[1] * q[1] + q[2] * q[2] + q[3] * q[3]);
    return matOf(q.map(function (x) { return x / l; }));
  }
  function camRows(v) { var r = unit3([v[2], 0, -v[0]]); return mat3([r, cross(v, r), v]); } // right, up, toward the viewer
  var SLANT = unit3([0.38, 0.42, 0.82]);
  // The fold's geometry: the folded corners carried onto the solid by a turn (frames on the three
  // corners spanning the largest triangle), the cameras before, at a slant and as the right solid's
  // picture, and the centres to turn about.
  function foldModel(item) {
    var S = item.solid, pts = lib.fold(item), where = {}, key = item.options[item.key], V = S.verts, best = -1, a = 0, b = 1, c = 2;
    if (typeof pts === 'string') return null;
    S.faces.forEach(function (F, f) { F.forEach(function (v, i) { where[v] = pts[f][i]; }); });
    for (var i = 0; i < V.length; i++) for (var j = i + 1; j < V.length; j++) for (var k = j + 1; k < V.length; k++) {
      var ar = Math.sqrt(dot(cross(sub3(V[j], V[i]), sub3(V[k], V[i])), cross(sub3(V[j], V[i]), sub3(V[k], V[i]))));
      if (ar > best) { best = ar; a = i; b = j; c = k; }
    }
    function frame(p, q, r) { var e1 = unit3(sub3(q, p)), e2 = unit3(cross(sub3(q, p), sub3(r, p))); return mat3([e1, e2, cross(e2, e1)]); }
    var Fw = frame(where[a], where[b], where[c]), Fs = frame(V[a], V[b], V[c]);
    var R = mm3([Fs[0], Fs[3], Fs[6], Fs[1], Fs[4], Fs[7], Fs[2], Fs[5], Fs[8]], Fw); // Fsᵀ · Fw: folded → solid
    var dir = lib.VIEWS[key.view.el || 0], up = cross(dir, RIGHT), Mv = lib.viewMatrix(key.view);
    var C2 = mm3(mm3(mat3([RIGHT, up, dir]), Mv), R);
    var nb = netBox(item.net), netC = [(nb[0] + nb[2]) / 2, -(nb[1] + nb[3]) / 2, 0], solidC = [0, 0, 0];
    S.verts.forEach(function (_, v) { solidC = [solidC[0] + where[v][0] / V.length, solidC[1] + where[v][1] / V.length, solidC[2] + where[v][2] / V.length]; });
    return { C0: [1, 0, 0, 0, 1, 0, 0, 0, 1], C1: camRows(SLANT), C2: C2, netC: netC, solidC: solidC };
  }
  function showFold(on) {
    if (!st || !st.foldSvg) return;
    st.foldSvg.style.display = on ? '' : 'none';
    st.svg.style.opacity = on ? '0.12' : '';
  }
  // The pattern folded by fraction t, seen through camera rows Q, turned about centre cen; drawn with
  // the outside faces in their tones and marks, the inside pale, far faces first.
  function drawFold(item, fm, t, Q, cen) {
    var svg = st.foldSvg, W = Math.max(1, st.stage.clientWidth), H = Math.max(1, st.stage.clientHeight), top = 22, k = st.k;
    var pts = lib.fold(item, t), ox = W / 2, oy = top + (H - top) / 2;
    if (typeof pts === 'string') return;
    PX.ui.clear(svg);
    SV.attrs(svg, { viewBox: [0, 0, W, H] });
    var fill = hatchDefs(svg, 5).url, list = [];
    item.net.forEach(function (n) {
      var P = pts[n.face].map(function (p) { return mv3(Q, sub3(p, cen)); }), nz = 0, z = 0;
      for (var i = 0; i < P.length; i++) { var p = P[i], q = P[(i + 1) % P.length]; nz += (p[0] - q[0]) * (p[1] + q[1]); z += p[2] / P.length; }
      var nn = unit3(lib.newell(P));
      list.push({ f: n.face, z: z, front: nn[2] > 0, light: dot(nn, [-0.3, 0.6, 0.75]), scr: P.map(function (p) { return [ox + k * p[0], oy - k * p[1]]; }) });
    });
    list.sort(function (x, y) { return x.z - y.z; });
    list.forEach(function (x) {
      var g = SV.el('g');
      g.appendChild(SV.el('path', { d: SV.pathData(x.scr, true), class: x.front ? 'px-fig-face ' + tone(x.light) : 'fm-inside' }));
      var mp = x.front ? markPoly(x.scr, item.marks[x.f]) : null;
      if (mp) g.appendChild(SV.el('path', { d: SV.pathData(mp, true), class: 'fm-mark', style: 'fill:' + fill }));
      g.appendChild(SV.el('path', { d: SV.pathData(x.scr, true), class: 'fm-edge' }));
      svg.appendChild(g);
    });
  }
  function lerp3(a, b, e) { return [a[0] + (b[0] - a[0]) * e, a[1] + (b[1] - a[1]) * e, a[2] + (b[2] - a[2]) * e]; }
  function foldSteps(item) {
    var fm = foldModel(item), key = item.key;
    if (!fm) return [];
    function ease(x) { return x * x * (3 - 2 * x); }
    return [
      { ms: 1000, caption: cap('foldTilt'), enter: function () { clearMarks(); showFold(true); drawFold(item, fm, 0, fm.C0, fm.netC); },
        update: function (x) { drawFold(item, fm, 0, slerpM(fm.C0, fm.C1, ease(x)), fm.netC); } },
      { ms: 2600, caption: cap('foldUp'), enter: function () { clearMarks(); showFold(true); drawFold(item, fm, 0, fm.C1, fm.netC); },
        update: function (x) { drawFold(item, fm, ease(x), fm.C1, fm.netC); } },
      { ms: 2000, caption: cap('foldTurn', { n: key + 1 }), enter: function () { clearMarks(); showFold(true); drawFold(item, fm, 1, fm.C1, fm.netC); },
        update: function (x) { var e = ease(x); drawFold(item, fm, 1, slerpM(fm.C1, fm.C2, e), lerp3(fm.netC, fm.solidC, e)); },
        exit: function () { focusOption(key); } },
    ];
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
    var landStep = list[list.length - 1];
    list = list.concat(foldSteps(item));
    if (picked >= 0) list.push(whyStep(item, picked, 3000));
    list.landStep = landStep;
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
    return play(demoList(item), ctx, { name: 'demo', caption: caption || null });
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
    demoSteps: function (item) { return st && st.item === item ? demoList(item) : []; },
  });
})(window.PX);
