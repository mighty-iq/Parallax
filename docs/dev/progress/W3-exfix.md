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
