/* Draw-the-answer items, the produce layer (PLAN milestone 4, CONTRACT-v1.2 S and conflict 12, note T1 §4.3):
   Fold's 'mark' (mark the holes), Views' 'draw' (draw the view on a dot grid) and Slice's 'mark' (mark the
   cut). For each: 10 000 generated items pass the exercise's validator, and an independent solver written
   here agrees with every key; the scoring rule (right only for the exact answer; detail counts right,
   missing and extra parts); the variant's difficulty offset and a guessing rate of 0; the level scale,
   Train's variants and the reference guessing rate leave the variant out. */

import { newRecord } from './fixtures/learner.mjs';

const SEEDS = Number(process.env.PRODUCE_SEEDS || 10000);
const T0 = Date.UTC(2026, 10, 2, 9, 0, 0);

// Settings spread evenly over an exercise's level combinations, in the given variant.
function spread(PX, def, variant, n, keep) {
  const combos = PX.ex.enumerate(def).filter((p) => p.variant === variant && (!keep || keep(p)));
  const out = [];
  for (let i = 0; i < n; i++) out.push({ params: combos[i % combos.length], seed: PX.rng.hash('produce', def.id, i) >>> 0 });
  return { combos, list: out };
}

function scaleChecks(t, PX, def, variant) {
  t.eq(def.layers.produce, variant, def.id + ': layers.produce names the variant');
  t.ok(def.variants[def.variants.length - 1] === variant, def.id + ': appended at the end of the variants (old params codes stay valid)');
  t.ok(def.trainVariants.indexOf(variant) < 0, def.id + ': left out of Train\'s variants');
  const others = PX.ex.enumerate(def).filter((p) => p.variant !== variant);
  const lo = Math.min(...others.map((p) => def.difficulty(p))), hi = Math.max(...others.map((p) => def.difficulty(p)));
  t.ok(Math.abs(PX.ex.minDifficulty(def) - lo) < 1e-9 && Math.abs(PX.ex.maxDifficulty(def) - hi) < 1e-9, def.id + ': the level scale leaves the variant out (' + lo.toFixed(2) + ' … ' + hi.toFixed(2) + ')');
  const mine = PX.ex.enumerate(def).filter((p) => p.variant === variant);
  t.ok(mine.every((p) => def.chance(p) === 0), def.id + ': guessing rate 0');
  return mine;
}

function scoreChecks(t, def, items, label) {
  let ok = 0, bad = '';
  for (const it of items.slice(0, 400)) {
    const k = it.key, r1 = def.score(it, k.slice()), r2 = def.score(it, k.slice().reverse().concat(k[0]));
    const less = def.score(it, k.slice(1)), more = def.score(it, k.concat(it.spare));
    const none = def.score(it, []), junk = def.score(it, 'x');
    const good = r1.correct && r2.correct && !less.correct && less.detail.missing === 1 && less.detail.extra === 0 &&
      !more.correct && more.detail.extra === 1 && more.detail.missing === 0 && !none.correct && none.detail.right === 0 && !junk.correct;
    if (good) ok++; else bad = bad || JSON.stringify({ r1, r2, less, more });
  }
  t.eq(ok, Math.min(400, items.length), label + ': right only for the exact answer (order and repeats ignored); detail counts right, missing and extra ' + bad);
}

/* ---------- Fold: an independent forward model ----------
   Every square of the flat sheet is followed through the folds (a square on the moving side of a crease is
   reflected across it); a square is a hole when it ends under a punch. The generator unfolds masks from
   the punches backwards and the validator re-simulates triangles; this model shares neither. */
function foldHoles(item) {
  const N = item.n, punch = new Set(item.punches.map((c) => c[0] + ',' + c[1])), out = [];
  for (let j = 0; j < N; j++) {
    for (let i = 0; i < N; i++) {
      let x = i + 0.5, y = j + 0.5;
      for (const f of item.folds) {
        const L = f.line, c = L.c;
        const s = L.k === 'v' ? x - c : L.k === 'h' ? y - c : L.k === 'd' ? x - y - c : x + y - c;
        if (f.move * s <= 0) continue;
        if (L.k === 'v') x = 2 * c - x;
        else if (L.k === 'h') y = 2 * c - y;
        else if (L.k === 'd') { const nx = y + c, ny = x - c; x = nx; y = ny; }
        else { const nx = c - y, ny = c - x; x = nx; y = ny; }
      }
      if (punch.has((x - 0.5) + ',' + (y - 0.5))) out.push(j * N + i);
    }
  }
  return out;
}

export async function run(t) {
  const { PX } = t.context();

  t.section('produce: Fold, mark the holes');
  {
    const def = PX.ex.get('fold');
    scaleChecks(t, PX, def, 'mark');
    t.ok(PX.ex.enumerate(def).filter((p) => p.variant === 'choose').every((p) => Math.abs(def.difficulty({ ...p, variant: 'mark' }) - def.difficulty(p) - 0.6) < 1e-9), 'fold: mark = choose + 0.6 logit (provisional offset)');
    const { list } = spread(PX, def, 'mark', SEEDS);
    let valid = 0, agree = 0, fallback = 0, firstBad = '', firstOff = '';
    const items = [];
    for (const x of list) {
      const it = def.generate(PX.rng(x.seed), x.params);
      if (it.fallback) fallback++;
      const v = def.validate(it);
      if (v === true && it.variant === 'mark' && it.answer === 'targets' && it.params.variant === 'mark') valid++; else firstBad = firstBad || String(v);
      const mine = foldHoles(it);
      if (mine.join() === it.key.join()) agree++; else firstOff = firstOff || JSON.stringify({ seed: x.seed, key: it.key, mine });
      if (items.length < 400) { it.spare = [...Array(64).keys()].find((c) => it.key.indexOf(c) < 0); items.push(it); }
    }
    t.eq(valid, list.length, `fold mark: ${list.length} items pass the validator (the triangle re-simulation and the key's cells) ${firstBad}`);
    t.eq(agree, list.length, `fold mark: the forward model finds exactly the key's holes in every item ${firstOff}`);
    t.ok(fallback <= list.length * 0.001, `fold mark: fallbacks ${fallback} of ${list.length}`);
    scoreChecks(t, def, items, 'fold mark');
    const plain = def.generate(PX.rng(7), { folds: 1, type: 0, punches: 0, idle: 0 });
    t.ok(plain.variant === undefined && typeof plain.key === 'number', 'fold: an item without a variant is the choose form, as before');
  }
  await runViews(t, PX);
  await runSlice(t, PX);
}

/* ---------- Views: an independent projection ----------
   The asked view straight from the height map (no rays, no voxels): top from above with the front at the
   bottom (nearness = column height); front from +z (nearness = the frontmost cube at that place); right
   from +x with the front on the left (nearness = the rightmost cube). An edge wherever two neighbouring
   cells (or a cell and the outside) differ; edges moved to the origin as the key is. */
function viewEdges(item) {
  const H = item.heights, G = item.grid, v = item.view, img = new Map();
  const put = (x, y, val) => { const k = x + ',' + y; if (!img.has(k) || img.get(k) < val) img.set(k, val); };
  for (let z = 0; z < G; z++) {
    for (let x = 0; x < G; x++) {
      const hgt = H[z][x];
      if (v === 'top') { if (hgt > 0) put(x, G - 1 - z, hgt); continue; }
      for (let y = 0; y < hgt; y++) {
        if (v === 'front') put(x, y, z);
        else put(G - 1 - z, y, x);
      }
    }
  }
  const at = (x, y) => (img.has(x + ',' + y) ? img.get(x + ',' + y) : -1), out = [];
  for (let y = -1; y <= 8; y++) {
    for (let x = -1; x <= 8; x++) {
      if (at(x - 1, y) !== at(x, y)) out.push([x, y, 1]); // the vertical edge left of (x, y)
      if (at(x, y - 1) !== at(x, y)) out.push([x, y, 0]); // the horizontal edge below (x, y)
    }
  }
  const x0 = Math.min(...out.map((e) => e[0])), y0 = Math.min(...out.map((e) => e[1]));
  return out.map((e) => 2 * ((e[1] - y0) * 16 + e[0] - x0) + e[2]).sort((a, b) => a - b);
}

export async function runViews(t, PX) {
  t.section('produce: Views, draw the view');
  const def = PX.ex.get('views');
  scaleChecks(t, PX, def, 'draw');
  t.ok(PX.ex.enumerate(def).filter((p) => p.variant === 'toview').every((p) => Math.abs(def.difficulty({ ...p, variant: 'draw' }) - def.difficulty(p) - 1.0) < 1e-9), 'views: draw = toview + 1.0 logit (provisional offset)');
  const { list } = spread(PX, def, 'draw', SEEDS);
  let valid = 0, agree = 0, fallback = 0, firstBad = '', firstOff = '';
  const items = [];
  for (const x of list) {
    const it = def.generate(PX.rng(x.seed), x.params);
    if (it.fallback) fallback++;
    const v = def.validate(it);
    if (v === true && it.produce === 'draw' && it.variant === 'toview' && it.answer === 'targets' && it.params.variant === 'draw') valid++; else firstBad = firstBad || String(v);
    const mine = viewEdges(it);
    if (mine.join() === it.key.join()) agree++; else firstOff = firstOff || JSON.stringify({ seed: x.seed, view: it.view, key: it.key, mine });
    if (items.length < 400) { it.spare = 2 * (15 * 16 + 15); items.push(it); }
  }
  t.eq(valid, list.length, `views draw: ${list.length} items pass the validator (the ray casts and the key's edges) ${firstBad}`);
  t.eq(agree, list.length, `views draw: the projection from the height map gives exactly the key's edges in every item ${firstOff}`);
  t.ok(fallback <= list.length * 0.001, `views draw: fallbacks ${fallback} of ${list.length}`);
  scoreChecks(t, def, items, 'views draw');
  const it = items[0], moved = it.key.map((e) => e + 2 * (16 + 1));
  t.ok(def.score(it, moved).correct, 'views draw: the drawing may sit anywhere on the grid');
}

/* ---------- Slice: the crossed edges against the meshes' section ----------
   The key comes from the solid's corners (lib.markEdges, lib.markCut). The right option's outline comes from
   cutting the triangle meshes (lib.meshSection) and was checked by the sampling validator. Here every
   crossing point, carried into the outline's normalised frame, must be a corner of that outline, and the
   outline must have no other corner: the crossed edges are exactly the section's corners. */
function corners(loop) {
  const out = [], n = loop.length;
  for (let i = 0; i < n; i++) {
    const a = loop[(i + n - 1) % n], b = loop[i], c = loop[(i + 1) % n];
    const cr = (b[0] - a[0]) * (c[1] - b[1]) - (b[1] - a[1]) * (c[0] - b[0]);
    const la = Math.hypot(b[0] - a[0], b[1] - a[1]), lc = Math.hypot(c[0] - b[0], c[1] - b[1]);
    if (la > 1e-9 && lc > 1e-9 && Math.abs(cr) / (la * lc) > 2e-3) out.push(b);
  }
  return out;
}

export async function runSlice(t, PX) {
  t.section('produce: Slice, mark the cut');
  const def = PX.ex.get('slice'), L = def.lib;
  scaleChecks(t, PX, def, 'mark');
  t.ok(PX.ex.enumerate(def).filter((p) => p.variant === 'choose').every((p) => Math.abs(def.difficulty({ ...p, variant: 'mark' }) - def.difficulty(p) - 0.4) < 1e-9), 'slice: mark = choose + 0.4 logit (provisional offset)');
  const ok = PX.ex.enumerate(def).filter((p) => p.variant === 'mark' && L.markOk(p));
  t.eq(ok.map((p) => p.cut).sort().join(), '0,1,2', 'slice: mark takes simple, straight solids at every cut (lib.markOk)');
  const { list } = spread(PX, def, 'mark', SEEDS, (p) => L.markOk(p));
  let valid = 0, agree = 0, fallback = 0, firstBad = '', firstOff = '';
  const items = [], kinds = {}, counts = {};
  for (const x of list) {
    const it = def.generate(PX.rng(x.seed), x.params);
    if (it.fallback) fallback++;
    const v = def.validate(it);
    if (v === true && it.produce === 'mark' && it.answer === 'targets' && it.params.variant === 'mark') valid++; else firstBad = firstBad || String(v);
    kinds[it.solid.parts[0].type] = (kinds[it.solid.parts[0].type] || 0) + 1;
    counts[it.key.length] = (counts[it.key.length] || 0) + 1;
    const c = L.markCut(it), g = c.g, n = it.plane.n, p0 = it.plane.p, u = it.frame.u, w = it.frame.v, nm = it.norm;
    const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
    const pts = c.ids.map((e) => {
      const A = g.V[g.E[e][0]], B = g.V[g.E[e][1]], tt = c.t[e], X = [0, 1, 2].map((k) => A[k] + tt * (B[k] - A[k])), d = X.map((q, k) => q - p0[k]);
      return [(dot(d, u) - nm.cx) * nm.s, (dot(d, w) - nm.cy) * nm.s];
    });
    const loop = it.options[it.pick].loops[0], cs = corners(loop);
    const near = (q) => cs.some((r) => Math.hypot(q[0] - r[0], q[1] - r[1]) < 2e-3);
    if (it.options[it.pick].loops.length === 1 && cs.length === pts.length && pts.every(near) && Math.abs(dot(n, n) - 1) < 1e-4) agree++;
    else firstOff = firstOff || JSON.stringify({ seed: x.seed, pts: pts.length, corners: cs.length });
    if (items.length < 400) { it.spare = [...Array(12).keys()].find((e) => e < g.E.length && it.key.indexOf(e) < 0); items.push(it); }
  }
  t.eq(valid, list.length, `slice mark: ${list.length} items pass the validator (the clean cut, the key, the sampling check) ${firstBad}`);
  t.eq(agree, list.length, `slice mark: the crossed edges are exactly the corners of the meshes' section in every item ${firstOff}`);
  t.ok(fallback <= list.length * 0.001, `slice mark: fallbacks ${fallback} of ${list.length}`);
  console.log(`       info  slice mark: solids ${JSON.stringify(kinds)}, crossed edges ${JSON.stringify(counts)}`);
  t.ok(Object.keys(kinds).length >= 3, 'slice mark: boxes, prisms and pyramids all appear');
  scoreChecks(t, def, items, 'slice mark');
  const other = def.generate(PX.rng(5), { structure: 2, cut: 1, curved: 1, variant: 'mark' });
  t.ok(other.fallback === true && def.validate(other) === true && other.solid.structure === 'simple', 'slice mark: settings without straight edges give a simple item marked fallback (never rated)');
  // the bets pick hook asks Slice only for settings markOk allows (Train, the arm on, a produce share of 1)
  const E = PX.engine, B = E.bets;
  let rec = null;
  for (let c = 0; c < 300 && !rec; c++) { const r = newRecord(PX, T0 + c * 1000); if (B.arm(r, 'slice', 'produce', T0) === 'on') rec = r; }
  t.ok(!!rec, 'a record with Slice\'s produce arm on exists');
  E.configure({ bets: { produceShare: 1 } });
  const plan = E.modes.start(rec, 'train', { now: T0, pin: 'slice', minutes: 30 }), got = [];
  let now = T0;
  for (let i = 0; i < 60; i++) {
    const step = E.modes.next(plan, rec, now);
    if (step.done) break;
    now += 5000;
    if (step.exId === 'slice') got.push(step);
    E.modes.answer(plan, rec, step, { correct: i % 2 === 0, rt: 2000 }, now);
  }
  E.configure('reset');
  const marks = got.filter((s) => s.params.variant === 'mark');
  t.ok(marks.length >= 1 && marks.every((s) => L.markOk(s.params) && s.layer === 'produce'), `slice: produce items only at settings markOk allows (${marks.length} of ${got.length} Slice items)`);
}
