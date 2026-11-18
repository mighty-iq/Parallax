#!/usr/bin/env node
/* M1 spike (docs/research/v1.2/M1-measurement.md §5): can a probe design show a real composite
   probe gain of 0.5 SD by week 4 in >= 60 % of learners, while <= 5 % of learners without a gain
   read "likely gain"? Standalone: no app code is imported; nothing here touches the engine.

     node docs/research/v1.2/spikes/M1/power.mjs [--n 1000] [--seed 1]
          [--designs D0,D0m,A,B,C] [--scenarios central,famBig,...] [--quick]

   Part 1 prints the Fisher information per item of each probe format at the engine's target.
   Part 2 prints, per design, the analytic posterior SD of the composite gain at day 28 under the
   decision model when the model is right (no item-level noise), and the power it implies.
   Part 3 simulates learners item by item (adaptive items, occasion noise, familiarity curve,
   misspecified item difficulties) and applies each design's decision rule at every look.

   Units: logits on the engine's item scale (a = 1, lapse 0.03). "SD" is the between-person SD of
   one probe's true ability (sigmaPop); "SD_comp" that of the composite (mean of 4 probes).
   Every default below is listed with its source in M1-measurement.md §4.4. */

const argv = process.argv.slice(2);
const opt = (k, d) => { const i = argv.indexOf('--' + k); return i >= 0 && argv[i + 1] !== undefined ? argv[i + 1] : d; };
const N = parseInt(opt('n', argv.includes('--quick') ? '300' : '1000'), 10);
const SEED = parseInt(opt('seed', '1'), 10);

/* ---------- random numbers (seeded) ---------- */
function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function normal(r) { let u = 0; while (u === 0) u = r(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * r()); }
const Phi = (x) => { // standard normal CDF
  const t = 1 / (1 + 0.3275911 * Math.abs(x) / Math.SQRT2);
  const y = 1 - (((((1.061405429 * t - 1.453152027) * t) + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-x * x / 2);
  return x >= 0 ? 0.5 * (1 + y) : 0.5 * (1 - y);
};

/* ---------- the item model (as js/engine/model.js: P = g + (1 − g − 0.03) σ(a(θ − b))) ---------- */
const LAPSE = 0.03;
const sig = (x) => (x >= 0 ? 1 / (1 + Math.exp(-x)) : Math.exp(x) / (1 + Math.exp(x)));
const pRight = (th, b, g, a = 1) => g + (1 - g - LAPSE) * sig(a * (th - b));
function infoAtK(g, k, a = 1) { // Fisher information of one item aimed at success g + (1 − g)k
  const s = (1 - g) * k / (1 - g - LAPSE), d = (1 - g - LAPSE) * a * s * (1 - s), p = g + (1 - g) * k;
  return d * d / (p * (1 - p));
}
const bFor = (th, k, g, a = 1) => { const s = (1 - g) * k / (1 - g - LAPSE); return th - Math.log(s / (1 - s)) / a; };

// The four composite probes and the control (guessing rates from js/ex/*/gen.js; Mechanisms mixes
// 1/2 and 1/3, Pattern Memory's exact-set guess is ~0).
const PROBES = [
  { id: 'cubematch', g: 0.5 }, { id: 'viewmatch', g: 0.25 }, { id: 'mechanisms', g: 0.4 }, { id: 'patterns', g: 0.01 },
];
const CONTROL = { id: 'wordlinks', g: 0.25 };
const SEC_PER_ITEM = 15; // the guide: a 16-item probe takes 3 to 5 minutes

/* ---------- parameters (central values; §4.4 gives the sources) ---------- */
// sigmaPop from the reliability of one 16-item adaptive probe (average over the four formats):
// rel = σ² / (σ² + SE²). Central 0.75 (short spatial tests: 0.75–0.85); 'simPop' uses the
// current learner fixture's 0.73 logits (16-item reliability about 0.5).
function sigmaFor(rel) {
  const se2 = PROBES.map((p) => 1 / (16 * infoAtK(p.g, 0.6) + 1 / 2.25));
  const meanSe2 = se2.reduce((a, b) => a + b, 0) / se2.length;
  return Math.sqrt(meanSe2 * rel / (1 - rel));
}
function baseParams() {
  const sigmaPop = sigmaFor(0.75);
  return {
    sigmaPop, rho: 0.4,                         // between-probe correlation of true ability
    horizon: 28, itemMult: 1,                   // report day; information multiplier on every probe item
    famMu: 0.5, famSd: 0.2, famLambda: 16,      // plateau (SD units), between-person SD, items to 63 %
    famRFF: 0.5, famRFc: 0.3, famMuC: 0.3,      // familiarity correlations; control plateau
    famTail: 0,                                 // extra SD per 16 items after the curve (truth only)
    stateU: 0.18, stateS: 0.18,                 // occasion noise (SD units): shared day factor, probe-specific
    itemNoise: 0.3,                             // true item difficulty off the model by N(0, 0.3²)
    aTrue: 1, kTarget: 0.6,
    gainSD: 0.5,                                // real composite gain at day 28, in SD_comp
    gainShape: 'linear',                        // linear in days from day 0 to day 28
    sessionsPerWeek: 3,
    // the decision model's own assumptions (may differ from the truth in scenarios)
    model: { famMu: 0.5, famSd: 0.2, famLambda: 16, famRFF: 0.5, famRFc: 0.3, famMuC: 0.3, stateU: 0.18, stateS: 0.18, gainPriorSD: 100 },
    pGain: 0.95, pNone: 0.90, noneMargin: 0.2,  // verdict thresholds; "no change" margin in SD_comp
  };
}

const SCENARIOS = {
  central: (p) => p,
  simPop: (p) => ({ ...p, sigmaPop: 0.73, rho: 0.33 }),          // the current fixture's population
  famBig: (p) => ({ ...p, famMu: 0.8 }),                           // familiarity plateau larger than assumed
  famSlow: (p) => ({ ...p, famLambda: 40 }),                       // familiarity builds over ~2.5 checks
  famTail: (p) => ({ ...p, famTail: 0.03 }),                       // keeps growing 0.03 SD per 16 items
  famSlowRobust: (p) => ({ ...p, famLambda: 40, model: { ...p.model, famLambda: 40, famSd: 0.3 } }), // model knows it
  wrongSlow: (p) => ({ ...p, model: { ...p.model, famLambda: 40 } }),   // model assumes slow, truth is fast
  stateBig: (p) => ({ ...p, stateU: 0.25, stateS: 0.25 }),          // occasion noise 0.35 SD, model assumes 0.25
  twoPerWeek: (p) => ({ ...p, sessionsPerWeek: 2 }),
  betterItems: (p) => ({ ...p, betterItems: true }),                // v1.2 probe upgrades (see §4)
  optimistic: (p) => ({ ...p, betterItems: true, sigmaPop: sigmaFor(0.85) }), // upgrades + 16-item reliability 0.85
  optimistic42: (p) => ({ ...p, betterItems: true, sigmaPop: sigmaFor(0.85), horizon: 42 }),
  optimisticFamSlow: (p) => ({ ...p, betterItems: true, sigmaPop: sigmaFor(0.85), famLambda: 40 }),
  skepticalPrior: (p) => ({ ...p, model: { ...p.model, gainPriorSD: 1.0 } }),
  milestones: (p) => ({ ...p, looksAt: [14, 28], pGainAt: { 14: 0.975, 28: 0.95 } }),
  milestonesFamBig: (p) => ({ ...p, famMu: 0.8, looksAt: [14, 28], pGainAt: { 14: 0.975, 28: 0.95 } }),
  milestonesOptimistic: (p) => ({ ...p, betterItems: true, sigmaPop: sigmaFor(0.85), looksAt: [14, 28], pGainAt: { 14: 0.975, 28: 0.95 } }),
  famBigWideF: (p) => ({ ...p, famMu: 0.8, looksAt: [14, 28], pGainAt: { 14: 0.975, 28: 0.95 }, model: { ...p.model, famSd: 0.35 } }),
  // a conservative familiarity prior (plateau 0.8 SD) when the truth is 0.5, and when it is 0.8
  conservativePrior: (p) => ({ ...p, looksAt: [14, 28], pGainAt: { 14: 0.975, 28: 0.95 }, model: { ...p.model, famMu: 0.8 } }),
  conservativePriorFamBig: (p) => ({ ...p, famMu: 0.8, looksAt: [14, 28], pGainAt: { 14: 0.975, 28: 0.95 }, model: { ...p.model, famMu: 0.8 } }),
};

/* ---------- schedules ----------
   A schedule is a list of sessions { day, kind, items: [m0, m1, m2, m3], ctrl } (items per probe in
   that session's measurement block). Training sessions fall on Mon/Wed/Fri (or Mon/Thu) from day 0. */
function trainingDays(perWeek, upTo) {
  const pat = perWeek >= 3 ? [0, 2, 4] : [0, 3];
  const out = [];
  for (let w = 0; w * 7 <= upTo; w++) for (const d of pat) if (w * 7 + d <= upTo) out.push(w * 7 + d);
  return out;
}
const full = (m, c) => ({ items: [m, m, m, m], ctrl: c });
const DESIGNS = {
  // D0: today's check (16 items per probe and control), B1 day 0, B2 day 1, then a check after
  // 14 days AND 8 sessions; today's decision rule (vs retest gain G and vs the control).
  D0: { label: 'Current check, current rule', rule: 'current', sched: (P) => {
    const days = trainingDays(P.sessionsPerWeek, 60), s = [{ day: 0, kind: 'B1', ...full(16, 16) }, { day: 1, kind: 'B2', ...full(16, 16) }];
    let last = 1;
    for (;;) {
      const after = days.filter((d) => d > last);
      if (after.length < 8) break;
      const d = Math.max(last + 14, after[7]);
      if (d > 60) break;
      s.push({ day: d, kind: 'check', ...full(16, 16) }); last = d;
    }
    return s;
  } },
  // D0m: the same schedule, judged by the trend model of §4 (isolates the model's contribution).
  D0m: { label: 'Current check, trend model', rule: 'model', sched: (P) => DESIGNS.D0.sched(P) },
  // A: short baselines in sessions 1 and 2, then a 3.5-minute embedded block in every later
  // session (all four probes x 3 items + 2 control items), a full check every 28 days.
  A: { label: 'Embedded blocks + monthly check', rule: 'model', sched: (P) => {
    const days = trainingDays(P.sessionsPerWeek, P.horizon || 28), s = [];
    days.forEach((d, i) => {
      if (i === 0) s.push({ day: d, kind: 'B1', ...full(8, 8) });
      else if (i === 1) s.push({ day: d, kind: 'B2', ...full(8, 8) });
      else if (d > 0 && d % 28 === 0) s.push({ day: d, kind: 'check', ...full(8, 8) });
      else s.push({ day: d, kind: 'embed', items: [3, 3, 3, 3], ctrl: 2 });
    });
    return s;
  } },
  // B: two measurement bursts of three short sessions (6 items per probe + 6 control, ~7.5 min):
  // days 0, 1, 2 and days 26, 27, 28; nothing in between.
  B: { label: 'Bursts (week 0 and every 4 weeks)', rule: 'model', sched: (P) => {
    const out = [];
    for (let w = 0; w * 7 <= (P.horizon || 28); w += 4) for (const d of w === 0 ? [0, 1, 2] : [w * 7 - 2, w * 7 - 1, w * 7]) out.push({ day: d, kind: 'burst', ...full(6, 6) });
    return out;
  } },
  // A+: as A with 4-minute blocks (all four probes x 4 items + 2 control) and 10-minute baselines.
  Aplus: { label: 'Embedded blocks, 4 min', rule: 'model', sched: (P) => {
    const days = trainingDays(P.sessionsPerWeek, P.horizon || 28), s = [];
    days.forEach((d, i) => {
      if (i === 0) s.push({ day: d, kind: 'B1', ...full(10, 8) });
      else if (i === 1) s.push({ day: d, kind: 'B2', ...full(10, 8) });
      else if (d > 0 && d % 28 === 0) s.push({ day: d, kind: 'check', ...full(10, 8) });
      else s.push({ day: d, kind: 'embed', items: [4, 4, 4, 4], ctrl: 2 });
    });
    return s;
  } },
  // B+: bursts of four sessions with 8 items per probe and 4 control items (9 minutes each).
  Bplus: { label: 'Bursts of 4 x 9 min', rule: 'model', sched: (P) => {
    const out = [];
    for (let w = 0; w * 7 <= (P.horizon || 28); w += 4) for (const d of w === 0 ? [0, 1, 2, 3] : [w * 7 - 3, w * 7 - 2, w * 7 - 1, w * 7]) out.push({ day: d, kind: 'burst', ...full(8, 4) });
    return out;
  } },
  // C: dense: a 10-minute baseline in session 1, then a 5-minute block in every session (all four
  // probes x 4 items + 4 control items).
  C: { label: 'Dense blocks every session', rule: 'model', sched: (P) => {
    const days = trainingDays(P.sessionsPerWeek, P.horizon || 28);
    return days.map((d, i) => (i === 0 ? { day: d, kind: 'B1', ...full(8, 8) } : { day: d, kind: 'embed', ...full(4, 4) }));
  } },
};
function minutesTo(sched, day) {
  let items = 0;
  for (const s of sched) if (s.day <= day) items += s.items.reduce((a, b) => a + b, 0) + s.ctrl;
  return items * SEC_PER_ITEM / 60;
}

/* ---------- small linear algebra ---------- */
function inv(A) { // Gauss–Jordan with partial pivoting
  const n = A.length, M = A.map((r, i) => [...r, ...Array.from({ length: n }, (_, j) => (i === j ? 1 : 0))]);
  for (let c = 0; c < n; c++) {
    let p = c;
    for (let r = c + 1; r < n; r++) if (Math.abs(M[r][c]) > Math.abs(M[p][c])) p = r;
    [M[c], M[p]] = [M[p], M[c]];
    const d = M[c][c];
    for (let j = 0; j < 2 * n; j++) M[c][j] /= d;
    for (let r = 0; r < n; r++) if (r !== c) { const f = M[r][c]; if (f) for (let j = 0; j < 2 * n; j++) M[r][j] -= f * M[c][j]; }
  }
  return M.map((r) => r.slice(n));
}

/* ---------- the decision model ----------
   y_ij = α_i + F_i·φ̄_ij + G·h(t_j) + u_j + s_ij + e_ij   (spatial probe i, session j)
   y_cj = α_c + F_c·φ̄_cj + u_j + s_cj + e_cj               (control)
   φ̄: mean over the block's items of 1 − exp(−n/λ), n = that probe's items seen before;
   u_j: the session's shared state (all tasks), s: task-specific state, e: the block's own
   standard error. Priors: α flat; (F_1..F_4, F_c) jointly normal around the population
   familiarity curve; G ~ N(0, gainPriorSD·SD_comp). Linear-Gaussian, so the posterior is exact
   (generalised least squares; a Kalman filter over sessions gives the same answer). */
const NP = 11, IA = (i) => i, IAC = 4, IF = (i) => 5 + i, IFC = 9, IG = 10;
const phiBar = (n, m, lam) => { let s = 0; for (let k = 0; k < m; k++) s += 1 - Math.exp(-(n + k) / lam); return s / m; };

function priorOf(P) {
  const M = P.model, sp = P.sigmaPop, sdc = sp * Math.sqrt((1 + 3 * P.rho) / 4);
  const mu = new Array(NP).fill(0), C = Array.from({ length: NP }, () => new Array(NP).fill(0));
  for (let i = 0; i < 5; i++) C[i][i] = 100; // α: flat
  for (let i = 0; i < 4; i++) { mu[IF(i)] = M.famMu * sp; for (let j = 0; j < 4; j++) C[IF(i)][IF(j)] = (M.famSd * sp) ** 2 * (i === j ? 1 : M.famRFF); }
  mu[IFC] = M.famMuC * sp; C[IFC][IFC] = (M.famSd * sp) ** 2;
  for (let i = 0; i < 4; i++) C[IF(i)][IFC] = C[IFC][IF(i)] = M.famRFc * (M.famSd * sp) ** 2;
  C[IG][IG] = (M.gainPriorSD * sdc) ** 2;
  const Pp = inv(C);
  return { mu, Pp, Pmu: Pp.map((r) => r.reduce((a, v, j) => a + v * mu[j], 0)) };
}

// obs: per session { rows: [{ x (NP), y, v }] } → posterior of G (mean, sd)
function posteriorG(P, prior, sessions) {
  const sp = P.sigmaPop, su2 = (P.model.stateU * sp) ** 2, ss2 = (P.model.stateS * sp) ** 2;
  const Q = prior.Pp.map((r) => r.slice()), b = prior.Pmu.slice();
  for (const S of sessions) {
    const rows = S.rows, m = rows.length;
    if (!m) continue;
    // R = D + su2·11ᵀ, R⁻¹ = D⁻¹ − c·D⁻¹11ᵀD⁻¹ with c = su2 / (1 + su2·Σ 1/d)
    const dinv = rows.map((r) => 1 / (r.v + ss2)), sd = dinv.reduce((a, v) => a + v, 0), c = su2 / (1 + su2 * sd);
    const w = new Array(NP).fill(0); // Σ_k d_k⁻¹ x_k
    let wy = 0;
    rows.forEach((r, k) => { for (let p = 0; p < NP; p++) w[p] += dinv[k] * r.x[p]; wy += dinv[k] * r.y; });
    rows.forEach((r, k) => {
      for (let p = 0; p < NP; p++) {
        if (!r.x[p]) continue;
        const xp = dinv[k] * r.x[p];
        b[p] += xp * r.y;
        for (let q = 0; q < NP; q++) Q[p][q] += xp * r.x[q];
      }
    });
    for (let p = 0; p < NP; p++) { b[p] -= c * w[p] * wy; for (let q = 0; q < NP; q++) Q[p][q] -= c * w[p] * w[q]; }
  }
  const V = inv(Q), mean = V.map((r) => r.reduce((a, v, j) => a + v * b[j], 0));
  return { mean: mean[IG], sd: Math.sqrt(V[IG][IG]) };
}

/* ---------- Part 1 and Part 2: analytic ---------- */
function part1() {
  console.log('Part 1. Fisher information per item at the engine target k = 0.6 (a = 1, lapse 0.03)');
  for (const p of [...PROBES, CONTROL]) {
    let best = [0, 0];
    for (let k = 0.05; k < 0.96; k += 0.01) { const i = infoAtK(p.g, k); if (i > best[1]) best = [k, i]; }
    console.log(`  ${p.id.padEnd(11)} g=${String(p.g).padEnd(4)} info=${infoAtK(p.g, 0.6).toFixed(3)}  best k=${best[0].toFixed(2)} (${best[1].toFixed(3)})  SE of 16 items=${(1 / Math.sqrt(16 * infoAtK(p.g, 0.6) + 1 / 2.25)).toFixed(2)}`);
  }
}

const hOf = (P, day) => Math.min(1, Math.max(0, day / 28)); // the model's gain shape (linear to day 28)
function infoMult(P, i) { // v1.2 probe upgrades in the 'betterItems' scenario (§4.1): see the notes
  const m = P.itemMult || 1;
  if (!P.betterItems) return m;
  return m * [0.136 / 0.074, 1, 0.136 / 0.096, 2][i] * 1.15; // Cube Match as 4 options, Mechanisms 4 options,
}                                                             // Pattern Memory scored by cells (x2), RT (x1.15)

function analytic(P, design) {
  const H = P.horizon || 28, sched = design.sched(P).filter((s) => s.day <= H), prior = priorOf(P), sp = P.sigmaPop;
  const seen = [0, 0, 0, 0], seenC = [0];
  const sessions = sched.map((s) => {
    const rows = [];
    s.items.forEach((m, i) => {
      if (!m) return;
      const v = 1 / (m * infoAtK(PROBES[i].g, P.kTarget) * infoMult(P, i) + 1 / 9);
      const x = new Array(NP).fill(0);
      x[IA(i)] = 1; x[IF(i)] = phiBar(seen[i], m, P.model.famLambda); x[IG] = hOf(P, s.day);
      rows.push({ x, y: 0, v }); seen[i] += m;
    });
    if (s.ctrl) {
      const v = 1 / (s.ctrl * infoAtK(CONTROL.g, P.kTarget) + 1 / 9), x = new Array(NP).fill(0);
      x[IAC] = 1; x[IFC] = phiBar(seenC[0], s.ctrl, P.model.famLambda); rows.push({ x, y: 0, v }); seenC[0] += s.ctrl;
    }
    return { rows };
  });
  const post = posteriorG(P, prior, sessions), sdc = sp * Math.sqrt((1 + 3 * P.rho) / 4);
  return { sdG: post.sd / sdc, minutes: minutesTo(sched, H) };
}

// Power of one look at P(G > 0) >= 0.95 with a flat gain prior, model = truth: Φ(G/sd − 1.645).
const pow = (g, sd) => (100 * Phi(g / sd - 1.645)).toFixed(0).padStart(3) + ' %';
function part2() {
  const P0 = baseParams();
  console.log(`\nPart 2. Analytic posterior SD of the composite gain at the report day (SD_comp units), model = truth, ideal items`);
  console.log(`  central: sigmaPop = ${P0.sigmaPop.toFixed(2)} logits per probe, SD_comp = ${(P0.sigmaPop * Math.sqrt((1 + 3 * P0.rho) / 4)).toFixed(2)} logits; ` +
    `60 % power at P >= 0.95 needs sd(G) <= ${(0.5 / 1.898).toFixed(3)}`);
  const flat = (P) => ({ ...P, model: { ...P.model, gainPriorSD: 100 } });
  const rows = [
    ['central', (P) => P],
    ['no occasion noise', (P) => ({ ...P, stateU: 0, stateS: 0, model: { ...P.model, stateU: 0, stateS: 0 } })],
    ['day state known (u = 0)', (P) => ({ ...P, stateU: 0, model: { ...P.model, stateU: 0 } })],
    ['familiarity known', (P) => ({ ...P, model: { ...P.model, famSd: 0.001 } })],
    ['items x2 information', (P) => ({ ...P, itemMult: 2 })],
    ['better items (§4.1)', (P) => ({ ...P, betterItems: true })],
    ['16-item reliability 0.85', (P) => ({ ...P, sigmaPop: sigmaFor(0.85) })],
    ['16-item reliability 0.90', (P) => ({ ...P, sigmaPop: sigmaFor(0.90) })],
    ['sim population (rel ~0.5)', (P) => ({ ...P, sigmaPop: 0.73, rho: 0.33 })],
    ['report at day 42', (P) => ({ ...P, horizon: 42 })],
    ['report at day 56', (P) => ({ ...P, horizon: 56 })],
    ['better items + rel 0.85', (P) => ({ ...P, betterItems: true, sigmaPop: sigmaFor(0.85) })],
    ['better items + rel 0.85 + day 42', (P) => ({ ...P, betterItems: true, sigmaPop: sigmaFor(0.85), horizon: 42 })],
  ];
  const ids = Object.keys(DESIGNS).filter((id) => DESIGNS[id].rule === 'model');
  console.log('  each cell: minutes of measurement to the report day, power for 0.5 SD_comp at one look, and MDG = the gain');
  console.log('  (SD_comp) that 60 % of learners would show as "likely gain" (P >= 0.95, flat gain prior, model = truth)');
  console.log('  ' + 'variant'.padEnd(34) + ids.map((id) => id.padEnd(24)).join(''));
  for (const [name, f] of rows) {
    const P = flat(f(baseParams()));
    console.log('  ' + name.padEnd(34) + ids.map((id) => {
      const a = analytic(P, DESIGNS[id]);
      return `${a.minutes.toFixed(0).padStart(3)}m ${pow(P.gainSD, a.sdG)} MDG ${(1.898 * a.sdG).toFixed(2)}`.padEnd(24);
    }).join(''));
  }
}

/* ---------- Part 3: item-level simulation ---------- */
const GRID = []; for (let x = -7; x <= 7.0001; x += 0.1) GRID.push(x);
function summarize(lw) {
  let mx = -Infinity; for (const v of lw) if (v > mx) mx = v;
  let s0 = 0, s1 = 0, s2 = 0;
  for (let i = 0; i < lw.length; i++) { const w = Math.exp(lw[i] - mx); s0 += w; s1 += w * GRID[i]; s2 += w * GRID[i] * GRID[i]; }
  const m = s1 / s0; return { mu: m, sd: Math.sqrt(Math.max(s2 / s0 - m * m, 1e-6)) };
}
// One probe block: m adaptive items aimed at kTarget under the block posterior (prior centre,
// prior SD); returns the posterior summary (engine style, 'post') and a likelihood-based summary
// with a weak prior (SD 3) around the same centre ('lik', what the trend model uses).
function block(r, P, g, mult, thetaAt, m, center, priorSd, easyFirst) {
  const lw = GRID.map((x) => -((x - center) ** 2) / (2 * priorSd * priorSd)), ll = new Array(GRID.length).fill(0);
  // information multipliers (better items) are modelled as a steeper item: a = sqrt(mult)
  const a = Math.sqrt(mult);
  for (let j = 0; j < m; j++) {
    const post = summarize(lw), k = j < easyFirst ? 0.85 : P.kTarget;
    const b = bFor(post.mu, k, g, a), bTrue = b + P.itemNoise * normal(r);
    const ok = r() < pRight(thetaAt(j), bTrue, g, a * P.aTrue);
    for (let i = 0; i < GRID.length; i++) { const p = pRight(GRID[i], b, g, a); const l = Math.log(ok ? p : 1 - p); lw[i] += l; ll[i] += l; }
  }
  return { post: summarize(lw), lik: summarize(ll.map((v, i) => v - ((GRID[i] - center) ** 2) / 18)) };
}

function simulate(P, design, arm, n, seed) {
  const r = mulberry32(seed), sp = P.sigmaPop, sdc = sp * Math.sqrt((1 + 3 * P.rho) / 4);
  const H = P.horizon || 28, prior = priorOf(P), sched = design.sched(P).filter((s) => s.day <= H);
  const res = { atEnd: { gain: 0, none: 0, unclear: 0 }, ever: 0, looks: 0, z: [] };
  for (let L = 0; L < n; L++) {
    // the learner
    const zg = normal(r), th0 = PROBES.map(() => sp * (Math.sqrt(P.rho) * zg + Math.sqrt(1 - P.rho) * normal(r))), th0c = sp * normal(r);
    const zf = normal(r), lf = Math.sqrt(P.famRFF), lc = P.famRFc / lf;
    const F = PROBES.map(() => sp * (P.famMu + P.famSd * (lf * zf + Math.sqrt(1 - lf * lf) * normal(r))));
    const Fc = sp * (P.famMuC + P.famSd * (lc * zf + Math.sqrt(1 - lc * lc) * normal(r)));
    const G = arm === 'gain' ? P.gainSD * sdc : 0;
    const fam = (Fx, n0) => Fx * (1 - Math.exp(-n0 / P.famLambda)) + P.famTail * sp * n0 / 16;
    const seen = [0, 0, 0, 0]; let seenC = 0;
    const est = PROBES.map(() => 0); let estC = 0; // running centres for item targeting
    const sessions = [], checks = []; let ever = false, verdict = 'unclear';
    for (const s of sched) {
      const u = P.stateU * sp * normal(r), h = arm === 'gain' ? Math.min(1, s.day / 28) : 0;
      const rows = [], chk = { kind: s.kind, results: {} };
      s.items.forEach((m, i) => {
        if (!m) return;
        const si = P.stateS * sp * normal(r), base = th0[i] + G * h + u + si, n0 = seen[i];
        const engine = design.rule === 'current';
        const out = block(r, P, PROBES[i].g, infoMult(P, i), (j) => base + fam(F[i], n0 + j), m,
          engine ? 0 : est[i], engine ? 1.5 : 1.5, engine ? 2 : 0);
        const x = new Array(NP).fill(0);
        x[IA(i)] = 1; x[IF(i)] = phiBar(n0, m, P.model.famLambda); x[IG] = hOf(P, s.day);
        rows.push({ x, y: out.lik.mu, v: out.lik.sd ** 2 });
        chk.results[i] = { theta: out.post.mu, se: out.post.sd };
        seen[i] += m; est[i] = est[i] === 0 && n0 === 0 ? out.lik.mu : 0.5 * est[i] + 0.5 * out.lik.mu;
      });
      if (s.ctrl) {
        const sc = P.stateS * sp * normal(r), base = th0c + u + sc, n0 = seenC, engine = design.rule === 'current';
        const out = block(r, P, CONTROL.g, 1, (j) => base + fam(Fc, n0 + j), s.ctrl, engine ? 0 : estC, 1.5, engine ? 2 : 0);
        const x = new Array(NP).fill(0);
        x[IAC] = 1; x[IFC] = phiBar(n0, s.ctrl, P.model.famLambda);
        rows.push({ x, y: out.lik.mu, v: out.lik.sd ** 2 });
        chk.results.c = { theta: out.post.mu, se: out.post.sd };
        seenC += s.ctrl; estC = n0 === 0 ? out.lik.mu : 0.5 * estC + 0.5 * out.lik.mu;
      }
      sessions.push({ rows }); checks.push(chk);
      // the verdict after this session
      if (design.rule === 'current') {
        if (checks.length >= 3) verdict = currentRule(checks);
      } else if (s.day >= 7 && (!P.looksAt || P.looksAt.includes(s.day))) {
        // P.looksAt: the verdict words change only at these milestone days (the meter may still move);
        // P.pGainAt: a stricter bar at early milestones (a simple guard against repeated looks)
        const pg = posteriorG(P, prior, sessions), zz = pg.mean / pg.sd, hh = hOf(P, s.day);
        const pNone = Phi((P.noneMargin * sdc - hh * pg.mean) / (hh * pg.sd));
        const bar = P.pGainAt && P.pGainAt[s.day] ? P.pGainAt[s.day] : P.pGain;
        verdict = Phi(zz) >= bar ? 'gain' : pNone >= P.pNone ? 'none' : 'unclear';
        if (s === sched[sched.length - 1]) res.z.push([pg.mean / sdc, pg.sd / sdc]);
      }
      if (verdict === 'gain') ever = true;
      res.looks++;
    }
    res.atEnd[verdict]++; if (ever) res.ever++;
  }
  return res;
}

// Today's rule (js/engine/assess.js decide()): composite change from the baseline average beyond
// the retest gain G = B2 − B1 and beyond the control's change, both with 95 % intervals.
function currentRule(checks) {
  const nb = 2, base = checks.slice(0, nb), last = checks[checks.length - 1], z = 1.96;
  const ch = (id) => {
    const bs = base.map((c) => c.results[id]), L = last.results[id];
    const bm = (bs[0].theta + bs[1].theta) / 2, bse = Math.sqrt(bs[0].se ** 2 + bs[1].se ** 2) / 2;
    const d = L.theta - bm, se = Math.sqrt(L.se ** 2 + bse ** 2), G = bs[1].theta - bs[0].theta;
    const seG = G > 0 ? Math.sqrt(bs[0].se ** 2 + bs[1].se ** 2) : 0;
    return { d, se, retest: Math.max(0, G) * 1, retestSe: seG };
  };
  const ps = [0, 1, 2, 3].map(ch), c = ch('c');
  const d = ps.reduce((a, x) => a + x.d, 0) / 4, se = Math.sqrt(ps.reduce((a, x) => a + x.se ** 2, 0)) / 4;
  const rt = ps.reduce((a, x) => a + x.retest, 0) / 4, rtSe = Math.sqrt(ps.reduce((a, x) => a + x.retestSe ** 2, 0)) / 4;
  const vrLo = (d - rt) - z * Math.sqrt(se * se + rtSe * rtSe), vrHi = (d - rt) + z * Math.sqrt(se * se + rtSe * rtSe);
  const vcLo = (d - c.d) - z * Math.sqrt(se * se + c.se * c.se);
  return vrLo > 0 && vcLo > 0 ? 'gain' : vrHi < 0.25 ? 'none' : 'unclear';
}

/* ---------- run ---------- */
// Part 2b: what it would cost. Burst designs (k sessions at days 0.. and 28 − k + 1..28, m items
// per probe and m/2 control items per session) and embedded designs (every session from session
// 3, m items per probe; 8-item baselines in sessions 1–2; 3 sessions a week), analytic MDG at day 28.
function part2b() {
  console.log('\nPart 2b. Cost of a smaller minimal detectable gain at day 28 (analytic, flat gain prior, model = truth)');
  const sets = [['central', (P) => P], ['optimistic', (P) => ({ ...P, betterItems: true, sigmaPop: sigmaFor(0.85) })]];
  for (const [name, f] of sets) {
    const P = { ...f(baseParams()), model: { ...baseParams().model, gainPriorSD: 100 } };
    const out = [];
    for (const k of [3, 4, 6, 8]) for (const m of [6, 8, 12, 16]) {
      const D = { rule: 'model', sched: () => {
        const o = [];
        for (let i = 0; i < k; i++) o.push({ day: i, kind: 'burst', ...full(m, Math.ceil(m / 2)) });
        for (let i = 0; i < k; i++) o.push({ day: 28 - k + 1 + i, kind: 'burst', ...full(m, Math.ceil(m / 2)) });
        return o;
      } };
      const a = analytic(P, D);
      out.push(`bursts ${k}x${String(m).padStart(2)}: ${a.minutes.toFixed(0).padStart(3)} min, MDG ${(1.898 * a.sdG).toFixed(2)}`);
    }
    for (const m of [3, 4, 6, 8, 12]) {
      const D = { rule: 'model', sched: (Q) => trainingDays(3, 28).map((d, i) => (i < 2 ? { day: d, kind: 'B', ...full(8, 8) } : { day: d, kind: 'embed', items: [m, m, m, m], ctrl: 2 })) };
      const a = analytic(P, D);
      out.push(`embedded ${String(m).padStart(2)}/probe: ${a.minutes.toFixed(0).padStart(3)} min, MDG ${(1.898 * a.sdG).toFixed(2)}`);
    }
    console.log(`  ${name}:`);
    for (let i = 0; i < out.length; i += 3) console.log('    ' + out.slice(i, i + 3).map((x) => x.padEnd(40)).join(''));
  }
}

part1();
part2();
part2b();
const P0 = baseParams();
const designs = opt('designs', 'D0,D0m,A,Aplus,B,Bplus,C').split(',');
const scen = opt('scenarios', 'central,simPop,famBig,famSlow,famTail,famSlowRobust,stateBig,twoPerWeek,betterItems').split(',');
console.log(`\nPart 3. Item-level simulation, ${N} learners per arm; verdict "likely gain" at P(G > 0) >= ${P0.pGain}; ` +
  `"likely no change" at P(gain < ${P0.noneMargin} SD_comp) >= ${P0.pNone}`);
console.log('  scenario          design  minutes  gain arm: likely gain at report (ever) / no change   no-gain arm: likely gain at report (ever) / no change');
for (const sc of scen) {
  const P = SCENARIOS[sc](baseParams());
  for (const id of designs) {
    const D = DESIGNS[id];
    if (!D) continue;
    const a = simulate(P, D, 'gain', N, SEED * 7919 + 1), b = simulate(P, D, 'none', N, SEED * 7919 + 2);
    const pc = (x) => (100 * x / N).toFixed(1).padStart(5);
    console.log(`  ${sc.padEnd(17)} ${id.padEnd(6)}  ${minutesTo(D.sched(P), P.horizon || 28).toFixed(0).padStart(5)}    ` +
      `${pc(a.atEnd.gain)} % (${pc(a.ever)} %) / ${pc(a.atEnd.none)} %              ${pc(b.atEnd.gain)} % (${pc(b.ever)} %) / ${pc(b.atEnd.none)} %`);
  }
}
