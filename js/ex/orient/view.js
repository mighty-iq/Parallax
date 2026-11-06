/* EX-08 Orient: view (SVG; ARCHITECTURE.md §6, docs/dev/EXERCISE-GUIDE.md).
   layout 'custom': the question (names with their map symbols), a top-down map of the item's objects
   and an arrow circle for the answer.
   - The circle's centre is where you stand (A) and its top is straight ahead (towards B). Pointer:
     press, drag or tap on the circle sets the arrow; keys ← / → turn it 5° (Shift: 1°); Enter or
     Confirm answers. The response is degrees clockwise from straight ahead (0–359), as score expects.
   - reveal draws the right direction with the tolerance as a shaded wedge next to the answer, the
     error in degrees, and on the map the sight lines and where the answer pointed.
   - show me turns the map about A by −heading (and centres A) until B is straight up, reads off the
     angle to C and carries it to the circle: the same geometry score uses (heading, key).
   - The view stays live until reveal: a Confirm the player ignores (e.g. while paused) can be repeated. */
(function (PX) {
  'use strict';

  var S = PX.core.svg, timing = PX.core.timing, h = PX.ui.h;
  var DIAL_R = 46, DIAL_BOX = 66, HUB = 7;    // the arrow circle in its own viewBox; taps inside HUB are ignored
  var LABEL_FS = 3.6, CHAR_W = 0.56, GLYPH_R = 5.2, RING_R = 5.5, LABEL_DY = 8.8, BADGE_DY = 8.4;   // map units (the map is 100 × 100)
  var st = null;

  function learn() { return PX.ex.learn('orient') || {}; }
  function cap(key, vars) {
    var s = String((learn().captions || {})[key] || '');
    for (var k in vars || {}) if (Object.prototype.hasOwnProperty.call(vars, k)) s = s.split('{' + k + '}').join(vars[k]);
    return s;
  }
  function isNum(v) { return typeof v === 'number' && isFinite(v); }
  function rad(d) { return d * Math.PI / 180; }
  function f2(v) { return (Math.round(v * 100) / 100).toString(); }
  function norm360(a) { a %= 360; return a < 0 ? a + 360 : a; }
  function adiff(a, b) { var d = Math.abs(norm360(a) - norm360(b)); return d > 180 ? 360 - d : d; }
  function ease(k) { return k * k * (3 - 2 * k); }
  // Point at bearing b (degrees clockwise from up) and distance r from (x, y); screen y points down.
  function polar(x, y, b, r) { return [x + r * Math.sin(rad(b)), y - r * Math.cos(rad(b))]; }
  function side(a) { a = norm360(Math.round(a)); return a <= 180 ? { deg: a, side: 'right' } : { deg: 360 - a, side: 'left' }; }
  function sideText(a) {
    a = norm360(Math.round(a));
    if (a === 0) return cap('ahead') || 'straight ahead';
    if (a === 180) return cap('behind') || 'straight behind';
    var s = side(a);
    return s.deg + '° ' + s.side;
  }

  /* ---------- symbols: non-directional, each a different shape (colour is never the only cue) ---------- */

  function circle(r, cls, cx, cy) { return S.el('circle', { cx: cx || 0, cy: cy || 0, r: r, class: cls }); }
  function poly(points, cls) { return S.el('polygon', { points: points.map(function (p) { return f2(p[0]) + ',' + f2(p[1]); }).join(' '), class: cls }); }
  function ring(n, r, fr) { var out = []; for (var i = 0; i < n; i++) { var a = 2 * Math.PI * i / n; out.push([r * fr(i) * Math.sin(a), -r * fr(i) * Math.cos(a)]); } return out; }
  var GLYPHS = {
    tree: function () { return [poly(ring(16, 4.3, function (i) { return i % 2 ? 0.74 : 1; }), 'g-fill')]; },
    well: function () { return [circle(3.3, 'g-ring')]; },
    rock: function () { return [poly([[-3.8, -1], [-2, -3.6], [1.6, -3.9], [4, -0.8], [3, 2.9], [-0.6, 3.8], [-3.6, 2.2]], 'g-fill')]; },
    lamp: function () {
      var out = [circle(3.2, 'g-line'), circle(1.3, 'g-solid')];
      [45, 135, 225, 315].forEach(function (b) { var a = polar(0, 0, b, 3.2), c = polar(0, 0, b, 4.9); out.push(S.el('line', { x1: f2(a[0]), y1: f2(a[1]), x2: f2(c[0]), y2: f2(c[1]), class: 'g-line' })); });
      return out;
    },
    tower: function () { return [S.el('rect', { x: -3.4, y: -3.4, width: 6.8, height: 6.8, class: 'g-fill' }), S.el('rect', { x: -1.5, y: -1.5, width: 3, height: 3, class: 'g-inner' })]; },
    barrel: function () { return [S.el('rect', { x: -4.4, y: -2.9, width: 8.8, height: 5.8, rx: 2.4, class: 'g-fill' }), S.el('path', { d: 'M-1.6 -2.9V2.9M1.6 -2.9V2.9', class: 'g-inner' })]; },
    fountain: function () { var out = [circle(1.3, 'g-solid')]; for (var b = 0; b < 360; b += 60) { var p = polar(0, 0, b, 3.3); out.push(circle(1.05, 'g-line', p[0], p[1])); } return out; },
    bush: function () { return [circle(2.4, 'g-fill', 0, -1.8), circle(2.4, 'g-fill', -1.9, 1.3), circle(2.4, 'g-fill', 1.9, 1.3)]; },
    silo: function () { return [circle(3.7, 'g-solid')]; },
    stump: function () { return [circle(3.8, 'g-fill'), S.el('path', { d: 'M-2.2 0H2.2M0 -2.2V2.2', class: 'g-inner' })]; },
    bell: function () { return [poly([[0, -4.6], [4.6, 0], [0, 4.6], [-4.6, 0]], 'g-fill')]; },
    cairn: function () { return [[0, 0], [0, -3], [3, 0], [0, 3], [-3, 0]].map(function (p) { return circle(1.25, 'g-solid', p[0], p[1]); }); },
  };
  function glyph(id) {
    var g = S.el('g', { class: 'ex-orient-glyph' });
    (GLYPHS[id] || GLYPHS.rock)().forEach(function (n) { g.appendChild(n); });
    return g;
  }
  function icon(id) {
    var s = S.svg(12, 12, { viewBox: '-6 -6 12 12', width: '1.2em', height: '1.2em', class: 'ex-orient-icon', 'aria-hidden': 'true' });
    s.appendChild(glyph(id));
    return s;
  }

  /* ---------- the question: item.text, with each named object's symbol beside its name ---------- */

  function question(item) {
    var text = String(item.text || ''), p = h('p.ex-orient-q'), at = 0;
    [item.at, item.facing, item.target].forEach(function (ix) {
      var o = item.objects[ix], re = new RegExp('\\b' + o.name + '\\b', 'g');
      re.lastIndex = at;
      var m = re.exec(text);
      if (!m) return;
      if (m.index > at) p.appendChild(document.createTextNode(text.slice(at, m.index)));
      p.appendChild(h('b.ex-orient-chip', icon(o.id), o.name));
      at = m.index + o.name.length;
    });
    p.appendChild(document.createTextNode(text.slice(at)));
    return p;
  }

  /* ---------- the map ---------- */

  // Name labels go below the symbol if there is room, else above, right or left: the first spot that
  // stays inside the map and clear of other symbols and labels (otherwise the least overlap).
  var SPOTS = [
    { pos: 'below', dx: 0, dy: LABEL_DY, anchor: 'middle' }, { pos: 'above', dx: 0, dy: -LABEL_DY, anchor: 'middle' },
    { pos: 'right', dx: 6.6, dy: 0, anchor: 'start' }, { pos: 'left', dx: -6.6, dy: 0, anchor: 'end' },
  ];
  function overlap(a, b) {
    var w = Math.min(a.x1, b.x1) - Math.max(a.x0, b.x0), hh = Math.min(a.y1, b.y1) - Math.max(a.y0, b.y0);
    return w > 0 && hh > 0 ? w * hh : 0;
  }
  function boxAt(o, s, w) {
    var hh = LABEL_FS * 0.62, x0 = s.anchor === 'middle' ? o.x - w / 2 : s.anchor === 'start' ? o.x + s.dx : o.x + s.dx - w;
    return { x0: x0, x1: x0 + w, y0: o.y + s.dy - hh, y1: o.y + s.dy + hh };
  }
  // The badges shown at reveal (you / facing / point to) take another of the four spots, clear of
  // every name label and symbol (sized for the longest badge).
  var BADGE_FS = 2.9, BADGE_W = 0.62 * BADGE_FS * 8 + 0.8;
  function badgeBox(o, s) {
    var hh = BADGE_FS * 0.62, dy = s.pos === 'below' ? BADGE_DY : s.pos === 'above' ? -BADGE_DY : 0;
    var x0 = s.anchor === 'middle' ? o.x - BADGE_W / 2 : s.anchor === 'start' ? o.x + s.dx : o.x + s.dx - BADGE_W;
    return { x0: x0, x1: x0 + BADGE_W, y0: o.y + dy - hh, y1: o.y + dy + hh, dy: dy };
  }
  function outside(M, b) { return Math.max(0, -b.x0) + Math.max(0, b.x1 - M.w) + Math.max(0, -b.y0) + Math.max(0, b.y1 - M.h); }
  function placeLabels(item) {
    var M = item.map, objs = item.objects, placed = [];
    var discs = objs.map(function (o) { return { x0: o.x - GLYPH_R, x1: o.x + GLYPH_R, y0: o.y - GLYPH_R, y1: o.y + GLYPH_R }; });
    var labels = objs.map(function (o, i) {
      var w = CHAR_W * LABEL_FS * o.name.length + 0.8, best = null;
      SPOTS.forEach(function (s, si) {
        var b = boxAt(o, s, w), cost = 50 * outside(M, b) + si * 0.01;
        discs.forEach(function (d, j) { if (j !== i) cost += 4 * overlap(b, d); });
        placed.forEach(function (q) { cost += 4 * overlap(b, q); });
        if (!best || cost < best.cost) best = { cost: cost, s: s, b: b };
      });
      placed.push(best.b);
      return best.s;
    });
    return objs.map(function (o, i) {
      var best = null;
      SPOTS.forEach(function (s, si) {
        if (s === labels[i]) return;
        var b = badgeBox(o, s), cost = 50 * outside(M, b) + si * 0.01;
        discs.forEach(function (d, j) { if (j !== i) cost += 4 * overlap(b, d); });
        placed.forEach(function (q) { cost += 4 * overlap(b, q); });
        if (!best || cost < best.cost) best = { cost: cost, s: s, dy: b.dy };
      });
      return { label: labels[i], badge: { dx: best.s.dx, dy: best.dy, anchor: best.s.anchor } };
    });
  }

  function drawMap(item) {
    var M = item.map, svg = S.svg(M.w, M.h, { width: '100%', height: '100%', class: 'ex-orient-map', 'aria-hidden': 'true' });
    var world = S.el('g', { class: 'ex-orient-world' }), grid = S.el('g', { class: 'ex-orient-grid' });
    for (var v = -100; v <= 200; v += 10) {
      grid.appendChild(S.el('line', { x1: v, y1: -100, x2: v, y2: 200 }));
      grid.appendChild(S.el('line', { x1: -100, y1: v, x2: 200, y2: v }));
    }
    var lines = S.el('g', { class: 'ex-orient-lines' }), marks = S.el('g', { class: 'ex-orient-marks' });
    world.appendChild(grid);
    world.appendChild(lines);
    var spots = placeLabels(item);
    var objs = item.objects.map(function (o, i) {
      var g = S.el('g', { class: 'ex-orient-obj', transform: 'translate(' + o.x + ' ' + o.y + ')', 'data-name': o.name });
      var up = S.el('g', { class: 'ex-orient-upright' }), s = spots[i].label, bs = spots[i].badge;
      up.appendChild(circle(RING_R, 'ex-orient-ring'));
      up.appendChild(glyph(o.id));
      up.appendChild(S.text(s.dx, s.dy, o.name, { class: 'ex-orient-name', 'text-anchor': s.anchor }));
      var badge = S.text(bs.dx, bs.dy, '', { class: 'ex-orient-badge', 'text-anchor': bs.anchor });
      up.appendChild(badge);
      g.appendChild(up);
      world.appendChild(g);
      return { g: g, up: up, badge: badge };
    });
    world.appendChild(marks);
    svg.appendChild(world);
    return { svg: svg, world: world, lines: lines, marks: marks, objs: objs, uprights: [], rho: 0 };
  }

  // k = 0: the map as given; k = 1: turned about A by −heading (B straight up) with A at the centre.
  // Symbols and labels stay upright.
  function setView(item, k) {
    var A = item.objects[item.at], M = item.map, m = st.map;
    m.rho = -item.heading * k;
    var tx = (M.w / 2 - A.x) * k, ty = (M.h / 2 - A.y) * k;
    m.world.setAttribute('transform', k ? 'translate(' + f2(tx) + ' ' + f2(ty) + ') rotate(' + f2(m.rho) + ' ' + A.x + ' ' + A.y + ')' : '');
    var keep = k ? 'rotate(' + f2(-m.rho) + ')' : '';
    m.objs.forEach(function (o) { o.up.setAttribute('transform', keep); });
    m.uprights.forEach(function (u) { u.inner.setAttribute('transform', keep); });
  }
  function clearMap() {
    var m = st.map;
    m.objs.forEach(function (o) { o.g.setAttribute('class', 'ex-orient-obj'); o.badge.textContent = ''; });
    PX.ui.clear(m.lines);
    PX.ui.clear(m.marks);
    m.uprights = [];
  }
  var PART_OF = { at: 'at', facing: 'facing', target: 'target' };
  function markPart(item, part) {
    var o = st.map.objs[item[PART_OF[part]]];
    o.g.classList.add('is-' + part);
    o.badge.textContent = cap(part === 'at' ? 'badgeAt' : part === 'facing' ? 'badgeFacing' : 'badgeTarget');
    if (part === 'at') {
      // "you": a pointer just outside A's ring, aimed at B (it turns with the map)
      var A = item.objects[item.at], tip = polar(A.x, A.y, item.heading, RING_R + 4.6);
      var l = polar(A.x, A.y, item.heading - 24, RING_R + 1.4), r = polar(A.x, A.y, item.heading + 24, RING_R + 1.4);
      st.map.marks.appendChild(poly([tip, l, r], 'ex-orient-you'));
    }
  }
  function segment(a, b, cls) {
    return S.el('line', { x1: f2(a[0]), y1: f2(a[1]), x2: f2(b[0]), y2: f2(b[1]), class: cls });
  }
  function sightLine(item, to, cls) {
    var A = item.objects[item.at], T = item.objects[to], d = Math.hypot(T.x - A.x, T.y - A.y), b = Math.atan2(T.x - A.x, -(T.y - A.y)) * 180 / Math.PI;
    st.map.lines.appendChild(segment(polar(A.x, A.y, b, RING_R), polar(A.x, A.y, b, d - RING_R), cls));
  }
  // Where the answer points on the map: a ray from A at bearing heading + answer.
  function pointRay(item, answer, kind) {
    var A = item.objects[item.at], b = item.heading + answer, len = 30;
    var g = S.el('g', { class: 'ex-orient-ray is-' + kind });
    g.appendChild(segment(polar(A.x, A.y, b, RING_R), polar(A.x, A.y, b, len - 2), 'ex-orient-ray-line'));
    g.appendChild(poly([polar(A.x, A.y, b, len + 1.5), polar(A.x, A.y, b - 5.5, len - 3.2), polar(A.x, A.y, b + 5.5, len - 3.2)], 'ex-orient-ray-head'));
    st.map.marks.appendChild(g);
  }
  // The angle at A from the facing direction to the target, the short way round, with its size.
  function angleArc(item) {
    var A = item.objects[item.at], key = item.key, r = 10.5, right = key <= 180, span = right ? key : 360 - key;
    var a = polar(A.x, A.y, item.heading, r), b = polar(A.x, A.y, item.heading + key, r);
    st.map.marks.appendChild(S.el('path', { d: 'M' + f2(a[0]) + ' ' + f2(a[1]) + 'A' + r + ' ' + r + ' 0 0 ' + (right ? 1 : 0) + ' ' + f2(b[0]) + ' ' + f2(b[1]), class: 'ex-orient-arc' }));
    var mid = polar(A.x, A.y, item.heading + (right ? span / 2 : -span / 2), r + 5.2);
    var outer = S.el('g', { transform: 'translate(' + f2(mid[0]) + ' ' + f2(mid[1]) + ')' }), inner = S.el('g', {});
    inner.appendChild(S.text(0, 0, Math.round(span) + '°', { class: 'ex-orient-angle' }));
    outer.appendChild(inner);
    st.map.marks.appendChild(outer);
    st.map.uprights.push({ inner: inner });
    inner.setAttribute('transform', st.map.rho ? 'rotate(' + f2(-st.map.rho) + ')' : '');
  }

  /* ---------- the arrow circle ---------- */

  function head(len, cls) { return S.el('path', { d: 'M0 ' + (-len) + 'L-3.6 ' + (-len + 7.5) + 'L3.6 ' + (-len + 7.5) + 'Z', class: cls }); }
  function arrow(cls) {
    var g = S.el('g', { class: cls, visibility: 'hidden' });
    g.appendChild(S.el('line', { x1: 0, y1: 0, x2: 0, y2: -DIAL_R + 6, class: cls + '-line' }));
    g.appendChild(head(DIAL_R - 0.5, cls + '-head'));
    return g;
  }
  function drawDial(item) {
    var B = item.objects[item.facing], A = item.objects[item.at];
    var svg = S.svg(2 * DIAL_BOX, 2 * DIAL_BOX, {
      viewBox: [-DIAL_BOX, -DIAL_BOX, 2 * DIAL_BOX, 2 * DIAL_BOX].join(' '), width: '100%', height: '100%', class: 'ex-orient-dial',
      role: 'slider', tabindex: 0, 'aria-label': cap('dialLabel', { facing: B.name, at: A.name }) || 'Arrow circle',
      'aria-valuemin': 0, 'aria-valuemax': 359, 'aria-valuetext': cap('notSet') || 'not set',
    });
    svg.appendChild(circle(DIAL_R, 'ex-orient-face'));
    for (var b = 0; b < 360; b += 30) {
      var p = polar(0, 0, b, DIAL_R), q = polar(0, 0, b, DIAL_R - (b % 90 ? 3 : 6));
      svg.appendChild(segment(p, q, 'ex-orient-tick'));
    }
    var wedge = S.el('path', { class: 'ex-orient-wedge', visibility: 'hidden' });
    svg.appendChild(wedge);
    var ahead = S.el('g', { class: 'ex-orient-ahead' });
    ahead.appendChild(S.el('line', { x1: 0, y1: -HUB, x2: 0, y2: -DIAL_R + 7, class: 'ex-orient-ahead-line' }));
    svg.appendChild(ahead);
    // labels: the object you face at the top, left and right at the sides
    var top = S.el('g', { class: 'ex-orient-top', transform: 'translate(0 ' + (-DIAL_R - 9.5) + ')' });
    var w = CHAR_W * 7 * B.name.length;
    var ic = S.el('g', { transform: 'translate(' + f2(-w / 2 - 4.8) + ' 0) scale(0.95)' });
    ic.appendChild(glyph(B.id));
    top.appendChild(ic);
    top.appendChild(S.text(f2(2), 0, B.name, { class: 'ex-orient-dial-name' }));
    svg.appendChild(top);
    // left and right upright, just outside the ring (sized in CSS to stay ≥ 12 px on screen)
    svg.appendChild(S.text(-DIAL_R - 2.5, 0, cap('left') || 'left', { class: 'ex-orient-dial-side', 'text-anchor': 'end' }));
    svg.appendChild(S.text(DIAL_R + 2.5, 0, cap('right') || 'right', { class: 'ex-orient-dial-side', 'text-anchor': 'start' }));
    var key = arrow('ex-orient-key'), yours = arrow('ex-orient-arrow');
    svg.appendChild(key);
    svg.appendChild(yours);
    var hub = S.el('g', { class: 'ex-orient-hub' });
    hub.appendChild(circle(HUB - 0.5, 'ex-orient-hub-disc'));
    var hg = S.el('g', { transform: 'scale(0.95)' });
    hg.appendChild(glyph(A.id));
    hub.appendChild(hg);
    svg.appendChild(hub);
    return { svg: svg, arrow: yours, key: key, wedge: wedge };
  }
  function setArrow(g, deg) {
    if (!isNum(deg)) { g.setAttribute('visibility', 'hidden'); return; }
    g.setAttribute('transform', 'rotate(' + f2(norm360(deg)) + ')');
    g.setAttribute('visibility', 'visible');
  }
  function setWedge(center, half) {
    var w = st.dial.wedge;
    if (!isNum(center)) { w.setAttribute('visibility', 'hidden'); return; }
    var a = polar(0, 0, center - half, DIAL_R - 1), b = polar(0, 0, center + half, DIAL_R - 1);
    w.setAttribute('d', 'M0 0L' + f2(a[0]) + ' ' + f2(a[1]) + 'A' + (DIAL_R - 1) + ' ' + (DIAL_R - 1) + ' 0 ' + (2 * half > 180 ? 1 : 0) + ' 1 ' + f2(b[0]) + ' ' + f2(b[1]) + 'Z');
    w.setAttribute('visibility', 'visible');
  }

  /* ---------- input: pointer on the circle, keys, Confirm ---------- */

  function live() { return !!(st && st.live && !st.playing); }
  function setValue(v) {
    st.value = norm360(Math.round(v));
    setArrow(st.dial.arrow, st.value);
    var t = sideText(st.value);
    st.readout.textContent = cap('readout', { dir: t }) || t;
    st.dial.svg.setAttribute('aria-valuenow', String(st.value));
    st.dial.svg.setAttribute('aria-valuetext', t);
    st.confirm.disabled = false;
    st.root.classList.add('has-arrow');
  }
  function turnBy(d) {
    if (!live()) return false;
    setValue((st.value === null ? 0 : st.value) + d);
    return undefined;
  }
  function confirm() {
    if (!live() || st.value === null || !st.respond) return;
    st.respond(st.value);
  }
  // Degrees clockwise from the top of the circle under the pointer (null inside the hub).
  function angleAt(e) {
    var r = st.dial.svg.getBoundingClientRect(), s = Math.min(r.width, r.height) / (2 * DIAL_BOX);
    if (!(s > 0)) return null;
    var dx = (e.clientX - (r.left + r.width / 2)) / s, dy = (e.clientY - (r.top + r.height / 2)) / s;
    if (dx * dx + dy * dy < HUB * HUB) return null;
    return Math.atan2(dx, -dy) * 180 / Math.PI;
  }
  function bindDial() {
    var svg = st.dial.svg, drag = null;
    svg.addEventListener('pointerdown', function (e) {
      if (!live() || (e.button !== undefined && e.button > 0)) return;
      var a = angleAt(e);
      if (a === null) return;
      e.preventDefault();
      drag = e.pointerId;
      try { svg.setPointerCapture(e.pointerId); } catch (err) { /* capture is optional */ }
      setValue(a);
    });
    svg.addEventListener('pointermove', function (e) {
      if (drag === null || e.pointerId !== drag || !live()) return;
      var a = angleAt(e);
      if (a !== null) setValue(a);
    });
    function up(e) { if (e.pointerId === drag) drag = null; }
    svg.addEventListener('pointerup', up);
    svg.addEventListener('pointercancel', up);
    svg.addEventListener('lostpointercapture', up);
  }
  function stopInput() {
    if (!st) return;
    st.live = false;
    if (st.popKeys) { st.popKeys(); st.popKeys = null; }
  }

  /* ---------- one picture for reveal, show me and the demo ---------- */

  // Every step sets all of it, so Replay and Step work from anywhere. o: { k (map turn 0–1),
  // parts (true | ['at', 'facing', 'target']), ab, ac (sight lines), arc (angle at A), ray (the
  // answer on the map), key (true | degrees: the right arrow on the circle), wedge (± tolerance),
  // mine (degrees | null: the answer arrow; default: the answer after reveal, else the live arrow) }.
  function scene(item, o) {
    o = o || {};
    clearMap();
    setView(item, o.k || 0);
    (o.parts === true ? ['at', 'facing', 'target'] : o.parts || []).forEach(function (p) { markPart(item, p); });
    if (o.ab) sightLine(item, item.facing, 'ex-orient-ab');
    if (o.ac) sightLine(item, item.target, 'ex-orient-ac');
    if (o.arc) angleArc(item);
    if (o.ray && isNum(st.response)) pointRay(item, st.response, st.result && st.result.correct ? 'right' : 'wrong');
    setArrow(st.dial.key, o.key === true ? item.key : o.key);
    setWedge(o.wedge ? item.key : null, item.tolerance);
    setArrow(st.dial.arrow, o.mine !== undefined ? o.mine : st.done ? st.response : st.value);
  }
  function where(a) {
    var s = side(a);
    return cap(s.deg < 80 ? 'whereFront' : s.deg > 100 ? 'whereBehind' : 'whereSide', { side: s.side });
  }
  function hintFor(item, resp, result) {
    if (!isNum(resp) || !result || result.correct) return '';
    // pointing as if facing up the map (the egocentric frame) is off by exactly the shift
    if (item.shift > item.tolerance && adiff(resp, item.targetBearing) <= item.tolerance) return cap('hintMapUp', { facing: item.objects[item.facing].name });
    if (adiff(resp, 360 - item.key) <= item.tolerance) return cap('hintSides');
    if (result.detail && result.detail.frontBack) return cap('hintFrontBack');
    return '';
  }

  /* ---------- turning the device voids the item ---------- */

  // On a phone, turning the device turns the map with it, the modern version of turning the test
  // booklet (research/B §5), so from present until reveal any orientation change voids the trial:
  // 'trial:void' on PX.bus and ctx.voidTrial, as Homing's pause does, and a one-line notice.
  function voidTrial(reason) {
    if (!st || st.voided) return;
    st.voided = reason;
    if (PX.bus) PX.bus.emit('trial:void', { ex: 'orient', seed: st.item && st.item.seed, reason: reason, stats: null });
    if (st.ctx && typeof st.ctx.voidTrial === 'function') {
      try { st.ctx.voidTrial(reason, null); } catch (e) { if (window.console) console.error('orient: ctx.voidTrial failed', e); }
    }
    st.voidNote.textContent = cap('voidRotated');
    st.voidNote.hidden = false;
  }
  // screen.orientation 'change' where available, else a change of matchMedia('(orientation: portrait)'),
  // else window 'orientationchange'.
  function watchRotation(item) {
    unwatchRotation();
    var off = [], win = window;
    function fire() { if (st && st.item === item && !st.done) voidTrial('rotated'); }
    function on(target, type) { target.addEventListener(type, fire); off.push(function () { target.removeEventListener(type, fire); }); }
    try {
      var so = win.screen && win.screen.orientation, mq = null;
      if (so && typeof so.addEventListener === 'function') on(so, 'change');
      else {
        mq = win.matchMedia ? win.matchMedia('(orientation: portrait)') : null;
        if (mq && typeof mq.addEventListener === 'function') on(mq, 'change');
        else if (mq && typeof mq.addListener === 'function') { mq.addListener(fire); off.push(function () { mq.removeListener(fire); }); }
        else if (win.addEventListener) on(win, 'orientationchange');
      }
    } catch (e) { /* no orientation events here: nothing to watch */ }
    st.offRotation = function () { off.forEach(function (f) { f(); }); };
  }
  function unwatchRotation() {
    if (st && st.offRotation) { st.offRotation(); st.offRotation = null; }
  }

  /* ---------- view functions ---------- */

  function mount(ctx) {
    var root = h('div.ex-orient-stem');
    var qbox = h('div.ex-orient-qbox'), stage = h('div.ex-stage.ex-orient-stage'), dialbox = h('div.ex-orient-dialbox');
    var readout = h('p.ex-orient-readout', { 'aria-hidden': 'true' });
    var confirmBtn = PX.ui.button(cap('confirm') || 'Confirm', { kind: 'primary', key: 'Enter', className: 'ex-orient-confirm', disabled: true, onClick: function () { confirm(); } });
    var hint = h('p.ex-orient-hint', h('span.ex-orient-touch', cap('hintPointer')), ' ', h('span.ex-orient-keys', cap('hintKeys')));
    var verdict = h('div.ex-verdict.ex-orient-verdict', { hidden: true, role: 'status' });
    var note = h('p.ex-orient-note', { hidden: true });
    var caption = h('p.ex-caption', { 'aria-live': 'polite' }), desc = h('p.px-sr');
    var voidNote = h('p.ex-orient-void', { hidden: true, role: 'status' });
    var side = h('div.ex-orient-side', dialbox, h('div.ex-orient-ctl', readout, confirmBtn, hint, verdict), note);
    root.appendChild(h('div.ex-orient-body', qbox, stage, side));
    root.appendChild(voidNote);
    root.appendChild(caption);
    root.appendChild(desc);
    if (ctx.settings && ctx.settings.keyHints === false) root.classList.add('no-keyhints');
    ctx.host.appendChild(root);
    st = { ctx: ctx, root: root, qbox: qbox, stage: stage, dialbox: dialbox, readout: readout, confirm: confirmBtn, verdict: verdict,
      note: note, caption: caption, desc: desc, voidNote: voidNote, item: null, map: null, dial: null, value: null, response: null,
      result: null, live: false, playing: false, done: false, respond: null, popKeys: null, voided: null, offRotation: null };
  }

  function present(item, ctx) {
    if (!st) mount(ctx);
    stopInput();
    st.item = item; st.value = null; st.response = null; st.result = null; st.done = false; st.playing = false; st.respond = null;
    st.voided = null;
    st.voidNote.hidden = true;
    st.voidNote.textContent = '';
    st.root.classList.remove('is-revealed', 'has-arrow');
    PX.ui.clear(st.qbox).appendChild(question(item));
    st.map = drawMap(item);
    PX.ui.clear(st.stage).appendChild(st.map.svg);
    st.dial = drawDial(item);
    PX.ui.clear(st.dialbox).appendChild(st.dial.svg);
    bindDial();
    st.readout.textContent = cap('readoutNone');
    st.confirm.hidden = false;
    st.confirm.disabled = true;
    st.verdict.hidden = true; st.verdict.textContent = '';
    st.note.hidden = true; st.note.textContent = '';
    st.caption.textContent = '';
    st.desc.textContent = cap('describe', { n: item.objects.length, facing: item.objects[item.facing].name, at: item.objects[item.at].name });
    watchRotation(item);
    return timing.nextPaint();
  }

  // Called once the answer clock runs; the arrow and Confirm work until reveal.
  function collect(item, ctx, respond) {
    if (!st || st.item !== item) return;
    st.respond = respond;
    st.live = true;
    if (st.popKeys) st.popKeys();
    st.popKeys = ctx.keys.push({
      ArrowLeft: function (e) { return turnBy(e && e.shiftKey ? -1 : -5); },
      ArrowRight: function (e) { return turnBy(e && e.shiftKey ? 1 : 5); },
      Enter: function () {
        if (!live()) return false;
        if (st.value === null) { st.readout.textContent = cap('setFirst'); return undefined; }
        confirm();
        return undefined;
      },
      repeat: ['ArrowLeft', 'ArrowRight'],
    }, { through: true });
  }

  function reveal(item, response, result) {
    if (!st || st.item !== item) return Promise.resolve();
    stopInput();
    unwatchRotation();
    st.done = true;
    st.response = isNum(response) ? norm360(response) : null;
    st.result = result || { correct: false };
    var ok = !!st.result.correct, err = isNum(st.result.value) ? Math.round(st.result.value) : null;
    st.root.classList.add('is-revealed');
    st.dial.arrow.setAttribute('class', 'ex-orient-arrow ' + (ok ? 'is-right' : 'is-wrong'));
    scene(item, { k: 0, parts: true, ab: true, ac: true, ray: true, key: true, wedge: true });
    st.confirm.hidden = true;
    st.verdict.hidden = false;
    st.verdict.setAttribute('data-kind', ok ? 'right' : 'wrong');
    st.verdict.textContent = (ok ? '✓ ' : '✗ ') + (err === null ? cap('noAnswer') : cap(ok ? 'verdictRight' : 'verdictWrong', { err: err, tol: item.tolerance }));
    var C = item.objects[item.target], s = side(item.key);
    var lines = [cap('answerWas', { target: C.name, deg: s.deg, side: s.side, where: where(item.key) }), cap('legend', { tol: item.tolerance })];
    var hint = hintFor(item, st.response, st.result);
    if (hint) lines.push(hint);
    st.note.textContent = lines.join(' ');
    st.note.hidden = false;
    st.readout.textContent = st.response !== null ? cap('readoutYours', { dir: sideText(st.response) }) : '';
    return Promise.resolve();
  }

  // The solution from the grading geometry: stand at A facing B, turn the map by −heading (B
  // straight up, A centred), read the angle to C (the key) and carry it to the circle.
  function solution(item) {
    var A = item.objects[item.at], B = item.objects[item.facing], C = item.objects[item.target];
    var hd = Math.abs(item.heading), s = side(item.key), mine = st.done ? st.response : null;
    function base(extra) {
      var o = { parts: ['at', 'facing'], ab: true, mine: mine };
      for (var k in extra) if (Object.prototype.hasOwnProperty.call(extra, k)) o[k] = extra[k];
      return o;
    }
    var turnCap = hd < 4 ? cap('turnNone', { facing: B.name })
      : cap('turn', { at: A.name, facing: B.name, deg: Math.round(hd), dir: item.heading > 0 ? 'counter-clockwise' : 'clockwise' });
    return [
      { ms: 1700, caption: cap('stand', { at: A.name, facing: B.name }), enter: function () { scene(item, base({ k: 0 })); } },
      { ms: Math.round(900 + 1500 * hd / 180), caption: turnCap, enter: function () { scene(item, base({ k: 0 })); },
        update: function (k) { setView(item, ease(k)); } },
      { ms: 2100, caption: cap('read', { target: C.name, deg: s.deg, side: s.side, where: where(item.key) }),
        enter: function () { scene(item, base({ k: 1, parts: true, ac: true, arc: true })); } },
      { ms: 1600, caption: cap('circle', { deg: s.deg, side: s.side }),
        enter: function () { scene(item, base({ k: 1, parts: true, ac: true, arc: true, key: 0 })); },
        update: function (k) { setArrow(st.dial.key, item.key <= 180 ? item.key * ease(k) : 360 - (360 - item.key) * ease(k)); },
        exit: function () { setWedge(item.key, item.tolerance); } },
    ];
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
        var s = list[i], k = Math.min(1, Math.max(0, (now - start) / Math.max(1, s.ms * scale)));
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
    return play(solution(item), ctx, { name: 'show-me' });
  }

  // Tutorial: the parts one by one, the same solution, then how to answer. Keys and the pointer
  // rest while it plays; afterwards the item can be answered as usual.
  function demo(item, ctx, caption) {
    if (!st || st.item !== item) return Promise.resolve();
    var A = item.objects[item.at], B = item.objects[item.facing], C = item.objects[item.target];
    st.playing = true;
    var intro = [
      { ms: 2000, caption: cap('demoMap'), enter: function () { scene(item, { k: 0, mine: null }); } },
      { ms: 1800, caption: cap('demoAt', { at: A.name }), enter: function () { scene(item, { k: 0, parts: ['at'], mine: null }); } },
      { ms: 1800, caption: cap('demoFacing', { facing: B.name }), enter: function () { scene(item, { k: 0, parts: ['at', 'facing'], ab: true, mine: null }); } },
      { ms: 1800, caption: cap('demoTarget', { target: C.name }), enter: function () { scene(item, { k: 0, parts: true, ab: true, mine: null }); } },
    ];
    var outro = [
      { ms: 2600, caption: cap('demoAnswer'), enter: function () { scene(item, { k: 0, mine: 0 }); },
        update: function (k) { setArrow(st.dial.arrow, item.key <= 180 ? item.key * ease(k) : 360 - (360 - item.key) * ease(k)); } },
    ];
    return play(intro.concat(solution(item).slice(1), outro), ctx, { name: 'demo', caption: caption || null }).then(function () {
      if (!st) return;
      st.playing = false;
      if (st.item === item && !st.done) {
        st.value = null;
        scene(item, { k: 0, mine: null });
        st.readout.textContent = cap('readoutNone');
        st.confirm.disabled = true;
        st.root.classList.remove('has-arrow');
      }
    });
  }

  function unmount() {
    if (!st) return;
    stopInput();
    unwatchRotation();
    if (st.root.parentNode) st.root.parentNode.removeChild(st.root);
    st = null;
  }

  PX.ex.view('orient', {
    layout: 'custom',
    css: true,
    mount: mount,
    present: present,
    collect: collect,
    reveal: reveal,
    showMe: showMe,
    demo: demo,
    unmount: unmount,
    // for tests: the dial geometry and the solution steps (show me's model)
    dial: { radius: DIAL_R, box: DIAL_BOX, hub: HUB },
    voided: function () { return st ? st.voided : null; },
    watching: function () { return !!(st && st.offRotation); },
    sideText: sideText,
    steps: function (item) { return st && st.item === item ? solution(item) : []; },
  });
})(window.PX);
