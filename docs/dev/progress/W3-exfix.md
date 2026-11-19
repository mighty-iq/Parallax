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
