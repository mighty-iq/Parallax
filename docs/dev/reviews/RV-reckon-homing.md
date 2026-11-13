# RV-reckon-homing: independent review of Reckon (EX-12) and Homing v2 (EX-11)

Reviewer: an independent agent that did not build these files. Date: 13 Nov 2026. Branch `build`, working tree as found at about 18:20 UTC (no commit hash is given because I ran no git commands).
Scope: js/ex/reckon/{gen,learn,view}.js, css/ex/reckon.css, tests/node/reckon.test.mjs, tests/e2e/harness_reckon.py (read only), js/ex/homing/{gen,learn,view}.js, css/ex/homing.css, tests/node/homing.test.mjs. Also read: R1 §6–9, PLAN M2/M3, progress/B3.md, the player paths they rely on (js/ui/play.js, js/core/timing.js, js/core/keys.js, js/core/store.js addTrial/field, js/ui/library.js notes).
Method: code reading plus Node checks in the scratchpad. No browser was launched (instruction). I changed no file other than this one.

Scripts and outputs: `/tmp/claude-0/-home-claude/145ff06a-4b5d-5025-8cb7-e87b9d56923b/scratchpad/rv-reckon/`. The files there:
- `ctx.mjs`: loads the classic scripts through `createContext` from tests/node/run.mjs (a vm context, with Math.random poisoned);
- `gen-sample.mjs` → `sample.json`: my own seed stream, `hash('rv-reckon', code, s)`, independent of the builder's `'reckon-test'` stream;
- `q1-geometry.mjs`, `q3-shortcuts.mjs` (→ `q3-out.txt`), `q3b-sides.mjs` (→ `q3b-out.txt`), `q3c-radial.mjs`, `q2-time.mjs`, `q2-ground.mjs`, `q4-hint.mjs`, `q5-walker.mjs` (→ `q5-out.txt`) and `q6-texts.mjs`.

The samples:
- **Reckon:** 10,368 items, 5,184 per variant (all 216 combinations × 24 seeds each).
- **Tutorial items:** 400 heading and distance items.
- **Homing v2:** 2,880 items (72 combinations × 40 seeds).

The builder's tests pass at review time: `node tests/node/run.mjs homing reckon`: load 139, homing 88, reckon 96 checks, 0 failed.

---

## Findings, ranked

| # | Severity | One line |
|---|---|---|
| B1 | **Blocker** (standing rule 5), unless the lead logs a scoped exception | Turn-only heuristics answer most items far above chance + 10. One example: "turn about 130° toward the side you turned in all". |
| B2 | **Blocker** (text) | The strategy card teaches the wrong side: "a turn of 90° to the right moves it 90° round to your left". Homing has the same text. |
| S1 | Should fix | Speed level 2 ('varied within legs') makes seconds a *better* odometer than level 1. |
| S2 | Should fix | The 'speeds' tip claims "even within a leg" at level 1, where legs have one speed. |
| S3 | Should fix | A device turn or resize during the answer phase (turning, walking back) is not voided. R1 §7.4 asks for it. |
| S4 | Should fix | Reckon's own Esc pause says "Resume to go on", but no control resumes it. The player's Resume leaves the walk frozen. |
| S5 | Should fix | The trial log keeps one number per trial. Pooled exports cannot separate angle from distance error, or recover the side of a miss or the drift. |
| S6 | Should fix (small) | Enter before walking says "Turn first…" on return and distance items. |
| N1–N16 | Nice to have | Smaller items: rounding, hints, history hygiene, accessibility and texts. See below. |
| U1–U2 | Unconfirmed | The 2 px width void on desktops; the active-time clock under the view's own pause. |

---

## B1. Turn-only heuristics beat chance + 10 in most item pools (standing rule 5)

**Severity:** blocker under CLAUDE.md rule 5 as written ("cheap heuristics … must stay within chance + 10 points on every item pool"), unless the lead records a scoped exception in DECISIONS.md. The same property is inherited from Homing's route model: Homing v1.0 shipped with it, and v2 still has it.

**Where:**
- **The generator rule is only a tiebreaker.** In `js/ex/reckon/gen.js:121-139` (the build score) and `js/ex/homing/gen.js:322-342`, "equal legs miss" is worth +2 only after the target is hit (score ≥ 12).
- **No validator rule.** Neither `check` (`reckon/gen.js:314-345`) nor Homing's validator checks it.
- **The tests mostly do not assert it.** `tests/node/reckon.test.mjs:264` reports the equal-legs rate as `[info]`. The best fixed answer is asserted only in the "spreads" cells (`:286`: 3–4 legs with medium or large turns).
- **The design asked for more.** R1 §6.4 says "Turns only (legs equal): miss where the geometry allows". The Homing header (`homing/gen.js:27-28`) claims "turning alone, with the legs taken as equal, misses too".

**How confirmed:** `q3-shortcuts.mjs` and `q3b-sides.mjs`. Cells are variant × route × tolerance, with n = 216 per Reckon cell and 120 per Homing cell. Fixed answers are cross-validated in two folds. Chance:
- **Point:** chance is 2τ/360 (22.2, 16.7, 11.1 %).
- **Return:** chance is the code's `2·asin(τ)/360` (16.7, 11.4, 8.0 %). That is an upper bound for a guesser who knows d. Uniform random positions hit only 8.1, 4.0 and 2.0 %.

**What a player can exploit (point items):**

| Strategy | Hit rate pooled at tolerance 40° / 30° / 20° | Cells over chance + 10 (of 24) | Worst cell |
|---|---|---|---|
| Legs taken as equal (sum the turns, ignore the legs) | 82.6 / 68.3 / 48.1 % | 22 | route 1, 20°: 96.3 % vs 11.1 % |
| The one-line formula 180° − ΣT/2 | 80.0 / 65.8 / 46.1 % | 21 | 96.3 % |
| Side-aware fixed turn, 180° − sign(ΣT)·A with A ≈ 50–65° (CV) | 73.6 / 61.9 / 41.4 % | 21 | route 1, 30°: 99.5 % |
| Best fixed angle, ignoring everything (CV) | 38.2 / 31.1 / 22.1 % | 12 | route 1, 30°: 55.1 % |
| Turn around (180°) | 14.2 / 5.7 / 0.0 % | 0 | fine |
| Turns reversed, heading not updated, mirror | 0 % | 0 | fine (the validator enforces these) |
| Back along the leg before the last turn (180° − T_last) | 42.8 / 31.4 / 24.1 % | 11 | route 1, 30°: 100 % |

Why it happens:
- **The key's side follows the net turn.** On routes 0, 1, 2 and 4 the start lies on the side of the net turn in 100 % of items. On routes 3, 6 and 7 it does in 86–97 %. Only route 5 (3 legs, large turns, whose turns sum past 180°) breaks the rule, at 29–36 %.
- **The key's size is narrow.** On routes 0, 1 and 4, |key| sits in about 105–150°; at route 0, 40° the interquartile range is 117–136°.
- **So "turn about 130° toward the side you turned" hits:**
  - 100 % at route 0, 40°;
  - 99.5 % at route 1, 30°;
  - 95.4 % at route 4, 40°.
- **Even the hardest cell (route 7, 20°) stays far above chance:** equal legs 32.9 %, 180 − c·ΣT 42.1 %, side-aware 29.2 %, all against chance 11.1 %.

**Return items:**
- **Positions:**
  - "turn about 130° toward the net turn and walk about 13 m" is over chance + 10 in 15 of 24 cells (worst: route 1, τ 0.5, 97.2 % vs 16.7 %);
  - the equal-legs position is over in 17 of 24;
  - the best fixed position is over in 6 of 24.
- **The distance part on its own,** with the true direction:
  - the average distance (10.3 m) hits 67.9 / 47.2 / 30.7 %;
  - a random distance from the pool hits 59.0 / 44.8 / 33.2 %;
  - the best single distance (7.5 m, in-sample) hits 78.2 / 59.3 / 44.3 %.
- **What this means:** at τ = 0.5 the disk needs little distance integration.

**Homing v2 (point only):**

| Strategy | Cells over chance + 10 (of 24) | Worst cell |
|---|---|---|
| Equal legs | 21 | 97.5 % |
| Side-aware fixed | 23 | 100 % |
| Best fixed (CV) | 14 | |
| Heading not updated (Homing does not enforce it) | 3 | route 5, 30°: 48.3 % vs 16.7 % |

The builder's own report line agrees: "turns only, legs taken as equal: point 67 %, return 50 %" (pooled over all cells).

**Why it matters:** at most levels, point items do not test the distance half of dead reckoning. A player who notes only which way they turned can pass the first rungs. The route dimension's logit steps (more legs = harder) do not hold for that strategy: route 4 is as easy as route 0.

**Suggested fix:**
1. **3–4-leg cells: make it a hard rule.** Require that equal legs and 180 − ΣT/2 miss by more than tol + 2°, and that about half of the items put the start on the side *opposite* the net turn. Leg contrasts make this possible. Draw the target on the side of the net turn or against it at random, and steer the last leg to it, as `search` already does for the key.
2. **2-leg cells (routes 0 and 2) and the small-turn routes 1 and 4: choose one of these.**
   - List them as degenerate, as Homing's `DEGENERATE` does, and use them as warm-up or practice only.
   - Or log an explicit rule-5 exception in DECISIONS.md and say in the Library text: "on the first levels the turns alone tell you most of the answer".
3. **Tests:** assert in reckon.test.mjs, per cell, these four strategies: side-aware fixed, best fixed (in all cells, not only "spreads"), equal legs and 180 − ΣT/2. Exempt only the listed cells.

## B2. The strategy card teaches the wrong side

**Severity:** blocker (text; one-line fix). It teaches the side swap that the feedback names as an error ("Left and right were swapped").

**Where:**
- `js/ex/reckon/learn.js:67-68`. Step 1 says "After the first leg, the start is straight behind you." Step 2 says "A turn of 90° to the right moves it 90° round to your left."
- `js/ex/homing/learn.js:56-57`. "… puts it 90° further round to your left." The same text has been there since v1.0 (`/home/claude/vsi-trainer/parallax/js/ex/homing/learn.js:53`).

**How confirmed:** with the app's own `route()` (`q6-texts.mjs`). Walk 8 m and then turn 90° right: the key is 90°, the start is on your **right**. After a 90° left turn it is at 270°, on your left. Read in order after step 1, the card puts the start on the wrong side.

**Fix:** "A 90° turn to the right swings everything round you 90° the other way: a start straight behind you is now on your right."

## S1. Speed level 2 ('varied within legs') gives the clock back

**Where:** `js/ex/reckon/gen.js:166-170`. The code draws `a ∈ [1.2, 1.6]`, then `b ∈ [a + 0.4, 2.0]`, and splits the leg between them. The two speeds average out, so each leg's mean speed is nearly constant.

**How confirmed:** `q2-time.mjs` and `q3-shortcuts.mjs`, 3,456 items per level.

| Measure | Level 0 (steady) | Level 1 (between legs) | Level 2 (within legs) |
|---|---|---|---|
| Per-leg mean speed, CV across items | 6.0 % | 13.3 % | 6.5 % |
| Per-leg mean speed, CV within an item | 2.3 % | 9.8 % | 4.7 % |
| r(leg time, leg length) | 0.983 | 0.902 | 0.977 |
| Stopwatch integrator, point (legs ∝ their duration, true turns) | 100 % | 97.4 % | 99.9 % |
| Stopwatch integrator, return position | 100 % | 82.8 % | 98.4 % |

**Why it matters:**
- **Against the design:** R1 §8.1(a)8 and the texts ("speeds change, so count what you see, not seconds") intend the opposite.
- **Against the model:** the difficulty model treats level 2 as 0.3 logit harder than level 1.
- **Turn durations** also track turn angles: r = 1.000 at level 0 and 0.95 at levels 1–2.

**What is fine:** time is not a cue to home *distance*.
- r(total motion time, d) is −0.17, −0.15 and −0.15 by level.
- r(walking time, d) is 0.13, 0.16 and 0.16.
- The walk-back speed is 1.05–1.95 m/s, with r(walkSpeed, d) = −0.02.
- "Hold Walk for c × the outbound walking time" (CV, true direction) hits 47.6–49.6 %. That is below the best fixed distance (57–58 %).

**Fix:**
- **Draw the leg's mean speed first.** Take it from the full range (better, a wider one: Petzschner & Glasauer varied ±60 %, R1 §8.1(a)8; for example 0.9–2.0 m/s within the 2 m/s comfort cap). Then split it into two speeds around that mean.
- **Add a test** that r(leg time, leg length) falls from level 0 to 1 to 2.
- **Consider wider ranges at level 1 too.** Its ±25 % still lets a stopwatch place 97 % of point answers.

## S2. The 'speeds' tip is false at level 1

**Where:** `js/ex/reckon/learn.js:42`. The tip has `when: { dim: 'speed', levels: [1, 2] }` and the text "Speeds change now, even within a leg…".

**How confirmed:** `play.js:152-166` (tipFor) fires the tip on the first item at level 1 or 2. At level 1 each leg has exactly one speed: `checkSpeeds`, `reckon/gen.js:272`, requires `v.length === 1` below level 2.

**Fix:** use two tips. Level 1: "Speeds change from leg to leg now: watch the ground, not the seconds." Level 2: "…even within a leg".

## S3. No void for a device turn during the answer phase

**Where:**
- The walker checks the view's shape only during the passive walk (`homing/view.js:553-554`).
- The player's shape check (`play.js:1056-1060`) runs only while `P.stimOn`. That is `present`, or `respond` with a time limit (`play.js:397`). Reckon's answer phase is untimed.

**Why it matters:**
- R1 §7.4 says: "void the trial if the orientation or the screen class changes during the route **or the answer**".
- The walk back uses visual odometry. Turning the phone changes the vertical field and the layout, and can cancel the held pointer.
- The row is logged under the starting screen class (`play.js:689`).

**How confirmed:** by reading.

**Fix:** in `collect`, keep `S.size()`. Compare it every frame in the walk-back loop (`reckon/view.js:283-301`) and on `resize`. On a change, `voidTrial('turned')`. Alternatively, let the player treat `respond` as a stimulus state for `perDisplay` custom views.

## S4. Reckon's own Esc pause: misleading text, a trap with the player's Resume, item not covered

**Where:**
- `js/ex/reckon/view.js:146-152` (togglePause).
- `:191-194` (Esc and Space during the walk).
- `js/ex/reckon/learn.js:109`: "Paused. This route will not count. **Resume to go on.**"

**What happens:**
1. **Esc goes to the view.** During the walk, Esc is taken by the view's key layer, not by the player, so the HUD button still reads "Pause".
2. **A frozen frame, a note, no Resume.** The frozen frame stays visible with a small note, and there is no Resume control for this pause.
3. **The player's pause does not clear it.** If the user then uses the HUD Pause and Resume, `view.resume()` clears only `hostPause`. `st.paused` stays true, so the walk stays frozen under "Resume to go on". Only Esc or Space ends it.

Homing's text says "Press Esc or Space to go on" (`homing/learn.js:95`), which is correct. The CLAUDE.md lesson says "a pause during a stimulus must cover the item and make it inert"; this pause does not. The trial is voided either way, so scoring is safe.

**How confirmed:** by reading. The e2e harness checks that "Esc again finishes the route", so the key path works.

**Fix (preferred):** drop the view's own Esc and Space pause. Let Esc reach the player's pause sheet, which already freezes the walk through `view.pause`, `hostPaused` and the inert host. Otherwise, at least use Homing's wording, and have `resume()` clear `st.paused` too.

## S5. The trial log keeps one number per trial (R1 §6.1, "log all of them per trial")

**Where:**
- The score fields: `reckon/gen.js:357-362`. Point items log `value` = |angle error|. Return items log `value` = position error ÷ d.
- The row format: `store.js:900-919` keeps a single `value` column. The research CSV (`lab.js:240-256`) writes rows only.

**What is lost:**
- the signed angle (the side of a miss);
- the distance ratio;
- the walked direction;
- the drift.

They live only in the reveal text and in the view's record field `'reckon'`. That field is capped at 40 entries (`HIST_N`) and appears only in the JSON backup.

**Why it matters:** pooled exports cannot separate angular from radial error, or estimate turn or distance gains. Those are the analyses R1 §3 and §9 rely on, and CLAUDE.md names pooled exports as the way to refit the hand-set steps.

**How confirmed:** by reading.

**Fix (cheapest):** keep the `'reckon'` history long, or uncapped like the trials, with the item seed, params code and display class. Then include it in the Lab research export. Alternatively, add a detail column to trial rows. That is a store schema change, in B1's area.

## S6. "Turn first…" is the wrong prompt on return and distance items

**Where:** `js/ex/reckon/view.js:358`, with `setFirst` at `learn.js:99`. On a return item, Enter with less than 0.5 m walked shows "Turn first: drag the view or the circle, or use ◀ ▶."
- If the player has already turned, the prompt is wrong: the missing step is walking.
- On distance items, turning is disabled altogether.

**How confirmed:** by reading.

**Fix:** add a caption such as `walkFirst` ("Hold Walk (↑) first, then Here") for `isReturn(item)`.

---

## Nice to have

- **N1. "40° off: more than 40°".** Wrong whole-degree answers that miss by less than 0.5° read as if they were on the edge.
  - Where: `reckon/view.js:429-430` and `homing/view.js:1100,1111` (`Math.round`).
  - How confirmed: `q6-texts.mjs`. It happens for about half of all items at their first outside answer: 5,077 of 51,840 near-edge answers.
  - Return verdicts round both numbers to 0.1 m. That could in principle show "3.5 m … more than … (3.5 m)", but it was not observed in 207,360 probes.
  - Fix: use one decimal within 1° (or 0.1 m) of the limit, or use `Math.ceil` for wrong answers.
- **N2. A right return answer can be told it made a named error.**
  - Where: `errorHint` (`reckon/view.js:370-379`) compares the walked direction with `tolDeg` = 2·asin(τ/2), and never checks `result.correct`. The disk allows directions up to asin(τ).
  - How confirmed: `q4-hint.mjs`. Of 96,768 right answers in that band, 40,162 got a hint; it is possible on 2,616 of 5,184 items. Example: seed 4172221738, route 0, τ 0.5. The answer is 126.3° walked 13.0 m, and is right (7.22 m ≤ 7.44 m), yet the player is told "Your answer points back as if the whole walk had been straight".
  - Fix: `if (result.correct) return ''`, as Homing's `hintFor` does.
- **N3. The 20-route bias history takes in answers it should not.**
  - It includes Try items, and the Watch demo item, which is answered *after* its solution was shown (`reckon/view.js:414`).
  - It includes trials voided by the player: a fallback item, or a context lost during the walk back. These never set the view's `st.voided`.
  - It mixes screen classes, although Reckon is rated per display.
  - Fix: pass a `practice` or `voided` flag through ctx, and skip those answers. Store the display class per entry.
- **N4. Up to 0.5° between what the view shows and what is scored.**
  - The walk back is drawn along `heading + st.raw`, which is fractional after a drag (`reckon/view.js:226-229, 254`). The response uses the rounded `st.value` (`:317`).
  - That is at most 0.5°, or 0.17 m at 20 m. The reveal re-places the view, which can make a small jump.
  - Fix: snap `raw` to `value` when walking starts, or send `raw`.
- **N5. Walk and Back do nothing on Space, Enter or screen-reader activation.**
  - Where: `reckon/view.js:108-124`, which handles pointer events only. `keys.js` leaves Enter and Space on a focused button to native activation.
  - Keyboard parity exists through ↑ and ↓. A touch screen-reader user, however, cannot walk back.
  - Fix: a click with `detail === 0` walks a fixed step, for example 0.5 m, with the same easing.
- **N6. Unconfirmed: possible screen-reader chatter.** During the walk back, `readout()` rewrites `el.phase` every frame (`reckon/view.js:233`, called from `:297`). `el.phase` is `aria-live="polite"` (`homing/view.js:807`).
  - Fix: write it only when the text changes.
- **N7. The Walk button is smaller than the design.** It is 3.5rem (56 px), and 3.25rem (52 px) on phones (`reckon.css:9,34-35`). R1 §7.1 suggested ≥ 64 px in the thumb zone. It meets rule 8's 44 px.
- **N8. The dot field's 24 m edge can show on large high-DPR screens.**
  - Cause: `DOT_R = 24` (`homing/view.js:292`), while the dots' fade can end at up to 23.6 m (a 1,600 px view at DPR 2).
  - How confirmed: `q2-ground.mjs`, a ray-cast of the kit's camera. At a fade end of 24 m, the contrast beyond the disk is 3–27 %.
  - It is centred on the viewer, so it carries no route information. It is cosmetic.
  - Fix: `DOT_R ≥ fade end / cos(half field) + margin`, or fade the dots near `DOT_R`.
- **N9. "Walking on … it also gets further away" is not always true** (`reckon/learn.js:69`).
  - When the start is ahead of your shoulder line, walking on brings it closer. Example: from 30° at 8 m, 4 m later it is at 54° and 4.96 m.
  - 30.6 % of Reckon items end with |key| < 90°.
- **N10. "(the open arrow)" in show me does not match return items** (`mapYours`, `reckon/learn.js:171`). For return items the map draws a line ending in a stop ring, not an arrowhead (`homing/view.js:703-706`).
- **N11. The heading Try item can be solved by matching the ground.** It uses the static textured ground (`learn.js:34`, flow 0). A player who turns on the spot can match the blob pattern they saw at the start, so the item stops isolating heading keeping. It is not rated.
  - Fix: use flow 2 (short-lived dots) for the heading item.
- **N12. Watch plays the walk twice.**
  - `P.demo` runs `run()`, so `present()` plays the full walk without captions (`play.js:824-846`). Then `view.demo` replays it with captions (`reckon/view.js:520-523`).
  - This adds about 13 s before the explanation, and the first pass is unexplained. It applies to Homing too. Confirmed by reading.
- **N13. A lost WebGL context shows "The view froze during the walk"** (`reckon/view.js:143`, `homing/view.js:953`). The player's verdict says "The 3D view was interrupted". A `voidLost` caption would match.
- **N14. Comfort (R1 §7.2): no one-time "stop if you feel unwell" notice before the first route, and no break card after about 3 minutes of motion.**
  - The 'comfort' text exists only as a part card in Watch, Try, Go.
  - Watch, Try, Go is only *offered* on first play, and not at all in Speed or Threshold mode (`play.js:1529`).
- **N15. "Has not been studied" claims more than R1 found** (bridge, `reckon/learn.js:181`; also Homing `:131`). R1 §4.3 says that *no* randomised path-integration training study with a transfer test *was found*, and that the search was cut short. "has not been tested in any study we found" is exact.
- **N16. The heading item's show me says "now you face the start".** It reuses `demoTurn` (`reckon/view.js:496`), but on that item you face the way you *faced* at the start.

## Unconfirmed

- **U1. The 2 px width rule could void desktop walks.** A width change ≥ 2 px voids the walk as 'turned' (`homing/view.js:553-554`). On a desktop with classic scrollbars, a vertical scrollbar that appears mid-walk would void it. One cause would be the HUD's "about N min left" text wrapping. I did not reproduce this in a browser.
  - Fix: void on an aspect change or a screen-class change, or on a width change over about 20 px.
- **U2. The active-time clock probably keeps running during the view's own Esc pause.** The player is not in its 'paused' state then (S4). I did not trace the clock code.

---

## Checked and found fine

**Q1. Geometry and scoring:** 0 disagreements (`q1-geometry.mjs`).
- **My method:** I recomputed every route with `Math.sin` and `Math.cos`. I projected the home vector onto the end frame's right and forward axes, a different method from the generator's bearing subtraction.
- **What matched:** the key, the distance, the heading, the path points, `pathLength`, `tolDeg` (2·asin(τ/2)), the point and return key fields (x right, z ahead, in mm) and the tolerances.
- **The answer frame matches the scorer's.** The view's response frame (`reckon/view.js:314-319`), its world placement (`:227-229`) and its reveal placement (`:471-475`) agree with the scorer's 'end' frame. I checked this algebraically.
- **Scoring:**
  - Point items: 445,824 responses (whole-degree answers within ±tol ± 3°, edges at ±0.05° and ±0.6°, and random angles), with `value` and `signed` checked.
  - Return items: 165,888 responses (around the disk edge, random positions within 2d, walks near the key rounded to mm), with `value`, `posErr`, `dist`, `ratio`, `dir` and `signed` checked.
  - Excluded: 272 and 1,127 responses within the stored key's rounding of the edge.
- **R1 §6.4 rules on every item (0 failures):**
  - the axis gap is max(20°, (tol + 2)/2);
  - reversed, heading-not-updated and mirror answers all miss by more than tol + 2°;
  - the home distance is 5–20 m;
  - the route never comes within 3 m of the start.
- **Logged values agree:**
  - `entry()` (direction, d, walked r, route length, right) matches;
  - the reveal's drift number (cm per metre = position error ÷ (outbound + walked)) matches my value to within rounding.
- **Validators and generation:**
  - `validate` passes every item; there were no fallback items.
  - Tutorial items (400): heading key = −T; distance key = L ahead; the second walk is ≥ 0.4 m/s off; neither is kept in the history.
  - Homing v2: 2,880 items and 192,960 whole-degree responses, 0 disagreements; the landmark counts are right.

**Q2. No fixes in the item:**
- **The ground seed is not tied to the route.** It comes from `r.fork('ground')` (`reckon/gen.js:191`), and `fork` depends only on the seed and a label (`rng.js:149`). The dots' generator is seeded from it (`homing/view.js:294`).
- **The 2 × 2 blob tiles never show an edge.** Ray-casting the camera (eye 1.6 m, pitch −10°, 70° field, aspects 0.75–2.4, fade end 16–28 m), the strongest mark contrast outside the tiles is ≤ 0.83 %.
- **The start ring hides for good.** It hides at 3.8 m from the start (`reckon/view.js:203`), and the first leg is ≥ 4 m.
- **The scene is flat and unlit.** The sky is one flat colour, the fog is linear and has no structure in azimuth, the materials are unlit (MeshBasic), and the 900 m plain is centred on the viewer.
- **Nothing reveals the direction during the walk.**
  - The flag, the stop ring, the key arrow and the wedge are hidden until the reveal.
  - The HUD and the captions are fixed texts; `describe()` gives only the number of legs.
  - No sound plays during the stimulus (`play.js:741`).
- **Short-lived dots fade:** a 0.3 s fade over a 0.8–1.4 s life, out of phase, about 1 Hz (under 3 Hz).

**Q2. Time:** time does not predict home distance (S1 above).
- r(total motion time, d) is −0.15 to −0.17.
- r(walking time, d) is 0.13 to 0.16.
- r(mean speed, path length) is 0.00 to 0.04.
- No item moves for more than 30 s (maximum 30.00 s, mean 20.4 s).

**Q4. Feedback:** reviewed in the code and checked numerically.
- The verdicts, the angle and distance lines, the drift and the bias fit (median of |answer| − |key| on the same side; median walked/d; swaps counted) are computed as their texts say.
- The chart's sign matches the bias line's on both sides. Dots are filled when right and open when wrong: a shape cue, not colour alone.
- The show-me map draws the believed vector to scale, in metres, from the end at (final heading + answer). It shows a stop ring and a miss line for walks, against the dashed true vector, and the believed and true vectors differ in dash pattern.
- The demo comments are right:
  - Reckon seed 10: 8.3 m, 88.5° right, 8.7 m; the start is at 137° right, 12.2 m away.
  - Homing seed 1: 6.5 m, 106° right, 8.3 m; the start is at 136° right.

**Q5. Timing:** I drove the real `kit.walker` with synthetic frame times in a vm context (`q5-walker.mjs`, 24 scenarios, the item a 3-leg route of 23.2 s).

| Scenario | Result |
|---|---|
| 60 Hz and 30 Hz | wall time = plan time, no void |
| One gap while moving: 999 ms / 1,001 ms | none / stutter |
| Freezes in the 1.2 s lead-in, or the instant motion starts | none; nothing has moved yet, and dt is clamped |
| Every frame 99 ms / 101 ms | none / stutter |
| Slow time share (time in frames > 100 ms) of 0.46 / 0.56–0.77 | none / stutter |
| Repeated 900 ms freezes | none, as the rule is written |
| Fast mode | never voids for timing |
| Pause / page hidden | void 'paused' |
| A 1 px / 2 px width change | none / 'turned' |
| A height change of 14 % / 16 % | none / 'turned' |
| Context lost | 'lost' |

- **Pause freezes the walk.** No `setPose` happens while paused, and the gap after a resume is one frame.
- **Calibration note:** the slow rule counts *time*, so a device that drops one frame in three to 110 ms (about 21 fps) is voided. That is as described, and it may be strict.
- **No saves during the walk:** the player holds the store from `run` to `respond` (`play.js:538, 694`), and `remember()` runs in the reveal.
- **The answer clock starts at the painted frame:** `present` resolves with `timing.nextPaint()` (double rAF) after the end pose is drawn, and the player measures from that timestamp minus paused time.
- **The view's own verdict is used.** `answerMeta` carries `frames`, so the player applies the view's rule, not its generic one (`play.js:674-679`).
- **A context loss in any phase voids the trial** (`play.js:1027`).

**Q6. Texts:**
- **The "why no landmarks" card, Homing's landmark card and the Library notes** (`library.js:48-49`) agree with R1 §8.1 and §8.5.
- **The "experimental" label is consistent:**
  - the name and flag in `reckon/gen.js:415`, and `item.experimental`;
  - the stage label (`homing/view.js:804`);
  - the HUD tag and label line (`play.js:175, 181`);
  - the Library tag and note (`library.js:49, 181`);
  - the Today note (`home.js:39`) and the guide (`guide.html:93, 162`).
- **The remaining tips match the code:** walkback, sparse, dots, tight (20° and a quarter), update and legs.

**Q7. Touch and accessibility:**
- **tapAct** (`homing/view.js:479-498`) acts on a touch pointerup inside the button, cancels that tap's touchend, and swallows a late click for 1.5 s. Mouse, pen and keys keep the click, and a second confirm is ignored by `live()` and the player's state check.
- **Hold buttons** capture the pointer and stop on pointerup, cancel, lost capture, key-up, window blur, visibility change and the host pause.
- **Touch targets:** the fine-turn buttons are 2.75rem; `.px-btn` has a minimum of `max(44px, 2.75rem)`.
- **Keyboard:**
  - turning: ← → by 5°, Shift for 1°;
  - walking: ↑ ↓ held;
  - answering: Enter for Confirm and Here;
  - the fine buttons: keyboard activation through `detail === 0`.
- **Screen readers:** the dial is a `role=slider` with `aria-valuenow` and `aria-valuetext`.
- **Reduced motion:** `lookTo` is instant, and the demo and show me go through the player's reduced-motion runner. The walk and the walk back are the stimulus (rule 8).
- **Colour is never the only cue:** ✓ and ✗ with words; filled and open arrowheads; solid and dashed vectors.
