/* js/engine/trend.js: the probe trend model of PLAN milestone 6 (docs/dev/v1.2/measure-sim.md).
   Checks: the fit equals a dense joint-Gaussian computation; fitting occasion by occasion equals fitting the
   whole record (the Kalman view); items converge to one joint posterior mode from any start; a block on the
   guessing floor cannot derail the fit; the familiarity bookkeeping and the break rule; milestones, verdict
   words and the meter; configure and reset. The simulations live in tests/node/measure-sim.mjs (by hand). */
import { MANIFEST } from './run.mjs';

const DAY = 86400000;
const FILE = 'js/engine/trend.js';

export async function run(t) {
  const env = t.context({ files: MANIFEST.includes(FILE) ? MANIFEST : [...MANIFEST, FILE], exercises: false });
  t.eq(env.loadErrors, [], 'trend.js loads');
  const PX = env.PX, T = PX.engine.trend;
  if (!T) return t.fail('PX.engine.trend is missing');

  t.section('config');
  t.eq(T.config.fam.plateau, 0.65, 'the shipped plateau prior is 0.65 SD (PLAN milestone 6)');
  t.eq([T.config.tail.spatial, T.config.tail.control, T.config.state.total, T.config.breakDays, T.config.breakLoss], [0.045, 0.027, 0.5, 56, 0.45], 'tail, state and break defaults');
  T.configure({ fam: { plateau: 0.8 } });
  t.eq(T.config.fam.plateau, 0.8, 'configure patches in place');
  t.eq(T.config.fam.lambda, 16, 'configure keeps the rest');
  T.configure('reset');
  t.eq(T.config.fam.plateau, 0.65, "'reset' restores the defaults");
  t.ok(T.config !== T.DEFAULTS, 'config is a copy of DEFAULTS');

  t.section('familiarity and breaks');
  t.near(T.familiarity(16), 1 - Math.exp(-1), 1e-12, 'familiarity(16) = 1 − 1/e');
  const ab = T.afterBreak({ n: 16, nt: 32 });
  t.near(T.familiarity(ab.n), 0.55 * (1 - Math.exp(-1)), 1e-12, 'after a break familiarity keeps 55 %');
  t.near(ab.nt, 0.55 * 32, 1e-12, 'and so does the tail count');
  t.eq(T.afterBreak({ n: 0, nt: 0 }), { n: 0, nt: 0 }, 'nothing to lose');

  t.section('milestones and words');
  t.eq(T.milestoneAt(13.99), null, 'no milestone before day 14');
  t.eq(T.milestoneAt(14), { index: 0, day: 14, bar: 0.975, none: false }, 'day 14: bar 0.975');
  t.eq(T.milestoneAt(27.9).day, 14, 'still the day-14 milestone');
  t.eq(T.milestoneAt(28), { index: 1, day: 28, bar: 0.95, none: false }, 'day 28: bar 0.95');
  t.eq(T.milestoneAt(55.9).day, 28, 'still day 28');
  t.eq(T.milestoneAt(56), { index: 2, day: 56, bar: 0.95, none: true }, 'day 56: "likely no change" allowed');
  t.eq(T.milestoneAt(90), { index: 3, day: 84, bar: 0.95, none: true }, 'then every 28 days');
  const fake = (p, pNone) => ({ ok: true, gain: { comp: { p, pNone } } });
  t.eq(T.verdict(fake(0.97, 0), T.milestoneAt(14)), 'unclear yet', 'P 0.97 at week 2 is not enough');
  t.eq(T.verdict(fake(0.976, 0), T.milestoneAt(14)), 'likely gain', 'P ≥ 0.975 at week 2');
  t.eq(T.verdict(fake(0.951, 0), T.milestoneAt(28)), 'likely gain', 'P ≥ 0.95 from week 4');
  t.eq(T.verdict(fake(0.5, 0.95), T.milestoneAt(28)), 'unclear yet', 'no "likely no change" before week 8');
  t.eq(T.verdict(fake(0.5, 0.95), T.milestoneAt(56)), 'likely no change', '"likely no change" from week 8 at P ≥ 0.90');
  t.eq(T.verdict(fake(0.5, 0.89), T.milestoneAt(56)), 'unclear yet', 'below 0.90 it stays unclear');

  t.section('GLS = a dense joint-Gaussian computation');
  T.configure({ sd: { byProbe: { viewmatch: 1.4, wordlinks: 0.9 } } });
  const r = PX.rng(20261118), probes = ['cubematch', 'viewmatch', 'otherway', 'mechanisms', 'wordlinks'];
  const occ = [];
  for (let j = 0; j < 10; j++) {
    const bl = probes.filter(() => r.chance(0.8)).map((p) => ({ probe: p, n: r.int(1, 8), y: r.normal(0, 1), v: r.float(0.3, 2) }));
    if (j === 0) for (const p of probes) if (!bl.find((b) => b.probe === p)) bl.push({ probe: p, n: 4, y: r.normal(0, 1), v: 1 });
    occ.push({ t: j * 3 * DAY + (j > 6 ? 70 * DAY : 0), h: j * 0.1 + r.float(0, 0.05), blocks: bl });
  }
  const f = T.fit({ occasions: occ });
  t.ok(f.ok && f.converged, 'the fit converges');
  const dense = denseFit(T, f);
  let db = 0, dv = 0;
  for (let a = 0; a < f.beta.length; a++) {
    db = Math.max(db, Math.abs(dense.beta[a] - f.beta[a]));
    for (let c = 0; c < f.beta.length; c++) dv = Math.max(dv, Math.abs(dense.V[a][c] - f.cov[a][c]) / Math.sqrt(dense.V[a][a] * dense.V[c][c]));
  }
  t.ok(db < 1e-9, `posterior mean as the dense solve (max |Δ| ${db.toExponential(1)})`);
  t.ok(dv < 1e-9, `posterior covariance as the dense solve (max relative |Δ| ${dv.toExponential(1)})`);
  t.eq([f.segment.breaks, f.segment.occasions, f.segment.runInDone], [1, 3, true], 'a 70-day gap starts a new segment; three occasions finish its run-in');
  const f6 = T.fit({ occasions: occ.slice(0, 9) });
  t.eq([f6.segment.occasions, f6.segment.runInDone], [2, false], 'two occasions after the break: run-in not done');
  const g = f.gain.comp;
  t.near(g.p, phi(g.mean / g.sd), 1e-6, 'the meter is P(D > 0) = Φ(mean/sd)');
  t.near(f.meter, g.p, 0, 'meter = the composite readout');
  t.near(g.sdUnit, Math.sqrt((1 + 3 * 0.4) / 4), 1e-12, 'four composite probes: SD_comp factor √((1 + 3ρ)/4)');
  t.ok(g.lo < g.mean && g.mean < g.hi, 'the 90 % range holds the mean');
  t.eq(Object.keys(f.gain).sort(), ['comp', 'far', 'mid', 'near'], 'readouts: composite and each rung');
  T.configure('reset');

  t.section('occasion by occasion = all at once (the Kalman view)');
  const tr = T.track({ occasions: occ });
  t.eq(tr.length, occ.length, 'one entry per occasion');
  let dmax = 0;
  for (let j = 0; j < occ.length; j++) {
    const fj = T.fit({ occasions: occ.slice(0, j + 1) });
    dmax = Math.max(dmax, Math.abs(fj.gain.comp.mean - tr[j].gain.comp.mean), Math.abs(fj.gain.comp.sd - tr[j].gain.comp.sd));
  }
  t.ok(dmax < 1e-9, `each step equals a fit of the record so far (max |Δ| ${dmax.toExponential(1)})`);

  t.section('items: one joint posterior mode from any start');
  const sim = simulateItems(PX, 7);
  const a = T.fit({ occasions: sim });
  t.ok(a.ok && a.converged, `items converge (${a.iterations} iterations)`);
  const b = T.fit({ occasions: sim }, { eta: a.eta.map((x, k) => x + (k % 2 ? 1.5 : -1.5)) });
  const c = T.fit({ occasions: sim }, { center: { cubematch: 2, viewmatch: -2, otherway: 1, mechanisms: -1, wordlinks: 0 } });
  t.ok(b.converged && maxDiff(a.beta, b.beta) < 1e-4, `a perturbed start reaches the same mode (max |Δβ| ${maxDiff(a.beta, b.beta).toExponential(1)})`);
  t.ok(c.converged, 'other centres converge too');
  const rep = T.fit({ occasions: sim }, { eta: a.eta });
  t.ok(rep.iterations <= 3 && Math.abs(rep.gain.comp.mean - a.gain.comp.mean) < 1e-3 * a.gain.comp.sd && Math.abs(rep.gain.comp.sd - a.gain.comp.sd) < 1e-3 * a.gain.comp.sd,
    `a warm start at the mode stays there (${rep.iterations} iterations; readouts within 0.001 SD)`);
  t.eq(T.fit({ occasions: sim }).beta, a.beta, 'deterministic');
  const withRt = sim.map((o) => ({ ...o, blocks: o.blocks.map((bl) => ({ ...bl, items: bl.items.map((x) => [x[0], x[1], x[2], 4500]) })) }));
  t.eq(T.fit({ occasions: withRt }).beta, a.beta, 'a stored response time (the 4th element, as rec.assess keeps it) changes nothing');
  const steep = sim.map((o) => ({ ...o, blocks: o.blocks.map((bl) => ({ ...bl, items: bl.items.map((x) => [x[0], x[1], x[2], null, 1.5]) })) }));
  t.ok(T.fit({ occasions: steep }).gain.comp.sd < a.gain.comp.sd, 'a steeper item slope (the 5th element) carries more information');

  t.section('a block on the guessing floor');
  const floor = simulateItems(PX, 8);
  floor[3].blocks[0].items = floor[3].blocks[0].items.map((x) => [x[0] - 3, x[1], 0]); // all wrong on easy items
  floor[4].blocks[1].items = floor[4].blocks[1].items.map((x) => [x[0] + 4, x[1], 1]); // all right on hard items
  const fl = T.fit({ occasions: floor });
  t.ok(fl.ok && fl.converged, 'still converges');
  t.ok(fl.beta.every((x) => Number.isFinite(x) && Math.abs(x) < 20), 'every parameter stays finite and plausible');
  t.ok(Math.abs(fl.gain.comp.mean) < 5 && fl.gain.comp.sd < 5, 'the gain stays plausible');

  t.section('many items: the linearised blocks match their likelihood summaries');
  const big = simulateItems(PX, 9, 120);
  const fb = T.fit({ occasions: big });
  const summ = { occasions: big.map((o) => ({ t: o.t, h: o.h, blocks: o.blocks.map((bl) => ({ probe: bl.probe, n: bl.items.length, ...mle(bl.items) })) })) };
  const fs = T.fit(summ);
  t.near(fb.gain.comp.mean, fs.gain.comp.mean, 0.1 * fs.gain.comp.sd, 'gain estimate: items ≈ block maximum-likelihood summaries');
  t.near(fb.gain.comp.sd, fs.gain.comp.sd, 0.1 * fs.gain.comp.sd, 'and its SD');

  t.section('what the priors do');
  T.configure({ fam: { plateau: 0.9 } });
  const hi = T.fit({ occasions: sim });
  T.configure('reset');
  t.ok(hi.gain.comp.mean < a.gain.comp.mean, 'a larger familiarity plateau leaves less gain');
  const before = T.predict(a, 'cubematch'), later = T.predict(a, 'cubematch', a.hNow, a.t + 90 * DAY);
  t.ok(before && later && later.mean < before.mean, 'after a long break the next block is predicted lower (familiarity lost)');
  t.eq(T.predict(a, 'nosuchprobe'), null, 'unknown probe: null');
  t.eq(T.fit({ occasions: [] }).ok, false, 'no occasions: not ok');
  t.eq(T.fit({ occasions: [{ t: 0, blocks: [{ probe: 'cubematch', items: [[0, 1.2, 1]] }] }] }).ok, false, 'invalid items are dropped');
  const one = T.fit({ occasions: [{ t: 0, h: 0, blocks: [{ probe: 'cubematch', items: [[0, 0.5, 1], [0.3, 0.5, 0]] }] }] });
  t.ok(one.ok && one.gain.comp.p === 0.5, 'before any training the meter reads 0.5');
}

/* ---------- helpers ---------- */

function phi(x) { // Φ by erf (Abramowitz–Stegun 7.1.26), to 1.5e-7
  const z = Math.abs(x) / Math.SQRT2, t = 1 / (1 + 0.3275911 * z);
  const y = 1 - (((((1.061405429 * t - 1.453152027) * t) + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-z * z);
  return x >= 0 ? 0.5 * (1 + y) : 0.5 * (1 - y);
}
function maxDiff(a, b) { let m = 0; for (let i = 0; i < a.length; i++) m = Math.max(m, Math.abs(a[i] - b[i])); return m; }

// The posterior of β from the full joint covariance of every summary row (no Sherman–Morrison).
function denseFit(T, f) {
  const D = f.design, B = D.blocks, P = D.P, C = T.config, pr = T._.prior(D);
  const n = B.length, X = B.map((bl) => { const x = new Array(P).fill(0); bl.xi.forEach((i, k) => { x[i] += bl.xv[k]; }); return x; });
  const su2 = C.state.total ** 2 * C.state.shared, ss2 = C.state.total ** 2 * (1 - C.state.shared);
  const S = Array.from({ length: n }, (_, a) => Array.from({ length: n }, (_, b) => (B[a].j !== B[b].j ? 0 : su2 * B[a].sd * B[b].sd + (a === b ? ss2 * B[a].sd ** 2 + B[a].v : 0))));
  const Si = T._.spdInverse(S), Q = pr.prec.map((row) => row.slice()), rhs = pr.pmu.slice();
  for (let i = 0; i < n; i++) for (let k = 0; k < n; k++) {
    if (!Si[i][k]) continue;
    for (let a = 0; a < P; a++) { if (!X[i][a]) continue; rhs[a] += X[i][a] * Si[i][k] * B[k].y; for (let c = 0; c < P; c++) Q[a][c] += X[i][a] * Si[i][k] * X[k][c]; }
  }
  const V = T._.spdInverse(Q);
  return { V, beta: V.map((row) => row.reduce((s, v, j) => s + v * rhs[j], 0)) };
}

// A small learner: four spatial probes and the control, items aimed near the truth, a gain over 28 days.
function simulateItems(PX, seed, m = 3) {
  const r = PX.rng(seed), out = [], probes = { cubematch: 0.5, viewmatch: 0.25, otherway: 0.25, mechanisms: 0.4, wordlinks: 0.25 };
  const th = {}; for (const p of Object.keys(probes)) th[p] = r.normal(0, 1);
  const days = [0, 2, 4, 7, 9, 11, 14, 16, 18, 21, 23, 25, 28];
  days.forEach((d, j) => {
    const h = Math.min(1, d / 28), blocks = [];
    for (const [p, g] of Object.entries(probes)) {
      const k = j < 2 ? Math.max(m, 6) : m, items = [];
      const truth = th[p] + (p === 'wordlinks' ? 0 : 0.4 * h) + 0.6 * (1 - Math.exp(-j * 3 / 16)) + r.normal(0, 0.4);
      for (let i = 0; i < k; i++) {
        const b = truth + r.normal(-0.4, 0.6), pr = g + (1 - g - 0.03) / (1 + Math.exp(-(truth - b)));
        items.push([b, g, r.chance(pr) ? 1 : 0]);
      }
      blocks.push({ probe: p, items });
    }
    out.push({ t: d * DAY + 18 * 3600000, h, blocks });
  });
  return out;
}

// A block's maximum-likelihood ability and 1/information (Newton on a wide prior), for the summary check.
function mle(items) {
  let th = 0;
  for (let it = 0; it < 100; it++) {
    let gr = -th / 400, inf = 1 / 400;
    for (const [b, g, ok] of items) {
      const s = 1 / (1 + Math.exp(-(th - b))), top = 1 - g - 0.03, p = g + top * s, dp = top * s * (1 - s);
      gr += (ok - p) * dp / (p * (1 - p)); inf += dp * dp / (p * (1 - p));
    }
    const step = Math.max(-1, Math.min(1, gr / inf));
    th += step;
    if (Math.abs(step) < 1e-10) {
      return { y: th, v: 1 / inf };
    }
  }
  return { y: th, v: 1 };
}
