import { load, firstAlarm, rules } from './analyze.mjs';
const D = load('/tmp/p1sim/grid/fold-expo.json');
const cands = [
  ['W400 ub(1.645,0.15) k2', rules.ub(400, 1.645, 0.15), 2],
  ['W400 ub(1.645,0.15) k1', rules.ub(400, 1.645, 0.15), 1],
  ['W320 ub(1.645,0.15) k2', rules.ub(320, 1.645, 0.15), 2],
  ['W400 ub(1.0,0.10) k2', rules.ub(400, 1.0, 0.10), 2],
];
const slope = (L, n) => 100 * L.G / L.tau * Math.exp(-n / L.tau);
console.log('fold, exponential learners as in tests/node/fixtures/learner.mjs (G median 1.4 x rate, tau U(150,500)), 1200 answers each');
let s0 = []; for (const L of D.learners) s0.push(slope(L, 400)); s0.sort((a,b)=>a-b);
console.log('true slope at n=400: quartiles', [0.25,0.5,0.75].map(q=>s0[Math.floor(q*s0.length)].toFixed(3)).join(' '));
let s1 = []; for (const L of D.learners) s1.push(slope(L, 1200)); s1.sort((a,b)=>a-b);
console.log('true slope at n=1200: quartiles', [0.25,0.5,0.75].map(q=>s1[Math.floor(q*s1.length)].toFixed(3)).join(' '));
for (const [lab, rule, k] of cands) {
  let flagged = 0, fa25 = 0, fa15 = 0, ok05 = 0; const at = [];
  let eligible05 = 0, caught05 = 0;
  for (const L of D.learners) {
    const a = firstAlarm(L, rule, k, 0, 1200);
    // learners whose slope fell to <= 0.05 before n = 900 (so >= 300 flat-ish answers remain)
    const n05 = L.tau * Math.log(100 * L.G / L.tau / 0.05);
    if (n05 <= 900) { eligible05++; if (a !== null) caught05++; }
    if (a === null) continue;
    flagged++; const s = slope(L, a); at.push(s);
    if (s >= 0.25) fa25++; if (s >= 0.15) fa15++; if (s <= 0.05) ok05++;
  }
  at.sort((x, y) => x - y);
  const N = D.learners.length;
  console.log(lab.padEnd(26), `flagged ${(100*flagged/N).toFixed(1)}% by n=1200; true slope at the flag: median ${at.length?at[Math.floor(at.length/2)].toFixed(3):'-'}, >=0.25: ${(100*fa25/N).toFixed(1)}% of learners, >=0.15: ${(100*fa15/N).toFixed(1)}%, <=0.05: ${(100*ok05/N).toFixed(1)}%; learners whose slope fell below 0.05 by n=900 caught: ${caught05}/${eligible05}`);
}
