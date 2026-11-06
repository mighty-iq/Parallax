/* PX.ui.screens.progress: Progress (PHASE-3 "Builder B" 2; PLAN §6, §7; ENGINE.md §3, §10–§14).
   Sections: Levels (by exercise and by ability, always with a likely range; the Uttal 2×2 as a
   coverage checklist), the Spatial Check report (PX.engine.assess.report: per probe and the
   composite, change since the baseline average with 95 % intervals, accuracy and time
   separately, the control's change, the retest estimate, and the words "beyond familiarity",
   "unclear yet" or "no change" with a plain explanation), learning curves with their likely
   range (stats.curve), personal bests over whole blocks, the weekly goal calendar and streak,
   achievements (earned and the full list) and the backup line. A new record shows what each
   section will hold and one way to start; never a made-up number.
   Route params: ex=<id> puts that exercise's learning curve first. */
(function (PX) {
  'use strict';

  var ui = PX.ui;
  var h = ui.h;
  var U = PX.util;
  var hasOwn = Object.prototype.hasOwnProperty;
  var MINUS = '−';

  function E() { return PX.engine; }
  function X() { return PX.ui.exinfo; }
  function isNum(x) { return typeof x === 'number' && isFinite(x); }
  function signed(x, dp) {
    if (!isNum(x)) return '–';
    var v = U.round(x, dp === undefined ? 2 : dp);
    if (v === 0) return (0).toFixed(dp === undefined ? 2 : dp);
    return (v > 0 ? '+' : MINUS) + Math.abs(v).toFixed(dp === undefined ? 2 : dp);
  }
  function probeName(id) { var d = PX.ex.get(id); return d ? d.name : id; }
  function probeCode(id) { var d = PX.ex.get(id); return d ? d.code : ''; }

  function section(id, title, aside) {
    var p = PX.ui.kit.panel({ title: title, aside: aside, className: 'px-prog-section' });
    p.el.setAttribute('data-section', id);
    p.el.id = 'px-prog-' + id;
    return p;
  }

  function startCheckButton(label, kind) {
    var b = ui.button(label, { kind: kind || 'primary', onClick: function () { PX.core.router.go('play', { mode: 'check' }); } });
    b.setAttribute('data-action', 'check');
    return b;
  }

  /* ---------- Spatial Check: the interval plot ---------- */

  // A common axis for every row: change in logits, 0 included, ticks every 0.5 or 1.
  function domain(values) {
    var lo = 0, hi = 0;
    values.forEach(function (v) { if (isNum(v)) { lo = Math.min(lo, v); hi = Math.max(hi, v); } });
    lo = Math.min(lo, -1); hi = Math.max(hi, 1);
    var pad = (hi - lo) * 0.08;
    lo -= pad; hi += pad;
    var step = hi - lo > 4.5 ? 1 : 0.5;
    lo = Math.floor(lo / step) * step; hi = Math.ceil(hi / step) * step;
    var ticks = [];
    for (var t = lo; t <= hi + 1e-9; t += step) ticks.push(U.round(t, 2));
    return { lo: lo, hi: hi, ticks: ticks, x: function (v) { return U.clamp((v - lo) / (hi - lo) * 100, 0, 100); } };
  }

  function at(el, left, width) {
    el.style.left = left.toFixed(3) + '%';
    if (width !== undefined) el.style.width = Math.max(0, width).toFixed(3) + '%';
    return el;
  }

  var OUTCOME_KIND = { 'beyond familiarity': 'beyond', 'unclear yet': 'unclear', 'no change': 'none' };

  function verdict(outcome) {
    if (!outcome) return h('span.px-fp-verdict.is-control', 'control');
    return h('span', { class: ['px-fp-verdict', 'is-' + (OUTCOME_KIND[outcome] || 'unclear')] }, outcome);
  }

  function stripOf(dm, x, ctl, opts) {
    var s = h('div.px-fp-strip', { 'aria-hidden': 'true' });
    s.appendChild(at(h('span.px-fp-zero'), dm.x(0)));
    if (ctl && isNum(ctl.change) && !opts.isControl) s.appendChild(at(h('span.px-fp-ctl'), dm.x(ctl.change)));
    if (isNum(x.retest) && x.retest > 0 && !opts.isControl) s.appendChild(at(h('span.px-fp-retest'), dm.x(0), dm.x(x.retest) - dm.x(0)));
    s.appendChild(at(h('span.px-fp-ci'), dm.x(x.lo), dm.x(x.hi) - dm.x(x.lo)));
    s.appendChild(at(h('span', { class: ['px-fp-pt', opts.isControl ? 'is-control' : null] }), dm.x(x.change)));
    return s;
  }

  function srText(name, x, opts) {
    var t = name + ': change ' + signed(x.change) + ', 95 % range ' + signed(x.lo) + ' to ' + signed(x.hi);
    if (opts.plain) return t + '.';
    if (!opts.isControl && isNum(x.retest)) t += '; familiarity estimate ' + signed(x.retest);
    return t + '; ' + (opts.isControl ? 'control task' : x.outcome) + '.';
  }

  function tickText(t) { return t === 0 ? '0' : signed(t, Math.abs(t) % 1 ? 1 : 0); }
  // The scale under each row (shown on narrow screens, where rows stack and the shared axis at
  // the bottom would be screens away).
  function rowAxis(dm) {
    var ax = h('div.px-fp-rowaxis', { 'aria-hidden': 'true' });
    dm.ticks.forEach(function (t) {
      ax.appendChild(at(h('span', { class: ['px-fp-tick', t === 0 ? 'is-zero' : null, Math.abs(t) % 1 ? 'is-half' : null] }, h('span', tickText(t))), dm.x(t)));
    });
    return ax;
  }

  // opts: { id, composite, isControl, plain (no verdict, no reference lines: the baseline step) }
  function fpRow(dm, name, code, x, ctl, opts) {
    opts = opts || {};
    return h('li', { class: ['px-fp-row', opts.composite ? 'is-composite' : null, opts.isControl ? 'is-control' : null], 'data-probe': opts.id || null },
      h('div.px-fp-label', h('b', name), code ? h('span.px-meta', code) : null),
      stripOf(dm, x, opts.plain ? null : ctl, opts),
      rowAxis(dm),
      h('div.px-fp-num', h('span.px-num', signed(x.change)), h('span.px-num.px-fp-range', signed(x.lo) + ' to ' + signed(x.hi))),
      h('div.px-fp-end', opts.plain ? null : verdict(opts.isControl ? null : x.outcome)),
      h('span.px-sr', srText(name, x, opts)));
  }

  function axisRow(dm) {
    var ax = h('div.px-fp-axis', { 'aria-hidden': 'true' });
    dm.ticks.forEach(function (t) {
      ax.appendChild(at(h('span', { class: ['px-fp-tick', t === 0 ? 'is-zero' : null] }, h('span', tickText(t))), dm.x(t)));
    });
    return h('li.px-fp-row.px-fp-axisrow', { 'aria-hidden': 'true' }, h('div.px-fp-label', h('span.px-meta', 'change')), ax, h('div.px-fp-num'), h('div.px-fp-end'));
  }

  function legend() {
    return h('ul.px-fp-legend', { 'aria-label': 'How to read the plot' },
      h('li', h('span.px-fp-key.is-ci', { 'aria-hidden': 'true' }), 'Change since your starting checks, with its 95 % range.'),
      h('li', h('span.px-fp-key.is-retest', { 'aria-hidden': 'true' }), 'What familiarity with the tasks alone should add, from your own first-to-second gain.'),
      h('li', h('span.px-fp-key.is-ctl', { 'aria-hidden': 'true' }), 'Change on the word task, which training does not touch: practice at being tested, effort, mood. Its own range counts too.'));
  }

  var WORDS = [
    ['beyond familiarity', 'Larger than the familiarity estimate and the word task’s change, allowing for the uncertainty of each. Practice is one likely reason; one person’s checks cannot rule out expectations or chance.'],
    ['unclear yet', 'At least one comparison (with familiarity or with the word task) still includes zero. This is the usual result and not the same as no progress; a change shows once it is larger than this range.'],
    ['no change', 'Even the top of the range is less than 0.25 points on the task’s scale above what familiarity predicts.'],
  ];

  // What the familiarity estimate subtracts, as PX.engine.assess computes it (retest gain G from
  // the first to the second test, half as much again to the third, then flat; change measured
  // from the average of the starting checks): G after two starting checks, 2G/3 after three.
  function familiarText(k) {
    var zero = ' If your second starting check was not higher than the first, the estimate is 0.';
    if (k >= 3) return 'Familiarity estimate, the part subtracted from your change: two thirds of your gain from the first to the second starting check. Your change is measured from the average of your three starting checks, and familiarity alone is expected to put later checks that much above it: retesting gains half as much again at the third test, then levels off.' + zero;
    return 'Familiarity estimate, the part subtracted from your change: your whole gain from the first to the second starting check, counted once. Half of it is already in your second check (your change is measured from the average of the two), and the other half is what familiarity is still expected to add later: retesting gains half as much again at the third test, then levels off.' + zero;
  }
  function wordText(outcome) { for (var i = 0; i < WORDS.length; i++) if (WORDS[i][0] === outcome) return WORDS[i][1]; return null; }

  function wordsList() {
    return h('dl.px-words', WORDS.map(function (w) { return h('div', h('dt', verdict(w[0])), h('dd', w[1])); }));
  }

  function td(label, kids, cls) { return h('td', { class: ['px-num', cls], 'data-label': label }, kids); }

  function detailTable(rep) {
    var ids = Object.keys(rep.probes).filter(function (id) { return rep.probes[id].ok; });
    var order = E().config.assess.composite.concat(E().config.assess.optional || [], [E().config.assess.control]);
    ids.sort(function (a, b) { return order.indexOf(a) - order.indexOf(b); });
    var rows = ids.map(function (id) {
      var x = rep.probes[id], ctl = id === E().config.assess.control;
      var acc = x.accuracy || {}, rt = x.rtMed || {};
      return h('tr', { 'data-probe': id },
        h('th', { scope: 'row' }, probeName(id), ctl ? h('span.px-meta', ' control') : null),
        td('Right', X().pct(acc.baseline) + ' → ' + X().pct(acc.latest)),
        td('Median time, right answers', X().secs(rt.baseline) + ' → ' + X().secs(rt.latest)),
        td('Familiarity estimate', ctl ? '–' : signed(x.retest)));
    });
    return h('div.px-table-wrap', h('table.px-table.px-table--stack.px-check-table',
      h('caption.px-sr', 'Accuracy and median time on right answers, starting checks against the latest check'),
      h('thead', h('tr', h('th', { scope: 'col' }, 'Probe'), h('th', { scope: 'col' }, 'Right'), h('th', { scope: 'col' }, 'Median time, right answers'), h('th', { scope: 'col' }, 'Familiarity estimate'))),
      h('tbody', rows)));
  }

  // The two comparisons behind each word: change − familiarity estimate, change − word task.
  function decisionTable(rows) {
    function cell(label, v) {
      if (!v) return td(label, '–');
      var clear = v.lo > 0;
      return td(label, [signed(v.diff) + ' (' + signed(v.lo) + ' to ' + signed(v.hi) + ')',
        clear ? h('span.px-clear', h('span', { 'aria-hidden': 'true' }, ' ✓'), h('span.px-sr', ', range above zero')) : null], clear ? 'is-clear' : null);
    }
    var body = rows.filter(function (r) { return !r.isControl && r.x.vsRetest; }).map(function (r) {
      return h('tr', { 'data-probe': r.id, class: r.composite ? 'is-composite' : null },
        h('th', { scope: 'row' }, r.name),
        cell('Beyond the familiarity estimate', r.x.vsRetest.known ? r.x.vsRetest : null),
        cell('Beyond the word task', r.x.vsControl),
        h('td', { 'data-label': 'Word' }, verdict(r.x.outcome)));
    });
    return [
      h('p.px-setting-label', 'Why these words'),
      h('p.px-meta', 'A change is called beyond familiarity only when both of these ranges lie wholly above zero (marked ✓).'),
      h('div.px-table-wrap', h('table.px-table.px-table--stack.px-check-table.px-decide',
        h('caption.px-sr', 'Change beyond the familiarity estimate and beyond the word task, with 95 % ranges'),
        h('thead', h('tr', h('th', { scope: 'col' }, 'Probe'), h('th', { scope: 'col' }, 'Beyond the familiarity estimate'), h('th', { scope: 'col' }, 'Beyond the word task'), h('th', { scope: 'col' }, 'Word'))),
        h('tbody', body))),
    ];
  }

  function nearList(near) {
    var ids = Object.keys(near || {});
    if (!ids.length) return null;
    return h('div.px-near',
      h('p.px-setting-label', 'Trained exercises since your starting checks'),
      h('p.px-meta', 'Practice gains on the exercises you train (new items each time): expected to rise most; this is not transfer, and not what the probes test.'),
      h('ul.px-near-list', ids.map(function (id) {
        var n = near[id], def = PX.ex.get(id);
        return h('li', h('b', def ? def.short : id), h('span.px-num', n.from + ' → ' + n.to), h('span.px-meta', 'now likely ' + n.lo + '–' + n.hi));
      })));
  }

  function checkHistory(rec) {
    var list = E().assess.checks(rec);
    if (!list.length) return null;
    var KIND = { B1: 'baseline 1', B2: 'baseline 2', B3: 'baseline 3', regular: 'regular check', delayed: 'delayed check' };
    return h('details.px-checks',
      h('summary', 'Checks taken (' + list.length + ')'),
      h('ol.px-checks-list', list.map(function (c) {
        return h('li', h('span.px-num', U.fmtDate(c.date, 'long')), h('span', (KIND[c.kind] || 'check') + ', form ' + (c.form || '?')),
          h('span.px-meta', Object.keys(c.results).length + ' probes'));
      })));
  }

  // The same words as Today (PX.ui.home.checkStatus, from PX.engine.assess.nextCheck).
  function nextLine(rec, now) {
    var cs = PX.ui.home.checkStatus(rec, now);
    return h('div.px-check-next', { 'data-due': cs.ready ? '1' : '0' }, h('p', h('b', cs.status + '. '), cs.text),
      cs.label ? startCheckButton(cs.label, cs.ready ? 'primary' : 'ghost') : null);
  }

  // Starting checks only: each probe's results so far, and the first-to-second step (familiarity).
  function baselineView(rec, rep) {
    var list = E().assess.checks(rec), ids = {};
    list.forEach(function (c) { Object.keys(c.results).forEach(function (id) { ids[id] = true; }); });
    var order = E().config.assess.composite.concat(E().config.assess.optional || [], [E().config.assess.control]);
    var probeIds = Object.keys(ids).sort(function (a, b) { return order.indexOf(a) - order.indexOf(b); });
    var head = h('tr', h('th', { scope: 'col' }, 'Probe'), list.slice(0, 3).map(function (c, i) { return h('th', { scope: 'col' }, 'Check ' + (i + 1)); }));
    var rows = probeIds.map(function (id) {
      return h('tr', h('th', { scope: 'row' }, probeName(id), id === E().config.assess.control ? h('span.px-meta', ' control') : null),
        list.slice(0, 3).map(function (c, i) {
          var r = c.results[id];
          return td('Check ' + (i + 1), r ? r.right + ' of ' + r.n + ' right, ' + X().secs(r.rtMed) : '–');
        }));
    });
    var kids = [
      h('p', rep.lines[0] || ''),
      h('div.px-table-wrap', h('table.px-table.px-table--stack.px-check-table', h('caption.px-sr', 'Right answers and median time on right answers per starting check'), h('thead', head), h('tbody', rows))),
      h('p.px-meta', 'Each cell: right answers, and the median time of the right ones.'),
    ];
    if (list.length >= 2) {
      var steps = probeIds.map(function (id) {
        var a = list[0].results[id], b = list[1].results[id];
        if (!a || !b || !isNum(a.theta) || !isNum(b.theta)) return null;
        var d = b.theta - a.theta, se = Math.sqrt(a.se * a.se + b.se * b.se);
        return { id: id, change: d, lo: d - 1.96 * se, hi: d + 1.96 * se };
      }).filter(Boolean);
      if (steps.length) {
        var dm = domain([].concat.apply([], steps.map(function (s) { return [s.lo, s.hi]; })));
        var plot = h('ol.px-fp', { 'aria-label': 'First to second starting check, per probe' }, axisRow(dm));
        steps.forEach(function (s) {
          plot.insertBefore(fpRow(dm, probeName(s.id), probeCode(s.id), s, null, { id: s.id, plain: true }), plot.lastChild);
        });
        kids.push(h('p.px-setting-label', 'From the first to the second starting check'),
          h('p.px-meta', 'Mostly familiarity with the tasks. It sets how much of a later change familiarity alone would explain.'), plot);
      }
    }
    return kids;
  }

  function checkSection(rec, now) {
    var rep = E().assess.report(rec, now);
    var p = section('check', 'Spatial Check', h('span.px-num', rep.checks + (rep.checks === 1 ? ' check' : ' checks')));
    var b = p.body;
    b.setAttribute('data-status', rep.status);
    if (rep.status === 'none') {
      b.appendChild(h('p.px-prog-empty', 'The Spatial Check measures change on tasks you never practise, so it can show whether your training carries over. It takes about 15 minutes, gives no feedback, and starts with two baseline checks.'));
      b.appendChild(nextLine(rec, now));
      b.appendChild(wordsList());
      return p.el;
    }
    if (rep.status !== 'change') {
      baselineView(rec, rep).forEach(function (k) { b.appendChild(k); });
      b.appendChild(nextLine(rec, now));
      b.appendChild(checkHistory(rec));
      return p.el;
    }
    var A = E().config.assess, ctl = rep.control;
    var rows = [];
    if (rep.composite) rows.push({ id: 'composite', name: 'Spatial probes combined', code: 'mean of ' + rep.composite.probes.length, x: rep.composite, composite: true });
    A.composite.concat(A.optional || []).forEach(function (id) {
      var x = rep.probes[id];
      if (x && x.ok) rows.push({ id: id, name: probeName(id), code: probeCode(id), x: x });
    });
    if (ctl) rows.push({ id: A.control, name: probeName(A.control), code: probeCode(A.control) + ' control', x: ctl, isControl: true });
    var vals = [];
    rows.forEach(function (r) { vals.push(r.x.lo, r.x.hi, r.x.retest); });
    if (ctl) vals.push(ctl.change);
    var dm = domain(vals);
    var plot = h('ol.px-fp', { 'aria-label': 'Change since the starting checks, per probe' });
    rows.forEach(function (r) { plot.appendChild(fpRow(dm, r.name, r.code, r.x, ctl, r)); });
    plot.appendChild(axisRow(dm));
    var c = rep.composite;
    b.appendChild(h('div.px-check-lead',
      c ? h('p.px-check-verdict', 'Spatial probes combined: ', verdict(c.outcome)) : null,
      c ? h('p', wordText(c.outcome) || c.text) : null,
      h('p.px-meta', 'Latest check ' + U.fmtDate(rep.latest.date, 'long') + ', form ' + rep.latest.form + '; compared with the average of your ' + rep.baselines + ' starting checks.')));
    b.appendChild(plot);
    b.appendChild(legend());
    b.appendChild(h('p.px-meta.px-units', 'Changes are in points on each task’s difficulty scale: +1 point is about the step from 50 % to 73 % right on the same item. Probes are short, so one check has a wide range; that is why the words are cautious.'));
    decisionTable(rows).forEach(function (k) { b.appendChild(k); });
    b.appendChild(h('p.px-setting-label', 'Accuracy and time, separately'));
    b.appendChild(detailTable(rep));
    var first = rows.filter(function (r) { return !r.composite && !r.isControl && isNum(r.x.retestRemaining); })[0];
    if (first) b.appendChild(h('p.px-meta.px-familiar', familiarText(rep.baselines)));
    var nl = nearList(rep.near);
    if (nl) b.appendChild(nl);
    b.appendChild(wordsList());
    b.appendChild(nextLine(rec, now));
    b.appendChild(checkHistory(rec));
    return p.el;
  }

  /* ---------- levels: by exercise, by ability, coverage ---------- */

  var ABILITY = {
    Vz: 'Visualization', SR: 'Speeded rotation', CS: 'Closure speed', CF: 'Flexibility of closure', MV: 'Visual memory',
    SS: 'Spatial scanning', AT: 'Attentional tracking', WM: 'Working memory', PT: 'Perspective taking', NAV: 'Navigation',
  };
  var NOT_GV = { AT: 1, WM: 1, PT: 1, NAV: 1 };

  // x.has: answers in the rating shown here (Track and Homing keep one per screen class, so a
  // phone shows the small-screen rating, which may be empty while x.n counts both).
  function levelRow(def, x, now) {
    var e = X().entry(def.id), has = x.has;
    var bar = has ? ui.bar(x.level, 100, { band: [x.lo, x.hi], label: e.name + ' level', kind: 'signal' }) : ui.bar(0, 100, { label: e.name + ' level' });
    if (has) bar.setAttribute('aria-valuetext', 'level ' + x.level + ', likely between ' + x.lo + ' and ' + x.hi);
    var set = [];
    if (has && x.settings) set.push('Handles ' + X().settingsText(def, x.settings).replace(/^./, function (c) { return c.toLowerCase(); }) + '.');
    if (has) set.push(' Path stage ' + x.path + ' of 10.');
    if (has && x.due && x.due.due) set.push(' Review due.');
    if (!has && x.n > 0) set.push('Rated separately by screen size: ' + x.n + ' answers on ' + (X().display() === 'small' ? 'larger' : 'small') + ' screens, none on this one yet.');
    return h('li', { class: ['px-level', has ? null : 'is-new'], 'data-ex': def.id },
      h('div.px-level-name', h('b', e.name, ' ', X().tagEls(def)), PX.ui.kit.spec([e.code, e.abilities.join(' ')])),
      h('div.px-level-bar', bar),
      has ? h('div.px-level-num', { 'aria-hidden': 'true' }, h('b', String(x.level)), h('span', x.lo + '–' + x.hi))
        : h('div.px-level-num', h('b', x.n > 0 ? 'Not on this screen' : 'Not started')),
      set.length ? h('div.px-level-set', set.join('')) : null);
  }

  function abilities(ov) {
    var acc = {};
    ov.forEach(function (x) {
      if (!x.has) return;
      x.abilities.forEach(function (a, i) {
        var w = i === 0 ? 1 : 0.5, o = acc[a] || (acc[a] = { w: 0, l: 0, lo: 0, hi: 0, exs: [] });
        o.w += w; o.l += w * x.level; o.lo += w * x.lo; o.hi += w * x.hi; o.exs.push(x.short || x.exId);
      });
    });
    return Object.keys(acc).map(function (a) {
      var o = acc[a];
      return { code: a, level: Math.round(o.l / o.w), lo: Math.round(o.lo / o.w), hi: Math.round(o.hi / o.w), exs: o.exs };
    }).sort(function (a, b) { return (NOT_GV[a.code] ? 1 : 0) - (NOT_GV[b.code] ? 1 : 0) || b.exs.length - a.exs.length; });
  }

  var CELLS = [['intrinsic-static', 'Intrinsic, static', 'the shape of one object'], ['intrinsic-dynamic', 'Intrinsic, dynamic', 'one object turned, folded or cut'],
    ['extrinsic-static', 'Extrinsic, static', 'where things are relative to each other'], ['extrinsic-dynamic', 'Extrinsic, dynamic', 'positions as you or things move']];

  function coverage(ov) {
    function names(cell) {
      return ov.filter(function (x) { return (x.cell || null) === cell; }).map(function (x) {
        return h('span', { class: ['px-cov-ex', x.n > 0 ? 'is-done' : null] }, x.n > 0 ? PX.ui.kit.icon('check') : null, x.short, h('span.px-sr', x.n > 0 ? ' (practised)' : ' (not yet)'));
      });
    }
    return h('div.px-cov',
      h('p.px-setting-label', 'Coverage'),
      h('p.px-meta', 'The four kinds of spatial task in Uttal and colleagues’ scheme, used as a checklist of what you practise, not as a score.'),
      h('div.px-cov-grid', CELLS.map(function (c) {
        var list = names(c[0]);
        return h('div.px-cov-cell', h('b', c[1]), h('span.px-meta', c[2]), h('div.px-cov-list', list.length ? list : h('span.px-meta', 'Spatial Check only')));
      })),
      h('p.px-meta', 'Outside the four: ', names(null)));
  }

  function levelsSection(rec, now, ov, fresh) {
    var p = section('levels', 'Levels', 'level 1–100, likely range');
    var started = ov.filter(function (x) { return x.n > 0; });
    if (!started.length) {
      p.body.appendChild(h('p.px-prog-empty', 'Levels appear after your first few items in an exercise, each with a likely range that narrows as you practise. Level 1 is an exercise’s easiest item, level 100 its hardest.'));
      p.body.appendChild(h('div.px-data-row', fresh ? null : ui.button('Start today’s session', { kind: 'primary', go: 'play?mode=train' }), ui.button('Open the Library', { kind: 'ghost', go: 'library' })));
      return p.el;
    }
    var list = h('ul.px-levels.px-prog-levels');
    ov.slice().sort(function (a, b) { return (b.has ? 1 : 0) - (a.has ? 1 : 0); }).forEach(function (x) { list.appendChild(levelRow(PX.ex.get(x.exId), x, now)); });
    p.body.appendChild(list);
    var ab = abilities(ov);
    function abilityList(items) {
      var al = h('ul.px-levels.px-abilities');
      items.forEach(function (a) {
        var bar = ui.bar(a.level, 100, { band: [a.lo, a.hi], label: (ABILITY[a.code] || a.code) + ' average level', kind: 'signal' });
        bar.setAttribute('aria-valuetext', 'average level ' + a.level + ', likely between ' + a.lo + ' and ' + a.hi);
        al.appendChild(h('li.px-level', { 'data-ability': a.code },
          h('div.px-level-name', h('b', ABILITY[a.code] || a.code), PX.ui.kit.spec([a.code])),
          h('div.px-level-bar', bar),
          h('div.px-level-num', { 'aria-hidden': 'true' }, h('b', String(a.level)), h('span', a.lo + '–' + a.hi)),
          h('div.px-level-set', 'From ' + a.exs.join(', ') + '.')));
      });
      return al;
    }
    if (ab.length) {
      var gv = ab.filter(function (a) { return !NOT_GV[a.code]; }), other = ab.filter(function (a) { return NOT_GV[a.code]; });
      p.body.appendChild(h('p.px-setting-label.px-prog-sub', 'By ability'));
      p.body.appendChild(h('p.px-meta', 'The average of the exercises that train each ability (main ability full weight, others half), with the average of their ranges. A summary of your exercise levels, not a separate score.'));
      if (gv.length) p.body.appendChild(abilityList(gv));
      if (other.length) {
        p.body.appendChild(h('p.px-meta.px-prog-other', 'Also trained, not among the CHC Gv narrow abilities:'));
        p.body.appendChild(abilityList(other));
      }
    }
    p.body.appendChild(coverage(ov));
    return p.el;
  }

  /* ---------- learning curves ---------- */

  function curveChart(def, pts) {
    var W = 320, H = 132, L = 30, R = 312, T = 10, B = 106;
    var svg = PX.core.svg, root = svg.svg(W, H, { class: 'px-curve-svg' });
    var d0 = U.dayNum(pts[0].day), d1 = U.dayNum(pts[pts.length - 1].day), span = Math.max(1, d1 - d0);
    function x(p) { return pts.length === 1 ? (L + R) / 2 : L + (U.dayNum(p.day) - d0) / span * (R - L); }
    function y(v) { return B - (U.clamp(v, 1, 100) - 1) / 99 * (B - T); }
    [1, 25, 50, 75, 100].forEach(function (v) {
      root.appendChild(svg.el('line', { class: 'px-curve-grid', x1: L, x2: R, y1: y(v), y2: y(v) }));
      root.appendChild(svg.text(L - 6, y(v), String(v), { class: 'px-curve-lab', 'text-anchor': 'end' }));
    });
    var band = pts.map(function (p) { return [x(p), y(p.hi)]; }).concat(pts.slice().reverse().map(function (p) { return [x(p), y(p.lo)]; }));
    if (pts.length > 1) root.appendChild(svg.path(band, true, { class: 'px-curve-band' }));
    else root.appendChild(svg.el('line', { class: 'px-curve-bandline', x1: x(pts[0]), x2: x(pts[0]), y1: y(pts[0].hi), y2: y(pts[0].lo) }));
    if (pts.length > 1) root.appendChild(svg.path(pts.map(function (p) { return [x(p), y(p.level)]; }), false, { class: 'px-curve-line' }));
    var last = pts[pts.length - 1];
    root.appendChild(svg.el('rect', { class: 'px-curve-pt', x: x(last) - 3, y: y(last.level) - 3, width: 6, height: 6 }));
    root.appendChild(svg.text(L, H - 10, U.fmtDate(pts[0].day, 'short'), { class: 'px-curve-lab', 'text-anchor': 'start' }));
    if (pts.length > 1) root.appendChild(svg.text(R, H - 10, U.fmtDate(last.day, 'short'), { class: 'px-curve-lab', 'text-anchor': 'end' }));
    root.removeAttribute('aria-hidden');
    root.setAttribute('role', 'img');
    root.setAttribute('aria-label', def.short + ': level ' + pts[0].level + ' on ' + U.fmtDate(pts[0].day, 'long') + ', level ' + last.level +
      ' on ' + U.fmtDate(last.day, 'long') + ', likely between ' + last.lo + ' and ' + last.hi + ', over ' + pts.length + ' practice days.');
    return root;
  }

  // ov: the Levels list's rows (stats.overview), so each curve's heading shows the same level now.
  function curvesSection(rec, now, focus, ov) {
    var p = section('curves', 'Learning curves', 'one dot per practice day'), nowOf = {};
    (ov || []).forEach(function (x) { if (x.has) nowOf[x.exId] = x; });
    var disp = X().display(), items = [];
    X().defs().forEach(function (def) {
      var pts = [];
      try { pts = E().stats.curve(rec, def, { display: disp }); } catch (e) { pts = []; }
      if (pts.length) items.push({ def: def, pts: pts });
    });
    if (!items.length) {
      p.body.appendChild(h('p.px-prog-empty', 'Each exercise gets a curve of its level by practice day, with a band for the likely range. The band is wide at first and narrows as answers come in.'));
      return p.el;
    }
    if (focus) items.sort(function (a, b) { return (b.def.id === focus) - (a.def.id === focus); });
    p.body.appendChild(h('p.px-meta', 'The line is your level at the end of each practice day; the band is its likely range (95 %). Day-to-day wiggles inside the band are noise, not progress or decline. The numbers above each curve are your level now, as in Levels: its range widens a little on days without practice.'));
    p.body.appendChild(h('div.px-curves', items.map(function (it) {
      var lv = nowOf[it.def.id] || it.pts[it.pts.length - 1];
      return h('figure', { class: ['px-curve', it.def.id === focus ? 'is-focus' : null], 'data-ex': it.def.id },
        h('figcaption', h('b', it.def.short), h('span.px-num', 'level ' + lv.level + ' · ' + lv.lo + '–' + lv.hi)),
        curveChart(it.def, it.pts));
    })));
    return p.el;
  }

  /* ---------- personal bests ---------- */

  function bestsSection(rec) {
    var p = section('bests', 'Personal bests', 'whole blocks of 10');
    var rows = X().defs().map(function (def) {
      var e = rec.ex && rec.ex[def.id], b = e && e.best && e.best.block;
      return b && isNum(b.level) ? { def: def, b: b } : null;
    }).filter(Boolean).sort(function (a, b) { return b.b.at - a.b.at; });
    if (!rows.length) {
      p.body.appendChild(h('p.px-prog-empty', 'A personal best is a whole block of 10 answers on one exercise whose success reached the level reference; its level is the one shown at the end of that block. Partial blocks never count.'));
      return p.el;
    }
    p.body.appendChild(h('ul.px-bests', rows.map(function (r) {
      return h('li', { 'data-ex': r.def.id }, h('b', r.def.short), h('span.px-num', 'level ' + r.b.level),
        h('span', Math.round(r.b.acc * (r.b.n || 10)) + ' of ' + (r.b.n || 10) + ' right'),
        h('span.px-meta', U.fmtDate(r.b.at, 'long') + (r.b.beats ? ', beat ' + r.b.beats + (r.b.beats === 1 ? ' earlier best' : ' earlier bests') : '')));
    })));
    return p.el;
  }

  /* ---------- weekly goal and streak ---------- */

  var LETTERS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'], DAYNAMES = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

  function goalSection(rec, now) {
    // Days are marked by the goal's own rule (sessions with 10 answers or 5 minutes), as on Today.
    var st = E().streak.status(rec, now), perDay = E().streak.days(rec);
    var p = section('goal', 'Weekly goal', h('span.px-num', st.goal + ' a week'));
    var b = p.body;
    b.appendChild(h('div.px-goal-head',
      st.week.met ? h('p.px-goal-now', h('b.px-num', String(st.week.sessions)), st.week.sessions === 1 ? ' session' : ' sessions', ' this week: goal of ' + st.goal + ' met.')
        : h('p.px-goal-now', h('b.px-num', st.week.sessions + ' of ' + st.goal), ' sessions this week.'),
      st.weeks.length ? h('p.px-goal-run', 'Weeks in a row with the goal met: ', h('b.px-num', String(st.current)), st.best > st.current ? h('span.px-meta', ' (best ' + st.best + ')') : null) : null));
    if (st.repair) b.appendChild(h('p.px-notice', PX.ui.kit.icon('about'), h('span', 'Last week fell short. ' + st.repair.left + (st.repair.left === 1 ? ' more session' : ' more sessions') + ' this week carry your run of ' + st.repair.run + (st.repair.run === 1 ? ' week' : ' weeks') + ' on.')));
    var weeks = st.weeks.length ? st.weeks.slice(-12) : [{ key: st.week.key, sessions: st.week.sessions, goal: st.goal, met: st.week.met, open: true }];
    var head = h('div.px-cal-row.px-cal-head', { 'aria-hidden': 'true' }, h('span.px-cal-week', 'week of'), LETTERS.map(function (l) { return h('span.px-cal-k', l); }), h('span.px-cal-status', 'sessions'));
    var rows = weeks.slice().reverse().map(function (w) {
      var cells = [];
      for (var i = 0; i < 7; i++) {
        var day = U.addDays(w.key, i), did = (perDay[day] || 0) > 0, future = day > U.dayKey(now);
        cells.push(h('span', { class: ['px-cal-day', did ? 'is-done' : null, future ? 'is-future' : null, day === U.dayKey(now) ? 'is-today' : null] },
          did ? PX.ui.kit.icon('check') : null, h('span.px-sr', DAYNAMES[i] + ' ' + U.fmtDate(day, 'short') + (did ? ': practised' : future ? '' : ': not practised'))));
      }
      var status = w.met ? 'met' : w.open ? 'so far' : w.graced ? 'forgiven' : w.repaired ? 'made up' : 'short';
      return h('li', { class: ['px-cal-row', w.met ? 'is-met' : null], 'data-week': w.key },
        h('span.px-cal-week.px-num', U.fmtDate(w.key, 'short')), cells,
        h('span.px-cal-status', h('span.px-num', w.sessions + '/' + w.goal), ' ' + status));
    });
    b.appendChild(h('div.px-cal', head, h('ol.px-cal-rows', { 'aria-label': 'Days practised, by week' }, rows)));
    b.appendChild(h('p.px-meta', 'A session counts with 10 answers or 5 minutes. One short week in every four is forgiven, and a short week can be made up with one extra session the week after.'));
    b.appendChild(h('div.px-data-row', ui.button('Change the goal', { kind: 'ghost', small: true, go: 'settings' })));
    return p.el;
  }

  /* ---------- achievements ---------- */

  function achievementsSection(rec, now) {
    var list = [];
    try { list = E().achievements.list(rec, now); } catch (e) { list = []; }
    var earned = list.filter(function (a) { return a.earned; }).sort(function (a, b) { return String(b.earned).localeCompare(String(a.earned)); });
    var open = list.filter(function (a) { return !a.earned; }).sort(function (a, b) { return b.progress[0] / b.progress[1] - a.progress[0] / a.progress[1]; });
    var p = section('achievements', 'Achievements', h('span.px-num', earned.length + ' of ' + list.length + ' earned'));
    if (!earned.length) p.body.appendChild(h('p.px-prog-empty', 'Achievements mark skills and good practice, each with its rule below. None earned yet.'));
    function item(a, done) {
      var pr = a.progress || [0, 1];
      return h('li', { class: ['px-ach-item', done ? 'is-earned' : null], 'data-ach': a.id },
        done ? PX.ui.kit.icon('award', 'px-ach-mark') : h('span.px-ach-mark.is-open', { 'aria-hidden': 'true' }),
        h('div', h('b', a.name), h('span', a.desc),
          done ? h('span.px-num.px-meta', 'Earned ' + U.fmtDate(a.earned, 'long'))
            : pr[1] > 1 ? h('span.px-ach-prog', ui.bar(pr[0], pr[1], { label: a.name + ' progress' }), h('span.px-num.px-meta', pr[0] + ' of ' + pr[1])) : null));
    }
    if (earned.length) p.body.appendChild(h('ul.px-achs', earned.map(function (a) { return item(a, true); })));
    if (open.length) {
      p.body.appendChild(h('p.px-setting-label.px-prog-sub', earned.length ? 'Still open' : 'All achievements'));
      p.body.appendChild(h('ul.px-achs.is-open', open.map(function (a) { return item(a, false); })));
    }
    return p.el;
  }

  function dataSection() {
    var K = PX.ui.kit;
    var p = section('data', 'Your data');
    var b = ui.button('Back up now', { kind: PX.core.store.volatile ? 'primary' : 'secondary', onClick: function () { PX.ui.app.backup(); } });
    b.setAttribute('data-backup', '');
    p.body.appendChild(h('div.px-data-strip', h('div.px-data-strip-text', h('strong', K.storageText()), h('span', K.backupLine(), '. Progress lives only in this browser until you back it up.')), b));
    return p.el;
  }

  /* ---------- the screen ---------- */

  var SECTIONS = [['levels', 'Levels'], ['check', 'Spatial Check'], ['curves', 'Curves'], ['bests', 'Bests'], ['goal', 'Weekly goal'], ['achievements', 'Achievements'], ['data', 'Your data']];

  function jumpTo(id) {
    var el = document.getElementById('px-prog-' + id);
    if (!el) return;
    var reduce = PX.ui.app && PX.ui.app.motionReduced && PX.ui.app.motionReduced();
    try { el.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' }); } catch (e) { el.scrollIntoView(); }
    var t = el.querySelector('.px-panel-title');
    if (t) { t.setAttribute('tabindex', '-1'); try { t.focus({ preventScroll: true }); } catch (e2) { t.focus(); } }
  }

  function render(host, route) {
    var rec = PX.core.store.state, now = Date.now(), focus = route && route.params && route.params.ex;
    var ov = [], disp = X().display();
    try { ov = E().stats.overview(rec, now, { display: disp }); } catch (e) { ov = []; }
    ov.forEach(function (x) {
      var def = PX.ex.get(x.exId);
      try { x.has = !!def && E().est.get(rec, def, { display: disp }).n > 0; } catch (e) { x.has = false; }
    });
    var tot = E().stats.totals(rec), checks = E().assess.checks(rec).length;
    var meta = tot.trials ? tot.trials + (tot.trials === 1 ? ' answer' : ' answers') + ' on ' + tot.days + (tot.days === 1 ? ' day' : ' days') + ' · ' + checks + (checks === 1 ? ' check' : ' checks') : 'no practice yet';
    host.appendChild(h('div.px-screen-head', h('p.px-screen-meta', meta), h('h1', 'Progress'),
      h('p.px-lead', 'Your levels against your own past, each with its likely range, and the Spatial Check, which tests whether practice carries over to tasks you never train.')));
    var nav = h('nav.px-prog-nav', { 'aria-label': 'Sections of Progress' });
    SECTIONS.forEach(function (s) {
      var b = h('button.px-btn.px-btn--ghost.px-btn--small', { type: 'button', 'data-jump': s[0] }, s[1]);
      b.addEventListener('click', function () { jumpTo(s[0]); });
      nav.appendChild(b);
    });
    host.appendChild(nav);
    if (!tot.trials && !checks) {
      host.appendChild(h('div.px-panel.px-prog-start',
        h('p', h('b', 'Progress fills in as you practise. '), 'Levels show after a few items, learning curves after two practice days, and the Spatial Check report after your two starting checks.'),
        h('div.px-data-row', ui.button('Start today’s session', { kind: 'primary', go: 'play?mode=train' }), startCheckButton('Take baseline 1', 'secondary'))));
    }
    host.appendChild(h('div.px-prog',
      levelsSection(rec, now, ov, !tot.trials && !checks), checkSection(rec, now), curvesSection(rec, now, focus, ov), bestsSection(rec),
      goalSection(rec, now), achievementsSection(rec, now), dataSection()));
    if (focus) window.setTimeout(function () { jumpTo('curves'); }, 0);
  }

  PX.ui.progress = { jumpTo: jumpTo, _: { domain: domain, abilities: abilities, signed: signed } };
  PX.ui.screens = PX.ui.screens || {};
  PX.ui.screens.progress = { title: 'Progress', render: render };
})(window.PX);
