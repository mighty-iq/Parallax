# R3. DAT Perceptual Ability Test (PAT) formats as training in Parallax

Research note for Parallax v1.1, brief item 4 ("implement dat pat questions as training"). Compiled 2026-11-13.
Question: what exactly are the PAT's six question types, and how should Parallax generate original items in
those formats, given the exercises it already has?

## 0. How to read this note

**Read levels** (given for every source in §11):
- **[F]** full text. The fetch tool processed the whole document and returned a model-written digest with
  short quotes in answer to targeted questions. It never returned the raw text, and it refused verbatim
  reproduction, so wording given here is a paraphrase unless it is in quotation marks. Figures and example
  diagrams inside PDFs were not visible.
- **[F-part]** part of the text only (the fetch stopped at a length limit).
- **[A]** abstract, or a publisher or repository summary only.
- **[S]** secondary report: what a named source says about the study.
- **[T]** title or metadata only.

**Tags:** (DJ) design judgement, not a research finding; [unverified] from prior knowledge or one weak source;
[gap] searched for but not found.

**Limits of this pass.**
- Direct downloads from ada.org are denied by this session's proxy (HTTP 403). The ADA PDFs were read
  through the fetch tool's digest, so their example diagrams were not seen.
- PubMed and PMC pages sit behind a reCAPTCHA, and Wiley returned errors. Several classic validity studies
  are therefore known only through a 2020 dissertation's literature review (§4.1).
- The shared web-search budget ran out late in the pass. Two planned searches, on PAT retest data and on how
  well prep practice tests predict real scores, were not run (§12).

## 1. Summary

- **The test.** The PAT is one of four DAT tests: 90 items, 60 minutes, six parts in a fixed order:
  Apertures, View Recognition, Angle Discrimination, Paper Folding, Cube Counting and Spatial Relations / 3D
  Form Development.
  - Prep sources agree on 15 items per part. The ADA documents read here do not state that.
  - Delivery is on computer at Prometric. Candidates get two noteboards; rulers and other measuring tools are
    banned.
  - Scoring uses 3PL IRT. Since 1 March 2025, scores are reported on a 200–600 scale in steps of 10 (the old
    scale was 1–30). There is no guessing penalty, and the PAT is not part of the Academic Average.
  - The 2026 Candidate Guide (updated 4 August 2026) shows no change to PAT content. The only DAT changes
    listed for 2022–2026 concern Biology (2022), scoring (2025) and Organic Chemistry (April 2026).
- **Validity.** The ADA's March 2026 validity study (38 schools) reports corrected correlations between the
  PAT and dental-school grades of .16–.36. The highest is .36, with Year 2 preclinical technique grades;
  uncorrected values are .11–.23. Independent single-school studies are mixed: weak to moderate prediction
  of preclinical lab grades, and little of clinical grades. PAT reliability is .90–.92.
- **Practice.** The ADA lists "not subject to practice effects" as a design principle, but publishes no
  retest-gain data. General meta-analyses find retest gains of about a third of an SD on a first retest, and
  larger gains with coaching or identical forms. No study was found that trained people on PAT formats and
  then measured the PAT against a control group [gap]. One pre-dental Sorby course raised PSVT:R scores,
  with no control group; PSVT:R correlated r = .50 with the PAT.
- **Overlap with Parallax.**
  - Paper Folding: Fold (EX-04) already covers it, and goes further.
  - View Recognition: partly covered by Views (EX-07). Its two-views-to-third format and hidden lines are
    missing.
  - 3D Form Development: Nets (EX-05) covers only the cube-net part.
  - Apertures, Angle Discrimination and Cube Counting (painted faces) have no counterpart.
- **Recommendation.** Do both kinds of work.
  - Adaptive exercises:
    - a DAT-style variant of Fold (4 × 4 hole grid, at most 3 folds, one punch);
    - a "complete the views" variant of Views, with hidden lines;
    - four new exercises: Angles, Painted Cubes, Openings (apertures) and Form (pattern folding).
  - A separate **timed Section** mode: six parts in PAT order, no feedback until the end, a review
    afterwards, no effect on ratings and no score prediction.
  - Name the DAT only descriptively, with a non-affiliation line (§6).

## 2. The PAT as given in 2025–2026 (official sources first)

### 2.1 Battery, delivery, timing

| Fact | Value | Source |
|---|---|---|
| DAT sections | Survey of the Natural Sciences 100 items, 90 min; **Perceptual Ability 90 items, 60 min**; optional break 30 min; Reading Comprehension 50 items, 60 min; Quantitative Reasoning 40 items, 45 min. Optional tutorial and post-test survey of 15 min each. Total appointment 5 h 15 min. | ADA 2026 Candidate Guide [F] |
| PAT parts, in order | Apertures, View Recognition, Angle Discrimination, Paper Folding, Cube Counting, Spatial Relations | ADA PAT instruction sheet © 2025 [F]; the Candidate Guide adds "3D Form Development" to the last name |
| Items per part | 15 each. The ADA documents read here give only the total of 90 | Bootcamp, Booster, Kaplan, Test Ninjas, Union Test Prep, Wikipedia [F] |
| Factors | "angle discrimination, block counting, paper folding, form development, and two forms of object visualization" (the two are Apertures and View Recognition) | ADA DAT User's Manual 2025 [F] |
| Time per part | None set: one 60-minute clock covers all 90 items (about 40 s each). Prep pacing advice: Apertures and View Recognition about 45–50 s each; Angles about 20 s; Paper Folding about 20–25 s; Cube Counting about 20–40 s; Form Development about 45–60 s | Candidate Guide [F]; Kaplan [F]; Bootcamp success story [F] |
| Delivery | On computer at Prometric, one item per screen; two noteboards and markers; slide rules, paper, calculators, rulers and other measuring devices banned | Candidate Guide [F] |
| Scoring | 3-parameter logistic IRT with equating across forms; no guessing penalty. Pretest items are unscored. The recommended item difficulty range is 40–89 % right | User's Manual [F] |
| Scale | 200–600 in steps of 10 since 1 March 2025 (was 1–30). A concordance table was built from more than 30 000 attempts. PAT is reported separately and is not in the Academic Average (QR, RC, Biology, General Chemistry, Organic Chemistry) | Scoring update, score scale sheet, User's Manual [F] |
| 2025 norms | PAT mean 406.84, SD 66.81 (N = 17 430, March–December 2025). Women 399.1, men 421.4 (d ≈ 0.33). Repeaters 399.4 vs 410.7 for first-time takers, which reflects who retakes rather than retest gains | User's Manual [F] |
| Reliability | PAT .90–.92 across forms | User's Manual [F] |
| Retest rules | At least 60 days between attempts; at most 4 attempts in 12 months. From the third attempt, permission and proof of a dental-school application are needed; after the fifth, one attempt per 12 months | ADA DAT page and Candidate Guide [F] |
| History | 1972: the Chalk Carving Test was replaced by the Perceptual-motor Ability Test. 1981: "the two perceptual tests were combined into one". (Schmid 2020 gives 1968 for the PAT's introduction and 1973 for the replacement; the dates conflict.) | User's Manual [F]; Schmid 2020 [F] |
| Practice | Historical design rule: tests must be "of high reliability and not subject to practice effects". No current retest data | User's Manual [F] |
| Recent changes | Biology specifications (21 Jan 2022); scoring and reporting (1 Mar 2025); Organic Chemistry specifications (April 2026). Nothing about the PAT | ADA "Recent and Forthcoming Updates", updated 22 Oct 2026 [F] |

The **Canadian DAT** is a separate test run by the Canadian Dental Association. Its soap-carving Manual
Dexterity Test is "currently suspended" (CDA page [F]). Its candidate guide could not be opened (§12), so its
PAT format is not covered here.

### 2.2 The six parts: answer formats and official rules

The rules are paraphrased from the ADA's 2025 instruction sheet ("Perceptual Ability Test Section") [F]. The
answer counts come from that sheet where it states them, and from prep sources otherwise.

| Part (prep name) | Stem | Options | Official rules and conventions |
|---|---|---|---|
| **Apertures** (Keyholes) | A pictured 3D object | **5** aperture outlines (official) | Picture the object from all directions; pick the one opening it could pass through with the correct side first. It may be turned before entering and may start on a side not shown. Once started, it passes all the way through without twisting or turning. The opening is "always the exact shape of the appropriate external outline of the object" (wording as quoted by Varsity Tutors and an SDN thread; the ADA digest gives the same rule). Object and openings share one scale, so a right shape can be too small or too large, but the differences can be judged by eye. Hidden parts have no irregularities, and symmetric indentations continue in the hidden part. One correct aperture per item. |
| **View Recognition** (Top-Front-End, TFE) | Two of the three views: top, front, end | **4** (official) | Views are drawn without perspective (parallel lines of sight). TOP sits upper left, FRONT lower left and END lower right, "ALWAYS in the same positions". Lines that cannot be seen in a view are DOTTED. The missing view may be the top, front or end ("it is not always the end view that must be selected"). The layout is third-angle projection, so END is the right-side view (DJ inference; the sheet does not say "right"). |
| **Angle Discrimination** (Angle Ranking) | Four numbered interior angles | **4** orderings, A–D, each four numbers such as "2-3-4-1" (official) | "Rank a series of angles from smallest to largest." Interior angles under 180° only. |
| **Paper Folding** (Hole Punching) | Panels showing a square sheet folded one or more times, then punched | **4 or 5** (conflicting: dat-prep.com says 5 (A–E); Varsity Tutors items show both 4 and 5; the official text is silent) | Broken lines show the paper's original position; solid lines show the folded paper. The paper is never turned or twisted and stays within the original square. "There are multiple folds in each item." A hole is punched after the last fold; pick the pattern of black circles on the unfolded square. Hole count = layers at the punch. Prep sources add: a 4 × 4 grid of 16 possible hole positions, one to three folds (Kaplan), and folds on grid lines, between them ("half folds") or diagonal. |
| **Cube Counting** | A figure of cubes, with several questions per figure (usually 3, sometimes 2–5, per Bootcamp) | **5**: "A) 1 cube" … "E) 5 cubes" (official) | The figure is made of equal cubes cemented together, then painted on every exposed side except the bottom it rests on. "The only hidden cubes are the ones necessary to support other cubes." Questions ask how many cubes have one, two, three, four or all five sides painted, e.g. "How many cubes have two of their exposed sides painted?" "There are no problems for which zero (0) is the correct answer." |
| **Spatial Relations** (3D Form Development, Pattern Folding) | A flat pattern | **4** (Kaplan, Varsity Tutors, masterstudent.ca, dat-prep.com) | Identify the 3D shape the pattern makes when folded. The official text says little more. Prep sources add: the pattern is the outside surface; some items carry shading or patterns on faces; the solids include prisms, L- and step shapes and angled faces, not only cubes. |

**Discrepancies to remember.**
1. The sixth part is named "Spatial Relations" (2025 instruction sheet), "Spatial Relations / 3D Form
   Development" (2024 and 2026 Candidate Guides), "3D Form Development" (2017 guide), "form development"
   (User's Manual) and "Pattern Folding" (prep).
2. The answer count for Paper Folding is unresolved (4 or 5).
3. Secondary sources contain errors. Union Test Prep describes Apertures backwards and with four options;
   dat-prep.com names the AAMC as owner of the DAT mark. Do not copy rules from prep pages without checking
   them against the ADA sheet.

## 3. What makes each part hard, and what prep courses teach

### 3.1 Apertures (Keyholes)
- **Difficulty drivers.**
  - Subtle indents and protrusions.
  - Proportions: an option can be the right shape at the wrong size (official rule, Booster, SDN 2007).
  - Choosing which axis the object goes through.
  - Correct outlines can appear turned in 90° steps or flipped. Booster's solution guide says the object
    "may be rotated in 90° increments and flipped in any direction" [F]. This follows from the official rule
    that the object may be turned before it enters.
  - Through-holes: in a 2010 SDN thread, the correct keyhole included an inner cut-out. The ADA wording
    ("external outline") leaves this ambiguous [F].
- **Real items versus prep items** (anecdote, SDN 2014): on the real test "the shapes were harder but the
  answers were more obvious". Bootcamp's options differed only "in minute segments". (DJ) Real foils differ
  by visible features, not by micro-proportions.
- **Strategies taught.**
  - Projections: the "shadow" or "crush flat" view along each of three axes, then match an option (Kaplan).
  - Scan the options first and group them by orientation; decide which view is shown; narrow to two
    (Bootcamp success story).
  - Judge the widest and narrowest points (Booster); compare ratios of lengths, not absolute lengths
    (Booster solutions).
  - Opposite views are mirror images (Union Test Prep).
  - Eliminate options by "distances and slopes" (Bootcamp).

### 3.2 View Recognition (TFE)
- **Difficulty drivers.**
  - Matching features across views.
  - Hidden (dotted) edges.
  - Slopes and holes.
  - Options that differ by a single line, or by solid versus dotted.
- **Strategies taught.**
  - Pick one distinctive feature (a wall, an odd shape), find it in both given views, and eliminate options
    that disagree; repeat with another feature (Bootcamp).
  - Group the options by their main differences and work from one view (Bootcamp success story).
  - Solid lines are visible elevation changes; dashed lines are hidden ones.
  - Bootcamp calls the older "line counting" method "outdated" and of little help on the current exam. Other
    sites (masterstudent.ca) still teach it.

### 3.3 Angle Discrimination
- **How close the angles are.**
  - Prep sources: "about two degrees" apart in places (Kaplan) and as little as 3° (Shemmassian).
  - Forum reports: practice material 3–5° apart (2011–2012). One 2011 test taker estimated the real angles
    at "generally 6-10 degrees apart", with about a third of items solvable from the extremes alone.
  - These are anecdotes, and dated.
- **Strategies taught.**
  - Elimination: find the smallest or largest angle and drop options; often the close middle pair never
    needs ordering (Kaplan).
  - Images: knife and laptop for acute angles; a perpendicular reference for near-right angles; the
    supplement for obtuse angles; whether one angle fits inside another (Shemmassian).
  - Compare slopes against a shared base ("laser"); compare the inner tips ("circle") (masterstudent.ca).
  - Tilt the head so one arm is horizontal; quick glances; look away to reset (SDN).
  - Spend little time: about 20 s per item, and more time does not help (Kaplan; Bootcamp).
- **Psychophysics.**
  - Thresholds depend mainly on angle size (Weber-like) over most of the range. Near 90° they depend on the
    orientation of the arms (Chen & Levi 1996 [A]).
  - Discrimination is best near 90° and for parallels. Group thresholds for connected arms were 5.4° at 90°,
    8.9° at 80°/100° and 11.2° at 55°/125°; deviants moving toward 90° are easier to spot (Dillon et al.
    2019 [F]). Those were odd-one-out thresholds at about 50 % detection, not ranking accuracy.
  - (DJ) Expect ranking to be hardest for acute and obtuse sets away from 90°, and easier near right angles.

### 3.4 Paper Folding (Hole Punching)
- **Difficulty drivers.**
  - Number of folds; diagonal folds; partial or corner flaps; overlapping layers.
  - Whether the punch passes through all the layers.
  - Research (v1.0 B-tasks §3; Burte et al. 2018): the number of folds that matter predicts errors better
    than the total; diagonal folds mixed with straight ones are hardest; many solvers use "holes = 2 per
    fold" heuristics.
- **Strategies taught.**
  - Draw a 4 × 4 grid on the noteboard, then unfold backwards from the last fold, reflecting each hole across
    each crease (Bootcamp, Shemmassian, masterstudent "tic-tac-toe").
  - Symmetry elimination about the first fold line (Kaplan).
  - Mark positions X (paper present) or E (empty) through the reflections (Bootcamp success story).
  - Use the options themselves to track hole positions (SDN 2020).

### 3.5 Cube Counting
- **Difficulty drivers.**
  - Hidden support cubes.
  - Counting faces that touch other cubes.
  - Remembering that the bottom is never painted.
  - Many cubes; several questions on one figure.
  - Research on counting cubes in drawn buildings (Kurtuluş & Yolcu 2013 [F], reviewing Ben-Chaim et al.
    1985 and Battista & Clements 1996 [S]): the classic errors are counting only visible cubes, counting
    faces as cubes, double counting, and missing hidden cubes. Accuracy falls with more cubes and more hidden
    faces.
- **Strategies taught.**
  - A tally table: rows are cubes, columns are 0–5 painted sides, filled row by row or column by column,
    then recounted from another direction (Bootcamp; Bootcamp success story; masterstudent).
  - Learn the common positions; for example, a corner cube on the ground shows three painted sides (Booster).
  - Check hidden support cubes explicitly.
  - Kaplan budgets about 2 minutes per figure.

### 3.6 Spatial Relations / 3D Form Development (Pattern Folding)
- **Difficulty drivers.**
  - Shapes other than cubes; proportions.
  - Shaded faces whose adjacency must be tracked.
  - Options drawn upside down or from unusual sides.
  - Called among the hardest parts (Kaplan).
- **Strategies taught** ("key landmarks", Kaplan):
  1. Eliminate on a unique shape, including wrong proportions.
  2. Eliminate on a unique shading pattern, e.g. alternating shaded and plain faces.
  3. Pick one landmark face and check only its neighbours.
  4. Do not fold the whole figure in your head.
- **Other tips.**
  - Fold into the page, not out of it; check two pieces at a time (Bootcamp).
  - Group the options, drop the two obvious misfits, and watch for upside-down options (Bootcamp success
    story).
  - Side counting and colour matching (masterstudent).
  - Distractors often swap shaded faces or break adjacency (Kaplan; Varsity Tutors explanations).

## 4. Research

### 4.1 Validity of the PAT

**ADA DAT Validity Study (March 2026) [F].**
- 38 U.S. schools; two cohorts (2023–24 and 2024–25).
- Corrected ρ adjusts for range restriction and criterion unreliability.
- No incremental validity was given for the PAT alone: only "all DAT subscores" and "all predictors" models.

| Criterion | N (schools) | r observed | ρ corrected |
|---|---|---|---|
| Year 1 biomedical GPA | 5 760 (36) | .17 | .29 |
| Year 1 preclinical technique GPA | 5 678 (37) | .23 | .30 |
| Year 1 clinical science GPA | 1 031 (8) | .15 | .25 |
| Year 1 overall GPA | 5 834 (38) | .22 | .33 |
| Year 2 biomedical GPA | 5 898 (38) | .13 | .21 |
| Year 2 preclinical technique GPA | 5 310 (35) | .22 | .36 |
| Year 2 clinical science GPA | 2 522 (16) | .11 | .16 |
| Year 2 overall GPA | 5 375 (35) | .21 | .33 |

The report calls the PAT "among the best predictors of Preclinical Dental Technique GPA" in Year 2.

**ADA User's Manual 2025 [F].**
- The corrected correlations above, again; for technique grades, the PAT (.30) is near Biology (.31) and
  above QR (.25) and RC (.17).
- The PAT correlates .60–.67 with the science tests, .62 with QR, .42 with RC and .70 with the Academic
  Average. (DJ) So a large part of its variance is shared with general academic ability.
- Subgroup means differ (§2.1). Coy, McDougall & Sneed (2003), "Issues regarding practical validity and
  gender bias of the PAT", is known by title only [T].

**Independent studies**
- **Schmid 2020** (Loma Linda dissertation, N = 1 822, 2009–2013 entrants) [F].
  - PAT standardised β with restorative lab courses: .30, .15, .05 (not significant) and .21.
  - Fourth-year mock clinical exams: mostly not significant (prosthodontics β = .08).
  - Licensure (WREB): operative .14, endodontics .21.
  - The text claims the PAT explains "15 to 30 percent" of preclinical variance, but the tables do not show it.
- **Literature reviewed by Schmid** [S]:
  - Gray & Deem 2002: about 25 % of variance in preclinical grades.
  - Gray, Deem & Straja 2002: little or no role in clinical grades.
  - Curtis et al. 2007: "generally weak predictors".
  - Ballard et al. 2015: not related to dental-school GPA.
  - Sandow et al. 2002 (the older Perceptual-motor Ability Test): unrelated to board scores or GPA, but low
    scorers remediated more often.
  - De Ball et al. 2002: not predictive of NBDE Part I.
  - Bergman et al. 2006: correlated with the NBDE dental anatomy subtest.
  - Carroll & Schuster 2015: 4–15 % of variance in a fourth-year competency exam.
  - Lee et al. 2018: 15 % of CBSE variance.
  - Schultz-Robins et al. 2018: students who needed remediation had lower PAT scores.
- **DePinto et al. 2025**, J Dent Educ, doi 10.1002/jdd.70022 (Rutgers, n = 335) [A, via an aggregator].
  - The PAT and QR were the subscores most linked to operative simulation grades.
  - The PAT stayed significant for all five outcomes in regression, at about 0.3 points on a 100-point
    grade per PAT unit (old 1–30 scale). The authors call this "modest".
- **Imbery et al. 2023**, J Dent Educ 87(7):1008–15 (n = 96) [A].
  - Correlations of the PAT, the Operation game, mirror tracing and wax carving with preclinical lab grades
    were minimal to weak. Wax carving was "the most reliable predictor".
  - Grouped PAT scores (< 20, 21–22, 23–30) predicted performance in both courses.
- **Pithpornchaiyakul et al. 2021**, Khon Kaen Dent J (n = 190, Thailand) [A].
  - A "perceptual ability test" correlated r = .15–.27 with some preclinical grades.
  - (DJ) Which test this was is unclear; Thai admissions use their own aptitude tests [unverified].
- **Schwibbe et al. 2016**, Adv Health Sci Educ 21:841–57 [A].
  - Not the PAT: a technical-aptitude spatial test and wire bending.
  - Manual but not spatial ability related to simple tasks; both related moderately to complex tasks.
- **Hegarty, Keehner, Khooshabeh & Montello 2009**, Learn Individ Differ 19:61–70 [S, not read; reported by
  the NRC paper and by Ramadhani et al. 2022].
  - 324 participants (first- and fourth-year dental students and psychology students); MRT and a
    visualization-of-views test.
  - Spatial ability predicted choosing cross-sections of novel objects (r = .37–.52) and of teeth
    (.29–.37), and restorative lab grades but not anatomy grades.
  - Dental education improved dentistry-specific spatial skill (cross-sections of teeth) but "did not improve
    their spatial skills more generally".
- **Kramer et al. 1989**, "Construct and predictive validities of the perceptual ability test" [T].

**Summary (DJ).**
- The PAT is a reliable test.
- It predicts preclinical technique grades modestly (ρ ≈ .3, about as well as Biology) and clinical
  performance weakly.
- Part of its validity is general ability.

Any Parallax text that mentions dentistry needs the limitation line beside it (CLAUDE.md rule 2).

### 4.2 Practice and coaching effects
- **ADA.** The PAT was designed to be "not subject to practice effects" (User's Manual). No retest gains are
  published. Repeaters score lower than first-time takers, which reflects who retakes.
- **Retest meta-analyses.**
  - Hausknecht et al. 2007 [A]: 50 studies, 134 436 people; adjusted effect .26, larger with coaching and with
    identical forms.
  - Scharfen, Peters & Holling 2018 [F-part]: 122 studies, N = 153 185.
    - Standardised mean change: first retest .33, first to third test .50, first to fourth .52, with "a
      plateau … after the third test administration".
    - Figural content .32 at the first retest.
    - Identical forms .37 vs alternate forms .23.
    - Interval effect weak (−.0008 per week).
    - Coached samples were excluded, so this is practice alone.
- **Training versus retest in spatial tests.** Controls gain too.
  - Uttal et al. 2013 (v1.0 A and B): controls g = .45 and retested controls .75, against .62 for trained
    groups.
  - In a medical anatomy course, MRT gains were 6.0 points against 4.9 in controls, d = .41 (Bogomolova et
    al. 2019 [A]).
- **Specificity.** Dental education raised dentistry-specific spatial skill, not general spatial ability
  (Hegarty et al. 2009 [S]).
- **Prep industry.** Claims that PAT skill "moves more with practice than with innate talent" (Test Ninjas)
  rest on testimonials, not studies [gap].
- **Implications for Parallax (DJ).**
  - Practising PAT formats should raise performance on those formats, which is near transfer by Parallax's
    own definition. Expect effects at least on the order of retest plus strategy effects.
  - Parallax has no data on DAT outcomes, so it must not promise DAT score gains or predict a DAT score.
  - Training on the format also means the PAT could never serve as a mid-transfer check for Parallax users.

### 4.3 Spatial training with dental or pre-dental students
- **Stavridis, Abrams, Sorby, Hamamoto & Sigler 2015** (ASEE, Ohio State) [F].
  - Course: a Sorby-style one-credit course (10 weeks × 80 min; *Developing Spatial Thinking*, linking-cube
    sets) for post-baccalaureate pre-dental students.
  - PSVT:R rose (n = 15, p = .0033; post-test mean 23/30).
  - The PAT correlated with PSVT:R at r = .50 (p = .015).
  - The PAT itself was not re-measured, there was no control group, and the same PSVT:R form was used twice.
- **Ramadhani et al. 2022** (scoping review, 15 articles) [F]: no dental spatial-training intervention. A
  "Spatial Awareness Training" for medical students did not raise spatial scores. Qi et al. 2013 [S]: passive
  3D viewing beat active 3D control, which hurt low-spatial students.
- **NUS LIF-T project** (an RCT of 3D interactive resources in dental morphology and endodontics) [F]: a
  protocol page, no results.
- **Huang et al. 2025**, JMIR 27:e68538 [F].
  - An RCT of ChatGPT support in VR skill learning for 187 dental students.
  - It is not spatial training, but low-PSVT:R students gained most: operational score 70.2 vs 55.4.
- **Hinton 2024** (honours thesis, University of Mississippi) [A]: a semester of DAT-style items (angle ranking,
  TFE, cube counting, hole punching) in anatomy and physiology students, related to their exam averages. No
  control group.
- **[gap]** No study was found that trained PAT formats and measured PAT gains against a control group. The
  search budget ran out before a last check (§12).

### 4.4 Recent work, 2020–2026 (in one place)
- ADA Validity Study 2026; User's Manual 2025; the 200–600 scale since 1 March 2025.
- Schmid 2020; Pithpornchaiyakul et al. 2021; Ramadhani et al. 2022; Sarilita et al. 2022.
  - Sarilita et al. (KJME 34:309, 326 Indonesian dental students) [A]: PSVT:R and MRT correlated weakly to
    moderately with anatomy; men scored higher on both.
- Imbery et al. 2023; Hinton 2024; DePinto et al. 2025; Huang et al. 2025.
- Ersen et al. 2026, J Dent Educ, doi 10.1002/jdd.70198 [A]: 66 students estimating depth in 3D-printed
  cavities; recommends perceptual training; no PAT.

## 5. Overlap with Parallax

### 5.1 The four related exercises (gen.js headers and `PX.ex.define` entries)

`js/ex/registry.js` holds the contract only (validation, params codes, enumerate). Each exercise registers
itself from its own `gen.js` through `PX.ex.define`, so there are no per-exercise entries in the registry.

Registry facts that matter for new work:
- Answer types: choice, multi, yesno, angle, targets, sequence. A choice grid holds at most 9 options.
- Codes must match `^[A-Z]{1,4}-\d{1,4}$`.
- `perDisplay` keeps ratings per screen class (Track, Homing).
- `extraParams` holds params that are not difficulty dims.
- `timeLimit(params)` is null by default.
- Adding a dim changes `paramsCode`, so it needs a `version` bump. A variant appended at the end keeps the
  old codes.

| Exercise | Definition | Model and format |
|---|---|---|
| **Views** EX-07 (`views` v1) | Vz, intrinsic-static, choice 4. Dims: cubes 4/6/8/10/12 (step .65), grid 3 × 3 or 4 × 4 (.6), view top/front/right (.45, toview only). Variants: toview, toobject, count. Base −2.2 | Height maps (no overhangs, up to 4 high), drawn isometrically from the front-right-top corner. toview: structure → which top, front or right view. toobject: the three views in third-angle layout → which structure. count: how many cubes (every cube shows a whole face). Drawings show unit edges where depth changes; **there are no hidden lines**. Validator: ray casting |
| **Fold** EX-04 (`fold` v1) | Vz, intrinsic-dynamic, choice 4 (5 from 4 folds). Dims: folds 1–5 (.6); type half/corner/diagonal/mixed (.35); punches 1–3 (.3); idle folds 0–2 (−.35). Base −2.2 | 8 × 8-cell sheet; exact reflections on grid and 45° lines; no punch on a crease; one panel per fold (crease dashed, flap shaded); options are unfolded sheets with the same hole count; foils come from neighbouring problems |
| **Nets** EX-05 (`nets` v1) | Vz, intrinsic-dynamic. Dims: squares carried (5 bins, .75); net shape 1-4-1 / 2-3-1 / 2-2-2·3-3 (.4); faces between 2 or 3 (.6). Variants: opposite, edges, cube | Cube nets only, with unoriented marks (oriented cube matching belongs to the probe PR-1). Answers stay inside the net (a face, yes/no); **there are no 3D-figure options** |
| **Slice** EX-06 (`slice` v1) | Vz, intrinsic-dynamic, choice 4. Dims: structure simple/joined/embedded (.4); cut orthogonal/oblique/double oblique (1.3); curved no/yes (.75); custom difficulty with interactions | Exact meshes of box, prism, pyramid, cylinder, cone and sphere; an analytic inside-test validator (54 × 54); a "proj" foil (the solid's outline as seen by the viewer). The lib exposes `silhouetteGrid`, `rasterize`, `iou`, `describe`/`distinct`, `hull`, `insidePrim`/`depthAt`, all reusable for outline matching |

### 5.2 Overlap by PAT part

| PAT part | Closest Parallax exercise | Match | Missing |
|---|---|---|---|
| Apertures | None. Related: Slice's "proj" foil (outline of a solid), Views (orthographic views) | Low | A pictured solid → its outline along one of three axes; 5 openings at the object's scale; turned or flipped openings; the exact-fit and no-hidden-irregularity rules |
| View Recognition | Views (toview, toobject; third-angle layout already drawn in toobject) | Medium | Two views given → pick the third; **hidden lines dotted**; general solids (slopes, notches, holes) instead of cube stacks; foils differing by one line or by solid vs dotted |
| Angle Discrimination | None (the Level probe judges line orientation, but it is never trained) | None | The whole format |
| Paper Folding | Fold | High: Fold is a superset (more folds, more punches, 8 × 8 sheet) | DAT look: a 4 × 4 hole grid with all 16 positions marked, ≤ 3 folds, one punch, the original outline dashed with the folded paper solid |
| Cube Counting | Views "count" (how many cubes) | Low | Counting painted faces; hidden support cubes; the unpainted bottom; answers of 1–5 cubes; several questions per figure |
| Spatial Relations / Form Development | Nets (cube nets) | Low–medium | Solids other than cubes; shaded faces; 4 pictured 3D options; wrong-proportion and swapped-shading foils |

### 5.3 Consequences for the Spatial Check (CLAUDE.md rule 10)
- **Form Development vs PR-1 Cube Match.** Oriented symbols on cubes are the probe's format. Form items must
  never put oriented marks on cubes; use unoriented shading, and solids other than cubes for anything
  oriented (DJ). Nets already follows this rule.
- **Angles vs PR-5 Level.** Level's nearest foil sits a few degrees from the true line. Training fine angle
  comparison could transfer slightly to Level's perceptual component (DJ, low risk). R4 and the plan should
  know about it; one option is to report Level separately if Angles becomes popular.
- **View Match (PR-2)** is not affected: it is scene perspective, not object views.

## 6. Trademark and fair use (not legal advice)

- **The marks.**
  - The ADA writes "DAT®" in its 2024 and 2026 Candidate Guides and on its DAT web page. It treats the mark as
    registered, and "Dental Admission Test" as the programme name.
  - Its documents carry "© 2026 American Dental Association. All rights reserved". The instruction texts and
    item drawings are copyrighted.
  - A USPTO registration number for the ADA's DAT mark was not found in this pass [gap].
  - Third-party marks containing "DAT" exist: DAT BOOSTER (Booster Prep, Class 16, registered 2016,
    cancelled 2023) and a stylised DAT-with-tooth mark (Class 41, cancellation pending since 2021) [F].
- **How prep companies name their products.**
  - Many use the mark inside product names (DAT Bootcamp, DAT Booster/PATBooster, Crack DAT PAT, DAT Destroyer,
    DAT Genius). Parallax should not follow them; these are commercial choices with their own risk.
  - Their disclaimers:
    - Test Ninjas: "DAT® is a program of the American Dental Association (ADA)", which "is not affiliated with,
      and does not endorse, Test Ninjas".
    - Kaplan: "All organizational test names and other marks are trademarks or registered trademarks of their
      respective owners", none affiliated with Kaplan.
    - dat-prep.com wrongly names the AAMC as owner, an example of what not to do.
    - Bootcamp's and Booster's pages show no disclaimer at all [F].
- **Nominative use** (US doctrine: New Kids on the Block v. News America Publishing, 9th Cir. 1992)
  [unverified, from prior knowledge]. Three conditions:
  1. Use the mark only where the thing cannot readily be described without it.
  2. Use only as much as needed: plain words, no logo or styling.
  3. Imply no sponsorship or endorsement.
- **Wording (DJ).**
  - Safe:
    - "DAT-style formats".
    - "Practice in the six question formats of the Perceptual Ability Test (PAT) of the Dental Admission Test
      (DAT®)".
    - "Apertures-style items".
    - Format names as generic descriptions (angle ranking, hole punching, cube counting, pattern folding).
  - Avoid:
    - "Official", "DAT Trainer", "PAT simulator", "real DAT questions", "DAT score", "predicted PAT score".
    - The ADA logo, Prometric screen copies, or replicas of the test interface.
    - Exercise ids or codes that use the mark (no `PAT-1` codes).
  - Spell out "Dental Admission Test" at first mention; "DAT" alone is also Pearson's Differential Aptitude
    Tests, whose Space Relations subtest is pattern folding.
- **Disclaimer to carry wherever the DAT is named** (library group, Section mode, About, guide):
  "DAT® and Dental Admission Test are marks of the American Dental Association. Parallax is not affiliated
  with or endorsed by the ADA. Every item is generated by the app; none is taken from the DAT."
- **Copyright.** Formats and ideas are free to use, but the expression is not. Write the rules in Parallax's
  own words; do not copy the ADA instruction sheet's sentences, its example items or its figure style; draw
  every figure from Parallax's own models (CLAUDE.md rule 3).

## 7. Existing prep apps and sites

| Product (as described on its own pages, Nov 2026) | Items | Timed, analytics, adaptivity |
|---|---|---|
| **DAT Bootcamp** (bootcamp.com) | Practice tests (the Plus plan adds 5 more PATs); "PAT generators", with "Unlimited PAT Practice" listed. A 2015 forum post says there are generators for every part, behind the paywall. An angle-ranking "game" | "Prometric Mode" simulation of tests, custom timers, score predictions, comparison with past students. No adaptivity advertised. Pro $599, Plus $999 for 90 days |
| **PATBooster** (Booster Prep) | "2500+ PAT questions", "10+ practice tests", 1 000+ videos; keyhole and pattern-folding generators ("unlimited") and "custom PAT generators"; interactive 3D models for keyholes, cube counting and TFE; folds shown in 3D | "Performance analyzers" for angles, cube counting and hole punching; visual analytics over time; games and prizes. Timed or adaptive modes not stated |
| **Crack DAT PAT** (iOS app, Crack Exam Preparation Software) | Generators for angle ranking, cube counting, hole punching and pattern folding: "no two questions will ever be the same"; full practice exams | Instant feedback and videos. No analytics described. 5 free items a day per part; $49.99 a month or $199.99 a year |
| **DAT Genius** (2015 forum report) | Free generators for angle ranking, keyholes, hole punching and cube counting | Unknown |
| **TestPrepPal free PAT tool** | 30 fixed items (angles, hole punching, cube counting) built from stored parameters; "No answer key here was typed by a human". Keyholes, TFE and pattern folding left out | 40 s per item mixed set, seconds per item at the end |
| **Kaplan, Varsity Tutors, Union Test Prep, Test Ninjas, Shemmassian** | Item banks and strategy articles | Varies |

**Where the market is thin (DJ, from public pages only).**
- No product publicly describes independent answer checking, shortcut-proof distractors or difficulty
  models.
- "Generators" are not described as adaptive.
- Analytics stop at accuracy and time.
- A 2014 forum report says one leading bank made keyholes hard through minute proportion differences
  (artificial difficulty).
- Prices run from $50 a month to $999.

**How Parallax can go beyond them.**
- **Validated items.** Every item has an independent validator, 10 000-seed node tests, and published
  shortcut-solver accuracies (rules 4 and 5).
- **Adaptive targeting.** The IRT engine with difficulty dims that explain what makes an item hard; Path
  stages; spaced review; interleaving with similar-looking exercises (ENGINE §5).
- **Show me from the grading model.** The object turning into its opening, the views being traced, the
  paper unfolding, the tally filling cube by cube, the net folding.
- **Strategy cards** for imagery and analytic strategies, with when to switch: tally, unfold backwards,
  eliminate by the extremes, key landmarks.
- **Honest measurement.** No predicted DAT scores. The held-out Spatial Check shows whether skill spreads
  beyond the format.
- **Access.** Free, offline, open-source, phone-ready, keyboard-accessible.

## 8. Design proposals (all DJ unless a source is named)

### 8.0 Decisions shared by all six formats
- **Where they live.** A Library group named "DAT-style formats", with the §6 disclaimer.
- **Where-this-is-used card.** "These formats appear in the Perceptual Ability Test of the Dental Admission
  Test." Beside it, the limitation line: "Practice on a format usually raises scores on that format. Parallax
  has not measured any effect on DAT scores, and PAT scores relate only modestly to dental-school grades."
- **Codes.** Continue EX-12 onward. Never use the mark in ids or codes.
- **Abilities and cells.**
  - Openings, Painted Cubes, Form, and Views/Fold variants: Vz.
  - Angles: LE (CHC length estimation, the nearest narrow ability) with `cell: null`. Label it "perceptual
    judgement practice", as Track is labelled attention practice (rule 9 analogue).
- **Rules, scale and counts.**
  - Teach the official rules in Parallax's own words in learn.js.
  - Every figure and its options share one scale wherever scale is part of the rule (Openings, Form).
- **Strategy cards** come from §3: tally, unfold backwards, eliminate by the extremes, key landmarks,
  projections, feature tracking.
- **Answer counts** follow the PAT where it is certain: Openings 5, Views "complete" 4, Angles 4, Painted
  Cubes 5 (1–5 cubes), Form 4. Paper Folding keeps Fold's 4 (5 from 4 folds).
- **Rendering.** SVG wherever possible (crisp on phones, no WebGL context). Painted Cubes and Form may use
  `stage3d` snapshots taken in the ready phase.

### 8.1 Paper Folding: a DAT-style variant of Fold (smallest job)
- **Generator.**
  - Fold's exact model with a 4 × 4-cell sheet (items already carry `n`; the lib constant N becomes per
    variant).
  - Folds limited to 1–3 and one punch. Types stay half, corner, diagonal and mixed. Partial flaps are
    allowed, as on the DAT.
  - Panels in the DAT look: the original outline dashed, the folded paper solid, an arrow for the flap.
  - Options: 4 × 4 dot grids with all 16 positions drawn as rings and holes filled. Filled versus ring is the
    non-colour cue.
- **Validator.**
  - Fold's re-simulation, unchanged.
  - Every option has the key's hole count, and every hole lies on the 16 positions.
  - Fold already forbids punches on a crease, which also avoids the "hole on the diagonal" ambiguity.
- **Shortcut risks.**
  - With one punch, the hole count equals the layers at the punch; every option already shares the key's
    count.
  - The key always has a hole under the punch: keep Fold's rationing of foils without one.
  - Symmetry about the first fold: keep Fold's matched-symmetry foils.
  - "Most like the others": keep Fold's balancing of the key's rank.
- **Difficulty dims.** Fold's folds (levels 1–3 only), type and idle folds, plus a variant offset of about
  −0.3 logit, since a small sheet and one punch are easier (to be refitted).
- **Version.** Adding `variants: ['standard', 'grid4']` keeps old codes, because the first variant adds 0.
  Bump `version` anyway if the item model changes for old params.
- **Phone.** A 4 × 4 grid in an option tile of about 150 px gives 37 px cells and an 11 px hole radius.

### 8.2 View Recognition: "complete the views"
- **Phase A: a new variant of Views (EX-07) on its cube stacks.**
  - Stem: two of TOP (upper left), FRONT (lower left) and END = right side (lower right), in the fixed
    third-angle places, with "?" in the empty slot. The missing view varies.
  - Options: 4 line drawings at the stem's scale, hidden edges dashed.
  - Height maps have no hidden lines in the top view, but the front and end views do: steps behind taller
    front columns.
- **Phase B: profile solids** (slopes, notches, through-holes), closer to the real TFE.
  - Built on the Openings model (§8.5) as a second variant of that exercise.
  - This avoids a breaking dim change to Views.
- **Generator.**
  - Draw the object, then render all three views. Edges are classified visible or hidden by sampling points
    along each edge and testing depth toward the viewer.
  - Foils come from neighbouring objects: one feature moved, removed or deepened; a slope reversed; a hole
    added or moved. Also a solid/dashed flip of one edge, and the view from the opposite side.
- **Validator** (independent). The hard part: the answer must be unique among *all* objects, not only among
  the options, because two views do not determine an object.
  - **Key.** Re-render the missing view by ray casting (as Views does now), with depth tests for hidden edges.
  - **Every foil must be shown to be impossible by a sound test:**
    - (a) **Shared extents.** Top and front share width; front and end share height; top and end share
      depth.
    - (b) **Silhouette hull.** H = extrusion(top) ∩ extrusion(front) ∩ extrusion(foil). If H's projections do
      not reproduce all three silhouettes, no object has them.
    - (c) **Line alignment.** With complete hidden-line drawings, every edge parallel to a shared axis shows
      in both adjacent views. So a foil line at a coordinate with no line or vertex in the neighbouring view
      is impossible. State this per edge direction, including 45° edges.
    - (d) **Solid/dashed foils** (the subtle DAT type). Search the generator's object class exhaustively
      for any object with both given views and the foil.
      - Cube stacks: the height maps fitting the top view's equal-height regions and the front view's column
        maxima (4 × 4 × 4 at most).
      - Reject the item when the search exceeds its budget.
  - **Visible differences.** Options differ visibly from each other: at least one line of length ≥ 1 unit
    differs in presence or style.
- **Shortcut risks.**
  - Line counting: solid, dashed and total counts. Make foils match the key's counts; Bootcamp says the method
    already fails on the real test.
  - Silhouette-only matching: at higher levels all foils share the key's silhouette.
  - Most like the others; odd one out; the mirrored view.
- **Difficulty dims.**
  - Object size (cubes 4–12, or features 1–4).
  - Which view is missing (top, front, end).
  - Hidden lines in the key (0, 1–2, 3+).
  - Foil type: silhouette, then internal line, then solid/dashed.
- **Phone.**
  - Three panels in an L plus four options; views of at most 6 units at about 20 px per unit.
  - Dashes of 4 px with 3 px gaps and strokes of 1.5–2 px.
  - The validator rejects hidden segments shorter than 1 unit and parallel lines closer than 0.5 unit
    (10 px).

### 8.3 Angles: Angle Discrimination (new, small)
- **Item.**
  - Four numbered angles, in a row on wide screens and 2 × 2 on phones.
  - Each angle is two rays from a vertex, with independent arm lengths (0.6–1.0 L) and random rotation.
  - Optionally a "laser" pose with one arm horizontal, as a dim.
  - No arc at the vertex: an arc's size would be a cue.
- **Values.** A base angle in a size class: acute (20–70°), near-right (80–100°) or obtuse (110–160°).
  Adjacent ranks differ by a gap δ drawn per level, assigned to positions 1–4 at random.
- **Options.** The true order plus 3 orderings, built to control what has to be resolved. Dim `resolve`:
  - 0: the extremes alone separate the key (Kaplan's elimination works).
  - 1: one foil swaps a middle-gap pair.
  - 2: one foil swaps the *closest* pair, so it has to be judged.
- **Validator.**
  - Re-measure every angle from the drawn endpoints. Order the angles by cosines from dot products and
    `Math.sqrt`, with no trigonometry, so the order is exact.
  - Check each gap ≥ the level's δmin with Slice's deterministic `atan2`.
  - Exactly one option equals the true order; options are distinct; the key's position is balanced.
- **Shortcut risks** (each ≤ 35 %, chance 25 % + 10):
  - Chord between the arm tips: with equal arms it equals 2L·sin(θ/2), which would give the order away. Draw
    arm lengths after the angles so the chord order is a random permutation.
  - Triangle area; arm-length sum; bounding box.
  - Orientation of the bisector.
  - Option consensus (the ranking most like the others) and odd one out.
  - Numbering position: the numbers are assigned at random.
- **Difficulty dims.**
  - gap: 8, 6, 4, 3, 2 and 1.5° (the real test is reportedly 2–10°; Dillon et al. 2019 give 5–11°
    thresholds for single comparisons).
  - size class: near-right easiest, then acute, then obtuse (Dillon et al.).
  - resolve: 0–2.
  - pose: aligned or free.
- **Phone.**
  - Arms ≥ 90 CSS px. At 90 px a 2° gap moves an arm tip by about 3 px, and 1.5° by about 2.4 px.
  - Use `perDisplay: true` (as Track and Homing do) and a gap floor of 2° on phones and 1.5° on large screens.
  - Void a trial when the device turns (rule 7); strokes 2 px, anti-aliased.
- **Honesty.** Angle ranking is a perceptual drill. Practice tends to stay specific to the trained stimuli,
  so make no transfer claim beyond the format.

### 8.4 Painted Cubes: Cube Counting (new, medium)
- **Figure model.**
  - A height map on a G × G grid (G = 3–5), up to 4 high, connected footprint, 6–22 cubes. This reuses Views'
    model and helpers (`voxels`, `rayImage`, `rayVisibility`).
  - Every cube stands on the ground or on another cube. Hidden cubes may only be supports: every column's top
    cube must be visible, with a whole face or ≥ 50 % of its top face.
  - Painted sides = top + 4 sides without a neighbour, so 0–5 (the bottom is never painted).
- **Drawing.**
  - A non-isometric axonometric view (e.g. azimuth 30°, elevation 25–30°), so that no two lattice positions
    project to the same place.
  - True isometric has the (1, 1, 1) ambiguity: a column of height h+1 one step back can look like a column of
    height h.
  - Three face tones plus outlines on every face, so colour is never the only cue.
- **Question.** "How many cubes have N painted sides?" with options 1–5 cubes. Ask only N whose count is 1–5
  (the official no-zero rule).
  - One question per trial.
  - The Section mode asks 2–4 questions about one figure through a shared seed and an `extraParams` field
    `ask`. The DAT pattern is about three per figure.
- **Validator** (independent).
  - Rebuild the voxels from the height map and recount painted sides by neighbour tests.
  - Ray-cast from the camera to confirm every column's top cube is visible and that the visible top faces fix
    every height (unique reconstruction).
  - Hidden cubes are only supports; the key count is 1–5 and the options are [1..5].
  - Optional extra proof: a brute-force search over all height maps on the grid that render to the same
    face-ownership image must give the same painted-side histogram.
- **Shortcut risks.**
  - A constant answer: spread keys evenly over 1–5 across the pool, each ≤ 30 % (chance 20 % + 10).
  - The "visible faces" error (counting cubes that *show* N faces): keep it ≤ 30 %. It is the classic novice
    error (Kurtuluş & Yolcu 2013), so most items should need hidden faces or supports.
  - Total cubes or column count modulo 5; a guess from the height.
- **Difficulty dims.**
  - cubes: 6–9, 10–13, 14–17, 18–22.
  - hidden support cubes: 0, 1–2, 3–5.
  - asked N: 3 to 5 easier, 1 to 2 harder (to be refitted).
  - maximum height: 2, 3, 4.
- **Phone.**
  - Cube edges ≥ 26 px; a 5 × 5 × 4 figure is about 180–220 px wide.
  - Answer buttons ≥ 44 px.
  - An optional tally pad (columns 0–5) as an on-screen noteboard in the Section mode only. In training,
    show-me fills the tally cube by cube.

### 8.5 Openings: Apertures (new, large)
- **Solid model: profile solids.**
  - Object = intersection of up to three orthogonal extrusions: the front profile F (x–y) extruded along z,
    the top profile T (x–z) along y, the side profile S (z–y) along x.
  - Profiles are polygons on a half-unit lattice with optional 45° chamfers, and quarter-circle notches at
    the top level.
  - Bounding box w × h × d, integers 2–5 units, pairwise different so the three outlines differ.
  - Only through-features exist, so the official rule that hidden parts have no irregularities holds by
    construction.
  - No through-holes along a projection axis: they make "external outline" ambiguous (SDN 2010).
- **Stem.** The solid in a three-quarter view from the front-right-top (Slice's VIEW: azimuth 35°, elevation
  28°, orthographic), flat-shaded with outlines. The view may show the solid lying on another face (dim
  `pose`).
- **Key.** The outline along one axis, P_x, P_y or P_z (dim `keyview`).
  - Computed exactly: P_z = {(x, y) ∈ F : ∃z, (x, z) ∈ T and (z, y) ∈ S}. Interactions make P_z differ from
    the front face itself, which is a good harder case.
  - Shown under a random element of D4 (turns of 90° and flips), since the object may be turned or flipped
    before it enters (official rule; Booster).
  - The same transform distribution goes to every option, so orientation is never a cue.
- **Foils** (from neighbouring problems, never mirror images, since mirrors are valid):
  - the outline of a sibling solid (one feature moved, removed, resized or flipped);
  - a proportion foil (one dimension or feature length off by ≥ 25 %);
  - the "face, not outline" foil (the visible front-face polygon where it differs from P_z);
  - at the top level only, a strict superset (an opening too large). The official rule is an exact fit, and
    the tutorial teaches it.
- **Validator** (independent of the profile algebra).
  - Ray-cast each axis on a 1/12-unit grid with point-in-polygon membership tests of F, T and S, giving
    three silhouette rasters.
  - Raster each option at the shared scale. Compare it with every silhouette under all 8 D4 transforms after
    aligning bounding boxes.
  - A **match** is IoU ≥ .985 with equal bounding boxes (± 0.05 unit).
  - A **non-match** needs a bounding box differing by ≥ 0.5 unit, or a symmetric difference of ≥ 0.5 unit²
    that contains a disc of radius ≥ 0.25 unit (a visible feature).
  - Exactly one option matches any silhouette; options are pairwise non-matching under D4.
  - The stem picture's ID buffer shows every profile feature, so the deciding feature is visible.
  - The test also reports how often some silhouette pair is congruent under D4 (allowed, but logged).
- **Shortcut risks** (each ≤ 30 %, chance 20 % + 10):
  - most like the others (raster IoU) and odd one out;
  - largest or smallest area; corner count;
  - bounding box matching a pair of the solid's dimensions. That is part of the skill, but at least 2 foils
    must also pass it;
  - "front face": spread the key over the three views, and include face-not-outline foils;
  - the pictorial silhouette, i.e. the option most like the drawn outline.
- **Difficulty dims.**
  - features: 1, 2, 3, 4+.
  - profiles carrying features: 1 (a pure extrusion), 2, 3 (interacting).
  - edges: straight, then 45° chamfers, then arcs.
  - keyview: the most visible face's outline, the others, then an interaction outline.
  - pose: upright or lying.
  - foil closeness: feature-level, then proportion 25 %, then 15 %. Keep proportion-only foils rare, per the
    2014 report on the real test.
- **Phone.**
  - Stem and options at one scale. A solid of at most 5 units at about 22 px per unit gives tiles of about
    125 px.
  - Five options in a 3 + 2 grid; openings filled dark with a 2 px outline.
  - Features ≥ 0.5 unit (≥ 11 px).

### 8.6 Form: Spatial Relations / pattern folding (new, large)
- **Solids.**
  - Non-cube boxes, triangular and pentagonal ("house") prisms, L-, T- and U-prisms (extruded polygons),
    wedges, square and triangular pyramids, frusta.
  - Cubes only with unoriented marks, never oriented ones (PR-1 protection, §5.3).
- **Nets.**
  - Edge-unfold along a random spanning tree of the face graph, with a 2D polygon-overlap test.
  - Fold lines dashed, cut edges solid. The pattern is the outside surface.
- **Marks.**
  - k shaded faces (a tone plus a hatch, never colour alone).
  - At the top level, one half-shaded face, which is oriented and chiral: on solids other than cubes only.
- **Options.** 4 pictured solids from a varied viewpoint (upright, tilted, upside down), each showing ≥ 3
  faces.
- **Foils:**
  - marks moved to a congruent face (adjacency broken);
  - the mirror arrangement, only when chirality is proved (no proper rotation reproduces it);
  - a shape or proportion foil (prism length, a triangle where a trapezoid belongs);
  - a foil whose marked faces touch only where they are adjacent in the net (exploits the false rule "not
    adjacent in the net, so not adjacent on the solid").
- **Validator** (independent).
  - Fold the net in 3D about its hinges, with dihedral angles taken from the solid. Check closure: every glued
    edge pair coincides within ε, and the surface is closed.
  - Each option is right when some proper rotation, found by matching vertex-edge-face flags, maps the
    folded solid onto the option's solid with every visible mark equal.
  - Exactly one option is realisable.
  - Every foil's deciding face is visible: ≥ 15 % of its area in the ID buffer.
  - Mirror foils are chirality-checked.
- **Shortcut risks:**
  - counts of visible shaded faces (balance them);
  - most like the others and odd one out (shape descriptors plus shading);
  - the number of visible faces;
  - proportion matching (≥ 2 foils share the key's proportions);
  - the net-adjacency heuristic.
- **Difficulty dims.**
  - solid: boxes and prisms, then wedges and pyramids, then L/U-prisms and frusta.
  - marks: 1, 2, 3 (chiral).
  - net distance between marked faces (squares carried, after Shepard & Feng 1972).
  - foil type: shape, then marks, then mirror.
  - option view: upright, tilted, upside down.
- **Phone.**
  - Nets of at most 10 faces with edges ≥ 30 px.
  - Options in 2 × 2 tiles of about 170 px.
  - Hatching at ≥ 4 px pitch so it reads at DPR 1.

### 8.7 Build order and reuse

| Order | Item | Size | Reuses |
|---|---|---|---|
| 1 | Fold "grid4" variant | S | Fold's model and validator |
| 2 | Angles | S | Slice's deterministic `atan2` and `sincos`; Level's SVG line drawing |
| 3 | Painted Cubes | M | Views' height maps, `voxels`, `rayImage`, `rayVisibility` |
| 4 | Views "complete" (cube stacks) | M | Views' ray images plus hidden-edge depth tests |
| 5 | Openings | L | Slice's `rasterize`, `iou`, `describe`/`distinct`, VIEW camera |
| 6 | Openings "complete" (profile solids) | M | Openings' model plus §8.2's sound tests |
| 7 | Form | L | Nets' 3D folding approach; Slice's mesh drawing |

## 9. Adaptive exercises, a timed Section mode, or both?

**Both**, for different jobs.

**Adaptive exercises** (all six) teach the operation behind each format.
- They use the standard machinery: ratings, Path stages, Speed, spaced review and show-me.
- Add the new exercises to the "similar-looking" interleaving groups:
  - {Openings, Views, Slice};
  - {Form, Nets, Fold};
  - {Painted Cubes, Views};
  - Angles alone (never next to a probe).
- Rationale: interleaving similar formats trains telling them apart (ENGINE §5; v1.0 C notes).

**Section practice**, a new mode, rehearses the real constraints: six formats, one clock, no feedback.
- **Structure.**
  - Six parts in PAT order (Openings, Views "complete", Angles, Fold grid4, Painted Cubes, Form).
  - 15 items each and one 60-minute clock, or a "mini" 6 × 5 items in 20 minutes for phones.
  - Free navigation and mark-for-review within the section; no feedback until the end.
- **Afterwards.** A review list with show-me for every item, and per part: right out of n, time used,
  unanswered, and a pacing line (items done against time).
- **Items.**
  - Fixed alternate forms (A, B, C), with seeds at "Parallax standard" settings in the middle of each range,
    so attempts are comparable (as the Daily Challenge does).
  - Never at "DAT difficulty": no mapping exists, so none is claimed.
- **Rules.**
  - It changes no rating (like Free play and the Daily Challenge).
  - No predicted DAT score, percentile or 200–600 conversion (rule 10).
  - Achievements only for good practice, e.g. "finished a full section" (rule 11).
- **Timing** (rule 7):
  - Each item's answer clock starts at its painted frame.
  - A pause stops the section clock and is reported.
  - A voided trial (stutter, device turned) is not counted and is replaced at the end of its part.
- **Engine fit.**
  - A new plan in `modes.js` with `step.feedback = false`, which is already supported.
  - A section clock in `ui/play.js`.
  - The step flag `noRating` (DJ).

## 10. Risks and open questions

1. **Honesty (rule 2).** The DAT framing invites "will this raise my DAT score?" The honest answer is "not
   measured".
   - No score prediction anywhere, and no "boost your PAT" wording in the app, README or share cards.
   - The limitation line sits beside every DAT mention.
2. **View Recognition uniqueness.** Two views do not determine an object.
   - Without the sound tests of §8.2, an item can have two right answers.
   - The solid/dashed foils, the most DAT-like ones, need a bounded exhaustive search, which may limit them
     to cube stacks at first.
3. **Openings rules.** Exact fit (too large is wrong), turns and flips allowed, through-holes ambiguous.
   - Parallax must state its own rules in the tutorial and compare at a fixed scale.
   - An item that is right by Parallax's rules but would be argued under the DAT's needs avoiding: no
     through-holes, no near-congruent outlines.
4. **Form geometry.** Dihedral angles that are not right angles, net overlap and chirality make it the
   largest build. Start with boxes and prisms.
5. **Spatial Check integrity.** No oriented marks on cubes (PR-1). A possible small Angles → Level (PR-5)
   transfer. R4 and the plan should check both.
6. **Display dependence.** Angles, and to a lesser degree Openings and Views, depend on screen size and
   resolution: use `perDisplay`, and void a trial when the device turns.
7. **Calibration.** Every step value above is hand-set. Refit them from pooled community exports, as
   CLAUDE.md already notes for the existing exercises.
8. **Scope.** Four new exercises, two variants and a mode. Counts in the guide and texts ("11 exercises")
   change, and each piece needs node tests (10 000 seeds), e2e tests and screenshots.
   - Suggested phasing:
     - v1.1: Fold grid4, Angles, Painted Cubes, Views "complete".
     - v1.2: Openings (with its "complete" variant), Form, and the full Section mode.
   - Or a mini Section of the formats already built.
9. **Section mode.** It is rehearsal, not training: speed pressure and no feedback. Keep it optional,
   non-rated and free of streak pressure (rule 11).
10. **Dated anecdotes.** The forum reports on the real test date from 2007–2015, and the official sample test
    (Prometric Test Drive) is generic. The current item style cannot be checked first-hand.

**Questions for the owner.**
- Name the DAT in the app (nominative, with the disclaimer), or call the group "admissions-test formats"?
- A full 60-minute Section, a 20-minute mini, or both?
- Which formats first?

## 11. References (read level in brackets; URLs as accessed on 13 Nov 2026)

**ADA and CDA (official)**
- ADA. Dental Admission Test (DAT®) web page. https://www.ada.org/en/education-careers/dental-admission-test [F]
- ADA (© 2025). *Perceptual Ability Test Section* (instruction sheet). ada.org/…/education/perceptual_ability_test_section_instructions.pdf [F, diagrams not seen]
- ADA (2026). *Dental Admission Test (DAT) 2026 Candidate Guide*, updated 08/04/2026. ada.org/…/education/dat_candidate_guide.pdf [F]
- ADA (2026). *DAT User's Manual*, 2025 edition, dated March 2026. ada.org/…/education/dat_users_manual.pdf [F; two passes]
- ADA (2026). *DAT Validity Study*, March 2026. ada.org/…/education/dat_validity_study.pdf [F]
- ADA. *Changes to DAT Scoring and Reporting*; *Understanding the New DAT Score Reporting Scale*. ada.org/…/education/changes_dat_scoringandreporting.pdf; …/dat_scorereportingscale.pdf [F]
- ADA. *Recent and Forthcoming Updates to Examinations and Tests*, updated 10/22/2026. ada.org/…/education/updates_licensureexaminationsandadmissiontests.pdf [F]
- ADA (2024). *DAT 2024 Candidate Guide* (copy at seattleu.edu …/Dental-Admision-Test-2024.pdf) [F]
- ADA (2017). *DAT 2017 Program Guide* (copy at wgf201103.github.io/OSU-pre-dent-ASDA/2017dat.pdf) [F]
- Canadian Dental Association. Dental Aptitude Test page. https://cda-adc.ca/en/becoming/dat [F]

**Research**
- Bogomolova K, Hierck BP, van der Hage JA, Hovius SER (2020). Anatomy dissection course improves the initially lower levels of visual-spatial abilities of medical undergraduates. *Anat Sci Educ* 13(3):330–339 [A]
- Chen S, Levi DM (1996). Angle judgment: is the whole the sum of its parts? *Vision Res* 36:1721–1735 [A]
- Coy K, McDougall H, Sneed M (2003). Issues regarding practical validity and gender bias of the Perceptual Abilities Test (PAT). *J Dent Educ* 67(1):31–37 [T]
- DePinto N, et al. (2025). Exploring predictors of preclinical performance in predoctoral operative simulation courses. *J Dent Educ*, doi:10.1002/jdd.70022 [A, via synapsesocial.com]
- Dillon MR, Duyck M, Dehaene S, Amalric M, Izard V (2019). Geometric categories in cognition. *J Exp Psychol Hum Percept Perform*, doi:10.1037/xhp0000663 [F, normalesup.org copy]
- Ersen MC, Celik ZC, Dogru Y (2026). Assessment of depth and distance perception in preclinical dental students. *J Dent Educ*, doi:10.1002/jdd.70198 [A]
- Hausknecht JP, Halpert JA, Di Paolo NT, Moriarty Gerrard MO (2007). Retesting in selection: a meta-analysis of coaching and practice effects for tests of cognitive ability. *J Appl Psychol* 92(2):373–385 [A]
- Hegarty M, Keehner M, Khooshabeh P, Montello DR (2009). How spatial abilities enhance, and are enhanced by, dental education. *Learn Individ Differ* 19:61–70 [S: the NRC paper below and Ramadhani et al. 2022]
- Hinton M (2024). *Spatial ability tests and course performance in Human Anatomy and Physiology I students*. Honors thesis 3116, University of Mississippi [A]
- Huang S, Wen C, Bai X, et al. (2025). Exploring the application capability of ChatGPT as an instructor in skills education for dental medical students: randomized controlled trial. *J Med Internet Res* 27:e68538 [F]
- Imbery TA, Malone CJ, Alhaddad AS, et al. (2023). Investigating correlations between the PAT and three hand-skill exercises to performance in preclinical laboratory courses. *J Dent Educ* 87(7):1008–1015 [A]
- Kramer GA, et al. (1989). Construct and predictive validities of the perceptual ability test [T; known from Ramadhani et al.'s reference list]
- Kurtuluş A, Yolcu B (2013). A study on sixth-grade Turkish students' spatial visualization ability. *The Mathematics Educator* 22(2):82–117 [F]. It reviews Ben-Chaim, Lappan & Houang 1985; Battista & Clements 1996; Hirstein 1981 [S]
- Musawi A, Barrett T, Nurrohman H, Bhatia S, Smith K (2019). Assessing likelihood of using the Bruininks–Oseretsky test of motor proficiency to predict preclinical performance of dental students. *Clin Exp Dent Res* 5:513–518 [F; used for history only]
- NUS LIF-T. Enhancing spatial abilities & learning outcomes through 3D interactive technology: an RCT in dental education (Fu JH, Esguerra RJ), project page [F]
- Pithpornchaiyakul S, Wongareerat K, Tanawongwanich C, et al. (2021). Correlation between perceptual ability and student performance in dental students. *Khon Kaen Dent J* 24(2):32–41 [A]
- Ramadhani NRN, Firman DR, Sarilita E, Lita YA (2022). Spatial ability in medical and dental education: scoping review. *J Pendidik Kedokt Indones* 11(3):306–318 [F]. It reports Qi et al. 2013 [S]
- Sarilita E, Lita YA, Firman DR, et al. (2022). Spatial ability and anatomy learning performance among dental students. *Korean J Med Educ* 34(4):309–318 [A]
- Scharfen J, Peters JM, Holling H (2018). Retest effects in cognitive ability tests: a meta-analysis. *Intelligence* 67:44–66 [F-part: 100 000 of 160 021 characters]
- Schmid B (2020). *Validity of the Perceptual Ability Test*. PsyD doctoral project, Loma Linda University, scholarsrepository.llu.edu/etd/1119 [F]. Its review is the [S] source for Gray & Deem 2002; Gray, Deem & Straja 2002; Curtis et al. 2007; Ballard et al. 2015; Sandow et al. 2002; De Ball et al. 2002; Bergman et al. 2006; Park et al. 2006; Carroll & Schuster 2015; Lee et al. 2018; Schultz-Robins et al. 2018
- Schwibbe A, Kothe C, Hampe W, Konradt U (2016). Acquisition of dental skills in preclinical technique courses: influence of spatial and manual abilities. *Adv Health Sci Educ* 21(4):841–857 [A]
- Stavridis OM, Abrams L, Sorby SA, Hamamoto DT, Sigler K (2015). Taking an engineering spatial visualization course to pre-dental students. ASEE Annual Conference, paper 11850 [F]
- The role of spatial thinking in undergraduate science education. Paper commissioned by the National Academies (DBASSE), sites.nationalacademies.org/…/dbasse_072586.pdf [F; author and year not captured, probably Hegarty, unverified]
- Earlier Parallax notes: docs/research/v1.0/B-tasks.md and A-evidence.md (Burte et al. 2018; Shepard & Feng 1972; Uttal et al. 2013; Sorby), read in v1.0

**Prep and market pages** (all [F], November 2026 unless dated)
- Booster Prep: "Mastering the DAT PAT" study guide; boosterprep.com/pat; help articles "What is PATBooster" and "Keyholes expanded solutions".
- Bootcamp.com: "How to ace the PAT section on your DAT"; bootcamp.com/dat; bootcamp.com/dat/upgrade; "Thomas' guide to achieving a perfect PAT score".
- Kaplan: keyhole (projections), angle ranking (elimination), hole punching (symmetry) and pattern folding (key landmarks) strategy pages; "What's tested on the DAT: PAT".
- Shemmassian Academic Consulting: "Angle discrimination for the DAT"; "Paper folding for the DAT".
- App Store: Crack DAT PAT Perceptual (id1467139544).
- TestPrepPal: free PAT practice tool.
- dat-prep.com: DAT PAT strategies.
- Varsity Tutors: aperture/keyhole, hole punching and 3D form development pages.
- Union Test Prep: PAT study guide, page 1.
- Test Ninjas: DAT perceptual ability test.
- masterstudent.ca: DAT PAT full breakdown.
- Wikipedia: Dental Admission Test.
- Student Doctor Network threads:
  - "Keyholes rules" (2007);
  - "PAT keyhole: silhouette projection or actual aperture" (2010);
  - "PAT angle rank degrees (CDP)" (2011);
  - "PAT angles: 4 degrees apart?" (2012);
  - "DAT PAT proportions different from Bootcamp's" (2014);
  - "Question about Boot Camp PAT generators" (2015);
  - "Hole punching section" (2020).

**Trademark records and law**
- markinton.com: DAT BOOSTER, serial 87011269 [F].
- trademarks.justia.com: DAT (stylised, with tooth), serial 90008811 [F].
- trademark.justia.com: ADA owner page, a partial list [F].
- *New Kids on the Block v. News America Publishing*, 971 F.2d 302 (9th Cir. 1992) [unverified, prior knowledge; not read].

## 12. ACCESS: sources I could not open

- **ada.org PDFs by direct download.** The proxy denied them (HTTP 403, policy). They were read through the
  fetch tool's digest instead, so **their figures and example items were not seen**.
- **Student Doctor Network attachments.** "dat-test-2007-pdf" (the ADA 2007 sample test) came back as binary
  data, and direct download was denied (403). "2018_dat_guide-pdf" and "2022-dat-guide-pdf" were not tried.
- **PubMed and PMC** (reCAPTCHA):
  - PMC9726233 and PMC7068633 (spatial ability in health-professions education);
  - PubMed 12117093 (Gray & Deem 2002).
  - Not tried: PubMed 24192409 (haptic exercise as a predictor) and PMC12712560 (video games and technical
    skills in dental students, 2025).
  - PMC6820805 was read through a mirror.
- **Europe PMC REST full texts** for PMC9726233 and PMC7068633: the permission request timed out.
- **Wiley Online Library** (site errors):
  - Coy et al. 2003 (10.1002/j.0022-0337.2003.67.1.tb03616.x);
  - Novack et al. 2020, "Investigating Dental Aptitude Test results as predictors for preclinical and
    clinical scores" (10.1002/jdd.12331);
  - Ranney et al. 2005 review (10.1002/j.0022-0337.2005.69.10.tb04010.x);
  - Gansky et al. 2004 (10.1002/j.0022-0337.2004.68.9.tb03848.x).
- **zendy.io records** (empty pages): 10.21815/jde.018.043 and 10.1002/jdd.12331.
- **ResearchGate** (Hegarty et al. 2009): error. **peeref.com** work 78352254: login wall.
- **katalog.lib.cas.cz** records: bot block. **HAL** copy of Dillon et al.: bot block (the normalesup.org
  copy was read).
- **Other documents:**
  - Scribd "2019 DAT Guide": wrapper only.
  - Deep Blue (umich) J Dent Educ 2013 PDF: script page, no text.
  - JMIR PDF e68538: empty (the HTML version was read).
  - Canadian DAT Candidate Guide (media.cda-adc.ca): the permission request timed out.
- **Not searched, because the shared search budget ran out:**
  - published PAT retest or score-gain data;
  - studies relating prep practice-test scores to real PAT scores;
  - the USPTO record of the ADA's DAT mark;
  - the Novack 2020 abstract;
  - the Prometric DAT tutorial.

## 13. Flags: design decisions that rest on documents not read in full

1. **Answer counts and drawing conventions** (§2.2, §8.0). The ADA instruction sheet's diagrams were not
   seen. The Paper Folding count (4 or 5) is unresolved, and Form Development's 4 comes from prep pages only.
2. **Openings may be turned and flipped (D4)** (§8.5). This rests on the official text read through the
   digest ("may be turned", "a side not shown") and on Booster's help page [secondary]. No official example
   was seen.
3. **END view = right-side view** (§8.2). An inference from third-angle layout; the digest of the official
   sheet does not say "right".
4. **The angle-gap range of 1.5–8°** (§8.3). It rests on prep pages and forum anecdotes from 2011–2012.
   Dillon et al. was read in full but measured a different task.
5. **Hegarty et al. 2009 was not read.** Any statement that education changes dentistry-specific but not
   general spatial skill rests on two secondary reports.
6. **The ADA validity and norm figures** (§2.1, §4.1) were read through the digest from tables. The User's
   Manual was queried twice and agreed; the raw tables were not seen.
7. **The classic independent validity studies** (§4.1) come through Schmid 2020's review [S]. Coy et al.
   2003 and Kramer et al. 1989 are known by title only.
8. **Practice-effect sizes in the honesty line** (§4.2): Scharfen et al. 2018 was read in part,
   Hausknecht et al. 2007 as an abstract only.
9. **The DAT mark's legal status and the nominative-use test** (§6) are inferred from the ADA's ® usage and
   from prior knowledge. This is not legal advice.
