# P1: Plateaus, stall detection, stall-breaking, multi-dimensional difficulty, progression modes

Phase 1 research notes for Parallax v1.2. Started 2026-11-18 (UTC). Status: in progress.

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

(to fill)

## 3. What breaks a stall (Q3)

(to fill)

## 4. Progress on every dimension (Q4)

(to fill)

## 5. Progression modes: "right when" and suggestion signals (Q5)

(to fill)

## 6. Simulation plan (what to test before shipping)

(to fill)

## Sources

(to fill)

## Could not open

(to fill)
