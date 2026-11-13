# VERIFY v1.1: the owner's asks, Parallax's standing rules and the deliverables, checked against the built files

Filled in at M8 (release gate). Each row names the evidence: a test (file, count, commit), a review (docs/dev/reviews/), or a look at the built file. "Open" rows block the release until they are closed or the owner accepts them.

## The owner's asks (BRIEF.md, 13 Nov)
| # | Ask (BRIEF.md) | What was built | Evidence | Status |
|---|---|---|---|---|
| 1 | "Figure out whats up with the time counting, looks bugged; and other bug fixes" | One active-time clock (js/core/clock.js) for sessions, Check and Section; I1's repros fixed | clock.py full 73/73 (B1, b49f12b); I1 repro 31/31; RV-H | |
| 2 | "Implement path integration mode with no landmarks, with dead reckoning" | Reckon (EX-12), no fixes of any kind; Homing kept as the landmark stage | reckon.test 96 checks (20 304 items); harness_reckon 62/0; RV-E | |
| 3 | "Implement knotting/deknotting" | Knots (EX-13): pull, untie, tie, link | knots.test 225 checks (10 000 seeds per variant); harness_knots 340/0; RV-C | |
| 4 | "implement dat pat questions as training" | Six DAT-style formats (EX-14…19), opt-in DAT-style focus, Section practice | node and e2e per exercise; section.py; RV-A, RV-B, RV-D | |
| 5 | "Make mobile experience better, for example make homing usable on it" | Phone item screen, fit at 360×640 for every scored item, landscape layouts, Homing by touch | fit.py (B2), harness_homing 161/0 | |
| 6 | "Check if analogical assesment test isnt being praffed by the exercises inside Parallax, if yes, give a warning or smth." | Test-overlap notes, About "Test hygiene", one-tap Check question, "Taking a test soon?" helper; the specific test is named in v1.2 (owner, D3) | overlap.test, overlap.py, RV-B | |
| – | "dragon says smth about some code but we dont need it" | No outside code used; Reckon reimplements from R1 | grep, licence check | |

## Parallax's standing rules (CLAUDE.md 1–12; D1: Parallax keeps its own rules in 1.1)
| # | Rule | Evidence | Status |
|---|---|---|---|
| 1 | Chimera pop-up every open; link in header/More, footer, About, guide, share cards | single.py; preview smoke | |
| 2 | Honesty (no IQ/grades claims; ranges; limitation lines) | claims-vs-code reviews; guide review | |
| 3 | Test hygiene (no clones, no copied items) | R3 §6; RV-A/D wording checks | |
| 4 | Solver-verified items, ≥ 10 000 seeds, independent validators | node suite; RV-A/C/D/E | |
| 5 | Shortcut solvers ≤ chance + 10 | node suite; reviews; DECISIONS (methods vs cheap cues) | |
| 6 | Runs everywhere (file://, Pages, single file, srcdoc, phones) | single.py, srcdoc runs, preview artifact | |
| 7 | Timing validity | clock.py, harness voids, RV-H | |
| 8 | Accessibility | fit.py 13 px floor, keyboard checks, a11y review | |
| 9 | Track labelled attention practice | screens.py | |
| 10 | Measurement (probes untrained, no feedback, two baselines) | flows.py, play.py check | |
| 11 | Gamification (no points/leaderboards/loss streaks) | review | |
| 12 | Licences (MIT, CC BY-SA, three.js MIT, Plex OFL) | LICENSE files; no GPL code | |

## Deliverables
| Deliverable | Where | Status |
|---|---|---|
| Repository ready for Pages (merge build → main with the owner's yes) | mighty-iq/Parallax `build` | |
| Single self-contained HTML | dist/Parallax.html | |
| PDF guide | docs/Parallax-Guide.pdf | |
| Discord announcement (< 2,000 characters) | docs/dev/DISCORD-v1.1.md | |
| Build log in the project; lessons merged into claude/playbook.md | project docs | |
