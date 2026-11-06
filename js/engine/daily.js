/* PX.engine.daily: the Daily Challenge (PLAN §5), a community game, not a mode of training.
   The same 8 items for everyone on a UTC date: exercises and seeds come from the date alone,
   at a fixed medium difficulty (the combination nearest the middle of each exercise's range).
   Exercises whose difficulty depends on the screen (perDisplay: Track, Homing) are left out,
   so the challenge is the same on every device. One scored attempt a day; replays are practice.
   Items never change a rating. Seeds are shared seeds (≥ 2^31), never equal to training seeds.

     day(now) → 'YYYY-MM-DD' (UTC)       number(day) → N (#1 on 1 Nov 2026)
     items(day) → [{ exId, params, seed, index }]
     share(number, right, n) → 'Parallax Daily #N · x/8 · discord.gg/chmr'
     status(rec, now) → { day, number, done, result }
     start / next / answer / void / finish: called by modes ('daily') */
(function (PX) {
  'use strict';

  // Local references (globals are slow to look up inside Node's vm contexts used by the tests).
  var isArray = Array.isArray, isFin = isFinite, hasOwn = Object.prototype.hasOwnProperty;

  var E = PX.engine;
  var C = E.config;
  var M = E.model;

  function isNum(x) { return typeof x === 'number' && isFin(x); }
  function isObj(x) { return !!x && typeof x === 'object' && !isArray(x); }

  function pad(n) { return (n < 10 ? '0' : '') + n; }
  function day(now) {
    var d = new Date(now);
    return d.getUTCFullYear() + '-' + pad(d.getUTCMonth() + 1) + '-' + pad(d.getUTCDate());
  }
  function utcNum(key) {
    var p = String(key).split('-');
    return Math.round(Date.UTC(+p[0], +p[1] - 1, +p[2]) / E.DAY);
  }
  function number(key) { return utcNum(key) - utcNum(C.daily.epoch) + 1; }

  function pool() {
    return PX.ex.list('train').filter(function (d) { return !d.perDisplay; });
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

  function status(rec, now) {
    var key = day(now), res = isObj(rec.daily) ? rec.daily[key] : null;
    return { day: key, number: number(key), done: !!res, result: res || null, share: res ? share(number(key), res.right, res.n) : null };
  }

  function start(plan, rec, opts, now) {
    var key = opts && typeof opts.day === 'string' ? opts.day : day(now);
    var list = items(key).filter(function (it) { var d = PX.ex.get(it.exId); return d && (!plan.can || plan.can(d)); });
    if (!list.length) { plan.unavailable = 'The Daily Challenge needs at least one exercise this device can run.'; return; }
    plan.daily = { day: key, number: number(key), items: list, at: 0, redo: [], right: 0, n: 0, outcomes: [], scored: !(isObj(rec.daily) && rec.daily[key]) };
    plan.exs = [];
    list.forEach(function (it) { if (plan.exs.indexOf(it.exId) < 0) plan.exs.push(it.exId); });
    plan.total = list.length;
    plan.budgetMs = Infinity;
  }

  function next(plan, rec, now) {
    var D = plan.daily, i = D.redo.length ? D.redo.shift() : D.at < D.items.length ? D.at++ : -1;
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

  function finish(plan, rec, now, res) {
    var D = plan.daily;
    if (!D || !D.n) return;
    if (D.scored) {
      if (!isObj(rec.daily)) rec.daily = {};
      rec.daily[D.day] = { n: D.items.length, answered: D.n, right: D.right, t: now, number: D.number, outcomes: D.outcomes.map(function (x) { return x === 1 ? 1 : 0; }) };
    }
    res.daily = { day: D.day, number: D.number, right: D.right, n: D.items.length, scored: D.scored, share: share(D.number, D.right, D.items.length) };
  }

  E.daily = { day: day, number: number, items: items, share: share, status: status, start: start, next: next, void: voidStep, answer: answer, finish: finish, pool: pool };
  void isNum;
})(window.PX);
