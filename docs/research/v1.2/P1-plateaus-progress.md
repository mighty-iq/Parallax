# P1: Plateaus, stall detection, stall-breaking, multi-dimensional difficulty, progression modes

Phase 1 research notes for Parallax v1.2, written 2026-11-18 (UTC). Status: complete; a draft for the lead's plan. **Addendum 2026-11-18** (at the end): the full text of Rijmen & De Boeck (2002) and a rerun of the per-dimension simulation with uneven profiles like theirs.

Labels used throughout:
- **[Found]**: what a study or source reported (sample, design, effect size where given).
- **[Inference]**: my reading of what that means for Parallax.
- **[Proposal]**: a design proposal for the lead to accept, change or drop.

How much of each source was read is marked as *full text*, *abstract only*, or *secondary (named)*. "Metadata only" means I saw the bibliographic record and nothing of the argument. The source list at the end gives DOIs or URLs. Numbers marked "my calculation" are mine, not a source's.

## 0. Scope and starting point (repository context)

What the owner's standing rules ask, in paraphrase (they are kept outside this repository): the default mode should hold difficulty at the edge of the player's ability on every dimension that matters, not with one staircase on one number, so that a motivated beginner feels real gains early. The tool should detect a stall from the training log, change something for a stated reason and tell the player what changed and why; encouragement alone does not count. Several progression modes share one learner record, the default needs no setup, and the app says plainly when each mode is the right one.

What the engine already has (read in `docs/dev/ENGINE.md` §1–8 and `js/engine/`):
- **One Gaussian rating per exercise** (μ, σ; per screen class for some), updated by moment matching after each rated answer, with process noise 0.002 per answer and 0.01 per idle day (`js/engine/estimator.js`). Item difficulty is an LLTM sum of hand-set steps per dimension level (`js/engine/model.js`).
- **Items aim at p\* = g + (1 − g)·k** (k = 0.85 / 0.70 / 0.55), in decks of 10: 8 target, 1 easier, 1 stretch, plus two warm-ups (`js/engine/modes.js` `kindFor`). Among candidates within ±0.05 of the target, variety decides (`js/engine/select.js`).
- **Weak spots**: a running mean of (x − p) per dimension level (exact for 30 answers, then an exponential average), flagged when the mean is below −0.10, z < −2 and n ≥ 15; a weak level then supplies the item on 20 % of target picks (`select.js` `residual`, `weak`; `config.weak`). Only weak levels are acted on; strong levels are not.
- **Learning progress** for the Train bandit: (μ now − μ 60 rated answers ago) / √(σ²now + σ²then), clipped to ±2, from snapshots every 10 rated answers (last 13 kept) (`js/engine/bandit.js`). It is computed on the rating because success is held at the target.
- **Interleaving stages** S1–S5 per exercise: up one stage at session end once n ≥ 40 and σ ≤ 0.45; back one when the last 20 trials right after a switch fall more than 0.10 below prediction (`js/engine/schedule.js` `stageUp`, `switchNote`). These changes are computed but not shown (gap audit PB3).
- **Path** (10 blocked stages with a moving-average gate and a model gate), **Threshold** (staircases on one parameter), **Speed** (deadline staircase on items answered ≥ g + (1 − g)·0.85 untimed; opens after a passed Path stage or ≥ 60 answers with σ ≤ 0.45), **Free play** (never rated).
- **Strategy check-ins** ('whole' / 'parts' / 'unsure') after the 10th rated answer of an exercise in a Train or Path session, at most once per 14 days (`modes.js` `checkin`, `checkinDue`); within a session, two misses in a row offer a strategy card (gap audit PB2).
- **The trial log** keeps, per answer: time, exercise, mode, settings code, seed, outcome, response time, value, predicted success (‰), stage, display and input (`ENGINE.md` §15). The rating keeps a per-day history `[day, μ, σ]` and 13 snapshots. Everything a stall detector needs is already logged; nothing new has to be recorded except the plateau events themselves.
- **Level scale** (my calculation from the real exercise definitions): most exercises span about 4 logits, so 1 logit ≈ 24 levels (Track ≈ 11, Span ≈ 14, Knots and Reckon ≈ 19, the PAT-format Hole Punch ≈ 37). A rating σ of 0.35 is ±8 levels; its 95 % range is about ±17 levels.

The gap audit (`docs/dev/v1.2/standing-rules-gap.md`) rates plateau-breaking MISSING (PB1 detect, PB2 change, PB3 tell), "every dimension" PARTLY (P1: one rating; strong dimensions are never pushed beyond it; Train is untimed) and "when each mode is right" PARTLY (M3: the app says what each mode does, not when to use it). Its draft detector (PB1; also `docs/dev/PLAN-v1.2.md` milestone 3) fires on any of: learning progress near zero over ≥ 60 rated answers in ≥ 3 sessions; a level change inside its noise band over two weeks; a Path stage not passed after N sessions. Milestone 3's acceptance: plateaued learners flagged within a stated window, improving learners flagged at most 5 % of the time. Section 2 tests the draft rules against that acceptance. `docs/dev/v1.2/deferred-sweep.md` mentions plateaus only for the Chimera invitation (O3).

`docs/research/v1.0/C-progression.md` (C below) already covers optimal difficulty, staircases, Elo and Glicko, LLTM, ZPDES, mastery criteria, interleaving, contextual interference, variability, spacing and speed scoring. These notes build on it and do not repeat it; a "C §n" reference points there.

## 1. Are plateaus real? (Q1)

### 1.1 What studies found

- **[Found] Averaging manufactures smooth curves.** Heathcote, Brown & Mewhort (2000; full text, first ~75 % read) refit 40 data sets (7,910 learning series, 475 people, 24 experiments). For unaveraged series the exponential beat the power function in 82 % of series; averaging curves with different learning rates biases the average toward a power function, because fast learners dominate early and slow learners late. The relative learning rate stayed constant (exponential) in most series rather than declining as a power law predicts. Gallistel, Fairhurst & Balsam (2004; full text) found individual acquisition curves in six animal paradigms to be abrupt steps (e.g., 22–56 % of pigeons went from negligible to near-asymptotic responding in one trial) while group averages looked gradual; after acquisition, performance was unstable (56 of 105 pigeons had at least one significant drop).
- **[Found] Individual curves have pieces, and transitions start with a dip.** Donner & Hardy (2015; full text) fit 25,280 individual curves (first 500 plays of four Lumosity tasks, 22,460 people). Piecewise power laws beat a single power law (noise-subtracted variance explained 90.7 % vs 86.0 %; the pieces explained about a third of what the single curve left). Two or three pieces were typical. At a transition, scores dropped right after it in 78 % of cases, and within 50 plays the new piece was above the old one in over 80 %, with a higher asymptote. The median first piece lasted about 125 plays (2–3 months). Averaged curves fitted one power law with R² > .99. The authors read the transitions as possible strategy shifts but did not identify strategies.
- **[Found] Delayed starts are common.** Evans, Brown, Mewhort & Heathcote (2018; full text, repository copy) found a delayed exponential (a slow initial period, then faster improvement) selected in 11 of 17 data sets, linked to a shift from algorithm to retrieval; in Rickard's data sharp transitions appeared in 71 % of practice series.
- **[Found] Improvement is strategy-specific.** Delaney, Reder, Staszewski & Ritter (1998; full text) showed that, for individuals, practice functions fitted per strategy described the data better than one function across strategies in every comparison. Shifts were not one-way: people switched back and forth over roughly 42–52 % of trials, and a newly adopted strategy started slower than the practised one.
- **[Found] Plateaus and dips precede leaps.** Gray & Lindstedt (2017; abstract only) review plateaus in psychology, HCI and cognitive science, reanalyse two classic individual-performance studies in which plateaus and dips came before leaps, and apply changepoint analysis to a third data set. They read dips as exploration of new methods and leaps as a successful method taking hold.
- **[Found] Stable suboptimal performance.** Fu & Gray (2004; abstract only): experienced users keep inefficient but general, step-by-step procedures because each step costs little effort and gives immediate visible feedback; performance settles at a stable, suboptimal level. Yechiam, Erev, Yehene & Gopher (2003; abstract only): trainees fall back on visually guided typing because it pays off immediately (melioration); making looking costly through a secondary task improved retention of touch typing (22 students).
- **[Found] Learning vs within-session performance.** Karni & Sagi (1993; abstract only): in texture discrimination, performance saturates within a session, and large gains appear only about 8 hours after it, then last for years. Mednick et al. (2002; abstract only): thresholds got worse across four test sessions in one day; a midday nap, or moving the stimuli to an untrained location, prevented the decline. Pan & Rickard (2015; abstract only; meta-analysis of 34 articles, 88 groups, 1,296 people): apparent sleep gains in motor sequence learning are largely explained by moderators such as how performance is averaged, the build-up of reactive inhibition within training and time of testing. Gupta & Rickard (2024; abstract only): reactive inhibition (a decline over consecutive practice that recovers in breaks) matters more than usually assumed. Das et al. (2025; abstract only): "micro-offline gains" after short rests are a transient performance benefit, not offline learning.
- **[Found] Spatial training curves.** Terlecki, Newcombe & Little (2008; abstract only): repeated Mental Rotations Test practice and Tetris both produced large gains in mental rotation that lasted months; men improved faster early and women more later; Tetris gave faster early gains but the same final scores. Stafford & Dewar (2014; full text, post-print): in an online game (854,064 players) average scores kept rising up to 100 plays (no plateau test); score variability in plays 1–5 correlated with the mean of plays 6–10 (r = .59).
- **[Found] Abrupt, insight-like learning exists in perceptual learning.** Rubin, Nakayama & Shapley (1997; abstract only): a large, abrupt jump in illusory-contour performance that was still stimulus-specific. Ahissar & Hochstein (1997; abstract only): easy conditions are learned first and guide learning of hard ones; hard-only training learns only once learning has been enabled, and a single long ("eureka") presentation sufficed.
- **[Found] Why change stops.** Lövdén et al. (2010; abstract only, theory): plasticity is driven by a prolonged mismatch between a person's resources and the demands placed on them; when the mismatch ends, so does change.
- **[Found] Trackers trade lag for noise.** Hofman et al. (2020; full text except the last references): a tracker with quantified uncertainty (Urnings, urn size 60) needed 9 sessions (93 responses) to enter the 95 % interval of a simulated ability jump; larger urns mean less noise and slower tracking, as a smaller K does in Elo.

### 1.2 What I infer for Parallax

- **[Inference] Plateaus are both real and partly artefact.** Group averages hide individual steps, dips and flat stretches, so "average learners never plateau" is no argument; and one player's flat stretch over a few sessions is often noise. For one player on one exercise, the candidates are:
  1. **Artefacts of measurement in Parallax itself:** success is held near the target by design (the score cannot rise; v1.0 already says so on the summary); the shown level moves only at block ends and carries session-to-session noise of about ±5 levels; the pool's ceiling (level 100) stops items from getting harder while the rating may still rise; a move up an interleaving stage adds switch trials, which lowers success for reasons that are not a loss of skill; averaging over variants and dimensions can hide gain on one and loss on another.
  2. **Performance, not learning, inside a session:** fatigue or reactive inhibition and, for perceptual tasks, local adaptation make late-session answers worse; rest restores them. A within-session decline is a reason to stop or switch, not a plateau.
  3. **Real learning plateaus:** (a) approaching the asymptote of the current method (exponential curves slow down by design); (b) a stable but suboptimal method (e.g., part-by-part feature matching that works on easy items and fails as complexity grows; Khooshabeh et al. 2013, §3); (c) the dip of a transition to a new method, which looks like a stall or a loss for a while before the leap; (d) a lost mismatch: one shared rating keeps overall success at the target while the limiting dimension is never pushed alone (P1).
- **[Inference] Consequences for detection:** judge across sessions, never within one; use the outcome-versus-difficulty information (not raw success, which is held flat); give an exploring player room (a dip after a strategy change is expected and must not be read as failure of that change); check the ceiling before calling anything a plateau.

## 2. Detecting a stall for one learner (Q2)

### 2.1 What the methods literature offers

- **[Found] State-space learning curves from binary answers.** Smith et al. (2004; abstract only) model the probability of a right answer as a latent random walk observed through a logistic link, estimate the curve and its confidence band, and call the "learning trial" the first trial after which the animal is better than chance with probability above 0.95 for the rest of the experiment. In simulations their curves had lower error than standard methods; in a rat's 47-day task they detected learning 2–4 days earlier than accepted criteria. Parallax's Gaussian rating is already a filter of this kind (C §2).
- **[Found] Change points on cumulative records.** Gallistel et al. (2004; full text) find putative change points recursively (the point farthest from the straight line between the start and the latest point), accept the first whose evidence exceeds a log-odds criterion (1.3–2 sensitive; up to 6 very conservative), and restart from it. Donner & Hardy (2015; full text) segmented 25,280 individual curves by dynamic programming and needed a stricter model-selection rule than AIC/AICc, which overfit (added false change points) in their simulations; BIC underfit.
- **[Found] CUSUM with predicted risk.** Page (1954; metadata only) introduced cumulative-sum charts. Steiner et al. (2000; abstract only) adapted the CUSUM to surgical outcomes by scoring each case against its own predicted risk with a likelihood ratio, so that a change in case mix does not raise false alarms. The analogue in Parallax is the logged predicted success of each item.
- **[Found] Bayesian online change-point detection.** Adams & MacKay (2007; abstract only) compute exactly, online, the posterior over the run length since the last change, by message passing.
- **[Found] Learning progress as a slope.** Teacher–student curriculum learning (Matiisen et al. 2017; abstract only) picks the task whose learning curve is steepest (and revisits tasks whose performance falls); it learned a Minecraft task about ten times faster than uniform sampling. ZPDES uses a success-rate difference (C §4).
- **[Found] Trackers trade lag for noise** (Hofman et al. 2020, §1.1): a tracker with known standard errors needed 93 responses to catch a simulated jump.
- **[Found] Within-person analysis.** Könen & Karbach (2015; full text, an opinion piece without new data) argue for analysing training data within persons (trajectories, fluctuations, couplings) with multilevel models, and say the usual 10–20 training sessions are enough for that.
- **[Found] Microrandomized trials.** Klasnja et al. (2015; abstract only): randomising which intervention component is delivered at each decision point, many times per person, lets pooled data estimate each component's causal effect and how it varies over time and across people. Relevant to §3.10.

### 2.2 Why the obvious rules fail in Parallax

- **[Inference] Success and residuals carry almost no plateau signal here.** Items are chosen to hold success at the target, so success is flat for improvers and for stalled players alike. The residual x − p is close to zero for both: in my simulation the rating lagged true ability by about 0.1 logit for a player improving at 0.2 logit per 100 answers, which is about +0.02 in success. A success- or residual-based CUSUM would need thousands of answers. The signal sits in the outcomes *relative to the difficulty of the items*, which the rating summarises and a regression on the raw log recovers.
- **[Inference] Binary answers are information-poor (my calculation).** The Fisher information about θ in one answer at Parallax's targets is about 0.20 for open answers (70 %), 0.11 for four options (78 %) and 0.06 for yes/no (85 %). The standard error of a slope over the last W answers shrinks as W^−3/2. In the simulation (§2.3) the slope's SE, in logits per 100 rated answers, was 0.31 (W = 240), 0.20 (320) and 0.147 (400) for Fold (four options), and at W = 400 0.158 for Rotate (yes/no and pick-two), 0.140 for Orient and 0.119 for Span (open answers).
- **[Inference] A floor on detection delay (my derivation).** After a change from slope s to zero, the expected log-likelihood ratio in favour of the change grows like w·s²·m³/(6·10⁴) after m answers (w = information per answer, s in logits per 100 answers). With w ≈ 0.09 and s = 0.25 it reaches 4 (odds of about 55:1) only after about 350 answers. No rule on right/wrong alone can be much faster; more information per answer (response time, graded error) is the only way to shorten it.
- **[Found, my simulation] The draft rules fail the acceptance test.** On simulated Fold learners (§2.3), the draft's "learning progress below 0.5 (≥ 60 answers, ≥ 3 sessions)" and "level change inside its noise band over 14 days" each flagged essentially 100 % of learners within 1,000 answers, including learners improving at 0.4 logit per 100 answers (about 10 levels per 100 answers). Both look often at noisy differences with no control of repeated looks, and the noise band of two ratings (about ±25 levels at σ ≈ 0.37) is wider than two weeks of real progress. Lowering the LP threshold to 0 did not help (still ~100 %).

### 2.3 The simulation behind the numbers

[Method] A scratch Node script (not committed; it only calls the engine) played simulated learners on one real exercise definition at a time, with the real engine's item choice (`select.pick`, decks of 10 with 8 target / 1 easy / 1 stretch, two warm-ups, weak-spot picks on 20 % of target items, Balanced k = 0.70) and the real rating update (`est.rate`, with its process noise). Sessions held 25–55 rated answers on the exercise, about 3.5 sessions a week; true ability had day-to-day noise N(0, 0.15²), lapses U(0.01, 0.06) and the item model's own guessing rates. True ability followed one of: a straight line at a set slope (0 to 0.4 logit per 100 rated answers); a rise of 0.3 per 100 answers followed by a flat plateau from answer 320 or 640 on; the exponential curves of `tests/node/fixtures/learner.mjs`; or a flat line with one jump. 300–400 learners per condition. At each session end the script fitted the trial-level slope over the last W answers (the detector of §2.4). Exercises: Fold (four options), Rotate (yes/no and pick-two), Knots (yes/no and four options), Orient (angle), Span (open), Hidden (g = 0.2). Limits: one exercise at a time (no switch costs, no interleaving stages, no Train rotation, no breaks longer than 3 days); the learner model is the sim's, not data.

### 2.4 The proposed detector

**[Proposal] Statistic.** For one exercise (and display class, where ratings are per display), take the last W rated untimed answers from Train and Path. Fit by maximum likelihood (Fisher scoring, two to three parameters, a few iterations)

    P(right_i) = g_i + (1 − g_i − 0.03) · σ(a + β·u_i + γ·switch_i − b_i)

where b_i and g_i are the item's logged difficulty and guessing rate, u_i = (answer index − window mean) / 100, and switch_i = 1 for an answer right after a different exercise (it absorbs switch costs when the interleaving stage changes inside the window). β is the learning slope in logits per 100 rated answers; its SE comes from the Fisher information, inflated by √φ, where φ ≥ 1 is the between-session over-dispersion (Pearson χ² of per-session level residuals over its degrees of freedom; it absorbs day-to-day noise). Weak priors (a ~ N(μ, 2²), β ~ N(0, 1²)) keep the fit finite. The level change over the window, for the card, is β·W/100 logits converted to levels.

**[Proposal] Rule (calibrated in §2.5).** Evaluate at the end of each session in which the exercise got ≥ 10 rated answers. Fire a **stall** when

    β̂ + 1.645 · SE < 0.15 logit per 100 rated answers, with W = 640

that is, when the one-sided 95 % upper bound of the slope excludes progress of 0.15 logit per 100 answers (about 3.7 levels per 100 answers on a 4-logit exercise). This is a test for evidence of absence of progress, not absence of evidence.

**[Proposal] Preconditions** (all must hold, else no evaluation):
- the window spans ≥ 8 sessions on ≥ 8 distinct days;
- no gap of more than 14 days inside the window (after a longer break, the window restarts after the gap: forgetting and recovery are not a plateau);
- no plateau change in its trial period (§3.10) overlaps the window; after a plateau event, the window restarts at the end of the trial period;
- the exercise is not at its ceiling: the rating predicts more than the target success on the hardest settings of the pool (an artefact; the card says "top of the range" and suggests Speed or a new variant instead);
- for Path, the same statistic on the stage's answers, plus "stage not passed after ≥ 8 sessions at that stage" as a second, descriptive trigger only once the slope test also fires.

**[Proposal] A second channel to classify, not to fire.** Over the same window, regress the log response time of right answers on the answer index, with (b_i − μ_i) as a covariate. If the time falls by more than 10 % per 100 answers with 95 % confidence (a placeholder threshold, to calibrate on pooled data), the player is still improving in speed: the stall is not shown as a plateau but as "your level is steady while your answers got N % faster", with Speed suggested (§5). A level stall with flat or rising time is a full plateau.

### 2.5 Operating characteristics (my simulation)

Rules that keep false alarms at or below 5 % for learners improving at 0.25 logit per 100 answers (the worst of Fold, Rotate and Knots), with the share of plateaued learners caught (the worst of the three; plateau from answer 320 after a rise of 0.3 per 100 answers). "FA" = learners flagged at least once in answers 0–1,000 (FA at 0.20: the worse of Fold and Rotate; at 0.15 and 0.10: Fold); "caught" = flagged within 400 / 600 / 800 answers after the plateau began.

| Rule (W, z, δ, consecutive) | FA at 0.25 | FA at 0.20 | FA at 0.15 | FA at 0.10 | Caught ≤ 400 / 600 / 800 |
|---|---|---|---|---|---|
| 640, 1.645, 0.20, 1 | 4.5 % | 22 % | 55 % | 88 % | 31 / 86 / 99 % |
| 640, 1.28, 0.15, 1 | 2.0 % | 12.5 % | 37 % | 76 % | 23 / 80 / 98 % |
| **640, 1.645, 0.15, 1 (proposed)** | **1.3 %** | **5.3 %** | **19 %** | **61 %** | **12 / 68 / 93 %** |
| 640, 1.645, 0.15, 2 | 0.5 % | 3.0 % | 9.5 % | 41 % | 2 / 48 / 82 % |
| 560, 1.645, 0.15, 1 | 2.3 % | 9.5 % | 27 % | 62 % | 21 / 70 / 91 % |
| 400, 1.645, 0.15, 2 | 3.5 % | 9.5 % | 18 % | 32 % | 17 / 40 / 61 % |
| Draft: LP < 0.5 | ~100 % | ~100 % | ~100 % | ~100 % | ~100 % (no control) |

The proposed rule on every exercise simulated (300–400 learners each):

| Exercise (answer type) | FA at 0.25 | Plateau caught after: quartiles / median, in answers | in sessions on the exercise |
|---|---|---|---|
| Fold (four options) | 1.3 % (5.3 % at 0.20) | 437 / 501 / 585 | 10 / 12 / 14 |
| Rotate (yes/no and pick-two) | 0.5 % (5.0 % at 0.20) | 442 / 507 / 593 | 10 / 12 / 15 |
| Knots (yes/no and four options) | 0.7 % | 461 / 527 / 644 | 11 / 13 / 15 |
| Span (open answers) | 0.0 % | 425 / 483 / 549 | 10 / 12 / 13 |
| Orient (angle) | 0.3 % | 440 / 497 / 566 | 10 / 12 / 14 |
| Hidden (g = 0.2) | 0.3 % | – | – |
| Fold, plateau from answer 640 | – | 426 / 510 / 587 | 10 / 12 / 15 |

- No learner was flagged while still rising at 0.3 per 100 answers before the plateau began (0 % in every plateau run), and 0–0.7 % of plateaued learners were never caught within the simulated 1,080–1,160 answers after onset.
- With misspecified items (each item's true difficulty off by N(0, 0.5²) plus +0.8 logit where the first two dimensions are both at their maxima, as in `train-misspec`), the slope was biased slightly low (0.22 instead of 0.25 on Fold) and false alarms rose a little: 1.8 % (Fold) and 2.3 % (Rotate) at 0.25, 6.5 % (Fold) at 0.20; plateaus were still caught within 800 answers for 98 % (Fold).
- On the exponential learners of `tests/node/fixtures/learner.mjs` (Fold, 1,400 answers each), 94.8 % were flagged; the true slope at the flag had a median of 0.018 and a 90th percentile of 0.044, and no flag came at a slope of 0.15 or more. Of the 295 learners whose slope had fallen to 0.05 by answer 800, 292 were caught by answer 1,400.
- On "step" learners (flat, then a jump of +0.6 logit at answer 700, as after a discovered method), 81 % were flagged during the flat stretch before the jump.

[Inference] Longer windows win: a 640-answer window has a slope SE of about 0.075, so it can tell flat from 0.15 in one look, while a 400-answer window needs repeated looks and pays for them in false alarms. The price: the detector cannot fire before 640 rated answers on an exercise, and it catches a plateau after a median of about 500 answers (12 sessions of ~40 answers on that exercise; 3–4 weeks for a focus or pinned exercise at 3–4 sessions a week, longer for one that Train rotates in less often). That is close to the floor of §2.2. In the sim's learner model everyone approaches an asymptote within about 1,000 answers per exercise; real players' curves are unknown until pooled exports arrive.

[Proposal] **What to promise.** Acceptance for milestone 3, stated in the units above: (1) learners improving at ≥ 0.25 logit per 100 rated answers are flagged at most 5 % of the time over 1,000 answers (simulated: ≤ 1.3 % on six exercises); (2) at 0.20 at most about 5 % (5.0–5.3 %); (3) a plateau that follows a rise is caught within 800 rated answers for ≥ 90 % of learners (simulated: 93 %, worst exercise) and within 600 for ≥ 65 % (68 %). Learners between 0.05 and 0.20 sit in an indifference zone; report their flag rate rather than promise one (19 % at 0.15, 61 % at 0.10 on Fold).

[Proposal] **Faster, later options** (not needed for v1.2): (a) where an exercise logs a graded error (`value`: angle error in Orient, Homing and Reckon), a continuous-error model carries several times the information of right/wrong and would shorten the window; (b) a local-linear-trend filter (the rating plus a drift state with its own small process noise) gives the same test online without storing a window; (c) Bayesian online change-point detection (Adams & MacKay) on session-level estimates adapts the window to the onset. Each needs its own calibration in the same simulation; none beats the information floor.

### 2.6 How to verify it with simulated learners

[Proposal] In `tests/node/sim.mjs` (it already plays learners through every mode):
1. Add learner types to `tests/node/fixtures/learner.mjs`: straight-line improvers at fixed slopes (0.10, 0.15, 0.20, 0.25, 0.30 logit per 100 answers per exercise); plateau learners (rise of 0.3 per 100 answers, then flat from a random onset between answers 200 and 900); step learners (flat, then +0.6 at a random answer); breaks of 15–30 days with forgetting; and "responders" whose plateau ends a set number of answers after a given change (§3.10), with the expected dip (−0.2 logit for 40–80 answers) before the gain.
2. Run them through Train (the real rotation of three exercises, interleaving stages and switch costs) and Path, for 120 days, so the calendar delays and the switch covariate are tested too.
3. Check: false alarms (flags while the true slope is ≥ 0.25) ≤ 5 % of learner × exercise pairs; flags at 0.20 reported; catch rates within 600 and 800 answers after onset at or above the numbers in §2.5; no flag inside the first 640 answers, at the pool's ceiling, inside a trial period, or in a window that crosses a break of > 14 days; plateau events and their follow-ups written to the record and the export.
4. Re-run the same checks under the misspecified-item run (`train-misspec`), since biased item difficulties could tilt the slope when the item mix drifts.

## 3. What breaks a stall (Q3)

A general caution first. **[Found]** Almost none of the studies below applied a change *after a detected plateau*: they compare practice schedules or instructions from the start. The evidence says which conditions produce more learning or transfer, not which rescue a stalled learner. **[Inference]** So the change menu should be (a) cheap and reversible, (b) chosen from log signals that make one change plausible, and (c) logged so that the community's pooled exports can test which changes work (§3.10). Each item below gives the evidence, when it applies, and the player-facing text (Parallax's voice: confident, specific, no "keep going").

### 3.1 A strategy switch, with instruction

- **[Found]** Stieff, Dixon, Ryu, Kumi & Hegarty (2014; abstract only): in a college chemistry course, training analytic strategies raised their use; combined imagery-plus-analytic training removed the sex difference in achievement, while single-strategy training left a male advantage. Meneghetti et al. (2017; abstract only; 72 women, 24 per group): mental-rotation practice alone and practice with a taught rotation strategy both raised accuracy on two rotation tests, and the gains held; only the strategy group improved further from post-test to follow-up and was more accurate than at pre-test on perspective taking and a fluid-reasoning task at follow-up. Khooshabeh, Hegarty & Shipley (2013; abstract only): good imagers default to whole-object rotation and switch to piece-by-piece when figures are fragmented; poor imagers use piece-by-piece flexibly. Delaney et al. (1998; full text): practice gains are specific to a strategy, and a new strategy starts slower. Fu & Gray (2004) and Yechiam et al. (2003) (abstracts): people stay with a method that pays off step by step even when a better one exists; changing what the old method earns helped the better one stick. Donner & Hardy (2015): transitions start with a drop (78 %) and end higher (> 80 % within 50 plays). No effect sizes were available in the abstracts.
- **[Inference] When:** a stall plus a strategy check-in that names one strategy (or "unsure") for this exercise; especially when the misses cluster on the complexity dimensions (cubes, folds, cells), where whole-object imagery breaks down (offer "parts"), or on large angles with simple objects (offer "whole"). Expect a dip: the trial period must not be judged on its first session.
- **[Proposal] Text:** "Fold has been level for 12 sessions (around level 41). For your next 3 Fold sessions, try the other method: follow one marked square through every fold instead of picturing the whole sheet. A new method often feels slower at first, so we'll compare after 3 sessions."

### 3.2 More variability (a variant swap, a wider mix)

- **[Found]** Raviv, Lupyan & Green (2022; C §6): variability slows initial learning and improves generalisation; novices are hurt by variation on dimensions that decide the answer and helped by variation on irrelevant ones. Contextual interference: Brady (2004) ES 0.38 (lab 0.57, applied 0.19); Czyż et al. (2024) delayed-transfer SMD 0.55, low-quality evidence (C §6). Wulf & Shea (2002; abstract only): principles from simple skills often fail for complex ones; low-load tasks gain from added challenge, very high-load tasks from reduced load. Stafford & Dewar (2014): early score variability correlated with later scores (r = .59; correlational only).
- **[Inference] When:** a stall while the log shows a narrow mix (one variant for most answers, the "low variability" setting, or the same few settings), and no switch-trial deficit. Variation should be on incidental features and variants first, not on the dimension the player is weakest on.
- **[Proposal] Text:** "Rotate has been level for 12 sessions. For your next 3 Rotate sessions, items mix all four axes and both question types: practising across more versions of a task builds a rule that holds on new ones."

### 3.3 Moving the interleaving stage

- **[Found]** Porter & Magill (2010; C §6): interference that rises step by step beat both blocked and random practice. Brunmair & Richter (2019; C §6): g = 0.42 for interleaved category learning, larger when the categories look alike. Wulf & Shea (2002), above: high-load tasks favour load-reducing conditions.
- **[Inference] When:** *back one stage* when the stall comes with a switch-trial deficit (answers right after a switch below their predicted success by ≥ 0.05 over the window; the engine already tracks switch trials). *Forward one stage* when there is no switch deficit, the stage is below S5 and the rating is settled: the player may be relying on knowing which task is coming. Both are reversible and cost little.
- **[Proposal] Text (back):** "Your Fold answers right after a switch have been weaker than your level predicts, so for your next 3 sessions Fold comes in longer runs. We'll mix it again once those answers catch up." **(forward):** "For your next 3 sessions Fold comes mixed with Nets and Slice more often: telling look-alike tasks apart is a skill of its own, and it shows up on new problems."

### 3.4 Rest and spacing

- **[Found]** Karni & Sagi (1993): within-session saturation, gains that appear hours after a session, retention for years (texture discrimination). Mednick et al. (2002): repeated same-day testing made thresholds worse; a nap or a new location prevented it. Stafford & Haasnoot (2017; abstract only; > 1.2 million players): spacing practice improved skill in an online game, with no extra benefit when the gap held a night's sleep. Stafford & Dewar (2014): spacing the first ten plays over more than 24 hours gave higher later scores (d = 0.11). Donovan & Radosevich (1999; C §6): d = 0.46 overall, but only 0.07–0.11 for complex tasks. Molloy et al. (2012; C §6): 100 trials a day did as well as 200–800. Pan & Rickard (2015), Gupta & Rickard (2024), Das et al. (2025): much of what looks like consolidation after rest is the removal of within-session fatigue or inhibition, which is real for performance but not new learning.
- **[Inference] When:** the stall comes with massed practice on the exercise (long sessions on it, several sessions a day, or a recent jump in volume) and a within-session decline (late-session target items below prediction more than early ones). A 3–4-day rest of that exercise, with the others carrying on, is cheap; expect performance to recover, and do not sell it as new learning.
- **[Proposal] Text:** "Your Fold answers drop late in long sessions, and Fold has been level for 12 sessions. Fold rests for 3 days while the others carry on, then returns in shorter runs: skills settle between sessions, and short spaced runs beat long ones."

### 3.5 Changing difficulty (down or up)

- **[Found]** Wilson et al. (2019; C §1): theory and simulation for an ~85 % optimum on two-choice tasks; holding the error rate constant beats fixed difficulty. Guadagnoli & Lee (2004; abstract only): the best challenge depends on both the learner's skill and the task's difficulty. Ahissar & Hochstein (1997; abstract only): easy conditions are learned first and enable learning of hard ones. Wisniewski et al. (2017; abstract only): progressively harder auditory training beat constant difficulty on the trained band. Roads et al. (2018; abstract only; 237 skin-lesion images): easy-to-hard and hard-to-easy orders did not differ clearly. Pelánek et al. (2017; C §1): harder targets looked better for learning, easier ones kept more users. Lomas et al. (2017; abstract only; > 20,000 sessions): even moderate difficulty can lower engagement. Papoušek & Pelánek (2017; C §1): letting learners set difficulty gave no benefit.
- **[Inference] When:** *aim higher* (Stretch on that exercise, for a few sessions) when the stall comes with stretch items answered better than predicted and few early quits: the mismatch that drives change (Lövdén et al. 2010) may be missing. *Aim lower* (Comfortable on that exercise) when misses pile up on stretch and target items together, sessions end early, or a new strategy is being tried (consolidate the method on clear items). The evidence is indirect and mixed, so this is a second-line change.
- **[Proposal] Text (lower):** "For your next 3 Fold sessions, items aim a little easier (about 9 in 10 right) so the new method can settle on clear cases; they move back up after that." **(higher):** "You've been beating Fold's hardest items more often than predicted, so for your next 3 sessions Fold aims higher (about 2 in 3 right)."

### 3.6 Speed, when accurate but slow

- **[Found]** Wright et al. (2008; C §7): mental-rotation time fell from 3,132 to 1,480 ms over 21 days of practice, with errors flat. Ball et al. (2002; abstract only; 2,832 adults aged 65–94): immediately after training, 87 % of the speed-of-processing group showed reliable improvement on the trained ability (74 % reasoning, 26 % memory); boosters raised it to 92 % (vs 68 %), with no detected effect on everyday functioning at two years. Maris & van der Maas (2012; abstract only): under a speed-accuracy scoring rule, the time limit sets how well an item discriminates. Time limits can change what spatial tests measure (Voyer 2011, C §7, not verified).
- **[Inference] When:** an accuracy-level stall while right answers stay slow (slower than the player's own earlier sessions at the same predicted success, or the RT channel of §2.4 shows no speed-up), and Speed is open for the exercise. If the time is still falling, the player is in a fluency phase, not a plateau.
- **[Proposal] Text:** "Your Rotate answers are steady and accurate but take about 9 seconds at level 52. Speed trains exactly that: one Rotate run in each of your next 3 sessions comes with a deadline set from your own times. Your untimed level is not affected."

### 3.7 Drilling the weakest dimension

- **[Found]** Macnamara, Hambrick & Oswald (2014; abstract only): deliberate practice explained 26 % of performance variance in games, 21 % in music, 18 % in sports, 4 % in education and under 1 % in professions. Mastery learning helps most for weaker students (Kulik et al. 1990; C §5, partly unverified). A multivariate Elo with several concepts per item predicted performance only slightly better than one rating (Abdi et al. 2019; abstract only), consistent with Pelánek's (2016) note that multivariate Elo adds little accuracy (C §3). I found no study of drilling the weakest dimension to break a plateau in spatial training.
- **[Inference] When:** a stall plus a weak-spot flag (already computed per dimension level) on a level near the player's frontier: one limiting dimension may hold the rating back. The drill is a block in which that dimension carries the difficulty while the others are easy.
- **[Proposal] Text:** "Your answers at 8 and 10 cubes fall below what your level predicts, while the angles go fine. For your next 3 Rotate sessions, more items push the cube count with easy angles: one weak setting can hold the whole level back."

### 3.8 A new variant or exercise

- **[Found]** Variability (§3.2). Lomas et al. (2017) studied novelty among the factors behind engagement (abstract only; results not in the abstract). No plateau study.
- **[Inference] When:** none of the signals above, or one variant used for a long time; also the fallback when other changes have been tried. Cheap, motivating, and a variability bet at the same time.
- **[Proposal] Text:** "Knots has been level for 12 sessions. Try 'Tie' for your next 3 sessions: the same rope logic with a new question, and a new angle often shows what the old one hid."

### 3.9 Which change first: a decision table

[Proposal] At a stall, check the artefacts first; then take the first row whose signal is present (the signals are all computable from the log):

| Order | Signal in the window | Change | Basis |
|---|---|---|---|
| 0 | Rating at the pool's ceiling | Not a plateau: "top of the range"; suggest Speed or another variant | §1.2 artefacts |
| 0 | Gap > 14 days inside the window | Not a plateau: restart the window | §2.4 |
| 1 | Switch-trial deficit ≥ 0.05 | Interleaving stage back one | §3.3 |
| 2 | Weak-spot flag near the frontier | Drill that dimension | §3.7 |
| 3 | Right answers slow and not speeding up; Speed open | Speed runs inside Train | §3.6 |
| 4 | Late-session decline or massed practice | Rest 3–4 days, then shorter runs | §3.4 |
| 5 | Check-in names one strategy, or none on record | The other strategy, with its card and a demo | §3.1 |
| 6 | Narrow mix | Wider mix or variant swap | §3.2 |
| 7 | Stretch items beaten; no early quits | Aim higher for 3 sessions | §3.5 |
| 8 | Otherwise | Interleaving stage forward, or a new variant | §3.3, §3.8 |

When several rows apply, rows 5–8 can be drawn at random among the eligible ones (see §3.10); rows 1–4 answer a specific signal and come first.

### 3.10 Running a change: trial period, dip, verdict, record

- **[Proposal] Trial period.** A change lasts for the next 3 sessions with the exercise and at least 120 rated answers on it; the detector is paused for that exercise until the period ends, and its window restarts there.
- **[Proposal] Expect the dip, say so.** Strategy and mix changes usually lower success for a while (Donner & Hardy 2015: a drop after 78 % of transitions; Delaney et al. 1998: a new method starts slower), so the follow-up never judges the first session.
- **[Proposal] Verdict.** After the period, compare the ability level (the fitted intercept) of the period's answers with that of the plateau window. With 120 answers against 640 the difference has an SE of about 0.33 logit (about 8 levels; my calculation), so the honest words are "clearly up" (lower 95 % bound > 0), "unclear yet" (the usual result) and "no change yet"; the detector then keeps watching, and a second stall triggers the next row of the table. Never "it didn't work" after one period.
- **[Proposal] Record and export.** A plateau event `{ exId, at, window: [n0, n1], beta, se, level, reason, change, until, verdict }` goes into the record, the summary, Today and the research export. When several changes are eligible, choosing among them at random and logging the choice turns every player's plateaus into a micro-randomised experiment (Klasnja et al. 2015): pooled exports can then estimate which change helps whom. The player still sees one stated reason, because every eligible change has one.
- **[Proposal] The card.** On the session summary and on Today, outside any training block: what was flat (with the level and its range), the change, its reason, how long it runs, and when the follow-up comes; the Chimera invitation ("compare strategies with others in the Chimera Discord") sits on the card, as the standing rules ask for plateaus.

## 4. Progress on every dimension (Q4)

### 4.1 Approaches and their evidence

| Approach | What it does | Evidence | Fit to Parallax |
|---|---|---|---|
| One staircase per dimension, in turn | Moves one dimension while the others stay fixed | Classic psychophysics (C §2–3) | Slow; ignores interactions; Threshold mode already does this for one parameter |
| One rating + LLTM item model (now) | Items at the target from a shared θ and population step sizes | LLTM reproduced rotation difficulty at r = .90 with residuals left (Rajeb et al. 2025, C §3) | Holds overall targeting; blind to a player's own profile across dimensions |
| **Person-specific step weights (random-weights LLTM)** | Each person's weight for each item feature may differ from the population's | Rijmen & De Boeck (2002; abstract only): an LLTM whose feature weights vary across persons, a special case of the multidimensional multinomial logit model | The natural form here: Parallax items combine all dimensions additively, so a per-dimension offset on the step is exactly what a player's profile changes |
| Multivariate Elo / multidimensional IRT | Several abilities, items loading on several | Abdi et al. (2019; abstract only): small predictive gain over one Elo; the extra parameters were useful to steer adaptivity and to show learners; Pelánek (2016; C §3): such extensions add little accuracy | Same idea in a different parameterisation; the random-weights form keeps one θ and one level per exercise |
| Multidimensional QUEST+ | Bayesian placement over many stimulus dimensions | Watson (2017; C §2): assumes a stationary observer | Assessment, not training |
| Knowledge tracing (BKT) | A skill is learned or not | Corbett & Anderson (1995; C §5) | Continuous spatial skills fit a two-state model poorly |
| Logistic learner models with skill-specific terms (AFM, PFA) | Per-skill difficulty and learning-rate terms | Cen, Koedinger & Junker (2006; metadata only); overview in Pelánek (2017; metadata only) | Possible later: per-dimension learning rates; not needed to fix targeting |
| Explanatory IRT + Elo for cold start | Item and person features give starting values | Park et al. (2018/2019; metadata only) | Parallax already predicts difficulty from features (LLTM) |
| Target accuracy bands | Hold success at a set rate | Wilson et al. 2019; Klinkenberg et al. 2011; Pelánek et al. 2017 (C §1) | Kept: p\* per style, ±0.05 |
| Fluency targets with deadlines | Score speed and accuracy together on items already mastered | Math Garden scoring (Klinkenberg et al. 2011; C §1); the time limit sets item discrimination (Maris & van der Maas 2012; abstract only); rotation time halved with practice (Wright et al. 2008; C §7); speed training gave reliable gains in 87 % of older adults (Ball et al. 2002; abstract only) | Speed mode exists; the gap is that the default mode never asks for speed |

[Found] Lövdén et al. (2010; abstract only) is the theoretical reason to care: change is driven by a prolonged mismatch between what the task demands and what the person can supply. One shared rating keeps the *overall* mismatch right but can leave it too small on a strong dimension and too large on a weak one.

### 4.2 What the current engine does for a player with an uneven profile (my simulation)

[Method] Same scratch setup as §2.3, on Fold and Rotate, with learners whose step weight on each dimension differs from the population's by N(0, (f·|step|)²), f = 0.5 or 0.3 (an assumption; pooled data should estimate f). Three conditions on the same learners: **current** engine; **estimated offsets** (at every session end, a ridge logistic regression on the last 400 answers, with the rating before each answer as the ability term, prior SD 0.5·|step| per dimension, and a cap so that no offset moves the top level of a dimension by more than 0.75 logit; the selector and the rating then use the person-specific difficulty); **oracle** (the true offsets). 200 learners, 800 answers each; metrics on target items after answer 200.

| Exercise, f | Condition | Target items whose true success is within ±0.10 of the target | Mean distance from the target | Worst dimension level (≥ 200 items) | Level share of the strongest vs the weakest dimension |
|---|---|---|---|---|---|
| Fold, 0.5 | current | 87.4 % | 5.3 points | 10.6 points off | 0.34 vs 0.39 |
| | estimated | 94.6 % | 4.2 | 1.1 | 0.39 vs 0.37 |
| | oracle | 98.8 % | 3.3 | 1.6 | 0.47 vs 0.36 |
| Fold, 0.3 | current | 94.1 % | 4.3 | 6.1 | 0.38 vs 0.40 |
| | estimated | 97.3 % | 3.7 | 1.6 | 0.40 vs 0.38 |
| | oracle | 98.5 % | 3.4 | 3.0 | 0.44 vs 0.37 |
| Rotate, 0.5 | current | 91.8 % | 4.4 | 6.5 | 0.27 vs 0.28 |
| | estimated | 94.5 % | 3.8 | 3.3 | 0.32 vs 0.26 |
| | oracle | 97.0 % | 3.3 | 3.7 | 0.39 vs 0.24 |
| Rotate, 0.3 | current | 96.8 % | 3.4 | 5.7 | 0.27 vs 0.27 |
| | estimated | 97.3 % | 3.3 | 3.8 | 0.30 vs 0.25 |
| | oracle | 98.6 % | 3.0 | 3.2 | 0.33 vs 0.23 |

Overall success on target items stayed on target in every condition (e.g., Fold 77.1 vs 77.4 %). Offsets were estimated with an error of 0.3–0.4 step (RMS).

[Inference] The gap the audit names is real but moderate: with a fairly uneven profile (f = 0.5) one target item in eight on Fold sits more than 10 points off the player's edge, and the strong dimension is pushed no further than the weak one (the weak one even slightly more; my guess is the weak-spot drill, which serves flagged high levels of the weak dimension). Session-end offsets recover about half to three quarters of the possible gain at f = 0.5 (Fold 63 %, Rotate 52 %; at f = 0.3, Fold 73 %, Rotate 28 %), remove the worst per-level misses, and start pushing the strong dimension. With a mild profile (f = 0.3) the gain is small. How uneven real players are is unknown; the pooled exports can answer it (fit f per exercise).

### 4.3 [Proposal] The design

1. **Per-dimension offsets.** Keep one θ and one level per exercise. Add, per exercise (and display class), an offset o_d per dimension: the player's step on d is step_d + o_d, applied to the level index centred on the dimension's middle level, so θ keeps its meaning at the middle of every dimension and the level scale does not move. Estimate the offsets at every session end by ridge logistic regression on the last 400 rated answers (prior SD 0.5·|step_d|; cap at ±0.75 logit at the top level), as simulated; an online Laplace update after every answer is the alternative. Start using them after 100 answers on the exercise; before that all offsets are 0.
2. **Selection on the person-specific difficulty.** `select.pick` works on a pool whose b already includes the offsets (a per-record pool, rebuilt at session start). The 8/1/1 deck, warm-ups, tolerance, variety rules and `noRepeat` stay as they are.
3. **Rotate the leading dimension.** One target item in five is chosen so that a named dimension carries the difficulty (its level at the player's frontier for that dimension, the others easy), cycling through the dimensions; this probes every frontier and feeds the offsets on the levels where they matter. The weak-spot drill stays, at its 20 % share of target items.
4. **Fluency inside Train.** Once Speed is open for an exercise (a Path stage passed, or ≥ 60 answers with σ ≤ 0.45), the deck's "easy" item is drawn from Speed's fluent zone (predicted untimed success ≥ g + (1 − g)·0.85; for four options and yes/no that is about p\* + 0.10 already, for open answers it is easier than today's easy item) and comes with the Speed deadline for that exercise and variant. Its answer updates the timed rating and the deadline only, never the untimed rating, so untimed levels stay comparable; a time-out is wrong for the timed rating only; fast errors cost most in the points shown (S = (2x − 1)(1 − t/deadline), as Speed). One item in ten carries a deadline; the rest stay untimed.
5. **Show the profile.** The exercise page shows the settings handled per dimension ("up to 140° turns; up to 8 cubes") from the person-specific frontier, and the plateau card can name a dimension (§3.7).

### 4.4 [Proposal] Keeping shortcuts from paying

- **The risk.** If a cheap heuristic works better at some levels of a dimension, a player using it beats predictions there, the offset makes that dimension look strong, the selector pushes it, and the level rises without the skill.
- **Guards.** (a) Extend rule 5's shortcut tests from each item pool to each level of each dimension: every shortcut solver stays within chance + 10 points at every dimension level (a node test over the 10,000-seed runs). (b) The cap on offsets (±0.75 logit at the top level) and the ridge prior bound what any bias can do. (c) Fluency items use only settings answered at ≥ g + (1 − g)·0.85 untimed, so a deadline never meets an item the player cannot already solve. (d) Fast errors cost most in the timed score, so guessing does not pay.
- **[Proposal] What to simulate** (milestone 7 acceptance):
  1. learners with person-specific step weights (f = 0.3 and 0.5) and slow learning: share of target items within ±0.10 of the target ≥ 94 % (f = 0.5) and no dimension level more than 5 points off target (≥ 200 items), overall targeting within ±1 point, 95 % intervals still holding the true θ about 95 % of the time;
  2. a shortcut learner: on items where an exercise's shortcut solver succeeds, the learner answers by the shortcut whenever its success beats their skill; check that the shown level does not run ahead of true ability by more than its interval, that no offset hits its cap more often than for honest learners, and that the shortcut solvers' accuracy on the items the new selector serves stays within chance + 10 points, as on the whole pool;
  3. the misspecified-item run (`train-misspec`): offsets should absorb part of the interaction term without breaking coverage;
  4. fluency items: in-time success on them stays within ±2 points of the deadline target, and untimed targeting is unchanged.

## 5. Progression modes: "right when" and suggestion signals (Q5)

The guide already has a "Which mode, when" table (`docs/guide/guide.html`, "Which mode, when"); the app does not (gap M3). The lines below are meant for the practise sheet and the Lab, each with its basis and the log signals on which Today may suggest the mode.

| Mode | **Right when …** (proposed line) | Basis | Log signals to suggest it |
|---|---|---|---|
| **Train** | "… you want the most progress per minute without choosing anything: mixed exercises at the edge of your level, with reviews spaced out." | Targeted difficulty (C §1); interleaving g = 0.42 and spacing (C §6); a learning-progress curriculum beat a hand-made sequence in a randomised trial with 265 children, 6.74 → 9.38 vs 6.83 → 8.36 (C §4) | The default. Suggest returning to it after a Path stage holds at its 30-day recheck, or when two weeks of Free play have left every level unchanged |
| **Path** | "… an exercise is new to you, or mixed practice feels like too much: one band at a time, with a demo and a clear finish line." | Blocked first, then rising interference (Porter & Magill 2010, C §6); load-reducing practice for high-load tasks (Wulf & Shea 2002, abstract); mastery gates (C §5); guidance fades with expertise (Kalyuga et al. 2003, C §5) | An exercise with < 60 rated answers or σ > 0.45 that the player pins; the interleaving stage stepped back twice in 14 days; ≥ 2 of the last 3 sessions with the exercise ended early; a plateau whose misses sit in one band |
| **Threshold** | "… you want one number to compare over months or with published studies (Track standard, Span length). It measures; it does not change your level." | Staircases settle at known success rates (Levitt 1971; Kaernbach 1991; Legault et al. 2013; C §2); in the simulations one Spin deadline run is only a rough guide (`ENGINE.md` §16) | The last complete run of a protocol is ≥ 30 days old and the exercise was practised since; the player opened Track or Span ≥ 5 times since the last run |
| **Speed** | "… you answer an exercise accurately but slowly, or your test is timed: deadlines on items you already solve, with a separate timed level." | Practice halved rotation time with errors flat (Wright et al. 2008, C §7); speed training gave reliable gains on the trained speed in 87 % of older adults (Ball et al. 2002, abstract); time limits change what is measured, so timed and untimed levels stay apart (C §7, Voyer 2011 unverified) | Speed open; right answers at fluent settings (≥ g + (1 − g)·0.85 predicted) take ≥ 1.3× the player's own fastest-quartile time for that exercise, and the RT channel of §2.4 shows no speed-up over the last 400 answers; or a test noted in the "Taking a test soon?" helper is less than 4 weeks away (the helper records the test's kinds and date, `js/ui/overlap.js`; a "timed" flag would be new) |
| **Free play** | "… you want to explore a setting, replay a friend's code, or rehearse exactly what you'll meet, without touching your level." | Letting learners set difficulty gave no learning benefit (Papoušek & Pelánek 2017, C §1); self-controlled practice benefits shrink from g = .44 to .107 once selection bias is corrected (McKay et al. 2022; 52 studies, abstract); choice of cosmetic features helped under an adaptive curriculum (Clément et al. 2024, C §4) | A challenge code opened; a plateau card that names a setting ("try 10 cubes at your own pace"); never as a route to a higher level |

[Proposal] **How Today suggests a mode.** At most one suggestion at a time, on Today or the summary, never inside a block; each carries its reason from the log ("Rotate: accurate but slow at level 52, so Speed is the right mode for it now"); dismissing it hides that suggestion for 14 days. The plateau card can carry a mode suggestion as its change (Path, Speed). Every suggestion is logged with its signal, so pooled exports can show which suggestions players take and what followed.

[Inference] The research does not crown one mode: Train has the best evidence for general progress per minute, Path for beginners and overloaded learners, Speed for fluency on what is already accurate, Threshold for measurement, Free play for curiosity and rehearsal. That is the honest content of the "right when" lines.

## 6. Simulation plan (what to test before shipping)

[Proposal] Everything below extends `tests/node/sim.mjs` and `tests/node/fixtures/learner.mjs`; the scratch runs in these notes only show that the targets are reachable.

1. **Stall detector (milestone 3):** the learner types, runs and checks of §2.6, with the acceptance of §2.5 ("What to promise"). Report the indifference-zone flag rates (slopes 0.10–0.20) in ENGINE.md rather than hide them.
2. **Change menu:** "responder" learners whose plateau ends after one specific change (with the expected dip first) and "non-responders" for whom nothing changes. Check that the follow-up says "clearly up" for at most 5 % of non-responders and reports how often it says so for responders; that a dip in the first session after a change never ends the trial period early; that a second stall moves to the next row of the table; and that the randomised choice among eligible changes is logged so that a pooled analysis recovers which change helped (by construction in the sim).
3. **Per-dimension offsets and fluency items (milestone 7):** the four checks of §4.4.
4. **Nothing else moves:** overall targeting, 95 % coverage, Path progression, Speed targeting and the shortcut bounds stay within their v1.1 figures (`ENGINE.md` §16) in every existing run.

Limits to state with the results: the learner model is an assumption (exponential curves, a gain of about 1.4 logits, plateaus as flat lines); real curves have pieces, dips and leaps (§1.1), and only pooled exports can show how often Parallax players plateau and which changes help.

## Sources

Read in this session (how much is marked; "C" = cited from `docs/research/v1.0/C-progression.md`, not re-read):

- Abdi, S., Khosravi, H., Sadiq, S., & Gasevic, D. (2019). A multivariate Elo-based learner model for adaptive educational systems. arXiv:1910.12581. https://arxiv.org/abs/1910.12581 — abstract only.
- Adams, R. P., & MacKay, D. J. C. (2007). Bayesian online changepoint detection. arXiv:0710.3742. https://arxiv.org/abs/0710.3742 — abstract only.
- Ahissar, M., & Hochstein, S. (1997). Task difficulty and the specificity of perceptual learning. *Nature, 387*, 401–406. https://doi.org/10.1038/387401a0 — abstract only.
- Ball, K., Berch, D. B., Helmers, K. F., Jobe, J. B., et al. (2002). Effects of cognitive training interventions with older adults: A randomized controlled trial. *JAMA, 288*(18), 2271–2281. https://doi.org/10.1001/jama.288.18.2271 — abstract only.
- Das, A., Karagiorgis, A., Diedrichsen, J., Stenner, M.-P., & Azañón, E. (2025). Micro-offline gains do not reflect offline learning during early motor skill acquisition in humans. *PNAS, 122*(44), e2509233122. https://doi.org/10.1073/pnas.2509233122 — abstract only.
- Delaney, P. F., Reder, L. M., Staszewski, J. J., & Ritter, F. E. (1998). The strategy-specific nature of improvement: The power law applies by strategy within task. *Psychological Science, 9*(1), 1–7. https://doi.org/10.1111/1467-9280.00001 — full text (author copy: https://www.cmu.edu/dietrich/psychology/memorylab/publications/98_pd_lmr_js_fr.pdf).
- Donner, Y., & Hardy, J. L. (2015). Piecewise power laws in individual learning curves. *Psychonomic Bulletin & Review, 22*(5), 1308–1319. https://doi.org/10.3758/s13423-015-0811-x — full text (PMC4577530).
- Evans, N. J., Brown, S. D., Mewhort, D. J. K., & Heathcote, A. (2018). Refining the law of practice. *Psychological Review.* https://doi.org/10.1037/rev0000105 — full text (repository copy: https://figshare.utas.edu.au/articles/journal_contribution/Refining_the_Law_of_Practice/22964183); volume and pages not checked.
- Fu, W.-T., & Gray, W. D. (2004). Resolving the paradox of the active user: Stable suboptimal performance in interactive tasks. *Cognitive Science, 28*(6), 901–935. https://doi.org/10.1207/s15516709cog2806_2 — abstract only.
- Gallistel, C. R., Fairhurst, S., & Balsam, P. (2004). The learning curve: Implications of a quantitative analysis. *PNAS, 101*(36), 13124–13131. https://doi.org/10.1073/pnas.0404965101 — full text.
- Gray, W. D., & Lindstedt, J. K. (2017). Plateaus, dips, and leaps: Where to look for inventions and discoveries during skilled performance. *Cognitive Science, 41*(7), 1838–1870. https://doi.org/10.1111/cogs.12412 — abstract only.
- Guadagnoli, M. A., & Lee, T. D. (2004). Challenge point: A framework for conceptualizing the effects of various practice conditions in motor learning. *Journal of Motor Behavior, 36*(2), 212–224. https://doi.org/10.3200/JMBR.36.2.212-224 — abstract only.
- Gupta, M. W., & Rickard, T. C. (2024). Comparison of online, offline, and hybrid hypotheses of motor sequence learning using a quantitative model that incorporate reactive inhibition. *Scientific Reports, 14*, 4661. https://doi.org/10.1038/s41598-024-52726-9 — abstract only.
- Heathcote, A., Brown, S., & Mewhort, D. J. K. (2000). The power law repealed: The case for an exponential law of practice. *Psychonomic Bulletin & Review, 7*(2), 185–207. https://doi.org/10.3758/BF03212979 — full text, first ~75 %.
- Hofman, A. D., Brinkhuis, M. J. S., Bolsinova, M., Klaiber, J., Maris, G., & van der Maas, H. L. J. (2020). Tracking with (un)certainty. *Journal of Intelligence, 8*(1), 10. https://doi.org/10.3390/jintelligence8010010 — full text except the end of the references.
- Karni, A., & Sagi, D. (1993). The time course of learning a visual skill. *Nature, 365*, 250–252. https://doi.org/10.1038/365250a0 — abstract only.
- Khooshabeh, P., Hegarty, M., & Shipley, T. F. (2013). Individual differences in mental rotation: Piecemeal versus holistic processing. *Experimental Psychology, 60*(3), 164–171. https://doi.org/10.1027/1618-3169/a000184 — abstract only.
- Klasnja, P., Hekler, E. B., Shiffman, S., Boruvka, A., Almirall, D., Tewari, A., & Murphy, S. A. (2015). Microrandomized trials: An experimental design for developing just-in-time adaptive interventions. *Health Psychology, 34*(Suppl), 1220–1228. https://doi.org/10.1037/hea0000305 — abstract only.
- Könen, T., & Karbach, J. (2015). The benefits of looking at intraindividual dynamics in cognitive training data. *Frontiers in Psychology, 6*, 615. https://doi.org/10.3389/fpsyg.2015.00615 — full text.
- Lomas, J. D., Koedinger, K. R., Patel, N., Shodhan, S., Poonwala, N., & Forlizzi, J. L. (2017). Is difficulty overrated? *CHI 2017*, 1028–1039. https://doi.org/10.1145/3025453.3025638 — abstract only.
- Lövdén, M., Bäckman, L., Lindenberger, U., Schaefer, S., & Schmiedek, F. (2010). A theoretical framework for the study of adult cognitive plasticity. *Psychological Bulletin, 136*(4), 659–676. https://doi.org/10.1037/a0020080 — abstract only.
- Macnamara, B. N., Hambrick, D. Z., & Oswald, F. L. (2014). Deliberate practice and performance in music, games, sports, education, and professions: A meta-analysis. *Psychological Science, 25*(8), 1608–1618. https://doi.org/10.1177/0956797614535810 — abstract only.
- Maris, G., & van der Maas, H. L. J. (2012). Speed-accuracy response models: Scoring rules based on response time and accuracy. *Psychometrika, 77*(4), 615–633. https://doi.org/10.1007/s11336-012-9288-y — abstract only.
- Matiisen, T., Oliver, A., Cohen, T., & Schulman, J. (2017). Teacher-student curriculum learning. arXiv:1707.00183. https://arxiv.org/abs/1707.00183 — abstract only.
- McKay, B., Yantha, Z. D., Hussien, J., Carter, M. J., & Ste-Marie, D. M. (2022). Meta-analytic findings of the self-controlled motor learning literature: Underpowered, biased, and lacking evidential value. *Meta-Psychology, 6.* https://doi.org/10.15626/MP.2021.2803 — abstract only.
- Mednick, S. C., Nakayama, K., Cantero, J. L., Atienza, M., Levin, A. A., Pathak, N., & Stickgold, R. (2002). The restorative effect of naps on perceptual deterioration. *Nature Neuroscience, 5*(7), 677–681. https://doi.org/10.1038/nn864 — abstract only.
- Meneghetti, C., Cardillo, R., Mammarella, I. C., Caviola, S., & Borella, E. (2017). The role of practice and strategy in mental rotation training: Transfer and maintenance effects. *Psychological Research* (online 2016). https://doi.org/10.1007/s00426-016-0749-2 — abstract only; volume and pages not checked.
- Page, E. S. (1954). Continuous inspection schemes. *Biometrika, 41*(1–2), 100–115. https://doi.org/10.1093/biomet/41.1-2.100 — metadata only.
- Pan, S. C., & Rickard, T. C. (2015). Sleep and motor learning: Is there room for consolidation? *Psychological Bulletin, 141*(4), 812–834. https://doi.org/10.1037/bul0000009 — abstract only.
- Rijmen, F., & De Boeck, P. (2002). The random weights linear logistic test model. *Applied Psychological Measurement, 26*(3), 271–285. https://doi.org/10.1177/0146621602026003003 — abstract only; full text read 2026-11-18 (see the Addendum).
- Roads, B. D., Xu, B., Robinson, J. K., & Tanaka, J. W. (2018). The easy-to-hard training advantage with real-world medical images. *Cognitive Research: Principles and Implications, 3*, 38. https://doi.org/10.1186/s41235-018-0131-6 — abstract only (open access).
- Rubin, N., Nakayama, K., & Shapley, R. (1997). Abrupt learning and retinal size specificity in illusory-contour perception. *Current Biology, 7*(7), 461–467. https://doi.org/10.1016/S0960-9822(06)00217-X — abstract only.
- Smith, A. C., Frank, L. M., Wirth, S., Yanike, M., Hu, D., Kubota, Y., Graybiel, A. M., Suzuki, W. A., & Brown, E. N. (2004). Dynamic analysis of learning in behavioral experiments. *Journal of Neuroscience, 24*(2), 447–461. https://doi.org/10.1523/JNEUROSCI.2908-03.2004 — abstract only.
- Stafford, T., & Dewar, M. (2014). Tracing the trajectory of skill learning with a very large sample of online game players. *Psychological Science, 25*(2), 511–518. https://doi.org/10.1177/0956797613511466 — full text (post-print: https://eprints.whiterose.ac.uk/id/eprint/83582/).
- Stafford, T., & Haasnoot, E. (2017). Testing sleep consolidation in skill learning: A field study using an online game. *Topics in Cognitive Science, 9*(2), 485–496. https://doi.org/10.1111/tops.12232 — abstract only.
- Steiner, S. H., et al. (2000). Monitoring surgical performance using risk-adjusted cumulative sum charts. *Biostatistics, 1*(4), 441–452. https://doi.org/10.1093/biostatistics/1.4.441 — abstract only.
- Stieff, M., Dixon, B. L., Ryu, M., Kumi, B. C., & Hegarty, M. (2014). Strategy training eliminates sex differences in spatial problem solving in a STEM domain. *Journal of Educational Psychology, 106*(2), 390–402. https://doi.org/10.1037/a0034823 — abstract only.
- Terlecki, M. S., Newcombe, N. S., & Little, M. (2008). Durable and generalized effects of spatial experience on mental rotation: Gender differences in growth patterns. *Applied Cognitive Psychology, 22*(7), 996–1013. https://doi.org/10.1002/acp.1420 — abstract only; full text read 2026-11-18 for M1 (see the Addendum here and in M1).
- Wisniewski, M. G., Radell, M. L., Church, B. A., & Mercado, E. (2017). Benefits of fading in perceptual learning are driven by more than dimensional attention. *PLoS ONE, 12*(7), e0180959. https://doi.org/10.1371/journal.pone.0180959 — abstract only.
- Wulf, G., & Shea, C. H. (2002). Principles derived from the study of simple skills do not generalize to complex skill learning. *Psychonomic Bulletin & Review, 9*(2), 185–211. https://doi.org/10.3758/BF03196276 — abstract only.
- Yechiam, E., Erev, I., Yehene, V., & Gopher, D. (2003). Melioration and the transition from touch-typing training to everyday use. *Human Factors, 45*(4), 671–684. https://doi.org/10.1518/hfes.45.4.671.27085 — abstract only.

Metadata only (pointers, nothing of their content used): Cen, H., Koedinger, K. R., & Junker, B. (2006). Learning Factors Analysis. *ITS 2006, LNCS*, 164–175. https://doi.org/10.1007/11774303_17 · Park, J. Y., Joo, S.-H., Cornillie, F., van der Maas, H. L. J., & Van den Noortgate, W. (2019). An explanatory item response theory method for alleviating the cold-start problem in adaptive learning environments. *Behavior Research Methods, 51*(2), 895–909. https://doi.org/10.3758/s13428-018-1166-9 · Pelánek, R. (2017). Bayesian knowledge tracing, logistic models, and beyond. *User Modeling and User-Adapted Interaction, 27*(3–5), 313–350. https://doi.org/10.1007/s11257-017-9193-2.

From `docs/research/v1.0/C-progression.md` (secondary: its own read levels and [unverified] marks apply): Brady 2004; Brunmair & Richter 2019; Cepeda et al. 2006, 2008; Clément et al. 2015, 2024; Corbett & Anderson 1995; Czyż et al. 2024; Donovan & Radosevich 1999; Jansen et al. 2013; Kaernbach 1991; Kalyuga et al. 2003; Klinkenberg et al. 2011; Kulik et al. 1990; Legault et al. 2013; Levitt 1971; Molloy et al. 2012; Papoušek & Pelánek 2017; Pelánek 2016; Pelánek et al. 2017; Porter & Magill 2010; Rajeb et al. 2025; Raviv et al. 2022; Voyer 2011 [unverified in C]; Watson 2017; Wilson et al. 2019; Wright et al. 2008.

Process note: the web-search quota for this research ran out part-way; later lookups used DOI records (Crossref, OpenAlex) and publisher pages. A further search could still find studies that apply a change *after* a detected plateau, which these notes did not find.

## Could not open

| Source | What I needed | Assumption used meanwhile |
|---|---|---|
| Gray & Lindstedt (2017), full text, https://doi.org/10.1111/cogs.12412 (publisher page refused the fetch) | How often plateaus and dips preceded leaps in their data; the parameters of their changepoint heuristics | Only the abstract's qualitative claim; no rates quoted |
| Doughty, Chase & O'Shields (2004), *The Behavior Analyst, 27*(1), 7–23, https://doi.org/10.1007/BF03392086 (PMC copy behind a browser check; Europe PMC rate-limited) | Whether rate-building (fluency) practice beats accuracy practice at equal amounts of practice | Speed evidence taken from Wright et al. (2008) and Ball et al. (2002) only; no claim that fluency training adds beyond practice |
| Keller (1958), "The phantom plateau", *JEAB*, https://doi.org/10.1901/jeab.1958.1-1 | The classic critique of Bryan & Harter's telegraphy plateaus | Not used; modern individual-curve studies (§1.1) carry the argument |
| Smith et al. (2004), full text (the PDF link failed at its site) | False-alarm behaviour of their learning-trial criterion | Not needed: the proposed detector is calibrated by simulation |
| Steiner et al. (2000), full text (open PDF listed, not fetched) | The exact risk-adjusted CUSUM score and thresholds | Not used in the proposal (a windowed slope test instead) |
| Adams & MacKay (2007), full text | Hazard functions and models, cost per step | Only named as a later option |
| Rijmen & De Boeck (2002), full text | The size of person-specific weight variances they estimated | f = 0.3–0.5 of a step, to be estimated from pooled exports. **Read in full 2026-11-18: see the Addendum** |
| Stieff et al. (2014), Meneghetti et al. (2017), Khooshabeh et al. (2013), full texts | Effect sizes of strategy training and strategy flexibility | Direction only; no effect sizes quoted |
| Pan & Rickard (2015), full text | Effect sizes after their moderators | The abstract's conclusion only |
| Lomas et al. (2017), full text | Which of novelty, choice and suspense changed engagement, and by how much | Nothing beyond the abstract |
| Bönstrup et al. (2019), *Current Biology, 29*, 1346–1351, https://doi.org/10.1016/j.cub.2019.02.049 (record without abstract) | Size of rapid offline gains | Replaced by Das et al. (2025) and Gupta & Rickard (2024) |
| Harris, Gliksberg & Sagi (2012), *Current Biology, 22*, 1813–1817, https://doi.org/10.1016/j.cub.2012.07.059 (record without abstract) | Whether breaking sensory adaptation (variability) unblocks perceptual learning | Not used |
| Carvalho & Goldstone (2014), *Memory & Cognition, 42*, 481–495, https://doi.org/10.3758/s13421-013-0371-0 (closed; no abstract in the record) | When blocking beats interleaving, by category similarity | Brunmair & Richter's moderators (C §6) used instead |
| Doroudi, Aleven & Brunskill (2019), *IJAIED, 29*, 568–620, https://doi.org/10.1007/s40593-019-00187-x (closed; no abstract in the record) | How often reinforcement-learning sequencing beat simple baselines | Not used; the proposal keeps rule-based changes |
| Ericsson (2008), *Academic Emergency Medicine, 15*, 988–994, https://doi.org/10.1111/j.1553-2712.2008.00227.x (closed) | The "arrested development" account of plateaus in experts | Not used (the abstract does not mention it) |
| Moè (2016), *Intelligence, 59*, 16–23, https://doi.org/10.1016/j.intell.2016.10.004 (record without abstract) | Whether strategy plus motivation instruction improved mental rotation | Not used |
| Pelánek's publication list, https://www.fi.muni.cz/~xpelanek/publications/ (the fetch was blocked) | The 2017 learner-modelling overview (AFM, PFA) | AFM and PFA named as options only |

## Addendum 2026-11-18: Rijmen & De Boeck 2002 (full text read)

The owner supplied the full text; it was read in full, tables included. Rijmen, F., & De Boeck, P. (2002). The random weights linear logistic test model. *Applied Psychological Measurement, 26*(3), 271–285. https://doi.org/10.1177/0146621602026003003. This addendum answers what §4 and "Could not open" needed from it; the sections above are left as written.

### What the paper reports [Found]

- **The model.** An LLTM in which chosen feature weights vary over persons: a person's weight for such a feature is the mean weight plus a personal deviation, normally distributed and integrated out by marginal maximum likelihood (EM with Gaussian quadrature). It is a special case of the multidimensional random coefficients multinomial logit model. Estimation needs random effects that are not (nearly) linearly dependent and whose variances are not (nearly) zero; otherwise one random effect is dropped. A likelihood-ratio test between P and P + 1 random effects is not valid, because the null lies on the boundary, so models are compared by BIC.
- **The data.** 214 secondary-school students aged 16–19 solved 24 propositional-reasoning problems built from four binary features (a modus ponens or a modus tollens; a further modus ponens with a conjunction; a disjunctive syllogism; a false conclusion to reject), plus fillers, with four response options including "I don't know", in 50 minutes. Proportions correct ran from 0.44 to 0.98 (mean 0.72). The four features explained 74 % of the variance of the item logits, with weights of about 1.09, 0.80, −0.86 and −0.64 logits.
- **Person-specific weight variances** (Table 2, logit scale; mean weights in Table 4):
  - the plain LLTM: ability variance 0.65;
  - selected by BIC: random ability plus a random weight for the disjunctive syllogism. Ability variance 0.51 (SD 0.71); weight variance 1.24 (SD 1.11) around a mean weight of −0.70; covariance 0.02; −2 log-likelihood 72 below the LLTM's. The spread of this one feature's effect across persons was larger than the spread of general ability, and unrelated to it;
  - adding a random weight for the modus-ponens-plus-conjunction feature gave it a variance of 0.63 but lowered −2 log-likelihood by only 0.04, so the data do not support it;
  - random weights for the first three features: variances 0.73, 0.68 and 1.46, ability 1.05, and ability correlated about −0.65 with the modus ponens/tollens weight; −2 log-likelihood 32 below the selected model for 7 more parameters, rejected by BIC;
  - a random weight for the false-conclusion feature made the covariance matrix singular: no detectable person-to-person variation;
  - in the selected model the fixed modus ponens/tollens weight misfit (fit statistic 2.83), a hint that it varies across persons too.
- **Where the variation sat.** The authors expected person-specific weights only for the features tied to known differences in how people read "or" (inclusive or exclusive) and "if" (one-way or two-way), and the data agreed.

### What it means for §4 [Inference]

1. **In §4's terms.** f is the SD of a person's step weight divided by the size of the step. The selected model gives f ≈ 1.6 (1.11 / 0.70) for one feature and 0 for the others; the three-weight model gives about 0.8, 1.0 and 1.7; the false-conclusion feature about 0. This is one dataset, in another domain, with 24 items in one session, and variances resting on few items per feature are imprecise.
2. **f = 0.3–0.5 is fair for graded dimensions, not as an upper bound for all.** The paper's pattern is sparse: most features near 0, one or two at f ≈ 1 or more, where a feature lets people read or solve the item in different ways. At f ≈ 1.6 about a quarter of persons find the "harder" level easier. For a graded spatial dimension (more folds, a larger angle, more cubes) that is implausible: a spread of 0.5 keeps about 98 % of persons' steps positive (0.7: about 92 %), so §4's range stays plausible there. Dimensions that switch the method rather than add load (a fold type, a rotation axis, a mirror or a shape change) are where a spread like the paper's is possible. The paper also shows that weight deviations can correlate with ability (about −0.65 in its larger model); §4.2's simulated learners have independent deviations.
3. **The simulation, rerun with uneven profiles like the paper's.** `docs/research/v1.2/spikes/P1/dims.mjs` now takes `--sdfs` (a spread per dimension), `--cap` and `--tau`, and reports how often true and fitted offsets reach the cap; the defaults keep §4.2's runs. 200 learners × 800 answers each, run against the engine of commit 8124174, for example `node docs/research/v1.2/spikes/P1/dims.mjs --ex fold --n 200 --sdfs 1.6,0,0,0 --cond est --tau 1.0 --cap 1.5` (`--sdf 0.9` for a uniform spread; `--cond cur` or `oracle` for the other columns). Its f = 0.5 rows reproduce §4.2 within half a point (current engine 87.8 % against 87.4 %, estimated offsets 94.1 % against 94.6 %, oracle 98.8 %).

   Target items whose true success is within ±0.10 of the target, with the worst dimension level (points off target, cells with ≥ 200 items) in brackets:

   | Profile | Current engine | Offsets, prior 0.5 × step, cap 0.75 (§4.3) | Prior 0.75 × step, cap 1.1 | Prior 1.0 × step, cap 1.5 | Prior 1.6 × step, cap 2.5 | Oracle |
   |---|---|---|---|---|---|---|
   | Fold, even (f = 0) | 98.6 % (2.4) | 98.2 % (3.3) | 97.4 % (5.8) | 96.7 % (7.6) | — | — |
   | Fold, f = 0.5 on every dimension (§4.2) | 87.8 % (9.7) | 94.1 % (1.1) | 94.1 % (1.5) | 95.1 % (2.3) | — | 98.8 % (1.8) |
   | Fold, f = 0.9 on every dimension | 69.3 % (13.6) | 84.6 % (3.4) | 88.6 % (2.8) | 90.0 % (1.7) | — | 98.4 % (1.8) |
   | Fold, sparse: folds f = 1.6, the rest 0 | 57.8 % (32.3) | 75.0 % (9.8) | 77.6 % (11.7) | 80.1 % (9.1) | 83.9 % (6.9) | 98.7 % (1.0) |
   | Rotate, sparse: angle f = 1.6, the rest 0 | 67.7 % (20.7) | 77.9 % (8.5) | — | 84.7 % (8.1) | — | 98.1 % (2.1) |

   The cap binds often. On Fold's folds dimension (step 0.6 logit, five levels) the true offsets of 23 % of learners lie beyond ±0.75 at f = 0.5, 50 % at f = 0.9 and 67 % in the sparse profile, and with §4.3's settings 11 %, 28 % and 53 % of fitted offsets sit at the cap (Rotate's angle, sparse: 75 % and 32 %). Offset errors grow from 0.40 step (RMS) at f = 0.5 to 0.6–0.9 step in the uneven profiles.
4. **Do the ridge prior (0.5 × step) and the cap (±0.75 logit) look right?** For even and mildly uneven players, yes: at f = 0.5 all settings tested give 94–95 %, and the tight one keeps even players' worst level at 3.3 points. For profiles like the paper's they are too tight: they recover only a third to a half of what the oracle gains over the current engine (f = 0.9: 84.6 % against 98.4 %; sparse: 75–78 % against 98 %), and widening them helps those players (up to 90 % and 80–85 %) but costs even players, whose worst level drifts to 5.8–7.6 points off, beyond §4.4's 5-point check. No single constant serves both; the paper's model gives the way out: estimate each dimension's spread from the pooled exports and use it as that dimension's prior. Even then, strongly uneven profiles stay well short of the oracle with a session-end fit on 400 answers; the leading-dimension rotation of §4.3 item 3, which this spike does not include, should spread the levels and help, and the engine simulation should test that.
5. **The acceptance at f = 0.5 has little margin.** §4.3's settings reach 94.1 % on the current engine against a threshold of 94 %.

### Proposals [Proposal]

- **Ship 0.5 × step and ±0.75 logit as the starting values,** since they protect even players and bound what a shortcut can do (§4.4). Log, per dimension, how often fitted offsets sit at the cap; above about a quarter of honest players, that dimension is more uneven than the prior allows.
- **Fit a random-weights LLTM per exercise on the pooled exports** (each dimension's step random over players, marginal likelihood). Where a dimension's spread comes out near zero, fix it, as the paper does. Elsewhere use the fitted spread as that dimension's ridge prior SD and set its cap to about 2.5 of that spread at the top level, so that it binds for about 1 % of honest players. These spreads are the f this note could only assume.
- **Milestone 7's simulation:** keep the f = 0.5 acceptance, add an even profile (f = 0: no dimension level more than 5 points off) as a gate, and report the f = 0.9 and sparse profiles (f = 1.6 on one dimension that switches method) without gating them. Let the simulated learners' deviations correlate with ability (about −0.5) in one run.

### Terlecki et al. in §1.1

The full text (read for M1; see M1's Addendum) supports §1.1's summary with two corrections: the later growth belonged to the inexperienced women, while the experienced women grew steadily; and the Tetris group's final score on the rotation test was not reliably higher, rather than the same. Gains were large and still rising after 12 weekly tests, and about 55 % of the test-only gain remained 2–4 months after testing stopped.
