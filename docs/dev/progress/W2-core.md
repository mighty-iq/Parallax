# W2-core progress (shared hooks of wave 2)

Owns: see docs/dev/CONTRACT-v1.2.md, "Wave 2", file ownership. Requests: docs/dev/v1.2/requests.md.

## 2026-11-18 20:29 UTC: Phase A (documents only)
- Read: CLAUDE.md; PLAN.md milestones 3–7 and "Phase 2 organisation"; CONTRACT-v1.2.md (wave 1); ARCHITECTURE.md; ENGINE.md;
  notes P1 §2.4, §3.9–3.10, §4.3–4.4, §6 and Addendum, T1 §3–§5, M1 §4.1, §7, §8 and Addendum, G1 §2; js/core/store.js,
  js/ex/registry.js, js/engine/{model,modes,select,schedule,assess,estimator,merge,rebase}.js, the session and summary parts
  of js/ui/play.js, js/ui/home.js, tests/node/sim.mjs and fixtures; W2-measure's trend.js header and decisions.
- Wrote the "Wave 2" section of docs/dev/CONTRACT-v1.2.md: builders and order, rules, file ownership down to functions,
  who does which plan item, interfaces M (record format 4, every new field, milestone 5's reserved), N (trial-row columns),
  O (events table), P (plateau events), Q (engine modules and hook points), R (player and screen hooks), S (definitions),
  T (exports), U (tests per interface), V (index and load order), the done criteria (the plan's acceptance) and 12
  conflicts between the plan and the code with recommendations.
- DECISIONS: four lines (format 4, trial columns, events table, hooks), commit 4f8fb66.
- Found: the node suite's load check fails on every run until js/engine/trend.js is in tests/node/run.mjs's MANIFEST
  (W2-measure's 20:00 UTC request); a one-line test-runner change, first in Phase B unless the lead wants it now.

## Next (Phase B, after the lead's go)
1. run.mjs: trend.js in the MANIFEST and a pending list for the new engine files; index.html PENDING lines (V).
2. Record format 4 (store VERSION, js/engine/record.js, the upgrade hook, session kind and ext, E.record.check) with
   tests/node/record4.test.mjs and tests/node/fixtures/records.mjs.
3. Trial columns 13–18 (E.log, the store's repair, addTrial, CSV 26 columns, log.js texts) and E.events with tests.
4. Engine hooks (modes, schedule, merge, E.defaults), then js/ui/hooks.js and the call sites in play.js, home.js and the
   screens, with hooks.test.mjs and play.py run_hooks.
5. Requests about every hour.

## Open
- The lead's call on conflicts 1–12 (interfaces M–V already apply 3–7 and 12).
