# C1: Central Point (EX-20): the source test, human estimation of central points, item design, shortcuts, teaching and the transfer bet

Research notes for Parallax v1.2, Phase 1, milestone 8 ("Central Point", the owner's request after a
community member's idea). Written 2026-11-18 (UTC) by research agent C1. No app file was changed; the
only other files written are the numeric spike in `docs/research/v1.2/spikes/C1/`.

Status: in progress (sections are filled as they are finished).

## Summary (short answers)

(filled at the end)

## 0. Method and reading levels

- Repository read: CLAUDE.md; docs/dev/PLAN-v1.2.md (all, milestone 8 in detail); docs/dev/EXERCISE-GUIDE.md;
  js/ex/registry.js; docs/dev/ENGINE.md §1–4; docs/research/v1.1/R4-test-overlap.md (§1, §3 tables);
  js/ex/reckon/gen.js header (the closest existing exercise: a position answer with a tolerance and a
  continuous error); docs/research/v1.0/A-evidence.md §6.2 (the CHC narrow abilities); the headings of
  docs/research/v1.2/T1-transfer-portfolio.md (in progress in parallel; not edited).
- Web: WebSearch (titles and URLs only) and WebFetch (pages and PDFs). Direct downloads with curl were
  refused by the network proxy for every host tried, and cognitivemetrics.com refused WebFetch too. The
  shared web-search budget for this run ran out after the Q1 and Q2 searches, so a few sources I would
  have liked are under "Could not open".
- Reading levels, after each source:
  **[FT\*]** full text passed through the fetch tool: the tool read the whole text and answered my
  questions about it; I did not read every page myself; **[PT]** part of the text; **[AB]** abstract or
  catalogue page only; **[SR]** secondary report (named); **[WP]** a reference or web page read in full;
  **[ST]** search-result title and URL only. Numbers marked "my calculation" are mine.
- Labels in the text: **Found** (what a study reported), **Inference** (my reasoning from findings or from
  the mathematics), **Proposal** (a design choice for Parallax).
- The numeric spike is `docs/research/v1.2/spikes/C1/spike.mjs` (plain Node, no dependencies, seeded,
  reads and writes nothing in the app). Section 4 gives its tables and the command.

## 1. Which test is the format from? (Q1)

**Not identified.** I found no public test, subtest or item bank with a "Central Point" subtest in which
the player picks the grid point with the smallest total (or average) distance to marked points.

What I tried (WebSearch, 2026-11-18):
- `"Central Point" subtest spatial test grid points smallest total distance`;
  `"central point" test "average distance" dots grid IQ subtest cognitivemetrics`;
  `spatial ability test subtest "central point" choose point closest to all marked dots partial credit`;
  `"Central Point" test spatial reasoning online IQ`; `"Central Point" high range IQ test spatial Gv`;
  `cognitivemetrics.com test "Central Point"`; `"Central Point" "Visual Puzzles" OR "Figure Weights"
  OR "Spatial" subtest new online test 2025 2026`; `reddit cognitiveTesting "central point" subtest`.
- `"lowest average distance" grid dots test which point`; `"smallest sum of distances" OR "minimum total
  distance" grid point task cognitive test partial credit score dots`; `"centre point" test grid of
  dots choose location minimum total distance aptitude psychometric`; `IQ test subtest pick the dot
  closest on average to all the red dots grid`.
- `"geometric median" puzzle intelligence test item estimate visually`; `"Fermat point" OR "geometric
  median" "intelligence test" OR "aptitude test" item visual`; `"geometric median" game OR puzzle
  "find the point" minimize sum of distances players estimate by eye`.
- Other languages and communities: a Russian query (central point, grid, sum of distances), a
  Serbian/Croatian query with Kvaščev's name (a test author whose tasks the community trains).
- Batteries checked by name and found not to hold such a subtest: the RIOT test's 15 subtests [WP,
  riotiq.com subtest list: names only, none fits]; TOGA (four verbal and numerical subtests) [WP,
  a community post]; the CORE and CAIT lists in R4 §1.4 [SR there]. cognitivemetrics.com itself could
  not be opened (proxy refusal), so its newest "spatial exam", which R4 could not open either, remains
  the most likely unchecked candidate (an inference from where this community tests, not evidence).
- What the searches did find is the same problem outside testing: GIS centrography tools (ArcGIS
  "Central Feature", the feature with the smallest summed distance to the others [WP, Esri help];
  GRASS `v.centerpoint`, which offers the mean, the geometric median and the input point nearest the
  geometric median [WP]; R `aspace::calc_cmd`, the "centre of minimum distance" [WP]), and programming
  exercises ("best position for a service centre", Euclidean; "best meeting point", city-block) [ST].

So nothing is public that I could report about format, scoring, timing or norms. **Proposal:** ask the
owner (or, through him, the community member) for the test's name or a link; a description in words is
enough, and no screenshot or item should enter the repository (standing rule 13 and test hygiene,
rule 3). Until then the overlap entry in §7 is written for the format, not for a named test.

## 2. How people estimate central points (Q2)

### 2.1 Centroid estimation and ensemble perception of position

**Found.**
- **Adults put "the middle" of a dot set at the arithmetic mean.** Jones & Dekker 2017 [FT\*]: 30 adults
  and 90 children (6–11 years) touched "the middle" of 3, 4, 5, 6, 7 or 15 dots drawn from a 2D Gaussian,
  about 150 trials each, with feedback (right if within 12.8 mm of the true mean) and the hint that the
  middle need not hold a dot. Model fits on single trials: adults matched the mean in every condition.
  Children with 3 dots matched the centre of a circle around the dots and with 4–5 dots the centroid of
  the convex hull; they switched to the mean at about 6–7 dots. A "mean of a subset" model that drops
  the farthest dots fitted poorly in both groups. Strategy explained about 29 % of the children's
  precision gap at 3–5 dots. The authors cite Morgan & Glennerster 1991 as earlier evidence that adults
  use the arithmetic mean [SR, via Jones & Dekker].
- **Precision.** Drew, Chubb & Sperling 2010 [FT\*]: 8 or 16 dots shown for 200 ms, the centroid clicked
  with a mouse. Response noise averaged about 16–17 px for a cloud SD of 60 px, that is about 27–29 % of
  the cloud's SD (my calculation from their values), slightly worse with 16 dots than 8. With "attend to
  all" the weights were nearly equal across dots.
- **Ensemble coding.** Withdrawing attention degraded the remembered positions of single objects more
  than their centroid (Alvarez & Oliva 2008) [AB]. Saccades to dot clusters land near the clusters'
  centre of gravity (McGowan, Kowler, Sharma & Chubb 1998) [SR, via Juni et al. 2010].

**Inference.** The perceptual system computes a mean position quickly, cheaply and fairly precisely.
On a 7 × 7 board whose targets spread with an SD of about 1.5–2 steps, a 27–29 % noise would be about
0.4–0.6 steps for a brief look (my calculation); unhurried viewing is probably better. That precision
is for the mean, the wrong answer here. No study I found measured how precisely people place the
geometric median.

### 2.2 Biases: mean or median, the pull of outliers

**Found.**
- **Single clouds: the mean, even with heavy tails.** Juni, Singh & Maloney 2010 [FT\*]: for one 100-dot
  cloud, Gaussian or heavy-tailed (t with 3 df), most observers' influence functions did not differ from
  the centre of gravity: they did not use an outlier-robust rule. Only when the outlying dots looked
  like a second source (40 uniform noise dots, or a separate 15-dot cluster) did observers partly
  discount them, less than an ideal observer would; a cluster 3.5 SD or more away had no significant
  influence.
- **Weights are not always equal.** In Drew et al. 2010 [FT\*], of 66 observer-by-condition fits, 22
  over-weighted the outer dots ("anti-robust") and 14 over-weighted the central ones.
- **Feature averages are robust, positions less so.** For averaging features of an array (not
  positions), observers exclude or down-weight extreme samples (de Gardelle & Summerfield 2011) [AB].
  Trend lines fitted by eye to scatterplots fall between a robust fit and least squares (Correll & Heer
  2017) [SR, the authors' lab blog].
- **Size pulls the perceived mean.** In scatterplots, larger and, less so, darker marks pull the
  perceived mean position towards them; the bias persisted after training with feedback; the authors
  suggest viewers may subsample about 5–7 marks (Hong, Witt & Szafir 2021) [PT].

**Inference.**
- Two opposite errors are likely on this task. (1) **Dragged by outliers:** the default "middle" is the
  mean, which weights each target by its distance; this is the trap the plan describes. (2) **Ignoring
  outliers:** when far targets look like a separate group, people tend to drop them (source
  separation), but the geometric median still counts each one fully by its direction. The spike
  (§4) therefore tests both kinds of shortcut: the mean, and "centre of the densest group" or "mean
  without the farthest target".
- The plan's sentence "Most people aim for the average position" is an inference from "find the
  middle" studies (Jones & Dekker; Juni et al.), not a finding on this task. The guide should say
  "people tend to aim for the average position when they look for the middle", and cite those studies.
- **Proposal:** never show target weight by dot size: size inflates a mark's pull on the perceived mean
  (Hong et al.). Weighted targets, if added, use a numeral or stacked marks (§3.2).

### 2.3 Human performance on geometric optimisation (TSP, spanning and Steiner trees, facility location)

**Found.** MacGregor & Chu 2011, a review [FT\*], and the studies it reports [SR, via the review]:
- **Travelling salesperson problem (TSP), shown visually:** untrained adults come within about 1 % of
  optimal on 10- and 20-city problems (MacGregor & Ormerod 1996); 1–3 % above optimal on 6–10 cities,
  with 50–90 % of trials optimal (Graham, Joshi & Pizlo 2000); about 2.5 % above on 40 cities (Vickers
  et al. 2001); about 10–11 % above on 48–120 cities (MacGregor et al. 1999; Dry et al. 2006). People
  beat simple construction heuristics. Children: optimal tours on 20 % (age 7), 27 % (12) and 42 %
  (adults) of trials (van Rooij et al. 2006).
- **Spanning and Steiner trees:** 48 students were about 9 % above benchmark on 50-node TSPs, 6 % on
  50-node minimum spanning trees and 12 % on 15-node Steiner tree problems (Vickers et al. 2004).
- **Individual differences:** performance on TSP, spanning-tree and Steiner problems loads on general
  intelligence (Burns, Lee & Vickers 2006, N = 101, covariance modelling) [AB]; correlations with Raven's
  Advanced Progressive Matrices (Vickers et al. 2001, 2004) [SR].
- **Models:** global-to-local processing: the convex hull first, then inner points; coarse-to-fine
  "pyramid" clustering (Graham et al. 2000; Pizlo et al. 2006); crossing avoidance; the review favours
  global-to-local accounts. People also connect dot constellations in structures close to minimum
  spanning trees (Dry, Lee, Navarro & Preiss 2009) [FT\*].
- **Facility location (Fermat–Weber, p-median): the review found no human data**; it only suggests that
  centre-of-mass judgement might be involved. The one study I found: a web game in which 40 students
  dragged 2–8 facilities among 15–30 customers while a live total-distance readout and a ranking were
  shown; the best submitted solutions came within about 2 % of a genetic-algorithm benchmark
  (Allahbakhsh et al., an undated manuscript, about 2018) [FT\*]. With a live readout this is search by
  trial and feedback, not an estimate by eye.

**Inference.**
- Each Steiner point in a minimal Steiner tree is the Fermat point (the geometric median) of its three
  neighbours, with 120° between the edges (a standard property; see §3.1). Steiner trees were the
  hardest of the three problems in Vickers et al. 2004 (12 % above benchmark against 6 % for spanning
  trees). That is indirect evidence that **placing a new point that balances several others is harder by
  eye than linking given points**, which is what Central Point asks. It is also why the task can
  produce a learning curve: TSP-like routing is near ceiling for untrained adults; this is not likely
  to be.
- The task is new to the literature: no study measured unaided human estimates of the geometric
  median, so Parallax's pooled exports would be first data (§6).
- **Proposal:** never show the total distance while the player is choosing. A live readout turns the
  task into hill-climbing on a number (as in the crowdsourcing game), which needs no spatial estimate.

### 2.4 Does practice or instruction help?

**Found.**
- The 2011 review reports **no study of practice, training or feedback** on TSP-type problems. One
  instruction effect: telling people to minimise length gave shorter tours than telling them to make
  a pleasing figure, though even "aesthetic" tours were near-minimal (Vickers et al. 2001) [SR, via
  MacGregor & Chu].
- With cost feedback and unlimited attempts on the same 28 TSP instances, people's tours improved from
  their first to their last attempt (Acuña & Parada 2010) [AB]: improvement within an item, with a
  number to chase, not learning across items.
- In "find the middle", children's lower precision is partly a matter of strategy ("learning what to
  do"), even with trial-by-trial feedback (Jones & Dekker 2017) [FT\*].
- The weighted average illusion survived training with feedback (Hong et al. 2021) [PT].
- The Varignon frame (strings through holes in a board, equal or weighted masses, the knot settling
  where the pulls balance) solves the Weber problem physically and is used to visualise it (Canbolat
  & Wesolowsky 2012 [AB]; the frame's mechanics [WP]).
- I found **no study that trained people to estimate the geometric median**, or that tested teaching
  the "pulls cancel" rule.

**Inference.** Feedback alone may leave the mean strategy in place (the related size bias resisted
feedback); what changes behaviour is a different rule ("what to do", Jones & Dekker). So the exercise
should teach the rule explicitly, show it at work in the feedback of every item, and keep the
feedback spatial (lines, contours, the best spot) rather than numeric only. Whether practice improves
geometric-median estimates, and by how much, is open: Parallax's data would be the first.

### 2.5 Strategies that work (what is known, and what follows from the mathematics)

No study compared strategies for this task, so every strategy below is **derived from the mathematics**
(§3.1) and is a **Proposal** for the strategy cards; the spike checks each numerically where it can.

1. **Equal pulls (the rule).** Every target pulls on your spot with the same strength, however far away
   it is; the best spot is where the pulls cancel. A far target pulls no harder than a near one.
2. **Directions vote, distances do not.** Take a step in some direction: it helps if more targets lie
   ahead of you than behind (counting a target fully when it is straight ahead, less when it is off to
   the side). Equivalently: draw a line through your spot; if one side holds clearly more targets,
   move towards that side.
3. **Slide the outlier.** Moving a target straight towards or away from the best spot does not move the
   best spot. So for a far target only its direction matters.
4. **Cross the pairs.** For two targets, every point on the segment between them has the same total
   distance to both (their separation), and every other point more. Pair targets across the middle and
   look where the pair segments cross. For four targets at the corners of a convex quadrilateral the
   best spot is exactly where the diagonals cross.
5. **Half or more in one place.** If one spot holds at least half of all the targets (or half the total
   weight), that spot is the best.
6. **Three targets.** The best spot sees each pair of targets at 120°; if the triangle has an angle of
   120° or more, it is that corner.
7. **A first guess by counting** (a shortcut, not the rule): the middle column of targets and the middle
   row give the best spot for city-block distance. On a tilted or diagonal layout it can be off, which
   the generator makes sure of (§4).

## 3. Item design (Q3)

### 3.1 The mathematics the design rests on

Sources: the Wikipedia articles "Geometric median" and "Varignon frame" [WP], which cite the primary
papers listed in References (Haldane 1948; Weiszfeld 1937; Kuhn 1973; Bajaj 1988; Lopuhaä & Rousseeuw
1991; Vardi & Zhang 2000; Plastria 2006). The derivations below are standard; every property used in a
teaching text was checked numerically in the spike (§4, stage E).

- **Task.** Targets t₁…t_k with weights w_i (1 unless weighted). Total distance S(p) = Σ w_i |p − t_i|. The
  geometric median (Fermat–Weber point) minimises S. S is convex, and strictly convex unless all targets
  are collinear, so the minimiser is unique for non-collinear targets (Vardi & Zhang 2000, via [WP]).
- **The rule ("the pulls cancel").** Away from the targets, the downhill direction of S is the sum of the
  unit vectors from p to the targets. So at an interior median the unit vectors sum to zero. The median
  lies on target j exactly when the other targets' unit vectors (times their weights) sum to a vector no
  longer than w_j. Spike: the largest residual over 3,932 random interior medians was about 1e-9.
- **Consequences used in teaching** (each checked in stage E):
  - *Slide the outlier:* moving a target along the ray from the median leaves its unit vector, and so the
    median, unchanged.
  - *Half or more in one place:* a target carrying at least half of the total weight is the median.
  - *Four targets* in convex position: the median is where the diagonals cross (Fagnano, via [WP]).
  - *Three targets:* the median sees each pair at 120° unless the triangle has an angle of 120° or more,
    in which case it is that corner (Haldane 1948, via [WP]).
  - *Collinear targets:* the ordinary median.
- **No formula.** In general the median cannot be written with arithmetic and roots (Bajaj 1988, via
  [WP]); it is found by iteration. Weiszfeld's algorithm is an inverse-distance-weighted average applied
  repeatedly; the Vardi–Zhang version converges from any start and handles a median at a target.
- **Why the average is the trap.** The average minimises the sum of *squared* distances, whose downhill
  direction is the sum of the vectors to the targets: each target pulls in proportion to its distance,
  like a spring. Under total distance each target pulls with the same strength, like a string over a
  pulley with equal weights (the Varignon frame). This is the one-sentence contrast for the guide.
- **Robustness, precisely.** The median's breakdown point is 0.5 against the mean's 0 (Lopuhaä &
  Rousseeuw 1991, via [WP]): far targets cannot drag it arbitrarily far. But it is not "outliers do not
  count": each target still counts fully by its direction.
- **The landscape is flat near the best spot (spike, stage A).** On a 7 × 7 board, the runner-up grid
  point is only about 1.6–2.7 % worse than the best one (median over random items with 4–9 targets).
  Relative bands of a few per cent therefore hold only one to five grid points.

### 3.2 Dims and a level ladder

(Proposal; the evidence is the spike in §4, and the numbers are filled in there.)

### 3.3 Scoring and partial credit

**Proposal.**
- **Counted right:** the pick's total distance is within **1 %** of the best total on the answer lattice
  (the band). On the proposed half-step lattice the band holds about 2–3 answer points on average (§4,
  stage C), always including the best one.
- **Partial credit:** 1 inside the band, falling linearly to 0 at four times the band (+4 %). In the spike
  a random tap earns about 0.04 on average, a player who taps the average about 0.1–0.5, and a model
  observer with a scatter of half a dot about 0.55 (§4, stage C). Credit feeds the feedback line and, if
  the game layer wants it, skill points; the rating uses right or wrong only, as for every exercise.
- **Shown to the player** after confirming: "Your spot: 3 % farther in total than the best spot", with
  the two totals and, if the player opens it, the average distance per target in dots (the format's
  own phrase "average distance" maps onto this).
- **Logged** (Reckon's `value`/`value2` pattern): value = the excess in per cent; value2 = the
  **correction ratio**, the share of the trap the player corrected: the projection of (pick − average)
  on (best − average), divided by |best − average|. 0 means the player tapped the average, 1 the best
  spot, above 1 an over-correction (dropping far targets). This one number tracks the concept change
  the exercise bets on (§6) and costs nothing to log.
- **Why relative excess, not rank or dot distance.** Rank depends on the lattice and on how stretched the
  landscape is; dot distance ignores that the landscape is flat along some directions and steep along
  others. Relative excess is scale-free. *Inference:* if human placement error grows with the size of
  the target set (as centroid error does, §2.1), relative excess treats large and small layouts alike.
- **Chance for the engine** (`chance(params)`): the mean share of answer points inside the band, about
  1.2–1.8 % at a 1 % band (§4). A guesser who taps near the middle does better than that, which is why
  the "neighbour of the average" guess is bounded too (§4).

### 3.4 Uniqueness margin

**Proposal.** A band, not a single point, is the right answer, so near-ties never decide an item:
- the band is one compact region (a level set of a convex function), it always holds the best point,
  and points that tie with the best within 1e-9 are all marked best in the feedback;
- **no target lies inside the band** (the best spot is always an empty point), which also removes the
  medoid and "nearest target" shortcuts;
- **no edge clearance rule**: a pick just outside the band still earns credit close to 1 (at +1.1 %
  it earns 0.97), so a hair's-breadth miss costs the item but not the feedback; adding a clearance rule
  would lower acceptance further (§4) for little gain;
- the feedback shows the continuous best spot too (a small cross), so a player whose pick sits between
  two good points sees why both were close.

The stricter alternative, "only the single best point counts" with a margin to the runner-up, was tested
on a 7 × 7 answer grid (§4, stage B) and rejected: the key then sits next to the average's pick in about
every item, so the task becomes "which neighbour of the average?".

### 3.5 Solver, validator and cross-check

**Proposal.**
- **Validator (independent of the generator):** recompute S at every answer point (13 × 13 = 169 points
  × up to 8 targets = 1,352 square roots), the band, the 11 shortcut picks from the targets alone, and
  the policy checks (no target in the band, no shortcut pick in the band, trap ≥ the level's minimum).
  Integer lattice coordinates and `Math.sqrt` keep it bit-identical across engines (the guide's rule:
  + − × ÷ and `Math.sqrt` are exact everywhere); no trigonometry is needed.
- **Cross-check:** Weiszfeld with the Vardi–Zhang step, plus the subgradient test for a median at a
  target, plus Newton refinement. Checks: the continuous median's total is never above the best lattice
  point's, and the best lattice point lies within half a dot of the continuous median (both held on
  every accepted item, §4 stage C).
- **Generation:** rejection from a mixture of layouts (uniform; one group plus spread targets; two
  groups). The guide's limit of 50 forked retries does not fit: acceptance is 0.5–9 % per candidate
  (§4), so the build needs smarter proposals (build the layout around a chosen key, pre-filter on the
  trap with the mean and a few Weiszfeld steps before the full solve), or a higher retry limit with a
  CPU budget check. This is the main build risk (§9).

## 4. Shortcut heuristics: the numeric spike (Q4)

## 5. Feedback, teaching and the phone layout (Q5)

All of this section is **Proposal**, built on §2 (findings) and §3.1 (mathematics).

### 5.1 Reveal (after Confirm, ready within the guide's 700 ms)
1. **The best spot** (a ring with the word "best"; a small cross at the continuous best spot when it lies
   between answer points) and **your spot** (a filled marker with "you").
2. **Lines from your spot to every target**, each labelled with its length in dots to one decimal, and
   the line "Your total 31.6 · best 31.2 (+1.3 %)".
3. **The average position** (a hollow diamond, labelled "average") with a dashed line to the best spot:
   "The average is dragged towards far targets."
4. **Quality map (on request, "Map")**: contour lines of equal total distance at +1 % (the band, drawn
   bold), +2 %, +5 % and +10 %, each labelled, over a pale fill. Contours rather than a colour scale:
   they read in light and dark themes, they do not rely on colour (rule 8), and they show the oval
   shape and its flat direction, which explains near misses. *Inference:* a filled heat map alone would
   tell the player "warmer/colder" without showing the shape.

### 5.2 "Why?" (show me, through `ctx.play`, 2–4 s per movement)
1. From **your spot**, draw one arrow of equal length towards every target; then lay the arrows head to
   tail. They do not close: the leftover arrow points downhill, towards the best spot. (This is the
   gradient of S, so it always points the right way; checked by construction.)
2. Slide the marker along the leftover arrow to the best spot; redraw the arrows: laid head to tail, they
   now close into a loop: "The pulls cancel."
3. Grab the farthest target and slide it outwards along its line: the best spot does not move, while the
   average runs after it (stage E: the median moved less than 1e-4 when every target slid by 0.3–3 times).
   Caption: "A far target pulls no harder than a near one. The average gives it extra pull."
Reduced motion: keyframes about 400 ms apart, as the guide requires.

### 5.3 Strategy cards (two, as in the other exercises)
- **Balance the pulls** (imagery): "Picture a string from your spot to every target, each with the same
  weight hanging on it. The knot settles where the pulls cancel. A far target's string pulls no harder."
  Source in a comment: the Varignon frame (§2.4).
- **Count the sides** (analytic): "Lay a line through your spot. If clearly more targets lie on one
  side, move that way. Turn the line and check again. For four targets around a gap, use the crossing
  of the two diagonals." Source: the subgradient rule (§3.1); stage E checks.
- Both cards say what *not* to do in one line: "Not the average: the average leans towards far targets."
- No strategy research exists for this task (§2.5), so the cards' wording should be play-tested
  (fresh-player tests, milestone 11).

### 5.4 Play-to-learn tutorial: playing correctly within two minutes
| Step | Time | Item | What it teaches |
|---|---|---|---|
| Watch | ~30 s | 3 targets: two close together, one far off. The average appears, dragged towards the far one; three equal arrows appear; the spot slides to where they balance, next to the pair | far targets pull no harder; the pulls cancel at the best spot |
| Try 1 | ~20 s | 4 targets round a gap (a kite); band 2 % | cross the diagonals: a first success |
| Try 2 | ~30 s | 5 targets: a group of four and one far target; trap 1 dot | the average is the trap; the reveal shows the dragged average |
| Try 3 | ~30 s | a rated-style item, 5 targets, band 2 %, with one retry after the "Why?" | the full loop: pick, nudge, confirm, read the reveal |
| Go | | first rated items | |

Tutorial items are fixed seeds checked by the node test, as for every exercise. Watch and Try never use
an item from the rated pools.

### 5.5 Phone layout and input
- **How many points fit at 44 px.** A 360 px phone with 16 px margins leaves 328 px: 7 points per row
  (7 × 44 = 308). 390 px phones fit 8, 412 px fit 8 (9 needs 428 px with these margins). A landscape
  phone's board height, about 330–360 px after the header, also fits 7. So a lattice of **7 × 7 is the
  largest that fits every phone with a 44 px cell per point** (my calculation).
- **But a 7 × 7 answer grid fails as a task** (§4, stage B): after the shortcuts are excluded, the key
  sits next to the average's pick and "one step from the average towards the group" scores 41–80 %.
- **Proposal: targets on the 7 × 7 dot lattice, answers on the 13 × 13 half-step lattice**, entered as in
  Reckon (`js/ex/reckon/view.js`: drag plus large step buttons plus keys, then Confirm):
  1. tap anywhere on the board: the marker jumps to the nearest answer point (the whole board is the touch
     target; the board's dots are not separate buttons);
  2. adjust by dragging (the marker sits about 40 px above the finger, with a small magnifier, so the
     finger never hides it) or with four nudge buttons of at least 44 px (half a dot per press), or the
     arrow keys;
  3. Confirm (at least 44 px; Enter). No total is shown before Confirm (§2.3: a live readout turns the
     task into search).
  Every control is ≥ 44 px and dragging has a button alternative (WCAG 2.5.7's single-pointer rule).
  Larger screens show the same 7 × 7 board bigger, so ratings stay comparable across devices (no
  per-display rating, unlike Track and Homing).
- **Drawing:** dots 6–8 px; targets 18 px rings with a dot in the centre (shape, not colour, marks a
  target); the answer marker a filled ring with a cross-hair; half-step points drawn faintly only near
  the marker, so the board does not look like a 13 × 13 grid.
- **Tap-then-confirm versus drag:** tap-then-confirm is the base (one tap, one confirm, about 2 s for a
  confident player); drag and nudges are for adjustment. The app-wide "confirm taps" setting (O22) does
  not apply, because Confirm is always required here.

## 6. The transfer bet (Q6)

**The mechanism (Proposal for `def.bet`).** Central Point bets on **replacing an intuitive estimate with
a principled one through an explicit rule and spatial error feedback**: people's default "middle" is the
mean (§2.1–2.2); the exercise teaches a different balance rule (equal pulls), shows on every item where
the default went wrong (the dragged average, the leftover pull), and lets the player practise the new
estimate until it is fluent. In T1's vocabulary (docs/research/v1.2/T1-transfer-portfolio.md, in
progress) this is closest to "error-minimisation feedback" plus "explicit strategy"; if T1's fixed list
has no slot for it, I suggest a new value, `estimation`, defined as "judging a quantity or place by eye
with graded feedback, so the estimate becomes calibrated". The plan's "spatial estimation and
optimisation" is the same idea.

**Real-world bridges (for the `bridge` text; each with its limitation line, standing rule 2):**
- choosing where several people should meet, when each comes from a different place;
- placing something shared (a bin, a meeting table, a stall) so that the total walking is least;
- Weber's classic problem, placing a depot or a plant among customers (§2.4; the Varignon frame);
- reading a map or chart for "the central place": GIS tools offer the mean centre, the median centre
  and the central feature as different answers to that question (§1).
- Limitation line: "Real choices use roads and travel times, and often care about the person who travels
  farthest; we do not know whether practice here changes them."

**What is new or under-tested.**
- *Found:* the 2011 review of human optimisation found no human data on facility location (§2.3), and I
  found no training study on estimating central points of any kind (§2.4).
- *Inference:* so every part of the bet is untested: whether practice improves unaided estimates,
  whether the rule transfers to new layouts (more targets, weights, other boards), and whether it
  transfers to related problems: the three-point 120° rule inside Steiner trees, city-block meeting
  points, and reading the centre of scatterplots and maps.
- *A possible cost to test as well:* training "do not take the average" might shift people's estimates
  of the *mean* (ensemble perception, §2.1) towards the median. That would matter for reading charts,
  where the mean is often what is wanted. A near probe for this costs little (§6, last bullet).
- *Proposal for measuring the bet:* (a) log the correction ratio (§3.3) on every item: its trend is the
  concept change; (b) a near probe in another format: four marked candidate spots on a map-like plate,
  "which one is closest to everyone in total?" (multiple choice, no feedback, untrained); (c) a control
  probe: "where is the average position?" on the same kind of layout, to catch any interference with
  mean estimation. Probes follow the measurement rules (rule 10: never trained, no feedback).

## 7. Overlap table entry and the "Taking a test soon?" helper

In the format of docs/research/v1.1/R4-test-overlap.md §3 (distances as defined there):

| Test item type | Parallax task | Distance | Shared format features | Notes |
|---|---|---|---|---|
| "Central Point" subtest of an unnamed test (as described to the owner): a grid of points, some marked as targets; pick the grid point with the smallest total or average distance to the targets; partial credit for close picks | **Central Point (EX-20)** | **near** (if the format is as described) | a regular lattice of points; marked targets; the minimum-total-distance rule; credit by closeness | the test's grid size, number of targets, timing and scoring are unknown (§1). Parallax's answers lie on half-steps between dots, its items avoid the points the cheap shortcuts pick, and its feedback teaches the pulls rule, so a Parallax player has practised the rule and the format, not the test's items |
| Map or site-selection items in geography or spatial-thinking tests (choose the best place for a facility from several criteria) | Central Point | far | choosing a place relative to several others | different: several criteria and map overlay; I could not open the main such test (STAT, under "Could not open") |
| Any other spatial subtest in R4's table | none | – | – | no other Parallax task asks for a minimum-distance place |

**Proposal for the helper and About:**
- Add Central Point to the "Taking a test soon?" helper's list of exercises that share a test's format,
  with the line: "If your test asks you to pick the point closest overall to a set of marked points,
  Central Point practises that format. Take the test before you practise it, or pause Central Point in
  Train." Name the test only if the owner learns its name (as the plan says).
- Standing rule 3 (no clones of standard IQ subtests) is met as far as can be checked: the subtest is not
  one of the named standard batteries (Wechsler, Stanford-Binet, the RIOT list) and Parallax copies no
  item or screen (none was seen). If the owner identifies the test as part of a standard battery, rule 3
  must be re-checked.

## 8. Design proposal for the plan (summary of section 3 to 7 proposals)

## 9. Open risks

## References

Reading level after each entry (§0). "Via X" means I know the source only from X.

### Research
- Acuña, D. E., & Parada, V. (2010). People efficiently explore the solution space of the computationally
  intractable traveling salesman problem to find near-optimal tours. *PLoS ONE, 5*(7), e11685.
  https://doi.org/10.1371/journal.pone.0011685 [AB, RePEc record]
- Allahbakhsh, M., Arbabi, S., Galavii, M., Daniel, F., & Benatallah, B. (undated manuscript, about 2018).
  Crowdsourcing planar facility location allocation problems.
  https://re.public.polimi.it/bitstream/11311/1071767/1/AllahbakhshComp2019.pdf [FT\*]
- Alvarez, G. A., & Oliva, A. (2008). The representation of simple ensemble visual features outside the
  focus of attention. *Psychological Science, 19*(4). https://doi.org/10.1111/j.1467-9280.2008.02098.x [AB]
- Burns, N. R., Lee, M. D., & Vickers, D. (2006). Are individual differences in performance on perceptual
  and cognitive optimization problems determined by general intelligence? *Journal of Problem Solving,
  1*(1), 3. https://doi.org/10.7771/1932-6246.1003 [AB]
- Canbolat, M. S., & Wesolowsky, G. O. (2012). On the use of the Varignon frame for single facility Weber
  problems in the presence of convex barriers. *European Journal of Operational Research, 217*(2),
  241–247. https://doi.org/10.1016/j.ejor.2011.09.006 [AB, RePEc record]
- Correll, M., & Heer, J. (2017). Regression by eye: Estimating trends in bivariate visualizations. *CHI
  2017*. https://doi.org/10.1145/3025453.3025922 [SR, the authors' lab blog:
  https://medium.com/@uwdata/regression-by-eye-b7587f4ca1f5]
- de Gardelle, V., & Summerfield, C. (2011). Robust averaging during perceptual judgment. *PNAS*.
  https://doi.org/10.1073/pnas.1104517108 [AB, the Oxford department's record; volume and pages not checked]
- Drew, S. A., Chubb, C. F., & Sperling, G. (2010). Precise attention filters for Weber contrast derived
  from centroid estimations. *Journal of Vision, 10*(10):20. https://doi.org/10.1167/10.10.20; open copy
  https://sites.socsci.uci.edu/~whipl/staff/sperling/PDFs/Drew_Chubb_Sperling_JOV_2010.pdf [FT\*]
- Dry, M. J., Lee, M. D., Navarro, D. J., & Preiss, K. (2009). The perceptual organization of point
  constellations. *Proceedings of the Cognitive Science Society, 31*.
  https://escholarship.org/content/qt2r20m21s/qt2r20m21s.pdf [FT\*]
- Hong, M.-H., Witt, J. K., & Szafir, D. A. (2021). The weighted average illusion: Biases in perceived mean
  position in scatterplots. arXiv:2108.03766 (IEEE VIS 2021). https://arxiv.org/abs/2108.03766 [PT]
- Jones, P. R., & Dekker, T. M. (2017). The development of perceptual averaging: learning what to do, not
  just how to do it. *Developmental Science*, e12584. https://doi.org/10.1111/desc.12584; open copy
  https://discovery.ucl.ac.uk/id/eprint/1572461/1/Jones_Development_perceptual_averaging_VoR.pdf [FT\*]
- Juni, M. Z., Singh, M., & Maloney, L. T. (2010). Robust visual estimation as source separation. *Journal
  of Vision, 10*(14):2. https://doi.org/10.1167/10.14.2; https://pmc.ncbi.nlm.nih.gov/articles/PMC4454090
  [FT\*, the first 100,000 of about 110,000 characters: all but the end of the reference list]
- MacGregor, J. N., & Chu, Y. (2011). Human performance on the traveling salesman and related problems: A
  review. *Journal of Problem Solving, 3*(2), 2. https://doi.org/10.7771/1932-6246.1090; open copy
  https://docs.lib.purdue.edu/jps/vol3/iss2/2 [FT\*]
- MacGregor, J. N., Chronicle, E. P., & Ormerod, T. C. (2006). A comparison of heuristic and human
  performance on open versions of the traveling salesperson problem. *Journal of Problem Solving, 1*(1),
  5. https://doi.org/10.7771/1932-6246.1005 [AB] (the convex-hull heuristic fitted human open paths best)
- Reported through MacGregor & Chu 2011 [SR]: MacGregor & Ormerod 1996; MacGregor et al. 1999; Graham,
  Joshi & Pizlo 2000; Vickers et al. 2001, 2003, 2004; Dry et al. 2006; Pizlo et al. 2006; van Rooij et al.
  2006; Kong & Schunn 2007.
- Reported through Juni et al. 2010 [SR]: McGowan, Kowler, Sharma & Chubb 1998 (saccades to dot clusters).
- Reported through Jones & Dekker 2017 [SR]: Morgan & Glennerster 1991 (see "Could not open").

### Mathematics and tools
- Wikipedia, "Geometric median" (read 2026-11-18). https://en.wikipedia.org/wiki/Geometric_median [WP];
  through it [SR]: Haldane, J. B. S. (1948), *Biometrika 35*, 414–417; Weiszfeld, E. (1937), *Tohoku
  Mathematical Journal 43*, 355–386; Kuhn, H. W. (1973), *Mathematical Programming 4*, 98–107; Bajaj, C.
  (1988), *Discrete & Computational Geometry 3*, 177–191; Lopuhaä, H. P., & Rousseeuw, P. J. (1991),
  *Annals of Statistics 19*, 229–248; Vardi, Y., & Zhang, C.-H. (2000), *PNAS 97*(4), 1423–1426;
  Plastria, F. (2006), *IMA Journal of Management Mathematics 17*(4), 387–396.
- Wikipedia, "Varignon frame" (read 2026-11-18). https://en.wikipedia.org/wiki/Varignon_frame [WP]
- Esri, ArcGIS Pro help, "Central Feature".
  https://doc.esri.com/en/arcgis-pro/latest/tool-reference/spatial-statistics/central-feature.html [WP]
- GRASS GIS add-on manual, `v.centerpoint`. https://grass.osgeo.org/grass84/manuals/addons/v.centerpoint.html [WP]
- R package aspace, `calc_cmd` (centre of minimum distance). https://rdrr.io/cran/aspace/man/calc_cmd.html [WP]

### Tests and community pages (Q1)
- Riot IQ, "The 15 subtests of the RIOT" (names only).
  https://www.riotiq.com/articles/riot-specific-information/the-15-subtests-of-riot [WP]
- TOGA ("Test of General Ability"), a public r/cognitiveTesting post of April 2025, read through a mirror
  of https://www.reddit.com/r/cognitiveTesting/comments/1k5m191/ [WP]
- docs/research/v1.1/R4-test-overlap.md §1.4 for CORE and CAIT [SR there].

## Could not open

| Source | What I needed | Assumption used meanwhile |
|---|---|---|
| cognitivemetrics.com (the site, its newest "spatial exam"); the proxy refused it, for this run and for R4 | whether the format comes from one of its tests, and that test's grid, timing, scoring and norms | the test is unidentified (§1); the overlap row describes the format only (§7) |
| Morgan, M. J., & Glennerster, A. (1991). Efficiency of locating centres of dot-clusters by human observers. *Vision Research, 31*(12), 2075–2083 (DOI from memory, not checked: 10.1016/0042-6989(91)90165-2) | how many dots observers effectively use when locating a centre, and their thresholds | adults use the arithmetic mean (as Jones & Dekker report it); centroid noise about 27–29 % of the cloud's SD (Drew et al. 2010) |
| Vickers, D., Mayo, T., Heitmann, M., Lee, M. D., & Hughes, P. (2004). Intelligence and individual differences in performance on three types of visually presented optimisation problems. *Personality and Individual Differences, 36*(5), 1059–1071 | the Steiner-tree task's format and error distribution, to compare with placing a balancing point | "12 % above benchmark on 15-node Steiner problems" as MacGregor & Chu report it |
| Whitney, D., & Yamanashi Leib, A. (2018). Ensemble perception. *Annual Review of Psychology, 69*, 105–129 | a review of ensemble coding of position and of practice effects on ensemble judgements | §2.1 rests on the primary studies I could read |
| Szafir, D. A., Haroz, S., Gleicher, M., & Franconeri, S. (2016). Four types of ensemble coding in data visualizations. *Journal of Vision, 16*(5):11 | evidence for the chart-reading bridge and the mean-interference risk (§6) | the risk is stated as a hypothesis to test, not a finding |
| Lee, J., & Bednarz, R. (2012). Components of spatial thinking: Evidence from a spatial thinking ability test. *Journal of Geography, 111*(1), 15–26 | whether its site-selection items are a usable far probe and a far-overlap row | the far row in §7 says "could not open" and claims nothing about the items |
| Esri help, "Median Center" (the web-search budget ran out before I found its page) | confirmation that it minimises total Euclidean distance | GRASS `v.centerpoint`'s "median" is the geometric median [WP]; the bridge text names the concept, not a product |
