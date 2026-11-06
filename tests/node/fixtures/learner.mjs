/* Simulated learners for the engine tests and tests/node/sim.mjs. All randomness comes from
   PX.rng (seeded), so every run is reproducible.

   True ability on exercise e (logits, on the item model's scale):
     θ_e = θ0_e + G_e · (1 − exp(−n_e / τ_e)) + day noise
     θ0_e = (easiest item + A) + general + specific   A = opts.aboveFloor (default 1.75),
            general ~ N(0, 0.6²), specific ~ N(0, 0.6²)
     G_e  = gain ~ lognormal(median 1.4) × individual rate; τ_e ~ U(150, 500) answers
     n_e  = effective practice; idle days shrink it: n_e · exp(−days / ρ), ρ ~ U(60, 200)
     day noise ~ N(0, 0.15²), one value per learner and day
   Answers: P = (1 − ℓ)(g + (1 − g) σ(θ − b_true)) + ℓ·g, lapse ℓ ~ U(0.01, 0.06) (pure guesses);
   a trial right after a switch adds the learner's switch cost (U(0, 0.25) logits) to b_true.
   Misspecified item model (opts.misspec): b_true = b + item noise N(0, 0.5²) (seeded by the
   item) + an interaction of the first two dimensions (+0.8 logits at both maxima).
   Response times: median by answer type × exp(0.25 (b − θ)) × speed-up with practice ×
   lognormal(0, 0.35); plus a per-trial overhead (feedback, Track's tracking phase).
   Probes: θ_p = θ0_p + transfer_p · (mean training gain so far) + retest gain R·r_k with
   r = 0, 1, 1.5, 1.5 … at the k-th check, R ~ N(0.33, 0.1²) (Scharfen et al. 2018). */

const RT_MS = { choice: 6000, multi: 8000, yesno: 3500, angle: 7000, targets: 2500, sequence: 6000 };
const OVERHEAD_MS = 2500;

export function phi(x) { // standard normal CDF (Abramowitz–Stegun 7.1.26 through erf)
  const t = 1 / (1 + 0.3275911 * Math.abs(x) / Math.SQRT2);
  const y = 1 - (((((1.061405429 * t - 1.453152027) * t) + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-x * x / 2);
  return x >= 0 ? 0.5 * (1 + y) : 0.5 * (1 - y);
}

function sig(x) { return 1 / (1 + Math.exp(-x)); }

export class Learner {
  constructor(PX, seed, opts = {}) {
    this.PX = PX;
    this.r = PX.rng(PX.rng.hash('sim-learner', seed));
    this.opts = opts;
    const r = this.r;
    this.general = r.normal(0, 0.6);
    this.rate = Math.exp(r.normal(0, 0.35));
    this.lapse = r.float(0.01, 0.06);
    this.switchCost = r.float(0, 0.25);
    this.rho = r.float(60, 200);
    this.dayNoiseSd = 0.15;
    this.days = new Map();
    this.ex = new Map();
    this.probe = new Map();
    this.transfer = opts.transfer || 0;
    this.retestR = r.normal(0.33, 0.1);
  }

  exState(def) {
    let s = this.ex.get(def.id);
    if (!s) {
      const r = this.r.fork('ex:' + def.id);
      const min = this.PX.ex.minDifficulty(def);
      s = {
        theta0: min + (this.opts.aboveFloor ?? 1.75) + this.general + r.normal(0, 0.6),
        gain: Math.exp(r.normal(Math.log(1.4), 0.35)) * this.rate,
        tau: r.float(150, 500), n: 0, lastDay: null, rtScale: Math.exp(r.normal(0, 0.2)),
      };
      this.ex.set(def.id, s);
    }
    return s;
  }

  dayNoise(day) {
    if (!this.days.has(day)) this.days.set(day, this.r.fork('day:' + day).normal(0, this.dayNoiseSd));
    return this.days.get(day);
  }

  // Forgetting over idle days, applied when the exercise is next used.
  touch(def, day) {
    const s = this.exState(def);
    if (s.lastDay !== null && day > s.lastDay) s.n *= Math.exp(-(day - s.lastDay) / this.rho);
    s.lastDay = day;
    return s;
  }

  theta(def, day) {
    const s = this.exState(def);
    let n = s.n;
    if (s.lastDay !== null && day > s.lastDay) n *= Math.exp(-(day - s.lastDay) / this.rho);
    return s.theta0 + s.gain * (1 - Math.exp(-n / s.tau)) + this.dayNoise(day);
  }

  gainSoFar(day) {
    let sum = 0, k = 0;
    for (const [id] of this.ex) {
      const def = this.PX.ex.get(id), s = this.ex.get(id);
      if (!def || def.role !== 'train') continue;
      sum += s.gain * (1 - Math.exp(-s.n / s.tau)); k++;
    }
    return k ? sum / k : 0;
  }

  bTrue(def, step) {
    let b = def.difficulty(step.params);
    if (this.opts.misspec) {
      b += this.PX.rng(this.PX.rng.hash('sim-item', def.id, step.seed)).normal(0, 0.5);
      if (def.dims.length >= 2) {
        const a = def.dims[0], c = def.dims[1];
        const ra = (step.params[a.key] || 0) / Math.max(1, a.levels.length - 1);
        const rc = (step.params[c.key] || 0) / Math.max(1, c.levels.length - 1);
        b += 0.8 * ra * rc;
      }
    }
    if (step.switched) b += this.switchCost;
    return b;
  }

  pRight(def, step, day) {
    const g = def.chance(step.params);
    const th = def.role === 'probe' ? this.probeTheta(def, step.checkIndex || 0) : this.theta(def, day);
    const know = sig(th - this.bTrue(def, step));
    return (1 - this.lapse) * (g + (1 - g) * know) + this.lapse * g;
  }

  medianRt(def, step, day) {
    const s = this.exState(def);
    const th = def.role === 'probe' ? this.probeTheta(def, 0) : this.theta(def, day);
    const speedup = 1 - 0.3 * (1 - Math.exp(-s.n / 300));
    return (RT_MS[def.answer] || 6000) * s.rtScale * Math.exp(0.25 * (def.difficulty(step.params) - th)) * speedup;
  }

  // One answer: { correct, rt, outcome? }. The deadline (Speed, Threshold) needs rt ≤ deadline.
  respond(def, step, day, opts = {}) {
    const r = this.r;
    if (opts.stutterP && r.chance(opts.stutterP)) return { outcome: 'stutter', rt: 1000, correct: false };
    const ok = r.chance(this.pRight(def, step, day));
    const rt = this.medianRt(def, step, day) * Math.exp(r.normal(0, 0.35));
    if (def.role === 'train') { this.touch(def, day); this.exState(def).n += 1; }
    const timeout = step.deadlineMs ? rt > step.deadlineMs : false;
    return { correct: ok && !timeout, rt: timeout ? step.deadlineMs : rt, timeout };
  }

  trialMs(def, step, res) {
    let extra = OVERHEAD_MS;
    if (def.id === 'track') {
      const d = def.dims.find((x) => x.key === 'time');
      extra += 2000 + 1000 * (d ? d.levels[step.params.time || 0] : 8);
    }
    return (res.rt || 0) + extra;
  }

  /* ---------- probes ---------- */

  probeState(def) {
    let s = this.probe.get(def.id);
    if (!s) {
      const r = this.r.fork('probe:' + def.id), PXe = this.PX.ex;
      const mid = (PXe.minDifficulty(def) + PXe.maxDifficulty(def)) / 2;
      const tr = def.id === 'wordlinks' ? 0 : (def.id === 'cubematch' || def.id === 'viewmatch' ? 1 : 0.5) * this.transfer;
      s = { theta0: mid + this.general * 0.7 + r.normal(0, 0.6), transfer: tr, day: 0 };
      this.probe.set(def.id, s);
    }
    return s;
  }
  probeTheta(def, checkIndex) {
    const s = this.probeState(def), k = Math.min(checkIndex, 2);
    return s.theta0 + s.transfer * this.gainSoFar(s.day) + this.retestR * [0, 1, 1.5][k];
  }
  setProbeDay(day) { for (const [, s] of this.probe) s.day = day; }

  /* ---------- the true thresholds of the Threshold protocols ---------- */

  // True P(right) at stimulus x on a protocol axis: opts.log → x is log10 of a numeric level
  // (difficulty linear in the level index), otherwise x is a level index; opts.deadline (ms)
  // multiplies by P(rt ≤ deadline). Continuous x interpolates the item model between levels.
  pAt(def, params, dimKey, x, day, opts = {}) {
    const g = def.chance(params);
    let b = def.difficulty(params);
    if (dimKey && (def.extraParams || []).includes(dimKey + 'Value')) {
      b = def.difficulty({ ...params, [dimKey + 'Value']: Math.pow(10, x) }); // continuous (Track speed)
    } else if (dimKey) {
      const dim = def.dims.find((d) => d.key === dimKey);
      const i = opts.log ? (x - Math.log10(dim.levels[0])) / (Math.log10(dim.levels[1]) - Math.log10(dim.levels[0])) : x;
      b = def.difficulty({ ...params, [dimKey]: 0 }) + dim.step * i;
    }
    const know = sig(this.theta(def, day) - b);
    let p = (1 - this.lapse) * (g + (1 - g) * know) + this.lapse * g;
    if (opts.deadline) p *= phi((Math.log(opts.deadline) - Math.log(this.medianRt(def, { params }, day))) / 0.35);
    return p;
  }

  // Root of pAt(x) = target by bisection over [lo, hi] (pAt decreasing in x for harder-up axes).
  solve(f, target, lo, hi) {
    let a = lo, b = hi;
    for (let i = 0; i < 60; i++) {
      const m = (a + b) / 2;
      if (f(m) > target) a = m; else b = m;
    }
    return (a + b) / 2;
  }
}

// A fresh learner record with the store's §8 fields and every engine-owned field.
export function newRecord(PX, created, settings = {}) {
  const rec = {
    v: 1, rev: 0, created, updated: created,
    settings: { sessionMin: 20, weeklyGoal: 3, theme: 'auto', reducedMotion: 'auto', sound: false, keyHints: true, textScale: 1, lastBackup: 0, ...settings },
    ex: {}, mot: { core: [] }, sessions: [], trials: [], practiceMs: 0, achievements: {}, streak: {}, daily: {}, assess: [],
    tour: { done: false, seen: {} }, ui: { lastRoute: null }, idx: { ex: [], mode: [] }, trialDays: {},
  };
  for (const f of PX.engine.fields()) rec[f.key] = f.def();
  return rec;
}

// Plays one session to its end. hooks: { respond(def, step) → result, stutterP }.
export function playSession(PX, rec, learner, mode, opts, day, hooks = {}) {
  const E = PX.engine;
  let now = opts.now;
  const plan = E.modes.start(rec, mode, opts);
  const steps = [];
  let guard = 0, deadEnd = null;
  for (;;) {
    const step = E.modes.next(plan, rec, now);
    if (step.done) break;
    if (++guard > Math.max(50, (isFinite(plan.total) ? plan.total : 200) * 3)) { deadEnd = 'loop'; break; }
    const def = PX.ex.get(step.exId);
    if (!def || PX.ex.validParams(def, step.params) !== true || !Number.isInteger(step.seed)) { deadEnd = 'bad step'; break; }
    if (def.role === 'probe') step.checkIndex = (plan.check && plan.check.index) || 0;
    const res = hooks.respond ? hooks.respond(def, step) : learner.respond(def, step, day, { stutterP: hooks.stutterP || 0 });
    now += learner ? learner.trialMs(def, step, res) : 5000;
    const out = E.modes.answer(plan, rec, step, res, now);
    steps.push({ step, res, out });
  }
  const fin = E.modes.finish(plan, rec, now);
  return { plan, steps, fin, now, deadEnd };
}

export { RT_MS, OVERHEAD_MS };
