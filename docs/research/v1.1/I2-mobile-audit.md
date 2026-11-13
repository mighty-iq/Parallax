# I2: Parallax on phones, an audit of v1.0.0

> Investigation only (no code changed). Brief item 5: "Make mobile experience better, for example make homing usable on it". Tested: the frozen copy of the released v1.0.0 (main f10f7db), opened from `file://` in headless Chromium through Python Playwright, every run through `tests/e2e/pwslot.sh`. Scripts, raw JSON and about 300 screenshots: `/tmp/claude-0/-home-claude/145ff06a-4b5d-5025-8cb7-e87b9d56923b/scratchpad/v11-audit/mobile/` (`shots/` for the pictures).

## 1. Method

**Viewports.** 360 × 740, 390 × 844 and 412 × 915 portrait, and 844 × 390 landscape; device pixel ratio 2, `is_mobile` and `has_touch` (so `(pointer: coarse)` and `(hover: none)` match, `maxTouchPoints` is 1, and the meta viewport is honoured). Light theme unless noted.

**What was run.**
| Script | What it does |
|---|---|
| `screens_crawl.py` | Every app screen at the four viewports, on a new record and on a simulated six-week record (the `SIM` learner from `tests/e2e/screens.py`): the welcome pop-up, the tour offer, Today, the More sheet, Library, the practise sheet, the exercise pages of Homing and Rotate, Progress, Log, Lab, Settings, About, the share sheet, the Daily Challenge intro and the Spatial Check intro. |
| `ex_crawl.py` | Every training exercise in the app: Watch, Try, Go (the demo, the demo item answered, a Try item, its reveal and automatic show me), then a scored item in Free play (a screenshot during the stimulus for Track, Homing and Span, the answer state, the reveal). Answers by tapping the options where the layout is a choice grid. |
| `check_crawl.py` | The Spatial Check: the intro, the expectations question, and for every probe its instruction card, the end of its worked example and its first scored item. |
| `homing_touch.py` | Homing played start to finish with touch only (taps, touch drags and touch scrolls through CDP), from the welcome pop-up to the session summary, on a new record. |
| `fps.py` | Frame intervals of the 3D exercises during their stimulus, at 1× and 4× CPU throttling. |

**What was measured** (in-page JavaScript, `lib.py`): horizontal overflow (`scrollWidth`, and any element past the edges that no clipping parent contains); interactive elements under 44 × 44 CSS px; visible text under 14 px (HTML by computed size, SVG text by its on-screen size, i.e. its font size times the screen transform); the boxes of the stimulus, the answer controls and the Confirm button in page coordinates against the viewport height; canvas sizes (CSS and buffer); fixed or sticky bars at the bottom; visible texts that name keys (Enter, Space, Esc, Shift, arrows, "press", "key").

**Caveats.**
- The heights above are the whole viewport. A real phone loses part of it to the browser: Safari on a 390 × 844 iPhone shows about 660–750 px of page (toolbars expanded or collapsed), Chrome on a 412 × 915 Android about 780–840 px. So every "below the fold" figure here is optimistic; a figure that only just fits at 844 does not fit on a real phone.
- WebGL is SwiftShader (software, in the GPU process). Frame rates are a worst case and say little about a phone GPU; CPU throttling slows the page's JavaScript, not SwiftShader.
- Emulation is not a phone: there is no pull-to-refresh, no address bar that collapses, no notch, no in-app browser and no "Add to Home Screen" here. Those parts of the report come from reading the code against documented browser behaviour (sources in §9).
- A trap worth knowing for future phone tests: **Playwright's full-page screenshot drops touch emulation** in this Chromium (afterwards `(pointer: coarse)` is false and `maxTouchPoints` is 0; checked in `dbg_fullshot.py`). An early run showed key hints on a "touch" screen because of it. `lib.shot()` now restores touch through CDP `Emulation.setTouchEmulationEnabled` after every full-page shot; the repository's own phone tests should do the same if they take full-page shots mid-test.

<!-- SUMMARY -->

## 3. Homing on a phone

**Can it be played start to finish by touch?** Yes, in the sense that no step needs a key: `homing_touch.py` went from the welcome pop-up (tap Start training) through the tour offer (Skip), the Library tab, the Homing card's Practise button (8 swipes down a 5.9-screen Library), the practise sheet (Train), the "New: Homing" card (Watch, Try, Go), the demo, the demo item, four Try items and the scored items, to Pause → End session and the summary, with taps, touch drags on the dial and touch scrolls only. A tap on the dial sets the arrow to the tapped angle; a drag along the ring follows the finger; the page never scrolled during a dial drag (`touch-action: none` with pointer capture); Confirm, Next, Show me again, Close and Pause all respond to taps. So the problem is not a missing control. **What makes Homing unusable on a phone is where things are and when:**

1. **The tutorial's first walk plays off the screen.** In the Watch step the step header (Watch / Try / Go, "Watch: one item solved slowly…", four labelled parts), the status strip, the goal, the session line ("This session: Homing, Rotate and Fold, about 20 minutes.") and the small-screen notice come first; at 390 × 844 the 3D view starts at **y 739**, so the demo walk (8–15 s) shows the top 105 px of the view: sky (`shots/p390_homingtouch_04_demo_0.png`). The player scrolls the view into place only when the explanation (show me) starts, after the walk is over.
2. **The demo's captions are not on screen.** Homing writes its captions into its own `.ex-caption` under the dial; while the demo runs, the bottom of the screen is the pinned Pause / Step / Replay / Close bar, and the caption is below it (`shots/p390_homingtouch_04_demo_2.png`, `p390_homing_A1_watch.png`). The Watch step is then a silent animation of a map.
3. **The answer does not fit with the view.** After the walk the dial and Confirm sit at y 713–908 (390 × 844) and 709–889 (360 × 740): 64 and 149 px below the bottom edge, about 160 px on a real 390-wide phone. Scrolling down to reach them pushes the top of the view off the screen, and the view is the feedback ("the view turns with the arrow"). Above the view, the goal, the tip and the notice take 270–330 px.
4. **The dial is small and coarse for a finger.** The ring is 136 px across (the dial box is `min(50vw, 27vh, 15rem)`); a 1° step is 1 px at the rim; the finger covers the arrow; there are no fine-step buttons (← → and Shift exist only as keys). At the hardest level the tolerance is ±20°. The ring's labels are 9.5–10.3 px ("ahead").
5. **Landscape hides the walk.** At 844 × 390 the view starts at y 315: 75 px of it, the sky, are on screen during the walk; the dial starts at the same height beside it (§8).
6. **The walk is voided easily on a slow device.** The rule (`FREEZE_MS = 400`: one frame gap over 400 ms, or more than 25 % slow frames) voided one of the touch run's walks under load (`"voided": "stutter"`, "The view stuttered during the route, so this answer will not count", shown twice: in the view and in the reading strip). Voided walks never count, and three in a row bring the "this device" notice. §7 has the frame-rate figures.
7. **The app tells phone users not to.** The Library tags Homing "larger screens", the exercise page and the player say it "works best on a larger screen", and a notice sits above the view on every item ("Homing is easier to judge on a larger screen (a tablet or a computer)…"). The rating is already kept per screen class (`perDisplay`), so a phone rating does not mix with a computer one; the warnings can become a one-time note once the phone layout is right.
8. **Smaller things.** The show-me map is drawn inside the 356 × 271 view, its labels 9–10 px. The reveal's notes ("The start was 131° to your left, 30 m away…") start under the sticky reading strip. Touch answers are logged with source `pointer`, not `touch` (the view calls `respond` without the pointer type), so the trial log cannot separate phone taps from mouse clicks for Homing and Orient. Pull-to-refresh is live on the view during the walk (§6).

**What Homing on a phone should look like** (details in §11): one screen that never scrolls: the view on top at a fixed share of the height (`dvh`), a one-line status strip over it, the goal and tips behind a "?" button, and the answer in the bottom, thumb-reachable part. Two ways to answer, both keeping the view visible: (a) turn the view itself, by dragging horizontally anywhere on it (the natural phone gesture, and literally "turn to face the start"), with the arrow circle as a small readout; (b) the arrow circle, larger (`min(78vw, 36dvh)`), with −5° / −1° / +1° / +5° buttons. In landscape: the view at full height on the left, the controls on the right. Captions go over the view as subtitles, or into the pinned bar. Both answer modes keep the response the same (degrees from the final heading), so scoring and validation do not change; the item model and the rating per screen class stay as they are, and the trial should log which mode was used.

<!-- SUMMARY-END -->

## 4. The app screens

**The good news first.** On every screen at every viewport: no horizontal scroll (no element past either edge), and no button, link, field, switch or segmented control under 44 × 44 px, apart from four inline DOI links in About's reference list (18 px tall; inline links are exempt from WCAG 2.5.8, but they are fiddly with a thumb). The tab bar (Today, Library, Progress, Log, More) is 57 px tall with the safe-area inset under it; sheets (More, Practise, Share) open from the bottom with large rows; the practise sheet is a model of a phone sheet. No page errors in any run.

**Page lengths** (document height in screens of the viewport; "data" = the simulated six-week record):

| Screen | 360 × 740 | 390 × 844 | 412 × 915 | 844 × 390 |
|---|---|---|---|---|
| Today (new / data) | 4.1 / 5.1 | 3.5 / 4.3 | 3.1 / 3.8 | 5.5 / 6.8 |
| Library (new / data) | 7.1 / 7.5 | 5.9 / 6.4 | 5.4 / 5.9 | 7.8 / 8.4 |
| Exercise page (Homing) | 5.9 | 4.8 | 4.3 | 8.0 |
| Progress (new / data) | 7.1 / **19.5** | 5.9 / **16.7** | 5.4 / **15.1** | 8.8 / **22.1** |
| Log (new / data) | 2.2 / 5.1 | 1.9 / 4.6 | 1.7 / 4.0 | 3.3 / 6.4 |
| Lab | 6.2 | 5.1 | 4.6 | 8.4 |
| Settings | 4.1 | 3.4 | 3.1 | 6.8 |
| About | 5.5 | 4.6 | 4.2 | 7.5 |

Progress with real data is 14 000 px of scrolling on a 390-wide phone (16.7 screens): profile, levels, the Spatial Check, transfer, curves, calendar, personal bests and the full achievement list, one after the other. Nothing is broken, but on a phone the screen people open most after a session is a long hunt. Today is 3–5 screens; its Start button is on the first screen in portrait (390 × 844: y 597–647), only just at 360 × 740 (y 634–682, directly above the tab bar, so below the fold once a browser's bars take their share), and not in landscape. In its session list the specimen line wraps into three short lines ("EX-02 · / Mental rotation · / Vz SR") in a 130 px column at 360 wide.

**Small text.** Text under 14 px is common and deliberate (the "specimen label" look): at 390 × 844 the largest groups are 12 px mono labels and separators (`.px-spec-code`, `.px-spec-sep`, 140 on the data screens), 11 px labels (the tab bar's labels are 11 px on every screen; calendar day keys `.px-day-k` / `.px-cal-k`, ruler numbers `.px-ruler-num`), 12 px numbers in the Log's session rows (`.px-sess-when`, `.px-sess-score`, `.px-sess-len`), 12 px verdicts in the Progress fingerprint (`.px-fp-verdict`, e.g. "unclear"), 12 px table heads in the Lab, and 12 px tags (`.px-tag`, e.g. "experimental"). Progress with data has 196 such text runs. `--fs-xs` is 0.75 rem (12 px) in css/base.css and is the culprit almost everywhere. Information a learner reads (session scores, verdicts, calendar days, tags, ruler numbers) should not be 11–12 px grey mono on a phone.

**The welcome pop-up** (standing rule 1). Fits on one screen in portrait at all three sizes, with the Join button, the address with Copy and Start training all visible. In landscape (844 × 390) it is taller than the screen and opens scrolled to its focused Start button, so its first line ("Parallax was built by the Chimera community…") and the illustration are above the top edge: the reader sees "community on Discord." as the first words (`shots/l844_01_welcome.png`). The small-height rule in css/app.css (`@media (max-height: 680px) and (max-width: 599px)`) never applies in landscape, because the width there is 844.

**Header during items.** The app header (brand and the Chimera Discord button, 52 px, `position: sticky`) stays on screen during every item; `data-chrome="focus"` hides only the footer and the tab bar (css/play.css). With the player's status strip (label, Pause, "item 1 of 3", the progress ruler: about 120 px at 390 wide) and the goal line, about 330 px of an 844 px screen are taken before the stimulus starts (stimulus top at y 336–354 in the crawl). On a real phone, with the browser's own bars, that is roughly half of the visible page.

**The Daily Challenge and the Spatial Check intros** fit on one screen in portrait. In landscape the Check intro is 1.2 screens and its Start button is below the fold; the header (with nav links, since the tab bar only shows under 720 px wide) stays on top.

**The share sheet** works and fits, but on a phone its main action is "Download PNG": a download is a poor way to post to Discord from a phone, and in-app browsers often block downloads (Discord's in-app browser is the system's Safari View Controller or Chrome Custom Tab). The Web Share API with files (`navigator.share({ files })`, Safari 15+ and Chrome for Android) opens the phone's own share sheet, with the Discord app in it.

**Key-only texts** on screens: none. The How to play sheet ends with "Keys: 1–9 pick · Enter confirm · Space next · Esc pause · S show me the solution." on touch screens too (js/ui/play.js `howTo`); the exercise texts are in §5.

## 5. The exercises and probes

### 5.1 The player's layout on a phone
Every item stacks, top to bottom: the app header (52 px, sticky), the status strip (specimen label and Pause; "Free play · item 1 of 3"; the progress ruler), the goal sentence (2–3 lines), often a Tip box (2–3 lines), sometimes an exercise notice (Homing's "easier on a larger screen"), then the stimulus, then the options or the custom controls. At 390 × 844 the stimulus starts at y 245–416 depending on how many of these are shown; the goal and tip alone take 150–300 px at 360 wide (`shots/p360_fold_B2_respond.png`: the goal is 3 lines, the tip 3 lines, and only half of the first option row is on screen).

### 5.2 Scored items: is the whole answer on screen?
How many px of the answer area (options, dial, Confirm) lie below the bottom edge, at the scroll position the player leaves when the item appears (scored item, Free play, adaptive settings; 0 = all visible). "Real 390" assumes the 390 × 844 phone shows about 750 px of page, which Safari does only once its toolbars have collapsed:

| Exercise | 360 × 740 | 390 × 844 | real 390 (≈750) | 844 × 390 landscape (answer area, y) |
|---|---|---|---|---|
| Rotate (pick two, 4 options + Confirm) | 203 | 144 | 238 | all below (465–711) |
| Spin (4 options) | 224 | 141 | 235 | all below (462–696) |
| Fold (4 options) | 192 | 0 (ends at 832) | 82 | all below (556–739) |
| Nets (2 options) | 0 | 0 | 0 | all below (470–558) |
| Slice (4 options) | 88 | 3 | 97 | all below (400–586) |
| Views (4 options) | 0 | 0 | 0 | all below (408–498) |
| Orient (dial + Confirm) | 103 | 46 | 140 | dial 272–629, Confirm below |
| Span (blocks + Confirm) | 0 | 0 | 0 | Confirm below (476–520) |
| Hidden (5 options) | 0 | 0 | 0 | all below (391–479) |
| Homing (dial + Confirm) | 149 | 64 | 158 | dial 315–656; the view 315–571 |
| Track (Confirm under the cube) | 42 | 0 | 0 | Confirm below (574–618); the cube 294–566 |

The items vary (the settings adapt), so a 2-option variant fits where a 4-option one does not: Rotate's same-or-mirror Try item fits at 390 (options end at 776), its pick-two scored item does not (988). The pattern is stable though: **every 4-option 3D or folding item and both dials need a scroll on a 360–390 phone**, and with a browser's bars (Safari shows about 660 px when its toolbars are expanded) nearly every item does. Choice cells are square (Rotate's are 172 × 172 px at 390 wide, with the figure using a fraction of the height; View Match's 172 × 172 cells hold pictures about 130 × 50), so two rows of options cost 350 px.

Scrolling to answer is more than a nuisance here:
- **the stimulus leaves the screen** when you scroll down to the options (Rotate's reference, Orient's map, Homing's view), so comparing means scrolling back and forth, which is a different task from the one the item models;
- **timed items** (Speed mode, timed Free play, every Spatial Check probe) keep their clock running while you scroll; the response time then includes the scroll;
- the reveal scrolls the marked options above the sticky reading strip (`marksIntoView`), which works, but the strip itself covers 106–131 px of the bottom (`.pl-feedback`, sticky), so the notes under the item (Homing's "The start was 133° to your right…") start under it (`shots/p390_homing_A4_try_reveal.png`).

### 5.3 Watch, Try, Go on a phone
- **The Watch step pushes the item off the screen.** The step header with the labelled parts (`.pl-parts`: five boxed paragraphs for Track, four for Homing) sits above the player. At 390 × 844 Track's demo stage starts at y 725 with its motion notice and Start button below the fold (`shots/p390_track_A1_watch.png`); Homing's header is 389 px tall. On desktop the CSS turns the parts into one inline legend (`@media (min-width: 720px)` in css/play.css); phones get the full list.
- **The demo's captions are not on screen.** During a demo (state `showme`) phones switch the reading strip to `position: static` so it does not cover the options (css/play.css, `max-width: 599px`), and pin only its buttons (Pause, Step, Replay, Close) to the bottom. The caption lives in that strip, so it flows below the item, under the pinned buttons: in Homing's demo at 390 × 844 the caption box is at y 840–891 of 844 while the buttons occupy the bottom 60 px. The demo is then a silent animation. (`captions.py` measures this for every exercise; see §5.5.)
- Try items show the goal and a tip above the item, so the Try item sits 90–110 px lower than a scored one (Fold's Try item needs 92 px of scroll at 390 × 844, Slice's 198, Orient's 220, Homing's 147).

### 5.4 The Spatial Check probes (timed)
At 390 × 844 (`check_crawl.py`): Cube Match (2 answers) fits (521–595); **View Match's four pictures end at 879, so the last row needs a scroll while its 30 s clock runs** (`shots/p390_check_02_viewmatch_item.png`); Mechanisms fits (643–735); Patterns fits (grid and Confirm 310–605); Words fits (433–621); Level (optional probe) is in the 360 run below. On a real phone with the browser's bars, View Match, Mechanisms and Words need a scroll too. Two consequences for measurement (standing rule 10):
- a probe answered on a phone is partly a scrolling task, so a baseline taken on a computer and a check taken on a phone are not comparable;
- **neither the check record nor the session record stores the screen class** (`rec.assess[]` holds `{ date, form, kind, results }`; sessions hold no `display`), so the report cannot even tell them apart. Track and Homing ratings are kept per screen class (`perDisplay`), the Check is not.

### 5.5 Small text inside the stimuli
SVG labels are sized in their drawing's units, so they shrink with the drawing (on-screen sizes from `ex_crawl.py`, 360 / 390 / landscape):
- Orient: the object names on the map 11.7 / 12.8 / **7.5 px**, the badges 9.5 / 10.3 / **6 px**; the dial's top label 10.3 / 11.2 px.
- Homing: every show-me map label (start, landmarks, turn sizes, the answer angle) 9 / 9.8 / 8.6 px; the dial's "ahead" 9.5 / 10.3 px. The map is drawn inside the 356 × 271 view, so it is small to begin with (`shots/p390_homing_A4_try_reveal.png`).
- Span: the "wrong" marks 9.8 / 10.7 px; in landscape the block labels 8.9 px and the numbers 8.5 px.
- Mechanisms (probe): labels 11 px. Track's sphere numbers are 13 px (CSS).

The CSS comment in css/ex/homing.css says the side labels stay "≥ 12 px on a 360 px phone"; they do (12.5 px), but the other labels were not sized the same way.

### 5.6 Instructions that name keys
The texts mostly say both ("tap them or press their numbers"), so nothing is key-only in a way that blocks, but phones see key talk they cannot use: the How to play sheet's "Keys: 1–9 pick · Enter confirm · Space next · Esc pause · S show me" line; captions such as "So the answer is Same cube (key 1)" (Cube Match), "Answer with the keys 1 to 4, or tap a word" (Words), "When you are done, press Enter or Confirm" (Patterns), "To answer, set the arrow: drag or tap the circle, or use ← → (Shift: 1°). Then Confirm or press Enter" (Orient, Homing); Track's parts list ("Esc or Pause stops everything"); Homing's own pause note "Press Esc or Space to go on" (shown only after Esc, so a keyboard user). The key chips on buttons (`.px-kbd`) are hidden on touch screens by `(hover: none) and (pointer: coarse)` (css/play.css), which works. In landscape the status strip still shows a Keys button (it is hidden by width, `max-width: 599px`, not by pointer type).

## 6. Gestures

| Gesture | What happens in v1.0 | Where |
|---|---|---|
| Pull-to-refresh (Chrome for Android, Safari on iOS 15+) | Not prevented: `html` and `body` have `overscroll-behavior-y: auto`; only modals set `contain`. A downward drag at the top of the page reloads Parallax, mid-item included (the item is lost, the session is saved, the welcome pop-up returns). Items start at scroll 0, so a drag down on a 3D view (people try to "look around") is exactly that gesture. | css/base.css |
| Double-tap zoom (Safari) | `touch-action` is `auto` on `html`, `body` and the option buttons (`.px-choice`); only the 3D canvas, Track's stage, Span's board and the Patterns grid set `manipulation`. Two quick taps on an option or a button can zoom the page on iOS. | css/base.css, css/ex/*.css |
| Pinch zoom | Allowed (no `user-scalable=no`), which is right for accessibility; a zoomed page during an item is the learner's choice. | index.html |
| Scrolling during a drag | The two dials (Homing, Orient) set `touch-action: none` and capture the pointer: dragging the arrow never scrolls the page (checked by touch drags in `homing_touch.py`, §3). | css/ex/homing.css, orient.css |
| A tap that was meant as a scroll | Single-choice options answer on `click`. When the options do not fit (§5.2), people scroll by dragging on the options themselves; a short drag that the browser reads as a tap answers the item. | js/core/ui.js `choiceGrid` |
| Swipe on the 3D view | Nothing: no 3D view can be turned or dragged, so the swipe scrolls the page (or, at the top, pulls to refresh). | stage3d.js |
| Long press | Buttons set `user-select: none`; option buttons do not set `-webkit-touch-callout: none`, so a long press on an option can start a text selection or a callout on iOS. | css/base.css |
| Turning the phone mid-item | Not handled. CLAUDE.md lists "device turned" as a void reason, but no code listens for `orientationchange` or a change of screen class; the canvas just resizes (stage3d's `resize` listener). A Track or Homing trial that starts in portrait and ends in landscape counts, with half of the stimulus off-screen (§8). | js/ui/play.js, stage3d.js |

In iOS Safari `overscroll-behavior` does not stop pull-to-refresh (WebKit bug 275947, open since iOS 16, still so on iOS 18), so the reliable fix there is an item screen that does not scroll at all, plus `touch-action: none` on stimulus areas where a drag means something.

## 7. 3D canvases and frame rate

**Sizes.** One WebGL canvas (stage3d) sized by CSS, buffer at device pixel ratio 2 (the cap), antialiasing off on phone-sized screens, as ARCHITECTURE.md §4 says. CSS size (buffer) of the main 3D view in the scored item:

| Exercise | 360 × 740 | 390 × 844 | 844 × 390 |
|---|---|---|---|
| Rotate (reference) | 326 × 178 (652 × 356) | 356 × 193 (712 × 386) | 794 × 150 (1588 × 300) |
| Slice | 326 × 221 | 356 × 240 | 794 × 158 |
| Views | 326 × 236 | 356 × 255 | 794 × 166 |
| Homing | 326 × 250 | 356 × 271 | 498 × 238 |
| Track | 326 × 336 | 356 × 365 | 794 × 270 |

Rotate's four option pictures are 155 × 155 snapshots at 390 wide (rendered through the same context in the ready phase, as designed). The portrait sizes are reasonable for the figures; Homing's 356 × 271 first-person view is the smallest relative to what it has to show (a 74° field with distant landmarks and ground texture), and Track's cube fills the width. In landscape the canvases become wide strips (794 × 150) that waste most of their area.

<!-- FPS -->

<!-- CHUNK-4B -->

## 8. Landscape (844 × 390)
Landscape gets the desktop layout: the tab bar only shows under 720 px wide, so the header grows nav links (Today, Library, Progress, Log, More) and stays sticky; the status strip gains a Keys button (it is hidden only under 600 px wide, not on touch screens); the goal and the tip run full width. Before any stimulus, 200–315 px of the 390 px screen are gone (`shots/l844_rotate_B2_respond.png`, `shots/l844_homing_B1_present.png`):

| Exercise | The stimulus (y) | The answer (y) | On screen at the start |
|---|---|---|---|
| Rotate | 273–425 (reference 794 × 150) | 465–711 | the top 117 px of the reference, no option |
| Slice | 200–360 (794 × 158) | 400–586 | the stimulus, no option |
| Views | 200–368 (794 × 166) | 408–498 | the stimulus, no option |
| Hidden | 200–350 | 391–479 | the stimulus, no option |
| Orient | 200–544 | dial 272–629 | half the map, the top of the dial, no Confirm |
| Span | 273–468 | Confirm 476–520 | half the board |
| **Track** | **294–566 (794 × 270)** | Confirm 574–618 | **96 px of the cube while the spheres move** |
| **Homing** | **315–571 (498 × 238)** | dial 315–656 | **75 px of the view (the sky) during the walk** |

So in landscape the two motion exercises play their stimulus almost entirely below the edge of the screen, and every item needs a scroll before it can be answered. Wide 3D canvases are also wasted: a 794 × 150 strip shows a figure that a 150 × 150 square would show as well. Landscape is where a first-person view (Homing) and a wide field (Track) would be at their best on a phone, so it deserves its own layout rather than the desktop one: stimulus left, answers right, no header, a one-line status strip. Until then, a rotate-to-portrait hint during items would be honest. The welcome pop-up's landscape problem is in §4.

## 9. Where Parallax gets opened: Discord, the home screen, the notch

### 9.1 Discord's in-app browser
Discord's phone app opens links in its in-app browser unless the user changes App Settings → Web Browser to External Browser; the in-app browser is the system's browser in its embedded mode (Safari View Controller on iOS, a Chrome Custom Tab on Android). For a link to Parallax's GitHub Pages site this means:
- **On iOS the progress stays inside Discord.** Safari View Controller keeps its own website data, separate from Safari. Someone who starts in Discord and later opens Parallax in Safari or from the home screen finds an empty record and reasonably concludes that progress was lost. (On Android a Custom Tab shares Chrome's storage, so there it carries over.)
- **No "Add to Home Screen" from there**, and downloads (backup file, PNG card) are awkward or blocked; Copy works, which Parallax already offers everywhere.
- The in-app browser cannot be detected reliably (same user agent as Safari or Chrome), so the remedy is a calm, one-time line rather than a block: "Opened from a chat app? Your progress is saved in this browser only. To keep it, open Parallax in Safari or Chrome, or add it to your home screen, and back up from Settings." It belongs in the welcome pop-up's small print or the storage banner area, shown on touch devices that are not in standalone mode.

### 9.2 Safari's seven-day rule
Safari deletes all script-writable storage (localStorage included) of a site that the user has not interacted with during seven days of Safari use; Home Screen web apps keep their own counter and their first-party data is not expected to be deleted (WebKit, March 2020). Parallax's whole record is one localStorage key. A learner on an iPhone who pauses for two weeks of normal Safari use can come back to an empty record, unless they backed up. The backup reminder exists (Settings, "Last backup"); on iOS it deserves more weight, and `navigator.storage.persist()` (available here, unused) is worth requesting.

### 9.3 Add to Home Screen
`index.html` has no web app manifest, no `apple-touch-icon` (the only icon is an SVG data-URI favicon), no `apple-mobile-web-app-capable`/`-title`, no service worker, one light `theme-color` (#F2F4F3, also in dark mode) and `viewport-fit=cover`. So:
- Android Chrome can only make a shortcut that opens a normal tab (no standalone window, no install prompt); the menu install needs a manifest with a name, icons (192 and 512 px), `start_url` and `display` (no service worker is needed for the menu install since Chrome 108 on mobile; the automatic prompt still wants one).
- iOS makes a bookmark whose icon is a screenshot of the page and which opens in Safari, not full screen.
- Without a service worker the home-screen icon of the GitHub Pages site does not open offline once the browser cache is gone. The single-file build (dist/Parallax.html) is the offline answer on computers; on phones a local HTML file is hard to open (iOS Files previews it without running scripts).
- Constraints from CLAUDE.md rule 6: a `<link rel="manifest">` on `file://` makes Chrome log a CORS error (the e2e tests fail on console errors), and "no workers from files" rules out a service worker as a requirement. Both can be added as progressive enhancements that only switch on under `https:` (a small script that inserts the manifest link and registers a cache-first worker for the GitHub Pages copy), but that is the owner's call because it bends rule 6's wording.
- A full-screen home-screen app also needs the top inset handled (status bar) and a dark `theme-color` (`<meta name="theme-color" media="(prefers-color-scheme: dark)" content="#1B1F23">`).

### 9.4 Safe areas (the notch)
With `viewport-fit=cover` the page runs under the notch and the rounded corners, and only the bottom inset is handled (`env(safe-area-inset-bottom)` on the tab bar, the reading strip, the show-me bar, sheets and toasts). Emulating an iPhone's insets (CDP `Emulation.setSafeAreaInsetsOverride`, `readiness.py`):
- **Landscape (47 px left and right):** the brand button reaches 29 px into the left inset, the More button 23 px into the right one, and every page and player element (headings, the status strip, Pause, the goal, the tip, the 3D canvas) 22–24 px into both, i.e. partly under the notch or the corner curve (`shots/l844_safearea_rotate.png`). The 16 px gutter is smaller than the 47 px inset.
- **Portrait:** the bottom inset is respected by every fixed bar; nothing important sits in it except scrolling content. The top inset matters only in a future full-screen mode.
- Fix: `padding-left: max(var(--gutter), env(safe-area-inset-left))` and the same on the right for `.px-wrap`, the header, the tab bar, the fixed show-me bar and the sheets.

## 10. What well-regarded mobile training and puzzle apps do (ideas, not prescriptions)
- **One screen per item, nothing to scroll.** Phone brain-training games put the stimulus in the upper part and the answers in the lower, thumb-reachable part, sized to the screen, with the game chrome reduced to a thin bar (score or progress and pause) and the app navigation hidden. Most people hold a phone in one hand and work with the thumb (Hoober 2013), so the bottom half is where answers belong.
- **Select, then confirm, with a sticky bottom button** (the language-learning pattern: a full-width "Check" anchored to the bottom, feedback sliding up as a sheet). Parallax already has the sheet (the reading strip); the confirm step matters on phones only where a tap could be a scroll.
- **First-person navigation games answer with the whole screen.** Sea Hero Quest, the mobile game used to measure navigation in millions of people, steers by tapping the left or right half of the screen and changes speed by swiping; its path-integration levels end with the player shooting a flare back towards the start, chosen **from three proposed directions** (Coutrot et al. 2018), a deliberately coarse answer for a phone.
- **Turning a scene by dragging it** (panoramas and map apps: drag to look around, two fingers to rotate a map) is the gesture people try first on a 3D view; a compass dial in a corner is a desktop idea.
- **Precision under the finger**: a magnifier or an offset handle (as in text selection), or fine-step buttons next to a coarse drag, so the finger does not hide what it sets.
- **"Magic window"**: turning the phone itself to look around (device orientation). For Homing this adds body-based cues, which makes it a different task (closer to real homing, research B §10), so it would be a separate, clearly labelled variant with its own rating; it also needs a permission prompt on iOS and HTTPS.
- **Landscape for wide 3D scenes**, portrait for everything else, and a gentle "turn your phone" card instead of a squeezed layout.

## 11. Prioritised fix list

P1 = makes a phone session work; P2 = clear improvement; P3 = polish. "Files" are where the change most likely goes; each change still needs the e2e phone checks extended (below).

| # | Pri | Screen | Problem | Fix | Files |
|---|---|---|---|---|---|
| 1 | P1 | Every item | Header (52 px), status strip (~120 px), goal (2–3 lines) and tip (2–3 lines) stack above the stimulus; answers end up below the fold (§5.1–5.2). | A phone "focus" layout: while items run, hide the app header too (`data-chrome="focus"`), fold the status strip into one 44 px row (label · n of N · Pause), show the goal only on an exercise's first item in a session (then behind a "?" button), and show tips as one dismissible line. | css/play.css, css/app.css, js/ui/play.js (`setChrome`, `setGoal`, `setTip`) |
| 2 | P1 | Every item | Stimulus and answers are sized independently (`vh`, squares), so 4-option items and dials overflow at 360–390 px (§5.2). | Size the item to the screen: the stimulus gets `min(…, 100dvh − status − answers)`; option cells take the figure's aspect ratio (View Match, Spin and Rotate cells need far less height than width); four options in one row when the figure is small; a test that every item's answer area fits 360 × 640 with no scroll. | css/base.css (`.px-choice` min-height), css/ex/*.css (stage heights), views' `gridCols`; tests/e2e |
| 3 | P1 | Homing | The walk, the view and the dial do not fit one phone screen; the dial is 136 px and coarse; captions hidden; landscape shows 75 px of the walk (§3). | The Homing phone layout of §3: fixed one-screen layout; answer by dragging the view horizontally (turn to face the start) and/or a larger dial with −5/−1/+1/+5° buttons; captions as subtitles over the view; landscape: view left, controls right. Log the answer mode. Then drop the "larger screens" notice and tag (keep `perDisplay`). | js/ex/homing/view.js, css/ex/homing.css, js/ex/homing/learn.js, js/ui/library.js, js/ui/play.js |
| 4 | P1 | Watch, Try, Go | The labelled parts push the item below the fold (Track's demo stage at y 725, Homing's walk at y 739); demo captions sit under the pinned control bar (§5.3). | On phones: show the parts as a collapsed "What's what" line (or after the demo), scroll the stem into view before `present`, not only before show me; put the caption into the pinned bar above its buttons (or over the stimulus) so it is always visible; route every view's caption through the player's caption line. | js/ui/play.js (`wtg`, `bringIntoView`, `stemIntoView`, `demo`), css/play.css, the views' `.ex-caption` |
| 5 | P1 | Track, Homing (motion) | In landscape the motion plays mostly off-screen (96 px of Track's cube, 75 px of Homing's view); turning the phone mid-stimulus is not voided (§8, §6). | A landscape item layout (stimulus left at full height, answers right, no header), or a "turn your phone upright" card before motion items in landscape; void a trial when the orientation or the screen class changes during the stimulus (CLAUDE.md rule 7 already names it). | css/play.css, css/ex/track.css, css/ex/homing.css, js/ui/play.js |
| 6 | P1 | Spatial Check | Timed probes need scrolling on phones (View Match ends at y 879 at 390 × 844); the check and session records do not store the screen class (§5.4). | Make every probe fit one phone screen; store `display` (and viewport, input type) with each check and session; in Progress compare like with like, or say "this check was taken on a phone, your baseline on a computer". | js/engine/assess.js, js/engine/modes.js, js/ui/check.js, js/ui/progress.js, css/ex/viewmatch.css |
| 7 | P1 | Every item | Pull-to-refresh reloads the app mid-item; Safari's double-tap zoom is live on options and buttons (§6). | `html[data-chrome="focus"] { overscroll-behavior-y: none }` (Chrome); `html { touch-action: manipulation }` (keeps pinch zoom); `touch-action: none` on 3D views that get drag gestures; a non-scrolling item screen (#1–2) for iOS, where `overscroll-behavior` does not stop pull-to-refresh. | css/base.css, css/play.css |
| 8 | P2 | Header, pages, sheets | Left and right safe-area insets are ignored: in landscape on a notched iPhone the brand, More and every page edge sit 22–29 px inside the 47 px inset (§9.4). | `padding-left: max(var(--gutter), env(safe-area-inset-left))` (and right) on `.px-wrap`, the header, the tab bar, the fixed show-me bar, sheets and toasts. | css/app.css, css/base.css, css/play.css |
| 9 | P2 | First open from Discord | iOS keeps Discord's in-app browser storage apart from Safari; Safari deletes localStorage after seven days of use without a visit (§9.1–9.2). | A one-time line on touch devices not in standalone mode ("progress is saved in this browser only…"); ask `navigator.storage.persist()`; on iOS remind to back up after the first sessions and after a gap. | js/ui/app.js or welcome.js, js/core/store.js |
| 10 | P2 | Home screen | No manifest, no touch icon, no full-screen mode, no offline start from the icon (§9.3). | `manifest.webmanifest` (name, short_name, PNG icons 192/512 and maskable, `start_url: "."`, `display: "standalone"`, colours), `apple-touch-icon` 180 px, `apple-mobile-web-app-title`; insert the manifest link from script only on `https:` (no `file://` console error); a dark `theme-color`; a service worker for the GitHub Pages copy only if the owner accepts it under rule 6. | index.html, new icons, js/ui/app.js, tools/build-single.mjs |
| 11 | P2 | Welcome pop-up | In landscape it opens scrolled to Start training, its first line ("built by the Chimera community") above the edge (§4). | Open the dialog at its top (focus Start without scrolling, or scroll the dialog to 0 after focusing); hide the illustration when the height is under ~500 px whatever the width. | js/ui/welcome.js, js/core/ui.js (`modal`), css/app.css |
| 12 | P2 | Labels and stimuli | 11–12 px text throughout (tab labels, specimen labels, Log rows, Progress verdicts, calendar); SVG labels down to 6–10 px (Orient, Homing's map, Span) (§4, §5.5). | `--fs-xs` 13 px on phones and 14 px for anything a learner reads; SVG labels sized in screen px (scale by the drawing's on-screen size, minimum 12–13 px), as Homing already does for its side labels. | css/base.css, css/app.css, css/screens.css, js/ex/orient/view.js, js/ex/homing/view.js, js/ex/span/view.js, js/ex/mechanisms/view.js |
| 13 | P2 | Share sheet | "Download PNG" is the main action; a phone wants its share sheet (and Discord in it). | When `navigator.canShare({ files })` is true (not in sandboxed previews), a "Share…" button with the PNG and the text; keep Download and Copy. | js/ui/share.js |
| 14 | P2 | Homing, Orient | Touch answers are logged as `pointer` (§3). | Pass the pointer type from the dial's `pointerdown` into the response's source. | js/ex/homing/view.js, js/ex/orient/view.js, js/ui/play.js |
| 15 | P2 | Progress | 15–20 screens of scrolling with real data (§4). | On phones, sections as tabs or collapsed panels with a short summary each; "jump to" chips at the top. | js/ui/progress.js, css/screens.css |
| 16 | P3 | Texts | Key talk on touch screens: How to play's "Keys:" line, "(key 1)", "press Enter", Track's "Esc or Pause" (§5.6). | Touch wording when `(pointer: coarse)`: hide the Keys line, give captions a touch variant; hide the Keys button by pointer type, not width (landscape). | js/ui/play.js (`howTo`), learn.js captions, css/play.css |
| 17 | P3 | Reveal | Notes under the item start beneath the sticky reading strip (§5.2). | Bottom padding on the player equal to the strip's height while it is sticky. | css/play.css |
| 18 | P3 | Options | Long press can select text or open a callout; a drag-to-scroll that reads as a tap answers a single-choice item (§6). | `-webkit-touch-callout: none; user-select: none` on `.px-choice`; with #1–2 nobody needs to scroll over options any more; optionally a "confirm taps" setting for touch. | css/base.css, js/core/ui.js |
| 19 | P3 | Today | At 360 × 740 Start sits at the bottom edge; the session list's specimen line wraps into three lines. | Start above the list on phones (or a sticky Start bar over the tab bar); one-line spec in the list. | js/ui/home.js, css/app.css |

**Tests to add** (they would have caught most of this): a phone matrix (360 × 640, 390 × 844 with a 660 px "Safari" height, 844 × 390) that asserts, for every exercise and probe, that the stimulus and every answer control are inside the viewport without scrolling at the item's start; captions visible during demos; no element in the left/right safe-area insets (CDP `Emulation.setSafeAreaInsetsOverride`); and the Homing touch path of `homing_touch.py`. Remember that a full-page screenshot drops touch emulation (§1).

## 12. Sources
- Discord's link setting (App Settings → Web Browser: In-App Browser or External Browser; the in-app mode of the default browser): [roboin.io, April 2026](https://roboin.io/article/en/2026/04/20/how-to-open-links-in-an-external-browser-on-discord-mobile-app/).
- Safari's seven-day cap on script-writable storage and the exemption of Home Screen web apps: WebKit, "Full Third-Party Cookie Blocking and More" (March 2020) and its clarification, quoted in [OSnews](https://www.osnews.com/?p=131566); the bug reports [WebKit 237350](https://lists.webkit.org/pipermail/webkit-unassigned/2022-March/1024578.html).
- Pull-to-refresh: [Chrome, "Take control of your scroll" (overscroll-behavior)](https://developer.chrome.com/blog/overscroll-behavior); [WebKit bug 275947](https://bugs.webkit.org/show_bug.cgi?id=275947) (`overscroll-behavior` does not disable pull-to-refresh in iOS Safari; open, seen on iOS 18).
- Chrome's installability criteria (menu install without a fetch handler since Chrome 108 on mobile): [developer.chrome.com, "Revisiting Chrome's installability criteria"](https://developer.chrome.com/blog/update-install-criteria).
- Sea Hero Quest's controls (tap left or right to turn, swipe to change speed) and its flare task (shoot back towards the start, three proposed directions): Coutrot A. et al. (2018), "Global determinants of navigation ability", *Current Biology* 28, 2861–2866 ([PDF](https://Www.Gwern.net/doc/iq/ses/2018-coutrot.pdf)).
- How people hold phones (one hand, thumb): Hoober S. (2013), "How Do Users Really Hold Mobile Devices?", UXmatters.
- Target size: WCAG 2.2, 2.5.8 Target Size (Minimum), with its inline-link exception; Apple's 44 × 44 pt and Material's 48 × 48 dp guidance.

## Appendix: files
In `/tmp/claude-0/-home-claude/145ff06a-4b5d-5025-8cb7-e87b9d56923b/scratchpad/v11-audit/mobile/`: `lib.py` (viewports, measurements), `screens_crawl.py` → `screens_p360_p390_p412_l844.json`; `ex_crawl.py` → `ex_<vp>_all.json`; `check_crawl.py` → `check_<vp>.json`; `homing_touch.py` → `p390_homingtouch.json`; `captions.py` → `captions_p390.json`; `fps.py` → `fps_1_4.json`; `readiness.py` → `readiness.json`; `modals.py` → `modals.json`; `touch_extras.py` → `touch_extras.json`; debugging aids `mq_check.py`, `dbg_fullshot.py`, `dbg_scroll.py` (dispatched touch events scroll the page in this headless shell; `Input.synthesizeScrollGesture` with a touch source does not). Screenshots in `shots/`, named `<viewport>_<screen or exercise>_<step>.png`.

