import { createContext } from '../../../../../tests/node/run.mjs';
import { strategies } from './lib.mjs';
const N = +process.argv[2] || 400;
const FILES = ['js/core/px.js','js/core/util.js','js/core/rng.js','js/core/bus.js','js/ex/registry.js','js/ex/homing/gen.js','js/ex/reckon/gen.js'];
const PX = createContext({ files: FILES }).PX, def = PX.ex.get('reckon');
const ROUTES = def.lib.ROUTES, TURNS = def.lib.TURNS, TOL = def.lib.TOL_POINT;
console.log('route (legs,turn) | tol | chance | EL | 180-S/2 | sideFixed(CV) | fixed(CV) | turnOnlyKNN(CV)');
for (let r = 0; r < ROUTES.length; r++) for (let o = 0; o < 3; o++) {
  const items = [];
  for (let s = 0; s < N; s++) {
    const it = def.generate(PX.rng(PX.rng.hash('n1-base', r, o, s)), { variant: 'point', route: r, flow: 0, speed: 0, tolerance: o });
    if (it.fallback) continue;
    items.push({ legs: it.legs, turns: it.turns, key: it.keyDeg });
  }
  const st = strategies(items, TOL[o]), ch = 2 * TOL[o] / 360;
  const f = (x) => (100 * x).toFixed(0).padStart(3);
  console.log(`${r} (${ROUTES[r].legs},${TURNS[ROUTES[r].turns].name.padEnd(6)}) | ${TOL[o]} | ${f(ch)} | ${f(st.el)} | ${f(st.f180)} | ${f(st.saf)} | ${f(st.fix)} | ${f(st.knn)}  (n=${items.length})`);
}
