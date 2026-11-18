// Read-only: which params a fresh learner's first 5 rated items of a pinned exercise use.
import { createContext } from '../../../../../tests/node/run.mjs';
import { Learner, newRecord, playSession } from '../../../../../tests/node/fixtures/learner.mjs';
const { PX } = createContext();
const T0 = Date.UTC(2026, 10, 2, 17, 0, 0);
const N = 200, A = +(process.argv[2] || 1);
for (const id of ['views', 'angles', 'cubes', 'openings', 'form', 'patfold', 'patviews']) {
  const def = PX.ex.get(id), min = PX.ex.minDifficulty(def), cnt = {}, kinds = {};
  for (let i = 0; i < N; i++) {
    const L = new Learner(PX, PX.rng.hash('d2-fp', id, i), { aboveFloor: A });
    const rec = newRecord(PX, T0 - 3600e3, { weeklyGoal: 3, sessionMin: 10 });
    const now = T0 + i * 3600e3 * 7 + 60e3 * (i % 13); rec.created = now - 3600e3; const res = playSession(PX, rec, L, 'train', { now, display: 'large', pin: id, minutes: 10 }, 0, {});
    res.steps.filter((s) => s.step.exId === id && s.out.outcome < 2).slice(0, 5).forEach((s) => {
      const k = JSON.stringify(s.step.params).replace(/"/g, '') + ' b+' + (def.difficulty(s.step.params) - min).toFixed(2);
      cnt[k] = (cnt[k] || 0) + 1; kinds[s.step.kind] = (kinds[s.step.kind] || 0) + 1;
    });
  }
  const top = Object.entries(cnt).sort((a, b) => b[1] - a[1]).slice(0, 6);
  console.log(`\n${id}: kinds ${JSON.stringify(kinds)}\n  ` + top.map(([k, v]) => `${(100 * v / (5 * N)).toFixed(0)} % ${k}`).join('\n  '));
}
