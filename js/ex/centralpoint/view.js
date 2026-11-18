/* EX-20 Central Point: view (2D SVG, layout 'custom'; docs/research/v1.2/C1-central-point.md §5, PLAN.md
   milestone 8, CONTRACT-v1.2 D and E). Everything is drawn from the grading model (PX.ex.get(id).lib).
   - The board: 7 × 7 dots in a square plate, targets as rings with a centre dot (shape, not colour, marks
     a target), the marker a filled ring with a cross-hair and faint answer points round it only, so the
     board never looks like a 13 × 13 grid. Coordinates in the SVG are the item's half-steps (x right,
     y down), with a margin for the outer rings and labels. On a 360 px phone a dot spacing is about 45 px.
   - Input. Quick: a tap places the marker on the nearest answer point; a tap within about 24 px of it
     (a 48 px target) answers, as do Confirm and Enter; pressing and moving drags it. Exact: a tap places
     it, a press near it drags it (relative, so the finger need not cover it), the four 44 px arrow
     buttons and the arrow keys move it half a dot, Confirm or Enter answers. No total shows before the
     answer (C1 §2.3: a live readout turns the task into search). The quick deadline is the player's
     (step.deadlineMs from the engine's pace); atDeadline hands in a placed marker (CONTRACT-v1.2 E).
   - Try 1 (ctx.assist 'diagonals'): the kite's two diagonals are drawn, its first step done.
   - reveal: lines from your spot to every target with their lengths in dots, the best answer point
     ringed and labelled, a small cross at the continuous best spot when it lies between answer points,
     the other answer points of the band, the totals and the excess; Map shows level lines of the total
     (the band bold, then +2, +5 and +10 %), each labelled. Never the average position (PLAN.md Defaults).
   - Why? (show me, ctx.play): equal pulls from your spot, laid head to tail; the spot follows the leftover
     pull to the best spot, where the chain closes; the farthest target slides away and the best spot
     stays put. Reduced motion: the runner's keyframes. A tap on the board steps on when the player
     offers ctx.playCmd.
   - The Watch (demo): count the column and the row, balance the pulls, and, once, the average position
     dragged towards the far target: the only place the average is drawn (the WATCH-ONLY block). */
(function (PX) {
  'use strict';

  var timing = PX.core.timing, h = PX.ui.h, S2 = PX.core.svg;
  var N = 13, LAST = 12, F = 2, M = 1.3, VBS = LAST + 2 * M;   // half-steps; the margin round the outer dots
  // The plate's units: geometry is drawn in half-steps inside one group scaled by U, and every label
  // undoes that scale, so its font size is an ordinary 12–14 px: a minimum font size (an Android
  // WebView's) can then never blow up a label written at 0.6 units.
  var U = 20;
  var R_DOT = 0.13, R_TGT = 0.44, R_MARK = 0.36, R_HALF = 0.075, R_BEST = 0.62;
  var GRAB = 1.05;      // half-steps (about 24 px on a phone): a tap this close to the marker answers (quick) or grabs it (exact)
  var MOVE_TOL = 0.6;   // half-steps: a press that moves farther is a drag, not a tap
  var uid = 0;

  function lib() { var d = PX.ex.get('centralpoint'); return (d && d.lib) || {}; }
  function cap(key, vars) {
    var L = PX.ex.learn('centralpoint') || {}, s = String((L.captions || {})[key] || '');
    for (var k in vars || {}) if (Object.prototype.hasOwnProperty.call(vars, k)) s = s.split('{' + k + '}').join(vars[k]);
    return s;
  }
  function isNum(v) { return typeof v === 'number' && isFinite(v); }
  function isPt(r) { return !!r && typeof r === 'object' && isNum(r.x) && isNum(r.y) && r.x >= 0 && r.y >= 0 && r.x <= LAST && r.y <= LAST; }
  function E(tag, attrs, kids) { return S2.el(tag, attrs, kids); }
  function clear(g) { while (g && g.firstChild) g.removeChild(g.firstChild); }
  function clampN(v) { return v < 0 ? 0 : v > LAST ? LAST : v; }
  function snap(fx, fy) { return { x: clampN(Math.round(fx)), y: clampN(Math.round(fy)) }; }
  // Dot terms for people: columns and rows 1–7, half-way points as "2½".
  function dotWord(v) { var d = v / F + 1, w = Math.floor(d); return d === w ? String(w) : w + '½'; }
  function oneDec(v) { return (Math.round(v * 10) / 10).toFixed(1); }
  function pctText(e) { var p = e * 100; return p >= 10 ? p.toFixed(0) : p >= 1 ? p.toFixed(1) : p.toFixed(2); }

  /* ---------- mount: the plate, its layers and the controls ---------- */
  var st = null;
  function mount(ctx) {
    var id = 'cp' + (++uid);
    var svg = E('svg', { viewBox: [-M * U, -M * U, VBS * U, VBS * U], preserveAspectRatio: 'xMidYMid meet', class: 'ex-cp-board', 'aria-hidden': 'true', focusable: 'false' });
    var world = E('g', { transform: 'scale(' + U + ')' });
    var defs = E('defs', null, E('clipPath', { id: id + '-clip' }, E('rect', { x: -M, y: -M, width: VBS, height: VBS })));
    var L = {};
    svg.appendChild(defs);
    svg.appendChild(world);
    ['grid', 'map', 'assist', 'lines', 'band', 'halfs', 'targets', 'best', 'marker', 'over', 'labels'].forEach(function (n) {
      L[n] = E('g', { class: 'ex-cp-' + n });
      world.appendChild(L[n]);
    });
    L.map.setAttribute('clip-path', 'url(#' + id + '-clip)');
    L.over.setAttribute('clip-path', 'url(#' + id + '-clip)');
    for (var y = 0; y <= LAST; y += F) for (var x = 0; x <= LAST; x += F) L.grid.appendChild(E('circle', { cx: x, cy: y, r: R_DOT, class: 'ex-cp-dot' }));
    var stage = h('div.ex-stage.ex-cp-stage', svg);
    var live = h('p.px-sr', { 'aria-live': 'polite' });
    var sr = h('p.px-sr');
    function nudge(dx, dy, key, glyph) {
      var b = h('button.px-btn.px-btn--secondary.ex-cp-nudge', { type: 'button', 'aria-label': cap(key), 'data-nudge': dx + ',' + dy }, glyph);
      b.addEventListener('click', function (e) { if (!canInput()) return; st.input = inputOf(e); move(dx, dy); });
      return b;
    }
    var nudges = h('div.ex-cp-nudges', nudge(-1, 0, 'nudgeLeft', '◀'), nudge(0, -1, 'nudgeUp', '▲'), nudge(0, 1, 'nudgeDown', '▼'), nudge(1, 0, 'nudgeRight', '▶'));
    var confirmBtn = PX.ui.button(cap('confirm') || 'Confirm', { kind: 'primary', className: 'ex-cp-confirm', disabled: true, onClick: function (e) { if (canInput()) confirm(inputOf(e)); } });
    confirmBtn.setAttribute('aria-keyshortcuts', 'Enter');
    var controls = h('div.ex-cp-controls', nudges, confirmBtn);
    var hint = h('p.ex-cp-hint.px-meta');
    var mapBtn = PX.ui.button(cap('map') || 'Map', { kind: 'secondary', small: true, className: 'ex-cp-mapbtn', onClick: function () { setMap(!st.mapOn); } });
    mapBtn.setAttribute('aria-pressed', 'false');
    mapBtn.setAttribute('aria-label', cap('mapLabel') || 'Show lines of equal total distance');
    var totals = h('p.ex-cp-totals.px-num'), verdict = h('p.ex-cp-note');
    var result = h('div.ex-cp-result', { hidden: true }, h('div.ex-cp-result-text', totals, verdict), mapBtn);
    var root = h('div.ex-cp', stage, controls, result, hint, live, sr);
    ctx.host.appendChild(root);
    st = {
      ctx: ctx, root: root, svg: svg, L: L, stage: stage, controls: controls, nudges: nudges, confirmBtn: confirmBtn, hint: hint, live: live, sr: sr,
      result: result, totals: totals, verdict: verdict, mapBtn: mapBtn, item: null, sol: null, marker: null, answering: false, respond: null,
      popKeys: null, press: null, input: null, mapOn: false, late: false, playing: false, markEls: null, revealed: false,
    };
    svg.addEventListener('pointerdown', onDown);
    svg.addEventListener('pointermove', onMove);
    svg.addEventListener('pointerup', onUp);
    svg.addEventListener('pointercancel', onCancel);
    svg.addEventListener('lostpointercapture', onCancel);
  }
  function inputOf(e) {
    if (!e) return 'pointer';
    if (e.pointerType) return e.pointerType;
    return e.detail === 0 ? 'key' : 'mouse'; // a click from Enter or Space on the button has detail 0
  }

  /* ---------- drawing the item ---------- */
  function drawTargets(T, slide) {
    clear(st.L.targets);
    T.forEach(function (t, i) {
      var p = slide && slide.i === i ? slide.p : t;
      st.L.targets.appendChild(E('g', { class: 'ex-cp-target', transform: 'translate(' + p[0] + ' ' + p[1] + ')' }, [
        E('circle', { r: R_TGT, class: 'ex-cp-ring' }), E('circle', { r: 0.1, class: 'ex-cp-pip' }),
      ]));
    });
  }
  function markerGroup() {
    var g = E('g', { class: 'ex-cp-mark' }, [
      E('line', { x1: -0.62, y1: 0, x2: 0.62, y2: 0, class: 'ex-cp-hair' }), E('line', { x1: 0, y1: -0.62, x2: 0, y2: 0.62, class: 'ex-cp-hair' }),
      E('circle', { r: R_MARK, class: 'ex-cp-disc' }), E('circle', { r: 0.09, class: 'ex-cp-centre' }),
    ]);
    return g;
  }
  // The marker at an answer point (or at continuous coordinates in a demo), with faint answer points round it.
  function drawMarker(p, label) {
    clear(st.L.marker); clear(st.L.halfs);
    if (!p) return;
    var g = markerGroup();
    g.setAttribute('transform', 'translate(' + p.x + ' ' + p.y + ')');
    st.L.marker.appendChild(g);
    if (label) st.L.marker.appendChild(labelAt(p.x + 0.75, p.y - 0.75, label, 'ex-cp-youlabel'));
    if (Math.round(p.x) !== p.x || Math.round(p.y) !== p.y) return;
    for (var dy = -2; dy <= 2; dy++) for (var dx = -2; dx <= 2; dx++) {
      var x = p.x + dx, y = p.y + dy;
      if ((!dx && !dy) || x < 0 || y < 0 || x > LAST || y > LAST || (x % F === 0 && y % F === 0)) continue;
      st.L.halfs.appendChild(E('circle', { cx: x, cy: y, r: R_HALF, class: Math.max(Math.abs(dx), Math.abs(dy)) === 1 ? 'ex-cp-half' : 'ex-cp-half is-far' }));
    }
  }
  function labelAt(x, y, text, cls) {
    return E('text', { x: x * U, y: y * U, transform: 'scale(' + (1 / U) + ')', class: 'ex-cp-label ' + (cls || ''), 'text-anchor': 'middle', 'dominant-baseline': 'central' }, text);
  }
  // Try 1's first step: the kite's two diagonals (each pair of targets with the best point between them).
  function drawAssist(item, kind) {
    clear(st.L.assist);
    if (kind !== 'diagonals' || !item || item.task !== 'kite') return;
    var T = item.targets, k = item.key, used = {};
    for (var i = 0; i < T.length; i++) for (var j = i + 1; j < T.length; j++) {
      if (used[i] || used[j]) continue;
      var ax = T[i][0] - k.x, ay = T[i][1] - k.y, bx = T[j][0] - k.x, by = T[j][1] - k.y;
      if (ax * by - ay * bx !== 0 || ax * bx + ay * by >= 0) continue; // on one line, on opposite sides of the best point
      used[i] = used[j] = true;
      st.L.assist.appendChild(E('line', { x1: T[i][0], y1: T[i][1], x2: T[j][0], y2: T[j][1], class: 'ex-cp-diag' }));
    }
  }
  function resetOverlays() {
    ['map', 'assist', 'lines', 'band', 'halfs', 'best', 'marker', 'over', 'labels'].forEach(function (n) { clear(st.L[n]); });
  }
  function describe(item) {
    var list = item.targets.map(function (t) { return cap('targetAt', { x: dotWord(t[0]), y: dotWord(t[1]) }); }).join('; ');
    st.sr.textContent = cap('describe', { n: item.targets.length, list: list });
  }

  /* ---------- present ---------- */
  function present(item, ctx) {
    st.item = item; st.sol = null; st.marker = null; st.answering = false; st.respond = null; st.press = null;
    st.late = false; st.revealed = false; st.playing = false;
    if (st.popKeys) { st.popKeys(); st.popKeys = null; }
    resetOverlays();
    drawTargets(item.targets);
    drawAssist(item, ctx && ctx.assist);
    var exact = item.form === 'exact';
    st.root.setAttribute('data-form', exact ? 'exact' : 'quick');
    st.nudges.hidden = !exact;
    st.controls.hidden = false;
    st.result.hidden = true;
    st.confirmBtn.disabled = true;
    st.hint.textContent = (exact ? cap('hintExact') : cap('hintQuick')) + (ctx && ctx.settings && ctx.settings.keyHints === false ? '' : ' ' + cap('hintKeys'));
    st.live.textContent = '';
    describe(item);
    return timing.nextPaint();
  }

  /* ---------- input ---------- */
  function paused() { return !!(st.root.closest && st.root.closest('[data-paused]')); }
  function canInput() { return !!(st && st.answering && !st.playing && !paused()); }
  function setMarker(p, quiet) {
    st.marker = p ? { x: p.x, y: p.y } : null;
    drawMarker(st.marker, null);
    st.confirmBtn.disabled = !st.marker;
    if (!quiet) st.live.textContent = st.marker ? cap('markerAt', { x: dotWord(st.marker.x), y: dotWord(st.marker.y) }) : cap('markerNone');
  }
  function move(dx, dy) {
    var p = st.marker || { x: 6, y: 6 };
    setMarker(st.marker ? { x: clampN(p.x + dx), y: clampN(p.y + dy) } : p);
  }
  function confirm(input) {
    if (!canInput() || !st.marker) return;
    st.answering = false;
    var ok = st.respond ? st.respond({ x: st.marker.x, y: st.marker.y }, { input: input || st.input || 'pointer' }) : false;
    if (ok === false) st.answering = true; // the player did not take it (a pause): the marker stays live
  }
  function boardPoint(e) {
    var r = st.svg.getBoundingClientRect();
    if (!r.width || !r.height) return null;
    return { fx: -M + (e.clientX - r.left) / r.width * VBS, fy: -M + (e.clientY - r.top) / r.height * VBS };
  }
  function near(p, q) { return Math.sqrt((p.fx - q.x) * (p.fx - q.x) + (p.fy - q.y) * (p.fy - q.y)) <= GRAB; }
  function onDown(e) {
    if (st.playing && typeof st.ctx.playCmd === 'function') { e.preventDefault(); st.ctx.playCmd('step'); return; } // a tap steps a show-me on
    if (!canInput() || (e.button !== undefined && e.button > 0)) return;
    var p = boardPoint(e);
    if (!p) return;
    e.preventDefault();
    st.input = inputOf(e);
    try { st.svg.setPointerCapture(e.pointerId); } catch (err) { /* optional */ }
    var on = st.marker && near(p, st.marker);
    if (on && st.item.form === 'exact') st.press = { id: e.pointerId, mode: 'grab', ox: st.marker.x - p.fx, oy: st.marker.y - p.fy, x0: p.fx, y0: p.fy };
    else if (on) st.press = { id: e.pointerId, mode: 'confirm', x0: p.fx, y0: p.fy };
    else { st.press = { id: e.pointerId, mode: 'place', x0: p.fx, y0: p.fy }; setMarker(snap(p.fx, p.fy)); }
  }
  function onMove(e) {
    var pr = st && st.press;
    if (!pr || pr.id !== e.pointerId || !canInput()) return;
    var p = boardPoint(e);
    if (!p) return;
    var far = Math.sqrt((p.fx - pr.x0) * (p.fx - pr.x0) + (p.fy - pr.y0) * (p.fy - pr.y0)) > MOVE_TOL;
    if (pr.mode === 'confirm') { if (!far) return; pr.mode = 'place'; }
    var q = pr.mode === 'grab' ? snap(p.fx + pr.ox, p.fy + pr.oy) : snap(p.fx, p.fy);
    if (!st.marker || q.x !== st.marker.x || q.y !== st.marker.y) setMarker(q, true);
  }
  function onUp(e) {
    var pr = st && st.press;
    if (!pr || pr.id !== e.pointerId) return;
    st.press = null;
    if (!canInput()) return;
    if (pr.mode === 'confirm') confirm(st.input);
    else if (st.marker) st.live.textContent = cap('markerAt', { x: dotWord(st.marker.x), y: dotWord(st.marker.y) });
  }
  function onCancel(e) { if (st && st.press && (!e || e.pointerId === st.press.id)) st.press = null; }

  /* ---------- collect and the deadline ---------- */
  function collect(item, ctx, respond) {
    if (!st || st.item !== item) return;
    st.respond = respond;
    st.answering = true;
    if (st.popKeys) st.popKeys();
    function arrow(dx, dy) { return function () { if (!canInput()) return false; st.input = 'key'; move(dx, dy); }; }
    st.popKeys = ctx.keys.push({
      ArrowLeft: arrow(-1, 0), ArrowRight: arrow(1, 0), ArrowUp: arrow(0, -1), ArrowDown: arrow(0, 1),
      Enter: function () { if (!canInput() || !st.marker) return false; confirm('key'); },
      repeat: ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'],
    }, { through: true });
  }
  // At the quick deadline the player takes a placed marker (scored for its closeness, a time-out for
  // the rating), or nothing (CONTRACT-v1.2 E).
  function atDeadline(item) {
    if (!st || st.item !== item || !st.marker) return null;
    st.answering = false; st.late = true; st.press = null;
    return { x: st.marker.x, y: st.marker.y };
  }
  function stopInput() {
    st.answering = false; st.press = null;
    if (st.popKeys) { st.popKeys(); st.popKeys = null; }
  }

  /* ---------- reveal: lines and lengths, the best spot, the band, the map ---------- */
  function solved(item) {
    if (!st.sol || st.sol.item !== item) st.sol = { item: item, s: lib().solve(item) };
    return st.sol.s;
  }
  function isLatticePt(r) { return isPt(r) && Math.round(r.x) === r.x && Math.round(r.y) === r.y; }
  function drawBest(item, s) {
    clear(st.L.best);
    var k = item.key, g = item.gm;
    st.L.best.appendChild(E('circle', { cx: k.x, cy: k.y, r: R_BEST, class: 'ex-cp-bestring' }));
    st.L.best.appendChild(labelAt(k.x - 0.85, k.y + 0.95, cap('best') || 'best', 'ex-cp-bestlabel'));
    if (Math.abs(g[0] - k.x) + Math.abs(g[1] - k.y) > 0.08) { // the continuous best spot lies between answer points
      st.L.best.appendChild(E('path', { d: 'M' + (g[0] - 0.2) + ' ' + (g[1] - 0.2) + 'L' + (g[0] + 0.2) + ' ' + (g[1] + 0.2) + 'M' + (g[0] - 0.2) + ' ' + (g[1] + 0.2) + 'L' + (g[0] + 0.2) + ' ' + (g[1] - 0.2), class: 'ex-cp-cross' }));
    }
  }
  function drawBand(item, s) {
    clear(st.L.band);
    s.band.forEach(function (q) {
      var x = q % N, y = (q - x) / N;
      if (x === item.key.x && y === item.key.y) return;
      st.L.band.appendChild(E('rect', { x: x - 0.14, y: y - 0.14, width: 0.28, height: 0.28, class: 'ex-cp-bandpt' }));
    });
  }
  // Lines from a spot to every target, each labelled with its length in dots (one decimal).
  function drawLines(T, from) {
    clear(st.L.lines); clear(st.L.labels);
    T.forEach(function (t, i) {
      var dx = t[0] - from.x, dy = t[1] - from.y, d = Math.sqrt(dx * dx + dy * dy);
      if (d < 1e-9) return;
      st.L.lines.appendChild(E('line', { x1: from.x, y1: from.y, x2: t[0], y2: t[1], class: 'ex-cp-line' }));
      var ux = dx / d, uy = dy / d, side = i % 2 ? 1 : -1, at = d < 2.4 ? 0.5 : 0.6;
      var lx = from.x + dx * at - uy * 0.42 * side, ly = from.y + dy * at + ux * 0.42 * side;
      st.L.labels.appendChild(labelAt(lx, ly, oneDec(d / F), 'ex-cp-len'));
    });
  }
  function bandWord(b) { return String(Math.round(b * 10000) / 100); }
  function reveal(item, response, result) {
    if (!st || st.item !== item) return Promise.resolve();
    stopInput();
    st.revealed = true;
    var s = solved(item), spot = isLatticePt(response) ? { x: response.x, y: response.y } : null, best = s.best;
    drawBest(item, s);
    drawBand(item, s);
    drawLines(item.targets, spot || item.key);
    drawMarker(spot, spot ? cap('you') : null);
    var e = spot ? Math.max(0, s.S[spot.y * N + spot.x] / best - 1) : null;
    if (!spot) st.totals.textContent = cap('totalsNone', { best: oneDec(best / F) });
    else if (e < 1e-12) st.totals.textContent = cap('totalsBest', { best: oneDec(best / F) });
    else st.totals.textContent = cap('totals', { you: oneDec(s.S[spot.y * N + spot.x] / F), best: oneDec(best / F), pct: pctText(e) });
    var late = !!(result && result.late) || st.late;
    st.verdict.textContent = !spot ? cap('noAnswer') : late ? cap('late') : e <= item.band ? cap('within', { band: bandWord(item.band) }) : cap('outside', { band: bandWord(item.band) });
    st.controls.hidden = true;
    st.result.hidden = false;
    clear(st.L.map);
    if (st.mapOn) drawMap(item, s);
    return Promise.resolve();
  }
  // Level lines of the total: the band (bold, over a pale fill), then +2, +5 and +10 % (those wider
  // than the band), each labelled; drawn from lib.contour round the best spot and clipped to the plate.
  function drawMap(item, s) {
    clear(st.L.map);
    var L = lib(), levels = [item.band].concat([0.02, 0.05, 0.10].filter(function (x) { return x > item.band + 1e-12; }));
    var names = [];
    for (var i = levels.length - 1; i >= 0; i--) {
      var pts = L.contour(item.targets, item.gm, s.best * (1 + levels[i]), 72), isBand = i === 0;
      st.L.map.appendChild(E('path', { d: S2.pathData(pts, true), class: 'ex-cp-contour' + (isBand ? ' is-band' : '') }));
      var lp = pts[Math.round(pts.length * 7 / 8) % pts.length];
      st.L.map.appendChild(labelAt(clampN(lp[0]) + 0.15, Math.max(-0.6, lp[1]) - 0.15, isBand ? (cap('bandLine') || 'band') : '+' + Math.round(levels[i] * 100) + ' %', 'ex-cp-maplabel' + (isBand ? ' is-band' : '')));
      if (!isBand) names.unshift('+' + Math.round(levels[i] * 100) + ' %');
    }
    st.mapBtn.setAttribute('title', cap('contourNote', { levels: names.join(', ') }));
  }
  function setMap(on) {
    st.mapOn = !!on;
    st.mapBtn.setAttribute('aria-pressed', st.mapOn ? 'true' : 'false');
    st.mapBtn.firstChild.textContent = st.mapOn ? (cap('hideMap') || 'Hide map') : (cap('map') || 'Map');
    if (!st.revealed || !st.item) return;
    if (st.mapOn) drawMap(st.item, solved(st.item)); else clear(st.L.map);
  }

  /* ---------- equal pulls (Why? and the Watch) ---------- */
  // Unit pulls from p to every target (null on a target), in order of direction, so that laid head to
  // tail they make a convex chain that closes exactly where they cancel.
  function sortedPulls(T, p) {
    var pu = lib().pulls(T, p.x, p.y), out = [];
    pu.u.forEach(function (u, i) { if (u) out.push({ i: i, u: u, a: Math.atan2(u[1], u[0]) }); });
    out.sort(function (a, b) { return a.a - b.a; });
    return { list: out, sum: pu.sum };
  }
  function arrow(x1, y1, x2, y2, cls, scale) {
    var dx = x2 - x1, dy = y2 - y1, d = Math.sqrt(dx * dx + dy * dy);
    if (d < 1e-6) return null;
    var ux = dx / d, uy = dy / d, hl = Math.min(0.26 * (scale || 1), d * 0.45), hw = hl * 0.55;
    var bx = x2 - ux * hl, by = y2 - uy * hl;
    return E('path', { d: 'M' + x1 + ' ' + y1 + 'L' + bx + ' ' + by + 'M' + x2 + ' ' + y2 + 'L' + (bx - uy * hw) + ' ' + (by + ux * hw) + 'L' + (bx + uy * hw) + ' ' + (by - ux * hw) + 'Z', class: cls });
  }
  // mode 'fan': arrows grow from p (k: 0 → 1); 'chain': they slide from the fan into a head-to-tail
  // chain (k: 0 → 1) and the leftover pull is drawn from p to the chain's end.
  function drawPulls(T, p, mode, k, A) {
    clear(st.L.over);
    var sp = sortedPulls(T, p), cx = p.x, cy = p.y;
    sp.list.forEach(function (o) {
      var sx = p.x, sy = p.y;
      if (mode === 'chain') { sx = p.x + (cx - p.x) * k; sy = p.y + (cy - p.y) * k; }
      var len = mode === 'fan' ? A * k : A;
      var a = arrow(sx, sy, sx + o.u[0] * len, sy + o.u[1] * len, 'ex-cp-pull');
      if (a) st.L.over.appendChild(a);
      cx += o.u[0] * A; cy += o.u[1] * A;
    });
    if (mode === 'chain' && k >= 1) {
      var gap = Math.sqrt(sp.sum[0] * sp.sum[0] + sp.sum[1] * sp.sum[1]) * A;
      if (gap > 0.12) { var lo = arrow(p.x, p.y, p.x + sp.sum[0] * A, p.y + sp.sum[1] * A, 'ex-cp-leftover'); if (lo) st.L.over.appendChild(lo); }
      else st.L.over.appendChild(E('circle', { cx: p.x, cy: p.y, r: 0.3, class: 'ex-cp-closed' }));
    }
  }
  // The way down: small steps along the leftover pull from p until near the best spot, then straight in.
  function flowPath(T, p, g) {
    var pts = [[p.x, p.y]], x = p.x, y = p.y;
    for (var i = 0; i < 400; i++) {
      var dx = g[0] - x, dy = g[1] - y;
      if (dx * dx + dy * dy < 0.09) break;
      var s = lib().pulls(T, x, y).sum, n = Math.sqrt(s[0] * s[0] + s[1] * s[1]);
      if (n < 1e-9) break;
      x += 0.1 * s[0] / n; y += 0.1 * s[1] / n;
      pts.push([x, y]);
    }
    pts.push([g[0], g[1]]);
    return pts;
  }
  function along(pts, k) {
    var lens = [0], tot = 0, i;
    for (i = 1; i < pts.length; i++) { tot += Math.sqrt(Math.pow(pts[i][0] - pts[i - 1][0], 2) + Math.pow(pts[i][1] - pts[i - 1][1], 2)); lens.push(tot); }
    var want = tot * Math.max(0, Math.min(1, k));
    for (i = 1; i < pts.length; i++) if (lens[i] >= want) {
      var f = lens[i] > lens[i - 1] ? (want - lens[i - 1]) / (lens[i] - lens[i - 1]) : 1;
      return { x: pts[i - 1][0] + (pts[i][0] - pts[i - 1][0]) * f, y: pts[i - 1][1] + (pts[i][1] - pts[i - 1][1]) * f };
    }
    return { x: pts[pts.length - 1][0], y: pts[pts.length - 1][1] };
  }
  // The farthest target slides along the line from the best spot through it: outwards to the plate's
  // edge when there is room, else halfway in. Its pull keeps its direction, so the best spot stays put.
  function slidePlan(T, g) {
    var far = 0, fd = -1;
    T.forEach(function (t, i) { var d = Math.sqrt(Math.pow(t[0] - g[0], 2) + Math.pow(t[1] - g[1], 2)); if (d > fd) { fd = d; far = i; } });
    var ux = (T[far][0] - g[0]) / fd, uy = (T[far][1] - g[1]) / fd, room = Infinity;
    if (ux > 1e-9) room = Math.min(room, (LAST - T[far][0]) / ux); else if (ux < -1e-9) room = Math.min(room, -T[far][0] / ux);
    if (uy > 1e-9) room = Math.min(room, (LAST - T[far][1]) / uy); else if (uy < -1e-9) room = Math.min(room, -T[far][1] / uy);
    var by = room >= 1.5 ? Math.min(room, 6) : -fd / 2;
    return { i: far, from: T[far], to: [T[far][0] + ux * by, T[far][1] + uy * by] };
  }
  function slidTargets(T, plan, k) {
    var out = T.map(function (t) { return t.slice(); });
    out[plan.i] = [plan.from[0] + (plan.to[0] - plan.from[0]) * k, plan.from[1] + (plan.to[1] - plan.from[1]) * k];
    return out;
  }
  function play(steps, ctx) {
    st.playing = true;
    var done = function () { if (st) st.playing = false; };
    if (ctx && typeof ctx.play === 'function') return ctx.play(steps).then(done, done);
    steps.forEach(function (s) { if (s.enter) s.enter(); if (s.update) s.update(1); if (s.exit) s.exit(); });
    done();
    return Promise.resolve();
  }

  /* ---------- Why? (show me) ---------- */
  function showMe(item, response, ctx) {
    if (!st || st.item !== item) return Promise.resolve();
    var T = item.targets, g = item.gm, A = Math.min(1.3, 7 / T.length);
    var start = isLatticePt(response) ? { x: response.x, y: response.y } : { x: 6, y: 6 };
    var path = flowPath(T, start, g), plan = slidePlan(T, g), gp = { x: g[0], y: g[1] };
    st.root.classList.add('is-why');
    var steps = [
      { ms: 2400, caption: cap('whyPulls'), enter: function () { drawTargets(T); drawMarker(start); }, update: function (k) { drawPulls(T, start, 'fan', k, A); } },
      { ms: 2600, caption: cap('whyChain'), enter: function () { drawTargets(T); drawMarker(start); }, update: function (k) { drawPulls(T, start, 'chain', k, A); } },
      { ms: 3000, caption: cap('whyMove'), enter: function () { drawTargets(T); }, update: function (k) { var p = along(path, k); drawMarker(p); drawPulls(T, p, 'chain', 1, A); } },
      { ms: 1800, caption: cap('whyBalanced'), enter: function () { drawTargets(T); drawMarker(gp); drawPulls(T, gp, 'chain', 1, A); } },
      { ms: 2600, caption: cap('whySlide'), enter: function () { drawMarker(gp); }, update: function (k) { var T2 = slidTargets(T, plan, k); drawTargets(T2); drawPulls(T2, gp, 'chain', 1, A); } },
      { ms: 1600, caption: cap('whyBack'), enter: function () { drawMarker(gp); }, update: function (k) { var T2 = slidTargets(T, plan, 1 - k); drawTargets(T2); drawPulls(T2, gp, 'chain', 1, A); } },
    ];
    return play(steps, ctx).then(function () {
      if (!st || st.item !== item) return;
      st.root.classList.remove('is-why');
      clear(st.L.over);
      drawTargets(T);
      drawMarker(isLatticePt(response) ? response : null, isLatticePt(response) ? cap('you') : null);
    });
  }

  /* ---------- the rules card's pictures (CONTRACT-v1.2 D: view.drawRule; about 96 px) ---------- */
  function drawRule(el, fig) {
    var g = E('svg', { viewBox: [0, 0, 100, 100], class: 'ex-cp-rulefig', 'aria-hidden': 'true', focusable: 'false' });
    function ring(x, y) { g.appendChild(E('circle', { cx: x, cy: y, r: 7, class: 'ex-cp-ring' })); g.appendChild(E('circle', { cx: x, cy: y, r: 1.8, class: 'ex-cp-pip' })); }
    function mark(x, y) {
      var m = markerGroup();
      m.setAttribute('transform', 'translate(' + x + ' ' + y + ') scale(15)');
      g.appendChild(m);
    }
    var tg = [[18, 22], [80, 16], [26, 82], [86, 74]], sp = [46, 46];
    if (fig === 'lines' || fig === 'pulls') {
      tg.forEach(function (t) {
        if (fig === 'lines') g.appendChild(E('line', { x1: sp[0], y1: sp[1], x2: t[0], y2: t[1], class: 'ex-cp-line' }));
        else {
          var dx = t[0] - sp[0], dy = t[1] - sp[1], d = Math.sqrt(dx * dx + dy * dy);
          g.appendChild(arrow(sp[0], sp[1], sp[0] + dx / d * 22, sp[1] + dy / d * 22, 'ex-cp-pull', 15));
        }
        ring(t[0], t[1]);
      });
      mark(sp[0], sp[1]);
    } else if (fig === 'tap') {
      for (var y = 20; y <= 80; y += 15) for (var x = 20; x <= 80; x += 15) {
        var dot = ((x - 20) / 15) % 2 === 0 && ((y - 20) / 15) % 2 === 0;
        g.appendChild(E('circle', { cx: x, cy: y, r: dot ? 3 : 1.6, class: dot ? 'ex-cp-dot' : 'ex-cp-half' }));
      }
      mark(65, 35);
      g.appendChild(E('circle', { cx: 65, cy: 35, r: 13, class: 'ex-cp-tapring' }));
    } else if (fig === 'bar') {
      g.appendChild(E('rect', { x: 10, y: 44, width: 80, height: 12, rx: 2, class: 'ex-cp-bartrack' }));
      g.appendChild(E('rect', { x: 10, y: 44, width: 46, height: 12, rx: 2, class: 'ex-cp-barfill' }));
      g.appendChild(E('text', { x: 50, y: 74, class: 'ex-cp-label ex-cp-barlabel', 'text-anchor': 'middle', 'dominant-baseline': 'central' }, cap('ruleBar') || 'time left'));
    } else return;
    el.appendChild(h('div.ex-centralpoint.ex-cp-rule', g));
  }

  /* WATCH-ONLY: the average */
  // The Watch (the tutorial demo, the same for every player): count the column and the row for a first
  // guess, balance the pulls to the best spot, then, once, the average position dragged towards the far
  // target, the declared exception of PLAN.md Defaults. The average is drawn nowhere else.
  function median1(v) { var s = v.slice().sort(function (a, b) { return a - b; }), n = s.length; return n % 2 ? s[(n - 1) / 2] : (s[n / 2 - 1] + s[n / 2]) / 2; }
  function demo(item, ctx) {
    if (!st || st.item !== item) return Promise.resolve();
    var T = item.targets, g = item.gm, A = Math.min(1.3, 7 / T.length), gp = { x: g[0], y: g[1] };
    var c = { x: median1(T.map(function (t) { return t[0]; })), y: median1(T.map(function (t) { return t[1]; })) };
    var avg = lib().mean(T), path = flowPath(T, c, g), exact = item.form === 'exact';
    function line(x1, y1, x2, y2, k) { st.L.over.appendChild(E('line', { x1: x1, y1: y1, x2: x1 + (x2 - x1) * k, y2: y1 + (y2 - y1) * k, class: 'ex-cp-countline' })); }
    function cross(kc, kr) { clear(st.L.over); line(c.x, -M, c.x, LAST + M, kc); if (kr > 0) line(-M, c.y, LAST + M, c.y, kr); }
    var steps = [
      { ms: 2200, caption: cap('demoTargets'), enter: function () { resetOverlays(); drawTargets(T); } },
      { ms: 2400, caption: cap('demoCount'), update: function (k) { cross(k, 0); } },
      { ms: 2400, caption: cap('demoCountRow'), update: function (k) { cross(1, k); drawMarker(k >= 0.7 ? c : null); } },
      { ms: 2400, caption: cap('demoPulls'), enter: function () { drawMarker(c); }, update: function (k) { drawPulls(T, c, 'fan', k, A); } },
      { ms: 2400, caption: cap('demoChain'), update: function (k) { drawPulls(T, c, 'chain', k, A); } },
      { ms: 2800, caption: cap('demoMove'), update: function (k) { var p = along(path, k); drawMarker(p); drawPulls(T, p, 'chain', 1, A); } },
      { ms: 2000, caption: cap('demoBalanced'), enter: function () { drawMarker(gp); drawPulls(T, gp, 'chain', 1, A); } },
      { ms: 2600, caption: cap('demoAverage'), enter: function () { clear(st.L.over); drawMarker(gp); }, update: function (k) {
        clear(st.L.over);
        var ax = g[0] + (avg[0] - g[0]) * k, ay = g[1] + (avg[1] - g[1]) * k;
        st.L.over.appendChild(E('line', { x1: g[0], y1: g[1], x2: ax, y2: ay, class: 'ex-cp-avgline' }));
        st.L.over.appendChild(E('path', { d: 'M' + ax + ' ' + (ay - 0.45) + 'L' + (ax + 0.45) + ' ' + ay + 'L' + ax + ' ' + (ay + 0.45) + 'L' + (ax - 0.45) + ' ' + ay + 'Z', class: 'ex-cp-avgmark' }));
        if (k >= 1) st.L.over.appendChild(labelAt(ax + 1.2, ay + 0.7, cap('averageLabel') || 'average', 'ex-cp-avglabel'));
      } },
      { ms: 2400, caption: exact ? cap('demoAnswerExact') : cap('demoAnswerQuick'), enter: function () { clear(st.L.over); drawMarker(null); } },
    ];
    return play(steps, ctx).then(function () {
      if (!st || st.item !== item) return;
      clear(st.L.over); drawTargets(T); setMarker(null, true);
    });
  }
  /* END WATCH-ONLY */

  function unmount() {
    if (!st) return;
    stopInput();
    st.svg.removeEventListener('pointerdown', onDown);
    st.svg.removeEventListener('pointermove', onMove);
    st.svg.removeEventListener('pointerup', onUp);
    st.svg.removeEventListener('pointercancel', onCancel);
    st.svg.removeEventListener('lostpointercapture', onCancel);
    if (st.root.parentNode) st.root.parentNode.removeChild(st.root);
    st = null;
  }

  PX.ex.view('centralpoint', {
    layout: 'custom', css: true,
    mount: mount, present: present, collect: collect, atDeadline: atDeadline, reveal: reveal,
    showMe: showMe, demo: demo, drawRule: drawRule, unmount: unmount,
    // where the marker is (tests and the harness): null before the first tap
    marker: function () { return st && st.marker ? { x: st.marker.x, y: st.marker.y } : null; },
  });
})(window.PX);
