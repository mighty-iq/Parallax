# W2-bets: progress log

Builder for PLAN milestone 4 (transfer bets: tagged, logged and tested). Owns (CONTRACT-v1.2, wave 2): js/engine/bets.js,
js/ui/bets.js, css/bets.css, tests/node/bets.test.mjs, tests/node/layers-*.test.mjs, tests/e2e/bets.py,
js/ex/<id>/layers.js and layers-view.js; the `bet`, `format` and `layers` fields of every training exercise's
definition; the marked section of docs/guide/guide.html; ENGINE.md §22; its DECISIONS lines and requests.

## 2026-11-18 21:55 UTC: step 1 (tags, lines, logging, the crossover)
- Done: `bet` and `format` on all 20 training exercises (b054c77); js/engine/bets.js (INFO with the nine bet lines,
  grades and evidence; BETS_VERSION 1; formats; the crossover with the simulated draw, periods of 28 days and
  8 sessions, cycles, opting out; dose rules of rounds and bridge sets; recording; the container's check and
  merge; dose summaries; the betsInfo and formats headers; events compare, bridge, offscreen, assign, expect,
  join, background); js/ui/bets.js (bet line on the exercise page and How to play, About and Lab sections,
  Settings "Join the bet trials", the expectation rating on the summary, events and dose CSVs); css/bets.css;
  the guide's marked page "Test the bets with us"; ENGINE.md §22; DECISIONS (9c10a8d).
- Tests: tests/node/bets.test.mjs 388 checks (tags, words, formats, the draw against measure-cross.mjs, balance
  over 20,000 players, periods and assign events, joining, the pick hook, dose rules, recording, the container,
  dose, the export header, the guide's words). A browser smoke test of the four screens at 1366 × 768 and
  360 × 640: no console problems, no horizontal scroll.
- Requests: W2-core, record4.test.mjs's two assertions about the 'bets' container (owner check and merge now
  registered); FYI on the 20 gen.js lines.
- Next: step 2, the layers (comparison rounds first, then off-screen challenges, calibration detail, bridge
  sets, draw-the-answer variants), each with its solver-checked items and shortcut tests; then tests/e2e/bets.py.

## 2026-11-18 22:52 UTC: step 2 (the layers), the parts built in this wave
- Comparison rounds (E.bets.round, applySeed; the round in the player's card; apply items and their note): Central
  Point (97ece52), Spin (513df64), Nets (d43692b), Orient (8c27109). Each principle proved on 10,000 items, rounds
  valid, shortcut solvers within chance + 10 (tests/node/layers-*.test.mjs; tests/node/layers-lib.mjs).
- Detailed calibration feedback (027563e): Homing and Central Point declare layers.calib; the note comes from
  js/ui/bets.js; Reckon waits for its view's switch (request to W1-fixes).
- Bridge set (1886643): Central Point's Meeting point, 10,000 items validated apart; Slice's set waits for v1.3.
- Off-screen challenges (887d32a): Slice, Orient, Knots, Central Point (new) and Fold, Nets, Views (learn.js).
- Deferred to v1.3 (DECISIONS 7f02b25): draw-the-answer variants (a per-item custom input in the player; request to
  W2-core, queued), rounds for Fold, Views, Slice, Rotate and Knots, Slice's bridge set.
- Texts: About, the Lab, Settings and the guide state the add-ons of this build, checked against the code (48587a4).
- Checks: node bets 393, layers-* 161, record4, pooled, events, engine-w2, hooks, core green; tests/e2e/bets.py
  screens 81, rounds (Central Point, Spin) 90, drawings 26, bridge 48, all passing at 360 x 640, 390 x 844 and
  1366 x 768; sim.mjs train runs as in ENGINE §18 (balanced 77.7 vs 77.0 %); its guard false comes from plateau
  (FYI to W2-plateau).
