/* Engine hooks and shared pieces of v1.2 wave 2 (docs/dev/CONTRACT-v1.2.md N, Q): PX.engine.defaults,
   the modes hook points (start, kind, pick, answer, finish), the schedule's exclude hook and
   setStage, merge.register, and the trial-row columns 14-19 (kind, layer, answer mode, orientation,
   deadline, b offset) in E.log, the store's repair, addTrial and both CSV writers.
   Fixture exercises (tests/node/fixtures/exercises.mjs). */
import { defineFixtures } from './fixtures/exercises.mjs';
import { newRecord } from './fixtures/learner.mjs';
import { MANIFEST } from './run.mjs';
import { installDom } from './chimera-dom.mjs';

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
  rows(t);
  storeRows(t);
  logCsv(t);
  produceScale(t);
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
  t.eq(E.merge.registered().filter((k) => k.startsWith('w2')), ['w2list', 'w2none'], 'registered() lists them');
  t.ok(['events', 'plateau', 'game'].every((k) => E.merge.registered().includes(k)), 'the format-4 containers register their merges (events, plateau, game)');
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

function rows(t) {
  t.section('trial rows: columns 14-19 from the step and the result (E.log)');
  const PX = mk(t), E = PX.engine, L = E.log;
  PX.ex.define({
    id: 'drawx', code: 'EX-93', name: 'Draw fixture', abilities: ['Vz'], cell: null, role: 'train', answer: 'choice', nOptions: 4,
    variants: ['pick', 'draw'], trainVariants: ['pick'], layers: { produce: 'draw' },
    dims: [{ key: 'size', levels: [1, 2, 3], step: 0.5 }], base: -1,
    timeLimit(params) { return params.size === 2 ? 30000 : null; },
    generate(rng, params) { return { ex: 'drawx', seed: rng.seed, params, key: 0 }; }, validate() { return true; }, score(item, r) { return { correct: r === item.key }; },
  });
  t.eq([L.COL.value2, L.COL.kind, L.COL.layer, L.COL.amode, L.COL.orient, L.COL.dl, L.COL.bOff], [12, 13, 14, 15, 16, 17, 18], 'column indexes');
  t.eq([L.KINDS.length, L.LAYERS, L.AMODES, L.ORIENTS, L.DEADLINES], [18, ['', 'compare-apply', 'produce', 'calib-detail', 'bridge'], ['', 'option', 'drag', 'dial', 'fine', 'keys', 'place', 'draw'], ['', 'portrait', 'landscape'], ['', 'pace', 'speed', 'limit']], 'the code lists');
  const rec = newRecord(PX, T0), fold = PX.ex.get('fold'), dx = PX.ex.get('drawx');
  const p0 = { folds: 1, type: 0, punches: 0 }, b0 = fold.difficulty(p0);
  const row = (def, mode, step, result) => L.row(rec, def, mode, Object.assign({ code: PX.ex.paramsCode(fold, p0), seed: 1, params: p0 }, step), 1, result || {}, T0);
  const r1 = row(fold, 'train', { kind: 'lead', b: b0 }, { amode: 'drag', orient: 'landscape', value2: 0.5 });
  t.eq(r1.slice(12), [0.5, 9, 0, 2, 2, 0], 'value2, kind lead, no layer, amode drag, landscape, no deadline; no offset column when b is the params b');
  t.eq(row(fold, 'train', { kind: 'target', b: b0 }).slice(12), [null, 2, 0, 0, 0, 0], 'value2 null when absent, unknown amode and orientation 0');
  t.eq(row(fold, 'train', { kind: 'target', weak: true }).slice(13, 14), [7], 'a weak-spot target item logs kind weak');
  t.eq(row(fold, 'path', { kind: 'target', recheck: 2 }).slice(13, 14), [8], 'a Path recheck logs kind recheck');
  t.eq(row(fold, 'train', { kind: 'nonsense' }).slice(13, 14), [0], 'an unknown kind logs 0');
  t.eq(row(fold, 'train', { kind: 'target', layer: 'compare-apply' })[14], 1, 'the step layer');
  t.eq(row(dx, 'free', { kind: 'target', params: { size: 0, variant: 'draw' } })[14], 2, "the draw variant named in def.layers.produce logs layer produce");
  t.eq(row(dx, 'free', { kind: 'target', params: { size: 0, variant: 'pick' } })[14], 0, 'its other variant logs none');
  t.eq(row(fold, 'train', { kind: 'target', paced: true, deadlineMs: 9000 })[17], 1, 'a Quick deadline logs pace');
  t.eq(row(fold, 'speed', { kind: 'timed', deadlineMs: 2000, timed: true })[17], 2, 'Speed mode logs speed');
  t.eq(row(fold, 'train', { kind: 'fluency', deadlineMs: 2000, timed: true })[17], 2, 'a fluency item logs speed');
  t.eq(row(fold, 'threshold', { kind: 'threshold', deadlineMs: 2500, timed: true })[17], 2, 'the deadline protocol logs speed');
  t.eq(row(fold, 'free', { kind: 'target', deadlineMs: 5000, timed: true })[17], 3, "Free play's set deadline logs limit");
  t.eq(row(dx, 'train', { kind: 'target', params: { size: 2, variant: 'pick' } })[17], 3, 'def.timeLimit logs limit');
  t.eq(row(fold, 'threshold', { kind: 'threshold' })[17], 0, 'no deadline logs 0');
  const r2 = row(fold, 'train', { kind: 'target', b: b0 + 0.3456 });
  t.eq([r2.length, r2[18]], [19, 346], 'an offset from the params b is logged in milli-logits');
  t.eq(row(fold, 'train', { kind: 'target', b: b0 - 50 })[18], -10000, 'and capped at ±10 logits');
  t.eq(row(fold, 'train', { kind: 'target', b: b0, params: undefined }).length, 18, 'no params: no offset');
  t.eq(L.read(rec, r2), { t: Math.floor(T0 / 1000), ex: 'fold', ver: 1, mode: 'train', code: PX.ex.paramsCode(fold, p0), seed: 1, outcome: 1, rt: null, value: null, pp: null, stage: null,
    display: '', input: '', value2: null, kind: 'target', layer: '', amode: '', orient: '', dl: '', bOff: 346 }, 'read() names every column');
  t.eq(L.read(rec, [Math.floor(T0 / 1000), 0, 0, 0, 1, 0, 800, null, 700, 2, 1, 2, 1.5]), Object.assign(L.read(rec, [Math.floor(T0 / 1000), 0, 0, 0, 1, 0, 800, null, 700, 2, 1, 2, 1.5]), { kind: '', layer: '', dl: '', bOff: 0 }), 'a 1.1 row reads its missing columns as their defaults');
  t.eq(L.read(rec, [1, 0, 0, 0, 1, 0, 800, null, 700, 2, 1, 2, 1.5]).value2, 1.5, 'and keeps its value2');
  t.eq(L.read(rec, [1, 0]), null, 'a broken row reads as null');
  t.near(L.bUsed(fold, r2, 1), b0 + 0.346, 1e-9, 'bUsed: the params b plus the offset');
  t.near(L.bUsed(fold, r1, 1), b0, 1e-9, 'bUsed without an offset is the params b');
  t.eq(L.bUsed(fold, r2, 2), null, 'bUsed is null for another version of the exercise');
  // the engine logs the kind it dealt and the deadline of paced items
  const rec2 = newRecord(PX, T0 - DAY);
  const p = play(PX, rec2, 'train', { now: T0, pin: 'fold', count: 1, minutes: 2 }, 12, () => ({ correct: true, rt: 1200, amode: 'option', orient: 'portrait' }));
  t.ok(p.outs.every((o, i) => L.read(rec2, o.row).kind === (p.steps[i].kind === 'target' && p.steps[i].weak ? 'weak' : p.steps[i].kind)), 'Train rows log the dealt kinds');
  t.ok(p.outs.every((o) => o.row[15] === 1 && o.row[16] === 1), "the player's answer mode and orientation reach the rows");
}

function storeRows(t) {
  t.section('trial rows: the store keeps, repairs and exports columns 14-19');
  const env = t.env({ exercises: false });
  defineFixtures(env.PX);
  const S = env.PX.core.store, L = env.PX.engine.log;
  t.eq([S.KINDS, S.LAYERS, S.AMODES, S.ORIENTS, S.DEADLINES, S.DISPLAYS, S.INPUTS], [L.KINDS, L.LAYERS, L.AMODES, L.ORIENTS, L.DEADLINES, L.DISPLAYS, L.INPUTS], "the store's code lists equal E.log's");
  const tS = Math.floor(T0 / 1000);
  const r11 = [tS, 0, 0, 3, 13, 1, 900, null, 650, 3, 2, 4, 1.25];
  const rNew = [tS + 1, 0, 0, 3, 14, 1, 900, null, 650, 3, 2, 4, null, 9, 1, 2, 1, 3];
  const rOff = [tS + 2, 0, 0, 3, 15, 1, 900, null, 650, 3, 2, 4, 0.75, 10, 0, 1, 2, 2, -420];
  const rBad = [tS + 3, 0, 0, 3, 16, 1, 900, null, 650, 3, 2, 4, 'x', 99, -1, 2.5, 7, 4, 0.5];
  const rZero = [tS + 4, 0, 0, 3, 17, 1, 900, null, 650, 3, 2, 4, null, 2, 0, 0, 0, 0, 0];
  const rShort = [tS + 5, 0, 0, 3, 18, 1, 900, null, 650, 3, 2, 4, NaN, 2];
  const g = S.guard({ v: 3, trials: [r11, rNew, rOff, rBad, rZero, rShort], idx: { ex: ['fold@1'], mode: ['train'] } });
  t.eq(g.trials[0], r11, 'a 1.1 row is kept as it was');
  t.eq(g.trials[1], rNew, 'a row with the new codes is kept');
  t.eq(g.trials[2], rOff, 'with its offset');
  t.eq(g.trials[3], [tS + 3, 0, 0, 3, 16, 1, 900, null, 650, 3, 2, 4, null, 0, 0, 0, 0, 0], 'bad codes become 0, a bad value2 null, a bad offset is dropped');
  t.eq(g.trials[4].length, 18, 'an offset of 0 is dropped');
  t.eq(g.trials[5], [tS + 5, 0, 0, 3, 18, 1, 900, null, 650, 3, 2, 4, null, 2], 'a short new row keeps its columns, value2 as null');
  S.load();
  S.addTrial({ t: T0, ex: 'fold', mode: 'train', code: 1, seed: 5, outcome: 1, rt: 800, kind: 'lead', layer: 'produce', amode: 'dial', orient: 'portrait', dl: 'pace', bOff: 250.4 });
  S.addTrial({ t: T0 + 1000, ex: 'fold', mode: 'train', code: 1, seed: 6, outcome: 0, rt: 900, kind: 10, amode: 'nope', value2: 2.5 });
  S.addTrial({ t: T0 + 2000, ex: 'fold', mode: 'train', code: 1, seed: 7, outcome: 1, rt: 700, value2: 1.5 });
  const tr = S.state.trials;
  t.eq(tr[0].slice(12), [null, 9, 2, 3, 1, 1, 250], 'addTrial stores names as codes and the offset rounded');
  t.eq(tr[1].slice(12), [2.5, 10, 0, 0, 0, 0], 'codes pass, unknown names become 0, value2 holds its column');
  t.eq(tr[2].slice(8), [null, null, 0, 0, 1.5], 'without the new fields the 1.1 layout stays');
  PX_defineBet(env.PX);
  S.addTrial({ t: T0 + 3000, ex: 'betx', mode: 'free', code: 1, seed: 8, outcome: 1, rt: 600, kind: 'target', layer: 'compare-apply', amode: 'option', orient: 'landscape', dl: 'limit', bOff: -1500 });
  const lines = S.exportCSV().split('\r\n').filter(Boolean);
  t.eq(lines[0].split(',').length, 26, 'the CSV header has 26 columns');
  t.eq(lines[0].split(',').slice(18), ['kind', 'layer', 'answer_mode', 'orientation', 'deadline', 'b_offset', 'bet', 'format'], 'the eight new ones, in order');
  t.ok(lines.slice(1).every((l) => l.split(',').length === 26), 'every row has 26 cells');
  t.eq(lines[1].split(',').slice(17), ['', 'lead', 'produce', 'dial', 'portrait', 'pace', '0.25', '', ''], 'codes as words, the offset in logits; an exercise without bet or format leaves them empty');
  t.eq(lines[3].split(',').slice(18), ['', '', '', '', '', '0', '', ''], 'a row without the new columns: empty words, offset 0');
  t.eq(lines[4].split(',').slice(18), ['target', 'compare-apply', 'option', 'landscape', 'limit', '-1.5', 'compare', 'betx-pick'], "bet and the variant's format from the definition");
}

function PX_defineBet(PX) {
  PX.ex.define({
    id: 'betx', code: 'EX-94', name: 'Bet fixture', abilities: ['Vz'], cell: null, role: 'train', answer: 'choice', nOptions: 4, bet: 'compare',
    variants: ['pick', 'draw'], format: { pick: 'betx-pick', '*': 'betx-other' },
    dims: [{ key: 'size', levels: [1, 2], step: 0.5 }], base: -1,
    generate(rng, params) { return { ex: 'betx', seed: rng.seed, params, key: 0 }; }, validate() { return true; }, score(item, r) { return { correct: r === item.key }; },
  });
}

function logCsv(t) {
  t.section("trial rows: the Log's CSV (js/ui/log.js) writes the same 26 columns");
  const files = [...MANIFEST, 'js/core/keys.js', 'js/core/svg.js', 'js/core/ui.js', 'js/ui/log.js'];
  const e = t.env({ files, exercises: false, now: T0 });
  installDom(e.document, e.window);
  t.ok(!e.loadErrors.length, 'log.js loads in Node: ' + e.loadErrors.join(' | '));
  if (e.loadErrors.length) return;
  defineFixtures(e.PX);
  PX_defineBet(e.PX);
  const S = e.PX.core.store;
  S.load();
  S.addTrial({ t: T0, ex: 'betx', mode: 'free', code: 1, seed: 8, outcome: 1, rt: 600, kind: 'target', layer: 'compare-apply', amode: 'option', orient: 'landscape', dl: 'limit', bOff: -1500 });
  S.addTrial({ t: T0 + 1000, ex: 'fold', mode: 'train', code: 2, seed: 9, outcome: 0, rt: 700, value2: 3 });
  t.ok(typeof S.csv === 'function', 'log.js registers store.csv');
  const lines = S.exportCSV().split('\r\n').filter(Boolean);
  t.eq(lines[0], S.CSV_HEADER.join(','), 'the header is the store’s');
  t.ok(lines.slice(1).every((l) => l.split(',').length === 26), 'every row has 26 cells');
  t.eq(lines[1].split(',').slice(18), ['target', 'compare-apply', 'option', 'landscape', 'limit', '-1.5', 'compare', 'betx-pick'], 'the new cells, as the store writes them');
  t.eq(lines[2].split(',').slice(17), ['3', '', '', '', '', '', '0', '', ''], 'a 1.1-shaped row: value2, empty words, offset 0');
  const research = e.PX.ui.log.csv(e.PX.ui.log.rows(S.state), { research: true }).split('\r\n').filter(Boolean);
  t.eq(research[0].split(',').slice(-11), ['kind', 'layer', 'answer_mode', 'orientation', 'deadline', 'b_offset', 'bet', 'format', 'b', 'g', 'answer'], 'the research CSV adds b, g and answer after them');
  t.ok(research.slice(1).every((l) => l.split(',').length === 29), 'every research row has 29 cells');
}

// Conflict 12 (accepted): the produce variant (layers.produce) never moves the level scale: the
// range (registry, core.test.mjs) and the reference guessing rate leave it out.
function produceScale(t) {
  t.section('the produce variant and the level scale (conflict 12)');
  const PX = mk(t), M = PX.engine.model;
  const base = () => ({ abilities: ['Vz'], cell: null, role: 'train', answer: 'choice', nOptions: 4, variants: ['pick', 'draw'],
    dims: [{ key: 'size', levels: [1, 2, 3], step: 0.5 }], base: -1, chance: (p) => (p.variant === 'draw' ? 0.02 : 0.25),
    generate(rng, params) { return { ex: 'px', seed: rng.seed, params, key: 0 }; }, validate() { return true; }, score(item, r) { return { correct: r === item.key }; } });
  const plain = PX.ex.define(Object.assign(base(), { id: 'prodoff', code: 'EX-86', name: 'Without a produce layer' }));
  const prod = PX.ex.define(Object.assign(base(), { id: 'prodon', code: 'EX-87', name: 'With a produce layer', trainVariants: ['pick'], layers: { produce: 'draw' } }));
  t.near(M.refChance(plain), (0.02 + 0.25) / 2, 1e-12, 'without a produce layer the median runs over every variant');
  t.eq(M.refChance(prod), 0.25, 'with one, the reference guessing rate leaves the produce variant out');
  t.eq(M.pool(prod).filter((c) => c.params.variant === 'draw').length, 3, 'its items stay in the pool (explicit picks and the bets pick hook use them)');
}
