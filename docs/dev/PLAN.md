# PLAN: Parallax v1.1 (draft for the owner's go)

Status: DRAFT sent to the owner on 13 Nov 2026; waiting for the go. The brief is BRIEF.md (word for word); the research is in docs/research/v1.1/ (R1 path integration, R2 knots, R3 DAT PAT, R4 test overlap, I1 timing and bugs, I2 phones).

Parallax keeps its own rules from CLAUDE.md (quiet game layer, pop-up on every open, cautious wording) unless the owner says to switch to the standing rules of 11 Nov (decision D1 below).

## What v1.1 adds, in one line each
1. **One honest clock** and a round of bug fixes (I1).
2. **Phones first-class:** items that never scroll, Homing rebuilt for touch, landscape handled (I2).
3. **Reckon** (EX-12): path integration by dead reckoning with no landmarks (R1, plus a community member's critique of Homing's landmarks).
4. **Knots** (EX-13): "does a knot remain?", "which crossing unties it?" and linked loops, every item proved by knot invariants (R2).
5. **PAT-format practice:** four new exercises in the formats of the DAT Perceptual Ability Test (Angles, Painted Cubes, Openings, Form), two variants (Fold 4×4, Views "complete the views"), and a timed Section mode (R3).
6. **Test-overlap notes:** say which exercises share formats with published tests, a one-tap check-in, and an optional "Taking a test soon?" helper (R4).

## Milestones and acceptance checks

### M1. One clock and bug fixes (I1)
- One active-time clock in the player. It stops for the pause sheet, any sheet or modal, a hidden tab in any phase, and idle over 60 s. It feeds: the session's end, the stored practice time, the summary, Log, share card and weekly goal. One minutes formatter everywhere. Practice totals shown on Progress.
- Train, Path and Speed sessions are time-boxed on active time: the session ends at the first item boundary after the budget, and the plan extends itself when the player is fast. The HUD ticks ("about N min left", refreshed at least every 15 s while an item is open) and never claims time that is gone.
- Reload: #/play never starts a new session by itself; an interrupted session ends on its summary (or resumes when the plan allows it). Reopening on a summary shows the summary.
- Daily Challenge: a reload or "End now" does not spend the day's scored attempt; unanswered items are not drawn as wrong; Today shows the challenge number; one day boundary (local) everywhere.
- Achievements for Threshold and Speed only for completed runs. Progress counts only answered rows (no skipped, voided or probe rows). Speed sizes its plan from timed estimates. A Spatial Check is not a practice session for the weekly goal.
- Smaller fixes: one CSV format for both exports; Sounds setting implemented with short synthesized tones (off by default, never during a stimulus) or removed; Today at 150 % text; HUD item counter during feedback; Speed bar after time-out; Pause label while paused; Threshold result units; Path's double stage card; the Check's time estimate; Today's "in order" wording.
- Accept: a real-time browser test plays 5-minute Train, Path and Speed sessions with fast, slow, paused (100 s), hidden (100 s) and idle (70 s) phases; each ends within one item of 5:00 active time; the HUD, summary, Log, share card and weekly goal show the same minutes; the pause sheet's claim is true; every I1 repro passes.

### M2. Phones first-class (I2, R1 §Homing)
- A phone item screen that never scrolls: header hidden during items, a one-row status strip, goal and tips behind "?", sizes in dvh, option grids that fit their figures.
- Watch, Try, Go on phones: parts list collapsed, stimulus scrolled into view before it plays, captions in the pinned bar.
- Landscape: motion items get their own layout or a "turn upright" card; a trial is voided when orientation or screen class changes mid-stimulus.
- Spatial Check probes fit; checks and sessions store display, viewport and input; results compare like with like.
- Touch CSS: overscroll-behavior none during items, touch-action manipulation, no long-press callouts on options; left and right safe-area padding; text no smaller than 13 px (SVG labels scaled).
- Storage: navigator.storage.persist() requested; an iOS and in-app-browser hint with a backup prompt; a web manifest and icons linked only on https (GitHub Pages), so file:// stays clean; Web Share for results where available.
- Homing on phones: view fixed on top, answer by dragging to turn plus a larger dial with ±1° and ±5° buttons; captions as subtitles; landscape split; Pause really freezes the walk; walking speed 2 m/s or less and turns 45°/s or less; ground texture without shimmer; the void rule based on what harms the task (measured), not any 400 ms freeze; the "larger screens" notices removed.
- Accept: a test opens every scored item of all exercises and probes at 360×640 and checks that the stimulus and every answer control are fully visible with no scrolling; Homing and Reckon play touch-only at 360×740; landscape cards appear; no horizontal overflow at 150 % text.

### M3. Reckon (EX-12): dead reckoning without landmarks (R1)
- A new exercise, experimental, NAV. Homing stays as the easier, landmark-aided stage before it.
- No fixes of any kind: an endless plain, flat sky, unlit materials, ground flow re-seeded every trial (textured blobs → sparse blobs → short-lived dots); no start marker after leaving it; no map, compass or counters; speeds vary so time is not distance.
- Passive outbound route (2–4 legs, 4–12 m, about 1.8 m/s, turns at 45°/s with ramps), then an active answer: point home (turn) or return home (turn, hold Walk, tap Here). Egocentric first person throughout.
- Feedback trains error minimisation: angle error, distance error and drift (error per metre), a replay of the believed home vector against the true one, the player's own bias over the last 20 routes, and a tolerance that tightens with skill.
- Ratings stay binary (right within the tolerance); continuous errors are logged and charted. Per-screen-class ratings.
- Accept: generator and scorer tests over 10 000 seeds; shortcut checks ("heading not updated", mirror answer) miss; the tutorial teaches a fresh agent to play in two minutes; touch-only play at 360×740; frame budget held at 4× CPU throttle.

### M4. Knots (EX-13) (R2)
- One exercise whose variants share one rating:
  - **pull**: "Pull both ends: does a knot remain?" (yes/no);
  - **untie / tie**: "Which of 4 marked crossings, switched, unties it (or ties a knot)?";
  - **link**: "Are these loops linked?" (higher levels);
  - **mirror**: "Same knot or its mirror?" with 3D tubes (experimental, last).
- Not built: "which moves tie it" (too close to the Knot Reasoning Task), naming knots.
- An item's truth is its geometry: a spline through integer control points with an over/under flag per crossing. Generate a legible outline, then choose over/under by rejection sampling. Knot and unknot items come in pairs from the same outline, matched on alternation, writhe and visible removable moves, so the cheap tells (alternation 75–92 %, |writhe| 72 %, visible slides 90 % before pairing) fall to near chance.
- The validator re-derives the crossings independently:
  - simplification to zero crossings proves an unknot, and its move list becomes the "show me";
  - otherwise a determinant ≠ 1 proves a knot;
  - otherwise the Jones polynomial decides (V = 1 means an unknot for any diagram of ≤ 24 crossings).
  - untie: exactly one tagged switch changes the class.
  - link: "linked" is proved by a non-zero linking number or the Jones polynomial; "unlinked" only by an explicit separation; at most 20 % of linked items have an odd A-over-B count.
  - mirror: chiral targets only.
  - Ropes are capped at 12 crossings (Jones ≤ 12 ms in Node).
- Difficulty: a 10-rung rope ladder (0.40 logit each: 3–6 crossings with simple moves, up to 11–12 crossings needing a detour) × spacing (open / close / tight, 0.25 logit); base −1.75; hand-set, refit from pooled exports.
- Rendering: 2D SVG ropes with a background-coloured casing at each crossing, crossing angles ≥ 35°, crossings ≥ 36 px apart on a 320 px plate, ends running off the plate. 3D tubes only for mirror and a tutorial demo (add TubeGeometry and CatmullRomCurve3 to the three.js subset or build tubes by hand). "Show me" morphs the validator's moves in 2D.
- Tutorial: the gap shows which strand is under; two ropes of one shape with one crossing switched (one falls open, one ties tight); the three moves in plain words; Try on pull, then untie on a 5_2. Strategy cards: picture the pull, or trace and remove ("over-under all the way round means a knot").
- Licences: reimplement everything (SnapPy, Regina and KnotFolio are GPL; Topoly is non-commercial; KnotPlot and Knot Atlas images are not free). Never copy or probe with the Knot Reasoning Task.
- Accept: 10 000 seeds per variant with exactly one proven answer; shortcut solvers within chance + 10 points; generation inside the frame budget (pre-generated in idle time when needed); legible at 360 px.

### M5. PAT-format practice (R3)
- New exercises: **Angles** (rank four angles; perceptual-judgement practice), **Painted Cubes** (how many cubes have N painted sides), **Openings** (which opening fits the solid), **Form** (which solid folds from the pattern). New variants: **Fold 4×4** (the PAT look) and **Views "complete the views"** (two views given, pick the third, hidden lines dotted).
- Every item generated and solver-verified as in R3 §8, with each format's shortcut solvers.
- A **PAT focus** in the Library and Settings: the PAT-format exercises join Train only when the player turns the focus on; they are always in Free play and the Library.
- A **Section mode**: the six parts in PAT order, full (90 items, 60 minutes) or mini (30 items, 20 minutes); no feedback until a review at the end; alternate forms; no rating change and no score prediction.
- Wording: "DAT-style formats" only; the ADA line wherever the DAT is named: "DAT® and Dental Admission Test are marks of the American Dental Association. Parallax is not affiliated with or endorsed by the ADA. Every item is generated by the app; none is taken from the DAT." No claim of DAT score gains.
- Protect the Spatial Check: no oriented marks on cubes (Cube Match probe); the Lab records PAT-focus use.
- Accept: 10 000 seeds per format with exactly one right answer; shortcut solvers within chance + 10 points; a timed Section run end to end on phone and desktop.

### M6. Test-overlap notes (R4)
- About gets a "Test hygiene" section naming the shared formats (Fold, Hidden, Views count, Nets, Span, and the PAT formats) and the size of practice effects.
- Each overlapping exercise carries an "Also in tests" note on its Library page and How to play.
- Later Spatial Checks ask one logged, unscored question: "Since your last check, have you practised or taken another test with puzzles like these, or with word analogies?"
- An optional "Taking a test soon?" helper in Settings: tick what the test contains, see the matching exercises, pause them in Train until a date, log the test for the Lab export.
- Analogy tests: no exercise uses the analogy format; the Spatial Check's word task does, briefly and without feedback. Named once the owner identifies the test.

### M7. Docs and data
- Version 1.1.0 with a save migration (new exercise records, PAT focus, the new clock fields); old saves load unchanged; export and import round-trip.
- Guide: new chapters for Reckon, Knots, the PAT formats and Section mode; the clock; phones; test overlap. README, CHANGELOG, ENGINE.md, EXERCISE-GUIDE.md updated.

### M8. Verification and release
- Full suite, new tests (clock, fit at 360×640, Reckon, Knots, PAT formats, Section mode), long bot runs on phone and desktop, two tabs, simulated learners with the new exercises, single file in a sandbox.
- Independent reviews: code, play-through, claims against code, item validity, phone usability, accessibility. One fix round. Guide checked against the code.
- Release checklist for the owner; merge `build` into `main` only with the owner's yes.

## Build organisation (after the go)
- Contract first (docs/dev/CONTRACT-v1.1.md): file ownership, the clock API, the screen-class field, the PAT-focus flag, the new answer types.
- Builders in parallel, one owner per file: clock and bugs (engine + player); phone layout (CSS, sheets, Check); Homing + Reckon; Knots; PAT A (Angles, Painted Cubes, Fold 4×4); PAT B (Openings, Form, Views variant); Section mode + PAT focus + test-overlap notes. Then guide, reviews, fixes, release.

## Decisions for the owner
- D1. Switch Parallax to the standing rules of 11 Nov (more game, lighter repeat pop-up, Chimera invites at high points, a faster-resolving Spatial Check)? Recommendation: not in v1.1; make it v1.2 so this update stays on the six asks.
- D2. PAT-format exercises: opt-in PAT focus (recommended) or mixed into everyone's Train?
- D3. Which test is the "analogical assessment test"?

## Defaults chosen where the brief is silent
See the plan message; logged in DECISIONS.md.
