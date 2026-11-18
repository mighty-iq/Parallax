/* PX.ui.plateau: what the player sees of plateau-breaking (PLAN milestone 3; CONTRACT-v1.2 R; ENGINE.md §20).
   Mounted on PX.ui.hooks at load; it edits no screen file:
     summary:panels (20)   the card on the session summary: what was flat, what changes and why, for how long,
                           the follow-up; a verdict when a change's trial ends; the Chimera invite (kind plateau)
     today:slots (20)      the same card on Today (E.plateau.card): after the session slot, or in place of the
                           mode suggestion while it suggests a mode (a faster or ceiling event; conflict 7)
     today:session (20)    one line under Today's plan while a change runs or an exercise rests
     item:before (20)      the other method's strategy card before an exercise's first item in a trial session
     exercise:lines (30)   the exercise page: its last plateau event and how it ended
     progress:panels (20)  Progress: the plateau history
   Words follow CLAUDE.md rule 2: what the log shows, the change and its reason, how long it runs and what
   comes after; never a promise. Every number comes from the event or E.config.plateau. */
(function (PX) {
  'use strict';

  var ui = PX.ui, h = ui.h, hasOwn = Object.prototype.hasOwnProperty;
  var DAY = 864e5, HIDE_MS = 14 * DAY;
  var WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

  function E() { return PX.engine; }
  function P() { return PX.engine && PX.engine.plateau; }
  function cfg() { return E().config.plateau; }
  function isNum(x) { return typeof x === 'number' && isFinite(x); }
  function isObj(x) { return !!x && typeof x === 'object' && !Array.isArray(x); }
  function store() { return PX.core && PX.core.store; }
  function save() { try { if (store() && typeof store().save === 'function') store().save(); } catch (e) { /* saved later */ } }
  function nameOf(def) { return def ? def.short || def.name : ''; }
  function plural(n, one, many) { return n + ' ' + (n === 1 ? one : many); }

  // Short names of the changes (history lines, Today's status, verdicts).
  var SHORT = {
    'stage-back': 'longer runs', drill: 'a drill', 'speed-in-train': 'deadlines inside Train', rest: 'a few days’ rest',
    'other-strategy': 'the other method', 'wider-mix': 'a wider mix', 'variant-swap': 'another version', 'aim-higher': 'harder items',
    'stage-forward': 'more mixing', 'new-variant': 'a new version',
  };

  function variantText(def, v) {
    var X = PX.ui.exinfo;
    try { if (X && typeof X.variantName === 'function') return X.variantName(def, v) || String(v); } catch (e) { /* the id */ }
    return String(v);
  }
  function dimText(def, key, level) {
    var dim = def && def.dims ? def.dims.filter(function (d) { return d.key === key; })[0] : null;
    if (!dim || !isNum(level) || level < 0 || level >= dim.levels.length) return key;
    var X = PX.ui.exinfo, v = dim.levels[level];
    try { if (X && typeof X.dimText === 'function') { var t = X.dimText(def, dim, v); if (t) return t; } } catch (e) { /* the label */ }
    return (dim.label || dim.key).toLowerCase() + ' ' + v;
  }
  function strategyCard(def, id) {
    var L = PX.ex.learn ? PX.ex.learn(def.id) : null;
    var list = L && Array.isArray(L.strategies) ? L.strategies : [];
    return list.filter(function (c) { return c && c.id === id; })[0] || null;
  }
  // a success level in per cent for the exercise's own reference guessing rate (the level reference's g)
  function pctAt(def, k) { var M = E().model; return Math.round(100 * M.target(M.refChance(def), k)); }
  // a difference in ability (logits) in levels of the exercise's 1–100 scale
  function levelsOf(def, diff) { var r = E().model.range(def), span = r.max - r.min; return span > 1e-9 ? Math.round(diff * 99 / span) : 0; }
  function styleK(rec) { var s = rec && rec.train && rec.train.style; return E().model.styleK(s); }
  function when(ms) { var X = PX.ui.exinfo; try { if (X && typeof X.when === 'function') return X.when(ms); } catch (e) { /* below */ } return PX.util.fmtDate(ms); }

  /* ---------- the words ---------- */

  function flatLine(ev, def) {
    var n = ev.n[1] - ev.n[0];
    return nameOf(def) + ' has held around level ' + ev.level.lv + ' (likely ' + ev.level.lo + '–' + ev.level.hi + ') over your last ' +
      plural(ev.sessions, 'session', 'sessions') + ' with it, ' + n + ' answers.';
  }
  function trialLine(ev, def) {
    var tr = ev.trial;
    return 'It runs for your next ' + tr.sessions + ' ' + nameOf(def) + ' sessions (at least ' + tr.answers + ' answers' + (ev.change === 'rest' ? ' after the rest' : '') +
      '); then Parallax compares your level with this flat stretch and tells you what it sees.';
  }
  // [why, what] for a plateau change
  function changeLines(ev, def, rec) {
    var d = ev.detail || {}, name = nameOf(def), C = E().config;
    switch (ev.change) {
      case 'stage-back': return ['Your ' + name + ' answers right after a switch from another exercise have been weaker than your level predicts.',
        'So ' + name + ' comes in longer runs now (mixing stage ' + d.stage + ' of 5).'];
      case 'drill': {
        var share = isNum(cfg().change.drill) ? cfg().change.drill : C.weak.share;
        return ['Your answers with ' + dimText(def, d.dim, d.level) + ' fall below what your level predicts, and items there are within your reach.',
          'So about 1 in ' + Math.round(1 / share) + ' of its items is set at ' + dimText(def, d.dim, d.level) + ', with the other settings fitted to your level: one weak setting can hold the whole level back.'];
      }
      case 'speed-in-train': return ['Your ' + name + ' answers are steady and accurate, while your right answers vary a lot in time.',
        'So more of its items come with a deadline set from your own times, as in Speed. They train speed only: your untimed level does not count them.'];
      case 'rest': return ['Answers often drop late in long runs, and skills settle between sessions.',
        name + ' rests until ' + (isNum(ev.trial.restUntil) ? WEEKDAYS[new Date(ev.trial.restUntil).getDay()] : 'later') + ' while your other exercises carry on.'];
      case 'other-strategy': {
        var card = strategyCard(def, d.strategy);
        return ['Practice gains stick to the method you use, so a flat stretch is a good moment to try the other one.',
          'Try ' + (card ? '“' + card.title + '”' : 'the other method') + ': its card opens before your first ' + name + ' item in each of those sessions. A new method often feels slower at first, so the first of those sessions does not count against it.'];
      }
      case 'wider-mix': return ['Your ' + name + ' items have come from a narrow range of its settings' + (rec && rec.train && rec.train.variability === 'low' ? ' (Low variability is on)' : '') + '.',
        'So its items mix its versions and spread wider around your level (within ' + Math.round(100 * cfg().change.widerTol) + ' points of your target success instead of ' + Math.round(100 * C.select.tol) + '): practice across varied versions of a task tends to carry over better to new ones.'];
      case 'variant-swap': return ['Most of your recent ' + name + ' items were one version.',
        'So its items come as “' + variantText(def, d.variant) + '”, the version you have used least lately.'];
      case 'aim-higher': return ['You have beaten ' + name + '’s stretch items more often than your level predicts.',
        'So its items aim higher: about ' + pctAt(def, d.k) + ' % right instead of ' + pctAt(def, styleK(rec)) + ' %.'];
      case 'stage-forward': return ['No single cause shows in your answers.',
        'So ' + name + ' comes mixed more often with look-alike exercises (mixing stage ' + d.stage + ' of 5): telling similar tasks apart is a skill of its own.'];
      case 'new-variant': return ['No single cause shows in your answers.',
        'So try “' + variantText(def, d.variant) + '” instead: the same skill with a different question.'];
    }
    return ['', ''];
  }
  function drawnLine(ev) {
    return ev.drawn === 1 && ev.eligible && ev.eligible.length > 1 ?
      'Several changes fit this stall, and Parallax drew this one, so the community’s pooled exports can compare which changes help.' : null;
  }
  function verdictLines(ev, def) {
    var v = ev.verdict, name = nameOf(def), head = name + ' after ' + SHORT[ev.change] + ': ';
    if (!v) return [];
    if (v.words === 'up') return [head + 'clearly up.', 'Your level is about ' + Math.max(1, levelsOf(def, v.diff)) + ' levels above the flat stretch (the likely range of the difference is above zero).'];
    var next = 'Parallax keeps watching; if ' + name + ' stalls again, the next change is a different one.';
    if (v.words === 'none') return [head + 'no change yet.', 'Your level stayed close to the flat stretch. ' + next];
    if (!isNum(v.diff)) return [head + 'unclear yet.', 'A long break came in between, so there was nothing fair to compare. ' + next];
    return [head + 'unclear yet.', ev.trial.sessions + ' sessions are few to tell a small change from the usual noise. ' + next];
  }

  // The card body for one event: fired (plateau, faster, ceiling) or ended (a verdict).
  // opts.today: Today's shorter card (no line about the draw: the summary said it)
  function body(ev, rec, phase, opts) {
    var def = PX.ex.get(ev.exId), out = [];
    if (!def) return out;
    if (phase === 'verdict' || (phase !== 'fire' && ev.verdict)) {
      verdictLines(ev, def).forEach(function (t, i) { out.push(h(i ? 'p' : 'p.pt-head', t)); });
      return out;
    }
    if (ev.kind === 'faster') {
      var pct = ev.rt ? Math.round(100 * (1 - Math.exp(ev.rt.slope))) : null;
      out.push(h('p.pt-head', nameOf(def) + ': a steady level, faster answers.'));
      out.push(h('p', 'Your level has held around ' + ev.level.lv + ' (likely ' + ev.level.lo + '–' + ev.level.hi + ')' + (pct ? ' while your right answers got about ' + pct + ' % faster per 100 answers' : '') + '. That is progress in speed, and Speed trains it on purpose: deadlines on items you already solve.'));
      return out;
    }
    if (ev.kind === 'ceiling') {
      out.push(h('p.pt-head', nameOf(def) + ': top of the range.'));
      out.push(h('p', 'Your level predicts more than your target success even on ' + nameOf(def) + '’s hardest settings, so its items cannot get harder. Speed (deadlines on items you already solve)' +
        (def.variants && def.variants.length > 1 ? ' or another of its versions' : '') + ' can still stretch you.'));
      return out;
    }
    var cl = changeLines(ev, def, rec);
    out.push(h('p.pt-head', flatLine(ev, def)));
    out.push(h('p', cl[0] + ' ' + cl[1]));
    out.push(h('p.px-meta', trialLine(ev, def)));
    var dl = opts && opts.today ? null : drawnLine(ev);
    if (dl) out.push(h('p.px-meta.pt-drawn', dl));
    return out;
  }

  function titleOf(ev, phase) {
    var def = PX.ex.get(ev.exId);
    if (phase === 'verdict' || (phase !== 'fire' && ev.verdict)) return nameOf(def) + ': the change’s result';
    if (ev.kind === 'faster') return 'Speed for ' + nameOf(def);
    if (ev.kind === 'ceiling') return nameOf(def) + ': top of the range';
    return nameOf(def) + ': a change for a flat stretch';
  }

  function speedButton(ev) {
    var def = PX.ex.get(ev.exId), X = PX.ui.exinfo;
    var b = ui.button('Start Speed', { kind: 'secondary', small: true, onClick: function () {
      var route = { mode: 'speed', exId: def.id };
      if (X && typeof X.start === 'function') X.start(def, route); else PX.core.router.go('play', route);
    } });
    b.setAttribute('data-plateau-go', 'speed');
    return b;
  }

  /* ---------- the session summary (summary:panels) ---------- */

  function summaryPanel(ctx) {
    var res = ctx && ctx.res, pl = res && res.plateau;
    if (!pl || (!pl.fired.length && !pl.ended.length)) return null;
    var K = PX.ui.kit, items = [];
    pl.ended.forEach(function (ev) { items.push({ ev: ev, phase: 'verdict' }); });
    pl.fired.forEach(function (ev) { items.push({ ev: ev, phase: 'fire' }); });
    var p = K.panel({ title: items.length === 1 ? titleOf(items[0].ev, items[0].phase) : 'Plateaus', className: 'pl-panel pt-panel' });
    p.el.setAttribute('data-plateau', items.map(function (x) { return x.ev.id; }).join(' '));
    var changed = false;
    items.forEach(function (x) {
      var box = h('div.pt-item', { 'data-plateau-event': x.ev.id, 'data-plateau-phase': x.phase, 'data-plateau-kind': x.ev.kind }, body(x.ev, ctx.rec, x.phase));
      if (x.phase === 'fire' && (x.ev.kind === 'faster' || x.ev.kind === 'ceiling')) box.appendChild(h('div.px-slot-foot', speedButton(x.ev)));
      if (x.phase === 'verdict' && x.ev.verdict && x.ev.verdict.words === 'up') box.classList.add('pt-up');
      p.body.appendChild(box);
      if (x.ev.shown && x.ev.shown.summary !== 1) { x.ev.shown.summary = 1; changed = true; }
    });
    if (changed) save();
    var first = items[0].ev;
    return { el: p.el, order: 20, invite: 'plateau', inviteOpts: { exId: first.exId, kind: first.kind } };
  }

  /* ---------- Today (today:slots, today:session) ---------- */

  function todaySlot(ctx) {
    var rec = ctx && ctx.rec, now = ctx && isNum(ctx.now) ? ctx.now : Date.now(), ev = rec && P() ? P().card(rec, now) : null;
    if (!ev) return null;
    var def = PX.ex.get(ev.exId);
    if (!def) return null;
    var K = PX.ui.kit, running = ev.kind === 'plateau' && ev.trial && ev.trial.end === null && !ev.verdict;
    var p = K.panel({ title: titleOf(ev, ev.verdict ? 'verdict' : 'fire'), className: 'px-slot px-slot--plateau pt-panel', aside: running ? 'a change from your log' : null });
    p.el.setAttribute('data-plateau', ev.id);
    body(ev, rec, ev.verdict ? 'verdict' : 'fire', { today: true }).forEach(function (el) { p.body.appendChild(el); });
    if (running) {
      var pr = P().progress(rec, ev, now);
      if (pr) p.body.appendChild(h('p.px-meta.pt-progress', pr.resting ? 'Resting until ' + WEEKDAYS[new Date(pr.restUntil).getDay()] + '.' :
        'So far: ' + Math.min(pr.sessions, pr.need.sessions) + ' of ' + pr.need.sessions + ' sessions, ' + Math.min(pr.answers, pr.need.answers) + ' of ' + pr.need.answers + ' answers.'));
    }
    var foot = h('div.px-slot-foot');
    if (!ev.verdict && (ev.kind === 'faster' || ev.kind === 'ceiling')) foot.appendChild(speedButton(ev));
    var hide = ui.button(running ? 'Hide this card' : 'Got it', { kind: 'ghost', small: true, onClick: function () {
      var R = store() ? store().state : rec;
      if (!isObj(R.ui)) R.ui = { lastRoute: null };
      if (!isObj(R.ui.plateau)) R.ui.plateau = {};
      if (!isObj(R.ui.plateau.hide)) R.ui.plateau.hide = {};
      R.ui.plateau.hide[ev.id] = Date.now() + HIDE_MS;
      save();
      if (running) ui.toast('The change keeps running; the card is hidden for two weeks.', { kind: 'info' });
      if (PX.ui.app && typeof PX.ui.app.rerender === 'function') PX.ui.app.rerender();
    } });
    hide.setAttribute('data-plateau-hide', '');
    foot.appendChild(hide);
    p.body.appendChild(foot);
    if (ev.shown && !(ev.shown.today > 0)) { ev.shown.today = now; save(); }
    // a suggested mode takes the mode suggestion's place (one suggestion at a time; CONTRACT-v1.2 conflict 7)
    return !ev.verdict && (ev.kind === 'faster' || ev.kind === 'ceiling') ? { el: p.el, replace: 'suggest', order: 20 } : { el: p.el, after: 'session', order: 20 };
  }

  function todayLine(ctx) {
    var rec = ctx && ctx.rec, now = ctx && isNum(ctx.now) ? ctx.now : Date.now();
    if (!rec || !P()) return null;
    var lines = [];
    var exs = ctx.plan && Array.isArray(ctx.plan.exs) ? ctx.plan.exs : [];
    P().list(rec).forEach(function (ev) {
      if (ev.kind !== 'plateau' || !ev.trial || ev.trial.end !== null) return;
      var def = PX.ex.get(ev.exId);
      if (!def) return;
      if (ev.change === 'rest' && isNum(ev.trial.restUntil) && now < ev.trial.restUntil) {
        lines.push(nameOf(def) + ' rests until ' + WEEKDAYS[new Date(ev.trial.restUntil).getDay()] + ' (a change for a flat stretch).');
      } else if (exs.indexOf(ev.exId) >= 0) {
        var pr = P().progress(rec, ev, now);
        lines.push(nameOf(def) + ': ' + SHORT[ev.change] + ', session ' + Math.min(pr.need.sessions, pr.sessions + 1) + ' of ' + pr.need.sessions + '.');
      }
    });
    return lines.length ? h('p.px-meta.pt-today-line', { 'data-plateau-line': '' }, lines.join(' ')) : null;
  }

  /* ---------- the other method before an item (item:before) ---------- */

  function beforeItem(ctx) {
    if (!ctx || !ctx.first || !ctx.def || !P() || (ctx.mode !== 'train' && ctx.mode !== 'path')) return null;
    var rec = ctx.rec, now = isNum(ctx.now) ? ctx.now : Date.now(), ev = P().active(rec, ctx.def.id, now);
    if (!ev || ev.change !== 'other-strategy' || typeof ctx.card !== 'function') return null;
    if (ev.disp && ctx.plan && ctx.plan.display && ev.disp !== ctx.plan.display) return null;
    var card = strategyCard(ctx.def, ev.detail.strategy), name = nameOf(ctx.def);
    if (!card) return null;
    var lines = [card.text].concat(Array.isArray(card.steps) ? card.steps : []).filter(Boolean);
    lines.push('This is the change for ' + name + '’s flat stretch: use this method for this session.');
    var t0 = Date.now();
    return Promise.resolve(ctx.card({ id: 'plateau-strategy', title: 'Try the other method: ' + card.title, def: ctx.def, lines: lines,
      actions: [{ label: 'Got it', value: 'ok', primary: true }] })).then(function () {
      var EV = E().events;
      try { if (EV && typeof EV.add === 'function') { EV.add(rec, 'card', ctx.def.id, { card: card.id, src: 'plateau', ms: Date.now() - t0 }, Date.now()); save(); } } catch (e) { /* logged when it can be */ }
      return null;
    });
  }

  /* ---------- the exercise page (exercise:lines) and Progress (progress:panels) ---------- */

  function eventLine(ev) {
    var when0 = when(ev.at);
    if (ev.kind === 'faster') return when0 + ': a steady level with faster answers (Speed suggested).';
    if (ev.kind === 'ceiling') return when0 + ': top of the range.';
    var v = ev.verdict, tail = v ? (v.words === 'up' ? 'clearly up' : v.words === 'none' ? 'no change yet' : 'unclear yet') : ev.trial && ev.trial.end === null ? 'running' : 'ended';
    return when0 + ': flat around level ' + ev.level.lv + '; ' + SHORT[ev.change] + ' (' + tail + ').';
  }
  function exerciseLine(ctx) {
    if (!ctx || !ctx.def || !ctx.rec || !P() || ctx.where !== 'page') return null;
    var list = P().list(ctx.rec, ctx.def.id);
    if (!list.length) return null;
    var last = list[list.length - 1];
    return { el: h('p.px-meta.pt-ex-line', { 'data-plateau-line': last.id }, h('b', 'Plateaus: '), (list.length > 1 ? list.length + ' so far; the last ' : 'one, ') + eventLine(last)), order: 30 };
  }
  function progressPanel(ctx) {
    if (!ctx || !ctx.rec || !P()) return null;
    var list = P().list(ctx.rec);
    if (!list.length) return null;
    var K = PX.ui.kit, p = K.panel({ title: 'Plateaus', aside: plural(list.length, 'event', 'events'), className: 'px-prog-section pt-panel' });
    p.el.setAttribute('data-plateau-history', '');
    p.body.appendChild(h('p.px-meta', 'When an exercise’s level holds over about ' + cfg().window + ' answers, Parallax changes one thing for a few sessions and then compares. The history:'));
    p.body.appendChild(h('ul.pl-list.pt-history', list.slice(-10).reverse().map(function (ev) {
      var def = PX.ex.get(ev.exId);
      return h('li', { 'data-plateau-event': ev.id }, h('b', nameOf(def) || ev.exId), ' ', eventLine(ev));
    })));
    return { el: p.el, after: 'Personal bests' };
  }

  PX.ui.plateau = {
    summaryPanel: summaryPanel, todaySlot: todaySlot, todayLine: todayLine, beforeItem: beforeItem, exerciseLine: exerciseLine, progressPanel: progressPanel,
    _: { body: body, changeLines: changeLines, verdictLines: verdictLines, flatLine: flatLine, trialLine: trialLine, SHORT: SHORT },
  };

  var H = PX.ui.hooks;
  if (H && typeof H.on === 'function') {
    H.on('summary:panels', summaryPanel, { id: 'plateau.card', order: 20 });
    H.on('today:slots', todaySlot, { id: 'plateau.today', order: 20 });
    H.on('today:session', todayLine, { id: 'plateau.line', order: 20 });
    H.on('item:before', beforeItem, { id: 'plateau.strategy', order: 20 });
    H.on('exercise:lines', exerciseLine, { id: 'plateau.exercise', order: 30 });
    H.on('progress:panels', progressPanel, { id: 'plateau.history', order: 20 });
  }
  void hasOwn;
})(window.PX);
