/* PX.ui.screens.section: Section practice (route 'section'; v1.1 PLAN M5; R3 §9, §6).
   A rehearsal of the Perceptual Ability Test's constraints: the DAT-style formats in the test's
   order (PX.engine.section), one clock for the whole section (PX.core.clock: active time, stopped
   by the pause sheet, any modal, a hidden tab, five idle minutes, and while a part's instructions
   are open), no feedback until a review at the end, no rating change, no score prediction.

   Flow: setup (size, form, the parts this build has, the rules) or "resume" when a run is live
   in rec.section.live → per part an instruction card (clock stopped) → items through the trial
   player (PX.ui.play.player, feedback off). Choosing an answer moves on; Back, Flag and Next or
   Skip sit under the item, with a strip of the part's items to jump between (current part
   only). After a part's last item a card lists what is unanswered or flagged; moving on closes
   the part (its trials are logged then, mode 'section'). A voided item (stutter, device turned)
   does not count and a replacement joins the end of its part. Time up, "End the section" (pause
   sheet) or the last part's end → the review: each part's results and pacing, then the items to
   look at again, each replayed with its answer, the right answer and its show-me.
   The run is saved between items, so a reload offers to resume it. Never during a stimulus.

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
    if (live) resumeCard(X, live); else setup(X, route.params || {});
    return function cleanup() { leaveScreen(X); };
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
        hint: size === 'mini' ? 'Five items a part: a short section that fits a phone and a break.' : 'Fifteen items a part' + (sh.parts.length === sh.of ? ', the length of the real test’s perceptual section.' : '.'),
        onChange: function (v) { size = v; draw(); },
      });
      body.appendChild(sizes);
      var runs = rec().section && Array.isArray(rec().section.runs) ? rec().section.runs : [], last = runs[runs.length - 1];
      if (last) body.appendChild(h('p.px-meta.sec-last', 'Your last section: ' + last.size + ', form ' + last.form + ', ' + last.right + ' of ' + last.n + ' right in ' + clockText(last.usedMs) + ' (' + K.fmtWhen(last.end) + '). Section runs are also in the Log.'));
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
        fresh ? h('p.px-field-hint.sec-new', (fresh === 1 ? 'One format is' : fresh + ' formats are') + ' new to you, and a section gives no feedback until the end. Each part starts with its rules, but Watch, Try, Go in the Library teaches a format best. ',
          ui.button('Open the Library', { kind: 'ghost', small: true, go: 'library' })) : null,
        sh.missing.length ? h('p.px-field-hint.sec-missing', andList(sh.missing.map(function (m) { return PART_NAMES[m.id] || shortOf(m.id); })) + (sh.missing.length === 1 ? ' is' : ' are') + ' not part of this section here, so it has ' + sh.parts.length + ' of the ' + sh.of + ' parts: ' + sh.items + ' items in ' + SE().fmtMinutes(sh.budgetMs) + ', the same pace.') : null));
      body.appendChild(h('ul.sec-rules',
        h('li', 'One clock for the whole section: ' + sh.items + ' items in ' + SE().fmtMinutes(sh.budgetMs) + ', about 40 seconds an item, the real test’s average pace.'),
        h('li', 'No feedback until the end. Skip, flag and go back to any item of the part you are in; once you move on to the next part, you cannot return.'),
        h('li', 'Pause stops the clock, and so does reading a part’s instructions. The review reports your pauses.'),
        h('li', 'Your levels do not change. The review shows each part’s results and pacing, with a show-me for every item. Parallax does not predict your score on the real test.')));
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
    X.run = run;
    X.base = run.usedMs || 0;
    X.pausedBase = run.pausedMs || 0;
    X.introMs = 0;
    X.wallStart = now();
    X.done = false;
    X.warned = {};      // a new section warns again at 5 and 1 minutes
    X.result = null;
    X.deferred = null;
    if (!fresh) {
      // a resumed run: a part that cannot run here any more (no view, no 3D) ends with a note
      run.parts.forEach(function (Pt, p) {
        var def = PX.ex.get(Pt.exId);
        if (p >= run.part && !Pt.broken && (!def || !can(def))) SE().breakPart(run, p, (def && why(def)) || 'cannot run on this device');
      });
    }
    clear(X);
    Play().setChrome(true);
    var P = X.P = Play().player({ endLabel: 'End the section', onState: function (s) { onPlayerState(X, s); } });
    X.wrap.appendChild(h('h1.px-sr', 'Section practice'));
    X.timer = h('span.sec-timer.px-num', { role: 'timer', 'data-sec-timer': '' });
    var tools = P.el.pauseBtn && P.el.pauseBtn.parentNode;
    if (tools) tools.insertBefore(X.timer, P.el.pauseBtn); else P.el.hud.appendChild(X.timer);
    P.el.pauseNote.textContent = 'The section clock is stopped while paused. A skipped item stays unanswered; you can come back to it in this part.';
    P.el.skip.firstChild.textContent = 'Skip this item';
    X.wrap.appendChild(P.el.root);
    X.wrap.appendChild(footer(X));
    X.C = makeClock();
    X.offs.push(X.C.on('tick', function () { tick(X); }));
    X.offs.push(X.C.on('pause', function () { tick(X); }));
    X.offs.push(X.C.on('resume', function () { tick(X); }));
    X.offs.push(bus.on('modal:open', function () { if (X.C) X.C.pause('modal'); }));
    X.offs.push(bus.on('modal:close', function () { if (X.C && !ui.modalOpen()) X.C.resume('modal'); }));
    X.popKeys = keys.push({
      ArrowLeft: function () { if (X.mode !== 'item') return false; back(X); },
      ArrowRight: function () { if (X.mode !== 'item') return false; next(X); },
      f: function () { if (X.mode !== 'item') return false; toggleFlag(X); },
    }, { through: true });
    X.C.start();
    tick(X);
    if (X.done) return; // no time was left: the review is up
    setStrip(X, display() === 'large'); // a phone opens the strip with Items
    if (fresh || X.run.index === 0 || X.run.parts[X.run.part].broken) partIntro(X, X.run.part);
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

  /* ---------- under the item: Back, Flag, Next; the part's strip ---------- */

  function footer(X) {
    var el = X.el;
    el.back = ui.button('Back', { kind: 'secondary', small: true, key: '←', ariaLabel: 'Previous item', onClick: function () { back(X); } });
    el.back.setAttribute('data-sec-back', '');
    el.flag = ui.button('Flag', { kind: 'secondary', small: true, key: 'f', onClick: function () { toggleFlag(X); } });
    el.flag.setAttribute('data-sec-flag', '');
    el.flag.setAttribute('aria-pressed', 'false');
    el.items = ui.button('Items', { kind: 'ghost', small: true, onClick: function () { setStrip(X, !X.stripOpen); } });
    el.items.setAttribute('data-sec-items', '');
    el.items.setAttribute('aria-expanded', 'false');
    el.next = ui.button('Skip', { kind: 'primary', small: true, key: '→', onClick: function () { next(X); } });
    el.next.setAttribute('data-sec-next', '');
    el.strip = h('div.sec-strip', { hidden: true, role: 'group', 'aria-label': 'Items of this part' });
    el.endPart = ui.button('End this part', { kind: 'ghost', small: true, onClick: function () { leave(X); partEnd(X); } });
    el.endPart.setAttribute('data-sec-endpart', '');
    el.stripWrap = h('div.sec-stripwrap', { hidden: true }, el.strip, h('div.sec-strip-actions', el.endPart));
    el.foot = h('div.sec-foot', el.stripWrap, h('div.sec-controls', el.back, el.flag, el.items, el.next));
    return el.foot;
  }

  function setStrip(X, open) {
    X.stripOpen = !!open;
    X.el.stripWrap.hidden = !open;
    X.el.strip.hidden = !open;
    X.el.items.setAttribute('aria-expanded', open ? 'true' : 'false');
    if (open) drawStrip(X);
  }

  function itemState(it) {
    return it.status === 'void' ? 'void' : it.status === 'answered' ? 'answered' : it.status === 'seen' ? 'seen' : 'new';
  }
  function drawStrip(X) {
    var run = X.run, P = run.parts[run.part], el = X.el;
    ui.clear(el.strip);
    var shown = 0;
    P.items.forEach(function (it, i) {
      if (it.status === 'void') return; // its replacement is at the end of the part
      shown++;
      var st = itemState(it), label = 'Item ' + shown + ', ' + (st === 'answered' ? 'answered' : 'not answered') + (it.flag ? ', flagged' : '') + (i === run.index ? ', current' : '');
      var b = h('button', { type: 'button', class: ['sec-chip', 'is-' + st, it.flag ? 'is-flagged' : null, i === run.index ? 'is-current' : null], 'data-sec-item': String(i), 'aria-label': label, 'aria-current': i === run.index ? 'true' : null },
        h('span.sec-chip-n', String(shown)),
        st === 'answered' ? h('span.sec-chip-dot', { 'aria-hidden': 'true' }, '●') : null, // answered: a dot, not colour alone (rule 8)
        it.flag ? h('span.sec-chip-flag', { 'aria-hidden': 'true' }, '⚑') : null);
      b.addEventListener('click', function () {
        if (X.mode !== 'item' && X.mode !== 'partend') return;
        leave(X);
        if (display() === 'small') setStrip(X, false); // on a phone the strip covers the item's foot
        show(X, i);
      });
      el.strip.appendChild(b);
    });
    var info = SE().partInfo(run);
    el.items.firstChild.textContent = 'Items ' + info.answered + '/' + info.n;
  }

  // The number shown for an item: its place among the part's items that count (voids skipped).
  function numberOf(run, index) {
    var P = run.parts[run.part], n = 0;
    for (var i = 0; i <= index && i < P.items.length; i++) if (P.items[i].status !== 'void') n++;
    return n;
  }
  function countOf(run) { return SE().partInfo(run).n; }
  function totalAnswered(run) { var n = 0; run.parts.forEach(function (P) { P.items.forEach(function (it) { if (it.status === 'answered') n++; }); }); return n; }
  function totalItems(run) { var n = 0; run.parts.forEach(function (P) { P.items.forEach(function (it) { if (it.status !== 'void') n++; }); }); return n; }

  function updateControls(X) {
    var run = X.run, it = run.parts[run.part].items[run.index], el = X.el;
    if (!it) return;
    el.back.disabled = prevIndex(run, run.index) === null;
    el.flag.setAttribute('aria-pressed', it.flag ? 'true' : 'false');
    el.flag.classList.toggle('is-on', !!it.flag);
    el.flag.firstChild.textContent = it.flag ? 'Flagged' : 'Flag';
    el.next.firstChild.textContent = it.status === 'answered' ? 'Next' : 'Skip';
    X.P.setMeta('Part ' + (run.part + 1) + ' of ' + run.parts.length + ' · item ' + numberOf(run, run.index) + ' of ' + countOf(run));
    X.P.setProgress(totalAnswered(run), totalItems(run));
    drawStrip(X);
  }

  function prevIndex(run, index) {
    var P = run.parts[run.part];
    for (var i = index - 1; i >= 0; i--) if (P.items[i].status !== 'void') return i;
    return null;
  }
  function nextIndex(run, index) {
    var P = run.parts[run.part];
    for (var i = index + 1; i < P.items.length; i++) if (P.items[i].status !== 'void') return i;
    return null;
  }

  /* ---------- parts ---------- */

  function partIntro(X, p) {
    var run = X.run, exId = run.parts[p].exId, def = PX.ex.get(exId), L = PX.ex.learn(exId) || {};
    if (run.parts[p].broken) { partBroken(X); return; } // marked when the run was resumed
    setState(X, 'intro');
    X.C.pause('intro');
    X.introAt = now();
    var n = SE().partInfo(run, p).n, lines = [];
    if (L.goal) lines.push(L.goal);
    lines.push(n + (n === 1 ? ' item.' : ' items.') + ' The clock is stopped while you read this; ' + clockText(run.budgetMs - used(X)) + ' left in all.');
    if (p === 0) lines.push('Choosing an answer moves on. Back, Flag and Skip are under the item, and Items shows the part’s items. Pause stops the clock.');
    if (exId === 'angles') lines.push('Judge by eye: in the real test, rulers and other measuring tools are not allowed.');
    if (def && (def.extraParams || []).indexOf('ask') >= 0) lines.push('Up to three questions in a row ask about the same figure, as in the test, so a figure you have just seen can come back with a new question.');
    Play().showCard(X.wrap, X.P.el.root, {
      id: 'sec-part', title: 'Part ' + (p + 1) + ' of ' + run.parts.length + ': ' + shortOf(exId), def: def, hide: X.P.el.root, lines: lines,
      actions: [{ label: 'Start part ' + (p + 1), value: 'start', primary: true }],
    }).then(function (v) {
      if (X.done || v !== 'start') return;
      X.introMs += now() - X.introAt;
      X.introAt = 0;
      X.C.resume('intro');
      X.el.foot.hidden = false;
      var first = run.parts[p].items[0].status === 'void' ? nextIndex(run, 0) : 0;
      if (first === null) partEnd(X); else show(X, first);
    });
    X.el.foot.hidden = true;
  }

  // A part whose exercise cannot be shown here (it does not mount, or its items keep failing to
  // draw): a note, then on. Its items that were not shown do not count; the clock stops meanwhile.
  function partBroken(X) {
    var run = X.run, P = run.parts[run.part], last = run.part + 1 >= run.parts.length;
    X.token++;
    if (X.P) X.P.abort();
    setState(X, 'broken');
    setStrip(X, false);
    X.el.foot.hidden = true;
    X.C.pause('intro');
    X.introAt = now();
    persist(X);
    Play().showCard(X.wrap, X.P.el.root, {
      id: 'sec-broken', title: 'Part ' + (run.part + 1) + ' of ' + run.parts.length + ': ' + shortOf(P.exId), hide: X.P.el.root,
      lines: [(P.broken === 'cannot run on this device' ? 'This part cannot run on this device' : P.broken === 'coming soon' ? 'This part’s screen is not in this version of Parallax' : 'Its items could not be drawn here') +
        ', so the part ends here. The items it did not show do not count, and the clock is stopped while you read this.'],
      actions: [{ label: last ? 'Finish the section' : 'Next part', value: 'next', primary: true }],
    }).then(function (v) {
      if (X.done || v !== 'next') return;
      X.introMs += now() - X.introAt;
      X.introAt = 0;
      X.C.resume('intro');
      var nx = SE().endPart(run, rec(), now(), used(X));
      persist(X);
      if (nx < 0) finish(X, 'done'); else partIntro(X, nx);
    });
  }

  function resumeAt(X) {
    var run = X.run;
    setState(X, 'intro');
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
      X.el.foot.hidden = false;
      show(X, run.index);
    });
  }

  /* ---------- one item ---------- */

  function show(X, index) {
    var run = X.run, part = run.parts[run.part], it = SE().go(run, index);
    if (X.done || !it) return;
    if (it.status === 'void') { goOn(X, index); return; } // its replacement waits at the end of the part
    setState(X, 'item');
    if (Play().closeCards) Play().closeCards();
    X.P.el.root.hidden = false;
    X.el.foot.hidden = false;
    var def = PX.ex.get(part.exId), item = null, tok = ++X.token;
    if (!def || !X.P.use(part.exId)) { SE().breakPart(run, run.part, (def && why(def)) || 'could not be shown here'); partBroken(X); return; }
    try { item = def.generate(PX.rng(it.seed >>> 0), it.params); } catch (e) { log('generate failed (' + part.exId + ')', e); item = null; }
    if (!item) { voidItem(X, index, 'error'); return; }
    X.P.setLabel(def);
    updateControls(X);
    X.visitAt = 0;
    var pr = X.P.run(item, { feedback: false, hideItem: false, goal: Play().goalOf(PX.ex.learn(def.id), item) });
    if (it.status === 'answered' && X.P.grid && isNum(it.resp)) X.P.grid.select(it.resp); // the earlier answer, shown as chosen
    X.P.when('respond').then(function () { if (tok === X.token && !X.visitAt) X.visitAt = tnow(); });
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
    if (X.P) X.P.abort();
  }

  function onTrial(X, index, tr) {
    var run = X.run;
    if (!tr || tr.outcome === 'aborted' || X.done) return;
    var ms = isNum(tr.rtMs) ? tr.rtMs : visitMs(X);
    X.visitAt = 0;
    if (tr.end) {
      SE().visit(run, index, ms, now());
      askEnd(X, index);
      return;
    }
    if (tr.outcome === 'skipped') { SE().visit(run, index, ms, now()); persist(X); goOn(X, index); return; }
    if (tr.outcome === 'stutter') { SE().visit(run, index, ms, now()); voidItem(X, index, tr.voidReason || 'stutter'); return; }
    SE().visit(run, index, ms, now());
    SE().answer(run, index, { response: tr.response, correct: !!(tr.result && tr.result.correct), rtMs: tr.rtMs, input: tr.input || tr.source }, now()); // tr.input: the answering event's device (H4)
    persist(X);
    updateControls(X);
    var tok = ++X.token;
    win.setTimeout(function () { if (tok === X.token && !X.done) goOn(X, index); }, Play().isFast && Play().isFast() ? 0 : config.nextMs);
  }

  function voidItem(X, index, reason) {
    var r = SE().answer(X.run, index, { voided: true, voidReason: reason }, now());
    persist(X);
    if (r.broken) { partBroken(X); return; } // its items keep failing to draw: the part ends with a note
    ui.toast(r.replaced !== null ? 'That item was interrupted, so it does not count. A new one joins the end of this part.' : 'That item was interrupted, so it does not count.', { kind: 'info' });
    goOn(X, index);
  }

  // After an item: the next one of the part, else the part's end.
  function goOn(X, index) {
    var j = nextIndex(X.run, index);
    if (j === null) partEnd(X); else show(X, j);
  }
  function back(X) {
    var j = prevIndex(X.run, X.run.index);
    if (j === null || X.mode !== 'item') return;
    leave(X);
    show(X, j);
  }
  function next(X) {
    if (X.mode !== 'item') return;
    var index = X.run.index;
    leave(X);
    persist(X);
    goOn(X, index);
  }
  function toggleFlag(X) {
    if (X.mode !== 'item') return;
    SE().flag(X.run, X.run.index);
    persist(X);
    updateControls(X);
  }

  // The end of a part: what is unanswered or flagged, then on (the part closes for good).
  function partEnd(X) {
    var run = X.run, P = run.parts[run.part], last = run.part + 1 >= run.parts.length;
    setState(X, 'partend');
    setStrip(X, false);
    X.el.foot.hidden = true;
    var open = [], flagged = [];
    P.items.forEach(function (it, i) {
      if (it.status === 'void') return;
      if (it.status !== 'answered') open.push(i);
      if (it.flag) flagged.push(i);
    });
    var info = SE().partInfo(run), lines = [info.answered + ' of ' + info.n + ' answered.'];
    if (open.length) lines.push('Not answered: item' + (open.length === 1 ? ' ' : 's ') + andList(open.map(function (i) { return String(numberOf(run, i)); })) + '.');
    if (flagged.length) lines.push('Flagged: item' + (flagged.length === 1 ? ' ' : 's ') + andList(flagged.map(function (i) { return String(numberOf(run, i)); })) + '.');
    lines.push(last ? 'Finishing ends the section and opens the review.' : 'Once you move on, you cannot come back to this part. The clock is running.');
    // With items open or flagged, the default (focus, Enter, Space) goes back to the first of them:
    // closing the part for good takes a deliberate choice (Tab to it, or a click).
    var firstOpen = open.length ? open[0] : flagged.length ? flagged[0] : null;
    var actions = [{ label: last ? 'Finish the section' : 'Next part', value: 'next', primary: firstOpen === null }];
    if (firstOpen !== null) actions.unshift({ label: 'Go to item ' + numberOf(run, firstOpen), value: 'back', primary: true });
    Play().showCard(X.wrap, X.P.el.root, {
      id: 'sec-partend', title: 'End of part ' + (run.part + 1) + ' of ' + run.parts.length + ': ' + shortOf(P.exId), hide: X.P.el.root, lines: lines, actions: actions,
    }).then(function (v) {
      if (X.done || X.mode !== 'partend') return;
      if (v === 'back') { X.el.foot.hidden = false; show(X, firstOpen); return; }
      if (v !== 'next') return;
      var nx = SE().endPart(run, rec(), now(), used(X));
      persist(X);
      if (nx < 0) finish(X, 'done'); else partIntro(X, nx);
    });
  }

  function askEnd(X, index) {
    setState(X, 'confirm');
    ui.confirm('The items you have not answered stay unanswered, and the review opens. The clock is stopped while you decide.', {
      title: 'End the section now?', ok: 'End the section', cancel: 'Keep going',
    }).then(function (yes) {
      if (X.done) return;
      if (yes) finish(X, 'user'); else show(X, index);
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
    X.offs.forEach(function (off) { try { off(); } catch (e) { /* ignore */ } });
    X.offs = [];
    if (X.C) { try { X.C.destroy(); } catch (e) { /* ignore */ } X.C = null; }
    if (Play().closeCards) Play().closeCards();
    if (X.P) { X.P.destroy(); X.P = null; }
    Play().setChrome(false);
  }

  function leaveScreen(X) {
    if (X.run && !X.done && X.C) {
      leave(X);
      if (X.introAt) { X.introMs += now() - X.introAt; X.introAt = 0; }
      persist(X); // kept in rec.section.live: the next visit offers to resume it
      try { store.flush(); } catch (e) { /* ignore */ }
    }
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
    var s = e.status === 'answered' ? (e.correct ? 'right' : 'wrong') : 'skipped'; // the list holds shown items only
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
    var rows = res.parts.map(function (x, i) {
      var per = x.seen ? Math.round(x.timeMs / x.seen / 1000) + ' s' : '–';
      return h('tr', { 'data-part': x.exId },
        h('th', { scope: 'row' }, (i + 1) + '. ' + shortOf(x.exId)),
        h('td.px-num', x.reached ? x.right + '/' + x.n : '–'), h('td.px-num', x.broken && !x.reached ? 'not shown here' : x.reached ? String(x.answered) + (x.broken ? ' (ended early)' : '') : 'not reached'),
        h('td.px-num', x.reached ? clockText(x.timeMs) : '–'), h('td.px-num', x.reached ? per : '–'));
    });
    p.body.appendChild(h('div.sec-tablewrap', h('table.sec-table', h('caption.px-sr', 'Results by part'),
      h('thead', h('tr', h('th', { scope: 'col' }, 'Part'), h('th', { scope: 'col' }, 'Right'), h('th', { scope: 'col' }, 'Answered'), h('th', { scope: 'col' }, 'Time'), h('th', { scope: 'col' }, 'Per item'))),
      h('tbody', rows))));
    p.body.appendChild(h('p.px-meta', 'Per item: the part’s time over the items you looked at. The real test averages about ' + Math.round(SE().PACE_MS / 1000) + ' seconds an item over its six parts.'));
    p.body.appendChild(h('p.px-meta', 'These counts are for comparing your own sections. Parallax does not turn them into a score or a prediction for the Dental Admission Test.'));
    (res.achievements || []).forEach(function (a) { p.body.appendChild(h('p.sec-award', K.icon('award'), h('span', h('b', a.name), ': ' + a.desc))); });
    if (run.missing && run.missing.length) p.body.appendChild(h('p.px-meta', andList(run.missing.map(function (m) { return PART_NAMES[m.id] || shortOf(m.id); })) + ' could not be part of this section.'));
    box.appendChild(p.el);

    var again = SE().review(res, 'again'), all = SE().review(res, 'all');
    all.forEach(function (e) { e.n = countUpTo(run.parts[e.part], e.index); });
    again.forEach(function (e) { e.n = countUpTo(run.parts[e.part], e.index); });
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

    var more = ui.button('Another section', { kind: 'primary', onClick: function () { closeStage(X); X.done = false; setup(X, { size: s.size }); try { win.scrollTo(0, 0); } catch (e) { /* ignore */ } } });
    more.setAttribute('data-sec-again', '');
    box.appendChild(h('div.pl-summary-actions', more, ui.button('Back to the Library', { kind: 'secondary', go: 'library' })));
    box.appendChild(ada());
    try { win.scrollTo(0, 0); } catch (e) { /* ignore */ }
  }

  function countUpTo(P, index) {
    var n = 0;
    for (var i = 0; i <= index && i < P.items.length; i++) if (P.items[i].status !== 'void') n++;
    return n;
  }

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
    var r = X.run;
    return {
      mode: X.mode, done: X.done, part: r ? r.part : null, index: r ? r.index : null, parts: r ? r.parts.map(function (p) { return p.exId; }) : [],
      usedMs: X.result ? X.result.summary.usedMs : r ? used(X) : 0, budgetMs: r ? r.budgetMs : 0, running: !!(X.C && X.C.running && X.C.running()),
      result: X.result ? X.result.summary : null, run: r,
    };
  }

  PX.ui.section = { config: config, state: state, PART_NAMES: PART_NAMES };
  win.__section = { get state() { return state(); } };
  PX.ui.screens = PX.ui.screens || {};
  PX.ui.screens.section = { title: 'Section practice', render: render };
})(window.PX);
