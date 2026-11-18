#!/usr/bin/env node
// C1 spike: Central Point (the geometric median restricted to a lattice of answer points).
// Plain Node (>= 18), no dependencies, deterministic (string-seeded sfc32). Reads and writes no app file.
//
//   node docs/research/v1.2/spikes/C1/spike.mjs            full run (about 7 minutes on one core)
//   node docs/research/v1.2/spikes/C1/spike.mjs --quick    smaller samples (about 1-2 minutes)
//
// Writes results.md (the tables) and results.json (every number) next to this file; prints the tables too.
// Stages: A baseline without constraints; B strict policy on a 7x7 answer grid; C the proposed ladder on a
// half-step answer lattice (targets on 7x7); D minimax over item pools (policies compared per level);
// E checks of the mathematics and of the solver against Weiszfeld's algorithm; F what each dim does to each
// shortcut on its own (no exclusion). Stages run in the order A, B, C, D, F, E.
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import {
  makeRng, solve, weiszfeld, polish, vertexMedian, HEURISTICS, HKEYS, genMixture, makeItem, makeFineItem, xy, dist, snap,
  credit, correctedMean, oneWeiszfeld, ringPts, meanPoint,
} from './lib.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const QUICK = process.argv.includes('--quick');
const OUT = [], JSONOUT = { quick: QUICK, node: process.version };
function log(s = '') { console.log(s); OUT.push(s); }
const pct = (x, n) => (n ? (100 * x / n) : 0);
const f1 = (x) => (Number.isFinite(x) ? x.toFixed(1) : '–');
const f0 = (x) => (Number.isFinite(x) ? Math.round(x).toString() : '–');
const t0 = Date.now();

log('# C1 spike results: Central Point');
log('');
log(`Mode: ${QUICK ? 'quick (smaller samples)' : 'full'}. Node ${process.version}. Every number is a percentage of items unless marked.`);
log('Chance = the expected hit rate of a uniformly random tap on the answer points (mean over items of |band| / points).');
log('Shortcut picks are snapped to the nearest answer point. Seeds are strings: "<stage>|<level>|<index>" (see the code).');
log('');

/* =================================================================== A. baseline: no constraints, 7x7 answers */
{
  const N = QUICK ? 1000 : 4000;
  log('## A. Baseline: random items, no constraints, targets and answers on a 7×7 grid');
  log('');
  log(`${N} items per row (mixture of uniform, one group plus spread, two groups). "right" = total distance within the band of the best grid point.`);
  const rowsA = [];
  for (const band of [0.02, 0.08]) {
    log('');
    log(`Band ${band * 100} %:`);
    log('');
    log('| targets | band pts | chance | ' + HKEYS.map((h) => h).join(' | ') + ' |');
    log('|---|---|---|' + HKEYS.map(() => '---').join('|') + '|');
    for (const k of [3, 4, 5, 6, 7, 8, 9]) {
      const hit = Object.fromEntries(HKEYS.map((h) => [h, 0])); let bsz = 0, ch = 0;
      for (let i = 0; i < N; i++) {
        const rng = makeRng(`A|${k}|${i}`);
        const it = makeItem(7, genMixture(rng, 7, k).T);
        const s = solve(it);
        let nb = 0; for (let p = 0; p < 49; p++) if (s.E[p] <= band) nb++;
        bsz += nb; ch += nb / 49;
        for (const h of HKEYS) if (s.E[HEURISTICS[h].f(it)] <= band) hit[h]++;
      }
      const row = { band, k, bandPts: bsz / N, chance: pct(ch, N), hits: Object.fromEntries(HKEYS.map((h) => [h, pct(hit[h], N)])) };
      rowsA.push(row);
      log(`| ${k} | ${f1(row.bandPts)} | ${f1(row.chance)} | ` + HKEYS.map((h) => f0(row.hits[h])).join(' | ') + ' |');
    }
  }
  // The landscape near the best point (same items): the runner-up's excess, and how often the best grid point is a target.
  log('');
  log('Same items: the runner-up grid point\'s excess over the best (median and 10th–90th percentiles), and the share of items whose best grid point is a target.');
  log('');
  log('| targets | runner-up excess, median | p10 | p90 | best point on a target |');
  log('|---|---|---|---|---|');
  const landA = [];
  for (const k of [3, 4, 5, 6, 7, 8, 9]) {
    const e2 = []; let onT = 0;
    for (let i = 0; i < N; i++) {
      const rng = makeRng(`A|${k}|${i}`);
      const it = makeItem(7, genMixture(rng, 7, k).T);
      const s = solve(it);
      e2.push(s.e2);
      if (it.T.some((p) => p[1] * 7 + p[0] === s.best)) onT++;
    }
    e2.sort((a, b) => a - b);
    const q = (x) => e2[Math.min(e2.length - 1, Math.floor(x * e2.length))];
    const r = { k, e2median: 100 * q(0.5), e2p10: 100 * q(0.1), e2p90: 100 * q(0.9), bestOnTarget: pct(onT, N) };
    landA.push(r);
    log(`| ${k} | ${r.e2median.toFixed(2)} % | ${r.e2p10.toFixed(2)} % | ${r.e2p90.toFixed(2)} % | ${f0(r.bestOnTarget)} % |`);
  }
  JSONOUT.A = rowsA; JSONOUT.Aland = landA;
  log('');
}

/* =================================================================== B. strict policy on a 7x7 answer grid */
{
  const N = QUICK ? 15000 : 60000;
  log('## B. Strict policy on a 7×7 answer grid ("best point only")');
  log('');
  log(`${N} candidates per row. Accepted if: the best grid point is unique, no target, no pick of the 11 shortcuts, and lies within 0.3 steps of the continuous geometric median (a clean key). Then: right = the best point.`);
  log('');
  log('| targets | accepted | mean→key (steps) | key next to the average\'s pick | fixed best point | neighbour of average | average +1 step to the densest group | average +1 step away from the farthest | one Weiszfeld step | observer σ 0.3 | observer σ 0.5 | average-user σ 0.3 |');
  log('|---|---|---|---|---|---|---|---|---|---|---|---|');
  const rowsB = [];
  for (const k of [4, 5, 6, 7, 8, 9]) {
    let acc = 0, trap = 0, adj = 0, nbm = 0, tow = 0, aw = 0, w1 = 0, g3 = 0, g5 = 0, m3 = 0; const freq = new Float64Array(49);
    for (let i = 0; i < N; i++) {
      const rng = makeRng(`B|${k}|${i}`);
      const it = makeItem(7, genMixture(rng, 7, k).T);
      const s = solve(it);
      if (s.nTieBest > 1) continue;
      const key = s.best;
      if (it.T.some((p) => p[1] * 7 + p[0] === key)) continue;
      if (HKEYS.some((h) => HEURISTICS[h].f(it) === key)) continue;
      const wz = weiszfeld(it.T, it.W); const [kx, ky] = xy(7, key);
      if (dist(kx, ky, wz.x, wz.y) > 0.3) continue;
      acc++; freq[key]++;
      const [mx, my] = meanPoint(it); trap += dist(mx, my, kx, ky);
      const mp = HEURISTICS.mean.f(it); const [px, py] = xy(7, mp);
      if (Math.max(Math.abs(px - kx), Math.abs(py - ky)) === 1) adj++;
      const r1 = ringPts(7, mp, 1); nbm += r1.includes(key) ? 1 / r1.length : 0;
      const c = correctedMean(it, 1); if (c.toward === key) tow++; if (c.away === key) aw++;
      if (oneWeiszfeld(it) === key) w1++;
      const nr = makeRng(`Bn|${k}|${i}`);
      if (snap(7, wz.x + 0.3 * nr.normal(), wz.y + 0.3 * nr.normal()) === key) g3++;
      if (snap(7, wz.x + 0.5 * nr.normal(), wz.y + 0.5 * nr.normal()) === key) g5++;
      if (snap(7, mx + 0.3 * nr.normal(), my + 0.3 * nr.normal()) === key) m3++;
    }
    const row = { k, accepted: pct(acc, N), n: acc, trap: trap / acc, adjacent: pct(adj, acc), fixed: pct(Math.max(...freq), acc), nbMean: pct(nbm, acc), toward1: pct(tow, acc), away1: pct(aw, acc), weiszfeld1: pct(w1, acc), obs03: pct(g3, acc), obs05: pct(g5, acc), meanUser03: pct(m3, acc) };
    rowsB.push(row);
    log(`| ${k} | ${row.accepted.toFixed(2)} % (${acc}) | ${row.trap.toFixed(2)} | ${f0(row.adjacent)} | ${f0(row.fixed)} | ${f0(row.nbMean)} | ${f0(row.toward1)} | ${f0(row.away1)} | ${f0(row.weiszfeld1)} | ${f0(row.obs03)} | ${f0(row.obs05)} | ${f0(row.meanUser03)} |`);
  }
  log('');
  log('Chance here is 1/49 = 2.0 %, so the bound of standing rule 5 is 12 %.');
  JSONOUT.B = rowsB;
  log('');
}

/* =================================================================== shared: candidates on the half-step lattice */
const GC = 7, F = 2, GF = (GC - 1) * F + 1; // targets on 7x7, answers on 13x13 (half steps)
function candidate(seedStr, k) {
  const rng = makeRng(seedStr);
  const g = genMixture(rng, GC, k);
  const it = makeFineItem(GC, F, g.T);
  return { it, fam: g.fam };
}
// Evaluates one candidate against every rule; returns null when the trap minimum fails (cheap test first).
function evaluate(it, band, trapMin, seedStr) {
  const wz = weiszfeld(it.T, it.W); const [mx, my] = meanPoint(it);
  const trap = dist(mx, my, wz.x, wz.y) / F; // in coarse steps (dot spacing)
  if (trap < trapMin) return null;
  const s = solve(it); const inB = (p) => s.E[p] <= band;
  const picks = {}; for (const h of HKEYS) picks[h] = HEURISTICS[h].f(it);
  const hit = {}; for (const h of HKEYS) hit[h] = inB(picks[h]);
  const targetInBand = it.T.some((p) => inB(p[1] * it.G + p[0]));
  const cm = [1, 2, 3, 4].map((sh) => correctedMean(it, sh));
  const partial = {}; cm.forEach((c, j) => { partial['toward' + (j + 1)] = inB(c.toward); partial['away' + (j + 1)] = inB(c.away); });
  partial.weiszfeld1 = inB(oneWeiszfeld(it));
  let nb = 0; for (let p = 0; p < it.G * it.G; p++) if (inB(p)) nb++;
  const r1 = ringPts(it.G, picks.mean, 1), r2 = ringPts(it.G, picks.mean, 2);
  const second = { nbMean: r1.filter(inB).length / r1.length, ring2Mean: r2.filter(inB).length / r2.length };
  const nr = makeRng(seedStr + '|obs');
  const obs = {
    gm03: snap(it.G, wz.x + 0.3 * F * nr.normal(), wz.y + 0.3 * F * nr.normal()),
    gm05: snap(it.G, wz.x + 0.5 * F * nr.normal(), wz.y + 0.5 * F * nr.normal()),
    mean03: snap(it.G, mx + 0.3 * F * nr.normal(), my + 0.3 * F * nr.normal()),
  };
  return { s, wz, trap, inB, picks, hit, targetInBand, partial, nb, second, obs, band };
}
const POLICIES = {
  trapOnly: (ev) => true,
  outlierOnly: (ev) => !ev.hit.mean && !ev.hit.trim1 && !ev.hit.dense,
  strict: (ev) => !ev.targetInBand && HKEYS.every((h) => !ev.hit[h]),
  hard: (ev) => !ev.targetInBand && HKEYS.every((h) => !ev.hit[h]) && Object.values(ev.partial).every((v) => !v),
};

/* =================================================================== C. the proposed ladder (half-step answers) */
// rated: the proposed ladder (targets x band, trap >= 1 dot). practice: tutorial and practice cells (unrated).
// excluded: cells shown to explain why they are not in the ladder.
const LADDER = [];
for (const band of [0.01, 0.005, 0.0025]) for (const k of [4, 5, 6, 7, 8]) LADDER.push({ set: 'rated', k, trapMin: 1.0, band });
for (const k of [3, 4, 5]) LADDER.push({ set: 'practice', k, trapMin: 0.5, band: 0.02 });
for (const k of [4, 6, 8]) LADDER.push({ set: 'excluded', k, trapMin: 0.5, band: 0.01 });
for (const k of [4, 6, 8]) LADDER.push({ set: 'excluded', k, trapMin: 1.5, band: 0.01 });
for (const k of [4, 6, 8]) LADDER.push({ set: 'excluded', k, trapMin: 1.0, band: 0.02 });
{
  const WANT_R = QUICK ? 1500 : 10000, CAP_R = QUICK ? 150000 : 1500000;
  const WANT_O = QUICK ? 800 : 3000, CAP_O = QUICK ? 60000 : 400000;
  const WANT = WANT_R, CAP = CAP_R;
  log('## C. Proposed format: targets on the 7×7 dot lattice, answers on the 13×13 half-step lattice, strict policy');
  log('');
  log(`Per level: candidates are drawn until ${WANT_R} (rated) or ${WANT_O} (practice, excluded) are accepted under the strict policy, or ${CAP_R} / ${CAP_O} have been tried. Sets: rated = the proposed ladder; practice = tutorial and practice cells (unrated, bounds not required); excluded = cells left out of the ladder, shown for the reason. Strict = no target and none of the 11 shortcut picks inside the band. Hard = strict, and also no corrected average (1–4 half-steps towards the densest group or away from the farthest target) and no one-step Weiszfeld point inside the band. trap = distance from the average to the continuous geometric median, in dot spacings.`);
  log('');
  log('| set | targets | trap ≥ | band | accepted (strict) | n | tries per item p95 | CPU ms per item mean / p95 | band pts | chance | max first-order shortcut | fixed best point | neighbour of average | ring 2 round average | average→densest +1 dot | one Weiszfeld step | hard: share of strict | observer σ 0.3 (strict / hard) | observer σ 0.5 (strict / hard) | average-user σ 0.3 | credit: observer σ 0.5 / average-user / random tap |');
  log('|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|');
  const rowsC = [];
  for (const L of LADDER) {
    const want = L.set === 'rated' ? WANT_R : WANT_O, cap = L.set === 'rated' ? CAP_R : CAP_O;
    let tried = 0, acc = 0, accHard = 0, sinceLast = 0; const gaps = [], cpu = [];
    let cpu0 = process.cpuUsage();
    const z = { chance: 0, bsz: 0, nbMean: 0, ring2: 0, tow2: 0, w1: 0, gm03: 0, gm05: 0, mean03: 0, gm03h: 0, gm05h: 0, crGm05: 0, crMean: 0, crRand: 0 };
    const firstHits = Object.fromEntries(HKEYS.map((h) => [h, 0]));
    const freq = new Float64Array(GF * GF); let halfKey = 0;
    const checks = { solverAboveContinuous: 0, keyFarFromGM: 0, maxKeyGM: 0, bandEmpty: 0 };
    while (acc < want && tried < cap) {
      const seed = `C|${L.k}|${L.trapMin}|${L.band}|${tried}`;
      tried++; sinceLast++;
      const { it } = candidate(seed, L.k);
      const ev = evaluate(it, L.band, L.trapMin, seed);
      if (!ev || !POLICIES.strict(ev)) continue;
      acc++; gaps.push(sinceLast); sinceLast = 0;
      { const c = process.cpuUsage(cpu0); cpu.push((c.user + c.system) / 1000); }
      const isHard = POLICIES.hard(ev); if (isHard) accHard++;
      z.bsz += ev.nb; z.chance += ev.nb / (GF * GF);
      for (const h of HKEYS) if (ev.hit[h]) firstHits[h]++;
      for (let p = 0; p < GF * GF; p++) if (ev.inB(p)) freq[p]++;
      const [bx, by] = xy(GF, ev.s.best); if (bx % F || by % F) halfKey++;
      z.nbMean += ev.second.nbMean; z.ring2 += ev.second.ring2Mean;
      if (ev.partial.toward2) z.tow2++; if (ev.partial.weiszfeld1) z.w1++;
      if (ev.inB(ev.obs.gm03)) { z.gm03++; if (isHard) z.gm03h++; }
      if (ev.inB(ev.obs.gm05)) { z.gm05++; if (isHard) z.gm05h++; }
      if (ev.inB(ev.obs.mean03)) z.mean03++;
      z.crGm05 += credit(ev.s.E[ev.obs.gm05], L.band); z.crMean += credit(ev.s.E[ev.picks.mean], L.band);
      let cr = 0; for (let p = 0; p < GF * GF; p++) cr += credit(ev.s.E[p], L.band); z.crRand += cr / (GF * GF);
      // independent checks: the continuous median is never worse than the best lattice point; distance between them
      let Sg = 0; for (const t of it.T) Sg += dist(ev.wz.x, ev.wz.y, t[0], t[1]);
      if (Sg > ev.s.Sstar + 1e-9) checks.solverAboveContinuous++;
      const kg = dist(bx, by, ev.wz.x, ev.wz.y) / F; if (kg > checks.maxKeyGM) checks.maxKeyGM = kg; if (kg > 0.5) checks.keyFarFromGM++;
      if (ev.nb === 0) checks.bandEmpty++;
      cpu0 = process.cpuUsage();
    }
    gaps.sort((a, b) => a - b); cpu.sort((a, b) => a - b);
    const p95 = gaps.length ? gaps[Math.min(gaps.length - 1, Math.floor(gaps.length * 0.95))] : NaN;
    const cpuMean = cpu.length ? cpu.reduce((a, b) => a + b, 0) / cpu.length : NaN;
    const cpuP95 = cpu.length ? cpu[Math.min(cpu.length - 1, Math.floor(cpu.length * 0.95))] : NaN;
    const maxFirst = Math.max(...HKEYS.map((h) => firstHits[h]));
    const row = {
      ...L, tried, n: acc, accepted: pct(acc, tried), triesP95: p95, cpuMs: cpuMean, cpuMsP95: cpuP95, bandPts: z.bsz / acc, chance: pct(z.chance, acc),
      maxFirstOrder: pct(maxFirst, acc), fixed: pct(Math.max(...freq), acc), halfStepKeys: pct(halfKey, acc),
      nbMean: pct(z.nbMean, acc), ring2Mean: pct(z.ring2, acc), towardDensest1dot: pct(z.tow2, acc), weiszfeld1: pct(z.w1, acc),
      hardShare: pct(accHard, acc), obs03: pct(z.gm03, acc), obs05: pct(z.gm05, acc), obs03hard: pct(z.gm03h, accHard), obs05hard: pct(z.gm05h, accHard),
      meanUser03: pct(z.mean03, acc), creditObs05: z.crGm05 / acc, creditMean: z.crMean / acc, creditRandom: z.crRand / acc, checks,
    };
    rowsC.push(row);
    log(`| ${L.set} | ${L.k} | ${L.trapMin} | ${L.band * 100} % | ${row.accepted.toFixed(2)} % | ${acc} | ${f0(p95)} | ${cpuMean.toFixed(1)} / ${cpuP95.toFixed(1)} | ${f1(row.bandPts)} | ${f1(row.chance)} | ${f0(row.maxFirstOrder)} | ${f0(row.fixed)} | ${f0(row.nbMean)} | ${f0(row.ring2Mean)} | ${f0(row.towardDensest1dot)} | ${f0(row.weiszfeld1)} | ${f0(row.hardShare)} | ${f0(row.obs03)} / ${f0(row.obs03hard)} | ${f0(row.obs05)} / ${f0(row.obs05hard)} | ${f0(row.meanUser03)} | ${row.creditObs05.toFixed(2)} / ${row.creditMean.toFixed(2)} / ${row.creditRandom.toFixed(2)} |`);
  }
  log('');
  log('Checks over every accepted item (independent of the acceptance rules):');
  log('');
  log('| set | targets | trap ≥ | band | n | continuous median worse than the best lattice point | best point more than half a dot from the continuous median | largest distance (dots) | empty band |');
  log('|---|---|---|---|---|---|---|---|---|');
  for (const r of rowsC) log(`| ${r.set} | ${r.k} | ${r.trapMin} | ${r.band * 100} % | ${r.n} | ${r.checks.solverAboveContinuous} | ${r.checks.keyFarFromGM} | ${r.checks.maxKeyGM.toFixed(2)} | ${r.checks.bandEmpty} |`);
  log('');
  log('Keys on half-step positions (between dots), per level: ' + rowsC.map((r) => `${r.k}/${r.trapMin}/${r.band * 100}%: ${f0(r.halfStepKeys)} %`).join('; ') + '.');
  JSONOUT.C = rowsC;
  log('');
}

/* =================================================================== D. minimax over item pools */
{
  const N = QUICK ? 30000 : 150000;
  log('## D. Minimax over item pools: which acceptance policy bounds the shortcuts at each level');
  log('');
  log(`One pool of ${N} candidates per level (half-step answers); each policy accepts a subset. Bounded set = the 11 shortcuts, the fixed best point and "a neighbour of the average's pick". Advantage = hit rate − chance, in points; the standing rule allows 10.`);
  log('');
  log('| targets | trap ≥ | band | policy | accepted | chance | worst shortcut (advantage) | neighbour of average (adv.) | fixed point (adv.) | max advantage | within 10? |');
  log('|---|---|---|---|---|---|---|---|---|---|---|');
  const rowsD = [];
  const LEVELS = [];
  for (const band of [0.005, 0.01, 0.02]) for (const trapMin of [0.5, 1.0]) for (const k of [4, 6, 8]) LEVELS.push({ k, trapMin, band });
  for (const L of LEVELS) {
    const evs = [];
    for (let i = 0; i < N; i++) {
      const seed = `D|${L.k}|${L.trapMin}|${L.band}|${i}`;
      const { it } = candidate(seed, L.k);
      const ev = evaluate(it, L.band, L.trapMin, seed);
      if (ev) evs.push(ev);
    }
    const res = {};
    for (const [pn, pol] of Object.entries(POLICIES)) {
      const acc = evs.filter(pol); const n = acc.length;
      if (!n) { res[pn] = { n: 0 }; log(`| ${L.k} | ${L.trapMin} | ${L.band * 100} % | ${pn} | 0 | – | – | – | – | – | no items |`); continue; }
      let ch = 0, nb = 0; const freq = new Float64Array(GF * GF); const hits = Object.fromEntries(HKEYS.map((h) => [h, 0]));
      for (const ev of acc) { ch += ev.nb / (GF * GF); nb += ev.second.nbMean; for (const h of HKEYS) if (ev.hit[h]) hits[h]++; for (let p = 0; p < GF * GF; p++) if (ev.inB(p)) freq[p]++; }
      const chance = pct(ch, n);
      let worst = HKEYS[0]; for (const h of HKEYS) if (hits[h] > hits[worst]) worst = h;
      const advWorst = pct(hits[worst], n) - chance, advNb = pct(nb, n) - chance, advFixed = pct(Math.max(...freq), n) - chance;
      const maxAdv = Math.max(advWorst, advNb, advFixed);
      res[pn] = { n, accepted: pct(n, N), chance, worst, advWorst, advNb, advFixed, maxAdv };
      log(`| ${L.k} | ${L.trapMin} | ${L.band * 100} % | ${pn} | ${pct(n, N).toFixed(2)} % | ${f1(chance)} | ${worst} (${f0(advWorst)}) | ${f0(advNb)} | ${f0(advFixed)} | ${f0(maxAdv)} | ${maxAdv <= 10 ? (n < 30 ? 'yes, but n < 30' : 'yes') : 'no'} |`);
    }
    // the minimax choice: the policy with the smallest maximum advantage among those with at least 0.2 % acceptance
    let bestP = null; for (const [pn, r] of Object.entries(res)) if (r.n && r.accepted >= 0.2 && (!bestP || r.maxAdv < res[bestP].maxAdv)) bestP = pn;
    rowsD.push({ ...L, policies: res, minimax: bestP, minimaxValue: bestP ? res[bestP].maxAdv : null });
  }
  log('');
  log('Minimax per level (policy with the smallest worst-case advantage among those accepting at least 0.2 % of candidates):');
  log('');
  log('| targets | trap ≥ | band | minimax policy | worst-case advantage (points) |');
  log('|---|---|---|---|---|');
  for (const r of rowsD) log(`| ${r.k} | ${r.trapMin} | ${r.band * 100} % | ${r.minimax || 'none feasible'} | ${r.minimaxValue == null ? '–' : f0(r.minimaxValue)} |`);
  JSONOUT.D = rowsD.map((r) => ({ k: r.k, trapMin: r.trapMin, band: r.band, minimax: r.minimax, minimaxValue: r.minimaxValue, policies: r.policies }));
  log('');
}

/* =================================================================== F. what each dim does to each shortcut (no exclusion) */
{
  const N = QUICK ? 6000 : 30000;
  log('## F. What each dim does to each shortcut on its own (no exclusion, half-step answers)');
  log('');
  log(`${N} candidates per row; only the trap minimum filters items. Cells: hit rate in % (chance in the first column). A dim "bounds" a shortcut when its hit rate falls to within 10 points of chance.`);
  const sweeps = [
    { name: 'trap minimum (6 targets, band 1 %)', rows: [0, 0.5, 1.0, 1.5, 2.0].map((t) => ({ k: 6, band: 0.01, trapMin: t, label: `trap ≥ ${t}` })) },
    { name: 'band (6 targets, trap ≥ 1)', rows: [0.0025, 0.005, 0.01, 0.02, 0.04].map((b) => ({ k: 6, band: b, trapMin: 1.0, label: `band ${b * 100} %` })) },
    { name: 'targets (band 1 %, trap ≥ 1)', rows: [4, 5, 6, 7, 8].map((k) => ({ k, band: 0.01, trapMin: 1.0, label: `${k} targets` })) },
  ];
  const rowsF = [];
  for (const sw of sweeps) {
    log('');
    log(`Sweep: ${sw.name}`);
    log('');
    log('| level | items | chance | ' + HKEYS.join(' | ') + ' | neighbour of average |');
    log('|---|---|---|' + HKEYS.map(() => '---').join('|') + '|---|');
    for (const R of sw.rows) {
      let n = 0, ch = 0, nb = 0; const hit = Object.fromEntries(HKEYS.map((h) => [h, 0]));
      for (let i = 0; i < N; i++) {
        const seed = `F|${R.k}|${R.trapMin}|${R.band}|${i}`;
        const { it } = candidate(seed, R.k);
        const ev = evaluate(it, R.band, R.trapMin, seed);
        if (!ev) continue;
        n++; ch += ev.nb / (GF * GF); nb += ev.second.nbMean;
        for (const h of HKEYS) if (ev.hit[h]) hit[h]++;
      }
      const row = { sweep: sw.name, ...R, n, chance: pct(ch, n), nbMean: pct(nb, n), hits: Object.fromEntries(HKEYS.map((h) => [h, pct(hit[h], n)])) };
      rowsF.push(row);
      log(`| ${R.label} | ${n} | ${f1(row.chance)} | ` + HKEYS.map((h) => f0(row.hits[h])).join(' | ') + ` | ${f0(row.nbMean)} |`);
    }
  }
  JSONOUT.F = rowsF;
  log('');
}

/* =================================================================== E. mathematics and solver checks */
{
  const N = QUICK ? 2000 : 10000;
  log('## E. Checks of the mathematics used in the teaching texts, and of the solver');
  log('');
  const rng = makeRng('E|checks');
  // 1. pulls cancel at an interior median; 2. ray invariance; 3. majority; 4. four points in convex position; 5. three points
  let maxResid = 0, interior = 0, maxRayShift = 0, majorityFail = 0, quadMax = 0, quadN = 0, triMaxDev = 0, triN = 0, obtuseFail = 0, obtuseN = 0;
  for (let i = 0; i < N; i++) {
    const k = rng.int(3, 9); const T = []; for (let j = 0; j < k; j++) T.push([rng.next() * 10, rng.next() * 10]); const W = T.map(() => 1);
    const vm = vertexMedian(T, W); // a median at a target is decided by the subgradient condition, not by the algorithm
    const g = vm >= 0 ? { x: T[vm][0], y: T[vm][1], atTarget: vm } : polish(T, W, weiszfeld(T, W));
    if (vm < 0) { interior++; if (g.resid > maxResid) maxResid = g.resid; }
    // slide every target along its ray from the median by a factor in [0.3, 3]; the median must not move
    if (vm < 0) {
      const T2 = T.map((p) => { const fct = 0.3 + 2.7 * rng.next(); return [g.x + fct * (p[0] - g.x), g.y + fct * (p[1] - g.y)]; });
      const g2 = polish(T2, W, weiszfeld(T2, W)); const sh = dist(g.x, g.y, g2.x, g2.y); if (sh > maxRayShift) maxRayShift = sh;
    }
    // majority: one target carries at least half of the total weight
    const Wm = T.map(() => 1); const j0 = rng.int(0, k - 1); Wm[j0] = k; // weight k against k-1 others of weight 1 (more than half)
    if (vertexMedian(T, Wm) !== j0) majorityFail++;
    const gm = weiszfeld(T, Wm); if (!(gm.atTarget === j0 || dist(gm.x, gm.y, T[j0][0], T[j0][1]) < 1e-6)) majorityFail++;
  }
  for (let i = 0; i < N; i++) { // four points on two crossing segments through c: the median is c
    const c = [rng.next() * 10, rng.next() * 10]; const a1 = rng.next() * Math.PI, a2 = a1 + 0.3 + rng.next() * (Math.PI - 0.6);
    const R = [0, 1, 2, 3].map(() => 0.5 + rng.next() * 5); // one distance per target along its ray from c
    const T = [[c[0] + R[0] * Math.cos(a1), c[1] + R[0] * Math.sin(a1)], [c[0] - R[1] * Math.cos(a1), c[1] - R[1] * Math.sin(a1)], [c[0] + R[2] * Math.cos(a2), c[1] + R[2] * Math.sin(a2)], [c[0] - R[3] * Math.cos(a2), c[1] - R[3] * Math.sin(a2)]];
    const g = polish(T, [1, 1, 1, 1], weiszfeld(T, [1, 1, 1, 1])); quadN++; const d = dist(g.x, g.y, c[0], c[1]); if (d > quadMax) quadMax = d;
  }
  for (let i = 0; i < N; i++) { // three points: 120° at the median when every angle < 120°, else the obtuse vertex
    const T = [[rng.next() * 10, rng.next() * 10], [rng.next() * 10, rng.next() * 10], [rng.next() * 10, rng.next() * 10]];
    const ang = (o, a, b) => { const v1 = [a[0] - o[0], a[1] - o[1]], v2 = [b[0] - o[0], b[1] - o[1]]; return Math.acos(Math.max(-1, Math.min(1, (v1[0] * v2[0] + v1[1] * v2[1]) / (Math.hypot(...v1) * Math.hypot(...v2))))) * 180 / Math.PI; };
    const A = [ang(T[0], T[1], T[2]), ang(T[1], T[0], T[2]), ang(T[2], T[0], T[1])];
    const vm = vertexMedian(T, [1, 1, 1]);
    const g = vm >= 0 ? { x: T[vm][0], y: T[vm][1] } : polish(T, [1, 1, 1], weiszfeld(T, [1, 1, 1]));
    const big = A.findIndex((a) => a >= 120);
    if (big >= 0) { obtuseN++; if (vm !== big) obtuseFail++; }
    else if (Math.min(...A) > 1) { triN++; const P = [g.x, g.y]; const dev = Math.max(Math.abs(ang(P, T[0], T[1]) - 120), Math.abs(ang(P, T[1], T[2]) - 120), Math.abs(ang(P, T[0], T[2]) - 120)); if (dev > triMaxDev) triMaxDev = dev; }
  }
  const E = { N, interior, maxResid, maxRayShift, majorityFail, quadN, quadMax, triN, triMaxDev, obtuseN, obtuseFail };
  JSONOUT.E = E;
  log(`- Pulls cancel: over ${interior} interior medians of random sets (3–9 points; medians at a target are recognised by the subgradient condition and left out), the largest |sum of unit vectors| after Weiszfeld and Newton refinement was ${maxResid.toExponential(1)}.`);
  log(`- Slide the outlier: moving every target along its ray from the median by a factor 0.3–3 moved the median by at most ${maxRayShift.toExponential(1)} (${interior} sets).`);
  log(`- Half or more in one place: a target with weight k against k−1 targets of weight 1 (more than half of the total) was the median in ${N - majorityFail} of ${N} sets.`);
  log(`- Cross the pairs: for ${quadN} four-point sets on two crossing segments, the median was at the crossing within ${quadMax.toExponential(1)}.`);
  log(`- Three targets: ${triN} triangles with all angles under 120° had 120° angles at the median within ${triMaxDev.toExponential(1)}°; ${obtuseN - obtuseFail} of ${obtuseN} triangles with an angle of 120° or more had the median at that corner.`);
  log('');
}

log(`Run time: ${((Date.now() - t0) / 1000).toFixed(0)} s.`);
writeFileSync(path.join(HERE, QUICK ? 'results-quick.md' : 'results.md'), OUT.join('\n') + '\n');
writeFileSync(path.join(HERE, QUICK ? 'results-quick.json' : 'results.json'), JSON.stringify(JSONOUT, null, 1) + '\n');
