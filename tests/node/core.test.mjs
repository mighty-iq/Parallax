/* Core foundation tests: rng, util, registry, store. Run through tests/node/run.mjs. */
import { SharedStorage, T0, deepDiff } from './run.mjs';

export async function run(t0) {
  // Core tests run on the manifest alone, so exercises added later (real ids and codes)
  // never collide with the sample definitions made here.
  const t = Object.assign({}, t0, {
    PX: t0.context({ exercises: false }).PX,
    context: (o) => t0.context({ exercises: false, ...o }),
    env: (o) => t0.env({ exercises: false, ...o }),
  });
  testRng(t);
  testUtil(t);
  testRegistry(t);
  testParamsCodes(t);
  testStore(t);
}

/* ======================================================================== rng */

function seq(r, n, fn = 'next') {
  const out = [];
  for (let i = 0; i < n; i++) out.push(r[fn]());
  return out;
}

function chiSquare(counts, expected) {
  return counts.reduce((s, c) => s + (c - expected) ** 2 / expected, 0);
}

function corr(a, b) {
  const n = a.length;
  const ma = a.reduce((s, x) => s + x, 0) / n, mb = b.reduce((s, x) => s + x, 0) / n;
  let sab = 0, saa = 0, sbb = 0;
  for (let i = 0; i < n; i++) {
    sab += (a[i] - ma) * (b[i] - mb);
    saa += (a[i] - ma) ** 2;
    sbb += (b[i] - mb) ** 2;
  }
  return sab / Math.sqrt(saa * sbb);
}

function testRng(t) {
  t.section('rng');
  const PX = t.PX;

  // Same seed → same 1 000 numbers, also in a separately loaded context.
  const a = seq(PX.rng(12345), 1000);
  t.eq(seq(PX.rng(12345), 1000), a, 'same seed gives the same 1 000 numbers');
  t.eq(seq(t.context().PX.rng(12345), 1000), a, 'same seed gives the same numbers in another context');
  t.ok(a.every((x) => x >= 0 && x < 1), 'next() is in [0, 1)');
  t.ok(deepDiff(seq(PX.rng(12346), 1000), a) !== null, 'a different seed gives a different sequence');
  t.eq(seq(PX.rng('rotate:7'), 20), seq(PX.rng(PX.rng.hash('rotate:7')), 20), 'string seeds go through PX.rng.hash');
  t.eq(PX.rng(-1).seed, 4294967295, 'seeds are taken as uint32');
  t.eq(PX.rng().seed, 0, 'a missing seed is 0');

  // Golden values: they pin the algorithm. If one changes, every stored seed regenerates a
  // different item; change them only together with a data migration.
  t.eq(seq(PX.rng(1), 5, 'u32'), [3679330270, 1500505511, 3706934793, 1583400591, 496929505], 'golden: rng(1).u32()');
  t.eq(seq(PX.rng(0), 3, 'u32'), [683238376, 2071310098, 4060405231], 'golden: rng(0).u32()');
  t.eq(PX.rng.hash('parallax'), 2805605617, 'golden: hash("parallax")');
  t.eq(PX.rng.hash('rotate', 3, 'retry1'), 3125236486, 'golden: hash("rotate", 3, "retry1")');
  t.eq(PX.rng.hash(), 451841411, 'golden: hash()');
  const g = PX.rng(2026);
  t.eq([g.int(1, 6), g.int(1, 6), g.int(0, 1e6)], [3, 1, 393980], 'golden: rng(2026).int()');
  t.eq(g.normal(), -0.5688654853815687, 'golden: normal()');
  t.eq(PX.rng(1).fork('a').u32(), 2040302629, 'golden: fork("a")');

  // hash
  t.ok(PX.rng.hash('ab', 'c') !== PX.rng.hash('a', 'bc'), 'hash separates its parts');
  t.eq(PX.rng.hash('a', 1), PX.rng.hash('a', '1'), 'hash compares parts by their text');
  t.eq(PX.rng.hash({ x: 1, y: [2, 3] }), PX.rng.hash({ y: [2, 3], x: 1 }), 'hash of objects ignores key order');
  let hashOk = true;
  for (let i = 0; i < 1000; i++) {
    const h = PX.rng.hash('seed', i);
    if (!(Number.isInteger(h) && h >= 0 && h <= 4294967295)) hashOk = false;
  }
  t.ok(hashOk, 'hash gives uint32 integers');

  // Forks: deterministic, labelled, independent of the parent's draws, never advancing it.
  const p = PX.rng(42);
  const fx = seq(p.fork('x'), 200);
  t.eq(seq(p.fork('x'), 200), fx, 'fork(label) is deterministic');
  t.ok(deepDiff(seq(p.fork('y'), 200), fx) !== null, 'different labels give different streams');
  t.eq(seq(p, 200), seq(PX.rng(42), 200), 'fork() does not advance the parent');
  const q = PX.rng(42);
  seq(q, 37);
  t.eq(seq(q.fork('x'), 200), fx, 'a fork does not depend on how many numbers the parent drew');
  t.ok(deepDiff(fx, seq(PX.rng(42), 200)) !== null, 'a fork differs from its parent');
  t.ok(deepDiff(seq(PX.rng(43).fork('x'), 200), fx) !== null, 'the same label under another seed differs');
  t.eq(seq(PX.rng(42).fork('x').fork('retry1'), 50), seq(PX.rng(42).fork('x').fork('retry1'), 50), 'nested forks are deterministic');
  const c1 = seq(PX.rng(7).fork('a'), 20000), c2 = seq(PX.rng(7).fork('b'), 20000);
  t.ok(Math.abs(corr(c1, c2)) < 0.03, 'sibling forks are uncorrelated');

  // Rough uniformity (fixed seeds, so these checks are deterministic).
  const u = PX.rng(99);
  const bins = new Array(20).fill(0);
  let sum = 0;
  const N = 200000;
  const xs = new Array(N);
  for (let i = 0; i < N; i++) {
    const x = u.next();
    xs[i] = x;
    sum += x;
    bins[Math.floor(x * 20)]++;
  }
  t.near(sum / N, 0.5, 0.005, 'next() has mean 0.5');
  t.ok(chiSquare(bins, N / 20) < 43.8, 'next() is uniform over 20 bins (chi-square, p > 0.001)');
  t.ok(Math.abs(corr(xs.slice(0, N - 1), xs.slice(1))) < 0.01, 'consecutive numbers are uncorrelated');

  const dice = new Array(6).fill(0);
  const d = PX.rng(5);
  let inRange = true;
  for (let i = 0; i < 60000; i++) {
    const k = d.int(1, 6);
    if (!(Number.isInteger(k) && k >= 1 && k <= 6)) inRange = false;
    else dice[k - 1]++;
  }
  t.ok(inRange, 'int(1, 6) stays within its inclusive bounds');
  t.ok(chiSquare(dice, 10000) < 20.5, 'int(1, 6) is uniform (chi-square, p > 0.001)');

  const firsts = new Array(10).fill(0);
  for (let s = 0; s < 1000; s++) firsts[Math.floor(PX.rng(s).next() * 10)]++;
  t.ok(chiSquare(firsts, 100) < 27.9, 'first outputs of consecutive seeds are uniform');

  const r = PX.rng(3);
  const seen = new Set();
  for (let i = 0; i < 300; i++) seen.add(r.int(0, 2));
  t.eq([...seen].sort(), [0, 1, 2], 'int(0, 2) reaches both bounds');
  t.eq(r.int(5, 5), 5, 'int(a, a) is a');
  const rev = r.int(9, 7);
  t.ok(rev >= 7 && rev <= 9, 'int(hi, lo) swaps its bounds');
  const big = r.int(0, 2 ** 40);
  t.ok(Number.isInteger(big) && big >= 0 && big <= 2 ** 40, 'int() over more than 32 bits');
  let fOk = true;
  for (let i = 0; i < 1000; i++) {
    const f = r.float(-2, 3);
    if (!(f >= -2 && f < 3)) fOk = false;
  }
  t.ok(fOk, 'float(a, b) is in [a, b)');

  const arr = [1, 2, 3, 4, 5, 6, 7, 8];
  const sh = PX.rng(11).shuffle(arr);
  t.eq(arr, [1, 2, 3, 4, 5, 6, 7, 8], 'shuffle() leaves its input alone');
  t.eq([...sh].sort((x, y) => x - y), arr, 'shuffle() returns a permutation');
  t.eq(PX.rng(11).shuffle(arr), sh, 'shuffle() is deterministic');
  t.ok(arr.includes(PX.rng(12).pick(arr)), 'pick() returns an element');
  t.eq(PX.rng(12).pick([]), undefined, 'pick([]) is undefined');

  const ch = PX.rng(13);
  let never = 0, always = 0, some = 0;
  for (let i = 0; i < 20000; i++) {
    if (ch.chance(0)) never++;
    if (ch.chance(1)) always++;
    if (ch.chance(0.3)) some++;
  }
  t.eq([never, always], [0, 20000], 'chance(0) never, chance(1) always');
  t.near(some / 20000, 0.3, 0.015, 'chance(0.3) about 30 %');

  const nr = PX.rng(17);
  const zs = seq(nr, 50000, 'normal');
  const zm = zs.reduce((s2, z) => s2 + z, 0) / zs.length;
  const zsd = Math.sqrt(zs.reduce((s2, z) => s2 + (z - zm) ** 2, 0) / (zs.length - 1));
  t.near(zm, 0, 0.02, 'normal() has mean 0');
  t.near(zsd, 1, 0.02, 'normal() has sd 1');
  t.near(zs.filter((z) => Math.abs(z) < 1).length / zs.length, 0.6827, 0.01, 'normal(): 68 % within one sd');
  const scaled = PX.rng(17).normal(10, 2);
  t.near(scaled, 10 + 2 * zs[0], 1e-12, 'normal(mean, sd) scales the standard normal');

  let lnOk = true;
  for (let i = 1; i <= 20000; i++) {
    const x = (i / 20000) * 2 ** ((i % 60) - 30);
    const want = Math.log(x);
    if (Math.abs(PX.rng.ln(x) - want) > 1e-14 * Math.max(1, Math.abs(want))) lnOk = false;
  }
  t.ok(lnOk, 'the portable ln() matches Math.log to 1e-14');
}

/* ======================================================================= util */

function testUtil(t) {
  t.section('util');
  const U = t.PX.util;
  t.eq(U.clamp(5, 0, 3), 3, 'clamp');
  t.eq(U.lerp(2, 4, 0.25), 2.5, 'lerp');
  t.eq(U.round(1.005, 2), 1.01, 'round(1.005, 2)');
  t.eq(U.round(-1.5), -2, 'round() is half away from zero');
  t.eq(U.mean([1, 2, 3, 4]), 2.5, 'mean');
  t.ok(Number.isNaN(U.mean([])), 'mean([]) is NaN');
  t.eq(U.sd([2, 4, 4, 4, 5, 5, 7, 9], true), 2, 'population sd');
  t.near(U.sd([2, 4, 4, 4, 5, 5, 7, 9]), 2.138089935, 1e-8, 'sample sd');
  t.eq(U.median([3, 1, 2]), 2, 'median (odd)');
  t.eq(U.median([4, 1, 2, 3]), 2.5, 'median (even)');
  t.eq(U.quantile([1, 2, 3, 4], 0.25), 1.75, 'quantile (type 7)');
  t.eq(U.sigmoid(0), 0.5, 'sigmoid(0)');
  t.ok(U.sigmoid(-1000) === 0 && U.sigmoid(1000) === 1, 'sigmoid saturates without NaN');
  t.near(U.logit(U.sigmoid(1.3)), 1.3, 1e-12, 'logit inverts sigmoid');
  t.ok(Number.isFinite(U.logit(0)) && Number.isFinite(U.logit(1)), 'logit(0) and logit(1) are finite');
  t.near(U.deg(U.rad(123)), 123, 1e-12, 'deg/rad');
  t.eq(U.fmtTime(65000), '1:05', 'fmtTime m:ss');
  t.eq(U.fmtTime(3725000), '1:02:05', 'fmtTime h:mm:ss');
  t.eq(U.fmtDate(new Date(2026, 9, 3, 15, 4)), '2026-10-03', 'fmtDate iso');
  t.eq(U.fmtDate('2026-10-03', 'long'), '3 Oct 2026', 'fmtDate long from a day key');
  t.eq(U.addDays('2026-12-31', 1), '2027-01-01', 'addDays across a year');
  t.eq(U.addDays('2026-10-25', 1), '2026-10-26', 'addDays across a DST change');
  t.eq(U.dayNum('2026-10-30') - U.dayNum('2026-10-01'), 29, 'dayNum differences');
  const src = { a: [1, { b: 2 }], d: new Date(5) };
  const cp = U.deepCopy(src);
  cp.a[1].b = 3;
  t.ok(src.a[1].b === 2 && cp.d.getTime() === 5, 'deepCopy copies deeply');
  const ids = new Set();
  for (let i = 0; i < 1000; i++) ids.add(U.uid());
  t.eq(ids.size, 1000, 'uid() is unique');
}

/* =================================================================== registry */

function sampleDef(over = {}) {
  return Object.assign({
    id: 'sample', code: 'EX-90', name: 'Sample', abilities: ['Vz'], cell: 'intrinsic-static', role: 'train',
    answer: 'choice', nOptions: 4,
    dims: [
      { key: 'size', label: 'Size', levels: [2, 3, 4, 5, 6, 7], step: 0.3 },
      { key: 'axis', label: 'Axis', levels: ['x', 'y', 'z'], step: 0.5 },
      { key: 'noise', label: 'Noise', levels: [0, 0.1, 0.2, 0.4], step: -0.1 },
    ],
    base: -1.5,
    variants: ['pick1', 'samediff'],
    generate(rng, params) { return { ex: this.id, seed: rng.seed, params, key: rng.int(0, 3) }; },
    validate() { return true; },
    score(item, response) { return { correct: response === item.key }; },
  }, over);
}

function withDim(i, patch) {
  const dims = sampleDef().dims.map((d) => ({ ...d }));
  if (patch === null) delete dims[i].key;
  else Object.assign(dims[i], patch);
  return { dims };
}

function testRegistry(t) {
  t.section('registry');
  const X = t.PX.ex;

  const bad = [
    ['not an object', null, /must be an object/],
    ['id missing', { id: undefined }, /id must be/],
    ['id with capitals', { id: 'Rotate' }, /id must be/],
    ['id starting with a digit', { id: '9lives' }, /id must be/],
    ['code missing', { code: undefined }, /code must look like/],
    ['code malformed', { code: 'EX2' }, /code must look like/],
    ['name empty', { name: ' ' }, /name is missing/],
    ['short empty', { short: '' }, /short must be/],
    ['abilities empty', { abilities: [] }, /abilities must be/],
    ['ability unknown', { abilities: ['Vz', 'XX'] }, /unknown ability code "XX"/],
    ['cell unknown', { cell: 'inside' }, /cell must be/],
    ['role unknown', { role: 'practice' }, /role must be/],
    ['answer unknown', { answer: 'click' }, /answer must be/],
    ['nOptions missing', { nOptions: undefined }, /nOptions/],
    ['nOptions above 9', { nOptions: 12 }, /nOptions/],
    ['dims not an array', { dims: {} }, /dims must be an array/],
    ['dim key missing', withDim(0, null), /dims\[0\]\.key must be/],
    ['dim key repeated', withDim(1, { key: 'size' }), /used twice/],
    ['dim key "variant"', withDim(1, { key: 'variant' }), /reserved/],
    ['levels empty', withDim(2, { levels: [] }), /dim "noise" needs a non-empty levels array/],
    ['levels missing', withDim(2, { levels: undefined }), /non-empty levels/],
    ['step a string', withDim(0, { step: '0.25' }), /dim "size" needs a numeric step/],
    ['step NaN', withDim(0, { step: NaN }), /numeric step/],
    ['step missing', withDim(1, { step: undefined }), /numeric step/],
    ['base missing', { base: undefined }, /base must be a number/],
    ['base NaN', { base: NaN }, /base must be a number/],
    ['generate missing', { generate: undefined }, /generate\(…\) is missing/],
    ['validate missing', { validate: 'yes' }, /validate\(…\) is missing/],
    ['score missing', { score: undefined }, /score\(…\) is missing/],
    ['difficulty not a function', { difficulty: 5 }, /difficulty must be a function/],
    ['variants empty', { variants: [] }, /variants must be/],
    ['variant repeated', { variants: ['a', 'a'] }, /listed twice/],
    ['variant name with a space', { variants: ['has space'] }, /variant names/],
    ['chance missing for angle answers', { answer: 'angle', nOptions: undefined }, /chance\(params\) is missing/],
    ['nCorrect missing for multi answers', { answer: 'multi' }, /needs nCorrect/],
    ['chance out of range', { chance: 1.5 }, /chance must be in/],
    ['timeLimit not a function', { timeLimit: 5000 }, /timeLimit must be/],
  ];
  for (const [what, over, pattern] of bad) {
    const def = over === null ? null : sampleDef(over);
    t.throws(() => X.define(def), pattern, `define() rejects: ${what}`);
  }
  t.throws(() => X.define(sampleDef({ base: 'x' })), /^PX\.ex\.define\("sample"\): /, 'errors name the exercise');
  t.eq(X.list().length, 0, 'rejected definitions are not registered');

  const def = X.define(sampleDef());
  t.ok(X.get('sample') === def && X.has('sample'), 'define() registers; get() returns it');
  t.eq(X.get('missing'), null, 'get() of an unknown id is null');
  t.ok(Object.isFrozen(def) && Object.isFrozen(def.dims) && Object.isFrozen(def.dims[0].levels), 'definitions are frozen');
  t.eq(def.short, 'Sample', 'short defaults to name');
  t.eq(def.chance({}), 0.25, 'choice chance defaults to 1/nOptions');
  t.eq(def.timeLimit({}), null, 'timeLimit defaults to untimed');
  t.throws(() => X.define(sampleDef()), /already defined/, 'a repeated id is rejected');
  t.throws(() => X.define(sampleDef({ id: 'other' })), /code EX-90 is already used by "sample"/, 'a repeated code is rejected');

  // Default difficulty = base + Σ step × level index.
  t.near(def.difficulty({ size: 2, axis: 1, noise: 3, variant: 'samediff' }), -1.5 + 0.6 + 0.5 - 0.3, 1e-12, 'default difficulty');
  t.near(X.difficulty('sample', { size: 0, axis: 0, noise: 0 }), -1.5, 1e-12, 'difficulty at level 0 is base');
  t.near(X.minDifficulty(def), -1.8, 1e-12, 'minDifficulty (negative step at its last level)');
  t.near(X.maxDifficulty('sample'), 1.0, 1e-12, 'maxDifficulty');
  const custom = X.define(sampleDef({
    id: 'custom', code: 'EX-91', role: 'probe', answer: 'yesno', nOptions: undefined, variants: undefined,
    difficulty(p) { return p.size * 2 - p.axis; },
    chance: 0.5,
  }));
  t.ok(custom.customDifficulty && !def.customDifficulty, 'customDifficulty flag');
  t.eq([X.minDifficulty(custom), X.maxDifficulty(custom)], [-2, 10], 'min/max of a custom difficulty over all combinations');
  t.eq(custom.chance({}), 0.5, 'a numeric chance becomes a function');
  t.eq(custom.variants, null, 'variants default to null');

  X.define(sampleDef({ id: 'early', code: 'EX-9' }));
  X.define(sampleDef({ id: 'later', code: 'EX-10', role: 'probe' }));
  t.eq(X.list().map((d) => d.code), ['EX-9', 'EX-10', 'EX-90', 'EX-91'], 'list() is sorted by code number');
  t.eq(X.list('probe').map((d) => d.id), ['later', 'custom'], 'list("probe")');
  t.eq(X.list('train').map((d) => d.id), ['early', 'sample'], 'list("train")');

  // Views and learn data.
  const viewDef = { layout: 'stem+options', present() {}, drawOption() {}, reveal() {} };
  t.throws(() => X.view('nope', viewDef), /define the exercise/, 'view() before define() is rejected');
  t.throws(() => X.view('sample', { layout: 'stem+options', present() {}, reveal() {} }), /drawOption/, 'view() needs drawOption for stem+options');
  t.throws(() => X.view('sample', { layout: 'stem+options', present() {}, drawOption() {}, demo: 1 }), /demo must be a function/, 'view() checks optional functions');
  t.throws(() => X.view('sample', { layout: 'custom', present() {}, reveal() {} }), /collect/, 'view() needs collect for custom');
  t.throws(() => X.view('sample', { layout: 'grid', present() {}, reveal() {} }), /layout must be/, 'view() checks the layout');
  t.ok(X.view('sample', viewDef) === viewDef && X.view('sample') === viewDef, 'view() registers and returns the view');
  t.throws(() => X.view('sample', viewDef), /already registered/, 'a second view is rejected');
  t.eq(X.view('custom'), null, 'view() of an exercise without a view is null');
  const learnData = { steps: [] };
  t.ok(X.learn('sample', learnData) === learnData && X.learn('sample') === learnData, 'learn() registers data');
}

function testParamsCodes(t) {
  t.section('params codes');
  const X = t.context().PX.ex;
  const def = X.define(sampleDef());

  const all = X.enumerate(def);
  t.eq(X.count(def), 144, 'count = 6 × 3 × 4 levels × 2 variants');
  t.eq(all.length, 144, 'enumerate() lists every combination below the limit');
  let roundTrip = true, inOrder = true, valid = true;
  const keys = new Set();
  all.forEach((p, i) => {
    const code = X.paramsCode(def, p);
    if (code !== i) inOrder = false;
    if (deepDiff(X.decodeParams(def, code), p) !== null) roundTrip = false;
    if (X.validParams(def, p) !== true) valid = false;
    keys.add(X.paramsKey(p));
  });
  t.ok(roundTrip, 'decodeParams(paramsCode(p)) === p for every combination');
  t.ok(inOrder, 'enumerate() is in code order, codes 0 … n − 1');
  t.ok(valid, 'every enumerated combination is valid');
  t.eq(keys.size, 144, 'paramsKey() is distinct for every combination');
  let codesBack = true;
  for (let c = 0; c < 144; c++) if (X.paramsCode(def, X.decodeParams(def, c)) !== c) codesBack = false;
  t.ok(codesBack, 'paramsCode(decodeParams(c)) === c');

  t.eq(X.paramsKey({ size: 1, axis: 2, variant: 'pick1' }), X.paramsKey({ variant: 'pick1', axis: 2, size: 1 }), 'paramsKey ignores key order');
  t.eq(X.paramsKey({ size: 1, axis: 2, variant: 'pick1' }), 'axis=2,size=1,variant=pick1', 'paramsKey format');
  t.eq(X.paramsCode(def, { size: 1, axis: 2, noise: 0 }), X.paramsCode(def, { size: 1, axis: 2, noise: 0, variant: 'pick1' }), 'a missing variant counts as the first');
  t.throws(() => X.paramsCode(def, { size: 6, axis: 0, noise: 0 }), /size must be a level index from 0 to 5/, 'paramsCode rejects a level out of range');
  t.throws(() => X.paramsCode(def, { size: 0, axis: 0, noise: 0, variant: 'nope' }), /unknown variant/, 'paramsCode rejects an unknown variant');
  t.throws(() => X.paramsCode(def, { size: 0, axis: 0, noise: 0, extra: 1 }), /unknown param "extra"/, 'paramsCode rejects unknown params');
  t.throws(() => X.decodeParams(def, 144), /code must be an integer from 0 to 143/, 'decodeParams rejects a code out of range');
  t.throws(() => X.decodeParams(def, 1.5), /code must be an integer/, 'decodeParams rejects a fraction');

  // No dims and no variants: one combination.
  const tiny = X.define(sampleDef({ id: 'tiny', code: 'EX-92', dims: [], variants: undefined }));
  t.eq(X.enumerate(tiny), [{}], 'a definition without dims has one combination');
  t.eq([X.paramsCode(tiny, {}), X.decodeParams(tiny, 0)], [0, {}], 'its code is 0');
  t.eq([X.minDifficulty(tiny), X.maxDifficulty(tiny)], [-1.5, -1.5], 'its difficulty is base');

  // Above 5 000 combinations: a deterministic sample of 400 that holds the corners.
  const level10 = Array.from({ length: 10 }, (_, i) => i);
  const huge = X.define(sampleDef({
    id: 'huge', code: 'EX-93', variants: ['a', 'b'],
    dims: ['p', 'q', 'r'].map((key) => ({ key, levels: level10, step: 0.1 })).concat([{ key: 's', levels: [0, 1, 2, 3, 4, 5], step: 0.2 }]),
  }));
  t.eq(X.count(huge), 12000, 'large definition: 12 000 combinations');
  const sample = X.enumerate(huge);
  t.eq(sample.length, 400, 'enumerate() samples 400 above 5 000');
  t.eq(X.enumerate(huge), sample, 'the sample is deterministic');
  t.eq(new Set(sample.map((p) => X.paramsKey(p))).size, 400, 'the sample has no duplicates');
  t.ok(sample.every((p) => X.validParams(huge, p) === true), 'every sampled combination is valid');
  const corner = (lvl, variant) => ({ p: lvl ? 9 : 0, q: lvl ? 9 : 0, r: lvl ? 9 : 0, s: lvl ? 5 : 0, variant });
  t.ok([corner(0, 'a'), corner(1, 'a'), corner(0, 'b'), corner(1, 'b')].every((c) => sample.some((p) => deepDiff(p, c) === null)), 'the sample holds the easiest and hardest corners');
  t.eq(t.context().PX.ex.enumerate(huge).length, 400, 'enumerate() accepts definitions from another context');
  t.near(X.maxDifficulty(huge), -1.5 + 3 * 0.9 + 1.0, 1e-12, 'maxDifficulty of the large definition');
}

/* ====================================================================== store */

const KEY = 'parallax.v1';
const isObj = (x) => x !== null && typeof x === 'object' && !Array.isArray(x);
const isNum = (x) => typeof x === 'number' && Number.isFinite(x);
const isInt = (x) => Number.isInteger(x);

// The shape of §8, checked independently of store.js. Returns a list of problems.
function shapeProblems(rec, defaults) {
  const bad = [];
  const need = (cond, what) => { if (!cond) bad.push(what); };
  need(isObj(rec), 'record is an object');
  if (!isObj(rec)) return bad;
  need(deepDiff(Object.keys(rec).sort(), Object.keys(defaults).sort()) === null, 'exactly the known top-level keys');
  need(rec.v === 2, 'v === 2');
  need(isInt(rec.rev) && rec.rev >= 0, 'rev');
  need(isNum(rec.created) && isNum(rec.updated), 'created, updated');
  const s = rec.settings;
  need(isObj(s) && deepDiff(Object.keys(s).sort(), Object.keys(defaults.settings).sort()) === null, 'settings keys');
  if (isObj(s)) {
    need(isInt(s.sessionMin) && s.sessionMin >= 1 && s.sessionMin <= 120, 'settings.sessionMin');
    need(['auto', 'light', 'dark'].includes(s.theme), 'settings.theme');
    need(['auto', 'on', 'off'].includes(s.reducedMotion), 'settings.reducedMotion');
    need(typeof s.sound === 'boolean' && typeof s.keyHints === 'boolean', 'settings booleans');
    need(isNum(s.textScale) && s.textScale >= 0.75 && s.textScale <= 2, 'settings.textScale');
  }
  need(isObj(rec.ex), 'ex');
  if (isObj(rec.ex)) {
    for (const [id, e] of Object.entries(rec.ex)) {
      need(/^[a-z][a-z0-9-]*$/.test(id), `ex id ${id}`);
      need(isObj(e) && isNum(e.mu) && isNum(e.sd) && e.sd > 0 && isInt(e.n) && isInt(e.nRight) && e.nRight <= e.n, `ex.${id} numbers`);
      need(isObj(e) && (e.last === null || isNum(e.last)), `ex.${id}.last`);
      need(isObj(e) && isObj(e.seen) && Object.values(e.seen).every(isInt), `ex.${id}.seen`);
      need(isObj(e) && isObj(e.best), `ex.${id}.best`);
      need(isObj(e) && Array.isArray(e.hist) && e.hist.every((h) => Array.isArray(h) && h.length === 3 && isNum(h[1]) && isNum(h[2])), `ex.${id}.hist`);
    }
  }
  need(isObj(rec.mot) && Array.isArray(rec.mot.core) && Object.values(rec.mot).every((l) => Array.isArray(l) && l.every((x) => isObj(x) && typeof x.date === 'string' && isNum(x.threshold))), 'mot');
  need(Array.isArray(rec.sessions) && rec.sessions.every((x) => isObj(x) && typeof x.id === 'string' && isNum(x.start)
    && isInt(x.trials) && isInt(x.right) && x.right <= x.trials && isNum(x.practiceMs) && Array.isArray(x.exs) && typeof x.mode === 'string'), 'sessions');
  need(Array.isArray(rec.trials) && rec.trials.every((r) => Array.isArray(r) && r.length === 8 && isNum(r[0])
    && isInt(r[1]) && isInt(r[2]) && isInt(r[3]) && isInt(r[4]) && [0, 1, 2, 3].includes(r[5])
    && (r[6] === null || isNum(r[6])) && (r[7] === null || isNum(r[7]))), 'trials rows');
  need(Array.isArray(rec.trials) && rec.trials.length <= 20000, 'trials cap');
  need(isNum(rec.practiceMs) && rec.practiceMs >= 0, 'practiceMs');
  need(isObj(rec.achievements) && Object.values(rec.achievements).every((v) => typeof v === 'string'), 'achievements');
  need(isObj(rec.streak), 'streak');
  need(isObj(rec.daily) && Object.keys(rec.daily).every((k) => /^\d{4}-\d{2}-\d{2}$/.test(k)), 'daily');
  need(Array.isArray(rec.assess) && rec.assess.every((a) => isObj(a) && typeof a.date === 'string' && isObj(a.results)), 'assess');
  need(isObj(rec.tour) && typeof rec.tour.done === 'boolean' && isObj(rec.tour.seen), 'tour');
  need(isObj(rec.ui) && (rec.ui.lastRoute === null || typeof rec.ui.lastRoute === 'string'), 'ui');
  need(isObj(rec.idx) && Array.isArray(rec.idx.ex) && Array.isArray(rec.idx.mode), 'idx');
  need(isObj(rec.trialDays) && Object.values(rec.trialDays).every((d) => isObj(d) && isInt(d.n) && isObj(d.ex)), 'trialDays');
  try { JSON.stringify(rec); } catch { bad.push('JSON-serialisable'); }
  return bad;
}

// A plausible full record, written as a user's file would look.
function goodRecord() {
  return {
    v: 1, rev: 7, created: T0 - 86400000 * 3, updated: T0 - 1000,
    settings: { sessionMin: 20, weeklyGoal: 4, lastBackup: 0, theme: 'dark', reducedMotion: 'on', sound: true, keyHints: false, textScale: 1.25 },
    ex: {
      rotate: { mu: 0.4, sd: 0.8, n: 40, nRight: 31, last: T0 - 5000, seen: { 'angle=1,axis=0': 3 }, best: { streak: 9 }, hist: [['2026-10-29', 0.2, 0.9]], extra: 'engine' },
    },
    mot: { core: [{ date: '2026-10-29', threshold: 1.7 }] },
    sessions: [{ id: 's1', start: T0 - 7200000, end: T0 - 6000000, mode: 'daily', trials: 30, right: 22, practiceMs: 140, exs: ['rotate'], summary: { note: 'ok' } }],
    trials: [[1793350000, 0, 0, 5, 12345, 1, 1534, null], [1793350010, 0, 0, 6, 999, 0, 2210, 0.5]],
    practiceMs: 140, achievements: { first: '2026-10-29' }, streak: { days: 2 }, daily: { '2026-10-29': { score: 3 } },
    assess: [{ date: '2026-10-28', form: 'A', results: { paper: { right: 5, n: 8, theta: 0.3, se: 0.6 } } }],
    tour: { done: true, seen: { rotate: true } }, ui: { lastRoute: 'home' },
    idx: { ex: ['rotate'], mode: ['daily'] }, trialDays: {},
  };
}

// Broken records for the fuzz: random junk at random depths of a valid record.
function junk(r, depth = 0) {
  const kinds = ['null', 'undef', 'nan', 'inf', 'neg', 'str', 'num', 'bool', 'arr', 'obj', 'deep', 'proto', 'big', 'date'];
  switch (r.pick(kinds)) {
    case 'null': return null;
    case 'undef': return undefined;
    case 'nan': return NaN;
    case 'inf': return r.chance(0.5) ? Infinity : -Infinity;
    case 'neg': return -r.int(1, 1e9);
    case 'str': return r.pick(['', 'x', '2026-13-45', '<script>', '{"v":1}', 'auto', 'dark', 'rotate', '1e400']);
    case 'num': return r.float(-1e6, 1e6);
    case 'bool': return r.chance(0.5);
    case 'arr': return depth > 2 ? [] : Array.from({ length: r.int(0, 4) }, () => junk(r, depth + 1));
    case 'obj': return depth > 2 ? {} : { a: junk(r, depth + 1), mu: junk(r, depth + 1), n: junk(r, depth + 1) };
    case 'deep': { let o = {}; const root = o; for (let i = 0; i < 40; i++) { o.x = {}; o = o.x; } return root; }
    case 'proto': return JSON.parse('{"__proto__": {"polluted": true}, "mu": 1}');
    case 'big': return 1e300;
    case 'date': return new Date(NaN);
  }
  return null;
}

function mutate(rec, r) {
  const paths = [];
  (function walk(x, p) {
    if (x === null || typeof x !== 'object' || p.length > 5) return;
    for (const k of Object.keys(x)) { paths.push([...p, k]); walk(x[k], [...p, k]); }
  })(rec, []);
  const n = r.int(1, 8);
  for (let i = 0; i < n && paths.length; i++) {
    const p = r.pick(paths);
    let o = rec;
    for (let j = 0; j < p.length - 1 && o && typeof o === 'object'; j++) o = o[p[j]];
    if (!o || typeof o !== 'object') continue;
    if (r.chance(0.15)) delete o[p[p.length - 1]];
    else o[p[p.length - 1]] = junk(r);
  }
  if (r.chance(0.2)) rec[r.pick(['unknownTop', 'hack', 'settings2'])] = junk(r);
  if (r.chance(0.1)) { const cyc = {}; cyc.self = cyc; rec.streak = cyc; }
  return rec;
}

function testStore(t) {
  t.section('store: basics');
  {
    const env = t.env();
    const S = env.PX.core.store;
    const d = S.defaults();
    t.eq(shapeProblems(d, d), [], 'defaults() has the §8 shape');
    t.ok(S.defaults() !== d && S.defaults().settings !== d.settings, 'defaults() returns a fresh copy');
    t.eq(S.state.rev, 0, 'a fresh store starts at rev 0');
    t.eq(S.volatile, false, 'storage is available');
    t.eq(env.storage.get(KEY), null, 'nothing is written before the first save');
    t.ok(S.state === S.state, 'state is the same object on every read');

    S.state.practiceMs = 12;
    S.save();
    env.clock.tick(500);
    t.eq(env.storage.get(KEY), null, 'save() is debounced');
    env.clock.tick(600);
    const saved = JSON.parse(env.storage.get(KEY));
    t.eq([saved.practiceMs, saved.rev], [12, 1], 'the debounced save writes and increments rev');
    t.ok(env.storage.get(KEY).startsWith('{"v":2,"rev":1,'), 'the saved JSON starts with v and rev');
    t.ok(env.events.some((e) => e.evt === 'store:saved'), 'store:saved is emitted');

    // Repeated requests keep pushing the debounce out, but never past 5 s.
    for (let i = 0; i < 12; i++) { S.state.practiceMs++; S.save(); env.clock.tick(500); }
    t.ok(JSON.parse(env.storage.get(KEY)).rev >= 2, 'a stream of save requests still writes within 5 s');

    // hold() / release()
    const before = env.storage.writes;
    S.hold();
    S.state.practiceMs = 99;
    S.save();
    env.clock.tick(10000);
    t.eq(env.storage.writes, before, 'nothing is written while held');
    S.hold();
    S.release();
    t.eq(env.storage.writes, before, 'nested holds: the outer hold still blocks');
    S.release();
    t.eq(JSON.parse(env.storage.get(KEY)).practiceMs, 99, 'a save requested while held runs at release()');
    const after = env.storage.writes;
    S.release();
    t.eq(env.storage.writes, after, 'an extra release() does nothing');
    S.hold();
    S.state.practiceMs = 100;
    S.save();
    env.setHidden(true);
    t.eq(JSON.parse(env.storage.get(KEY)).practiceMs, 100, 'hiding the page writes pending changes even while held');
    env.setHidden(false);
    S.release();

    // A second context over the same storage reads the record back.
    const env2 = t.env({ storage: env.storage });
    t.eq(env2.PX.core.store.state.practiceMs, 100, 'a new page load reads the saved record');
  }

  t.section('store: schema guard');
  {
    const env = t.env();
    const S = env.PX.core.store;
    const defaults = S.defaults();
    const good = S.guard(goodRecord());
    t.eq(shapeProblems(good, defaults), [], 'a good record passes the guard with the right shape');
    t.eq(good.ex.rotate, goodRecord().ex.rotate, 'a good ex entry is kept unchanged (with engine keys)');
    t.eq(good.trials, goodRecord().trials, 'good trial rows are kept');
    t.eq(good.settings, goodRecord().settings, 'good settings are kept');

    const inputs = [undefined, null, 0, 'text', [], [1, 2], true, { v: 'one' }, { rev: -5 }, JSON.parse('{"__proto__":{"x":1}}')];
    t.ok(inputs.every((x) => shapeProblems(S.guard(x), defaults).length === 0), 'non-records become valid defaults');

    const r = env.PX.rng(20261030);
    let threw = 0, invalid = 0, firstProblem = null, polluted = false;
    for (let i = 0; i < 200; i++) {
      const raw = mutate(goodRecord(), r.fork('fuzz' + i));
      let out;
      try { out = S.guard(raw); } catch (e) { threw++; continue; }
      const probs = shapeProblems(out, defaults);
      if (probs.length) { invalid++; firstProblem = firstProblem || `#${i}: ${probs.join(', ')}`; }
      if ({}.polluted !== undefined || out.polluted !== undefined) polluted = true;
      // Through JSON as well, the way records really arrive.
      let text = null;
      try { text = JSON.stringify(raw); } catch { /* cyclic: skip */ }
      if (text !== null) {
        try {
          const out2 = S.guard(JSON.parse(text));
          if (shapeProblems(out2, defaults).length) { invalid++; firstProblem = firstProblem || `#${i} via JSON`; }
        } catch { threw++; }
      }
    }
    t.eq(threw, 0, 'the guard never throws on 200 fuzzed broken records');
    t.ok(invalid === 0, 'the guard always yields a valid shape' + (firstProblem ? ` (${firstProblem})` : ''));
    t.ok(!polluted, 'no prototype pollution');

    const log = [];
    const fixed = S.guard({ v: 1, rev: 3, settings: { theme: 'neon', textScale: 9, sound: 'yes', bogus: 1 }, practiceMs: -4, ex: { Bad_ID: {}, ok: { mu: 'x' } }, junkTop: 1 }, log);
    t.eq([fixed.settings.theme, fixed.settings.textScale, fixed.settings.sound], ['auto', 2, false], 'broken settings are repaired (enum, clamp, type)');
    t.ok(!('bogus' in fixed.settings) && !('junkTop' in fixed), 'unknown settings and fields are dropped');
    t.eq([fixed.practiceMs, Object.keys(fixed.ex), fixed.ex.ok.mu, fixed.rev], [0, ['ok'], 0, 3], 'broken fields fall back to defaults; good ones stay');
    t.ok(log.includes('settings.theme') && log.includes('practiceMs') && log.some((p) => p.startsWith('junkTop')), 'the guard reports what it repaired');

    // Broken text in storage: never crashes, keeps a copy, starts fresh.
    const st = new SharedStorage({ [KEY]: '{"v":1,"rev":4,"practiceMs":' });
    const env2 = t.env({ storage: st });
    t.eq(env2.PX.core.store.state.practiceMs, 0, 'unreadable stored JSON gives a fresh record');
    t.eq(st.get(KEY + '.corrupt'), '{"v":1,"rev":4,"practiceMs":', 'the unreadable text is kept under a second key');
    t.ok(env2.events.some((e) => e.evt === 'store:error' && e.data.reason === 'corrupt'), 'store:error reports it');

    const st3 = new SharedStorage({ [KEY]: JSON.stringify({ v: 1, rev: 2, practiceMs: 'lots', settings: null, trials: 'none' }) });
    const S3 = t.env({ storage: st3 }).PX.core.store;
    t.eq(shapeProblems(S3.state, defaults), [], 'a broken stored record loads repaired');
  }

  t.section('store: export, import, undo');
  {
    const env = t.env();
    const S = env.PX.core.store;
    S.state.practiceMs = 50;
    S.addTrial({ t: T0, ex: 'rotate', mode: 'daily', code: 3, seed: 77, outcome: 1, rt: 1200.4 });
    S.save();
    env.clock.tick(2000);
    const exported = S.exportJSON();
    t.eq(JSON.parse(exported), JSON.parse(JSON.stringify(S.state)), 'exportJSON() is the record');

    // Round trip into another empty store.
    const envB = t.env();
    const SB = envB.PX.core.store;
    SB.state.practiceMs = 1;
    const res = SB.importJSON(exported);
    t.ok(res.ok, 'importJSON() accepts an export');
    t.eq(res.repairs, [], 'a clean export needs no repairs');
    const strip = (x) => { const c = JSON.parse(JSON.stringify(x)); delete c.rev; delete c.updated; return c; };
    t.eq(strip(SB.state), strip(JSON.parse(exported)), 'export → import round trip keeps the record');
    t.eq(JSON.parse(envB.storage.get(KEY)).practiceMs, 50, 'the import is written at once');
    t.ok(envB.events.some((e) => e.evt === 'store:reload' && e.data.reason === 'import'), 'store:reload { reason: import }');
    t.ok(SB.canUndo(), 'an undo is available after import');
    t.ok(SB.undo(), 'undo() restores the previous record');
    t.eq(SB.state.practiceMs, 1, 'the record from before the import is back');
    t.eq(JSON.parse(envB.storage.get(KEY)).practiceMs, 1, 'the undo is written');
    t.ok(!SB.canUndo() && !SB.undo(), 'only one step of undo');

    const xpBefore = SB.state.practiceMs, revBefore = SB.state.rev;
    const rejects = [
      ['', /empty/], ['not json', /not valid JSON/], ['[1,2]', /not a Parallax progress file/],
      ['{"practiceMs":5}', /not a Parallax progress file/], ['{"v":3,"practiceMs":5}', /newer version/],
    ];
    for (const [text, pattern] of rejects) {
      const r = SB.importJSON(text);
      t.ok(!r.ok && pattern.test(r.error), `importJSON rejects ${JSON.stringify(text)}`);
    }
    t.eq([SB.state.practiceMs, SB.state.rev], [xpBefore, revBefore], 'rejected imports change nothing');

    const repaired = SB.importJSON('﻿' + JSON.stringify({ v: 1, rev: 2, practiceMs: 'many', settings: { theme: 'dark' } }));
    t.ok(repaired.ok && repaired.repairs.includes('practiceMs'), 'an import with broken fields is repaired and reports them');
    t.eq([SB.state.practiceMs, SB.state.settings.theme], [0, 'dark'], 'repaired import keeps the good fields');
    t.ok(SB.state.rev > revBefore, 'an imported low rev never goes below the current rev');

    // reset() is undoable too.
    SB.state.practiceMs = 33;
    SB.reset({ keepSettings: true });
    t.eq([SB.state.practiceMs, SB.state.settings.theme], [0, 'dark'], 'reset({ keepSettings }) clears progress and keeps settings');
    SB.undo();
    t.eq(SB.state.practiceMs, 33, 'undo() after reset()');
    SB.reset();
    t.eq(SB.state.settings.theme, 'auto', 'reset() clears settings too');
  }

  t.section('store: CSV');
  {
    const env = t.env();
    env.PX.ex.define(sampleDef({ id: 'rotate', code: 'EX-02' })); // lets the CSV spell out params
    const S = env.PX.core.store;
    const HEAD = 'time_iso,t_sec,exercise,version,mode,session,params_code,params,seed,outcome,outcome_label,rt_ms,value,p_pred,stage,display,input,value2';
    t.eq(S.exportCSV(), HEAD + '\r\n', 'an empty log exports only the header (the one trial format)');
    const outcomes = [1, 0, 2, 3, 1];
    outcomes.forEach((o, i) => S.addTrial({ t: T0 + i * 1000, ex: i % 2 ? 'rotate' : 'paper-fold', mode: 'free', code: i, seed: 1000 + i, outcome: o, rt: 900 + i, value: i === 4 ? 12.5 : undefined }));
    t.ok(!S.addTrial([1, 0, 0, 0, 0, 7, 1, null]) && !S.addTrial({ ex: 'rotate', code: -1, seed: 1, outcome: 1 }), 'invalid trials are refused');
    t.throws(() => S.addTrial({ ex: 'Bad Id', code: 0, seed: 1, outcome: 1 }), /invalid exercise id/, 'an invalid exercise id throws');
    S.addTrial({ t: T0 + 9000, ex: 'rotate', mode: 'train', code: 1, seed: 77, outcome: 1, rt: 800, p: 0.7125, stage: 2, display: 'small', input: 'touch' });
    S.addTrial({ t: T0 + 10000, ex: 'rotate', mode: 'train', code: 1, seed: 78, outcome: 0, rt: 900, value: -12.5, value2: 0.83 });
    S.addTrial({ t: T0 + 11000, ex: 'rotate', mode: 'train', code: 1, seed: 79, outcome: 1, rt: 950, value2: NaN });
    const csv = S.exportCSV();
    const lines = csv.split('\r\n').filter(Boolean);
    t.eq(lines[0], HEAD, 'CSV header row');
    t.eq(lines.length, 4 + outcomes.length, 'one CSV row per trial');
    t.ok(lines.slice(1).every((l) => l.split(',').length === 18), 'every row has 18 cells');
    t.eq(lines[1].split(',').slice(1, 15), [String(T0 / 1000), 'paper-fold', '1', 'free', '', '0', '', '1000', '1', 'right', '900', '', '', ''], 'row cells (unknown exercise: no params text; no session without the Log)');
    t.eq(lines[2].split(',')[7], 'size=3;axis=x;noise=0;variant=pick1', 'params spelled out through the registry (level values)');
    t.eq(lines.slice(1, 6).map((l) => l.split(',')[10]), ['right', 'wrong', 'stutter', 'skipped', 'right'], 'outcome labels');
    t.eq(lines[5].split(',')[12], '12.5', 'value column');
    t.eq(lines[1].split(',')[0], new Date(T0).toISOString(), 'ISO time column');
    t.eq(lines[6].split(',').slice(13), ['0.713', '2', 'small', 'touch', ''], 'predicted success, stage, display class and input (v1.1 columns 11-12 as words); value2 empty when absent');
    t.eq(S.state.trials[5].slice(8), [713, 2, 1, 2], 'addTrial stores columns 9-12 as codes');
    t.eq([S.state.trials[6].slice(7), lines[7].split(',').slice(12)], [[-12.5, null, null, 0, 0, 0.83], ['-12.5', '', '', '', '', '0.83']], 'value2 (column 13): stored after the other optional columns and written in the CSV');
    t.eq(S.state.trials[7].length, 8, 'a value2 that is not a finite number is dropped (the row keeps its 8 columns)');
    S.csv = (st) => 'hooked ' + st.trials.length;
    t.eq(S.exportCSV(), 'hooked 8', 'the Log\'s exporter (store.csv) writes the CSV when it is registered');
    S.csv = null;
  }

  t.section('store: v1.1 format (v2 records)');
  {
    const env = t.env();
    const S = env.PX.core.store;
    // A v1.0 record: v 1, 10-column rows, sessions without the new fields.
    const v1 = {
      v: 1, rev: 9, created: T0 - 5 * 86400000, updated: T0 - 1000, practiceMs: 600000,
      settings: { sessionMin: 15, weeklyGoal: 3, theme: 'dark', reducedMotion: 'auto', sound: false, keyHints: true, textScale: 1, lastBackup: 0 },
      sessions: [{ id: 's1', start: T0 - 7200000, end: T0 - 6600000, mode: 'train', trials: 20, right: 15, practiceMs: 600000, exs: ['rotate'], summary: null }],
      trials: [[Math.floor(T0 / 1000) - 7000, 0, 0, 3, 11, 1, 1200, null, 700, 2], [Math.floor(T0 / 1000) - 6990, 0, 0, 3, 12, 0, 1500, null]],
      idx: { ex: ['rotate@1'], mode: ['train'] },
    };
    const log = [];
    const g = S.guard(v1, log);
    t.eq(g.v, 2, 'a v1 record is upgraded to v2');
    t.ok(!log.includes('v'), 'the upgrade is silent (not a repair)');
    t.eq([g.trials[0], g.trials[1], g.sessions[0], g.practiceMs, g.settings.theme], [v1.trials[0], v1.trials[1], v1.sessions[0], 600000, 'dark'], 'its rows, sessions and settings load unchanged');
    const row12 = [Math.floor(T0 / 1000), 0, 0, 3, 13, 1, 900, null, 650, 3, 2, 4];
    const row13 = [Math.floor(T0 / 1000) + 2, 0, 0, 3, 15, 0, 1200, -31.5, null, null, 1, 2, 1.27];
    const g2 = S.guard(Object.assign({}, v1, { trials: [row12, [Math.floor(T0 / 1000) + 1, 0, 0, 3, 14, 1, 900, null, null, null, 7, -1], row13,
      [Math.floor(T0 / 1000) + 3, 0, 0, 3, 16, 1, 900, null, null, null, 2, 1, 'far']] }));
    t.eq(g2.trials[0], row12, 'columns 11-12 (display class, input) survive the guard');
    t.eq(g2.trials[1].slice(10), [null, null], 'out-of-range codes become null');
    t.eq(g2.trials[2], row13, 'column 13 (value2) survives the guard');
    t.eq(g2.trials[3].length, 12, 'a value2 that is not a finite number is dropped');
    const ses = Object.assign({}, v1.sessions[0], { display: 'small', viewport: '390x844', input: 'touch', ended: 'complete', budgetMs: 300000 });
    const g3 = S.guard(Object.assign({}, v1, { sessions: [ses, Object.assign({}, ses, { id: 's2', display: 'huge', viewport: '1e9', input: 'Touch!', ended: 'maybe' })] }));
    t.eq(g3.sessions[0], ses, 'sessions keep display, viewport, input, ended and budgetMs');
    t.eq(['display', 'viewport', 'input', 'ended'].map((k) => k in g3.sessions[1]), [false, false, false, false], 'broken values of the new session fields are dropped');
    // json settings (B7's testPause), registered at script load
    S.setting('trialPause', { def: null, type: 'json', check: (v) => (v === null || (v && Array.isArray(v.ids) && typeof v.until === 'string') ? v : undefined) });
    S.setting('anyJson', { def: {}, type: 'json' });
    t.throws(() => S.setting('badJson', { def: 5, type: 'json', check: (v) => (typeof v === 'string' ? v : undefined) }), /valid def/, 'a json setting needs a valid default');
    const g4 = S.guard({ v: 2, settings: { trialPause: { ids: ['fold'], until: '2026-12-01', extra: () => 1 }, anyJson: [1, 2] } });
    t.eq([g4.settings.trialPause, g4.settings.anyJson], [{ ids: ['fold'], until: '2026-12-01' }, [1, 2]], 'json settings keep JSON data only');
    t.eq(S.guard({ v: 2, settings: { trialPause: { ids: 'fold' }, anyJson: 'text' } }).settings.trialPause, null, 'a json setting its check refuses falls back to the default');
    // export → import round trip with the new fields
    S.importJSON(JSON.stringify(Object.assign({}, v1, { trials: [row12, row13], sessions: [ses] })));
    const back = JSON.parse(S.exportJSON());
    t.eq([back.v, back.trials[0], back.trials[1], back.sessions[0]], [2, row12, row13, ses], 'export and import round-trip the new fields (columns 11-13, session fields)');
  }

  t.section('store: two tabs with v1.1 data (the engine merge)');
  {
    // Review S3: the tab whose save meets the other tab's newer record kept only the other's
    // Section runs, Reckon history and test-hygiene log, and lost a setting it had just changed.
    const shared = new SharedStorage();
    const reg = (X) => {
      const S = X.PX.core.store;
      X.PX.engine.fields().forEach((f) => S.field(f.key, f.def, f.fix));
      S.field('reckon', () => ({ v: 1, hist: [] }));
      S.field('hygiene', () => ({ tests: [], focus: [] }));
      S.setting('patFocus', { def: false, type: 'bool' });
      S.merge = X.PX.engine.merge;
    };
    const A = t.env({ storage: shared }), B = t.env({ storage: shared });
    reg(A); reg(B);
    const SA = A.PX.core.store, SB = B.PX.core.store;
    SA.state; SB.state;
    const run = (id) => ({ id, size: 'mini', start: T0, end: T0 + 1000, ended: 'done', right: 20, n: 30 });
    const route = (sec) => [sec, 0, 10, 2, 1, 0.5, 0.1, 3];
    SA.state.section.runs.push(run('run-A'));
    SA.state.reckon.hist.push(route(100));
    SA.save();
    A.clock.tick(1100);
    B.clock.tick(0);
    t.eq([SB.state.section.runs.length, SB.state.reckon.hist.length], [1, 1], 'tab B receives tab A\'s Section run and route');
    // B changes things and has not saved yet when A writes a newer record
    SB.state.section.runs.push(run('run-B'));
    SB.state.reckon.hist.push(route(200));
    SB.state.hygiene.tests.push({ at: T0 + 5, date: '2026-12-01', kinds: ['pat'], paused: ['fold'] });
    SB.state.hygiene.focus.push([Math.floor(T0 / 1000) + 6, 1]);
    SB.state.settings.patFocus = true;
    SB.save();
    shared.muted = true;
    SA.state.section.runs.push(run('run-A2'));
    SA.state.reckon.hist.push(route(300));
    SA.save();
    A.clock.tick(1100);
    shared.muted = false;
    B.clock.tick(1100); // B's save meets A's newer rev: the engine merge runs
    const st = JSON.parse(shared.get(KEY));
    t.eq(st.section.runs.map((r) => r.id).sort(), ['run-A', 'run-A2', 'run-B'], 'every Section run of both tabs is kept');
    t.eq(st.reckon.hist.map((e) => e[0]), [100, 200, 300], 'both tabs\' Reckon routes are kept, in time order');
    t.ok(st.hygiene.tests.length === 1 && st.hygiene.focus.length === 1, 'the test noted and the focus switch in tab B are kept');
    t.eq(st.settings.patFocus, true, 'the setting tab B had just changed is kept (its unsaved side counts as newer)');
    A.clock.tick(0);
    t.eq([SA.state.section.runs.length, SA.state.reckon.hist.length, SA.state.settings.patFocus], [3, 3, true], 'tab A receives the merged record');
  }

  t.section('store: trial cap');
  {
    const env = t.env();
    const S = env.PX.core.store;
    const day0 = Math.floor(T0 / 1000) - 3 * 86400;
    const rows = [];
    for (let i = 0; i < 20500; i++) {
      // 500 oldest rows over three days, then 20 000 recent ones.
      const tSec = i < 500 ? day0 + Math.floor(i / 200) * 86400 + i : day0 + 4 * 86400 + i;
      rows.push([tSec, i % 2, 0, 0, i, i % 4 === 0 ? 0 : i % 4 === 3 ? 2 : 1, 1000, null]);
    }
    const rec = Object.assign(S.defaults(), { trials: rows, idx: { ex: ['rotate', 'mot'], mode: ['free'] } });
    const capped = S.guard(rec);
    t.eq(capped.trials.length, 20000, 'the guard keeps the latest 20 000 trials');
    t.eq(capped.trials[0][4], 500, 'the oldest rows are the ones folded');
    const days = Object.values(capped.trialDays);
    t.eq(days.reduce((s, d) => s + d.n, 0), 500, 'folded rows are counted in daily summaries');
    t.eq(Object.keys(capped.trialDays).length, 3, 'one summary per day');
    const sumRight = days.reduce((s, d) => s + d.right, 0), sumWrong = days.reduce((s, d) => s + d.wrong, 0);
    t.eq([sumRight, sumWrong, days.reduce((s, d) => s + d.stutter, 0)], [250, 125, 125], 'right / wrong / stutter counts are kept');
    t.eq(days.reduce((s, d) => s + d.ex.rotate.n + d.ex.mot.n, 0), 500, 'per-exercise counts use the exercise ids');
    t.eq(days.reduce((s, d) => s + d.rtN, 0), 375, 'reaction times are summed only for right and wrong trials');

    S.load();
    for (let i = 0; i < 20005; i++) S.addTrial([day0 + i, 0, 0, 0, i, 1, 500, null]);
    t.eq(S.state.trials.length, 20000, 'addTrial() keeps the cap');
    t.eq(Object.values(S.state.trialDays).reduce((s, d) => s + d.n, 0), 5, 'addTrial() folds the overflow');
    const sum = (m) => Object.values(m).reduce((s, d) => s + d.n, 0);
    const again = S.guard(JSON.parse(S.exportJSON()));
    t.eq([again.trials.length, sum(again.trialDays)], [20000, 5], 'folded summaries survive a reload');
  }

  t.section('store: two tabs');
  {
    const shared = new SharedStorage();
    const A = t.env({ storage: shared });
    const B = t.env({ storage: shared });
    const SA = A.PX.core.store, SB = B.PX.core.store;
    SA.state; SB.state; // both tabs open and loaded

    SA.state.practiceMs = 10;
    SA.save();
    A.clock.tick(1100);
    B.clock.tick(0); // deliver the storage event
    t.eq(SB.state.practiceMs, 10, 'a write in tab A reloads tab B');
    t.ok(B.events.some((e) => e.evt === 'store:reload' && e.data.reason === 'tab'), 'tab B emits store:reload { reason: tab }');
    t.eq(SB.state.rev, SA.state.rev, 'both tabs share the rev');

    // An old event (same or lower rev) is ignored.
    const reloads = B.events.length;
    B.dispatch('storage', { key: KEY, newValue: JSON.stringify(Object.assign(SA.defaults(), { rev: 0, practiceMs: 999 })) });
    t.eq([SB.state.practiceMs, B.events.length], [10, reloads], 'an event with a lower rev is ignored');
    B.dispatch('storage', { key: 'other', newValue: '{}' });
    t.eq(SB.state.practiceMs, 10, 'events for other keys are ignored');

    // A newer rev arriving during a hold waits for release().
    SB.hold();
    SA.state.practiceMs = 20;
    SA.save();
    A.clock.tick(1100);
    B.clock.tick(0);
    t.eq(SB.state.practiceMs, 10, 'tab B keeps its record during a hold');
    SB.release();
    t.eq(SB.state.practiceMs, 20, 'the newer record is applied at release()');

    // B has unsaved changes when A writes a newer rev: B's save never overwrites it.
    SB.state.practiceMs = 777;
    SB.save();
    shared.muted = true; // B misses the event (e.g. the tab was frozen)
    SA.state.practiceMs = 30;
    SA.save();
    A.clock.tick(1100);
    shared.muted = false;
    const revA = SA.state.rev;
    B.clock.tick(1100); // B's debounced save runs into the newer stored rev
    t.eq(JSON.parse(shared.get(KEY)).practiceMs, 30, 'a save never overwrites a newer rev');
    t.eq(JSON.parse(shared.get(KEY)).rev, revA, 'the stored rev is unchanged');
    t.eq(SB.state.practiceMs, 30, 'tab B reloads the newer record instead');
    t.ok(B.events.some((e) => e.evt === 'store:reload' && e.data.reason === 'conflict' && e.data.discarded), 'store:reload { reason: conflict, discarded }');

    // With a merge hook, the conflict merges instead.
    SB.merge = (theirs, mine) => Object.assign(theirs, { practiceMs: theirs.practiceMs + mine.practiceMs });
    SB.state.practiceMs = 5;
    SB.save();
    shared.muted = true;
    SA.state.practiceMs = 40;
    SA.save();
    A.clock.tick(1100);
    shared.muted = false;
    B.clock.tick(1100);
    t.eq(JSON.parse(shared.get(KEY)).practiceMs, 45, 'the merge hook combines both records');
    t.ok(JSON.parse(shared.get(KEY)).rev > SA.state.rev, 'the merged record is saved with a higher rev');
    A.clock.tick(0);
    t.eq(SA.state.practiceMs, 45, 'tab A receives the merged record');

    // A tab running a newer version: never overwrite it.
    const st = new SharedStorage({ [KEY]: JSON.stringify({ v: 3, rev: 3, practiceMs: 5 }) });
    const C = t.env({ storage: st });
    t.ok(C.PX.core.store.volatile && C.PX.core.store.volatileReason === 'newer-version', 'a record from a newer version puts the store in memory mode');
    C.PX.core.store.state.practiceMs = 1;
    C.PX.core.store.save();
    C.clock.tick(2000);
    t.eq(JSON.parse(st.get(KEY)).v, 3, 'the newer-version record is never overwritten');
  }

  t.section('store: memory fallback');
  {
    for (const mode of ['throw', 'null']) {
      const env = t.env({ storage: mode });
      const S = env.PX.core.store;
      let threw = null;
      try {
        S.state.practiceMs = 5;
        S.save();
        env.clock.tick(2000);
        S.hold(); S.release();
        S.importJSON(S.exportJSON());
        S.undo();
        S.reset();
        S.exportCSV();
        env.setHidden(true);
      } catch (e) { threw = e; }
      t.ok(threw === null, `no exception when localStorage ${mode === 'throw' ? 'throws SecurityError' : 'is missing'}` + (threw ? ': ' + threw.message : ''));
      t.ok(S.volatile, `store.volatile is true (${mode})`);
      const ev = env.events.find((e) => e.evt === 'store:volatile');
      t.ok(ev && ev.data.volatile === true && /can't be saved/.test(ev.data.message), `store:volatile is emitted with the warning text (${mode})`);
    }

    // Writes failing later (quota): volatile until a write succeeds again.
    const env = t.env();
    const S = env.PX.core.store;
    S.state.practiceMs = 1;
    S.save();
    env.clock.tick(1100);
    env.storage.failWrites = true;
    S.state.practiceMs = 2;
    S.save();
    let threw = false;
    try { env.clock.tick(1100); } catch { threw = true; }
    t.ok(!threw && S.volatile, 'a failing write (quota) does not throw and marks the store volatile');
    t.ok(env.events.some((e) => e.evt === 'store:error' && e.data.reason === 'write-failed'), 'store:error { write-failed }');
    t.eq(S.state.practiceMs, 2, 'the state stays in memory');
    env.storage.failWrites = false;
    S.save();
    env.clock.tick(1100);
    t.ok(!S.volatile && JSON.parse(env.storage.get(KEY)).practiceMs === 2, 'the next successful write clears the warning');
    const last = env.events.filter((e) => e.evt === 'store:volatile').pop();
    t.ok(last && last.data.volatile === false, 'store:volatile { volatile: false } when storage works again');
  }

  t.section('store: extension points');
  {
    const env = t.env({
      afterStore(PX) { // as a later script would at load time
        PX.core.store.field('lab', () => ({ runs: [] }), (x) => (x && Array.isArray(x.runs) ? x : undefined));
        PX.core.store.setting('volume', { def: 0.5, type: 'num', min: 0, max: 1 });
      },
    });
    const S = env.PX.core.store;
    t.eq([S.state.lab, S.state.settings.volume], [{ runs: [] }, 0.5], 'field() and setting() extend the record');
    t.eq(S.guard({ v: 1, lab: 'bad', settings: { volume: 4 } }).settings.volume, 1, 'registered settings are validated');
    t.eq(S.guard({ v: 1, lab: 'bad' }).lab, { runs: [] }, 'registered fields are repaired');
    t.throws(() => S.field('practiceMs', () => 0), /already defined/, 'field() refuses a duplicate');
    // Registered after the record was already loaded: the stored values are still recovered.
    const st = new SharedStorage({ [KEY]: JSON.stringify({ v: 1, rev: 1, late: { k: 1 }, settings: { pitch: 3 } }) });
    const L = t.env({ storage: st }).PX.core.store;
    L.state; // loaded before the registrations below
    L.field('late', () => ({ k: 0 }));
    L.setting('pitch', { def: 1, type: 'int', min: 0, max: 5 });
    t.eq([L.state.late, L.state.settings.pitch], [{ k: 1 }, 3], 'late field() and setting() pick up stored values');
    t.ok(S.exIndex('rotate') === 0 && S.exIndex('mot') === 1 && S.exIndex('rotate') === 0, 'exIndex() is stable');
    t.eq([S.exId(1), S.modeIndex('daily'), S.modeName(0)], ['mot', 0, 'daily'], 'index lookups');
    t.eq(S.exState('rotate').mu, 0, 'exState() creates an entry from exDefaults()');
  }
}
