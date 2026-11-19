/* PX.ui.measure: Design A's measurement in the app (PLAN milestone 6; js/engine/assess.js; ENGINE.md §21).
   Mounted through PX.ui.hooks only (CONTRACT-v1.2 R); the screens' files are not edited.

     play(o) → Promise<{ res, stopped, end, unavailable }>   one measurement occasion (B1, B2, regular, delayed,
       block, week) played in a player: per probe its instruction card and, on first contact, its worked example
       (never scored), then the items without feedback (a time limit per item ends it as a time-out, scored wrong);
       one free skip per probe; it counts only when complete. o: { P, wrap, kind, card(o) → Promise (a card above
       the player), clock (the session clock to pause, or null), standalone (the check screen: Stop asks first) }.
       The check's own active time comes from its own clock; the session clock is paused with 'measure'.
     status(rec, now) → { kind, due, when, title, text, label, route }   the next measurement in words
     The hooks: session:start (B2, a put-off or late B1, a short check, the 4-weekly, delayed, run-in and Lab
       checks: a card, then the occasion, then the session), item:before (B1 right after the first tutorial, the
       session clock paused), today:slots (replaces 'check'), today:session (why the next session opens with a
       measurement), summary:panels (the meter after a session that began with one), progress:panels (replaces
       'check': the meter, the rungs, the verdicts, the history), settings:sections (Measurement week),
       lab:panels (the ladder). The pooled export's header gains `probes` ({ 'id@v': rung }; CONTRACT-v1.2 T).
   Words follow CLAUDE.md rules 2 and 10: probe points and words, never an IQ, an index, a percentile, a norm or a
   brain age; verdict words only at milestones; "unclear yet" is not "no progress".
   Offers come in rated sessions only (Train, Path, Speed; Free play never measures). PX.ui.measure.quiet = true
   silences them (browser suites mute every builder's hooks with PX.ui.hooks.mute; tests/e2e/check.py unmutes). */
(function (PX) {
  'use strict';

  var win = window, ui = PX.ui, h = ui.h, U = PX.util;
  var NAMES = { B1: 'Baseline 1', B2: 'Baseline 2', B3: 'Baseline 3', regular: '4-weekly check', delayed: 'Delayed check', block: 'Short check', week: 'Measurement week', balance: 'Balance check' };
  var WORDS = {
    'likely gain': 'Likely gain: your probe results rose more than familiarity with the tasks predicts.',
    'likely no change': 'Likely no change: any rise beyond familiarity is small at this precision.',
    'unclear yet': 'Unclear yet: the usual verdict for one person at this point. It is not the same as no progress.',
  };
  var RUNGS = [['near', 'Near', 'Other Way Round: the same skills, run backwards'], ['mid', 'Mid', 'other spatial tasks you never train'], ['far', 'Far', 'motion and mechanisms: furthest from the training']];
  var SESSION_MODES = { train: 1, path: 1, speed: 1 };

  function E() { return PX.engine; }
  function A() { return PX.engine.assess; }
  function store() { return PX.core.store; }
  function rec() { return store().state; }
  function now() { return Date.now(); }
  function isNum(x) { return typeof x === 'number' && isFinite(x); }
  function save() { try { store().save(); } catch (e) { /* the next save writes it */ } }
  function log(m, e) { if (win.console) console.error('PX.ui.measure: ' + m, e || ''); }
  function nameOf(def) { return def ? def.short || def.name : ''; }
  function canRun(def) { try { return PX.ui.play.canRun(def); } catch (e) { return true; } }
  function displayOf() { try { return E().est.displayClass(win.innerWidth, win.innerHeight); } catch (e) { return 'large'; } }
  function pct(p) { return Math.round(p * 100) + ' %'; }
  function signed(x) { var v = Math.round(x * 10) / 10; return (v > 0 ? '+' : v < 0 ? '−' : '') + Math.abs(v).toFixed(1); }
  function minutes(m) { return (m % 1 ? m.toFixed(1) : String(m)) + (m === 1 ? ' minute' : ' minutes'); }
  function when(t) { var K = PX.ui.kit; return K && K.fmtWhen ? K.fmtWhen(t) : U.fmtDate(t, 'long'); }
  function next(r, t) { try { return A().nextMeasure(r, t, { can: canRun }); } catch (e) { log('nextMeasure failed', e); return null; } }
  function quiet() { var M = PX.ui.measure; return !!M && M.quiet === true; }

  try { A().wire(); } catch (e) { log('wire failed', e); } // the measure container's repair, merge and events, before the first load
  try { store().setting('measureWeek', { def: false, type: 'bool' }); } catch (e) { log('the measureWeek setting', e); }
  try {
    store().header('probes', function (ctx) {
      var M = E().config.measure, rung = {}, out = {};
      Object.keys(M.rungs).forEach(function (r) { M.rungs[r].forEach(function (id) { rung[id] = r; }); });
      rung[M.control] = 'control';
      (M.alone || []).forEach(function (id) { rung[id] = 'alone'; });
      Object.keys(M.lab || {}).forEach(function (id) { rung[id] = 'lab'; });
      PX.ex.list('probe').forEach(function (d) { out[d.id + '@' + d.version] = rung[d.id] || 'alone'; });
      var list = ctx && ctx.rec && Array.isArray(ctx.rec.assess) ? ctx.rec.assess : [];
      list.forEach(function (a) {
        var pv = a && a.pv && typeof a.pv === 'object' ? a.pv : {};
        Object.keys(pv).forEach(function (id) { var k = id + '@' + pv[id]; if (!out[k]) out[k] = rung[id] || 'alone'; });
      });
      return out;
    });
  } catch (e) { log('the probes header', e); }

  /* ---------- the runner ---------- */

  var STOP = {
    full: 'A check counts only when it is complete, so the tasks you finished will not be used. Your answers stay in the Log.',
    block: 'A short check counts only when it is complete. Your session goes on without it.',
  };

  // A probe's time limits over every combination of its settings, in whole seconds (null: untimed).
  function limitRange(def) {
    if (!def || typeof def.timeLimit !== 'function') return null;
    var lo = Infinity, hi = 0, n = 0;
    function walk(i, p) {
      if (n > 600) return;
      if (i === def.dims.length) {
        n++;
        var ms = null;
        try { ms = def.timeLimit(p); } catch (e) { ms = null; }
        if (isNum(ms) && ms > 0) { lo = Math.min(lo, ms); hi = Math.max(hi, ms); }
        return;
      }
      for (var k = 0; k < def.dims[i].levels.length; k++) { var q = Object.assign({}, p); q[def.dims[i].key] = k; walk(i + 1, q); }
    }
    (def.variants && def.variants.length ? def.variants : [null]).forEach(function (v) { walk(0, v ? { variant: v } : {}); });
    return hi > 0 ? { lo: Math.round(lo / 1000), hi: Math.round(hi / 1000) } : null;
  }
  function inputName(src) {
    var s = String(src || '').toLowerCase();
    return s === 'touch' ? 'touch' : s === 'pen' ? 'pen' : s === 'key' || s === 'keys' || s === 'keyboard' ? 'key' : s === 'mouse' || s === 'pointer' ? 'mouse' : 'unknown';
  }

  function play(o) {
    var Play = PX.ui.play, P = o.P, kind = o.kind;
    var S = { done: false, answered: 0, instructed: {}, freeSkip: {}, skips: 0, inputs: {}, probeNo: 0, lastProbe: null };
    var plan;
    try { plan = E().modes.start(rec(), 'check', { now: now(), display: displayOf(), can: canRun, kind: kind, optional: !!o.optional }); } catch (e) { log('start failed', e); plan = { unavailable: 'The measurement could not start.' }; }
    if (plan.unavailable) return Promise.resolve({ res: null, unavailable: plan.unavailable });
    S.plan = plan;
    // while it runs, a probe's time bar is drawn to read as time (css/measure.css; fresh-player run, item 7)
    if (P && P.el && P.el.root) P.el.root.classList.add('pl-measuring');
    if (o.extra) { if (!plan.check.extra || typeof plan.check.extra !== 'object') plan.check.extra = {}; Object.keys(o.extra).forEach(function (k) { plan.check.extra[k] = o.extra[k]; }); }
    var block = !!plan.check.block, probes = plan.check.probes.map(function (x) { return x.id; });
    var device = { display: displayOf(), viewport: Math.round(win.innerWidth || 0) + 'x' + Math.round(win.innerHeight || 0) };
    var CK = PX.core.clock, clock = CK && typeof CK.create === 'function' ? CK.create({ idleMs: 60000 }) : null, offs = [];
    S.clock = clock; // the check screen's pause sheet pauses it (PX.ui.check)
    if (clock) {
      if (ui.modalOpen && ui.modalOpen()) clock.pause('modal');
      offs.push(PX.bus.on('modal:open', function () { if (clock) clock.pause('modal'); }));
      offs.push(PX.bus.on('modal:close', function () { if (clock && !(ui.modalOpen && ui.modalOpen())) clock.resume('modal'); }));
    }
    if (o.clock) o.clock.pause('measure');
    function clockNow() { return clock ? { activeMs: clock.activeMs() } : undefined; }
    function dropClock() {
      offs.forEach(function (off) { try { off(); } catch (e) { /* gone */ } });
      offs = [];
      if (clock) { try { clock.destroy(); } catch (e) { /* gone */ } clock = null; }
      S.clock = null;
    }
    var skipText = P.el.skip && P.el.skip.firstChild ? P.el.skip.firstChild.textContent : null, pauseText = P.el.pauseNote ? P.el.pauseNote.textContent : null;
    // the session's HUD (label, meta line, progress bar), put back when the occasion ends
    var hud = { meta: P.el.meta ? P.el.meta.textContent : null, label: P.el.label ? Array.prototype.slice.call(P.el.label.childNodes) : null,
      bar: P.el.bar && P.el.bar.getAttribute ? P.el.bar.getAttribute('aria-valuetext') : null };
    function skipLabel(counts) {
      if (P.el.skip && P.el.skip.firstChild) P.el.skip.firstChild.textContent = counts ? 'Skip (counts as wrong)' : 'Skip this item';
      if (P.el.pauseNote) P.el.pauseNote.textContent = counts ? 'This task’s free skip is used: another skip counts as a wrong answer.' : 'One skip per task is free: a new item replaces it.';
    }
    function restore() {
      if (P.el.skip && P.el.skip.firstChild && skipText !== null) P.el.skip.firstChild.textContent = skipText;
      if (P.el.pauseNote && pauseText !== null) P.el.pauseNote.textContent = pauseText;
      if (P.el.pause) P.el.pause.removeEventListener('click', onEnd, true);
      if (P.el.helpBtn && helpHidden !== null) P.el.helpBtn.hidden = helpHidden;
      if (o.standalone) return;
      if (hud.meta !== null) P.el.meta.textContent = hud.meta;
      if (hud.label) { ui.clear(P.el.label); hud.label.forEach(function (n) { P.el.label.appendChild(n); }); }
      var mb = hud.bar ? /^(\d+) of (\d+)$/.exec(hud.bar) : null;
      if (mb) P.setProgress(+mb[1], +mb[2]);
    }
    var helpHidden = P.el.helpBtn ? P.el.helpBtn.hidden : null;
    if (P.el.helpBtn) P.el.helpBtn.hidden = true; // no show me, no help: probes are never taught beyond their example
    // Ending from the pause sheet asks first; the click is caught on its way to the button.
    var resolveRun = null, stopAsked = false;
    function onEnd(e) {
      if (!e.target || !e.target.closest || !e.target.closest('[data-end]') || S.done) return;
      e.stopPropagation();
      e.preventDefault();
      ui.confirm(block ? STOP.block : STOP.full, { title: block ? 'Stop the short check?' : 'Stop the check?', ok: 'Stop', cancel: 'Keep going', danger: true }).then(function (yes) {
        if (yes && !S.done) { stopAsked = true; P.skip(true); }
      });
    }
    if (P.el.pause) P.el.pause.addEventListener('click', onEnd, true);

    function progress(step) {
      var pr = step && step.probe;
      var at = pr ? probes.indexOf(pr.id) + 1 : S.probeNo;
      var it = pr ? ' · item ' + Math.min(pr.of, pr.index + 1) + ' of ' + pr.of : '';
      // shorter forms when the line would wrap (a taller strip would push the item's controls down on phones)
      P.setMeta((NAMES[kind] || 'Check') + ' · task ' + at + ' of ' + probes.length + it, ['Task ' + at + ' of ' + probes.length + it,
        'Task ' + at + '/' + probes.length + (pr ? ' · ' + Math.min(pr.of, pr.index + 1) + '/' + pr.of : '')]);
      P.setProgress(S.answered, plan.total);
    }
    function markKey(def, item) {
      var g = P.grid, type = item && (item.answer || def.answer), key = item && item.key;
      if (!g || typeof g.mark !== 'function') return false;
      var right = type === 'yesno' ? [key ? 0 : 1] : Array.isArray(key) ? key : isNum(key) ? [key] : [];
      right.forEach(function (i) { g.mark(i, 'right'); });
      return right.length > 0;
    }
    function newKind(def, step) {
      var learn = PX.ex.learn(def.id) || {}, v = step.params && step.params.variant, expl = v && learn.explain && learn.explain[v];
      if (!expl || !expl.length) return Promise.resolve(null);
      return o.card({ id: 'probe-format', title: 'New kind of question', lines: [expl[0]], actions: [{ label: 'Go on', value: 'go', primary: true }] })
        .then(function (x) { return x === 'closed' ? 'stop' : null; });
    }
    // The probe's instruction card; on first contact (or in a full check) its worked example, never scored. A probe
    // of several formats (Other Way Round) brings each format's example before that format's first item (again).
    function instruct(step, def, again) {
      var learn = PX.ex.learn(def.id) || {}, ins = learn.instruction || {};
      // only what the first item needs on the card (learn.brief, else the first two lines); the rest folds away under
      // "More about this task" (fresh-player run, item 5: up to eight paragraphs before a task)
      var all = (Array.isArray(ins) ? ins : ins.lines || []).slice(), brief = Array.isArray(learn.brief) && learn.brief.length ? learn.brief.slice() : null;
      var lines = brief || all.slice(0, 2), more = brief ? all : all.slice(2);
      if (!lines.length && learn.goal) lines.push(learn.goal);
      var v = step.params && step.params.variant, expl = v && learn.explain && learn.explain[v];
      if (again) lines = expl && expl.length ? [expl[0]] : [];
      var ex = step.probe && step.probe.example, canDemo = !!(ex && P.view && P.view.demo);
      if (!again && !canDemo && expl && expl.length && def.cycle === 'variant') lines.push(expl[0]); // no worked example: the first kind's own line
      if (!again && def.cycle === 'variant' && Array.isArray(def.variants) && def.variants.length > 1 && step.probe && step.probe.of) {
        var kinds = WORDNUM[def.variants.length] || String(def.variants.length);
        lines.unshift(step.probe.of + ' items: ' + kinds + ' kinds of question in turn. Each new kind opens with one line about it.');
      }
      var lim = limitRange(def);
      if (again) { var ms = def.timeLimit ? def.timeLimit(step.params) : null; lim = ms ? { lo: Math.round(ms / 1000), hi: Math.round(ms / 1000) } : null; }
      if (lim) lines.push((lim.lo === lim.hi ? 'Each item has up to ' + lim.lo + ' seconds' : 'Each item has ' + lim.lo + ' to ' + lim.hi + ' seconds (harder items get more)') + ', shown as a slow bar under it.');
      if (block && !canDemo) lines = lines.slice(0, 1).concat(lim ? [lines[lines.length - 1]] : []); // a known task: its goal and its time
      var bg = again ? null : background(def);
      if (bg) lines = lines.concat(bg.lines);
      if (!again && !block && more.length) lines.push(h('details.px-ms-more', h('summary', 'More about this task'), more.map(function (t) { return h('p', t); })));
      // no "PR-6 · Vz" spec line: the codes mean nothing to a player (fresh-player run, item 6)
      return o.card({
        id: again ? 'probe-format' : 'probe-intro', title: again ? 'Next in ' + (ins.title || nameOf(def)) + ': a new kind of question' : 'Task ' + (probes.indexOf(def.id) + 1) + ' of ' + probes.length + ': ' + (ins.title || nameOf(def)), def: null,
        lines: lines.concat(canDemo ? ['First, one worked example. It is never scored.'] : []),
        actions: canDemo ? [{ label: 'Skip the example', value: 'skip' }, { label: 'Show the example', value: 'example', primary: true }] : [{ label: 'Start', value: 'start', primary: true }],
      }).then(function (v) {
        if (bg) bg.done();
        if (v === 'closed') return 'stop';
        if (v !== 'example') return null;
        var item;
        try { item = def.generate(PX.rng(ex.seed >>> 0), Play.fillParams(def, ex.params)); } catch (e) { log('example failed', e); return null; }
        P.setMeta('Worked example · never scored');
        P.setLabel(def);
        return new Promise(function (resolve) {
          var shown = false;
          // the end of the example: a card of its own, so nothing covers the options and no caption is left over from the
          // walkthrough (fresh-player run, item 4)
          function startBtn() {
            if (shown) return;
            shown = true;
            markKey(def, item);
            o.card({ id: 'probe-example-end', title: 'That was the worked example', lines: ['The items that follow count, and give no feedback.'],
              actions: [{ label: 'Start ' + nameOf(def), value: 'start', primary: true }] })
              .then(function () { P.abort(); });
          }
          P.demo(item, { feedback: false, goal: Play.goalOf(learn, item), onDemoEnd: startBtn }).then(function (tr) {
            P.el.actions.hidden = false;
            resolve(tr && tr.end ? 'stop' : null);
          });
          P.when('respond').then(function () { if (!P.view || !P.view.demo) startBtn(); });
        });
      });
    }

    return new Promise(function (resolve) {
      resolveRun = resolve;
      function close(out) {
        if (P && P.el && P.el.root) P.el.root.classList.remove('pl-measuring');
        restore();
        if (o.clock) o.clock.resume('measure');
        resolveRun(out);
      }
      function stop(end) {
        if (S.done) return;
        S.done = true;
        dropClock();
        close({ res: null, stopped: true, end: !!end && !stopAsked, plan: plan });
      }
      function finish() {
        if (S.done) return;
        S.done = true;
        var c = plan.check, most = 0, best = 'unknown';
        if (!c.extra || typeof c.extra !== 'object') c.extra = {};
        c.extra.display = device.display;
        c.extra.viewport = device.viewport;
        Object.keys(S.inputs).forEach(function (k) { if (k !== 'unknown' && S.inputs[k] > most) { most = S.inputs[k]; best = k; } });
        c.extra.input = best;
        if (clock) clock.stop();
        var t = clockNow(), res = null;
        dropClock();
        try { res = E().modes.finish(plan, rec(), now(), t); } catch (e) { log('finish failed', e); }
        save();
        try { store().flush(); } catch (e) { /* the debounced save runs later */ }
        close({ res: res, stopped: false, plan: plan });
      }
      function loop() {
        if (S.done) return;
        if (clock && !clock.started()) clock.start();
        var step;
        try { step = E().modes.next(plan, rec(), now(), clockNow()); } catch (e) { log('next failed', e); finish(); return; }
        if (!step || step.done) { finish(); return; }
        var def = PX.ex.get(step.exId);
        if (!def || !P.use(step.exId)) {
          try { E().modes.answer(plan, rec(), step, { correct: false, outcome: 'skipped' }, now()); } catch (e) { /* ignore */ }
          if (++S.skips > 6) { finish(); return; }
          loop();
          return;
        }
        if (S.lastProbe !== def.id) { S.lastProbe = def.id; S.probeNo++; }
        skipLabel(!!S.freeSkip[def.id]);
        P.setLabel(def);
        progress(step);
        var first = step.probe && step.probe.index === 0 && !S.instructed[def.id];
        if (first) S.instructed[def.id] = true;
        var again = !first && step.probe && (step.probe.example || step.probe.newVariant);
        // a new kind of question inside a probe (Other Way Round's strands, Motion Graphs' kinds, Balance's two) gets a
        // light card: its one line and Go on (fresh-player run, item 2); only the probe's first card offers an example
        (first ? instruct(step, def, false) : again ? newKind(def, step) : Promise.resolve(null)).then(function (r) {
          if (S.done) return null;
          if (r === 'stop') { stop(true); return null; }
          var item;
          try { item = def.generate(PX.rng(step.seed), step.params); } catch (e) { log('generate failed', e); item = null; }
          if (!item) { E().modes.answer(plan, rec(), step, { correct: false, outcome: 'skipped' }, now()); loop(); return null; }
          P.setLabel(def);
          progress(step);
          var limit = def.timeLimit ? def.timeLimit(item.params) : null;
          return P.run(item, { feedback: false, limitMs: limit || null, limitBar: false, goal: Play.goalOf(PX.ex.learn(def.id), item) }).then(function (tr) {
            if (S.done || tr.outcome === 'aborted') return null;
            if (tr.end) { stop(true); return null; }
            var result = { correct: !!(tr.result && tr.result.correct), rt: tr.rtMs, timeout: !!tr.timeout, input: tr.source };
            if (tr.result) { // a placed answer's numbers (Balance: distance, pull, where)
              if (typeof tr.result.value === 'number' && isFinite(tr.result.value)) result.value = tr.result.value;
              if (typeof tr.result.value2 === 'number' && isFinite(tr.result.value2)) result.value2 = tr.result.value2;
              if (Array.isArray(tr.result.at)) result.at = tr.result.at.slice(0, 2);
            }
            if (tr.outcome === 'stutter') { result.outcome = 'stutter'; result.voided = true; }
            else if (tr.outcome === 'skipped' && !S.freeSkip[def.id]) { S.freeSkip[def.id] = true; result.outcome = 'skipped'; skipLabel(true); }
            if (item.fallback === true) result.fallback = true;
            if (clock && tr.outcome !== 'skipped' && !tr.timeout) clock.touch();
            var out;
            try { out = E().modes.answer(plan, rec(), step, result, now(), clockNow()); } catch (e) { log('answer failed', e); out = {}; }
            save();
            if (out.outcome === 0 || out.outcome === 1) {
              S.answered++;
              if (!tr.timeout) { var inp = inputName(tr.input || tr.source); S.inputs[inp] = (S.inputs[inp] || 0) + 1; }
            }
            progress(step);
            return P.waitNext().then(loop);
          });
        }).catch(function (e) { log('item failed', e); finish(); });
      }
      play.current = S;
      loop();
    });
  }

  /* ---------- words ---------- */

  // The next measurement in words: { kind, due, when, title, text, label (null: nothing to start), route }.
  function status(r, t) {
    var nm = next(r, t), out = { kind: null, due: false, when: null, title: '', text: '', label: null, route: null };
    if (!nm) return out;
    out.kind = nm.kind; out.due = nm.due; out.when = nm.when;
    var name = NAMES[nm.kind] || 'Check', m = minutes(nm.minutes);
    var route = 'play?mode=check&kind=' + nm.kind;
    if (nm.kind === 'B1') {
      out.title = 'Starting point not measured yet';
      out.text = nm.when === 'after-tutorial' ? 'Your first tutorial ends with it: ' + m + ' of short tasks you never practise, without feedback, so later changes have something to stand on.' :
        'Your next session opens with it: ' + m + ' of short tasks you never practise, without feedback.' + (nm.late ? ' It comes after some training, so the report says so.' : '');
      out.label = 'Take baseline 1 now'; out.route = route;
    } else if (nm.kind === 'B2' || nm.kind === 'B3') {
      out.title = nm.due ? name + ' opens your next session' : name + ' from ' + when(nm.at);
      out.text = 'A second starting point, ' + m + ': the first one also measured getting used to the tasks.';
      if (nm.due) { out.label = 'Take ' + name.toLowerCase() + ' now'; out.route = route; }
    } else if (nm.kind === 'block') {
      out.title = nm.due ? 'A short check opens your next session' : 'Next short check from ' + when(nm.at);
      out.text = 'About ' + m + ' without feedback, at most four a week: it keeps your probe trend moving between the 4-weekly checks.';
    } else if (nm.kind === 'week') {
      out.title = nm.due ? 'Measurement week: today’s block' : 'Measurement week from ' + when(nm.at);
      out.text = 'One block a day, ' + m + ', on the four days before your 4-weekly verdict, in place of the check.';
      if (nm.due) { out.label = 'Start today’s block'; out.route = route; }
    } else {
      out.title = nm.due ? name + (nm.when === 'session-start' ? ' opens your next session' : ' is due') : name + ' from ' + when(nm.at);
      out.text = nm.why;
      if (nm.due) { out.label = 'Take the ' + name.toLowerCase() + ' now'; out.route = route; }
    }
    return out;
  }

  function wordPill(words) {
    var cls = words === 'likely gain' ? 'is-gain' : words === 'likely no change' ? 'is-none' : 'is-unclear';
    return h('span.px-ms-word.' + cls, words.charAt(0).toUpperCase() + words.slice(1));
  }

  // The meter: the chance of a rise beyond familiarity, as a bar (no words between milestones).
  function meterEl(m) {
    var p = Math.max(0, Math.min(1, m.p)), w = Math.round(p * 1000) / 10;
    return h('div.px-ms-meter', { role: 'img', 'aria-label': 'Chance of a rise beyond familiarity: ' + pct(p) },
      h('div.px-ms-meter-track', { 'aria-hidden': 'true' }, h('div.px-ms-meter-fill', { style: 'width:' + w + '%' }), h('div.px-ms-meter-mid')),
      h('span.px-ms-meter-num.px-num', pct(p)));
  }

  // Rows of gains in probe points with their 90 % ranges on one axis (CLAUDE.md rule 2: levels carry ranges).
  function rangeRows(rows) {
    var lo = 0, hi = 0;
    rows.forEach(function (r) { lo = Math.min(lo, r.x.lo); hi = Math.max(hi, r.x.hi); });
    var pad = Math.max(0.25, (hi - lo) * 0.08);
    lo = Math.floor((lo - pad) * 2) / 2; hi = Math.ceil((hi + pad) * 2) / 2;
    var pos = function (v) { return ((v - lo) / (hi - lo) * 100).toFixed(2) + '%'; };
    var list = h('ol.px-fp.px-ms-rows', { 'aria-label': 'Change beyond familiarity, in probe points, with 90 % ranges' });
    rows.forEach(function (r) {
      list.appendChild(h('li.px-fp-row' + (r.composite ? '.is-composite' : ''), { 'data-rung': r.id },
        h('div.px-fp-label', h('b', r.name), r.sub ? h('span.px-meta', r.sub) : null),
        h('div.px-fp-strip', { 'aria-hidden': 'true' },
          h('span.px-fp-zero', { style: 'left:' + pos(0) }),
          h('span.px-fp-ci', { style: 'left:' + pos(r.x.lo) + ';width:calc(' + pos(r.x.hi) + ' - ' + pos(r.x.lo) + ')' }),
          h('span.px-fp-pt', { style: 'left:' + pos(r.x.mean) })),
        h('div.px-fp-num', h('span.px-num', signed(r.x.mean)), h('span.px-fp-range', signed(r.x.lo) + ' to ' + signed(r.x.hi))),
        h('div.px-fp-end', r.composite ? h('span.px-meta', pct(r.x.p) + ' chance') : null)));
    });
    var ticks = [], step = hi - lo > 4 ? 1 : 0.5;
    for (var v = lo; v <= hi + 1e-9; v += step) ticks.push(h('span.px-fp-tick' + (Math.abs(v) < 1e-9 ? '.is-zero' : ''), { style: 'left:' + pos(v) }, h('span', signed(v))));
    list.appendChild(h('li.px-fp-row.px-fp-axisrow', { 'aria-hidden': 'true' }, h('div.px-fp-label', h('span.px-meta', 'probe points')), h('div.px-fp-axis', ticks), h('div'), h('div')));
    return list;
  }

  function trendRows(rep) {
    var rows = [{ id: 'composite', name: 'Spatial probes combined', sub: 'the verdict is about this one', x: rep.composite, composite: true }];
    RUNGS.forEach(function (r) { if (rep.rungs && rep.rungs[r[0]]) rows.push({ id: r[0], name: r[1], sub: r[2], x: rep.rungs[r[0]] }); });
    return rows;
  }

  /* ---------- offering a measurement in a session ---------- */

  // ctx: the player's hook context (card, P, wrap, clock). → Promise<'end' | null>
  var SESSIONS = {}; // plan id → the measurement that opened the session (for its summary panel)
  function offer(ctx, nm, where) {
    var name = NAMES[nm.kind] || 'Check', m = minutes(nm.minutes), full = nm.kind !== 'block';
    var lines = [nm.why];
    if (nm.kind === 'B1') lines.push('It is measured once, before training changes it. There is no feedback: the items adapt to your answers, so expect roughly 6 to 8 in 10 right. Guess when you are unsure.');
    else if (full) lines.push('No feedback, and the items adapt to you, so roughly 6 to 8 in 10 right is expected. It is not practice time.');
    else lines.push('No feedback; it is not practice time.');
    var actions = nm.kind === 'block' ? [{ label: 'Skip this time', value: 'skip' }, { label: 'Start', value: 'start', primary: true }] :
      [{ label: 'Later', value: 'later' }, { label: 'Start', value: 'start', primary: true }];
    return ctx.card({ id: 'measure-offer', title: name + ' · ' + m, lines: lines, actions: actions }).then(function (v) {
      if (v === 'closed') return null;
      if (v !== 'start') {
        try { A().later(rec(), nm.kind, now()); save(); } catch (e) { log('later failed', e); }
        return null;
      }
      var extra = null;
      return askExpect(ctx, nm).then(function () { return nm.kind === 'B1' || nm.kind === 'block' || nm.kind === 'week' ? null : askOverlap(ctx); }).then(function (ov) {
        if (ov) extra = { overlapAnswer: ov };
        return play({ P: ctx.P, wrap: ctx.wrap, kind: nm.kind, card: ctx.card, clock: ctx.clock, extra: extra });
      }).then(function (out) {
        if (out.unavailable) return null;
        if (out.end) return 'end';
        if (ctx.plan && ctx.plan.id) SESSIONS[ctx.plan.id] = { kind: nm.kind, saved: !!out.res, verdict: out.res && out.res.check ? out.res.check.verdict : null };
        return doneCard(ctx, nm, out, where).then(function () {
          // inside a session's item: its exercise's view goes back in place for the item already made
          if (where === 'item' && ctx.def && ctx.P && !ctx.P.use(ctx.def.id, true)) return 'end';
          return null;
        });
      });
    });
  }
  function doneCard(ctx, nm, out, where) {
    var name = NAMES[nm.kind] || 'Check', lines, go = where === 'item' ? 'Back to your session.' : 'Your session starts now.';
    if (!out.res || !out.res.check) lines = [(nm.kind === 'block' ? 'The short check stopped before its end, so it is not used.' : 'The check stopped before its end, so it is not used.') + ' ' + go];
    else {
      var c = out.res.check, mt = c.meter || {};
      lines = [name + ' saved: ' + Object.keys(c.results).length + ' tasks.'];
      if (c.verdict) lines.push(WORDS[c.verdict.words] + ' (verdict at day ' + c.verdict.day + ').');
      else if (isNum(mt.p)) lines.push(mt.line);
      else if (mt.line) lines.push(mt.line);
      lines.push(go);
    }
    return ctx.card({ id: 'measure-done', title: out.res ? 'Saved' : 'Stopped', lines: lines, actions: [{ label: where === 'item' ? 'Back to the session' : 'Start the session', value: 'go', primary: true }] });
  }

  // A background question in a probe's first instruction card, kept for the Lab next to the data (CONTRACT-v1.2
  // events: background): optional, one tap, never scored; asked once whatever happens (a = 'skip' when none was tapped).
  var BACKGROUND = {
    motiongraphs: { q: 'motion-graphs', text: 'Have you learned to read motion graphs before (position or speed against time, as in physics or maths)?',
      options: [['no', 'No'], ['some', 'A little'], ['yes', 'Yes']] },
  };
  function background(def) {
    var bq = BACKGROUND[def.id];
    if (!bq) return null;
    try { if (E().events.count(rec(), 'background', def.id) > 0) return null; } catch (e) { return null; }
    var chosen = null, btns = [], row = h('div.pl-expect.pl-background-q', { role: 'group', 'aria-label': 'Your background' });
    bq.options.forEach(function (x) {
      var b = ui.button(x[1], { kind: 'secondary', onClick: function () {
        chosen = x[0];
        btns.forEach(function (o) { o.setAttribute('aria-pressed', String(o === b)); });
      } });
      b.setAttribute('data-background-answer', x[0]);
      b.setAttribute('aria-pressed', 'false');
      btns.push(b);
      row.appendChild(b);
    });
    return {
      lines: [h('p', bq.text), row, h('p.px-meta', 'Schooling in this changes results on it, so the Lab keeps your answer next to your data. Optional and never scored.')],
      done: function () {
        try { E().events.add(rec(), 'background', def.id, { q: bq.q, a: chosen || 'skip' }, now()); save(); } catch (e) { log('background failed', e); }
      },
    };
  }

  // The expectation question, once, before the first baseline's first item (kept for the Lab; never a score).
  var EXPECT = [[1, 'Not at all'], [2, 'A little'], [3, 'Somewhat'], [4, 'Quite a lot'], [5, 'A lot']];
  function askExpect(ctx, nm) {
    var sp = rec().spatial;
    if (!(nm.kind === 'B1' || nm.kind === 'B2') || (sp && sp.expect)) return Promise.resolve();
    var row = h('div.pl-expect', { role: 'group', 'aria-label': 'Your expectation' }), chosen = null, close = null;
    EXPECT.forEach(function (x) {
      var b = ui.button([h('b.pl-expect-n', String(x[0])), h('span.pl-expect-t', x[1])], { kind: 'secondary', ariaLabel: x[0] + ', ' + x[1], onClick: function () {
        chosen = x[0];
        if (close) close('answered');
      } });
      b.setAttribute('data-expect', String(x[0]));
      row.appendChild(b);
    });
    return ctx.card({
      id: 'expect', title: 'One question first',
      lines: ['How much do you expect practising in Parallax to change your results on tasks like these?', row,
        h('p.px-meta', 'Expectations alone can change test results, so the Lab keeps your answer next to your data. There is no right answer.')],
      actions: [{ label: 'Skip', value: 'skip' }],
      onShow: function (pnl, done) { close = done; },
    }).then(function () {
      if (chosen !== null) { try { A().expect(rec(), chosen, now()); save(); } catch (e) { log('expect failed', e); } }
    });
  }
  // The outside-practice question before a full check after the first (1.1's B7): one tap, never scored.
  var OVERLAP = [['no', 'No'], ['little', 'A little'], ['lot', 'A lot']];
  function askOverlap(ctx) {
    var list = A().checks(rec());
    if (!list.length) return Promise.resolve(null);
    var row = h('div.pl-expect.pl-overlap-q', { role: 'group', 'aria-label': 'Outside practice since your last check' }), chosen = null, close = null;
    OVERLAP.forEach(function (x) {
      var b = ui.button(x[1], { kind: 'secondary', onClick: function () {
        chosen = x[0];
        if (close) close('answered');
      } });
      b.setAttribute('data-overlap-answer', x[0]);
      row.appendChild(b);
    });
    return ctx.card({
      id: 'overlap', title: 'One question first',
      lines: ['Since your last check, have you practised or taken another test with puzzles like these, or with word analogies?', row,
        h('p.px-meta', 'Outside practice changes results too, so the Lab keeps your answer next to your data. It is never scored.')],
      actions: [{ label: 'Skip', value: 'skip' }],
      onShow: function (pnl, done) {
        close = done;
        try { row.firstChild.focus({ preventScroll: true }); } catch (e) { /* ignore */ } // keyboard: start on "No"
      },
    }).then(function () { return chosen; });
  }

  /* ---------- hooks: the session ---------- */

  PX.ui.hooks.on('session:start', function (ctx) {
    if (!SESSION_MODES[ctx.mode] || !ctx.P || quiet()) return null;
    var nm = next(rec(), now());
    if (!nm || !nm.due || nm.when !== 'session-start') return null;
    return offer(ctx, nm, 'start');
  }, { id: 'measure.session', order: 10 });

  // B1 right after the first tutorial (decision 3): the session clock is paused while it runs.
  PX.ui.hooks.on('item:before', function (ctx) {
    if (!SESSION_MODES[ctx.mode] || !ctx.P || !(ctx.afterTutorial || ctx.first) || quiet()) return null;
    var nm = next(rec(), now());
    if (!nm || !nm.due || nm.kind !== 'B1' || nm.when !== 'after-tutorial') return null;
    ctx.clock.pause('measure');
    return offer(ctx, nm, 'item');
  }, { id: 'measure.b1', order: 10 });

  /* ---------- hooks: Today ---------- */

  PX.ui.hooks.on('today:slots', function (ctx) {
    var K = PX.ui.kit, r = ctx.rec, t = ctx.now, st = status(r, t), n = A().checks(r).length, occ = A().occasions(r).length;
    var p = K.panel({ title: 'Spatial Check', className: 'px-slot px-slot--check px-ms-slot', aside: h('span.px-num', n + (n === 1 ? ' check' : ' checks') + (occ > n ? ' · ' + (occ - n) + ' short' : '')) });
    p.el.setAttribute('data-measure', st.kind || '');
    p.body.appendChild(h('p.px-status', st.title));
    p.body.appendChild(h('p.px-slot-text', st.text));
    var m = null;
    try { m = A().meter(r, t); } catch (e) { m = null; }
    if (m && isNum(m.p)) p.body.appendChild(h('div.px-ms-today', meterEl(m), h('p.px-meta', m.line)));
    var foot = h('div.px-slot-foot');
    if (st.label && st.route) foot.appendChild(ui.button(st.label, { kind: st.due ? 'secondary' : 'ghost', go: st.route }));
    if (occ) foot.appendChild(ui.button('See the meter', { kind: 'ghost', go: 'progress' }));
    if (foot.firstChild) p.body.appendChild(foot);
    return { el: p.el, replace: 'check' };
  }, { id: 'measure.today', order: 50 });

  PX.ui.hooks.on('today:session', function (ctx) {
    var nm = next(ctx.rec, ctx.now);
    if (!nm || !nm.due) return null;
    if (nm.kind === 'B1' && nm.when === 'after-tutorial') return 'Your first tutorial ends with your starting point: ' + minutes(nm.minutes) + ' of short tasks without feedback.';
    if (nm.when !== 'session-start') return null;
    var what = { B1: 'your starting point', B2: 'your second starting point', block: 'a short check', regular: 'your 4-weekly check', delayed: 'a delayed check' }[nm.kind] || 'a check';
    return 'This session opens with ' + what + ' (' + minutes(nm.minutes) + ', no feedback): ' + (nm.kind === 'block' ? 'it keeps your probe trend moving.' : 'it measures what training changes.');
  }, { id: 'measure.session-line', order: 20 });

  /* ---------- hooks: the session summary ---------- */

  // Finished learning curves are filed at each session's end (and when the Lab opens), before the trial cap can fold
  // their first answers away; no panel.
  PX.ui.hooks.on('summary:panels', function (ctx) {
    try {
      var r = ctx.rec || rec(), n0 = r.measure && r.measure.curves ? Object.keys(r.measure.curves).length : 0;
      A().curves(r, { keep: true });
      if ((r.measure && r.measure.curves ? Object.keys(r.measure.curves).length : 0) > n0) save();
    } catch (e) { log('curves failed', e); }
    return null;
  }, { id: 'measure.curves-keep', order: 99 });

  PX.ui.hooks.on('summary:panels', function (ctx) {
    var s = ctx.plan && ctx.plan.id ? SESSIONS[ctx.plan.id] : null;
    if (!s || !s.saved) return null;
    delete SESSIONS[ctx.plan.id];
    var K = PX.ui.kit, m = null;
    try { m = A().meter(ctx.rec, ctx.now); } catch (e) { m = null; }
    var p = K.panel({ title: (NAMES[s.kind] || 'Check') + ' saved', className: 'pl-panel px-ms-summary' });
    if (s.verdict) p.body.appendChild(h('p', wordPill(s.verdict.words), ' ', WORDS[s.verdict.words]));
    if (m && isNum(m.p)) { p.body.appendChild(meterEl(m)); p.body.appendChild(h('p.px-meta', m.line)); } else if (m) p.body.appendChild(h('p.px-meta', m.line));
    p.body.appendChild(h('div.pl-summary-actions', ui.button('See the meter in Progress', { kind: 'ghost', go: 'progress' })));
    return { el: p.el, order: 60, invite: s.verdict ? 'check' : null };
  }, { id: 'measure.summary', order: 40 });

  /* ---------- hooks: Progress ---------- */

  function historyEl(r) {
    var list = A().occasions(r);
    if (!list.length) return null;
    var full = list.filter(function (a) { return a.kind !== 'block' && a.kind !== 'week'; });
    return h('details.px-checks',
      h('summary', 'Measurements taken (' + full.length + (full.length === 1 ? ' check, ' : ' checks, ') + (list.length - full.length) + ' short)'),
      h('ol.px-checks-list', list.slice().reverse().slice(0, 60).map(function (a) {
        return h('li', { 'data-kind': a.kind || '' }, h('span.px-num', U.fmtDate(a.date, 'long')), h('span', (NAMES[a.kind] || 'Check') + (a.form && /^[ABC]$/.test(a.form) ? ', form ' + a.form : '') + (a.late ? ' (after some training)' : '')),
          h('span.px-meta', Object.keys(a.results || {}).length + ' tasks'));
      })));
  }

  // Minutes of an occasion of this kind, from the config (items of its mix × config.measure.secPerItem, to the half
  // minute): the one source for every time a player reads about a check (the tour's card, Today, the check's intro).
  function minutesOf(kind, r) {
    var n = 0;
    try { A().mix(kind, r || rec(), { optional: false }, canRun).forEach(function (x) { n += x.items; }); } catch (e) { n = 0; }
    return n ? Math.round(n * E().config.measure.secPerItem / 30) / 2 : null;
  }
  function aboutMinutes(kind, r) { var m = minutesOf(kind, r); return m ? 'about ' + minutes(m) : null; }

  // The schedule in words, from the config (RV-wave2 finding 15: no number typed beside the constant that sets it).
  var WORDNUM = ['no', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten'];
  function scheduleText(r) {
    var MX = E().config.measure, T = E().trend && E().trend.config ? E().trend.config.milestones : null, n = 0, m;
    try { A().mix('block', r, null, canRun).forEach(function (x) { n += x.items; }); } catch (e) { n = 0; }
    m = Math.round(n * MX.secPerItem / 30) / 2;
    var weeks = function (d) { return d % 7 ? d + ' days' : (d / 7 === 1 ? 'week' : WORDNUM[d / 7] ? (d / 7) + ' weeks' : d + ' days'); };
    var perWeek = WORDNUM[MX.blocksPerWeek] || String(MX.blocksPerWeek);
    var days = T && Array.isArray(T.days) ? T.days : [];
    var verdicts = days.length ? 'Verdicts come at day' + (days.length > 1 ? 's ' + days.slice(0, -1).join(', ') + ' and ' + days[days.length - 1] : ' ' + days[0]) +
      (T.every ? ', then every ' + weeks(T.every) : '') + '.' : '';
    return 'It starts with two starting points without feedback; then a short check' + (n ? ' of about ' + minutes(m) : '') + ' opens up to ' + perWeek +
      ' sessions a week, and a full check comes every ' + weeks(MX.everyDays) + '. ' + verdicts;
  }

  function progressPanel(r, t) {
    var K = PX.ui.kit, rep = A().report(r, t), st = status(r, t);
    var occ = A().occasions(r).length;
    var p = K.panel({ title: 'Spatial Check', className: 'px-prog-section px-ms-progress', aside: h('span.px-num', rep.checks + (rep.checks === 1 ? ' check' : ' checks') + (occ > rep.checks ? ' · ' + (occ - rep.checks) + ' short' : '')) });
    p.el.setAttribute('data-section', 'check');
    p.el.id = 'px-prog-check';
    var b = p.body;
    b.setAttribute('data-status', rep.status);
    if (rep.status === 'none') {
      b.appendChild(h('p.px-prog-empty', 'The Spatial Check measures change on tasks you never practise, so it can show whether your training carries over. ' + scheduleText(r)));
    } else if (rep.status !== 'trend') {
      b.appendChild(h('p', rep.lines[0] || ''));
    } else {
      var v = rep.verdict;
      b.appendChild(h('div.px-check-lead',
        v ? h('p.px-check-verdict', 'Day ' + v.day + ' verdict: ', wordPill(v.words)) : h('p.px-check-verdict', 'No verdict yet: the first comes at day ' + rep.meter.next.day + '.'),
        v ? h('p', WORDS[v.words]) : null,
        h('p.px-setting-label.px-ms-meterline', 'The meter'),
        meterEl(rep.meter),
        h('p.px-meta', rep.meter.line)));
      b.appendChild(rangeRows(trendRows(rep)));
      b.appendChild(h('p.px-meta.px-units', 'Changes are in points on each task’s difficulty scale: +1 point is about the step from 50 % to 73 % right on the same item. The ranges hold the change with a 90 % chance; the verdict words come only at milestones, and only for the combined probes.'));
      b.appendChild(h('p.px-meta', rep.lines[1] || ''));
      if (rep.verdicts.length > 1) {
        b.appendChild(h('p.px-setting-label', 'Verdicts so far'));
        b.appendChild(h('ul.px-ms-verdicts', rep.verdicts.map(function (x) { return h('li', h('span.px-num', 'Day ' + x.day), ' ', wordPill(x.words), h('span.px-meta', ' ' + U.fmtDate(x.at, 'long'))); })));
      }
      if (rep.meter.late) b.appendChild(h('p.px-notice.px-like', { 'data-like': 'late' }, PX.ui.kit.icon('about'), h('span', 'Your first starting point came after some training, so the meter may read a little low.')));
    }
    b.appendChild(h('div.px-check-next', { 'data-due': st.due ? '1' : '0' }, h('p', h('b', st.title + '. '), st.text),
      st.label && st.route ? ui.button(st.label, { kind: st.due ? 'primary' : 'ghost', go: st.route }) : null));
    var hist = historyEl(r);
    if (hist) b.appendChild(hist);
    return p.el;
  }

  PX.ui.hooks.on('progress:panels', function (ctx) {
    return { el: progressPanel(ctx.rec, ctx.now), replace: 'check' };
  }, { id: 'measure.progress', order: 10 });

  /* ---------- hooks: Settings, the Lab ---------- */

  PX.ui.hooks.on('settings:sections', function (ctx) {
    var K = PX.ui.kit, s = (ctx && ctx.rec && ctx.rec.settings) || {}, m = 7;
    try { var mix = A().mix('week', ctx.rec, null, canRun), n = 0; mix.forEach(function (x) { n += x.items; }); m = Math.round(n * E().config.measure.secPerItem / 30) / 2; } catch (e) { m = 7; }
    var p = K.panel({ title: 'Measurement week', className: 'px-settings-section' });
    p.el.setAttribute('data-section', 'measureweek');
    p.body.appendChild(K.toggle({
      key: 'measureWeek', label: 'Measurement week', checked: s.measureWeek === true,
      hint: 'On the ' + (WORDNUM[E().config.measure.weekDays] || E().config.measure.weekDays) + ' days before each ' + (E().config.measure.everyDays % 7 ? E().config.measure.everyDays + '-day' : (E().config.measure.everyDays / 7) + '-weekly') + ' verdict, one block a day of about ' + minutes(m) + ' in place of the full check: the sharpest reading for that verdict. Off: the full check opens a session.',
      onChange: function (on) {
        var S = store(), r = S.state;
        r.settings.measureWeek = !!on;
        try { E().events.add(r, 'measure', null, { what: on ? 'week-on' : 'week-off', kind: 'week' }, Date.now()); } catch (e) { log('event failed', e); }
        S.save();
        PX.bus.emit('settings', { key: 'measureWeek', value: !!on });
      },
    }));
    return { el: p.el, after: 'training' };
  }, { id: 'measure.settings', order: 40 });

  PX.ui.hooks.on('lab:panels', function (ctx) {
    var K = PX.ui.kit, rep = A().report(ctx.rec, ctx.now);
    var p = K.panel({ title: 'The transfer ladder', className: 'px-lab-section px-ms-ladder' });
    p.el.setAttribute('data-section', 'ladder');
    p.body.appendChild(h('p', 'Parallax measures carry-over at three distances from the training: near (Other Way Round runs the trained skills backwards), mid (other spatial tasks) and far (motion and mechanisms), with Word Links as a task training should leave alone. The meter judges the three together; each rung shows its own change with its range and no words, until pooled data tell how far familiarity alone moves each one.'));
    if (rep.status === 'trend') p.body.appendChild(rangeRows(trendRows(rep)));
    else p.body.appendChild(h('p.px-meta', 'The ladder fills in once your training has begun after your two starting points.'));
    return { el: p.el, after: 'crossover' };
  }, { id: 'measure.ladder', order: 40 });

  // Learning curves on exercises added in an update (note T1 §5.2): exploratory, for the pooled exports. Reading the
  // panel files finished curves in rec.measure.curves (A().curves keep), so they outlive the trial cap.
  function pc(p, lo, hi) {
    var r = function (x) { return Math.round(x * 100); };
    return r(p) + ' %' + (typeof lo === 'number' && typeof hi === 'number' ? ' (' + r(lo) + '–' + r(hi) + ')' : '');
  }
  PX.ui.hooks.on('lab:panels', function (ctx) {
    var K = PX.ui.kit, CC = E().config.measure.curves, list = [];
    var before = ctx.rec && ctx.rec.measure && ctx.rec.measure.curves ? Object.keys(ctx.rec.measure.curves).length : 0;
    try { list = A().curves(ctx.rec, { keep: true }); } catch (e) { log('curves failed', e); }
    var after = ctx.rec && ctx.rec.measure && ctx.rec.measure.curves ? Object.keys(ctx.rec.measure.curves).length : 0;
    if (after > before) save();
    var names = CC.ex.map(function (id) { var d = PX.ex.get(id); return d ? d.short || d.name : null; }).filter(Boolean);
    var p = K.panel({ title: 'Learning new exercises', className: 'px-lab-section px-ms-curves' });
    p.el.setAttribute('data-section', 'curves');
    p.body.appendChild(h('p', 'Every exercise added in an update is a task nobody has practised. Your first ' + CC.n + ' rated answers on one give a learning curve, and the community\'s pooled exports set many curves beside what each player practised before, to test whether practice with one kind of task helps people pick up the next one faster. Exploratory: one player\'s curve is rough, so the Lab keeps it for pooling and draws no verdict from it.'));
    if (!list.length) p.body.appendChild(h('p.px-meta', 'A curve shows here after ' + CC.min + ' rated answers on ' + (names.length > 1 ? names.slice(0, -1).join(', ') + ' or ' + names[names.length - 1] : names[0] || 'a new exercise') + '.'));
    else {
      var ul = h('ul.px-ms-curve-list');
      list.forEach(function (c) {
        var d = PX.ex.get(c.ex), nm = d ? d.short || d.name : c.ex;
        ul.appendChild(h('li', { 'data-curve': c.ex },
          h('b', nm), ' · ', c.done ? 'your first ' + c.n + ' rated answers' : c.n + ' of ' + CC.n + ' rated answers so far',
          ': on items of the same difficulty, about ' + pc(c.p0, c.p0lo, c.p0hi) + ' right at the start and ' + pc(c.p1, c.p1lo, c.p1hi) + ' at answer ' + c.n + '.'));
      });
      p.body.appendChild(ul);
    }
    return { el: p.el, after: 'ladder' };
  }, { id: 'measure.curves', order: 41 });

  // Balance (a Lab check of the calibrate bet; note T1 §5.2) measures how a player weighs far points, so it must stay
  // untrained: it shows no results and no right answers, before or after a run (RV-wave2 finding 1). The answers stay
  // in rec.measure.balance and the community export; the player sees how many runs are kept and when.
  function balanceMinutes() {
    var L = E().config.measure.lab.balance;
    return Math.round(L.items * E().config.measure.secPerItem / 30) / 2;
  }
  function balanceRuns(rec) {
    var list = rec && rec.measure && Array.isArray(rec.measure.balance) ? rec.measure.balance : [];
    return { n: list.length, last: list.length ? Date.parse(list[list.length - 1].date) : null };
  }
  PX.ui.hooks.on('lab:panels', function (ctx) {
    var K = PX.ui.kit, def = PX.ex.get('balance');
    if (!def || !(E().config.measure.lab || {}).balance) return null;
    var runs = balanceRuns(ctx.rec);
    var p = K.panel({ title: 'Balance: a check of one bet', className: 'px-lab-section px-ms-balance-lab' });
    p.el.setAttribute('data-section', 'balance');
    p.body.appendChild(h('p', 'Central Point practises one kind of judgement about where points sit. This short check asks two related questions that no exercise trains, one about dots on a board and one about houses on a street, to test whether that practice changes how you judge them. About ' + minutes(balanceMinutes()) + '.'));
    p.body.appendChild(h('p.px-meta', 'It shows no results, so that every run measures the same thing: your answers stay in your record and go into the community export, where pooled data test the bet. Run it now and again, for example every few weeks.'));
    p.body.appendChild(h('p.px-meta', runs.n ? (runs.n === 1 ? 'One run kept' : runs.n + ' runs kept') + ', the latest ' + when(runs.last) + '.' : 'No run yet.'));
    var b = ui.button(runs.n ? 'Run it again' : 'Start the Balance check', { kind: 'secondary', onClick: function () { PX.core.router.go('play', { mode: 'check', kind: 'balance' }); } });
    b.setAttribute('data-balance-start', '');
    p.body.appendChild(h('div.px-ms-actions', b));
    return { el: p.el, after: 'curves' };
  }, { id: 'measure.balance', order: 42 });

  PX.ui.measure = { quiet: false, play: play, status: status, names: NAMES, words: WORDS, meterEl: meterEl, rangeRows: rangeRows, balanceRuns: balanceRuns, balanceMinutes: balanceMinutes,
    minutesOf: minutesOf, aboutMinutes: aboutMinutes,
    _: { limitRange: limitRange, sessions: SESSIONS, askExpect: askExpect, askOverlap: askOverlap, offer: offer } };
})(window.PX);
