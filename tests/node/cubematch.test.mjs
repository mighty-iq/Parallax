/* PR-1 Cube Match, version 2 (v1.2, W2-measure; PLAN milestone 6's probe upgrades): which of four drawings is the
   reference cube turned? Definition and version change (version 1's range in def.past), glyph library, rotations,
   validator (not vacuous), 10 000 seeds (valid, no fallback, keys spread, deterministic, fast), the two solvers
   agreeing, shortcut solvers (CLAUDE.md rule 5: pooled within chance + 10 points; per cell too, except the two
   scoped cells spin × swap and flip × swap, reported: DECISIONS 2026-11-19), and the learn data. */
import { MANIFEST } from './run.mjs';

const FILE = 'js/ex/cubematch/gen.js';
const LEARN = 'js/ex/cubematch/learn.js';
const SEEDS_TOTAL = 10008;
const LIMIT = 0.35;
// Cells kept out of the per-cell bound (structural; reported): rotation level, change level
const SCOPED = new Set(['0/0', '2/0']);
// Captions js/ex/cubematch/view.js reads.
const CAPTIONS = ['first', 'options', 'turn', 'match', 'answer', 'verdict'];
// The core and the registry only (all a generator needs), so engine files being edited never break these checks.
const CORE = MANIFEST.filter((f) => f.startsWith('js/core/') || f === 'js/ex/registry.js');
const I3 = [1, 0, 0, 0, 1, 0, 0, 0, 1];

export async function run(t) {
  // This probe alone (plus the core), so another exercise being edited never breaks these checks.
  const PX = t.context({ files: [...CORE, FILE, LEARN] }).PX;
  const X = PX.ex, def = X.get('cubematch'), L = def && def.lib;
  t.ok(def && L, 'cubematch is defined with its lib');
  if (!def) return;
  testDefinition(t, X, def);
  testLearn(t, PX, def, (it, kind) => kind === 'which' && Number.isInteger(it.key));
  t.ok([null, undefined, '1', 1.5, true, {}, [], -1, 4].every((r) => def.score({ key: 1 }, r).correct === false), 'malformed responses score wrong');
  t.ok(def.score({ key: 2 }, 2).correct && !def.score({ key: 2 }, 1).correct, 'the key scores right, another option wrong');
  testGlyphs(t, L);
  testRotations(t, PX, L);
  testValidator(t, PX, def, L);
  testSeeds(t, PX, X, def, L);
}

function testDefinition(t, X, def) {
  t.section('definition');
  t.eq([def.id, def.version, def.code, def.role, def.answer, def.nOptions, def.cell], ['cubematch', 2, 'PR-1', 'probe', 'choice', 4, 'intrinsic-dynamic'], 'id, version 2, code, role, four options, cell');
  t.eq([...def.abilities], ['Vz'], 'abilities');
  t.eq(def.chance({}), 0.25, 'chance 0.25');
  t.eq(def.dims.map((d) => d.key), ['rotation', 'change', 'glyphs'], 'dims as in version 1');
  t.eq(def.past && def.past[1], { min: -2.1, max: 2.1 }, 'version 1\'s range is kept (the trend reads 1.1\'s entries with it)');
  t.eq(def.format, 'cubematch:symbol-cubes-four-options', 'its reserved format');
  const lo = X.minDifficulty(def), hi = X.maxDifficulty(def);
  t.ok(hi - lo >= 4, `difficulty range ≥ 4 logits (${lo.toFixed(2)} … ${hi.toFixed(2)})`);
  t.eq(X.count(def), 24, '24 level combinations');
  t.eq(def.timeLimit({}), 40000, '40 seconds an item');
}

function testGlyphs(t, L) {
  t.section('glyphs');
  for (const pool of L.POOL_KEYS) {
    const ids = L.POOLS[pool];
    t.ok(ids.length >= 7, `pool ${pool} has at least 7 glyphs (6 per cube, with variety)`);
    let pairOk = true, turnOk = true, boxOk = true;
    for (const a of ids) {
      for (let k = 1; k < 4; k++) if (L.strokeDiff(a, k, a) < L.MIN_TURN) turnOk = false;
      for (const b of ids) if (a < b && L.glyphDist(a, b) < L.MIN_PAIR[pool]) pairOk = false;
      for (const line of L.GLYPHS[a].lines) for (const [x, y] of line) if (Math.abs(x) > 2 || Math.abs(y) > 2) boxOk = false;
    }
    t.ok(turnOk, `pool ${pool}: every glyph changes ≥ ${L.MIN_TURN} strokes when turned 90, 180 or 270`);
    t.ok(pairOk, `pool ${pool}: every two glyphs differ by ≥ ${L.MIN_PAIR[pool]} strokes under any turn`);
    t.ok(boxOk, `pool ${pool}: glyphs fit the centred 4 × 4 box`);
  }
  // Confusability really rises with the level: mean nearest-neighbour distance falls.
  const nn = L.POOL_KEYS.map((pool) => {
    const ids = L.POOLS[pool];
    return ids.reduce((s, a) => s + Math.min(...ids.filter((b) => b !== a).map((b) => L.glyphDist(a, b))), 0) / ids.length;
  });
  t.ok(nn[0] > nn[1] && nn[1] > nn[2], `nearest-glyph distance falls from shapes to similar (${nn.map((x) => x.toFixed(1)).join(' > ')})`);
}

function testRotations(t, PX, L) {
  t.section('rotations');
  const key = (M) => M.join();
  t.eq(new Set(L.ROTS.map(key)).size, 24, '24 distinct signed permutation rotations');
  t.eq(new Set(L.VROTS.map(key)).size, 24, '24 distinct rotations by search');
  t.ok(L.VROTS.every((M) => L.ROTS.some((N) => key(N) === key(M))), 'both constructions give the same 24 rotations');
  t.eq(Object.fromEntries(L.ROT_LEVELS.map((lv) => [lv, L.CLASS_ROTS[lv].length])), { spin: 2, quarter: 6, flip: 3, one: 9 }, 'turns per level');
  // For random cubes and every turn of every level, the solver recovers exactly that turn.
  const r = PX.rng(PX.rng.hash('cubematch-rot'));
  let recovered = true, unique = true;
  for (let n = 0; n < 40; n++) {
    const syms = r.shuffle(L.POOLS.letters).slice(0, 6);
    const cube = syms.map((sym, f) => ({ sym, up: r.pick(L.DIRS.filter((d) => d[0] * L.DIRS[f][0] + d[1] * L.DIRS[f][1] + d[2] * L.DIRS[f][2] === 0)) }));
    const v1 = L.drawView(cube, [1, 0, 0, 0, 1, 0, 0, 0, 1]);
    for (const lv of L.ROT_LEVELS) for (const M of L.CLASS_ROTS[lv]) {
      const hits = L.solve(v1, L.drawView(cube, M));
      if (!hits.some((H) => key(H) === key(M))) recovered = false;
      if (hits.length !== 1) unique = false;
    }
  }
  t.ok(recovered, 'solve() finds the turn that made the second drawing');
  t.ok(unique, 'with at least one shared face, exactly one turn fits a same pair');
}

// The validator rejects broken items (it is not vacuous).
function testValidator(t, PX, def, L) {
  t.section('validator');
  const it = def.generate(PX.rng(PX.rng.hash('cm-neg', 1)), { rotation: 1, change: 1, glyphs: 1 });
  t.eq(def.validate(it), true, 'a generated item validates');
  const copy = (x) => JSON.parse(JSON.stringify(x));
  const foil = (it.key + 1) % 4, broken = [];
  let b = copy(it); b.key = foil; broken.push(['keyed to a foil', b]);
  b = copy(it); b.options[foil] = copy(it.options[it.key]); broken.push(['a foil that is the key drawing', b]);
  b = copy(it); b.options[foil] = L.drawView(it.cube, it.turns[foil]); broken.push(['a foil that is the cube turned', b]);
  b = copy(it); b.options[it.key].top.rot = (b.options[it.key].top.rot + 90) % 360; broken.push(['the key with a symbol turned', b]);
  b = copy(it); b.options[foil].top.sym = b.options[foil].front.sym; broken.push(['a symbol shown twice', b]);
  b = copy(it); b.options[foil].top.rot = 45; broken.push(['a rot that is not a quarter turn', b]);
  b = copy(it); b.options.pop(); broken.push(['three options', b]);
  b = copy(it); b.changes[foil] = null; broken.push(['a foil without its difference', b]);
  b = copy(it); b.ref.top.rot = (b.ref.top.rot + 90) % 360; broken.push(['a reference that is not the cube', b]);
  for (const [name, x] of broken) t.ok(def.validate(x) !== true, `rejects: ${name} (${def.validate(x)})`);
}

// Cheap answers that look at the drawings without turning a cube in the mind: each scores an option; the solver takes
// the highest (or lowest) and guesses among ties.
const S3 = ['top', 'front', 'right'];
const slotOf = (v, sym) => S3.find((s) => v[s].sym === sym);
const likeness = (it, withRot) => it.options.map((o, i) => it.options.reduce((n, q, j) => n + (j === i ? 0 : S3.filter((s) => o[s].sym === q[s].sym && (!withRot || o[s].rot === q[s].rot)).length), 0));
const SHORTCUTS = {
  'like the others': (it) => likeness(it, true),
  'like the others by symbol': (it) => likeness(it, false),
  'look-alike': (it) => it.options.map((o) => S3.filter((s) => { const a = slotOf(it.ref, o[s].sym); return a && it.ref[a].rot === o[s].rot; }).length),
  'stayed': (it) => it.options.map((o) => S3.filter((s) => slotOf(it.ref, o[s].sym) === s).length),
  'same turn in place': (it) => it.options.map((o) => S3.filter((s) => o[s].rot === it.ref[s].rot).length),
  'same face in place': (it) => it.options.map((o) => S3.filter((s) => o[s].sym === it.ref[s].sym && o[s].rot === it.ref[s].rot).length),
};
function credit(scores, key, dir) {
  const best = dir === 'max' ? Math.max(...scores) : Math.min(...scores), ties = scores.map((x, i) => (x === best ? i : -1)).filter((i) => i >= 0);
  return ties.includes(key) ? 1 / ties.length : 0;
}

function testSeeds(t, PX, X, def, L) {
  t.section('seeds');
  const combos = X.enumerate(def);
  const acc = {}, keys = [0, 0, 0, 0], times = [];
  let n = 0, bad = [], agree = 0, checked = 0;
  for (let i = 0; i < SEEDS_TOTAL; i++) {
    const p = combos[i % combos.length], cell = `${p.rotation}/${p.change}`;
    const t0 = process.hrtime.bigint();
    const it = def.generate(PX.rng(PX.rng.hash('cm-seed', i)), p);
    times.push(Number(process.hrtime.bigint() - t0) / 1e6);
    n++;
    const v = def.validate(it);
    if (v !== true) bad.push(`${JSON.stringify(p)} seed ${i}: ${v}`);
    keys[it.key]++;
    // the generator's solver and the validator's (two constructions of the 24 turns) agree on every option
    if (i % 25 === 0) {
      checked++;
      if (it.options.every((o, k) => (L.fits(it.ref, o).length > 0) === (k === it.key) && (L.solve(it.ref, o).length > 0) === (k === it.key))) agree++;
      if (!L.sameView(L.drawView(it.cube, I3), it.ref)) t.fail('the reference is not drawn from the stored cube');
    }
    for (const [name, fn] of Object.entries(SHORTCUTS)) {
      const sc = fn(it);
      for (const dir of ['max', 'min']) {
        const k = name + ' (' + dir + ')', a = acc[k] || (acc[k] = { got: 0, n: 0, cells: {} });
        const c = credit(sc, it.key, dir);
        a.got += c; a.n++;
        const cc = a.cells[cell] || (a.cells[cell] = [0, 0]);
        cc[0] += c; cc[1]++;
      }
    }
  }
  t.eq(bad.slice(0, 5), [], `every item validates (${bad.length} bad of ${n})`);
  t.eq(L.stats.fallbacks, 0, 'no item needed the fallback');
  t.eq(agree, checked, `both solvers find exactly the key among the four options (${checked} items)`);
  t.ok(keys.every((k) => k / n > 0.22 && k / n < 0.28), `the key is spread over the four places (${keys.join(', ')})`);
  const a = def.generate(PX.rng(77), { rotation: 3, change: 1, glyphs: 2 }), b = def.generate(PX.rng(77), { rotation: 3, change: 1, glyphs: 2 });
  t.eq(JSON.stringify(a), JSON.stringify(b), 'items are deterministic');
  const p95 = quant(times, 0.95);
  t.ok(p95 < 20, `generation p95 under 20 ms (${p95.toFixed(2)} ms)`);
  for (const p of combos.slice(0, 6)) { const fb = L.fallback(p); if (fb.fallback !== true || def.validate(Object.assign(fb, { params: p })) !== true) t.fail('fallback invalid or not marked for ' + JSON.stringify(p)); }

  t.section('shortcut solvers');
  const lines = [], scoped = [];
  for (const [name, x] of Object.entries(acc)) {
    const pooled = x.got / x.n;
    t.ok(pooled <= LIMIT, `"${name}" pooled ${pct(pooled)} ≤ ${pct(LIMIT)}`);
    const over = Object.entries(x.cells).filter(([cell, [g, m]]) => g / m > LIMIT);
    const outside = over.filter(([cell]) => !SCOPED.has(cell));
    t.ok(outside.length === 0, `"${name}" within ${pct(LIMIT)} in every cell but the scoped ones ${JSON.stringify(outside.map(([cell, [g, m]]) => `${cell} ${pct(g / m)}`))}`);
    over.filter(([cell]) => SCOPED.has(cell)).forEach(([cell, [g, m]]) => scoped.push(`${name} ${cell} ${pct(g / m)}`));
    lines.push(`${name} ${pct(pooled)}`);
  }
  console.log(`       PR-1 cubematch v2: ${n} items; shortcuts pooled: ${lines.join('; ')}`);
  console.log(`       PR-1 scoped cells over ${pct(LIMIT)} (rotation/change): ${scoped.join('; ') || 'none'}`);
  t.ok(scoped.every((x) => parseInt(x.match(/(\d+) %$/)[1], 10) <= 60), 'the scoped cells stay at 60 % or less');
  console.log(`       PR-1 spread: ${spreadLine(X, def)}`);
}

function spreadLine(X, def) {
  const bs = X.enumerate(def).map((p) => def.difficulty(p)).sort((a, b) => a - b);
  let gap = 0;
  for (let i = 1; i < bs.length; i++) gap = Math.max(gap, bs[i] - bs[i - 1]);
  const lo = bs[0], hi = bs[bs.length - 1], bins = [];
  for (let x = lo; x < hi + 1e-9; x += 1) bins.push(bs.filter((b) => b >= x - 1e-9 && (b < x + 1 - 1e-9 || (x + 1 > hi && b <= hi + 1e-9))).length);
  return `${bs.length} combinations over ${lo.toFixed(2)} … ${hi.toFixed(2)} (${(hi - lo).toFixed(2)} logits), largest gap ${gap.toFixed(2)}, per 1-logit bin ${bins.join(' ')}`;
}
function quant(a, q) { const s = a.slice().sort((x, y) => x - y); return s.length ? s[Math.min(s.length - 1, Math.floor(q * s.length))] : NaN; }
function pct(x) { return Math.round(100 * x) + ' %'; }

/* ---------------------------------------------------------------- learn data */

// The one-screen instruction, the worked example (a fixed seed, easiest level) and every caption the view uses;
// probe wording (no practice, no praise, no IQ claims).
function testLearn(t, PX, def, kindOk, freeDims = []) {
  t.section('learn');
  const Ld = PX.ex.learn(def.id);
  t.ok(Ld && typeof Ld.goal === 'string' && Ld.goal.length > 10, 'learn.js registers a goal');
  if (!Ld) return;
  t.ok(Array.isArray(Ld.parts) && Ld.parts.length >= 3 && Ld.parts.every((p) => p.id && p.label && p.text), 'labelled parts');
  t.ok(Ld.instruction && Ld.instruction.title === def.name && Array.isArray(Ld.instruction.lines) && Ld.instruction.lines.length >= 2, 'a one-screen instruction titled with the probe name');
  t.ok(Array.isArray(Ld.demo) && Ld.demo.length >= 1, 'at least one worked example');
  (Ld.demo || []).forEach((d, i) => {
    t.ok(PX.ex.validParams(def, d.params) === true && Number.isInteger(d.seed), `example ${i}: valid params and a fixed seed`);
    t.ok(def.dims.every((dim) => freeDims.includes(dim.key) || d.params[dim.key] === 0), `example ${i} is at the easiest level`);
    const it = def.generate(PX.rng(d.seed), d.params);
    t.ok(def.validate(it) === true && kindOk(it, d.kind), `example ${i} (seed ${d.seed}) gives a valid "${d.kind}" item`);
  });
  const missing = CAPTIONS.filter((k) => !(Ld.captions && typeof Ld.captions[k] === 'string' && Ld.captions[k].length));
  t.eq(missing, [], 'every caption the view uses exists');
  t.ok(!/\bIQ\b|smarter|mastered|genius|brain age|well done|great job/i.test(JSON.stringify(Ld)), 'wording: no IQ, "smarter", "mastered" or praise');
  t.ok(!Ld.practice || Ld.practice.length === 0, 'no practice items (a probe is never trained)');
}
