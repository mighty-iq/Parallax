# W2-progress: progress log

Builder for PLAN milestone 7, faster progress on every dimension.
Owns: js/engine/dims.js, js/ui/frontier.js, tests/node/dims.test.mjs, tests/node/shortcut-levels.test.mjs,
tests/node/sim-progress.mjs, tests/node/fixtures/learner-progress.mjs, docs/dev/v1.2/progress-sim.md, ENGINE.md §19;
in js/engine/select.js pick, fixed, params, note, recent, residual, weak, freshness, hamming and new functions; in
js/engine/modes.js kindFor, early, earlyKind, oneStep, both, earlyStretch, MODES.train.next, MODES.train.answer,
MODES.path.next, the rating lines of MODES.path.answer and MODES.free.next (CONTRACT-v1.2, wave 2); this log; my
lines in docs/dev/DECISIONS.md and docs/dev/v1.2/requests.md.

## 2026-11-18 21:05 UTC: start (restarted once by the session server at about 21:00 UTC; nothing was lost)
- Read: CLAUDE.md; PLAN.md milestone 7; CONTRACT-v1.2.md rules and Wave 2 (Q's W2-progress API, M's `rec.ex[id].dims`
  and `rec.timed`, the hooks, conflicts 2 and 10 as accepted); note P1 §4, §6 and Addendum with its spike
  (docs/research/v1.2/spikes/P1/dims.mjs); ENGINE.md; js/engine/select.js, modes.js, model.js, estimator.js; the hook
  commit a84cc94; tests/node/sim.mjs and fixtures.
- Intent (the change spans several files):
  1. select.pick takes `opts.pool` (a pool entry with person-specific b, sorted for the windowed search);
     select.fixed takes an optional pool. Without a pool nothing changes.
  2. js/engine/dims.js (config block 'dims'): the state in `rec.ex[id].dims` (or `.small.dims`), the session-end ridge
     fit (last 400 rated untimed answers, from 100, prior 0.5 × |step|, cap ±0.75 logit at the top level, cap flags
     per dimension), the person pool, b, frontier, the leading-dimension rotation, `room(plan)` for conflict 10, and
     fluency items; hooks: kind (10), pick (10), finish (10).
     The fit's ability term per answer comes from the row itself: the logged prediction pp and offset bOff give
     logit((pp − g)/(1 − g − lapse)) + bOff, the selector's belief at that answer without the old offsets.
  3. modes.js: kindFor resets the deck's change count; MODES.train.next counts target items whose kind changed
     (lead, fluency, drill) and finishes fluency steps (timed difficulty, prediction, target); MODES.train.answer rates
     a fluency answer on the timed rating only and moves the Speed deadline (out.rated false); MODES.path.next gives
     rechecks the person pool; MODES.free.next gives fixed settings the person pool.
  4. Tests: tests/node/dims.test.mjs (unit), tests/node/shortcut-levels.test.mjs (per dimension level).
  5. tests/node/sim-progress.mjs with tests/node/fixtures/learner-progress.mjs; results in docs/dev/v1.2/progress-sim.md.
  6. js/ui/frontier.js on PX.ui.hooks (exercise:lines, item:notes) once W2-core's hooks.js lands.
- Development: dims.js and its tests are written in a mirror of the working tree (/tmp/w2p/tree) until they pass, since
  the node runner loads js/engine/dims.js for every builder as soon as it exists; the edits to select.js and modes.js go
  straight into the shared tree and do nothing until dims.js is there.
