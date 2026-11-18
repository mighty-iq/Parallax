/* PR-6 Other Way Round (js/ex/otherway/gen.js; PLAN milestone 6, the near rung; note T1 §5.1).
   10 002 seeds over the six strands and three levels: every item validates (exactly one right answer, foils visibly
   different, the strand's independent check), keys are spread evenly, items are deterministic, no fallback items.
   Shortcut solvers (CLAUDE.md rule 5) stay within chance + 10 points on every strand and level; the analytic
   methods that are the strand's own skill are reported, not limited. A probe block reads every strand once. */
import { newRecord } from './fixtures/learner.mjs';

const SEEDS = 10002;
const CHANCE = 0.25, LIMIT = CHANCE + 0.10;

export async function run(t) {
  const env = t.context({});
  const PX = env.PX, d = PX.ex.get('otherway');
  if (!d) return t.fail('the Other Way Round probe is not defined');
  const L = d.lib, S = L.STRANDS;
  globalThis.__owNets = PX.ex.get('nets').lib;
  t.eq(d.role, 'probe', 'a probe');
  t.eq(d.variants, ['turn', 'foldback', 'cutback', 'netback', 'viewfrom', 'whereami'], 'six strands, as variants');
  t.eq(d.cycle, 'variant', 'a block reads the strands in turn');

  t.section('Other Way Round: 10 002 seeds');
  const per = {}, t0 = Date.now();
  let bad = [], fb = 0;
  for (let i = 0; i < SEEDS; i++) {
    const strand = S[i % 6], level = Math.floor(i / 6) % 3, k = strand + level;
    const it = d.generate(PX.rng(7000 + i), { variant: strand, level });
    const v = d.validate(it);
    if (v !== true) bad.push(`${k} seed ${7000 + i}: ${v}`);
    if (it.fallback) fb++;
    const p = per[k] || (per[k] = { n: 0, keys: [0, 0, 0, 0] });
    p.n++; p.keys[it.key]++;
  }
  t.eq(bad.slice(0, 5), [], `every item validates (${bad.length} bad)`);
  t.eq(fb, 0, 'no fallback items');
  for (const [k, p] of Object.entries(per)) {
    const lo = Math.min(...p.keys) / p.n, hi = Math.max(...p.keys) / p.n;
    t.ok(lo > 0.15 && hi < 0.35, `${k}: keys spread over the four places (${p.keys.join(', ')})`);
  }
  t.ok(true, `generation and validation took ${((Date.now() - t0) / 1000).toFixed(1)} s`);
  const a = d.generate(PX.rng(42), { variant: 'whereami', level: 2 }), b = d.generate(PX.rng(42), { variant: 'whereami', level: 2 });
  t.eq(JSON.stringify(a), JSON.stringify(b), 'items are deterministic');
  t.ok(S.every((s) => d.timeLimit({ variant: s, level: 0 }) >= 30000), 'every strand has a time limit of 30 s or more');
  t.ok(S.every((s, i) => i === 0 || d.difficulty({ variant: s, level: 0 }) !== undefined) && d.difficulty({ variant: 'turn', level: 2 }) > d.difficulty({ variant: 'turn', level: 0 }), 'difficulty rises with the level');

  t.section('Other Way Round: shortcut solvers (chance + 10 points at most)');
  const N = 300;
  const tally = {};
  function score(name, k, p) { const x = tally[name + '|' + k] || (tally[name + '|' + k] = { n: 0, ok: 0 }); x.n++; x.ok += p; }
  for (const strand of S) for (let level = 0; level < 3; level++) {
    const k = strand + level;
    for (let s = 0; s < N; s++) {
      const it = d.generate(PX.rng(90000 + s * 7 + level), { variant: strand, level }), r = PX.rng(5 + s);
      for (const [name, fn] of Object.entries(SOLVERS[strand] || {})) {
        // a solver returns the options it cannot tell apart; its expected score is 1 / their number when the key is one
        const pick = fn(it, L, r), set = Array.isArray(pick) ? pick : [pick];
        score(name, k, set.includes(it.key) ? 1 / set.length : 0);
      }
    }
  }
  for (const [key, x] of Object.entries(tally)) {
    const [name, k] = key.split('|'), p = x.ok / x.n, info = name.startsWith('info:');
    if (info) t.ok(true, `${k} ${name}: ${(p * 100).toFixed(1)} % (the strand's own method; reported)`);
    else t.ok(p <= LIMIT, `${k} ${name}: ${(p * 100).toFixed(1)} % ≤ ${LIMIT * 100} %`);
  }

  t.section('Other Way Round in a block');
  const P2 = env.PX, E = P2.engine;
  const rec = newRecord(P2, 1e12 - 1000);
  const plan = E.modes.start(rec, 'check', { now: 1e12, kind: 'block' });
  const steps = [];
  for (let i = 0; i < 40; i++) {
    const st = E.modes.next(plan, rec, 1e12 + i * 9000);
    if (st.done) break;
    steps.push(st);
    E.modes.answer(plan, rec, st, { correct: i % 2 === 0, rt: 3000 }, 1e12 + i * 9000 + 5000);
  }
  const ow = steps.filter((x) => x.exId === 'otherway').map((x) => x.params.variant);
  t.eq(ow, S, 'a block reads the six strands once, in turn');
}

function oddRank(opts, dist) {
  const tot = opts.map((a, i) => opts.reduce((s, b, j) => s + (i === j ? 0 : dist(a, b)), 0));
  return tot;
}
// the options tied for the smallest (largest) value
function argmin(xs) { const m = Math.min(...xs); return xs.map((x, i) => (Math.abs(x - m) < 1e-9 ? i : -1)).filter((i) => i >= 0); }
function argmax(xs) { return argmin(xs.map((x) => -x)); }
const ALL = [0, 1, 2, 3];
function hamming(a, b) { let n = 0; for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) n++; return n; }
function holeSet(h) { return new Set(h.map((p) => p.join(','))); }

const SOLVERS = {
  turn: {
    'most like the others': (it, L, r) => argmin(oddRank(it.options, L.picDiff), r),
    'odd one out': (it, L, r) => argmax(oddRank(it.options, L.picDiff), r),
    'nearest the figure as it stood': (it, L, r) => argmin(it.options.map((o) => L.picDiff(o, it.fig)), r),
    'farthest from the figure as it stood': (it, L, r) => argmax(it.options.map((o) => L.picDiff(o, it.fig)), r),
  },
  foldback: {
    'punch nearest the holes\' centre': (it, L, r) => {
      const c = it.holes.reduce((s, p) => [s[0] + p[0] / it.holes.length, s[1] + p[1] / it.holes.length], [0, 0]);
      return argmin(it.options.map((o) => Math.hypot(o.punch[0] - c[0], o.punch[1] - c[1])), r);
    },
    'most like the others (creases)': (it, L, r) => argmin(oddRank(it.options, (a, b) => hamming(a.folds.map((f) => f.k + f.c + f.move), b.folds.map((f) => f.k + f.c + f.move)) + (a.punch.join() === b.punch.join() ? 0 : 1)), r),
    'odd one out (creases)': (it, L, r) => argmax(oddRank(it.options, (a, b) => hamming(a.folds.map((f) => f.k + f.c + f.move), b.folds.map((f) => f.k + f.c + f.move)) + (a.punch.join() === b.punch.join() ? 0 : 1)), r),
    'info: creases that are mirror lines of the sheet': (it, L, r) => {
      const H = holeSet(it.holes);
      return argmax(it.options.map((o) => o.folds.filter((f) => it.holes.every((p) => H.has((f.k === 'v' ? [2 * f.c - 1 - p[0], p[1]] : [p[0], 2 * f.c - 1 - p[1]]).join(',')))).length), r);
    },
  },
  cutback: {
    'most like the others (solid)': (it, L, r) => argmin(oddRank(it.options, (a, b) => (a.kind === b.kind ? 0 : 1) + (JSON.stringify(a.d) === JSON.stringify(b.d) ? 0 : 1)), r),
    'odd one out (solid)': (it, L, r) => argmax(oddRank(it.options, (a, b) => (a.kind === b.kind ? 0 : 1) + (JSON.stringify(a.d) === JSON.stringify(b.d) ? 0 : 1)), r),
    'as many sides': (it, L, r) => {
      const n = it.face.length, ok = it.options.map((o, i) => (L.section(L.solid(o.kind, o.d), o.plane).length === n ? i : -1)).filter((i) => i >= 0);
      return ok.length ? ok : ALL;
    },
    'largest cut': (it, L, r) => argmax(it.options.map((o) => area(L.flat(L.section(L.solid(o.kind, o.d), o.plane), o.plane.n))), r),
    'smallest cut': (it, L, r) => argmin(it.options.map((o) => area(L.flat(L.section(L.solid(o.kind, o.d), o.plane), o.plane.n))), r),
    'info: the cut that looks most like the face (as drawn)': (it, L, r) => argmin(it.options.map((o) => {
      const sec = L.section(L.solid(o.kind, o.d), o.plane), pr = sec.map((p) => L.isoPt(p));
      return L.shapeDist(L.sig(it.face), L.sig(pr));
    }), r),
  },
  netback: {
    'most like the others': (it, L, r) => argmin(oddRank(it.options, hamming), r),
    'odd one out': (it, L, r) => argmax(oddRank(it.options, hamming), r),
    'opposite pairs only': (it, L, r) => {
      // a player who folds correctly but ignores which way round: keeps nets whose opposite pairs match the cube's
      const cube = it.cube, pairs = new Set([[0, 1], [2, 4], [3, 5]].map(([a, b]) => [cube[a], cube[b]].sort().join('')));
      const lib = PXnets(it);
      const ok = it.options.map((o, i) => {
        const c = []; lib.face.forEach((f, s) => { c[f] = o[s]; });
        return [[0, 1], [2, 4], [3, 5]].every(([a, b]) => pairs.has([c[a], c[b]].sort().join(''))) ? i : -1;
      }).filter((i) => i >= 0);
      return ok.length ? ok : ALL;
    },
  },
  viewfrom: {
    'always front': () => 0,
    'always right': () => 1,
    'always back': () => 2,
    'always left': () => 3,
    'a side that shows in the picture': () => [0, 1],
  },
  whereami: {
    'nearest the shown landmarks': (it, L, r) => argmin(it.options.map((o) => it.shown.reduce((s, i) => s + Math.hypot(o[0] - it.marks[i][0], o[1] - it.marks[i][1]), 0)), r),
    'farthest from the shown landmarks': (it, L, r) => argmax(it.options.map((o) => it.shown.reduce((s, i) => s + Math.hypot(o[0] - it.marks[i][0], o[1] - it.marks[i][1]), 0)), r),
    'nearest the map\'s centre': (it, L, r) => argmin(it.options.map((o) => Math.hypot(o[0] - 50, o[1] - 50)), r),
    'odd one out (place)': (it, L, r) => argmax(oddRank(it.options, (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1])), r),
    'info: right in the mirror too': (it, L, r) => {
      const ok = it.options.map((o, i) => (Math.min(L.fit(o, it.marks, it.shown, it.rel, 1).worst, L.fit(o, it.marks, it.shown, it.rel, -1).worst) <= L.TOL ? i : -1)).filter((i) => i >= 0);
      return ok.length ? ok : ALL;
    },
  },
};
const NETS = null;
function PXnets(it) {
  // the faces of the item's net squares (the generator's rolling, recomputed through the Nets library)
  const lib = globalThis.__owNets;
  const nb = lib.neighbours(it.cells);
  return lib.rollNet(it.cells, nb, it.base);
}
function area(poly) { let a = 0; for (let i = 0; i < poly.length; i++) { const p = poly[i], q = poly[(i + 1) % poly.length]; a += p[0] * q[1] - q[0] * p[1]; } return Math.abs(a) / 2; }
export { SOLVERS, NETS };
