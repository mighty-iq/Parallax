/* Simulated learners for the plateau detector's acceptance runs (PLAN milestone 3; note P1 §2.6 and §6):
   tests/node/sim-plateau.mjs. A PlateauLearner is the shared Learner (tests/node/fixtures/learner.mjs: day
   noise, lapses, guessing, switch costs, response times, the other exercises' learning curves) whose true
   ability on one focus exercise follows a set shape of k, the number of answers given on it:
     linear   θ0 + slope · k / 100
     plateau  θ0 + rise · min(k, onset) / 100                        (flat from `onset` on)
     step     θ0 + (k ≥ at ? jump : 0)
     ceiling  the pool's hardest difficulty + above                  (flat, past the pool's top)
   θ0 = the pool's easiest difficulty + start + N(0, spread²) (start 1.0, spread 0.4 unless given), plus the
   shared day noise. A response to a plateau change, opts.respond = { to: 'any' | '<change id>', dip,
   dipN: [lo, hi], kind: 'jump' | 'resume', gain, over, rise }, starts when the engine fires a plateau event
   on the focus (onEvent): −dip for dipN answers, then a jump of `gain` reached over `over` answers ('jump')
   or the rise resumed at `rise` per 100 answers ('resume'). opts.forget: idle days shrink k as the shared
   model shrinks practice (k · exp(−days / ρ)); `given` counts the answers given. opts.rtDrop: the focus's response times fall by that share
   per 100 answers (a 'faster' learner). All randomness comes from PX.rng (seeded). */
import { Learner } from './learner.mjs';

export class PlateauLearner extends Learner {
  constructor(PX, seed, opts = {}) {
    super(PX, seed, opts);
    const r = this.r.fork('plateau');
    this.focus = opts.focus;
    this.shape = Object.assign({ type: 'linear', slope: 0.25 }, opts.shape || {});
    this.respondTo = opts.respond || null;
    this.forget = !!opts.forget;
    this.rtDrop = opts.rtDrop || 0;
    this.k = 0;          // effective practice on the focus (shrinks over idle days with forgetting)
    this.given = 0;      // answers given on the focus
    this.kDay = null;
    this.resp = null;
    this.start = (opts.start ?? 1.0) + r.normal(0, opts.spread ?? 0.4);
    this.dipN = this.respondTo ? r.int(this.respondTo.dipN ? this.respondTo.dipN[0] : 40, this.respondTo.dipN ? this.respondTo.dipN[1] : 80) : 0;
  }

  focusDef() { return this.PX.ex.get(this.focus); }

  // The shape's value at k answers (before any response), relative to θ0.
  shapeAt(k) {
    const s = this.shape;
    if (s.type === 'linear') return s.slope * k / 100;
    if (s.type === 'plateau') return s.rise * Math.min(k, s.onset) / 100;
    if (s.type === 'step') return k >= s.at ? s.jump : 0;
    return 0;
  }
  // The true slope at k answers, logits per 100 (the response included).
  slopeAt(k) {
    const s = this.shape, rp = this.resp;
    if (rp && k >= rp.k0) {
      const j = k - rp.k0;
      if (j < rp.dipN) return 0;
      if (rp.kind === 'jump') return j < rp.dipN + rp.over ? 100 * rp.gain / rp.over : 0;
      return rp.rise;
    }
    if (s.type === 'linear') return s.slope;
    if (s.type === 'plateau') return k < s.onset ? s.rise : 0;
    return 0;
  }
  responseAt(k) {
    const rp = this.resp;
    if (!rp || k < rp.k0) return 0;
    const j = k - rp.k0;
    if (j < rp.dipN) return -rp.dip;
    if (rp.kind === 'jump') return rp.gain * Math.min(1, (j - rp.dipN) / rp.over);
    return rp.rise * (j - rp.dipN) / 100;
  }
  theta0() {
    const def = this.focusDef(), PXe = this.PX.ex;
    if (this.shape.type === 'ceiling') return PXe.maxDifficulty(def) + this.shape.above;
    return PXe.minDifficulty(def) + this.start;
  }
  focusTheta(k, day) { return this.theta0() + this.shapeAt(k) + this.responseAt(k) + this.dayNoise(day); }

  theta(def, day) {
    if (def.id !== this.focus) return super.theta(def, day);
    return this.focusTheta(this.kAt(day), day);
  }
  // k after the idle days before `day` (forgetting shrinks it; without forgetting k itself)
  kAt(day) {
    if (!this.forget || this.kDay === null || day <= this.kDay) return this.k;
    return this.k * Math.exp(-(day - this.kDay) / this.rho);
  }

  medianRt(def, step, day) {
    const m = super.medianRt(def, step, day);
    return def.id === this.focus && this.rtDrop ? m * Math.pow(1 - this.rtDrop, this.k / 100) : m;
  }

  respond(def, step, day, opts = {}) {
    if (def.id === this.focus) { this.k = this.kAt(day); this.kDay = day; }
    const res = super.respond(def, step, day, opts);
    if (def.id === this.focus && res.outcome !== 'stutter') { this.k += 1; this.given += 1; }
    return res;
  }

  // The engine fired a plateau event on the focus: a responder starts its response (once).
  onEvent(ev) {
    const R = this.respondTo;
    if (!R || this.resp || ev.exId !== this.focus || ev.kind !== 'plateau') return false;
    if (R.to !== 'any' && R.to !== ev.change) return false;
    this.resp = { k0: this.k, dipN: this.dipN, dip: R.dip ?? 0.2, kind: R.kind || 'jump', gain: R.gain ?? 0.6, over: R.over ?? 30, rise: R.rise ?? 0.3 };
    return true;
  }

  // True success on the pool's hardest items at the ability now is above the target (the truth's ceiling).
  trulyAtCeiling(day, k, target) {
    const def = this.focusDef(), pool = this.PX.engine.model.pool(def);
    let top = pool[0];
    for (const c of pool) if (c.b > top.b) top = c;
    const th = this.focusTheta(k, day) - this.dayNoise(day);
    const p = top.g + (1 - top.g) / (1 + Math.exp(-(th - top.b)));
    return p > target(top.g);
  }
}
