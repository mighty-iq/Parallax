# STATE: Parallax v1.1 update (rewritten at every milestone; under 100 lines)

Updated 2026-11-13 21:40 UTC. Every builder and fix round is done; verification phase. All 19 exercises are active in index.html (Knots and B6's three included).

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
- All builders finished. B3 (fbd0f83): Homing v2 on phones and Reckon; node 88/96 checks, harness_homing 161/0, harness_reckon 62/0. B2 finished (13c648c): every scored item of 19 exercises and 6 probes fits 360×640 (v1.0: 44 of 137), 844×390 layouts; shell 228/0, screens 358/0, single 17/0. Fix rounds from reviews: B5 (RV-A: Angles cues and foils, Hole Punch validator panels, Painted Cubes asks 1–4, phone arms, 150 % text) and B7 (RV-B: 12 fixes in Section and overlap notes), both resumed with their context. B6 finished (1a16b9c): Openings, Missing View, Form; node 68/78/69, e2e 82/110/92. B4 finished (a7c24a9): Knots pull/untie/tie/link, 364 node checks at 10 000 seeds per variant, harness 340/340, fit passes; mirror variant not built. B1 finished (b49f12b): clock.py full 73/73, play.py 103/103, flows 61/61, twotabs 10/10, sim hard checks pass.
- First playable build sent 13 Nov ~18:40 UTC: private artifact "Parallax v1.1 preview" https://claude.ai/artifact/XTDjxtPznRk4TCuTrgonov (built from 9e6517c; smoke 22/22 on phone and desktop in a host-like wrapper: pop-up, 9 new or changed exercises, no console errors). Republish the same file path scratchpad/preview/parallax-v11-preview.html for later previews (make it with the snippet in this session's scratchpad notes or tools-release/make_artifact_page.py with the preview title).

## Next three steps
1. Update claude/parallax-status.md and claude/parallax-brief.md in the project (milestone: first playable build).
2. Keep committing builders' work; answer REQUESTS; when B1 finishes, do the integration items below.
3. Integration: full suite (node + e2e incl. clock.py, fit.py, section.py, overlap.py, harness_*), long runs, sims with new exercises; then reviews, guide, docs.

## Integration to-do (lead, after the builders)
- Check report: a "compare with care" line on the Level probe when Angles was practised since the baselines (R3 §5.3; DECISIONS 13 Nov).
- (done by B1 at 17:00) similarity groups and beginner order for the DAT-style exercises.
- (done 9e9b294) Library/Today blurbs for Knots and DAT-style; LE ability name; Angles note beside Level (needs a browser check: Progress with a check record and Angles rows); ARCHITECTURE §8/§11.
- (done 39d17f8) check.js uses PX.core.clock; (done 2f2c714) show-me after an answer scrolls the stage above the pinned caption. From B1's report, still open: answer times 2 decimals on the verdict vs 1 in the Log (pick one); a partial Daily resumes by position in the device-filtered list (resume by seed instead); run longrun.py.
- Review question: Painted Cubes' visible-only count is right on 61 % of items (partial strategy).
- B2's screens.py had 6 failures in B7's run (new exercises without data in its record; CSV columns from B1): recheck after B1/B2 finish.
- (done) Openings Section forms validate (B6, B7's section tests pass with all six parts).
- Homing/Reckon tutorial Try items need a scroll to Confirm at 360×640 (B3): judge in the play-through review; option: scroll the answer controls into view when respond begins in Try on phones.
- flows.py run_modes crashed on a screenshot time-out under load (17:57): rerun in the full suite.

## Open questions for the owner
- None blocking. (D1–D3 answered; the analogical test is for v1.2.)

## Last verified
- 2fe5c77+: node suite without angles/patfold/cubes/fold: 3,149 checks in 27 files pass (1,003 s); B5's four pass separately (625eb27).
- 110eab5: node angles/patfold/cubes/fold 391 checks pass; section/overlap 373 checks pass.
- v1.0.0 (f10f7db): tests/run_all.sh 25 files, 5,117 checks, 0 failed (6 Nov); GitHub Actions green.

## Running subagents and the files they write (Phase 2, launched 13 Nov ~15:20 UTC)
- Reviews done: RV-A docs/dev/reviews/RV-dat-style-A.md (no wrong items; 2 rule-5 issues in Angles; Hole Punch symmetry = method); RV-B docs/dev/reviews/RV-section-overlap.md (no blockers; 8 should-fix).
- B7 fix round done (2c68b6a). B5 fix round done (625eb27); B5 follow-up done: Angles LONG_MIN 0.7 kept; Fold validator re-simulates every drawn step (items identical).
- RV-D done (docs/dev/reviews/RV-dat-style-B.md): no wrong items; Form face-shape cue 71 %, Openings cues; B6 fix round done (e5e1508).
- RV-E done (docs/dev/reviews/RV-reckon-homing.md): scoring right; 2 blockers (turn-only strategies beat chance + 10 in Reckon and Homing; strategy card side error), 6 should-fix; B3 fix round and decision (a) done; B1 added trial column value2.
- RV-H done (docs/dev/reviews/RV-code-core.md): no blockers; 4 should-fix (closing-item cap, check time as practice, two-tab merge of new fields, idle cap on late timers); B1 fix round done (value2 = trial column 13; CSV 18 columns).
- RV-F done (docs/dev/reviews/RV-play-dat.md): all six learnable; Form > 2 min; tutorial flow, Section phone review, focus effect, sample data. Fix rounds resumed: B2 (aed53d9e449759e47), B1 (a34b20ea2c882325b), B5 (abccc8030cd5dc4ce), B6 (a0dc048b845b7fc8e). 
- Play-through RV-F2 (fresh player: Homing, Reckon, Knots): a8c9191d53e6416d6 → docs/dev/reviews/RV-play-nav-knots.md
- Full suite run 1 (tests/run_all.sh incl. longrun and clock full) from 0c8daf6+: background b4w592kpu, log scratchpad/run_all_1.log, results tests/e2e/out/run_all.json
- G1 finished (80fe43f): guide 1.1.0, 50 pages, clean build; README; CHANGELOG.
- RV-G done (docs/dev/reviews/RV-guide.md): 2 must, 6 should; G1 resumed to fix text (figures after the tutorial fix round); B4 resumed for a show-me failure at pull seed 530622980.
- RV-C done (docs/dev/reviews/RV-knots.md): all answers right; Show me replay can show a type-changing move; 3 false texts; 2 untie cues at the limit; B4 fix round done (Show me checked move by move; captions; untie cues ≤ 27.7 %).
- Finished: B3 (a4766dc5c229a6ee1), B2 (aed53d9e449759e47), B6 (a0dc048b845b7fc8e), B4 (a0dafe0ed9a9dc012), B1 (a34b20ea2c882325b), B5 (abccc8030cd5dc4ce), B7 (a0a560fe48fdb31c0).

## Dead ends
- Browser slots are the bottleneck (2 for the machine; waits of 10+ minutes while builders run e2e). Queue long browser runs in the background, never in the foreground.
