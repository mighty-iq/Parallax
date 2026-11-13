# RV-dat-style-B: independent review of Openings (EX-14), Missing View (EX-15), Form (EX-19)

Reviewer: an agent that did not build these exercises. Date: 2026-11-13 (files as they stood at about 17:30 UTC).
Files reviewed: js/ex/{openings,patviews,form}/{gen,learn,view}.js, css/ex/{openings,patviews,form}.css,
tests/node/{openings,patviews,form}.test.mjs, the v1.1 export block at the end of js/ex/views/gen.js. Sources: R3
§6, §8.0, §8.2, §8.5, §8.6; docs/dev/progress/B6.md; CLAUDE.md standing rules 2–5, 7, 8; EXERCISE-GUIDE.md.

**Method.** I generated my own pools with my own seeds (`PX.rng.hash('rv-dat-b', ex, params, s)`), every level
combination. The pools were loaded the way tests/node/run.mjs loads the files. Then I recomputed every answer with
models I wrote from scratch. None of them calls the exercise's code:
- **Openings:** an exact model. Each half-step cell is cut into four triangles by both diagonals, which every
  lattice polygon with 45° edges respects. Silhouettes use exact z-intervals along the ray. Comparisons run under
  all eight turns and flips.
- **Missing View:** a ray-marching renderer in world coordinates, and an exhaustive search over every height map
  in the box.
- **Form:** I fold the net as a face-to-face map onto each pictured solid. Faces must be congruent with the same
  turning sense, every fold line must land on the shared edge, and marks must agree on the faces drawn.

Scripts and outputs are in `/tmp/claude-0/-home-claude/145ff06a-4b5d-5025-8cb7-e87b9d56923b/scratchpad/rv-dat-b/`
(outside the repository; the scripts are listed at the end). No browser was launched. No repository file other
than this one was written.

**Sample sizes:**
- Openings: 1,536 items (96 combinations × 16).
- Missing View: 1,512 items (72 × 21), plus 3,840 extra items at foil levels 0 and 2 (48 × 80).
- Form: 1,512 items (54 × 28).

All of them pass the exercises' own validators, and none used a fallback.

## Findings, ranked

| # | Severity | Exercise | Finding | Where |
|---|---|---|---|---|
| 1 | blocker (lead decision) | Form | Face shapes alone, with no folding, pick the key 71.0 % (91.9 % at one mark); 45.3 % even with a 25 % shape tolerance (bound 35 %). Only 8.9 % of moved marks land on a congruent face; R3 §8.6 asks for congruent faces | js/ex/form/gen.js:281-292 (286), 301-316 |
| 2 | blocker (lead decision) | Openings | Counting: "the opening's corner count equals one face outline's" picks the key 39.7 % (bound 30 %); with that face's width × height as well, 68.5 % | js/ex/openings/gen.js:673-700, 737-762; learn.js:50-52 |
| 3 | should fix | Openings | The key is on the most-featured face: always at one feature, 65.5 / 58.3 / 51.3 % at 2 / 3 / 4 features; "checks the most featured face only" 75.0 %. A partial strategy, not a cheap cue by itself, but it removes the which-face search | js/ex/openings/gen.js:714-726 (715-717) |
| 4 | should fix | Openings | At foil level 1 the proportion foil is always the stretched key, so key + foil are the most alike pair in 65.9 %; "pick one of the most alike pair" 38.6 % at that level (bound 30 %) | js/ex/openings/gen.js:762 |
| 5 | should fix (computed, not seen in a browser) | Openings | Openings are drawn at about 0.59 (desktop) / 0.45 (phone) of the solid's scale, yet the text says "at the same scale". On a 360 px phone one step (0.5 unit, the smallest difference) is about 7.5 px (R3: ≥ 11 px) | view.js:133-151; css/ex/openings.css:42, 47, 54-59; learn.js:14, 31, 50 |
| 6 | should fix | Missing View | The show-me caption for "align" foils ("one of its lines has no partner") is false for 537 of 1,087 such foils (49 %): they lack a line the given views require | js/ex/patviews/learn.js:79; view.js:295 |
| 7 | should fix | all three | Each bridge names a real-world use (part views, drafting, packaging), but its only limitation line is about DAT scores. Rule 2 wants a limitation beside the use claim (v1.0: "it has not been shown to improve grades or job performance") | openings/learn.js:76; patviews/learn.js:82; form/learn.js:78 |
| 8 | should fix | Missing View, Form | The validators decide uniqueness with the generators' own code: patviews `search`/`crossStyles`/`pairV`/`drawView`/`possibleViews`; form `possible`/`matchings`/`seenFaces`. Rule 4 asks for an independent validator. No item is wrong in my sample | patviews/gen.js:577-579 vs 500-503, 267-346; form/gen.js:463 vs 338 |
| 9 | should fix (minor) | Missing View | At foil level 2 (front or end missing), grouping options by line layout and ignoring solid/dotted picks the key 37.9 % / 37.6 % (n = 640 each; bound 35 %; whole pool 26.9 %) | js/ex/patviews/gen.js:461-482, 515-526 |
| 10 | nice to have | Form | The mark's background is `--stim-face-3`, the same fill as an unmarked far-lit face (`.px-fig-far`). 39.7 % of option pictures show such a face beside a mark, so only the hatch separates them. Hatch pitch < 4 px in about 9 % of desktop items (computed) | css/ex/form.css:11; css/base.css:611; form/view.js:40-48, 117; learn.js:13 |
| 11 | nice to have | Openings | The keyview level fixes the key's face: front / side / top in 100 % of items at levels 0 / 1 / 2. Harmless under the default "high" variability policy (levels rotate); learnable under "low" | js/ex/openings/gen.js:298, 712 |
| 12 | nice to have | Openings | The caption "one notch, step or cut differs" is wrong for at least 12.7 % of feature foils, which differ from the nearest outline in 3 or more separate places | js/ex/openings/learn.js:73 |
| 13 | nice to have | Form | The tip "count the faces" can never eliminate an option: all four options are the same kind of solid ("same kind" solver 25.0 %) | js/ex/form/learn.js:26 |
| 14 | nice to have | Form | "The face marked ✗ is turned the wrong way" is shown for mirror foils with fully shaded faces only (178 of 389 mirror foils, at mark levels 0–1) | js/ex/form/learn.js:76; view.js:259 |
| 15 | nice to have | Openings | The validator shares `featuresSeen` with the generator and never checks the drawn surface (`lib.surface`). I checked the surfaces of all 1,536 items: correct | gen.js:730-731, 820-821; view.js:84 |

**No item validity disagreements.** On all items checked, my independent models agree with every key and every
foil (details in §A). There is therefore no seed list of wrong items.

---

## 1. Form: marks move to faces of another shape, so shape matching replaces folding (blocker, lead decision)

**What.** R3 §8.6 specifies the mark foil as "marks moved to a **congruent** face (adjacency broken)". `moveMark`
(gen.js:286) instead takes any unmarked face as the new place: `free = m.map(... !x && (... || s.faces[g].length
=== 4) ...)`. On the pool, a moved mark lands on a face congruent to its old one in only **8.9 %** of 3,180 moves
(the other 211 mark foils turn a half mark in place). A player can therefore reject most foils by asking one
question: is the shaded face in the picture the same shape as the shaded face in the pattern? That needs no folding
and no adjacency.

**How confirmed.** fm-shortcuts.mjs on pool-form.json (1,512 items; output fm-shortcuts.out). Every solver keeps the
key; foils fail when a clearly seen face (cos ≥ 0.2) contradicts the pattern.

| Solver (no folding) | all | marks 0 | marks 1 | marks 2 |
|---|---|---|---|---|
| face-by-face: a seen face whose shape occurs in the pattern only marked (or only plain) must agree | **71.0 %** | 91.9 % | 71.4 % | 49.8 % |
| every drawn mark sits on a face shaped like a marked pattern face | 64.5 % | 88.5 % | 56.8 % | 48.2 % |
| the same two with a 25 % size tolerance and 0.2 proportion tolerance ("rough shapes") | 43.2 % / **45.3 %** | 54.8 % / 59.9 % | 41.9 % / 39.7 % | 36.4 % (marked) |
| the same with corner counts only (triangle / four-sided / five-sided) | 31.0 % / 31.3 % | 37.4 % / 37.4 % | — | — |

The excess holds at every solid, view and foil level (42.1–47.2 % for "rough shapes, marked faces", 67.2–74.9 % for
the exact face-by-face solver). Two
concrete items (params `{solid 0, marks 0, view 0, foil 1}`):
- seed 2714452875, a trapezoid prism:
  - The pattern shades the 3.5 × 2.5 rectangle.
  - Foils 1 and 2 shade a trapezoid end; foil 3 shades a 3.5 × 2.14 slanted side.
- seed 3403102013, a 3 × 1.5 × 4 box:
  - The pattern shades a 4 × 3 face.
  - The three foils shade 4 × 1.5, 3 × 1.5 and 4 × 1.5 faces.
  - R3's design would instead have moved the shade to the opposite 4 × 3 face, which only its neighbours tell apart.

**Suggested fix.**
- **Restrict mark moves.** In `moveMark`, restrict `free` to faces congruent to the source face (same corner count
  and side lengths), as R3 §8.6 says.
- **Fall back when no congruent face is free:**
  - swap which of two congruent faces carries a mark;
  - use the mirror arrangement or a half-mark turn;
  - otherwise reject the item.
- **Place the pattern's marks well.** Prefer faces that have a congruent partner (on boxes, prism ends, frustum
  sides), so the marked face's shape alone does not name it.
- **Test it.** Add the face-shape solvers to `SOLVERS`/`WEIGHTS` (gen.js:301-316) and to tests/node/form.test.mjs,
  with the 35 % bound. The "rough shapes" version is the one a person can actually use.
- My scripts fm-model.mjs and fm-shortcuts.mjs can be ported as they are.

## 2. Openings: counting corners, then box sizes, finds the key (blocker, lead decision)

**What.** The builder measured only stem-blind corner solvers ("most / fewest corners"). The stem-based versions
are over the bound. A player counts the corners of each face outline on the pictured solid and of each opening.
Corner counts are unchanged by turns and flips, so no mental rotation is needed.

**How confirmed.** op-shortcuts.mjs on pool-openings.json (1,536 items; output op-shortcuts.out). Shapes are
exact; the key's share counts ties.

| Solver | all | per level |
|---|---|---|
| corner count equals some face outline's | **39.7 %** | 33.7–45.7 % at every level |
| corner count equals the most-featured face's | 37.2 % | 30.9–43.4 % |
| box (w × h either way) and corner count equal some face's | **68.5 %** | 57.5–82.3 % |
| box equals a pair of the solid's sizes (builder's "box fits") | 22.0 % | — |
| odd one out by corner count (stem-blind) | 10.1 % | — |

- **How many options pass the corner test.** Exactly 1 option passes in 126 items, 2 in 393, 3 in 493, 4 in 368
  and 5 in 156; the expected share, 610 / 1,536 = 39.7 %, matches.
- **Example** (seed 715425626, `{features 1, edges 0, keyview 0, pose 0, foils 0}`):
  - The face outlines have 12 / 4 / 4 corners.
  - The options have 16, **12**, 16, 16 and 16 corners.
  - The key is the only 12-corner opening.
- **The app teaches this route.** Its own analytic card (learn.js:50-52) says, in order:
  1. Match width and height.
  2. Count notches, steps and slanted edges.
  3. Compare lengths last.

  Steps 1 and 2 alone reach 68.5 %, without checking where any feature sits.

**Suggested fix.**
- **Balance the foil sets.** Add "corners equal a face outline's", "box and corners equal a face outline's" and
  "corners equal the most-featured face's" to `SOLVERS` (gen.js:673) and `WEIGHTS` (684), so `chooseFoils`
  balances them.
- **Require two passing foils.** R3 already asks that at least 2 foils pass the box test; require the same for box
  plus corners.
- **Favour count-keeping siblings.** Moves, resizes, side flips and corner swaps keep the corner count; prefer them
  over feature additions and removals.
- **Test it.** Put these solvers in tests/node/openings.test.mjs with the 30 % bound.

## 3. Openings: is the key predictable from the most-featured face? (should fix; answers the lead's question)

**Yes.** `build` puts the first feature on the key's profile and later ones on the other two with probability 0.7
(gen.js:715-717). Measured on the pool (op-shortcuts.out; ties are shared):

| features level | 0 (1 feature) | 1 (2) | 2 (3) | 3 (4) |
|---|---|---|---|---|
| key on the (or a tied) most-featured profile | 100.0 % | 65.5 % | 58.3 % | 51.3 % |
| only one profile carries features | 100.0 % | 31.0 % | 9.4 % | 1.0 % |
| "checks the most featured face only" (exact outline match) | 100.0 % | 72.4 % | 66.7 % | 61.0 % |

Overall it is 75.0 % (the builder's 75.7 % agrees).

**Cheap cue or partial strategy?** By itself it is a genuine partial strategy. The player must still match that
face's outline exactly against its siblings, and turned or flipped. Two things make it more than that:
- It removes the other half of the format: deciding which of the three outlines to test. With one feature
  (features level 0, the easiest level and the one beginners see most) the face is given away: it is the only face
  with a notch.
- Combined with counting (finding 2) it becomes a cheap cue: "corner count equals the most-featured face's" scores
  37.2 %.

The builder's "checks the front face only" (46.7 %) is different. It is the keyview dim by design (100 % at
keyview 0, 20 % elsewhere), see finding 11.

**How the generator could stop it** without breaking the format (any one helps; the first two together bring it
to about half):
1. **Never let one profile carry all the features.** At features level 0, use one feature on the key's profile and
   one on another; that level then tests "which face?" too. Alternatively, keep a pure extrusion but sometimes make
   the key a plain face, with wrong-proportion rectangles among the foils. That changes the level's character, so
   it is a lead decision.
2. **Allocate the remaining features without looking at the key.** Draw an allocation with at least one feature on
   the key's profile and one elsewhere. Accept allocations so that the key's profile is the unique maximum no more
   often than any other given profile.
3. **Report the solver with an explicit bound** (for example ≤ 50 %). It cannot fall to chance while the key's
   outline must carry a feature.

## 4. Openings: the proportion foil is the key's twin (should fix)

**What.** At foil level 1 the only proportion foil is `stretch(rng, key)` (gen.js:762), so the key always has a
look-alike. Scaling each option to a unit box (shape with size ignored), the most alike pair of options is
{key, proportion foil} in **65.9 %** of foil-1 items. "Pick one of the most alike pair" scores **38.6 %** at foil
level 1 and 32.0 % over the pool (bound 30 %). After that, a ratio check decides between the two.

**How confirmed.** op-shortcuts.mjs, per-level block of op-shortcuts.out (n = 768).

**Suggested fix.** Stretch a sibling instead of the key, or add a stretched sibling as well (two twin pairs), and
add "one of the most alike pair, size ignored" to the solvers.

## 5. Openings: openings are not drawn at the solid's scale (should fix; computed, not seen in a browser)

**What.** `drawOption` caps each opening at `size × st.k` px (view.js:151), which is the solid's px per step. The
CSS then caps the SVG height at 9rem on desktop (css/ex/openings.css:42), 5.75rem at 40rem or less (47), and the
phone cell (54-59). In practice the cap always binds.

**Estimates** (scale-estimate.mjs, output scale-estimate.out). They come from the view's camera frame and the CSS
sizes, assuming a 900 × 307 px stage on desktop and the 360 × 640 player layout:

| | openings' scale ÷ the solid's scale | px per 0.5-unit step (the smallest feature or difference) |
|---|---|---|
| desktop | median 0.59 (p10 0.49, p90 0.66) | median 12.9 px |
| 360 × 640 phone | median 0.45 (p10 0.37, p90 0.50) | median 7.5 px (p10 6.4 px) |

**Texts this contradicts:**
- The "Exact fit" part (learn.js:14): "An opening must match the outline exactly, at the same scale: one that is
  too large or too small is wrong."
- The proportion tip (31) and the analytic card's first step (50), which ask the player to compare lengths with the
  solid.
- R3 §8.0: "Every figure and its options share one scale … (Openings, Form)".
- R3 §8.5: features ≥ 11 px.

No item becomes wrong, because no foil is a uniformly scaled copy. Form and Missing View stay at their stem's
scale: median ratio 1.00, with p10 0.81 for Form on desktop.

**Suggested fix.** Either cap the solid's camera scale at the openings' px per step, so both share one scale, or
change the texts to "all openings share one scale; compare proportions". On phones consider larger cells so that
a step reaches 11 px. A screenshot check in fit.py would confirm the numbers.

## 6. Missing View: the "align" caption is wrong for half of those foils (should fix)

**What.** The proof `alignFails` compares the sets of line positions. A foil can fail it in two ways:
- it has a line where the neighbouring view has none (an extra line);
- it lacks a line that the given views require (a missing line).

The caption (learn.js:79, played by view.js:295) only describes the first: "Drawing {n}: one of its lines has no
partner in the given views."

**How confirmed.** pv-align.mjs on pool-patviews.json. Of 1,087 "align" foils, 480 have only extra lines, **537
have only missing lines** and 70 have both. Example: seed 435973333, `{cubes 0, grid 0, missing 0, foil 0}`, the
end view missing. The top view has horizontal lines at depths 0, 1 and 2, so the end view needs vertical lines
there. Drawing 2 has them at 0 and 2 only: it lacks one, and none of its own lines is unpartnered.

**Suggested fix.** "Drawing {n}: its lines do not line up with the lines of the given views." Alternatively, choose
between an extra-line and a missing-line caption from the same check.

## 7. All three bridges: real-world use claims without their limitation (should fix, wording)

**What.** The three bridges each make a real-world use claim:
- "… as in reading a part's views" (Openings);
- "Drafters and machinists read top, front and end views like these" (Missing View);
- "Folding patterns into solids is everyday work in packaging and sheet-metal design" (Form).

Each is followed only by the DAT limitation. Rule 2 requires the limitation line beside every "where this is used"
text. The v1.0 bridges add "Practising here improves this task and often similar ones; it has not been shown to
improve grades or job performance." B5's bridges avoid naming real-world uses at all.

**Suggested fix.** Add the v1.0 sentence after the use claim, or drop the use claim. The DAT sentence and the ADA
line are correct as they are; see §4 below.

## 8. Missing View and Form: validators share the generators' deciding code (should fix, rule 4)

**Missing View.**
- `validate` re-renders the true views with `drawRay` (independent of `drawView`) and checks the given drawings and
  the key with it. That part is good.
- Uniqueness, however, calls the same `search()` the generator used (gen.js:577 vs 500). Its column and row pruning
  is `crossStyles`/`pairV`, its final check defaults to `drawView` (269), and `possibleViews` draws the missing view
  with `drawView` too (579).
- An incompleteness bug in the pruning would hide a possible foil from both. The builder's brute-force comparison
  covers only boxes up to 3 × 3 × 3 (tests/node/patviews.test.mjs:87); items go up to 4 × 4 × 4.

**Form.**
- `validNet` folds the net independently of `unfold`. That part is good.
- Each option, however, is judged by `possible()` (gen.js:463), the very function `buildItem` used to admit the foil
  (338), with the shared `matchings`, `seenFaces` and `facing`.
- The net's marks are never compared with the options directly. The chain is net → solid (independent), then
  solid → options (shared).

**How confirmed.**
- By reading the code.
- My independent checks found no error, so this is a robustness finding, not a wrong item:
  - Missing View: 5,352 items.
  - Form: 1,512 items.
- My Missing View search agrees with brute force in 450 / 450 cases, on boxes 2×2×3, 3×2×2, 2×3×3, 3×3×2, 4×2×2
  and 2×4×2. Its locality assumptions hold in 288,000 / 288,000 checks on random 4 × 4 × 4 maps (pv-selftest.mjs).

**Suggested fix.**
- **Missing View.** Pass `check:` a `drawRay` adapter in `validate`. Also derive the pruning signatures from
  `drawRay` on a lone column or row; my pv-model.mjs does this from its own renderer.
- **Form.** Judge options by folding the net onto each option solid (a face map with congruence, fold lines and
  marks), as fm-model.mjs `foldable()` does.

## 9. Missing View, foil level 2: the key's line layout is always the largest group (should fix, minor)

**What.** At foil level 2, with the front or end view missing, the set must contain a "dashes" foil (gen.js:521).
That foil is the key with one run switched between solid and dotted, so it has the key's line positions exactly.
"Lines" foils have other positions. Ignoring styles, the key therefore always sits in the largest group:
- 1 dashes + 2 lines foils: the solver gets 1/2;
- 2 dashes + 1 lines foil: 1/3;
- 3 dashes foils: 1/4.

**How confirmed.** pv-shortcuts.mjs on pv-extra.json (n = 640 per cell): 37.9 % (end), 37.6 % (front). The main
pool gives 38.3 % and 37.1 % (n = 168). The whole pool is 26.9 % (in bounds).

**Suggested fix.** At that level, use only dashes foils, or pair each lines foil with its own flip. Add "like the
others, line positions only" to `SOLVERS` (gen.js:461).

## 10–15. Nice to have

10. **Form mark tone** (css/ex/form.css:11 `.fm-hatch-bg { fill: var(--stim-face-3) }` = css/base.css:611
    `.px-fig-far`).
    - **How common.** An unmarked face drawn in the far tone appears in 39.7 % of option pictures, and in 81.7 % of
      items at least once (fm-tones.mjs). In those pictures the hatch alone separates a mark from a plain face.
    - **Is the rule broken?** The hatch is a non-colour cue, and its lines also darken the mean tone, so rule 8
      holds. But "carry a tone and a hatch" (learn.js:13) is only half true there.
    - **Pitch.** The hatch pitch is `5 / st.k` units, set from the pattern's scale (view.js:117). Where the option
      SVG is capped smaller, the pitch falls below R3's 4 px in about 9 % of desktop items (computed).
    - **Fix.** Give marks their own darker token, and size the pitch from the option's rendered px per unit.
11. **Openings keyview fixes the face** (gen.js:298, 712). At keyview 0 / 1 / 2 the key is always the front / side /
    top outline: the "checks the X face only" solvers score 100 % at their level and 46.7 % overall.
    - Under the default `'high'` variability policy, js/engine/select.js rotates the least-recently-used levels, so
      this is not exploitable there.
    - It is exploitable under `'low'`, which changes one dim per item.
    - Option: level 1 = front or side at random, level 2 = any face.
12. **"One notch, step or cut differs"** (learn.js:73) does not hold for 12.7 % of 5,376 feature foils (3+ separate
    difference regions against the nearest outline; op-diffparts.mjs). Sibling foils are up to three mutations from
    the key (gen.js:750-761). Suggested: "its notches, steps or cuts differ from every outline of the solid".
13. **Form tip "count the faces"** (learn.js:26): every option is the same kind of solid, so counting never helps.
    Suggested: "compare the face shapes and sizes".
14. **Form `whyMirror`** (learn.js:76) for full-shade mirror foils: "turned the wrong way" reads oddly when no
    face carries a half mark (34 at marks 0, 144 at marks 1). Suggested: "Solid {n} is the mirror image of the
    folded pattern", mentioning a turned face only for half marks.
15. **Openings validator.** `featuresSeen` is shared by `build` (730-731) and `validate` (820-821), and the solid
    the player sees (view.js:84, `lib.gridsOf` + `lib.surface`) is not validated.
    - I checked it on all 1,536 items with op-surface.mjs:
      - every face lies on the boundary of my solid (just inside along −n, just outside along +n);
      - every surface is closed;
      - every volume matches my exact z-length integral within 0.4 %.
    - Worth porting into the node test.

---

## A. Question 1: item validity (recomputed independently)

**Openings** (op-check2.mjs, op-exact.mjs; output op-check2.out; 1,536 items)

*Model.*
- Silhouettes along x, y and z are computed exactly: the point is in the axis profile, and the other two profiles'
  sections along the ray overlap.
- Each option is compared under all 8 turns and flips; a match needs equal boxes and zero difference area.

*Results.*
- Interactions: 0. Every silhouette equals its own profile, as the generator requires.
- The key fits its stated axis: 1,536 / 1,536. It fits no other axis: 0.
- Foils that fit any silhouette under any turn or flip: 0.
- Foil distinctness:
  - Foils with an equal box (5,526): the difference is at least 0.5 unit² (median 1.5) and always holds a disc of
    diameter 0.5 unit or more (median 1.0).
  - The other 618 foils differ in box size by at least 0.5 unit.
- Option pairs with an equal box (7,604): they always differ by at least 0.5 unit². R3's distinctness criterion
  holds exactly at its minimum.
- An earlier run of mine with 3D point sampling flagged boundary slivers. These came from sampling and disappeared
  with the exact model; they were not item errors.
- The drawn solids are correct (finding 15).

**Missing View** (pv-check.mjs, pv-model.mjs; outputs pv-check.out and the run on pv-extra; 1,512 + 3,840 items)

*Model.*
- My renderer marches rays toward the viewer from a quarter cell on each side of every 3D edge. An edge is solid if
  it is seen from either side, dotted if it is hidden from both.
- The class searched is the one told to the player: every height map in the W × D box, at most H high, connected or
  not.

*Results.*
- Given drawings identical: 5,352 / 5,352. Keys identical: 5,352 / 5,352.
- Foils that are the third view of some height map with both given views: 0.
- The key is among the possible third views: always.
- Searches over budget: 0.
- Every stated reason (`hull`, `align`, `search`) matches my class-free recomputation.
  - The silhouette-hull and line-alignment proofs are sound for any union of cubes, not only height maps. On a plane
    x = X, edges along y and along z both bound the regions where the occupancy difference across the plane changes
    sign, so each exists exactly when the other does.
- Top-missing options with dotted lines: 0.
- Options of the wrong size: 0. Identical options: 0.
- The two views fix the third in 93.3 % of items. Solutions per item: median 1, p95 2, max 518.

**Form** (fm-check.mjs, fm-model.mjs; output fm-check.out; 1,512 items)

*The nets:*
- All are counter-clockwise, so the outside faces up as drawn.
- None overlaps (sampled every 0.02 unit).
- Every dashed line is an edge shared by two faces, and no cut edges touch.

*Results:*
- Keys foldable with every drawn mark agreeing (cos > 0): 1,512 / 1,512.
- Foils foldable with only the clearly seen marks agreeing (cos ≥ 0.2, the validator's evidence): 0.
- By foil kind:
  - "shape" foils: 0 / 756 have a congruent net map;
  - "marks" foils: 3,391 / 3,391 have one;
  - "mirror" foils: 389 / 389 have one.

  In other words, only the marks rule out mark and mirror foils, and they always do.
- Every option shows at least 3 clearly seen faces.

## B. Question 2: independence of validators

- **Openings: mostly independent.**
  - The key and foils: the generator's exact quarter model against the validator's ray casting through the stored
    polygons (`raySil`, `rcompare`).
  - Shared code: `featuresSeen` (used by both), `tfPoint`/`tfPoly`/`pip`/`rayIntervals` (low risk).
  - The drawn surface is not validated (finding 15; I verified it).
- **Missing View: not independent for uniqueness** (finding 8). `drawRay` independently checks the stem and the key;
  the exhaustive proof is shared.
- **Form: not independent for options** (finding 8). Only the folding of the net is independent.

## C. Question 3: shortcuts and position balance

**Openings** (chance 20 %, bound 30 %; op-shortcuts.mjs, op-oddcorners.mjs)

*Within bounds:*

| Solver | Share |
|---|---|
| largest / smallest area | 13.8 / 9.4 % |
| most / fewest corners | 9.8 / 24.1 % |
| most / fewest slanted edges | 19.8 / 13.7 % |
| like the others / odd one out (exact areas, best turn) | 20.4 / 7.5 % |
| box = a pair of the solid's sizes | 22.0 % |
| box = the most-featured face's | 27.7 % |
| odd one out by corner count | 10.1 % |

*Over the bound:*

| Solver | Share | Finding |
|---|---|---|
| corners = a face outline's | 39.7 % | 2 |
| corners = the most-featured face's | 37.2 % | 2 |
| box and corners = a face's | 68.5 % | 2 |
| most-alike pair | 38.6 % at foil level 1 | 4 |
| most-featured face only | 75.0 % | 3 |
| front / side / top face only | 46.7 % | 11 |

*Position balance:*
- Key position: 20.3 / 21.5 / 19.6 / 19.7 / 18.9 %.
- Key turn or flip: 11.7–13.2 % for each of the 8.

**Missing View** (chance 25 %, bound 35 %; pv-shortcuts.mjs; 1,512 items, plus 3,840 for per-level checks)

*Within bounds over the whole pool:*

| Solver | Share |
|---|---|
| most / fewest solid | 22.3 / 20.4 % |
| most / fewest dotted | 23.0 / 21.0 % |
| most / fewest lines | 25.1 / 21.2 % |
| fewest / most dotted runs | 20.7 / 23.8 % |
| largest / smallest area | 27.0 / 26.4 % |
| like the others / odd one out, all units | 24.5 / 17.0 % |
| like the others / odd one out, lines only | 26.9 / 18.5 % |
| like the others / odd one out, fill only | 25.0 / 27.1 % |
| like the others / odd one out, counts | 26.0 / 23.6 % |
| agrees with the majority | 25.1 % |
| outline only (silhouette hull) | 27.3 % |
| solid / dotted count closest to the given views | 27.8 / 24.8 % |

*Over the bound:*
- **Lines-only like-the-others at foil level 2:** finding 9.
- **Projection reasoning (by design):** "line positions only (alignment)" scores 37.2 % overall and 44.6 % at
  foil 0. Adding the outline check gives 39.0 %, and 53.3 % at foil 0. This is the "Line up and eliminate" strategy
  and R3's level-0 design, which uses outline foils. It is the skill, not a cue.
- **Outline only at foil 0:** 35.2 / 35.4 % (front / end), also by design.

*Position balance:* 25.4 / 25.0 / 26.7 / 22.9 %.

**Form** (chance 25 %, bound 35 %; fm-shortcuts.mjs)

*Within bounds:*

| Solver | Share |
|---|---|
| most / fewest marks drawn | 26.6 / 23.0 % |
| most / fewest faces drawn | 24.2 / 26.1 % |
| as many marks drawn as the pattern has | 26.6 % |
| a half mark drawn | 24.0 % |
| same solid kind | 25.0 % (all options share the kind) |
| proportions: every drawn face shaped like a pattern face | 28.8 % |
| like the others / odd one out (drawn faces + marks) | 27.2 / 15.9 % |
| marks touch only if they touch in the pattern | 24.8 % |

*Over the bound:* the face-shape cues of finding 1.

*Position balance:* 25.9 / 22.4 / 25.3 / 26.4 % (χ² p ≈ 0.12).

## D. Question 4: texts

- **The ADA line.** It appears, character for character as in R3 §6, in each exercise's bridge. The bridge is the
  only place the DAT is named; the view files and CSS never name it.
- **Naming.** "Dental Admission Test" is spelled out at its first mention.
- **Claims.** There is no claim of DAT score gains. "Parallax has not measured any effect on DAT scores" is the R3
  wording.
- **Copying.** No B6 player text shares a run of 4 or more words with any of the 28 official or prep strings that
  R3 §2–3 quotes (text-overlap.mjs; the near hits were R3's own prose, cited in code comments).
- **Numbers.** Every number matches the code:
  - "Five openings … (1–5)" for Openings; "Four drawings … (1–4)" and "Four solids … (1–4)" for the others.
  - The level tips trigger on the dims they describe.
  - "the front is on its left" for the end view and "the front at the bottom" for the top view: confirmed by my
    renderer reproducing every given drawing.
- **Rule statements checked against the code:**
  - "every cube on the ground or on another cube" is the class actually searched;
  - "hidden faces may carry anything" is the validator's evidence rule;
  - "A slanted cut shows as a slanted edge in one outline only" is true, because interactions are rejected.
- **Problems:** findings 5, 6, 7, 12, 13 and 14 (scale claims, the align caption, the bridge limitations, three
  captions or tips).

## E. Question 5: rendering and input (read from view.js; no browser)

- **No heavy work during a stimulus.** Heavy work happens in `drawOption` / `newItem`, in the ready phase:
  - Openings builds the solid and its surface there;
  - Form and Missing View compute their projections and scales there.

  `present` draws the stem and returns `timing.nextPaint()`. During the response phase only re-renders on theme or
  resize events run. `reveal` waits 250 ms.
- **Keyboard.** `stem+options` grids take 1–5 / 1–4. Show-me keys are handled by the player.
- **Touch targets.** Computed from the CSS: on a 360 × 640 phone the cells are 104 px (Openings), 128 px (Missing
  View) and 160 px (Form); on desktop they are at least 88 px (`.px-choice` min-height).
- **Colour is never the only cue:**
  - Openings: a dark hole with a 2 px rim on a pale plate; the show-me ghost and true outlines differ in dash
    pattern.
  - Missing View: solid against dashed (4 / 3.5 px, non-scaling); difference marks are thick dots; the missing slot
    is a dashed frame with "?".
  - Form: marks are hatched (finding 10 for the tone); face highlights change stroke width; show-me tags are letters.
  - Reveal tags are words plus ✓.
- **Reduced motion.** Delegated to `ctx.play`, which uses keyframes about 400 ms apart. `revealStage` scrolls with
  'auto' under reduced motion. Nothing flashes.
- **Overlay leak.** The Openings show-me outline is a fixed overlay on `document.body`. Closing show-me mid-step
  still runs every remaining `exit()` (js/ui/play.js:249) and `unmount` clears it, so it cannot leak.

## F. Unconfirmed or not checked

- **Scale and pitch figures** (findings 5 and 10) are computed from the CSS and view code for assumed layouts, not
  measured in a browser.
- **Feature visibility in the Openings picture** rests on the shared `featuresSeen`; I did not write an independent
  z-buffer check. Every profile's outline lies on a face that faces the camera, which makes hidden features unlikely.
- **Class-only Missing View foils.** I did not test whether "search"-only foils would be possible for cubes that
  hang in the air. The tutorial states the class ("Nothing hangs in the air", learn.js:17), so the items are correct
  for the class the player is told.

## Scripts (all in the scratch folder named above)

| File | Purpose |
|---|---|
| load.mjs, gen-pool.mjs, gen-filter.mjs | pools from my own seeds (pool-*.json, pv-extra.json) |
| op-exact.mjs, op-check2.mjs | exact Openings model and item check (op-model.mjs / op-check.mjs: the earlier sampled version) |
| op-surface.mjs | the drawn surfaces against my model |
| op-shortcuts.mjs, op-oddcorners.mjs, op-diffparts.mjs | Openings strategies, corner odd-one-out, difference regions |
| pv-model.mjs, pv-selftest.mjs, pv-check.mjs | Missing View renderer, search self-test, item check |
| pv-shortcuts.mjs, pv-align.mjs | Missing View strategies, align-caption classes |
| fm-model.mjs, fm-check.mjs | Form folding by face maps, item check |
| fm-shortcuts.mjs, fm-tones.mjs | Form strategies, mark tone overlap |
| scale-estimate.mjs | stem and option scales from the view code and CSS |
| text-overlap.mjs | shared word runs with the quoted official wording |

Run with `node <script>` from the scratch folder, one at a time. The Openings scripts take 15–90 s on the shared
machine.
