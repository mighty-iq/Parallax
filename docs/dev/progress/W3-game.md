# W3-game: PLAN milestone 5, the game layer (option B)

Updated 2026-11-19 01:00 UTC.

## Done (committed)
- Engine: js/engine/game.js (grades, Reach with its high mark, the Atlas with the guessing rule and firsts, within reach, the fresh-start gap, pending firsts for block ends, the start hook that seeds an older record's Atlas, the finish hook `res.game`, the container's repair and two-tab merge, events grade/first/climb/note), js/engine/climb.js (mode 'climb', each answer written through), js/engine/fieldnotes.js, Daily v2 in js/engine/daily.js (epochs with frozen pools; the ramp and points from 19 Nov 2026; history; archive), Summit in js/engine/achievements.js, and Top tenth without the Daily's rows.
- Screens through the hooks: js/ui/game.js (summary panel, block-end firsts, Today slots, Progress panel, exercise-page lines, Settings section, item:reveal tick and ring, the needle sweep, effects, sounds), js/ui/climb.js (route 'climb', with item:reveal and playtest taps), js/ui/atlas.js (route 'atlas'), css/game.css; index.html (my lines).
- W2-core added the call sites (eef57f7: item:reveal, the sweep, the Daily's points on its end screen and Today, record.js's merge handing over, PACED without the Daily); the pinned node tests (engine, engine-v12, record4) match the design (30ba958, at the lead's word).
- Tests: tests/node/game.test.mjs (119 checks: the rules code can check, a simulated first week, the stimulus guard in CSS, pending firsts, Top tenth); tests/e2e/game.py at 1366 x 768, 390 x 844 and 360 x 640 (121/0 on the last full run; screenshots in tests/e2e/out/game/, looked at).
- sim.mjs, 200 learners, with and without the game layer: all hard checks pass; nothing else moved beyond the noise of the Daily's new items (ENGINE.md §24).
- Node: the 44 lighter test files 4,734/0 on the latest tree (00:59 UTC); the 17 heavy exercise files passed in the full run with the game engine loaded (23:38–00:11 UTC), and no generator or timing code changed since. The single-file build (to /tmp) opens the Climb, the Atlas, Progress and Today with no error.
- Docs: ENGINE.md §24; DECISIONS lines (one per mechanic with the harm it avoids, and Top tenth); requests.md lines (all answered).

## Waiting on others
- The lead: share.js has no wave-2 owner (a Climb and a grade card kind of their own would beat the session kind with a label); library.js's modeName shows 'Climb' in the Log ('Weekly Climb' would read better).

## Next
- Optional: a pooled-export summary of the game layer without days (it stays out of the pooled export now).

## Open problems
- None blocking. Climb sounds follow CONTRACT M (they need the global Sound switch, off by default); the Climb's intro offers "Turn sound on".
