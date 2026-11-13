/* Engine tests for v1.1 (PLAN M1; CONTRACT-v1.1 H4–H6): sessions time-boxed on the player's
   active-time clock, Speed sized from timed estimates, complete runs only for Threshold and
   Speed achievements, checks outside the weekly goal, automatic-choice filters (PAT focus, a
   test pause), similarity groups, the merged practice total, the new session fields.
   Fixture exercises (tests/node/fixtures/exercises.mjs) plus one PAT-format fixture. */
import { defineFixtures } from './fixtures/exercises.mjs';
import { newRecord } from './fixtures/learner.mjs';

const DAY = 86400000;
const T0 = Date.UTC(2026, 10, 2, 18, 0, 0); // Monday 2 Nov 2026

function definePat(PX) {
  PX.ex.define({
    id: 'patx', code: 'PAT-9', name: 'PAT fixture', abilities: ['Vz'], cell: null, role: 'train', answer: 'choice', nOptions: 4, pat: true, version: 1,
    dims: [{ key: 'size', levels: [3, 4, 5], step: 0.6 }], base: -1.5,
    generate(rng, params) { return { ex: 'patx', seed: rng.seed, params, key: 0 }; },
    validate() { return true; },
    score(item, r) { return { correct: r === item.key }; },
  });
}

export async function run(t0) {
  const mk = () => { const c = t0.context({ exercises: false }); defineFixtures(c.PX); definePat(c.PX); return c.PX; };
  const t = Object.assign({}, t0, { mk });
  timeBox(t);
  speedAndThreshold(t);
  weeklyGoal(t);
  filters(t);
  groups(t);
  mergeTotal(t);
}

// Plays a session the way the player does: next, answer and finish carry the clock's reading.
// pace(i, step) → { wall, active, correct } for item i (wall time includes pauses; active does not).
function drive(PX, rec, mode, opts, pace, fin = {}) {
  const E = PX.engine;
  let now = opts.now, active = 0;
  const plan = E.modes.start(rec, mode, opts);
  const steps = [];
  for (let g = 0; g < 5000; g++) {
    const s = E.modes.next(plan, rec, now, { activeMs: active });
    if (s.done) break;
    const x = pace(steps.length, s);
    now += x.wall;
    active += x.active;
    const out = E.modes.answer(plan, rec, s, { correct: x.correct !== false, rt: Math.min(x.active, 60000), input: 'touch' }, now, { activeMs: active });
    steps.push({ s, out, active, now });
    if (fin.stopAfter && steps.length >= fin.stopAfter) break;
  }
  const res = E.modes.finish(plan, rec, now, Object.assign({ activeMs: active }, fin.t || {}));
  return { plan, steps, res, active, now, rec };
}

// drive() with voided items: pace(i, step) may return { void: true }.
function driveV(PX, rec, mode, opts, pace) {
  const E = PX.engine;
  let now = opts.now, active = 0;
  const plan = E.modes.start(rec, mode, opts);
  const steps = [];
  for (let g = 0; g < 400; g++) {
    const s = E.modes.next(plan, rec, now, { activeMs: active });
    if (s.done) break;
    const x = pace(steps.length, s);
    now += x.wall;
    active += x.active;
    const res = x.void ? { correct: false, outcome: 'stutter', voided: true, rt: x.active } : { correct: true, rt: x.active };
    const out = E.modes.answer(plan, rec, s, res, now, { activeMs: active });
    steps.push({ s, out, active });
  }
  const res = E.modes.finish(plan, rec, now, { activeMs: active });
  return { plan, steps, res, active, now, rec };
}

function timeBox(t) {
  t.section('v1.1 time box');
  const PX = t.mk(), E = PX.engine;

  // A quick player (1.4 s an item) in a 5-minute session: v1.0 ended after 29 items and 43 s.
  const r1 = drive(PX, newRecord(PX, T0), 'train', { now: T0, minutes: 5 }, () => ({ wall: 1400, active: 1400 }));
  const last1 = r1.steps[r1.steps.length - 1];
  t.ok(Math.abs(r1.active - 300000) <= 2 * 1400, 'a quick player gets the whole 5 minutes of active time (' + (r1.active / 1000).toFixed(1) + ' s, ' + r1.steps.length + ' items)');
  t.ok(r1.steps.length > 150 && r1.plan.extended >= 1, 'the plan extends itself when the player is fast');
  t.eq(last1.s.kind, 'last', 'it ends on the easier closing item');
  t.ok(r1.steps.slice(0, -1).every((x) => x.s.kind !== 'last'), 'one closing item only');
  t.eq(r1.res.session.practiceMs, r1.active, 'the stored practice time is the clock\'s active time');
  t.eq([r1.res.session.display, r1.res.session.ended, r1.res.session.budgetMs], ['large', 'complete', 300000], 'the session keeps its display class, how it ended and its budget');
  t.eq(r1.res.summary.ms, r1.active, 'the summary carries the same milliseconds');

  // Pauses and hidden tabs pass in wall time only: the session still gets its 5 active minutes.
  const r2 = drive(PX, newRecord(PX, T0), 'train', { now: T0, minutes: 5 }, (i) => ({ wall: i === 3 ? 101400 : i === 7 ? 61400 : 1400, active: 1400 }));
  t.ok(Math.abs(r2.active - 300000) <= 2 * 1400 && Math.abs(r2.steps.length - r1.steps.length) <= 2, 'a 100 s pause and a 60 s hidden tab cost no practice (' + r2.steps.length + ' items)');
  t.ok(r2.now - T0 > r2.active + 160000 - 1, 'wall time includes the pauses; active time does not');

  // A slow player (21 s an item) in a 2-minute session ends within one item of the budget.
  const r3 = drive(PX, newRecord(PX, T0), 'train', { now: T0, minutes: 2 }, () => ({ wall: 21000, active: 21000 }));
  t.ok(r3.active >= 120000 - 21000 && r3.active <= 120000 + 21000, 'a slow session ends within one item of 2:00 (' + (r3.active / 1000) + ' s)');
  t.eq(r3.steps[r3.steps.length - 1].s.kind, 'last', 'on its closing item');

  // A long item that runs past the budget: the closing item comes right after it.
  const r4 = drive(PX, newRecord(PX, T0), 'train', { now: T0, minutes: 1 }, (i) => ({ wall: 5000, active: i === 6 ? 90000 : 5000 }));
  t.eq(r4.steps.length, 8, 'an item that ran past the budget is followed by the closing item, then the end');
  t.eq(r4.steps[7].s.kind, 'last', 'the closing item');

  // A closing item that keeps being voided (a stuttering device, a phone turned mid-stimulus) is
  // replaced at most twice (config.session.lastRetries); then the session ends (review S1).
  const voidLate = (from) => (i, s) => ({ wall: 5000, active: 5000, void: s.kind === 'last' || from(i) });
  for (const [name, from] of [['every item from 110 s on', (i) => i >= 22], ['only the closing items', () => false]]) {
    const rv = driveV(PX, newRecord(PX, T0), 'train', { now: T0, minutes: 2 }, voidLate(from));
    const lastKinds = rv.steps.filter((x) => x.s.kind === 'last').length;
    t.ok(rv.plan.done && rv.steps.length < 40 && lastKinds === 1 + E.config.session.lastRetries, 'a 2-minute session with ' + name + ' voided ends after ' + lastKinds + ' closing items (' + rv.steps.length + ' items, ' + (rv.active / 1000) + ' s)');
    t.eq(rv.res.session.ended, 'complete', 'it ends on its own (' + name + ')');
  }

  // Warm-ups first: even a budget spent at once (a long tutorial) shows warm-ups and one more item.
  const r5 = drive(PX, newRecord(PX, T0), 'train', { now: T0, minutes: 1 }, (i) => ({ wall: 1000, active: i === 0 ? 200000 : 1000 }));
  t.eq(r5.steps.map((x) => x.s.kind === 'last' ? 'last' : x.s.kind === 'warmup' ? 'warmup' : 'item'), ['warmup', 'warmup', 'item', 'last'], 'the warm-ups, one more item and the closing item, then the end');

  // Path and Free play without a length are time-boxed too; Free play with a length is not.
  const rp = drive(PX, newRecord(PX, T0), 'path', { now: T0, minutes: 3, exId: 'fold' }, () => ({ wall: 2000, active: 2000 }));
  t.ok(Math.abs(rp.active - 180000) <= 4000 && rp.plan.boxed, 'Path ends on active time (' + rp.steps.length + ' items)');
  const rf = drive(PX, newRecord(PX, T0), 'free', { now: T0, minutes: 3, exId: 'fold' }, () => ({ wall: 2000, active: 2000 }));
  t.ok(Math.abs(rf.active - 180000) <= 4000, 'Free play without a length ends on active time');
  const rn = drive(PX, newRecord(PX, T0), 'free', { now: T0, exId: 'fold', trials: 12 }, () => ({ wall: 60000, active: 60000 }));
  t.ok(rn.steps.length === 12 && !rn.plan.boxed && rn.res.session.budgetMs === undefined, 'Free play with a length ends by its item count');

  // How it ended: the player's word for an early end; 'closed' for a closed page.
  const re = drive(PX, newRecord(PX, T0), 'train', { now: T0, minutes: 5 }, () => ({ wall: 3000, active: 3000 }), { stopAfter: 12, t: { ended: 'early', session: { viewport: '390x844', input: 'touch' } } });
  t.eq([re.res.session.ended, re.res.session.viewport, re.res.session.input], ['early', '390x844', 'touch'], 'an ended session says so, with its viewport and input');
  const rc = drive(PX, newRecord(PX, T0), 'train', { now: T0, minutes: 5 }, () => ({ wall: 3000, active: 3000 }), { stopAfter: 12, t: { ended: 'closed' } });
  t.eq(rc.res.session.ended, 'closed', 'a session cut by a closed page');
  t.ok(rc.res.session.input === undefined && rc.res.session.viewport === undefined, 'no extras unless given');

  // Rows carry the display class and the input.
  const rr = newRecord(PX, T0);
  drive(PX, rr, 'train', { now: T0, minutes: 1, display: 'small' }, () => ({ wall: 3000, active: 3000 }));
  t.ok(rr.trials.length > 3 && rr.trials.every((row) => row[10] === 1 && row[11] === 2 && row.length === 12), 'trial rows: display class 1 (small, from the plan) and input 2 (touch); no value2 unless given');
  const fold = PX.ex.get('fold'), rv2 = newRecord(PX, T0);
  t.eq(E.log.row(rv2, fold, 'free', { code: 0, seed: 1 }, 0, { rt: 900, value: -14.2, value2: 1.35 }, T0).slice(7), [-14.2, null, null, 0, 0, 1.35], 'column 13: result.value2 (Reckon: the distance ratio beside the angle error in value)');
  t.eq([E.log.row(rv2, fold, 'free', { code: 0, seed: 1 }, 0, { value2: Infinity }, T0).length, E.log.COL.value2], [12, 12], 'value2 only when finite (E.log.COL.value2 = 12)');

  // Without a clock (the simulations): v1.0 gap accounting, gaps over 90 s dropped.
  const rg = newRecord(PX, T0), pg = E.modes.start(rg, 'train', { now: T0, minutes: 20 });
  let now = T0;
  for (let i = 0; i < 4; i++) { const s = E.modes.next(pg, rg, now); now += i === 2 ? 120000 : 5000; E.modes.answer(pg, rg, s, { correct: true, rt: 4000 }, now); }
  t.eq(pg.activeMs, 15000, 'without a clock, active time is the sum of gaps up to 90 s (v1.0)');
  t.eq(E.modes.timeLeft(pg), 20 * 60000 - 15000, 'timeLeft(plan)');
}

function speedAndThreshold(t) {
  t.section('v1.1 Speed and Threshold');
  const PX = t.mk(), E = PX.engine;
  const open = (rec, id) => { const ps = E.path.state(rec, id); ps.passed[1] = { at: T0 - DAY, iv: 0, next: T0 + DAY, held: true, maxHeld: 0, last: null }; return rec; };
  const rec = open(newRecord(PX, T0), 'fold');
  const plan = E.modes.start(rec, 'speed', { now: T0, minutes: 5, exId: 'fold' });
  const d0 = Math.pow(10, E.staircase.value(plan.sc));
  t.ok(plan.avgMs <= d0 + E.config.session.overheadMs + 1 && plan.avgMs < E.schedule.trialMs(rec, PX.ex.get('fold'), {}, null), 'Speed sizes its plan from the deadline, not the untimed estimate (' + Math.round(plan.avgMs) + ' ms)');
  const rs = drive(PX, open(newRecord(PX, T0), 'fold'), 'speed', { now: T0, minutes: 2, exId: 'fold' }, () => ({ wall: 2500, active: 2500 }));
  t.ok(Math.abs(rs.active - 120000) <= 5000 && rs.plan.boxed, 'a Speed session runs its 2 active minutes (' + rs.steps.length + ' items)');
  t.eq(rs.res.session.ended, 'complete', 'complete');
  const ts = E.speed.state(rs.rec, 'fold');
  t.eq(ts.sessions[ts.sessions.length - 1][4], 1, 'the timed log marks a full-time session with 1');
  t.ok(rs.res.achievements.some((a) => a.id === 'speed-session'), '"Against the clock" for a Speed session that ran its time');
  const re = drive(PX, open(newRecord(PX, T0), 'fold'), 'speed', { now: T0, minutes: 2, exId: 'fold' }, () => ({ wall: 2500, active: 2500 }), { stopAfter: 3, t: { ended: 'early' } });
  t.ok(!re.res.achievements.some((a) => a.id === 'speed-session'), 'not for a Speed session ended after 3 items');
  t.eq(E.speed.state(re.rec, 'fold').sessions[0][4], 0, 'which the timed log marks with 0');
  const old = newRecord(PX, T0);
  E.speed.state(old, 'fold').sessions.push(['2026-11-01', 0.8, 2000, 12]);
  t.ok(E.achievements.check(old, T0).some((a) => a.id === 'speed-session'), 'a v1.0 entry with 10 or more answers still counts');

  // Threshold: a run stopped after 3 of 20 items is reported, not saved, and earns nothing.
  const th = newRecord(PX, T0);
  const r1 = drive(PX, th, 'threshold', { now: T0, protocol: 'span-length' }, () => ({ wall: 4000, active: 4000 }), { stopAfter: 3, t: { ended: 'early' } });
  t.ok(r1.res.threshold && r1.res.threshold.stopped && r1.res.threshold.n === 3 && r1.res.threshold.trials === 20, 'a stopped run is reported as stopped (3 of 20)');
  t.ok(!(th.mot['span-length'] && th.mot['span-length'].length), 'and never saved to the threshold history');
  t.ok(!r1.res.achievements.some((a) => a.id === 'threshold-run'), '"Measured" is not awarded for it');
  const r2 = drive(PX, th, 'threshold', { now: T0 + 3600e3, protocol: 'span-length' }, (i) => ({ wall: 4000, active: 4000, correct: i % 3 !== 0 }));
  t.ok(r2.steps.length === 20 && th.mot['span-length'].length === 1 && th.mot['span-length'][0].complete === true, 'a complete run is saved, marked complete');
  t.ok(r2.res.achievements.some((a) => a.id === 'threshold-run'), '"Measured" for a complete run');
  const v10 = newRecord(PX, T0);
  v10.mot['span-length'] = [{ date: '2026-11-01T10:00:00.000Z', threshold: 4, x: 2, n: 3, ok: false }];
  t.ok(!E.achievements.check(v10, T0).some((a) => a.id === 'threshold-run'), 'a stopped v1.0 run (3 items) does not count');
}

function weeklyGoal(t) {
  t.section('v1.1 weekly goal');
  const PX = t.mk(), E = PX.engine, S = E.streak;
  const rec = newRecord(PX, T0);
  rec.sessions.push({ id: 'c1', start: T0 + 1000, end: T0 + 300000, mode: 'check', trials: 80, right: 50, practiceMs: 250000, exs: [], summary: null });
  t.ok(!S.counts(rec.sessions[0]), 'a Spatial Check is not a practice session');
  t.eq([S.status(rec, T0 + DAY).week.sessions, S.status(rec, T0 + DAY).week.ms], [0, 0], 'it adds no session and no practice minutes to the week');
  rec.sessions.push({ id: 't1', start: T0 + 2000, end: T0 + 400000, mode: 'train', trials: 8, right: 6, practiceMs: 320000, exs: [], summary: null });
  rec.sessions.push({ id: 't2', start: T0 + 3000, end: T0 + 500000, mode: 'free', trials: 4, right: 3, practiceMs: 60000, exs: [], summary: null });
  const st = S.status(rec, T0 + DAY);
  t.eq([st.week.sessions, st.week.ms], [1, 380000], 'a session counts with 5 minutes of practice; the week\'s minutes add every practice session');
  rec.practiceMs = 250000 + 320000 + 60000; // a v1.0 record: its total held the check too
  const tot = E.stats.totals(rec);
  t.eq([tot.practiceMs, tot.practiceDays], [380000, 1], 'the practice total leaves the Spatial Check out, as the week and the days do (review S2)');
  rec.practiceMs = 380000 + 900000; // sessions pruned from an old record: their time stays
  t.eq(E.stats.totals(rec).practiceMs, 380000 + 900000 - 250000, 'a stored total above the kept sessions adds the difference');
  const rc = newRecord(PX, T0), pc = E.modes.start(rc, 'check', { now: T0 });
  if (!pc.unavailable) {
    let now = T0, act = 0;
    for (let i = 0; i < 6; i++) { const s = E.modes.next(pc, rc, now, { activeMs: act }); if (s.done) break; now += 9000; act += 9000; E.modes.answer(pc, rc, s, { correct: true, rt: 8000 }, now, { activeMs: act }); }
    const fc = E.modes.finish(pc, rc, now, { activeMs: act, ended: 'early' });
    t.ok(fc.session && fc.session.practiceMs === act && rc.practiceMs === 0, 'a check keeps its own time but never adds to the stored practice total');
  }
  const days = E.achievements.list(rec, T0 + DAY).filter((a) => a.id === 'twelve-days')[0];
  t.eq(days.progress[0], 1, '"Twelve days" counts practice days, not check days');
  // B7's Section mode: a full run that ended by itself is good practice; one the player ended is not
  rec.section = { runs: [{ id: 'a', size: 'full', ended: 'user' }, { id: 'b', size: 'mini', ended: 'done' }] };
  t.ok(!E.achievements.check(rec, T0 + DAY).some((a) => a.id === 'full-section'), 'no "Full section" for a stopped or a mini run');
  // the rule since the review (RV-B N15): every part reached and at least half the items answered
  const PARTS = ['openings', 'patviews', 'angles', 'patfold', 'cubes', 'form'];
  rec.section.runs.push({ id: 'd', size: 'full', ended: 'done', n: 90, answered: 0, right: 0, parts: PARTS.map((exId) => ({ exId, n: 15, answered: 0, seen: 15, reached: true })) });
  t.ok(!E.achievements.check(rec, T0 + DAY).some((a) => a.id === 'full-section'), 'no "Full section" for a full run with no answers');
  rec.section.runs.push({ id: 'c', size: 'full', ended: 'time', n: 90, answered: 60, right: 40, parts: PARTS.map((exId) => ({ exId, n: 15, answered: 10, seen: 15, reached: true })) });
  t.ok(E.achievements.check(rec, T0 + DAY).some((a) => a.id === 'full-section'), '"Full section" once a full run reaches its end (or its clock) with every part reached and half the items answered');
  // PAT-format exercises are opt-in: "Every exercise" never waits for them
  const ev = E.achievements.list(newRecord(PX, T0), T0).filter((a) => a.id === 'all-exercises')[0];
  t.eq(ev.progress[1], PX.ex.list('train').filter((d) => !d.pat).length, '"Every exercise" counts the exercises of everyone\'s training, not PAT formats');
}

function filters(t) {
  t.section('v1.1 automatic choices (H5)');
  const PX = t.mk(), E = PX.engine, SCH = E.schedule;
  const rec = newRecord(PX, T0), pat = PX.ex.get('patx');
  const seen = (r, n) => { const ids = new Set(); for (let k = 0; k < n; k++) SCH.choose(r, {}, T0 + k * DAY).exs.forEach((id) => { ids.add(id); E.est.exEntry(r, id); Object.assign(r.ex[id], { n: 30, mu: 0, sd: 0.6, last: T0 + k * DAY }); }); return ids; };
  t.ok(!SCH.auto(rec, pat, T0) && !seen(newRecord(PX, T0), 6).has('patx'), 'a PAT-format exercise is never chosen automatically without the PAT focus');
  const rf = newRecord(PX, T0);
  rf.settings.patFocus = true;
  t.ok(SCH.auto(rf, pat, T0) && seen(rf, 6).has('patx'), 'with the PAT focus on it joins Train');
  const rp = newRecord(PX, T0);
  rp.train.pins = ['patx'];
  t.eq(SCH.choose(rp, {}, T0).roles.focus, 'patx', 'a pin is an explicit pick: never filtered');
  t.eq(E.modes.start(newRecord(PX, T0), 'train', { now: T0, pin: 'patx', minutes: 5 }).exs[0], 'patx', '"Train this exercise" is an explicit pick');
  const rt = newRecord(PX, T0);
  rt.settings.testPause = { ids: ['fold', 'nets'], until: E.day(T0 + 2 * DAY) };
  t.ok(SCH.testPaused(rt, 'fold', T0) && SCH.testPaused(rt, 'nets', T0 + 2 * DAY) && !SCH.testPaused(rt, 'nets', T0 + 3 * DAY) && !SCH.testPaused(rt, 'rotate', T0), 'a test pause holds through its last local day');
  const ids = SCH.choose(rt, { count: 20 }, T0).exs;
  t.ok(ids.indexOf('fold') < 0 && ids.indexOf('nets') < 0 && ids.indexOf('rotate') >= 0, 'paused exercises stay out of Train');
  t.ok(SCH.choose(rt, { count: 20 }, T0 + 3 * DAY).exs.indexOf('fold') >= 0, 'and come back after the date');
  t.ok(E.modes.start(rt, 'path', { now: T0, exId: 'fold', minutes: 5 }).exs[0] === 'fold', 'a Path the player chose is never filtered');
  const rpa = newRecord(PX, T0);
  E.path.state(rpa, 'patx').lastAt = T0 - 1000;
  t.ok(E.modes.start(rpa, 'path', { now: T0, minutes: 5 }).exs[0] !== 'patx', 'an automatic Path choice skips PAT formats without the focus');
  rpa.settings.patFocus = true;
  t.eq(E.modes.start(rpa, 'path', { now: T0, minutes: 5 }).exs[0], 'patx', '… and takes them with it');
  t.ok(E.modes.start(newRecord(PX, T0), 'free', { now: T0, exId: 'patx', trials: 5 }).exs[0] === 'patx', 'Free play is an explicit pick');
  t.ok(E.daily.pool().every((d) => d.id !== 'patx'), 'the Daily never includes PAT formats, focus or not (the same for everyone)');
  rf.settings.testPause = { ids: 'fold', until: 5 };
  t.ok(!SCH.testPaused(rf, 'fold', T0), 'a malformed pause is ignored');
}

function groups(t) {
  t.section('v1.1 similarity groups and beginner order (H6)');
  const PX = t.mk(), SCH = PX.engine.schedule, C = PX.engine.config;
  t.eq(SCH.group('knots'), ['knots', 'nets', 'fold'], 'Knots is grouped with Nets and Fold');
  t.ok(SCH.similar('knots', 'nets') && SCH.similar('fold', 'knots') && !SCH.similar('knots', 'slice') && !SCH.similar('knots', 'rotate'), 'similar() over overlapping groups');
  t.ok(SCH.similar('homing', 'reckon') && SCH.similar('reckon', 'homing') && !SCH.similar('reckon', 'track'), 'Reckon is grouped with Homing');
  t.ok(['nets', 'slice', 'views', 'hidden', 'knots'].every((id) => SCH.group('fold').indexOf(id) >= 0) && SCH.group('fold')[0] === 'fold', 'Fold\'s group is the union of its groups, Fold first');
  t.eq(SCH.group('span'), null, 'an exercise in no group');
  const b = C.session.beginner;
  t.ok(b.indexOf('knots') === b.indexOf('nets') + 1 && b.indexOf('reckon') === b.indexOf('homing') + 1, 'beginner order: Knots after Nets, Reckon after Homing');
  const pat = ['patfold', 'cubes', 'angles', 'patviews', 'openings', 'form'];
  t.ok(pat.every((id) => b.indexOf(id) > b.indexOf('reckon')), 'the PAT formats come after every other exercise (they join only under the PAT focus)');
  t.ok(SCH.similar('patfold', 'fold') && SCH.similar('cubes', 'views') && SCH.similar('openings', 'slice') && SCH.similar('form', 'nets') && SCH.similar('patviews', 'views') && SCH.group('angles') === null,
    'PAT formats grouped with the exercises whose models they share; Angles in no group (R3 §9)');
}

function mergeTotal(t) {
  t.section('v1.1 merged practice total');
  const PX = t.mk(), E = PX.engine;
  const a = newRecord(PX, T0), b = newRecord(PX, T0);
  const s = (id, ms) => ({ id, start: T0 + ms, end: T0 + 2 * ms, mode: 'train', trials: 10, right: 5, practiceMs: ms, exs: [], summary: null });
  a.sessions = [s('x', 100000), s('y', 200000)]; a.practiceMs = 300000;
  b.sessions = [s('x', 100000), s('z', 50000)]; b.practiceMs = 150000;
  const m = E.merge(a, b);
  t.eq(m.practiceMs, 350000, 'the merged total sums the merged sessions (v1.0 kept the larger side: 300 000)');
  b.practiceMs = 900000;
  t.eq(E.merge(a, b).practiceMs, 900000, 'never below either side\'s total');
  b.practiceMs = 0;
  b.sessions.push(Object.assign(s('chk', 400000), { mode: 'check' }));
  t.eq(E.merge(a, b).practiceMs, 350000, 'a check\'s time stays out of the merged total');

  // v1.1 fields both tabs add to (review S3): Section runs, Reckon's history, the test-hygiene log
  const run = (id, start) => ({ id, size: 'mini', start, end: start + 1000, ended: 'done', right: 1, n: 30 });
  const live = (id, answered) => ({ id, size: 'full', parts: [{ exId: 'fold', items: Array.from({ length: 4 }, (_, i) => ({ status: i < answered ? 'answered' : 'new' })) }] });
  a.section = { runs: [run('r1', 10), run('rA', 30)], next: { full: 2, mini: 3 }, live: live('L1', 1) };
  b.section = { runs: [run('r1', 10), run('rB', 20)], next: { full: 4, mini: 1 }, live: live('L1', 3) };
  a.reckon = { v: 1, hist: [[100, 0, 1, 2, 3, 4, 5, 6], [300, 0, 1, 2, 3, 4, 5, 6]] };
  b.reckon = { v: 1, hist: [[100, 0, 1, 2, 3, 4, 5, 6], [200, 1, 1, 2, 3, 4, 5, 6]] };
  a.hygiene = { tests: [{ at: 5, date: null, kinds: ['dat'], paused: [] }], focus: [[10, 1]] };
  b.hygiene = { tests: [{ at: 7, date: '2026-12-01', kinds: ['pat'], paused: ['fold'] }], focus: [[10, 1], [20, 0]] };
  for (const [x, y, name] of [[a, b, 'A newer'], [b, a, 'B newer']]) {
    x.updated = T0 + 9; y.updated = T0 + 1;
    const mv = E.merge(x, y);
    t.eq(mv.section.runs.map((r) => r.id), ['r1', 'rB', 'rA'], 'Section runs: both tabs\' runs, once each, in time order (' + name + ')');
    t.eq(mv.section.next, { full: 4, mini: 3 }, 'Section: the next form of each size is the larger (' + name + ')');
    t.eq(mv.section.live.parts[0].items.filter((i) => i.status === 'answered').length, 3, 'Section: the live run with more answers is kept (' + name + ')');
    t.eq(mv.reckon.hist.map((e) => e[0]), [100, 200, 300], 'Reckon: both tabs\' routes, once each, in time order (' + name + ')');
    t.eq([mv.hygiene.tests.map((x2) => x2.at), mv.hygiene.focus], [[5, 7], [[10, 1], [20, 0]]], 'test hygiene: both tabs\' tests and focus switches (' + name + ')');
  }
  b.section.runs.push(run('L1', 40));
  t.eq(E.merge(a, b).section.live, null, 'a live run that either tab finished is not brought back');
  a.reckon.hist = Array.from({ length: 30 }, (_, i) => [1000 + 2 * i, 0, 1, 2, 3, 4, 5, 6]);
  b.reckon.hist = Array.from({ length: 30 }, (_, i) => [1001 + 2 * i, 0, 1, 2, 3, 4, 5, 6]);
  const mh = E.merge(a, b).reckon.hist;
  t.ok(mh.length === 40 && mh[39][0] === 1059 && mh[0][0] === 1020, 'Reckon keeps its last 40 routes');
}
