/* The probe learner model and Design A's schedules for tests/node/measure-sim.mjs (PLAN milestones 6
   and 4; docs/research/v1.2/M1-measurement.md §8.1 with its Addendum A.5; docs/dev/v1.2/measure-sim.md).
   Not a test file: run.mjs never loads it. All randomness is seeded (mulberry32 per learner), so every
   number is reproducible from --seed.

   Truth, probe p, item k of the block at occasion j (logits):
     θ = θ0_p + G_p·h(t_j) + F_p·(1 − exp(−n/λ)) + T·n/16 + u_j + s_pj,   n = that probe's items before k
     θ0_p = σ(√ρ·z_g + √(1 − ρ)·z_p); the control's θ0 = σ·z (no general factor, as in the M1 spike)
     F_p = σ(plateau + 0.2·z) correlated 0.5 among spatial probes, 0.3 with the control (plateau 0.3)
     T = σ·N(0.03, 0.02²) per 16 items, shared by the spatial probes; T_c mean 0.018, correlation 0.3
     u_j, s_pj ~ N(0, (0.354σ)²) each (occasion state 0.5 SD, half shared)
     after a gap of more than 56 days, familiarity keeps (1 − breakLoss) of what it had
   Answers: P = g + (1 − g − 0.03)·σ(a(θ − b_true)), b_true = b + N(0, 0.3²) (the model's b is off).
   Items aim at g + (1 − g)·0.6 under the block's grid posterior, whose prior is N(the trend model's
   prediction for the probe, 1.5²) (N(0, 1.5²) for a probe's first block; its first two items at 0.85).
   h(t): the learner's training curve, 1 − exp(−s/τ) over training sessions s before the occasion,
   τ ~ U(6, 24) sessions, normalised to 1 at day 28 and held from then on (decision 2's convention: the
   gain reaches its size at day 28 and then holds); 'linear' = min(1, day/28) (the spike's). */

export const DAY = 86400000;
export const LAPSE = 0.03;
export const SEC_PER_ITEM = 15; // the guide: a 16-item probe takes 3 to 5 minutes

/* ---------- seeded random numbers ---------- */
export function hashSeed(...parts) { // cyrb53 over the joined parts → uint32
  const s = parts.join('\u001f');
  let h1 = 0xdeadbeef, h2 = 0x41c6ce57;
  for (let i = 0; i < s.length; i++) { const c = s.charCodeAt(i); h1 = Math.imul(h1 ^ c, 2654435761); h2 = Math.imul(h2 ^ c, 1597334677); }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return (h2 >>> 0) ^ (h1 >>> 0);
}
export function makeRng(seed) {
  let a = seed >>> 0;
  const u = () => {
    a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  return {
    u,
    normal() { let x = 0; while (x === 0) x = u(); return Math.sqrt(-2 * Math.log(x)) * Math.cos(2 * Math.PI * u()); },
    chance(p) { return u() < p; },
    float(lo, hi) { return lo + (hi - lo) * u(); },
    int(lo, hi) { return lo + Math.floor(u() * (hi - lo + 1)); },
  };
}

/* ---------- the item model ---------- */
export const sig = (x) => (x >= 0 ? 1 / (1 + Math.exp(-x)) : Math.exp(x) / (1 + Math.exp(x)));
export const pRight = (th, b, g, a = 1) => g + (1 - g - LAPSE) * sig(a * (th - b));
export function infoAtK(g, k, a = 1) {
  const s = (1 - g) * k / (1 - g - LAPSE), d = (1 - g - LAPSE) * a * s * (1 - s), p = g + (1 - g) * k;
  return d * d / (p * (1 - p));
}
export const bFor = (th, k, g, a = 1) => { const s = (1 - g) * k / (1 - g - LAPSE); return th - Math.log(s / (1 - s)) / a; };
// σ_pop from the reliability of a 16-item probe, averaged over the four composite probes of 1.1 (the spike's rule)
export function sigmaFor(rel) {
  const se2 = [0.5, 0.25, 0.4, 0.01].map((g) => 1 / (16 * infoAtK(g, 0.6) + 1 / 2.25));
  const m = se2.reduce((s, v) => s + v, 0) / se2.length;
  return Math.sqrt(m * rel / (1 - rel));
}

/* ---------- probes ---------- */
// g: guessing rate today; gOpt / mult: the upgrades of PLAN milestone 6 (Cube Match and Mechanisms with
// 4 options, Pattern Memory scored by cells: ×2 information); the optimistic set adds response times (×1.15)
// on every spatial probe. Other Way Round and Motion Graphs are planned as 4-option probes.
export const PROBES = {
  otherway: { g: 0.25, rung: 'near' },
  otherwayA: { g: 0.25, rung: 'near' }, otherwayB: { g: 0.25, rung: 'near' }, // the six strands as two probes (a lever)
  cubematch: { g: 0.5, gOpt: 0.25, rung: 'mid' },
  viewmatch: { g: 0.25, rung: 'mid' },
  patterns: { g: 0.01, multOpt: 2, rung: 'mid' },
  mechanisms: { g: 0.4, gOpt: 0.25, rung: 'far' },
  motiongraphs: { g: 0.25, rung: 'far' },
  level: { g: 0.25, rung: 'alone' },
  wordlinks: { g: 0.25, rung: 'control', control: true },
};
export function itemParams(id, optimistic) {
  const P = PROBES[id];
  let g = P.g, mult = 1;
  if (optimistic && !P.control) { if (P.gOpt) g = P.gOpt; if (P.multOpt) mult *= P.multOpt; mult *= 1.15; }
  return { g, a: Math.sqrt(mult) };
}

/* ---------- schedules (Design A and its variants) ----------
   A design: { probes (spatial ids), control, base: items per probe in B1/B2/checks, ctrlBase, block:
   { near, mid, far, all, ctrl }, rotate: { mid: k, far: k } (probes per block, rotating), week: opt-in
   measurement week { items per probe, ctrl } }. Sessions at 18:00 on training days; at most 4 blocks a
   week; the 4-weekly check replaces that day's block. */
export function trainingDays(perWeek, from, to) {
  const pat = { 2: [0, 3], 3: [0, 2, 4], 4: [0, 1, 3, 4], 5: [0, 1, 2, 3, 4], 6: [0, 1, 2, 3, 4, 5] }[perWeek];
  const out = [];
  for (let w = Math.floor(from / 7); w * 7 <= to; w++) for (const d of pat) { const x = w * 7 + d; if (x >= from && x <= to) out.push(x); }
  return out;
}

function rungs(design) {
  const by = { near: [], mid: [], far: [], all: [], alone: [] };
  for (const id of design.probes) by[design.classic ? 'all' : PROBES[id].rung].push(id);
  return by;
}

// The probes of a regular block, rotating within each rung: block number i (0, 1, …) takes k of the
// rung's n probes, starting at i·k mod n.
function blockProbes(design, i) {
  const by = rungs(design), out = [];
  for (const r of ['near', 'mid', 'far', 'all']) {
    const ids = by[r], k = design.rotate && design.rotate[r] ? Math.min(design.rotate[r], ids.length) : ids.length;
    for (let x = 0; x < k; x++) out.push([ids[(i * k + x) % ids.length], design.block[r]]);
  }
  return out;
}
function fullBlocks(design, per, ctrl, rot) {
  const by = rungs(design), out = [];
  for (const r of ['near', 'mid', 'far', 'all', 'alone']) {
    const ids = by[r], k = rot && design.weekRotate && design.weekRotate[r] ? Math.min(design.weekRotate[r], ids.length) : ids.length;
    for (let x = 0; x < k; x++) { const id = ids[((rot || 0) * k + x) % ids.length]; out.push([id, !rot && design.baseBy && design.baseBy[id] ? design.baseBy[id] : per]); }
  }
  if (ctrl) out.push([design.control, ctrl]);
  return out;
}

// Occasions of one learner: [{ day, kind, training (a training session follows), blocks: [[probe, m], …] }].
// opts: { perWeek, horizon, breakFrom, breakTo } (a break: no sessions in (breakFrom, breakTo); the run-in restarts)
export function schedule(design, opts) {
  const H = opts.horizon, out = [];
  let days = trainingDays(opts.perWeek, 0, H);
  if (opts.breakFrom !== undefined) days = days.filter((d) => d <= opts.breakFrom || d >= opts.breakTo);
  const weekDays = new Set();
  if (design.week) for (let m = 28; m <= H; m += 28) for (let d = m - 3; d <= m; d++) weekDays.add(d);
  let blockNo = 0, weekNo = 0, runIn = 0;
  const perWeekCount = {};
  days.forEach((d, i) => {
    const prev = i ? days[i - 1] : null;
    if (i === 0 || (prev !== null && d - prev > 56)) runIn = 2; // B1, B2 (again after a long break)
    const wk = Math.floor(d / 7);
    if (runIn > 0) {
      out.push({ day: d, kind: i === 0 ? 'B1' : runIn === 2 ? 'R1' : out.length === 1 ? 'B2' : 'R2', training: true, blocks: fullBlocks(design, design.base, design.ctrlBase) });
      runIn--; return;
    }
    if (weekDays.has(d)) return; // the measurement week's session stands for this day's block
    if (d > 0 && d % 28 === 0) { out.push({ day: d, kind: 'check', training: true, blocks: fullBlocks(design, design.base, design.ctrlBase) }); return; }
    perWeekCount[wk] = (perWeekCount[wk] || 0) + 1;
    if (perWeekCount[wk] > 4) { out.push({ day: d, kind: 'train', training: true, blocks: [] }); return; }
    const bl = blockProbes(design, blockNo++);
    bl.push([design.control, design.block.ctrl]);
    out.push({ day: d, kind: 'block', training: true, blocks: bl.filter((b) => b[1] > 0) });
  });
  for (const d of [...weekDays].sort((a, b) => a - b)) {
    if (d > H || (opts.breakFrom !== undefined && d > opts.breakFrom && d < opts.breakTo)) continue;
    out.push({ day: d, kind: 'week', training: days.includes(d), blocks: fullBlocks(design, design.week.items, design.week.ctrl, ++weekNo) });
  }
  // a training session without measurement still counts for the training curve
  return out.sort((a, b) => a.day - b.day);
}
export function itemsOf(occ) { return occ.blocks.reduce((s, b) => s + b[1], 0); }

/* ---------- one simulated learner ---------- */

// spec: { design, truth, model (E.trend config patch), arm: 'none' | 'gain' | 'ladder', gainSD, reports (days),
//         perWeek, horizon, breakFrom/breakTo, mode: 'items' | 'summary', hShape: 'curve' | 'linear', hModel }
export function simulateLearner(T, spec, seed) {
  const r = makeRng(seed), S = spec.truth, D = spec.design, sp = S.sigma, opt = !!S.optimistic;
  const spatial = D.probes, ctl = D.control, all = [...spatial, ctl];
  // abilities, familiarity, tails
  const zg = r.normal(), th0 = {}, F = {};
  for (const id of spatial) th0[id] = sp * (Math.sqrt(S.rho) * zg + Math.sqrt(1 - S.rho) * r.normal());
  th0[ctl] = sp * r.normal();
  const zf = r.normal(), lf = Math.sqrt(S.famRFF), lc = S.famRFc / lf;
  for (const id of spatial) F[id] = sp * (S.famMu + S.famSd * (lf * zf + Math.sqrt(1 - lf * lf) * r.normal()));
  F[ctl] = sp * (S.famMuC + S.famSd * (lc * zf + Math.sqrt(1 - lc * lc) * r.normal()));
  const zt = r.normal(), zc = r.normal();
  const Tsp = sp * (S.tail + S.tailSd * zt), Tct = sp * (S.tailC + S.tailSd * (0.3 * zt + Math.sqrt(1 - 0.09) * zc));
  // gains at h = 1, in logits
  const G = {};
  for (const id of spatial) G[id] = 0;
  if (spec.arm === 'gain') for (const id of spatial) G[id] = spec.gainSD * spec.sdComp * sp;
  if (spec.arm === 'ladder') for (const id of spatial) G[id] = sp * ({ near: 1.0, mid: 0.5, far: 0.2, all: 0.5, alone: 0.2 }[D.classic ? 'all' : PROBES[id].rung]);
  // the training curve
  const sched = schedule(D, spec);
  const tau = r.float(6, 24);
  const trainBefore = (day) => sched.filter((o) => o.training && o.day < day).length;
  const s28 = trainBefore(28), H28 = 1 - Math.exp(-s28 / tau);
  const hCurve = (day) => (day >= 28 ? 1 : (1 - Math.exp(-trainBefore(day) / tau)) / H28);
  const hLin = (day) => Math.min(1, day / 28);
  const hTrue = spec.hShape === 'linear' ? hLin : hCurve;
  const hModel = (spec.hModel || spec.hShape) === 'linear' ? hLin : hCurve;
  // exposure (truth)
  const ex = {};
  for (const id of all) ex[id] = { n: 0, nt: 0, seen: 0 };
  const lamT = S.lambda;
  const occs = [], out = { reports: {}, verdicts: {}, meterMax: 0, items: 0, fits: 0, iters: 0, unconverged: 0, occasions: 0, data: spec.keepData ? [] : null };
  let last = null, prevDay = null, eta = null, doneM = -1;
  const ema = {};
  const reportSet = new Set(spec.reports);
  for (const o of sched) {
    if (!o.blocks.length) { prevDay = prevDay === null ? o.day : prevDay; continue; }
    if (prevDay !== null && o.day - prevDay > 56) for (const id of all) {
      const keep = 1 - S.breakLoss, f = (1 - Math.exp(-ex[id].n / lamT)) * keep;
      ex[id].n = f > 0 ? -lamT * Math.log(1 - f) : 0; ex[id].nt *= keep;
    }
    prevDay = o.day;
    const u = S.stateU * sp * r.normal(), hT = hTrue(o.day), blocks = [];
    for (const [id, m] of o.blocks) {
      const isC = id === ctl, ip = itemParams(id, opt), g = ip.g, a = ip.a;
      const s = S.stateS * sp * r.normal(), base = th0[id] + (isC ? 0 : G[id] * hT) + u + s;
      const Fx = F[id], Tx = isC ? Tct : Tsp, e = ex[id];
      // targeting prior: the trend model's prediction (or the running mean in summary mode)
      let center = 0;
      if (spec.mode === 'summary') center = ema[id] !== undefined ? ema[id] : 0;
      else if (last && e.seen > 0) { const pr = T.predict(last, id, hModel(o.day), o.day * DAY + 18 * 3600000); if (pr) center = pr.mean; }
      // the app's item pool spans the probe's range: a target never leaves it (here ±3 population SD)
      center = Math.max(-3 * sp, Math.min(3 * sp, center));
      const items = [], lw = GRID.map((x) => -((x - center) ** 2) / (2 * 2.25)), ll = new Array(GRID.length).fill(0);
      for (let k = 0; k < m; k++) {
        const kk = e.seen === 0 && k < 2 && spec.mode !== 'summary' ? 0.85 : 0.6;
        const post = summarize(lw), b = bFor(post.mu, kk, g, a), bT = b + S.itemNoise * r.normal();
        let th = base + Fx * (1 - Math.exp(-(e.n + k) / lamT)) + Tx * (e.nt + k) / 16, strand = -1;
        // the near probe's strands (tests/node/measure-cross.mjs): item i of the probe reads strand i mod 6,
        // and spec.shift(strand, day, h) adds that strand's own change (a layer's effect, strand deviations)
        if (spec.strands && id === spec.strands.probe) { strand = (e.seen + k) % spec.strands.n; th += spec.shift(strand, o.day, hT); }
        const ok = r.u() < pRight(th, bT, g, a) ? 1 : 0;
        items.push(strand >= 0 ? [b, g, ok, a, strand] : [b, g, ok, a]);
        for (let i = 0; i < GRID.length; i++) { const p = pRight(GRID[i], b, g, a), l = Math.log(ok ? p : 1 - p); lw[i] += l; ll[i] += l; }
      }
      e.n += m; e.nt += m; e.seen += m; out.items += m;
      if (spec.mode === 'summary') { // the spike's block summary: likelihood with a weak prior N(center, 3²)
        const lik = summarize(ll.map((v, i) => v - ((GRID[i] - center) ** 2) / 18));
        blocks.push({ probe: id, n: m, y: lik.mu, v: lik.sd * lik.sd });
        ema[id] = ema[id] === undefined ? lik.mu : 0.5 * ema[id] + 0.5 * lik.mu;
      } else blocks.push({ probe: id, items });
      if (out.data) out.data.push({ day: o.day, probe: id, items, theta: base });
    }
    const occ = { t: o.day * DAY + 18 * 3600000, h: hModel(o.day), kind: o.kind, blocks };
    occs.push(occ);
    out.occasions++;
    const f = T.fit(occs, { eta });
    if (!f.ok) throw new Error('fit failed: ' + f.why);
    out.fits++; out.iters += f.iterations; if (!f.converged) out.unconverged++;
    eta = f.eta; last = f;
    // milestone verdicts (once each, at the first occasion on or after the milestone, after the run-in)
    const ms = T.milestoneAt(f.day);
    let isMilestone = false;
    if (ms && ms.index > doneM && f.segment.runInDone && ms.day <= spec.lastMilestone) {
      doneM = ms.index; isMilestone = true;
      const v = {};
      for (const rd of Object.keys(f.gain)) v[rd] = T.verdict(f, ms, rd);
      out.verdicts[ms.day] = { day: o.day, words: v };
    }
    if (!isMilestone && f.day <= spec.horizon && f.gain.comp) out.meterMax = Math.max(out.meterMax, f.gain.comp.p);
    if (reportSet.has(o.day)) {
      const rep = {};
      for (const rd of Object.keys(f.gain)) {
        const gR = f.gain[rd];
        rep[rd] = { mean: gR.mean, sd: gR.sd, p: gR.p, pNone: gR.pNone, truth: truthOf(D, G, sp, gR.probes, hT, spec) };
      }
      out.reports[o.day] = rep;
    }
  }
  out.final = last;
  out.truthG = G; out.sigma = sp;
  return out;
}

// The true gain to date of a readout in its SD units: Σ w·G_p·h / σ / compFactor(w), equal weights.
function truthOf(D, G, sp, ids, h, spec) {
  const w = 1 / ids.length, rho = spec.truth.rho;
  const f = Math.sqrt((1 - rho) * ids.length * w * w + rho);
  return ids.reduce((s, id) => s + w * G[id] * h / sp, 0) / f;
}

const GRID = []; for (let x = -7; x <= 7.0001; x += 0.1) GRID.push(x);
function summarize(lw) {
  let mx = -Infinity; for (const v of lw) if (v > mx) mx = v;
  let s0 = 0, s1 = 0, s2 = 0;
  for (let i = 0; i < lw.length; i++) { const w = Math.exp(lw[i] - mx); s0 += w; s1 += w * GRID[i]; s2 += w * GRID[i] * GRID[i]; }
  const m = s1 / s0; return { mu: m, sd: Math.sqrt(Math.max(s2 / s0 - m * m, 1e-6)) };
}
