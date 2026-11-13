# STATE: Parallax v1.1 update (rewritten at every milestone; under 100 lines)

Updated 2026-11-13 17:45 UTC. All 19 exercises are active in index.html (Knots and B6's three included).

## Phase
2. Build (started 13 Nov ~14:00 UTC after the owner's go). D1: keep Parallax's own rules (game layer = v1.2). D2: opt-in focus on the DAT-style formats. D3: analogical test named in v1.2.

## The brief in one line each (BRIEF.md is the word-for-word source)
1. Time counting looks bugged; fix it and other bugs.
2. Path integration without landmarks (dead reckoning).
3. Knotting and deknotting.
4. DAT PAT question types as training.
5. A better phone experience; Homing usable on phones.
6. Check whether Parallax practises the "analogical assessment test"; if so, warn.

## Done
- Restored the work: mighty-iq/Parallax cloned at /home/claude/parallax (remote URL now the canonical https://github.com/mighty-iq/Parallax); main = f10f7db (v1.0.0); Pages on.
- Contract docs/dev/CONTRACT-v1.1.md, requests docs/dev/REQUESTS-v1.1.md, builder logs docs/dev/progress/.
- B7 finished (5bcc3a7): Section practice (js/engine/section.js, js/ui/section.js), "DAT-style focus" switch, "Taking a test soon?" helper, test-overlap notes (js/ui/overlap.js), About "Test hygiene", one-tap Check question. Tests: section 129, overlap 105 node checks; section.py 90/90, overlap.py 52/52.
- B5 finished (110eab5): Angles EX-16, Hole Punch EX-17, Painted Cubes EX-18, active in index.html; node 73/61/60 checks at 10 080 items; e2e 161/174/161; fit.py passes.
- Lead: codes EX-14…EX-19 (no "PAT-n", R3 §6); switch label "DAT-style focus"; harness loads def.requires (PRELOAD for Reckon) and answers position items; harness.html has clock.js and section.js; play.js labelLine/tagOf/goalOf; section.js in the node MANIFEST.

## In progress
- B1 (clock, engine, store, player), B2 (phones), B3 (Homing + Reckon), B4 (Knots), B6 (Openings, Missing View, Form; asked to switch to EX-14/15/19).
- Lead: preview smoke test of the single file (scratchpad/preview_smoke.py, log preview_smoke.log), then the first playable build to the owner as a private artifact "Parallax v1.1 preview" (not the v1.0 artifact).
- Lead: harness def.requires smoke (scratchpad/harness_requires_smoke.py, log req_smoke2.log).

## Next three steps
1. When the preview smoke passes: publish the private preview artifact, send the owner one line on what to try; update claude/parallax-status.md.
2. Keep committing builders' work; answer REQUESTS; when B1 finishes, do the integration items below.
3. Integration: full suite (node + e2e incl. clock.py, fit.py, section.py, overlap.py, harness_*), long runs, sims with new exercises; then reviews, guide, docs.

## Integration to-do (lead, after the builders)
- Check report: a "compare with care" line on the Level probe when Angles was practised since the baselines (R3 §5.3; DECISIONS 13 Nov).
- (done by B1 at 17:00) similarity groups and beginner order for the DAT-style exercises.
- Library cards: Knots and the six DAT-style exercises have no blurb (home.js CATALOG, B1's file): add one line each, from their learn.goal.
- Review question: Painted Cubes' visible-only count is right on 61 % of items (partial strategy).
- B2's screens.py had 6 failures in B7's run (new exercises without data in its record; CSV columns from B1): recheck after B1/B2 finish.
- Openings validate failed on 18 Section-form items (B7 → B6 FYI): recheck when B6 finishes.

## Open questions for the owner
- None blocking. (D1–D3 answered; the analogical test is for v1.2.)

## Last verified
- 110eab5: node angles/patfold/cubes/fold 391 checks pass; section/overlap 373 checks pass.
- v1.0.0 (f10f7db): tests/run_all.sh 25 files, 5,117 checks, 0 failed (6 Nov); GitHub Actions green.

## Running subagents and the files they write (Phase 2, launched 13 Nov ~15:20 UTC)
- B1 clock, engine, store, player logic: a34b20ea2c882325b (docs/dev/progress/B1.md)
- B2 phones (CSS, screens, existing views, fit test): aed53d9e449759e47 (B2.md)
- B3 Homing fixes + Reckon (EX-12): a4766dc5c229a6ee1 (B3.md)
- B4 Knots (EX-13): a0dafe0ed9a9dc012 (B4.md)
- B6 Openings, Missing View, Form (EX-14/15/19): a0dc048b845b7fc8e (B6.md)
- Reviewer RV-A (DAT-style A: Angles, Hole Punch, Painted Cubes; items, shortcuts, texts): a882c052e4e6f956f → docs/dev/reviews/RV-dat-style-A.md
- Reviewer RV-B (Section practice, overlap notes, claims vs code): a3268094abb5c4c1a → docs/dev/reviews/RV-section-overlap.md
- Finished: B5 (abccc8030cd5dc4ce), B7 (a0a560fe48fdb31c0).

## Dead ends
- Browser slots are the bottleneck (2 for the machine; waits of 10+ minutes while builders run e2e). Queue long browser runs in the background, never in the foreground.
