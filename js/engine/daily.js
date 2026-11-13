/* PX.engine.daily: the Daily Challenge (PLAN §5), a community game, not a mode of training.
   The same 8 items for everyone on a date: exercises and seeds come from the date alone, at a
   fixed medium difficulty (the combination nearest the middle of each exercise's range).
   Since v1.1 the date is the local one, the same day boundary as everything else in Parallax
   (everyone plays challenge #N on their own date N, as with other daily puzzles).
   Exercises whose difficulty depends on the screen (perDisplay: Track, Homing, Reckon) and
   PAT-format exercises are left out, so the challenge is the same on every device and for
   everyone. One scored attempt a day; replays are practice. The scored attempt is spent only
   when all its items are answered: an attempt left part-way (End now, a reload, a closed tab)
   is kept as { partial: true } and goes on where it stopped the next time it is opened that day.
   Items never change a rating. Seeds are shared seeds (≥ 2^31), never equal to training seeds.

     day(now) → 'YYYY-MM-DD' (local)     number(day) → N (#1 on 1 Nov 2026)
     items(day) → [{ exId, params, seed, index }]
     share(number, right, n) → 'Parallax Daily #N · x/8 · discord.gg/chmr'
     status(rec, now) → { day, number, done, partial, result, share }
     start / next / answer / void / over / finish: called by modes ('daily') */
(function (PX) {
  'use strict';

  // Local references (globals are slow to look up inside Node's vm contexts used by the tests).
  var isArray = Array.isArray, isFin = isFinite, hasOwn = Object.prototype.hasOwnProperty;

  var E = PX.engine;
  var C = E.config;
  var M = E.model;

  function isNum(x) { return typeof x === 'number' && isFin(x); }
  function isObj(x) { return !!x && typeof x === 'object' && !isArray(x); }

  function day(now) { return E.day(now); } // the local date, as everywhere else
  function utcNum(key) {
    var p = String(key).split('-');
    return Math.round(Date.UTC(+p[0], +p[1] - 1, +p[2]) / E.DAY);
  }
  function number(key) { return utcNum(key) - utcNum(C.daily.epoch) + 1; }

  // The same pool for everyone (never a personal setting): no screen-dependent exercises and no
  // PAT-format exercises, which join practice only with the PAT focus (CONTRACT-v1.1 H5).
  function pool() {
    return PX.ex.list('train').filter(function (d) { return !d.perDisplay && d.pat !== true; });
  }

  function items(key) {
    var defs = pool();
    if (!defs.length) return [];
    var rng = PX.rng(PX.rng.hash('px-daily', key));
    var order = rng.shuffle(defs), out = [], used = {};
    for (var i = 0; i < C.daily.items; i++) {
      var def = order[i % order.length], r = M.range(def), mid = (r.min + r.max) / 2;
      var v = def.variants ? def.variants[rng.int(0, def.variants.length - 1)] : undefined;
      var c = M.nearest(def, mid, v === undefined ? null : function (x) { return x.params.variant === v; }) || M.nearest(def, mid);
      var seed = E.select.sharedSeed(PX.rng.hash('px-daily-seed', key, i));
      while (used[seed]) seed = E.select.sharedSeed(PX.rng.hash('px-daily-seed', key, i, seed));
      used[seed] = true;
      out.push({ exId: def.id, params: JSON.parse(JSON.stringify(c.params)), seed: seed, index: i });
    }
    return out;
  }

  function share(n, right, of) {
    return 'Parallax Daily #' + n + ' · ' + right + '/' + of + ' · ' + C.daily.link;
  }

  function isPartial(res) { return isObj(res) && res.partial === true; }

  // done: today's scored attempt is spent; partial: it was left part-way and goes on when opened.
  function status(rec, now) {
    var key = day(now), res = isObj(rec.daily) ? rec.daily[key] : null, part = isPartial(res);
    if (!isObj(res)) res = null;
    return {
      day: key, number: number(key), done: !!res && !part, partial: part ? res : null, result: res && !part ? res : null,
      share: res && !part ? share(number(key), res.right, res.n) : null,
    };
  }

  function start(plan, rec, opts, now) {
    var key = opts && typeof opts.day === 'string' ? opts.day : day(now);
    var list = items(key).filter(function (it) { var d = PX.ex.get(it.exId); return d && (!plan.can || plan.can(d)); });
    if (!list.length) { plan.unavailable = 'The Daily Challenge needs at least one exercise this device can run.'; return; }
    var prev = isObj(rec.daily) ? rec.daily[key] : null, part = isPartial(prev) && isArray(prev.outcomes);
    plan.daily = { day: key, number: number(key), items: list, at: 0, redo: [], right: 0, n: 0, outcomes: [], scored: !isObj(prev) || part, resumed: false };
    if (part) { // the scored attempt goes on: answered items keep their outcomes and are not shown again
      var D = plan.daily;
      list.forEach(function (it, i) {
        var o = prev.outcomes[i];
        if (o === 0 || o === 1) { D.outcomes[i] = o; D.n += 1; D.right += o; }
      });
      D.resumed = D.n > 0;
    }
    plan.exs = [];
    list.forEach(function (it) { if (plan.exs.indexOf(it.exId) < 0) plan.exs.push(it.exId); });
    plan.total = list.length;
    plan.budgetMs = Infinity;
  }

  function answered(D, i) { return D.outcomes[i] === 0 || D.outcomes[i] === 1; }

  function next(plan, rec, now) {
    var D = plan.daily, i = -1;
    while (D.redo.length && i < 0) { var r = D.redo.shift(); if (!answered(D, r)) i = r; }
    if (i < 0) {
      while (D.at < D.items.length && answered(D, D.at)) D.at++;
      if (D.at < D.items.length) i = D.at++;
    }
    if (i < 0) return null;
    var it = D.items[i], def = PX.ex.get(it.exId);
    var r = E.select.fixed(def, E.est.get(rec, def, { display: plan.display }, now), it.params);
    if (!r) return null;
    return E.modes._.makeStep(plan, rec, def, r, 'daily', {
      seed: it.seed, noNote: true, banner: true, newRun: true,
      daily: { day: D.day, number: D.number, index: i, of: D.items.length, scored: D.scored },
    });
  }

  // A stuttered or skipped item comes back (the same item: it is the same for everyone).
  function voidStep(plan, rec, step) { if (step.daily) plan.daily.redo.push(step.daily.index); }

  function answer(plan, rec, step, ok) {
    var D = plan.daily;
    D.n += 1;
    if (ok) D.right += 1;
    D.outcomes[step.daily.index] = ok ? 1 : 0;
  }

  // Every item answered (voided and skipped items come back, so this is the natural end).
  function over(plan) {
    var D = plan.daily;
    for (var i = 0; i < D.items.length; i++) if (!answered(D, i)) return false;
    return true;
  }

  function finish(plan, rec, now, res) {
    var D = plan.daily;
    if (!D || !D.n) return;
    var complete = over(plan);
    // outcomes per item: 1 right, 0 wrong, null not answered (never drawn as wrong)
    var outs = D.items.map(function (it, i) { return answered(D, i) ? D.outcomes[i] : null; });
    if (D.scored) {
      if (!isObj(rec.daily)) rec.daily = {};
      var entry = { n: D.items.length, answered: D.n, right: D.right, t: now, number: D.number, outcomes: outs };
      if (!complete) entry.partial = true;
      rec.daily[D.day] = entry;
    }
    res.daily = {
      day: D.day, number: D.number, right: D.right, n: D.items.length, answered: D.n, scored: D.scored, partial: !complete,
      outcomes: outs, share: complete ? share(D.number, D.right, D.items.length) : null,
    };
  }

  E.daily = { day: day, number: number, items: items, share: share, status: status, start: start, next: next, void: voidStep, answer: answer, over: over, finish: finish, pool: pool };
  void isNum;
})(window.PX);
