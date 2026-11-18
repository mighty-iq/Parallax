import fs from 'node:fs';
import { load, firstAlarm, rules } from './analyze.mjs';
const rule = rules.ub(640, 1.645, 0.15);
for (const f of ['fold-linear-0.25-mis.json', 'fold-linear-0.2-mis.json', 'rotate-linear-0.25-mis.json']) {
  const p = '/tmp/p1sim/grid4/' + f; if (!fs.existsSync(p)) continue;
  const D = load(p); let h = 0; for (const L of D.learners) if (firstAlarm(L, rule, 1, 0, 1000) !== null) h++;
  let sb = 0, c = 0; for (const L of D.learners) for (const e of L.evals) if (e.w640) { sb += e.w640.b; c++; }
  console.log('misspec FA', f.padEnd(28), (100 * h / D.learners.length).toFixed(1) + '%', 'mean beta', (sb / c).toFixed(3));
}
const p = '/tmp/p1sim/grid4/fold-plateau-mis.json';
if (fs.existsSync(p)) {
  const D = load(p); const del = []; let pre = 0;
  for (const L of D.learners) { if (firstAlarm(L, rule, 1, 0, 319) !== null) { pre++; continue; } const a = firstAlarm(L, rule, 1, 320, 1e9); del.push(a === null ? Infinity : a - 320); }
  del.sort((x, y) => x - y); const q = (x) => del[Math.floor(x * del.length)];
  console.log('misspec plateau: pre-onset', pre, 'delay q25/med/q75', q(.25), q(.5), q(.75), 'within 800:', (100 * del.filter((x) => x <= 800).length / D.learners.length).toFixed(1) + '%');
}
