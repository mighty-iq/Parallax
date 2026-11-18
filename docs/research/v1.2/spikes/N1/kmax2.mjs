import { cell } from './cand.mjs';
import { strategies } from './lib.mjs';
const f = (x) => x === null ? '  -' : (100 * x).toFixed(0).padStart(3);
for (const C of [{ name: 'legs 2.5-15, path 10-28, d<=20', leg: [2.5, 15], path: [10, 28], dMax: 20, M: 700 }]) {
  for (const Kmax of [2, 3, 6]) {
    console.log(`${C.name}, Kmax=${Kmax} | legs band tol | chance+10 | feasible% | bound | EL | 180-S/2 | sideFixed | fixed | turnKNN`);
    for (const [n, band] of [[2, 'large'], [3, 'medium'], [3, 'large'], [4, 'medium'], [4, 'large']]) for (const tol of [40, 30, 20]) {
      const r = cell(n, band, tol, C, 240, 991 + n * 100 + tol + Kmax, Kmax);
      if (r.items.length < 40) { console.log(`${n} ${band.padEnd(6)} ${tol} | ${f(2 * tol / 360 + 0.1)} | ${f(r.feasible / r.draws)} | too few items`); continue; }
      const st = strategies(r.items, tol);
      console.log(`${n} ${band.padEnd(6)} ${tol} | ${f(2 * tol / 360 + 0.1)} | ${f(r.feasible / r.draws)} | ${f(r.bound)} | ${f(st.el)} | ${f(st.f180)} | ${f(st.saf)} | ${f(st.fix)} | ${f(st.knn)}`);
    }
  }
}
