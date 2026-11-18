import { createContext } from '../../../../../tests/node/run.mjs';
const { PX } = createContext();
const it = PX.ex.get('openings').generate(PX.rng(PX.rng.hash('d2-sample', 0)), { features: 0, edges: 0, keyview: 0, pose: 0, foils: 0 });
console.log(JSON.stringify(it.feats), Object.keys(it), JSON.stringify(it.options[0]).slice(0, 300));
// patviews cube-count distribution at level 0
const def = PX.ex.get('patviews'); const cnt = {};
for (let i = 0; i < 300; i++) { const x = def.generate(PX.rng(PX.rng.hash('d2-pv', i)), { cubes: 0, grid: 0, missing: 0, foil: 0 }); const n = x.heights.flat().reduce((a, b) => a + b, 0); cnt[n] = (cnt[n] || 0) + 1; }
console.log('patviews level-0 cube counts', JSON.stringify(cnt));
// views toview level-0 cube counts and tallest
const v = PX.ex.get('views'); const c2 = {}, t2 = {};
for (let i = 0; i < 300; i++) { const x = v.generate(PX.rng(PX.rng.hash('d2-v', i)), { cubes: 0, grid: 0, view: 0, variant: 'toview' }); const n = x.heights.flat().reduce((a, b) => a + b, 0); c2[n] = (c2[n] || 0) + 1; const t = Math.max(...x.heights.flat()); t2[t] = (t2[t] || 0) + 1; }
console.log('views toview level-0 cube counts', JSON.stringify(c2), 'tallest', JSON.stringify(t2));
// cubes level-0: hidden counts and grid sizes
const cdef = PX.ex.get('cubes'); const h = {}, g = {}, n3 = {};
for (let i = 0; i < 300; i++) { const x = cdef.generate(PX.rng(PX.rng.hash('d2-c', i)), { cubes: 0, height: 0, asked: 0 }); h[x.hidden] = (h[x.hidden] || 0) + 1; g[x.heights.length] = (g[x.heights.length] || 0) + 1; n3[x.ask] = (n3[x.ask] || 0) + 1; }
console.log('cubes level-0 hidden', JSON.stringify(h), 'grid', JSON.stringify(g), 'asked N', JSON.stringify(n3));
