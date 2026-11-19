# RV-items-1.2: independent item-validity review (partial)

Reviewer: an agent that did not build Parallax. Snapshot: `/tmp/lead/snap_tb4` at a434e64 (1.2.0-test.4), read only.
Written 2026-11-19 16:09 UTC. Stopped early on the lead's word (usage); what was not reached is listed at the end.

Method. For each exercise I wrote my own solver from the item data and the rules the player is told (learn.js rules,
captions, gen.js headers for the drawing conventions), never calling the repository's validator, solver or lib. Items
came from `def.generate(PX.rng(seed), params)` in the node test context, over every combination of levels and
variants (or an even sample where there are hundreds), with hashed seeds. For every item: my right set against
`item.key` and against `def.score` for every response; duplicate options in what the player sees; then cheap cues of
my own (and some standard ones) per dimension level and per full combination, and a birthday count of identical
items (same picture and option set, any order) per combination. Scratch scripts: `/tmp/rv_items/` (not committed;
`harness.mjs <id> <seeds per combo>`, `cellscan.mjs`, `cellall.mjs`, `repeats.mjs`, one `s_<id>.mjs` solver each).
"Chance" is `def.chance`; the bound is chance + 10 points. Percentages are hit rates of the cue on fresh items.

## Findings

Counts: 6 high, 9 medium, 6 low. No wrong key, no second right answer and no duplicate option was found on any
item my solvers covered (table below).

### High

H1. **Hole Punch: checkerboard parity and position cues beat chance + 10 on half the cells (rule 5 names parity).**
A crease on a diagonal through lattice points keeps a cell's checkerboard colour, so with diagonal folds every true
hole has the punch cell's colour, while "punch one cell away" or "extra hole" foils break it. "Every hole on the punch
cell's colour" picks the key in 36 of 72 combinations above chance + 10: 71–82 % at three diagonal folds
(`{folds:2,type:2}`, idle 0–1), 65 % at two diagonal folds, 50 % even at one fold. Stem-blind position cues add to it:
"the sheet whose holes sit farthest from the sheet's centre" 79.7 % at `{folds:1,type:3,idle:0,sheets:1}` (61.4 % at
sheets 0), "the sheet with the fewest side-by-side holes" 68.7 % at `{folds:2,type:2,idle:0,sheets:0}` (400 items per
combination; chance 20 %). Not in DECISIONS (crease symmetry is the logged method; parity is not). Reproduce: seed
2023902782 at `{folds:2,type:2,idle:0,sheets:0}`: A is the only sheet with no two touching holes and it is the key;
seed 1300333088 at `{folds:1,type:3,idle:0,sheets:1}`: D, the key, has the off-centre holes.

H2. **Missing View starter level: tiny pools and a "busiest drawing" cue.** At `{cubes:0, grid:0, missing:0 (end),
foil:1 or 2}` 300 seeds give only 4 distinct items (each about 75 times); 14 of the 18 starter combinations hold 25 or
fewer distinct items, so a player meets repeats within a few items (this is what the fresh player saw). Seeds
396944602, 1438794933, 2037970807 at `{cubes:0,grid:0,missing:0,foil:1}` are one item (heights `[[1,0],[1,0],[2,1]]`).
On the same level "the drawing with the most separate line pieces" (maximal runs, what the eye counts) picks the key
92.5 % (foil 0, end), 93.3 % (foil 0, front), 84 % (foils 1–2, top), and "the fewest pieces" 64–67 % at foils 1–2
front (120 items per combination; chance 25 %). The test bounds unit-segment counts for cube stacks, not pieces.

H3. **Painted Cubes 4–6 cubes (starter): "count the columns".** Two high (asked 3–4 or 1–2: the same items),
"answer = the number of columns" is right 50.6–51.9 %; three high (height levels 2 and 3 deal the same items),
"answer = the number of one-high columns" 48–52 % (800 questions per cell, chance 20 %, bound 30 %). Neither is a
logged partial count (O57 covers "visible only" and "tops only"). Reproduce: `{cubes:0,height:1,asked:0}` seeds
27917154, 1668792695. The same cells hold only 42–126 distinct figure-and-question items each (60 draws), so 20 items
at one of them repeat with 78–99 % probability.

H4. **Openings: "the opening with the least cut away" (area ÷ bounding box).** 37.1 % at features "2 in all", 36.4 %
at "1 + 1 + 1", 34.8 % at "2 + 1 + 1" (1,440 items each; chance 20 %); with chamfers 41.8–42.2 % (720 each); 43.3 % at
`{features:1,edges:1,keyview:1,pose:0,foils:0,turn:2}` (600 items). These are test-range levels. The test bounds the
largest and smallest absolute area, not the share of the box. Example seeds at that cell: 1437470887 (key B, fills
.714 .920 .906 .857 .762), 800614638, 235460145.

H5. **Angles, aligned pose: "rank by how high each drawing reaches".** With one arm lying flat, the drawing's height is
the free arm's length × sin θ, which the arm search does not decorrelate. Acute: 51.7 % (6° gap), 46.4 % (5°),
42.6 % (4°), 37.0 % (3°), 34.1 % (2°) at resolve 0; 41.3 % at 6°, resolve 2. Obtuse, "the lowest is the largest":
49.1 % (6°), 40.0 % (4°) (1,500 items each; chance 25 %). Not logged; the aligned pose is below the test range but
rated. Seed 483331629 at `{gap:1,size:1,pose:0,resolve:0}`: heights .448 < .496 < .626 < .777 give 2-4-1-3, the key B.

H6. **Spin, same or mirror at about 90°: the lean of the figure.** "Same when the outline's diagonal lean flips, mirror
when it keeps" (sign of the vertices' xy product moment about the centre) is right 75.8 % ± 1.0 at
`{variant:'samediff',angle:4,cells:2}` (2,000 items), 68–76 % over the cells levels at that angle, 58–64 % at 70° and
110° (chance 50 %, bound 60 %). A mirror is made across the lattice line nearest the principal axis, so a quarter
turn flips a copy's lean and keeps a mirror's. Seeds 27917154, 239479018 at that cell.

### Medium

M1. Painted Cubes, five painted sides: peak columns are never side by side, so "count the tallest columns" answers
100 % of these questions on two-high figures, 59–64 % on three-high and about 41 % on four-high (about 370 each). The
scoped exception (DECISIONS) covers "the most common answer" only. Later questions are unrated in Train but count in
Section practice.

M2. Painted Cubes first questions: 20 of 66 (combination × N) pools have three possible counts (ranges of width 3 in
KRANGE / KRANGE_FLAT, e.g. flat 18–22, N = 1: 3–5), so "the most common count for this level and N" is right about a
third of the time (measured 34–40 % on 186–500 items) against the 30 % bound DECISIONS applied to the starter band.
The "within chance + 10 per level and number" line holds for dimension marginals, not for the pools the engine deals.
Example: `{cubes:4,height:0,asked:1}` (N = 1): counts 3/4/5 on 190/145/165 of 500.

M3. Views toview, top view (`view:0`) at 4 and 6 cubes: "the shortest drawing" 41–44 % and "the smallest area"
40–41 % (600 items per combination, chance 25 %); DECISIONS balances them only on the starter level. Views toobject at
12 cubes on 3 × 3 holds only about 50–110 distinct items: 20 items there repeat with 82–98 % probability.

M4. Form, plain kind (`marks:1`, test range): "the solid whose longest edge is shortest" 38.6 % (foil 0) and 42.5 %
(foil 1), 720 items each, up to 46–47 % in solid cells; the test bounds volume, not the longest edge. Starter band,
L/T/U prisms, foil 0: "the smallest solid" 46.4 % (180 items).

M5. Missing View cube stacks, 4–7 cubes, foil 0: "the drawing farthest from its nearest neighbour" (unit edges and
fill) 42–43 % (400 per combination, chance 25 %); "largest" and "smallest filled area" each 37–39 %.

M6. Mechanisms (probe), jams level: "it cannot turn" is the key on 47.9 % of items (800), 33 % at the belts level;
DECISIONS 2026-11-19 logs those shares but not a rule-5 exception, so "always E" is 48 % against 20 % chance, and the
answer letters are uneven there (14/14/12/12/48).

M7. Motion Graphs (probe), velocity at level 0: "the graph that never touches or crosses the zero line" 59.8 % (300
items), 42.6 % at level 1 (chance 25 %).

M8. View Match (probe), flag at about 160° (`angle:4`): "the picture from the far side" (the azimuth farthest from the
default view) is the key 79 % of the time (540 items): 100 % at foils 80–110° away, 85 % at 55–75°. EGO_P guards the
near-side pick only. "Left-to-right order least like the default view" 39–44 % at angles 2–3.

M9. Pattern Memory (probe): small pools at the smallest grids: 3 × 3 holds about 26–39 distinct patterns per
regularity level, 3 × 4 scattered about 31 and shapes about 94 (800 draws each). Five items at one such cell repeat a
pattern 23–32 % of the time, and repeated checks keep reusing them, which a memory probe should avoid.

### Low

L1. Angles, acute, 6°, extremes: "the most equal arms is the widest" 35.3 % ± 0.6 (6,000 items), at the bound.
L2. Hole Punch, sheets level 0: three of five sheets keep the key's hole count, so "the most common count" is 33.3 %.
L3. Central Point: "half-way between the most central target and the average" lands in the band 40–60 % of items and an
inverse-square weighted average 39–74 % (chance about 1 %). Kin to the logged "average nudged towards the group"
exception (DECISIONS 2026-11-18) but not named there; worth naming.
L4. Reckon: in the reported turn-only family, "the start is straight back along the last leg" (only the final turn
undone) is right 67–75 % at ±40° on two-leg routes (route levels 0 and 2) and 53 % for walks back at route 0; at route
1 the legs level changes nothing and equal-leg answers are right 95 %. Policy reports this family (DECISIONS
2026-11-13); the last-leg answer integrates almost nothing and could be bounded on its own.
L5. Probe pools across checks: Other Way Round turn level 0 about 316 items, Motion Graphs 350–1,600 per cell: repeats
across baselines and monthly checks are likely, within one check rare.
L6. Cube Match quarter × swap: "most symbols in the reference's places" 33–35 % (800 per cell), at the bound; the
spin × swap and flip × swap cells (42–50 %) are the logged exception.

## What was checked

| Exercise | Own solver | Items (keys checked) | Key / one right / scorer | Duplicate options | Cheap cues | Positions | Repeats |
|---|---|---|---|---|---|---|---|
| Central Point | totals on the 169 points | 2,400 | all agree; scorer matches on every point | n/a | L3 | n/a | not run |
| Angles | angles from the drawn ends | 8,640 | all agree | none | H5, L1 | even | none (4,320) |
| Painted Cubes | recount from heights; own ray cast (every top ≥ 50 % seen) | 2,643 questions | all agree | none | H3, M1, M2 | ranges (M2) | H3 |
| Openings | own silhouettes, D4 match | 1,728 | all agree; smallest foil difference 1.875 step² | none | H4 | even | none (8,640) |
| Missing View, cube stacks | own drawings + exhaustive search | 1,350 | all agree; my drawings of the stated heights match | none | H2, M5 | even | H2 |
| Missing View, solids | **no independent solver** | 864 | not re-derived | none | none found | slight (n 288) | not run |
| Hole Punch | own fold simulation | 4,320 | all agree | none | H1, L2 | even | not run |
| Form | own net laying (orientation kept) + own visibility | 1,344 | all agree; no foil differs only on faces not clearly seen | none | M4 | even | none (5,040) |
| Views | own views, own isometric visibility | 2,700 | all agree (toview, toobject, count); every cube shows a whole face | none | M3 | even | M3 |
| Reckon | path from legs and turns | 2,304 | keys and scorer edges agree; no disk holds the end | n/a | L4; fixed answers within bound | n/a | not run |
| Knots | own crossings, PD code, Kauffman bracket | 1,200 | all agree (pull, untie, tie, link) | none | none confirmed | yes/no about 50 % | not run |
| Spin | polygon match by turn or mirror | 2,700 | all agree; references chiral, no rotational symmetry | none | H6 | even | none (5,400) |
| Other Way Round | per strand (turns, folds, sections, nets, profiles, bearings) | 5,400 | all agree; conventions consistent on every item; whereami foils ≥ 24.5° off | none | none over the bound | even | L5 |
| Motion Graphs | normalised graphs, bus frame | 3,600 | all agree; foils ≥ 0.2 apart | none | M7 | even | L5 |
| Balance | mean, median | 3,600 | all agree; scorer edges | n/a | none (cheap picks out) | n/a | not run |
| Cube Match | 24-rotation search | 2,880 | all agree | none | L6 (logged cells aside) | even | none (1,920) |
| Mechanisms | meshing graph from geometry | 3,200 | all agree | none | M6 | M6 | none (1,280) |
| Pattern Memory | clusters, lines, scorer | 16,800 (structure) | all agree | n/a | blind squares within caps (scoped cells) | n/a | M9 |
| View Match | flag azimuth, own left-right order | 2,700 | all agree; foils at their level's gap | n/a | M8 | even | none (2,700) |
| Level | — | not reached | | | | | |
| Word Links | — | not reached | | | | | |

Test-range tags (read from each definition): every tag and note describes format features (figure sizes, features,
turns, fold counts, sheet counts, marks, the look); none found describing anything else.

Not reached: Level and Word Links; an independent solver for Missing View's profile solids (levels 3–6, the format's
own test range: only option distinctness, balance and cues were checked); repeat counts for Central Point, Hole Punch,
Reckon, Knots and Balance; Knots' cheap cues beyond small cells (n = 30, nothing confirmed); Section-practice forms and
Spatial Check forms as concrete sessions (repeats were measured per combination instead).
