/* PX.engine.achievements: a fixed list of 20 milestones for skill and good practice (PLAN §7;
   D §b). Each has visible criteria and a check over the learner record. No points, nothing for
   time spent, and no wording that declares a skill finished: names say what was done.
   Answers that stuttered or were skipped never count (only outcome 1 rows are read).

     DEFS                      [{ id, name, desc, kind: 'skill' | 'practice', check(ctx) }]
     context(rec, now) → ctx   everything the checks read, computed once
     check(rec, now)           marks newly earned ones in rec.achievements (ISO dates) → [new]
     list(rec, now)            every definition with { earned, progress: [x, of] } */
(function (PX) {
  'use strict';

  // Local references (globals are slow to look up inside Node's vm contexts used by the tests).
  var isArray = Array.isArray, isFin = isFinite, hasOwn = Object.prototype.hasOwnProperty;

  var U = PX.util;
  var E = PX.engine;
  var DAY = E.DAY;

  function isNum(x) { return typeof x === 'number' && isFin(x); }
  function isObj(x) { return !!x && typeof x === 'object' && !isArray(x); }
  function prog(x, of) { return { done: x >= of, progress: [Math.min(x, of), of] }; }

  function dimValueRight(ctx, exId, key, value) {
    var m = ctx.maxRight[exId];
    return !!m && isNum(m[key]) && m[key] >= value;
  }

  // Nothing for showing up: ids from older versions ('first-session', 'answers-1000',
  // 'daily-first', 'daily-seven') may still sit in records; get() returns null for them.
  var DEFS = [
    { id: 'all-exercises', kind: 'practice', name: 'Every exercise', desc: 'Practise every training exercise at least once.',
      check: function (c) { return c.trainIds.length ? prog(c.tried, c.trainIds.length) : prog(0, 1); } },
    { id: 'weekly-goal', kind: 'practice', name: 'Week done', desc: 'Meet your weekly goal.', check: function (c) { return prog(c.weeksMet, 1); } },
    { id: 'four-weeks', kind: 'practice', name: 'Four good weeks', desc: 'Meet your weekly goal in four weeks.', check: function (c) { return prog(c.weeksMet, 4); } },
    { id: 'twelve-days', kind: 'practice', name: 'Twelve days', desc: 'Practise on 12 different days within 90 days.', check: function (c) { return prog(c.days90, 12); } },
    { id: 'baseline-two', kind: 'practice', name: 'Starting point', desc: 'Take two baseline Spatial Checks.', check: function (c) { return prog(c.checks, 2); } },
    { id: 'checks-three', kind: 'practice', name: 'Three checks', desc: 'Take three Spatial Checks at least 12 days apart.', check: function (c) { return prog(c.spaced, 3); } },
    { id: 'delayed-check', kind: 'practice', name: 'What lasts', desc: 'Take a Spatial Check at least three weeks after your training slowed.', check: function (c) { return prog(c.delayed, 1); } },
    { id: 'both-strategies', kind: 'practice', name: 'Two ways to see it', desc: 'Report both strategies, whole and parts, on one exercise.', check: function (c) { return prog(c.bothStrategies, 1); } },
    { id: 'backup', kind: 'practice', name: 'Safe copy', desc: 'Download a backup of your progress.', check: function (c) { return prog(c.backup ? 1 : 0, 1); } },
    { id: 'threshold-run', kind: 'practice', name: 'Measured', desc: 'Complete a Threshold run.', check: function (c) { return prog(c.thresholds, 1); } },
    { id: 'path-3', kind: 'skill', name: 'Path stage 3', desc: 'Pass stage 3 of the Path on any exercise.', check: function (c) { return prog(c.pathTop >= 3 ? 1 : 0, 1); } },
    { id: 'path-10', kind: 'skill', name: 'Path stage 10', desc: 'Pass the last Path stage on any exercise.', check: function (c) { return prog(c.pathTop >= 10 ? 1 : 0, 1); } },
    { id: 'recheck-30', kind: 'skill', name: 'Still there after 30 days', desc: 'A passed Path stage holds at a recheck 30 days later.', check: function (c) { return prog(c.held30, 1); } },
    { id: 'level-50', kind: 'skill', name: 'Level 50', desc: 'Reach level 50 on an exercise once its level has settled.', check: function (c) { return prog(c.topLevel >= 50 ? 1 : 0, 1); } },
    { id: 'broad-base', kind: 'skill', name: 'Broad base', desc: 'Reach level 20 on every training exercise.',
      check: function (c) { return c.trainIds.length ? prog(c.level20, c.trainIds.length) : prog(0, 1); } },
    { id: 'top-tenth', kind: 'skill', name: 'Top tenth', desc: 'Answer an item right from the hardest tenth of an exercise’s range.', check: function (c) { return prog(c.hardest, 1); } },
    { id: 'track-five', kind: 'skill', name: 'Five at once', desc: 'Track five targets among ten spheres fully right.', check: function (c) { return prog(c.track5 ? 1 : 0, 1); } },
    { id: 'span-seven', kind: 'skill', name: 'Seven steps', desc: 'Recall a span of seven right.', check: function (c) { return prog(dimValueRight(c, 'span', 'len', 7) || dimValueRight(c, 'span', 'length', 7) ? 1 : 0, 1); } },
    { id: 'speed-session', kind: 'skill', name: 'Against the clock', desc: 'Finish a Speed session, its full time.', check: function (c) { return prog(c.speedSessions, 1); } },
    { id: 'new-best', kind: 'skill', name: 'New best block', desc: 'Beat your best whole block on an exercise.', check: function (c) { return prog(c.bestBeats, 1); } },
    // v1.1 (B7, R3 §9): good practice in Section mode, never a score
    { id: 'full-section', kind: 'practice', name: 'Full section', desc: 'Finish a full Section practice: reach every part and answer at least half of its items.', check: function (c) { return prog(c.fullSections, 1); } },
  ];

  function context(rec, now, need) {
    // the exercises of everyone's training: PAT-format exercises join only under the PAT focus
    // (v1.1), so "every exercise" never asks for them
    var trainDefs = PX.ex.list('train').filter(function (d) { return d.pat !== true; });
    var c = { now: now, trainIds: trainDefs.map(function (d) { return d.id; }) };
    var sessions = (isArray(rec.sessions) ? rec.sessions : []).filter(function (s) { return isObj(s) && (s.trials || 0) > 0; });
    c.sessions = sessions.length;
    var st = E.streak.status(rec, now);
    c.weeksMet = st.weeks.filter(function (w) { return w.met; }).length;
    var dset = {};
    // practice days: a Spatial Check alone is not practice (v1.1, as for the weekly goal)
    sessions.forEach(function (s) { if (isNum(s.start) && s.mode !== 'check' && now - s.start <= 90 * DAY && s.start <= now) dset[E.day(s.start)] = 1; });
    c.days90 = Object.keys(dset).length;
    var chs = E.assess.checks(rec);
    c.checks = chs.length;
    var spaced = 0, lastT = -Infinity;
    chs.forEach(function (ch) { var t = Date.parse(ch.date); if (t - lastT >= 12 * DAY) { spaced++; lastT = t; } });
    c.spaced = spaced;
    c.delayed = 0;
    var tr = sessions.filter(function (s) { return s.mode !== 'check' && s.mode !== 'daily'; }).map(function (s) { return s.start; }).sort(function (a, b) { return a - b; });
    chs.forEach(function (ch) {
      var t = Date.parse(ch.date), before = tr.filter(function (x) { return x < t; });
      if (before.length >= 4 && t - before[before.length - 1] >= 21 * DAY) c.delayed = 1;
    });
    var strat = {};
    (isArray(rec.strategies) ? rec.strategies : []).forEach(function (x) {
      if (!isObj(x)) return;
      var s = strat[x.exId] || (strat[x.exId] = {});
      s[x.strategy] = true;
    });
    c.bothStrategies = Object.keys(strat).some(function (k) { return strat[k].whole && strat[k].parts; }) ? 1 : 0;
    c.backup = !!(rec.settings && isNum(rec.settings.lastBackup) && rec.settings.lastBackup > 0);
    c.dailies = isObj(rec.daily) ? Object.keys(rec.daily).filter(function (k) { return isObj(rec.daily[k]) && rec.daily[k].partial !== true; }).length : 0;
    // complete runs only (v1.1 saves no others; a v1.0 record may hold stopped ones: fewer items
    // than the protocol has)
    c.thresholds = 0;
    var PR = E.threshold && E.threshold.PROTOCOLS ? E.threshold.PROTOCOLS : {};
    if (isObj(rec.mot)) Object.keys(rec.mot).forEach(function (k) {
      if (!isArray(rec.mot[k])) return;
      var need = hasOwn.call(PR, k) && isNum(PR[k].trials) ? PR[k].trials : 1;
      rec.mot[k].forEach(function (e) { if (isObj(e) && (e.complete === true || (e.complete === undefined && isNum(e.n) && e.n >= need))) c.thresholds++; });
    });
    c.pathTop = 0;
    c.held30 = 0;
    if (isObj(rec.path)) Object.keys(rec.path).forEach(function (id) {
      var p = rec.path[id];
      if (!isObj(p) || !isObj(p.passed)) return;
      Object.keys(p.passed).forEach(function (s) {
        c.pathTop = Math.max(c.pathTop, +s);
        if (isObj(p.passed[s]) && p.passed[s].maxHeld >= 30) c.held30 = 1;
      });
    });
    c.tried = 0; c.level20 = 0; c.topLevel = 0; c.rated = 0; c.bestBeats = 0;
    trainDefs.forEach(function (def) {
      var t = E.schedule.totals(rec, def);
      if (t.n > 0) c.tried++;
      c.rated += t.n;
      if (t.n > 0) {
        var lv = E.est.level(def, E.est.get(rec, def), { settings: false }), sd = E.est.get(rec, def).sd;
        if (sd <= 0.45 && lv.level > c.topLevel) c.topLevel = lv.level;
        if (sd <= 0.5 && lv.level >= 20) c.level20++;
      }
      var e = rec.ex && rec.ex[def.id];
      if (isObj(e) && isObj(e.best) && isObj(e.best.block) && e.best.block.beats >= 1) c.bestBeats = 1;
    });
    // a full Section run that ended by itself (every part done, or its clock ran out; not ended by the
    // player), with real practice in it: every part reached (an item of it shown) and at least half
    // of the items answered (B7; js/engine/section.js run summaries)
    c.fullSections = 0;
    var secRuns = isObj(rec.section) && isArray(rec.section.runs) ? rec.section.runs : [];
    secRuns.forEach(function (r) {
      if (!isObj(r) || r.size !== 'full' || (r.ended !== 'done' && r.ended !== 'time')) return;
      var parts = isArray(r.parts) ? r.parts : [];
      var reached = parts.length > 0 && parts.every(function (p) { return isObj(p) && (p.reached === true || (isNum(p.seen) && p.seen > 0)); });
      if (reached && isNum(r.answered) && isNum(r.n) && r.n > 0 && 2 * r.answered >= r.n) c.fullSections++;
    });
    c.speedSessions = 0;
    if (isObj(rec.timed)) Object.keys(rec.timed).forEach(function (id) {
      var t = rec.timed[id];
      // a Speed session that ran its full time (v1.1: the 5th value); a v1.0 entry with 10 answers
      if (isObj(t) && isArray(t.sessions)) t.sessions.forEach(function (x) {
        if (isArray(x) && (x.length > 4 ? x[4] === 1 : isNum(x[3]) && x[3] >= E.config.session.minTrials)) c.speedSessions++;
      });
      if (isObj(t) && isNum(t.n)) c.rated += t.n;
    });
    // Right answers by setting: the highest value reached per numeric dimension, and whether an
    // item from the hardest tenth of a range was answered right. Only read when needed.
    var sc = scanRows(rec, need);
    c.maxRight = sc.maxRight;
    c.hardest = sc.hardest;
    c.track5 = sc.track5;
    return c;
  }

  // Rows are read once per trials array; later calls continue from where they stopped.
  var scans = typeof WeakMap === 'function' ? new WeakMap() : null;
  function scanRows(rec, need) {
    var rows = isArray(rec.trials) ? rec.trials : [];
    var s = scans && scans.get(rows);
    if (!s || s.first !== rows[0] || s.n > rows.length) s = { n: 0, first: rows[0], maxRight: {}, hardest: 0, track5: 0 };
    if (need === false) return s;
    E.log.scan(rec, function (r, id, mode, ver) {
      if (r[5] !== 1 || mode === 'check' || !id) return;
      var def = PX.ex.get(id), p = def && def.role === 'train' && E.log.rowParams(def, r, ver);
      if (!p) return;
      var m = s.maxRight[id] || (s.maxRight[id] = {}), vals = {};
      def.dims.forEach(function (d) {
        var v = d.levels[p[d.key]];
        vals[d.key] = v;
        if (isNum(v) && !(m[d.key] >= v)) m[d.key] = v;
      });
      // Five targets only count among ten spheres: with fewer, five targets is the same task as
      // tracking the fewer distractors.
      if (id === 'track' && vals.targets >= 5 && vals.spheres >= 10) s.track5 = 1;
      if (!s.hardest) {
        var rg = E.model.range(def);
        if (def.difficulty(p) >= rg.min + 0.9 * (rg.max - rg.min) - 1e-9) s.hardest = 1;
      }
    }, s.n);
    s.n = rows.length;
    if (scans) scans.set(rows, s);
    return s;
  }

  var ROWS = { 'top-tenth': 1, 'track-five': 1, 'span-seven': 1 };

  function check(rec, now) {
    if (!isObj(rec.achievements)) rec.achievements = {};
    var have = rec.achievements, todo = DEFS.filter(function (d) { return !hasOwn.call(have, d.id); });
    if (!todo.length) return [];
    var ctx = context(rec, now, todo.some(function (d) { return ROWS[d.id]; }));
    var out = [];
    todo.forEach(function (d) {
      var r;
      try { r = d.check(ctx); } catch (e) { r = null; }
      if (r && r.done) {
        have[d.id] = new Date(now).toISOString();
        out.push({ id: d.id, name: d.name, desc: d.desc, kind: d.kind });
      }
    });
    return out;
  }

  function list(rec, now) {
    var ctx = context(rec, now, true), have = isObj(rec.achievements) ? rec.achievements : {};
    return DEFS.map(function (d) {
      var r;
      try { r = d.check(ctx); } catch (e) { r = { done: false, progress: [0, 1] }; }
      return { id: d.id, name: d.name, desc: d.desc, kind: d.kind, earned: hasOwn.call(have, d.id) ? have[d.id] : null, progress: r.progress };
    });
  }

  // One definition's display fields by id (Today's recent-achievements panel), or null.
  function get(id) {
    for (var i = 0; i < DEFS.length; i++) {
      if (DEFS[i].id === id) return { id: DEFS[i].id, name: DEFS[i].name, desc: DEFS[i].desc, kind: DEFS[i].kind };
    }
    return null;
  }

  E.achievements = { DEFS: DEFS, context: context, check: check, list: list, get: get };
  void U;
})(window.PX);
