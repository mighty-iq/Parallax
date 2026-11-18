import fs from 'node:fs';
import { load, firstAlarm, rules } from './analyze.mjs';
const rule = rules.ub(640, 1.645, 0.15);
{
  const D = load('/tmp/p1sim/grid3/fold-expo.json');
  const slope = (L, n) => 100 * L.G / L.tau * Math.exp(-n / L.tau);
  let fl = 0, hi = 0, mid = 0, elig = 0, caught = 0; const at = [];
  for (const L of D.learners) {
    const a = firstAlarm(L, rule, 1, 0, 1400);
    const n05 = L.tau * Math.log(100 * L.G / L.tau / 0.05);
    if (n05 <= 800) { elig++; if (a !== null) caught++; }
    if (a === null) continue;
    fl++; const s = slope(L, a); at.push(s); if (s >= 0.25) hi++; if (s >= 0.15) mid++;
  }
  at.sort((x, y) => x - y);
  console.log('expo: flagged', (100 * fl / D.learners.length).toFixed(1) + '% by 1400 answers; true slope at the flag: median', at[Math.floor(at.length / 2)].toFixed(3), 'q90', at[Math.floor(at.length * 0.9)].toFixed(3), '; flags at slope >= 0.25:', hi, '>= 0.15:', mid, '; learners whose slope was <= 0.05 by answer 800, caught by 1400:', caught + '/' + elig);
}
{
  const D = load('/tmp/p1sim/grid3/fold-step-700.json'); let before = 0, after = 0;
  for (const L of D.learners) { const a = firstAlarm(L, rule, 1, 0, 699); if (a !== null) before++; else { const b = firstAlarm(L, rule, 1, 700, 1400); if (b !== null) after++; } }
  console.log('step (flat from the start, +0.6 jump at 700): flagged in the flat stretch (answers 640-699):', (100 * before / D.learners.length).toFixed(1) + '%', '; flagged only after the jump (700-1400):', (100 * after / D.learners.length).toFixed(1) + '%');
}
