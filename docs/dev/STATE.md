# STATE: Parallax (rewritten at every milestone; under 100 lines)

Updated 2026-11-18 11:25 UTC.

## Phase
- **v1.1 is RELEASED** on the owner's go (14 Nov).
  - `main` = b5ead08 on GitHub: the v1.1.0 release commit, with a new ID since the history rewrite of 17 Nov.
  - Pages deploy succeeded, and https://mighty-iq.github.io/Parallax/js/core/px.js reads `PX.version = '1.1.0'`.
  - CI tests passed on the release commit; after the rewrite, Pages and CI run again on b5ead08.
- **v1.2: Phase 1 (research and plan) STARTED** on the owner's go (18 Nov 11:08 UTC, new chat).
  - Backlog: docs/dev/PLAN-v1.2.md (61 sweep items O1–O61, 32 standing-rules gaps; inputs in docs/dev/v1.2/).
  - Research notes go to docs/research/v1.2/; then PLAN-v1.2.md is rewritten from them, the decision board page is published (private), and the plan message goes out. Then the plan gate: wait for the owner's go.

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

## In progress (Phase 1)
Eight research subagents, each writing one note (they do not commit; the lead commits):
- G1 game layer → docs/research/v1.2/G1-game-layer.md
- M1 measurement → docs/research/v1.2/M1-measurement.md (+ spikes/M1/); a simulation spike follows and decides whether milestone 6 stays in v1.2
- P1 plateaus and faster progress → docs/research/v1.2/P1-plateaus-progress.md
- T1 transfer portfolio and probes → docs/research/v1.2/T1-transfer-portfolio.md
- C1 Central Point (source test, human performance, items, shortcut spike) → docs/research/v1.2/C1-central-point.md (+ spikes/C1/)
- D1 real PAT formats, legal limits, prep products → docs/research/v1.2/D1-pat-formats.md
- D2 easier first band and teaching (six DAT-style + Views) → docs/research/v1.2/D2-first-band.md
- N1 Reckon follow-ups (O35–O38, O44, O45) → docs/research/v1.2/N1-reckon.md

## History rewrite (17 Nov, done; owner's yes, scope "everything private")
- git-filter-repo over all 134 commits:
  - the 6 Nov initial commit now carries the owner's GitHub noreply address;
  - every commit time is in UTC;
  - no message carries a session-link line;
  - every file version is free of private-page links, home-folder and session paths, and owner or community wording.
- The whole new history passes `tools/privacy_check.py --history` (also a six-word quote scan). The new tips differ from the old ones in docs only; no app file changed.
- Force-pushed: `main` b5ead08, `build` e5bed2a. This clone was reset and the old objects were pruned.
- Commit IDs in notes written before the rewrite (for example 224228f, bcf1b83, f10f7db) name the old history.
- GitHub still serves old commits by their IDs (cached views), and the Actions run list shows the old IDs. Only GitHub Support (first changed commit 4753b4b7c95713c5cd0219eb5c7aa693dac192a6) or deleting and recreating the repository removes them; that is the owner's call.
- Other clones made before 17 Nov 22:00 UTC must be deleted and cloned again. A push from an old clone brings the old history back.

## Next three steps
1. Collect the eight notes; run the measurement simulation spike; merge ACCESS lists into docs/research/ACCESS.md (R5).
2. Rewrite PLAN-v1.2.md from the notes (milestones, acceptance checks, decisions for the owner); build and publish the private decision board (exercise cards, decisions with recommendations, playable sketches, ranking, unread papers, device probe, Accept all, Copy my answers).
3. Send the plan message; save brief and status to the project; wait for the owner's go. After approval: PLAN-v1.2.md becomes PLAN.md (PLAN.md → PLAN-v1.1.md), CLAUDE.md is rewritten for the standing rules.

Open owner items carried over: CC BY-SA for prose (L1), the C13 Chimera lines, the history-cleanup finish (Support / recreate / leave), optionally the name of the test Central Point comes from.

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
- **PLAN-v1.2.md** references all 61 sweep items (O1–O61) and all 32 gaps that are not met (a script checked this).

## Dead ends
- **Browser slots** are the bottleneck: the machine has two.
  - Queue long browser runs in the background.
  - Split the suite into tagged chunks that each stay under the 2-hour background limit (RUN_ALL_TAG).
- **A container restart** stops background runs. Their logs in the scratchpad survive; the processes do not.
- **Tags, and the GitHub refs and Pages write APIs,** are blocked through the proxy. Branch pushes work.
