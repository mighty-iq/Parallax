import { load, firstAlarm, rules } from './analyze.mjs';
const dir = '/tmp/p1sim/grid/';
const cands = [
  ['W320 ub(1.645,0.15) k2', rules.ub(320, 1.645, 0.15), 2],
  ['W400 ub(1.645,0.10) k2', rules.ub(400, 1.645, 0.10), 2],
  ['W400 ub(1.645,0.15) k2', rules.ub(400, 1.645, 0.15), 2],
  ['W400 ub(1.645,0.15) k1', rules.ub(400, 1.645, 0.15), 1],
  ['W400 ub(1.0,0.10) k2', rules.ub(400, 1.0, 0.10), 2],
];
function plateauReport(file, onset) {
  const D = load(dir + file);
  console.log(`\n${file}: onset at ${onset} answers (rising 0.3/100 before); ${D.learners.length} learners`);
  for (const [lab, rule, k] of cands) {
    let pre = 0; const delays = [];
    for (const L of D.learners) {
      const a = firstAlarm(L, rule, k, 0, 100000);
      if (a !== null && a < onset) { pre++; continue; }
      const b = firstAlarm(L, rule, k, onset, 100000);
      delays.push(b === null ? Infinity : b - onset);
    }
    const n = D.learners.length;
    const within = (d) => (100 * delays.filter((x) => x <= d).length / n).toFixed(0);
    delays.sort((x, y) => x - y);
    const med = delays[Math.floor(delays.length / 2)];
    console.log(lab.padEnd(26), `false alarm before onset ${(100 * pre / n).toFixed(1)}%`, `| flagged within 240/320/400/480/600/800 after onset: ${within(240)} ${within(320)} ${within(400)} ${within(480)} ${within(600)} ${within(800)} %`, `| median delay ${med}`);
  }
}
plateauReport('fold-plateau-0.3-320.json', 320);
plateauReport('fold-plateau-0.3-640.json', 640);
plateauReport('rotate-plateau-0.3-320.json', 320);
plateauReport('span-plateau-0.3-320.json', 320);
plateauReport('orient-plateau-0.3-320.json', 320);
// improvers at 0.25 on other exercises: FA over [W, 1000]
for (const f of ['rotate-linear-0.25.json', 'span-linear-0.25.json', 'orient-linear-0.25.json', 'fold-linear-0.25.json']) {
  const D = load(dir + f);
  const row = cands.map(([lab, rule, k]) => { let h = 0; for (const L of D.learners) if (firstAlarm(L, rule, k, 0, 1000) !== null) h++; return (100 * h / D.learners.length).toFixed(1); });
  console.log('\nFA ' + f.padEnd(26), cands.map((c, i) => c[0] + ': ' + row[i] + '%').join(' | '));
}
// SE comparison across exercises at W400
for (const f of ['fold-linear-0.25.json', 'rotate-linear-0.25.json', 'span-linear-0.25.json', 'orient-linear-0.25.json']) {
  const D = load(dir + f); let s = 0, c = 0;
  for (const L of D.learners) for (const ev of L.evals) if (ev.w400) { s += ev.w400.seA; c++; }
  console.log('mean SE at W400', f, (s / c).toFixed(3));
}
