/* EX-18 Painted Cubes: view (SVG; ARCHITECTURE.md §6, docs/dev/EXERCISE-GUIDE.md).
   layout 'stem+options': the stem is the figure, drawn from the item's height map with the
   generator's own camera (lib.proj, lib.facesOf: a parallel projection from the front right),
   faces in three tones with outlines (colour never the only cue), and the question with N in
   large type; the options are the counts 1–5.
   - Drawing order: cubes far to near (ascending x + y + z: with the viewer at +x, +y, +z a cube
     can only hide cubes that are behind it in all three directions), each cube's exposed top,
     front and right faces. Cubes carry no marks (Cube Match's format stays with the probe).
   - A cube's number is its count of painted sides (lib.cubesOf: the same neighbour tests the
     validator recounts). Badges: a number in ink; a cube counted for the question in the accent
     with a ring (shape as well as colour); '?' on a cube left to the player; hidden cubes as
     dashed ghost cubes with dashed badges.
   - v1.2 (docs/research/v1.2/D2-first-band.md §3.3, CONTRACT-v1.2 D): Try 1's first step done
     (ctx.assist = { numbers: 2 }: every cube's number but two, which show '?'); rule figures
     (drawRule: a touching face bare, a cube under another, a hidden support); show me carries out
     the "Count by position" card on the item, its captions numbered by the card's steps: the
     figure pulled apart (faces that touch another cube bare, hatched), every cube's number (on a
     flat figure 5 minus the cubes it touches), then the cubes with the number asked, one at a
     time, hidden ones included. Reveal rings the counted cubes with their number.
   - Demo (Watch): the figure, its hidden cubes as dashed ghosts when it has any, the answers,
     then show me's steps, each caption up long enough to read (readable()).
   - Try 3 (ctx.assist = { hidden: true }): the hidden support drawn dashed, without its number,
     between the worked example (dashed and numbered) and Try 4 (nothing marked); its reveal
     numbers it. */
(function (PX) {
  'use strict';

  var timing = PX.core.timing, U = PX.util, S = PX.core.svg;
  var h = PX.ui.h;
  var def = PX.ex.get('cubes'), lib = def.lib;
  var SIDES = ['top', 'front', 'right', 'back', 'left'];
  var SPREAD = 1.4; // pulled apart: cube origins 1.4 edges apart, so touching faces show in the gaps
  var st = null, uid = 0;

  function learn() { return PX.ex.learn('cubes') || {}; }
  function cap(key, vars) {
    var s = String((learn().captions || {})[key] || '');
    Object.keys(vars || {}).forEach(function (k) { s = s.split('{' + k + '}').join(String(vars[k])); });
    return s;
  }
  function plural(n, one, many) { return n + ' ' + (n === 1 ? one : many); }
  // The Watch and worked examples (v1.2, fresh-player check: at the 3-s floor a 20-word caption was
  // gone before it was read): a caption stays up for 1 s plus 0.27 s a word (about 220 words a
  // minute), at most 8 s; a step that moves keeps its pace and holds its last frame. step.read, when
  // set, is the part of the caption that is new (the tally's next cube). Show me keeps its pace: it
  // replays steps already read, with Pause and Step.
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
  function tallest(H) { var m = 0; H.forEach(function (r) { r.forEach(function (v) { if (v > m) m = v; }); }); return m; }

  /* ---------- geometry ---------- */

  function pt(P) { return lib.proj(P); }
  // Corners of a face (side 0 top, 1 front, 2 right) of the unit cube whose corner is at o.
  function faceAt(o, side) {
    var x = o[0], y = o[1], z = o[2];
    if (side === 0) return [[x, y + 1, z], [x + 1, y + 1, z], [x + 1, y + 1, z + 1], [x, y + 1, z + 1]].map(pt);
    if (side === 1) return [[x, y, z + 1], [x + 1, y, z + 1], [x + 1, y + 1, z + 1], [x, y + 1, z + 1]].map(pt);
    return [[x + 1, y, z], [x + 1, y, z + 1], [x + 1, y + 1, z + 1], [x + 1, y + 1, z]].map(pt);
  }
  function origin(q, s) { return [q.x * s, q.y * s, q.z * s]; }
  // The figure's bounds (every cube corner at spread s), padded: [x, y, w, h] for the viewBox.
  function bounds(cubes, s) {
    var b = [Infinity, Infinity, -Infinity, -Infinity];
    cubes.forEach(function (q) {
      var o = origin(q, s);
      for (var i = 0; i < 8; i++) {
        var c = pt([o[0] + (i & 1), o[1] + ((i >> 1) & 1), o[2] + ((i >> 2) & 1)]);
        b[0] = Math.min(b[0], c[0]); b[1] = Math.min(b[1], c[1]); b[2] = Math.max(b[2], c[0]); b[3] = Math.max(b[3], c[1]);
      }
    });
    var m = 0.35;
    return [b[0] - m, b[1] - m, b[2] - b[0] + 2 * m, b[3] - b[1] + 2 * m];
  }

  /* ---------- drawing ---------- */

  // A hatch for bare (unpainted) faces: light ground, dark diagonal lines (shape, not colour alone).
  function hatchDef(svg) {
    var id = 'ex-cubes-hatch-' + (++uid), w = 0.16;
    var pat = S.el('pattern', { id: id, patternUnits: 'userSpaceOnUse', width: w, height: w, patternTransform: 'rotate(45)' });
    pat.appendChild(S.el('rect', { width: w, height: w, class: 'ex-cubes-bare-bg' }));
    pat.appendChild(S.el('line', { x1: 0.04, y1: 0, x2: 0.04, y2: w, class: 'ex-cubes-bare-line' }));
    svg.appendChild(S.el('defs', null, pat));
    return id;
  }
  // The figure of height map H at spread s. s = 1: the exposed top, front and right faces (the
  // others are covered by a neighbour). s > 1 (pulled apart): every top, front and right face, a
  // face that touches another cube bare.
  function figureSvg(H, s, cls) {
    var cubes = lib.cubesOf(H), vb = bounds(cubes, s);
    var svg = S.svg(vb[2], vb[3], { viewBox: vb, class: cls || 'ex-cubes-svg', width: '100%' });
    var hatch = s > 1 ? hatchDef(svg) : null;
    var order = cubes.map(function (q, i) { return i; }).sort(function (a, b) {
      var qa = cubes[a], qb = cubes[b];
      return (qa.x + qa.y + qa.z) - (qb.x + qb.y + qb.z) || qa.y - qb.y || a - b;
    });
    var g = S.el('g', { class: 'ex-cubes-figure' });
    order.forEach(function (i) {
      var q = cubes[i], o = origin(q, s);
      for (var f = 0; f < 3; f++) {
        var bare = !q.sides[f];
        if (bare && !hatch) continue;
        g.appendChild(S.path(faceAt(o, f), true, bare ? { class: 'ex-cubes-face ex-cubes-face--bare', style: 'fill:url(#' + hatch + ')' } : { class: 'ex-cubes-face ex-cubes-face--' + SIDES[f] }));
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
  // A badge on the cube's most visible face, or at its centre when it is hidden. kind: 'number'
  // (ink), 'count' (counted for the question: the accent and a ring), 'unknown' ('?').
  function badge(c, text, kind) {
    var q = c.q, at;
    if (c.hidden) at = pt([q.x + 0.5, q.y + 0.5, q.z + 0.5]);
    else {
      var best = -1, side = 0;
      for (var s = 0; s < 3; s++) if (c.vis.faces[s] > best) { best = c.vis.faces[s]; side = s; }
      var f = faceAt([q.x, q.y, q.z], side);
      at = [(f[0][0] + f[2][0]) / 2, (f[0][1] + f[2][1]) / 2];
    }
    var g = S.el('g', { class: 'ex-cubes-badge ex-cubes-badge--' + kind + (c.hidden ? ' is-hidden' : '') });
    if (kind === 'count') g.appendChild(S.el('circle', { cx: at[0], cy: at[1], r: 0.4, class: 'ex-cubes-ring' }));
    g.appendChild(S.el('circle', { cx: at[0], cy: at[1], r: 0.3 }));
    g.appendChild(S.text(at[0], at[1] + 0.11, String(text), { class: 'ex-cubes-badge-n' }));
    return g;
  }
  function marks() { var m = st.fig.svg.querySelector('.ex-cubes-marks'); PX.ui.clear(m); return m; }

  // Every cube with what the steps need, in tally order: column by column from the back left,
  // each column from the top down (as the card goes).
  function cubeList(item) {
    if (st.list && st.listItem === item) return st.list;
    var rr = lib.render(item.heights), out = [];
    rr.cubes.forEach(function (q, i) { out.push({ q: q, i: i, vis: rr.perCube[i], hidden: rr.perCube[i].any === 0, counted: q.painted === item.ask }); });
    out.sort(function (a, b) { return a.q.z - b.q.z || a.q.x - b.q.x || b.q.y - a.q.y; });
    st.list = out; st.listItem = item;
    return out;
  }
  function counted(item) { return cubeList(item).filter(function (c) { return c.counted; }); }
  function hiddenCubes(item) { return cubeList(item).filter(function (c) { return c.hidden; }); }
  function sidesText(q) {
    var names = [];
    q.sides.forEach(function (on, s) { if (on) names.push(SIDES[s]); });
    return names.length ? names.join(', ') : 'none';
  }
  function touching(a, b) { return Math.abs(a.x - b.x) + Math.abs(a.y - b.y) + Math.abs(a.z - b.z) === 1; }

  // Numbers on the figure. opts: { counted: how many of the counted cubes (tally order) are ringed,
  // blank: [cube indices showing '?'], only: counted cubes alone, also: [cube indices shown as well
  // with only] }. Ghosts go first, so no dashed edge crosses a number.
  function numbers(item, opts) {
    var m = marks(), all = cubeList(item), k = 0, ring = {}, also = opts.also || [];
    counted(item).forEach(function (c) { if (k++ < (opts.counted || 0)) ring[c.i] = true; });
    var shown = all.filter(function (c) { return opts.only ? ring[c.i] || also.indexOf(c.i) >= 0 : true; });
    shown.forEach(function (c) { if (c.hidden) m.appendChild(ghost(c.q)); });
    shown.forEach(function (c) {
      var blank = (opts.blank || []).indexOf(c.i) >= 0;
      m.appendChild(badge(c, blank ? '?' : c.q.painted, ring[c.i] ? 'count' : blank ? 'unknown' : 'number'));
    });
  }
  // Try 1's first step done (ctx.assist = { numbers: n }): every cube's number but n. Left blank:
  // the last counted cube in tally order and a cube that touches it, so the rule has to be used once
  // on a counted cube and once on another.
  function assistBlanks(item, n) {
    var all = cubeList(item), cnt = all.filter(function (c) { return c.counted && !c.hidden; }), out = [];
    var a = cnt[cnt.length - 1];
    if (a) out.push(a.i);
    var others = all.filter(function (c) { return !c.counted && !c.hidden; });
    var b = a ? others.filter(function (c) { return touching(c.q, a.q); })[0] || others[0] : others[0];
    if (b && out.length < n) out.push(b.i);
    return out;
  }

  function describe(item) {
    var n = lib.total(item.heights);
    return 'A figure of ' + plural(n, 'cube', 'cubes') + ' glued together on a ' + item.grid + ' by ' + item.grid + ' grid, at most ' +
      tallest(item.heights) + ' high, painted on every outside face except the bottom. ' +
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
    st = { ctx: ctx, root: root, stage: stage, figure: figure, q: q, verdict: verdict, caption: caption, desc: desc, item: null, optItem: null, opts: [], fig: null, pulled: null, assist: null, assistHidden: false, list: null, listItem: null };
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
    st.root.classList.remove('is-revealed');
    PX.ui.clear(st.figure);
    st.fig = figureSvg(item.heights, 1);
    st.pulled = null;
    st.figure.appendChild(st.fig.svg);
    question(item);
    var a = ctx && ctx.assist && typeof ctx.assist === 'object' ? ctx.assist : null;
    st.assist = a && a.numbers > 0 ? assistBlanks(item, a.numbers) : null;
    st.assistHidden = !!(a && a.hidden) && !st.assist && hiddenCubes(item).length > 0;
    var what = hiddenCubes(item).length === 1 ? 'The hidden cube is' : 'The hidden cubes are';
    if (st.assist) {
      numbers(item, { blank: st.assist });
      st.caption.textContent = cap('assist');
    } else if (st.assistHidden) {
      ghostHidden(item);
      st.caption.textContent = cap('assistHidden', { what: what });
    }
    st.desc.textContent = describe(item) + (st.assist ? ' Every cube but ' + st.assist.length + ' shows its number of painted sides.' : '') +
      (st.assistHidden ? ' ' + cap('assistHidden', { what: what }) : '');
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

  /* ---------- rule figures (the rules card; CONTRACT-v1.2 D) ---------- */

  // touch: two cubes side by side, pulled apart, the faces that touched bare; under: two stacked,
  // the lower top bare; hidden: a column of two whose lower cube is hidden by a cube in front and
  // one to its right, drawn as a dashed ghost.
  // (Height maps are square, H[z][x]; the rule figures spread wider than show me's, 1.6, so the bare
  // face shows well at 72–96 px.)
  var RULES = { touch: { H: [[1, 1], [0, 0]], s: 1.6 }, under: { H: [[2]], s: 1.6 }, hidden: { H: [[2, 1], [1, 0]], s: 1, ghosts: true } };
  function drawRule(el, fig) {
    var r = RULES[fig];
    if (!r || !el) return;
    var f = figureSvg(r.H, r.s, 'ex-cubes-rule-svg');
    if (r.ghosts) {
      var rr = lib.render(r.H), m = f.svg.querySelector('.ex-cubes-marks');
      rr.cubes.forEach(function (q, i) { if (rr.perCube[i].any === 0) m.appendChild(ghost(q)); });
    }
    el.appendChild(h('div.ex-cubes.ex-cubes-rulefig', f.svg));
  }

  /* ---------- reveal ---------- */

  function reveal(item, response, result, ctx) {
    if (!st) return Promise.resolve();
    st.root.classList.add('is-revealed');
    var list = counted(item), hid = list.filter(function (c) { return c.hidden; }).length;
    // After Try 1 every number shows (the two left blank filled in); otherwise the counted cubes,
    // and after Try 3 the hidden cube that was drawn for the player too, with its number.
    numbers(item, { counted: list.length, only: !st.assist, also: st.assistHidden ? hiddenCubes(item).map(function (c) { return c.i; }) : null });
    // One line at 360 px, in the room the stem keeps for it from the start (the answers never move);
    // the help caption of a Try item gives way to it.
    st.caption.textContent = '';
    st.verdict.textContent = '✓ ' + plural(item.count, 'cube', 'cubes') + ' with ' + plural(item.ask, 'painted side', 'painted sides') +
      (hid ? ', ' + hid + ' hidden' : '') + '.';
    st.verdict.setAttribute('data-kind', 'key');
    st.verdict.hidden = false;
    return timing.wait(ctx && ctx.fast ? 0 : 250);
  }

  /* ---------- show me: the "Count by position" card, step by step ---------- */

  function focusOption(i) {
    st.opts.forEach(function (o, j) {
      if (!o) return;
      var b = o.el.closest ? o.el.closest('.px-choice') : null;
      if (b) b.classList.toggle('ex-focus', j === i);
    });
  }
  // The figure in the stem: normal, or pulled apart (the same cubes, spread out).
  function normal() {
    if (st.pulled && st.pulled.svg.parentNode) { st.figure.replaceChild(st.fig.svg, st.pulled.svg); }
    st.figure.classList.remove('is-pulled');
  }
  function pulledApart(item) {
    if (!st.pulled) st.pulled = figureSvg(item.heights, SPREAD);
    if (st.fig.svg.parentNode) st.figure.replaceChild(st.pulled.svg, st.fig.svg);
    st.figure.classList.add('is-pulled');
  }
  function steps(item, response) {
    var list = counted(item), k = list.length, N = item.ask, flat = tallest(item.heights) === 1, out = [];
    out.push({ ms: 1500, caption: cap('question'), enter: function () { normal(); marks(); focusOption(-1); st.q.classList.add('is-pointed'); }, exit: function () { st.q.classList.remove('is-pointed'); } });
    out.push({ ms: 2800, caption: cap('explode'), enter: function () { marks(); focusOption(-1); pulledApart(item); }, exit: normal });
    out.push({ ms: 2600, caption: cap(flat ? 'numbersFlat' : 'numbers'), enter: function () { normal(); numbers(item, {}); focusOption(-1); } });
    list.forEach(function (c, j) {
      var sides = plural(c.q.painted, 'painted side', 'painted sides') + ' (' + sidesText(c.q) + ')';
      out.push({
        ms: c.hidden ? 2200 : 1600,
        caption: cap(c.hidden ? 'tallyHidden' : 'tally', { n: j + 1, k: k, N: N, sides: sides }),
        read: j > 0 && !c.hidden ? 'cube ' + (j + 1) + ' of ' + k + ', ' + sides : null,
        enter: function () { normal(); numbers(item, { counted: j + 1 }); focusOption(-1); },
      });
    });
    out.push({
      ms: 1800, caption: cap('done', { k: item.count, cubes: item.count === 1 ? 'cube has' : 'cubes have', sides: plural(item.ask, 'painted side', 'painted sides') }),
      enter: function () { normal(); numbers(item, { counted: k }); focusOption(item.key); },
    });
    var r = response;
    if (typeof r === 'number' && r !== item.key && r >= 0 && r < 5) {
      out.push({
        ms: 2200, caption: cap('chosen', { n: item.options[r], d: item.options[r] > item.count ? 'more than' : 'fewer than' }),
        enter: function () { normal(); numbers(item, { counted: k }); focusOption(r); },
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
  // After show me or a demo the last caption goes, so the stem returns to the room it keeps.
  function done() { if (st) { normal(); focusOption(-1); st.caption.textContent = ''; } }
  function showMe(item, response, ctx) {
    if (!st || st.item !== item) return Promise.resolve();
    return play(steps(item, response), ctx, { name: 'show-me' }).then(done, done);
  }
  // The cubes nothing of which shows (supports under taller columns), as dashed ghosts.
  function ghostHidden(item) {
    var m = marks(), n = 0;
    cubeList(item).forEach(function (c) { if (c.hidden) { m.appendChild(ghost(c.q)); n++; } });
    return n;
  }
  function demo(item, ctx, caption) {
    if (!st || st.item !== item) return Promise.resolve();
    var hid = cubeList(item).filter(function (c) { return c.hidden; }).length;
    var intro = [
      { ms: 2200, caption: cap('figure'), enter: function () { normal(); marks(); focusOption(-1); st.figure.classList.add('is-pointed'); }, exit: function () { st.figure.classList.remove('is-pointed'); } },
    ];
    if (hid) {
      intro.push({
        ms: 2600, caption: cap('hidden', { what: hid === 1 ? 'The dashed cube is' : 'The dashed cubes are', where: hid === 1 ? 'under the cube above it' : 'under the cubes above them' }),
        enter: function () { normal(); ghostHidden(item); focusOption(-1); }, exit: function () { marks(); },
      });
    }
    intro.push({ ms: 1800, caption: cap('options'), enter: function () { normal(); marks(); } });
    return play(readable(intro.concat(steps(item, null))), ctx, { name: 'demo', caption: caption || null }).then(done, done);
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
    reveal: reveal, showMe: showMe, demo: demo, unmount: unmount, drawRule: drawRule,
    steps: function (item, response) { return st ? steps(item, response) : []; },
  });
})(window.PX);
