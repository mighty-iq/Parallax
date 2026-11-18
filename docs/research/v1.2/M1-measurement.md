# M1. Measurement: showing one person's change within weeks

Research note for Parallax v1.2, Phase 1 (research and plan). Branch `build`. Written 2026-11-18 (UTC).

Scope: how the Spatial Check can show one person's real change on untrained probes within 2–6 weeks; two or three concrete designs with simulation parameters; a numeric feasibility check against the acceptance in `docs/dev/v1.2/standing-rules-gap.md` (ME5); the owner's two decisions (time for measurement; baseline before or after a tutorial); and the near/mid/far ladder.

Labels used throughout:
- **[Found]** what a study reported (effect sizes, samples), with how much of the source was read.
- **[Inference]** my reasoning from the findings, the code and the spike.
- **[Proposal]** a design proposal for v1.2.

Read depth per source: *full text*, *abstract only*, or *secondary* (the secondary source is named). "Full text (partial)" means the fetched page was cut before its end; the sections used are named. The web-search budget of this session ran out during the work; sources I wanted but could not reach are listed under "Could not open", with the assumption used meanwhile.

Spike: `docs/research/v1.2/spikes/M1/power.mjs` (Node, no dependencies, no app code). Every number marked "spike" below comes from it; §5 lists the commands.

## 0. Summary

1. **The acceptance as written is out of reach: with today's probe formats at any cost tested (up to about 70 minutes a week), and with upgraded formats below about 40 minutes a week.** A real composite gain of 0.5 SD shown as "likely gain" in at least 60 % of learners at week 4, with at most 5 % false "likely gain", needs the posterior SD of the gain to be at most 0.26 SD (0.5 / 1.9). That is the same as pre and post scores each with a reliability of about 0.965 [Inference, standard reliable-change arithmetic, §2.1]. In the spike, designs costing 45–81 minutes over four weeks reach a minimal detectable gain (60 % power) of 0.93–1.29 SD at week 4 with today's formats, and 0.63–0.85 SD with upgraded items and a higher (0.85) probe reliability; item-level simulation gives 13–18 % (central) and 18–32 % (optimistic) "likely gain" for a 0.5 SD gain [spike, §5].
2. **The bottleneck is information per minute of probe testing, then occasion noise; the familiarity estimate and the model matter less.** Per item, a yes/no Cube Match item carries 0.074 units of Fisher information, View Match 0.136, Mechanisms about 0.096, Pattern Memory 0.214, and the engine's targeting (k = 0.6) is already within 1 % of the optimum [spike Part 1]. Making familiarity known exactly improves the detectable gain by 1–3 %; doubling item information improves it by about 20 % [spike Part 2].
3. **What does help, in order of size:** (a) a trend model over all measurement occasions instead of each check against the baselines (same schedule: 0.1 % → 8 % detection; §3.2); (b) many short occasions rather than few long ones, because day-to-day state noise is large (within-person SD across sessions 0.54–0.78 of the between-person SD in Salthouse 2007); (c) better probe formats: fewer guessable options, partial credit for Pattern Memory, response time as collateral information (together about ×1.7 information, my estimate); (d) measurement at both ends of the period (bursts) for a fixed number of minutes; (e) a longer horizon.
4. **False positives can be held at 5 %, with two guards:** the verdict words change only at milestone reports (days 14 and 28, a stricter bar at day 14), which brings "ever flagged" among learners without a gain from about 14–15 % to 3.9–4.7 % [spike]; and the population familiarity curve must be right. A familiarity plateau 0.3 SD larger than assumed raises false "likely gain" to 7–9 %, and widening its prior does not fix that. The curve must come from pooled community data (O16), with a conservative prior until then.
5. **Recommended design (Design A, default):** a short baseline in session 1 after the two-minute tutorial, a second one at the start of session 2, then a 3.5–4.5-minute no-feedback probe block in every training session and a 10-minute check every 4 weeks (about 13–17 minutes a week). A linear-Gaussian trend model (generalised least squares, equivalent to a Kalman filter) with a population familiarity curve; a probability meter shown always; verdict words at milestones. Plus an opt-in **measurement week** (Design B: four 9-minute sessions at the start and every 4 weeks), which is the most precise per minute. Design C keeps today's checks with the trend model, as the minimum change.
6. **Acceptance: proposed restatements for the owner** (§5.5): keep the 0.5 SD target and accept week 8–12, or keep week 4 and use a gain of 0.8 SD, or pay about 40 minutes a week; or define the 0.5 SD per probe rather than on the composite (power ×1.4–1.5). In every case the near rung (§7) is where one person's gain is most likely to show within weeks.

## 1. The current check, in numbers

**What the code does** (read: `js/engine/assess.js`, `js/engine/model.js` lines 95–99, `docs/dev/ENGINE.md` §10 and §16, `tests/node/sim.mjs`, `tests/node/fixtures/learner.mjs`):
- Four composite probes (Cube Match, View Match, Mechanisms, Pattern Memory), the optional Level and the control Word Links. Each probe is a 16-item adaptive test aimed at success g + (1 − g)·0.6 (first two items at 0.85), scored by the exact grid posterior with the same prior every time, N(middle of the range, 1.5²). The composite is the mean of the four, with SE √(Σ SE²)/4.
- Schedule: B1, B2 at least 12 hours later, B3 when they differ by more than 2 combined SEs, then a check after 14 days **and** 8 counted sessions, and a delayed check after training slows. At 3 sessions a week, the first regular check falls on about day 18 and the second on about day 37 (spike schedule D0), so by week 4 there is one comparison.
- Decision (`decide()`): "beyond familiarity" needs the lower 95 % bound of the change beyond the person's own retest gain G = B2 − B1 (with G's SE) **and** the lower 95 % bound of the change minus the control's change (with the control's full SE) both above zero.

**Why it reads "unclear yet"** [Inference, from the code and spike Part 1]:
- Per-probe SE after 16 items at the engine's target: Cube Match 0.79, View Match 0.62, Mechanisms 0.71, Pattern Memory 0.51 logits (Word Links 0.62). Composite SE per check ≈ 0.33 logits.
- One check against the mean of two baselines: SE ≈ 0.41 logits. Subtracting the person's own G adds G's SE (≈ 0.47 when G > 0); comparing with the control adds the control change's SE (≈ 0.76). The comparison with the control alone has SE ≈ 0.86 logits, so "beyond familiarity" needs a composite change of about 1.7 logits. That is about four times a 0.5 SD composite gain (0.43 logits in the central population of §4.4), and over six times in the fixture's population.
- Each check is judged on its own; nothing accumulates over checks (the gap audit's ME5).
- Spike, design D0 with today's rule: 0.1 % of learners with a 0.5 SD composite gain read "beyond familiarity" at week 4 (1,000 learners), 0.0 % without a gain. This matches ENGINE.md §16 (96.5 % "unclear yet" after 60 days).

**What the engine's learner fixture assumes about probes** (`tests/node/fixtures/learner.mjs` lines 144–161) [Found in code]:
- θ_probe = θ0 + transfer · (mean training gain so far) + R · [0, 1, 1.5][check index], R ~ N(0.33, 0.1²) **logits**. Scharfen's 0.33 is in SD units, so the fixture's retest gain is about 0.45 of its own probe SD.
- θ0 = middle + 0.7·general + N(0, 0.6²): a between-person SD of 0.73 logits per probe and a between-probe correlation of 0.33. With the item information above, a 16-item probe then has a reliability of only about 0.55 (spike `simPop`). Short spatial tests are usually more reliable than that (§2.1), so the fixture makes the probes look worse than they probably are; but it is the only calibration there is until pooled data exist.
- Probes have no day-to-day noise (training exercises have N(0, 0.15²) per day), and probe response times never speed up with exposure (the speed-up uses the training count, which stays 0 for probes). Both matter for v1.2 (§8).

## 2. What limits one person's change estimate

### 2.1 Item-sampling error, and the arithmetic of individual change

[Found] Reliable change is usually judged with 90 % intervals (z = 1.645) around a test's standard error of the estimate; in the Uniform Data Set most neuropsychological tests had test–retest reliabilities below .70 (Gavett, Ashendorf & Gurnani 2015; *full text*). The Jacobson–Truax index divides the difference by √2 · SEM, and the Chelune variant first subtracts the mean practice effect (formulas as commonly stated; the original papers are under "Could not open"). Difference scores are much less reliable than levels: median .32 for difference scores against .85 for initial scores across 16 tests (Salthouse & Tucker-Drob 2008; *full text*).

[Inference] For a pre/post difference with test–retest reliability r, the SE of the difference is SD·√(2(1 − r)). Detecting a change δ in 60 % of cases at one-sided 5 % needs δ ≥ 1.9 × that SE. For δ = 0.5 SD this means r ≥ 0.965 for each of the two measurements (r = 0.90 gives 30 %, r = 0.95 gives 47 %). Every design below is a way to approach that reliability from many short pieces.

### 2.2 Occasion (day-to-day) noise

[Found]
- **Salthouse 2007** (*full text*, PMC author manuscript): 16 tests with three parallel versions, three sessions within about two weeks. The within-person SD across sessions was 0.54 (Study 1, N = 90) and 0.57 (Study 2, N = 1,600) of the between-person SD (medians); for the spatial tests 0.63–0.78 (spatial relations, paper folding, form boards; Tables 4 and 8). These SDs are of raw scores, so they include item sampling and practice, not only state. Means across the three sessions had a median reliability of .94. He proposes measurement bursts, with change scored against each person's own across-session spread (median reliability .59 against .44 for plain differences).
- **Sliwinski et al. 2018** (*abstract only*): smartphone tasks in daily life, N = 219: between-person reliability of averaged scores ≥ .97; within-person reliability across occasions .41–.53. Their extrapolation that about 10 sessions give reliabilities of .95 (speed) and .86 (dot memory) is reported by Brewster et al. 2021 (*secondary*).
- **Hakun et al. 2023** (*full text*): ultra-brief working-memory tasks on phones. Between-person reliability 0.84 after two 1.5-minute sessions, above 0.9 after five, 0.97 for a 7-day burst (about 29 sessions); within-person reliability 0.17–0.48.
- **Brewster et al. 2021** (*full text*): bursts of 10 sessions over 5 days, 97.5 % of sessions completed; burst-level ICCs .79–.94; retest across bursts .85 and .87.
- **Nicosia et al. 2023** (ARC, *abstract only*): up to 4 sessions a day for 7 days, N = 290; between-person reliability and 6- and 12-month retest reliabilities above .85; adherence 80 %.
- **Tamburri et al. 2022** (*full text*): in weekly sessions within yearly bursts, 18–26 % of the variance of response-time measures lay between weeks within a person.

[Inference] A single session's score varies within a person by roughly half the between-person spread, and part of that is real state (sleep, fatigue, motivation), which no number of items within the session removes. Averaging over occasions is the only remedy. For the spike I set the state SD to 0.25 of the between-person SD per probe and session, half of its variance shared by all tasks of the session (range 0.15–0.35). This is my estimate: the studies above report total within-person spread, not a clean state component.

### 2.3 Retest and practice effects: size, time course, decay

[Found]

| Source (read depth) | Design | Retest gain (SD units) | Time course |
|---|---|---|---|
| Scharfen, Peters & Holling 2018, cognitive ability tests (*full text*, retest and moderator sections) | 122 studies, N = 153,185 | 1→2: 0.33; 1→3: 0.50; 1→4: 0.52. Alternate forms 0.23, 0.35, 0.55 (identical 0.37, 0.55, 0.56). Figural content 0.32, 0.52, 0.53 | 2→3 adds 0.17, 3→4 adds 0.02 (n.s.); only 10 studies had four administrations and 3 had more. Interval: about −0.0008 per week for 1→2. Latent change judged improbable |
| Scharfen, Jansen & Holling 2018, working-memory tests (*full text*, partial) | 68 studies, 95 samples | 0.28, 0.52, 0.81, 0.97, 0.93, 1.01 (tests 2–7) | Gains continue to the 4th test, plateau after 4–5. Alternate forms did not reduce the effect (0.30 vs 0.32); visuospatial 0.33 at test 2 |
| Hausknecht et al. 2007 (*full text*) | 50 studies, N = 134,436 | 0.26 overall; alternate forms 0.24, identical 0.46; coaching 0.70; verbal 0.19, quantitative 0.30, analytical 0.32 | 2→3 adds 0.20; 1→3: 0.56. Interval matters for identical forms only |
| Uttal et al. 2013, spatial training (*full text*, results and discussion on controls) | 206 studies | Control groups gained g = 0.45 (k = 372), more with repeated testing; trained groups 0.62; training vs control 0.47 | The authors contrast 0.45 with the 0.29 retest effect of other measures |
| Bartels et al. 2010 (*full text*) | N = 36, 7 sessions over a year, alternate forms where available | First retest d = 0.30–0.55 by domain; cumulative to month 3 (5 sessions) 0.50–0.69 by domain, 0.36–1.19 for single tests | Most of the gain at the first retest; stable after month 3; no recommendation possible for visuospatial tests |
| Salthouse & Tucker-Drob 2008 (*full text*) | 3 studies, N = 1,021, 205, 227; intervals under a week | Median 0.30 for non-vocabulary tests with identical items; spatial tests among the largest, Spatial Relations larger with different items | Largest 1→2, smaller 2→3. Changes correlate weakly across tests (medians .06–.18) |
| Falleti et al. 2006 (*abstract only*) | CogState, N = 45 and 55 | — | At 10-minute intervals performance stabilised after the 2nd test; after a practice session, none at one month |
| Goldberg et al. 2015 (*abstract only*) | review | About 0.25 for composites over three assessments in 6–12 months | Recommends massed pre-baseline practice, strategy-limited tasks and matched alternate forms |
| Sliwinski et al. 2006 (*full text*, partial) | 6 sessions 8–14 days apart | (raw units) | Practice fitted by a negative exponential (asymptote, gain, rate) or a quadratic |
| Brewster et al. 2021; Oravecz et al. 2022 (*full text*) | phone bursts | (raw units) | Gains within each burst and across bursts, tapering; a warm-up dip at the start of a later burst. Oravecz: Bayesian double-exponential model with a shift of the asymptote Δ as the change of interest, and person-level posterior probabilities of change |
| Heathcote, Brown & Mewhort 2000 (*abstract only*) | 7,910 learning series | — | Individual series follow an exponential, not a power law; averaging creates the power-law look |
| Dutilh et al. 2009 (*abstract only*) | 10,000 lexical-decision trials | — | Practice changes drift rate, caution, bias and non-decision time together |

[Inference] For probes:
- **Size.** Plan for a familiarity plateau of about 0.5 SD (plausible range 0.3–0.8, with 1.0 possible for memory-like probes such as Pattern Memory). This is as large as the target gain, which is why it cannot be handled loosely.
- **Time course.** Most of it comes with the first one to three administrations; alternate forms slow it down rather than stop it (Scharfen: 0.55 by the 4th test with alternate forms). With many short blocks, "administration" is better counted in items seen, with sessions as a second clock (warm-up dips after breaks).
- **Decay.** Over weeks it is negligible (Scharfen: −0.0008 SD per week for 1→2; Hausknecht: matters for identical forms only), so the familiarity curve can be treated as cumulative within the v1.2 horizon.
- **Speed.** Familiarity is larger in speed than in accuracy (Scharfen's speed tests: 0.37 at test 2; Dutilh: several diffusion parameters move). Any response-time component in the estimate needs its own familiarity curve.

### 2.4 Separating practice from real change

[Found] The tools in the literature: alternate forms, which help at the 2nd and 3rd test but not by the 4th (Scharfen 2018) and not at all for working memory (Scharfen, Jansen & Holling); a run-in or dual baseline (Bartels 2010: use the 2nd assessment as baseline for many tests; Goldberg 2015: massed pre-baseline practice; Falleti 2006: stable after the 2nd test at short intervals); a modelled practice curve per person (Sliwinski 2006; Oravecz 2022); control groups (Uttal 2013; Scharfen, Jansen & Holling stress inactive controls); a non-trained control task.

[Inference] For one person without a control group:
1. **The per-person estimate G = B2 − B1 is too noisy to subtract.** It carries the SE of a difference of two checks (≈ 0.48 logits for the composite), larger than the effect it corrects.
2. **A population familiarity curve as a prior is the workable route.** The person's own data then refine the amplitude a little. Its mean must be right: in the spike, a true plateau of 0.8 SD against an assumed 0.5 SD gives 7–9 % false "likely gain" at week 4 even with a wider prior (§5.3). The curve should be estimated from pooled exports: the run-in blocks of all players, and ideally a randomised staggered start (§3.4).
3. **The control task helps less than hoped per person.** Retest gains correlate only weakly across tests (Salthouse & Tucker-Drob: .06–.18 observed, perhaps .2–.5 after correcting for the low reliability of change scores). The control's change says little about one person's spatial familiarity. Its value lies in pooled data (motivation, test-taking) and, if long enough, in absorbing shared day-to-day state.
4. **A run-in front-loads familiarity before training builds up**, so that most of the steep part is behind the baseline: the two baselines and the first blocks in Design A.
5. **A margin.** Calling a gain "likely" only when it clears a small margin protects against a residual familiarity trend, at a cost in power.

## 3. Methods for detecting one person's change

### 3.1 Pre/post comparisons and reliable change indices

[Found] See §2.1: 90 % reliable-change intervals (Gavett et al. 2015); the low reliability of difference scores (Salthouse & Tucker-Drob 2008: median .32); change scored against a person's own across-session spread was more reliable than a plain difference, .59 against .44 (Salthouse 2007).

[Inference] Today's check is a practice-adjusted reliable change index with a per-person practice estimate (G = B2 − B1), applied to one check at a time. Its three weaknesses are each costly: one occasion per comparison (no averaging of state noise), a per-person practice estimate (noisy), and the comparison with the control at the control's full error. A pre/post index can reach 0.5 SD only with reliabilities around 0.965 (§2.1), which a 15–25-minute check of these formats does not reach.

### 3.2 Trend and state-space models over many short checks

[Found]
- **Growth-rate reliability** (Willett 1989, via Brandmaier et al. 2018, *full text*): GRR = σ²_slope / (σ²_slope + σ²_ε / SST), with SST = Σ(t − t̄)². The precision of one person's slope therefore grows with the number of occasions and with their spread in time. Brandmaier et al. show that GRR misses some design differences and propose effective curve reliability. In their five-occasion example, moving occasions towards the ends raised power from 0.51 to 0.63 at the same GRR.
- **State-space learning curves** (Smith et al. 2004, *full text*): a latent learning state follows a Gaussian random walk, binary responses come through a logistic link with the chance level as offset, and the curve is estimated by EM and smoothing. Learning is declared at the first trial after which the lower 95 % bound stays above chance (IO(0.95)). In simulations this found learning in 83 % of runs (other methods 72–80 %) and earlier than a consecutive-correct criterion in over 99 %.
- **Practice-aware change models** (Oravecz et al. 2022, *full text*): a Bayesian double-exponential model fits practice within bursts and a shift of the asymptote Δ between bursts. Δ is the change of interest, with a posterior probability per person; raw burst means misread change in both tasks studied.

[Inference]
- The model for Parallax (§4) is linear and Gaussian once the familiarity curve's shape is fixed: block estimates are observations, and baselines, familiarity amplitudes and the gain are parameters. Generalised least squares then gives the exact posterior, identical to a Kalman smoother over sessions. With 11 parameters it runs in the engine without sampling. Every occasion adds information, so the meter moves with each block.
- On today's schedule alone, the trend model lifts "likely gain" for a 0.5 SD gain at week 4 from 0.1 % to 8.3 %, with 3.4 % false "likely gain" (spike, D0 vs D0m). Most of the remaining gap is the schedule's low information.
- **Shape of the gain.** The gain should follow the person's own training curve, h(t) = mean training-rating gain so far ÷ its value at the report, not calendar time. The engine knows that curve, and the learner fixture's transfer follows it. The spike uses linear time (h = t/28), which is a fair stand-in for 3 sessions a week.
- A per-probe random walk (local level) would allow gains to plateau or reverse, but with a few items per probe per week it mainly adds variance. Keep it for later, when pooled data show how probe gains evolve.
- Two-stage estimation (block θ̂ and SE, then GLS) is adequate for blocks of three or more items per probe, with a weak prior centred on the person's running estimate. The spike shows a small shrinkage towards zero (conservative). A one-stage item-level model (Laplace approximation) would be slightly more efficient.

### 3.3 Measurement bursts and ambulatory cognitive assessment

[Found] §2.2: averages of many brief sessions reach between-person reliabilities of .95–.97 (Sliwinski et al. 2018; Hakun et al. 2023: 0.84 after two 1.5-minute sessions, above 0.9 after five), compliance is high (Brewster et al. 2021: 97.5 % of 10 sessions in 5 days; Nicosia et al. 2023: 80 % over 7 days), and within-person (occasion-to-occasion) reliability is low (.17–.53). Salthouse 2007 proposes bursts for change measurement. Practice runs within bursts and tapers across them, with warm-up dips (Brewster 2021; Oravecz 2022).

[Inference]
- Short, frequent probe occasions are the right unit: they average out day-to-day state, which no number of items within one session can do.
- For a fixed number of minutes, a burst at each end of the period gives the most precise before/after contrast for a linear gain. In the spike, B+ (two bursts of four 9-minute sessions, 72 minutes) reaches a minimal detectable gain of 0.93 SD at week 4, against 1.11 for embedded 4.5-minute blocks (81 minutes). This matches Brandmaier et al. on spacing.
- Bursts move the meter only every 4 weeks and concentrate the effort in some weeks. Hence the default embedded blocks (Design A) and an opt-in measurement week (Design B).

### 3.4 N-of-1 and single-case designs

[Found]
- **What Works Clearinghouse single-case standards** (Kratochwill et al. 2010, *full text*): at least 5 data points per phase (3 with reservations); three demonstrations of the effect at three different times; AB, ABA and BAB designs do not meet the standards; multiple-baseline designs need at least three baselines. Effects are judged by level, trend, variability, immediacy, overlap and consistency.
- **Sequential testing** (Schönbrodt et al. 2017, *abstract only*): Bayes factors computed after each observation, with thresholds fixed in advance, kept long-run error rates at or below those of optimal fixed-N testing with 50–70 % smaller samples. The thresholds must be part of the design.

[Inference]
- Learning does not reverse, so reversal designs cannot apply. One person's training is at best an AB design, which the standards do not accept as causal. The app's words should therefore be "your probe scores rose beyond what familiarity predicts", never "training caused it".
- The single-case rules still shape the schedule: at least 3–5 measurement points before training has had much effect (B1, B2 and the first blocks), and at least 5 points in each later phase.
- **Multiple baseline across players, for the community:** an opt-in randomised staggered start, in which a player takes probe blocks for one or two weeks before training starts. Pooled, this is a multiple-baseline-across-participants design. It measures the familiarity curve free of training, the population quantity the per-person verdict depends on (§2.4).
- **Multiple baseline across probes, within one person:** the Lab crossover (train cluster A, then B) becomes informative once each cluster has its own near probe (§7). The contrast "near-A minus near-B change" cancels familiarity and state shared by both probes.
- **Repeated looks** inflate false positives: in the spike, showing the verdict after every embedded block flags 13.6–15.0 % of learners without a gain at some point by week 4, against 3.1–3.6 % at the week-4 report. Verdicts only at fixed milestones fix this (§4.1).

### 3.5 Information per minute: adaptive items, formats, partial credit, response times

[Found]
- **Response times as collateral information.** In the hierarchical model of van der Linden (2007), the information that response times add about ability is bounded (Ranger 2013, *abstract only*). The bound is ρ²/(1 − ρ²), with ρ the correlation of speed and ability (θ in SD units), according to Wang, Weiss & Su 2019 (*secondary*, full text read), whose own example cut SEs by 4–9 %. Reis Costa et al. 2021 (*full text*, PISA 2012 mathematics, 31 countries): EAP reliability rose from .73 (responses only) to .77 (hierarchical model) and .80 (with cross-loadings), and mean SEs fell by 4 % and 12 %. The authors caution that the extra information may not measure the intended construct. In an adaptive test, updating the ability prior with each response time gave a substantial improvement of the ability estimator (van der Linden 2008, *abstract only*). The information speed carries depends on its precision and its correlation with ability (Klein Entink, Fox & van der Linden 2009, *full text*, partial).
- **Decision models.** In simulations with 40 trials per person, the participants per group needed for 80 % power were about 140 for response time, 115 for accuracy and 55 for the EZ drift rate. Under a speed–accuracy shift, response time alone gave false alarms approaching 100 %, drift rate none (Stafford et al. 2020, *full text*). Drift-rate estimates need many trials: about 26/78 (maximum likelihood), 37/119 (Kolmogorov–Smirnov) and 68/201 (EZ) for low/high precision (Lerche, Voss & Nagler 2017, *full text*, partial). Of the combined speed–accuracy scores, BIS is relatively insensitive to speed–accuracy trade-offs (Liesefeld & Janczyk 2019, *abstract only*). Tasks with robust group effects often have low test–retest reliability, 0 to .82 across seven classic tasks, because people differ little (Hedge, Powell & Sumner 2018, *abstract only*). A time-limit scoring rule (signed residual time) implies an exponential-family model whose accuracy part is a 2PL with the time limit setting discrimination (Maris & van der Maas 2012, *abstract only*).

[Inference]
- **Targeting is not a lever.** The engine's k = 0.6 is within 1 % of the information optimum for every format (optimum k = 0.48–0.56; spike Part 1).
- **Formats are a lever.** A yes/no item (Cube Match, g = .5) carries about half the information of a 4-option item. Mechanisms' 2–3 options are also weak. Pattern Memory's exact-set scoring throws away the cell-level result that `score()` already computes (`value`, `detail`) and the trial row already stores; scoring by cells (for example, hits and false alarms as a testlet) could perhaps double its information. That is an assumption to check on pooled data.
- **Response time, an idealised bound.** For a Wiener diffusion with drift v and boundary separation a, the Fisher information about v from one trial's choice and decision time is E[T] (Wald's identity), and from the choice alone a²·P(1 − P). Their ratio is sinh(2x)/(2x) with 2x = a·v = logit(P correct): 1.12 at 70 % correct, 1.35 at 80 %, 2.0 at 90 %. Non-decision-time variability, strategy shifts and practice all lower this. At Parallax's targets response time could therefore add 10–35 % at best, consistent with the 4–12 % SE reductions above.
- **Response time, the risk.** Speed carries the largest familiarity effects (§2.3), and EZ needs far more trials than a block has. Use response time only inside a hierarchical model with a probe-specific speed familiarity curve, and only once pooled data have shown that curve. Meanwhile keep reporting the median response time separately, as today.
- **Time per item is a lever.** What counts is information per minute. Probe items now take about 15 s (the guide: 16 items in 3–5 minutes); items that take 10 s would give 50 % more information per minute at the same information per item.
- **Signed-residual-time scoring** would add information per item but turn the probes into speeded tests, which changes what they measure. Not for probes.

### 3.6 Alternate forms and equating with little data

[Found] Alternate forms lower retest gains at the 2nd and 3rd test (0.23 vs 0.37; 0.35 vs 0.55) but not at the 4th (0.55 vs 0.56) (Scharfen et al. 2018); 0.24 vs 0.46 (Hausknecht et al. 2007); no difference for working-memory tests (Scharfen, Jansen & Holling 2018).

[Inference]
- Parallax's forms are seed streams from one item model, scored on the item model's scale, so they are comparable to the extent that the item model is right (hand-set steps, O16). With embedded blocks the "form" loses its meaning: what needs equating is the item model.
- **With little data:**
  1. Randomise each player's starting form. Today every record takes A, B, C in the same order, which confounds form with occasion and familiarity in pooled data.
  2. Keep logging the seed, parameters, predicted success, b and g of every probe item (already in the research export). Pooled data can then refit the LLTM steps per probe and estimate the residual item variance (an item-level random effect).
  3. Treat seed-stream or form offsets as random effects shrunk towards zero, and test them against zero before correcting anything.
  4. Until then, model item-difficulty error as noise, which averages out over items. The spike uses N(0, 0.3²) per item, the engine's misspecified run N(0, 0.5²).
- The small-sample equating literature (synthetic linking, circle-arc equating) and random-item IRT were not reached (search budget; see Could not open). They matter only if fixed forms come back.

## 4. Designs for v1.2

All three designs share one statistical model and one display; they differ in what is measured when. [Proposal]

**The shared model** (implemented in the spike as `posteriorG`):

    y_ij = α_i + F_i · φ̄_ij + G · h(t_j) + u_j + s_ij + e_ij     spatial probe i in session j
    y_cj = α_c + F_c · φ̄_cj + u_j + s_cj + e_cj                   control (Word Links)

- **y** is the block's ability estimate (a likelihood-based θ̂ with a weak prior, SD 3, centred on the person's running estimate) and **e** its error, with variance from the block's own posterior.
- **φ̄** is the mean over the block's items of 1 − exp(−n/λ), with n that probe's items seen before. This is the familiarity curve: an exponential per individual (Heathcote et al. 2000), counted in items.
- **u_j** is the session's shared state (all tasks), **s** the task-specific state. Within a session the covariance is block-structured; Sherman–Morrison inverts it in closed form.
- **Priors.** α flat. (F_1…F_4, F_c) jointly normal around the population familiarity curve (§4.4). G either flat (the plain 5 % guarantee at one look) or N(0, 1 SD_comp²) (sceptical: fewer false positives, about half the power, §5).
- **Shape.** h(t) is the person's training-gain curve, normalised to 1 at the report.
- **Output.** The posterior of the gain to date, D = G · h(now): mean, SD and P(D > 0). It is exact (generalised least squares, the same as a Kalman smoother), so the engine needs no sampling.

**The display** [Proposal]:
- **The meter, always shown.** "Chance that your probe composite rose beyond familiarity: 84 %", with the estimated change and a 90 % range, updated after every measurement block. The note under it: it moves as data come in, and the verdict comes at the milestones.
- **Verdict words, only at milestones** (end of week 2, end of week 4, then every 4 weeks):
  - "Likely gain" when P(D > 0) ≥ 0.975 at week 2, or ≥ 0.95 at week 4 and later;
  - "Likely no change" when P(D < 0.2 SD_comp) ≥ 0.90 and at least 8 weeks of data exist (the spike gives 2–5 % false "no change" for real 0.5 SD gainers at week 4 if this is allowed earlier);
  - "Unclear yet" otherwise.
- The SD unit needs a population SD, which only pooled data can give. Until then, show changes on the probe's own scale (the item-model logits, as "probe points") and in words. Never as IQ, an index, a percentile or a norm (CLAUDE.md rule 10; RULES.md).

### 4.1 Design A (recommended default): embedded probe blocks and a monthly check

**What is measured when:**
- **Session 1.** The two-minute tutorial of the first exercise, then baseline B1: each composite probe's worked example and 8 items per probe, plus 8 Word Links items (40 items, about 10 minutes), before any rated training.
- **Session 2** (at least 12 hours later). Baseline B2 at the start, before rated items: same size.
- **Every later training session.** A no-feedback block at the start, before any training item, always in the same place: 3 items of each composite probe and 2 Word Links items (14 items, about 3.5 minutes).
- **Every 28 days.** A 10-minute check (8 items per probe, 8 control) replaces that session's block; the optional Level probe can join here.
- **Variant A+.** Blocks of 4 items per probe (about 4.5 minutes) and 10-item baselines.
- **More than four sessions a week.** Cap the blocks at four a week, so that measurement stays under about a fifth of training time and probe familiarity does not race ahead.

**Minutes:** about 23 in week 0, then 10.5 a week, plus 10 every fourth week, so about 13 a week at 3 sessions a week and about 9.5 at 2 a week (A+: about 16.5).

**Separating practice from change:**
1. The run-in: 16 items per probe before session 3, which is about 63 % of the familiarity plateau if λ = 16.
2. The population familiarity curve as a prior, with the person's amplitude estimated jointly.
3. The control's rows, which absorb shared state and inform familiarity a little.
4. Verdicts at milestones.
5. A conservative plateau prior (0.6–0.8 SD) until pooled data give the curve. In the spike, a prior of 0.8 against a true 0.5 halves the power but holds false positives near 2 %.

**Spike** (0.5 SD_comp composite gain; central / optimistic):
- Minimal detectable gain at week 4: 1.21 / 0.80 SD_comp.
- Item-level simulation at week 4: "likely gain" 14 % / 20 %; false "likely gain" 3.6 % / 3.5 % at the report, and 4.7 % / 4.3 % at any milestone.
- At week 8 the minimal detectable gain falls to 0.85 / 0.57.
- A+: 1.11 / 0.75 at week 4.

**Why the default:** the meter moves every session, the measurement is short and in a fixed place, it fits the existing session flow, and it keeps improving with time. The early sessions are the bottleneck for later precision (§5.4), and the design front-loads two baselines.

### 4.2 Design B (opt-in): measurement weeks

**What is measured when:**
- Four short sessions of about 9 minutes each (8 items per composite probe, 4 Word Links items) on four consecutive days at the start: days 0–3, the first one after the tutorial.
- The same in the last four days of every fourth week (days 25–28, 53–56, …).
- Nothing in between. Training goes on as usual.

**Minutes:** 36 in a measurement week, 0 otherwise, so 9 a week on average over each 4-week cycle.

**Model and display:** the shared model. The verdict is given once, at the end of each measurement week, never during it: the spike's B+ flags 7.4–7.8 % "ever" when every burst session is a look, and 4.2–4.5 % at the burst's end.

**Separating practice:** as in A. The first burst is also a run-in (32 items per probe by its end, 86 % of the plateau at λ = 16).

**Spike:**
- Minimal detectable gain at week 4: 0.93 central / 0.63 optimistic, the best per minute of the three designs.
- Item-level simulation: "likely gain" 17.6 % / 31.7 % for a 0.5 SD_comp gain; false "likely gain" 4.5 % / 4.2 % at the report.
- With 0.5 SD defined per probe (0.67 SD_comp), the analytic power is 39 % central and 65 % optimistic (§5.5).

**Why opt-in:** this is the sharpest answer for a player who wants one, and the natural home of the community's staggered-start experiment (§3.4). But it concentrates effort in some weeks, and the meter moves only every 4 weeks.

### 4.3 Design C (minimum change): today's checks, judged by the trend model

**What is measured when:** as today: 16 items per probe at B1, B2, then every 14 days and 8 sessions. The schedule stays; the decision moves to the shared model, with the meter and milestone verdicts.

**Minutes:** about 20 per check, so about 8 a week on average.

**Spike:**
- Minimal detectable gain at week 4: 1.79 central / 1.28 optimistic.
- Item-level simulation: "likely gain" 8.3 % / 11.7 %; false "likely gain" 3.4 % / 3.8 %.
- Against today's rule: 0.1 % / 0.4 %.

**Why consider it:** the smallest build. Every check now adds to the estimate instead of being judged alone, and the meter works. But it stays far from the owner's goal, so it is the fallback if the embedded blocks cannot be built in v1.2.

**Probe upgrades, for every design** (the spike's "better items", about ×1.7 information on average, my estimate):
- Cube Match as a 4-option item: ×1.84 information per item, if the time per item stays similar.
- Mechanisms with 4 natural options: ×1.42.
- Pattern Memory scored by cells: ×2 assumed, to verify.
- Response time through a hierarchical model with a probe speed-familiarity curve: ×1.15 assumed (Reis Costa et al. 2021; Ranger's bound).
- Probe items kept under about 10 s where the format allows.

These are design requirements for the transfer agent's probe work (§7).

### 4.4 Simulation parameters, with sources

| Parameter | Central value (range for sensitivity runs) | Source or basis |
|---|---|---|
| Item model | P = g + (1 − g − 0.03)·σ(θ − b), a = 1, target k = 0.6 | `js/engine/model.js`, `assess.js` |
| Item information at k = 0.6 | Cube Match 0.074, View Match 0.136, Mechanisms ≈ 0.096 (g ≈ 0.4), Pattern Memory 0.214, Word Links 0.136 | spike Part 1, from the guessing rates in `js/ex/*/gen.js` |
| True item difficulty off the model | N(0, 0.3²) per item (0.5) | [Assumption]; the engine sim's misspec run uses 0.5 |
| Time per probe item | 15 s (10–19) | guide: a 16-item probe takes 3–5 minutes |
| Between-person SD per probe, σ_pop | 1.15 logits, set so that a 16-item probe has reliability 0.75 (0.73 logits = today's fixture, reliability ≈ 0.55; 1.58 logits = 0.85; 1.99 = 0.90) | [Inference]: short spatial tests usually reach .75–.85; median reliability .85 for initial scores of full-length tests (Salthouse & Tucker-Drob 2008). To be replaced by B1–B2 retest correlations from pooled exports |
| Correlation of true ability between probes | 0.4 (0.3–0.6) | [Assumption]; the fixture implies 0.33 |
| Familiarity plateau per probe | 0.5 SD (0.3–0.8; 1.0 for memory-like probes) | Scharfen et al. 2018 (0.33 / 0.50 / 0.52; alternate forms 0.23 / 0.35 / 0.55; figural 0.32 / 0.52 / 0.53); Hausknecht et al. 2007 (1→3: 0.56); Uttal et al. 2013 (spatial controls 0.45); Bartels et al. 2010 (0.50–0.69 cumulative by domain); Scharfen, Jansen & Holling 2018 (working memory, to 0.97) |
| Familiarity rate | 63 % after λ = 16 items of that probe (λ = 40) | [Inference]: one 16-item administration ≈ one retest (0.33 of 0.5); slower curve from the working-memory meta-analysis |
| Familiarity tail after the curve | 0 (+0.03 SD per 16 items) | Scharfen 2018: 3→4 adds 0.02 (n.s.) |
| Between-person SD of the plateau | 0.2 SD (0.1–0.35) | [Assumption]; Scharfen's τ = 0.32 is between studies, not between people |
| Familiarity correlations | 0.5 among spatial probes; 0.3 with the control (0–0.6) | Salthouse & Tucker-Drob 2008: change correlations .06–.18 observed, change reliability .32 → roughly .2–.5 after correction [Inference] |
| Control (Word Links) plateau | 0.3 SD | Hausknecht et al. 2007 (verbal 0.19); Scharfen et al. 2018 (verbal 0.33) |
| Decay of familiarity | none within 12 weeks | Scharfen 2018 (−0.0008 SD per week); Hausknecht (interval matters for identical forms only) |
| Warm-up dip after a break of ≥ 7 days | 0 (−0.1 SD for the first block after a break) | Oravecz et al. 2022; Brewster et al. 2021 (size not given) [Assumption] |
| Occasion state per probe-session | total 0.25 SD, half of its variance shared by all tasks in the session (0.15–0.35) | Salthouse 2007 (within/between SD .54–.78, raw); Sliwinski et al. 2018 (within-person reliability .41–.53); Tamburri et al. 2022 (18–26 % of variance between weeks) [Inference for the split] |
| Response-time information | ×1.0 (×1.1–1.3 on probe information) | Reis Costa et al. 2021 (SE −4 % / −12 %); Ranger 2013 bound via Wang et al. 2019; diffusion bound §3.5 |
| Probe speed familiarity | log-RT falls 0.3 with the plateau, at the same rate as accuracy familiarity (0.2–0.5) | [Assumption]; speed shows the largest retest effects (Scharfen 2018: speed 0.37 at test 2); Wright et al. 2008: MR response time 3.1 s → 1.5 s with practice (*secondary*: docs/research/v1.0/C-progression.md §7) |
| Sessions per week | 3 (2–6, as in the fixture) | `tests/node/sim.mjs` |
| True gain | composite +0.5 SD_comp at day 28, uniform over the four probes, following the training curve (near probes 1.0, far 0.2 SD in a ladder run) | the ME5 acceptance; the ladder split is [Assumption] |
| Verdict thresholds | P ≥ 0.975 at week 2, ≥ 0.95 at week 4 and later; "no change": P(D < 0.2 SD_comp) ≥ 0.90 from week 8 | [Proposal]; spike §5.3 |

## 5. Numeric feasibility (spike)

### 5.1 What the spike does

`docs/research/v1.2/spikes/M1/power.mjs` is standalone Node with no dependencies. It reads no app code and copies only the item-model formula and the guessing rates.
- **Part 1:** Fisher information per item for each probe format.
- **Part 2:** the analytic posterior SD of the gain at the report day for each design, assuming the model is right and items are ideal. Part 2b: what smaller detectable gains would cost.
- **Part 3:** an item-level simulation. Learners answer adaptive items with a guessing-and-lapse model; true difficulties are off by N(0, 0.3²); each learner has occasion noise, a familiarity curve and (in the gain arm) a composite gain of 0.5 SD_comp reached linearly by day 28. The design's decision rule runs after every session.

Results are deterministic for a given seed (`--seed`, default 1). Commands used for the tables below (about 2 minutes each at 1,000 learners per arm):

    node docs/research/v1.2/spikes/M1/power.mjs --n 1000 --scenarios central,optimistic,optimistic42
    node docs/research/v1.2/spikes/M1/power.mjs --n 1000 --designs A,Bplus --scenarios simPop,famBig,famSlow,famTail,famSlowRobust,wrongSlow,stateBig,twoPerWeek,skepticalPrior,optimisticFamSlow
    node docs/research/v1.2/spikes/M1/power.mjs --n 1000 --designs A,Aplus,C --scenarios milestones,milestonesFamBig,famBigWideF,milestonesOptimistic
    node docs/research/v1.2/spikes/M1/power.mjs --n 1000 --designs A,Aplus --scenarios conservativePrior,conservativePriorFamBig

**Designs in the spike:**
- D0: today's check and rule.
- D0m: today's schedule with the trend model (Design C).
- A: Design A.
- A+ (`Aplus`): A with 4.5-minute blocks.
- B: three 7.5-minute sessions per burst.
- B+ (`Bplus`): Design B, four 9-minute sessions per burst.
- C (spike id): every session gets a 5-minute block with all four probes.

**Assumption sets:**
- "Central": the parameter table, 16-item probe reliability 0.75.
- "Optimistic": the probe upgrades of §4.3 and 16-item reliability 0.85.

### 5.2 Analytic: minimal detectable gain at week 4

MDG is the composite gain (SD_comp) that 60 % of learners would show as "likely gain" at P ≥ 0.95 with a flat gain prior, model = truth, ideal items. Minutes are measurement minutes up to the report day.

| Variant | D0m | A | A+ | B | B+ | spike C |
|---|---|---|---|---|---|---|
| Minutes to day 28 | 60 | 65 | 81 | 45 | 72 | 70 |
| Central | 1.79 | 1.21 | 1.11 | 1.14 | 0.93 | 1.29 |
| No occasion noise | 1.49 | 1.11 | 1.00 | 1.05 | 0.84 | 1.20 |
| Shared day state known | 1.57 | 1.13 | 1.03 | 1.07 | 0.86 | 1.22 |
| Familiarity known exactly | 1.77 | 1.18 | 1.08 | 1.13 | 0.91 | 1.25 |
| Items ×2 information | 1.46 | 0.96 | 0.88 | 0.90 | 0.74 | 1.02 |
| Probe upgrades (§4.3) | 1.50 | 0.99 | 0.91 | 0.93 | 0.76 | 1.05 |
| 16-item reliability 0.85 | 1.46 | 0.95 | 0.88 | 0.89 | 0.74 | 1.00 |
| 16-item reliability 0.90 | 1.29 | 0.81 | 0.76 | 0.76 | 0.64 | 0.86 |
| Today's fixture population (≈ 0.55) | 2.67 | 1.88 | 1.71 | 1.79 | 1.43 | 2.01 |
| Upgrades + reliability 0.85 ("optimistic") | 1.28 | 0.80 | 0.75 | 0.75 | 0.63 | 0.85 |

Reading [Inference]:
- **Information is the bottleneck.** Knowing familiarity exactly changes the MDG by 1–3 %, removing occasion noise by 7–17 %, doubling item information by about 20 %.
- **Bursts at both ends are the most efficient per minute** (B+ at 72 minutes beats A+ at 81).
- **No design reaches an MDG of 0.5 at week 4, even when optimistic.** Required: sd(G) ≤ 0.263, i.e. MDG ≤ 0.5.
- **The analytic numbers flatter the designs.** Item-level runs (§5.3) come out 25–40 % lower in power (relative), because real blocks carry less information than ideal ones (item-difficulty error, the first items of a block aimed from a rough centre) and the weak per-block prior shrinks a little.

### 5.3 Item-level simulation at week 4

1,000 learners per arm. The table gives "likely gain" at the week-4 report, with "ever, at any look up to week 4" in brackets. In the gain arm the composite gain is 0.5 SD_comp; in the no-gain arm, 0.

| Scenario | Design | Gain arm | No-gain arm |
|---|---|---|---|
| Central | D0 (today) | 0.1 % (0.1) | 0.0 % (0.0) |
| Central | D0m | 8.3 % (8.3) | 3.4 % (3.4) |
| Central | A | 14.1 % (27.7) | 3.6 % (15.0) |
| Central | A+ | 17.0 % (32.1) | 3.1 % (13.6) |
| Central | B | 13.0 % (17.9) | 2.7 % (5.4) |
| Central | B+ | 17.6 % (24.5) | 4.5 % (7.4) |
| Central | spike C | 13.4 % (26.7) | 3.6 % (14.8) |
| Optimistic | D0 / D0m | 0.4 % / 11.7 % | 0.0 % / 3.8 % |
| Optimistic | A / A+ | 19.8 % / 24.0 % | 3.5 % / 2.8 % |
| Optimistic | B / B+ | 21.2 % / 31.7 % | 2.5 % / 4.2 % |
| Optimistic, report at day 42 | A / A+ | 32.2 % / 37.0 % | 3.2 % / 3.4 % |
| Optimistic, report at day 42 | D0m | 25.3 % | 4.0 % |

Robustness of the no-gain arm (false "likely gain" at the report, ever in brackets; designs A | B+):

| Scenario (truth differs from the model as stated) | A | B+ |
|---|---|---|
| Today's fixture population (σ_pop 0.73) | 3.8 % (14.7) | 4.1 % (6.8) |
| Familiarity plateau 0.8 SD, model assumes 0.5 | **8.1 % (23.2)** | **8.2 % (12.7)** |
| Familiarity slower (λ = 40 items), model assumes 16 | 2.9 % (12.3) | 4.7 % (6.8) |
| Familiarity keeps growing 0.03 SD per 16 items | 5.8 % (17.0) | 6.2 % (9.8) |
| Model assumes slow (λ = 40), truth fast | 4.7 % (18.1) | 4.4 % (7.6) |
| Occasion noise 0.35 SD, model assumes 0.25 | 4.6 % (16.1) | 5.3 % (8.7) |
| Two sessions a week | 3.2 % (9.9) | 4.5 % (7.4) |
| Sceptical gain prior N(0, 1 SD_comp²) | 1.1 % (1.3) | 2.1 % (3.0) |

With the sceptical prior, the gain arm falls to 5.5 % (A) and 10.2 % (B+).

Milestone guard (verdict words only at days 14 and 28, bar 0.975 then 0.95; designs A | A+ | spike C):

| Scenario | Gain arm at week 4 | No-gain arm at week 4 (ever) |
|---|---|---|
| Central | 14.1 % · 17.0 % · 13.4 % | 3.6 % (4.7) · 3.1 % (3.9) · 3.6 % (4.4) |
| Optimistic | 19.8 % · 24.0 % · 18.5 % | 3.5 % (4.3) · 2.8 % (3.7) · 3.8 % (4.6) |
| Plateau 0.8, model 0.5 | 23.2 % · 25.3 % · 21.9 % | **8.1 % (9.4) · 8.0 % (9.6) · 9.4 % (11.6)** |
| Same, with a wider plateau prior (SD 0.35) | 21.7 % · 22.5 % · 20.5 % | **7.1 % (8.4) · 7.2 % (8.5) · 8.6 % (10.6)** |
| Conservative prior (plateau 0.8), truth 0.5 | 7.9 % · 9.8 % (A, A+) | 2.1 % (2.8) · 1.6 % (2.0) |
| Conservative prior (plateau 0.8), truth 0.8 | 16.6 % · 14.6 % (A, A+) | 3.8 % (4.6) · 3.6 % (4.0) |

Reading [Inference]:
- **False positives behave once two guards are in place.** With verdicts at milestones and a correct familiarity curve, false "likely gain" stays at 3–5 %, including "ever". Without milestones, embedded designs flag 13–17 % of learners without a gain at some look.
- **The threat is a familiarity plateau larger than assumed.** It biases the estimate, and a wider prior does not remove a bias. Only a correct mean removes it: from pooled data, with a conservative 0.8 SD in the meantime, which costs about half the power when the truth is 0.5.
- **Slower familiarity is not a threat here.** The model then over-corrects.

### 5.4 Longer horizons, and the baseline as the bottleneck

Analytic MDG when the gain stops growing at week 4 (0.5 SD_comp from then on) and measurement goes on:

| Design | Week 4 | Week 6 | Week 8 | Week 12 |
|---|---|---|---|---|
| A, central | 1.21 | 0.95 | 0.85 | 0.78 |
| A+, central | 1.11 | 0.87 | 0.78 | 0.71 |
| B+, central | 0.93 | 0.93 | 0.79 | 0.74 |
| A, optimistic | 0.80 | 0.63 | 0.57 | 0.53 |
| A+, optimistic | 0.75 | 0.58 | 0.53 | 0.48 |
| B+, optimistic | 0.63 | 0.63 | 0.54 | 0.51 |

Larger baselines lift this ceiling a little. In A+ with B1 and B2 of 16 items per probe (2 × 20 minutes instead of 2 × 12), the week-8 MDG is 0.71 central and 0.49 optimistic (24 items: 0.67 and 0.47).

[Inference] Precision stops improving after week 8 because everything is compared with the early sessions, where the gain is still near zero. Two ways round this:
- invest in the baseline (longer B1/B2, or a measurement week before training starts);
- accept that a gain still growing after week 4, which is what continued training should give, becomes visible later at a larger size.

### 5.5 Verdict on the acceptance, and options for the owner

**The acceptance (ME5):** a real composite gain of 0.5 SD read as "likely gain" by ≥ 60 % of learners at week 4, with ≤ 5 % false.

**Verdict: not met by any design here.**
- Item-level simulation at week 4 tops out at 17.6 % (B+, central) and 31.7 % (B+, optimistic) with 72 minutes of measurement.
- The analytic best is 44 % (B+, optimistic).
- Under the optimistic set, the analytic cost of meeting it is about 150–160 minutes of measurement over four weeks (Part 2b: bursts of 6 sessions × 12 items per probe, MDG 0.50; 8 × 8, 0.52; 4 × 16, 0.53), i.e. 35–40 minutes a week.
- Under the central set, even 288 minutes reach only 0.60.
- The false-positive half of the acceptance is met (3–5 %) with milestone verdicts and a correct familiarity curve.

**Options** [Proposal; the owner decides]:
1. **Keep 0.5 SD, allow until week 8**, with probe upgrades and 16-item baselines. The analytic MDG at week 8 is 0.49 optimistic, but 0.71 central. This option depends on the real probe reliability, which pooled B1–B2 data can show within weeks of release.
2. **Keep week 4, a larger gain.** At week 4, "likely gain" for 60 % is reached at about 0.75–0.80 SD_comp with A/A+ (optimistic), 0.63 with B+. Central: 0.93 (B+) to 1.21 (A).
3. **Define the 0.5 SD per probe** (the usual effect size of a single test) rather than on the composite. With a between-probe correlation of 0.4 that is 0.67 SD_comp, which raises power by ×1.4–1.5: B+ optimistic 65 % analytic (about 50 % item-level), A+ 52 %.
4. **Keep everything and pay for it:** 35–40 minutes a week of measurement, at the optimistic set only.
5. **Rung-specific targets.** Near probes (§7) should move most, so "visible within weeks" is most realistic there. A near rung of two 4-option probes with 4 items each per block (about 2.5 minutes, 43 minutes to day 28) has an analytic MDG of 1.23 per-probe SD at week 4 and 0.95 at week 6 (central), or 0.79 and 0.61 (optimistic). One person's near gain therefore shows within 4–6 weeks if near gains reach about 1 SD of the probe, which is plausible if near transfer is a sizeable share of the trained-task gains [Inference; the ladder run of §8 should test it]. Mid and far rungs get their verdicts later, and their real test is pooled data.

**Recommended acceptance for the engine sim:**
- Report the MDG at weeks 4 and 8 for each run, and the false "likely gain" rates at report and ever.
- Pass if the false rates are ≤ 5 % (central) and ≤ 10 % (misspecified familiarity).
- Pass if the MDG at week 8 is ≤ 0.5 SD_comp under the optimistic set, with the real probe reliability substituted as soon as pooled data give it.

## 6. The owner's two decisions

### 6.1 How much time measurement may take

**Recommendation** [Proposal]:
- **The default: about 13 minutes a week**, measured inside training. A 3.5-minute no-feedback block at the start of every training session (at most four a week), a 10-minute check every 4 weeks, and two 10-minute baselines in sessions 1 and 2. At three 20-minute sessions a week this is about a fifth of training time.
- **The opt-in measurement week:** 36 minutes in that week, every 4 weeks.

**Reasons:**
- **Many short occasions beat few long ones.** A session's score varies within a person by half or more of the between-person spread (Salthouse 2007), and only averaging over occasions removes the state part. Averages of many brief sessions reach .95–.97 reliability (Sliwinski et al. 2018; Hakun et al. 2023).
- **Returns per minute fall off.**
  - From 65 to 81 minutes over 4 weeks (A → A+), the MDG improves by 8 %.
  - Reaching the acceptance at week 4 would take about 150–160 minutes (optimistic), 35–40 a week: more than half the training time.
  - Today's 8 minutes a week in two long checks gives the least: the MDG is 1.79, against 1.21 for A.
- **Brief sessions are kept up.** 97.5 % of short sessions were completed in Brewster et al. 2021, 80 % adherence in Nicosia et al. 2023. A fixed 3.5-minute slot is predictable, and the meter rewards it with a visible update.

**Trade-offs:** more minutes give an earlier verdict for some players but take training time and fun. Fewer minutes (Design C) leave the meter nearly still for months, which is the problem the owner named. Bursts are the most precise per minute but concentrate the effort and update the meter only every 4 weeks; hence opt-in.

### 6.2 First baseline: before any play, or after a short tutorial

**Recommendation** [Proposal]: the first baseline right after the two-minute tutorial of the first exercise, before any rated training.
- B1 is short (about 10 minutes, 8 items per probe), with each probe's worked example before its first item, as now.
- B2 comes at the start of session 2, before rated items.
- If a player skips B1 ("Later"), the next session opens with it, and the report says that the baseline came after some training. The model handles it through h(t), at a cost in precision.

**Reasons:**
- **The two-minute start rule:** a 10–15-minute test before any play delays the first win. A two-minute tutorial adds a negligible training dose before B1.
- **First contact with an app inflates the first measurement.** Scharfen et al. 2018 attribute retest gains largely to less unfamiliarity, anxiety and rule incomprehension. The tutorial takes interface learning out of B1, so less of the familiarity curve has to be modelled.
- **Baselines before rated training** keep training gains out of the baseline window, which the gap audit flags today (ME2).
- **The baselines limit all later precision** (§5.4). Two 10-minute baselines in the first two sessions are worth their cost at weeks 6–12; 16-item baselines would be better still for long horizons, at 2 × 20 minutes.

**Trade-offs:**
- **A baseline before any play:** "purer", but it mixes interface learning into B1, so the B1→B2 step contains more familiarity, and it slows the start.
- **An optional, later baseline** (as now): the fastest start, but the baseline may come after training gains have begun. The person's familiarity and early gains are then harder to tell apart, and long-horizon precision falls.

## 7. The near/mid/far ladder

[Found in the repo] `docs/dev/DESIGN-PLAN.md` §4 and the guide call Cube Match, View Match and Pattern Memory "mid", and Mechanisms and Level "kinds no exercise trains". The guide marks near as "not measured here" and far as "cited from research". The gap audit (ME1) asks for a near and a far probe.

**Where each existing probe sits** [Inference, using Barnett & Ceci's content/context distances as summarised in docs/research/v1.0/C-progression.md §8]:

| Probe | Ability | Trained neighbours | Rung |
|---|---|---|---|
| Cube Match (PR-1) | Vz, cube surfaces under rotation | Nets (unoriented marks), Rotate, Painted Cubes | **mid, at the near edge**: same objects and operation as Nets plus Rotate, new response format |
| View Match (PR-2) | perspective taking | Orient (map pointing), Views and Missing View (orthographic views) | **mid** |
| Pattern Memory (PR-4) | visual memory of a static pattern | Span (sequences) | **mid** (another memory format) |
| Mechanisms (PR-3) | mental animation of gears, belts, pulleys | none | **far end of the in-app ladder**: another ability, applied mechanical content |
| Level (PR-5, optional) | water level and plumb line | none | **far-ish**: applied physical reasoning; performance also depends on knowing the physical rule, so a gain here mixes knowledge and spatial skill |
| Word Links (PR-0) | verbal analogies | none | control, off the ladder |

Inside one app, "far" can only mean far in content and function (an applied domain, another response mode), never in physical or social context, time, or modality in the full Barnett & Ceci sense. The guide should keep the life-outside-the-app rung as "cited from research".

**Candidates for the near rung** (untrained alternate formats of trained skills; original and solver-checkable; probe-design detail is the transfer agent's):
- **Cube to net**, the reverse of Nets: which net folds into this marked cube. Solver: fold each candidate and compare face adjacency and orientation.
- **Forward rotation result**, near Rotate and Spin: which of four views shows the object after the stated turn. Or set the orientation with a dial, a continuous answer that carries more information. Solver: rotate the voxel set; distractors are the mirror image, the wrong axis and the wrong angle (chirality-checked).
- **Solid from section**, the reverse of Slice: which solid, cut as shown, gives this section.
- **Folded outcome**, near Fold: which shape the folded sheet forms (forward folding to a 3D result) rather than where the holes go.

Each must avoid the formats it is "near" to: no PAT formats, no Mental Rotations Test, PSVT:R or Paper Folding clones (CLAUDE.md rule 3).

**Candidates for the far rung** (applied spatial problems in domains no exercise trains):
- **Mechanics beyond Mechanisms:** levers and balances (which way the beam tips), a ball on a track (where it stops). Solver: exact rules or a small simulation.
- **Shadows and mirrors:** where a shadow falls for a given light, which part of a scene is visible in a mirror. Solver: ray geometry.
- **Map problems:** the turn sequence that reaches a goal on a map, which landmark is visible from a point. Solver: graph search and visibility. Homing and Reckon train path integration, so this sits mid–far.
- **Solid geometry counts:** faces, edges and vertices after a cut. Solver: polyhedral geometry. Keep it spatial rather than arithmetic.

**Measurement requirements for new probes** [Proposal; from §2–§5]:
1. **Information per minute:**
   - at least 0.13 Fisher information per item at the target (4 options or more, or partial or continuous scoring);
   - about 12 s per item or less;
   - an LLTM item model with stated features;
   - shortcut solvers within chance + 10 points (CLAUDE.md rule 5).
2. **At least two probes per rung**, so that each rung composite averages out probe-specific variance. Rotate probes within a rung across blocks, keeping each block at 3.5–4.5 minutes in total.
3. **Every rung on the same schedule and in the same blocks**, so that state and test-taking familiarity are shared. The per-person transfer gradient (near − mid − far) is then interpretable, and pooled data can estimate it precisely.
4. **Each near probe tagged with the trained exercises it is near to.** The Lab crossover then becomes a within-person multiple-baseline contrast (§3.4), and the bet tags of the gap audit (T1, T2) can use it.
5. **A pilot before verdicts.** A new probe's familiarity curve and B1–B2 reliability come from pooled data first. Until then its results are shown as "measuring", without verdict words.
6. **A new version on any format change** (`id@version`), never mixed with old data in one trend.
7. **Expect the ladder to show in what moves, not in one number.** Near gains should be visible for some people within 4–6 weeks (§5.5 option 5). Far probes will read "unclear" for most individuals by design; their test is the pooled gradient.

## 8. What the engine simulation should implement

[Proposal] For the separate step that changes `tests/node/sim.mjs`, `tests/node/fixtures/learner.mjs` and `js/engine/assess.js`. Defaults are those of §4.4.

**1. The probe learner model** (replacing the check-index retest R·[0, 1, 1.5]):

    θ_p(item) = θ0_p + G_p·h(t) + F_p·(1 − exp(−n_p/λ)) + tail·n_p/16 + u_day + s_p,day

- θ0_p ~ σ_pop·(√ρ·z_general + √(1 − ρ)·z_p), with σ_pop configurable (1.15 logits; runs at 0.73 and 1.58) and ρ = 0.4.
- n_p counts that probe's items answered before this one, over all occasions.
- Familiarity amplitudes:
  - F_p = σ_pop·(0.5 + 0.2·z), correlated 0.5 among the spatial probes;
  - F_c = σ_pop·(0.3 + 0.2·z) for Word Links, correlated 0.3 with the spatial ones;
  - λ = 16 items, tail 0.
- u_day ~ N(0, (0.18·σ_pop)²) is shared by every probe and the control that day; s_p,day ~ N(0, (0.18·σ_pop)²).
- G_p is set so that the composite gain at day 28 is 0.5 SD_comp, with SD_comp = σ_pop·√((1 + 3ρ)/4). h(t) = gainSoFar(t) / gainSoFar(day 28), the learner's own training curve.
- Three gain runs:
  - `check-none` (G = 0);
  - `check-gain` (uniform 0.5 SD_comp);
  - `check-ladder` (near 1.0, mid 0.5, far 0.2 per-probe SD), once near and far probes exist.
- **Probe response times:** median × exp(0.25(b − θ)) × exp(−0.3·(1 − exp(−n_p/λ))) × lognormal(0, 0.35). Probes need their own speed familiarity; today they never speed up.

**2. The engine** (`assess.js`):
- **Embedded blocks.** A `check` plan of kind `block`: 3 items per composite probe and 2 control items, no feedback, at the start of a training session. The engine offers it per Design A's rules: from session 3, at most four a week, replaced by the 4-weekly check.
- **Targeting:** each block aims its items under a prior centred on the person's running estimate for that probe (SD 1.5). Store the block's likelihood summary (θ̂ and SE with a weak prior, SD 3) beside today's posterior summary.
- **The shared model of §4:** a pure function over `rec.assess` that returns the posterior of the gain to date (mean, SD, P(D > 0)) for the composite and per rung. It uses generalised least squares with the per-session Sherman–Morrison step and an 11-parameter solve (more with more probes), and needs the items seen per probe for φ̄.
- **The population familiarity prior** sits in `config.assess`: plateau, SD, λ and correlations, with the conservative plateau 0.8 SD until pooled data replace it.
- **Milestone verdicts and the meter:** P ≥ 0.975 at week 2, ≥ 0.95 at week 4 and later; "likely no change" from week 8.
- **Forms:** randomise the starting form per record.
- **Sessions:** keep the rule that a check never counts as a training session. Decide whether block time counts toward the weekly goal (recommended: it does not).

**3. Runs and reports** (`sim.mjs`). Designs A (default), A+, B (opt-in) and C (fallback), with today's D0 for reference. Scenarios:
- central;
- fixture population (σ_pop 0.73);
- familiarity plateau 0.8 with the model at 0.5;
- familiarity tail 0.03;
- occasion noise 0.35;
- 2 and 6 sessions a week;
- the optimistic set.

Report at weeks 2, 4, 6 and 8:
- "likely gain" at the report and ever, in the gain and no-gain arms;
- "likely no change" in both;
- MDG = 1.898 × the median posterior SD of the gain;
- coverage of the 95 % interval of the gain to date (target 93–97 %);
- the distribution of (D̂ − D_true)/SD (target mean 0, SD 1);
- measurement minutes per week;
- record size.

**4. Hard checks** (exit code 1):
- false "likely gain" ≤ 5 % at each report (central, every design) and ≤ 6 % ever;
- ≤ 10 % at the report under the misspecified-familiarity run;
- coverage within 92–98 %.

**5. Reported against the owner's target**, not a hard check until the owner restates the acceptance (§5.5):
- the share of the gain arm reading "likely gain" at weeks 4 and 8;
- the MDG at weeks 4 and 8.

**6. Cross-check:** the engine sim's numbers for Design A (central) should land within a few points of this spike's Part 3 (14 % gain arm, 3.6 % no-gain arm at week 4). A large difference means one of the two is wrong.

## 9. Open risks

1. **The probes' real reliability and population spread are unknown**, and they decide whether the central or the optimistic numbers apply. Measure them from pooled B1–B2 and block data in the first weeks after release (O16), and recompute the MDG.
2. **The familiarity plateau.** If it is larger than the prior, false "likely gain" rises to 8–9 % at the report (spike). It needs pooled data, ideally from a randomised staggered start; until then the conservative prior, which halves the power.
3. **The unit of familiarity.** Counting it in items is a modelling choice. Familiarity may also depend on sessions and sleep, and it may dip after breaks. Very frequent players (6 a week) reach the plateau sooner, which the item count handles but a session clock would not.
4. **Embedded blocks change the session.** 3.5 minutes without feedback at the start of each session may cost fun and retention. Players may also learn from the probes by exposure, and expectation effects may grow once they watch the meter (Foroughi et al. 2016, cited in the guide). Keep the wording neutral, keep Word Links, and log the expectation question as today.
5. **The shape of the gain.** The model ties the gain to the training curve. If transfer does not follow training (it lags, or appears only after a while), "gain to date" is a model quantity and early milestones under-read it.
6. **The meter between milestones** will sometimes pass 95 % for a player without a gain. The words wait for the milestone; the app must say why, or players will read the meter as the verdict.
7. **Probe upgrades break comparability.** A new format is a new version with its own familiarity curve and calibration; never mix versions in one trend.
8. **The spike's analytic numbers are optimistic** by 25–40 % in power against its own item-level runs; real blocks may carry less information still. The engine sim must simulate items, not use the formula.
9. **The acceptance itself must be pinned down:** SD of the composite or per probe, which population, which week. Results differ by ×1.4–1.5 between definitions.
10. **Display units.** "SD" needs a population SD that only pooled data can give. Until then show probe points and words. Never IQ, an index, a percentile, a norm or a brain age.

## References

Read depth in brackets. Links are to the copy that was read where it differs from the DOI.

- Bartels, C., Wegrzyn, M., Wiedl, A., Ackermann, V., & Ehrenreich, H. (2010). Practice effects in healthy adults: A longitudinal study on frequent repetitive cognitive testing. *BMC Neuroscience, 11*, 118. https://doi.org/10.1186/1471-2202-11-118 (PMC2955045) [full text]
- Bolsinova, M., & Tijmstra, J. (2018). Improving precision of ability estimation: Getting more from response times. *British Journal of Mathematical and Statistical Psychology, 71*(1), 13–38. https://research.tilburguniversity.edu/en/publications/improving-precision-of-ability-estimation-getting-more-from-respo/ [abstract only]
- Brandmaier, A. M., von Oertzen, T., Ghisletta, P., Lindenberger, U., & Hertzog, C. (2018). Precision, reliability, and effect size of slope variance in latent growth curve models: Implications for statistical power analysis. *Frontiers in Psychology, 9*, 294. https://doi.org/10.3389/fpsyg.2018.00294 [full text]
- Brewster, P. W. H., Rush, J., Ozen, L., Vendittelli, R., & Hofer, S. M. (2021). Feasibility and psychometric integrity of mobile phone-based intensive measurement of cognition in older adults. *Experimental Aging Research, 47*(4), 303–321. https://pmc.ncbi.nlm.nih.gov/articles/PMC8225552 [full text]
- Dutilh, G., Vandekerckhove, J., Tuerlinckx, F., & Wagenmakers, E.-J. (2009). A diffusion model decomposition of the practice effect. *Psychonomic Bulletin & Review, 16*(6), 1026–1036. https://doi.org/10.3758/16.6.1026 (https://dare.uva.nl/id/4f7d29f0-f49b-41ca-a33b-124638bef880) [abstract only]
- Falleti, M. G., Maruff, P., Collie, A., & Darby, D. G. (2006). Practice effects associated with the repeated assessment of cognitive function using the CogState battery at 10-minute, one week and one month test-retest intervals. *Journal of Clinical and Experimental Neuropsychology, 28*(7). https://doi.org/10.1080/13803390500205718 [abstract only, on the publisher's listing at cogstate.com]
- Gavett, B. E., Ashendorf, L., & Gurnani, A. S. (2015). Reliable change on neuropsychological tests in the Uniform Data Set. *Journal of the International Neuropsychological Society, 21*(7). https://escholarship.org/content/qt7p29b9s3/qt7p29b9s3.pdf [full text]
- Goldberg, T. E., Harvey, P. D., Wesnes, K. A., Snyder, P. J., & Schneider, L. S. (2015). Practice effects due to serial cognitive assessment: Implications for preclinical Alzheimer's disease randomized controlled trials. *Alzheimer's & Dementia: Diagnosis, Assessment & Disease Monitoring, 1*. https://doaj.org/article/102a2a1dd120448ab7e9c1a394e47325 (PMC4876902) [abstract only]
- Hakun, J. G., Roque, N. A., Gerver, C. R., & Cerino, E. S. (2023). Ultra-brief assessment of working memory capacity: Ambulatory assessment study using smartphones. *JMIR Formative Research, 7*, e40188. https://doi.org/10.2196/40188 (PMC9919550) [full text]
- Hausknecht, J. P., Halpert, J. A., Di Paolo, N. T., & Moriarty Gerrard, M. O. (2007). Retesting in selection: A meta-analysis of coaching and practice effects for tests of cognitive ability. *Journal of Applied Psychology, 92*(2), 373–385. https://doi.org/10.1037/0021-9010.92.2.373 (https://ecommons.cornell.edu/server/api/core/bitstreams/4fbba765-0d9c-4940-8492-66fecaca5227/content) [full text]
- Heathcote, A., Brown, S., & Mewhort, D. J. K. (2000). The power law repealed: The case for an exponential law of practice. *Psychonomic Bulletin & Review, 7*(2), 185–207. https://www.scilit.net/publications/7f26eee4559e0cdfd6fd47e295509725 [abstract only]
- Hedge, C., Powell, G., & Sumner, P. (2018). The reliability paradox: Why robust cognitive tasks do not produce reliable individual differences. *Behavior Research Methods, 50*, 1166–1186. https://orca.cardiff.ac.uk/id/eprint/102138/ [abstract only]
- Klein Entink, R. H., Fox, J.-P., & van der Linden, W. J. (2009). A multivariate multilevel approach to the modeling of accuracy and speed of test takers. *Psychometrika, 74*(1), 21–48. https://doi.org/10.1007/s11336-008-9075-y (PMC2792348) [full text, partial]
- Kratochwill, T. R., Hitchcock, J., Horner, R. H., Levin, J. R., Odom, S. L., Rindskopf, D. M., & Shadish, W. R. (2010). *Single-case designs technical documentation*. What Works Clearinghouse. https://files.eric.ed.gov/fulltext/ED510743.pdf [full text]
- Lerche, V., Voss, A., & Nagler, M. (2017). How many trials are required for parameter estimation in diffusion modeling? A comparison of different optimization criteria. *Behavior Research Methods, 49*, 513–537. https://doi.org/10.3758/s13428-016-0740-2 [full text, partial]
- Liesefeld, H. R., & Janczyk, M. (2019). Combining speed and accuracy to control for speed-accuracy trade-offs(?). *Behavior Research Methods, 51*, 40–60. https://doi.org/10.3758/s13428-018-1076-x (https://epub.ub.uni-muenchen.de/81857/) [abstract only]
- Maris, G., & van der Maas, H. L. J. (2012). Speed-accuracy response models: Scoring rules based on response time and accuracy. *Psychometrika, 77*(4), 615–633. https://dare.uva.nl/id/257c9569-e69c-466b-b813-c48c1e65942c [abstract only]
- Nicosia, J., Aschenbrenner, A. J., Balota, D. A., et al. (2023). Unsupervised high-frequency smartphone-based cognitive assessments are reliable, valid, and feasible in older adults at risk for Alzheimer's disease. *Journal of the International Neuropsychological Society*. https://doi.org/10.1017/S135561772200042X (PubMed 36062528) [abstract only]
- Oravecz, Z., Harrington, K. D., Hakun, J. G., Katz, M. J., Wang, C., Zhaoyang, R., & Sliwinski, M. J. (2022). Accounting for retest effects in cognitive testing with the Bayesian double exponential model via intensive measurement burst designs. *Frontiers in Aging Neuroscience, 14*, 897343. https://doi.org/10.3389/fnagi.2022.897343 [full text; equations did not render]
- Ranger, J. (2013). A note on the hierarchical model for responses and response times in tests of van der Linden (2007). *Psychometrika, 78*(3), 538–544. https://ideas.repec.org/a/spr/psycho/v78y2013i3p538-544.html [abstract only; the bound's form from Wang, Weiss & Su 2019]
- Reis Costa, D., Bolsinova, M., Tijmstra, J., & Andersson, B. (2021). Improving the precision of ability estimates using time-on-task variables: Insights from the PISA 2012 computer-based assessment of mathematics. *Frontiers in Psychology, 12*, 579128. https://doi.org/10.3389/fpsyg.2021.579128 [full text]
- Salthouse, T. A. (2007). Implications of within-person variability in cognitive and neuropsychological functioning for the interpretation of change. *Neuropsychology, 21*(4), 401–411. https://pmc.ncbi.nlm.nih.gov/articles/PMC3838958 [full text, author manuscript]
- Salthouse, T. A., & Tucker-Drob, E. M. (2008). Implications of short-term retest effects for the interpretation of longitudinal change. *Neuropsychology, 22*(6), 800–811. https://labs.la.utexas.edu/tucker-drob/files/2015/02/Salthouse-Tucker-Drob-2008-NP-Implications-of-short-term-retest-effects-for-longitudinal-change.pdf [full text]
- Scharfen, J., Jansen, K., & Holling, H. (2018). Retest effects in working memory capacity tests: A meta-analysis. *Psychonomic Bulletin & Review, 25*, 2175–2199. https://doi.org/10.3758/s13423-018-1461-6 [full text, partial]
- Scharfen, J., Peters, J. M., & Holling, H. (2018). Retest effects in cognitive ability tests: A meta-analysis. *Intelligence, 67*, 44–66. https://doi.org/10.1016/j.intell.2018.01.003 [full text, partial: retest effects and moderators; read from a PDF copy]
- Schönbrodt, F. D., Wagenmakers, E.-J., Zehetleitner, M., & Perugini, M. (2017). Sequential hypothesis testing with Bayes factors: Efficiently testing mean differences. *Psychological Methods, 22*(2), 322–339. https://dare.uva.nl/id/064bbe12-23f8-4bae-b43a-e8007477670e [abstract only]
- Sliwinski, M. J., Smyth, J. M., Hofer, S. M., & Stawski, R. S. (2006). Intraindividual coupling of daily stress and cognition. *Psychology and Aging, 21*(3), 545–557. https://doi.org/10.1037/0882-7974.21.3.545 (PMC2879634) [full text, partial]
- Sliwinski, M. J., Mogle, J. A., Hyun, J., Munoz, E., Smyth, J. M., & Lipton, R. B. (2018). Reliability and validity of ambulatory cognitive assessments. *Assessment, 25*(1), 14–30. https://doi.org/10.1177/1073191116643164 (PubMed 27084835) [abstract only]
- Smith, A. C., Frank, L. M., Wirth, S., Yanike, M., Hu, D., Kubota, Y., Graybiel, A. M., Suzuki, W. A., & Brown, E. N. (2004). Dynamic analysis of learning in behavioral experiments. *Journal of Neuroscience, 24*(2), 447–461. https://www.academia.edu/18581240/Dynamic_Analysis_of_Learning_in_Behavioral_Experiments [full text]
- Stafford, T., Pirrone, A., Croucher, M., & Krystalli, A. (2020). Quantifying the benefits of using decision models with response time and accuracy data. *Behavior Research Methods, 52*(5), 2142–2155. https://eprints.whiterose.ac.uk/id/eprint/159747/1/Stafford2020_Article_QuantifyingTheBenefitsOfUsingD.pdf [full text]
- Tamburri, N., McDowell, C., & MacDonald, S. W. S. (2022). Parameterizing practice in a longitudinal measurement burst design to dissociate retest effects from developmental change: Implications for aging neuroscience. *Frontiers in Aging Neuroscience, 14*, 885621. https://doi.org/10.3389/fnagi.2022.885621 [full text]
- Uttal, D. H., Meadow, N. G., Tipton, E., Hand, L. L., Alden, A. R., Warren, C., & Newcombe, N. S. (2013). The malleability of spatial skills: A meta-analysis of training studies. *Psychological Bulletin, 139*(2), 352–402. https://doi.org/10.1037/a0028446 (https://groups.psych.northwestern.edu/uttal/documents/1Themalleabilityofspatialskills-Ametaanalysisoftrainingstudies1_001.pdf) [full text, partial: results and discussion on control groups and design]
- van der Linden, W. J. (2008). Using response times for item selection in adaptive testing. *Journal of Educational and Behavioral Statistics, 33*(1), 5–20. https://research.utwente.nl/en/publications/using-response-times-for-item-selection-in-adaptive-testing/ [abstract only]
- Wang, C., Weiss, D. J., & Su, S. (2019). Modeling response time and responses in multidimensional health measurement. *Frontiers in Psychology, 10*, 51. https://doi.org/10.3389/fpsyg.2019.00051 [full text]

Cited at second hand from this repository's own notes (not re-read here):
- Barnett & Ceci 2002 (https://doi.org/10.1037/0033-2909.128.4.612), via docs/research/v1.0/C-progression.md §8.
- Wright, Thompson, Ganis, Newcombe & Kosslyn 2008 (https://doi.org/10.3758/PBR.15.4.763), via C-progression §7.
- Foroughi et al. 2016 (https://doi.org/10.1073/pnas.1601243113), via the guide.
- Willett 1989, via Brandmaier et al. 2018.

## Could not open

| Source | What I needed from it | Assumption used meanwhile |
|---|---|---|
| Jacobson, N. S., & Truax, P. (1991). *Journal of Consulting and Clinical Psychology, 59*(1), 12–19 (no link reached; the DOI I remember is 10.1037/0022-006X.59.1.12, unverified) | The exact reliable change index and its use | The index as commonly stated: the difference divided by √2·SEM, judged against z = 1.645 (90 %) or 1.96 (95 %) |
| Chelune, G. J., et al. (1993). *Neuropsychology, 7*(1), 41–52 (no link reached) | The practice-adjusted RCI | The mean practice effect is subtracted before the RCI, as today's check does with a per-person estimate |
| Duff, K. (2012). Evidence-based indicators of neuropsychological change in the individual patient. *Archives of Clinical Neuropsychology, 27*(3), 248–261. https://pmc.ncbi.nlm.nih.gov/articles/pmid/22382384 (a browser check blocked the page) | A review of RCI and regression-based change methods, and advice for serial testing | Gavett et al. 2015 and Salthouse & Tucker-Drob 2008 cover what this note uses |
| Calamia, M., Markon, K., & Tranel, D. (2012). Scoring higher the second time around. *The Clinical Neuropsychologist, 26*(4), 543–570. https://doi.org/10.1080/13854046.2012.680913 | Practice effects by test domain (visuospatial) and their moderators | Bracketed by Scharfen et al. 2018, Hausknecht et al. 2007 and Bartels et al. 2010 |
| Sliwinski et al. (2018), full text. https://doi.org/10.1177/1073191116643164 | The practice curve over its protocol, the sessions per person and the variance components | The burst studies read in full (Brewster 2021; Oravecz 2022; Hakun 2023) describe the same family of protocols |
| Terlecki, M. S., Newcombe, N. S., & Little, M. (2008). Durable and generalized effects of spatial experience on mental rotation. *Applied Cognitive Psychology, 22*, 996–1013. https://doi.org/10.1002/acp.1420 | How much a test-only group gains over many repeated mental-rotation tests across weeks: the closest analogue to repeated probe blocks | Spatial familiarity may keep growing; covered by the spike's `famTail` and `famBig` scenarios |
| Beglinger, L. J., et al. (2005). Practice effects and the use of alternate forms in serial neuropsychological testing. *Archives of Clinical Neuropsychology, 20*, 517–529 (no link reached) | Alternate forms against practice in serial testing; the dual-baseline evidence | As Scharfen et al. 2018: alternate forms delay familiarity but do not prevent it |
| Sliwinski, M. J. (2008). Measurement-burst designs for social health research. *Social and Personality Psychology Compass, 2*(1), 245–261 (not reached) | The rationale and planning rules of burst designs | Salthouse 2007 and the ambulatory studies |
| Maris & van der Maas (2012), full text; and the paper on the discretised signed-residual-time model, https://pmc.ncbi.nlm.nih.gov/articles/PMC8359328 (blocked by a browser check) | Information per item under time-limit scoring, as used in adaptive learning systems | Not used for probes (it changes the construct) |
| Small-sample equating (synthetic linking, circle-arc) and random-item IRT (not searched: the session's search budget ran out) | Methods for equating forms with little data | Forms are generated from one item model and equated through it; seed-stream or form offsets are estimated later as random effects from pooled data |
| An N-of-1 trial guide for health research (not searched: search budget) | Practical design rules for individual trials | The WWC single-case standards cover the rules this note needs |
| Published reliabilities of short spatial tests (mental rotation, perspective-taking, PSVT:R manuals or Rasch analyses; not searched: search budget) | An anchor for the 16-item probe reliability | 0.75 central (range 0.55–0.90), to be replaced by B1–B2 reliabilities from pooled exports |
