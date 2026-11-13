/* EX-12 Reckon (experimental): view (3D through PX.core.stage3d and the first-person kit of
   js/ex/homing/view.js, PX.ex.view('homing').kit; design: docs/research/v1.1/R1-path-integration.md §7,
   §8). layout 'custom', needs 'webgl'.
   - present: you stand in the start ring (LEAD_MS), then the passive walk plays: legs and turns with
     raised-cosine ramps at the item's speeds, across a plain with no fix of any kind (the ground marks
     are re-seeded every item, wrap round you and, on the last flow level, live about a second). The
     ring hides once you leave it, for good. Pause (Esc, or the player's pause sheet) freezes the walk
     and voids the item. present resolves with the paint timestamp of the first answer frame.
   - collect, body frame only (the top of the circle is the way you face now):
       point / heading: turn (drag the view, the circle, ◀5° ◀1° 1°▶ 5°▶, ← → with Shift for 1°), Confirm;
       return: turn, then hold Walk (↑) to walk straight on, Back (↓) to step back, Here (Enter) to stop;
               turning locks while you are away from the route's end (Back to it to turn again);
       distance: hold Walk to walk the same distance again (no turning), Here.
     The walk back runs at the item's walkSpeed (1.05–1.95 m/s) with eased starts and stops; no counter
     shows the distance walked. Response: degrees (point, heading) or { x, z } in the frame 'end'.
   - reveal: the flag appears at the start (distance: at the end of the same distance) and the view
     turns to it from where you stand; the circle shows the way back; the feedback names the angle
     error, the distance error, the drift (error per metre walked), named error types and the player's
     own bias over the last 20 routes, with a small chart of the last angle errors.
   - show me: the map from above (the kit's mapper) with the believed home vector against the true one.
   The player's own errors are kept in the record field 'reckon' ({ v: 1, hist }, the last HIST_N
   answers; registered here with store.field), read by gen's lib.bias(). */
(function (PX) {
  'use strict';

  var timing = PX.core.timing, h = PX.ui.h, S2 = PX.core.svg;
  var EYE = 1.6, PITCH = -10, HFOV = 70, START_R = 3.5;
  var WALK_TAU = 0.15;     // s: the walk back eases to its speed (no instant starts or stops)
  var BACK_SHARE = 0.6;    // Back moves at this share of the walk speed
  var MAX_WALK = 40;       // m: the walk back stops here
  var HERE_MIN = 0.5;      // m: Here needs at least this much walking
  var CHART_N = 20;
  var VIEW_MIN = 4;        // m: at reveal the view stands at least this far from the flag

  function K() { var v = PX.ex.view('homing'); return v && v.kit ? v.kit : null; }
  function lib() { var d = PX.ex.get('reckon'); return (d && d.lib) || {}; }
  function isNum(v) { return typeof v === 'number' && isFinite(v); }
  function rad(d) { return d * Math.PI / 180; }
  function r1(x) { return Math.round(x * 10) / 10; }
  function cap(key, vars) {
    var L = PX.ex.learn('reckon') || {}, s = String((L.captions || {})[key] || '');
    for (var k in vars || {}) if (Object.prototype.hasOwnProperty.call(vars, k)) s = s.split('{' + k + '}').join(vars[k]);
    return s;
  }

  /* ---------- the player's own errors: the record field 'reckon' ---------- */
  var memHist = [];
  function fixRec(x) {
    if (!x || typeof x !== 'object' || !Array.isArray(x.hist)) return undefined;
    var ok = x.hist.filter(function (e) { return Array.isArray(e) && e.length === 8 && e.every(function (v) { return v === null || isNum(v); }); });
    return { v: 1, hist: ok.slice(-(lib().HIST_N || 40)) };
  }
  try { if (PX.core.store && typeof PX.core.store.field === 'function') PX.core.store.field('reckon', function () { return { v: 1, hist: [] }; }, fixRec); } catch (e) { /* already registered */ }
  function hist() {
    var s = PX.core.store && PX.core.store.state;
    if (!s || typeof s !== 'object') return memHist;
    if (!s.reckon || !Array.isArray(s.reckon.hist)) s.reckon = { v: 1, hist: [] };
    return s.reckon.hist;
  }
  function remember(entry) {
    if (!entry) return;
    var l = hist(), n = lib().HIST_N || 40;
    l.push(entry);
    if (l.length > n) l.splice(0, l.length - n);
  }

  /* ---------- mount ---------- */
  var st = null;
  function live() { return !!(st && st.live && !st.playing); }
  function isReturn(item) { return item && item.answer === 'position'; }
  function canTurn() { return live() && st.item.task !== 'distance' && st.dist < 0.05; }

  function mount(ctx) {
    var kit = K();
    var el = kit.layout(ctx, { id: 'reckon', cap: cap, keysText: cap('hintKeys') });
    el.keysWalk = h('span.ex-fp-keys.ex-reckon-keyswalk', ' ' + cap('hintKeysWalk'));
    el.hint.appendChild(el.keysWalk);
    st = { ctx: ctx, el: el, kit: kit, item: null, value: null, raw: 0, dist: 0, v: 0, dir: 0, live: false, playing: false, done: false, walking: false,
      paused: false, hostPause: false, voided: null, voidStats: null, frames: null, respond: null, popKeys: null, W: null, walkStop: null, input: null, mode: null };
    st.S = kit.stage(ctx, el.stage, { cap: cap, hfov: HFOV, pitch: PITCH, eye: EYE, fog: [18, 190] });
    st.D = kit.dial({ cap: cap, onAngle: function (a, e) { if (canTurn()) setValue(a, 'dial', e); } });
    el.dialbox.appendChild(st.D.svg);
    st.F = kit.fine({ cap: cap, onTurn: function (d, e) { if (canTurn()) turnBy(d, 'fine', e); } });
    kit.turnRow(el, st.F);
    st.M = kit.mapper(st.S, st.D, { cap: cap, landmarks: false, tools: el.tools });
    el.hide.addEventListener('click', function () { st.M.close(); });
    st.confirm = PX.ui.button(cap('confirm') || 'Confirm', { kind: 'primary', key: 'Enter', className: 'ex-fp-confirm', disabled: true,
      onClick: function (e) { st.input = kit.inputOf(e) || st.input; confirm(); } });
    st.back = holdButton(cap('back') || 'Back', 'ex-reckon-back', -1);
    st.walk = holdButton(cap('walk') || 'Walk', 'ex-reckon-walk', 1);
    // no key badge on Here: the button is narrow on phones (the hint line names Enter)
    st.here = PX.ui.button(cap('here') || 'Here', { kind: 'primary', className: 'ex-reckon-here', disabled: true,
      onClick: function (e) { st.input = kit.inputOf(e) || st.input; confirm(); } });
    st.here.setAttribute('aria-keyshortcuts', 'Enter');
    [st.confirm, st.back, st.walk, st.here].forEach(function (b) { el.actions.appendChild(b); });
    kit.drag(el.stage, { enabled: canTurn, onTurn: function (d, e) { turnBy(d, 'drag', e, true); } });
    el.chart = h('div.ex-reckon-chart', { hidden: true });
    el.notes.parentNode.appendChild(el.chart);
    // a held key that loses its keyup (focus moved) stops by itself; keyup stops it at once
    st.onKeyUp = function (e) { if ((e.key === 'ArrowUp' && st.dir > 0) || (e.key === 'ArrowDown' && st.dir < 0)) setDir(0); };
    window.addEventListener('keyup', st.onKeyUp);
    st.onBlur = function () { setDir(0); };
    window.addEventListener('blur', st.onBlur);
    document.addEventListener('visibilitychange', st.onBlur);
  }
  // Walk and Back: hold to move (pointer), keys ↑ ↓ (see collect).
  function holdButton(label, cls, dir) {
    var b = h('button.px-btn.px-btn--secondary.ex-reckon-hold.' + cls, { type: 'button', disabled: true }, label);
    var id = null;
    b.addEventListener('pointerdown', function (e) {
      if (b.disabled || (e.button !== undefined && e.button > 0)) return;
      e.preventDefault();
      id = e.pointerId;
      try { b.setPointerCapture(e.pointerId); } catch (err) { /* optional */ }
      st.input = K().inputOf(e) || st.input;
      st.mode = 'walk';
      setDir(dir);
    });
    function up(e) { if (e.pointerId === id) { id = null; setDir(0); } }
    ['pointerup', 'pointercancel', 'lostpointercapture'].forEach(function (ev) { b.addEventListener(ev, up); });
    b.addEventListener('contextmenu', function (e) { e.preventDefault(); });
    return b;
  }

  /* ---------- the walk ---------- */
  function leadSec() { return (lib().LEAD_MS || 1200) / 1000; }
  function planOf(item) { return lib().homing.plan(item, leadSec()); }
  function endOf(item) { var E = item.path[item.path.length - 1]; return { x: E[0], y: E[1], h: item.heading }; }
  function describe(item) {
    if (item.task === 'heading') return cap('describeHeading');
    if (item.task === 'distance') return cap('describeDistance');
    return cap('describe', { legs: item.legs.length, walk: isReturn(item) ? cap('describeWalk') : '' });
  }
  function voidTrial(reason, stats) {
    if (!st || st.voided) return;
    st.voided = reason;
    st.voidStats = stats || null;
    if (PX.bus) PX.bus.emit('trial:void', { ex: 'reckon', seed: st.item && st.item.seed, reason: reason, stats: stats || null });
    if (st.ctx && typeof st.ctx.voidTrial === 'function') {
      try { st.ctx.voidTrial(reason, stats || null); } catch (e) { if (window.console) console.error('reckon: ctx.voidTrial failed', e); }
    }
    st.el.voidNote.textContent = cap(reason === 'paused' ? 'voidPaused' : reason === 'turned' ? 'voidTurned' : 'voidStutter');
    st.el.voidNote.hidden = false;
  }
  function togglePause() {
    if (!st || !st.walking) return false;
    st.paused = !st.paused;
    st.S.pauseNote.textContent = cap('paused');
    st.S.pauseNote.hidden = !st.paused;
    return undefined;
  }
  function setActions(item) {
    var ret = isReturn(item);
    st.confirm.hidden = ret; st.back.hidden = !ret; st.walk.hidden = !ret; st.here.hidden = !ret;
    st.confirm.disabled = true; st.back.disabled = true; st.walk.disabled = true; st.here.disabled = true;
    st.el.keysWalk.hidden = !ret;
    st.el.root.classList.toggle('is-return', ret);
    st.el.root.classList.toggle('is-distance', item.task === 'distance');
  }

  function present(item, ctx) {
    if (!st) mount(ctx);
    stopInput();
    stopWalkBack();
    if (st.W) { st.W.stop(); st.W = null; }
    st.S.stopLook();
    st.item = item; st.value = null; st.raw = 0; st.dist = 0; st.v = 0; st.dir = 0; st.done = false; st.playing = false; st.respond = null;
    st.voided = null; st.voidStats = null; st.paused = false; st.hostPause = false; st.frames = null; st.input = null; st.mode = null;
    var S = st.S, el = st.el, S0 = item.path[0];
    S.attach();
    S.setPose(S0[0], S0[1], item.startHeading);
    S.setStart(S0[0], S0[1], START_R);
    S.setGround(item.ground);
    st.M.reset();
    st.D.set(null); st.D.key(null); st.D.wedge(null); st.D.mark('');
    el.root.classList.remove('is-revealed', 'is-answering', 'is-walked');
    el.root.classList.add('is-watching');
    setActions(item);
    st.F.disable(true);
    el.readout.textContent = cap('readoutWatch');
    el.verdict.hidden = true; el.notes.hidden = true; el.chart.hidden = true; el.voidNote.hidden = true;
    S.pauseNote.hidden = true;
    S.sub.textContent = '';
    el.phase.textContent = cap('phaseWatch');
    el.desc.textContent = describe(item);
    S.showRing(true);
    S.showFlag(false);
    S.hideStop();
    S.render();
    var popWalkKeys = ctx.keys.push({
      Escape: function () { return togglePause(); },
      Space: function () { return st && st.paused ? togglePause() : false; },
    }, { through: true });
    st.walking = true;
    var ringOn = true;
    return timing.nextPaint().then(function () {
      if (!st || st.item !== item) { popWalkKeys(); return timing.now(); }
      st.W = st.kit.walker(S, planOf(item), {
        ctx: ctx, fast: ctx.fast,
        paused: function () { return !!(st && (st.paused || st.hostPause || st.kit.hostPaused(ctx))); },
        // the ring hides once you have stepped out of it, for good (no fix after the start)
        onFrame: function (pose) { if (ringOn && Math.hypot(pose.x - S0[0], pose.y - S0[1]) > START_R + 0.3) { ringOn = false; S.showRing(false); } },
        onVoid: function (reason, stats) { voidTrial(reason, stats); },
      });
      return st.W.done.then(function (stats) {
        popWalkKeys();
        if (!st || st.item !== item) return timing.now();
        st.frames = stats;
        st.walking = false; st.paused = false;
        S.pauseNote.hidden = true;
        try { ctx.stage3d.noteTrial(!!stats.stutter); } catch (e) { /* quality bookkeeping is optional */ }
        var E = endOf(item);
        S.setPose(E.x, E.y, E.h);
        S.showRing(item.task === 'heading'); // a turn on the spot never leaves the ring
        S.render();
        el.root.classList.remove('is-watching');
        el.phase.textContent = cap(item.task === 'heading' ? 'phaseHeading' : item.task === 'distance' ? 'phaseDistance' : isReturn(item) ? 'phaseReturnTurn' : 'phaseTurn');
        el.readout.textContent = item.task === 'distance' ? '' : cap('readoutNone');
        return timing.nextPaint();
      });
    });
  }

  /* ---------- the answer: turning, walking back ---------- */
  function heading() { return st.item.heading + (st.value === null ? 0 : st.raw); }
  function placeWalker() {
    var E = endOf(st.item), b = heading(), x = E.x + st.dist * Math.sin(rad(b)), y = E.y + st.dist * Math.cos(rad(b));
    st.S.setPose(x, y, b);
  }
  function readout() {
    var t = st.kit.sideText(cap, st.value === null ? 0 : st.value);
    if (live() && isReturn(st.item) && !st.item.task) st.el.phase.textContent = cap(st.dist >= 0.05 ? 'phaseWalk' : 'phaseReturnTurn');
    if (st.item.task === 'distance') st.el.readout.textContent = '';
    else if (st.dist >= 0.05) st.el.readout.textContent = cap('readoutLocked', { dir: t });
    else st.el.readout.textContent = st.value === null ? cap('readoutNone') : cap('readout', { dir: t }) || t;
  }
  function controls() {
    if (!st || !st.item) return;
    var ret = isReturn(st.item), lock = !canTurn();
    st.F.disable(!live() || lock);
    st.D.live = live() && !lock;
    st.el.root.classList.toggle('is-walked', st.dist >= 0.05);
    if (ret) {
      st.walk.disabled = !live();
      st.back.disabled = !live() || st.dist <= 0;
      st.here.disabled = !live() || st.dist < HERE_MIN;
    } else st.confirm.disabled = !live() || st.value === null;
  }
  // mode: 'drag' (the view follows at once), 'dial', 'fine' or 'keys' (eased over 160 ms).
  function setValue(v, mode, e, exact) {
    if (!canTurn()) return;
    st.kit.hintOff(st.S);
    st.raw = exact ? v : Math.round(v);
    st.value = st.kit.norm360(Math.round(st.raw));
    var t = st.kit.sideText(cap, st.value);
    st.D.set(st.value, t);
    st.mode = mode;
    st.input = st.kit.inputOf(e) || (mode === 'keys' ? 'key' : st.input);
    readout();
    controls();
    if (mode === 'drag') { st.S.stopLook(); placeWalker(); st.S.render(); }
    else { var E = endOf(st.item); st.S.lookTo(E.h + st.value, 160); }
  }
  function turnBy(d, mode, e, exact) {
    if (!canTurn()) return false;
    setValue((st.value === null ? 0 : exact ? st.raw : st.value) + d, mode, e, exact);
    return undefined;
  }
  // Walking back: dir +1 (Walk), −1 (Back) or 0; the speed eases to dir × walkSpeed (Back: × BACK_SHARE).
  function setDir(dir) {
    if (!st || !st.item) return;
    if (dir !== 0 && !live()) dir = 0;
    if (dir < 0 && st.dist <= 0) dir = 0;
    st.dir = dir;
    if (dir !== 0) st.kit.hintOff(st.S);
    if (dir !== 0) { if (st.value === null) { st.value = 0; st.raw = 0; st.D.set(0, st.kit.sideText(cap, 0)); } startWalkBack(); }
  }
  function startWalkBack() {
    if (st.walkStop) return;
    st.S.stopLook();
    placeWalker();
    st.walkStop = timing.loop(function (dt) {
      if (!st || !st.item) return false;
      // the player's pause sheet (the item inert and hidden): a finger still on Walk gets no pointerup
      // there, so the walk stops at once and stays where it was
      if (st.kit.hostPaused(st.ctx)) { st.dir = 0; st.v = 0; st.walkStop = null; readout(); controls(); return false; }
      var s = dt / 1000, want = st.dir * st.item.walkSpeed * (st.dir < 0 ? BACK_SHARE : 1);
      st.v += (want - st.v) * Math.min(1, s / WALK_TAU);
      if (st.dir === 0 && Math.abs(st.v) < 0.02) st.v = 0;
      st.dist = Math.max(0, Math.min(MAX_WALK, st.dist + st.v * s));
      if (st.dist <= 0 && st.v < 0) { st.v = 0; st.dir = 0; }
      if (st.dist >= MAX_WALK) { st.v = 0; st.dir = 0; }
      st.S.tick(s);
      placeWalker();
      st.S.render();
      readout();
      controls();
      if (st.dir === 0 && st.v === 0) { st.walkStop = null; return false; }
      return true;
    });
  }
  function stopWalkBack() {
    if (st && st.walkStop) { st.walkStop(); st.walkStop = null; }
    if (st) { st.dir = 0; st.v = 0; }
  }
  // ↑ / ↓ walk while held: keyup (or the window losing focus, or the page hiding) stops it.
  function keyWalk(dir, e) {
    if (!live() || !isReturn(st.item)) return false;
    st.input = 'key'; st.mode = 'walk';
    if (st.dir !== dir) setDir(dir);
    return undefined;
  }
  function response() {
    var item = st.item;
    if (!isReturn(item)) return st.value;
    var a = item.task === 'distance' ? 0 : st.value === null ? 0 : st.value;
    return { x: Math.round(st.dist * Math.sin(rad(a)) * 1000) / 1000, z: Math.round(st.dist * Math.cos(rad(a)) * 1000) / 1000 };
  }
  function confirm() {
    if (!live() || !st.respond) return;
    if (isReturn(st.item) ? st.dist < HERE_MIN : st.value === null) return;
    setDir(0);
    stopWalkBack();
    st.respond(response(), answerMeta());
  }
  function answerMeta() {
    return st ? { frames: st.frames || null, void: st.voided || null, input: st.input || null, mode: st.mode || null, walked: st.item && isReturn(st.item) ? Math.round(st.dist * 100) / 100 : undefined } : null;
  }
  function stopInput() {
    if (!st) return;
    st.kit.hintOff(st.S);
    st.live = false;
    st.D.live = false;
    st.F.disable(true);
    st.el.root.classList.remove('is-answering');
    if (st.popKeys) { st.popKeys(); st.popKeys = null; }
    setDir(0);
    controls();
  }

  function collect(item, ctx, respond) {
    if (!st || st.item !== item) return;
    st.respond = respond;
    st.live = true;
    st.el.root.classList.add('is-answering');
    controls();
    readout();
    if (st.value === null && item.task !== 'distance') st.kit.hintOn(st.S, cap('hintTouch'));
    if (st.popKeys) st.popKeys();
    st.popKeys = ctx.keys.push({
      ArrowLeft: function (e) { return canTurn() ? turnBy(e && e.shiftKey ? -1 : -5, 'keys', e) : live() ? undefined : false; },
      ArrowRight: function (e) { return canTurn() ? turnBy(e && e.shiftKey ? 1 : 5, 'keys', e) : live() ? undefined : false; },
      ArrowUp: function (e) { return keyWalk(1, e); },
      ArrowDown: function (e) { return keyWalk(-1, e); },
      Enter: function () {
        if (!live()) return false;
        if (isReturn(item) ? st.dist < HERE_MIN : st.value === null) { st.el.readout.textContent = cap('setFirst'); return undefined; }
        st.input = 'key';
        confirm();
        return undefined;
      },
      repeat: ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'],
    }, { through: true });
  }

  /* ---------- feedback ---------- */
  function sideOf(a) { return st.kit.side(a); }
  // Named error types (R1 §3.5, §6.4): which shortcut the answer's direction matches, when the key does not.
  function errorHint(item, dir) {
    if (!isNum(dir) || item.task) return '';
    var tol = item.tolDeg, key = item.keyDeg, S = item.turns.reduce(function (a, b) { return a + b; }, 0), ad = st.kit.adiff;
    if (ad(dir, key) <= tol) return '';
    if (ad(dir, key + S) <= tol) return cap('hintNotUpdated');
    if (ad(dir, 360 - key) <= tol) return cap('hintSides');
    if (ad(dir, 180 - S) <= tol && ad(key, 180 - S) > tol) return cap('hintReversed');
    if (ad(dir, 180) <= tol && ad(key, 180) > tol) return cap('hintAround');
    return '';
  }
  function biasLine() {
    var b = lib().bias(hist(), CHART_N), parts = [];
    if (b.n < 5) return '';
    if (b.turn !== null) parts.push(Math.abs(b.turn) < 5 ? cap('biasTurnEven') : cap(b.turn > 0 ? 'biasTurnFar' : 'biasTurnShort', { deg: Math.round(Math.abs(b.turn)) }));
    if (b.ratio !== null) parts.push(Math.abs(b.ratio - 1) < 0.08 ? cap('biasWalkEven') : cap(b.ratio < 1 ? 'biasWalkShort' : 'biasWalkLong', { pct: Math.round(Math.abs(b.ratio - 1) * 100) }));
    if (b.swaps >= 2) parts.push(cap('biasSwaps', { k: b.swaps }));
    return parts.length ? cap('biasHead', { n: b.n }) + ' ' + parts.join('; ') + '.' : '';
  }
  // The last CHART_N angle errors (answer − key, °) as dots (filled: right), with the current
  // tolerance as a band: the error budget that tightens as the level rises.
  function chart(item) {
    var list = hist().slice(-CHART_N).filter(function (e) { return e[3] !== null; });
    if (list.length < 3) return null;
    var W = 240, H = 64, mid = H / 2, sc = (H / 2 - 6) / 90, tol = Math.min(90, item.tolDeg || 30), dx = W / (CHART_N + 1);
    var svg = S2.svg(W, H, { viewBox: '0 0 ' + W + ' ' + H, width: '100%', class: 'ex-reckon-chartsvg', role: 'img', 'aria-label': cap('chartLabel') });
    svg.appendChild(S2.el('rect', { x: 0, y: (mid - tol * sc).toFixed(1), width: W, height: (2 * tol * sc).toFixed(1), class: 'ex-reckon-band' }));
    svg.appendChild(S2.el('line', { x1: 0, y1: mid, x2: W, y2: mid, class: 'ex-reckon-zero' }));
    list.forEach(function (e, i) {
      var err = Math.max(-90, Math.min(90, st.kit.norm180(e[3] - e[2])));
      svg.appendChild(S2.el('circle', { cx: ((i + 1) * dx).toFixed(1), cy: (mid + err * sc).toFixed(1), r: 3.2, class: e[7] ? 'ex-reckon-dot is-right' : 'ex-reckon-dot is-wrong' }));
    });
    return svg;
  }

  // The flag (the start, or the end of the same distance) appears; the view turns to it from where you
  // stand (≤ 600 ms); the circle shows the way back.
  function reveal(item, response, result) {
    if (!st || st.item !== item) return Promise.resolve();
    stopInput();
    stopWalkBack();
    st.done = true;
    var res = result || { correct: false }, ok = !!res.correct, el = st.el, d = res.detail || {}, lines = [], kit = st.kit;
    var ret = isReturn(item), dir = ret ? (isNum(d.dir) ? d.dir : null) : isNum(response) ? kit.norm360(response) : null;
    if (!st.voided) remember(lib().entry(item, response, res, Date.now() / 1000));
    el.root.classList.add('is-revealed');
    st.D.mark(ok ? 'is-right' : 'is-wrong');
    st.D.set(dir, dir === null ? '' : kit.sideText(cap, dir));
    st.D.key(item.keyDeg);
    st.D.wedge(ret ? null : item.keyDeg, item.tolerance);
    var E = endOf(item), flag = item.task === 'distance'
      ? [E.x + item.distance * Math.sin(rad(item.heading)), E.y + item.distance * Math.cos(rad(item.heading))] : item.path[0];
    if (item.task !== 'heading') { st.S.moveFlag(flag[0], flag[1]); st.S.showFlag(true); }
    [st.confirm, st.back, st.walk, st.here].forEach(function (b) { b.hidden = true; });
    el.phase.textContent = cap(item.task === 'distance' ? 'phaseRevealDistance' : item.task === 'heading' ? 'phaseRevealHeading' : 'phaseReveal');
    el.verdict.hidden = false;
    el.verdict.setAttribute('data-kind', ok ? 'right' : 'wrong');
    var verdict;
    if (!ret) {
      var err = isNum(res.value) ? Math.round(res.value) : null;
      verdict = err === null ? cap('noAnswer') : cap(ok ? 'verdictRight' : 'verdictWrong', { err: err, tol: item.tolerance });
    } else {
      var lim = item.tolerance * item.distance, pct = Math.round(item.tolerance * 100), key = item.task === 'distance' ? (ok ? 'posRightDistance' : 'posWrongDistance') : (ok ? 'posRight' : 'posWrong');
      verdict = isNum(d.posErr) ? cap(key, { err: r1(d.posErr), pct: pct, lim: r1(lim) }) : cap('noAnswer');
    }
    el.verdict.textContent = (ok ? '✓ ' : '✗ ') + verdict;
    var s = sideOf(item.keyDeg);
    if (item.task === 'heading') {
      var T = item.turns[0], ts = sideOf(T);
      lines.push(cap('headingWas', { deg: ts.deg, side: kit.sideText(cap, T).replace(/^\d+° /, '') }));
    } else if (item.task === 'distance') {
      lines.push(cap('distanceWas', { L: r1(item.distance), r: r1(d.dist || 0), dpct: Math.round(Math.abs((d.ratio || 0) - 1) * 100), dword: cap((d.ratio || 0) < 1 ? 'short' : 'long') }));
    } else {
      lines.push(cap('answerWas', { deg: s.deg, side: cap(s.side) || s.side, dist: Math.round(item.distance) }));
      if (ret && isNum(d.dist)) {
        if (dir === null) lines.push(cap('walkedNone'));
        else {
          var ys = sideOf(dir);
          lines.push(cap('walkedWas', { deg: ys.deg, side: cap(ys.side) || ys.side, r: r1(d.dist), aerr: Math.round(Math.abs(d.signed || 0)), dpct: Math.round(Math.abs(d.ratio - 1) * 100), dword: cap(d.ratio < 1 ? 'short' : 'long') }));
        }
        var walked = item.pathLength + d.dist;
        lines.push(cap('drift', { ep: r1(d.posErr), path: Math.round(walked), cm: Math.round(100 * d.posErr / Math.max(1, walked)) }));
      }
      lines.push(cap(ret ? 'legendReturn' : 'legend', { tol: item.tolerance }));
      var hint = errorHint(item, dir);
      if (hint) lines.push(hint);
    }
    PX.ui.clear(el.notes);
    el.notes.appendChild(h('p.ex-fp-note', lines.join(' ')));
    var bl = item.task ? '' : biasLine();
    if (bl) el.notes.appendChild(h('p.ex-fp-note.ex-reckon-bias', bl));
    el.notes.hidden = false;
    var ch = item.task ? null : chart(item);
    PX.ui.clear(el.chart);
    if (ch) el.chart.appendChild(ch);
    el.chart.hidden = !ch;
    el.readout.textContent = dir !== null && item.task !== 'distance' ? cap('readoutYours', { dir: kit.sideText(cap, dir) }) : '';
    // turn to the flag from where you stand (the heading item: to the way you faced at the start). After a
    // walk back, a ring marks where you stopped; if that is within VIEW_MIN of the flag, the view steps
    // back from it along the line through your stop, so the flag and your ring are both in sight.
    var P = st.S.pose;
    if (ret && response && isNum(response.x) && isNum(response.z)) {
      // the stop from the response itself (the same place as the view after a real walk back)
      var rr = Math.hypot(response.x, response.z), dirR = rr > 1e-6 ? Math.atan2(response.x, response.z) * 180 / Math.PI : 0, hb = item.heading + dirR;
      st.S.setPose(E.x + rr * Math.sin(rad(hb)), E.y + rr * Math.cos(rad(hb)), hb);
      P = st.S.pose;
      st.S.setStop(P.x, P.y);
      var dx = P.x - flag[0], dy = P.y - flag[1], dd = Math.hypot(dx, dy);
      if (dd < VIEW_MIN) {
        var b = rad(P.h), ux = dd > 0.05 ? dx / dd : -Math.sin(b), uy = dd > 0.05 ? dy / dd : -Math.cos(b);
        st.S.setPose(flag[0] + ux * VIEW_MIN, flag[1] + uy * VIEW_MIN, P.h);
        P = st.S.pose;
      }
    }
    var to = item.task === 'heading' ? item.startHeading : Math.atan2(flag[0] - P.x, flag[1] - P.y) * 180 / Math.PI;
    return st.S.lookTo(to, 600);
  }

  function showMe(item, response, ctx) {
    if (!st || st.item !== item) return Promise.resolve();
    var kit = st.kit, S = st.S, steps;
    if (item.task === 'heading') {
      var T = item.turns[0], back = kit.norm360(-T), ts = sideOf(T);
      steps = [
        { ms: 1800, caption: cap('headingWas', { deg: ts.deg, side: kit.sideText(cap, T).replace(/^\d+° /, '') }), enter: function () { st.D.key(null); st.D.wedge(null); },
          update: function (k) { st.D.set(kit.sweep(kit.norm360(T), kit.ease(k))); } },
        { ms: 1800, caption: cap('demoTurn', { deg: sideOf(back).deg, side: sideOf(back).side }), enter: function () { st.D.set(null); },
          update: function (k) { st.D.key(kit.sweep(back, kit.ease(k))); }, exit: function () { st.D.wedge(back, item.tolerance); } },
      ];
    } else if (item.task === 'distance') {
      steps = [{ ms: 2000, caption: cap('phaseRevealDistance'), enter: function () { S.render(); } }];
    } else {
      var res = isReturn(item) ? lib() && PX.ex.get('reckon').score(item, response) : null, d = res && res.detail ? res.detail : {};
      var yours = isReturn(item) ? (isNum(d.dir) ? { deg: d.dir, r: d.dist, ep: d.posErr } : null) : (isNum(response) ? { deg: kit.norm360(response), r: 0 } : null);
      steps = st.M.steps(item, { yours: yours, tol: isReturn(item) ? null : item.tolerance });
    }
    return kit.play(S, steps, ctx, { name: 'show-me' });
  }

  // Tutorial: the walk again with captions, the map from above, then the turn to the start.
  function demo(item, ctx) {
    if (!st || st.item !== item) return Promise.resolve();
    var kit = st.kit, S = st.S, L = lib().homing, pl = planOf(item), E = endOf(item), s = sideOf(item.keyDeg), S0 = item.path[0], last = 0;
    st.playing = true;
    function at(p, flag) {
      st.M.close(); st.D.key(null); st.D.wedge(null); S.showFlag(!!flag);
      S.setPose(p.x, p.y, p.h);
      S.showRing(Math.hypot(p.x - S0[0], p.y - S0[1]) < START_R + 0.3 && !flag);
      S.render();
    }
    var watch = [
      { ms: 2200, caption: cap('demoStart'), enter: function () { st.D.set(null); last = 0; at(L.poseAt(pl, 0)); } },
      { ms: Math.round(pl.total * 1000), caption: cap('demoWalk'), enter: function () { last = 0; at(L.poseAt(pl, 0)); },
        update: function (k) { var t = k * pl.total; S.tick(Math.max(0, t - last)); last = t; at(L.poseAt(pl, t)); } },
      { ms: 2000, caption: cap('demoEnd'), enter: function () { at(E); } },
    ];
    var answer = item.task ? [] : [
      { ms: 2600, caption: cap('demoTurn', { deg: s.deg, side: cap(s.side) || s.side }), enter: function () { at(E); st.D.set(0); },
        update: function (k) { var a = kit.sweep(item.keyDeg, kit.ease(k)); st.D.set(a); S.setPose(E.x, E.y, item.heading + a); S.render(); },
        exit: function () { S.moveFlag(S0[0], S0[1]); S.showFlag(true); S.render(); } },
      { ms: 2400, caption: cap('demoAnswer'), enter: function () { at({ x: E.x, y: E.y, h: item.heading + item.keyDeg }, true); st.D.set(item.keyDeg); } },
    ];
    var map = item.task ? [] : st.M.steps(item, { tol: isReturn(item) ? null : item.tolerance });
    return kit.play(S, watch.concat(map, answer), ctx, { name: 'demo' }).then(function () {
      if (!st) return;
      st.playing = false;
      S.sub.textContent = '';
      if (st.item === item && !st.done) {
        st.value = null; st.raw = 0; st.dist = 0;
        at(E);
        st.D.set(null);
        readout();
        controls();
      }
    });
  }

  function unmount() {
    if (!st) return;
    stopInput();
    stopWalkBack();
    if (st.W) st.W.stop();
    window.removeEventListener('keyup', st.onKeyUp);
    window.removeEventListener('blur', st.onBlur);
    document.removeEventListener('visibilitychange', st.onBlur);
    st.S.dispose();
    if (st.el.root.parentNode) st.el.root.parentNode.removeChild(st.el.root);
    st = null;
  }

  PX.ex.view('reckon', {
    layout: 'custom',
    needs: 'webgl',
    css: true,
    requires: ['homing'],
    mount: mount,
    present: present,
    collect: collect,
    reveal: reveal,
    showMe: showMe,
    demo: demo,
    unmount: unmount,
    pause: function () { if (st && st.walking) st.hostPause = true; },
    resume: function () { if (st) st.hostPause = false; },
    // for tests
    timeline: function (item) { return planOf(item); },
    pose: function () { return st && st.S ? { x: st.S.pose.x, y: st.S.pose.y, h: st.S.pose.h } : null; },
    state: function () {
      return st ? { walking: st.walking, paused: st.paused, hostPause: st.hostPause, voided: st.voided, voidStats: st.voidStats, live: st.live,
        value: st.value, dist: Math.round(st.dist * 1000) / 1000, speed: st.v, dir: st.dir, flag: !!(st.S.flag && st.S.flag.visible), ring: !!(st.S.ring && st.S.ring.visible),
        map: st.M.shown(), frames: st.frames, input: st.input, mode: st.mode, fade: [st.S.fadeU.value.x, st.S.fadeU.value.y],
        ground: st.S.spec ? st.S.spec.kind : null, dots: st.S.dots ? st.S.dots.count : 0, hist: hist().length } : null;
    },
    trialInfo: function () { return st ? { input: st.input, mode: st.mode, void: st.voided, frames: st.frames } : null; },
    answerMeta: answerMeta,
    history: function () { return hist().slice(); },
  });
})(window.PX);
