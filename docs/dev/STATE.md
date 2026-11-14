# STATE: Parallax (rewritten at every milestone; under 100 lines)

Updated 2026-11-14 12:45 UTC.

## Phase
- **v1.1 is RELEASED.** The owner said "Publish v1.1" (14 Nov 09:59 UTC).
  - `main` = `build` = 224228f on GitHub.
  - Pages deploy succeeded, and https://mighty-iq.github.io/Parallax/js/core/px.js reads `PX.version = '1.1.0'`.
  - CI tests passed on main 224228f.
- **v1.2: backlog written, not started.** docs/dev/PLAN-v1.2.md holds every known item, built from two sweeps:
  - docs/dev/v1.2/deferred-sweep.md: 61 open items;
  - docs/dev/v1.2/standing-rules-gap.md: 32 gaps against the standing rules.
  
  v1.2 begins with Phase 1 research once the owner says go.

Owner decisions:
- D1: Parallax keeps its own rules in v1.1; the switch to the standing rules and the game layer come in v1.2.
- D2: the DAT-style focus is opt-in.
- D3: the owner names the "analogical assessment test" for v1.2.

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
- **Preview artifacts:**
  - "Parallax v1.1 preview" (https://claude.ai/artifact/XTDjxtPznRk4TCuTrgonov) is the release candidate.
  - The old v1.0 artifact (https://claude.ai/artifact/NtKy37QREYLgRFFDJ6ma86) still shows 1.0. Update it only if the owner asks.
- **Owner material:**
  - docs/dev/RELEASE-v1.1.md: the checklist;
  - docs/dev/DISCORD-v1.1.md: the announcement, 1,987 characters.

## In progress
Nothing. No subagents are running.

## Next three steps
1. Wait for the owner's go for v1.2, and his answers:
   - D3, the test's name;
   - three forks: how much game, how much time measurement takes, and baseline first or play first;
   - the prose licence (CC BY-SA) and the C13 Chimera lines.
2. On the go, start Phase 1:
   - parallel research notes in docs/research/v1.2/: the game layer, measurement, plateaus, the transfer portfolio, the Reckon papers (O45), and the analogical test once named;
   - then the plan message.
3. After approval:
   - PLAN-v1.2.md becomes PLAN.md, and the current PLAN.md moves to PLAN-v1.1.md;
   - CLAUDE.md is rewritten for the standing rules.

## Last verified
- **Live site** serves 1.1.0: px.js fetched on 14 Nov, and the Pages build for 224228f succeeded. CI passed on main 224228f.
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
