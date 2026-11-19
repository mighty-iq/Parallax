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

## 2026-11-18 22:02 UTC: Phase B (the lead's go; the 12 conflicts accepted, 27390c1)
- Engine hooks (a84cc94): modes.hook at start, kind, pick, answer, finish; schedule exclude and setStage; merge.register;
  E.defaults; tests/node/engine-w2.test.mjs. W2-progress builds on them.
- PX.ui.hooks (7ab13ab), then place/screen (0845f20); tests/node/hooks.test.mjs (35 checks, fake DOM).
- Record format 4 (4dd8b51): js/engine/record.js (plateau, bets, measure, game; upgrade from formats 1–3), js/engine/events.js,
  trial columns 14–19, sessions' kind and ext, CSV 26 columns, pooled formatVersion 2 with store.header; index.html entries
  and PENDING lines; tests record4 (fixtures of formats 1–3), events, engine-w2 rows; older tests moved to format 4.
  Browser smoke: a stored format-3 record loads as 4 in memory (form0 'A', pv stamped), no console errors.
- Call sites (0845f20): session:start, item:before, item:notes, summary:panels (one ranked invite), today:slots,
  today:session, exercise:lines (page, How to play), settings/lab/progress/about; amode and orient reach the row; events
  showme, card, wtg, suggest. play.py run_hooks 20/0 incl. the phone check of the top-corner Pause copy; screens.py reads
  the 26-column CSV.
- Registry (e75a4c9): format, layers, atlas validated; conflict 12 (the produce variant out of the range and refChance).
- Wiring for W2-bets and W2-plateau (8483c63): PENDING layer blocks, pureFiles loads layers.js; engine-w2 hook-order test
  compares its own ids.
- Fresh-player round 3 (player items 1–8 and the trial shift, from the lead): see DECISIONS; play.py run_round3.
- Requests answered: W2-plateau (manifest, test ids), W1-band-B (Openings phrase), W2-measure (test edits in its switch
  commit: yes), W2-bets (layer files); filed: W1-band-B (Form's worked-example caption numbers).

## 2026-11-18 22:38 UTC: after the round-3 fixes (stopped on the lead's word, usage)
- Committed since: 4355d31 (round 3, play.py 184/0), f64d64b (DECISIONS), 287101e (docs), df79add (window.PX_HOOKS_MUTE),
  65d7a95 (Design A texts; flows, clock, twotabs, screens follow the builders' hooks and Design A), 19a9bc2 (milestone 7
  wiring: lastRated, untimedRt, Speed's fluent pool), 6a98b26 (record4 test vs owners' checks).
- Browser: play.py 184/0, twotabs 11/0, clock repro 32/0, screens 387/0 expected after the 'trend' fix (372/2 before it),
  flows 73/0 (the check button is matched by its route prefix: Today's slot opens play?mode=check&kind=…). fit.py 221/1 on others' items (patfold 844 × 390; the check's
  cubematch with W2-measure's timer at 360 × 640).
- Open: none of the requests to W2-core; Form's worked-example numbering is with W1-band-B.

## 2026-11-19 10:41 UTC: the first session (option A) and wave 3's shared support
- First run (72990c2, DECISIONS 1da97e3): the tutorial is Spin alone; its end screen offers Baseline 1 (time from
  W2-measure's minutesOf) with Later, and both open Train with Spin (route param `baseline`; the hook ctx's new `params`;
  js/ui/measure.js's two B1 hooks read it, noted in requests.md). Guard: play.py `run_firstrun` at 390 × 844 (both
  answers, every hook on); flows.py tour 12/0; shell.py 274/0. Screenshots out/play/firstrun_*.png looked at.
- Wave 3 (ab8bf2b; CONTRACT-v1.2 W1–W4): lettered options, the test look's tokens, test-range tags with Free play's
  "test range only" and rec.ex[id].tag, figure sets for Painted Cubes (W3-bandA's request). wave3.test.mjs 61/0;
  play.py run_wave3; flows.py and play.py follow W2-measure's new probe cards.

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
