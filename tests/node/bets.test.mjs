/* Transfer bets and the bet trials (PLAN milestone 4; docs/dev/CONTRACT-v1.2.md Q, S, T; note T1 §3–§5;
   docs/dev/v1.2/measure-sim.md §8): the tags on every training exercise, the words of each bet, the
   formats, the crossover's draw (the simulated one, balanced over many players), periods and assign
   events, the pick hook (produce share, calibration detail), the dose rules of comparison rounds and
   bridge sets, recording, the container's repair and merge, dose summaries, and the export header.
   The guide's wording check is in the last section. */
import fs from 'node:fs';
import path from 'node:path';
import { defineFixtures } from './fixtures/exercises.mjs';
import { newRecord } from './fixtures/learner.mjs';
import { assign as simAssign, LAYERS as SIM_LAYERS } from './measure-cross.mjs';

const DAY = 86400000;
const T0 = Date.UTC(2026, 10, 16, 18, 0, 0); // Monday 16 Nov 2026

// note T1 §3.2: the main bet of every training exercise
const MAIN = {
  track: 'attention', span: 'load', fold: 'variety', spin: 'variety', hidden: 'variety', rotate: 'strategy', orient: 'strategy',
  nets: 'compare', knots: 'compare', slice: 'bridge', views: 'produce', reckon: 'calibrate', homing: 'calibrate', centralpoint: 'calibrate',
  angles: 'format', cubes: 'format', openings: 'format', form: 'format', patfold: 'format', patviews: 'format',
};
const FORBIDDEN = /\bIQ\b|smarter|intelligen|master(ed|y)|guarantee|will (improve|raise|make)|proven|brain age|percentile/i;

export async function run(t) {
  tags(t);
  words(t);
  formats(t);
  draw(t);
  balance(t);
  periods(t);
  joining(t);
  pick(t);
  compareDose(t);
  bridgeDose(t);
  recording(t);
  container(t);
  doseSummary(t);
  exportHeader(t);
  guide(t);
  wholeTimes(t);
}

function real(t) { return t.context().PX; }

function tags(t) {
  t.section('bets: one bet on every training exercise (CLAUDE.md rule 15)');
  const PX = real(t), B = PX.engine.bets;
  const train = PX.ex.list('train'), probes = PX.ex.list('probe');
  t.ok(train.length >= 20, 'the 20 training exercises load (' + train.length + ')');
  for (const d of train) {
    t.ok(B.IDS.includes(d.bet), d.id + ' has a bet from the list (' + d.bet + ')');
    if (MAIN[d.id]) t.eq(d.bet, MAIN[d.id], d.id + ': the bet of note T1 §3.2');
    t.eq(B.of(d), d.bet, d.id + ': of(def) reads it');
  }
  for (const d of probes) t.ok(d.bet === null, d.id + ' (a probe) has no bet');
  for (const id of B.IDS) t.ok(B.exercises(id).length >= 1, 'bet ' + id + ' is the main bet of some exercise (' + B.exercises(id).join(', ') + ')');
  t.eq(B.exercises('calibrate').sort(), ['centralpoint', 'homing', 'reckon'], 'calibrate: Reckon, Homing and Central Point');
  t.eq(B.IDS.slice().sort(), PX.ex.BETS.slice().sort(), 'the registry lists the same nine ids');
  const by = B.byExercise();
  t.eq(Object.keys(by).length, train.length, 'byExercise names every training exercise');
  for (const d of train) t.eq(by[d.id + '@' + d.version], d.bet, 'byExercise: ' + d.id + '@' + d.version);
}

function words(t) {
  t.section('bets: the words (CLAUDE.md rule 2: bets stated as bets, no promised outcome)');
  const B = real(t).engine.bets;
  t.ok(Number.isInteger(B.VERSION) && B.VERSION >= 1, 'BETS_VERSION is a positive integer');
  for (const id of B.IDS) {
    const x = B.INFO[id];
    t.ok(x && typeof x.label === 'string' && x.label.length >= 4, id + ': a label');
    t.ok(typeof x.line === 'string' && /\.$/.test(x.line) && x.line.length <= 130, id + ': one line, a sentence of at most 130 characters');
    t.ok(typeof x.mechanism === 'string' && x.mechanism.length > 5, id + ': a mechanism');
    t.ok(typeof x.evidence === 'string' && x.evidence.length > 20, id + ': an evidence line');
    t.ok(Object.prototype.hasOwnProperty.call(B.GRADES, x.grade), id + ': its grade (' + x.grade + ') is defined');
    for (const k of ['label', 'line', 'mechanism', 'evidence']) t.ok(!FORBIDDEN.test(x[k]), id + '.' + k + ' makes no promise and names no IQ or mastery');
  }
  // a line that reaches past the trained task says so as a bet (RV-wave2 finding 9): "we bet" or "may"
  const past = B.IDS.filter((id) => /other tasks|elsewhere|new problems|where it applies|away from the game/i.test(B.INFO[id].line));
  t.ok(past.length >= 5 && past.every((id) => /\bwe bet\b|\bmay\b/i.test(B.INFO[id].line)), 'lines about other tasks are worded as bets (' + past.join(', ') + ')');
  t.ok(B.INFO.calibrate.isNew === true && B.INFO.calibrate.grade === 'D', 'calibrate is the new, untested bet (grade D)');
  t.eq(B.IDS.filter((id) => B.INFO[id].isNew), ['calibrate'], 'exactly one bet is marked new');
}

function formats(t) {
  t.section('bets: response formats (CONTRACT S, T)');
  const PX = real(t), B = PX.engine.bets, F = B.formats(), seen = new Map();
  for (const d of PX.ex.list('train')) {
    const f = F[d.id + '@' + d.version];
    t.ok(!!f, d.id + ' declares a format');
    if (!f) continue;
    for (const v of d.variants || ['*']) {
      const id = f[v] || f['*'];
      t.ok(typeof id === 'string' && id.startsWith(d.id + ':'), d.id + (v === '*' ? '' : ' / ' + v) + ': a format of its own (' + id + ')');
      if (seen.has(id) && seen.get(id) !== d.id) t.ok(false, 'format ' + id + ' is used by two exercises');
      seen.set(id, d.id);
    }
  }
}

/* ---------- the crossover's draw ---------- */

function fx(t, extra) {
  const c = t.context({ exercises: false });
  defineFixtures(c.PX);
  if (extra) extra(c.PX);
  return c.PX;
}

function draw(t) {
  t.section('bets: the draw is the simulated one (measure-cross.mjs assign)');
  const PX = fx(t), B = PX.engine.bets, D = B._.drawUnits;
  let same = 0, n = 0;
  for (let s = 1; s <= 600; s++) {
    for (const layer of ['compare', 'produce', 'calib']) {
      const sim = simAssign(PX, s * 7919, layer, SIM_LAYERS[layer].units), app = D(s * 7919, layer, 0);
      n++;
      if (JSON.stringify(sim) === JSON.stringify(app)) same++;
    }
  }
  t.eq(same, n, 'cycle 0 equals the simulated draw for every layer and seed (' + same + ' of ' + n + ')');
  t.ok(JSON.stringify(D(42, 'compare', 1)) !== JSON.stringify(D(42, 'compare', 0)) || JSON.stringify(D(42, 'compare', 2)) !== JSON.stringify(D(42, 'compare', 0)), 'later cycles draw afresh');
  t.eq(B._.unitOf('views', 'produce'), 4, 'Views is the view-from strand');
  t.eq(B._.unitOf('reckon', 'calib'), 5, 'Reckon is the where-am-I strand');
  t.eq(B._.unitOf('centralpoint', 'calib'), null, 'Central Point has no strand: a coin of its own');
  t.eq(B._.unitOf('views', 'calib'), null, 'a layer without the strand has no unit there');
}

function balance(t) {
  t.section('bets: the assignment is balanced (PLAN milestone 4 acceptance)');
  const PX = fx(t), B = PX.engine.bets, D = B._.drawUnits;
  const N = 20000;
  for (const layer of ['compare', 'bridge', 'produce']) {
    const units = B._.UNITS[layer], on1 = {}, diffs = {};
    units.forEach((u) => { on1[u] = 0; });
    for (let p = 0; p < N; p++) {
      const seed = PX.rng.hash('player', p) >>> 0, first = D(seed, layer, p % 3);
      let a = 0, b = 0;
      units.forEach((u) => { if (first[u] === 1) { on1[u]++; a++; } else b++; });
      const d = a - b;
      diffs[d] = (diffs[d] || 0) + 1;
    }
    const shares = units.map((u) => on1[u] / N);
    t.ok(shares.every((s) => Math.abs(s - 0.5) < 0.015), layer + ': each unit on in the first half for 48.5–51.5 % of ' + N + ' players (' + shares.map((s) => (100 * s).toFixed(1)).join(', ') + ' %)');
    const maxDiff = Math.max(...Object.keys(diffs).map((k) => Math.abs(+k)));
    t.ok(maxDiff <= 1, layer + ': the two halves differ by at most one unit (' + JSON.stringify(diffs) + ')');
  }
  let own = 0;
  for (let p = 0; p < N; p++) own += B._.drawOwn(PX.rng.hash('player', p) >>> 0, 'compare', 'knots', p % 3) === 1 ? 1 : 0;
  t.ok(Math.abs(own / N - 0.5) < 0.015, 'a host without a strand: on first for ' + (100 * own / N).toFixed(1) + ' % of players');
  // within a player, every unit is on in exactly one period of a cycle
  const seed = 12345, first = D(seed, 'compare', 0);
  t.ok(Object.values(first).every((h) => h === 1 || h === 2), 'every unit has its half');
}

/* ---------- sessions on fixture exercises with layers ---------- */

const CONTENT = {
  compare: {
    principles: [
      { id: 'p1', text: 'Principle one.' },
      { id: 'p2', text: 'Principle two.', applies: (p) => p.lv !== 0 },
    ],
  },
  bridge: { b: -3 },
};
function hostsFx(PX) {
  PX.ex.define({ id: 'xpro', code: 'EX-91', name: 'Produce host', role: 'train', abilities: ['Vz'], answer: 'choice', nOptions: 4, version: 1,
    variants: ['main', 'draw'], trainVariants: ['main'], bet: 'produce', format: { main: 'xpro:pick', draw: 'xpro:draw' }, layers: { produce: 'draw' },
    dims: [{ key: 'lv', label: 'Level', levels: [0, 1, 2, 3, 4, 5, 6, 7], step: 0.6 }], base: -2,
    chance: (p) => (p.variant === 'draw' ? 0.01 : 0.25),
    generate: (rng, params) => ({ ex: 'xpro', seed: rng.seed, params, key: 0 }), validate: () => true, score: (it, r) => ({ correct: r === it.key }) });
  PX.ex.define({ id: 'xcal', code: 'EX-92', name: 'Calib host', role: 'train', abilities: ['NAV'], answer: 'choice', nOptions: 4, version: 1,
    bet: 'calibrate', format: 'xcal:point', layers: { calib: true },
    dims: [{ key: 'lv', label: 'Level', levels: [0, 1, 2, 3, 4, 5, 6, 7], step: 0.6 }], base: -2,
    generate: (rng, params) => ({ ex: 'xcal', seed: rng.seed, params, key: 0 }), validate: () => true, score: (it, r) => ({ correct: r === it.key }) });
  PX.ex.define({ id: 'xcmp', code: 'EX-93', name: 'Compare host', role: 'train', abilities: ['Vz'], answer: 'choice', nOptions: 4, version: 1,
    bet: 'compare', format: 'xcmp:pick', layers: { compare: ['p1', 'p2'], bridge: 'set1' },
    dims: [{ key: 'lv', label: 'Level', levels: [0, 1, 2, 3, 4, 5, 6, 7], step: 0.6 }], base: -2,
    generate: (rng, params) => ({ ex: 'xcmp', seed: rng.seed, params, key: 0 }), validate: () => true, score: (it, r) => ({ correct: r === it.key }) });
  PX.engine.bets.register('xcmp', CONTENT);
}
function mkHosts(t) { return fx(t, hostsFx); }

// One session: n items (right on even positions), 5 s apart. → { plan, steps, res, now }
function play(PX, rec, mode, opts, n, answer) {
  const E = PX.engine;
  let now = opts.now;
  const plan = E.modes.start(rec, mode, opts), steps = [];
  for (let i = 0; i < n; i++) {
    const step = E.modes.next(plan, rec, now);
    if (step.done) break;
    now += 5000;
    E.modes.answer(plan, rec, step, answer ? answer(step, i) : { correct: i % 2 === 0, rt: 2000 }, now);
    steps.push(step);
  }
  const res = E.modes.finish(plan, rec, now + 1000);
  return { plan, steps, res, now: now + 1000 };
}

function periods(t) {
  t.section('bets: periods of at least 28 days and 8 sessions, and their assign events');
  const PX = mkHosts(t), E = PX.engine, B = E.bets;
  const rec = newRecord(PX, T0);
  t.eq(B.period(rec, T0).started, false, 'before any session the first period is virtual');
  t.eq(B.period(rec, T0 + 5 * DAY).n, 1, 'and it is period 1');
  let now = T0, firstRes = null;
  for (let s = 0; s < 6; s++) {
    const r = play(PX, rec, 'train', { now, pin: 'xpro', minutes: 3 }, 12);
    if (s === 0) firstRes = r;
    now += DAY;
  }
  t.eq(rec.bets.periods.length, 1, 'six sessions in six days: still period 1');
  t.eq(rec.bets.periods[0], firstRes.plan.start, 'period 1 starts with the first Train session');
  t.eq(firstRes.res.bets && firstRes.res.bets.period, 1, 'finish reports the period that started');
  const assign1 = E.events.list(rec, { kind: 'assign' });
  const hosted = B.LAYERS.reduce((a, l) => a + B.hostsOf(l).length, 0);
  t.ok(hosted >= 4, 'the fixture hosts layers (' + hosted + ' exercise-layer pairs)');
  t.eq(assign1.length, hosted, 'one assign event per hosted layer and exercise at the start of period 1');
  t.ok(assign1.every((e) => e.data.period === 1 && (e.data.arm === 'on' || e.data.arm === 'off') && e.data.until - e.data.from === 28 * DAY && e.data.seed === rec.bets.seed), 'assign events carry period, arm, from, until and the seed');
  // sessions 7 and 8 inside 28 days: the period goes on
  for (let s = 0; s < 2; s++) { play(PX, rec, 'train', { now, pin: 'xpro', minutes: 3 }, 12); now += DAY; }
  t.eq(rec.bets.periods.length, 1, 'eight sessions before day 28: period 1 goes on');
  now = rec.bets.periods[0] + 28 * DAY + 3600000;
  const r9 = play(PX, rec, 'train', { now, pin: 'xpro', minutes: 3 }, 12);
  t.eq(rec.bets.periods.length, 2, 'after day 28 with 8 sessions held, the next session ends period 1');
  t.eq(B.period(rec, r9.now + 1).n, 2, 'period 2 runs');
  const arms1 = {}, arms2 = {};
  E.events.list(rec, { kind: 'assign' }).forEach((e) => { (e.data.period === 1 ? arms1 : arms2)[e.exId + ':' + e.data.layer] = e.data.arm; });
  t.ok(Object.keys(arms1).length === hosted && Object.keys(arms2).length === hosted, 'period 2 logged its own assign events');
  t.ok(Object.keys(arms1).every((k) => arms1[k] !== arms2[k]), 'every arm flips from period 1 to period 2 (a crossover)');
  t.ok(B.arm(rec, 'xpro', 'produce', r9.now + 1) === arms2['xpro:produce'], 'arm() answers with period 2’s arm');
  // a long break does not end a period without its sessions
  const rec2 = newRecord(PX, T0);
  play(PX, rec2, 'train', { now: T0, pin: 'xpro', minutes: 3 }, 12);
  play(PX, rec2, 'train', { now: T0 + 60 * DAY, pin: 'xpro', minutes: 3 }, 12);
  t.eq(rec2.bets.periods.length, 1, 'two sessions 60 days apart: still period 1 (8 sessions needed)');
  // a Free play or a Spatial Check never starts or ends a period
  const rec3 = newRecord(PX, T0);
  play(PX, rec3, 'free', { now: T0, exId: 'xpro', minutes: 3 }, 8);
  t.ok(!rec3.bets.periods || !rec3.bets.periods.length, 'Free play does not start the first period');
  t.eq(B._.sessionsSince(rec, 0), rec.sessions.filter((s) => s.mode === 'train' || s.mode === 'path').length, 'sessionsSince counts Train and Path sessions');
}

function joining(t) {
  t.section('bets: "Join the bet trials" (on by default)');
  const PX = mkHosts(t), E = PX.engine, B = E.bets;
  const rec = newRecord(PX, T0);
  t.ok(B.joined(rec), 'a new record is in the bet trials (the setting is missing or true)');
  const a = B.arm(rec, 'xpro', 'produce', T0);
  t.ok(a === 'on' || a === 'off', 'a host has an arm: ' + a);
  t.eq(B.active(rec, 'xpro', 'produce', T0), a === 'on', 'active() follows the arm');
  t.eq(B.arm(rec, 'rotate', 'produce', T0), null, 'an exercise that does not host the layer has none');
  t.eq(B.active(rec, 'rotate', 'produce', T0), false, 'and the layer never runs there');
  rec.settings.betTrials = false;
  t.eq(B.arm(rec, 'xpro', 'produce', T0), null, 'out of the trials: no arm');
  t.eq(B.active(rec, 'xpro', 'produce', T0), true, 'out of the trials: every hosted layer runs');
  play(PX, rec, 'train', { now: T0, pin: 'xpro', minutes: 3 }, 12);
  t.eq(E.events.list(rec, { kind: 'assign' }).length, 0, 'out of the trials: no assign events');
  t.eq(rec.bets.periods.length, 1, 'the periods still run, so a return lands in the right one');
  rec.settings.betTrials = true;
  B.join(rec, true, T0 + DAY);
  t.eq(E.events.list(rec, { kind: 'join' }).map((e) => e.data.on), [1], 'joining logs a join event');
  const hosted = B.LAYERS.reduce((x, l) => x + B.hostsOf(l).length, 0);
  t.eq(E.events.list(rec, { kind: 'assign' }).length, hosted, 'and the current period’s arms');
  // the same record seed gives the same arms in another tab
  const rec2 = JSON.parse(JSON.stringify(rec));
  t.eq(B.arm(rec2, 'xcmp', 'compare', T0 + DAY), B.arm(rec, 'xcmp', 'compare', T0 + DAY), 'the arms follow from the record, not the tab');
}

function pick(t) {
  t.section('bets: the pick hook (produce share, calibration detail, nothing else moves)');
  const PX = mkHosts(t), E = PX.engine, B = E.bets;
  // a record whose produce arm is on in period 1, and one where it is off
  let on = null, off = null;
  for (let c = 0; c < 200 && (!on || !off); c++) {
    const rec = newRecord(PX, T0 + c * 1000);
    (B.arm(rec, 'xpro', 'produce', T0) === 'on' ? (on = on || rec) : (off = off || rec));
  }
  t.ok(on && off, 'records with each arm exist');
  const sOn = play(PX, on, 'train', { now: T0, pin: 'xpro', minutes: 20 }, 80);
  const pro = sOn.steps.filter((s) => s.exId === 'xpro' && s.params.variant === 'draw');
  const tgt = sOn.steps.filter((s) => s.exId === 'xpro' && s.kind === 'target');
  t.ok(pro.length >= 1, 'arm on: some target items come in the draw variant (' + pro.length + ' of ' + tgt.length + ' targets)');
  t.ok(pro.every((s) => s.layer === 'produce'), 'they carry the produce layer');
  const rows = on.trials.map((r) => E.log.read(on, r)).filter((r) => r.ex === 'xpro');
  t.eq(rows.filter((r) => r.layer === 'produce').length, pro.length, 'their rows log layer produce');
  const sOff = play(PX, off, 'train', { now: T0, pin: 'xpro', minutes: 20 }, 80);
  t.eq(sOff.steps.filter((s) => s.params.variant === 'draw').length, 0, 'arm off: never the draw variant');
  // calibration detail
  let con = null, coff = null;
  for (let c = 0; c < 200 && (!con || !coff); c++) {
    const rec = newRecord(PX, T0 + c * 1000);
    (B.arm(rec, 'xcal', 'calib', T0) === 'on' ? (con = con || rec) : (coff = coff || rec));
  }
  const cOn = play(PX, con, 'train', { now: T0, pin: 'xcal', minutes: 6 }, 20);
  t.ok(cOn.steps.filter((s) => s.exId === 'xcal').every((s) => s.layer === 'calib-detail'), 'calib arm on: every item of the host carries calib-detail');
  t.ok(con.trials.map((r) => E.log.read(con, r)).filter((r) => r.ex === 'xcal').every((r) => r.layer === 'calib-detail'), 'and its rows log it');
  const cOff = play(PX, coff, 'train', { now: T0, pin: 'xcal', minutes: 6 }, 20);
  t.ok(cOff.steps.every((s) => !s.layer), 'calib arm off: no layer');
  // the hook never shifts a plan without hosts: the same items with and without it
  const PX2 = fx(t), r1 = newRecord(PX2, T0), r2 = newRecord(PX2, T0);
  const a = play(PX2, r1, 'train', { now: T0, minutes: 10 }, 40).steps.map((s) => s.exId + s.code + ':' + s.seed);
  const off2 = PX2.engine.modes.hooks('pick').find((h) => h.id === 'bets.pick') ? null : 'missing';
  t.eq(off2, null, 'the pick hook is registered as bets.pick');
  PX2.engine.configure({ bets: { produceShare: 1 } });
  const b = play(PX2, r2, 'train', { now: T0, minutes: 10 }, 40).steps.map((s) => s.exId + s.code + ':' + s.seed);
  t.eq(b, a, 'without hosts, the hook changes no item (even at a produce share of 1)');
  PX2.engine.configure('reset');
  // Path keeps its stage filter: no produce items there
  const rp = newRecord(PX, T0);
  for (let c = 0; c < 50 && B.arm(rp, 'xpro', 'produce', T0) !== 'on'; c++) rp.created = T0 + c * 77, rp.eng = undefined, delete rp.bets;
  const sp = play(PX, rp, 'path', { now: T0, exId: 'xpro' }, 30);
  t.eq(sp.steps.filter((s) => s.params.variant === 'draw').length, 0, 'Path: never the draw variant');
}

/* ---------- dose rules ---------- */

function rated(rec, id, st) { rec.ex[id] = Object.assign({ mu: 0, sd: 0.5, n: 40, nRight: 30, last: T0, seen: {}, best: {}, hist: [] }, st || {}); }

function compareDose(t) {
  t.section('bets: comparison rounds (note T1 §4.1: after the first block, at most two a session, spaced 3, 7, 14 days)');
  const PX = mkHosts(t), E = PX.engine, B = E.bets;
  const rec = newRecord(PX, T0, { betTrials: false }); // out of the trials: every hosted layer runs
  rated(rec, 'xcmp', { n: 4 });
  rec.bets = { v: 1, brg: { xcmp: { n: 1, last: T0 } } }; // a bridge set just now: only rounds below
  let plan = E.modes.start(rec, 'train', { now: T0, pin: 'xcmp' });
  t.eq(B.due(rec, plan, 'xcmp', T0, { newRun: true, params: { lv: 1 } }), null, 'not before the exercise’s first 10 rated answers');
  rated(rec, 'xcmp', { n: 12 });
  t.eq(B.due(rec, plan, 'xcmp', T0, { newRun: false, misses: 0, params: { lv: 1 } }), null, 'only where a run starts (or after two misses)');
  t.eq(B.due(rec, plan, 'xcmp', T0, { newRun: true, params: { lv: 1 } }), { kind: 'compare', principle: 'p1', stage: 1 }, 'the first round: the first principle, stage 1');
  t.eq(B.due(rec, plan, 'xcmp', T0, { newRun: true, params: { lv: 0 } }).principle, 'p1', 'a principle that does not apply to the step’s settings is skipped');
  t.eq(B.due(rec, plan, 'rotate', T0, { newRun: true }), null, 'an exercise that hosts no rounds has none');
  const info = { exId: 'xcmp', principle: 'p1', stage: 1, a: 'xcmp@1', aSeed: 11, b: 'xcmp@1', bSeed: 12, choice: 'p1', correct: true, rt: 4200, apply: 77, opts: ['p1', 's2', 's3', 's4'], pos: 0 };
  const row = B.compared(rec, plan, info, T0 + 1000);
  t.ok(!!row, 'a compare event is written');
  const ev = E.events.list(rec, { kind: 'compare' })[0];
  t.eq(ev.data, { a: 'xcmp@1', aSeed: 11, b: 'xcmp@1', bSeed: 12, principle: 'p1', stage: 1, choice: 'p1', correct: 1, rt: 4200, apply: 77, opts: ['p1', 's2', 's3', 's4'], pos: 0 }, 'with the contract’s fields');
  t.eq(B.due(rec, plan, 'xcmp', T0 + 2000, { newRun: true, params: { lv: 1 } }), null, 'one round per exercise per session');
  const use = B._.planUse(plan);
  t.eq([use.rounds, use.ex.xcmp], [1, 1], 'the session counts it');
  // the apply item settles the principle through the answer hook
  const st = rec.bets.cmp.xcmp.p.p1;
  t.ok(st.pend && st.pend.choice === 1, 'the principle waits for its apply item');
  const step = E.modes.next(plan, rec, T0 + 3000);
  step.layer = 'compare-apply'; step.betPrinciple = 'p1';
  E.modes.answer(plan, rec, step, { correct: true, rt: 3000 }, T0 + 6000);
  t.ok(!st.pend && st.ok === 1 && st.next === T0 + 6000 + 3 * DAY, 'a right pick and a right apply item: next round in 3 days');
  t.eq(E.log.read(rec, rec.trials[rec.trials.length - 1]).layer, 'compare-apply', 'the apply item’s row logs its layer');
  E.modes.finish(plan, rec, T0 + 10000);
  // the cap of two a session
  const plan2 = E.modes.start(rec, 'train', { now: T0 + DAY, pin: 'xcmp' });
  B._.planUse(plan2).rounds = 2;
  t.eq(B.due(rec, plan2, 'xcmp', T0 + 4 * DAY, { newRun: true, params: { lv: 1 } }), null, 'at most two rounds a session');
  // spacing: p2 (never taken) comes before p1 (due); p1 alone where p2 does not apply
  const plan3 = E.modes.start(rec, 'train', { now: T0 + 4 * DAY, pin: 'xcmp' });
  t.eq(B.due(rec, plan3, 'xcmp', T0 + 4 * DAY, { newRun: true, params: { lv: 1 } }).principle, 'p2', 'a principle never taken comes first');
  t.eq(B.due(rec, plan3, 'xcmp', T0 + 4 * DAY, { newRun: true, params: { lv: 0 } }), { kind: 'compare', principle: 'p1', stage: 1 }, 'p1 is due after its 3 days');
  t.eq(B.due(rec, plan3, 'xcmp', T0 + 2 * DAY, { newRun: true, params: { lv: 0 } }), null, 'and not before');
  t.eq(B.due(rec, plan3, 'xcmp', T0 + 2 * DAY, { newRun: false, misses: 2, params: { lv: 0 } }).principle, 'p1', 'two misses bring a round early (a day after the last)');
  t.eq(B.due(rec, plan3, 'xcmp', T0 + 3000, { newRun: false, misses: 2, params: { lv: 0 } }), null, 'but not within a day of the last');
  // a second right round retires it until the recheck at 30 days; a wrong one starts again at 3 days
  B.compared(rec, plan3, Object.assign({}, info, { apply: 0 }), T0 + 5 * DAY);
  t.ok(st.ok === 2 && st.retired === 1 && st.next === T0 + 5 * DAY + 30 * DAY, 'two right rounds in a row retire the principle (recheck after 30 days)');
  const plan4 = E.modes.start(rec, 'train', { now: T0 + 36 * DAY, pin: 'xcmp' });
  B.compared(rec, plan4, Object.assign({}, info, { apply: 0, correct: false }), T0 + 36 * DAY);
  t.ok(st.ok === 0 && !st.retired && st.next === T0 + 39 * DAY, 'a wrong recheck: back to 3 days');
  t.eq(B.due(rec, plan4, 'xcmp', T0 + 36 * DAY, { newRun: true, params: { lv: 1 } }), null, 'one round per exercise per session, whatever is due');
  const p5 = E.modes.start(rec, 'train', { now: T0 + 40 * DAY, pin: 'xcmp' });
  t.eq(B.due(rec, p5, 'xcmp', T0 + 40 * DAY, { newRun: true, params: { lv: 0 } }).stage, 2, 'from its third round a principle is at stage 2');
  // arm off: no rounds
  const r2 = newRecord(PX, T0);
  rated(r2, 'xcmp', { n: 12 });
  let offRec = null;
  for (let c = 0; c < 200 && !offRec; c++) { r2.created = T0 + c * 31; r2.eng = undefined; if (B.arm(r2, 'xcmp', 'compare', T0) === 'off') offRec = r2; }
  r2.bets = { v: 1, brg: { xcmp: { n: 1, last: T0 } } };
  t.eq(B.due(offRec, E.modes.start(offRec, 'train', { now: T0, pin: 'xcmp' }), 'xcmp', T0, { newRun: true, params: { lv: 1 } }), null, 'arm off: no round');
}

function bridgeDose(t) {
  t.section('bets: bridge sets (note T1 §4.2: once the rating settles, about every two weeks, one a session)');
  const PX = mkHosts(t), E = PX.engine, B = E.bets;
  const rec = newRecord(PX, T0, { betTrials: false });
  rated(rec, 'xcmp', { mu: 0, sd: 0.9, n: 30 });
  const plan = E.modes.start(rec, 'train', { now: T0, pin: 'xcmp' });
  t.eq(B.due(rec, plan, 'xcmp', T0, { newRun: true, params: { lv: 1 } }).kind, 'compare', 'an unsettled rating (sd 0.9): no bridge set yet');
  rated(rec, 'xcmp', { mu: -3.5, sd: 0.5, n: 30 });
  t.eq(B.due(rec, plan, 'xcmp', T0, { newRun: true, params: { lv: 1 } }).kind, 'compare', 'a settled rating below the bridge items’ difficulty: none');
  rated(rec, 'xcmp', { mu: 0, sd: 0.5, n: 30 });
  t.eq(B.due(rec, plan, 'xcmp', T0, { newRun: true, params: { lv: 1 } }), { kind: 'bridge', set: 'set1' }, 'settled at or above it: a bridge set, before a round');
  t.eq(B.due(rec, plan, 'xcmp', T0, { newRun: false, misses: 3, params: { lv: 1 } }).kind, 'compare', 'a set only where a run starts');
  B.bridged(rec, plan, { exId: 'xcmp', set: 'set1', map: 'plane', mapOk: true, items: [[5, 0, 1, 4100], [6, 0, 0, 5200]], use: 'medicine', other: false, rt: 61000 }, T0 + 60000);
  t.eq(E.events.list(rec, { kind: 'bridge' })[0].data, { set: 'set1', map: 'plane', mapOk: 1, items: [[5, 0, 1, 4100], [6, 0, 0, 5200]], use: 'medicine', other: 0, rt: 61000 }, 'the bridge event holds the items’ outcomes (never rec.trials)');
  t.eq(rec.trials.length, 0, 'bridge items write no trial rows');
  t.eq(B.due(rec, plan, 'xcmp', T0 + 70000, { newRun: true, params: { lv: 1 } }), null, 'one add-on per exercise per session');
  const p2 = E.modes.start(rec, 'train', { now: T0 + 10 * DAY, pin: 'xcmp' });
  t.eq(B.due(rec, p2, 'xcmp', T0 + 10 * DAY, { newRun: true, params: { lv: 1 } }).kind, 'compare', 'ten days later: no set yet');
  rated(rec, 'xcmp', { mu: 0, sd: 0.5, n: 40, last: T0 + 15 * DAY }); // practised since: still settled
  const p3 = E.modes.start(rec, 'train', { now: T0 + 15 * DAY, pin: 'xcmp' });
  t.eq(B.due(rec, p3, 'xcmp', T0 + 15 * DAY, { newRun: true, params: { lv: 1 } }).kind, 'bridge', 'two weeks later: the next set');
  t.eq(B.due(rec, { mode: 'speed' }, 'xcmp', T0 + 15 * DAY, { newRun: true }), null, 'never in Speed (only Train and Path)');
}

/* ---------- recording, the container, dose, exports ---------- */

function recording(t) {
  t.section('bets: off-screen challenges, expectation ratings, the detail note’s data');
  const PX = mkHosts(t), E = PX.engine, B = E.bets;
  const rec = newRecord(PX, T0);
  B.offscreen(rec, 'slice', 'slice-cut', false, T0);
  B.offscreen(rec, 'slice', 'slice-cut', true, T0 + DAY);
  t.eq(E.events.list(rec, { kind: 'offscreen' }).map((e) => [e.exId, e.data.challenge, e.data.did]), [['slice', 'slice-cut', 0], ['slice', 'slice-cut', 1]], 'viewed, then "I did it"');
  t.eq(rec.bets.off.slice, { seen: T0, last: T0 + DAY, did: 1 }, 'the record keeps when and how often');
  t.eq(B.expectDue(rec, ['variety', 'produce'], T0), { bet: 'variety', when: 'baseline' }, 'the first rating asked: a baseline');
  t.ok(!!B.expect(rec, 'variety', 4, 'baseline', T0), 'a rating is recorded');
  t.eq(B.expect(rec, 'variety', 9, 'baseline', T0), null, 'a rating outside 1–5 is refused');
  t.eq(B.expect(rec, 'nope', 3, 'baseline', T0), null, 'an unknown bet is refused');
  t.eq(B.expectDue(rec, ['variety', 'produce'], T0 + DAY), { bet: 'produce', when: 'baseline' }, 'then the next bet’s baseline');
  B.expect(rec, 'produce', 2, 'baseline', T0 + DAY);
  t.eq(B.expectDue(rec, ['variety', 'produce'], T0 + 20 * DAY), null, 'nothing more before week 4');
  t.eq(B.expectDue(rec, ['variety', 'produce'], T0 + 29 * DAY), { bet: 'variety', when: 'w4' }, 'at week 4: the second rating');
  t.eq(E.events.list(rec, { kind: 'expect' }).map((e) => [e.data.bet, e.data.rating, e.data.when]), [['variety', 4, 'baseline'], ['produce', 2, 'baseline']], 'expect events');
  for (let i = 0; i < 25; i++) B.calibPush(rec, 'homing', i % 2 ? 10 : -4, T0 + i * 60000);
  t.eq(rec.bets.cal.homing.length, 20, 'the detail note keeps the last 20 answers');
  const s = B.calibSummary(rec, 'homing', 10);
  t.ok(s.n === 10 && Math.abs(s.mean - 3) < 1e-9 && Math.abs(s.abs - 7) < 1e-9, 'its summary: mean (bias) and mean size of the last 10');
  t.eq(B.calibSummary(rec, 'reckon').n, 0, 'none for an exercise without answers');
  B.calibPush(rec, 'homing', NaN, T0);
  t.eq(rec.bets.cal.homing.length, 20, 'a missing value is skipped');
}

function container(t) {
  t.section('bets: the container’s repair and the two-tab merge (CONTRACT M)');
  const PX = mkHosts(t), B = PX.engine.bets, C = B._.check, M = B._.merge;
  t.eq(C({ v: 1 }), { v: 1 }, 'a default container stays as it is');
  const good = { v: 1, seed: 99, periods: [T0, T0 + 30 * DAY], cmp: { xcmp: { n: 2, last: T0, p: { p1: { n: 2, ok: 1, k: 1, last: T0, next: T0 + 3 * DAY } } } },
    brg: { xcmp: { n: 1, last: T0 } }, off: { slice: { did: 1, seen: T0, last: T0 } }, cal: { homing: [[1, 2], [3, -4]] }, exp: { variety: { baseline: 4, at: T0 } }, kept: { x: 1 } };
  t.eq(C(good), good, 'a good container passes unchanged (unknown keys kept)');
  t.eq(C(C(good)), good, 'the repair is idempotent');
  const bad = C({ v: 7, seed: -3, periods: [T0 + 5, 'x', T0, T0], cmp: { 'Bad Id': {}, xcmp: { n: -2, p: { p1: 'x', 'a b': {} } } }, cal: { homing: [[1, 2], [3], 'x'] }, exp: { nope: { baseline: 3 }, load: { baseline: 9, w4: 2 } } });
  t.eq(bad, { v: 1, periods: [T0, T0 + 5], cmp: { xcmp: { n: 0, p: {} } }, cal: { homing: [[1, 2]] }, exp: { load: { w4: 2 } } }, 'broken parts are repaired or dropped');
  const a = { v: 1, seed: 5, periods: [T0, T0 + 30 * DAY], cmp: { xcmp: { n: 3, last: T0 + 9, p: {} } }, cal: { homing: [[1, 1], [2, 2]] }, exp: { load: { baseline: 2 } } };
  const b = { v: 1, seed: 5, periods: [T0 + 100], cmp: { xcmp: { n: 1, last: T0, p: {} }, xpro: { n: 1, last: T0, p: {} } }, cal: { homing: [[2, 2], [3, 3]] }, exp: { load: { w4: 5 } } };
  const m = M(a, b);
  t.eq(m.periods, [T0, T0 + 30 * DAY], 'the longer period list wins');
  t.eq(m.cmp.xcmp.n, 3, 'per exercise: the entry with the later round');
  t.ok(!!m.cmp.xpro, 'entries of one side only are kept');
  t.eq(m.cal.homing, [[1, 1], [2, 2], [3, 3]], 'the detail note’s answers: a union in time order');
  t.eq(m.exp.load, { baseline: 2, w4: 5 }, 'ratings from both sides');
  t.ok(!('brg' in m) && !('off' in m), 'parts neither side has stay absent');
  t.eq(M({ v: 1 }, { v: 1 }), { v: 1 }, 'two default containers merge to the default');
  t.ok(PX.engine.merge.registered().includes('bets'), 'the merge is registered (E.merge.register)');
}

function doseSummary(t) {
  t.section('bets: dose summaries (per exercise and week, per bet and layer; no local days)');
  const PX = mkHosts(t), E = PX.engine, B = E.bets;
  const rec = newRecord(PX, T0, { betTrials: false });
  play(PX, rec, 'train', { now: T0, minutes: 6, pin: 'xcmp' }, 24);
  play(PX, rec, 'train', { now: T0 + 8 * DAY, minutes: 6, pin: 'xcmp' }, 24);
  const plan = E.modes.start(rec, 'train', { now: T0 + 9 * DAY, pin: 'xcmp' });
  B.compared(rec, plan, { exId: 'xcmp', principle: 'p1', stage: 1, a: 'xcmp@1', aSeed: 1, b: 'xcmp@1', bSeed: 2, choice: 'p1', correct: true, rt: 3000, apply: 0, opts: ['p1'], pos: 0 }, T0 + 9 * DAY);
  B.offscreen(rec, 'fold', 'fold-sheet', true, T0 + 9 * DAY);
  const d = B.dose(rec);
  t.eq(d.version, B.VERSION, 'carries BETS_VERSION');
  t.eq(d.weeks.map((w) => w.week), [0, 1], 'weeks count from the first trial: weeks 0 and 1');
  const total = d.weeks.reduce((a, w) => a + Object.values(w.ex).reduce((x, e) => x + e.trials, 0), 0);
  t.eq(total, rec.trials.filter((r) => r[5] === 0 || r[5] === 1).length, 'every answered practice trial is counted once');
  t.ok(d.weeks.every((w) => Object.values(w.ex).every((e) => e.minutes >= 0 && e.sessions >= 0 && e.rated <= e.trials)), 'trials, rated trials, minutes and sessions per exercise');
  t.eq(d.layers.compare.rounds, 1, 'rounds per layer');
  t.eq(d.layers.offscreen.did, 1, 'off-screen challenges done');
  t.ok(Object.keys(d.bets).length >= 1 && Object.keys(d.bets).every((k) => B.IDS.includes(k)), 'minutes per bet');
  t.ok(!/\d{4}-\d{2}-\d{2}/.test(JSON.stringify(d)), 'no calendar day anywhere');
}

function exportHeader(t) {
  t.section('bets: the pooled export carries BETS_VERSION, bets and formats per exercise, layers and events (CONTRACT T)');
  const c = t.env({}), PX = c.PX, S = PX.core.store, E = PX.engine;
  for (const f of E.fields()) { try { S.field(f.key, f.def, f.fix); } catch (e) { /* registered */ } }
  S.load();
  const rec = S.state;
  E.events.add(rec, 'assign', 'views', { layer: 'produce', arm: 'on', period: 1, from: T0, until: T0 + 28 * DAY, seed: 3, unit: 'view-from' }, T0);
  E.bets.offscreen(rec, 'slice', 'slice-cut', true, T0);
  S.save();
  const out = S.pooled();
  t.ok(out.betsInfo && out.betsInfo.version === E.bets.VERSION, 'header betsInfo.version = BETS_VERSION (the key bets is the record field)');
  const train = PX.ex.list('train');
  t.eq(Object.keys(out.betsInfo.byExercise).length, train.length, 'bets.byExercise names every training exercise');
  t.ok(train.every((d) => out.betsInfo.byExercise[d.id + '@' + d.version] === d.bet), 'with its bet, keyed id@version');
  t.eq(out.betsInfo.joined, true, 'bets.joined: the player’s choice');
  t.ok(out.betsInfo.strands && out.betsInfo.strands.views === 'view-from' && out.betsInfo.period.days === 28 && out.betsInfo.period.sessions === 8, 'the units and the period rule');
  t.ok(out.betsInfo.dose && out.betsInfo.dose.version === E.bets.VERSION, 'the dose summary');
  t.ok(train.every((d) => out.formats[d.id + '@' + d.version]), 'formats: every training exercise');
  t.ok(Array.isArray(out.trialColumns) && out.trialColumns.includes('layer'), 'the trial rows carry their layer column');
  t.ok(out.events && out.events.rows.some((r) => r[1] === 'assign') && out.events.rows.some((r) => r[1] === 'offscreen'), 'the events: assignments and challenges');
  t.ok(out.bets && out.bets.off && out.bets.off.slice && out.bets.off.slice.did === 1, 'the bets container is exported as it is');
  t.ok(!/\d{4}-\d{2}-\d{2}/.test(JSON.stringify([out.betsInfo, out.bets, out.formats, out.events])), 'no calendar day in the bets parts');
}

function guide(t) {
  t.section('bets: the guide states each bet in the same words as the code');
  const B = real(t).engine.bets;
  const html = fs.readFileSync(path.join(t.root, 'docs/guide/guide.html'), 'utf8');
  const at = html.indexOf('<!-- v1.2 wave 2 (W2-bets): the bets -->'), end = html.indexOf('<!-- /W2-bets -->');
  t.ok(at > 0 && end > at, 'the guide has the marked section on the bets');
  const sec = html.slice(at, end).replace(/&rsquo;/g, '’').replace(/&amp;/g, '&');
  t.ok(/Test the bets with us/.test(sec), 'titled "Test the bets with us"');
  for (const id of B.IDS) {
    t.ok(sec.includes(B.INFO[id].line), 'the guide quotes the ' + id + ' line');
    t.ok(sec.includes(B.INFO[id].label), 'and names it ' + B.INFO[id].label);
  }
  // the add-ons of this build, in the words js/ui/bets.js's addonsLine() uses
  const PX = real(t).PX || null; void PX;
  const R = t.context().PX, BB = R.engine.bets;
  const WORDS = { compare: 'comparison rounds', bridge: 'bridge sets', produce: 'draw-the-answer items', calib: 'detailed feedback on your estimates' };
  const and = (l) => (l.length < 2 ? l.join('') : l.slice(0, -1).join(', ') + ' and ' + l[l.length - 1]);
  const parts = BB.LAYERS.map((l) => { const ids = BB.hostsOf(l); return ids.length ? WORDS[l] + ' for ' + and(ids.map((id) => R.ex.get(id).short)) : null; }).filter(Boolean);
  const line = 'In this version: ' + parts.join('; ') + '.';
  t.ok(sec.includes(line), 'the guide lists the add-ons of this build as the app does (' + line + ')');
  const off = R.ex.list('train').filter((d) => (BB.content(d.id) && BB.content(d.id).offscreen) || (R.ex.learn(d.id) && R.ex.learn(d.id).offscreen)).map((d) => d.short);
  t.ok(off.every((n) => sec.includes(n)) && off.length === 7, 'and the seven exercises with an off-screen challenge (' + off.join(', ') + ')');
}

function wholeTimes(t) {
  t.section('bets: stored times are whole milliseconds (the store’s repair rounds them; W2-measure’s FYI)');
  const PX = mkHosts(t), B = PX.engine.bets, rec = newRecord(PX, T0);
  const plan = { mode: 'train', start: T0 + 0.6426, id: 'x', pos: 0 };
  B._.advance(rec, plan, T0 + 5000.37);
  B.offscreen(rec, 'slice', 'slice-cut', true, T0 + 0.5);
  B.expect(rec, 'variety', 3, 'baseline', T0 + 0.25);
  B.compared(rec, null, { exId: 'xcmp', principle: 'p1', stage: 1, a: 'xcmp@1', aSeed: 1, b: 'xcmp@1', bSeed: 2, choice: 'p1', correct: true, rt: 1, apply: 0, opts: ['p1'], pos: 0 }, T0 + 0.7);
  const s = JSON.stringify(rec.bets);
  t.ok(!/\d\.\d/.test(s.replace(/"v":1/g, '')), 'no fractional time in rec.bets (' + s.slice(0, 80) + '…)');
  t.eq(B._.check(rec.bets), rec.bets, 'the repair leaves it unchanged');
}
