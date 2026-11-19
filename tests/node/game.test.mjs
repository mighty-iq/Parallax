/* PLAN milestone 5 (the game layer, option B): js/engine/game.js, climb.js, fieldnotes.js, daily.js (Daily v2)
   and the Summit achievement. The eight rules of note G1 §2.0 that code can check are tested here: no count
   of consecutive days anywhere (a scan of every script and stylesheet), Reach never falls, firsts follow the
   guessing rule, nothing pays for time (Reach moves only with best blocks; no lifetime points), and nothing
   of the game layer shows during a stimulus (css/game.css hides it under body.px-stim; the UI test checks
   the effect scheduler). */
import fs from 'node:fs';
import path from 'node:path';
import { Learner, newRecord, playSession } from './fixtures/learner.mjs';

const DAY = 86400000;
const T0 = Date.UTC(2026, 10, 19, 10, 0, 0); // a Thursday in the first Climb week after its epoch Monday

function mk(t) {
  const c = t.context();
  if (c.loadErrors && c.loadErrors.length) throw new Error('load errors: ' + c.loadErrors.join('; '));
  return c.PX || c.window.PX;
}

/* ============================================================ grades and the guessing rule */

function testGrades(t) {
  t.section('grades');
  const PX = mk(t), G = PX.engine.game;
  t.eq([0, 1, 10, 11, 20, 50, 51, 90, 91, 100].map(G.gradeOf), [0, 1, 1, 2, 2, 5, 6, 9, 10, 10], 'grade = the tenth of the range holding the level');
  t.eq([null, undefined, -3, NaN].map(G.gradeOf), [0, 0, 0, 0], 'no level, no grade');
  const fold = PX.ex.get('fold'), b6 = G.band(fold, 6);
  t.ok(b6.lo === 51 && b6.hi === 60 && b6.settings && typeof b6.settings === 'object', 'a grade names its band (51–60) and its typical settings');
  const rec = newRecord(PX, T0);
  t.ok(G.grades(rec, T0).every((x) => x.grade === 0 && x.best === null), 'a new record has no grades');
}

function testGuessing(t) {
  t.section('the guessing rule');
  const PX = mk(t), G = PX.engine.game;
  const rows = [
    [0, 1, 1, true], [0.25, 1, 1, false], [0.25, 2, 2, true], [0.25, 3, 2, false], [0.25, 4, 3, true],
    [0.5, 3, 3, false], [0.5, 4, 4, true], [1 / 3, 2, 2, false], [1 / 3, 3, 3, true], [0.2, 2, 2, true],
  ];
  rows.forEach(([g, n, r, want]) => t.eq(G.handledBy(n, r, g), want, `g ${g.toFixed(2)}: ${r} right of ${n} ${want ? 'handled' : 'not yet'}`));
  t.near(G.tail(3, 2, 0.25), 3 * 0.0625 * 0.75 + 0.015625, 1e-12, 'tail is the binomial upper tail');
  t.eq(G.tail(5, 0, 0.3), 1, 'no right answer: guessing explains it always');
  // a cell: four options need two right answers
  const rec = newRecord(PX, T0), gm = G.game(rec), fold = PX.ex.get('fold');
  const p = PX.engine.model.pool(fold)[0].params, g = fold.chance(p);
  t.ok(g > 0.2 && g < 0.3, 'Fold has four options (g ' + g + ')');
  t.eq(G._.tally(gm, fold, p, true, g, T0, false), null, 'one right answer of four options is not yet a first');
  const f = G._.tally(gm, fold, p, true, g, T0 + 1, false);
  t.ok(f && f.ex === 'fold' && f.cell === G.cellOf(fold, p).key && gm.firsts.length === 1, 'the second right answer makes the first');
  t.eq(G._.tally(gm, fold, p, true, g, T0 + 2, false), null, 'a cell counts once');
}

/* ============================================================ sessions: Atlas, Reach, grades */

function weekOf(PX, rec, L, days, mode = 'train', extra = {}) {
  const out = [];
  for (let d = 0; d < days; d++) out.push(playSession(PX, rec, L, mode, { now: T0 + d * DAY, minutes: 12, ...extra }, d));
  return out;
}

function testSessions(t) {
  t.section('the finish hook');
  const PX = mk(t), E = PX.engine, G = E.game, rec = newRecord(PX, T0), L = new Learner(PX, 7);
  const runs = weekOf(PX, rec, L, 6);
  t.ok(runs.every((r) => r.fin.game && Array.isArray(r.fin.game.firsts)), 'every session gets res.game');
  let high = 0, ok = true, rule = true, reachOk = true;
  runs.forEach((r) => {
    const g = r.fin.game;
    if (g.reach.after < high) ok = false;
    high = Math.max(high, g.reach.after);
    const sum = g.reach.causes.reduce((s, c) => s + c.to - c.from, 0);
    if (g.reach.delta !== sum && !(g.reach.delta === 0 && sum <= 0)) reachOk = false;
  });
  t.ok(ok, 'Reach never falls over a week of sessions');
  t.ok(reachOk, 'Reach moves by exactly the new best blocks (its causes)');
  // every unhandled cell still fails the rule; every handled cell has its one first
  Object.keys(rec.game.atlas).forEach((id) => {
    const a = rec.game.atlas[id];
    Object.keys(a.c).forEach((k) => {
      const [n, r, gq, h] = a.c[k];
      if (h !== 1 && G.handledBy(n, r, gq / 1000)) rule = false;
      if (h === 1 && rec.game.firsts.filter((f) => f.ex === id && f.cell === k).length !== 1) rule = false;
    });
  });
  t.ok(rule, 'firsts follow the guessing rule: no unhandled cell passes it, and each handled cell has one first');
  t.ok(rec.game.firsts.length > 0, 'a week of training makes firsts (' + rec.game.firsts.length + ')');
  const R = G.reach(rec);
  t.eq(R.value, Math.max(R.sum, rec.game.reach.high), 'Reach is the sum of best blocks, never below its high mark');
  t.ok(R.parts.every((p) => PX.ex.get(p.exId).pat !== true), 'Reach leaves out the DAT-style exercises');
  // Reach never falls: lower a best block (as a version change could); the shown value keeps its mark
  const before = G.reach(rec).value, id = R.parts.find((p) => p.best > 0).exId;
  rec.ex[id].best.block.level = 1;
  t.ok(G.reach(rec).value === before, 'a lower stored best never lowers Reach (' + before + ')');
  // nothing pays for time: a session without a new best adds nothing to Reach
  const quiet = playSession(PX, rec, L, 'free', { now: T0 + 9 * DAY, exId: 'fold', minutes: 5 }, 9);
  t.eq(quiet.fin.game.reach.delta, 0, 'a session without a new best block adds nothing (Free play)');
  t.ok(!('points' in rec.game) && !('xp' in rec.game) && !('total' in rec.game), 'no lifetime points in the game container');
  // grade events follow best blocks
  const gr = runs.flatMap((r) => r.fin.game.grades);
  t.ok(gr.every((x) => x.to > x.from && x.to === G.gradeOf(x.level)), 'a grade moves up only with a best block in a higher tenth');
}

function testPending(t) {
  t.section('firsts at a block end (pending)');
  const PX = mk(t), E = PX.engine, G = E.game, rec = newRecord(PX, T0), L = new Learner(PX, 17);
  playSession(PX, rec, L, 'free', { now: T0, exId: 'rotate', minutes: 2 }, 0); // seeds the Atlas
  const before = JSON.stringify(rec.game);
  const plan = E.modes.start(rec, 'train', { now: T0 + DAY, minutes: 10 });
  let pend = [];
  for (let i = 0; i < 40; i++) {
    const s = E.modes.next(plan, rec, T0 + DAY + i * 5000);
    if (s.done) break;
    E.modes.answer(plan, rec, s, L.respond(PX.ex.get(s.exId), s, 1, {}), T0 + DAY + i * 5000 + 3000);
    pend = G.pending(plan, rec);
  }
  t.eq(JSON.stringify(rec.game), before, 'counting a session\'s firsts so far writes nothing');
  const fin = E.modes.finish(plan, rec, T0 + DAY + 300000);
  t.eq(pend.map((f) => f.ex + ':' + f.cell).sort(), fin.game.firsts.map((f) => f.ex + ':' + f.cell).sort(), 'the firsts shown at block ends are those the session ends with (' + pend.length + ')');
}

function testSeeding(t) {
  t.section('Atlas seeding');
  const PX = mk(t), E = PX.engine, G = E.game, rec = newRecord(PX, T0), L = new Learner(PX, 11);
  weekOf(PX, rec, L, 3);
  const cells = JSON.stringify(rec.game.atlas);
  const copy = JSON.parse(JSON.stringify(rec));
  delete copy.game; // a record from before the game layer (its rows are all there)
  copy.game = E.record.defaults('game');
  const r = playSession(PX, copy, L, 'free', { now: T0 + 5 * DAY, exId: 'rotate', minutes: 3 }, 5);
  t.ok(r.fin.game.seeded && copy.game.seeded === 1, 'the first session seeds the Atlas from the rows');
  const old = copy.game.firsts.filter((f) => f.old === 1).length;
  t.ok(old > 0 && r.fin.game.firsts.every((f) => !f.old && f.at >= r.plan.start), 'firsts from older rows are marked old; only this session’s are announced');
  const a0 = JSON.parse(cells);
  t.ok(Object.keys(a0).every((id) => copy.game.atlas[id] && Object.keys(a0[id].c).every((k) => copy.game.atlas[id].c[k] && copy.game.atlas[id].c[k][0] >= a0[id].c[k][0])), 'the seeded counts cover what the hook counted');
}

/* ============================================================ Daily v2 */

function testDaily(t) {
  t.section('Daily v2');
  const PX = mk(t), E = PX.engine, D = E.daily, M = E.model;
  t.eq([D.epoch('2026-11-05').n, D.epoch('2026-11-18').n, D.epoch('2026-11-19').n, D.epoch('2027-03-01').n], [1, 1, 2, 2], 'epochs by date');
  t.ok(D.epoch('2026-10-31') === null, 'no Daily before 1 Nov 2026');
  const day = '2026-11-21', its = D.items(day);
  t.eq(its.map((x) => x.points), [1, 2, 3, 4, 5, 6, 7, 8], 'item k is worth k points (36 in all)');
  const pos = its.map((x) => { const d = PX.ex.get(x.exId), r = M.range(d); return (d.difficulty(x.params) - r.min) / (r.max - r.min); });
  const want = its.map((x, i) => (i + 0.5) / 8);
  t.ok(pos.every((p, i) => Math.abs(p - want[i]) < 0.2), 'a ramp: item k near the quantile (k − 0.5)/8 of its range (' + pos.map((p) => p.toFixed(2)).join(' ') + ')');
  let rising = 0;
  for (let k = 0; k < 40; k++) { const it = D.items('2026-12-' + String(1 + (k % 28)).padStart(2, '0')); if (it.length === 8) { const p = it.map((x) => { const d = PX.ex.get(x.exId), r = M.range(d); return (d.difficulty(x.params) - r.min) / (r.max - r.min); }); if (p[7] > p[0]) rising++; } }
  t.ok(rising >= 38, 'the last item sits higher in its range than the first on every day');
  t.eq(JSON.stringify(D.items(day)), JSON.stringify(mk(t).engine.daily.items(day)), 'the same items for everyone');
  // a frozen pool: an exercise added later never changes an epoch's items
  const PX2 = mk(t), base = PX2.ex.get('fold');
  PX2.ex.define(Object.assign({}, base, { id: 'zzlater', code: 'EX-99', name: 'Later', short: 'Later' }));
  t.eq(JSON.stringify(PX2.engine.daily.items(day)), JSON.stringify(its), 'a later exercise leaves the epoch’s items as they were');
  t.ok(D.poolFor(day).some((d) => d.id === 'centralpoint') && !D.poolFor('2026-11-05').some((d) => d.id === 'centralpoint'), 'epoch 2 adds Central Point; epoch 1 keeps 1.1’s pool');
  // play it: points are the sum of the worth of the right items
  const rec = newRecord(PX, T0), L = new Learner(PX, 3), now = Date.UTC(2026, 10, 21, 12);
  const r = playSession(PX, rec, L, 'daily', { now }, 2);
  const pts = r.fin.daily.outcomes.reduce((s, o, i) => s + (o === 1 ? i + 1 : 0), 0);
  t.eq([r.fin.daily.points, rec.daily[day].points, r.fin.daily.max], [pts, pts, 36], 'points: 1 + 2 + … for the right items');
  t.ok(/^Parallax Daily #21 · \d+ of 36 points · [✓✗]{8} · https:\/\/discord\.gg\/chmr$/.test(r.fin.daily.share), 'the share line: points and a mark row in the app’s own symbols (' + r.fin.daily.share + ')');
  t.ok(!/[\u{1F300}-\u{1FAFF}⬛⬜]/u.test(r.fin.daily.share), 'no emoji grid');
  t.eq(D.status(rec, now).points, pts, 'status gives the points');
  // archive: a past Daily is scored once and marked
  const a = playSession(PX, rec, L, 'daily', { now, day: '2026-11-19' }, 2);
  t.ok(a.fin.daily.archive && a.fin.daily.scored && rec.daily['2026-11-19'].archive === 1 && /\(archive\)/.test(a.fin.daily.share), 'an archive Daily is scored once and marked archive');
  t.ok(E.modes.start(rec, 'daily', { now, day: '2026-11-25' }).unavailable, 'a future Daily does not open');
  const h = D.history(rec);
  t.ok(h.played === 2 && h.archive === 1 && h.ramp.n === 2 && h.ramp.hist.reduce((s, x) => s + x, 0) === 2, 'the history: counts and a histogram of points, no calendar');
  const ar = D.archive(rec, now, 5);
  t.ok(ar.length === 5 && ar[0].day === '2026-11-20' && ar.find((x) => x.day === '2026-11-19').state === 'done', 'the archive lists past days with their state');
  t.ok(Object.keys(h).every((k) => !/streak|row|consecutive/i.test(k)), 'no count of days in a row in the history');
}

/* ============================================================ the Climb */

function climbRun(PX, rec, now, answers, opts = {}) {
  const E = PX.engine, plan = E.modes.start(rec, 'climb', { now, ...opts }), steps = [];
  let i = 0;
  for (let g = 0; g < 60; g++) {
    const s = E.modes.next(plan, rec, now + g);
    if (s.done) break;
    if (i >= answers.length) break;
    const a = answers[i++];
    steps.push(s);
    E.modes.answer(plan, rec, s, a === 's' ? { outcome: 'stutter' } : { correct: a === 1, rt: 2000 }, now + g);
  }
  return { plan, steps, fin: E.modes.finish(plan, rec, now + 100, { activeMs: 60000, ended: i >= answers.length ? 'early' : undefined }) };
}

function testClimb(t) {
  t.section('the weekly Climb');
  const PX = mk(t), E = PX.engine, K = E.climb, M = E.model;
  const wk = K.week(T0);
  t.eq([wk, K.number(wk), K.week(T0 + 4 * DAY), K.week(T0 - 4 * DAY)], ['2026-11-16', 1, '2026-11-23', '2026-11-09'], 'weeks run Monday to Sunday (local)');
  const A = [], B = [];
  for (let r = 1; r <= 20; r++) { A.push(K.item(wk, 'A', r, 0)); B.push(K.item(wk, 'B', r, 0)); }
  t.eq(JSON.stringify(A), JSON.stringify(Array.from({ length: 20 }, (_, i) => mk(t).engine.climb.item(wk, 'A', i + 1, 0))), 'the same rungs for everyone');
  t.ok(JSON.stringify(A) !== JSON.stringify(B), 'attempts A and B have their own seed sets');
  t.ok(A.every((x) => x.seed >= 2 ** 31), 'shared seeds, never training seeds');
  const q = A.map((x) => { const d = PX.ex.get(x.exId), r = M.range(d); return (x.b - r.min) / (r.max - r.min); });
  t.ok(q.every((p, i) => Math.abs(p - (i + 0.5) / 20) < 0.2), 'rung r near the quantile (r − 0.5)/20 of its range');
  t.ok(A.every((x) => { const d = PX.ex.get(x.exId); return !d.perDisplay && d.pat !== true; }), 'the Daily’s pool rules');
  t.ok(K.item(wk, 'A', 5, 1).seed !== A[4].seed && K.item(wk, 'A', 5, 1).exId === A[4].exId, 'after a miss the rung comes again with another item');

  const rec = newRecord(PX, T0);
  // right, right, miss, stutter (voided: the same item again), right, miss → ends at height 3
  const r1 = climbRun(PX, rec, T0, [1, 1, 0, 's', 1, 0]);
  t.eq([r1.fin.climb.height, r1.fin.climb.misses, r1.fin.climb.notches, r1.fin.climb.complete], [3, 2, [3, 4], true], 'the second miss ends the run; height = rungs cleared');
  t.eq(r1.steps[3].seed, r1.steps[4].seed, 'a voided item comes back unchanged');
  t.ok(r1.steps.every((s) => s.deadlineMs === null || s.deadlineMs === undefined), 'untimed');
  t.ok(r1.fin.climb.newWeekBest && r1.fin.climb.newPb && r1.fin.climb.attempt === 'A', 'a first run is the week’s best and a personal best');
  t.ok(!rec.ex || Object.keys(rec.ex).every((id) => !(rec.ex[id].n > 0)), 'the Climb never changes a rating');
  // B part-way, then resumed
  const r2 = climbRun(PX, rec, T0 + DAY, [1, 1, 1, 1]);
  t.ok(r2.fin.climb.attempt === 'B' && r2.fin.climb.partial && rec.game.climb.w[wk].B.p === 1, 'a run left part-way is kept');
  const st = K.state(rec, T0 + DAY);
  t.eq([st.next, st.left, st.best], ['B', 2, 4], 'it goes on next; two attempts are left; the week’s best so far is 4');
  const r3 = climbRun(PX, rec, T0 + DAY, [1, 0, 1, 0]);
  t.ok(r3.plan.climb.resumed && r3.fin.climb.attempt === 'B' && r3.fin.climb.height === 6 && r3.fin.climb.complete, 'the run resumes at rung 5 and ends at height 6');
  t.ok(r3.fin.climb.newWeekBest && r3.fin.climb.newPb, 'beats the week’s best and the personal best');
  const r4 = climbRun(PX, rec, T0 + 2 * DAY, [0, 0]);
  t.ok(r4.fin.climb.attempt === 'C' && r4.fin.climb.height === 0 && !r4.fin.climb.newWeekBest, 'attempt C; height 0 is no best');
  const r5 = climbRun(PX, rec, T0 + 2 * DAY, [1, 0, 0]);
  t.ok(r5.fin.climb.practice && !r5.fin.climb.scored && rec.game.climb.w[wk].A.h === 3, 'after three attempts a run is practice and changes nothing');
  // a new week: three new attempts; the personal best stays
  const s2 = K.state(rec, T0 + 5 * DAY);
  t.eq([s2.week, s2.left, s2.best, s2.last, s2.pb.h], ['2026-11-23', 3, null, 6, 6], 'a new week brings three attempts; last week’s best and the personal best are known');
  // the summit
  const all = Array(20).fill(1), rs = climbRun(PX, rec, T0 + 5 * DAY, all);
  t.ok(rs.fin.climb.height === 20 && rs.fin.climb.summit && rs.fin.achievements.some((a) => a.id === 'summit'), 'clearing all 20 rungs earns Summit');
  t.ok(E.achievements.get('summit').kind === 'skill', 'Summit is a skill milestone');
  t.ok(rs.fin.climb.newPb, '… and a personal best');
}

/* ============================================================ field notes */

function testNotes(t) {
  t.section('field notes');
  const PX = mk(t), E = PX.engine, N = E.notes, rec = newRecord(PX, T0), L = new Learner(PX, 5);
  t.ok(N.IDS.every((id) => !/minute|session|day|login|item|time/i.test(id)), 'no template pays for minutes, sessions, days, logins or items');
  weekOf(PX, rec, L, 2);
  const st = N.state(rec, T0 + 2 * DAY);
  t.ok(st.offer.length >= 1 && st.offer.length <= 3 && st.offer.every((x) => N.IDS.indexOf(x.id) >= 0), 'up to three notes are offered (' + st.offer.map((x) => x.id).join(', ') + ')');
  t.eq(JSON.stringify(N.state(rec, T0 + 3 * DAY).offer), JSON.stringify(st.offer), 'the offer stays for the week');
  t.ok(N.keep(rec, T0, 0) && (st.offer.length < 2 || N.keep(rec, T0, 1)), 'the player keeps notes');
  if (st.offer.length === 3) t.ok(!N.keep(rec, T0, 2), 'at most two are kept');
  const nextWeek = N.state(rec, T0 + 7 * DAY);
  t.ok(nextWeek.week === '2026-11-23' && nextWeek.kept.length === 0 && Object.keys(nextWeek.done).length === 0, 'a new week: a new offer; the old notes go without a trace');
  // a kept 'best' note is done by a new best block
  const rec2 = newRecord(PX, T0);
  weekOf(PX, rec2, new Learner(PX, 9), 1);
  const n2 = E.game.game(rec2).notes;
  n2.week = E.streak.weekKey(E.day(T0 + DAY)); n2.offer = [{ id: 'best' }]; n2.kept = [0]; n2.done = {};
  let done = false;
  for (let d = 1; d < 6 && !done; d++) { const r = playSession(PX, rec2, new Learner(PX, 9), 'train', { now: T0 + d * DAY, minutes: 12 }, d); done = r.fin.game.notes.length > 0; }
  t.ok(done && n2.done['0'] > 0, 'a kept note is done when the record shows it');
}

/* ============================================================ the container: repair, merge */

function testContainer(t) {
  t.section('the game container');
  const PX = mk(t), E = PX.engine, G = E.game, rec = newRecord(PX, T0), L = new Learner(PX, 13);
  weekOf(PX, rec, L, 3);
  climbRun(PX, rec, T0, [1, 1, 0, 1, 0]);
  E.notes.state(rec, T0);
  const rep = E.record.repair('game');
  const once = rep(rec.game);
  t.eq(JSON.stringify(rep(once)), JSON.stringify(once), 'the repair is idempotent');
  t.eq(JSON.stringify(once), JSON.stringify(rec.game), 'a filled container passes the repair unchanged');
  const bad = JSON.parse(JSON.stringify(rec.game));
  bad.atlas.fold = { v: 1, c: { '0.0': [1, 5, 250, 0], 'x': [1, 1, 1, 1] } };
  bad.firsts.push({ ex: 'fold' }, 7);
  bad.climb.w['not-a-week'] = { A: {} };
  const fixed = rep(bad);
  t.ok(!fixed.atlas.fold.c['0.0'] && !fixed.atlas.fold.c.x && fixed.firsts.every((f) => f && typeof f === 'object') && fixed.firsts.some((f) => f.ex === 'fold' && !f.cell) && !fixed.climb.w['not-a-week'], 'broken parts are dropped, never thrown; a first of another shape is kept and skipped by readers');
  t.ok(!G.firstOk({ ex: 'fold' }) && G.firstOk({ ex: 'fold', v: 1, cell: '2.1', at: 5 }), 'firstOk tells them apart');
  // merge: Reach's mark the larger, the union of firsts, the run further up
  const a = JSON.parse(JSON.stringify(rec.game)), b = JSON.parse(JSON.stringify(rec.game));
  a.reach.high += 7;
  b.firsts.push({ ex: 'rotate', v: 1, cell: '8.3', at: T0 + 99 });
  const wk = E.climb.week(T0);
  b.climb.w[wk].B = { r: 9, h: 8, m: 1, n: [4], t: T0 };
  const m = G.merge(a, b, { newer: 'theirs' });
  t.ok(m.reach.high === a.reach.high && m.firsts.some((f) => f.cell === '8.3') && m.climb.w[wk].B.h === 8 && m.seeded === undefined, 'two tabs: the larger mark, the union of firsts, the run further up; the rows are read again');
  const odd = JSON.parse(JSON.stringify(rec.game));
  odd.firsts.push({ exId: 'rotate', cell: '2,1', at: T0 });
  t.eq(G.merge(odd, JSON.parse(JSON.stringify(odd)), { newer: 'mine' }).firsts.length, odd.firsts.length, 'a merge with itself keeps one copy of each first, a first of another shape included');
}

/* ============================================================ rule 4: no count of consecutive days */

function walk(dir, out) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, out);
    else if (/\.(js|css)$/.test(e.name)) out.push(p);
  }
  return out;
}
function testNoChains(t) {
  t.section('no count of consecutive days');
  const files = walk(path.join(t.root, 'js'), []).concat(walk(path.join(t.root, 'css'), []));
  // phrases of a daily chain (the weekly goal's forgiving weeks-in-a-row count stays, by the owner's call)
  const BAD = /\b(days? in a row|consecutive days?|day streak|daily streak|streak freeze|streak (is )?about to|don.t break the chain|keep your streak)\b/i;
  const hits = [];
  files.forEach((f) => {
    fs.readFileSync(f, 'utf8').split('\n').forEach((line, i) => {
      if (!BAD.test(line)) return;
      if (/\bno (daily streak|day streak|count of (consecutive )?days)|never (a )?(count|chain)|(not|no|never|without) .*days in a row/i.test(line)) return; // a rule that forbids it
      hits.push(path.relative(t.root, f) + ':' + (i + 1));
    });
  });
  t.eq(hits, [], 'no script or stylesheet counts or names a chain of days');
  const PX = mk(t), E = PX.engine, rec = newRecord(PX, T0);
  const keys = JSON.stringify([E.climb.state(rec, T0), E.notes.state(rec, T0), E.daily.history(rec), E.daily.status(rec, T0), E.game.reach(rec)]);
  t.ok(!/streak|inARow|consecutive|daysRow/i.test(keys), 'no game-layer output carries such a count');
}

/* ============================================================ a first week, simulated */

function testFirstWeek(t) {
  t.section('a first week (simulated days)');
  const PX = mk(t), E = PX.engine, G = E.game, rec = newRecord(PX, T0), L = new Learner(PX, 21);
  let high = 0, monotone = true, sessions = 0, games = 0, dailies = 0, climbs = 0, errors = [];
  for (let d = 0; d < 7; d++) {
    const t0 = T0 + d * DAY;
    if (d === 1) { const st = E.notes.state(rec, t0); st.offer.forEach((n, i) => { if (i < 2) E.notes.keep(rec, t0, i, true); }); }
    const runs = [playSession(PX, rec, L, 'train', { now: t0, minutes: 10 }, d), playSession(PX, rec, L, 'daily', { now: t0 + 3600e3 }, d)];
    if (d <= 2) runs.push(playSession(PX, rec, L, 'climb', { now: t0 + 7200e3 }, d)); // Thursday to Saturday: one week
    runs.forEach((r) => {
      sessions++;
      if (r.deadEnd) errors.push(r.plan.mode + ': ' + r.deadEnd);
      if (r.fin.errors && r.fin.errors.length) errors.push(r.plan.mode + ': ' + JSON.stringify(r.fin.errors));
      if (r.fin.game) games++;
      if (r.fin.daily && !r.fin.daily.partial) dailies++;
      if (r.fin.climb) climbs++;
      const v = G.reach(rec).value;
      if (v < high) monotone = false;
      high = Math.max(high, v);
    });
  }
  t.eq(errors, [], 'every session of the week runs to its end without a hook error');
  t.ok(games === sessions, 'every session gets the game layer’s result (' + games + ' of ' + sessions + ')');
  t.ok(dailies === 7 && E.daily.history(rec).played === 7, 'seven Dailies played and counted, no calendar');
  t.ok(climbs === 3 && E.climb.state(rec, T0 + 2 * DAY).left === 0 && E.climb.state(rec, T0 + 4 * DAY).left === 3, 'three Climb attempts this week, then none left; Monday brings three more');
  t.ok(monotone && high > 0, 'Reach rose and never fell (' + high + ')');
  t.ok(rec.game.firsts.length > 0 && Object.keys(rec.game.atlas).length > 0, 'the Atlas filled from Train, the Daily and the Climb');
  const rep = E.record.repair('game');
  t.eq(JSON.stringify(rep(rec.game)), JSON.stringify(rec.game), 'the week’s container passes its repair unchanged');
  t.eq(JSON.stringify(G.merge(rec.game, rec.game, { newer: 'mine' }).climb), JSON.stringify(rec.game.climb), 'a merge with itself keeps the Climb');
  const ach = Object.keys(rec.achievements);
  t.ok(ach.indexOf('summit') < 0 || Object.values(rec.game.climb.w).some((w) => Object.values(w).some((x) => x.h >= 20)), 'Summit only with a run of 20');
}

/* ============================================================ rule 3: nothing of the game layer during a stimulus */

function testStimGuard(t) {
  t.section('the stimulus guard (css/game.css)');
  const css = fs.readFileSync(path.join(t.root, 'css/game.css'), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
  const rules = [...css.matchAll(/([^{}]+)\{([^{}]*)\}/g)].map((m) => ({ sel: m[1].replace(/\s+/g, ' ').trim(), body: m[2] }));
  const hidden = rules.filter((r) => /visibility:\s*hidden/.test(r.body) && /body\.px-stim/.test(r.sel)).map((r) => r.sel).join(',');
  ['.gm-panel', '.gm-slot', '.gm-climb-scale', '.gm-ring', '.gm-stamp-wrap', '.gm-scale', '.gm-stretch-tag'].forEach((c) => {
    t.ok(hidden.indexOf('body.px-stim ' + c) >= 0, c + ' is hidden under body.px-stim');
  });
  const still = rules.filter((r) => /animation:\s*none/.test(r.body) && /body\.px-stim/.test(r.sel)).map((r) => r.sel).join(',');
  const ui = ['js/ui/game.js', 'js/ui/climb.js', 'js/ui/atlas.js'].map((f) => fs.readFileSync(path.join(t.root, f), 'utf8')).join('\n');
  const fxs = [...new Set([...ui.matchAll(/'(gm-fx-[a-z]+)/g)].map((m) => m[1]))].filter((c) => c !== 'gm-fx-done' && c !== 'gm-fx-d'); // a resting mark and the stagger delays
  t.ok(fxs.length >= 5, 'the effects in use: ' + fxs.join(', '));
  fxs.forEach((c) => t.ok(still.indexOf('.' + c) >= 0, c + ' stops under body.px-stim'));
  const anims = [...css.matchAll(/animation:\s*(gm-[a-z]+)\s+(\d+)ms/g)].map((m) => [m[1], +m[2]]);
  t.ok(anims.length >= 5 && anims.every(([, ms]) => ms <= 700), 'every effect lasts 700 ms or less (' + anims.map((a) => a.join(' ')).join(', ') + ')');
  t.ok(!/--signal|--stim-target/.test(css), 'celebrations never use the accent (the stimulus target colour)');
  t.ok(/body\.px-stim/.test(ui) && /MutationObserver/.test(ui), 'the effect scheduler checks body.px-stim and cuts effects when it appears');
}

export async function run(t) {
  testGrades(t);
  testGuessing(t);
  testSessions(t);
  testSeeding(t);
  testPending(t);
  testDaily(t);
  testClimb(t);
  testNotes(t);
  testContainer(t);
  testNoChains(t);
  testFirstWeek(t);
  testStimGuard(t);
}
