/* Shared support for PLAN milestone 8's DAT-style rebuild (docs/dev/CONTRACT-v1.2.md "Wave 3"): the registry's
   optionKeys (W1), testRange and rangeTag (W3), set and setSize (W4); the engine's "test range only" in Free play
   (W3) and figure sets in Train, Path and Free play (W4); the store's repair of rec.ex[id].tag and its export (W3).
   Fixture exercises (tests/node/fixtures/exercises.mjs) plus test definitions made here. */
import { defineFixtures } from './fixtures/exercises.mjs';
import { newRecord } from './fixtures/learner.mjs';

const T0 = Date.UTC(2026, 10, 19, 10, 0, 0);

function stub(id) {
  return {
    generate(rng, params) { return { ex: id, seed: rng.seed, params, key: 0 }; },
    validate() { return true },
    score(item, r) { return { correct: r === item.key, value: typeof item.params.ask === 'number' ? item.params.ask : 0 }; },
  };
}
// A DAT-style test definition: three tagged dims, two variants, a figure set of 1–3 questions by seed.
function datDef(extra) {
  return Object.assign({
    id: 'datx', code: 'EX-91', name: 'DAT fixture', abilities: ['Vz'], cell: null, role: 'train', answer: 'choice', nOptions: 5,
    variants: ['plain', 'shaded'], extraParams: ['ask'],
    dims: [
      { key: 'size', label: 'Size', levels: [1, 2, 3, 4, 5], step: 0.5 },
      { key: 'gap', label: 'Gap', levels: [15, 9, 5, 2], step: 0.6 },
      { key: 'turn', label: 'Turn', levels: [0, 90], step: 0.3 },
    ],
    base: -2.2,
    testRange: {
      dims: { size: ['below', 'test', 'test', 'test', 'beyond'], gap: ['below', 'test', 'test', 'beyond'] },
      variants: { shaded: 'test' },
      notes: { gap: 'Gap sizes on the test are not documented officially.' },
    },
    set: { param: 'ask', size(params, seed) { return 1 + (seed % 3); } },
  }, stub('datx'), extra || {});
}
function mk(t, withDat) {
  const c = t.context({ exercises: false });
  defineFixtures(c.PX);
  if (withDat !== false) c.PX.ex.define(datDef());
  return c.PX;
}

export async function run(t) {
  registry(t);
  views(t);
  freeRange(t);
  sets(t);
  setsOff(t);
  storeTag(t);
}

function registry(t) {
  t.section('registry: testRange, rangeTag, set, setSize');
  const PX = t.PX;
  const d = PX.ex.define(datDef());
  t.ok(Object.isFrozen(d.testRange) && Object.isFrozen(d.testRange.dims.size), 'the test range is frozen');
  t.eq(PX.ex.RANGE_TAGS, ['below', 'test', 'beyond'], 'three tags');
  const p = (size, gap, turn, variant) => ({ size, gap, turn, variant });
  t.eq(PX.ex.rangeTag(d, p(0, 1, 0, 'plain')), 'below', 'a starter level is below the test');
  t.eq(PX.ex.rangeTag(d, p(1, 0, 0, 'plain')), 'below', 'on any tagged dim');
  t.eq(PX.ex.rangeTag(d, p(2, 2, 1, 'shaded')), 'test', 'tagged test levels and a test variant: test range');
  t.eq(PX.ex.rangeTag(d, p(2, 3, 0, 'plain')), 'beyond', 'one level beyond the test makes the item beyond');
  t.eq(PX.ex.rangeTag(d, p(0, 3, 0, 'plain')), 'beyond', 'beyond wins over below');
  t.eq(PX.ex.rangeTag(d, p(3, 1, 1, 'plain')), 'test', 'an untagged variant and an untagged dim are neutral');
  t.eq(PX.ex.rangeTag('datx', p(3, 1, 1, 'plain')), 'test', 'by id too');
  t.eq(PX.ex.rangeTag(PX.ex.get('datx'), null), null, 'no params: null');
  const plainDef = PX.ex.define(Object.assign(datDef({ id: 'datn', code: 'EX-92' }), { testRange: undefined, set: undefined }));
  t.ok(plainDef.testRange === null && plainDef.set === null, 'both are optional (null)');
  t.eq(PX.ex.rangeTag(plainDef, p(0, 0, 0, 'plain')), null, 'an exercise without a test range: null');
  t.eq([1, 2, 3, 4].map((s) => PX.ex.setSize(d, p(0, 0, 0, 'plain'), s)), [2, 3, 1, 2], 'setSize follows set.size');
  t.eq(PX.ex.setSize(plainDef, p(0, 0, 0, 'plain'), 5), 1, 'without a set: 1');
  const big = PX.ex.check(datDef({ id: 'datb', code: 'EX-93', set: { param: 'ask', size() { return 9; } } }));
  t.eq(PX.ex.setSize(big, p(0, 0, 0, 'plain'), 1), PX.ex.SET_MAX, 'clamped to SET_MAX');
  const bad = PX.ex.check(datDef({ id: 'datc', code: 'EX-94', set: { param: 'ask', size() { throw new Error('x'); } } }));
  t.eq(PX.ex.setSize(bad, p(0, 0, 0, 'plain'), 1), 1, 'a size that throws counts as 1');
  const no = (extra, re, msg) => t.throws(() => PX.ex.check(datDef(Object.assign({ id: 'daty', code: 'EX-95' }, extra))), re, msg);
  no({ testRange: { dims: { size: ['test', 'test'] } } }, /one of below, test, beyond for each of its 5 levels/, 'a tag per level');
  no({ testRange: { dims: { nope: ['test'] } } }, /not a dim/, 'only dims of the exercise');
  no({ testRange: { dims: { size: ['test', 'test', 'easy', 'test', 'test'] } } }, /one of below, test, beyond/, 'only the three tags');
  no({ testRange: { variants: { other: 'test' } } }, /not a variant/, 'only variants of the exercise');
  no({ testRange: { variants: { plain: 'hard' } } }, /must be one of/, 'variant tags too');
  no({ testRange: {} }, /at least one dim or variant/, 'an empty range is refused');
  no({ testRange: { dims: { size: ['below', 'below', 'beyond', 'beyond', 'beyond'] } } }, /no combination as test/, 'a range with nothing in the test range');
  no({ testRange: { variants: { plain: 'below', shaded: 'beyond' } } }, /no combination as test/, 'a variant must be test or untagged');
  no({ testRange: { dims: { size: ['test', 'test', 'test', 'test', 'test'] }, notes: { turn: 'x' } } }, /does not tag/, 'notes only for tagged dims, variants or "*"');
  no({ testRange: { dims: { size: ['test', 'test', 'test', 'test', 'test'] }, notes: { '*': 'x'.repeat(241) } } }, /at most 240/, 'notes stay short');
  no({ testRange: { dims: { size: ['test', 'test', 'test', 'test', 'test'] }, extra: 1 } }, /not part of a test range/, 'unknown keys are refused');
  no({ set: { param: 'nope', size() { return 2; } } }, /one of extraParams/, 'set.param is an extra param');
  no({ set: { param: 'ask' } }, /set.size/, 'set.size is a function');
  no({ set: 3 }, /set must be/, 'set is an object');
  const ok = PX.ex.check(datDef({ id: 'datz', code: 'EX-96', testRange: { dims: { size: ['test', 'test', 'test', 'test', 'test'] }, notes: { '*': 'All of it.' } } }));
  t.eq(ok.testRange.notes, { '*': 'All of it.' }, 'a "*" note is kept');
}

function views(t) {
  t.section('registry: optionKeys on views');
  const PX = t.context({ exercises: false }).PX;
  PX.ex.define(datDef());
  PX.ex.define(Object.assign(datDef({ id: 'datsix', code: 'EX-97', nOptions: 6 }), { testRange: undefined, set: undefined }));
  PX.ex.define(Object.assign(datDef({ id: 'datcus', code: 'EX-98', answer: 'angle', chance: 0.1, nOptions: undefined }), { testRange: undefined, set: undefined }));
  const base = { layout: 'stem+options', present() {}, drawOption() {} };
  t.ok(PX.ex.view('datx', Object.assign({ optionKeys: 'letters' }, base)), 'letters on a stem+options view');
  t.throws(() => PX.ex.view('datsix', Object.assign({ optionKeys: 'letters' }, base)), /at most five options/, 'letters hold five options at most');
  t.throws(() => PX.ex.view('datsix', Object.assign({ optionKeys: 'abc' }, base)), /"letters" or "digits"/, 'only letters or digits');
  t.throws(() => PX.ex.view('datcus', { layout: 'custom', optionKeys: 'letters', present() {}, collect() {}, reveal() {} }), /stem\+options/, 'not on a custom view');
}

function freeRange(t) {
  t.section('Free play: test range only (CONTRACT-v1.2 W3)');
  const PX = mk(t), E = PX.engine, def = PX.ex.get('datx');
  const rec = newRecord(PX, T0);
  const plan = E.modes.start(rec, 'free', { now: T0, exId: 'datx', trials: 40, range: 'test' });
  t.ok(!plan.unavailable && plan.range === 'test', 'the plan keeps the range');
  let now = T0, tags = {}, n = 0;
  for (let i = 0; i < 40; i++) {
    const s = E.modes.next(plan, rec, now);
    if (s.done) break;
    n++;
    const tag = PX.ex.rangeTag(def, s.params);
    tags[tag] = (tags[tag] || 0) + 1;
    now += 3000;
    E.modes.answer(plan, rec, s, { correct: i % 4 !== 0, rt: 2000 }, now);
  }
  t.ok(n === 40 && tags.test === 40, 'every item is in the test range (' + JSON.stringify(tags) + ', ' + n + ' items)');
  const all = E.modes.start(newRecord(PX, T0), 'free', { now: T0, exId: 'datx', trials: 5 });
  t.eq(all.range, null, 'without the choice: no range');
  const fixedOut = E.modes.start(newRecord(PX, T0), 'free', { now: T0, exId: 'datx', params: { size: 4, gap: 1, turn: 0, variant: 'plain' }, range: 'test' });
  t.ok(/outside the test range/.test(fixedOut.unavailable || ''), 'fixed settings outside the range are refused: ' + fixedOut.unavailable);
  const fixedIn = E.modes.start(newRecord(PX, T0), 'free', { now: T0, exId: 'datx', params: { size: 2, gap: 1, turn: 1, variant: 'shaded' }, range: 'test' });
  t.ok(!fixedIn.unavailable && fixedIn.range === 'test', 'fixed settings inside it run');
  const untagged = E.modes.start(newRecord(PX, T0), 'free', { now: T0, exId: 'rotate', trials: 5, range: 'test' });
  t.ok(!untagged.unavailable && untagged.range === null, 'an exercise without a test range ignores the choice');
}

// Plays a session of n items; answer(step, i) → result. → { plan, steps, outs }
function play(PX, rec, mode, opts, n, answer) {
  const E = PX.engine;
  let now = opts.now;
  const plan = E.modes.start(rec, mode, opts), steps = [], outs = [];
  for (let i = 0; i < n; i++) {
    const step = E.modes.next(plan, rec, now);
    if (step.done) break;
    now += 4000;
    const res = answer ? answer(step, i) : { correct: i % 3 !== 0, rt: 2500 };
    if (res.value === undefined && typeof step.params.ask === 'number') res.value = step.params.ask; // as score() gives it
    outs.push(E.modes.answer(plan, rec, step, res, now));
    steps.push(step);
  }
  E.modes.finish(plan, rec, now + 1000);
  return { plan, steps, outs };
}

function sets(t) {
  t.section('figure sets in Free play, Train and Path (CONTRACT-v1.2 W4)');
  const PX = mk(t), E = PX.engine, L = E.log;
  // Free play: every dealt item opens its set; later questions follow at once with the same seed and code
  {
    const rec = newRecord(PX, T0);
    const { steps, outs } = play(PX, rec, 'free', { now: T0, exId: 'datx', trials: 30 }, 30);
    let ok = true, opened = 0, i = 0, sizes = [];
    while (i < steps.length) {
      const s = steps[i], n = PX.ex.setSize(PX.ex.get('datx'), s.params, s.seed);
      if (s.kind === 'set') { ok = false; break; }
      sizes.push(n);
      if (n > 1) { opened++; if (!(s.set && s.set.i === 0 && s.set.n === n)) ok = false; }
      for (let q = 1; q < n && i + q < steps.length; q++) {
        const x = steps[i + q];
        if (!(x.kind === 'set' && x.seed === s.seed && x.code === s.code && x.params.ask === q && x.set.i === q && x.set.n === n && x.b === s.b)) ok = false;
      }
      i += n;
    }
    t.ok(ok && opened > 3, 'each dealt item is followed by its later questions (' + opened + ' sets; sizes ' + sizes.slice(0, 10).join(',') + ')');
    t.eq(steps.length, 30, 'set questions count against the session length');
    const rows = rec.trials.slice(-30), kSet = L.KINDS.indexOf('set');
    t.eq(rows.filter((r) => r[L.COL.kind] === kSet).length, steps.filter((s) => s.kind === 'set').length, "every later question is logged with kind 'set'");
    t.ok(rows.filter((r) => r[L.COL.kind] === kSet).every((r) => r[L.COL.value] > 0), "a set row's value is the question index");
    t.ok(outs.every((o) => o.outcome === 0 || o.outcome === 1), 'all scored');
  }
  // Train: later questions are never rated, but they count in the session's answers
  {
    const rec = newRecord(PX, T0);
    const opts = { now: T0, exId: 'datx', pin: 'datx', count: 1, minutes: 6 };
    const E2 = PX.engine, plan = E2.modes.start(rec, 'train', opts);
    let now = T0, sawSet = 0, unrated = true, rated = 0, nBefore = null;
    for (let i = 0; i < 60; i++) {
      const s = E2.modes.next(plan, rec, now);
      if (s.done) break;
      const st = E2.est.get(rec, PX.ex.get('datx'), { display: plan.display }, now);
      nBefore = st.n;
      now += 3000;
      const out = E2.modes.answer(plan, rec, s, { correct: i % 2 === 0, rt: 2000 }, now);
      const after = E2.est.get(rec, PX.ex.get('datx'), { display: plan.display }, now).n;
      if (s.kind === 'set') { sawSet++; if (out.rated || after !== nBefore || out.blockEnd) unrated = false; }
      else if (out.rated) rated++;
    }
    const res = E2.modes.finish(plan, rec, now + 1000);
    t.ok(sawSet > 2 && unrated && rated > 2, 'Train: ' + sawSet + ' later questions, none rated (no rating change, no block end); ' + rated + ' rated');
    const blocks = plan.blocks.datx || [];
    t.ok(plan.rated.datx.n === rated + sawSet, 'the session counts every answer (' + plan.rated.datx.n + ')');
    t.ok(!blocks.length || blocks.every((b) => b.right <= 10), 'blocks of 10 hold rated answers only');
    t.ok(res && res.session, 'the session finishes');
  }
  // Path: later questions leave the stage and its moving average alone
  {
    const rec = newRecord(PX, T0), plan = E.modes.start(rec, 'path', { now: T0, exId: 'datx', minutes: 6 });
    let now = T0, nSet = 0, still = true, staged = true;
    for (let i = 0; i < 40; i++) {
      const s = E.modes.next(plan, rec, now);
      if (s.done) break;
      const before = JSON.stringify(rec.path.datx || null);
      now += 3000;
      E.modes.answer(plan, rec, s, { correct: i % 4 !== 0, rt: 1800 }, now);
      if (s.kind === 'set') { nSet++; if (JSON.stringify(rec.path.datx || null) !== before) still = false; if (!s.pathStage) staged = false; }
    }
    t.ok(nSet > 0 && still, 'Path: ' + nSet + ' later questions leave the stage, its items and its average as they were');
    t.ok(staged, 'a set question keeps its stage');
  }
  // the rows readers and lastRated skip set rows: Speed's untimed times
  {
    const rec = newRecord(PX, T0);
    play(PX, rec, 'free', { now: T0, exId: 'datx', trials: 12 }, 12, (s) => ({ correct: true, rt: s.kind === 'set' ? 400 : 3000 }));
    const rt = E.modes._.untimedRt(rec, PX.ex.get('datx'));
    t.eq(rt, 3000, "Speed's untimed time leaves set questions out");
  }
  // a voided question goes on with the set; an ending session drops the rest
  {
    const rec = newRecord(PX, T0), plan = E.modes.start(rec, 'free', { now: T0, exId: 'datx', trials: 40 });
    let now = T0, s, guard = 0;
    do { s = E.modes.next(plan, rec, now); now += 3000; if (s.kind !== 'set' && s.set && s.set.n === 3) break; E.modes.answer(plan, rec, s, { correct: true, rt: 2000 }, now); } while (++guard < 40);
    t.ok(s && s.set && s.set.n === 3, 'found a set of three');
    E.modes.answer(plan, rec, s, { correct: true, rt: 2000 }, now);
    const q1 = E.modes.next(plan, rec, now);
    E.modes.answer(plan, rec, q1, { correct: false, rt: 2000, outcome: 'stutter', voided: true }, now += 3000);
    const q2 = E.modes.next(plan, rec, now);
    t.ok(q1.kind === 'set' && q1.set.i === 1 && q2.kind === 'set' && q2.set.i === 2 && q2.seed === s.seed, 'after a voided question the set goes on');
    PX.ex.define(datDef({ id: 'datk', code: 'EX-90', set: { param: 'ask', size() { return 3; } } }));
    const rec2 = newRecord(PX, T0), plan2 = E.modes.start(rec2, 'free', { now: T0, exId: 'datk', trials: 2 });
    const a = E.modes.next(plan2, rec2, T0);
    t.ok(a.set && a.set.n === 3, 'a figure of three questions opens');
    E.modes.answer(plan2, rec2, a, { correct: true, rt: 2000 }, T0 + 3000);
    const b = E.modes.next(plan2, rec2, T0 + 3000);
    E.modes.answer(plan2, rec2, b, { correct: true, rt: 2000 }, T0 + 6000);
    const c = E.modes.next(plan2, rec2, T0 + 6000);
    t.ok(b.kind === 'set' && c.done === true, 'a session of two items ends after the second, dropping the rest of the set');
  }
}

function setsOff(t) {
  t.section('figure sets stay out of Speed, the Daily and fluency items');
  const PX = mk(t), E = PX.engine;
  const rec = newRecord(PX, T0);
  rec.path = { datx: { stage: 2, passed: { 1: T0 } } }; // Speed opens after a Path stage
  const sp = E.modes.start(rec, 'speed', { now: T0, exId: 'datx', minutes: 3 });
  let any = false;
  if (!sp.unavailable) {
    let now = T0;
    for (let i = 0; i < 12; i++) { const s = E.modes.next(sp, rec, now); if (s.done) break; if (s.kind === 'set' || s.set) any = true; now += 3000; E.modes.answer(sp, rec, s, { correct: true, rt: 1500 }, now); }
  }
  t.ok(!any, 'Speed deals single questions' + (sp.unavailable ? ' (unavailable here: ' + sp.unavailable + ')' : ''));
}

function storeTag(t) {
  t.section("store: rec.ex[id].tag (CONTRACT-v1.2 W3)");
  const env = t.env({ exercises: false });
  defineFixtures(env.PX);
  env.PX.ex.define(datDef());
  const S = env.PX.core.store;
  const g = S.guard({ v: 4, ex: { datx: { mu: 0, sd: 2, n: 0, nRight: 0, last: null, seen: {}, best: {}, hist: [], tag: 'test' }, rotate: { mu: 0, sd: 2, n: 0, nRight: 0, last: null, seen: {}, best: {}, hist: [], tag: 'all' } } });
  t.eq([g.ex.datx.tag, 'tag' in g.ex.rotate], ['test', false], "'test' is kept; anything else is dropped");
  S.load();
  S.state.ex.datx = { mu: 0, sd: 2, n: 0, nRight: 0, last: null, seen: {}, best: {}, hist: [], tag: 'test' };
  const P = S.pooled();
  t.eq(P.ex && P.ex.datx && P.ex.datx.tag, 'test', 'the pooled export keeps it');
  const B = JSON.parse(S.exportJSON());
  const ex = (B.record || B).ex;
  t.eq(ex && ex.datx && ex.datx.tag, 'test', 'and so does a backup');
}
