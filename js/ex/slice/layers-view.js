/* Slice, the produce variant 'mark' (v1.2 wave 2, W2-bets; PLAN milestone 4, CONTRACT-v1.2 S, note T1 §4.3).
   The solid and the cutting plane stay as in every Slice item; a layer over the picture adds the solid's
   hidden edges (dashed) and takes taps: a tap within 26 px of an edge marks the point of that edge nearest
   the tap, a second tap on a marked edge clears it, and the app draws the polygon through the marks. This
   is the analytic way to find a section: where does the plane cross each edge? Keys: arrows left and right
   choose an edge, Space marks it, arrows up and down move its mark along it, Enter checks. The reveal rings
   the true crossing points and outlines the true section on the solid: marks on crossed edges in green,
   marks on other edges in red, missed edges with dashed rings. Show me slides the plane in, lifts the
   front piece away and turns to face the cut (Slice's own steps, without the options), then returns to
   the solid. js/ex/slice/view.js calls these through its 'mark' block with its own pieces (api). */
(function (PX) {
  'use strict';
  var h = PX.ui.h, timing = PX.core.timing, SV = PX.core.svg, win = window;
  var HIT = 26; // px: how far from an edge a tap still marks it (a band 52 px wide)
  var cur = null;

  var T = {
    task: 'Tap each edge where the plane crosses it, hidden edges (dashed) too.',
    keys: 'Keys: arrows left and right choose an edge, Space marks it, up and down move the mark, Enter checks.',
    back: 'Back on the solid: the rings are where the plane crosses its edges.',
  };
  function lib() { return PX.ex.get('slice').lib; }
  function plural(n, one, many) { return n + ' ' + (n === 1 ? one : many); }
  function sub(a, b) { return [a[0] - b[0], a[1] - b[1], a[2] - b[2]]; }
  function dot(a, b) { return a[0] * b[0] + a[1] * b[1] + a[2] * b[2]; }
  function cross(a, b) { return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]; }
  function lerp(a, b, t) { return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t]; }

  // Which edges face away (both faces turned from the camera): those are drawn dashed.
  function hiddenEdges(g, dir) {
    var c = [0, 0, 0];
    g.V.forEach(function (v) { c[0] += v[0] / g.V.length; c[1] += v[1] / g.V.length; c[2] += v[2] / g.V.length; });
    var front = g.F.map(function (f) {
      var a = g.V[f[0]], nrm = cross(sub(g.V[f[1]], a), sub(g.V[f[2]], a)), fc = [0, 0, 0];
      f.forEach(function (i) { fc[0] += g.V[i][0] / f.length; fc[1] += g.V[i][1] / f.length; fc[2] += g.V[i][2] / f.length; });
      if (dot(nrm, sub(fc, c)) < 0) nrm = [-nrm[0], -nrm[1], -nrm[2]];
      return dot(nrm, dir) > 0;
    });
    return g.E.map(function (e) { return !front[e[2]] && !front[e[3]]; });
  }

  function prepare(item, ctx, api) {
    stop();
    var st = api.st(), g = lib().markEdges(item.solid);
    if (!st || !st.stage || !g) return;
    var svg = SV.el('svg', { class: 'bets-slice-svg', 'aria-hidden': 'true', focusable: 'false' });
    var hidden = SV.el('g', { class: 'bets-slice-hidden' }), poly = SV.el('polygon', { class: 'bets-slice-poly', points: '' });
    var marks = SV.el('g', { class: 'bets-slice-marks' }), focus = SV.el('line', { class: 'bets-slice-focus' });
    var truth = SV.el('g', { class: 'bets-slice-truth' });
    svg.appendChild(hidden); svg.appendChild(poly); svg.appendChild(truth); svg.appendChild(focus); svg.appendChild(marks);
    var layer = h('div.bets-slice-layer', { 'data-px-keys': '' }, svg);
    st.stage.appendChild(layer);
    var count = h('span.bets-draw-count', { 'aria-live': 'polite' }, 'Marked: 0');
    var clear = PX.ui.button('Clear', { kind: 'ghost', small: true, onClick: function () { if (cur && cur.accepting) { cur.marks = {}; paint(); } } });
    var check = PX.ui.button('Check', { kind: 'primary', key: 'Enter', onClick: function () { submit(); } });
    check.setAttribute('data-px-keys', '');
    var verdict = h('div.ex-verdict.bets-draw-verdict', { hidden: true, role: 'status' });
    var root = h('div.bets-draw.bets-slice', { 'data-produce': 'slice', tabindex: '0', role: 'group', 'aria-label': 'Mark the edges the plane crosses' },
      h('p.bets-draw-task', T.task), h('div.bets-draw-actions', count, clear, check), verdict, h('p.px-meta.bets-draw-keys', T.keys));
    st.root.appendChild(root);
    if (st.desc) st.desc.textContent = 'A solid and a cutting plane. Mark every edge of the solid that the plane crosses (' + g.E.length +
      ' edges; the hidden ones are dashed): tap an edge, or choose one with the arrow keys and press Space; check with Enter.';
    cur = { item: item, api: api, g: g, hide: hiddenEdges(g, item.view.dir), svg: svg, layer: layer, hiddenG: hidden, poly: poly, marksG: marks, truthG: truth, focusEl: focus,
      root: root, count: count, clear: clear, check: check, verdict: verdict, P: [], marks: {}, focus: -1, accepting: false, respond: null, popKeys: null, offResize: null };
    svg.addEventListener('pointerdown', onTap);
    var onResize = function () { if (cur) { place(); paint(); } };
    win.addEventListener('resize', onResize);
    cur.offResize = function () { win.removeEventListener('resize', onResize); };
    place();
    paint();
  }

  // The corners on the stage (CSS px) and the hidden edges, after every layout change.
  function place() {
    var s = cur.api.size();
    if (!s) return;
    cur.svg.setAttribute('viewBox', '0 0 ' + s.W + ' ' + s.H);
    cur.P = cur.g.V.map(function (v) { return cur.api.project(v); });
    var g = cur.hiddenG;
    while (g.firstChild) g.removeChild(g.firstChild);
    cur.g.E.forEach(function (e, i) { if (cur.hide[i]) g.appendChild(segEl(i, 'bets-slice-edge is-hidden')); });
  }
  function segEl(i, cls) {
    var e = cur.g.E[i], a = cur.P[e[0]], b = cur.P[e[1]];
    return SV.el('line', { x1: a[0], y1: a[1], x2: b[0], y2: b[1], class: cls });
  }
  function ptOn(i, t) { var e = cur.g.E[i], a = cur.P[e[0]], b = cur.P[e[1]]; return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]; }

  function onTap(ev) {
    if (!cur || !cur.accepting) return;
    var r = cur.svg.getBoundingClientRect(), s = cur.api.size();
    if (!r.width || !s) return;
    var x = (ev.clientX - r.left) * s.W / r.width, y = (ev.clientY - r.top) * s.H / r.height, best = -1, bd = Infinity, bt = 0.5;
    cur.g.E.forEach(function (e, i) {
      var a = cur.P[e[0]], b = cur.P[e[1]], dx = b[0] - a[0], dy = b[1] - a[1], l2 = dx * dx + dy * dy || 1;
      var t = Math.max(0, Math.min(1, ((x - a[0]) * dx + (y - a[1]) * dy) / l2)), px = a[0] + dx * t - x, py = a[1] + dy * t - y, d = Math.sqrt(px * px + py * py);
      if (d < bd) { bd = d; best = i; bt = t; }
    });
    if (best < 0 || bd > HIT) return;
    if (cur.marks[best] !== undefined) delete cur.marks[best]; else cur.marks[best] = Math.max(0.06, Math.min(0.94, bt));
    cur.focus = best;
    cur.keyed = false;
    paint();
    ev.preventDefault();
  }

  function order(pts) {
    var cx = 0, cy = 0;
    pts.forEach(function (p) { cx += p[0] / pts.length; cy += p[1] / pts.length; });
    return pts.slice().sort(function (a, b) { return Math.atan2(a[1] - cy, a[0] - cx) - Math.atan2(b[1] - cy, b[0] - cx); });
  }
  function paint() {
    var g = cur.marksG, ids = Object.keys(cur.marks).map(Number);
    while (g.firstChild) g.removeChild(g.firstChild);
    var pts = ids.map(function (i) { return ptOn(i, cur.marks[i]); });
    ids.forEach(function (i, k) {
      g.appendChild(segEl(i, 'bets-slice-edge is-marked'));
      g.appendChild(SV.el('circle', { cx: pts[k][0], cy: pts[k][1], r: 5.5, class: 'bets-slice-mark' }));
    });
    cur.poly.setAttribute('points', pts.length >= 3 ? order(pts).map(function (p) { return p[0].toFixed(1) + ',' + p[1].toFixed(1); }).join(' ') : '');
    if (cur.focus >= 0 && cur.keyed && cur.accepting) {
      var e = cur.g.E[cur.focus], a = cur.P[e[0]], b = cur.P[e[1]];
      ['x1', 'y1', 'x2', 'y2'].forEach(function (k, j) { cur.focusEl.setAttribute(k, [a[0], a[1], b[0], b[1]][j]); });
      cur.focusEl.classList.add('is-on');
    } else cur.focusEl.classList.remove('is-on');
    cur.count.textContent = 'Marked: ' + ids.length;
    cur.check.disabled = !cur.accepting || !ids.length;
    cur.clear.disabled = !cur.accepting || !ids.length;
  }

  function collect(item, ctx, respond, api) {
    if (!cur || cur.item !== item) prepare(item, ctx, api);
    if (!cur) return;
    cur.respond = respond;
    cur.accepting = true;
    var n = cur.g.E.length;
    function pick(d) { cur.focus = cur.focus < 0 ? (d > 0 ? 0 : n - 1) : (cur.focus + d + n) % n; cur.keyed = true; paint(); }
    function slide(d) {
      if (cur.focus < 0 || cur.marks[cur.focus] === undefined) return false;
      cur.marks[cur.focus] = Math.max(0.06, Math.min(0.94, cur.marks[cur.focus] + d));
      cur.keyed = true; paint();
    }
    if (cur.popKeys) cur.popKeys();
    cur.popKeys = ctx.keys && ctx.keys.push ? ctx.keys.push({
      ArrowRight: function () { if (!cur || !cur.accepting) return false; pick(1); },
      ArrowLeft: function () { if (!cur || !cur.accepting) return false; pick(-1); },
      ArrowUp: function () { if (!cur || !cur.accepting) return false; return slide(0.1); },
      ArrowDown: function () { if (!cur || !cur.accepting) return false; return slide(-0.1); },
      Space: function () {
        if (!cur || !cur.accepting || cur.focus < 0) return false;
        if (cur.marks[cur.focus] !== undefined) delete cur.marks[cur.focus]; else cur.marks[cur.focus] = 0.5;
        cur.keyed = true; paint();
      },
      Enter: function () { if (!cur || !cur.accepting) return false; submit(); },
      repeat: ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'],
    }, { through: true }) : null;
    paint();
  }

  function submit() {
    if (!cur || !cur.accepting || !cur.respond) return;
    var ids = Object.keys(cur.marks).map(Number).sort(function (a, b) { return a - b; });
    if (!ids.length) return;
    var respond = cur.respond;
    cur.respond = null;
    stopInput();
    paint();
    respond(ids, { amode: 'place', frames: null }); // a still picture: no frame verdict (it cannot change what was seen)
  }
  function stopInput() {
    if (!cur) return;
    cur.accepting = false;
    if (cur.popKeys) { cur.popKeys(); cur.popKeys = null; }
  }
  function stop() {
    stopInput();
    if (cur) {
      if (cur.offResize) cur.offResize();
      [cur.layer, cur.root].forEach(function (el) { if (el && el.parentNode) el.parentNode.removeChild(el); });
    }
    cur = null;
  }

  // The truth on the picture: rings where the plane crosses, the true outline, marks right or wrong.
  function drawTruth(response) {
    var cut = lib().markCut(cur.item), g = cur.truthG, mine = {};
    (Array.isArray(response) ? response : []).forEach(function (i) { mine[i] = true; });
    while (g.firstChild) g.removeChild(g.firstChild);
    var tp = cut.ids.map(function (i) { return ptOn(i, cut.t[i]); });
    g.appendChild(SV.el('polygon', { points: order(tp).map(function (p) { return p[0].toFixed(1) + ',' + p[1].toFixed(1); }).join(' '), class: 'bets-slice-true' }));
    cut.ids.forEach(function (i, k) { g.appendChild(SV.el('circle', { cx: tp[k][0], cy: tp[k][1], r: 9, class: 'bets-slice-ring' + (mine[i] ? ' is-right' : ' is-missed') })); });
    var m = cur.marksG;
    Object.keys(cur.marks).forEach(function (k) {
      var i = +k, p = ptOn(i, cur.marks[i]), right = cut.ids.indexOf(i) >= 0;
      m.appendChild(SV.el('circle', { cx: p[0], cy: p[1], r: 5.5, class: 'bets-slice-mark ' + (right ? 'is-right' : 'is-extra') }));
      if (!right) m.appendChild(SV.el('path', { d: 'M' + (p[0] - 6) + ' ' + (p[1] - 6) + 'L' + (p[0] + 6) + ' ' + (p[1] + 6) + 'M' + (p[0] - 6) + ' ' + (p[1] + 6) + 'L' + (p[0] + 6) + ' ' + (p[1] - 6), class: 'bets-slice-cross' }));
    });
    return cut;
  }

  function reveal(item, response, result, ctx) {
    if (!cur || cur.item !== item) return Promise.resolve();
    stopInput();
    cur.keyed = false;
    paint();
    cur.poly.setAttribute('points', '');
    drawTruth(response);
    cur.check.disabled = true; cur.clear.disabled = true;
    var d = (result && result.detail) || {}, n = item.key.length, ok = !!(result && result.correct);
    cur.verdict.textContent = ok ? '✓ All ' + plural(n, 'edge', 'edges') + ' the plane crosses.'
      : (d.right || 0) + ' of ' + plural(n, 'edge', 'edges') + ' the plane crosses' + (d.missing ? '; ' + d.missing + ' missed (dashed rings)' : '') + (d.extra ? '; ' + d.extra + ' extra (red)' : '') + '.';
    cur.verdict.setAttribute('data-kind', ok ? 'key' : 'foil');
    cur.verdict.hidden = false;
    cur.root.classList.add('is-revealed');
    return timing.wait(ctx && ctx.fast ? 0 : 250);
  }

  function showMe(item, response, ctx, api) {
    var list = api.steps(item), layer = cur && cur.layer;
    if (layer) layer.hidden = true;
    list.push({ ms: 2600, caption: T.back, enter: function () { api.trial(); if (cur && cur.item === item) { cur.layer.hidden = false; place(); } } });
    api.revealStage(ctx);
    var done = function () { if (cur && cur.item === item && cur.layer) { cur.layer.hidden = false; } };
    return api.play(list, ctx, { name: 'show-me' }).then(done, done);
  }

  PX.ui.betsDraw = PX.ui.betsDraw || {};
  // for tests: a point of edge i (share t of its length) in client px, and the edge a tap there would mark
  function at(i, t) {
    if (!cur) return null;
    var p = ptOn(i, t), r = cur.svg.getBoundingClientRect(), s = cur.api.size();
    return [r.left + p[0] * r.width / s.W, r.top + p[1] * r.height / s.H];
  }
  function nearest(cx, cy) {
    if (!cur) return -1;
    var r = cur.svg.getBoundingClientRect(), s = cur.api.size(), x = (cx - r.left) * s.W / r.width, y = (cy - r.top) * s.H / r.height, best = -1, bd = Infinity;
    cur.g.E.forEach(function (e, i) {
      var a = cur.P[e[0]], b = cur.P[e[1]], dx = b[0] - a[0], dy = b[1] - a[1], l2 = dx * dx + dy * dy || 1;
      var t = Math.max(0, Math.min(1, ((x - a[0]) * dx + (y - a[1]) * dy) / l2)), d = Math.hypot(a[0] + dx * t - x, a[1] + dy * t - y);
      if (d < bd) { bd = d; best = i; }
    });
    return bd <= HIT ? best : -1;
  }
  PX.ui.betsDraw.slice = { prepare: prepare, collect: collect, reveal: reveal, showMe: showMe, stop: stop, T: T, at: at, nearest: nearest };
})(window.PX);
