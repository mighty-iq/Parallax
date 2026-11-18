# D2. A first band and a taught start for the DAT-style exercises and Views

Phase 1 research note for v1.2, milestone 1, first bullet ("An easier, better-taught start"). Started 2026-11-18 11:19 UTC on branch `build`.

Scope: Views (`views`), Angles (`angles`), Painted Cubes (`cubes`), Openings (`openings`), Form (`form`), Hole Punch (`patfold`), Missing View (`patviews`).

Labels used throughout:
- **[Studies]** what published work found (effect sizes, samples), with how much of each source was read;
- **[Code]** what the repository shows today (file and function names, sampled items, simulations on the real definitions);
- **[Proposal]** what this note recommends for v1.2.

How the [Code] numbers were made: small read-only Node scripts outside the repository loaded the pure files exactly as `tests/node/run.mjs` does (`createContext()`), generated items from seeds, and played the engine with the test suite's simulated learners (`tests/node/fixtures/learner.mjs`: `Learner`, `newRecord`, `playSession`) on the **real** exercise definitions. No repository file was changed. The scripts are described in §3.9 so the builder can recreate them.

## 0. Summary of answers

(filled last)

## 1. What a first-time player faces today [Code + review findings]

### 1.0 How the engine starts a new player

- **Start of the rating.** μ0 = easiest item + 1.0 logit, σ0 = 1.0 (`js/engine/model.js` `prior`, `js/engine/estimator.js` `prior`). Averaged over that belief, the easiest item predicts 75 % (four options) or 74 % (five options): just under the Balanced target (78 % and 76 %). So every first item comes from the floor or just above it.
- **Order of a session** (`js/engine/modes.js` `kindFor`): two warm-ups (target + 10 points), then shuffled decks of 10 per session (8 target, 1 easy, 1 stretch at g + (1 − g)·0.5). In my simulation (200 beginners per exercise, session times varied so the deck order varies), **about one beginner in three meets the stretch item among their first five rated items** of the exercise. For a fresh rating the stretch sits about 1.4 logits above the floor and usually adds two or three new features at once:
  - Views: 6 cubes on a 4 × 4 grid;
  - Painted Cubes: columns 4 high with "1–2 painted sides";
  - Openings: slanted cuts, the solid lying, a proportion foil;
  - Form: three marks with marks-only foils;
  - Missing View: the top view missing with same-outline foils.
- **The level shown** is the difficulty answered right at g + (1 − g)·0.75, mapped linearly so that level 1 is the easiest item (`estimator.level`). It rounds to 1 while μ ≤ floor + 1.30 logits, i.e. while the predicted success on the easiest items is at most about 81 % (four options). The prior itself shows level 1. **A player who gets the floor items right three times in four sees "level 1" for as long as that lasts.** That is part of why a player "stayed at level 1 of Views": level 1 is a band 1.3 logits wide, and nothing below it can move.
- **Tutorial flow** (`js/ui/play.js` `wtg`, `offerWtg`): a "New: <exercise>" card ("about a minute", which O6 found wrong for Form), then:
  - Watch: one demo item at the easiest level, captions held at least 3 s each (`DEMO_CAPTION_MS`), then "Your turn";
  - Try: 3–5 practice items, never logged, with tips; answers vary their slot; a wrong answer replays show-me automatically;
  - Go: rated items.
- **What is not shown before the first item:**
  - The strategy cards appear only on the exercise page and in How to play, and in a session after two misses in a row (`S.misses[key] >= 2`).
  - On phones, the labelled parts (which carry the rules) are folded behind a "Parts" button during the Watch.
  - **`learn.rules` is never rendered.** Angles (2 rules), Painted Cubes (3) and Hole Punch (3) define it in learn.js, and no file in `js/` reads it (grep for `.rules` and `learn.rules`). Painted Cubes' rules "a hidden cube is there only to hold up others" and "a cube under another has no painted top" therefore reach the player only through the demo's captions.
- **Simulated first sessions on the real definitions.** One pinned 10-minute Train session per learner, 200 learners per cell. A = true starting ability in logits above today's floor; the test suite's own learners start at A = 1.75 ± 0.85.

| Exercise | A = −1 | A = 0 | A = +1 | A = +1.75 | Median level after the session (A = +1 / +1.75) |
|---|---|---|---|---|---|
| Views | 45 % | 58 % | 70 % | 81 % | 1 / 11 |
| Angles | 44 % | 58 % | 75 % | 83 % | 1 / 12 |
| Painted Cubes | 43 % | 56 % | 70 % | 79 % | 1 / 12 |
| Openings | 44 % | 56 % | 70 % | 78 % | 1 / 11 |
| Form | 46 % | 58 % | 72 % | 80 % | 1 / 10 |
| Hole Punch | 42 % | 56 % | 73 % | 80 % | 1 / 14 |
| Missing View | 46 % | 58 % | 72 % | 80 % | 1 / 9 |

  Cells show success on the first 10 rated items; the first five give the same picture.
- **What the table says.**
  - The model's own beginners (A = 1.75) already reach about 80 % at today's floor. So "simulated beginners reach about 80 % at the new floor" is met today, by construction: it says nothing about real beginners.
  - The players who wrote in behave like A ≈ 0 or below on these formats: about 55 % right and level 1 for weeks.
  - Every exercise test asserts that "a beginner at θ = 0 gets the easiest items about 90 % right" (e.g. `tests/node/views.test.mjs:46`). That is a hand-set anchor; no player data fixes it yet.

### 1.1 Views (`js/ex/views`)

- **Floor.** The pool's easiest item is the `count` variant (b −2.4). A first session never sees it, though: Train's first stage runs one variant at a time, and the first run is `toview`. In my simulation, 79 % of a beginner's first five rated items were {4 cubes, 3 × 3 grid, top view} (b −2.2); the rest were front views (−1.75), a 4 × 4 grid (−1.6) or the stretch item.
- **What a floor item holds** (300 sampled items):
  - 4–6 cubes (47 % four, 42 % five, 11 % six) on a 3 × 3 grid, columns up to 4 high (10 % have a 4-high column);
  - a true isometric picture from the front-right corner (`ISO` az 45°): the front is the lower-left face, marked by a thick base edge and an arrow;
  - four line drawings: the key plus "neighbour" (48 % of foils), "direction", i.e. the view from another side (48 %), and "mirror" (4 %).
- **The drawings' convention.** A drawing is cropped to its filled cells, and lines appear only where the depth steps between neighbouring cells; faces at the same depth merge. So a drawing never shows cube by cube.
- **Size alone often decides.** In 70 % of floor items no foil has the key's size in cells. Someone who knows that the top view is the footprint, seen from above with the front at the bottom, can often answer from size alone.
- **What makes it hard to read** (code; Views never had a fresh-agent two-minute test, `docs/dev/v1.2/standing-rules-gap.md` TM2). Most likely, the conventions rather than the size of the structure:
  - which face is the front;
  - turning the picture 45° so that the front is at the bottom of a top view;
  - what an inner line means.
- **What Try asks.** It runs three variants and three viewing directions in five items: count → top → front → three views to a structure → right view with 6 cubes. The tips explain each view in one sentence.
- **Show-me already turns the 3D shape to the asked view.** The camera moves from the corner to the view direction, the drawing is traced over the picture and flies onto the key (`view.js` `toviewSteps`). After a wrong pick, only a caption says why ("Drawing n is the view from the right, not from the side the arrow marks"); nothing is turned or flipped to show it.

### 1.2 Angles (`js/ex/angles`)

- **Floor:** closest gap 6°, near-right class (70–110°), "extremes decide" (resolve 0), one arm horizontal (aligned); b −2.2. Four options, each a list of the letters A–D; a rating per screen class (`perDisplay`).
- **Sampled floor items.** The closest gap is 6.0°, the two other gaps 8.3–9.6°, and the four angles span 23–25°. At resolve 0 the decisive comparisons are the outer pairs, 8–9.6° apart. For reference (R3 §3.3, Dillon et al. 2019, group thresholds for connected arms): 5.4° at 90° and 8.9° at 80°/100°. **The floor is near threshold for a novice.**
- **The arms are chosen against the obvious cue.** They are searched so that six cheap cues (tip distance, enclosed area, arm sum, longer arm, shorter arm, vertex-to-chord-midpoint) point at random lists. "How far apart the tips are", the cue an untrained eye uses, is uninformative by design. On a 155 px phone cell, the longer arm is under 90 px in 36 % of angles (review A §7).
- **Spike: wider gaps** (the generator loaded in memory with gap levels 12/10/9/8° added, 400–600 items per cell, the cue solvers of `tests/node/angles.test.mjs`):
  - At today's 6°, the worst cue already sits at 34.4 % (acute: tip distance; obtuse: vertex-to-midpoint), against a bound of 35 %.
  - At 8–10°, near-right items stay valid with the worst cue at 31–36 %. Acute and obtuse items break rule 5: tip distance 45–54 %, vertex-to-midpoint 44–56 %.
  - At 12°, near-right items cannot be built: four angles at those gaps span more than the 40° class (the generator's fallback throws).
  - So the draft's "angle gaps of 10–15°" is only feasible as a near-right band of 8–10°.
- **Fresh agent** (RV-play-dat): 5/5 Try and 5/5 scored, 10–14 s per item. A perceptual floor, not a rule that has to be understood.

### 1.3 Painted Cubes (`js/ex/cubes`)

- **Floor:** 6–9 cubes, tallest column 2, asked "3 or 4 painted sides"; five options, "1 cube" to "5 cubes"; b −2.3. The grid is 3 × 3 in 45 % of items and 4 × 4 in 55 %.
- **Hidden cubes at the floor.** Of 300 sampled floor items, 72 % have at least one hidden support cube (1 in 56 %, 2 in 16 %). The question asks for 3 sides in 51 % and 4 in 49 %. The hidden-cube rule is therefore active from the first item.
- **The rule is the hard part.** Each cube's count depends on its neighbours (top painted unless something sits on it; each side painted unless touched; the bottom never). The question's number and the answers share digits ("exactly 4 painted sides", "4 cubes").
- **Where the rules are taught.** The two most useful rules exist only in `learn.rules` (§1.0), which is never shown.
  - The parts text says that faces resting on the ground are unpainted and that a cube has 0–5 painted sides.
  - The demo now shows a hidden cube (a fix after RV-play-dat).
- **Show-me** tallies only the cubes with exactly N painted sides, column by column, naming each one's sides. It never shows every cube's count, or why a touching face is unpainted.
- **Review A §11:** correct counts over visible cubes only would be right in 60.6 % of items, and column tops only in 40.0 %. Hidden supports decide about 39 % of items.
- **Players:** "took a while to understand".

### 1.4 Openings (`js/ex/openings`)

- **Floor:** one feature on each of the three profiles (three features in all: notches or steps), straight edges, the key face mostly the front (sometimes the side), upright, neighbouring-outline foils. Five options; b −2.3.
- **Turned openings.** Every opening is drawn under its own random turn or flip (the eight symmetries of a square). Of 400 sampled floor items, the key was shown unturned in 12 %, so **88 % of floor items need a 2D turn or flip** on top of the 3D reading.
- **Scale.** Solid and openings share one scale, and the openings' cells set it (`fitScale`). The solid is therefore drawn no larger than an opening. RV-play-dat measured about 125 × 110 px on a 390 px phone and about 170 px on desktop, and found one-step notches readable only when zoomed.
- **Fresh agent:** Try items took 96–167 s, scored items 44–132 s. That is the slowest of the six after Form.
- **Show-me** swings the camera to look along the fitting axis, traces the outline and flies it onto the opening. Only the overlay on the option is turned, not the outline over the solid (O53).

### 1.5 Form (`js/ex/form`)

- **Floor:** boxes and prisms (in 400 items: trapezoid prism 38 %, triangular prism 33 %, box 28 %), one shaded and one half-shaded face, upright pictures. Foils: one wrong-size solid (one length off by at least 25 %) and two mark foils; 0.85 mirror foils per item on average. Four options; b −2.2.
- **Every level carries a half mark.** The half mark is oriented, so it decides mirror images. It exists at every level because on these symmetric solids full shades alone allow at most two different marked solids (`gen.js` `MARKS` comment). R3 §8.6 had planned 1, 2, then 3 marks, with the oriented mark only at the top.
- **Fresh agent:** the only one of the six that failed the two-minute start. Try items took 99–150 s; scored 4/5 at 62–97 s.
  - Wrong-size foils on 100 px solids were "very hard to judge".
  - The right solid sometimes showed only the fully shaded end face, which carries no orientation.
- **Show-me:** a landmark face, then its neighbours; the Watch now tours both foil kinds. There is no folding animation (O51).

### 1.6 Hole Punch (`js/ex/patfold`)

- **Floor:** two straight folds, one of which misses the punch, so the sheet gets two holes. Five 4 × 4 sheets, all with two holes; b −2.3.
- **Sampled foils:** "fold unfolded across another line", "the holes of a punch at another place, mirrored", "the answer mirrored", "punch one cell away".
- **No one-fold items.** The generator never uses one fold: the official rules say every item has more than one fold, and with one fold the key is {punch, its mirror} (gen.js header).
- **The method finds the key.** Punch-gated crease symmetry finds the key in 89 %; the lead decided it is the format's method (review A §1).
- **Readability:** fold panels are 80–100 px on phones (O55). The Watch shows straight folds only; Try now steps through an idle fold, two folds that matter, an easy slanted fold, a corner fold and three folds.
- **Fresh agent:** 5/5; Try 15.6–42 s, scored 11–18 s. The easiest of the six to read.

### 1.7 Missing View (`js/ex/patviews`)

- **Floor:** labelled "4–5 cubes", 3 × 3 grid, the end view missing (top and front given), "outline" foils. Four options; b −2.2.
- **What a floor item holds** (300 sampled items):
  - **The label understates the size.** The structure shown is a neighbour of the one drawn first, so 4–5 cubes in only 55 %, 6 in 28 % and 7–10 in 18 %.
  - 61 % of keys contain a dotted (hidden) line.
  - **72.5 % of floor items hold a foil that only the exhaustive search rules out** (reason `search`: 57 % of all floor foils). Its outline differs from the key's, but it fails neither the hull test nor line alignment. Rejecting it means rebuilding the structure from two views, which is the hardest step of the format. It sits at the easiest level.
- **Conventions:** the end view is the right side with the front on its left; top above front; dotted means hidden.
- **Show-me is 2D:** projection lines through the mitre, the key's lines (solid, then dotted), then a static isometric drawing of the structure. **No 3D shape is turned to the missing view.** This is where the draft's show-me proposal changes most.
- **Fresh agent:** 4/4 Try and 5/5 scored, 14–43 s per item. The dotted-line caption needed more time (O52, open).

### 1.8 Cross-cutting causes

1. **The floor is an assumption.** It is set so that a "θ = 0 beginner" scores about 90 %. No data has tested it. The players who wrote in behave like A ≤ 0 (about 55 % at the floor).
2. **The level display hides progress at the bottom.** Level 1 covers up to about 81 % predicted success at the floor (§1.0).
3. **A stretch item can come in the first five** for about a third of beginners, adding two or three new features at once (§1.0).
4. **Teaching happens after failure.**
   - Strategy cards come after two misses in a row.
   - The rules list is unused.
   - Parts are folded away on phones.
   - Try moves through many features in 3–5 items (Views: three variants and three directions).
5. **The floor items already hold the format's hardest reading steps:**
   - Painted Cubes: hidden supports (72 %);
   - Missing View: search-only foils (72.5 %) and dotted lines (61 %);
   - Openings: turned or flipped openings (88 %) and three features;
   - Form: an oriented half mark at every level;
   - Angles: decisive differences near threshold, with the natural cue disabled.
6. **Phone size:** small solids (Openings), panels of 80–100 px (Hole Punch), and wrong-size foils on 100 px solids (Form).

## 2. Research on teaching these skills to novices [Studies]

### 2.1 Spatial-visualisation courses for engineering students

### 2.2 Worked and faded examples

### 2.3 Explicit strategy instruction, by format

### 2.4 Easy-to-hard progressions in perceptual learning

### 2.5 Errorless learning for the first items

### 2.6 What this means for Parallax

## 3. Proposed first band, teaching sequence and Show-me [Proposal]

### 3.0 Shared design

### 3.1 Views

### 3.2 Angles

### 3.3 Painted Cubes

### 3.4 Openings

### 3.5 Form

### 3.6 Hole Punch

### 3.7 Missing View

### 3.8 Checking the 80 % target against the item model

### 3.9 How to verify with the existing simulation and test code

## 4. Testing the two-minute start with a fresh agent [Proposal]

## 5. Sources

## Could not open
