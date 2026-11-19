/* PX.ui.bets: the transfer bets on the screens and the add-on layers between items (v1.2 wave 2; PLAN
   milestone 4; docs/dev/CONTRACT-v1.2.md R; ENGINE.md §22). Mounted through PX.ui.hooks only:
     exercise:lines     the bet line on the exercise page and in How to play; off-screen challenges
     about:sections     "Test the bets with us"
     lab:panels         "Test the bets with us": the bet trials now, dose, the events and dose exports
     settings:sections  "Join the bet trials" (setting `betTrials`, on by default)
     summary:panels     a one-tap expectation rating per bet (a baseline, then at week 4)
     item:before        comparison rounds and bridge sets (js/ui/bets-layers.js adds them)
     item:notes         the detailed calibration note on calib-detail items
   The words of each bet come from PX.engine.bets.INFO, the same as the guide's. Nothing here runs
   during a stimulus: every hook is between items. */
(function (PX) {
  'use strict';

  var ui = PX.ui, h = ui.h, U = PX.util;
  var DAY = 86400000;
  function B() { return PX.engine && PX.engine.bets; }
  function store() { return PX.core.store; }
  function isNum(x) { return typeof x === 'number' && isFinite(x); }
  function isObj(x) { return !!x && typeof x === 'object' && !Array.isArray(x); }
  function shortOf(id) { var d = PX.ex.get(id); return d ? d.short || d.name : id; }
  function andList(list) { return list.length < 2 ? list.join('') : list.slice(0, -1).join(', ') + ' and ' + list[list.length - 1]; }
  function uiBets(rec) {
    if (!isObj(rec.ui)) rec.ui = {};
    if (!isObj(rec.ui.bets)) rec.ui.bets = {};
    return rec.ui.bets;
  }
  // The exercises of a bet, by name; the six admissions-test formats as one phrase.
  function exNames(bet) {
    var ids = B().exercises(bet);
    if (bet === 'format') return 'the six admissions-test formats';
    return andList(ids.map(shortOf));
  }

  try { store().setting('betTrials', { def: true, type: 'bool' }); } catch (e) { if (window.console) console.error('PX.ui.bets: the betTrials setting', e); }

  /* ---------- the bet line (exercise page, How to play) ---------- */

  var LAYER_WORDS = { compare: 'comparison rounds', bridge: 'bridge sets', produce: 'draw-the-answer items', calib: 'detailed feedback on your estimates' };
  function betLine(def, rec, now, where) {
    var b = B(), bet = b.of(def);
    if (!bet) return null;
    var x = b.INFO[bet];
    var head = h('p.px-bet-head', h('span.px-tag.px-bet-tag', 'The bet · ' + x.label), x.isNew ? h('span.px-tag.px-bet-new', 'new, transfer untested') : null);
    var kids = [head, h('p.px-bet-text', x.line)];
    if (where === 'page') {
      var layers = b.LAYERS.filter(function (l) { return b.hosts(def, l); }).map(function (l) { return LAYER_WORDS[l]; });
      var extra = [];
      // in the trials, an add-on comes in some periods and not in others; out of them, always (RV-wave2 finding 18)
      var inTrials = b.joined(rec);
      if (layers.length) extra.push(cap(andList(layers)) + (inTrials ? ' come with this exercise in some periods and not in others, at random, so the community can test the bet.'
        : ' come with this exercise every time while you are out of the bet trials (Settings).'));
      if (inTrials && def.layers && def.layers.produce && bet === 'produce') extra.push('Its own bet is producing the answer, so its draw-the-answer items come in about half of the periods.');
      extra.push('Evidence so far: ' + gradeText(x.grade) + '. ' + b.GRADES[x.grade]);
      kids.push(h('p.px-meta.px-bet-meta', extra.join(' ')));
      var go = ui.button('Test the bets with us', { kind: 'ghost', small: true, go: 'lab' });
      go.setAttribute('data-bets', 'lab');
      kids.push(h('p.px-bet-go', go));
    }
    return h('div.px-bet-line', { 'data-bet': bet, 'data-where': where }, kids);
  }
  function cap(s) { return s ? s.charAt(0).toUpperCase() + s.slice(1) : s; }
  function gradeText(g) { return String(g).replace('-', '−'); } // B- reads B− (a minus sign), as in the guide

  PX.ui.hooks.on('exercise:lines', function (ctx) {
    var el = ctx && ctx.def ? betLine(ctx.def, ctx.rec, ctx.now, ctx.where === 'howto' ? 'howto' : 'page') : null;
    return el ? { el: el, order: 10 } : null;
  }, { id: 'bets.line', order: 10 });

  // The add-ons this build has, in words (the guide's page says the same; bets.test.mjs checks it):
  // "In this version: comparison rounds for Spin, Nets, Orient and Central Point; …".
  var ADDON_WORDS = { compare: 'comparison rounds', bridge: 'bridge sets', produce: 'draw-the-answer items', calib: 'detailed feedback on your estimates' };
  function addonsLine() {
    var b = B(), parts = b.LAYERS.map(function (l) {
      var ids = b.hostsOf(l);
      return ids.length ? ADDON_WORDS[l] + ' for ' + andList(ids.map(shortOf)) : null;
    }).filter(Boolean);
    return parts.length ? 'In this version: ' + parts.join('; ') + '.' : 'No add-on is in this version yet.';
  }

  /* ---------- About: "Test the bets with us" ---------- */

  function betList(compact) {
    var b = B();
    return h('dl.px-bets', b.IDS.map(function (id) {
      var x = b.INFO[id];
      return h('div', { 'data-bet': id },
        h('dt', x.label, x.isNew ? h('span.px-tag.px-bet-new', 'new') : null),
        h('dd', h('span.px-bet-text', x.line), h('span.px-meta.px-bet-ex', ' ' + cap(exNames(id)) + (compact ? '' : '. Evidence so far: ' + gradeText(x.grade) + '.'))));
    }));
  }
  // A period's length in words, from config.bets (RV-wave2 finding 15: numbers come from the config).
  function periodWords() {
    var c = (PX.engine && PX.engine.config && PX.engine.config.bets) || {}, d = c.periodDays, n = c.periodSessions;
    var pl = function (k, one, many) { return k + ' ' + (k === 1 ? one : many); };
    return { time: d % 7 === 0 ? pl(d / 7, 'week', 'weeks') : pl(d, 'day', 'days'), sessions: pl(n, 'session', 'sessions') };
  }
  function trialsText() {
    var w = periodWords();
    return 'To test a bet rather than an exercise, Parallax switches its add-ons on and off at random within each player: for each add-on, about half of the exercises that have it get it in one period and the rest in the next, and a period lasts at least ' + w.time + ' and ' + w.sessions + '. Because each exercise gets each of its add-ons in one period of every two, pooled exports form randomised trials.';
  }
  PX.ui.hooks.on('about:sections', function () {
    var sec = h('section.px-about-section.px-bets-about', { 'data-section': 'bets' },
      h('h2', 'Test the bets with us'),
      h('p', 'No theory of transfer has won yet, so Parallax spreads its bets. Each exercise names the one mechanism it bets on, and your record logs how much of each you got, so the community’s pooled exports can test the bets against each other. One bet, calibration, is new: no study has tested its transfer yet.'),
      betList(false),
      h('p', trialsText() + ' “Join the bet trials” in Settings is on by default; switch it off and every add-on runs for every exercise.'),
      h('p', { 'data-bets': 'addons' }, addonsLine()),
      h('p', ui.button('The bets in the Lab', { kind: 'secondary', small: true, go: 'lab' })));
    return { el: sec, after: 'claims' };
  }, { id: 'bets.about', order: 30 });

  /* ---------- Settings: "Join the bet trials" ---------- */

  PX.ui.hooks.on('settings:sections', function (ctx) {
    var K = PX.ui.kit, s = (ctx && ctx.rec && ctx.rec.settings) || {};
    var p = K.panel({ title: 'Bet trials', className: 'px-settings-section' });
    p.el.setAttribute('data-section', 'bettrials');
    p.body.appendChild(K.toggle({
      key: 'betTrials', label: 'Join the bet trials', checked: s.betTrials !== false,
      hint: 'Switches each add-on on for about half of the exercises that have it and off for the rest, swapping every period of at least ' + periodWords().time + ' and ' + periodWords().sessions + ', so pooled exports can test the bets. Off: every add-on runs for every exercise. ' + addonsLine() + ' Nothing leaves this device unless you export it.',
      onChange: function (v) {
        var S = store(), rec = S.state;
        rec.settings.betTrials = !!v;
        try { B().join(rec, !!v, Date.now()); } catch (e) { if (window.console) console.error('PX.ui.bets: join', e); }
        S.save();
        PX.bus.emit('settings', { key: 'betTrials', value: !!v });
      },
    }));
    return { el: p.el, after: 'privacy' };
  }, { id: 'bets.settings', order: 30 });

  /* ---------- the Lab: the trials now, dose, exports ---------- */

  function csvCell(v) { var S = store(); return S && typeof S.csvCell === 'function' ? S.csvCell(v) : (v === null || v === undefined ? '' : String(v)); }
  // The events CSV (CONTRACT T): time_iso, t_sec, kind, exercise, then the kind's fields as one JSON cell.
  function eventsCSV(rec) {
    var rows = PX.engine.events.table(rec), lines = ['time_iso,t_sec,kind,exercise,data'];
    rows.forEach(function (e) {
      var d = new Date(e.t);
      lines.push([isFinite(d.getTime()) ? d.toISOString() : '', Math.floor(e.t / 1000), e.kind, e.exId || '', e.data ? JSON.stringify(e.data) : ''].map(csvCell).join(','));
    });
    return lines.join('\r\n') + '\r\n';
  }
  // The dose CSV: one row per exercise and week (weeks since the first trial), with its bet.
  function doseCSV(rec) {
    var d = B().dose(rec), lines = ['week,exercise,bet,trials,rated,minutes,sessions'];
    d.weeks.forEach(function (w) {
      Object.keys(w.ex).forEach(function (id) {
        var x = w.ex[id];
        lines.push([w.week, id, B().of(id) || '', x.trials, x.rated, x.minutes, x.sessions].map(csvCell).join(','));
      });
    });
    return lines.join('\r\n') + '\r\n';
  }
  function trialsNow(rec, now) {
    var b = B(), p = b.period(rec, now), rows = [];
    b.LAYERS.forEach(function (l) {
      var hostsL = b.hostsOf(l);
      if (!hostsL.length) return;
      var on = hostsL.filter(function (id) { return b.active(rec, id, l, now); }).map(shortOf);
      var off = hostsL.filter(function (id) { return !b.active(rec, id, l, now); }).map(shortOf);
      rows.push(h('li', { 'data-layer': l }, h('b', cap(LAYER_WORDS[l]) + ': '), on.length ? 'on for ' + andList(on) : 'off everywhere', off.length ? '; off for ' + andList(off) : ''));
    });
    var head = !b.joined(rec) ? 'You left the bet trials: every add-on runs for every exercise.' :
      !p.started ? 'Your first period starts with your next Train or Path session.' :
      'Period ' + p.n + ', since ' + U.fmtDate(p.from, 'long') + '. It ends once it has lasted ' + periodWords().time + ' (' + U.fmtDate(p.until, 'long') + ') and held ' + periodWords().sessions + '; then the halves swap.';
    return [h('p', head), rows.length ? h('ul.px-bets-arms', rows) : h('p.px-meta', 'No add-on is available in this version yet.')];
  }
  function doseBlock(rec) {
    var b = B(), d = b.dose(rec), L = d.layers;
    var items = b.IDS.filter(function (id) { return d.bets[id]; }).map(function (id) {
      return h('li', h('b', b.INFO[id].label + ': '), d.bets[id].trials + ' answers, ' + d.bets[id].minutes + ' min on items');
    });
    var lay = [
      L.compare.rounds ? L.compare.rounds + ' comparison round' + (L.compare.rounds === 1 ? '' : 's') + ' (' + L.compare.right + ' right picks, ' + L.compare.apply + ' apply items)' : null,
      L.bridge.sets ? L.bridge.sets + ' bridge set' + (L.bridge.sets === 1 ? '' : 's') : null,
      L.produce.items ? L.produce.items + ' draw-the-answer items' : null,
      L.calib.items ? L.calib.items + ' items with detailed feedback' : null,
      L.offscreen.did ? L.offscreen.did + ' off-screen challenge' + (L.offscreen.did === 1 ? '' : 's') + ' done' : null,
    ].filter(Boolean);
    return [
      items.length ? h('ul.px-bets-dose', items) : h('p.px-meta', 'No answers yet: the dose fills as you practise.'),
      lay.length ? h('p.px-meta', 'Add-ons so far: ' + lay.join('; ') + '.') : null,
    ];
  }
  PX.ui.hooks.on('lab:panels', function (ctx) {
    var K = PX.ui.kit, rec = ctx.rec, now = ctx.now;
    var p = K.panel({ title: 'Test the bets with us', className: 'px-lab-section px-bets-lab', aside: 'bets version ' + B().VERSION });
    p.el.setAttribute('data-section', 'bets');
    p.body.appendChild(h('p.px-lab-intro', 'Each exercise names the one mechanism it bets on. Your record logs how much of each bet you got, and which add-ons ran when, so pooled exports can test the bets against each other.'));
    p.body.appendChild(betList(true));
    p.body.appendChild(h('h3', 'Your bet trials'));
    p.body.appendChild(h('p.px-meta', trialsText() + ' ' + addonsLine()));
    trialsNow(rec, now).forEach(function (el) { p.body.appendChild(el); });
    var set = ui.button('Bet trials in Settings', { kind: 'ghost', small: true, go: 'settings?section=bettrials' });
    p.body.appendChild(h('p', set));
    p.body.appendChild(h('h3', 'Dose'));
    doseBlock(rec).forEach(function (el) { if (el) p.body.appendChild(el); });
    var ev = ui.button('Export events (CSV)', { kind: 'secondary', onClick: function () {
      PX.ui.app.exportDialog({ title: 'Events', intro: 'One row per event, in UTC: show-me plays, strategy cards, check-ins, comparison rounds, bridge sets, off-screen challenges, add-on assignments and expectation ratings, with each kind’s fields as one JSON cell. No text you typed is ever in it. Nothing is sent anywhere.',
        text: eventsCSV(store().state), filename: 'parallax-events-' + U.fmtDate(Date.now()) + '.csv', type: 'text/csv' });
    } });
    ev.setAttribute('data-action', 'bets-events');
    var ds = ui.button('Export dose (CSV)', { kind: 'secondary', onClick: function () {
      PX.ui.app.exportDialog({ title: 'Dose', intro: 'One row per exercise and week (weeks counted from your first trial): answers, rated answers, minutes on items and sessions, with the exercise’s bet. Nothing is sent anywhere.',
        text: doseCSV(store().state), filename: 'parallax-dose-' + U.fmtDate(Date.now()) + '.csv', type: 'text/csv' });
    } });
    ds.setAttribute('data-action', 'bets-dose');
    p.body.appendChild(h('div.px-data-row', ev, ds));
    p.body.appendChild(h('p.px-meta', 'The community export (above) carries the bets version, each exercise’s bet and format, the add-on of every trial, the events and this dose summary.'));
    return { el: p.el, after: 'crossover' };
  }, { id: 'bets.lab', order: 30 });

  /* ---------- the session summary: one expectation rating (a covariate; note T1 §5.3) ---------- */

  var SCALE = ['not at all', 'a little', 'somewhat', 'quite a lot', 'a lot'];
  PX.ui.hooks.on('summary:panels', function (ctx) {
    if (!ctx || ctx.restored || (ctx.mode !== 'train' && ctx.mode !== 'path') || !ctx.res || !ctx.res.session) return null;
    var b = B(), rec = ctx.rec, now = ctx.now, U2 = uiBets(rec);
    if (isNum(U2.expectAsked) && now - U2.expectAsked < DAY) return null; // at most one a day
    var bets = [];
    (ctx.res.session.exs || []).forEach(function (id) { var bt = b.of(id); if (bt && bets.indexOf(bt) < 0) bets.push(bt); });
    var skip = isObj(U2.expectSkip) ? U2.expectSkip : {};
    bets = bets.filter(function (bt) { return !(isNum(skip[bt]) && now - skip[bt] < 7 * DAY); });
    var due = b.expectDue(rec, bets, now);
    if (!due) return null;
    U2.expectAsked = now;
    var x = b.INFO[due.bet], K = PX.ui.kit;
    var p = K.panel({ title: due.when === 'w4' ? 'Four weeks on: your expectation' : 'Your expectation', className: 'pl-panel px-bets-expect' });
    p.el.setAttribute('data-bets', 'expect');
    p.body.appendChild(h('p', 'The bet of ' + exNames(due.bet) + ': ', h('i', x.line)));
    p.body.appendChild(h('p', 'How much do you expect this practice to help you on tasks you never practise here? There is no right answer: pooled data use it to tell real effects from expectations.'));
    var row = h('div.px-bets-scale', { role: 'group', 'aria-label': 'Your expectation, from 1 (not at all) to 5 (a lot)' });
    var done = h('p.px-meta', { role: 'status', 'aria-live': 'polite' });
    function finish(text) { Array.prototype.forEach.call(row.querySelectorAll('button'), function (bt) { bt.disabled = true; }); done.textContent = text; }
    SCALE.forEach(function (label, i) {
      var bt = ui.button(String(i + 1), { kind: 'secondary', small: true, title: label, onClick: function () {
        var S = store();
        b.expect(S.state, due.bet, i + 1, due.when, Date.now());
        S.save();
        finish('Saved: ' + (i + 1) + ' (' + label + '). Thank you.');
      } });
      bt.setAttribute('data-rating', String(i + 1));
      bt.setAttribute('aria-label', (i + 1) + ': ' + label);
      row.appendChild(bt);
    });
    var sk = ui.button('Skip', { kind: 'ghost', small: true, onClick: function () {
      var S = store(), u = uiBets(S.state);
      if (!isObj(u.expectSkip)) u.expectSkip = {};
      u.expectSkip[due.bet] = Date.now();
      S.save();
      finish('Skipped. It may come back in a week.');
    } });
    sk.setAttribute('data-rating', 'skip');
    row.appendChild(sk);
    p.body.appendChild(h('p.px-meta.px-bets-ends', '1: ' + SCALE[0] + ' · 5: ' + SCALE[4]));
    p.body.appendChild(row);
    p.body.appendChild(done);
    return { el: p.el, order: 70 };
  }, { id: 'bets.expect', order: 70 });

  /* ---------- off-screen challenges (note T1 §4.2): viewed and "I did it" (offscreen events) ---------- */

  function offscreenBlock(def, rec) {
    var c = B().content(def.id), o = c && c.offscreen, L = PX.ex.learn(def.id), own = !!o;
    if (!o && L && L.offscreen) o = { id: def.id + '-learn', title: L.offscreen.title };
    if (!o) return null;
    var st = rec.bets && isObj(rec.bets.off) && isObj(rec.bets.off[def.id]) ? rec.bets.off[def.id] : null;
    var count = h('span.px-meta.px-bets-did', st && st.did ? 'Done ' + st.did + (st.did === 1 ? ' time.' : ' times.') : '');
    var did = ui.button('I did it', { kind: 'secondary', small: true, onClick: function () {
      var S = store(), n = 0;
      B().offscreen(S.state, def.id, o.id, true, Date.now());
      n = S.state.bets.off[def.id].did;
      S.save();
      count.textContent = 'Noted. Done ' + n + (n === 1 ? ' time.' : ' times.');
    } });
    did.setAttribute('data-bets', 'offscreen-did');
    if (!own) return h('div.px-bets-off.px-bets-off--short', { 'data-offscreen': o.id }, h('p', 'Tried the off-screen challenge below (' + o.title + ')? '), h('p.px-bets-off-row', did, count));
    var d = h('details.px-bets-off', { 'data-offscreen': o.id },
      h('summary', 'Off-screen challenge: ' + o.title),
      h('p', o.text),
      o.steps && o.steps.length ? h('ol.px-off-steps', o.steps.map(function (x) { return h('li', x); })) : null,
      o.note ? h('p.px-meta', o.note) : null,
      h('p.px-bets-off-row', did, count));
    var seen = false;
    d.addEventListener('toggle', function () {
      if (!d.open || seen) return;
      seen = true;
      var S = store();
      B().offscreen(S.state, def.id, o.id, false, Date.now());
      S.save();
    });
    return d;
  }
  PX.ui.hooks.on('exercise:lines', function (ctx) {
    if (!ctx || !ctx.def || ctx.where !== 'page') return null;
    var el = offscreenBlock(ctx.def, ctx.rec);
    return el ? { el: el, order: 60 } : null;
  }, { id: 'bets.offscreen', order: 60 });

  /* ---------- comparison rounds between items (note T1 §4.1; CONTRACT R item:before) ---------- */

  function views() { return PX.ui.betsViews || {}; }
  var NO_LAYER = { recheck: 1, probe: 1, daily: 1, threshold: 1, fluency: 1, timed: 1, climb: 1 };
  function statementText(c, id) { var x = c.compare.statements.filter(function (s) { return s.id === id; })[0]; return x ? x.text : id; }

  // Shows the round in the player's card; resolves { chosen, rt } or null when the session ends under it.
  function showRound(ctx, def, r, c, hasApply) {
    var V = views()[def.id], hA = h('div.px-bets-figbox'), hB = h('div.px-bets-figbox'), marks = [];
    var opts = h('div.px-bets-opts', { role: 'group', 'aria-label': 'What is the same in both?' });
    var after = h('div.px-bets-after', { hidden: true });
    var el = h('div.px-bets-round', { 'data-principle': r.principle },
      h('p.px-bets-q', 'Two solved ' + (def.short || def.name) + ' items. What is the same in both?'),
      h('div.px-bets-pair', h('figure.px-bets-item', hA, h('figcaption', 'First')), h('figure.px-bets-item', hB, h('figcaption', 'Second'))),
      opts, after);
    var chosen = null, t0 = 0, popK = null;
    return ctx.card({ id: 'bets-compare', title: 'Same rule?', def: def, lines: [el], actions: [], className: 'px-bets-card',
      onShow: function (panel, done) {
        try {
          marks.push(V.solved(hA, r.a.item, { principle: r.principle }));
          marks.push(V.solved(hB, r.b.item, { principle: r.principle }));
        } catch (e) { report('draw', e); }
        t0 = Date.now();
        var btns = r.opts.map(function (id, i) {
          var b = ui.button(h('span', h('span.px-bets-key', String(i + 1)), h('span', statementText(c, id))), { kind: 'secondary', className: 'px-bets-opt', onClick: function () { pick(i); } });
          b.setAttribute('data-opt', String(i));
          opts.appendChild(b);
          return b;
        });
        var next = ui.button('Next item', { kind: 'primary', onClick: function () { finish(); } });
        next.setAttribute('data-bets', 'round-next');
        function pick(i) {
          if (chosen !== null) return;
          chosen = { i: i, rt: Date.now() - t0 };
          btns.forEach(function (b, j) {
            b.disabled = true;
            b.classList.add(j === r.correct ? 'is-right' : j === i ? 'is-wrong' : 'is-dim');
            if (j === r.correct || j === i) b.appendChild(h('span.px-bets-tick', { 'aria-hidden': 'true' }, j === r.correct ? ' ✓' : ' ✗'));
          });
          marks.forEach(function (m) { try { if (m && m.mark) m.mark(true); } catch (e) { report('mark', e); } });
          after.hidden = false;
          after.appendChild(h('p.px-bets-verdict', { role: 'status' }, i === r.correct ? 'Yes: that holds in both.' : 'Not this one: the highlighted rule holds in both.'));
          after.appendChild(h('p.px-bets-principle', h('b', 'The rule: '), r.text));
          if (hasApply) after.appendChild(h('p.px-meta', 'The next item is one where it decides the answer.')); // only when there is one (RV-wave2 finding 10)
          after.appendChild(h('div.px-bets-next', next));
          try { next.focus({ preventScroll: true }); } catch (e) { /* ignore */ }
        }
        function finish() { if (popK) { popK(); popK = null; } done('next'); }
        var map = { Enter: function () { if (chosen !== null) { finish(); return; } return false; } };
        r.opts.forEach(function (x, i) { map[String(i + 1)] = function () { pick(i); }; });
        popK = PX.core.keys.push(map, { through: true });
      },
    }).then(function (v) {
      if (popK) { popK(); popK = null; }
      return v === 'closed' || chosen === null ? null : chosen;
    });
  }
  function report(where, e) {
    try { if (window.console) console.error('PX.ui.bets: ' + where, e); } catch (x) { /* none */ }
    try { PX.bus.emit('play:error', { where: 'bets:' + where, message: String(e && e.message || e) }); } catch (x) { /* none */ }
  }
  function runRound(ctx, d) {
    var b = B(), def = ctx.def, step = ctx.step, c = b.content(def.id);
    if (!c || !views()[def.id]) return Promise.resolve(null);
    var r = null;
    try { r = b.round(def.id, d.principle, step.params, step.seed, d.stage); } catch (e) { report('round', e); }
    if (!r) return Promise.resolve(null);
    // the apply item first, so the round promises one only when there is one
    var S = store(), aSeed = null;
    try { aSeed = b.applySeed(S.state, def.id, d.principle, step.params, step.seed); } catch (e) { report('apply', e); }
    return showRound(ctx, def, r, c, aSeed !== null).then(function (got) {
      if (!got) return null;
      var rec = S.state, now = Date.now(), key = def.id + '@' + (def.version || 1);
      if (aSeed !== null) { step.seed = aSeed; step.layer = b.ROW_LAYER.compare; step.betPrinciple = d.principle; }
      b.compared(rec, ctx.plan, { exId: def.id, principle: d.principle, stage: r.stage, a: key, aSeed: r.a.seed, b: key, bSeed: r.b.seed,
        choice: r.opts[got.i], correct: got.i === r.correct, rt: got.rt, apply: aSeed === null ? 0 : aSeed, opts: r.opts, pos: r.correct }, now);
      S.save();
      return null;
    });
  }

  /* ---------- bridge sets between items (note T1 §4.2; CONTRACT R item:before, O 'bridge') ----------
     One card, four steps: the bridge pair (a real setting beside its idealised twin) with the mapping
     question and its line; two items in the real setting (solver-checked; outcomes only in the bridge
     event, never rows); "Where else would this help?" with an optional "somewhere else" box whose text
     never leaves this screen (only that one was typed is logged). */
  function runBridge(ctx, d) {
    var b = B(), def = ctx.def, c = b.content(def.id), set = c && c.bridge && c.bridge.sets ? c.bridge.sets[d.set] : null, V = views()[def.id];
    if (!set || !V || !V.town) return Promise.resolve(null);
    var seed0 = ctx.step && isNum(ctx.step.seed) ? ctx.step.seed : Date.now() >>> 0, items = [];
    for (var k = 0; k < 6 && items.length < 3; k++) {
      var it = null;
      try { it = set.item(PX.rng.hash('bets-bridge', seed0, k) >>> 0); } catch (e) { report('bridge item', e); }
      if (it && set.validate(it) === true) items.push(it);
    }
    if (items.length < 3) return Promise.resolve(null);
    var pair = items[0], out = { map: null, mapOk: false, items: [], use: null, other: false }, t0 = Date.now();
    var body = h('div.px-bets-bridge', { 'data-set': set.id }), popK = null;
    return ctx.card({ id: 'bets-bridge', title: 'Same problem, real setting: ' + set.title, def: def, lines: [body], actions: [], className: 'px-bets-card',
      onShow: function (panel, done) {
        function clear() { while (body.firstChild) body.removeChild(body.firstChild); }
        function keysFor(map) { if (popK) popK(); popK = PX.core.keys.push(map, { through: true }); }
        function nextBtn(label, fn) { var n = ui.button(label, { kind: 'primary', onClick: fn }); n.setAttribute('data-bets', 'bridge-next'); return h('div.px-bets-next', n); }
        function choices(list, onPick) {
          var row = h('div.px-bets-opts', { role: 'group' }), picked = false;
          var btns = list.map(function (o, i) {
            var bt = ui.button(h('span', h('span.px-bets-key', String(i + 1)), h('span', o.text)), { kind: 'secondary', className: 'px-bets-opt', onClick: function () { pick(i); } });
            bt.setAttribute('data-opt', String(i));
            row.appendChild(bt);
            return bt;
          });
          function pick(i) { if (picked) return; picked = true; onPick(i, btns); }
          var map = {};
          list.forEach(function (o, i) { map[String(i + 1)] = function () { pick(i); }; });
          keysFor(map);
          return row;
        }
        // 1. the pair and the mapping question
        function step1() {
          clear();
          var hT = h('div.px-bets-figbox'), hB = h('div.px-bets-figbox'), meet = pair.spots[pair.key];
          body.appendChild(h('p.px-bets-q', set.pairText));
          body.appendChild(h('div.px-bets-pair', h('figure.px-bets-item', hT, h('figcaption', 'Real setting')), h('figure.px-bets-item', hB, h('figcaption', 'Central Point'))));
          try { V.town(hT, pair.homes, null, { meet: meet }); V.board(hB, pair.homes, meet); } catch (e) { report('bridge draw', e); }
          body.appendChild(h('p.px-bets-q', set.map.q));
          var after = h('div.px-bets-after', { hidden: true });
          body.appendChild(choices(set.map.options, function (i, btns) {
            out.map = set.map.options[i].id; out.mapOk = !!set.map.options[i].right;
            btns.forEach(function (bt, j) { bt.disabled = true; bt.classList.add(set.map.options[j].right ? 'is-right' : j === i ? 'is-wrong' : 'is-dim'); });
            after.hidden = false;
            after.appendChild(h('p.px-bets-principle', set.map.line));
            after.appendChild(nextBtn('Try it', function () { step2(1); }));
            keysFor({ Enter: function () { step2(1); } });
          }));
          body.appendChild(after);
        }
        // 2–3. two items in the real setting
        function step2(n) {
          clear();
          var it = items[n], hT = h('div.px-bets-figbox.px-bets-big'), shownAt = Date.now();
          body.appendChild(h('p.px-bets-q', 'Item ' + n + ' of 2. ' + set.q));
          body.appendChild(h('figure.px-bets-item.px-bets-solo', hT));
          var mk = null;
          try { mk = V.town(hT, it.homes, it.spots); } catch (e) { report('bridge draw', e); }
          var after = h('div.px-bets-after', { hidden: true });
          body.appendChild(choices(it.spots.map(function (p, i) { return { text: 'Spot ' + String.fromCharCode(65 + i) }; }), function (i, btns) {
            var ok = i === it.key, rt = Date.now() - shownAt;
            out.items.push([it.seed >>> 0, 0, ok ? 1 : 0, rt]);
            btns.forEach(function (bt, j) { bt.disabled = true; bt.classList.add(j === it.key ? 'is-right' : j === i ? 'is-wrong' : 'is-dim'); });
            if (mk) mk.mark(it.key);
            var tot = it.spots.map(function (p) { return set.total(it.homes, p[0], p[1]) / 2; });
            after.hidden = false;
            after.appendChild(h('p.px-bets-verdict', { role: 'status' }, ok ? 'Yes: spot ' + String.fromCharCode(65 + it.key) + '.' : 'Spot ' + String.fromCharCode(65 + it.key) + ' is best.'));
            after.appendChild(h('p.px-meta', 'Walks in total, in dots: ' + tot.map(function (v, j) { return String.fromCharCode(65 + j) + ' ' + v.toFixed(1); }).join(' · ') + '.'));
            var go = n === 1 ? function () { step2(2); } : step3;
            after.appendChild(nextBtn(n === 1 ? 'Next item' : 'Last question', go));
            keysFor({ Enter: go });
          }));
          body.appendChild(after);
        }
        // 4. where else
        function step3() {
          clear();
          body.appendChild(h('p.px-bets-q', 'Where else would this help you?'));
          var box = h('div.px-bets-other', { hidden: true });
          var inp = h('input.px-input', { type: 'text', maxlength: '60', autocomplete: 'off', 'aria-label': 'Where else (stays on this screen, never saved)' });
          box.appendChild(h('label.px-meta', 'Where? (optional; stays on this screen, never saved) ', inp));
          var after = h('div.px-bets-after', { hidden: true });
          body.appendChild(choices(set.uses, function (i, btns) {
            out.use = set.uses[i].id;
            // no right answer here: the pick is marked as chosen, neutrally (RV-wave2 finding 21 b)
            btns.forEach(function (bt, j) {
              bt.disabled = true;
              if (j === i) { bt.classList.add('is-chosen'); bt.setAttribute('aria-pressed', 'true'); bt.appendChild(h('span.px-bets-tick', { 'aria-hidden': 'true' }, ' ●')); } else bt.classList.add('is-dim');
            });
            if (set.uses[i].id === 'other') { box.hidden = false; try { inp.focus({ preventScroll: true }); } catch (e) { /* ignore */ } }
            after.hidden = false;
            after.appendChild(nextBtn('Back to training', finish));
            keysFor({ Enter: function () { if (document.activeElement === inp) return false; finish(); } });
          }));
          body.appendChild(box);
          body.appendChild(after);
          function finish() { out.other = !!String(inp.value || '').trim(); inp.value = ''; if (popK) { popK(); popK = null; } done('next'); }
        }
        step1();
      },
    }).then(function (v) {
      if (popK) { popK(); popK = null; }
      if (v === 'closed' || !out.items.length) return null;
      var S = store();
      b.bridged(S.state, ctx.plan, { exId: def.id, set: set.id, map: out.map || 'none', mapOk: out.mapOk, items: out.items, use: out.use || 'none', other: out.other, rt: Date.now() - t0 }, Date.now());
      S.save();
      return null;
    });
  }

  PX.ui.hooks.on('item:before', function (ctx) {
    if (!ctx || (ctx.mode !== 'train' && ctx.mode !== 'path')) return null;
    var step = ctx.step, def = ctx.def;
    if (!step || !def || step.recheck || NO_LAYER[step.kind] || step.layer === 'produce') return null;
    var d = null;
    try { d = B().due(ctx.rec, ctx.plan, def.id, ctx.now, { newRun: !!step.newRun, misses: ctx.misses || 0, params: step.params }); } catch (e) { report('due', e); }
    if (!d) return null;
    if (d.kind === 'compare') return runRound(ctx, d);
    if (d.kind === 'bridge') return runBridge(ctx, d);
    return null;
  }, { id: 'bets.layers', order: 30 });

  // After the apply item: the rule it used, once (CONTRACT R item:notes).
  PX.ui.hooks.on('item:notes', function (ctx) {
    var step = ctx && ctx.step;
    if (!step || step.layer !== 'compare-apply' || typeof step.betPrinciple !== 'string') return null;
    var c = B().content(ctx.def.id), p = c && c.compare ? c.compare.principles.filter(function (x) { return x.id === step.betPrinciple; })[0] : null;
    return p ? h('p.px-bets-applynote', { 'data-bets': 'apply-note' }, h('b', 'Same rule as the pair: '), p.text) : null;
  }, { id: 'bets.apply-note', order: 30 });

  /* ---------- detailed calibration feedback (the calib layer; note T1 §2.3 M9, §5.3) ----------
     Every answer of a calib host records its signed value (both arms, so the note has data when its arm
     turns on); on calib-detail items, after every 5th answer, a note gives the running bias over the last
     10 and the habit it shows. Homing: the pointing error (clockwise +); Central Point: the share of the
     way from the targets' average position to the best spot (value2; never drawn). Reckon's own bias
     line plays this part in its view. */
  function signedDeg(x) { return Math.abs(Math.round(x)) + '°'; }
  var CALIB = {
    homing: {
      value: function (tr) { return tr && tr.result && tr.result.detail && isNum(tr.result.detail.signed) ? tr.result.detail.signed : null; },
      note: function (s) {
        var lean = Math.abs(s.mean) >= 5 && Math.abs(s.mean) > 2 * s.sd / Math.sqrt(s.n);
        return [
          'Over your last ' + s.n + ' answers you pointed on average ' + signedDeg(s.mean) + (s.mean >= 0 ? ' to the right of' : ' to the left of') + ' home; a typical miss was ' + signedDeg(s.abs) + '.',
          lean ? 'That steady lean is a habit you can correct: aim about ' + signedDeg(s.mean) + ' further ' + (s.mean >= 0 ? 'left' : 'right') + ' than feels right.' : 'No steady lean: your misses fall on both sides.',
        ];
      },
    },
    centralpoint: {
      value: function (tr) { return tr && tr.result && isNum(tr.result.value2) ? tr.result.value2 : null; },
      note: function (s) {
        var pct = Math.round(s.mean * 100);
        return [
          'Over your last ' + s.n + ' answers your marker went on average ' + pct + ' % of the way from the targets’ average position to the best spot.',
          pct < 85 ? 'Far targets still pull your pick: a far target pulls no harder than a near one.' : pct > 115 ? 'You went past the best spot: the close group pulls no harder than the rest.' : 'Your picks reach the best spot’s side.',
        ];
      },
    },
  };
  PX.ui.hooks.on('item:notes', function (ctx) {
    var def = ctx && ctx.def, step = ctx && ctx.step, k = def ? CALIB[def.id] : null;
    if (!k || !step || !ctx.tr || ctx.tr.outcome === 'stutter' || (ctx.mode !== 'train' && ctx.mode !== 'path') || !B().hosts(def, 'calib')) return null;
    // a voided or skipped answer (a fallback item, a stutter: out.outcome 2; skipped: 3) never counts (rule 7; RV-wave2 finding 12)
    if ((ctx.item && ctx.item.fallback === true) || (ctx.out && (ctx.out.outcome === 2 || ctx.out.outcome === 3))) return null;
    var v = k.value(ctx.tr);
    if (!isNum(v)) return null;
    var S = store();
    B().calibPush(S.state, def.id, v, Date.now());
    var n = S.state.bets.cal[def.id].length;
    if (step.layer !== 'calib-detail' || n < 5 || n % 5 !== 0) return null;
    return function () {
      var s = B().calibSummary(store().state, def.id, 10);
      if (!s.n) return null;
      var lines = k.note(s);
      return h('div.px-bets-calib', { 'data-bets': 'calib-note' }, h('p', h('b', 'Detail: '), lines[0]), h('p', lines[1]));
    };
  }, { id: 'bets.calib', order: 40 });

  PX.ui.bets = { addonsLine: addonsLine, betLine: betLine, eventsCSV: eventsCSV, doseCSV: doseCSV, LAYER_WORDS: LAYER_WORDS, exNames: exNames, uiBets: uiBets, showRound: showRound, runRound: runRound, report: report, runBridge: runBridge };
})(window.PX);
