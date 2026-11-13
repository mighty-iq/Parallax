/* PX.engine.modes: sessions for every mode on one learner record (PLAN §5, ARCHITECTURE §7).
   The engine never reads the clock or storage: every call takes `now` (ms), and functions that
   change the record say so. The UI saves the record (store.save()) after answer() and finish().

     plan = modes.start(rec, mode, opts)   mode: train | path | speed | threshold | free | daily | check
       opts: now (required), minutes, display ('small' | 'large'), style, policy ('high' | 'low'),
             can(def) → bool (exercises this device can run), pin (Train focus), exId (Path,
             Speed, Free), params / deadlineMs / trials (Free), protocol (Threshold), optional (Check),
             variant (Speed and the deadline protocol keep to one variant: this one, else the first)
       plan.unavailable: a sentence when the mode cannot run now (then plan.done is true)
     The clock (v1.1): next, answer and finish take an optional last argument t = { activeMs } (the
     player's active-time clock, PX.core.clock). Train, Path, Speed and Free play without a set
     length are time-boxed on that active time: an easier closing item comes when about one item
     (at the session's own pace) is left, or right after an item that ran past the budget; the
     item count is only a safety cap that extends itself when the player is fast. Without t (tests, the
     simulations) active time is the sum of the gaps between answers up to 90 s each, as in v1.0.
     finish's t may also carry ended ('early' | 'closed': the player ended it or the page closed;
     else 'complete' when the plan reached its end) and session extras { viewport, input }.
     step = modes.next(plan, rec, now)     { done:false, exId, params, seed, kind, pPred, target,
             stage, banner, newRun, switched, watch, deadlineMs, feedback, ... } or { done:true }
             The UI builds the item: PX.ex.get(step.exId).generate(PX.rng(step.seed), step.params)
     out = modes.answer(plan, rec, step, result, now)   result { correct, rt, value?, outcome? }
             outcome 'stutter' | 'skipped' | 'voided', or fallback: true (an item built by an
             exercise's last-resort construction): logged only, never rated or scored, and the
             item is replaced; timeout: true (or outcome 'timeout') is scored wrong
             → { row, outcome, rated, rating?, blockEnd?, stageBack?, path?, deadlineMs?, done }
             blockEnd { exId, before, after, block: { n, right, reached } }: levels from est.shown
             The trial row is appended to rec.trials here.
     res = modes.finish(plan, rec, now)    pushes the session, updates schedules, bests, streak,
             achievements → { session, summary, stageUps, bests, achievements, streak, ... }
   Ratings: Train and Path update the untimed rating, Speed its own timed rating; Threshold,
   Free play, Daily and the Spatial Check never change a rating. */
(function (PX) {
  'use strict';

  // Local references (globals are slow to look up inside Node's vm contexts used by the tests).
  var isArray = Array.isArray, isFin = isFinite, hasOwn = Object.prototype.hasOwnProperty;

  var U = PX.util;
  var E = PX.engine;
  var C = E.config;
  var M = E.model;
  var MODES = {};
  var RATED = { train: true, path: true, speed: true };

  function isNum(x) { return typeof x === 'number' && isFin(x); }
  function isObj(x) { return !!x && typeof x === 'object' && !isArray(x); }
  function defOf(id) { return PX.ex.get(id); }

  function sessionMinutes(rec) {
    var m = rec.settings && rec.settings.sessionMin;
    return isNum(m) && m > 0 ? m : C.session.minutes;
  }

  function sessionId(rec, now) {
    return 's' + Math.floor(now).toString(36) + '-' + E.select.eng(rec).seedN.toString(36);
  }

  // The level shown for an exercise in this session (est.shown: no idle drift, so the start, the
  // block ends and the summary read one scale and change only with answers).
  function levelNow(rec, def, plan) {
    return E.est.shown(rec, def, { display: plan.display, timed: plan.mode === 'speed' });
  }

  function start(rec, mode, opts) {
    opts = opts || {};
    if (!hasOwn.call(MODES, mode)) throw new Error('PX.engine.modes.start: unknown mode ' + JSON.stringify(mode));
    if (!isNum(opts.now)) throw new Error('PX.engine.modes.start: opts.now (ms since 1970) is required');
    var now = opts.now;
    E.select.pageSalt(now); // fixed by the first plan of this page load
    E.select.syncSeeds(rec);
    var t = E.schedule.train(rec);
    var style = typeof opts.style === 'string' && hasOwn.call(C.styles, opts.style) ? opts.style : t.style;
    var plan = {
      id: sessionId(rec, now), mode: mode, start: now, display: opts.display === 'small' ? 'small' : 'large',
      style: style, k: M.styleK(style),
      policy: opts.policy === 'low' || opts.policy === 'high' ? opts.policy : t.variability,
      budgetMs: Math.max(60000, (isNum(opts.minutes) ? opts.minutes : sessionMinutes(rec)) * 60000),
      total: 0, pos: 0, extra: 0, done: false, lastServed: false, avgMs: 0,
      exs: [], count: {}, rated: {}, log: [], shown: {}, level0: {}, blockN: {}, blocks: {}, stage: {},
      lastEx: null, lastAt: now, activeMs: 0, deck: [], can: typeof opts.can === 'function' ? opts.can : null,
      rng: E.select.rng(rec, 'plan:' + mode + ':' + now), unavailable: null, finished: null, stageBacks: [],
      clocked: false, lastActive: 0, paces: [], boxed: false, natural: false, ended: null,
    };
    MODES[mode].start(plan, rec, opts, now);
    plan.boxed = isNum(plan.budgetMs) && plan.budgetMs !== Infinity;
    if (!plan.unavailable && !plan.exs.length) plan.unavailable = 'No exercise is available for this mode on this device.';
    if (plan.unavailable) plan.done = true;
    if (RATED[mode] && !plan.done) {
      plan.exs.forEach(function (id) {
        var def = defOf(id);
        if (!def) return;
        var lv = levelNow(rec, def, plan);
        plan.shown[id] = lv;
        plan.level0[id] = lv;
        plan.blockN[id] = 0;
      });
    }
    return plan;
  }

  function effTotal(plan) {
    return plan.total + Math.min(plan.extra, Math.ceil(plan.total * C.session.extraShare));
  }

  // The player's active-time clock reading (t.activeMs) moves the plan's clock forward.
  function clockIn(plan, t) {
    if (t && isNum(t.activeMs) && t.activeMs >= 0) {
      plan.clocked = true;
      if (t.activeMs > plan.activeMs) plan.activeMs = t.activeMs;
    }
  }

  // This session's own pace: the median active time between its last answers (3 or more), else null.
  function paceOf(plan) {
    var p = plan.paces;
    return p && p.length >= 3 ? U.median(p) : null;
  }

  // A time-boxed plan that runs out of planned items while time is left plans more: as many as
  // the time left holds at this session's pace, up to one item per C.session.minItemMs (a safety cap).
  function extend(plan, msPer) {
    if (!plan.boxed || !(msPer > 0)) return false;
    var left = Math.max(0, plan.budgetMs - plan.activeMs);
    var cap = Math.max(C.session.minTrials, Math.ceil(plan.budgetMs / C.session.minItemMs));
    var want = Math.min(cap, plan.pos + Math.ceil(left / msPer) + 2);
    if (want <= plan.total) return false;
    plan.total = want;
    if (plan.quota && plan.shares) plan.quota = E.schedule.quotas(plan.exs, plan.exs.map(function (id) { return plan.shares[id] || 0; }), want);
    plan.extended = (plan.extended || 0) + 1;
    return true;
  }

  // 'over' (no more items), 'last' (serve the closing item now) or null. Time-boxed plans end on
  // active time: the easier closing item comes once about one item is left (at this session's
  // pace, else msPer), so the session ends near its budget, and at the latest right after the
  // item during which the budget ran out. The warm-ups and one more item always come first.
  function atEnd(plan, now, msPer) {
    if (plan.lastServed) return 'over';
    if (plan.boxed) {
      var m = paceOf(plan) || msPer || plan.avgMs || 0, warm = plan.pos > C.session.warmup;
      if (warm && plan.activeMs + m >= plan.budgetMs) return 'last';
      if (plan.pos >= effTotal(plan) - 1) extend(plan, m || 9000);
      return plan.pos >= effTotal(plan) ? 'over' : null;
    }
    var total = effTotal(plan);
    if (plan.pos >= total) return 'over';
    if (plan.pos === total - 1) return 'last';
    return null;
  }

  // Active time left in a time-boxed plan (ms; Infinity when it ends by its item count).
  function timeLeft(plan, t) {
    clockIn(plan, t);
    return plan.boxed ? Math.max(0, plan.budgetMs - plan.activeMs) : Infinity;
  }

  // 80 % target, 10 % easier, 10 % stretch, dealt from shuffled decks of 10; two warm-ups first.
  function kindFor(plan) {
    if (plan.pos < C.session.warmup) return 'warmup';
    if (!plan.deck.length) {
      var nE = Math.round(10 * C.mix.easy), nS = Math.round(10 * C.mix.stretch), d = [], i;
      for (i = 0; i < 10 - nE - nS; i++) d.push('target');
      for (i = 0; i < nE; i++) d.push('easy');
      for (i = 0; i < nS; i++) d.push('stretch');
      plan.deck = plan.rng.shuffle(d);
    }
    return plan.deck.pop();
  }

  function makeStep(plan, rec, def, r, kind, extra) {
    var seed = extra && isNum(extra.seed) ? extra.seed : E.select.seed(rec);
    if (!(extra && extra.noNote)) E.select.note(rec, def, r.cand);
    var step = {
      done: false, i: plan.pos, mode: plan.mode, sessionId: plan.id, exId: def.id, params: r.params,
      key: r.key, code: r.code, seed: seed, kind: kind, b: r.b, g: r.g, pPred: r.p, target: r.target,
      stage: null, banner: false, newRun: false, switched: plan.lastEx !== null && plan.lastEx !== def.id,
      watch: false, deadlineMs: null, feedback: true, timed: false, weak: !!r.weak,
    };
    if (extra) for (var k in extra) if (hasOwn.call(extra, k) && k !== 'seed' && k !== 'noNote') step[k] = extra[k];
    plan.pos += 1;
    plan.lastEx = def.id;
    return step;
  }

  function next(plan, rec, now, t) {
    if (plan.done) return { done: true, reason: plan.unavailable || 'finished' };
    if (!isNum(now)) now = plan.lastAt;
    clockIn(plan, t);
    var step = MODES[plan.mode].next(plan, rec, now);
    if (!step) { plan.done = true; plan.natural = true; return { done: true, reason: 'finished' }; }
    return step;
  }

  function answer(plan, rec, step, result, now, t) {
    if (!step || step.done) throw new Error('PX.engine.modes.answer: needs a step from next()');
    if (step.answered) return step.answered; // a second call for the same step changes nothing
    if (!isNum(now)) now = plan.lastAt;
    var def = defOf(step.exId);
    var oc = E.log.outcome(result);
    // the display class of the row: the player's (result.display), else the plan's
    var res1 = result && typeof result === 'object' && result.display === undefined ? Object.assign({}, result, { display: plan.display }) : result;
    var row = E.log.append(rec, E.log.row(rec, def, plan.mode, step, oc, res1, now));
    var dt;
    clockIn(plan, t);
    if (plan.clocked) dt = plan.activeMs - plan.lastActive;
    else { // no clock: the gaps between answers, up to 90 s each (v1.0)
      dt = now - plan.lastAt;
      if (dt > 0 && dt <= C.session.maxGapMs) plan.activeMs += dt; else dt = 0;
    }
    if (dt > 0) { // this session's pace (time-boxed plans predict their last item from it)
      plan.paces.push(dt);
      if (plan.paces.length > 10) plan.paces.shift();
    }
    plan.lastActive = plan.activeMs;
    plan.lastAt = Math.max(plan.lastAt, now);
    var out = { row: row, outcome: oc, rated: false, p: step.pPred, blockEnd: null, done: false };
    plan.log.push({ exId: step.exId, kind: step.kind, oc: oc, rt: row[6], p: step.pPred, target: step.target, b: step.b, g: step.g, stage: step.stage, sw: !!step.switched, i: step.i, code: step.code });
    if (oc === 2 || oc === 3) {
      plan.extra += 1;
      if (step.kind === 'last') plan.lastServed = false;
      if (MODES[plan.mode].void) MODES[plan.mode].void(plan, rec, step);
    } else {
      plan.count[step.exId] = (plan.count[step.exId] || 0) + 1;
      var tl = plan.rated[step.exId] || (plan.rated[step.exId] = { n: 0, right: 0, rt: [] });
      tl.n += 1;
      if (oc === 1) { tl.right += 1; if (row[6] !== null) tl.rt.push(row[6]); }
      MODES[plan.mode].answer(plan, rec, step, oc === 1, result, now, out);
      if (out.rated && RATED[plan.mode]) {
        plan.blockN[step.exId] = (plan.blockN[step.exId] || 0) + 1;
        if (plan.blockN[step.exId] >= 10) { // shown levels change only at block ends
          var after = levelNow(rec, def, plan), blk = lastRated(plan, step.exId, 10);
          var right = blk.filter(function (x) { return x.oc === 1; }).length;
          var reached = right / 10 >= M.target(U.mean(blk.map(function (x) { return x.g; })), C.levelRef) - 1e-9;
          out.blockEnd = { exId: step.exId, before: plan.shown[step.exId] || null, after: after, block: { n: 10, right: right, reached: reached } };
          (plan.blocks[step.exId] || (plan.blocks[step.exId] = [])).push({ level: after.level, exact: after.exact, right: right, reached: reached, at: now });
          plan.shown[step.exId] = after;
          plan.blockN[step.exId] = 0;
        }
      }
    }
    var M2 = MODES[plan.mode];
    out.done = plan.done || (M2.over ? M2.over(plan) : atEnd(plan, now, 0) === 'over');
    if (out.done) plan.natural = true;
    step.answered = out;
    return out;
  }

  // The last n rated answers of an exercise in this plan (its latest block).
  function lastRated(plan, exId, n) {
    var out = [];
    for (var i = plan.log.length - 1; i >= 0 && out.length < n; i--) {
      var x = plan.log[i];
      if (x.exId === exId && (x.oc === 0 || x.oc === 1)) out.unshift(x);
    }
    return out;
  }

  function finish(plan, rec, now, t) {
    if (plan.finished) return plan.finished;
    if (!isNum(now)) now = plan.lastAt;
    clockIn(plan, t);
    // how it ended: the plan's own end, else the player's word ('early': ended on purpose;
    // 'closed': the page closed); without a word, an unfinished plan ended early
    plan.ended = plan.natural ? 'complete' : t && (t.ended === 'closed' || t.ended === 'early') ? t.ended : 'early';
    plan.done = true;
    var res = {
      mode: plan.mode, unavailable: plan.unavailable, stageUps: [], stageBacks: plan.stageBacks.slice(),
      session: null, summary: null, bests: [], achievements: [], streak: null,
    };
    if (!plan.unavailable && MODES[plan.mode].finish) MODES[plan.mode].finish(plan, rec, now, res);
    var answered = 0, right = 0, exs = [];
    plan.log.forEach(function (x) {
      if (x.oc !== 0 && x.oc !== 1) return;
      answered++;
      if (x.oc === 1) right++;
      if (exs.indexOf(x.exId) < 0) exs.push(x.exId);
    });
    if (answered > 0) {
      res.summary = E.stats.summary(rec, plan, now);
      res.bests = E.stats.bests(rec, plan, now);
      var session = {
        id: plan.id, start: plan.start, end: Math.max(now, plan.start), mode: plan.mode, trials: answered, right: right,
        practiceMs: Math.round(plan.activeMs), exs: exs, summary: E.stats.compact(res.summary),
        display: plan.display, ended: plan.ended,
      };
      if (plan.boxed) session.budgetMs = Math.round(plan.budgetMs);
      var xs = t && isObj(t.session) ? t.session : null;
      if (xs && typeof xs.viewport === 'string') session.viewport = xs.viewport;
      if (xs && typeof xs.input === 'string') session.input = xs.input;
      if (!isArray(rec.sessions)) rec.sessions = [];
      rec.sessions.push(session);
      rec.practiceMs = (isNum(rec.practiceMs) ? rec.practiceMs : 0) + session.practiceMs;
      res.session = session;
    }
    res.streak = E.streak.status(rec, now);
    res.achievements = E.achievements.check(rec, now);
    plan.finished = res;
    return res;
  }

  /* ---------- Train ---------- */

  MODES.train = {
    start: function (plan, rec, opts, now) {
      var b = E.schedule.build(rec, {
        can: plan.can, style: plan.style, pin: opts.pin, minutes: plan.budgetMs / 60000, count: opts.count, display: plan.display,
      }, now);
      plan.exs = b.exs;
      plan.roles = b.roles;
      plan.roleOf = b.roleOf || {}; // id → 'focus' | 'review' | 'variety' | 'extra' | 'new' (untried)
      plan.quota = b.quota;
      plan.total = b.total;
      plan.stage = b.stage;
      plan.msPer = b.msPer;
      plan.shares = b.shares;
      plan.run = null;
      // "Train this exercise" (opts.pin): the pinned exercise opens the session, with the
      // warm-ups and its first block (schedule.nextRun), every time.
      plan.lead = opts.pin && b.roles.focus === String(opts.pin) ? b.roles.focus : null;
      plan.avgMs = 0;
      b.exs.forEach(function (id) { plan.avgMs += (b.shares[id] || 0) * (b.msPer[id] || 0); });
    },
    next: function (plan, rec, now) {
      for (var guard = 0; guard < 8 && plan.exs.length; guard++) {
        var end = atEnd(plan, now, plan.avgMs);
        if (end === 'over') return null;
        if (!plan.run || plan.run.left <= 0 || plan.exs.indexOf(plan.run.exId) < 0) E.schedule.nextRun(plan, rec);
        var run = plan.run, def = defOf(run.exId);
        var kind = end === 'last' ? 'last' : kindFor(plan);
        var r = null;
        if (def) {
          var st = E.est.get(rec, def, { display: plan.display }, now);
          var weakList = kind === 'target' && plan.rng.chance(C.weak.share) ? E.select.weak(rec, def) : null;
          var filter = run.variant !== undefined ? function (c) { return c.params.variant === run.variant; } : null;
          var o = { kind: kind, k: plan.k, policy: plan.policy, recent: E.select.recent(rec, def), filter: filter, weak: weakList, rng: plan.rng };
          r = E.select.pick(def, st, o);
          if (!r && filter) { o.filter = null; r = E.select.pick(def, st, o); }
        }
        if (!r) { // an exercise that cannot produce items leaves the session; never a dead end
          plan.exs = plan.exs.filter(function (id) { return id !== run.exId; });
          plan.run = null;
          continue;
        }
        var step = makeStep(plan, rec, def, r, kind, { stage: run.stage, banner: run.fresh ? run.banner : false, newRun: run.fresh });
        run.fresh = false;
        run.left -= 1;
        if (kind === 'last') plan.lastServed = true;
        return step;
      }
      return null;
    },
    answer: function (plan, rec, step, ok, result, now, out) {
      var def = defOf(step.exId);
      out.rating = E.est.rate(rec, def, step.params, ok, now, { display: plan.display, b: step.b, g: step.g });
      out.rated = true;
      var c = M.byKey(def, step.key);
      if (c) E.select.residual(rec, def, c, ok, step.pPred);
      if (step.switched && E.schedule.switchNote(rec, def.id, ok, step.pPred, plan.style)) {
        var s = E.schedule.stage(rec, def.id, plan.style);
        plan.stage[def.id] = s;
        plan.stageBacks.push({ exId: def.id, stage: s });
        out.stageBack = s;
      }
    },
    finish: function (plan, rec, now, res) {
      var back = {};
      plan.stageBacks.forEach(function (x) { back[x.exId] = true; });
      plan.exs.forEach(function (id) {
        var def = defOf(id), tl = plan.rated[id];
        if (!def || !tl || !tl.n) return;
        if (tl.n >= 5) E.schedule.practised(rec, def, now);
        if (back[id]) return; // not up and back down in the same session
        var up = E.schedule.stageUp(rec, def, plan.style, { display: plan.display });
        if (up) res.stageUps.push({ exId: id, stage: up });
      });
    },
  };

  /* ---------- Free play (never rated) ---------- */

  MODES.free = {
    start: function (plan, rec, opts, now) {
      var def = opts.exId ? defOf(opts.exId) : null;
      if (!def || def.role !== 'train' || (plan.can && !plan.can(def))) { plan.unavailable = 'Choose an exercise to play.'; return; }
      plan.exs = [def.id];
      if (opts.params) {
        var p = U.deepCopy(opts.params);
        if (def.variants && p.variant === undefined) p.variant = def.variants[0];
        var ok = PX.ex.validParams(def, p);
        if (ok !== true) { plan.unavailable = 'These settings are not valid: ' + ok + '.'; return; }
        plan.fixed = p;
      } else plan.fixed = null;
      plan.deadlineMs = isNum(opts.deadlineMs) && opts.deadlineMs > 0 ? Math.round(opts.deadlineMs) : null;
      plan.avgMs = E.schedule.trialMs(rec, def, E.schedule.trialTimes(rec), plan.fixed || E.schedule.typical(rec, def, { display: plan.display }, now, plan.k));
      if (isNum(opts.trials) && opts.trials > 0) { plan.total = Math.round(opts.trials); plan.budgetMs = Infinity; }
      else plan.total = Math.max(C.session.minTrials, Math.round(plan.budgetMs / plan.avgMs));
    },
    next: function (plan, rec, now) {
      var end = atEnd(plan, now, plan.avgMs);
      if (end === 'over') return null;
      var def = defOf(plan.exs[0]);
      var st = E.est.get(rec, def, { display: plan.display }, now);
      var r = plan.fixed ? E.select.fixed(def, st, plan.fixed) :
        E.select.pick(def, st, { kind: 'target', k: plan.k, policy: plan.policy, recent: E.select.recent(rec, def), rng: plan.rng });
      if (!r) return null;
      var step = makeStep(plan, rec, def, r, plan.fixed ? 'fixed' : 'target', {
        banner: plan.pos === 0, newRun: plan.pos === 0, deadlineMs: plan.deadlineMs, timed: !!plan.deadlineMs,
      });
      if (end === 'last') plan.lastServed = true;
      return step;
    },
    answer: function () { /* logged only: Free play never updates a rating (PLAN §5) */ },
  };

  /* ---------- Path: 10 gated stages per exercise ---------- */

  function pathState(rec, exId) {
    if (!isObj(rec.path)) rec.path = {};
    var p = rec.path[exId];
    if (!isObj(p)) p = rec.path[exId] = {};
    p.stage = isNum(p.stage) ? U.clamp(Math.round(p.stage), 1, C.path.stages) : 1;
    if (!isNum(p.ema)) p.ema = C.path.start;
    if (!isNum(p.items)) p.items = 0;
    if (p.gema !== undefined && !isNum(p.gema)) delete p.gema;
    if (!isObj(p.passed)) p.passed = {};
    if (!isObj(p.watched)) p.watched = {};
    return p;
  }

  // Stage s covers the s-th tenth of the exercise's difficulty range.
  function band(def, s) {
    var r = M.range(def), w = (r.max - r.min) / C.path.stages;
    return { s: s, lo: r.min + (s - 1) * w, hi: r.min + s * w, mid: r.min + (s - 0.5) * w };
  }

  var stageCache = typeof Map === 'function' ? new Map() : null;
  // The items of stage s: those inside its band; an empty band borrows the nearest items.
  function stageItems(def, s) {
    var ck = s + ':' + def.id + '@' + def.version;
    var hit = stageCache && stageCache.get(def);
    if (hit && hit[ck]) return hit[ck];
    var bd = band(def, s), list = M.pool(def);
    var inb = list.filter(function (c) { return c.b >= bd.lo - 1e-9 && c.b <= bd.hi + 1e-9; });
    if (!inb.length) {
      var dmin = Infinity;
      list.forEach(function (c) { dmin = Math.min(dmin, Math.abs(c.b - bd.mid)); });
      inb = list.filter(function (c) { return Math.abs(c.b - bd.mid) <= dmin + 0.25; });
    }
    var keys = {};
    inb.forEach(function (c) { keys[c.key] = true; });
    var out = { list: inb, keys: keys, band: bd };
    if (stageCache) { if (!hit) stageCache.set(def, hit = {}); hit[ck] = out; }
    return out;
  }
  function inStage(def, s) { var k = stageItems(def, s).keys; return function (c) { return k[c.key] === true; }; }
  function upTo(def, s) {
    var k = stageItems(def, s).keys, hi = band(def, s).hi;
    return function (c) { return c.b <= hi + 1e-9 || k[c.key] === true; };
  }
  function gateT(def) { return M.target(M.refChance(def), C.path.gateK); }
  // The level the moving average must reach: the same moving average of each answered item's
  // own threshold g + (1 − g)·0.80, so items with different guessing rates (Spin and Rotate
  // variants, a probe's question types) each count against their own chance level. With one
  // guessing rate it equals gateT exactly.
  function gateOf(def, ps) { return ps && ps.items > 0 && isNum(ps.gema) ? ps.gema : gateT(def); }

  // Mean chance-corrected predicted success over the stage's items.
  function stageModel(def, s, st) {
    var list = stageItems(def, s).list, sum = 0;
    list.forEach(function (c) { sum += (M.pExp(st.mu, st.sd, c.b, c.g) - c.g) / (1 - c.g); });
    return list.length ? sum / list.length : 0;
  }

  function dueRechecks(rec, def, now) {
    var ps = rec.path && rec.path[def.id], out = [];
    if (!isObj(ps) || !isObj(ps.passed)) return out;
    for (var k in ps.passed) {
      var x = ps.passed[k];
      if (hasOwn.call(ps.passed, k) && isObj(x) && isNum(x.next) && now >= x.next) out.push({ s: +k, over: now - x.next });
    }
    return out.sort(function (a, b) { return b.over - a.over || a.s - b.s; }).map(function (x) { return x.s; });
  }

  function preset(def, s) { return E.est.settingsAt(def, band(def, s).hi); }

  // Pass: at least 10 items at the stage, the moving average at the gate, and the rating's
  // expected chance-corrected success over the stage's items ≥ 0.80 (pExp averages over the
  // rating's uncertainty, so an unsure rating needs a larger margin).
  function gate(rec, def, ps, plan, now) {
    var P = C.path;
    if (ps.items < P.minItems || ps.ema < gateOf(def, ps)) return false;
    var st = E.est.get(rec, def, { display: plan.display }, now);
    return stageModel(def, ps.stage, st) >= P.modelK;
  }
  // Stretch items may come from the next stage too: once a learner is well above a stage its
  // items say little, and a harder item keeps the rating informed.
  function stretchOf(def, s) {
    var a = stageItems(def, s).keys, b = s < C.path.stages ? stageItems(def, s + 1).keys : a;
    return function (c) { return a[c.key] === true || b[c.key] === true; };
  }

  function findRecheck(plan, s) {
    for (var i = 0; i < plan.rechecks.length; i++) if (plan.rechecks[i].s === s) return plan.rechecks[i];
    return null;
  }

  MODES.path = {
    start: function (plan, rec, opts, now) {
      var defs = PX.ex.list('train').filter(function (d) { return !plan.can || plan.can(d); });
      var def = null;
      if (opts.exId) {
        def = defs.filter(function (d) { return d.id === opts.exId; })[0] || null;
        if (!def) { plan.unavailable = 'This exercise is not available here.'; return; }
      } else {
        // no exercise chosen: an automatic choice (CONTRACT-v1.1 H5)
        defs = defs.filter(function (d) { return E.schedule.auto(rec, d, now); });
        var due = null, recent = null, at = -Infinity;
        defs.forEach(function (d) {
          if (!due && dueRechecks(rec, d, now).length) due = d;
          var ps = rec.path && rec.path[d.id];
          if (isObj(ps) && isNum(ps.lastAt) && ps.lastAt > at) { at = ps.lastAt; recent = d; }
        });
        def = due || recent || defs[0] || null;
      }
      if (!def) return;
      plan.exs = [def.id];
      var ps = pathState(rec, def.id);
      plan.rechecks = dueRechecks(rec, def, now).slice(0, 2).map(function (s) { return { s: s, left: C.path.recheckItems, n: 0 }; });
      plan.avgMs = E.schedule.trialMs(rec, def, E.schedule.trialTimes(rec), E.schedule.typical(rec, def, { display: plan.display }, now, plan.k));
      plan.total = Math.max(C.session.minTrials, Math.round(plan.budgetMs / plan.avgMs));
      plan.pathStage0 = ps.stage;
      plan.pathPassed = [];
    },
    next: function (plan, rec, now) {
      var end = atEnd(plan, now, plan.avgMs);
      if (end === 'over') return null;
      var def = defOf(plan.exs[0]), ps = pathState(rec, def.id), rc = null, s, kind, filter;
      for (var i = 0; i < plan.rechecks.length && end !== 'last'; i++) if (plan.rechecks[i].left > 0) { rc = plan.rechecks[i]; break; }
      if (rc) { s = rc.s; kind = 'target'; filter = inStage(def, s); }
      else {
        s = ps.stage;
        kind = end === 'last' ? 'last' : kindFor(plan);
        filter = kind === 'warmup' || kind === 'easy' || kind === 'last' ? upTo(def, s) : kind === 'stretch' ? stretchOf(def, s) : inStage(def, s);
      }
      var st = E.est.get(rec, def, { display: plan.display }, now);
      var o = { kind: kind, k: plan.k, policy: plan.policy, recent: E.select.recent(rec, def), filter: filter, rng: plan.rng };
      var r = E.select.pick(def, st, o);
      if (!r) { o.filter = null; r = E.select.pick(def, st, o); }
      if (!r) return null;
      var watch = false;
      if (!rc && !ps.watched[s]) { ps.watched[s] = true; watch = true; }
      if (rc) rc.left -= 1;
      var step = makeStep(plan, rec, def, r, kind, {
        pathStage: s, recheck: rc ? s : null, watch: watch, banner: plan.pos === 0, newRun: plan.pos === 0,
        preset: watch ? preset(def, s) : null,
      });
      if (end === 'last') plan.lastServed = true;
      return step;
    },
    void: function (plan, rec, step) {
      var rc = step.recheck ? findRecheck(plan, step.recheck) : null;
      if (rc) rc.left += 1;
    },
    answer: function (plan, rec, step, ok, result, now, out) {
      var def = defOf(step.exId), P = C.path;
      out.rating = E.est.rate(rec, def, step.params, ok, now, { display: plan.display, b: step.b, g: step.g });
      out.rated = true;
      var c = M.byKey(def, step.key);
      if (c) E.select.residual(rec, def, c, ok, step.pPred);
      var ps = pathState(rec, def.id);
      ps.lastAt = now;
      if (step.recheck) {
        var rc = findRecheck(plan, step.recheck);
        if (!rc) return;
        rc.n += 1;
        if (rc.n < P.recheckItems || rc.left > 0) return;
        var st = E.est.get(rec, def, { display: plan.display }, now);
        var held = stageModel(def, rc.s, st) >= P.holdK;
        var x = isObj(ps.passed[rc.s]) ? ps.passed[rc.s] : (ps.passed[rc.s] = { at: now, iv: 0, held: true, maxHeld: 0, last: null });
        var days = P.recheckDays, iv = isNum(x.iv) ? U.clamp(Math.round(x.iv), 0, days.length - 1) : 0;
        if (held) {
          x.held = true;
          x.maxHeld = Math.max(isNum(x.maxHeld) ? x.maxHeld : 0, days[iv]);
          x.iv = Math.min(iv + 1, days.length - 1);
        } else { x.held = false; x.iv = 0; }
        x.next = now + days[x.iv] * E.DAY;
        x.last = now;
        out.path = { recheck: rc.s, held: held };
        return;
      }
      if (step.pathStage !== ps.stage || step.kind === 'warmup') return;
      var thr = M.target(isNum(step.g) ? step.g : M.refChance(def), P.gateK);
      ps.gema = ps.items > 0 && isNum(ps.gema) && ps.gema !== thr ? P.decay * ps.gema + (1 - P.decay) * thr : thr;
      ps.ema = P.decay * ps.ema + (1 - P.decay) * (ok ? 1 : 0);
      ps.items += 1;
      if (ps.passed[ps.stage]) return; // the top stage, already passed: practice continues
      if (gate(rec, def, ps, plan, now)) {
        var s = ps.stage;
        ps.passed[s] = { at: now, iv: 0, next: now + P.recheckDays[0] * E.DAY, held: true, maxHeld: 0, last: null };
        out.path = { passed: s };
        plan.pathPassed.push(s);
        if (s < P.stages) { ps.stage = s + 1; ps.ema = P.start; ps.items = 0; delete ps.gema; out.path.stage = s + 1; }
        else out.path.top = true;
      }
    },
    finish: function (plan, rec, now, res) {
      var def = defOf(plan.exs[0]);
      if (!def) return;
      var tl = plan.rated[def.id];
      if (tl && tl.n >= 5) E.schedule.practised(rec, def, now);
      var ps = pathState(rec, def.id);
      res.path = {
        exId: def.id, stage: ps.stage, passed: plan.pathPassed.slice(), ema: ps.ema, items: ps.items, gate: gateOf(def, ps),
        rechecks: plan.rechecks.map(function (r) { var x = ps.passed[r.s]; return { s: r.s, n: r.n, held: isObj(x) ? x.held : null }; }),
        preset: preset(def, ps.stage),
      };
    },
  };

  /* ---------- Speed: deadline staircase, own timed rating ---------- */

  function timedState(rec, exId) {
    if (!isObj(rec.timed)) rec.timed = {};
    var t = rec.timed[exId];
    if (!isObj(t)) t = rec.timed[exId] = {};
    if (!isArray(t.sessions)) t.sessions = [];
    return t;
  }

  // Median correct response time on untimed trials (Train, Path, Free) of this exercise.
  function untimedRt(rec, def) {
    var rts = [], rows = isArray(rec.trials) ? rec.trials : [];
    E.log.scan(rec, function (r, id, mode) {
      if (id === def.id && r[5] === 1 && isNum(r[6]) && (mode === 'train' || mode === 'path' || mode === 'free')) rts.push(r[6]);
    }, Math.max(0, rows.length - 5000));
    rts = rts.slice(-50);
    return rts.length >= 5 ? U.median(rts) : C.speed.defaultRtMs;
  }

  function speedOpen(rec, def, opts) {
    var ps = rec.path && rec.path[def.id];
    if (isObj(ps) && isObj(ps.passed) && Object.keys(ps.passed).length) return { ok: true, why: 'A Path stage is passed.' };
    var st = E.est.get(rec, def, opts);
    if (st.n >= C.speed.unlockTrials && st.sd <= C.speed.unlockSd) return { ok: true, why: C.speed.unlockTrials + ' trials with a settled level.' };
    return {
      ok: false,
      why: 'Speed opens once a Path stage is passed, or after ' + C.speed.unlockTrials + ' trials with a settled level (' + st.n + ' so far).',
    };
  }

  // A deadline staircase aims at one success level, so a timed session keeps to one guessing
  // rate: the chosen variant (opts.variant), else the first, and that variant's most common
  // rate (Spin and Rotate answer differently per variant; a rate may also vary with params).
  function timedGroup(def, variant) {
    var list = M.pool(def), v = null, n = {}, g = null;
    if (def.variants) {
      v = def.variants.indexOf(variant) >= 0 ? variant : def.variants[0];
      list = list.filter(function (c) { return c.params.variant === v; });
    }
    list.forEach(function (c) { n[c.g] = (n[c.g] || 0) + 1; });
    list.forEach(function (c) { if (g === null || n[c.g] > n[g]) g = c.g; });
    return { variant: v, g: g === null ? M.refChance(def) : g };
  }

  // A deadline's target: the style's, at most 0.70 above chance, so it stays below the items'
  // untimed success (Comfortable's 0.85 would equal the fluency bar and push deadlines up).
  function speedTarget(plan) { return M.target(plan.tg.g, Math.min(plan.k, C.speed.maxK)); }

  // Items from settings answered at least 85 % right above chance untimed, g + (1 − g)·0.85 (the
  // deadline is the challenge); among them the pick aims halfway to the ceiling.
  function fluentPick(plan, rec, def, now) {
    var u = E.est.get(rec, def, { display: plan.display }, now), fk = C.speed.fluentK, tg = plan.tg;
    var same = tg ? function (c) { return c.g === tg.g && (tg.variant === null || c.params.variant === tg.variant); } : null;
    var o = {
      kind: 'target', k: (fk + 1 - C.lapse) / 2, policy: plan.policy, recent: E.select.recent(rec, def), rng: plan.rng,
      filter: function (c) { return (!same || same(c)) && M.pExp(u.mu, u.sd, c.b, c.g) >= M.target(c.g, fk); },
    };
    var r = E.select.pick(def, u, o);
    if (!r) { o.filter = same; o.k = 1; r = E.select.pick(def, u, o); }
    if (!r && same) { o.filter = null; r = E.select.pick(def, u, o); }
    return r;
  }

  MODES.speed = {
    start: function (plan, rec, opts, now) {
      var def = opts.exId ? defOf(opts.exId) : null, S = C.speed;
      if (!def || def.role !== 'train' || (plan.can && !plan.can(def))) { plan.unavailable = 'Choose an exercise for Speed.'; return; }
      var open = speedOpen(rec, def, { display: plan.display });
      if (!open.ok) { plan.unavailable = open.why; return; }
      plan.exs = [def.id];
      var tm = timedState(rec, def.id);
      var slot = E.est.slot(rec, def, { timed: true, display: plan.display });
      if (!(slot.n > 0)) { // the timed rating starts from the untimed one, a little wider
        var u = E.est.get(rec, def, { display: plan.display });
        slot.mu = u.mu;
        slot.sd = Math.max(u.sd, 0.8);
      }
      if (!isNum(tm.refRt) || tm.refRt <= 0) tm.refRt = Math.round(untimedRt(rec, def));
      if (!isNum(tm.unlocked)) tm.unlocked = now;
      plan.tg = timedGroup(def, opts.variant);
      // the last deadline carries over within a variant; another variant starts afresh
      var sameV = (typeof tm.variant === 'string' ? tm.variant : null) === plan.tg.variant;
      var d0 = sameV && isNum(tm.deadline) && tm.deadline > 0 ? tm.deadline * Math.pow(10, 0.1) : S.startFactor * tm.refRt;
      plan.sc = E.staircase.create({
        rule: 'weighted', p: speedTarget(plan), dir: -1, step: S.step, double: false,
        x0: Math.log10(U.clamp(d0, S.minDeadline, S.maxDeadline)), min: Math.log10(S.minDeadline), max: Math.log10(S.maxDeadline), trials: 1e9,
      });
      plan.refRt = tm.refRt;
      plan.timedLog = [];
      // A timed item lasts at most its deadline (plus feedback), far less than an untimed one.
      var untimed = E.schedule.trialMs(rec, def, E.schedule.trialTimes(rec), E.schedule.typical(rec, def, { display: plan.display }, now, plan.k));
      plan.avgMs = Math.max(1000, Math.min(untimed, Math.pow(10, E.staircase.value(plan.sc)) + C.session.overheadMs));
      plan.total = Math.max(C.session.minTrials, Math.round(plan.budgetMs / plan.avgMs));
    },
    next: function (plan, rec, now) {
      var end = atEnd(plan, now, plan.avgMs);
      if (end === 'over') return null;
      var def = defOf(plan.exs[0]), r = fluentPick(plan, rec, def, now);
      if (!r) return null;
      var deadline = Math.round(Math.pow(10, E.staircase.value(plan.sc)));
      var bt = r.b + C.speed.perHalving * Math.log(plan.refRt / deadline) / Math.LN2;
      var tst = E.est.get(rec, def, { display: plan.display, timed: true }, now);
      var step = makeStep(plan, rec, def, r, 'timed', { deadlineMs: deadline, timed: true, bTimed: bt, banner: plan.pos === 0, newRun: plan.pos === 0 });
      step.pPred = M.pExp(tst.mu, tst.sd, bt, r.g);
      step.target = plan.sc.p;
      if (end === 'last') plan.lastServed = true;
      return step;
    },
    answer: function (plan, rec, step, ok, result, now, out) {
      var def = defOf(step.exId);
      var rt = result && isNum(result.rt) ? result.rt : Infinity;
      var inTime = ok && !(result && result.timeout) && rt <= step.deadlineMs;
      E.staircase.step(plan.sc, inTime);
      out.rating = E.est.rate(rec, def, step.params, inTime, now, { display: plan.display, timed: true, b: step.bTimed, g: step.g });
      out.rated = true;
      out.inTime = inTime;
      out.deadlineMs = Math.round(Math.pow(10, E.staircase.value(plan.sc)));
      plan.timedLog.push([inTime ? 1 : 0, isFin(rt) ? rt : null, step.deadlineMs]);
    },
    finish: function (plan, rec, now, res) {
      var def = defOf(plan.exs[0]), tm = timedState(rec, def.id), L = plan.timedLog;
      tm.deadline = Math.round(Math.pow(10, E.staircase.value(plan.sc)));
      if (plan.tg.variant !== null) tm.variant = plan.tg.variant; else delete tm.variant;
      if (!L.length) return;
      var right = L.filter(function (x) { return x[0]; }), rts = right.map(function (x) { return x[1]; }).filter(isNum);
      var pc = right.length / L.length, rt = rts.length ? U.mean(rts) : null;
      // [day, share in time, mean right time, answers, 1 when the session ran its full time]
      tm.sessions.push([E.day(now), U.round(pc, 4), rt === null ? null : Math.round(rt), L.length, plan.ended === 'complete' ? 1 : 0]);
      if (tm.sessions.length > 200) tm.sessions.splice(0, tm.sessions.length - 200);
      var minutes = plan.activeMs / 60000;
      res.speed = {
        exId: def.id, variant: plan.tg.variant, deadlineMs: tm.deadline, pc: pc, rtMean: rt, n: L.length,
        rcs: minutes > 0 ? right.length / minutes : null, // correct answers in time per minute
        bis: E.stats.bis(tm.sessions, tm.sessions.length - 1),
        // S = (2x − 1)(1 − t/deadline) per answer (Klinkenberg et al. 2011): fast errors cost most
        points: U.round(U.sum(L.map(function (x) {
          var t = isNum(x[1]) ? Math.min(x[1], x[2]) : x[2];
          return (x[0] ? 1 : -1) * (1 - t / x[2]);
        })), 2),
      };
    },
  };

  /* ---------- Threshold: one parameter on a staircase (results in rec.mot) ---------- */

  // dim: candidate keys of the staircase dimension (the first the exercise has). preset: a
  // preset the exercise publishes in def.lib (Track: lib.STANDARD with level indexes and a start
  // level); otherwise `fixed` gives dimension values. An exercise that declares the extra param
  // '<dim>Value' takes the value itself, so the staircase runs on a continuous log10 scale and
  // the params also carry the nearest level (for the trial code). Track Standard follows
  // Legault, Allard & Faubert (2013): 8 spheres, 4 targets, 8 s, 2 s cue, 1-up/1-down in 0.05
  // log10 steps, 20 trials, threshold = geometric mean of the last 4 reversals.
  var PROTOCOLS = {
    'track-standard': { ex: 'track', dim: ['speed'], rule: 'standard', preset: 'STANDARD', fixed: { targets: 4, spheres: 8, time: 8, duration: 8 }, trials: 20, cueMs: 2000, unit: 'speed', label: 'Track standard: the speed tracked fully right half the time' },
    'track': { ex: 'track', dim: ['speed'], rule: 'weighted', preset: 'STANDARD', fixed: { targets: 4, spheres: 8, time: 8, duration: 8 }, trials: 20, cueMs: 2000, unit: 'speed', label: 'Track: the speed at your target success' },
    'span-length': { ex: 'span', dim: ['len', 'length'], rule: 'discrete', down: 2, trials: 20, unit: 'items', label: 'Span: the length recalled right 71 % of the time' },
    'spin-deadline': { ex: 'spin', rule: 'deadline', trials: 30, unit: 'ms', label: 'Spin: the response deadline at your target success' },
  };

  function numLevels(dim) { return dim.levels.every(function (v) { return isNum(v) && v > 0; }); }
  function nearestLevel(dim, value) {
    var best = 0, bd = Infinity;
    dim.levels.forEach(function (v, i) {
      var d = isNum(v) && isNum(value) ? Math.abs(v - value) : (String(v) === String(value) ? 0 : Infinity);
      if (d < bd) { bd = d; best = i; }
    });
    return best;
  }
  function nearestLog(dim, x) {
    var best = 0, bd = Infinity;
    dim.levels.forEach(function (v, i) { var d = Math.abs(Math.log10(v) - x); if (d < bd) { bd = d; best = i; } });
    return best;
  }

  function protocol(id) {
    var P = hasOwn.call(PROTOCOLS, id) ? PROTOCOLS[id] : null;
    if (!P) return { unavailable: 'Unknown protocol.' };
    var def = defOf(P.ex);
    if (!def) return { unavailable: 'This protocol needs the ' + P.ex + ' exercise.' };
    var out = { id: id, P: P, def: def, rule: P.rule, trials: P.trials, unit: P.unit, label: P.label, cueMs: P.cueMs || null };
    if (P.rule === 'deadline') return out;
    var dim = null;
    P.dim.forEach(function (k) { if (!dim) dim = def.dims.filter(function (d) { return d.key === k; })[0] || null; });
    if (!dim) return { unavailable: 'The ' + P.ex + ' exercise has no ' + P.dim.join(' or ') + ' setting.' };
    var pre = P.preset && def.lib && isObj(def.lib[P.preset]) ? def.lib[P.preset] : null;
    var base = {};
    if (pre && isObj(pre.params) && PX.ex.validParams(def, pre.params) === true) {
      for (var k in pre.params) if (hasOwn.call(pre.params, k)) base[k] = pre.params[k];
    } else {
      def.dims.forEach(function (d) { base[d.key] = P.fixed && hasOwn.call(P.fixed, d.key) ? nearestLevel(d, P.fixed[d.key]) : 0; });
      if (def.variants) base.variant = def.variants[0];
    }
    out.dim = dim;
    out.base = base;
    out.cueMs = pre && isNum(pre.cue) ? pre.cue * 1000 : out.cueMs;
    out.start = pre && isNum(pre.startLevel) ? pre.startLevel : null;
    if (out.rule !== 'discrete' && !numLevels(dim)) out.rule = 'discrete'; // named levels: step through them
    if (out.rule !== 'discrete') {
      out.cont = (def.extraParams || []).indexOf(dim.key + 'Value') >= 0 ? dim.key + 'Value' : null;
      var lv = dim.levels.map(function (v) { return Math.log10(v); });
      out.lo = Math.min.apply(null, lv);
      out.hi = Math.max.apply(null, lv);
      if (out.cont && def.lib) {
        if (isNum(def.lib.SPEED_MIN) && dim.key === 'speed') out.lo = Math.log10(def.lib.SPEED_MIN);
        if (isNum(def.lib.SPEED_MAX) && dim.key === 'speed') out.hi = Math.log10(def.lib.SPEED_MAX);
      }
      if (!out.cont) out.grid = lv;
    }
    return out;
  }

  // Staircase x → the protocol's unit (a level value, a list length, milliseconds).
  function xValue(pr, x) {
    if (pr.rule === 'discrete') {
      var L = pr.dim.levels, i = U.clamp(x, 0, L.length - 1), lo = Math.floor(i), hi = Math.ceil(i);
      return numLevels(pr.dim) ? L[lo] + (L[hi] - L[lo]) * (i - lo) : i;
    }
    return Math.pow(10, x);
  }

  // The last run's threshold (x); a deadline run looks only at runs on the same variant.
  function lastThreshold(rec, id, variant) {
    var list = isObj(rec.mot) && isArray(rec.mot[id]) ? rec.mot[id] : [];
    for (var i = list.length - 1; i >= 0; i--) {
      var e = list[i];
      if (isObj(e) && isNum(e.x) && (variant === undefined || (typeof e.variant === 'string' ? e.variant : null) === variant)) return e.x;
    }
    return null;
  }

  // The item for staircase value x: level params, plus the exact value for continuous protocols.
  function thresholdPick(plan, rec, now) {
    var pr = plan.protocol, def = pr.def, x = E.staircase.value(plan.sc), params = M.copyParams(pr.base);
    var st = E.est.get(rec, def, { display: plan.display }, now);
    if (pr.rule === 'discrete') params[pr.dim.key] = x;
    else if (pr.cont) params[pr.dim.key] = nearestLog(pr.dim, x);
    else params[pr.dim.key] = pr.grid.indexOf(x);
    var r = E.select.fixed(def, st, params);
    if (!r || !pr.cont) return r;
    r.params[pr.cont] = U.round(Math.pow(10, x), 6);
    r.b = def.difficulty(r.params);
    r.p = r.target = M.pExp(st.mu, st.sd, r.b, r.g);
    return r;
  }

  // The x (log10 of the level value) at which the rating predicts success p, by bisection on
  // the item difficulty (which rises with x); null without a settled rating.
  function ratedStart(rec, pr, p, plan) {
    var def = pr.def, st = E.est.get(rec, def, { display: plan.display });
    if (st.n < 10) return null;
    var g = def.chance(pr.base), want = M.bAt(st.mu, p, g);
    var b = function (x) {
      var prm = M.copyParams(pr.base);
      if (pr.cont) { prm[pr.dim.key] = nearestLog(pr.dim, x); prm[pr.cont] = Math.pow(10, x); }
      else prm[pr.dim.key] = nearestLog(pr.dim, x);
      return def.difficulty(prm);
    };
    var lo = pr.lo, hi = pr.hi;
    if (b(lo) >= want) return lo;
    if (b(hi) <= want) return hi;
    for (var i = 0; i < 40; i++) { var m = (lo + hi) / 2; if (b(m) < want) lo = m; else hi = m; }
    return (lo + hi) / 2;
  }

  MODES.threshold = {
    start: function (plan, rec, opts) {
      var pr = protocol(opts.protocol || 'track-standard');
      if (pr.unavailable) { plan.unavailable = pr.unavailable; return; }
      if (plan.can && !plan.can(pr.def)) { plan.unavailable = 'This exercise is not available on this device.'; return; }
      plan.exs = [pr.def.id];
      plan.protocol = pr;
      plan.total = pr.trials;
      plan.budgetMs = Infinity;
      if (pr.rule === 'deadline') plan.tg = timedGroup(pr.def, opts.variant);
      var last = lastThreshold(rec, pr.id, plan.tg ? plan.tg.variant : undefined);
      var p = M.target(pr.base ? pr.def.chance(pr.base) : M.refChance(pr.def), plan.k), o;
      if (pr.rule === 'deadline') {
        o = { rule: 'weighted', p: speedTarget(plan), dir: -1, trials: pr.trials, min: Math.log10(C.speed.minDeadline), max: Math.log10(C.speed.maxDeadline),
          x0: last !== null ? last + 0.1 : Math.log10(C.speed.startFactor * untimedRt(rec, pr.def)) };
      } else if (pr.rule === 'discrete') {
        o = { rule: 'discrete', down: pr.P.down || 2, trials: pr.trials, min: 0, max: pr.dim.levels.length - 1,
          x0: last !== null ? Math.max(0, Math.round(last) - 1) : 0 };
      } else {
        var x0 = last !== null ? last - 0.1 : pr.start !== null && pr.dim.levels[pr.start] ? Math.log10(pr.dim.levels[pr.start]) : pr.lo + 0.25 * (pr.hi - pr.lo);
        // A first training run starts where the rating predicts the target success (the
        // standard protocol keeps its published start, for comparison with the research).
        if (last === null && pr.rule === 'weighted') { var xr = ratedStart(rec, pr, p, plan); if (xr !== null) x0 = xr; }
        o = { rule: pr.rule, p: p, dir: 1, trials: pr.trials, x0: x0, min: pr.lo, max: pr.hi };
        if (pr.grid) o.grid = pr.grid;
      }
      plan.sc = E.staircase.create(o);
    },
    over: function (plan) { return plan.sc.n >= plan.total || plan.pos >= 2 * plan.total; },
    next: function (plan, rec, now) {
      if (MODES.threshold.over(plan)) return null; // voided trials are replaced, at most once each
      var pr = plan.protocol, def = pr.def, r, deadline = null;
      if (pr.rule === 'deadline') {
        r = fluentPick(plan, rec, def, now);
        deadline = Math.round(Math.pow(10, E.staircase.value(plan.sc)));
      } else r = thresholdPick(plan, rec, now);
      if (!r) return null;
      var x = E.staircase.value(plan.sc);
      return makeStep(plan, rec, def, r, 'threshold', {
        deadlineMs: deadline, timed: deadline !== null, banner: plan.pos === 0, newRun: plan.pos === 0, noNote: true,
        protocol: { id: pr.id, cueMs: pr.cueMs, x: x, value: xValue(pr, x), rule: pr.rule },
      });
    },
    answer: function (plan, rec, step, ok, result, now, out) {
      var good = ok;
      if (plan.protocol.rule === 'deadline') {
        var rt = result && isNum(result.rt) ? result.rt : Infinity;
        good = ok && !(result && result.timeout) && rt <= step.deadlineMs;
      }
      E.staircase.step(plan.sc, good);
      out.staircase = { x: E.staircase.value(plan.sc), n: plan.sc.n, reversals: plan.sc.rev.length };
      // No rating changes here: Threshold keeps its own series.
    },
    finish: function (plan, rec, now, res) {
      var pr = plan.protocol;
      if (!plan.sc.n) return;
      var th = E.staircase.threshold(plan.sc);
      // A run stopped before its end (ended by the player, or by a closed page) is no
      // measurement: reported, never saved (rec.mot holds complete runs only, for the Lab's history
      // and the "Measured" achievement). A run the protocol itself ended (all its items, or the cap
      // on replaced items) is complete; ok says whether its staircase settled.
      if (plan.ended !== 'complete') {
        res.threshold = { stopped: true, n: plan.sc.n, trials: plan.total, unit: pr.unit, rule: pr.rule, id: pr.id };
        return;
      }
      var entry = {
        date: new Date(now).toISOString(), threshold: U.round(xValue(pr, th.x), 4), x: U.round(th.x, 4), unit: pr.unit,
        n: th.n, reversals: th.reversals, ok: th.ok, method: th.method, atBound: th.atBound, rule: pr.rule, complete: true,
        p: U.round(plan.sc.p, 4), display: plan.display, variant: plan.tg ? plan.tg.variant : null,
        // every trial's exact value (speed, length or deadline) and outcome
        hist: plan.sc.hist.map(function (h) { return [U.round(xValue(pr, h[0]), 4), h[1]]; }),
      };
      if (!isObj(rec.mot)) rec.mot = { core: [] };
      if (!isArray(rec.mot[pr.id])) rec.mot[pr.id] = [];
      rec.mot[pr.id].push(entry);
      if (rec.mot[pr.id].length > 5000) rec.mot[pr.id].splice(0, rec.mot[pr.id].length - 5000);
      res.threshold = entry;
    },
  };

  /* ---------- Daily Challenge and Spatial Check (daily.js, assess.js) ---------- */

  MODES.daily = {
    start: function (plan, rec, opts, now) { E.daily.start(plan, rec, opts, now); },
    next: function (plan, rec, now) { return E.daily.next(plan, rec, now); },
    void: function (plan, rec, step) { E.daily.void(plan, rec, step); },
    over: function (plan) { return E.daily.over(plan); },
    answer: function (plan, rec, step, ok, result, now, out) { E.daily.answer(plan, rec, step, ok, result, now, out); },
    finish: function (plan, rec, now, res) { E.daily.finish(plan, rec, now, res); },
  };
  MODES.check = {
    start: function (plan, rec, opts, now) { E.assess.start(plan, rec, opts, now); },
    next: function (plan, rec, now) { return E.assess.next(plan, rec, now); },
    void: function (plan, rec, step) { E.assess.void(plan, rec, step); },
    over: function (plan) { return plan.check.probes.every(function (p) { return p.n >= p.items; }); },
    answer: function (plan, rec, step, ok, result, now, out) { E.assess.answer(plan, rec, step, ok, result, now, out); },
    finish: function (plan, rec, now, res) { E.assess.finish(plan, rec, now, res); },
  };

  /* ---------- strategy check-ins ---------- */

  var STRATEGIES = ['whole', 'parts', 'unsure'];

  // { exId, strategy, t }: 'whole' (imagine the whole object move) or 'parts' (compare features).
  function checkin(rec, exId, strategy, now) {
    if (STRATEGIES.indexOf(strategy) < 0 || !defOf(exId) || !isNum(now)) return false;
    if (!isArray(rec.strategies)) rec.strategies = [];
    rec.strategies.push({ exId: exId, strategy: strategy, t: now });
    if (rec.strategies.length > 1000) rec.strategies.splice(0, rec.strategies.length - 1000);
    return true;
  }

  // Ask after the 10th rated answer of an exercise in a Train or Path session, at most once per
  // exercise in 14 days. Never during a stimulus: the player asks between trials.
  function checkinDue(rec, plan, exId, now) {
    if (!plan || (plan.mode !== 'train' && plan.mode !== 'path')) return false;
    var tl = plan.rated[exId];
    if (!tl || tl.n !== C.session.checkinAfter) return false;
    var list = isArray(rec.strategies) ? rec.strategies : [];
    for (var i = list.length - 1; i >= 0; i--) {
      if (list[i] && list[i].exId === exId && now - list[i].t < C.session.checkinEvery * E.DAY) return false;
    }
    return true;
  }

  /* ---------- what can be played now (Today screen) ---------- */

  function available(rec, now, opts) {
    opts = opts || {};
    var defs = PX.ex.list('train').filter(function (d) { return !opts.can || opts.can(d); });
    var out = { train: defs.length > 0, free: defs.map(function (d) { return d.id; }), path: {}, speed: {}, threshold: {} };
    defs.forEach(function (d) {
      var ps = rec.path && rec.path[d.id];
      out.path[d.id] = { stage: isObj(ps) && isNum(ps.stage) ? ps.stage : 1, rechecks: dueRechecks(rec, d, now), preset: preset(d, isObj(ps) && isNum(ps.stage) ? ps.stage : 1) };
      out.speed[d.id] = speedOpen(rec, d, { display: opts.display });
    });
    Object.keys(PROTOCOLS).forEach(function (id) {
      var pr = protocol(id);
      out.threshold[id] = pr.unavailable ? { ok: false, why: pr.unavailable } : { ok: !opts.can || opts.can(pr.def), label: pr.label };
    });
    out.daily = E.daily.status(rec, now);
    out.check = E.assess.due(rec, now);
    return out;
  }

  /* ---------- engine-owned record fields ---------- */

  var F = E.fix;
  function fixRating(v) {
    var o = U.deepCopy(v);
    ['mu', 'sd', 'n', 'nRight', 'last'].forEach(function (k) { if (o[k] !== undefined && o[k] !== null && !isNum(o[k])) delete o[k]; });
    if (isNum(o.sd) && o.sd <= 0) delete o.sd;
    return o;
  }
  E.field('path', function () { return {}; }, function (v) {
    return F.map(v, function (p) {
      if (!isObj(p)) return undefined;
      var o = {
        stage: F.int(p.stage, 1, 10) || 1,
        ema: F.num(p.ema, 0, 1) !== undefined ? F.num(p.ema, 0, 1) : C.path.start,
        items: F.int(p.items, 0, 1e9) || 0,
        lastAt: F.time(p.lastAt) !== undefined ? p.lastAt : null,
        passed: F.map(p.passed, function (x) {
          if (!isObj(x) || F.time(x.at) === undefined) return undefined;
          return { at: x.at, iv: F.int(x.iv, 0, 10) || 0, next: F.time(x.next) !== undefined ? x.next : x.at, held: x.held !== false, maxHeld: F.num(x.maxHeld, 0, 1e4) || 0, last: F.time(x.last) !== undefined ? x.last : null };
        }, function (k) { return /^([1-9]|10)$/.test(k); }) || {},
        watched: F.map(p.watched, function (x) { return x === true ? true : undefined; }, function (k) { return /^([1-9]|10)$/.test(k); }) || {},
      };
      if (F.num(p.gema, 0, 1) !== undefined) o.gema = p.gema;
      return o;
    }, F.idKey);
  });
  E.field('timed', function () { return {}; }, function (v) {
    return F.map(v, function (t) {
      if (!isObj(t)) return undefined;
      var o = fixRating(t);
      if (isObj(t.small)) o.small = fixRating(t.small);
      o.sessions = F.list(t.sessions, function (s) { return isArray(s) && F.day(s[0]) && isNum(s[1]) ? s.slice(0, 5) : undefined; }, 200) || [];
      ['deadline', 'refRt', 'unlocked'].forEach(function (k) { if (o[k] !== undefined && !isNum(o[k])) delete o[k]; });
      if (o.variant !== undefined && !(typeof o.variant === 'string' && /^[A-Za-z][A-Za-z0-9_]{0,39}$/.test(o.variant))) delete o.variant;
      return o;
    }, F.idKey);
  });
  E.field('strategies', function () { return []; }, function (v) {
    return F.list(v, function (x) {
      return isObj(x) && F.id(x.exId) && STRATEGIES.indexOf(x.strategy) >= 0 && F.time(x.t) !== undefined ? { exId: x.exId, strategy: x.strategy, t: x.t } : undefined;
    }, 1000);
  });

  E.path = { state: pathState, band: band, items: stageItems, model: stageModel, gateT: gateT, gateOf: gateOf, due: dueRechecks, preset: preset };
  E.speed = { open: speedOpen, state: timedState, untimedRt: untimedRt };
  E.threshold = { PROTOCOLS: PROTOCOLS, protocol: protocol, value: xValue };

  E.modes = {
    start: start, next: next, answer: answer, finish: finish, MODES: MODES, RATED: RATED,
    available: available, checkin: checkin, checkinDue: checkinDue, STRATEGIES: STRATEGIES,
    timeLeft: timeLeft, pace: paceOf,
    _: { atEnd: atEnd, kindFor: kindFor, makeStep: makeStep, levelNow: levelNow, effTotal: effTotal, defOf: defOf, timedGroup: timedGroup, extend: extend, clockIn: clockIn },
  };
})(window.PX);
