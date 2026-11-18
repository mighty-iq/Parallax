/* Engine tests for v1.2 wave 1 (PLAN milestone 1's engine part and milestone 2's mode suggestion;
   docs/dev/CONTRACT-v1.2.md A, C, E, J; O15): the new registry fields (starter, dim `at`,
   trainVariants, pace, roundScore, bet, answer 'point'), σ0 1.5, no stretch item among an
   exercise's first 10 rated answers, est.starter, the Quick deadline (js/engine/pace.js), automatic
   choices kept to trainVariants, modes.suggest, and folded-day answer totals (O15).
   Fixture exercises (tests/node/fixtures/exercises.mjs) plus two v1.2 fixtures. */
import { defineFixtures } from './fixtures/exercises.mjs';
import { newRecord } from './fixtures/learner.mjs';

const DAY = 86400000;
const T0 = Date.UTC(2026, 10, 16, 18, 0, 0); // Monday 16 Nov 2026

function stub(id) {
  return {
    generate(rng, params) { return { ex: id, seed: rng.seed, params, key: 0 }; },
    validate() { return true; },
    score(item, r) { return { correct: r === item.key }; },
  };
}

function defineV12(PX) {
  // A starter level in front of `size` (Δ −1.6), old levels at their old difficulty.
  PX.ex.define(Object.assign({
    id: 'bandx', code: 'EX-91', name: 'Band fixture', abilities: ['Vz'], cell: null, role: 'train', answer: 'choice', nOptions: 4, version: 2,
    starter: { dim: 'size', levels: 1 },
    dims: [{ key: 'size', levels: ['starter', 3, 4, 5], step: 0.6, at: [-1.6, 0, 0.6, 1.2] }, { key: 'turn', levels: [0, 1, 2], step: 0.5 }],
    base: -2.0, bet: 'produce',
  }, stub('bandx')));
  // Central Point's shape: a point answer, Quick in Train with a deadline, Exact only on request.
  PX.ex.define(Object.assign({
    id: 'quickx', code: 'EX-92', name: 'Quick fixture', abilities: ['Vz'], cell: null, role: 'train', answer: 'point',
    chance: () => 0.02, variants: ['quick', 'exact'], trainVariants: ['quick'],
    pace: { variants: ['quick'], startMs: 10000, minMs: 2000, maxMs: 30000, target: 0.85, step: 0.03 },
    roundScore(item, result, info) { return Math.round(100 * (result.credit || 0) * (info.timeout ? 0.5 : 1)); },
    dims: [{ key: 'targets', levels: [4, 5, 6, 7, 8], step: 0.3 }], base: -1.5, bet: 'calibrate',
  }, stub('quickx')));
}

export async function run(t) {
  const mk = () => { const c = t.context({ exercises: false }); defineFixtures(c.PX); defineV12(c.PX); return c.PX; };
  registry(t, mk);
  prior(t, mk);
  noEarlyStretch(t, mk);
  starter(t, mk);
  pace(t, mk);
  variants(t, mk);
  suggest(t, mk);
  folded(t, mk);
}

function registry(t, mk) {
  t.section('registry: v1.2 fields');
  const PX = mk(), X = PX.ex, band = X.get('bandx'), q = X.get('quickx');
  t.near(band.difficulty({ size: 0, turn: 0 }), -3.6, 1e-12, 'a starter level adds its own Δ (at[0])');
  t.near(band.difficulty({ size: 1, turn: 0 }), -2.0, 1e-12, 'the old floor keeps its difficulty');
  t.near(band.difficulty({ size: 3, turn: 2 }), -2.0 + 1.2 + 1.0, 1e-12, 'old combinations keep their difficulty');
  t.near(X.minDifficulty(band), -3.6, 1e-12, 'range min from at');
  t.near(X.maxDifficulty(band), 0.2, 1e-12, 'range max from at');
  t.eq([band.starter.dim, band.starter.levels, Object.isFrozen(band.starter)], ['size', 1, true], 'starter is kept and frozen');
  t.eq(q.trainVariants, ['quick'], 'trainVariants kept');
  t.eq(X.get('rotate').trainVariants, X.get('rotate').variants, 'trainVariants default to every variant');
  t.eq([q.pace.startMs, q.pace.target, q.pace.step, q.pace.variants], [10000, 0.85, 0.03, ['quick']], 'pace kept');
  t.eq([typeof q.roundScore, X.get('rotate').roundScore, q.bet, X.get('rotate').bet], ['function', null, 'calibrate', null], 'roundScore and bet');
  t.ok(X.ANSWERS.includes('point') && X.BETS.length === 9, "answer type 'point' and the nine bets");
  const base = { id: 'bad', code: 'EX-99', name: 'Bad', abilities: ['Vz'], role: 'train', answer: 'choice', nOptions: 4, base: 0, ...stub('bad') };
  const dims = [{ key: 'a', levels: [0, 1, 2], step: 0.5 }];
  t.throws(() => X.check({ ...base, dims, starter: { dim: 'b', levels: 1 } }), /starter/, 'starter must name a dim');
  t.throws(() => X.check({ ...base, dims, starter: { dim: 'a', levels: 3 } }), /starter\.levels/, 'starter cannot take every level');
  t.throws(() => X.check({ ...base, dims: [{ key: 'a', levels: [0, 1, 2], step: 0.5, at: [0, 1] }] }), /at must be/, 'at needs one number per level');
  t.throws(() => X.check({ ...base, dims, variants: ['x', 'y'], trainVariants: ['z'] }), /trainVariants/, 'trainVariants must be variants');
  t.throws(() => X.check({ ...base, dims, trainVariants: ['x'] }), /needs variants/, 'trainVariants needs variants');
  t.throws(() => X.check({ ...base, dims, pace: { startMs: 1000, minMs: 2000, maxMs: 3000 } }), /pace needs/, 'pace needs min ≤ start ≤ max');
  t.throws(() => X.check({ ...base, dims, bet: 'iq' }), /bet must be/, 'unknown bet');
  t.throws(() => X.check({ ...base, dims, answer: 'point', nOptions: undefined }), /chance/, "answer 'point' needs chance");
}

function prior(t, mk) {
  t.section('engine: prior σ0 1.5 (note D2 §3.0 B1)');
  const PX = mk(), E = PX.engine;
  for (const id of ['bandx', 'rotate', 'quickx']) {
    const def = PX.ex.get(id), p = E.est.prior(def);
    t.near(p.sd, 1.5, 1e-12, id + ': σ0 1.5');
    t.near(p.mu, PX.ex.minDifficulty(def) + 1.0, 1e-12, id + ': μ0 = floor + 1.0');
  }
}

// Plays a session with every answer right, as the player would (no clock).
function play(PX, rec, mode, opts, correct = () => true) {
  const E = PX.engine;
  let now = opts.now;
  const plan = E.modes.start(rec, mode, opts), steps = [];
  for (let g = 0; g < 400; g++) {
    const s = E.modes.next(plan, rec, now);
    if (s.done) break;
    now += 6000;
    const res = { correct: correct(s, steps.length), rt: 3000 };
    const out = E.modes.answer(plan, rec, s, res, now);
    steps.push({ s, out });
  }
  E.modes.finish(plan, rec, now);
  return { steps, now };
}

function noEarlyStretch(t, mk) {
  t.section('engine: no stretch item among an exercise\'s first 10 rated answers (note D2 §3.0 B2)');
  let early = 0, later = 0, firstN = 0;
  for (let k = 0; k < 40; k++) {
    const PX = mk(), rec = newRecord(PX, T0 - DAY);
    const { steps } = play(PX, rec, 'train', { now: T0 + k * 997 * 60000, pin: 'bandx', minutes: 20 }, (s, i) => i % 5 !== 3);
    const mine = steps.filter((x) => x.s.exId === 'bandx' && x.out.rated);
    mine.slice(0, 10).forEach((x) => { firstN++; if (x.s.kind === 'stretch') early++; });
    mine.slice(10).forEach((x) => { if (x.s.kind === 'stretch') later++; });
  }
  t.ok(firstN >= 300, 'the pinned exercise got its first 10 rated answers (' + firstN + ')');
  t.eq(early, 0, 'Train: no stretch among the first 10 rated answers');
  t.ok(later > 0, 'Train: stretch items come later (' + later + ')');
  let pEarly = 0;
  for (let k = 0; k < 20; k++) {
    const PX = mk(), rec = newRecord(PX, T0 - DAY);
    const { steps } = play(PX, rec, 'path', { now: T0 + k * 991 * 60000, exId: 'bandx', minutes: 10 });
    steps.filter((x) => x.out.rated).slice(0, 10).forEach((x) => { if (x.s.kind === 'stretch') pEarly++; });
  }
  t.eq(pEarly, 0, 'Path: no stretch among the first 10 rated answers');
  const PX = mk(), E = PX.engine;
  t.eq([E.modes._.earlyKind('stretch', { n: 9 }), E.modes._.earlyKind('stretch', { n: 10 }), E.modes._.earlyKind('easy', { n: 0 })], ['target', 'stretch', 'easy'], 'earlyKind');
}

function starter(t, mk) {
  t.section('engine: level 1 · starter items (note D2 §3.0 B3)');
  const PX = mk(), E = PX.engine, def = PX.ex.get('bandx'), rec = newRecord(PX, T0);
  const s0 = E.est.starter(def, E.est.get(rec, def));
  t.ok(s0 && s0.toNext >= 0 && s0.toNext <= 1, 'a fresh rating shows level 1 with progress towards level 2 (' + (s0 && s0.toNext.toFixed(2)) + ')');
  t.ok(s0 && s0.needOf5 === 4, 'level 2 asks about 4 of 5 right on starter items (' + (s0 && s0.needOf5) + ')');
  const low = E.est.starter(def, { mu: PX.ex.minDifficulty(def) - 2, sd: 1, n: 10 });
  t.ok(low && low.toNext < s0.toNext && low.nowOf5 < s0.nowOf5, 'a lower rating is farther from level 2');
  t.eq(E.est.starter(def, { mu: PX.ex.minDifficulty(def) + 3, sd: 0.4, n: 30 }), null, 'above level 1: null');
}

function pace(t, mk) {
  t.section('engine: the Quick deadline (js/engine/pace.js)');
  const PX = mk(), E = PX.engine, q = PX.ex.get('quickx'), rec = newRecord(PX, T0);
  t.eq([E.pace.applies(q, { targets: 0, variant: 'quick' }), E.pace.applies(q, { targets: 0, variant: 'exact' }), E.pace.applies(PX.ex.get('rotate'), {})], [true, false, false], 'applies to the pace variants only');
  t.eq(E.pace.ms(rec, q), 10000, 'a new player starts at startMs');
  t.eq(rec.ex.quickx, undefined, 'reading the deadline creates nothing');
  const up = E.pace.step(rec, q, false);
  t.near(up / 10000, Math.pow(10, 0.03 * 0.85 / 0.15), 0.01, 'a time-out lengthens it by step·target/(1 − target)');
  const down = E.pace.step(rec, q, true);
  t.near(up / down, Math.pow(10, 0.03), 0.01, 'an answer in time shortens it by step');
  for (let i = 0; i < 300; i++) E.pace.step(rec, q, true);
  t.eq(E.pace.ms(rec, q), 2000, 'it never goes under minMs');
  // A player whose times spread log-normally: the share in time settles near the target.
  const r2 = newRecord(PX, T0), rng = PX.rng(7);
  let inT = 0, n = 0;
  for (let i = 0; i < 3000; i++) {
    const rt = 5000 * Math.exp(0.35 * rng.normal()), ok = rt <= E.pace.ms(r2, q);
    if (i >= 1000) { n++; if (ok) inT++; }
    E.pace.step(r2, q, ok);
  }
  t.near(inT / n, 0.85, 0.04, 'about 85 % of answers come in time (' + (inT / n).toFixed(3) + ')');
  // In sessions: Train deals Quick items with the deadline and moves it; Free play does not move it.
  const r3 = newRecord(PX, T0 - DAY);
  const { steps } = play(PX, r3, 'train', { now: T0, pin: 'quickx', minutes: 10 });
  const qs = steps.filter((x) => x.s.exId === 'quickx');
  t.ok(qs.length >= 10 && qs.every((x) => x.s.paced && x.s.deadlineMs > 0 && x.s.params.variant === 'quick'), 'Train: every Central-Point-like item is Quick with a deadline');
  t.ok(steps.filter((x) => x.s.exId !== 'quickx').every((x) => !x.s.paced), 'other exercises carry no deadline');
  t.ok(r3.ex.quickx.pace && r3.ex.quickx.pace.n === qs.filter((x) => x.out.rated).length, 'each rated Quick answer moved the deadline once');
  const before = JSON.stringify(r3.ex.quickx.pace);
  const fr = play(PX, r3, 'free', { now: T0 + DAY, exId: 'quickx', params: { targets: 2, variant: 'quick' }, trials: 6 });
  t.ok(fr.steps.length === 6 && fr.steps.every((x) => x.s.paced && x.s.deadlineMs === E.pace.ms(r3, q)), 'Free play: Quick items carry the current deadline');
  t.eq(JSON.stringify(r3.ex.quickx.pace), before, 'Free play never moves it');
  const ex = play(PX, r3, 'free', { now: T0 + 2 * DAY, exId: 'quickx', params: { targets: 2, variant: 'exact' }, trials: 3 });
  t.ok(ex.steps.every((x) => !x.s.paced && !x.s.deadlineMs), 'Exact items have no deadline');
  const sp = play(PX, r3, 'free', { now: T0 + 3 * DAY, exId: 'quickx', params: { targets: 2, variant: 'quick' }, deadlineMs: 4321, trials: 2 });
  t.ok(sp.steps.every((x) => x.s.deadlineMs === 4321 && !x.s.paced), 'a deadline the player set wins');
  // A time-out moves it up; the timeout result counts wrong for the rating.
  const r4 = newRecord(PX, T0), plan = E.modes.start(r4, 'train', { now: T0, pin: 'quickx', minutes: 10 });
  let s = E.modes.next(plan, r4, T0);
  for (let g = 0; g < 10 && s.exId !== 'quickx'; g++) { E.modes.answer(plan, r4, s, { correct: true, rt: 2000 }, T0 + 1000); s = E.modes.next(plan, r4, T0 + 2000); }
  const ms0 = E.pace.ms(r4, q), o = E.modes.answer(plan, r4, s, { correct: false, timeout: true, rt: s.deadlineMs }, T0 + 30000);
  t.ok(o.paceMs > ms0 && o.outcome === 0, 'a time-out lengthens the deadline and counts wrong');
}

function variants(t, mk) {
  t.section('engine: automatic choices keep to trainVariants');
  const PX = mk(), E = PX.engine, rec = newRecord(PX, T0 - DAY);
  const p = play(PX, rec, 'path', { now: T0, exId: 'quickx', minutes: 10 });
  t.ok(p.steps.length > 5 && p.steps.every((x) => x.s.params.variant === 'quick'), 'Path deals Quick only');
  const daily = [];
  for (let d = 0; d < 120; d++) E.daily.items(PX.util.dayKey(T0 + d * DAY)).forEach((it) => { if (it.exId === 'quickx') daily.push(it.params.variant); });
  t.ok(daily.length > 0 && daily.every((v) => v === 'quick'), 'the Daily deals Quick only (' + daily.length + ' items)');
  const rr = newRecord(PX, T0 - DAY);
  rr.ex.quickx = { mu: 0, sd: 0.6, n: 50, nRight: 40, last: T0 - DAY, seen: {}, best: {}, hist: [], lru: { 'variant=quick': T0 - 3 * DAY } };
  const tr = play(PX, rr, 'train', { now: T0, pin: 'quickx', minutes: 20 });
  t.ok(tr.steps.filter((x) => x.s.exId === 'quickx').every((x) => x.s.params.variant === 'quick'), 'Train never deals Exact, even when Quick was played last');
}

function suggest(t, mk) {
  t.section('engine: one mode suggestion from the log (gap M3)');
  const PX = mk(), E = PX.engine, def = PX.ex.get('bandx');
  const rec = newRecord(PX, T0 - 10 * DAY);
  t.eq(E.modes.suggest(rec, T0), null, 'a fresh record: no suggestion');
  for (let i = 0; i < 6; i++) E.est.rate(rec, def, { size: 1, turn: 0 }, true, T0 - DAY + i * 1000);
  const s1 = E.modes.suggest(rec, T0);
  t.ok(s1 && s1.mode === 'path' && s1.exId === 'bandx' && s1.key === 'path:bandx' && /ten short stages/.test(s1.why), 'Path for a young exercise');
  rec.ui.hiddenTips = { 'path:bandx': T0 + 14 * DAY };
  t.eq(E.modes.suggest(rec, T0), null, 'a dismissed suggestion stays hidden');
  t.ok(E.modes.suggest(rec, T0 + 15 * DAY) !== null, '…for 14 days');
  const rot = PX.ex.get('rotate'), r2 = newRecord(PX, T0 - 30 * DAY);
  r2.ex.rotate = { mu: 0.5, sd: 0.3, n: 200, nRight: 150, last: T0 - DAY, seen: {}, best: {}, hist: [] };
  r2.path = { rotate: { stage: 3, ema: 0.6, items: 0, passed: { 1: { at: T0 - 9 * DAY }, 2: { at: T0 - 5 * DAY } }, watched: {} } };
  const s2 = E.modes.suggest(r2, T0);
  t.ok(s2 && s2.mode === 'speed' && s2.exId === 'rotate', 'Speed once it is open, never played and the level settled');
  r2.timed = { rotate: { sessions: [['2026-11-10', 0.7, 2000, 20, 1]] } };
  t.eq(E.modes.suggest(r2, T0), null, 'not after a Speed session');
  void rot;
}

function folded(t, mk) {
  t.section('engine: folded-day answer totals (O15)');
  const PX = mk(), E = PX.engine, rec = newRecord(PX, T0);
  // One folded day: 4 right and 3 wrong answers, 2 voided and 1 skipped rows. The probe had 5 rows,
  // 3 of them answers (2 voided rows among them did not count).
  rec.trialDays = { '2026-11-10': { n: 10, right: 4, wrong: 3, stutter: 2, skipped: 1, rtSum: 0, rtN: 0, ex: { cubematch: { n: 5, right: 2, a: 3 }, rotate: { n: 5, right: 2, a: 4 } } } };
  t.eq(E.stats.totals(rec).answers, 4, 'answers subtract the probe\'s answers, not its voided rows (fails on 1.1: 2)');
  rec.trialDays['2026-11-10'].ex.cubematch = { n: 5, right: 2 };
  t.eq(E.stats.totals(rec).answers, 2, 'a 1.1 folded day (no answer count) subtracts every probe row, as before');
}
