/* PX.ui.screens.section: Section practice (route 'section'; v1.1 PLAN M5; R3 §9, §6).
   A rehearsal of the Perceptual Ability Test's constraints: the DAT-style formats in the test's
   order (PX.engine.section), one clock for the whole section (PX.core.clock: active time, stopped
   by the pause sheet, any modal, a hidden tab, five idle minutes, and while a part's instructions
   are open), no feedback until a review at the end, no rating change, no score prediction.

   Flow (v1.2, test conditions: PLAN milestone 8, note docs/research/v1.2/D1-pat-formats.md addendum A.4):
   setup (size, form, the parts this build has, the rules) or "resume" when a run is live in
   rec.section.live → every part's instructions on one page, before the clock starts (the official
   candidate guide asks candidates to study the instructions before test day) → items through the trial
   player (PX.ui.play.player, feedback off) on one clock across all parts, which stops while an item is
   being prepared (from the request to its painted frame, as the test's own clock does). Choosing an
   answer moves on; Back, Mark, Strike, Review and Next or Skip sit under the item: Back and Next go
   across parts, Strike crosses out options (tap them, Shift with an option's letter, or right-click),
   Review lists marked and unanswered items of every part, as test takers describe the screen (the
   official documents do not). After the last item the review list opens. A voided item (stutter, device
   turned) does not count and a replacement joins the end of its part. Time up or "End the section" (the
   review list or the pause sheet) → the review: each part's results and pacing, then the items to look
   at again, each replayed with its answer, the right answer and its show-me. Trials are logged when the
   section ends (mode 'section'). A line says that guessing is not penalised.
   The run is saved between items, so a reload offers to resume it. Never during a stimulus. When the
   page is hidden or left (a reload, a closed tab, another app), the clock's time is written at once, so a
   reload never gives back the time spent on the current item (v1.2 O9; the store writes even while held:
   a hidden page shows no stimulus). Item numbers never shift (v1.2 O11: PX.engine.section.numberOf).
   The finished run is kept for its review (rec.section.last): a reload during the review reopens it, and
   the setup screen offers it later (v1.2 O10).

   PX.ui.section = { config, state() } (tests: config.idleMs; window.__section mirrors state()) */
(function (PX) {
  'use strict';

  var win = window, doc = win.document;
  var ui = PX.ui, h = ui.h, U = PX.util, bus = PX.bus;
  var store = PX.core.store, router = PX.core.router, keys = PX.core.keys, timing = PX.core.timing;

  var IDLE_MS = 5 * 60000;   // five quiet minutes: someone has left, so the section clock stops
  var NEXT_MS = 220;         // the chosen answer stays visible this long before the next item
  var config = { idleMs: IDLE_MS, nextMs: NEXT_MS };

  // The route (router.NAMES is the router's own list; a screen registers its name there).
  if (router && Array.isArray(router.NAMES) && router.NAMES.indexOf('section') < 0) router.NAMES.push('section');

  function E() { return PX.engine; }
  function SE() { return PX.engine.section; }
  function Play() { return PX.ui.play; }
  function rec() { return store.state; }
  function now() { return Date.now(); }
  function isNum(x) { return typeof x === 'number' && isFinite(x); }
  function save() { try { store.save(); } catch (e) { /* the next save writes it */ } }
  function log(m, e) { if (win.console) console.error('PX.ui.section: ' + m, e || ''); }
  function shortOf(id) { var d = PX.ex.get(id); return d ? d.short || d.name : id; }
  function display() { try { return E().est.displayClass(win.innerWidth, win.innerHeight); } catch (e) { return 'large'; } }
  function andList(list) { return list.length < 2 ? list.join('') : list.slice(0, -1).join(', ') + ' and ' + list[list.length - 1]; }
  function clockText(ms) { return U.fmtTime(Math.max(0, ms)); }
  function minutesText(ms) { var C = PX.core.clock; return C && C.fmtMinutes ? C.fmtMinutes(ms) : Math.round(ms / 60000) + ' min'; }
  function ada() { return PX.ui.overlap ? h('p.px-meta.px-overlap-legal', PX.ui.overlap.ADA) : null; }
  function tnow() { return timing && typeof timing.now === 'function' ? timing.now() : now(); }

  /* ---------- the clock (PX.core.clock; a minimal stand-in if it is missing) ---------- */

  function makeClock() {
    var K = PX.core.clock;
    if (K && typeof K.create === 'function') return K.create({ idleMs: config.idleMs, tickMs: 1000 });
    var acc = 0, t0 = 0, on = false, live = false, reasons = {}, subs = {}, iv = null;
    function emit(evt, d) { (subs[evt] || []).slice().forEach(function (fn) { try { fn(d); } catch (e) { log('clock listener', e); } }); }
    function sync() {
      var want = on && !Object.keys(reasons).length;
      if (want && !live) { live = true; t0 = tnow(); emit('resume', {}); }
      else if (!want && live) { live = false; acc += tnow() - t0; emit('pause', {}); }
    }
    function vis() { if (doc.hidden) C.pause('hidden'); else C.resume('hidden'); }
    doc.addEventListener('visibilitychange', vis);
    iv = win.setInterval(function () { if (live) emit('tick', { activeMs: C.activeMs() }); }, 1000);
    var C = {
      start: function () { on = true; sync(); return C; }, stop: function () { on = false; sync(); return C; },
      pause: function (r) { reasons[r || 'user'] = true; sync(); }, resume: function (r) { delete reasons[r || 'user']; sync(); },
      activeMs: function () { return acc + (live ? tnow() - t0 : 0); }, running: function () { return live; },
      on: function (evt, fn) { (subs[evt] || (subs[evt] = [])).push(fn); return function () { var l = subs[evt], i = l.indexOf(fn); if (i >= 0) l.splice(i, 1); }; },
      destroy: function () { C.stop(); win.clearInterval(iv); doc.removeEventListener('visibilitychange', vis); subs = {}; },
    };
    return C;
  }

  /* ---------- the screen ---------- */

  function render(host, route) {
    var X = {
      host: host, wrap: h('div.sec-screen', { 'data-sec-state': 'setup' }), run: null, C: null, P: null, RP: null,
      token: 0, mode: 'setup', base: 0, pausedBase: 0, wallStart: 0, introMs: 0, introAt: 0,
      visitAt: 0, offs: [], popKeys: null, warned: {}, result: null, done: false, stripOpen: false, el: {},
    };
    host.appendChild(X.wrap);
    current = X;
    var live = null;
    try { live = SE().live(rec()); } catch (e) { live = null; }
    if (live && live.parts.some(function (p) { return !PX.ex.get(p.exId); })) live = null; // an exercise left this build
    var kept = live ? null : keptReview(true);
    if (live) resumeCard(X, live); else if (kept) review(X, kept); else setup(X, route.params || {});
    return function cleanup() { leaveScreen(X); };
  }

  // The last finished run's review (v1.2 O10). openOnly: only while it was open (a reload during the review)
  // and recent (REOPEN_MS); later the setup screen offers it with a button instead.
  var REOPEN_MS = 2 * 3600000;
  function keptReview(openOnly) {
    var L = null, res = null;
    try { L = SE().last ? SE().last(rec()) : null; } catch (e) { L = null; }
    if (!L || (openOnly && (!L.open || !(now() - L.end < REOPEN_MS)))) return null;
    try { res = SE().lastResult(rec()); } catch (e) { log('the last review could not be rebuilt', e); res = null; }
    return res;
  }

  function setState(X, s) { X.mode = s; X.wrap.setAttribute('data-sec-state', s); }
  function clear(X) { ui.clear(X.wrap); }
  function can(def) { var P = Play(); return P && typeof P.canRun === 'function' ? P.canRun(def) : true; }
  // Why a part cannot run: its screen is still being built, or this device lacks something (WebGL).
  function why(def) {
    var u = null;
    try { u = PX.ui.exinfo ? PX.ui.exinfo.unavailable(def) : null; } catch (e) { u = null; }
    return u === 'coming soon' ? 'coming soon' : u ? 'cannot run on this device' : null;
  }
  function opts() { return { can: can, why: why }; }

  // Setup: size, form, the parts, the rules, Start.
  function setup(X, params) {
    setState(X, 'setup');
    clear(X);
    var K = PX.ui.kit, size = params.size === 'full' ? 'full' : 'mini';
    var head = Play().screenHead('Section practice', 'A timed section', 'Formats in the style of the Perceptual Ability Test of the Dental Admission Test (DAT®), in the test’s order, against one clock, with no feedback until a review at the end.');
    var body = h('div.sec-setup');
    X.wrap.appendChild(head);
    X.wrap.appendChild(body);
    function draw() {
      ui.clear(body);
      var sh = SE().shape(size, opts());
      if (!sh.parts.length) {
        body.appendChild(h('p.px-notice.px-notice--warn', 'None of the DAT-style exercises can run here yet, so a section cannot start.'));
        body.appendChild(h('div.pl-summary-actions', ui.button('Back to the Library', { kind: 'secondary', go: 'library' })));
        body.appendChild(ada());
        return;
      }
      var sizes = K.segmented({
        key: 'secSize', legend: 'Length', value: size,
        options: ['mini', 'full'].map(function (s) { var x = SE().shape(s, opts()); return { value: s, label: (s === 'mini' ? 'Mini' : 'Full') + ' · ' + x.items + ' items', aria: (s === 'mini' ? 'Mini' : 'Full') + ', ' + x.items + ' items in ' + SE().fmtMinutes(x.budgetMs) }; }),
        hint: size === 'mini' ? 'Five items a part: a short section that fits a phone and a break.' : 'Fifteen items a part' + (sh.parts.length === sh.of ? ', as in each part of the Perceptual Ability Test.' : '.'),
        onChange: function (v) { size = v; draw(); },
      });
      body.appendChild(sizes);
      var runs = rec().section && Array.isArray(rec().section.runs) ? rec().section.runs : [], last = runs[runs.length - 1];
      if (last) {
        var kept = keptReview(false), open = kept && kept.summary.id === last.id ? ui.button('Open its review', { kind: 'ghost', small: true, onClick: function () { review(X, kept); } }) : null;
        if (open) open.setAttribute('data-sec-lastreview', '');
        body.appendChild(h('p.px-meta.sec-last', 'Your last section: ' + last.size + ', form ' + last.form + ', ' + last.right + ' of ' + last.n + ' right in ' + clockText(last.usedMs) + ' (' + K.fmtWhen(last.end) + '). Section runs are also in the Log. ', open));
      }
      var next = SE().nextForm(rec(), size), formSel = h('select.px-select', { id: 'sec-form', 'data-sec-form': '' });
      for (var f = 1; f <= next; f++) formSel.appendChild(h('option', { value: String(f), selected: f === next }, 'Form ' + f + (f === next ? ' (new to you)' : ' (taken before)')));
      body.appendChild(h('div.px-setting.sec-formrow', h('label.px-setting-label', { for: 'sec-form' }, 'Form'), formSel,
        h('p.px-field-hint', 'A form has the same items for everyone, so you can compare a form with friends. An earlier form repeats items you have seen.')));
      var parts = h('ol.sec-parts'), fresh = 0;
      SE().parts(opts()).forEach(function (p) {
        var unmet = p.ok && isNew(p.id);
        if (unmet) fresh++;
        parts.appendChild(h('li', { class: p.ok ? null : 'is-missing', 'data-part': p.id },
          h('b', p.def ? p.def.short || p.def.name : PART_NAMES[p.id] || p.id),
          h('span.px-meta', p.ok ? ' · ' + sh.perPart + ' items' + (unmet ? ' · new to you' : '') : ' · ' + p.why)));
      });
      body.appendChild(h('div.px-setting', h('p.px-setting-label', 'Parts, in order'), parts,
        fresh ? h('p.px-field-hint.sec-new', (fresh === 1 ? 'One format is' : fresh + ' formats are') + ' new to you, and a section gives no feedback until the end. Its instructions come before the clock, but Watch, Try, Go in the Library teaches a format best. ',
          ui.button('Open the Library', { kind: 'ghost', small: true, go: 'library' })) : null,
        sh.missing.length ? h('p.px-field-hint.sec-missing', andList(sh.missing.map(function (m) { return PART_NAMES[m.id] || shortOf(m.id); })) + (sh.missing.length === 1 ? ' is' : ' are') + ' not part of this section here, so it has ' + sh.parts.length + ' of the ' + sh.of + ' parts: ' + sh.items + ' items in ' + SE().fmtMinutes(sh.budgetMs) + ', the same pace.') : null));
      body.appendChild(h('ul.sec-rules',
        h('li', 'One clock for the whole section: ' + sh.items + ' items in ' + SE().fmtMinutes(sh.budgetMs) + ', about 40 seconds an item, the Perceptual Ability Test’s average pace. As on the test, it stops while an item is being prepared.'),
        h('li', 'Every part’s instructions come first, before the clock starts: the official candidate guide asks candidates to study the instructions before test day.'),
        h('li', 'Move freely between items and parts. Mark items, strike out options you have ruled out, and use Review to find marked and unanswered items: test takers describe these tools on the test’s screen, which the official documents do not.'),
        h('li.sec-guess', GUESS),
        h('li', 'No feedback until the end, and your levels do not change. Pause stops the clock; the review reports your pauses, each part’s results and pacing, with a show-me for every item. Parallax does not predict a score on the Dental Admission Test.')));
      var start = ui.button('Start the section', { kind: 'primary', onClick: function () {
        var form = parseInt(formSel.value, 10);
        var run = SE().start(rec(), { size: size, form: isNum(form) ? form : next, now: now(), display: display(), can: can, why: why });
        if (run.unavailable) { ui.toast(run.unavailable, { kind: 'warn' }); return; }
        begin(X, run, true);
      } });
      start.setAttribute('data-sec-start', '');
      body.appendChild(h('div.pl-summary-actions', start, ui.button('Back to the Library', { kind: 'ghost', go: 'library' })));
      body.appendChild(ada());
    }
    draw();
  }

  // A format this person has never met: no Watch, Try, Go and no rated answer yet.
  function isNew(id) {
    var r = rec();
    var seen = r.tour && r.tour.seen && r.tour.seen[id] === true, ex = r.ex && r.ex[id];
    return !seen && !(ex && (ex.n > 0 || (ex.small && ex.small.n > 0)));
  }

  // Part names before the exercises exist (R3 §2.2, CONTRACT-v1.1 ids table).
  var PART_NAMES = { openings: 'Openings', patviews: 'Missing View', angles: 'Angles', patfold: 'Hole Punch', cubes: 'Painted Cubes', form: 'Form' };

  function endLive(X, live, ended) {
    X.done = true;
    var res = SE().finish(live, rec(), now(), { usedMs: Math.min(live.usedMs, live.budgetMs), pausedMs: live.pausedMs, ended: ended });
    res.achievements = achieved();
    save();
    try { store.flush(); } catch (e) { /* the debounced save runs later */ }
    review(X, res);
  }

  function resumeCard(X, live) {
    if (live.usedMs >= live.budgetMs) { endLive(X, live, 'time'); return; } // its clock had run out
    setState(X, 'resume');
    clear(X);
    var P = live.parts[live.part], at = live.part + 1;
    X.wrap.appendChild(Play().screenHead('Section practice', 'Section in progress',
      'Your ' + live.size + ' section (form ' + live.form + ') stopped in part ' + at + ' of ' + live.parts.length + ', ' + shortOf(P.exId) + ', with ' + clockText(live.budgetMs - live.usedMs) + ' left on its clock.'));
    var go = ui.button('Resume the section', { kind: 'primary', onClick: function () { begin(X, live, false); } });
    go.setAttribute('data-sec-resume', '');
    var end = ui.button('End it and see the review', { kind: 'secondary', onClick: function () { endLive(X, live, 'user'); } });
    end.setAttribute('data-sec-endlive', '');
    X.wrap.appendChild(h('div.pl-summary-actions', go, end));
    X.wrap.appendChild(h('p.px-meta', 'Its clock stopped when you left, so no time was lost.'));
  }

  /* ---------- running ---------- */

  // The one line on guessing (note D1 addendum A.4 row 6: the official guide says there is no penalty for it).
  var GUESS = 'Guessing is not penalised: only right answers count, so answer every item, even with a guess. The Dental Admission Test has no penalty for guessing either.';

  function used(X) { return X.base + (X.C ? X.C.activeMs() : 0); }
  function pausedMs(X) {
    if (!X.wallStart) return X.pausedBase;
    var wall = now() - X.wallStart, active = X.C ? X.C.activeMs() : 0;
    return X.pausedBase + Math.max(0, wall - active - X.introMs - (X.introAt ? now() - X.introAt : 0));
  }
  function persist(X) {
    if (!X.run || X.run.done) return;
    try { SE().save(rec(), X.run, used(X), pausedMs(X), now()); } catch (e) { log('save failed', e); }
    save();
  }

  function begin(X, run, fresh) {
    // v1.2 test conditions: every run moves freely across its parts. A run saved by 1.1 goes on that way from
    // where it stopped (its closed parts stay closed: the engine skips logged parts).
    if (run.nav !== 'free') { run.nav = 'free'; run.begun = true; }
    X.run = run;
    X.base = run.usedMs || 0;
    X.pausedBase = run.pausedMs || 0;
    X.introMs = 0;
    X.wallStart = now();
    X.done = false;
    X.warned = {};      // a new section warns again at 5 and 1 minutes
    X.result = null;
    X.deferred = null;
    X.striking = false;
    if (!fresh) {
      // a resumed run: a part that cannot run here any more (no view, no 3D) ends with a note
      run.parts.forEach(function (Pt, p) {
        var def = PX.ex.get(Pt.exId);
        if (!Pt.broken && !Pt.logged && (!def || !can(def))) SE().breakPart(run, p, (def && why(def)) || 'cannot run on this device');
      });
    }
    clear(X);
    Play().setChrome(true);
    var P = X.P = Play().player({ endLabel: 'End the section', onState: function (s) { onPlayerState(X, s); } });
    X.wrap.appendChild(h('h1.px-sr', 'Section practice'));
    X.timer = h('span.sec-timer.px-num', { role: 'timer', 'data-sec-timer': '' });
    var tools = P.el.pauseBtn && P.el.pauseBtn.parentNode;
    if (tools) tools.insertBefore(X.timer, P.el.pauseBtn); else P.el.hud.appendChild(X.timer);
    P.el.pauseNote.textContent = 'The section clock is stopped while paused. A skipped item stays unanswered: Review lists it.';
    P.el.skip.firstChild.textContent = 'Skip this item';
    X.wrap.appendChild(P.el.root);
    X.wrap.appendChild(footer(X));
    X.el.list = h('div.sec-list', { hidden: true, 'data-sec-list': '' });
    X.wrap.appendChild(X.el.list);
    X.wrap.appendChild(h('span.px-sr', { id: 'sec-struck-desc' }, 'struck out'));
    strikeInput(X);
    X.C = makeClock();
    X.offs.push(X.C.on('tick', function () { tick(X); }));
    X.offs.push(X.C.on('pause', function () { tick(X); }));
    X.offs.push(X.C.on('resume', function () { tick(X); }));
    X.offs.push(bus.on('modal:open', function () { if (X.C) X.C.pause('modal'); }));
    X.offs.push(bus.on('modal:close', function () { if (X.C && !ui.modalOpen()) X.C.resume('modal'); }));
    // v1.2 O9: the page hidden or left (a reload, a closed tab, another app) writes the clock's time at once
    function checkpoint() {
      if (!X.run || X.done || !X.C) return;
      persist(X);
      try { store.flush({ evenIfHeld: true }); } catch (e) { /* the store's own pagehide write follows */ }
    }
    function onHide() { if (doc.hidden) checkpoint(); }
    win.addEventListener('pagehide', checkpoint);
    doc.addEventListener('visibilitychange', onHide);
    X.offs.push(function () { win.removeEventListener('pagehide', checkpoint); doc.removeEventListener('visibilitychange', onHide); });
    X.popKeys = keys.push({
      ArrowLeft: function () { if (X.mode !== 'item') return false; back(X); },
      ArrowRight: function () { if (X.mode !== 'item') return false; next(X); },
      f: function () { if (X.mode !== 'item') return false; toggleFlag(X); },
      m: function () { if (X.mode !== 'item') return false; toggleFlag(X); },
      x: function () { if (X.mode !== 'item') return false; setStrikeMode(X, !X.striking); },
      Escape: function () { if (X.mode !== 'list') return false; pauseList(X); },
    }, { through: true });
    X.C.start();
    tick(X);
    if (X.done) return; // no time was left: the review is up
    if (!run.begun) instructions(X);
    else resumeAt(X);
  }

  function onPlayerState(X, s) {
    if (!X.C) return;
    if (s === 'paused') X.C.pause('sheet');
    else X.C.resume('sheet');
  }

  // The countdown, the warnings and the end of time.
  function tick(X) {
    if (!X.run || X.done || !X.timer) return;
    var left = X.run.budgetMs - used(X);
    var stim = false;
    try { stim = doc.body.classList.contains('px-stim'); } catch (e) { stim = false; }
    // Rule 7: nothing on screen changes while a stimulus plays (body.px-stim), as in the player's
    // HUD; the next tick after it shows the time. The end of time is still checked.
    if (!stim) {
      X.timer.textContent = clockText(left);
      X.timer.setAttribute('aria-label', 'Time left: ' + minutesText(left));
      X.timer.classList.toggle('is-low', left <= 5 * 60000 && X.run.budgetMs > 10 * 60000 || left <= 60000);
      if (X.el.listClock) X.el.listClock.textContent = clockText(left) + ' left';
    }
    if (!stim) {
      [5, 1].forEach(function (m) {
        if (left <= m * 60000 && left > 0 && !X.warned[m] && X.run.budgetMs > m * 60000 * 2) {
          X.warned[m] = true;
          if (m === 5) X.warned[1] = X.warned[1] || left <= 60000; // one toast when both are due
          ui.toast(m === 1 || left <= 60000 ? 'One minute left on the section clock.' : 'Five minutes left on the section clock.', { kind: 'info' });
        }
      });
    }
    if (left <= 0) timeUp(X);
  }

  /* ---------- before the clock: every part's instructions ---------- */

  // The test's official candidate guide asks candidates to study the instructions before test day (note D1
  // addendum A.4 row 5), so a section shows all its parts' instructions first, with the clock not yet started.
  // The texts are Parallax's own (each exercise's goal and rules card), never the ADA's.
  function instructions(X) {
    var run = X.run;
    setState(X, 'instructions');
    X.C.pause('intro');
    X.introAt = now();
    X.el.foot.hidden = true;
    var lines = [h('p.sec-instr-lead', 'Read the instructions for every part now. The clock starts when you press Start the clock and runs until the section ends, across all its parts. The official candidate guide also asks candidates to study the instructions before test day.')];
    run.parts.forEach(function (Pt, p) {
      var def = PX.ex.get(Pt.exId), L = PX.ex.learn(Pt.exId) || {}, n = SE().partInfo(run, p).n;
      // a rules card line is a string, or { text, fig } with a picture the card draws (the text is enough here)
      var items = (Array.isArray(L.rules) ? L.rules : []).map(function (r) { return typeof r === 'string' ? r : r && typeof r.text === 'string' ? r.text : null; })
        .filter(Boolean).map(function (r) { return h('li', r); });
      if (Pt.exId === 'angles') items.push(h('li', 'Judge by eye: the Perceptual Ability Test does not allow rulers or other measuring tools.'));
      if (def && (def.extraParams || []).indexOf('ask') >= 0) items.push(h('li', 'Two to five questions in a row ask about the same figure, as in the test.'));
      lines.push(h('section.sec-instr-part', { 'data-sec-instr': Pt.exId },
        h('h3', 'Part ' + (p + 1) + ' of ' + run.parts.length + ': ' + shortOf(Pt.exId) + ' · ' + n + (n === 1 ? ' item' : ' items')),
        L.goal ? h('p', L.goal) : null,
        items.length ? h('ul', items) : null,
        Pt.broken ? h('p.px-meta', 'This part cannot be shown here, so its items do not count.') : null));
    });
    lines.push(h('section.sec-instr-part', { 'data-sec-instr': 'all' }, h('h3', 'During the section'), h('ul',
      h('li', 'One clock: ' + clockText(run.budgetMs) + ' for ' + totalItems(run) + ' items. As on the test, it stops while an item is being prepared; it also stops while you pause.'),
      h('li', 'Choose an answer to move on. Back and Next go to any item, across parts. Mark flags an item for later; Strike crosses out options you have ruled out (or press Shift with an option’s letter, or right-click it); Review lists the marked and unanswered items. Test takers describe these tools on the test’s screen; the official documents do not.'),
      h('li.sec-guess', GUESS),
      h('li', 'No feedback until the end, and your levels do not change. Then the review shows each part’s results and every item again.'))));
    lines.push(ada());
    Play().showCard(X.wrap, X.P.el.root, {
      id: 'sec-instructions', className: 'sec-instructions', title: 'Instructions · ' + run.size + ' section, form ' + run.form, hide: X.P.el.root, lines: lines,
      actions: [{ label: 'Start the clock', value: 'start', primary: true }],
    }).then(function (v) {
      if (X.done || v !== 'start') return;
      X.introMs += now() - X.introAt;
      X.introAt = 0;
      SE().begin(run);
      persist(X);
      X.C.resume('intro');
      var first = SE().step(run, 1, { part: 0, index: -1 });
      if (!first) { finish(X, 'done'); return; }
      show(X, first.part, first.index);
    });
    try { win.scrollTo(0, 0); } catch (e) { /* ignore */ }
  }

  // A resumed run: where it stopped, before its clock goes on.
  function resumeAt(X) {
    var run = X.run;
    setState(X, 'resume-card');
    X.C.pause('intro');
    X.introAt = now();
    X.el.foot.hidden = true;
    Play().showCard(X.wrap, X.P.el.root, {
      id: 'sec-resume', title: 'Part ' + (run.part + 1) + ' of ' + run.parts.length + ': ' + shortOf(run.parts[run.part].exId), hide: X.P.el.root,
      lines: ['You stopped at item ' + numberOf(run, run.index) + ' of ' + countOf(run) + '. ' + clockText(run.budgetMs - used(X)) + ' left on the section clock.'],
      actions: [{ label: 'Go on', value: 'start', primary: true }],
    }).then(function (v) {
      if (X.done || v !== 'start') return;
      X.introMs += now() - X.introAt;
      X.introAt = 0;
      X.C.resume('intro');
      var it = run.parts[run.part].items[run.index], P0 = run.parts[run.part];
      if (it && it.status !== 'void' && !P0.broken && !P0.logged) { show(X, run.part, run.index); return; }
      var nx = SE().step(run, 1);
      if (nx) show(X, nx.part, nx.index); else reviewList(X, 'end');
    });
  }

  /* ---------- under the item: Back, Mark, Strike, Review, Next ---------- */

  function footer(X) {
    var el = X.el;
    el.back = ui.button('Back', { kind: 'secondary', small: true, key: '←', ariaLabel: 'Previous item', onClick: function () { back(X); } });
    el.back.setAttribute('data-sec-back', '');
    el.flag = ui.button('Mark', { kind: 'secondary', small: true, key: 'm', ariaLabel: 'Mark this item for review', onClick: function () { toggleFlag(X); } });
    el.flag.setAttribute('data-sec-flag', '');
    el.flag.setAttribute('aria-pressed', 'false');
    el.strike = ui.button('Strike', { kind: 'secondary', small: true, key: 'x', ariaLabel: 'Strike out options: tap the options you have ruled out', onClick: function () { setStrikeMode(X, !X.striking); } });
    el.strike.setAttribute('data-sec-strike', '');
    el.strike.setAttribute('aria-pressed', 'false');
    el.items = ui.button('Review', { kind: 'secondary', small: true, ariaLabel: 'Review: marked and unanswered items', onClick: function () { if (X.mode === 'item') reviewList(X, 'open'); } });
    el.items.setAttribute('data-sec-items', '');
    el.next = ui.button('Skip', { kind: 'secondary', small: true, key: '→', onClick: function () { next(X); } }); // answers are the main action: Skip must not look like Next
    el.next.setAttribute('data-sec-next', '');
    el.strikeHint = h('p.px-meta.sec-strike-hint', { hidden: true, 'aria-live': 'polite' }, 'Striking: tap the options you have ruled out. Tap Strike again to answer.');
    el.foot = h('div.sec-foot', el.strikeHint, h('div.sec-controls', el.back, el.flag, el.strike, el.items, el.next));
    return el.foot;
  }

  // The number shown for an item: its place in the form, which never shifts; a replacement shows the number of
  // the item it replaces (v1.2 O11; PX.engine.section.numberOf). Out of the part's numbers (its original items).
  function numberOf(run, index, p) { return SE().numberOf(run, index, p); }
  function countOf(run, p) { return SE().numberCount(run, p); }
  function totalAnswered(run) { var n = 0; run.parts.forEach(function (P) { P.items.forEach(function (it) { if (it.status === 'answered') n++; }); }); return n; }
  function totalItems(run) { var n = 0; run.parts.forEach(function (P) { if (P.broken) return; P.items.forEach(function (it) { if (it.status !== 'void') n++; }); }); return n; }

  function updateControls(X) {
    var run = X.run, it = run.parts[run.part].items[run.index], el = X.el;
    if (!it) return;
    el.back.disabled = SE().step(run, -1) === null;
    el.flag.setAttribute('aria-pressed', it.flag ? 'true' : 'false');
    el.flag.classList.toggle('is-on', !!it.flag);
    el.flag.firstChild.textContent = it.flag ? 'Marked' : 'Mark';
    el.next.firstChild.textContent = it.status === 'answered' ? 'Next' : 'Skip';
    X.P.setMeta('Part ' + (run.part + 1) + ' of ' + run.parts.length + ' · item ' + numberOf(run, run.index) + ' of ' + countOf(run));
    X.P.setProgress(totalAnswered(run), totalItems(run));
  }

  /* ---------- strike-out (v1.2: as test takers describe the screen) ---------- */

  function choiceButtons(X) {
    var t = X.P && X.P.el ? X.P.el.trial : null;
    return t ? Array.prototype.slice.call(t.querySelectorAll('.px-choice[data-index]')) : [];
  }
  function struckOf(X) {
    var run = X.run, it = run ? run.parts[run.part].items[run.index] : null;
    return it && Array.isArray(it.struck) ? it.struck : [];
  }
  function applyStrikes(X) {
    var s = struckOf(X), bs = choiceButtons(X);
    bs.forEach(function (b) {
      var on = s.indexOf(parseInt(b.getAttribute('data-index'), 10)) >= 0;
      b.classList.toggle('is-struck', on);
      if (on) b.setAttribute('aria-describedby', 'sec-struck-desc');
      else if (b.getAttribute('aria-describedby') === 'sec-struck-desc') b.removeAttribute('aria-describedby');
    });
    X.el.strike.disabled = !bs.length; // a view without options (none of the six today) has nothing to strike
  }
  function strikeAt(X, i) {
    if (X.mode !== 'item' || !choiceButtons(X).length || i >= choiceButtons(X).length) return;
    if (SE().strike(X.run, X.run.index, i) === null) return;
    persist(X);
    applyStrikes(X);
  }
  function setStrikeMode(X, on) {
    X.striking = !!on && choiceButtons(X).length > 0;
    X.el.strike.setAttribute('aria-pressed', X.striking ? 'true' : 'false');
    X.el.strike.classList.toggle('is-on', X.striking);
    X.el.strikeHint.hidden = !X.striking;
    if (X.P && X.P.el.trial) X.P.el.trial.classList.toggle('sec-striking', X.striking);
  }
  // While striking, a click on an option crosses it out instead of answering (the capture phase runs before
  // the choice grid's own click); a right-click always does, and Shift with an option's letter (keys below).
  function strikeInput(X) {
    var root = X.P.el.trial;
    function opt(e) { var b = e.target && e.target.closest ? e.target.closest('.px-choice[data-index]') : null; return b && root.contains(b) ? b : null; }
    root.addEventListener('click', function (e) {
      if (!X.striking || X.mode !== 'item') return;
      var b = opt(e);
      if (!b) return;
      e.preventDefault();
      e.stopPropagation();
      strikeAt(X, parseInt(b.getAttribute('data-index'), 10));
    }, true);
    root.addEventListener('contextmenu', function (e) {
      if (X.mode !== 'item') return;
      var b = opt(e);
      if (!b) return;
      e.preventDefault();
      strikeAt(X, parseInt(b.getAttribute('data-index'), 10));
    });
  }
  // A key layer above the item's choice grid: Shift with an option's letter strikes it; while striking, the
  // option keys themselves strike (letters on a lettered grid, digits on any).
  function strikeKeys(X) {
    if (X.popStrike) { X.popStrike(); X.popStrike = null; }
    if (!choiceButtons(X).length) return;
    var map = {}, letters = !!(X.P.ctx && X.P.ctx.letters);
    'abcde'.split('').forEach(function (k, i) {
      map[k] = function (e) { if (!letters || X.mode !== 'item' || !((e && e.shiftKey) || X.striking)) return false; strikeAt(X, i); };
    });
    '12345'.split('').forEach(function (k, i) {
      map[k] = function () { if (X.mode !== 'item' || !X.striking) return false; strikeAt(X, i); };
    });
    X.popStrike = keys.push(map, { through: true });
  }

  /* ---------- one item ---------- */

  function show(X, part, index) {
    var run = X.run, it = SE().go(run, index, part);
    if (X.done || !it) return;
    var Pt = run.parts[run.part];
    if (it.status === 'void') { goOn(X); return; } // its replacement waits at the end of the part
    closeList(X);
    setState(X, 'item');
    if (Play().closeCards) Play().closeCards();
    X.P.el.root.hidden = false;
    X.el.foot.hidden = false;
    var def = PX.ex.get(Pt.exId), item = null, tok = ++X.token;
    if (!def || !X.P.use(Pt.exId)) { partGone(X, (def && why(def)) || 'could not be shown here'); return; }
    // The clock stops while the item is prepared, as the test's own clock does (note D1 addendum A.4 row 1):
    // from here to its painted frame, where the answer clock starts.
    X.C.pause('prep');
    try { item = def.generate(PX.rng(it.seed >>> 0), it.params); } catch (e) { log('generate failed (' + Pt.exId + ')', e); item = null; }
    if (!item) { X.C.resume('prep'); voidItem(X, index, 'error'); return; }
    X.P.setLabel(def);
    setStrikeMode(X, false);
    updateControls(X);
    X.visitAt = 0;
    var pr = X.P.run(item, { feedback: false, hideItem: false, goal: Play().goalOf(PX.ex.learn(def.id), item) });
    if (it.status === 'answered' && X.P.grid && isNum(it.resp)) X.P.grid.select(it.resp); // the earlier answer, shown as chosen
    X.P.when('respond').then(function () {
      if (tok !== X.token) return;
      if (X.C) X.C.resume('prep');
      if (!X.visitAt) X.visitAt = tnow();
      applyStrikes(X);
      strikeKeys(X);
    });
    pr.then(function (tr) { if (tok === X.token) onTrial(X, index, tr); });
  }

  // Viewing time of the current visit (answer clock minus pauses), recorded once per visit.
  function visitMs(X) {
    var P = X.P, paused = P ? P.pausedMs + (P.pauseStart ? tnow() - P.pauseStart : 0) : 0;
    return X.visitAt ? Math.max(0, tnow() - X.visitAt - paused) : 0;
  }
  function leave(X) {
    if (X.mode !== 'item') return;
    var run = X.run, ms = visitMs(X);
    X.token++;
    if (X.visitAt) SE().visit(run, run.index, ms, now());
    X.visitAt = 0;
    if (X.popStrike) { X.popStrike(); X.popStrike = null; }
    setStrikeMode(X, false);
    if (X.C) X.C.resume('prep');
    if (X.P) X.P.abort();
  }

  function onTrial(X, index, tr) {
    var run = X.run;
    if (!tr || tr.outcome === 'aborted' || X.done) return;
    var ms = isNum(tr.rtMs) ? tr.rtMs : visitMs(X);
    X.visitAt = 0;
    if (X.popStrike) { X.popStrike(); X.popStrike = null; }
    setStrikeMode(X, false);
    if (tr.end) {
      SE().visit(run, index, ms, now());
      askEnd(X, run.part, index);
      return;
    }
    if (tr.outcome === 'skipped') { SE().visit(run, index, ms, now()); persist(X); goOn(X); return; }
    if (tr.outcome === 'stutter') { SE().visit(run, index, ms, now()); voidItem(X, index, tr.voidReason || 'stutter'); return; }
    SE().visit(run, index, ms, now());
    SE().answer(run, index, { response: tr.response, correct: !!(tr.result && tr.result.correct), rtMs: tr.rtMs, input: tr.input || tr.source }, now()); // tr.input: the answering event's device (H4)
    persist(X);
    updateControls(X);
    var tok = ++X.token;
    win.setTimeout(function () { if (tok === X.token && !X.done) goOn(X); }, Play().isFast && Play().isFast() ? 0 : config.nextMs);
  }

  function voidItem(X, index, reason) {
    var r = SE().answer(X.run, index, { voided: true, voidReason: reason }, now());
    persist(X);
    if (r.broken) { partGone(X, r.broken); return; } // its items keep failing to draw: the part ends with a note
    ui.toast(r.replaced !== null ? 'That item was interrupted, so it does not count. A new one joins the end of this part.' : 'That item was interrupted, so it does not count.', { kind: 'info' });
    goOn(X);
  }

  // A part whose exercise cannot be shown here (it does not mount, or its items keep failing to draw): a note,
  // and on to the next part. Its items that were not shown do not count.
  function partGone(X, why0) {
    var run = X.run, p = run.part;
    SE().breakPart(run, p, why0);
    persist(X);
    ui.toast('Part ' + (p + 1) + ', ' + shortOf(run.parts[p].exId) + ', cannot be shown here, so its items do not count.', { kind: 'warn' });
    goOn(X);
  }

  // After an item: the next one across the parts, else the review list (the end of the section).
  function goOn(X) {
    var nx = SE().step(X.run, 1);
    if (nx) show(X, nx.part, nx.index); else reviewList(X, 'end');
  }
  function back(X) {
    var pv = SE().step(X.run, -1);
    if (!pv || X.mode !== 'item') return;
    leave(X);
    show(X, pv.part, pv.index);
  }
  function next(X) {
    if (X.mode !== 'item') return;
    leave(X);
    persist(X);
    goOn(X);
  }
  function toggleFlag(X) {
    if (X.mode !== 'item') return;
    SE().flag(X.run, X.run.index);
    persist(X);
    updateControls(X);
  }

  /* ---------- the review list (the clock runs) ---------- */

  // Marked and unanswered items across every part, as test takers describe the test's review screen (the
  // official documents do not describe it): why 'open' (Review under an item) or 'end' (after the last item).
  function reviewList(X, why0) {
    if (X.done || !X.run) return;
    if (X.mode === 'item') leave(X);
    if (X.C) X.C.resume('prep');
    if (Play().closeCards) Play().closeCards();
    setState(X, 'list');
    X.listWhy = why0;
    X.el.foot.hidden = true;
    X.P.el.trial.hidden = true;
    X.P.el.feedback.hidden = true;
    if (X.P.el.guide) X.P.el.guide.hidden = true; // the last item's goal line
    if (X.P.el.pauseBtn) X.P.el.pauseBtn.hidden = true; // the list has its own Pause (the player has no item to pause)
    X.P.setLabel(null, 'Section practice');
    X.P.setMeta('Review · ' + totalAnswered(X.run) + ' of ' + totalItems(X.run) + ' answered');
    var run = X.run, K = PX.ui.kit, L = X.el.list;
    ui.clear(L);
    L.hidden = false;
    var marked = SE().list(run, 'marked'), open = SE().list(run, 'unanswered'), all = SE().list(run, 'all');
    var filter = X.listFilter && { marked: 1, unanswered: 1, all: 1 }[X.listFilter] ? X.listFilter : open.length ? 'unanswered' : marked.length ? 'marked' : 'all';
    X.el.listClock = h('span.sec-list-clock.px-num', { 'aria-hidden': 'true' });
    var head = h('div.sec-list-head', h('h2', 'Review'), X.el.listClock);
    var lead = h('p.sec-list-lead', why0 === 'end' ? 'That was the last item. Go to any marked or unanswered item, or end the section. The clock is running.' : 'Go to any item, in any part. The clock is running.');
    var guess = open.length ? h('p.px-meta.sec-guess', open.length + (open.length === 1 ? ' item is' : ' items are') + ' not answered yet. ' + GUESS) : null;
    var chips = h('div.sec-list-parts');
    var seg = K.segmented({
      key: 'secList', legend: 'Show', value: filter,
      options: [{ value: 'marked', label: 'Marked (' + marked.length + ')' }, { value: 'unanswered', label: 'Unanswered (' + open.length + ')' }, { value: 'all', label: 'All (' + all.length + ')' }],
      onChange: function (v) { X.listFilter = filter = v; draw(); },
    });
    function draw() {
      ui.clear(chips);
      var lst = filter === 'marked' ? marked : filter === 'unanswered' ? open : all;
      if (!lst.length) { chips.appendChild(h('p.px-meta', filter === 'marked' ? 'No item is marked.' : 'Every item has an answer.')); return; }
      run.parts.forEach(function (Pt, pi) {
        var mine = lst.filter(function (e) { return e.part === pi; });
        if (!mine.length) return;
        var row = h('div.sec-chips');
        mine.forEach(function (e) {
          var st = e.answered ? 'answered' : e.seen ? 'seen' : 'new';
          var b = h('button', { type: 'button', class: ['sec-chip', 'is-' + st, e.flag ? 'is-flagged' : null, e.current ? 'is-current' : null], 'data-sec-item': pi + ':' + e.index,
            'aria-label': 'Part ' + (pi + 1) + ', item ' + e.no + ', ' + (e.answered ? 'answered' : 'not answered') + (e.flag ? ', marked' : '') + (e.current ? ', the last one open' : '') },
            h('span.sec-chip-n', String(e.no)),
            e.answered ? h('span.sec-chip-dot', { 'aria-hidden': 'true' }, '●') : null, // answered: a mark, not colour alone (rule 8)
            e.flag ? h('span.sec-chip-flag', { 'aria-hidden': 'true' }, '⚑') : null);
          b.addEventListener('click', function () { if (X.mode === 'list') show(X, e.part, e.index); });
          row.appendChild(b);
        });
        chips.appendChild(h('div.sec-partlist', h('h3', 'Part ' + (pi + 1) + ' · ' + shortOf(Pt.exId)), row));
      });
    }
    draw();
    var acts = [];
    var cur = run.parts[run.part] && run.parts[run.part].items[run.index];
    if (cur && cur.status !== 'void' && !run.parts[run.part].broken) {
      var ret = ui.button(why0 === 'end' ? 'Back to the last item' : 'Back to part ' + (run.part + 1) + ', item ' + numberOf(run, run.index), { kind: 'secondary', onClick: function () { show(X, run.part, run.index); } });
      ret.setAttribute('data-sec-return', '');
      acts.push(ret);
    }
    var pz = ui.button('Pause', { kind: 'secondary', ariaLabel: 'Pause (Escape)', onClick: function () { pauseList(X); } });
    pz.setAttribute('data-sec-pause', '');
    acts.push(pz);
    var endB = ui.button('End the section', { kind: 'primary', onClick: function () { askEnd(X, null, null); } });
    endB.setAttribute('data-sec-end', '');
    acts.push(endB);
    L.appendChild(h('section.px-panel.sec-list-panel', { 'aria-label': 'Review list' }, head, lead, guess, seg, chips, h('div.pl-summary-actions', acts)));
    tick(X);
    try { var r0 = L.getBoundingClientRect(); if (r0.top < 0 || r0.top > win.innerHeight * 0.5) L.scrollIntoView({ block: 'start', behavior: 'auto' }); } catch (e) { /* ignore */ }
    persist(X);
  }
  function closeList(X) {
    if (!X.el.list || X.el.list.hidden) return;
    X.el.list.hidden = true;
    ui.clear(X.el.list);
    X.el.listClock = null;
    if (X.P) { X.P.el.trial.hidden = false; if (X.P.el.guide) X.P.el.guide.hidden = false; if (X.P.el.pauseBtn) X.P.el.pauseBtn.hidden = false; }
  }
  // The list's own pause: a sheet over it stops the clock (any open modal does).
  function pauseList(X) {
    if (X.mode !== 'list' || ui.modalOpen()) return;
    ui.modal({ title: 'Paused', body: 'The section clock is stopped.', actions: [{ label: 'Resume', value: 'resume', primary: true }] });
  }

  function askEnd(X, part, index) {
    var back0 = X.mode;
    setState(X, 'confirm');
    var open = SE().list(X.run, 'unanswered').length;
    ui.confirm((open ? open + (open === 1 ? ' item is' : ' items are') + ' not answered and will stay unanswered. ' : '') + 'The review with your results opens. The clock is stopped while you decide.', {
      title: 'End the section now?', ok: 'End the section', cancel: 'Keep going',
    }).then(function (yes) {
      if (X.done) return;
      if (yes) { finish(X, 'user'); return; }
      if (back0 === 'list' || part === null) { reviewList(X, X.listWhy || 'open'); return; }
      show(X, part, index);
    });
  }

  function timeUp(X) {
    if (X.done) return;
    leave(X);
    if (Play().closeCards) Play().closeCards();
    finish(X, 'time');
  }

  function finish(X, ended) {
    if (X.done || !X.run) return;
    X.token++;
    var u = Math.min(used(X), X.run.budgetMs), pz = pausedMs(X);
    X.done = true;
    stopRun(X);
    var res = null;
    try { res = SE().finish(X.run, rec(), now(), { usedMs: u, pausedMs: pz, ended: ended }); } catch (e) { log('finish failed', e); }
    if (res) res.achievements = achieved();
    save();
    try { store.flush(); } catch (e) { /* the debounced save runs later */ }
    if (ended === 'time') ui.toast('Time is up: the section has ended.', { kind: 'info' });
    if (res) review(X, res);
    else { clear(X); X.wrap.appendChild(Play().screenHead('Section practice', 'The section ended', 'Its results could not be put together.')); }
  }

  // Stops the clock, the player and the keys of a running section (its run state stays).
  function stopRun(X) {
    if (X.popKeys) { X.popKeys(); X.popKeys = null; }
    if (X.popStrike) { X.popStrike(); X.popStrike = null; }
    X.offs.forEach(function (off) { try { off(); } catch (e) { /* ignore */ } });
    X.offs = [];
    if (X.C) { try { X.C.destroy(); } catch (e) { /* ignore */ } X.C = null; }
    if (Play().closeCards) Play().closeCards();
    if (X.P) { X.P.destroy(); X.P = null; }
    X.el.listClock = null;
    Play().setChrome(false);
  }

  function leaveScreen(X) {
    if (X.run && !X.done && X.C) {
      leave(X);
      if (X.introAt) { X.introMs += now() - X.introAt; X.introAt = 0; }
      persist(X); // kept in rec.section.live: the next visit offers to resume it
      try { store.flush(); } catch (e) { /* ignore */ }
    }
    if (X.mode === 'review') reviewClosed(); // another screen: the review is closed (a reload would not run this)
    X.done = true;
    X.token++;
    stopRun(X);
    if (X.RP) { X.RP.destroy(); X.RP = null; }
    if (current === X) current = null;
  }

  // A section is practice: its session can complete a practice achievement (Week done, …).
  function achieved() {
    try { return E().achievements && E().achievements.check ? E().achievements.check(rec(), now()) : []; } catch (e) { log('achievements failed', e); return []; }
  }

  /* ---------- the review ---------- */

  function statusText(e) {
    // the list holds shown items only; one without an answer was skipped or left when the section ended
    var s = e.status === 'answered' ? (e.correct ? 'right' : 'wrong') : 'not answered';
    return s + (e.flag ? ', flagged' : '');
  }
  function mark(e) { return e.status === 'answered' ? (e.correct ? '✓' : '✗') : '–'; }
  function fact(k, v) { return h('div', h('dt', k), h('dd.px-num', v)); }

  function review(X, res) {
    setState(X, 'review');
    clear(X);
    X.result = res;
    X.rtoken = 0;
    var s = res.summary, run = res.run, K = PX.ui.kit;
    var ended = s.ended === 'time' ? 'The time ran out.' : s.ended === 'user' ? 'You ended the section early.' : 'You finished every part.';
    X.wrap.appendChild(Play().screenHead('Section practice · ' + s.size + ' · form ' + s.form, 'Review', ended + ' Your levels did not change.'));
    var box = h('div.sec-review', { 'data-sec-review': '' });
    X.wrap.appendChild(box);

    var p = K.panel({ title: 'Results', className: 'pl-panel sec-results', aside: K.fmtWhen(s.end) });
    p.body.appendChild(h('dl.px-facts.sec-totals', fact('Right', s.right + ' of ' + s.n), fact('Answered', s.answered + ' of ' + s.n),
      fact('Time used', clockText(s.usedMs) + ' of ' + clockText(s.budgetMs)), fact('Paused', s.pausedMs >= 1000 ? minutesText(s.pausedMs) : 'no pauses')));
    // Each cell carries its column's name (data-label): on a phone a part's numbers stack under its
    // name, labelled, instead of running together (RV-play-dat: "3 1:01" read as "31:01").
    var rows = res.parts.map(function (x, i) {
      var per = x.seen ? Math.round(x.timeMs / x.seen / 1000) + ' s' : '–';
      var name = h('th', { scope: 'row' }, (i + 1) + '. ' + shortOf(x.exId));
      if (!x.reached) return h('tr', { 'data-part': x.exId, class: 'is-unreached' }, name, h('td.sec-unreached', { colSpan: 4 }, x.broken ? 'not shown here' : 'not reached'));
      return h('tr', { 'data-part': x.exId }, name,
        h('td.px-num', { 'data-label': 'Right' }, x.right + '/' + x.n), h('td.px-num', { 'data-label': 'Answered' }, String(x.answered) + (x.broken ? ' (ended early)' : '')),
        h('td.px-num', { 'data-label': 'Time' }, clockText(x.timeMs)), h('td.px-num', { 'data-label': 'Per item' }, per));
    });
    p.body.appendChild(h('div.sec-tablewrap', h('table.sec-table', h('caption.px-sr', 'Results by part'),
      h('thead', h('tr', h('th', { scope: 'col' }, 'Part'), h('th', { scope: 'col' }, 'Right'), h('th', { scope: 'col' }, 'Answered'), h('th', { scope: 'col' }, 'Time'), h('th', { scope: 'col' }, 'Per item'))),
      h('tbody', rows))));
    p.body.appendChild(h('p.px-meta', 'Per item: the part’s time over the items you looked at. The Perceptual Ability Test allows about ' + Math.round(SE().PACE_MS / 1000) + ' seconds an item over its six parts.'));
    p.body.appendChild(h('p.px-meta', 'These counts are for comparing your own sections. Parallax does not turn them into a score or a prediction for the Dental Admission Test.'));
    (res.achievements || []).forEach(function (a) { p.body.appendChild(h('p.sec-award', K.icon('award'), h('span', h('b', a.name), ': ' + a.desc))); });
    if (run.missing && run.missing.length) p.body.appendChild(h('p.px-meta', andList(run.missing.map(function (m) { return PART_NAMES[m.id] || shortOf(m.id); })) + ' could not be part of this section.'));
    box.appendChild(p.el);

    var again = SE().review(res, 'again'), all = SE().review(res, 'all');
    all.forEach(function (e) { e.n = SE().numberOf(run, e.index, e.part); });
    again.forEach(function (e) { e.n = SE().numberOf(run, e.index, e.part); });
    var ip = K.panel({ title: 'Items to look at again', className: 'pl-panel sec-items-panel' });
    var filter = again.length ? 'again' : 'all';
    var lists = h('div.sec-lists');
    var seg = K.segmented({
      key: 'secFilter', legend: 'Show', value: filter,
      options: [{ value: 'again', label: 'To look at again (' + again.length + ')' }, { value: 'all', label: 'All (' + all.length + ')' }],
      hint: 'Each item opens with your answer and the right one marked, and its show-me. Unanswered items ask for an answer first. Nothing here is scored.',
      onChange: function (v) { filter = v; drawLists(); },
    });
    ip.body.appendChild(seg);
    ip.body.appendChild(lists);
    X.el.stageHead = h('p.sec-stage-head', { 'aria-live': 'polite' });
    X.el.stageHint = h('p.px-meta.sec-stage-hint');
    X.el.stageBody = h('div.sec-stage-body');
    var close = ui.button('Close', { kind: 'ghost', small: true, onClick: function () { closeStage(X); } });
    close.setAttribute('data-sec-stage-close', '');
    X.el.stage = h('div.sec-stage', { hidden: true, 'data-sec-stage': '' }, h('div.sec-stage-top', X.el.stageHead, close), X.el.stageHint, X.el.stageBody);
    ip.body.appendChild(X.el.stage);
    box.appendChild(ip.el);
    function drawLists() {
      ui.clear(lists);
      var list = filter === 'all' ? all : again;
      if (!list.length) { lists.appendChild(h('p.px-meta', all.length ? 'Nothing to look at again: every item you answered was right, and none is flagged.' : 'No item was shown in this section.')); return; }
      run.parts.forEach(function (P, pi) {
        var mine = list.filter(function (e) { return e.part === pi; });
        if (!mine.length) return;
        var row = h('div.sec-chips');
        mine.forEach(function (e) {
          var st = e.status === 'answered' ? (e.correct ? 'right' : 'wrong') : 'open';
          var b = h('button', { type: 'button', class: ['sec-chip', 'is-' + st, e.flag ? 'is-flagged' : null], 'data-sec-chip': pi + ':' + e.index, 'aria-label': 'Part ' + (pi + 1) + ', item ' + e.n + ': ' + statusText(e) },
            h('span.sec-chip-n', String(e.n)), h('span.sec-chip-mark', { 'aria-hidden': 'true' }, mark(e)), e.flag ? h('span.sec-chip-flag', { 'aria-hidden': 'true' }, '⚑') : null);
          b.addEventListener('click', function () { openItem(X, list, list.indexOf(e)); });
          row.appendChild(b);
        });
        lists.appendChild(h('div.sec-partlist', h('h3', 'Part ' + (pi + 1) + ' · ' + shortOf(P.exId)), row));
      });
    }
    drawLists();

    var more = ui.button('Another section', { kind: 'primary', onClick: function () { closeStage(X); reviewClosed(); X.done = false; setup(X, { size: s.size }); try { win.scrollTo(0, 0); } catch (e) { /* ignore */ } } });
    more.setAttribute('data-sec-again', '');
    box.appendChild(h('div.pl-summary-actions', more, ui.button('Back to the Library', { kind: 'secondary', go: 'library' })));
    box.appendChild(ada());
    // a reload from here comes back to this review (v1.2 O10); leaving it any other way closes it
    try { if (SE().lastOpen && SE().lastOpen(rec(), true)) save(); } catch (e) { log('keeping the review open failed', e); }
    try { win.scrollTo(0, 0); } catch (e) { /* ignore */ }
  }
  function reviewClosed() { try { if (SE().lastOpen && SE().lastOpen(rec(), false)) save(); } catch (e) { /* ignore */ } }


  // One item of the review: the item again, the player's answer replayed so the reveal marks it
  // and the right one, then show-me (automatic after a wrong answer, a button after a right one).
  function openItem(X, list, k) {
    var e = list[k];
    if (!e) { closeStage(X); return; }
    var def = PX.ex.get(e.exId), view = PX.ex.view(e.exId);
    X.el.stage.hidden = false;
    X.el.stageHead.textContent = 'Part ' + (e.part + 1) + ' · item ' + e.n + ': ' + statusText(e);
    if (!X.RP) {
      X.RP = Play().player({ endLabel: 'Close the review' });
      X.el.stageBody.appendChild(X.RP.el.root);
    }
    var RP = X.RP, tok = ++X.rtoken, item = null;
    if (!def || !RP.use(e.exId)) { X.el.stageHint.textContent = 'This item cannot be shown on this device.'; return; }
    try { item = def.generate(PX.rng(e.seed >>> 0), e.params); } catch (err) { log('generate failed', err); }
    if (!item) { X.el.stageHint.textContent = 'This item could not be drawn.'; return; }
    var replay = e.status === 'answered' && view && view.layout === 'stem+options' && isNum(e.resp);
    X.el.stageHint.textContent = replay ? 'Your answer is marked, and the right one has a ✓.' : e.status === 'answered' ? 'Answer it again to see the solution.' : 'Answer it now to see the solution.';
    RP.setLabel(def);
    RP.setMeta('Review ' + (k + 1) + ' of ' + list.length + ' · not scored');
    RP.setProgress(k + 1, list.length);
    var pr = RP.run(item, { feedback: true, practice: true, goal: Play().goalOf(PX.ex.learn(def.id), item) });
    RP.when('respond').then(function () { if (tok === X.rtoken && replay && RP.grid) RP.grid.pick(e.resp, 'api'); });
    pr.then(function (tr) {
      if (tok !== X.rtoken || !tr || tr.outcome === 'aborted') return null;
      if (tr.end) { closeStage(X); return null; }
      if (tr.outcome === 'skipped') { openItem(X, list, k + 1); return null; }
      if (tr.result && tr.result.correct && RP.view && RP.view.showMe && RP.el.showBtn) {
        RP.el.showBtn.firstChild.textContent = 'Show me';
        RP.el.showBtn.hidden = false;
      }
      return RP.waitNext({ label: k + 1 < list.length ? 'Next item' : 'Done' }).then(function (w) {
        if (tok !== X.rtoken || w !== 'next') return;
        if (k + 1 < list.length) openItem(X, list, k + 1); else closeStage(X);
      });
    });
    try { X.el.stage.scrollIntoView({ block: 'start', behavior: 'auto' }); } catch (err) { /* ignore */ }
  }

  function closeStage(X) {
    X.rtoken = (X.rtoken || 0) + 1;
    if (X.RP) { X.RP.destroy(); X.RP = null; }
    if (X.el.stage) { X.el.stage.hidden = true; ui.clear(X.el.stageBody); }
  }

  /* ---------- exports ---------- */

  var current = null;
  function state() {
    var X = current;
    if (!X) return null;
    var r = X.run || (X.result && X.result.run) || null; // a review reopened after a reload has only its result
    return {
      mode: X.mode, done: X.done, part: r ? r.part : null, index: r ? r.index : null, parts: r ? r.parts.map(function (p) { return p.exId; }) : [], striking: !!X.striking,
      usedMs: X.result ? X.result.summary.usedMs : r ? used(X) : 0, budgetMs: r ? r.budgetMs : 0, running: !!(X.C && X.C.running && X.C.running()),
      result: X.result ? X.result.summary : null, run: r,
    };
  }

  PX.ui.section = { config: config, state: state, PART_NAMES: PART_NAMES };
  win.__section = { get state() { return state(); } };
  PX.ui.screens = PX.ui.screens || {};
  PX.ui.screens.section = { title: 'Section practice', render: render };
})(window.PX);
