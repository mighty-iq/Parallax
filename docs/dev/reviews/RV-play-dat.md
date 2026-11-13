# RV-play-dat: first-time player test of the DAT-style exercises

Tested on 13 Nov 2026, 19:10–20:20 UTC, on the build in `/home/claude/parallax` (Parallax v1.1.0, `index.html` via file://).

**Tester.** A fresh agent that had never seen the app. It used only the running app and read no source, docs or tests.

**Method.** Python Playwright drove the browser, and every answer came from screenshots. For the 3D figures I enlarged my own screenshots and measured the outlines in them, much as a person would hold a ruler to the screen.

**Devices.**
- Phone, 390×844 with touch, taps only: everything below.
- Small phone, 360×640: Hole Punch tutorial and a Form item.
- Desktop, 1366×768 with clicks: Library and the Openings tutorial.

All screenshots are in `/tmp/claude-0/-home-claude/145ff06a-4b5d-5025-8cb7-e87b9d56923b/scratchpad/rv-play/shots/`. In this file they are cited by file name only.

## Summary

| Exercise | Verdict | Try | Scored | Single change that would help a beginner most |
|---|---|---|---|---|
| Openings | Plays correctly within 2 minutes, but each item is slow (44–132 s) | 4/4 | 5/5 | Draw the solid much larger: it fills about a third of its box |
| Missing View | Plays correctly within 2 minutes | 4/4 | 5/5 | Hold the Watch on the dotted-line step, because Try 4 is decided by dotted lines alone |
| Angles | Plays correctly within 2 minutes | 5/5 | 5/5 (plus a 6th item answered wrong on purpose) | Letter the answer lists (A–D) so they cannot be confused with the angle numbers 1–4 |
| Hole Punch | Plays correctly within 2 minutes | 5/5 | 5/5 | Shuffle the answer slot in Try: all five Try answers were sheet 2 |
| Painted Cubes | Plays correctly within 2 minutes | 5/5 | 5/5 | Use a Watch example with a hidden cube, since every Try tip is about hidden cubes |
| Form | Needs more than 2 minutes | 4/4 (98–150 s each) | 4/5 | In the Watch, show the two foil types the Try items use: a mirror image, and a wrong-size solid with the too-long edge highlighted |

The two worst problems are elsewhere:
- **Section review on phones.** The show-me controls (Pause, Step, Replay, Close) sit underneath the bottom tab bar, so a tap there leaves the review.
- **DAT-style focus switch.** Turning it on has no visible effect.

Both are described below.

## Problems shared by all six tutorials

1. **The end of the Watch step is a dead end.**
   - What the screen shows:
     - The top line changes to "Now answer it yourself. It is practice and never counts."
     - The demo item stays on screen with its answer outlined.
     - The step tab still reads "1 Watch".
     - There is no button.
   - You have to work out that you should tap the outlined answer yourself. Only then does "Try it" appear.
   - The time shown for that tap includes the demo's playback: Openings reported "Correct 69.7 s" (`p11-op-after-watch.png`, `p13-op-tap2-after-watch.png`). Missing View showed 17.6 s, Angles 14.3 s and Painted Cubes 20.4 s, each for a single tap made a few seconds after its demo ended.
   - This may be the "time counting looks bugged" report. It is practice only, but the number is misleading.
2. **The Watch is fast, although the line above it says "one item solved slowly, with captions".**
   - Run times:
     - Missing View: 12.7 s for 7 captions.
     - Angles: 11.5 s.
     - Hole Punch: 12.4 s.
     - Painted Cubes: 9.9 s.
     - Form: 10 s.
   - That is about 1.7 s per caption (strips `p41-mv-watch-strip.png`, `p61-an-watch-strip.png`, `p81-hp-watch-strip.png`, `q04-pc-watch-strip.png`, `q31-fo-watch-strip.png`).
   - Pause, Step and Replay exist, but a beginner learns that only after missing the captions.
3. **The caption and control bar cover the lower answer options during the Watch.**
   - On a 390 px phone it hides drawings 3–4 in Missing View and sheets 4–5 in Hole Punch (`p41-mv-watch-strip.png`, `s04-hp-watch-mid.png`).
   - On desktop at 1366×768 it covers the openings row in Openings (`d04-op-watch-desktop.png`).
4. **Try pages are taller than the screen once the Tip box is shown.**
   - Phone (844 px tall):
     - Missing View: 875 px.
     - Form: 884–905 px.
     - Hole Punch Try 5: 972 px.
   - Small phone: Hole Punch is 689 px on a 640 px screen.
   - Desktop: Openings is 809 px on a 768 px window.
   - The last options sit partly below the fold (`p42-mv-try1.png`, `p87-hp-try5-zoom.png`, `s07-hp-try1.png`, `d07-op-try1-desktop.png`).
5. **The Try sets look fixed, and some always use the same answer slot.**
   - Hole Punch Try answers were 2, 2, 2, 2, 2, and the demo answer was 3.
   - Openings Try answers were 4, 4, 4, 5.
   - The same Try 1 item came back on the fresh 360 px profile (Hole Punch, sheet 2) and on desktop (Openings, opening 4).
   - Scored answers were varied: Hole Punch 2, 3, 4, 5, 5.
6. **Session summaries show internal parameter text** (`p38-op-end.png`):
   - Openings: "At this level: Features 2 + 1 + 1, edges straight, fitting face front, sometimes side, pose upright, foils features."
   - Missing View: "...foils outline."
   - Angles: "Closest gap 6°, size class right, pair that decides extremes, pose aligned."
7. **Pause is disabled while feedback is shown** (`p36-op-pause.png`). To end a session early you tap Next, then Pause, then "End session".
8. **Positive points.**
   - Feedback names each foil: "A feature differs", "Wrong size", "Mirrored", "Punch moved", "Wrong crease", "Lines do not line up", "No structure fits", "Mirror image", "Marks do not fit".
   - A wrong answer replays a show-me automatically.
   - Tips change from one Try item to the next.

## Openings (EX-14)

**Verdict.** Plays correctly within 2 minutes. The rule is clear from the "How to play" sheet and a 45 s Watch, but each item needed careful study (my times: 121, 167, 96 and 105 s in Try; 61.5, 50.0, 43.9, 132.2 and 46.5 s scored).
- **Try:** 4/4.
- **Scored:** 5/5.

**What the tutorial shows.**
- The "How to play" sheet has these sections: "Solid / Rules / Exact fit / Openings / Ways to solve it" (`p07-openings-howto.png`, `p08-openings-howto-bottom.png`).
- Watch captions include "Turn it first if needed, then slide it straight through." and end with "Turned to match: that is opening 2."
- Try tips move through:
  - "Start with the face nearest you…"
  - "Any face can fit now: check the front, the side and the top outline in turn."
  - "Mostly the top now…"
- The Go page reads "Openings: ready … Start a session with Openings / Free play / Back to the Library" (`p24-op-go.png`).

**Problems.**
1. **The solid is small.**
   - Phone: about 125×110 CSS px inside a 358×260 box (`p14-op-try1.png`, `p25-op-s1.png`). One-unit notches and the bottom chamfers can only be read when zoomed (`p15-op-try1-zoom.png`, `p21-op-try4-zoom.png`).
   - Desktop: about 170 px inside a 960×305 box (`d07-op-try1-desktop.png`).
2. **Option numbers overlap the shapes.** When a black shape touches its top-left corner, the number is drawn on top of it and is hard to read: "1", "2", "4" and "5" in `p21-op-try4-zoom.png`, "3" in `p25-op-s1.png`.
3. **Scored items drop the question.** Only "SOLID" and five openings are shown (`p25-op-s1.png`). The full question is present only as hidden text for screen readers.
4. **The solution animation does not turn the outline.** It runs for about 6 s and ends with "Turned to match: that is opening 2.", but the outline in the SOLID box is still the mirror image of opening 2. Only the dashed overlay on the option has been turned (`p28-op-sol-r00.png`, `p29-op-sol-strip.png`).
5. **The DAT disclaimer appears twice in one sheet.** There is a blue "Also in tests: …" box, then a grey paragraph repeating "Parallax has not measured any effect on DAT scores" (`p07-openings-howto.png`, `p08-openings-howto-bottom.png`).

**Suggested change.** Draw the solid to fill its box, at least twice the current size on phones, and move the option numbers off the shapes.

## Missing View (EX-15)

**Verdict.** Plays correctly within 2 minutes (Try: 40.7, 18.6, 43.3 and 30.3 s; scored: 14–24 s).
- **Try:** 4/4.
- **Scored:** 5/5.

**What the tutorial shows.**
- The "How to play" text is clear: "The end view looks at the right side of the structure, so the front is on its left." and "A dotted line is an edge hidden behind nearer cubes."
- The Watch draws projection lines and a small 3D model. Its captions run from "The missing view goes here, at the same scale." through "Dotted: edges hidden behind nearer cubes." to "That is drawing 1."

**Problems.**
1. **The dotted-line caption is on screen for about 2 s** (`p41-mv-watch-strip.png`).
   - Try 4 has four drawings with exactly the same outline, so only the dotted lines decide it (`p47-mv-try4-zoom.png`).
   - The wrong drawings are labelled "No structure fits" or "Lines do not line up", without saying which line is wrong.
2. **The bottom drawings are covered or cut off.**
   - During the Watch, the caption bar covers drawings 3 and 4.
   - In Try, the page is 875 px tall and drawings 3 and 4 sit partly below the fold (`p42-mv-try1.png`).
3. **"See solution" appears after some correct answers but not others** (it was missing after scored item 3). When it appears it is good: "One structure with these views" shows a 3D model (`p55-mv-sol-07.png`).

**Suggested change.** Keep the Watch on the dotted-line step until the player taps, and point to the decisive line in the feedback.

## Angles (EX-16)

**Verdict.** Plays correctly within 2 minutes (about 10–14 s per item; the first Try took 14.5 s).
- **Try:** 5/5.
- **Scored:** 5/5.

**Problems.**
1. **Answer numbers and angle numbers use the same digits.** For example: "So the order is 3 – 4 – 2 – 1: answer 2." (`p61-an-watch-strip.png`).
2. **The header badge is cut off on a 390 px phone:** "perceptual-judgement pract…" (`p62-an-try1.png`).
3. **Response times use mixed formats:** "9.82 s", "11.5 s", "54.1 s".

**What works.** The wrong-answer feedback is excellent. It reads "Incorrect 9.87 s / The right answer is marked ✓." and then plays an overlay show-me: "Answer 4 puts angle 3 before angle 2, but angle 3 is the larger one." (`p75-an-wrong.png`, `p76-an-wrong-show-03.png`).

**Suggested change.** Label the answer lists A–D.

## Hole Punch (EX-17)

**Verdict.** Plays correctly within 2 minutes (Try: 19.9, 15.6, 42.0, 23.2 and 21.0 s; scored: 11–18 s).
- **Try:** 5/5.
- **Scored:** 5/5.

**What the tutorial shows.**
- The "How to play" text explains the dashed outline, the shaded flap, the arrow, and filled versus open circles. It adds: "All five have the same number of holes".
- The Watch ends with "Flat again. Sheet 3 has exactly these holes."

**Problems.**
1. **Every Try answer is sheet 2.** See shared problem 5.
2. **Try 3 jumps to a slanted corner fold, but the Watch shows only straight folds.**
   - The Try 3 tip reads: "A corner fold covers only part of the paper: only a hole punched through the corner flap gets a twin."
   - I needed 42 s (`p85-hp-try3-zoom.png`).
3. **The fold panels are small:** about 100 CSS px each on a 390 px phone and about 80 px on a 360 px phone (`p82-hp-try1.png`, `s07-hp-try1.png`).
4. **Try 5 (three folds) is 972 px tall,** so sheets 4 and 5 sit below the fold (`p87-hp-try5-zoom.png`).

**Suggested change.** Shuffle the answer slot in the Try items, and add one slanted fold to the Watch.

## Painted Cubes (EX-18)

**Verdict.** Plays correctly within 2 minutes (Try: 30, 23, 20, 36 and 14 s; scored: 11–25 s).
- **Try:** 5/5.
- **Scored:** 5/5.

**What works.**
- The rules are clear: "painted on every face that shows on the outside, except the faces resting on the ground".
- The figures are large, with good contrast (`q05-pc-try1.png`).
- The solution goes through the cubes one by one: "Cube 1 is hidden under the cube above it: 2 painted sides (back, left)." (`q20-pc-sol-03.png`).

**Problems.**
1. **The Watch example has no hidden cube,** yet the Try tips are about hidden cubes: "Taller columns hide the cubes under them. Each hidden cube still counts…".
2. **The overlay that marks hidden cubes is busy.** Dashed outlines with numbered badges overlap the cubes in front of them (`q13-pc-try5-fb.png`). It is still readable.

**Suggested change.** Use a Watch example with one hidden cube.

## Form (EX-19)

**Verdict.** Needs more than 2 minutes. The rules are easy to read, but the 10 s Watch shows only a cuboid and the landmark method:
- "Landmark: face A in the pattern."
- "In solid 2, the same face sits here, with the same neighbours."
- "Its neighbours match too: B, C."

The Try items, by contrast, depend on mirror-image and proportion foils.
- **Try:** 4/4, but each item took 110, 116, 150 and 99 s.
- **Scored:** 4/5 (79.5 s wrong, then 80.5, 62.3, 93.0 and 97.4 s).

**Problems.**
1. **Try 1 already mixes foil types.** It is a triangular prism with a "Wrong size" foil and a "Mirror image" foil (`q32-fo-try1-zoom.png`). In Try 3, a rectangular pyramid, two foils are told apart only by handedness (`q35-fo-try3-zoom.png`).
2. **Wrong-size foils are very hard to judge at phone size.**
   - They differ by about 30 % along one edge, on solids about 100 CSS px across.
   - My wrong answer was a solid with correct marks and correct handedness that turned out to be "Wrong size". The correct solid showed only the fully shaded end face, which carries no orientation information.
3. **The wrong-answer show-me does not point to the problem.** It reads "Solid 1 has the wrong proportions: one side is longer than in the pattern." but does not show which side (`q41-fo-wrong-03.png`).
4. **The See solution badges hide the solid on a phone.** The A, B and C badges cover most of it, and the "✓ Folds from it" label covers its base. Foils get only their labels (`q46-fo-sol-05.png`).
5. **The new-exercise offer understates the time.** It says "Watch, Try, Go shows how it works in about a minute" (`s13b-form-new-offer.png`), but each Try item took 1.5–2.5 minutes.
6. **The summary median is unlabelled.** It shows "5 items · 4 right · median 86.7 s" (`q47-fo-summary.png`). That is the median of the 4 right answers; over all 5 items it would be 80.5 s. Angles works the same way. The label does not say that wrong answers are left out.

**Suggested change.** Add a Watch step, or Try 1 feedback, that shows both foil types:
- flip a mirror-image solid to show that it does not match;
- highlight the too-long edge on a wrong-size solid.

The proportions show-me should highlight that edge too.

## Section practice (mini, form 1)

**What works.**
- The setup page is clear (`q50-sec-start.png`).
  - It lists the parts in order and "One clock for the whole section: 30 items in 20 minutes, about 40 seconds an item".
  - It explains the rules: "No feedback until the end. Skip, flag and go back…".
- Each part opens with an intro card that stops the clock (`q51-sec-part1.png`).
- **The clock is correct:**
  - It counted 19:45 → 19:40 over a 5 s wait.
  - It held at 18:59 for 4 s while paused.
  - "Time used 1:01 of 20:00" in the review matches the clock.
- Answering moves on. Back, Flag (it becomes "Flagged"), Items and Skip all work.
- The Items row shows a chip per item: answered, flagged (⚑), skipped (dashed) and current, plus "End this part" (`q55-sec-items.png`).
- Pause offers "Resume / Skip this item / End the section". Ending asks for confirmation: "End the section now? … The clock is stopped while you decide." (`q57-sec-end-confirm.png`).
- The review shows:
  - Right 1 of 30, Answered 3 of 30.
  - A per-part table that marks parts as "not reached".
  - "Items to look at again" with chips. Each item opens with my answer and the right one marked, then plays the show-me (`q58-sec-review-full.png`, `q59-sec-review-item1.png`, `q60-sec-review-item1-b.png`).
  - An unanswered item asks "Answer it now to see the solution." (`q63-sec-review-item4.png`).

**Problems.**
1. **Bug on phones: the review's show-me controls are under the tab bar** (`q62-sec-review-showme.png`).
   - While a review item replays its show-me, the controls bar (Pause, Step, Replay, Close at y 792–836) lies underneath the fixed bottom tab bar.
   - Checking which element is on top at those points returned "Today", "Library", "Log" and "More".
   - So a tap meant for Pause or Close leaves the review. Only the caption line above the tab bar is visible.
2. **The results table is cramped on 390 px.** The Answered and Time columns run together ("1/5   3 1:01   15 s"), which can read as "31:01" (`q58-sec-review-full.png`).
3. **Skip is styled as the main button** (filled teal), while answers are given by tapping the options. A beginner may take Skip for "Next" (`q52-sec-item1.png`).
4. **The "Start part 1" button shows a keyboard hint ("Enter") on phones** (`q51-sec-part1.png`).
5. **An item left unanswered when the section ended is labelled "skipped":** "Part 1 · item 4: skipped" (`q63-sec-review-item4.png`).

## DAT-style focus switch

**Behaviour.**
- The switch toggles. Tapping the label "DAT-style focus" also toggles it, and the text changes between "Off" and "On" (`q70-focus-off.png`, `q71-focus-on.png`).
- The switch control itself is 44×24 px, below the 44 px height rule. The label makes the tap area wider but not taller.
- The copy says: "On: these formats join Train and Today's plan. Off: they stay here, in Free play and in Section practice."

**Problem: no visible effect.** With the switch On:
- Today's session still listed "Rotate · Fold · Spin", also after reloading the app (`q72-today-focus-on.png`, `q73-today-focus-on-reload.png`).
- "Choose exercises" opened the Library.
- There was no confirmation of what changed.

A player cannot tell whether the switch worked. It may only change the plan from the next day, or after the new-player starter plan. If so, it should say so.

## Small phone (360×640)

- The "How to play" sheet scrolls fine (`s03-hp-howto.png`).
- **Watch:** sheets 4 and 5 are hidden under the caption bar (`s04-hp-watch-mid.png`).
- **Try:** the page is 689 px tall, so sheets 4 and 5 sit below the fold (`s07-hp-try1.png`). The feedback screen scrolls into place correctly (`s08-hp-try1-fb.png`).
- **A Form scored item fits fully** on screen with four 160 px boxes (`s14-form-item-small.png`).
- **Help** during an item opens a popover with the question and tip. It covers the pattern (`s15-form-help.png`).
- **"Practise" on an unplayed exercise** opens a sheet (Train with focus / Path / Speed / Free play / Challenge a friend). Starting a session then offers "New: Form … Watch, Try, Go" or "Skip". Good.

## Desktop (1366×768)

- The Library and the DAT-style group read well (`d03-library-dat.png`).
- In the Watch, the rules appear inline above the item, which is good.
- **The control bar covers the openings row during the Watch** (`d04-op-watch-desktop.png`).
- **The solid is about 170 px wide inside a 960×305 box,** and the Try page is 809 px tall in a 768 px window (`d07-op-try1-desktop.png`).
- Clicks and the feedback work (`d08-op-try1-fb-desktop.png`).
- **The header highlights "Today"** while I am in a tutorial that I opened from the Library (`d06-op-watch-end.png`).

## Other things that looked broken or odd

- **Exercise counts disagree.** Today says "20 exercises in the Library"; the Library says "19 training exercises" (`p01-open.png` text, `p03-library.png`).
- **A fresh profile shows "Recent achievements · Sample data"** with dated entries such as "Two baselines … 28 Oct 2026" and "Span 7 … 24 Oct 2026". The "Sample data" label is easy to miss.
- **The console was clean.** No page errors appeared in any session, only WebGL "GPU stall due to ReadPixels" performance warnings.

## Limits of this test

- I am an agent reading screenshots. On 3D figures (Openings, Form) my times are probably slower than a person glancing at the screen; on flat figures they are similar.
- I did not test sound, real touch gestures beyond taps, or keyboard play.
- I answered the section items by quick guesses; only the mechanics were under test.
