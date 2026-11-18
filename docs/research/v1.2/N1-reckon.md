# N1. Reckon for v1.2: training evidence, the seven core papers, shortcut-proof levels, later rungs, comfort

Research notes for v1.2 Phase 1, deferred items O45, O35, O36, O37, O38 and O44 (docs/dev/v1.2/deferred-sweep.md). Written 2026-11-18 (UTC) by a research subagent. No app files were changed; this file is the only one written.

**How to read the tags.** Every source carries one tag saying how much of it was read:
- **[full]**: the article body was read (sections named where it matters);
- **[abstract]**: only the abstract or the publisher's summary;
- **[secondary: X]**: known only through X's report of it.

Every statement below is labelled as one of:
- **Found:** what a study reported (design, sample, effect sizes);
- **Inference:** my reading or arithmetic from the findings;
- **Proposal:** what I suggest Parallax does.

Code compared: js/ex/reckon/gen.js, js/ex/reckon/learn.js, js/ex/reckon/view.js, js/ex/homing/gen.js, js/ex/homing/view.js (state of branch `build` on 2026-11-18). Earlier research: docs/research/v1.1/R1-path-integration.md (R1), docs/research/v1.1/ACCESS.md, docs/dev/reviews/RV-reckon-homing.md.

**Summary.**
- **Q1, training with transfer.** No randomised or controlled path-integration training study with a transfer test was found. The search was cut off by the shared search budget before it started, so it is still owed (1). The nearest controlled evidence trains navigation in general: gains on the trained or near task, no significant transfer to other spatial tests (McLaren-Gradinaru 2020; Lövdén 2012).
- **Q2, the seven papers.** Two read in full (Stavropoulos 2022; Lakshminarasimhan 2018), five through abstracts or secondary reports. None forces a change to Reckon (2):
  - keep a fixed walk-back control law;
  - the flow step is weaker than the lab's and should be refitted;
  - the cards match the instructions used in the studies.
- **Q3, O35.** Turn-counting cannot be beaten on 2-leg and small-turn routes. On 3–4-leg routes it can be held to about 50 %: draw the turns first (with a final on-the-spot rotation), then pick the key from two alternatives that only the legs can tell apart, with legs of 3–15 m (3).
- **Q3, O37.** Mid-route probes (Stangl 2020), curved legs, and steering with fixed velocity control (4).
- **Q4, O36.** All the sickness evidence comes from HMDs, projections and simulators, with stronger and longer motion than Reckon's. The proposed gentle values are plausible but untested. Better-supported additions: no speed changes within a leg, a fixation dot, and limits on cumulative exposure (5).
- **Q5.** Graded list in 6; risks in 7.

Contents
1. Training studies with a transfer test (Q1, O45)
2. The seven core papers (Q2, O45)
3. Rated levels that resist turn-counting (O35)
4. Later rungs (O37), drift trend (O38), magic window (O44)
5. Motion comfort (O36)
6. Proposed changes for v1.2, graded
7. Open risks
References · Could not open

---

## 1. Training studies with a transfer test (Q1, O45)

**The search was cut short again.** This turn's web-search budget is shared by every agent working in it. It ran out after this agent's 17th search, all of which had gone to the seven papers (section 2), so no search aimed at Q1 itself was run. What follows comes from:
- three fetches of known candidates: one succeeded (McLaren-Gradinaru 2020); Ishikawa & Zhou 2020 and Tcheang et al. 2011 could not be opened (Could not open);
- the studies R1 had already read.

The search R1 §4.3 asked for, with terms such as "path integration training", "transfer" and "randomized", **is still owed**.

**Answer to Q1.** Neither 1.1 nor this pass found a randomised or controlled study that trained path integration and then tested transfer. The nearest controlled evidence trains navigation in general:

| Study (read) | Design | Training | Transfer tests | Result |
|---|---|---|---|---|
| McLaren-Gradinaru et al. 2020 [full] | **Not randomised.** 15 trained adults (19–70 y); comparison: 23 untrained students who repeated the primary test only ("not a true control group", in the authors' words) | 10 sessions of 45 min over 12 days. Desktop VR town, game-pad: travel to landmarks by the shortest route, within 20 % of the best time or distance, from small areas up to the whole town | Near: Spatial Configuration Task (cognitive-map use). Farther: Four Mountains (perspective), mental rotation, Santa Barbara Sense of Direction scale | **Near task improved:** group × time F(1,35) = 6.38, p = .016, η² = .154; within the trained group, partial η² ≈ .29. **No transfer:** Four Mountains p = .66, mental rotation p = .71, sense of direction p = .20. No follow-up. Groups differed in age (34 against 20 y) |
| Lövdén et al. 2012 (R1 §4.2; [full] in 1.1, not re-read) | Navigation training against a walking-only control | 42 sessions of 50 min over about 4 months: virtual zoo on a treadmill | Spatial orientation, Raven, mental rotation, memory | Navigation +1.42 SD (young), +3.34 SD (older men). Only a non-significant trend on the Guilford–Zimmerman orientation test (+0.29 SD, p = .072) |
| Xu et al. 2024 (R1; [full] in 1.1) | 49 older adults, one 10-minute VR wayfinding session | Teleporting in a replica of a building | New routes in the same building; pointing; distance estimation | Faster and shorter new routes in the same building; pointing and distance unchanged |

Within-task path-integration learning, from studies with no transfer test:
- **Feedback removed bias within one session** (Noel et al. 2020, R1 §4.1). Radial gain went from 1.10 to 0.97 and angular gain from 1.49 to 1.09 after a staircased bull's-eye was added in block 2. Practice and feedback are confounded.
- **Without feedback, gains are small or absent:**
  - Scherer et al. 2024: a small trend over 4–5 sessions;
  - Akan et al. 2026: no day effect after 0–3-star feedback on 64 trials;
  - Stavropoulos et al. 2022 (2.2): adaptation to changed control dynamics stayed partial across about 1,450 trials without feedback.
- **Visual practice and walking** (Du, Mou & Zhang 2020, R1 §4.1, abstract): a visual rotation gain learned while turning the body carried over to blind walking, but not to a video-only path. Nothing read shows screen-only practice carrying over to walking.

**Inference:**
- The pattern from 1.1 holds: navigation training improves the trained task and tasks very like it, with little or no transfer to other spatial tests.
- For path integration on a screen, within-task bias falls with end-point feedback, and nothing yet shows transfer to walking.
- The bridge text in js/ex/reckon/learn.js:186 ("has not been tested in any study we found") stays accurate. No claim in the app or guide needs changing.

**Proposal:** run the owed search as the first task of any later research pass (budget about 15 searches): path integration, dead reckoning, triangle completion or homing, each crossed with training or practice or feedback, and with transfer or randomised. Also check the leads listed under Could not open.

## 2. The seven core papers (Q2, O45)

Summary of access: two of the seven were read in full this time (Stavropoulos 2022; Lakshminarasimhan 2018, whose Methods were missing in 1.1). For the other five no full text could be reached: abstracts plus secondary reports only. None of the guide's Reckon claims rests on any of the seven: the guide's table cites Noel 2020, Lövdén 2012, the 2025 free-walking preprint, Riecke & Wiener 2007 and McLaren 2022 (docs/guide/guide.html, the "Navigation without landmarks" rows). Code comments do cite them: js/ex/reckon/gen.js (flow levels, via R1 §8.4) and js/ex/reckon/learn.js:50 (Wiener 2011, abstract).

| Paper | Read this time | Changes Reckon? |
|---|---|---|
| Klatzky et al. 1998 | abstract; two secondary reports | No. Keep the heading-not-updated check. Its cause may be the body-turn response, which Reckon does not use. |
| Stavropoulos et al. 2022 | full (Results, Methods; Discussion in part) | Confirms: one fixed control law. For the steering rung: velocity control, one time constant, no flashing target. |
| Lakshminarasimhan et al. 2018 | full (STAR Methods now read) | No change now. Reckon's density step is much weaker than the lab's (3× against 25×). Refit it, or make "sparse" sparser if the data show no step. |
| Wiener & Mallot 2006 | abstract | No change. The 0.55-logit step per leg is a hand-set prior, not this paper's finding. Refit it. |
| Wiener, Berthoz & Wolbers 2011 | abstract; secondary (He & McNamara 2018b) | No. The strategy cards match the instructions used in these studies. Two claims on the cards have no source (2.5 below). |
| Fernandes & Feiner 2016 | secondary (news report and press release) | No vignette on phones or desktops (section 5). |
| Cao, Jerald & Kopper 2018 | title; secondary (Cao, Grandi & Kopper 2021) | No. Fixation and rest-frame evidence from other sources supports an optional fixation dot (section 5). |

### 2.1 Klatzky, Loomis, Beall, Chance & Golledge 1998
Klatzky, R. L., et al. (1998). *Psychological Science* 9:293–298, https://doi.org/10.1111/1467-9280.00058.
Read: **[abstract]** (https://www.psychologicalscience.org/journals/psychological-science/1467-9280.00058/), plus **[secondary: Avraamides & Ioannidou 2005]** (full) and the **[abstract]** of Avraamides et al. 2004. No full text was reachable (see Could not open).

**Needed (ACCESS.md):**
- the visual-turn set-up (display, field of view, what the optic flow showed);
- how large the heading-update failure was (complete or partial, and against turn angle);
- whether any visual-only condition updated heading.

**Found:**
- **Design (abstract).** Two studies. Two-segment paths with a turn between the segments. Participants then turned to face the origin, as if they stood at the end of the second segment.
- **Exposure conditions (abstract).** Walking; imagining from a verbal description; watching another person walk; optic flow simulating the walk, with or without a physical turn between the segments.
- **The predicted error.** Someone who keeps the path but does not update their heading should overturn by the size of the turn.
- **Where it appeared.** This systematic overturning appeared in the description and watching conditions, not in physical walking.
- **Optic flow.** The abstract concludes that simulated optic flow was not, by itself, enough for correct turn responses.
- **Secondary reports.** Avraamides & Ioannidou 2005 describe the imagined-path error as overshooting by the size of the turn, with the response a body turn toward the origin. Avraamides et al. 2004 found that the error appeared with body-turn responses but not with verbal responses. They concluded that people can update a cognitive heading, and that the error comes from the body-turn response being tied to the physical body.
- **Not obtained:**
  - the display and field of view of the optic-flow condition;
  - whether the visual-turn failure was complete or partial;
  - how the error varied with turn angle.

**Inference:**
- The classic failure partly reflects a conflict at response time: the body faces one way and the imagined heading another.
- Reckon's answer is a turn of the *view* (dial, drag, buttons), not a body turn. By the 2004 result, a response that is not a body turn should show the error less, but the size of that reduction is unknown.
- Visual-only errors of a related kind remain likely. Riecke & Wiener 2007 (read in full in 1.1; game-pad pointing, no body turn) found that 37.5 % of naive people consistently swapped left and right.

**Effect on Reckon:**
- Nothing to change.
- The heading-not-updated rule (gen.js `shortcutsMiss`) stays as a solver check and as a named hint.
- The heading Try item stays.
- The weight given to heading feedback rests on Riecke & Wiener 2007 and on Lakshminarasimhan 2018's large angular bias (2.3 below), not on this paper.
- With final in-place rotations (section 3), the same rule must include the final rotation in the sum of turns.

### 2.2 Stavropoulos, Lakshminarasimhan, Laurens, Pitkow & Angelaki 2022
*eLife* 11:e63405. Read: **[full: Results and Methods; Discussion only in part]** through PMC8856658 (https://pmc.ncbi.nlm.nih.gov/articles/PMC8856658; the eLife page served a browser check).

**Needed (ACCESS.md):**
- whether people adapt to the control time constant;
- the biases by control dynamics and by sensory modality;
- the authors' view of which control best measures integration.

**Found:**
- **Set-up.**
  - 15 adults; about 1,450 trials each, about 480 per sensory condition.
  - Vestibular (platform motion in darkness), visual (optic flow, still platform) and combined conditions.
  - Steering to a target cued for 1 s: radius 25 cm, at ±38° and 2.5–5.5 m.
  - Ground of triangles 5.95 × 12.95 cm, 2.5 per m², each living about 250 ms. Camera 70 cm above the ground.
  - Screen 158 × 94 cm, 77 cm from the back of the head: at least about 92° × 63° (my arithmetic; the eyes sit nearer than the back of the head, so the true field is wider).
  - The target flickered at 5 Hz.
  - No performance feedback; about 10 practice trials.
- **Control dynamics.** A low-pass filter on the joystick:
  - τ = 0.6 s behaves like velocity control and τ = 3 s like acceleration control;
  - τ followed a bounded random walk across trials. The appendix groups span about 0.34–8.89 (no unit in the table read; seconds, by the 0.6 s and 3 s examples);
  - the maximum speed was scaled with τ so that travel time stayed comparable.
- **Biases (mean ± SD).**

  | Condition | Radial gain | Angular gain |
  |---|---|---|
  | Vestibular | 0.76 ± 0.25 | 0.79 ± 0.22 |
  | Visual | 0.88 ± 0.23 | 0.98 ± 0.14 |
  | Combined | 0.85 ± 0.22 | 0.95 ± 0.12 |

- **Bias against τ, visual condition (gain, mean ± SEM).** Undershoot at small τ, modest overshoot at large τ.

  | τ group | Radial gain | Angular gain |
  |---|---|---|
  | Low | 0.818 ± 0.057 | 0.919 ± 0.036 |
  | Medium | 0.871 ± 0.059 | 0.984 ± 0.038 |
  | High | 0.944 ± 0.061 | 1.024 ± 0.040 |

  Residual error correlated with τ: radial 0.36 ± 0.03 and angular 0.23 ± 0.03 (visual).
- **Adaptation.**
  - People adapted to the changing dynamics only partly, closest to no adaptation in the vestibular condition.
  - A model with a prior over τ explained this. The prior-to-likelihood width ratio λ was 0.30 (vestibular), 1.02 (visual) and 0.80 (combined): in the visual condition, prior and sensory evidence were weighted about equally.
  - Participants did not exploit the correlation between consecutive τ values.
- **Authors' conclusions.**
  - Vestibular and visual steering were equally accurate only under acceleration control.
  - Optic flow, not vestibular input, is what people use to infer the dynamics.
  - They name no preferred control scheme for measuring integration. They suggest testing whether feedback removes the bias in estimating the dynamics; without feedback, people "would be unaware" of the discrepancy.

**Inference:**
- Changing the control dynamics from trial to trial adds a bias that people do not fully correct without feedback. A fixed control law avoids that.
- On a screen (visual only), the direction answer is nearly unbiased in this set-up (gain 0.98). The distance answer undershoots (0.88).
- Lakshminarasimhan 2018 found overshoot instead (2.3), with a different camera height, target range and texture. **The sign of the distance bias depends on the set-up**, so Reckon's distance bias has to be measured, not assumed.

**Effect on Reckon:**
- **Walking back (no change).** The walk-back control is velocity control with a fixed 0.15 s ease (view.js `WALK_TAU`). Only the speed varies per item (1.05–1.95 m/s). That matches the finding: vary the gain, keep the dynamics.
- **Steering rung (O37).**
  - Velocity control with one fixed small time constant: τ about 0.15–0.6 s; Stavropoulos's velocity-like end was 0.6 s.
  - Never vary τ within a rating.
  - A steady target, never a 5 Hz flicker (rule 8).
  - End-point feedback (Noel 2020; 4.1).

### 2.3 Lakshminarasimhan, Petsalis, Park, DeAngelis, Pitkow & Angelaki 2018
*Neuron* 99:194–206. Read: **[full]**. The STAR Methods came through the PMC BioC service for PMC6190923 (https://www.ncbi.nlm.nih.gov/research/bionlp/RESTful/pmcoa.cgi/BioC_json/PMC6190923/unicode); the PMC page itself showed a reCAPTCHA. Results as in the bioRxiv preprint read in 1.1.

**Needed (ACCESS.md):** the ground densities, element size and lifetime, field of view and joystick limits, to set the flow levels and their step.

**Found (STAR Methods):**

| Parameter | Value |
|---|---|
| Display | red–green anaglyph projection, screen 149 × 127 cm at 67.5 cm from the eyes: about 96° × 87° (my arithmetic); 60 Hz |
| Camera | 1 m above the ground |
| Ground elements | isosceles triangles 8.5 × 18.5 cm; each lives about 250 ms, then moves and turns at random |
| Density | 2.5 per m² (high) or 0.1 per m² (low), randomly interleaved |
| Target | 20 cm radius, blinking at 5 Hz for about 1 s; at ±42.5° and 0.7–6 m; a long-range version at 2–32 m |
| Joystick | 2 m/s and 90°/s; a speed condition of 4 m/s and 180°/s was randomly interleaved |
| Sample | 19 subjects; 7 did 2,000 trials over 8 sessions; about 10 practice trials; no performance feedback |

**Found (Results, as in 1.1):**
- **Overshoot.** Bias slopes were above 1.
- **Density.** Dense: radial 1.27 ± 0.1, angular 1.58 ± 0.1. Sparse: 1.46 ± 0.1 and 2.13 ± 0.1.
- **Speed.** Doubling the speed limit did not change the bias: radial 1.33 (fast) against 1.38 (slow), p = .59; angular 1.92 (fast) against 1.72 (slow), p = .15.
- **Landmark.** A distant mountain panorama (two of eight sessions) brought the angular bias down to 1.1 ± 0.04. The radial bias stayed at 1.29.
- **Long range.** Undershoot replaced overshoot only for the 32 m targets.
- **Strategy.** Four of seven subjects turned first and then moved straight.

**Inference: the density step.** Reckon's flow levels are:
- textured: blobs 0.3–0.9 m, 0.35 per m²;
- sparse: 0.12 per m²;
- short-lived dots: 0.6 per m², living 0.8–1.4 s.

Static blobs can be tracked; the lab's 250 ms triangles cannot. The table counts the marks in view (my arithmetic: kit fade distance, 70° field, pitch −10°).

| Screen | Textured | Sparse |
|---|---|---|
| 360 px portrait phone at DPR 2 (fade at about 14 m) | about 39 | about 13 |
| 740 px landscape phone (fade at about 20 m) | about 82 | about 28 |
| Lab, dense, within 10–20 m of a 96° view | about 210–840 | |
| Lab, sparse, same area | | about 8–34 |

- Reckon's step is 3× in density. The lab's was 25×, and it moved the gains by +0.19 radial and +0.55 angular.
- On a phone, Reckon's "textured" level is already close to the lab's sparse condition.
- So the 0.35-logit flow step is an untested guess. Its size may also differ between screens: the counts in view vary about threefold between a portrait phone and a large desktop view (desktop 1,200 px at DPR 2: about 133 and 46).

**Effect on Reckon:**
- No change to the levels now.
- If pooled exports show no difference between flow levels 0 and 1, lower "sparse" to about 0.05 per m² (about 5 marks in a phone view), or merge the two levels. This is O16's refit.
- Doubling the speed did not change the bias. That supports varying speeds only to remove the clock, without expecting speed itself to add bias.

### 2.4 Wiener & Mallot 2006
*Spatial Cognition and Computation* 6:333–346, https://doi.org/10.1207/s15427633scc0604_3. Read: **[abstract]** (staff-profile page, https://staffprofiles.bournemouth.ac.uk/display/journal-article/13752). No full text was reachable: the bohrium.com copy served a firewall page; no PDF was found before the search budget ran out.

**Needed (ACCESS.md):** segment counts, path lengths, and the error and response-time data.

**Found (abstract only):**
- Back-projection VR, passive transport, then speeded pointing to the start.
- Complexity was varied by the number of segments, with total length, total turning and turn direction held constant.
- Response times fell as complexity rose, and pointing became slightly more accurate. That is against common path-integration models.
- No numbers in the abstract.

**Inference:** in visual, passive path integration, the leg count by itself does not make an item harder; length and turning probably do (R1 §3.6 points the same way). Reckon's route levels change all three together:
- mean path 16.8, 23.0 and 24.5 m for 2, 3 and 4 legs (gen.js `MEAN_PATH`);
- one turn per extra leg.

**Effect on Reckon:**
- No change now.
- The 0.55 logit "per extra leg" step should be read as a stand-in for "more length and more turning", and refitted (O16).
- If O35's restructure lands (section 3), define the route levels by total turning and length, not by leg count alone.

### 2.5 Wiener, Berthoz & Wolbers 2011
*Experimental Brain Research* 208:61–71, https://doi.org/10.1007/s00221-010-2460-7.
Read: **[abstract]** (PubMed, https://www.pubmed.gov/20972774/; Edinburgh research portal), plus **[secondary: He & McNamara 2018b, full]** (https://link.springer.com/content/pdf/10.3758/s13423-017-1307-7.pdf). The publisher's full text was blocked.

**Needed (ACCESS.md):** path geometry, the exact instructions, and the error sizes per strategy and path length.

**Found:**
- **Design.** Triangle completion: participants turned and walked back to the start. They were instructed either to update the start continuously while moving, or to remember the outbound path's shape and compute the way home at the end.
- **Accuracy and speed.** Homing was more accurate with the configural strategy and faster with the continuous one.
- **Head orientation.** Under continuous updating, the head turned toward the start during the outbound walk. The authors propose this as an online measure.
- **Secondary report (He & McNamara 2018b).** Two outbound lengths, 8.3 and 15.3 m. Direction error differed between strategies only on the long path. No error values are given in that report.
- **Instructions in He & McNamara 2018b**, a walking HMD study with no landmarks, pointing with a joystick, n = 12 per experiment:
  - configural: watch the shape of the path, and mentally draw and remember it before pointing;
  - continuous: keep track of the first waypoint's location, and update your own position and direction relative to it as you go.
- **Not obtained:** Wiener 2011's set-up details (real or virtual walking), leg lengths, turn angles, and the error sizes.

**Inference:**
- Reckon's two cards ("Picture the shape from above"; "Keep the start as a direction from you") match the instructions used in these studies.
- The comment at learn.js:49–52 is consistent with what was read.
- Two phrases on the cards have no source:
  - "Quick and steady when … the turns come fast" ("steady" and "turns come fast" were not tested);
  - "After two misses in a row, try the other way" (a design choice).
- Both studies used walking. Neither tested a screen.

**Effect on Reckon:** no change to the design. Optionally reword the "analytic" card's `when` line to what was found ("Quicker to answer; on longer routes, the picture was more accurate in one walking study"). Keep "switch" as advice, not a finding.

### 2.6 Fernandes & Feiner 2016
"Combating VR sickness through subtle dynamic field-of-view modification", IEEE 3DUI 2016, https://doi.org/10.1109/3DUI.2016.7460053.
Read: **[secondary]**: an IEEE Spectrum news report (https://spectrum.ieee.org/tech-talk/consumer-electronics/gaming/dynamic-field-of-view-restriction-makes-virtual-reality-less-barfy), the ScienceDaily release (1.1) and the description in Cao, Grandi & Kopper 2021. The Semantic Scholar record lists the paper as closed access; IEEE Xplore returned no text.

**Needed (ACCESS.md):** restriction amounts and timing, effect sizes on sickness, and any effect on spatial performance.

**Found (secondary only):**
- **Set-up.** Oculus Rift DK2 HMD with head tracking; 32 paid participants, 30 analysed; two sessions on two days; free exploration of a virtual villa.
- **The restrictor.** It narrowed the field during virtual motion and rotation. Its cut-out ran from transparent inside an inner angle to opaque beyond an outer angle; the angles were lost in the text read.
- **Results reported.** People with the restrictor stayed longer and felt more comfortable. 11 of the 15 in the restrictor condition did not notice the field change.
- **Not obtained:** the restriction amounts, the trigger speeds, the fade rates, effect sizes, and any test of spatial performance.

**Inference:**
- The evidence comes from a wide-field HMD.
- A phone shows Reckon's view in about 12–25° of visual angle (6.5–12 cm wide at 30 cm; my arithmetic). A desktop view 35 cm wide at 60 cm fills about 33°. So there is little or no periphery to restrict.
- On large monitors a restrictor would cut the peripheral flow that carries the stimulus.
- No study read tests field-of-view restriction on a flat screen.

**Effect on Reckon:** do not build a dynamic restrictor. On large screens, the safer lever is an optional smaller view: cap the 3D view's physical size and keep the 70° geometric field, so the task is unchanged. Log it per trial (section 5).

### 2.7 Cao, Jerald & Kopper 2018
"Visually-induced motion sickness reduction via static and dynamic rest frames", IEEE VR 2018, https://doi.org/10.1109/VR.2018.8446210.
Read: **[title only]**, plus **[secondary: Cao, Grandi & Kopper 2021, full]** (https://www.frontiersin.org/articles/10.3389/frvir.2021.604889/full). No copy was found before the search budget ran out.

**Needed (ACCESS.md):** the rest-frame designs and their effect sizes.

**Found (secondary only):**
- Rest frames reduced discomfort during virtual travel in HMDs. The designs described are a cockpit-like frame and a task prop (a metal net).
- Software rest frames were reported to work about as well as physical props.
- No numbers.

**Other sources read this time** (details in section 5):
- **Prothero et al. 1999** (in the Keshavarz et al. 2015 review): a stable grid laid over the scene reduced visually induced sickness without reducing vection.
- **Fixation points** reduced it in several studies cited by the same review.
- **Nooij et al. 2017** (full, PLOS ONE): full-field yaw at 60°/s; worst sickness rating (FMS, 0–20) 8.07 without, 4.6 with fixation and a counter-rotating centre; a significant main effect of fixation, F(1,14) = 9.46, p = .008.

**Inference:**
- On a phone or a desktop window, the page round the view already acts as a rest frame. The 3D view never fills the visual field.
- The evidence for a screen-fixed fixation mark is stronger than for any designed rest frame, but it comes from wide-field lab displays.

**Effect on Reckon:** keep the view inside the page (no full-screen immersion), as now. An optional small screen-fixed fixation dot in the gentle profile is the cheapest evidence-based addition (section 5).

## 3. Rated levels that resist turn-counting (O35)

### 3.1 The problem
1.1 found two things (RV-reckon-homing B1, B3; DECISIONS.md 2026-11-13, decision (a)):
- Answers built from the turns alone hit far above chance, because of the route geometry.
  - "Legs taken as equal" hits 83 / 68 / 48 % at 40 / 30 / 20°.
  - "Turn about 130° toward the side you turned" hits 100 % in some cells.
- On 2-leg and small-turn routes the start always lies on the side of the net turn.

So rule 5 now bounds only the answers that integrate nothing. The turn-only family is reported, not bounded. A fixed angle is exempt in 11 easy cells (EXEMPT_FIXED). O35 asks how to make the rated levels resist these answers.

### 3.2 What the literature supports (Found)
- **People fall back on typical answers.**
  - Blind-walking turn responses regress strongly toward the mean: encoded turn slope 0.48 with a 44° intercept (Klatzky et al. 1999, R1 §3.1).
  - Reproduced distances and angles are pulled toward the centre of the block's range, more so for wider ranges (Petzschner & Glasauer 2011, R1 §3.4).
  - When the evidence about control dynamics was weak, people leaned on a prior (Stavropoulos 2022, λ = 0.30 in the vestibular condition; 2.2).
  - A "typical turn toward the side of the net turn" is therefore close to what a person with poor encoding does anyway. Loose tolerances reward that prior.
- **To rule out a non-integrating cue, these studies decorrelate it from the answer by design:**
  - speed varied by ±60 % to rule out timing (Petzschner & Glasauer 2011);
  - randomised velocities (Riecke et al. 2002: errors uncorrelated with velocity);
  - segment count varied with length and turning held constant (Wiener & Mallot 2006).
- **Feedback on the end point reduces systematic bias** within a session (Noel 2020). It gives people a reason to integrate more precisely, but no evidence that they drop a heuristic.
- **Gap.** No study read deals with turn-counting shortcuts in a pointing task. The design below comes from the geometry, not from a human study.

### 3.3 Simulations (Inference)
**Method.**
- Scripts were run outside the repository with Node, independently of gen.js.
- One baseline used the real generator (`def.generate`, point items, 300 seeds per cell, steady speed, textured ground).
- The strategies scored, all two-fold cross-validated where a constant is fitted:
  - **EL:** equal legs, the true turns;
  - **side-fixed:** 180° − sign(net turn) × A, best A;
  - **fixed:** the best single angle;
  - **turn-only kNN:** for each item, the answer that hits most of the 25 training items with the nearest turn sequences. It is an empirical stand-in for *any* answer that depends on the turns alone. With 300 items it under-estimates that best answer when there are three or more turns.

**(a) Baseline, the current generator (hit rates, %).** chance + 10 is 32 / 27 / 21 at 40 / 30 / 20°.

| Route (legs, turns) | Tol | EL | Side-fixed | Fixed | Turn-only kNN |
|---|---|---|---|---|---|
| 0 (2, medium) | 40 / 30 / 20 | 100 / 97 / 59 | 100 / 93 / 67 | 48 / 42 / 36 | 100 / 95 / 69 |
| 1 (3, small) | 40 / 30 / 20 | 100 / 100 / 96 | 99 / 99 / 86 | 52 / 49 / 39 | 100 / 100 / 98 |
| 2 (2, large) | 40 / 30 / 20 | 93 / 62 / 30 | 91 / 66 / 30 | 50 / 36 / 17 | 94 / 72 / 54 |
| 3 (3, medium) | 40 / 30 / 20 | 63 / 33 / 12 | 30 / 22 / 19 | 29 / 23 / 17 | 59 / 51 / 43 |
| 4 (4, small) | 40 / 30 / 20 | 100 / 100 / 93 | 98 / 75 / 62 | 52 / 37 / 29 | 100 / 96 / 87 |
| 5 (3, large) | 40 / 30 / 20 | 30 / 31 / 16 | 21 / 41 / 32 | 26 / 24 / 13 | 57 / 58 / 61 |
| 6 (4, medium) | 40 / 30 / 20 | 88 / 71 / 46 | 41 / 29 / 25 | 25 / 20 / 9 | 83 / 68 / 47 |
| 7 (4, large) | 40 / 30 / 20 | 85 / 60 / 36 | 60 / 45 / 31 | 31 / 22 / 14 | 79 / 61 / 44 |

These agree with RV-reckon-homing B1. Some answer built from the turns alone reaches 43–61 % even at 20° on 3–4-leg routes, whatever heuristic a reviewer happens to test.

Two facts behind this:
- **2-leg routes.** For a 2-leg route with turn T, the key always lies between 180° − T and 180° on the side of the turn; the leg ratio only moves it within that range. At 40° with T ≤ 120°, R1's rules (the axis gap; the reversed answer 180° − T must miss) leave too narrow a range for the legs to move the key out of one tolerance window.
- **4-leg routes.** The generator draws the first n − 1 legs in [4, min(12, 24/(n − 1))] m, which is [4, 8] m for 4 legs (js/ex/homing/gen.js:218). So 4-leg routes have little leg contrast.

**(b) Candidate construction: turns first, then one of K far-apart keys.**

The steps:
1. Draw the turns.
2. Sample 600 leg vectors within the leg and path limits.
3. Keep those that pass R1's rules (home distance 5–20 m; the path keeps 3 m from the start; the axis gap; the reversed, not-updated and mirror answers miss by tol + 2°).
4. Find K reachable keys pairwise more than 2·tol + 8° apart.
5. Pick one at random as the item's key, and take legs that reach it within 2°.

**The guarantee.** Any answer that is a function of the turns alone hits at most one of the K alternatives, so its hit rate is at most 1/K by construction. This covers EL, side-fixed, EL plus an offset, and anything else of that kind. Turn sequences without K alternatives are redrawn.

**Recommended settings tested:** legs 3–15 m, total 10–28 m (so durations stay as today's: mean path 19–25 m), K = 2, and a final on-the-spot rotation of ±30–150° after the last leg (section 3.3(c)). Hit rates in % (200 items per cell; bound = 50 by construction):

| Legs, turns | Tol | Turns drawn that had 2 alternatives | EL | Side-fixed | Fixed | Turn-only kNN |
|---|---|---|---|---|---|---|
| 2, large | 40 / 30 / 20 | 13 / 64 / 87 | 43 / 25 / 21 | 27 / 19 / 15 | 25 / 19 / 19 | 44 / 46 / 40 |
| 3, medium | 40 / 30 / 20 | 32 / 42 / 62 | 30 / 23 / 24 | 24 / 26 / 30 | 30 / 24 / 25 | 50 / 31 / 31 |
| 3, large | 40 / 30 / 20 | 21 / 35 / 65 | 42 / 39 / 36 | 39 / 38 / 32 | 40 / 25 / 18 | 44 / 31 / 28 |
| 4, medium | 40 / 30 / 20 | 10 / 23 / 39 | 29 / 32 / 17 | 26 / 21 / 20 | 20 / 27 / 24 | 43 / 35 / 30 |
| 4, large | 40 / 30 / 20 | 1 / 8 / 21 | – / 34 / 23 | – / 21 / 16 | – / 21 / 25 | – / 41 / 33 |

In this table the no-integration answers mostly stay within a few points of chance + 10. The exception is 3 legs with large turns at 40°: fixed 40 % and side-fixed 39 % against 32 %. Start that cell at 30°, or check it with more items.

Other runs (same method; outputs kept in the scratch scripts, not in the repository):
- **2-leg medium and the small-turn routes (3 or 4 legs, small).** Infeasible at 40° and 30° with any leg range tried (4–12, 3–15, 2.5–15 m). At 20° they work for at most 12–57 % of turn draws.
- **K = 3** (legs 2.5–15 m) lowers the bound to about 35–45 %. K up to 6 gives 31–41 %. Only 3–4 legs with large turns at 20° come near chance + 10 (kNN 22–26 % against 21 %).
- **Without the final rotation**, the turns-first construction piles keys at the edges of the reachable range. The best fixed angle then reaches 40–54 % in several cells (for example 2-leg large at 30°: 48 %; 3-leg medium at 40°: 43 %), which breaks the rule-5 bound that holds today.
- **Keeping today's legs (4–12 m) plus the rotation** works too, but fewer turn draws qualify: 4-leg medium at 30°, 14 %; 3-leg large at 30°, 15 %.

**(c) Final in-place rotation alone** (the real generator's items with a final turn of ±30–150° added; key' = key − R). R1's rules were not re-checked for these.

| Route, tol | EL | Side-fixed | Fixed | Turn-only kNN |
|---|---|---|---|---|
| 0, 40° | 100 → 100 | 100 → 30 | 48 → 33 | 100 → 89 |
| 2, 40° | 92 → 92 | 89 → 21 | 51 → 22 | 95 → 74 |
| 6, 20° | 44 → 44 | 21 → 11 | 16 → 11 | 46 → 21 |
| 7, 40° | 84 → 84 | 62 → 31 | 36 → 29 | 78 → 54 |

In the 11 EXEMPT_FIXED cells (400 items each), the best fixed angle drops from 27–55 % without the rotation to 11–33 % with it. Every cell is then under chance + 10, except route 4 at 40°: 33 % against 32 %, within sampling noise.

**Reading:**
- A final rotation does nothing against "legs taken as equal": the rotation is just one more turn to add.
- It does remove the net-turn-side prior and spreads the keys, so the EXEMPT_FIXED cells could go. A real generator must then apply the axis gap and the other rules after the rotation.
- It adds a pure heading-update step, the component visual-only path integration handles worst (2.1; Riecke & Wiener 2007).
- The kNN drop is a sampling artefact of one more dimension; it is not a real gain.

**(d) Return items, the distance half.**
- Suppose the home distance d is log-uniform on [a, b]. Then a single fixed walk-back distance, with the true direction, hits with probability ln((1 + τ)/(1 − τ)) / ln(b / a) (my derivation).
- For today's 5–20 m that gives 79 / 53 / 37 % at τ = 0.5 / 0.35 / 0.25. RV-reckon-homing measured 78 / 59 / 44 % on the real distribution (in-sample best distance).
- Widening d to 3–20 m gives 58 / 39 / 27 %. A top tolerance of τ = 0.2 on 3–20 m gives 21 %.
- Human distance errors on screens are about 7–31 % (Riecke 2002) and gain SD about 0.23 (Stavropoulos 2022, visual). So τ = 0.2 is a demanding top level, not an impossible one.

### 3.4 Proposal (O35)
1. **Two kinds of rated route level, said plainly.**
   - **Turn levels:** today's routes 0, 1 and 4 (2 legs medium; 3 and 4 legs with small turns). They stay as they are and train heading updating, the fragile part. The Library note stays: the turns tell you much of the way home.
   - **Leg levels:** 3–4 legs with medium or large turns, and 2 legs with large turns at 30° and 20°. These use the construction in 3.3(b). Two exceptions: 4 legs with large turns at 40° rarely qualifies (1 % of turn draws), and 3 legs with large turns at 40° left fixed answers at 39–40 % against 32 %. Start both at 30°.
   - In the engine this is one new dim, `legs` with levels 0 (any route) and 1 (legs decide between two answers). The engine raises it as the rating grows. Its logit step is unknown: hand-set 0.4, then refit (O16).
2. **Leg-level parameters:**

   | Parameter | Value |
   |---|---|
   | Legs | 3–15 m; 3 m at 2 m/s is 1.5 s plus ramps, the shortest leg still worth seeing |
   | Total path | 10–28 m |
   | Home distance | 5–20 m |
   | K | 2 (K = 3 for a later level) |
   | Separation of the K keys | > 2·tol + 8° |
   | Final rotation on the spot | ±30–150° at 30–45°/s, counted in the heading-not-updated rule |

   - The item stores its alternatives (`alts: [{ legs, key }]`). The validator re-derives each alternative's key from its legs and checks the separation and R1's rules, which keeps the guarantee solver-verified (rule 4).
3. **Tests.**
   - Bound the turn-only family per leg-level cell at 1/K + 10 points (≤ 60 % for K = 2). Assert it both by construction (the alternatives) and empirically (a turn-only kNN).
   - Keep rule 5's chance + 10 for the no-integration answers in every cell. With the final rotation, drop EXEMPT_FIXED.
4. **Return items.** Draw home distances log-uniform over 3–20 m (as rules allow) and add a fourth tolerance level τ = 0.2. Report "true direction + best fixed distance" per cell, and bound it at chance + 10 at τ ≤ 0.25.
5. **Graded continuous error: not for v1.2.**
   - The estimator's update is a binary likelihood (js/engine/estimator.js:89). A fractional score s would need pc^s·(1 − pc)^(1 − s) and new item models, and it would still let turn-only answers earn most of the credit on turn levels.
   - Keep binary rating with the graded feedback Reckon already shows. If the lead wants it, prove it first in tests/node/sim.mjs.
6. **Homing** shares the route model (js/ex/homing/gen.js `search`) and the same turn-only weakness (RV-reckon-homing B1). The leg-level construction could serve Homing's no-landmark level later. With landmarks in view the turns are easy anyway, so this is a lower priority than Reckon.

Grade of evidence for 1–4: **D**. The design comes from geometry and simulation; no human data shows that leg levels train leg integration better. Pooled exports (value, value2) can test it: on leg levels, the angle error should depend on the legs.

## 4. Later rungs (O37), drift trend (O38), magic window (O44)

### 4.1 Mid-route probes: "point to the start now" (O37)
**Found:**
- **Stangl et al. 2020** [full: Results and Methods; stop details re-read this time through PMC BioC].
  - **Paths.** 10 curved paths in VR, walked with a guide. Each was a 4-leg path (legs 2, 3.5, 5 or 6.5 m; turns 55°, 80° or 105°) smoothed into a spline, 17.7 m long.
  - **Probes.** Four stops per path. At each, a spoken distance to the start and a body turn toward it.
  - **Stops did not change the end error.** 30 of 48 paths had stops, 18 only an end response. Stop trials took 88.7 ± 12.4 s against 35.2 ± 3.9 s, yet errors were "very similar" (figure only, no numbers in the text).
  - **Error grew with distance travelled, not time.**
  - **No accuracy feedback.** The scene had distal landmarks at infinity (R1 §3.4), so heading was anchored.
- **Wiener, Berthoz & Wolbers 2011** (abstract; 2.5): with continuous-updating instructions, answers were faster and the head turned toward the start during the outbound walk; with the configural strategy, answers were more accurate, on long paths only.

**Inference:**
- Probes did not distort the final estimate in the one study that tested this. It was walking with a heading anchor, not a screen.
- Probes reward keeping the home vector up to date, which is the continuous strategy. In one walking study that strategy was less accurate on long paths. Probes may therefore shift *which* strategy players practise, not only how much.
- Probe answers show where the error grew, which R1 §8.1(c) wanted for feedback.

**Proposal (parameters):**
- **Where:** a rung on 3–4-leg routes. One probe at first, two later.
- **When:** at the end of a randomly chosen leg other than the last, after the walker stops and before the turn.
- **How:** the dial only, "Where is the start now?", with no feedback until the end. It costs about 5 s (`RESPONSE_MS`).
- **Rating:** rate the final answer only (one item, one outcome). Log each probe's signed error in `detail`. Show-me draws each believed home vector at its stop.
- **Timing and validity:**
  - motion stays ≤ 30 s in total, excluding probe time;
  - the stutter and void rules apply to each motion segment;
  - the final answer clock starts at the end-of-route frame;
  - a probe is not a pause.
- Grade: **C**.
- A further, untested idea: continuous pointing ("keep the arrow on the start as you move"), after Wiener 2011's head-orientation measure. It is a dual task with no training data, grade **D**; not for v1.2.

### 4.2 Curved legs (O37)
**Found:**
- Stangl 2020 used smoothed curved paths (walking).
- On passive desktop videos, judgements on curved loops were harder (59 % correct, chance 50 %) than on translation-only (68 %) or rotation-only (70 %) clips (Chrastil 2017, R1 §3.6).
- In the firefly task, the 3 of 7 subjects who steered curved paths had biases similar to those of the turn-then-go subjects (Lakshminarasimhan 2018).
- Comfort: two- or three-axis rotation caused more sickness than one-axis rotation (Keshavarz & Hecht 2011a, in the Keshavarz 2015 review). A curve is yaw plus translation, a single rotation axis. No study read measured curves on small screens.

**Proposal:**
- A late route level where legs may be arcs of constant curvature: turn rate ≤ 30°/s while moving at ≤ 1.8 m/s, so the radius is ≥ 3.4 m (v/ω, my arithmetic). Sweeps 30–120°.
- The validator integrates each arc in closed form (centre, radius, sweep; R1 §6.5).
- The K-alternatives construction treats each arc's sweep as a turn.
- Grade: **C/D**.

### 4.3 Active steering, the "firefly" rung (O37)
**Found:**
- **Lakshminarasimhan 2018** (2.3): targets at 0.7–6 m and ±42.5°, cued for 1 s; joystick limits 2 m/s and 90°/s. Overshoot: radial 1.27, angular 1.58 on dense ground. Doubling the speed limits changed nothing.
- **Noel 2020** (R1 §4.1; same task): a bull's-eye of six rings after each stop, its size set by a staircase. Bias fell to 0.97 radial and 1.09 angular, and trials shortened from 5.4 to 3.7 s.
- **Stavropoulos 2022** (2.2): biases depend on the control dynamics; adaptation is partial without feedback.
- **Lappe et al. 2007** (R1 §3.3): moving to a remembered target gives overestimation, while judging the distance already travelled gives underestimation.
- **Saredakis et al. 2020** (meta-analysis of HMD studies; read this time): mean total SSQ (Simulator Sickness Questionnaire) differed by locomotion (Q = 15.99, p < .001):
  - controller-based locomotion 32.5;
  - stationary 28.0;
  - physical walking 17.0.

**Inference:**
- Steering to a target seen before moving is a different task from homing: the key is fixed before you move, and its bias runs the other way (Lappe). It needs its own rating, not just a variant offset.
- R1's assumption that active control is gentler is not supported for hand-held controllers: in HMDs, controller-driven locomotion was the most sickening category.

**Proposal (parameters, phones first):**

| Parameter | Value |
|---|---|
| Target | a steady ground ring, never blinking (rule 8): radius 0.3 m, shown 1 s, at 2–6 m (log-uniform) and within ±30° (inside the 70° field). At 6 m the ring is about 7–8 px tall on a 360 px view (my arithmetic) |
| Control | one on-screen stick: forward 0–2 m/s, turn ±60°/s. Velocity control with one fixed time constant (0.3 s) and a 10 % dead zone; arrow keys on desktop. Stop with Here |
| Ground | short-lived dots, so no mark can be tracked to the target |
| Score | the stop within τ × target distance (τ 0.5 / 0.35 / 0.25) |
| Feedback | a bull's-eye of rings plus the true target |

Grade: **C** for the lab-derived values, **D** on phones (no phone study).

### 4.4 Drift trend over weeks (O38)
**Found:**
- Error grows with distance travelled, not time (Stangl 2020).
- Position-error SD grows roughly linearly with distance (Harootonian et al. 2020, R1 §3.2).
- Reporting noise, which does not grow with distance, is 26–28 % of squared error (Stangl 2020: radial 14–15 %, angular 12–13 %).
- Test–retest reliability over 6 trials was below .5 for end-point and angle error (McLaren et al. 2022, R1 §4.1).

**Inference (my arithmetic):**
- **Per-route reliability.** If 6 routes give r ≤ .5, one route gives at most about .14. Spearman–Brown then needs about 14 routes per estimate for r ≈ .7, 25 for .8 and 55 for .9.
- **A confound.** Drift per metre divides by path length, but the reporting part of the error does not grow with length. Drift per metre therefore falls on longer routes with no change in skill, and the engine lengthens routes as the rating rises. A raw weekly median mixes skill with the route mix.

**Proposal:**
- **Measure.** On Progress, per display class: drift on return routes, the end error per metre of outbound route.
- **Window.** The weekly median with its interquartile range, only for weeks with ≥ 15 return routes; merge thin weeks with the next.
- **Fair comparison.** Restrict to one band of outbound length (15–28 m), or adjust by route length.
- **Point items.** Show the median absolute angle error instead.
- **Wording.** Call it a tendency with a range. Say nothing about change unless the ranges separate.
- **Cleaner option.** A small fixed reference set each week (for example 4 return routes at one fixed level, kept out of the rating's level choice) would remove the confound. Decide it with the measurement research (PLAN-v1.2 §0, embedded probes).
- Grade: **C**.

### 4.5 Gyroscope "magic window" (O44)
**Found:**
- **Body rotation supports heading updating:**
  - only physical walking was free of the overturning error (Klatzky 1998, abstract);
  - people who swapped sides on screen did not do so when walking (Riecke & Wiener 2007);
  - rotations made without the body raised errors (Kelly et al. 2020, R1).
- **Physical locomotion went with less sickness in HMDs** (walking, SSQ 17.0 against 28–33; Saredakis 2020).
- **Not found:** any study of path integration with a phone turned as a window. The browser constraints (permission prompts, secure context, iframes) could not be checked: the MDN page was blocked twice.

**Inference:**
- Turning the phone would give real rotation cues, making a different and easier heading task.
- **It breaks Reckon's first commitment (R1 §8.1(a)).** To turn the view, the player turns their body in a real room, and the room, seen around the phone, is full of heading fixes ("now I face the window"). So the variant cannot be landmark-free.
- Turning up to 180° needs standing or a swivel chair, which is an accessibility cost.

**Proposal:** not for v1.2, and not as a rated Reckon variant. If ever built, make it an unrated "with your body" practice mode beside Homing. Grade: **C** (the logic, plus the evidence on body cues).

## 5. Motion comfort (O36)

### 5.1 What Reckon and Homing show today
- Legs at 1.8 m/s (steady, ±10 %) or 0.5–2.0 m/s (varied); Homing uses 1.8 m/s.
- Turns at 30–45°/s.
- Raised-cosine ramps of 0.4 s on every start and stop. Peak acceleration is π·v / 2T (my arithmetic):
  - 7.1 m/s² for 0–1.8 m/s in 0.4 s;
  - 177°/s² for 0–45°/s.
- On the 'varied within legs' level, one speed change within each leg (0.8 s blend).
- At most 30 s of motion per route.
- The view takes 12–25° of visual angle on phones (6.5–12 cm at 30 cm) and about 30–50° on desktop monitors (35–53 cm at 60 cm); my arithmetic. The geometric field is 70° (Reckon) or 74° (Homing).
- The page round the view stays visible.
- Comfort messages today: only the 'comfort' part card in Watch–Try–Go (js/ex/reckon/learn.js:26). Track has a one-time motion notice through the player (js/ui/play.js:618–634, `ui.seen.motionNotice`).

### 5.2 Evidence read
| Factor | Found | Set-up | Source (read) |
|---|---|---|---|
| Speed | Nausea and vection rose from 3.3 to about 10 m/s, then levelled off. Speed changed the *onset* time, not the rate of rise. No speed under 3.3 m/s tested | HMD 48° × 36°, closed loop, 30 min, n = 96 (12 per speed) | So et al. 2001 [full] |
| Time course | Vection rose significantly after 5 min, nausea after 10 min | same | So et al. 2001 |
| Time course | No general maximum exposure. First significant SSQ rise at 10 min in two studies; nausea roughly linear over 20 min in another | Review of 41 simulator and VR studies; desktop applications excluded | Dużmańska et al. 2018 [full: results] |
| Breaks | Not tested as an intervention in any reviewed study (1–2 min rests between trials were used). A first immersion should be "treated with extreme caution" (Reinhard et al. 2017, cited) | same | Dużmańska et al. 2018 |
| Repeated sessions | Symptoms usually fall over repeated exposures, best with days between sessions; one study's reduction still held on day 22. Adaptation also within a day | same | Dużmańska et al. 2018 |
| After-effects | Mostly gone within 10–30 min; in some studies up to about 4 h | same | Dużmańska et al. 2018 |
| Duration (HMD) | Total SSQ 23.5 (< 10 min), 33.4 (≥ 10 min), 27.4 (≥ 20 min); moderator p = .066. Mean sickness dropout 15.6 % across 46 experiments | Meta-analysis, HMD only | Saredakis et al. 2020 [full: results tables] |
| Yaw rotation | Constant 60°/s full-field yaw for up to 20 min. Worst FMS (0–20) 8.07 with nothing to fix on, 4.6 with fixation plus a counter-rotating centre; 4 of 15 stopped early in the worst condition | 230° × 125° projection; susceptible adults, n = 15 | Nooij et al. 2017 [full] |
| Fixation | Fixation significantly reduced sickness, F(1,14) = 9.46, p = .008. Vection was the main within-person predictor (partial R² 48 %) | same | Nooij et al. 2017 |
| Speed changes | An alternating expanding/contracting flow gave more onsets and offsets of vection and more sickness than constant expansion. Accelerations, not constant speeds, create sustained visual–vestibular conflict | Lab displays | Bonato et al. 2008 [secondary: Keshavarz et al. 2015] |
| Fixation and rest frames | A stable grid laid over the scene reduced sickness without reducing vection (Prothero 1999). Fixation points reduced sickness (Flanagan 2002, 2004; Webb & Griffin 2002) | Lab displays | [secondary: Keshavarz et al. 2015] |
| Display size | Large fields give strong vection and potentially sickness. A 3D game on a phone or desktop monitor "will rarely evoke" a felt self-motion | Review | Keshavarz et al. 2015 [full: main text] |
| Monitor, short clips | 20-s optic-flow clips on a 27-inch monitor (40° × 23° or 72° × 45°, n = 187): masks changed rated sickness, but only paired comparisons could detect it; the SSQ "lacked sensitivity" in their pilot | Monitor, stereo | bioRxiv 2024.12.26.630441 [full: preprint] |
| Active control | Controller-based locomotion had the highest SSQ (32.5), above stationary (28.0) and physical walking (17.0) | Meta-analysis, HMD | Saredakis et al. 2020 |
| Field-of-view restriction | Less discomfort and longer stays with a dynamic restrictor | HMD | Fernandes & Feiner 2016 [secondary only] (2.6) |
| Rest frames | Rest frames reduced discomfort | HMD | Cao et al. 2018 [secondary only] (2.7) |

### 5.3 Inference
- **Reckon's motion is mild by every studied standard.** The provocative stimuli were stronger, longer or both:
  - ≥ 3.3 m/s for 30 min in an HMD;
  - 60°/s full-field yaw for 20 min.

  Reckon shows ≤ 2 m/s and ≤ 45°/s, in bouts of ≤ 30 s, in a window that fills ≤ 25° of a phone user's view. The literature cannot say how mild: no study read used a phone, speeds under 3 m/s, or bouts this short.
- **The two risk factors with the best support.**
  - Cumulative exposure: symptoms build over minutes, with first significant rises at about 5–10 min in HMDs and simulators.
  - Changes in self-motion: speed changes and accelerations.
- **The 'varied within legs' speed level is the most provocative thing Reckon shows.** It adds a speed change in every leg, which is Bonato's "vection change".
- **The proposed gentle profile (1.2 m/s, 30°/s, 0.6 s ramps):**
  - **Speeds.** Plausible but unverified. 1.2 m/s lies below every speed tested (an extrapolation of So 2001's trend). 30°/s is half the classic 60°/s drum speed and under Riecke 2002's 40°/s cap.
  - **Ramps.** 0.6 s ramps halve the peak acceleration (3.1 against 7.1 m/s²; 79 against 177°/s²) but lengthen each acceleration phase. No study read compares ramp lengths, so whether longer or shorter is gentler is open.
  - **Duration.** The profile stretches the routes. A 4-leg route with three large turns (mean 24.5 m, turns about 140°) needs about 39 s of motion against about 26 s today, or about 42 s with a final rotation (my arithmetic: L/v + |T|/ω + one ramp per piece). That breaks the 30-s cap (gen.js `MAX_MOTION`).
- **Two stronger levers the profile leaves out:**
  - no speed changes within a leg;
  - a fixation mark.

### 5.4 Proposal (O36, Homing too)
1. **A one-time notice** before the first route outside Watch–Try–Go, and before the first Homing route.
   - Text: "The view moves on its own. If you feel unwell, pause or stop. Gentle motion is in Settings."
   - Reuse the player's motion-notice mechanism (js/ui/play.js:618–634) with its own seen key (for example `walkNotice`), because Track's notice is about something else.
   - Grade **B** for a notice as practice: sickness dropout in HMD studies averages 15.6 %, and the reviewed studies urge caution on first exposure. The risk on phones is unknown.
2. **A check-in card after 3 min of cumulative motion in a session.**
   - Count route playback, the walk back and the Watch demo walk.
   - Show it at the next item boundary, never mid-route (rule 7), with: Go on · Gentle motion · End session.
   - Then every 5 min of motion.
   - The 3 min are conservative: in the studies read, symptoms first rose significantly at 5–10 min of continuous exposure, and no study tested breaks. Grade **C**.
3. **The gentle profile.**
   - Offered when the app's reduced-motion setting is on (`reducedMotion`, js/core/store.js:204), and from the card.
   - Values: 1.2 m/s, 30°/s, 0.6 s ramps, **plus**:
     - (a) no speed change within a leg: cap the speed dim at 'varied between legs', scaling those speeds by 2/3 so time still says little about length;
     - (b) a small screen-fixed fixation dot at the view's centre (Nooij 2017; the fixation studies).
   - Keep the 30-s cap by allowing at most 3 legs in gentle mode, or accept up to 40 s. That is a lead decision; the first changes difficulty, the second exposure.
   - Log the profile per trial (O17's answer-mode column) and keep gentle trials out of the pooled step refit until there are enough of them.
   - Grade **C** for (a) and (b), **D** for the exact speed and ramp values.
4. **No dynamic field-of-view restrictor.** On screens wider than about 1,200 CSS px, offer an optional "smaller view" (for example ≤ 60 % of the width), keeping the 70° geometric field. Log it. Grade **D**; the restrictor evidence is HMD-only.
5. **New players** (repeated exposure helps, best spread over days): their first Reckon or Homing block ends by default after about 5 min of motion, with an offer to go on. Grade **C**.
6. **Homing** shares the kit (js/ex/homing/view.js `walker`) and the same speeds (1.8 m/s, 45°/s, 0.4 s ramps; js/ex/homing/gen.js:120–123), so items 1–5 apply to it unchanged. Its landmarks act as a rest frame only in the loose sense that they are fixed in the world.

## 6. Proposed changes for v1.2, graded

**Evidence grades:**
- **A:** direct evidence in a comparable set-up (visual-only path integration on a flat screen), or Parallax's own data.
- **B:** good evidence from a related set-up (lab projection, HMD, walking) that should carry over.
- **C:** indirect evidence plus inference.
- **D:** design judgement, geometry or simulation only, with no human data.

Size (S/M/L) is my estimate.

| # | Change | Deferred item | Evidence (strongest) | Grade | Size |
|---|---|---|---|---|---|
| 1 | One-time "the view moves on its own; pause or stop if unwell" notice before the first Reckon or Homing route, reusing the player's motion-notice mechanism with its own seen key | O36 | Sickness dropout averages 15.6 % in HMD studies (Saredakis 2020); caution on first exposure (Dużmańska 2018) | B | S |
| 2 | Check-in card at the next item boundary after 3 min of cumulative motion, then every 5 min: Go on · Gentle motion · End | O36 | Symptoms build with exposure, first significant rises at 5–10 min (So 2001; Dużmańska 2018). Breaks themselves untested | C | S |
| 3 | Gentle profile: 1.2 m/s, 30°/s, 0.6 s ramps, **plus** no speed change within a leg, plus a screen-fixed fixation dot. Offered when reduced motion is on; logged per trial; 3 legs at most, or accept up to 40 s | O36 | Speed changes raise sickness (Bonato 2008, secondary); fixation reduces it (Nooij 2017: FMS 8.1 → 4.6). The exact values are untested below 3 m/s | C (values D) | M |
| 4 | No dynamic field-of-view restrictor. Optional "smaller view" on wide screens, with the same 70° geometric field | O36 | Restrictor evidence is HMD-only (2.6); a phone view fills 12–25° of the visual field | D | S |
| 5 | New players' first Reckon or Homing block ends by default after about 5 min of motion | O36 | Adaptation over repeated, spaced exposures (Dużmańska 2018) | C | S |
| 6 | "Leg levels": a new `legs` dim. At level 1, turns are drawn first (with a final on-the-spot rotation of ±30–150°), then the key is picked from 2 reachable keys > 2·tol + 8° apart. Legs 3–15 m, path 10–28 m. Alternatives stored and re-derived by the validator | O35 | Simulation: any answer from the turns alone ≤ 50 % by construction; fixed angles mostly within a few points of chance + 10, but 3-leg large at 40° is over (start it at 30°) (3.3). No human data | D | L |
| 7 | Final on-the-spot rotations at leg levels; drop EXEMPT_FIXED | O35 | Simulation: the best fixed angle falls under chance + 10 in all 11 EXEMPT_FIXED cells (route 4 at 40°: 33 % against 32 %) (3.3(c)); adds heading-update practice, the weak point in visual-only path integration (Riecke & Wiener 2007) | C | M (with 6) |
| 8 | Return items: home distances log-uniform over 3–20 m, a fourth tolerance τ = 0.2, and "true direction + fixed distance" bounded at chance + 10 for τ ≤ 0.25 | O35 | Closed form: 27 % (τ 0.25) and 21 % (τ 0.2) on 3–20 m (3.3(d)). Human distance errors of 7–31 % (Riecke 2002) | C | M |
| 9 | Keep the walk-back control law fixed (velocity control, 0.15 s ease); vary only speed. Same rule for any steering rung | O37 | Partial adaptation to changing dynamics, and the resulting bias (Stavropoulos 2022, r = .36 radial) | B | none |
| 10 | Reword the 'analytic' card's `when` line to what was found. Mark "after two misses, switch" as advice | O45 | Wiener 2011 (abstract), He & McNamara 2018b | C | S |
| 11 | Flow dim unchanged. Refit the step (O16); if levels 0 and 1 do not differ, make "sparse" 0.05 per m² | O45 | The lab's 25× density step changed bias a lot (Lakshminarasimhan 2018); Reckon's is 3× | C | S |
| 12 | Mid-route probe rung (one probe, then two; final answer rated, probes in the feedback) | O37 | Probes did not change final error (Stangl 2020, walking) | C | M |
| 13 | Curved legs (≤ 30°/s while moving, radius ≥ 3.4 m) | O37 | Curved loops harder (Chrastil 2017) | C/D | M |
| 14 | Active steering ("firefly") variant with its own rating: steady target 2–6 m, ±30°; 2 m/s, 60°/s; τ 0.3 s; bull's-eye feedback | O37 | Lakshminarasimhan 2018, Noel 2020, Stavropoulos 2022; Lappe 2007 (the bias runs the other way) | C (phone D) | L |
| 15 | Drift trend: weekly median with IQR, per display class, ≥ 15 return routes, one length band (or a weekly reference set) | O38 | Reliability arithmetic from McLaren 2022; error grows with distance (Stangl 2020) | C | M |
| 16 | Magic window: not for v1.2, and never as a rated Reckon variant (the real room gives heading fixes) | O44 | Body-rotation evidence (Klatzky 1998, Riecke & Wiener 2007, Kelly 2020) | C | none |
| 17 | The owed search for a path-integration training study with transfer, before any wording about training effects changes | O45 | Search not done (1) | n/a | S |

For v1.2 I would take 1–5, 9–11 and 17, and, if the lead wants O35 now, 6–8 (with a sim.mjs check of the new dim's targeting first). Items 12–15 suit v1.3; item 15 depends on the measurement research.

## 7. Open risks
1. **Leg levels are untested with people.** They could be much harder (legs must be integrated to within the tolerance) and cause floor effects at the moment the engine raises the new dim. The step for `legs` is unknown. Check the engine's targeting with a misspecified step in tests/node/sim.mjs before release.
2. **The turn-only bound stays high.** At about 50 % (K = 2) it is still above chance + 10 (21–32 %). Rule 5 needs a scoped statement for leg levels (a lead decision), and the Library text must stay honest about it.
3. **Some cells cannot qualify, and generation costs more.** 2-leg medium, small-turn routes and 4-leg large at 40° qualify rarely or never. Generation redraws turns (about 600 leg vectors per draw), so measure p95 against the current budget.
4. **Final rotations add load.** They add a pure heading update, where 37.5 % of naive people swapped sides on screen (Riecke & Wiener 2007). The heading Try item and the named side-swap hint must come before them.
5. **The comfort evidence is not from phones.** It comes from HMDs, projections and simulators, with stronger and longer stimuli. The risk on phones is unknown, probably low.
6. **The gentle profile changes the stimulus.** Slower routes mean more seconds per metre, and possibly fewer legs. Keep it logged and out of the pooled refit until it can be checked.
7. **Distance bias has no known sign.** It overshot in Lakshminarasimhan 2018 and undershot in Stavropoulos 2022, depending on the set-up. Feedback and any model of Reckon's distance errors must not assume a direction. The habit line already estimates it from the player's own answers.
8. **The training-transfer question is still open,** and so is the search; the bridge's "in any study we found" must stay.
9. **Five of the seven papers are still unread in full** (Could not open). With what was found, no current design choice depends on them alone. The per-leg step, the flow step and the strategy cards remain hand-set or abstract-based.
10. **The drift trend can mislead** if the route mix changes (4.4). Show it only with its range and its length band.
11. Phone validity (O18) and real-phone performance (O19) remain open and bear on every rung above.

## References
**Tags:**
- [full], [abstract], [secondary: X], as defined at the top.
- "[R1]": the summary in docs/research/v1.1/R1-path-integration.md, read in full in 1.1 and not re-read now. R1's tag for that source is given in brackets.

### Read in this pass
- Ackerman, E. (2016). Dynamic field of view restriction makes virtual reality less barfy. *IEEE Spectrum* (news). https://spectrum.ieee.org/tech-talk/consumer-electronics/gaming/dynamic-field-of-view-restriction-makes-virtual-reality-less-barfy [full; a secondary report of Fernandes & Feiner 2016]
- Avraamides, M. N., & Ioannidou, L. M. (2005). Locating targets from imagined perspectives: Labeling vs. pointing. *Proceedings of the Annual Meeting of the Cognitive Science Society, 27*, 175–180. https://repositories.cdlib.org/content/qt74c675vf/qt74c675vf.pdf [full; used for its account of Klatzky 1998]
- Avraamides, M. N., Klatzky, R. L., Loomis, J. M., & Golledge, R. G. (2004). Use of cognitive versus perceptual heading during imagined locomotion depends on the response mode. *Psychological Science*. https://kilthub.cmu.edu/articles/journal_contribution/Use_of_cognitive_versus_perceptual_heading_during_imagined_locomotion_depends_on_the_response_mode_/6618944 [abstract]
- Cao, Z., Grandi, J., & Kopper, R. (2021). Granulated rest frames outperform field of view restrictors on visual search performance. *Frontiers in Virtual Reality, 2*, 604889. https://www.frontiersin.org/articles/10.3389/frvir.2021.604889/full [full: body to about 80 %; some numbers lost in the page text]
- Cao, Z., Jerald, J., & Kopper, R. (2018). Visually-induced motion sickness reduction via static and dynamic rest frames. *IEEE VR 2018*. https://doi.org/10.1109/VR.2018.8446210 [secondary: Cao, Grandi & Kopper 2021]
- Dużmańska, N., Strojny, P., & Strojny, A. (2018). Can simulator sickness be avoided? A review on temporal aspects of simulator sickness. *Frontiers in Psychology, 9*, 2132. https://www.frontiersin.org/articles/10.3389/fpsyg.2018.02132/full [full: through the Results; the last part of the page was not read]
- Fernandes, A. S., & Feiner, S. K. (2016). Combating VR sickness through subtle dynamic field-of-view modification. *IEEE 3DUI 2016*. https://doi.org/10.1109/3DUI.2016.7460053 [secondary: Ackerman 2016; Cao, Grandi & Kopper 2021; the ScienceDaily release read in 1.1]
- He, Q., & McNamara, T. P. (2018b). Spatial updating strategy affects the reference frame in path integration. *Psychonomic Bulletin & Review, 25*, 1073–1079. https://link.springer.com/content/pdf/10.3758/s13423-017-1307-7.pdf [full]
- Keshavarz, B., Riecke, B. E., Hettinger, L. J., & Campos, J. L. (2015). Vection and visually induced motion sickness: how are they related? *Frontiers in Psychology, 6*, 472. https://www.frontiersin.org/articles/10.3389/fpsyg.2015.00472/full [full: main text; the page's last part (references) not read]
- Klatzky, R. L., Loomis, J. M., Beall, A. C., Chance, S. S., & Golledge, R. G. (1998). Spatial updating of self-position and orientation during real, imagined, and virtual locomotion. *Psychological Science, 9*, 293–298. https://doi.org/10.1111/1467-9280.00058 (abstract at https://www.psychologicalscience.org/journals/psychological-science/1467-9280.00058/) [abstract; secondary: Avraamides & Ioannidou 2005]
- Lakshminarasimhan, K. J., Petsalis, M., Park, H., DeAngelis, G. C., Pitkow, X., & Angelaki, D. E. (2018). A dynamic Bayesian observer model reveals origins of bias in visual path integration. *Neuron, 99*, 194–206. STAR Methods read through https://www.ncbi.nlm.nih.gov/research/bionlp/RESTful/pmcoa.cgi/BioC_json/PMC6190923/unicode (PMC6190923); results through the preprint https://www.biorxiv.org/content/10.1101/191817.full.pdf [full]
- Loomis, J. M., Klatzky, R. L., Golledge, R. G., Cicinelli, J. G., Pellegrino, J. W., & Fry, P. A. (1993). Nonvisual navigation by blind and sighted. *Journal of Experimental Psychology: General, 122*, 73–91. A full copy exists at https://core.ac.uk/download/281646739.pdf. Opened by chance and only identified; not used here.
- McLaren-Gradinaru, M., et al. (2020). A novel training program to improve human spatial orientation: preliminary findings. *Frontiers in Human Neuroscience, 14*, 5. https://www.frontiersin.org/articles/10.3389/fnhum.2020.00005/full [full: body]
- Nooij, S. A. E., et al. (2017). Vection is the main contributor to motion sickness induced by visual yaw rotation: Implications for conflict and eye movement theories. *PLoS ONE, 12*(4), e0175305. https://journals.plos.org/plosone/article?id=10.1371/journal.pone.0175305 [full: body; Table 1 not in the page text]
- Saredakis, D., et al. (2020). Factors associated with virtual reality sickness in head-mounted displays: a systematic review and meta-analysis. *Frontiers in Human Neuroscience, 14*, 96. https://www.frontiersin.org/articles/10.3389/fnhum.2020.00096/full [full: about 90 % of the page, through the results tables; the end of the Discussion not read]
- So, R. H. Y., Lo, W. T., & Ho, A. T. K. (2001). Effects of navigation speed on motion sickness caused by an immersive virtual environment. *Human Factors, 43*(3), 452–461. https://www.ieda.ust.hk/dfaculty/so/pdf/So-et-al-2001a-HumanFactors.pdf [full; re-read]
- Stangl, M., Kanitscheider, I., Riemer, M., Fiete, I., & Wolbers, T. (2020). Sources of path integration error in young and aging humans. *Nature Communications, 11*, 2626. Read through https://www.ncbi.nlm.nih.gov/research/bionlp/RESTful/pmcoa.cgi/BioC_json/PMC7250899/unicode [full: Results and Methods]
- Stavropoulos, A., Lakshminarasimhan, K. J., Laurens, J., Pitkow, X., & Angelaki, D. E. (2022). Influence of sensory modality and control dynamics on human path integration. *eLife, 11*, e63405. https://pmc.ncbi.nlm.nih.gov/articles/PMC8856658 [full: Results, Methods, appendix tables; Discussion in part]
- The effect of visual field occlusion on visually induced motion sickness (2024). *bioRxiv*. https://www.biorxiv.org/content/10.1101/2024.12.26.630441 [full: preprint text; authors not captured by the fetch]
- Wiener, J. M., Berthoz, A., & Wolbers, T. (2011). Dissociable cognitive mechanisms underlying human path integration. *Experimental Brain Research, 208*, 61–71. https://doi.org/10.1007/s00221-010-2460-7 (abstract at https://www.pubmed.gov/20972774/) [abstract; secondary: He & McNamara 2018b]
- Wiener, J. M., & Mallot, H. A. (2006). Path complexity does not impair visual path integration. *Spatial Cognition and Computation, 6*, 333–346. https://doi.org/10.1207/s15427633scc0604_3 (abstract at https://staffprofiles.bournemouth.ac.uk/display/journal-article/13752) [abstract]

### Known only through the two reviews above
These were not opened; each is the reviewer's report.
- **Through Keshavarz et al. 2015:**
  - Bonato et al. 2008 (vection change and sickness);
  - Bonato et al. 2009 and Keshavarz & Hecht 2011a (multi-axis rotation);
  - Prothero et al. 1999 (stable grid);
  - Flanagan et al. 2002, 2004 and Webb & Griffin 2002 (fixation);
  - Hu et al. 1989 (drum speed);
  - Webb & Griffin 2003 (flow density).
- **Through Dużmańska et al. 2018:**
  - Min et al. 2004, Feenstra et al. 2011 and Lo & So 2001 (time course);
  - Cobb et al. 1999, Kennedy et al. 2000, Newman et al. 2013 and Reinhard et al. 2017 (repeated exposure; first exposure);
  - the after-effect studies.

### From R1 (not re-read in this pass)
Akan et al. 2026 [full]; Chrastil et al. 2017 [full]; Du, Mou & Zhang 2020 [abstract]; Harootonian et al. 2020 [full]; Kelly et al. 2020 [full]; Klatzky et al. 1999 [full]; Lappe, Jenkin & Harris 2007 [abstract and appendix]; Lövdén et al. 2012 [full]; McLaren et al. 2022 [full]; Noel et al. 2020 [full]; Petzschner & Glasauer 2011 [full]; Riecke, van Veen & Bülthoff 2002 [full]; Riecke & Wiener 2007 [full]; Scherer et al. 2024 [full]; Xu et al. 2024 [full]. Full citations and links are in R1's References.

### Parallax files read
js/ex/reckon/gen.js, learn.js, view.js; js/ex/homing/gen.js (route model, constants), view.js (kit, fade, stage); js/ui/play.js (motion notice); js/core/store.js (reducedMotion setting); js/engine/estimator.js (binary likelihood); docs/research/v1.1/R1-path-integration.md; docs/research/v1.1/ACCESS.md; docs/dev/v1.2/deferred-sweep.md; docs/dev/reviews/RV-reckon-homing.md; docs/dev/DECISIONS.md; docs/dev/progress/B3.md; docs/dev/PLAN-v1.2.md; docs/guide/guide.html (the Reckon evidence rows).

### Simulation scripts
- **Where they ran:** a scratch folder outside the repository, with Node, loading the repository's pure files through tests/node/run.mjs `createContext`. Not committed.
- **Seeds:** fixed (mulberry32 for the candidate generator; `PX.rng.hash('n1-base', route, tol, seed)` for the baseline).
- **To reproduce:**
  - the baseline: 300 point items per cell from `def.generate`;
  - the candidate: turns first, 600 leg samples per turn draw, K keys more than 2·tol + 8° apart, 200–300 items per cell.

## Could not open

| Source | What happened | What I needed | Assumption used meanwhile |
|---|---|---|---|
| Klatzky et al. 1998, full text (https://doi.org/10.1111/1467-9280.00058) | Publisher page: abstract only. The UCSB papers folder that holds Klatzky 1999 refused robots (pgs-dev.geog.ucsb.edu). No other copy found before the search budget ran out | Display and field of view of the optic-flow condition; whether the visual-turn failure was complete or partial; error against turn angle | Overturning by about the turn's size with body-turn responses (abstract, Avraamides 2005). Smaller with responses that are not body turns (Avraamides 2004). Reckon keeps the check either way (2.1) |
| Wiener & Mallot 2006 (https://doi.org/10.1207/s15427633scc0604_3) | bohrium.com: firewall page; staff profile: abstract only | Segment counts, path lengths, pointing errors and response times | Segment count alone adds no difficulty at fixed length and turning (abstract) |
| Wiener, Berthoz & Wolbers 2011 (https://doi.org/10.1007/s00221-010-2460-7) | link.springer.com (article and PDF): blocked for this session; Edinburgh portal: no PDF | Set-up (real or virtual walking), leg lengths, turn angles, error sizes per strategy and path length | Configural more accurate on the 15.3 m path, continuous faster (abstract; He & McNamara 2018b) |
| Fernandes & Feiner 2016 (https://doi.org/10.1109/3DUI.2016.7460053) | Semantic Scholar: closed access; IEEE Xplore: no text without scripts | Restriction amounts and timing, effect sizes, any spatial-performance test | It helps in HMDs; it does not carry over to phone-sized views (2.6) |
| Cao, Jerald & Kopper 2018 (https://doi.org/10.1109/VR.2018.8446210) | No copy found before the search budget ran out | Rest-frame designs and effect sizes | Rest frames help in HMDs; fixation evidence used instead (2.7, 5) |
| Ishikawa & Zhou 2020, training cognitive mapping for people with a poor sense of direction (*Cognitive Research: Principles and Implications*; https://cognitiveresearchjournal.springeropen.com/articles/10.1186/s41235-020-00238-1) | Blocked for this session. Title from memory, content unverified | Design, control group, transfer tests and effects: a candidate for Q1 | None; not cited as evidence |
| Tcheang, Bülthoff & Burgess 2011, visual influence on path integration in darkness (*PNAS*; https://www.pnas.org/doi/10.1073/pnas.1011843108) | Site error. Title from memory, content unverified | Whether a visual rotation gain learned in VR shifted blind triangle completion, and by how much: visual training carrying over to walking | None; Du et al. 2020 (R1) used instead |
| Bakker, Werkhoven & Passenier 2001, "Calibrating visual path integration in VEs" (*Presence*, 10) | Not searched (budget). Title from memory, unverified | Whether feedback training of visual turn estimates improved them and carried over: a candidate for Q1 | None |
| Kober et al. 2013, VR navigation training after stroke (*Journal of NeuroEngineering and Rehabilitation*) | Not tried (budget). From memory, unverified | Design and transfer tests: a candidate for Q1 | None |
| Field-of-view and display-size studies: Teixeira & Palmisano 2021; Adhanom et al. 2021; Al Zayer et al. 2019; Bos et al. 2010; Lin et al. 2002; Sharples et al. 2008; Stoffregen, Chen & Koslucher 2014 (sickness with mobile devices) | Not searched (budget). Bos 2010 was also blocked in 1.1 | Field-of-view restriction and spatial performance; sickness on desktop and handheld screens | Smaller displays give weaker vection (Keshavarz 2015); none of 5's proposals rests on these |
| Europe PMC full text (www.ebi.ac.uk REST) | curl: refused by the session proxy (403). Fetch: rate-limited twice | Lakshminarasimhan 2018 Methods | Read instead through the PMC BioC service |
| elifesciences.org/articles/63405; pmc.ncbi.nlm.nih.gov/articles/PMC6190923; doi.org redirects | Browser check; reCAPTCHA; redirect blocked | Stavropoulos and Lakshminarasimhan full texts | Read through PMC8856658 and the BioC service |
| MDN DeviceOrientationEvent.requestPermission; W3C WCAG 2.3.3 Understanding page | Permission request not answered (provenance) | iOS permission and secure-context rules for the gyroscope (O44); the reduced-motion guidance | General knowledge, unverified; nothing here depends on it |
| Web search | The 200-search budget, shared by all agents in this turn, ran out after this agent's 17th search | The Q1 search; the leads above; desktop and phone sickness studies | Stated wherever it matters (1, 5.3, 7) |
