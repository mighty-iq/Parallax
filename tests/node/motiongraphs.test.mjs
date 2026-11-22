/* PR-7 Motion Graphs (js/ex/motiongraphs/gen.js; PLAN milestone 6, the far rung; note T1 §5.2).
   10 008 seeds over the four kinds and three levels: every item validates (the answer is the motion's own graph or
   picture; every foil differs from it, and from each other, after any stretch of the vertical axis), keys spread,
   deterministic, no fallback items. Shortcut solvers (CLAUDE.md rule 5) stay within chance + 10 points, among them
   the velocity graph that never meets the zero line, or the one that does (RV-items M7); a block reads the four
   kinds in turn. */
import { newRecord } from './fixtures/learner.mjs';

const SEEDS = 10008, LIMIT = 0.35;

export async function run(t) {
  const env = t.context({});
  const PX = env.PX, d = PX.ex.get('motiongraphs');
  if (!d) return t.fail('the Motion Graphs probe is not defined');
  const L = d.lib, K = L.KINDS;
  t.eq([d.role, d.cycle, d.variants], ['probe', 'variant', ['pos', 'vel', 'strobe', 'frame']], 'a probe of four kinds, read in turn');
  t.eq([d.version, d.past && d.past[1] && d.past[1].min], [2, -1.2], 'version 2 (velocity foils balanced on the zero line); version 1\'s range kept');

  t.section('Motion Graphs: 10 008 seeds');
  const per = {};
  let bad = [], fb = 0;
  for (let i = 0; i < SEEDS; i++) {
    const kind = K[i % 4], level = Math.floor(i / 4) % 3, k = kind + level;
    const it = d.generate(PX.rng(20000 + i), { variant: kind, level });
    const v = d.validate(it);
    if (v !== true) bad.push(`${k} seed ${20000 + i}: ${v}`);
    if (it.fallback) fb++;
    const p = per[k] || (per[k] = { n: 0, keys: [0, 0, 0, 0], motions: {} });
    p.n++; p.keys[it.key]++; p.motions[it.motion] = (p.motions[it.motion] || 0) + 1;
  }
  t.eq(bad.slice(0, 5), [], `every item validates (${bad.length} bad)`);
  t.eq(fb, 0, 'no fallback items');
  for (const [k, p] of Object.entries(per)) {
    t.ok(Math.min(...p.keys) / p.n > 0.17 && Math.max(...p.keys) / p.n < 0.33, `${k}: keys spread (${p.keys.join(', ')}); motions ${JSON.stringify(p.motions)}`);
  }
  const a = d.generate(PX.rng(9), { variant: 'frame', level: 2 }), b = d.generate(PX.rng(9), { variant: 'frame', level: 2 });
  t.eq(JSON.stringify(a), JSON.stringify(b), 'items are deterministic');
  const fr = d.generate(PX.rng(77), { variant: 'frame', level: 1 });
  t.eq(fr.options[fr.key], fr.x.map((v, k) => v - fr.bus * k), 'seen from the bus: each position less the bus\'s way so far');

  t.section('Motion Graphs: shortcut solvers (chance + 10 points at most)');
  const N = 400, tally = {};
  for (const kind of K) for (let level = 0; level < 3; level++) {
    const k = kind + level;
    for (let s = 0; s < N; s++) {
      const it = d.generate(PX.rng(60000 + s * 5 + level), { variant: kind, level });
      for (const [name, fn] of Object.entries(SOLVERS)) {
        const set = fn(it, L);
        const x = tally[name + '|' + k] || (tally[name + '|' + k] = { n: 0, ok: 0 });
        x.n++; x.ok += set.includes(it.key) ? 1 / set.length : 0;
      }
    }
  }
  for (const [key, x] of Object.entries(tally)) {
    const [name, k] = key.split('|'), p = x.ok / x.n;
    t.ok(p <= LIMIT, `${k} ${name}: ${(p * 100).toFixed(1)} % ≤ ${LIMIT * 100} %`);
  }

  t.section('Motion Graphs in a block');
  const E = PX.engine, rec = newRecord(PX, 1e12 - 1000);
  const steps = [];
  for (let b = 0; b < 2; b++) {
    const plan = E.modes.start(rec, 'check', { now: 1e12 + b * 9 * 3600e3, kind: 'block' });
    for (let i = 0; i < 40; i++) {
      const st = E.modes.next(plan, rec, 1e12 + b * 9 * 3600e3 + i * 9000);
      if (st.done) break;
      steps.push(st);
      E.modes.answer(plan, rec, st, { correct: i % 2 === 0, rt: 3000 }, 1e12 + b * 9 * 3600e3 + i * 9000 + 5000);
    }
    E.modes.finish(plan, rec, 1e12 + b * 9 * 3600e3 + 400000);
  }
  const far = steps.filter((x) => x.exId === 'mechanisms' || x.exId === 'motiongraphs').map((x) => x.exId);
  t.eq([...new Set(far)].sort(), ['mechanisms', 'motiongraphs'], 'the far probes alternate between blocks');
  t.eq(steps.filter((x) => x.exId === 'motiongraphs').map((x) => x.params.variant), ['pos', 'vel'], 'a block\'s two Motion Graphs items read the first two kinds');
}

// the options a coarse eye cannot tell from the smallest (within tol)
function argmin(xs, tol = 1e-9) { const m = Math.min(...xs); return xs.map((x, i) => (Math.abs(x - m) <= tol ? i : -1)).filter((i) => i >= 0); }
function argmax(xs, tol) { return argmin(xs.map((x) => -x), tol); }
function norm(it, L) { return it.kind === 'vel' ? L.normVel : L.normPos; }
function total(it, L) { const n = norm(it, L); return it.options.map((a, i) => it.options.reduce((s, b, j) => s + (i === j ? 0 : n(a).reduce((x, v, q) => x + Math.abs(v - n(b)[q]), 0)), 0)); }
const SOLVERS = {
  'most like the others': (it, L) => argmin(total(it, L)),
  'odd one out': (it, L) => argmax(total(it, L)),
  'ends highest': (it) => argmax(it.options.map((o) => o[o.length - 1] - o[0])),
  'ends lowest': (it) => argmin(it.options.map((o) => o[o.length - 1] - o[0])),
  'rises most often': (it) => argmax(it.options.map((o) => o.slice(1).filter((v, i) => v > o[i] + 1e-9).length)),
  'straightest': (it, L) => argmin(it.options.map((o) => { const n = norm(it, L)(o); let s = 0; for (let i = 1; i < n.length - 1; i++) s += Math.abs(n[i + 1] - 2 * n[i] + n[i - 1]); return s; }), 0.1),
  // velocity graphs (RV-items M7): the one that never meets the zero line, or the one that does (others: no pick)
  'never meets the zero line': (it, L) => onSide(it, L, 0),
  'meets the zero line': (it, L) => onSide(it, L, 1),
};
function onSide(it, L, side) {
  if (it.kind !== 'vel') return [0, 1, 2, 3];
  const set = it.options.map((o, i) => (L.zeroSide(o) === side ? i : -1)).filter((i) => i >= 0);
  return set.length ? set : [0, 1, 2, 3];
}
