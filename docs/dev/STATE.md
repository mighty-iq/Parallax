# STATE: Parallax (rewritten at every milestone; under 100 lines)

Updated 2026-11-19 16:35 UTC. PAUSED for the owner's weekly usage reset (wound down cleanly at 16:35 UTC; every builder idle, everything committed and pushed at 0748601). Resume when the owner says so.

## Phase
- **v1.1 is RELEASED** on the owner's go (14 Nov).
  - `main` = b5ead08 on GitHub: the v1.1.0 release commit, with a new ID since the history rewrite of 17 Nov.
  - Pages deploy succeeded, and https://mighty-iq.github.io/Parallax/js/core/px.js reads `PX.version = '1.1.0'`.
  - CI tests passed on the release commit; after the rewrite, Pages and CI run again on b5ead08.
- **v1.2: Phase 2 (build) STARTED** on the owner's go (18 Nov ~15:05 UTC). The approved plan is docs/dev/PLAN.md (v1.1's is PLAN-v1.1.md); deferrals in PLAN-v1.3.md; research in docs/research/v1.2/.
  - Owner's answers: every board recommendation; priorities progress > proof > transfer > fun > start > phone > community > PAT; Central Point Quick by default (Exact a variant); Climb sounds, new-best sound, Summit; first session = one tutorial, then Baseline 1, then training (19 Nov).

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

## In progress (Phase 2): resumed 19 Nov 09:30 UTC on the owner's word
- **Built and verified:** milestones 1–7 (6 complete with Mechanisms version 2 and Pattern Memory version 2); 10 complete (README, About, Library notes, the guide for 1.2 as a 57-page PDF; claims and the code behind them in progress/W3-voice.md); 8: Reckon version 2, Homing's map, "Wave 3" for the six DAT-style exercises (lettered options, plain drawings, test-range tags, figure sets), Angles, Painted Cubes, Openings and Hole Punch version 3, Form version 3 in part, Section practice under test conditions; 9 in part (O20 O22 O27 O28 O33 O41 O48 O54–O56 by W3-phones; the guide's O24 and O26).
- **First session (choice A):** one tutorial (Spin, about 2 minutes), then Baseline 1 or Later, then Train. Baseline 1 now runs without stops between kinds. Other Way Round version 2 fixes its net items, which had been drawn mirrored, so the key was wrong (for everyone; only test records hold version 1).
- **Since 13:35 UTC:** milestone 8 built (Missing View version 3 on profile solids, O29); milestone 9 built (O14 Daily by seed, O21 service worker and the install row, O30, leading items off scoped cells), except the full O31 review; test build 4 published (1.2.0-test.4, snapshot a434e64; single 17/0, preview 10/0, phone long run 24/0). Phase 3 began: fresh-player runs of every exercise but Track (phone; desktop for 8), four independent reviews of a434e64 (docs/dev/reviews/RV-code-1.2.md 0 high 2 medium 6 low; RV-claims-1.2.md 0/5/18; RV-items-1.2.md partial, keys right on about 70,000 items, 6 high shortcut cues; RV-a11y-1.2.md partial 0/4/5), and the first fix rounds (player screens and keys, Slice, Nets, Track, Homing, Reckon, Knots, Central Point, Missing View's repeated stems, Form's foils, the Atlas after a merge, the Daily written through).
- **Running:** nothing (paused).

## Next three steps (after the owner's resume)
1. The fixes still open, with their owners: RV-items' six high cues (Hole Punch, Missing View, Openings: band B; Painted Cubes, Angles: band A; Spin), RV-code M2 (sessions saved on hide, recovered at boot), L2–L6, RV-a11y's mediums, the left-over items in docs/dev/progress/W1-band-B.md and W3-exfix.md, and the guide's final round (RV-claims M1–M3 and lows, every requests.md line to the guide, Nets, keys, Section, the service worker and the install row; then the PDF).
2. The release candidate: px.js '1.2.0', playtest BUILD 'release', the Daily v2 start date, the CHANGELOG and guide dates, dist/Parallax.html and the PDF rebuilt and committed; the full node suite, the browser chunks, long runs on desktop and phone, the srcdoc and two-tab runs, sw.py; Form and Openings fresh-player reruns; a last independent check of the guide against the code.
3. Release: docs/dev/VERIFY-v1.2.md (every "Fixed for every new tool" line and every BRIEF instruction against the built files), the owner's release checklist page, the Discord post, the build log and playbook lessons, the zip from tracked files through the privacy check; then the owner's yes and the merge to `main`.

Open owner items: papers he will send (ACCESS.md top 10); the history-cleanup finish (Support / recreate / leave); the v1.1.0 tag; optionally the name of the test Central Point comes from. Not run: the O45 search for a randomised path-integration training study (Reckon's wording about training effects stays as it is).

## Last verified
- **Live site** serves 1.1.0: px.js fetched on 14 Nov. The Pages build and CI passed on the release commit, and they rerun on b5ead08 after the rewrite.
- **v1.2 build (19 Nov):** node 7,278/0 on 88a0363 (62 files, 44 min); test build 4 (a434e64): single 17/0, preview adapter 10/0, long runs on a phone 24/0; each fix round ran its own node and browser checks (see the progress logs); fresh-player runs: Angles version 3 10/10, Painted Cubes version 3 5/5 scored, Rotate, Fold, Nets, Slice, Orient, Hidden and Hole Punch pass on a phone; Form and Openings to rerun after their fixes; Track, Homing and Reckon cannot be judged from screenshots (motion) and go to the owner's checklist.
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
