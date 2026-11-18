// Operating characteristics of candidate stall rules on the detector.mjs outputs.
import fs from 'node:fs';

export function load(f) { return JSON.parse(fs.readFileSync(f, 'utf8')); }

// rule(ev) → true when the evaluation "fires"; k = consecutive firings needed.
// Returns, per learner, the n (answers) of the first alarm inside [nMin, nMax], or null.
export function firstAlarm(learner, rule, k, nMin, nMax) {
  let run = 0;
  for (const ev of learner.evals) {
    if (ev.n < nMin) { run = 0; continue; }
    if (ev.n > nMax) break;
    if (rule(ev)) { run++; if (run >= k) return ev.n; } else run = 0;
  }
  return null;
}

export const rules = {
  ub: (W, z, d) => (ev) => { const f = ev['w' + W]; return !!f && f.b + z * f.seA < d; },
  pt: (W, c) => (ev) => { const f = ev['w' + W]; return !!f && f.b < c; },
  lp: (c) => (ev) => ev.n >= 60 && ev.s >= 2 && ev.lp < c,
  d14: () => (ev) => !!ev.d14 && ev.d14.sess >= 3 && Math.abs(ev.d14.dl) <= ev.d14.band,
};

export function rate(data, rule, k, nMin, nMax) {
  let hit = 0;
  const when = [];
  for (const L of data.learners) {
    const a = firstAlarm(L, rule, k, nMin, nMax);
    if (a !== null) { hit++; when.push(a); }
  }
  when.sort((x, y) => x - y);
  return { p: hit / data.learners.length, med: when.length ? when[Math.floor(when.length / 2)] : null };
}

if (process.argv[1].endsWith('analyze.mjs')) {
  const dir = '/tmp/p1sim/grid/';
  const slopes = ['0', '0.05', '0.1', '0.15', '0.2', '0.25', '0.3', '0.4'];
  const D = Object.fromEntries(slopes.map((s) => [s, load(dir + 'fold-linear-' + s + '.json')]));
  const show = (label, rule, k, nMin, nMax) => {
    const row = slopes.map((s) => (100 * rate(D[s], rule, k, nMin, nMax).p).toFixed(1).padStart(5));
    console.log(label.padEnd(34), row.join(' '));
  };
  console.log('fold, linear learners; % of learners flagged at least once with n in [nMin, 1000]; columns = true slope (logit/100 answers)');
  console.log(''.padEnd(34), slopes.map((s) => s.padStart(5)).join(' '));
  show('draft: LP<0.5 (n>=60, >=3 sess)', rules.lp(0.5), 1, 60, 1000);
  show('draft: LP<0.25', rules.lp(0.25), 1, 60, 1000);
  show('draft: LP<0', rules.lp(0), 1, 60, 1000);
  show('draft: 14-day level change in band', rules.d14(), 1, 60, 1000);
  for (const W of [240, 320, 400]) {
    for (const [z, d] of [[1.645, 0.10], [1.645, 0.15], [1.0, 0.10], [0, 0.10], [0, 0.05], [0, 0.0]]) {
      for (const k of [1, 2]) show(`W${W} b+${z}se<${d} k${k}`, rules.ub(W, z, d), k, W, 1000);
    }
  }
}
