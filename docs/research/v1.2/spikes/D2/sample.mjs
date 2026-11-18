// Read-only: loads the app's pure files in a vm context (as tests/node/run.mjs does) and prints
// easiest-level items of the seven exercises. Writes nothing.
import { createContext } from '../../../../../tests/node/run.mjs';
const { PX } = createContext();
const E = PX.engine, M = E.model;
const ids = ['views', 'angles', 'cubes', 'openings', 'form', 'patfold', 'patviews'];
function summary(def) {
  const pool = M.pool(def);
  const min = PX.ex.minDifficulty(def), max = PX.ex.maxDifficulty(def);
  const easiest = pool.filter((c) => c.b <= min + 1e-9).map((c) => JSON.stringify(c.params));
  const g = def.chance(pool[0].params);
  const p0 = M.p(0, min, g), mu0 = min + 1, pExp = M.pExp(mu0, 1, min, g);
  // items within 0.6 logit of the floor
  const near = pool.filter((c) => c.b <= min + 0.61).sort((a, b) => a.b - b.b).map((c) => c.b.toFixed(2) + ' ' + JSON.stringify(c.params));
  console.log(`\n### ${def.id}: range ${min.toFixed(2)} … ${max.toFixed(2)} (${(max - min).toFixed(2)} logits), pool ${pool.length}, g ${g.toFixed(3)}; P(θ=0, floor) ${p0.toFixed(3)}; P at prior μ0 (floor+1, sd 1) ${pExp.toFixed(3)}`);
  console.log('  easiest: ' + easiest.join(' | '));
  console.log('  within 0.6 logit of the floor:\n    ' + near.join('\n    '));
}
for (const id of ids) summary(PX.ex.get(id));
