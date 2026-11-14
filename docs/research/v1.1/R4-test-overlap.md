# R4: Does Parallax "praff" the "analogical assessment test"? Test overlap, practice effects and a warning

Research notes for the Parallax v1.1 update, brief item 6: check whether Parallax's exercises give practice
("praff") for an analogical assessment test, and warn if so. Written 2026-11-13 by subagent R4. No app file was changed.

## Summary (short answer)

- **Which test?** Not resolved. No test called "analogical assessment test" (or "AAT") was found. The
  most likely readings, in order: (1) an analogies subtest the community takes online, above all the
  **Analogies** subtest of CognitiveMetrics' **CORE** (old-SAT/GRE-style verbal analogies) or of its
  **VISA** (Verbal Intelligence Scale for Adults); (2) a **figural-analogies** or matrices test
  (A : B :: C : ? with shapes); (3) an older analogies test (Miller Analogies Test, a high-range verbal
  analogies test such as ANALOGICA52, or Bill Bultas's "Chimera Analogies Test", whose name matches the
  Discord's). One unexplained lead: CognitiveMetrics lists a new test called **ATAT** whose name I
  could not expand. Confidence in any single identification: low. Ask the owner for the link.
- **Overlap.** No Parallax *exercise* uses an analogy format. The one analogy task in Parallax is the
  Spatial Check's control probe **Word Links (PR-0)**: verbal analogies "A is to B as C is to …?",
  16 items per check, no feedback. Spatial exercises reach figural analogies only through a component:
  Spin and Rotate train rotation and mirror discrimination, which are among the hardest rules in
  figural analogies (Blum & Holling 2018). Several exercises do share formats with **spatial subtests
  of the same batteries** (paper folding, hidden shapes, block counting, cube nets, cross-sections,
  directions), and the planned v1.1 additions (DAT PAT items, landmark-free path integration) add more.
- **Size.** Retaking a test: +0.33 SD at the second sitting and +0.50 SD by the third, then flat;
  alternate forms 0.23 vs identical 0.37 (Scharfen et al. 2018). Coaching nearly triples the gain
  (δ = .70 vs .24; Hausknecht et al. 2007). Being taught the rules of figural matrices: d = .92 to
  ≥ 1.19 (Levacher et al. 2022; Schneider et al. 2020). Gains from practice are not on g
  (te Nijenhuis et al. 2007). Direct evidence that mental-rotation or folding practice raises analogy
  or matrix scores is thin: one study with visuospatial working-memory training (Stephenson &
  Halpern 2013), one within-group follow-up (Meneghetti et al. 2017), and correlational work
  (Corral & Burte 2025).
- **Warning.** Extend the existing block-tapping note into one "If you take a test" message: About's
  Test hygiene, the guide's chapter 8, the README, and a short "Also in tests" note on the exercises
  whose format tests share (Fold, Hidden, Views, Nets; Span already has one); add a one-tap question in
  later Spatial Checks about outside tests and practice (logged, never scored), plus an optional
  "Taking a test soon?" helper in Settings that lists the overlapping exercises, lets the player pause
  them in Train, and logs the test date. No exercise needs hiding. Draft wording in §6.

## 0. Method and reading levels

- Repository read: CLAUDE.md, BRIEF.md, docs/dev/STATE.md, DECISIONS.md, DESIGN-PLAN.md,
  EXERCISE-GUIDE.md, js/ex/registry.js, every js/ex/*/learn.js, the definitions in every
  js/ex/*/gen.js (code, name, abilities, answer type), js/ui/about.js, README.md, the guide source
  docs/guide/guide.html (chapters 5 and 8 and every match of the search terms below), the v1.0
  research notes docs/research/v1.0/A-evidence.md §6–§7 and B-tasks.md.
- Greps: block-tapping, near transfer, mid transfer, familiarity, practice, test, hygiene, published,
  clinical, mention your, analog, matrix, Raven, coaching, praff (js/, docs/, README.md, root notes).
- Web: WebSearch (titles and URLs only), WebFetch (pages and PDFs), curl through the agent proxy.
- Reading levels used in this file, after each source:
  **[FT]** full text read; **[PT]** part of the full text (a window of the PDF or chosen sections);
  **[AB]** abstract or catalogue summary only; **[SR]** secondary report (what another source says
  about it); **[WP]** a non-academic web page read in full; **[ST]** search-result title and URL only,
  page not opened. Pages I could not open are listed in ACCESS at the end.

## 1. Identifying the test

### 1.1 What "praff" means

- r/cognitiveTesting poll "Least praffable tests" (4 Apr 2023, 218 votes) [WP, read through a Reddit
  mirror; reddit.com itself was blocked]: a commenter defines praff as "some colloquial word used here
  to describe the practice effect". Votes for the least praffable kind of test: vocabulary 59, working
  memory (digit span, Corsi) 53, "verbal fluid (e.g. similarities/analogies)" 39, speed 25,
  quantitative (figure weights) 23, matrix reasoning 19. So the community sees matrices as the most
  praffable and analogies as middling. Commenters dispute whether digit-span gains are praff.
- The owner's question therefore asks: would practising Parallax inflate someone's score on that test
  through familiarity with its item types rather than through a change in ability?

### 1.2 The community

- The Discord behind discord.gg/chmr: discord.me lists **"Project Chimera"**, "Free brain training
  tools for focus, memory, self-control, and cognitive performance … the development of better
  training tools" [WP, discord.me/projectchimera]. No test is named there. The other projects in the
  owner's workspace (Holdfast, a Kvaščev trainer, a Eucalculia fork, Warrant) fit a community that
  trains and then measures with online IQ tests. The brief says the community overlaps with
  cognitivemetrics.com and r/cognitiveTesting.

### 1.3 Candidates and evidence

| # | Candidate | What it is | Evidence that it is "the analogical assessment test" | Likelihood |
|---|---|---|---|---|
| A | **CORE, Analogies subtest** (CognitiveMetrics) | CORE = "Comprehensive Online Reasoning Exam", the site's free flagship battery: 17 subtests in six indexes. Verbal Comprehension = Analogies, Antonyms, Information, Comprehension. "Analogies and Antonyms follow the item types of the old SAT and GRE verbal sections", each item timed on its own; Analogies has the lowest alpha of the reasoning and knowledge subtests (0.74) | The community's most-used test site; the only CORE subtest with "analog" in its name. Against: the owner did not say CORE | moderate |
| B | **VISA, Analogies subtest** (CognitiveMetrics) | "VISA - Verbal Intelligence Scale for Adults"; a page "VISA - Analogies" exists (/test/VISA/AG); about 90 min; one of the site's five newest tests | Titles only [ST]; a recent, verbal, analogy-bearing test fits "analogical" | moderate-low |
| C | **ATAT** (CognitiveMetrics) | Named once among "the five newest tests, VISA, RQVT, the Army Alpha, ATAT and the spatial exam"; possibly the "culture fair adaptive test in its norming edition" (the review's inference by position) | Name not expanded anywhere I could read; an "A… Test of Analogical …" reading is pure guesswork | unknown |
| D | **A figural-analogies test** | A : B :: C : ? with shapes; in school batteries (CogAT and CAT4 Figure Matrices: "a matrix in which one figure is missing"; OLSAT figural analogies [ST]) and research tests (Test of Figural Analogies [ST], IMak items) | "Analogical" fits; a visuospatial trainer is where figural analogies would plausibly be praffed | moderate-low |
| E | **1926 SAT, Analogies** (CognitiveMetrics) | The site renormed the nine subtests of the 1926 SAT; an "1926 SAT - Analogies" page exists (/test/1926-SAT/AG) | Title only [ST] | low |
| F | **Miller Analogies Test (MAT)** | Pearson; 120 partial verbal analogies (100 scored) in 60 min, broad cultural knowledge; **discontinued 2023** (last sittings by 15 Nov 2023); old scores still accepted by Intertel, ISPE, TNS and Prometheus | The best-known "analogies test". Against: it can no longer be taken, so nothing can praff it now | low |
| G | **ANALOGICA30 / ANALOGICA52** | A high-range "Verbal Reasoning Questionnaire, consisting of 52 analogies", untimed (10–15 h suggested), references allowed, hand-scored, author not named | Name contains "analogica"; turned up for "analogical assessment" searches | low |
| H | **Chimera Analogies Test** (Bill Bultas) | An old high-range analogies test hosted on Miyaguchi's "Uncommonly Difficult IQ Tests" site, with a ranking scale and answer page; a list of high-range tests logs a link to "Bill Bultas's Difficult Analogies test" (2001), possibly the same test | Same word as the Discord ("Chimera"); could be conflated | low |
| I | **Hoeflin Mega / Titan / Ultra tests** | Untimed high-range tests. The Ultra Test: verbal analogies (items 1–36), spatial items (rods on cubes and polyhedra, sixth view of a cube solid), number and figure series. The Power Test keeps the spatial items (painted polyhedra, cube stacks, slicing solids, interpenetrating solids) and drops verbal analogies as "fairly culture-saturated" | Named in this task's search list; analogies plus spatial items | low |
| J | **"AAT"** | No analogies test with this abbreviation found. AAT is in use for the Aachen Aphasia Test and the approach-avoidance task, neither relevant | none | very low |

Sources for the table: acisiq.com review of CognitiveMetrics (Sept–Oct 2026; written by a seller of a
competing test, so read as a secondary report) [WP, SR for every CognitiveMetrics test]; search titles
for cognitivemetrics.com pages [ST]; the ANALOGICA52 Google Form [WP]; Wikipedia on the MAT [WP];
megasociety.org Power Test and megasociety.net Ultra Test pages [WP]; tthqi.free.fr list of
"Uncommonly Difficult IQ Tests" [WP]; Chimera Analogies Test pages on miyaguchi.4sigma.org [ST].

### 1.4 What CORE contains besides Analogies (it matters for overlap)

From the acisiq review [SR]; I could not open cognitivemetrics.com:
- Fluid Reasoning: Matrix Reasoning ("grids and series with five options"), Graph Mapping ("match
  nodes across two structurally identical graphs"), Figure Weights, Figure Sets (format not given).
- Visual Spatial: **Visual Puzzles** (30 → 45 s per item), **Spatial Awareness** ("a verbal spatial task
  modeled on the Stanford-Binet 5"), **Block Counting** ("descends from the block counting items of the
  Army General Classification Test").
- Quantitative: Quantitative Knowledge, Arithmetic. Working Memory: Digit Span, Digit Letter
  Sequencing. Processing Speed: Symbol Search (80 items in 2 min, touchscreen), Character Pairing.
- CAIT, its retired predecessor: Vocabulary, General Knowledge, Visual Puzzles, Figure Weights, Block
  Design, Digit Span, Symbol Search, "inspired by and formatted to resemble" the WAIS-IV.
- APT (20 min) covers analogies, antonyms, quantitative reasoning, arithmetic and matrices.
- The review also notes that CORE's sample is self-selected (mean Full Scale 123.5) and unsupervised.
- SB5's verbal visual-spatial activity is "Position and Direction", which includes explaining spatial
  directions [WP, PRO-ED sample report, excerpt]. So CORE's Spatial Awareness is probably
  direction-and-position reasoning in words (an inference from the model it follows).

### 1.5 Verdict

- I cannot resolve the name. Confidence: **low** for any single test. If forced to bet: a verbal
  analogies subtest on CognitiveMetrics (CORE or VISA), because that is where the community tests and
  "analogies" is the subtest name; second, a figural-analogies test.
- The recommendation in §6 is built to hold whichever it is: it covers verbal analogies, figural
  analogies and matrices, and the spatial subtests that sit beside them in the same batteries.
- **Ask the owner** (exact wording in §7): the link or a screenshot of one item; whether the items use
  words or shapes; whether it is a single test or a subtest of CORE, VISA or another battery; and what
  "ATAT" on CognitiveMetrics stands for, if they know.

## 2. Parallax's exercises and probes (what a player practises)

From js/ex/*/gen.js definitions and learn.js texts. "Answer" is the registry's answer type.

| Code | Id | Name | Item format (learn.js goal) | Answer | Ability codes |
|---|---|---|---|---|---|
| EX-01 | track | Track | follow marked spheres in a 3D box, then pick them; labelled attention practice | targets | AT |
| EX-02 | rotate | Mental Rotation | 3D cube figures: same figure turned, or its mirror image? / pick the 2 turned copies of 4 | yes-no / pick 2 of 4 | Vz, SR |
| EX-03 | spin | 2D speeded rotation | flat polyomino-like shapes turned in the picture plane: same or mirror? / pick 2 of 4 | yes-no / pick 2 of 4 | SR |
| EX-04 | fold | Paper folding | folds shown panel by panel, a punch; which unfolded sheet (4–5 options, same hole count)? | choice | Vz |
| EX-05 | nets | Cube nets | which face is opposite the marked one; do two thick edges meet; does it fold into a cube? | choice / yes-no | Vz |
| EX-06 | slice | Cross-sections | a plane cuts a solid (joined, embedded, curved); which outline is the cut face, seen straight on? | choice of 4 | Vz |
| EX-07 | views | Orthographic views | structure → top/front/right line view; three views → structure; **count the cubes** (every cube visible) | choice of 4 | Vz |
| EX-08 | orient | Perspective taking | stand at one object, face another, point to a third on an arrow circle | angle | PT |
| EX-09 | span | Block Span | Corsi-type block tapping, forward/backward, board may turn | sequence | MV, WM |
| EX-10 | hidden | Hidden Shapes | which of 5 shapes is hidden in a line figure, same size and way up (embedded figures) | choice of 5 | CF |
| EX-11 | homing | Homing (experimental) | watch a first-person walk with turns, then face the start (path integration) | angle | NAV |
| PR-0 | wordlinks | **Word Links** (probe, control) | **"A is to B as C is to …?" four word options**; relations such as young of, part of, made of, tool for, opposite, stronger form of | choice of 4 | VB |
| PR-1 | cubematch | Cube Match (probe) | two cubes with symbols: could the second be the first, turned? | yes-no | Vz |
| PR-2 | viewmatch | View Match (probe) | which picture shows the table from the flag? | choice of 4 | PT |
| PR-3 | mechanisms | Mechanisms (probe) | gears, belts, drums: which way, up or down, faster or slower? | choice of 3 | MA |
| PR-4 | patterns | Pattern Memory (probe) | a grid pattern for 3 s, then mark the filled squares | targets | MV |
| PR-5 | level | Level (probe, optional) | water level and plumb line in a tilted glass or frame | choice of 4 | Vz |

How much analogy practice Parallax gives: none in training. Word Links runs only inside the Spatial
Check: 16 adaptive items per check (js/engine/assess.js), one worked example, no feedback; two
baselines, then one check every 14 days and 8 sessions at the earliest. A player who follows the
schedule for three months meets roughly 5–8 checks, so about 80–130 verbal analogy items, all with
everyday words and the simple completion format (my estimate from the schedule, not from logs).

Planned v1.1 additions that bear on test overlap (from STATE.md; R1–R3 own the details):
- **DAT PAT question types as training** (R3). The Dental Admission Test's Perceptual Ability Test is
  itself a real admissions test, so its item types in Parallax are test preparation for it by design,
  and several PAT item types also appear in other batteries (block counting, paper folding, views).
- **Path integration without landmarks** (R1): heading-after-turns reasoning, close to verbal
  "position and direction" items.
- **Knots** (R2): no common IQ-test analogue that I know of.

## 3. Overlap map

### 3.1 Distances used here

- **Near**: the same item format and the same operation. A gain on the test after practice in
  Parallax is mostly practice with that kind of item (the guide's own rule, chapter 8: "A gain on such
  a test after practice here is near transfer, not mid transfer").
- **Mid**: a different format, the same core operation (e.g. pointing on a map vs answering a
  direction question in words).
- **Far**: a different format and a different task, sharing only a component (e.g. one rotation rule
  inside a figural analogy) or the broad ability.
- "Format features" below are the surface features a practised player gets used to: the stem layout,
  the kind of options, the kind of distractor, the rule set, the timing.

### 3.2 Verbal analogies tests (candidates A, B, E, F, G, H, part of I)

Item types: CORE and the 1926 SAT follow old-SAT/GRE style (a stem pair, then choose the pair, or the
word, with the same relation; five options) [SR, acisiq review; the five-option old-SAT layout is
general knowledge, not checked]; MAT: partial analogies "Bach : Composing :: Monet : ?" needing broad
cultural knowledge [WP]; ANALOGICA52: wordplay, codes and number analogies, untimed [WP]; Ultra Test
items 1–36 [WP].

| Test item type | Parallax task | Distance | Shared format features | Notes |
|---|---|---|---|---|
| Verbal analogy, A : B :: C : ? (complete the fourth term) | **Word Links (PR-0)**, probe only | **near** | the A : B :: C : ? stem; four word options; foils linked to C by other relations (the classic "associated but wrong relation" distractor); a time bar | Parallax's items are easier (everyday words, 14 concrete-to-abstract relations, no cultural knowledge) and come only in Spatial Checks, without feedback |
| Verbal analogy, choose the matching pair (old SAT/GRE) | Word Links | near-mid | the relation-first strategy ("say how A and B are linked, then test the options"), which the Word Links instruction and demo teach | the pair-choice layout differs |
| Any verbal analogy | spatial exercises | none | — | no word task in training |

Reading: **only the Spatial Check practises verbal analogies**, and only lightly (§2). The strategy
the Word Links instruction states ("First see how the first two words are linked. Then pick the word
that is linked to the third word in the same way") is the standard way to solve analogies; prep books
teach the same. This is the one place where Parallax could add a little format familiarity to a
verbal analogies test.

The reverse direction matters too: a player who practises verbal analogies elsewhere (for CORE,
VISA, MAT prep, high-range tests) raises their own Word Links scores, which is meant to be the control
for familiarity. A raised control makes spatial change look smaller ("unclear yet" for longer), so
outside analogy practice should be noted in Parallax's log (§6.3 c, §6.4).

### 3.3 Figural analogies and matrices (candidate D; CORE Matrix Reasoning; CogAT/CAT4 Figure Matrices)

Item types: A : B :: C : ? with shapes. Rules in automatically generated figural analogies (IMak):
main-shape rotation (short clockwise, short counter-clockwise, long clockwise), trapezium rotation,
main-shape reflection, line-segment subtraction, dot movement; in Blum & Holling's data the hardest
rule was a short counter-clockwise rotation, then a long clockwise rotation, then reflection; dot
movement was easiest; more rules → slower and less accurate (working-memory load) [PT]. CogAT's
Figure Matrices present "a matrix in which one figure is missing" [WP, Riverside; the matrix size
was not given]; AnimaLogica (children)
varies colour, orientation, size, position, quantity and animal type [PT, Stevenson 2012]. Raven's APM
has a visuospatial item subset (13 items: quantity, spatial location, direction) and a verbal-analytic
subset (12 items) (Chen et al. 2017 after DeShon et al. 1995) [PT; DeShon SR].

| Test item type | Parallax task | Distance | Shared feature | Notes |
|---|---|---|---|---|
| Figural analogy or matrix with a **rotation** or **reflection** rule | **Spin** (2D rotation, same vs mirror), **Rotate** (3D) | far (component) | judging "the same shape turned" vs "the mirror image"; recognising a turn angle | Parallax never asks "apply the A→B change to C"; no rule induction, no 2 × 2 or 3 × 3 matrix, no option set built from rule combinations |
| Rules on position, quantity, addition/subtraction of elements | none | far | — | Pattern Memory (probe) holds grid patterns in memory but asks no rule |
| "Find the figure hidden in the cell" style or overlapping-figure items | **Hidden** (embedded figures) | far | disembedding a shape from lines | rare in analogy tests |
| Figure classification (CogAT, CAT4) | none | far | — | — |

Reading: **no exercise practises the analogy or matrix format**, its rule-finding step, or its
distractor logic. Spin and Rotate practise one operation that some rules use. The evidence that such
practice moves figural-analogy or matrix scores is weak (§4.4).

### 3.4 Spatial subtests in the same batteries (where Parallax does share formats)

If the owner's test is a battery (CORE, CogAT, CAT4, a high-range test) rather than a single analogies
test, these subtests matter more than the analogies.

| Test and subtest | Item type | Parallax task | Distance | Shared format features |
|---|---|---|---|---|
| CogAT Nonverbal **Paper Folding** [WP, Riverside]; CAT4 **Figure Analysis** [WP, test-prep site]; DAT PAT Paper Folding [general knowledge; see R3] | paper folded, punched; pick the unfolded sheet | **Fold (EX-04)** | **near** | fold panels → punch → choose the unfolded sheet; hole-mirroring across creases (Parallax also keeps every option's hole count equal; the tests' option rules were not checked) |
| CAT4 **Figure Recognition** [WP, test-prep site] | find a hidden shape in a figure | **Hidden (EX-10)** | **near** | a target shape and a complex figure that hides it (CAT4's exact layout not checked) |
| CORE **Block Counting** ("descends from the block counting items of the AGCT") [SR]; AFOQT Block Counting (how many blocks touch the numbered one) [WP] | count blocks in a drawn stack | **Views (EX-07), count variant** | near (AGCT style) to mid (AFOQT style) | isometric stacks of unit cubes; counting column by column. Differences: Parallax shows every cube ("No cube is hidden here"), so it does not train inferring hidden supporting blocks; it never asks for touching neighbours |
| CORE **Spatial Awareness** ("a verbal spatial task modeled on the Stanford-Binet 5") [SR]; SB5 "Position and Direction" [WP excerpt] | direction and position questions in words | **Orient (EX-08)**, **Homing (EX-11)**, v1.1 path integration (R1) | mid | updating heading after turns; left/right from another place. Parallax's tasks are pictorial with an arrow-circle answer, not verbal |
| CORE / CAIT **Visual Puzzles**; CAIT **Block Design** | assemble a figure from pieces; copy a pattern with blocks | none (no clones by rule 3) | far | — |
| Hoeflin Power and Ultra spatial items (the Power Test draws on the Mega, Titan and Ultra tests) [WP] | slicing solids; cube stacks; painted polyhedra; sixth view of a cube solid | **Slice (EX-06)**; **Views (EX-07)**; DAT PAT cube counting if added | mid | cross-sections of solids; views of cube structures. The Hoeflin items are open-ended, untimed and far harder |
| Cube folding items in online spatial tests and DAT PAT 3D form development [general knowledge] | which cube does this net make | **Nets (EX-05)** | mid-near | nets of six squares; opposite faces; edges that meet |
| Cube comparison items (two cubes with symbols) | could these be the same cube? | **Cube Match (PR-1)**, probe only | near | untrained in Parallax (probe) |
| WAIS-5 Symbol Span; clinical Corsi block tapping | spatial span | **Span (EX-09)** | near | already warned in About, the guide and Span's bridge text |

### 3.5 Summary of the map

| If the owner's test is … | Near overlap in Parallax | Mid / far | Practical risk of inflating that test |
|---|---|---|---|
| a verbal analogies test or subtest (CORE AG, VISA AG, SAT AG, MAT, high-range analogies) | Word Links probe (only in the Check) | none in training | small: 16 easy, feedback-free items per check (about 80–130 over three months); test-taking familiarity in general |
| a figural analogies or matrices test | none | Spin, Rotate (rotation and mirror rules); Hidden (disembedding) | small and uncertain; no study isolates it |
| a battery with spatial subtests (CORE VS, CogAT, CAT4, Hoeflin tests, DAT PAT) | Fold, Hidden, Views count, Span; Cube Match (probe) | Orient, Homing, Slice, Nets | real for the near subtests: practising the format is what raises retest and coaching gains (§4) |

## 4. Literature

Conversions used below: 1 SD = 15 IQ points, so 0.33 SD ≈ 5 points, 0.5 SD ≈ 7.5, 0.7 SD ≈ 10.5.

### 4.1 Retest effects: taking the same kind of test again

- **Scharfen, Peters & Holling 2018** [PT; Intelligence 67, 44–66; 122 studies, 174 samples, 786
  outcomes, N = 153,185]. Standardised mean change: test 1 → 2 **0.33** [0.28, 0.38]; 1 → 3 **0.50**
  [0.41, 0.59]; 1 → 4 0.52 [0.40, 0.63]; 3 → 4 0.02 (n.s.): "no further score gains after the third
  test administration". By content, 1 → 2: **figural 0.32** [0.25, 0.39], verbal 0.33 [0.25, 0.41],
  numerical 0.18, mixed 0.41; 2 → 3: figural 0.20, verbal 0.11 (n.s.). By operation, 1 → 2: reasoning
  0.33, speed 0.37, memory 0.28. **Identical vs alternate forms**, 1 → 2: 0.37 vs **0.23** (difference
  0.15, p < .001); the difference fades by the fourth test. Gains shrink slowly with the interval
  (−0.0008 SD per week at the first retest). No separate estimate for matrices, spatial tests or
  analogies (Raven's is coded as figural reasoning).
- **Hausknecht, Halpert, Di Paolo & Moriarty Gerrard 2007** [PT; J Applied Psychology 92, 373–385;
  107 samples, N = 134,436]. Adjusted δ = **.26** for test 1 → 2; 1 → 3 .56. Identical forms .46 vs
  alternate .24. **With coaching .70 vs .24 without** (non-overlapping intervals; coaching contact time
  predicted gains). Analytical .32, quantitative .30, verbal .19 (overlapping). For identical forms,
  longer intervals gave smaller gains (equal to alternate forms after about 685 days).
- **Sommer & Arendasy 2025** [PT; J Intelligence 13(8), 102; a review of item generation that
  summarises the retest and preparation meta-analyses]: identical forms 0.37–0.42, alternate forms
  0.22–0.23; alternate forms that differ only in surface features gain almost as much as identical
  ones; gains persist for years; higher-g test-takers gain more; the gains "do not generalize to
  higher-order traits" and are attributed to strategy refinement; a computerised adaptive form at the
  first session reduces the retest effect, but practice between sessions keeps it.
- **Arendasy & Sommer 2017** [AB; Intelligence 62, 89–98; N = 960, four tests, two sittings a month
  apart]: the data fit a model of learning during test-taking; adaptive first-session forms reduce the
  retest effect.
- **Freund & Holling 2011** [AB; Intelligence, 233–243; N = 189; automatically generated figural matrix
  items]: training between sessions improved scores beyond retesting; identical vs parallel forms made
  little difference at the individual level; item difficulties were not invariant over time; people
  differed widely in how much they gained.
- **Hayes, Petrov & Sederberg 2015** [PT; Intelligence; PMC4226176; N = 35]: Raven's APM gain across
  two sessions **d = .56**; changes in eye-movement strategy predicted about a third of the gain
  variance (cross-validated R² = .32), and with the strategy covariate removed the gain was no longer
  significant. They cite Bors & Vigneau 2003 [SR] for APM scores rising on repeated testing without
  training.
- **Robison, Campbell, Garner, Sibley & Coyne 2026** [PT; Behavior Research Methods 58(2), 56;
  N = 255; 24 computerised tests twice, about two weeks apart]. Practice effects: letter sets d = 0.31,
  terrain orientation 0.20, spatial apperception 0.14 (reported inconsistently), **paper folding 0.05
  (n.s.)**; Raven's APM −0.45, but attempt 1 used the odd items and attempt 2 the even items, so this
  is a form difference, not a retest effect. The factor structure stayed invariant across attempts.
  So retest gains vary a lot by test.
- **Lozano & Revuelta 2020** [AB; Intelligence 82, 101468; N = 293]: no evidence of rule learning
  within the RAPM under standard administration; fatigue effects per rule; learning tied to perceptual
  properties. **Lozano, Embretson & Revuelta 2025** [PT; J Intelligence 13(11), 147; N = 765 recruits,
  34 matrix items]: within-test learning of some rules (pairwise progression got easier for almost
  everyone), with individual differences that correlate with ability (r ≈ .22–.25).
- **te Nijenhuis, van Vianen & van der Flier 2007** [FT; Intelligence; 64 test–retest studies,
  N = 26,990]: the correlation between subtests' g loadings and their retest gains is −.80 (corrected
  ρ ≈ −.95): the more g-loaded the subtest, the smaller the gain. The authors call the gains "hollow":
  narrow or test-specific, not on g. Practice and coaching lowered the g loading of scores in an
  earlier study (.53 → .49).

### 4.2 Coaching, rule knowledge and test familiarity

- **Coaching vs practice**: δ = .70 vs .24 (Hausknecht 2007, above); 0.51 vs 0.25 SD (Kulik,
  Bangert-Drowns & Kulik 1984 [SR, via te Nijenhuis 2007]); in the summary by Sommer & Arendasy 2025
  [PT]: familiarisation alone has a negligible effect, practice-based training d = 0.22–0.40, coaching
  d = 0.33–0.64, combined coaching and practice more; preparation gains stay with "narrower,
  test-specific abilities".
- **Teaching the rules of figural matrices**:
  - **Schneider, Becker, Krieger, Spinath & Sparfeldt 2020** [AB; Intelligence 82, 101473]: a video
    under 14 minutes explaining the rules raised figural-matrices scores by **d ≥ 1.19** (two
    experiments, N = 112 and 229); correlations with other intelligence tests did not differ
    between the groups (about .55 in experiment 1 and .40 in experiment 2).
  - **Levacher, Koch, Hissbach, Spinath & Becker 2022** [AB; European J Psychological Assessment;
    N = 882]: rule information raised the probability of solving items from .41 to .61, **d = .92**;
    item properties did not differ between groups, so the authors recommend giving everyone the
    preparation material.
  - **Krautter, Lehmann, Kleinort, Koch, Spinath & Becker 2021** [FT; Frontiers in Psychology 12,
    619440; N = 287]: training the difficult rules beat full and easy-rule training and carried over to
    untaught easy rules (d_RTE = 0.79); easy-rule training did not carry over to difficult rules.
  - **Loesche, Wiley & Hasselhorn 2015** [AB; Intelligence, 58–75]: giving the RAPM rules shifted
    solvers to constructive matching; working-memory capacity still predicted scores.
  - Schneider & Sparfeldt 2021a, 2021b [SR, via Raden & Jarosz 2023]: rule videos raised scores on
    other fluid tests (number series) without changing their correlations with other measures.
- **Analogies specifically**:
  - **Klauer & Phye 2008** [SR] and an update of their meta-analysis (Zeitschrift für Pädagogische
    Psychologie, doi 10.1024/1010-0652/a000123; the page showed no header, so its author and year are
    unconfirmed) [AB]: Klauer's inductive-reasoning training raised fluid-intelligence scores,
    d = 0.60 across 109 studies (N = 4,668), and learning in school lessons d = 0.68. (That the
    training works on comparing attributes and relations, the operations behind analogies, series and
    classification items, is my general knowledge of the programme, not read here.)
  - **Raden & Jarosz 2023** [PT; J Intelligence 11(4), 77; N = 220]: training individual figural
    analogy rules; working-memory capacity explained most of the transfer to new items; how abstractly
    people represented the rules predicted success on items with new rules.
  - **Dynamic testing of figural analogies in children** (Stevenson 2012, Leiden dissertation,
    chapter 5) [PT]: after two short training sessions on AnimaLogica (A : B :: C : ? with animals),
    an average child's chance on an average item rose from about .06 to .33; graduated prompts beat
    plain feedback; no practice-only control, so retest and training are not separated.
- **The players' view**: the r/cognitiveTesting poll (§1.1) rates matrices as the most praffable
  kind of test, analogies middling, vocabulary the least. The research above agrees that knowing an
  item type's rules is the strongest lever.

### 4.3 Practice on spatial tasks: how specific are the gains?

- **Uttal et al. 2013** [SR, via docs/research/v1.0/A-evidence.md and the guide]: spatial training
  g = 0.47 across 206 studies; untrained spatial tests gained about as much; control groups gained
  0.45 on their own (retesting and filler tasks).
- **Heil, Rösler, Link & Bajric 1998** [AB; Psychological Research 61, 99–106; N = 37]: practice with
  3D block figures gave "specific learning effects but no transfer" to new objects or new views: an
  instance-based account.
- **Jost & Jansen 2021** [PT; QJEP; N = 121]: after 30 minutes of rotation training, all groups got
  faster (about 243 ms); trained figures stayed about 59 ms faster than new ones, a gap much smaller
  than the overall gain: partly item-specific, partly a process gain.
- **Wright, Thompson, Ganis, Newcombe & Kosslyn 2008** [PT; Psychonomic Bulletin & Review; N = 31;
  21 days, 114 trials a day, about 7 h]: practising mental rotation or paper folding transferred to
  the other spatial task (about 800 ms faster, errors about 16 % → 12 %) and to new items, so the
  authors call the gains "process based, not instance based", mostly in intercepts. **The verbal
  analogies control** got 210–300 ms faster, with **no change in errors** (19.4 % → 19.2 %;
  16.4 % → 15.9 %).
- **Meneghetti, Cardillo, Mammarella, Caviola & Borella 2017** [AB; Psychological Research; 72 women]:
  rotation practice, with or without a taught strategy, raised rotation accuracy and kept it; the
  strategy group was more accurate at follow-up than at pre-test on perspective taking and fluid
  tasks (a within-group comparison).

### 4.4 Does spatial training change analogy or matrix scores?

- **Stephenson & Halpern 2013** [PT; Intelligence 41; N = 136]: four weeks of dual n-back, visual
  n-back or spatial matrix span (a visuospatial short-term memory task) raised Raven's APM more than no
  training (d = .61, .49, .52); dual and visual n-back also raised BETA-III matrix reasoning
  (d = .73, .47); auditory n-back did not; Cattell and WASI matrices showed no training effect. Paper
  folding was the only cognitive test whose gain beat the control's. The authors' caveats: shortened
  time limits, and a no-contact control cannot rule out memory for test items. There was no
  mental-rotation or folding training arm.
- **Wright et al. 2008** (above): seven hours of rotation or folding practice did not change verbal
  analogy accuracy.
- **Corral & Burte 2025** [AB, via a library catalogue record; QJEP 78(12), 2781–2802; six
  experiments]: spatial skill and analogical reasoning correlate; within analogy problems, a strategy
  that points to the spatial relations helped a little more than a visualisation strategy (small,
  replicated in some experiments only). This is strategy instruction on analogy items, not spatial
  practice.
- **Khattabi, Doumas & Arslan 2026** [AB; CogSci proceedings 48]: in written, spoken and mixed
  A : B :: C : D analogies, verbal ability predicted performance everywhere; mental rotation mattered
  mainly in the mixed format.
- **Cortes et al. 2022** [PT; Science Advances 8, eabo3555; quasi-experimental, N = 182]: a high-school
  spatial (GIS) curriculum improved a verbal reasoning task (syllogisms, not analogies; partial
  η² ≈ .03–.04), mediated by gains in embedded-figures scanning; no effect on mental rotation;
  self-selected groups.
- **Blum & Holling 2018** [PT; Frontiers in Psychology 9, 1286]: rotation and reflection are among
  the hardest rules in their figural analogies; the authors say such items "can also measure
  visual-spatial intelligence". **Chen, De Beuckelaer, Wang & Liu 2017** [PT; Scientific Reports 7,
  16230]: Raven's APM splits into a visuospatial and a verbal-analytic item subset (after DeShon et al.
  1995 [SR]). Both suggest a route from rotation and mirror practice to some figural items; neither
  tests it.
- **Judd & Klingberg 2021** [AB; Nature Human Behaviour 5, 1548–1554; N = 17,648 children]:
  spatial training (rotation or tangram, visuospatial memory, or non-verbal reasoning) added to maths
  training; memory and reasoning training helped maths most. No analogy outcome.
- **Gap**: I found no randomised study in which rotation, folding, cross-section or perspective-taking
  practice was the intervention and a figural- or verbal-analogies test was the outcome, apart from
  Wright et al.'s verbal-analogies control (no accuracy change). Waschl, Nettelbeck & Burns 2017 on
  visuospatial ability in Raven's was found but not opened.

### 4.5 What this means for a Parallax player

My reading of §4.1–§4.4 (inference, labelled as such):
1. **Tests that share a Parallax format** (paper folding, hidden shapes, block counting, cube nets,
   block tapping; DAT PAT types once added): expect at least an alternate-form retest gain, about
   0.2–0.4 SD (3–6 IQ points), early in practice. Parallax also explains each solution (show-me,
   strategy cards), which is closer to coaching, so gains in the coaching range (0.5–0.7 SD) are
   possible on those subtests. These gains are near transfer and mostly test-specific (te Nijenhuis
   2007; Sommer & Arendasy 2025). Not measured for Parallax itself.
2. **Analogy and matrix tests**: no Parallax exercise teaches their rules or format, which is where
   the big effects come from (d ≈ 0.9–1.2 for rule teaching). Plausible routes are general
   test-taking familiarity, the Word Links probe's analogy format, and fluency with rotation and
   mirror judgements. Expected inflation: probably small; not measured. The one direct data point
   (Wright 2008) shows no change in verbal-analogy accuracy after seven hours of spatial practice.
3. **The reverse risk**: outside analogy practice inflates Word Links, the Check's control, and so
   hides spatial transfer in Parallax's own report.
4. Retest gains plateau after two or three sittings and persist for months to years (Scharfen 2018;
   Hausknecht 2007; Sommer & Arendasy 2025). A score taken after practice cannot be compared with one
   taken before without allowing for this.

## 5. What Parallax already says

Found by grep and reading (v1.0 on branch `build`, 2026-11-13). Paths are from the repository root.

| Where | What it says | Covers |
|---|---|---|
| js/ui/about.js:49 (About → "What training can and cannot do") | "Part of any improvement on a repeated test is familiarity with the test itself (Scharfen and colleagues, 2018)", then the Check's design | retesting the probes |
| js/ui/about.js:57–61 (About → "Test hygiene") | items generated and solver-checked, no Block Design or Visual Puzzles clones; "Span (EX-09) uses block-tapping sequences, a format some clinical tests also use. Practising them can raise your score on such a test, so mention your practice if you take one."; "not a test of intelligence and not a diagnostic tool" | **Span only** |
| js/ex/span/learn.js:89 (bridge text), shown on the Library exercise page (js/ui/library.js:434–436, "Where spatial thinking is used") and in the How to play sheet (js/ui/play.js:1912) | "It can also raise scores on clinical block-tapping tests, so mention your practice if you take one." | Span only |
| README.md:24 ("What it can and cannot do") | no clinical-subtest clones; "Practising block-tapping spans can raise scores on clinical block-tapping tests: if you take one, mention your practice." | Span only |
| docs/guide/guide.html:82, 160, 740 (chapters 1, 2 and 5) | familiarity is part of any raw gain; why two baselines; retest numbers (0.33, 0.50, 0.23 vs 0.37) | retesting in general |
| docs/guide/guide.html:514 (Span page, "Evidence") | "Test hygiene: block-tapping practice can raise scores on clinical block-tapping tests, so mention your practice if you take one." | Span |
| docs/guide/guide.html:784, 794; js/ex/wordlinks/learn.js:14 | Word Links is the control: "This check is about words, not space: it helps tell apart what comes from practice with tests in general." | the control's purpose; not that it is an analogy format met in outside tests |
| docs/guide/guide.html:811 (chapter 5, "Taking a check well") | "Do not look up or practise the probes. Their value is that they are new." | the probes |
| docs/guide/guide.html:1046–1053 (chapter 8, "No clones of clinical tests", "Formats you may meet elsewhere", panel "If you take a test") | WAIS perceptual-reasoning subtests have the largest practice effects (Canivez 2010); "Some exercises share a format with published tests: paper folding, cross-sections, perspective taking, block tapping. A gain on such a test after practice here is near transfer, not mid transfer."; the panel names Span only and ends "If you take a clinical, school or job assessment with spatial tasks, mention that you have practised similar tasks, so the result can be read fairly." | the general principle; four formats named (not hidden shapes, cube nets, block counting) |
| docs/guide/guide.html:986, 1026 (research tables) | retest numbers; "Wechsler retest … No Block Design or Visual Puzzles clones" | references |
| docs/dev/DESIGN-PLAN.md:20 | "A published test sharing an exercise's format counts as near transfer. Span practice may raise clinical block-tapping scores: said in About and the guide." | design intent |
| CLAUDE.md rules 2, 3 and 10 | near/mid/far wording; no clones; probes never trained | rules |
| js/ui/check.js:67–77 (Check intro) | no feedback, items adapt, the comparison with baseline, control and familiarity | no word about outside tests or outside practice |

Gaps:
1. Nothing mentions **analogy or matrix tests**, the owner's concern, or that Word Links is itself an
   analogy format.
2. Only Span carries an in-app note. Fold, Hidden, Views (counting) and Nets share formats with
   published subtests and carry none; the guide's list of shared formats omits hidden shapes, cube
   nets and block counting.
3. No in-app text tells a player **when** to take an outside test (before practising its puzzle type).
4. Parallax does not record outside tests or outside practice, though both affect the Check (outside
   analogy practice raises the control; outside spatial tests add familiarity with the probes' kinds
   of item).
5. Planned v1.1 exercises (DAT PAT types, landmark-free path integration) will need their own notes.

## 6. Recommended warning design

### 6.1 Principles

- One message everywhere, sized to the overlap: near formats get a note on the exercise itself;
  everything else is covered once in About and the guide. Calm, factual, no stacked disclaimers
  (standing rules, "Stance on transfer"), no IQ numbers in the app (CLAUDE.md rule 10). Effects are
  given in standard deviations; the guide may add the 15-point translation if the owner agrees (§7).
- Say three things: practising a kind of puzzle raises scores on tests that use it (with the size);
  those gains stay mostly with that kind of puzzle; so take a test that matters before practising
  its kind of puzzle, or say how much you have practised.
- Do not hide or remove exercises. Hiding would not undo practice already done and would take away
  useful training. Offer an optional, reversible pause instead (§6.4).
- The note belongs to the format, not to a named product: the app says "some school, admissions and
  ability tests"; the guide names example tests (CogAT, CAT4, DAT, CORE subtests) as examples.

### 6.2 Which exercises and tests it covers

| Exercise or task | Note on the exercise? | Formats it shares (examples for the guide) | Distance |
|---|---|---|---|
| Fold (EX-04) | yes | paper folding with punched holes (CogAT Paper Folding, CAT4 Figure Analysis, DAT PAT) | near |
| Hidden (EX-10) | yes | finding a hidden shape (CAT4 Figure Recognition; embedded-figures tests) | near |
| Views (EX-07), count variant | yes | counting cubes in a stack (CORE Block Counting after the AGCT; AFOQT) | near-mid |
| Nets (EX-05) | yes | which cube a net makes (cube-folding items; DAT PAT form development) | mid-near |
| Span (EX-09) | yes (exists) | block tapping (clinical Corsi tests; WAIS-5 Symbol Span is related) | near |
| Slice, Orient, Homing, v1.1 path integration | guide and About only | cross-sections (Hoeflin tests), directions and maps (SB5 Position and Direction; CORE Spatial Awareness, inferred) | mid |
| Rotate, Spin | guide and About only | cube-rotation and mirror items; rotation and reflection rules inside figural analogies | mid / far |
| v1.1 DAT PAT exercise (R3) | yes, its own wording | the DAT PAT itself, by design; paper folding, cube counting, views elsewhere | near |
| Word Links (PR-0, Check only) | About (a), the guide (d), the Check question (c) | verbal analogies (CORE and VISA Analogies, old SAT, MAT, high-range tests) | near format, light dose |
| Cube Match (PR-1, Check only) | guide only | cube comparisons | near format, light dose |

### 6.3 Draft wording

**(a) About → "Test hygiene"** (replaces the Span paragraph; keeps the first and last paragraphs):

> Some exercises use the same kinds of puzzles as parts of published tests: paper folding (Fold),
> hidden shapes (Hidden), counting cubes (Views), cube nets (Nets) and block tapping (Span).
> Practising a kind of puzzle raises scores on tests that use it. Taking a test a second time adds
> about a third of a standard deviation on average, and being taught a puzzle type's rules has added
> about one standard deviation in studies. These gains stay mostly with that kind of puzzle
> (Scharfen and colleagues, 2018; Schneider and colleagues, 2020).
>
> So if a test result matters to you, take the test before you practise its kind of puzzle here, or
> say how much you have practised. Analogy tests ("A is to B as C is to …") are not trained here; the
> Spatial Check's word task uses that format for a few minutes per check, without feedback.

**(b) Exercise note** (Library exercise page under the lead, like Track's note, and in How to play;
from an optional learn.js field). Fold:

> Also in tests: folding and punching paper is part of some school, admissions and ability tests.
> Practising it here will likely raise your score on that part, through practice with the format,
> so if you take one, say that you have practised.

Hidden: "Also in tests: finding a hidden shape is part of some school and ability tests. Practising it
here will likely raise your score on that part, through practice with the format, so if you take one,
say that you have practised."
Views: "Also in tests: counting the cubes in a stack is part of some ability and military tests.
Practice here helps with that part (here every cube is visible; in tests some are hidden), so if you
take one, say that you have practised."
Nets: "Also in tests: folding a net into a cube is a common item in spatial and admissions tests.
Practising it here will likely raise your score on such items, so if you take one, say that you have
practised."
Span: keep the existing sentence.
Implementation note: the About text in (a) cites Schneider and colleagues (2020), so About's
reference list (js/ui/about.js REFS) would gain that entry.
DAT PAT exercise (v1.1): "These are the question types of the Perceptual Ability Test in the Dental
Admission Test. Practising them prepares you for that test and raises scores on other tests with the
same puzzles."

**(c) Spatial Check, after the intro of a non-baseline check** (one tap, logged for the Lab like the
expectations question, never used in scoring):

> Since your last check, have you practised or taken another test with puzzles like these, or with
> word analogies? [No] [A little] [A lot] — Outside practice changes results too, so the Lab keeps
> your answer next to your data.

**(d) Guide, chapter 8**: rename the panel "If you take a test" to cover every shared format; list
the formats with their exercises and distance (the table in §6.2, with example tests); give the
numbers (Scharfen 2018: 0.33 / 0.50 / plateau, alternate 0.23 vs identical 0.37; Hausknecht 2007:
coaching .70 vs .24; Levacher 2022 d = .92 and Schneider 2020 d ≥ 1.19 for rule teaching; te Nijenhuis
2007 on gains not being on g); a paragraph on analogies: no exercise trains them, Word Links uses the
format lightly, and in one study seven hours of rotation or folding practice left verbal-analogy
accuracy unchanged (Wright et al. 2008); and the advice: take a test that matters first, compare
only scores taken under the same conditions, and remember that retest gains last for months to years.

**(e) README**, the last sentence of "What it can and cannot do":

> Some exercises use the same kinds of puzzles as parts of published tests (paper folding, hidden
> shapes, counting cubes, cube nets, block tapping), and practising a kind of puzzle raises scores on
> tests that use it: if a test result matters to you, take it before practising, or mention your
> practice.

### 6.4 Optional "Taking a test soon?" helper (Settings, linked from About's Test hygiene)

- Off by default; nothing changes unless the player uses it.
- The player ticks what the test contains: paper folding · hidden shapes · counting cubes · cube nets
  · turned or mirrored shapes · directions and maps · block tapping · word analogies · figure
  analogies or matrices · not sure.
- Parallax answers in three short lines: **Same kind of puzzle** (e.g. "Fold, Views (counting):
  practice here will likely raise your score on these parts"); **Related** (e.g. "Rotate, Spin: a
  small or unknown effect"); **Not trained** (e.g. "Word analogies: only the Spatial Check's word task
  uses this format").
- Actions: "Leave the same-kind exercises out of Train until [date]" (reversible; Free play and Path
  stay open); "Note this test in my log" (date and puzzle kinds, included in the Lab research export
  so pooled data can account for it); "Close".
- Engine hook for the planner: Train already filters exercises through `plan.can` in
  js/engine/modes.js; a paused-until list can apply there. The log row and the Check question (c)
  need a field in the record; both are small.

### 6.5 What not to do

- No exercise is hidden or removed for anyone, and no warning blocks play.
- No claim that Parallax raises scores on a named IQ test, and no claim that it cannot; the
  analogies line says what is and is not trained.
- Word Links must stay in the Check even for players about to take an analogy test: it is the
  control, and 16 untrained items without feedback are a light dose. The Check question (c) records
  outside practice instead.

## 7. Questions for the owner

1. "Which test do you mean by the analogical assessment test? A link or a screenshot of one item is
   enough." Follow-ups if the answer is unclear: words or shapes? A whole test, or one part of CORE,
   VISA or another battery on CognitiveMetrics? Is it the community's own test?
2. "CognitiveMetrics lists a new test called ATAT. Is that the one, and do you know what the letters
   stand for?"
3. "Should the app name outside tests (for example 'CORE Block Counting'), or keep the app generic and
   name tests only in the guide?" (Recommended: generic in the app, named in the guide.)
4. "Do you want the optional 'Taking a test soon?' helper with a pause for Train, or only the notes?"
5. "The community counts in IQ points. Parallax's rules forbid IQ figures in the app. May the guide
   translate effect sizes into points on a scale with a standard deviation of 15?"

## 8. References

Reading level in brackets (§0). "Details unconfirmed" marks a volume, issue or page range I took from
memory or from the v1.0 notes without seeing it on a page.

### Research

- Arendasy, M. E., & Sommer, M. (2017). Reducing the effect size of the retest effect: Examining
  different approaches. *Intelligence, 62*, 89–98. https://doi.org/10.1016/j.intell.2017.03.003 [AB,
  ideas.repec.org]
- Blum, D., & Holling, H. (2018). Automatic generation of figural analogies with the IMak package.
  *Frontiers in Psychology, 9*, 1286. https://doi.org/10.3389/fpsyg.2018.01286 [PT, PMC6087760]
- Bors, D. A., & Vigneau, F. (2003). The effect of practice on Raven's Advanced Progressive Matrices.
  *Learning and Individual Differences, 13*, 291–312. [SR, via Hayes et al. 2015 and Raden & Jarosz
  2023; details unconfirmed]
- Chen, Z., De Beuckelaer, A., Wang, X., & Liu, J. (2017). Distinct neural substrates of visuospatial
  and verbal-analytic reasoning as assessed by Raven's Advanced Progressive Matrices. *Scientific
  Reports, 7*, 16230. https://doi.org/10.1038/s41598-017-16437-8 [PT, PMC5701148]
- Corral, D., & Burte, H. (2025). The relationship between visuospatial and analogical reasoning.
  *Quarterly Journal of Experimental Psychology, 78*(12), 2781–2802.
  https://doi.org/10.1177/17470218251327076 [AB, via a library catalogue record]
- Cortes, R. A., Peterson, E. G., Kraemer, D. J. M., Kolvoord, R. A., Uttal, D. H., Dinh, N.,
  Weinberger, A. B., Daker, R. J., Lyons, I. M., Goldman, D., & Green, A. E. (2022). Transfer from
  spatial education to verbal reasoning and prediction of transfer from learning-related neural
  change. *Science Advances, 8*, eabo3555. [PT, author's PDF at mathbrainlab.com]
- DeShon, R. P., et al. (1995), the visuospatial and verbal-analytic split of Raven's APM items. [SR,
  via Chen et al. 2017; full citation not retrieved]
- Freund, P. A., & Holling, H. (2011). How to get really smart: Modeling retest and training effects
  in ability testing using computer-generated figural matrix items. *Intelligence*, 233–243. [AB,
  manuscript.isc.ac; volume not shown]
- Hausknecht, J. P., Halpert, J. A., Di Paolo, N. T., & Moriarty Gerrard, M. O. (2007). Retesting in
  selection: A meta-analysis of coaching and practice effects for tests of cognitive ability.
  *Journal of Applied Psychology, 92*(2), 373–385. https://doi.org/10.1037/0021-9010.92.2.373 [PT,
  Cornell eCommons PDF]
- Hayes, T. R., Petrov, A. A., & Sederberg, P. B. (2015). Do we really become smarter when our
  fluid-intelligence test scores improve? *Intelligence*, 1–14. [PT, PMC4226176; volume not shown]
- Heil, M., Rösler, F., Link, M., & Bajric, J. (1998). What is improved if a mental rotation task is
  repeated – the efficiency of memory access, or the speed of a transformation routine?
  *Psychological Research, 61*, 99–106. https://doi.org/10.1007/s004260050016 [AB]
- Jost, L., & Jansen, P. (2021). Manual training of mental rotation performance: Visual
  representation of rotating figures is the main driver for improvements. *Quarterly Journal of
  Experimental Psychology*. https://doi.org/10.1177/17470218211039494 [PT, epub.uni-regensburg.de;
  DOI read from the file name]
- Judd, N., & Klingberg, T. (2021). Training spatial cognition enhances mathematical learning in a
  randomized study of 17,000 children. *Nature Human Behaviour, 5*, 1548–1554.
  https://doi.org/10.1038/s41562-021-01118-4 [AB]
- Khattabi, J., Doumas, L. A. A., & Arslan, S. (2026). Modality-specific dynamics and context
  dependent involvement of visuospatial and verbal abilities in analogical mapping. *Proceedings of the
  Annual Meeting of the Cognitive Science Society, 48*. https://escholarship.org/uc/item/4pv9z1gb [AB]
- Klauer, K. J., & Phye, G. D. (2008). Inductive reasoning: A training approach. *Review of
  Educational Research, 78*(1), 85–123. [SR, via the update below]
- Update of Klauer & Phye's meta-analysis (109 studies), *Zeitschrift für Pädagogische Psychologie*.
  https://doi.org/10.1024/1010-0652/a000123 [AB; the page showed no header, so author and year are not
  confirmed]
- Krautter, K., Lehmann, J., Kleinort, E., Koch, M., Spinath, F. M., & Becker, N. (2021). Test
  preparation in figural matrices tests: Focus on the difficult rules. *Frontiers in Psychology, 12*,
  619440. https://doi.org/10.3389/fpsyg.2021.619440 [FT]
- Kulik, J. A., Bangert-Drowns, R. L., & Kulik, C.-L. C. (1984). Effectiveness of coaching for
  aptitude tests. *Psychological Bulletin, 95*(2), 179–188. [SR, via te Nijenhuis et al. 2007;
  details unconfirmed]
- Levacher, J., Koch, M., Hissbach, J., Spinath, F. M., & Becker, N. (2022). You can play the game
  without knowing the rules – but you're better off knowing them. *European Journal of Psychological
  Assessment*. https://doi.org/10.1027/1015-5759/a000637 [AB, sciencegate.app; year from the
  search listing]
- Loesche, P., Wiley, J., & Hasselhorn, M. (2015). How knowing the rules affects solving the Raven
  Advanced Progressive Matrices Test. *Intelligence*, 58–75. [AB, manuscript.isc.ac]
- Lozano, J. H., & Revuelta, J. (2020). Investigating operation-specific learning effects in the
  Raven's Advanced Progressive Matrices: A linear logistic test modeling approach. *Intelligence, 82*,
  101468. https://doi.org/10.1016/j.intell.2020.101468 [AB]
- Lozano, J. H., Embretson, S. E., & Revuelta, J. (2025). An analysis of individual differences in
  within-test practice effects in progressive matrices. *Journal of Intelligence, 13*(11), 147.
  https://doi.org/10.3390/jintelligence13110147 [PT]
- Meneghetti, C., Cardillo, R., Mammarella, I. C., Caviola, S., & Borella, E. (2017). The role of
  practice and strategy in mental rotation training: Transfer and maintenance effects. *Psychological
  Research*, 81(2). [AB, publisher listing; pages unconfirmed]
- Raden, M. J., & Jarosz, A. F. (2023). Knowledge representations: Individual differences in novel
  problem solving. *Journal of Intelligence, 11*(4), 77. https://doi.org/10.3390/jintelligence11040077
  [PT, PMC10141221]
- Robison, M. K., Campbell, S., Garner, L. D., Sibley, C., & Coyne, J. (2026). A comprehensive
  psychometrics of cognitive ability measures: Reliability, practice effects, and the stability of
  latent factor structures across retesting. *Behavior Research Methods, 58*(2), 56.
  https://doi.org/10.3758/s13428-025-02897-8 [PT, PMC12855318]
- Scharfen, J., Peters, J. M., & Holling, H. (2018). Retest effects in cognitive ability tests: A
  meta-analysis. *Intelligence, 67*, 44–66. https://doi.org/10.1016/j.intell.2018.01.003 [PT, gwern.net
  copy, first 100,000 characters including the result tables]
- Schneider, B., Becker, N., Krieger, F., Spinath, F. M., & Sparfeldt, J. R. (2020). Teaching the
  underlying rules of figural matrices in a short video increases test scores. *Intelligence, 82*,
  101473. https://doi.org/10.1016/j.intell.2020.101473 [AB]
- Schneider, B., & Sparfeldt, J. R. (2021a, 2021b), rule videos for number series. [SR, via Raden &
  Jarosz 2023; not opened]
- Sommer, M., & Arendasy, M. (2025). Automatic- and transformer-based automatic item generation: A
  critical review. *Journal of Intelligence, 13*(8), 102. https://www.mdpi.com/2079-3200/13/8/102 [PT;
  used for its summary of retest and preparation meta-analyses]
- Stephenson, C. L., & Halpern, D. F. (2013). Improved matrix reasoning is limited to training on
  tasks with a visuospatial component. *Intelligence, 41*. [PT, gwern.net copy; issue and pages
  unconfirmed]
- Stevenson, C. E. (2012). *Puzzling with potential: Dynamic testing of analogical reasoning in
  children* (doctoral dissertation, Leiden University), chapter 5 (Stevenson, Hickendorff, Heiser & De
  Boeck). [PT, scholarlypublications.universiteitleiden.nl]
- te Nijenhuis, J., van Vianen, A. E. M., & van der Flier, H. (2007). Score gains on g-loaded tests:
  No g. *Intelligence, 35*. https://doi.org/10.1016/j.intell.2006.07.006 [FT, gwern.net copy; issue
  and pages unconfirmed]
- Uttal, D. H., Meadow, N. G., Tipton, E., Hand, L. L., Alden, A. R., Warren, C., & Newcombe, N. S.
  (2013). The malleability of spatial skills: A meta-analysis of training studies. *Psychological
  Bulletin, 139*(2), 352–402. https://doi.org/10.1037/a0028446 [SR, via docs/research/v1.0 and the
  guide]
- Wright, R., Thompson, W. L., Ganis, G., Newcombe, N. S., & Kosslyn, S. M. (2008). Training
  generalized spatial skills. *Psychonomic Bulletin & Review, 15*(4), 763–771. [PT, Harvard DASH
  author copy; issue and pages unconfirmed]
- Read but not used in the text: Stad, F. E., Wiedl, K. H., Vogelaar, B., Bakker, M., & Resing,
  W. C. M. (2019), *European Journal of Psychology of Education, 34*, 123–146,
  https://doi.org/10.1007/s10212-018-0379-8 [PT] (dynamic testing with series completion, not
  analogies).

### Tests and community pages

- acisiq.com (2026). *Cognitive Metrics Review: Is CORE or AGCT Accurate?* by "Structural"; data
  snapshot 20 Sept 2026, pages dated 6 and 28 Oct 2026; the site sells a competing test.
  https://acisiq.com/cognitive-metrics-review [WP, read in three passes; the only source on CORE's
  subtests, VISA, APT, CAIT and the five newest tests (VISA, RQVT, Army Alpha, ATAT, a spatial exam)]
- CognitiveMetrics pages, titles only [ST]: "CORE - The Most Accurate Free IQ Test"
  (cognitivemetrics.com/test/CORE); "CORE Test Structure" (/test/CORE/structure); "CORE - Spatial
  Awareness" (/test/CORE/SA); "VISA - Verbal Intelligence Scale for Adults" (/test/VISA); "VISA -
  Analogies" (/test/VISA/AG); "1926 SAT - Analogies" (/test/1926-SAT/AG); "Advanced Processing Test
  (APT)" (/test/APT); "CAIT" (/test/CAIT); "Gifted Entry Test (GET)" (/test/GET); "Army Alpha - WWI
  Army Intelligence Test" (/test/army-alpha); "Site Updates" (/updates).
- r/cognitiveTesting, "Least praffable tests" (4 Apr 2023), read through the mirror
  https://reddit.birdcat.cafe/r/cognitiveTesting/comments/12btxoc/least_praffable_tests [WP]
- discord.me, "Project Chimera". https://discord.me/projectchimera [WP]
- ANALOGICA52 (Google Form). https://docs.google.com/forms/d/e/1FAIpQLSfnmpbdSj705rBFsejVRlLwvxqhvIDXDXJLgst6lYIJCVRS_g/viewform [WP]
- Chimera Analogies Test (Bill Bultas), http://miyaguchi.4sigma.org/Bultas/cat.html, answers at
  …/Bultas/cat_ans.html, index at …/Bultas/bultas_index.html [ST]; "Uncommonly Difficult IQ Tests"
  list, http://tthqi.free.fr/Uncommonly%20Difficult%20IQ%20Tests.php [WP]
- Hoeflin, R. *The Hoeflin Power Test*. https://megasociety.org/admission/power/ [WP]; *The Ultra Test*.
  https://megasociety.net/admission/ultra/ [WP]
- Miller Analogies Test. Wikipedia. https://en.wikipedia.org/wiki/Miller_Analogies_Test [WP]
- Riverside Insights. *CogAT test descriptions*.
  https://info.riversideinsights.com/datamanager-onlinehelp/cogat-test-descriptions [WP]; Cognitive
  Abilities Test, Wikipedia, https://en.wikipedia.org/wiki/Cognitive_Abilities_Test [WP]
- CAT4 overview (test-prep site). https://psychometric-success.com/aptitude-tests/test-types/cat4 [WP;
  secondary to GL Assessment]
- PRO-ED. SB5 sample descriptive report (excerpt).
  https://www.proedinc.com/Downloads/14462%20SB-5_OSRS_SampleDescriptiveReport.pdf [WP]
- AFOQT block counting overview (test-prep site).
  https://open-exam-prep.com/study-guides/afoqt/block-counting/block-counting-overview [WP]
- Army General Classification Test. Wikipedia. https://en.wikipedia.org/wiki/Army_General_Classification_Test
  [WP; it did not describe block counting]
- General knowledge, not checked on a page: the five-option old-SAT analogy layout; the six DAT PAT
  sections (apertures, view recognition, angle discrimination, paper folding, cube counting, 3D form
  development; R3 covers them).

## ACCESS: sources I could not open

| Source | What happened | Consequence |
|---|---|---|
| cognitivemetrics.com, every page (/, /test/CORE, /test/CORE/structure, /test/CORE/SA, /test/VISA, /test/VISA/AG, /test/1926-SAT/AG, /test/APT, /test/CAIT, /test/army-alpha, /updates, /forum, shared score reports) | WebFetch: client_error; curl through the agent proxy: 403, connect_rejected (host not allowed for this session); gifted.cognitivemetrics.com: robots_disallowed; web.archive.org copy: SITE_BLOCKED | CORE, VISA, APT, CAIT and ATAT are known only from one secondary review and page titles; "ATAT" stays unexpanded |
| reddit.com search of r/cognitiveTesting | SITE_BLOCKED | one thread read through a public mirror; no wider search of posts about an "analogical" test |
| miyaguchi.4sigma.org (Chimera Analogies Test, Bultas index, answer page) | WebFetch HTTPS → HTTP redirect loop; curl: host not resolved | the test's format and date unconfirmed |
| en.wikipedia.org/wiki/Mega_Test | permission request timed out (PROVENANCE_REQUIRED) | Mega Test composition taken from the Ultra and Power Test pages only |
| disboard.org (IQ tag listing) | client_error | — |
| doi.org/10.1177/17470218251327076 (Corral & Burte 2025, full text) | client_error | abstract only, from a catalogue record |
| academia.edu (Klauer & Phye 2008) | client_error | the 2008 numbers come from the update's abstract |
| researchgate.net, "Does reasoning training improve fluid reasoning and academic achievement for children and adolescents? A systematic review" (2021) | client_error | not used |
| nature.com/articles/s41562-022-01384-w (Pahor, Seitz & Jaeggi 2022, n-back → matrix reasoning) | client_error | not used |
| pmc.ncbi.nlm.nih.gov/articles/PMC11277614 (a figural-analogies latent trait model paper) | reCAPTCHA page | not used |
| Waschl, Nettelbeck & Burns 2017; Whitely & Dawis 1974; Schneider & Sparfeldt 2021a, 2021b | not opened (search titles or citations only) | not relied on |
| Further searches (bibliographic checks for te Nijenhuis 2007, DAT PAT repeat-taker data) | the session's shared web-search budget ran out | issue and page numbers marked "unconfirmed" above |
