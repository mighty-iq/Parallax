# STATE: Parallax v1.1 update (rewritten at every milestone; under 100 lines)

Updated 2026-11-13 15:25 UTC.

## Phase
2. Build (started 13 Nov ~14:00 UTC after the owner's go). D1: keep Parallax's own rules (game layer = v1.2). D2: opt-in PAT focus. D3: analogical test named in v1.2.

## The brief in one line each (BRIEF.md is the word-for-word source)
1. Time counting looks bugged; fix it and other bugs.
2. Path integration without landmarks (dead reckoning).
3. Knotting and deknotting.
4. DAT PAT question types as training.
5. A better phone experience; Homing usable on phones.
6. Check whether Parallax practises the "analogical assessment test"; if so, warn.

## Done
- Restored the work: mighty-iq/Parallax cloned at /home/claude/parallax; main = f10f7db (v1.0.0); GitHub Pages is on; no issues or pull requests.
- Branch `build` created. BRIEF.md (git-ignored) holds every instruction. /home/claude/RULES.md and /home/claude/CLAUDE.md set up for root memory.
- The v1.0 research notes (A–D) copied to docs/research/v1.0/.

## In progress
- Phase 2 build: contract docs/dev/CONTRACT-v1.1.md (owners B1–B7), requests in docs/dev/REQUESTS-v1.1.md, builder logs in docs/dev/progress/.
- Lead scaffolding done: registry answer type `position` + flags `pat`/`experimental`; play.js responseFor('position'); index.html PENDING slots for every new file; three.js subset + TubeGeometry/CatmullRomCurve3/CurvePath/Curve (577.7 KiB).

## Next three steps
1. Commit builders' work at milestones (they do not run git); watch REQUESTS-v1.1.md and progress/*.md.
2. Send the owner the first playable build as soon as one new exercise works end to end.
3. Then integration: full suite, long runs, reviews, guide.

## Open questions for the owner
- None blocking. (D1–D3 answered; the analogical test is for v1.2.)

## Last verified
- v1.0.0 (f10f7db): tests/run_all.sh 25 files, 5,117 checks, 0 failed (6 Nov); GitHub Actions green.

## Running subagents and the files they write (Phase 2, launched 13 Nov ~15:20 UTC)
- B1 clock, engine, store, player logic: a34b20ea2c882325b (progress: docs/dev/progress/B1.md)
- B2 phones (CSS, screens, existing views, fit test): aed53d9e449759e47 (B2.md)
- B3 Homing fixes + Reckon (EX-12): a4766dc5c229a6ee1 (B3.md)
- B4 Knots (EX-13): a0dafe0ed9a9dc012 (B4.md)
- B5 Angles, Hole Punch, Painted Cubes (PAT-3/4/5): abccc8030cd5dc4ce (B5.md)
- B6 Openings, Missing View, Form (PAT-1/2/6): a0dc048b845b7fc8e (B6.md)
- B7 Section mode, PAT focus, overlap notes: a0a560fe48fdb31c0 (B7.md)
- Phase 1 research agents are finished (notes in docs/research/v1.1/).

## Dead ends
(none yet)
