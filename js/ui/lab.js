/* PX.ui.screens.lab: the Lab (PHASE-3 "Builder B" 4; PLAN §5, §6; ENGINE.md §7, §11, §16).
   Threshold protocols (Track Standard 3D-MOT, Track at your target, Span length, Spin deadline)
   with their rules and history (rec.mot); the self-experiment crossover (PX.engine.lab: random
   order, check schedule, per-phase probe changes); the research export (trials with predicted
   P, stage and item-model version, plus each item's difficulty b and guessing rate g); and
   "How the engine works", a condensed reading of docs/dev/ENGINE.md. */
(function (PX) {
  'use strict';

  var ui = PX.ui;
  var h = ui.h;
  var U = PX.util;
  var DAY = 86400000;
  var MINUS = '−';

  function E() { return PX.engine; }
  function X() { return PX.ui.exinfo; }
  function isNum(x) { return typeof x === 'number' && isFinite(x); }
  function signed(x) { return !isNum(x) ? '–' : (x > 0 ? '+' : x < 0 ? MINUS : '') + Math.abs(U.round(x, 2)).toFixed(2); }

  var RULES = {
    'track-standard': [
      '8 spheres, 4 of them targets, a 2-second cue, 8 seconds of tracking, a still camera.',
      'One-up/one-down: faster after a fully right trial, slower after any miss, in steps of 0.05 log10. 20 trials.',
      'Threshold: the geometric mean of the speeds at the last 4 reversals, the speed you track fully right about half the time.',
      'Staircase after Legault, Allard and Faubert (2013); 8 spheres, 4 targets and 8 s of tracking as in Faubert (2013). Speeds are in Parallax’s own unit (box widths per second), so they are not comparable with other trainers.',
    ],
    'track': [
      'The same display as Track Standard, with a weighted up-down staircase (Kaernbach 1991): 20 trials.',
      'It settles at the speed where you track fully right at your own target success rate.',
      'A first run starts where your Track level predicts that success; later runs start a little easier than your last threshold.',
    ],
    'span-length': [
      'The length of the sequence moves on a two-down/one-up staircase, after a fast start that adds one block per right answer until the first miss. 20 trials.',
      'It settles near the length you recall right about 71 % of the time (Levitt 1971).',
    ],
    'spin-deadline': [
      'Spin items you already answer well untimed, with a response deadline on a weighted staircase. 30 trials, one format per run.',
      'It settles at the deadline where you are right at your target success; a late answer counts as a miss.',
    ],
  };
  var UNIT = { speed: 'cw/s', items: 'blocks', ms: 'ms' };

  function fmtValue(v, unit) {
    if (!isNum(v)) return '–';
    if (unit === 'ms') return Math.round(v) + ' ms';
    if (unit === 'items') return U.round(v, 1) + ' blocks';
    return U.round(v, 2) + ' ' + (UNIT[unit] || unit || '');
  }

  /* ---------- small charts ---------- */

  // The thresholds of every run, oldest to newest.
  function runsChart(list, unit) {
    var S = PX.core.svg, W = 240, H = 104, L = 34, R = 232, T = 8, B = 80;
    var vals = list.map(function (e) { return e.threshold; }).filter(isNum);
    if (vals.length < 2) return null;
    var lo = Math.min.apply(null, vals), hi = Math.max.apply(null, vals), pad = (hi - lo) * 0.15 || Math.abs(hi) * 0.1 || 1;
    lo -= pad; hi += pad;
    function x(i) { return L + i / (list.length - 1) * (R - L); }
    function y(v) { return B - (v - lo) / (hi - lo) * (B - T); }
    var root = S.svg(W, H, { class: 'px-lab-svg' });
    [lo + pad, hi - pad].forEach(function (v) {
      root.appendChild(S.el('line', { class: 'px-curve-grid', x1: L, x2: R, y1: y(v), y2: y(v) }));
      root.appendChild(S.text(L - 6, y(v), String(U.round(v, unit === 'ms' ? 0 : 2)), { class: 'px-curve-lab', 'text-anchor': 'end' }));
    });
    root.appendChild(S.path(list.map(function (e, i) { return [x(i), y(e.threshold)]; }), false, { class: 'px-curve-line' }));
    list.forEach(function (e, i) { root.appendChild(S.el('rect', { class: 'px-curve-pt', x: x(i) - 3, y: y(e.threshold) - 3, width: 6, height: 6 })); });
    root.appendChild(S.text(L, H - 8, U.fmtDate(list[0].date, 'short'), { class: 'px-curve-lab', 'text-anchor': 'start' }));
    root.appendChild(S.text(R, H - 8, U.fmtDate(list[list.length - 1].date, 'short'), { class: 'px-curve-lab', 'text-anchor': 'end' }));
    root.removeAttribute('aria-hidden');
    root.setAttribute('role', 'img');
    root.setAttribute('aria-label', 'Thresholds of ' + list.length + ' runs, from ' + fmtValue(list[0].threshold, unit) + ' to ' + fmtValue(list[list.length - 1].threshold, unit) + '.');
    return root;
  }

  // One run's staircase: the value of each trial, filled for right, hollow for wrong.
  function stairChart(e) {
    var hist = Array.isArray(e.hist) ? e.hist.filter(function (x) { return Array.isArray(x) && isNum(x[0]); }) : [];
    if (hist.length < 2) return null;
    var S = PX.core.svg, W = 240, H = 104, L = 34, R = 232, T = 8, B = 80;
    var vals = hist.map(function (x) { return x[0]; });
    var lo = Math.min.apply(null, vals), hi = Math.max.apply(null, vals), pad = (hi - lo) * 0.12 || Math.abs(hi) * 0.1 || 1;
    lo -= pad; hi += pad;
    function x(i) { return L + i / (hist.length - 1) * (R - L); }
    function y(v) { return B - (v - lo) / (hi - lo) * (B - T); }
    var root = S.svg(W, H, { class: 'px-lab-svg' });
    if (isNum(e.threshold)) root.appendChild(S.el('line', { class: 'px-lab-thr', x1: L, x2: R, y1: y(e.threshold), y2: y(e.threshold) }));
    var pts = [];
    hist.forEach(function (v, i) { if (i) pts.push([x(i), y(hist[i - 1][0])]); pts.push([x(i), y(v[0])]); });
    root.appendChild(S.path(pts, false, { class: 'px-lab-stair' }));
    hist.forEach(function (v, i) { root.appendChild(S.el('circle', { class: v[1] ? 'px-lab-ok' : 'px-lab-miss', cx: x(i), cy: y(v[0]), r: 3.2 })); });
    root.appendChild(S.text(L - 6, y(hi - pad), String(U.round(hi - pad, e.unit === 'ms' ? 0 : 2)), { class: 'px-curve-lab', 'text-anchor': 'end' }));
    root.appendChild(S.text(L - 6, y(lo + pad), String(U.round(lo + pad, e.unit === 'ms' ? 0 : 2)), { class: 'px-curve-lab', 'text-anchor': 'end' }));
    root.appendChild(S.text(L, H - 8, 'trial 1', { class: 'px-curve-lab', 'text-anchor': 'start' }));
    root.appendChild(S.text(R, H - 8, 'trial ' + hist.length, { class: 'px-curve-lab', 'text-anchor': 'end' }));
    root.removeAttribute('aria-hidden');
    root.setAttribute('role', 'img');
    root.setAttribute('aria-label', 'Staircase of the last run: ' + hist.length + ' trials, ' + hist.filter(function (v) { return v[1]; }).length + ' right; threshold ' + fmtValue(e.threshold, e.unit) + '.');
    return root;
  }

  /* ---------- protocols ---------- */

  function protocolCard(rec, id) {
    var P = E().threshold.PROTOCOLS[id], pr = E().threshold.protocol(id), def = PX.ex.get(P.ex);
    var why = pr.unavailable || (def ? X().unavailable(def) : 'not in this version');
    var list = rec.mot && Array.isArray(rec.mot[id]) ? rec.mot[id].filter(function (e) { return e && isNum(e.threshold); }) : [];
    var last = list[list.length - 1];
    var run = ui.button(list.length ? 'Run again' : 'Run the protocol', { kind: list.length ? 'secondary' : 'primary', onClick: function () {
      if (pr.unavailable) { ui.toast(pr.unavailable, { kind: 'info' }); return; }
      X().start(def, { mode: 'threshold', protocol: id, exId: P.ex });
    } });
    run.setAttribute('data-protocol', id);
    var kids = [
      h('div.px-lab-proto-head', PX.ui.kit.spec([def ? def.code : '', def ? def.short : P.ex, id]), why ? h('span.px-tag', why === 'coming soon' ? 'coming soon' : 'not available here') : null),
      h('h3', X().PROTOCOL_NAMES[id] || id),
      h('ul.px-lab-rules', (RULES[id] || [P.label]).map(function (t) { return h('li', t); })),
    ];
    if (last) {
      var hist = h('table.px-table.px-table--stack.px-lab-runs',
        h('caption.px-sr', 'Runs of this protocol, newest first'),
        h('thead', h('tr', ['Date', 'Threshold', 'Trials', 'Reversals', 'Screen'].map(function (c) { return h('th', { scope: 'col' }, c); }))),
        h('tbody', list.slice(-8).reverse().map(function (e) {
          return h('tr',
            h('td.px-num', { 'data-label': 'Date' }, U.fmtDate(e.date, 'long')),
            h('td.px-num', { 'data-label': 'Threshold' }, fmtValue(e.threshold, e.unit), e.atBound ? h('span.px-meta', ' at the limit') : null, e.ok === false ? h('span.px-meta', ' (few reversals)') : null),
            h('td.px-num', { 'data-label': 'Trials' }, String(e.n)),
            h('td.px-num', { 'data-label': 'Reversals' }, String(e.reversals)),
            h('td', { 'data-label': 'Screen' }, e.display === 'small' ? 'small' : 'larger'));
        })));
      kids.push(h('p.px-lab-last', 'Last threshold: ', h('b.px-num', fmtValue(last.threshold, last.unit)), h('span.px-meta', ' on ' + U.fmtDate(last.date, 'long') + (list.length > 1 ? ', ' + list.length + ' runs in all' : ''))));
      var charts = h('div.px-lab-charts');
      var a = runsChart(list, last.unit), b = stairChart(last);
      if (a) charts.appendChild(h('figure.px-lab-fig', h('figcaption', 'Threshold by run'), a));
      if (b) charts.appendChild(h('figure.px-lab-fig', h('figcaption', 'Last run, trial by trial'), b, h('p.px-meta', 'Filled: right. Open: missed. Line: the threshold.')));
      if (charts.firstChild) kids.push(charts);
      kids.push(h('div.px-table-wrap', hist));
    } else kids.push(h('p.px-meta', 'No runs yet. A run takes ' + (P.trials || 20) + ' trials and never changes a level.'));
    kids.push(h('div.px-data-row', run));
    return h('article.px-lab-proto', { 'data-protocol-card': id }, kids);
  }

  function protocolsSection(rec) {
    var p = PX.ui.kit.panel({ title: 'Threshold protocols', aside: 'one setting on a staircase', className: 'px-lab-section' });
    p.el.setAttribute('data-section', 'protocols');
    p.body.appendChild(h('p.px-lab-intro', 'A threshold run moves one setting up after right answers and down after misses, with everything else fixed, until it hovers around one success rate. The result is a number in the task’s own unit, kept with every trial’s value. Runs never change your levels.'));
    p.body.appendChild(h('div.px-lab-protos', Object.keys(E().threshold.PROTOCOLS).map(function (id) { return protocolCard(rec, id); })));
    return p.el;
  }

  /* ---------- self-experiment crossover ---------- */

  function clusterNames(name) {
    var ids = (E().config.lab && E().config.lab[name]) || [];
    return ids.map(function (id) { var d = PX.ex.get(id); return d ? d.short : id; }).join(', ');
  }

  function crossoverSection(rec, now) {
    var p = PX.ui.kit.panel({ title: 'Self-experiment: two groups, crossed over', aside: '6 weeks', className: 'px-lab-section' });
    p.el.setAttribute('data-section', 'crossover');
    var b = p.body, ph = E().lab.phase(rec, now), weeks = (E().config.lab && E().config.lab.weeks) || 3;
    b.appendChild(h('p.px-lab-intro', 'Does training one group of exercises move the Spatial Check probes more than training the other? You train group A for ' + weeks + ' weeks and group B for ' + weeks + ', in an order drawn at random when you join. During each phase, Train sessions use only that group.'));
    b.appendChild(h('dl.px-facts',
      h('div', h('dt', 'Group A'), h('dd', clusterNames('A'))),
      h('div', h('dt', 'Group B'), h('dd', clusterNames('B'))),
      h('div', h('dt', 'Checks'), h('dd', 'two at the start, one at week ' + weeks + ', one at week ' + 2 * weeks)),
      h('div', h('dt', 'Analysis, fixed in advance'), h('dd', 'per probe: the change while training A minus the change while training B, with its standard error'))));
    var L = rec.lab || {};
    if (!ph.enrolled) {
      b.appendChild(h('p.px-meta', ph.left ? 'You left the self-experiment. Its data stays in your record and in exports.' : 'One person’s result is noisy, so expect “unclear”. Pooled exports from many people can answer the question for the community.'));
      var join = ui.button(ph.left ? 'Start a new self-experiment' : 'Join the self-experiment', { kind: 'secondary', onClick: function () {
        ui.confirm('For the next ' + 2 * weeks + ' weeks, Train sessions use one group of exercises at a time, in an order drawn at random now. You can leave at any time; your record keeps everything.', {
          title: 'Join the self-experiment?', ok: 'Join and draw the order', cancel: 'Not now',
        }).then(function (yes) {
          if (!yes) return;
          E().lab.enroll(PX.core.store.state, Date.now());
          PX.core.store.save();
          PX.ui.app.rerender();
          ui.toast('You are in. The order was drawn at random: group ' + PX.core.store.state.lab.order.split('').join(', then group ') + '.', { kind: 'ok' });
        });
      } });
      join.setAttribute('data-action', 'lab-join');
      b.appendChild(h('div.px-data-row', join));
      return p.el;
    }
    var start = L.start, W = weeks * 7 * DAY, order = ph.order.split('');
    var phaseText = ph.phase === 'done' ? 'Both phases are over.' : 'Phase ' + ph.phase + ' of 2: group ' + ph.clusterName + ' (' + clusterNames(ph.clusterName) + '), week ' + (Math.floor(ph.weeks) + 1) + ' of ' + 2 * weeks + '.';
    b.appendChild(h('p.px-lab-now', h('b', phaseText), ' Order: group ' + order[0] + ', then group ' + order[1] + '. Joined ' + U.fmtDate(start, 'long') + '.'));
    function step(label, at, done) {
      return h('li', { class: done ? 'is-done' : null }, h('span.px-lab-step-mark', { 'aria-hidden': 'true' }, done ? '✓' : ''),
        h('span', h('b', label), h('span.px-meta', ' ' + (done ? 'done' : 'from ' + U.fmtDate(at, 'long')))), h('span.px-sr', done ? ' (done)' : ' (to do)'));
    }
    b.appendChild(h('ol.px-lab-steps',
      step('Starting checks (' + Math.min(2, ph.checks.base) + ' of 2)', start, ph.checks.base >= 2),
      step('Phase 1: group ' + order[0], start, ph.phase !== 1),
      step('Check at the switch', start + W, ph.checks.mid),
      step('Phase 2: group ' + order[1], start + W, ph.phase === 'done'),
      step('Final check', start + 2 * W, ph.checks.end)));
    var ch = E().lab.changes(rec);
    if (ch) {
      var ids = Object.keys(ch.contrast);
      var rows = ids.map(function (id) {
        var c = ch.contrast[id], d = PX.ex.get(id);
        return h('tr', h('th', { scope: 'row' }, d ? d.name : id),
          h('td.px-num', { 'data-label': 'A minus B' }, signed(c.aMinusB)),
          h('td.px-num', { 'data-label': '95 % range' }, signed(c.aMinusB - 1.96 * c.se) + ' to ' + signed(c.aMinusB + 1.96 * c.se)));
      });
      var phases = ch.phases.map(function (x, i) {
        return h('li', h('b', 'Phase ' + (i + 1) + ', group ' + x.cluster + ': '), x.done ? Object.keys(x.probes).map(function (id) {
          var d = PX.ex.get(id);
          return (d ? d.short : id) + ' ' + signed(x.probes[id].change);
        }).join(', ') : 'waiting for its checks');
      });
      b.appendChild(h('p.px-setting-label', 'Probe changes per phase'));
      b.appendChild(h('ul.px-lab-phases', phases));
      if (rows.length) {
        b.appendChild(h('div.px-table-wrap', h('table.px-table.px-table--stack',
          h('caption.px-sr', 'Change while training A minus change while training B, per probe'),
          h('thead', h('tr', h('th', { scope: 'col' }, 'Probe'), h('th', { scope: 'col' }, 'A minus B'), h('th', { scope: 'col' }, '95 % range'))),
          h('tbody', rows))));
        b.appendChild(h('p.px-meta', 'A range that includes 0 means this run cannot tell the groups apart, which is the usual result for one person.'));
      }
    }
    var leave = ui.button('Leave the self-experiment', { kind: 'ghost', onClick: function () {
      ui.confirm('Train sessions will use every exercise again. The data collected so far stays in your record.', { title: 'Leave the self-experiment?', ok: 'Leave', cancel: 'Stay in' }).then(function (yes) {
        if (!yes) return;
        E().lab.leave(PX.core.store.state, Date.now());
        PX.core.store.save();
        PX.ui.app.rerender();
      });
    } });
    leave.setAttribute('data-action', 'lab-leave');
    b.appendChild(h('div.px-data-row', leave));
    return p.el;
  }

  /* ---------- research export ---------- */

  function exportSection(rec) {
    var p = PX.ui.kit.panel({ title: 'Research export', className: 'px-lab-section' });
    p.el.setAttribute('data-section', 'export');
    var rows = PX.ui.log ? PX.ui.log.rows(rec) : [];
    p.body.appendChild(h('p.px-lab-intro', 'For pooling with the community: one row per trial with the exercise and its item-model version, its session, the settings, the seed (which regenerates the exact item), the outcome and response time, the chance of a right answer the engine predicted, the interleaving stage, the screen class (small or large) and the input (mouse, touch, pen or keys), and the item’s difficulty and guessing rate under the current model. Pooled data can refit the hand-set difficulty steps, and the screen class and input let results be compared like with like.'));
    var csv = ui.button('Export trials for research (CSV)', { kind: 'primary', disabled: !rows.length, onClick: function () {
      var st = PX.core.store.state, rs = PX.ui.log.rows(st);
      PX.ui.log.sessions(st, rs); // fills each row's session
      PX.ui.log.exportCSV(rs, {
        research: true, title: 'Research export', filename: 'parallax-research-' + U.fmtDate(Date.now()) + '.csv',
        intro: 'Every trial in your record, with the item model’s difficulty (b, in logits) and guessing rate (g) for rows of the current version. Nothing is sent anywhere: you choose what to share and where.',
      });
    } });
    csv.setAttribute('data-action', 'lab-research');
    var json = ui.button('Back up the whole record (JSON)', { kind: 'secondary', onClick: function () { PX.ui.app.backup(); } });
    p.body.appendChild(h('div.px-data-row', csv, json));
    p.body.appendChild(h('p.px-meta', rows.length ? rows.length + ' trials. Spatial Check results (with the one-tap answer about other tests), Threshold runs, strategy check-ins, the self-experiment, when the DAT-style focus was switched on or off, the tests you noted and Section runs are in the JSON backup.' : 'No trials yet: the export fills as you practise.'));
    return p.el;
  }

  /* ---------- how the engine works ---------- */

  var STYLES = [['Comfortable', '0.85', '89 %', '93 %', '85 %'], ['Balanced (default)', '0.70', '78 %', '85 %', '70 %'], ['Stretch', '0.55', '66 %', '78 %', '55 %']];

  function para(t) { return h('p', t); }

  function engineSection() {
    var p = PX.ui.kit.panel({ title: 'How the engine works', className: 'px-lab-section px-lab-engine' });
    p.el.setAttribute('data-section', 'engine');
    p.body.appendChild(h('p.px-lab-intro', 'The engine decides what you practise next, keeps your levels honest and measures change on the Spatial Check. It is plain code that runs in your browser; the same answers always give the same results. The full version, with formulas and sources, is docs/dev/ENGINE.md in the repository.'));
    function part(id, title, kids) { return h('details.px-lab-part', { 'data-part': id }, h('summary', title), h('div.px-lab-part-body', kids)); }
    p.body.appendChild(part('rating', 'Your rating', [
      para('Each exercise keeps a belief about your ability: a best estimate and how unsure it is. After every answer the belief is updated by Bayes’ rule, so it moves a lot while it is unsure and little once it has settled.'),
      para('The chance of a right answer is g + (1 − g − 0.03) × σ(θ − b): your ability θ against the item’s difficulty b, with g the chance of guessing right (a quarter for four options, a half for yes or no) and 0.03 for the slips everyone makes.'),
      para('Item difficulty comes from the item’s settings (angle, number of cubes, folds…), each adding a fixed step, so a new item still has a predicted difficulty. The steps are set by hand for now, and every trial logs its prediction so pooled data can refit them.'),
      para('The uncertainty grows a little with every answer and with every day away, so the rating keeps up with someone who is learning or forgetting. Stuttered, voided and skipped trials never change a rating; neither do Free play, Threshold runs, the Daily Challenge or the Spatial Check.'),
    ]));
    p.body.appendChild(part('levels', 'Levels 1 to 100', [
      para('Your level is the difficulty you would answer right three times out of four above chance, placed on the exercise’s own range: level 1 is its easiest item, level 100 its hardest. The likely range comes from the rating’s uncertainty (95 %).'),
      para('Next to the level you see the real settings at that difficulty (“120° turns, 10 cubes”). Shown levels change at the end of a block of 10 answers, not after every answer. Levels compare you with your own past on one exercise; they are not scores against other people and say nothing about IQ.'),
    ]));
    p.body.appendChild(part('items', 'Choosing the next item', [
      para('Items aim at a success rate set by your style. The level never depends on the style, only how hard practice feels:'),
      h('div.px-table-wrap', h('table.px-table.px-table--stack', h('caption.px-sr', 'Target success by style and answer format'),
        h('thead', h('tr', ['Style', 'k', '4 options', 'yes/no', 'open answers'].map(function (c) { return h('th', { scope: 'col' }, c); }))),
        h('tbody', STYLES.map(function (r) { return h('tr', h('th', { scope: 'row' }, r[0]), h('td.px-num', { 'data-label': 'k' }, r[1]), h('td.px-num', { 'data-label': '4 options' }, r[2]), h('td.px-num', { 'data-label': 'yes/no' }, r[3]), h('td.px-num', { 'data-label': 'open answers' }, r[4])); })))),
      para('In every 10 items, 8 aim at the target, 1 is easier and 1 is a stretch. Among equally good settings, the ones used least recently win, which keeps practice varied. A setting whose answers fall clearly below prediction is flagged as a weak spot and comes up more often.'),
      para('Every item has its own seed, so the same seed never repeats in training and anyone can regenerate an item from a log.'),
    ]));
    p.body.appendChild(part('modes', 'Modes, and why there are several', [
      para('Research on how to schedule practice does not agree on one method, and each mode answers a different question. All of them share one record.'),
      h('dl.px-facts.px-facts--dims',
        h('div', h('dt', 'Train'), h('dd', 'Daily practice: three exercises per session (a focus, one due for review, one practised least), mixed more as each exercise settles, from blocks of 20 up to random order.')),
        h('div', h('dt', 'Path'), h('dd', 'Ten stages per exercise, practised one at a time. A stage passes when your success stays high and the rating agrees, and comes back for rechecks after 3, 7, 14, 30 and 60 days.')),
        h('div', h('dt', 'Speed'), h('dd', 'Fluency: items you already answer well, against a deadline that adapts. It keeps its own timed level and opens after a passed Path stage or 60 settled answers.')),
        h('div', h('dt', 'Threshold'), h('dd', 'Measures one setting with a staircase (above). Results are kept apart from levels.')),
        h('div', h('dt', 'Free play'), h('dd', 'You choose the exercise, settings and timer. Logged, never rated.')),
        h('div', h('dt', 'Daily Challenge'), h('dd', 'The same 8 items for everyone on a date, one scored attempt: a community game, not training.')),
        h('div', h('dt', 'Spatial Check'), h('dd', 'Measurement on tasks you never train (below).')))
    ]));
    p.body.appendChild(part('check', 'The Spatial Check and how to read it', [
      para('Four spatial probes (Cube Match, View Match, Mechanisms, Pattern Memory) and a word task as a control are never trained and never give feedback. Each is a short adaptive test of 16 items, so it gives an estimate with a range, plus the median time of right answers.'),
      para('Two starting checks set the baseline. Taking a test again raises scores on its own (about a third of a standard deviation at the second test, half by the third, then flat), so your own gain from the first to the second check is used to estimate how much of any later change is familiarity.'),
      para('A change is called beyond familiarity only when its range clears both that estimate and the word task’s change, allowing for the uncertainty of each. Otherwise it says unclear yet: at least one comparison (with familiarity or with the word task) still includes zero. This is the usual result and not the same as no progress; a change shows once it is larger than this range.'),
    ]));
    p.body.appendChild(part('sims', 'What the simulations show', [
      para('Before release, 200 simulated learners practised for 60 days in each mode, with their own starting abilities, learning curves, breaks, guesses and slips. The simulations used stand-in exercises shaped like the real ones. In Balanced Train sessions, target items were answered right 78.0 % of the time against a target of 77.0 %, and the 95 % ranges held the learner’s true ability 96.2 % of the time.'),
      para('With item difficulties deliberately wrong by a random amount, targeting stayed within a point (77.5 vs 77.0 %), and the 95 % ranges held the true ability 91.5 % of the time, so read them as approximate. On the Spatial Check, “beyond familiarity” came up for about 0.06 % of simulated learners without any transfer (1 in 1,600 across all runs; at most 0.5 % in any single run); learners whose probe ability rose with training were still “unclear yet” 97 % of the time after 60 days, which is why the report is cautious.'),
      para('Threshold runs recovered the simulated learners’ true thresholds closely for Track Standard (typical error 0.12 log10 units) and roughly for Span length (76 % within one block of the truth); a single Spin deadline run is a rough guide. Free play never changed a rating in 3 210 simulated sessions.'),
    ]));
    p.body.appendChild(part('goal', 'Weekly goal, streak and achievements', [
      para('A goal of 2 to 6 sessions a week (3 by default). A session counts with 10 answers or 5 minutes. One short week in four is forgiven, and a short week can be made up with one extra session the week after. There is no daily streak and nothing rewards time spent.'),
      para('Achievements mark skills and good practice with visible rules. Only right answers count for skill milestones, and no text ever calls a skill finished.'),
    ]));
    return p.el;
  }

  /* ---------- the screen ---------- */

  function render(host) {
    var rec = PX.core.store.state, now = Date.now();
    host.appendChild(h('div.px-screen-head', h('h1', 'Lab'),
      h('p.px-lead', 'Research protocols, a self-experiment, your data for pooling, and how the engine chooses what you practise.')));
    host.appendChild(h('div.px-lab', protocolsSection(rec), crossoverSection(rec, now), exportSection(rec), engineSection()));
  }

  PX.ui.lab = { RULES: RULES };
  PX.ui.screens = PX.ui.screens || {};
  PX.ui.screens.lab = { title: 'Lab', render: render };
})(window.PX);
