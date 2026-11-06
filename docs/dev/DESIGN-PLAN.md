> Design plan for Parallax 1.0, written before and during the build (October–November 2026). It records what was decided and why; the research notes it cites (research/A–D) are summarised, with references, in the user guide (docs/Parallax-Guide.pdf). Where the shipped app differs, the code, docs/dev/ARCHITECTURE.md and docs/dev/ENGINE.md win.

# Parallax: plan for a visuospatial (VSI) trainer for the Chimera community

Version 2, 30 Oct 2026. Built from four research briefs (research/A–D, about 270 references), a rendering spike (spike/RESULTS.md) and an independent review of version 1 (its fixes are folded in). The user approved building straight after planning, so every decision is taken with its recommended default; §16 lists the ones worth a second look.

## 0. What Parallax is
A free, open-source, offline web app that trains visuospatial ability with 11 procedurally generated exercises: 3D multiple-object tracking, 3D and 2D mental rotation, paper folding, cube nets, cross-sections, orthographic views, perspective taking, spatial span, hidden figures, and an experimental navigation task. Six progression modes share one learner record. Transfer is measured on held-out probes that are never trained. Beginners learn through short play-to-learn tutorials. The look is a calm research instrument. Every app open shows that it was built by the Chimera community, with discord.gg/chmr as a link, as visible text and with a Copy button.

## 1. Requirements
- **Hard (from the user):** the best VSI trainer we can build; the Chimera Discord promoted by a pop-up on opening with a clickable link.
- **Deliverables:** GitHub-ready zip, a PDF guide, a single-file HTML; also a live preview link and a Discord announcement draft.
- **Our own non-negotiables:** CLAUDE.md standing rules 1–12 (honesty, test hygiene, verified items, shortcut solvers, runs everywhere, timing validity, accessibility, measurement, gamification limits).

## 2. What the research says, and what we do about it
| Finding (source in research/) | Design response |
|---|---|
| Spatial training improves spatial tests, and untrained spatial tests about as much as trained ones: g = 0.47; transfer 0.51–0.55; delayed 0.44 (Uttal et al. 2013, 206 studies; A §1). But controls gain 0.45 on their own; against spatial-filler controls the effect is 0.33; published 0.56 vs unpublished 0.39. | Train broadly; measure on held-out probes; judge change against baselines, a control probe and the user's own retest gain, never against zero. |
| Far transfer is small and fragile: maths g = 0.28 (Hawes et al. 2022); one physics RCT, d = 0.32 on the physics grade, with effects on spatial tests, grades and majors gone at 8 months (Miller & Halpern 2013). Action games: spatial g = 0.45 in 2018, shrinking 28–32 % with bias correction; 0.26, not significant, in the 2023 update (Bediou et al.); Sala et al. 2018: 0.07 → about 0 after correction (A §2–§3). | Far transfer is cited, never promised. The app says: practice improves the practised tasks and often similar spatial tests; effects on school, work, sport or IQ are not established. |
| Retest gains: +0.33 SD at the 2nd test, +0.50 by the 3rd, then flat; alternate forms gain less (0.23 vs 0.37) (Scharfen et al. 2018). Perceptual-reasoning subtests show large practice effects (A §7). | Two or three baseline checks before judging change, averaged; alternate forms; no Block Design or Visual Puzzles clones, no packing tasks. A published test sharing an exercise's format counts as near transfer. Span practice may raise clinical block-tapping scores: said in About and the guide. |
| Strategy matters: eye-tracked strategy switching relates to mental-rotation scores (Nazareth et al.; A §5), and teaching imagery and analytic strategies closed the sex gap in chemistry (Stieff et al. 2014). Comparing two cases that share a principle raised transfer from 19 % to 48 % (Gentner et al. 2003; C §8). | Strategy cards for both kinds of strategy with a prompt to switch; occasional one-tap strategy check-ins (logged); paired examples that share a principle in tutorials and after errors. |
| Feedback that explains why: d = 0.99; the bare right answer: 0.46 (Wisniewski et al. 2020). Animations beat static pictures, d = 0.37 overall, larger for procedures (Höffler & Leutner 2007). Seeing the informative views matters more than interacting (Keehner et al. 2008). No study isolates animated vs static corrective feedback for rotation (D §5). | Every exercise has a slow, pausable "show me" built from the grading model (a design bet, so we log its use). |
| Physical manipulatives raised transfer to maths (Hawes et al. 2022). | Optional off-screen challenges (fold and punch real paper, build block structures, draw three views). |
| 3D-MOT: trained-task gains are large (d ≈ 1.6–2.0), transfer weak; none of 29 studies preregistered (Vater et al. 2021); a 2025 replication failed. MOT is not a CHC Gv narrow ability; it relates to attention, working memory and fluid reasoning (A §6.4; B §1). Thresholds depend on display mode and viewing distance. Patent US 10,706,730 B2 covers a stereo 3D-MOT trainer that steps from a core set to motor-load sets. | Track is labelled attention practice. Threshold mode offers the research protocol (8 spheres, 4 targets, 1-up/1-down). No stereo; no NeuroTracker name, units or core-to-motor-load sequence; speeds in our own units; separate Track ratings for small and large screens. |
| The 85 % rule is theory (two-choice, gradient learner); people rated 60–70 % success as right; higher success meant more practice volume (Wilson et al. 2019; Pelánek et al. 2017; Jansen et al. 2013; C §1). | Target = g + (1 − g) × 0.70 (g = guessing rate): 85 % on 2-choice, 78 % on 4-choice, 70 % open. Comfortable (0.85) and Stretch (0.55) styles. |
| Raising interference gradually from blocked to random beats both pure schedules (Porter & Magill 2010). Interleaving helps most when categories look alike (Brunmair & Richter 2019); labelled exercises remove the discrimination that drives it (C §6). | Five interleaving stages; similar-looking exercises are mixed without a name banner; a stage steps back when switch trials fall below target. |
| A learning-progress bandit beat an expert sequence (ZPDES, 265 children) but starved a hard skill in a field study (Clément et al. 2015). | Constrained round-robin weighted by learning progress, with exploration and caps. |
| Gamification helps modestly (cognitive g = 0.49; motivational 0.36 and behavioural 0.25, not significant in rigorous studies); comparison feedback can backfire; expected tangible rewards lower motivation; a broken streak lowers engagement and repair only lessens it (D §2). | Honest levels shown with the real settings reached, a self-set weekly goal with grace, skill-based achievements, learning curves; no points for time, no leaderboards, no brain age or IQ. |
| Tutorials help in complex games; just-in-time tips beat up-front text; forced steps add nothing (Andersen et al. 2012, 45 000 players). | Watch, Try, Go: a slow demo, unlogged practice, then play. Skippable everywhere. |
| More than 3 sessions a week was no better in older adults; unsupervised home training was weak; evidence on session length conflicts (Lampit et al. 2014; Molloy et al. 2012; C §6). Study doses: 10–20 h over 6–12 weeks. | Sessions of 20 min by default (10/15/20/30), a weekly goal of 3 (2–6), all logged so the community can learn what works. |

## 3. Exercises (role: train)
Each exercise has variants that share one rating; difficulty dimensions combined additively (LLTM, with interaction terms where research shows them); a solver that verifies the key; **shortcut solvers that must score near chance**, including stem-blind ones (odd one out among the options; the option most like the others); a show-me animation; and Watch–Try–Go data. Ranges follow research/B-tasks.md §14c unless stated here.

| Code | Id | Name | Trains | Variants | Difficulty dimensions |
|---|---|---|---|---|---|
| EX-01 | track | Track (3D multiple-object tracking) | attention tracking (AT); outside the 2×2 | positions; slow camera orbit | speed (log steps), targets 2–5, tracking 5–15 s, spheres 6/8/10; minimum spacing fixed within a level |
| EX-02 | rotate | Rotate (3D polycubes) | Vz, SR; intrinsic-dynamic | same-or-mirror pair; pick the two that match (2 copies + 2 mirrors) | angle 20–180°, axis (vertical, horizontal, picture, oblique), cubes 6–12 |
| EX-03 | spin | Spin (2D speeded rotation) | SR; intrinsic-dynamic | same-or-mirror; pick the two that match | angle 0–180°, shape complexity |
| EX-04 | fold | Fold (paper folding and punching) | Vz; intrinsic-dynamic | punch-and-unfold | folds 1–5, fold type (half, corner, diagonal, mixed), punches 1–3, folds that don't matter 0–2 (they make items easier: Burte 2018) |
| EX-05 | nets | Nets (cube nets, unoriented marks) | Vz; intrinsic-dynamic | which face is opposite; do these edges meet; does it fold into a cube | squares carried (Shepard & Feng), net shape (1-4-1 / 2-3-1 / 2-2-2 + 3-3), faces between (opposite only); scored "opposite" uses net distances 3–4 (distance 2 and 5 are decided by shortcuts and stay in the tutorial) |
| EX-06 | slice | Slice (cross-sections) | Vz; intrinsic-dynamic | name the section | structure (simple, joined, embedded), cut (orthogonal, oblique, double oblique), curved solids; interactions per SBST; no plain sphere (its section always equals its outline) |
| EX-07 | views | Views (orthographic projection) | Vz; intrinsic-static | object → top/front/right line view; three views → object; count blocks | cubes 4–12, grid 3–4, view direction; every cube shows a whole face in every shown structure |
| EX-08 | orient | Orient (perspective taking) | PT; extrinsic-dynamic | point on an arrow circle | perspective shift 0–180°, objects 5–9, tolerance |
| EX-09 | span | Block Span (spatial span) | MV, WM; outside the 2×2 | forward; backward | length 2–9, path crossings (none / some / many), board turn 0/90/180° between showing and recall; no repeats |
| EX-10 | hidden | Hidden Shapes (embedded figures on a lattice with diagonals) | CF; intrinsic-static | which shape is hidden (5 options, same segment counts per direction) | extra lines 6–32, candidate similarity, figure size 5–7 cells; exactly one placement of the key |
| EX-11 | homing | Homing (experimental navigation; larger screens) | NAV; extrinsic-dynamic | face the start after a passive route | legs 2–4, turn sizes, landmarks |

Validity rules beyond rule 4: Rotate and Spin figures are chiral (all 24 / 4 rotations checked); every cube of a shown figure is visible (software z-buffer); "pick" formats always split the options 2 + 2 by chirality, so there is no odd one out; foils are built from neighbouring problems, not as small edits of the key, so the key is not the option most like the others; Fold options all have the same number of holes; Slice includes the "egocentric" distractor; Track rejects end states with overlap or occlusion and never reuses a trajectory; Orient positions are never collinear and the answer is never straight ahead or behind, and a device rotation during a trial voids it.

## 4. Held-out probes (role: probe; only in the Spatial Check)
Never trained, no feedback, at least 3 alternate forms, scored on the probe's item model so forms are comparable. Each probe is a short adaptive test (16 items, about 3 minutes; the next item aims at p ≈ g + (1 − g) × 0.6), giving θ with a standard error, plus median response time on correct answers.

| Code | Id | Probe | Ability | Distance from training |
|---|---|---|---|---|
| PR-1 | cubematch | Cube Match: are these two cubes with oriented symbols the same cube? | Vz | mid (Nets trains unoriented marks; Rotate trains rotation) |
| PR-2 | viewmatch | View Match: which perspective picture shows the tabletop scene from the flag? | PT | mid (Orient trains pointing; Views trains orthographic line views) |
| PR-3 | mechanisms | Mechanisms: gears, belts, pulleys with branches and jams | mental animation (MA) | untrained ability |
| PR-4 | patterns | Pattern Memory: recall a grid after a brief look | MV | mid (Span trains sequences) |
| PR-5 | level | Level: water lines and plumb lines (optional) | extrinsic-static | untrained cell |
| PR-0 | wordlinks | Word Links: verbal analogies (original items) | non-spatial control (VB) | control: familiarity and motivation |

## 5. Progression modes (one learner record)
**Shared engine**
- **Rating** per exercise (per screen class for Track and Homing): Gaussian μ, σ on the logit scale; σ₀ = 1.0; process noise +0.002 per trial and +0.01 per idle day (C §9b). Stuttered, voided or skipped trials never update. Speed mode keeps its own timed rating; Free play never updates ratings.
- **Item difficulty** b = base + Σ step × level index (+ variant offset, + interactions); P(right) = g + (1 − g − 0.03) σ(θ − b).
- **Level** 1–100 per exercise = the difficulty answered right at a fixed reference, g + (1 − g) × 0.75, mapped onto the exercise's difficulty range (every exercise's range spans at least 4 logits). It does not depend on the style. The shown level updates at the end of each block, with the change, next to the real settings now handled ("120° depth turns, 10 cubes").
- **Item mix:** 80 % at the target p*, 10 % easier (p* + 0.10, at most g + (1 − g) × 0.95), 10 % stretch (g + (1 − g) × 0.5). Variability: among equally hard candidates prefer least-recently-used levels and variants. Weak-spot items when a dimension's success falls clearly below prediction.

| Mode | For | Engine | Key defaults |
|---|---|---|---|
| **Train** (default) | daily practice | rating, item selection, session builder | styles Comfortable 0.85 / Balanced 0.70 / Stretch 0.55 above chance; interleaving stages S1 blocks of 20 → S2 blocks of 10 with variants mixed → S3 blocks of 5 → S4 alternating 2–3 similar-looking exercises without a name banner → S5 random (≈ 70 % switches); move up at ≥ 40 trials and σ ≤ 0.45; step back when switch trials fall below p* − 0.10 over 20; Stretch starts at S3 |
| **Path** | beginners, mastery | gated ladder of 10 stages per exercise | Watch at each new stage; blocked practice; pass when the moving average (decay 0.85) reaches 0.80–0.90 (by format) and the rating predicts ≥ 0.80 above chance; rechecks after 3, 7, 14, 30, 60 days; never says "mastered" |
| **Threshold** | measuring and training one dimension | weighted up-down (Kaernbach) and the transformed 1-up/1-down | harder step 0.025 log10, easier step × p/(1 − p); Track Standard: 8 spheres, 4 targets, 2 s cue, 8 s, 1-up/1-down, 0.05 log10 steps, 20 trials, threshold = geometric mean of the last 4 reversals; also Span length and Spin deadline |
| **Speed** | fluency | deadline staircase, own timed rating, balanced integration score | per exercise once a Path stage is passed, or after 60 trials at σ ≤ 0.45; items drawn from levels answered ≥ 85 % untimed; starting deadline 1.5 × median untimed time |
| **Free play** | autonomy | none | pick exercise, variant, settings, timer; logged, never rated |
| **Spatial Check** | measurement | adaptive probes | §6 |

**Session builder (Train):** three exercises per session (focus = highest learning progress or the user's pin; review = due on a 3/7/14/30-day schedule; variety = least practised); constrained round-robin weighted by learning progress, 15 % exploration, each exercise 20–50 % of trials. Similar-looking groups for uncued mixing: {Fold, Nets, Slice, Views, Hidden} and {Rotate, Spin, Orient}. Two easy warm-up items; end on an item at p* + 0.10.

**Daily Challenge** (a community game, not a mode): the same 8 items for everyone each day (seed = UTC date), medium fixed difficulty, one scored attempt, a share line ("Parallax Daily #N · 6/8 · discord.gg/chmr") and a share card.

## 6. Transfer: training for it and measuring it
- **Training for transfer:** breadth across Gv abilities (the Uttal 2×2 used as a checklist only, A §6.3); variability (variants, dimensions, viewpoints, stimulus families); uncued mixing of similar-looking exercises; strategy cards (imagery and analytic, with when to switch) and one-tap strategy check-ins; paired examples sharing a principle; "where spatial thinking is used" cards (chemistry and molecules, engineering drawings, geometry, physics), each with the limitation line next to it; optional off-screen challenges.
- **Measurement:** the Spatial Check (PR-1–PR-4 + PR-0; PR-5 optional; about 15 min). Baselines B1 and B2 before or early in training (B1 offered after the tour, B2 at the next session or two; a third if B1 and B2 differ a lot), averaged. Then every 14 days or 8 sessions, whichever is later, plus a delayed check about 28 days after training stops or slows. Expectations asked once at baseline (logged).
- **Reporting:** per probe and as a composite (the mean of PR-1–PR-4, more precise): change since the baseline average with an interval; accuracy and response time separately; next to it the control's change, the change on trained exercises, and the user's own expected remaining retest gain (half the B1 → B2 gain, since retest gains roughly halve after the second test and then stop). The words "beyond familiarity" appear only when a change clears the control and the retest estimate; otherwise "unclear yet" (expected often, and said so). No IQ, VSI index, percentile or brain age.
- **Lab self-experiment (stretch goal):** a randomised crossover over 6 weeks: cluster A (Rotate, Spin, Fold, Nets, Slice) and cluster B (Views, Orient, Span, Hidden, Track, Homing), order chosen at random, 3 weeks each, checks at 0 (×2), 3 and 6 weeks; the analysis is fixed in advance and explained in the Lab and guide. Exported files carry predicted P, stage and item-model version per trial so pooled data can be re-scored.

## 7. Motivation and gamification
- **Include:** progress bars on honest levels with the real settings; a profile by exercise and ability; learning curves with a noise band; personal bests over whole blocks; a self-set weekly goal (default 3) with a days-practised calendar and a weekly streak with automatic grace (one missed week in four) and free repair; about 24 achievements tied to skills and good practice (try every exercise, two baselines, both strategies reported, three Spatial Checks two weeks apart, Track with 5 targets, Span 7, a Path stage rechecked after 30 days…), never "mastered"; session summaries against the user's own past with an honest line about noise; the Daily Challenge, same-seed friend challenges and share cards with the Discord link; a "last backup" line and a Back up now button.
- **Avoid:** points for time spent, global leaderboards, daily loss-framed streaks, brain age, IQ or percentiles, grinding to unlock, autoplay, "are you sure you want to quit?".

## 8. Tutorial and feedback
- **First run:** Chimera pop-up → "New here? Watch, Try, Go (3 min)" (Rotate, Fold, Track) → "Measure your starting point (about 15 min, no feedback)" or Later → Today. Skippable at every step; skipping the baseline only means transfer reports start later.
- **Watch, Try, Go per exercise** (about 60 s, the first time an exercise appears, replayable from "How to play"): a one-line goal with labelled parts; a slow 5–10 s demo ending with the solution movement; 3–5 easy practice items that are not logged, with tips at the moment they are needed; then an easy scored start.
- **Just-in-time tips:** a one-line tip when a new mechanic or variant first appears; after two misses on similar items, a strategy card is offered (never forced).
- **After an error:** within 0.5 s an icon, a word and a colour (never colour alone); the right answer; a slow 2–4 s show-me that can be paused and stepped; wording about the task, not the person. After a few uses, automatic replays fade to a "Why?" button.
- **After a correct answer:** a brief tick and the response time; "See solution" when the answer was slow; celebrations only at milestones.

## 9. Chimera
- Pop-up on every app open: "Parallax was built by the Chimera community on Discord." with an invitation (say hi, share results, suggest exercises), a "Join the Chimera Discord" button (https://discord.gg/chmr, new tab), the address as visible text with a Copy button (new tabs are blocked in sandboxed previews), and "Start training".
- Also in the header menu and footer, About, the guide (cover and last page), the README, share cards and the Daily Challenge share line.

## 10. Interface
- Screens: welcome, tour, Today, play (trial player and session summary), Library, Progress, Log, Lab, Settings, About.
- Look: "lab instrument" (ARCHITECTURE §10). Light and dark. Phone first (360 × 640 up), no horizontal scroll, 44 px targets, keyboard play everywhere. Track scales its volume to the screen and picks the nearest sphere to a tap; Homing recommends a larger screen.
- Storage: iOS Safari may clear site data after 7 days without a visit, so Progress and Settings show "last backup" and offer Back up now; the guide explains installing to the home screen.

## 11. Architecture
See ARCHITECTURE.md: classic scripts on `window.PX`; three.js r186 as a vendored IIFE (541 KiB min, 137 KiB gzip); one WebGL context with snapshots for option thumbnails; SVG for 2D exercises; pure generators and engine that run in Node; storage with a schema guard, two-tab merge, safe import with undo and a memory fallback; in-memory routing; a dev harness; a single-file build.

## 12. Quality bar
1. `node tests/node/run.mjs`: every exercise and probe, ≥ 10 000 seeds across all levels and variants: generate never throws, validate passes, the key scores right and every other option wrong, determinism, generation ≤ 20 ms. Shortcut solvers, including stem-blind ones, ≤ chance + 10 points.
2. Engine unit tests; simulated learners (≥ 200 per mode, 60 days), also with misspecified item difficulty (item noise SD 0.5 and dimension interactions): success within ±3 points of target, 95 % intervals cover 93–97 %, no repeats, coverage of exercises, no dead ends, sane streaks and achievements, record under 2 MB.
3. Playwright, desktop and phone: pop-up, link, Copy, tour, every exercise by keyboard and pointer, every mode, the Spatial Check, export and import with undo, file://, sandboxed srcdoc, storage blocked, the single-file build, light and dark.
4. Long live runs: a bot plays ≥ 300 trials per mode with 0 page errors.
5. Performance: Track frame stats at 4× CPU throttling; the stutter monitor marks injected stalls and those trials don't count; the answer clock starts at the painted frame.
6. Independent reviews by agents that did not build the part: code; QA play-through with screenshots; item validity (rendered samples judged for ambiguity); claims and facts (texts and guide against research notes). Every major finding fixed; the rest in Known limits.

## 13. Deliverables
1. `parallax.zip`: top-level `parallax/` with the app, tools, tests, docs/Parallax-Guide.pdf, README, CHANGELOG, LICENSE (MIT), LICENSE-GUIDE.md (CC BY-SA 4.0), CLAUDE.md for contributors.
2. `Parallax.html`: single file, offline, works in sandboxed previews.
3. `Parallax-Guide.pdf`: what it does; quick start; each exercise (picture, what it trains, how to play, difficulty, evidence); the modes and why there are several; transfer and how to read the Spatial Check; motivation features; the research with references; honest limits and test hygiene; data and privacy (all local, backups); the Lab and data export; contributing; credits; the Chimera link. Clickable links.
4. A live preview link, a Discord announcement draft (≤ 2 000 characters), and project docs (plan, handoff, build log).

## 14. Build phases
| Phase | Work | Status |
|---|---|---|
| 0 | Research, spike, ARCHITECTURE.md, core foundation | done |
| 1 | stage3d, dev harness, reference exercise Rotate end to end | running |
| 1b | Design system, app shell, Chimera pop-up, Today skeleton | running |
| 1c | Engine + simulated learners | running |
| 2 | Exercise waves following Rotate: W1 Track · Fold + Nets · Slice + Views; W2 Spin + Orient + Homing · Span + Hidden · probes PR-0–PR-5 | next |
| 3 | Full UI: player, Library, Progress, Log, Lab, Settings, About, tour, share cards, Daily Challenge; modes wired | |
| 4 | Integration, full test suite, long runs, performance | |
| 5 | Independent reviews and fix rounds | |
| 6 | Guide (HTML → PDF), README, CHANGELOG, single-file build, zip, live preview, Discord draft, project docs | |

## 15. Risks
- **MOT patent:** no stereo, no NeuroTracker name, units or core-to-motor-load sequence; the guide cites the research paradigm. Not legal advice; flagged to the user.
- **Item models are hand-set** (LLTM steps without a pilot; known interactions): targeting is checked by simulation under misspecification, weak-spot detection compensates per user, and trials log predicted P so the community's exported data can refit the steps later.
- **Probe precision:** even 16 adaptive items give wide intervals per probe; the composite and repeated checks help; "unclear yet" is honest and expected.
- **No WebGL:** 2D exercises still work; 3D ones say why they are unavailable.
- **Phones:** viewing distance changes Track's difficulty (separate ratings by screen class); small spheres (nearest-sphere picking, larger radius); orientation changes void a trial; iOS storage eviction (backups).
- **Unverified research details:** about 100 points are tagged [unverified] in the notes; the guide states only verified points, or says "reported".
- **Scope:** if time runs short, Homing, PR-5 and the crossover self-experiment move to "later" first.

## 16. Decisions taken with defaults (open to change)
1. Name **Parallax**.
2. No clones of Wechsler Block Design or Visual Puzzles, and no packing tasks.
3. No stereo or anaglyph mode.
4. The Chimera pop-up shows on every open.
5. No XP points or leaderboards; honest levels, weekly goal with grace, achievements, Daily Challenge.
6. Track is labelled attention practice.
7. 20-minute sessions, 3 a week by default.
8. Two baseline Spatial Checks, then every 14 days or 8 sessions.
