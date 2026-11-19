/* Pattern Memory scored by cells (PLAN milestone 6's last probe upgrade; note M1 §4.3 assumed ×2 information):
   node tests/node/measure-cells.mjs [--players 2000] [--seed 1]                         per-occasion table
   node tests/node/measure-cells.mjs --efficiency [--reps 3000] [--m 5] [--easy 2] [--taus 1,1.25,1.5] [--ks 0.6,0.45,0.35]
   Results: docs/dev/v1.2/measure-sim.md §12 (the app's model: js/engine/trend.js, E.trend.cells).

   The question: does a score by cells carry more information per item than the exact-pattern score, with 90 %
   intervals that stay honest when the cells of one pattern are correlated (a pattern that chunks well is recalled
   well as a whole), and under which response model and item target?

   Truth, per item at a pool level (size s, regularity r: the real 21 levels, K filled of N cells):
     each filled cell is recalled with p = σ(θ + u − β), u ~ N(0, τt²) shared by the item's cells;
     β = b + e − Δ(K, τt), so the whole pattern is recalled half the time at θ = b + e (b the version-1 difficulty,
     e a level misspecification ~ N(0, 0.3²) when switched on, the same for both scorings);
     every forgotten cell is, with probability γ, replaced by a guess on a random unmarked cell (a false alarm
     unless it lands on another forgotten cell); with probability 0.03 the item is a lapse (p halved).
   Scores: exact (every filled cell marked, nothing else); cells s = max(0, hits − false alarms), y = s / K.
   Models (what the app would use):
     exact: P = g + (1 − g − 0.03)·σ(θ − b), version 1's model;
     cells: P(s | θ) = 0.97·E_u[Binomial(s; K, σ(θ + u − b + Δ(K, τm)))] + 0.03 / (K + 1), u ~ N(0, τm²).
   Items aim at the model's exact-pattern chance k (0.6 is version 1's target, lower k gives larger grids), first
   two items of a block at 0.85; the targeting prior is centred at θ + N(0, 0.7²) with SD 1.5 (the trend model's
   prediction); the readout is the posterior under the standard prior N(0, 1.5²) (abilities ~ N(0, 1)).
   Reported: posterior SD, RMSE, 90 % coverage, and information (1/SD² − 1/1.5²) relative to the exact score. */

const args = process.argv.slice(2);
const opt = (k, d) => { const i = args.indexOf('--' + k); return i >= 0 ? Number(args[i + 1]) : d; };
const PLAYERS = opt('players', 2000), SEED = opt('seed', 1);

let st = (SEED * 2654435761) >>> 0 || 1;
function rnd() { st ^= st << 13; st >>>= 0; st ^= st >>> 17; st ^= st << 5; st >>>= 0; return st / 4294967296; }
function norm() { let u = 0; while (u === 0) u = rnd(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * rnd()); }
const sig = (x) => (x >= 0 ? 1 / (1 + Math.exp(-x)) : Math.exp(x) / (1 + Math.exp(x)));

const SIZES = [[3, 3, 4], [3, 4, 6], [4, 4, 8], [4, 5, 10], [5, 5, 12], [5, 6, 15], [6, 6, 18]];
function comb(n, k) { let r = 1; for (let i = 1; i <= k; i++) r = r * (n - k + i) / i; return r; }
const POOL = [];
for (let s = 0; s < 7; s++) for (let r = 0; r < 3; r++) {
  const [R, C, K] = SIZES[s], N = R * C;
  POOL.push({ s, r, K, N, b: -2.1 + 0.45 * s + 0.75 * r, g: Math.max(1 / comb(N, K), 0.001) });
}
const LAPSE = 0.03;
// u ~ N(0, τ²) by a 17-point rule on z ∈ [−4, 4] (smooth integrands: plenty)
const Z = [], W = [];
for (let i = 0; i <= 16; i++) { const z = -4 + 0.5 * i; Z.push(z); W.push(Math.exp(-z * z / 2)); }
{ const s = W.reduce((a, b) => a + b, 0); for (let i = 0; i < W.length; i++) W[i] /= s; }
// Δ(K, τ): the cell offset at which the whole pattern is recalled half the time
const DCACHE = new Map();
function delta(K, tau) {
  const key = K + ':' + tau;
  if (DCACHE.has(key)) return DCACHE.get(key);
  let lo = -2, hi = 12;
  for (let it = 0; it < 60; it++) {
    const m = (lo + hi) / 2;
    let p = 0; for (let j = 0; j < Z.length; j++) p += W[j] * Math.pow(sig(m + tau * Z[j]), K);
    if (p < 0.5) lo = m; else hi = m;
  }
  DCACHE.set(key, (lo + hi) / 2);
  return (lo + hi) / 2;
}

const GRID = []; for (let x = -6; x <= 6.0001; x += 0.05) GRID.push(x);
const G = GRID.length;
// log-likelihood tables over the grid: exact [level][ok], cells [τm][level][s]
const LL_EXACT = POOL.map((it) => [0, 1].map((ok) => GRID.map((th) => {
  const p = it.g + (1 - it.g - LAPSE) * sig(th - it.b); return Math.log(ok ? p : 1 - p);
})));
const LL_CELLS = new Map();
function cellsTable(tau) {
  if (LL_CELLS.has(tau)) return LL_CELLS.get(tau);
  const t = POOL.map((it) => {
    const beta = it.b - delta(it.K, tau), rows = [];
    for (let s = 0; s <= it.K; s++) rows.push(new Float64Array(G));
    for (let i = 0; i < G; i++) {
      const P = new Float64Array(it.K + 1);
      for (let j = 0; j < Z.length; j++) {
        const p = sig(GRID[i] + tau * Z[j] - beta);
        for (let s = 0; s <= it.K; s++) P[s] += W[j] * comb(it.K, s) * Math.pow(p, s) * Math.pow(1 - p, it.K - s);
      }
      for (let s = 0; s <= it.K; s++) rows[s][i] = Math.log((1 - LAPSE) * P[s] + LAPSE / (it.K + 1));
    }
    return rows;
  });
  LL_CELLS.set(tau, t);
  return t;
}

function summary(lw) {
  let mx = -Infinity; for (let i = 0; i < G; i++) if (lw[i] > mx) mx = lw[i];
  let s0 = 0, s1 = 0, s2 = 0;
  const w = new Float64Array(G);
  for (let i = 0; i < G; i++) { w[i] = Math.exp(lw[i] - mx); s0 += w[i]; s1 += w[i] * GRID[i]; s2 += w[i] * GRID[i] * GRID[i]; }
  const mu = s1 / s0, sd = Math.sqrt(Math.max(s2 / s0 - mu * mu, 1e-9));
  let c = 0, lo = GRID[0], hi = GRID[G - 1], gotLo = false;
  for (let i = 0; i < G; i++) { c += w[i] / s0; if (!gotLo && c >= 0.05) { lo = GRID[i]; gotLo = true; } if (c >= 0.95) { hi = GRID[i]; break; } }
  return { mu, sd, lo, hi };
}

// one item from the truth
function respond(it, theta, tauT, gamma, e) {
  const beta = it.b + e - delta(it.K, tauT), u = tauT * norm(), lapse = rnd() < LAPSE;
  let p = sig(theta + u - beta); if (lapse) p *= 0.5;
  let hits = 0; for (let c = 0; c < it.K; c++) if (rnd() < p) hits++;
  let forgot = it.K - hits, empty = it.N - it.K, fa = 0;
  const guesses = []; for (let c = 0; c < it.K - hits; c++) guesses.push(rnd() < gamma);
  for (const gu of guesses) {
    if (!gu) continue;
    if (rnd() < forgot / (forgot + empty)) { hits++; forgot--; } else { fa++; empty--; }
  }
  return { exact: hits === it.K && fa === 0, s: Math.max(0, hits - fa) };
}

function pick(lwT, k, recent) {
  const post = summary(lwT), kk = 1 / Math.sqrt(1 + Math.PI * post.sd * post.sd / 8);
  const errs = POOL.map((it, j) => {
    const p = it.g + (1 - it.g - LAPSE) * sig((post.mu - it.b) * kk), tg = it.g + (1 - it.g) * k;
    return { j, e: Math.abs(p - tg) + (recent.includes(j) ? 0.5 : 0) };
  });
  const best = Math.min(...errs.map((x) => x.e));
  const near = errs.filter((x) => x.e <= best + 0.05);
  return near[Math.floor(rnd() * near.length)].j;
}

// one configuration: { m items, k target, tauT, gamma, mis (level misspecification on), tauM (null = exact) }
function run(cfg) {
  const tab = cfg.tauM === null ? null : cellsTable(cfg.tauM);
  let cover = 0, se2 = 0, sdS = 0, info = 0, exactRate = 0, yMean = 0, n = 0;
  for (let pl = 0; pl < PLAYERS; pl++) {
    const theta = norm(), center = theta + 0.7 * norm();
    const E = POOL.map(() => (cfg.mis ? 0.3 * norm() : 0));
    const lwT = GRID.map((x) => -((x - center) ** 2) / (2 * 2.25));
    const lwS = GRID.map((x) => -(x * x) / (2 * 2.25));
    const recent = [];
    for (let i = 0; i < cfg.m; i++) {
      const j = pick(lwT, i < 2 ? 0.85 : cfg.k, recent);
      recent.push(j); if (recent.length > 3) recent.shift();
      const it = POOL[j], r = respond(it, theta, cfg.tauT, cfg.gamma, E[j]);
      const ll = tab ? tab[j][r.s] : LL_EXACT[j][r.exact ? 1 : 0];
      for (let q = 0; q < G; q++) { lwT[q] += ll[q]; lwS[q] += ll[q]; }
      exactRate += r.exact ? 1 : 0; yMean += r.s / it.K; n++;
    }
    const s = summary(lwS);
    if (theta >= s.lo && theta <= s.hi) cover++;
    se2 += (s.mu - theta) ** 2; sdS += s.sd; info += 1 / (s.sd * s.sd) - 1 / 2.25;
  }
  return { cover: cover / PLAYERS, rmse: Math.sqrt(se2 / PLAYERS), sd: sdS / PLAYERS, info: info / PLAYERS, exact: exactRate / n, y: yMean / n };
}

// Efficiency at fixed abilities (what the trend model sums over blocks): blocks of m items at θ, the estimate the
// block's likelihood gives (posterior under a weak N(0, 3²)); efficiency = (dE[θ̂]/dθ)² / Var(θ̂) per item, against
// what the model claims (1 / mean posterior variance). Honest when the claim does not exceed the efficiency.
function efficiency(cfg, reps) {
  const tab = cfg.tauM === null ? null : cellsTable(cfg.tauM), TH = [-1.5, -0.75, 0, 0.75, 1.5], out = [];
  for (const theta of TH) {
    let s1 = 0, s2 = 0, v = 0;
    for (let rep = 0; rep < reps; rep++) {
      const center = theta + 0.7 * norm(), E = POOL.map(() => (cfg.mis ? 0.3 * norm() : 0));
      const lwT = GRID.map((x) => -((x - center) ** 2) / (2 * 2.25)), lwS = GRID.map((x) => -(x * x) / 18), recent = [];
      for (let i = 0; i < cfg.m; i++) {
        const j = pick(lwT, i < cfg.easy ? 0.85 : cfg.k, recent);
        recent.push(j); if (recent.length > 3) recent.shift();
        const r = respond(POOL[j], theta, cfg.tauT, cfg.gamma, E[j]), ll = tab ? tab[j][r.s] : LL_EXACT[j][r.exact ? 1 : 0];
        for (let q = 0; q < G; q++) { lwT[q] += ll[q]; lwS[q] += ll[q]; }
      }
      const s = summary(lwS); s1 += s.mu; s2 += s.mu * s.mu; v += s.sd * s.sd;
    }
    const mean = s1 / reps; out.push({ theta, mean, varr: s2 / reps - mean * mean, claim: v / reps });
  }
  // the middle three abilities: slope by central differences, efficiency and claim per block
  let eff = 0, claim = 0, bias = 0;
  for (let i = 1; i < TH.length - 1; i++) {
    const slope = (out[i + 1].mean - out[i - 1].mean) / (TH[i + 1] - TH[i - 1]);
    eff += slope * slope / out[i].varr / 3; claim += 1 / out[i].claim / 3; bias += (out[i].mean - TH[i]) / 3;
  }
  return { eff, claim, bias, slopeAll: (out[TH.length - 1].mean - out[0].mean) / (TH[TH.length - 1] - TH[0]) };
}

const f3 = (x) => x.toFixed(3), f2 = (x) => x.toFixed(2), pc = (x) => (100 * x).toFixed(1);
const t0 = Date.now();
if (args.includes('--efficiency')) {
  const reps = opt('reps', 3000), m = opt('m', 5), easy = opt('easy', 2);
  const TAUS = args.includes('--taus') ? args[args.indexOf('--taus') + 1].split(',').map(Number) : [1.0, 1.25, 1.5];
  const KS = args.includes('--ks') ? args[args.indexOf('--ks') + 1].split(',').map(Number) : [0.6, 0.45, 0.35];
  console.log('Efficiency per ' + m + '-item block, the first ' + easy + ' easy (' + reps + ' blocks per ability): truth | model | k | slope | efficiency | claimed | claim/eff | x exact');
  for (const tauT of [0.5, 1.0, 1.5]) for (const gamma of [0, 0.5]) {
    const base = efficiency({ m, easy, k: 0.6, tauT, gamma, mis: true, tauM: null }, reps);
    const line = (label, k, r) => console.log(['tau ' + tauT + ', guess ' + gamma, label, k, f2(r.slopeAll), f2(r.eff), f2(r.claim), f2(r.claim / r.eff), f2(r.eff / base.eff)].join(' | '));
    line('exact', 0.6, base);
    for (const tauM of TAUS) for (const k of KS) line('cells tau ' + tauM, k, efficiency({ m, easy, k, tauT, gamma, mis: true, tauM }, reps));
  }
  console.log('done in ' + ((Date.now() - t0) / 1000).toFixed(0) + ' s');
  process.exit(0);
}
console.log('Pattern Memory by cells: ' + PLAYERS + ' simulated players per row, seed ' + SEED);
console.log('m items | truth tau, guess, level error | model | target k | exact rate | mean y | post SD | RMSE | 90% cover | info | x exact');
for (const m of [2, 5]) for (const tauT of [0.5, 1.0, 1.5]) for (const gamma of [0, 0.5]) for (const mis of [false, true]) {
  if (mis && gamma === 0) continue; // misspecification with guesses only (the harder case)
  const base = run({ m, k: 0.6, tauT, gamma, mis, tauM: null });
  const line = (label, k, r) => console.log([m, 'tau ' + tauT + ', guess ' + gamma + ', ' + (mis ? 'level error 0.3' : 'no level error'), label, k,
    pc(r.exact), f2(r.y), f3(r.sd), f3(r.rmse), pc(r.cover), f2(r.info), f2(r.info / base.info)].join(' | '));
  line('exact', 0.6, base);
  for (const tauM of [0.75, 1.0, 1.25]) for (const k of [0.6, 0.35]) line('cells tau ' + tauM, k, run({ m, k, tauT, gamma, mis, tauM }));
}
console.log('done in ' + ((Date.now() - t0) / 1000).toFixed(0) + ' s');
