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

### 3.2 Dims and a level ladder

### 3.3 Scoring and partial credit

### 3.4 Uniqueness margin

### 3.5 Solver, validator and cross-check

## 4. Shortcut heuristics: the numeric spike (Q4)

## 5. Feedback, teaching and the phone layout (Q5)

## 6. The transfer bet (Q6)

## 7. Overlap table entry and the "Taking a test soon?" helper

## 8. Design proposal for the plan (summary of section 3 to 7 proposals)

## 9. Open risks

## References

## Could not open
