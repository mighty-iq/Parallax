/* PX.ui.screens.home: Today (ARCHITECTURE §9; PLAN §5, §7, §8).
   Slots in reading order: today's session (a protocol card with a minute ruler), weekly goal
   (a dial with one segment per planned session, and the days practised), Daily Challenge,
   Spatial Check, your data (last backup, Back up now), exercise levels, recent achievements.

   Every panel shows the player's own record, never sample data: a fresh profile sees empty
   states (no levels yet, no achievements yet), and a plan that cannot be built says so.

   PX.ui.home
     catalog()        the exercises in code order, one entry per id: registry definitions over
                      the list below
     count()          the training exercises the Library lists (registered definitions)
     plan(rec, now)   hook → { minutes, mode, style, blocks: [{ role, ex, min, why, pat }], patFocus }
                      or null (nothing to plan: the panel says so); js/ui/play.js homePlan
     levels(rec)      hook → [{ ex, n, last, level, lo, hi, settings, stage }] or null (the
                      record's own levels are used then); js/ui/play.js homeLevels */
(function (PX) {
  'use strict';

  var ui = PX.ui;
  var h = ui.h;
  var S = PX.core.svg;
  var U = PX.util;
  var hasOwn = Object.prototype.hasOwnProperty;

  // The training exercises (PLAN.md §3; v1.1 adds Reckon, Knots and six DAT-style formats), used until each registers its definition.
  var CATALOG = [
    { id: 'track', code: 'EX-01', name: 'Track', kind: '3D multiple-object tracking', abilities: ['AT'], note: 'attention practice', blurb: 'Follow several moving spheres in 3D and pick out the ones you were shown.' },
    { id: 'rotate', code: 'EX-02', name: 'Rotate', kind: 'Mental rotation', abilities: ['Vz', 'SR'], blurb: 'Decide whether two block figures are one object turned, or mirror images.' },
    { id: 'spin', code: 'EX-03', name: 'Spin', kind: '2D speeded rotation', abilities: ['SR'], blurb: 'Turn flat shapes in your head, quickly and accurately.' },
    { id: 'fold', code: 'EX-04', name: 'Fold', kind: 'Paper folding', abilities: ['Vz'], blurb: 'Fold a sheet, punch holes, and predict the pattern when it opens.' },
    { id: 'nets', code: 'EX-05', name: 'Nets', kind: 'Cube nets', abilities: ['Vz'], blurb: 'Fold a flat net into a cube and keep track of which faces meet.' },
    { id: 'slice', code: 'EX-06', name: 'Slice', kind: 'Cross-sections', abilities: ['Vz'], blurb: 'Name the shape a cut leaves on a solid.' },
    { id: 'views', code: 'EX-07', name: 'Views', kind: 'Orthographic views', abilities: ['Vz'], blurb: 'Match a block structure with its top, front and side views.' },
    { id: 'orient', code: 'EX-08', name: 'Orient', kind: 'Perspective taking', abilities: ['PT'], blurb: 'Imagine standing at one object, facing another, and point to a third.' },
    { id: 'span', code: 'EX-09', name: 'Span', kind: 'Spatial span', abilities: ['MV', 'WM'], blurb: 'Repeat a sequence of blocks forwards, backwards or on a turned board.' },
    { id: 'hidden', code: 'EX-10', name: 'Hidden', kind: 'Embedded figures', abilities: ['CF'], blurb: 'Find which simple shape is hidden inside a pattern.' },
    { id: 'homing', code: 'EX-11', name: 'Homing', kind: 'Navigation', abilities: ['NAV'], note: 'experimental', blurb: 'After a route, turn to face the place where you started.' },
    { id: 'reckon', code: 'EX-12', name: 'Reckon', kind: 'Navigation', abilities: ['NAV'], note: 'experimental', blurb: 'After a walk with nothing to steer by, point or walk back to where you started.' },
    { id: 'knots', code: 'EX-13', name: 'Knots', kind: 'Knot diagrams', abilities: ['Vz'], blurb: 'Pull a rope in your mind: does a knot remain? Which crossing unties it? Are two loops linked?' },
    // v1.1 DAT-style formats (opt-in: they join Train only under the DAT-style focus).
    { id: 'openings', code: 'EX-14', name: 'Openings', kind: 'Openings (apertures)', abilities: ['Vz'], note: 'DAT-style', blurb: 'Find the opening a solid would pass through, turned the right way, with nothing to spare.' },
    { id: 'patviews', code: 'EX-15', name: 'Missing View', kind: 'Orthographic views', abilities: ['Vz'], note: 'DAT-style', blurb: 'Two drawings of a block structure are given: pick the missing third view.' },
    { id: 'angles', code: 'EX-16', name: 'Angles', kind: 'Angle ranking', abilities: ['LE'], note: 'perceptual-judgement practice', blurb: 'Rank four angles from smallest to largest, by eye.' },
    { id: 'patfold', code: 'EX-17', name: 'Hole Punch', kind: 'Hole punching', abilities: ['Vz'], note: 'DAT-style', blurb: 'A folded square is punched once: pick where the holes are when it opens.' },
    { id: 'cubes', code: 'EX-18', name: 'Painted Cubes', kind: 'Cube counting', abilities: ['Vz'], note: 'DAT-style', blurb: 'Count the cubes in a painted stack that have exactly the number of painted sides asked.' },
    { id: 'form', code: 'EX-19', name: 'Form', kind: 'Pattern folding', abilities: ['Vz'], note: 'DAT-style', blurb: 'Fold a flat pattern in your mind and pick the solid it makes.' },
  ];

  // One entry per id (a repeated catalog line never counts twice: RV-play-dat).
  function catalog() {
    var reg = PX.ex && typeof PX.ex.list === 'function' ? PX.ex.list('train') : [];
    var byId = {}, seen = {};
    reg.forEach(function (d) { byId[d.id] = d; });
    var out = CATALOG.filter(function (c) { return hasOwn.call(seen, c.id) ? false : (seen[c.id] = true); }).map(function (c) {
      var d = byId[c.id];
      if (!d) return c;
      delete byId[c.id];
      return { id: c.id, code: d.code, name: d.short || c.name, kind: c.kind || d.name, abilities: d.abilities.slice(), note: c.note, blurb: c.blurb, def: d };
    });
    Object.keys(byId).forEach(function (id) {
      var d = byId[id];
      out.push({ id: id, code: d.code, name: d.short || d.name, kind: d.name, abilities: d.abilities.slice(), blurb: '', def: d });
    });
    return out;
  }
  // The training exercises the Library lists (its "N training exercises"): the registered ones.
  function count() { return catalog().filter(function (e) { return !!e.def; }).length; }
  function entry(id) {
    var list = catalog();
    for (var i = 0; i < list.length; i++) if (list[i].id === id) return list[i];
    return { id: id, code: '', name: id, kind: '', abilities: [] };
  }
  function specOf(e) { return PX.ui.kit.spec([e.code, e.kind, e.abilities.join(' ')]); }

  /* ---------- dates ---------- */

  var DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  var MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  var WEEK_LETTERS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
  var WEEK_NAMES = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

  function isoWeek(d) {
    var t = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
    var day = t.getUTCDay() || 7;
    t.setUTCDate(t.getUTCDate() + 4 - day);
    var y0 = new Date(Date.UTC(t.getUTCFullYear(), 0, 1));
    return Math.ceil(((t - y0) / 86400000 + 1) / 7);
  }
  function weekDays(now) {
    var d = new Date(now), key = U.dayKey(now);
    var start = U.addDays(key, -((d.getDay() + 6) % 7));
    var out = [];
    for (var i = 0; i < 7; i++) out.push(U.addDays(start, i));
    return out;
  }

  /* ---------- what the record says ---------- */

  // The weekly goal as the engine counts it (PX.engine.streak: a session counts with at least
  // 10 answers or 5 minutes), so Today, Progress and the summary always agree. week.days: one
  // flag per day, Monday first, set when that day has a session that counts.
  function weekStatus(rec, now) {
    var st = null;
    try { st = PX.engine.streak.status(rec, now); } catch (e) { st = null; }
    var w = st && st.week ? st.week : {};
    var goal = isFinite(w.goal) ? w.goal : rec.settings.weeklyGoal || 3, n = isFinite(w.sessions) ? w.sessions : 0;
    return { sessions: n, goal: goal, left: Math.max(0, goal - n), days: Array.isArray(w.days) ? w.days : [] };
  }
  function plural(n, one, many) { return n + ' ' + (n === 1 ? one : many); }
  /* ---------- slots ---------- */

  function sessionSlot(rec, now) {
    var K = PX.ui.kit;
    var plan = null;
    try { plan = PX.ui.home.plan(rec, now); } catch (e) { plan = null; }
    if (!plan || !plan.blocks || !plan.blocks.length) return noSession();
    var p = K.panel({
      title: 'Today’s session', level: 'h2', className: 'px-slot px-slot--session',
      aside: h('span.px-num', PX.core.clock.fmtMinutes(plan.minutes * 60000) + ' · ' + plan.mode + ' · ' + plan.style),
    });
    p.head.querySelector('.px-panel-title').classList.add('px-session-title');
    // Today's mix: the exercises take turns in runs, so the list has no order (I1 B5); a key mark
    // (data-seg) ties each one to its segment of the ruler.
    var list = h('ul.px-protocol', { 'aria-label': 'Exercises in today’s session (they take turns)' });
    plan.blocks.forEach(function (b, i) {
      var e = entry(b.ex);
      // An exercise not tried yet is "New", whatever slot the plan gave it (engine plan.roleOf).
      var isNew = b.isNew === true || (plan.roleOf && plan.roleOf[b.ex] === 'new') || /^New\b/.test(b.why || '');
      list.appendChild(h('li.px-protocol-step', { 'data-role': isNew ? 'new' : String(b.role || '').toLowerCase() },
        h('div.px-protocol-lead',
          h('span.px-protocol-n.is-key', { 'aria-hidden': 'true', 'data-seg': String(i + 1) }, '●'),
          h('span.px-protocol-role', isNew ? 'New' : b.role)),
        h('div.px-protocol-main',
          h('div.px-protocol-name', e.name),
          specOf(e),
          !isNew && b.why ? h('div.px-protocol-why', b.why) : null),
        h('span.px-protocol-time', { 'aria-label': 'about ' + b.min + ' minutes' }, '~' + PX.core.clock.fmtMinutes(b.min * 60000))));
    });
    p.body.appendChild(list);
    p.body.appendChild(ruler(plan));
    var focus = patFocusLine(plan);
    if (focus) p.body.appendChild(focus);
    var start = ui.button('Start today’s session', { kind: 'primary', go: 'play?mode=train' });
    start.setAttribute('data-primary', '');
    p.body.appendChild(h('div.px-session-actions', start,
      ui.button('Choose exercises', { kind: 'ghost', go: 'library' })));
    return p.el;
  }

  // Nothing to plan: every exercise is paused before a test or cannot run in this browser (or the
  // plan failed). Never a sample plan.
  function noSession() {
    var p = PX.ui.kit.panel({ title: 'Today’s session', level: 'h2', className: 'px-slot px-slot--session' });
    p.head.querySelector('.px-panel-title').classList.add('px-session-title');
    p.body.appendChild(h('p.px-slot-text', { 'data-plan': 'none' }, 'No session can be planned right now. Exercises paused before a test, and exercises this browser cannot show, stay out of the plan; the Library shows the state of each one.'));
    p.body.appendChild(h('div.px-session-actions', ui.button('Open the Library', { kind: 'primary', go: 'library' })));
    return p.el;
  }

  // The DAT-style focus says what it does to the plan (RV-play-dat: the switch seemed to do nothing).
  function patFocusLine(plan) {
    if (!plan.patFocus) return null;
    var has = plan.blocks.some(function (b) { var d = entry(b.ex).def; return b.pat === true || (!!d && d.pat === true); });
    return h('p.px-meta.px-plan-focus', { 'data-patfocus': has ? 'on' : 'none' }, has
      ? 'DAT-style focus is on: every session includes at least one DAT-style format, and the ones you have not tried come first. Switch it off in the Library or in Settings.'
      : 'DAT-style focus is on, but none of the DAT-style formats can run here right now.');
  }

  // The session as a ruler: one segment per block (its share of the time, keyed like the list's
  // marks; no numbers, since the runs take turns), minute ticks.
  function ruler(plan) {
    var total = plan.minutes;
    var track = h('div.px-ruler-track');
    plan.blocks.forEach(function (b, i) {
      track.appendChild(h('div', { class: ['px-ruler-seg', 'px-ruler-seg--' + (i + 1)], style: { flex: b.min + ' 1 0' }, 'data-seg': String(i + 1) }, h('span')));
    });
    var ticks = h('div.px-ruler-ticks');
    for (var m = 0; m <= total; m++) {
      var left = (m / total * 100).toFixed(3) + '%';
      var major = m % 5 === 0;
      ticks.appendChild(h('span', { class: ['px-ruler-tick', major ? 'is-major' : null], style: { left: left } }));
      if (major) ticks.appendChild(h('span', { class: ['px-ruler-num', m === 0 ? 'is-start' : m === total ? 'is-end' : null], style: { left: left } }, String(m)));
    }
    return h('div.px-ruler', { 'aria-hidden': 'true' }, track, ticks);
  }

  function dial(done, goal) {
    var root = S.svg(100, 100, { class: 'px-dial', width: 104, height: 104 });
    var n = Math.max(1, goal), gap = n > 1 ? 9 : 0, seg = (360 - n * gap) / n, r = 40;
    function pt(a) { var t = (a - 90) * Math.PI / 180; return (50 + r * Math.cos(t)).toFixed(2) + ' ' + (50 + r * Math.sin(t)).toFixed(2); }
    for (var i = 0; i < n; i++) {
      var a0 = i * (seg + gap) + gap / 2, a1 = a0 + seg;
      var d = n === 1 ? 'M50 10A40 40 0 1 1 49.99 10' : 'M' + pt(a0) + 'A40 40 0 ' + (seg > 180 ? 1 : 0) + ' 1 ' + pt(a1);
      root.appendChild(S.el('path', { class: 'px-dial-seg' + (i < done ? ' is-done' : ''), d: d }));
    }
    root.appendChild(S.text(50, 46, String(done), { class: 'px-dial-n' }));
    root.appendChild(S.text(50, 64, 'of ' + goal, { class: 'px-dial-of' }));
    root.setAttribute('role', 'img');
    root.removeAttribute('aria-hidden');
    root.setAttribute('aria-label', done + ' of ' + goal + ' sessions this week');
    return root;
  }

  function goalSlot(rec, now) {
    var K = PX.ui.kit;
    var days = weekDays(now), today = U.dayKey(now), ws = weekStatus(rec, now);
    var goal = ws.goal, done = ws.sessions, left = ws.left;
    var p = K.panel({ title: 'Weekly goal', className: 'px-slot px-slot--goal', aside: 'week of ' + U.fmtDate(days[0], 'short') });
    p.body.appendChild(h('div.px-goal', dial(done, goal),
      h('p.px-goal-text',
        h('strong', left ? plural(left, 'more session', 'more sessions') + ' this week' : 'Goal reached this week'),
        left ? 'Your goal is ' + goal + ' a week. Any days work.' : 'Extra sessions still count in your log.')));
    var week = h('ol.px-week', { 'aria-label': 'Days practised this week' });
    days.forEach(function (k, i) {
      var did = !!ws.days[i], isToday = k === today;
      week.appendChild(h('li', { class: ['px-day', did ? 'is-done' : null, isToday ? 'is-today' : null] },
        h('span.px-day-k', { 'aria-hidden': 'true' }, WEEK_LETTERS[i]),
        h('span.px-day-box', { 'aria-hidden': 'true' }, did ? K.icon('check') : null),
        h('span.px-sr', WEEK_NAMES[i] + (isToday ? ', today' : '') + (did ? ': practised' : ': not practised'))));
    });
    p.body.appendChild(week);
    var wk = null;
    try { wk = PX.engine.streak.status(rec, now).week; } catch (e) { wk = null; }
    if (wk && wk.ms > 0) p.body.appendChild(h('p.px-meta', { 'data-practice': '' }, 'Practice this week: ', h('span.px-num', PX.core.clock.fmtMinutes(wk.ms)), '.'));
    p.body.appendChild(h('p.px-meta', { style: 'margin-top:var(--s3)' }, 'A session counts with 10 answers or 5 minutes of practice; a Spatial Check does not count. One missed week in every four is forgiven automatically.'));
    return p.el;
  }

  // The engine's own status (one local day boundary, the challenge number): I1 T6.
  function dailySlot(rec, now) {
    var K = PX.ui.kit, st = null;
    try { st = PX.engine.daily.status(rec, now); } catch (e) { st = null; }
    if (!st) st = { day: U.dayKey(now), number: null, done: false, partial: null, result: null };
    var res = st.result, part = st.partial, n = PX.engine.config.daily.items;
    var p = K.panel({ title: 'Daily Challenge', className: 'px-slot px-slot--daily', aside: st.number ? h('span.px-num', '#' + st.number) : null });
    var score = res && typeof res.right === 'number' && typeof res.n === 'number' ? res.right + ' of ' + res.n : null;
    p.body.appendChild(h('p.px-status', { 'data-daily': res ? 'done' : part ? 'partial' : 'open' },
      res ? 'Played today' + (score ? ': ' : '') : part ? 'Started: ' : 'Not played yet',
      score ? h('span.px-num', score) : part ? h('span.px-num', part.answered + ' of ' + part.n + ' answered') : null));
    p.body.appendChild(h('p.px-slot-text', 'The same ' + n + ' items for everyone on this date, with one scored attempt' +
      (part ? ' that goes on where you stopped.' : '. A new challenge comes at midnight.') + ' Compare notes in the Chimera Discord.'));
    p.body.appendChild(h('div.px-slot-foot', ui.button(res ? 'See today’s result' : part ? 'Go on with today’s challenge' : 'Play today’s challenge', { kind: 'secondary', go: 'play?mode=daily' })));
    return p.el;
  }

  // The next Spatial Check in words, for Today and Progress alike, from the engine's one rule
  // (PX.engine.assess.nextCheck): baselines 2 and 3 come 12 hours or more after the one before;
  // a regular check after 14 days and 8 practice sessions (10 answers or 5 minutes each).
  // → { kind, ready, status, text, label (null: nothing to start yet), dueAt }
  function checkStatus(rec, now) {
    var A = PX.engine.assess, C = PX.engine.config.assess, K = PX.ui.kit, nc = null;
    try { nc = A.nextCheck(rec, now); } catch (e) { nc = null; }
    if (!nc) nc = { ready: true, kind: 'B1', dueAt: now, daysLeft: 0, sessionsLeft: 0, why: '' };
    var at = K && K.fmtWhen ? K.fmtWhen(nc.dueAt) : U.fmtDate(nc.dueAt, 'long');
    var familiar = 'A second baseline takes up most of the gain that comes from knowing the test, so later changes mean more.';
    var out = { kind: nc.kind, ready: !!nc.ready, dueAt: nc.dueAt, status: '', text: '', label: null };
    if (nc.kind === 'B1') {
      out.status = 'Starting point not measured yet';
      out.text = 'Two baseline checks on tasks you never practise show where you started. Each takes 15 to 25 minutes and gives no feedback; the second comes 12 hours or more after the first.';
      out.label = 'Take baseline 1';
    } else if (nc.kind === 'B2' || nc.kind === 'B3') {
      var name = nc.kind === 'B2' ? 'Baseline 2' : 'Baseline 3';
      out.status = nc.ready ? name + ' is next' : name + ' from ' + at;
      out.text = (nc.kind === 'B2' ? familiar : nc.why) + ' It comes 12 hours or more after the one before' + (nc.ready ? '.' : ', so it opens then.');
      out.label = nc.ready ? 'Take ' + name.toLowerCase() : null;
    } else if (nc.kind === 'delayed') {
      out.status = 'A delayed check is due';
      out.text = nc.why;
      out.label = 'Take the delayed check';
    } else {
      var d = nc.daysLeft || 0, s = nc.sessionsLeft || 0, parts = [];
      if (d > 0) parts.push('in ' + plural(d, 'day', 'days'));
      if (s > 0) parts.push((d > 0 ? '' : 'after ') + plural(s, 'more session', 'more sessions'));
      out.status = nc.ready || !parts.length ? 'A Spatial Check is due' : 'Next check ' + parts.join(' and ');
      out.text = 'A check comes ' + C.everyDays + ' days and ' + C.everySessions + ' practice sessions (each with 10 answers or 5 minutes) after the last one. It compares your change with a control task and with what familiarity alone would give.';
      out.label = nc.ready ? 'Take the Spatial Check' : 'Take a check now';
    }
    return out;
  }

  function checkSlot(rec, now) {
    var K = PX.ui.kit, n = (rec.assess || []).length, cs = checkStatus(rec, now);
    var p = K.panel({ title: 'Spatial Check', className: 'px-slot px-slot--check', aside: h('span.px-num', n + (n === 1 ? ' check' : ' checks')) });
    p.body.appendChild(h('p.px-status', cs.status));
    p.body.appendChild(h('p.px-slot-text', cs.text));
    if (cs.label) p.body.appendChild(h('div.px-slot-foot', ui.button(cs.label, { kind: cs.ready ? 'secondary' : 'ghost', go: 'play?mode=check' })));
    return p.el;
  }

  function dataSlot() {
    var K = PX.ui.kit, store = PX.core.store;
    var p = K.panel({ title: 'Your data', className: 'px-slot px-slot--data' });
    var b = ui.button('Back up now', { kind: store.volatile ? 'primary' : 'secondary', onClick: function () { PX.ui.app.backup(); } });
    b.setAttribute('data-backup', '');
    p.body.appendChild(h('div.px-data-strip',
      h('div.px-data-strip-text',
        h('strong', K.storageText()),
        h('span', K.backupLine(), '. A backup is a file you can import again here or on another device.')),
      b));
    return p.el;
  }

  function realLevels(rec) {
    var est = PX.engine && PX.engine.est, out = [];
    catalog().forEach(function (e) {
      var st = rec.ex && rec.ex[e.id];
      if (!st || !(st.n > 0)) return;
      var row = { ex: e.id, n: st.n, last: st.last || 0 };
      try {
        if (est && typeof est.level === 'function' && e.def) {
          var lv = est.level(e.def, st);
          row.level = Math.round(lv.level); row.lo = Math.round(lv.lo); row.hi = Math.round(lv.hi);
          if (lv.settings && typeof lv.settings === 'string') row.settings = lv.settings;
        }
      } catch (err) { /* level unavailable: the row shows the trial count */ }
      out.push(row);
    });
    return out.sort(function (a, b) { return b.last - a.last; });
  }

  function levelRow(r) {
    var e = entry(r.ex), has = typeof r.level === 'number';
    var bar = has ? ui.bar(r.level, 100, { band: [r.lo, r.hi], label: e.name + ' level' }) : ui.bar(0, 100, { label: e.name + ' level' });
    if (has) bar.setAttribute('aria-valuetext', 'level ' + r.level + ', likely between ' + r.lo + ' and ' + r.hi);
    var num = has
      ? h('div.px-level-num', { 'aria-hidden': 'true' }, h('b', String(r.level)), h('span', r.lo + '–' + r.hi))
      : h('div.px-level-num', h('b', r.n ? r.n + ' trials' : 'Not started'));
    var set = [];
    if (r.settings) set.push('Handles ' + r.settings + '.');
    if (r.stage) set.push(' Path stage ' + r.stage + ' of 10.');
    return h('li', { class: ['px-level', has ? null : 'is-new'], 'data-ex': r.ex },
      h('div.px-level-name', h('b', e.name, e.note ? ' ' : null, e.note ? h('span.px-tag', e.note) : null),
        PX.ui.kit.spec([e.code, e.abilities.join(' ')])),
      h('div.px-level-bar', bar), num,
      set.length ? h('div.px-level-set', set.join('')) : null);
  }

  function levelsSlot(rec) {
    var K = PX.ui.kit;
    var hook = null;
    try { hook = PX.ui.home.levels(rec); } catch (e) { hook = null; }
    var rows = hook || realLevels(rec);
    var p = K.panel({ title: 'Exercise levels', className: 'px-slot px-slot--levels', aside: 'level 1–100, likely range' });
    if (rows.length) {
      var list = h('ul.px-levels');
      rows.slice(0, 5).forEach(function (r) { list.appendChild(levelRow(r)); });
      p.body.appendChild(list);
    } else {
      p.body.appendChild(h('p.px-slot-text', { 'data-empty': '' }, 'No levels yet: they appear after your first few items in an exercise, each with a range that narrows as you practise.'));
    }
    var n = count();
    p.body.appendChild(h('div.px-slot-foot', h('span.px-meta', { 'data-count': String(n) }, n + ' exercises in the Library'), ui.button('Open the Library', { kind: 'ghost', small: true, go: 'library' })));
    return p.el;
  }

  function achievementsSlot(rec) {
    var K = PX.ui.kit;
    var A = PX.engine && PX.engine.achievements;
    var items = Object.keys(rec.achievements || {}).map(function (id) {
      var meta = null;
      try { meta = A && typeof A.get === 'function' ? A.get(id) : null; } catch (e) { meta = null; }
      if (!meta && A && typeof A.get === 'function') return null; // an id from an older version: not shown
      return { name: (meta && meta.name) || id.replace(/[-_.]/g, ' '), desc: (meta && meta.desc) || '', date: rec.achievements[id] };
    }).filter(Boolean).sort(function (a, b) { return String(b.date).localeCompare(String(a.date)); });
    var p = K.panel({ title: 'Recent achievements', className: 'px-slot px-slot--achievements' });
    if (items.length) {
      var list = h('ul.px-ach');
      items.slice(0, 3).forEach(function (a) {
        list.appendChild(h('li', K.icon('award', 'px-ach-mark'),
          h('div', h('b', a.name), a.desc ? h('span', a.desc) : null, h('span.px-num', U.fmtDate(a.date, 'long')))));
      });
      p.body.appendChild(list);
    } else {
      p.body.appendChild(h('p.px-slot-text', { 'data-empty': '' }, 'No achievements yet: the first ones come with your first sessions. They mark skills and good practice, such as trying every exercise or taking two baselines.'));
    }
    return p.el;
  }

  /* ---------- the screen ---------- */

  function render(host) {
    var rec = PX.core.store.state, now = Date.now(), d = new Date(now);
    host.appendChild(h('div.px-screen-head',
      h('p.px-screen-meta', DAYS[d.getDay()] + ' ' + d.getDate() + ' ' + MONTHS[d.getMonth()] + ' ' + d.getFullYear() + ' · week ' + isoWeek(d)),
      h('h1', 'Today')));
    host.appendChild(h('div.px-today',
      sessionSlot(rec, now),
      goalSlot(rec, now),
      dailySlot(rec, now),
      levelsSlot(rec),
      checkSlot(rec, now),
      achievementsSlot(rec),
      dataSlot()));
  }

  PX.ui.home = {
    catalog: catalog,
    count: count,             // the training exercises the Library lists
    checkStatus: checkStatus, // the next Spatial Check in words (Today and Progress)
    weekStatus: weekStatus,   // the weekly goal as the engine counts it
    // Phase 3 hooks (Builder A): the real plan and levels from js/ui/play.js (engine data).
    plan: function (rec, now) { var P = PX.ui.play; return P && typeof P.homePlan === 'function' ? P.homePlan(rec, now) : null; },
    levels: function (rec) { var P = PX.ui.play; return P && typeof P.homeLevels === 'function' ? P.homeLevels(rec) : null; },
  };
  PX.ui.screens = PX.ui.screens || {};
  PX.ui.screens.home = { title: 'Today', render: render };
})(window.PX);
