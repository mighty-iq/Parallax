# RV-play-nav-knots: first-time player test of Homing, Reckon and Knots

13 Nov 2026, 19:40-22:25 local time. Parallax v1.1.0 from file:///home/claude/parallax/index.html.
The tester was a fresh agent that saw only the running app, through Playwright. It read no source, docs, guide or git history.

Screenshots are in /tmp/claude-0/-home-claude/145ff06a-4b5d-5025-8cb7-e87b9d56923b/scratchpad/rv-play2/shots/ and are named below without that folder.

Devices:
- Phone 390x844, touch (has_touch, is_mobile).
- Small phone 360x640: Reckon only.
- Desktop 1366x768, mouse: a quick look at all three exercises.

How I watched the walks:
- I watched each walk as a screenshot sequence: first one frame every 0.3-0.7 s, then clipped frames every 0.05-0.1 s.
- For Reckon I measured the turns and leg lengths from those frames with a small image-matching script, because a sparse screenshot sequence does not carry the motion a person sees. I used no app internals.
- So my scores show that the rules and controls are usable. They do not show how hard the items are for a person.

Builders changed the layout while I was testing. After about 21:15 the circle shrank to 136 px and a "Your turn" sheet appeared, so screenshots before and after that time differ.

## Summary

| Exercise | Verdict | Try (from the tutorial alone) | Scored, right of 5 |
|---|---|---|---|
| Homing | plays correctly within 2 minutes | 5 of 5 (demo item + Try 1-4) | 5 |
| Reckon | plays correctly within 2 minutes for point home; walk back takes longer on a 390x844 phone (controls start off screen in the Try step) | 3 of 4 (Try 3 wrong); demo item right | 5 (4 point home, 1 walk back) |
| Knots | plays correctly within 2 minutes | 3 of 3 + demo item | 5 |

Worst problems, all three exercises:
1. The ◀ 5° / 5° ▶ buttons act on touch-down and swallow scroll gestures (Reckon problem 2). A swipe that starts on them turns the answer by 5° and does not scroll the page. This changed two of my answers while I scrolled to reach Confirm.
2. In the Try step on a 390x844 phone, Confirm (Homing, Reckon) and Walk / Here (Reckon) start below the fold.
3. The fixed result bar hides the explanation under it. In Reckon that is the most useful feedback: the direction and distance split and the habit line.
4. The Knots demo silently switches to a copy of the rope with one crossing changed. It solves the copy to "No knot", then returns to the original: "A knot remains". This is easy to read as one rope getting two answers.

## Homing (phone 390x844)

- Verdict: plays correctly within 2 minutes.
- Try: 5 of 5 right (the demo item, answered myself, then Try 1-4). Errors 5°, 1°, 4°, 4° and 9° against a 40° (last 30°) tolerance.
- Scored (Path stage 1): 5 of 5 right. Errors 1°, 1°, 7°, 22° and 6°; tolerance 40°. Summary: "5 of 5 right (100 %) … Level 13 likely 1–52" (h39_end.png).

### What the tutorial showed
1. Library card "Homing · with landmarks". Path stage 1 → Start → "New: Homing … Watch, Try, Go shows how it works in about a minute" (h02_after_start.png).
2. Watch: a solved demo with captions and Pause / Step / Replay / Close (h03_watch_00.png).
   - "You start here, inside the ring. Remember where it is." then "Watch the route: straight legs, with turns on the spot between them."
   - Then a top-down map of the route with its legs and turn, rotated so you face up, back to 3D, "Turn … to the right", and the flag (seen in full on desktop, d03_sheet.png). On the phone my tool latency made me miss the middle.
   - Ends with "Now answer it yourself. It is practice and never counts." (h04_watch_00.png).
3. Try 1-4, each with a Tip, then "Go: the next items count."
4. Feedback (h06_try1_fb.png):
   - A flag on the start, and the circle with the true arrow and a ±40° wedge.
   - "✓ 5° off: within 40°", "The start was 105° to your right, 10 m away."
   - Scored items add "See solution": a top-down map with the landmarks, the turn angle and the answer angle (h26_solution_0.png, h26_sol_11.png). Clear.

I understood the rule before my first answer. "Watch a short walk, then turn to face where you started", a circle labelled ahead / left / right, and the readout "Facing 110° right" make it obvious.

All three ways to turn worked on touch:
- tap or drag on the circle (fastest);
- drag the view (200 px ≈ 50°);
- the ◀ 5° ◀ 1° 1° ▶ 5° ▶ buttons.

The best line in the tutorial is the tip "The far landmarks stay put while you walk: use them as a fix, like a compass, to see how far you have turned." Turning the view at the end until a landmark from the walk comes back gives the turn almost exactly.

### Problems
1. **Confirm below the fold in Try.** The Tip box pushes the layout down, and only a 10 px sliver of Confirm shows (h08_try2_answer.png, Confirm at y 833-877 on an 844 screen). With the longer tip Confirm is fully off screen. A real phone browser is shorter than 844 px. The scored layout fits (h23_s1_00.png).
2. **Scrolling can change the answer.** See Reckon problem 2.
3. **The result bar covers the explanation.** "✓ Correct 100.2 s / Try it" hides "Filled arrow: the way to the start; shaded: ± 40°." (h06_try1_fb.png).
4. **Landmarks were often never in view.** Stage 1 says "several landmarks". In scored items 3 and 4 no landmark appeared at any moment of the walk (h30_sheetA.png, h30_sheetB.png, h32_sheetA.png to h32_sheetC.png). In Try 4 the only landmark crossed the view briefly during the last turn (h19_sheetB.png). Those items play exactly like Reckon.
5. **Stage text and items disagree.** "Settings at this stage: 2 legs, large turns (120–160°), several landmarks, tolerance 40°." But:
   - scored item 2 was "3 straight legs" with turns of about 58° and 54°;
   - scored item 5 turned about 90°;
   - the summary still says "At this level: 2 legs, large turns (120–160°)" (h39_end.png).
6. **The solution map does not match the 3D view for landmarks.** The map draws the landmarks close to the route, so their directions from the start differ from 3D. The radio mast was about 17° left of ahead at the start in 3D (h23_s1_00.png) but right of "up" on the map (h26_solution_0.png).
7. **The exercise page opens with jargon.** It reads "its item model is new and untested … far landmarks correct dead-reckoning errors … distances matter more with bigger turns and at tighter tolerances" before the one-line rule (p05_homing_page.png).

### Suggested change
Make the Try layout fit one phone screen. Put the Tip in the scene caption or below Confirm, so the circle and Confirm show without scrolling.

## Reckon (phone 390x844; small phone 360x640)

- Verdict: plays correctly within 2 minutes for point home. Walk back home takes longer on a 390x844 phone, because Back / Walk / Here start below the fold in the Try step.
- Try, first pass:
  - Try 1 (turn on the spot): ✓, 23° off.
  - Try 2 (walk the same distance): ✓, 0 m off.
  - Try 3 (point home): ✗, 106° off. I misread the turn direction from sparse screenshots.
  - The demo item: ✓.
- Try 4 (walk back home) came on a second pass and was ✓, 0.1 m from the start. Try items repeat exactly on a second run.
- Scored (Path stage 1): 5 of 5 right.
  - Four point home: 3°, 2°, 4° and 21° off.
  - One walk back: 0.7 m from the start, "2° off in direction, 4 % too far".
  - Summary "Level 11 likely 1–42" (r39_summary.png).
- 360x640: both answer screens fit with no scrolling: scene, compact circle with ◀5° ◀1° 1°▶ 5°▶ beside it, readout, and Confirm or Back / Walk / Here (r41_small_walk.png, r42_small_answer.png, r54_small_walkback.png).

### What the tutorial showed
1. The exercise page's "How to play" is plain and good (r01_page.png):
   - "Ground: Its marks slide past as you move, so they show how far and how fast you turn and walk. Nothing on it marks a place, and speeds change, so count what you see, not seconds."
   - "On return items: turn first, then hold Walk (key ↑) and let go to stop; Back (↓) steps back. Tap Here (Enter) where you think the start is."
2. Watch, about 45 s (r03_sheetA.png, r03_sheetB.png). This is the best tutorial element of the three exercises: it shows the reasoning, not only the controls. The captions in order:
   - "You start here, inside the ring. Nothing else will ever mark this spot."
   - "Watch the walk: straight legs with turns on the spot between them. The ground shows every metre and every degree."
   - "The walk ends here. The start is somewhere off the screen, and nothing points to it."
   - Top-down map: "8 m straight ahead." / "Turn 101° to the right: everything round you turns the other way." / "Then 10 m straight on." / "The start is 12 m away, along the dashed line." / "Turn the map so that you face up again." / "The start is 138° to your right: that is the arrow on the circle."
   - Back in 3D: "Turn 138° to the right: now you face the start." (the flag appears)
   - "To answer, drag the view or the circle, or use ◀ ▶ (keys ← →). Then Confirm (Enter)."
3. Try builds up one skill at a time, which is good scaffolding:
   - Try 1: "Watch yourself turn on the spot, then turn back to the way you faced at the start."
   - Try 2: "Watch a straight walk, then walk the same distance again at another speed."
   - Try 3: a two-leg point-home item.
   - Try 4: walk back home.

### Is the feedback after an answer understandable and useful?
Yes, with one layout problem.
- **Point home:** "✓ 3° off: within 40°. The start was 125° to your left, 12 m away." Plain and exact.
- **Turn item:** "You turned 116° left in all; turning back by as much faces the way you started."
- **Distance item:** "The first walk was 9.6 m; you walked 9.6 m (0 % too far)." (r11_t2_fb.png). "0 % too far" reads oddly when the answer is exact.
- **Walk back:** "✓ 0.7 m from the start: within 50 % of the way back (5.4 m). … You turned 121° left and walked 11.3 m: 2° off in direction, 4 % too far in distance. Drift: 0.7 m off after 28 m walked, about 2 cm per metre." (r37_s5_fb.png, r38_s5_fb_scrolled.png).
  - Splitting the error into direction and distance is the most useful part.
  - "Drift … after 28 m walked" counts the route plus the walk back. A beginner will not guess that, and nothing says whether 2 cm per metre is good.
- **Habit:** "Your last 5 routes: your turns were about right on average." plus a dot strip with the key "Above the line: turned too far round; below: too little. Filled: right; shaded: the current tolerance." (r38_s5_fb_scrolled.png).
  - The sentence is clear.
  - The strip is not: it has no axis, the dots sit in a clump at the left, and "Filled: right" is easy to read as "to the right".
- **A miss** opens and replays the top-down map by itself, and the text diagnoses the error (r13_t3_fb.png, r14_map_09.png). Very good.
  - The map shows the route, the turn ("106°"), the start angle ("126°") and a grey arrow labelled "you" for my answer. The circle shows my answer in red and the right one in green with its wedge.
  - The text says: "Your answer points where the start would be if you had never turned. Keep each turn as it happens: it moves the start round you."
  - The label "you" can read as "your position"; "your answer" would be clearer.
- **Layout:** on 390x844 everything after the green chip sits under the fixed bar "✓ Correct 90.8 s / See solution / Next" (r37_s5_fb.png). Without scrolling, a player sees none of the direction / distance / habit text.

### Problems
1. **Walk back controls off screen in Try.** On 390x844, Try 2 says "Hold Walk: walk the same distance again, then tap Here." but no Walk button is visible (r08_t2_answer.png).
   - Back / Walk / Here sit below the fold, under a greyed circle that this item does not use.
   - After scrolling 117 px, the buttons and the scene both fit (r09_t2_scrolled.png).
   - In the scored layout they fit.
2. **◀ 5° / 5° ▶ act on touch-down and block scrolling.** Controlled test on 390x844:
   - Answer set to "Facing 138° right".
   - A vertical swipe in the empty right margin changed nothing.
   - The same swipe starting on ◀ 5° gave "Facing 133° right", and the page did not scroll.
   - Holding 5° ▶ for 1.5 s auto-repeats (133° right → 162° left).
   - In real play this changed two answers while I scrolled to reach Confirm in the Try step: "Facing 99° right" became "You faced 94° right", and "Facing 123° left" became "You faced 128° left".
   - Fix: cancel the step when the finger moves, and let a vertical drag scroll the page.
3. **The result bar hides the feedback text.** See above.
4. **A tip that does not fit the item.** "After each turn, say to yourself where the start is now: behind, behind-left, left…" appears on Try 2, a straight walk with no turns (r08_t2_answer.png).
5. **Stage text and items disagree, as in Homing.** Stage 1 says "2 legs, large turns (120–160°)". By my frame measurement:
   - scored item 2 was "3 straight legs" (the item's own text) with turns of about 47° and 53°;
   - scored items 4 and 5 turned about 108° and 105°.
6. **"Parts" during Watch hides the demo.** It opens a long glossary above the scene, so the demo keeps playing off screen (r20_parts.png).
7. **Small text.** In the newer Watch layout the circle is 136 px and its labels "ahead / left / right" are about 7 px high (r21_yourturn.png). The 360x640 compact circle has no labels; the readout "Facing straight ahead" compensates.

### Suggested change
Show the result explanation above the fixed result bar, or let the bar collapse after a moment, so players see the direction / distance / habit feedback that makes Reckon trainable.

## Knots (phone 390x844)

- Verdict: plays correctly within 2 minutes. "Pull both ends in your mind: does a knot remain?" with two big buttons (Knot / No knot, 175x56) is clear at once. The first demo caption "The gap shows which strand is underneath." teaches the one convention you need.
- Try: 3 of 3 right, plus the demo item.
  - Try 1: Knot.
  - Try 2: Knot.
  - Try 3, the first marked-crossing item: "✓ C unties it".
- Scored (Path stage 1): 5 of 5 right: Knot, Knot, No knot, No knot, No knot (5-6 crossings). Summary "Level 4 likely 1–39" (k21_summary.png).
- I did not meet a "two loops: linked or apart" or "which crossing ties it" item.

### What the tutorial showed
1. The exercise page (k01_page.png):
   - "How to play" covers Rope, Crossing, the marks A–D formats, Two loops, and Answer.
   - Two strategies: "Picture the pull" and "Trace and remove".
   - The test-overlap note: "Also in tests: … Practising it here will likely raise your score on such items, so if you take one, say that you have practised."
2. Watch, about 35 s. Captions in order (k03_seqA.png, k03_sheet2.png):
   - "The gap shows which strand is underneath."
   - "Same shape, one crossing different: only the crossings decide."
   - "This loop lies underneath: drop it out." / "This loop lies on top: lift it off." / "A curl: untwist it."
   - "Nothing is left: the rope falls open. No knot."
   - "Untwist a curl, slide off a loop on top, slide over a crossing: the three moves."
   - The original rope again: "Over, under, over all the way round: nothing can slide off. A knot remains."
   - "Your turn: Pick the marked answer to try it yourself."
3. Try 1-2 tip: "If, from one end, the rope is on top at every crossing it meets first, it falls apart." Try 3 tip: "The rope is perfectly slippery and cannot pass through itself: real ropes can jam, these cannot."
4. "See solution" replays the moves on the item, with dashed circles on each crossing and the same captions (k14_sheet.png). Clear.

### Problems
1. **The demo changes the rope with only a caption to say so.**
   - The rope in "Same shape, one crossing different" looks identical except for one gap.
   - The demo solves that copy to "No knot", then shows the original item and says "A knot remains".
   - Watching the frames, I first took this as one rope getting two opposite answers (k03_sheet2.png: frame 17 shows a rope with no crossings, frame 29 says "A knot remains").
   - A beginner who misses one caption will be confused about what was just proved.
   - Fix: show the copy beside the original, or tint the switched crossing and label it "copy, one crossing switched".
2. **The marked-crossing format arrives with no demo.** It first appears as Try 3: "Which marked crossing, switched, lets the rope fall open?" The rule is only on the Library page ("Switch one in your mind (the strand underneath goes on top) and pull again"), and the tip shown at that moment is about slipperiness (k10_try3.png). Add that one line as the tip, or a 5-second demo.
3. **The Try 1-2 tip is easy to misapply.** It is correct, but in Try 1 the rope from the lower end is on top at its first three crossings and is still a knot, because the fourth crossing it meets is first met from below (k06_try1.png). A beginner can read the tip as "starts on top → falls apart".
4. **Level text and stage text disagree.** "At this level: 5 crossings, strands far apart." against "Stage 1 settings: 6 crossings, strands far apart." (k21_summary.png).

### Suggested change
In the Watch demo, show the one-crossing-switched copy next to the original, so the "No knot" and "A knot remains" verdicts are clearly about two different ropes.

## Desktop 1366x768 (quick look)

- **Homing and Reckon:** two columns, the scene on the left and the circle, buttons and Confirm on the right. Everything fits, with key hints on the buttons ("Confirm Enter", "Pause Space") and "← → turn 5°, with Shift 1°" (d02_homing_watch2.png, d06_reckon_answer.png). Good.
- **Knots:** a large centred plate with wide answer buttons (d08_knots_item.png). Good.
- **Minor:** when a tutorial starts, the page scrolls so that the step bar (1 Watch / 2 / 3) and its Skip are above the fold, and the "Parts" glossary text shows at the top (d02_homing_watch2.png).

## Anything that looked broken (any screen)

1. **The first tap on the nav after closing the welcome pop-up is ignored.** On both 390x844 launches where I tapped only once, tapping the Library tab 0.6-0.9 s after closing the pop-up with × did nothing (p02_library.png). The second tap worked. On later launches I always tapped twice, so I cannot say whether it happens every time.
2. **The exercise counts disagree.** Today says "20 exercises in the Library"; the Library says "19 training exercises" (p01_open.png text vs p03_library.png text).
3. **A new profile shows dated achievements.** "Recent achievements" lists "Two baselines … 28 Oct 2026", "Both strategies … 26 Oct 2026", "Span 7 … 24 Oct 2026" under a small "Sample data" label (p01_open.png). It can look like someone else's record.
4. **Console:** no page errors. The only messages were WebGL "GPU stall due to ReadPixels" warnings, caused by my screenshots.
