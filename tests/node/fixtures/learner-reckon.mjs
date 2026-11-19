/* Simulated learners for Reckon's misspecified-step check (tests/node/sim-reckon.mjs; PLAN milestone 8; note
   docs/research/v1.2/N1-reckon.md §7 #1, addendum A3 #2): the learners of tests/node/fixtures/learner.mjs, whose
   true item difficulty on Reckon departs from the hand-set model in two ways:
     b_true = b(params) + (legsStep − step_legs) where the legs decide (lib.legCell)
                        + big                    when the item holds a single turn of 140° or more
   The item is the one the player would show (def.generate(PX.rng(seed), params)), so "a turn of 140° or more"
   is read off the real route: a turn between legs or the final turn on the spot. trueP(def, step, day) is the
   success without the day's noise and the switch cost (the edge the engine aims at). */
import { Learner } from './learner.mjs';

export class ReckonLearner extends Learner {
  constructor(PX, seed, opts = {}) {
    super(PX, seed, opts);
    this.legsStep = opts.legsStep ?? 0.4;
    this.bigCost = opts.big ?? 1.5;
    this.cache = new Map();
  }

  item(def, step) {
    const k = step.seed + '|' + JSON.stringify(step.params);
    let it = this.cache.get(k);
    if (!it) {
      it = def.generate(this.PX.rng(step.seed), step.params);
      if (this.cache.size > 2000) this.cache.clear();
      this.cache.set(k, it);
    }
    return it;
  }

  big(def, step) {
    if (def.id !== 'reckon' || step.params.task) return false;
    return this.item(def, step).turns.some((x) => Math.abs(x) >= 140 - 1e-9);
  }

  extra(def, step) {
    if (def.id !== 'reckon' || step.params.task) return 0;
    const lib = def.lib, p = lib.normParams(step.params), dim = def.dims.find((d) => d.key === 'legs');
    return (lib.legCell(p) ? this.legsStep - dim.step : 0) + (this.big(def, step) ? this.bigCost : 0);
  }

  bTrue(def, step) { return super.bTrue(def, step) + this.extra(def, step); }

  trueP(def, step, day) {
    const g = def.chance(step.params), s = this.exState(def);
    let n = s.n;
    if (s.lastDay !== null && day > s.lastDay) n *= Math.exp(-(day - s.lastDay) / this.rho);
    const th = s.theta0 + s.gain * (1 - Math.exp(-n / s.tau));
    const b = def.difficulty(step.params) + this.extra(def, step);
    const know = 1 / (1 + Math.exp(-(th - b)));
    return (1 - this.lapse) * (g + (1 - g) * know) + this.lapse * g;
  }
}
