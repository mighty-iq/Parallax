# Progress on every dimension: the simulation for PLAN milestone 7 (W2-progress)

Written 2026-11-19 (UTC) by the W2-progress builder. Sources: docs/dev/PLAN.md milestone 7 (its acceptance lines) and note P1 (docs/research/v1.2/P1-plateaus-progress.md §4.3–§4.4, §6.4 and its Addendum). Code: js/engine/dims.js (offsets, fit, person pool, leading dimension, fluency items, deck room), the hooks in js/engine/select.js and js/engine/modes.js, js/ui/frontier.js; ENGINE.md §19 describes them. Runs: tests/node/sim-progress.mjs with the learners of tests/node/fixtures/learner-progress.mjs; tests/node/sim.mjs with and without js/engine/dims.js; tests/node/shortcut-levels.test.mjs.

## 0. In short

| PLAN milestone 7 acceptance line | uneven (f = 0.5) | even (f = 0) | Result |
|---|---|---|---|
| ≥ 94 % of target items within ±0.10 of the true edge (where the pool reaches it) | 93.8 % (before the change: 86.5 %) | 96.0 % (before: 97.3 %) | **uneven fails by 0.2 points**, on Track (94.8 % without it); even learners pay 1.3 points for offsets fitted to noise (§2) |
| no dimension level more than 5 points off (cells of ≥ 200 items where the pool reaches the target) | observed −6.6 (Track speed level 22; before: −15.5); expected 3.6 (Slice cut 0) | observed −6.6 (Track speed 25; before: −4.8); expected −4.8 (Track speed 33) | **fails on observed answers, on Track's speed levels only** (every other cell within 3.8 and 4.1 points); passes on the true success of the items chosen (§3) |
| the overall within ±1 point | +0.1 | +0.5 | pass |
| about 95 % coverage (93–97 %, the band tests/node/sim.mjs checks) | 97.8 % (before: 97.2 %) | 98.1 % (before: 98.3 %) | **above the band by 0.8 and 1.1 points**: intervals on the wide side (rms z 0.84 and 0.82), as they were before the change (§4) |
| shortcut solvers within chance + 10 at every dimension level | 12 of the 20 training exercises checked | | pass since 19 Nov ~02:00 UTC, with scoped exceptions in Nets, Slice and Fold (§5); 8 exercises wait for their owners' exports |
| leading and fluency items off the scoped shortcut cells (`E.dims.scoped`; review RV-wave2 #2, 19 Nov) | 0 of 196,638 leading, 0 of 96,698 fluency (target items there: 6.9 %) | 0 of 203,360, 0 of 100,856 (7.0 %) | pass; the other lines unchanged within noise on the same learners and seed: within ±0.10 93.7 and 96.0 %, worst observed level −6.7 and −7.0 (Track's speed), overall +0.1 and +0.5, coverage 97.8 and 98.1 %, fluency 78.1 vs 77.2 and 77.1 |
| fluency items within ±2 points of their deadline target (after each exercise's first 10) | 78.1 vs 77.2 % in time | 78.1 vs 77.1 % | pass (+0.9, +1.0) |
| nothing else moves | | | pass: tests/node/sim.mjs's four runs agree with and without dims.js within sampling noise, every hard check passes in both (§6) |

Reported profiles (100 learners each; before → with milestone 7): f = 0.9: within ±0.10 70.7 → 85.3 %, coverage 93.2 → 96.3 %; sparse (one dimension per exercise with a spread of 1.6 steps per level): 74.4 → 86.3 %, 91.8 → 95.4 %; corr (f = 0.5, abler learners flatter, ρ = −0.5): 86.7 → 93.4 %, 96.9 → 97.1 %. Misspecified items (even learners): 76.5 → 75.9 %, coverage 91.9 → 91.3 % (§7).

## 1. What the runs do

- **The engine.** Every learner plays the real E.modes with every hook of the engine files in the copy (MANIFEST), on the fixture exercises of tests/node/fixtures/exercises.mjs: the eleven v1.0 training exercises' dimensions, levels, steps and guessing rates (Track's speed has 46 levels at 0.12 logit, Span's length 8 at 0.71). W2-plateau's and W2-bets' finish hooks are left out unless `--wave2` is given, so the runs measure this milestone alone. The runs used a copy of the working tree taken at about 23:00 UTC on 18 Nov; its js/engine/dims.js, select.js and modes.js are identical to the build branch at e6a8ee3.
- **The learners** (tests/node/fixtures/learner-progress.mjs): the shared learner of tests/node/fixtures/learner.mjs (ability per exercise with its own learning curve, day noise N(0, 0.15²), lapses U(0.01, 0.06), guessing, switch costs U(0, 0.25) logit, response times, idle forgetting) plus a person-specific step per dimension: the true difficulty of an item is b(params) + Σ z_d (level_d − middle_d), z_d = f · |step_d| · e, e ~ N(0, 1) per learner and dimension. Profiles: even (f = 0), uneven (f = 0.5), f09 (f = 0.9), sparse (f = 1.6 on one dimension per exercise, 0 elsewhere), corr (f = 0.5 with e correlated −0.5 with general ability).
- **The calendar** (as tests/node/sim.mjs): 90 days from Monday 2 Nov 2026; 2–6 sessions a week of 10–30 minutes in Train (balanced style), a 10 % chance of two sessions a day, from week 2 a 12 % weekly chance of a 4–14-day break. Each learner trains 3 of the 11 exercises (drawn per learner), so every exercise collects hundreds of answers per learner.
- **Conditions on the same learners and days**: est (milestone 7 on), cur (`config.dims.on` false: the engine before the milestone).
- **Counting.** Target and leading items after each exercise's first 200 answers (burn-in). "The true edge": the item's true success without the day's noise and the switch cost (`trueP`). "Where the pool reaches the target": some item of the exercise with the item's guessing rate has a true success within ±0.05 of the target at the learner's ability that day; elsewhere no choice of item can be within ±0.10, and those items are reported under "all". Per level: success minus target in each cell (exercise, dimension, level) of at least 200 such items, observed (answers) and expected (true success). Coverage: the rating's 95 % interval at each session end holds the true ability at the state's centre (the level mix the rating describes; ENGINE.md §19). Fluency items: in time against the deadline target p* after each exercise's first 10.
- **Sizes and seeds.** 200 learners for even and uneven (gated), 100 for f09, sparse, corr and the misspecified run; seed 1; 1.09 million gated target items per profile. Each run took 3–5 minutes on one core (`nice -n 15`).

## 2. Within ±0.10 of the true edge

| | est uneven | est even | cur uneven | cur even |
|---|---|---|---|---|
| where the pool reaches the target | 93.8 % (92.9 % of items) | 96.0 % (95.1 %) | 86.5 % (92.7 %) | 97.3 % (95.2 %) |
| all target items | 89.7 % | 94.0 % | 82.8 % | 95.3 % |
| mean distance (reachable) | 4.3 points | 3.8 | 5.5 | 3.6 |
| Track, within ±0.10 where reachable | 85.1 % | 92.7 % | 65.5 % | 96.6 % |
| target / leading items within ±0.10 (all) | 89.2 / 92.1 % | 93.8 / 95.1 % | | |

For even learners the change costs 1.3 points: their true steps are the shared ones, so the fitted offsets (rms 0.23 steps) are noise: Views holds, the others lose 0.2–2.3 points (Homing 2.3, Span 1.7), Track 3.9. For uneven learners it gains 7.3 points, and every exercise gains (Track 19.6, Homing 11.4, Views 11.5, Span 7.2).

By exercise (uneven, est; reachable share, within ±0.10 there): Fold 95.4/96.3, Hidden 95.2/95.1, Homing 91.0/90.8, Nets 97.8/99.3, Orient 90.6/94.2, Rotate 94.4/96.3, Slice 90.7/93.3, Span 86.1/89.7, Spin 90.3/96.1, Track 96.5/**85.1**, Views 94.0/95.7. Track pulls the line under 94 %: without it, 94.8 %.

**Why Track.** Its speed has 46 levels of 0.12 logit, so an offset is multiplied by up to 22 levels on either side of the centre. The prior (an SD of 0.5 × step per level) amounts to 1.35 logits at the top level, the cap to 0.75, so fits run into the cap: 41.5 % of uneven learners' Track speed offsets sit at the cap (49.2 % of their true offsets lie beyond it), and 12.3 % of even learners' do, with a true offset of 0. Span's length (8 levels of 0.71 logit) likewise: 40.0 % and 10.9 %.

**Levers, run** (uneven and even, 200 learners each):
- a cap of 1.5 logits at the top level (`--set dims.cap=1.5`): uneven within ±0.10 **94.3 % (passes)**, even 96.0 %; but Track's worst levels get worse (uneven +7.4 at speed 36, even −8.7 at speed 28) and offsets at the cap fall to 23.1 % (uneven) and 0 % (even). Cost: one hand-set number doubled before pooled exports have given any dimension its spread; a long dimension's extreme levels move further on a noisy fit.
- the long-dimension prior (`--set dims.longPrior=true`: a dimension with more than five levels gets the prior of a five-level one at its top level): uneven 93.7 % (Track 83.5 %, worse: its offsets never reach the cap now while 49 % of the true ones lie beyond it), even 96.0 %; worst levels observed −8.0 (Track speed 23, uneven; speed 29, even), expected 3.7 and −4.0. It does not help, so it stays off.

So Track's line is not noise at the cap but real differences between learners larger than the cap allows: the uneven profile gives each level step a spread of half a step, which on 46 levels is 1.35 logits at the top level against a cap of 0.75. Whether players differ that much on Track's speed is what pooled exports will show (`config.dims.spread.track.speed`, which then sets the prior and a cap of 2.5 spreads); until then the cap is the guard the note asks for. Recommendation: keep the cap at 0.75 and report the 0.2-point miss; raise it to 1.5 only if the lead prefers the line to the cap's caution.

## 3. No dimension level more than 5 points off

Worst cells (observed / expected, items), where the pool reaches the target:
- uneven: Track speed 22 −6.6/−3.4 (1,678), 27 −5.9/−2.4 (671), 32 −5.0/−2.6 (300), 34 +4.4/+1.8 (226), 30 −4.0/−1.0 (399), 21 −3.8/−2.2 (1,779); every other cell of 170 within ±3.8.
- even: Track speed 25 −6.6/−2.9 (868), 30 −5.7/−3.8 (351), 31 −5.1/−4.2 (303), 32 +5.0/−3.8 (248), 27 −5.0/−3.1 (616), 24 −4.1/−2.2 (1,021); every other cell of 168 within ±4.1.
- the overall: +0.1 (uneven) and +0.5 points (even); expected +0.7 and +1.2.

The observed numbers fail, the expected ones pass (the true success of the items chosen: worst 3.6 for uneven, −4.8 for even learners), so the targeting holds the line and the answers' noise and the learner model's extras push Track's cells over. Two things add up on Track's speed levels. (1) Selection on a noisy offset: the frontier of a leading item and the person pool pick the speed whose estimated difficulty fits the target, so a speed level is chosen more often when its offset is estimated too low, which makes the high cells too hard on average even for even learners (expected −4.8 at speed 33). (2) The worst observed cells are small and picked for being extreme: Track's 46 speed levels leave several cells of 200–450 items, where one standard error is 2–3 points, and their observed values sit 1–9 points from the expected ones in either direction (speed 32 for even learners: +5.0 observed, −3.8 expected, 248 items). Over all items, observed sits 0.6 points under expected because `trueP` leaves out the day's noise and the switch cost by definition; over all Track items, success − target is −0.4 (uneven) and −0.2 (even).

Levers run: a cap of 1.5 (worst observed +7.4 uneven, −8.7 even) and the long-dimension prior (−8.0, −8.0) do not bring Track's cells within 5 points. Not run: fewer leading items on dimensions of more than 12 levels (the frontier's selection effect is largest there), or judging the line on cells large enough for their noise (≥ 1,000 items). The lasting lever is Track speed's own pooled spread. Cost of leaving it: on some of Track's faster levels, items a few points harder than the target, for a share of players.

## 4. Coverage

97.8 % (uneven) and 98.1 % (even) at the state's centre, rms z 0.84 and 0.82: the intervals are wider than the errors, on the safe side, above the 93–97 % band that tests/node/sim.mjs checks. The same learners without the change: 97.2 % and 98.3 %, so the width was there before; tests/node/sim.mjs's balanced run (60 days, every learner on all eleven exercises) sits inside the band either way (96.8 % without, 96.7 % with). The rating's spread comes from js/engine/estimator.js (its drift with idle days and its floor), which this milestone does not touch; with offsets the uneven learners' rating errors shrink while its spread stays, so their coverage rises a little (97.2 → 97.8 %). Cost of leaving it: rating updates a little larger than the errors call for. Lever (estimator owner): a smaller drift per idle day once pooled data measure it.

Coverage of the true ability at the middle levels (the old meaning of the rating) is 83.6 % for uneven learners (83.0 % before the change) and the same 98.1 % for even ones: with uneven steps the rating describes the levels a player plays, which is what the targeting needs (DECISIONS 18 Nov).

## 5. Shortcut solvers at every dimension level

tests/node/shortcut-levels.test.mjs generates at least 10,000 items of each exercise over every trained combination, runs the exercise's own shortcut solvers on each (the marked export block at the end of its test; Hidden's and Span's solvers from their gen.js) and checks in each cell (solver × level of a dimension, ≥ 200 items) accuracy ≤ the cell's mean chance + 10 points; threshold cues (yes/no items) are fitted per cell with two-fold cross-validation. A cell over the bound by less than two standard errors of its own accuracy is printed as sampling noise.

| Exercise | Result |
|---|---|
| Track, Rotate, Spin, Orient, Span, Hidden, Homing, Reckon | pass at every level (Track: from speed level 15 up, as its own test bounds it; the slowest third reported) |
| Knots | pass; three pull cues at rope level 7 +10.3 over 252 items, within two standard errors |
| Fold | first run: over at one fold ("most symmetric about the first fold line" +19.4, "a hole under every punch" +15.3, 2,016 items). Since 19 Nov (507e597): a scoped exception, structural (a foil symmetric about the crease always lacks a hole under a punch, so both cannot be under 41.7 %), held at 48 %; "most like the others" at three punches and five folds +11.0 and +10.2 → +2.0 and +2.9 |
| Nets | first run: over in four cells (+18.3 to +26.6). Since 19 Nov (a8ec289): every level within chance + 10 (worst +8.8); one scoped combination, 1-4-1 with three faces between, where "farthest along the net" finds the key in at least half the items by structure (held at 55 %) |
| Slice | first run: over in three cells (+12.3 to +16.5). Since 19 Nov (8515626): every other solver within chance + 10 at every level (worst +9.5); "the roundest" and "the fullest" at the first cut level and for joined solids a scoped exception at 36–37 % (chance 25 %), held at 40 % |
| Views, Openings, Missing View, Angles, Hole Punch, Painted Cubes, Form, Central Point | pending: their owners have not exported per-item scores yet |

Each of the three generators passed its own pooled bounds, while the cheap rule paid at one level, mostly the easiest. On 19 Nov (review RV-wave2 #2) the generators were rebalanced where the signal could be removed, and the rest became scoped exceptions with a structural proof or a cap in the exercise's own test and in the check's SCOPED list (DECISIONS 19 Nov, three lines); the KNOWN list is empty. What a scoped cell costs: a player who uses the rule does better at that level than the model expects, which tilts that dimension's offset a little; `config.dims.spread[exId][dimKey]` set small would hold an offset near 0 if pooled data show it.

## 6. Nothing else moves (tests/node/sim.mjs, 100 learners × 60 days, seed 1)

| Run | without dims.js | with dims.js |
|---|---|---|
| train-balanced: target items, success − target | +0.8 | +0.8 |
| … where the pool allowed the target | +1.0 (93.0 %) | +0.9 (91.7 %) |
| … 95 % coverage | 96.8 % (rms z 0.90) | 96.7 % (0.90) |
| train-misspec: target items | +0.2 | +0.2 |
| … coverage | 93.3 % | 93.4 % |
| path: target items | −0.5 | −0.7 |
| … coverage; stages S1/S3/S10 passed | 98.6 %; 95.0/77.0/5.0 % | 98.7 %; 95.0/75.0/4.3 % |
| speed: in time after 10 trials | 78.1 vs 77.7 | 78.2 vs 77.8 |
| record after 60 days, median (balanced) | 451 KB | 475 KB |
| hard checks | all passed | all passed |

The kind lines differ by design: with the change, Train deals leading items (64,548 in the balanced run, 77.0 % right against a 77.1 % target, in place of about as many target items) and fluency items (26,120, half of the deck's easy items: easy items fall from 49,914 to 24,119). sim.mjs counts every fluency item from each exercise's first, and its learners spread over all eleven exercises, while the deadline starts generous and shortens by 0.02 log10 per answer right in time: 83.8 % right in time against 77.0 %; the deadline target itself is checked after each exercise's first 10 in sim-progress (§0). W2-plateau's drill items: 4 against 0 in Train and 76 against 35 in Path. Achievement counts, Spatial Check coverage (99.2 and 99.1 %) and the latest measurement verdicts differ by sampling only (the verdict shares by up to 7 points, about 1.4 standard errors of a difference at 100 learners). The record grows by about 5 % (the offsets' state and each row's `bOff`).

## 7. Reported profiles and the misspecified model

| Profile (100 learners) | cur: within ±0.10, coverage | est: within ±0.10, coverage | est: per-level worst (observed) | at the cap (most) |
|---|---|---|---|---|
| f = 0.9 | 70.7 %, 93.2 % | 85.3 %, 96.3 % | −19.6 (Span's shortest length) | Track speed 63.0 % |
| sparse | 74.4 %, 91.8 % | 86.3 %, 95.4 % | −22.8 (Orient's first shift level) | Track targets 59.3 % |
| corr | 86.7 %, 96.9 % | 93.4 %, 97.1 % | −13.8 (Track speed 21) | Track speed 40.7 % |
| even, misspecified items | 76.5 %, 91.9 % | 75.9 %, 91.3 % | −6.3 (Track speed 26) | Span length 25.0 % |

Steeper or sparser differences than the cap allows (f = 0.9; one dimension 1.6 steps per level) stay partly unmodelled until pooled spreads replace the hand-set cap: that is the cap's purpose (note P1 §4.4, the Addendum), and these profiles gain the most (+12 to +15 points within ±0.10). Item noise (N(0, 0.5²) per item, and an interaction) is not a person's step, so offsets cannot remove it; with them the line moves by −0.6 points and coverage by −0.6 points, inside sampling noise at 100 learners.

## 8. How to rerun

    node tests/node/sim-progress.mjs --learners 200 --profiles uneven --conds est,cur --json out.json
    node tests/node/sim-progress.mjs --learners 200 --profiles even --conds est --set dims.cap=1.5
    node tests/node/sim.mjs --learners 100 --runs train-balanced,train-misspec,path,speed
    PX_SHORTCUT_IDS=fold,nets node tests/node/run.mjs shortcut-levels

Each gated run takes 3–5 minutes per profile and condition; run them one at a time.
