/* PX.engine.daily: the Daily Challenge (PLAN §5), a community game, not a mode of training.
   The same 8 items for everyone on a date: exercises and seeds come from the date alone.
   Since v1.1 the date is the local one, the same day boundary as everything else in Parallax
   (everyone plays challenge #N on their own date N, as with other daily puzzles).
   Exercises whose difficulty depends on the screen (perDisplay: Track, Homing, Reckon) and
   PAT-format exercises are left out, so the challenge is the same on every device and for
   everyone. One scored attempt a day; replays are practice. The scored attempt is spent only
   when all its items are answered: an attempt left part-way (End now, a reload, a closed tab)
   is kept as { partial: true } and goes on where it stopped the next time it is opened that day.
   Items never change a rating. Seeds are shared seeds (≥ 2^31), never equal to training seeds.

   Daily v2 (v1.2, PLAN milestone 5; note G1 §2.5), by epoch (config.daily2.epochs), so every copy deals
   the same items for a date whatever exercises a later version adds (gap C11):
     epoch 1 (from 1 Nov 2026): v1.1's rule: each item at the combination nearest the middle of its
             exercise's range; the score is right answers of 8; the pool frozen to 1.1's exercises.
     epoch 2 (from the day v1.2 is released, set then in config.daily2.epochs[1].from; until it is set the
             ramp is off, so a live 1.1 and 1.2 deal the same challenge under one number): a ramp from easy to hard: item k (1–8) at the combination nearest
             min + ((k − 0.5)/8)·(max − min) of its exercise's range; item k is worth k points, so a
             full Daily gives 1 + 2 + … + 8 = 36 points (challenge points: fixed items, scored once,
             untimed answers, nothing for time; note G1 §2.1). The pool adds Central Point.
   A missed day loses nothing: a past Daily stays playable from the archive (opts.day), scored once and
   marked archive, outside that day's shared result. No count of days in a row anywhere (note G1 §2.0 rule 4).

   The stored result (rec.daily[day]): { n (items dealt), answered, right, t, number, outcomes (per dealt item:
   1, 0 or null), seeds (each dealt item's own seed, v1.2: O14), ep, points (ramp), archive: 1, partial: true }.
   Each answer writes it through and finish() writes it last (review RV-code-1.2 M2: a phone that discards a
   background tab never runs finish()). A part-way attempt goes on by seed: answered items keep their answers on
   any device, the rest are dealt where the device can show them. Results written before seeds were stored get them through the store's upgrade hook
   when their outcomes cover every item of the date; one from a device that dealt fewer goes on by position only
   where the device deals as many, else starts again.

     day(now) → 'YYYY-MM-DD' (local)     number(day) → N (#1 on 1 Nov 2026)
     epoch(day) → { n, from, ramp, pool }   poolFor(day) → definitions   pool() → today's pool (the live list)
     items(day) → [{ exId, params, seed, index, points }]   (points: 0 on epoch 1)
     share(number, right, n, o?) → 'Parallax Daily #N · x/8 · https://discord.gg/chmr' (epoch 1), or with
                     o = { points, max, marks, archive }: 'Parallax Daily #N · P of 36 points · ✓✓✗… · …'
     status(rec, now) → { day, number, done, partial, result, share, ramp, points, max }
     history(rec) → { played, archive, ramp: { n, hist (points 0–36), best, mean }, plain: { n, best } }
     archive(rec, now, days) → [{ day, number, state: 'open' | 'partial' | 'done', ramp }]  (latest first)
     daySeeds(day) → the date's 8 item seeds     seedsOk(day, entry)     answeredBySeed(day, entry) → { seed: 0 | 1 } | null
     upgrade(rec)  the seeds of older results (registered with store.upgrade; idempotent)
     start / next / answer / void / over / finish: called by modes ('daily') */
(function (PX) {
  'use strict';

  // Local references (globals are slow to look up inside Node's vm contexts used by the tests).
  var isArray = Array.isArray, isFin = isFinite, hasOwn = Object.prototype.hasOwnProperty;

  var E = PX.engine;
  var C = E.config;
  var M = E.model;
  var U = PX.util;

  // The epochs: each freezes its pool (exercise ids in code order) and its rule. Later versions append an
  // epoch with a later `from`; they never change one that has begun. The items themselves come from the live
  // definitions (ranges, variants, generators), so a version that changes an exercise of a running epoch's pool
  // deals other items for that epoch's dates: such a release appends an epoch from its own release day, and past
  // dates stay archive play (review RV-code-1.2 L1: 1.2's epoch 1 deals other settings than 1.1 for about a
  // quarter of the items; DECISIONS, 19 Nov).
  E.defaults('daily2', {
    epochs: [
      { n: 1, from: '2026-11-01', ramp: false, pool: ['rotate', 'spin', 'fold', 'nets', 'slice', 'views', 'orient', 'span', 'hidden', 'knots'] },
      // from: the release day of v1.2 ('YYYY-MM-DD'), set at release (a line of the release checklist);
      // null keeps the epoch off
      { n: 2, from: '2026-11-27', ramp: true, pool: ['rotate', 'spin', 'fold', 'nets', 'slice', 'views', 'orient', 'span', 'hidden', 'knots', 'centralpoint'] },
    ],
    max: 36,     // 1 + 2 + … + 8
    archiveDays: 28,
  });

  function isNum(x) { return typeof x === 'number' && isFin(x); }
  function isObj(x) { return !!x && typeof x === 'object' && !isArray(x); }
  var DAY_RE = /^\d{4}-\d{2}-\d{2}$/;

  function day(now) { return E.day(now); } // the local date, as everywhere else
  function utcNum(key) {
    var p = String(key).split('-');
    return Math.round(Date.UTC(+p[0], +p[1] - 1, +p[2]) / E.DAY);
  }
  function number(key) { return utcNum(key) - utcNum(C.daily.epoch) + 1; }

  function epoch(key) {
    var list = isArray(C.daily2.epochs) ? C.daily2.epochs : [], out = null;
    for (var i = 0; i < list.length; i++) if (isObj(list[i]) && typeof list[i].from === 'string' && list[i].from <= key) out = list[i];
    return out;
  }
  function eligible(d) { return !!d && d.role === 'train' && !d.perDisplay && d.pat !== true; }
  // The same pool for everyone on a date: the epoch's frozen list (exercises this build lacks drop out).
  function poolFor(key) {
    var ep = epoch(typeof key === 'string' && DAY_RE.test(key) ? key : '9999-12-31');
    if (!ep || !isArray(ep.pool)) return pool();
    return ep.pool.map(function (id) { return PX.ex.get(id); }).filter(eligible);
  }
  // The live list (no screen-dependent exercises and no PAT-format exercises, which join practice only with
  // the PAT focus, CONTRACT-v1.1 H5); a new epoch freezes it.
  function pool() {
    return PX.ex.list('train').filter(eligible);
  }

  // Epoch 1 (v1.1's rule): a variant drawn from the automatic ones, then its combination nearest the aim.
  function variantsOf(def) { return def.variants ? (isArray(def.trainVariants) && def.trainVariants.length ? def.trainVariants : def.variants) : null; } // v1.2: trainVariants
  function nearestV1(def, aim, rng) {
    var vs = variantsOf(def), v = vs ? vs[rng.int(0, vs.length - 1)] : undefined;
    return M.nearest(def, aim, v === undefined ? null : function (x) { return x.params.variant === v; }) || M.nearest(def, aim);
  }
  // Ramps (epoch 2, the Climb): the variant is drawn among those whose combinations come within a twentieth
  // of the range of the aim, so a variant with a lower ceiling never flattens the top of a ramp.
  function nearestAt(def, aim, rng) {
    var vs = variantsOf(def), r = M.range(def), tol = (r.max - r.min) / 20 + 1e-9;
    if (!vs) { rng.int(0, 0); return M.nearest(def, aim); }
    var fits = vs.filter(function (v) { var c = M.nearest(def, aim, function (x) { return x.params.variant === v; }); return c && Math.abs(c.b - aim) <= tol; });
    var list = fits.length ? fits : vs, v = list[rng.int(0, list.length - 1)];
    var c = M.nearest(def, aim, function (x) { return x.params.variant === v; });
    return c && Math.abs(c.b - aim) <= tol ? c : M.nearest(def, aim, function (x) { return vs.indexOf(x.params.variant) >= 0; }) || c;
  }

  // The seeds of a date's items, item i first: they come from the date alone (never from the epoch or its pool),
  // so every copy and every version names a date's items by the same seeds.
  function daySeeds(key) {
    var out = [], used = {}, n = C.daily.items;
    for (var i = 0; i < n; i++) {
      var seed = E.select.sharedSeed(PX.rng.hash('px-daily-seed', key, i));
      while (used[seed]) seed = E.select.sharedSeed(PX.rng.hash('px-daily-seed', key, i, seed));
      used[seed] = true;
      out.push(seed);
    }
    return out;
  }

  function items(key) {
    var ep = epoch(key), defs = poolFor(key);
    if (!ep || !defs.length) return [];
    var rng = PX.rng(PX.rng.hash('px-daily', key));
    var order = rng.shuffle(defs), out = [], seeds = daySeeds(key), n = C.daily.items;
    for (var i = 0; i < n; i++) {
      var def = order[i % order.length], r = M.range(def);
      var aim = ep.ramp ? r.min + ((i + 0.5) / n) * (r.max - r.min) : (r.min + r.max) / 2;
      var c = ep.ramp ? nearestAt(def, aim, rng) : nearestV1(def, aim, rng);
      out.push({ exId: def.id, params: JSON.parse(JSON.stringify(c.params)), seed: seeds[i], index: i, points: ep.ramp ? i + 1 : 0 });
    }
    return out;
  }

  /* ---------- the items a stored attempt answered, by seed (O14) ---------- */

  // A stored result keeps `outcomes` (1 right, 0 wrong, null not answered) for the items its device dealt, in the
  // date's order, and since v1.2 `seeds` beside them: each item's own seed. Seeds name items whatever a device
  // could show, so a part-way attempt goes on by seed on any device (before, it went on by position in the
  // device's list, and a device that could not show one exercise shifted every later answer onto another item).
  // seedsOk: the seeds are some of the date's, in its order, one per outcome.
  function seedsOk(key, e) {
    if (!isObj(e) || !isArray(e.seeds) || !isArray(e.outcomes) || e.seeds.length !== e.outcomes.length) return false;
    var all = daySeeds(key), at = -1;
    for (var i = 0; i < e.seeds.length; i++) {
      var k = all.indexOf(e.seeds[i]);
      if (k <= at) return false;
      at = k;
    }
    return true;
  }
  // The upgrade (record repairs, O14): an entry written before seeds were stored (1.1, 1.2's test builds) gets
  // them when its outcomes cover all the date's items, so their positions are the date's; one from a device that
  // dealt fewer keeps none (which items it left out is not known). Broken seeds are dropped. Idempotent.
  function upgradeEntry(key, e) {
    if (!DAY_RE.test(key) || !isObj(e) || !isArray(e.outcomes)) return;
    if (e.seeds !== undefined && !seedsOk(key, e)) delete e.seeds;
    if (e.seeds === undefined && e.outcomes.length === C.daily.items) e.seeds = daySeeds(key);
  }
  function upgrade(rec) {
    if (!isObj(rec) || !isObj(rec.daily)) return rec;
    Object.keys(rec.daily).forEach(function (k) { upgradeEntry(k, rec.daily[k]); });
    return rec;
  }
  // { <seed>: 0 | 1 } for the answered items of a stored attempt, or null when its items cannot be named.
  function answeredBySeed(key, e) {
    if (!isObj(e) || !isArray(e.outcomes)) return null;
    var seeds = seedsOk(key, e) ? e.seeds : e.outcomes.length === C.daily.items ? daySeeds(key) : null;
    if (!seeds) return null;
    var out = {};
    e.outcomes.forEach(function (o, i) { if (o === 0 || o === 1) out[seeds[i]] = o; });
    return out;
  }

  function marksText(marks) {
    return (isArray(marks) ? marks : []).map(function (m) { return m === 1 ? '✓' : m === 0 ? '✗' : '·'; }).join('');
  }
  // o.dealt: the items this device could show, when fewer than the Daily's (the line says so: a fair
  // comparison needs the same items)
  function share(n, right, of, o) {
    var short = isObj(o) && isNum(o.dealt) && o.dealt < C.daily.items ? ' · ' + o.dealt + ' of ' + C.daily.items + ' items on this device' : '';
    if (isObj(o) && isNum(o.points)) {
      return 'Parallax Daily #' + n + (o.archive ? ' (archive)' : '') + ' · ' + o.points + ' of ' + (isNum(o.max) ? o.max : C.daily2.max) + ' points' +
        (isArray(o.marks) && o.marks.length ? ' · ' + marksText(o.marks) : '') + short + ' · ' + C.daily.link;
    }
    return 'Parallax Daily #' + n + (isObj(o) && o.archive ? ' (archive)' : '') + ' · ' + right + '/' + of + short + ' · ' + C.daily.link;
  }
  function shareOf(key, res) {
    if (!isObj(res)) return null;
    var marks = isArray(res.outcomes) ? res.outcomes : null;
    var dealt = isNum(res.n) && res.n < C.daily.items ? res.n : undefined;
    return onRamp(key, res) ? share(number(key), res.right, res.n, { points: res.points, max: C.daily2.max, marks: marks, archive: res.archive === 1, dealt: dealt })
      : share(number(key), res.right, res.n, res.archive === 1 || dealt ? { archive: res.archive === 1, dealt: dealt } : undefined);
  }
  // Points of a stored result: only what was written with it (item k of a ramp is worth k when right). A
  // result without points (Parallax 1.1, or another epoch's rule) has none: it is never scored again as a ramp.
  function pointsOf(res) { return isObj(res) && isNum(res.points) ? res.points : null; }
  // A stored result scored on the ramp of its date's epoch (it carries points and that epoch's number).
  function onRamp(key, res) { var ep = epoch(key); return !!(ep && ep.ramp && isObj(res) && isNum(res.points) && res.ep === ep.n); }
  // The epoch a stored result was written under (1.1 wrote none: epoch 1's rule).
  function epOf(res) { return isObj(res) && isNum(res.ep) ? res.ep : 1; }

  function isPartial(res) { return isObj(res) && res.partial === true; }

  // done: today's scored attempt is spent; partial: it was left part-way and goes on when opened.
  function status(rec, now, key) {
    key = typeof key === 'string' && DAY_RE.test(key) ? key : day(now);
    var res = isObj(rec.daily) ? rec.daily[key] : null, part = isPartial(res), ep = epoch(key);
    if (!isObj(res)) res = null;
    var ramp = !!(ep && ep.ramp), full = res && !part ? res : null, scored = !!(full && onRamp(key, full));
    return {
      day: key, number: number(key), done: !!res && !part, partial: part ? res : null, result: full,
      share: full ? shareOf(key, full) : null, ramp: full ? scored : ramp, points: scored ? full.points : null, max: (full ? scored : ramp) ? C.daily2.max : null,
    };
  }

  // The calm history: how many were played and a histogram of points (no calendar, no days in a row).
  function history(rec) {
    var out = { played: 0, archive: 0, ramp: { n: 0, hist: [], best: null, mean: null }, plain: { n: 0, best: null } }, sum = 0;
    for (var i = 0; i <= C.daily2.max; i++) out.ramp.hist.push(0);
    if (!isObj(rec.daily)) return out;
    Object.keys(rec.daily).forEach(function (k) {
      var r = rec.daily[k];
      if (!DAY_RE.test(k) || !isObj(r) || isPartial(r) || !isNum(r.right)) return;
      out.played += 1;
      if (r.archive === 1) out.archive += 1;
      if (onRamp(k, r)) {
        var p = Math.max(0, Math.min(C.daily2.max, Math.round(r.points)));
        out.ramp.n += 1; out.ramp.hist[p] += 1; sum += p;
        if (out.ramp.best === null || p > out.ramp.best) out.ramp.best = p;
      } else {
        out.plain.n += 1;
        if (out.plain.best === null || r.right > out.plain.best) out.plain.best = r.right;
      }
    });
    if (out.ramp.n) out.ramp.mean = Math.round(10 * sum / out.ramp.n) / 10;
    return out;
  }

  // Past Dailies of the last `days` days (not today), latest first, with whether each was played.
  function archive(rec, now, days) {
    var today = day(now), out = [], n = isNum(days) ? days : C.daily2.archiveDays;
    for (var i = 1; i <= n; i++) {
      var k = U.addDays(today, -i);
      if (!epoch(k)) break;
      var r = isObj(rec.daily) ? rec.daily[k] : null, ep = epoch(k);
      out.push({ day: k, number: number(k), state: !isObj(r) ? 'open' : isPartial(r) ? 'partial' : 'done', ramp: !!ep.ramp, points: isObj(r) && !isPartial(r) && onRamp(k, r) ? r.points : null });
    }
    return out;
  }

  function start(plan, rec, opts, now) {
    var today = day(now), key = opts && typeof opts.day === 'string' && DAY_RE.test(opts.day) ? opts.day : today;
    if (key > today) { plan.unavailable = 'That Daily Challenge has not opened yet.'; return; }
    if (!epoch(key)) { plan.unavailable = 'The Daily Challenge starts on ' + C.daily.epoch + '.'; return; }
    var ep = epoch(key), prev = isObj(rec.daily) ? rec.daily[key] : null;
    // a part-way attempt goes on only under the rule it was started with (one from 1.1 on a ramp date
    // starts again: its answers were to other items)
    var part = isPartial(prev) && isArray(prev.outcomes) && epOf(prev) === ep.n;
    if (isPartial(prev) && !part) prev = null;
    // it goes on by seed (O14): an item answered before keeps its answer even where this device cannot show its
    // exercise (it is never shown again), and every other item is dealt where this device can show it
    var got = part ? answeredBySeed(key, prev) : null;
    var list = items(key).filter(function (it) { var d = PX.ex.get(it.exId); return d && ((got && hasOwn.call(got, it.seed)) || !plan.can || plan.can(d)); });
    if (part && !got) {
      // an entry from before seeds were stored, from a device that dealt fewer items: its outcomes follow that
      // device's list, so it goes on by position where this device deals as many (as before), else starts again
      if (prev.outcomes.length === list.length) { got = {}; list.forEach(function (it, i) { var o = prev.outcomes[i]; if (o === 0 || o === 1) got[it.seed] = o; }); }
      else { part = false; prev = null; }
    }
    if (!list.length) { plan.unavailable = 'The Daily Challenge needs at least one exercise this device can run.'; return; }
    plan.daily = {
      day: key, number: number(key), items: list, at: 0, redo: [], right: 0, n: 0, outcomes: [], scored: !isObj(prev) || part, resumed: false,
      ramp: !!ep.ramp, archive: key !== today, points: 0, ep: ep.n,
    };
    if (part) { // the scored attempt goes on: answered items keep their outcomes and are not shown again
      var D = plan.daily;
      list.forEach(function (it, i) {
        var o = hasOwn.call(got, it.seed) ? got[it.seed] : null;
        if (o === 0 || o === 1) { D.outcomes[i] = o; D.n += 1; D.right += o; if (o === 1) D.points += it.points; }
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
      daily: { day: D.day, number: D.number, index: i, of: D.items.length, scored: D.scored, points: it.points, ramp: D.ramp, archive: D.archive },
    });
  }

  // A stuttered or skipped item comes back (the same item: it is the same for everyone).
  function voidStep(plan, rec, step) { if (step.daily) plan.daily.redo.push(step.daily.index); }

  // The scored attempt is written through with each answer, as the Climb's runs are (review RV-code-1.2 M2): a tab
  // that a phone discards in the background fires no pagehide, so finish() never runs, and the attempt would be lost
  // and could be taken again on items already seen; written through, it goes on by seed the next time the Daily
  // opens. Only the record changes here: the player saves after the answer, and the store writes nothing while it
  // is held for a stimulus.
  function answer(plan, rec, step, ok, result, now) {
    var D = plan.daily;
    D.n += 1;
    if (ok) { D.right += 1; D.points += D.items[step.daily.index] ? D.items[step.daily.index].points : 0; }
    D.outcomes[step.daily.index] = ok ? 1 : 0;
    if (D.scored) keep(rec, D, isNum(now) ? now : 0);
  }

  // Every item answered (voided and skipped items come back, so this is the natural end).
  function complete(D) {
    for (var i = 0; i < D.items.length; i++) if (!answered(D, i)) return false;
    return true;
  }
  function over(plan) { return complete(plan.daily); }

  // outcomes per item: 1 right, 0 wrong, null not answered (never drawn as wrong)
  function outcomesOf(D) { return D.items.map(function (it, i) { return answered(D, i) ? D.outcomes[i] : null; }); }
  // The stored result of the scored attempt as it stands; seeds: each dealt item's own seed beside its outcome
  // (O14), so the attempt goes on by seed on any device.
  function keep(rec, D, now) {
    if (!isObj(rec.daily)) rec.daily = {};
    var entry = { n: D.items.length, answered: D.n, right: D.right, t: now, number: D.number, outcomes: outcomesOf(D), seeds: D.items.map(function (it) { return it.seed; }), ep: D.ep };
    if (D.ramp) entry.points = D.points;
    if (D.archive) entry.archive = 1;
    if (!complete(D)) entry.partial = true;
    rec.daily[D.day] = entry;
  }

  function finish(plan, rec, now, res) {
    var D = plan.daily;
    if (!D || !D.n) return;
    var whole = over(plan), outs = outcomesOf(D);
    if (D.scored) keep(rec, D, now);
    var shareText = null;
    if (whole) {
      var dealt = D.items.length < C.daily.items ? D.items.length : undefined;
      shareText = D.ramp ? share(D.number, D.right, D.items.length, { points: D.points, max: C.daily2.max, marks: outs, archive: D.archive, dealt: dealt })
        : share(D.number, D.right, D.items.length, D.archive || dealt ? { archive: D.archive, dealt: dealt } : undefined);
    }
    res.daily = {
      day: D.day, number: D.number, right: D.right, n: D.items.length, answered: D.n, scored: D.scored, partial: !whole,
      outcomes: outs, share: shareText, ramp: D.ramp, archive: D.archive,
      points: D.ramp ? D.points : null, max: D.ramp ? C.daily2.max : null, worth: D.items.map(function (it) { return it.points; }),
    };
  }

  // The record upgrade runs on every record the store reads (load, import, another tab's record; store.upgrade).
  var S = PX.core && PX.core.store;
  if (S && typeof S.upgrade === 'function') S.upgrade(function (rec) { upgrade(rec); });

  E.daily = {
    day: day, number: number, epoch: epoch, items: items, daySeeds: daySeeds, share: share, shareOf: shareOf, pointsOf: pointsOf, onRamp: onRamp, marksText: marksText,
    status: status, history: history, archive: archive, seedsOk: seedsOk, upgrade: upgrade, answeredBySeed: answeredBySeed,
    start: start, next: next, void: voidStep, answer: answer, over: over, finish: finish, pool: pool, poolFor: poolFor, nearestAt: nearestAt,
  };
})(window.PX);
