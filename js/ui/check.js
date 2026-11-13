/* PX.ui.check: the Spatial Check (mode 'check'; PLAN §4, §6; ENGINE.md §10, §17).
   Probes are tasks that are never trained: no feedback, no reveal, no show me. The flow:
     intro (what it is, about 15 minutes) → the expectations question once at baseline
     (PX.engine.assess.expect) → per probe: its instruction screen (learn.instruction) and its
     worked example (step.probe.example = learn.demo[0], played by view.demo, never scored or
     logged) → 16 adaptive items; def.timeLimit(params) ends an item as a time-out (scored
     wrong, rt = the limit); a pause sets [data-paused] on the trial, so the probe's own bar
     stops → a calm progress line → at the end a short note on what the numbers mean and when
     the first comparison will be ready.
   A check counts only when it is complete: one stopped part-way (Stop the check asks first)
   never becomes a result, so a half check never distorts the baseline; its answered items stay
   in the trial log and show in the Log as "not finished".
   PX.ui.check.run(host, route, ctx) → cleanup   (js/ui/play.js routes mode 'check' here) */
(function (PX) {
  'use strict';

  var win = window, ui = PX.ui, h = ui.h, U = PX.util, store = PX.core.store, router = PX.core.router;
  var EXPECT = [[1, 'Not at all'], [2, 'A little'], [3, 'Somewhat'], [4, 'Quite a lot'], [5, 'A lot']];
  var KIND = { B1: 'Baseline 1', B2: 'Baseline 2', B3: 'Baseline 3', regular: 'Check', delayed: 'Delayed check' };
  var STOP_TEXT = 'A check counts only when it is complete, so the tasks you finished will not be used for your results. Your answers stay in the Log.';

  function E() { return PX.engine; }
  function rec() { return store.state; }
  function now() { return Date.now(); }
  function isNum(x) { return typeof x === 'number' && isFinite(x); }
  function save() { try { store.save(); } catch (e) { /* the next save writes it */ } }
  function log(m, e) { if (win.console) console.error('PX.ui.check: ' + m, e || ''); }
  function name(def) { return def ? def.short || def.name : ''; }

  function run(host, route) {
    var Play = PX.ui.play, p = route.params || {};
    var wrap = h('div.pl-screen', { 'data-mode': 'check' });
    host.appendChild(wrap);
    var S = { plan: null, done: false, stopped: false, answered: 0, P: null, step: null, probeNo: 0, lastProbe: null };
    var opts = { now: now(), display: displayOf(), can: function (d) { return Play.canRun(d); } };
    if (p.optional === '1' || p.optional === true) opts.optional = true;
    try { S.plan = E().modes.start(rec(), 'check', opts); } catch (e) { log('start failed', e); S.plan = { unavailable: 'The Spatial Check could not start.' }; }
    if (S.plan.unavailable) {
      wrap.appendChild(Play.screenHead('Spatial Check', 'Not available right now', S.plan.unavailable));
      wrap.appendChild(h('div.pl-summary-actions', ui.button('Back to Today', { kind: 'primary', go: 'home' })));
      return null;
    }
    var probes = S.plan.check.probes.map(function (x) { return x.id; });
    var kind = S.plan.check.kind, baseline = /^B/.test(kind || '');
    S.device = { display: displayOf(), viewport: Math.round(win.innerWidth || 0) + 'x' + Math.round(win.innerHeight || 0), inputs: {} };
    Play.setChrome(true);
    var P = S.P = Play.player({ endLabel: 'Stop the check' });
    wrap.appendChild(h('h1.px-sr', 'Spatial Check'));
    wrap.appendChild(P.el.root);
    P.el.helpBtn.hidden = true;
    // Stop the check (pause sheet) asks first; the click is caught on its way to the button.
    P.el.pause.addEventListener('click', function (e) {
      if (!e.target || !e.target.closest || !e.target.closest('[data-end]') || S.done) return;
      e.stopPropagation();
      e.preventDefault();
      ui.confirm(STOP_TEXT, { title: 'Stop the check?', ok: 'Stop the check', cancel: 'Keep going', danger: true }).then(function (yes) {
        if (yes && !S.done) P.skip(true); // the item counts nowhere; the run ends with tr.end
      });
    }, true);

    function progress(step) {
      var pr = step && step.probe, total = S.plan.total;
      var at = pr ? probes.indexOf(pr.id) + 1 : S.probeNo;
      P.setMeta('Task ' + at + ' of ' + probes.length + (pr ? ' · item ' + Math.min(pr.of, pr.index + 1) + ' of ' + pr.of : ''));
      P.setProgress(S.answered, total);
    }

    function intro() {
      var lines = [
        probes.length + ' short tasks that Parallax never trains, 3 to 5 minutes each: ' + probes.length * 3 + ' to ' + probes.length * 5 + ' minutes in all.',
        'There is no feedback. The items adapt to your answers, so expect to get roughly 6 to 8 in 10 right, depending on the task: the difficulty you reach carries the information, not the count.',
        'Answer as well as you can, and guess when you are unsure. Each task has a time limit per item, shown as a slow bar.',
        baseline ? 'This is ' + (KIND[kind] || 'a baseline') + ': your starting point. Two baselines make it steadier.' : 'Your results are compared with your baseline, a control task and what familiarity alone would give.',
      ];
      return Play.showCard(wrap, P.el.root, {
        id: 'check-intro', title: 'Spatial Check' + (KIND[kind] ? ' · ' + KIND[kind] : ''), hide: P.el.root, lines: lines,
        actions: [{ label: 'Later', value: 'later' }, { label: 'Start the check', value: 'start', primary: true }],
      });
    }

    // Asked once, at baseline, before any item (kept for the Lab analysis; never shown as a score).
    function expectations() {
      var sp = rec().spatial;
      if (!baseline || (sp && sp.expect)) return Promise.resolve();
      return new Promise(function (resolve) {
        var row = h('div.pl-expect', { role: 'group', 'aria-label': 'Your expectation' }), close = null;
        EXPECT.forEach(function (x) {
          var b = ui.button([h('b.pl-expect-n', String(x[0])), h('span.pl-expect-t', x[1])], { kind: 'secondary', ariaLabel: x[0] + ', ' + x[1], onClick: function () {
            try { E().assess.expect(rec(), x[0], now()); save(); } catch (e) { log('expect failed', e); }
            if (close) close('answered');
          } });
          b.setAttribute('data-expect', String(x[0]));
          row.appendChild(b);
        });
        Play.showCard(wrap, P.el.root, {
          id: 'expect', title: 'One question first', hide: P.el.root,
          lines: ['How much do you expect practising in Parallax to change your results on tasks like these?', row,
            h('p.px-meta', 'Expectations alone can change test results, so the Lab keeps your answer next to your data. There is no right answer.')],
          actions: [{ label: 'Skip', value: 'skip' }],
          onShow: function (pnl, done) { close = done; },
        }).then(resolve);
      });
    }

    // The worked example ends on its answer: the key marked ✓ in the answer grid (the view's last
    // caption states it). Never on a scored item: those give no feedback.
    function markKey(def, item) {
      var g = P.grid, type = item && (item.answer || def.answer), key = item && item.key;
      if (!g || typeof g.mark !== 'function') return false;
      var right = type === 'yesno' ? [key ? 0 : 1] : Array.isArray(key) ? key : isNum(key) ? [key] : [];
      right.forEach(function (i) { g.mark(i, 'right'); });
      return right.length > 0;
    }
    // Scrolls the answer grid above the sticky panel that holds the Start button.
    function answerIntoView() {
      try {
        var g = P.el.grid.getBoundingClientRect(), fb = P.el.feedback.getBoundingClientRect();
        var over = g.bottom + 8 - fb.top;
        if (over > 0) win.scrollBy(0, Math.min(over, Math.max(0, g.top - 64)));
      } catch (e) { /* ignore */ }
    }

    // The probe's instruction screen and its worked example (never scored, never logged).
    function instruct(step, def) {
      // learn.instruction is { title, lines } or, for some probes, the lines alone.
      var learn = PX.ex.learn(def.id) || {}, ins = learn.instruction || {};
      var lines = (Array.isArray(ins) ? ins : ins.lines || []).slice();
      if (!lines.length && learn.goal) lines.push(learn.goal);
      var ex = step.probe && step.probe.example;
      // The time limit in words, for everyone (the bar alone says nothing to a screen reader).
      var lim = limitRange(def);
      if (lim) lines.push((lim.lo === lim.hi ? 'Each item has up to ' + lim.lo + ' seconds' : 'Each item has ' + lim.lo + ' to ' + lim.hi + ' seconds (harder items get more)') + ', shown as a slow bar under it.');
      return Play.showCard(wrap, P.el.root, {
        id: 'probe-intro', title: 'Task ' + (probes.indexOf(def.id) + 1) + ' of ' + probes.length + ': ' + (ins.title || name(def)), def: def, hide: P.el.root,
        lines: lines.concat(ex && P.view && P.view.demo ? ['First, one worked example. It is never scored.'] : []),
        actions: ex && P.view && P.view.demo ? [{ label: 'Skip the example', value: 'skip' }, { label: 'Show the example', value: 'example', primary: true }] : [{ label: 'Start', value: 'start', primary: true }],
      }).then(function (v) {
        if (v !== 'example') return null;
        var item;
        try { item = def.generate(PX.rng(ex.seed >>> 0), Play.fillParams(def, ex.params)); } catch (e) { log('example failed', e); return null; }
        P.setMeta('Worked example · never scored');
        P.setLabel(def);
        return new Promise(function (resolve) {
          var shown = false;
          function startBtn() {
            if (shown) return;
            shown = true;
            var marked = markKey(def, item);
            var b = ui.button('Start ' + name(def), { kind: 'primary', key: 'Enter', onClick: function () { P.abort(); } });
            b.setAttribute('data-card', 'start');
            P.note(h('div.pl-note', h('p', 'That was the worked example' + (marked ? '; its answer is marked ✓' : '') + '. The items that follow count, and give no feedback.'), h('div.pl-note-actions', b)));
            P.el.feedback.hidden = false;
            P.el.actions.hidden = true;
            try { b.focus({ preventScroll: true }); } catch (e) { /* ignore */ }
            if (marked) answerIntoView();
          }
          P.demo(item, { feedback: false, goal: Play.goalOf(learn, item), onDemoEnd: startBtn }).then(function (tr) {
            P.el.actions.hidden = false;
            if (tr && tr.end) { resolve('stop'); return; }
            resolve(null);
          });
          P.when('respond').then(function () { if (!P.view || !P.view.demo) startBtn(); });
        });
      });
    }

    function loop() {
      if (S.done) return;
      var step;
      try { step = E().modes.next(S.plan, rec(), now()); } catch (e) { log('next failed', e); finish(); return; }
      if (!step || step.done) { finish(); return; }
      S.step = step;
      var def = PX.ex.get(step.exId);
      if (!def || !P.use(step.exId)) {
        try { E().modes.answer(S.plan, rec(), step, { correct: false, outcome: 'skipped' }, now()); } catch (e) { /* ignore */ }
        if (++S.skips > 6) { finish(); return; }
        loop();
        return;
      }
      if (S.lastProbe !== def.id) { S.lastProbe = def.id; S.probeNo++; }
      skipLabel(!!S.freeSkip[def.id]);
      P.setLabel(def);
      progress(step);
      // The instruction screen once per task (a skipped or voided first item is replaced, not re-introduced).
      var first = step.probe && step.probe.index === 0 && !S.instructed[def.id];
      if (first) S.instructed[def.id] = true;
      var pre = first ? instruct(step, def) : Promise.resolve(null);
      pre.then(function (r) {
        if (S.done) return null;
        if (r === 'stop') { stop(); return null; }
        var item;
        try { item = def.generate(PX.rng(step.seed), step.params); } catch (e) { log('generate failed', e); item = null; }
        if (!item) { E().modes.answer(S.plan, rec(), step, { correct: false, outcome: 'skipped' }, now()); loop(); return null; }
        P.setLabel(def);
        progress(step);
        var limit = def.timeLimit ? def.timeLimit(item.params) : null;
        return P.run(item, { feedback: false, limitMs: limit || null, limitBar: false, goal: Play.goalOf(PX.ex.learn(def.id), item) }).then(function (tr) {
          if (S.done || tr.outcome === 'aborted') return null;
          if (tr.end) { stop(); return null; }
          var result = { correct: !!(tr.result && tr.result.correct), rt: tr.rtMs, timeout: !!tr.timeout, input: tr.source };
          if (tr.outcome === 'stutter') { result.outcome = 'stutter'; result.voided = true; }
          else if (tr.outcome === 'skipped') {
            // One free skip per task (a new item replaces it). Later skips count as wrong answers,
            // so hard items cannot be rerolled (that would bias the adaptive estimate).
            if (!S.freeSkip[def.id]) { S.freeSkip[def.id] = true; result.outcome = 'skipped'; skipLabel(true); }
          }
          if (item.fallback === true) result.fallback = true;
          var out;
          try { out = E().modes.answer(S.plan, rec(), step, result, now()); } catch (e) { log('answer failed', e); out = {}; }
          save();
          if (out.outcome === 0 || out.outcome === 1) {
            S.answered++;
            if (!tr.timeout) { var inp = inputName(tr.input || tr.source); S.device.inputs[inp] = (S.device.inputs[inp] || 0) + 1; }
          }
          progress(step);
          return P.waitNext().then(loop);
        });
      }).catch(function (e) { log('item failed', e); finish(); });
    }

    function stop() {
      if (S.done) return;
      S.done = S.stopped = true;
      P.destroy();
      Play.setChrome(false);
      PX.ui.clear(wrap);
      wrap.appendChild(Play.screenHead('Spatial Check', 'Check stopped', 'A check counts only when it is complete, so this one is not used for your results. Your answers stay in the Log, marked “not finished”. Take the whole check again any time: it takes 15 to 25 minutes.'));
      wrap.appendChild(h('div.pl-summary-actions', ui.button('Back to Today', { kind: 'primary', go: 'home' }), ui.button('Open the Log', { kind: 'secondary', go: 'log' })));
    }

    function finish() {
      if (S.done) return;
      S.done = true;
      var res = null;
      deviceExtra(S);
      try { res = E().modes.finish(S.plan, rec(), now()); } catch (e) { log('finish failed', e); }
      save();
      try { store.flush(); } catch (e) { /* the debounced save runs later */ }
      P.destroy();
      Play.setChrome(false);
      PX.ui.clear(wrap);
      renderEnd(wrap, res);
      try { win.scrollTo(0, 0); } catch (e) { /* ignore */ }
    }

    // Skip this item: free once per task; the pause sheet says when the next skip counts as wrong.
    function skipLabel(counts) {
      if (P.el.skip && P.el.skip.firstChild) P.el.skip.firstChild.textContent = counts ? 'Skip (counts as wrong)' : 'Skip this item';
      if (P.el.pauseNote) P.el.pauseNote.textContent = counts ? 'This task’s free skip is used: another skip counts as a wrong answer.' : 'One skip per task is free: a new item replaces it.';
    }

    S.skips = 0;
    S.freeSkip = {};
    S.instructed = {};
    intro().then(function (v) {
      if (S.done) return null; // the screen was left with the intro open
      if (v !== 'start') { S.done = true; P.destroy(); Play.setChrome(false); router.go('home'); return null; }
      return expectations().then(function () { return S.done ? null : askOverlap(S, wrap); }).then(function () { if (!S.done) loop(); });
    });

    PX.ui.check.session = S;
    return function cleanup() {
      Play.setChrome(false);
      if (!S.done) { S.done = S.stopped = true; } // a check left part-way does not count (its answers stay in the Log)
      if (Play.closeCards) Play.closeCards(); // open cards and their key layers go with the screen
      if (S.P) S.P.destroy();
      if (PX.ui.check.session === S) PX.ui.check.session = null;
    };
  }

  function displayOf() { try { return E().est.displayClass(win.innerWidth, win.innerHeight); } catch (e) { return 'large'; } }

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
    walk(0, def.variants && def.variants.length ? { variant: def.variants[0] } : {});
    return hi > 0 ? { lo: Math.round(lo / 1000), hi: Math.round(hi / 1000) } : null;
  }

  // What a check was taken with, so results compare like with like (CONTRACT B2): the screen
  // class and size at the start, and the input that answered most items ('touch', 'mouse',
  // 'pen', 'key'; 'unknown' when nothing says). assess.finish copies plan.check.extra onto the record.
  function inputName(src) {
    var s = String(src || '').toLowerCase();
    return s === 'touch' ? 'touch' : s === 'pen' ? 'pen' : s === 'key' || s === 'keys' || s === 'keyboard' ? 'key' : s === 'mouse' || s === 'pointer' ? 'mouse' : 'unknown';
  }
  function deviceExtra(S) {
    var c = S.plan && S.plan.check;
    if (!c) return;
    if (!c.extra || typeof c.extra !== 'object') c.extra = {};
    c.extra.display = S.device.display;
    c.extra.viewport = S.device.viewport;
    var best = 'unknown', most = 0;
    Object.keys(S.device.inputs).forEach(function (k) { if (k !== 'unknown' && S.device.inputs[k] > most) { most = S.device.inputs[k]; best = k; } });
    c.extra.input = best;
  }

  function renderEnd(wrap, res) {
    var K = PX.ui.kit, Play = PX.ui.play, c = res && res.check;
    wrap.appendChild(Play.screenHead('Spatial Check · ' + K.fmtWhen(now()), c ? 'Check saved' : 'Check ended', null));
    var out = h('div.pl-summary');
    wrap.appendChild(out);
    if (!c) {
      out.appendChild(h('p.px-lead', 'No answers were recorded, so nothing was saved.'));
      out.appendChild(h('div.pl-summary-actions', ui.button('Back to Today', { kind: 'primary', go: 'home' })));
      return;
    }
    var p = K.panel({ title: KIND[c.kind] || 'Check', className: 'pl-panel', aside: 'form ' + c.form });
    p.body.appendChild(h('ul.pl-list.pl-check-list', Object.keys(c.results).map(function (id) {
      var def = PX.ex.get(id), r = c.results[id];
      return h('li', { 'data-probe': id }, h('b', name(def) || id), ': ' + r.n + ' items' + (isNum(r.rtMed) ? ', median time of right answers ' + PX.ui.play.fmtRt(r.rtMed) : '') + '.');
    })));
    p.body.appendChild(h('p', 'What the numbers mean: the items adapted to your answers, so getting roughly 6 to 8 in 10 right, depending on the task, is expected. Parallax records the difficulty you reached on each task’s own scale, with its uncertainty. These numbers are a starting point to compare with your later checks; they are not scores against other people and not an IQ.'));
    out.appendChild(p.el);
    // When the next check opens: the engine's one rule (assess.nextCheck), as Today and Progress say it.
    var due = null;
    try { due = E().assess.nextCheck(rec(), now()); } catch (e) { due = null; }
    var pn = K.panel({ title: 'Next', className: 'pl-panel pl-next' }), when = due && isNum(due.dueAt) ? K.fmtWhen(due.dueAt) : null;
    var txt, A = E().config.assess, rule = A.everyDays + ' days and ' + A.everySessions + ' practice sessions';
    if (c.kind === 'B1') txt = 'Baseline 2 is next, 12 hours or more after this one' + (when ? ' (from ' + when + ')' : '') + '. The first comparison is ready with the check after it, ' + rule + ' after your baselines.';
    else if (c.kind === 'B2' || c.kind === 'B3') txt = due && due.kind === 'B3' ? 'Your two baselines differ more than expected, so a third one, 12 hours or more after this one' + (when ? ' (from ' + when + ')' : '') + ', makes the starting point steadier.' : 'Your starting point is set. The first comparison is ready with your next check, ' + rule + ' from now' + (when ? ' (' + U.fmtDate(due.dueAt, 'long') + ' at the earliest)' : '') + '.';
    else txt = 'The comparison with your baselines, the control task and the expected familiarity gain is in Progress. After one check “unclear yet” is the usual result; it is not the same as no progress.';
    pn.body.appendChild(h('p', txt));
    pn.body.appendChild(h('div.pl-summary-actions', ui.button('Back to Today', { kind: 'primary', go: 'home' }), ui.button('See Progress', { kind: 'secondary', go: 'progress' })));
    out.appendChild(pn.el);
  }

  PX.ui.check = { run: run, session: null };

  /* ---------- B7: the outside-practice question (v1.1 PLAN M6; R4 §6.3 c) ----------
     askOverlap(S, wrap) → Promise<answer | null>: at the start of every check after the first
     (one complete check already in rec.assess), one tap, before the first item. The answer
     ('no' | 'little' | 'lot') goes to S.plan.check.extra.overlapAnswer, which assess.finish copies
     onto the check record; Skip stores nothing. Logged for the Lab, never scored. */
  var OVERLAP = [['no', 'No'], ['little', 'A little'], ['lot', 'A lot']];
  function askOverlap(S, wrap) {
    var Play = PX.ui.play, list = rec().assess;
    if (!S || S.done || !S.P || !S.plan || !S.plan.check || !Array.isArray(list) || !list.length) return Promise.resolve(null);
    return new Promise(function (resolve) {
      var row = h('div.pl-expect.pl-overlap-q', { role: 'group', 'aria-label': 'Outside practice since your last check' }), close = null;
      OVERLAP.forEach(function (x) {
        var b = ui.button(x[1], { kind: 'secondary', onClick: function () {
          var c = S.plan.check;
          if (!c.extra || typeof c.extra !== 'object') c.extra = {};
          c.extra.overlapAnswer = x[0];
          S.overlapAnswer = x[0];
          if (close) close('answered');
        } });
        b.setAttribute('data-overlap-answer', x[0]);
        row.appendChild(b);
      });
      Play.showCard(wrap, S.P.el.root, {
        id: 'overlap', title: 'One question first', hide: S.P.el.root,
        lines: ['Since your last check, have you practised or taken another test with puzzles like these, or with word analogies?', row,
          h('p.px-meta', 'Outside practice changes results too, so the Lab keeps your answer next to your data. It is never scored.')],
        actions: [{ label: 'Skip', value: 'skip' }],
        onShow: function (pnl, done) { close = done; },
      }).then(function () { resolve(S.overlapAnswer || null); });
    });
  }
  PX.ui.check.askOverlap = askOverlap;
})(window.PX);
