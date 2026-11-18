import fs from 'node:fs';
import { load, firstAlarm, rules } from './analyze.mjs';
const rule = rules.ub(640, 1.645, 0.15);
const q = (a, p) => a.length ? a[Math.min(a.length - 1, Math.floor(p * a.length))] : null;
function plateau(file, onset) {
  if (!fs.existsSync(file)) return;
  const D = load(file); const del = [], sesD = []; let pre = 0;
  for (const L of D.learners) {
    if (firstAlarm(L, rule, 1, 0, onset - 1) !== null) { pre++; continue; }
    const a = firstAlarm(L, rule, 1, onset, 1e9);
    if (a === null) { del.push(Infinity); sesD.push(Infinity); continue; }
    del.push(a - onset);
    const sOn = L.evals.find((e) => e.n >= onset).s, sA = L.evals.find((e) => e.n === a).s;
    sesD.push(sA - sOn);
  }
  del.sort((x, y) => x - y); sesD.sort((x, y) => x - y);
  const N = D.learners.length;
  console.log(file.split('/').pop().padEnd(28), `pre-onset alarms ${(100*pre/N).toFixed(1)}%; delay in answers q25/med/q75 ${q(del,.25)}/${q(del,.5)}/${q(del,.75)}; in sessions ${q(sesD,.25)}/${q(sesD,.5)}/${q(sesD,.75)}; never within data ${(100*del.filter(x=>x===Infinity).length/N).toFixed(1)}%`);
}
function fa(file) {
  if (!fs.existsSync(file)) return;
  const D = load(file); let h = 0; for (const L of D.learners) if (firstAlarm(L, rule, 1, 0, 1000) !== null) h++;
  console.log('FA', file.split('/').pop().padEnd(26), (100 * h / D.learners.length).toFixed(1) + '%');
}
for (const f of ['grid2/fold-plateau.json', 'grid2/rotate-plateau.json', 'grid2/knots-plateau.json', 'grid3/span-plateau.json', 'grid3/orient-plateau.json']) plateau('/tmp/p1sim/' + f, 320);
plateau('/tmp/p1sim/grid3/fold-plateau-640.json', 640);
for (const f of ['grid2/fold-linear-0.25.json', 'grid2/rotate-linear-0.25.json', 'grid2/knots-linear-0.25.json', 'grid3/span-linear-0.25.json', 'grid3/orient-linear-0.25.json', 'grid3/hidden-linear-0.25.json', 'grid2/fold-linear-0.2.json', 'grid2/rotate-linear-0.2.json']) fa('/tmp/p1sim/' + f);
