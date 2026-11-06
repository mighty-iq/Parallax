# How the Parallax engine works

The engine (`js/engine/*.js`) decides what you practise next, keeps your levels honest and measures change on the Spatial Check. It is pure code: it never reads the clock, the screen or storage, and it never uses `Math.random`. Every call receives the time (`now`, in ms) and the learner record; functions that change the record say so, and the app saves the record afterwards. All randomness comes from seeded `PX.rng` streams, so the same record, times and answers always give the same items and results.

This file explains each part in plain words, with the formulas, the defaults and where they come from. The research notes behind the defaults are in `research/` (A evidence, B tasks, C progression, D motivation). All defaults live in one object, `PX.engine.config`.

## 1. The item model

Every exercise describes its items by difficulty dimensions (angle, number of cubes, folds…). The difficulty of an item in logits is

    b = base + Σ step × level index   (+ variant offset and interaction terms when the exercise defines them)

This is a linear logistic test model (LLTM): difficulty is predicted from the item's features, so an item never seen before still has a predicted difficulty (Fischer 1973; six features reproduced mental-rotation difficulty at r = .90 in Rajeb et al. 2025). The steps are set by hand for now; every trial logs its predicted success so pooled data can refit them later.

The chance of a right answer for ability θ is

    P(right) = g + (1 − g − 0.03) · σ(θ − b)

where g is the guessing rate of the format (¼ for four options, ½ for yes/no, 1/6 for "pick the two that match", about 0 for open answers), σ is the logistic function and 0.03 is a lapse rate: even a very able player sometimes slips (PLAN §5).

## 2. Your rating

Each exercise keeps a belief about your ability: a normal distribution with mean μ and spread σ (Track and Homing keep one per screen class, 'small' below 600 CSS px on the short side, because viewing distance changes their difficulty).

- **Start.** μ₀ = the easiest item's difficulty + 1.0 and σ₀ = 1.0, so the first items come from the easy end and the first ten or so answers move the rating quickly (C §9b).
- **After each answer** the belief is updated by Bayes' rule and summarised again as a normal distribution (moment matching on a grid of 121 points spanning μ ± 6σ inside −8…+8 logits). This is the Kalman/Glicko idea with one answer per step: big moves while the rating is unsure, small ones once it has settled.
- **Learning and forgetting.** Before each update the variance grows by 0.002 per answer and by 0.01 per day without practice (capped at 1.0). Without this the rating would freeze and lag behind someone who is learning (C §2, §9b; Glickman's rating deviation grows the same way).
- **What never counts.** Answers marked as stuttered (frame drops, a lost graphics context, an item built by an exercise's last-resort construction) or skipped never change a rating, a staircase or an achievement. Free play, Threshold runs, the Daily Challenge and the Spatial Check never change a rating either. Speed mode updates its own timed rating only.

The simulation (§16) checks that the 95 % range μ ± 1.96σ holds the true ability about 95 % of the time.

## 3. Levels 1–100

Your level on an exercise is the difficulty you would answer right with probability g + (1 − g) × 0.75, placed on that exercise's own range of difficulties: level 1 is its easiest item, level 100 its hardest. The reference is fixed, so changing your style (§4) never changes your level. The level comes with a likely range from μ ± 1.96σ, and with the real settings at that difficulty ("120° turns, 10 cubes"). The app shows level changes at the end of each block of 10 answers, not after every answer. Levels compare you with your own past on one exercise; they are not scores against other people, and they say nothing about IQ.

## 4. Choosing the next item

**Target.** Items aim at a success rate p* = g + (1 − g) × k, where k is set once by your style (C §1, Wilson et al. 2019; Pelánek et al. 2017; Jansen et al. 2013):

| Style | k | 4 options | yes/no | open answers |
|---|---|---|---|---|
| Comfortable | 0.85 | 89 % | 93 % | 85 % |
| Balanced (default) | 0.70 | 78 % | 85 % | 70 % |
| Stretch | 0.55 | 66 % | 78 % | 55 % |

**Mix.** In every deck of 10 items: 8 at p*, 1 easier at p* + 0.10 (at most g + (1 − g) × 0.95) and 1 stretch at g + (1 − g) × 0.5. Sessions open with two easy warm-up items and close on an item at p* + 0.10.

**Which item.** Every combination of settings gets its predicted success under your rating, averaged over its uncertainty. Combinations within ±0.05 of the target count as equally good, and variety decides among them: the default prefers the settings and variants used least recently and combinations seen rarely; "low variability" changes one setting at a time from the previous item. The last three combinations are not repeated while another one lies within 0.05 of the best match available (`config.select.slack`). At the floor or ceiling of a pool every other combination lies on the same side of the target, so there the closest settings come again, with new items, rather than drifting further from the target. Spin and Rotate never show the same angle level on two consecutive items while another level is within ±0.05 of the target, because a varied angle weakens a long-axis cue an observer could otherwise exploit (`config.select.noRepeat`, or a definition's own `noRepeat`). Where an exercise's answer type depends on its variant (`def.answers`, e.g. same/different is yes/no, pick-two is multiple), the engine uses the item's or the variant's type. The guessing rate is always the item's own, `def.chance(params)`, in the target, the prediction and the rating update (Spin and Rotate differ by variant, PR-3 by question type).

**Weak spots.** For every level of every dimension the engine tracks how your answers compare with their predictions. A level is flagged when its mean difference is below −0.10 and more than two standard errors below zero, over at least 15 answers; a fifth of target items then come from a flagged level when one is near the target.

**Seeds.** Every training and Free play item gets a new seed from a counter and a per-page-load salt (10 bits, fixed by the first plan a page starts) passed through a reversible mixing function, so a record never sees the same training seed twice, and two tabs on one record draw different items. If the counter is ever lost, the engine reads it back from the logged seeds. Daily and Spatial Check items use a separate half of the seed range and no page salt, so they stay the same for everyone; friend challenges and worked examples bring their own seeds. Every seed is logged with its trial, so replays keep working.

## 5. Train sessions

**Three exercises** (C §9d): a focus exercise (the one you pinned; else, while some exercise is untried, the next untried one in the beginner order Rotate, Fold, Spin, Nets, Views, Slice, Orient, Hidden, Span, Track, Homing; else the one with the highest learning progress), a review exercise (the most overdue on a 3, 7, 14, 30-day schedule; the interval grows when you practise it while due) and a variety exercise (the least practised). Untried exercises fill the review and variety slots in the same order when nothing is due, so all eleven are tried within the first five sessions, visuospatial ones first. `plan.roleOf` maps each exercise to its role, `'new'` for an untried one that is not pinned.

**Learning progress** = (μ now − μ 60 answers ago) / √(σ²now + σ²then), clipped to ±2; exercises with fewer than 60 answers count as 1.5, so new ones get tried. It is measured on the rating, because success itself is held at the target.

**Shares.** The three exercises share the trials by a softmax of their scores (learning progress, +1 when a review is due, more the longer an exercise has rested), with every share kept between 20 % and 50 %. Each new run picks the exercise by its remaining share, and 15 % of picks are random among the open ones. A session started from "Train this exercise" (`opts.pin`) always opens with that exercise: the warm-ups, then its first block. This keeps the evidence-backed part of the learning-progress bandit while making sure no skill starves (Clément et al. 2015 found a bandit that starved a hard skill).

**Length.** Your session time becomes a number of trials using an expected time per trial for each exercise. When an exercise's duration depends on its settings (Track's tracking time, Span's sequence length, Homing's route), it gives `def.estMs(params)`, the time from the first paint to the answer, evaluated at the item the session would choose now; the engine adds 2.5 s between trials, and once 10 of your trials are timed, your own median extra time instead. Without `estMs`, it uses your own median time per trial once 10 exist, and defaults by answer type before that. If you take longer, the session still ends on time with its closing item.

**Interleaving stages** (Porter & Magill 2010; Brunmair & Richter 2019), per exercise:

| Stage | Runs | Notes |
|---|---|---|
| S1 | 20 items | one variant per run |
| S2 | 10 | variants mixed |
| S3 | 5 | |
| S4 | 2 | alternating with a similar-looking exercise, without a name banner |
| S5 | random | about 70 % of trials switch exercise |

Similar-looking groups: {Fold, Nets, Slice, Views, Hidden} and {Rotate, Spin, Orient}. An exercise moves up one stage at the end of a session once it has 40 answers and σ ≤ 0.45, and moves back one when the last 20 trials right after a switch fall more than 0.10 below their predicted success. Stretch starts at S3. Every trial row records the stage.

## 6. Path

Ten stages per exercise, one for each tenth of its difficulty range, practised blocked. The first item of a new stage asks the app to show the Watch demo and names the stage's settings. Target items come from the stage; warm-up and easier items may come from earlier stages, stretch items also from the next one (so the rating keeps learning when you are far above a stage).

A stage is passed when all of these hold (Pelánek & Řihák 2018; Bloom 1984):

- at least 10 items at the stage;
- the moving average of right answers (decay 0.85, starting at 0.6) reaches g + (1 − g) × 0.80: 0.80 for open answers, 0.85 for four options, 0.90 for yes/no. When formats mix (Spin and Rotate variants), the bar is the same moving average of each answered item's own threshold;
- your rating predicts at least 0.80 success above chance on the stage's items, averaged over the rating's uncertainty.

Passed stages come back for a recheck of 5 items after 3, 7, 14, 30, 60 and then every 90 days. A stage holds while the rating predicts at least 0.70 above chance on it; otherwise it reopens and its interval starts again at 3 days. No text ever calls a skill finished or learned for good.

## 7. Threshold

One parameter moves on a staircase while the others stay fixed. Results go to `rec.mot[protocol]`, with every trial's exact value, and never change a rating.

- **Weighted up-down** (Kaernbach 1991): after a success the parameter gets harder by 0.025 log10 (0.015 when p* > 0.8), after a miss easier by that step × p*/(1 − p*), so it settles where success = p*. Both steps are doubled until the second reversal. Estimate: the mean of the reversals after the first two.
- **Track standard** (Legault, Allard & Faubert 2013): 8 spheres, 4 targets, 8 s of tracking, 2 s cue, still camera, 1-up/1-down in 0.05 log10 steps, 20 trials, threshold = geometric mean of the speeds at the last 4 reversals: the speed tracked fully right half the time. The preset comes from the exercise itself (`lib.STANDARD`), and the speed is continuous (`params.speedValue`).
- **Span length**: 2-down/1-up on the length, which settles near 70.7 % right (Levitt 1971), after a fast start that goes up one length per right answer until the first miss.
- **Spin deadline**: a weighted staircase on the response deadline, with Speed's items and target (§8), on one variant (`opts.variant`, else the first) so that every item has the same guessing rate and the staircase one target.

Each run starts 0.1 log10 easier than your last estimate (C §9b).

## 8. Speed

Speed opens for an exercise once a Path stage is passed, or after 60 answers with σ ≤ 0.45. Items come from settings you answer at least 85 % right above chance untimed (g + (1 − g) × 0.85: 92.5 % for yes/no, 85 % for open answers), because the deadline is the challenge (C §7, Wright et al. 2008). The deadline aims at your style's target but at most g + (1 − g) × 0.70, so it always sits below the items' untimed success (Comfortable's target would otherwise equal the fluency bar). A session keeps to one variant (`opts.variant`, else the first), so every item shares one guessing rate and the deadline staircase one target; the last deadline carries over within that variant. The first deadline is 1.5 × your median untimed time for right answers; after a right answer in time it shortens by 0.02 log10, after a miss or a time-out it grows by 0.02 × p*/(1 − p*). Speed keeps its own timed rating, on items whose difficulty grows by 1 logit for each halving of the deadline relative to your reference time. Each session reports right answers in time per minute, points S = (2x − 1)(1 − t / deadline) (fast errors cost most; Klinkenberg et al. 2011) and the balanced integration score BIS = z(success) − z(time) against your first three timed sessions (Liesefeld & Janczyk 2019).

## 9. Free play and the Daily Challenge

**Free play**: you choose the exercise and either fixed settings or adaptive items. Everything is logged; no rating changes.

**Daily Challenge**: the same 8 items for everyone on a UTC date: exercises and seeds come from the date alone, each at the combination nearest the middle of its range. Track and Homing are left out because their difficulty depends on the screen. One scored attempt a day; replays are practice. The share line reads `Parallax Daily #N · x/8 · discord.gg/chmr`, with #1 on 1 November 2026.

## 10. The Spatial Check

Probes are tasks that are never trained and never give feedback. Each is a short adaptive test of 16 items; the next item aims at g + (1 − g) × 0.6 under the current estimate, and the first two items of each probe at g + (1 − g) × 0.85, so a probe opens on easy items right after its worked example. θ and its standard error come from the exact posterior over a grid, with the known item difficulties and the same prior every time (normal, centred on the middle of the probe's range, SD 1.5), so forms that differ only in their seeds remain comparable. The median time of right answers is reported separately. Forms A, B, C rotate. The first item of each probe carries its worked example (`step.probe.example`, from the probe's `learn.js` demo) for the app to play first; the example is never scored, and check items never use a demo seed. A timed-out item is scored wrong.

**Schedule.** Two baseline checks (the second from about 12 hours after the first); a third when the first two differ by more than 2 combined standard errors. Then a check every 14 days or 8 sessions, whichever comes later, and a delayed check about 4 weeks after training stops or slows. Sessions count by the weekly-goal rule (§12) in a training mode. `PX.engine.assess.nextCheck(rec, now)` gives every screen the same answer: `{ ready, kind, dueAt, dueDate, daysLeft, sessionsLeft, why }`.

**Retest familiarity** (Scharfen et al. 2018: +0.33 SD at the second test, +0.50 by the third, then flat). With G = B2 − B1, your own gain from the first to the second check, the model expects retest gains of 0, G and 1.5 G at tests 1, 2 and 3 and nothing more afterwards. Change is measured from the average of the baseline checks, so the retest part still inside a later change is max(0, G) × (1.5 − the mean of 0, 1, 1.5 over the baselines taken): G after two baselines (the second baseline already sits G/2 above their average and G/2 more is expected), 2G/3 after three. The report shows the remaining gain after the second check, 0.5 × max(0, G), as well.

**The words.** For each probe and for the composite (the mean of the four spatial probes; its standard error is √(Σ SE²)/4):

- **beyond familiarity** when the lower end of the 95 % interval clears the control probe's change and also clears the expected retest gain;
- **no change** when even the upper end of the change beyond the retest gain is below 0.25 logits;
- **unclear yet** otherwise. This is the usual result for a single check, and it is not the same as no progress.

The control probe is a word task (verbal analogies), which measures familiarity with testing and motivation. Next to the probes the report shows level changes on trained exercises since the baseline. Never an IQ, an index, a percentile or a brain age.

## 11. Lab crossover

An optional self-experiment: cluster A (Rotate, Spin, Fold, Nets, Slice) and cluster B (Views, Orient, Span, Hidden, Track, Homing) in a random order, 3 weeks each, with checks at week 0 (twice), week 3 and week 6. During each phase Train sessions use only that cluster. `PX.engine.lab.changes(rec)` returns each phase's probe changes and, per probe, the difference "change while training A − change while training B" with its standard error. One person's result is noisy; pooled exported files can answer the question for the community.

## 12. Weekly goal and streak

A goal of 2–6 sessions a week (default 3; Lampit et al. 2014 found no added benefit beyond about three a week). A session counts with 10 answers or 5 minutes. Weeks run Monday to Sunday. One missed week in any four is forgiven automatically, and a missed week that grace cannot cover is repaired for free by doing goal + 1 sessions in the following week. The streak is computed from the sessions each time, so it cannot drift, and the wording is always informational, never a warning about loss (Silverman & Barasch 2023). There is no daily streak.

## 13. Achievements

24 milestones for skill and good practice with visible criteria, such as: a first session, every exercise tried, a weekly goal met, 12 practice days in 90 days, two baselines, three checks 12 days apart, a check after training slowed, both strategies reported on one exercise, a backup downloaded, Path stages 3 and 10, a stage still holding after 30 days, level 50 once settled, level 20 on every exercise, an item from the hardest tenth answered right, Track with five targets among ten spheres, a span of seven, a Threshold run, a Speed session, and a new best block. Nothing rewards time spent. Only right answers count for skill milestones; stuttered or skipped trials never do.

## 14. Session summaries and personal bests

The summary compares a session only with your own past: per exercise the level at the start of the session and now, with the usual noise ("within the usual session-to-session noise (±5)" or "a clear change"), and a reminder that success is held near the target on purpose, so the level, not the score, shows progress. Every level a session shows comes from one function, `est.shown` (the stored rating's level and range, without idle drift): the block-end notes, the summary (whose "after" equals the last note's when no item followed it) and personal bests. A personal best is the level shown at the end of a whole block of 10 answers on one exercise whose success reached the level reference, so it is always a level you have seen. Partial blocks never count.

## 15. The learner record

Engine-owned top-level fields, registered with `store.field()` by app.js from `PX.engine.fields()`: `eng` (seed counter), `train` (style, variability, pins, stage per exercise, recent switch trials), `path`, `timed` (Speed ratings and deadlines), `strategies` (check-ins: `{ exId, strategy: 'whole' | 'parts' | 'unsure', t }`), `spatial` (baseline expectations) and `lab`. Ratings and their memory (history per day, snapshots, recent items, weak-spot residuals, review dates) live in `rec.ex[id]`. Threshold results use `rec.mot`, the weekly goal `settings.weeklyGoal` with its history in `rec.streak`.

Trial rows: `[tSec, exIndex, modeIndex, paramsCode, seed, outcome, rtMs, value, pPredMilli, stage]`, with exercises indexed as `"id@version"`. Two tabs merge with `PX.engine.merge(theirs, mine)`: trials, sessions, achievements, Daily results, checks, Threshold results and check-ins are united (trial rows are re-indexed into the merged name lists); each rating comes from the side with more trials; settings and preferences from the newer side; the seed counter takes the larger value.

## 16. What the simulations show

`node tests/node/sim.mjs --learners 200` plays 200 simulated learners for 60 days in each mode, on fixture exercises shaped like the real ones. Each learner has their own starting abilities, learning curves, day-to-day noise, breaks with forgetting, guessing, lapses, switch costs and response times; they practise 2–6 times a week, take the Spatial Check when due and play some Daily Challenges.

Results on 6 November 2026, 200 learners × 60 days per run (`--json out.json` keeps every number):

| Run | Target items: success vs target | Where the pool reaches the target | 95 % intervals hold the true ability |
|---|---|---|---|
| Train, Comfortable | 86.2 vs 88.5 % (−2.3 points) | −0.1 (74 % of items) | 95.4 % |
| Train, Balanced | 78.0 vs 77.0 % (+1.0) | +1.3 (92 %) | 96.2 % (rms z 0.94) |
| Train, Stretch | 67.6 vs 65.5 % (+2.1) | +2.0 (92 %) | 96.3 % |
| Train, misspecified items¹ | 77.5 vs 77.0 % (+0.5) | +1.0 (91 %) | 91.5 % (mean μ − θ −0.28) |
| Path | 77.5 vs 77.5 % (+0.1) | +0.3 (73 %) | 98.2 % (rms z 0.81) |

¹ Balanced, with every item's true difficulty off by N(0, 0.5²) plus a +0.8 logit interaction of the first two settings at their maxima.

- **Comfortable's gap is the floor of the item ranges.** These learners start about 1.75 logits above the easiest settings, where even the easiest item predicts less than 88.5 %; 77 % of the items that miss lie within 0.3 logits of the easiest. With level 0 made 0.75 logit easier (the same learners, `--runs comfortable-easier`), Comfortable reaches 88.8 vs 88.4 % (+0.4).
- Success runs 1–2 points above target in Balanced and Stretch because ratings start below these learners' ability and catch up from below (mean μ − θ about −0.15).
- **Path** (each learner on three favourite exercises): stage 1 passed for 95.7 % of learner × exercise pairs (median day 3, 133 rated answers), stage 2 88.5 % (day 5), stage 3 76.2 % (day 8, 328), stage 5 50.5 % (day 13, 489), stage 7 25.5 % (day 19), stage 10 4.8 % (day 22, 825). Rechecks held 6 455 times and reopened a stage 404 times. Path's intervals run wide (98 %) because its items often sit below the learner, where an answer says little.
- **Speed**: in-time success after each session's first 10 trials 78.4 vs 77.9 % (+0.5 points, 2 996 sessions).
- **Threshold** (truth from the learner model, log10 units unless noted): Track standard bias −0.004, RMSE 0.12 (63 % within ±0.1); Track at the target success bias −0.03, RMSE 0.19; Span length bias +0.03, RMSE 0.87 lengths (76 % within ±1); Spin deadline bias +0.04, RMSE 0.27. A deadline staircase at a high target success is the noisiest, so a single Spin deadline run is a rough guide.
- **Free play**: 3 210 sessions, none changed a rating.
- **Spatial Check**: the probes' 95 % intervals hold the true probe ability in 97 % of results. Without transfer, "beyond familiarity" appears for about 0.06 % of learners (1 in 1 600 across the eight runs without transfer; at most 0.5 % in any single run), now that the familiarity estimate carries its own standard error. With transfer (probe ability rising by half the training gain), 97 % are still "unclear yet" after 60 days (87 % before that change): one person's 16-item probes are noisy, which is why the report says "unclear" rather than "no progress".
- **Everywhere**: no repeated seeds, no dead ends, every exercise practised by every learner in the Train, Speed, Threshold and Free runs, streaks and achievements consistent, and records of at most 0.96 MB after 60 days (median about 0.32 MB).
- **Defaults set from these runs**: process noise 0.002 per answer and 0.01 per idle day (0.001, 0.0015 and 0.002 per answer gave 93.5, 94.8 and 95.8 % coverage on 40 learners); `select.slack` 0.05 (before it, when the closest settings had just been shown, the next item could sit up to 0.17 off target, which cost Comfortable another point; now the closest settings come again with new items: about one Comfortable target item in five repeats one of the last three settings, one in ten in Balanced, measured on 30 learners × 40 days).

## 17. For app builders

    plan = PX.engine.modes.start(rec, mode, { now, minutes, display, style, can, exId, variant, protocol, params })
    step = PX.engine.modes.next(plan, rec, now)                 // { done } or an item to show
    item = PX.ex.get(step.exId).generate(PX.rng(step.seed), step.params)
    out  = PX.engine.modes.answer(plan, rec, step, { correct, rt, value, outcome, fallback }, now)
    res  = PX.engine.modes.finish(plan, rec, now)               // session, summary, achievements, streak
    store.save()

- `answer()` appends the trial row to `rec.trials` itself (with the index lists); do not add it again with `store.addTrial`. Save after `answer()` and `finish()`, never during a stimulus phase.
- `mode`: train, path, speed, threshold, free, daily, check. `plan.unavailable` explains when a mode cannot run.
- Show `step.banner` (the exercise name) only when it is true; ask for the Watch demo when `step.watch` is true; give no feedback when `step.feedback` is false; impose `step.deadlineMs` when set.
- Report stutters, voided items (`item.fallback`) and emergency skips as `outcome: 'stutter' | 'voided' | 'skipped'`; they are logged and replaced, never rated. Report a time-out as `timeout: true`: it is scored wrong, never as a skip.
- Spatial Check: before the first item of each probe, play `step.probe.example` (the probe's worked example) unscored, then show the item. Speed and the Spin deadline protocol take `variant` (else the first).
- Show level changes only from `out.blockEnd`. Ask the strategy check-in when `PX.engine.modes.checkinDue(rec, plan, exId, now)` is true and record it with `PX.engine.modes.checkin`.
- Today screen: `PX.engine.modes.available(rec, now, { can, display })`; a Train plan's `plan.roleOf[id]` labels each exercise (`'new'` for untried ones); the next check from `PX.engine.assess.nextCheck(rec, now)`; sessions this week from `PX.engine.streak.status(rec, now).week` (`{ sessions, goal, left, met, days }`, counting by `PX.engine.streak.counts(session)`: at least 10 answers or 5 minutes); Progress: `PX.engine.stats.overview / profile / curve`, `PX.engine.assess.report`, `PX.engine.streak.status`, `PX.engine.achievements.list`.

## Sources

Bloom 1984; Brunmair & Richter 2019; Clément et al. 2015; Fischer 1973; Glickman (Glicko-2); Jansen et al. 2013; Kaernbach 1991; Klinkenberg et al. 2011; Lampit et al. 2014; Legault, Allard & Faubert 2013; Levitt 1971; Liesefeld & Janczyk 2019; Pelánek 2016; Pelánek et al. 2017; Pelánek & Řihák 2018; Porter & Magill 2010; Rajeb et al. 2025; Scharfen, Peters & Holling 2018; Silverman & Barasch 2023; Wilson et al. 2019; Wright et al. 2008. Full references and the caveats on each are in research/A-evidence.md, research/C-progression.md and research/D-motivation.md.
