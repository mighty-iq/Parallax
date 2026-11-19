# W3-game: PLAN milestone 5, the game layer (option B)

Updated 2026-11-19 00:03 UTC.

## Done (committed)
- Engine: js/engine/game.js (grades, Reach with its high mark, the Atlas with the guessing rule and firsts, within reach, the fresh-start gap, the finish hook `res.game`, the container's repair and two-tab merge, events grade/first/climb/note), js/engine/climb.js (mode 'climb', each answer written through), js/engine/fieldnotes.js, Daily v2 in js/engine/daily.js (epochs with frozen pools; the ramp and points from 19 Nov 2026; history; archive), Summit in js/engine/achievements.js.
- Screens through the hooks: js/ui/game.js (summary panel, Today slots, Progress panel, exercise-page lines, Settings section, item:reveal handler, effects, sounds, the needle sweep for play.js's bars), js/ui/climb.js (route 'climb'), js/ui/atlas.js (route 'atlas'), css/game.css; index.html (my lines).
- Tests: tests/node/game.test.mjs (299 checks: the rules code can check, a simulated first week, the stimulus guard in CSS); tests/e2e/game.py at 1366 x 768, 390 x 844 and 360 x 640 (screenshots in tests/e2e/out/game/, looked at).
- Docs: ENGINE.md §24; DECISIONS lines (one per mechanic with the harm it avoids); requests.md lines.
- Node suite with the game layer (full run before the firsts fix): 10 of 6,564 checks failed in 4 files: engine.test.mjs 4 (the achievement count 21 → 22), engine-v12.test.mjs 1 (the fixture 'quickx' outside the frozen Daily pool), record4.test.mjs 4 → 1 after the firsts fix (its own check registration on 'game'), bets.test.mjs 1 (the guide's add-ons line; not from the game layer). All four have requests.

## Waiting on others (requests.md)
- W2-core: engine.test.mjs counts 21 → 22 (Summit); engine-v12.test.mjs needs a test epoch for 'quickx'; record4.test.mjs's own check on 'game'; flows.py's Daily share-line pattern; record.js mergeGame to delegate to E.game.merge; play.js: call item:reveal (tick, ring), the Daily end's points, the needle sweep call sites; PACED without the Daily (untimed challenge points).
- The lead: share.js has no wave-2 owner (a Climb and a grade card kind of their own would beat the session kind with a label); library.js's modeName shows 'Climb' (the Log could say 'Weekly Climb').

## Next
- sim.mjs with 200 learners against a baseline without the game layer (running).
- Optional: a pooled-export summary of the game layer without days (it stays out of the pooled export now).
