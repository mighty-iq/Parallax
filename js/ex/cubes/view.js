/* PAT-5 Painted Cubes: view (SVG; ARCHITECTURE.md §6, docs/dev/EXERCISE-GUIDE.md).
   layout 'stem+options': the stem is the figure, drawn from the item's height map with the
   generator's own camera (lib.proj, lib.facesOf: a parallel projection from the front right),
   faces in three tones with outlines (colour never the only cue), and the question with N in
   large type; the options are the counts 1–5.
   - Drawing order: cubes far to near (ascending x + y + z: with the viewer at +x, +y, +z a cube
     can only hide cubes that are behind it in all three directions), each cube's exposed top,
     front and right faces. Cubes carry no marks (Cube Match's format stays with the probe).
   - Reveal and show me: the cubes with exactly N painted sides get numbered badges; hidden ones
     are drawn as dashed ghost cubes on top of the figure. Show me tallies them one by one, column
     by column from the back, with each cube's painted sides named (lib.cubesOf: the same neighbour
     tests the validator recounts). */
(function (PX) {
  'use strict';

  var timing = PX.core.timing, U = PX.util, S = PX.core.svg;
  var h = PX.ui.h;
  var def = PX.ex.get('cubes'), lib = def.lib;
  var SIDES = ['top', 'front', 'right', 'back', 'left'];
  var st = null;

  function learn() { return PX.ex.learn('cubes') || {}; }
  function cap(key, vars) {
    var s = String((learn().captions || {})[key] || '');
    Object.keys(vars || {}).forEach(function (k) { s = s.split('{' + k + '}').join(String(vars[k])); });
    return s;
  }
  function plural(n, one, many) { return n + ' ' + (n === 1 ? one : many); }

  /* ---------- geometry ---------- */

  function pt(P) { return lib.proj(P); }
  // Corners of the face (side 0 top, 1 front, 2 right) of the cube at (x, y, z), in screen units.
  function faceCorners(x, y, z, side) {
    if (side === 0) return [[x, y + 1, z], [x + 1, y + 1, z], [x + 1, y + 1, z + 1], [x, y + 1, z + 1]].map(pt);
    if (side === 1) return [[x, y, z + 1], [x + 1, y, z + 1], [x + 1, y + 1, z + 1], [x, y + 1, z + 1]].map(pt);
    return [[x + 1, y, z], [x + 1, y, z + 1], [x + 1, y + 1, z + 1], [x + 1, y + 1, z]].map(pt);
  }
  // The figure's own bounds (every cube corner), padded.
  function bounds(cubes) {
    var b = [Infinity, Infinity, -Infinity, -Infinity];
    cubes.forEach(function (q) {
      for (var i = 0; i < 8; i++) {
        var c = pt([q.x + (i & 1), q.y + ((i >> 1) & 1), q.z + ((i >> 2) & 1)]);
        b[0] = Math.min(b[0], c[0]); b[1] = Math.min(b[1], c[1]); b[2] = Math.max(b[2], c[0]); b[3] = Math.max(b[3], c[1]);
      }
    });
    var m = 0.35;
    return [b[0] - m, b[1] - m, b[2] - b[0] + 2 * m, b[3] - b[1] + 2 * m];
  }

  /* ---------- drawing ---------- */

  function figureSvg(item, cls) {
    var cubes = lib.cubesOf(item.heights), vb = bounds(cubes);
    var svg = S.svg(vb[2], vb[3], { viewBox: vb, class: 'ex-cubes-svg ' + (cls || ''), width: '100%' });
    var order = cubes.map(function (q, i) { return i; }).sort(function (a, b) {
      var qa = cubes[a], qb = cubes[b];
      return (qa.x + qa.y + qa.z) - (qb.x + qb.y + qb.z) || qa.y - qb.y || a - b;
    });
    var g = S.el('g', { class: 'ex-cubes-figure' });
    order.forEach(function (i) {
      var q = cubes[i];
      for (var s = 0; s < 3; s++) {
        if (!q.sides[s]) continue;
        g.appendChild(S.path(faceCorners(q.x, q.y, q.z, s), true, { class: 'ex-cubes-face ex-cubes-face--' + SIDES[s] }));
      }
    });
    svg.appendChild(g);
    svg.appendChild(S.el('g', { class: 'ex-cubes-marks' }));
    return { svg: svg, cubes: cubes, vb: vb };
  }
  // A cube outlined as a dashed ghost (all 12 edges), for the hidden supports.
  function ghost(q) {
    var c = [];
    for (var i = 0; i < 8; i++) c.push(pt([q.x + (i & 1), q.y + ((i >> 1) & 1), q.z + ((i >> 2) & 1)]));
    var E = [[0, 1], [2, 3], [4, 5], [6, 7], [0, 2], [1, 3], [4, 6], [5, 7], [0, 4], [1, 5], [2, 6], [3, 7]];
    var d = E.map(function (e) { return 'M' + c[e[0]][0] + ' ' + c[e[0]][1] + 'L' + c[e[1]][0] + ' ' + c[e[1]][1]; }).join('');
    return S.el('path', { d: d, class: 'ex-cubes-ghost' });
  }
  // A numbered badge on the cube's most visible face, or at its centre when it is hidden.
  function badge(q, n, hidden, vis) {
    var at;
    if (hidden) at = pt([q.x + 0.5, q.y + 0.5, q.z + 0.5]);
    else {
      var best = 0, side = 0;
      for (var s = 0; s < 3; s++) if (vis && vis.faces[s] > best) { best = vis.faces[s]; side = s; }
      var f = faceCorners(q.x, q.y, q.z, side);
      at = [(f[0][0] + f[2][0]) / 2, (f[0][1] + f[2][1]) / 2];
    }
    var g = S.el('g', { class: 'ex-cubes-badge' + (hidden ? ' is-hidden' : '') });
    g.appendChild(S.el('circle', { cx: at[0], cy: at[1], r: 0.3 }));
    g.appendChild(S.text(at[0], at[1] + 0.11, String(n), { class: 'ex-cubes-badge-n' }));
    return g;
  }
  function marks() { var m = st.fig.svg.querySelector('.ex-cubes-marks'); PX.ui.clear(m); return m; }
  // The cubes with exactly N painted sides, in tally order: column by column from the back left,
  // each column from the top down (as the tally strategy goes).
  function counted(item) {
    var cubes = st.fig.cubes, rr = lib.render(item.heights), out = [];
    cubes.forEach(function (q, i) { if (q.painted === item.ask) out.push({ q: q, i: i, vis: rr.perCube[i], hidden: rr.perCube[i].any === 0 }); });
    out.sort(function (a, b) { return a.q.z - b.q.z || a.q.x - b.q.x || b.q.y - a.q.y; });
    return out;
  }
  function sidesText(q) {
    var names = [];
    q.sides.forEach(function (on, s) { if (on) names.push(SIDES[s]); });
    return names.length ? names.join(', ') : 'none';
  }

  function describe(item) {
    var n = lib.total(item.heights);
    return 'A figure of ' + plural(n, 'cube', 'cubes') + ' glued together on a ' + item.grid + ' by ' + item.grid + ' grid, at most ' +
      Math.max.apply(null, item.heights.map(function (r) { return Math.max.apply(null, r); })) + ' high, painted on every outside face except the bottom. ' +
      'How many cubes have exactly ' + plural(item.ask, 'painted side', 'painted sides') + '?';
  }

  /* ---------- view functions ---------- */

  function mount(ctx) {
    var root = h('div.ex-cubes-stem');
    var q = h('p.ex-cubes-q');
    var figure = h('div.ex-cubes-figure-box');
    var stage = h('div.ex-stage.ex-cubes-stage', figure);
    var verdict = h('div.ex-verdict.ex-cubes-verdict', { hidden: true, role: 'status' });
    var caption = h('p.ex-caption', { 'aria-live': 'polite' });
    var desc = h('p.px-sr');
    root.appendChild(stage);
    root.appendChild(q);
    root.appendChild(h('div.ex-cubes-under', caption, verdict));
    root.appendChild(desc);
    ctx.host.appendChild(root);
    st = { ctx: ctx, root: root, stage: stage, figure: figure, q: q, verdict: verdict, caption: caption, desc: desc, item: null, optItem: null, opts: [], fig: null };
  }

  function question(item) {
    PX.ui.clear(st.q);
    st.q.appendChild(document.createTextNode('How many cubes have exactly '));
    st.q.appendChild(h('b.ex-cubes-n', String(item.ask)));
    st.q.appendChild(document.createTextNode(item.ask === 1 ? ' painted side?' : ' painted sides?'));
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
    PX.ui.clear(st.figure);
    st.fig = figureSvg(item);
    st.figure.appendChild(st.fig.svg);
    question(item);
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
    var n = item.options[i];
    el.appendChild(h('span.ex-answer.ex-cubes-opt', h('span.ex-answer-text', String(n)), h('span.ex-cubes-unit', n === 1 ? 'cube' : 'cubes')));
    st.opts[i] = { el: el };
  }
  function optionLabel(item, i) { return plural(item.options[i], 'cube', 'cubes'); }
  function gridCols() { return 5; }

  /* ---------- reveal ---------- */

  // Ghosts first, then badges, so no dashed edge crosses a number.
  function markAll(item, upTo) {
    var m = marks(), list = counted(item), shown = list.filter(function (c, k) { return upTo === undefined || k < upTo; });
    shown.forEach(function (c) { if (c.hidden) m.appendChild(ghost(c.q)); });
    shown.forEach(function (c, k) { m.appendChild(badge(c.q, k + 1, c.hidden, c.vis)); });
    return list;
  }
  function reveal(item, response, result, ctx) {
    if (!st) return Promise.resolve();
    st.root.classList.add('is-revealed');
    var list = markAll(item), hid = list.filter(function (c) { return c.hidden; }).length;
    st.verdict.textContent = '✓ ' + plural(item.count, 'cube has', 'cubes have') + ' exactly ' + plural(item.ask, 'painted side', 'painted sides') +
      (hid ? ' (' + hid + ' hidden, dashed)' : '') + '.';
    st.verdict.setAttribute('data-kind', 'key');
    st.verdict.hidden = false;
    return timing.wait(ctx && ctx.fast ? 0 : 250);
  }

  /* ---------- show me: the tally, cube by cube ---------- */

  function focusOption(i) {
    st.opts.forEach(function (o, j) {
      if (!o) return;
      var b = o.el.closest ? o.el.closest('.px-choice') : null;
      if (b) b.classList.toggle('ex-focus', j === i);
    });
  }
  function steps(item, response) {
    var list = counted(item), out = [];
    out.push({ ms: 1400, caption: cap('question'), enter: function () { marks(); focusOption(-1); st.q.classList.add('is-pointed'); }, exit: function () { st.q.classList.remove('is-pointed'); } });
    list.forEach(function (c, k) {
      out.push({
        ms: c.hidden ? 2200 : 1600,
        caption: cap(c.hidden ? 'tallyHidden' : 'tally', { n: k + 1, sides: c.q.painted + ' (' + sidesText(c.q) + ')' }),
        enter: function () { markAll(item, k + 1); focusOption(-1); },
      });
    });
    out.push({ ms: 1300, caption: cap('skip'), enter: function () { markAll(item); } });
    out.push({
      ms: 1800, caption: cap('done', { k: item.count, cubes: item.count === 1 ? 'cube has' : 'cubes have', N: item.ask }),
      enter: function () { markAll(item); focusOption(item.key); },
    });
    var r = response;
    if (typeof r === 'number' && r !== item.key && r >= 0 && r < 5) {
      out.push({
        ms: 2200, caption: cap('chosen', { n: item.options[r], d: item.options[r] > item.count ? 'more than' : 'fewer than' }),
        enter: function () { markAll(item); focusOption(r); },
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
    var intro = [
      { ms: 2200, caption: cap('figure'), enter: function () { marks(); focusOption(-1); st.figure.classList.add('is-pointed'); }, exit: function () { st.figure.classList.remove('is-pointed'); } },
      { ms: 1800, caption: cap('options'), enter: function () { marks(); } },
    ];
    return play(intro.concat(steps(item, null)), ctx, { name: 'demo', caption: caption || null })
      .then(function () { if (st) focusOption(-1); });
  }

  function unmount() {
    if (!st) return;
    if (st.root.parentNode) st.root.parentNode.removeChild(st.root);
    st = null;
  }

  PX.ex.view('cubes', {
    layout: 'stem+options',
    css: true,
    mount: mount, present: present, drawOption: drawOption, optionLabel: optionLabel, gridCols: gridCols,
    reveal: reveal, showMe: showMe, demo: demo, unmount: unmount,
    steps: function (item, response) { return st ? steps(item, response) : []; },
  });
})(window.PX);
