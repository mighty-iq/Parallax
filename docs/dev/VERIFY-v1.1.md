# VERIFY v1.1: the owner's asks, Parallax's standing rules and the deliverables, checked against the built files

Filled in at M8 (release gate), 14 Nov, from the final suite on bcf1b83+ (node 3,768 checks; browser chunks: A clock 74/0, longrun desktop 6 modes clean; B 1,004/1; C 3,669/0). Long play-throughs: desktop train, path, speed, threshold, free, daily (300 per mode) and phone the same (150 per mode) clean; Spatial Check on desktop and phone 11/0 each (two complete checks, 160 answers, the one-tap question answered); sandboxed preview 12/0 (export and import round trip). Each row names the evidence: a test (file, count, commit), a review (docs/dev/reviews/), or a look at the built file. "Open" rows block the release until they are closed or the owner accepts them.

## The owner's asks (BRIEF.md, 13 Nov)
| # | Ask (BRIEF.md) | What was built | Evidence | Status |
|---|---|---|---|---|
| 1 | "Figure out whats up with the time counting, looks bugged; and other bug fixes" | One active-time clock (js/core/clock.js) for sessions, the Spatial Check and Section practice; the I1 repros fixed; RV-H's four clock and data bugs fixed | Final suite: clock.py full 74/74 (5-minute Train, Path, Speed in real time with pause, hidden tab, idle; every I1 repro); node core-clock 46 checks; RV-H re-checked in B1's round | Done |
| 2 | "Implement path integration mode with no landmarks, with dead reckoning" | Reckon (EX-12): no landmarks, no map, re-seeded ground, speeds that hide distance; point or walk back; error, drift and habit feedback; Homing kept as the landmark stage | Final suite: node reckon 101 / homing 95 checks; harness_reckon 74/0, harness_homing 161/0; RV-E (scoring recomputed); fresh-player test: plays within 2 min | Done, with decision (a): turn-only answers are partial integration (DECISIONS) |
| 3 | "Implement knotting/deknotting" | Knots (EX-13): pull (does a knot remain?), untie and tie (which crossing), link; every item proved; show-me checked move by move | Final suite: node knots 463 checks (10 000 seeds per variant); harness_knots 342/0; RV-C (8,100 items re-derived, 0 wrong); 20,040 replays clean; fresh-player: within 2 min | Done (mirror variant left for later) |
| 4 | "implement dat pat questions as training" | Six DAT-style formats (EX-14…19), opt-in DAT-style focus (leads Train while on), Section practice (mini 30/20 min, full 90/60 min) | Final suite: node per format at ≥ 10 000 items; harness 118/111/161/174/161/105; section.py 106/0; RV-A, RV-B, RV-D; fresh-player: all six learnable | Done |
| 5 | "Make mobile experience better, for example make homing usable on it" | Phone item screen, every scored item fits 360×640, sideways layouts, Homing by touch (drag, dial, ±1°/±5° that let swipes scroll) | Final suite: fit.py 213/1 (the one: a Watch measured before its scroll under load; rerun alone 17/17); screens 358/0; shell 230/0; long phone play-throughs clean (7 modes) | Done |
| 6 | "Check if analogical assesment test isnt being praffed by the exercises inside Parallax, if yes, give a warning or smth." | No exercise uses the analogy format; the Spatial Check's word task does, briefly and without feedback. Test-overlap notes on every overlapping exercise, About "Test hygiene", a one-tap question on later Checks, a "Taking a test soon?" helper that pauses matching exercises | Final suite: node overlap 117 checks; overlap.py 58/0; RV-B | Done; the specific test is named in v1.2 (D3) |
| – | "dragon says smth about some code but we dont need it" | No outside code: Reckon is built from R1's research notes; vendor/ holds only three.js (MIT) and fonts/ IBM Plex (OFL) | ls vendor fonts; package.json devDependencies three, esbuild | Done |

## Parallax's standing rules (CLAUDE.md 1–12; D1: Parallax keeps its own rules in 1.1)
| # | Rule | Evidence | Status |
|---|---|---|---|
| 1 | Chimera pop-up every open; link in header/More, footer, About, guide, share cards | shell.py 230/0, single.py 17/0, preview smoke 22/22 (pop-up with link on open); guide pages | Done |
| 2 | Honesty (no IQ/grades claims; ranges; limitation lines) | RV-B, RV-D (bridges with limitation lines), RV-G (guide); Library notes for Reckon/Homing; Section never predicts a score | Done |
| 3 | Test hygiene (no clones, no copied items) | Every item generated; codes EX-14…19 (no mark); ADA line wherever the DAT is named; reworded sentences close to the ADA's (RV-A, RV-D) | Done |
| 4 | Solver-verified items, ≥ 10 000 seeds, independent validators | Final node suite 3,768 checks in 31 files; independent recomputation by RV-A (7,050 items), RV-C (8,100), RV-D (8,400), RV-E (every route): 0 wrong keys; Missing View and Form validators made independent | Done |
| 5 | Shortcut solvers ≤ chance + 10 | Node tests bound every cheap cue per level; reported, not bounded (DECISIONS 13 Nov): Hole Punch/Fold crease symmetry and Openings corners+proportions (format methods), Openings most-featured face (≤ 50 %), Reckon/Homing turn-only answers and a fixed answer on 11 easy cells | Done with logged exceptions |
| 6 | Runs everywhere (file://, Pages, single file, srcdoc, phones) | single.py 17/0 (single file + srcdoc), harness srcdoc checks, longrun srcdoc, preview artifact smoke 22/22 | Done |
| 7 | Timing validity | clock.py 74/0; harness_reckon/homing void scenarios; RV-H (no saves during px-stim; voids never count); Section countdown frozen during stimuli | Done |
| 8 | Accessibility | fit.py text ≥ 13 px and 150 % text without sideways scroll; keyboard play in every harness; 44 px targets (focus switch fixed); non-colour cues (Section chips, Form marks) | Done |
| 9 | Track labelled attention practice | screens.py 358/0; labelLine/tagOf | Done |
| 10 | Measurement (probes untrained, no feedback, two baselines) | flows.py 73/0, play.py 103/0; Check time no longer counted as practice; Angles → Level note in Progress | Done |
| 11 | Gamification (no points/leaderboards/loss streaks) | No new points, leaderboards or loss streaks; "Full section" achievement needs real answers; game layer is v1.2 (D1) | Done |
| 12 | Licences (MIT, CC BY-SA, three.js MIT, Plex OFL) | LICENSE, LICENSE-GUIDE.md, vendor/LICENSE-three.txt, fonts/OFL.txt; no GPL/AGPL/non-commercial code (Knots reimplemented, no SnapPy/Regina/KnotPlot) | Done |

## Deliverables
| Deliverable | Where | Status |
|---|---|---|
| Repository ready for Pages (merge build → main with the owner's yes) | mighty-iq/Parallax `build` | Ready; waiting for the owner's yes |
| Single self-contained HTML | dist/Parallax.html | Built 14 Nov (3,660 KiB); single.py 17/0 |
| PDF guide | docs/Parallax-Guide.pdf | 50 pages, no overflow, 93 URLs clickable; RV-G fixes in |
| Discord announcement (< 2,000 characters) | docs/dev/DISCORD-v1.1.md | Draft, 1,987 characters |
| Build log in the project; lessons merged into claude/playbook.md | project docs | Playbook merged 14 Nov; build log at release |
