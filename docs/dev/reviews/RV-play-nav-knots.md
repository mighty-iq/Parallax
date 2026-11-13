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

### Feedback after an answer (Try)
- Turn item: "✓ 23° off: within 40°. You turned 116° left in all; turning back by as much faces the way you started." Clear.
- Distance item: "✓ 0 m off: within 35 % of the distance (3.4 m). The first walk was 9.6 m; you walked 9.6 m (0 % too far)." Clear; "0 % too far" reads oddly when exact (r11_t2_fb.png).
- A miss on a point-home item opens the top-down map by itself and replays it: route, the turn ("106°"), the start angle ("126°"), and a grey arrow labelled "you" for my answer; the dial shows my answer in red and the right one in green with the ±40° wedge; "The right answer is shown." The text adds a diagnosis: "Your answer points where the start would be if you had never turned. Keep each turn as it happens: it moves the start round you." (r13_t3_fb.png, r14_map_09.png). Very good. The label "you" on the answer arrow could be read as "your position"; "your answer" would be clearer.

### Results
- Verdict: plays correctly within 2 minutes for point-home; walk-back needs a little more (the Walk / Here controls were off screen on the first try, see problem 1).
- Try result, first pass (counted): Try 1 ✓ (23° off), Try 2 ✓ (0 m off), Try 3 ✗ (106° off: I misjudged the turn direction from my sparse screenshots). Try 4 seen on a second pass (Try items repeat exactly on a second run): walk back home ✓ (0.1 m from the start).
- Scored (Path stage 1): 5 of 5 right. Four point-home items (3°, 2°, 4°, 21° off) and one walk-back item (0.7 m from the start, "2° off in direction, 4 % too far").
- 360x640: the point-home answer screen fits completely (scene, compact dial with ◀5° ◀1° 1°▶ 5°▶ beside it, readout, Confirm) (r41_small_walk.png, r42_small_answer.png). I could not reach a walk-back item at 360x640 before my browser slot ran out.

### Is the answer feedback understandable and useful?
Yes, with one layout problem.
- Point home: "✓ 3° off: within 40°. The start was 125° to your left, 12 m away. Filled arrow: the way to the start; shaded: ± 40°." Plain and exact.
- Walk back: "✓ 0.7 m from the start: within 50 % of the way back (5.4 m). The start was 123° to your left, 11 m away. You turned 121° left and walked 11.3 m: 2° off in direction, 4 % too far in distance. Drift: 0.7 m off after 28 m walked, about 2 cm per metre." Splitting the miss into direction and distance is the most useful part. "Drift … after 28 m walked" needs a word of context: it counts the outbound route plus the walk back, which a beginner will not guess, and there is no hint whether 2 cm per metre is good.
- Habit over recent routes: "Your last 5 routes: your turns were about right on average." with a dot strip and the key "Above the line: turned too far round; below: too little. Filled: right; shaded: the current tolerance." (r38_s5_fb_scrolled.png). The sentence is clear; the strip is not (no axis, the dots sit in a clump at the left, "Filled: right" is easy to misread as "to the right").
- Layout: on a 390x844 phone all of this text sits below the fixed result bar ("✓ Correct 90.8 s / See solution / Next"); without scrolling the player sees only the green chip (r37_s5_fb.png). Most players will tap Next without ever seeing the direction/distance split or the habit line.

### Problems
1. Walk-back controls off screen in the Try step. On 390x844, Try 2 ("Hold Walk: walk the same distance again, then tap Here.") shows no Walk button at all: Back / Walk / Here sit below the fold under a greyed, unused arrow circle (r08_t2_answer.png). After scrolling 117 px the buttons and the scene both fit (r09_t2_scrolled.png). In the scored layout they fit (Walk at y 731).
2. The ◀ 5° / 5° ▶ buttons fire on touch-down and swallow scrolls. Controlled test on 390x844: answer set to "Facing 138° right"; a vertical swipe in the empty right margin changed nothing; the same swipe starting on ◀ 5° changed it to "Facing 133° right" and the page did not scroll. Holding 5° ▶ for 1.5 s auto-repeats (133° right → 162° left). In real play this changed two of my answers while I scrolled to reach Confirm: "Facing 99° right" became "You faced 94° right", and "Facing 123° left" became "You faced 128° left" (Try step, Confirm below the fold). Cancel the step when the finger moves, and let a vertical drag scroll the page.
3. Feedback text hidden behind the result bar (see above; r37_s5_fb.png, r11_t2_fb.png).
4. Tip does not match the item: "After each turn, say to yourself where the start is now: behind, behind-left, left…" is shown on Try 2, a straight walk with no turns (r08_t2_answer.png).
5. Stage text and items disagree, as in Homing: stage 1 says "2 legs, large turns (120–160°)" but scored item 2 was "3 straight legs" (the item's own description) with turns of about 47° and 53° by my frame measurement, and scored items 4 and 5 turned about 108° and 105°.
6. "Parts" during the Watch demo opens a long glossary above the scene, so the demo keeps playing off screen (r20_parts.png).
7. Small text: in the newer Watch layout the arrow circle shrank to 136 px and its labels "ahead", "left", "right" are about 7 px high (r21_yourturn.png). On 360x640 the compact circle has no labels at all (the readout "Facing straight ahead" compensates).
8. Small: the miss map labels the answer arrow "you" (reads like your position).

### Suggested change
Put the result explanation (direction error, distance error, habit line) above the fixed result bar, or make the bar collapse after a second, so the feedback that makes Reckon trainable is actually seen.
