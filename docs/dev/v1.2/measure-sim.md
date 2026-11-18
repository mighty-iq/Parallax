# Measurement simulation for PLAN milestones 6 and 4 (W2-measure)

Written 2026-11-18 (UTC) by the W2-measure builder, before anything of milestone 6 is built. Sources: docs/dev/PLAN.md (decisions 2 and 3, milestones 4 and 6), note M1 (docs/research/v1.2/M1-measurement.md §4.1, §4.4, §5, §7, §8 and its Addendum), note T1 §5.1–5.4, the M1 spike (docs/research/v1.2/spikes/M1/power.mjs). Code: js/engine/trend.js (the trend model), tests/node/trend.test.mjs (its unit tests), tests/node/measure-sim.mjs with measure-lib.mjs and measure-cross.mjs (the simulation, run by hand). Every number below comes from a run listed in §11, with 1,000 simulated learners per arm and seed 1 unless a table says otherwise.

## 0. In short

| PLAN milestone 6 acceptance line | Chosen design (N14, central values) | Result |
|---|---|---|
| False "likely gain" ≤ 5 % at each report | 1.9 / 3.2 / 3.2 % at days 14 / 28 / 56 | pass |
| ≤ 6 % ever through week 8 | 5.9 % (seeds 2 and 3: 5.5 %, 5.3 %) | pass, with 0.1–0.7 point to spare |
| ≤ 10 % under misspecified familiarity (plateau 0.8, or a tail twice the prior) | plateau 0.8: 1.8 / 6.4 / 6.6 %; tail 0.06: 1.4 / 4.0 / 4.6 %; tail 0.09: 1.2 / 5.3 / 6.2 % | pass (composite) |
| Interval coverage 92–98 % | 93.6–95.3 % (composite, both arms, weeks 4 and 8); seed 3: 93.3–95.0 %; seed 2: one cell at 91.8 % (gain arm, week 8) | pass on seeds 1 and 3; 0.2 point under in one cell of seed 2 (§9) |
| Detectable gain, composite, weeks 4 and 8 | 1.64 / 1.27 SD_comp central; 1.26 / 0.97 optimistic | reported (no threshold) |
| Share reading "likely gain" for a 0.5 SD_comp gain | 8.8 % at week 4, 12.5 % at week 8 (17.0 % at some milestone) central, 8.8 % and 10.3 % over seeds 1–3; 12.4 % / 15.9 % optimistic | reported |
| Near rung, detectable gain at weeks 4 and 6 | 1.53 / 1.27 per-probe SD central; 1.23 / 1.03 optimistic | reported: a 1 SD near gain is read by 26 % at week 4 and 35 % at week 8 (seeds 1–3) |
| What rotation costs the composite | nothing at equal block length (1.55 rotating against 1.55 with every probe in every block, both 3.5–3.75 min); about 5 % against 5-minute blocks that hold every probe at 3 items (1.48; analytic 4 %) | reported |

| PLAN milestone 4 acceptance line | Result |
|---|---|
| The crossover's power, simulated with milestone 6's design | comparison rounds or bridge sets (six strand units): 80 % power for a strand effect of 0.29 SD with 200 players completing both periods, 0.21 SD with 400; draw-the-answer variants (three units): 0.40 / 0.28 SD; detailed calibration feedback (one strand): 0.59 / 0.41 SD (§8) |
| The assignment stays balanced | each strand unit on in period 1 for 49.8–50.1 % of 99,844 draws; halves within a player differ by at most one unit; every 6-item near block reads every strand once; no effect: mean contrast within one SE of zero on every layer (§8) |

What does not hold, and the levers (details in §9):
- **Verdict words on the rungs.** With words on the composite and the near rung, false "likely gain" reaches 7.0 % at week 4 and 11.8 % at some milestone through week 8; with the near rung at a 0.975 bar, 5.0 % and 9.8 %. Recommended: verdict words for the composite only; each rung as a meter with its range.
- **The near rung under a larger familiarity tail.** It carries the most items, so a tail larger than the prior reads as gain there first: 12.5 % false "likely gain" at week 8 with a tail of 0.09, 32.7 % with 0.15. The composite stays at 6.2 % and 8.9 %. A wider prior on the tail is the lever tested in §7.
- **The opt-in week with the classic probes** misses coverage by 0.2 points (91.8 %, gain arm, week 8): the cautious priors' deliberate bias. Not the chosen design; N14 with the week passes (93.2–95.7 %).
- **The size of change one person can show** is larger than the analytic numbers on the decision board, which were for ideal items (decision 2: 1.09–1.43 SD at week 4, 0.77–1.01 at week 8, optimistic to central). With simulated items the classic four-probe design gives 1.16–1.55 and 0.89–1.18 (6–8 % larger at week 4, 16–17 % at week 8), the chosen ladder 1.26–1.64 and 0.97–1.27 (15–16 % and 26 %), because the same minutes now cover six probes and a bigger near baseline. The owner should hear the item-level numbers.

## 1. What was built: js/engine/trend.js

A pure engine file (classic script on `PX.engine.trend`, no clock, storage or randomness) with every parameter in one exported config (`E.trend.config`, `E.trend.DEFAULTS`, `E.trend.configure(patch | 'reset')`).

**The model** (note M1 §4 with the Addendum). For probe p at occasion j (baseline, embedded block, 4-weekly check or measurement-week session):

    y_pj = α_p + σ_p·(F_p·φ̄_pj + T·n̄_pj + G_r(p)·h_j) + σ_p·(u_j + s_pj) + e_pj      spatial probes
    y_cj = α_c + σ_c·(F_c·φ̄_cj + T_c·n̄_cj)             + σ_c·(u_j + s_cj) + e_cj      the control (Word Links)

α: the probe's level; φ̄: the mean over the block's items of 1 − exp(−n/16), n that probe's items answered before (familiarity counted in items); F: its amplitude; n̄: items before / 16, with the slow tails T (spatial, shared) and T_c; G_r: the gain of rung r (near, mid, far, and Level's own); h_j: the training-gain curve at the occasion, so the gain to date is D = G·h(now); u: the occasion's shared state, s: the probe's own; σ_p: the between-person SD of the probe in logits, so F, T, G and the state are in SD units.

**The fit.** Linear and Gaussian once each block is: generalised least squares over all occasions, the occasion's state integrated out by Sherman–Morrison, which is the same answer as a Kalman smoother. Blocks come as items `[b, g, ok, rtMs?, a?]` (the rows the wave-2 contract stores in `rec.assess`; the response time is ignored by this model and the slope a defaults to 1, as in the engine) under the item model P = g + (1 − g − 0.03)·σ(a(θ − b)), or as summaries `{ y, v, n }`. Items are linearised at the block's fitted ability (the fixed part plus the predicted state) and the fit iterates to the joint posterior mode with step halving on the joint log posterior (penalised quasi-likelihood; the Laplace approximation at the mode). Tests: the fit equals a dense joint-Gaussian solve to 1e-14; fitting occasion by occasion equals fitting the record at once; any start reaches the same mode; a block on the guessing floor cannot derail it.

**The readouts.** For the composite and each rung: the gain to date D (mean, SD, a 90 % range), in SD units of that readout and in probe points (logits); the meter P(D > 0); P(D < 0.2 SD) for "likely no change". The composite is the equally weighted mean of the spatial probes of the near, mid and far rungs (DECISIONS); Level is a readout alone, outside it.

**Milestones and words.** Days 14 and 28 after the first occasion, then every 28 days; computed once, at the first occasion on or after the milestone and after the run-in: "likely gain" at P(D > 0) ≥ 0.975 at day 14 and ≥ 0.95 later; "likely no change" from day 56 at P(D < 0.2 SD_comp) ≥ 0.90; otherwise "unclear yet". Between milestones the meter moves with every block.

**Breaks.** A gap of more than 56 days between occasions starts a new segment: familiarity keeps 55 % of what it had (fast curve and tail alike; Terlecki et al., note M1 Addendum A.1) and verdict words wait until the segment has three occasions (the schedule makes the first two baseline-sized).

**Config, as shipped** (each value's source in note M1 §4.4 and A.3–A.5, or in this note):

| Key | Value | Meaning |
|---|---|---|
| `sd.logits`, `sd.byProbe` | 1.15 | between-person SD of a probe (16-item reliability 0.75); per-probe values once pooled baselines give them |
| `rho` | 0.4 | correlation of true ability between probes (the composite's SD) |
| `probes` | otherway near; cubematch, viewmatch, patterns mid; mechanisms, motiongraphs far; level alone; wordlinks control | rungs (the ids of the two new probes are provisional) |
| `composite` | rungs near, mid, far; weights per probe | |
| `state` | total 0.5 SD, half of its variance shared by the occasion | Sliwinski et al. 2018 (Addendum A.2) |
| `fam` | plateau 0.65 SD (between-person SD 0.2), λ 16 items, correlation 0.5 among spatial probes, control 0.3, 0.3 with the control | the cautious middle prior of note M1 §5.3 |
| `tail` | spatial 0.045, control 0.027 SD per 16 items, SD 0.02, correlation 0.3 | Addendum A.4–A.5 |
| `gain.priorSd` | 5 (per-probe SD) | a weak prior on each rung's gain; flat lets a one-probe rung run off (DECISIONS) |
| `fit.alphaSd` | 3 (SD) | a weak prior on each probe's level around its centre (`opts.center`) |
| `breakDays`, `breakLoss`, `runIn` | 56, 0.45, 3 occasions | |
| `milestones`, `bars`, `bar` | days 14, 28, then every 28; 0.975 at day 14; 0.95 | |
| `none` | margin 0.2 SD, P ≥ 0.90, from day 56 | "likely no change" |

API: `fit(input, opts)`, `track(input, opts)` (a fit after every occasion and the words at each milestone), `predict(fit, probe, h, t)` (the next block's expected ability, for item targeting), `milestoneAt(day)`, `verdict(fit, milestone, readout)`, `familiarity`, `afterBreak`. Input: `{ occasions: [{ t, h, blocks: [{ probe, items: [[b, g, ok, rtMs?, a?], …] } | { probe, n, y, v }] }] }`.

## 2. The simulation: settings

**Truth** (tests/node/measure-lib.mjs; note M1 §8.1 with Addendum A.5). Per learner and probe: θ0 = σ(√ρ·z_general + √(1 − ρ)·z_probe) with σ = 1.149 logits (a 16-item probe 0.75 reliable; 1.579 for 0.85 in the optimistic set; 0.73 and ρ 0.33 for today's fixture population) and ρ = 0.4; the control independent. Familiarity F = σ(0.5 + 0.2z), correlated 0.5 among spatial probes and 0.3 with the control (plateau 0.3), λ = 16 items; a slow tail T = σ·N(0.03, 0.02²) per 16 items shared by the spatial probes, the control's mean 0.018, correlated 0.3. State: shared and probe-specific, each N(0, (0.354σ)²), 0.5 SD in all. After a gap of more than 56 days, familiarity keeps 1 − 0.45 of what it had.

**Items.** Each item aims at g + (1 − g)·0.6 under the block's grid posterior, whose prior is N(the trend model's prediction for the probe, 1.5²), kept within ±3 population SD as the app's item pool keeps it; a probe's first two items ever at 0.85; the true difficulty is off the model's by N(0, 0.3²); 15 s per item. Guessing: Other Way Round 0.25, Cube Match 0.5, View Match 0.25, Pattern Memory 0.01, Mechanisms 0.4, Motion Graphs 0.25, Level 0.25, Word Links 0.25. The optimistic set has the probe upgrades of PLAN milestone 6 (Cube Match and Mechanisms with 4 options, Pattern Memory scored by cells: twice the information) and response times (×1.15 information on every spatial probe), with σ = 1.579.

**Gains.** Arm 'none': no real gain. Arm 'gain': 0.5 SD_comp on every spatial probe at day 28. Arm 'ladder': near 1.0, mid 0.5, far 0.2 per-probe SD (Level 0.2). The path is the learner's own training curve, 1 − exp(−s/τ) over the training sessions s before the occasion, τ ~ U(6, 24) sessions, normalised to 1 at day 28 and held from then on (decision 2's convention: the gain reaches its size at day 28 and then holds); the trend model is given the same curve as h (one scenario gives it a straight line in days instead).

**Design A's schedule** (training on Monday, Wednesday and Friday from day 0, 18:00). Session 1: baseline B1 right after the tutorial (decision 3; h = 0). Session 2: B2. Every later session: a no-feedback block at its start, at most four a week. Days 28 and 56: the check replaces that session's block. After a gap of more than 56 days the first two sessions hold baseline-sized blocks again. The opt-in measurement week: four sessions on days 25–28 and 53–56 (the training sessions in them get no separate block; the fourth stands for the check).

| Design | Every later session's block | Baselines B1, B2 and each 4-weekly check | Measurement week (opt-in) |
|---|---|---|---|
| classic (decision 2) | the four probes of 1.1 × 3, Word Links 2: 14 items, 3.5 min | 8 per probe, Word Links 8: 40 items, 10 min | 8 per probe, Word Links 4 (9 min a session) |
| L15 | near 4; two of the three mid probes × 3; one of the two far × 3; Word Links 2: 15 items | 6 per probe, Word Links 6: 42 items, 10.5 min | – |
| L14all / L20all | every probe × 2 / × 3, Word Links 2: 14 items / 20 items (5 min) | as L15 | – |
| N16 | near 6; two mid × 3; one far × 2; Word Links 2: 16 items, 4 min | near 16, others 6, Word Links 6: 52 items, 13 min | – |
| **N14 (chosen)** | **near 6; two mid × 2; one far × 2; Word Links 2: 14 items, 3.5 min** | **near 16, others 5, Word Links 5: 46 items, 11.5 min** | near 6, two mid × 6, one far × 6, Word Links 4 (7 min a session) |

Rotation: block number i takes k of a rung's n probes, starting at i·k mod n. Near = Other Way Round; mid = Cube Match, View Match, Pattern Memory; far = Mechanisms, Motion Graphs.

**Reports** at weeks 2, 4, 6 and 8 (days 14, 28, 42, 56); words at the milestones (days 14, 28, 56). Detectable gain (MDG) = 1.898 × the median posterior SD of the gain to date at the report (note M1 §8.3: the gain that 60 % would read as "likely gain" at P ≥ 0.95), in SD_comp for the composite and per-probe SD for a rung. Coverage: the share of learners whose 95 % interval holds the true gain to date. z = (estimate − truth)/SD.

## 3. Cross-check with the M1 spike (note M1 §8.6, Addendum A.5)

Run spike-check: the classic design with the spike's own conventions (each block summarised by its likelihood under a weak N(running mean, 3²) prior, items aimed at that running mean, a gain linear in days to day 28), judged by js/engine/trend.js with the shipped priors (plateau 0.65, tail 0.045).

| | This simulation | The spike (note M1 A.4–A.5) |
|---|---|---|
| Detectable gain, week 4 / week 8 (item-level, SD_comp) | 1.68 / 1.19 | 1.73 / 1.21 |
| "Likely gain", 0.5 SD_comp gain, week 4 / week 8 | 6.9 % / 11.2 % | 9.3 % / 13.3 % |
| False "likely gain", week 4 / week 8 (ever) | 2.7 % / 2.1 % (4.4 %) | 3.2 % / 2.3 % (5.2 %) |

The two agree within about 3 % on the detectable gain and within 2.4 points on the shares (a 1,000-learner share has a binomial SE of about 0.9 points), so the trend model and the learner model reproduce the spike. Coverage in this run: 95.7–96.5 %.

## 4. The classic four-probe composite (decision 2's design) with the item-level fit

| Run | Block (min) | Minutes a week without the two baselines | False "likely gain", composite, days 14 / 28 / 56 (ever) | Coverage, composite, no gain / gain, days 28 and 56 | Detectable gain, composite, weeks 4 / 8 (SD_comp) | "Likely gain" for a 0.5 SD_comp gain, weeks 4 / 8 (ever) |
|---|---|---|---|---|---|---|
| spike-check | 3.50 | 11.7 (baselines 10.0 each) | 0.6 / 2.7 / 2.1 (4.4) | 96.5 / 96.3; 96.1 / 95.7 | 1.68 / 1.19 | 6.9 / 11.2 (14.6) |
| classic | 3.50 | 11.7 (baselines 10.0 each) | 1.4 / 3.1 / 2.9 (5.5) | 93.6 / 94.3; 93.6 / 93.9 | 1.55 / 1.18 | 11.4 / 13.8 (19.3) |
| classic-week | 3.50 | 17.3 (baselines 10.0 each) | 1.7 / 2.3 / 2.3 (4.9) | 93.5 / 93.8; 92.9 / **91.8** | 1.33 / 1.14 | 9.1 / 9.8 (14.2) |
| classic-opt | 3.50 | 11.7 (baselines 10.0 each) | 2.1 / 2.4 / 1.7 (5.0) | 94.0 / 94.4; 93.6 / 92.3 | 1.16 / 0.89 | 13.3 / 16.8 (22.9) |

Linearising the items instead of summarising each block (§1) detects an 8 % smaller gain at week 4 (1.55 against 1.68 on the same design) with false rates inside the acceptance. Under misspecified familiarity the classic design reads false "likely gain" 3.9 / 6.0 / 6.7 % (plateau 0.8; ever 11.9 %) and 1.8 / 3.2 / 3.6 % (tail 0.06; ever 6.8 %).

## 5. The ladder: block mixes, and what rotation costs

**Analytic scan** (`node tests/node/measure-sim.mjs --scan --levers`: the posterior SD with ideal items, which in this linear-Gaussian model does not depend on the answers; one learner shape with τ = 12 sessions). Selected rows, central (optimistic in brackets):

| Mix | Block items | Minutes to week 4 / 8 | Composite, weeks 4 / 8 | Near, weeks 4 / 6 / 8 | Mid, weeks 4 / 8 | Far, weeks 4 / 8 |
|---|---|---|---|---|---|---|
| classic | 14 | 65 / 114 | 1.47 / 1.12 (1.11 / 0.85) | – | – | – |
| near 3, mid 2 × 3, far 1 × 3 | 14 | 67 / 116 | 1.47 / 1.13 | 1.98 / 1.64 / 1.50 | 1.70 / 1.30 | 2.02 / 1.56 |
| L15: near 4, mid 2 × 3, far 1 × 3 | 15 | 69 / 121 | 1.46 / 1.12 | 1.91 / 1.56 / 1.44 | 1.70 / 1.30 | 2.02 / 1.56 |
| near 8, mid 2 × 3, far 1 × 2 | 18 | 77 / 137 | 1.46 / 1.13 | 1.72 / 1.38 / 1.29 | 1.70 / 1.30 | 2.10 / 1.63 |
| L14all: every probe × 2 | 14 | 67 / 116 | 1.45 / 1.12 | 2.08 / 1.75 / 1.60 | 1.68 / 1.29 | 1.96 / 1.50 |
| L20all: every probe × 3 (5 min) | 20 | 82 / 147 | 1.40 / 1.07 | 1.98 / 1.64 / 1.50 | 1.61 / 1.22 | 1.87 / 1.41 |
| L15 with 8-item baselines | 15 | 80 / 135 | 1.38 / 1.07 | 1.78 / 1.47 / 1.35 | 1.59 / 1.22 | 1.87 / 1.45 |
| L15, near baselines 16 | 15 | 77 / 131 | 1.44 / 1.11 | 1.52 / 1.29 / 1.18 | 1.70 / 1.30 | 2.02 / 1.56 |
| N16 | 16 | 79 / 136 | 1.45 / 1.12 (1.14 / 0.88) | 1.46 / 1.22 / 1.13 (1.18 / 0.99) | 1.70 / 1.30 | 2.09 / 1.63 |
| **N14** | 14 | 70 / 120 | 1.53 / 1.18 (1.18 / 0.91) | 1.46 / 1.22 / 1.14 (1.18 / 0.99) | 1.84 / 1.41 | 2.21 / 1.71 |
| two near probes (the strands split), 4 + 4 per block | 19 | 84 / 148 | 1.39 / 1.07 | 1.70 / 1.39 / 1.28 | 1.70 / 1.30 | 2.02 / 1.56 |
| L15 with occasion state 0.35 (truth and model) | 15 | 69 / 121 | 1.33 / 1.03 | 1.83 / 1.50 / 1.38 | 1.58 / 1.21 | 1.93 / 1.49 |
| L15 with 16-item reliability 0.85 | 15 | 69 / 121 | 1.24 / 0.95 | 1.52 / 1.24 / 1.15 | 1.40 / 1.07 | 1.62 / 1.25 |

Reading:
- **The composite barely depends on the mix.** Across the 84 mixes of 14–18 items in the scan (near 3–8 items; two or three mid probes at 2–4; one or two far probes at 2–4; the full list prints with `--scan`), its detectable gain stays within 1.42–1.51 at week 4 and 1.09–1.17 at week 8. More items per occasion do not average out the occasion's state, which together with the tail sets the floor (note M1 Addendum A.4).
- **Rotation costs nothing at the same length**: 1.46 (rotating, 15 items) against 1.45 (every probe in every block, 14 items); 4 % against blocks of 5 minutes that hold every probe at 3 items (1.40).
- **The near rung's bottleneck is its baseline.** Doubling its items per block (4 → 8) takes its week-4 figure from 1.91 to 1.72; 16 near items in B1, B2 and the checks take it to 1.52 at no cost to the composite; both together (N16, N14) to 1.46. Splitting Other Way Round into two near probes adds nothing beyond its items.

**Item-level** (1,000 learners per arm; the near-rung and ladder columns from the arm with near 1.0, mid 0.5, far 0.2 SD):

| Run | Composite, weeks 4 / 8 | False "likely gain", composite, days 14 / 28 / 56 (ever) | Near, weeks 4 / 6 / 8 | Mid, weeks 4 / 8 | Far, weeks 4 / 8 | Ladder arm: "likely gain" on the near rung, weeks 4 / 8 (ever) |
|---|---|---|---|---|---|---|
| L15 | 1.55 / 1.19 | 0.6 / 1.9 / 2.5 (4.1) | 2.04 / 1.67 / 1.53 | 1.81 / 1.38 | 2.20 / 1.70 | 17.8 / 21.7 (28.7) |
| L14all | 1.55 / 1.18 | 0.9 / 2.5 / 1.2 (3.8) | 2.24 / 1.88 / 1.71 | 1.79 / 1.37 | 2.13 / 1.62 | 17.1 / 24.0 (29.2) |
| L20all (5 min) | 1.48 / 1.13 | 0.6 / 2.2 / 1.9 (3.8) | 2.13 / 1.75 / 1.61 | 1.71 / 1.30 | 2.02 / 1.53 | 17.2 / 25.3 (30.0) |
| N16 (4 min) | 1.54 / 1.19 | 0.9 / 2.8 / 2.7 (5.0) | 1.53 / 1.27 / 1.18 | 1.82 / 1.38 | 2.28 / 1.78 | 28.4 / 38.1 (45.7) |
| **N14** | **1.64 / 1.27** | **1.9 / 3.2 / 3.2 (5.9)** | **1.53 / 1.27 / 1.18** | **2.00 / 1.53** | **2.44 / 1.89** | **26.1 / 36.1 (41.0)** |

The choice (DECISIONS): N14 keeps the owner's time (about 12 minutes a week without the baselines, §6) and takes the near rung's detectable gain at weeks 4 and 6 from 2.04 / 1.67 (L15) to 1.53 / 1.27, at 6 % on the composite (1.64 against 1.55). N16 keeps both for about 1.7 minutes a week more (4-minute blocks, 13-minute baselines and checks).

## 6. The chosen mix (N14) against the acceptance

| Run | Block (min) | Minutes a week without the two baselines | False "likely gain", composite, days 14 / 28 / 56 (ever) | Coverage, composite, no gain / gain, days 28 and 56 | Detectable gain, composite, weeks 4 / 8 (SD_comp) | "Likely gain" for a 0.5 SD_comp gain, weeks 4 / 8 (ever) |
|---|---|---|---|---|---|---|
| **N14** (central) | 3.50 | 12.1 (baselines 11.5 each) | 1.9 / 3.2 / 3.2 (5.9) | 93.6 / 95.3; 94.1 / 94.2 | 1.64 / 1.27 | 8.8 / 12.5 (17.0) |
| N14-opt | 3.50 | 12.1 | 1.2 / 2.4 / 1.9 (4.1) | 93.0 / 93.4; 93.0 / 92.3 | 1.26 / 0.97 | 12.4 / 15.9 (20.0) |
| N14-week (opt-in week) | 3.50 | 15.3 | 1.0 / 3.0 / 2.4 (5.2) | 94.0 / 95.7; 93.2 / 95.2 | 1.43 / 1.21 | 12.1 / 12.6 (17.6) |
| N14-perWeek2 | 3.50 | 8.6 | 0.4 / 3.4 / 3.3 (5.4) | 95.1 / 94.2; 94.6 / 93.5 | 1.79 / 1.38 | 8.5 / 9.7 (14.0) |
| N14-perWeek6 (blocks capped at four a week) | 3.50 | 16.9 | 1.5 / 3.8 / 2.7 (5.8) | 94.2 / 93.5; 93.0 / 92.6 | 1.49 / 1.15 | 9.4 / 9.9 (15.0) |
| N14-hLinear (the model's h a straight line in days) | 3.50 | 12.1 | 0.7 / 2.3 / 3.0 (4.8) | 95.6 / 93.7; 93.0 / 94.5 | 1.66 / 1.20 | 10.4 / 11.7 (16.8) |
| N14-fixturePop (today's fixture population) | 3.50 | 12.1 | 0.4 / 2.4 / 2.7 (3.9) | 95.3 / 95.3; 94.4 / 95.9 | 2.31 / 1.78 | 5.2 / 6.9 (10.1) |

**Seeds 2 and 3** (the N14 run again, 1,000 learners per arm each): false "likely gain" 1.0 / 3.1 / 2.6 % (ever 5.5 %) and 1.1 / 3.8 / 2.5 % (ever 5.3 %); coverage 91.8–94.7 % and 93.3–95.0 % (the 91.8 % is the gain arm at week 8 with seed 2); detectable gains as seed 1 (1.64 / 1.27; near 1.53 / 1.27); "likely gain" for a 0.5 SD_comp gain 8.7 / 8.9 % and 8.8 / 9.4 % at weeks 4 / 8; a 1 SD near gain 26.2 / 35.4 % and 25.7 / 33.1 %. Over the three seeds: "ever" 5.6 %, a 0.5 SD_comp gain read at week 4 by 8.8 % and at week 8 by 10.3 %, a 1 SD near gain by 26.0 % and 34.9 %.

The rungs (N14; the ladder arm has near 1.0, mid 0.5 and far 0.2 per-probe SD, a composite gain of 0.68 SD_comp):

| Run | Near: detectable gain weeks 4 / 6 / 8 (per-probe SD) | Mid: weeks 4 / 8 | Far: weeks 4 / 8 | Ladder arm: "likely gain", near, weeks 4 / 8 (ever) | Ladder arm: composite, weeks 4 / 8 | False "likely gain", near rung, days 14 / 28 / 56 (ever) | Any of the four readouts, days 14 / 28 / 56 |
|---|---|---|---|---|---|---|---|
| N14 | 1.53 / 1.27 / 1.18 | 2.00 / 1.53 | 2.44 / 1.89 | 26.1 / 36.1 (41.0) | 13.7 / 19.0 | 2.2 / 4.1 / 2.1 (6.7) | 5.4 / 12.2 / 10.1 |
| N14-week | 1.46 / 1.25 / 1.16 | 1.70 / 1.45 | 2.15 / 1.79 | 28.7 / 35.5 (42.5) | 16.3 / 18.9 | 2.0 / 3.7 / 3.5 (7.5) | 4.3 / 11.1 / 9.5 |
| N14-opt | 1.23 / 1.03 / 0.96 | 1.39 / 1.06 | 1.77 / 1.37 | 36.7 / 47.1 (53.6) | 18.8 / 24.2 | 1.4 / 3.1 / 2.9 (5.7) | 5.4 / 10.8 / 8.9 |

**Level, reported alone** (N14-level: Level in B1, B2 and the checks, 8 items each, its own gain): detectable gain 2.47 / 2.46 / 2.03 per-probe SD at weeks 4 / 6 / 8 (it moves only at checks); false "likely gain" 0.0 / 2.5 / 4.8 % (ever 5.6 %); coverage 95.4–97.2 %. With Level in the record the composite is unchanged (1.64 / 1.26 at weeks 4 / 8; false 0.7 / 2.7 / 2.6 %, ever 4.7 %); the baselines grow to 13.5 minutes.

**Which readouts may show words** (N14, no-gain arm; the policy decides the false rate a player meets):

| Run | Words for the composite alone: false, days 14 / 28 / 56 (ever) | Composite and near rung at the usual bars (ever) | Near rung at 0.975 alone (ever) | Composite at the usual bars, near at 0.975 (ever) | Meter ≥ 0.95 between milestones, no gain |
|---|---|---|---|---|---|
| N14 | 1.9 / 3.2 / 3.2 (5.9) | 4.0 / 7.0 / 5.0 (11.8) | 2.2 / 1.9 / 0.9 (4.4) | 4.0 / 5.0 / 4.0 (9.8) | 13.0 |
| N16 | 0.9 / 2.8 / 2.7 (5.0) | 2.4 / 6.0 / 5.3 (10.3) | 1.5 / 1.5 / 1.1 (3.3) | 2.4 / 4.3 / 3.6 (7.9) | 11.0 |
| N14-perWeek6 | 1.5 / 3.8 / 2.7 (5.8) | 2.8 / 6.9 / 4.6 (10.6) | 1.3 / 1.2 / 1.2 (3.3) | 2.8 / 4.7 / 3.7 (8.5) | 13.6 |

Reading:
- **Words for the composite only.** Any second readout with words pushes "ever" past 6 %. The rungs are shown as meters with their 90 % range; the near rung is where a real gain shows first (a 1 SD near gain: 26 % at week 4, 36 % at week 8), so its meter is the one to put beside the composite's.
- **The meter passes 95 % between milestones** for 13 % of players without a gain (some time through week 8). The words wait for the milestone; the line under the meter must say so (note M1 §9 risk 6).
- **"Likely no change"** (from week 8) reads for 28.3 % of players without a gain and 7.7 % of 0.5 SD_comp gainers in the classic design, and for 7.2 % of 0.5 SD_comp gainers in N14 (§4, §6 runs).

## 7. Stress tests

**Misspecified familiarity, state and population** (N14; false "likely gain" in the no-gain arm):

| Run | Truth differs from the model | Composite, days 14 / 28 / 56 (ever) | Near rung (ever) | Mid (ever) | Far (ever) | Coverage, composite, days 28 / 56 | "Likely gain", 0.5 SD_comp gain, weeks 4 / 8 |
|---|---|---|---|---|---|---|---|
| N14-famBig | plateau 0.8 (prior 0.65) | 1.8 / 6.4 / 6.6 (11.4) | 3.7 / 5.9 / 4.0 (9.8) | 1.8 / 6.3 / 7.6 (11.7) | 1.4 / 6.2 / 4.9 (9.3) | 94.4 / 94.5 | 14.1 / 17.3 |
| N14-tail6 | tail 0.06 (prior 0.045) | 1.4 / 4.0 / 4.6 (7.1) | 1.6 / 4.5 / 6.5 (9.9) | 1.3 / 4.3 / 5.4 (8.2) | 1.2 / 3.3 / 3.4 (5.9) | 94.7 / 95.0 | 11.7 / 14.6 |
| N14-tail9 | tail 0.09, twice the prior (PLAN's wording) | 1.2 / 5.3 / 6.2 (9.8) | 2.5 / 8.9 / 12.5 (17.3) | 1.7 / 5.5 / 4.9 (8.6) | 1.5 / 4.7 / 5.4 (8.4) | 94.7 / 93.4 | 12.1 / 20.0 |
| N14-tail15 | tail 0.15, Terlecki's inexperienced group (reported only) | 1.2 / 5.2 / 8.9 (11.8) | 3.6 / 13.3 / 32.7 (35.4) | 1.3 / 4.9 / 5.3 (8.9) | 1.0 / 5.0 / 4.7 (7.9) | 95.4 / 94.3 | 14.9 / 28.3 |
| N14-stateWrong | state 0.7 (model 0.5; reported only) | 2.1 / 5.1 / 4.1 (8.4) | 2.2 / 5.7 / 4.8 (8.9) | 1.7 / 5.5 / 3.4 (8.4) | 1.3 / 5.3 / 5.3 (8.7) | 90.4 / 91.1 | 11.8 / 12.5 |
| N14-fixturePop | population SD 0.73, probes correlated 0.33 (model told) | 0.4 / 2.4 / 2.7 (3.9) | 1.1 / 3.2 / 3.1 (5.4) | 0.6 / 2.8 / 3.7 (5.7) | 0.1 / 3.8 / 3.2 (5.5) | 95.3 / 94.4 | 5.2 / 6.9 |

- The composite holds the ≤ 10 % line at every report under every misspecified familiarity the plan names (largest: 6.6 % at week 8 with a plateau of 0.8).
- **The near rung is the most exposed to the tail**, because it carries the most items (190 by week 8, against 48 for each mid probe and 40–42 for each far probe): a true tail of 0.09 gives it 12.5 % false "likely gain" at week 8, 0.15 gives 32.7 %. One more reason to keep words off the rungs until pooled data measure the tail (§9).
- A state of 0.7 under a model of 0.5 costs coverage (90.4–91.8 %) and lifts false "likely gain" to 5.1 % at week 4: the day-to-day state is the second number pooled block data must measure (note M1 Addendum A.2).

**A long break** (N14; sessions stop after day 28 and resume on day 91, a gap of 63 days; verdicts at the milestones that follow wait for the restarted run-in, so the day-84 milestone is judged on day 95):

| Run | Truth's familiarity loss (model 45 %) | False "likely gain", composite, days 14 / 28 / 84 / 112 / 140 (ever) | Coverage, composite, days 98 / 112 / 140 |
|---|---|---|---|
| N14-break45 | 45 % | 0.8 / 3.1 / 3.0 / 3.2 / 2.9 (6.9) | 94.9 / 94.6 / 94.0 |
| N14-break25 | 25 % | 0.8 / 3.8 / 4.1 / 3.5 / 3.7 (8.0) | 94.4 / 94.5 / 93.4 |
| N14-break65 | 65 % | 1.3 / 3.9 / 2.5 / 2.2 / 2.3 (6.6) | 94.6 / 94.4 / 93.7 |

The run-in restart holds every report under 5 % whether the real loss is 25, 45 or 65 %; "ever" over five milestones (through week 20) is 6.6–8.0 %. With a 0.5 SD_comp gain held through the break, 8.9 / 12.3 / 13.2 / 12.6 % read "likely gain" at days 28 / 84 / 112 / 140.

## 8. Milestone 4: the crossover's power, and the balance of the assignment

`node tests/node/measure-sim.mjs --crossover --players 1500 --design N14` (tests/node/measure-cross.mjs; 132 s): 1,500 simulated players per layer and effect size, on the chosen measurement design, two periods of 28 days at three sessions a week.

**The assignment** (as the app would draw it, with `PX.rng(PX.rng.hash('bet-assign', player, layer))`): a layer's eligible units are the near probe's strands whose exercises the player trains (note T1 §5.1 and §5.3): for comparison rounds and bridge sets all six (turn ← Rotate and Spin; fold-back ← Fold; cut-back ← Slice; net-back ← Nets; view-from ← Views; where-am-I ← Orient, Reckon, Homing); for the draw-the-answer variants three (Views, Fold, Slice); for detailed calibration feedback one (where-am-I; Central Point has no strand). A seeded shuffle splits the eligible units into two halves (an odd unit goes to either half by the draw): one half has the layer on in period 1 and off in period 2, the other the reverse. Exercises that share a strand go together, so every strand is cleanly on or off. In the simulation each unit is eligible with probability 0.8 (a player trains its exercises).

**The truth.** Each Other Way Round item reads one strand (item i of the probe reads strand i mod 6, so each 6-item block reads every strand once); while a layer is on, its strands rise by δ (per-probe SD of the near probe) over the period and keep it (no decay); every strand also gains unequally whatever the layer (a deviation N(0, (0.3σ)²) times the training curve).

**The analysis** (fixed in advance, two-stage): every Other Way Round item is linearised at its block's fitted ability from js/engine/trend.js; in each block the information-weighted mean residual of the "on" strands minus that of the "off" strands is free of all the strands share (familiarity, tail, state, the common gain); its weighted slope over a period is that period's contrast; the community estimate is the mean over players (each player's mean of their two periods) with its empirical SE, tested two-sided at 5 %. The pooled analysis the plan names (a mixed model with player and strand effects) can only be more efficient.

| Layer (units) | No effect: mean contrast (SE) | Share of a 0.3 SD effect recovered (paired players) | SD of a player's mean contrast | Detectable effect at 80 % power by players completing both periods: 100 / 200 / 400 / 800 | Power for 0.2 / 0.3 / 0.5 SD with 200 players | with 400 players | Bootstrap check (200 players, 0.3 SD): simulated / formula |
|---|---|---|---|---|---|---|---|
| comparison rounds or bridge sets (6) | −0.003 (0.034) | 88 ± 4 % | 1.30 | 0.41 / 0.29 / 0.21 / 0.15 SD | 48 / 82 / 100 % | 77 / 98 / 100 % | 82 / 81 % |
| draw-the-answer variants (3) | 0.012 (0.046) | 86 ± 6 % | 1.73 | 0.56 / 0.40 / 0.28 / 0.20 SD | 29 / 56 / 94 % | 51 / 85 / 100 % | 59 / 60 % |
| detailed calibration feedback (1; strand against the rest, on period minus off period) | −0.059 (0.075) | 97 ± 8 % | 2.87 | 0.83 / 0.59 / 0.41 / 0.29 SD | 16 / 30 / 67 % | 27 / 53 / 92 % | 21 / 21 % |

**Balance.** Over 99,844 simulated draws (players with at least two eligible units of six), each unit is on in period 1 for 49.8–50.1 % of players (turn 50.0, fold-back 50.1, cut-back 49.8, net-back 49.9, view-from 49.9, where-am-I 50.0 %); within a player the halves differ by at most one unit (equal for 52.6 %, one more on for 23.5 %, one more off for 23.9 %). The measurement stays balanced too: with 6 Other Way Round items per block in a fixed strand cycle, every block reads every strand once, so on and off strands are measured on the same occasions in proportion to their number, in both periods. A player who stops after period 1 still gives one within-period contrast. Without an effect the estimator's mean is within 0.06 SD of zero on every layer (one SE or less).

Reading:
- **Comparison rounds and bridge sets** are testable with the community at a size the plan can hope for: 200 players who finish both periods detect a strand effect of 0.29 SD with 80 % power; 400 detect 0.21 SD.
- **Draw-the-answer variants** have only three units, so a split leaves one or two strands per half: about twice the players for the same effect (0.28 SD needs 400).
- **Detailed calibration feedback** has a single strand, so it is a classic AB/BA crossover of one strand against the other five: 0.41 SD needs 400 players and 0.29 SD needs 800. Its own outcome (Balance, the Lab check of note T1 §5.2) or the apply-item uplift may serve it better.
- These powers assume the layer's effect holds through the period. Comparison effects shrink by the next day in the meta-analysis note T1 cites (immediate 0.57, next day 0.22), so the effect at a period's end may be smaller than at a round's end.

## 9. What fails, by how much, and the levers

| Line | Result | Lever, and its cost |
|---|---|---|
| Words on the near rung beside the composite | false "likely gain" 7.0 % at week 4, 11.8 % ever through week 8 (N14, seed 1; seeds 2–3: 10.1 %, 12.0 % ever); with the near rung at a 0.975 bar, 5.0 % and 9.8 % | **Words for the composite only** (adopted as the recommendation, DECISIONS): every acceptance line then holds. Cost: a player whose near rung climbs sees its meter and range, not the words. A joint rule for two readouts would need its own simulation. |
| Near rung under a larger familiarity tail | false 12.5 % at week 8 with a tail of 0.09 (composite 6.2 %); 32.7 % with 0.15 (composite 8.9 %) | No words on the rung (above). A wider tail prior (SD 0.04) is not worth it: at the central truth it lifts "ever" to 6.6 % (fails) and cuts the share reading a 0.5 SD_comp gain at week 8 from 12.5 % to 8.6 %, while the near rung's false rate under a 0.09 tail only falls to 8.6 % (runs N14-wideTail, N14-tail9-wide). The real fix is pooled data on the tail (exposure without training, ideally the staggered start of note M1 §3.4). A lighter near load (L15: 4 per block, 6 in baselines) exposes the rung less but costs a third of its precision. |
| Coverage 92–98 % | holds on N14 seeds 1 and 3; seed 2 has the gain arm at week 8 at 91.8 % (0.2 under); the classic design with the opt-in week also 91.8 % | Nothing to change in the design: the cautious priors (plateau 0.65 and tail 0.045 against a central truth of 0.5 and 0.03) shift every estimate down by 0.2–0.45 SD on purpose, which is what keeps false "likely gain" low. Once pooled data give the population curve, priors at the truth bring coverage to about 95 %. |
| Coverage under a misread occasion state (truth 0.7, model 0.5) | 90.4–91.8 % (reported, not a hard line) | Measure the state from pooled block data first (note M1 Addendum A.2); until then 0.5 is the central value. |
| A near gain of about 1 SD within 4–6 weeks (note M1 §5.5 option 5) | read by 26 % at week 4 and 35 % at week 8 (central; 37 % and 47 % optimistic); detectable near gain 1.53 at week 4 and 1.27 at week 6 (1.23 and 1.03 optimistic) | N14 already spends the scan's biggest lever, 16 near items in each baseline and check (§5: from 6 to 16 took the analytic week-4 figure from 1.91 to 1.52). The probe upgrades with a real reliability near 0.85 (the optimistic set) bring the week-6 figure to 1.03. No mix of 3.5–4.5-minute blocks in the scan gets the near rung to 1.0 SD at week 6 on central values (best: 1.22, analytic). |
| The owner's expectation from the decision board | the board's 1.09–1.43 SD at week 4 and 0.77–1.01 at week 8 were analytic (ideal items, the classic probes); item-level, the chosen ladder gives 1.26–1.64 and 0.97–1.27 | Tell the owner the item-level numbers (§0). The probe upgrades of PLAN milestone 6 and a real reliability near 0.85 are the levers that move them (the optimistic column). |

The hard checks that pass are not loosened anywhere: the thresholds in tests/node/measure-sim.mjs are PLAN milestone 6's, and the exit code is 1 when any of them fails.

## 10. What the build phase must know

- **Wiring.** `PX.engine.trend` is pure and ready; the build adds it to index.html and the MANIFEST (requested in docs/dev/v1.2/requests.md, 20:00 UTC; until then the node suite's load check reports it). assess.js offers the blocks and passes, per occasion, `{ t, h, blocks: [{ probe, items }] }`; the `items` rows that the wave-2 contract stores in `rec.assess` (`[b, g, ok, rtMs]`) pass straight in (the fourth element is ignored; a fifth, the item's slope, defaults to 1). `opts.center[probe]` = the probe's prior centre (the middle of its range): it centres the weak level prior and a probe's first targeting.
- **h.** The model needs each occasion's training-gain curve h (any scale, 0 at B1, growing with training; for example the mean rating gain of the trained exercises since B1). A straight line in days instead of the curve cost little in the simulation (detectable gain 1.66 / 1.20 against 1.64 / 1.27; false rates 0.7 / 2.3 / 3.0 %).
- **Item targeting in blocks:** `predict(fit, probe, h, t).mean` as the centre with SD 1.5, within the probe's pool (the simulation clamps it to ±3 population SD; without such a bound an early runaway prediction aims items off the scale).
- **The meter** is `fit.gain.comp.p` after every block (with `lo`/`hi` for the 90 % range and `logits` for probe points); the words come from `milestoneAt` and `verdict` once per milestone and should be stored in the record when reached, so a later block never rewrites a past verdict. `track(input)` recomputes the whole history (an import, a merge).
- **Words for the composite only**; the rungs and Level as meters (§6, §9). The line under the meter says that it moves with every block and that the words come at the milestones: 12–13 % of players without a gain see it pass 95 % between milestones (seeds 1–3: 13.0, 11.2, 12.5 %).
- **The near probe's strands** should cycle through all six in a fixed order with 6 items per block, so every block reads every strand once: the crossover's balance and power (§8) rest on it.
- **Breaks:** the schedule must give the first two sessions after a gap of more than 56 days baseline-sized blocks (the model holds the words until three occasions), as the simulation did.
- **Speed.** One fit takes 1.6 ms for 8 weeks of data (25 occasions, 478 items), 2.1 ms for 26 weeks and 4.9 ms for a year (157 occasions) in Node, cold; 0.5–2.8 ms from the previous fit's points (`opts.eta`). A phone at a tenth of that speed stays under 50 ms for a year of data.
- **Provisional:** the ids `otherway` and `motiongraphs` in `config.probes`; σ, the state, the plateau and the tail are population values that pooled baselines and blocks replace (note M1 Addendum: the state and the tail first, then σ per probe through `sd.byProbe`).
- **Not simulated here:** the build's real probe pools (discrete difficulties), irregular attendance beyond 2 and 6 sessions a week and one long break, and Level's place in the blocks (only in baselines and checks).

## 11. Reproduce

All runs by hand, `nice -n 15`, one at a time (two CPU cores shared with browser tests). Results are deterministic for a seed.

    node tests/node/run.mjs trend                                               # unit tests (52 checks, under a second)
    node tests/node/measure-sim.mjs --list                                      # the run ids
    node tests/node/measure-sim.mjs --n 1000 --seed 1 --runs spike-check,classic,classic-week,classic-opt,classic-famBig,classic-tail6   # 161 s
    node tests/node/measure-sim.mjs --n 1000 --seed 1 --runs N14,L15,N16,L14all,L20all                      # 258 s
    node tests/node/measure-sim.mjs --n 1000 --seed 1 --runs N14-week,N14-opt,N14-level                     # 135 s
    node tests/node/measure-sim.mjs --n 1000 --seed 1 --runs N14-famBig,N14-tail6,N14-tail9,N14-tail15,N14-stateWrong   # 158 s
    node tests/node/measure-sim.mjs --n 1000 --seed 1 --runs N14-fixturePop,N14-perWeek2,N14-perWeek6,N14-hLinear      # 124 s
    node tests/node/measure-sim.mjs --n 1000 --seed 1 --runs N14-break45,N14-break25,N14-break65            # 105 s
    node tests/node/measure-sim.mjs --n 1000 --seed 1 --runs N14-wideTail,N14-tail9-wide,N14-tail15-wide,N14-famBig-wide   # 132 s
    node tests/node/measure-sim.mjs --n 1000 --seed 2 --runs N14                                            # 43 s (and --seed 3: 44 s)
    node tests/node/measure-sim.mjs --scan --levers                                                         # analytic mixes, about 20 s
    node tests/node/measure-sim.mjs --crossover --players 1500 --seed 1 --design N14                        # 132 s

`--json out.json` keeps every number; `--trend <file>` points at another copy of the trend model. The runs above were made on 2026-11-18 between 20:02 and 20:34 UTC on the commits of this note; the exit code was 1 for the three runs with a failing line, all reported above: classic-week (coverage 91.8 %, §4), N14-wideTail (ever 6.6 %, §9) and N14 with seed 2 (coverage 91.8 %, §6); every other batch and the crossover passed all hard checks.
