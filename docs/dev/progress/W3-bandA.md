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
