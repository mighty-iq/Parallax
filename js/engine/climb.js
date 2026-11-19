/* PX.engine.climb: the weekly Climb (v1.2, PLAN milestone 5; note G1 §2.6; ENGINE.md §24). Pure.
   A seeded ladder that renews every Monday (local weeks, as the weekly goal): 20 rungs, rung r at the
   combination nearest the quantile (r − 0.5)/20 of its exercise's range, exercises in an order drawn from
   the week and the attempt, untimed, from the Daily's frozen pool (no screen-dependent and no DAT-style
   exercises). A right answer clears the rung; a miss leaves a notch and the same rung comes again with
   another item; the second miss ends the run (one spare). Height = rungs cleared. Three attempts a week,
   A, B and C, each its own fixed seed set that is the same for everyone; the week's best counts. A run left
   part-way goes on where it stopped (as the Daily does). Items never change a rating. After the three
   attempts, more runs are practice and change nothing. A missed week costs nothing: nothing is counted
   across weeks but the personal best height.

   Record (rec.game.climb): { w: { '<Monday YYYY-MM-DD>': { A: { r, h, m, n: [rungs of the misses], p: 1 while
   part-way, t } , … } }, pb: { h, week, t } } (the last config.game.climb.keepWeeks weeks are kept).

     week(now) → Monday 'YYYY-MM-DD'     number(week) → N (#1 is the week of config.game.climb.epoch)
     item(week, attempt, rung, misses) → { exId, params, seed, rung, b }   (the same for everyone)
     state(rec, now) → { week, number, attempts: { A: entry | null, … }, best, left, partial, next, pb, last }
     mode 'climb' in E.modes.MODES: start (opts.attempt), next, void, answer, over, finish → res.climb */
(function (PX) {
  'use strict';

  var isArray = Array.isArray, isFin = isFinite, hasOwn = Object.prototype.hasOwnProperty;
  var U = PX.util;
  var E = PX.engine;
  var M = E.model;

  function C() { return E.config.game.climb; }
  function isNum(x) { return typeof x === 'number' && isFin(x); }
  function isObj(x) { return !!x && typeof x === 'object' && !isArray(x); }

  function week(now) { return E.streak.weekKey(E.day(now)); }
  function number(wk) { return Math.floor((U.dayNum(wk) - U.dayNum(E.streak.weekKey(C().epoch))) / 7) + 1; }
  function letters() { return C().attempts.slice(); }

  // The attempt's exercise order: the week's whole pool (the Daily's epoch of that Monday) shuffled by the
  // week and the attempt, the same on every device; `can` then leaves out what this device cannot show.
  function order(wk, attempt, can) {
    var defs = E.daily.poolFor(wk);
    var all = defs.length ? PX.rng(PX.rng.hash('px-climb', wk, attempt)).shuffle(defs) : [];
    return can ? all.filter(function (d) { return can(d); }) : all;
  }
  // Rung r's exercise comes from the whole order, so every device climbs the same rungs; on a device that
  // cannot show it, the next exercise in the order that it can show takes its place (item.swapped).
  function item(wk, attempt, rung, misses, can) {
    var list = order(wk, attempt, null);
    if (!list.length) return null;
    var R = C().rungs, at = (rung - 1) % list.length, j = 0;
    while (can && j < list.length && !can(list[(at + j) % list.length])) j++;
    if (j >= list.length) return null;
    var def = list[(at + j) % list.length], rg = M.range(def);
    var aim = rg.min + ((rung - 0.5) / R) * (rg.max - rg.min);
    var c = E.daily.nearestAt(def, aim, PX.rng(PX.rng.hash('px-climb-variant', wk, attempt, rung)));
    var seed = E.select.sharedSeed(PX.rng.hash('px-climb-seed', wk, attempt, rung, misses || 0));
    return { exId: def.id, params: JSON.parse(JSON.stringify(c.params)), seed: seed, rung: rung, b: c.b, swapped: j > 0 };
  }

  function slot(rec) {
    var g = E.game.game(rec), c = g.climb;
    if (!isObj(c.w)) c.w = {};
    return c;
  }
  function entryOk(x) { return isObj(x) && isNum(x.h) && isNum(x.m); }
  function state(rec, now) {
    var wk = week(now), c = isObj(rec.game) && isObj(rec.game.climb) ? rec.game.climb : {}, ws = isObj(c.w) ? c.w : {};
    var cur = isObj(ws[wk]) ? ws[wk] : {}, attempts = {}, best = null, left = 0, partial = null, next = null;
    letters().forEach(function (a) {
      var x = entryOk(cur[a]) ? cur[a] : null;
      attempts[a] = x;
      if (x && (best === null || x.h > best)) best = x.h;
      if (x && x.p === 1 && !partial) partial = a;
      if (!x || x.p === 1) left++;
      if (!next && (!x || x.p === 1)) next = a;
    });
    if (partial) next = partial;
    var prevWk = U.addDays(wk, -7), prev = isObj(ws[prevWk]) ? ws[prevWk] : null, last = null;
    if (prev) letters().forEach(function (a) { if (entryOk(prev[a]) && (last === null || prev[a].h > last)) last = prev[a].h; });
    var pb = isObj(c.pb) && isNum(c.pb.h) ? { h: c.pb.h, week: c.pb.week || null, t: c.pb.t || null } : null;
    return { week: wk, number: number(wk), attempts: attempts, best: best, left: left, partial: partial, next: next, pb: pb, last: last, rungs: C().rungs, spare: C().spare };
  }

  /* ---------- the mode (E.modes.MODES.climb; the player runs it like the Daily) ---------- */

  // After the week's attempts, a run is practice on items of its own (attempt 'P' with a salt from its start
  // time, so it never replays an attempt whose answers were seen); it is not stored, shared or rewarded.
  function start(plan, rec, opts, now) {
    var st = state(rec, now), want = opts && typeof opts.attempt === 'string' ? opts.attempt.toUpperCase() : null;
    if (want && letters().indexOf(want) < 0) want = null;
    var att = want || st.next || null, prev = att ? st.attempts[att] : null;
    var scored = !!att && (!prev || prev.p === 1);
    if (!scored) att = 'P' + Math.round(now).toString(36);
    if (!order(st.week, att, plan.can).length) { plan.unavailable = 'The Climb needs at least one exercise this device can run.'; return; }
    plan.climb = {
      week: st.week, number: st.number, attempt: att, scored: scored, R: C().rungs, spare: C().spare,
      rung: 1, height: 0, misses: 0, notches: [], resumed: false, answered: 0, weekBest: st.best, pb: st.pb ? st.pb.h : null,
    };
    if (scored && prev && prev.p === 1) { // a run left part-way goes on where it stopped
      var K = plan.climb;
      K.height = Math.max(0, Math.min(K.R, Math.round(prev.h)));
      K.rung = K.height + 1;
      K.misses = Math.max(0, Math.min(K.spare, Math.round(prev.m)));
      K.notches = isArray(prev.n) ? prev.n.filter(isNum).slice(0, K.spare + 1) : [];
      K.resumed = true;
    }
    plan.exs = [];
    order(st.week, att, plan.can).forEach(function (d) { if (plan.exs.indexOf(d.id) < 0) plan.exs.push(d.id); });
    plan.total = C().rungs + C().spare;
    plan.budgetMs = Infinity;
  }

  function over(plan) { var K = plan.climb; return !K || K.height >= K.R || K.misses > K.spare; }

  function next(plan, rec, now) {
    var K = plan.climb;
    if (over(plan)) return null;
    var it = item(K.week, K.attempt, K.rung, K.misses, plan.can), def = it && PX.ex.get(it.exId);
    if (!def) return null;
    if (it.swapped) { K.swapped = K.swapped || {}; K.swapped[K.rung] = 1; }
    var r = E.select.fixed(def, E.est.get(rec, def, { display: plan.display }, now), it.params);
    if (!r) return null;
    return E.modes._.makeStep(plan, rec, def, r, 'climb', {
      seed: it.seed, noNote: true, banner: true, newRun: true,
      climb: { week: K.week, number: K.number, attempt: K.attempt, rung: K.rung, of: K.R, misses: K.misses, spare: K.spare, scored: K.scored },
    });
  }

  // A stuttered or skipped item comes back unchanged: the rung and the misses decide the item.
  function voidStep() { /* nothing moves */ }

  // Each answer is written through (a run left by a reload or a closed tab goes on where it stopped);
  // finish() writes the final entry.
  function answer(plan, rec, step, ok, now) {
    var K = plan.climb;
    if (!K || !step.climb || step.climb.rung !== K.rung || step.climb.misses !== K.misses) return;
    K.answered += 1;
    if (ok) { K.height = K.rung; K.rung += 1; } else { K.misses += 1; K.notches.push(K.rung); }
    if (K.scored) {
      var c = slot(rec), w = c.w[K.week] || (c.w[K.week] = {});
      w[K.attempt] = { r: K.rung, h: K.height, m: K.misses, n: K.notches.slice(), p: 1, t: Math.round(isNum(now) ? now : 0) };
    }
  }

  function finish(plan, rec, now, res) {
    var K = plan.climb;
    if (!K || !K.answered) return;
    var complete = over(plan), c = slot(rec), wk = K.week, before = K.weekBest, pb0 = K.pb;
    if (K.scored) {
      var w = c.w[wk] || (c.w[wk] = {});
      var entry = { r: K.rung, h: K.height, m: K.misses, n: K.notches.slice(), t: Math.round(now) };
      if (!complete) entry.p = 1;
      w[K.attempt] = entry;
      if (!isObj(c.pb) || !isNum(c.pb.h) || K.height > c.pb.h) c.pb = { h: K.height, week: wk, t: Math.round(now) };
      var keep = Object.keys(c.w).filter(function (k) { return /^\d{4}-\d{2}-\d{2}$/.test(k); }).sort();
      while (keep.length > C().keepWeeks) delete c.w[keep.shift()];
    }
    var st = state(rec, now);
    res.climb = {
      week: wk, number: K.number, attempt: K.attempt, scored: K.scored, practice: !K.scored, height: K.height, misses: K.misses,
      notches: K.notches.slice(), rungs: K.R, spare: K.spare, complete: complete, partial: !complete, resumed: K.resumed,
      swapped: K.swapped ? Object.keys(K.swapped).length : 0, // rungs this device climbed on another exercise
      weekBest: st.best, weekBefore: before, pb: st.pb ? st.pb.h : null, pbBefore: pb0, left: st.left,
      newWeekBest: K.scored && complete && K.height > 0 && (before === null || K.height > before),
      newPb: K.scored && complete && K.height > 0 && (pb0 === null || K.height > pb0),
      summit: K.scored && complete && K.height >= K.R,
    };
  }

  if (E.modes && E.modes.MODES && !hasOwn.call(E.modes.MODES, 'climb')) {
    E.modes.MODES.climb = { start: start, next: next, void: voidStep, answer: function (plan, rec, step, ok, result, now) { answer(plan, rec, step, ok, now); }, over: over, finish: finish };
  }

  E.climb = { week: week, number: number, order: order, item: item, state: state, over: over, letters: letters, _: { start: start, next: next, answer: answer, finish: finish } };
})(window.PX);
