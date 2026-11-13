/* EX-13 Knots: view (SVG; ARCHITECTURE.md §6, docs/dev/EXERCISE-GUIDE.md §5).
   layout 'stem+options': the stem is one 320 × 320 plate. The rope is drawn from the item's own
   spline as exact Bézier pieces; at every crossing the strand on top is drawn again over a casing
   in the plate's colour, which opens the gap in the strand underneath (the knot-diagram
   convention: shape, never colour alone). Open ropes run off the plate with a pull arrow at each
   end; link items show loop B in a second tone and a thicker stroke. Untie/tie items carry
   letter tags A–D beside four crossings; tapping a tag answers through the choice grid.
   - Show me replays the validator's simplifier on the drawn rope (def.lib.replay): each move is
     a local morph (a curl shrinks into its crossing; a loop slides off past the other strand; a
     strand slides over a crossing), redrawn every frame with the casings re-derived from the
     moving rope. Untie/tie first switch the key crossing; links stop when no crossing joins them.
   - Colours come from CSS tokens (css/ex/knots.css), so a theme change needs no redraw. */
(function (PX) {
  'use strict';

  var timing = PX.core.timing, U = PX.util, S = PX.core.svg, h = PX.ui.h;
  var def = PX.ex.get('knots'), lib = def.lib;
  var P = lib.PLATE, NS = 'http://www.w3.org/2000/svg';
  var st = null;                                  // the mounted view's state
  var LETTERS = ['A', 'B', 'C', 'D'];
  var TAG_R = 14;                                 // tag circles: 28 px across on a 320 px plate

  function learn() { return PX.ex.learn('knots') || {}; }
  function cap(key, vars) {
    var s = String((learn().captions || {})[key] || '');
    Object.keys(vars || {}).forEach(function (k) { s = s.split('{' + k + '}').join(String(vars[k])); });
    return s;
  }
  function el(tag, attrs) { return S.el(tag, attrs || {}); }
  function f1(x) { return Math.round(x * 10) / 10; }

  /* ---------- drawing ---------- */

  function bezierPath(cv) {
    var B = lib.bezier(cv), d = '';
    for (var i = 0; i < B.length; i++) {
      var b = B[i];
      if (i === 0) d += 'M' + f1(b[0]) + ' ' + f1(b[1]);
      d += 'C' + f1(b[2]) + ' ' + f1(b[3]) + ' ' + f1(b[4]) + ' ' + f1(b[5]) + ' ' + f1(b[6]) + ' ' + f1(b[7]);
    }
    return cv.closed ? d + 'Z' : d;
  }
  function polyPath(xs, ys, closed, from, to) {
    var d = '', m = xs.length, a = from === undefined ? 0 : from, b = to === undefined ? m - 1 : to;
    for (var i = a; i <= b; i++) {
      var k = closed ? ((i % m) + m) % m : Math.max(0, Math.min(m - 1, i));
      d += (i === a ? 'M' : 'L') + f1(xs[k]) + ' ' + f1(ys[k]);
    }
    return closed && from === undefined ? d + 'Z' : d;
  }
  // The strand on top at a crossing, drawn again over its casing (±5 samples, about 15–20 px).
  function overPiece(g, xs, ys, closed, seg, cls) {
    var d = polyPath(xs, ys, closed, seg - 4, seg + 5);
    g.appendChild(el('path', { d: d, class: 'ex-knots-casing' }));
    g.appendChild(el('path', { d: d, class: 'ex-knots-rope ' + (cls || '') }));
  }
  function ropeClass(k, n) { return n > 1 && k === 1 ? 'ex-knots-rope--b' : ''; }

  // The item as drawn: Bézier ropes, then each crossing's top strand over its casing.
  function drawItem(g, curves, over, opts) {
    var dg = lib.diagramOf(curves, over);
    if (typeof dg === 'string') return null;
    curves.forEach(function (cv, k) {
      g.appendChild(el('path', { d: bezierPath(cv), class: 'ex-knots-rope ' + ropeClass(k, curves.length) }));
    });
    dg.X.forEach(function (x, c) {
      var top = over[c] ? { k: x.a[0], seg: x.sa } : { k: x.b[0], seg: x.sb }, s = dg.S[top.k];
      overPiece(g, s.x, s.y, s.closed, top.seg, ropeClass(top.k, curves.length));
    });
    if (!opts || opts.arrows !== false) curves.forEach(function (cv, k) { if (!cv.closed) arrows(g, dg.S[k]); });
    return dg;
  }
  // A frame of show me: polylines with heights (lib.replay); crossings and over/under re-derived.
  // asB: the polylines are loop B alone (the lift at the end of an "apart" show me).
  function drawPolys(g, polys, asB) {
    var pc, isB = function (k) { return asB || (polys.length > 1 && k === 1); };
    try { pc = lib.polyCrossings(polys); } catch (e) { pc = { list: [] }; }
    polys.forEach(function (Q, k) {
      g.appendChild(el('path', { d: polyPath(Q.x, Q.y, Q.closed), class: 'ex-knots-rope ' + (isB(k) ? 'ex-knots-rope--b' : '') }));
    });
    pc.list.map(function (x) { return x; }).sort(function (a, b) { return Math.max(a.za, a.zb) - Math.max(b.za, b.zb); }).forEach(function (x) {
      var top = x.za > x.zb ? { k: x.a[0], seg: x.sa } : { k: x.b[0], seg: x.sb }, Q = polys[top.k];
      overPiece(g, Q.x, Q.y, Q.closed, top.seg, isB(top.k) ? 'ex-knots-rope--b' : '');
    });
    polys.forEach(function (Q) { if (!Q.closed) arrows(g, { x: Q.x, y: Q.y, m: Q.x.length }); });
    return pc;
  }
  // Pull arrows where an open rope leaves the plate, pointing out.
  function arrows(g, s) {
    function inside(i) { return s.x[i] >= 6 && s.x[i] <= P - 6 && s.y[i] >= 6 && s.y[i] <= P - 6; }
    var first = -1, last = -1;
    for (var i = 0; i < s.m; i++) if (inside(i)) { if (first < 0) first = i; last = i; }
    if (first < 1 || last < 0) return;
    [[first, -1], [last, 1]].forEach(function (e) {
      var i = e[0], j = Math.max(0, Math.min(s.m - 1, i + 3 * e[1])), dx = s.x[j] - s.x[i], dy = s.y[j] - s.y[i], l = Math.sqrt(dx * dx + dy * dy) || 1;
      var ux = dx / l, uy = dy / l, tx = s.x[i] + ux * 2, ty = s.y[i] + uy * 2, px = -uy, py = ux;
      var tip = [tx + ux * 9, ty + uy * 9], a1 = [tx + px * 6, ty + py * 6], a2 = [tx - px * 6, ty - py * 6];
      g.appendChild(el('path', { d: 'M' + f1(a1[0]) + ' ' + f1(a1[1]) + 'L' + f1(tip[0]) + ' ' + f1(tip[1]) + 'L' + f1(a2[0]) + ' ' + f1(a2[1]), class: 'ex-knots-arrow' }));
    });
  }
  function ring(g, x, y, cls) { g.appendChild(el('circle', { cx: f1(x), cy: f1(y), r: 17, class: 'ex-knots-ring ' + (cls || '') })); }

  // Tag positions: 24–30 px from the crossing in the free direction farthest from every strand.
  function tagSpots(dg, tags) {
    var pts = [];
    dg.S.forEach(function (s) { for (var i = 0; i < s.m; i += 2) pts.push([s.x[i], s.y[i]]); });
    var placed = [];
    return tags.map(function (c) {
      var X = dg.X[c], best = null;
      for (var a = 0; a < 16; a++) {
        for (var rr = 26; rr <= 34; rr += 4) {
          var ang = Math.PI * 2 * a / 16, cx = X.x + rr * Math.cos(ang), cy = X.y + rr * Math.sin(ang);
          if (cx < TAG_R + 2 || cy < TAG_R + 2 || cx > P - TAG_R - 2 || cy > P - TAG_R - 2) continue;
          var clear = Infinity;
          for (var i = 0; i < pts.length; i++) { var dx = pts[i][0] - cx, dy = pts[i][1] - cy; clear = Math.min(clear, dx * dx + dy * dy); }
          for (var j = 0; j < placed.length; j++) { var ex = placed[j][0] - cx, ey = placed[j][1] - cy; clear = Math.min(clear, (ex * ex + ey * ey) / 4); }
          var score = Math.sqrt(clear) - 0.15 * rr;
          if (!best || score > best.score) best = { score: score, x: cx, y: cy };
        }
      }
      placed.push([best.x, best.y]);
      return { x: best.x, y: best.y, cx: X.x, cy: X.y };
    });
  }
  function drawTags(g, item, dg) {
    var spots = tagSpots(dg, item.tags), out = [];
    spots.forEach(function (sp, i) {
      var dx = sp.x - sp.cx, dy = sp.y - sp.cy, l = Math.sqrt(dx * dx + dy * dy) || 1;
      var t = el('g', { class: 'ex-knots-tag', 'data-tag': String(i) });
      t.appendChild(el('circle', { cx: f1(sp.x), cy: f1(sp.y), r: 21, class: 'ex-knots-taghit' }));
      t.appendChild(el('line', { x1: f1(sp.cx + dx / l * 9), y1: f1(sp.cy + dy / l * 9), x2: f1(sp.x - dx / l * TAG_R), y2: f1(sp.y - dy / l * TAG_R), class: 'ex-knots-leader' }));
      t.appendChild(el('circle', { cx: f1(sp.x), cy: f1(sp.y), r: TAG_R, class: 'ex-knots-tagdisc' }));
      var tx = el('text', { x: f1(sp.x), y: f1(sp.y + 5), 'text-anchor': 'middle', class: 'ex-knots-tagtext' });
      tx.textContent = LETTERS[i];
      t.appendChild(tx);
      g.appendChild(t);
      out.push({ g: t, x: sp.x, y: sp.y, cx: sp.cx, cy: sp.cy });
    });
    return out;
  }

  /* ---------- the stem ---------- */

  function mount(ctx) {
    var svg = S.svg(P, P, { viewBox: [0, 0, P, P], class: 'ex-knots-svg', width: '100%', 'aria-hidden': 'true' });
    var ropeG = el('g', { class: 'ex-knots-layer' }), markG = el('g', { class: 'ex-knots-marks' }), tagG = el('g', { class: 'ex-knots-tags' });
    svg.appendChild(ropeG); svg.appendChild(markG); svg.appendChild(tagG);
    var stage = h('div.ex-stage.ex-knots-stage', svg);
    var verdict = h('div.ex-verdict.ex-knots-verdict', { hidden: true, role: 'status' });
    var caption = h('p.ex-caption', { 'aria-live': 'polite' });
    var desc = h('p.px-sr');
    var root = h('div.ex-knots-stem', stage, h('div.ex-knots-under', caption, verdict), desc);
    ctx.host.appendChild(root);
    st = { ctx: ctx, root: root, stage: stage, svg: svg, ropeG: ropeG, markG: markG, tagG: tagG, verdict: verdict, caption: caption,
      desc: desc, item: null, optItem: null, opts: [], tags: [], dg: null, replays: {} };
    // a tap on a tag answers through the grid (the same respond path as its button)
    tagG.addEventListener('click', function (e) {
      var t = e.target && e.target.closest ? e.target.closest('.ex-knots-tag') : null;
      if (!t || !st) return;
      var o = st.opts[+t.getAttribute('data-tag')], btn = o && o.el && o.el.closest ? o.el.closest('button') : null;
      if (btn && !btn.disabled) btn.click();
    });
  }
  function clearG(g) { while (g.firstChild) g.removeChild(g.firstChild); }
  function curvesOf(item) { return lib.curvesOf(item); }

  function describe(item) {
    var n = item.n + ' crossings';
    if (item.variant === 'link') return 'Two closed loops cross each other ' + item.inter + ' times and loop B crosses itself ' + (item.n - item.inter) + ' times. Are they linked, or could they be pulled apart?';
    var base = 'A rope with ' + n + '; both ends run off the plate and are pulled apart. At each crossing a gap shows which strand is underneath.';
    if (item.variant === 'pull') return base + ' Does a knot remain?';
    return base + ' Four crossings are marked A to D. Which one, switched, ' + (item.variant === 'untie' ? 'lets the rope fall open?' : 'ties a knot?');
  }

  function drawStill(item) {
    clearG(st.ropeG); clearG(st.markG); clearG(st.tagG);
    st.dg = drawItem(st.ropeG, curvesOf(item), item.over);
    st.tags = item.tags && st.dg ? drawTags(st.tagG, item, st.dg) : [];
    st.tagG.style.display = '';
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
    drawStill(item);
    return timing.nextPaint();
  }

  // drawOption runs in the ready phase, before present: the first call for a new item resets
  // the per-item option state.
  function newItem(item) {
    if (st.optItem === item) return;
    st.optItem = item;
    st.opts = [];
  }
  var GLYPHS = {
    knot: 'M4 14c4 0 6-10 12-10s5 9 0 10-8-6-2-9 10 1 12 9 6 0 6 0',
    open: 'M2 10h36',
    linked: 'M6 10a6 6 0 1 0 12 0a6 6 0 1 0-12 0M16 10a6 6 0 1 0 12 0a6 6 0 1 0-12 0',
    apart: 'M2 10a6 6 0 1 0 12 0a6 6 0 1 0-12 0M24 10a6 6 0 1 0 12 0a6 6 0 1 0-12 0',
  };
  function glyph(kind) {
    var svg = S.svg(40, 20, { width: 40, height: 20, class: 'ex-glyph ex-knots-glyph', 'aria-hidden': 'true' });
    svg.appendChild(el('path', { d: GLYPHS[kind], class: 'ex-glyph-a' }));
    return svg;
  }
  function answerWords(item, i) {
    if (item.variant === 'pull') return i === 0 ? ['knot', 'Knot'] : ['open', 'No knot'];
    return i === 0 ? ['linked', 'Linked'] : ['apart', 'Apart'];
  }
  function drawOption(el2, item, i, ctx) {
    if (!st) mount(ctx);
    newItem(item);
    var tag = h('span.ex-tag', { hidden: true });
    if (item.answer === 'yesno') {
      var w = answerWords(item, i);
      el2.appendChild(h('span.ex-answer.ex-knots-answer', glyph(w[0]), h('span.ex-answer-text', w[1]), tag));
    } else {
      el2.appendChild(h('span.ex-answer.ex-knots-letter', h('span.ex-knots-letter-text', LETTERS[i]), tag));
    }
    st.opts[i] = { el: el2, tag: tag };
  }
  function optionLabel(item, i) {
    if (item.answer === 'yesno') return item.variant === 'pull' ? (i === 0 ? 'A knot remains' : 'No knot: it falls open') : (i === 0 ? 'Linked' : 'They come apart');
    return 'Crossing ' + LETTERS[i];
  }
  function gridCols(item) { return item.answer === 'yesno' ? 2 : 4; }

  /* ---------- reveal: the truth in place, ≤ 700 ms ---------- */

  function reveal(item, response, result, ctx) {
    if (!st) return Promise.resolve();
    st.root.classList.add('is-revealed');
    var text;
    if (item.variant === 'pull') text = item.key ? '✓ Knot: it stays tied' : '✓ No knot: it falls open';
    else if (item.variant === 'link') text = item.key ? '✓ Linked: they cannot come apart' : '✓ Apart: they slide off each other';
    else {
      text = '✓ ' + LETTERS[item.key] + (item.variant === 'untie' ? ' unties it' : ' ties a knot');
      st.tags.forEach(function (t, i) {
        t.g.classList.toggle('is-key', i === item.key);
        t.g.classList.toggle('is-chosen', i === response && i !== item.key);
      });
      var k = st.tags[item.key];
      if (k) ring(st.markG, k.cx, k.cy, 'is-key');
    }
    st.verdict.textContent = text;
    st.verdict.setAttribute('data-kind', 'key');
    st.verdict.hidden = false;
    return timing.wait(ctx && ctx.fast ? 0 : 250);
  }

  /* ---------- show me: the simplifier, replayed on the drawn rope ---------- */

  function ease(k) { return k * k * (3 - 2 * k); }
  function frame(polys, rings) {
    clearG(st.ropeG); clearG(st.markG);
    st.tagG.style.display = 'none';
    var pc = drawPolys(st.ropeG, polys);
    (rings || []).forEach(function (r) { ring(st.markG, r[0], r[1]); });
    return pc;
  }
  // No crossing joins the loops any more: lift loop B above loop A (a casing along all of it) and
  // carry it away from A's centre, 70 px at the end.
  function centre(Q) { var x = 0, y = 0; for (var i = 0; i < Q.x.length; i++) { x += Q.x[i]; y += Q.y[i]; } return [x / Q.x.length, y / Q.y.length]; }
  function liftFrame(polys, k) {
    clearG(st.ropeG); clearG(st.markG);
    st.tagG.style.display = 'none';
    var A = polys[0], B = polys[1], ca = centre(A), cb = centre(B), dx = cb[0] - ca[0], dy = cb[1] - ca[1], l = Math.sqrt(dx * dx + dy * dy);
    if (l < 8) { dx = 0; dy = -1; l = 1; }
    var off = 70 * ease(k), gA = el('g'), gB = el('g', { class: 'ex-knots-lifted', transform: 'translate(' + f1(dx / l * off) + ' ' + f1(dy / l * off) + ')' });
    drawPolys(gA, [A]);
    gB.appendChild(el('path', { d: polyPath(B.x, B.y, true), class: 'ex-knots-casing' }));
    drawPolys(gB, [B], true);
    st.ropeG.appendChild(gA);
    st.ropeG.appendChild(gB);
  }
  // tags: keep the letters A–D in view (the same outline, so their places still fit)
  function still(curves, over, rings, tags) {
    clearG(st.ropeG); clearG(st.markG);
    st.tagG.style.display = tags ? '' : 'none';
    drawItem(st.ropeG, curves, over);
    (rings || []).forEach(function (r) { ring(st.markG, r[0], r[1]); });
  }
  // Replays are cached per item and flags (they take a few ms, never during a stimulus).
  function replayOf(item, over, split) {
    var key = item.seed + '|' + over.map(function (b) { return b ? 1 : 0; }).join('') + '|' + (split ? 1 : 0);
    if (!st.replays[key]) st.replays[key] = lib.replay(curvesOf(item), over, { split: split }) || { steps: [], polys: [], end: { list: [], D: { live: 0 } }, broken: 'no replay', reached: false };
    return st.replays[key];
  }
  function moveCaption(s) {
    if (s.t === 'R1') return cap('curl');
    if (s.t === 'R2') return cap(s.edit.path.length && s.edit.path[s.edit.path.length >> 1][2] < 0 ? 'slideUnder' : 'slide');
    return cap('over');
  }
  function moveSteps(R) {
    return R.steps.map(function (s) {
      return {
        ms: s.t === 'R3' ? 1800 : 1400, caption: moveCaption(s),
        enter: function () { frame(s.before, s.at); },
        update: function (k) { frame(lib.morph(s, ease(k)), k < 0.6 ? s.at : []); },
        exit: function () { frame(s.after, []); },
      };
    });
  }
  // Is what is left reduced and alternating all the way round (then the caption may say so:
  // the reduced-alternating theorem)?
  function alternatingCore(R) {
    var D = R.end.D;
    if (!D.live || !R.end.comps || R.end.comps.length !== 1) return false;
    var cp = R.end.comps[0];
    for (var i = 0; i < cp.length; i++) if (cp[i].over === cp[(i + 1) % cp.length].over) return false;
    return lib.nugatory(D).every(function (x) { return !x; });
  }
  function endRings(R, interOnly) {
    return R.end.list.filter(function (x) { return !interOnly || x.a[0] !== x.b[0]; }).map(function (x) { return [x.x, x.y]; });
  }
  function times(n) { return n === 1 ? 'once' : n === 2 ? 'twice' : n + ' times'; }

  function showSteps(item, response) {
    var curves = curvesOf(item), out = [];
    if (item.variant === 'pull' || item.variant === 'link') {
      var apart = !item.key, link = item.variant === 'link', R = replayOf(item, item.over, link && apart);
      out.push({ ms: 900, caption: '', enter: function () { still(curves, item.over); } });
      out = out.concat(moveSteps(R));
      out.push({
        ms: 2200,
        caption: apart ? (R.reached ? cap(link ? 'apart' : 'none') : cap('broken', { end: link ? 'apart' : 'with no knot' }))
          : link ? (lib.linking(R.end.D) ? cap('linked', { lk: times(Math.abs(lib.linking(R.end.D))) }) : cap('linkedZero'))
            : cap(alternatingCore(R) ? 'knot' : 'knotCore'),
        enter: function () { frame(R.polys, apart ? [] : endRings(R, link)); },
        update: link && apart && R.reached && R.polys.length === 2 ? function (k) { liftFrame(R.polys, k); } : null,
      });
      return out;
    }
    // untie / tie: switch the key crossing, then let the rope go
    var c = item.tags[item.key], o2 = item.over.slice(), dg = lib.diagramOf(curves, item.over), X = dg.X[c];
    o2[c] = !o2[c];
    var R2 = replayOf(item, o2, false), untie = item.variant === 'untie', shown = false;
    out.push({
      ms: 1600, caption: cap('switchKey', { tag: LETTERS[item.key] }),
      enter: function () { shown = false; still(curves, item.over, [[X.x, X.y]], true); },
      update: function (k) { if (k >= 0.55 && !shown) { shown = true; still(curves, o2, [[X.x, X.y]], true); } },
    });
    out = out.concat(moveSteps(R2));
    out.push({
      ms: 2200,
      caption: untie ? (R2.reached ? cap('unties', { tag: LETTERS[item.key] }) : cap('broken', { end: 'falls open' })) : cap('ties', { tag: LETTERS[item.key] }),
      enter: function () { frame(R2.polys, untie ? [] : endRings(R2)); },
    });
    if (Number.isInteger(response) && response !== item.key && response >= 0 && response < 4) {
      var c2 = item.tags[response], o3 = item.over.slice(), X2 = dg.X[c2];
      o3[c2] = !o3[c2];
      out.push({
        ms: 2400, caption: cap('stays', { tag: LETTERS[response], what: untie ? 'still holds a knot' : 'still falls open' }),
        enter: function () { still(curves, o3, [[X2.x, X2.y]], true); },
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
    return play(showSteps(item, response), ctx, { name: 'show-me' });
  }

  // Tutorial (R2 §7.5): the gap; for a knot, the minimal pair (the same outline with one crossing
  // switched falls open); the three moves in words; then the item's own solution.
  function demo(item, ctx, caption) {
    if (!st || st.item !== item) return Promise.resolve();
    var curves = curvesOf(item), dg = lib.diagramOf(curves, item.over), steps = [], X0 = dg.X[0];
    steps.push({ ms: 2200, caption: cap('gap'), enter: function () { drawStill(item); ring(st.markG, X0.x, X0.y); } });
    if (item.variant === 'pull' && item.key) {
      for (var c = 0; c < dg.X.length; c++) {
        var o2 = item.over.slice();
        o2[c] = !o2[c];
        var cl = lib.classify(lib.switched(dg.D, c));
        if (cl.knot) continue;
        var R = replayOf(item, o2, false);
        if (!R.reached) continue;
        var Xc = dg.X[c];
        steps.push({ ms: 2600, caption: cap('pair'), enter: (function (ov, x) { return function () { still(curves, ov, [[x.x, x.y]]); }; })(o2, Xc) });
        steps = steps.concat(moveSteps(R));
        steps.push({ ms: 1600, caption: cap('none'), enter: (function (RR) { return function () { frame(RR.polys, []); }; })(R) });
        break;
      }
    }
    if (item.variant === 'untie' || item.variant === 'tie') steps.push({ ms: 2000, caption: cap('tagsIntro'), enter: function () { drawStill(item); } });
    if (item.variant === 'link') steps.push({ ms: 2000, caption: cap('loopsIntro'), enter: function () { drawStill(item); } });
    steps.push({ ms: 2600, caption: cap('moves'), enter: function () { drawStill(item); } });
    // then the item as it was, to answer
    return play(steps.concat(showSteps(item, null)), ctx, { name: 'demo', caption: caption || null })
      .then(function () { if (st && st.item === item) drawStill(item); });
  }

  function unmount() {
    if (!st) return;
    if (st.root.parentNode) st.root.parentNode.removeChild(st.root);
    st = null;
  }

  PX.ex.view('knots', {
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
    // for tests: the steps show me would play (from the validator's own simplifier)
    steps: function (item, response) { return st ? showSteps(item, response) : []; },
  });
})(window.PX);
