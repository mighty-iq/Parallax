// EXEMPT_FIXED cells (routes 0, 1, 4 at every tolerance; route 2 at 40 and 30): best fixed angle (CV) with and
// without a final rotation of ±30..150° (real generator items, key' = key − R; R1's rules not re-checked).
import { createContext } from '../../../../../tests/node/run.mjs';
import { cv2, adiff, mulberry, norm360 } from './lib.mjs';
const FILES = ['js/core/px.js','js/core/util.js','js/core/rng.js','js/core/bus.js','js/ex/registry.js','js/ex/homing/gen.js','js/ex/reckon/gen.js'];
const PX = createContext({ files: FILES }).PX, def = PX.ex.get('reckon');
const TOL = [40, 30, 20], rnd = mulberry(99);
const grid = []; for (let a = 0; a < 360; a += 2) grid.push(a);
const f = (x) => (100 * x).toFixed(0).padStart(3);
console.log('route tol | chance+10 | fixed (CV) without / with final rotation');
for (const [r, os] of [[0, [0, 1, 2]], [1, [0, 1, 2]], [4, [0, 1, 2]], [2, [0, 1]]]) for (const o of os) {
  const A = [], B = [];
  for (let s = 0; s < 400; s++) {
    const it = def.generate(PX.rng(PX.rng.hash('n1-rot2', r, o, s)), { variant: 'point', route: r, flow: 0, speed: 0, tolerance: o });
    if (it.fallback) continue;
    const R = (rnd() < 0.5 ? -1 : 1) * (30 + 120 * rnd());
    A.push({ key: it.keyDeg }); B.push({ key: norm360(it.keyDeg - R) });
  }
  const h = (c, it) => adiff(c, it.key) <= TOL[o];
  console.log(`${r} ${TOL[o]} | ${f(2 * TOL[o] / 360 + 0.1)} | ${f(cv2(A, grid, h))} / ${f(cv2(B, grid, h))}`);
}
