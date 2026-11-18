# W3-game: PLAN milestone 5, the game layer (option B)

Updated 2026-11-18 23:48 UTC.

## Done (committed)
- Engine: js/engine/game.js (grades, Reach with its high mark, the Atlas with the guessing rule and firsts, within reach, the fresh-start gap, the finish hook `res.game`, the container's repair and two-tab merge, events grade/first/climb/note), js/engine/climb.js (mode 'climb'), js/engine/fieldnotes.js, Daily v2 in js/engine/daily.js (epochs; the ramp and points from 19 Nov 2026; history; archive), Summit in js/engine/achievements.js.
- Screens through the hooks: js/ui/game.js (summary panel, Today slots, Progress panel, Settings section, item:reveal handler, effects, sounds), js/ui/climb.js (route 'climb'), js/ui/atlas.js (route 'atlas'), css/game.css; index.html (my lines).
- Tests: tests/node/game.test.mjs (298 checks: the rules code can check, a simulated first week, the stimulus guard in CSS); tests/e2e/game.py (1366 x 768, 390 x 844, 360 x 640; screenshots in tests/e2e/out/game/).
- Docs: ENGINE.md §24; DECISIONS lines (one per mechanic with the harm it avoids); requests.md lines.

## Waiting on others (requests.md)
- W2-core: engine.test.mjs counts 21 → 22 (Summit); engine-v12.test.mjs needs a test epoch for 'quickx'; flows.py's Daily share-line pattern; record.js mergeGame to delegate to E.game.merge; play.js: call item:reveal (tick, ring), the Daily end's points, the needle sweep call sites.

## Next
- Pooled-export summary of the game layer without days (optional; game stays out of the pooled export now).
- A share kind of its own for the Climb and grades in share.js (lead: the file has no wave-2 owner).

## Open problems
- None blocking. Climb sounds follow CONTRACT M (they need the global Sound switch, off by default); the Climb's intro offers "Turn sound on".
