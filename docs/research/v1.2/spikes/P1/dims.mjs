// P1 per-dimension targeting check (scratch; not part of the repository).
// Learners whose step weights differ from the population's (random-weights LLTM):
//   b_true = b(params) + sum_d z_d * (lv_d - mid_d),  z_d ~ N(0, (SDF * |step_d|)^2)
// Conditions: cur (the engine as it is), oracle (selection and rating know z), est (offsets
// refitted at every session end by ridge logistic regression on the last 400 answers, with the
// rating before each answer as the ability offset).
import { createContext } from '../../../../../tests/node/run.mjs';
const args = Object.fromEntries(process.argv.slice(2).reduce((a, x, i, arr) => (x.startsWith('--') ? a.concat([[x.slice(2), arr[i + 1]]]) : a), []));
const EX = args.ex || 'fold', N = +(args.n || 200), TOTAL = +(args.total || 800), SDF = +(args.sdf || 0.5), COND = args.cond || 'cur';
const TAU = +(args.tau || 0.5); // ridge prior SD of each offset, as a multiple of |step|
const { PX } = createContext({});
const E = PX.engine, M = E.model;
const base = PX.ex.get(EX);
const dims = base.dims.map((d, i) => ({ i, key: d.key, n: d.levels.length, step: Math.abs(d.step || 0.3), mid: (d.levels.length - 1) / 2 })).filter((d) => d.n > 1);
const sig = (x) => 1 / (1 + Math.exp(-x));
const lvOf = (params, d) => (params[d.key] || 0);
function clone(off) {
  const c = Object.create(base);
  Object.defineProperty(c, 'difficulty', { value: (p) => base.difficulty(p) + dims.reduce((s, d, j) => s + off[j] * (lvOf(p, d) - d.mid), 0), enumerable: true });
  return c;
}
function fitOffsets(H, step) { // ridge logistic: logit-scale offsets o_j, eta = mu - b - sum o_j (lv - mid)
  const J = dims.length; let o = new Array(J).fill(0);
  for (let it = 0; it < 20; it++) {
    const g = new Array(J).fill(0), Hm = Array.from({ length: J }, () => new Array(J).fill(0));
    for (let j = 0; j < J; j++) { const t2 = (TAU * dims[j].step) ** 2; g[j] -= o[j] / t2; Hm[j][j] += 1 / t2; }
    for (const h of H) {
      const A = 1 - h.g - 0.03; let eta = h.mu - h.b; for (let j = 0; j < J; j++) eta -= o[j] * h.x[j];
      const s = sig(eta), P = h.g + A * s, dP = A * s * (1 - s), w = dP * dP / (P * (1 - P)), r = (h.y - P) * dP / (P * (1 - P));
      for (let j = 0; j < J; j++) { g[j] += -r * h.x[j]; for (let k = 0; k < J; k++) Hm[j][k] += w * h.x[j] * h.x[k]; }
    }
    // solve Hm * d = g (small J): Gaussian elimination
    const A2 = Hm.map((row, j) => row.concat([g[j]]));
    for (let c = 0; c < J; c++) { let p = c; for (let r = c + 1; r < J; r++) if (Math.abs(A2[r][c]) > Math.abs(A2[p][c])) p = r; [A2[c], A2[p]] = [A2[p], A2[c]]; for (let r = 0; r < J; r++) if (r !== c) { const f = A2[r][c] / A2[c][c]; for (let k = c; k <= J; k++) A2[r][k] -= f * A2[c][k]; } }
    const d = A2.map((row, j) => row[J] / row[j]);
    o = o.map((v, j) => v + Math.max(-0.3, Math.min(0.3, d[j])));
    if (d.every((x) => Math.abs(x) < 1e-5)) break;
  }
  // hard cap: an offset may move the top level by at most 0.75 logit
  return o.map((v, j) => Math.max(-0.75 / (dims[j].n - 1 - dims[j].mid), Math.min(0.75 / (dims[j].n - 1 - dims[j].mid), v)));
}
const cells = new Map(); // `${j}:${lv}` → {n, x, t}
let edge = { n: 0, in10: 0, abs: 0 };
let tgt = { n: 0, x: 0, t: 0 }, strongLv = 0, weakLv = 0, cntSW = 0, offErr = 0, offN = 0;
const T0 = Date.UTC(2026, 10, 2, 17, 0, 0), DAY = 86400000;
for (let li = 0; li < N; li++) {
  const r = PX.rng(PX.rng.hash('dims', EX, SDF, li)); // same learners in every condition
  const z = dims.map((d) => r.normal(0, SDF * d.step));
  const L = { t0: M.range(base).min + 1.5 + r.normal(0, 0.4), lapse: r.float(0.01, 0.06) };
  const rr = PX.rng(PX.rng.hash('dims-play', EX, SDF, li, COND));
  const rec = { ex: {}, trials: [], idx: { ex: [], mode: [] }, eng: { seedN: 0, salt: 1 } };
  let off = COND === 'oracle' ? z.slice() : dims.map(() => 0);
  let def = COND === 'cur' ? base : clone(off);
  const H = [];
  let n = 0, day = 0;
  const js = dims.map((d, j) => j), strong = js.reduce((a, j) => (z[j] / dims[j].step < z[a] / dims[a].step ? j : a), 0), weak = js.reduce((a, j) => (z[j] / dims[j].step > z[a] / dims[a].step ? j : a), 0);
  while (n < TOTAL) {
    day += 1 + (rr.chance(0.5) ? 1 : 0);
    let now = T0 + day * DAY; const m = rr.int(25, 55), deck = [];
    const dn = rr.normal(0, 0.15);
    for (let k = 0; k < m && n < TOTAL; k++) {
      let kind = k < 2 ? 'warmup' : k === m - 1 ? 'last' : null;
      if (!kind) { if (!deck.length) deck.push(...rr.shuffle(['target', 'target', 'target', 'target', 'target', 'target', 'target', 'target', 'easy', 'stretch'])); kind = deck.pop(); }
      const st = E.est.get(rec, def, {}, now);
      const weakList = kind === 'target' && rr.chance(0.2) ? E.select.weak(rec, def) : null;
      const pk = E.select.pick(def, st, { kind, k: 0.70, policy: 'high', recent: E.select.recent(rec, def), weak: weakList, rng: rr });
      E.select.note(rec, def, pk.cand);
      const x = dims.map((d) => lvOf(pk.params, d) - d.mid);
      const bTrue = base.difficulty(pk.params) + dims.reduce((s, d, j) => s + z[j] * x[j], 0);
      const th = L.t0 + 0.1 * n / 100 + dn;
      const p = (1 - L.lapse) * (pk.g + (1 - pk.g) * sig(th - bTrue)) + L.lapse * pk.g;
      const ok = rr.chance(p);
      H.push({ y: ok ? 1 : 0, b: base.difficulty(pk.params), g: pk.g, mu: st.mu, x });
      if (H.length > 400) H.shift();
      E.est.rate(rec, def, pk.params, ok, now, { b: pk.b, g: pk.g });
      E.select.residual(rec, def, pk.cand, ok, pk.p);
      if (kind === 'target' && n >= 200) {
        tgt.n++; tgt.x += ok ? 1 : 0; tgt.t += pk.target;
        const pT = (1 - L.lapse) * (pk.g + (1 - pk.g) * sig(L.t0 + 0.1 * n / 100 - bTrue)) + L.lapse * pk.g;
        edge.n++; edge.abs += Math.abs(pT - pk.target); if (Math.abs(pT - pk.target) <= 0.10) edge.in10++;
        dims.forEach((d, j) => { const key = j + ':' + lvOf(pk.params, d); const c = cells.get(key) || { n: 0, x: 0, t: 0 }; c.n++; c.x += ok ? 1 : 0; c.t += pk.target; cells.set(key, c); });
        strongLv += (lvOf(pk.params, dims[strong]) / (dims[strong].n - 1)); weakLv += (lvOf(pk.params, dims[weak]) / (dims[weak].n - 1)); cntSW++;
      }
      n++; now += 9000;
    }
    if (COND === 'est' && H.length >= 100) { off = fitOffsets(H); def = clone(off); }
  }
  if (COND !== 'cur') { off.forEach((o, j) => { offErr += (o - z[j]) ** 2 / dims[j].step ** 2; offN++; }); }
}
let rms = 0, wsum = 0, worst = 0;
for (const [, c] of cells) { if (c.n < 200) continue; const d = (c.x - c.t) / c.n; rms += c.n * d * d; wsum += c.n; worst = Math.max(worst, Math.abs(d)); }
console.log(`${EX} ${COND} sdf=${SDF}: target items within ±0.10 of the target in true success ${(100 * edge.in10 / edge.n).toFixed(1)}%, mean |p_true − target| ${(100 * edge.abs / edge.n).toFixed(1)} points; success ${(100 * tgt.x / tgt.n).toFixed(1)} vs target ${(100 * tgt.t / tgt.n).toFixed(1)}; per dimension level (cells with >= 200 target items): RMS gap ${(100 * Math.sqrt(rms / wsum)).toFixed(1)} points, worst ${(100 * worst).toFixed(1)} points; mean level share of the learner's strongest dim ${(strongLv / cntSW).toFixed(2)} vs weakest ${(weakLv / cntSW).toFixed(2)}${offN ? `; offset error RMS ${(Math.sqrt(offErr / offN)).toFixed(2)} steps` : ''}`);
