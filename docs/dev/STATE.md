# STATE: Parallax v1.1 update (rewritten at every milestone; under 100 lines)

Updated 2026-11-14 00:40 UTC.

## Phase
3. Review, fix and release: at the release gate. Everything is built, reviewed, fixed and verified. The owner has the release message and checklist; waiting for the yes to merge `build` into `main`.

Owner decisions: D1 keep Parallax's own rules (game layer = v1.2); D2 opt-in DAT-style focus; D3 the analogical test is named in v1.2.

## The brief in one line each (BRIEF.md is the word-for-word source)
1. Time counting looks bugged; fix it and other bugs.
2. Path integration without landmarks (dead reckoning).
3. Knotting and deknotting.
4. DAT PAT question types as training.
5. A better phone experience; Homing usable on phones.
6. Check whether Parallax practises the "analogical assessment test"; if so, warn.

## Done (details: docs/dev/VERIFY-v1.1.md, DECISIONS.md, progress/, reviews/)
- 19 exercises (new: Reckon EX-12, Knots EX-13, DAT-style EX-14…19), one active-time clock, phones (every scored item fits 360×640), Section practice, DAT-style focus, test-overlap notes, record format v2, version 1.1.0.
- Reviews: RV-A, RV-B, RV-C, RV-D, RV-E, RV-H, RV-G (guide), fresh-player RV-F (DAT-style) and RV-F2 (Homing, Reckon, Knots); every finding fixed or decided in DECISIONS.
- Guide docs/Parallax-Guide.pdf 50 pages (clean build, links clickable); README; CHANGELOG 1.1.0; dist/Parallax.html (14 Nov build).
- Preview for the owner: private artifact "Parallax v1.1 preview" https://claude.ai/artifact/XTDjxtPznRk4TCuTrgonov, version 2 = release candidate (smoke 22/22). Republish from scratchpad/preview/parallax-v11-preview.html (built from dist by stripping doctype/html/head/body and the viewport meta, title "Parallax v1.1 preview").
- Project docs: claude/playbook.md (lessons merged), claude/build-log-parallax-v1.1.md, claude/parallax-status.md, claude/parallax-brief.md.
- Owner material: docs/dev/RELEASE-v1.1.md (five-minute checklist), docs/dev/DISCORD-v1.1.md (1,987 characters).

## Final suite (bcf1b83 and later; no app code changed since)
- Node: 3,768 checks in 31 files pass.
- Chunk A: clock.py full 74/0; longrun desktop train, path, speed, threshold, free, daily clean (stopped at the 2-hour limit during desktop check).
- Chunk B: 1,004 passed, 1 failed (fit: Hole Punch Watch measured before its scroll under load; rerun alone 17/17).
- Chunk C: 3,669/0 (every harness, section, overlap, perf_track).
- longrun phone train, path, speed, threshold, free, daily clean (--per 150); the container restarted before phone check and srcdoc.

## In progress
- Nothing. Verification complete; waiting for the owner's yes.

## Next three steps
1. When both long runs pass: update VERIFY (longrun rows), claude/build-log-parallax-v1.1.md and claude/parallax-status.md.
2. Send the owner the release message: what was built, how verified, what is open, the checklist (RELEASE-v1.1.md) and the Discord draft.
3. On the owner's yes: merge `build` into `main` (fast-forward or merge commit), push, confirm Pages serves 1.1.0, tag v1.1.0 if the owner wants a release.

## Open for v1.2 (not blocking)
- Standing-rules game layer and lighter repeat pop-up (D1); name the analogical test (D3).
- Reckon study: rated levels with 3–4 legs, final rotations, or graded continuous error (turn-only exception).
- Knots mirror variant; refit hand-set difficulties from pooled exports; Pause/End during feedback; partial Daily resume by seed.

## Last verified
- longrun Spatial Check desktop 11/0 and phone 11/0 (two complete checks each, 160 answers; the bot now answers the one-tap question), 14 Nov 01:50 UTC.
- longrun srcdoc (all modes in a sandboxed frame, export/import round trip): 12/0 (14 Nov 00:41 UTC).
- Final suite as above (14 Nov); preview smoke 22/22 on the release candidate.

## Dead ends
- Browser slots are the bottleneck (2 for the machine). Queue long browser runs in the background; split the suite into tagged chunks under the 2-hour background limit (RUN_ALL_TAG).
- A container restart stops background runs; their logs in the scratchpad survive, the processes do not.
