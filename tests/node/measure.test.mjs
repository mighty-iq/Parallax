/* Measurement, Design A (PLAN milestone 6; js/engine/assess.js; docs/dev/v1.2/measure-sim.md; CONTRACT-v1.2 M, O):
   the mixes (a block: the near probe × 6, two of three mid probes × 2 rotating, one of two far probes × 2
   alternating, the control × 2; a full check: every probe), the schedule nextMeasure (B1 after the first tutorial or
   late at a session start, B2 after 12 hours, blocks 8 hours apart and at most four in 7 days, the 4-weekly check,
   the opt-in measurement week, the run-in after a break, the delayed check), the entries (items and probe versions
   kept for life, `late`, the standard-prior posterior), the trend input (versions as their own probes; 1.1 entries as
   summaries; h from training minutes), the meter and the verdicts stored once per milestone, the measure container's
   repair and merge, the events and the session kinds. */
import { MANIFEST } from './run.mjs';
import { defineFixtures, TRAIN, PROBES } from './fixtures/exercises.mjs';
import { Learner, newRecord, playSession } from './fixtures/learner.mjs';

const DAY = 86400000, HOUR = 3600000;
const T0 = Date.UTC(2026, 10, 2, 18, 0, 0);
const NEW_PROBES = [
  { id: 'otherway', code: 'PR-6', name: 'Other Way Round', abilities: ['Vz'], cell: 'intrinsic-dynamic', role: 'probe', answer: 'choice', nOptions: 4,
    dims: [{ key: 'steps', levels: [1, 2, 3], step: 0.8 }, { key: 'strand', levels: [0, 1, 2, 3, 4, 5], step: 0.1 }], base: -2.0 },
  { id: 'motiongraphs', code: 'PR-7', name: 'Motion Graphs', abilities: ['MA'], cell: 'extrinsic-dynamic', role: 'probe', answer: 'choice', nOptions: 4,
    dims: [{ key: 'segments', levels: [2, 3, 4], step: 0.7 }, { key: 'graph', levels: [0, 1], step: 0.6 }], base: -2.1 },
  { id: 'balance', code: 'PR-8', name: 'Balance', abilities: ['Vz'], cell: 'extrinsic-static', role: 'probe', answer: 'choice', nOptions: 4,
    variants: ['centroid', 'median'], cycle: 'variant', dims: [{ key: 'level', levels: [0, 1, 2], step: 0.35 }], base: -0.3 },
];
function stub(id) {
  return {
    generate(rng, params) { return { ex: id, seed: rng.seed, params, key: 0 }; },
    validate() { return true; },
    score(item, response) { return { correct: response === item.key }; },
  };
}

export async function run(t0) {
  // o.versions: { <probe id>: version } (o.past: { <probe id>: { <version>: { min, max } } }); o.ladder false: no new probes
  const mk = (o = {}) => {
    const c = o.store ? t0.env({ files: [...MANIFEST], exercises: false, now: T0 }) : t0.context({ exercises: false });
    const v = o.versions || {}, past = o.past || {};
    defineFixtures(c.PX, { only: [...TRAIN, ...PROBES].map((d) => d.id).filter((id) => !v[id]) });
    for (const d of PROBES) if (v[d.id]) c.PX.ex.define({ ...d, ...stub(d.id), version: v[d.id], ...(past[d.id] ? { past: past[d.id] } : {}) });
    if (o.ladder !== false) for (const d of NEW_PROBES) c.PX.ex.define({ ...d, ...stub(d.id), version: v[d.id] || 1 });
    return c.PX;
  };
  const t = Object.assign({}, t0, { mk });
  mixes(t);
  schedule(t);
  sessions(t);
  trendInput(t);
  meterAndVerdicts(t);
  container(t);
  curves(t);
  balance(t);
}

/* ---------- helpers ---------- */

function train(rec, at, minutes = 10, mode = 'train') {
  rec.sessions.push({ id: 's' + at, start: at, end: at + minutes * 60000, mode, trials: 60, right: 45, practiceMs: minutes * 60000, exs: ['fold'], summary: null });
}
function measure(PX, rec, L, kind, now, day = 0) {
  return playSession(PX, rec, L, 'check', { now, kind }, day);
}
const kindsOf = (rec) => rec.assess.map((a) => a.kind);

/* ---------- the mixes ---------- */

function mixes(t) {
  t.section('measure: the mixes');
  const PX = t.mk(), E = PX.engine, A = E.assess, MX = E.config.measure;
  t.eq([MX.block.near, MX.block.mid, MX.block.far, MX.block.control], [[1, 6], [2, 2], [1, 2], 2], 'a block: near 1 × 6, mid 2 × 2, far 1 × 2, control 2 (DECISIONS 18 Nov, N14)');
  t.eq([MX.blocksPerWeek, MX.gapHours, MX.b2Hours, MX.everyDays], [4, 8, 12, 28], 'at most 4 blocks in 7 days, 8 hours apart; B2 after 12 hours; the check every 28 days');
  const rec = newRecord(PX, T0), blocks = [];
  for (let i = 0; i < 6; i++) {
    blocks.push(A.mix('block', rec).map((m) => m.id + '×' + m.items));
    rec.assess.push({ date: new Date(T0 + i * DAY).toISOString(), form: null, kind: 'block', results: {}, items: {}, pv: {} });
  }
  t.eq(blocks[0], ['otherway×6', 'cubematch×2', 'viewmatch×2', 'mechanisms×2', 'wordlinks×2'], 'block 1: the near probe, two mid, one far, the control');
  t.ok(blocks.every((b) => b.length === 5 && b[0] === 'otherway×6' && b[4] === 'wordlinks×2'), 'every block holds the near probe × 6 and the control × 2');
  t.eq(blocks.map((b) => b.reduce((s, x) => s + Number(x.split('×')[1]), 0)), [14, 14, 14, 14, 14, 14], '14 items each');
  const mids = blocks.slice(0, 3).flatMap((b) => b.slice(1, 3).map((x) => x.split('×')[0])).sort();
  t.eq(mids, ['cubematch', 'cubematch', 'patterns', 'patterns', 'viewmatch', 'viewmatch'], 'three blocks give each mid probe twice');
  t.eq(blocks.map((b) => b[3].split('×')[0]), ['mechanisms', 'motiongraphs', 'mechanisms', 'motiongraphs', 'mechanisms', 'motiongraphs'], 'the far probes alternate');
  const week = A.mix('week', newRecord(PX, T0)).map((m) => m.id + '×' + m.items);
  t.eq(week, ['otherway×6', 'cubematch×6', 'viewmatch×6', 'mechanisms×6', 'wordlinks×4'], 'a measurement-week block: 6 items per probe, the control 4');
  const full = A.mix('B1', rec).map((m) => m.id + '×' + m.items);
  t.eq(full, ['otherway×16', 'cubematch×5', 'viewmatch×5', 'mechanisms×5', 'patterns×5', 'motiongraphs×5', 'wordlinks×5'], 'a full check: the near probe × 16, every other probe × 5 (1.1’s four in their order), the control × 5: 46 items');
  t.eq(A.mix('regular', rec, { optional: true }).slice(-1)[0].id + '×' + A.mix('regular', rec, { optional: true }).slice(-1)[0].items, 'level×8', 'Level only when asked for, last, 8 items');
  const can = (def) => def.id !== 'patterns';
  t.ok(A.mix('block', rec, {}, can).every((m) => m.id !== 'patterns') && A.mix('B1', rec, {}, can).length === 6, 'a probe the device cannot run is left out');

  const P0 = t.mk({ ladder: false }), r0 = newRecord(P0, T0);
  t.eq(P0.engine.assess.mix('B1', r0).map((m) => m.id + '×' + m.items), ['cubematch×5', 'viewmatch×5', 'mechanisms×5', 'patterns×5', 'wordlinks×5'], 'without the new probes a full check holds 1.1’s probes, 25 items');
  t.eq(P0.engine.assess.mix('block', r0).map((m) => m.id + '×' + m.items), ['cubematch×2', 'viewmatch×2', 'mechanisms×2', 'wordlinks×2'], 'and a block keeps the places it can fill');
}

/* ---------- the schedule ---------- */

function schedule(t) {
  t.section('measure: what comes next (nextMeasure)');
  const PX = t.mk(), E = PX.engine, A = E.assess, L = new Learner(PX, 5);
  let rec = newRecord(PX, T0);
  let n = A.nextMeasure(rec, T0);
  t.eq([n.kind, n.when, n.due, n.late, n.items, n.minutes], ['B1', 'after-tutorial', true, false, 46, 11.5], 'a newcomer: B1 right after the first tutorial (46 items, 11.5 minutes at 15 s an item)');
  t.ok(typeof n.why === 'string' && /starting point/.test(n.why) && !/IQ|percentile|index|norm/i.test(n.why), 'with its why-now line');
  A.later(rec, 'B1', T0 + 60000);
  n = A.nextMeasure(rec, T0 + 2 * HOUR);
  t.eq([n.kind, n.when, n.due], ['B1', 'session-start', true], '"Later" moves B1 to the next session start');
  const ev = E.events.list(rec, { kind: 'measure' });
  t.eq(ev.map((e) => e.data), [{ what: 'baseline-later', kind: 'B1' }], 'and logs the choice as a measure event');
  train(rec, T0 + HOUR);
  n = A.nextMeasure(rec, T0 + 2 * HOUR);
  t.eq([n.kind, n.when, n.late], ['B1', 'session-start', true], 'after rated training B1 is late');
  measure(PX, rec, L, n.kind, T0 + 2 * HOUR);
  t.ok(rec.assess[0].late === true && rec.assess[0].kind === 'B1' && !('later' in rec.measure), 'its entry is marked late; the put-off mark is cleared');

  rec = newRecord(PX, T0);
  measure(PX, rec, L, 'B1', T0);
  t.ok(!rec.assess[0].late, 'B1 before rated training is not late');
  n = A.nextMeasure(rec, T0 + 11 * HOUR);
  t.eq([n.kind, n.when, n.due, n.at], ['B2', 'session-start', false, Date.parse(rec.assess[0].date) + 12 * HOUR], 'B2 waits 12 hours');
  t.ok(A.nextMeasure(rec, T0 + 13 * HOUR).due, 'then opens the next session');
  measure(PX, rec, L, 'B2', T0 + 13 * HOUR);
  const tB2 = Date.parse(rec.assess[1].date);
  n = A.nextMeasure(rec, tB2 + 7 * HOUR);
  t.eq([n.kind, n.when, n.due, n.items, n.minutes], ['block', 'session-start', false, 14, 3.5], 'then blocks: 14 items, 3.5 minutes, not within 8 hours of the last occasion');
  t.ok(A.nextMeasure(rec, tB2 + 8 * HOUR).due, 'due from 8 hours after it');
  let now = tB2 + 9 * HOUR;
  for (let i = 0; i < 4; i++) { train(rec, now - HOUR); measure(PX, rec, L, 'block', now, 1 + i); now += 9 * HOUR; }
  n = A.nextMeasure(rec, now);
  const firstBlock = Date.parse(rec.assess[2].date);
  t.eq([n.kind, n.due, n.at], ['block', false, firstBlock + 7 * DAY], 'four blocks in 7 days: the next waits until the first is 7 days old');
  t.ok(A.nextMeasure(rec, firstBlock + 7 * DAY + 1).due, 'and then comes');
  t.eq(A.checks(rec).map((a) => a.kind), ['B1', 'B2'], 'checks() holds the full checks only');
  t.eq(kindsOf(rec), ['B1', 'B2', 'block', 'block', 'block', 'block'], 'occasions() every entry');
  t.eq(A.occasions(rec).length, 6, 'occasions() counts them all');

  // the 4-weekly check, then blocks again
  const first = Date.parse(rec.assess[0].date);
  n = A.nextMeasure(rec, first + 28 * DAY + HOUR);
  t.eq([n.kind, n.when, n.due], ['regular', 'session-start', true], 'day 28: the 4-weekly check opens the session');
  measure(PX, rec, L, 'regular', first + 28 * DAY + HOUR, 28);
  t.eq(A.nextMeasure(rec, first + 28 * DAY + 10 * HOUR).kind, 'block', 'after it, blocks again');
  t.eq(A.nextMeasure(rec, first + 55 * DAY).kind, 'block', 'until the next mark');
  // the measurement week replaces it when switched on
  rec.settings.measureWeek = true;
  n = A.nextMeasure(rec, first + 53 * DAY);
  t.eq([n.kind, n.when, n.due], ['week', 'check', true], 'measurement week on: from 4 days before the mark, a week block a day');
  measure(PX, rec, L, 'week', first + 53 * DAY, 53);
  t.eq(A.nextMeasure(rec, first + 53 * DAY + 12 * HOUR).kind, 'block', 'one a day (blocks in between as usual)');
  t.eq(A.nextMeasure(rec, first + 56 * DAY + HOUR).kind !== 'regular', true, 'and no 4-weekly check');
  t.eq(rec.assess[rec.assess.length - 1].results.otherway.n, 6, 'a week block: 6 items a probe');

  // a long break: the run-in restarts with two full checks
  rec.settings.measureWeek = false;
  const last = Date.parse(rec.assess[rec.assess.length - 1].date);
  n = A.nextMeasure(rec, last + 60 * DAY);
  t.eq([n.kind, n.when, n.due], ['regular', 'session-start', true], 'after more than 56 days away: a full check');
  measure(PX, rec, L, 'regular', last + 60 * DAY, 100);
  n = A.nextMeasure(rec, last + 60 * DAY + 9 * HOUR);
  t.eq([n.kind, n.due], ['regular', true], 'and a second one');
  measure(PX, rec, L, 'regular', last + 60 * DAY + 9 * HOUR, 100);
  t.eq(A.nextMeasure(rec, last + 61 * DAY).kind, 'block', 'then blocks');

  // training stopped after the baselines: the delayed check
  const rd = newRecord(PX, T0);
  measure(PX, rd, L, 'B1', T0);
  measure(PX, rd, L, 'B2', T0 + DAY);
  for (let i = 0; i < 6; i++) train(rd, T0 + (2 + i) * DAY);
  n = A.nextMeasure(rd, T0 + 40 * DAY);
  t.eq([n.kind, n.when, n.due], ['delayed', 'session-start', true], 'training stopped four weeks ago: a delayed check');
  t.eq(A.due(rd, T0 + 40 * DAY).kind, 'delayed', 'due() gives the same full check');
  const nc = A.nextCheck(rec, Date.parse(rec.assess[rec.assess.length - 1].date) + 2 * DAY);
  t.ok(!nc.ready && nc.kind === 'regular' && nc.sessionsLeft === 0 && nc.when === 'session-start', 'between blocks the next check is the 4-weekly one (days, never sessions)');
  t.ok(['B1', 'B2', 'B3'].every((k) => A.nextMeasure(newRecord(PX, T0), T0).kind !== 'B3'), 'no B3');

  // the Lab crossover: a full check opens it and closes each phase
  const rl = newRecord(PX, T0);
  measure(PX, rl, L, 'B1', T0);
  measure(PX, rl, L, 'B2', T0 + DAY);
  E.lab.enroll(rl, T0 + 20 * DAY);
  n = A.nextMeasure(rl, T0 + 20 * DAY + HOUR);
  t.eq([n.kind, n.when, n.due], ['regular', 'session-start', true], 'Lab: a full check opens the experiment');
  measure(PX, rl, L, 'regular', T0 + 20 * DAY + HOUR);
  t.eq(A.nextMeasure(rl, T0 + 22 * DAY).kind, 'block', 'then blocks');
  const W = E.config.lab.weeks * 7 * DAY;
  n = A.nextMeasure(rl, T0 + 20 * DAY + W + HOUR);
  t.eq([n.kind, n.due], ['regular', true], 'and a full check closes phase 1');
  t.ok(/phase 1/.test(n.why), 'saying so');
}

/* ---------- sessions and entries ---------- */

function sessions(t) {
  t.section('measure: sessions and entries');
  const PX = t.mk(), E = PX.engine, A = E.assess, M = E.model, L = new Learner(PX, 9);
  const rec = newRecord(PX, T0);
  const b1 = measure(PX, rec, L, 'B1', T0);
  const e1 = rec.assess[0];
  t.ok(e1.kind === 'B1' && ['A', 'B', 'C'].includes(rec.measure.form0) && e1.form === rec.measure.form0, 'B1 on the record’s first form, drawn at B1');
  const drawn = new Set();
  for (let i = 0; i < 30; i++) { const r = newRecord(PX, T0 + i * 7919); const pl = E.modes.start(r, 'check', { now: T0, kind: 'B1' }); drawn.add(pl.check.form); }
  t.eq([...drawn].sort(), ['A', 'B', 'C'], 'the first form differs between records (O16)');
  t.ok(Object.keys(e1.results).length === 7 && Object.keys(e1.items).every((id) => e1.items[id].length === e1.results[id].n), 'items kept per probe, one row per scored answer');
  t.ok(Object.values(e1.items).flat().every((r) => r.length === 4 && Number.isFinite(r[0]) && r[1] >= 0 && r[1] < 1 && (r[2] === 0 || r[2] === 1) && (r[3] === null || Number.isInteger(r[3]))), 'rows [b, g, ok, rtMs]');
  t.eq(e1.pv, { otherway: 1, cubematch: 1, viewmatch: 1, mechanisms: 1, patterns: 1, motiongraphs: 1, wordlinks: 1 }, 'probe versions kept');
  const def = PX.ex.get('patterns'), lw = A._.newPost(def);
  for (const [b, g, ok] of e1.items.patterns) A._.updatePost(lw, b, g, ok === 1);
  t.near(e1.results.patterns.theta, A._.summary(lw).mu, 1e-4, 'the stored θ is the standard-prior posterior of those items');
  t.eq(rec.sessions.map((s) => s.kind), ['baseline'], 'the check session is marked baseline');
  t.ok(b1.steps.every((x) => x.step.feedback === false && x.step.seed >= 2 ** 31 && x.step.kind === 'probe'), 'no feedback, shared seeds, probe rows');

  const b2 = measure(PX, rec, L, 'B2', T0 + 13 * HOUR);
  const F = ['A', 'B', 'C'];
  t.eq(rec.assess[1].form, F[(F.indexOf(rec.measure.form0) + 1) % 3], 'B2 on the next form');
  t.ok(b2.steps.every((x) => Math.abs(x.step.target - M.target(x.step.g, 0.6)) < 1e-12), 'probes met before: every item at g + (1 − g)·0.6');
  t.ok(b1.steps.filter((x) => x.step.probe.index < 2).every((x) => Math.abs(x.step.target - M.target(x.step.g, 0.85)) < 1e-12), 'B1: the first two items of each probe at 0.85');
  train(rec, T0 + 20 * HOUR, 30);
  const p = E.modes.start(rec, 'check', { now: T0 + 30 * HOUR, kind: 'block' });
  const f = A.fit(rec), input = A.trendInput(rec);
  const h = A._.hAt(rec, input.t0, T0 + 30 * HOUR);
  t.near(h, 1 - Math.exp(-30 / 240), 1e-9, 'h = 1 − exp(−training minutes since the first occasion / 240)');
  const pr = p.check.probes.find((x) => x.id === 'viewmatch'), want = E.trend.predict(f, 'viewmatch@1', h, T0 + 30 * HOUR).mean;
  const rg = M.range(PX.ex.get('viewmatch'));
  t.near(A._.summary(pr.lw).mu, Math.min(rg.max, Math.max(rg.min, want)), 0.02, 'a block aims at the trend model’s prediction for the probe');
  t.ok(p.check.probes.every((x) => x.fresh === false && x.easy === 0), 'probes met before: no easy-first items, no worked example');
  const steps = [];
  for (let i = 0; i < 40; i++) {
    const s = E.modes.next(p, rec, T0 + 30 * HOUR + i * 8000);
    if (s.done) break;
    steps.push(s);
    E.modes.answer(p, rec, s, { correct: i % 3 !== 1, rt: 2500 }, T0 + 30 * HOUR + i * 8000 + 4000);
  }
  E.modes.finish(p, rec, T0 + 31 * HOUR);
  const blk = rec.assess[2];
  t.eq([steps.length, blk.kind, blk.form, blk.bi], [14, 'block', null, 0], 'a block: 14 items, kind block, no form, block index 0');
  t.ok(steps.every((s) => s.probe.example === null), 'no worked example in a block for probes met before');
  t.eq(new Set(steps.map((s) => s.seed)).size, 14, 'every item its own seed');
  t.eq(rec.sessions[rec.sessions.length - 1].kind, 'block', 'the session is marked block');
  t.ok(rec.practiceMs === 0 && A.checks(rec).length === 2, 'a block is neither practice time nor a full check');

  // a new probe version is met fresh: two easy items first and its worked example
  const P2 = t.mk({ versions: { otherway: 2 } }), r2 = JSON.parse(JSON.stringify(rec));
  P2.ex.learn('otherway', { demo: [{ params: { steps: 0, strand: 0 }, seed: 7, kind: 'demo' }] });
  const q = P2.engine.modes.start(r2, 'check', { now: T0 + 40 * HOUR, kind: 'block' });
  const ow = q.check.probes.find((x) => x.id === 'otherway');
  t.ok(ow.fresh === true && ow.easy === 2 && ow.v === 2 && q.check.probes.filter((x) => x.fresh).length === 1, 'a probe’s new version counts as new: two easy items first');
  const first = P2.engine.modes.next(q, r2, T0 + 40 * HOUR);
  t.ok(first.exId === 'otherway' && first.probe.example && first.probe.example.seed === 7 && first.seed !== 7, 'and its worked example, once');
  t.ok(Math.abs(first.target - P2.engine.model.target(first.g, 0.85)) < 1e-12, 'its first item aims at g + (1 − g)·0.85');
}

/* ---------- the trend input ---------- */

function trendInput(t) {
  t.section('measure: the trend model’s input');
  const P1 = t.mk(), c = P1.engine.assess._.priorCenter(P1.ex.get('cubematch')), rg = P1.engine.model.range(P1.ex.get('cubematch'));
  // cubematch upgraded to version 2, which records version 1's range
  const PX = t.mk({ versions: { cubematch: 2 }, past: { cubematch: { 1: { min: rg.min, max: rg.max } } } }), E = PX.engine, A = E.assess;
  const rec = newRecord(PX, T0);
  // a 1.1 entry: posteriors only
  rec.assess.push({ date: new Date(T0).toISOString(), form: 'A', kind: 'B1', results: { cubematch: { right: 10, n: 16, theta: c + 0.8, se: 0.6, rtMed: 2000 }, wordlinks: { right: 9, n: 16, theta: c, se: 1.49, rtMed: 2500 } }, pv: { cubematch: 1, wordlinks: 1 } });
  // a 1.2 entry with items, cubematch now version 2
  rec.assess.push({ date: new Date(T0 + DAY).toISOString(), form: null, kind: 'block', results: { cubematch: { right: 1, n: 2, theta: 0, se: 1, rtMed: 2000 } }, items: { cubematch: [[0.1, 0.5, 1, 2100], [0.4, 0.5, 0, null]] }, pv: { cubematch: 2 } });
  const inp = A.trendInput(rec);
  t.eq(inp.occasions.length, 2, 'two occasions');
  const s0 = inp.occasions[0].blocks;
  t.eq(s0.map((b) => b.probe), ['cubematch@1'], 'the 1.1 entry gives a summary under its version; a posterior as wide as the prior gives none');
  t.ok(s0[0].n === 16 && s0[0].y > c + 0.8 && s0[0].v > 0.36, 'the prior divided out: further from the centre and wider than the posterior');
  const v = 1 / (1 / 0.36 - 1 / 2.25), y = (c + 0.8) / 0.36 - c / 2.25;
  t.near(s0[0].y, y * v, 1e-9, 'y = (θ/se² − c/1.5²) / (1/se² − 1/1.5²), with c the centre of version 1’s range');
  t.eq(inp.centers['cubematch@1'], c, 'version 1 centred on its own range');
  t.eq(inp.occasions[1].blocks, [{ probe: 'cubematch@2', items: [[0.1, 0.5, 1], [0.4, 0.5, 0]] }], 'a new entry gives its items, under its version');
  const P3 = t.mk({ versions: { cubematch: 2 } });
  t.eq(P3.engine.assess._.fromPosterior(P3.ex.get('cubematch'), { n: 16, theta: 0, se: 0.5 }, 1), null, 'without the earlier version’s range no summary');
  const fit = A.fit(rec), direct = E.trend.fit(inp, { center: inp.centers });
  t.near(fit.gain.comp ? fit.gain.comp.mean : 0, direct.gain.comp ? direct.gain.comp.mean : 0, 1e-12, 'A.fit is trend.fit of that input');
  t.ok(A.fit(rec) === fit, 'cached while nothing changes');
  train(rec, T0 + 2 * DAY);
  t.ok(A.fit(rec) !== fit, 'a new session refits');
  // h counts training after the first occasion; a session that began before it counts its share after it
  const r2 = newRecord(PX, T0);
  r2.sessions.push({ id: 'a', start: T0 - 10 * 60000, end: T0 + 10 * 60000, mode: 'train', trials: 60, right: 40, practiceMs: 20 * 60000, exs: ['fold'] });
  r2.sessions.push({ id: 'b', start: T0 + HOUR, end: T0 + HOUR + 60000, mode: 'check', trials: 14, right: 9, practiceMs: 60000, exs: ['cubematch'] });
  t.near(A._.hAt(r2, T0, T0 + DAY), 1 - Math.exp(-10 / 240), 1e-9, 'B1 inside the first session: the 10 minutes after it count; checks never do');
}

/* ---------- the meter and the verdicts ---------- */

function meterAndVerdicts(t) {
  t.section('measure: the meter and the verdicts');
  const PX = t.mk(), E = PX.engine, A = E.assess;
  const L = new Learner(PX, 21, { transfer: 3 });
  const rec = newRecord(PX, T0);
  t.eq(A.meter(rec, T0).p, null, 'no meter before the baselines');
  measure(PX, rec, L, 'B1', T0);
  measure(PX, rec, L, 'B2', T0 + 13 * HOUR);
  const m0 = A.meter(rec, T0 + 14 * HOUR);
  t.ok(m0.p === null && /starting points/.test(m0.line), 'none before training after the baselines either');
  let now = T0 + DAY, verdicts = 0;
  for (let d = 1; d <= 30; d += 2) {
    now = T0 + d * DAY;
    train(rec, now, 40);
    L.setProbeDay && L.setProbeDay(d);
    measure(PX, rec, L, A.nextMeasure(rec, now + HOUR).kind === 'regular' ? 'regular' : 'block', now + HOUR, d);
    const vs = rec.measure.verdicts || [];
    if (vs.length !== verdicts) { verdicts = vs.length; }
  }
  const m = A.meter(rec, now + 2 * HOUR);
  t.ok(m.p > 0 && m.p < 1 && m.lo < m.mean && m.mean < m.hi && m.unit === 'points', 'a probability with a range in probe points');
  t.ok(['near', 'mid', 'far'].every((r) => m.rungs[r] && m.rungs[r].lo < m.rungs[r].hi), 'each rung a meter with its range');
  t.ok(!/IQ|percentile|index|norm|brain age/i.test(JSON.stringify(m)), 'no IQ, index, percentile, norm or brain age');
  const vs = rec.measure.verdicts;
  t.eq(vs.map((v) => v.day), [14, 28], 'one verdict at day 14 and one at day 28, stored once');
  t.ok(vs.every((v) => ['likely gain', 'likely no change', 'unclear yet'].includes(v.words) && Number.isFinite(v.p)), 'in the verdict words');
  t.eq(A.settle(rec, now + 3 * HOUR), null, 'settling again stores nothing new');
  t.ok(m.milestone && m.milestone.day === 28 && /Likely gain|Unclear yet|Likely no change/.test(m.line) && m.next.day === 56, 'within a week of a verdict the line gives its words; the next comes at day 56');
  const later = A.meter(rec, now + 10 * DAY);
  t.ok(/Chance that your probe results rose/.test(later.line) && /day 56/.test(later.line), 'between milestones: the chance and the next milestone');

  t.section('measure: the report');
  const rp = A.report(rec, now + 2 * HOUR);
  t.eq([rp.status, rp.baselines, rp.composite.outcome, rp.verdict.day], ['trend', 2, vs[1].words, 28], 'report: the latest verdict’s words, the meter beside them');
  t.ok(rp.composite.p === m.p && rp.lines[0] === m.line && rp.rungs.near && rp.composite.probes.length >= 5, 'the same meter and line as meter()');
  t.ok(!/IQ|percentile|index|norm|brain age|beyond familiarity/i.test(JSON.stringify(rp)), 'no 1.1 words, no IQ, index, percentile, norm or brain age');
  const r0 = newRecord(PX, T0);
  t.eq(A.report(r0, T0).status, 'none', 'no check: none');
  measure(PX, r0, L, 'B1', T0);
  t.eq(A.report(r0, T0 + HOUR).status, 'baseline', 'one starting point: baseline');
  measure(PX, r0, L, 'B2', T0 + 13 * HOUR);
  t.eq(A.report(r0, T0 + 14 * HOUR).status, 'baseline-done', 'two, no training yet: baseline-done');
  train(r0, T0 + 15 * HOUR, 20);
  measure(PX, r0, L, 'block', T0 + 24 * HOUR);
  const rr = A.report(r0, T0 + 25 * HOUR);
  t.ok(rr.status === 'trend' && rr.composite.outcome === null && rr.verdict === null, 'training began: the meter, and no words before day 14');
}

/* ---------- the container, merge, events, session kinds ---------- */

function container(t) {
  t.section('measure: container, two tabs, events');
  const PX = t.mk({ store: true }), E = PX.engine, A = E.assess, S = PX.core.store;
  E.fields().forEach((f) => S.field(f.key, f.def, f.fix));
  A.wire();
  t.ok(E.merge.registered().includes('measure'), 'the measure container has its merge');
  const k = E.events.kinds();
  t.ok(k.measure && k.measure.fields.what === 'token' && k.background && k.background.fields.q === 'token', 'the measure and background events are defined');
  const chk = A._.checkMeasure;
  t.eq(chk({ v: 1, form0: null }), { v: 1, form0: null }, 'the repair adds no key');
  t.eq(chk({ v: 1, form0: 'B', later: 'x', verdicts: [{ day: 14, at: 5, words: 'likely gain', p: 0.99 }, { day: 14, at: 6, words: 'likely gain' }, { day: 28, at: 7, words: 'great' }, { day: -1, at: 1, words: 'unclear yet' }] }),
    { v: 1, form0: 'B', verdicts: [{ day: 14, at: 5, words: 'likely gain', p: 0.99 }] }, 'it drops broken verdicts, duplicates and a broken put-off mark');
  const mm = A._.mergeMeasure;
  const a = { v: 1, form0: 'C', verdicts: [{ day: 14, at: 10, words: 'unclear yet' }] }, b = { v: 1, form0: null, later: 99, verdicts: [{ day: 14, at: 12, words: 'likely gain' }, { day: 28, at: 30, words: 'unclear yet' }] };
  t.eq(mm(a, b, { newer: 'mine' }), { v: 1, form0: 'C', later: 99, verdicts: [{ day: 14, at: 10, words: 'unclear yet' }, { day: 28, at: 30, words: 'unclear yet' }] }, 'two tabs: one verdict per milestone (the earlier), the drawn form');
  t.eq(mm({ v: 1, form0: null }, { v: 1, form0: null }, {}), { v: 1, form0: null }, 'nothing added when neither has verdicts');

  const L = new Learner(PX, 3), rec = newRecord(PX, T0);
  measure(PX, rec, L, 'B1', T0);
  measure(PX, rec, L, 'regular', T0 + DAY);
  measure(PX, rec, L, 'block', T0 + 2 * DAY);
  measure(PX, rec, L, 'week', T0 + 3 * DAY);
  t.eq(rec.sessions.map((s) => s.kind), ['baseline', 'check', 'block', 'week'], 'session kinds: baseline, check, block, week');
  const g = S.guard(JSON.parse(JSON.stringify(rec)));
  t.ok(g.assess.length === 4 && g.assess[2].kind === 'block' && Array.isArray(g.assess[2].items.otherway) && g.assess[2].bi === 0, 'entries survive the store’s repair with their items and block index');
}

/* ---------- new-exercise learning curves (Lab; note T1 §5.2) ---------- */

function curves(t) {
  t.section('measure: learning curves on new exercises');
  const PX = t.mk({ store: true }), E = PX.engine, A = E.assess, S = PX.core.store, CC = E.config.measure.curves;
  E.fields().forEach((f) => S.field(f.key, f.def, f.fix));
  A.wire();
  // the fit: simulated players aimed at their edge as they improve (b follows θ), so the share right stays flat
  const R = PX.rng(11);
  function sim(slope) {
    const rows = [];
    for (let k = 0; k < CC.n; k++) {
      const x = k / (CC.n - 1), th = -0.5 + slope * x, b = th - 0.4 + R.normal() * 0.5, g = 0.25;
      const P = g + (1 - g - 0.03) / (1 + Math.exp(-(th - b)));
      rows.push({ b, g, y: R.next() < P ? 1 : 0 });
    }
    return A._.fitCurve(rows, CC);
  }
  for (const slope of [0, 1.5]) {
    const est = [];
    let cover = 0, pos = 0;
    for (let i = 0; i < 400; i++) {
      const f = sim(slope);
      est.push(f.slope);
      if (Math.abs(f.slope - slope) <= 1.96 * f.se) cover++;
      if (f.slope - 1.96 * f.se > 0) pos++;
    }
    const mean = est.reduce((a, b) => a + b, 0) / est.length;
    t.ok(Math.abs(mean - slope) < 0.25, `slope ${slope}: the mean estimate ${mean.toFixed(2)} is within 0.25 (little shrinkage, for pooling)`);
    t.ok(cover / 400 >= 0.88 && cover / 400 <= 0.995, `slope ${slope}: ±1.96 se covers ${(cover / 4).toFixed(1)} %`);
    if (slope === 0) t.ok(pos / 400 <= 0.06, `no learning: a clear rise in ${(pos / 4).toFixed(1)} % of players (≤ 6 %)`);
    else t.ok(pos / 400 >= 0.12, `learning of 1.5 logits: a clear rise in ${(pos / 4).toFixed(1)} % of single players (one curve is rough: pooling is the point)`);
  }
  // the record: Train sessions on the fixture exercises; Fold stands in for an exercise added in an update
  const keep = CC.ex;
  CC.ex = ['fold', 'nets'];
  try {
    const L = new Learner(PX, 5), rec = newRecord(PX, T0);
    t.eq(A.curves(rec), [], 'no rated answers: no curve');
    let day = 0, guard = 0;
    while (guard++ < 60) {
      playSession(PX, rec, L, 'train', { now: T0 + day * DAY, minutes: 10 }, day);
      day++;
      const c = A.curves(rec).find((x) => x.ex === 'fold');
      if (c && c.done) break;
    }
    const list = A.curves(rec), c = list.find((x) => x.ex === 'fold');
    t.ok(c && c.done && c.n === CC.n && c.ver === 1 && Number.isFinite(c.slope) && c.se > 0 && c.se < 2, `Fold's curve: its first ${CC.n} rated answers (${c && c.slope} ± ${c && c.se})`);
    t.ok(c && c.p0 > 0 && c.p0 < 1 && c.p1 > 0 && c.p1 < 1 && typeof c.exposure === 'object', 'the chance of a right answer at the start and now, and the exposure before');
    const firstFold = (() => { let at = null; E.log.scan(rec, (row, ex, mode) => { if (at === null && ex === 'fold' && mode === 'train') at = row[0]; }); return at; })();
    t.ok(c && c.first === firstFold, 'the curve starts at the first rated Fold answer');
    // exposure: rated answers of other exercises before that one
    let before = 0;
    E.log.scan(rec, (row, ex, mode) => { if (row[0] < firstFold && mode === 'train' && (row[5] === 0 || row[5] === 1) && ex !== 'fold') before++; });
    const sum = Object.values(c.exposure).reduce((a, b) => a + b, 0);
    t.ok(sum <= before, `exposure counts only answers before the first (${sum} of ${before})`);
    t.ok(!(rec.measure && rec.measure.curves), 'reading files nothing');
    A.curves(rec, { keep: true });
    t.ok(rec.measure.curves['fold@1'] && rec.measure.curves['fold@1'].done, 'keep: a finished curve is filed under fold@1');
    // the trial cap folds the rows away: the filed curve stands in
    const r2 = JSON.parse(JSON.stringify(rec));
    r2.trials = [];
    t.eq(A.curves(r2).find((x) => x.ex === 'fold'), rec.measure.curves['fold@1'], 'rows folded away: the filed curve is reported');
    // repair and merge
    const g = S.guard(JSON.parse(JSON.stringify(rec)));
    t.ok(g.measure.curves['fold@1'] && g.measure.curves['fold@1'].n === CC.n, 'the store’s repair keeps it');
    t.eq(A._.checkMeasure({ v: 1, curves: { 'fold@1': { ex: 'nets' }, 'x@y': {}, 'nets@1': { ex: 'nets', done: true, n: 60, slope: 1, se: 0.5, first: 5 } } }),
      { v: 1, curves: { 'nets@1': { ex: 'nets', done: true, n: 60, slope: 1, se: 0.5, first: 5 } } }, 'the repair drops broken curves');
    const m = A._.mergeMeasure({ v: 1, curves: { 'fold@1': { ex: 'fold', done: true, n: 60, slope: 1, se: 0.5, first: 9 } } },
      { v: 1, curves: { 'fold@1': { ex: 'fold', done: true, n: 60, slope: 2, se: 0.5, first: 7 }, 'nets@1': { ex: 'nets', done: true, n: 60, slope: 0, se: 0.5, first: 3 } } }, {});
    t.ok(m.curves['fold@1'].slope === 2 && m.curves['nets@1'].slope === 0, 'two tabs: both curves, the earlier start where both have one');
    // Free play and other versions do not count
    const free = JSON.parse(JSON.stringify(rec));
    const fi = free.idx.mode.indexOf('free') >= 0 ? free.idx.mode.indexOf('free') : free.idx.mode.push('free') - 1;
    const ti = free.idx.mode.indexOf('train');
    free.trials.forEach((row) => { if (row[2] === ti) row[2] = fi; });
    delete free.measure.curves;
    t.eq(A.curves(free), [], 'Free play answers give no curve');
  } finally {
    CC.ex = keep;
  }
}

/* ---------- Balance, the Lab check of the calibrate bet ---------- */

function balance(t) {
  t.section('measure: the Balance check (Lab)');
  const PX = t.mk({ store: true }), E = PX.engine, A = E.assess, S = PX.core.store;
  E.fields().forEach((f) => S.field(f.key, f.def, f.fix));
  A.wire();
  const L = new Learner(PX, 9), rec = newRecord(PX, T0);
  measure(PX, rec, L, 'B1', T0);
  const before = JSON.stringify(A.nextMeasure(rec, T0 + DAY)), nAssess = rec.assess.length;
  const out = playSession(PX, rec, L, 'check', { now: T0 + 2 * HOUR, kind: 'balance' }, 0);
  const b = rec.measure.balance;
  t.ok(Array.isArray(b) && b.length === 1 && b[0].n === E.config.measure.lab.balance.items && b[0].items.length === b[0].n, `one run of ${E.config.measure.lab.balance.items} items in rec.measure.balance`);
  t.ok(b[0].items.every((r) => r.length === 9 && (r[6] === 0 || r[6] === 1)), 'rows [b, g, ok, rtMs, distance, pull, kind, x, y]');
  const kinds = b[0].items.map((r) => r[6]);
  t.ok(kinds.filter((k) => k === 0).length === 6 && kinds.every((k, i) => k === i % 2), 'the two kinds in turn, six each');
  t.eq(rec.assess.length, nAssess, 'nothing goes into rec.assess');
  t.eq(JSON.stringify(A.nextMeasure(rec, T0 + DAY)), before, 'the schedule does not see it');
  t.eq(rec.sessions[rec.sessions.length - 1].kind, 'lab', 'its session is marked lab');
  const fc = out && out.fin && (out.fin.check || (out.fin.res && out.fin.res.check));
  t.ok(fc && fc.lab && fc.balance && fc.balance.n === b[0].n, 'the result carries its summary');
  // a second run takes other items (alternate forms by seed)
  playSession(PX, rec, L, 'check', { now: T0 + 3 * HOUR, kind: 'balance' }, 0);
  t.ok(rec.measure.balance.length === 2, 'a second run is kept');
  // the summary: distance and pull per kind
  const sum = A.balanceSummary({ date: 'x', n: 4, items: [[0, 0, 1, 900, 2, 1.1, 0, 1, 1], [0, 0, 0, 900, 8, 0.6, 0, 1, 1], [0, 0, 0, 900, 9, 0.9, 1, 1, 0], [0, 0, 1, 900, 1, 0.1, 1, 1, 0]] });
  t.eq([sum.centroid.n, sum.centroid.right, sum.centroid.dist, sum.centroid.pull, sum.median.right, sum.median.dist, sum.median.pull], [2, 1, 5, 0.85, 1, 5, 0.5], 'per kind: items, right, mean distance, median pull');
  t.eq(A.balanceReport(rec).length, 2, 'the report lists the runs, latest first');
  // repair and merge
  const g = S.guard(JSON.parse(JSON.stringify(rec)));
  t.ok(g.measure.balance.length === 2, 'the store’s repair keeps the runs');
  t.eq(A._.checkMeasure({ v: 1, balance: [{ date: 'd', n: 1, items: [] }, { n: 2 }, 'x'] }), { v: 1, balance: [{ date: 'd', n: 1, items: [] }] }, 'the repair drops broken runs');
  const m = A._.mergeMeasure({ v: 1, balance: [{ date: '2026-11-02', n: 1, items: [] }] }, { v: 1, balance: [{ date: '2026-11-01', n: 2, items: [] }, { date: '2026-11-02', n: 1, items: [] }] }, {});
  t.eq(m.balance.map((e) => e.date), ['2026-11-01', '2026-11-02'], 'two tabs: every run once, in time order');
}
