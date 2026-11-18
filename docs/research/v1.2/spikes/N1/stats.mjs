import { cell } from './cand.mjs';
import { walk } from './lib.mjs';
const C = { leg: [2.5, 15], path: [10, 28], dMax: 20, M: 600 };
for (const [n, band, tol, rot] of [[2, 'large', 30, null], [3, 'medium', 30, null], [3, 'large', 30, null], [4, 'medium', 20, null], [4, 'large', 20, null], [3, 'large', 30, [30, 150]], [4, 'medium', 20, [30, 150]]]) {
  const r = cell(n, band, tol, C, 200, 777 + n + tol, 2, rot);
  const P = r.items.map((it) => it.legs.reduce((s, x) => s + x, 0)), D = r.items.map((it) => walk(it.legs, it.turns).d);
  const minLeg = r.items.map((it) => Math.min(...it.legs)), ratio = r.items.map((it) => Math.max(...it.legs) / Math.min(...it.legs));
  const m = (a) => a.reduce((s, x) => s + x, 0) / a.length, med = (a) => { const s = [...a].sort((x, y) => x - y); return s[s.length >> 1]; };
  console.log(`${n} ${band} ${tol}${rot ? ' +rot' : ''}: n=${r.items.length} path mean ${m(P).toFixed(1)} m, home d mean ${m(D).toFixed(1)} m, shortest leg median ${med(minLeg).toFixed(1)} m, longest/shortest median ${med(ratio).toFixed(1)}`);
}
