# T1: the transfer portfolio (bets, relational comparison, bridging, near and far probes)

Research notes for Parallax v1.2, Phase 1 (research and plan). Written 2026-11-18 (UTC) by research subagent T1. Only this file was written; no app file was changed.

Status: complete. The shared web-search budget ran out part-way, so some checks were not made; they are listed under "Could not open", each with the assumption used meanwhile.

## 0. Summary (direct answers)

**Q1. Mechanisms and their evidence** (§2.3; grades A–D defined in §3):

| Mechanism | Grade | Evidence |
|---|---|---|
| Variability that defeats tricks | B | strongest for transfer to untrained spatial tasks (Wright 2008; Uttal 2013 across-cell 0.55) |
| Relational comparison | B for learning principles, D for spatial transfer | case-comparison meta-analysis d = .50, with sharp moderators (Alfieri 2013) |
| Taught strategies and switching | B− | Stieff 2014; Boone & Hegarty 2017; Hegarty 2018 |
| Producing the answer (sketching, marking, hands-on) | C | predictive sketching d ≈ 0.5 (Gagnier 2017); manipulatives in children |
| Attention control | C | games → attention g = 0.52; MOT training transfers little |
| Adaptive load on capacity | C, near only | same-paradigm transfer only (Gathercole 2019) |
| Explicit bridging | C/D | menu prompts and explicit principles help in games; programme-level evidence is mixed (an independent RCT of a thinking-skills programme was null) |
| Practising a test's formats | A, for that format only | retest and coaching effects |
| Calibration of intuitive estimates (new) | D | bias corrected within a session; transfer untested |

Newer: the sceptical review of 2023 puts corrected far-transfer effects at about zero. The largest randomised spatial-training study (17,648 children) found rotation training the weakest route to maths. Preparation-for-future-learning measures transfer as faster learning of new tasks.

**Q2. Nine bets for `def.bet`** (§3):

| Bet | Main bet of |
|---|---|
| `attention` | track |
| `load` | span |
| `variety` | fold, spin, hidden |
| `strategy` | rotate, orient |
| `compare` | nets, knots |
| `bridge` | slice |
| `produce` | views |
| `calibrate` (new) | reckon, homing, centralpoint |
| `format` | the six DAT-style exercises |

`calibrate` is the new bet: it is untested, cheap, informative per trial, and makes a falsifiable prediction, including a possible negative transfer. `produce`, `compare` and `bridge` are under-tested for spatial skills. Central Point's draft tag ("spatial estimation and optimisation") names a skill, not a mechanism; tag it `calibrate`.

**Q3. Implementations** (§4).
- **Comparison rounds:** two solved items, aligned side by side; "What is the same?" with a one-tap menu; the principle shown after; one apply item. 25–60 s; at most two per session; spaced over weeks.
- **Bridge sets:** a concrete–idealised pair, a focused mapping question, two concrete items, and a one-tap "where else?" choice. 60–90 s; about every two weeks per exercise.
- **Production variants:** draw the view on a dot grid; mark holes; mark the cut.
- **Every format choice is evidence-led:**
  - similarities only, d = .68;
  - principle after the comparison, 1.18;
  - choosing beats typing (0.71–1.20 vs −0.06);
  - focused prompts tie game terms to real ones;
  - concreteness fading.
- **Dose evidence is thin:** brief comparisons work, but effects shrink by the next day.

**Q4. Probes and logging** (§5).
- **Near:** "Other Way Round": six strands (turn as shown, fold-back, cut-back, net-back, view-from, where-am-I), 18 items, about 4–5 min.
- **Far:** a new "Motion Graphs" probe (strobe pictures ↔ graphs over time, frames of reference) forms a far composite with Mechanisms. Level stays optional and reported alone. "Contours" is an alternative pending a source.
- **Lab checks:** Balance (Central Point's negative-transfer check) and learning curves on new exercises.
- **Staying untrained:** reserved formats checked by a node test.
- **Export:** a `bet` and `layer` per trial; an events table (show-me, cards, check-ins, compare, bridge, off-screen, assignments, expectations); dose summaries; and randomised within-player "bet trials" for the add-on layers, read on the near-probe strands.

**Q5. Existing trainers** (§6). Courses carry transfer through breadth, sketching, models, screening and embedding, without randomising their parts. Apps carry engagement and adaptivity, and some carry overclaims. Parallax can be the first, in the sources read, to make its bets testable by its players.

## 1. Method and reading levels

- **Repository read:** the owner's standing rules (kept outside the repository; the parts on transfer), docs/research/v1.0/A-evidence.md and B-tasks.md (in full), C-progression.md §8 and its reference list, docs/research/v1.1/R4-test-overlap.md (§1–§4), R1-path-integration.md and R3-dat-pat.md (grep and the sections cited), rows T1–T3, S1, S3 and ME1 of docs/dev/v1.2/standing-rules-gap.md, docs/dev/DESIGN-PLAN.md §3–§8, docs/dev/PLAN-v1.2.md (milestones 0, 4, 6, 8), js/ex/registry.js (lines 1–260), the learn.js files of fold, rotate, reckon and knots, the `bridge` and `offscreen` lines of every learn.js (grep), the strategy and show-me code paths in js/ui/play.js and js/ui/library.js (grep), the research-export columns in js/ui/log.js and js/ui/lab.js, and the guide's transfer chapter (docs/guide/guide.html, the "How Parallax trains for transfer" table).
- **Web:** WebSearch for titles and URLs, WebFetch for pages and PDFs. The shared web-search budget of this turn ran out part-way through; after that only URLs that had already appeared could be opened, so several planned checks were not made. They are listed under "Could not open", each with the assumption used.
- **Reading levels** after each source: **[FT]** full text passed through the fetch tool, which read the whole text and answered my questions about it (I did not read every page myself; for long PDFs, the parts named); **[FT-ms]** full text of an author manuscript or thesis version; **[PT]** part of the full text; **[AB]** abstract or publisher summary only; **[SR]** secondary report, with the reporting source named (for earlier Parallax notes: "SR via A", "SR via C" and so on, meaning those notes' own reading level applies); **[WP]** a non-academic web page read in full.
- **Labels in the text:** **Found** = what a study or review reported; **Inference** = my reading of it; **Proposal** = a design proposal for Parallax. Grades for bets are defined in §3.

## 2. Q1: mechanisms that could carry spatial training to untrained tasks

### 2.1 Failure modes from the sceptical meta-analyses (design around them)

The standing rules ask that the sceptical literature be read as a list of ways earlier trainers failed. Each row: what was found, then what Parallax does about it.

| # | Failure mode | Found | Proposal for Parallax |
|---|---|---|---|
| F1 | Far-transfer effects vanish once placebo and publication bias are controlled | Gobet & Sala 2023 [FT-ms]: first-order far-transfer effects of 0.04–0.19 uncorrected, −0.03 to 0.02 with active controls and bias correction; true heterogeneity small to null; second-order meta-analysis of 14 meta-analyses, 332 samples, 21,968 people (Sala et al. 2019). Placebo effects on far transfer about 0.15–0.20 SMD at best. Simons et al. 2016 [SR via A]: strong evidence for trained tasks, less for close ones, little for distant ones. | Never judge a bet by raw pre–post change. Every bet is read against the Word Links control, the retest model and, where possible, a within-person randomised "off" condition (§5.3). |
| F2 | Expectations produce gains | Foroughi et al. 2016 [SR via A]: the same hour of training raised matrix scores only in people recruited with a suggestive advertisement (RAPM d = 0.50). | "The bet" lines (S3) raise expectations by design. Log an expectation rating per bet at baseline; randomise layers within players so expectations are shared by the "on" and "off" arms (§5.3). |
| F3 | Gains belong to the trained paradigm | Gathercole et al. 2019 [FT-ms]: across 24 RCTs of adaptive WM training, transfer to untrained tasks of the same paradigm was d = 0.54–0.90; to other paradigms d = 0.11–0.16 (serial recall, complex span), and backward span 0.35 n.s. Their reading: training builds new task routines that only carry over to tasks the routine fits. | Count gains on a shared format as near transfer only (`format` bet, §3). Near probes use formats reserved from training (§5.1), so they test the operation, not the routine. |
| F4 | Retest and familiarity | Scharfen et al. 2018 [SR via A]: +0.33 SD at the 2nd test, +0.50 by the 3rd, then flat; alternate forms 0.23 vs identical 0.37. te Nijenhuis et al. 2007 [SR via R4]: retest gains are larger on less g-loaded subtests (r = −.80). | Alternate forms, two baselines, the retest model (already in assess.js). New probes need three forms each. |
| F5 | Shortcuts solve the training items | Hegarty 2018 [FT]: about half of the MRT's foils can be rejected without rotating (structure foils). Burte et al. 2018 [SR via B]: a "folds × 2 holes" rule fitted Paper Folding behaviour best; only about 22 % mainly unfolded. | Rule 5's shortcut solvers also run on comparison pairs, bridge items and new probes. |
| F6 | Only speed improves | Uttal et al. 2013 [SR via A]: rotation training moved response time (g = 0.69) more than accuracy (0.31). Smid, Karbach & Steinbeis 2020 [FT]: avoid training that only shortens response windows, since it may not build capacity. | Report accuracy and response time apart (as now). Do not read a pure speed gain on Spin or Speed mode as a capacity gain. |
| F7 | Effects fade, and few studies look later | Uttal 2013 [SR via A]: 4 of 206 studies tested after more than a month. Miller & Halpern 2013 [SR via A]: physics and spatial effects gone at 8 months. Alfieri et al. 2013 [FT]: comparison effects d = .57 when tested at once, .22 the next day. | Judge bets on delayed checks (the 28-day delayed check that DESIGN-PLAN §6 already plans), never on in-session accuracy. Repeat comparison and bridge steps spaced over weeks. |
| F8 | Small samples, lab-of-origin effects, flexible analysis | Bediou et al. 2018 [SR via A]: lab of origin was the only significant moderator (one lab g ≈ 1.0, others ≈ 0.2). Gobet & Sala 2023: sampling error read as true variance; multiple comparisons; pre-test/gain correlations that are regression to the mean. | Pool many players; fix the analysis in advance (guide and Lab); few primary outcomes (the probe composites); average several baselines before reading moderators such as "low starters gain more". |
| F9 | One far test stands in for "far transfer" | Gobet & Sala 2023 recommend several measures or latent factors. | Two far probes (Mechanisms, plus a new one) read as one composite (§5.2). |
| F10 | Developer-led studies look better than independent trials | Cognitive Acceleration (CASE family): developer-reported effects of 0.30–0.44 on GCSE grades three years on (Shayer & Adhami 2007, via the REF impact case study [WP]); the independent EEF randomised trial of a shortened version, 53 schools and over 8,000 pupils, found about −1 month of progress (an effect size of magnitude 0.02; the page's sign was ambiguous) [WP]. | Treat Parallax's own bets as bets; publish the pooled-analysis code and invite others to run it. |
| F11 | Isolated drills vs contextual practice | Smid et al. 2020 [FT]: contextualised training is likelier to transfer than isolated practice of one component. Lowrie & Logan 2023 [FT]: an embedded spatial programme beat isolated digital training on the trained skills (η² = .029); both beat business-as-usual on maths (η² = .027). | Bridges as tasks, not only text (§4.2). |
| F12 | Mechanism never established | Smid et al. 2020 and Gobet & Sala 2023 both ask for process analyses (strategies, response times, models) before large trials. | Each bet names its mechanism and a measurable signature (§3), and exposure to it is logged (§5.3). |

### 2.2 Spatial-training and maths/STEM evidence since v1.0 (2022–2026)

v1.0's notes (A §1–§5) already hold the core numbers: Uttal et al. 2013 (g = 0.47; across-cell transfer 0.55 ≈ within-cell 0.51), Hawes, Gilligan-Lee & Mix 2022 (maths g = 0.28, spatial g = 0.49; larger with concrete manipulatives and for maths close to training; dosage n.s.), Bediou et al. 2023 (games: spatial g = 0.26, n.s.; top-down attention 0.52), Sorby's course, Miller & Halpern 2013, Lowrie's classroom trials and Gilligan-Lee et al. 2023. New in this pass:

- **Judd & Klingberg 2021**, Nature Human Behaviour 5(11) [AB; plus the Karolinska press release, WP]. **Found:** 17,648 children aged 6–8; 7 weeks of number-line maths training (about half of the time) plus a randomly assigned spatial component, 20 or 33 minutes a day. Reasoning (spatial pattern sequences) and visuospatial working-memory training improved maths learning more than rotation or tangram training. No passive or maths-only control, so absolute effects are unknown. **Inference:** in the largest randomised comparison of spatial training types, plain rotation practice was the weakest route to maths. Parallax's rotation-heavy exercises should not carry a maths bet.
- **Lowrie & Logan 2023**, J Intelligence 11(6):127 [FT]. **Found:** 287 Grade 4 pupils in 15 classes, randomised by class: business as usual (97), isolated digital training (98; about 40 min a week for 14 weeks) and an embedded programme (92; about 60 min a week, Experience–Language–Pictorial–Symbolic–Application sequence). Embedded beat both on the trained skills; both beat control on untrained spatial skills (η² = .023) and maths (η² = .027). The authors propose the trained skill as mediator (exploratory indirect effect .425) and argue that skills taught inside rich activities transfer better. **Inference:** the language and application stages are a classroom form of bridging; the paper does not isolate them.
- **Zhu et al. 2023**, Frontiers in Education 8, narrative review [PT]. **Found (as cited there):** brief computer training of 3–6 minutes in 8-year-olds moved number-line estimation (d = 0.24, spatial scaling) and missing-term problems (d = 0.24, rotation) (Gilligan et al. 2020); a gesture, spatial-language and feedback programme helped low-SES children on 2D tasks (β = 0.28) and some untrained 3D tasks (β = 0.19) (Bower et al. 2020). The review notes that maths transfer did not depend on training length or on the size of the spatial gain (Hawes 2022), which questions whether transfer runs only through a better spatial skill.
- **Gobet & Sala 2023**, Perspectives on Psychological Science [FT-ms]: see F1, F8, F9. Spatial training is not analysed there; Uttal 2013 is cited as near transfer.
- **Not found:** a new spatial-training meta-analysis from 2023–2026. A 2026 Educational Psychology Review paper that turned up is a single-paper meta-analysis of sex differences, not of training [PT]. The search budget ran out before this check was thorough (see "Could not open").

### 2.3 Mechanism by mechanism

Grades are defined in §3 (A strongest, D untested). Each mechanism: what was found, my inference, and what Parallax has or could have.

**M1. Adaptive load on capacity.**
- **Found:** Lövdén et al. 2010 [AB]: plasticity is driven by a prolonged mismatch between what a person can supply and what the task demands; a brief mismatch is not enough. Gathercole et al. 2019 [FT-ms]: adaptive WM training transfers within its paradigm (d = 0.54–0.90) and barely beyond (0.11–0.16). Sala et al. 2019 and Gobet & Sala 2023: far transfer from WM training is null once controlled. Lampit et al. 2014 [SR via C]: more than three sessions a week added nothing in older adults.
- **Inference:** adaptive load is necessary for trained-task growth and is the condition under which any capacity change could happen, but by itself it buys near transfer. Grade **C** (near only; far null).
- **Parallax now:** ratings, item mix at a target success rate, staircases (Span length, Track speed, Spin deadline). Planned: per-dimension offsets (P1).

**M2. Variability that defeats task-specific tricks.**
- **Found:** Wright et al. 2008 [SR via A/R4]: 21 days of rotation or paper-folding practice transferred to the other task and to new items ("process based, not instance based"), not to a verbal-analogy control. Uttal 2013: across-cell transfer 0.55 ≈ within-cell 0.51. Raviv, Lupyan & Green 2022 [AB; details SR via C]: variability slows early learning and improves generalisation; novices are hurt by variation on dimensions that decide the answer and helped by variation in incidentals. Interleaving similar-looking categories: Brunmair & Richter 2019, g = 0.42; Rohrer & Taylor 2007, volumes of solids, mixed 63 % vs blocked 20 % correct a week later [SR via C].
- **Inference:** the strongest-evidenced mechanism for transfer *within* spatial ability (to untrained spatial tests). Its spatial-specific form is shortcut-proofing: items in which no cheap rule works leave only the transformation to learn. Grade **B**.
- **Parallax now:** seeds never repeat, variants, shortcut bounds (rule 5), mirror foils only, equal hole counts in Fold, uncued interleaving (S4–S5).

**M3. Explicitly taught general strategies, and switching.**
- **Found:** Stieff et al. 2014 [SR via A]: teaching both imagery and analytic strategies removed a sex gap in organic chemistry; either alone did not. Hegarty 2018 [FT]: the global-shape strategy correlated with MRT accuracy (r = .37, n = 47); taught in a same–different version with structure foils, it raised performance and removed the sex difference (Boone & Hegarty 2017, described there, numbers not given); she argues strategies may be more malleable than capacity. Meneghetti et al. 2017 [SR via R4]: a taught rotation strategy went with better perspective taking and fluid scores at follow-up (within-group). Klauer's inductive-reasoning training, which teaches a general comparison strategy, raised fluid-intelligence scores, d = 0.60 over 109 studies [SR via R4]. Smid et al. 2020 [FT]: strategy training tends to help high performers more; process training helps low performers more.
- **Inference:** a strategy is a portable routine; it transfers where the new task admits the same routine (Gathercole's account again). Grade **B−** for spatial tasks (one large course study, one set of lab studies, correlations).
- **Parallax now:** imagery, analytic and "when to switch" cards for every exercise; offered after two misses; one-tap check-ins. Thin: nothing makes a strategy necessary on given items, and card views are not logged.

**M4. Relational structure and comparison (analogical encoding).**
- **Found:** Alfieri, Nokes-Malach & Schunn 2013 [FT], 57 experiments, 336 tests: case comparison d = .50 [.44, .56] over other conditions (.37 over sequential study of the same cases). Moderators: principle given *after* comparison d = 1.18, none .47, before .37; asking for similarities only .68, similarities and differences .28, differences only −.19 (6 tests); perceptual content .72, conceptual .54, procedural .40; near transfer .52, far .34; lag: immediate .57, same day .44, next day .22; duration n.s. (brief .58, long .66); prompted vs guided n.s. Gentner, Loewenstein & Thompson 2003 [SR via C]: comparing two cases raised transfer from 19 % to 48 %, and learners rarely compare unprompted. Spatial and STEM cases: Jee et al. 2013 [AB], geology faults: comparing visually similar contrasting photos (fault / no fault) beat viewing each case separately, and similar pairs helped most early in learning; Gentner et al. 2016 [FT], 110 children in a museum: 2–3 minutes of comparing a model braced with a diagonal and one with a horizontal crosspiece raised later use of a diagonal brace over no training (no delayed test); Smith & Gentner 2012 [FT]: side-by-side comparison beat sequential study for graph learning (d = 0.77, n = 32), and highly alignable pairs beat less alignable ones (d = 0.42, one-tailed, n = 62). Matlen, Gentner & Franconeri 2020 [FT]: comparison is faster and more accurate when corresponding parts line up across the pair (four experiments, N = 14–55).
- **Inference:** the best-evidenced *learning* mechanism in this list, and the strongest moderators point to a cheap, phone-friendly format: two cases side by side, "what is the same?", then the principle. It has not been tested on spatial-skill transfer. Grade **B** for learning a principle; **D** for spatial-skill transfer.
- **Parallax now:** Knots' tutorial uses a minimal pair; nothing else (gap T1).

**M5. Attention control.**
- **Found:** Bediou et al. 2023 [SR via A]: action-game training improved top-down attention, g = 0.52 [0.25, 0.79], the only significant domain. Multiple-object-tracking training: large gains on the trained task, weak or no transfer (Vater et al. 2021, 29 studies, none preregistered; Harris et al. 2020; Romeas et al. 2025) [SR via A/B].
- **Inference:** a real route to attention tasks for game-like training; MOT practice itself has shown little. Grade **C**.
- **Parallax now:** Track, labelled attention practice.

**M6. Explicit bridging to real tasks.**
- **Found:** Perkins & Salomon 1988 [SR via C; primary blocked]: "hugging" makes practice resemble the target ("low road"); "bridging" prompts explicit abstraction and connection ("high road"). Self-explanation prompts: g = .55 [.45, .65], 64 reports, N = 5,917 (Bisra et al. 2018 [FT-ms, as reproduced in a thesis chapter]); learning time under 30 min g = .71 (duration n.s.); multiple-choice prompts g = .24 but only k = 2. Inside games: choosing the reason for each move from a list improved an embedded transfer level (d = 1.20 and 0.71); typing the reason did not (d = −0.06) (Johnson & Mayer 2010 [AB]). Prompts helped most when they tied game terms to maths terms, least when very simple or very abstract (O'Neil et al. 2014, N = 114 [AB]). A principles sheet during play raised transfer (d = 0.77, N = 50); when players had to fill in the principles themselves, only those who got them right gained (d = 0.53) (Fiorella & Mayer 2012 [FT]). Concreteness: training with variable appearance, and best with concrete-to-idealised "fading", transferred a science principle better than consistently concrete or idealised displays (Goldstone & Son 2005 [FT], N = 84 and 88). Programme level: thinking-skills programmes 0.62 on cognitive outcomes, Instrumental Enrichment 0.58 (Higgins et al. 2005 [AB]); but see F10.
- **Inference:** bridging works when the learner is shown, or picks, the specific mapping between the practised task and the real one; free-form "think of a use" adds little for novices. Untested for spatial skills. Grade **C/D**.
- **Parallax now:** one "where this is used" paragraph per exercise; off-screen challenges for Fold, Nets and Views.

**M7. Producing the answer: sketching, marking, hands-on.**
- **Found:** predictive sketching (draw the hidden interior of a cut block, then compare with the answer) improved penetrative thinking on new items, d = 0.51 over predicting without sketching and 0.58 over a time-matched copying control (Gagnier, Atit, Ormand & Shipley 2017 [FT-ms], N = 105, up to 50 min). Concrete manipulatives moderated maths transfer (Hawes 2022) and gave larger maths gains in an RCT (Gilligan-Lee et al. 2023, N = 182) [SR via A]. Sorby's sketching-based course: PSVT:R gains of 21.8–30.3 points across cohorts (quasi-experimental) [FT, Sorby & Veurink]. Seeing the informative views mattered more than interacting (Keehner et al. 2008) [SR via A].
- **Inference:** the active ingredient seems to be a complete, externalised prediction checked against the answer, not motion of the hands as such. A phone can ask for that (tap the holes, tap the edge crossings, fill the view grid). Grade **C** (one RCT, within format).
- **Parallax now:** answers are choices in most exercises; Orient, Homing and Reckon already take produced answers (angle, position).

**M8. Practising a test's own formats (identical elements).**
- **Found:** retest and coaching effects (F4); coaching δ = .70 vs practice .24 (Hausknecht et al. 2007 [SR via R4]); rule teaching for matrices d = .92 to ≥ 1.19 (R4 §4.2); WM paradigm match (F3).
- **Inference:** reliable near transfer to that format, hollow beyond it. Grade **A** for the format, none beyond.
- **Parallax now:** the six DAT-style exercises, opt-in.

**M9. Calibrating an intuitive estimate (new).**
- **Found:** in a landmark-free steering task, per-trial feedback removed distance overshoot within one session (radial gain 1.10 → 0.97; Noel et al. 2020 [SR via R1]); coarse star feedback over few trials did not (Akan et al. 2026 [SR via R1]); no randomised path-integration training study with a transfer test was found (R1 §4). In number cognition, training an intuitive spatial-numeric estimate has a mixed record: a linear board game improved preschoolers' magnitude comparison, with arithmetic and number-line effects not significant in the WWC's reading (Siegler & Ramani 2009 [SR via WWC]); approximate-number training has not been shown to improve symbolic arithmetic (Szűcs & Myers 2017 [FT-ms]). People estimate the centroid of dot clouds well (about 18 px from it for a 60 px spread), with observers differing consistently in whether far dots get more or less weight (Drew, Chubb & Sperling 2010 [FT]); balance-point judgements of two discs are poor and improved only modestly after a 15-minute lesson (Liby et al. 2009 [FT]). From the parallel Central Point notes [SR via C1]: in "find the middle" tasks most observers follow the centre of gravity even for heavy-tailed clouds, and discount outliers only when they look like a separate group (Juni, Singh & Maloney 2010); a size bias in perceived mean position persisted after training with feedback (Hong, Witt & Szafir 2021); no study has measured or trained unaided estimates of the geometric median.
- **Inference:** exact feedback on continuous answers can correct a systematic bias quickly (Noel 2020), but a bias that comes from a default rule may survive feedback alone (Hong 2021). The stronger version of the bet pairs exact feedback with the explicit rule (the compare round of §4.1), and the bet trials' `calib-detail` arm can test that. Whether a correction carries to other tasks that use the same estimate is untested. Grade **D**.
- **Parallax now:** Reckon's drift and habit feedback, Homing's angular error; Central Point (planned) with a quality map.

**M10. Newer ideas worth carrying (2022–2026 and older under-used ones).**
- **Preparation for future learning.** Bransford & Schwartz 1999 [FT]: judge transfer by how well earlier learning helps people learn something new from resources, not only by solving cold. **Inference:** for spatial training this means measuring how fast players learn a new spatial task. Parallax gets this almost for free: every exercise added in an update is a new task whose early learning curve is logged (§5.2).
- **Explanatory feedback.** The guide cites d = 0.99 for feedback with task and process information against 0.46 for right/wrong plus answer (Wisniewski et al. 2020) and d = 0.37 for animation over static pictures (Höffler & Leutner 2007) [SR via the guide]. Show-me is Parallax's form of it; its exposure is not logged yet (T3).
- **Contextualised training and mechanism-first design** (Smid et al. 2020 [FT]) and **process data** (Gobet & Sala 2023): response times, strategy reports and error types are the signatures that let pooled data say *why* a bet worked.

## 3. Q2: the fixed bet list for `def.bet`

**Grades** (for the transfer each bet aims at, not for trained-task gains, which every exercise shows):
- **A**: meta-analytic or replicated evidence that the mechanism produces this transfer.
- **B**: meta-analytic evidence for the mechanism in learning generally, or several controlled spatial studies.
- **C**: one or a few controlled studies, evidence for near transfer only, or mixed results.
- **D**: untested for spatial training; the mechanism is plausible. A new bet.

### 3.1 The list (Proposal)

Nine bets. Ids are short, lower-case and stable; the "bet line" is a draft of the player-facing line for S3 (a bet, never a promise).

| id | Bet line (draft) | Mechanism | Evidence (Found, §2.3) | Grade | Main bet of |
|---|---|---|---|---|---|
| `attention` | Following several moving things against distraction trains the control of attention. | Top-down attention control (M5) | Games → top-down attention g = 0.52; MOT training: large trained-task gains, weak transfer | C | track |
| `load` | Working at the edge of what you can hold stretches what you can hold. | Sustained supply–demand mismatch (M1) | Same-paradigm transfer d = 0.54–0.90, other paradigms 0.11–0.16; far null | C (near) | span |
| `variety` | When no trick works, you learn the transformation itself, and other tasks use it too. | Process-level learning; shortcut-proof variability (M2) | Rotation ↔ folding transfer (Wright 2008); across-cell 0.55 ≈ within-cell 0.51 | B | fold, spin, hidden |
| `strategy` | Two named ways to solve, and knowing when to switch, carry over to new problems. | Portable routines and flexible choice (M3) | Imagery + analytic closed a chemistry sex gap (Stieff 2014); global-shape teaching (Boone & Hegarty 2017); inductive-reasoning training d = 0.60 | B− | rotate, orient |
| `compare` | Seeing what two different problems share makes the shared rule easier to spot elsewhere. | Analogical encoding (M4) | Case comparison d = .50; similarities-only .68; principle after 1.18; perceptual .72; spatial STEM cases (Jee 2013; Gentner 2016) | B (learning) / D (spatial transfer) | nets, knots |
| `bridge` | Solving the same kind of problem in real settings helps you notice when it applies. | High-road transfer: mapping the practised task onto real ones; concreteness fading (M6) | Menu-chosen reasons in a game d = 1.20 / 0.71, typed −0.06; principles sheet d = 0.77; fading beat fixed displays (Goldstone & Son 2005); CASE trial null (F10) | C/D | slice |
| `produce` | Building the answer yourself, before seeing options, builds a fuller picture in your head. | Externalised prediction checked against the answer; hands-on (M7) | Predictive sketching d = 0.51–0.58 on new items (Gagnier 2017); manipulatives moderate maths transfer (Hawes 2022) | C | views |
| `calibrate` | Exact feedback on your estimates corrects a habit you may also use away from the game. | Recalibration of an intuitive estimator (M9) | Bias removed within a session (Noel 2020); transfer untested; number-sense analogues mixed | **D (new)** | reckon, homing, centralpoint |
| `format` | Practising a test's own question types raises scores on those question types. | Identical elements; task routines (M8) | Retest +0.33 → +0.50 SD; coaching δ = .70; paradigm match (Gathercole 2019) | A (that format only) | angles, cubes, openings, form, patfold, patviews |

Why these nine and not others (Inference):
- **Interleaving, explanatory feedback (show-me), spacing and dose** act on every exercise through the schedule or the player, so they cannot be one exercise's distinctive bet. They stay portfolio-wide **layers**, logged as exposure (§5.3). Interleaving stage is already in every trial row.
- **Learning to learn / preparation for future learning** is a way to *measure* transfer (§5.2), not a feature one exercise can carry.
- **Fluency (speed)** was considered for Spin and Speed mode and left out: the best spatial evidence shows speed gains outrunning accuracy gains (F6), and Smid et al. 2020 warn that shortened response windows may not build capacity. Spin's distinctive feature that has evidence is its never-repeating random shapes (`variety`).
- **Hidden** was considered for `attention` (resisting the pull of the whole figure). The training evidence for disembedding is thin either way; its implemented feature is shortcut-proof candidates (same segment counts per direction, near-miss foils), which is `variety`.

### 3.2 Exercise assignment and why

| Exercise | Bet | Reason (Proposal) |
|---|---|---|
| track | attention | Labelled attention practice already; the attention evidence is the game-training evidence, not MOT's. |
| span | load | Length, crossings and board turn adapt; the WM-training evidence applies, including its limits. |
| fold | variety | Equal hole counts and "missed fold" foils defeat the folds × 2 heuristic; rotation ↔ folding transfer (Wright 2008). |
| spin | variety | A new random polygon every item. The deadline is load, but speed-only gains are a known failure mode (F6). |
| hidden | variety | Candidates share segment counts; near-miss foils one segment off. |
| rotate | strategy | The best spatial strategy evidence is for rotation (global shape, holistic vs piecemeal, switching). |
| orient | strategy | Two known routes (imagine your body turning vs turning the map) and a known failure past about 90° (B §5). Direct training evidence: none found [gap]. |
| nets | compare | Crisp, verifiable principles (two apart in a straight row → opposite; corner-sharing squares → shared edge). |
| knots | compare | Its tutorial already uses a minimal pair ("crossing switched: it falls open"). |
| slice | bridge | The biggest distance between idealised training and real uses (scans, fruit, rock, pipes), and the real uses are easy to draw and check. |
| views | produce | Sketching views is the core of the engineering spatial course; a grid of dots makes a drawn view exactly checkable. |
| reckon, homing | calibrate | Continuous error, and Reckon already shows drift and habit. |
| centralpoint (EX-20) | calibrate | See §3.3. |
| angles, cubes, openings, form, patfold, patviews | format | They are the DAT PAT formats by design; any gain on the PAT is near transfer (R3, R4). |

Counts: variety 3, calibrate 3, strategy 2, compare 2, format 6, one each for attention, load, bridge and produce.

**Inference that limits the tags:** a tag fixed to an exercise confounds the bet with the exercise (Fold may transfer more than Span because folding is more like other spatial tasks, not because of variability). Tags say what an exercise is designed around; they cannot test a bet. Testing needs the add-on layers (compare rounds, bridge tasks, production variants, calibration feedback) switched on and off at random within players (§5.3).

### 3.3 Central Point: where this note departs from the draft plan

- The draft plan (PLAN-v1.2 milestone 8) tags Central Point "spatial estimation and optimisation" as the new bet. That names a skill, not a mechanism by which training could carry over. **Proposal:** tag it `calibrate`; keep "spatial estimation" as its ability description.
- **The principle it teaches** is relational and checkable: at the best spot every target pulls with the same strength whatever its distance (the pulls are unit vectors that cancel), whereas at the average position far targets pull harder. That gives Central Point a natural comparison pair (§4.1) and a falsifiable prediction (below).
- **Negative-transfer risk (Inference):** a player who learns "far targets pull no harder than near ones" might carry it to balance and centre-of-mass judgements, where the average *is* right. Centroid judgements of dot clouds are accurate and individually stable in their weighting of far dots (Drew et al. 2010), so a shift is measurable. **Proposal:** a short "Balance" check (§5.2) and no drawing of the average position in Central Point's feedback, so the check stays untrained.
- **The "aim for the average" claim:** this pass found no source on the task itself. The parallel notes C1 §2.2–2.4 [SR via C1] report that people looking for the middle of a point cloud follow its centre of gravity (Juni et al. 2010), and that no study has measured geometric-median estimates. So it is a reasonable prediction from find-the-middle studies, not a finding on this task. Word it that way in the tutorial and guide, and let pooled data measure it.

### 3.4 Registry and tests (Proposal)

- `PX.ex.define` gains `bet` (required when `role === 'train'`, forbidden for probes), checked against a frozen `PX.ex.BETS` list: `{ id, label, line, mechanism, grade }`. The list carries a `BETS_VERSION` written into exports, so a later change of wording or grade is traceable.
- Node test: every training exercise has exactly one bet from the list; every bet in the list is the main bet of at least one exercise or is marked `layer`; probe definitions have none.
- The exercise page and How to play show the bet line; the research export writes `bet` per trial (or a lookup table in the header).
- Every number a bet line or the guide quotes for a bet comes from this note's §2.3, with the source.

## 4. Q3: real implementations of relational comparison and bridging

### 4.1 Relational comparison ("what is the same?")

**Format decisions and the evidence behind each** (Found → Proposal):

| Decision | Found | Proposal |
|---|---|---|
| Both cases at once | Comparison beat sequential study of the same cases (d = .37) and single cases (.92) (Alfieri 2013); side by side beat sequential for graphs (d = 0.77; Smith & Gentner 2012) | Two solved items on one screen, never one after the other |
| Line the pair up | Direct alignment of corresponding parts was faster and more accurate; look-alike clutter competes for matches (Matlen et al. 2020) | Stack the pair on phones in portrait, side by side on wide screens, same scale and same view angle; nothing decorative near them |
| Ask for what is the same | Similarities only .68; similarities and differences .28; differences only −.19 (Alfieri) | One question: "What is the same in both?" |
| Choose, don't type | Choosing a reason from a list helped an embedded transfer level (d = 1.20, 0.71); typing did not (−0.06) (Johnson & Mayer 2010) | 3–4 short statements; one tap |
| Principle after the choice | Principle after comparison 1.18, before .37, none .47 (Alfieri); an explicit principles sheet d = 0.77, self-filled only for those who got it right (Fiorella & Mayer 2012) | After the tap, always show the principle in one sentence, highlighted on both items |
| Close pairs first, far pairs later | Highly alignable pairs beat less alignable ones (d = 0.42; Smith & Gentner); similar contrasting cases helped most early (Jee 2013); the geoscience workbook moves from very similar to less similar structures [WP, SERC] | Stage 1: same exercise, same family, different surface. Stage 2: different settings or solids. Stage 3: across exercises (Rotate's mirror pair with Spin's) and concrete–idealised pairs (§4.2) |
| Use it at once, then again later | Immediate .57, next day .22; the principle-after condition decayed less (p = .056) (Alfieri) | One "apply" item right after, where the principle decides the answer; spaced repeats over weeks |
| Contrast pairs as a later step | Contrasting cases helped (fault / no fault, Jee 2013; diagonal vs horizontal brace, Gentner et al. 2016) | Later rounds: "Only one of these follows the rule. Which?" (a judgement, not a list of differences) |

**What the player sees and does** (example, Nets, stage 1):
1. After a Nets block, or after two misses on items that share a principle (the moment the strategy card is offered today), a card titled "Same rule?" replaces the next item.
2. Two solved nets, stacked, each with the marked pair of squares highlighted and the answer ("opposite") shown under it.
3. "What is the same in both?" with four statements, for example: the marked squares are two apart in a straight row (true of both); they touch at a corner (false for both); both nets have a 1-4-1 shape (true of one); the marked squares are the same colour (surface, false of one).
4. After the tap: the straight row of three lights up in both nets and one line appears: two squares with one square between them in a straight row always end up opposite.
5. One new Nets item where that rule decides the answer, scored as usual and marked as a compare "apply" item.

Time: 25–40 s for the pair, 10–20 s for the apply item.

**Principle library (Proposal, first set).** Each principle is a predicate the solver evaluates on an item model, and each general sentence must be proved before use: by exhaustive enumeration where the space is finite (the 11 cube nets and their marked pairs), by the generator's geometry otherwise.
- fold: an idle fold (the punch missed its flap: no new holes); a slanted crease (a hole moves straight across it to the same distance); last fold unfolds first.
- nets: two apart in a straight row → opposite; squares meeting at a corner of a shared neighbour → they share an edge once folded (to be checked by enumeration before use).
- slice: one side per face the plane crosses; a cut parallel to the base copies the base shape; a slanted cut through a cylinder gives an oval.
- rotate and spin: no turn can make a mirror image match (handedness); the cross-exercise pair is a 3D mirror pair beside a 2D one.
- orient: facing the other way swaps left and right.
- views: a line in a view marks a change of height or depth.
- knots: switching one crossing can untie a knot (the existing minimal pair).
- centralpoint: at the best spot every target pulls equally hard, however far away; moving a far target farther along the same line does not move the best spot.
- reckon: the final heading is the sum of all the turns.

**Validity checks (Proposal):**
- A pair (A, B) is valid only if the target predicate holds for both, and every distractor statement fails for at least one item.
- Distractors come from one fixed pool per exercise: other principles of the same exercise and surface features (shape class, colour, count). The correct statement is then not the odd one out.
- Rule 5's shortcut solvers also run on rounds: longest option, keyword overlap with the item's tip, and position. Each must stay within chance + 10 points.

**Dose (Proposal):**
- The first round comes after an exercise's first rated block.
- Later rounds: at most one per exercise per session, when a new principle becomes relevant (a level opens a new dimension), after two misses on a shared principle, or as spaced review at 3, 7 and 14 days (the existing review rhythm).
- Cap: two rounds per session across exercises, about 1.5 minutes, roughly 7 % of a 20-minute session.
- A principle retires after two spaced correct picks with correct apply items. It is rechecked at 30 days.

**Found on dose:** brief comparisons worked (2–3 minutes in Gentner et al. 2016; duration n.s. in Alfieri). There is no dose–response evidence. Retention beyond a day is the weak point.

**Logged per round:** see §5.3 (`compare` event). The apply item's outcome minus its predicted success (`p_pred`, already logged) gives an immediate uplift per principle. Delayed effects come from the near-probe strands (§5.1).

**Exercises (Proposal):** rounds for nets and knots (main `compare` hosts), plus fold, slice, rotate, spin, orient, views and centralpoint, so that all six near-probe strands can read the layer (§5.3). No rounds for the DAT-style exercises (their bet is the format), Track or Span.

### 4.2 Bridging as short applied tasks

**Format decisions** (Found → Proposal):
- **Concrete items solved with the practised operation.** Found: variable appearance, and best concrete-to-idealised fading, transferred a principle better than fixed displays (Goldstone & Son 2005). Proposal: each bridge set opens with a *bridge pair*: one concrete case beside its idealised twin, with "What is the same?" as in §4.1.
- **A focused mapping prompt instead of an open one.** Found: prompts that tied game terms to domain terms helped most; very simple or very abstract prompts least (O'Neil et al. 2014). Proposal: one menu question that maps a term, for example "In the scan, what plays the part of the cutting plane?"
- **Give the principle, don't make novices find it.** Found: explicit principles d = 0.77; self-generated principles helped only those who got them right (Fiorella & Mayer 2012). Proposal: show the mapping line after the choice.
- **"Name a real use" as a choice, with optional text.** Found: typing reasons had no benefit in a game (Johnson & Mayer 2010). Proposal: a one-tap list of four uses, plus "Other". Any text stays on the device and is never exported (privacy); only its presence is logged.
- **Contextualise.** Found: embedded programmes beat isolated drill on trained skills (Lowrie & Logan 2023). Proposal: bridge items are real items with real answers, not decoration.

**A bridge set, as the player meets it** (example, Slice, the main `bridge` host):
1. A pear-like solid of revolution beside an idealised cone-on-cylinder, both cut by the same slanted plane, with their sections shown. "What is the same?" → a slanted cut through a round solid gives an oval. Then the mapping line: in a CT scan, the scanner's slice plays the part of the cutting plane.
2. Two concrete items, such as a bottle or a pipe bend with a scan plane: "Which picture shows the slice?" Four options, solver-checked like Slice's own options (shape-distance margins, egocentric foil).
3. "Where else would this help?" Medicine (scans), cooking, geology (rock layers), engineering (machined parts), or Other.

Time: 60–90 s.

**Bridge library (Proposal).** All items are forward questions, solver-checked, and in no reserved probe format (§5.4).

| Exercise | Bridge set | Concrete items | Domains for the use prompt |
|---|---|---|---|
| slice | Scans and cuts | bottle, pipe bend, loaf, layered rock block; scan plane → slice | medicine, geology, cooking, engineering |
| fold | Paper cuts | fold twice, cut a notch → unfolded pattern (paper snowflakes, die-cut packaging) | crafts, packaging |
| nets | Box blanks | carton blank with flaps and a printed logo → which face shows it the right way up | packaging, design |
| rotate, spin | Molecules and hands | ball-and-stick centre with four coloured groups: same molecule turned, or its mirror?; a hand turned in the plane: left or right? | chemistry, medicine |
| views | Part drawings | three-view drawing of a machined block with a slot → which part | engineering, making |
| orient | Trailhead map | a trail map not turned your way: standing at the hut, facing the lake, point to the bridge | hiking, cities |
| reckon, homing | City walk | first-person walk between buildings (landmarks present), then point home | wayfinding |
| knots | Rope and ring | a rope through a ring: pulled at both ends, does it come free? (no pulleys: the Mechanisms probe uses them) | sailing, climbing |
| centralpoint | Meeting point | homes on a town map: where do friends meet to walk least in total? (straight-line distance; no average marker) | planning |
| span | Delivery order | houses light up on a map in order; tap them in order | errands |
| hidden | Find the part | a part outline inside a technical line drawing, same size and way up | technical drawings |

Track gets no bridge set in v1.2: a traffic or sport scene would invite claims the evidence does not support (M5).

**Dose (Proposal):**
- The first set comes when an exercise's rating settles (σ ≤ 0.6) at or above the bridge items' difficulty.
- Then one set per exercise about every two weeks, and at most one set per session.
- Off-screen challenges become optional weekly quests in the game layer, with "I did it" as a self-report.

**Found on dose:** none for spatial bridging. At programme level, the original CASE programme had 30 lessons; its 19-lesson version, taught across Years 7 and 8, showed about −1 month of progress in an independent RCT (F10). The pages read name its lesson phases as concrete preparation, cognitive conflict, construction and reflection; whether it includes a bridging phase was not confirmed. Self-explanation effects appear within sessions under 30 minutes (g = .71, Bisra).

**Scoring:** bridge items are logged and shown as right or wrong with a show-me. They are not rated into the exercise's level (they would distort the item model), and they get their own key, `<id>.bridge`, so pooled data can fit them later.

**Off-screen (hands-on):**
- Today: Fold, Nets, Views. Add: Slice (cut a potato or clay at a slant and predict the face), Orient (turn a printed map on a walk), Knots (tie and pull), Central Point (pick a meeting place on a real map with friends).
- Evidence: manipulatives in children [SR via A]; untested in adults.
- Logged: viewed, and "I did it" (self-report).

### 4.3 Production variants (the `produce` layer)

- **Views (main `produce` host): "Draw the view".**
  - The structure in isometric view, and a dot grid for the requested view (top, front or right).
  - The player taps two dots to draw a segment, or taps a segment to remove it. Phones keep the 3–4-cube grid of today's Views, so dots stay at least 44 px apart.
  - Check: exact equality of the merged segment sets.
  - Feedback: right lines solid, missing lines dashed, extra lines marked, then the show-me.
  - A variant with its own difficulty offset; chance is about 0.
- **Fold: "Mark the holes"** (a layer, not Fold's main bet). Tap cells of the blank unfolded sheet; exact check.
- **Slice: "Mark the cut"** (a layer). Tap where the plane crosses each edge (taps snap to edges); the app draws the polygon; exact check. This is also Slice's analytic strategy made visible.
- **Found:** predictive sketching with comparison to the answer beat prediction without sketching, and copying (Gagnier et al. 2017). A produced answer has almost no guessing, so each item carries more information than a four-option choice (Inference). That also helps the measurement milestone (ME5).

## 5. Q4: near and far probes, and what the pooled export must log

Rungs used here, following R4 §3.1 and the gap file's ME1:
- **Near:** the same operation as a trained exercise, asked in a format no training uses.
- **Mid:** a different format and a related operation (Cube Match, View Match, Pattern Memory).
- **Far:** an applied problem in a domain no exercise trains, sharing only broad abilities.

### 5.1 Near probes

**Proposal: one near probe, "Other Way Round" (working name).** It asks the trained operations the other way round: six strands, each tied to trained exercises, three items per strand, 18 items, about 4–5 minutes. Like the other probes it gives no feedback, adapts within each strand, has three alternate forms from one blueprint, and is scored on one θ with strand offsets (response time used only in the way the parallel measurement notes, docs/research/v1.2/M1-measurement.md §3.5, recommend). Strand sub-scores are too short to report to a player; they exist for the pooled tests in §5.3.

| Strand | Trained exercises it reads | Item (what the player sees and does) | Solver check |
|---|---|---|---|
| turn | rotate, spin | A cube figure with an axis drawn through it, a curved arrow and the angle (90° or 180°): which of four pictures shows it after that turn? | Apply the rotation. Foils: the opposite direction (90° items only), another axis, the mirror of the key, a turn of another size. Each foil must differ from the key under the figure's symmetry group, with the deciding arms visible (z-buffer). |
| fold-back | fold | An unfolded sheet with holes: which of four fold-and-punch sequences made it? | Simulate each option forward; exactly one matches. Every option gives the same hole count (heuristic-proof). Foils: mirrored punch, a fold on another crease, a changed fold order where order matters. |
| cut-back | slice | A cut face drawn straight on, at true scale: which of four solids, each with a cutting plane, gives it? | Congruence test on the sections. Foils give the same number of sides with other proportions, or the solid's own outline (the egocentric error). Shape-distance margins as in Slice. |
| net-back | nets | A cube with plain coloured faces seen from two corners (all six faces visible): which net folds into it? | Fold each net; compare opposite pairs and the cyclic order at a corner (handedness). Foils: one opposite pair swapped; the mirror colouring; two neighbours swapped. |
| view-from | views | A cube structure in isometric and one line view: from which side was the view drawn (top, front, right, left)? | Render each direction; exactly one matches. The left and right views differ (mirror check). |
| where-am-I | orient (and reckon, homing) | A top-down map of 5–7 objects with four marked spots, and an arrow circle showing 2–3 objects at their directions from "ahead": where are you standing? | For each spot, search all facings; exactly one spot matches within ±10°. Foils match only when mirrored, or for 2 of 3 objects. |

Why near (Inference): each strand uses the operation its exercises train, on the same kind of object, but asks it in reverse or with the transformation given. A player who learned the forward routine without a model of the transformation should gain less on these items than on trained items. That is the routine-versus-process question that F3 makes central. Whether reversed questions behave like the forward ones in difficulty is unknown; pilot data must calibrate the strand offsets.

Rejected alternatives:
- **Production responses** (tap the holes, draw the view): ideal for information per item, but they are the `produce` layer's training formats (§4.3).
- **A rotation-analogy format** (apply the turn shown on one object to another): B §6 describes the PSVT:R this way (marked unverified there). Keeping that format out of Parallax keeps the test usable as an outside check (B §0).

### 5.2 Far probes, and placing Mechanisms and Level

**Proposal: "Motion Graphs" (new far probe, physics kinematics).**
- **Stem:** a strobe picture: a cart's positions on a straight track at equal time steps, as dots. Questions of four kinds:
  1. which position–time graph matches;
  2. which velocity–time graph matches;
  3. which strobe picture matches a given position–time graph;
  4. the same cart seen from a bus moving at constant speed: which strobe picture? (a change of frame of reference).
- **Options:** four. Foils come from known reading errors:
  - the graph drawn as a picture of the track or path;
  - the velocity shape offered for a position question (slope read as height);
  - time reversed;
  - curvature of the wrong sign;
  - the wrong frame.
- **No physics knowledge needed:** the strobe dots fully fix the motion. The instruction's worked example explains what a graph over time is.
- **Solver:** compute the key graph exactly from the dot positions. Each foil differs from the key by a visible margin at two or more marked times and is not the key under any axis scaling. The frame items subtract the bus's displacement per step.
- **Why far:** a domain (physics graphs) and a representation (graphs over time) that no exercise trains, sharing only broad abilities. **Found:** spatial visualisation ability related to solving 2D-motion, frame-switching and kinematics-graph problems; low-spatial students read graphs literally and did not switch frames (Kozhevnikov, Motes & Hegarty 2007 [AB]; 60 physics-naive students in study 1).
- **Risks:** players who studied kinematics may start near ceiling, so the frame and two-cart items extend the range. A one-tap background question ("Studied motion graphs?") is logged as a covariate. Copy no items from published graph inventories.

**Alternative far probe, pending a source check: "Contours" (topographic maps).** Questions such as: which arrow points straight downhill from the marked spot; which marked point is highest; which spot cannot be seen from X. A terrain is a sum of generated hills, contours are computed, and the answers are exact. Avoid profile-drawing questions: a profile is a cross-section (Slice's operation), which would make it mid. No source on contour reading and spatial ability was opened in this pass (Could not open).

**Placing the existing probes (Proposal):**
- **Mechanisms:** far (applied mechanics; mental animation of causal chains, which no exercise trains). It joins Motion Graphs in a **far composite**, so far transfer never rests on one test (F9).
- **Level:** an untrained kind (extrinsic-static), but knowledge-laden: knowing that water stays level removes most errors (B §12), and Angles' perceptual practice may touch its perceptual part (R3). Keep it optional, outside both composites, and report it alone.

**Bet-specific checks (Lab, not the Spatial Check):**
- **Balance** (for Central Point's `calibrate` bet).
  - Two item types: tap the balance point of 8–16 dots (the centroid), and the "bus stop on a street" (houses on a line: where should the stop go so the total walk is least; the answer is the median).
  - Scores: distance error, and the fitted weight of far dots (Drew et al. 2010's robust vs anti-robust weighting).
  - The calibrate bet predicts better median judgements with unchanged centroid judgements. Negative transfer would show as far dots losing weight in centroid judgements.
  - It stays untrained only if no exercise, round or bridge ever marks the average position.
- **New-exercise learning curves** (preparation for future learning, no player time). Every exercise added in an update, Central Point first, is a task nobody has practised. Its first 60 rated trials give each player a learning slope, which pooled data can relate to earlier exposure by bet (Bransford & Schwartz 1999). This is observational and confounded by motivation; report it as exploratory.
- **Stretch: "Learn and Apply".** A 60-second worked lesson in a made-up spatial notation, then 8 items; alternate forms are different notations. Forms can only be equated with pilot data, so it stays in the Lab.

**The ladder after v1.2 (Proposal):**

| Rung | Measured by |
|---|---|
| trained | the exercises' levels |
| near | Other Way Round |
| mid | Cube Match, View Match, Pattern Memory |
| far | Mechanisms + Motion Graphs |
| untrained kind | Level (optional) |
| control | Word Links |
| bet-specific (Lab) | Balance; learning curves on new exercises |

### 5.3 What the pooled export must log to test the bets

**Per trial (add to the research CSV):**
- `bet`: the exercise's bet id (or a lookup table in the header).
- `layer`: empty, `compare-apply`, `bridge`, `produce` or `calib-detail`.
- `format`: the response-format id (§5.4).
- The CSV already has exercise@version, mode, session, settings, seed, outcome, response time, `p_pred`, interleaving stage, display, input, b and g (js/ui/log.js).

**Events (a second table, one row per event; time in UTC):**

| kind | fields |
|---|---|
| `showme` | trial reference, auto or manual, ms played, steps viewed, replays, closed early |
| `card` | exercise, card (imagery, analytic, switch), source (offered after misses, Library, How to play), ms open |
| `checkin` | exercise, answer (already in the JSON backup; add to the export) |
| `compare` | pair (exercise@seed ×2), principle, stage 1–3, choice, correct, response time, apply-trial reference |
| `bridge` | set id, exercise, mapping choice and whether right, item trial references, use chosen, other text given (yes/no; the text itself never leaves the device) |
| `offscreen` | exercise, viewed or "I did it" |
| `assign` | layer, exercise, arm (on/off), first and last session of the period, assignment seed |
| `expect` | bet, rating 1–5, when (baseline, week 4) |
| `background` | e.g. "studied motion graphs", plus the existing one-tap about outside tests |
| `plateau` | from milestone 3: what fired, what changed |

**Header:** app version, `BETS_VERSION`, item-model versions, opt-in state of the bet trials. No locale, timezone or user agent unless the player switches them on (privacy rules).

**Dose, computed from the above** (also shown in the Lab): per exercise and week, rated trials, active minutes and sessions. Per bet and per layer: minutes, rounds, sets and production items. Spacing: days between sessions per exercise. The distribution of interleaving stages.

**Randomised "bet trials" (Proposal; the only way pooled data can test a bet rather than an exercise):**
- **Units:** exercise × layer, for the add-on layers: compare rounds, bridge sets, production variants, and the detailed calibration feedback (bias and habit) versus plain error feedback.
- **Crossover:** a seeded draw splits each player's eligible exercises into two halves. One half has the layer on in period 1 and off in period 2; the other half the reverse. A period is 4 weeks or 8 sessions, whichever is later. Core design (variety, strategy cards, load) stays on for everyone.
- **Outcomes:**
  - primary: the change in the near-probe strand that each exercise maps to (strand ↔ exercise table in §5.1), read on delayed checks;
  - secondary: the mid and far composites, and the apply-item uplift (outcome − `p_pred`).
- **Analysis, fixed in advance:** a mixed model with player random effects, strand effects and arm × period, pooled across players. Expectation ratings are covariates. Because every player has both arms, a global expectation effect cancels (F2).
- **Consent:** "Join the bet trials" in Settings, on by default and explained in the Lab. Nothing leaves the device unless the player exports.
- **Power:** not computed here. It must be simulated in tests/node/sim.mjs together with ME5's designs before anything is built.
- **Fit with the measurement notes:** M1 §3.4 (parallel, in progress) proposes a within-person contrast for the Lab crossover, "near-A minus near-B change", once each cluster has its own near probe. The strands supply exactly that:
  - cluster A (Rotate, Spin, Fold, Nets, Slice; DESIGN-PLAN §6) maps to the turn, fold-back, net-back and cut-back strands;
  - cluster B (Views, Orient, Span, Hidden, Track, Homing) maps to view-from and where-am-I.

### 5.4 How the probes stay untrained (Proposal)

- Every generator, compare round, bridge item, tutorial demo and Daily Challenge declares a `format` id.
- A frozen list of **reserved formats**:

| Probe | Reserved |
|---|---|
| Other Way Round | the instructed turn with an axis arrow; unfolded sheet → fold sequence; section → solid and plane; coloured cube → net; view → viewing direction; arrow circle → position on a map |
| Motion Graphs | strobe pictures; graphs over time; moving frames of reference |
| Mechanisms | gears, belts, pulleys |
| Level | liquid surfaces and plumb lines in tilted frames |
| Cube Match | cubes with oriented symbols, same or different |
| View Match | perspective pictures of a scene from a marked spot |
| Pattern Memory | grid patterns shown briefly, then recalled |
| Word Links | word analogies |
| Balance | balance points; any marker of the average position |

- A node test fails if any training artefact uses a reserved id.
- The bridge library in §4.2 was chosen against this list: no pulleys for Knots, no perspective photos for Views, no average marker for Central Point.
- Show-me animations are feedback, not questions. Rotate's show-me turns the figure, which is close to the "turn" strand's content. Flag this in the pilot: compare players' turn-strand gains with how many show-me plays they had.

## 6. Q5: what existing trainers and courses do about transfer

The search budget ran out before an app-store survey or a search for studies of named spatial-training apps could be made, so this section rests on sources already opened and on earlier Parallax notes. Treat "none found" as "none in these sources".

| Trainer or course | What it does for transfer (Found) | Evaluation (Found) |
|---|---|---|
| Sorby's spatial-visualisation course (engineering; Michigan Tech) | Screens first-year students with the PSVT:R and trains those who fail. Modules span isometric sketching, orthographic projection, rotations, reflections, cross-sections and more [SR via B §6]; sketching-based [SR via A]; physical cube sets in a related trial (Miller & Halpern 2013) | PSVT:R gains of 21.8–30.3 percentage points across cohorts, Mental Cutting gains of 12.2–17.8; follow-on course grades mostly higher than in comparison groups, not all significant; quasi-experimental [FT, Sorby & Veurink]. A large regression-discontinuity study reported STEM-grade and retention effects; magnitudes not retrieved [SR via A] |
| The same course for pre-dental students (Stavridis et al. 2015) | 10 × 80 min, workbook and linking cubes | PSVT:R up (n = 15), no control; the DAT's perceptual test was not re-measured [SR via R3] |
| Spatial Thinking Workbook for geology majors (Ormand et al. 2017, hosted by SERC) | Gesture, predictive sketching, analogies, and visual comparison with progressive alignment (very similar structures first) [WP] | Reported qualitatively on the page; predictive sketching tested in Gagnier et al. 2017 (d = 0.51–0.58) |
| Embedded classroom programme (Lowrie & Logan 2023) | Experience, Language, Pictorial, Symbolic, Application stages inside geometry lessons, plus digital practice | Cluster RCT, N = 287: embedded > isolated on trained skills; both > control on untrained spatial skills and maths [FT] |
| think3d! (origami, pop-ups) | Hands-on making | Paper Folding 42 % → 50 %, no control [SR via B] |
| Commercial brain-training apps | Adaptive game tasks; broad claims. One major app settled US Federal Trade Commission charges over claims of everyday, school and work benefits (2016) [SR via D] | — |
| 3D multiple-object tracking (commercial) | Trained-task staircase; claims for sport and cognition | 29 studies, none preregistered; 2 of 3 field-transfer tests null (Vater et al. 2021) [SR via A/B] |
| DAT perceptual-test prep apps | Practise the test's six formats under test timing | No study found of PAT-format training against a control [SR via R3] |
| Off-the-shelf games | Spatial puzzle games train 2D mental rotation; action games train perceptual attention (Mayer 2019 [AB]); Tetris skill stayed shape-specific (Sims & Mayer 2002 [SR via B]) | — |
| Sea Hero Quest | A navigation *measurement* game played by millions | Assessment, not training [SR via R1] |

**Inference: the pattern.**
- Courses carry transfer by breadth, sketching, physical models, screening low scorers (who gain most: Uttal's screened samples, 0.68 vs 0.44), and embedding in the target curriculum. They evaluate with spatial tests and later grades in quasi-experimental designs.
- One workbook uses comparison explicitly. None of these sources randomises its components, so no course can say which component carried the effect.
- Apps carry engagement and adaptivity. In the sources read, none tags its tasks with a transfer mechanism, logs exposure to it, keeps untrained probes at several distances, or lets users pool data.

**Where Parallax can go beyond (Proposal):**
1. **Bets that can lose.** A mechanism tag per exercise, exposure logged, and add-on layers randomised within players, so pooled data can show which bets carry and which do not. Nothing found does this.
2. **Comparison and bridging as moments of play,** with one-tap prompts that keep the flow. Courses do this through teachers; apps do not.
3. **Production on a phone:** drawn views on a dot grid, marked holes, marked cuts, with exact checks and instant overlays. This brings the course's sketching into a free, offline tool.
4. **A transfer ladder with reserved formats:** near (Other Way Round), mid (three probes), far (Mechanisms + Motion Graphs), a verbal control, alternate forms and a retest model.
5. **A new bet, stated as one:** calibration of intuitive estimates (Reckon, Homing, Central Point), with its own negative-transfer check (Balance).
6. **Format practice named honestly:** the DAT-style exercises bet on near transfer to that test's formats and say so.
7. **Borrow from courses:** hands-on quests (off-screen challenges). Courses screen for low scorers because they gain most (Uttal: 0.68 vs 0.44). Parallax should instead write "baseline × layer" into the analysis plan as a moderator (process training may help low starters more, strategy training high starters: compensation vs magnification, Smid et al. 2020), and build nothing on it before the data exist.

## 7. Open risks

1. **Expectation:** "The bet" lines tell players what to expect. Randomising layers within players and measuring expectations per bet limit the damage; the global placebo of 0.15–0.20 SMD (F1, F2) cannot be removed, only shared by both arms.
2. **Tags confound bets with exercises.** Only the randomised layers test mechanisms. Bets carried by core design (variety, load, attention, strategy cards) stay untestable inside Parallax except by moderation analyses.
3. **Comparison effects decay within a day** (d = .57 → .22, Alfieri). Judge layers on delayed checks only; spaced rounds are a guess at the remedy.
4. **Reversed near-probe items may differ in difficulty and skill from forward ones.** Pilot data must set the strand offsets. Rotate's show-me partly shows the turn strand's content.
5. **Central Point:**
   - the "people aim for the average" claim is a prediction from find-the-middle studies (C1), not a finding on this task;
   - negative transfer to balance judgements is possible;
   - showing the average in its feedback would contaminate the Balance check.
6. **Motion Graphs:** prior physics schooling (ceiling), and a learning effect inside the probe itself. Three forms and the retest model are needed.
7. **Time cost:** rounds and bridge sets take up to about 15 % of a session. Dose–response is unknown for both, and the trade against training volume is untested.
8. **Phones:** production variants need ≥ 44 px dot spacing, which limits grid size. Views' current 3–4-cube grid fits.
9. **Bridging has the weakest record:** programme-level evidence is mixed, and the independent RCT of a thinking-skills programme with a reflection phase was null (F10). It earns its place as a bet, not as a recommendation.
10. **Evidence gaps from the search budget:**
    - no check for 2023–2026 spatial-training meta-analyses;
    - no source on human geometric-median judgements (none in C1 either);
    - no source on contour-map reading;
    - no app-store survey;
    - primary texts for Perkins & Salomon 1988, Fyfe et al. 2014 and Boone & Hegarty 2017 not opened.

## 8. References

### Read in this pass (reading level after each)

- Alfieri, L., Nokes-Malach, T. J., & Schunn, C. D. (2013). Learning through case comparisons: A meta-analytic review. *Educational Psychologist, 48*(2), 87–113. [FT, author copy, through the Discussion] https://www.lrdc.pitt.edu/Schunn/papers/ContrastingCasesMeta-AlfieriEtAl2013.pdf
- Bisra, K., Liu, Q., Nesbit, J. C., Salimi, F., & Winne, P. H. (2018). Inducing self-explanation: A meta-analysis. *Educational Psychology Review, 30*. https://doi.org/10.1007/s10648-018-9434-x [FT-ms: read as reproduced in chapter 2 of a thesis, https://core.ac.uk/download/389667863.pdf]
- Bransford, J. D., & Schwartz, D. L. (1999). Rethinking transfer: A simple proposal with multiple implications. *Review of Research in Education, 24*, 61–100. [FT] https://aaalab.stanford.edu/papers/Rethinking_transfer_a_simple_proposal_with_multiple_implications.pdf
- Drew, S. A., Chubb, C. F., & Sperling, G. (2010). Precise attention filters for Weber contrast derived from centroid estimations. *Journal of Vision, 10*(10):20, 1–16. [FT] https://sites.socsci.uci.edu/~whipl/staff/sperling/PDFs/Drew_Chubb_Sperling_JOV_2010.pdf
- Education Endowment Foundation. Let's Think Secondary Science, trial page. [WP] https://educationendowmentfoundation.org.uk/projects-and-evaluation/projects/lets-think-secondary-science/
- Fiorella, L., & Mayer, R. E. (2012). Paper-based aids for learning with a computer-based game. *Journal of Educational Psychology* [volume and pages not recorded]. [FT, course copy] https://hillkm.com/EDUC_715/Unit_7/fiorella_mayer_2012.pdf
- Gagnier, K. M., Atit, K., Ormand, C. J., & Shipley, T. F. (2017). Comprehending 3D diagrams: Sketching to support spatial reasoning. *Topics in Cognitive Science*. https://doi.org/10.1111/tops.12233 [FT-ms] https://par.nsf.gov/servlets/purl/10060308
- Gathercole, S. E., Dunning, D. L., Holmes, J., & Norris, D. (2019). Working memory training involves learning new skills. *Journal of Memory and Language*. [FT-ms; Study 1 and discussion] https://ueaeprints.uea.ac.uk/id/document/87260
- Gentner, D., Levine, S. C., Ping, R., et al. (2016; online 2015). Rapid learning in a children's museum via analogical comparison. *Cognitive Science*. https://doi.org/10.1111/cogs.12248 [FT, in-press version] https://groups.psych.northwestern.edu/gentner/papers/gentnerLevinePingIsaiaDhillonBradley%26Honkey_inPress.3b.pdf
- Gobet, F., & Sala, G. (2023). Cognitive training: A field in search of a phenomenon. *Perspectives on Psychological Science*. https://doi.org/10.1177/17456916221091830 [FT-ms; its tables were not in the copy] https://core.ac.uk/download/511315707.pdf
- Goldstone, R. L., & Son, J. Y. (2005). The transfer of scientific principles using concrete and idealized simulations. *Journal of the Learning Sciences, 14*(1), 69–110. [FT] https://scispace.com/pdf/the-transfer-of-scientific-principles-using-concrete-and-18wws3vney.pdf
- Hegarty, M. (2018). Ability and sex differences in spatial thinking: What does the mental rotation test really measure? *Psychonomic Bulletin & Review, 25*, 1212–1219. https://doi.org/10.3758/s13423-017-1347-z [FT, re-read for Boone & Hegarty 2017]
- Higgins, S., Hall, E., Baumfield, V., & Moseley, D. (2005). A meta-analysis of the impact of the implementation of thinking skills approaches on pupils. EPPI-Centre. [AB, summary page] https://eppi.ioe.ac.uk/cms/publications/systematic-reviews/thinking-skills-meta-analysis-summary
- Jee, B. D., Uttal, D. H., Gentner, D., Manduca, C., Shipley, T. F., & Sageman, B. (2013). Finding faults: Analogical comparison supports spatial concept learning in geoscience. *Cognitive Processing, 14*(2), 175–187. https://doi.org/10.1007/s10339-013-0551-7 [AB]
- Johnson & Mayer (2010). Applying the self-explanation principle to multimedia learning in a computer-based game-like environment. *Computers in Human Behavior*. https://doi.org/10.1016/j.chb.2010.03.025 [AB; the page did not list authors: the attribution follows the search listing]
- Judd, N., & Klingberg, T. (2021). A randomised spatial-training study of 17,648 children. *Nature Human Behaviour, 5*(11). https://doi.org/10.1038/s41562-021-01118-4 [AB via IDEAS/RePEc; Karolinska press release, WP: https://news.ki.se/these-cognitive-exercises-help-children-boost-their-math-skills-study-shows]
- Kozhevnikov, M., Motes, M. A., & Hegarty, M. (2007). Spatial visualization in physics problem solving. *Cognitive Science, 31*(4), 549–579. https://doi.org/10.1080/15326900701399897 [AB]
- Liby, B. W., Friedenberg, J., & Yancopoulos, S. (2009). What do students perceive during a lesson on center-of-mass? *Journal of STEM Education, 10*(1&2), 17–23. [FT] https://jstem.org/jstem/index.php/JSTEM/article/download/1434/1250/3966
- Lövdén, M., Bäckman, L., Lindenberger, U., Schaefer, S., & Schmiedek, F. (2010). A theoretical framework for the study of adult cognitive plasticity. *Psychological Bulletin, 136*(4), 659–676. https://doi.org/10.1037/a0020080 [AB]
- Lowrie, T., & Logan, T. (2023). Spatial visualization supports students' math: Mechanisms for spatial transfer. *Journal of Intelligence, 11*(6), 127. https://doi.org/10.3390/jintelligence11060127 [FT] https://www.mdpi.com/2079-3200/11/6/127
- Matlen, B. J., Gentner, D., & Franconeri, S. L. (2020). Spatial alignment facilitates visual comparison. *Journal of Experimental Psychology: Human Perception and Performance, 46*(5), 443–457. https://doi.org/10.1037/xhp0000726 [FT]
- Mayer, R. E. (2019). Computer games in education. *Annual Review of Psychology*. https://doi.org/10.1146/annurev-psych-010418-102744 [AB]
- Norris, D., Hall, J., & Gathercole, S. E. (2019). Can short-term memory be trained? *Memory & Cognition*. [PT; used for its account of the routine framework] https://pmc.ncbi.nlm.nih.gov/articles/PMC6647533
- O'Neil, H. F., Chung, G. K. W. K., Kerr, D., Vendlinski, T. P., Buschang, R. E., & Mayer, R. E. (2014). Adding self-explanation prompts to an educational computer game. *Computers in Human Behavior, 30*, 23–28. [AB] https://cresst.org/publication/adding-self-explanation-prompts-to-an-educational-computer-game/
- Raviv, Lupyan & Green (2022). How variability shapes learning and generalization. *Trends in Cognitive Sciences, 26*(6), 462–483. https://doi.org/10.1016/j.tics.2022.03.007 [AB; details SR via C]
- REF impact case study: Cognitive Acceleration (developer's impact statement, citing Shayer & Adhami 2007 and Adey & Shayer 1993). [WP] https://impact.ref.ac.uk/casestudies/CaseStudy.aspx?Id=41265
- SERC, Carleton College. Spatial Thinking Workbook: strategies (cites Ormand et al. 2017). [WP] https://serc.carleton.edu/spatialworkbook/strategies.html
- Siegler, R. S., & Ramani, G. B. (2009). Playing linear number board games, but not circular ones, improves low-income preschoolers' numerical understanding. *Journal of Educational Psychology, 101*(3), 545–560. [SR via the What Works Clearinghouse review] https://ies.ed.gov/ncee/WWC/Study/73725
- Smid, C. R., Karbach, J., & Steinbeis, N. (2020). Toward a science of effective cognitive training. *Current Directions in Psychological Science*. https://doi.org/10.1177/0963721420951599 [FT] https://discovery-pp.ucl.ac.uk/10114769/1/0963721420951599.pdf
- Smith, L. A., & Gentner, D. (2012). Using spatial analogy to facilitate graph learning. In *Spatial Cognition VIII* (LNCS 7463, pp. 196–209). Springer. [FT] https://groups.psych.northwestern.edu/gentner/papers/SmithGentner_2012-GraphLearn.pdf
- Sorby, S. A., & Veurink, N. (c. 2010). Long-term results from spatial skills intervention (ASEE EDGD paper). [FT, re-read] https://edgd.asee.org/wp-content/uploads/sites/22/2019/09/Sorby_Veurink_Long_term_Results_Spatial_Skills_intervention.pdf
- Szűcs, D., & Myers, T. (2017). A critical analysis of design, facts, bias and inference in the approximate number system training literature: A systematic review. [FT-ms; journal not shown in the copy] https://core.ac.uk/download/131380489.pdf
- Zhu, C., Leung, C. O.-Y., Lagoudaki, E., et al. (2023). Fostering spatial ability development in and for authentic STEM learning. *Frontiers in Education, 8*. https://doi.org/10.3389/feduc.2023.1138607 [PT, narrative review; first 100,000 characters]
- [Authors not captured] (2026). A single-paper meta-analysis of sex differences in adolescent spatial ability. *Educational Psychology Review*. https://doi.org/10.1007/s10648-026-10149-0 [PT; checked only to confirm it is not a training meta-analysis]

### Taken from earlier Parallax notes (their reading levels apply; DOIs as given there)

- **docs/research/v1.0/A-evidence.md:**
  - Uttal et al. 2013 (10.1037/a0028446)
  - Hawes, Gilligan-Lee & Mix 2022 (10.1037/dev0001281)
  - Bediou et al. 2018 (10.1037/bul0000130) and 2023 (10.1037/tmb0000102)
  - Sala et al. 2019 (10.1525/collabra.203)
  - Simons et al. 2016 (10.1177/1529100616661983)
  - Foroughi et al. 2016 (10.1073/pnas.1601243113)
  - Scharfen et al. 2018 (10.1016/j.intell.2018.01.003)
  - Wright et al. 2008 (10.3758/PBR.15.4.763)
  - Stieff et al. 2014 (10.1037/a0034823)
  - Miller & Halpern 2013 (10.1016/j.lindif.2012.03.012)
  - Gilligan-Lee et al. 2023 (10.1111/cdev.13963)
  - Keehner et al. 2008 (10.1080/03640210801898177)
  - Vater, Gray & Holcombe 2021 (10.3758/s13423-021-01892-2)
  - Harris et al. 2020 (10.3389/fpsyg.2020.00196)
  - Sorby 2009 (10.1080/09500690802595839)
- **docs/research/v1.0/B-tasks.md:**
  - Burte et al. 2017 (10.1186/s41235-017-0052-9) and 2018 (10.1016/j.paid.2018.08.009)
  - Romeas et al. 2025 (10.1016/j.psychsport.2024.102770)
  - Sims & Mayer 2002
  - Kozhevnikov & Hegarty 2001
- **docs/research/v1.0/C-progression.md:**
  - Gentner, Loewenstein & Thompson 2003 (10.1037/0022-0663.95.2.393)
  - Perkins & Salomon 1988
  - Brunmair & Richter 2019 (10.1037/bul0000209)
  - Rohrer & Taylor 2007
  - Lampit et al. 2014
  - Raviv et al. 2022 (details)
- **docs/research/v1.0/D-motivation.md:** the FTC's 2016 settlement with a brain-training app maker.
- **docs/research/v1.1/R1-path-integration.md:**
  - Noel et al. 2020 (10.1073/pnas.2000216117)
  - Akan et al. 2026
  - Lövdén et al. 2012
  - the absence of a randomised path-integration training study with a transfer test
- **docs/research/v1.1/R3-dat-pat.md:**
  - Stavridis et al. 2015
  - the DAT prep-app landscape
- **docs/research/v1.1/R4-test-overlap.md:**
  - Hausknecht et al. 2007
  - te Nijenhuis et al. 2007
  - Klauer & Phye 2008 and its update
  - Meneghetti et al. 2017
  - rule-teaching studies for matrices
- **docs/research/v1.2/C1-central-point.md** (parallel notes, in progress when read; §2.2–2.4):
  - Juni, Singh & Maloney 2010
  - Hong, Witt & Szafir 2021
  - the absence of human data on geometric-median estimation
- **docs/guide/guide.html** (transfer chapter):
  - Wisniewski et al. 2020
  - Höffler & Leutner 2007

## Could not open

Each entry: what was needed, and the assumption used meanwhile. The affected parameters are named, so they can be corrected quickly.

1. **Perkins & Salomon (1988), Teaching for transfer.** *Educational Leadership, 46*(1). https://files.ascd.org/staticfiles/ascd/pdf/journals/ed_lead/el_198809_perkins.pdf (fetch refused: provenance check not answered).
   - Needed: their concrete bridging techniques, to shape the bridge prompts (§4.2).
   - Assumption: C-progression's summary (low road = hugging, high road = bridging by explicit abstraction).
2. **Fyfe, McNeil, Son & Goldstone (2014), Concreteness fading in mathematics and science instruction: a systematic review.** *Educational Psychology Review, 26*. https://link.springer.com/content/pdf/10.1007/s10648-014-9259-1.pdf returned a commentary instead.
   - Needed: the number of studies, transfer comparisons, and how many fading steps.
   - Assumption: Goldstone & Son 2005 stands in. Affects the bridge-pair order (§4.2).
3. **Boone & Hegarty (2017).** *JEP: Learning, Memory, and Cognition, 43*(7). Not opened; only Hegarty 2018's description.
   - Needed: N, the size of the global-shape instruction effect, and transfer to untrained rotation items.
   - Assumption: instruction improved performance and removed the sex difference. Affects the `strategy` grade (B−).
4. **Sorby, Veurink & Streiner (2018).** *Learning and Individual Differences, 67*, 209–222. https://doi.org/10.1016/j.lindif.2018.09.001 (doi.org redirect blocked).
   - Needed: effect sizes on grades and retention.
   - Assumption: positive, magnitudes unknown (as in A §2.1).
5. **Studies of human judgements of the geometric median (Fermat–Weber point).** My search budget was exhausted. The parallel C1 notes found none either, only find-the-middle studies.
   - Needed: whether people aim for the average position, and how large the bias is.
   - Assumption: the average pull is a prediction from find-the-middle studies [SR via C1]. Central Point's "outlier trap" dimension should be calibrated on pooled data (§3.3).
6. **Contour-map (topographic) reading and spatial ability.** Search budget exhausted.
   - Needed: evidence of a link, and published item types to avoid copying.
   - Assumption: "Contours" stays an alternative to Motion Graphs (§5.2).
7. **Spatial-training meta-analyses from 2023–2026, and newer work by Hawes and colleagues.** Search budget exhausted.
   - Assumption: Hawes 2022 is still the best synthesis for maths transfer (A §1.2).
8. **Johnson & Mayer (2010), full text.** https://doi.org/10.1016/j.chb.2010.03.025
   - Needed: N, and what the menu of reasons contained (principles, or move descriptions).
   - Assumption: the abstract's effect sizes. Affects the one-tap prompt format (§4.1, §4.2).
9. **EEF Let's Think Secondary Science report.** https://eprints.hud.ac.uk/id/eprint/29811/1/EEF_Project_Report_Lets_Think_Secondary_Science.pdf (not opened).
   - Needed: the security rating and implementation fidelity.
   - Assumption: the trial page's result, about −1 month of progress (effect size of magnitude 0.02).
10. **Gentner, Loewenstein & Thompson (2003)** primary, and **Kotovsky & Gentner (1996)** on progressive alignment.
    - Needed: the exact comparison prompts, and the order from close to far pairs.
    - Assumption: C's summary, Smith & Gentner 2012, and the SERC workbook.
11. **Uttal & Cohen (2012)**, on why spatial skill matters early in STEM learning.
    - Needed: support for measuring transfer as faster learning of new spatial tasks (§5.2).
    - Assumption: Bransford & Schwartz 1999 alone.
12. **Studies of sketching apps used in engineering spatial courses.**
    - Needed: for §6, what such apps report.
    - Assumption: none, so none is cited.
13. **Lövdén et al. (2010), full text.**
    - Needed: their recommended design features for training studies.
    - Assumption: the abstract only.
