// Target-first variant: draw the target key uniformly over the allowed directions (as gen.js does), then
// draw turn sequences until one reaches the target AND also reaches another key more than 2*tol + 8 away
// (so the legs, not the turns, decide between them). Keeps the marginal key distribution uniform.
import { walk, adiff, mulberry, strategies } from './lib.mjs';
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
export function cellT(n, band, tol, C, nItems, seed, need = 1, finalRot = null) {
  const rnd = mulberry(seed), U = (a, b) => a + (b - a) * rnd();
  const gap = Math.max(20, (tol + 2) / 2 + 0.5), sep = 2 * tol + 8;
  const items = []; let fails = 0, tries = 0;
  while (items.length < nItems && fails < nItems * 5) {
    const u = U(gap, 180 - gap), target = rnd() < 0.5 ? u : 360 - u;
    let got = null;
    for (let a = 0; a < 200 && !got; a++) {
      tries++;
      const turns = []; for (let j = 1; j < n; j++) turns.push((rnd() < 0.5 ? -1 : 1) * U(BANDS[band][0], BANDS[band][1]));
      if (finalRot) turns.push((rnd() < 0.5 ? -1 : 1) * U(finalRot[0], finalRot[1]));
      const hitT = [], others = [];
      for (let m = 0; m < C.M; m++) {
        const legs = []; for (let j = 0; j < n; j++) legs.push(U(C.leg[0], C.leg[1]));
        const P = sum(legs); if (P < C.path[0] || P > C.path[1]) continue;
        const g = walk(legs, turns); if (!ok(g, turns, tol, C)) continue;
        if (adiff(g.key, target) <= 2) hitT.push({ legs, key: g.key }); else if (adiff(g.key, target) > sep) others.push(g.key);
      }
      // 'need' other keys far from the target, spread so that no single answer window holds them all
      if (hitT.length && others.length >= need) got = { turns, pick: hitT[Math.floor(rnd() * hitT.length)] };
    }
    if (!got) { fails++; continue; }
    items.push({ legs: got.pick.legs, turns: got.turns, key: got.pick.key });
  }
  return { items, fails, tries };
}
const f = (x) => (100 * x).toFixed(0).padStart(3);
if (process.argv[1].endsWith('tfirst.mjs')) {
  const C = { leg: [+process.argv[2] || 2.5, +process.argv[3] || 15], path: [10, 28], dMax: 20, M: 400 };
  const fr = process.argv[4] === 'rot' ? [30, 150] : null;
  console.log(`target-first, legs ${C.leg.join('-')} m, path 10-28 m, final rotation ${fr}`);
  console.log('legs band tol | chance+10 | fails | EL | 180-S/2 | sideFixed | fixed | turnKNN');
  for (const [n, band] of [[2, 'medium'], [2, 'large'], [3, 'small'], [3, 'medium'], [3, 'large'], [4, 'small'], [4, 'medium'], [4, 'large']]) for (const tol of [40, 30, 20]) {
    const r = cellT(n, band, tol, C, 240, 5150 + n * 100 + tol, 1, fr);
    if (r.items.length < 60) { console.log(`${n} ${band.padEnd(6)} ${tol} | ${f(2 * tol / 360 + 0.1)} | infeasible (${r.items.length} items)`); continue; }
    const st = strategies(r.items, tol);
    console.log(`${n} ${band.padEnd(6)} ${tol} | ${f(2 * tol / 360 + 0.1)} | ${r.fails} | ${f(st.el)} | ${f(st.f180)} | ${f(st.saf)} | ${f(st.fix)} | ${f(st.knn)}`);
  }
}
