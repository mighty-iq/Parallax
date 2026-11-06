/* EX-02 Rotate: generator, validator, scorer and shortcut solvers (ARCHITECTURE.md §12,
   PLAN.md §12.1). Run: node tests/node/run.mjs rotate

   1. definition: fields, chance per variant, difficulty range ≥ 4 logits, base ≈ 90 % for θ = 0
   2. 10 080 items (35 seeds × 288 level combinations × variants): generate never throws,
      validate passes, the key scores right and every other response wrong, determinism,
      JSON round trip, no fallbacks
   3. balance: samediff keys ≈ 50 % same; pick copies spread over the 4 positions; copies and
      mirrors have the same turn angles on average (the angle gives no clue)
   4. shortcut solvers over ≥ 2 000 items per variant, each ≤ chance + 10 points:
      stem-based (option most like the reference by silhouette area, by clearly visible cubes,
      by bounding-box aspect) and stem-blind (odd ones out, the options most like the others,
      the most alike pair); for samediff with the best possible threshold
   5. the fallback construction is valid for every params combination
   6. generation time at the hardest level: CPU time per item (the machine may be shared, so
      wall time is reported but not asserted); p95 must stay under 20 ms
   7. learn data: shape, valid params, demo seeds give the kinds they claim
   8. readability: in every shown picture each arm keeps ≥ 50 % of its length (Shepard and
      Metzler avoided end-on arms) and every bend is ≥ 40° from parallel (no L seen edge-on),
      no arm is longer than half the figure; framing (lib.outline, lib.frameTan) at desktop
      and phone stage shapes: zoom 1–3, pictures fill their frames (the four options at one
      scale, samediff's two figures at one scale) and a show-me turn never leaves its frame */
import { MANIFEST, deepDiff } from './run.mjs';
import { performance } from 'node:perf_hooks';

const FILES = [...MANIFEST, 'js/ex/rotate/gen.js', 'js/ex/rotate/learn.js'];
const SEEDS_PER_COMBO = 35;
const SOLVER_ITEMS = 2016; // per variant
const BOUND = 0.10;        // shortcut solvers may beat chance by at most 10 points
// Frame shapes (width / height) from css/ex.css at 1366 × 768 and 412 × 880: the pick stage
// and one samediff tile below the stage labels (view.js frames pictures under them); option
// thumbnails are square.
const ASPECTS = { pick: { desktop: 4.3, phone: 2.15 }, samediff: { desktop: 1.58, phone: 1.03 } };

export async function run(t) {
  // An own context with only the files Rotate needs, so other exercises' work in progress
  // cannot break this test.
  const PX = t.context({ files: FILES }).PX;
  const def = PX.ex.get('rotate');
  t.ok(def, 'rotate is defined');
  if (!def) return;
  const L = def.lib;
  testDefinition(t, PX, def);
  const pools = testItems(t, PX, def, L);
  testBalance(t, pools);
  testSolvers(t, pools, L);
  testFallback(t, PX, def, L);
  testTiming(t, PX, def);
  testLearn(t, PX, def);
}

/* ---------- 1. definition ---------- */

function testDefinition(t, PX, def) {
  t.section('definition');
  t.eq([def.id, def.version, def.code, def.short], ['rotate', 1, 'EX-02', 'Rotate'], 'identity');
  t.eq(def.abilities.slice(), ['Vz', 'SR'], 'Vz is primary for 3D polycubes');
  t.eq([def.cell, def.role, def.answer, def.nOptions, def.nCorrect], ['intrinsic-dynamic', 'train', 'multi', 4, 2], 'format');
  t.eq(def.variants.slice(), ['samediff', 'pick'], 'variants');
  t.eq(def.dims.map((d) => d.key), ['angle', 'axis', 'cubes'], 'dims');
  t.eq(def.dims[0].levels.slice(), [20, 40, 60, 80, 100, 120, 140, 160, 180], 'angle levels');
  t.eq(def.dims[1].levels.slice(), ['vertical', 'horizontal', 'picture', 'oblique'], 'axis levels (§14c order)');
  t.eq(def.dims[2].levels.slice(), [6, 8, 10, 12], 'cube levels');
  t.near(def.chance({ variant: 'samediff' }), 0.5, 1e-12, 'samediff chance');
  t.near(def.chance({ variant: 'pick' }), 1 / 6, 1e-12, 'pick chance');
  t.near(def.chance({}), 0.5, 1e-12, 'a missing variant is samediff');
  const span = PX.ex.maxDifficulty(def) - PX.ex.minDifficulty(def);
  t.ok(span >= 4, `difficulty range spans ≥ 4 logits (got ${span.toFixed(2)})`);
  const pEasy = 0.5 + (1 - 0.5 - 0.03) * PX.util.sigmoid(0 - PX.ex.minDifficulty(def));
  t.near(pEasy, 0.90, 0.02, 'a beginner at θ = 0 gets the easiest same/mirror item right about 90 % of the time');
  t.eq(PX.ex.count(def), 288, '9 angles × 4 axes × 4 cube counts × 2 variants');
}

/* ---------- 2. 10 080 items ---------- */

function otherResponses(item) {
  if (item.answer === 'yesno') return [!item.key];
  const out = [];
  for (let a = 0; a < 4; a++) for (let b = a + 1; b < 4; b++) {
    if (a !== item.key[0] || b !== item.key[1]) out.push([a, b]);
  }
  return out;
}

const MALFORMED = [null, undefined, 1, '1', 'same', [], [0], [0, 0], [0, 1, 2], [-1, 2], [0, 9], { 0: 1 }];

function testItems(t, PX, def, L) {
  t.section('10 080 items');
  const combos = PX.ex.enumerate(def);
  t.eq(combos.length, 288, 'every level combination is enumerated');
  let n = 0, thrown = 0, invalid = 0, keyWrong = 0, otherRight = 0, nondet = 0, json = 0, fallbacks = 0, malformedRight = 0;
  let shortArm = 0, longArm = 0, badZoom = 0, edgeOn = 0, minShare = Infinity, maxBend = 0, maxOut = 0;
  const fill = { ref: [], opt: [], pair: [] };
  const firstInvalid = [];
  const pools = { samediff: [], pick: [], keys: { same: 0, mirror: 0, pos: [0, 0, 0, 0] }, angles: { copy: [], mirror: [] }, endArm: 0, mirrors: 0 };
  for (const params of combos) {
    for (let s = 0; s < SEEDS_PER_COMBO; s++) {
      const seed = PX.rng.hash('rotate-test', PX.ex.paramsCode(def, params), s);
      let item;
      try { item = def.generate(PX.rng(seed), params); } catch (e) { thrown++; continue; }
      n++;
      const v = def.validate(item);
      if (v !== true) { invalid++; if (firstInvalid.length < 3) firstInvalid.push(`${PX.ex.paramsKey(params)} seed ${seed}: ${v}`); continue; }
      if (item.fallback) fallbacks++;
      if (s % 3 === 0) {
        const shown = [item.ref].concat(item.figs);
        for (const f of shown) {
          const dirs = [], shares = L.armShares(item.shapes[f.s], L.fromQuat(f.q), item.radius, dirs);
          const m = Math.min(...shares), b = Math.max(...L.bendCos(dirs));
          if (m < minShare) minShare = m;
          if (m < 0.5) shortArm++;
          if (b > maxBend) maxBend = b;
          if (b > L.BEND_COS) edgeOn++;
        }
        for (const a of L.arms(item.shapes[0])) if (a.to - a.from > Math.floor((item.n - 1) / 2)) longArm++;
        const fr = framing(L, item, s % 6 === 0);
        badZoom += fr.badZoom;
        maxOut = Math.max(maxOut, fr.maxOut);
        for (const k of Object.keys(fill)) fill[k].push(...fr.fill[k]);
      }
      if (!def.score(item, item.key).correct) keyWrong++;
      for (const r of otherResponses(item)) if (def.score(item, r).correct) otherRight++;
      if (s === 0) for (const r of MALFORMED) { try { if (def.score(item, r).correct) malformedRight++; } catch (e) { malformedRight++; } }
      if (s % 7 === 0 && deepDiff(def.generate(PX.rng(seed), params), item) !== null) nondet++;
      if (s % 7 === 3 && deepDiff(JSON.parse(JSON.stringify(item)), item) !== null) json++;
      // material for the balance checks and the shortcut solvers
      if (item.variant === 'samediff') {
        pools.keys[item.key ? 'same' : 'mirror']++;
        if (pools.samediff.length < SOLVER_ITEMS) pools.samediff.push(item);
      } else {
        item.key.forEach((k) => pools.keys.pos[k]++);
        item.figs.forEach((f) => pools.angles[f.s === 0 ? 'copy' : 'mirror'].push(f.deg - item.angle));
        if (pools.pick.length < SOLVER_ITEMS && s % 2 === 0) pools.pick.push(item);
      }
      const d = item.diff[0];
      pools.mirrors++;
      if (d.length && (d[0] === 0 || d[d.length - 1] === item.n - 1) && d[d.length - 1] - d[0] === d.length - 1) pools.endArm++;
    }
  }
  for (const msg of firstInvalid) t.fail('invalid item: ' + msg);
  t.ok(n >= 10000, `at least 10 000 items (got ${n})`);
  t.eq(thrown, 0, 'generate never throws');
  t.eq(invalid, 0, 'validate passes for every item');
  t.eq(keyWrong, 0, 'the key always scores right');
  t.eq(otherRight, 0, 'every other response scores wrong');
  t.eq(malformedRight, 0, 'malformed responses score wrong and never throw');
  t.eq(nondet, 0, 'same seed → same item');
  t.eq(json, 0, 'items survive a JSON round trip');
  t.eq(fallbacks, 0, 'no item needed the fallback construction');
  t.section('readability');
  t.eq(shortArm, 0, `every arm of every shown picture keeps ≥ 50 % of its length (smallest ${(100 * minShare).toFixed(1)} %)`);
  t.eq(edgeOn, 0, `every bend of every shown picture is ≥ 40° from parallel on screen (closest ${(Math.acos(maxBend) * 180 / Math.PI).toFixed(1)}°)`);
  t.eq(longArm, 0, 'no arm is longer than half the figure');
  t.eq(badZoom, 0, 'every frame zooms the model picture by 1 to 3');
  t.ok(maxOut <= 0.97, `no picture, and no pose of a show-me turn, leaves its frame (largest reach ${maxOut.toFixed(3)} of the half-frame)`);
  const med = (a) => PX.util.median(a), p10 = (a) => [...a].sort((x, y) => x - y)[Math.floor(a.length / 10)];
  const fills = Object.keys(fill).map((k) => `${k} ${med(fill[k]).toFixed(2)} (p10 ${p10(fill[k]).toFixed(2)})`).join(', ');
  t.ok(med(fill.ref) >= 0.88 && med(fill.opt) >= 0.8 && med(fill.pair) >= 0.8 && Object.values(fill).every((a) => p10(a) >= 0.6),
    `pictures fill their frames: the pick reference alone, the four options at one scale, samediff's two figures at one scale (median, p10 of the frame: ${fills})`);
  console.log(`       rotate readability: smallest arm share ${(100 * minShare).toFixed(1)} %; frame fill median (p10): ${fills}; farthest reach ${maxOut.toFixed(3)}`);
  pools.n = n;
  return pools;
}

// Framing as view.js does it, at the desktop and phone frame shapes. fill: how much of its
// frame's height or width each picture covers (1 = edge to edge); maxOut: the farthest reach of
// any picture, or of any pose of a show-me turn sampled finely, from the frame's centre.
function framing(L, item, fine) {
  const r = item.radius, TH = L.TAN_HALF;
  const ref = L.outline(item.shapes[0], item.ref.q, r);
  const figs = item.figs.map((f) => L.outline(item.shapes[f.s], f.q, r));
  const turns = item.figs.map((f, k) => L.turnOutlines(item, k));
  const turn = L.unionOutline([].concat(...turns));
  const out = { badZoom: 0, maxOut: 0, fill: { ref: [], opt: [], pair: [] } };
  // reach of box b from the frame centre c, vertically and horizontally (1 = the frame's edge)
  const reach = (b, c, tanV) => Math.max(Math.abs(b[1] - c[1]), Math.abs(b[3] - c[1])) * TH / tanV;
  const reachX = (b, c, tanV, a) => Math.max(Math.abs(b[0] - c[0]), Math.abs(b[2] - c[0])) * TH / (tanV * a);
  const centre = (b) => [(b[0] + b[2]) / 2, (b[1] + b[3]) / 2];
  function frame(group, a, into) {
    const tanV = L.frameTan(group.map((g) => g.box), a), zoom = TH / (tanV * Math.min(1, a));
    if (!(zoom >= 1 - 1e-9 && zoom <= L.ZOOM_MAX + 1e-9)) out.badZoom++;
    for (const g of group) {
      const c = centre(g.box);
      for (const b of g.poses || [g.box]) out.maxOut = Math.max(out.maxOut, reach(b, c, tanV, a), reachX(b, c, tanV, a));
      if (g.fill) into.push(Math.max(reach(g.box, c, tanV, a), reachX(g.box, c, tanV, a)));
    }
  }
  const finePoses = (k) => fine ? L.turnOutlines(item, k, 48) : turns[k];
  for (const dev of ['desktop', 'phone']) {
    const a = ASPECTS[item.variant][dev];
    if (item.variant === 'pick') {
      frame([{ box: ref, fill: true }], a, out.fill.ref);
      frame([{ box: turn, poses: [].concat(...item.figs.map((f, k) => finePoses(k))) }], a, []);
    } else {
      frame([{ box: ref, fill: true }, { box: figs[0], fill: true }], a, out.fill.pair);
      frame([{ box: turn, poses: finePoses(0) }, { box: figs[0] }], a, []);
    }
  }
  if (item.variant === 'pick') frame(figs.map((b) => ({ box: b, fill: true })), 1, out.fill.opt);
  return out;
}

/* ---------- 3. balance ---------- */

function testBalance(t, pools) {
  t.section('balance');
  const k = pools.keys, nSD = k.same + k.mirror;
  t.near(k.same / nSD, 0.5, 0.03, `samediff: same and mirror equally often (${(100 * k.same / nSD).toFixed(1)} % same)`);
  const totalPos = k.pos.reduce((a, b) => a + b, 0);
  k.pos.forEach((c, i) => t.near(c / totalPos, 0.25, 0.03, `pick: option ${i + 1} is a copy as often as the others`));
  const mean = (a) => a.reduce((x, y) => x + y, 0) / a.length;
  const dc = mean(pools.angles.copy), dm = mean(pools.angles.mirror);
  t.near(dc, dm, 2, `pick: copies and mirrors are turned by the same angles on average (copies ${dc.toFixed(1)}°, mirrors ${dm.toFixed(1)}° from the level angle)`);
  t.ok(pools.angles.copy.concat(pools.angles.mirror).every((d) => Math.abs(d) <= 40), 'pick: every option within ±40° of the level angle');
  t.ok(pools.endArm / pools.mirrors > 0.5, `the mirror usually differs in one end arm (${(100 * pools.endArm / pools.mirrors).toFixed(0)} % of figures)`);
}

/* ---------- 4. shortcut solvers ---------- */

const FEATS = ['area', 'visible', 'aspect'];
function feats(L, item) {
  const fig = (f) => L.features(item.shapes[f.s], L.fromQuat(f.q), item.radius);
  return { ref: fig(item.ref), opts: item.figs.map(fig) };
}
// Distance on one feature; aspect on a log scale (2:1 and 1:2 are equally far from 1:1).
function dist(f, a, b) { return f === 'aspect' ? Math.abs(Math.log(a[f] / b[f])) : Math.abs(a[f] - b[f]); }

function pickTwo(scores, rng) {
  // the two options with the lowest score; ties broken by a fixed pseudo-random order
  const idx = [0, 1, 2, 3].map((i) => [scores[i], rng(), i]).sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  return [idx[0][2], idx[1][2]].sort((a, b) => a - b);
}
function lcg(seed) { let s = seed >>> 0; return () => (s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296; }

function testSolvers(t, pools, L) {
  t.section('shortcut solvers');
  const report = [];
  // pick: chance 1/6
  const P = pools.pick.map((item) => ({ item, f: feats(L, item) }));
  t.ok(P.length >= 2000, `≥ 2 000 pick items for the solvers (got ${P.length})`);
  const solvers = {};
  for (const f of FEATS) {
    solvers[`stem: most like the reference by ${f}`] = ({ f: F }) => F.opts.map((o) => dist(f, o, F.ref));
  }
  for (const f of ['area', 'visible']) {
    const meanTo = (F, i) => F.opts.reduce((s, o, j) => s + (j === i ? 0 : dist(f, F.opts[i], o)), 0) / 3;
    solvers[`blind: odd ones out by ${f}`] = ({ f: F }) => F.opts.map((o, i) => -meanTo(F, i));
    solvers[`blind: most like the others by ${f}`] = ({ f: F }) => F.opts.map((o, i) => meanTo(F, i));
  }
  const rng = lcg(7);
  const chance = 1 / 6;
  for (const [name, fn] of Object.entries(solvers)) {
    let right = 0;
    for (const x of P) {
      const pick = pickTwo(fn(x), rng);
      if (pick[0] === x.item.key[0] && pick[1] === x.item.key[1]) right++;
    }
    const acc = right / P.length;
    report.push(`${name} ${(100 * acc).toFixed(1)} %`);
    t.ok(acc <= chance + BOUND, `pick, ${name}: ${(100 * acc).toFixed(1)} % ≤ ${(100 * (chance + BOUND)).toFixed(1)} %`);
  }
  // the two most alike options as the pair (stem-blind)
  for (const f of ['area', 'visible']) {
    let right = 0;
    for (const x of P) {
      let best = null;
      for (let a = 0; a < 4; a++) for (let b = a + 1; b < 4; b++) {
        const d = dist(f, x.f.opts[a], x.f.opts[b]) + rng() * 1e-9;
        if (!best || d < best[0]) best = [d, a, b];
      }
      if (best[1] === x.item.key[0] && best[2] === x.item.key[1]) right++;
    }
    const acc = right / P.length;
    report.push(`blind: most alike pair by ${f} ${(100 * acc).toFixed(1)} %`);
    t.ok(acc <= chance + BOUND, `pick, most alike pair by ${f}: ${(100 * acc).toFixed(1)} % ≤ ${(100 * (chance + BOUND)).toFixed(1)} %`);
  }
  // samediff: chance 0.5; "same" when the right figure is within a threshold of the left one
  // (stem) or above a threshold on its own (blind); the best threshold is chosen afterwards,
  // so these are the strongest solvers of their kind.
  const S = pools.samediff.map((item) => ({ item, f: feats(L, item) }));
  t.ok(S.length >= 2000, `≥ 2 000 samediff items for the solvers (got ${S.length})`);
  for (const f of FEATS) {
    for (const kind of ['stem', 'blind']) {
      const vals = S.map((x) => kind === 'stem' ? dist(f, x.f.opts[0], x.f.ref) : x.f.opts[0][f]);
      const sorted = [...new Set(vals)].sort((a, b) => a - b);
      let best = 0;
      for (let q = 0; q <= 40; q++) {
        const th = sorted[Math.min(sorted.length - 1, Math.floor(q / 40 * (sorted.length - 1)))];
        let right = 0;
        S.forEach((x, i) => { if ((vals[i] <= th) === x.item.key) right++; });
        best = Math.max(best, right / S.length, 1 - right / S.length);
      }
      report.push(`samediff ${kind} ${f} ${(100 * best).toFixed(1)} %`);
      t.ok(best <= 0.5 + BOUND, `samediff, ${kind} by ${f} (best threshold): ${(100 * best).toFixed(1)} % ≤ 60 %`);
    }
  }
  console.log('       rotate shortcut solvers: ' + report.join('; '));
}

/* ---------- 5. fallback ---------- */

function testFallback(t, PX, def, L) {
  t.section('fallback');
  let bad = 0;
  for (const params of PX.ex.enumerate(def)) {
    const it = L.fallback(L.norm(params));
    if (!it || it.fallback !== true || def.validate(it) !== true) bad++;
  }
  t.eq(bad, 0, 'the fallback construction is valid for every params combination');
}

/* ---------- 6. timing ---------- */

function testTiming(t, PX, def) {
  t.section('timing');
  const out = [];
  for (const variant of ['pick', 'samediff']) {
    const cpu = [], wall = [];
    const params = { angle: 8, axis: 3, cubes: 3, variant };
    for (let s = 0; s < 300; s++) {
      const c0 = process.cpuUsage(), w0 = performance.now();
      def.generate(PX.rng(PX.rng.hash('rotate-timing', s)), params);
      const c = process.cpuUsage(c0);
      wall.push(performance.now() - w0);
      cpu.push((c.user + c.system) / 1000);
    }
    const q = (a, p) => PX.util.quantile(a, p);
    out.push(`${variant} CPU median ${q(cpu, 0.5).toFixed(1)} ms, p95 ${q(cpu, 0.95).toFixed(1)} ms (wall p95 ${q(wall, 0.95).toFixed(1)} ms)`);
    t.ok(q(cpu, 0.95) < 20, `hardest ${variant}: p95 CPU time ${q(cpu, 0.95).toFixed(1)} ms < 20 ms`);
  }
  console.log('       rotate generation at the hardest level: ' + out.join('; '));
}

/* ---------- 7. learn data ---------- */

function testLearn(t, PX, def) {
  t.section('learn');
  const L = PX.ex.learn('rotate');
  t.ok(L && typeof L === 'object', 'learn data is registered');
  if (!L) return;
  t.ok(typeof L.goal === 'string' && L.goal.length > 10 && L.goal.length <= 120, 'a one-line goal');
  t.ok(L.goals && typeof L.goals.samediff === 'string' && typeof L.goals.pick === 'string', 'a goal per variant');
  t.ok(Array.isArray(L.parts) && L.parts.length >= 2 && L.parts.every((p) => p.id && p.label && p.text), 'labelled parts');
  const valid = (p) => PX.ex.validParams(def, p) === true;
  t.ok(Array.isArray(L.demo) && L.demo.length >= 1 && L.demo.every((d) => valid(d.params) && Number.isInteger(d.seed)), 'demo items with valid params');
  t.ok(L.demo.every((d) => PX.ex.difficulty(def, d.params) <= PX.ex.minDifficulty(def) + 0.61), 'demos are at the easiest levels');
  for (const d of L.demo) {
    const item = def.generate(PX.rng(d.seed), d.params);
    if (d.kind) t.eq(item.key === true ? 'same' : item.key === false ? 'mirror' : 'pick', d.kind, `demo seed ${d.seed} gives a ${d.kind} item`);
  }
  t.ok(Array.isArray(L.practice) && L.practice.length >= 3 && L.practice.length <= 5 && L.practice.every(valid), '3–5 practice params');
  t.ok(Array.isArray(L.tips) && L.tips.length >= 3, 'just-in-time tips');
  for (const tip of L.tips || []) {
    const tr = tip.when || {};
    const dimOk = !tr.dim || def.dims.some((d) => d.key === tr.dim && (tr.levels || []).every((l) => l >= 0 && l < d.levels.length));
    const varOk = !tr.variant || def.variants.indexOf(tr.variant) >= 0;
    t.ok(tip.id && tip.text && dimOk && varOk && (tr.dim || tr.variant), `tip ${tip.id} has a valid trigger`);
  }
  for (const id of ['depth', 'oblique']) t.ok((L.tips || []).some((x) => x.id === id), `a tip when ${id} turns first appear`);
  const ids = (L.strategies || []).map((s) => s.id);
  t.eq(ids, ['imagery', 'analytic', 'switch'], 'strategy cards: imagery, analytic, when to switch');
  t.ok((L.strategies || []).every((s) => s.title && s.text && Array.isArray(s.steps) && s.steps.length >= 2), 'every card has a title, a text and steps');
  const all = JSON.stringify(L).toLowerCase();
  t.ok(!/\biq\b|smarter|intelligence|brain age|mastered/.test(all), 'no IQ, intelligence or "mastered" claims (CLAUDE.md rules 2 and 12)');
}
