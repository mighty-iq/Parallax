# VERIFY v1.2: the owner's asks, the standing rules, Parallax's rules and the plan's acceptance, checked against the built files

Filled in at milestone 11 (release gate) on 26 Nov 2026 (UTC). Release candidate 1 (a029c4d) went through every suite; its browser suite found regressions from the last fix rounds and one dead end, fixed in release candidate 2 (b2b2eed), which every row below describes. Each row names its evidence: a test (file, count, commit), a review (docs/dev/reviews/), a simulation (docs/dev/v1.2/*-sim.md) or a look at the built file. "Known miss" rows have a DECISIONS line and are listed for the owner at the end. 1.1's asks were verified in VERIFY-v1.1.md and still hold (their tests run in the suites below).

**Suites.** RC1: node 7,858 checks in 66 files, 0 failed; the browser suite (tests/run_all.sh, 46 files) passed 39 files, and the seven others led to RC2's fixes: drawing grids under 44 px on upright phones, Span's sideways labels at 12.9 px, Knots' sideways plate, a Pause copy and a first-time line in the player, and a Climb and Daily item that could never load (a dead end); two were test faults (a calibration run's mix, the dev harness's script list). RC2: the 17 browser files those fixes touch, 3,333 checks, 0 failed (harness_views failed once under load and passed 180/0 alone; sw.py, twotabs.py and the other files passed on RC1 and their code did not change); long runs on RC2 at 150 items a mode, every mode (Train, Path, Speed, Threshold, Free play, the Daily, the Spatial Check): phone 24 checks and desktop with the sandboxed srcdoc host 33 checks, 0 failed; 978 desktop and 1,011 phone rows, 2 voided; the srcdoc backup (108 trials) re-imported unchanged; node 7,858 checks in 66 files, 0 failed.

## The owner's asks for 1.2 (BRIEF.md has his words; paraphrased here)
| # | Ask | What was built | Evidence | Status |
|---|---|---|---|---|
| 1 | 17 Nov: follow the standing rules' Privacy section from now on, and make one pass over everything published | tools/privacy_check.py on every push (pre-push hook; private values in an ignored file); the 17 Nov pass and fixes; history rewrites with his yes on 17 and 18 Nov; on 22 Nov guide figures were found showing local clock times: shots and the PDF are now made in UTC, and with his yes (26 Nov) the old figures leave the history of build and main right before the merge | every push of this build printed "privacy check: clean"; RV-claims-1.2 found no owner data in the published texts | Done; the figure rewrite runs at the merge |
| 2 | 18 Nov: add a Central Point exercise, design ours | Central Point (EX-20): Quick by default (a deadline that tightens as you improve, near misses still score), Exact as a variant, the method taught in plain words, nudges behind a Move button | node centralpoint (exhaustive validator over the 169 answer points, 10 000 seeds per cell); harness_centralpoint 247/0; fit.py at 360 × 640, 390 × 844 and 1366 × 768; fresh-player runs | Done |
| 3 | 18 Nov: answer a player's complaint that the DAT-style formats were too hard and unlike the real ones | a taught first band (milestone 1); the six formats rebuilt toward the real formats (lettered options, plain drawings, test-range tags that describe format features only, figure sets with a tally pad), now Angles 4, Painted Cubes 4, Openings 3, Hole Punch 3, Form 3, Missing View 3 | firstband.test.mjs; each format's node tests and shortcut-levels; RV-items-1.2 and its fix rounds; fresh-player runs | Done |
| 4 | 18 Nov: one release with everything | 1.2 holds milestones 1–10 | the milestone rows below | Done |
| 5 | 18 Nov: the DAT-style formats stay opt-in | the focus is off by default; the Library's first screen has a "DAT-style formats: opt-in" button, and the group explains and offers the switch | play.py round 9 | Done |
| 6 | 18 Nov: the decision board (every recommendation; game B; the standard measurement budget; the baseline after the first tutorial; CC BY-SA for the prose; trimmed Chimera lines; his priority order; rising Climb sounds, a reward sound for a run that beats the best, a Summit achievement; Central Point Quick by default with the method taught) | PLAN.md decisions 1–4 and milestones 1–10 | the rows below; game.test.mjs (Climb sounds follow the Sound switch; Summit) | Done |
| 7 | 18 Nov: the papers he sent: notes in our own words, files kept out of the repository | notes in docs/research/v1.2/; the files stay outside the repository | the privacy check's "identical to a file the owner sent" passes on every push | Done |
| 8 | 14 Nov: no Duolingo-style streaks; keep the forgiving weekly count | no daily chain, freezes or warnings anywhere | game.test.mjs (no count of consecutive days) | Done |
| 9 | 19 Nov: a new player's first session is one two-minute tutorial, then the starting point, then training | first run: Spin's tutorial, then Baseline 1 (or Later), then Train | play.py run_firstrun; fresh-player first sessions on 19 Nov and RC1 | Done |
| 10 | 18–22 Nov: stop and resume on his word without losing work | clean wind-downs (commit, push, STATE.md, the status note) on 19 and 22 Nov | STATE.md history | Done |

## The standing rules (RULES.md; Parallax switched to them in 1.2, decision D1)
| Requirement | Evidence | Status |
|---|---|---|
| Fun: clear goals, fast feedback, visible growth, variety, wins worth sharing, a reason to come back that never punishes a missed day | milestone 5: grades, Reach, the Atlas, firsts, Daily v2, the weekly Climb, field notes, share cards; game.test.mjs, game.py | Done; the feel is the owner's checklist call |
| No Duolingo-style streaks | rule 11 row | Done |
| Fast progress at the edge on every dimension | milestone 7 | Done, with known misses (M7) |
| Plateau-breaking with a stated change and a follow-up | milestone 3 | Done, with a known miss (M3) |
| Transfer by portfolio, each exercise tagged with its bet, one bet new or under-tested | milestone 4; `def.bet` on every training exercise; calibrate is the new bet ("its transfer is untested") | Done |
| Progression modes, each saying when it is right | v1.1, and the "right when" lines and one suggestion at a time (milestone 2) | Done |
| Measurement: untrained near, mid and far probes, baselines, alternate forms, a poolable export, one person's gain visible within weeks | milestone 6; measure-sim.md | Done (the detectable gain is reported, not promised) |
| Two-minute start, tested on fresh agents | the table below | Done on a phone for 18 of 20 exercises and the first session; motion tasks go to the owner's checklist |
| Chimera: full welcome first, a lighter card later, a permanent link, the README's first line, the guide, tutorial ends, every share text, invites at high points, never inside a block | node chimera; shell.py; single.py | Done |
| Community features without a server | the seeded Daily and weekly Climb, challenge codes, result cards (game.test.mjs, daily.test.mjs) | Done |
| Licences and originality | LICENSE (MIT, the Chimera community), LICENSE-GUIDE.md (CC BY-SA 4.0), vendor/LICENSE-three.txt, fonts/OFL.txt; every item generated; no clones; RV-items-1.2 | Done |
| Data on the device; versioned saves; export and import | record format 4 with upgrade hooks from 1.1 and the test builds (record4.test.mjs); level conversions only go forward (rebase-builds.test.mjs); backups round-trip; twotabs.py | Done |
| Interactive check-ins | the decision board (18 Nov); playtest mode in test builds 1–4 (behind its setting in the release); the release checklist page | Done |
| Verification before release | this file | Done when the open rows close |

## Parallax's rules (CLAUDE.md 1–16)
| # | Rule | Evidence | Status |
|---|---|---|---|
| 1 | Chimera | node chimera (the link in every share text and tutorial end); shell.py; welcome and one-tap card on first and later launches | Done |
| 2 | Wording | RV-claims-1.2 (0 high) and its fixes; RV-guide-1.2; the six-word scan against BRIEF.md clean (W3-voice self-check) | Done |
| 3 | Test hygiene | every item generated; DAT-style formats only, never the ADA's items, instructions or drawings; the ADA line wherever the DAT is named (RV-claims-1.2 L10 fixed) | Done |
| 4 | Solver-verified items | node suites at ≥ 10 000 seeds per exercise; independent solvers for every rebuilt format; RV-items-1.2: keys right on about 70 000 items, one right answer, no duplicate options | Done |
| 5 | Shortcut solvers ≤ chance + 10 | node tests and shortcut-levels per dimension level; scoped exceptions with DECISIONS lines and per-cell tests: Nets, Slice and Fold (milestone 7), Hole Punch's diagonal and one-fold cells, Missing View's "middle" cells, Cube Match's quarter-swap cell; reported, not bounded: the formats' own methods (crease symmetry, Openings' corners), Reckon's last-leg cells | Done, with logged exceptions |
| 6 | Runs everywhere | single.py 17/0 (single file, srcdoc); sw.py (offline Pages copy; never from file://, frames, srcdoc or the single file) and twotabs.py on RC1; fit.py 238/0 and phones.py on RC2 | Done; at 1366 × 768 nine exercises' options end below the window (DECISIONS, PLAN-v1.3) |
| 7 | Timing validity | clock.py full mode on RC1 (5-minute real-time sessions); harness void checks; no saves during a stimulus; sessions saved on hide only after the item pauses (6e1336b) | Done |
| 8 | Accessibility | RV-a11y-1.2 (partial: 0 high, 4 medium, 5 low; all fixed); keyboard play in every harness; 44 px targets (bets.py); fit.py text floors | Done; known miss: Fold's draw-the-answer item on a sideways phone has 39 px cells (DECISIONS 26 Nov); the review's uncovered parts are listed there |
| 9 | Track as attention practice | its label and bet; no commercial trainer's name (the guide's reference title paraphrased, DECISIONS) | Done |
| 10 | Measurement | milestone 6; no IQ, index, percentile, norm or brain age (RV-claims-1.2) | Done |
| 11 | Game layer | milestone 5; game.test.mjs enforces no day counts, Reach never falling, nothing during `body.px-stim` | Done |
| 12 | Licences | rule row above | Done |
| 13 | Privacy | the privacy check on every push; exports without browser string, language or time zone unless device details are on (pooled.test.mjs; screen sizes too since 6e1336b); figures and PDF made in UTC | Done; the figure rewrite at the merge |
| 14 | Plateaus | milestone 3 | Done, known miss M3 |
| 15 | Transfer bets | milestone 4 | Done |
| 16 | Two-minute start and modes | the table below; "right when" lines | Done (see the table) |

## The plan's acceptance (PLAN.md milestones 1–11)
| M | Acceptance | Result | Status |
|---|---|---|---|
| 1 | first band: 74–84 % over the first 10 rated items (≥ 66 % on Angles and Hole Punch); fresh players pass on all seven; longruns clean | firstband.test.mjs passes on RC1; fresh-player table; early stretch items take D2's one-setting form, not none (DECISIONS 18 Nov) | Done |
| 2 | the pop-up in shell, section and longrun tests; the link in every share text and tutorial end | node chimera; shell.py; section.py; longrun.py | Done |
| 3 | plateau detector | plateau-sim.md: false alarms 1.5 / 1.3 % (≤ 5 %), 65 % caught within 600 answers (67.5 / 69.4 %), but 86.9 / 87.9 % within 800 against ≥ 90 % | Known miss (DECISIONS 50e73fb) |
| 4 | power simulated, balanced assignment, a bet on every exercise, every field in the export, texts matching the code | plateau-sim.md and measure-sim.md tables; bets.test.mjs; pooled.test.mjs | Done |
| 5 | game mechanics outside the stimulus; a first-week play-through; a DECISIONS line per mechanic | game.test.mjs, game.py, longrun.py | Done |
| 6 | false "likely gain" ≤ 5 % per report and ≤ 6 % ever; ≤ 10 % misspecified; coverage 92–98 % | 1.9 / 3.2 / 3.2 % per report; 5.9 % ever; ≤ 6.6 % misspecified; coverage 93.6–95.3 % (one cell of one seed at 91.8 %) | Done |
| 7 | ≥ 94 % of target items within ±0.10 of the edge; no dimension more than 5 points off; about 95 % coverage; shortcut cues within chance + 10 per dimension level | 93.8 %; Track's speed levels 6.6 points off on observed answers; coverage 97.8–98.1 %; scoped cells in rule 5 | Known misses (DECISIONS) |
| 8 | Central Point's validator and bounds; independent solvers and version bumps for every rebuilt format; Reckon's turn-only answers ≤ 50 % per leg cell | node suites; RV-items-1.2 rounds | Done |
| 9 | each item checked at 360 × 640 and desktop; the Daily migration tested on 1.1 saves; the service worker never from files | fit.py, phones.py; daily.test.mjs on real 1.1 and test-build saves; sw.py, sw.test | Done |
| 10 | an independent claims review; the six-word scan clean | RV-claims-1.2 and RV-guide-1.2, both fixed; the scan finds only the required Chimera line | Done |
| 11 | two-minute start; reviews of code, items, claims, the guide and a play-through; long runs; the privacy check on the release zip; `main` gets the 17 Nov cleanup | this file; a zip of the release tree (git archive, tracked files only) passed tools/privacy_check.py --zip, as did --tree HEAD, and both rerun at the merge; `main` receives the cleaned files with 1.2 | Done; the owner's checklist and the merge remain |

## Two-minute start: fresh agents that see only the app
The testers play from screenshots, so their action counts and times run slower than a person's, and they cannot follow motion (Track, the walks in Homing and Reckon, Span's lit sequence). A row passes when the tester plays correctly by the end of the tutorial and its first scored items.

| Exercise | Phone (390 × 844) | Desktop (1366 × 768) | Status |
|---|---|---|---|
| Spin (first-run tutorial) | RC1: the tutorial starts at action 2, first right practice answer at action 7, practice 5/5 (one pick-two item) | about 12 actions (22 Nov) | Pass |
| Rotate | Try right at once, 4/5 scored, about 9 actions | – | Pass |
| Fold | 5/5 Try, 5/5 scored, 8 actions | – | Pass |
| Nets | 5/5, 5/5, 19 actions | – | Pass |
| Slice | 5/5, 5/5, 16 actions | – | Pass |
| Views | 4/4, 5/5 (18 Nov) | 4/4 Try, 3/5 scored | Pass |
| Orient | 3/3, 5/5, about 11 actions | – | Pass |
| Span | 5/5 scored; Try guessed (the lit sequence outruns the screenshot loop) | – | Pass on scored items |
| Hidden | 4/4, 5/5, about 10 actions | – | Pass |
| Track | not judged from screenshots | – | The owner's checklist line |
| Homing | walk not readable from screenshots; dial tap fixed after | 3/5 scored | The owner's checklist line |
| Reckon | demo right; tap-to-walk and the dial's frame line added after the runs | 3/5 scored | The owner's checklist line |
| Knots | Try 1 harder than the demo, then pinned no harder (bae0abc) | 1/3 Try, 4/5 scored | Pass after the fix |
| Central Point | Try at the best spot; scored with partial credit | partial run | Pass |
| Openings | RC1: rules right; 1/4 Try at first try, about 3/5 scored, first right practice answer at about 25 actions; the proportion foils are small at 390 px | 1/4 Try, 4/5 scored (22 Nov) | Pass on the rules; larger options on phones in PLAN-v1.3 |
| Hole Punch | 3/3, 5/5 | – | Pass |
| Form | RC1: 3/4 Try, 4/5 scored, 13 actions | 1/4 Try, 2/5 scored (22 Nov, before the size foils were fixed) | Pass |
| Missing View | RC1: 1/4 Try, 5/5 scored, 24 actions (no item repeated) | – | Pass |
| Painted Cubes | version 3 (19 Nov): 4/4 Try, 5/5 scored, about 11 actions; version 4 on RC1: rules right, 16 actions, 2/5 Try and 2/5 scored on large, clear flat figures (counting slips by a smaller tester model) | – | Pass on the rules |
| Angles | 10/10 (19 Nov) | – | Pass |
| The first session (Baseline 1) | RC1: tutorial from action 2, the check from 19 to 132 (46 items, "about N min left" believable), the first training item at 133, training 5/5; the tester found the check long, as the owner's choice A expects | – | Pass |

## Reviews (docs/dev/reviews/)
| Review | Snapshot | Findings | Status |
|---|---|---|---|
| RV-code-1.2 | a434e64 | 0 high, 2 medium, 6 low | All fixed: M1 9111e85; M2 69532ad and 6e1336b; L1 a decision (bdf8ce7); L2–L4 6e1336b; L5 bcadf71; L6 b40c07e |
| RV-items-1.2 (stopped early for usage) | a434e64 | keys right on about 70 000 items; 6 high, 9 medium, 6 low shortcut and pool findings | Fixed by balancing (Angles 4, Views 3, Painted Cubes 4, Spin, Hole Punch, Missing View, Openings, Form, Mechanisms 3, Motion Graphs 2, View Match's settings, no repeats across checks) or scoped with per-cell tests (rule 5 row); not reached (Level, Word Links, an independent solver for Missing View's solids) is in PLAN-v1.3 |
| RV-claims-1.2 | a434e64 | 0 high, 5 medium, 18 low | Fixed (a6e6b42, faa7786, 2f85ef5; M5 by W1-band-B) |
| RV-a11y-1.2 (stopped early for usage) | a434e64 | 0 high, 4 medium, 5 low | Fixed (6e1336b, 8bf5286, 22b3a03, Painted Cubes' tally in version 4); the uncovered parts are listed in the review |
| RV-guide-1.2 | b228b60 | 0 high, 2 medium, 6 low; RV-claims-1.2's M1–M5 found fixed | Fixed (2f97d81), except L4: the reference title keeps its bracketed description (DECISIONS: no commercial trainer's name) |
| Play-through | RC2 | fresh-player runs above; long runs on desktop, phone and srcdoc | Passed (phone 24/0, desktop and srcdoc 33/0) |

## Deliverables
| Deliverable | Where | Status |
|---|---|---|
| Repository ready for GitHub Pages | `build`; `main` receives it with the owner's yes | Ready after his checklist |
| One self-contained HTML file | dist/Parallax.html (RC2, 5,416 KiB) | single.py 17/0 on RC2 |
| PDF guide | docs/Parallax-Guide.pdf (57 pages, 114 links; metadata names the Chimera community, dates in UTC) | Built on RC1 |
| Discord announcement under 2,000 characters | docs/dev/DISCORD-v1.2.md (1,993 characters) | Draft, on the checklist page |
| Build log and playbook lessons | project docs | At release |

## For the owner
- His release checklist (a page of pass or fail taps), then his yes to merge. On 27 Nov he gave the go without the checklist (DECISIONS 27 Nov); Daily v2 and the CHANGELOG moved to the merge day, 27 Nov (UTC), and the Daily-related node files, single.py and game.py were rerun on it. Before the merge, the figure rewrite of build and main runs (his yes of 26 Nov); the old commit IDs join his GitHub Support list.
- Known misses to accept: plateau detection within 800 answers (87–88 % against 90 %); milestone 7's edge share (93.8 % against 94 %) and Track's speed levels; the scoped shortcut cells in rule 5's row; Fold's sideways drawing cells (39 px); nine exercises that scroll a little at 1366 × 768; the item review's unreached parts (all in PLAN-v1.3).
- Tags: v1.1.0 and v1.2.0 are his taps under Releases (the proxy refuses tags).
- Not run: the O45 search for a randomised path-integration training study, so Reckon's wording about training effects stays as in 1.1. Real-phone frame checks for Homing and Reckon (O18, O19) are his checklist's walk line and a community call.
