// Read-only spike: Angles' generator loaded in memory with wider gap levels (no file is changed).
// Checks: items valid, fallbacks, and the cue solvers of tests/node/angles.test.mjs at the wide gaps.
import fs from 'node:fs';
import { createContext } from '../../../../../tests/node/run.mjs';
const src = fs.readFileSync(new URL('../../../../../js/ex/angles/gen.js', import.meta.url), 'utf8');
const GAPS = process.argv[2] || '[12, 10, 8, 6, 5, 4, 3, 2]';
const mod = src.replace('var GAPS = [6, 5, 4, 3, 2];', 'var GAPS = ' + GAPS + ';');
if (mod === src) throw new Error('GAPS line not found');
const env = createContext({ exercises: false });
env.run(mod);
const PX = env.PX, def = PX.ex.get('angles'), L = def.lib;
function nearest(pred, options, key) { const d = options.map((o) => L.kendall(o, pred)), best = Math.min(...d); return d[key] === best ? 1 / d.filter((x) => x === best).length : 0; }
const levels = JSON.parse(GAPS);
for (let gi = 0; gi < Math.min(4, levels.length); gi++) {
  for (const resolve of [0]) {
    const p = { gap: gi, size: 0, resolve, pose: 0 };
    let n = 0, invalid = 0, fb = 0; const cue = {};
    for (let s = 0; s < 600; s++) {
      const it = def.generate(PX.rng(PX.rng.hash('d2-ang', gi, s)), p);
      n++; if (it.fallback) fb++; if (def.validate(it) !== true) invalid++;
      const f = it.angles.map((g) => {
        const ux = g.a[0] - g.v[0], uy = g.a[1] - g.v[1], wx = g.b[0] - g.v[0], wy = g.b[1] - g.v[1];
        const lu = Math.hypot(ux, uy), lw = Math.hypot(wx, wy);
        return { tip: Math.hypot(g.a[0] - g.b[0], g.a[1] - g.b[1]), area: Math.abs(ux * wy - uy * wx), sum: lu + lw, longer: Math.max(lu, lw), shorter: Math.min(lu, lw), mid: Math.hypot((ux + wx) / 2, (uy + wy) / 2) };
      });
      for (const k of Object.keys(f[0])) for (const dir of [1, -1]) {
        const order = [0, 1, 2, 3].sort((a, b) => dir * (f[a][k] - f[b][k]));
        const name = k + (dir > 0 ? ' up' : ' down');
        cue[name] = (cue[name] || 0) + nearest(order, it.options, it.key);
      }
    }
    const worst = Object.entries(cue).sort((a, b) => b[1] - a[1]).slice(0, 4).map(([k, v]) => `${k} ${(100 * v / n).toFixed(1)} %`);
    console.log(`gap ${levels[gi]}° resolve ${resolve}: ${n} items, invalid ${invalid}, fallbacks ${fb}; worst cues: ${worst.join(', ')}`);
  }
}
