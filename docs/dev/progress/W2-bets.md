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
