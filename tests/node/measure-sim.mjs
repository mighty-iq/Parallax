#!/usr/bin/env node
/* Measurement simulation for PLAN milestone 6 (and the crossover power of milestone 4: --crossover), run by
   hand, never by run.mjs:  node tests/node/measure-sim.mjs [--n 1000] [--seed 1] [--runs id,id,…]
   [--json out.json] [--trend js/engine/trend.js] [--list] [--crossover] [--players 2000]

   Each run plays N simulated learners per arm through Design A (baselines B1 and B2, a no-feedback block at the
   start of every later session, at most four a week, a 10-minute check every 28 days; optionally the opt-in
   measurement week), with the probe learner model of tests/node/measure-lib.mjs, and fits js/engine/trend.js
   after every occasion (the meter; targeting of the next block). Verdict words come at the milestones of the
   trend model (days 14, 28, 56). Arms: 'none' (no real gain), 'gain' (0.5 SD_comp on every spatial probe at
   day 28, then holding), 'ladder' (near 1.0, mid 0.5, far 0.2 per-probe SD).
   Reported per run and arm at weeks 2, 4, 6 and 8: "likely gain" at the milestone (and ever so far), "likely no
   change", the detectable gain MDG = 1.898 × the median posterior SD of the gain to date, coverage of the 95 %
   interval of the gain to date, the mean and SD of (estimate − truth)/SD, the meter's highest value between
   milestones, minutes of measurement a week and items stored. Hard checks (exit code 1), PLAN milestone 6:
   false "likely gain" ≤ 5 % at each report and ≤ 6 % ever through week 8 (central runs), ≤ 10 % at each report
   under misspecified familiarity, coverage 92–98 %. Results: docs/dev/v1.2/measure-sim.md. */
import fs from 'node:fs';
import { performance } from 'node:perf_hooks';
import { createContext, MANIFEST } from './run.mjs';
import { DAY, SEC_PER_ITEM, PROBES, sigmaFor, hashSeed, schedule, itemsOf, simulateLearner, itemParams, infoAtK } from './measure-lib.mjs';
import { crossover } from './measure-cross.mjs';

const argv = process.argv.slice(2);
const arg = (k, d) => { const i = argv.indexOf('--' + k); return i >= 0 && argv[i + 1] !== undefined ? argv[i + 1] : d; };
const N = parseInt(arg('n', '1000'), 10), SEED = parseInt(arg('seed', '1'), 10);
const TREND = arg('trend', 'js/engine/trend.js');
const env = createContext({ files: [...MANIFEST.filter((f) => f !== TREND), TREND], exercises: false });
if (env.loadErrors.length) { console.error(env.loadErrors.join('\n')); process.exit(2); }
const T = env.PX.engine.trend;

/* ---------- truth and model ---------- */
const ST = 0.5 / Math.SQRT2;
const TRUTH = { sigma: sigmaFor(0.75), rho: 0.4, famMu: 0.5, famSd: 0.2, famRFF: 0.5, famRFc: 0.3, famMuC: 0.3, lambda: 16,
  tail: 0.03, tailC: 0.018, tailSd: 0.02, stateU: ST, stateS: ST, itemNoise: 0.3, breakLoss: 0.45, optimistic: false };
const LADDER = ['otherway', 'cubematch', 'viewmatch', 'patterns', 'mechanisms', 'motiongraphs'];
const CLASSIC = ['cubematch', 'viewmatch', 'mechanisms', 'patterns'];
const DESIGNS = {
  classic: { classic: true, probes: CLASSIC, control: 'wordlinks', base: 8, ctrlBase: 8, block: { all: 3, ctrl: 2 } },
  classicWeek: { classic: true, probes: CLASSIC, control: 'wordlinks', base: 8, ctrlBase: 8, block: { all: 3, ctrl: 2 }, week: { items: 8, ctrl: 4 } },
  // the ladder: near 1 probe, mid 3, far 2; rotation within rungs keeps blocks at 3.5–4.5 minutes
  L14: { probes: LADDER, control: 'wordlinks', base: 6, ctrlBase: 6, block: { near: 3, mid: 3, far: 3, ctrl: 2 }, rotate: { mid: 2, far: 1 } },
  L15: { probes: LADDER, control: 'wordlinks', base: 6, ctrlBase: 6, block: { near: 4, mid: 3, far: 3, ctrl: 2 }, rotate: { mid: 2, far: 1 } },
  L18: { probes: LADDER, control: 'wordlinks', base: 6, ctrlBase: 6, block: { near: 4, mid: 4, far: 4, ctrl: 2 }, rotate: { mid: 2, far: 1 } },
  L14all: { probes: LADDER, control: 'wordlinks', base: 6, ctrlBase: 6, block: { near: 2, mid: 2, far: 2, ctrl: 2 } },
  L20all: { probes: LADDER, control: 'wordlinks', base: 6, ctrlBase: 6, block: { near: 3, mid: 3, far: 3, ctrl: 2 } },
  // near-heavy candidates (the scan's lever: the near probe's baseline is its bottleneck)
  N16: { probes: LADDER, control: 'wordlinks', base: 6, ctrlBase: 6, baseBy: { otherway: 16 }, block: { near: 6, mid: 3, far: 2, ctrl: 2 }, rotate: { mid: 2, far: 1 } },
  N15: { probes: LADDER, control: 'wordlinks', base: 6, ctrlBase: 6, baseBy: { otherway: 12 }, block: { near: 5, mid: 3, far: 2, ctrl: 2 }, rotate: { mid: 2, far: 1 } },
  N14: { probes: LADDER, control: 'wordlinks', base: 5, ctrlBase: 5, baseBy: { otherway: 16 }, block: { near: 6, mid: 2, far: 2, ctrl: 2 }, rotate: { mid: 2, far: 1 } },
  N14level: { probes: [...LADDER, 'level'], control: 'wordlinks', base: 5, ctrlBase: 5, baseBy: { otherway: 16, level: 8 }, block: { near: 6, mid: 2, far: 2, ctrl: 2 }, rotate: { mid: 2, far: 1 } },
  N14week: { probes: LADDER, control: 'wordlinks', base: 5, ctrlBase: 5, baseBy: { otherway: 16 }, block: { near: 6, mid: 2, far: 2, ctrl: 2 }, rotate: { mid: 2, far: 1 },
    week: { items: 6, ctrl: 4 }, weekRotate: { mid: 2, far: 1 } },
  N16week: { probes: LADDER, control: 'wordlinks', base: 6, ctrlBase: 6, baseBy: { otherway: 16 }, block: { near: 6, mid: 3, far: 2, ctrl: 2 }, rotate: { mid: 2, far: 1 },
    week: { items: 8, ctrl: 4 }, weekRotate: { mid: 2, far: 1 } },
  L15b8: { probes: LADDER, control: 'wordlinks', base: 8, ctrlBase: 8, block: { near: 4, mid: 3, far: 3, ctrl: 2 }, rotate: { mid: 2, far: 1 } },
  L15week: { probes: LADDER, control: 'wordlinks', base: 6, ctrlBase: 6, block: { near: 4, mid: 3, far: 3, ctrl: 2 }, rotate: { mid: 2, far: 1 },
    week: { items: 8, ctrl: 4 }, weekRotate: { mid: 2, far: 1 } },
};
const CLASSIC_PROBES = { cubematch: 'all', viewmatch: 'all', mechanisms: 'all', patterns: 'all', wordlinks: 'control' };
function modelFor(design, truth, over = {}) {
  const m = { sd: { logits: truth.sigma }, rho: truth.rho, probes: { otherwayA: 'near', otherwayB: 'near' } };
  if (design.classic) { m.probes = CLASSIC_PROBES; m.composite = { rungs: ['all'], weights: 'probe' }; }
  if (arg('gainprior', '') !== '') m.gain = { priorSd: parseFloat(arg('gainprior', '0')) };
  return deep(m, over);
}
function deep(a, b) { const o = JSON.parse(JSON.stringify(a)); for (const k of Object.keys(b)) o[k] = b[k] && typeof b[k] === 'object' && !Array.isArray(b[k]) && o[k] && typeof o[k] === 'object' ? deep(o[k], b[k]) : b[k]; return o; }
const sdCompOf = (design, rho) => { const n = design.probes.filter((id) => design.classic || PROBES[id].rung !== 'alone').length; return Math.sqrt((1 + (n - 1) * rho) / n); };

/* ---------- scenarios: changes to the truth (and model) ---------- */
const SCEN = {
  central: {},
  optimistic: { truth: { optimistic: true, sigma: sigmaFor(0.85) } },
  fixturePop: { truth: { sigma: 0.73, rho: 0.33 } },
  famBig: { truth: { famMu: 0.8 } },                                      // plateau 0.8 under the 0.65 prior
  tail6: { truth: { tail: 0.06, tailC: 0.036 } },                         // tail twice the central truth (M1 A.5)
  tail9: { truth: { tail: 0.09, tailC: 0.054 } },                         // tail twice the shipped prior (PLAN wording)
  tail15: { truth: { tail: 0.15, tailC: 0.09 } },                         // Terlecki's inexperienced group (reported only)
  stateWrong: { truth: { stateU: 0.7 / Math.SQRT2, stateS: 0.7 / Math.SQRT2 } }, // state 0.7, model 0.5
  perWeek2: { perWeek: 2 }, perWeek6: { perWeek: 6 },
  hLinearModel: { hModel: 'linear' },                                     // truth follows the curve, model assumes linear days
  break45: { breakFrom: 28, breakTo: 91, horizon: 147 },                  // 9-week break after week 4; truth loses 45 %
  break25: { breakFrom: 28, breakTo: 91, horizon: 147, truth: { breakLoss: 0.25 } },
  break65: { breakFrom: 28, breakTo: 91, horizon: 147, truth: { breakLoss: 0.65 } },
};

/* ---------- runs ---------- */
const R = (id, design, scen, extra = {}) => ({ id, design, scen, ...extra });
const RUNS = [
  // cross-check with the M1 spike (its block summaries, linear h, its conventions): note M1 A.5's expected values
  R('spike-check', 'classic', 'central', { mode: 'summary', hShape: 'linear', check: 'false' }),
  // the classic four-probe composite of decision 2 (today's probes), with the trend model on items
  R('classic', 'classic', 'central', { check: 'false' }),
  R('classic-week', 'classicWeek', 'central', { check: 'false' }),
  R('classic-opt', 'classic', 'optimistic', { check: 'false' }),
  R('classic-famBig', 'classic', 'famBig', { check: 'misspec' }),
  R('classic-tail6', 'classic', 'tail6', { check: 'misspec' }),
  // the ladder: mixes (rotation within rungs) and the references without rotation
  R('L15', 'L15', 'central', { arms: ['none', 'gain', 'ladder'], check: 'false' }),
  R('N16', 'N16', 'central', { arms: ['none', 'gain', 'ladder'], check: 'false' }),
  R('L14all', 'L14all', 'central', { arms: ['none', 'gain', 'ladder'] }),
  R('L20all', 'L20all', 'central', { arms: ['none', 'gain', 'ladder'] }),
  // the chosen mix (N14) and its stress tests
  R('N14', 'N14', 'central', { arms: ['none', 'gain', 'ladder'], check: 'false' }),
  R('N14-week', 'N14week', 'central', { arms: ['none', 'gain', 'ladder'], check: 'false' }),
  R('N14-opt', 'N14', 'optimistic', { arms: ['none', 'gain', 'ladder'], check: 'false' }),
  R('N14-level', 'N14level', 'central', { arms: ['none', 'ladder'], check: 'false' }),
  R('N14-famBig', 'N14', 'famBig', { check: 'misspec' }),
  R('N14-tail6', 'N14', 'tail6', { check: 'misspec' }),
  R('N14-tail9', 'N14', 'tail9', { check: 'misspec' }),
  R('N14-tail15', 'N14', 'tail15'),
  R('N14-stateWrong', 'N14', 'stateWrong'),
  R('N14-fixturePop', 'N14', 'fixturePop'),
  R('N14-perWeek2', 'N14', 'perWeek2', { check: 'false' }),
  R('N14-perWeek6', 'N14', 'perWeek6', { check: 'false' }),
  R('N14-hLinear', 'N14', 'hLinearModel'),
  R('N14-break45', 'N14', 'break45', { arms: ['none', 'gain'], reports: [14, 28, 98, 112, 140] }),
  R('N14-break25', 'N14', 'break25', { arms: ['none'], reports: [14, 28, 98, 112, 140] }),
  R('N14-break65', 'N14', 'break65', { arms: ['none'], reports: [14, 28, 98, 112, 140] }),
];

function specOf(run, arm) {
  const sc = SCEN[run.scen], design = DESIGNS[run.design];
  const truth = { ...TRUTH, ...(sc.truth || {}) };
  const horizon = sc.horizon || 56;
  return {
    design, truth, arm, gainSD: 0.5, sdComp: sdCompOf(design, truth.rho), perWeek: sc.perWeek || 3, horizon,
    breakFrom: sc.breakFrom, breakTo: sc.breakTo, mode: run.mode || 'items', hShape: run.hShape || 'curve', hModel: sc.hModel,
    reports: run.reports || [14, 28, 42, 56], lastMilestone: horizon,
    model: modelFor(design, truth, sc.model || {}),
  };
}

/* ---------- aggregation ---------- */
const pct = (x, n) => (n ? (100 * x / n) : NaN);
const median = (a) => { const s = [...a].sort((x, y) => x - y); return s.length ? (s.length % 2 ? s[(s.length - 1) / 2] : (s[s.length / 2 - 1] + s[s.length / 2]) / 2) : NaN; };
function aggregate(results, spec) {
  const out = { reports: {}, verdicts: {}, ever: {}, meter95: 0, minutesPerWeek: 0, items: median(results.map((r) => r.items)),
    fitsPerLearner: median(results.map((r) => r.fits)), itersPerFit: results.reduce((s, r) => s + r.iters, 0) / results.reduce((s, r) => s + r.fits, 0),
    unconverged: results.reduce((s, r) => s + r.unconverged, 0) };
  const n = results.length;
  for (const day of spec.reports) {
    const rd = {};
    const keys = results[0].reports[day] ? Object.keys(results[0].reports[day]) : [];
    for (const k of keys) {
      const xs = results.map((r) => r.reports[day] && r.reports[day][k]).filter(Boolean);
      const z = xs.map((x) => (x.mean - x.truth) / x.sd);
      const zm = z.reduce((s, v) => s + v, 0) / z.length, zs = Math.sqrt(z.reduce((s, v) => s + (v - zm) ** 2, 0) / Math.max(1, z.length - 1));
      rd[k] = { n: xs.length, mdg: 1.898 * median(xs.map((x) => x.sd)), cover: pct(z.filter((v) => Math.abs(v) <= 1.959964).length, z.length), zMean: zm, zSd: zs,
        p95: pct(xs.filter((x) => x.p >= 0.95).length, xs.length), truth: median(xs.map((x) => x.truth)) };
    }
    out.reports[day] = rd;
  }
  const mdays = [...new Set(results.flatMap((r) => Object.keys(r.verdicts).map(Number)))].sort((a, b) => a - b);
  const everSoFar = {};
  for (const md of mdays) {
    const v = {}, e = {};
    const keys = Object.keys(results.find((r) => r.verdicts[md]).verdicts[md].words);
    for (const k of keys) {
      const words = results.map((r) => r.verdicts[md] && r.verdicts[md].words[k]);
      everSoFar[k] = everSoFar[k] || results.map(() => false);
      words.forEach((w, i) => { if (w === 'likely gain') everSoFar[k][i] = true; });
      v[k] = { gain: pct(words.filter((w) => w === 'likely gain').length, n), none: pct(words.filter((w) => w === 'likely no change').length, n),
        n: words.filter(Boolean).length };
      e[k] = pct(everSoFar[k].filter(Boolean).length, n);
    }
    // any readout reading "likely gain" (the multiplicity of showing words per rung)
    const anyNow = results.filter((r) => r.verdicts[md] && Object.values(r.verdicts[md].words).includes('likely gain')).length;
    v.any = { gain: pct(anyNow, n) };
    out.verdicts[md] = v; out.ever[md] = e;
  }
  out.meter95 = pct(results.filter((r) => r.meterMax >= 0.95).length, n);
  const sched = schedule(spec.design, spec), H = spec.horizon;
  const items = sched.filter((o) => o.day <= H).reduce((s, o) => s + itemsOf(o), 0);
  out.minutesPerWeek = items * SEC_PER_ITEM / 60 / ((H + 1) / 7);
  out.minutes4 = sched.filter((o) => o.day <= 28).reduce((s, o) => s + itemsOf(o), 0) * SEC_PER_ITEM / 60;
  out.minutes8 = sched.filter((o) => o.day <= 56).reduce((s, o) => s + itemsOf(o), 0) * SEC_PER_ITEM / 60;
  out.blockMinutes = Math.max(...sched.filter((o) => o.kind === 'block').map((o) => itemsOf(o) * SEC_PER_ITEM / 60), 0);
  return out;
}

/* ---------- main ---------- */
function runOne(run) {
  const arms = run.arms || ['none', 'gain'], res = { id: run.id, design: run.design, scen: run.scen, mode: run.mode || 'items', arms: {} };
  const t0 = performance.now();
  for (const arm of arms) {
    const spec = specOf(run, arm);
    T.configure('reset'); T.configure(spec.model);
    const results = [];
    for (let i = 0; i < N; i++) results.push(simulateLearner(T, spec, hashSeed('measure-sim', SEED, run.design, run.scen, run.mode || 'items', run.hShape || 'curve', arm, i)));
    res.arms[arm] = aggregate(results, spec);
  }
  T.configure('reset');
  res.seconds = (performance.now() - t0) / 1000;
  res.checks = checksOf(run, res);
  return res;
}

function checksOf(run, res) {
  const out = [], none = res.arms.none;
  if (!none) return out;
  const md = Object.keys(none.verdicts).map(Number).filter((d) => d <= 56);
  if (run.check === 'false' || run.check === 'misspec') {
    const lim = run.check === 'false' ? 5 : 10;
    for (const d of md) out.push({ what: `false "likely gain" (composite) at day ${d} ≤ ${lim} %`, value: none.verdicts[d].comp.gain, pass: none.verdicts[d].comp.gain <= lim });
    if (run.check === 'false' && md.length) { const d = Math.max(...md); out.push({ what: 'false "likely gain" ever through day ' + d + ' ≤ 6 %', value: none.ever[d].comp, pass: none.ever[d].comp <= 6 }); }
  }
  if (run.check === 'false') for (const arm of Object.keys(res.arms)) for (const d of [28, 56]) {
    const r = res.arms[arm].reports[d] && res.arms[arm].reports[d].comp;
    if (r) out.push({ what: `coverage (composite, ${arm}) at day ${d} in 92–98 %`, value: r.cover, pass: r.cover >= 92 && r.cover <= 98 });
  }
  return out;
}

function fmtRun(res) {
  const L = [];
  L.push(`\n== ${res.id}  (design ${res.design}, scenario ${res.scen}, ${res.mode}; ${N} learners per arm; ${res.seconds.toFixed(0)} s)`);
  for (const [arm, a] of Object.entries(res.arms)) {
    L.push(`  arm ${arm}: ${a.minutesPerWeek.toFixed(1)} min/week (to day 28: ${a.minutes4.toFixed(0)} min, day 56: ${a.minutes8.toFixed(0)} min; longest block ${a.blockMinutes.toFixed(2)} min); items stored ${a.items}; fits ${a.fitsPerLearner}, ${a.itersPerFit.toFixed(1)} iterations each, ${a.unconverged} unconverged; meter ≥ 0.95 between milestones ${a.meter95.toFixed(1)} %`);
    for (const [d, v] of Object.entries(a.verdicts)) {
      L.push(`    milestone day ${d}: ` + Object.entries(v).filter(([k]) => k !== 'any').map(([k, x]) => `${k} likely gain ${x.gain.toFixed(1)} % (ever ${a.ever[d][k].toFixed(1)}) no change ${x.none.toFixed(1)} %`).join(' | ') + ` | any readout ${v.any.gain.toFixed(1)} %`);
    }
    for (const [d, v] of Object.entries(a.reports)) {
      L.push(`    report day ${d}: ` + Object.entries(v).map(([k, x]) => `${k} MDG ${x.mdg.toFixed(2)} cover ${x.cover.toFixed(1)} z ${x.zMean.toFixed(2)}/${x.zSd.toFixed(2)} P≥.95 ${x.p95.toFixed(1)} % truth ${x.truth.toFixed(2)}`).join(' | '));
    }
  }
  for (const c of res.checks) L.push(`  ${c.pass ? 'PASS' : 'FAIL'} ${c.what}: ${c.value.toFixed(1)}`);
  return L.join('\n');
}

/* ---------- analytic scan: the posterior SD of the gain with ideal items (independent of the answers) ---------- */
function analytic(design, sc = {}, days = [28, 42, 56], tau = 12) {
  const truth = { ...TRUTH, ...(sc.truth || {}) }, spec = { perWeek: sc.perWeek || 3, horizon: Math.max(...days) };
  const sched = schedule(design, spec), out = {};
  T.configure('reset'); T.configure(modelFor(design, truth, sc.model || {}));
  const tr = (d) => sched.filter((o) => o.training && o.day < d).length, H28 = 1 - Math.exp(-tr(28) / tau);
  const h = (d) => (d >= 28 ? 1 : (1 - Math.exp(-tr(d) / tau)) / H28);
  for (const day of days) {
    const occ = sched.filter((o) => o.day <= day && o.blocks.length).map((o) => ({ t: o.day * DAY, h: h(o.day), blocks: o.blocks.map(([id, m]) => {
      const ip = itemParams(id, truth.optimistic);
      return { probe: id, n: m, y: 0, v: 1 / (m * infoAtK(ip.g, 0.6, ip.a)) };
    }) }));
    const f = T.fit({ occasions: occ });
    out[day] = {}; for (const k of Object.keys(f.gain)) out[day][k] = 1.898 * f.gain[k].sd;
  }
  const items = (d) => sched.filter((o) => o.day <= d).reduce((s, o) => s + itemsOf(o), 0);
  out.min4 = items(28) * SEC_PER_ITEM / 60; out.min8 = items(56) * SEC_PER_ITEM / 60;
  out.block = Math.max(...sched.filter((o) => o.kind === 'block').map(itemsOf));
  T.configure('reset');
  return out;
}
if (argv.includes('--scan')) {
  const rows = [];
  const add = (name, d) => { const a = analytic(d), o = analytic(d, SCEN.optimistic); rows.push({ name, a, o }); };
  add('classic (A)', DESIGNS.classic);
  add('classic + week', DESIGNS.classicWeek);
  for (const n of [3, 4, 5, 6, 8]) for (const [mk, mm] of [[2, 3], [2, 2], [3, 2], [1, 3], [2, 4], [3, 3]]) for (const [fk, fm] of [[1, 3], [1, 2], [2, 2], [1, 4], [2, 3]]) {
    const items = n + mk * mm + fk * fm + 2;
    if (items < 14 || items > 18) continue;
    add(`near ${n}, mid ${mk}×${mm}, far ${fk}×${fm} (${items})`, { probes: LADDER, control: 'wordlinks', base: 6, ctrlBase: 6, block: { near: n, mid: mm, far: fm, ctrl: 2 }, rotate: { mid: mk, far: fk } });
  }
  add('L14all (no rotation, 2 each)', DESIGNS.L14all);
  add('L20all (no rotation, 3 each; 5 min)', DESIGNS.L20all);
  add('L15 with 8-item baselines', DESIGNS.L15b8);
  add('L15 + measurement week', DESIGNS.L15week);
  for (const id of ['N16', 'N15', 'N14', 'N16week']) add(id + ' ' + JSON.stringify(DESIGNS[id].block) + ' base ' + DESIGNS[id].base + '/' + JSON.stringify(DESIGNS[id].baseBy), DESIGNS[id]);
  if (argv.includes('--levers')) {
    const L15 = DESIGNS.L15, two = ['otherwayA', 'otherwayB', 'cubematch', 'viewmatch', 'patterns', 'mechanisms', 'motiongraphs'];
    add('lever: near baselines 12', { ...L15, baseBy: { otherway: 12 } });
    add('lever: near baselines 16', { ...L15, baseBy: { otherway: 16 } });
    add('lever: near baselines 16, near 6/block', { ...L15, baseBy: { otherway: 16 }, block: { ...L15.block, near: 6 } });
    add('lever: two near probes, 2+2/block', { ...L15, probes: two });
    add('lever: two near probes, 3+3/block, base 8', { ...L15, probes: two, block: { ...L15.block, near: 3 }, baseBy: { otherwayA: 8, otherwayB: 8 } });
    for (const [nm, sc] of [['state 0.35', { truth: { stateU: 0.35 / Math.SQRT2, stateS: 0.35 / Math.SQRT2 }, model: { state: { total: 0.35 } } }],
      ['state 0.25 (M1 before the addendum)', { truth: { stateU: 0.25 / Math.SQRT2, stateS: 0.25 / Math.SQRT2 }, model: { state: { total: 0.25 } } }],
      ['no tail term (truth and model)', { truth: { tail: 0, tailC: 0, tailSd: 0 }, model: { tail: { spatial: 0, control: 0, sd: 0.0001 } } }],
      ['16-item reliability 0.85', { truth: { sigma: sigmaFor(0.85) } }]]) {
      const a = analytic(L15, sc);
      rows.push({ name: 'L15, ' + nm, a, o: a });
    }
  }
  const f2 = (x) => (x === undefined ? '  -  ' : x.toFixed(2));
  console.log('Analytic MDG (1.898 × posterior SD; ideal items, model = truth), central | optimistic; composite in SD_comp, rungs in per-probe SD');
  console.log('design'.padEnd(44) + '(block items; minutes of measurement to weeks 4 and 8)');
  console.log(''.padEnd(44) + 'items  min4  min8 | comp w4 w8 | near w4 w6 w8 | mid w4 w8 | far w4 w8 || optimistic: comp w4 w8 | near w4 w6');
  for (const { name, a, o } of rows) {
    const c = a[28].comp !== undefined ? 'comp' : 'all';
    console.log(name.padEnd(44) + `${String(a.block).padStart(4)} ${a.min4.toFixed(0).padStart(5)} ${a.min8.toFixed(0).padStart(5)} | ${f2(a[28][c])} ${f2(a[56][c])} | ${f2(a[28].near)} ${f2(a[42].near)} ${f2(a[56].near)} | ${f2(a[28].mid)} ${f2(a[56].mid)} | ${f2(a[28].far)} ${f2(a[56].far)} || ${f2(o[28][c])} ${f2(o[56][c])} | ${f2(o[28].near)} ${f2(o[42].near)}`);
  }
  process.exit(0);
}
if (argv.includes('--list')) { console.log(RUNS.map((r) => r.id).join('\n')); process.exit(0); }
const want = arg('runs', '') ? new Set(arg('runs', '').split(',')) : null;
const out = { n: N, seed: SEED, started: new Date().toISOString(), runs: [] };
let failed = 0;
if (argv.includes('--crossover')) {
  const cr = crossover(env.PX, T, { players: parseInt(arg('players', '2000'), 10), seed: SEED, design: DESIGNS[arg('design', 'L15')], truth: TRUTH, model: modelFor(DESIGNS[arg('design', 'L15')], TRUTH), sdComp: sdCompOf(DESIGNS.L15, TRUTH.rho) });
  console.log(cr.text);
  out.crossover = cr.data;
} else {
  for (const run of RUNS) {
    if (want ? !want.has(run.id) : false) continue;
    const res = runOne(run);
    console.log(fmtRun(res));
    out.runs.push(res);
    failed += res.checks.filter((c) => !c.pass).length;
  }
}
out.finished = new Date().toISOString();
if (arg('json', '')) fs.writeFileSync(arg('json', ''), JSON.stringify(out, null, 1));
console.log(failed ? `\n${failed} hard check(s) FAILED` : '\nall hard checks passed');
process.exit(failed ? 1 : 0);
void DAY;
