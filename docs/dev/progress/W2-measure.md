# W2-measure: progress log

Builder for PLAN milestone 6's engine simulation (and milestone 4's crossover power) before anything is built.
Owns: js/engine/trend.js, tests/node/trend.test.mjs, tests/node/measure-sim.mjs, docs/dev/v1.2/measure-sim.md,
this log, and its own lines in docs/dev/DECISIONS.md and docs/dev/v1.2/requests.md.

## 2026-11-18 19:44 UTC: start
- Read: PLAN.md (decisions 2–3, milestones 4 and 6), note M1 §4.1, §4.4, §5, §7, §8 and the Addendum, note T1 §4–§5.4,
  the M1 spike (docs/research/v1.2/spikes/M1/power.mjs), ENGINE.md §10, js/engine/assess.js, model.js config,
  tests/node/run.mjs, sim.mjs and fixtures (read-only).
- Plan:
  1. js/engine/trend.js: the trend model (GLS over all occasions; items linearised at the fitted block ability and
     iterated, so short blocks need no weak per-block prior), the population familiarity prior (plateau 0.65 SD,
     λ 16 items, tail 0.045 SD per 16 items), occasion state 0.5 SD (half shared), the run-in restart after a gap of
     more than 56 days (45 % of familiarity lost), the meter and milestone verdicts; all parameters in one config.
  2. tests/node/trend.test.mjs: GLS against a dense solve, batch against sequential, the break rule, milestones.
  3. tests/node/measure-sim.mjs: the probe learner model of M1 §8.1 with the Addendum; Design A (classic four-probe
     composite for the cross-check with the spike; the ladder with rotation within rungs; the opt-in measurement
     week); the crossover of milestone 4's layers on the near probe's strands.
  4. docs/dev/v1.2/measure-sim.md with every number and its settings.
- Known snag: tests/node/run.mjs's load check fails any js/engine/*.js missing from its MANIFEST (W1-core's file),
  so trend.js lands together with a request line for the MANIFEST.

## 2026-11-18 20:14 UTC: trend model done, battery running
- Done: js/engine/trend.js (603f0c2, e4ab154) with tests/node/trend.test.mjs (52 checks, 0.2 s); the simulation
  (tests/node/measure-sim.mjs, measure-lib.mjs, measure-cross.mjs). Request filed for the MANIFEST line (20:00 UTC).
- Found and fixed in the trend model: (1) plain linearised iteration can cycle when a block sits on the guessing floor
  and a flat level prior lets the level drift (a control level of −82 logits): now Fisher scoring with step halving on
  the joint log posterior, and a weak level prior (3 SD); (2) with a flat gain prior a one-probe rung's gain runs off
  on early blocks (separation) and the next items are aimed at the runaway: weak gain prior N(0, 5²) per rung; the
  simulation also keeps item targets within ±3 population SD, as the app's item pool does.
- Cross-check with the M1 spike passes (its block summaries reproduce its detectable gains within 3 %).
- Results so far: classic and ladder designs pass the false-rate and coverage lines at central values; the block mix
  barely moves the composite; the near rung needs a bigger baseline (chosen mix N14). Remaining: misspecified runs on
  N14, sessions a week, breaks, the crossover; then docs/dev/v1.2/measure-sim.md and DECISIONS lines.

## 2026-11-18 20:34 UTC: simulation phase done
- Results in docs/dev/v1.2/measure-sim.md (every number from a run listed in its §11; 1,000 learners per arm, seed 1,
  N14 also seeds 2 and 3; crossover 1,500 players per layer and effect). DECISIONS: six W2-measure lines (f10e92d).
- Milestone 6 acceptance on the chosen mix N14 (central): false "likely gain" 1.9 / 3.2 / 3.2 % at days 14 / 28 / 56,
  ever 5.9 % (seeds 2, 3: 5.5, 5.3 %); misspecified familiarity ≤ 6.6 % at every report; coverage 93.6–95.3 % (one cell
  of seed 2 at 91.8 %); detectable gain 1.64 / 1.27 SD_comp at weeks 4 / 8 (optimistic 1.26 / 0.97); near rung 1.53 /
  1.27 at weeks 4 / 6; rotation costs nothing at equal block length.
- Milestone 4: comparison rounds and bridge sets detect a 0.29 SD strand effect with 200 players (80 % power); the draw
  is balanced (49.8–50.1 % per unit over 99,844 draws).
- Late fix: items are [b, g, ok, rtMs?, a?] so the rows the wave-2 contract stores in rec.assess pass straight in
  (a stored response time was being read as the item slope); results checked unchanged (classic-opt and the crossover).
- Open for the build: the MANIFEST line (requested 20:00 UTC; W2-core inherits it), index.html, ENGINE.md §21.

## 2026-11-18 22:15 UTC: build phase, first half
- Engine: trend.js takes probe versions ('id@v', own probe; folded once into the composite and its rung) and gives
  readouts in probe points (7347b25). assess.js in two steps: d4f77fb (additive: blocks, the week, items/pv/late on
  every entry, nextMeasure, the meter, verdicts stored once per milestone, the measure container's repair and merge,
  the measure and background events, session kinds) and 0fe46af (the switch: full checks 16 + 5 + … + 5 = 46 items,
  25 until Other Way Round lands; easy-first only on first contact; the first form drawn per record; no B3; the
  4-weekly check; Lab crossover checks; report() status 'trend'). testAssess and sim.mjs's Spatial Check part follow
  (W2-core's yes; review asked in requests.md). tests/node/measure.test.mjs: 105 checks.
- App: js/ui/measure.js + css/measure.css (725abae): the shared runner and every hook of CONTRACT R that milestone 6
  names; js/ui/check.js plays through the runner. tests/e2e/check.py: 35/0 at 1366 x 768, 390 x 844 and 360 x 640
  (screenshots looked at: Today's slot, the B1 card, the summary meter, Progress, the Lab ladder). overlap.py 58/0.
- Reserved formats: tests/node/formats.test.mjs (17 ids) and the probes' format ids (a85066b).
- Incident: a sync-index run with an unknown argument activated W2-bets' centralpoint/layers.js beside trend.js at
  21:56 UTC; 8483c63 committed it; fixed in 3fea396 and reported in requests.md.
- Running: tests/node/sim.mjs --learners 200 (Design A in the regression sim; first four runs: false "likely gain"
  0.5–1.0 % without transfer, hard checks pass); tests/e2e/play.py with measure.js active (W2-core's run_hooks may
  count two 'check' replacements: request to follow if so).
- Next: Other Way Round (six strands), Motion Graphs, the probe upgrades as new versions, Balance and the Lab checks,
  ENGINE.md §21.
