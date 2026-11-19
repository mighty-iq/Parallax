# Reckon version 2: the misspecified-step simulation (PLAN milestone 8)

Run 2026-11-19 by W1-fixes. Script: `tests/node/sim-reckon.mjs` with `tests/node/fixtures/learner-reckon.mjs`.
Command: `node tests/node/sim-reckon.mjs --learners 60 --days 60 --legs 0,0.4,1.2 --big 1.5 --burn 100`, and the
same with `--big 0` as the control. 60 simulated learners train Reckon alone in Train mode for 60 days (2–6
sessions a week, breaks as in `tests/node/sim.mjs`), on the real generator; about 320 000–345 000 items per
condition, no errors and no dead ends. Figures are on target and leading items after each learner's first 100
answers; "true" success is the learner's success without the day's noise, which the engine aims at.

## What the learners get wrong on purpose

- **The `legs` step.** Where the legs decide (`lib.legCell`), the true step is 0, 0.4 or 1.2 logits; the model's is
  0.4 (hand-set, note N1 §3.4 #1).
- **Large single turns.** An item that holds one turn of 140° or more (between legs, or the final turn on the spot)
  is 1.5 logits harder than the model says (note N1, addendum A3 #2, from one cell of 36 answers in Wiener & Mallot
  2006). The item is the one the player would see, so this follows the real routes: 23–24 % of the rated
  items hold such a turn, mostly on routes 2, 5 and 7, whose large turns run 120–160°.

## Results

| True legs step | Large-turn error | Within ±0.10 | Success vs target, all | Legs decide | A turn ≥ 140° | Legs-decide share of leg-cell items (thirds) | Coverage (bias) |
|---|---|---|---|---|---|---|---|
| 0 | +1.5 | 65.3 % | 74.6 vs 75.0 % | 78.3 vs 74.9 % | 57.4 vs 75.2 % | 38 / 40 / 39 % | 87.0 % (−0.36) |
| 0.4 | +1.5 | 66.9 % | 74.6 vs 75.0 % | 74.8 vs 75.0 % | 56.7 vs 75.3 % | 37 / 37 / 38 % | 84.5 % (−0.39) |
| 1.2 | +1.5 | 66.0 % | 74.9 vs 75.1 % | 66.1 vs 75.2 % | 58.1 vs 75.4 % | 34 / 35 / 35 % | 75.9 % (−0.46) |
| 0 | none | 93.1 % | 74.4 vs 74.5 % | 77.4 vs 74.3 % | 74.0 vs 74.7 % | 43 / 45 / 46 % | 98.6 % (+0.07) |
| 0.4 | none | 93.8 % | 74.5 vs 74.6 % | 73.3 vs 74.4 % | 74.4 vs 74.8 % | 41 / 43 / 44 % | 99.1 % (−0.01) |
| 1.2 | none | 87.0 % | 74.9 vs 74.8 % | 64.6 vs 74.8 % | 75.3 vs 75.0 % | 38 / 40 / 41 % | 97.9 % (−0.12) |

## Reading

1. **No floor effect where the legs decide** (note N1 §7 #1). With the step at a third of the truth (true 1.2 against
   0.4), the legs-decide items run about 10 points under the target (64–66 % against 75 %), far above chance
   (22 % or less), and the engine keeps playing the level on 34–41 % of leg-cell items to the end. With no true step
   at all they run 3 points over; with the step right, within 1 point. Milestone 7's per-dimension offsets take up
   part of an error but not all of it: 0.8 logits is more than their cap. The levels can ship; the pooled refit
   (O16) should set the step.
2. **Large single turns are the bigger risk.** If A3 #2's estimate holds, items with a turn of 140° or more sit about
   18 points under the target (57 % against 75 %) whatever the legs step, the share of items within ±0.10 drops from
   about 93 % to about 66 %, and the 95 % interval of the rating covers the true ability only 76–87 % of the time
   (the rating runs 0.4 logits low). The engine cannot see this: the turn sizes inside a route level are drawn per
   item, not a dimension. The overall success still matches the target (within 0.5 points), because items without
   such a turn run about 5 points over it.
3. **What to do.** No design change now: the estimate rests on one cell of 36 answers, and the rotation range
   ±30–150° is what keeps fixed answers near chance (A3 #3). The O16 refit should model the largest single rotation
   (A3 #1), which the trial rows let it do (each row's seed and paramsCode regenerate its item, turns included); if pooled data confirm a jump above
   about 140°, the large turn band (shared with Homing) and the top of the final turn are the first candidates to
   trim.
