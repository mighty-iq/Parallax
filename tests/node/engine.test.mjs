/* Engine unit tests (ARCHITECTURE §7, PLAN §5–§7): formulas, edge cases and determinism for
   every module. They use the fixture exercises (tests/node/fixtures/exercises.mjs) in contexts
   loaded without the real exercises, so results do not move when an exercise changes. */
import fs from 'node:fs';
import path from 'node:path';
import { defineFixtures } from './fixtures/exercises.mjs';
import { Learner, newRecord, playSession } from './fixtures/learner.mjs';

const DAY = 86400000;
const T0 = Date.UTC(2026, 10, 2, 18, 0, 0); // Monday 2 Nov 2026
const sig = (x) => 1 / (1 + Math.exp(-x));
const clone = (x) => JSON.parse(JSON.stringify(x));

export async function run(t0) {
  const mk = (o) => { const c = t0.context({ exercises: false, ...o }); defineFixtures(c.PX); return c.PX; };
  const t = Object.assign({}, t0, { mk });
  testModel(t);
  testEstimator(t);
  testSelect(t);
  testStaircase(t);
  testBandit(t);
  testSchedule(t);
  testTrain(t);
  testSeedSalt(t);
  testFree(t);
  testPath(t);
  testSpeed(t);
  testThreshold(t);
  testDaily(t);
  testAssess(t);
  testLab(t);
  testStreak(t);
  testAchievements(t);
  testStats(t);
  testMerge(t);
  testDeterminism(t);
  testWords(t);
  testMiniSim(t);
}

/* ===================================================================== model */

function testModel(t) {
  t.section('model');
  const PX = t.mk(), E = PX.engine, M = E.model;
  t.near(M.p(0, 0, 0.25), 0.25 + 0.72 * 0.5, 1e-12, 'P = g + (1 − g − 0.03)·σ(θ − b)');
  t.near(M.p(50, 0, 0.25), 0.97, 1e-9, 'P approaches 1 − lapse');
  t.near(M.p(-50, 0, 0.25), 0.25, 1e-9, 'P approaches the guessing rate');
  t.near(M.p(1, 0, 0, 0, 2), sig(2), 1e-12, 'explicit lapse and slope');
  for (const [mu, sd, b, g] of [[0, 0.5, 0, 0.25], [1, 1, -0.5, 0.5], [-2, 0.3, 0, 0], [0.5, 2, 1, 1 / 6]]) {
    let s = 0, w = 0;
    for (let x = -10; x <= 10; x += 0.01) { const d = Math.exp(-x * x / 2); s += d * M.p(mu + sd * x, b, g); w += d; }
    t.near(M.pExp(mu, sd, b, g), s / w, 0.012, `pExp ≈ P averaged over the belief (μ ${mu}, σ ${sd})`);
  }
  t.near(M.p(0.3, M.bAt(0.3, 0.8, 0.25), 0.25), 0.8, 1e-9, 'bAt inverts p');
  t.near(M.pExp(0.3, 0.6, M.bAtExp(0.3, 0.6, 0.7, 0.5), 0.5), 0.7, 1e-9, 'bAtExp inverts pExp');
  t.near(M.target(0.25, 0.7), 0.775, 1e-12, 'Balanced target, 4 options: 77.5 %');
  t.near(M.target(0.5, 0.7), 0.85, 1e-12, 'Balanced target, 2 options: 85 %');
  t.near(M.target(0, 0.7), 0.7, 1e-12, 'Balanced target, open answers: 70 %');
  t.eq(['comfortable', 'balanced', 'stretch', 'nonsense'].map(M.styleK), [0.85, 0.7, 0.55, 0.7], 'style k values (unknown → default)');
  t.near(M.kindTarget('easy', 0.7, 0.25), 0.875, 1e-12, 'easier items at p* + 0.10');
  t.near(M.kindTarget('easy', 0.85, 0.5), 0.975, 1e-12, 'capped at g + (1 − g)·0.95');
  t.near(M.kindTarget('stretch', 0.7, 0.25), 0.625, 1e-12, 'stretch items at g + (1 − g)·0.5');
  t.ok(Math.abs(M.kindTarget('warmup', 0.7, 0.25) - 0.875) < 1e-12 && M.kindTarget('last', 0.7, 0.25) === M.kindTarget('easy', 0.7, 0.25), 'warm-up and closing items like easier ones');

  const fold = PX.ex.get('fold'), pool = M.pool(fold);
  t.eq(pool.length, PX.ex.count(fold), 'the pool holds every combination');
  t.eq(new Set(pool.map((c) => c.code)).size, pool.length, 'pool codes are unique');
  t.ok(pool.every((c) => c.b === fold.difficulty(c.params) && c.g === fold.chance(c.params)), 'b and g come from the definition');
  t.ok(M.pool(fold) === pool, 'pools are cached');
  t.ok(pool.every((c) => c.tags.length === 3 && c.tags[0] === 'folds=' + c.params.folds && c.vtag === null), 'variability tags per candidate');
  const sl = M.range(PX.ex.get('slice'));
  t.near(sl.min, -2.2, 1e-9, 'range of a custom difficulty (min)');
  t.near(sl.max, 2.6, 1e-9, 'range of a custom difficulty with interactions (max)');
  t.eq(M.nearest(fold, -100).code, pool.reduce((a, c) => (c.b < a.b ? c : a)).code, 'nearest() at the bottom is the easiest item');

  E.configure({ lapse: 0.05 });
  t.near(M.p(50, 0, 0), 0.95, 1e-9, 'configure() changes a default in place');
  E.configure('reset');
  t.near(M.p(50, 0, 0), 0.97, 1e-9, "configure('reset') restores the defaults");

  const fields = E.fields();
  // v1.1: js/engine/section.js (Section mode, B7) adds 'section' when it is loaded
  t.eq(fields.map((f) => f.key).filter((k) => k !== 'section').sort(), ['eng', 'lab', 'path', 'spatial', 'strategies', 'timed', 'train'], 'engine-owned record fields');
  for (const f of fields) {
    const d = f.def();
    t.eq(f.fix(clone(d)), d, `${f.key}: the default survives its fixer`);
    t.ok(f.fix('junk') === undefined || Array.isArray(d), `${f.key}: junk is rejected`);
    t.ok(f.def() !== d, `${f.key}: def() returns a fresh value`);
  }
  const train = fields.find((f) => f.key === 'train');
  t.eq(train.fix({ style: 'wild', variability: 'low', pins: ['rotate', 'Bad!', 3], stage: { rotate: 9, 'Bad!': 2, fold: 'x' }, sw: { fold: [[1, 800], [7, 1]] } }),
    { style: 'balanced', variability: 'low', pins: ['rotate'], stage: { rotate: 5 }, sw: { fold: [[1, 800]] } }, 'train: broken parts are repaired');
  const pathF = fields.find((f) => f.key === 'path');
  t.eq(pathF.fix({ fold: { stage: 14, ema: 2, items: -3, passed: { 1: { at: 5 }, 11: { at: 5 }, x: 1 }, watched: { 2: true, 3: 'yes' } } }).fold,
    { stage: 10, ema: 1, items: 0, lastAt: null, passed: { 1: { at: 5, iv: 0, next: 5, held: true, maxHeld: 0, last: null } }, watched: { 2: true } }, 'path: values are clamped and junk dropped');
  const stF = fields.find((f) => f.key === 'strategies');
  t.eq(stF.fix([{ exId: 'fold', strategy: 'whole', t: 5 }, { exId: 'fold', strategy: 'guess', t: 5 }, 'x']).length, 1, 'strategies: invalid check-ins are dropped');

  t.eq([{ correct: true }, { correct: false }, { outcome: 'stutter' }, { outcome: 'skipped' }, { voided: true }, null, 2, { outcome: 1 }].map(E.log.outcome),
    [1, 0, 2, 3, 2, 3, 2, 1], 'outcome codes: 1 right, 0 wrong, 2 stutter or void, 3 skipped');
  t.eq([{ outcome: 'voided' }, { timeout: true }, { outcome: 'timeout' }, { timeout: true, skipped: true }, { timeout: true, correct: true }, { timeout: true, stutter: true }].map(E.log.outcome),
    [2, 0, 0, 0, 0, 2], 'a timeout is scored wrong, never a skip; a stutter still voids the trial');
  const rec = newRecord(PX, T0);
  const row = E.log.row(rec, fold, 'train', { code: 5, seed: 42, pPred: 0.77549, stage: 3 }, 1, { rt: 1234.6, value: 2 }, T0 + 1500);
  t.eq(row, [Math.floor((T0 + 1500) / 1000), 0, 0, 5, 42, 1, 1235, 2, 775, 3, 0, 0], 'trial row: 12 columns with pPred × 1000, stage, display and input (unknown: 0)');
  t.eq([rec.idx.ex, rec.idx.mode], [['fold@1'], ['train']], "index lists hold 'id@version' and mode names");
  t.eq(E.log.row(rec, fold, 'free', { code: 0, seed: 1 }, 0, {}, T0).slice(6), [null, null, null, null, 0, 0], 'missing rt, value, pPred and stage are null; display and input 0');
  t.eq(['small', 'large', 'huge', 2, 7].map((v) => E.log.codeOf(E.log.DISPLAYS, v)), [1, 2, 0, 2, 0], 'display codes: 1 small, 2 large (est.displayClass), else 0');
  t.eq(['mouse', 'touch', 'pen', 'key', 'pointer', 'api', null].map((v) => E.log.codeOf(E.log.INPUTS, v)), [1, 2, 3, 4, 1, 0, 0], 'input codes: 1 mouse, 2 touch, 3 pen, 4 key; a click of unknown type is a mouse');
  t.eq(E.log.row(rec, fold, 'train', { code: 1, seed: 2 }, 1, { rt: 900, display: 'small', input: 'touch' }, T0).slice(10), [1, 2], 'columns 11-12 from result.display and result.input');
  const names = E.log.names({ idx: { ex: ['fold@1', 'nets', null], mode: ['train'] } });
  t.eq([names.ex, names.ver], [['fold', 'nets', null], [1, 1, 1]], "names() reads 'id@version' and plain ids");
}

/* ================================================================= estimator */

function brute(M, mu, sd, b, g, ok) {
  let s0 = 0, s1 = 0, s2 = 0;
  for (let x = mu - 10 * sd; x <= mu + 10 * sd; x += sd / 400) {
    const pc = M.p(x, b, g);
    const w = Math.exp(-((x - mu) ** 2) / (2 * sd * sd)) * (ok ? pc : 1 - pc);
    s0 += w; s1 += w * x; s2 += w * x * x;
  }
  const m = s1 / s0;
  return { mu: m, sd: Math.sqrt(s2 / s0 - m * m) };
}

function testEstimator(t) {
  t.section('estimator');
  const PX = t.mk(), E = PX.engine, est = E.est, M = E.model, fold = PX.ex.get('fold');
  const pr = est.prior(fold);
  t.near(pr.mu, PX.ex.minDifficulty(fold) + 1.0, 1e-12, 'prior μ0 = easiest item + 1.0');
  t.eq(pr.sd, 1, 'prior σ0 = 1.0');
  const first = E.select.pick(fold, est.fresh(fold), { kind: 'target', k: 0.7 });
  t.ok(first.b <= PX.ex.minDifficulty(fold) + 0.7, 'the first item comes from the easy end');
  for (const [mu, sd, b, g, ok] of [[0, 1, 0, 0.25, true], [0, 1, 0, 0.25, false], [1.5, 0.4, 0, 0.5, true], [-1, 0.6, 1, 0, false], [0, 0.3, -2, 1 / 6, true], [2, 1, 2, 0.1, false]]) {
    const a = est.post(mu, sd, b, g, ok), q = brute(M, mu, sd, b, g, ok);
    t.near(a.mu, q.mu, 2e-3, `moment matching matches the exact posterior mean (${mu}, ${sd}, ${b}, ${g}, ${ok})`);
    t.near(a.sd, q.sd, 2e-3, `… and its SD`);
  }
  const up = est.post(0, 1, 0, 0.25, true), down = est.post(0, 1, 0, 0.25, false);
  t.ok(up.mu > 0 && down.mu < 0 && up.sd < 1 && down.sd < 1, 'right raises μ, wrong lowers it, both narrow σ');
  t.ok(est.post(0, 1, 0, 0.5, true).mu < est.post(0, 1, 0, 0, true).mu, 'a right answer says less when guessing is easier');
  t.ok(-down.mu > up.mu, 'with guessing, an error moves the rating more than a right answer');
  const ex = est.post(7.9, 0.5, 12, 0, true);
  t.ok(ex.mu <= 8 && ex.mu >= -8 && isFinite(ex.sd), 'the grid keeps the belief inside −8..+8');
  const d = est.drift({ mu: 0, sd: 0.4 }, 10, 3);
  t.near(d.sd * d.sd, 0.16 + 0.02 + 0.03, 1e-12, 'drift: +0.002 variance per trial, +0.01 per idle day');
  t.near(est.drift({ mu: 0, sd: 0.9 }, 0, 100).sd, 1, 1e-12, 'drift caps the variance at 1.0');
  t.near(est.drift({ mu: 0, sd: 1.5 }, 0, 10).sd, 1.5, 1e-12, 'the cap never narrows a wider belief');

  const rec = newRecord(PX, T0), p0 = { folds: 1, type: 0, punches: 0 };
  for (let i = 0; i < 25; i++) est.rate(rec, fold, p0, i % 4 !== 0, T0 + i * 10000);
  const s = rec.ex.fold;
  t.eq([s.n, s.nRight, s.last], [25, 18, T0 + 240000], 'rate() counts answers and keeps the last time');
  t.eq(s.hist.length === 1 && s.hist[0][0], PX.util.dayKey(T0), 'one history point per practice day');
  t.eq(s.snap.map((x) => x[0]), [10, 20], 'a snapshot every 10 rated answers');
  const g1 = est.get(rec, fold, null, T0 + 240000), g2 = est.get(rec, fold, null, T0 + 240000 + 10 * DAY);
  t.near(g2.sd * g2.sd - g1.sd * g1.sd, 0.1, 1e-9, 'ten idle days widen the belief used to choose the next item');
  t.eq(rec.ex.fold.sd, g1.sd, 'get() never changes the stored rating');
  const r1 = est.rate(rec, fold, p0, true, T0 + 240000 + 10 * DAY);
  t.ok(r1.before.sd < Math.sqrt(g2.sd * g2.sd + 0.002) + 1e-9 && r1.after.mu > r1.before.mu, 'rate() applies the idle-day drift before updating');

  const lv0 = est.level(fold, est.fresh(fold));
  t.ok(lv0.level === 1 && lv0.lo === 1 && lv0.hi > 30, 'a new rating: level 1 with a wide likely range');
  const rg = M.range(fold), mid = (rg.min + rg.max) / 2, q = 0.75 * 0.75 / 0.72;
  t.near(est.level(fold, { mu: mid + Math.log(q / (1 - q)), sd: 0.3, n: 5 }).exact, 50.5, 0.01, 'level 50.5 where the reference difficulty is the middle of the range');
  let mono = true, inside = true, prev = 0;
  for (let mu = -4; mu <= 5; mu += 0.25) {
    const lv = est.level(fold, { mu, sd: 0.4, n: 9 });
    if (lv.exact < prev - 1e-9) mono = false;
    if (!(lv.lo <= lv.level && lv.level <= lv.hi && lv.level >= 1 && lv.level <= 100)) inside = false;
    prev = lv.exact;
  }
  t.ok(mono && inside, 'levels rise with μ, stay in 1–100 and inside their likely range');
  const before = est.level(fold, { mu: 0.4, sd: 0.4, n: 9 }).exact;
  E.configure({ style: 'stretch' });
  t.eq(est.level(fold, { mu: 0.4, sd: 0.4, n: 9 }).exact, before, 'the level does not depend on the style');
  E.configure('reset');
  const lv = est.level(fold, { mu: 0.4, sd: 0.4, n: 9 });
  t.ok(lv.settings && lv.settings.dims.length === 3 && PX.ex.validParams(fold, lv.settings.params) === true, 'level() describes the settings at that difficulty');
  t.ok(Math.abs(lv.settings.b - lv.b) < 0.6 && Object.isFrozen(lv.settings), 'settings are near the level difficulty (shared, read-only)');
  t.eq([est.displayClass(599, 900), est.displayClass(600, 900), est.displayClass(1280, 500)], ['small', 'large', 'small'], 'screen class: small below 600 CSS px');

  const track = PX.ex.get('track'), r2 = newRecord(PX, T0), tp = { speed: 0, targets: 0, spheres: 0, time: 0, variant: 'still' };
  est.rate(r2, track, tp, true, T0, { display: 'small' });
  t.eq([r2.ex.track.n, r2.ex.track.small.n], [0, 1], 'Track keeps a separate rating on small screens');
  est.rate(r2, fold, p0, true, T0, { display: 'small' });
  t.eq(r2.ex.fold.n, 1, 'exercises without perDisplay ignore the screen class');
  est.rate(r2, fold, p0, true, T0, { timed: true });
  t.eq([r2.ex.fold.n, r2.timed.fold.n], [1, 1], 'the timed rating is separate');

  // A steady learner: the rating converges and its 95 % range usually holds the truth.
  let hits = 0, err = 0;
  for (let rep = 0; rep < 30; rep++) {
    const rng = PX.rng(PX.rng.hash('est-conv', rep)), rc = newRecord(PX, T0), theta = rg.min + 1 + rng.float(0, 3);
    for (let i = 0; i < 200; i++) {
      const st = est.get(rc, fold);
      const it = E.select.pick(fold, st, { kind: 'target', k: 0.7, rng });
      est.rate(rc, fold, it.params, rng.chance(M.p(theta, it.b, it.g)), T0 + i * 8000);
    }
    const fin = est.get(rc, fold);
    err += Math.abs(fin.mu - theta);
    if (Math.abs(fin.mu - theta) <= 1.96 * fin.sd) hits++;
  }
  t.ok(err / 30 < 0.4, 'after 200 items the rating is within 0.4 logits on average (' + (err / 30).toFixed(2) + ')');
  t.ok(hits >= 25, 'its 95 % range holds the true ability in most runs (' + hits + '/30)');
}

/* ==================================================================== select */

function testSelect(t) {
  t.section('select');
  const PX = t.mk(), E = PX.engine, S = E.select, M = E.model;
  const fold = PX.ex.get('fold'), rotate = PX.ex.get('rotate'), st = { mu: 0, sd: 0.4 };
  const r = S.pick(fold, st, { kind: 'target', k: 0.7 });
  t.ok(Math.abs(r.p - 0.775) <= 0.05 && r.target === M.target(0.25, 0.7), 'the item is predicted within ±0.05 of the target');
  t.eq(S.pick(fold, st, { kind: 'target', k: 0.7, filter: (c) => c.params.folds === 4 }).params.folds, 4, 'filters are respected');
  t.eq(S.pick(fold, st, { filter: () => false }), null, 'an empty candidate set gives null');
  t.ok(S.pick(fold, { mu: NaN, sd: NaN }, { kind: 'target', k: 0.7 }) !== null, 'a broken belief never throws (read as the prior)');
  for (const v of ['samediff', 'pick']) {
    const x = S.pick(rotate, st, { kind: 'target', k: 0.7, filter: (c) => c.params.variant === v });
    t.near(x.target, M.target(rotate.chance({ variant: v }), 0.7), 1e-12, `the raw target follows the variant's guessing rate (${v})`);
  }
  t.eq(S.params(fold, st, 0.775, 'high', null), r.params, 'params() is the ARCHITECTURE §7 shorthand of pick()');
  for (const id of ['spin', 'rotate']) {
    const def = PX.ex.get(id), recR = newRecord(PX, T0);
    let reps = 0, prev = null;
    for (let i = 0; i < 80; i++) {
      const x = S.pick(def, { mu: 0.3, sd: 0.4 }, { kind: 'target', k: 0.7, recent: S.recent(recR, def), policy: i % 2 ? 'low' : 'high', rng: PX.rng(i) });
      if (prev !== null && x.params.angle === prev) reps++;
      prev = x.params.angle;
      S.note(recR, def, x.cand);
    }
    t.eq(reps, 0, id + ': the angle level never repeats on consecutive items while another is as close to the target');
  }
  t.eq([M.answerOf(PX.ex.get('spin'), { variant: 'samediff' }), M.answerOf(PX.ex.get('spin'), { variant: 'pick' }), M.answerOf(PX.ex.get('spin'), { variant: 'pick' }, { answer: 'yesno' }), M.answerOf(fold, {})],
    ['yesno', 'multi', 'yesno', 'choice'], 'answer type: item.answer, else the variant, else the definition');
  t.eq([E.schedule.trialMs(newRecord(PX, T0), PX.ex.get('spin'), {}, { angle: 0, cells: 0, variant: 'samediff' }), E.schedule.trialMs(newRecord(PX, T0), PX.ex.get('spin'), {}, { angle: 0, cells: 0, variant: 'pick' })],
    [6000, 11000], "trial-time defaults follow the variant's answer type");
  // Large pools are scanned in a window around the ideal difficulty: same choice as a full scan.
  let same = 0, cases = 0;
  const wr = PX.rng(77);
  for (const id of ['track', 'nets', 'span', 'rotate']) {
    const def = PX.ex.get(id), recW = newRecord(PX, T0);
    for (let i = 0; i < 150; i++) {
      const stW = { mu: wr.float(-4, 7), sd: wr.float(0.2, 1.2) }, kind = wr.pick(['target', 'easy', 'stretch', 'warmup']);
      const o = { kind, k: wr.pick([0.55, 0.7, 0.85]), recent: S.recent(recW, def), weak: i % 7 === 0 ? [{ d: 0, lv: 1 }] : null, policy: i % 5 ? 'high' : 'low' };
      if (i % 4 === 0) o.filter = (c) => c.v <= 0 || c.params[def.dims[0].key] % 2 === 0;
      const a = S.pick(def, stW, { ...o, rng: PX.rng(i) }), b = S.pick(def, stW, { ...o, rng: PX.rng(i), full: true });
      cases++;
      if (a && b && a.key === b.key && a.p === b.p) same++;
      if (a) S.note(recW, def, a.cand);
    }
  }
  t.eq(same, cases, 'the windowed scan of large pools picks exactly what a full scan picks (' + same + '/' + cases + ')');

  const rec = newRecord(PX, T0), keys = [];
  let repeats = 0;
  for (let i = 0; i < 60; i++) {
    const x = S.pick(fold, st, { kind: 'target', k: 0.7, recent: S.recent(rec, fold), policy: 'high' });
    if (keys.slice(-3).includes(x.key)) repeats++;
    keys.push(x.key);
    S.note(rec, fold, x.cand);
  }
  t.eq(repeats, 0, 'never one of the last three combinations');
  t.ok(new Set(keys).size >= 10, 'high variability spreads over many combinations (' + new Set(keys).size + ')');
  t.eq(rec.ex.fold.count, 60, 'note() counts shown items');
  const rec2 = newRecord(PX, T0);
  let last = null, ham1 = 0, n = 0;
  for (let i = 0; i < 40; i++) {
    const x = S.pick(fold, st, { kind: 'target', k: 0.7, recent: S.recent(rec2, fold), policy: 'low' });
    if (last) { n++; if (fold.dims.filter((dd) => x.params[dd.key] !== last[dd.key]).length === 1) ham1++; }
    last = x.params;
    S.note(rec2, fold, x.cand);
  }
  t.ok(ham1 / n >= 0.7, 'low variability changes one dimension at a time (' + ham1 + '/' + n + ')');

  const rec3 = newRecord(PX, T0), c0 = M.pool(fold).find((c) => c.params.type === 2 && c.params.folds === 1 && c.params.punches === 0);
  for (let i = 0; i < 30; i++) S.residual(rec3, fold, c0, false, 0.7);
  const wk = S.weak(rec3, fold);
  t.ok(wk.some((w) => w.key === 'type=2') && wk.every((w) => w.m < -0.1), 'a dimension level far below prediction is flagged');
  const pw = S.pick(fold, st, { kind: 'target', k: 0.7, weak: wk });
  t.ok(pw.weak && pw.params[fold.dims[wk[0].d].key] === wk[0].lv, 'weak-spot items are preferred when one is near the target');
  const rec4 = newRecord(PX, T0), rr = PX.rng(5);
  for (let i = 0; i < 300; i++) S.residual(rec4, fold, rr.pick(M.pool(fold)), rr.chance(0.75), 0.75);
  t.eq(S.weak(rec4, fold), [], 'no flag when answers match their predictions');

  const rec5 = newRecord(PX, T0), seeds = new Set();
  for (let i = 0; i < 100000; i++) seeds.add(S.seed(rec5));
  t.eq(seeds.size, 100000, '100 000 training seeds without a repeat');
  t.ok([...seeds].every((x) => x >= 0 && x < 2 ** 31), 'training seeds lie in [0, 2^31)');
  let inv = true;
  for (let k = 0; k < 50000; k++) { const x = Math.imul(k, 2654435761) >>> 1; if (S.unmix31(S.mix31(x)) !== x) inv = false; }
  t.ok(inv, 'mix31 is a bijection (unmix31 inverts it)');
  const rec6 = newRecord(PX, T0), s6 = [];
  for (let i = 0; i < 50; i++) { const x = S.seed(rec6); rec6.trials.push([0, 0, 0, 0, x, 1, 1, null, null, null]); s6.push(x); }
  const salt = rec6.eng.salt;
  rec6.eng = { seedN: 0, salt };
  S.syncSeeds(rec6);
  t.eq(rec6.eng.seedN, 50, 'syncSeeds() recovers a lost counter from the logged seeds');
  t.ok(!s6.includes(S.seed(rec6)), '… so the next seed is new');
  rec6.eng = {};
  S.syncSeeds(rec6);
  t.eq([rec6.eng.salt, rec6.eng.seedN], [salt, 50], 'a lost salt is rebuilt from the creation time (seeds never logged may be reissued)');
  const sh = S.sharedSeed(123);
  t.ok(sh >= 2 ** 31 && sh <= 4294967295 && S.sharedSeed(123) === sh, 'shared seeds lie in [2^31, 2^32) and are deterministic');
}

/* ================================================================= staircase */

// P(success | x) = g + (1 − g − λ)·σ(β·dir·(x0 − x)): harder as x grows when dir = 1.
function runStair(PX, opts, truth, reps, seed) {
  const SC = PX.engine.staircase, out = [];
  for (let r = 0; r < reps; r++) {
    const rng = PX.rng(PX.rng.hash('stair', seed, r));
    const st = SC.create({ ...opts, x0: opts.x0 + rng.float(-0.05, 0.05) });
    while (!SC.done(st)) SC.step(st, rng.chance(truth(SC.value(st))));
    out.push({ th: SC.threshold(st), fit: opts.fit ? SC.fit(st, opts.fit) : null, st });
  }
  return out;
}

function testStaircase(t) {
  t.section('staircase');
  const PX = t.mk(), SC = PX.engine.staircase, U = PX.util;
  const st = SC.create({ rule: 'weighted', p: 0.75, x0: 1 });
  t.eq([st.step, st.dir, st.double, st.trials], [0.025, 1, true, 20], 'weighted defaults: 0.025 log10, doubled until 2 reversals, 20 trials');
  SC.step(st, false);
  t.near(st.x, 1 - 2 * 0.025 * 3, 1e-12, 'easier step = harder step × p/(1 − p) (doubled at the start)');
  SC.step(st, true);
  t.near(st.x, 1 - 0.15 + 0.05, 1e-12, 'harder step after a success');
  t.eq(st.rev.length, 1, 'a change of direction is a reversal');
  t.eq(SC.create({ rule: 'weighted', p: 0.85 }).step, 0.015, 'p > 0.8: a smaller harder step (0.015)');
  const sd = SC.create({ rule: 'standard', x0: 0.5 });
  t.eq([sd.p, sd.step, sd.trials, sd.double], [0.5, 0.05, 20, false], 'standard: 1-up/1-down, 0.05 log10, 20 trials');

  const lapse = 0.02, beta = 12;
  const x0 = 0.6, f = (g) => (x) => g + (1 - g - lapse) * sig(beta * (x0 - x));
  const pTrue = (g, p) => x0 - Math.log(((p - g) / (1 - g - lapse)) / (1 - (p - g) / (1 - g - lapse))) / beta;
  const wr = runStair(PX, { rule: 'weighted', p: 0.75, x0: 0.3, trials: 60, fit: { slope: beta, g: 0, lapse } }, f(0), 200, 1);
  const wm = U.mean(wr.map((r) => r.th.x)), wf = U.mean(wr.map((r) => r.fit));
  t.near(wm, pTrue(0, 0.75), 0.04, 'weighted up-down finds the 75 % point (mean of reversals): ' + wm.toFixed(3) + ' vs ' + pTrue(0, 0.75).toFixed(3));
  t.near(wf, pTrue(0, 0.75), 0.04, '… and the fixed-slope ML fit agrees: ' + wf.toFixed(3));
  const sr = runStair(PX, { rule: 'standard', x0: 0.4 }, f(0), 300, 2);
  const sm = U.mean(sr.map((r) => r.th.x));
  t.near(sm, pTrue(0, 0.5), 0.05, 'standard 1-up/1-down over 20 trials finds the 50 % point: ' + sm.toFixed(3) + ' vs ' + pTrue(0, 0.5).toFixed(3));
  t.ok(sr.every((r) => r.th.reversals < 4 || r.th.method === 'last 4 reversals'), 'standard threshold = mean of the last 4 reversals (geometric mean in value units)');
  const L7 = 4.2, fd = (x) => sig(1.3 * (L7 - x));
  const dr = runStair(PX, { rule: 'discrete', x0: 0, min: 0, max: 7, trials: 40 }, fd, 200, 3);
  const dm = U.mean(dr.map((r) => r.th.x)), d707 = L7 - Math.log(0.7071 / 0.2929) / 1.3;
  t.near(dm, d707, 0.5, '2-down/1-up on levels converges near 70.7 %: ' + dm.toFixed(2) + ' vs ' + d707.toFixed(2));
  const ds = SC.create({ rule: 'discrete', x0: 0, min: 0, max: 7 });
  SC.step(ds, true); SC.step(ds, true);
  t.eq(ds.x, 2, 'discrete fast start: one level up per success until the first error');
  SC.step(ds, false); SC.step(ds, true);
  t.eq(ds.x, 1, '… then two successes are needed per step up');
  const grid = [0, 0.05, 0.1, 0.15, 0.2];
  const gs = SC.create({ rule: 'standard', x0: 0.19, grid });
  t.eq(SC.value(gs), 0.2, 'values snap to the grid');
  for (let i = 0; i < 20; i++) SC.step(gs, true);
  t.ok(SC.value(gs) === 0.2 && SC.threshold(gs).atBound, 'a staircase stuck at a bound is flagged');
  const few = SC.create({ rule: 'weighted', p: 0.75, x0: 0, trials: 6 });
  for (let i = 0; i < 6; i++) SC.step(few, true);
  t.ok(/second half/.test(SC.threshold(few).method), 'with few reversals the estimate falls back to the second half');
  const dl = SC.create({ rule: 'weighted', p: 0.8, dir: -1, step: 0.02, double: false, x0: 3 });
  SC.step(dl, true);
  t.near(dl.x, 2.98, 1e-12, 'dir −1 (deadlines): a success makes the parameter smaller');
}

/* ==================================================================== bandit */

function testBandit(t) {
  t.section('bandit');
  const PX = t.mk(), E = PX.engine, B = E.bandit, fold = PX.ex.get('fold');
  const rec = newRecord(PX, T0);
  t.eq(B.lp(rec, fold), { lp: 1.5, fresh: true, n: 0 }, 'fewer than 60 rated answers: the optimistic default 1.5');
  E.est.exEntry(rec, 'fold');
  Object.assign(rec.ex.fold, { mu: 1.0, sd: 0.4, n: 100, snap: [[30, 0.1, 0.5], [40, 0.4, 0.45], [50, 0.5, 0.4], [90, 0.95, 0.4]] });
  t.near(B.lp(rec, fold).lp, (1.0 - 0.4) / Math.sqrt(0.16 + 0.45 ** 2), 1e-9, 'LP = (μ now − μ 60 answers ago) / √(σ²now + σ²then)');
  rec.ex.fold.mu = 9;
  t.eq(B.lp(rec, fold).lp, 2, 'LP is clipped to ±2');
  const sh = (w) => B.shares(w, 0.2, 0.5).map((x) => Math.round(x * 1e6) / 1e6);
  t.eq(sh([1, 1, 1]), [0.333333, 0.333333, 0.333333], 'equal weights, equal shares');
  t.eq(sh([10, 1, 1]), [0.5, 0.25, 0.25], 'shares are capped at 50 %');
  t.eq(sh([100, 1, 0.01]), [0.5, 0.3, 0.2], '… and floored at 20 %');
  t.eq(sh([1, 9]), [0.5, 0.5], 'two exercises: 50/50');
  t.eq(sh([3]), [1], 'one exercise: all trials');
  const sm = B.softmax([0, 1, 2]);
  t.near(sm[0] + sm[1] + sm[2], 1, 1e-12, 'softmax sums to 1');
  t.ok(sm[2] > sm[1] && sm[1] > sm[0], 'softmax keeps the order');
  const rng = PX.rng(9), cnt = [0, 0, 0];
  for (let i = 0; i < 20000; i++) cnt[B.choose(rng, [1, 3, 0], 0)]++;
  t.ok(cnt[2] === 0 && Math.abs(cnt[1] / 20000 - 0.75) < 0.02, 'choose() follows the weights and never picks a zero weight');
  const cnt2 = [0, 0, 0];
  for (let i = 0; i < 20000; i++) cnt2[B.choose(rng, [1, 3, 0], 1)]++;
  t.ok(cnt2[2] === 0 && Math.abs(cnt2[0] / 20000 - 0.5) < 0.02, 'exploration picks uniformly among open choices');
}

/* ================================================================== schedule */

function testSchedule(t) {
  t.section('schedule');
  const PX = t.mk(), E = PX.engine, SCH = E.schedule, fold = PX.ex.get('fold'), nets = PX.ex.get('nets');
  const rec = newRecord(PX, T0);
  t.eq(SCH.due(rec, fold, T0).due, false, 'an exercise never practised is not due for review');
  E.est.rate(rec, fold, { folds: 0, type: 0, punches: 0 }, true, T0);
  t.ok(!SCH.due(rec, fold, T0 + 2.9 * DAY).due && SCH.due(rec, fold, T0 + 3.1 * DAY).due, 'due 3 days after practice');
  const ivs = [];
  let now = T0;
  for (let i = 0; i < 6; i++) {
    const rv = SCH.practised(rec, fold, now);
    ivs.push(Math.round((rv.next - now) / DAY));
    now = rv.next + DAY / 2;
  }
  t.eq(ivs, [3, 7, 14, 30, 30, 30], 'review intervals 3, 7, 14, 30 days when practised while due');
  const rv = SCH.practised(rec, fold, now - 5 * DAY);
  t.eq(Math.round((rv.next - (now - 5 * DAY)) / DAY), 30, 'practice before it is due keeps the interval');

  t.eq([SCH.stage(rec, 'fold'), SCH.stage(rec, 'fold', 'stretch')], [1, 3], 'stages start at S1 (Stretch at S3)');
  Object.assign(rec.ex.fold, { n: 39, sd: 0.4 });
  t.eq(SCH.stageUp(rec, fold, 'balanced'), 0, 'no stage up below 40 rated answers');
  rec.ex.fold.n = 40;
  t.eq(SCH.stageUp(rec, fold, 'balanced'), 2, 'up one stage at 40 answers and σ ≤ 0.45');
  rec.ex.fold.sd = 0.5;
  t.eq(SCH.stageUp(rec, fold, 'balanced'), 0, 'no stage up while σ > 0.45');
  let back = false;
  for (let i = 0; i < 20; i++) back = SCH.switchNote(rec, 'fold', i % 2 === 0, 0.8, 'balanced') || back;
  t.ok(back && SCH.stage(rec, 'fold') === 1, 'back one stage when 20 switch trials fall 0.10 below prediction');
  let back2 = false;
  for (let i = 0; i < 40; i++) back2 = SCH.switchNote(rec, 'nets', i % 5 !== 0, 0.8, 'balanced') || back2;
  t.ok(!back2, 'switch trials at their prediction keep the stage');
  t.ok(SCH.similar('fold', 'nets') && SCH.similar('rotate', 'orient') && !SCH.similar('fold', 'rotate') && !SCH.similar('track', 'span'), 'similar-looking groups');

  const r2 = newRecord(PX, T0), fi = r2.idx.ex.push('fold@1') - 1;
  for (let i = 0; i < 30; i++) r2.trials.push([1793000000 + i * 5, fi, 0, 0, i, 1, 1000, null, null, null]);
  r2.trials.push([1793000000 + 30 * 5 + 300, fi, 0, 0, 99, 1, 1000, null, null, null]);
  t.eq(SCH.trialTimes(r2), { fold: { med: 5000, extra: null, n: 29 } }, 'trial time = median gap between answers, gaps over 90 s ignored');
  t.eq([SCH.trialMs(r2, fold, SCH.trialTimes(r2)), SCH.trialMs(r2, nets, {})], [5000, 6000], 'measured time, or the default by answer type');
  const span = PX.ex.get('span'), sp5 = { len: 3, cross: 0, turn: 0, variant: 'forward' }, est5 = span.estMs(sp5);
  t.eq(SCH.trialMs(r2, span, {}, sp5), est5 + 2500, "an exercise's own estMs(params) plus 2.5 s between trials");
  t.eq(SCH.trialMs(r2, span, { span: { med: 9000, extra: 1200, n: 20 } }, sp5), est5 + 1200, '… plus your own measured extra once 10 trials are timed');
  const r2s = newRecord(PX, T0), si = E.log.exIndex(r2s, span), code5 = PX.ex.paramsCode(span, sp5);
  for (let i = 0; i < 12; i++) r2s.trials.push([1793000000 + i * 8, si, 0, code5, i, 1, 1000, null, null, null]);
  t.eq(SCH.trialTimes(r2s).span.extra, 8000 - est5, 'the extra is measured against estMs of each logged item');

  const r3 = newRecord(PX, T0);
  const ch = SCH.choose(r3, { pin: 'views' }, T0);
  t.eq([ch.exs.length, ch.roles.focus], [3, 'views'], 'three exercises; a pin is the focus');
  t.ok(new Set(ch.exs).size === 3, 'three different exercises');
  E.est.rate(r3, nets, { squares: 0, shape: 0, marks: 0, variant: 'opposite' }, true, T0 - 5 * DAY);
  const ch2 = SCH.choose(r3, {}, T0);
  t.eq(ch2.roles.review, 'nets', 'review = the most overdue exercise');
  const r4 = newRecord(PX, T0);
  r4.train.stage.fold = 4;
  ['nets', 'slice', 'views', 'hidden', 'rotate', 'spin', 'orient', 'span', 'track', 'homing'].forEach((id, i) => {
    E.est.exEntry(r4, id);
    Object.assign(r4.ex[id], { n: 70 + i, mu: 0, sd: 0.4, last: T0 - DAY, rev: { iv: 1, next: T0 + 5 * DAY } });
  });
  const ch3 = SCH.choose(r4, { pin: 'fold' }, T0);
  t.ok(SCH.group('fold').includes(ch3.roles.variety), 'focus at S4: the variety slot takes a similar-looking exercise (' + ch3.roles.variety + ')');
  delete r4.ex.homing;
  r4.ex.span.rev = { iv: 1, next: T0 - 2 * DAY }; // a review is due, so the review slot is taken
  const ch4 = SCH.choose(r4, { pin: 'fold' }, T0);
  t.eq([ch4.roles.review, ch4.roles.variety], ['span', 'homing'], '… unless an exercise was never tried: it comes first, so none is starved');
  const rf = newRecord(PX, T0), settled = (id, mu) => {
    E.est.exEntry(rf, id);
    Object.assign(rf.ex[id], { n: 70, mu, sd: 0.3, last: T0 - DAY, rev: { iv: 1, next: T0 + 5 * DAY }, snap: [[10, 0, 0.3]] });
  };
  PX.ex.list('train').forEach((d) => { if (d.id !== 'homing') settled(d.id, d.id === 'span' ? 1 : 0); });
  t.eq(E.bandit.lp(rf, PX.ex.get('span')).lp, 2, 'a fast-progressing exercise has the highest learning progress (2, the cap)');
  t.eq(SCH.choose(rf, {}, T0).roles.focus, 'homing', 'while an exercise is untried, it takes the focus');
  settled('homing', 0);
  t.eq(SCH.choose(rf, {}, T0).roles.focus, 'span', '… then the highest learning progress does');

  // A new user meets untried exercises in the beginner order (Track, Homing and Reckon last), each
  // marked 'new' in roleOf; a pinned one keeps its 'focus' role.
  const rb = newRecord(PX, T0), seen = [];
  const order = E.config.session.beginner.filter((id) => PX.ex.get(id));
  for (let k = 0; k * 3 < order.length; k++) {
    const cb = SCH.choose(rb, {}, T0 + k * DAY);
    seen.push(...cb.exs.filter((id) => !(rb.ex[id] && rb.ex[id].n > 0)));
    cb.exs.forEach((id) => { E.est.exEntry(rb, id); Object.assign(rb.ex[id], { n: 30, mu: 0, sd: 0.6, last: T0 + k * DAY, rev: { iv: 0, next: T0 + 30 * DAY } }); });
    if (k === 0) t.eq([cb.exs, cb.roleOf], [['rotate', 'fold', 'spin'], { rotate: 'new', fold: 'new', spin: 'new' }], 'first session: Rotate, Fold, Spin, each with the role ‘new’');
  }
  t.eq(seen.slice(0, order.length), order, 'untried exercises come in the beginner order, Track, Homing and Reckon last (' + order.length + ' exercises)');
  t.eq(order.slice(0, 11).filter((id) => ['knots', 'reckon'].indexOf(id) < 0), ['rotate', 'fold', 'spin', 'nets', 'views', 'slice', 'orient', 'hidden', 'span', 'track', 'homing'].slice(0, order.filter((id) => ['knots', 'reckon'].indexOf(id) < 0).length), 'v1.0 order kept');
  t.ok(E.config.session.beginner.indexOf('knots') === E.config.session.beginner.indexOf('nets') + 1 && E.config.session.beginner.indexOf('reckon') === E.config.session.beginner.indexOf('homing') + 1, 'Knots comes after Nets and Reckon after Homing (H6)');
  t.eq(SCH.choose(newRecord(PX, T0), { pin: 'track' }, T0).roleOf, { track: 'focus', rotate: 'new', fold: 'new' }, 'a pinned exercise keeps the focus role; the other untried ones are ‘new’');
  const fresh0 = newRecord(PX, T0), p0 = E.modes.start(fresh0, 'train', { now: T0, minutes: 20 });
  t.ok(['rotate', 'fold', 'spin'].includes(E.modes.next(p0, fresh0, T0).exId) && p0.roleOf.rotate === 'new', 'a new user’s first Train session opens with a visuospatial exercise, never Track (plan.roleOf)');

  const b = SCH.build(newRecord(PX, T0), { minutes: 20 }, T0);
  const qs = b.exs.map((id) => b.quota[id]);
  t.eq(qs.reduce((a, x) => a + x, 0), b.total, 'quotas add up to the session total');
  t.ok(b.exs.every((id) => b.shares[id] >= 0.2 - 1e-9 && b.shares[id] <= 0.5 + 1e-9), 'each exercise gets 20–50 % of the trials');
  const per = b.exs.reduce((a, id) => a + b.shares[id] * b.msPer[id], 0);
  t.eq(b.total, Math.max(10, Math.round(20 * 60000 / per)), 'the time budget becomes trials with per-exercise trial times');

  const runs = (stage, n) => {
    const plan = { exs: ['nets', 'views', 'rotate'], quota: { nets: 200, views: 200, rotate: 200 }, count: {}, stage: { nets: stage, views: stage, rotate: stage }, run: null, rng: PX.rng(4) };
    const out = [];
    for (let i = 0; i < n; i++) { const r = SCH.nextRun(plan, newRecord(PX, T0)); out.push(r); plan.count[r.exId] = (plan.count[r.exId] || 0) + r.len; }
    return out;
  };
  t.eq([runs(1, 3)[0].len, runs(2, 3)[0].len, runs(3, 3)[0].len, runs(4, 3)[0].len], [20, 10, 5, 2], 'run lengths S1 20, S2 10, S3 5, S4 2');
  const r5 = runs(5, 400), l5 = r5.map((r) => r.len);
  const sw = r5.length / l5.reduce((a, x) => a + x, 0);
  t.ok(Math.abs(sw - 0.7) < 0.05, 'S5: about 70 % of trials switch exercise (' + (100 * sw).toFixed(0) + ' %)');
  const r1 = runs(1, 15);
  t.ok(r1.every((r, i) => i === 0 || r.exId !== r1[i - 1].exId), 'never the same exercise in two runs in a row while others have trials left');
  t.ok(r1.every((r) => r.variant !== undefined) && runs(2, 3).every((r) => r.variant === undefined), 'S1 keeps one variant per run; S2 mixes variants');
  const r4s = runs(4, 40), pair = r4s.slice(1).filter((r, i) => SCH.similar(r.exId, r4s[i].exId));
  t.ok(pair.length > 20 && pair.every((r) => !r.banner), 'S4 alternates similar-looking exercises without a name banner (' + pair.length + '/39)');
  t.ok(r4s.some((r) => r.exId === 'rotate') && r4s.filter((r) => r.exId === 'rotate').every((r) => r.banner), 'another exercise still gets runs, with its name');
  t.ok(runs(3, 5).slice(1).every((r) => r.banner), 'below S4 a switch shows the name');
}

/* ===================================================================== Train */

function testTrain(t) {
  t.section('modes: Train');
  const PX = t.mk(), E = PX.engine, M = E.model;
  const rec = newRecord(PX, T0), L = new Learner(PX, 7);
  const r = playSession(PX, rec, L, 'train', { now: T0, minutes: 20, display: 'large' }, 0);
  const steps = r.steps;
  t.ok(!r.deadEnd && steps.length >= 30 && r.plan.done, 'a Train session runs to its end (' + steps.length + ' items)');
  t.eq(steps.slice(0, 2).map((s) => s.step.kind), ['warmup', 'warmup'], 'two easy warm-up items first');
  const lastS = steps[steps.length - 1].step;
  t.eq(lastS.kind, 'last', 'the session ends on its closing item');
  t.near(lastS.target, M.kindTarget('last', r.plan.k, lastS.g), 1e-12, 'the closing item aims at p* + 0.10');
  t.eq(rec.trials.length, steps.length, 'one trial row per answer');
  t.ok(rec.trials.every((row) => row.length === 12), 'rows have 12 columns');
  t.ok(steps.every((s) => s.out.row[8] === Math.round(s.step.pPred * 1000) && s.out.row[9] === s.step.stage && s.step.stage >= 1 && s.step.stage <= 5), 'rows carry pPred × 1000 and the interleaving stage');
  t.eq(new Set(rec.trials.map((row) => row[4])).size, rec.trials.length, 'every item has its own seed');
  t.eq(rec.idx.mode, ['train'], "trials are logged under the mode 'train'");
  t.eq(r.plan.exs.length, 3, 'three exercises per session');
  t.ok(['focus', 'review', 'variety'].every((k) => r.plan.roles[k]), 'focus, review and variety roles');
  const counts = {};
  steps.forEach((s) => { counts[s.step.exId] = (counts[s.step.exId] || 0) + 1; });
  t.ok(r.plan.exs.every((id) => (counts[id] || 0) <= r.plan.quota[id] + 1), 'no exercise beyond its quota');
  t.eq(rec.sessions.length, 1, 'finish() records the session');
  const ses = rec.sessions[0];
  t.ok(ses.trials === steps.length && ses.right === steps.filter((s) => s.out.outcome === 1).length && ses.practiceMs > 60000, 'session counts and practice time');
  t.ok(ses.summary && Array.isArray(ses.summary.ex), 'a compact summary is kept with the session');
  t.ok(r.fin.summary.lines.length >= 1 && r.fin.summary.per.every((x) => x.level && x.level.after >= 1), 'the summary gives level changes with a noise line');
  t.ok(Array.isArray(r.fin.achievements) && !r.fin.achievements.some((a) => a.id === 'first-session'), 'finishing a session checks achievements; showing up alone earns none');
  t.ok(r.plan.exs.every((id) => rec.ex[id].rev && rec.ex[id].rev.next > T0), 'practised exercises get their next review date');

  // Item mix over a long session
  const r2 = playSession(PX, newRecord(PX, T0), new Learner(PX, 8), 'train', { now: T0, minutes: 90, display: 'large' }, 0);
  const kinds = {};
  r2.steps.forEach((s) => { kinds[s.step.kind] = (kinds[s.step.kind] || 0) + 1; });
  const mixN = r2.steps.length - 3;
  t.ok(Math.abs(kinds.target / mixN - 0.8) < 0.04 && Math.abs(kinds.easy / mixN - 0.1) < 0.03 && Math.abs(kinds.stretch / mixN - 0.1) < 0.03,
    'item mix: 80 % target, 10 % easier, 10 % stretch (' + [kinds.target, kinds.easy, kinds.stretch].join('/') + ')');
  t.ok(r2.steps.every((s) => s.step.g === PX.ex.get(s.step.exId).chance(s.step.params) && Math.abs(s.step.target - M.kindTarget(s.step.kind, r2.plan.k, s.step.g)) < 1e-12), 'every item carries def.chance(params) and aims at its own target');

  // Spin and Rotate guess at different rates per variant: each rating update uses the item's own.
  const PXg = t.mk(), Eg = PXg.engine, seen = [], rate0 = Eg.est.rate;
  Eg.est.rate = function (rc, def, params, ok, at, o) { seen.push([def.chance(params), o && o.g]); return rate0.apply(this, arguments); };
  const rg = playSession(PXg, newRecord(PXg, T0), new Learner(PXg, 13), 'train', { now: T0, minutes: 30, can: (d) => d.id === 'rotate' || d.id === 'spin' }, 0);
  t.ok(!rg.deadEnd && seen.length >= 20 && seen.every(([g, used]) => g === used) && new Set(seen.map((x) => x[0])).size >= 2, 'Train rates Spin and Rotate items with their variant’s guessing rate (' + seen.length + ' updates)');

  // "Train this exercise" (opts.pin): the pinned exercise opens every session, with the warm-ups
  // and then its first block.
  const trainIds = PX.ex.list('train').map((d) => d.id);
  let leadOk = 0, blockOk = 0;
  for (let i = 0; i < 300; i++) {
    const id = trainIds[i % trainIds.length], rp = newRecord(PX, T0), at = T0 + i * 7 * 3600e3, st = [];
    const pl = E.modes.start(rp, 'train', { now: at, minutes: 20, pin: id });
    for (let j = 0; j < 4; j++) { const x = E.modes.next(pl, rp, at + j * 6000); if (x.done) break; st.push(x); E.modes.answer(pl, rp, x, { correct: true, rt: 2000 }, at + j * 6000 + 3000); }
    if (pl.roles.focus === id && st[0].exId === id && st[1].exId === id && st[0].kind === 'warmup' && st[1].kind === 'warmup' && st[0].banner) leadOk++;
    if (st.length === 4 && st[2].exId === id && st[3].exId === id) blockOk++;
  }
  t.eq([leadOk, blockOk], [300, 300], 'a pinned exercise opens every session: the warm-ups, then its first block (300 fresh sessions)');
  const someFirst = new Set();
  for (let i = 0; i < 40; i++) { const rp = newRecord(PX, T0), at = T0 + i * 7 * 3600e3, pl = E.modes.start(rp, 'train', { now: at, minutes: 20 }); someFirst.add(E.modes.next(pl, rp, at).exId === pl.roles.focus); }
  t.eq(someFirst.size, 2, 'without a pin, the first run is still drawn by share');

  // Stutter and skip never update a rating; the item is replaced.
  const rec3 = newRecord(PX, T0), plan = E.modes.start(rec3, 'train', { now: T0, minutes: 10 });
  const s1 = E.modes.next(plan, rec3, T0), def1 = PX.ex.get(s1.exId), before = clone(rec3.ex[s1.exId] || {});
  const o1 = E.modes.answer(plan, rec3, s1, { outcome: 'stutter', rt: 900 }, T0 + 5000);
  t.ok(o1.outcome === 2 && !o1.rated && o1.row[5] === 2, 'a stuttered trial is logged with outcome 2 and not rated');
  t.eq([(rec3.ex[s1.exId] || {}).mu, (rec3.ex[s1.exId] || {}).n], [before.mu, before.n], 'it leaves the rating unchanged');
  const o2 = E.modes.answer(plan, rec3, s1, { correct: true, rt: 900 }, T0 + 6000);
  t.ok(o2 === o1 && rec3.trials.length === 1, 'a second answer to the same step changes nothing');
  const s2 = E.modes.next(plan, rec3, T0 + 6000);
  E.modes.answer(plan, rec3, s2, { outcome: 'skipped' }, T0 + 9000);
  t.eq(rec3.trials[1][5], 3, 'a skipped trial is logged with outcome 3');
  t.eq(plan.extra, 2, 'voided trials are replaced (up to a quarter more)');
  void def1;

  // Unavailable and empty cases never dead-end.
  const p0 = E.modes.start(newRecord(PX, T0), 'train', { now: T0, can: () => false });
  t.ok(p0.done && /No exercise/.test(p0.unavailable) && E.modes.next(p0, null, T0).done, 'no runnable exercise: a clear message, never a dead end');
  t.throws(() => E.modes.start(newRecord(PX, T0), 'train', {}), /opts.now/, 'the engine never reads the clock: now is required');
  t.throws(() => E.modes.start(newRecord(PX, T0), 'nope', { now: T0 }), /unknown mode/, 'unknown modes are rejected');
  const one = playSession(PX, newRecord(PX, T0), new Learner(PX, 9), 'train', { now: T0, minutes: 10, can: (d) => d.id === 'span' }, 0);
  t.ok(!one.deadEnd && one.plan.exs.length === 1 && one.steps.length >= 10, 'a single available exercise still makes a whole session');

  // Time budget: slow answers end the session on time with its closing item.
  const slow = newRecord(PX, T0), sp = E.modes.start(slow, 'train', { now: T0, minutes: 5 });
  let now = T0, n = 0, lastKind = null;
  for (;;) {
    const s = E.modes.next(sp, slow, now);
    if (s.done || ++n > 500) break;
    now += 60000;
    E.modes.answer(sp, slow, s, { correct: true, rt: 59000 }, now);
    lastKind = s.kind;
  }
  t.ok(n <= 7 && lastKind === 'last', 'a 5-minute budget with 1-minute answers ends after about 5 items, on the closing item (' + n + ')');

  // One level per rating: block-end notes, the summary and personal bests read one scale.
  const scripted = (answers, pin) => {
    const P = t.mk(), Ex = P.engine, rs = newRecord(P, T0), pl = Ex.modes.start(rs, 'train', { now: T0, minutes: 30, pin, count: 1 });
    const notes = [];
    let at = T0;
    for (let i = 0; i < answers.length; i++) {
      const x = Ex.modes.next(pl, rs, at);
      at += 7000;
      const o = Ex.modes.answer(pl, rs, x, { correct: answers[i], rt: 2500 }, at);
      if (o.blockEnd) notes.push({ be: o.blockEnd, shownNow: Ex.est.shown(rs, P.ex.get(pin), { display: pl.display }), i });
    }
    return { P, Ex, rs, pl, notes, res: Ex.modes.finish(pl, rs, at + 60000), level0: pl.level0[pin] };
  };
  const pattern = Array.from({ length: 30 }, (_, i) => i % 10 !== 9); // 9 of 10 right in every block
  const A1 = scripted(pattern, 'fold'), row = A1.res.summary.per[0], last = A1.notes[A1.notes.length - 1].be;
  t.ok(A1.notes.length === 3 && A1.notes.every((x) => ['level', 'lo', 'hi', 'exact'].every((k) => x.be.after[k] === x.shownNow[k])), 'every block-end note is est.shown at that moment (one function for level and range)');
  t.eq([row.level.after, row.level.lo, row.level.hi], [last.after.level, last.after.lo, last.after.hi], 'no item after the last note: the summary’s level and range equal that note’s');
  t.ok(row.level.before === A1.level0.level && A1.notes[0].be.before.level === A1.level0.level, 'the summary’s “before” and the first note’s “before” are the level at the session start');
  t.ok(A1.notes.every((x, i) => i === 0 || x.be.before === A1.notes[i - 1].be.after), 'each note starts where the previous one ended');
  const bestLv = Math.max(...A1.notes.filter((x) => x.be.block.reached).map((x) => x.be.after.level));
  t.ok(A1.res.bests.length === 1 && A1.res.bests[0].level === bestLv && A1.notes.some((x) => x.be.after.level === A1.res.bests[0].level), 'the personal best is a level a note showed (the highest after a block that reached the reference)');
  t.eq(A1.rs.ex.fold.best.block.level, A1.res.bests[0].level, '… and the stored best is the same number');
  const A2 = scripted(pattern.concat([true, true, true, true, true]), 'fold'), row2 = A2.res.summary.per[0];
  const now2 = A2.Ex.est.shown(A2.rs, A2.P.ex.get('fold'), { display: A2.pl.display });
  t.ok(row2.level.after === now2.level && row2.level.lo === now2.lo && row2.level.hi === now2.hi, 'with answers after the last note, the summary shows est.shown at the end');
  const A3 = scripted(Array.from({ length: 20 }, (_, i) => i % 2 === 0), 'fold');
  t.ok(A3.notes.every((x) => x.be.block.right === 5 && !x.be.block.reached) && A3.res.bests.length === 0, 'blocks below the reference (5 of 10) set no best');
}

/* ========================================================= seeds across tabs */

function testSeedSalt(t) {
  t.section('seeds across tabs');
  // Two tabs on one record: each page load draws its own training seeds; replays use the logged seed.
  const base = newRecord(t.mk(), T0);
  const tab = (startAt) => {
    const P = t.mk(), Ex = P.engine, r = JSON.parse(JSON.stringify(base)), pl = Ex.modes.start(r, 'train', { now: startAt, minutes: 20 });
    const seeds = [];
    for (let i = 0; i < 60; i++) { const x = Ex.modes.next(pl, r, startAt + i * 5000); if (x.done) break; seeds.push(x.seed); Ex.modes.answer(pl, r, x, { correct: true, rt: 2000 }, startAt + i * 5000 + 3000); }
    return { P, Ex, r, seeds };
  };
  const a = tab(T0), b = tab(T0 + 4321), same = a.seeds.filter((x) => b.seeds.includes(x)).length;
  t.ok(a.seeds.length === 60 && b.seeds.length === 60 && same === 0, 'two tabs opened at different times draw no common training seed (' + same + ' of 60)');
  t.ok(a.P.engine.select.pageSalt() !== b.P.engine.select.pageSalt(), 'each page load has its own salt');
  t.eq(tab(T0).seeds, a.seeds, 'the same page start gives the same seeds (deterministic for tests and replays)');
  t.ok(a.r.trials.every((row, i) => row[4] === a.seeds[i]), 'every seed is logged with its trial');
  const fresh = JSON.parse(JSON.stringify(a.r));
  delete fresh.eng.seedN;
  a.Ex.select.syncSeeds(fresh);
  t.eq(fresh.eng.seedN, a.r.eng.seedN, 'a lost counter is read back from the logged seeds');
  const more = [];
  for (let i = 0; i < 200; i++) more.push(a.Ex.select.seed(a.r));
  t.eq(new Set(a.seeds.concat(more)).size, 260, 'seeds never repeat within a record');
  // A tab that adopts the other tab's older save while an item is on screen.
  const P2 = t.mk(), E2 = P2.engine, r1 = newRecord(P2, T0), pl2 = E2.modes.start(r1, 'train', { now: T0, minutes: 10 });
  const s1 = E2.modes.next(pl2, r1, T0), older = JSON.parse(JSON.stringify(r1));
  older.eng.seedN = 0;
  E2.modes.answer(pl2, older, s1, { correct: true, rt: 2000 }, T0 + 3000);
  t.ok(E2.modes.next(pl2, older, T0 + 4000).seed !== s1.seed, '… even after adopting an older copy mid-item: the counter stays above every logged seed');
  const d1 = a.P.engine.daily.items('2026-11-05'), d2 = b.P.engine.daily.items('2026-11-05');
  t.eq(d1, d2, 'Daily Challenge items stay the same on every page');
  const ck = (P, at) => { const r = newRecord(P, T0), pl = P.engine.modes.start(r, 'check', { now: at }); return P.engine.modes.next(pl, r, at).seed; };
  t.eq(ck(a.P, T0 + 1), ck(b.P, T0 + 99999), 'Spatial Check items keep their shared seeds');
}

/* ================================================================= Free play */

function testFree(t) {
  t.section('modes: Free play');
  const PX = t.mk(), E = PX.engine, rec = newRecord(PX, T0), L = new Learner(PX, 3);
  playSession(PX, rec, L, 'train', { now: T0, minutes: 10, pin: 'fold' }, 0);
  const ex = clone(rec.ex), timed = clone(rec.timed);
  const r = playSession(PX, rec, L, 'free', { now: T0 + DAY, exId: 'fold', params: { folds: 3, type: 1, punches: 2 }, trials: 12 }, 1);
  t.ok(r.steps.length === 12 && r.steps.every((s) => s.step.params.folds === 3 && s.step.params.type === 1 && s.step.params.punches === 2), 'fixed settings are respected');
  const exAfter = clone(rec.ex);
  ['mu', 'sd', 'n', 'nRight', 'last', 'hist', 'snap'].forEach((k) => {
    t.eq(exAfter.fold ? exAfter.fold[k] : undefined, ex.fold ? ex.fold[k] : undefined, 'Free play never changes a rating (' + k + ')');
  });
  t.eq(rec.timed, timed, '… nor the timed rating');
  t.ok(r.steps.every((s) => !s.out.rated && rec.idx.mode[s.out.row[2]] === 'free'), "answers are logged under 'free'");
  const ad = playSession(PX, rec, L, 'free', { now: T0 + 2 * DAY, exId: 'nets', trials: 8 }, 2);
  t.ok(ad.steps.length === 8 && ad.steps.every((s) => Math.abs(s.step.pPred - s.step.target) < 0.2), 'adaptive Free play picks items near the target without rating');
  const bad = E.modes.start(rec, 'free', { now: T0, exId: 'fold', params: { folds: 9, type: 0, punches: 0 } });
  t.ok(bad.done && /not valid/.test(bad.unavailable), 'invalid settings give a message');
  t.ok(E.modes.start(rec, 'free', { now: T0 }).unavailable, 'Free play needs an exercise');
}

/* ====================================================================== Path */

function testPath(t) {
  t.section('modes: Path');
  const PX = t.mk(), E = PX.engine, P = E.path, fold = PX.ex.get('fold');
  const rg = E.model.range(fold);
  t.near(P.band(fold, 1).lo, rg.min, 1e-12, 'stage 1 starts at the easiest difficulty');
  t.near(P.band(fold, 10).hi, rg.max, 1e-12, 'stage 10 ends at the hardest');
  for (const def of PX.ex.list('train')) {
    let ok = true;
    for (let s = 1; s <= 10; s++) if (!P.items(def, s).list.length) ok = false;
    t.ok(ok, def.id + ': every stage has items (coarse pools borrow the nearest)');
  }
  t.near(P.gateT(fold), 0.85, 1e-12, 'the gate for 4-option items is 0.85 (open 0.80, 2-option 0.90)');
  t.near(P.gateT(PX.ex.get('nets')), 0.9, 1e-12, '… 0.90 for yes/no');

  const rec = newRecord(PX, T0), L = new Learner(PX, 11);
  const ls = L.exState(fold);
  ls.theta0 = rg.min + 3.4; // able on the first stages
  const res = [];
  let day = 0;
  for (; day < 6 && !(rec.path.fold && rec.path.fold.passed[3]); day++) {
    res.push(playSession(PX, rec, L, 'path', { now: T0 + day * DAY, exId: 'fold', minutes: 15 }, day));
  }
  const ps = rec.path.fold;
  t.ok(ps && ps.passed[1] && ps.passed[2], 'an able learner passes the first stages (stage now ' + (ps && ps.stage) + ')');
  const first = res[0].steps;
  t.ok(first[0].step.watch === true && first[0].step.preset && first[0].step.pathStage === 1, 'the first item of a new stage asks for Watch and names the preset');
  t.ok(res.every((r) => !r.deadEnd), 'Path sessions never dead-end');
  const st1 = first.filter((s) => s.step.pathStage === 1 && s.step.kind === 'target');
  const k1 = P.items(fold, 1).keys;
  t.ok(st1.length && st1.every((s) => k1[s.step.key]), 'target items come from the current stage');
  t.ok(first.filter((s) => s.out.path && s.out.path.passed === 1).length <= 1, 'a stage passes once');
  const passIdx = first.findIndex((s) => s.out.path && s.out.path.passed === 1);
  t.ok(passIdx < 0 || first.slice(0, passIdx + 1).filter((s) => s.step.pathStage === 1 && s.step.kind !== 'warmup').length >= 10, 'never before 10 items at the stage');
  t.near(ps.passed[1].next - ps.passed[1].at, 3 * DAY, 1, 'the first recheck is 3 days after passing');

  // Recheck due: 5 items of that stage, then hold (interval grows) or reopen (back to 3 days).
  const at = ps.passed[1].next + DAY / 4;
  const plan = E.modes.start(rec, 'path', { now: at, exId: 'fold', minutes: 10 });
  t.ok(plan.rechecks.some((x) => x.s === 1), 'a due recheck joins the next Path session');
  let now = at;
  const rc = [];
  for (let i = 0; i < 5; i++) {
    const s = E.modes.next(plan, rec, now);
    rc.push(s);
    now += 8000;
    E.modes.answer(plan, rec, s, { correct: true, rt: 3000 }, now);
  }
  t.ok(rc.every((s) => s.recheck === 1 || s.recheck === plan.rechecks[0].s), 'recheck items come first');
  t.ok(rec.path.fold.passed[1].held && rec.path.fold.passed[1].iv === 1, 'a held recheck moves to the next interval (7 days)');
  E.modes.finish(plan, rec, now);
  rec.ex.fold.mu = rg.min - 2;
  now = rec.path.fold.passed[1].next + DAY;
  const p2 = E.modes.start(rec, 'path', { now, exId: 'fold', minutes: 10 });
  const rs = p2.rechecks[0].s;
  for (let i = 0; i < 5; i++) { const s = E.modes.next(p2, rec, now); now += 8000; E.modes.answer(p2, rec, s, { correct: false, rt: 3000 }, now); }
  t.ok(rec.path.fold.passed[rs].held === false && rec.path.fold.passed[rs].iv === 0, 'a failed recheck reopens the stage and resets to 3 days');
  t.near(rec.path.fold.passed[rs].next - now, 3 * DAY, 1, '… due again in 3 days');
  const fin = E.modes.finish(p2, rec, now);
  t.ok(fin.path && fin.path.exId === 'fold' && Array.isArray(fin.path.rechecks), 'finish() reports the Path state');
  t.ok(!/master/i.test(JSON.stringify([fin, res.map((r) => r.fin)])), 'Path never uses the word "mastered"');
  const auto = E.modes.start(rec, 'path', { now: now + 4 * DAY });
  t.eq(auto.exs, ['fold'], 'without a choice, Path opens the exercise with a due recheck');

  // Mixed guessing rates (Rotate: same/different 1/2, pick one of six 1/6): the moving average
  // is held against the same moving average of each item's own threshold g + (1 − g)·0.80.
  const rot = PX.ex.get('rotate'), rr = newRecord(PX, T0), Lr = new Learner(PX, 12);
  Lr.exState(rot).theta0 = E.model.range(rot).min + 3.4;
  const pr = [0, 1, 2].map((d) => playSession(PX, rr, Lr, 'path', { now: T0 + d * DAY, exId: 'rotate', minutes: 15 }, d));
  const rsteps = pr.flatMap((x) => x.steps);
  t.ok(rsteps.every((x) => x.step.g === rot.chance(x.step.params)), 'every Path item carries its own guessing rate, def.chance(params)');
  t.ok(new Set(rsteps.map((x) => x.step.g)).size === 2, 'both Rotate formats appear on the Path');
  let ge = null, gi = 0, gs = 1, gmax = 0;
  for (const x of rsteps) {
    if (x.step.recheck || x.step.kind === 'warmup' || x.step.pathStage !== gs) continue;
    const thr = x.step.g + (1 - x.step.g) * 0.8;
    ge = gi > 0 && ge !== thr ? 0.85 * ge + 0.15 * thr : thr;
    gi += 1;
    if (x.out.path && x.out.path.passed === gs) { gmax = gs; gs += 1; ge = null; gi = 0; }
  }
  const rps = rr.path.rotate;
  t.ok(gmax >= 1 && rps.stage === gs, 'an able learner passes Rotate stages with mixed formats (stage ' + rps.stage + ')');
  t.ok(gi === 0 ? rps.gema === undefined : Math.abs(rps.gema - ge) < 1e-12, 'the gate follows each answered item’s own threshold');
  t.near(pr[2].fin.path.gate, gi === 0 ? P.gateT(rot) : ge, 1e-12, 'finish() reports that gate');
  t.eq(P.gateOf(fold, rec.path.fold), P.gateT(fold), 'with one guessing rate the gate is g + (1 − g)·0.80 exactly');
  for (const x of [rec, rr]) for (const f of E.fields()) t.eq(f.fix(clone(x[f.key])), x[f.key], f.key + ': a record after Path sessions passes its fixer unchanged');
}

/* ===================================================================== Speed */

function testSpeed(t) {
  t.section('modes: Speed');
  const PX = t.mk(), E = PX.engine, nets = PX.ex.get('nets'), rec = newRecord(PX, T0);
  const closed = E.modes.start(rec, 'speed', { now: T0, exId: 'nets' });
  t.ok(closed.done && /Path stage|60 trials/.test(closed.unavailable), 'Speed is closed at first, with the reason');
  E.est.exEntry(rec, 'nets');
  Object.assign(rec.ex.nets, { mu: 0.5, sd: 0.4, n: 60, nRight: 50, last: T0 - DAY });
  const ni = rec.idx.ex.push('nets@1') - 1, mi = rec.idx.mode.push('train') - 1;
  for (let i = 0; i < 20; i++) rec.trials.push([Math.floor(T0 / 1000) - 5000 + i * 9, ni, mi, 0, 1000 + i, 1, 2000, null, 800, 1]);
  t.ok(E.speed.open(rec, nets).ok, 'it opens after 60 trials with σ ≤ 0.45');
  const untimed = clone(rec.ex.nets);
  const plan = E.modes.start(rec, 'speed', { now: T0, exId: 'nets', minutes: 5 });
  t.ok(!plan.done && plan.sc && Math.abs(Math.pow(10, plan.sc.x) - 3000) < 1, 'the first deadline is 1.5 × the median untimed time (2000 ms)');
  let now = T0, deadlines = [];
  for (let i = 0; i < 12; i++) {
    const s = E.modes.next(plan, rec, now);
    if (s.done) break;
    deadlines.push(s.deadlineMs);
    t.ok(s.timed && E.est.predict(E.est.get(rec, nets), s.b, s.g) >= E.model.target(s.g, 0.85) - 1e-9, 'Speed items come from settings answered at least 85 % right above chance untimed');
    now += 4000;
    E.modes.answer(plan, rec, s, { correct: true, rt: 500 }, now);
  }
  t.ok(deadlines[deadlines.length - 1] < deadlines[0], 'fast right answers shorten the deadline');
  const s = E.modes.next(plan, rec, now), dBefore = s.deadlineMs;
  const o = E.modes.answer(plan, rec, s, { correct: true, rt: dBefore + 500 }, now + 5000);
  t.ok(!o.inTime && o.deadlineMs > dBefore, 'a late answer counts as a miss and lengthens the deadline');
  ['mu', 'sd', 'n'].forEach((k) => t.eq(rec.ex.nets[k], untimed[k], 'Speed leaves the untimed rating alone (' + k + ')'));
  t.ok(rec.timed.nets.n >= 13, 'Speed has its own timed rating');
  const fin = E.modes.finish(plan, rec, now + 6000);
  t.ok(fin.speed && fin.speed.bis === 0 && fin.speed.rcs > 0 && rec.timed.nets.deadline > 0, 'Speed reports rate correct and BIS (0 for the first session) and keeps the deadline');

  // One guessing rate per timed session: the chosen variant, else the first.
  const rot = PX.ex.get('rotate');
  E.est.exEntry(rec, 'rotate');
  Object.assign(rec.ex.rotate, { mu: 0.5, sd: 0.4, n: 60, nRight: 50, last: T0 - DAY });
  const runSpeed = (opts, at) => {
    const pl = E.modes.start(rec, 'speed', { now: at, exId: 'rotate', minutes: 3, ...opts });
    const st = [];
    for (let i = 0; i < 15; i++) { const x = E.modes.next(pl, rec, at + i * 5000); if (x.done) break; st.push(x); E.modes.answer(pl, rec, x, { correct: true, rt: 900 }, at + i * 5000 + 4000); }
    return { pl, st, fin: E.modes.finish(pl, rec, at + 80000) };
  };
  const sp1 = runSpeed({ variant: 'pick' }, T0 + DAY);
  t.ok(sp1.st.length >= 5 && sp1.st.every((x) => x.params.variant === 'pick' && x.g === rot.chance(x.params)), 'Speed keeps to the chosen variant, each item with its own guessing rate');
  t.near(sp1.pl.sc.p, E.model.target(1 / 6, sp1.pl.k), 1e-12, '… and the deadline staircase aims at that variant’s target');
  const comf = E.modes.start(rec, 'speed', { now: T0 + 3 * DAY, exId: 'rotate', minutes: 3, style: 'comfortable' });
  t.ok(comf.k === 0.85 && Math.abs(comf.sc.p - E.model.target(rot.chance({ variant: rot.variants[0] }), 0.7)) < 1e-12, 'Comfortable (k 0.85) aims its deadline at most 0.70 above chance, below the fluency bar');
  t.ok(sp1.fin.speed.variant === 'pick' && rec.timed.rotate.variant === 'pick', 'the variant is reported and kept with the deadline');
  const sp2 = runSpeed({}, T0 + 2 * DAY);
  t.ok(sp2.st.every((x) => x.params.variant === rot.variants[0]) && Math.abs(sp2.st[0].deadlineMs - 1.5 * sp2.pl.refRt) <= 1, 'without a choice: the first variant, and another variant starts from 1.5 × the untimed time');
  for (const f of E.fields()) t.eq(f.fix(clone(rec[f.key])), rec[f.key], f.key + ': a record after Speed sessions passes its fixer unchanged');
}

/* ================================================================= Threshold */

function testThreshold(t) {
  t.section('modes: Threshold');
  const PX = t.mk(), E = PX.engine, rec = newRecord(PX, T0), L = new Learner(PX, 21);
  const track = PX.ex.get('track');
  const r = playSession(PX, rec, L, 'threshold', { now: T0, protocol: 'track-standard' }, 0);
  t.ok(r.steps.length === 20 && !r.deadEnd, 'Track standard: 20 trials');
  const v = (s, k) => track.dims.find((d) => d.key === k).levels[s.step.params[k]];
  t.ok(r.steps.every((s) => v(s, 'targets') === 4 && v(s, 'spheres') === 8 && v(s, 'time') === 8 && s.step.params.variant === 'still'), 'the exercise\u2019s own preset: 8 spheres, 4 targets, 8 s, still camera');
  t.ok(r.steps.every((s) => s.step.params.speedValue > 0 && Math.min(45, Math.max(0, Math.round(40 * Math.log10(s.step.params.speedValue / 0.15)))) === s.step.params.speed), 'a continuous speed in params.speedValue, the nearest level in params.speed');
  t.near(r.steps[0].step.params.speedValue, 0.15 * Math.pow(10, 12 / 40), 0.02, 'the first run starts at the preset level (0.30 cube widths/s)');
  t.ok(r.steps.every((s) => s.step.protocol && s.step.protocol.cueMs === 2000), 'the protocol asks for a 2 s cue');
  const ent = rec.mot['track-standard'];
  t.ok(ent && ent.length === 1 && ent[0].threshold > 0 && ent[0].unit === 'speed' && ent[0].rule === 'standard', 'the threshold is stored in rec.mot');
  t.ok(ent[0].hist.length === 20 && ent[0].hist.every((h, i) => Math.abs(h[0] - r.steps[i].step.params.speedValue) < 1e-3), 'the run record keeps every trial\u2019s exact speed and outcome');
  t.ok(!rec.ex.track || !(rec.ex.track.n > 0), 'Threshold never changes a rating');
  const r2 = E.modes.start(rec, 'threshold', { now: T0 + DAY, protocol: 'track-standard' });
  t.near(r2.sc.x, E.staircase.snap(r2.sc, ent[0].x - 0.1), 0.026, 'the next run starts 0.1 log10 easier than the last estimate');
  const sp = playSession(PX, rec, L, 'threshold', { now: T0 + DAY, protocol: 'span-length' }, 1);
  const se = rec.mot['span-length'][0];
  t.ok(sp.steps.length === 20 && se.threshold >= 2 && se.threshold <= 9 && se.unit === 'items', 'Span length: a discrete staircase in items (' + se.threshold + ')');
  const sd = playSession(PX, rec, L, 'threshold', { now: T0 + 2 * DAY, protocol: 'spin-deadline' }, 2);
  const dd = rec.mot['spin-deadline'][0], spin = PX.ex.get('spin');
  t.ok(dd.unit === 'ms' && dd.threshold > 100 && dd.n === 30, 'Spin deadline: a weighted staircase in milliseconds');
  t.ok(sd.steps.every((s) => s.step.params.variant === spin.variants[0] && s.step.g === spin.chance(s.step.params)) && dd.variant === spin.variants[0], '… on one variant, so every item has the same guessing rate');
  t.near(dd.p, E.model.target(spin.chance({ variant: spin.variants[0] }), sd.plan.k), 1e-4, '… and the staircase aims at that rate’s target');
  t.ok(E.modes.start(rec, 'threshold', { now: T0, protocol: 'nope' }).unavailable, 'unknown protocols give a message');
  const noTrack = t.mk().engine;
  void noTrack;
}

/* ===================================================================== Daily */

function testDaily(t) {
  t.section('daily');
  const PX = t.mk(), E = PX.engine, D = E.daily;
  t.eq([D.number('2026-11-01'), D.number('2026-11-30'), D.number('2027-01-01')], [1, 30, 62], 'Daily #N counts from 1 Nov 2026');
  const tz = [Date.UTC(2026, 10, 1, 23, 30), Date.UTC(2026, 10, 2, 0, 10), Date.UTC(2026, 10, 2, 13, 0)];
  t.eq(tz.map(D.day), tz.map(E.day), 'the day is the local date, the same day boundary as everywhere else (v1.1)');
  t.eq(D.share(5, 6, 8), 'Parallax Daily #5 · 6/8 · discord.gg/chmr', 'the share line');
  const items = D.items('2026-11-05'), other = t.mk().engine.daily.items('2026-11-05');
  t.eq(items, other, 'the same 8 items for everyone (another context, another record)');
  t.ok(items.length === 8 && items.every((it) => !PX.ex.get(it.exId).perDisplay), '8 items, none from screen-dependent exercises');
  t.ok(new Set(items.map((it) => it.seed)).size === 8 && items.every((it) => it.seed >= 2 ** 31), 'distinct shared seeds');
  t.ok(items.every((it) => { const d = PX.ex.get(it.exId), rg = E.model.range(d), mid = (rg.min + rg.max) / 2; return Math.abs(d.difficulty(it.params) - mid) <= 1.0; }), 'fixed medium difficulty');
  t.ok(JSON.stringify(D.items('2026-11-06')) !== JSON.stringify(items), 'a new set every day');
  const rec = newRecord(PX, T0), L = new Learner(PX, 2), now = Date.UTC(2026, 10, 5, 12);
  const r = playSession(PX, rec, L, 'daily', { now }, 3);
  t.ok(r.steps.length === 8 && r.steps.every((s) => s.step.daily.scored && !s.out.rated), 'one scored attempt; items are not rated');
  t.eq(rec.daily['2026-11-05'].right, r.fin.daily.right, 'the result is kept for the day');
  t.eq(r.fin.daily.share, 'Parallax Daily #5 · ' + r.fin.daily.right + '/8 · discord.gg/chmr', 'finish() gives the share line');
  t.ok(D.status(rec, now).done, 'status() says it is done');
  const again = playSession(PX, rec, L, 'daily', { now: now + 3600e3 }, 3);
  t.ok(again.steps.every((s) => !s.step.daily.scored) && rec.daily['2026-11-05'].right === r.fin.daily.right, 'a replay the same day is practice and changes nothing');
  t.ok(!rec.ex || Object.keys(rec.ex).every((id) => !(rec.ex[id].n > 0)), 'the Daily Challenge never changes a rating');
  const rr = newRecord(PX, T0), plan = E.modes.start(rr, 'daily', { now });
  const s1 = E.modes.next(plan, rr, now);
  E.modes.answer(plan, rr, s1, { outcome: 'stutter' }, now + 1000);
  const s2 = E.modes.next(plan, rr, now + 2000);
  t.eq([s2.seed, s2.exId], [s1.seed, s1.exId], 'a stuttered Daily item comes back unchanged');

  // v1.1: an attempt left part-way (End now, a reload) is kept as partial and goes on later.
  const key = D.day(now), rp = newRecord(PX, T0), pp = E.modes.start(rp, 'daily', { now });
  for (let i = 0; i < 3; i++) { const s = E.modes.next(pp, rp, now + i); E.modes.answer(pp, rp, s, { correct: i !== 1, rt: 1000 }, now + i); }
  const f1 = E.modes.finish(pp, rp, now + 10, { activeMs: 30000, ended: 'early' });
  const e1 = rp.daily[key];
  t.eq([e1.partial, e1.answered, e1.right, e1.outcomes], [true, 3, 2, [1, 0, 1, null, null, null, null, null]], 'End now keeps a partial attempt; unanswered items are null, never wrong');
  const st1 = D.status(rp, now);
  t.ok(!st1.done && st1.partial && st1.result === null && f1.daily.partial && f1.daily.share === null && f1.daily.answered === 3, 'status: not done but partial; no share line yet');
  const pq = E.modes.start(rp, 'daily', { now: now + 60000 });
  t.ok(pq.daily.scored && pq.daily.resumed && pq.daily.n === 3 && pq.daily.right === 2, 'the next start resumes the scored attempt');
  const rest = [];
  for (let g = 0; g < 20; g++) {
    const s = E.modes.next(pq, rp, now + 70000);
    if (s.done) break;
    rest.push(s.daily.index);
    const o = E.modes.answer(pq, rp, s, g === 0 ? { outcome: 'skipped' } : { correct: true, rt: 900 }, now + 70000);
    if (g === 4) t.ok(!o.done, 'not over while a skipped item is still to come');
  }
  t.eq(rest, [3, 3, 4, 5, 6, 7], 'only unanswered items come, and a skipped one comes back at once');
  const f2 = E.modes.finish(pq, rp, now + 80000);
  t.eq([rp.daily[key].partial, rp.daily[key].right, rp.daily[key].answered, D.status(rp, now).done, f2.daily.share], [undefined, 7, 8, true, 'Parallax Daily #5 · 7/8 · discord.gg/chmr'], 'answering the rest spends the attempt and gives the share line');
  t.ok(E.daily.pool().every((d) => !d.perDisplay && d.pat !== true), 'the pool: no screen-dependent and no PAT-format exercises');
}

/* ============================================================= Spatial Check */

const PROBES = ['cubematch', 'viewmatch', 'mechanisms', 'patterns', 'wordlinks'];
function mkCheck(date, theta, se, extra = {}) {
  const results = {};
  for (const id of PROBES) results[id] = { right: 10, n: 16, theta: id in extra ? extra[id] : theta, se, rtMed: 2000 };
  return { date: new Date(date).toISOString(), form: 'A', results };
}
function trainSessions(rec, from, n, step = DAY) {
  for (let i = 0; i < n; i++) rec.sessions.push({ id: 'x' + from + '-' + i, start: from + i * step, end: from + i * step + 600000, mode: 'train', trials: 60, right: 45, practiceMs: 600000, exs: ['fold'], summary: null });
}

function testAssess(t) {
  t.section('assess');
  const PX = t.mk(), E = PX.engine, A = E.assess, M = E.model, cm = PX.ex.get('cubematch');
  const lw = A._.newPost(cm), rng = PX.rng(31), resp = [];
  for (let i = 0; i < 16; i++) { const b = rng.float(-2, 2), ok = rng.chance(0.6); resp.push([b, ok]); A._.updatePost(lw, b, 0.5, ok); }
  const s = A._.summary(lw);
  let s0 = 0, s1 = 0, s2 = 0;
  const m0 = A._.priorCenter(cm);
  for (let x = -8; x <= 8; x += 0.001) {
    let w = Math.exp(-((x - m0) ** 2) / (2 * 1.5 * 1.5));
    for (const [b, ok] of resp) w *= ok ? M.p(x, b, 0.5) : 1 - M.p(x, b, 0.5);
    s0 += w; s1 += w * x; s2 += w * x * x;
  }
  t.near(s.mu, s1 / s0, 0.01, 'probe θ = the exact posterior mean (prior N(middle of range, 1.5²))');
  t.near(s.sd, Math.sqrt(s2 / s0 - (s1 / s0) ** 2), 0.01, 'its SE = the posterior SD');

  const rec = newRecord(PX, T0), L = new Learner(PX, 4);
  t.eq(A.due(rec, T0).kind, 'B1', 'first: a baseline check');
  const r = playSession(PX, rec, L, 'check', { now: T0 }, 0);
  t.ok(r.steps.length === 80 && r.steps.every((x) => x.step.feedback === false && x.step.seed >= 2 ** 31), '5 probes × 16 items, no feedback, shared seeds');
  t.eq(new Set(r.steps.map((x) => x.step.seed)).size, 80, 'every probe item has its own seed');
  t.ok(r.steps.every((x) => !x.out.rated) && PROBES.every((id) => !rec.ex[id]), 'probes never create or change a rating');
  const res = rec.assess[0].results;
  t.ok(PROBES.every((id) => res[id].n === 16 && Number.isFinite(res[id].theta) && res[id].se > 0.2 && res[id].se < 1.3 && res[id].rtMed > 0), 'θ, SE and median correct RT per probe');
  t.ok(r.steps.filter((x) => x.step.exId === 'patterns').every((x) => Math.abs(x.step.pPred - x.step.target) < 0.3), 'items aim near g + (1 − g)·0.6');
  // PR-3's guessing rate varies with params (1/2 below the belts level, 1/3 above): each item's own.
  const mech = PX.ex.get('mechanisms'), ms = r.steps.filter((x) => x.step.exId === 'mechanisms');
  t.ok(r.steps.every((x) => x.step.g === PX.ex.get(x.step.exId).chance(x.step.params)), 'every probe item carries def.chance(params), never one rate per probe');
  t.ok(r.steps.every((x) => Math.abs(x.step.target - M.target(x.step.g, x.step.probe.index < 2 ? 0.85 : 0.6)) < 1e-12), '… and aims at its own g + (1 − g)·0.85 for the first 2 items of a probe, then g + (1 − g)·0.6');
  t.ok(PROBES.every((id) => { const ps = r.steps.filter((x) => x.step.exId === id); return ps[0].step.pPred > M.target(ps[0].step.g, 0.6) + 0.05 && ps[1].step.pPred > M.target(ps[1].step.g, 0.6); }), 'so each probe opens on easy items (predicted above the usual target; under the wide prior the easiest items sit near 0.8–0.9)');
  const lwm = A._.newPost(mech), lw1 = A._.newPost(mech);
  for (const x of ms) { A._.updatePost(lwm, x.step.b, x.step.g, x.res.correct === true); A._.updatePost(lw1, x.step.b, 1 / 3, x.res.correct === true); }
  t.ok(new Set(ms.map((x) => x.step.g)).size === 2, 'the Mechanisms check mixed both question types');
  t.near(res.mechanisms.theta, A._.summary(lwm).mu, 1e-4, 'the probe posterior used each item’s own rate');
  t.ok(Math.abs(A._.summary(lw1).mu - A._.summary(lwm).mu) > 1e-3, '… which differs from one rate for the whole probe');

  // Worked examples (learn.js demo) come first, are never scored, and their seeds are never used.
  const runCheck = (P) => {
    const rc = newRecord(P, T0), pl = P.engine.modes.start(rc, 'check', { now: T0 }), out = [];
    for (let i = 0; i < 200; i++) {
      const x = P.engine.modes.next(pl, rc, T0 + i * 9000);
      if (x.done) break;
      out.push(x);
      P.engine.modes.answer(pl, rc, x, { correct: i % 3 !== 0, rt: 2000 }, T0 + i * 9000 + 5000);
    }
    P.engine.modes.finish(pl, rc, T0 + 200 * 9000);
    return { out, rc };
  };
  const plain = runCheck(t.mk()), dSeed = plain.out.find((x) => x.exId === 'cubematch').seed;
  const PXd = t.mk();
  PXd.ex.learn('cubematch', { demo: [{ params: { turns: 0, shared: 0, glyphs: 0 }, seed: dSeed, kind: 'same' }, { params: { turns: 0, shared: 0, glyphs: 0 }, seed: 2, kind: 'different' }] });
  const withDemo = runCheck(PXd), cms = withDemo.out.filter((x) => x.exId === 'cubematch');
  t.ok(cms[0].seed !== dSeed && cms.every((x) => x.seed !== dSeed && x.seed !== 2 && x.seed >= 2 ** 31), 'check items never use a worked example’s seed, even a colliding one');
  t.ok(cms[0].probe.example && cms[0].probe.example.seed === dSeed && cms.slice(1).every((x) => x.probe.example === null), 'the first item of the probe names its worked example to play first, once');
  t.ok(withDemo.out.filter((x) => x.exId !== 'cubematch').every((x, i) => x.seed === plain.out.filter((y) => y.exId !== 'cubematch')[i].seed && x.probe.example === null), 'other probes keep their seeds; without learn data there is no example');
  t.eq(withDemo.rc.assess[0].results.cubematch.n, 16, 'the example is never scored: 16 items count');
  const rt0 = newRecord(PX, T0), pt = E.modes.start(rt0, 'check', { now: T0 }), it0 = E.modes.next(pt, rt0, T0);
  const ot = E.modes.answer(pt, rt0, it0, { timeout: true, rt: 30000 }, T0 + 31000), pr0 = pt.check.probes[0];
  const lt = A._.newPost(PX.ex.get(it0.exId));
  A._.updatePost(lt, it0.b, it0.g, false);
  t.ok(ot.outcome === 0 && pr0.n === 1 && pr0.right === 0 && Math.abs(A._.summary(pr0.lw).mu - A._.summary(lt).mu) < 1e-12, 'a timed-out probe item is scored wrong');
  t.ok(!A.due(rec, T0 + 3600e3).due && A.due(rec, T0 + 13 * 3600e3).due && A.due(rec, T0 + 13 * 3600e3).kind === 'B2', 'B2 is offered from about 12 hours later');
  const r2 = playSession(PX, rec, L, 'check', { now: T0 + DAY }, 1);
  t.ok(r2.steps[0].step.probe.form === 'B' && r2.steps[0].step.seed !== r.steps[0].step.seed, 'the second check uses form B');
  t.ok(['baseline-done', 'baseline'].includes(A.report(rec, T0 + DAY).status), 'after the baselines: no change shown yet');

  // Schedule after the baselines: every 14 days and 8 sessions, whichever is later.
  const rs = newRecord(PX, T0);
  rs.assess.push(mkCheck(T0, 0, 0.3), mkCheck(T0 + DAY, 0.1, 0.3));
  trainSessions(rs, T0 + 2 * DAY, 10);
  t.ok(!A.due(rs, T0 + 12 * DAY).due, 'not before 14 days');
  const rs2 = newRecord(PX, T0);
  rs2.assess.push(mkCheck(T0, 0, 0.3), mkCheck(T0 + DAY, 0.1, 0.3));
  trainSessions(rs2, T0 + 2 * DAY, 5);
  t.ok(!A.due(rs2, T0 + 16 * DAY).due, 'not before 8 sessions');
  trainSessions(rs2, T0 + 8 * DAY, 4, 3600e3);
  const dd = A.due(rs2, T0 + 16 * DAY);
  t.ok(dd.due && dd.kind === 'regular', 'due once both hold');
  const rb = newRecord(PX, T0);
  rb.assess.push(mkCheck(T0, 0, 0.2), mkCheck(T0 + DAY, 1.0, 0.2));
  t.eq(A.due(rb, T0 + 2 * DAY).kind, 'B3', 'B3 when B1 and B2 differ by more than 2 combined SE');
  const rd = newRecord(PX, T0);
  rd.assess.push(mkCheck(T0, 0, 0.3), mkCheck(T0 + DAY, 0.1, 0.3));
  trainSessions(rd, T0 + 2 * DAY, 8);
  t.eq(A.due(rd, T0 + 40 * DAY).kind, 'delayed', 'a delayed check about 4 weeks after training stops');

  // One answer for every screen: nextCheck() → { ready, kind, dueAt, dueDate, daysLeft, sessionsLeft }.
  t.eq([A.nextCheck(newRecord(PX, T0), T0).ready, A.nextCheck(newRecord(PX, T0), T0).kind], [true, 'B1'], 'nextCheck: the first baseline is ready at once');
  const rn = newRecord(PX, T0);
  rn.assess.push(mkCheck(T0, 0, 0.3));
  const n2 = A.nextCheck(rn, T0 + 3600e3);
  t.ok(!n2.ready && n2.kind === 'B2' && n2.dueAt === T0 + DAY / 2 && n2.sessionsLeft === 0 && n2.daysLeft === 1, 'nextCheck: B2 about 12 hours after B1');
  rn.assess.push(mkCheck(T0 + DAY, 0.1, 0.3));
  trainSessions(rn, T0 + 2 * DAY, 3);
  rn.sessions.push({ id: 'short', start: T0 + 6 * DAY, end: T0 + 6 * DAY + 120000, mode: 'train', trials: 8, right: 6, practiceMs: 120000, summary: null });
  rn.sessions.push({ id: 'daily', start: T0 + 6 * DAY + 5e5, end: T0 + 6 * DAY + 9e5, mode: 'daily', trials: 8, right: 6, practiceMs: 400000, summary: null });
  const nr = A.nextCheck(rn, T0 + 5 * DAY);
  t.ok(!nr.ready && nr.kind === 'regular' && nr.sessionsLeft === 5 && nr.daysLeft === 10 && nr.dueDate === PX.engine.day(T0 + 15 * DAY), 'nextCheck: 14 days and 8 sessions after the last check (5 more sessions, 10 more days)');
  t.eq(A.nextCheck(rn, T0 + 7 * DAY).sessionsLeft, 5, 'only training sessions that count for the weekly goal count (≥ 10 answers or 5 minutes): not a short one, not the Daily');
  t.eq(A.nextCheck(rn, T0 + 7 * DAY).sessionsLeft, 8 - rn.sessions.filter((x) => PX.engine.streak.counts(x) && x.mode === 'train' && x.start > T0 + DAY).length, 'the same rule as streak.counts');
  trainSessions(rn, T0 + 7 * DAY, 5);
  const nd = A.nextCheck(rn, T0 + 16 * DAY);
  t.ok(nd.ready && nd.daysLeft === 0 && nd.sessionsLeft === 0 && A.due(rn, T0 + 16 * DAY).due, 'nextCheck agrees with due() once both hold');

  // Change report and the three outcome words.
  const word = (latest, se, b2, ctl) => {
    const x = newRecord(PX, T0);
    x.assess.push(mkCheck(T0, 0, se), mkCheck(T0 + DAY, b2, se), mkCheck(T0 + 20 * DAY, latest, se, { wordlinks: ctl }));
    return A.report(x, T0 + 21 * DAY);
  };
  const big = word(2.0, 0.3, 0.3, 0.3);
  t.eq([big.status, big.composite.outcome, big.probes.cubematch.outcome], ['change', 'beyond familiarity', 'beyond familiarity'], '"beyond familiarity" when the change clears the control and the retest gain');
  t.near(big.probes.cubematch.retest, 0.3, 1e-9, 'retest still expected vs the baseline average = max(0, B2 − B1) after two baselines');
  t.near(big.probes.cubematch.retestRemaining, 0.15, 1e-9, '… of which 0.5 × (B2 − B1) after B2');
  t.near(big.probes.cubematch.change, 2.0 - 0.15, 1e-9, 'change is measured from the baseline average');
  const bx = big.probes.cubematch, sG = Math.sqrt(0.3 * 0.3 + 0.3 * 0.3);
  t.near(bx.retestRemainingSe, 0.5 * sG, 1e-9, 'the remaining retest gain has its own standard error, 0.5·√(se_B1² + se_B2²)');
  t.near(bx.retestSe, sG, 1e-9, '… and the familiarity estimate compared after two baselines, max(0, B2 − B1), has √(se_B1² + se_B2²)');
  t.near((bx.vsRetest.hi - bx.vsRetest.lo) / 2, 1.96 * Math.sqrt(bx.se * bx.se + bx.retestSe * bx.retestSe), 1e-9, 'the familiarity comparison’s 95 % range includes the uncertainty of the familiarity estimate');
  t.near((big.composite.vsRetest.hi - big.composite.vsRetest.lo) / 2, 1.96 * Math.sqrt(big.composite.se ** 2 + (Math.sqrt(4 * sG * sG) / 4) ** 2), 1e-9, '… for the combined probes too');
  t.eq(word(0.9, 0.3, 0.3, 0).composite.outcome, 'unclear yet', 'a change that clears familiarity only if the familiarity estimate were exact stays "unclear yet"');
  const dn = word(2.0, 0.3, -0.2, 0.3).probes.cubematch;
  t.ok(dn.retest === 0 && dn.retestSe === 0 && dn.retestRemainingSe === 0, 'no familiarity estimate and no extra uncertainty when B2 ≤ B1');
  const r3 = newRecord(PX, T0);
  r3.assess.push(mkCheck(T0, 0, 0.2), mkCheck(T0 + DAY, 1.0, 0.2), mkCheck(T0 + 2 * DAY, 1.2, 0.2), mkCheck(T0 + 20 * DAY, 3.0, 0.2));
  const p3 = A.report(r3, T0 + 21 * DAY).probes.cubematch;
  t.ok(p3.baselines === 3 && Math.abs(p3.retest - 2 / 3) < 1e-9 && Math.abs(p3.retestSe - (2 / 3) * Math.sqrt(0.08)) < 1e-9, 'after three baselines the familiarity estimate and its standard error are both 2/3 of the first-to-second gain’s');
  t.eq(word(0.6, 0.3, 0.3, 0.3).composite.outcome, 'unclear yet', '"unclear yet" when the interval still includes familiarity');
  t.eq(word(0.15, 0.05, 0.05, 0.15).composite.outcome, 'no change', '"no change" when even the upper end beyond familiarity is small');
  t.eq(word(2.0, 0.3, 0.3, 2.0).composite.outcome, 'unclear yet', 'a change matched by the control is not called beyond familiarity');
  t.ok(big.probes.wordlinks.outcome === undefined && big.control, 'the control is reported, not judged');
  t.ok(/familiar/.test(big.lines.join(' ')) && !/IQ|percentile|brain age/i.test(JSON.stringify(big)), 'the report names familiarity and never IQ, percentiles or brain age');
  const ex = newRecord(PX, T0);
  t.ok(A.expect(ex, 4, T0) && !A.expect(ex, 2, T0) && ex.spatial.expect.value === 4, 'expectations are asked once');
}

/* ======================================================================= Lab */

function testLab(t) {
  t.section('lab');
  const PX = t.mk(), E = PX.engine, LB = E.lab;
  const a = newRecord(PX, T0), b = newRecord(PX, T0);
  LB.enroll(a, T0);
  LB.enroll(b, T0);
  t.ok(['AB', 'BA'].includes(a.lab.order) && a.lab.order === b.lab.order, 'a random order, reproducible for the same record');
  const orders = new Set();
  for (let i = 0; i < 20; i++) { const r = newRecord(PX, T0 + i * 1000); LB.enroll(r, T0); orders.add(r.lab.order); }
  t.eq(orders.size, 2, 'both orders occur');
  const p1 = LB.phase(a, T0 + 7 * DAY), p2 = LB.phase(a, T0 + 25 * DAY), p3 = LB.phase(a, T0 + 50 * DAY);
  t.eq([p1.phase, p2.phase, p3.phase], [1, 2, 'done'], 'two phases of 3 weeks');
  t.eq(p1.cluster, E.config.lab[a.lab.order[0]], 'phase 1 trains the first cluster');
  const ch = E.schedule.choose(a, {}, T0 + 7 * DAY);
  t.ok(ch.exs.length && ch.exs.every((id) => p1.cluster.includes(id)), 'Train sessions stay inside the phase cluster');
  a.assess.push(mkCheck(T0, 0, 0.3), mkCheck(T0 + DAY, 0.2, 0.3), mkCheck(T0 + 21 * DAY, 0.8, 0.3, { viewmatch: 0.1 }), mkCheck(T0 + 42 * DAY, 0.9, 0.3, { viewmatch: 0.9 }));
  const lc = LB.changes(a);
  t.ok(lc.phases[0].done && lc.phases[1].done, 'per-phase changes once the checks exist');
  t.near(lc.phases[0].probes.cubematch.change, 0.7, 1e-9, 'phase 1 = 3-week check − baseline average');
  t.near(lc.phases[1].probes.viewmatch.change, 0.8, 1e-9, 'phase 2 = 6-week check − 3-week check');
  t.ok(Number.isFinite(lc.contrast.cubematch.aMinusB) && lc.contrast.cubematch.se > 0, 'the A − B contrast per probe with its SE');
  LB.leave(a, T0 + 8 * DAY);
  t.eq(LB.allowed(a, T0 + 9 * DAY), null, 'leaving the experiment lifts the restriction');
}

/* ==================================================================== streak */

function addSessions(rec, day0, list) { // list: [[dayOffset, trials, ms], ...]
  list.forEach(([d, trials, ms], i) => rec.sessions.push({ id: 's' + d + '-' + i, start: day0 + d * DAY, end: day0 + d * DAY + (ms || 600000), mode: 'train', trials, right: trials, practiceMs: ms || 600000, exs: [], summary: null }));
}

function testStreak(t) {
  t.section('streak');
  const PX = t.mk(), E = PX.engine, SK = E.streak, U = PX.util;
  t.eq([SK.weekKey('2026-11-04'), SK.weekKey('2026-11-08'), SK.weekKey('2026-11-09'), SK.weekKey('2026-11-02')], ['2026-11-02', '2026-11-02', '2026-11-09', '2026-11-02'], 'weeks run Monday to Sunday');
  const rec = newRecord(PX, T0);
  t.eq(SK.status(rec, T0).goal, 3, 'the default weekly goal is 3');
  t.eq([SK.setGoal(rec, 9, T0), SK.setGoal(rec, 1, T0), SK.setGoal(rec, 4, T0)], [6, 2, 4], 'the goal is kept within 2–6');
  SK.setGoal(rec, 3, T0);
  const mon = Date.UTC(2026, 10, 2, 12); // local noon keeps the day stable in every time zone used by the tests
  const day = (d) => U.dayKey(mon + d * DAY);
  t.eq(SK.weekKey(day(0)), day(0), 'the test weeks start on a Monday');
  // W0 3 sessions, W1 3, W2 1 (graced), W3 3, W4 0 (repaired by 4 in W5), W5 4
  const base = [[0, 20], [1, 20], [2, 20], [7, 20], [8, 20], [9, 20], [14, 20], [21, 20], [22, 20], [23, 20]];
  addSessions(rec, mon, [...base, [35, 20], [36, 20], [37, 20], [38, 20]]);
  let st = SK.status(rec, mon + 39 * DAY);
  const w = st.weeks.map((x) => (x.met ? 'M' : x.graced ? 'G' : x.repaired ? 'R' : '-'));
  t.eq(w, ['M', 'M', 'G', 'M', 'R', 'M'], 'met, graced (one missed week in four), repaired weeks');
  t.eq([st.current, st.best], [4, 4], 'a graced or repaired week keeps the run going without adding to it');
  const r2 = newRecord(PX, T0);
  addSessions(r2, mon, [...base, [35, 20], [36, 20]]);
  st = SK.status(r2, mon + 37 * DAY);
  t.ok(st.repair && st.repair.need === 4 && st.repair.left === 2 && st.repair.run === 3, 'an open repair: goal + 1 sessions this week');
  t.ok(/2 more this week carry your run of 3 weeks on/.test(st.text) && !/lose|lost|break|broken|miss/i.test(st.text), 'the repair is offered as information, never as a loss');
  st = SK.status(r2, mon + 43 * DAY);
  t.eq(st.current, 0, 'an unrepaired miss ends the run');
  const r3 = newRecord(PX, T0);
  addSessions(r3, mon, [[0, 5, 60000], [1, 9, 200000], [2, 4, 400000]]);
  t.eq(SK.status(r3, mon + 3 * DAY).week.sessions, 1, 'a session counts with 10 answers or 5 minutes');
  t.eq(SK.status(r3, mon + 3 * DAY).week.days.filter(Boolean).length, 1, 'the days-practised calendar of the week');
  const r4 = newRecord(PX, T0);
  addSessions(r4, mon, [[0, 20], [1, 20], [2, 20]]);
  SK.setGoal(r4, 5, mon + 8 * DAY);
  addSessions(r4, mon, [[8, 20], [9, 20], [10, 20]]);
  st = SK.status(r4, mon + 10 * DAY);
  t.eq([st.weeks[0].goal, st.weeks[0].met, st.goal, st.week.met], [3, true, 5, false], 'past weeks keep the goal they had');
}

/* ============================================================== achievements */

function testAchievements(t) {
  t.section('achievements');
  const PX = t.mk(), E = PX.engine, AC = E.achievements;
  t.eq(AC.DEFS.length, 21, 'about 20 achievements (21 since v1.1: a full Section practice)');
  t.eq(new Set(AC.DEFS.map((d) => d.id)).size, 21, 'unique ids');
  t.ok(!AC.DEFS.some((d) => ['first-session', 'answers-1000', 'daily-first', 'daily-seven'].includes(d.id)), 'nothing for showing up: no first-session, answer-count or Daily Challenge achievements');
  t.ok(AC.DEFS.every((d) => d.name && d.desc && typeof d.check === 'function' && (d.kind === 'skill' || d.kind === 'practice')), 'visible criteria and a check each');
  t.ok(!/master/i.test(JSON.stringify(AC.DEFS.map((d) => [d.name, d.desc]))), 'no achievement says "mastered"');
  const rec = newRecord(PX, T0);
  t.eq(AC.check(rec, T0), [], 'nothing is earned on a new record');
  const r = playSession(PX, rec, new Learner(PX, 5), 'train', { now: T0, minutes: 10 }, 0);
  t.ok(Array.isArray(r.fin.achievements) && rec.sessions.length === 1, 'a finished session checks achievements');
  const old = newRecord(PX, T0);
  old.achievements['first-session'] = '2026-10-01T00:00:00.000Z';
  t.ok(AC.get('first-session') === null && AC.list(old, T0).length === 21 && Array.isArray(AC.check(old, T0)), 'a record holding a removed id still works; the id is unknown to get()');
  const track =PX.ex.get('track'), ti = E.log.exIndex(rec, track), mi = E.log.modeIndex(rec, 'train');
  const code5 = PX.ex.paramsCode(track, { speed: 0, targets: 3, spheres: 2, time: 0, variant: 'still' });
  const code5of8 = PX.ex.paramsCode(track, { speed: 0, targets: 3, spheres: 1, time: 0, variant: 'still' });
  rec.trials.push([Math.floor(T0 / 1000) + 98, ti, mi, code5of8, 76, 1, 3000, null, 500, 1]);
  t.ok(!AC.check(rec, T0 + 1500).some((a) => a.id === 'track-five'), 'five targets among eight spheres does not count');
  rec.trials.push([Math.floor(T0 / 1000) + 99, ti, mi, code5, 77, 2, 3000, null, 500, 1]);
  t.ok(!AC.check(rec, T0 + 2000).some((a) => a.id === 'track-five'), 'a stuttered trial never earns a correctness achievement');
  rec.trials.push([Math.floor(T0 / 1000) + 100, ti, mi, code5, 78, 1, 3000, null, 500, 1]);
  t.ok(AC.check(rec, T0 + 3000).some((a) => a.id === 'track-five') && /^\d{4}-\d\d-\d\dT/.test(rec.achievements['track-five']), 'Track with five targets right, earned with an ISO date');
  t.ok(!AC.check(rec, T0 + 3500).some((a) => a.id === 'track-five'), 'never earned twice');
  E.modes.checkin(rec, 'fold', 'whole', T0);
  t.ok(!AC.check(rec, T0 + 4000).some((a) => a.id === 'both-strategies'), 'one strategy is not both');
  E.modes.checkin(rec, 'fold', 'parts', T0 + 5000);
  t.ok(AC.check(rec, T0 + 6000).some((a) => a.id === 'both-strategies'), 'both strategies reported on one exercise');
  t.ok(!E.modes.checkin(rec, 'fold', 'guess', T0) && !E.modes.checkin(rec, 'nope', 'whole', T0), 'invalid check-ins are refused');
  const list = AC.list(rec, T0 + 7000);
  t.ok(list.length === 21 && list.every((x) => Array.isArray(x.progress) && x.progress[0] <= x.progress[1]), 'list() shows progress for each');
  const plan = { mode: 'train', rated: { fold: { n: 10 } } };
  const rr = newRecord(PX, T0);
  t.ok(E.modes.checkinDue(rr, plan, 'fold', T0) && !E.modes.checkinDue(rr, { mode: 'free', rated: plan.rated }, 'fold', T0), 'strategy check-ins after the 10th answer in Train or Path');
  E.modes.checkin(rr, 'fold', 'whole', T0);
  t.ok(!E.modes.checkinDue(rr, plan, 'fold', T0 + 3 * DAY) && E.modes.checkinDue(rr, plan, 'fold', T0 + 15 * DAY), 'at most once per exercise in 14 days');
}

/* ===================================================================== stats */

function testStats(t) {
  t.section('stats');
  const PX = t.mk(), E = PX.engine, ST = E.stats, fold = PX.ex.get('fold');
  const rec = newRecord(PX, T0);
  // plan.blocks: one entry per block end (modes), with the level shown after it
  const blocks = (list) => ({ fold: list.map(([level, right, reached]) => ({ level, exact: level, right, reached, at: T0 })) });
  let out = ST.bests(rec, { mode: 'train', blocks: blocks([[31, 9, true]]) }, T0);
  t.eq(out, [{ exId: 'fold', level: 31, previous: null, first: true }], 'a whole block that reached the reference sets a best: the level shown after it');
  t.eq(ST.bests(rec, { mode: 'train', blocks: blocks([[40, 5, false]]) }, T0), [], 'a block below the reference does not count, whatever the level');
  out = ST.bests(rec, { mode: 'train', blocks: blocks([[33, 9, true], [35, 6, false]]) }, T0 + DAY);
  t.ok(out.length === 1 && out[0].level === 33 && out[0].previous === 31 && rec.ex.fold.best.block.beats === 1 && rec.ex.fold.best.block.acc === 0.9, 'a higher level after a strong block beats it');
  t.eq(ST.bests(rec, { mode: 'free', blocks: blocks([[60, 10, true]]) }, T0), [], 'only Train and Path blocks count');
  void fold;
  const ses = [['2026-11-02', 0.8, 1000, 20], ['2026-11-03', 0.8, 1200, 20], ['2026-11-04', 0.6, 1100, 20]];
  t.near(ST.bis(ses, 2), (0.6 - 0.7333333) / 0.1154701 - 0, 1e-3, 'BIS = z(success) − z(time) against the first three timed sessions');
  t.eq(ST.bis(ses.slice(0, 1), 0), 0, 'the first timed session is its own reference (BIS 0)');
  const r2 = newRecord(PX, T0), p0 = { folds: 1, type: 0, punches: 0 };
  E.est.rate(r2, fold, p0, true, T0);
  E.est.rate(r2, fold, p0, true, T0 + DAY);
  const cv = ST.curve(r2, fold);
  t.ok(cv.length === 2 && cv.every((x) => x.lo <= x.level && x.level <= x.hi), 'a learning curve point per practice day, with a range');
  const ov = ST.overview(r2, T0 + DAY);
  t.ok(ov.length === 11 && ov.find((x) => x.exId === 'fold').n === 2, 'overview lists every training exercise');
  const pf = ST.profile(r2, T0 + DAY);
  t.ok(pf.abilities.Vz && pf.abilities.Vz.exs.includes('fold') && /checklist/.test(pf.note), 'profile by ability (a checklist, not a score)');
  addSessions(r2, T0, [[0, 20], [0, 30]]);
  t.eq(ST.calendar(r2)[PX.util.dayKey(T0)].sessions, 2, 'calendar per day');
  t.eq(ST.totals(r2).sessions, 2, 'totals');
}

/* ===================================================================== merge */

function testMerge(t) {
  t.section('merge');
  const PX = t.mk(), E = PX.engine;
  const base = newRecord(PX, T0);
  playSession(PX, base, new Learner(PX, 1), 'train', { now: T0, minutes: 5, pin: 'span' }, 0);
  const A = clone(base), B = clone(base);
  playSession(PX, A, new Learner(PX, 2), 'train', { now: T0 + DAY, minutes: 5, pin: 'fold', can: (d) => ['fold', 'span'].includes(d.id) }, 1);
  playSession(PX, B, new Learner(PX, 3), 'free', { now: T0 + DAY + 60000, exId: 'nets', trials: 12 }, 1);
  B.updated = A.updated + 1000;
  B.settings.weeklyGoal = 5;
  A.achievements['weekly-goal'] = '2026-11-04T00:00:00.000Z';
  B.achievements['weekly-goal'] = '2026-11-03T00:00:00.000Z';
  B.achievements['first-session'] = '2020-01-01T00:00:00.000Z'; // an id from an older version
  const a0 = clone(A), b0 = clone(B);
  const m = E.merge(A, B);
  t.eq([A, B], [a0, b0], 'inputs are not changed');
  const name = (rec, row) => rec.idx.ex[row[1]] + '|' + row[4];
  const want = new Set([...A.trials.map((r) => name(A, r)), ...B.trials.map((r) => name(B, r))]);
  const got = m.trials.map((r) => name(m, r));
  t.eq(m.trials.length, want.size, 'trials: union without duplicates');
  t.ok(got.every((x) => want.has(x)), 'every row keeps its exercise after re-indexing');
  t.ok(m.trials.every((r, i) => i === 0 || r[0] >= m.trials[i - 1][0]), 'rows stay in time order');
  t.eq(new Set(m.sessions.map((s) => s.id)).size, base.sessions.length + 2, 'sessions: union by id');
  t.eq(m.achievements['weekly-goal'], '2026-11-03T00:00:00.000Z', 'achievements keep the earliest date');
  t.eq(m.achievements['first-session'], '2020-01-01T00:00:00.000Z', 'ids from older versions are kept, not dropped');
  t.eq(m.settings.weeklyGoal, 5, 'settings come from the newer side');
  t.eq(m.eng.seedN, Math.max(A.eng.seedN, B.eng.seedN), 'the seed counter takes the larger value');
  t.eq(m.ex.fold.n, A.ex.fold.n, 'each rating comes from the side with more trials');
  t.ok(m.idx.ex.includes('nets@1') && m.idx.ex.includes('fold@1'), 'index lists hold both sides');
  const mm = E.merge(A, A);
  t.eq([mm.trials, mm.sessions], [A.trials, A.sessions], 'merging a record with itself changes nothing');
  // Two tabs draw seeds from their own copies of the counter: two different trials can share the
  // second, the exercise and the seed. Both stay; the same trial in both records stays once.
  const X = clone(base), Y = clone(base), last = base.trials[base.trials.length - 1];
  const rx = last.slice(), ry = last.slice();
  rx[0] = ry[0] = last[0] + 30;
  rx[5] = 1; rx[6] = 812; ry[5] = 0; ry[6] = 1430;
  X.trials.push(rx); Y.trials.push(ry);
  t.eq(E.merge(X, Y).trials.length, base.trials.length + 2, 'two tabs: trials with the same second, exercise and seed both stay');
  t.eq(E.merge(JSON.parse(JSON.stringify(X)), X).trials.length, base.trials.length + 1, 'two tabs: the same trial in both records stays once');
}

/* =============================================================== determinism */

function testDeterminism(t) {
  t.section('determinism');
  const runOnce = () => {
    const PX = t.mk(), rec = newRecord(PX, T0), L = new Learner(PX, 12);
    playSession(PX, rec, L, 'check', { now: T0 }, 0);
    for (let d = 0; d < 3; d++) playSession(PX, rec, L, 'train', { now: T0 + d * DAY + 3600e3, minutes: 10 }, d);
    playSession(PX, rec, L, 'path', { now: T0 + 4 * DAY, exId: 'views', minutes: 5 }, 4);
    playSession(PX, rec, L, 'daily', { now: T0 + 5 * DAY }, 5);
    return JSON.stringify(rec);
  };
  t.eq(runOnce(), runOnce(), 'the same record, times and answers give the same plans, items and record');
}

/* ===================================================================== words */

function testWords(t) {
  t.section('wording');
  const dir = path.join(t.root, 'js/engine');
  const bad = fs.readdirSync(dir).filter((f) => /mastered/i.test(fs.readFileSync(path.join(dir, f), 'utf8')));
  t.eq(bad, [], 'the word "mastered" appears nowhere in the engine');
  const PX = t.mk(), E = PX.engine, rec = newRecord(PX, T0), L = new Learner(PX, 13);
  const texts = [];
  for (let d = 0; d < 4; d++) {
    const r = playSession(PX, rec, L, d % 2 ? 'path' : 'train', { now: T0 + d * DAY, minutes: 8, exId: 'fold' }, d);
    texts.push(r.fin);
  }
  texts.push(E.modes.available(rec, T0 + 5 * DAY), E.streak.status(rec, T0 + 5 * DAY), E.achievements.list(rec, T0 + 5 * DAY), E.assess.due(rec, T0 + 5 * DAY));
  const all = JSON.stringify(texts);
  t.ok(!/master|\bIQ\b|percentile|brain age|smarter/i.test(all), 'engine texts never say mastered, IQ, percentile, brain age or smarter');
}

/* ================================================================== mini-sim */

function testMiniSim(t) {
  t.section('mini simulation');
  const PX = t.mk(), E = PX.engine;
  let dead = 0, dup = 0, tg = 0, tgN = 0, size = 0;
  for (let i = 0; i < 6; i++) {
    const rec = newRecord(PX, T0), L = new Learner(PX, 100 + i), rng = PX.rng(PX.rng.hash('mini', i));
    for (let d = 0; d < 21; d++) {
      if (!rng.chance(0.5)) continue;
      const r = playSession(PX, rec, L, 'train', { now: T0 + d * DAY, minutes: 15, display: i % 3 ? 'large' : 'small' }, d, { stutterP: 0.01 });
      if (r.deadEnd) dead++;
      r.steps.forEach((s) => { if (s.step.kind === 'target' && s.out.outcome < 2) { tgN++; tg += (s.out.outcome === 1 ? 1 : 0) - s.step.target; } });
    }
    const seeds = rec.trials.map((x) => x[4]);
    dup += seeds.length - new Set(seeds).size;
    size = Math.max(size, JSON.stringify(rec).length);
  }
  t.eq(dead, 0, 'no session dead ends');
  t.eq(dup, 0, 'no repeated seeds');
  t.ok(Math.abs(tg / tgN) < 0.06, 'success on target items near the target (' + (100 * tg / tgN).toFixed(1) + ' points)');
  t.ok(size < 400000, 'records stay small (' + Math.round(size / 1024) + ' KB after 3 weeks)');
}
