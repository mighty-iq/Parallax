# PLAN v1.3: backlog (items deferred from v1.2)

Started 2026-11-18 at the v1.2 plan. Add each item the moment it is deferred, with its reason and source.

| Item | Source | Why deferred | Size |
|---|---|---|---|
| Reckon later rungs: point to the start mid-route (rate only the final answer), curved legs (≤ 30°/s while moving), active steering with its own rating (steady target 2–6 m, 2 m/s, 60°/s, 0.3 s time constant) | O37; docs/research/v1.2/N1-reckon.md §4.1–4.3, §6 #12–14 | note N1 §6 places them after v1.2; v1.2 changes Reckon's rated levels first | L |
| Reckon drift trend on Progress (weekly median with range, at least 15 return routes, one route-length band) | O38; note N1 §4.4, §6 #15 | note N1 §6 places it in v1.3; it rests on the v1.2 measurement work | M |
| Knots: the 3D mirror variant and the 3D "pull tight" demo | O46 | no new research in v1.2; needs its own projections, validator and shortcut analysis | L |
| Knots: R2's later ideas (rope through a ring, three rings, Tuck, Hang, a tube look, a colour gradient) | O47 | optional ideas, no research this round | L |
| Orient as a 3D tabletop | O60 | no research this round | L |
| New exercises for closure speed, spatial scanning and imagery | O61 | no research this round | L each |
| Openings' curved features (quarter-circle notches) and remaining top-level foils: interaction outlines, "face, not outline" and "too large" foils, the strict-superset foil, the 15 % proportion level, the congruent-silhouette report | rest of O50; note D1 §6.6 | curves break the exact quarter-cell model and need a new solver; the foils extend the top levels after the v1.2 test-range rebuild lands | L |
| Hole Punch half folds | note D1 §6.8 | after the v1.2 look change settles | M |
| Central Point weighted targets | note C1 §3.2, §9 | not simulated in v1.2 (the speed form moved into v1.2 as Central Point's default, Quick) | M |
| Game option C pieces worth a later look: the cooperative tile on the Climb card, a ghost comparison on the summary only | note G1 §4 | only if the community asks | M |
| Rebalance Hole Punch's two- and three-fold diagonal and mixed combinations, where colour, distance from the centre and touching holes still beat chance + 10 (scoped exceptions in 1.2) | RV-items-1.2 H1 | the residual cells were accepted for 1.2 with per-cell bounds | M |
| Move Missing View's session guard (no stem twice in a session) into the player, for every exercise with small pools | W1-band-B's request, 22 Nov | lives in js/ex/patviews for 1.2 | S |
| Rerun the independent item review where 1.2's stopped early: Level, Word Links, an independent solver for Missing View's solids | RV-items-1.2 "not reached" | review cut short for usage | M |
| Reckon's route 2 fold-back routes, where "the start is straight back along the last leg" beats chance + 10 in 16 of 98 cells (reported in 1.2, like v1.1's turn-only answers) | RV-items-1.2 L4 | a generator change, deferred after 1.2 | M |
| Painted Cubes above the starter band: a figure can come back within a session (the session guard can't re-seed one question of a figure set); later questions at flat 6–9 cubes lean to "2" (41 % per setting); "count painted sides except the top" 33–39 % on 3–4-high "few painted sides" first questions | W3-bandA, 22 Nov | residuals after Painted Cubes version 4 | M |
| Cube Match quarter turn with swapped symbols: "most symbols in the reference's places" 36.4 % (1.4 points over), logged with the existing exceptions | RV-items-1.2 L6 | probe; held at 60 % by its test | S |
| Missing View's starter band: wider band drawings, so "the middle" (neither the busiest nor the emptiest drawing) stops beating chance + 10 at the band's outline level (39 % solid lines, 47 % area; scoped in 1.2) | W1-band-B, 22 Nov | the band's small drawings leave few line positions to vary | M |
| Missing View: a lighter area rule, so "the middle" by filled area falls back under chance + 10 at levels 1–2's outline level (39.8–53 % after 1.2's band rule; scoped in 1.2 with per-cell bounds) | W1-band-B, 26 Nov | an app-code change, left out of the frozen release candidate | S |
| Pattern Memory: keep Confirm in one place across grid sizes, and show a countdown on the Look screen | fresh-player first session on RC1, 26 Nov | a missed Confirm after a 3-second look | S |
| Openings on phones: larger option drawings (or a tap to enlarge), so proportion foils read at 390 px | fresh-player runs on a phone, 19 and 26 Nov (Try 1 of 4 at first try) | the format's fine distinctions are small at phone width | S |
| Climb and Daily: skip a seeded item that is voided twice instead of dealing it again (a dead-end guard behind 1.2's `nearestAt` fix) | lead, 26 Nov | 1.2 removed the known cause | S |
| Fold's draw-the-answer item on sideways phones: hide the title row so the cells reach 44 px (39.2 px in 1.2) | lead, 26 Nov | rule 8 | S |
| Desktop at 1366 × 768: fit the options of Track, Rotate, Missing View, Painted Cubes, Form, Cube Match, Other Way Round, View Match and Mechanisms without a scroll (fit.py --sizes 1366x768) | W2-core, 26 Nov | not a 1.2 regression; phones fit | M |
