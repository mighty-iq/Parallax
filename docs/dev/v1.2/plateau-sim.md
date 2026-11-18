# Plateau simulation for PLAN milestone 3 (W2-plateau)

Written 2026-11-18 (UTC) by the W2-plateau builder. Sources: docs/dev/PLAN.md milestone 3 (its acceptance lines), note P1 (docs/research/v1.2/P1-plateaus-progress.md §2.4–2.6, §3.9–3.10, §6). Code: js/engine/plateau.js (the detector, the decision table, the changes, trial periods and verdicts), tests/node/sim-plateau.mjs with tests/node/fixtures/learner-plateau.mjs (the runs, by hand). Every number below comes from a run listed in §9, seed 1.

## 0. In short

| PLAN milestone 3 acceptance line | Train | Path | Result |
|---|---|---|---|
| ≤ 5 % false alarms at ≥ 0.25 logit per 100 answers (flagged by answer 1,000) | 1.5 % (6/400) | 1.3 % (5/400) | pass |
| about 5 % at 0.20 | 4.8 % (19/400) | 4.5 % (18/400) | pass |
| ≥ 65 % of plateaus caught within 600 answers of onset | 67.5 % | 69.4 % | pass, by 2.5 and 4.4 points |
| ≥ 90 % within 800 | 86.9 % | 87.9 % | **fails by 3.1 and 2.1 points** (§3, levers in §6) |
| no flag in the first 640 answers | earliest at 641 | earliest at 643 | pass |
| no flag at the ceiling | 0 plateau or faster events among 120 learners 2.5 logits past the pool's top (118 heard "top of the range") | | pass |
| no flag inside a trial period | 0 of 662 events | 0 of 966 | pass |
| no flag across a break of more than 14 days | 0 of 177 flags of learners with a 15–30-day break; the widest gap inside a flagged window 13.8 days | | pass |
| "clearly up" for ≤ 5 % of non-responders | 0.3 % (1/372) | 2.6 % (10/391) | pass |
| the card shows in a longrun | tests/e2e/plateau.py: 30 passed, 0 failed (1366 × 768 and 360 × 640; other builders' screen hooks muted) | | pass |

What does not hold: **the 800-answer line**, by 2–3 points, because the slowest formats sit below it: the yes/no exercise (Nets: 78 % Train, 70 % Path) and, in Train, Fold, Orient, Hidden and Slice at 82–86 %, while Rotate, Span and Views reach 92–96 %. The slope's standard error is calibrated (§2), so there is no free speed-up: every lever tried buys the 800 line with false alarms or with an assumption (§6). The rule stays as the plan specifies (W 640, z 1.645, δ 0.15, φ estimated per window) until the lead decides.

## 1. What the runs do

- **The engine.** Every learner plays through the real E.modes (with every hook, js/engine/plateau.js included) on the fixture exercises of tests/node/fixtures/exercises.mjs. The detector runs in the finish hook as in the app; its events start their changes (a drill, a stage moved, rest days…) and trials, as in the app. The base of the runs is commit d1a5579 (a snapshot outside the repository, the plateau files on top), before the wave-2 trial columns: rows without a kind or deadline column take the format-1–3 path of the detector (stretch items found by their logged prediction); the lever and report runs use the same base.
- **The learners** (tests/node/fixtures/learner-plateau.mjs): the shared learner model (day-to-day noise N(0, 0.15²) per day, lapses U(0.01, 0.06), guessing, switch costs U(0, 0.25) logit, response times, the other exercises' own learning curves) with one focus exercise whose true ability follows a set shape of the number of answers given on it: linear at a slope s (0.10–0.30 logit per 100 answers); a plateau (a rise of 0.3 per 100 answers, flat from an onset drawn uniformly in answers 200–900; nothing a change does helps: the non-responders); responders (a plateau with onset 200–700 that ends after a change: a dip of 0.2 logit for 40–80 answers, then +0.6 logit within 30 answers, or the rise resumed); a step (flat, +0.6 at answer 700); a level 2.5 logits past the pool's hardest items; and the same shapes with one break of 15–30 days (days 30–70) and forgetting. Learners start 1.0 logit (± 0.4) above the pool's easiest item, so a linear learner stays inside the pool for its first 1,000 answers. The focus cycles through Fold, Rotate, Nets, Orient, Span, Views, Hidden and Slice (four options, yes/no and pick-two, angles, sequences, a guessing rate of 0.2, a custom difficulty with interactions).
- **The calendar ('note').** 120 days; 3 or 4 sessions a week (10 % of playing days hold two); from week 2 a 12 % chance each week of a break of 5–11 days. Train: 15- or 20-minute sessions with the focus pinned ("Train this exercise": the real rotation of three exercises, interleaving stages and switch costs; the focus gets 13–57 answers a session, as in note P1 §2.3); Path: 4–6-minute sessions on the focus (about 40–60 answers; 8-minute sessions hold about 80, too many for 8 sessions in a 640-answer window). The option `--calendar sim` would use tests/node/sim.mjs's breaks of 5–15 days instead (not run; §7).
- **Counting.** A *flag* is a plateau or faster event. False alarms: linear learners flagged at least once by their 1,000th answer (note P1 §2.5's measure); flags over the whole run are reported too. Caught: the first flag after the onset, counted among learners observed that long (caught by then, or still playing 600 / 800 answers after the onset; 5–11 of 400 ran out of days before that). Structural checks scan the record with code of their own, not the engine's: every flag's window holds 640 eligible answers on at least 8 sessions and 8 local days, no gap of more than 14 days, nothing older than the end of the previous event, no open trial; every verdict with a comparison came after at least 3 sessions and 120 answers.

## 2. False alarms

| Slope (logit per 100 answers) | Train: by answer 1,000 | over the run | Path: by answer 1,000 | over the run |
|---|---|---|---|---|
| 0.10 | 49.2 % (120 learners) | 86.7 % | – | – |
| 0.15 | 22.5 % (120 learners) | 60.0 % | – | – |
| 0.20 | 4.8 % | 11.3 % | 4.5 % | 17.5 % |
| 0.25 | 1.5 % | 2.8 % | 1.3 % | 2.8 % |

Slopes from 0.05 to 0.20 are the indifference zone of note P1 §2.5 (it found 19 % at 0.15 and 61 % at 0.10 on Fold): flags there are reported, not promised away; a learner improving at 0.10 per 100 answers gains about 2.5 levels per 100 answers on a 4-logit exercise, and a change after a long, nearly flat stretch is what the design intends. Over the run a learner gives a median of about 2,250 (Train) to 3,150 (Path) answers on the focus, so the detector looks two to three times as often as by answer 1,000 and false alarms grow with the looks; the plan's lines are per 1,000 answers (note P1 §2.5), and so is this table's first column. A false alarm costs a change and a trial of 3 sessions; its verdict then reads "clearly up" for 55–73 % of those still-improving learners, which is the honest result.

**The standard error is calibrated.** At every look between answers 700 and 1,100 of 80 linear learners at 0.25 (Train), (β − 0.25)/SE had a mean of −0.04 and an SD of 0.98 over 713 looks; the median SE was 0.054 (Span, open answers) to 0.100 (Nets, yes/no), 0.065–0.076 for the others (note P1 §2.5: about 0.075). The estimated over-dispersion φ had a median of 1.00–1.27 and a 90th percentile of 1.4–2.0 (the day-to-day noise alone gives about 1.07).

## 3. Detection

| Run | Caught within 400 / 600 / 800 answers | Delay quartiles (answers) | Flagged while still rising | Never flagged |
|---|---|---|---|---|
| Train | 13.4 / 67.5 / 86.9 % | 449 / 516 / 634 | 0 | 15 of 400 (11 ran out of days) |
| Path | 12.5 / 69.4 / 87.9 % | 446 / 524 / 638 | 0 | 4 |

By exercise (within 600 / 800): Train: Fold 61/86, Rotate 64/92, Nets 51/78, Orient 74/84, Span 82/96, Views 68/96, Hidden 71/82, Slice 69/83; Path: Fold 70/82, Rotate 70/94, Nets 38/70, Orient 76/92, Span 76/96, Views 82/92, Hidden 67/84, Slice 76/94. The note's simulation (one exercise at a time, no rotation, onset at answer 320) had 68 % and 93 % on its worst exercise of Fold, Rotate and Knots; it did not run a yes/no-only exercise, which carries about half the information per answer of four options (note P1 §2.2) and is caught last here.

## 4. Preconditions

Checked on every flag by the simulation's own scan of the record (not by the engine's code):

| Run | Flags | Window under 640 answers | Fewer than 8 sessions or days | A gap of more than 14 days inside | Inside a trial period | Earliest flag (answers given) |
|---|---|---|---|---|---|---|
| plateau, Train / Path | 662 / 966 | 0 / 0 | 0 / 0 | 0 / 0 | 0 / 0 | 647 / 643 |
| linear 0.20, 0.25, Train and Path | 46, 11, 70, 11 | 0 | 0 | 0 | 0 | 641–673 |
| a 15–30-day break with forgetting: a plateau / an improver at 0.25 | 154 / 23 | 0 | 0 | 0 (widest 13.0 / 13.8 days) | 0 | 647 / 669 |
| 2.5 logits past the pool's top | 0 plateau or faster flags; 345 ceiling events (118 of 120 learners, a median of 3 each, one per window) | | | | | |

After a break of more than 14 days the window starts after it, so the next evaluation needs another 640 answers: learners with a long break were caught later (break runs, §9), which the plan accepts. Rows without a session in the record never occurred in these runs.

## 5. Changes and verdicts

- **Non-responders** (the plateau runs): the first verdict read "clearly up" for 0.3 % (Train, 1 of 372) and 2.6 % (Path, 10 of 391); "no change yet" for 11.3 % and 10.5 %; the rest "unclear yet". Over all verdicts, 0.8 % and 1.7 %. With the lower 95 % bound as the rule, about 2.5 % is the expected rate.
- **Trial periods**: 3 sessions in the median (quartiles 3 / 3 / 4) and 131–169 answers (quartiles); no verdict with a comparison came before 3 sessions and 120 answers; 10 (Train) and 13 (Path) periods were cut by a gap of more than 14 days and ended "unclear yet" without a comparison. A dip in a period's first session never ends it early: periods end only on their sessions and answers.
- **Second stalls**: 214 (Train) and 332 (Path) learners stalled again after a trial; none got the same change again while another was eligible, except after a "clearly up" (five in Path), when the list of tried changes starts again by design.
- **The draw**: in Train, rows 1–4 answered 179 of 662 events (stage back 103, Speed inside Train 44, rest 20, drill 12); rows 5–8 were drawn in 483 (the other strategy 220, stage forward 111, wider mix 76, new variant 70, aim higher 6). In Path, where Train's changes do not apply, 936 of 966 were drawn. Each change, when eligible, was drawn at about its share of the eligible set (for example the other strategy 220 of 400 times eligible in Train, mostly beside one or two others).
- **Selective responders** (a plateau that ends only after "the other strategy": a dip of 0.2 for 40–80 answers, then +0.6 within 30 answers; 200 learners): the first verdict read "clearly up" after the other strategy 10 of 58 times (17 %), after any other change at most 1 of 34 (wider mix 0/32, stage forward 0/23, new variant 1/19, stage back 1/34, …). Pooled over players, the logged draws show which change helped; for one player, a three-session trial catches a gain of this size about one time in six, because the period's level averages the dip and the gain (the SE of the difference is about 0.3 logit).
- **Responders to any change** (the same dip and +0.6 jump; 120 learners): the first verdict read "clearly up" 12.2 % of the time (14 of 115), "no change yet" for some, "unclear yet" for most. A trial of 3 sessions and about 140 answers detects a gain of 0.6 logit about one time in eight here; larger or faster gains read "clearly up" more often. The words stay honest either way: "unclear yet" is the usual result, never "it did not work".
- **Faster answers** (a flat level, right answers 15 % faster per 100 answers; 100 learners): 98 of 100 first flags were 'faster' events (Speed suggested), none a plateau; one plateau event in all 286 flags.

## 6. The 800-answer line: levers and their cost (Train, 400 learners each)

| Rule | Caught within 600 / 800 | False alarms at 0.20 by answer 1,000 (over the run) |
|---|---|---|
| as planned: W 640, z 1.645, δ 0.15, φ per window | 67.5 / 86.9 % | 4.8 % (11.3 %) |
| φ shrunk towards 1 with 20 pseudo degrees of freedom (`phiPrior: { df: 20, phi: 1 }`) | 71.1 / 89.5 % | 5.0 % (13.8 %) |
| window 560 answers | 70.4 / 89.0 % | 7.5 % (17.5 %) |
| z 1.28 | 79.5 / 93.1 % | 11.0 % (27.0 %) |

- **φ shrinkage** is the cheapest: +2.6 points on the 800 line for +0.2 points of false alarms at 0.20, 0.5 point short of 90 %. Its cost is an assumption: that a player's sessions scatter about as much as the simulated day-to-day noise; a player whose sessions vary much more would get narrower intervals than the data justify. Pooled exports measure φ; until then it is a guess. In the code as `E.config.plateau.phiPrior` (df 0, off).
- **A shorter window** or **a lower z** buy the line with false alarms at 0.20 well above "about 5 %" (note P1 §2.5 found the same: 9.5 % and 12.5 %).
- **More information per answer** is the only way past the floor of note P1 §2.2 without that cost: the graded errors that Orient, Homing, Reckon and Central Point log, or response times as evidence rather than as a classifier. Each needs its own calibration and is not in v1.2's plan.
- Recommendation for the lead: keep the plan's rule for v1.2 and state the 800-answer figure per format in ENGINE.md §20 (above 90 % for Rotate, Span and Views; 78–86 % for the rest; about 70–78 % for yes/no), or take φ shrinkage at 20 pseudo-df if 89.5 % is close enough; refit both from pooled exports.

## 7. Sensitivity

- **Misspecified items** (each item's true difficulty off by N(0, 0.5²), plus +0.8 logit where the first two settings are both at their maximum, as in sim.mjs's train-misspec; 120 learners each): false alarms at 0.25 by answer 1,000: 2.5 % (3 of 120; 7.5 % over the run); plateaus caught within 600 / 800 answers: 76.7 / 87.9 %; non-responders' first verdicts "clearly up": 1.8 %. Note P1 §2.5 found the same tilt (1.8–2.3 % at 0.25).
- **A long break** (one of 15–30 days between days 30 and 70, with forgetting): the window restarts after it, so plateaus are caught later (about 60 % within 600 and 75 % within 800 answers of their onset, counted in practice that forgetting shrinks), and no flag spans the break (§4).
- **The calendar**: the runs above use breaks of 5–11 days; sim.mjs's breaks of 5–15 days would sometimes leave more than 14 days between two answers on an exercise and restart its window; that run was dropped for usage (§9).

## 8. Nothing else moved (tests/node/sim.mjs)

`nice -n 15 node tests/node/sim.mjs --learners 200 --runs train-balanced,path,train-misspec` (60 days) on two snapshots of commit d33b587, one with js/engine/plateau.js and one without it (the runner's pending list then skips it), same seeds:

| Run | Success on target items vs target, with / without | 95 % intervals hold the true ability, with / without | Trials, with / without |
|---|---|---|---|
| Train, Balanced | 77.68 / 77.69 % vs 77.0 % | 96.88 / 96.88 % | 1,081,475 / 1,081,288 |
| Train, misspecified items | 77.21 / 77.22 % | 92.74 / 92.71 % | 1,019,459 / 1,020,315 |
| Path | 77.19 / 77.19 % vs 77.4 % | 98.86 / 98.87 % | 1,273,747 / 1,273,776 |

Path stages passed: S1 95.7 / 95.7 %, S5 53.0 / 53.0 %, S10 6.0 / 5.8 %. Every hard check of sim.mjs passed in both. In 60 days few exercises reach 640 answers on 8 days, so plateau events are rare there; the few changes they start move the item counts by less than 0.1 % and nothing else. (sim.mjs's "engine fields kept" line reads false with and without the file: its records are unstamped format-1 records, so the store's guard converts their stored levels from 1.1's ranges, the plateau events' levels included; a record with its ranges stamped passes the guard with every engine field unchanged, checked separately.)

## 9. Runs

`nice -n 15 node tests/node/sim-plateau.mjs --cond <id> --mode <train|path> --n <N> --seed 1 [--set '<json>'] [--misspec] [--calendar sim] --json <file>`, from a snapshot of commit d1a5579 with the plateau files on top, one run at a time on a shared two-core machine (60–710 s each). The calibration figures of §2 come from a scratch run of the same learners calling E.plateau.detect after every session.

| Condition (`--cond`) | Mode | Learners | Options | Seconds |
|---|---|---|---|---|
| linear-0.25 | Train / Path | 400 / 400 | | 321 / 80 |
| linear-0.20 | Train / Path | 400 / 400 | | 357 / 102 |
| plateau | Train / Path | 400 / 400 | | 214 / 59 |
| plateau, linear-0.20 | Train | 400 each | `--set '{"phiPrior":{"df":20,"phi":1}}'` | 448, 457 |
| plateau, linear-0.20 | Train | 400 each | `--set '{"window":560}'` | 516, 709 |
| plateau, linear-0.20 | Train | 400 each | `--set '{"z":1.28}'` | 619, 576 |
| break-plateau, break-linear | Train | 150 each | one break of 15–30 days with forgetting | 123, 121 |
| ceiling | Train | 120 | | 95 |
| selective | Train | 200 | | 146 |
| responder-jump | Train | 120 | | 121 |
| faster | Train | 100 | | 83 |
| plateau, linear-0.25 | Train | 120 each | `--misspec` | 90, 79 |
| linear-0.15, linear-0.10 | Train | 120 each | | 101, 118 |
Smaller runs at the end, on the lead's note to keep usage low that night; a responder run with a +1.0 jump, a step learner and the 'sim' calendar were dropped for the same reason (their scripts are in tests/node/sim-plateau.mjs: `--cond step`, `--cond responder-jump-1.0`, `--calendar sim`).

## 10. Limits

The learner model is an assumption: exponential curves elsewhere, plateaus as flat lines, a dip and a jump for responders, normal day-to-day noise. Real curves have pieces, dips and leaps (note P1 §1.1), and only pooled exports can show how often Parallax players stall, how much their sessions scatter (φ), which changes help whom, and whether the 1.3 ratio of row 3 means anything.
