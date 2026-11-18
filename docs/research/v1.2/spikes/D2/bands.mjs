// Read-only simulation of proposed first bands. For each exercise, a stub definition copies the real
// one (dims, difficulty, chance, answer type) and prepends the proposed new level(s); old
// combinations keep their exact difficulty, new ones get the proposed offset. The engine and the test
// suite's simulated learners then play one pinned 10-minute Train session per learner. A is the
// learner's true start in logits above TODAY's floor (so the same people are compared before/after).
import { createContext } from '../../../../../tests/node/run.mjs';
import { Learner, newRecord, playSession } from '../../../../../tests/node/fixtures/learner.mjs';
const { PX } = createContext();
const E = PX.engine;
const T0 = Date.UTC(2026, 10, 2, 17, 0, 0);
const N = +(process.argv[2] || 200);
const As = (process.argv[3] || '-1,-0.5,0,1,1.75').split(',').map(Number);
const only = process.argv[4] ? process.argv[4].split(',') : null;
// Proposals: new levels prepended to dims, with the offset (logits) they add to the real difficulty
// of the same item at the old level 0 of that dim. cond(params) limits where an offset applies.
const P = {
  views: { add: [{ dim: 'cubes', label: '3–4', d: (p) => (p.variant === 'toview' ? -1.4 : 0) }] },
  angles: { add: [{ dim: 'gap', label: '9° near-right', d: () => -0.95, ignore: ['size'] }] },
  cubes: { add: [{ dim: 'height', label: 'flat', d: () => -1.0 }, { dim: 'cubes', label: '4–5', d: () => -0.85 }] },
  openings: { add: [{ dim: 'features', label: '1 on one face, unturned', d: () => -1.5 }] },
  form: { add: [{ dim: 'marks', label: 'one shaded', d: () => -1.3 }] },
  patfold: { add: [{ dim: 'folds', label: '1', d: () => -0.8, ignore: ['idle'] }] },
  patviews: { add: [{ dim: 'cubes', label: '3–4, structure shown', d: () => -1.6 }] },
};
let codeN = 90;
function stubOf(real, prop) {
  const dims = real.dims.map((d) => ({ key: d.key, label: d.label, levels: d.levels.slice(), step: d.step }));
  prop.add.forEach((a) => { const d = dims.find((x) => x.key === a.dim); d.levels.unshift(a.label); });
  function difficulty(p) {
    const q = { ...p }; let off = 0;
    for (const a of prop.add) {
      if (p[a.dim] === 0) { q[a.dim] = 0; off += a.d(p); (a.ignore || []).forEach((k) => { q[k] = 0; }); } else q[a.dim] = p[a.dim] - 1;
    }
    return real.difficulty(q) + off;
  }
  const id = 'd2-' + real.id;
  PX.ex.define({
    id, version: 1, code: 'EX-' + (codeN++), name: real.name + ' (D2 stub)', short: real.short + ' D2', abilities: real.abilities.slice(), cell: real.cell,
    role: 'train', answer: real.answer, nOptions: real.nOptions, pat: false, perDisplay: real.perDisplay,
    dims, base: real.base, variants: real.variants ? real.variants.slice() : undefined, difficulty,
    chance: (p) => real.chance(p),
    generate(rng, params) { return { ex: id, seed: rng.seed, params, key: 0 }; }, validate() { return true; }, score(item, r) { return { correct: r === item.key }; },
  });
  return PX.ex.get(id);
}
for (const id of Object.keys(P)) {
  if (only && !only.includes(id)) continue;
  const real = PX.ex.get(id), stub = stubOf(real, P[id]);
  const oldMin = PX.ex.minDifficulty(real), newMin = PX.ex.minDifficulty(stub);
  const rows = [];
  for (const A of As) {
    let r10 = 0, n10 = 0, inBand = 0, firstOld = [], lv = [], lvOld = [];
    for (let i = 0; i < N; i++) {
      for (const def of [stub]) {
        const L = new Learner(PX, PX.rng.hash('d2-band', id, A, i), { aboveFloor: A + (oldMin - newMin) });
        const rec = newRecord(PX, T0 - 3600e3, { weeklyGoal: 3, sessionMin: 10 });
        const now = T0 + i * 3600e3 * 7 + 60e3 * (i % 13);
        const res = playSession(PX, rec, L, 'train', { now, display: 'large', pin: def.id, minutes: 10 }, 0, {});
        const mine = res.steps.filter((s) => s.step.exId === def.id && s.out.outcome < 2);
        let fo = -1;
        mine.forEach((s, k) => {
          const b = def.difficulty(s.step.params);
          if (k < 10) { r10 += s.res.correct ? 1 : 0; n10++; if (b < oldMin - 1e-9) inBand++; }
          if (fo < 0 && b >= oldMin - 1e-9) fo = k;
        });
        firstOld.push(fo < 0 ? 99 : fo);
        lv.push(E.est.shown(rec, def, { display: 'large' }).level);
      }
    }
    const med = (a) => a.slice().sort((x, y) => x - y)[Math.floor(a.length / 2)];
    rows.push(`  A ${A >= 0 ? '+' : ''}${A}: first 10 ${(100 * r10 / n10).toFixed(1)} %; ${(100 * inBand / n10).toFixed(0)} % of them in the new band; first item at/above today's floor: median #${med(firstOld) + 1}; level after: median ${med(lv)}`);
  }
  console.log(`\n${id}: today's floor ${oldMin.toFixed(2)} → new floor ${newMin.toFixed(2)} (range ${(PX.ex.maxDifficulty(stub) - newMin).toFixed(2)} logits)\n` + rows.join('\n'));
}
