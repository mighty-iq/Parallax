#!/usr/bin/env node
/* Simulated learners (PLAN §12.2): node tests/node/sim.mjs [--learners 200] [--days 60]
   [--runs train-balanced,path,…] [--json out.json]

   Every run plays N learners for D days on fixture exercises shaped like the real ones
   (tests/node/fixtures/exercises.mjs), with the learner model of tests/node/fixtures/learner.mjs:
   individual learning curves, day-to-day noise, breaks of several days with forgetting,
   guessing, lapses, switch costs and response times. Learners practise 2–6 times a week, take
   the Spatial Check when it is due, and play the Daily Challenge on some days.
   Runs: train-comfortable, train-balanced, train-stretch (one per style), train-misspec
   (item difficulty misspecified: item noise SD 0.5 plus a dimension interaction), path, speed,
   threshold, free, check-transfer (learners whose probe abilities follow their training).
   Reported and checked: success vs target, 95 % interval coverage of the true ability, repeated
   seeds, exercises practised, session dead ends, Path progression, staircase thresholds vs the
   truth, Speed targeting, Free play leaving ratings alone, Spatial Check outcomes, streaks and
   achievements, record size. The exit code is 1 when a hard check fails. */
import fs from 'node:fs';
import { performance } from 'node:perf_hooks';
import { createContext } from './run.mjs';
import { defineFixtures } from './fixtures/exercises.mjs';
import { Learner, newRecord, playSession } from './fixtures/learner.mjs';

const DAY = 86400000;
const T0 = Date.UTC(2026, 10, 2, 0, 0, 0); // Monday 2 Nov 2026

function arg(name, def) {
  const i = process.argv.indexOf('--' + name);
  return i > 0 && process.argv[i + 1] !== undefined ? process.argv[i + 1] : def;
}
const N = Math.max(1, parseInt(arg('learners', '200'), 10));
const DAYS = Math.max(7, parseInt(arg('days', '60'), 10));
const RUNS = [
  { id: 'train-comfortable', mode: 'train', style: 'comfortable' },
  { id: 'train-balanced', mode: 'train', style: 'balanced' },
  { id: 'train-stretch', mode: 'train', style: 'stretch' },
  { id: 'train-misspec', mode: 'train', style: 'balanced', misspec: true },
  { id: 'path', mode: 'path', style: 'balanced' },
  { id: 'speed', mode: 'speed', style: 'balanced' },
  { id: 'threshold', mode: 'threshold', style: 'balanced' },
  { id: 'free', mode: 'free', style: 'balanced' },
  { id: 'check-transfer', mode: 'train', style: 'balanced', transfer: 0.5 },
  // diagnostic, only when named in --runs: level 0 made 0.75 logit easier (learners start 2.5
  // logits above the easiest item instead of 1.75), to show what the Comfortable floor costs
  { id: 'comfortable-easier', mode: 'train', style: 'comfortable', aboveFloor: 2.5, optional: true, seedAs: 'train-comfortable' },
];
const only = arg('runs', '') ? new Set(arg('runs', '').split(',')) : null;

const PROTOS = ['track-standard', 'track', 'span-length', 'spin-deadline'];

function blankStats() {
  return {
    learners: 0, sessions: 0, trials: 0, deadEnds: [], unavailable: {}, dupSeeds: 0, allPractised: 0, practisedMin: Infinity, missed: [],
    kinds: {}, tgt: { n: 0, x: 0, t: 0 }, feas: { n: 0, x: 0, t: 0 }, all: { n: 0, x: 0, t: 0 }, off: { below: 0, above: 0, atFloor: 0 },
    cov: { n: 0, in: 0, z2: 0, bias: 0 }, covEnd: { n: 0, in: 0 }, byAnswer: {},
    sizes: [], streak: { bad: 0, cur: [], best: [] }, ach: { bad: 0, counts: {}, perLearner: [] },
    path: { passes: {}, reach: {}, rechecks: { held: 0, failed: 0 } }, speed: { n: 0, x: 0, t: 0, unlocked: 0, sessions: 0 },
    thr: {}, free: { sessions: 0, changed: 0 }, check: { last: {}, n: 0, cover: { n: 0, in: 0 }, outcomes: {} },
    stageMax: [], guardKept: null,
  };
}

function add(o, x, t) { o.n++; o.x += x; o.t += t; }

// The easiest difficulty among an exercise's items with guessing rate g.
const floors = new Map();
function floorOf(PX, exId, g) {
  const k = exId + ':' + g;
  if (!floors.has(k)) floors.set(k, Math.min(...PX.engine.model.pool(PX.ex.get(exId)).filter((c) => c.g === g).map((c) => c.b)));
  return floors.get(k);
}

// The true threshold of a protocol run (at the session's start).
function truth(PX, L, plan, steps, day) {
  const pr = plan.protocol, def = pr.def, E = PX.engine, p = plan.sc.p;
  if (pr.rule === 'deadline') {
    const items = steps.map((s) => s.step.params);
    const f = (x) => items.reduce((a, prm) => a + L.pAt(def, prm, null, 0, day, { deadline: Math.pow(10, x) }), 0) / items.length;
    return L.solve((x) => -f(x), -p, 1.5, 5); // f rises with the deadline: solve on −f
  }
  const base = pr.base;
  if (pr.rule === 'discrete') return L.solve((x) => L.pAt(def, base, pr.dim.key, x, day), 0.7071, -3, pr.dim.levels.length + 3);
  void E;
  return L.solve((x) => L.pAt(def, base, pr.dim.key, x, day, { log: true }), p, pr.lo - 1, pr.hi + 1);
}

function simLearner(PX, run, i, S) {
  const E = PX.engine, U = PX.util;
  const rng = PX.rng(PX.rng.hash('sim-days', run.seedAs || run.id, i)); // seedAs: the same learners as another run
  const L = new Learner(PX, PX.rng.hash(run.seedAs || run.id, i), { misspec: !!run.misspec, transfer: run.transfer || 0, aboveFloor: run.aboveFloor });
  const weekly = rng.int(2, 6), minutes = rng.pick([10, 15, 20, 20, 20, 30]);
  const rec = newRecord(PX, T0 - 3600e3, { weeklyGoal: weekly, sessionMin: minutes });
  rec.train.style = run.style;
  const display = rng.chance(0.3) ? 'small' : 'large';
  const trainIds = PX.ex.list('train').map((d) => d.id);
  const favs = rng.shuffle(trainIds).slice(0, 3);
  let breakUntil = -1, sIdx = 0, thrIdx = 0;
  const passLog = [];
  const counted = (res, rated) => {
    S.sessions++;
    if (res.deadEnd) S.deadEnds.push(run.id + ':' + i + ':' + res.plan.mode + ':' + res.deadEnd);
    if (res.plan.unavailable) S.unavailable[res.plan.mode + ': ' + res.plan.unavailable] = (S.unavailable[res.plan.mode + ': ' + res.plan.unavailable] || 0) + 1;
    for (const s of res.steps) {
      S.trials++;
      if (s.out.outcome > 1 || !rated) continue;
      const x = s.out.outcome === 1 ? 1 : 0, k = s.step.kind;
      const kk = S.kinds[k] || (S.kinds[k] = { n: 0, x: 0, t: 0 });
      add(kk, x, s.step.target);
      add(S.all, x, s.step.target);
      if (k === 'target') {
        add(S.tgt, x, s.step.target);
        if (Math.abs(s.step.pPred - s.step.target) <= 0.05) add(S.feas, x, s.step.target);
        else if (s.step.pPred > s.step.target) S.off.above++;
        else { S.off.below++; if (s.step.b - floorOf(PX, s.step.exId, s.step.g) <= 0.3) S.off.atFloor++; }
        const ans = PX.ex.get(s.step.exId).answer, ba = S.byAnswer[ans] || (S.byAnswer[ans] = { n: 0, x: 0, t: 0 });
        add(ba, x, s.step.target);
      }
      if (s.out.path && s.out.path.passed) passLog.push({ ex: s.step.exId, stage: s.out.path.passed, day: res.day, n: E.est.get(rec, PX.ex.get(s.step.exId), { display }).n });
      if (s.out.path && s.out.path.recheck) S.path.rechecks[s.out.path.held ? 'held' : 'failed']++;
    }
  };
  const coverage = (res, day) => {
    for (const id of Object.keys(res.plan.rated)) {
      const def = PX.ex.get(id), st = E.est.get(rec, def, { display }), th = L.theta(def, day), z = (st.mu - th) / st.sd;
      S.cov.n++; S.cov.z2 += z * z; S.cov.bias += st.mu - th;
      if (Math.abs(z) <= 1.96) S.cov.in++;
    }
  };
  for (let d = 0; d < DAYS; d++) {
    if (d <= breakUntil) continue;
    if (d % 7 === 0 && d > 0 && rng.chance(0.12)) { breakUntil = d + rng.int(4, 14); continue; }
    if (!rng.chance(weekly / 7)) continue;
    const day0 = T0 + d * DAY + (17 + rng.int(0, 4)) * 3600e3 + rng.int(0, 59) * 60e3;
    let now = day0;
    const play = (mode, opts, rated) => {
      const res = playSession(PX, rec, L, mode, { now, display, ...opts }, d, { stutterP: 0.01 });
      res.day = d;
      counted(res, rated);
      now = res.now + 60e3;
      return res;
    };
    const due = E.assess.due(rec, now);
    if (due.due && (/^B/.test(due.kind) || rng.chance(0.85))) {
      L.setProbeDay(d);
      const res = play('check', {}, false);
      checkStats(PX, L, rec, res, S);
    }
    if (rng.chance(0.3)) play('daily', {}, false);
    const sessions = rng.chance(0.1) ? 2 : 1;
    for (let k = 0; k < sessions; k++, sIdx++) {
      if (run.mode === 'path') {
        coverage(play('path', { exId: favs[sIdx % favs.length] }, true), d);
        continue;
      }
      if (run.mode === 'speed' && sIdx % 2 === 1) {
        const open = trainIds.filter((id) => E.speed.open(rec, PX.ex.get(id), { display }).ok);
        if (open.length) {
          S.speed.unlocked += open.length > 0 ? 1 : 0;
          const res = play('speed', { exId: rng.pick(open) }, false);
          S.speed.sessions++;
          res.steps.forEach((s, j) => { if (j >= 10 && s.out.outcome < 2) add(S.speed, s.out.inTime ? 1 : 0, res.plan.sc.p); });
          continue;
        }
      }
      if (run.mode === 'free' && sIdx % 2 === 1) {
        const id = rng.pick(trainIds), def = PX.ex.get(id);
        const ratings = () => JSON.stringify(trainIds.map((x) => {
          const d = PX.ex.get(x), u = E.est.get(rec, d, { display }), tm = E.est.get(rec, d, { display, timed: true });
          return [x, u.mu, u.sd, u.n, tm.mu, tm.sd, tm.n];
        }));
        const before = ratings();
        const fixed = rng.chance(0.5) ? rng.pick(E.model.pool(def)).params : null;
        play('free', { exId: id, params: fixed ? { ...fixed } : undefined, minutes: 5 }, false);
        S.free.sessions++;
        if (ratings() !== before) S.free.changed++;
        continue;
      }
      const res = play('train', {}, true);
      coverage(res, d);
      if (run.mode === 'threshold' && (sIdx % 3 === 2)) {
        const proto = PROTOS[thrIdx++ % PROTOS.length];
        const tr = play('threshold', { protocol: proto }, false);
        if (tr.plan.protocol && tr.fin.threshold) {
          const T = truth(PX, L, tr.plan, tr.steps, d), e = tr.fin.threshold;
          const o = S.thr[proto] || (S.thr[proto] = { n: 0, err: [], atBound: 0, ok: 0 });
          o.n++; o.err.push(e.x - T); if (e.atBound) o.atBound++; if (e.ok) o.ok++;
        }
      }
    }
  }
  finishLearner(PX, run, rec, L, S, passLog, favs, display);
}

function checkStats(PX, L, rec, res, S) {
  const c = res.fin && res.fin.check;
  if (!c) return;
  S.check.n++;
  const idx = res.plan.check.index;
  for (const id of Object.keys(c.results)) {
    const r = c.results[id], th = L.probeTheta(PX.ex.get(id), idx);
    S.check.cover.n++;
    if (Math.abs(r.theta - th) <= 1.96 * r.se) S.check.cover.in++;
  }
}

function finishLearner(PX, run, rec, L, S, passLog, favs, display) {
  const E = PX.engine, end = T0 + DAYS * DAY;
  S.learners++;
  // Answered items only: a voided Daily item is shown again with its own (shared) seed.
  const seeds = rec.trials.filter((r) => r[5] === 0 || r[5] === 1).map((r) => r[4]);
  S.dupSeeds += seeds.length - new Set(seeds).size;
  const trainDefs = PX.ex.list('train');
  const practised = trainDefs.filter((d) => E.schedule.totals(rec, d).n > 0).length;
  if (practised === trainDefs.length) S.allPractised++;
  else S.missed.push(`learner ${S.learners - 1}: ${trainDefs.filter((d) => !(E.schedule.totals(rec, d).n > 0)).map((d) => d.id).join(', ')} never practised in ${rec.sessions.filter((x) => x.mode === 'train').length} Train sessions`);
  S.practisedMin = Math.min(S.practisedMin, practised);
  const st = E.streak.status(rec, end), weeks = Math.ceil(DAYS / 7) + 1;
  const metOk = st.weeks.every((w) => !w.met || w.sessions >= w.goal);
  if (!(st.current >= 0 && st.current <= weeks && st.best >= st.current && metOk)) S.streak.bad++;
  S.streak.cur.push(st.current); S.streak.best.push(st.best);
  const ids = new Set(E.achievements.DEFS.map((d) => d.id)), got = Object.keys(rec.achievements);
  const datesOk = got.every((k) => { const t = Date.parse(rec.achievements[k]); return ids.has(k) && t >= rec.created && t <= end + DAY; });
  const allOk = practised < trainDefs.length || got.includes('all-exercises');
  if (!datesOk || !allOk) S.ach.bad++;
  got.forEach((k) => { S.ach.counts[k] = (S.ach.counts[k] || 0) + 1; });
  S.ach.perLearner.push(got.length);
  S.sizes.push(JSON.stringify(rec).length);
  S.stageMax.push(Math.max(1, ...Object.values(rec.train.stage)));
  passLog.forEach((p) => { (S.path.passes[p.stage] || (S.path.passes[p.stage] = [])).push(p); });
  if (run.mode === 'path') {
    favs.forEach((id) => {
      const ps = rec.path[id], top = ps ? Math.max(0, ...Object.keys(ps.passed).map(Number)) : 0;
      S.path.reach[top] = (S.path.reach[top] || 0) + 1;
    });
  }
  const rep = E.assess.report(rec, end);
  const o = rep.composite ? rep.composite.outcome : rep.status;
  S.check.outcomes[o] = (S.check.outcomes[o] || 0) + 1;
  if (S.guardKept === null && S.guard) {
    const g = S.guard(JSON.parse(JSON.stringify(rec)));
    const canon = (x) => JSON.stringify(x, (k, v) => (v && typeof v === 'object' && !Array.isArray(v) ? Object.keys(v).sort().reduce((o, kk) => { o[kk] = v[kk]; return o; }, {}) : v));
    S.guardKept = {
      engineFields: E.fields().every((f) => canon(g[f.key]) === canon(rec[f.key])),
      trialColumns: g.trials.length ? g.trials[0].length : null,
      assessRtMed: rec.assess.length ? g.assess[0] && Object.values(g.assess[0].results)[0].rtMed !== undefined : null,
      idxNames: JSON.stringify(g.idx.ex) === JSON.stringify(rec.idx.ex),
    };
  }
  void display; void L;
}

/* ---------------------------------------------------------------- report */

const pct = (x) => (100 * x).toFixed(1);
const med = (a) => { const s = a.slice().sort((x, y) => x - y); return s.length ? s[Math.floor(s.length / 2)] : NaN; };
const diff = (o) => (o.n ? 100 * (o.x - o.t) / o.n : NaN);
const line = (o) => (o.n ? `${pct(o.x / o.n)} % vs target ${pct(o.t / o.n)} % (${diff(o) >= 0 ? '+' : ''}${diff(o).toFixed(1)} points, n ${o.n})` : 'n 0');

function report(run, S, secs) {
  const out = [], hard = [];
  const check = (ok, what) => { hard.push({ ok, what }); return ok; };
  out.push(`\n== ${run.id} (${S.learners} learners × ${DAYS} days, ${S.sessions} sessions, ${S.trials} trials, ${secs.toFixed(0)} s)`);
  if (run.mode === 'train' || run.mode === 'path') {
    out.push(`  success on target items: ${line(S.tgt)}`);
    out.push(`  … where the item pool allowed the target (|pPred − target| ≤ 0.05, ${pct(S.feas.n / Math.max(1, S.tgt.n))} % of them): ${line(S.feas)}`);
    out.push(`  … the others: predicted below target ${S.off.below} (${pct(S.off.atFloor / Math.max(1, S.off.below))} % within 0.3 logit of the easiest item), above ${S.off.above}`);
    out.push(`  all rated items: ${line(S.all)}`);
    out.push('  by kind: ' + Object.keys(S.kinds).map((k) => `${k} ${pct(S.kinds[k].x / S.kinds[k].n)}/${pct(S.kinds[k].t / S.kinds[k].n)}`).join(', '));
    out.push('  target items by answer type: ' + Object.keys(S.byAnswer).map((k) => `${k} ${diff(S.byAnswer[k]).toFixed(1)}`).join(', '));
    check(Math.abs(diff(S.feas)) <= 3, `${run.id}: success within ±3 points of target where the pool allows it`);
    if (!run.misspec) check(Math.abs(diff(S.tgt)) <= 3, `${run.id}: success on all target items within ±3 points`);
  }
  if (S.cov.n) {
    out.push(`  95 % intervals hold the true ability: ${pct(S.cov.in / S.cov.n)} % of ${S.cov.n} (rms z ${Math.sqrt(S.cov.z2 / S.cov.n).toFixed(2)}, mean μ − θ ${(S.cov.bias / S.cov.n).toFixed(3)})`);
    if (run.id === 'train-balanced') check(S.cov.in / S.cov.n >= 0.93 && S.cov.in / S.cov.n <= 0.97, 'coverage 93–97 % (balanced, well-specified model)');
  }
  out.push(`  repeated seeds: ${S.dupSeeds}; learners who practised every exercise: ${S.allPractised}/${S.learners} (fewest ${S.practisedMin}${S.missed.length ? '; ' + S.missed.slice(0, 2).join('; ') : ''}); highest interleaving stage median S${med(S.stageMax)}`);
  check(S.dupSeeds === 0, `${run.id}: no repeated seeds`);
  if (run.mode === 'train' || run.mode === 'threshold' || run.mode === 'speed') check(S.allPractised === S.learners, `${run.id}: every exercise practised by every learner`);
  out.push(`  session dead ends: ${S.deadEnds.length}${S.deadEnds.length ? ' (' + S.deadEnds.slice(0, 3).join('; ') + ')' : ''}`);
  check(S.deadEnds.length === 0, `${run.id}: no session dead ends`);
  const unav = Object.entries(S.unavailable).filter(([k]) => !/^speed: Speed opens/.test(k));
  if (unav.length) out.push('  unavailable plans: ' + unav.map(([k, v]) => `${k} ×${v}`).join('; '));
  const sz = S.sizes;
  out.push(`  record size after ${DAYS} days: median ${(med(sz) / 1024).toFixed(0)} KB, max ${(Math.max(...sz) / 1024).toFixed(0)} KB`);
  check(Math.max(...sz) < 2 * 1024 * 1024, `${run.id}: record under 2 MB`);
  out.push(`  weekly streak: median current ${med(S.streak.cur)}, best ${med(S.streak.best)} weeks; inconsistent: ${S.streak.bad}`);
  const counts = Object.entries(S.ach.counts).sort((a, b) => b[1] - a[1]);
  out.push(`  achievements per learner: median ${med(S.ach.perLearner)}; most ${counts.slice(0, 3).map(([k, v]) => k + ' ' + v).join(', ')}; rarest ${counts.slice(-3).map(([k, v]) => k + ' ' + v).join(', ')}; inconsistent: ${S.ach.bad}`);
  check(S.streak.bad === 0 && S.ach.bad === 0, `${run.id}: streaks and achievements consistent`);
  if (run.mode === 'path') {
    const total = Object.values(S.path.reach).reduce((a, b) => a + b, 0);
    const reached = (s) => Object.entries(S.path.reach).filter(([k]) => +k >= s).reduce((a, [, v]) => a + v, 0);
    out.push('  Path stages passed (share of learner × exercise, median day and rated trials when passed): ' + [1, 2, 3, 5, 7, 10].map((s) => {
      const p = S.path.passes[s] || [];
      return `S${s} ${pct(reached(s) / Math.max(1, total))} %` + (p.length ? ` (day ${med(p.map((x) => x.day))}, ${med(p.map((x) => x.n))} trials)` : '');
    }).join('; '));
    out.push(`  Path rechecks: held ${S.path.rechecks.held}, reopened ${S.path.rechecks.failed}`);
  }
  if (run.mode === 'speed') {
    out.push(`  Speed: ${S.speed.sessions} sessions; in-time success after the first 10 trials ${line(S.speed)}`);
    check(S.speed.sessions > 0 && Math.abs(diff(S.speed)) <= 5, 'speed: deadline staircase holds success within ±5 points of target');
  }
  if (run.mode === 'threshold') {
    for (const [k, o] of Object.entries(S.thr)) {
      const e = o.err, bias = e.reduce((a, b) => a + b, 0) / e.length, rmse = Math.sqrt(e.reduce((a, b) => a + b * b, 0) / e.length);
      const unit = k === 'span-length' ? 'levels' : 'log10';
      const tol = k === 'span-length' ? 1 : 0.1;
      out.push(`  threshold ${k}: ${o.n} runs, bias ${bias.toFixed(3)}, RMSE ${rmse.toFixed(3)} ${unit}, within ±${tol}: ${pct(e.filter((x) => Math.abs(x) <= tol).length / e.length)} %, at a bound ${o.atBound}, ≥ 4 reversals ${pct(o.ok / o.n)} %`);
    }
  }
  if (run.mode === 'free') {
    out.push(`  Free play sessions: ${S.free.sessions}; sessions that changed a rating: ${S.free.changed}`);
    check(S.free.changed === 0, 'free: Free play never changes a rating');
  }
  if (S.check.n) {
    out.push(`  Spatial Checks: ${S.check.n}; probe 95 % intervals hold the true probe ability ${pct(S.check.cover.in / Math.max(1, S.check.cover.n))} % of ${S.check.cover.n}`);
    out.push('  composite outcome at the end: ' + Object.entries(S.check.outcomes).map(([k, v]) => `${k} ${pct(v / S.learners)} %`).join(', '));
    if (!run.transfer && !run.misspec) check((S.check.outcomes['beyond familiarity'] || 0) / S.learners <= 0.05, `${run.id}: "beyond familiarity" in at most 5 % of learners without transfer`);
  }
  if (S.guardKept) out.push(`  store guard round trip: engine fields kept ${S.guardKept.engineFields}; trial columns kept ${S.guardKept.trialColumns} of 10; probe rtMed kept ${S.guardKept.assessRtMed}; id@version names kept ${S.guardKept.idxNames}`);
  return { text: out.join('\n'), hard };
}

/* ---------------------------------------------------------------- main */

function storeGuard() {
  try {
    const env = createContext({ exercises: false, store: true, afterStore(PX) { /* engine fields registered below */ void PX; } });
    defineFixtures(env.PX);
    env.PX.engine.fields().forEach((f) => env.PX.core.store.field(f.key, f.def, f.fix));
    return (raw) => env.PX.core.store.guard(raw);
  } catch (e) {
    return null;
  }
}

const results = [];
let failed = 0;
const t0 = performance.now();
for (const run of RUNS) {
  if (only ? !only.has(run.id) : run.optional) continue;
  const { PX } = createContext({ exercises: false });
  defineFixtures(PX);
  const S = blankStats();
  S.guard = storeGuard();
  const ts = performance.now();
  for (let i = 0; i < N; i++) simLearner(PX, run, i, S);
  const r = report(run, S, (performance.now() - ts) / 1000);
  console.log(r.text);
  r.hard.forEach((h) => { if (!h.ok) { failed++; console.log('  FAILED: ' + h.what); } });
  results.push({ run: run.id, hard: r.hard, stats: { ...S, guard: undefined } });
}
console.log(`\n${failed ? 'FAILED: ' + failed + ' hard check(s)' : 'All hard checks passed'} (${((performance.now() - t0) / 1000).toFixed(0)} s)`);
const out = arg('json', '');
if (out) fs.writeFileSync(out, JSON.stringify(results, null, 1));
process.exit(failed ? 1 : 0);
