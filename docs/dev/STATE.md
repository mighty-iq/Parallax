# STATE: Parallax (rewritten at every milestone; under 100 lines)

Updated 2026-11-18 18:50 UTC.

## Phase
- **v1.1 is RELEASED** on the owner's go (14 Nov).
  - `main` = b5ead08 on GitHub: the v1.1.0 release commit, with a new ID since the history rewrite of 17 Nov.
  - Pages deploy succeeded, and https://mighty-iq.github.io/Parallax/js/core/px.js reads `PX.version = '1.1.0'`.
  - CI tests passed on the release commit; after the rewrite, Pages and CI run again on b5ead08.
- **v1.2: Phase 2 (build) STARTED** on the owner's go (18 Nov ~15:05 UTC). The approved plan is docs/dev/PLAN.md (v1.1's is PLAN-v1.1.md); deferrals in PLAN-v1.3.md; research in docs/research/v1.2/.
  - Owner's answers: every board recommendation; priorities progress > proof > transfer > fun > start > phone > community > PAT; Central Point Quick by default (Exact a variant); Climb sounds, new-best sound, Summit.

Owner decisions:
- D1: Parallax keeps its own rules in v1.1; the switch to the standing rules and the game layer come in v1.2.
- D2: the DAT-style focus is opt-in.
- D3: closed on 17 Nov. It was a community member's general point about analogy tests, and the decision is in DECISIONS. v1.2 adds one line to the overlap helper.
- 14 Nov: no Duolingo-style streaks. This is now a standing rule for every tool, and the daily chain is out of the v1.2 plan. Parallax's weekly goal keeps its forgiving weeks-in-a-row count.
- RULES.md was refreshed from the project doc on 14 Nov. It now includes the interactive check-ins: a decision board with the plan message, playtest mode in test builds, and the release checklist as a page. PLAN-v1.2 covers them.

## Privacy (standing rules, binding since 17 Nov)
- Every push runs tools/privacy_check.py through the pre-push hook (`git config core.hooksPath tools/githooks`; private values in the git-ignored `.privacy.local`, recreate it in a new container from the script's header). Commit with `TZ=UTC`, no session-link line, keep `Co-Authored-By`.
- The 17 Nov pass and its fixes are in DECISIONS. `main` gets the cleaned files with v1.2. Old commits stay as published (owner's call).

## v1.1 in one line each (BRIEF.md is the word-for-word source)
1. One active-time clock, and bug fixes.
2. Reckon: dead reckoning, no landmarks.
3. Knots.
4. DAT-style exercises and Section practice, behind an opt-in focus.
5. Phones: every scored item fits 360×640, and Homing is playable.
6. Test-overlap notes, and the "Taking a test soon?" helper.

Details: docs/dev/VERIFY-v1.1.md, DECISIONS.md, progress/, reviews/, CHANGELOG.md.

## Release facts
- **Tag:** there is no v1.1.0 tag on GitHub. The proxy refuses tag pushes and the refs API, so the owner can add one under Releases. The local tag was deleted.
- **Preview pages:** the v1.1 release-candidate preview and the old v1.0 preview are private pages. Their links are in the project status note, never in the repository. The v1.0 preview still shows 1.0; update it only if the owner asks.
- **Owner material:**
  - docs/dev/RELEASE-v1.1.md: the checklist;
  - docs/dev/DISCORD-v1.1.md: the announcement, 1,987 characters.

## In progress (Phase 2, wave 1: milestones 1, 2 and Central Point)
- Done and reported (logs in docs/dev/progress/): W1-central (Central Point: Quick and Exact forms, validator over 10 000 items per cell, shortcut bounds, 166 browser checks), W1-band-A and W1-band-B (taught first bands for all seven; firstband passes: Views 78.0, Painted Cubes 76.8, Angles 72.4, Openings 75.4, Form 76.4, Missing View 80.1, Hole Punch 70.3 %), W1-fixes (motion comfort O36, Section O9–O11, Reckon texts O39–O40, tutorial pace after a fresh test), W1-rules (milestone 2: Chimera welcome and card, invites, licences, CLAUDE.md, playtest mode with `BUILD = 'test'`, modes' lines, Watch, Try, Go first in every Practise sheet).
- Still running: W1-core (player: Watch captions wait for Next with Auto-play, tutorial title row, 44 px tools, answer-grid gap, layout shifts; its full node suite, fit/play/flows/clock/twotabs and longrun are running in the background). The session server restarted at about 18:44 UTC; W1-core was resumed from its transcript.
- Fresh-player tests (note D2 §4): Painted Cubes 4/4 Try, 5/5 scored; Angles 3/4 (a mis-tap), 5/5; Reckon partial (pace and captions fixed since); Views and the four band-B exercises still to run once no builder holds a browser slot.
- Paper readers: all done; addenda in the notes; ACCESS.md marked; PLAN.md updated (measurement numbers revised and the owner told).

## Owed at the end of wave 1 (the owner's yes, 18 Nov)
- Rewrite commits 6a0c3d0 and 99768e0 so docs/dev/v1.2/requests.md's four W1-central stamps read the true UTC times (15:55), keeping every other byte; force-push build; record old → new IDs for the GitHub Support list. Do it only when no builder is running.

## Next three steps
1. When W1-core reports: the owed history rewrite (script /tmp/rewrite/fix-stamps.sh outside the repository; verify, then force-push build), with nothing else running.
2. Integration: PX.version for the test build, band-B tutorials' minutes, node suite and key browser suites, dist/Parallax.html; publish a private preview with playtest mode on and send it to the owner; run the pending fresh tests in parallel.
3. Wave 2 (milestones 7, 3, 6, 4): contract additions by W1-core, then builders.

Open owner items: papers he will send (ACCESS.md top 10); the history-cleanup finish (Support / recreate / leave); the v1.1.0 tag; optionally the name of the test Central Point comes from.

## Last verified
- **Live site** serves 1.1.0: px.js fetched on 14 Nov. The Pages build and CI passed on the release commit, and they rerun on b5ead08 after the rewrite.
- **Before release:**

  | Check | Result |
  |---|---|
  | Node checks | 3,768 |
  | clock.py | 74/0 |
  | Chunk B | 1,004/1 (a load flake; 17/17 alone) |
  | Chunk C | 3,669/0 |
  | Long runs, desktop and phone | six modes clean |
  | Spatial Check, desktop and phone | 11/0 |
  | srcdoc | 12/0 |
  | Preview smoke test | 22/22 |
- **PLAN-v1.2.md** names every sweep item O1–O61 where its work sits (or PLAN-v1.3 / closed / dropped) and every gap ID the draft used (a script checked this on 18 Nov after the review).

## Dead ends
- **Browser slots** are the bottleneck: the machine has two.
  - Queue long browser runs in the background.
  - Split the suite into tagged chunks that each stay under the 2-hour background limit (RUN_ALL_TAG).
- **A container restart** stops background runs. Their logs in the scratchpad survive; the processes do not.
- **Tags, and the GitHub refs and Pages write APIs,** are blocked through the proxy. Branch pushes work.
