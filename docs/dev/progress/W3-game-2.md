# W3-game-2: the game layer after W3-game (requests of 19 Nov, O14, card kinds, the Log's label)

Updated 2026-11-19 16:04 UTC. Files: those of W3-game (docs/dev/progress/W3-game.md) plus js/ui/share.js and js/ui/log.js.

## Done (committed)
- Item 1, the requests of 19 Nov to W3-game (8f5c1a1; DECISIONS c27bb16; answers in requests.md 4c79777): the grade stamp's "For example:" line; Atlas texts read def.ignores; firsts saved under another version of an exercise out of the lists; node test that every Atlas cell is dealt and no Atlas pair holds an ignored dim. The reveal FYI (11:42) and W2-core's grade line (12:20) reviewed and kept.
- Item 2, O14 (3e5614a; DECISIONS b6c3013): Daily results keep `seeds` beside `outcomes`; a part-way attempt goes on by seed on any device; the store's upgrade hook gives results of 1.1 and the test builds the seeds of their date where their outcomes cover all eight items. tests/node/daily.test.mjs (55 checks, 11 fail with resume by position) on saves made with 1.1's and the test builds' own engines (tests/node/fixtures/daily-saves.mjs); game.py `resume` on a phone.
- Item 3 (cc357df; DECISIONS bb02fe7): card kinds grade, climb, reach, atlas, startnow in js/ui/share.js with pictures of their own (ink and green, never the accent); the Log's "Weekly Climb".
- ENGINE.md §24 follows all three.
- Review RV-code-1.2 (snapshot a434e64), my files: M1 (9111e85): reading the rows into the Atlas again joins a fresh tally with the stored cells instead of adding it (reproduced first: Fold 193 → 386); M2, the Daily's part (69532ad, e2e 49cdf21): each answer writes the scored attempt through, so a discarded tab's Daily goes on by seed; L1: epoch 1 documented, no code (DECISIONS bdf8ce7: in November 160 of 240 items equal 1.1's; a release that changes a running epoch's exercise starts a new epoch). ENGINE.md 8789ec5.

## Verified
- node: daily 55, game 157, engine 525, engine-v11/v12/w2, record4, chimera, core, formats, pooled, section, playtest, hooks, events: all pass (19 Nov 13:40–13:55 UTC).
- e2e: game.py 152/0 (1366 x 768, 390 x 844, 360 x 640, resume) and again 105/0 on desktop and 390 x 844 after the last tweak; flows.py daily 9/0; longrun.py phone daily 11/0 (40 answers, 5 sessions); screens.py 374/0; play.py gamefeel and round5 12/0. Screenshots looked at: the grade moment, the Daily resumed (intro and end) on a phone, the Log on desktop and phone, the share sheet with the Climb and grade cards on phones, every card kind in both sizes and both themes.

## Next
- Nothing open from the brief. The Daily v2 ramp start stays null (set on release day; requests.md 01:33 UTC line).

## Open problems
- None blocking. Seen, not mine: the Daily's end screen shows its one-line share field cut on a 390 px phone (the address wraps into a one-row box; js/ui/play.js).
