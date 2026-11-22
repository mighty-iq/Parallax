# W3-bandA progress: Angles and Painted Cubes to the real formats (PLAN milestone 8)

Owns (taken over from W1-band-A): js/ex/{angles,cubes}/*, css/ex/{angles,cubes}.css, tests/node/{angles,cubes}.test.mjs,
tests/e2e/harness_{angles,cubes}.py and the Angles and Painted Cubes parts of tests/e2e/band_a.py.
Done criteria: PLAN.md milestone 8, the "DAT-style, the real formats" and "DAT-style depth" bullets and the acceptance line
(independent solvers and version bumps for every rebuilt DAT-style exercise, shortcut solvers re-run per level).
Sources: note D1 §2.3, §2.5, §3.3, §3.5, §6.0–6.3 and its addendum (A.1 rows 2, 6–8, 18; A.4 rows 4, 7); note D2 §3.2–3.3.

## Plan
1. Angles: the format's labels (angles numbered 1–4, answers lettered A–D) once the player's letter mode exists; O58 (1.5° or
   a DECISIONS line for 2°); the per-level shortcut export for tests/node/shortcut-levels.test.mjs; test-range tags.
2. Painted Cubes version 3: figure sets of 2–4 questions (training needs the planner: request to W2-core, 19 Nov 09:41 UTC),
   five painted sides asked with balanced answers, every question held against the novice errors; O57 (visible cubes only,
   column tops only); the tally pad (O12); the test look (white faces, black edges; tones at the starter band and in show-me).
3. Both: independent solvers, validators over 10 000 seeds, per-level shortcut checks, re-basing, tags; tutorials; browser checks
   at 360 × 640, 390 × 844 and 1366 × 768 with screenshots; the reveal room rule.

## Log
- 09:32 UTC: started; read CLAUDE.md, PLAN milestone 8, notes D1 (§2–§3, §6, addendum) and D2 (§1.2–1.3, §3.2–3.3, addendum),
  W1-band-A's log, CONTRACT-v1.2 (no "Wave 3" section yet), the two exercises' code and tests, rebase.js.
- 09:41 UTC: request to W2-core: figure sets in the planner (8e7de90).
- 09:48 UTC: Angles' per-level shortcut export (9b13e1e): 514 cells within chance + 10, closest +6.3; O58 decided: 2° stays
  (DECISIONS 13cd5ab).
- 10:37 UTC: Painted Cubes version 3 generator: figure sets of 1–4 questions from the seed (def.set.size; mean 2.49
  above the band), five painted sides on built figures (peakFigure; counts 1–3 evenly, 356/376/361), every question held on
  the novice errors, partial counts reported with caps (O57), an independent ray-marching solver and a one-column search in
  the test (O30), the per-level export (130 cells within chance + 10, closest +6.8; the starter towers' bottom-as-painted
  cell fixed). cubes 187/0, p95 9.7 ms at the hardest level. Spikes and their numbers: scratch scripts outside the repository.
- 10:41 UTC: W2-core's wave 3 (ab8bf2b): figure sets as requested (def.set, kind 'set', ctx.set), letters, the plate look,
  test-range tags. My two commits above got new IDs in the lead's unpushed-range rewrite (e395c1b, 6e21462), content intact.
- 10:56 UTC: Angles: angles numbered 1–4, answers A–D (letters mode), plates in both themes, test-range tags, version
  stays 2; harness_angles 244/0. Painted Cubes: answers A–E, plain look in the test range (tones on the band and in show me),
  the set row with "Question i of n" and the tally pad (O12), test-range tags; harness_cubes 249/0 (app checks at 360 x 640,
  390 x 844, 1366 x 768: the answers keep their place when the pad opens and at the reveal; the tally survives the figure's
  next question). Node: angles, cubes, wave3, section, firstband, core, rebase, formats, bets 1904/0; shortcut-levels 196/0.
  (Correction: Angles' node test had 379 checks at 9f509c8, not the 384 its commit message says.)
- 11:01 UTC: fit.py --ex cubes,angles at 360 x 640 (angles 18/18, cubes 17/17 items), 390 x 844 and 844 x 390: 18/0;
  section.py 130/0 and sideways 14/0 (Painted Cubes' Section items now show "Question i about this figure"); the Library's
  "Against the test format" block reads both exercises' tags and notes (screenshots in tests/e2e/out/cubes/library_*).
  The set tip moved first in learn.tips (the player shows the first unseen match, one an item). Guide request filed
  (29abdb0): the guide's Angles and Painted Cubes pages describe 1.1's labels and "five painted sides never asked".
- 12:09 UTC: the lead's fresh-player run of Angles (19 Nov, six findings). 1. Letters: even per level (10,000 items per level,
  every share within 1.0 point; consecutive engine seeds repeat the letter 24.9 %): the five B's were chance, the generator
  unchanged; always A–D and the letter the last item had bounded per level (Angles), the latter in Painted Cubes too (its
  letters are its counts: no letter above 28.9 % at any level, e44a673). 2–3. Numbers in a strip under each drawing, sizes
  at its right end, Try 1's mark a ring (47d650c; harness_angles 298/0 with strip checks at three sizes, fit angles 16/0,
  section.py 165/0). 4. The Atlas pairs gap × pose, def.ignores names the size class at 9°; the settings texts and
  "Typical at this level" are W2-core's (requests e3b0127). 5. Version 3: level 2's closest pair in the middle, the ends
  settle a third of items (55 % before); "smallest first, largest last" reported per level. 6. The answer part names A–D
  alone; letter-only keys requested from W2-core. DECISIONS ca9aef0.
- 13:39 UTC: the lead's next round. A (Painted Cubes, fresh-player run 88a0363): Try 4 and a new Try 5 are one six-cube plain
  figure's two questions, Try 4 with a tip on the test's drawing and the supports, "Question 1 of 2" and a tally caption, Try 5
  with the figure-set tip and the tally kept; badges on the most interior point of their cube's visible faces, a numbered
  hidden cube veiled with its number at its centre, digits centred (harness_cubes 264/0: Try 4 and 5 in the app, badges on
  42 figures at 360 x 640 and 390 x 844; fit cubes and angles 18/0). B (O30): the brute-force search of every reading of
  the picture, 600 figures, one reading each under the rule; 330 with others without it (cubes 210/0). C: Angles keys
  A–D alone (harness_angles 318/0). Commits 2e74ca1, a837a68; DECISIONS 416ea25.
- 14:32 UTC, 22 Nov: the lead's round from the independent item review (RV-items-1.2), with Views. Angles
  version 4 (H5, L1): the arm search weighs the drawing's height and width (aligned pose) and the arms' ratio; per-cell scan
  at most 35.5 % but one cell's tip distance (32.6/33.4 % on 2,000). Views version 3 (M3): fifteen balanced solvers at every
  toview level, the key the best of up to 6 (10) family members, no top-view foil taller than the grid; every stem-blind
  cue at 35.1 % or less (top views were 41–46 %); TUTORIAL and the session guard (sigOf). Painted Cubes version 4: H3 the
  starter's outline counts redrawn and the outline-fixed count dealt at chance (columns 24 %, was 51 %; one-high columns
  27 %, was 48–52 %); M1 decoy pairs, peaks of other heights, a tallest-columns redraw, a plain figure after 8 failed
  searches (tallest columns 19–27 %, was 100 % two high; no fallback in 24,000 figures); M2 first questions about an N with
  four counts or more (pools 26–32 % on 290–600 items; FIRST_STACKED keeps "column tops only" under its cap, 56 % with
  four painted sides alone); no tutorial figure rated, the guard on the starter band (sets need the guard to carry
  plan.set: requests.md). From the coordinator: numbers never under 13.5 px (phones.py dat 33/0, 360 × 640 smallest 13.5 px;
  badges that find no spot of that size take the roomiest spot clear of the others), the Tally's aria-controls only while
  open (keyboard open, count, close in harness_cubes). Checks: angles 452/0, views 157/0, cubes 243/0, shortcut-levels 7/0,
  bets, dims, dims-scoped, firstband, game, layers-*, overlap, section, rebase, engine all pass; harness_angles 318/0,
  harness_views 180/0, harness_cubes 281/0, fit 31/1 (Views' draw item at 844 × 390 fails on the old tree too). Later
  questions per setting skew more at flat 6–9 cubes (always 2: 41 %; pooled per N they hold 30 %). Commits 21ab1d6, 4c88a40,
  0ea87ea; DECISIONS 5da1fc6.
