import { cell } from './cand.mjs';
import { strategies } from './lib.mjs';
const f = (x) => x === null ? '  -' : (100 * x).toFixed(0).padStart(3);
for (const [leg, rot] of [[[3, 15], null], [[3, 15], [30, 150]], [[4, 12], [30, 150]]]) {
  const C = { leg, path: [10, 28], dMax: 20, M: 600 };
  console.log(`legs ${leg.join('-')} m, path 10-28, final rotation ${rot ? '±30-150' : 'none'}, K=2 | legs band tol | chance+10 | feasible% | EL | sideFixed | fixed | turnKNN`);
  for (const [n, band] of [[2, 'large'], [3, 'medium'], [3, 'large'], [4, 'medium'], [4, 'large']]) for (const tol of [40, 30, 20]) {
    const r = cell(n, band, tol, C, 200, 4040 + n * 100 + tol, 2, rot);
    if (r.items.length < 60) { console.log(`${n} ${band.padEnd(6)} ${tol} | ${f(2 * tol / 360 + 0.1)} | ${f(r.feasible / r.draws)} | too few items (${r.items.length})`); continue; }
    const st = strategies(r.items, tol);
    console.log(`${n} ${band.padEnd(6)} ${tol} | ${f(2 * tol / 360 + 0.1)} | ${f(r.feasible / r.draws)} | ${f(st.el)} | ${f(st.saf)} | ${f(st.fix)} | ${f(st.knn)}`);
  }
}
