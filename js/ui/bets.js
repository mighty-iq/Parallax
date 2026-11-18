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
    var head = h('p.px-bet-head', h('span.px-tag.px-bet-tag', 'The bet · ' + x.label), x.isNew ? h('span.px-tag.px-bet-new', 'new, untested') : null);
    var kids = [head, h('p.px-bet-text', x.line)];
    if (where === 'page') {
      var layers = b.LAYERS.filter(function (l) { return b.hosts(def, l); }).map(function (l) { return LAYER_WORDS[l]; });
      var extra = [];
      if (layers.length) extra.push(cap(andList(layers)) + ' come with this exercise in some periods and not in others, at random, so the community can test the bet.');
      if (def.layers && def.layers.produce && bet === 'produce') extra.push('Its own bet is producing the answer, so its draw-the-answer items come in about half of the periods.');
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
  var TRIALS_TEXT = 'To test a bet rather than an exercise, Parallax switches its add-ons on and off at random within each player: for each add-on, half of the exercises that have it get it in one period and the other half in the next, and a period lasts at least 4 weeks and 8 sessions. Because everyone gets every add-on half the time, pooled exports form randomised trials.';
  PX.ui.hooks.on('about:sections', function () {
    var sec = h('section.px-about-section.px-bets-about', { 'data-section': 'bets' },
      h('h2', 'Test the bets with us'),
      h('p', 'No theory of transfer has won yet, so Parallax spreads its bets. Each exercise names the one mechanism it bets on, and your record logs how much of each you got, so the community’s pooled exports can test the bets against each other. One bet, calibration, is new: no study has tested it.'),
      betList(false),
      h('p', TRIALS_TEXT + ' “Join the bet trials” in Settings is on by default; switch it off and every add-on runs for every exercise.'),
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
      hint: 'Switches each add-on (comparison rounds, bridge sets, draw-the-answer items, detailed feedback) on for half of the exercises that have it and off for the other half, swapping every period of at least 4 weeks and 8 sessions, so pooled exports can test the bets. Off: every add-on runs for every exercise. Nothing leaves this device unless you export it.',
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
      'Period ' + p.n + ', since ' + U.fmtDate(p.from, 'long') + '. It ends once it has lasted 4 weeks (' + U.fmtDate(p.until, 'long') + ') and held 8 sessions; then the halves swap.';
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
    p.body.appendChild(h('p.px-meta', TRIALS_TEXT));
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

  PX.ui.bets = { betLine: betLine, eventsCSV: eventsCSV, doseCSV: doseCSV, LAYER_WORDS: LAYER_WORDS, exNames: exNames, uiBets: uiBets };
})(window.PX);
