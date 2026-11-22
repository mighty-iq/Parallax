/* RV-code-1.2 L5: two builds of one record format open at once (an old tab and the updated Pages copy) must not
   convert each other's stored levels back and forth (js/engine/rebase.js: rec.scalev, the writer of each stamp;
   conversions only go forward; E.merge aligns both sides first). Two builds A and B differ in the range of one
   exercise (Views gains a wider starter band); the record goes from one to the other through the store's guard
   (load, import, another tab's record) 60 times and through the two-tab merge. A 1.1 save sets it off, so its
   Views levels are on V11 first. Checked: the newer build converts once; the older never converts the newer one's
   levels; every level (a best, 100 session-summary levels, Path) stays exactly as after the one conversion; the
   order holds by definition version and, within one version, by PX.version; a merge never pairs one side's levels
   with the other side's stamp; and two builds with equal writers still convert (and drift) as before. */
import { createContext } from './run.mjs';

const DAY = 86400000;
const T0 = Date.UTC(2026, 10, 22, 12, 0, 0);
const clone = (x) => JSON.parse(JSON.stringify(x));

// Views with its starter level at `at0` logits (1.1 had none: floor −2.4); version `version`.
function views(PX, version, at0) {
  PX.ex.define({
    id: 'views', code: 'EX-07', name: 'Views', abilities: ['Vz'], cell: null, role: 'train', answer: 'choice', nOptions: 4, version,
    starter: { dim: 'cubes', levels: 1 },
    dims: [{ key: 'cubes', levels: ['3–4', '4–5', '6', '7', '8'], step: 0.6, at: [at0, 0, 0.6, 1.2, 1.8] }, { key: 'grid', levels: [3, 4], step: 0.7 }, { key: 'view', levels: [0, 1, 2, 3], step: 0.6 }],
    base: -2.4,
    generate(rng, params) { return { ex: 'views', seed: rng.seed, params, key: 0 }; },
    validate() { return true; },
    score(item, r) { return { correct: r === item.key }; },
  });
}
// Rotate on its 1.1 range: never converted.
function rotate(PX) {
  PX.ex.define({
    id: 'rotate', code: 'EX-02', name: 'Rotate', abilities: ['SR'], cell: null, role: 'train', answer: 'choice', nOptions: 4,
    dims: [{ key: 'angle', levels: [0, 1, 2, 3, 4, 5, 6], step: 0.7 }], base: -1.75,
    generate(rng, params) { return { ex: 'rotate', seed: rng.seed, params, key: 0 }; },
    validate() { return true; },
    score(item, r) { return { correct: r === item.key }; },
  });
}

// A build: its own context, store, Views definition and PX.version; `converted` counts conversions per exercise.
function build(version, at0, app) {
  const X = createContext({ store: true, exercises: false }), PX = X.PX;
  rotate(PX);
  views(PX, version, at0);
  PX.engine.fields().forEach((f) => PX.core.store.field(f.key, f.def, f.fix));
  PX.version = app;
  const converted = {};
  PX.engine.rebase.register((rec, id) => { converted[id] = (converted[id] || 0) + 1; });
  const r = PX.engine.model.range(PX.ex.get('views'));
  return { PX, S: PX.core.store, E: PX.engine, converted, range: [r.min, r.max], guard: (rec) => PX.core.store.guard(clone(rec)) };
}

// A 1.1 save: a Views best, Path stages and 100 session summaries whose Views levels run 1 … 100.
function save11() {
  const sessions = [];
  for (let L = 1; L <= 100; L++) {
    const start = T0 - (101 - L) * DAY;
    sessions.push({ id: 's' + L, start, end: start + 600000, mode: 'train', trials: 10, right: 7, practiceMs: 600000, exs: ['views'], summary: { ex: [['views', 10, 7, L, L]] } });
  }
  return {
    v: 2, rev: 40, created: T0 - 120 * DAY, updated: T0 - DAY, practiceMs: 60000000,
    ex: {
      views: { mu: -0.9, sd: 0.5, n: 120, nRight: 90, last: T0 - DAY, seen: {}, best: { block: { level: 30, acc: 0.8, n: 10, at: T0 - 3 * DAY, beats: 2 } }, hist: [] },
      rotate: { mu: 0.2, sd: 0.5, n: 80, nRight: 60, last: T0 - DAY, seen: {}, best: { block: { level: 41, acc: 0.8, n: 10, at: T0 - 2 * DAY, beats: 0 } }, hist: [] },
    },
    path: {
      views: { stage: 3, ema: 0.7, items: 6, gema: 0.8, passed: { 1: { at: T0 - 9 * DAY, iv: 1, next: T0 + DAY, held: true, maxHeld: 3, last: T0 - 2 * DAY }, 2: { at: T0 - 4 * DAY, iv: 0, next: T0 - DAY, held: true, maxHeld: 0, last: null } }, watched: { 1: true } },
      rotate: { stage: 2, ema: 0.6, items: 3, passed: { 1: { at: T0 - 9 * DAY, iv: 0, next: T0, held: true, maxHeld: 0, last: null } }, watched: {} },
    },
    sessions, trials: [], idx: { ex: [], mode: [] },
  };
}

// Every stored Views level: the best, the 100 summary pairs and Path's state.
function levels(rec) {
  return {
    best: rec.ex.views.best.block.level,
    rows: rec.sessions.map((s) => s.summary.ex[0].slice(3)),
    path: { stage: rec.path.views.stage, ema: rec.path.views.ema, items: rec.path.views.items, passed: Object.keys(rec.path.views.passed).sort() },
    rotate: rec.ex.rotate.best.block.level,
  };
}
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);

// The record from A, then 60 times through B and back; → { first (B's first copy), drift, aConverts, bConverts, stampOk }
function pingpong(A, B, n = 60) {
  const r0 = A.guard(save11());
  let rB = B.guard(r0);
  const first = levels(rB), bFirst = B.converted.views || 0, aFirst = A.converted.views || 0;
  let drift = 0, stampOk = true, rA = null;
  for (let k = 0; k < n; k++) {
    rA = A.guard(rB);
    rB = B.guard(rA);
    if (!same(levels(rA), first) || !same(levels(rB), first)) drift++;
    if (!(same(rA.scales.views, rB.scales.views) && same(rA.scalev.views, rB.scalev.views))) stampOk = false;
  }
  return { r0, rA, rB, first, drift, aConverts: (A.converted.views || 0) - aFirst, bConverts: (B.converted.views || 0) - bFirst, bFirst, stampOk };
}

export async function run(t) {
  t.section('rebase between builds: the writer of a stamp');
  {
    const { E } = build(2, -1.4, '1.2.0');
    const order = ['1.1.0', '1.2.0-test.3', '1.2.0-test.4', '1.2.0-test.10', '1.2.0', '1.2.1', '1.10.0', '2.0.0'];
    let ok = true;
    for (let i = 0; i < order.length; i++) for (let j = 0; j < order.length; j++) if (E.rebase.cmpApp(order[i], order[j]) !== Math.sign(i - j)) ok = false;
    t.ok(ok, 'PX.version order: ' + order.join(' < ') + ' (a test build before its release)');
    t.ok(E.rebase.cmpApp('dev', '1.2.0') === 0 && E.rebase.cmpApp('1.2', '1.2.0') === 0, 'a version that does not parse has no order');
    t.ok(E.rebase.newer([3, '1.2.0'], [2, '9.9.9']) && E.rebase.newer([2, '1.2.1'], [2, '1.2.0']) && !E.rebase.newer([2, '1.2.0'], [2, '1.2.0'])
      && !E.rebase.newer([2, '1.2.0'], null), 'newer: the definition version first, then PX.version; equal or unknown writers have no order');
    const fix = E.fields().find((f) => f.key === 'scalev').fix;
    t.eq(fix({ views: [3, '1.2.0'], rotate: [0, '1.2.0'], fold: [2, 5], 'Bad!': [1, 'x'], cubes: [1, 'x'.repeat(41)], nets: [2, '1.2.0', 1] }), { views: [3, '1.2.0'] },
      'rec.scalev keeps [version ≥ 1, a short string] per exercise id and drops the rest');
  }

  t.section('rebase between builds: a newer definition version (Views 2 → 3, a wider starter band)');
  {
    const A = build(2, -1.4, '1.2.0'), B = build(3, -2.1, '1.2.0');
    t.ok(A.range[0] > B.range[0] && Math.abs(A.range[1] - B.range[1]) < 1e-9, `the ranges: A ${A.range[0]}…${A.range[1]}, B ${B.range[0]}…${B.range[1]}`);
    const p = pingpong(A, B);
    t.eq(p.r0.scalev.views, [2, '1.2.0'], 'A converts the 1.1 save (V11) and stamps itself as the writer');
    t.eq([p.bFirst >= 1, p.first.best !== levels(p.r0).best], [true, true], 'B converts A\'s levels forward once');
    t.eq([p.aConverts, p.bConverts], [0, 0], 'then 60 times A → B → A: A never converts B\'s levels, B never again');
    t.eq(p.drift, 0, 'every Views level stays exactly as after the one conversion: the best, 100 summary levels, Path\'s stage, average and passed stages');
    t.ok(p.stampOk && same(p.rA.scalev.views, [3, '1.2.0']) && same(p.rA.scales.views, p.rB.scales.views), 'both keep B\'s stamp and B as its writer');
    t.eq(levels(p.rA).rotate, 41, 'an exercise whose range is the same in both is never touched');
    // a level the older build writes meanwhile is kept as written (read on the newer scale: the bounded, one-time cost)
    const w = clone(p.rA);
    w.ex.views.best.block.level = 55;
    const back = A.guard(B.guard(A.guard(B.guard(w))));
    t.eq(back.ex.views.best.block.level, 55, 'a best the older build writes meanwhile is kept as written, and does not move after');
  }

  t.section('rebase between builds: one definition version, a newer PX.version (a refit without a version bump)');
  {
    const A = build(2, -1.4, '1.2.0'), B = build(2, -2.1, '1.2.1');
    const p = pingpong(A, B);
    t.eq([p.bFirst >= 1, p.aConverts, p.bConverts, p.drift], [true, 0, 0, 0], '1.2.1 converts once; 1.2.0 never converts its levels; nothing moves over 60 round trips');
    const T = build(2, -1.4, '1.2.0-test.4'), R = build(2, -2.1, '1.2.0');
    const q = pingpong(T, R, 20);
    t.eq([q.aConverts, q.bConverts, q.drift], [0, 0, 0], 'a test build leaves its release\'s levels alone');
  }

  t.section('rebase between builds: the two-tab merge');
  {
    const A = build(2, -1.4, '1.2.0'), B = build(3, -2.1, '1.2.0');
    const r0 = A.guard(save11());
    // B's record: converted forward, then more Views answers and a best of its own (a level on B's range)
    const rB = B.guard(r0);
    rB.ex.views.n = 300;
    rB.ex.views.best.block.level = 47;
    // A's own state, still on A's range and with unsaved changes: the store's conflict merges guard(theirs) with it
    const mine = clone(r0);
    mine.updated = T0 + 5000;
    mine.sessions.push({ id: 'a1', start: T0, end: T0 + 600000, mode: 'train', trials: 10, right: 8, practiceMs: 600000, exs: ['views'], summary: { ex: [['views', 10, 8, 33, 34]] } });
    const theirs = A.guard(rB);
    t.eq(theirs.scalev.views, [3, '1.2.0'], 'A leaves B\'s record on B\'s range');
    const merged = A.guard(A.E.merge(clone(theirs), clone(mine)));
    const inB = B.guard(merged);
    t.eq(inB.ex.views.best.block.level, 47, 'merged in A and read by B: B\'s best is not converted a second time');
    const a1 = inB.sessions.find((s) => s.id === 'a1').summary.ex[0];
    const cv = B.E.rebase.conv(r0.scales.views, inB.scales.views);
    t.eq([a1[3], a1[4]], [cv(33), cv(34)], 'A\'s own new session is brought to B\'s range once (' + 33 + ' → ' + cv(33) + ')');
    t.ok(same(merged.scalev.views, [3, '1.2.0']) && (B.converted.views || 0) === 1, 'the merged record carries B\'s stamp; B converted nothing more');
    // without the alignment (merge.js alone), the same merge pairs B's best with A's stamp
    const plain = A.guard(A.E.merge.plain(clone(theirs), clone(mine)));
    t.ok(B.guard(plain).ex.views.best.block.level !== 47, 'merge.js alone would have converted B\'s best a second time (' + B.guard(plain).ex.views.best.block.level + ')');
    t.ok(typeof A.E.merge.register === 'function' && Array.isArray(A.E.merge.registered()) && A.E.merge.registered().length > 0, 'the fields\' own merges stay registered through the wrapper');
  }

  t.section('rebase between builds: equal writers have no order (as before)');
  {
    const A = build(2, -1.4, '1.2.0'), B = build(2, -2.1, '1.2.0');
    const p = pingpong(A, B, 20);
    t.ok(p.aConverts === 20 && p.bConverts === 20 && p.drift > 0, `two builds with equal writers and different ranges convert at every exchange and drift (${p.drift} of 20 round trips moved a level): what the writer order prevents`);
  }
}
