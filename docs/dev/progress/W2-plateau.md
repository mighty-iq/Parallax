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

## Next
1. The remaining runs; docs/dev/v1.2/plateau-sim.md; ENGINE.md §20; DECISIONS lines.
2. Move the files in once tests/node/run.mjs lists plateau.js; activate index.html lines; node suite; sim.mjs.
3. tests/e2e/plateau.py once the summary and Today call sites exist.
