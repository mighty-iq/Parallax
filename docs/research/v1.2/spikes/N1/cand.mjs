// Candidate generator for O35: draw the turns first, then pick the item's key uniformly among K reachable
// keys that lie more than 2*tol + 8 deg apart (so one answer can hit at most one of them). Any answer that
// depends on the turns alone then hits with probability <= 1/K. Rules kept from R1/gen.js: home distance
// 5..dMax, path keeps >= 3 m from the start before the end, key >= gap from ahead/behind, the reversed,
// not-updated and mirror answers miss by > tol + 2.
import { walk, adiff, norm180, norm360, mulberry, strategies } from './lib.mjs';
const sum = (a) => a.reduce((s, x) => s + x, 0);
function segDist(p, a, b) { const dx = b[0] - a[0], dy = b[1] - a[1], L2 = dx * dx + dy * dy; const t = Math.max(0, Math.min(1, L2 ? ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / L2 : 0)); return Math.hypot(a[0] + t * dx - p[0], a[1] + t * dy - p[1]); }
function ok(g, turns, tol, C) {
  const gap = Math.max(20, (tol + 2) / 2 + 0.5);
  if (adiff(g.key, 0) < gap || adiff(g.key, 180) < gap) return false;
  if (g.d < 5 || g.d > C.dMax) return false;
  for (let i = 1; i < g.path.length - 1; i++) if (segDist([0, 0], g.path[i], g.path[i + 1]) < 3) return false;
  const S = sum(turns), lim = tol + 2;
  if (adiff(g.key, 180 - S) <= lim || adiff(g.key, g.key + S) <= lim || adiff(g.key, 360 - g.key) <= lim) return false;
  return true;
}
const BANDS = { small: [30, 60], medium: [60, 120], large: [120, 160] };
export function cell(n, band, tol, C, nItems, seed, Kmax = 3, finalRot = null) {
  const rnd = mulberry(seed), U = (a, b) => a + (b - a) * rnd();
  const items = []; let draws = 0, feasible = 0, bound = 0, kHist = [0, 0, 0, 0, 0, 0];
  while (items.length < nItems && draws < nItems * 40) {
    draws++;
    const turns = []; for (let j = 1; j < n; j++) turns.push((rnd() < 0.5 ? -1 : 1) * U(BANDS[band][0], BANDS[band][1]));
    if (finalRot) turns.push((rnd() < 0.5 ? -1 : 1) * U(finalRot[0], finalRot[1]));
    const samples = [];
    for (let m = 0; m < C.M; m++) {
      const legs = []; for (let j = 0; j < n; j++) legs.push(U(C.leg[0], C.leg[1]));
      const P = sum(legs); if (P < C.path[0] || P > C.path[1]) continue;
      const g = walk(legs, turns); if (!ok(g, turns, tol, C)) continue;
      samples.push({ legs, key: g.key });
    }
    if (samples.length < 20) { kHist[0]++; continue; }
    // the largest set of keys pairwise > sep apart (greedy sweep from each start), capped at Kmax
    const sep = 2 * tol + 8, keys = samples.map((s) => s.key).sort((a, b) => a - b);
    let bestSet = [];
    for (let s0 = 0; s0 < keys.length; s0 += Math.max(1, Math.floor(keys.length / 40))) {
      const set = [keys[s0]];
      for (let q = 1; q < keys.length && set.length < Kmax; q++) { const k = keys[(s0 + q) % keys.length]; if (set.every((c) => adiff(c, k) > sep)) set.push(k); }
      if (set.length > bestSet.length || (set.length === bestSet.length && rnd() < 0.3)) bestSet = set;
    }
    const K = bestSet.length; kHist[Math.min(K, 5)]++;
    if (K < 2) continue;
    feasible++; bound += 1 / K;
    const c = bestSet[Math.floor(rnd() * K)];
    const pool = samples.filter((s) => adiff(s.key, c) <= 2);
    const pick = pool[Math.floor(rnd() * pool.length)];
    items.push({ legs: pick.legs, turns, key: pick.key });
  }
  return { items, draws, feasible, bound: feasible ? bound / feasible : null, kHist };
}
if (process.argv[1].endsWith('cand.mjs')) {
  const CFG = {
    now: { leg: [4, 12], path: [12, 28], dMax: 20, M: 500 },
    wide: { leg: [2.5, 15], path: [10, 34], dMax: 22, M: 500 },
  };
  const which = process.argv[2] || 'now', Kmax = +(process.argv[3] || 3), fr = process.argv[4] === 'rot' ? [30, 150] : null;
  const C = CFG[which];
  console.log(`config ${which} ${JSON.stringify(C)} Kmax=${Kmax} finalRot=${fr}`);
  console.log('legs band tol | chance | feasible% (K>=2 of turn draws) | K hist | bound E[1/K] | EL | 180-S/2 | sideFixed | fixed | turnKNN');
  const f = (x) => x === null ? '  -' : (100 * x).toFixed(0).padStart(3);
  for (const [n, band] of [[2, 'medium'], [3, 'small'], [2, 'large'], [3, 'medium'], [4, 'small'], [3, 'large'], [4, 'medium'], [4, 'large']]) for (const tol of [40, 30, 20]) {
    const r = cell(n, band, tol, C, 300, n * 1000 + tol + (band === 'large' ? 7 : band === 'medium' ? 3 : 1), Kmax, fr);
    const st = r.items.length >= 40 ? strategies(r.items, tol) : null;
    console.log(`${n} ${band.padEnd(6)} ${tol} | ${f(2 * tol / 360)} | ${f(r.feasible / r.draws)} | ${r.kHist.join(',')} | ${f(r.bound)} | ${st ? [st.el, st.f180, st.saf, st.fix, st.knn].map(f).join(' | ') : 'too few items (' + r.items.length + ')'}`);
  }
}
