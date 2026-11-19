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

## 2026-11-18 23:00 UTC: engine, screens and tests in (0d220fe); acceptance runs on the final engine
- Done: js/engine/dims.js (offsets, person pool, frontier, leading dimension, fluency items, deck room; hooks start,
  kind, pick and finish at order 10); select.js and modes.js functions (ca3887b); js/ui/frontier.js ("Settings you
  handle" on the exercise page and in How to play; the fluency note); tests/node/dims.test.mjs (78 checks),
  tests/node/shortcut-levels.test.mjs (per dimension level; Hidden from its gen.js solvers, the other 19 exercises
  pending the exports requested at 22:11 UTC), tests/node/sim-progress.mjs with fixtures/learner-progress.mjs,
  tests/e2e/frontier.py (33/0 at 360 x 640, 390 x 844, 1366 x 768); index.html activates my two lines.
- Design changes against note P1 §4.3, each in DECISIONS (088ea87): offsets centred on the player's recent answers
  (coverage 93 % → 98 %); a level per session as the fit's ability term (bias on Span's length +0.16 → +0.03 per
  step); leading items planned with the kind; fluency scope; leading and fluency items from the session after the
  exercise's first fit (so a first session keeps the 80/10/10 mix).
- First 200-learner results (engine before the last change): uneven f = 0.5: 93.8 % of target items within ±0.10
  where the pool reaches the target (gate 94 %; without Track 94.8 %), engine before 1.2 86.5 %, oracle 97.3 %; even:
  96.0 % (before 1.2: 97.3 %); per-level worst cells all on Track's 46 speed levels; coverage 98 %; fluency in time
  within 1 point of its target. Rerunning on the final engine, with the cap lever (1.5) and the reported profiles.
- Next: progress-sim.md, ENGINE.md §19, the "nothing else moves" sim.mjs comparison (100 learners, with and without
  dims.js), the final report.

## 2026-11-19 00:01 UTC: acceptance results, the per-level shortcut check, ENGINE.md §19
- Final runs (200 learners × 90 days per gated profile, seed 1, the engine identical to the build branch's): every
  line, number, lever and cost in docs/dev/v1.2/progress-sim.md. Uneven 93.8 % within ±0.10 (fails by 0.2, Track;
  86.5 % before), even 96.0 % (97.3 % before); per-level worst observed −6.6 on Track's speed levels for both
  (expected 3.6 and −4.8: pass); overall +0.1/+0.5; coverage 97.8/98.1 % (above sim.mjs's 93–97 % band, as before
  the change: 97.2/98.3 %); fluency in time 78.1 vs 77.2 and 77.1. Levers run: cap 1.5 (94.3 % pass, Track's levels
  worse), longPrior (no help). sim.mjs with and without dims.js: same targeting, coverage and hard checks; record +5 %.
- tests/node/shortcut-levels.test.mjs on 12 exercises (e6a8ee3): 9 pass at every level; Fold, Nets and Slice exceed
  chance + 10 at single levels (KNOWN list, requests.md 18 Nov 23:47 UTC); 8 exercises without exports (owners).
- ENGINE.md §19 written (before §20). Open: the lead's call on the cap (0.75 kept, recommended) and on the KNOWN
  cells; W2-core's lastRated and Speed reference time (requests 22:11 UTC).

## 2026-11-19 02:03 UTC: the lead's task from review RV-wave2 #2 (Nets, Slice, Fold)
- Nets a8ec289: 'opposite' by class weights per shape × faces-between cell (grid search), concave corners a tenth of
  the first squares-carried level's yes pairs, long rows rarer at the 1-4-1 cube level; worst level +8.8; scoped:
  1-4-1 with three faces between (structural, held at 55 %).
- Slice 8515626: larger foil pool, heavier weights; others within +9.5; scoped: "the roundest"/"the fullest" at the
  first cut level and for joined solids (36–37 %, held at 40 %).
- Fold 507e597: half a rank for key ties at the extremes ("most like the others" +11.0 → +2.0); scoped: one fold
  (structural, held at 48 %). shortcut-levels 37/0 on 12 exercises; KNOWN empty; no version bumps.

## 2026-11-19 11:40 UTC: leading and fluency items off the scoped shortcut cells (the lead's task)
- One list in the engine, `E.dims.scoped` (js/engine/dims.js): Nets, Slice, Fold, Painted Cubes (five painted sides,
  named by the seed), Homing's fixed-angle routes, Cube Match, Pattern Memory; each entry with its DECISIONS line.
  The lead's frontier and item and the fluent zone leave out cells named by params; MODES.train.next asks
  E.dims.seedFor for a seed outside a seed-named cell before the step is made. The per-level check, and the Nets,
  Slice and Fold tests, read their cells and caps from it.
- dims 88/0 (with the fixture Fold: 0 of 323 leading and 0 of 189 fluency items at one fold, 26 target items there;
  12 and 151 without the entry); shortcut-levels 58/0 on 18 exercises; nets, slice, fold tests pass.
- sim-progress (200 learners × 90 days, seed 1): the new gate passes (0 leading or fluency items in scoped cells of
  about 300,000 per profile); the other lines unchanged within noise.
