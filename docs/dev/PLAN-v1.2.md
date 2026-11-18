# PLAN v1.2 (Phase 1 result, waiting for the owner's go)

Status: written 2026-11-18 from the eight Phase 1 research notes. It replaces the 14 Nov backlog draft (its items O1–O61 and the 32 standing-rules gaps are all placed below, in v1.3, or dropped with a reason). On the owner's go it becomes docs/dev/PLAN.md, and v1.1's plan moves to PLAN-v1.1.md (gap R2). Sizes: S under an hour, M a few hours, L a day or more.

## Sources
- Research notes, docs/research/v1.2/: G1 game layer, M1 measurement, P1 plateaus and progress, T1 transfer portfolio, C1 Central Point, D1 real PAT formats and legal limits, D2 first band and teaching, N1 Reckon. Spikes in docs/research/v1.2/spikes/.
- Inputs: docs/dev/v1.2/deferred-sweep.md (O1–O61), docs/dev/v1.2/standing-rules-gap.md (IDs such as PB1, ME5, C2), docs/research/ACCESS.md (sources not opened).
- Every number below comes from those notes; the section cited holds the detail and the evidence.

## Concept
v1.2 turns Parallax into an instrument people want to open every day without bending the science. A game layer of grades, a growing Reach, an Atlas of the settings you have handled, a seeded weekly Climb and a Daily that ramps from easy to hard sits between items, never during them, and nothing pays for time or punishes a missed day. The engine keeps every dimension at the player's edge, notices a stall, changes one thing for a stated reason and says what changed. Every exercise names the transfer bet it makes, nine bets in all and one new (calibration), with comparison rounds, bridge sets and draw-the-answer variants randomised and logged so the community's pooled exports can test them. The Spatial Check becomes a meter that moves every session, with a near rung where one person's gain can show within weeks. New: Central Point. The DAT-style exercises get a taught, easier start and the real PAT formats.

## What research changed in the draft
Kept: one release; DAT-style stays opt-in; no Duolingo-style streaks; the weekly goal with its forgiving count; Central Point; the easier start and the real PAT formats; plateau-breaking; tagged bets; a faster-moving check.

Changed:
- **Points.** No lifetime points for right answers: Train holds success near a target, so such points add up to skill × minutes, which is pay for time (G1 §2.1). Points exist only in the Daily and the Climb, where items are fixed, identical for everyone and scored once.
- **Measurement target.** A 0.5 SD composite gain shown to 60 % of players by week 4 with ≤ 5 % false alarms is out of reach for any design tested at a bearable cost (about 40 minutes of measurement a week, under optimistic assumptions only). The meter moves every session instead; the near rung can show one person's gain in about 4–6 weeks; a 0.5 SD composite gain becomes visible around week 8 if the probes are as reliable as hoped (M1 §5.5). Decision 2.
- **Plateau detector.** The draft's rules flagged almost every simulated learner, improving ones included. It is replaced by a likelihood slope test over the last 640 rated answers (P1 §2).
- **Central Point.** Targets on a 7 × 7 lattice on every screen; answers on the 13 × 13 half-step lattice; every rated item excludes all eleven cheap shortcut picks from the credit band. The draft's 7 × 7 answer grid collapses to "which neighbour of the average?" (C1 §4.3). Its bet is calibration, not "spatial estimation", which names a skill (T1 §3).
- **First band acceptance.** The draft's "simulated beginners reach about 80 %" was already true by construction; the test now uses a population centred at today's floor (D2 §3.8).
- **The PAT statement.** No live patent exists or is plausible for these formats; formats and rules are free to follow. Off-limits: the ADA's questions (recalled ones and old sample tests included), instructions and drawings, prep products' items and drawings, the test centre's screen design, and the test's names used as a product, mode or code name. The names may describe what a format follows, with the ADA line. Options are lettered, as on the test (D1 §4.5). Not legal advice.

Moved to v1.3 (docs/dev/PLAN-v1.3.md): Reckon's later rungs (point to the start mid-route, curved legs, active steering; N1 says they fit v1.3 better), Knots' 3D mirror variant and later ideas (O46, O47), Orient as a 3D tabletop (O60), new exercises for closure speed, scanning and imagery (O61), Hole Punch half folds and Openings' curved features (D1 §6.6, §6.8), weighted targets in Central Point, game option C pieces. Reasons: no new research this round, L each, and v1.2 is already weeks of work.

Dropped: the gyroscope "magic window" variant (O44: the real room gives heading fixes, which defeats dead reckoning; N1 Q5 #16); graded continuous scoring for Reckon (N1 Q3).

## Decisions for the owner (on the decision board; recommendation first)
1. **How much game.** B, the instrument with a game layer (recommended): grades, Reach, the Atlas, the weekly Climb, weekly field notes, Daily v2, cards at every high point, a game-feel pass. A is the quiet-plus fallback; C adds lifetime points, seasons, cosmetics and duels, which carry the harms the evidence warns about (G1 §4).
2. **How much time measurement may take.** About 12 minutes a week inside sessions (recommended): a 3.5-minute no-feedback block at the start of up to four sessions a week and a 10-minute check every four weeks, plus an opt-in "measurement week" for players who want a quicker verdict. Alternatives: today's two long checks judged by the new trend model (about 8 minutes a week; the meter barely moves for months); about 15 minutes (8–10 % more precise); about 40 minutes a week (meets the old target, optimistic case only) (M1 §6.1).
3. **First baseline.** Right after the first two-minute tutorial, before rated training, with the second at the start of session 2 (recommended; about 10 minutes each). Alternatives: before any play (cleaner, slower start), or optional and later as now (fastest start, weaker familiarity estimate) (M1 §6.2).
4. **Two small yeses the standing rules reserve for the owner.** CC BY-SA 4.0 for the README and docs prose (L1; the code stays MIT): recommended yes. The three v1.0 lines that say more about Chimera than the fixed text (C13): recommended trim to "built by the Chimera community on Discord".

Optional: the name of the test Central Point comes from, so the overlap helper can name it (C1 §1 could not identify it).

## Defaults where the brief is silent (logged in DECISIONS on the go)
- Rebuilt DAT-style exercises replace their 1.1 versions; `version` bumps; ratings carry over with a widened range so targeting re-converges (D1 §6.0).
- The 1–100 scale of the seven first-band exercises is re-based, so shown levels rise by about 15–28 once; stored bests are converted once (D2 §3.0 A).
- The Daily and the Climb keep excluding DAT-style and screen-dependent exercises.
- Central Point's reveal, "Why?" and bridges never mark the average position; only the one-time tutorial Watch shows it, the same for every player. The strategy card still says in words that the average leans towards far targets. This keeps the mean-estimation control check untrained (T1 §5.2, §5.4) at a small cost to C1's reveal (C1 §5.1).
- Plateau changes are chosen at random among the eligible ones and logged, so the pooled exports form a micro-randomised trial; the player always sees the reason (P1 §3.9). Add-on layers (comparison rounds, bridge sets) are assigned by a within-player crossover for the same reason (T1 §5.3). About says so in one line.
- Reckon's gentle motion profile caps routes at three legs, so the 30-second cap holds (N1 Q4).
- Sound and haptics stay off by default.
- Playtest mode is on in every test build and behind an off-by-default setting at release.

## Milestones
Order of work: 1, 2 and Central Point first, then the first playable build goes to the owner; then 3, 4, 6 and 7 (engines); then 5 and 8 (game and content); then 9–11.

### 0. Research and plan (Phase 1) — done on the owner's go
- [x] Eight research notes with read levels per source; spikes; ACCESS.md merged (R5).
- [ ] The owner's go and answers (decision board).

### 1. Fix first, and a taught first band (M–L)
- **First band** for Views and the six DAT-style exercises (D2 §3): one new lowest level per exercise (two for Painted Cubes), Δ from −0.85 to −1.85 logits (table D2 §3.8); the same teaching template for all seven: a rules card on screen (phones included), the Watch at the band, one strategy card before Try 1, Try 1 with its first step done, "about two minutes" on the offer card (O6); Show-me changes per exercise (D2 §3.1–3.7); engine: prior σ0 1.0 → 1.5, no stretch item among an exercise's first 10 rated answers, "level 1 · starter items" with progress to level 2.
- **Fixes:** Pause and End during feedback (O4); motion comfort in Homing and Reckon (one-time notice, a check-in card after 3 minutes of motion then every 5, the gentle profile 1.2 m/s, 30°/s, 0.6 s ramps with no speed change within a leg and a fixation dot, a first block that ends after about 5 minutes of motion; N1 Q5 #1–5); Section practice O9–O11; tutorials O8, O52, O53; texts O5, O7, O25, O39, O40, O43, O59; engine O15; the analogy line in the "Taking a test soon?" helper and About (D3).
- **Acceptance:** a population centred at the pre-1.2 floor averages 76–84 % over its first 10 rated items on Views, Painted Cubes, Openings, Form and Missing View, and at least 68 % on Angles and Hole Punch; a population 1.75 logits above reaches the old floor by its 10th rated item (median) (tests/node/firstband.test.mjs, D2 §3.9); `sim.mjs` coverage stays 93–97 % with σ0 1.5; each fix has a test that fails on 1.1; fresh-player tests pass on all seven (protocol D2 §4) and on Form and Reckon; longruns clean.

### 2. Standing-rules switch, the quick part (S–M each)
- CLAUDE.md rewritten under 150 lines for the standing rules (rules 1, 2, 9, 10, 11, 12 reworded, 13–15 new; code map and the 1.1 contract brought up to date: O32).
- Chimera: the full welcome on first launch and a one-tap card later (C2, O2); the link on the README's first line (C4); an invite with Copy on tutorial end screens (C6); invites at personal bests, grades, Path passes, check results, plateau cards (C8, C9, O3) and in export and backup dialogs (C10); C13 and L1 as the owner decides.
- Privacy in exports: no name but a typed nickname; no user-agent, locale or timezone unless switched on; local day keys in the pooled export shifted to UTC or dropped, with a test.
- Modes: a "right when" line per mode and one log-based suggestion at a time, hidden 14 days if dismissed (P1 §5).
- Playtest mode: three taps after each exercise, a note button on every screen, "Copy playtest report" with device, frame timings, errors, performance, play time and where the player quit.
- **Acceptance:** shell, section and longrun tests handle the new pop-up; a node test checks the link in every share text and tutorial end; screenshots at 360 × 640 and desktop.

### 3. Plateau-breaking (L)
- **Detector** (P1 §2): at each session end, a maximum-likelihood logistic slope over the last 640 rated answers on the exercise, using logged item difficulty and guessing rate, a covariate for answers right after a switch and a correction for day-to-day noise; fires when β̂ + 1.645·SE < 0.15 logit per 100 answers. Preconditions: at least 8 sessions on 8 days in the window, no break over 14 days, not at the pool's ceiling, not inside a change's trial. A response-time trend at matched difficulty classifies a stall ("steady level, faster answers" suggests Speed instead of a plateau card).
- **Changes** (P1 §3.9): a decision table driven by the log (ceiling or long break: not a plateau; weak after switches: interleaving stage back; weak spot at the frontier: drill that dimension; accurate but slow: Speed runs inside Train; massed practice with late-session decline: rest that exercise 3–4 days; otherwise a logged random choice among the other strategy card, a wider mix or variant swap, aiming higher, a new variant). Each runs a trial of 3 sessions and at least 120 answers, warns about the expected dip, and ends "clearly up", "unclear yet" or "no change yet".
- **Plateau card** on the summary and Today: what changed and why, the follow-up, the Chimera invite; plateau events in the record and the export.
- **Acceptance** (simulated learners in sim.mjs, Train and Path, 120 days): ≤ 5 % false alarms for learners improving at ≥ 0.25 logit per 100 answers; ≥ 90 % of plateaus caught within 800 answers; no learner flagged while still rising; the card shows in a longrun.

### 4. Transfer bets, tagged, logged and tested (L)
- **`def.bet`** with nine ids (T1 §3): `attention` (track), `load` (span), `variety` (fold, spin, hidden), `strategy` (rotate, orient), `compare` (nets, knots), `bridge` (slice), `produce` (views), `calibrate` (reckon, homing, centralpoint; new and untested), `format` (the six DAT-style). Shown on the exercise page and How to play; "The bet" line per exercise; a "Test the bets with us" section in About, the Lab and the guide (S3). A node test checks every training exercise has one.
- **Add-on layers** (T1 §4): comparison rounds (two solved items side by side, "What is the same?" as a one-tap menu, the principle, one apply item; 25–60 s; at most two a session); bridge sets (a concrete item beside its idealised twin, a mapping question, two concrete items, a "where else?" tap; 60–90 s; about every two weeks per exercise); draw-the-answer variants (draw the view on a dot grid, mark the holes, mark the cut). Assigned by a within-player crossover.
- **Logging** (T3, O17): per trial `bet`, `layer`, `format`, answer mode and orientation; an events table (show-me plays, strategy cards, check-ins, comparison rounds, bridge sets, off-screen challenges, layer assignments, expectation ratings); dose summaries in the research export.
- **Acceptance:** every training exercise has a bet; the crossover assignment is balanced in simulation; the export carries every field (a node test); the guide and About describe each bet in the same words as the code.

### 5. Game layer (L; contents per decision 1, recommended B; G1 §2)
- Eight rules for the whole layer (G1 §2.0), enforced by node tests where code can check them: nothing on screen during an item but the task and the item counter; no count of consecutive days anywhere; Reach never falls; firsts follow the guessing rule.
- Grades 1–10 per exercise (the tenth of the range holding the best block level); Reach (the sum of best block levels over the non-DAT-style training exercises, never falling); records with optional personal-best goals; firsts and the Atlas (`def.atlas`, cells handled only when guessing explains the right answers less than one time in ten); Daily v2 (a ramp from easy to hard, points 1 + 2 + … + 8, a calm history, an archive, a frozen pool per epoch: C11); the weekly Climb (20 rungs, the run ends at the second miss, three seeded attempts a week); weekly field notes (pick two of three, skill or good practice only, gone on Sunday night without a message); a fresh-start note after a gap of 7 days or more; cards at every high point, including start-versus-now (F2, F4–F6, P2, O1).
- Game feel between items only (G1 §5.2): a plotter-drawn tick, one ring on a right answer to a stretch item, a needle sweep at block end, an ink grade stamp, rolling counters; celebrations in ink and green, never in the accent, which is also the stimulus target colour; every effect ends before the next item paints. The stock patterns the look avoids (LI4) are listed in G1 §5.4.
- **Acceptance:** every mechanic stays outside `body.px-stim`; shortcut and timing tests unchanged; a first-week play-through over simulated days passes; each mechanic has a DECISIONS line naming the harm it avoids (G1 §2.13).

### 6. Measurement that moves within weeks (L; budget per decisions 2 and 3; M1)
- **First, the engine simulation gate** (M1 §8): a probe learner model, the trend model (generalised least squares, equal to a Kalman smoother) over all occasions with a population familiarity prior (0.65 SD until pooled data exist), milestone verdicts, hard false-positive checks, the detectable gain reported at weeks 4 and 8.
- **Then the build:** baselines and embedded blocks per the decisions; a probability meter always shown, verdict words only at milestones (P ≥ 0.975 at week 2, ≥ 0.95 from week 4, "likely no change" from week 8); the opt-in measurement week.
- **The ladder:** a near probe, Other Way Round (the trained operations in reverse, six strands; T1 §5.1), a far probe, Motion Graphs, joining Mechanisms in a far composite (T1 §5.2); Level optional and reported alone; reserved formats with a node test that fails if training content uses them. Lab checks: mean estimation as a control for Central Point (T1, C1 §6), and learning speed on newly added exercises.
- **Acceptance** (in the simulation, before the build is merged): false "likely gain" ≤ 5 % (central) and ≤ 10 % (misspecified familiarity) at every milestone; detectable composite gain at week 8 ≤ 0.5 SD under the optimistic set; the near rung's detectable gain reported at weeks 4 and 6; the real probe reliability substituted as soon as pooled baselines give it.

### 7. Faster progress on every dimension (M–L; P1 §4)
- Per-dimension step offsets refitted at each session end by ridge regression on the last 400 answers (prior SD 0.5 × step, capped at ±0.75 logit); items chosen on the player's own difficulties; the leading dimension rotates; the deck's easy item takes the Speed deadline once Speed is open, updating only the timed rating.
- Hand-set steps refitted from pooled exports when they arrive (O16).
- **Acceptance:** in sim.mjs with uneven learners, target items within ±0.10 of the true edge rise (Fold 87 → 95 %, Rotate 92 → 95 % in the P1 runs); shortcut accuracy does not rise per dimension level (a shortcut-learner simulation).

### 8. Exercise depth (L each unless marked)
- **Central Point (EX-20; C1 §3–§8):** targets on a 7 × 7 dot lattice, answers on the 13 × 13 half-step lattice (tap, then drag or nudge with ≥ 44 px buttons or keys, then Confirm; no total shown before Confirm); right within 1 %, 0.5 % or 0.25 % of the best total, partial credit falling to 0 at four times the band; dims targets 4–8 × band (15 cells), a trap of at least one dot on every rated item, all eleven shortcut picks and every target kept out of the band; an exhaustive validator over the 169 answer points with a Weiszfeld cross-check; a smarter generator (acceptance is 0.5–9.2 % per candidate); the correction ratio logged per item; reveal with lines and lengths, the best spot and contour lines, never the average; "Why?" lays equal pulls head to tail and slides the farthest target away to show the best spot stays put; strategy cards "Balance the pulls" and "Count the sides"; a two-minute tutorial (C1 §5.4); the overlap row and helper line (C1 §7). Difficulty steps are provisional (a 2.2-logit span).
- **DAT-style, the real formats** (D1 §6, in this order): lettered options and a plain line-drawing look in all six, with test-range tags and a "test range only" choice in Free play; Angles' numbering and lettering; Painted Cubes with 2–4 questions per figure (version 2); Form's three kinds of item (plain shapes, full shading, partial shading) and L-, T- and U-prisms; Missing View on profile solids; Openings with a test-range start at two features and a turn dim; Section practice under test conditions (free navigation across parts, strike-out, part instructions before the clock); Hole Punch's new look. New solvers are independent of the generators.
- **DAT-style depth:** Painted Cubes' visible-only strategy and "column tops only" (O57); Angles' 1.5° level or a DECISIONS line for 2° (O58); the optional tally pad (O12).
- **Reckon** (N1 Q5): final on-the-spot rotations of ±30–150° and a 2-key construction that caps turns-only answers at 50 % (drop the fixed-angle exemption); a `legs` dim; return distances 3–20 m with a 20 % tolerance level; the walk-back control law stays fixed; card wording matched to the studies; the flow step refitted; a drift trend on Progress (weekly median with range, at least 15 return routes, one route-length band; O38). The O45 search stays owed (search budget).
- **Homing:** the solution map draws landmarks as seen from the start (O42, M).

### 9. Phones, data and tooling (S–M each)
Progress in tabs with jump-to chips (O20); an optional "confirm taps" setting (O22); dial words ≥ 12 px (O41); the Knots plate on landscape phones (O48); Form's badges (O54); Hole Punch's panels (O55); Painted Cubes' overlay (O56); a service worker on https only (O21); a partial Daily resumes by seed, with a migration (O14); fit.py waits for Hole Punch (O27); Section practice sideways (O28); an accessibility and phone-usability review (O31); Openings' independent feature check (O29) and Painted Cubes' brute-force proof (O30); slow node tests split (O33); the guide links the ADA validity study (O26) and keeps study effects out of IQ points (O24); real-phone frame checks for Homing and Reckon (O19) and the Reckon validity check on community data (O18) go to the release checklist and a community call.

### 10. Voice (L)
About, the README, the Library notes and guide chapters 1, 5 and 8 in a confident, curious "test the bets with us" voice: what Parallax trains, bets on and measures, one accurate limit where a claim needs it (S5). "Real format" never reads as "real difficulty" (D1).

### 11. Verification and release
- Two-minute start: the fresh-agent test on all 20 exercises and the first check, phone and desktop, times in VERIFY (TM2).
- Independent reviews of code, items, claims against code, the guide and a play-through; long runs; the six-word quote scan against BRIEF.md; the privacy check on the release zip.
- The owner's five-minute release checklist as a page of pass/fail taps; guide, single file, Discord post, build log, playbook.

## Phase 2 organisation
- A written contract first (docs/dev/CONTRACT-v1.2.md): new fields (`def.bet`, `def.atlas`, the events table, trial-row fields), file ownership down to functions in shared files, hooks delivered first.
- Builders in parallel by area (engine, game layer, measurement, Central Point, DAT-style rebuild, Reckon, interface), each with its own tests; the original builder fixes its review findings.
- Two browser slots: browser-heavy work is queued, reviews that need no browser stay off the slots.
- The first playable build (milestones 1, 2 and Central Point, playtest mode on) goes to the owner as a separate private preview the moment it exists.

## Risks
- Measurement: real probe reliability decides between the central and optimistic numbers; it comes from pooled baselines after release (M1 §9).
- Hand-set difficulties (first band, Central Point, PAT rebuild) are provisional until pooled exports refit them.
- The plateau detector cannot fire before 640 rated answers on an exercise; rarely rotated exercises take weeks.
- Central Point's generator speed on phones; its floor may be too hard (no human data).
- The game layer's three new numbers may confuse beginners (one tour line each, on first appearance).
- The DAT-style look change moves difficulty; versions bump and ranges widen.
- Several core sources could not be opened (docs/research/ACCESS.md, ranked top 10).

## If v1.2 has to be smaller
1. Milestones 1–3, 5 (option A if needed), 4's tag and logging, 10, 11, and Central Point.
2. Then 6 (only once the simulation gate passes), 7, the DAT-style rebuild and Reckon.
3. Then 9's remaining items.
