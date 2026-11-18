import { load, firstAlarm, rules } from './analyze.mjs';
const g = '/tmp/p1sim/grid2/';
const F = (f) => load(g + f);
const lin = { fold10: F('fold-linear-0.1.json'), fold15: F('fold-linear-0.15.json'), fold20: F('fold-linear-0.2.json'), fold25: F('fold-linear-0.25.json'), fold30: F('fold-linear-0.3.json'), rot20: F('rotate-linear-0.2.json'), rot25: F('rotate-linear-0.25.json'), knot25: F('knots-linear-0.25.json') };
const pla = { fold: F('fold-plateau.json'), rot: F('rotate-plateau.json'), knot: F('knots-plateau.json') };
const fa = (D, rule, k) => { let h = 0; for (const L of D.learners) if (firstAlarm(L, rule, k, 0, 1000) !== null) h++; return 100 * h / D.learners.length; };
const det = (D, rule, k, onset, within) => { let h = 0; for (const L of D.learners) { const pre = firstAlarm(L, rule, k, 0, onset - 1); if (pre !== null) continue; const a = firstAlarm(L, rule, k, onset, 100000); if (a !== null && a - onset <= within) h++; } return 100 * h / D.learners.length; };
const rows = [];
for (const W of [320, 400, 480, 560, 640]) for (const z of [1.28, 1.645, 2.0]) for (const d of [0.10, 0.15, 0.20]) for (const k of [1, 2]) {
  const rule = rules.ub(W, z, d);
  const r = { lab: `W${W} z${z} d${d} k${k}` };
  r.fa25 = Math.max(fa(lin.fold25, rule, k), fa(lin.rot25, rule, k), fa(lin.knot25, rule, k));
  r.fa20 = Math.max(fa(lin.fold20, rule, k), fa(lin.rot20, rule, k));
  r.fa15 = fa(lin.fold15, rule, k); r.fa10 = fa(lin.fold10, rule, k);
  r.d400 = Math.min(det(pla.fold, rule, k, 320, 400), det(pla.rot, rule, k, 320, 400), det(pla.knot, rule, k, 320, 400));
  r.d600 = Math.min(det(pla.fold, rule, k, 320, 600), det(pla.rot, rule, k, 320, 600), det(pla.knot, rule, k, 320, 600));
  r.d800 = Math.min(det(pla.fold, rule, k, 320, 800), det(pla.rot, rule, k, 320, 800), det(pla.knot, rule, k, 320, 800));
  rows.push(r);
}
rows.sort((a, b) => b.d600 - a.d600);
console.log('rule                       FA@.25(max fold/rot/knots) FA@.20 FA@.15(fold) FA@.10(fold) | plateau caught within 400/600/800 (min over fold/rot/knots)');
for (const r of rows) if (r.fa25 <= 5) console.log(r.lab.padEnd(26), r.fa25.toFixed(1).padStart(6), r.fa20.toFixed(1).padStart(6), r.fa15.toFixed(1).padStart(6), r.fa10.toFixed(1).padStart(6), '|', r.d400.toFixed(0).padStart(4), r.d600.toFixed(0).padStart(4), r.d800.toFixed(0).padStart(4));
