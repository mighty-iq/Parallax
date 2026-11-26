# W3-exfix: fresh-player fixes in seven exercises (19 Nov 2026)

Owner of this round (the lead's grant): js/ex/{slice,nets,track,homing,reckon,centralpoint,knots}/*, their css/ex/*.css,
tests/node/<id>*.test.mjs and tests/e2e/harness_<id>*.py. Source: fresh players on a 390 × 844 phone at snapshot f647a60
(screenshots g1, g2, g3). Tests ran on a snapshot of HEAD plus these files (/tmp, not the shared working copy).

## Slice (item 1)
- Real: on many items the plane's square ran under the "Cutting plane" label (g1 step_151, 156, 163, 167). Every frame
  now keeps the picture's hull clear of the labels: it moves down, or is drawn smaller where the stage has no room
  below (view.js clearLabels; inspect().labels for tests).
- Not real: the dashed outline over the options in the Watch (g1 step_148) is show me's flight caught mid-air; it lands
  on outline 2 (step_149).
- Checks: node slice 292/0; harness_slice 129/0 (new: 45 items at 412 × 880 and at 1366 × 768, no point under a
  label); fit.py slice 360 × 640 27/27 and 390 × 844 2/2 (screenshots looked at: the pyramid of g1 step_151 now sits
  under the labels).

## Nets (item 2)
- Real: How to play listed "Marked face" (opposite) and "Shaded square" (edges), both "stays on the table". One name
  and one look now: the shaded square, hatched in both variants; one part; goal, tips, captions, verdict, the
  screen-reader line and the comparison round's statements say "shaded square"; the Watch frames it while pointing.
- Checks: node nets 68/0, layers-nets 23/0, bets 400/0 (rounds' shortcuts unchanged); harness_nets 253/0; fit.py nets
  360 × 640 31/31, 390 × 844 3/3; screenshots (light, dark, Try 1 at 360 × 640, the Watch's pointer) looked at.
- For W3-voice: the guide's Nets text and shot still say "marked face" (requests.md).

## Track (item 3)
- Why 5 of 6 first: no starter band and no `at` steps; gen.js prices 4 or 5 of 6 by the unmarked spheres (Keff, by
  design), so 5 of 6 is the warm-up's easiest cell (60 of 60 simulated newcomers got it first; 4 or 5 of 6 were 68 %
  of the first five), while Try showed 2 and 3 targets only.
- Fix: Try 2 = 5 of 6 at the slowest speed with the 'others' tip (follow the unmarked ones); the cue line of every item
  with fewer unmarked than marked spheres says it, and the motion line says "Follow them, or the unmarked ones."
- Checks: node track 343/0 (new: a 5-of-6 Try item with its tip; the cue captions); harness_track 199/0; fit.py track
  360 × 640 30/30, 390 × 844 2/2; the cue line at 360 × 640 and 390 × 844 (three lines at 360 px, no scroll) looked at.

## Homing and Reckon (items 4, 5, 8, 9)
- Dial: taps on the circle always worked (the harness taps at 80 % of the radius); the fresh player tapped beside the
  word "right", outside the circle's box. Now a tap anywhere in the circle's row sets the arrow towards it (tap only:
  a swipe still scrolls).
- Copy of Pause over the map: on phones the fine buttons leave the layout after the answer, so at 390 × 844 no scroll
  is needed for the notes and the title row stays (checked in the app: stage at 64 px, no copy of Pause). At 360 × 640
  the player's stageIntoView still scrolls the stage to 8 px during show me: request to W2-core.
- Landmarks: drawn and visible at 390 × 844 (one in every walk screenshot of g3; one or two of three in the 74° view by
  design; mast and spire 3–4 px wide). Not changed.
- Frame (Reckon, item 5): "The top of the circle is the way you face now." in the hint where turning starts, the Watch's
  last caption and the heading Try's tip; the heading show me keeps that frame (it had swept your own arrow through
  the turn made, from the top).
- Walk toggle (item 8): Walk, Back, ↑ and ↓ toggle on a tap or a press under 250 ms; holds as before; the line says so.
- First scored items (item 9): no starter band; the legs dim is not the number of legs; 40 of 40 simulated newcomers
  start on a two-leg route, as Try 3 and Try 4 teach; the tester skipped those after Try 2's walk failed. No change.
- Checks: node homing + reckon 442/0; harness_homing 173/0 (new: a tap beside the circle; a drag there changes
  nothing); harness_reckon 106/0 (new: click, ↑ press, hold, Back and turn-round toggles; the heading show me's frame;
  the hint's line); fit.py homing + reckon 360 × 640 46/46, 390 × 844 3/3 (screenshots looked at).

## Central Point (item 6)
- The view's line after a miss that earns round points now reads as a near miss; the verdict word is play.js's:
  requested from W2-core (requests.md). Checks: node centralpoint + layers-centralpoint 393/0; harness_centralpoint
  227/0 (new: a miss 1.3–2.5 bands off earns credit and reads "near miss"; a far miss does not).

## Knots (items 7 and 10)
- Try 1: fixed seed 310 (a knot, one move, rope and spread as the demo's); the random draw preferred a falling-open
  rope (four moves at 5 crossings). Tags 32 units (was 28), letters 17 px; show me's key ring solid green like its tag,
  the wrong pick's red and dashed; wide screens put the answers beside the plate (no fold, no shift after answering).
- Checks: node knots: the full run (10 000 items) passed all but the new Try 1 check, whose spread tolerance was too
  tight (0.0015 units); after the fix its learn checks pass (a 300-item rerun; its shortcut cells fail only on that
  sample size); harness_knots 342/0; the app at 1366 × 768 (pull and untie): answers at 258 px before and after.

## Round 2 (22 Nov, after the pause): review items
- Spin, RV-items H6 (e684ace): copies and mirrors are drawn to lean alike (pickBeta rule 3, from the shape's own
  axis tilts), the box gap weighs the unsigned aspect, size and box corner, and same-or-mirror items keep 6° clear of a
  quarter turn, where no orientation hides both the lean and the box. Leans 50–55 % per angle (were up to 83 %), box
  cues unchanged, pick lean pairs ≤ 25.5 % (bound 26.7 %); spin.test bounds three leans; the tutorial's demo and Try
  items compared by eye (scratch renders in /tmp/w3exfix/spin/).
- Central Point, RV-items L3 (22b3a03): the two guesses are partial skill, reported per cell, named in DECISIONS.
- Central Point, RV-a11y L3 and L4 (22b3a03): Quick's Move button opens the four arrows (closed: one button beside
  Confirm; open: a row above, the plate gives up its height; stays open for the session); a miss's line uses the
  totals' excess. On desktops the plate leaves room for the countdown bar (1366 × 768: 16 of 16 items fit).
- Reckon, RV-items L4: "back along the leg before the last turn" stays reported (16 of 98 cells over chance + 10,
  worst route 2 at ±40°, 75 %; ≤ 35 % where the legs decide); homing.test's report prints it for walks back too.
- Checks: knots node (full) 519/0 on 62598ff; fit.py 360 × 640 and 390 × 844: spin 22/22 + 2/2, knots 29/29 + 4/4,
  centralpoint 21/21 + 2/2 (+ 844 × 390 2/2); at 1366 × 768 (a scratch copy of fit.py with that size; its text and
  header rules are phone rules): knots 24/24, centralpoint 16/16, and Spin's hardest pick item does not fit (the four
  options end 2 px under the fold, Confirm below; not changed, Spin's layout is as before). Node: spin 92/0,
  shortcut-levels (spin) 4/0, centralpoint 393/0, reckon + homing 442/0; harness_spin 82/0, harness_centralpoint 247/0.

## RC1 fix (26 Nov): bets.py's calibration check
- The failure (Central Point at 390 x 844: 3 answers kept, 2 rows of layer 3) was not the Move button or the miss line:
  the two-minute Train session gives Central Point its quota of three items and then interleaves other exercises
  (traced: the apply item, two calib-detail items, then other exercises' rows), and the check needs five answers.
  It failed in 3 of 4 runs on 2f97d81 depending on the session's mix. The calibration run now trains Central Point
  alone (play route count 1); js/ui/bets.js and js/engine/bets.js need no change. bets.py round:centralpoint 44/0
  three times, round + draw + bridge 121/0, harness_centralpoint 247/0, node bets 400/0.

## RC1 fix (26 Nov): Knots' plate on phones held sideways
- phones.py (O48) failed at 844 x 390, 915 x 412, 740 x 360 and 667 x 375 on a first item: the plate gave up the height
  of the new-kind line (css/play.css's has-newkind rule, --pl-nk) although that line sits in the answers' column there.
  Not the desktop layout (its query needs 501 px of height). The sideways plate takes that height back
  (css/ex/knots.css); 844 x 390 330 px, 740 x 360 300 px. phones.py knots 31/0, fit.py knots 29/29 + 4/4 x 3 and
  1366 x 768 4/4, harness_knots 342/0.

## Left open
- Requests: W3-voice, the guide's Spin figures and captions (a 92° item can no longer be made) and Central Point's
  Move button (requests.md, 22 Nov); from round 1, the guide's Nets text and shot, and W2-core's copy of Pause over a
  show me's stage at 360 × 640 (stageIntoView; not checked since). W2-core's round 10 did the "Near miss" verdict.
- Spin at 1366 × 768: the hardest pick item (9 squares at 170°) overflows by about 60 px with a tip shown.
- Reckon: a generator preference against route 2's fold-back routes, if pooled exports show the last-leg answer used.
