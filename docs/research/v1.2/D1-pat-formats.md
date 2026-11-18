# D1. The real PAT formats, and rebuilding the six DAT-style exercises to them

Phase 1 research note for v1.2, milestone 8 ("DAT-style, rebuilt to the real PAT formats"). Started 2026-11-18
11:20 UTC on branch `build`. It builds on docs/research/v1.1/R3-dat-pat.md (R3) and does not repeat it: where R3
already settled a fact, this note cites R3 and adds only what is new or corrected.

Status: complete, 2026-11-18 (UTC). Gaps and unread sources are listed under "Could not open".
Addendum, 2026-11-18 (UTC), at the end of this note: the ADA's PAT instruction sheet and the DAT 2026 Candidate
Guide, both read in full. Where the addendum differs from §1–§6, the addendum wins.

## 0. How to read this note

**Labels.** Three kinds of statement are kept apart:
- **[Src]** what a named source says (paraphrased; quotes are under 15 words, at most one per source);
- **[Inf]** my inference from sources or code;
- **[Prop]** my proposal for v1.2;
- **[Code]** what the repository's code shows (§3).

**Read levels** (given for every source in §7):
- **[F]** full text, read through the fetch tool, which returns a model-written digest of the page in answer to
  targeted questions (figures and images are not seen);
- **[F-part]** part of the text only;
- **[A]** abstract or summary only;
- **[S]** secondary report, with the reporting source named;
- **[T]** title or metadata only;
- **[R3]** taken from R3 without re-reading the source.

**Rules kept.** No test items, drawings, instructions or sample questions are copied or closely described; formats
are described in my own words. No images were downloaded or saved. Forum content is paraphrased without names.
Legal sections report facts with sources and are **not legal advice**.

## 1. Summary

1. **The real format** (§2). 90 items in 60 minutes on one clock, six parts of 15 in a fixed order, one item per
   screen, mark-and-review, noteboards. Options are **lettered** everywhere: apertures 5 (A–E), views 4,
   angles 4 (angles numbered 1–4, options A–D), paper folding 5 (best-supported; the official count was not
   read), cube counting 5 (A–E = 1–5 cubes, never zero), pattern folding 4. Cube counting asks **2–5 questions
   per figure** (about 3; about 5 figures). Views: two of top, front, end in fixed places, no perspective, dotted
   hidden edges, general solids (steps, notches, holes, curved features in prep). Pattern folding has three kinds
   of item: plain shapes, shaded faces, cubes. The drawings' look is documented only secondarily (black-and-white
   line drawings, shading for marked faces); no official figure was seen in R3 or here.
2. **Gaps in Parallax 1.1** (§3). All six number their options; Angles has the test's labelling reversed.
   Painted Cubes asks one question per figure and never about five painted sides. Missing View uses cube stacks
   with a fill tone. Form puts a chiral half mark and mirror foils into every level and has no plain-shape items.
   Openings starts at three features with every opening turned or flipped. Painted Cubes and Form use face tones,
   Openings a WebGL shaded solid. Section practice stops the clock at part intros and keeps navigation inside a
   part. Hole Punch matches apart from added cues (flap shading, arrows) and the rare half folds.
3. **Legal** (§4, not legal advice). No patent on the PAT or its formats was found. Any patent on formats used
   since 1981 or earlier would have expired; three related documents found are lapsed or abandoned. Copyright
   protects the ADA's items (including recalled ones), instructions and figures, not formats or rules (17 U.S.C.
   §102(b); USCO Circular 33). The ADA treats DAT as a registered mark; naming the test descriptively with a
   non-affiliation line fits nominative use (US) and s.11(2)(c) (UK). Commercial prep products publish their own
   items in all six formats, many with the marks in their product names and some with no disclaimer. The plan's line
   is right about formats and wrong in two details: the name may be used descriptively (it is only off-limits as
   a product or exercise name), and the test letters its options rather than numbering them.
4. **Prep products** (§5). Generators, videos, 3D models and practice tests are standard. Difficulty is ramped
   only by test number (Booster) or not at all, and progress is reported by part or subtype at best (Booster's
   analyzers). Students praise volume, generators and explanations, and complain about ambiguous or unrealistically
   subtle items and practice difficulty that does not match the test. Parallax can go further with validated items, a
   stated test range per level, error-naming feedback, analytics by item feature, adaptive practice and an honest
   Section.
5. **Recommendations** (§6), in order:
   1. letters and a plain line-drawing look for all six, with a stated test range per level;
   2. Angles' labelling;
   3. Painted Cubes figure sets with 2–4 questions;
   4. Form's three item kinds and non-convex prisms;
   5. Missing View on profile solids;
   6. Openings' test-range start, orientation dim and line-drawn stem, then arcs;
   7. Section under test conditions;
   8. Hole Punch's look, then half folds.

   The main risks are new solvers (Missing View uniqueness over solids, Form visibility on non-convex solids,
   arcs in Openings), planner support for figure sets, recalibration after the look change, and version bumps
   (ratings ignore the version, so widen their uncertainty).

## 2. The real format of the six PAT parts (question 1)

**Source base for this section.** The ADA's own documents could not be opened in this pass (ada.org and
prometric.com fetches were refused; see "Could not open"). Official facts below therefore come from R3, which read
the ADA's PAT instruction sheet (© 2025) and the 2026 Candidate Guide through a digest, without seeing their
figures. This pass adds prep and forum sources read on 2026-11-18 (keys in §7). No source in either pass showed
the real on-screen drawings, so every statement about the look is secondary.

### 2.0 The whole test

- **Size and order** [Src]. 90 items in 60 minutes, six parts in a fixed order: apertures, view recognition,
  angle discrimination, paper folding, cube counting, 3D form development (R3, from the ADA sheet and Candidate
  Guide; the ADA's DAT guide page, read here, confirms 90 items). The ADA gives only the total; every prep
  source read says 15 per part (Kaplan-W, BC-guide, BO-guide, MS, TN, WP; TPP says so explicitly).
- **Time** [Src]. One clock for the whole section, about 40 s an item. Prep pacing advice: apertures and views
  about 45–50 s, angles about 20 s, hole punching 20–25 s, cube counting about 1–2 minutes per figure, pattern
  folding up to 60 s (Kaplan-W; BC-success).
- **Screen and navigation** [Src]. On computer at a Prometric centre, one item per screen, laminated noteboards,
  no rulers or other measuring devices (R3, Candidate Guide). An optional 15-minute tutorial comes before the
  test (BO-day). Items can be marked and revisited; a review list of marked and unanswered items comes at the end
  of the section (BO-day; SDN-BC16). Forum reports add right-click strike-out of options (SDN-BC16, 2016) and
  that a 2026 test taker started with the angle part and did the others afterwards (SDN-BD26).
  [Inf] Navigation is free across all 90 items; the part order is a default, not a constraint.
- **Labels** [Src]. Options are lettered in every part: A–E where there are five, A–D where there are four (R3
  for angles and cube counting from the ADA sheet; Kaplan-K for apertures; DP for all six; BO-x for angles and
  pattern folding; Kaplan-P and SH-SR for pattern folding; UTP for angles). In angle ranking the four angles carry
  the numbers 1–4 and the options are the lettered orderings (R3; UTP; BO-x).
- **Changes.** R3 found no PAT content change in 2022–2026 (the March 2025 change was the 200–600 score scale).
  This pass found nothing newer, but the search budget ran out before a full re-check (§2.8).

| Part (ADA name / prep name) | Options | Items | Pacing (prep) |
|---|---|---|---|
| Apertures / keyholes | 5, A–E | 15 | 45–50 s |
| View recognition / top-front-end (TFE) | 4, A–D | 15 | 40–50 s |
| Angle discrimination / angle ranking | 4, A–D (angles numbered 1–4) | 15 | about 20 s |
| Paper folding / hole punching | 5, A–E most likely (§2.4) | 15 | 20–25 s |
| Cube counting | 5, A–E, read as 1 to 5 cubes | 15, on about 5 figures | 1–2 min per figure |
| Spatial relations, 3D form development / pattern folding | 4, A–D | 15 | 45–60 s |

### 2.1 Apertures (keyholes)

- **Layout** [Src]. One pictured solid and five openings, A–E (R3; Kaplan-K; MS; BO-guide; BC-success; DP; TPP).
- **Rules** (official, via R3; my paraphrase). The solid may be turned any way before it goes in, and may go in
  by a side the picture does not show. It then passes all the way through without turning. The right opening is
  exactly its outline in that direction. Solid and openings share one scale, so a right shape at the wrong size is
  wrong, and size differences are large enough to judge by eye. Hidden parts have no surprises, and an
  indentation that is symmetric continues on the hidden side. Exactly one opening fits.
- **What varies** [Src]. The solid's shape (indents, protrusions, cut corners), which of its directions fits, and
  how the wrong openings differ: by a feature, or by proportion (Kaplan-K; BO-guide; SDN-KP17). Prep conventions,
  not official: openings may appear turned in 90° steps or flipped (BO-x); a hole is taken to run right through
  unless a drawn back wall shows that it stops (BO-x).
- **Difficulty reports** [Src, forum, dated]. Mixed. Real keyholes were called easier and clearer than
  Bootcamp's or Booster's (SDN-GEN16, 2016; SDN-PB19, 2019); others found the real ones harder, with irregular,
  rock-shaped objects (SDN-TFE17, 2017) or every option slightly off in proportion (SDN-KP17, 2017). The ADA's old
  2007/2009 sample tests differed by shape rather than exact size (SDN-KP17).
- **Look** [gap]. No source describes it in words; see §2.7.

### 2.2 View recognition (top-front-end)

- **Layout** [Src]. Two of the three views of one object are given: top at upper left, front at lower left, end
  at lower right, always in those places. Any of the three can be the missing one. Four options, A–D (R3, ADA
  sheet; DP; MS). The views are drawn without perspective (R3; MS).
- **No 3D picture** [Src + Inf]. The official description and every other prep source describe only the views;
  one prep lesson (VT) says a 3D rendering is shown with them. [Inf] I treat that as VT's error.
- **Lines** [Src]. Solid lines are edges visible from that side; dotted lines are edges hidden from it (R3, ADA
  sheet; BC-guide; DP; MS).
- **Objects** [Src, prep]. Blocks with steps and notches; holes and divots (MS; DP); circular and half-circle
  features in Booster's worked solutions (BO-x). One 2019 forum report found the real objects simple, with no
  slanted lines or triangles (SDN-PB19). [gap] No source settles how often slopes or curves appear.
- **How options differ** [Src]. By one line, or by solid against dotted (BO-x). A 2026 test taker found that the
  options often come in two pairs by line type, so one visibility check removes two (SDN-BD26). Counting lines
  no longer separates the options on the current test (BC-guide; BC-study; SDN-TFE13, 2013).

### 2.3 Angle discrimination (angle ranking)

- **Layout** [Src]. Four interior angles, numbered 1–4; four options A–D, each an ordering from smallest to
  largest (R3, ADA sheet; UTP; DP; BO-x).
- **What varies** [Src]. Sizes and orientations: real angles point in different directions (SDN-AR15, 2015);
  arms differ in length, some very short (BO-x). Gaps between angles: forum estimates of roughly 2–10° (R3 §3.3,
  dated anecdotes); none newer found.
- **Look** [Src, forum]. Line thickness and sharpness differ between prep products and the real screen; one
  2019 poster found real lines blurry but the angles easier to separate (SDN-AR19).
- **Difficulty reports** [Src]. Bootcamp calls it the part where extra time helps least (BC-guide); a 2026 test
  taker called it the hardest part to improve (SDN-BD26).

### 2.4 Paper folding (hole punching)

- **Layout** [Src]. A square sheet in a row of panels. Broken lines show where the paper was, solid lines the
  folded paper; the paper is never turned over or twisted and stays inside the original square; after the last
  fold a hole is punched; the options show the unfolded square with its holes (R3, ADA sheet; DP; Kaplan-H;
  SH-PF).
- **Positions** [Src, prep]. Holes fall only on 16 positions in a 4 × 4 arrangement; on the options a filled
  circle is a hole and an empty circle a position without one (SH-PF; Kaplan-H).
- **Folds** [Src]. The official sheet says each item has more than one fold (R3). Prep sources say one to three
  (Kaplan-H; UTP), one or more (MS; DP) or about three or four (SH-PF). Creases run on grid lines, halfway
  between them ("half folds"), or at 45° corner to corner (SH-PF); the first fold can be on any edge or corner
  (Kaplan-H). Folds come toward the viewer (Kaplan-H); Booster also uses occasional folds away from the viewer
  (BO-x).
- **Punches** [Src]. One hole after the last fold (R3; DP); Kaplan-H says one or more. Half folds put some
  punches between grid spots in the folded drawing, which still land on grid spots when unfolded (SH-PF;
  SDN-HP17). Half-hole items seem rare on the real test: one in a 2016 report (SDN-GEN16); a 2026 test taker
  found Booster's six-fold and half-hole items much harder than the real ones (SDN-BD26).
- **Options** [Src]. Five, A–E, per DP; the other sources read do not state a number. R3 left it open (4 or 5,
  with Varsity Tutors items showing both). [Inf] Five is the better-supported reading; Parallax 1.1 uses five.

### 2.5 Cube counting

- **Layout** [Src]. A figure of equal cubes cemented together and painted on every exposed side except the
  bottom it rests on; cubes out of sight are there only to hold up others. Each question asks how many cubes
  have exactly a given number of painted sides, one to five; the options are A–E, read as 1, 2, 3, 4 and 5
  cubes; zero is never the right answer (R3, ADA sheet; DP).
  - SH-CC lists zero among the options. [Inf] That contradicts the official rule and is treated as SH's error.
  - [Inf] Since the official list runs to "all five sides", a question about five painted sides can occur.
- **Questions per figure** [Src]. Several: 15 questions on 5 figures, 2–4 each, about 3 on average (Kaplan-C);
  usually 3, from 2 to 5 (BC-guide); 5–6 figures, mostly 3 questions, never fewer than 2 (SDN-CC17, 2017);
  dat-prep's sample has one figure with 3 questions and one with 2 (DP). Prep advice is to tally the whole figure once and
  answer all its questions from the tally (Kaplan-C; BC-guide).
- **Screens** [gap + Inf]. Not found. Each question is one of the 90 items, so [Inf] the figure is shown again
  with each of its questions.
- **Look and size** [Src]. Black-and-white line drawings (SH-CC). [gap] Projection, cube counts per figure: not
  found (a 2012 forum question about figures over 20 cubes got no answer, SDN-CC12).

### 2.6 3D form development (pattern folding)

- **Layout** [Src]. One flat pattern; four pictured solids, A–D; exactly one is the folded pattern (MS; DP;
  Kaplan-P; SH-SR; BO-x; TPP).
- **Item kinds** [Src, prep]. Three kinds: plain faces, where the options are different solids; shaded faces,
  where the options share a shape and differ in where the shading falls; and cubes, carrying shaded patterns or
  die faces (SH-SR). Kaplan-P: some items test structure only, others shading or patterns. A Bootcamp success
  story: simple dice or shaded shapes, and complex many-sided shapes, which it calls the most common (BC-success).
  Partial shading, e.g. a shaded triangle on a face, appears in prep items (BO-x; BC-success).
- **Conventions** [Src, prep]. The pattern folds into the page, away from the viewer (BC-guide; BO-x; SH-SR, which
  adds that folding the other way would give the mirror image). Options may be shown turned or flipped (BO-x).
  Fold-line style is unsettled: dotted per BO-guide, plain solid lines per SH-SR.
- **Difficulty reports.** Kaplan calls it among the hardest parts (Kaplan-W); a 2016 forum poster called it
  relatively easy (SDN-BC16).

### 2.7 Look of the drawings, across parts

- [Src] What the rules imply: no perspective in the views; dotted hidden lines; broken lines for the paper's old
  position and solid for the folded paper; filled circles for holes; shaded faces in pattern folding (R3; SH-PF;
  SH-SR; BO-x). Cube figures are black and white (SH-CC).
- [Src] Forum: some real images looked blurry (SDN-BC16, 2016; SDN-AR19, 2019), and line weight differs between
  prep products (SDN-AR19).
- [gap] No source read in either pass shows or describes the real figures' line weights, fills or shading of
  solids and openings. The official example figures were not seen.
- [Inf] Everything the sources describe can be drawn with black lines on white (solid, dotted, broken), filled
  circles and one shading tone for marked faces. That is the safest "test look": it uses only conventions
  (orthographic views, hidden-line dots, a 4 × 4 hole grid) and copies no particular drawing.

### 2.8 What is still uncertain

1. Paper folding: five options (DP) against an unstated official number (§2.4).
2. Paper folding: more than one fold (official, via R3) against one to three folds (Kaplan-H, UTP).
3. Top-front-end: how often slopes and curves appear (BO-x against SDN-PB19).
4. Apertures: curved parts and through-holes are prep conventions only (BO-x); nothing official was read.
5. Pattern folding: fold-line style (BO-guide against SH-SR).
6. Cube counting: figure sizes, projection and whether each question's screen repeats the figure.
7. The look of every part (§2.7).
8. Whether part instructions on the real test stop the clock (Parallax's Section intro cards do). [gap]
9. Forum evidence is anecdotal, often 2013–2019, and contradicts itself on difficulty; it is used for direction,
   never for numbers.

## 3. Gap tables: the real format against Parallax 1.1 (question 2)

### 3.0 How the code was read

[Code] Headers, constants and `PX.ex.define` blocks of js/ex/{openings,patviews,angles,patfold,cubes,form}/gen.js,
all six learn.js files, the view.js headers, css/ex/cubes.css, js/core/ui.js (`choiceGrid`) and
js/engine/section.js, at commit 5399c2d. Review findings come from docs/dev/reviews/RV-dat-style-A.md (RV-A),
RV-dat-style-B.md (RV-B) and RV-play-dat.md (RV-play). Shared facts:
- All six use the `stem+options` layout. The shared choice grid prints a visible digit (1–9) on every option
  and takes keys 1–9 (js/core/ui.js `choiceGrid`); captions and feedback name options by number ("opening 2").
- Training has no time limit (no `timeLimit`, no variants in any of the six). Section practice (js/engine/
  section.js) runs the six parts in PAT order, 15 items each (full, 60 minutes) or 5 (mini, 20 minutes), at
  40 s an item, with items from the middle of each exercise's difficulty band.
- In the tables, "Real" is §2 [Src], "1.1" is the code [Code], "Rebuild" is my proposal [Prop].

### 3.1 Openings (EX-14) against apertures

| Aspect | Real | 1.1 | Rebuild |
|---|---|---|---|
| Options | 5, A–E | 5, numbered 1–5 | 5, lettered A–E |
| Stem picture | a pictured solid; style not documented (§2.7) | WebGL solid, flat-shaded with edge bars, three-quarter view (az 35°, el 28°); it fills about a third of its box on phones (RV-play §Openings) | black line drawing on white (SVG, no WebGL context), drawn as large as the box allows |
| Openings | outlines at the solid's scale | dark cut-outs on a plate; one shared scale since the RV-B fix, set by the openings, so the solid is drawn small | same shared scale, chosen so the solid is large; openings as outlined shapes |
| Option orientation | may appear turned or flipped (prep, BO-x) | every option under its own random turn or flip (D4), at every level | a dim: openings in the view's own orientation first, then turned, then turned or flipped |
| Solids | irregular solids; curved parts and through-holes in prep (BO-x) | intersection of three lattice extrusions: notches, steps, 45° chamfers; 2.5–4 units a side; no curves, no holes | add rounded notches and corners (arcs); keep no through-holes along a viewing axis (R3) |
| Feature count | varies; some simple objects (SDN-BC16) | features on all three profiles at every level: 3 at the easiest (1 + 1 + 1), up to 6 | a test range starting at two features, one on the fitting face and one elsewhere (D2 owns the band below) |
| Foils | features or proportion; exact fit rule | features; at foil level 1 one proportion foil ≥ 25 % | add "face, not outline" and "too large" foils (R3 §8.5), keep proportion ≥ 25 % in the test range |
| Rules taught | official rules (§2.1) | the same rules in Parallax's words (learn.js) | unchanged |

### 3.2 Missing View (EX-15) against top-front-end

| Aspect | Real | 1.1 | Rebuild |
|---|---|---|---|
| Layout | top upper left, front lower left, end lower right; any one missing | the same third-angle places; easiest level always misses the end view | unchanged (the missing view stays a dim) |
| Options | 4, A–D | 4, numbered 1–4 | lettered A–D |
| Objects | blocks with steps, notches, holes, circular features (MS, DP, BO-x); slopes unsettled | cube stacks only: height maps of 4–12 unit cubes on 3 × 3 or 4 × 4, at most 4 high | profile solids (R3 §8.2 phase B; O49): steps, notches, holes, arcs; slopes as a later level |
| Lines | solid visible, dotted hidden; no perspective | solid, and short dashes (4 / 3.5 px) for hidden edges, called dotted in the tutorial; the silhouette filled with a light tone | plain lines, no fill; dots rather than dashes for hidden edges |
| 3D picture | none | none in items (show-me draws one) | none in test-range items; a 3D model only as a first-band scaffold (D2) and in show-me |
| Foils | differ by one line or by solid against dotted; often in two pairs by line type (SDN-BD26) | outline, same-outline lines, solid-or-dotted (dim `foil`) | keep the three foil kinds; allow the pair structure the real test shows, with the shortcut bounds of RV-B §9 |

### 3.3 Angles (EX-16) against angle ranking

| Aspect | Real | 1.1 | Rebuild |
|---|---|---|---|
| Labels | angles numbered 1–4, options A–D | **the reverse**: angles lettered A–D, options numbered 1–4 (changed after RV-play found digits on both confusing) | angles 1–4 and options A–D, as on the test; letters also solve RV-play's confusion |
| Gaps | about 2–10° (forum, dated) | closest gap 6, 5, 4, 3, 2°; the others 1.3–1.6 times that | keep; D2's first band adds 10–15° below |
| Orientation | angles point different ways | `pose`: aligned (one arm horizontal) or free | keep; aligned is an easier-than-test level |
| Arms | lengths vary, some very short (BO-x) | 0.3–1 of the cell, the longer arm ≥ 0.7 | keep (cue balancing depends on it) |
| Look | thin lines; real screens reported blurry (SDN-AR19) | 2 px strokes, no arc, cells on a plate; 2 × 2 on phones, a row on wide screens | plain look; the four angles in a row where the screen allows |

### 3.4 Hole Punch (EX-17) against hole punching

| Aspect | Real | 1.1 | Rebuild |
|---|---|---|---|
| Options | 5 likely, A–E | 5, numbered; all with the key's hole count | lettered A–E |
| Sheet | 16 positions, 4 × 4; filled circle a hole, empty circle none | the same | unchanged |
| Folds | more than one (official), 1–3 (prep); on grid lines, half folds through positions, 45° diagonals, corner flaps | 2–3; creases on cell boundaries or 45° lines through grid vertices; half, corner, diagonal, mixed; idle folds 0–2 | add half folds (creases through a row of positions) as a top level |
| Punch | one hole; half-hole items rare | one punch, never on a crease, through whole cells | half-hole items only with half folds, rare by design |
| Panels | broken old outline, solid folded paper | the same, plus a shaded flap and an arrow | test look drops the flap shading and arrow; show-me and the first band keep them |
| Fold direction | toward the viewer (Kaplan-H); Booster adds rare away-folds | flaps always land on top | unchanged (away-folds are a prep convention, not documented officially) |

### 3.5 Painted Cubes (EX-18) against cube counting

| Aspect | Real | 1.1 | Rebuild |
|---|---|---|---|
| Questions per figure | 2–5, about 3 (Kaplan-C, BC-guide, SDN-CC17) | **one per trial** in training; Section asks several through `params.ask` | a figure with 2–4 questions in a row as the standard item, in training and Section |
| Painted sides asked | one to five | 1–4 only: five is never asked (gen.js; RV-A §5) | add five where its count is 1–5, with its answer skew bounded (§6) |
| Options | A–E = 1–5 cubes; zero never right | counts 1–5 with keys 1–5 | lettered A–E with the count, e.g. "B · 2 cubes" |
| Figure | cemented cubes, bottom unpainted, hidden cubes only as supports | height map 6–22 cubes, 1–4 high, G 3–5; every column's top at least half in view (stricter than the rule) | keep the model; the visibility rule stays (it guarantees one reading) |
| Look | black-and-white line drawing (SH-CC) | light grey cubes with three face tones and outlines, axonometric (az 31°, el 33.5°) | test look: white faces, black edges; tones as a first-band scaffold and in show-me |
| Tally | the noteboard | none (Section's tally pad is O12) | an optional on-screen tally pad wherever a figure has several questions |

### 3.6 Form (EX-19) against pattern folding

| Aspect | Real | 1.1 | Rebuild |
|---|---|---|---|
| Options | 4, A–D | 4, numbered 1–4 | lettered A–D |
| Item kinds | plain faces (different solids), shaded faces (same solid), cubes with patterns or die faces (SH-SR); many-sided shapes common (BC-success) | every item carries marks; every level includes a half-shaded (chiral) face; never a plain-shape item; never a cube | three kinds as levels: plain shapes, full shading, partial shading (the chiral half mark) last |
| Solids | prisms, pyramids, complex many-sided shapes, cubes | boxes, triangle, trapezoid and house prisms, wedges, rectangular pyramids, frusta; convex only | add L-, T- and U-prisms and other non-convex prisms (O51); cubes only with full-face shading (PR-1 rule, R3 §5.3) |
| Foils | different solids, wrong proportions, shading moved or swapped | level 0: one proportion foil and two mark foils, one of them the mirror image whenever that differs; level 1: three mark foils | plain kind: shape and proportion foils; shaded kinds: marks moved to congruent faces, mirror only at the partial-shading level |
| Pattern lines | dotted (BO-guide) or solid (SH-SR) fold lines | fold lines dashed, cut edges solid | keep dashed fold lines (unsettled on the test; dashed reads clearly) |
| Option views | turned or flipped | upright, on a side, upside down (dim) | keep |
| Look | line drawings with shaded faces | flat tones by face direction, outlines; marks darker tone plus hatch | white faces with black edges; marks in one tone plus hatch (rule 8) |

### 3.7 Shared gaps: layout, labels, look, time

| Aspect | Real | 1.1 | Rebuild |
|---|---|---|---|
| Option labels | letters | digits, from the shared grid | a letter mode in `choiceGrid` (keys A–E and 1–5 both work); captions say "option B" |
| Navigation in Section | free across all 90 items, mark, review list at the end, strike-out (forum) | part by part; Back, Flag, Items and Skip inside the current part; review after the end | free navigation across parts, a strike-out on options, the review list |
| Part intros | [gap] | each part opens with an intro card that stops the clock (RV-play) | in a "test conditions" option, intros before the clock starts, none inside it |
| Time | 60 minutes for 90 | training untimed; Section 60 or 20 minutes | unchanged (training stays untimed; Speed mode exists) |
| Figure plate | [gap] | theme tokens; Painted Cubes keeps light cubes in both themes | figures on a white plate in both themes (as Painted Cubes does), for the test look |

**Flags: where 1.1 is harder than, or different from, the real test** [Code against §2]

Harder:
1. Form: a chiral half mark from the easiest level, and mirror-image foils at foil level 0. The real test also has
   plain-shape and full-shading items, which 1.1 never shows.
2. Openings: at least three features on every solid, on all three faces, and every opening turned or flipped
   at random from the easiest level.
3. Painted Cubes: one question per figure makes a full tally pay off once instead of about three times; the
   real format rewards tallying once per figure. [Inf] This adds time per answer rather than difficulty per
   question.
4. Angles: the 2° closest gap sits at the bottom of the forum range (2–10°). It is a top level, not a start.
5. Openings at the planned 15 % proportion level (O50) would go beyond what any source documents.

Different, not harder (or easier):
6. Labels: digits on all six (letters on the test); Angles has the test's labelling reversed.
7. Painted Cubes never asks about five painted sides; the test can.
8. Missing View uses cube stacks with a light fill; the test uses general solids, plain lines.
9. Hole Punch adds flap shading and arrows (easier) and lacks half folds (rare on the test).
10. Painted Cubes and Form use face tones; the test uses line drawings.
11. Missing View draws hidden edges as short dashes; the test calls them dotted.
12. Section practice: clock stops at part intros; navigation limited to the current part; no strike-out.
13. Time pressure the test does not have: Speed mode's per-item limits and Section's mini form (30 items in 20
    minutes) are Parallax's own; the test has one 60-minute clock and no per-item limit. Both are optional.
14. Unknown, not flagged as harder: Painted Cubes' largest figures (18–22 cubes, columns 4 high) and Missing View's
    largest stacks (10–12 cubes); no source gives real figure sizes (§2.5).

Not different (checked): option counts (5, 4, 4, 5, 5, 4), 15 items a part in Section, one 60-minute clock,
the view positions, the 4 × 4 hole grid, cube-counting options 1–5 and the no-zero rule, the exact-fit and
shared-scale rule of apertures, untimed training against an untimed-per-item test.

## 4. Legal: patents, copyright, trademarks (question 3; not legal advice)

**This section is not legal advice.** It reports what statutes, official pages and records say, and marks my
inferences. Parallax is not a law firm, and nothing here was checked by a lawyer. US law is the main frame
because the ADA and the DAT are American; one UK provision is given for comparison.

### 4.1 Patents

- [Src] A US utility patent ends 20 years after its application was filed (35 U.S.C. §154(a)(2), LII).
- [Src] The PAT's parts have been in the DAT since at least 1981, when the ADA combined its two perceptual tests
  (R3, User's Manual). Paper folding and surface development go back further, to ETS's kit of factor-referenced
  tests (WP-SV names VZ-2 Paper Folding and VZ-3 Surface Development).
- [Inf] So any patent that ever covered these formats as such would have expired long ago.
- **Search done** [Src]. Web searches for patents on the PAT or its formats found none. Three related documents
  turned up:
  - US 6,877,989 B2 (filed 2002), a computer program that generates non-verbal test items from blueprints,
    including cube-folding items for spatial ability. It lapsed for unpaid maintenance fees, recorded in 2009
    (GP-989).
  - US 2021/0248917 A1, a university's method for measuring spatial ability for architecture and interior
    design. Abandoned (GP-917).
  - US 2012/0005143 A1, an automated item generator for matrix and series items. Abandoned in 2013 (GP-143).
- **Limits.** This was not a freedom-to-operate search. The shared web-search budget ran out after the first
  patent queries, so Google Patents was not searched by classification or by claim language (Could not open).
- [unverified, prior knowledge] Since *Alice v. CLS Bank* (2014), US courts often treat claims to mental or
  testing methods as abstract ideas, which narrows what a test-format patent could claim.

### 4.2 Copyright

- [Src] Copyright does not extend to an idea, procedure, process, system, method of operation, concept,
  principle or discovery, however it is expressed (17 U.S.C. §102(b), LII). The Copyright Office lists layout
  and format among things not protected, though a creative selection and arrangement of content can be (USCO
  Circular 33, revised 03/2021). *Baker v. Selden* (1879): the description of a system is protected, the system
  itself is not; the merger and scènes-à-faire doctrines leave unprotected the expression an idea forces
  (WP-IE).
- [Src] Secure tests, which are given under supervision and never sold, can be registered while their items stay
  confidential: the Office examines an unredacted copy and keeps only a redacted one (37 C.F.R. §202.13, LII).
  [Inf] The DAT fits that description, so its items are protected expression even though they are never
  published.
- [Src] The ADA's DAT pages and documents carry "© 2026 American Dental Association" (ADA guide page footer; R3
  for the PDFs).
- [unverified, prior knowledge; not read] US courts have held that copying or reconstructing secure test
  questions infringes, including through questions memorised by test takers: *Educational Testing Service v.
  Katzman* (3d Cir. 1986), *National Conference of Bar Examiners v. Multistate Legal Studies* (7th Cir. 1982),
  *Association of American Medical Colleges v. Mikaelian* (E.D. Pa. 1983).
- [Inf] What that protects here:
  - **Protected:** the ADA's items, including items recalled by test takers and shared on forums; its
    instruction texts; its example figures; its old sample tests (the 2007 and 2009 forms still circulate); and
    the particular drawings in any of them. Prep products' own items, drawings and explanations are protected too.
  - **Not protected:** the six formats, the rules as rules, the answer counts, the order of parts, the timing,
    and generic drafting conventions (orthographic views in third-angle places, dotted hidden lines, a 4 × 4
    hole grid, line-drawn cubes).

### 4.3 Trademarks

- [Src] The ADA writes "DAT®" (R3, Candidate Guides and web page; the guide page heading read here). R3 found no
  USPTO registration number for it, and neither did this pass [gap]. "Perceptual Ability Test" appears without ®
  in every source read; no registration was found [gap]. Others hold marks containing DAT: for example "DAT",
  registration 6270411, a dental consulting company, classes 9 and 41, live (MK-6270411). R3's note that this
  mark faced a pending cancellation could not be confirmed on the record read.
- [Src] US nominative use: a mark may be used to refer to the mark owner's own product where (1) the product
  cannot readily be identified without it, (2) only as much of the mark is used as needed (words, not logo or
  styling), and (3) nothing suggests sponsorship or endorsement (*New Kids on the Block v. News America
  Publishing*, 971 F.2d 302, 9th Cir. 1992; also *Playboy v. Welles*, 2002, and *Volkswagenwerk v. Church*,
  1969, on a repair shop naming the cars it serviced; WP-NU).
- [Src] UK: a registered mark is not infringed by using it to identify or refer to goods or services as the
  owner's, if the use follows honest practices in industrial or commercial matters (Trade Marks Act 1994
  s.11(2)(c), wording in force since 14 January 2019; LEG-UK). [unverified] EU law has a parallel provision
  (Regulation 2017/1001, Art. 14(1)(c)); the text could not be retrieved.
- [Inf] Saying that a Parallax format follows a part of the Perceptual Ability Test of the Dental Admission Test,
  in plain words, with the non-affiliation line, is the kind of use these doctrines describe. Using DAT or PAT as
  the name of a Parallax exercise, mode or code, using the ADA's logo or styling, or implying approval is not.

### 4.4 How prep products handle it

- [Src] Every commercial product read publishes practice in all six formats with its own items (TestPrepPal's free
  tool covers three), and most generate items:
  - Bootcamp: generators for angle ranking, hole punching, cube counting and pattern folding (BC-study).
  - Booster: 2500+ questions, and keyhole and pattern-folding generators sold as unlimited (BO-pat).
  - TestPrepPal: items built from stored parameters with computed keys (TPP).
  - The "PAT - DAT Score Booster" app: unlimited generated questions (APP-SB).
- [Src] Naming and disclaimers vary:
  - Many products carry the marks in their names (DAT Bootcamp, PATBooster, Crack DAT PAT, "PAT - DAT Score
    Booster").
  - Test Ninjas states that the DAT is an ADA program and that the ADA neither is affiliated with it nor endorses
    it (TN). Kaplan uses a generic line about third-party marks (R3).
  - Booster's PAT page (BO-pat) and TestPrepPal (TPP) show no trademark or non-affiliation line.
  - dat-prep.com names the wrong owner (the AAMC) (DP).
- [Src] Claims: Booster calls its questions "based on the real PAT" and offers a higher-score guarantee (BO-pat).
- [Inf] Format-matching practice with original items is the market's norm, and this pass found no dispute about
  it. But that is tolerance, not permission, and no search for litigation was possible after the budget ran out.

### 4.5 Checking the plan's statement

The draft says (docs/dev/PLAN-v1.2.md, milestone 8): matching a test's format is allowed; only the ADA's actual
questions, instructions and drawings, and its name, are off-limits.

- **"Matching a test's format is allowed."** Consistent with §4.1–4.2: formats and rules are not protected by
  copyright, and no live patent was found or is plausible for formats in use since 1981 or earlier.
- **"Only the ADA's actual questions, instructions and drawings."** Right, with three additions [Inf]:
  - items recalled by test takers and posted on forums, and the ADA's old sample tests, count as the ADA's
    questions;
  - prep products' items, drawings and explanations are off-limits too (they are the prep companies' work);
  - the Prometric screen design should not be replicated (R3 §6 already says so).
- **"…and its name."** Too strict as written, and not what Parallax does. Parallax already names the test,
  descriptively and with the ADA line (R3 §6; DECISIONS 13 Nov). [Prop] Suggested wording: "Only the ADA's
  questions (including recalled ones), instructions and drawings are off-limits. Its marks (DAT, Dental
  Admission Test) are used only to say what a format follows, in plain words with the ADA line, never as the
  name of an exercise, mode or code, and never with its logo."
- **"…with numbered options as on the test."** The test letters its options (§2.0). [Prop] "with lettered
  options (A–E, A–D) as on the test".

## 5. Prep products (question 4)

### 5.1 What each product does

All from the products' own pages unless marked; "R3" means read on 2026-11-13 and not re-read.

| Product | Items and generators | Difficulty ramp | Explanations and teaching | Progress reporting |
|---|---|---|---|---|
| **DAT Bootcamp** (BC-guide, BC-study, BC-success; R3) | practice tests (more in the Plus plan, R3); generators for angle ranking, hole punching, cube counting, pattern folding (BC-study); an angle-ranking "game" (BC-guide) | no settings described; forum: generators easier than the full-length tests (SDN-GEN17) | "PAT Academy" videos per part; worked solutions; rotatable 3D models of TFE objects (SDN-TFE17, 2017) | a test-centre simulation mode, custom timers, score predictions, comparison with past students (R3); students keep their own logs (BC-success) |
| **PATBooster** (BO-pat, BO-use, BO-x, BO-guide) | 2500+ questions, 10+ practice tests, keyhole and pattern-folding generators sold as unlimited, advanced generators | practice tests get harder in sequence, the last the hardest; analyzers point to weak types, then advanced generators drill them (BO-use); about 80 % accuracy before working on speed (BO-guide) | 1000+ videos, written solutions with annotated reference lines (BO-x), built-in 3D models for keyholes, cube counting and TFE, folds shown in 3D, chat with teachers | performance analyzers for angle ranking (by acute, right, obtuse), cube counting and hole punching; charts over time; games and prizes; a "higher score guarantee" |
| **Crack DAT PAT** (iOS app; R3) | generators for angle ranking, cube counting, hole punching, pattern folding, advertised as never repeating a question; full practice exams | not described | instant feedback, videos | not described |
| **"PAT - DAT Score Booster"** (iOS app; APP-SB) | unlimited generated questions, full-length tests, videos for all six parts | not described | videos | a performance report (mentioned in a review); rated 3.7 of 5 from 64 ratings; last update April 2024 |
| **TestPrepPal** free tool (TPP) | 30 items in three parts (angles, hole punching, cube counting), built from stored parameters with computed keys; apertures, views and pattern folding left out | untimed or timed sets; a mixed set at 40 s an item | a worked solution for every item | seconds per item at the end of a set |
| **DAT Genius** (2015 forum report, R3) | free generators for angle ranking, keyholes, hole punching, cube counting | unknown | unknown | unknown |
| Kaplan, Shemmassian, masterstudent.ca, Union Test Prep, Varsity Tutors | strategy articles and item banks | — | strategies per part (listed below) | — |

DAT Destroyer was not checked in this pass; R3 mentions it only as a product name containing the mark, and no PAT
component was confirmed.

**Strategies the market teaches** [Src] (R3 §3 plus this pass):
- **Apertures:** scan the options first and group them; take the outline along each of three axes ("crush flat");
  compare ratios of lengths, not raw lengths; eliminate by distances and slopes.
- **Views:** follow one distinctive feature through both given views and drop options that disagree; match
  line types; options often pair by line type, so one visibility check removes two (SDN-BD26).
- **Angles:** settle the extremes first; reference images (a knife edge for acute angles; for obtuse ones, which
  of two peaks looks flatter); look away between items; spend little time.
- **Hole punching:** sketch a 4 × 4 grid and unfold backwards from the last fold, mirroring holes across each
  crease; mark X (always a hole) and E (never) (BC-success); symmetry about the first fold (Kaplan-H).
- **Cube counting:** tally the whole figure once (columns 0–5), check the total against the cube count, answer
  every question of the figure from the tally (Kaplan-C); learn common positions.
- **Pattern folding:** a distinctive face first, then its neighbours; do not fold the whole thing; fold into the
  page; watch for mirrored or upside-down options.

### 5.2 What students praise and complain about

Paraphrased from forum threads and app reviews (§7); no names; most posts date from 2015–2019, two from 2025–2026.

**Praise**
- Generators for drilling one weak part and building speed (SDN-PB19; SDN-TFE17).
- Large volumes of practice; after it, some parts needed hardly any deliberate work (SDN-BD26).
- Detailed written explanations (SDN-PBvBC) and rotatable 3D models (SDN-TFE17).
- A test interface that behaves like the real one: marking, review, strike-out (SDN-BC16).
- Free daily items and study on the phone (APP-SB reviews).

**Complaints**
- **Realism disputes, both ways:**
  - Bootcamp's keyholes too extreme or subtle compared with the real test (SDN-GEN16; SDN-FR15).
  - Booster's keyholes ambiguous, with unclear right and wrong answers (SDN-PB19).
  - Booster's six-fold and half-hole items much harder than the real ones (SDN-BD26).
  - Bootcamp's PAT easier than the real one (SDN-BC25, a post by a competing vendor; SDN-PBvBC).
  - Generators easier than the full-length tests (SDN-GEN17).
- **Prediction:** practice scores do not track real scores well; posters report real scores both above and
  below their practice scores (SDN-FR15; SDN-PB19; SDN-BC25).
- **Quality:** app bugs, e.g. stray dotted lines in a 3D viewer, glitchy hole-punch explanations, keyhole
  options that did not change between figures; uneven quality for the price (APP-SB).
- **Hard to improve:** angle ranking (BC-guide; SDN-BD26), and running out of time after slow keyhole and TFE
  parts (SDN-FR15).

[Inf] The complaints that recur are about items, not features: ambiguous or unrealistically subtle items, and
difficulty that does not match the real test. Both are what Parallax's validators, shortcut bounds and
explicit level scale address.

### 5.3 Where Parallax can go beyond them

[Inf/Prop]
1. **Items that cannot be ambiguous.** Every Parallax item has an independent validator, a distinct-enough rule
   for foils and bounded shortcuts (CLAUDE.md rules 4–5). No product read claims either, and ambiguous keyholes
   are the commonest complaint.
2. **A stated test range.** Mark which levels of each exercise fall inside the real format as documented (§2),
   which sit below it (D2's first band) and which go beyond it (2° gaps, 15 % proportions, half-hole items). No
   product tells students whether an item is harder than the test; forum threads are full of the question.
3. **Feedback that names the error.** 1.1 already names foil types ("a feature differs", "wrong size", "mirror
   image"). Add the cheap rule the wrong choice fits ("you counted visible cubes only"), as the cube and hole
   punch reviews already compute.
4. **Analytics by item feature.** Booster analyses three parts by subtype. Parallax can report accuracy and time
   per dim level for all six (missing view, hidden lines, painted sides asked, fold type, angle size class),
   from data it already logs.
5. **Adaptive practice and an honest Section.** IRT targeting, Path stages, spaced review, and a Section that
   rehearses the real constraints without predicting a score.
6. **Show-me from the grading model:** the solid turning to the view, the paper unfolding, the tally filling, the
   net folding.
7. **Free, offline, open, phone-ready, no account.** The market runs from about $10 to $999 (APP-SB; R3).

Limit: Parallax must not borrow the market's claims. No "realistic difficulty", no score prediction, no
guarantee (CLAUDE.md rules 2 and 10).

## 6. Recommendations for the rebuild (question 5)

All [Prop], ordered by value to players: first what makes every format look and answer like the test, then the
largest content gaps. Sizes as in the plan (S under an hour, M a few hours, L a day or more). D2
(docs/research/v1.2/D2-first-band.md) owns the easier first band; this note owns the test range above it.

### 6.0 Shared rules for the rebuild

- **A stated test range.** Each exercise's levels are tagged *below the test* (D2's first band and scaffolds),
  *test range* (inside §2's documented format) or *beyond the test*. The Library and Free play show the tag;
  Free play gets a "test range only" choice. This answers the players' report that the start felt far too hard:
  they can see that 2° gaps or 15 % proportions go beyond the documented format, and can stay inside it.
- **Format methods versus shortcuts.** Where a cheap strategy is how the format itself is solved, follow the
  Hole Punch precedent (DECISIONS: crease symmetry is the format's method): report it, teach it, do not bound it.
  Candidates: line-type pairing in views (SDN-BD26), shape matching in plain-shape Form items (Kaplan-P
  landmark 1), proportion and corner checks in Openings (DECISIONS, RV-D). Everything else stays under rule 5.
- **No borrowed drawings.** Draw the test look from Parallax's own models in a generic style (§2.7). Never trace
  or imitate a figure from the ADA or a prep product; never replicate the test centre's screen.
- **Calibration and logs.** The look change alone will move difficulty (shaded cubes against line-drawn cubes).
  Ratings live in `rec.ex[id]` and ignore the exercise version (js/engine/estimator.js `exEntry`), so a rebuilt
  scale inherits 1.1 ratings. Bump `version` wherever items or their look change, and widen the rating's
  uncertainty when the version a player last used differs, so targeting re-converges quickly.

### 6.1 Letters and the test look, in all six (S–M; first)

- **What.** A letter mode in the shared choice grid: options shown as A–E or A–D, with keys A–E and 1–5 both
  working; captions and feedback say "option B". A plain look: black lines on a white figure plate in both
  themes, no face tones, dotted hidden lines, filled circles for holes, one tone plus hatch for marked faces.
- **Why.** The test letters its options in every part (§2.0); players asked for the real format; the look is the
  most visible difference.
- **Scaffolds kept.** Face tones (Painted Cubes, Form), the flap shading and arrow (Hole Punch) and 3D pictures
  (views) stay in show-me and in D2's first band, then fade out.
- **Risks.** `choiceGrid` is shared: a per-view option (e.g. `optionKeys: 'letters'`) keeps the other exercises
  unchanged. Difficulty moves with the look (version bump, §6.0). Rule 8 holds: lines, dots, hatch and
  letters are not colour.

### 6.2 Angles: the test's labelling (S)

- **What.** Number the angles 1–4 and letter the four orderings A–D, as on the test (§2.3). Draw the four angles
  in a row where the screen allows.
- **Why.** 1.1 has the labelling reversed (§3.3). Letters on the options also solve RV-play's confusion, which was
  digits on both angles and answers.
- **Keep.** Gaps, size classes, resolve, pose, the arm rules and the cue balancing. D2's 10–15° first band
  sits below.
- **Risks.** Captions and show-me texts change ("answer B puts angle 3 before angle 2"); keys A–D and 1–4. No
  item change, so no version bump, unless D2 prepends a gap level (a breaking level change).

### 6.3 Painted Cubes: one figure, several questions (M)

- **What.** The standard item becomes a figure set: one figure, 2–4 questions in a row ("how many cubes have
  exactly N painted sides?"), each answered A–E = 1–5 cubes, the figure unchanged between questions. Each
  question stays one trial row with `ask` (the Section mechanism already regenerates the same figure from the seed
  and `params.ask`). Ask about five painted sides where its count is 1–5. Offer the tally pad (O12) wherever a
  figure has more than one question; show-me fills the tally once and answers each question from it.
- **Why.** The test asks 2–5 questions per figure, about 3 (§2.5), and its taught method is one tally per figure
  (Kaplan-C). One question per figure (§3.5) is the largest format mismatch that is cheap to fix, and it may be
  part of why players found the exercise slow.
- **Risks.**
  - *Engine:* Train, Path and Speed choose params per trial; a set needs the planner to hold one figure for 2–4
    trials (M). Later questions are faster once the tally exists: log the question's position, and consider a
    position term in the difficulty or rating only the first question.
  - *Shortcuts:* a question about five painted sides has the answer "1 cube" 82 % of the time in today's figures
    (RV-A §5), because such a cube needs a column taller than all its neighbours. The KEEP caps (no answer above
    26 % of later questions) would then almost never admit it. Either build figures that hold several such
    columns (a generator change), or record the skew as a property of the format in DECISIONS. New
    cross-question rules to bound or accept: "never the same answer twice in a set", "the counts never exceed
    the cube total".
  - *Validator:* unchanged (it already checks `asks`). Rule 7: each question's clock starts at its own painted
    frame; the first includes the study time, which the position log separates.
  - *Version:* bump to 2 (the question list and what `asked` means change).

### 6.4 Form: the test's three kinds of item (L)

- **What.** Levels by kind, easiest first:
  1. plain shapes: no marks; the four options are different solids or wrong proportions;
  2. full shading: one or two fully shaded faces, the same solid in every option, marks moved to congruent faces;
  3. partial shading: today's half-shaded (chiral) face and the mirror foil.

  Add L-, T- and U-prisms and other non-convex prisms (O51), the net-distance dim and the net-adjacency foil
  (R3 §8.6). No cubes, or cubes with full-face shading only (PR-1, R3 §5.3); the guide says why the test's die
  items are left out.
- **Why.** The test has plain, shaded and cube items, and many-sided shapes are said to be the most common
  (§2.6). 1.1 puts a chiral half mark and a mirror foil into every level (§3.6 flags), harder than the test's plain
  items, and fresh players took 1.5–2.5 minutes per Try item (RV-play).
- **Risks.**
  - *New solver work:* non-convex solids break the convexity that `seenFaces` and the "wholly seen face"
    evidence rule rely on (gen.js header). It needs a real visibility test (per-face visible area) in the
    generator and an independent one in the validator. Nets of non-convex prisms need the overlap test on more
    faces.
  - *Shortcuts:* in plain items, face-shape matching is the format's own method (Kaplan-P landmark 1); record it
    as such (§6.0) and bound only "most like the others" and similar. RV-B §1 stays fixed for the shaded kinds.
  - *Version:* bump (the `marks` levels change meaning).

### 6.5 Missing View: profile solids (phase B, L)

- **What.** Objects built like Openings' solids (extrusions on a half-unit lattice): steps, notches, through-holes
  (dotted in the views that cannot see them), then arcs, then slopes as the top level. Plain line drawings,
  dotted hidden edges, no fill. Cube stacks stay as the first band (or a variant), not the test range.
- **Why.** The test's objects are general solids with holes and curved features (§2.2); cube stacks are the
  biggest content gap in the six (§3.2).
- **Risks.**
  - *New solver, the hardest of the rebuild:* two views do not fix an object, so each foil must be shown
    impossible for every object of the class (R3 §8.2: shared extents, silhouette hull, line alignment, and an
    exhaustive search over the generator's class for solid-against-dotted foils). The search must be independent
    of the generator (RV-B §8). Keeping the class on a half-unit lattice makes the exhaustive search finite;
    reject items over budget.
  - *Hidden lines:* exact visibility of every edge segment, including partly hidden edges (split into solid and
    dotted runs).
  - *Shortcuts:* line-type pairing is reported by a test taker as the real format's own structure (SDN-BD26);
    decide (§6.0) whether to keep it as a method or balance it.
  - *Version:* bump, or append a variant `solids`, which keeps the cube-stack codes.

### 6.6 Openings: a test-range start, then rounder solids (M, then L)

- **What, M.**
  - A line-drawn stem (SVG) drawn as large as the box allows, at one scale with the openings (RV-B §5, RV-play).
  - A new orientation dim: openings in the fitting view's own orientation, then turned in 90° steps, then turned
    or flipped (BO-x).
  - A test range starting at two features (one on the key's face, one elsewhere, as RV-B §3 suggests), with
    D2's simpler band below.
- **What, L.** Rounded notches and corners (O50), and the "face, not outline" and "too large" foils at the top.
  Keep proportion foils at 25 % or more in the test range; put a 15 % level beyond it.
- **Why.** Keyholes draw the most realism complaints in prep (§5.2). 1.1's easiest item already has three
  features and a turned or flipped opening (§3.1 flags), harder than the simple objects reported on the test.
- **Risks.**
  - *Shortcuts:* fewer features bring back the most-featured-face cue (RV-B §3); allocate features without
    regard to the key and re-run the corner and box solvers (RV-B §2) at the new levels.
  - *New solver work for arcs:* the exact quarter-cell model cannot hold arcs; silhouettes with arcs need a
    different exact representation or a validated tolerance, and the corner-count shortcut changes meaning.
  - *Version:* bump (new dim).

### 6.7 Section practice under test conditions (M)

- **What.** Free movement across all six parts in one clock, a review list of marked and unanswered items,
  strike-out on options, and part instructions shown before the clock starts rather than inside it (as a "test
  conditions" choice, keeping the current guided form for beginners).
- **Why.** That is how test takers describe the real screen (§2.0); one 2026 test taker did the parts out of
  order.
- **Risks.** `section.js` lets `go()` reach only the current part, and the open O9–O11 bugs touch the same code.
  Strike-out is UI only. No rating effect (Section never rates).

### 6.8 Hole Punch: the look now, half folds later (S, then M)

- **What.** The test look (§6.1): no flap shading or arrow in the test range. Later, half folds (creases through
  a row of positions) as an appended `type` level, beyond the common test range.
- **Why.** Hole Punch already matches the format (§3.4); half folds are documented in prep but rare on the real
  test (§2.4).
- **Risks.** Half folds change Fold's crease model (creases on half-cell lines; positions on a crease; the
  "never on a crease" punch rule then removes the half-hole items, which is acceptable). Fold's re-simulation
  and the crease-symmetry note need re-checking. An appended level keeps old codes.

### 6.9 Open risks and checks

1. **Format evidence is thin in places** (§2.8): paper folding's option count, fold counts, slopes in views,
   curved keyholes. Before building, someone should read the ADA's PAT instruction sheet again to settle what it
   states (Could not open).
2. **Honesty (rule 2).** "Exactly the real format" must never read as "the real test's difficulty" or a score
   forecast. The test-range tag describes format features only.
3. **Spatial Check.** No oriented marks on cubes (PR-1). Angles' relation to Level (PR-5) is unchanged.
4. **Load.** Missing View phase B and Form's non-convex solids are each L with new validators; Painted Cubes'
   sets touch the planner. Together they are the largest part of milestone 8.
5. **Calibration.** Every new level is hand-set; refit from pooled exports, as for the 1.1 exercises.

## 7. Sources

All accessed 2026-11-18 unless marked R3 (accessed 2026-11-13 for R3). Read level in brackets (§0). Forum and
review content is paraphrased; posters are not named.

**Official (ADA)**
- R3's official sources, not re-opened here: the ADA *Perceptual Ability Test Section* instruction sheet
  (© 2025), the *DAT 2026 Candidate Guide*, the *DAT User's Manual* (2025 edition) [R3: F via digest, figures not
  seen]. URLs in R3 §11; the instruction sheet's current link is
  https://www.ada.org/-/media/project/ada-organization/ada/ada-org/files/education/perceptual_ability_test_section_instructions.pdf
- ADA, DAT guide page. https://ada.org/en/education-careers/dental-admission-test/dat-guide [F] (links to the
  instruction sheet and the Prometric tutorial; 90 PAT items; no sample PAT items on the page; © 2026 footer)

**Prep pages**
- BC-guide: Bootcamp, "How to ace the PAT section on your DAT", updated 2026-10-27.
  https://bootcamp.com/blog/the-ultimate-guide-to-acing-the-pat-section-on-your-dat [F]
- BC-study: Bootcamp, "How to study for the DAT (2026)", updated 2026-11-01. https://bootcamp.com/blog/how-to-study-for-the-dat [F]
- BC-success: Bootcamp success story on a perfect PAT score, updated 2026-04-09.
  https://bootcamp.com/success-stories/thomas-guide-to-achieving-a-perfect-pat-score [F]
- BO-guide: Booster, "Mastering the DAT perceptual ability test (PAT)", updated 2026-09-15.
  https://boosterprep.com/dat/study-guide/mastering-the-dat-perceptual-ability-test-(pat) [F]
- BO-pat: Booster, PATBooster product page. https://boosterprep.com/pat [F]
- BO-use: Booster help, "Guide to using PATBooster". https://intercom.help/boosterprep/en/articles/2777301-guide-to-using-patbooster [F]
- BO-x: Booster help, expanded solutions for the six parts (worked solutions; read for conventions only) [F]:
  keyholes https://intercom.help/boosterprep/en/articles/4220581-keyholes-expanded-solutions ;
  top-front-end https://intercom.help/boosterprep/en/articles/4223685-top-front-end-expanded-solutions ;
  angle ranking https://intercom.help/boosterprep/en/articles/9307791-angle-ranking-expanded-solutions ;
  hole punching https://intercom.help/boosterprep/en/articles/9347311-hole-punching-expanded-solutions ;
  cube counting https://intercom.help/boosterprep/en/articles/9279241-cube-counting-expanded-solutions ;
  pattern folding https://intercom.help/boosterprep/en/articles/4375844-pattern-folding-expanded-solutions
- BO-day: Booster, "What to expect on the day of the DAT", updated 2026-10-22.
  https://boosterprep.com/dat/study-guide/what-to-expect-on-the-day-of-the-dat [F]
- Kaplan-W: "What's tested on the DAT: Perceptual Ability (PAT)". https://www.kaptest.com/study/dat/whats-tested-dat-perceptual-ability-pat [F]
- Kaplan-K: "DAT PAT keyhole strategy: projections" (2016, updated 2020). https://www.kaptest.com/study/dat/dat-pat-keyhole-strategy-projections/ [F]
- Kaplan-H: "DAT PAT hole punching strategy: symmetry". https://www.kaptest.com/study/dat/dat-pat-hole-punching-strategy-symmetry/ [F]
- Kaplan-C: "DAT PAT cube counting strategy: tallying" (2016). https://www.kaptest.com/study/dat/dat-pat-cube-counting-strategy-tallying/ [F]
- Kaplan-P: "DAT PAT pattern folding strategy: key landmarks" (2016, updated 2020). https://www.kaptest.com/study/dat/dat-pat-pattern-folding-strategy-key-landmarks/ [F]
- MS: masterstudent.ca, "DAT perceptual ability test full breakdown" (2022, modified 2025-12). https://masterstudent.ca/?p=2673 [F]
- DP: dat-prep.com, DAT PAT strategies and practice. https://dat-prep.com/dat-pat-perceptual-ability [F] (it names the wrong owner of the DAT)
- UTP: Union Test Prep, PAT study guide page 3. https://uniontestprep.com/dat/study-guide/perceptual-ability/pages/3 [F]
- SH-PF, SH-CC, SH-SR: Shemmassian Consulting, paper folding, cube counting, spatial relations for the DAT (years
  not shown). https://shemmassianconsulting.com/blog/paper-folding-dat ;
  https://shemmassianconsulting.com/blog/cube-counting-dat ; https://shemmassianconsulting.com/blog/spatial-relations-dat [F]
- TN: Test Ninjas, DAT perceptual ability test, updated 2026-09-11. https://test-ninjas.com/dat-perceptual-ability-test [F]
- TPP: TestPrepPal, free PAT practice. https://testpreppal.com/dat/tools/free-perceptual-ability-test-practice [F]
- VT: Varsity Tutors lesson, visualize 3D objects from various angles. https://www.varsitytutors.com/practice/subjects/dat-perceptual-ability/lessons/visualize-3d-objects-from-various-angles [F]
- WP: Wikipedia, Dental Admission Test. https://en.wikipedia.org/wiki/Dental_Admission_Test [F]
- APP-SB: App Store, "PAT - DAT Score Booster" (description and visible reviews). https://apps.apple.com/us/app/id1497045418 [F]
- Also read, not cited for format facts: rmc.edu DAT info sheet https://www.rmc.edu/wp-content/uploads/2023/07/DAT-info-sheet.pdf [F]

**Forum threads (Student Doctor Network)** [F, digests of the thread pages]
- SDN-BC16: "DAT PAT sections vs Bootcamp" (2016). https://forums.studentdoctor.net/threads/dat-pat-sections-vs-bootcamp.1212127
- SDN-GEN16: "How similar is DAT Genius/BC PAT to actual DAT?" (2016). https://forums.studentdoctor.net/threads/how-similar-is-dat-genius-bc-pat-to-actual-dat.1214458
- SDN-FR15: "Getting frustrated with PAT" (2015). https://forums.studentdoctor.net/threads/hey-all-im-getting-frustrated-with-pat.1148249
- SDN-AR15: "Angle ranking on real DAT" (2015). https://forums.studentdoctor.net/threads/angle-ranking-on-real-dat.1146681/
- SDN-AR19: "Angle ranking in PAT Booster vs DAT Bootcamp" (2019). https://forums.studentdoctor.net/threads/angle-ranking-in-pat-booster-vs-dat-bootcamp.1382034
- SDN-HP17: "Hole punching on real DAT" (2017). https://forums.studentdoctor.net/threads/hole-punching-on-real-dat.1255159
- SDN-KP17: "DAT keyhole proportions (Bootcamp v. 2007/2009 v. real DAT)" (2017). https://forums.studentdoctor.net/threads/dat-keyhole-proportions-bootcamp-v-2007-2009-v-real-dat.1247864
- SDN-CC17: "Cube counting format" (2017). https://forums.studentdoctor.net/threads/cube-counting-format.1239395
- SDN-CC12: "How many cubes on real DAT" (2012; question only, no replies on the page). https://forums.studentdoctor.net/threads/how-many-cubes-on-real-dat.918371/
- SDN-TFE13: "TFE has changed on the DAT" (2013). https://forums.studentdoctor.net/threads/tfe-has-changed-on-the-dat.1028057/
- SDN-TFE17: "Is TFE the hardest section on PAT?" (2017). https://forums.studentdoctor.net/threads/is-it-just-me-or-is-tfe-the-hardest-section-on-pat.1268624
- SDN-GEN17: "BC PAT generators vs BC PAT FLs vs real DAT" (2017). https://forums.studentdoctor.net/threads/bc-pat-generators-vs-bc-pat-fls-vs-real-dat.1274610
- SDN-PB19: "PAT Booster vs real DAT" (2019). https://forums.studentdoctor.net/threads/pat-booster-vs-real-dat.1385686
- SDN-PBvBC: "Using PATBooster instead of DAT Bootcamp" (undated; after 2019). https://th-forums.studentdoctor.net/threads/using-patbooster-instead-of-datbootcamp.1389751
- SDN-BC25: "Is DAT Bootcamp too easy?" (2025; written by a competing vendor, so not neutral). https://forums.studentdoctor.net/threads/is-dat-bootcamp-too-easy-what-students-are-saying-vs-what-the-scores-show.1511088
- SDN-BD26: "DAT breakdown" (2026-11-07). https://forums.studentdoctor.net/threads/dat-breakdown.1522462/

**Law and records** (§4; not legal advice)
- 17 U.S.C. §102 (LII). https://www.law.cornell.edu/uscode/text/17/102 [F]
- USCO Circular 33, *Works not protected by copyright*, revised 03/2021. https://www.copyright.gov/circs/circ33.pdf [F]
- 37 C.F.R. §202.13, secure tests (LII). https://www.law.cornell.edu/cfr/text/37/202.13 [F]
- 35 U.S.C. §154 (LII). https://www.law.cornell.edu/uscode/text/35/154 [F]
- WP-IE: Wikipedia, idea–expression distinction (*Baker v. Selden*, merger, scènes à faire). https://en.wikipedia.org/wiki/Idea%E2%80%93expression_distinction [F]
- WP-NU: Wikipedia, nominative use (*New Kids on the Block*, *Playboy v. Welles*, *Volkswagenwerk v. Church*). https://en.wikipedia.org/wiki/Nominative_use [F]
- LEG-UK: Trade Marks Act 1994, s.11. https://www.legislation.gov.uk/ukpga/1994/26/section/11 [F]
- WP-SV: Wikipedia, spatial visualization ability (ETS kit tests). https://en.wikipedia.org/wiki/Spatial_visualization_ability [F]
- GP-989: US 6,877,989 B2. https://patents.google.com/patent/US6877989 [F]
- GP-917: US 2021/0248917 A1. https://patents.google.com/patent/US20210248917A1 [F-part: 100 000 of 168 764 characters]
- GP-143: US 2012/0005143 A1. https://patents.google.com/patent/US20120005143A1 [F]
- MK-6270411: trademark record "DAT", serial 90008811, registration 6270411 (markinton.com). https://markinton.com/trademark/dat-90008811 [F]
- ADA owner page, partial list of the ADA's marks (Justia). https://trademark.justia.com/owners/american-dental-association-330160 [F] (no DAT mark listed)

**Repository** (read in ranges): docs/research/v1.1/R3-dat-pat.md, R4-test-overlap.md (§6), docs/dev/PLAN-v1.2.md,
docs/dev/DECISIONS.md, docs/dev/reviews/RV-dat-style-A.md, RV-dat-style-B.md, RV-play-dat.md, the six
exercises' gen.js, learn.js and view.js headers, js/core/ui.js, js/engine/section.js, js/engine/estimator.js,
js/ui/overlap.js.

## Could not open

| Source | What I needed | Assumption used meanwhile |
|---|---|---|
| ADA PAT instruction sheet, https://www.ada.org/-/media/project/ada-organization/ada/ada-org/files/education/perceptual_ability_test_section_instructions.pdf (the fetch's permission request went unanswered) | option counts per part, especially paper folding; the fold-count wording; whether five painted sides is asked; the example figures' style | R3's digest reading (§2); paper folding has five options (DP); the look is unknown |
| ADA DAT 2026 Candidate Guide (ada.org; not tried after the denial above) | rules on test-content confidentiality and recalled items; tutorial and navigation; part instructions and the clock | R3's reading; [unverified, prior knowledge] candidates agree to keep content confidential |
| Prometric DAT tutorial, https://www.prometric.com/exams/ada/ (permission request unanswered) | the on-screen look; marking, review and strike-out | forum reports (SDN-BC16, SDN-BD26) and BO-day |
| App Store, Crack DAT PAT (id1467139544) (permission request unanswered) | current features and reviews | R3's reading of 2026-11-13 |
| SDN attachment "2022 DAT guide" (https://forums.studentdoctor.net/attachments/2022-dat-guide-pdf.352352/) | an official guide's confidentiality and PAT text | returned binary data; none |
| EUR-Lex, Regulation (EU) 2017/1001, Art. 14 (https://eur-lex.europa.eu/eli/reg/2017/1001/oj/eng) | the EU referential-use exception | landing page only; parallel to the UK provision, [unverified] |
| Kaplan, "Understanding top-front-end dotted lines" (https://wpapp.kaptest.com/study/dat/understanding-top-front-end-dotted-lines/) | conventions for dotted lines | redirected to an index page; BO-x and DP used instead |
| Justia record "DAT PERFECTER" (https://trademarks.justia.com/889/06/dat-88906775.html) | whether third-party DAT marks were opposed by the ADA | site error; none |
| Court opinions: *ETS v. Katzman* (3d Cir. 1986), *NCBE v. Multistate Legal Studies* (7th Cir. 1982), *AAMC v. Mikaelian* (E.D. Pa. 1983), *ISC2 v. Security University* (2d Cir. 2016, nominative use by a test-prep provider) | holdings on reconstructed test items and on prep providers naming a test | prior knowledge, marked [unverified] in §4; not relied on for any recommendation |
| Not searched (the shared web-search budget ran out mid-pass): Google Patents by classification and claim language; the USPTO record of the ADA's DAT mark; any litigation by the ADA against prep providers; Reddit r/predental threads (only third-party mirrors appeared, and they were not used); newer forum reports on real-test figure sizes and slopes in views; DAT Destroyer's PAT content | patent freedom to operate; mark status; enforcement history; recent student views | no patent or dispute found in what was searched; R3's trademark reading; SDN threads stand in for Reddit |

Rows 1 and 2 were read in full on 2026-11-18: see the addendum below. Row 3 (the Prometric tutorial) stays open.

## Addendum 2026-11-18: the official instruction sheet (full text read)

Added 2026-11-18 (UTC) by a research reader, from two documents the owner supplied. They stay outside the
repository, and nothing from them is copied here: no instruction text, item, figure or page image. Formats are
described in my own words. This also does §6.9 #1.

**Sources and read levels**
- [Sheet] ADA, *Perceptual Ability Test Section* instruction sheet (© 2025, 18 pages; the document behind the ada.org
  link in §7). [F]: the text of every page, and every page image looked at, figures zoomed. Per part it holds the
  rules in words, one or two worked examples with a short explanation, and one sample question with its key. It
  says nothing about item counts, time, navigation or scores.
- [Guide] ADA, *Dental Admission Test (DAT) 2026 Candidate Guide* (34 pages). [F]: the whole text; its few figures
  belong to other sections. See §A.4.
- [Meas] marks my rough measurements of the sheet's sample drawings, made with scratch scripts outside the
  repository. They describe one sample, not the test.

### A.1 Assumptions checked against the sheet

| # | D1 assumption (where) | What the sheet shows (my words) | What changes |
|---|---|---|---|
| 1 | Options: apertures 5, views 4, angles 4, paper folding 5 "best-supported", cube counting 5 (1–5 cubes), pattern folding 4; all lettered (§2.0, §2.4, §2.8 #1) | The same counts in every part, with a letter under or beside each option. Paper folding shows five answer sheets, A–E, in both figures laid out as on the test. Cube counting lists A–E as one to five cubes and says zero is never right. | None: lettered options as planned. §2.8 #1 closed: five options in paper folding is official. |
| 2 | Angles numbered 1–4, options A–D listing orderings (§2.3, §3.3) | Each angle sits in its own tall framed cell with its number under it, the four in a row. The four options are orderings written as numbers, smallest first, lettered A–D. | Confirms milestone 8's labelling. Wave 1: new Angles texts written label-neutral (request to W1-band-A). |
| 3 | More than one fold per paper-folding item (via R3); prep says 1–3 (§2.4, §2.8 #2) | The part overview allows one or more folds, but the part's own instructions say every item has several. Its single-fold figure is a teaching example; the figure it presents as a test item has two folds, the sample question three. Creases in the samples: the middle line, and a quarter line (a one-row strip folded, then folded again). No diagonal fold in the samples. | §2.8 #2 closed: test items have two or more folds. D2's one-fold band stays labelled "starter"; it matches the sheet's own first teaching figure. Diagonal and corner folds stay prep-documented. |
| 4 | Paper-folding panels: broken old outline, solid folded paper; 16 positions, filled = hole (§2.4, §3.4) | One panel per fold, showing the paper after it, then a punch panel; the sample question labels them by fold number and punch. The original square stays a broken outline in every panel; the folded paper and the edges of folded-over strips are solid. No shading, no arrows, no positions marked on the folded paper; the punch is a small open circle. Each answer shows the square with all 16 positions, filled where there is a hole. | Test look as planned (no flap shading, no arrow), plus no position dots on the folded paper and panels labelled "Fold 1 … Punch". The band's faint dots (D2 §3.6) stay a starter scaffold. |
| 5 | (not in D1's "Real" column) 1.1 gives all five sheets the key's hole count (§3.4) | In both figures laid out as on the test, the answers differ in hole count. In the three-fold sample every answer has a different count, so counting the layers alone finds the key. Both worked explanations derive the number of holes from the number of layers punched. | **New for milestone 8.** 1.1's rule is stricter than the official samples and switches off a method the sheet itself teaches. [Prop] In the test range, allow fold-error foils whose count differs (a fold not undone, a layer missed or added); keep at least one foil at the key's count, so a full unfold still decides most items; record "count the layers under the punch" as a format method in DECISIONS, as crease symmetry was; keep the naive count rules (two to the power of the folds, most holes, most like the others) within chance + 10. "Every sheet at the key's count" stays as a harder level, tagged beyond the official samples. Wave 1: none (Hole Punch's rules card already teaches one hole per layer). |
| 6 | Five painted sides can be asked [Inf] (§2.5, §3.5, flag 7) | The list of questions runs from one to all five painted sides, and the worked example has a top cube with five painted sides. | Confirmed: milestone 8 keeps five painted sides, with its answer skew handled, as planned. |
| 7 | Questions per figure: 2–5, about 3 (prep; §2.5, §6.3) | No number. The text speaks of examining each figure for the questions that follow; the sample shows one figure with one question. | None: the 2–4 figure sets rest on prep sources (Kaplan-C, BC-guide), not on the sheet. |
| 8 | Cube figures: black-and-white line drawings; projection and size unknown (§2.5, §2.7, §3.5, flag 14) | Plain line drawings: white faces, black edges, no tones, no hidden lines. The worked example is drawn in an oblique view (front faces as true squares, depth edges at 45°), the sample question in an axonometric view from a low front corner. [Meas] The sample figure has roughly 15–20 cubes, with columns up to four high. Hidden cubes appear only as supports, and the first worked example already has one, in a figure of four cubes. | Test look: white faces, black edges, as planned. No single projection is "the" test look, so Parallax keeps its own axonometric view. Flag 14 answered: 1.1's largest figures (18–22 cubes, four high) are about the sample's size, so they are test range. Wave 1: Painted Cubes' first hidden-cube Try item on a 4–5-cube figure (request to W1-band-A). |
| 9 | Pattern-folding fold lines: dotted (BO-guide) or solid (SH-SR) (§2.6, §2.8 #5; §3.6 "keep dashed") | Every line of both nets is a plain solid line: folds are drawn like cut edges. | §2.8 #5 closed. Milestone 8: the test look draws every edge plain; dashed fold lines remain a starter scaffold only, and a tip says so when they go. Wave 1: none (dashes stay at the band). |
| 10 | Three pattern-folding item kinds: plain, shaded, cubes (prep; §2.6, §6.4) | The worked example is a cube net with four faces shaded in one flat grey; its four options are cubes in one pose. The sample question is unshaded: a five-sided prism (a box with one long top edge bevelled away), its net laid out irregularly (one face hangs at a tilt), and four options of the same kind of solid in different proportions. The pattern is the outside of the solid. No half-shaded face anywhere. | Milestone 8, Form: the plain kind gets bevelled boxes and same-type proportion foils (convex, so no new visibility solver); the full-shading kind includes cube nets with whole faces shaded (PR-1 allows it; §6.4's "no cubes" alternative is dropped); partial shading is prep-documented only, so it stays last. Shading: one flat tone; Parallax's hatch stays as its own addition (rule 8). |
| 11 | Views: fixed quadrants, any view missing, no 3D picture (§2.2, §3.2) | Two crossing lines make the quadrants: top upper left, front lower left, end lower right, each labelled. Any view can be asked (the sample asks for the top). Items show no 3D picture; 3D sketches appear only where the conventions are explained. | Confirmed; VT's 3D picture is wrong. Missing View's structure beside the views stays a starter scaffold (D2 §3.7), in line with the sheet's own teaching sketches. |
| 12 | Hidden edges: "dots rather than dashes" in the rebuild (§3.2) | The text calls hidden lines dotted; the drawings use short, fine dashes. | Withdrawn: keep 1.1's short dashes, and keep calling them dotted. |
| 13 | Views' objects: steps, notches, holes, curved features (prep); slopes unsettled (§2.2, §2.8 #3) | The view figures show a block with a round boss on it, a slab with a square hole through it (dotted in the side views), and a block with a tapered top and round holes (slanted edges and dotted circles in the views). | §2.8 #3 closed: slopes and round features are in the official samples, so in Missing View phase B (O49) holes, round features and slopes are all test range, not beyond. The build order can stay. |
| 14 | Views' foils: one line, or solid against dotted; pairs by line type (SDN-BD26) (§2.2, §3.2) | In the worked example the wrong answers lack the boss, show a recess instead, or add hidden lines that would mean a hole. In the sample question all four answers share the outline and differ only in which lines are solid or dotted. Each answer is drawn beside a small cross that shows the quadrant it fills. | Line-type foils now rest on an official sample, not on a forum report. Optional test-look detail: the small quadrant cross in each option cell. |
| 15 | Apertures: turned or flipped openings are a prep convention (§2.1, §3.1) | The rules let the solid be turned any way before it goes in, and go in by a side the picture does not show. So the fitting opening can appear turned in the plane, and mirrored. | The turn dim's top level (turned or flipped) is test range by the official rules; 1.1's turned or flipped openings are inside the format. |
| 16 | Apertures: look undocumented; 1.1's three features at the floor flagged as harder than the test (§2.1, §2.7, §3.1, flag 2) | The solid is a plain line drawing (white faces, black edges, no hidden lines, no shading) in a tilted pose, in its own lighter panel; the openings are white shapes outlined in black on grey panels. The sample solid has straight edges only: a notch, a large bevel and small cut corners, spread over more than one profile; the fitting outline carries one of them, the large bevel. No curves, no holes. | Flag 2 withdrawn for the feature count: 1.1's three-feature floor is about the sample's complexity, and the planned two-feature start is the easy end of the test range. Arcs stay prep-only (O50's second part stays outside milestone 8). Small bevels are a documented kind of feature. |
| 17 | Apertures: pure-size foils ≥ 25 % in the test range, 15 % beyond (§3.1, §6.6) | [Meas] The answer closest to the key is about 10 % smaller in both directions and also differs by a small cut corner; no answer differs by size alone. The rules say size differences are always large enough to see. | None: ≥ 25 % pure-size foils in the test range and the 15 % level beyond stay Parallax's choices. The sheet neither supports nor rules out smaller pure-size differences. |
| 18 | Angles: gaps of about 2–10° (forum); arms vary; real lines thin (§2.3, §3.3, flag 4) | [Meas] The sample's four angles are all acute, roughly 25–60°, the closest two about 7° apart. Each has one long and one short arm (about 0.3 of the long one), the same two lengths in all four, pointing in all directions. The explanatory example spans roughly 30–105°, with gaps of 15° or more. Thin lines, no arcs. | One sample: the test's gap range stays unknown, and the forum range is a recollection (§A.4 row 7). Acute angles are documented; D2's band (near-right, aligned, 9°) stays below the test. With equal arms, the tip-to-tip distance grows with the angle in the sample; Parallax keeps that cue uninformative (rule 5), which is stricter than the sample. Say so in the test-range note rather than relax rule 5. |
| 19 | The look across parts is undocumented (§2.7 gap, §6.1) | Black line drawings on white or light grey, each stem and option in a framed panel, grey panels behind the openings and the answer sheets. The only fill is the flat grey of shaded faces in pattern folding. | §2.7 closed: white faces, black edges, short-dash hidden lines, one flat tone for marked faces. Draw it from Parallax's own models; never trace the sheet. |
| 20 | Time, item counts, order, navigation, part instructions (§2.0, §2.8 #8) | Nothing. | See §A.4. |

Still open after the sheet: §2.8 #4 (curved or holed apertures: prep only), #6 in part (whether each cube question's
screen repeats the figure) and #8 in part (whether part instructions sit inside the timed section).

### A.2 What changes in PLAN.md milestone 8 (suggested wording, for the lead)

Fragments of the "DAT-style, the real formats" line, old → new:
1. "lettered options and a plain line-drawing look in all six" → "lettered options and the documented line-drawing
   look in all six (white faces, black edges, hidden edges as short dashes, one flat tone for marked faces)".
2. "then the test's kinds (plain shapes, full shading, partial shading)" → "then the test's kinds (plain shapes, with
   bevelled boxes and proportion foils; full shading, cube nets included; partial shading last, documented by prep
   sources only), with fold lines drawn plain in the test range".
3. "Missing View on profile solids (O49)" → "Missing View on profile solids, with holes, round features and slopes all
   in the test range (O49)".
4. "Openings with a test-range start at two features and a turn dim (O50, first part)" → "Openings with a turn dim
   whose turned-or-flipped level is test range (the official rules), and two features as the easy end of the test
   range (O50, first part)".
5. "Hole Punch's new look" → "Hole Punch's new look (panels labelled by fold; no shading, arrows or position dots) and
   foils whose hole counts differ, as in the official samples, with the layer count recorded as a format method".
6. Section practice: see §A.4.

Unchanged by the sheet: Painted Cubes' 2–4 questions per figure (prep-based) and its five-painted-sides handling
(now official); Angles' numbering and lettering (now official); D2's starter bands.

### A.3 Effects on wave 1's starter bands (D2 §3.2–3.7)

| D2 § | Exercise | Effect | Request |
|---|---|---|---|
| 3.2 | Angles | Band unchanged (below the test). Milestone 8 switches to the official labels, so texts written now should not name the symbols. | to W1-band-A |
| 3.3 | Painted Cubes | Band unchanged. The sheet's first worked example teaches the hidden support on a four-cube figure, while today's Try 3 brings more cubes and the hidden cube at once. | to W1-band-A |
| 3.4 | Openings | None: unturned openings are a starter, and the rules card already says the solid may be turned any way. | none |
| 3.5 | Form | None now; milestone 8 adds a tip when fold lines turn plain. | none |
| 3.6 | Hole Punch | None: the one-fold band matches the sheet's own first teaching figure, and the rules card already teaches one hole per layer. | none |
| 3.7 | Missing View | None: hidden lines stay short dashes; the structure beside the views is a scaffold, as the sheet's teaching sketches are. | none |

### A.4 The DAT 2026 Candidate Guide (full text read)

| # | D1 assumption (where) | What the guide says (my words) | What changes |
|---|---|---|---|
| 1 | 90 items in 60 minutes on one clock, about 40 s an item (§2.0) | The PAT has 90 items in six subtests and 60 minutes. A timer shows on screen and stops while an item is loading. No count per subtest. | Confirmed; 15 per part stays a prep figure. Section practice: the clock should not run while an item is being prepared, as on the test. |
| 2 | Six parts in a fixed order (§2.0) | The six subtests are listed in a table in the usual order (apertures to spatial relations / 3D form development). Nothing on the order of presentation or on moving between subtests. The PAT is the second of the day's four test sections, after the natural sciences and before the optional break. | "Fixed order" is the listed order, not a documented rule. The forum report of a candidate starting with angles stays unconfirmed. |
| 3 | One item per screen; marking, a review list, strike-out and free movement (BO-day, SDN-BC16, SDN-BD26) (§2.0, §3.7) | Items appear one at a time. Nothing on marking, review lists, strike-out or moving between subtests. | These stay test-taker and prep descriptions. Section practice may offer them, labelled as how test takers describe the screen. |
| 4 | An optional 15-minute tutorial (BO-day); noteboards; no measuring tools (§2.0) | An optional 15-minute tutorial at the start of the session shows how to move through the test on the computer. The test vendor's paid sample experience is a generic 15-minute test, not this one. The centre provides two erasable note boards without grid lines and two fine markers. Rulers and other measuring tools, magnifiers and watches are banned, and candidates may not touch the screen. The on-screen aids it names are for other sections (a periodic table, a calculator); none for the PAT. | Confirmed, now official. The tally pad (O12) should be blank like the note boards (prep's 4 × 4 grid is drawn by hand). Parallax's angle overlay in show-me is a teaching device with no counterpart on the test. |
| 5 | Part instructions and the clock unknown (§2.8 #8) | Candidates are strongly encouraged to study the PAT instructions on the ADA's site before test day. Nothing on whether instructions appear inside the timed section. | Supports "part instructions before the clock" in Section practice. [Prop] The "Taking a test soon?" helper can point to the ADA's own instructions page: a link, never a copy. |
| 6 | (texts) Scores, practice material, prep products (§4.4–4.5, §5.3) | Scale scores 200–600 in steps of 10 since 1 March 2025; no passing score; no penalty for guessing; some unscored trial items look like scored ones. The official practice questions are copyrighted and meant to show the question types, not to predict performance. The program endorses no prep course and has no data on their content or effect. | No score forecast (rules 2 and 10, as planned), in line with the official caution. Section practice can say that guessing is not penalised. The ADA line's "not affiliated with or endorsed by" matches the program's own statement. |
| 7 | Confidentiality and recalled items: [unverified] candidates agree to keep content confidential; [Inf] recalled items count as the ADA's protected questions (§4.2; Could not open row 2) | Test questions are confidential, copyrighted material. Getting, using or passing them on by any means, memorising included, is forbidden, and so is discussing or posting remembered questions or their keys, or any piece of them, with anyone, test-prep organisations named. Sharing remembered questions on forums or social media is listed as misconduct. People sent unreleased items are told not to look at them and to report them. | §4.2's inference is now the program's stated position. [Prop] (a) Parallax never builds items from recollections of live items, and its texts and test-range tags never present a candidate's recollection as a fact about the test; forum reports stay direction-only (§2.8 #9), and where only they exist (angle gaps, half-hole frequency) the tag says "not documented officially". (b) The PAT statement adds the ADA's published practice questions to the off-limits list. |
| 8 | Marks: the ADA writes DAT®; descriptive use with the ADA line (§4.3) | The guide writes DAT® with the registered sign and says nothing about use of the name by others. Its arbitration clause keeps the ADA's right to go to court over its intellectual property (in disputes with candidates). | No change to §4.3 (not legal advice). |
| 9 | No PAT content change 2022–2026 (§2.0) | The only changes it records are the score scale (March 2025) and an announced renaming of organic chemistry topics; nothing for the PAT. | Confirmed. |

**PLAN.md text, old → new (for the lead)**
- "The PAT statement" (Decisions): "Off-limits: the ADA's questions (recalled ones and old sample tests included),
  instructions and drawings;" → "Off-limits: the ADA's questions (recalled ones, its published practice questions and
  old sample tests included), instructions and drawings, and candidates' recollections of live items as a source for
  items or for claims about the test;". The rest stands.
- Milestone 8: "Section practice under test conditions (free navigation across parts, strike-out, a review list of
  marked and unanswered items, part instructions before the clock)" → "Section practice under test conditions (one
  60-minute clock on screen that stops while an item is prepared; part instructions before the clock, as the
  official guide asks candidates to study them before test day; free navigation across parts, strike-out and a
  review list of marked and unanswered items, as test takers describe the screen, which the official documents do
  not; a line that guessing is not penalised)".
