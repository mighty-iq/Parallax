/* The within-player crossover of PLAN milestone 4's add-on layers (docs/research/v1.2/T1-transfer-portfolio.md
   §5.3), simulated together with milestone 6's measurement design: node tests/node/measure-sim.mjs --crossover
   [--players 1500] [--seed 1] [--design N14]. Results: docs/dev/v1.2/measure-sim.md.

   The assignment (as the app would draw it, with PX.rng): a layer's eligible units are the near probe's strands
   whose exercises the player trains (compare rounds and bridge sets: six strands, turn ← rotate and spin,
   fold-back ← fold, cut-back ← slice, net-back ← nets, view-from ← views, where-am-I ← orient, reckon and homing;
   production variants: view-from, fold-back and cut-back; detailed calibration feedback: where-am-I alone). A
   seeded shuffle splits them into two halves (the odd unit to either half by the draw): one half has the layer on
   in period 1 (days 0–27) and off in period 2 (days 28–55), the other the reverse.

   Truth: on top of the probe learner model (measure-lib.mjs), every Other Way Round item reads one strand (item i
   of the probe: strand i mod 6, so a 6-item block reads every strand once), and the strand's ability changes by
   δ·σ while the layer is on (a linear rise over the period, then held: no decay), plus a strand deviation
   N(0, (0.3σ)²)·h(t) per player (strands gain unequally, whatever the layer).

   Analysis per player and period (two-stage, fixed in advance): each Other Way Round item is linearised at its
   block's fitted ability from the trend model (js/engine/trend.js, the fit at day 55); in every block the
   information-weighted mean working residual of the 'on' strands minus that of the 'off' strands, d_j, is free of
   everything the strands share (familiarity, tail, state, the common gain); the weighted least-squares slope of
   d_j over the period (time in period lengths) is the period's contrast. Pooled: the mean contrast over
   player-periods with its empirical SE; power at N players for a two-sided test at 5 %. Calibration (one unit):
   the strand-against-the-rest slope in its 'on' period minus that in its 'off' period, one value per player. */
import { hashSeed, makeRng, simulateLearner, LAPSE } from './measure-lib.mjs';

const STRANDS = ['turn', 'fold-back', 'cut-back', 'net-back', 'view-from', 'where-am-I'];
export const LAYERS = {
  compare: { units: [0, 1, 2, 3, 4, 5], label: 'comparison rounds (and bridge sets: the same six units)' },
  produce: { units: [4, 1, 2], label: 'draw-the-answer variants (Views, Fold, Slice)' },
  calib: { units: [5], label: 'detailed calibration feedback (Reckon, Homing; Central Point has no strand)' },
};

// The app's draw: eligible units shuffled with PX.rng; the first half (⌈n/2⌉ or ⌊n/2⌋, by the draw) is on in period 1.
export function assign(PX, playerSeed, layer, eligible) {
  const r = PX.rng(PX.rng.hash('bet-assign', playerSeed, layer)), u = eligible.slice();
  for (let i = u.length - 1; i > 0; i--) { const j = r.int(0, i); const x = u[i]; u[i] = u[j]; u[j] = x; }
  const k = u.length % 2 ? (r.chance(0.5) ? Math.ceil(u.length / 2) : Math.floor(u.length / 2)) : u.length / 2;
  const first = {};
  u.forEach((s, i) => { first[s] = i < k ? 1 : 2; });
  return first; // strand → the period in which its layer is on
}

const PERIOD = 28;
function contrastSlope(points) { // weighted least squares slope of d on tau, with intercept
  let W = 0, Wt = 0, Wd = 0;
  for (const p of points) { const w = 1 / p.v; W += w; Wt += w * p.tau; Wd += w * p.d; }
  if (points.length < 3 || !W) return null;
  const tb = Wt / W, db = Wd / W;
  let Stt = 0, Std = 0;
  for (const p of points) { const w = 1 / p.v; Stt += w * (p.tau - tb) ** 2; Std += w * (p.tau - tb) * (p.d - db); }
  return Stt > 0 ? { slope: Std / Stt, v: 1 / Stt } : null;
}

// Working residual of one item at the block's fitted ability eta: z = (y − p)/p', weight p'²/(p(1 − p)).
function work(item, eta) {
  const [b, g, ok] = item, a = item[4] || 1, s = 1 / (1 + Math.exp(-a * (eta - b))), top = 1 - g - LAPSE;
  const p = Math.min(1 - 1e-9, Math.max(1e-9, g + top * s)), dp = top * a * s * (1 - s);
  return { z: (ok - p) / dp, w: dp * dp / (p * (1 - p)) };
}

function playerContrasts(res, first, units, mode) {
  // Other Way Round blocks with their fitted abilities (the final fit's eta, in block order)
  const f = res.final, B = f.design.blocks, data = res.data.filter((d) => d.probe === 'otherway');
  const blocks = [];
  let x = 0;
  B.forEach((bl, k) => { if (bl.probe === 'otherway') { blocks.push({ day: data[x].day, items: data[x].items, eta: f.eta[k] }); x++; } });
  const out = {};
  for (const period of [1, 2]) {
    const lo = (period - 1) * PERIOD, hi = period * PERIOD, pts = [];
    for (const bl of blocks) {
      if (bl.day < lo || bl.day > hi) continue;
      const acc = { on: [0, 0], off: [0, 0] };
      for (const it of bl.items) {
        const s = it[5];
        let arm = null;
        if (mode === 'calib') arm = s === units[0] ? 'on' : 'off';             // the strand against the rest
        else if (first[s] !== undefined) arm = first[s] === period ? 'on' : 'off';
        if (!arm) continue;
        const wk = work(it, bl.eta);
        acc[arm][0] += wk.w * wk.z; acc[arm][1] += wk.w;
      }
      if (acc.on[1] > 0 && acc.off[1] > 0) pts.push({ tau: (bl.day - lo) / PERIOD, d: acc.on[0] / acc.on[1] - acc.off[0] / acc.off[1], v: 1 / acc.on[1] + 1 / acc.off[1] });
    }
    out[period] = contrastSlope(pts);
  }
  return out;
}

const z975 = 1.959964, z80 = 0.841621;
const Phi = (x) => { const t = 1 / (1 + 0.3275911 * Math.abs(x) / Math.SQRT2), y = 1 - (((((1.061405429 * t - 1.453152027) * t) + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-x * x / 2); return x >= 0 ? 0.5 * (1 + y) : 0.5 * (1 - y); };

export function crossover(PX, T, opts) {
  const lines = [], data = { layers: {}, balance: {} }, sp = opts.truth.sigma, P = opts.players, eligibleP = 0.8;
  T.configure('reset'); T.configure(opts.model);
  const t0 = Date.now();
  lines.push(`Crossover (PLAN milestone 4) on measurement design ${opts.designName}: ${P} players per layer and effect size, seed ${opts.seed}; ` +
    `a unit is eligible when the player trains its exercises (probability ${eligibleP} each); periods of 28 days (3 sessions a week).`);
  for (const [layer, L] of Object.entries(LAYERS)) {
    data.layers[layer] = {};
    for (const delta of [0, 0.3]) {
      const players = [];
      for (let i = 0; i < P; i++) {
        // the same player (seed, eligibility, draw, strand deviations, answers' random numbers) with and without the effect
        const seed = hashSeed('cross', opts.seed, layer, i), rr = makeRng(hashSeed('cross-elig', opts.seed, layer, i));
        let elig = L.units.filter(() => rr.chance(eligibleP));
        if (layer !== 'calib' && elig.length < 2) elig = L.units.slice(0, 2); // a split needs two units
        if (layer === 'calib') elig = L.units.slice();
        const first = layer === 'calib' ? { [L.units[0]]: rr.chance(0.5) ? 1 : 2 } : assign(PX, seed, layer, elig);
        const dev = STRANDS.map(() => 0.3 * sp * rr.normal());
        const spec = { ...opts.spec(), keepData: true, strands: { probe: 'otherway', n: 6 },
          shift: (s, day, h) => {
            let v = dev[s] * h;
            if (first[s] !== undefined) { const st = (first[s] - 1) * PERIOD; v += delta * sp * Math.max(0, Math.min(1, (day - st) / PERIOD)); }
            return v;
          } };
        const res = simulateLearner(T, spec, seed);
        const c = playerContrasts(res, first, L.units, layer === 'calib' ? 'calib' : 'split');
        const cs = [];
        if (layer === 'calib') { const on = first[L.units[0]], a = c[on], b = c[3 - on]; if (a && b) cs.push((a.slope - b.slope) / sp); }
        else for (const k of [1, 2]) if (c[k]) cs.push(c[k].slope / sp);
        players.push(cs);
      }
      const all = players.flat(), m = all.reduce((s, v) => s + v, 0) / all.length;
      const sd = Math.sqrt(all.reduce((s, v) => s + (v - m) ** 2, 0) / (all.length - 1));
      // the SE of a community mean from the spread of per-player means (keeps any correlation within a player)
      const pm = players.filter((x) => x.length).map((x) => x.reduce((s, v) => s + v, 0) / x.length), pmm = pm.reduce((s, v) => s + v, 0) / pm.length;
      const sdPlayer = Math.sqrt(pm.reduce((s, v) => s + (v - pmm) ** 2, 0) / (pm.length - 1));
      data.layers[layer][delta] = { mean: m, sd, sdPlayer, n: all.length, players: pm.length, perPlayer: all.length / P, values: players };
    }
    const d0 = data.layers[layer][0], d3 = data.layers[layer][0.3];
    // paired: each player's contrast with the effect minus the same player's without it
    const diffs = [];
    d3.values.forEach((x, i) => { const y = d0.values[i]; if (x.length && y.length === x.length) diffs.push(x.reduce((a, b, k) => a + b - y[k], 0) / x.length); });
    const kappa = diffs.reduce((a, b) => a + b, 0) / diffs.length / 0.3;
    const kSe = Math.sqrt(diffs.reduce((a, b) => a + (b - 0.3 * kappa) ** 2, 0) / (diffs.length - 1) / diffs.length) / 0.3;
    const se1 = (n) => d3.sdPlayer / Math.sqrt(n);
    const mde = (n) => (z975 + z80) * se1(n) / kappa;
    const power = (n, d) => 100 * Phi(Math.abs(kappa * d) / se1(n) - z975);
    data.layers[layer].summary = { kappa, kappaSe: kSe, sdPlayer: d3.sdPlayer, mde: Object.fromEntries([50, 100, 200, 400, 800, 1600].map((n) => [n, mde(n)])) };
    lines.push(`  ${layer}: ${L.label}`);
    lines.push(`    no effect: mean contrast ${d0.mean.toFixed(3)} SD (SE ${(d0.sdPlayer / Math.sqrt(d0.players)).toFixed(3)}); effect 0.3 SD: mean ${d3.mean.toFixed(3)} SD ` +
      `(paired with the same players: ${(100 * kappa).toFixed(0)} ± ${(100 * kSe).toFixed(0)} % of the effect recovered); SD of a player's mean contrast ${d3.sdPlayer.toFixed(2)} (${d3.perPlayer.toFixed(2)} contrasts per player)`);
    lines.push('    detectable effect at 80 % power (two-sided 5 %), in per-probe SD of the near probe, by players completing both periods: ' +
      [50, 100, 200, 400, 800, 1600].map((n) => `${n}: ${mde(n).toFixed(2)}`).join(', '));
    lines.push('    power for 0.2 / 0.3 / 0.5 SD: ' + [100, 200, 400, 800].map((n) => `${n} players ${power(n, 0.2).toFixed(0)} / ${power(n, 0.3).toFixed(0)} / ${power(n, 0.5).toFixed(0)} %`).join('; '));
    // the formula checked by a bootstrap of simulated players (communities of 200 drawn with replacement)
    const rr = makeRng(hashSeed('bootstrap', opts.seed, layer)), reps = 2000, n = 200, pool = d3.values.filter((x) => x.length);
    let rej = 0;
    for (let q = 0; q < reps; q++) {
      let s = 0, s2 = 0;
      for (let i = 0; i < n; i++) { const x = pool[Math.floor(rr.u() * pool.length)], v = x.reduce((a, b) => a + b, 0) / x.length; s += v; s2 += v * v; }
      const mm = s / n, sdd = Math.sqrt(Math.max(0, (s2 - n * mm * mm) / (n - 1)));
      if (Math.abs(mm / (sdd / Math.sqrt(n))) > z975) rej++;
    }
    const fPow = 100 * Phi(Math.abs(d3.mean) / (d3.sdPlayer / Math.sqrt(n)) - z975);
    lines.push(`    bootstrap check (${reps} communities of ${n} simulated players drawn from the effect-0.3 pool, whose mean is ${d3.mean.toFixed(3)} SD): rejected in ${(100 * rej / reps).toFixed(0)} %, the normal formula at that mean says ${fPow.toFixed(0)} %`);
    data.layers[layer].bootstrap = { reps, n, power: 100 * rej / reps };
    for (const dl of [0, 0.3]) delete data.layers[layer][dl].values;
  }
  T.configure('reset');
  // balance of the draw itself: 100 000 players, each unit eligible with probability eligibleP
  const nP = 100000, first1 = new Array(6).fill(0), elig1 = new Array(6).fill(0), diffs = {}, rr = makeRng(hashSeed('balance', opts.seed));
  let counted = 0;
  for (let i = 0; i < nP; i++) {
    const elig = [0, 1, 2, 3, 4, 5].filter(() => rr.chance(eligibleP));
    if (elig.length < 2) continue;
    counted++;
    const first = assign(PX, hashSeed('bal', opts.seed, i), 'compare', elig);
    let n1 = 0;
    for (const s of elig) { elig1[s]++; if (first[s] === 1) { first1[s]++; n1++; } }
    const d = 2 * n1 - elig.length;
    diffs[d] = (diffs[d] || 0) + 1;
  }
  const shares = first1.map((x, s) => 100 * x / elig1[s]);
  data.balance = { players: counted, shares, diffs };
  lines.push(`  balance of the draw (${counted} players with at least two eligible units of six): on in period 1 for ` +
    STRANDS.map((s, i) => `${s} ${shares[i].toFixed(1)} %`).join(', ') + '; on minus off units per player: ' +
    Object.entries(diffs).sort((a, b) => a[0] - b[0]).map(([d, n]) => `${d}: ${(100 * n / counted).toFixed(1)} %`).join(', '));
  lines.push(`  (${((Date.now() - t0) / 1000).toFixed(0)} s)`);
  return { text: lines.join('\n'), data };
}
