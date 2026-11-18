// Turns first, including a final in-place rotation (±30..150°), then the key chosen uniformly among K
// reachable keys > 2*tol + 8 apart. Legs 2.5..15 m, path 10..28 m, home distance <= 20 m.
import { cell } from './cand.mjs';
import { strategies, walk, adiff } from './lib.mjs';
const C = { leg: [2.5, 15], path: [10, 28], dMax: 20, M: 600 };
const f = (x) => x === null ? '  -' : (100 * x).toFixed(0).padStart(3);
for (const Kmax of [2, 3]) {
  console.log(`final rotation ±30–150°, Kmax=${Kmax} | legs band tol | chance+10 | feasible% | bound | EL | sideFixed | fixed | turnKNN | notUpdated | mirror`);
  for (const [n, band] of [[2, 'medium'], [2, 'large'], [3, 'small'], [3, 'medium'], [3, 'large'], [4, 'small'], [4, 'medium'], [4, 'large']]) for (const tol of [40, 30, 20]) {
    const r = cell(n, band, tol, C, 240, 31337 + n * 100 + tol + Kmax, Kmax, [30, 150]);
    if (r.items.length < 60) { console.log(`${n} ${band.padEnd(6)} ${tol} | ${f(2 * tol / 360 + 0.1)} | ${f(r.feasible / r.draws)} | too few items (${r.items.length})`); continue; }
    const st = strategies(r.items, tol);
    const S = (it) => it.turns.reduce((s, x) => s + x, 0);
    const nu = r.items.filter((it) => adiff(it.key + S(it), it.key) <= tol).length / r.items.length;
    const mi = r.items.filter((it) => adiff(360 - it.key, it.key) <= tol).length / r.items.length;
    console.log(`${n} ${band.padEnd(6)} ${tol} | ${f(2 * tol / 360 + 0.1)} | ${f(r.feasible / r.draws)} | ${f(r.bound)} | ${f(st.el)} | ${f(st.saf)} | ${f(st.fix)} | ${f(st.knn)} | ${f(nu)} | ${f(mi)}`);
  }
}
