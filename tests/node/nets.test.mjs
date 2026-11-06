/* EX-05 Nets: generator, validator (3D folding), scorer, difficulty, shortcut solvers, the model
   the view folds with, fallback, timing and learn data (ARCHITECTURE §12, PLAN §3 and §12). Run
   through tests/node/run.mjs. PX_REPORT=1 prints numbers; PX_TEST_ITEMS=<n> shortens the seed loop. */
import { MANIFEST, deepDiff } from './run.mjs';
import { performance } from 'node:perf_hooks';

// Only the files this exercise needs: other exercises' work in progress cannot break it.
const FILES = [...MANIFEST, 'js/ex/nets/gen.js', 'js/ex/nets/learn.js'];
const N_ITEMS = +(process.env.PX_TEST_ITEMS || 10080); // 90 combinations (30 level combinations × 3 variants) × 112
const SEEDS_PER_COMBO = Math.max(1, Math.ceil(N_ITEMS / 90));
// CPU time, not wall time (ARCHITECTURE §12): wall time is 3–5× higher while agents share the
// machine. Here process.threadCpuUsage() moves in scheduler ticks (0 or 2–4 ms per call), too coarse
// for one item, so each item is timed with process.cpuUsage() (µs; all threads, so an upper bound
// of the main thread's time) and the main thread's mean per item comes from a whole round.
const procMs = () => { const u = process.cpuUsage(); return (u.user + u.system) / 1000; };
const threadMs = typeof process.threadCpuUsage === 'function'
  ? () => { const u = process.threadCpuUsage(); return (u.user + u.system) / 1000; } : procMs;

export async function run(t) {
  const PX = t.context({ files: FILES }).PX;
  const def = PX.ex.get('nets');
  t.section('nets: definition');
  t.ok(def, 'nets is registered');
  if (!def) return;
  const H = def.lib;
  t.eq([def.id, def.version, def.code, def.abilities, def.cell, def.role, def.answer, def.nOptions], ['nets', 1, 'EX-05', ['Vz'], 'intrinsic-dynamic', 'train', 'choice', 4], 'id, version, code, abilities, cell, role, answer, nOptions');
  t.eq(def.variants, ['opposite', 'edges', 'cube'], 'variants');
  t.eq(def.dims.map((d) => d.key), ['carried', 'shape', 'between'], 'dims');
  t.eq([def.chance({ variant: 'opposite' }), def.chance({ variant: 'edges' }), def.chance({ variant: 'cube' })], [0.25, 0.5, 0.5], 'chance by variant');
  const all = PX.ex.enumerate(def);
  t.eq(all.length, 90, 'every combination is enumerated');
  const lo = PX.ex.minDifficulty(def), hi = PX.ex.maxDifficulty(def);
  t.ok(hi - lo >= 4, `difficulty spans at least 4 logits (${lo.toFixed(2)} … ${hi.toFixed(2)})`);
  const easiest = all.reduce((a, p) => (def.difficulty(p) < def.difficulty(a) ? p : a));
  const g = def.chance(easiest), pB = g + (1 - g - 0.03) / (1 + Math.exp(def.difficulty(easiest)));
  t.ok(pB > 0.87 && pB < 0.93, `the easiest item is about 90 % right at θ = 0 (${(100 * pB).toFixed(1)} %, ${easiest.variant})`);
  const hardest = all.reduce((a, p) => (def.difficulty(p) > def.difficulty(a) ? p : a));
  t.eq(hardest, { carried: 4, shape: 2, between: 0, variant: 'edges' }, 'the hardest item: edges, 11–15 squares carried, 2-2-2 / 3-3 nets');

  t.section('nets: shapes');
  const D = H.data();
  t.eq(D.shapes.length, 35, '35 free hexominoes');
  // Independent count: fold every hexomino in 3D along a breadth-first tree from square 0.
  let nets3d = 0, agree = 0;
  for (const s of D.shapes) {
    const rn = H.rollNet(s.cells, s.nb, 0);
    const squares = s.cells.map((c, i) => ({ x: c[0], y: c[1], parent: rn.parent[i], hinge: rn.hinge[i] >= 0 ? H.SIDES[rn.hinge[i]] : null }));
    const ok3d = H.folds3d(squares, H.fold3d(squares, 0));
    if (ok3d) nets3d++;
    if (ok3d === s.net) agree++;
  }
  t.eq([nets3d, agree], [11, 35], 'exactly 11 hexominoes fold into a cube, by rolling and by 3D folding alike');
  t.eq([0, 1, 2].map((lv) => D.nets.filter((s) => s.group === lv).length), [6, 3, 2], 'net shape groups: 6 × 1-4-1, 3 × 2-3-1, 2 × 2-2-2 / 3-3');
  t.eq(D.cube.map((c) => [c.nets.length, c.others.length]), [[6, 11], [3, 13], [2, 7]], "'cube' pools per shape level");
  // Why scored 'opposite' items start at distance 3: every distance-2 opposite pair is a straight row.
  let d2 = 0, d2straight = 0;
  for (const s of D.nets) {
    for (let m = 0; m < 6; m++) {
      const o = H.rollNet(s.cells, s.nb, m).face.indexOf(1);
      if (s.dist[m][o] !== 2) continue;
      d2++;
      const dx = s.cells[o][0] - s.cells[m][0], dy = s.cells[o][1] - s.cells[m][1];
      if ((dx === 0 && Math.abs(dy) === 2) || (dy === 0 && Math.abs(dx) === 2)) d2straight++;
    }
  }
  t.ok(d2 > 0 && d2 === d2straight, `every opposite pair at net distance 2 lies in a straight row (${d2straight}/${d2})`);

  t.section('nets: 10 080 items');
  let threw = 0, invalid = 0, keyWrong = 0, foilRight = 0, nonJson = 0, fallbacks = 0, firstBad = null, n = 0;
  const items = [], byV = { opposite: [], edges: [], cube: [] };
  for (let ci = 0; ci < all.length; ci++) {
    const params = all[ci];
    for (let s = 0; s < SEEDS_PER_COMBO; s++) {
      const seed = PX.rng.hash('nets-test', ci, s);
      let item;
      try { item = def.generate(PX.rng(seed), params); } catch (e) { threw++; firstBad = firstBad || `throw ${JSON.stringify(params)}: ${e.message}`; continue; }
      n++;
      if (item.fallback) fallbacks++;
      const v = def.validate(item);
      if (v !== true) { invalid++; firstBad = firstBad || `${JSON.stringify(params)} seed ${seed}: ${v}`; continue; }
      if (!def.score(item, item.key).correct) keyWrong++;
      for (let i = 0; i < item.options.length; i++) if (i !== item.key && def.score(item, i).correct) foilRight++;
      if (n % 50 === 0 && deepDiff(JSON.parse(JSON.stringify(item)), item) !== null) nonJson++;
      if (n % 5 === 0) items.push({ seed, params, item });
      byV[item.variant].push(item);
    }
  }
  t.eq(threw, 0, 'generate never throws' + (threw ? ` (${firstBad})` : ''));
  t.ok(n >= Math.min(10000, N_ITEMS), `at least ${Math.min(10000, N_ITEMS)} items (${n})`);
  t.eq(invalid, 0, 'validate passes on every item' + (invalid ? ` (${firstBad})` : ''));
  t.eq(keyWrong, 0, 'the key scores right');
  t.eq(foilRight, 0, 'every other option scores wrong');
  t.eq(nonJson, 0, 'items survive JSON round trips');
  t.eq(fallbacks, 0, 'no item needed the fallback');
  const yesRate = (v) => byV[v].filter((x) => x.key === 0).length / byV[v].length;
  const tol = Math.max(0.03, 3 * Math.sqrt(0.25 / Math.max(1, byV.cube.length)));
  t.ok(Math.abs(yesRate('edges') - 0.5) < tol && Math.abs(yesRate('cube') - 0.5) < tol, `yes and no are balanced (edges ${(100 * yesRate('edges')).toFixed(1)} %, cube ${(100 * yesRate('cube')).toFixed(1)} % yes)`);

  t.section('nets: the validator catches wrong keys');
  let caught = 0, tried = 0;
  for (const x of items.slice(0, 600)) {
    const bad = JSON.parse(JSON.stringify(x.item));
    bad.key = (bad.key + 1) % bad.options.length;
    tried++;
    if (def.validate(bad) !== true) caught++;
  }
  t.eq(caught, tried, 'a moved key is always rejected');

  t.section('nets: determinism');
  let diff = 0, firstDiff = null;
  for (const x of items) {
    const d = deepDiff(def.generate(PX.rng(x.seed), x.params), x.item);
    if (d) { diff++; firstDiff = firstDiff || d; }
  }
  t.eq(diff, 0, `the same seed gives the same item (${items.length} regenerated)` + (firstDiff ? `: ${firstDiff}` : ''));
  const other = t.context({ files: FILES }).PX.ex.get('nets');
  let diff2 = 0;
  for (const x of items.slice(0, 300)) if (deepDiff(other.generate(PX.rng(x.seed), x.params), x.item)) diff2++;
  t.eq(diff2, 0, 'the same items in a freshly loaded context');

  t.section('nets: malformed responses and fallback');
  let malformedRight = 0;
  for (const x of items.slice(0, 300)) {
    const item = x.item;
    for (const r of [-1, item.options.length, 0.5, String(item.key), null, undefined, NaN, [item.key], {}, true, false]) {
      let res;
      try { res = def.score(item, r); } catch (e) { res = { correct: true }; }
      if (!res || res.correct !== false) malformedRight++;
    }
  }
  t.eq(malformedRight, 0, 'malformed responses score wrong and never throw');
  let badFallback = 0, firstFallback = null;
  for (const params of all) {
    const it = H.fallback(H.norm(params));
    const v = it ? def.validate(it) : 'no item';
    if (!it || it.fallback !== true || v !== true || it.variant !== params.variant) { badFallback++; firstFallback = firstFallback || `${JSON.stringify(params)}: ${v}`; }
  }
  t.eq(badFallback, 0, 'the fallback construction is valid for every params combination' + (firstFallback ? ` (${firstFallback})` : ''));

  t.section('nets: the model the view folds with');
  let poseOff = 0, poseN = 0, partnerBad = 0, meetBad = 0;
  for (const x of items.slice(0, 900)) {
    const item = x.item, P = H.foldPose(item.squares, item.base, item.squares.map(() => Math.PI / 2)), V = H.fold3d(item.squares, item.base).V;
    poseN++;
    if (P.some((cs, i) => cs.some((p, k) => p.some((v, j) => Math.abs(v - V[i][k][j]) > 1e-9)))) poseOff++;
    if (P.some((cs) => cs.some((p) => p[2] < -1e-9 || p[2] > 1 + 1e-9))) poseOff++;
    if (item.variant === 'edges') {
      const m = H.edgeMap(item), e = item.edges, pr = m.partner(e[0].sq, e[0].side);
      const meets = !!pr && pr.sq === e[1].sq && pr.side === e[1].side;
      if (meets !== (item.key === 0)) meetBad++;
      item.squares.forEach((q, i) => H.SIDES.forEach((sd) => {
        const a = m.partner(i, sd);
        if (!a) return;
        const b = m.partner(a.sq, a.side);
        if (!b || b.sq !== i || b.side !== sd) partnerBad++;
      }));
    }
  }
  t.eq(poseOff, 0, `foldPose at 90° gives the validator's folded squares, on the cube above the base (${poseN} items)`);
  t.eq(meetBad, 0, 'edgeMap: the first marked edge meets the second exactly when the key is Yes');
  t.eq(partnerBad, 0, 'edgeMap: every free edge meets exactly one other, both ways');
  const half = H.foldPose(byV.opposite[0].squares, byV.opposite[0].base, byV.opposite[0].squares.map(() => Math.PI / 4));
  t.ok(half.every((cs) => cs.every((p) => p.every(Number.isFinite))), 'foldPose gives finite corners part way (45°)');

  t.section('nets: timing');
  // Main-thread CPU time per item, the best p95 of three rounds; wall time is reported alongside.
  for (let s = 0; s < 30; s++) def.generate(PX.rng(PX.rng.hash('warm', s)), hardest);
  const q = (a, f) => [...a].sort((x, y) => x - y)[Math.floor(f * (a.length - 1))];
  let p95 = Infinity, wall95 = 0, mean = Infinity;
  for (let round = 0; round < 3; round++) {
    const cpu = [], wall = [], th0 = threadMs();
    for (let s = 0; s < 200; s++) {
      const c0 = procMs(), t0 = performance.now();
      def.generate(PX.rng(PX.rng.hash('time', round, s)), hardest);
      wall.push(performance.now() - t0);
      cpu.push(procMs() - c0);
    }
    mean = Math.min(mean, (threadMs() - th0) / 200);
    if (q(cpu, 0.95) < p95) { p95 = q(cpu, 0.95); wall95 = q(wall, 0.95); }
  }
  t.ok(p95 < 20, `generation p95 at the hardest level under 20 ms (CPU ${p95.toFixed(2)} ms, main-thread mean ${mean.toFixed(2)} ms; wall ${wall95.toFixed(2)} ms)`);

  t.section('nets: shortcut solvers');
  const R = shortcutReport(byV);
  const pct = (x) => (100 * x).toFixed(1) + ' %';
  t.ok(R.straight2 <= 0.35, `opposite: "two squares away in a straight line" ≤ 35 % (${pct(R.straight2)})`);
  t.ok(R.farEu <= 0.35, `opposite: "farthest in the net" (straight-line distance) ≤ 35 % (${pct(R.farEu)})`);
  t.ok(R.farGraph <= 0.35, `opposite: "farthest along the net" ≤ 35 % (${pct(R.farGraph)})`);
  t.ok(R.central <= 0.35, `opposite: "the option square most like the others" (most central) ≤ 35 % (${pct(R.central)})`);
  t.ok(R.marks <= 0.35, `opposite: stem-blind "option most like the others" by name and colour ≤ 35 % (${pct(R.marks)})`);
  t.ok(R.closeBest <= 0.6, `edges: "close in the flat net means they meet", best threshold ≤ 60 % (${pct(R.closeBest)} at ${R.closeAt})`);
  t.ok(R.farBest <= 0.6, `edges: the reverse rule, best threshold ≤ 60 % (${pct(R.farBest)})`);
  t.ok(R.row4 <= 0.6 && R.row4exact <= 0.6, `cube: "has 4 in a row" ≤ 60 % (${pct(R.row4)}; exactly 4: ${pct(R.row4exact)})`);
  if (process.env.PX_REPORT) {
    console.log(`       nets: opposite straight2 ${pct(R.straight2)}, far ${pct(R.farEu)}, far-net ${pct(R.farGraph)}, central ${pct(R.central)}, marks ${pct(R.marks)} | edges close ${pct(R.closeBest)} @${R.closeAt}, far ${pct(R.farBest)} | cube row4 ${pct(R.row4)}, row4= ${pct(R.row4exact)}, block rule ${pct(R.block)} | CPU p95 ${p95.toFixed(2)} ms`);
  }
  testLearn(t, PX, def);
}

/* ---------- learn data (js/ex/nets/learn.js) ---------- */

function testLearn(t, PX, def) {
  t.section('nets: learn');
  const L = PX.ex.learn('nets');
  t.ok(L && typeof L === 'object', 'learn data is registered');
  if (!L) return;
  t.ok(typeof L.goal === 'string' && L.goal.length > 10 && L.goal.length <= 120, 'a one-line goal');
  t.ok(def.variants.every((v) => typeof (L.goals || {})[v] === 'string' && L.goals[v].length <= 120), 'a one-line goal per variant');
  t.ok(Array.isArray(L.parts) && L.parts.length >= 3 && L.parts.every((p) => p.id && p.label && p.text && (!p.variant || def.variants.includes(p.variant))), 'labelled parts');
  const valid = (p) => PX.ex.validParams(def, p) === true;
  const easiestOf = (v) => Math.min(...PX.ex.enumerate(def).filter((p) => p.variant === v).map((p) => def.difficulty(p)));
  t.ok(Array.isArray(L.demo) && L.demo.length >= 1 && L.demo.every((d) => valid(d.params) && Number.isInteger(d.seed)), 'demo items with valid params');
  t.ok(L.demo.every((d) => def.difficulty(d.params) <= easiestOf(d.params.variant) + 1e-9), 'demos are at the easiest level of their variant');
  t.ok(def.variants.every((v) => L.demo.some((d) => d.params.variant === v)), 'a demo for every variant');
  const kindOf = (it) => it.fallback ? 'fallback' : it.variant === 'opposite' ? 'opposite' : it.variant === 'edges' ? (it.key === 0 ? 'meet' : 'apart') : (it.key === 0 ? 'net' : 'not-net');
  for (const d of L.demo) t.eq(kindOf(def.generate(PX.rng(d.seed), d.params)), d.kind, `demo seed ${d.seed} gives a ${d.kind} item`);
  t.ok(Array.isArray(L.practice) && L.practice.length >= 3 && L.practice.length <= 5 && L.practice.every(valid), '3–5 practice params');
  t.ok(Array.isArray(L.tips) && L.tips.length >= 3, 'just-in-time tips');
  for (const tip of L.tips || []) {
    const tr = tip.when || {};
    const dimOk = !tr.dim || def.dims.some((d) => d.key === tr.dim && (tr.levels || []).length && tr.levels.every((l) => l >= 0 && l < d.levels.length));
    const varOk = !tr.variant || def.variants.includes(tr.variant);
    t.ok(tip.id && tip.text && (tr.dim || tr.variant) && dimOk && varOk, `tip ${tip.id} has a valid trigger`);
  }
  t.ok(def.variants.every((v) => L.tips.some((x) => (x.when || {}).variant === v)), 'a tip for every variant');
  t.eq((L.strategies || []).map((s) => s.id), ['imagery', 'analytic', 'switch'], 'strategy cards: imagery, analytic, when to switch');
  t.ok(L.strategies.every((s) => s.title && s.text && Array.isArray(s.steps) && s.steps.length >= 2 && s.when), 'every card has a title, a text, steps and when to use it');
  const caps = ['net', 'marked', 'base', 'edges', 'options', 'question', 'tilt', 'fold', 'opposite', 'meet', 'apart', 'closes', 'overlap', 'block'];
  t.ok(caps.every((k) => typeof (L.captions || {})[k] === 'string' && L.captions[k].length > 5), 'every caption the view plays is there');
  t.ok(typeof L.bridge === 'string' && /not been shown/.test(L.bridge), 'a "where it is used" card with its limitation line');
  const o = L.offscreen || {};
  t.ok(o.title && o.text && Array.isArray(o.steps) && o.steps.length >= 3, 'an off-screen challenge: cut out and fold a net');
  const allText = JSON.stringify(L).toLowerCase();
  t.ok(!/\biq\b|smarter|intelligence|brain age|mastered/.test(allText), 'no IQ, intelligence or "mastered" claims (CLAUDE.md rules 2 and 12)');
}

// Expected accuracy of "pick the best-scoring option" with uniform tie-breaking.
function pickBest(scores, key) {
  const best = Math.max(...scores);
  const ties = scores.filter((s) => Math.abs(s - best) < 1e-9).length;
  return Math.abs(scores[key] - best) < 1e-9 ? 1 / ties : 0;
}

function shortcutReport(byV) {
  const R = {};
  const opp = byV.opposite;
  let s2 = 0, fe = 0, fg = 0, ce = 0, mk = 0;
  for (const it of opp) {
    const sq = it.squares, m = sq[it.marked], opts = it.options.map((o) => sq[o.sq]);
    // Two squares away in a straight line (as seen on the grid); otherwise a guess.
    const cand = opts.map((o) => ((o.x === m.x && Math.abs(o.y - m.y) === 2) || (o.y === m.y && Math.abs(o.x - m.x) === 2) ? 1 : 0));
    s2 += cand.some((c) => c) ? pickBest(cand, it.key) : 1 / opts.length;
    fe += pickBest(opts.map((o) => Math.hypot(o.x - m.x, o.y - m.y)), it.key);
    const dist = netDist(sq, it.marked);
    fg += pickBest(it.options.map((o) => dist[o.sq]), it.key);
    ce += pickBest(opts.map((o) => -opts.reduce((t, o2) => t + Math.hypot(o.x - o2.x, o.y - o2.y), 0)), it.key);
    // Stem-blind: the option whose name and colour share most with the others (all differ: a guess).
    mk += pickBest(it.options.map((o) => it.options.reduce((t, o2) => t + (o2 !== o && o2.colour === o.colour ? 1 : 0) + (o2 !== o && o2.name === o.name ? 1 : 0), 0)), it.key);
  }
  Object.assign(R, { straight2: s2 / opp.length, farEu: fe / opp.length, farGraph: fg / opp.length, central: ce / opp.length, marks: mk / opp.length });
  // Edges: "they meet when they are close in the flat net", at every threshold.
  const ed = byV.edges.map((it) => ({ fd: edgeGap(it), yes: it.key === 0 }));
  R.closeBest = 0; R.farBest = 0; R.closeAt = null;
  for (let th = 0.5; th <= 5.5; th += 0.25) {
    const accClose = ed.filter((e) => (e.fd < th) === e.yes).length / ed.length;
    if (accClose > R.closeBest) { R.closeBest = accClose; R.closeAt = th; }
    R.farBest = Math.max(R.farBest, 1 - accClose);
  }
  // Cube: "it folds when it has 4 squares in a row" (and the 2 × 2 block rule, reported only).
  const cu = byV.cube;
  const longest = (it) => {
    let best = 0;
    for (const a of it.squares) for (const [dx, dy] of [[1, 0], [0, 1]]) {
      let k = 0;
      while (it.squares.some((b) => b.x === a.x + dx * k && b.y === a.y + dy * k)) k++;
      best = Math.max(best, k);
    }
    return best;
  };
  R.row4 = cu.filter((it) => (longest(it) >= 4) === (it.key === 0)).length / cu.length;
  R.row4exact = cu.filter((it) => (longest(it) === 4) === (it.key === 0)).length / cu.length;
  R.block = cu.filter((it) => (it.block !== null) === (it.key === 1)).length / cu.length;
  return R;
}

function netDist(sq, from) {
  const d = sq.map(() => -1), q = [from];
  d[from] = 0;
  while (q.length) {
    const a = q.shift();
    sq.forEach((b, j) => { if (d[j] < 0 && Math.abs(b.x - sq[a].x) + Math.abs(b.y - sq[a].y) === 1) { d[j] = d[a] + 1; q.push(j); } });
  }
  return d;
}

function edgeGap(it) {
  const D = { N: [0, -1], E: [1, 0], S: [0, 1], W: [-1, 0] };
  const mid = (e) => { const s = it.squares[e.sq]; return [s.x + 0.5 + D[e.side][0] / 2, s.y + 0.5 + D[e.side][1] / 2]; };
  const a = mid(it.edges[0]), b = mid(it.edges[1]);
  return Math.hypot(a[0] - b[0], a[1] - b[1]);
}
