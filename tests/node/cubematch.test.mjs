/* PR-1 Cube Match: definition, glyph library, rotations, validator, 10 000+ seeds, shortcut solvers,
   alternate forms and the spread of the item model. Run through tests/node/run.mjs. */
import { MANIFEST } from './run.mjs';

const FILE = 'js/ex/cubematch/gen.js';
const LEARN = 'js/ex/cubematch/learn.js';
const SEEDS_TOTAL = 10000;
// Captions js/ex/cubematch/view.js reads.
const CAPTIONS = ['first', 'second', 'turn', 'same', 'swapped', 'turned', 'answerSame', 'answerDifferent', 'verdictSame', 'verdictSwap', 'verdictTurn'];
// The core and the registry only (all a generator needs), so engine files being edited never break these checks.
const CORE = MANIFEST.filter((f) => f.startsWith('js/core/') || f === 'js/ex/registry.js');

export async function run(t) {
  // This probe alone (plus the core), so another exercise being edited never breaks these checks.
  const PX = t.context({ files: [...CORE, FILE, LEARN] }).PX;
  const X = PX.ex, def = X.get('cubematch'), L = def && def.lib;
  t.ok(def && L, 'cubematch is defined with its lib');
  if (!def) return;
  testDefinition(t, X, def);
  testLearn(t, PX, def, (it, kind) => (kind === 'same') === it.key);
  t.ok([null, undefined, 1, 0, 'true', 'same', {}, []].every((r) => def.score({ key: true }, r).correct === false && def.score({ key: false }, r).correct === false), 'malformed responses score wrong');
  testGlyphs(t, L);
  testRotations(t, PX, L);
  testValidator(t, PX, def, L);
  testSemantics(t, PX, def, L);
  testSeeds(t, PX, X, def, L);
}

function testDefinition(t, X, def) {
  t.section('definition');
  t.eq([def.id, def.version, def.code, def.role, def.answer, def.cell], ['cubematch', 1, 'PR-1', 'probe', 'yesno', 'intrinsic-dynamic'], 'id, version, code, role, answer, cell');
  t.eq([...def.abilities], ['Vz'], 'abilities');
  t.eq(def.chance({}), 0.5, 'chance 0.5');
  t.eq(def.dims.map((d) => d.key), ['rotation', 'change', 'glyphs'], 'dims');
  const lo = X.minDifficulty(def), hi = X.maxDifficulty(def);
  t.ok(hi - lo >= 4, `difficulty range ≥ 4 logits (${lo.toFixed(2)} … ${hi.toFixed(2)})`);
  t.eq(X.count(def), 24, '24 level combinations');
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
  const p = { rotation: 1, change: 1, glyphs: 1 };
  const find = (want) => {
    for (let s = 0; s < 200; s++) {
      const it = def.generate(PX.rng(PX.rng.hash('cm-neg', s)), p);
      if (it.key === want) return it;
    }
    return null;
  };
  const same = find(true), diff = find(false);
  t.ok(same && diff, 'found a same and a different item');
  if (!same || !diff) return;
  const copy = (x) => JSON.parse(JSON.stringify(x));
  const broken = [];
  let b = copy(same); b.key = false; broken.push(['a same item keyed different', b]);
  b = copy(diff); b.key = true; broken.push(['a different item keyed same', b]);
  b = copy(same);
  const s2 = L.SLOTS.find((s) => L.SLOTS.some((u) => b.views[0][u].sym === b.views[1][s].sym));
  b.views[1][s2].rot = (b.views[1][s2].rot + 90) % 360; broken.push(['a shared symbol turned in a same item', b]);
  b = copy(same); b.views[1].top.sym = b.views[1].front.sym; broken.push(['a symbol shown twice', b]);
  b = copy(same); b.views[1].top.rot = 45; broken.push(['a rot that is not a quarter turn', b]);
  b = copy(same); b.symbols[0] = 'arrow'; broken.push(['a symbol from another pool', b]);
  b = copy(diff); b.change = null; broken.push(['a different item without its change', b]);
  b = copy(same); b.params = { rotation: 3, change: 1, glyphs: 1 }; broken.push(['the wrong number of shared symbols for the level', b]);
  for (const [what, item] of broken) t.ok(def.validate(item) !== true, `validate() rejects ${what}`);
  t.ok(def.validate(same) === true && def.validate(diff) === true, 'the untouched items pass');
}

// Semantics: "same" means some full cube (any symbols on the hidden faces, any orientation) and some
// turn draw exactly the second drawing. Brute force over hidden faces and turns, independent of solve().
function testSemantics(t, PX, def, L) {
  t.section('semantics');
  const I3 = [1, 0, 0, 0, 1, 0, 0, 0, 1];
  const perp = (f) => L.DIRS.filter((d) => d[0] * L.DIRS[f][0] + d[1] * L.DIRS[f][1] + d[2] * L.DIRS[f][2] === 0);
  function bruteSame(v1, v2) {
    const shown1 = L.SLOTS.map((s) => v1[s].sym);
    const extra = L.SLOTS.map((s) => v2[s].sym).filter((x) => !shown1.includes(x)).concat(['Z1', 'Z2', 'Z3']);
    const base = new Array(6);
    for (const s of L.SLOTS) base[L.SLOT_DIR[s]] = { sym: v1[s].sym, up: L.upOf(s, v1[s].rot) };
    const hidden = [1, 3, 5];
    for (const a of extra) for (const b of extra) for (const c of extra) {
      if (a === b || b === c || a === c) continue;
      for (let o = 0; o < 64; o++) {
        const cube = base.slice();
        [a, b, c].forEach((sym, i) => { cube[hidden[i]] = { sym, up: perp(hidden[i])[(o >> (2 * i)) & 3] }; });
        for (const M of L.ROTS) {
          const w = L.drawView(cube, M);
          if (L.SLOTS.every((s) => w[s].sym === v2[s].sym && w[s].rot === v2[s].rot)) return true;
        }
      }
    }
    return false;
  }
  let agree = 0, n = 0;
  for (const p of PX.ex.enumerate(def)) {
    const it = def.generate(PX.rng(PX.rng.hash('cm-sem', PX.ex.paramsCode(def, p))), p);
    n++;
    if (bruteSame(it.views[0], it.views[1]) === it.key && (L.solve(it.views[0], it.views[1]).length > 0) === it.key) agree++;
    if (!sameDrawing(L, L.drawView(it.cube, I3), it.views[0])) t.fail('the first drawing is not drawn from the stored cube');
  }
  t.eq(agree, n, `brute force over hidden faces and turns agrees with every key (${n} items, every combination)`);
  // fits() (the generator's check) and solve() (the validator's) agree on arbitrary drawing pairs.
  const r = PX.rng(PX.rng.hash('cm-fits'));
  let same = 0, disagree = 0;
  const syms = L.POOLS.shapes.slice(0, 6);
  for (let k = 0; k < 3000; k++) {
    const pick = r.shuffle(syms);
    const draw = (off) => Object.fromEntries(L.SLOTS.map((s, i) => [s, { sym: pick[(i + off) % 6], rot: 90 * r.int(0, 3) }]));
    const v1 = draw(0), v2 = draw(r.int(0, 3));
    const a = L.fits(v1, v2).length, b = L.solve(v1, v2).length;
    if (a !== b) disagree++;
    if (a > 0) same++;
  }
  t.eq(disagree, 0, 'fits() and solve() find the same number of turns on 3 000 random drawing pairs');
  t.ok(same > 100 && same < 2900, `random pairs include both outcomes (${same} consistent)`);
}

function sameDrawing(L, a, b) { return L.SLOTS.every((s) => a[s].sym === b[s].sym && a[s].rot === b[s].rot); }

/* ---------------------------------------------------------------- 10 000+ seeds */

// Cheap heuristics that look at the drawings without turning the cube in the mind.
function sharedSyms(L, it) { return L.SLOTS.map((s) => it.views[1][s].sym).filter((x) => L.SLOTS.some((u) => it.views[0][u].sym === x)); }
function slotOf(L, v, sym) { return L.SLOTS.find((s) => v[s].sym === sym); }
const SHORTCUTS = {
  // The brief's: "same if the visible symbols are the same set".
  'same set': (L, it) => L.SLOTS.map((s) => it.views[0][s].sym).sort().join() === L.SLOTS.map((s) => it.views[1][s].sym).sort().join(),
  'look-alike': (L, it) => sharedSyms(L, it).every((x) => it.views[0][slotOf(L, it.views[0], x)].rot === it.views[1][slotOf(L, it.views[1], x)].rot),
  'moved': (L, it) => sharedSyms(L, it).some((x) => slotOf(L, it.views[0], x) !== slotOf(L, it.views[1], x)),
  'stayed': (L, it) => sharedSyms(L, it).some((x) => slotOf(L, it.views[0], x) === slotOf(L, it.views[1], x)),
};

function testSeeds(t, PX, X, def, L) {
  t.section('seeds');
  const combos = X.enumerate(def);
  const per = Math.ceil(SEEDS_TOTAL / combos.length);
  const other = t.context({ files: [...CORE, FILE] }).PX.ex.get('cubematch');
  const c = { n: 0, threw: 0, invalid: 0, keyWrong: 0, otherRight: 0, nondet: 0, crossdet: 0, json: 0, meta: 0 };
  let firstBad = null;
  const times = [], hardTimes = [];
  const acc = {}, perLevel = {};
  const sameBy = {}, forms = [0, 1, 2].map(() => ({ n: 0, same: 0, one: 0, half: 0, turns: 0, t180: 0 }));
  for (const name of Object.keys(SHORTCUTS)) acc[name] = { right: 0, n: 0, lv: {} };
  for (const p of combos) {
    const code = X.paramsCode(def, p), lv = `rotation ${p.rotation} change ${p.change}`;
    const hardest = p.rotation === 3 && p.change === 1 && p.glyphs === 2;
    for (let s = 0; s < per; s++) {
      const seed = PX.rng.hash('cubematch', code, s);
      let it;
      const t0 = process.cpuUsage();
      try { it = def.generate(PX.rng(seed), p); } catch (e) { c.threw++; firstBad = firstBad || 'threw: ' + e.message; continue; }
      const cpu = process.cpuUsage(t0), ms = (cpu.user + cpu.system) / 1000;   // CPU time: robust when other jobs load the machine
      times.push(ms);
      if (hardest) hardTimes.push(ms);
      c.n++;
      const ok = def.validate(it);
      if (ok !== true) { c.invalid++; firstBad = firstBad || `invalid (${JSON.stringify(p)} seed ${seed}): ${ok}`; }
      if (!def.score(it, it.key).correct) c.keyWrong++;
      if (def.score(it, !it.key).correct) c.otherRight++;
      if (it.seed !== seed || JSON.stringify(it.params) !== JSON.stringify(p)) c.meta++;
      const text = JSON.stringify(it);
      if (JSON.stringify(JSON.parse(text)) !== text) c.json++;
      if (JSON.stringify(def.generate(PX.rng(seed), p)) !== text) c.nondet++;
      if (s % 20 === 0 && JSON.stringify(other.generate(PX.rng(seed), p)) !== text) c.crossdet++;
      for (const [name, fn] of Object.entries(SHORTCUTS)) {
        const right = fn(L, it) === it.key ? 1 : 0, a = acc[name];
        a.right += right; a.n++;
        a.lv[lv] = a.lv[lv] || [0, 0]; a.lv[lv][0] += right; a.lv[lv][1]++;
      }
      sameBy[p.rotation] = sameBy[p.rotation] || [0, 0];
      sameBy[p.rotation][0] += it.key ? 1 : 0; sameBy[p.rotation][1]++;
      const f = forms[s % 3];
      f.n++; f.same += it.key ? 1 : 0;
      if (p.rotation === 3) { f.one++; f.half += it.turn.cls === 'half' ? 1 : 0; }
      if (it.change && it.change.kind === 'turn') { f.turns++; f.t180 += it.change.by === 180 ? 1 : 0; }
      perLevel[code] = (perLevel[code] || 0) + 1;
    }
  }
  t.ok(c.n >= SEEDS_TOTAL, `at least ${SEEDS_TOTAL} seeds across all ${combos.length} combinations (${c.n})`);
  t.ok(Object.keys(perLevel).length === combos.length, 'every combination generated');
  t.eq(c.threw, 0, 'generate never throws' + (firstBad ? ' — ' + firstBad : ''));
  t.eq(c.invalid, 0, 'validate passes on every item' + (firstBad ? ' — ' + firstBad : ''));
  t.eq(c.keyWrong, 0, 'the key scores right');
  t.eq(c.otherRight, 0, 'the other answer scores wrong');
  t.eq(c.meta, 0, 'items carry their seed and params');
  t.eq(c.json, 0, 'items are JSON round-trip safe');
  t.eq(c.nondet, 0, 'same seed and params give the same item');
  t.eq(c.crossdet, 0, 'the same item in a separately loaded context');
  const p95 = quant(times, 0.95), hardP95 = quant(hardTimes, 0.95);
  t.ok(p95 < 20 && hardP95 < 20, `generation p95 under 20 ms of CPU time (all ${p95.toFixed(2)} ms, hardest level ${hardP95.toFixed(2)} ms)`);
  t.eq(L.stats.fallbacks, 0, 'no item needed the fallback');
  for (const p of combos) { const fb = L.fallback(p); if (fb.fallback !== true || def.validate(Object.assign(fb, { params: p })) !== true) t.fail('fallback invalid or not marked for ' + JSON.stringify(p)); }

  // Answers balanced overall and at every rotation level; alternate forms (seed streams) alike.
  for (const [rot, [same, n]] of Object.entries(sameBy)) t.ok(Math.abs(same / n - 0.5) < 0.05, `rotation level ${rot}: ${pct(same / n)} same`);
  const spread = (key, den) => { const v = forms.map((f) => f[key] / f[den]); return Math.max(...v) - Math.min(...v); };
  t.ok(spread('same', 'n') < 0.04, 'forms: the same share of "same" answers');
  t.ok(spread('half', 'one') < 0.06, 'forms: the same mix of half and corner turns at one shared face');
  t.ok(spread('t180', 'turns') < 0.06, 'forms: the same mix of turn sizes');

  // Shortcuts: pooled ≤ chance + 10; the brief's set rule also at every level.
  const lines = [];
  for (const [name, a] of Object.entries(acc)) {
    const pooled = a.right / a.n, levels = Object.values(a.lv).map(([r, n]) => r / n);
    t.ok(pooled <= 0.6, `shortcut "${name}" pooled ${pct(pooled)} ≤ 60 %`);
    if (name === 'same set') t.ok(levels.every((x) => x <= 0.6), `shortcut "same set" ≤ 60 % at every level (max ${pct(Math.max(...levels))})`);
    lines.push(`${name} ${pct(pooled)} (levels ${pct(Math.min(...levels))}–${pct(Math.max(...levels))})`);
  }
  console.log(`       PR-1 cubematch: ${c.n} items, p95 ${p95.toFixed(2)} ms; shortcuts: ${lines.join('; ')}`);
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

// The one-screen instruction, the worked examples (fixed seeds of the stated kind, easiest level)
// and every caption the view uses; probe wording (no practice, no praise, no IQ claims).
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
