# RV-a11y-1.2: accessibility and phone-usability review (partial)

Reviewer: independent agent, 19 Nov 2026 (UTC). Snapshot: a434e64 (frozen copy). Method: Python Playwright on Chromium, axe-core (wcag2a, wcag2aa, wcag21a, wcag21aa, best-practice) injected into each page, plus measured touch targets and overflow checks. Scripts and screenshots: /tmp/rv_a11y/ (shots under /tmp/rv_a11y/shots/). The owner's usage ran low, so the review stopped early; "Not covered" lists what is missing.

## Findings

### Medium

M1. Exercise name clipped in the player's top bar on phones. Screen: any item whose bar also shows "How to solve", Help and Pause. Viewport 360 x 640 (and worse at 200 % text). Element `.pl-hud-id` (width 93 px, overflow hidden, text-overflow clip, so no ellipsis). Seen: "Central Poi" (Central Point), "Painted Cub" (Painted Cubes), Missing View also overflows (scrollWidth 101 vs 93). At 390 x 844 with 200 % text the Patterns bar shows "Patte" and "~11 ...". Screenshots: shots/i-centralpoint-360x640-l.png, shots/i-cubes-360x640-l.png, shots/sess-feedback-390x844-d-2.0.png. Fix: let the title wrap or shrink, or hide "How to solve" behind Help on narrow bars.

M2. "One question first" (expectation card, `[data-card-box="expect"]`, desktop 1366 x 768): when the card replaces the Start card, focus drops to `body`, and the keys 1 to 5 printed on the buttons do nothing (pressed 3, no change). A keyboard player has to Tab to find the choices. Fix: focus the first choice (or the card heading) when the card opens, and either bind 1-5 or drop the numerals. Screenshot: shots/k5-stuck.png. Related: after Start in the same flow focus was also on `body` while the Patterns exposure ran (acceptable during a stimulus).

M3. Phone tab bar at 200 % text, 360 x 640: labels overlap ("Today", "Library", "Progress", "Log" collide) in `.px-tabbar .px-tab`. The sticky header (about 176 CSS px) plus the fixed tab bar take roughly a third of the screen, so one to two lines of content show. Screenshots: shots/progress-360x640-l-2.0.png, shots/exercise_centralpoint-360x640-l-2.0.png. Fix: let labels wrap or hide below a threshold, and make the header non-sticky at large text.

M4. Voice-control name mismatch (WCAG 2.5.3, axe label-content-name-mismatch, 1 to 6 nodes on every item screen): the visible label does not appear in the accessible name. `button.pl-hud-guide` shows "Help" but has aria-label "Goal and tips"; `.px-choice` options in Rotate, Spin, Nets, Knots, Slice, Angles, Fold, Patfold have visible "Same"/"Mirror" (or similar) with longer aria-labels such as "Same figure, turned" and "Mirror image"; Keys button likewise ("Keys", label "Keyboard keys"). Someone saying "click Help" gets nothing. Fix: start every aria-label with the visible text ("Help, goal and tips").

### Low

L1. `button.ex-cubes-tally-toggle` (Painted Cubes, any item with several questions) has `aria-controls="ex-cubes-tally"` while the pad is closed, so the id does not exist (axe aria-valid-attr-value, rated critical by axe, little effect on a player). Fix: add aria-controls only while the pad is open.

L2. Progress at 200 % text (360 x 640, 390 x 844): `.gm-table-wrap` scrolls sideways (table 556 px wide) and is not keyboard focusable (axe scrollable-region-focusable). Fix: tabindex 0 plus a label on the wrapper.

L3. Central Point Quick form has no nudge buttons (they exist only in Exact). Placement is by tapping the board (`svg.ex-cp-board`, aria-hidden) or arrow keys, so a touch screen-reader or switch user cannot move the marker. Arrow keys and Enter work with a keyboard (verified: live text "Marker at column 4, row 4", Enter answers). Fix: show the nudge buttons when no hardware keyboard is detected, or always.

L4. Central Point grade line after a wrong answer reads "Your total 40.1 · best 23.6 (+70 %)" followed by "More than 0.25 % farther in total than the best spot." The two figures look contradictory to a player (screenshot shots/x-centralpoint-360x640-l.png). Wording, not accessibility, but it confuses.

L5. About screen: DOI links in the references list are 18 px tall (`a` doi.org/..., 6 links at 360 x 640, 390 x 844, 844 x 390). Inline reference links, spaced apart; low.

## Checked and found clean

- Welcome pop-up at 360 x 640 and 1366 x 768: focus starts on a button, Tab cycles inside the dialog (trap holds, Shift+Tab works), Escape closes, every target 44 px, visible focus ring (2 px solid outline on all buttons and links sampled). One-tap card on later launches: fits, Join and close are reachable.
- axe (wcag2a/aa/21 and best-practice, which includes colour contrast) reported nothing on Today, Library, exercise pages (Rotate, Central Point), Progress, Log, Lab, Settings, About, Section, Climb start, Daily start, the Spatial Check start card and a Patterns probe item, session summary, and Today, Progress and Log with data, at 360 x 640, 390 x 844, 844 x 390 and 1366 x 768 in light, and at 360 x 640 and 1366 x 768 in dark, apart from the findings above. Dark at 390 x 844 with 200 % text: same.
- Touch targets under 44 x 44 px: none found on any screen or item listed, except L5. Items checked (Watch and one scored item plus a wrong-answer state, 360 x 640 light): rotate, spin, fold, nets, slice, views, orient, angles, cubes, openings, patfold, patviews, form, centralpoint, span, hidden, knots, reckon, homing.
- No horizontal page overflow at any viewport and 200 % text, except the L2 table (inside its own scroller).
- Colour-only cues: after a wrong answer the chosen option has a red outline plus an x mark, the right one a dashed outline plus a check mark, and the bar says "Incorrect" with an icon; Central Point labels "you" and "best" in text.
- Flashing: no infinite animations in css/; Span shows one block per second, Homing dots fade at 0.8 s or slower, Patterns shows one 3 s exposure; countdown bars are linear fills. I read the code and did not measure rendered frames.
- Keyboard: Today to Start (one Tab), Watch/Try/Go offer, Try and scored Spin items by number keys, Central Point (arrows, Enter) all work; focus lands on the item section during items; focus ring present on buttons.

## Not covered (ran out of budget)

- A complete keyboard-only session through to the summary (the run reached the Baseline start card and the expectation card; the Pause and Keys modals' focus order were not tested).
- Track items (the motion notice blocked my driver), the Spatial Check probes other than Patterns, a Daily or Climb scored item, Painted Cubes with the tally pad open, Central Point on its largest grid (tap pitch at 360 px), 844 x 390 items other than Patterns, reduced-motion behaviour (emulated setting not exercised), a screen-reader pass.
