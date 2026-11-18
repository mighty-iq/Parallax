// P1 stall-detector calibration (scratch; not part of the repository).
// Plays simulated learners on ONE real Parallax exercise with the real engine's item choice
// (select.pick, 8/1/1 deck, 2 warm-ups, Balanced k = 0.70) and rating (est.rate), and records,
// at the end of every session, the statistics several stall detectors would use.
// Usage: node detector.mjs --ex fold --n 300 --kind linear|plateau|expo|step --slope 0.2 --onset 320 --out file.json
import fs from 'node:fs';
import { createContext } from '../../../../../tests/node/run.mjs';

const args = Object.fromEntries(process.argv.slice(2).reduce((a, x, i, arr) => (x.startsWith('--') ? a.concat([[x.slice(2), arr[i + 1]]]) : a), []));
const EX = args.ex || 'fold';
const N = +(args.n || 300);
const KIND = args.kind || 'linear';
const SLOPE = +(args.slope ?? 0.2);        // logits per 100 rated answers (linear; or pre-onset slope for plateau)
const ONSET = +(args.onset ?? 320);        // plateau: answers before the plateau starts
const TOTAL = +(args.total ?? 1200);       // rated answers per learner on the exercise
const DAYSD = +(args.daysd ?? 0.15);       // day-to-day noise of true ability
const SEED = args.seed || 'p1';
const MISSPEC = !!args.misspec;

const { PX } = createContext({});
const E = PX.engine, M = E.model;
const def = PX.ex.get(EX);
if (!def) throw new Error('no exercise ' + EX);
const DAY = 86400000;
const range = M.range(def);
const LVL = 99 / (range.max - range.min);
const sig = (x) => 1 / (1 + Math.exp(-x));

// Trial-level logistic slope with known item difficulties and guessing (lapse 0.03, as the engine).
// x, b, g, u (u = answer index centred, in hundreds), sess (session index per answer)
function slopeFit(x, b, g, u, sess, a0) {
  let a = a0, be = 0;
  const lam = 0.03, n = x.length;
  let I00 = 0, I01 = 0, I11 = 0;
  for (let it = 0; it < 30; it++) {
    let s0 = 0, s1 = 0; I00 = 1 / 4; I01 = 0; I11 = 1;   // weak priors: a ~ N(a0, 2^2), beta ~ N(0, 1^2)
    s0 -= (a - a0) / 4; s1 -= be / 1;
    for (let i = 0; i < n; i++) {
      const A = 1 - g[i] - lam, s = sig(a + be * u[i] - b[i]), P = g[i] + A * s, dP = A * s * (1 - s);
      const w = dP * dP / (P * (1 - P)), r = (x[i] - P) * dP / (P * (1 - P));
      s0 += r; s1 += r * u[i]; I00 += w; I01 += w * u[i]; I11 += w * u[i] * u[i];
    }
    const det = I00 * I11 - I01 * I01;
    const da = (I11 * s0 - I01 * s1) / det, db = (I00 * s1 - I01 * s0) / det;
    a += Math.max(-2, Math.min(2, da)); be += Math.max(-2, Math.min(2, db));
    if (Math.abs(da) < 1e-6 && Math.abs(db) < 1e-6) break;
  }
  const det = I00 * I11 - I01 * I01;
  const se = Math.sqrt(I00 / det);
  // over-dispersion between sessions (day-to-day noise): Pearson chi-square of per-session level residuals
  const S = new Map();
  for (let i = 0; i < n; i++) {
    const A = 1 - g[i] - 0.03, s = sig(a + be * u[i] - b[i]), P = g[i] + A * s, dP = A * s * (1 - s);
    const w = dP * dP / (P * (1 - P)), r = (x[i] - P) * dP / (P * (1 - P));
    const o = S.get(sess[i]) || { r: 0, w: 0 }; o.r += r; o.w += w; S.set(sess[i], o);
  }
  let chi = 0; for (const o of S.values()) chi += o.r * o.r / o.w;
  const K = S.size, phi = K > 2 ? Math.max(1, chi / (K - 2)) : 1;
  return { a, beta: be, se, phi, seAdj: se * Math.sqrt(phi), K };
}

function trueTheta(L, n) {
  if (KIND === 'linear') return L.t0 + SLOPE * n / 100;
  if (KIND === 'plateau') return L.t0 + SLOPE * Math.min(n, ONSET) / 100;
  if (KIND === 'expo') return L.t0 + L.G * (1 - Math.exp(-n / L.tau));
  if (KIND === 'step') { // flat, a jump of +0.6 at ONSET (a strategy discovery), flat again
    return L.t0 + (n >= ONSET ? 0.6 : 0);
  }
  throw new Error(KIND);
}
function trueSlope(L, n) { // logits per 100 answers at answer n
  if (KIND === 'linear') return SLOPE;
  if (KIND === 'plateau') return n < ONSET ? SLOPE : 0;
  if (KIND === 'expo') return 100 * L.G / L.tau * Math.exp(-n / L.tau);
  if (KIND === 'step') return 0;
}

const out = { ex: EX, kind: KIND, slope: SLOPE, onset: ONSET, total: TOTAL, n: N, lvlPerLogit: LVL, learners: [] };
const T0 = Date.UTC(2026, 10, 2, 17, 0, 0);
for (let li = 0; li < N; li++) {
  const r = PX.rng(PX.rng.hash(SEED, EX, KIND, SLOPE, ONSET, li));
  const L = {
    t0: range.min + 1.0 + r.normal(0, 0.4),
    lapse: r.float(0.01, 0.06),
    G: Math.exp(r.normal(Math.log(1.4), 0.35)) * Math.exp(r.normal(0, 0.35)),
    tau: r.float(150, 500),
  };
  const rec = { ex: {}, trials: [], idx: { ex: [], mode: [] }, eng: { seedN: 0, salt: 1 } };
  const xs = [], bs = [], gs = [], ns = [], ss = [];
  let n = 0, day = 0, sIdx = 0;
  const evals = [];
  const levelHist = []; // [day, level, sd]
  const dayNoise = new Map();
  while (n < TOTAL) {
    // next practice day: 3.5 sessions a week on this exercise on average
    day += 1 + (r.chance(0.5) ? 1 : 0) + (r.chance(0.25) ? 1 : 0);
    if (!dayNoise.has(day)) dayNoise.set(day, r.normal(0, DAYSD));
    let now = T0 + day * DAY;
    const m = r.int(25, 55); // rated answers on this exercise this session
    const deck = [];
    for (let k = 0; k < m && n < TOTAL; k++) {
      let kind;
      if (k < 2) kind = 'warmup';
      else if (k === m - 1) kind = 'last';
      else {
        if (!deck.length) { const d = ['target', 'target', 'target', 'target', 'target', 'target', 'target', 'target', 'easy', 'stretch']; deck.push(...r.shuffle(d)); }
        kind = deck.pop();
      }
      const st = E.est.get(rec, def, {}, now);
      const weak = kind === 'target' && r.chance(0.2) ? E.select.weak(rec, def) : null;
      const pk = E.select.pick(def, st, { kind, k: 0.70, policy: 'high', recent: E.select.recent(rec, def), weak, rng: r });
      E.select.note(rec, def, pk.cand);
      const th = trueTheta(L, n) + dayNoise.get(day);
      let bt = pk.b;
      if (MISSPEC) {
        bt += r.normal(0, 0.5);
        if (def.dims.length >= 2) {
          const da = def.dims[0], dc = def.dims[1];
          const ra = (pk.params[da.key] || 0) / Math.max(1, da.levels.length - 1), rc = (pk.params[dc.key] || 0) / Math.max(1, dc.levels.length - 1);
          bt += 0.8 * ra * rc;
        }
      }
      const p = (1 - L.lapse) * (pk.g + (1 - pk.g) * sig(th - bt)) + L.lapse * pk.g;
      const ok = r.chance(p);
      E.est.rate(rec, def, pk.params, ok, now, { b: pk.b, g: pk.g });
      E.select.residual(rec, def, pk.cand, ok, pk.p);
      xs.push(ok ? 1 : 0); bs.push(pk.b); gs.push(pk.g); ns.push(n); ss.push(sIdx);
      n++;
      now += 9000;
    }
    const sh = E.est.shown(rec, def);
    levelHist.push([day, sh.exact, sh.sd, sh.mu]);
    // evaluation at the session end
    const ev = { n, s: sIdx, day, tslope: trueSlope(L, n - 1), lp: E.bandit.lp(rec, def).lp, mu: sh.mu, sd: sh.sd };
    for (const W of (args.windows ? args.windows.split(",").map(Number) : [160, 240, 320, 400])) {
      if (n < W) continue;
      const lo = n - W;
      const u = []; let mean = 0;
      for (let i = lo; i < n; i++) mean += ns[i]; mean /= W;
      for (let i = lo; i < n; i++) u.push((ns[i] - mean) / 100);
      const f = slopeFit(xs.slice(lo), bs.slice(lo), gs.slice(lo), u, ss.slice(lo), sh.mu);
      const firstDay = levelHist.length ? null : null;
      ev['w' + W] = { b: +f.beta.toFixed(4), se: +f.se.toFixed(4), seA: +f.seAdj.toFixed(4), K: f.K };
    }
    // the plan's draft rule 2: level change over the last 14 days inside its noise band
    const back = levelHist.filter((h) => h[0] <= day - 14);
    if (back.length) {
      const h = back[back.length - 1];
      const sessIn14 = levelHist.filter((q) => q[0] > day - 14).length;
      ev.d14 = { dl: +(sh.exact - h[1]).toFixed(2), band: +(1.96 * Math.sqrt(sh.sd * sh.sd + h[2] * h[2]) * LVL).toFixed(2), sess: sessIn14 };
    }
    evals.push(ev);
    sIdx++;
  }
  out.learners.push({ t0: L.t0, G: L.G, tau: L.tau, evals });
}
fs.writeFileSync(args.out || `/tmp/p1sim/out-${EX}-${KIND}-${SLOPE}-${ONSET}.json`, JSON.stringify(out));
console.log('done', EX, KIND, SLOPE, ONSET, N, 'learners');
