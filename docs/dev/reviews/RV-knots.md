# RV-knots: independent review of Knots (EX-13)

Reviewer: an agent that did not build Knots. Date: 2026-11-13. Branch `build`; files reviewed as they stood at 17:00–18:30 UTC:
js/ex/knots/gen.js, learn.js, view.js, css/ex/knots.css, tests/node/knots.test.mjs. I also read js/ui/play.js (the trial path), docs/research/v1.1/R2-knots.md, docs/dev/PLAN.md (M4) and docs/dev/progress/B4.md. I edited no app file.

## Verdict in brief

- **Every answer key is right.** I re-derived 8,100 items from their geometry alone with my own code (crossings, Alexander polynomial by Fox calculus, Kauffman bracket, linking number and my own move simplifier) and found 0 disagreements.
  - Untie/tie: exactly one of the four tags is decisive in every item (22,800 switched ropes classified).
  - All 10,533 move certificates of the builder replay under my own move checks.
- **The drawn picture matches the flags:** 69,780 crossings were checked through an emulation of the view's paint order.
- **Legibility rules hold:** every crossing is a right angle, crossings ≥ 37 px apart, tags ≥ 48 px apart, third strands ≥ 26 px from a crossing.
- **Generation timing is sound:** generation never runs during a stimulus or between the painted frame and the answer clock.
- **Show me can be wrong** (should fix, top priority). In 21 of 4,800 items a show-me step passes a strand through another, which changes the knot or link. In 2 of them the final picture contradicts the key under a caption that says the opposite.
- **Three texts are false or misleading** (should fix):
  - the `knotCore` caption;
  - the "twist knot" tip;
  - the slide-over caption, which says "over" when the strand moves under.
- **Untie has cheap tells near the bound** (should fix, borderline): "shortest over-strand" and "nearest the centre" sit at 31–35 % against a bound of 35 %.

## Findings, ranked

### F1 — should fix (highest; before release). Show me sometimes shows an impossible move and can end against the key

- **Where:**
  - js/ex/knots/gen.js:1745–1750 (`replay`): an edited frame is accepted when `pa.D.live === want`, i.e. on the crossing count alone, not on the diagram.
  - tests/node/knots.test.mjs:409–413 checks only the end state, of knot items only, on about 300 items per variant.
  - docs/dev/progress/B4.md:20 says "never wrong".
- **What:** I fed every frame of the replay, as `drawPolys` draws it, into my own Jones polynomial (and linking number for links). In 21 of 4,800 items (0.44 %) a step changes the knot or link type: pull 5/1,200, untie 4/1,200, tie 4/1,200, link 8/1,200. By move: 13 R2 edits, 4 R3 and 4 R1.
- **Consequences seen:**
  - **pull 1554714460** `{rope 7, spacing 2}`: the key is "knot" (a trefoil). Step 5 (R3) turns it into an unknot (det 3 → 1, V → 1), and later steps untie it to 0 crossings. The view then plays `knotCore`, "No move takes these crossings out: a knot remains.", over an empty rope.
  - **tie 787336968** `{rope 8, spacing 1}`: the key switch's knot ends at 0 crossings, captioned "Switched at …, a knot holds."
  - **pull 772978548, 19962718, 1539776704 and untie 3765811773, 385760045, 914765244, 2466719869:** an unknot becomes a figure-eight, trefoil or other knot mid-way. The replay stops with a knotted core under the `broken` caption "…the rope ends with no knot / falls open".
  - **pull 139132780** `{rope 8, spacing 1}`: step 4 (R2) changes the knot (V span 6 → a 4-crossing core). The show-me ends on that reduced alternating core with the `knot` caption, but the core is not the item's knot.
  - **The other affected seeds:**
    - tie 2296094243, 678699662, 3753012210;
    - link 2655697921, 989641106, 3579283639, 3104843496, 862956765, 1326849982, 1888751992, 250067272.
- **How confirmed:**
  - scratch `showme-scan.mjs` / `showme-scan2.mjs` (the builder's `lib.replay` and `lib.polyCrossings`, then my Jones on each frame). Output: `pull badItems 5, untie 4, tie 4, link 8; END WRONG pull 1554714460, tie 787336968`.
  - `verify-bad-steps.mjs` re-derives the flagged frames' crossings and over/under from the raw polylines and heights with my own segment intersection, and finds the same changes at the same steps. Example: `pull 1554714460 … step 5 R3: 6→6 crossings, V 1A^4 1A^12 -1A^16 → 1A^0; end 0 crossings`.
  - The six Watch demos (learn.js `demo`) and the minimal-pair replay are clean (`demo-check.mjs`), and no affected seed sits at the Try levels I sampled.
- **Fix:**
  - In `replay`, accept a candidate route only if the edited frame is the validator's move result. Either compare `polyCrossings(after).D` with `removeX`/`applyR3` applied to the current D (PD isomorphism), or at least require equal Jones polynomials (and linking number for links); ≤ 12 crossings costs about 1 ms. Otherwise try the next route or mark the step broken.
  - Extend the node test to check every step of every item, not only end states on a sample.

### F2 — should fix. The `knotCore` caption claims something false in almost every case where it is shown

- **Where:** learn.js:97 `knotCore: 'No move takes these crossings out: a knot remains.'`, chosen at view.js:336 whenever the show-me end is not reduced alternating.
- **What:** of 580 pull knot items, 280 end with `knotCore`. In 277 of these the end core still has more crossings than the knot's crossing number (here = the span of the Jones polynomial; these are alternating knots, 3_1, 4_1, 5_2, 6_x, …). Examples: 94 trefoils end on 4 crossings, 26 on 5; 47 figure-eights end on 5.
  - So moves that take crossings out do exist; the replay's bounded search simply stopped.
  - (The `knot` caption, shown for reduced alternating ends, is right: 299 of 300 such ends have core size = span. The one exception, pull 139132780, is an F1 item whose show-me changed the knot.)
- **How confirmed:** scratch `text-checks.mjs` (a). Output: `'knotCore' caption: 280, of which the core still has more crossings than the Jones span: 277`.
- **Fix:** say only what is true, e.g. "These crossings still hold a knot: the rope cannot fall open." The rope is a proven knot.

### F3 — should fix. The untie tip teaches a false rule for the commonest knots

- **Where:** learn.js:46: "A twist knot comes undone at its clasp, not at its twists." It also appears in R2 §7.5, while R2 §3.2 marks the underlying result "[unverified here]".
- **What:** for twist knots, switching a twist crossing removes two half-twists. The trefoil (one half-twist) and the figure-eight (two half-twists) therefore come undone at a twist crossing as well. Switching each crossing:
  - the figure-eight's crossings give Δ = [1] [1] [1] [1];
  - the trefoil's give [1] [1] [1];
  - 5_2's give [1 −1 1] [1] [1 −1 1] [1 −1 1] [1], so for 5_2 the tip is right.
- **Why it matters:** untie bases are trefoils in 52.0 % of items and figure-eights in 5.1 % (5_2: 28.1 %). At rope rung 0, the Try level, 43.9 % are trefoils.
- **How confirmed:** scratch `twist.mjs` (signed Gauss codes taken from the PD codes in knots.test.mjs, my Alexander polynomial) and `classify.mjs` (base knot types).
- **Fix:** "In a twist knot with three or more twists (like 5_2), switching the clasp unties it and switching a twist does not. In a trefoil or figure-eight, any crossing of the knot itself unties it." Or drop the tip.

### F4 — should fix. Slide-over steps are captioned "over" when the strand moves under

- **Where:** view.js:297–300 (`moveCaption`: R3 → `cap('over')`, "Slide this strand over the crossing."). gen.js:1668–1673 (`editR3` also moves a strand that is under at both of its crossings, with z below everything).
- **What:** in 2,400 replays (every second item of each pool), 355 of 745 R3 steps move the strand underneath.
- **How confirmed:** scratch `r3under.mjs`. Output: `R3 steps 745, of which the moved strand runs underneath …: 355`.
- **Fix:** do what R2 already does with `slide`/`slideUnder`: when the edit path's z < 0, use a new caption such as "Slide this strand under the crossing."

### F5 — should fix (borderline). Two cheap untie tells sit at chance + 10 with no margin and are not tested

- **Where:**
  - gen.js:1166 and 1198–1233 (`tagOptions`): the key's rank by distance from the centre is only a soft preference among the first 30 options, and the over-strand length is not balanced at all;
  - tests/node/knots.test.mjs:339–361: no over-strand feature, pooled only.
- **What:** chance is 25 %, the bound 35 %. Results:

  | Pool | "shortest over-strand" (the Wirtinger arc that passes over the tag) | "nearest the plate centre" | conditional-logit model on 14 cheap per-option features (5-fold CV) |
  |---|---|---|---|
  | 3,600 untie items, pooled | 33.1 % [95 % 31.6–34.7] | 31.4 % [29.9–32.9] | 34.6 % [33.0–36.1] |
  | rope rung 0, 1,260 items | 34.9 % [32.3–37.6] | 33.6 % [31.0–36.2] | 36.7 % [34.0–39.3] |

  - These are inside the rule for every single heuristic I tried, but with no margin: the rung-0 confidence intervals cross 35 %.
  - Tie is clean: worst 29.8 %, model 31.9 %.
- **How confirmed:** scratch `shortcuts.mjs` and `untie-borderline.mjs` on `out-untie.json` + `out-untie2.json` (3,600 items) and `out-untie-r0all.json` (1,260 rung-0 items).
- **Fix:**
  - Balance the key's rank on over-strand length the way `rd` balances centre distance, and make both balances hard (uniform over ranks), not just a sort preference.
  - Add both features, per rung, to the shortcut tests.

### Nice to have

- **N1. Captions.** The `broken` caption (learn.js:98, view.js:334 and 354) reads "…the rope ends falls open." for untie (4 % of untie show-me's; ungrammatical). For links it reads "…the rope ends apart." (19 % of apart links), but a link has loops, not a rope.
- **N2. The strategy line needs "reduced".** learn.js:73 says "If what is left goes over, under, over all the way round, it is a knot." The theorem needs a reduced diagram (no nugatory crossing).
  - In practice the claim held: my curls, slide-offs and slide-overs left 3,997 alternating remainders in 13,200 diagrams, all knots (`text-checks.mjs` (b)).
  - Suggest "…and nothing more comes off…". The view's `knot` caption already checks reducedness (view.js:314–320).
- **N3. The `descend` tip never applies to a pull item.** It is true (learn.js:42), but 0 of 1,200 pull items descend from an end. Tie distractors do: 45 of 1,200 items.
- **N4. The seam numbering of closed loops is undocumented and depends on the sampler.**
  - How the builder numbers: a closed curve's crossings are numbered from the first sample at u = 1/16 of segment 0 (gen.js:520, 594). A crossing at the loop's start point (T ∈ [0, 1/16)) is therefore numbered last, not first.
  - How often: this happens in 354 of 1,200 link items (29.5 %; loop A's start is a random ring cell, gen.js:1295). Examples: 3539363287, 3134040709, 2719457981 (rope 0, spacing 0).
  - Why it matters: it is self-consistent (validator and view share `crossingsOf`). But the documented rule (gen.js:13–15, 601–602: "numbered by their first passage") does not settle it, and a change of `SUB` would silently re-map these items' flags. My first link run used the natural T ∈ [0, m) and mis-read 354 items, and I had to adopt the builder's seam.
  - Fix: document the seam in the item comment, or number crossings on T in [0, m); pin a few link seeds' crossing order in a test.
- **N5. Tags.**
  - 1,060 of 9,600 tags (11 %) are about as near (within 10 %) to a neighbouring crossing as to their own (e.g. 34.0 vs 33.9 px); 1 is clearly nearer. Only the 1.5 px dotted leader (knots.css:41) tells them apart.
  - Hit discs (r 21, view.js:130) of two tags overlap in 21 pairs (min 34.8 px apart).
  - 9 tag discs cover the rope's edge.
  - knots.css:38 says "a 44 px invisible disc", but the disc is 42 plate units across.
  - Suggest: penalise spots near other crossings in `tagSpots` (view.js:104–124) and use a solid leader.
  - Source: scratch `tags.mjs` (a verbatim copy of `tagSpots`).
- **N6. Legibility departures from R2 §5.2 / §7.2 are not recorded in B4.**
  - Rope stroke 4.5 px (knots.css:23) against 7–9 px.
  - Tightest bend 7.97 px measured exactly (gen.js:500 checks 8 px at 8 samples per interval) against ≥ 10 px.
  - Open-spacing strand gap 33.2 px measured (gen.js:748 asks 30) against ≥ 36 px.
  - These look fine for this design; record them in DECISIONS.
- **N7. Generation time against PLAN M4's acceptance line.** PLAN.md:64 asks for generation "inside the frame budget (pre-generated in idle time when needed)".
  - Untie generation CPU in my runs: p50 6.8 ms, p95 35.2 ms, max 197 ms. Pull, tie and link have p95 ≈ 16–18 ms and max 61–169 ms.
  - There is no idle pre-generation (play.js:1519 generates synchronously after Next).
  - The node timing test (knots.test.mjs:259–281) measures only the hardest params (link r9 s2), not the slowest (untie, low rungs).
  - No validity impact (see Q6); possible jank after Next on slow phones.
  - Fix: test the slowest params, or pre-generate during the feedback phase.
- **N8. Bridge wording.** learn.js:110 says "learn to tie knots a little faster". R2 §1.3 supports "more knots tied" (Brandt & Davies) and "fewer errors" (Garland: not time). "A little more easily" fits both.
- **N9. Try item.** PLAN.md:62 and R2 §7.5 ask for untie on a 5_2 with clasp and twist tags. learn.js:39 uses a random rung-0 untie item, a trefoil 44 % of the time. This departure is not listed in B4.
- **Unconfirmed U1. Plate size on a landscape phone.** From css/play.css (`--pl-avail`, `--pl-col`) the plate on an 844 × 390 phone is about 297–318 CSS px with safe areas, slightly under R2's 320 px floor. I computed this from the CSS only; no browser was launched.

## Checked and found fine (sample sizes)

### Q1. Answers re-derived from geometry alone

- **What my classifier read:** only the control points and `over` flags. The splines are exact cubic segments in the power basis.
- **How it finds crossings:** a dense polyline (32 per segment), then Newton on the exact cubics.
  - It re-ran at 64 per segment: the counts were identical in all items, with no Newton failures.
  - Positions agree with the builder's within 0.0022 px. This needed the seam convention of N4 for link loops.
- **Signs and rotation:** from the measured tangents. The measured ccw rotation equals the sign in every crossing.
- **Invariants:**
  - the Alexander polynomial: my own Wirtinger/Fox matrix, an exact BigInt determinant, Δ(1) = ±1 and symmetric in every diagram;
  - the Kauffman bracket from scratch (Jones);
  - the linking number from my own signs.
- **Unknot proofs:** Jones = 1 at ≤ 24 crossings (Tuzun & Sikora), and also my own planar-map simplifier. Its R1 is a self-edge; its R2 is two edges between two crossings, one strand over at both and opposite signs. Its R3 is a triangle face with a strand over at both of its crossings. An Euler check runs after each move.
- Self-tests passed (`selftest.mjs`): 3_1, 4_1, 5_2, 6_1, 7_4, Hopf, split circles; Jones invariant under 106 R3 moves and the simplifier.

| Pool | Items | Disagreements | Knot / link proofs | No-knot / apart proofs |
|---|---|---|---|---|
| pull | 1,200 | 0 | 580 knots, all Δ ≠ 1 (60 % trefoils, 24 % figure-eights) | 620 unknots: Jones = 1 and my simplifier empties every one; 620/620 builder certificates replay |
| untie | 4,500 (1,200 + 2,400 + 900 at rung 0) | 0 | every base a knot (Δ ≠ 1); the three wrong switches stay knots (Δ ≠ 1) | the key switch: Jones = 1 and emptied by my simplifier in all 4,500; 4,500 certificates replay |
| tie | 1,200 | 0 | the key switch is a knot (Δ ≠ 1) | base and the three wrong switches: Jones = 1 and emptied (4,800); 4,800 certificates replay |
| link | 1,200 | 0 | 587 linked: 386 by lk = ±2, 201 by a Jones polynomial unlike the unlink's (the Whitehead pair) with both loops unknotted | 613 apart: split by my simplifier in every one; 613 certificates replay |

- **Closure of the open rope** (pull/untie/tie, 7,200 ropes):
  - the rope is inside the plate on exactly one run, and both curve ends are off the plate;
  - no crossing is within 52 px of the edge, and the rope never dips to the edge between its ends.
  - So both ends lie on the outer face, and the builder's closure (last passage joined to first through the outside arc, gen.js:110–131) is the unique closure on the sphere: the knot left when both ends are pulled apart. My classifier closes it the same way, from that geometric check.
- **Balance and fallbacks:** the yes/no balance and keys spread are in Q4. Fallbacks: 2 of 4,500 untie items (0.04 %), 0 elsewhere; play.js voids fallback items.

### Q2. Exactly one decisive tag

- In all 5,700 untie/tie items I switched each tag myself and classified all four results: exactly one changes the rope, and it is the key, every time.
- No tag is nugatory: 0 of 19,200 tags, while the ropes hold 5,324 nugatory crossings elsewhere (`nugatory.mjs`).

### Q3. The picture

**Over/under as drawn.** I emulated view.js `drawItem`'s paint order: whole ropes first, then per crossing a 14 px casing and the top strand, both drawn from the view's own samples, from seg − 4 to seg + 5. Across 69,780 crossings:

- the crossing centre is topped by the flagged over strand in every case;
- the under strand shows a gap on both sides in every case;
- the over strand is never cut within 9 px;
- no casing cuts a third strand.

**Legibility, measured on the exact curves, all pools:**

| Rule | Measured |
|---|---|
| crossing angle | every crossing 90.0° (lattice) |
| crossing to crossing | ≥ 37.0 px |
| tag to tag | ≥ 48.0 px |
| third strand to crossing | ≥ 26.2 px (rule 16) |
| non-adjacent strand gap, open | ≥ 33.2 px (level asks 30) |
| non-adjacent strand gap, close | ≥ 26.1 px (asks 24) |
| non-adjacent strand gap, tight | ≥ 24.0 px (asks 20) |
| tightest bend | 7.97 px (see N6) |

There are no near-tangencies: every pair of strands within 40 px away from crossings is accounted for by the gap figures.

### Q4. Shortcut strategies (`shortcuts.mjs`; per-rung thresholds are 2-fold cross-validated so that choosing the best threshold does not inflate them)

**Pull** (1,200; 48.3 % knots; 46–53 % per rung):

| Strategy | Accuracy |
|---|---|
| "fully alternating ⇒ knot" | 51.7 % (no pull item is fully alternating) |
| crossing count | 52.3 % pooled, 50.0 % per rung |
| crossings near the centre (60/80/100 px shares, mean distance) | ≤ 53.3 % pooled, ≈ 50 % per rung |
| descending-ness from either end | ≤ 53.2 % |
| alternations, writhe, first/last crossing, curls, slide-offs, rope length | ≤ 53.6 % |
| logistic model on all 17 cheap features | 48.9 % |

**Untie and tie:**

- Key letters A–D are uniform: untie 895/912/888/905 of 3,600; tie 328/304/278/290.
- "The tag on the longest strand": untie 22.7 %, tie 25.5 %.
- The tag letter's place is uniform. The key's place in reading order favours the ends mildly (last: untie 29.2 %, tie 28.9 %).
- Handedness ≈ 25 %.
- Other centre/strand features are covered under F5.

**Link** (1,200; 48.9 % linked; 44–58 % per rung):

| Strategy | Accuracy |
|---|---|
| "loops overlap a lot" (shared area / smaller loop) | 52.9 % pooled, 50.4 % per rung |
| B's length inside A | 52.2 % |
| A-over-B count | 51.3 % (never odd) |
| alternations, writhe | ≤ 52.9 % |
| logistic model | 49.0 % |
| the signed count (lk ≠ 0) | 83.3 % (the builder reports 82.2 % as a strategy) |

### Q5. Texts with numbers that match the code

- describe() (6 inter-crossings; B's 2–5 self-crossings, as measured).
- Keys "1 or 2" / "1–4" (ui.js:519–524; option order Knot/Linked first).
- The tip levels (slide-over tip at rungs 4, 6–9 = the depth-1 rungs; tight tip at spacing 2).
- "Four crossings".
- The gen.js comment "≈ 90 %" (0.5 + 0.47·σ(1.75) = 90.0 %).
- The `linked` caption's count (|lk| = 2 → "twice").
- The bridge carries its limitation line.
- Captions `none`, `apart`, `linkedZero`, `knot` (reduced alternating only) are true where shown, apart from the F1 items.

### Q6. Timing

Every `generate` call runs synchronously before `P.run`/`P.demo` (play.js:1343, 1361, 1519, 1632; section.js:465, 747), and check.js generates probes only. That is before the ready phase.

- `present()` only draws; `diagramOf` and the tag placement take a few ms. It returns `timing.nextPaint()`, and RT = now − paintTs − pause (play.js:672).
- The frame monitor voids only when `present` takes > 400 ms (play.js:47, 675), which a static plate never reaches.
- Show-me replays are computed after the answer (view.js:292–295).

## Method, scripts and outputs

Everything is in the session scratchpad `/tmp/claude-0/-home-claude/145ff06a-4b5d-5025-8cb7-e87b9d56923b/scratchpad/rv-knots/` (it may not outlive the session; the numbers above are copied from its outputs).

- **`gen-items.mjs`, `gen-rung.mjs`:** generate items with the builder's code, loaded as knots.test.mjs loads it (`createContext({ files: [...MANIFEST, gen.js, learn.js] })`). Seeds: `PX.rng.hash('rv-knots' | 'rv-knots-2' | 'rv-knots-r0', variant, rope, spacing, s)`, 40 per combination (80 for untie2, 300 per spacing for rung 0). The builder's crossing positions and certificates are kept for comparison only.
- **`rvlib.mjs`:** my geometry, invariants and moves.
- **`selftest.mjs`:** known values.
- **`classify.mjs`:** answers, replays, legibility and paint emulation, features.
- **`summ.mjs`:** summaries.
- **`shortcuts.mjs`, `untie-borderline.mjs`:** Q4 (`shortcuts.txt` holds the full output).
- **`text-checks.mjs`, `twist.mjs`, `r3under.mjs`, `demo-check.mjs`:** Q5.
- **`showme-scan*.mjs`, `verify-bad-steps.mjs`:** F1.
- **`tags.mjs`, `nugatory.mjs`, `seam.mjs`:** N4, N5 and Q2.
