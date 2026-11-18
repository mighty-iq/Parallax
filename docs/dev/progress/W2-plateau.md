# W2-plateau progress (PLAN milestone 3: plateau-breaking)

Owns (CONTRACT-v1.2, wave 2): js/engine/plateau.js, js/ui/plateau.js, css/plateau.css, tests/node/plateau.test.mjs,
tests/node/sim-plateau.mjs, tests/node/fixtures/learner-plateau.mjs, tests/e2e/plateau.py, docs/dev/v1.2/plateau-sim.md,
ENGINE.md §20, my DECISIONS lines. Requests: docs/dev/v1.2/requests.md.

## 2026-11-18 21:22 UTC
- Done (kept outside the working copy until W2-core's pending list in tests/node/run.mjs is committed, so the load
  check of other builders' runs never meets an unlisted engine file; request of 20:47 UTC):
  - js/engine/plateau.js: the detector (note P1 §2.4: W 640, z 1.645, δ 0.15, priors, per-session over-dispersion,
    preconditions, the response-time channel, the ceiling), the eight signals and the decision table (rows 1–4 first,
    a logged draw among rows 5–8, changes tried since the last "clearly up" skipped), the events (CONTRACT P), trial
    periods with verdicts, the hooks (modes start, kind, pick, finish; schedule exclude), repair, merge, rebase
    converter, events source.
  - tests/node/plateau.test.mjs: 162 checks (slope coverage, firing, every precondition, switches, the RT channel,
    the table and its draw, signals, the finish hook, trials and verdicts, every change's hook, repair, merge, levels,
    export rows, the Today card).
  - tests/node/sim-plateau.mjs with tests/node/fixtures/learner-plateau.mjs: the acceptance runs (22 runs queued).
  - js/ui/plateau.js and css/plateau.css: summary card, Today card and line, the other method's card, exercise line,
    Progress history (waiting for W2-core's screen call sites).
- First results (400 learners each): false alarms at 0.25 logit per 100 answers 1.5 % (Train) and 1.3 % (Path) by
  answer 1,000; no flag before answer 640; no structural check failed.

## 2026-11-18 22:26 UTC
- In the repository: 7474995 (engine, UI, CSS, unit tests 218 checks, simulation, browser test, index lines active; the
  index.html commit carries only my three lines, W2-measure's pending activation stays theirs), 17965fa (Today's card
  shorter; browser test fixes). tests/e2e/plateau.py: 28 passed at 1366 x 768 and 360 x 640 (summary card with the
  invite, the event in the record, Today's card with its progress, Progress history, the Fold page's line, no errors).
- Requests: both answered (run.mjs pending list; engine-w2's hook-order test filtered to its own ids).
- Acceptance so far (docs/dev/v1.2/plateau-sim.md in progress): false alarms by answer 1,000 at 0.25: 1.5 % Train,
  1.3 % Path; at 0.20: 4.8 % Train, 4.5 % Path; plateaus caught within 600 / 800 answers (learners observed that
  long): Train 67.5 / 86.9 %, Path 69.4 / 87.9 % (the 800 line fails by 2-3 points); "clearly up" for non-responders
  0.3 % (Train), 2.6 % (Path); no flag before 640 answers, inside a trial, across a gap > 14 days or on < 8 sessions or
  days (independent scan). Levers on the 800 line (Train): φ shrinkage 89.5 % (false alarms at 0.20: 5.0 %); a
  560-answer window 89.0 % (7.5 %); z 1.28 93.1 % (pending).

## 2026-11-18 23:07 UTC: milestone 3 built; one acceptance line short
- Acceptance (docs/dev/v1.2/plateau-sim.md; ENGINE.md §20): false alarms by answer 1,000 at 0.25: 1.5 % Train, 1.3 % Path
  (misspecified items 2.5 %); at 0.20: 4.8 %, 4.5 %; caught within 600 answers: 67.5 %, 69.4 %; within 800: 86.9 %,
  87.9 % (plan: 90 %; yes/no Nets 70-78 %, Span and Views 96 %); no flag before 640 answers, inside a trial, across a
  gap > 14 days (break runs: widest 13.8 days), at the ceiling (0 of 120 learners past the top); "clearly up" for
  non-responders 0.3 % / 2.6 %; responders 12 % (one three-session trial); the 'faster' channel 98 of 100; the draw
  uniform (chi2 2.7 / 7.3); sim.mjs with and without plateau.js: success and coverage equal to 0.01 / 0.03 points.
- Levers on the 800 line, left to the lead (DECISIONS): phiPrior df 20 89.5 % (false alarms at 0.20 5.0 %); W 560
  89.0 % (7.5 %); z 1.28 93.1 % (11.0 %).
- Commits since: plateau-sim.md, ENGINE.md §20, DECISIONS (conventions; rule kept), the drill within E.dims.room
  (W2-progress's request), whole-ms event times, tests/e2e/plateau.py muting other builders' screen hooks (30 passed),
  requests answered (W2-bets: the guard's conversion comes from sim.mjs's unstamped records; W2-progress: done).
- Unit tests: tests/node/plateau.test.mjs 223 checks (default suite, about 3 s).

## Next
- The lead's call on the 800-answer line (keep, or phiPrior df 20).
- Rerun the two main acceptance runs on the integrated engine (with dims.js's lead and fluency items) when CPU allows:
  `nice -n 15 node tests/node/sim-plateau.mjs --cond plateau --mode train --n 200` and `--cond linear-0.20`.
