/* PR-8 Balance (js/ex/balance/gen.js; PLAN milestone 6, the Lab checks; note T1 §5.2).
   10 002 seeds over the two kinds and three levels: every item validates (the key recomputed from the dots or the
   houses; the far dots clearly apart and pulling; the middle house the street's least total walk), deterministic,
   no fallback items. Shortcut answers (CLAUDE.md rule 5): the board's centre, the bounding box's centre, the cluster's
   own mean, the point of least total distance, a random dot (centroid items); the street's middle, the mean, the
   midpoint of the end houses, a random house other than the middle one (median items): none is ever right except
   the random dot or house, within chance + 10 points. The score: right within the tolerance, the pull t. */
const SEEDS = 10002;

export async function run(t) {
  const env = t.context({});
  const PX = env.PX, d = PX.ex.get('balance');
  if (!d) return t.fail('the Balance probe is not defined');
  const L = d.lib;
  t.eq([d.role, d.cycle, d.variants, d.answer], ['probe', 'variant', ['centroid', 'median'], 'point'], 'a Lab probe of two kinds, read in turn, answered by a point');

  t.section('Balance: 10 002 seeds');
  let bad = [], fb = 0;
  const pulls = { centroid: [], median: [] }, items = [];
  for (let i = 0; i < SEEDS; i++) {
    const variant = L.VARIANTS[i % 2], level = Math.floor(i / 2) % 3;
    const it = d.generate(PX.rng(30000 + i), { variant, level });
    const v = d.validate(it);
    if (v !== true) bad.push(`${variant}${level} seed ${30000 + i}: ${v}`);
    if (it.fallback) fb++;
    if (variant === 'centroid') pulls.centroid.push(Math.hypot(it.key.x - it.core.x, it.key.y - it.core.y));
    else pulls.median.push(Math.abs(it.mean - it.key.x));
    if (i < 600) items.push(it);
  }
  t.eq(bad.slice(0, 5), [], `every item validates (${bad.length} bad)`);
  t.eq(fb, 0, 'no fallback items');
  const med = (a) => a.slice().sort((x, y) => x - y)[Math.floor(a.length / 2)];
  t.ok(med(pulls.centroid) >= 11, `the far dots pull the balance point ${med(pulls.centroid).toFixed(1)} units out of the cluster (median)`);
  t.ok(med(pulls.median) >= 12.5, `the mean sits ${med(pulls.median).toFixed(1)} units from the middle house (median)`);
  const a = d.generate(PX.rng(9), { variant: 'centroid', level: 2 }), b = d.generate(PX.rng(9), { variant: 'centroid', level: 2 });
  t.eq(JSON.stringify(a), JSON.stringify(b), 'items are deterministic');
  const sides = items.filter((it) => it.params.variant === 'median').map((it) => it.key.x < 50);
  t.ok(sides.filter(Boolean).length / sides.length > 0.35 && sides.filter(Boolean).length / sides.length < 0.65, 'the crowd sits at either end');

  t.section('Balance: shortcut answers');
  const R = PX.rng(5), right = {};
  const tally = (name, ok) => { const x = right[name] || (right[name] = { n: 0, k: 0 }); x.n++; if (ok) x.k++; };
  for (let i = 0; i < 4000; i++) {
    const variant = L.VARIANTS[i % 2], level = i % 3;
    const it = d.generate(PX.rng(50000 + i), { variant, level });
    if (variant === 'centroid') {
      const ch = L.cheapCentroid(it.dots, it.far);
      for (const [name, p] of Object.entries(ch)) tally('centroid ' + name, d.score(it, { x: p[0], y: p[1] }).correct);
      const dot = it.dots[R.int(0, it.dots.length - 1)];
      tally('centroid a random dot', d.score(it, { x: dot[0], y: dot[1] }).correct);
      const near = it.dots.slice().sort((p, q) => Math.hypot(p[0] - 50, p[1] - 50) - Math.hypot(q[0] - 50, q[1] - 50))[0];
      tally('centroid the dot nearest the centre', d.score(it, { x: near[0], y: near[1] }).correct);
    } else {
      const ch = L.cheapMedian(it.houses);
      for (const [name, x] of Object.entries(ch)) tally('median ' + name, d.score(it, { x }).correct);
      const others = it.houses.filter((x) => x !== it.key.x);
      tally('median another house', d.score(it, { x: others[R.int(0, others.length - 1)] }).correct);
    }
  }
  for (const [name, x] of Object.entries(right)) {
    const lim = name.startsWith('median') ? 0.07 + 0.1 : 0.01 + 0.1;
    t.ok(x.k / x.n <= lim, `${name}: right ${(100 * x.k / x.n).toFixed(1)} % (at most ${(100 * lim).toFixed(0)} %)`);
  }
  for (const name of ['centroid board', 'centroid box', 'centroid cluster', 'centroid leastTotal', 'median street', 'median mean', 'median ends', 'median another house']) {
    t.eq(right[name] && right[name].k, 0, `${name}: never right`);
  }

  t.section('Balance: the score and the pull');
  const c = d.generate(PX.rng(123), { variant: 'centroid', level: 1 });
  let s = d.score(c, c.key);
  t.ok(s.correct && s.value === 0 && Math.abs(s.value2 - 1) < 0.01, 'the balance point: right, distance 0, pull 1 (far dots at full weight)');
  s = d.score(c, c.core);
  t.ok(!s.correct && Math.abs(s.value2) < 0.01, 'the cluster\'s own mean: wrong, pull 0 (far dots ignored)');
  const over = [c.core.x + 1.5 * (c.key.x - c.core.x), c.core.y + 1.5 * (c.key.y - c.core.y)];
  t.ok(Math.abs(d.score(c, { x: over[0], y: over[1] }).value2 - 1.5) < 0.01, 'half again as far: pull 1.5 (far dots overweighted)');
  const tol = d.score(c, { x: c.key.x + L.TOL.centroid - 0.01, y: c.key.y });
  t.ok(tol.correct && !d.score(c, { x: c.key.x + L.TOL.centroid + 0.1, y: c.key.y }).correct, 'right within ' + L.TOL.centroid + ' units, wrong beyond');
  const m = d.generate(PX.rng(124), { variant: 'median', level: 2 });
  s = d.score(m, m.key);
  t.ok(s.correct && s.value2 === 0, 'the middle house: right, pull 0');
  s = d.score(m, { x: m.mean });
  t.ok(!s.correct && Math.abs(s.value2 - 1) < 0.01, 'the mean of the houses: wrong, pull 1');
  t.ok(d.score(m, null).correct === false && d.score(c, {}).correct === false, 'no answer: wrong');
  t.ok(!d.score(c, c.wrongResponse).correct && !d.score(m, m.wrongResponse).correct, 'each item carries a wrong answer for the test drivers');
  t.ok(d.difficulty({ variant: 'median', level: 0 }) > d.difficulty({ variant: 'centroid', level: 0 }) && d.difficulty({ variant: 'centroid', level: 2 }) > d.difficulty({ variant: 'centroid', level: 0 }), 'the bus stop is harder; more dots or houses are harder');
}
