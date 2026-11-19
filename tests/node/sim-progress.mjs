#!/usr/bin/env node
/* PLAN milestone 7's acceptance simulation (run by hand; results in docs/dev/v1.2/progress-sim.md):
     node tests/node/sim-progress.mjs [--learners 200] [--days 90] [--profiles even,uneven,f09,sparse,corr]
       [--conds est,cur,oracle] [--exercises 3] [--style balanced] [--misspec] [--burn 200] [--seed 1]
       [--set dims.prior=0.75,dims.cap=1.1] [--json out.json]
   Learners of tests/node/fixtures/learner-progress.mjs (their own step per dimension, profiles even, uneven
   f = 0.5, f09, sparse, corr) train in Train mode for D days on the fixture exercises
   (tests/node/fixtures/exercises.mjs): each learner on --exercises of them (3 by default, drawn per learner,
   so every exercise collects hundreds of answers; 0 = all), 2–6 sessions a week of 10–30 minutes, breaks
   of 4–14 days, as in tests/node/sim.mjs.
   Conditions on the same learners and days: est (the engine with per-dimension offsets, leading and
   fluency items), cur (config.dims.on false: the engine before milestone 7), oracle (est with each
   session's fit replaced by the learner's true deviations, uncapped).
   Reported per profile and condition, on target and leading items after each exercise's first --burn
   answers: the share whose true success (without the day's noise and the switch cost) lies within ±0.10 of
   the target; the mean distance; success vs target; per dimension level (cells of ≥ 200 such items) the
   worst gap between success and target, observed and expected; 95 % coverage of the true ability at each
   session's end; fluency items in time vs their deadline target; offsets: error RMS in steps, the share
   at the cap per dimension (fitted) and of true deviations beyond the cap; the level share of each
   learner's strongest and weakest dimension; item kinds. The gates (PLAN milestone 7): uneven and even:
   ≥ 94 % within ±0.10, no level more than 5 points off, overall within ±1 point, coverage about 95 %
   (93–97 %), fluency within ±2 points of the deadline target. f09, sparse and corr are reported. */
import fs from 'node:fs';
import { performance } from 'node:perf_hooks';
import { createContext, MANIFEST } from './run.mjs';
import { defineFixtures } from './fixtures/exercises.mjs';
import { newRecord, playSession } from './fixtures/learner.mjs';
import { ProgressLearner, PROFILES } from './fixtures/learner-progress.mjs';

const DAY = 86400000;
const T0 = Date.UTC(2026, 10, 2, 0, 0, 0); // Monday 2 Nov 2026

function arg(name, def) {
  const i = process.argv.indexOf('--' + name);
  return i > 0 && process.argv[i + 1] !== undefined && !process.argv[i + 1].startsWith('--') ? process.argv[i + 1] : def;
}
const flag = (name) => process.argv.includes('--' + name);
const N = Math.max(1, parseInt(arg('learners', '200'), 10));
const DAYS = Math.max(7, parseInt(arg('days', '90'), 10));
const PROF = arg('profiles', 'even,uneven,f09,sparse').split(',');
const CONDS = arg('conds', 'est,cur').split(',');
const NEX = parseInt(arg('exercises', '3'), 10);
const STYLE = arg('style', 'balanced');
const BURN = parseInt(arg('burn', '200'), 10);
const SEED = arg('seed', '1');
const MISSPEC = flag('misspec');
const SETS = arg('set', '') ? arg('set', '').split(',').map((kv) => kv.split('=')) : [];
// Milestone 7 alone by default: the other wave-2 hooks (plateau changes, the bets' layers) stay out of the
// context, so est and cur differ only in it; --wave2 loads the whole engine.
const WAVE2 = flag('wave2');
const FILES = MANIFEST.filter((f) => WAVE2 || !/js\/engine\/(plateau|bets)\.js$/.test(f));

function configure(E, cond) {
  E.configure('reset');
  for (const [k, v] of SETS) {
    const [blk, key] = k.split('.'), val = v === 'true' ? true : v === 'false' ? false : isNaN(+v) ? v : +v;
    E.configure({ [blk]: { [key]: val } });
  }
  if (cond === 'cur') E.configure({ dims: { on: false } });
  if (cond === 'oracle') E.configure({ dims: { cap: 100 } }); // the true deviations, uncapped
}

function blank() {
  return {
    learners: 0, sessions: 0, items: 0, tgt: { n: 0, x: 0, t: 0, pt: 0, in10: 0, abs: 0 }, cells: new Map(), fcells: new Map(),
    feas: { n: 0, in10: 0, abs: 0, x: 0, t: 0 },
    byKind: {}, byEx: {}, covEx: {},
    cov: { n: 0, in: 0, z2: 0, bias: 0 }, covMid: { n: 0, in: 0, bias: 0 }, flu: { n: 0, x: 0, t: 0, nb: 0, xb: 0, tb: 0 }, kinds: {},
    sc: { lead: 0, flu: 0, leadIn: 0, fluIn: 0, tgt: 0, tgtIn: 0 }, // the scoped shortcut cells (E.dims.scoped): lead and fluency items stay off them
    off: { n: 0, err2: 0, capFit: {}, capTrue: {}, dimN: {} }, sw: { n: 0, strong: 0, weak: 0 }, errors: 0, deadEnds: 0,
    hooksErr: [],
  };
}

function simLearner(PX, cond, profile, i, S) {
  const E = PX.engine;
  const rng = PX.rng(PX.rng.hash('sim-progress-days', SEED, i));
  const L = new ProgressLearner(PX, PX.rng.hash('sim-progress', SEED, i), { profile, misspec: MISSPEC });
  const weekly = rng.int(2, 6), minutes = rng.pick([10, 15, 20, 20, 20, 30]);
  const rec = newRecord(PX, T0 - 3600e3, { weeklyGoal: weekly, sessionMin: minutes });
  rec.train.style = STYLE;
  const display = rng.chance(0.3) ? 'small' : 'large';
  const all = PX.ex.list('train').map((d) => d.id);
  const mine = NEX > 0 ? rng.shuffle(all).slice(0, NEX) : all;
  const can = (d) => mine.includes(d.id);
  const answers = {}; // rated untimed answers so far per exercise (the burn-in counter)
  const recent = {}; // the levels of each exercise's last 50 answered items (the centre for coverage without a state)
  const fluN = {};
  let breakUntil = -1;
  S.learners++;
  for (let d = 0; d < DAYS; d++) {
    if (d <= breakUntil) continue;
    if (d % 7 === 0 && d > 0 && rng.chance(0.12)) { breakUntil = d + rng.int(4, 14); continue; }
    if (!rng.chance(weekly / 7)) continue;
    let now = T0 + d * DAY + (17 + rng.int(0, 4)) * 3600e3 + rng.int(0, 59) * 60e3;
    const sessions = rng.chance(0.1) ? 2 : 1;
    for (let k = 0; k < sessions; k++) {
      const pending = [];
      const res = playSession(PX, rec, L, 'train', { now, display, can }, d, {
        respond(def, step) {
          let pt = null, reach = true;
          if (def.role === 'train') {
            pt = L.trueP(def, step, d);
            // could the pool reach the target for this learner now? (an item with this guessing rate whose
            // true success at the stable ability lies within ±0.05 of the target)
            reach = L.reaches(def, def.chance(step.params), step.target, L.thetaStable(def, d));
          }
          const out = L.respond(def, step, d, { stutterP: 0.01 });
          pending.push({ pt, reach });
          return out;
        },
      });
      now = res.now + 60e3;
      S.sessions++;
      if (res.deadEnd) S.deadEnds++;
      if (res.fin && res.fin.errors) { S.errors += res.fin.errors.length; if (S.hooksErr.length < 3) S.hooksErr.push(res.fin.errors[0]); }
      res.steps.forEach((s, j) => {
        S.items++;
        const st = s.step, out = s.out, def = PX.ex.get(st.exId);
        if (out.outcome > 1) return;
        S.kinds[st.kind] = (S.kinds[st.kind] || 0) + 1;
        if (E.dims && E.dims.isScoped) {
          const inS = E.dims.isScoped(def, st.params, st.seed) ? 1 : 0;
          if (st.kind === 'lead') { S.sc.lead++; S.sc.leadIn += inS; } else if (st.kind === 'fluency') { S.sc.flu++; S.sc.fluIn += inS; } else if (st.kind === 'target') { S.sc.tgt++; S.sc.tgtIn += inS; }
        }
        const x = out.outcome === 1 ? 1 : 0;
        if (st.kind === 'fluency') {
          const n0 = fluN[st.exId] = (fluN[st.exId] || 0) + 1, it = out.inTime ? 1 : 0;
          S.flu.n++; S.flu.x += it; S.flu.t += st.target;
          if (n0 > 10) { S.flu.nb++; S.flu.xb += it; S.flu.tb += st.target; }
          return;
        }
        const n0 = answers[st.exId] = (answers[st.exId] || 0) + 1;
        const rl = recent[st.exId] || (recent[st.exId] = []);
        rl.push(def.dims.map((dm) => st.params[dm.key] || 0));
        if (rl.length > 50) rl.shift();
        if ((st.kind !== 'target' && st.kind !== 'lead') || n0 <= BURN) return;
        const pt = pending[j].pt, reach = pending[j].reach;
        const T = S.tgt, inb = Math.abs(pt - st.target) <= 0.10 ? 1 : 0;
        T.n++; T.x += x; T.t += st.target; T.pt += pt; T.abs += Math.abs(pt - st.target); T.in10 += inb;
        const bk = S.byKind[st.kind] || (S.byKind[st.kind] = { n: 0, in10: 0, x: 0, t: 0 });
        bk.n++; bk.in10 += inb; bk.x += x; bk.t += st.target;
        const be = S.byEx[st.exId] || (S.byEx[st.exId] = { n: 0, in10: 0, x: 0, t: 0, fn: 0, fin10: 0 });
        be.n++; be.in10 += inb; be.x += x; be.t += st.target;
        if (reach) { be.fn++; be.fin10 += inb; }
        const feasible = reach; // the pool holds items at the target for this learner (truth, not the engine's belief)
        if (feasible) { const F = S.feas; F.n++; F.in10 += inb; F.abs += Math.abs(pt - st.target); F.x += x; F.t += st.target; }
        def.dims.forEach((dm) => {
          if (dm.levels.length < 2) return;
          const key = st.exId + '.' + dm.key + '=' + st.params[dm.key];
          for (const [map, ok] of [[S.cells, true], [S.fcells, feasible]]) {
            if (!ok) continue;
            const c = map.get(key) || { n: 0, x: 0, t: 0, pt: 0 };
            c.n++; c.x += x; c.t += st.target; c.pt += pt;
            map.set(key, c);
          }
        });
        // the level share of the learner's strongest and weakest dimension (in steps)
        const w = L.weights(def).filter((q) => q.on);
        if (w.length >= 2) {
          const steps = def.dims.map((dm) => Math.abs(dm.step || 0));
          let si = null, wi = null;
          def.dims.forEach((dm, di) => {
            const q = w.find((v) => v.key === dm.key);
            if (!q) return;
            const rel = q.z / steps[di];
            if (si === null || rel < L.weights(def)[si].z / steps[si]) si = di;
            if (wi === null || rel > L.weights(def)[wi].z / steps[wi]) wi = di;
          });
          if (si !== null && wi !== null && si !== wi) {
            S.sw.n++;
            S.sw.strong += st.params[def.dims[si].key] / (def.dims[si].levels.length - 1);
            S.sw.weak += st.params[def.dims[wi].key] / (def.dims[wi].levels.length - 1);
          }
        }
      });
      // coverage at the session's end, per exercise answered (true ability with the day's noise, as sim.mjs):
      // the rating holds the ability at the centre of the offsets (state.c; without a state, the mean level
      // of the last 50 items), θ_c = θ_mid − Σ z_d (c_d − mid_d); θ at the middle reported beside it
      for (const id of Object.keys(res.plan.rated || {})) {
        const def = PX.ex.get(id), st = E.est.get(rec, def, { display }), thMid = L.theta(def, d);
        const ds = E.dims.state(rec, def, display), rl = recent[id] || [];
        const cen = def.dims.map((dm, di) => (ds && ds.c && ds.c[di] !== null ? ds.c[di] : rl.length ? rl.reduce((a, r) => a + r[di], 0) / rl.length : (dm.levels.length - 1) / 2));
        const th = thMid - L.offset(def, Object.fromEntries(def.dims.map((dm, di) => [dm.key, cen[di]])));
        const z = (st.mu - th) / st.sd, zm = (st.mu - thMid) / st.sd;
        S.cov.n++; S.cov.z2 += z * z; S.cov.bias += st.mu - th;
        if (Math.abs(z) <= 1.96) S.cov.in++;
        S.covMid.n++; S.covMid.bias += st.mu - thMid; if (Math.abs(zm) <= 1.96) S.covMid.in++;
        const ce = S.covEx[id] || (S.covEx[id] = { n: 0, in: 0, bias: 0 });
        ce.n++; ce.bias += st.mu - th; if (Math.abs(z) <= 1.96) ce.in++;
      }
      if (cond === 'oracle') {
        for (const id of mine) {
          const def = PX.ex.get(id), s = E.dims.state(rec, def, display);
          if (!s) continue;
          const host = def.perDisplay && display === 'small' ? rec.ex[id].small : rec.ex[id];
          host.dims.o = L.weights(def).map((q) => (q.on ? q.z : null));
          host.dims.n = Math.max(host.dims.n, E.config.dims.from);
        }
      }
    }
  }
  // offsets at the end against the truth
  for (const id of mine) {
    const def = PX.ex.get(id), s = E.dims.state(rec, def, display), w = L.weights(def);
    if (!s || !s.active) continue;
    w.forEach((q, di) => {
      if (!q.on) return;
      const key = id + '.' + q.key, step = Math.abs(def.dims[di].step);
      S.off.n++; S.off.err2 += ((s.o[di] - q.z) / step) ** 2;
      S.off.dimN[key] = (S.off.dimN[key] || 0) + 1;
      if (s.cap[di] === 1) S.off.capFit[key] = (S.off.capFit[key] || 0) + 1;
      if (Math.abs(q.z) > E.dims._.capStep(def, E.dims._.info(def).dims[di]) + 1e-12) S.off.capTrue[key] = (S.off.capTrue[key] || 0) + 1;
    });
  }
}

const pct = (x) => (100 * x).toFixed(1);

function worstOf(cells) {
  let worst = 0, worstKey = '', worstE = 0, worstEKey = '', rms = 0, w = 0, cellsN = 0;
  const all = [];
  for (const [k, c] of cells) {
    if (c.n < 200) continue;
    cellsN++;
    const d = (c.x - c.t) / c.n, de = (c.pt - c.t) / c.n;
    rms += c.n * d * d; w += c.n;
    all.push([k, d, de, c.n]);
    if (Math.abs(d) > Math.abs(worst)) { worst = d; worstKey = k; }
    if (Math.abs(de) > Math.abs(worstE)) { worstE = de; worstEKey = k; }
  }
  all.sort((a, b) => Math.abs(b[1]) - Math.abs(a[1]));
  return { worst, worstKey, worstE, worstEKey, rms: w ? Math.sqrt(rms / w) : NaN, cellsN, top: all.slice(0, 6).map((x) => `${x[0]} ${(100 * x[1]).toFixed(1)}/${(100 * x[2]).toFixed(1)} (${x[3]})`) };
}

function summarise(S) {
  const T = S.tgt;
  const all = worstOf(S.cells), fz = worstOf(S.fcells);
  const worst = all.worst, worstKey = all.worstKey, worstE = all.worstE, worstEKey = all.worstEKey, cellsN = all.cellsN;
  const capFit = Object.keys(S.off.dimN).map((k) => [k, (S.off.capFit[k] || 0) / S.off.dimN[k], (S.off.capTrue[k] || 0) / S.off.dimN[k]]);
  return {
    learners: S.learners, sessions: S.sessions, items: S.items, targets: T.n,
    in10: T.n ? T.in10 / T.n : NaN, meanAbs: T.n ? T.abs / T.n : NaN,
    feasShare: T.n ? S.feas.n / T.n : NaN, fIn10: S.feas.n ? S.feas.in10 / S.feas.n : NaN, fMeanAbs: S.feas.n ? S.feas.abs / S.feas.n : NaN,
    fDiff: S.feas.n ? (S.feas.x - S.feas.t) / S.feas.n : NaN,
    success: T.n ? T.x / T.n : NaN, target: T.n ? T.t / T.n : NaN, expected: T.n ? T.pt / T.n : NaN,
    worstObs: worst, worstObsKey: worstKey, worstExp: worstE, worstExpKey: worstEKey, cells: cellsN, rmsObs: all.rms,
    fWorstObs: fz.worst, fWorstObsKey: fz.worstKey, fWorstExp: fz.worstE, fWorstExpKey: fz.worstEKey, fCells: fz.cellsN, fTop: fz.top,
    byKind: Object.fromEntries(Object.entries(S.byKind).map(([k, v]) => [k, { n: v.n, in10: v.in10 / v.n, diff: (v.x - v.t) / v.n }])),
    byEx: Object.fromEntries(Object.entries(S.byEx).map(([k, v]) => [k, { n: v.n, in10: v.in10 / v.n, diff: (v.x - v.t) / v.n, feas: v.fn / v.n, fin10: v.fn ? v.fin10 / v.fn : NaN }])),
    covEx: Object.fromEntries(Object.entries(S.covEx).map(([k, v]) => [k, { n: v.n, cov: v.in / v.n, bias: v.bias / v.n }])),
    coverage: S.cov.n ? S.cov.in / S.cov.n : NaN, rmsZ: S.cov.n ? Math.sqrt(S.cov.z2 / S.cov.n) : NaN, bias: S.cov.n ? S.cov.bias / S.cov.n : NaN,
    coverageMid: S.covMid.n ? S.covMid.in / S.covMid.n : NaN, biasMid: S.covMid.n ? S.covMid.bias / S.covMid.n : NaN,
    flu: { n: S.flu.n, inTime: S.flu.n ? S.flu.x / S.flu.n : NaN, target: S.flu.n ? S.flu.t / S.flu.n : NaN, nb: S.flu.nb, inTimeB: S.flu.nb ? S.flu.xb / S.flu.nb : NaN, targetB: S.flu.nb ? S.flu.tb / S.flu.nb : NaN },
    offRms: S.off.n ? Math.sqrt(S.off.err2 / S.off.n) : NaN, sc: S.sc,
    capMaxFit: capFit.length ? Math.max(...capFit.map((x) => x[1])) : 0, capMaxFitKey: (capFit.sort((a, b) => b[1] - a[1])[0] || [''])[0],
    capFit: Object.fromEntries(capFit.map((x) => [x[0], [Number(x[1].toFixed(3)), Number(x[2].toFixed(3))]])),
    strongShare: S.sw.n ? S.sw.strong / S.sw.n : NaN, weakShare: S.sw.n ? S.sw.weak / S.sw.n : NaN,
    kinds: S.kinds, errors: S.errors, hookErrors: S.hooksErr, deadEnds: S.deadEnds,
  };
}

function line(p, c, r) {
  return `${p.padEnd(7)} ${c.padEnd(6)} targets ${String(r.targets).padStart(7)}: where the pool reaches the target (${pct(r.feasShare)} %): within ±0.10 ${pct(r.fIn10)} %, ` +
    `mean |p − target| ${pct(r.fMeanAbs)} pts, success − target ${(100 * r.fDiff).toFixed(1)}; all: within ±0.10 ${pct(r.in10)} %, mean |p − target| ${pct(r.meanAbs)} pts; ` +
    `success ${pct(r.success)} vs target ${pct(r.target)} (${(100 * (r.success - r.target)).toFixed(1)}; expected ${(100 * (r.expected - r.target)).toFixed(1)}); ` +
    `worst level obs ${(100 * r.worstObs).toFixed(1)} (${r.worstObsKey}), exp ${(100 * r.worstExp).toFixed(1)} (${r.worstExpKey}), rms ${(100 * r.rmsObs).toFixed(1)} over ${r.cells} cells; ` +
    `where the pool reaches the target: obs ${(100 * r.fWorstObs).toFixed(1)} (${r.fWorstObsKey}), exp ${(100 * r.fWorstExp).toFixed(1)} (${r.fWorstExpKey}) over ${r.fCells}; ` +
    `coverage ${pct(r.coverage)} % (rms z ${r.rmsZ.toFixed(2)}, bias ${r.bias.toFixed(3)}; of θ at the middle ${pct(r.coverageMid)} %, bias ${r.biasMid.toFixed(3)}); fluency ${r.flu.n} in time ${pct(r.flu.inTime)} vs ${pct(r.flu.target)} ` +
    `(after 10: ${pct(r.flu.inTimeB)} vs ${pct(r.flu.targetB)}); offsets rms ${isNaN(r.offRms) ? '–' : r.offRms.toFixed(2)} steps, most at the cap ${pct(r.capMaxFit)} % (${r.capMaxFitKey}); ` +
    `levels strongest/weakest dim ${r.strongShare.toFixed(2)}/${r.weakShare.toFixed(2)}` + (r.errors ? `; HOOK ERRORS ${r.errors} ${JSON.stringify(r.hookErrors)}` : '') + (r.deadEnds ? `; dead ends ${r.deadEnds}` : '');
}

const results = [];
const t0 = performance.now();
console.log(`sim-progress: ${N} learners × ${DAYS} days, ${NEX || 'all'} exercises each, style ${STYLE}, burn-in ${BURN}, seed ${SEED}${MISSPEC ? ', misspecified items' : ''}${SETS.length ? ', set ' + SETS.map((x) => x.join('=')).join(',') : ''}; engine files: ${FILES.filter((f) => f.startsWith('js/engine/')).map((f) => f.slice(10, -3)).join(' ')}`);
for (const p of PROF) {
  if (!PROFILES[p]) { console.log('unknown profile ' + p); continue; }
  for (const c of CONDS) {
    const { PX } = createContext({ exercises: false, files: FILES });
    defineFixtures(PX);
    configure(PX.engine, c);
    const S = blank(), ts = performance.now();
    for (let i = 0; i < N; i++) simLearner(PX, c, p, i, S);
    const r = summarise(S);
    console.log(line(p, c, r) + ` [${((performance.now() - ts) / 1000).toFixed(0)} s]`);
    if (c === 'est' && (p === 'even' || p === 'uneven')) {
      // the plan's gates (PLAN milestone 7): uneven and even learners
      const g = [
        [r.fIn10 >= 0.94, `≥ 94 % of target items within ±0.10 of the true edge where the pool reaches it: ${pct(r.fIn10)} %`],
        [Math.abs(r.fWorstObs) <= 0.05, `no dimension level more than 5 points off (observed, cells of ≥ 200 items where the pool reaches the target): worst ${(100 * r.fWorstObs).toFixed(1)} (${r.fWorstObsKey}); expected ${(100 * r.fWorstExp).toFixed(1)}`],
        [Math.abs(r.success - r.target) <= 0.01, `overall success within ±1 point of target: ${(100 * (r.success - r.target)).toFixed(1)}`],
        [r.coverage >= 0.93 && r.coverage <= 0.97, `about 95 % coverage (93–97 %, as tests/node/sim.mjs): ${pct(r.coverage)} %`],
        [r.sc.leadIn + r.sc.fluIn === 0, `no leading or fluency item in a scoped shortcut cell (E.dims.scoped): ${r.sc.leadIn} of ${r.sc.lead} leading, ${r.sc.fluIn} of ${r.sc.flu} fluency (target items there: ${r.sc.tgtIn} of ${r.sc.tgt})`],
        [Math.abs(r.flu.inTimeB - r.flu.targetB) <= 0.02, `fluency items in time within ±2 points of their deadline target (after each exercise's first 10): ${pct(r.flu.inTimeB)} vs ${pct(r.flu.targetB)}`],
      ];
      g.forEach(([ok, what]) => console.log(`    gate ${ok ? 'PASS' : 'FAIL'}: ${what}`));
      r.gates = g.map(([ok, what]) => ({ ok, what }));
    }
    if (flag('detail')) {
      console.log('    by kind: ' + Object.entries(r.byKind).map(([k, v]) => `${k} ${v.n} in ±0.10 ${pct(v.in10)} % (${(100 * v.diff).toFixed(1)})`).join('; '));
      console.log('    by exercise (feasible share, within ±0.10 there, all, success − target): ' + Object.entries(r.byEx).sort().map(([k, v]) => `${k} ${pct(v.feas)} ${pct(v.fin10)} ${pct(v.in10)} (${(100 * v.diff).toFixed(1)})`).join('; '));
      console.log('    coverage by exercise: ' + Object.entries(r.covEx).sort().map(([k, v]) => `${k} ${pct(v.cov)} % (${v.bias.toFixed(2)})`).join('; '));
      console.log('    worst levels where the pool reaches the target (observed/expected, items): ' + r.fTop.join('; '));
      console.log('    at the cap (fitted, true beyond): ' + Object.entries(r.capFit).filter(([, v]) => v[0] > 0.05 || v[1] > 0.05).map(([k, v]) => `${k} ${pct(v[0])}/${pct(v[1])}`).join('; '));
    }
    results.push({ profile: p, cond: c, ...r });
  }
}
console.log(`done in ${((performance.now() - t0) / 1000).toFixed(0)} s`);
const out = arg('json', '');
if (out) fs.writeFileSync(out, JSON.stringify({ args: process.argv.slice(2), results }, null, 1));
