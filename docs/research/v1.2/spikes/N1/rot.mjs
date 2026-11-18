// Adds a final in-place rotation R (±30..150°) to the real generator's point items (key' = key − R) and
// compares the shortcut hit rates with and without it. (Post hoc: R1's item rules are not re-checked.)
import { createContext } from '../../../../../tests/node/run.mjs';
import { strategies, mulberry, norm360 } from './lib.mjs';
const FILES = ['js/core/px.js','js/core/util.js','js/core/rng.js','js/core/bus.js','js/ex/registry.js','js/ex/homing/gen.js','js/ex/reckon/gen.js'];
const PX = createContext({ files: FILES }).PX, def = PX.ex.get('reckon');
const TOL = [40, 30, 20], rnd = mulberry(4242);
const f = (x) => (100 * x).toFixed(0).padStart(3);
console.log('route tol | EL / with R | sideFixed / with R | fixed / with R | turnKNN / with R');
for (const r of [0, 2, 3, 5, 6, 7]) for (const o of [0, 2]) {
  const A = [], B = [];
  for (let s = 0; s < 300; s++) {
    const it = def.generate(PX.rng(PX.rng.hash('n1-rot', r, o, s)), { variant: 'point', route: r, flow: 0, speed: 0, tolerance: o });
    if (it.fallback) continue;
    A.push({ legs: it.legs, turns: it.turns, key: it.keyDeg });
    const R = (rnd() < 0.5 ? -1 : 1) * (30 + 120 * rnd());
    B.push({ legs: it.legs, turns: it.turns.concat([R]), key: norm360(it.keyDeg - R) });
  }
  const a = strategies(A, TOL[o]), b = strategies(B, TOL[o]);
  console.log(`${r} ${TOL[o]} | ${f(a.el)} / ${f(b.el)} | ${f(a.saf)} / ${f(b.saf)} | ${f(a.fix)} / ${f(b.fix)} | ${f(a.knn)} / ${f(b.knn)}`);
}
