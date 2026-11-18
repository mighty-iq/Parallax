/* Engine hooks and shared pieces of v1.2 wave 2 (docs/dev/CONTRACT-v1.2.md Q): PX.engine.defaults,
   the modes hook points (start, kind, pick, answer, finish), the schedule's exclude hook and
   setStage, and merge.register. Fixture exercises (tests/node/fixtures/exercises.mjs). */
import { defineFixtures } from './fixtures/exercises.mjs';
import { newRecord } from './fixtures/learner.mjs';

const DAY = 86400000;
const T0 = Date.UTC(2026, 10, 16, 18, 0, 0); // Monday 16 Nov 2026

function mk(t) {
  const c = t.context({ exercises: false });
  defineFixtures(c.PX);
  return c.PX;
}

// Plays a session: every item answered (right on even positions), 4 s apart. → { plan, steps, outs, res }
function play(PX, rec, mode, opts, n, answer) {
  const E = PX.engine;
  let now = opts.now;
  const plan = E.modes.start(rec, mode, opts), steps = [], outs = [];
  for (let i = 0; i < n; i++) {
    const step = E.modes.next(plan, rec, now);
    if (step.done) break;
    now += 4000;
    const result = answer ? answer(step, i) : { correct: i % 2 === 0, rt: 2000 };
    outs.push(E.modes.answer(plan, rec, step, result, now));
    steps.push(step);
  }
  const res = E.modes.finish(plan, rec, now + 1000);
  return { plan, steps, outs, res };
}

export async function run(t) {
  defaults(t);
  registry(t);
  startAndFinish(t);
  kindAndPick(t);
  pathAndFree(t);
  noHookNoChange(t);
  errors(t);
  schedule(t);
  merge(t);
}

function defaults(t) {
  t.section('E.defaults: a module config block');
  const PX = mk(t), E = PX.engine;
  const blk = E.defaults('w2test', { share: 0.1, nested: { a: 1 } });
  t.eq(E.config.w2test, { share: 0.1, nested: { a: 1 } }, 'the block is in config');
  t.ok(blk === E.config.w2test, 'it returns the live block');
  E.configure({ w2test: { share: 0.3 } });
  t.eq(E.config.w2test.share, 0.3, 'configure patches it');
  E.configure('reset');
  t.eq(E.config.w2test, { share: 0.1, nested: { a: 1 } }, "configure('reset') restores it");
  t.ok(E.config.mix && E.config.mix.easy === 0.10, 'other blocks are untouched');
  t.throws(() => E.defaults('w2test', {}), /already a config block/, 'a key in use is refused');
  t.throws(() => E.defaults('mix', {}), /already a config block/, 'a built-in block is refused');
  t.throws(() => E.defaults('bad key', {}), /needs a key/, 'a key must be an identifier');
  t.throws(() => E.defaults('w2list', [1]), /plain object/, 'a block must be a plain object');
}

function registry(t) {
  t.section('modes.hook: registration');
  const PX = mk(t), M = PX.engine.modes;
  const f = () => null;
  t.throws(() => M.hook('nope', f, { id: 'x' }), /unknown point/, 'an unknown point is refused');
  t.throws(() => M.hook('kind', f, {}), /opts\.id/, 'an id is required');
  t.throws(() => M.hook('kind', 'f', { id: 'x' }), /needs a function/, 'a function is required');
  const off1 = M.hook('kind', f, { id: 'b', order: 20 });
  M.hook('kind', f, { id: 'a', order: 10 });
  M.hook('kind', f, { id: 'c' });
  M.hook('kind', f, { id: 'd', order: 20 });
  t.throws(() => M.hook('kind', f, { id: 'a' }), /already registered/, 'a duplicate id at one point is refused');
  t.eq(M.hooks('kind').map((h) => h.id), ['a', 'b', 'd', 'c'], 'lower order first, ties in registration order, default order 50');
  off1();
  t.eq(M.hooks('kind').map((h) => h.id), ['a', 'd', 'c'], 'off() removes a hook');
  t.eq(M.hooks('nope'), [], 'an unknown point lists nothing');
  ['start', 'kind', 'pick', 'answer', 'finish'].forEach((p) => t.ok(Array.isArray(M.hooks(p)), 'point ' + p + ' exists'));
}

function startAndFinish(t) {
  t.section('modes hooks: start, answer, finish');
  const PX = mk(t), E = PX.engine, M = E.modes;
  const seen = [];
  M.hook('start', (plan, rec, opts, now) => {
    seen.push(['start', plan.mode, typeof rec.trials, opts.now === now, Array.isArray(plan.exs) && plan.exs.length > 0, !!plan.share]);
    plan.share.fold = { fluency: 0.3 }; // a start hook fills the share a kind hook reads
  }, { id: 'test.start' });
  let answers = 0, outcomes = [];
  M.hook('answer', (plan, rec, step, result, out, now) => { answers++; outcomes.push(out.outcome); t.ok(step.answered === undefined, 'the answer hook runs before the step is closed'); }, { id: 'test.answer' });
  let fin = null;
  M.hook('finish', (plan, rec, now, res) => { fin = { session: !!res.session, pushed: rec.sessions.length, streak: res.streak, ach: res.achievements.length }; res.w2 = 'seen'; }, { id: 'test.finish' });
  let shareSeen = null;
  M.hook('kind', (plan, rec, def, kind, ctx) => { if (def.id === 'fold' && shareSeen === null) shareSeen = ctx.share.fluency; return null; }, { id: 'test.kindshare' });
  const rec = newRecord(PX, T0 - 2 * DAY);
  const p = play(PX, rec, 'train', { now: T0, pin: 'fold', count: 1, minutes: 2 }, 12, (step, i) => (i === 3 ? { outcome: 'stutter' } : { correct: true, rt: 1500 }));
  t.eq(seen.length, 1, 'start runs once per plan');
  t.eq(seen[0], ['start', 'train', 'object', true, true, true], 'start gets plan, rec, opts and now after the mode started');
  t.eq(shareSeen, 0.3, 'a kind hook reads the share a start hook set (plan.share[exId])');
  t.eq(answers, p.outs.length, 'answer runs for every answer');
  t.ok(outcomes.includes(2) && outcomes.includes(1), 'answer runs for voided and rated outcomes alike');
  t.ok(fin && fin.session && fin.pushed === 1, 'finish runs after the session is pushed');
  t.eq(fin.streak, null, 'finish runs before the streak is computed');
  t.eq(p.res.w2, 'seen', 'finish may add to the result');
  t.ok(p.res.streak && Array.isArray(p.res.achievements), 'the streak and achievements still come after');
  t.eq(p.res.errors, undefined, 'no errors without a throwing hook');
}

function kindAndPick(t) {
  t.section('modes hooks: kind and pick in Train');
  const PX = mk(t), E = PX.engine, M = E.modes;
  const kinds = [];
  M.hook('kind', (plan, rec, def, kind, ctx) => {
    kinds.push([kind, Array.isArray(ctx.deck), !!ctx.st, typeof ctx.now === 'number', !!ctx.run, !!ctx.recent]);
    return kind === 'target' && plan.pos % 3 === 0 ? 'lead' : null;
  }, { id: 'test.lead', order: 10 });
  let pickCtx = null, oSeen = null;
  M.hook('pick', (plan, rec, def, o, ctx) => {
    if (!pickCtx) { pickCtx = ctx; oSeen = { k: o.k, kind: o.kind, policy: o.policy, filter: typeof o.filter, rng: !!o.rng }; }
    if (ctx.kind === 'lead') return { layer: 'compare-apply', deadlineMs: 4321, timed: true, exId: 'nets', seed: 7, b: 99, params: {} };
    return null;
  }, { id: 'test.pick', order: 10 });
  M.hook('pick', (plan, rec, def, o, ctx) => (ctx.kind === 'lead' ? { deadlineMs: 5000 } : null), { id: 'test.pick2', order: 20 });
  const rec = newRecord(PX, T0 - 2 * DAY);
  const p = play(PX, rec, 'train', { now: T0, pin: 'fold', count: 1, minutes: 2 }, 15);
  t.ok(kinds.length >= 10, 'the kind hook runs for every Train item');
  t.eq(kinds[0].slice(1), [true, true, true, true, true], 'its ctx holds deck, st, now, run and recent');
  const leads = p.steps.filter((s) => s.kind === 'lead');
  t.ok(leads.length >= 2, 'a kind hook changes the step kind (' + leads.length + ' lead items)');
  t.ok(pickCtx && typeof pickCtx.kind === 'string' && 'runFilter' in pickCtx && pickCtx.share && typeof pickCtx.share === 'object', 'the pick ctx holds kind, runFilter and share');
  t.eq(oSeen.rng && oSeen.policy === 'high' && typeof oSeen.k === 'number', true, 'the pick hook sees the select options');
  t.eq(leads.map((s) => [s.layer, s.deadlineMs, s.timed]), leads.map(() => ['compare-apply', 5000, true]), 'extra step fields reach the step; a later hook wins');
  t.ok(leads.every((s) => s.exId === 'fold' && s.seed !== 7 && s.b !== 99 && Object.keys(s.params).length > 0), 'a pick hook cannot set the item itself (exId, seed, b, params)');
  t.ok(p.steps.filter((s) => s.kind !== 'lead').every((s) => s.layer === undefined && !s.deadlineMs), 'other items keep their fields');
  t.ok(p.outs.every((o) => o.row && o.row.length >= 12), 'answers log their rows');
}

function pathAndFree(t) {
  t.section('modes hooks: Path (not rechecks) and Free play (adaptive items only)');
  const PX = mk(t), E = PX.engine, M = E.modes;
  let kindN = 0, pickN = 0;
  M.hook('kind', (plan) => { if (plan.mode === 'path') kindN++; return null; }, { id: 'test.pathkind' });
  M.hook('pick', (plan, rec, def, o, ctx) => { pickN++; return plan.mode === 'free' ? { layer: 'produce' } : null; }, { id: 'test.pick' });
  const rec = newRecord(PX, T0 - 2 * DAY);
  const p = play(PX, rec, 'path', { now: T0, exId: 'fold', minutes: 2 }, 8);
  t.eq([kindN, pickN], [p.steps.length, p.steps.length], 'Path runs kind and pick hooks for its items');
  // a due recheck: stage 1 passed long ago
  const ps = E.path.state(rec, 'fold');
  ps.passed[1] = { at: T0 - 20 * DAY, iv: 1, next: T0 - DAY, held: true, maxHeld: 3, last: null };
  ps.stage = 2;
  kindN = 0; pickN = 0;
  const p2 = play(PX, rec, 'path', { now: T0 + DAY, exId: 'fold', minutes: 2 }, 3);
  const rc = p2.steps.filter((s) => s.recheck);
  t.ok(rc.length >= 1, 'the session opens with recheck items');
  t.eq([kindN, pickN], [p2.steps.length - rc.length, p2.steps.length - rc.length], 'rechecks run no kind or pick hook');
  pickN = 0;
  const f = play(PX, rec, 'free', { now: T0 + 2 * DAY, exId: 'fold', minutes: 1 }, 4);
  t.eq(pickN, f.steps.length, "Free play's adaptive items run the pick hook");
  t.ok(f.steps.every((s) => s.layer === 'produce'), 'and take its step fields');
  pickN = 0;
  const g = play(PX, rec, 'free', { now: T0 + 3 * DAY, exId: 'fold', minutes: 1, params: { folds: 1, type: 0, punches: 0 } }, 3);
  t.ok(g.steps.length > 0 && pickN === 0, 'fixed settings run no pick hook');
}

function noHookNoChange(t) {
  t.section('modes hooks: hooks that change nothing leave a session as it was');
  function session(withHooks) {
    const PX = mk(t), M = PX.engine.modes;
    if (withHooks) {
      M.hook('start', () => {}, { id: 'n.start' });
      M.hook('kind', () => null, { id: 'n.kind' });
      M.hook('pick', () => null, { id: 'n.pick' });
      M.hook('answer', () => {}, { id: 'n.answer' });
      M.hook('finish', () => {}, { id: 'n.finish' });
    }
    const rec = newRecord(PX, T0 - 2 * DAY);
    const p = play(PX, rec, 'train', { now: T0, minutes: 3 }, 25);
    return { steps: p.steps.map((s) => [s.exId, s.kind, s.code, s.seed, Math.round(s.pPred * 1e6)]), rows: rec.trials, sessions: rec.sessions.map((s) => [s.trials, s.right, s.exs.join()]) };
  }
  const a = session(false), b = session(true);
  t.eq(b.steps, a.steps, 'the same items in the same order');
  t.eq(b.rows, a.rows, 'the same trial rows');
  t.eq(b.sessions, a.sessions, 'the same session');
}

function errors(t) {
  t.section('modes hooks: a throwing hook is skipped and reported');
  const PX = mk(t), M = PX.engine.modes;
  M.hook('start', () => { throw new Error('start broke'); }, { id: 'bad.start' });
  M.hook('kind', () => { throw new Error('kind broke'); }, { id: 'bad.kind' });
  M.hook('kind', (plan, rec, def, kind) => (kind === 'target' ? 'lead' : null), { id: 'good.kind', order: 60 });
  M.hook('pick', () => { throw new Error('pick broke'); }, { id: 'bad.pick' });
  M.hook('answer', () => { throw new Error('answer broke'); }, { id: 'bad.answer' });
  M.hook('finish', () => { throw new Error('finish broke'); }, { id: 'bad.finish' });
  const rec = newRecord(PX, T0 - 2 * DAY);
  const p = play(PX, rec, 'train', { now: T0, pin: 'fold', count: 1, minutes: 2 }, 12);
  t.ok(p.steps.length >= 10, 'the session runs on');
  t.ok(p.steps.some((s) => s.kind === 'lead'), 'the other hooks still run');
  const ids = new Set((p.res.errors || []).map((e) => e.id));
  t.eq([...ids].sort(), ['bad.answer', 'bad.finish', 'bad.kind', 'bad.pick', 'bad.start'], 'every failure is listed in res.errors');
  t.ok(p.res.errors.every((e) => typeof e.point === 'string' && /broke/.test(e.message)), 'with its point and message');
  t.ok(p.plan.errors.length <= 50, 'the list is capped');
  t.eq(rec.sessions.length, 1, 'the session is saved');
}

function schedule(t) {
  t.section('schedule: the exclude hook and setStage');
  const PX = mk(t), E = PX.engine, S = E.schedule;
  const rec = newRecord(PX, T0 - 10 * DAY);
  const now = T0;
  t.throws(() => S.hook('nope', () => null, { id: 'x' }), /unknown point/, 'an unknown point is refused');
  t.throws(() => S.hook('exclude', () => null, {}), /opts\.id/, 'an id is required');
  const off = S.hook('exclude', (r, def, t2) => (def.id === 'rotate' && t2 < now + 3 * DAY ? { why: 'Rotate rests until Thursday.', until: now + 3 * DAY } : null), { id: 'test.rest' });
  t.throws(() => S.hook('exclude', () => null, { id: 'test.rest' }), /already registered/, 'a duplicate id is refused');
  const rot = PX.ex.get('rotate');
  t.eq(S.excluded(rec, rot, now), { why: 'Rotate rests until Thursday.', until: now + 3 * DAY, by: 'test.rest' }, 'excluded() gives the reason, the end and the hook');
  t.eq(S.excluded(rec, rot, now + 4 * DAY), null, 'after its end it is back');
  t.eq(S.excluded(rec, PX.ex.get('fold'), now), null, 'others are not excluded');
  t.ok(!S.auto(rec, rot, now), 'automatic choices skip it');
  let tries = 0;
  for (let i = 0; i < 6; i++) {
    const plan = E.modes.start(rec, 'train', { now: now + i * 60000, minutes: 5 });
    t.ok(plan.exs.indexOf('rotate') < 0, 'no Train plan holds it (' + plan.exs.join(',') + ')');
    tries++;
  }
  const b = S.build(rec, {}, now);
  t.ok(b.exs.indexOf('rotate') < 0, "Today's plan leaves it out");
  const pinned = E.modes.start(rec, 'train', { now, pin: 'rotate', minutes: 5 });
  t.ok(pinned.exs.indexOf('rotate') >= 0, 'a pin (an explicit pick) still takes it');
  const free = E.modes.start(rec, 'free', { now, exId: 'rotate', minutes: 2 });
  t.ok(!free.unavailable && free.exs[0] === 'rotate', 'Free play still takes it');
  const path = E.modes.start(rec, 'path', { now, exId: 'rotate', minutes: 2 });
  t.ok(!path.unavailable && path.exs[0] === 'rotate', 'a chosen Path still takes it');
  off();
  t.ok(S.auto(rec, rot, now), 'off() lifts it');
  S.hook('exclude', () => { throw new Error('broken'); }, { id: 'test.bad' });
  t.eq(S.excluded(rec, rot, now), null, 'a throwing hook excludes nothing');
  t.ok(S.hookErrors().some((e) => e.id === 'test.bad' && /broken/.test(e.message)), 'and is listed in hookErrors()');

  t.section('schedule.setStage');
  S.train(rec).sw.fold = [[1, 500], [0, 600]];
  t.eq(S.setStage(rec, 'fold', 4), 4, 'it sets a stage');
  t.eq(S.stage(rec, 'fold', 'balanced'), 4, 'stage() reads it');
  t.eq(rec.train.sw.fold, [], 'and restarts the switch window');
  t.eq(S.setStage(rec, 'fold', 9), 5, 'clamped to 5');
  t.eq(S.setStage(rec, 'fold', 0), 1, 'clamped to 1');
  t.eq(S.setStage(rec, 'Not an id', 2), 0, 'a bad id changes nothing');
}

function merge(t) {
  t.section('merge.register');
  const PX = mk(t), E = PX.engine;
  t.throws(() => E.merge.register('trials', () => null), /merged by merge\.js/, 'a built-in field is refused');
  t.throws(() => E.merge.register('bad key', () => null), /needs a field key/, 'a bad key is refused');
  let info = null;
  E.merge.register('w2list', (theirs, mine, inf) => {
    info = inf;
    const a = (theirs && theirs.list) || [], b = (mine && mine.list) || [];
    if (theirs) theirs.list = 'mutated'; // copies: the inputs stay as they were
    return { list: a.concat(b.filter((x) => a.indexOf(x) < 0)).sort() };
  });
  t.throws(() => E.merge.register('w2list', () => null), /already has a merge/, 'one merge per field');
  E.merge.register('w2none', () => undefined);
  t.eq(E.merge.registered(), ['w2list', 'w2none'], 'registered() lists them');
  const base = newRecord(PX, T0 - DAY);
  const theirs = Object.assign(JSON.parse(JSON.stringify(base)), { rev: 5, updated: T0, w2list: { list: ['a', 'c'] }, w2none: { x: 'theirs' } });
  const mine = Object.assign(JSON.parse(JSON.stringify(base)), { rev: 4, updated: T0 + 10, w2list: { list: ['b', 'c'] }, w2none: { x: 'mine' } });
  const out = E.merge(theirs, mine);
  t.eq(out.w2list, { list: ['a', 'b', 'c'] }, 'a registered merge unites both sides');
  t.eq(theirs.w2list, { list: ['a', 'c'] }, 'its inputs are copies');
  t.eq(info, { newer: 'mine' }, 'it is told which side is newer');
  t.eq(out.w2none, { x: 'mine' }, 'undefined keeps the newer side');
  E.merge.register('w2bad', () => { throw new Error('no'); });
  const out2 = E.merge(Object.assign({}, theirs, { w2bad: 1 }), Object.assign({}, mine, { w2bad: 2 }));
  t.eq(out2.w2bad, 2, 'a throwing merge keeps the newer side');
  const only = E.merge(base, Object.assign(JSON.parse(JSON.stringify(base)), { updated: T0 + 99, w2list: { list: ['z'] } }));
  t.eq(only.w2list, { list: ['z'] }, 'a field on one side only is merged too');
}
