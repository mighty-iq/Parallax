# R2. Knots: knotting and deknotting as visuospatial training items

Research note for Parallax v1.1, brief item 3 ("Implement knotting/deknotting"). Compiled 2026-11-13.
Question: which knot tasks make good visuospatial training items, and how can their items be generated,
rendered on phones and desktops, and verified so that exactly one answer is right?

**Conventions** (as in docs/research/v1.0): **(DJ)** = design judgement, not a research finding;
**[unverified]** = not checked against a source in this pass (prior knowledge); **[gap]** = searched
for, not found. Every source carries its reading level:

- **[full]**: the full text was read. Most full texts were read through a fetch tool that returns a
  model-written extraction of the page, so the numbers quoted here come from that extraction, not
  from reading the PDF by eye.
- **[abstract]**: abstract or publisher record only.
- **[secondary]**: known only through another source (named).
- **[record]**: a catalogue, licence, store or product page.
- **[proto]**: measured in a throwaway prototype written for this note (§4.8). Its code lives in the
  session scratchpad, not in the repository.

## 0. The answer in brief

1. **Knots are a credible visuospatial domain, but the training evidence is empty.** The only
   psychometric knot test, the Knot Reasoning Task (KRT; Bennett-Pierre et al., 2025), correlates
   r = .54 with mental rotation and r = .59 with paper folding. Learning to tie knots correlates with
   spatial tests (r ≈ .42–.45 with the MRT, Brandt & Davies 2006; ηp² = .06–.09 for Surface
   Development, Garland 2012). No study was found that trains knot diagrams and measures transfer
   [gap]. Whether people can tell a knot from an unknot in a diagram, and how that depends on the
   number of crossings, has not been measured; Croom & Firestone (2024) list it as future work.
2. **Recommended item types, ranked:** (1) **Pull: "Knot or not?"**: both rope ends are pulled; does
   a knot remain? (2) **Untie / Tie: "Which crossing would untie it?"** and its knotting mirror,
   "Which crossing would tie it?" (3) **Link: "Are these loops linked?"**, with a rope-through-a-ring
   sub-variant. (4) **Mirror: "Same knot or its mirror?"** with 3D tubes; later, as experimental. Not
   recommended now: "Which moves tie this knot?" (it is close to the KRT's backwards-reasoning
   format), naming knots from a catalogue, and picture-hanging puzzles (a good idea, but not knots).
3. **Every answer can be proved.** Unknots are certified by an explicit simplification (a list of
   Reidemeister moves down to a plain loop) or, for diagrams with at most 24 crossings, by a trivial
   Jones polynomial (Tuzun & Sikora: no non-trivial knot with a diagram of ≤ 24 crossings has
   V = 1). Knots are certified by a determinant ≠ 1 or a Jones polynomial ≠ 1. Links are certified
   linked by a linking number ≠ 0 or a Jones polynomial unlike the unlink's; "unlinked" needs a
   constructive split certificate. A mirror image is certified different when V(t) ≠ V(1/t).
4. **Shortcuts are the main design risk, and they are measurable.** In naive pools the fraction of
   over/under alternations predicts "knot" with 75–92 % accuracy, |writhe| 72 %, and the count of
   visible R2 slides 90 % [proto]. Sampling a knot and an unknot from the same picture (shadow),
   matched on alternation count and |writhe|, brought these to 50 %, 50 % and 61 % [proto]. The
   visible-slide count must be matched too.
5. **Rendering:** 2D SVG rope diagrams with a background-coloured casing around the over-strand and
   ends running off the plate. At most 12 crossings on a 320 px plate, crossing angles ≥ 35°.
   3D tubes (three.js `TubeGeometry`; the vendored subset exports neither it nor `CatmullRomCurve3`) for the mirror variant and a
   tutorial "pull tight" demo. "Show me" replays the validator's Reidemeister certificate as a 2D
   morph: exact, cheap, and from the same model that grades the answer.
6. **Cost:** the Jones polynomial by state sum takes 0.5 ms (8 crossings), 1.6–3 ms (10), 6–12 ms
   (12), 52 ms (14) and 246 ms (16) per diagram in Node [proto]. A cheap route (greedy R1/R2
   simplification, then the determinant) takes 0.05–0.2 ms and settles 85–96 % of braid-closure diagrams; the
   Jones polynomial is needed only for the rest [proto].
7. **Licences:** SnapPy/Spherogram, Regina and KnotFolio are GPL; Topoly is non-commercial; KnotPlot
   is proprietary, and the Knot Atlas's knot pictures are KnotPlot images; KnotInfo states no
   licence (citation requested), and its Python package is GPL. Everything Parallax needs (PD codes,
   Kauffman bracket, determinant, simplifier, rendering) is short and should be reimplemented from
   the published mathematics. KnotGym and Knottingham are MIT if code is ever borrowed.

## 1. Human cognition of knots and tangles

### 1.1 Following a rope: curve tracing

- Deciding whether two dots lie on the same curve takes longer the further apart they are **along
  the curve**, with straight-line distance held constant. This is read as serial mental tracing
  (Jolicoeur, Ullman & MacKay, 1986 [secondary: Jeurissen et al. 2016; McCormick & Jolicoeur 1991];
  "reaction times increase linearly with the length of the curve", Jeurissen et al. 2016 [full]).
- Tracing time depends on curve length **relative to pattern size**, not absolute size (Jolicoeur &
  Ingleton, 1991 [abstract]). Tracing is slower when other curves run close by: "spreading is fast if
  curves are far apart but it slows down if curves are in each other's vicinity" (Jeurissen, Self &
  Roelfsema, 2016 [full], explaining it with the growth-cone model of Pooresmaeili & Roelfsema, 2014
  [secondary]). Distractor curves change the shape of the distance function, which is best fitted by
  a zoom-lens tracing operator (McCormick & Jolicoeur, 1991 [abstract]).
- None of these sources gives a tracing rate (ms per degree) in what was read; the original papers
  were not opened (ACCESS).
- **Consequence (DJ):** following a strand through its crossings is a serial operation. Rope length
  between decisions (number of crossings) and the spacing of neighbouring strands are natural
  difficulty dimensions. Overall size should not matter, so the same item can be shown on a phone
  and a desktop if strands stay resolvable.

### 1.2 Knot items in tests and puzzles

- **Knot Reasoning Task (KRT)**: Bennett-Pierre, Shipley, Newcombe & Gunderson (2025),
  *Cognitive Research: Principles and Implications* 10:13 [full; appendices after B truncated].
  - It measures "non-rigid, ductile" spatial skill. The stimuli are photographs of real rope, from
    knots in a step-by-step knot-tying website (Grogono, "Animated Knots") that the authors re-tied
    and photographed.
  - Three item types. **Backwards reasoning:** which of four photos shows the step just before the
    target? Two foils are that step with one crossing switched, and one foil is a step from another
    knot. **Different materials:** the same knot in another material, out of four. **Pulling:** would
    the knot come apart if the circled end were pulled in the arrow's direction (yes/no)? The authors
    checked the pulling keys by "manually testing each knot".
  - Study 1 (N = 279, untimed, 73 items cut to 54 by 2PL IRT, α = .88): mean .71 correct.
    Backwards .59, different materials .74, pulling .81. Mean time 26.4 min.
  - Study 2 (N = 147, α = .80): KRT .84 (pulling .87). Correlations: MRT r = .54, PFT r = .59,
    bending r = .33, vocabulary r = .29. MRT (β = .26) and PFT (β = .38) predict the KRT jointly,
    R² ≈ .40; bending and vocabulary add nothing. For the pulling items, MRT β = .26 and PFT β = .32.
  - Men scored higher in Study 2 (d = .39); in Study 1 women scored higher on different materials
    (d = .38). Masculine-stereotyped spatial activities predicted lower MRT and KRT scores, which the authors
    call inconsistent mediation.
  - The authors state that the KRT's validity for training outcomes is untested and that no expert
    groups were compared. Materials are on OSF; their licence was not checked.
- **UCEED 2022** (Indian design entrance exam), Visualization and Spatial Reasoning: "Which of the
  options will form a knot when both the ends are pulled?" Four rope pictures, two keyed [record].
- **Math Kangaroo 2025**, grades 3–4, item 3: which of five ropes forms a knot when pulled from both
  ends [record: summary of the video solution]. "Knot or not" items exist in aptitude and competition
  settings, so a Parallax "Pull" item is format-near to them and to KRT pulling items (§1.7).
- Sloman (2014), an online "knots overview", poses informal versions: which open strings form a knot
  when pulled, which pictures show the same configuration from another view [secondary: Santos et
  al.].
- No knot items were found in the factor-referenced kits and tests catalogued for v1.0
  (docs/research/v1.0/B-tasks.md) [gap].

### 1.3 Tying knots and spatial ability (surgery, sailing)

- **Surgery.** Brandt & Davies (2006) [full]: 60 preclerkship medical students learned a one-handed
  surgical reef knot, in a self-directed computer group or a lecture group. Mental rotation (Peters'
  redrawn Vandenberg–Kuse MRT) correlated with knots tied: r = .45 (lecture), r = .42 (computer),
  r = .45 overall (p < .001). The two groups did not differ in MRT scores or knots tied.
- Kalun et al. (2020), a scoping review of visual-spatial ability in surgical education [abstract]:
  of 117 articles, 59 reported significant correlations between spatial tests and surgical
  performance, mainly for novices in simulators. Whether spatial tests should be used for selection
  is unclear. The abstract does not separate knot tying.
- **Sailing knots.** Garland (2012), master's thesis [full]: 79 students learned nautical knots
  (constrictor knot, cow hitch, clove hitch) from animation or static images, viewed over the
  shoulder or face to face. Surface Development (ETS VZ-3) predicted fewer errors (F(1,73) = 4.65,
  ηp² = .06) and more correct steps (F(1,73) = 6.85, ηp² = .09), but not time. There was no media ×
  ability interaction.
- de Koning, Marcus, Brucker & Ayres (2019) [abstract]: 100 learners, two knots. Animation beat
  static pictures for both tying and reasoning about the process, with lower cognitive load. Showing
  hands hurt the reasoning task, and spatial ability helped learning from animations.
- Ayres, Marcus, Chan & Qian (2009) [abstract]: knot tying and puzzle rings; animations beat
  equivalent static pictures in both experiments. Schwan & Riempp (2004) [secondary: Garland 2012;
  record]: interactive, learner-paced video beat non-interactive video for nautical knots.
- **Climbing:** no study relating knot tying to spatial ability was found [gap].
- **Consequence (DJ):** learning to tie knots is a recognised spatially loaded skill. Spatial scores
  explain roughly 6–20 % of the variance in early learning, which supports knots as a VSI training
  domain. Nothing shows that practising knot diagrams improves tying, so Parallax must not imply
  that it does (standing rule 2).

### 1.4 Intuitive physics of knots

- Croom & Firestone (2024), "Tangled physics: knots strain intuitive physical reasoning", *Open
  Mind* [full: author manuscript on PhilArchive]. Naive online participants judged which of two
  bends (reef, thief, granny, grief) needs more force to fail when the long ends are pulled. Accuracy
  was at or **below** chance: photographs 42.1 % (N = 49), simulation renders 44.8 % (N = 50),
  scrubbable 360° videos 49.6 % (N = 84), photographs with topology diagrams 36.9 % (N = 96). Yet
  participants identified which knot a photo showed 92.5 % of the time (chance 25 %).
- The authors conclude that people see a knot's topology but not its mechanics. They list, as
  untested future tasks, judging whether a tangle forms a knot when pulled taut, and following parts
  of a knot as it loosens or tightens. Ground truth for strength came from Patil, Sandt, Kolle &
  Dunkel (2020) [full], whose counting rules (crossing number, twist fluctuation, circulation)
  predict the stability of bends.
- **Consequence (DJ):** ask topological questions (does a knot remain, are loops linked), not
  strength or security questions. Strength depends on friction, is poorly intuited, and its ground
  truth is a physics model rather than a proof.

### 1.5 How experts reason with knot diagrams

- De Toffoli & Giardino (2014), *Erkenntnis* 79(4) [abstract]: knot diagrams are dynamic, because
  the moves applied to them are part of how they are used. Experts need "a specific form of enhanced
  manipulative imagination" and draw inferences through imagined epistemic actions. That is the
  skill a "show me" built from Reidemeister moves can model.
- Santos, Cabalar & Casati, "The knowledge of knots: an interdisciplinary literature review"
  (*Spatial Cognition & Computation*, 2019 [venue unverified]; 2020 draft [full]): "the cognitive (or
  algorithmic) aspects involved in the act of tying a knot are a largely uncharted territory", and
  the link between topology and everyday knots is "insufficiently studied".
- Machines: in KnotGym (Chen & Artzi, NeurIPS 2025 Datasets & Benchmarks [full: arXiv v2]),
  rope-manipulation agents untie 2–4-crossing knots well (DreamerV3 89–93 %). Tying collapses with
  crossings: 83 % at 2, 16 % at 3, 4 % at 4. Prompted language models score 0–21 %. No human
  baseline. Crossing count is the obvious difficulty axis for machines too.

### 1.6 Training studies, and what is under-tested

- **No training study** was found that practises knot diagrams (unknotting, linking, knot
  recognition) and measures spatial transfer [gap; searched: knot theory lessons with spatial
  pre/post tests, knot training with mental rotation or paper folding outcomes].
- Knot-theory teaching papers are proposals: the VIBE framework (Diamantis, 2025 [full]) reports no
  data and cites no measured gains. The games it cites (knot-shadow games, KNOTRIS, the Arc
  Unknotting Game) report no outcomes [secondary: Diamantis 2025].
- **Under-tested**, so Parallax would be first or near-first:
  1. Telling a knot from an unknot in diagrams, and how accuracy and time scale with crossings,
     strand spacing and the kind of simplification needed. KRT pulling items are photos of real
     knots (81–87 % correct, untimed) and do not vary these factors systematically.
  2. Transfer of knot practice to MRT, PFT, the KRT, or tying.
  3. Diagram vs 3D render vs photo for topological judgements. Croom & Firestone varied the medium
     for strength judgements only.
  4. Analytic rules (Reidemeister moves, alternation, descending ropes) versus imagery; who uses
     which.
  5. Expertise (sailors, climbers, surgeons): not compared in the KRT or by Croom & Firestone.
  6. Sex and experience differences on non-rigid tasks are small and inconsistent (KRT).
- Recent work (2020–2026) covered here: Kalun et al. 2020; Patil et al. 2020; Croom & Firestone
  2024; Finke & Weitz 2024; Bennett-Pierre et al. 2025; Chen & Artzi 2025; Browne 2025; Diamantis
  2025; Lackenby 2026 (unknot recognition); de Koning et al. 2019 just before.

### 1.7 What this means for Parallax

- **Classification (DJ):** abilities `['Vz']`; cell `intrinsic-dynamic` (the object's own form
  changes, as in Fold); role `train`. The KRT's pattern (MRT and PFT jointly explaining about 40 %)
  says knot reasoning is spatial but partly distinct, so it adds variety rather than duplicating
  Rotate or Fold.
- **Near transfer, not mid transfer:** "Pull" shares its question with KRT pulling items, UCEED and
  Math Kangaroo items. Gains there count as near transfer, so the KRT must not become a
  mid-transfer probe. KRT photos and items (derived from Grog's Animated Knots) must never be copied
  (standing rule 3). Parallax's items are generated diagrams, not photos.
- **Honest bridge text (DJ draft):** "Following a rope through its crossings and picturing it pulled
  tight is part of sailing, climbing and surgical knot tying. People who score higher on spatial
  tests learn to tie knots a little faster. Practising knot diagrams has not been shown to improve
  knot tying or anything else."

## 2. Existing apps, games and puzzle formats

| Product | What it does | Knot-theory fidelity | Source |
|---|---|---|---|
| Tangle Master 3D (Rollic) and many clones ("Tangle Rope", "Twisted Tangle") | Sort coloured ropes between pins in a limited number of moves, with rope physics, boosters and ads | None visible: no over/under rule or knot type; "knots" is marketing | [record] App Store |
| Unknot! (P.F.J., Steam, Sept 2025) | Physics puzzle "based on knot theory", 100+ levels, research stages that minimise "swaps" | Undisclosed | [record] Steam |
| The Unknot Game (Browne, Bridges 2025) | Tap a point; the game applies the most simplifying compound move (Slip, Shrink); undo convoluted unknots in the fewest moves | Real: unknot diagrams made by random Reidemeister moves on Gauss codes; levels not solvable by Slip/Shrink are discarded | [full] |
| Unknot: Trivialize the Loop (iOS) | Unknotting puzzle | Not opened | ACCESS |
| Region Select (Kawauchi, Shimizu, Kishimoto; web) | "Lights out" on knot diagrams: a region click toggles the crossings around it | Real: region crossing change is an unknotting operation (Shimizu 2014) | [record] |
| To Knot or Not to Knot (Henrich et al., "A Midsummer Knot's Dream") | Two players resolve the crossings of a shadow; one wants a knot, the other the unknot | Real; analysed for twist and rational shadows | [full] arXiv |
| KNOTRIS; The Arc Unknotting Game | Classroom knot games | Real | [secondary] Diamantis 2025 |
| Knots 3D (Nynix) | 241–246 knots tie themselves; 360° rotation, scrubbing, speed, mirror mode | Instruction, not reasoning | [record] App Store |
| Animated Knots by Grog | Step photo sequences of real knots | Instruction; the source of the KRT stimuli | [secondary] KRT |
| KnotPlot (Scharein) | Research visualiser: drawing, relaxation, catalogue | Real; proprietary, paid | [record] |
| KnotFolio (Miller); Knottingham (Finke & Weitz 2024) | Draw or photograph a diagram, edit it, identify the knot; Knottingham reverts illegal moves ("Reidemeister crimes") | Real; KnotFolio GPLv2+, Knottingham MIT | [record]; [full] |
| KnotGym (Chen & Artzi 2025) | MuJoCo rope environment for agents (unknot, tie, convert); goal = Gauss-code match | Real; MIT | [full] |

**How Parallax can go beyond them (DJ):**

1. Every item has a **proof** of its single right answer: a move certificate or invariants, not a
   hand check or a physics run.
2. **Controlled difficulty dimensions**, fed to the adaptive engine, instead of hand-ordered levels.
3. **Shortcut solvers** in the tests keep cheap tells (alternation, writhe, visible slides) at chance.
   Casual games reward pattern-matching instead.
4. **Show me** replays the actual untangling from the grading model.
5. **Transfer is measured** on held-out probes, without claims, ads or points.
6. Both directions, knotting and deknotting, are covered, plus linking and chirality, which no
   consumer app found covers.

## 3. Candidate item types

Ratings are High, Medium or Low. "Shortcut risk" is the risk that a cheap heuristic beats chance by
more than 10 points (standing rule 5) unless the generator controls it. A **shadow** is the rope's
outline with its over/under information removed.

| # | Item (question) | Spatial validity | Generation | Verification | Shortcut risk | Phone fit | Verdict |
|---|---|---|---|---|---|---|---|
| A | **Pull**: "Pull both ends: does a knot remain?" | High: simulating the whole rope; KRT pulling items load on MRT and PFT | High: one shadow yields both classes | High: certificate or det/Jones, exact up to 24 crossings | High if uncontrolled: alternation 75–92 %, writhe 72 %, visible slides 90 % [proto]; matched ≤ 61 % | High up to ~12 crossings | Build first |
| B | **Untie / Tie**: "Which marked crossing, switched, unties (ties) it?" | High: one crossing's effect on the whole rope | Medium: 41 % of random knotted diagrams allow 1-of-4 [proto] | High: switch each option and classify | Medium-high: "creates a removable loop" scores ~55 % vs 25 % [proto] | High (letter tags + buttons) | Build second |
| C | **Link**: "Are these two loops linked?" (+ rope through a ring) | Medium-high | High | Linked: lk ≠ 0 or Jones; unlinked: split certificate | High: the parity of A-over-B crossings is a sound rule | High | Build third |
| D | **Mirror**: "Same knot or its mirror?" (3D tubes, turned and deformed) | High (Vz + chirality); overlaps Rotate | Medium: 3D embeddings and checked deformations | High: discrete isotopy check for the key; V(t) vs V(1/t) for mirrors | Medium: writhe sign; silhouettes must match by construction | Medium (4 tube thumbnails) | Experimental, later |
| E | **Tuck**: "Which way through the loop ties a knot?" | High: one tying step | Medium | High | Medium | Low-medium: routes overlap | Later |
| F | **Steps**: "Which moves tie this knot?" / "the step before?" | High (the KRT's hardest type, .59) | Medium-low | Medium: diagram-level identity per step | Medium | Low: 4 complex thumbnails | No: too close to the KRT |
| G | **Name**: "Pull tight: which knot is it?" | Medium: catalogue recall, verbal labels | High | High within a small catalogue | High: crossings left after visible simplification | Medium | No |
| H | **Hang**: "Remove this nail: does the picture fall?" | Medium-high: rope around pegs | High: free-group words | High: free reduction | Medium: exponent sums | High | Separate exercise idea, later |
| I | **Trace**: "Which end does this rope lead to?" | Low-medium: spatial scanning (SS) | High | High | Low | High | Tutorial step only |
| J | **Turn over**: "Which picture shows this flat knot turned over?" | Medium-high | High | High | High: stem-blind "most like the others" finds the key | High | Only inside D |

**Difficulty dimensions per type** (DJ; the A–C dims are worked out in §7.2):

| # | Dimensions |
|---|---|
| A | Crossings; untangling depth (visible R1/R2 only → a slide-over (R3) first → a detour that adds a crossing); strand spacing; later, flat vs tube look |
| B | Crossings; whether the key's switch shows a visible move or needs a slide-over to see; how many distractor switches also create a removable loop |
| C | Crossings between the loops; linking type (clasp, lk ±1 → double clasp, lk ±2 → Whitehead-type, lk 0); extra self-crossings; 2 → 3 rings |
| D | Knot (3_1 → 5_x → 6_x → 7_x); deformation (rigid turn → mild → strong, with added curls); turn angle |
| E | Strands the route crosses (1–4); loops on the rope |
| F | Number of steps; crossing changes per step |
| G | Catalogue size; scramble depth |
| H | Nails (2–5); word length; nesting of commutators |
| I | Rope length; spacing |
| J | Crossings |

### 3.1 A. Pull ("Knot or not?"): deknotting

- **Stimulus:** an open rope with both ends on the outer face, running off the plate edges, with
  pull arrows. Topologically this is the closure through the outer face, which is unique on the
  sphere, so the knot type is well defined (DJ). The KRT's "pull this end" wording asks the same
  question if the other end is held far away (DJ).
- **Answer:** yes/no, chance .5, keys balanced 50/50.
- **Prototype, crossing count:** pairing a knot and an unknot drawn from the same shadow makes
  crossing count useless (50.0 %) [proto].
- **Prototype, the other tells with same-shadow pairs** (1178 items, 4–9 crossings, best single
  threshold per feature): alternation fraction 90.1 %, |writhe| 72.7 %, visible R1 + R2 81.7 %,
  visible R2 89.8 %, "monotone from the start ⇒ unknot" 56.0 % [proto].
- **Prototype, matched pairs:** matching each pair on alternation count and |writhe| (400 items) gave
  alternation 50.0 %, |writhe| 50.0 %, visible R1 + R2 54.5 %, visible R2 61.0 %, monotone 50.0 %.
  The visible-R2 count is one point over the bound, so it must be matched too. On braid-closure
  shadows of 6–12 crossings, the alternation tell scored 75–92 % on class-balanced pools [proto].
- **Sound rules a learner may use.** These are strategies, not shortcuts, but they shape the mix:
  1. A **descending** rope (followed from one end, every crossing is first met on top) is unknotted.
     Only 7–8 % of the prototype's unknots were descending from the start [proto], so the rule
     helps but rarely decides an item.
  2. A **reduced alternating** diagram (nothing removable, over-under all the way) with at least one
     crossing is knotted (Kauffman 1987; Murasugi 1987; Thistlethwaite 1987 [unverified, textbook
     result]). So pools need knotted non-alternating ropes and unknots with long alternating
     stretches.
  3. **Two or fewer crossings** is always an unknot, so the lowest crossing level is 3.
- **Show me:** for an unknot, replay the certificate's moves until a plain arc remains. For a knot,
  simplify to its reduced core, then pull tight, with the caption "over, under, over all the way
  round: nothing can slide off".

### 3.2 B. Untie / Tie: knotting and deknotting by one crossing

- **Stimulus:** a knotted rope, closed or with ends off the plate, with four crossings marked A–D:
  "Which one crossing, switched, lets the rope fall open?" The **tie** direction uses an unknotted
  rope: "Which crossing, switched, ties a knot?" This is the literal knotting counterpart and doubles
  the item supply.
- **Exactly one answer:** random knotted 4–9-crossing diagrams usually have 3–4 crossings that
  unknot when switched. Of 400: 0 such crossings in 14, 1 in 7, 2 in 20, 3 in 209, 4 in 111, 5 in
  25, 6 in 12, 7 in 2 [proto]. Most are trefoils with extra crossings, where every core crossing
  unknots. A 1-of-4 item (one unknotting crossing, three that leave a knot) was possible for 165 of
  400 (41 %).
- **Distractor sources:** crossings outside the core, and twist crossings of twist knots. Switching
  a clasp crossing unknots a twist knot, while switching a twist crossing removes two half-twists
  (5_2 becomes a trefoil, 6_1 a figure-eight) [standard result, unverified here]. These make
  plausible wrong options.
- **Local tell:** "the switch that creates the most visible R1/R2 moves" finds the key about 55 % of
  the time (chance 25 %) [proto]. Mitigation (DJ): choose distractors whose switches also create a
  removable loop that then still leaves a knot, and include keys whose switch shows no visible move
  until an R3 slide.
- **Related formats:** the tie direction is a solo version of Henrich et al.'s knotting game. Region
  crossing changes (Shimizu 2014) are a different unknotting operation.

### 3.3 C. Link: "Are these loops linked?"

- **Stimulus:** two closed loops, each unknotted on its own: can they be pulled apart? A
  sub-variant shows an open rope through a fixed ring or handle: "Pull the ends: does the rope come
  free of the ring?"
- **Parity tell (sound):** the linking number lk ≡ (number of crossings where A passes over B)
  mod 2, so "odd ⇒ linked" is always right. If a fraction f of the linked items have an odd count,
  the parity solver scores 50 + 50f %. Staying within chance + 10 needs f ≤ 0.2 (DJ arithmetic).
  Most linked items then need lk = ±2 (double clasps) or lk = 0 (Whitehead-type links). The variant
  gets hard quickly, so it suits higher levels (DJ).
- **Other tells:** "one loop wholly on top ⇒ unlinked" is sound, so unlinked items must not be
  layered. The number of crossings between the loops must be matched between classes.
- **Three-ring version** ("Which ring holds the others together?"): cutting the middle ring of a
  chain A–B–C frees the rest, which is exactly one answer. In the Borromean rings any ring works, so
  they only fit mixed configurations. Verification uses sublink split certificates plus lk or Jones
  (§4.7). Later.

### 3.4 D. Mirror: "Same knot or its mirror?" (3D)

- **Stimulus:** a chiral knot (3_1, 5_1, 5_2, 6_1, 6_2, 7_x) drawn as a 3D tube. Options: the same
  knot turned and gently deformed, two or three mirror images, and possibly another knot of equal
  crossing number.
- **Design borrowed from Rotate:** a mirror option is the reflection of a correctly turned copy, so
  silhouettes have the same distribution and only the handedness of crossings differs.
- **Shortcuts:** a minimal trefoil has writhe ±3, so "majority crossing handedness" predicts
  chirality. Balance it with opposite-sign curls (R1) and deformations (DJ).
- **Excluded targets:** amphichiral knots (4_1, 6_3, 8_3, 8_9, 8_12, 8_17, 8_18 among ≤ 8 crossings
  [unverified list]). Chiral knots whose Jones polynomial cannot see the mirror (9_42, 10_71;
  Ramadevi 2011) fail the V(t) ≠ V(1/t) check automatically.
- **Overlap:** Rotate (EX-02) already trains rotation with mirror foils. Mirror adds deformation,
  topological rather than rigid sameness. Keep it experimental until data show it is more than a
  harder Rotate.

### 3.5 Why not E–J now

- **E Tuck:** four overlapping routes on one rope are hard to read at 320 px, and four thumbnails
  make the rope tiny. Revisit with a step-through UI.
- **F Steps:** the KRT's backwards-reasoning format, including its "one crossing switched" foils, is
  too close to a published test, and the thumbnails are complex.
- **G Name:** memorising a catalogue (trefoil, figure-eight, 5_1, …) is partly verbal, and the
  crossings left after simplification give the answer away.
- **H Hang** (Demaine et al., 2014 [abstract]): picture-hanging puzzles. In my reading of the model
  (DJ), the picture falls exactly when the rope's free-group word becomes trivial once the removed
  nail's generator is deleted. Verification (free reduction) and phone fit are excellent, but it is
  rope-around-pegs reasoning, not knots: a separate later exercise.
- **I Trace:** spatial scanning (SS), not Vz. Use it as the first tutorial step.
- **J Turn over:** as a stand-alone 2D item, the key shares the reflected drawing with one foil and
  the switched crossings with another, so it is the option "most like the others" (DJ) and
  stem-blind solvers win. Fold it into D, with 3D tubes.

## 4. The mathematics of generation and verification

### 4.1 Diagram encodings

- **PD code** (planar diagram): one tuple per crossing, X[a,b,c,d], listing edge labels
  counterclockwise from the incoming under-strand. This is the convention of KnotTheory`, the Knot
  Atlas and KnotInfo; the Knot Atlas gives 10_132 as "X4251 X8493 X5,12,6,13 …" [record]. A PD code
  fixes the oriented diagram on the sphere, chirality included.
  - The prototype computes the bracket with the A-smoothing of X[a,b,c,d] joining (a,b) and (c,d),
    and the B-smoothing joining (a,d) and (b,c). It reproduced the left-handed trefoil
    (V = −t⁻⁴ + t⁻³ + t⁻¹), the figure-eight (V = t⁻² − t⁻¹ + 1 − t + t²) and 7_4 (det 15)
    [proto].
- **Gauss code:** the crossing labels in traversal order with over/under marks (trefoil:
  O1 U2 O3 U1 O2 U3). A signed (extended) code adds each crossing's handedness. Without signs a
  Gauss code does not fix the knot (KnotGym calls Gauss codes "necessary but not sufficient"), and
  not every Gauss code can be drawn in the plane (virtual knots).
- **DT code** (Dowker–Thistlethwaite): number the 2n passages 1…2n along the knot. Each crossing
  pairs an odd and an even number; list the even partners of 1, 3, …, 2n−1, signed for over/under
  (10_132: "4 8 −12 2 −16 −6 −20 −18 −10 −14" [record]). It is compact and fixes prime diagrams up
  to reflection, but composite diagrams are ambiguous and the mirror depends on convention
  (Dowker & Thistlethwaite 1983 [unverified details]).
- **Recommendation (DJ):**
  - The item's truth is its **geometry**: the curve as integer control points of a closed (or open)
    spline, plus one over flag per crossing in parameter order.
  - The validator re-derives the crossings from the geometry and builds the PD code. PD is the
    working form for invariants and moves; DT and Gauss codes serve logs and tests.
  - A spline through integer control points evaluated with + − × ÷ keeps items bit-identical across
    engines (EXERCISE-GUIDE §4). Fourier curves need sin/cos at runtime: use literal tables, as
    Rotate does with `TRIG10`.

### 4.2 Random generation

| Method | How | For Parallax | Against |
|---|---|---|---|
| Random smooth shadow + crossing choice | Random closed planar curve (spline or short Fourier series); self-intersections are crossings; choose over/under per crossing | One shadow gives both a knot and an unknot, so crossing count tells nothing; the geometry is the display | Few crossings: of 1200 accepted Fourier shadows of 4–10 crossings (2.7 % acceptance), 780 had 4, 280 had 5, 104 had 6, 29 had 7, 4 had 8 and 3 had 9 [proto]; needs a better source for 8–12 |
| Braid closures | Random word in B_3 or B_4, closure drawn in lanes | Regular, legible, any crossing count; balanced classes: unknots 52 % at 6 crossings, 30 % at 12 [proto] | Schematic look; alternation still tells (75–92 %); 4–15 % need R3 or Jones [proto] |
| Uniform random diagrams (Cantarella, Chapman & Mastin 2016) | All diagrams with n crossings | Exact knot probabilities for n ≤ 10 | 78 % of 10-crossing diagrams are unknots, mostly tree-like (all crossings nugatory) [abstract]; nugatory crossings are trivial to see, so filter them |
| Grid diagrams (arc presentations; Cromwell 1995 [unverified]) | Two random permutations of size n; vertical over horizontal | Every knot has one; orthogonal and very legible; unknots recognisable by Dynnikov's monotone simplification (2006 [abstract]) | The fixed over/under rule removes the over/under reading; small n gives mostly unknots |
| Random 3D polygons or Fourier knots | Random walk or Fourier coefficients in 3D, then project | Natural tube shapes | Short polygons are rarely knotted (unknot decay length N₀ ≈ 259 edges, Xiong et al. 2021 [full]); cluttered projections; uncontrolled knot types |
| Petal diagrams (Adams et al. [unverified]; Petaluma, Even-Zohar et al. 2016) | Permutation of 2n+1 petal heights at one multi-crossing | Elegant uniform model (Even-Zohar survey [full]) | Unreadable: all strands cross at one point; not for display |
| Chebyshev or billiard diagrams (Koseleff & Pecker; Cohen & Krishnan 2015 [unverified]) | Lissajous-type shadow with random crossings | Regular lattice of crossings | Narrow shadow family; the (a,1) Lissajous shadows gave only unknots [proto] |
| Known knot + random Reidemeister moves (Browne 2025; KnotGym) | Scramble a catalogue diagram | Knot type and simplification depth known by construction | Each new diagram needs a layout, unless the moves are done on the geometry (preferred, DJ) |

**Recommended generation (DJ):**

- **A and B:** smooth spline shadows for 3–8 crossings, and "rope drop" or braid-closure-like
  shadows for 8–12. Choose crossing assignments by rejection, with class and feature matching.
  Geometric scrambles set the simplification depth: add a curl (R1), push a loop over or under a
  strand (R2), slide a strand over a crossing (R3).
- **C:** two unknotted loops built as clasps, double clasps or Whitehead-type patterns, then
  scrambled geometrically.
- **D:** catalogue knots lifted to 3D from their minimal diagrams (z = ±h at crossings, smoothed),
  then turned and deformed.

### 4.3 Invariants: cost at about 12 crossings, and what each can prove

| Invariant | Cost | Proves | Cannot prove |
|---|---|---|---|
| Crossing count; equality of Gauss or PD codes | O(n) | The diagrams are identical | Knot equivalence |
| Linking number, lk = ½ Σ signs of the crossings between two components | O(n) | Linked, if lk ≠ 0 | Links with lk = 0 (Whitehead link, Borromean rings) |
| Fox colourings; tricolourability (3 divides det) | O(n³), rank mod p | Knotted, if tricolourable | Many knots are not tricolourable (4_1 det 5, 5_1 det 5) |
| Determinant det = abs(Δ(−1)) = abs(V(−1)), from the colouring matrix (fraction-free elimination) | O(n³), about 0.05 ms; matched abs(V(−1)) on all 600 checked [proto] | Knotted, if det ≠ 1 | Knots with det 1: 10_124 = T(3,5) (Δ_T(3,5)(−1) = 1 by the torus-knot formula); knots with Δ = 1 |
| Alexander polynomial Δ(t) | O(n³) polynomial arithmetic, under 1 ms (DJ estimate) | Knotted, if Δ ≠ 1; separates many knots | Knots with Δ = 1 (Conway 11n34, Kinoshita–Terasaka 11n42 [unverified]); mirror images (Δ is symmetric); 5_1 vs 10_132 [record: Knot Atlas] |
| Kauffman bracket, hence the Jones polynomial V(t), by a 2ⁿ-state sum | 0.5 ms (8 crossings), 1.6–3 ms (10), 6–12 ms (12), 52 ms (14), 246 ms (16) in Node [proto]; #P-hard in general (Jaeger, Vertigan & Welsh 1990 [unverified]) | Knotted, if V ≠ 1. **Unknotted, if V = 1 and the diagram has ≤ 24 crossings** (Tuzun & Sikora). Chiral, if V(t) ≠ V(1/t) | Unknots beyond 24 crossings (the Jones unknot conjecture is open); unlinks (non-trivial links with the unlink's Jones polynomial exist: Thistlethwaite 2001; Eliahou, Kauffman & Thistlethwaite 2003 [unverified]); chirality of 9_42 and 10_71 |
| Signature σ (Goeritz matrix with the Gordon–Litherland correction [unverified details]) | O(n³) | Chiral and knotted, if σ ≠ 0 | Knots with σ = 0 (4_1, 6_1, …) |
| HOMFLY-PT polynomial | Exponential, heavier than Jones | More identity and chirality power | Not needed; also blind to 9_42 and 10_71 |
| Khovanov homology | Heavy (Bar-Natan 2007 [secondary]) | Detects the unknot (Kronheimer & Mrowka 2011 [abstract]) and unlinks (Hedden & Ni 2013 [unverified]) | Too heavy for a 20 ms budget in a browser (DJ) |
| Simplification certificate: a sequence of R1/R2/R3 moves to 0 crossings, or to a split diagram | Greedy R1/R2: 0.05–0.2 ms [proto] | Unknot or unlink, constructively; doubles as the show-me script | Hard unknots that need crossings added first (Culprit, 10 crossings; Goeritz, 11) |

**Identifying knots with the Jones polynomial:**

- Within each crossing number up to 9, no two prime knots share a Jones polynomial. At 10
  crossings, 13 polynomials are shared by two knots each, out of 249 knots (Maguire 2024 [full:
  slides], prime knots, apparently counted up to mirror image).
- Across crossing numbers there are collisions: 4_1 with K11n19 (Maguire), and 5_1 with 10_132,
  which also share the Alexander polynomial [record: Knot Atlas].

### 4.4 Unknot detection: where it stands in 2026

- **Jones unknot conjecture: open, verified to 24 crossings.**
  - Tuzun & Sikora (arXiv 2003.06724, Theorem 1 [full]) state: "The Jones polynomial distinguishes
    all non-trivial knots with diagrams up to 24 crossings from the unknot." The 22-crossing version
    appeared in J. Knot Theory Ramifications 27 (2018) [secondary].
  - Their pipeline computes cheap determinants first, brackets only for diagrams with det 1, then
    settles candidates with SnapPy group presentations and Dynnikov's algorithm. Parallax's cheap
    route has the same shape.
  - **For Parallax:** any diagram with at most 24 crossings and V = 1 is the unknot.
- **Links:** two-component links with the unlink's Jones polynomial exist (Thistlethwaite 2001;
  Eliahou, Kauffman & Thistlethwaite 2003 [unverified]). There is no Jones-based unlink certificate,
  so separation must be constructive.
- **Khovanov homology detects the unknot:** "a knot is the unknot if and only if its reduced
  Khovanov cohomology has rank 1" (Kronheimer & Mrowka 2011 [abstract]).
- **Complexity.**
  - Unknot recognition is in NP (Hass, Lagarias & Pippenger 1999) and in co-NP (Kuperberg 2014,
    assuming GRH; Lackenby 2021, unconditionally) [secondary: Wikipedia].
  - Lackenby's 2021 quasi-polynomial algorithm had not appeared in peer-reviewed form by October
    2025 [secondary]. Lackenby (2026, arXiv 2607.23350 [full, first part]) gives a new
    hierarchy-based unknot algorithm; the part read states no running time.
  - Every unknot diagram simplifies in a polynomial number of Reidemeister moves (Lackenby 2015,
    *Annals* [secondary]). Arc presentations of the unknot simplify monotonically (Dynnikov 2006
    [abstract]).
- **Hard unknot diagrams** need crossings added before they will simplify (Burton et al., "Hard
  diagrams of the unknot", arXiv 2104.14076 [full]):
  - the Culprit (10 crossings) and Goeritz's diagram (11 crossings) need one extra crossing on the
    sphere;
  - a 28-crossing diagram needs three.
  - Reinforcement learning has been applied to hard unknots and unknotting numbers (Applebaum et al.
    2024 [record]).
- **Consequences (DJ):** a greedy simplifier cannot certify every unknot, even at 10 crossings, so
  the Jones fallback matters. "Needs a detour" is a legitimate top difficulty level, very hard for
  people too.

### 4.5 Chirality

- The mirror image has V(1/t). If V(t) ≠ V(1/t), the knot is chiral and a mirror distractor is
  certified different. The Alexander polynomial and the determinant cannot see mirrors. The
  signature changes sign under mirroring, so σ ≠ 0 also proves chirality.
- Amphichiral knots up to 8 crossings: 4_1, 6_3, 8_3, 8_9, 8_12, 8_17, 8_18 [unverified; a node
  test can compare with KnotInfo's symmetry types].
- Chiral knots whose chirality the Jones, HOMFLY-PT and Kauffman polynomials miss: 9_42 and 10_71
  (Ramadevi 2011 [full]). Other lists add 10_48, 10_91, 10_104 and 10_125 for HOMFLY-PT
  [unverified].
- **Parallax rule (DJ):** a mirror distractor is allowed only when V(t) ≠ V(1/t) is checked for that
  item, so no hand-made lists are needed. Items stay unoriented (no arrows); then invertibility
  (8_17 is the first non-invertible knot [unverified]) does not matter.

### 4.6 Proving that two diagrams show the same knot (D, G)

- Invariants can only prove a **difference**. Sameness needs a construction:
  - **In 2D:** an explicit Reidemeister-move path, checked by replaying it.
  - **In 3D (DJ):** a discrete isotopy check. Interpolate the control points from the target to the
    option in K steps. At every step, non-adjacent segments must stay at least d_min apart, and no
    point may move more than d_min/2 per step. Then no strand can pass through another.
- **Alternative:** an invariant-complete catalogue. Once a certificate shows a diagram simplifies to
  ≤ 9 crossings, the Jones polynomial identifies its type within that crossing number (§4.3).
  Collisions across crossing numbers below 10 were not seen in the sources read but are not ruled
  out [gap]. Cross-check with signature, determinant and Alexander polynomial, or prefer the
  construction.
- Minimal diagrams of an alternating knot are related by flypes (Menasco & Thistlethwaite 1993
  [unverified]), so comparing minimal diagrams directly would need the flype closure. The
  construction avoids this.

### 4.7 A verification pipeline that guarantees one right answer

**Common steps** (validator, independent of the generator's bookkeeping):

1. Re-derive the crossings from the stored geometry and reject degenerate geometry. Only the over
   flags are read from the item.
2. Run the legibility checks of §5.3.
3. Build the PD code and classify by the cheap route:
   - greedy R1/R2 (+ a bounded R3 search) down to 0 crossings ⇒ unknot, with the certificate kept
     for show me;
   - else det ≠ 1 ⇒ knot;
   - else compute Jones on the simplified diagram (≤ 24 crossings): V = 1 ⇒ unknot, otherwise knot.

   In the prototype the cheap route took 0.05–0.2 ms and left 4–15 % of braid-closure diagrams
   (6–12 crossings) for the Jones step. It never contradicted the Jones polynomial in 600 checks,
   but those 600 were all on easy shadows where every diagram was an unknot, so the agreement check
   must be repeated on the real generator's pools [proto].

**Per item type:**

- **A Pull:** the key is knot or unknot. The validator checks that both ends lie on the outer face
  and leave the plate, and records the balance features for the tests.
- **B Untie / Tie:** classify the base diagram (a knot for untie, an unknot for tie). Switch each of
  the four marked crossings and classify the result: exactly one option must change the class.
  - Tags must be at least 44 px apart and all four crossings visible.
  - Exclude **nugatory** crossings (removing them splits the diagram in two). Switching one never
    changes the knot, and that is obvious, so they are the "structural distractors" Rotate also
    excludes (DJ).
- **C Link:**
  - each component must be unknotted (Jones = 1 per component);
  - **linked** ⇐ lk ≠ 0, or V(L) ≠ −(t^½ + t^−½), the Jones polynomial of the two-component unlink;
  - **unlinked** ⇐ a split certificate: moves until no crossing joins the two components;
  - reject the item if neither proof is found.
- **D Mirror:**
  - the target is chiral (V(t) ≠ V(1/t));
  - the key passes the discrete isotopy check from the target, with V(key) = V(target) as a
    cross-check;
  - mirror options have V(t) replaced by V(1/t);
  - other-knot options have a V unlike both;
  - the projected 3D view passes the checks of §5.3.
- **All:** node tests run ≥ 10 000 seeds per variant (standing rule 4), plus the shortcut solvers
  of §7.4.

### 4.8 The prototype

- **Scope:** throwaway code in the session scratchpad (`r2/`), not app code, written to check
  feasibility and measure shortcut risks.
  - `knotlib.mjs`: crossings from a polyline, the PD code, the bracket and Jones polynomial, the
    colouring determinant, cheap features.
  - `simplify.mjs`: faces of the diagram and greedy R1/R2 simplification.
  - `experiment*.mjs`: the measurements below.
- **Checks against known values:** the left-handed trefoil (det 3), the figure-eight (det 5, with a
  palindromic V), and a Lissajous (3,2,7) curve that came out as 7_4 (det 15). Switching one trefoil
  crossing gives V = 1. The greedy simplifier leaves the trefoil at 3 crossings and undoes the
  one-switch trefoil with one R2 and one R1.
- **Unknot fraction under random crossing choices.**
  - Smooth Fourier shadows: 3 crossings .946, 4 .866, 5 .809, 6 .719, 7 .649, 8 .576 (24 shadows),
    9 .55 (5 shadows).
  - Braid closures: 6 .52, 7 .60, 8 .46, 9 .42, 10 .39, 11 .31, 12 .30.
- **Greedy R1/R2 simplification:** it fully undid 99.5 % of the same-shadow unknots and 93.0 % of
  the matched-pair unknots (4–9 crossings), and never emptied a knot, as it must not. Most small
  random unknots are visibly simplifiable; R3 slides and detours are needed for a minority, which is
  a natural top difficulty level.
- **Caveats:** the pools are small and mostly 4–6 crossings; braid closures and higher crossing
  counts need a proper run with ≥ 2 000 items per level once the real generator exists.
  Sampling 64 assignments per shadow, as the matched pools did, costs about 64 × 0.1 ms with the
  cheap route. That fits the 20 ms budget, but the Fourier shadow search (2.7 % acceptance at
  O(M²) intersection tests) does not without spatial hashing or a constructive shadow source.

## 5. Rendering

### 5.1 2D diagrams or 3D tubes?

| | 2D rope diagram (SVG, `PX.core.svg`) | 3D tube (three.js, `stage3d`) |
|---|---|---|
| Over/under | Explicit: casing/gap at every crossing, the knot-diagram convention | Occlusion and shading; ambiguous where tubes nearly touch or at shallow depth gaps |
| Legibility at 320 px | High with the rules below | Medium: tube radius and lighting decide; thumbnails need snapshots |
| Cost | Trivial; no WebGL | One shared context; snapshots 7–21 ms in software rendering (EXERCISE-GUIDE §6) |
| Validator | Same geometry as the display | Must project the curve with the display camera and re-check every crossing |
| Animation | Easy morphs of control points; exact moves | Physics relaxation is approximate (§5.4) |
| Fit | A, B, C | D, the tutorial's "pull tight" demo, an optional tube look for A |

**Choice (DJ):** 2D for A–C, 3D only for D and demos. Croom & Firestone's medium manipulation did
not rescue strength judgements, and KRT items are photos, so no study says 3D helps topological
judgements [gap]. 2D is cheaper, exact and phone-safe. A "tube look" for A can be a later variant
once data exist.

### 5.2 Legibility on phones: a validator spec (DJ, for a 320 CSS px plate)

- **Size:** the plate is at least 320 × 320 CSS px (a 360 px phone minus 16 px gutters). The same
  item serves phones and desktops; desktops only scale up.
- **Rope:** stroke 7–9 px with round caps. A background-coloured casing of 3–4 px on each side of
  the over-strand, near crossings, makes the under-strand gap. This is Browne's (2025) "bordered"
  style; he notes bordered and hatched styles strengthen the "2.5D over/under effect".
- **Gap geometry:** Finke & Weitz (2024) [full] give the length of the doubly drawn piece as
  l = (w_s + w_g)·tan α + w_s·sec α, where w_s is the stroke width, w_g the gap width and α the
  deviation from a right angle. l grows without bound as α → 90°, which is another reason to cap
  crossing angles.
- **Crossing angle:** ≥ 35° (≥ 30° accepted in the prototype). Shallow crossings read as touching
  strands.
- **Spacing:**
  - crossing to crossing: ≥ 36 px (11 % of the plate), and ≥ 44 px between crossings that carry
    answer tags;
  - non-adjacent strands, away from crossings: ≥ 18 px;
  - radius of curvature: ≥ 10 px.
  Strand spacing is also a difficulty dimension, since tracing slows near distractor curves (§1.1),
  so the "tight" level sits at the lower bounds.
- **Crossing count:** at most 12 at 320 px, decided by validator checks rather than by fiat. More
  than 12 seldom fits the spacing rules at this size (DJ estimate; to be checked in phone
  screenshots).
- **Ends:** both run off the plate edge with a small "pull" arrow. Neither end may be crossed near
  the edge.
- **Tags (B, D):** letters A–D in ≥ 28 px circles beside the crossing, with a short leader line; the
  answer goes through the option grid (≥ 44 px buttons). Tapping a tag also answers.
- **3D tubes:**
  - tube radius 1.6–2 % of the figure's diameter and ≥ 5 px on screen;
  - in projection, crossing angle ≥ 35° and depth gap ≥ 3 tube radii at every crossing;
  - an inverted-hull outline in the background colour gives every occlusion a visible rim, the 3D
    equivalent of the 2D casing;
  - key and fill lights, and mild depth fog (`Fog` is in the vendored subset).

### 5.3 Showing over and under unambiguously (DJ)

- The cue is **geometric**: the casing/gap at every crossing, never colour alone (standing rule 8).
  An optional colour gradient along the rope, using theme tokens and a colour-vision-safe sequential
  ramp, only helps tracing; items must be solvable without it.
- Browne (2025) notes rainbow scales are "problematic for scientific visualisation" but help players
  tell parts of the path apart.
- The validator re-checks the drawn geometry: every crossing has its gap, no gap hides another
  crossing, and no third strand passes within 2 stroke widths of a crossing (no near-triple points).
- **Light and dark themes:** the casing uses the plate's background token, so it adapts to both.
  Screenshot checks belong in the e2e test.
- **Reveal:** "✓ Knot: over, under, over all the way round" / "✓ No knot: these loops slide off",
  with the deciding crossings ringed (shape and colour).

### 5.4 Animation: pulling and untangling ("show me")

- **Primary (DJ): replay the certificate in 2D.** The validator's simplification certificate
  (R1/R2/R3 moves) is the model that graded the answer (EXERCISE-GUIDE §3, `lib`). Each move morphs
  the control points:
  - **R1 untwist:** shrink the curl into its crossing.
  - **R2 slide off:** push the over-arc across the under-arc until both crossings vanish.
  - **R3 slide over:** move a strand across a crossing.

  Each move runs 1.2–2 s (the guide asks 2–4 s per solution movement), with captions such as "This
  loop lies on top: lift it off." For a knot, the replay stops at the reduced core and a final step
  pulls it tight. Tests re-derive the crossings every few frames to confirm that only the planned
  crossings appear and disappear. Reduced motion uses keyframes about 400 ms apart (≤ 2.5 Hz).
- **Secondary: 3D "pull the ends" relaxation, for the tutorial demo.** A bead–spring rope (about
  150 beads) with repulsion between non-adjacent beads; the ends are pulled apart and the rope
  straightens (unknot) or tightens into a small knot. The risk is a numerical strand passage, which
  would teach something false. Mitigations (DJ):
  - cap each bead's step below a quarter of the bead spacing and keep a minimum distance;
  - precompute from fixed seeds and test the knot type at checkpoints (Jones of the projection);
  - never run it during a stimulus phase (standing rule 7).
  KnotPlot does such relaxations, but it is proprietary. A known tightening algorithm (SONO,
  Pieranski 1998) was not checked [unverified].

### 5.5 three.js notes

- **Neither `TubeGeometry` nor `CatmullRomCurve3` is exported by Parallax's vendored subset.** I
  loaded `vendor/three.min.js` in Node: `THREE.TubeGeometry`, `THREE.CatmullRomCurve3` and
  `THREE.Curve` are all undefined. The curve classes exist inside the bundle only as internals.
  Adding `'TubeGeometry'` and `'CatmullRomCurve3'` to CORE in `tools/vendor-three.mjs`, then
  `npm run vendor`, fixes it; three.js is MIT. Alternatively, build the tube by hand into a
  `BufferGeometry` with parallel-transport frames, which needs no new exports and keeps the
  geometry bit-identical to the validator's spline.
- `TubeGeometry(path, tubularSegments, radius, radialSegments, closed)` [record: three.js docs].
  `closed = true` with a closed `CatmullRomCurve3` (centripetal by default) makes the loop.
  three.js spreads the frame twist over the loop so no seam shows [unverified detail; from general
  knowledge, not the docs page].
- **Budget (DJ):** about 300 tubular × 12 radial segments is ≈ 7 k triangles per knot, so four
  option thumbnails are easily affordable. Use the one shared renderer, take thumbnails with
  `stage3d.snapshot` in `drawOption` (ready phase), and do nothing heavy after `present`.

## 6. Licences of code and data

Parallax may not use GPL, AGPL or non-commercial code or assets. It may reimplement published
algorithms.

| Resource | What it is | Terms found | Use in Parallax |
|---|---|---|---|
| KnotInfo (Livingston & Moore) | Tables of knot invariants | No licence on its About page, only "please remember to cite KnotInfo" [record] | Do not ship its tables. Optionally use values as cross-checks in node tests, with citation |
| `database_knotinfo` (PyPI, Oehms) | KnotInfo and LinkInfo as Python lists | "GPL" [record] | No |
| The Knot Atlas (Bar-Natan, Morrison) | Wiki with PD and DT codes, invariants, pictures | No licence on the pages read. Bar-Natan's copyleft notice lets anyone reproduce material he holds copyright to, but not others' work. Knot pictures are captioned "KnotPlot image" [record] | No pictures. Codes only as test facts, with citation |
| KnotTheory` (Mathematica) | Bar-Natan's package | Not checked [gap] | No (Mathematica in any case) |
| SnapPy / Spherogram | Python topology software | GPLv2+ [record: PyPI] | No |
| Regina | Low-dimensional topology software | GPLv2+ [record] | No |
| KnotFolio (Miller) | Draw and identify knots | GPL-2.0 or later [record: GitHub] | No |
| Topoly | Polymer topology toolkit | "Free for non-commercial use" [record: PyPI] | No |
| pyknotid (Taylor et al.) | Knot identification in Python | No licence stated on the docs or PyPI pages read; believed MIT [unverified] | Not needed |
| KnotPlot (Scharein) | Knot visualiser and relaxer | Proprietary; paid key; hosting its files forbidden [record] | No |
| KnotGym (Chen & Artzi) | RL environment | MIT [full] | Ideas; code with notice if ever needed |
| Knottingham (Finke & Weitz) | Interactive diagram editor | MIT [full] | Ideas, e.g. gap geometry |
| three.js (`TubeGeometry`, `CatmullRomCurve3`) | 3D library | MIT | Yes: add both to the vendored subset, or build tubes by hand |
| KRT materials (OSF) | Photos and items | Article CC BY 4.0; materials' licence not checked; photos derived from Grog's knots | Never copy items or photos |
| Animated Knots by Grog; Rolfsen-table drawings | Photos and figures | Copyrighted | No; draw our own |

**What to reimplement**, all short and all from published mathematics:

- PD conventions and crossing detection;
- the Kauffman bracket and Jones normalisation (Kauffman 1987);
- the Fox-colouring determinant;
- the Alexander matrix, if needed;
- the linking number;
- the Goeritz matrix and signature, if needed;
- the greedy R1/R2 simplifier plus a bounded R3 search;
- the curve rendering.

Mathematical facts such as "V(3_1) = …" are not copyrightable. The EU sui generis database right
might cover substantial extracts of a table, which is one more reason not to ship extracted tables
(DJ, not legal advice).

## 7. Recommendation for Parallax

### 7.1 Item types, ranked: one exercise, "Knots" (EX-12), with variants

1. **pull**: "Pull both ends: does a knot remain?" (yes/no, chance .5). The core deknotting item:
   cleanest verification, best phone fit, and the prototype shows its shortcuts can be neutralised.
2. **untie**: "Which marked crossing, switched, unties it?", with the knotting counterpart **tie**:
   "Which marked crossing, switched, ties a knot?" (choice of 4, chance .25). Causal reasoning about
   one crossing; exact verification.
3. **link**: "Are these loops linked?" (yes/no; sub-variant: rope through a ring). Easy to verify,
   hard to keep counting-proof (§7.4), so it suits higher levels or may be deferred.
4. **mirror** (experimental, later): "Same knot or its mirror?" with 3D tubes. Run it as an
   experimental variant once the 2D variants have data. It needs `TubeGeometry` and the discrete
   isotopy check.

All variants share one rating (ENGINE). Definition sketch (DJ), filling in EXERCISE-GUIDE §3:

```js
PX.ex.define({
  id: 'knots', version: 1, code: 'EX-12', name: 'Knots', short: 'Knots',
  abilities: ['Vz'], cell: 'intrinsic-dynamic', role: 'train',
  answer: 'yesno', answers: { pull: 'yesno', untie: 'choice', link: 'yesno' },
  variants: ['pull', 'untie', 'link'],
  chance: function (p) { return p.variant === 'untie' ? 0.25 : 0.5; },
  dims: [
    // one ladder couples crossing count and untangling depth, because many pairs cannot exist
    // (no 3-crossing unknot needs a slide-over; detours need about 10 crossings), and the engine
    // has no feasibility mechanism: every params combination must generate
    { key: 'rope', label: 'Rope', levels: ['3', '4', '5', '6', '6 slide-over', '7', '8 slide-over',
      '9 slide-over', '10 slide-over', '11–12 detour'], step: 0.40 },
    { key: 'spacing', label: 'Spacing', levels: ['open', 'close', 'tight'], step: 0.25 },
  ],
  base: -1.75,   // pull: ≈ 90 % at θ = 0 with g = .5 and lapse .03 (P = .5 + .47·σ(1.75) ≈ .90)
  // generate, validate, score, lib (geometry, PD, invariants, simplifier, certificate → show me)
});
```

### 7.2 Difficulty dimensions and why

| Dim | Levels | Step (logits) | Reason | Confidence |
|---|---|---|---|---|
| rope (crossings and untangling depth, one ladder) | 3, 4, 5, 6 crossings with visible moves (R1/R2 only); 6 with a slide-over (≥ 1 R3 first); 7; 8, 9, 10 with a slide-over; 11–12 with a detour (a move that adds a crossing, Culprit-like) | 0.40 per rung, 3.6 over the range | More rope to trace (tracing time grows with curve length, §1.1). More crossings also mean more possible simplifications and lower unknot base rates [proto]. KnotGym agents degrade sharply with crossings. Detours are hard by definition (hard unknots, §4.4). For knots, depth means the decoy loops to clear before the reduced core shows | Low: hand-set, no human data |
| spacing | open (non-adjacent strands ≥ 36 px apart at 320 px); close (≥ 24 px); tight (≥ 18 px) | 0.25 per level, 0.5 over the range | Tracing slows when other curves are near (Jolicoeur & Ingleton 1991; Jeurissen et al. 2016) | Low-medium (direction known, size unknown) |

- **Why one ladder:** crossing count and depth cannot be separate additive dims, because many
  pairs do not exist. No 3-crossing unknot needs a slide-over (the prototype's small unknots were
  R1/R2-simplifiable), and the smallest hard unknot diagrams in the sources have 10–11 crossings
  (§4.4). The engine has no feasibility mechanism, so every params combination must generate. The
  rungs where a slide-over first becomes possible (6 here) are a guess [unverified]: the node test
  that enumerates all combinations will show where they really start, and the ladder should follow.
- **Total range:** 4.1 logits, meeting the guide's ≥ 4.
- **Anchor:** KRT pulling items, photos of real knots answered untimed, were .81 correct (Study 1).
  With g = .5 and lapse .03 that is b ≈ −0.66 for an average adult, roughly the middle of the
  scale. This is only a sanity check: different medium, sample and timing.
- **Refit:** the steps must be refitted from the community's pooled research exports, as CLAUDE.md
  says of all hand-set difficulties.
- **Not dims** (DJ): rope look (flat or tube) stays a separate variant for later, because its
  direction is unknown. Tags, number of options and the tie/untie direction are fixed per variant.

### 7.3 Generation and verification (summary)

**Generate:**

1. Draw a shadow: a spline with integer control points, or a braid-like rope drop, with the right
   crossing count and spacing level, that passes the legibility spec (§5.2).
2. For **pull**: sample crossing assignments until there is one of the wanted class, matched to its
   partner item on alternation count, |writhe|, visible R1/R2 counts and monotone flags. Partners
   are drawn from the same shadow in the same generation stream. Open the rope on the outer face
   and run the ends off the plate.
3. Set the depth of the **rope** rung by geometric scrambles (curls, push-overs, slides), checked by the
   simplifier.
4. For **untie / tie**: choose the four tagged crossings (exactly one class-changing switch), with
   distractors matched on the "switch creates a visible move" feature.
5. For **link**: build clasps, double clasps or Whitehead patterns, or split pairs; scramble; and
   keep the parity of A-over-B crossings balanced (§7.4).
6. Retry up to 50 times with forked seeds, then fall back to a fixed-seed construction (EXERCISE-GUIDE
   §4).

**Validate** (independent): re-derive the crossings from the geometry, check legibility, classify
by the cheap route (certificate, then det, then Jones ≤ 24) per §4.7, and confirm exactly one
right answer. The certificate, recomputed by the validator, is stored in `lib` for show me.

### 7.4 Shortcut solvers for the node tests (each ≤ chance + 10 over ≥ 2 000 items)

- **pull** (best threshold): crossing count; alternation count (closed, and from each end);
  |writhe| and writhe sign; visible R1, visible R2 and their sum; number of bigon faces;
  monotone-from-either-end; rope length; bounding-box aspect.
  - The prototype says alternation, writhe and visible R2 need matching; the rest were near 50 %
    [proto].
- **untie / tie** (stem-based and stem-blind), per option:
  - Does the switch create a visible R1/R2 move? How does it change the alternation count?
  - Distance from the centre; crossing angle; whether the crossing sits in a twist region (an
    alternating bigon).
  - Stem-blind: odd one out by each feature; the option most like the others.
- **link:**
  - Unsigned parity of A-over-B crossings, a cheap and sound tell. At most 20 % of the linked items
    may have an odd count (§3.3).
  - Number of crossings between the loops; layered or not.
  - The **signed** count (the linking number) is also sound. Judging crossing handedness is a
    demanding spatial step, so treat it as an analytic strategy (like Rotate's), not a cheap
    heuristic, but report it in the tests. Decide with data whether to cap it (DJ). This is the
    main reason link ranks third.
- **mirror:** writhe sign; majority handedness; silhouette difference (zero by construction);
  crossing count; stem-blind odd one out and the most alike pair.

### 7.5 Tutorial: Watch, Try, Go (play-to-learn)

- **Watch** (demo, three steps):
  1. One crossing, labelled: "The gap shows which strand is underneath."
  2. **The minimal pair:** two ropes with the same shape and one crossing different. Show me pulls
     both: one falls open, the other ties tight. "Same shape, one crossing different: only the
     crossings decide."
  3. The three moves in plain words: **untwist** a curl (R1), **slide off** a loop that stays on top
     (R2), **slide over** a crossing (R3).
- **Try** (practice, not logged; easiest first):
  - pull, rope rung "3" (visible moves only), spacing open;
  - pull, rope rung "4", spacing open;
  - untie on a twist knot (5_2) with one clasp crossing and three twist crossings tagged. Switching
    the clasp unties it; switching a twist crossing leaves a trefoil (§3.2). This also teaches
    "clasp versus twist".
- **Go:** the first adaptive items.
- **Strategy cards** (two, as for every exercise):
  - **Picturing:** "Hold one end still and pull the other in your mind. Watch which loops slide off
    and which ones tighten."
  - **Step by step:** "Follow the rope from one end. Untwist curls. Slide off any loop where the same
    strand is on top at both crossings. Repeat. Nothing left: no knot. If what is left goes
    over-under-over all the way round, it is a knot." The last sentence is the reduced-alternating
    theorem (§3.1), so it is true.
  - **When to switch:** trace step by step when the picture is crowded (spacing "tight").
- **Tips** (just in time, once each):
  - "If, from one end, the rope is on top at every crossing it meets first, it falls apart."
    (Descending ropes.)
  - "A twist knot comes undone at its clasp, not at its twists."
  - "The rope is perfectly slippery and cannot pass through itself: real ropes can jam, these
    cannot."
- **Bridge (honest):** §1.7, with its limitation line beside it (standing rule 2).

### 7.6 Risks

| Risk | Evidence | Mitigation |
|---|---|---|
| Cheap tells decide items | Alternation 75–92 %, \|writhe\| 72 %, visible R2 90 % in naive pools; link parity is sound for odd counts [proto] | Matched pair sampling; node shortcut solvers per variant; restrict link |
| Analytic rules replace imagery (reduce then check alternation; descending; signed counting) | KRT: knot reasoning shares variance with MRT and PFT but is partly distinct | Accept as strategies, as Rotate does; record strategy-card use; probes measure transfer |
| Difficulty steps are guesses | No human data on diagram knots [gap] | Hand-set steps flagged; refit from pooled exports; start conservatively (3–8 crossings in v1.1) |
| Phone legibility at 10–12 crossings | Spacing rules; shadow acceptance falls with n [proto] | Validator spec §5.2; e2e phone screenshots; cap crossings by checks |
| CPU budget (20 ms p95) | Jones 6–12 ms at 12 crossings, 52 ms at 14; Fourier shadow search 2.7 % acceptance [proto] | Cheap route first; displayed diagrams ≤ 12 crossings; spatial hashing or constructive shadows; fallback item |
| A wrong key | Greedy simplifier misses hard unknots; Jones cannot certify unlinks | Jones fallback (≤ 24 crossings) for knots; constructive certificates for links; reject anything unproved |
| 3D over/under ambiguity; WebGL budget | Occlusion only; one context | Keep 3D to the experimental mirror variant; projection checks; snapshots in the ready phase |
| Test overlap | KRT pulling items, UCEED, Math Kangaroo | Count gains there as near transfer; never use the KRT as a probe |
| Honesty | No transfer evidence for knots | Bridge text; no tying, sailing or surgery claims |
| Licences | GPL and NC tools; KnotPlot images in the Knot Atlas | Reimplement; draw everything; cite facts |

## References

Reading levels as defined at the top. DOIs are given where seen; "[unverified]" marks details from
memory.

- Applebaum, T., Blackwell, S., Davies, A., Edlich, T., Juhász, A., Lackenby, M., Tomašev, N., & Zheng, D. (2024). The unknotting number, hard unknot diagrams, and reinforcement learning. arXiv:2409.09032. [record]
- Ayres, P., Marcus, N., Chan, C., & Qian, N. (2009). Learning hand manipulative tasks: When instructional animations are superior to equivalent static representations. *Computers in Human Behavior* 25 [volume/pages unverified]. [abstract]
- Bennett-Pierre, G., Shipley, T. F., Newcombe, N. S., & Gunderson, E. A. (2025). Developing a novel measure of non-rigid, ductile spatial skill. *Cognitive Research: Principles and Implications* 10:13. https://doi.org/10.1186/s41235-025-00621-w [full; appendices C–E not read]
- Brandt, M. G., & Davies, E. T. (2006). Visual-spatial ability, learning modality and surgical knot tying. *Canadian Journal of Surgery* 49(6), 412–416. [full]
- Browne, C. (2025). The Unknot Game. *Bridges 2025 Conference Proceedings*, 45–52 [pages inferred]. [full]
- Burton, B. A., Chang, H.-C., Löffler, M., de Mesmay, A., Maria, C., Schleimer, S., Sedgwick, E., & Spreer, J. Hard diagrams of the unknot. arXiv:2104.14076 (journal version c. 2023 [venue unverified]). [full]
- Cantarella, J., Chapman, H., & Mastin, M. (2016). Knot probabilities in random diagrams. *J. Phys. A* 49, 405001. https://doi.org/10.1088/1751-8113/49/40/405001 [abstract]
- Chen, Z., & Artzi, Y. (2025). Knot So Simple: A minimalistic environment for spatial reasoning (KnotGym). NeurIPS 2025 Datasets & Benchmarks; arXiv:2505.18028. [full]
- Croom, S., & Firestone, C. (2024). Tangled physics: Knots strain intuitive physical reasoning. *Open Mind* [volume/pages unverified]. [full: author manuscript]
- de Koning, B., Marcus, N., Brucker, B., & Ayres, P. (2019). Does observing hand actions in animations and static graphics differentially affect learning of hand-manipulative tasks? *Computers & Education* 141, 103636. https://doi.org/10.1016/j.compedu.2019.103636 [abstract]
- Demaine, E. D., Demaine, M. L., Minsky, Y. N., Mitchell, J. S. B., Rivest, R. L., & Pătraşcu, M. (2014). Picture-hanging puzzles. *Theory of Computing Systems* 54(4), 531–550. https://doi.org/10.1007/s00224-013-9501-0 [abstract]
- De Toffoli, S., & Giardino, V. (2014). Forms and roles of diagrams in knot theory. *Erkenntnis* 79(4), 829–842. [abstract]
- Diamantis, I. (2025). The VIBE framework: A student-centered approach to teaching knot theory in secondary mathematics. arXiv:2506.22886. [full]
- Dowker, C. H., & Thistlethwaite, M. B. (1983). Classification of knot projections. *Topology Appl.* 16 [unverified]. [not opened]
- Dynnikov, I. (2006). Arc-presentations of links: Monotonic simplification. *Fundamenta Mathematicae* 190 [secondary: Wikipedia]; arXiv:math/0208153. [abstract]
- Eliahou, S., Kauffman, L. H., & Thistlethwaite, M. B. (2003). Infinite families of links with trivial Jones polynomial. *Topology* 42 [unverified]. [not opened]
- Even-Zohar, C. Models of random knots (survey). [full]; Even-Zohar, Hass, Linial & Nowik (2016), Invariants of random knots and links, *Discrete Comput. Geom.* [unverified details]. [record]
- Finke, L., & Weitz, E. (2024). A phenomenological approach to interactive knot diagrams (Knottingham). arXiv:2309.00445. [full]
- Garland, T. B. (2012). *Mental rotation and learning procedural motor tasks from instructional media* (Master's thesis). Arizona State University. [full]
- Henrich, A., MacNaughton, N., Narayan, S., Pechenik, O., Silversmith, R., & Townsend, J. A midsummer knot's dream. arXiv:1003.4494 (*College Mathematics Journal*, 2011 [unverified]). [full]
- Jeurissen, D., Self, M. W., & Roelfsema, P. R. (2016). Serial grouping of 2D-image regions with object-based attention in humans. *eLife* 5, e14320. https://doi.org/10.7554/eLife.14320 [full]
- Jolicoeur, P., & Ingleton, M. (1991). Size invariance in curve tracing. *Memory & Cognition* 19(1), 21–36. https://doi.org/10.3758/BF03198493 [abstract]
- Jolicoeur, P., Ullman, S., & MacKay, M. (1986). Curve tracing: A possible basic operation in the perception of spatial relations. *Memory & Cognition* 14 [details unverified]. [secondary]
- Kalun, P., Dunn, K., Wagner, N., Pulakunta, T., & Sonnadara, R. (2020). Recent evidence on visual-spatial ability in surgical education: A scoping review. *Canadian Medical Education Journal* 11(6). https://doi.org/10.36834/cmej.69051 [abstract]
- Kauffman, L. H. (1987). State models and the Jones polynomial. *Topology* 26 [unverified]; Murasugi (1987) and Thistlethwaite (1987) on alternating diagrams [unverified]. [not opened; textbook results]
- Kronheimer, P. B., & Mrowka, T. S. (2011). Khovanov homology is an unknot-detector. *Publ. Math. IHÉS* 113, 97–208. https://doi.org/10.1007/s10240-010-0030-y [abstract]
- Lackenby, M. (2015). A polynomial upper bound on Reidemeister moves. *Annals of Mathematics* 182(2), 491–564. [secondary]; Lackenby (2021), The efficient certification of knottedness and Thurston norm, *Adv. Math.* [secondary]; Lackenby (2026), Incompressible surfaces, hierarchies and unknot recognition, arXiv:2607.23350. [full, first part]
- Maguire, R. (2024). Relative strengths of knot invariants by experiment (slides, Dartmouth). [full]
- McCormick, P. A., & Jolicoeur, P. (1991). Predicting the shape of distance functions in curve tracing: Evidence for a zoom lens operator. *Memory & Cognition* 19(5), 469–486. https://doi.org/10.3758/BF03199570 [abstract]
- Patil, V. P., Sandt, J. D., Kolle, M., & Dunkel, J. (2020). Topological mechanics of knots and tangles. *Science* 367(6473), 71–75. https://doi.org/10.1126/science.aaz0135 [full]
- Pooresmaeili, A., & Roelfsema, P. R. (2014). A growth-cone model for the spread of object-based attention during contour grouping. *Current Biology* [details unverified]. [secondary: Jeurissen et al.]
- Ramadevi, P. Detection of chirality and mutations of knots and links. arXiv:1107.2179 (2011). [full]
- Santos, P. E., Cabalar, P., & Casati, R. The knowledge of knots: An interdisciplinary literature review. *Spatial Cognition & Computation* (2019) [venue unverified]; 2020 draft. [full: draft]
- Schwan, S., & Riempp, R. (2004). The cognitive benefits of interactive videos: Learning to tie nautical knots. *Learning and Instruction* 14, 293–305. [record; secondary: Garland 2012]
- Shimizu, A. (2014). Region crossing change is an unknotting operation. *J. Math. Soc. Japan* [unverified details]; arXiv:1011.6304. [record]
- Tuzun, R. E., & Sikora, A. S. Verification of the Jones unknot conjecture up to 24 crossings. arXiv:2003.06724 [published venue unverified]; 22 crossings: *J. Knot Theory Ramifications* 27 (2018). [full: arXiv]
- Xiong, A., Taylor, A. J., Dennis, M. R., & Whittington, S. G. Knot probabilities in equilateral random polygons. arXiv:2108.07197 [venue unverified]. [full]
- Product and licence pages [record]: Tangle Master 3D (App Store); Knots 3D (App Store); Unknot! (Steam, app 3544020); Region Select (omu.ac.jp); KnotPlot download page; KnotInfo About page; `database_knotinfo` (PyPI); Spherogram (PyPI); Topoly 0.9.7 (PyPI); pyknotid (docs, PyPI); Regina homepage; KnotFolio (GitHub); Bar-Natan's Copyleft notice; Knot Atlas pages (10_132; Citing The Knot Atlas); three.js `TubeGeometry` docs; UCEED 2022 item (collegedunia); Math Kangaroo 2025 grade 3–4 item 3 (video solution page); Wikipedia: Unknotting problem; Wikipedia: The Knot Atlas.

## Flagged: papers a core decision rests on that I could not read in full

1. **Jolicoeur, Ullman & MacKay (1986)**, *Memory & Cognition* 14, curve tracing; expected DOI
   10.3758/BF03198373 [unverified]. **Needed:** the tracing rate and how it grows with curve length
   and strand proximity. **Decision:** the step sizes of the rope and spacing dims.
2. **Pooresmaeili & Roelfsema (2014)**, *Current Biology*, growth-cone model. **Needed:** the size of
   the slowing when curves are near. **Decision:** the spacing dim.
3. **Eliahou, Kauffman & Thistlethwaite (2003)**, *Topology* 42, and **Thistlethwaite (2001)**.
   **Needed:** the smallest crossing number of a non-trivial link whose Jones polynomial equals the
   unlink's. **Decision:** whether a Jones check could ever certify "unlinked" for ≤ 12 crossings.
   Current rule: never; use split certificates.
4. **Bennett-Pierre et al. (2025)**, https://doi.org/10.1186/s41235-025-00621-w: read except
   appendices C–E; OSF materials not opened. **Needed:** item-level difficulty of the pulling items,
   and the materials' licence. **Decision:** the base-difficulty anchor, and what must not be copied.
5. **Kalun et al. (2020)**, https://doi.org/10.36834/cmej.69051: abstract only. **Needed:** the
   knot-tying correlations. **Decision:** the wording of the bridge text and validity claims.
6. **de Koning et al. (2019)**, https://doi.org/10.1016/j.compedu.2019.103636: abstract only.
   **Needed:** the size of the spatial-ability × animation effect. **Decision:** show me as smooth
   animation versus stepped frames.
7. **Cantarella, Chapman & Mastin (2016)**, https://doi.org/10.1088/1751-8113/49/40/405001: abstract
   only. **Needed:** knot-type probabilities per crossing number on reduced diagrams.
   **Decision:** generator acceptance rates (the prototype partly covers this).
8. **Tuzun & Sikora**, arXiv:2003.06724: read on arXiv, but the published version was not checked.
   **Needed:** the venue and final wording. The arXiv theorem ("diagrams up to 24 crossings")
   already supports the "V = 1 ⇒ unknot for ≤ 24 crossings" rule.

## ACCESS: sources I could not open

- pmc.ncbi.nlm.nih.gov/articles/PMC11495958 (Croom & Firestone): reCAPTCHA. I read the author
  manuscript on PhilArchive instead.
- cmej.ca full text of Kalun et al. (2020): the permission request was not answered. Abstract read
  via DOAJ.
- link.springer.com/article/10.3758/BF03198373 (Jolicoeur, Ullman & MacKay 1986, by the DOI I
  expected): the permission request was not answered.
- link.springer.com/article/10.1007/s11251-009-9119-4 (an *Instructional Science* article from the
  knot-tying search; not identified): site error.
- elifesciences.org/articles/14320: needs JavaScript. Read the PDF instead.
- dblp.org record of Santos et al.: blocked by an anti-bot page, so the venue is unverified.
- cognitiveresearchjournal.springeropen.com (Bennett-Pierre et al.): the permission request was
  not answered. Read the PDF mirror at rcastoragev2.blob.core.windows.net instead.
- apps.apple.com, "Unknot: Trivialize the Loop": site error.
- Europe PMC REST API via curl: blocked by the session's proxy (403).
- Not attempted, for budget: the full texts of Ayres et al. (2009), Schwan & Riempp (2004),
  Pooresmaeili & Roelfsema (2014), Eliahou, Kauffman & Thistlethwaite (2003), Thistlethwaite
  (2001), Cantarella et al. (2016); pyknotid's licence file on GitHub; KnotTheory`'s licence; the
  KRT materials on OSF (https://osf.io/x9uqe/); Patil et al.'s supplement.
