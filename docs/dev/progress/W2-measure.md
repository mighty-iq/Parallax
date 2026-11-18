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
