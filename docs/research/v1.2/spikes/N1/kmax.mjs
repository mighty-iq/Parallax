import { cell } from './cand.mjs';
import { strategies } from './lib.mjs';
const C = { leg: [2.5, 15], path: [10, 34], dMax: 22, M: 700 };
const f = (x) => x === null ? '  -' : (100 * x).toFixed(0).padStart(3);
console.log('wide legs, Kmax=6 | legs band tol | chance+10 | feasible% | K hist | bound | EL | sideFixed | fixed | turnKNN');
for (const [n, band] of [[3, 'medium'], [3, 'large'], [4, 'medium'], [4, 'large']]) for (const tol of [30, 20]) {
  const r = cell(n, band, tol, C, 300, 77 + n * 100 + tol, 6);
  const st = strategies(r.items, tol);
  console.log(`${n} ${band.padEnd(6)} ${tol} | ${f(2 * tol / 360 + 0.1)} | ${f(r.feasible / r.draws)} | ${r.kHist.join(',')} | ${f(r.bound)} | ${f(st.el)} | ${f(st.saf)} | ${f(st.fix)} | ${f(st.knn)}`);
}
