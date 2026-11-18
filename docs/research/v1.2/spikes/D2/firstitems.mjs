// Read-only simulation: real exercise definitions, the engine, and the test suite's simulated
// learners (tests/node/fixtures/learner.mjs). For each exercise and each start ability A (logits
// above today's floor), N fresh learners play one pinned 10-minute Train session; we report the
// success on the pinned exercise's first 5 and 10 rated items, how far above the floor those
// items were, and the level shown at the end. Writes nothing.
import { createContext } from '../../../../../tests/node/run.mjs';
import { Learner, newRecord, playSession } from '../../../../../tests/node/fixtures/learner.mjs';
const { PX } = createContext();
const E = PX.engine;
const T0 = Date.UTC(2026, 10, 2, 17, 0, 0);
const N = +(process.argv[2] || 200);
const ids = (process.argv[3] || 'views,angles,cubes,openings,form,patfold,patviews').split(',');
const As = (process.argv[4] || '-1,0,1,1.75').split(',').map(Number);
for (const id of ids) {
  const def = PX.ex.get(id), min = PX.ex.minDifficulty(def);
  const rows = [];
  for (const A of As) {
    let r5 = 0, n5 = 0, r10 = 0, n10 = 0, off = 0, offN = 0, atFloor = 0, lv = [], ex1 = 0;
    for (let i = 0; i < N; i++) {
      const L = new Learner(PX, PX.rng.hash('d2-first', id, A, i), { aboveFloor: A });
      const rec = newRecord(PX, T0 - 3600e3, { weeklyGoal: 3, sessionMin: 10 });
      rec.train.style = 'balanced';
      const res = playSession(PX, rec, L, 'train', { now: T0, display: 'large', pin: id, minutes: 10 }, 0, { stutterP: 0 });
      const mine = res.steps.filter((s) => s.step.exId === id && s.out.outcome < 2);
      mine.forEach((s, k) => {
        const ok = s.res.correct ? 1 : 0, b = def.difficulty(s.step.params);
        if (k < 5) { r5 += ok; n5++; }
        if (k < 10) { r10 += ok; n10++; off += b - min; offN++; if (b - min < 1e-9) atFloor++; }
      });
      ex1 += mine.length;
      lv.push(E.est.shown(rec, def, { display: 'large' }).level);
    }
    lv.sort((a, b) => a - b);
    rows.push(`  A ${A >= 0 ? '+' : ''}${A}: first 5 ${(100 * r5 / n5).toFixed(1)} %, first 10 ${(100 * r10 / n10).toFixed(1)} %; first 10 items ${(off / offN).toFixed(2)} logit above floor (${(100 * atFloor / offN).toFixed(0)} % at the floor); items of this exercise per session ${(ex1 / N).toFixed(1)}; level shown after: median ${lv[Math.floor(N / 2)]}, p10 ${lv[Math.floor(N / 10)]}, p90 ${lv[Math.floor(N * 0.9)]}`);
  }
  console.log(`\n${id} (floor ${min.toFixed(2)}, g ${def.chance(E.model.pool(def)[0].params).toFixed(2)})\n` + rows.join('\n'));
}
