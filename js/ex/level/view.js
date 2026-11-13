/* PR-5 Level: view (SVG; ARCHITECTURE.md §6, docs/dev/EXERCISE-GUIDE.md).
   layout 'stem+options': the stem shows the container upright (how much water, or how the weight
   hangs from its pin) and then tilted and empty; each option shows the tilted container with one
   candidate line (water: the surface, with the water below it; plumb: the string and its weight).
   - Everything is drawn from the item: outline, anchor, each option's segment p and bob are page
     coordinates (x right, y up) that validate() re-measures; SVG y = −page y.
   - Option pictures are upright on the page: the page (and the picture's own edges) is the true
     reference, as in the paper task; only the container is tilted.
   - Show me (for development; the Spatial Check gives no feedback) draws the true level (water) or
     the true vertical (plumb) as a dashed guide through the anchor in every picture, then points at
     the picture whose line lies on it.
   - The item's time limit runs as a calm bar under the stem (CSS; paused with [data-paused] or the
     harness pause; stopped at reveal). */
(function (PX) {
  'use strict';

  var timing = PX.core.timing, S = PX.core.svg, h = PX.ui.h, U = PX.util;
  var def = PX.ex.get('level'), lib = def.lib;
  var st = null;

  // Half-size of a picture box for this item: the container's farthest point, upright or tilted, plus
  // its stroke (the frame's mitred corner) and a hair. The drawing then fills its picture: at the
  // hardest gap a foil is 4° off, which moves the weight only a few pixels on a phone.
  function boxHalf(item) {
    var e = 0;
    item.outline.concat(lib.outlineOf(item.task, 0)).forEach(function (p) { e = Math.max(e, Math.abs(p[0]), Math.abs(p[1])); });
    return e + (item.task === 'water' ? 0.08 : 0.13);
  }

  function learn() { return PX.ex.learn('level') || {}; }
  function cap(key, a) { return String((learn().captions || {})[key] || '').replace('{a}', a === undefined ? '' : a); }

  function P(p) { return [p[0], -p[1]]; }          // page → SVG
  function pts(list) { return list.map(P); }

  // The part of polygon `poly` (page coordinates) on the lower side of the line through a with direction d.
  function below(poly, a, d) {
    var n = [-d[1], d[0]];
    if (n[1] > 0) n = [-n[0], -n[1]];                  // the normal pointing down the page
    var side = function (p) { return (p[0] - a[0]) * n[0] + (p[1] - a[1]) * n[1]; };
    var out = [];
    for (var i = 0; i < poly.length; i++) {
      var c = poly[i], e = poly[(i + 1) % poly.length], sc = side(c), se = side(e);
      if (sc >= 0) out.push(c);
      if ((sc >= 0) !== (se >= 0)) { var t = sc / (sc - se); out.push([c[0] + t * (e[0] - c[0]), c[1] + t * (e[1] - c[1])]); }
    }
    return out;
  }

  // One picture: the container, and the option's line when o is given. guide: draw the true direction.
  function picture(item, o, guide) {
    var R = boxHalf(item), svg = S.svg(2 * R, 2 * R, { class: 'lv-svg', viewBox: [-R, -R, 2 * R, 2 * R].join(' '), 'aria-hidden': 'true', focusable: 'false' });
    var water = item.task === 'water';
    if (o && water) {
      var a = o.p[0], b = o.p[1], wet = below(item.outline, a, [b[0] - a[0], b[1] - a[1]]);
      if (wet.length > 2) svg.appendChild(S.path(pts(wet), true, { class: 'lv-water' }));
    }
    svg.appendChild(S.path(pts(item.outline), true, { class: water ? 'lv-glass' : 'lv-frame' }));
    if (guide) {
      var A = item.anchor, L = 1.6;
      var g = water ? [[A[0] - L, A[1]], [A[0] + L, A[1]]] : [[A[0], A[1]], [A[0], A[1] - L]];
      svg.appendChild(S.path(pts(g), false, { class: 'lv-guide' }));
    }
    if (o) {
      svg.appendChild(S.path(pts(o.p), false, { class: water ? 'lv-line' : 'lv-string' }));
      if (!water) {
        svg.appendChild(S.el('circle', { cx: o.p[1][0], cy: -o.p[1][1], r: item.bob, class: 'lv-bob' }));
      }
    }
    if (!water) svg.appendChild(S.el('circle', { cx: item.anchor[0], cy: -item.anchor[1], r: 0.045, class: 'lv-pin' }));
    return svg;
  }

  // The stem: the container upright with its contents, an arrow, the same container tilted and empty.
  // The labels sit in a strip above both figure boxes and the arrow between the figures' real
  // extents, so neither touches the other figure; both figure boxes are the options' picture box.
  var GAP = 0.9, TOP = 0.4;
  function stemPicture(item) {
    var R = boxHalf(item), water = item.task === 'water', W = 2 * R, VW = 2 * W + GAP;
    var svg = S.svg(VW, W + TOP, { class: 'lv-stem-svg', viewBox: [0, -R - TOP, VW, W + TOP].join(' '), 'aria-hidden': 'true', focusable: 'false' });
    var up = lib.outlineOf(item.task, 0), ax = R, bx = W + GAP + R, rad = item.tilt * Math.PI / 180;
    // the anchor in the container's own frame (turn the page anchor back by the tilt)
    var c = Math.cos(-rad), s = Math.sin(-rad), loc = [item.anchor[0] * c - item.anchor[1] * s, item.anchor[0] * s + item.anchor[1] * c];
    var shift = function (list, dx) { return list.map(function (p) { return [p[0] + dx, -p[1]]; }); };
    var g1 = S.el('g', { class: 'lv-upright' });
    if (water) {
      var wet = below(up, loc, [1, 0]);
      g1.appendChild(S.path(shift(wet, ax), true, { class: 'lv-water' }));
      g1.appendChild(S.path(shift(up, ax), true, { class: 'lv-glass' }));
      var G = lib.GLASS, half = G.base / 2 + (G.top - G.base) / 2 * (loc[1] + G.height / 2) / G.height;
      g1.appendChild(S.path(shift([[-half, loc[1]], [half, loc[1]]], ax), false, { class: 'lv-line' }));
    } else {
      g1.appendChild(S.path(shift(up, ax), true, { class: 'lv-frame' }));
      var bob = [loc[0], loc[1] - lib.FRAME.string];
      g1.appendChild(S.path(shift([loc, bob], ax), false, { class: 'lv-string' }));
      g1.appendChild(S.el('circle', { cx: ax + bob[0], cy: -bob[1], r: item.bob, class: 'lv-bob' }));
      g1.appendChild(S.el('circle', { cx: ax + loc[0], cy: -loc[1], r: 0.045, class: 'lv-pin' }));
    }
    svg.appendChild(g1);
    var xs = function (list) { return list.map(function (p) { return p[0]; }); };
    var right = ax + Math.max.apply(null, xs(up)) + 0.08, left = bx + Math.min.apply(null, xs(item.outline)) - 0.08;
    var mid = (right + left) / 2, len = Math.max(0.2, Math.min(0.5, (left - right) / 2 - 0.15));
    svg.appendChild(S.path([[mid - len, 0], [mid + len, 0]], false, { class: 'lv-arrow' }));
    svg.appendChild(S.path([[mid + len - 0.28, -0.22], [mid + len, 0], [mid + len - 0.28, 0.22]], false, { class: 'lv-arrow' }));
    var g2 = S.el('g', { class: 'lv-tilted' });
    g2.appendChild(S.path(shift(item.outline, bx), true, { class: water ? 'lv-glass' : 'lv-frame' }));
    if (!water) g2.appendChild(S.el('circle', { cx: bx + item.anchor[0], cy: -item.anchor[1], r: 0.045, class: 'lv-pin' }));
    svg.appendChild(g2);
    // Specimen labels inside the drawing, so they stay over their figures at any width.
    svg.appendChild(S.text(ax, -R - 0.12, 'UPRIGHT', { class: 'lv-fig-label' }));
    svg.appendChild(S.text(bx, -R - 0.12, 'TILTED', { class: 'lv-fig-label' }));
    return svg;
  }

  /* ---------- the countdown bar ---------- */

  function timerStart(item) {
    var ms = def.timeLimit(item.params);
    st.timer.hidden = !ms;
    st.timer.classList.remove('is-running', 'is-stopped');
    if (!ms) return;
    st.timerFill.style.animationDuration = ms + 'ms';
    void st.timerFill.offsetWidth;
    st.timer.classList.add('is-running');
  }
  function timerStop() { if (st) st.timer.classList.add('is-stopped'); }

  /* ---------- view functions ---------- */

  function describe(item) {
    var ms = def.timeLimit(item.params);
    return (item.task === 'water'
      ? 'A glass, partly full, is tilted. Which of the four pictures shows the water surface correctly?'
      : 'A weight hangs on a string from a pin inside a frame, and the frame is tilted. Which of the four pictures shows the string correctly?') +
      ' Keys 1 to 4' + (ms ? '; up to ' + Math.round(ms / 1000) + ' seconds.' : '.');
  }

  function mount(ctx) {
    var root = h('div.ex-level-stem');
    var stage = h('div.ex-stage.ex-level-stage');
    var holder = h('div.lv-stem-holder');
    var verdict = h('div.ex-verdict.lv-verdict', { hidden: true, role: 'status' });
    // px-keep-motion: base.css's reduced-motion rule would empty the bar at once, and the slow
    // sweep is information (the time left), not decoration.
    var timer = h('div.pr-timer.px-keep-motion', { 'aria-hidden': 'true', hidden: true }, h('div.pr-timer-fill'));
    var caption = h('p.ex-caption', { 'aria-live': 'polite' }), desc = h('p.px-sr');
    stage.appendChild(holder);
    // The verdict goes under the bar, not over the drawing (a tilted frame fills its box).
    root.appendChild(stage); root.appendChild(timer); root.appendChild(verdict); root.appendChild(caption); root.appendChild(desc);
    ctx.host.appendChild(root);
    st = { ctx: ctx, root: root, stage: stage, holder: holder, verdict: verdict, caption: caption, desc: desc,
      timer: timer, timerFill: timer.firstChild, item: null, optItem: null, opts: [] };
  }

  function newItem(item) {
    if (st.optItem === item) return;
    st.optItem = item;
    st.opts = [];
  }
  function drawOption(el, item, i, ctx) {
    if (!st) mount(ctx);
    newItem(item);
    var box = h('span.lv-pic');
    box.appendChild(picture(item, item.options[i], false));
    var tag = h('span.ex-tag', { hidden: true });
    el.appendChild(h('span.ex-opt', box, tag));
    st.opts[i] = { el: el, box: box, tag: tag };
  }
  function optionLabel(item, i) { return 'Picture ' + (i + 1); }
  function gridCols() { return 4; }

  function present(item, ctx) {
    if (!st) mount(ctx);
    newItem(item);
    st.item = item;
    st.root.classList.remove('is-revealed');
    st.root.setAttribute('data-task', item.task);
    st.verdict.hidden = true;
    st.verdict.textContent = '';
    st.caption.textContent = '';
    st.desc.textContent = describe(item);
    PX.ui.clear(st.holder);
    st.holder.appendChild(stemPicture(item));
    fitLabels(st.holder.firstChild);
    timerStart(item);
    return timing.nextPaint();
  }

  // Phones: the specimen labels keep 13 px on the screen. A small drawing gets larger labels, and
  // the strip above the figures grows when they need it (the figures and their spacing stay as
  // they are). Read before the first frame, never during the stimulus.
  function fitLabels(svg) {
    try {
      var vb0 = svg.viewBox.baseVal, x = vb0.x, y = vb0.y, w = vb0.width, h0 = vb0.height, fs = 0.17;
      for (var k = 0; k < 3; k++) {
        var r = svg.getBoundingClientRect(), vb = svg.viewBox.baseVal;
        if (!r.width || !r.height) return;
        fs = Math.max(0.17, 13 / Math.min(r.width / vb.width, r.height / vb.height));
        var grow = Math.max(0, 0.8 * fs - 0.23);
        if (Math.abs(vb.height - (h0 + grow)) < 1e-3) break;
        svg.setAttribute('viewBox', [x, y - grow, w, h0 + grow].join(' '));
      }
      if (fs > 0.17) Array.prototype.forEach.call(svg.querySelectorAll('.lv-fig-label'), function (t) { t.style.fontSize = fs.toFixed(3) + 'px'; });
    } catch (e) { /* the labels keep their drawing size */ }
  }

  /* ---------- reveal (development; the Check shows nothing), ≤ 700 ms ---------- */

  function reveal(item, response, result, ctx) {
    if (!st) return Promise.resolve();
    timerStop();
    st.root.classList.add('is-revealed');
    st.opts.forEach(function (o, i) {
      if (!o) return;
      var k = item.options[i].kind;
      o.tag.textContent = i === item.key ? '✓ ' + cap(item.task === 'water' ? 'tagLevel' : 'tagDown') : cap('kind_' + k);
      o.tag.setAttribute('data-kind', i === item.key ? 'same' : 'mirror');
      o.tag.hidden = false;
    });
    st.verdict.textContent = '✓ ' + cap(item.task === 'water' ? 'verdictWater' : 'verdictPlumb', item.key + 1);
    st.verdict.setAttribute('data-kind', 'same');
    st.verdict.hidden = false;
    return timing.wait(ctx && ctx.fast ? 0 : 250);
  }

  /* ---------- show me and the worked example: the true level through the anchor ---------- */

  function focusOption(i) {
    st.opts.forEach(function (o, j) {
      var b = o && o.el.closest ? o.el.closest('.px-choice') : null;
      if (b) b.classList.toggle('ex-focus', j === i);
    });
  }
  function guides(item, on) {
    st.opts.forEach(function (o, i) {
      if (!o) return;
      PX.ui.clear(o.box);
      o.box.appendChild(picture(item, item.options[i], on));
    });
  }
  function guideSteps(item) {
    var water = item.task === 'water';
    return [
      { ms: 2200, caption: cap(water ? 'guideWater' : 'guidePlumb'), enter: function () { focusOption(-1); guides(item, true); } },
      { ms: 2000, caption: cap(water ? 'matchWater' : 'matchPlumb', item.key + 1), enter: function () { guides(item, true); focusOption(item.key); } },
    ];
  }

  function runSteps(list, ctx, opts) { // minimal runner when the player has no ctx.play
    var scale = ctx && ctx.fast ? 0.02 : 1;
    return new Promise(function (resolve) {
      var i = -1, start = 0, go = true;
      function begin(now) {
        i++;
        if (i >= list.length) { resolve(); return false; }
        start = now;
        if (list[i].caption && opts.caption) opts.caption(list[i].caption);
        if (list[i].enter) list[i].enter();
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
    return play(guideSteps(item), ctx, { name: 'show-me' });
  }

  // The one-screen instruction's worked example (learn.demo, a fixed seed the Check never scores).
  function demo(item, ctx, caption) {
    if (!st || st.item !== item) return Promise.resolve();
    timerStop();
    var water = item.task === 'water';
    function point(i) {
      Array.prototype.forEach.call(st.holder.querySelectorAll('.lv-fig-label'), function (l, j) { l.classList.toggle('is-pointed', j === i); });
    }
    var intro = [
      { ms: 2200, caption: cap(water ? 'uprightWater' : 'uprightPlumb'), enter: function () { guides(item, false); focusOption(-1); point(0); } },
      { ms: 2200, caption: cap(water ? 'tiltedWater' : 'tiltedPlumb'), enter: function () { point(1); }, exit: function () { point(-1); } },
      { ms: 2200, caption: cap('options'), enter: function () { guides(item, false); } },
    ];
    var outro = { ms: 1800, caption: cap('answer', item.key + 1), enter: function () { focusOption(item.key); } };
    // Afterwards the pictures are as they were (the example can be answered or replayed).
    return play(intro.concat(guideSteps(item), [outro]), ctx, { name: 'demo', caption: caption || null })
      .then(function () { if (st && st.item === item) { guides(item, false); focusOption(-1); } });
  }

  function unmount() {
    if (!st) return;
    if (st.root.parentNode) st.root.parentNode.removeChild(st.root);
    st = null;
  }

  PX.ex.view('level', {
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
  });
})(window.PX);
