# RV-dat-style-A: independent review of Angles (EX-16), Hole Punch (EX-17), Painted Cubes (EX-18)

Reviewer: an agent that did not build these exercises. Date: 2026-11-13. Files reviewed as they stood at
16:56 UTC: js/ex/{angles,patfold,cubes}/{gen,learn,view}.js, css/ex/{angles,patfold,cubes}.css,
tests/node/{angles,patfold,cubes}.test.mjs, the v1.1 export block in js/ex/fold/gen.js (and Fold's `check`,
which Hole Punch's validator runs). Rules: CLAUDE.md 2, 3, 4, 5, 7, 8; R3 §6, §8.0, §8.1, §8.3, §8.4;
ARCHITECTURE.md; EXERCISE-GUIDE.md; B5's departures (docs/dev/progress/B5.md).

Method: my own Node checks, loaded the way tests/node/run.mjs loads them (`createContext({ files })`), with my
own seeds. They recompute the answers without the exercise's code: Math.atan2 for the angles, a separate fold
simulation for the holes, and a voxel recount plus slab ray casting for the cubes. Scripts are in
`/tmp/claude-0/-home-claude/145ff06a-4b5d-5025-8cb7-e87b9d56923b/scratchpad/rv-a/` (outside the repository;
the formulas that matter are repeated below). No browser was launched. No file other than this one was
written in the repository.

## Findings, ranked

| # | Severity | Exercise | Finding | Where |
|---|---|---|---|---|
| 1 | blocker (lead decision) | Hole Punch | "Has a hole at the punch, then most symmetric about the item's own creases" picks the key 89.6 % (chance 20 %, bound 30 %) | js/ex/patfold/gen.js:143-147, 155-201; tests/node/patfold.test.mjs:162-177 |
| 2 | blocker | Angles | Ranking by the length from the vertex to the midpoint of the tip-to-tip chord picks the key 43.2 % (bound 35 %) | js/ex/angles/gen.js:196-224; tests/node/angles.test.mjs:155-176 |
| 3 | should fix | Angles | Answer-only heuristics (no look at the angles) exceed the bound at resolve 1 and 2, up to 45.1 %; one combined with the chord cue reaches 37.7 % across all items | js/ex/angles/gen.js:157-189 |
| 4 | should fix | Hole Punch | The validator does not check the shape of the drawn panels (item.steps); 5 of 5 corruptions pass `validate` | js/ex/fold/gen.js:1135-1149; js/ex/patfold/view.js:90-109 |
| 5 | should fix | Painted Cubes | Section mode asks N = 5, which training never asks; then "1 cube" is right 82 % of the time | js/ex/cubes/gen.js:265-274 |
| 6 | should fix | Painted Cubes | The dim level label "3–5" is shown to players, but N = 5 is never asked | js/ex/cubes/gen.js:355 |
| 7 | should fix | Angles | Arms on phones are well under R3's 90 px floor (open in B5.md) | js/ex/angles/gen.js:69-72 |
| 8 | should fix (unconfirmed) | Angles | B2's open request: horizontal overflow at 150 % text | docs/dev/REQUESTS-v1.1.md:30; css/ex/angles.css:49 |
| 9 | nice to have | Angles | One CSS variable `--ang-cell` serves as both a colour and a length: on phones in the player the cells lose their white plate | css/ex/angles.css:9, 20, 27, 66, 71 |
| 10 | nice to have | Angles | In 24 % of items the reveal labels of the closest pair differ by 0.1° from the gap that show-me states | js/ex/angles/gen.js:255-260; view.js:25 |
| 11 | nice to have | Painted Cubes | Partial counts are often enough: visible cubes only 60.6 %, column tops only 40.0 % | js/ex/cubes/gen.js:253-259 |
| 12 | nice to have | Painted Cubes | Within some (cubes, height, N) cells the key is skewed, because retries redraw k | js/ex/cubes/gen.js:241-263, 276-285 |
| 13 | nice to have | Painted Cubes | The validator's visibility check uses the generator's own z-buffer, not an independent ray cast | js/ex/cubes/gen.js:339-341 |
| 14 | nice to have | Painted Cubes | One rule sentence shares its first six words with the official sentence quoted in R3 §2.2 | js/ex/cubes/learn.js:20 |
| 15 | nice to have | all | Small wording points: "right" size class, idle-fold cap, caption plurals, the 0.35-edge comment | see §15 |

Outside scope, for the lead's decision on #1: Fold (EX-04, v1.0) has the same crease-symmetry shortcut, at 92.5 %.

---

## 1. Hole Punch: the crease-symmetry shortcut (blocker, needs a lead decision)

**What.** A player who never unfolds anything can do this:
1. Keep the sheets that have a hole at the punch. The key always has one.
2. Of those, pick the sheet most mirror-symmetric about the crease lines drawn in the fold panels.

For one sheet, the symmetry score is the sum, over the item's creases, of the share of its holes whose
mirror across that crease is also a hole. The rule needs no layers, no fold order and no unfolding.

The shipped test balances only symmetry about the *first* crease (`sym1`, 26.5 %) and about the four axes
of the sheet (`symAny`). The item's own later creases are not covered.

The foil pool explains it. Most foils are "fold k unfolded across another line": 4,539 of ~8,064 foils in
the shipped test's PX_REPORT output. Such a foil breaks the symmetry about the true crease.

**Confirmed** with `patfold-check.mjs` (2,400 items, 100 per level combination) and `patfold-sym.mjs` (a new
set of 2,400 items):

| Heuristic | Hit rate |
|---|---|
| hole at the punch, then most symmetric summed over the item's creases | **89.6 %** (89.8 % in the first run) |
| the same, straight folds only | 97.1 % |
| the same, corner folds | 95.5 % |
| the same, diagonal folds | 93.7 % |
| the same, mixed folds | 72.5 % |
| most symmetric summed over all creases, without the punch gate | 58.3 % |
| most symmetric about the last crease | 39.3 % |
| most symmetric about any one of the item's creases | 37.7 % |

Mean symmetry about the item's own creases is 0.58 for the key and 0.35 for the foils.

Example: seed 205960344, {folds 0, type 0, idle 0}. The creases are h c=2 and v c=2 and the punch is at
[1,0]. The key is the only sheet symmetric about both creases. The other three sheets with the punch hole
are each symmetric about one crease.

**Why foil choice alone cannot fix it** (`patfold-alt.mjs`, 480 items). I counted every hole set that:
- has the key's number of holes,
- contains the punch cell,
- is at least as symmetric about the creases as the key,
- is not the key.

| Items | No such set exists | 4 or more exist (enough for all four foils) |
|---|---|---|
| all | 52 % | 12 % |
| straight folds | 89 % | 0 % |

For straight half folds, "the punch reflected across the creases" is the solution itself, so the format on a
4 × 4 sheet allows no wrong answer that passes this check. The tests and the gen.js header do not say this.
The header (js/ex/patfold/gen.js:24-25) claims that "each pick-the-best heuristic lands on the key about one
time in five", which is not true for crease symmetry.

**Fix: the lead chooses one.**
- (a) Treat crease symmetry as the format's analytic method rather than a shortcut. Prep courses teach it
  (R3 §3.4), and the analytic strategy card already describes it. Then:
  - record that decision in DECISIONS.md;
  - report the heuristic in the test as information only;
  - correct the header claim;
  - make the difficulty dims carry the layer tracking that symmetry skips (partial flaps, idle folds).
- (b) Keep rule 5 literal. Then:
  - draw only items with at least 4 symmetry-matched alternatives;
  - add those alternatives to the foil pool (widenPool);
  - add "symmetry about each crease" and "the sum over creases", with and without the punch gate, to
    `selectFoils` and to the test.

  This removes most straight-fold items.

Whichever is chosen, apply it to Fold EX-04 too (92.5 %, n 2,160; 100 % at one fold).

## 2. Angles: the vertex-to-chord-midpoint length (blocker under rule 5)

**What.** Rank the four angles by one length: from the vertex to the midpoint of the segment between the two
arm tips. Larger means smaller angle; for equal arms the length is l·cos(θ/2). Then pick the option nearest
that ranking by Kendall distance.

`chooseArms` (js/ex/angles/gen.js:196-224) balances five cues: tip distance, area, arm sum, longer arm and
shorter arm. It does not balance this length, and the node test's cue list (tests/node/angles.test.mjs:157-167)
does not try it.

**Confirmed.**
- `angles-check.mjs`, 2,250 items: 45.1 %.
- `angles-confirm.mjs`, a new set of 4,500 items: **43.2 %** across all items.

| Level | Hit rate |
|---|---|
| resolve 0 / 1 / 2 | 45.8 / 43.6 / 40.3 % |
| gap 6° / 5° / 4° / 3° / 2° | 49.1 / 49.6 / 45.5 / 36.9 / 35.1 % |
| worst cell: resolve 0, gap 5° | 53.8 % |

Bound: chance 25 % + 10.

**Not counted as shortcuts.** Two cues reach 73.2 % and 51.7 %: the chord divided by the arm sum, and the
midpoint length divided by the longer arm. For equal arms they are sin(θ/2) and cos(θ/2). They do not depend
on scale, so they are angle estimators, i.e. the skill itself.

**Fix.** Add the midpoint length as a sixth cue in `chooseArms`, with its own weight, and add it to the test's
cue list. Balancing more cues competes for the arm-length budget at wide gaps (B5's note at gen.js:34-37), so
re-check every cue after the change.

## 3. Angles: answer-only heuristics at resolve 1 and 2 (should fix)

**What.** These heuristics read only the four answer lists, not the angles. At resolve 1 the mandatory foil
swaps the middle pair; at resolve 2 it swaps the closest pair. Either way it is one adjacent swap from the
key. `chooseFoils` (gen.js:175-189) balances only the key's rank on total Kendall distance. Other
"most like the others" measures therefore single out the key.

**Confirmed** (`angles-confirm.mjs`, 4,500 new items; 1,500 per resolve level):

| Heuristic | All items | resolve 1 | resolve 2 |
|---|---|---|---|
| pick an option that has another option one swap away (Kendall distance 1) | 33.6 % | **38.8 %** | **38.8 %** |
| most common first + last number among the options | 34.0 % | **45.1 %** | 34.1 % |
| fewest shared adjacent ordered pairs | 30.4 % | **41.8 %** | 27.7 % |
| most position agreements with the other options | 32.8 % | **37.4 %** | **36.9 %** |
| options one swap from another option, then the one nearest the chord order | **37.7 %** | **45.1 %** | **43.0 %** |

The test checks these families only across all items, and only through total Kendall distance. Across all
items they sit just under 35 %. A player trains at one level at a time, so the per-level rate is what they
meet.

**Fix.**
- In `chooseFoils`, also balance:
  - which options have a partner one swap away, e.g. add a second one-swap pair among the foils, or a foil
    one swap from the mandatory foil, so the key is not the only option with a near twin;
  - the first/last-number consensus.
- In the test, add these heuristics and bound them per resolve level.

## 4. Hole Punch: the validator does not check the drawn panels (should fix)

**What.** The stem is drawn only from `item.steps`: the faces, the outline, the flap flags and the `from`
polygons that place the arrows (js/ex/patfold/view.js:90-109). Fold's `check`, which Hole Punch's validator
calls, verifies far less (js/ex/fold/gen.js:1135-1149):
- each step's outline *area*;
- the faces' *total* area;
- the hole positions.

**Confirmed** with `patfold-validator-gaps.mjs`. Each of these corruptions passes `def.validate`:
- a face shifted one cell;
- the flap flags cleared (no shading, no arrow);
- an outline mirrored;
- a step's faces mirrored;
- the arrow's `from` polygon moved.

There is no live mismatch. `patfold-check.mjs` rasterises every step at the 64 triangle centroids and compares
it with my own fold simulation: each face's area and cover, the outline, the flap shading and the arrow's
origin. All matched on 2,400 items. A mutation test shows this check catches 5 of 5 corruptions and raises no
false alarm.

**Fix.** In `check`, compare each step's faces and outline with the simulated occupancy at the triangle
centroids, and compare the `moved` flags with the fold's moved bits. Fold EX-04 has the same gap.

## 5. Painted Cubes: N = 5 and unbalanced keys in Section mode (should fix)

**What.**
- `finish` (js/ex/cubes/gen.js:265-274) lists in `item.asks` every N that 1–5 cubes have, including N = 5.
- gen.js:56-57 says N = 5 is never asked because "asking it would give the answer away".
- Section mode asks up to three questions per figure from `item.asks` (js/engine/section.js:104-133).

**Confirmed.**
- `cubes-check.mjs`, 2,400 items: N = 5 is in `asks` 774 times. Its answer is 1 cube 635 times, 2 cubes 132
  times and 3 cubes 7 times, so "1 cube" is right **82 %** of the time.
- `cubes-prior.mjs`, questions after the first, which nothing balances:

| Asked N | Most common answer | Share |
|---|---|---|
| 5 | 1 cube | 82 % |
| 1 | 1 cube | 36 % |
| 4 | 3 cubes | 34 % |
| 3 | 4 cubes | 33 % |

**Fix.** Build `asks` only from N in 1–4 that `KRANGE[cubes]` allows, or balance the later questions. Tell B7,
who consumes `asks`.

## 6. Painted Cubes: the "3–5" level label (should fix)

**What.** `{ key: 'asked', label: 'Painted sides asked', levels: ['3–5', '1–2'] }` (gen.js:355), but
`ASK_OF.many` is [3, 4] (gen.js:52). In 2,400 items N was 1 (456), 2 (744), 3 (613), 4 (587), 5 (0).

Players see the label in four places:
- the Library's dims list (js/ui/library.js:530);
- the level note (js/ui/play.js:135);
- the Free play selectors (js/ui/play.js:2189);
- share texts (js/ui/share.js:445).

The contract says every number in a user-facing text matches the code.

**Fix.** Change the label to '3–4'. It is a label, not a level index, so no version bump is needed.

## 7. Angles: arm length on phones (should fix, or decide)

**What.** R3 §8.3 asks for arms of at least 90 CSS px on phones. The arms are 0.3–1.0 × L (gen.js:69-72) and
the phone cell is about 155 px.

**Confirmed** (`misc-check.mjs`, 1,800 items):

| Arms under 90 px at a 155 px cell | Share |
|---|---|
| the longer arm | 36 % of angles |
| the shorter arm | 86 % of angles |
| the longer arm, closest pair at the 2° gap | 38 % |

The shortest longer arm is 0.196 of a cell, about 30 px. There a 2° difference moves the tip about 1 px.
`perDisplay` keeps phone ratings separate, but 2°-floor items on phones may be near the pixel limit.

**Fix.** The lead chooses one:
- raise the arm floor (e.g. to 0.55 × L) and re-check the cues;
- raise the phone gap floor to 3°;
- or let the engine pass the display class to `generate` as an extra parameter.

## 8. Angles: overflow at 150 % text (should fix; unconfirmed by me)

B2's request (docs/dev/REQUESTS-v1.1.md:30) is not marked done. It reports a 370 px page on a 360 px phone at
150 % text.

A likely cause, which I did not test in a browser: `white-space: nowrap` on the option text
(css/ex/angles.css:49). At 1.5 × in two columns of about 157 px, "3 – 1 – 4 – 2" is roughly 13 monospace
characters, about 185 px.

**Fix.** Allow the option text to shrink or wrap at large text sizes, then re-run
`tests/e2e/fit.py --ex angles --scale 1.5`.

## 9. Angles: one CSS variable for a colour and a length (nice to have)

**What.**
- `--ang-cell` is the cells' background colour (css/ex/angles.css:9, used at :20 and :27).
- Under `.pl-trial.ex-angles` on phones it is redefined as a length for the grid (:66, :71, used at :68).
- The player's trial section carries both classes (js/ui/play.js:339, 426), so the length wins there.
- The two `background: var(--ang-cell)` rules then become invalid, and the cells and the reveal's degree
  labels are transparent.

**Seen in screenshots.** tests/e2e/out/fit_b5/390x844_angles_c0i0.png shows grey cells; the harness at 1366 px
(tests/e2e/out/angles/angles_easy_1366_light_reveal.png) shows white ones. The screenshots predate the 16:56
edit, but the CSS lines are unchanged.

**Fix.** Rename the length, e.g. `--ang-size`.

## 10. Angles: reveal labels vs the stated gap (nice to have)

**What.** Design degrees sit on a 0.05° grid (gen.js:255, 259-260: `rnd(…, 20)`). `fmtDeg` (view.js:25) rounds
the *measured* values to 0.1°. A value ending in .x5 then rounds either way, depending on tiny measurement
noise.

**Confirmed** (`misc-check.mjs`): in 427 of 1,800 items (24 %), the two labels of the closest pair differ by
0.1° from the gap that the show-me caption states. Example: seed 2835398385, all levels 0. The labels read
84.9° and 90.8°, while the caption says "opens 6° wider".

**Fix.** Draw the degrees on a 0.1° grid (`rnd(…, 10)`), or label with 2 decimals.

## 11. Painted Cubes: partial counts often suffice (nice to have, for information)

These are not cheap shortcuts: each needs the painted sides counted correctly. Results from `cubes-check.mjs`,
2,400 items:

| Partial count | Right |
|---|---|
| correct counts over visible cubes only (hidden supports skipped) | 60.6 % (the shipped test prints 61.1 % as "info") |
| column tops only | 40.0 % |
| sides only, top ignored | 30.6 % (at the bound, within noise) |

So only about 39 % of items need a hidden support. The "hidden" tip and the switch card ("hidden cubes are
where counts go wrong") suggest it matters more often.

If hidden supports should matter more:
- raise the redraw probability at gen.js:258 (`visOnly === k`, now 0.6);
- add "column tops only" to the test.

## 12. Painted Cubes: key balance within cells (nice to have)

**What.** The key k is drawn evenly from N's `KRANGE` range. A failed figure search returns null, and
`generate` then retries with a forked rng that redraws N and k. Hard k values are therefore under-represented
in some cells, e.g. 18–22 cubes, tallest column 3, N 3: keys 1–5 = 0/0/8/28/39.

**Confirmed** (`cubes-prior.mjs`, 7,200 items). I learned the most common key per (cubes, height, N) cell on
half the items and tested it on the other half:
- 24.9 % overall, within the bound;
- up to 31.0 % for 18–22 cubes with tallest column 3 (n 300).

**Fix.** Keep N and k across retries; fork only the figure search.

## 13. Painted Cubes: validator independence (nice to have)

The painted-side recount is the validator's own neighbour loop (gen.js:319-328). The visibility rule, however,
uses `sight` → `render`, the same z-buffer the generator uses to reject figures (gen.js:251-252 vs 339-341).
R3 §8.4 asked for a ray cast.

My slab ray cast (8 × 8 samples per face) agrees on all 2,400 items:
- the smallest share of a column top in view is 0.516 (the rule is ≥ 0.5);
- the hidden counts are identical.

**Optional.** Put an independent ray cast in the node test.

## 14. Painted Cubes: wording close to the official sheet (nice to have)

learn.js:20 reads: "The only hidden cubes are the ones that hold up the cubes above them." It shares its first
six words with the official sentence quoted in R3 §2.2: "The only hidden cubes are the ones necessary to
support other cubes." R3 §6 asks for Parallax's own words.

Suggested: "Cubes you cannot see are there only to hold up cubes above them."

The other rules in the three learn.js files are paraphrases. I checked them only against R3's quotes and
paraphrases; the ADA sheet itself was not available to me.

## 15. Small wording points (nice to have)

- Angles' size level "right" (gen.js:65) covers 70–110°. "near-right" would be accurate in the Library and
  Free play.
- Hole Punch's idle level 2 with 2 folds is capped to 1 (`idleOf`, patfold/gen.js:78), but the selectors show
  "2". Fold has the same pattern.
- Cubes captions do not handle the singular. `tally` gives "Cube 2: 1 (top) painted sides." and `done` gives
  "exactly 1 painted sides" (learn.js:80, 83, filled in by view.js:209, 215).
- The cubes header says no two "lattice points" come closer than 0.35 edges on screen:
  - cube positions: true (0.348, offset −2, −3, −4);
  - cube corners: they come within 0.117 edges, at offset (−3, −4, −5).

---

## Checked and found fine

**Item validity.** Every answer was recomputed independently; there were no disagreements.

| Exercise | Items | What my own code checked |
|---|---|---|
| Angles | 2,250 (25 per level combination × 90) | Math.atan2 from the coordinates; exactly one true ordering; 4 distinct options; closest gap equals the level's δ within 0.05°; sizes inside the class; exactly one close pair; resolve rules hold; aligned pose has a horizontal arm |
| Hole Punch | 2,400 (100 × 24) | each cell tracked as 4 triangle centroids through every fold: the flap lands on paper, no triangle on a crease, the punch goes through whole cells and is fully on paper; key = the true holes; one option equals it; 5 distinct options with equal counts; `matters` flags and idle count right; the drawn panels match the simulation (finding 4); the key always has the punch hole (960 of 960) |
| Painted Cubes | 2,400 (100 × 24) | voxel recount agrees with `count` and `key`; options 1–5; N in 1–4 and in the level's class; every column top ≥ 51.6 % in view by my ray cast; hidden counts identical; camera basis equals az 31°, el 33.5° within 1e-16 |

On Painted Cubes uniqueness: with exact face identities, "every column top in view" already implies one
height map (a top at (x, h, z) exists only if that column has height h). R3's optional brute-force proof adds
nothing.

**Answer positions are uniform.**
- Angles: 560 / 577 / 561 / 552.
- Hole Punch: 497 / 469 / 492 / 488 / 454.
- Painted Cubes: keys 1–5 = 377 / 491 / 541 / 558 / 433 (largest share 23.3 %).

**Shortcuts within the bound, across all items.**
- Angles (bound 35 %):
  - cues: tip distance, area, arm sum, longer arm, shorter arm, arm ratio;
  - bounding box: area, width, height, diagonal; perimeter; bisector; vertex position;
  - first-vs-last contrasts by arm length, chord or area: ≤ 24.5 % (`angles-extra.mjs`);
  - answer-only: footrule consensus, Borda consensus, a fixed position (24.5–25.6 %).
- Hole Punch (bound 30 %):
  - a hole under the punch: 27.3 %;
  - another option is a turn or mirror of this one: 22.8 %;
  - adjacent hole pairs; bounding box; distance to the punch; holes on the border; shared holes;
  - a fixed position: 18.9–20.7 %.
- Painted Cubes (bound 30 %):
  - constant answers ≤ 23.3 %;
  - the novice error "cubes that show N faces", at visibility thresholds of any, 20 % and 50 %:
    11.6–12.9 %;
  - bottom counted as painted: 22.2 % (ground cubes) and 20.8 % (all cubes);
  - top counted for every cube: 27.0 %;
  - the per-cell prior on held-out items: 24.9 %.

**Validator independence.**
- Angles re-measures from the coordinates: the order from cosines, the gaps from its own atan2. It checks
  `item.deg` and `item.order` instead of trusting them. It shares only constants and a small helper.
- Hole Punch runs Fold's triangle re-simulation. It is separate from Fold's polygon-based generator, apart from
  shared line conventions, which my own simulation cross-checks. Gap: finding 4.
- Painted Cubes: see finding 13.

**Texts.**
- Numbers match the code (except finding 6): four angles; keys 1–4 and 1–5; 180°; 16 positions; five sheets;
  0–5 painted sides; 1–5 cubes; 4 × 4 in the screen-reader description; the header ranges of 4.0, 2.7 and 4.0
  logits.
- No claim of DAT score gains. Every learn.js string that names the DAT carries the exact ADA line.
- The views and CSS never name the DAT or PAT.
- The exercise codes are EX-16, EX-17 and EX-18. "PAT-" survives only in index.html comments.
- The bridges carry R3 §8.0's limitation line.
- Angles is labelled perceptual-judgement practice, in learn.js `label`/`labelLine`, library.js:176 and :475,
  and play.js:170-180.

**Timing (rule 7).**
- `present` only builds the static SVG stem and returns `timing.nextPaint()`.
- Options are drawn in `drawOption`, in the ready phase.
- Nothing saves or touches storage.
- The cube z-buffer runs only in reveal and show-me. Nothing moves during a stimulus.

**Keyboard, touch and colour (rule 8).**
- All three use `stem+options`: grid keys 1–9.
- Show-me and demo run through `ctx.play`, with Pause, Step and Replay.
- Options are `.px-choice` buttons: at least 44 px, and 3.5rem in the player. On a 360 px phone:
  - Hole Punch: 3 columns of about 105 px;
  - Painted Cubes: 5 columns of about 59 px;
  - Angles: 2 columns.
- Colour is never the only cue:
  - Angles' overlay uses solid vs dashed lines and numbers;
  - reveal tags are text with ✓;
  - Hole Punch uses filled vs open rings, dashed rings for wrong holes, and an arrow for the flap;
  - Painted Cubes uses three tones with outlines, numbered badges and dashed ghost cubes.

**Reduced motion.** Animations run only in show-me and demo, through `ctx.play`, which applies reduced motion.
The stimuli are static. Each view's fallback `runSteps` ignores reduced motion, but it runs only when
`ctx.play` is missing.

**Shipped node tests.** `PX_TEST_ITEMS=2000 node tests/node/run.mjs angles patfold cubes`: 333 checks passed
(angles 73, cubes 60, patfold 61).

## Reproduction

Scripts (run with `node <script>` from the scratchpad folder; each loads files through run.mjs's
`createContext`):

| Script | What it does |
|---|---|
| `angles-check.mjs [perCombo]` | independent re-measurement and resolve rules; about 50 heuristics |
| `angles-confirm.mjs` | findings 2 and 3, by resolve and gap |
| `angles-extra.mjs` | first-vs-last heuristics |
| `patfold-check.mjs` | own simulation, drawing check, heuristics |
| `patfold-mutate.mjs` | mutation test of my own checks |
| `patfold-sym.mjs` | finding 1 by type, and Fold for reference |
| `patfold-alt.mjs` | symmetry-matched alternatives |
| `patfold-validator-gaps.mjs` | finding 4 |
| `cubes-check.mjs` | recount, ray cast, heuristics, Section asks |
| `cubes-prior.mjs` | held-out prior; Section keys |
| `misc-check.mjs` | findings 7, 10, 15; the punch hole in the key |

The formulas behind findings 1–3:
- **Crease symmetry (1):** `sym(o, L) = |{c ∈ o : mirror_L(c) ∈ o}| / |o|`, where `mirror_L` maps cell
  (i, j) as follows:
  - v: (2c−1−i, j)
  - h: (i, 2c−1−j)
  - d: (j+c, i−c)
  - a: (c−1−j, c−1−i)

  Score = Σ over the item's folds of sym(o, L), plus 10 if o holds the punch cell. Pick the maximum; ties
  share the credit.
- **Midpoint length (2):** for each angle, `|(u + w) / 2|`, with u and w the arm vectors from the vertex.
  Order the angles by it, largest first (= smallest angle). Pick the option(s) at the smallest Kendall
  distance from that order.
- **One-swap partner (3):** the options that have another option at Kendall distance 1. Pick uniformly among
  them.
