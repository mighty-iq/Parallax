/* O14 (PLAN milestone 9: "a partial Daily resumes by seed, with a migration"; acceptance: "the Daily migration is
   tested on 1.1 saves"): js/engine/daily.js names a stored attempt's items by their own seeds, so a part-way
   Daily goes on by seed on any device, and the store's upgrade hook gives older results their seeds.
   Saves: tests/node/fixtures/daily-saves.mjs holds results written by Parallax 1.1 and by 1.2's test builds
   (a whole Daily, one left after three answers, one left after two on a device that could not show the second
   item's exercise; epoch 1 and the ramp), loaded through the store as a saved record, a backup's import and
   another tab's record; and a save taken in the middle of a Daily in this version, reloaded. */
import { deepDiff } from './run.mjs';
import { newRecord } from './fixtures/learner.mjs';
import { v11Daily, v12Daily, ANSWERED } from './fixtures/daily-saves.mjs';

const T0 = Date.UTC(2026, 10, 19, 10, 0, 0);
const RAMP = '2026-11-19'; // the ramp's first day in these tests (it ships null and is set at release)
const copy = (x) => JSON.parse(JSON.stringify(x));
function at(day, hour) { const [y, m, d] = day.split('-').map(Number); return Date.UTC(y, m - 1, d, hour); }

function mk(t, ramp = true) {
  const c = t.context();
  if (c.loadErrors && c.loadErrors.length) throw new Error('load errors: ' + c.loadErrors.join('; '));
  const PX = c.PX || c.window.PX;
  if (ramp) PX.engine.config.daily2.epochs[1].from = RAMP;
  return PX;
}
// The store with the app's field registrations (as app.js makes them before the first load).
function env(t, ramp = true) {
  const e = t.env({ now: T0 }), PX = e.PX, S = PX.core.store, E = PX.engine;
  if (ramp) E.config.daily2.epochs[1].from = RAMP;
  E.fields().forEach((f) => { try { S.field(f.key, f.def, f.fix); } catch (x) { /* registered */ } });
  S.merge = E.merge;
  return e;
}
function load(e, raw) { const S = e.PX.core.store; e.storage.set(null, S.KEY, JSON.stringify(raw)); return S.load(); }

// Plays on from a plan: answers every item it deals (right unless `wrong` holds its seed); → the dealt seeds.
function playOn(E, plan, rec, now, wrong = []) {
  const dealt = [];
  for (let g = 0; g < 30; g++) {
    const s = E.modes.next(plan, rec, now + g);
    if (s.done) break;
    dealt.push(s.seed);
    E.modes.answer(plan, rec, s, { correct: wrong.indexOf(s.seed) < 0, rt: 1200 }, now + g);
  }
  return dealt;
}
function partialRun(E, rec, day, now, answers, can) {
  const plan = E.modes.start(rec, 'daily', { now, day, can }), dealt = [];
  for (let i = 0; i < answers.length; i++) {
    const s = E.modes.next(plan, rec, now + i);
    dealt.push(s.seed);
    E.modes.answer(plan, rec, s, { correct: answers[i] === 1, rt: 1300 }, now + i);
  }
  E.modes.finish(plan, rec, now + 100, { activeMs: 30000, ended: 'early' });
  return dealt;
}

/* ============================================================ the seeds of a date */

function testSeeds(t) {
  t.section('daily: the seeds of a date');
  const PX = mk(t), D = PX.engine.daily, P0 = mk(t, false);
  const days = ['2026-11-05', '2026-11-18', '2026-11-19', '2026-11-25', '2027-02-14'];
  t.ok(days.every((d) => JSON.stringify(D.daySeeds(d)) === JSON.stringify(D.items(d).map((x) => x.seed))), 'daySeeds(day) are the seeds of items(day), item i first');
  t.ok(days.every((d) => JSON.stringify(P0.engine.daily.daySeeds(d)) === JSON.stringify(D.daySeeds(d))), 'they come from the date alone, the same with the ramp on or off');
  t.ok(days.every((d) => { const s = D.daySeeds(d); return s.length === 8 && new Set(s).size === 8 && s.every((x) => Number.isInteger(x) && x >= 2 ** 31); }), 'eight distinct shared seeds per date');
  // what this version writes: every result names its items
  const rec = newRecord(PX, T0), day = '2026-11-21', gone = D.items(day)[2].exId, can = (d) => d.id !== gone;
  partialRun(PX.engine, rec, day, at(day, 12), [1, 0], can);
  const e = rec.daily[day], dealt = D.items(day).filter((x) => x.exId !== gone).map((x) => x.seed);
  t.ok(e.partial && JSON.stringify(e.seeds) === JSON.stringify(dealt) && e.seeds.length === e.outcomes.length && D.seedsOk(day, e), 'a part-way result keeps each dealt item\'s seed beside its outcome');
  t.ok(!D.seedsOk(day, { outcomes: [1, 0], seeds: e.seeds.slice(0, 2).reverse() }) && !D.seedsOk(day, { outcomes: [1], seeds: [D.daySeeds('2026-11-22')[0]] }) && !D.seedsOk(day, { outcomes: [1, 1], seeds: [e.seeds[0]] }),
    'seeds out of the date\'s order, from another date or not one per outcome are not the item names');
}

/* ============================================================ resume by seed on another device */

function testResume(t) {
  t.section('daily: a part-way attempt goes on by seed on any device');
  const PX = mk(t), E = PX.engine, D = E.daily, day = '2026-11-21', now = at(day, 9), its = D.items(day), all = its.map((x) => x.seed);
  // left on a device that shows everything (right, wrong, right on items 1–3), then opened on one that cannot
  // show item 2's exercise
  const rec = newRecord(PX, T0), gone = its[1].exId, can = (d) => d.id !== gone;
  partialRun(E, rec, day, now, [1, 0, 1]);
  const plan = E.modes.start(rec, 'daily', { now: now + 3600e3, can }), Dp = plan.daily;
  t.ok(Dp.scored && Dp.resumed && Dp.n === 3 && Dp.right === 2 && Dp.points === 1 + 3, 'it goes on with its three answers, two right, 4 points (items 1 and 3)');
  t.ok(Dp.items.some((x) => x.seed === all[1]), 'the item answered wrong stays in the attempt although this device cannot show its exercise');
  const later = its.filter((x, i) => i > 2 && x.exId !== gone).map((x) => x.seed);
  const dealt = playOn(E, plan, rec, now + 3600e3 + 10);
  t.eq(dealt, later, 'it deals the unanswered items this device can show, and never an answered one');
  E.modes.finish(plan, rec, now + 3700e3);
  const e = rec.daily[day], bySeed = {};
  e.seeds.forEach((s, i) => { bySeed[s] = e.outcomes[i]; });
  t.ok(!e.partial && bySeed[all[0]] === 1 && bySeed[all[1]] === 0 && bySeed[all[2]] === 1 && later.every((s) => bySeed[s] === 1), 'every answer stays with its own item (by position, item 3\'s answer would have gone to item 4)');
  t.eq([e.n, e.right, e.points], [its.filter((x, i) => i <= 2 || x.exId !== gone).length, e.outcomes.filter((o) => o === 1).length, e.outcomes.reduce((s, o, i) => s + (o === 1 ? D.items(day).find((x) => x.seed === e.seeds[i]).points : 0), 0)], 'its count, right answers and points follow its items');
  // left on a device that could not show one exercise, opened on one that shows everything
  const r2 = newRecord(PX, T0), gone2 = its[0].exId, can2 = (d) => d.id !== gone2;
  const first = partialRun(E, r2, day, now, [1, 1], can2);
  const p2 = E.modes.start(r2, 'daily', { now: now + 7200e3 });
  t.ok(p2.daily.resumed && p2.daily.n === 2 && p2.daily.items.length === 8, 'opened where every exercise shows, the attempt deals all eight items');
  const d2 = playOn(E, p2, r2, now + 7200e3 + 10);
  t.eq(d2.slice().sort(), all.filter((s) => first.indexOf(s) < 0).sort(), 'it deals the item the first device left out, and never the two answered there');
  E.modes.finish(p2, r2, now + 7300e3);
  t.ok(!r2.daily[day].partial && r2.daily[day].n === 8 && r2.daily[day].right === 8, 'and finishes as a whole Daily');
  // nothing left that this device can show: the attempt finishes with the items it holds
  const r3 = newRecord(PX, T0), keep = its[0].exId;
  partialRun(E, r3, day, now, [1]);
  const p3 = E.modes.start(r3, 'daily', { now: now + 9000e3, can: (d) => d.id === keep });
  const d3 = playOn(E, p3, r3, now + 9000e3);
  E.modes.finish(p3, r3, now + 9100e3);
  const kept = its.filter((x) => x.exId === keep).length;
  t.ok(d3.length === kept - 1 && !r3.daily[day].partial && r3.daily[day].n === kept && / of 8 items on this device /.test(D.shareOf(day, r3.daily[day])), 'a device that shows only one exercise deals the rest of its items; the share line says it showed ' + kept + ' of 8 (' + D.shareOf(day, r3.daily[day]) + ')');
}

/* ============================================================ saves from 1.1 and 1.2's test builds */

function checkSave(t, e, tag, raw, short) {
  const PX = e.PX, S = PX.core.store, E = PX.engine, D = E.daily;
  const st = S.state;
  const full = Object.keys(raw.daily).filter((k) => raw.daily[k].outcomes.length === 8);
  t.ok(full.every((k) => JSON.stringify(st.daily[k].seeds) === JSON.stringify(D.daySeeds(k))), tag + ': whole-day results get the seeds of their date (' + full.join(', ') + ')');
  t.ok(full.every((k) => deepDiff(Object.assign({}, st.daily[k], { seeds: undefined }), Object.assign({}, raw.daily[k], { seeds: undefined })) === null), tag + ': nothing else in them changes');
  t.ok(short.every((k) => st.daily[k].seeds === undefined && deepDiff(st.daily[k], raw.daily[k]) === null), tag + ': a result from a device that dealt fewer items keeps none (which item it left out is not known)');
  const g2 = S.guard(copy(st));
  t.eq(deepDiff(g2.daily, st.daily), null, tag + ': the upgrade is idempotent');
}

function testSaves(t) {
  for (const [tag, mkRec, ramp] of [['1.1', v11Daily, true], ['1.2 test builds', v12Daily, true]]) {
    t.section('daily: results saved by ' + tag + ' (O14 migration)');
    const e = env(t, ramp), PX = e.PX, S = PX.core.store, E = PX.engine, D = E.daily;
    const raw = mkRec(T0);
    load(e, copy(raw));
    const short = Object.keys(raw.daily).filter((k) => raw.daily[k].outcomes.length < 8);
    checkSave(t, e, tag, raw, short);
    // the part-way Daily goes on by seed: the answered items are those its attempt answered
    const parts = Object.keys(raw.daily).filter((k) => raw.daily[k].partial && raw.daily[k].outcomes.length === 8);
    parts.forEach((day) => {
      const want = ANSWERED[day].answered, now = at(day, 18);
      if (raw.daily[day].ep === undefined && D.epoch(day).ramp) return; // a 1.1 attempt on a ramp date starts again (game.test.mjs)
      const plan = E.modes.start(S.state, 'daily', { now });
      const got = plan.daily.items.filter((x, i) => plan.daily.outcomes[i] === 0 || plan.daily.outcomes[i] === 1).map((x) => x.seed);
      t.eq(got, want, tag + ' ' + day + ': it goes on with the items its attempt answered');
      t.ok(plan.daily.resumed && plan.daily.right === raw.daily[day].right && (raw.daily[day].points === undefined || plan.daily.points === raw.daily[day].points), tag + ' ' + day + ': with its right answers' + (raw.daily[day].points !== undefined ? ' and points (' + raw.daily[day].points + ')' : ''));
      const dealt = playOn(E, plan, S.state, now + 10);
      t.ok(dealt.length === 8 - want.length && dealt.every((s) => want.indexOf(s) < 0), tag + ' ' + day + ': it deals the other ' + (8 - want.length) + ' items, never an answered one');
      E.modes.finish(plan, S.state, now + 99999);
      t.ok(!S.state.daily[day].partial && D.seedsOk(day, S.state.daily[day]), tag + ' ' + day + ': the finished result names its items');
    });
    // the part-way Daily of a device that could not show one exercise (no seeds): on such a device it goes on by
    // position, as before; where every exercise shows it starts again
    short.filter((k) => raw.daily[k].partial).forEach((day) => {
      const gone = ANSWERED[day].gone, want = ANSWERED[day].answered, now = at(day, 18);
      const same = E.modes.start(S.state, 'daily', { now, can: (d) => d.id !== gone });
      const got = same.daily.items.filter((x, i) => same.daily.outcomes[i] === 0 || same.daily.outcomes[i] === 1).map((x) => x.seed);
      t.ok(same.daily.resumed && JSON.stringify(got) === JSON.stringify(want), tag + ' ' + day + ': on a device like the one that left it, it goes on with the items it answered');
      const other = E.modes.start(S.state, 'daily', { now });
      t.ok(other.daily.scored && !other.daily.resumed && other.daily.n === 0 && other.daily.items.length === 8, tag + ' ' + day + ': where every exercise shows, it starts again (its answers cannot be named)');
    });
    // a backup and its import, and another tab's record, keep the seeds
    const before = copy(S.state.daily);
    const r = S.importJSON(S.exportJSON());
    t.ok(r.ok && deepDiff(S.state.daily, before) === null, tag + ': a backup and its import keep every result and its seeds');
    const m = E.merge(copy(S.state), copy(Object.assign({}, S.state, { daily: raw.daily })));
    t.ok(Object.keys(raw.daily).every((k) => m.daily[k]), tag + ': a merge with a tab still holding the old results keeps one result per day');
    t.eq(deepDiff(S.guard(m).daily, S.state.daily), null, tag + ': read back, the merged record names the same items');
  }
}

/* ============================================================ a save taken in the middle of a Daily */

function testMidDaily(t) {
  t.section('daily: a save taken in the middle of a Daily, reloaded');
  const e = env(t), PX = e.PX, S = PX.core.store, E = PX.engine, D = E.daily;
  S.load();
  const day = '2026-11-23', now = at(day, 8), its = D.items(day), gone = its[3].exId;
  const plan = E.modes.start(S.state, 'daily', { now, can: (d) => d.id !== gone });
  const dealt = [];
  for (let i = 0; i < 4; i++) { const s = E.modes.next(plan, S.state, now + i); dealt.push(s.seed); E.modes.answer(plan, S.state, s, { correct: i % 2 === 0, rt: 1400 }, now + i); }
  E.modes.finish(plan, S.state, now + 200, { activeMs: 40000, ended: 'early' });
  S.save();
  e.clock.tick(6000);
  const text = e.storage.get(S.KEY);
  t.ok(/"seeds":\[/.test(text) && JSON.parse(text).daily[day].partial === true, 'the saved record holds the part-way attempt with its seeds');
  S.load();
  const p2 = E.modes.start(S.state, 'daily', { now: now + 600e3 });
  const got = p2.daily.items.filter((x, i) => p2.daily.outcomes[i] === 0 || p2.daily.outcomes[i] === 1).map((x) => x.seed);
  t.eq(got, dealt, 'reloaded and opened where every exercise shows, it goes on with the four answered items');
  t.eq([p2.daily.right, p2.daily.items.length], [2, 8], 'two of them right; all eight items in the attempt now');
  const rest = playOn(E, p2, S.state, now + 600e3 + 10);
  t.eq(rest.slice().sort(), its.map((x) => x.seed).filter((s) => dealt.indexOf(s) < 0).sort(), 'it deals the four others, among them the one the first device could not show');
  E.modes.finish(p2, S.state, now + 700e3);
  t.ok(!S.state.daily[day].partial && S.state.daily[day].answered === 8, 'and the attempt is spent');
}

/* ============================================================ the hook leaves other records alone */

function testOthers(t) {
  t.section('daily: the upgrade leaves everything else alone');
  const e = env(t), PX = e.PX, S = PX.core.store;
  const raw = { v: 2, created: T0, updated: T0, daily: { '2026-11-17': { n: 8, right: 6 }, '2026-11-16': { n: 8, answered: 8, right: 5, outcomes: [1, 1, 0, 1, 0, 1, 0, 1], seeds: [1, 2, 3, 4, 5, 6, 7, 8] }, junk: 5 } };
  const g = S.guard(copy(raw));
  t.eq(g.daily['2026-11-17'], { n: 8, right: 6 }, 'a result without outcomes (Parallax 1.0) is left as it is');
  t.eq(g.daily['2026-11-16'].seeds, PX.engine.daily.daySeeds('2026-11-16'), 'broken seeds are dropped and named again where every item was dealt');
  t.ok(!('junk' in g.daily), 'the store\'s own repair still drops a key that is not a date');
  t.eq(S.guard({ v: 4, created: T0, updated: T0 }).daily, {}, 'a record without Dailies gets none');
}

export async function run(t) {
  testSeeds(t);
  testResume(t);
  testSaves(t);
  testMidDaily(t);
  testOthers(t);
}
