/* Simulated learners with their own step on every dimension (PLAN milestone 7; note P1 §4.2, §4.4 and
   its Addendum): the learners of tests/node/fixtures/learner.mjs, whose true item difficulty adds a
   person-specific deviation of each dimension's step (a random-weights LLTM, Rijmen & De Boeck 2002):
     b_true = b(params) + Σ_d z_d · (lv_d − mid_d),   mid_d = (levels_d − 1) / 2
     z_d = f_d · |step_d| · (ρ · a + √(1 − ρ²) · e_d),   a = the learner's general ability / 0.6, e_d ~ N(0, 1)
   Profiles (f per dimension): even (0), uneven (0.5), f09 (0.9), sparse (1.6 on one dimension per exercise
   whose levels switch the method, SPARSE_DIM; 0 elsewhere), corr (0.5 with ρ = −0.5: abler learners have
   flatter steps). The standard normals e_d are drawn per learner and exercise from their own stream, so the
   same learner meets every profile with the same pattern, only scaled.
   trueP(def, step, day, opts) is the learner's success without the day's noise and the switch cost (the
   stable "edge" the engine aims at); opts.noise adds the day's noise back. */
import { Learner } from './learner.mjs';

// The dimension per fixture exercise whose levels change the method rather than the load (note P1 Addendum §2):
// a fold type, a rotation axis, a net shape, a curved solid, a view direction, a board turn, candidate
// similarity, turn sizes, the number of targets.
export const SPARSE_DIM = {
  fold: 'type', rotate: 'axis', spin: 'cells', nets: 'shape', slice: 'curved', views: 'direction', orient: 'shift',
  span: 'turn', hidden: 'similarity', homing: 'turns', track: 'targets',
};

export const PROFILES = {
  even: { f: 0 },
  uneven: { f: 0.5 },
  f09: { f: 0.9 },
  sparse: { sparse: 1.6 },
  corr: { f: 0.5, rho: -0.5 },
};

export class ProgressLearner extends Learner {
  constructor(PX, seed, opts = {}) {
    super(PX, seed, opts);
    this.profile = typeof opts.profile === 'string' ? PROFILES[opts.profile] : opts.profile || PROFILES.even;
    this.wSeed = seed;
    this.w = new Map();
  }

  // Per dimension of the exercise: { z (logits per level step), mid, on }.
  weights(def) {
    let w = this.w.get(def.id);
    if (w) return w;
    const r = this.PX.rng(this.PX.rng.hash('progress-w', this.wSeed, def.id));
    const P = this.profile, rho = P.rho || 0, a = this.general / 0.6;
    w = def.dims.map((d) => {
      const L = d.levels.length, step = Math.abs(d.step || 0), e = r.normal(0, 1);
      const f = P.sparse ? (SPARSE_DIM[def.id] === d.key ? P.sparse : 0) : P.f || 0;
      const on = L > 1 && step > 1e-9;
      return { key: d.key, mid: (L - 1) / 2, on, z: on ? f * step * (rho * a + Math.sqrt(1 - rho * rho) * e) : 0 };
    });
    this.w.set(def.id, w);
    return w;
  }

  // Σ z_d (lv_d − mid_d) for params.
  offset(def, params) {
    let s = 0;
    for (const x of this.weights(def)) if (x.on) s += x.z * ((params[x.key] || 0) - x.mid);
    return s;
  }

  bTrue(def, step) {
    let b = super.bTrue(def, step);
    if (def.role === 'train') b += this.offset(def, step.params);
    return b;
  }

  // The true difficulties of the exercise's items with guessing rate g (its pool, through the person's own
  // steps), sorted.
  sortedB(def, g) {
    const key = def.id + ':' + g;
    this.sb = this.sb || new Map();
    if (!this.sb.has(key)) {
      const bs = [];
      for (const c of this.PX.engine.model.pool(def)) if (c.g === g) bs.push(c.b + this.offset(def, c.params));
      this.sb.set(key, Float64Array.from(bs).sort());
    }
    return this.sb.get(key);
  }

  // Whether some item of the pool (with guessing rate g) has a true success within ±tol of target now.
  reaches(def, g, target, th, tol = 0.05) {
    const bs = this.sortedB(def, g), l = this.lapse;
    const q = Math.min(1 - 1e-9, Math.max(1e-9, ((target - l * g) / (1 - l) - g) / (1 - g)));
    const bStar = th - Math.log(q / (1 - q));
    let lo = 0, hi = bs.length;
    while (lo < hi) { const m = (lo + hi) >> 1; if (bs[m] < bStar) lo = m + 1; else hi = m; }
    for (const i of [lo - 1, lo]) if (i >= 0 && i < bs.length && Math.abs(this.pAtB(th, bs[i], g) - target) <= tol) return true;
    return false;
  }

  // The stable ability now (θ at the middle of every dimension, without the day's noise).
  thetaStable(def, day) {
    const s = this.exState(def);
    let n = s.n;
    if (s.lastDay !== null && day > s.lastDay) n *= Math.exp(-(day - s.lastDay) / this.rho);
    return s.theta0 + s.gain * (1 - Math.exp(-n / s.tau));
  }

  // True success at difficulty b and guessing rate g for ability th.
  pAtB(th, b, g) { return (1 - this.lapse) * (g + (1 - g) / (1 + Math.exp(-(th - b)))) + this.lapse * g; }

  // True success without the day's noise and the switch cost: the edge the engine aims at.
  trueP(def, step, day, opts = {}) {
    const g = def.chance(step.params), s = this.exState(def);
    let n = s.n;
    if (s.lastDay !== null && day > s.lastDay) n *= Math.exp(-(day - s.lastDay) / this.rho);
    const th = s.theta0 + s.gain * (1 - Math.exp(-n / s.tau)) + (opts.noise ? this.dayNoise(day) : 0);
    let b = def.difficulty(step.params) + this.offset(def, step.params);
    if (this.opts.misspec) b = super.bTrue(def, { ...step, switched: false }) + this.offset(def, step.params);
    const know = 1 / (1 + Math.exp(-(th - b)));
    return (1 - this.lapse) * (g + (1 - g) * know) + this.lapse * g;
  }
}
