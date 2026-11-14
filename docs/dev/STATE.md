# STATE: Parallax (rewritten at every milestone; under 100 lines)

Updated 2026-11-14 10:20 UTC.

## Phase
v1.1 is RELEASED: the owner said "Publish v1.1" (14 Nov 09:59 UTC). `main` = `build` = 224228f on GitHub; Pages ("pages build and deployment") succeeded and https://mighty-iq.github.io/Parallax/js/core/px.js reads `PX.version = '1.1.0'`.
Now: collecting every v1.2 item into docs/dev/PLAN-v1.2.md (the owner asked whether everything for v1.2 is in the v1.2 plan; it was spread over STATE, DECISIONS and the reviews).

Owner decisions: D1 keep Parallax's own rules in v1.1 (the standing-rules switch and game layer = v1.2); D2 opt-in DAT-style focus; D3 the owner names the "analogical assessment test" for v1.2.

## v1.1 in one line each (BRIEF.md is the word-for-word source)
1. One active-time clock and bug fixes. 2. Reckon (dead reckoning, no landmarks). 3. Knots. 4. DAT-style exercises and Section practice (opt-in focus). 5. Phones (every scored item fits 360×640; Homing playable). 6. Test-overlap notes and the "Taking a test soon?" helper.
Details: docs/dev/VERIFY-v1.1.md, DECISIONS.md, progress/, reviews/, CHANGELOG.md.

## Release facts
- Tag: no v1.1.0 tag on GitHub. The proxy refuses tag pushes (git push of a tag: "unexpected disconnect", twice) and the refs API (403). The owner can add one from GitHub → Releases → "Draft a new release" → tag v1.1.0 on main. The local tag was deleted so it cannot drift.
- CI: the tests workflow ran on 224228f for main and build (check its result; build's previous run 8d940a5 passed).
- Preview artifact "Parallax v1.1 preview" https://claude.ai/artifact/XTDjxtPznRk4TCuTrgonov (release candidate). The old v1.0 artifact https://claude.ai/artifact/NtKy37QREYLgRFFDJ6ma86 still shows 1.0: offer to update it, do not do it unasked.
- Owner material: docs/dev/RELEASE-v1.1.md (checklist), docs/dev/DISCORD-v1.1.md (1,987 characters).

## In progress (intent)
- Two background subagents write the inputs for the v1.2 plan:
  - docs/dev/v1.2/deferred-sweep.md: every item deferred, left open or recommended and not built (v1.0 and v1.1 notes, reviews, progress, research, code TODOs), checked against the code.
  - docs/dev/v1.2/standing-rules-gap.md: Parallax against RULES.md (the switch decided in D1), rated MEETS/PARTLY/MISSING/CONFLICTS, with the CLAUDE.md rules to reword.
- Then I write docs/dev/PLAN-v1.2.md (backlog with priorities; v1.2 itself starts with research and a plan message, and the owner's go).

## Next three steps
1. Merge both notes into docs/dev/PLAN-v1.2.md; commit and push to `build`.
2. Update claude/parallax-status.md, claude/build-log-parallax-v1.1.md (released), claude/parallax-brief.md (BRIEF copy).
3. Reply to the owner: live link, tag taps, the v1.2 plan in short, D3 still needs the test's name; offer the v1.0 artifact update in one line.

## Open for v1.2 (seed list; PLAN-v1.2.md will be the full one)
- Standing-rules switch and game layer, lighter repeat pop-up (D1); name and check the analogical test (D3).
- Reckon study: rated levels with 3–4 legs, final rotations, or graded continuous error (turn-only exception).
- Knots mirror variant; refit hand-set difficulties from pooled exports; Pause/End during feedback; partial Daily resume by seed.

## Last verified
- Live site serves 1.1.0 (px.js fetched 14 Nov 10:10 UTC); Pages build for 224228f: success.
- Before release: node 3,768 checks; clock.py 74/0; chunk B 1,004/1 (a load flake, 17/17 alone); chunk C 3,669/0; longrun desktop and phone, six modes clean; Spatial Check 11/0 desktop and phone; srcdoc 12/0; preview smoke 22/22.

## Dead ends
- Browser slots are the bottleneck (2 for the machine). Queue long browser runs in the background; split the suite into tagged chunks under the 2-hour background limit (RUN_ALL_TAG).
- A container restart stops background runs; their logs in the scratchpad survive, the processes do not.
- Tags and the GitHub refs/Pages write APIs are blocked through the proxy; branch pushes work.
