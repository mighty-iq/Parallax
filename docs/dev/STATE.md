# STATE: Parallax (rewritten at every milestone; under 100 lines)

Updated 2026-11-19 03:25 UTC.

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

## In progress (Phase 2): paused for the night at the owner's request (19 Nov ~03:30 UTC)
- **Built and verified:** milestones 1, 2 and Central Point (wave 1); 3 plateaus (detection within 800 answers 87–88 % against 90 %, a known miss); 4 bets and layers (comparison rounds, bridge sets, off-screen challenges, calibration detail, draw-the-answer variants for Views, Fold and Slice); 5 the game layer (grades, Reach, records, firsts and the Atlas, Daily v2 with its ramp off until release, the weekly Climb with Summit, field notes, game feel between items); 6 measurement (Design A occasions, meter and milestone words, Other Way Round, Motion Graphs, Balance kept untrained, learning curves, Cube Match version 2); 7 per-dimension progress (known misses on Track's speed levels; DECISIONS); 8 Reckon version 2 and Homing's map; 9 a phone subset (O20, O22, O27, O28, O33, O41, O48, O54–O56); rule 5 now holds at every level of Nets, Slice and Fold (three scoped exceptions).
- **Reviews and tests:** an independent review of wave 2 (docs/dev/reviews/RV-wave2.md: 2 high, 6 medium, 13 low) is fixed in full; fresh-player reruns of Views, Central Point and Form pass; a new player's first session was run and its findings fixed (times now agree; the tour says about 6 minutes). Node suite 6,869/0 on a4990d2 (now in four CI shards); single 17/0, preview adapter 10/0 and long runs clean on the test-build snapshots.
- **Test build 3 (1.2.0-test.3)** replaced test build 2 on the same private preview at 03:27 UTC, built from a committed snapshot (8b1dd86). Test gap found: longrun.py's bot stalls on a comparison round (desktop path); teach it the layer cards (comparison rounds, bridge sets, draw-the-answer items) or mute W2-bets' hooks there.
- **Owner question (morning):** a new player's first session runs the tour (about 6 minutes), then Baseline 1 (about 11.5 minutes without feedback) before any training. Options: one two-minute tutorial before the baseline (recommended), training first with the baseline next session, or as is.

## Next three steps (after the owner's "resume")
1. The owner's answer on the first session; his playtest reports from the preview's database (playtest/<device>).
2. Milestone 8's DAT-style rebuild toward the real formats (lettered options, plain line drawings, test-range tags; Painted Cubes 2–4 questions a figure; Form's kinds; Missing View profile solids; Openings' test range), the Mechanisms and Pattern Memory probe upgrades, leading items kept off the scoped shortcut cells (dims.js).
3. Milestone 10 (voice: About, README, Library notes, guide chapters 1, 5, 8; the guide's "15 to 25 minutes" lines; `--shard` in CLAUDE.md), then 11 (two-minute start on all exercises, reviews, long runs, the release checklist page, the owner's yes). The Daily v2 start date is set on release day.

Open owner items: papers he will send (ACCESS.md top 10); the history-cleanup finish (Support / recreate / leave); the v1.1.0 tag; optionally the name of the test Central Point comes from.

## Last verified
- **Live site** serves 1.1.0: px.js fetched on 14 Nov. The Pages build and CI passed on the release commit, and they rerun on b5ead08 after the rewrite.
- **v1.2 build (19 Nov, committed snapshots):** node 6,869/0 (a4990d2, 59 files); single 17/0 and preview adapter 10/0 (8b1dd86); long runs on a phone (train, path, free, daily) clean (258f055); longrun's check mode 11/0 after its Design A update (972b341).
- **v1.1, before release:**

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
