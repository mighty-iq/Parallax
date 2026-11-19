/* PX.ui.screens.climb: the weekly Climb (route 'climb'; v1.2 PLAN milestone 5; note G1 §2.6, §5.2, §6.1).
   The engine is js/engine/climb.js (mode 'climb'): 20 rungs from easy to hard, the same for everyone this
   week, untimed; a miss leaves a notch and the same rung comes again with another item; the second miss
   ends the run; three attempts a week (A, B, C), then practice. This screen runs the items through the
   trial player (PX.ui.play.player, as Section practice and the Spatial Check do), so the player's rules
   hold unchanged: the answer clock from the painted frame, voided items never count, nothing saved during
   a stimulus, Esc pauses.

   Between rungs only: the ruled scale steps up one tick (its marker slides 200 ms; still under reduced
   motion or the quiet level), with a rising tone per rung while Sound and Climb sounds are on. The scale is
   hidden while an item is on screen (until its verdict), so during an item only the task and the item
   counter ("Rung 7 of 20 · one spare") show. At the end: the printout (height, notches, the week's best),
   a short reward sound when the run beats this week's best, a richer one for a personal best and the
   richest at the summit, the Summit achievement at rung 20, a share card and one Chimera invite.
   A run left part-way (End, a reload, another screen) is kept and goes on where it stopped. */
(function (PX) {
  'use strict';

  var win = window, doc = win.document;
  var ui = PX.ui, h = ui.h;
  var store = PX.core.store, router = PX.core.router;

  if (router && Array.isArray(router.NAMES) && router.NAMES.indexOf('climb') < 0) router.NAMES.push('climb');

  function E() { return PX.engine; }
  function Play() { return PX.ui.play; }
  function GU() { return PX.ui.game; }
  function rec() { return store.state; }
  function now() { return Date.now(); }
  function save() { try { store.save(); } catch (e) { /* the next save writes it */ } }
  function isNum(x) { return typeof x === 'number' && isFinite(x); }
  function log(m, e) { if (win.console) console.error('PX.ui.climb: ' + m, e || ''); }
  function nameOf(def) { return def ? def.short || def.name : ''; }
  function plural(n, one, many) { return n + ' ' + (n === 1 ? one : many); }
  function display() { try { return E().est.displayClass(win.innerWidth, win.innerHeight); } catch (e) { return 'large'; } }
  function can(def) { var P = Play(); return P && typeof P.canRun === 'function' ? P.canRun(def) : true; }
  function fmtDay(key) { try { return PX.util.fmtDate(new Date(key + 'T12:00:00').getTime(), 'short'); } catch (e) { return key; } }
  function spareText(K) { return K.spare < 1 ? 'no spare' : K.misses >= K.spare ? 'spare used' : 'one spare'; }

  var current = null;
  // Playtest mode (test builds): where a visit is, how a run ended, and three taps on the Climb's printout.
  function emit(evt, data) { try { if (PX.bus) PX.bus.emit(evt, data); } catch (e) { /* a listener failed */ } }
  function playtestRow(c) {
    var T = PX.ui.playtest;
    try { return T && typeof T.on === 'function' && T.on() && typeof T.rateRow === 'function' ? T.rateRow({ exId: 'climb', mode: 'climb', key: 'climb:' + c.week + ':' + c.attempt, label: 'Weekly Climb, attempt ' + c.attempt }) : null; } catch (e) { return null; }
  }

  function render(host, route) {
    var X = { host: host, wrap: h('div.gm-climb-screen', { 'data-climb-state': 'intro' }), plan: null, P: null, clock: null, done: true, offs: [], res: null };
    host.appendChild(X.wrap);
    current = X;
    intro(X, route.params || {});
    function onHide() { if (!X.done) stop(X, 'closed'); }
    win.addEventListener('pagehide', onHide);
    X.offs.push(function () { win.removeEventListener('pagehide', onHide); });
    return function cleanup() { leave(X); };
  }

  function head(X, meta, title, lead) {
    var P = Play();
    if (P && typeof P.screenHead === 'function') X.wrap.appendChild(P.screenHead(meta, title, lead));
    else X.wrap.appendChild(h('div.px-screen-head', meta ? h('p.px-meta', meta) : null, h('h1', title), lead ? h('p.px-lead', lead) : null));
  }

  /* ---------- the intro: this week's attempts ---------- */

  function intro(X) {
    ui.clear(X.wrap);
    try { win.scrollTo(0, 0); } catch (e) { /* ignore */ }
    X.wrap.setAttribute('data-climb-state', 'intro');
    var st = E().climb.state(rec(), now()), K = PX.ui.kit;
    emit('play:screen', { screen: 'climb-intro', mode: 'climb', exId: null });
    head(X, 'Week of ' + fmtDay(st.week), 'Weekly Climb #' + st.number, st.rungs + ' rungs from easy to hard, the same for everyone this week.');
    var p = K.panel({ title: 'This week', className: 'gm-panel gm-climb-week' });
    p.body.appendChild(GU().scale({ max: st.rungs, value: st.best || 0, best: st.pb ? st.pb.h : null, width: 320 }));
    var list = h('ul.gm-attempts');
    E().climb.letters().forEach(function (a) {
      var x = st.attempts[a];
      list.appendChild(h('li', { 'data-attempt': a, 'data-state': !x ? 'open' : x.p === 1 ? 'partial' : 'done' }, h('b.px-num', a),
        h('span', !x ? 'not climbed yet' : x.p === 1 ? 'waiting at rung ' + (x.h + 1) + (x.m ? ' (spare used)' : '') : 'height ' + x.h + (x.n && x.n.length ? ' · notches at ' + x.n.join(', ') : ''))));
    });
    p.body.appendChild(list);
    p.body.appendChild(h('p.px-meta', (st.best !== null ? 'Best this week: ' + st.best + '. ' : '') + (st.pb ? 'Your highest run: ' + st.pb.h + '. ' : '') + (st.last !== null ? 'Last week’s best: ' + st.last + '.' : '')));
    X.wrap.appendChild(p.el);
    var s = rec().settings || {}, foot = h('div.pl-summary-actions');
    if (s.sound !== true) {
      var sb = ui.button('Turn sound on', { kind: 'ghost', onClick: function () {
        rec().settings.sound = true; save(); PX.bus.emit('settings', { key: 'sound', value: true });
        GU().sound.unlock();
        ui.toast('Sound is on: answer tones and the Climb’s rising tones. Settings can turn either off.', { kind: 'info' });
        intro(X);
      } });
      sb.setAttribute('data-climb-sound', '');
      X.wrap.appendChild(h('p.px-meta.gm-sound-line', 'The Climb has rising tones and a reward sound; they play while Sound is on (it is off).'));
      foot.appendChild(sb);
    }
    var label = st.partial ? 'Go on with attempt ' + st.partial : st.next ? 'Start attempt ' + st.next : 'Climb for practice';
    var go = ui.button(label, { kind: 'primary', onClick: function () { start(X, st.partial || st.next || null); } });
    go.setAttribute('data-climb-start', st.partial || st.next || 'practice');
    foot.insertBefore(go, foot.firstChild);
    foot.appendChild(ui.button('Back to Today', { kind: 'ghost', go: 'home' }));
    X.wrap.appendChild(foot);
    var rules = K.panel({ title: 'How it works', className: 'gm-panel' });
    rules.body.appendChild(h('ul.gm-rules',
      h('li', 'A right answer clears the rung. A miss leaves a notch and the same rung comes again with another item; the second miss ends the run.'),
      h('li', 'Untimed: take the time you need. The items never change your levels.'),
      h('li', 'Three attempts a week, each with its own items, the same for everyone; your best counts. After three, runs are practice.'),
      h('li', 'A run you leave goes on where you stopped. A new Climb comes every Monday; a missed week costs nothing.')));
    X.wrap.appendChild(rules.el);
    try { go.focus({ preventScroll: true }); } catch (e) { /* ignore */ }
  }

  /* ---------- a run ---------- */

  function start(X, attempt) {
    GU().sound.unlock(); // inside the tap: the rung tones can play later
    var plan;
    try { plan = E().modes.start(rec(), 'climb', { now: now(), display: display(), can: can, attempt: attempt || undefined }); } catch (e) { log('start failed', e); plan = { unavailable: 'The Climb could not start.' }; }
    ui.clear(X.wrap);
    if (plan.unavailable) {
      head(X, null, 'Weekly Climb', plan.unavailable);
      X.wrap.appendChild(h('div.pl-summary-actions', ui.button('Back to Today', { kind: 'primary', go: 'home' })));
      return;
    }
    X.plan = plan; X.done = false; X.ended = false; X.res = null;
    X.wrap.setAttribute('data-climb-state', 'run');
    var K = plan.climb;
    emit('play:screen', { screen: 'climb-run', mode: 'climb', exId: plan.exs && plan.exs[0] || null });
    X.scaleBox = h('div.gm-climb-scale', { 'aria-hidden': 'true' });
    X.run = h('div.gm-climb-run', { 'data-pstate': 'idle' }, X.scaleBox);
    X.wrap.appendChild(h('h1.px-sr', 'Weekly Climb, attempt ' + K.attempt));
    X.wrap.appendChild(X.run);
    X.live = h('p.px-sr', { 'aria-live': 'polite' });
    X.wrap.appendChild(X.live);
    var CK = PX.core.clock;
    X.clock = CK.create({ idleMs: 60000, tickMs: 5000 });
    X.P = Play().player({ endLabel: 'End the run', mode: 'climb', onState: function (s) {
      X.run.setAttribute('data-pstate', s);
      if (!X.clock) return;
      if (s === 'paused') X.clock.pause('sheet'); else X.clock.resume('sheet');
    } });
    X.run.appendChild(X.P.el.root);
    if (ui.modalOpen && ui.modalOpen()) X.clock.pause('modal');
    X.offs.push(PX.bus.on('modal:open', function () { if (X.clock) X.clock.pause('modal'); }));
    X.offs.push(PX.bus.on('modal:close', function () { if (X.clock && !(ui.modalOpen && ui.modalOpen())) X.clock.resume('modal'); }));
    drawScale(X, false);
    if (typeof Play().setChrome === 'function') Play().setChrome(true);
    X.clock.start();
    loop(X);
  }

  function drawScale(X, step) {
    var K = X.plan.climb, box = X.scaleBox;
    ui.clear(box);
    var sv = GU().scale({ max: K.R, value: K.height, notches: K.notches, best: K.weekBest, width: 320 });
    box.appendChild(sv);
    box.appendChild(h('p.gm-climb-h.px-num', 'Height ' + K.height + (isNum(K.weekBest) ? ' · best this week ' + K.weekBest : '')));
    if (step) GU().fx.run(sv, 'gm-fx-step', 200);
  }
  function hud(X, def) {
    var K = X.plan.climb, P = X.P;
    try {
      P.setLabel(def, nameOf(def));
      P.setMeta('Rung ' + K.rung + ' of ' + K.R + ' · ' + spareText(K) + (K.scored ? '' : ' · practice'));
      P.setProgress(K.height, K.R);
    } catch (e) { log('hud', e); }
  }
  function clockNow(X) { return { activeMs: X.clock ? X.clock.activeMs() : 0 }; }

  function loop(X) {
    if (X.done) return;
    if (X.ended) { stop(X, 'early'); return; }
    var step = E().modes.next(X.plan, rec(), now(), clockNow(X));
    if (step.done) { stop(X); return; }
    var def = PX.ex.get(step.exId), item = null;
    if (!def || !X.P.use(step.exId)) { skip(X, step); return; }
    try { item = def.generate(PX.rng(step.seed), step.params); } catch (e) { log('generate failed (' + step.exId + ')', e); }
    if (!item) { skip(X, step); return; }
    hud(X, def);
    var learn = PX.ex.learn(def.id), pre = Promise.resolve(null);
    var seen = rec().tour && rec().tour.seen && rec().tour.seen[def.id] === true;
    if (!seen && typeof Play().wtg === 'function') pre = Play().wtg(X.P, def.id, { host: X.wrap }).then(null, function () { return null; });
    pre.then(function () {
      if (X.done) return null;
      if (!X.P.use(step.exId)) { skip(X, step); return null; }
      hud(X, def);
      var goal = typeof Play().goalOf === 'function' ? Play().goalOf(learn, item) : '';
      return X.P.run(item, { feedback: true, limitMs: null, goal: goal }).then(function (tr) { return after(X, step, def, item, tr); });
    }).catch(function (e) { log('trial failed', e); stop(X, 'early'); });
  }

  function skip(X, step) {
    try { E().modes.answer(X.plan, rec(), step, { correct: false, outcome: 'skipped' }, now(), clockNow(X)); } catch (e) { log('answer failed', e); }
    X.skips = (X.skips || 0) + 1;
    if (X.skips > 4) { stop(X, 'early'); return; }
    loop(X);
  }

  function after(X, step, def, item, tr) {
    if (X.done || tr.outcome === 'aborted') return null;
    if (X.clock && tr.outcome !== 'skipped') X.clock.touch();
    var v2 = tr.result && isNum(tr.result.value2) ? tr.result.value2 : tr.meta && isNum(tr.meta.value2) ? tr.meta.value2 : undefined;
    var result = { correct: !!(tr.result && tr.result.correct), rt: tr.rtMs, value: tr.result ? tr.result.value : undefined, value2: v2, timeout: !!tr.timeout,
      input: tr.input || null, display: tr.display || undefined, amode: tr.amode || null, orient: tr.orient || null };
    if (tr.outcome === 'stutter') { result.outcome = 'stutter'; result.voided = true; }
    else if (tr.outcome === 'skipped') result.outcome = 'skipped';
    if (item.fallback === true) result.fallback = true;
    var K = X.plan.climb, h0 = K.height, m0 = K.misses, out;
    try { out = E().modes.answer(X.plan, rec(), step, result, now(), clockNow(X)); } catch (e) { log('answer failed', e); out = { done: false, outcome: 3 }; }
    save();
    if (tr.end) X.ended = true;
    if (tr.outcome === 'skipped' || tr.error) { loop(X); return null; }
    if (K.height > h0) { drawScale(X, true); GU().sound.rung(K.height); X.live.textContent = 'Rung ' + (h0 + 1) + ' cleared. Height ' + K.height + '.'; }
    else if (K.misses > m0) { drawScale(X, false); X.live.textContent = K.misses > K.spare ? 'A second miss: the run ends at height ' + K.height + '.' : 'A miss: a notch at rung ' + K.rung + '. The rung comes again.'; }
    if (out.outcome === 0 || out.outcome === 1) {
      // the step up (or the notch) on a small ruled scale under the verdict, between rungs only
      var mini = GU().scale({ max: K.R, value: K.height, notches: K.notches, best: K.weekBest, width: 220 });
      var note = h('div.pl-note.gm-climb-note', h('p', K.height > h0 ? 'Rung ' + K.height + ' cleared.' : K.misses > K.spare ? 'Second miss: the run ends at height ' + K.height + '.' : 'Miss: rung ' + K.rung + ' comes again with another item (spare used).'), mini);
      X.P.note(note);
      if (K.height > h0) GU().fx.run(mini, 'gm-fx-step', 200);
    }
    hud(X, def);
    // the game feel after a verdict (the plotter tick), as the session screen gives it (CONTRACT-v1.2 R item:reveal)
    if (tr.outcome === 'right' || tr.outcome === 'wrong') {
      try { if (PX.ui.hooks) PX.ui.hooks.collect('item:reveal', { mode: 'climb', step: step, def: def, item: item, tr: tr, out: out, verdict: X.P.el.verdict, P: X.P }); } catch (e) { log('item:reveal', e); }
    }
    return X.P.waitNext({ label: out.done || X.ended ? 'See the result' : 'Next rung' }).then(function (w) {
      if (w === 'end') X.ended = true;
      if (w !== 'abort') loop(X);
    });
  }

  function stop(X, how) {
    if (X.done) return;
    X.done = true;
    var res = null;
    try { res = E().modes.finish(X.plan, rec(), now(), { activeMs: X.clock ? X.clock.activeMs() : 0, ended: how || undefined, session: { viewport: win.innerWidth + 'x' + win.innerHeight } }); } catch (e) { log('finish failed', e); }
    save();
    X.res = res;
    if (res && res.session) emit('play:session', { mode: 'climb', ended: how || 'complete', practiceMs: res.session.practiceMs, answered: res.session.trials, right: res.session.right, exIds: res.session.exs });
    if (X.clock) { try { X.clock.destroy(); } catch (e) { /* gone */ } X.clock = null; }
    if (how === 'closed') return;
    if (X.P) { try { X.P.destroy(); } catch (e) { /* gone */ } X.P = null; }
    if (typeof Play().setChrome === 'function') Play().setChrome(false);
    endScreen(X, res);
  }

  /* ---------- the printout ---------- */

  function top() { try { win.scrollTo(0, 0); } catch (e) { /* ignore */ } }
  function endScreen(X, res) {
    ui.clear(X.wrap);
    top();
    X.wrap.setAttribute('data-climb-state', 'end');
    var c = res && res.climb, K = PX.ui.kit;
    if (!c) {
      head(X, null, 'Weekly Climb', 'No rung was answered, so this attempt is still open.');
      X.wrap.appendChild(h('div.pl-summary-actions', ui.button('Back to Today', { kind: 'primary', go: 'home' }), ui.button('Weekly Climb', { kind: 'ghost', onClick: function () { intro(X); } })));
      return;
    }
    head(X, 'Week of ' + fmtDay(c.week) + ' · attempt ' + c.attempt + (c.practice ? ' · practice' : ''), c.partial ? 'Run paused at height ' + c.height : 'Height ' + c.height, null);
    emit('play:screen', { screen: 'climb-end', mode: 'climb', exId: null });
    var pr = playtestRow(c);
    if (pr) X.wrap.appendChild(pr);
    var p = K.panel({ title: c.partial ? 'Kept for later' : c.summit ? 'Summit' : 'Your run', className: 'gm-panel gm-print', aside: 'Climb #' + c.number });
    p.el.setAttribute('data-height', String(c.height));
    p.el.setAttribute('data-climb-end', c.partial ? 'partial' : 'done');
    p.body.appendChild(h('p.gm-print-head', 'CLIMB #' + c.number + ' · ATTEMPT ' + c.attempt + ' · ' + (c.spare ? 'ONE SPARE' : 'NO SPARE')));
    var big = h('b.px-num.gm-print-big', String(c.height));
    p.body.appendChild(h('p.gm-print-line', h('span', 'Height '), big, h('span.px-meta', ' of ' + c.rungs + (isNum(c.weekBest) ? ' · best this week ' + c.weekBest : '') + (isNum(c.pb) ? ' · your highest ' + c.pb : ''))));
    p.body.appendChild(GU().scale({ max: c.rungs, value: c.height, notches: c.notches, best: c.weekBest, width: 320 }));
    var lines = [];
    if (c.partial) lines.push('The run is kept: it goes on at rung ' + (c.height + 1) + ' whenever you open the Climb this week.');
    else if (c.practice) lines.push('A practice run: this week’s three attempts are climbed, so it changes nothing.');
    else {
      if (c.summit) lines.push('All ' + c.rungs + ' rungs cleared.');
      else if (c.newPb) lines.push('Your highest run so far' + (isNum(c.pbBefore) ? ' (before: ' + c.pbBefore + ')' : '') + '.');
      else if (c.newWeekBest) lines.push('Your best this week' + (isNum(c.weekBefore) ? ' (before: ' + c.weekBefore + ')' : '') + '.');
      lines.push(c.left ? plural(c.left, 'attempt', 'attempts') + ' left this week.' : 'All three attempts climbed; a new Climb comes on Monday.');
    }
    lines.forEach(function (t) { p.body.appendChild(h('p.gm-line', t)); });
    X.wrap.appendChild(p.el);
    if (!c.partial && !c.practice) {
      GU().fx.run(big, 'gm-fx-type', 300);
      if (c.summit) GU().sound.reward('summit'); else if (c.newPb) GU().sound.reward('pb'); else if (c.newWeekBest) GU().sound.reward('week');
    }
    var ach = res.achievements || [];
    if (ach.length) {
      var pa = K.panel({ title: 'Achievements', className: 'gm-panel' });
      pa.body.appendChild(h('ul.pl-ach', ach.map(function (a) { return h('li', K.icon('award', 'pl-ach-mark'), h('div', h('b', a.name), h('span', a.desc))); })));
      X.wrap.appendChild(pa.el);
    }
    var text = 'Parallax Climb #' + c.number + ' · height ' + c.height + ' of ' + c.rungs + ' · ' + GU().LINK;
    if (!c.partial) {
      var ps = K.panel({ title: 'Share', className: 'gm-panel' });
      ps.body.appendChild(h('p', 'Your share line. Everyone climbs the same rungs this week, so heights compare fairly.'));
      ps.body.appendChild(K.copyField(text, { rows: 1, ariaLabel: 'Climb share line', label: 'Copy' }));
      ps.body.appendChild(h('div.pl-summary-actions', GU().shareButton('Share card', { kind: 'session', label: 'Weekly Climb #' + c.number, title: 'Height ' + c.height + ' of ' + c.rungs,
        lines: ['Attempt ' + c.attempt + (c.notches.length ? ' · notches at ' + c.notches.join(', ') : ' · no miss'), isNum(c.weekBest) ? 'Best this week: ' + c.weekBest : ''].filter(Boolean),
        marks: Array.apply(null, { length: c.height }).map(function () { return 1; }).concat(c.notches.length > c.spare ? [0] : []), footer: 'Week of ' + c.week, text: text }, 'climb')));
      X.wrap.appendChild(ps.el);
      var C = PX.ui.chimera, kind = ach.length ? 'achievement' : c.newPb || c.summit ? 'best' : null;
      if (kind && C && typeof C.invite === 'function') { var inv = C.invite(kind, { host: X.wrap }); if (inv) X.wrap.appendChild(inv); }
    }
    var st = E().climb.state(rec(), now()), acts = h('div.pl-summary-actions');
    if (c.partial) acts.appendChild(ui.button('Go on now', { kind: 'primary', onClick: function () { start(X, c.attempt); } }));
    else if (st.next) acts.appendChild(ui.button('Climb attempt ' + st.next, { kind: 'primary', onClick: function () { start(X, st.next); } }));
    acts.appendChild(ui.button('Back to Today', { kind: st.next || c.partial ? 'ghost' : 'primary', go: 'home' }));
    acts.appendChild(ui.button('Climb overview', { kind: 'ghost', onClick: function () { intro(X); } }));
    X.wrap.appendChild(acts);
  }

  function leave(X) {
    if (!X.done && X.plan) stop(X, 'closed');
    if (X.P) { try { X.P.destroy(); } catch (e) { /* gone */ } X.P = null; }
    if (X.clock) { try { X.clock.destroy(); } catch (e) { /* gone */ } X.clock = null; }
    X.offs.forEach(function (f) { try { f(); } catch (e) { /* gone */ } });
    X.offs = [];
    try { if (typeof Play().setChrome === 'function') Play().setChrome(false); } catch (e) { /* no player */ }
    if (current === X) current = null;
  }

  PX.ui.screens = PX.ui.screens || {};
  PX.ui.screens.climb = { title: 'Weekly Climb', render: render };
  PX.ui.climb = { state: function () { var X = current; return X ? { mode: X.wrap.getAttribute('data-climb-state'), done: X.done, plan: X.plan ? X.plan.climb : null, res: X.res } : null; } };
  win.__climb = PX.ui.climb;
})(window.PX);
