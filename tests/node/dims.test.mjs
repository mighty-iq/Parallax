/* PLAN milestone 7 (js/engine/dims.js; docs/dev/CONTRACT-v1.2.md Q, conflicts 2 and 10; ENGINE.md §19):
   per-dimension offsets (the fit, its centre, cap and flags), the person pool and select.pick's opts.pool,
   frontiers and the leading dimension, deck room, fluency items on the timed rating, and the readers of
   Train rows that a fluency item must leave unchanged. Fixture exercises (tests/node/fixtures/exercises.mjs). */
import { defineFixtures } from './fixtures/exercises.mjs';
import { Learner, newRecord, playSession } from './fixtures/learner.mjs';

const DAY = 86400000;
const T0 = Date.UTC(2026, 10, 16, 18, 0, 0); // Monday 16 Nov 2026

function mk(t) {
  const c = t.context({ exercises: false });
  defineFixtures(c.PX);
  return c.PX;
}

// Plays sessions of a learner on the given exercises for `days` days (one a day). → { rec, L, last }
function train(PX, ids, days, opts = {}) {
  const rec = opts.rec || newRecord(PX, T0 - DAY);
  const L = opts.L || new Learner(PX, opts.seed || 1);
  const can = (d) => ids.includes(d.id);
  let last = null;
  for (let d = 0; d < days; d++) last = playSession(PX, rec, L, opts.mode || 'train', { now: T0 + d * DAY + 3600e3, display: 'large', can, exId: opts.exId, minutes: opts.minutes || 20 }, d);
  return { rec, L, last };
}

// Rows answered by a model learner: θ fixed, items uniform over the pool, true difficulty b + Σ z (lv − c).
function synthRows(PX, rec, def, z, n, seed, theta = 0) {
  const E = PX.engine, M = E.model, r = PX.rng(seed), pool = M.pool(def);
  const ex = E.log.exIndex(rec, def), md = E.log.modeIndex(rec, 'train'), mids = def.dims.map((d) => (d.levels.length - 1) / 2);
  for (let i = 0; i < n; i++) {
    const c = r.pick(pool);
    let b = c.b;
    def.dims.forEach((d, j) => { b += (z[j] || 0) * (c.lv[j] - mids[j]); });
    const y = r.chance(M.p(theta, b, c.g)) ? 1 : 0;
    const pp = Math.round(M.pExp(theta, 0.3, c.b, c.g) * 1000);
    rec.trials.push([Math.floor((T0 + i * 4000) / 1000), ex, md, c.code, i + 1, y, 2000, null, pp, 1, 2, 1, null, 2, 0, 1, 0, 0]);
  }
}

export async function run(t) {
  config(t);
  stateAndFit(t);
  recovery(t);
  poolAndPick(t);
  frontierAndLead(t);
  room(t);
  fluency(t);
  readers(t);
  modesAndPaths(t);
  determinism(t);
}

function config(t) {
  t.section('dims: config and hooks');
  const PX = mk(t), E = PX.engine, D = E.config.dims;
  t.eq([D.from, D.window, D.prior, D.cap, D.lead, D.maxChanged, D.fluency], [100, 400, 0.5, 0.75, 5, 3, 0.1], 'the plan\'s numbers: from 100 answers, the last 400, prior 0.5 × step, cap 0.75 logit, one target in five leads, 3 of 8 change, fluency 0.1');
  E.configure({ dims: { from: 50 } });
  E.configure('reset');
  t.eq(E.config.dims.from, 100, "configure('reset') restores the block");
  t.eq(E.modes.hooks('kind').find((h) => h.id === 'dims.kind').order, 10, 'kind hook at order 10');
  t.eq(E.modes.hooks('pick').find((h) => h.id === 'dims.pick').order, 10, 'pick hook at order 10');
  t.eq(E.modes.hooks('finish').find((h) => h.id === 'dims.fit').order, 10, 'finish hook (the fit) at order 10');
}

function stateAndFit(t) {
  t.section('dims: state, the fit from 100 answers, the version');
  const PX = mk(t), E = PX.engine, def = PX.ex.get('fold');
  const rec = newRecord(PX, T0 - DAY);
  t.eq(E.dims.state(rec, def, 'large'), null, 'a fresh record has no state');
  t.eq(E.dims.pool(rec, def, 'large'), null, 'and no person pool');
  t.eq(E.dims.b(rec, def, 'large', { folds: 4, type: 3, punches: 2 }), def.difficulty({ folds: 4, type: 3, punches: 2 }), 'b is the item model\'s');
  synthRows(PX, rec, def, [0, 0, 0], 60, 3);
  const s1 = E.dims.fit(rec, def, 'large', T0);
  t.ok(s1 && !s1.active && s1.n === 60 && s1.o.every((x) => x === 0), 'under 100 answers the state is inactive and every offset 0');
  t.ok(s1.c.every((x, i) => x >= 0 && x <= def.dims[i].levels.length - 1), 'the centre is a level index per dimension');
  synthRows(PX, rec, def, [0, 0, 0], 60, 4);
  const s2 = E.dims.fit(rec, def, 'large', T0 + DAY);
  t.ok(s2.active && s2.n === 120, 'from 100 answers the state is active (' + s2.n + ')');
  t.eq(rec.ex.fold.dims.v, def.version, 'the state carries the exercise version');
  t.ok(['v', 'n', 'at', 'o', 'cap', 'lead', 'c'].every((k) => k in rec.ex.fold.dims), 'state keys v, n, at, o, cap, lead, c');
  rec.ex.fold.dims.v = def.version + 1;
  t.eq(E.dims.state(rec, def, 'large'), null, 'a state of another version is ignored');
  E.dims.fit(rec, def, 'large', T0 + 2 * DAY);
  t.eq(rec.ex.fold.dims.v, def.version, 'and replaced at the next fit');
  // rows of other modes, other exercises and voided outcomes are left out
  const n0 = E.dims.state(rec, def, 'large').n;
  const free = E.log.modeIndex(rec, 'free'), ex = E.log.exIndex(rec, def);
  rec.trials.push([Math.floor(T0 / 1000), ex, free, rec.trials[0][3], 999, 1, 1000, null, 700, 1, 2, 1]);
  rec.trials.push([Math.floor(T0 / 1000), ex, E.log.modeIndex(rec, 'train'), rec.trials[0][3], 998, 2, 1000, null, 700, 1, 2, 1]);
  t.eq(E.dims.fit(rec, def, 'large', T0 + 3 * DAY).n, n0, 'Free play rows and voided answers do not count');
}

function recovery(t) {
  t.section('dims: the fit recovers a profile, the cap binds and is flagged');
  const PX = mk(t), E = PX.engine, def = PX.ex.get('fold');
  let err = 0, sign = 0, k = 0;
  for (let rep = 0; rep < 8; rep++) {
    const rec = newRecord(PX, T0 - DAY), z = [0.3, -0.2, 0];
    synthRows(PX, rec, def, z, 400, 100 + rep);
    const s = E.dims.fit(rec, def, 'large', T0);
    for (let j = 0; j < 3; j++) { err += (s.o[j] - z[j]) ** 2; k++; if (z[j] && Math.sign(s.o[j]) === Math.sign(z[j])) sign++; }
  }
  t.ok(sign >= 14, 'the signs of non-zero deviations are recovered (' + sign + ' of 16)');
  t.ok(Math.sqrt(err / k) < 0.15, 'offset error RMS ' + Math.sqrt(err / k).toFixed(3) + ' logits per step (< 0.15)');
  const rec = newRecord(PX, T0 - DAY);
  synthRows(PX, rec, def, [1.2, 0, 0], 400, 7);
  const s = E.dims.fit(rec, def, 'large', T0), capF = E.config.dims.cap / 2; // folds: 5 levels, top 2 steps from the middle
  t.near(Math.abs(s.o[0]), capF, 1e-3, 'a deviation beyond the cap stops at 0.75 logit at the top level (' + s.o[0] + ')');
  t.eq(s.cap, [1, 0, 0], 'and is flagged at the cap');
  E.configure({ dims: { spread: { fold: { folds: 0.2 } } } });
  t.near(E.dims._.priorSd(def, E.dims._.info(def).dims[0]), 0.2, 1e-9, 'a pooled spread replaces the prior');
  t.near(E.dims._.capStep(def, E.dims._.info(def).dims[0]), 0.5, 1e-9, 'and sets the cap to 2.5 spreads per step');
  E.configure('reset');
}

function poolAndPick(t) {
  t.section('dims: the person pool and select.pick with opts.pool');
  const PX = mk(t), E = PX.engine, M = E.model, def = PX.ex.get('rotate');
  const rec = newRecord(PX, T0 - DAY);
  rec.ex.rotate = { mu: 0.5, sd: 0.3, n: 200, nRight: 150, last: T0, seen: {}, best: {}, hist: [] };
  rec.ex.rotate.dims = { v: def.version, n: 300, at: T0, o: [0.2, -0.1, 0], cap: [0, 0, 0], lead: 0, c: [2, 1, 1.5] };
  const pe = E.dims.pool(rec, def, 'large'), base = M.pool(def);
  t.ok(pe && pe.list.length === base.length && pe.list.every((c, i) => c.i === i && c.key === base[i].key), 'the same candidates in the same order');
  t.ok(pe.list.every((c) => Math.abs(c.b - (c.b0 + 0.2 * (c.lv[0] - 2) - 0.1 * (c.lv[1] - 1))) < 1e-9), 'b = b0 + Σ o (lv − centre)');
  t.ok(pe.groups.every((g) => g.list.every((c, i) => i === 0 || g.list[i - 1].b <= c.b)), 'groups sorted by the person b');
  const p = { angle: 5, axis: 3, cubes: 2, variant: 'pick' };
  t.near(E.dims.b(rec, def, 'large', p), pe.byKey[PX.ex.paramsKey(p)].b, 1e-9, 'b() agrees with the pool');
  t.ok(E.dims.pool(rec, def, 'large') === pe, 'the pool is cached for the same offsets');
  const st = E.est.get(rec, def, {});
  const r = E.select.pick(def, st, { kind: 'target', k: 0.7, pool: pe });
  t.near(r.p, M.pExp(st.mu, st.sd, pe.byKey[r.key].b, r.g), 1e-9, 'pick predicts with the person b');
  t.ok(Math.abs(r.p - r.target) <= 0.05, 'and finds an item at the target (' + r.p.toFixed(3) + ' vs ' + r.target.toFixed(3) + ')');
  const r0 = E.select.pick(def, st, { kind: 'target', k: 0.7 });
  t.near(r0.p, M.pExp(st.mu, st.sd, r0.b, r0.g), 1e-9, 'without a pool the item model\'s b');
  const fx = E.select.fixed(def, st, p, pe);
  t.near(fx.b, pe.byKey[PX.ex.paramsKey(p)].b, 1e-9, 'select.fixed takes the person pool too');
  t.eq(E.select.pick(def, st, { kind: 'target', k: 0.7, pool: { list: [1, 2, 3] } }).key !== undefined, true, 'a pool of the wrong size is ignored');
}

function frontierAndLead(t) {
  t.section('dims: frontiers and the leading dimension');
  const PX = mk(t), E = PX.engine, def = PX.ex.get('fold');
  const rec = newRecord(PX, T0 - DAY);
  rec.ex.fold = { mu: -0.5, sd: 0.3, n: 200, nRight: 150, last: T0, seen: {}, best: {}, hist: [] };
  const f0 = E.dims.frontier(rec, def, 'large');
  t.eq(f0.map((x) => x.key), ['folds', 'type', 'punches'], 'one entry per dimension with levels');
  rec.ex.fold.mu = 1.5;
  const f1 = E.dims.frontier(rec, def, 'large');
  t.ok(f1.every((x, i) => x.level >= f0[i].level) && f1.some((x, i) => x.level > f0[i].level), 'a higher rating handles higher levels');
  t.ok(f1.every((x) => x.value === null || def.dims[x.dim].levels.includes(x.value)), 'values are the dimension\'s own');
  rec.ex.fold.mu = 0;
  rec.ex.fold.dims = { v: def.version, n: 300, at: T0, o: [-0.3, 0, 0], cap: [0, 0, 0], lead: 0, c: [1, 1, 1] };
  const easy = E.dims.frontier(rec, def, 'large')[0].level;
  rec.ex.fold.dims.o = [0.3, 0, 0];
  const hard = E.dims.frontier(rec, def, 'large')[0].level;
  t.ok(easy > hard, 'a flatter step (negative offset) moves that dimension\'s frontier up (' + easy + ' vs ' + hard + ')');
  // lead items in Train: about one target item in five, rotating through the dimensions
  const PX2 = mk(t), E2 = PX2.engine;
  const { rec: r2 } = train(PX2, ['fold'], 6);
  const rows = r2.trials.map((r) => E2.log.read(r2, r));
  const lead = rows.filter((r) => r.kind === 'lead').length, tgt = rows.filter((r) => r.kind === 'target' || r.kind === 'weak').length;
  t.ok(lead > 0 && Math.abs(lead / (lead + tgt) - 0.2) < 0.06, 'lead items are about one target item in five (' + lead + ' of ' + (lead + tgt) + ')');
  const first = r2.sessions[0], firstRows = rows.filter((r) => r.t * 1000 <= first.end);
  t.ok(firstRows.length > 10 && !firstRows.some((r) => r.kind === 'lead' || r.kind === 'fluency'), 'a first session has no lead or fluency items (they start after the exercise\'s first fit)');
  t.ok(rows.some((r) => r.t * 1000 > first.end && r.kind === 'lead'), 'later sessions have them');
}

function room(t) {
  t.section('dims: at most 3 of a deck\'s 8 target items change kind (conflict 10)');
  const PX = mk(t), E = PX.engine;
  E.modes.hook('start', (plan) => { plan.exs.forEach((id) => { plan.share[id] = { fluency: 0.9 }; }); }, { id: 'test.fluency' });
  const { rec } = train(PX, ['fold', 'rotate'], 8); // Speed opens on the way
  const plan = E.modes.start(rec, 'train', { now: T0 + 20 * DAY, display: 'large', can: (d) => ['fold', 'rotate'].includes(d.id) });
  let worst = 0, n = 0, flu = 0;
  for (let i = 0; i < 120; i++) {
    const step = E.modes.next(plan, rec, T0 + 20 * DAY + i * 5000);
    if (step.done) break;
    worst = Math.max(worst, plan.deckChanged || 0);
    if (step.kind === 'fluency') flu++;
    n++;
    E.modes.answer(plan, rec, step, { correct: i % 3 > 0, rt: 1500 }, T0 + 20 * DAY + i * 5000 + 3000);
  }
  t.ok(flu > 0, 'a large fluency share deals fluency items (' + flu + ' of ' + n + ')');
  t.ok(worst <= 3, 'no deck changed more than 3 target items (most ' + worst + ')');
  t.eq(E.dims.room({ deckChanged: 1 }), 2, 'room() is what is left of the 3');
}

function fluency(t) {
  t.section('dims: fluency items once Speed is open (timed rating only)');
  const PX = mk(t), E = PX.engine, def = PX.ex.get('fold');
  const { rec: r0 } = train(PX, ['fold'], 1, { minutes: 5 });
  t.ok(!r0.trials.some((r) => E.log.read(r0, r).kind === 'fluency'), 'none before Speed opens');
  const { rec } = train(PX, ['fold'], 6, { rec: r0 });
  t.ok(E.speed.open(rec, def, { display: 'large' }).ok, 'Speed is open after six sessions');
  const flu = rec.trials.map((r) => E.log.read(rec, r)).filter((r) => r.kind === 'fluency');
  t.ok(flu.length > 0, 'fluency items come once Speed is open (' + flu.length + ')');
  t.ok(flu.every((r) => r.dl === 'speed' && r.mode === 'train'), 'their rows log kind fluency and deadline speed in Train');
  t.ok(E.dims.fluencyOpen(rec, def, 'large') && !E.dims.fluencyOpen(rec, { ...def, pace: { startMs: 9000 } }, 'large'), 'none for an exercise with a Quick deadline of its own');
  const sp = E.modes.start(rec, 'train', { now: T0 + 29 * DAY, display: 'large', can: (d) => d.id === 'fold' });
  t.eq(sp.share.fold.dimsOpen, true, 'a session notes at its start that Speed is open for the exercise');
  // one fluency item, answered right in time, then one timed out
  const plan = E.modes.start(rec, 'train', { now: T0 + 30 * DAY, display: 'large', can: (d) => d.id === 'fold' });
  let step = null;
  for (let i = 0; i < 80 && !step; i++) {
    const s = E.modes.next(plan, rec, T0 + 30 * DAY + i * 4000);
    if (s.done) break;
    if (s.kind === 'fluency') step = s;
    else E.modes.answer(plan, rec, s, { correct: true, rt: 1500 }, T0 + 30 * DAY + i * 4000 + 2000);
  }
  t.ok(step && step.deadlineMs > 0 && step.timed === true && typeof step.bTimed === 'number', 'a fluency step carries a deadline, timed, and its timed difficulty');
  const tm0 = { ...rec.timed.fold }, u0 = JSON.stringify(rec.ex.fold), blk0 = plan.blockN.fold;
  const out = E.modes.answer(plan, rec, step, { correct: true, rt: step.deadlineMs / 2 }, step.i * 4000 + T0 + 30 * DAY + 2000);
  t.eq(out.rated, false, 'out.rated is false: the untimed rating did not move');
  t.ok(out.inTime === true && out.rating && rec.timed.fold.n === (tm0.n || 0) + 1, 'the timed rating took the answer, right in time');
  t.ok(rec.timed.fold.deadline < step.deadlineMs, 'the Speed deadline shortened after an answer right in time');
  t.eq(JSON.stringify(rec.ex.fold), u0, 'the untimed rating, its history, snapshots and weak-spot residuals are unchanged');
  t.eq(plan.blockN.fold, blk0, 'blocks of 10 do not count it');
  t.eq(out.blockEnd, null, 'and it ends no block');
  let s2 = null;
  for (let i = 100; i < 260 && !s2; i++) {
    const s = E.modes.next(plan, rec, T0 + 30 * DAY + i * 4000);
    if (s.done) break;
    if (s.kind === 'fluency') s2 = s;
    else E.modes.answer(plan, rec, s, { correct: true, rt: 1500 }, T0 + 30 * DAY + i * 4000 + 2000);
  }
  if (s2) {
    const d0 = s2.deadlineMs;
    const o2 = E.modes.answer(plan, rec, s2, { correct: false, rt: d0, timeout: true }, T0 + 31 * DAY);
    t.ok(o2.inTime === false && rec.timed.fold.deadline > d0, 'a time-out lengthens the deadline');
  }
}

function readers(t) {
  t.section('dims: readers of Train rows a fluency item leaves unchanged (conflict 2)');
  const PX = mk(t), E = PX.engine, def = PX.ex.get('fold');
  const { rec } = train(PX, ['fold'], 7);
  let n = 0;
  const plan2 = E.modes.start(rec, 'train', { now: T0 + 8 * DAY, display: 'large', can: (d) => d.id === 'fold' });
  for (let i = 0; i < 300 && n < 3; i++) {
    const s = E.modes.next(plan2, rec, T0 + 8 * DAY + i * 4000);
    if (s.done) break;
    const snap = { ex: JSON.stringify(rec.ex.fold), train: JSON.stringify(rec.train), path: JSON.stringify(rec.path || {}), blk: plan2.blockN.fold || 0 };
    const out = E.modes.answer(plan2, rec, s, { correct: i % 2 === 0, rt: 900 }, T0 + 8 * DAY + i * 4000 + 2000);
    if (s.kind !== 'fluency') continue;
    n++;
    t.eq(JSON.stringify(rec.ex.fold), snap.ex, 'rating, history, snapshots (the bandit), weak spots: unchanged by fluency item ' + n);
    t.eq(JSON.stringify(rec.train), snap.train, 'interleaving stages and switch notes: unchanged');
    t.eq(JSON.stringify(rec.path || {}), snap.path, "Path's gate state: unchanged");
    t.eq(plan2.blockN.fold || 0, snap.blk, 'blocks of 10 and personal bests: not counted');
    t.ok(out.rated === false && out.timed === true, 'out.rated false, out.timed true');
  }
  t.ok(n >= 1, 'fluency items were answered (' + n + ')');
  const rows = rec.trials.map((r) => E.log.read(rec, r));
  t.ok(rows.filter((r) => r.kind === 'fluency').every((r) => r.dl === 'speed'), 'the plateau detector can leave them out: kind fluency, deadline speed');
  void def;
}

function modesAndPaths(t) {
  t.section('dims: Path and Free play');
  const PX = mk(t), E = PX.engine, def = PX.ex.get('fold');
  const { rec } = train(PX, ['fold'], 4, { mode: 'path', exId: 'fold' });
  const kinds = new Set(rec.trials.map((r) => E.log.read(rec, r).kind));
  t.ok(!kinds.has('lead') && !kinds.has('fluency'), 'Path deals no lead or fluency items');
  t.ok(E.dims.state(rec, def, 'large'), 'Path sessions fit too');
  rec.ex.fold.dims = { v: def.version, n: 300, at: T0, o: [0.3, 0, 0], cap: [0, 0, 0], lead: 0, c: [0, 0, 0] };
  const plan = E.modes.start(rec, 'free', { now: T0 + 9 * DAY, display: 'large', exId: 'fold', params: { folds: 4, type: 0, punches: 0 } });
  const s = E.modes.next(plan, rec, T0 + 9 * DAY);
  t.near(s.b, def.difficulty(s.params) + 0.3 * 4, 1e-9, 'Free play with fixed settings is predicted on the player\'s own difficulty');
  const out = E.modes.answer(plan, rec, s, { correct: true, rt: 2000 }, T0 + 9 * DAY + 3000);
  t.eq(E.log.read(rec, out.row).bOff, 1200, 'and logs the offset (milli-logits)');
}

function determinism(t) {
  t.section('dims: the same record and times give the same items');
  const run = () => {
    const PX = mk(t);
    const { rec } = train(PX, ['fold', 'views'], 5);
    return rec.trials.map((r) => [r[1], r[3], r[4], r[5], r[13]]);
  };
  t.eq(run(), run(), 'identical rows');
}
