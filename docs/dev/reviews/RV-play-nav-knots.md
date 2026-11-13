# RV-play-nav-knots: first-time player test of Homing, Reckon and Knots

DRAFT, in progress (13 Nov 2026). Tester: a fresh agent that saw only the running app (file:// index.html, v1.1.0) through Playwright. No source, docs or guide read.
Screenshots: /tmp/claude-0/-home-claude/145ff06a-4b5d-5025-8cb7-e87b9d56923b/scratchpad/rv-play2/shots/ (named below without the folder).

## Homing (phone 390x844, touch)

- Verdict: plays correctly within 2 minutes.
- Try result: 5 of 5 right (the Watch item answered myself, then Try 1-4).
- Scored: 5 of 5 right (errors 1, 1, 7, 22, 6 degrees; tolerance 40).

### What the tutorial showed
1. Library card "Homing · with landmarks", "After a route, turn to face the place where you started." Path stage 1 → Start → card "New: Homing … Watch, Try, Go shows how it works in about a minute" (h02_after_start.png).
2. Watch: captions on the 3D walk ("You start here, inside the ring. Remember where it is." → "Watch the route: straight legs, with turns on the spot between them.") with Pause / Step / Replay / Close (h03_watch_00.png). The step then said "Now answer it yourself. It is practice and never counts." (h04_watch_00.png). My tool latency made me miss the middle of this demo, so I cannot say whether it showed the solved turn; Reckon's demo did (see Reckon).
3. Try 1-4 with a Tip line, then "Go: the next items count."
4. Feedback after each answer: flag on the start, the dial with the true arrow and a ±40° wedge, "✓ 5° off: within 40°", "The start was 105° to your right, 10 m away." (h06_try1_fb.png). Scored items add "See solution": a top-down map of the route with the landmarks, the turn angle and the answer angle, rotated so you face up (h26_solution_0.png, h26_sol_11.png). Clear.

Did I understand the rule before my first answer? Yes. "Watch a short walk, then turn to face where you started" plus a dial labelled ahead / left / right and the live readout "Facing 110° right" make the task obvious. Turning works three ways and all three worked on touch: tap or drag on the circle (fastest), drag the view sideways (200 px ≈ 50°), and the ◀ 5° / ◀ 1° / 1° ▶ / 5° ▶ buttons.
The tip "The far landmarks stay put while you walk: use them as a fix, like a compass, to see how far you have turned" is the most useful line in the tutorial: turning the view at the end until a landmark seen during the walk comes back into view gives the turn angle almost exactly.

### Problems
1. Confirm is below the fold in the Try step on a 390x844 phone. The Tip box pushes the layout down; only a 10 px sliver of Confirm shows (h08_try2_answer.png; Confirm at y 833-877 on an 844 screen). With the longer tip ("The far landmarks stay put while you walk: …") Confirm is fully off screen. A real phone browser has less height than 844, so it is worse there. The scored layout (no step bar, no tip) fits (h23_s1_00.png).
2. Scrolling to reach Confirm can change the answer. See Reckon problem 2: a swipe that starts on or near the ◀ 5° button turns the answer 5° left without any visible tap.
3. The bottom result bar ("✓ Correct 100.2 s / Try it") covers the end of the explanation: "Filled arrow: the way to the start; shaded: ± 40°." is cut off (h06_try1_fb.png).
4. Landmarks were often never in view. Path stage 1 says "several landmarks", but in scored items 3 and 4 no landmark appeared at any moment of the walk (h30_sheetA.png, h30_sheetB.png, h32_sheetA.png to h32_sheetC.png), and in Try item 4 the only landmark crossed the view briefly during the last turn (h19_sheetB.png). On those items "with landmarks" plays exactly like Reckon. Suggest at least one landmark in view during the first leg.
5. Stage text and items disagree. "Settings at this stage: 2 legs, large turns (120–160°), several landmarks, tolerance 40°." Scored item 2 was "3 straight legs" with turns of about 58° and 54°; scored item 5 had a 90° turn; the session summary repeats "At this level: 2 legs, large turns (120–160°)" (h39_end.png).
6. The solution map puts the landmarks close to the route, so their bearings from the start on the map differ from the 3D view: the radio mast was about 17° left of straight ahead at the start in 3D (h23_s1_00.png) but drawn right of "up" from the start on the map (h26_solution_0.png). Minor, but a player checking the map against memory will notice.
7. The exercise page opens with jargon before any instruction: "Homing is experimental: its item model is new and untested. It is the landmark-aided stage before Reckon: far landmarks correct dead-reckoning errors. … distances matter more with bigger turns and at tighter tolerances." (p05_homing_page.png). The one-line rule appears only further down.
8. Small: the first tap on the Library tab right after closing the welcome pop-up did nothing (p02_library.png); the second worked.

### Suggested change
Make the Try layout fit one phone screen: put the Tip inside the scene caption (or below Confirm) so Confirm and the dial are visible without scrolling.

## Reckon (phone 390x844, touch)

(in progress)

### What the tutorial showed
1. Exercise page: "Watch a walk with nothing to steer by, then point to where you started." The "How to play" list is good and plain: "Ground: Its marks slide past as you move, so they show how far and how fast you turn and walk. Nothing on it marks a place, and speeds change, so count what you see, not seconds." and "Walk back · walk back home: On return items: turn first, then hold Walk (key ↑) and let go to stop; Back (↓) steps back. Tap Here (Enter) where you think the start is." (r01_page.png).
2. Watch: a complete solved item with captions, about 45 s: "You start here, inside the ring. Nothing else will ever mark this spot." → "Watch the walk: straight legs with turns on the spot between them. The ground shows every metre and every degree." → "The walk ends here. The start is somewhere off the screen, and nothing points to it." → top-down map: "8 m straight ahead." / "Turn 101° to the right: everything round you turns the other way." / "Then 10 m straight on." / "You end here, facing this way." / "The start is 12 m away, along the dashed line." / "Turn the map so that you face up again." / "The start is 138° to your right: that is the arrow on the circle." → back in 3D: "Turn 138° to the right: now you face the start." (flag appears) → "To answer, drag the view or the circle, or use ◀ ▶ (keys ← →). Then Confirm (Enter)." → "Now answer it yourself. It is practice and never counts." (r03_sheetA.png, r03_sheetB.png). This is the best tutorial element of the three exercises: it shows the reasoning, not only the controls.
3. Try 1 "Watch yourself turn on the spot, then turn back to the way you faced at the start." Try 2 "Watch a straight walk, then walk the same distance again at another speed." Try 3 a full two-leg point-home item. Good scaffolding: turn alone, distance alone, then both.
