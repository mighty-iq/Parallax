# STATE: Parallax (rewritten at every milestone; under 100 lines)

Updated 2026-11-18 20:15 UTC.

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

## In progress (Phase 2)
- **Wave 1 (milestones 1, 2, Central Point): DONE.** Logs in docs/dev/progress/W1-*.md. Test build 1.2.0-test.1 (playtest mode on) went to the owner as a private preview at 20:00 UTC; it saves playtest reports to the preview's database (tools/build-preview.mjs, tools/preview-adapter.js).
  - Node: full suite 4760/4760 before W1-core's last commits (current run by the lead in progress). Browser: play 138/0, flows 73/0, clock 74/0, twotabs 10/0, single 17/0, preview adapter 10/0; fit.py at 360 × 640: Hole Punch's worked example still too tall (request to band-B).
  - Open from W1-core (requests.md): reveal lines push the answer tiles about 30 px (Cubes, Form, Hole Punch, Missing View) and Angles' order tags; Openings' options end under the strip at 390 × 844; the guide needs a line on Watch pacing (Next, Auto-play).
- **The owed history rewrite: DONE** at 19:58 UTC (117 commits; only the four stamps changed, verified per commit; old IDs in the project status note).
- **Fresh-player tests (note D2 §4) running:** Views, Central Point (driver /tmp/w1a/fp), Form, Openings, Missing View, Hole Punch (driver /tmp/bandB/fp). Findings go to band-A and band-B (resumed) with W1-core's requests.
- **Wave 2 started:** W2-measure (milestone 6 simulation; new files js/engine/trend.js, tests/node/trend.test.mjs, tests/node/measure-*.mjs, docs/dev/v1.2/measure-sim.md); W2-core (the wave-2 section of docs/dev/CONTRACT-v1.2.md, then shared hooks: record fields and migration, events table, trial-row fields, player and Today hook points). No app code changes while the fresh tests run.

## Next three steps
1. Fresh-test findings and W1-core's open requests → band-A and band-B fixes; a second test build when they land.
2. W2-core's contract → its hooks → builders W2-progress (7), W2-plateau (3), W2-measure build (6), W2-bets (4).
3. Read the owner's playtest reports from the preview's database (playtest/<device>) and fold them in.

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
