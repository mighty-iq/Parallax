# D2. A first band and a taught start for the DAT-style exercises and Views

Phase 1 research note for v1.2, milestone 1, first bullet ("An easier, better-taught start"). Started 2026-11-18 11:19 UTC on branch `build`; complete 2026-11-18 11:57 UTC. Addendum 2026-11-18 (UTC) at the end: Atkinson et al. 2000, read in full, and what it changes in the teaching template.

Scope: Views (`views`), Angles (`angles`), Painted Cubes (`cubes`), Openings (`openings`), Form (`form`), Hole Punch (`patfold`), Missing View (`patviews`).

Labels used throughout:
- **[Studies]** what published work found (effect sizes, samples), with how much of each source was read;
- **[Code]** what the repository shows today (file and function names, sampled items, simulations on the real definitions);
- **[Proposal]** what this note recommends for v1.2.

How the [Code] numbers were made: small read-only Node scripts outside the repository loaded the pure files exactly as `tests/node/run.mjs` does (`createContext()`), generated items from seeds, and played the engine with the test suite's simulated learners (`tests/node/fixtures/learner.mjs`: `Learner`, `newRecord`, `playSession`) on the **real** exercise definitions. No repository file was changed. The scripts are described in §3.9 so the builder can recreate them.

## 0. Summary of answers

**Q1. What a first-time player faces** (§1).
- The first rated items come from the floor.
- **The floor items already contain the format's hardest reading steps** [Code]:
  - Painted Cubes: a hidden support cube in 72 % of floor items;
  - Missing View: a foil that only a full reconstruction rules out in 72.5 %, a dotted line in the key in 61 %;
  - Openings: the key opening turned or flipped in 88 %, three features;
  - Form: an oriented half mark at every level;
  - Angles: decisive differences of 8–10°, near the perception threshold, with the natural "tip distance" cue disabled by design;
  - Views: no hard feature, but its conventions: which face is the front, a top view with the front at the bottom, lines only where the depth steps.
- **About one beginner in three meets a stretch item** (≈ 1.4 logits up, two or three new features) among the first five rated items.
- **Teaching comes after failure:**
  - strategy cards come after two misses in a row;
  - `learn.rules` is never rendered;
  - the rules in the parts list are folded away on phones;
  - Views' Try mixes three variants in five items.
- **"Level 1" is a band** up to about 81 % success at the floor, so a player can look stuck while doing reasonably well.
- **Simulation** (real definitions, the suite's learners): a population starting at today's floor gets about 57 % of its first 10 rated items right and shows level 1 after a 10-minute session. The model's own default beginners (1.75 logits above the floor) already reach about 80 %, so the plan's acceptance as worded is met today and says nothing.

**Q2. Research** (§2). Three findings carry the design:
- **Rule teaching before practice:**
  - format rules: d ≈ 0.9–1.2 on the format;
  - pre-training of parts: d ≈ 0.75–0.92;
  - analytic strategy training: Stieff et al. 2014.
- **Start easy, then climb** (Ahissar & Hochstein 1997; Roads et al. 2018: d = 1.15 on medium items, suggestive). Easy cases alone do not teach the hard rules (Krautter et al. 2021), so each hard feature needs its own first appearance with teaching.
- **Show the informative view** (Keehner et al. 2008), and fade guidance with skill (expertise reversal).

Sorby's courses start from blocks and sketches; low starters gain most (PSVT:R about 50 % → 75–82 %). The worked/faded-example and errorless-learning primaries could not be opened this pass (listed, with assumptions).

**Q3. Proposal** (§3).
- **A new first band** (a level in front of one dim, version bumps; offsets hand-set, to be refitted):
  - Views: 3–4 cubes, ≤ 2 high, no mirror foil, the asked side's faces tinted (Δ −1.6);
  - Angles: 9°, near-right only (Δ −0.95; wider gaps break rule 5, 12° cannot be built);
  - Painted Cubes: flat figures (painted = 5 − neighbours) and 4–5 cubes (Δ −1.85);
  - Openings: one feature, openings unturned (Δ −1.5);
  - Form: one shaded face, foils off by ≥ 40 % (Δ −1.5; needs a decision on face-shape matching);
  - Hole Punch: one fold, larger panels (Δ −0.85; outside the official format, so labelled);
  - Missing View: 3–4 cubes with the structure drawn beside the views, no dotted lines, no search-only foils (Δ −1.6).
- **The same teaching template for all seven:**
  - a rules card;
  - the Watch at the band;
  - one strategy card in the format's terms before Try 1;
  - a faded Try 1;
  - "about two minutes" on the offer card.
- **Engine:**
  - σ0 = 1.5;
  - no stretch item in an exercise's first 10 rated answers;
  - a level 1 that shows progress.
- **Show-me:**
  - Missing View turns the structure to the missing side and shows hidden edges dotted (the main new piece);
  - Openings turns the outline in sight (O53);
  - Painted Cubes numbers every cube and "explodes" touching faces;
  - Views explains wrong picks by turning to the foil's side;
  - Form folds (O51).
- **Model check:** a population at today's floor goes from about 57 % to 76–81 % on the first 10 rated items (Angles 73 %, Hole Punch 70 %). Strong beginners reach today's floor by item 4–9 with σ0 = 1.5.
- **Acceptance wording and tests:** §3.8 item 5 and §3.9.

**Q4. Two-minute start** (§4).
- **Tester:** a fresh agent seeing only screenshots of the app; phone, small phone and desktop; three runs per exercise.
- **Constraints:**
  - a 60 s limit per item;
  - a written reason before every answer;
  - a written statement of the rules after the Watch.
- **Success:**
  - a right Try answer with a right reason within 2:00;
  - the rules stated without error;
  - Try ≥ 3/4 and the first five scored ≥ 4/5 within each format's time budget;
  - no blockers.
- **Paired with playtest-mode data** from 3–5 new community players per exercise.

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
  - **`learn.rules` is never rendered.** Angles (2 rules), Painted Cubes (3) and Hole Punch (3) define it in learn.js, and no file in `js/` reads it (grep for `.rules` and `learn.rules`). Painted Cubes' rules "a hidden cube is there only to hold up others" and "a cube under another has no painted top" therefore reach the player only indirectly, through the demo's captions and a one-line tip.
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
7. **Timing.**
   - None of the seven has a time limit in Train (`timeLimit` is null).
   - Prep courses pace the real test at about 20 s (angles), 20–25 s (hole punching), 20–40 s (cube counting), 45–50 s (apertures, view recognition) and 45–60 s (pattern folding) per item (R3 §2.1).
   - The fresh agent took:
     - Openings: 96–167 s per Try item, 44–132 s per scored item;
     - Form: 99–150 s per Try item;
     - the other four: 14–43 s.
   - No human first-session times exist yet; the playtest mode of milestone 2 would record them.

## 2. Research on teaching these skills to novices [Studies]

**Limits of this pass.**
- The shared web-search budget for this turn was already spent when this section began (the tool refused further searches).
- Most publisher pages also needed an approval that did not come in time.
- So this section rests on two kinds of source:
  - the pages I could open this pass: two journal pages, two conference or repository pages;
  - the repository's earlier research notes, which give their own read level for each source. They are cited as "via <note>", a secondary report.
- Primary sources that matter but stayed closed are listed under "Could not open", each with the assumption used meanwhile.

### 2.1 Spatial-visualisation courses for engineering students

- **Sorby's course** (Michigan Tech; first-year students who fail the PSVT:R).
  - **Content.** Modules for isometric sketching, orthographic projection, 2D→3D, rotations, reflections, cross-sections and more, with snap cubes and pencil sketching (via `docs/research/v1.0/B-tasks.md` §Views; Richards, Veurink & Sorby 2021 [F] confirms ten modules, snap cubes and paper sketching).
  - **Gains on the PSVT:R, % correct before → after** (Sorby & Veurink c. 2010 slides, via `docs/research/v1.0/A-evidence.md` §2.1, a secondary report):
    - random pilot, n = 24: 51.7 → 82.0;
    - voluntary cohorts, n = 184: 50.5 → 76.9; n = 157: 48.3 → 73.7;
    - mandatory cohort, n = 84: 53.6 → 75.4.
  - **Sorby, Veurink & Streiner 2018** [A, the university repository page]. More than 3,000 students over five years, with a regression discontinuity at the pass/fail cutoff. The course improved several introductory course grades and STEM GPA (most in Engineering Problem Solving and Analysis) and the retention of women. The page gives no magnitudes.
- **Miller & Halpern 2013** (via A-evidence §2.2). A randomised trial: 12 h of the Sorby–Wysocki sketching modules. One week later: Mental Cutting d = 0.79, MRT d = 0.35. At 8 months no difference remained.
- **Pre-dental students** (Stavridis et al. 2015, via R3 §4.3). A Sorby-style course raised PSVT:R scores (n = 15, no control group). PSVT:R correlated r = .50 with the PAT.
- **Uttal et al. 2013** (via A-evidence §1.1).
  - Training effect: courses g = 0.41, spatial-task practice 0.48.
  - Screened low scorers gained more: g = 0.68 against 0.44 unscreened.
  - Intrinsic-static outcomes (the cell of Views and Painted Cubes) gained least: 0.32.
- **Hawes, Gilligan-Lee & Mix 2022** (via A-evidence §1.2). Effects are larger with concrete manipulatives than without.
- **What carries over to an app** [my reading]. These courses do not start with test items. They start by:
  - building and sketching small cube structures by hand;
  - moving between the isometric picture and the views of the same object, with the object present;
  - only later asking for the views without the object.

  The people who gain most are those who start low, which is the group the player feedback describes.

### 2.2 Worked examples, pre-training and rule teaching

- **Pre-training** (Mayer; via `docs/research/v1.0/D-motivation.md` §4, secondary). Teaching the names and features of the key parts before the lesson: 7 of 7 experiments, median d = 0.92; a later tally, 16 tests, d = 0.75.
- **Teaching a test format's rules** (via `docs/research/v1.1/R4-test-overlap.md` §4.2):
  - Schneider et al. 2020 [abstract there]: a video under 14 minutes on the rules of figural matrices raised scores by d ≥ 1.19 (N = 112 and 229).
  - Levacher et al. 2022 [abstract there]: rule information raised the solve rate from .41 to .61, d = .92 (N = 882).
  - Krautter et al. 2021 [full text there]:
    - training the *difficult* rules carried over to untaught easy rules (d = 0.79);
    - training the easy rules did not carry over to difficult ones.

  For Parallax: a first band built from easy cases is not enough by itself. The hard rules (hidden supports, dotted lines, mirror half marks, turned openings) each need explicit teaching when they first appear.
- **Animation of the procedure** (Höffler & Leutner 2007, via D-motivation §4). Animation beat static pictures, d = 0.37. Representational animation: d = 0.40. Procedural-motor knowledge: d = 1.06.
- **Expertise reversal** (Kalyuga et al. 2003; Chu et al. 2017; via D-motivation §4).
  - Guidance that helps novices can hinder experienced users.
  - In Chu et al., a colour cue plus a 3D-animation strategy for mental rotation helped low-ability students (gain 1.87 against 1.24) and hurt high-ability ones (−1.06 against −0.54).
  - So scaffolds must fade with skill, and must be skippable.
- **Worked → faded → independent practice** (Atkinson et al. 2000; Renkl & Atkinson 2003; Atkinson, Renkl & Merrill 2003; a 2023 meta-analysis of worked examples in mathematics). **Not opened this pass** (see Could not open; Atkinson et al. 2000 was read later: see the addendum at the end, which supports the first and third points below and does not test the second). Working assumption, from the general literature and **[unverified] here**:
  - worked examples help novices most on well-structured problems;
  - removing worked steps one at a time (fading) eases the move to solving alone better than abrupt example–problem pairs;
  - prompts to explain a step add to the effect.
- **Tutorials in games** (Andersen et al. 2012, via D-motivation §4).
  - Tutorials paid off only in the complex game: context-sensitive help gave +75 % levels completed.
  - Just-in-time help beat up-front help there.
  - Forcing exact actions gave nothing.

### 2.3 Explicit strategy instruction, by format

- **General** (Stieff et al. 2014, via A-evidence §2.3). Organic-chemistry students were trained in imagery, analytic or both strategies. Analytic training raised analytic strategy use, and combined training removed the sex gap in achievement. The strategies were taught *before* practice, not after failures.
- **View tasks: projection rules.**
  - Prep courses for the view-recognition format teach two steps (R3 §3.2, prep sources read there):
    - pick one distinctive feature, find it in both given views, eliminate;
    - then solid against dotted.
  - Keehner et al. 2008 (via D-motivation §5): what helped cross-section inference was *seeing the most task-relevant views*, not interacting. Passive viewers of good rotations matched the effective interactors.
  - This is direct support for a show-me that turns the shape to the asked view.
  - [gap] I found no controlled study of the order "outline first, then inner lines, then dotted lines" for novices; it is drafting practice and prep advice.
- **Cube counting by position.**
  - Kurtuluş & Yolcu 2013 ([F] via R3 §3.5) list the classic errors: counting only visible cubes, counting faces as cubes, double counting, missing hidden cubes. Accuracy falls with more cubes and more hidden faces.
  - Prep courses teach two methods (R3 §3.5):
    - a tally table (cubes × 0–5 painted sides);
    - learning common positions (a corner cube on the ground shows 3 painted sides).
  - [gap] No controlled study of painted-face counting instruction was found.
- **Paper folding.**
  - Burte et al. 2018 (via B-tasks): a "two holes per fold" heuristic fits most solvers; only about 22 % mainly unfold. The folds that matter predict accuracy better than the total.
  - The think3d! origami curriculum (at least 6 × 45 min) raised Paper Folding from 42 % to 50 % (via B-tasks).
  - Prep courses teach unfolding backwards on a sketched 4 × 4 grid (R3 §3.4).
- **Net folding with landmark faces.**
  - Shepard & Feng 1972 (via B-tasks): folding time grows with the number of squares carried along.
  - Prep "key landmarks" (R3 §3.6), in four steps:
    1. eliminate on a unique shape or proportion;
    2. eliminate on the shading;
    3. check one landmark face's neighbours;
    4. never fold the whole figure.
- **Angle ranking by pairwise comparison.**
  - Kaplan teaches elimination by the extremes and little time per item; Shemmassian teaches reference images and fitting one angle inside another (R3 §3.3).
  - Group thresholds: 5.4° at 90°, 8.9° at 80°/100°, 11.2° at 55°/125° (Dillon et al. 2019 [F] via R3 §3.3).

### 2.4 Easy-to-hard progressions in perceptual learning

- **Ahissar & Hochstein 1997** [A, nature.com].
  - Learning begins with easy cases and later extends to hard ones ("easy guides hard").
  - Training on difficult trials alone works only if learning onset was enabled first. A single prolonged, easy presentation can enable it (the "eureka" effect).
  - Easy conditions generalised across orientation and position; hard ones stayed specific.
- **Roads et al. 2018** [F, Cognitive Research 3:38]. 62 novices learned to classify skin-lesion images, easy-to-hard against hard-to-easy.
  - Both groups improved equally from pretest to post-test.
  - On medium items in session 2, easy-to-hard was better, d = 1.15.
  - After two weeks, easy-to-hard kept more of the easy items (d = 0.62) and the medium ones (d = 0.77).
  - The authors call the evidence suggestive, not conclusive.
- **Liu, Lu & Dosher 2010** (via D-motivation §5). At 85 % accuracy, learning happened with or without feedback. At 65 %, it happened only with feedback.
- **Wilson et al. 2019** (via D-motivation; ENGINE.md §4): about 85 % training accuracy maximises learning rate. This rests on theory and simulation; human evidence is limited.
- **Pashler & Mozer 2013** (fading in perceptual category learning): not opened (Could not open).

### 2.5 Errorless learning for the first items

- **Not opened this pass:** Clare & Jones 2008; Metcalfe 2017 (Could not open). Working assumption **[unverified] here**:
  - errorless learning has its clearest benefits in people with memory impairment;
  - in healthy learners, errors followed by corrective feedback are usually as good or better.
- What the opened evidence supports:
  - a high but not perfect success rate at the start (about 85 %; Liu et al. 2010);
  - feedback that explains, not just marks. Wisniewski et al. 2020 (via D-motivation §5): high-information feedback d = 0.99, corrective 0.46, praise 0.24.
- **Proposal reading.**
  - Make the first rated items near-errorless through *content*: a first band at about 85–90 % for a struggling beginner.
  - Make the step from the demo near-errorless through *process*: "Your turn" answers the item the demo has just solved, and the first Try item has its first step done.
  - Keep explanatory show-me after every early error. Do not hide errors.

### 2.6 What this means for Parallax

1. **Teach the format's rules before the first item, in one short screen.**
   - Evidence: pre-training d ≈ 0.75–0.92; rule teaching d ≈ 0.9–1.2 on the format itself.
   - Parallax already has the data: `learn.parts`, and an unused `learn.rules`.
2. **Show a worked example at the first band, then fade.**
   - The Watch is the worked example.
   - Try 1 should have its first step done by the app.
   - Try 2 is unaided.
3. **Give one strategy, in the format's own terms, before practice** (Stieff et al.; prep sources). Today the card comes after two misses in a row.
4. **Start easy, then climb** (Ahissar & Hochstein; Roads et al.; Liu et al.).
   - The first band should give about 80–90 % to a struggling beginner.
   - Hard features each need their own first appearance with a tip and a show-me (Krautter et al.: easy-case training alone does not carry over to the hard rules).
5. **Show-me should show the informative view** (Keehner et al.).
   - Turn the shape to the asked view.
   - Turn and flip the outline in sight.
   - Unfold or fold step by step.
6. **Fade scaffolds with skill** (expertise reversal). Put them in the item model (a lower band that the engine leaves as the rating rises), not in fixed screens for everyone.
7. **Concrete first** (Sorby; Hawes 2022). The off-screen challenges (blocks and pencil) belong at the start for the view tasks, as an optional step, not only on the exercise page.

## 3. Proposed first band, teaching sequence and Show-me [Proposal]

All difficulty offsets below (Δ, in logits, relative to the same item at today's level 0 of that dim) are hand-set, as every step is today. They were chosen so that the item model gives a beginner population centred at today's floor about 80 % (§3.8). The pooled exports should refit them, as CLAUDE.md already says of the hand-set steps.

### 3.0 Shared design

**A. The band in the item model.**
- **Where the new level goes.** One new lowest level (two for Painted Cubes) goes in front of the dim that carries the reading load. Old combinations keep their exact difficulty. Ratings are stored per exercise id, in logits (`rec.ex[id]`), so they stay valid.
- **Version.** Putting a level in front changes the params codes, so all seven bump `version`. Trial rows are indexed `id@version`. `rowParams` decodes only the current version, so weak-spot statistics restart; ratings do not.
- **The 1–100 scale is re-based**, with level 1 at the new floor:
  - shown levels rise: a rating at today's floor + 1.0 shows level 1 today and, by exercise, about level 15–28 afterwards (computed with `estimator.level`'s formula on the new ranges of §3.8);
  - stored personal bests (`rec.ex[id].best.block.level`) need one conversion: `levelOf(new range, bOfLevel(old range, level))`;
  - Path's ten stages are tenths of the range, so stage 1 becomes the band;
  - the tests' "θ = 0 beginner ≈ 90 % at the easiest item" move to the new floor (or `base` moves).
- **Alternative without a version bump** (single-variant exercises only): append a dim `start` [off, on] with a negative step. Rejected here: it doubles the pool and pairs the starter presentation with the hardest settings.

**B. Engine changes (S each).**
1. **Prior σ0 1.0 → 1.5** (`config.prior.sd`).
   - In the band simulation, strong beginners (A = +1.75) reach today's floor 2–6 items sooner (median item 4–9 instead of 6–15), and beginners at A = 0 lose 1–2.5 points (§3.8).
   - `tests/node/sim.mjs` must still show 93–97 % coverage with it.
2. **No stretch item among an exercise's first 10 rated answers**, or a stretch that moves one dim only.
   - Today about one beginner in three meets a stretch item 1.4 logits up, with two or three new features, among the first five (§1.0).
   - Each new feature should arrive alone, with its tip; tips already show once in scored sessions (`tipFor`).
3. **Level 1 that does not read as stuck** (design judgement). Say "level 1 · starter items" and show the progress to level 2 at block ends ("4 of the last 5 right; level 2 at about 4 of 5 over a block").

**C. Teaching before the first item: one template for all seven.**
1. **Rules card** (new).
   - The format's 2–3 rules in Parallax's words, each with a small picture where possible, as the first Watch screen. Read `learn.rules`, which exists today but is never rendered; add it to Views, Openings, Form and Missing View.
   - On phones it is on screen, not behind "Parts".
   - About 15–20 s to read; one button, "Watch it solved".
2. **Watch = the worked example, at the new band.**
   - Captions stay ≥ 3 s.
   - It shows every foil type that Try uses.
   - It ends on "Your turn" with the solved item (a near-errorless first answer).
3. **Strategy card before Try 1.**
   - The analytic card in the format's own terms (texts below): three steps, one tap to close.
   - It stays as a "How to solve" chip through Try and the first session, instead of arriving only after two misses.
4. **Try, four items**, answers in varied slots:
   - Try 1: band, with its first step done by the app (faded);
   - Try 2: band, unaided;
   - Try 3: today's level 0, with its tip;
   - Try 4: the first hard feature that the early rated items use, with its tip.

   A miss replays show-me automatically (as today).
5. **Go:** rated items start at the band, and the engine leaves it as the rating rises.
6. **The offer card** says "about two minutes" (O6), not "about a minute".

**Time budget** to the first independent right answer: rules 15–20 s + Watch 25–35 s + Your turn 10 s + Try 1 20–40 s ≈ 1:10–1:45.

**D. Show-me template.**
- During the band's first misses (the existing `AUTO_SHOWME` = 3), show-me carries out the strategy card's steps on the item, in the card's words. Card and replay then teach one procedure.
- The view tasks turn the shape (or the outline) to the asked view in sight (Keehner et al. 2008, §2.3).

### 3.1 Views

- **Band** (new first level of `cubes`; it applies to `toview`, while for `count` and `toobject` it equals today's level 0): Δ = −1.6, so the new floor is −3.8.
  - 3–4 cubes, tallest column 2, 3 × 3 grid, top or front view;
  - foils: "direction" and "neighbour" only (no mirror), each ≥ 5 unit edges from the key (as today);
  - scaffold: the faces seen from the asked side are tinted on the 3D structure, with outlines (never colour alone). This signalling shows "the view is made of these faces".
  - Generator: `visibleStructure` with HMAX 2 and N 3–4. Rerun the BAL shortcut balance on the band's own pool.
- **Try stays in `toview`** for the first session, the variant of Train's first run:
  - Try 1: band, top view, the view's outline already drawn as a dashed frame beside the structure (step 2 done);
  - Try 2: band, front view;
  - Try 3: today's level 0, top view;
  - Try 4: today's level 0, front view.

  `count` and `toobject` get their own Watch (`learn.demo` already holds one per variant) when their first run starts. Today's Try mixes three variants in five items, and its Watch shows the foils of only one: that breaks the rule that the demo shows every foil type that practice uses.
- **Rules:**
  - The thick edge of the base is the front; the arrow is the side you look from.
  - A view is flat: lines only where the surface steps nearer or farther.
  - Top view: the front at the bottom of the drawing.
- **Strategy card, "Outline first, then inner lines":**
  1. Find the front and move to the arrow's side.
  2. Count the cells of the outline across and up; drop drawings of another size.
  3. Then the inner lines: each one is a step between heights (top view) or depths (front view).
- **Show-me** (the turn to the asked view exists):
  - on the band, tint the asked side's faces as the camera turns;
  - after a wrong "direction" pick, turn the camera to the side that drawing belongs to and lay it there ("this is the view from the right");
  - after "mirror", flip the key's drawing in place;
  - after "neighbour", mark the lines that differ in both drawings.
- **Optional concrete step** (Sorby; Hawes et al.). The off-screen challenge "Build it, then sketch its views" is offered once after Try, not only on the exercise page.
- **Model check** (§3.8): beginners centred at today's floor get 78 % of their first 10 rated items right (σ0 1.5: 77 %), against 58 % today.

### 3.2 Angles

- **Band** (new first level of `gap`): Δ = −0.95, so the new floor is −3.15.
  - Closest gap 9°, the near-right class only, extremes decide, aligned arms. At this level the generator ignores `size`.
  - The decisive outer gaps are then 11.7–14.4°, 2.2–2.7 times the 5.4° group threshold at 90°.
- **Why not 10–15°** (spike, §1.2).
  - At 12° near-right items cannot be built: the four angles would span more than the 40° class.
  - At 8–10° the acute and obtuse classes break rule 5 (cues 44–56 %).
  - At 9° near-right the worst cue was 32.8 % (600 items; the full node test must confirm it at ≥ 2,000).
  - This is Parallax's floor: a band wider than 9° needs a lead decision to let a teaching level break rule 5, which I do not recommend.
- **The rest of the easier start is teaching.**
  - Extremes first, laying one angle on another.
  - A labelled-practice line already says the gains stay with this kind of figure.
- **Rules** (`learn.rules` exists; render it):
  - only the opening counts, not the arm lengths or the turn;
  - every angle is under 180°;
  - each answer lists the letters from smallest to largest.
- **Strategy card, "Extremes first":**
  1. Find the clearly smallest angle; keep the lists that start with it.
  2. Find the clearly largest; keep the lists that end with it.
  3. Compare only the pair the remaining lists disagree on: lay one angle on the other.
- **Faded Try 1:** the smallest angle is marked, and the lists that do not start with it are greyed.
- **Show-me:** animate the elimination (cross out the lists step by step), then lay the deciding pair on each other (that part exists).
- **Model check:** 73 % (σ0 1.5: 72 %) against 58 % today. With Δ limited to −0.95 the band cannot reach 80 % for this population. Angles is the exercise where teaching has to carry the most.

### 3.3 Painted Cubes

- **Two new first levels**, which together give a new floor of −4.15:
  - `height`: "flat". Every column is 1 high, so no cube is hidden and no top is covered: painted sides = 5 − the cubes it touches. Δ = −1.0.
  - `cubes`: "4–5" on a 3 × 3 grid. Δ = −0.85.
  - Asked N: 3 or 4, as at today's level 0; flat figures also allow N = 2 at a T-junction.
- **Key balance.**
  - With 4–5 flat cubes the counts reach 1–4 (four ends need the plus-shaped five), so "5 cubes" is never the key at that level. Each key stays at ≤ 30 % if k is drawn evenly from 1–4.
  - The visible-faces error stays balanced as today.
  - The draft's "2–3 cubes in a row" was rejected: its keys can only be 1 or 2.
- **Rules** (render `learn.rules`):
  - every face that touches another cube or the ground is unpainted;
  - a cube under another has no painted top;
  - a hidden cube is there only to hold up the cubes above it, and it counts.
- **Strategy card, "Count by position":**
  1. A cube's painted sides = its top (if nothing is on it) + every side no cube touches; never the bottom.
  2. Say each cube's number as you go, column by column (on flat figures: 5 minus the cubes it touches).
  3. Count the cubes with the number asked, hidden cubes included.
- **Try:**
  - Try 1: flat, with every cube's number shown except two;
  - Try 2: flat, unaided;
  - Try 3: today's level 0 with a hidden cube;
  - Try 4: height 3.
- **Show-me:**
  - write every cube's number on it (not only the asked ones), then highlight the asked ones;
  - an "explode" step pulls the cubes slightly apart, so touching faces show unpainted and painted faces show the paint tone;
  - on flat figures, the caption counts "5 minus the cubes it touches".
- **Model check:** 81 % (σ0 1.5: 79 %) against 56 % today.

### 3.4 Openings

- **Band** (new first level of `features`): Δ = −1.5, so the new floor is −3.8.
  - One feature in all, on the key's own profile; the other two profiles are plain, so the solid is a box with one notch or step running through it.
  - Options are drawn **unturned** (the identity transform for all five, so orientation is still no cue).
  - The key face is the front, sometimes the side.
- **Foils:** the same outline with the feature moved, resized or on another side.
  - Their corner counts must equal the key's, so the corner-count solver stays at chance.
  - At least two foils must share the key's box, as R3 §8.5 asks.
- **Rules** (add `learn.rules`):
  - every cut runs straight through;
  - the solid may be turned before it goes in, then slides straight through;
  - an exact fit: the outline at the same size.
- **Strategy card, "Pick a face, trace, then turn":**
  1. Pick a face and trace its outline.
  2. Find openings with the same corners in the same order (turned or flipped is fine).
  3. Check the sizes last: the right shape at the wrong size is wrong.
- **Try:**
  - Try 1: band, with the key face's outline traced on the solid;
  - Try 2: band, side face;
  - Try 3: today's level 0, where openings are turned;
  - Try 4: `keyview` 1.
- **Show-me** (O53): turn and flip the traced outline over the solid in sight (quarter turns, then the flip), then fly it to the opening. On the band (unturned) it lands directly.
- **Size.** Keep the shared scale, which the rules state, and give the band larger option cells so the scale grows with them. On phones, a 2 + 3 grid of larger cells, or a stem with less empty plate (RV-play-dat: one-step notches readable only when zoomed).
- **Model check:** 76 % (σ0 1.5: 75 %) against 56 % today.

### 3.5 Form

- **Band** (new first level of `marks`, "one shaded face"): Δ = −1.5, so the new floor is −3.7.
  - One fully shaded face and no half mark.
  - Box or triangular prism (no trapezoid at the band); upright pictures.
  - Foils: two wrong-size solids, with one length off by at least 40 % (today 25 %), and one mark foil.
- **The mark-foil problem.**
  - With one full shade, these solids allow at most one other marked solid within the shaded face's own shape class (gen.js `MARKS` comment). The band's mark foil therefore puts the shade on a face of another shape, and face shape alone decides it. That is review B's blocker #1: 91.9 % at one mark.
  - At the band this *is* the method, steps 1–2 of the card, as crease symmetry is Hole Punch's. It needs a DECISIONS line (the lead's call), with the face-shape solver reported as information on the band's pool and held at chance + 10 everywhere else.
  - Alternative: three options at the band (the key and two wrong-size foils; `chance(params)` = 1/3 there). Validity is simpler, but it departs from the test's four.
- **Rules** (add `learn.rules`):
  - the pattern is the outside surface;
  - dashed lines fold, solid lines are cut edges;
  - only the faces turned towards you count;
  - the right solid matches shape, sizes and marks.
- **Strategy card, "Shape, then one landmark":**
  1. Drop every solid whose face shapes or sizes differ from the pattern.
  2. Pick the shaded face; in the pattern, name the faces that share its edges.
  3. In each solid left, check that those faces sit beside it.
- **Try:**
  - Try 1: band, a box, with the shaded face's neighbours lettered in the pattern;
  - Try 2: band, a prism, unaided;
  - Try 3: today's level 0 (a half mark), after a one-step mini-demo of the half mark ("a half-shaded face also shows which way it is turned");
  - Try 4: `marks` level 1.

  This answers RV-play-dat's Form finding: mirror foils were never demonstrated.
- **Show-me** (O51, size L): fold the pattern up about its hinges (the validator already folds the net in 3D, `lib.fold`) and turn it to the key's pose. For milestone 1 at least:
  - mark the too-long edge of a wrong-size foil in both the pattern and the solid;
  - name the half mark's corner in both for mirror foils.
- **Model check:** 80 % (σ0 1.5: 79 %) against 58 % today.

### 3.6 Hole Punch

- **Band** (new first level of `folds`, "1"): one straight half fold on a grid line and one punch through two layers, so two holes.
  - Two panels (fold, punch), drawn larger (O55).
  - The 4 × 4 positions shown as faint dots on the folded paper, so the punch's cell can be read.
  - Δ = −1.3 against two folds that both matter, i.e. −0.85 below today's floor (which already has one idle fold), so the new floor is −3.15.
- **Format note.**
  - The official rules say every item has several folds (R3 §2.2), so the band lies outside the format. Its settings text must say "starter: one fold".
  - With one fold, punch-gated crease symmetry is the solution (the lead's decision: the method).
  - The other cheap rules (a hole under the punch alone, symmetry alone, most like the others) can be held at chance. Most foils must share the punch hole, and some must be symmetric about the crease without it.
- **Rules:** render `learn.rules`, which exists.
- **Strategy card, "Unfold backwards":**
  1. Mark the punch on the folded paper.
  2. Undo the last fold: a hole on the flap gets a twin straight across the crease.
  3. Keep undoing, then compare the holes with each sheet.
- **Try:**
  - Try 1: band, with the punch's twin cell ringed;
  - Try 2: band;
  - Try 3: today's level 0 (an idle fold), with the idle tip;
  - Try 4: two folds that matter.
- **Show-me:** as today (unfold step by step), on bigger panels.
- **Model check:** 70 % (σ0 1.5: 69 %) against 56 % today. Δ is limited by the format. The fresh agent found Hole Punch the easiest of the six to read, so its band matters least.

### 3.7 Missing View

- **Band** (new first level of `cubes`, "3–4, structure shown"): Δ = −1.6, so the new floor is −3.8.
  - 3–4 cubes, tallest 2, a box of at most 2 × 3; the end or the front view missing, never the top.
  - The key has no dotted line, and every foil fails the hull or line-alignment test: no foil that only the exhaustive search can reject.
  - **Scaffold:** the structure itself is drawn beside the views and labelled "the structure", using the static isometric drawing that show-me already makes from `item.heights`. This is the draft's "one view to match, with the 3D shape beside it". The band is Views in the test's layout, and the next band takes the picture away (fading).
  - **Generator:** N 3–4 with HMAX 2; the search is trivial at this size.
  - **Label fix:** today's "4–5" is true for only 55 % of level-0 items, because the shown structure is a neighbour of the one drawn first. Fix the label or the count window.
- **Rules** (add `learn.rules`):
  - top upper left, front lower left, end lower right;
  - the end view looks at the right side, so the front is on its left;
  - solid lines are seen edges, dotted lines hidden ones;
  - nothing hangs in the air.
- **Strategy card, "Line it up":**
  1. Outline first: the missing view's width and height come from the given views. For the end view, the height comes from the front and the width from the top's depth.
  2. Every line must line up with a line or corner in a given view; drop drawings that break this.
  3. Dotted last: a line is dotted only where nearer cubes hide the edge.
- **Try:**
  - Try 1: band, end view missing, with the projection lines already drawn into the slot;
  - Try 2: band, front view missing;
  - Try 3: today's level 0 (structure hidden, a dotted line);
  - Try 4: today's level 0 with a search-only foil.

  The Watch holds on the dotted-line step until a tap (O52).
- **Show-me** (the main change the draft asks for):
  1. after the projection lines, turn the structure to the missing side (the camera moves from the isometric corner to that side, as in Views);
  2. fade the cubes to outlines so the hidden edges appear dotted;
  3. lay the drawing in the slot.

  Draw it in SVG with the depth-sorted cube drawing that Painted Cubes already uses (no WebGL), or with `stage3d` as Views does.
- **Model check:** 80 % (σ0 1.5: 78 %) against 58 % today.

### 3.8 Checking the 80 % target against the item model

**Method.** `bands.mjs`, described in §3.9.
- A stub definition copies each real exercise (dims, `difficulty`, `chance`, answer type) and puts the proposed level(s) in front. Old combinations keep their exact difficulty; new ones get Δ.
- The engine and the test suite's `Learner` play one pinned 10-minute Train session per learner, Balanced style, 300 learners per cell.
- A is the population's mean starting ability above **today's** floor, with an SD of 0.85 from the learner model. So "A = 0" is the same people before and after.

| Exercise | Δ (floor today → new) | A −1 | A −0.5 | A 0 | A +1 | A +1.75 | A 0 today | A +1.75 reaches today's floor at item (σ0 1.0 / 1.5) |
|---|---|---|---|---|---|---|---|---|
| Views | −1.6 (−2.40 → −3.80) | 65 % | 71 % | **78 %** | 87 % | 91 % | 58 % | 10 / 7 |
| Angles | −0.95 (−2.20 → −3.15) | 57 % | 66 % | **73 %** | 83 % | 87 % | 58 % | 9 / 6 |
| Painted Cubes | −1.85 (−2.30 → −4.15) | 69 % | 74 % | **81 %** | 88 % | 92 % | 56 % | 15 / 9 |
| Openings | −1.5 (−2.30 → −3.80) | 63 % | 70 % | **76 %** | 86 % | 91 % | 56 % | 12 / 7 |
| Form | −1.5 (−2.20 → −3.70) | 65 % | 74 % | **80 %** | 87 % | 92 % | 58 % | 12 / 8 |
| Hole Punch | −0.85 (−2.30 → −3.15) | 55 % | 60 % | **70 %** | 81 % | 87 % | 56 % | 6 / 4 |
| Missing View | −1.6 (−2.20 → −3.80) | 67 % | 73 % | **80 %** | 88 % | 93 % | 58 % | 13 / 8 |

The cells give success on the first 10 rated items with today's prior. With σ0 = 1.5 the A = 0 column reads 77, 72, 79, 75, 79, 69 and 78 %.

**Reading the table.**
1. **A population centred at today's floor goes from about 57 % to 76–81 %** on the five exercises with Δ ≥ 1.5. The engine targets 78 % (Balanced), plus two warm-ups at 87.5 %, so this is the target being met, not overshot. 97–99 % of their first 10 items come from the band (Angles 94 %, Hole Punch 89 %).
2. **Angles and Hole Punch reach about 70–73 %.** Their bands are limited by rule 5 (Angles) and by the format (Hole Punch). Their remaining gap has to be closed by teaching.
3. **A = −1 stays at 55–69 % whatever the band.** In the item model these are people far below the floor. In reality they are mostly people who have not understood the format yet, which the model cannot represent. That is the teaching's job (§3.0 C), and the fresh-agent and playtest checks (§4) measure it.
4. **The cost: strong beginners spend 6–15 items in the band at about 90 % success.** σ0 = 1.5 halves that (4–9 items) for 1–2.5 points at A = 0. Recommended, if `sim.mjs` coverage stays at 93–97 %.
5. **Proposed acceptance wording for milestone 1.** In the band simulation, a population centred at the pre-1.2 floor averages 76–84 % over its first 10 rated items on Views, Painted Cubes, Openings, Form and Missing View, and at least 68 % on Angles and Hole Punch. A population at +1.75 reaches the pre-1.2 floor by its 10th rated item (median). And the fresh-player test of §4 passes.
6. **A side effect worth having** (ENGINE.md §16). Comfortable style misses its target by 2.2 points today because the pools' floors sit too high. The diagnostic run with level 0 made 0.75 logit easier closed that gap (+0.4). A lower floor should close it for these seven too.

### 3.9 How to verify with the existing simulation and test code

**Before building: model checks.** These are the scripts used for this note, all read-only and outside the repository. Each loads the pure files with `createContext()` from `tests/node/run.mjs` and the learners with `Learner`, `newRecord` and `playSession` from `tests/node/fixtures/learner.mjs`.
1. **First items today** (`firstitems`). For each of the seven real definitions and A ∈ {−1, 0, +1, +1.75}:
   - 200 learners: `new Learner(PX, seed, { aboveFloor: A })`, a fresh record, `playSession(PX, rec, L, 'train', { now, pin: id, minutes: 10 })`;
   - success on the pinned exercise's first 5 and 10 rated items, their offset above the floor, and the level shown afterwards (`E.est.shown`).

   Vary `now` per learner. Otherwise every learner gets the same deck order, and the stretch item lands in the same place.
2. **Parameters of the first items** (`firstparams`): the params and kinds (warm-up, target, easy, stretch) of the first five rated items. This is where the early stretch item shows.
3. **Proposed bands** (`bands`): `PX.ex.define` a stub per exercise with the new level(s) in front. Its `difficulty` calls the real definition with the shifted indices and adds Δ on the new level. Learners get `aboveFloor: A + (oldFloor − newFloor)`. Optional `E.configure({ prior: { sd: 1.5 } })`.
4. **Angles spike.** Load `js/ex/angles/gen.js` into a context created with `{ exercises: false }`, with the `GAPS` line replaced in memory. Generate per gap, size and resolve, and run the six cue solvers of `tests/node/angles.test.mjs`. Do the same for any other generator change whose shortcut balance is in doubt.

**After building: tests in the repository.**
1. **Per exercise** (`tests/node/<id>.test.mjs`):
   - 10 000 seeds over every combination including the band; `validate`; no fallbacks;
   - the shortcut solvers on the band's own pool, at chance + 10 or recorded as a method by decision: Form's face shape, Hole Punch's crease symmetry;
   - `version` bumped; the "beginner at θ = 0" assertion moved to the new floor;
   - the demo at the band; the first two practice items at the band, then today's level 0;
   - a new check that **every foil kind in the Try items appears in the Watch item** (option `kind`s of the generated demo against those of the generated practice items).
2. **A new `tests/node/firstband.test.mjs`.** The `bands` method on the real definitions, with the pre-1.2 floors kept as constants in the test, 200 learners per cell. Assert:
   - (a) for the five exercises with Δ ≥ 1.5, A = 0 gives 74–84 % over the first 10 rated items;
   - (b) Angles and Hole Punch give at least 66 %;
   - (c) A = +1.75 reaches the pre-1.2 floor by item 10 (median);
   - (d) no stretch item among an exercise's first 10 rated answers (if B.2 is built).

   About 20 s in total, in line with the other engine tests.
3. **`node tests/node/sim.mjs --learners 200`**, all runs: coverage 93–97 % in train-balanced (after σ0 = 1.5), and Comfortable's gap.
4. **E2E** (`tests/e2e/fit.py`, the harness at 360 × 640 and 390 × 844): band items fit without scrolling; the rules card is visible on phones; Openings' larger cells; Hole Punch's two larger panels.
5. **After release.** Trial rows log the predicted success (`pPredMilli`). From the pooled exports, compare predicted against observed success on band items and refit Δ. This is the only real test of the numbers above.

## 4. Testing the two-minute start with a fresh agent [Proposal]

This builds on the method of `docs/dev/reviews/RV-play-dat.md` and `RV-play-nav-knots.md`, and closes the gaps those testers named themselves:
- they zoomed screenshots and measured outlines with scripts;
- their scores "show that the rules and controls are usable", not how hard the items are for a person;
- Views has never had this test (standing-rules-gap TM2).

**Who, and what it may see.**
- One fresh agent per run, with no memory of earlier runs. It gets only the app (`index.html` over file://, or `dist/Parallax.html`) through a Playwright driver offering viewport screenshots, tap or click at a point, scroll, type and wait.
- It must not read:
  - the repository, docs, guide, git history or earlier reviews;
  - the DOM, the accessibility tree, hidden text (`.px-sr`), `__harness`, the console or storage.
- It must not use image-analysis scripts, measure anything, or zoom beyond the device's pixel ratio.
- "How to play" is allowed if the agent finds it itself, as a player could.
- Each exercise and device gets a new browser context with empty storage. The welcome pop-up is handled as a player would.

**Devices** (as in `tests/e2e`):
- phone 390 × 844, DPR 2, touch only (`has_touch`, `is_mobile`);
- desktop 1366 × 768, mouse;
- small phone 360 × 640, touch, for Hole Punch, Missing View and Form, which have the most to fit.

**Path.** Library → the exercise → Practise → "Train this exercise" → the "New: …" card → "Watch, Try, Go" → Watch → Try → the first five scored items → end the session. The DAT-style focus stays off; players open these exercises explicitly.

**Novice constraints.**
- Each item gets an answer within 60 s of appearing (a beginner's patience; prep pacing is 20–60 s per format, R3 §2.1). Undecided at 60 s means the best guess.
- Before every answer, the agent writes one line: the answer and the reason in the format's terms (e.g. "2: the outline is 3 × 2 cells and the step is on the left").
- After the Watch and before Try 1, the agent writes the format's rules in its own words, in 2–4 lines, without looking back.

**Recorded** (UTC timestamps from the driver):
- t0 = the tap on "Watch, Try, Go";
- the end of the Watch;
- every Try and scored answer: right or wrong, the slot, the seconds taken;
- whether show-me played and was watched to the end;
- the rules statement and every reason line;
- screenshots: the rules card, the Watch's last caption, each Try item before the answer and after the feedback, the first scored item;
- problems, each with a screenshot: anything clipped, covered, unreadable or ambiguous at that size; dead ends; a caption under 3 s; no next step said after the demo.

**Grading.** Done by someone other than the tester (the lead, or a second agent with the seeds and the solutions):
- the rules statement against the 2–3 rules of §3 (right, partly, missing, wrong);
- every reason line (right reason; right answer with a wrong reason; wrong).

**Success, per exercise × device:**
1. **Two-minute start:** a Try item answered right *with a right reason* within 2:00 of t0. The "Your turn" item does not count, since the demo solved it.
2. **Rules understood:** every rule right or partly right, none wrong.
3. **Try:** at least 3 of 4 right at the first attempt.
4. **Scored start:** at least 4 of the first 5 right, with the median time per item within the format's budget (prep pacing, R3 §2.1, rounded up):

   | Format | Budget per item |
   |---|---|
   | Angles | 20 s |
   | Hole Punch | 25 s |
   | Painted Cubes | 40 s |
   | Views | 40 s |
   | Missing View | 45 s |
   | Openings | 50 s |
   | Form | 60 s |

5. **No blocker:** every option and control is reachable during an item without scrolling the stimulus away; no dead end; captions ≥ 3 s; the next step is said after the demo.

**Pass rule.** Three independent runs per exercise and device.
- Criteria 1, 2 and 5 must hold in at least 2 of 3 runs on every device.
- Criteria 3 and 4 must hold in the median run.

A fail on 1 or 2 points at the teaching; a fail on 3 or 4 with 1 and 2 passed points at the band's difficulty.

**Report.** One row per exercise × device:
- time to the first right Try answer with a right reason (m:ss);
- rules score;
- Try x/4;
- scored x/5 with the median seconds;
- problems, with screenshot names.

The times go into `docs/dev/VERIFY` under TM2, as the plan asks. Order: Form first (it failed in 1.1), then Openings, Missing View, Views (never tested), Painted Cubes, Angles, Hole Punch.

**Limits, and the human check.**
- An agent reads text better and 3D pictures worse than a person.
- It cannot report boredom or confusion honestly.
- So pair the gate with milestone 2's playtest mode:
  - 3–5 community players per exercise who are new to the format;
  - the three taps (fun, clarity, difficulty) and notes;
  - the first-session numbers (success and times on the first 10 rated items) read from their playtest reports.

The agent test is the gate. The community numbers are the evidence, and the first data to refit Δ.

## 5. Sources

Read levels: **[F]** full text, **[A]** abstract or record page only, **[S]** secondary report (named). All web pages were read on 2026-11-18. DOIs marked "from memory" were not resolved in this pass.

**Opened this pass**
- Ahissar, M., & Hochstein, S. (1997). Task difficulty and the specificity of perceptual learning. *Nature*, 387, 401–406. https://doi.org/10.1038/387401a0. [A] (nature.com, abstract only)
- Roads, B. D., et al. (2018). The easy-to-hard training advantage with real-world medical images. *Cognitive Research: Principles and Implications*, 3, 38. https://doi.org/10.1186/s41235-018-0131-6. [F] (SpringerOpen page; figures missing)
- Sorby, S. A., Veurink, N., & Streiner, S. (2018). Does spatial skills instruction improve STEM outcomes? The answer is "yes". *Learning and Individual Differences*, 67, 209–222. https://doi.org/10.1016/j.lindif.2018.09.001. [A] (Michigan Tech Digital Commons record, https://digitalcommons.mtu.edu/michigantech-p/6855/)
- Richards, M. C., Veurink, N. L., & Sorby, S. A. (2021). Teaching spatial skills online during a global pandemic. ASEE Annual Conference. https://peer.asee.org/37821.pdf. [F]

**Through the repository's earlier notes** ([S], with that note's own read level)
- `docs/research/v1.0/A-evidence.md`:
  - Uttal et al. 2013, *Psychological Bulletin* 139(2), 352–402;
  - Sorby 2009, *IJSE* 31(3), and the Sorby & Veurink c. 2010 slides (PSVT:R figures);
  - Miller & Halpern 2013, *LID* 26, 141–152;
  - Stieff, Dixon, Ryu, Kumi & Hegarty 2014, *J Educ Psychol* 106(2), 390–402;
  - Hawes, Gilligan-Lee & Mix 2022, *Dev Psychol* 58(1), 112–137.
- `docs/research/v1.0/D-motivation.md`:
  - Mayer 2005 (pre-training);
  - Höffler & Leutner 2007, *Learn Instr* 17(6), 722–738;
  - Kalyuga et al. 2003;
  - Chu et al. 2017;
  - Andersen et al. 2012 (CHI);
  - Keehner, Hegarty, Cohen, Khooshabeh & Montello 2008, *Cogn Sci* 32(7);
  - Liu, Lu & Dosher 2010, *J Vis* 10(10):29;
  - Wisniewski, Zierer & Hattie 2020;
  - Wilson, Shenhav, Straccia & Cohen 2019, *Nat Commun* 10, 4646.
- `docs/research/v1.0/B-tasks.md`:
  - Burte, Gardony, Hutton & Taylor 2017 (*Cogn Res*) and 2018 (*PAID*);
  - Shepard & Feng 1972;
  - Sorby's modules.
- `docs/research/v1.1/R4-test-overlap.md` §4.2:
  - Schneider, Becker, Krieger, Spinath & Sparfeldt 2020, *Intelligence* 82, 101473;
  - Levacher et al. 2022;
  - Krautter et al. 2021, *Front Psychol* 12, 619440.
- `docs/research/v1.1/R3-dat-pat.md`:
  - §2–3: the ADA sheet and prep sources (Kaplan, Bootcamp, Shemmassian, Booster, masterstudent.ca);
  - Kurtuluş & Yolcu 2013, *Mathematics Educator* 22(2);
  - Dillon, Duyck, Dehaene, Amalric & Izard 2019, *JEP:HPP*;
  - §4.3: Stavridis et al. 2015 (ASEE).

**Repository** (read for this note)
- Code: `js/ex/{views,angles,cubes,openings,form,patfold,patviews}/{gen,learn,view}.js`; `js/engine/model.js`, `estimator.js`, `modes.js`; `js/ui/play.js` (`wtg`, `makeRunner`, `tipFor`, `yourTurn`), `library.js`, `section.js`; `js/ex/registry.js`.
- Docs: `docs/dev/ENGINE.md` §1–5 and §16; `docs/dev/EXERCISE-GUIDE.md`; `docs/dev/PLAN-v1.2.md`; `docs/dev/v1.2/standing-rules-gap.md`.
- Reviews: `docs/dev/reviews/RV-play-dat.md`, `RV-dat-style-A.md`, `RV-dat-style-B.md`, `RV-play-nav-knots.md`.
- Tests: `tests/node/run.mjs`, `sim.mjs`, `fixtures/learner.mjs`, `fixtures/exercises.mjs`, and the seven exercise tests.
- Screenshots: `docs/shots/ex07-views.png`, `ex14-openings.png`, `ex18-cubes.png`, `ex19-form.png` (not at the easiest level).

## Could not open

The shared web-search budget was spent before this section's searches, and most publisher pages needed an approval that did not come. Each entry gives what I needed and the assumption used meanwhile.

- **Atkinson, Derry, Renkl & Wortham 2000**, *Rev Educ Res* 70(2), 181–214, doi 10.3102/00346543070002181 (from memory).
  - Needed: the worked-example effect for novices, sizes and conditions.
  - Assumed: worked examples help novices on well-structured problems.
  - Used for: the Watch at the band (§3.0 C2).
  - Read in full on 2026-11-18: see the addendum below. It supports the Watch and the faded Try 1 in kind; it does not test fading.
- **Renkl & Atkinson 2003**, *Educ Psychol* 38(1), 15–22, doi 10.1207/S15326985EP3801_3 (from memory); and **Atkinson, Renkl & Merrill 2003**, *J Educ Psychol* 95(4), 774–783, doi 10.1037/0022-0663.95.4.774 (from memory).
  - Needed: whether fading worked steps one at a time beats example–problem pairs, and the size of the effect; the effect of self-explanation prompts.
  - Assumed: fading helps near transfer, and prompts add to it.
  - Used for: the faded Try 1.
- **Barbieri, Miller-Cotto, Clerjuste & Chawla 2023**, *Educ Psychol Rev* 35, 11, doi 10.1007/s10648-023-09745-1 (from memory).
  - Needed: a recent pooled effect for worked examples.
  - Assumed: a moderate positive effect.
  - No number is used.
- **Pashler & Mozer 2013**, *JEP:LMC* 39(4), 1162–1173, doi 10.1037/a0031679 (from memory).
  - Needed: whether easy-to-hard fading helps perceptual category learning.
  - Assumed: a modest and conditional benefit.
  - Used only alongside Roads et al. and Ahissar & Hochstein.
- **Clare & Jones 2008**, *Neuropsychol Rev* 18, 1–23, doi 10.1007/s11065-008-9051-4 (the site returned an error).
  - Needed: who benefits from errorless learning.
  - Assumed: the clearest benefit is in memory impairment.
  - Used for: §2.5.
- **Metcalfe 2017**, *Annu Rev Psychol* 68, 465–489, doi 10.1146/annurev-psych-010416-044022 (the approval was not answered).
  - Needed: errors followed by feedback in healthy learners.
  - Assumed: as good as errorless learning or better.
  - Used for: §2.5 (do not hide errors).
- **Fyfe, McNeil, Son & Goldstone 2014**, *Educ Psychol Rev* 26, 9–25, doi 10.1007/s10648-014-9249-3 (from memory).
  - Needed: the evidence for concreteness fading.
  - Assumed: concrete-to-abstract sequences help.
  - Used only for the optional blocks step and the Missing View scaffold.
- **Pollock, Chandler & Sweller 2002**, *Learn Instr* 12(1), 61–86, doi 10.1016/S0959-4752(01)00016-0 (from memory).
  - Needed: teaching elements in isolation before their interactions, for novices.
  - Assumed: it helps on material with many interacting elements.
  - Used for: "one new feature at a time" (§3.0 B2).
- **Ben-Chaim, Lappan & Houang 1988**, *Am Educ Res J* 25(1), 51–71, doi 10.3102/00028312025001051 (from memory).
  - Needed: the effect of instruction with cube buildings on spatial visualisation.
  - Assumed: positive.
  - No number is used.
- **Duesbury & O'Neil 1996**, *J Appl Psychol* 81(3), 249–260, doi 10.1037/0021-9010.81.3.249 (from memory).
  - Needed: whether practice with 3D models beside orthographic views helps.
  - Assumed: yes.
  - Supports, but is not needed for, the Missing View scaffold.
- **Hsi, Linn & Bell 1997**, *J Eng Educ* 86(2), 151–158, doi 10.1002/j.2168-9830.1997.tb00278.x (from memory).
  - Needed: explicit strategy instruction in engineering graphics.
  - Assumed: positive.
  - Stieff et al. 2014 carries the claim.
- **Sorby 2009**, primary text, *IJSE* 31(3), 459–480, doi 10.1080/09500690802595839 (from memory).
  - Needed: the module content and the pre/post data first-hand.
  - Used the v1.0 note's secondary figures meanwhile.
- **Sorby, Veurink & Streiner 2018**, full text. Needed: effect sizes, which the record page does not give.
- **Ahissar & Hochstein 1997**, full text. Needed: the methods and the size of the easy-first effect; only the abstract was seen.

## Addendum 2026-11-18: Atkinson et al. 2000 (full text read)

Added 2026-11-18 (UTC) by a research reader.

**Source.** Atkinson, R. K., Derry, S. J., Renkl, A., & Wortham, D. (2000). Learning from examples: Instructional principles from the worked examples research. *Review of Educational Research*, 70(2), 181–214. https://doi.org/10.3102/00346543070002181 (the DOI listed under "Could not open"; journal, volume and pages match the copy read). **[F]**: all 34 pages, from the text layer of a scanned copy the owner supplied, with the framework figure checked on its page image. The copy stays outside the repository.

**What kind of source it is.** A narrative review that turns the worked-examples research into design principles; not a meta-analysis. It reports directions and conditions, one effect size (item 8 below) and almost no sample sizes. Nearly all its studies used well-structured textbook problems (geometry, algebra, probability, statistics, physics, programming), in laboratories or classes. Carrying the principles over to spatial formats is my inference.

### A. What the review found

1. **Scope.** Worked examples matter most early in learning a skill, while learners solve by analogy to examples and are forming verbal rules (the first two stages of the ACT-R account the authors use). For fluent, automatic performance, practice is what counts.
2. **Integrated format; split attention.** Examples that make the learner combine a diagram with separate text lose their benefit. In Tarmizi & Sweller 1988 (circle geometry, experiment 3), split-source examples were no better than problem solving and slower on the posttest; with the explanations placed into the diagram (experiments 4–5) they beat both problem solving and split-source examples. Ward & Sweller 1990 replicated this in high-school physics classes, over three long experiments.
3. **Two modalities.** Diagrams with spoken statements gave faster posttest solutions than all-visual examples (Mousavi, Low & Sweller 1995: modest evidence in experiments 1–2, consistent in 3–4). With visually complex diagrams the spoken version helped only when a visual cue, a flashing highlight, showed which part was being described (Jeung, Chandler & Sweller 1997).
4. **Subgoal labels.** Marking the solution's subgoals, with a label or simply by setting each group of steps apart, improved transfer to new problems across Catrambone's studies. The presence of a label mattered more than its wording, and visual separation alone worked as well. In the first study the gain showed on one of four novel items (Catrambone & Holyoak 1990). Labels also improved learners' self-explanations (Catrambone 1996, 1998).
5. **How many examples, and in what order.** Two examples, a simple and a more complex one, beat a single example, even one given with written procedures (Reed & Bolstad 1991); the authors' rule is to add at least a second example. Alternating each example with a matched practice problem beat a block of examples followed by a block of problems, in time and accuracy on near transfer (Trafton & Reiser 1993).
6. **Variability.** Mixing problem types within a lesson helped transfer only together with worked examples; variability had no main effect (Paas & van Merriënboer 1994). Different cover stories within a type, with the same set of stories across types, taught learners to sort problems by structure (Quilici & Mayer 1996).
7. **Incomplete examples**, the review's nearest thing to fading. Examples with blanks that learners filled in, with feedback after each, raised self-explanation, cut shallow rereading and improved transfer against complete examples (Stark 1999); Paas 1992 found no difference, but that was not its main question. The review does not test fading as such (removing steps one by one over a series) or which step to remove first; a fading report by Renkl, Atkinson & Maier (2000) is cited only as the source of its first figure.
8. **Self-explanation.** Learners who explain the steps to themselves learn more (Chi et al. 1989). The successful styles are anticipating the next step and then checking it, or explaining the principle behind each step; most learners are passive (Renkl 1997b). Self-explanation rises with structure (subgoal labels, incomplete examples, an integrated format) and with short training: explicit training beat implicit training, with better programming outcomes (Bielaczyc, Pirolli & Brown 1995); in Renkl, Stark, Gruber & Mandl 1998 about 15 minutes (why explaining matters, one modelled example, one coached example) raised self-explanation activity by **about two standard deviations**, the review's only effect size, improved transfer, and helped learners with little prior knowledge most on near transfer. Training helped on conceptual story problems but not on bare symbol manipulation, where there is little to explain (Nathan, Mertz & Ryan 1994).
9. **Explaining to others.** Expecting to teach did not help and seemed to hurt, through stress and lower intrinsic motivation; explaining to a partner raised explanations but not learning (the listeners did better); a partner's questions helped poorly motivated learners and hindered the others (Renkl 1995–1998). Novices without tutoring experience were overloaded by the double task.
10. **The authors' framework** (their Figure 2). Lesson and example design act on learning directly and through the quality of self-explanation; short prompts or training act through self-explanation; a learner's own explanation style matters too.

### B. What this checks in D2

| D2 statement (where) | Verdict |
|---|---|
| Worked examples help novices most on well-structured problems (§2.2, first point) | Supported in kind: the review places worked examples in the first stages of skill learning, on well-structured problems. No effect size. |
| Fading steps one at a time beats abrupt example–problem pairs (§2.2, second point) | Not tested in this review. Its nearest evidence: incomplete examples beat complete ones (Stark 1999), and examples paired with problems beat blocked ones (Trafton & Reiser 1993). Stays [unverified] until Renkl & Atkinson 2003 or Atkinson, Renkl & Merrill 2003 is read. |
| Prompts to explain a step add to the effect (§2.2, third point) | Supported for training and for prompts built into the example (labels, blanks), with one size: about 2 SD on self-explanation activity, transfer improved, learners with little prior knowledge helped most (Renkl et al. 1998). Limit: little gain where the procedure leaves nothing to explain (Nathan et al. 1994). |
| The Watch is the worked example; Try 1 has its first step done; Try 2 is unaided (§2.6 #2, §3.0 C) | Consistent: Try 1 is an incomplete example in Stark's sense, and Watch → Your turn → Try 1 is an example–problem pair. Feedback on the done step itself (Stark gave it per blank) is missing; show-me after a miss covers part of it. |
| One strategy in the format's terms before practice (§2.6 #3) | Consistent with subgoal labelling, if the card's steps are the labelled steps the Watch shows (change 1 below). |
| Try stays within one variant (§3.1, Views) | Supported: variability helped only together with examples (Paas & van Merriënboer 1994). |

### C. Changes to the teaching template (§3.0 C–D)

[Proposal], concrete, with owners. Requests filed on 2026-11-18 in docs/dev/v1.2/requests.md where marked.
1. **Labelled steps in the Watch** (item 4). The captions that solve the item (after the ones that introduce the parts) start with the strategy card's step they carry out, in the card's order and words, e.g. "1/3 · Smallest first: …". The card that follows the Watch repeats those labels, and show-me after a miss uses them too, as §3.0 D already asks. Data only, in learn.js and view.js. Request: W1-band-A, W1-band-B.
2. **Point at what each caption names** (item 2, and Jeung et al. in item 3). While a caption shows, the part it names is marked on the figure (ring, tint or trace); no caption refers to an unmarked part. It matters most on phones, where the caption sits pinned under the item. Same request lines.
3. **Say why** (item 8: principle-based explanations; the authors' call to make an expert's reasoning visible). Each solving caption names the rule behind its step in a few words ("…: it touches the ground, so its bottom is unpainted"), within the 3 s reading floor. Same request lines.
4. **A second worked example before the first hard feature** (item 5). The Try item that brings the first hard feature (Painted Cubes' hidden cube, Missing View's dotted line, Openings' turned openings, Form's half mark, which is §3.5's mini-demo, Hole Punch's slanted fold) is preceded by a short worked example of that feature on a sister item, and then answered. Player: a practice entry `example: { seed }` (W1-core); data: the band builders. Request: W1-core, low priority.
5. **One new feature per Try item** (§3.0 B2; the official sheet's first cube example teaches the hidden support on four cubes, note D1 addendum A.1 row 8). Painted Cubes' Try 3 becomes a 4–5-cube figure with one hidden support; the pre-1.2 floor moves to Try 4. Request: W1-band-A.
6. **Later, not wave 1.** A one-tap "why?" after the first right Try answer on the rule-based formats (Painted Cubes, Missing View, Hole Punch, Form; not Angles, which is perceptual): three reasons to pick from, feedback that names the rule. It fits milestone 4's one-tap menus (comparison rounds).
7. **Not adopted.** Spoken captions (modest evidence, and with complex figures only alongside visual pointers, which change 2 gives). Asking beginners to explain items to others as a way to learn (it overloaded novices); community features should not lean on it.

Unchanged: the rules card before the Watch, the strategy card before Try 1, Try 1 with its first step done, Try 2 unaided, show-me after a miss, and scaffolds that fade with skill (examples serve the early stages; practice builds fluency).
