# I1: Time counting and other bugs in Parallax v1.0.0

Audit of the released v1.0.0 (main f10f7db), for the v1.1 update. Brief item 1: find out why the time counting looks wrong, and fix it and other bugs.

- **Tested copy:** the frozen v1.0.0 tree at `scratchpad/frozen-v1.0/` (its `js/` and `tests/` are byte-identical to `/home/claude/parallax`, so every line number below is valid in the live repository).
- **How:** code reading of every clock, then real sessions in headless Chromium (Python Playwright, `file://`, SwiftShader WebGL) through `tests/e2e/pwslot.sh`, at 1366 × 768 (mouse) and 390 × 844 (touch, DPR 3). Waiting was real (no fake clock; only `exp_tz.py` pins `Date.now` to an evening in Los Angeles). `PX.debug.fast` was used only to shorten show-me animations, never during a stimulus. Hidden tabs were simulated by overriding `document.hidden` and firing `visibilitychange` (headless Chromium never hides its only page), so the app's own listeners ran exactly as in a real browser; real browsers also stop `requestAnimationFrame` while hidden, which the code already treats as a stutter.
- **Scripts, logs and JSON:** `scratchpad/v11-audit/timing/` (scratchpad = `/tmp/claude-0/-home-claude/145ff06a-4b5d-5025-8cb7-e87b9d56923b/scratchpad`). `pxlib.py` holds the helpers; one script per experiment (`exp_pace.py`, `exp_breaks.py`, `exp_reload.py`, `exp_tz.py`, `exp_speed.py`, `exp_check.py`, `exp_stim.py`, `crawl.py`; see the appendix); each writes `<name>.log` and `<name>.json`. Screenshots are in `scratchpad/v11-audit/timing/shots/`.
- **Severity scale:** **S1** wrong data or lost data, or a promise the app breaks every session; **S2** visibly wrong or misleading in normal use; **S3** inconsistent or confusing, with an easy workaround; **S4** cosmetic or rare.

---

## 1. The diagnosis in one page

Parallax has **four different clocks for one session, and they disagree with each other and with the wall clock**:

| Clock | What it really measures | Where it lives | Where it shows |
|---|---|---|---|
| **Budget clock** | wall time since the session's plan was created (`plan.start = Date.now()` when the play screen renders, before any intro card, tutorial or the Chimera pop-up) | `js/engine/modes.js:66-75`, `atEnd()` at `modes.js:97-104` | "about N min left" in the HUD (`js/ui/play.js:1258`); it can end the session |
| **Item count** | `plan.total = budget ÷ estimated ms per item` (an estimate: 9–11 s per item for a new learner, `js/engine/model.js:69`, `js/engine/schedule.js:175-181, 292`) | `atEnd()` at `modes.js:100` | the progress bar under the HUD ("4 of 29"), never in words in Train, Path or Speed |
| **Practice clock** (`activeMs`) | the sum of the gaps between consecutive answers, **dropping any gap over 90 s entirely** (`modes.js:149-151`, `maxGapMs: 90000` at `model.js:68`) | `plan.activeMs` → `session.practiceMs`, `rec.practiceMs` (`modes.js:213-218`) | the summary's "· 0.7 min" (`play.js:1639`), the Log's "1 min" (`js/ui/log.js:188`), the share card, the weekly-goal "5 minutes" rule (`js/engine/streak.js:33-35`), Speed's "right answers a minute" (`modes.js:671-674`) |
| **Answer clock** (`rtMs`) | paint of the item → the answer, minus paused time (`play.js:612-615`) | trial rows | "0.94 s" under each verdict, medians in the summary and Log |

Only the answer clock is correct. The other three are each reasonable on their own, but the screen promises one thing ("This session: … about 20 minutes", "about 5 min left", "The clock is stopped") while the session ends on another, and the summary reports a third.

What a person sees, measured (details in §3):

1. **The countdown never counts down when you answer quickly, and the session ends with minutes "left".** A 5-minute Train session answered at about 1.4 s per item ended after 43 s with the HUD still at "Train · about 5 min left" on the last item; the summary then said "0.7 min" (§3, T1).
2. **The countdown freezes while you think.** It is recomputed only when an item starts or is answered (`play.js:1247-1263`), never on a timer, so on a slow item it shows the value from the item's start.
3. **Pausing does not stop the session clock.** The pause sheet says "The clock is stopped and the item is hidden" (`play.js:803-805`), which is true of the answer clock only. The budget keeps running under the pause, a hidden tab and an idle screen, so a session can end one or two items after a break (T2).
4. **Practice time drops real practice.** Any gap over 90 s between two answers is thrown away whole, including the real work on the item before the break, the first item after a tutorial that ran past 90 s, and any item someone thinks about for more than 90 s. Gaps just under 90 s of idling or a hidden tab are counted in full (T3).
5. **Every screen rounds the same number differently.** Summary "0.7 min" (one decimal, `stats.js:58`), Log "1 min" (rounded, minimum 1, `log.js:188`), share card "1 min" (rounded, minimum 1, `play.js:1730`), Today "5 min" (the setting, not a measurement); total practice time is stored but shown nowhere (T5).
6. **A reload splits one sitting into two sessions** (the hash keeps `#/play?mode=train`, `app.js:769-770`, and `pagehide` saves the cut session, `play.js:1454-1462`), which inflates the weekly goal and the "8 sessions" rule for the next Spatial Check; reopening the app on a summary starts a fresh session behind the pop-up (T4).
7. **The Daily Challenge loses its one scored attempt to a reload or an early end**, draws unanswered items as wrong, and Today's panel mixes the UTC and the local day and never shows the challenge number (T6).

What works: answer times (pauses, modals and hidden tabs are excluded correctly), Speed deadlines and their bar, the Spatial Check's time limits and bars, and the stimulus durations of Track, Span and Pattern Memory (T7–T9).

The root cause is architectural rather than a typo: `plan.start` / `Date.now()` is used as if it were "time spent practising", while the engine's own `activeMs` is a different, lossy measure, and the HUD shows a wall-clock countdown for a session whose length is really decided by an item count. The fix (§6) is one **active-time clock** in the player (paused under the pause sheet, modals, hidden tabs and long idle; running during items, feedback and tutorials), used for the budget, the HUD, the summary and the weekly-goal minutes alike, with one formatter.

---

## 2. Inventory: every place Parallax measures, stores or shows a time

Clock sources: `Date.now()` (wall clock, ms) in the UI and passed as `now` into the pure engine; `performance.now()` / rAF timestamps through `PX.core.timing` (`js/core/timing.js`) for stimuli and answer times.

| # | Quantity | Measured by | Stored as | Shown as | Notes |
|---|---|---|---|---|---|
| 1 | Session length setting | Settings 10/15/20/30 min (`js/ui/settings.js:16, 103-108`) | `settings.sessionMin` | Today "20 min · Train · Balanced", block "~8 min" and a minute ruler (`js/ui/home.js:138-188`); "This session: … about 20 minutes." (`play.js:1243`) | a plan, not a measurement |
| 2 | Session budget | `budgetMs = max(60 s, minutes × 60 000)` (`modes.js:70`); Threshold, Daily, Check and Free play with a length use `Infinity` (`modes.js:321, 814`, `daily.js:75`) | `plan.budgetMs`, `plan.start` (not saved) | "Train · about N min left" (`play.js:1258`) | wall clock from the plan's creation |
| 3 | Item count | `total = max(10, round(budget ÷ ms per item))` (`schedule.js:292`, `modes.js:322, 454, 635`); ms per item from `trialMs()` (`schedule.js:175-181`): estMs + 2.5 s, else the person's median gap between answers (whole seconds, `schedule.js:148-170`), else 9 s choice / 11 s pick-two / 6 s yes-no (`model.js:69`) | `plan.total`, `plan.extra` | progress bar "4 of 29" (aria) | the session ends at `total` (+ up to 25 % replacements) whatever the clock says (`modes.js:92-104`) |
| 4 | Practice time | gaps between consecutive answers ≤ 90 s, summed (`modes.js:149-151`) | `session.practiceMs`, running total `rec.practiceMs` (`modes.js:213-218`) | summary meta "· 0.7 min" (`play.js:1639`, `stats.js:58`); share "in 1 min" (`play.js:1730`); Log "1 min" (`log.js:188`); never as a total | starts at `plan.start`; time after the last answer is never counted |
| 5 | Weekly goal | a session counts with ≥ 10 answers or ≥ 5 min practice (`streak.js:33-35`, `model.js:88`) | derived from `rec.sessions` | Today dial, Progress calendar, summary "This week" | also used for the Spatial Check schedule (`assess.js:106-118`) |
| 6 | Answer time | `timing.now()` at the answer − paint timestamp − paused time (`play.js:611-615`); a time-out logs the limit (`play.js:615`) | trial row `rtMs` (`model.js:350-356`) | verdict "0.94 s" (`play.js:680`, `fmtRt` at `play.js:138`); summary medians; Log "0.9 s" (`library.js:167`); Progress probe medians | correct; pause, modal and hidden time excluded |
| 7 | Trial time stamp | `Date.now()` floored to whole seconds (`model.js:355`) | row `tSec` | Log "14:05:09"; CSV `time_iso`, `t_sec` | whole seconds also feed the planning medians (#3) |
| 8 | Deadlines (Speed, timed Free play, deadline Threshold) | a `setTimeout` for the remaining time, paused and resumed by the player (`play.js:424-449`); a CSS bar (`css/play.css:46-50`) | `step.deadlineMs`; Speed `rec.timed[ex].deadline` | bar under the item; "Next deadline 4.21 s."; summary "deadline now …" | in time = right and `rt ≤ deadline` (`modes.js:651-660`) |
| 9 | Probe time limits (Spatial Check) | `def.timeLimit` (20–45 s) via the same player timer; each probe draws its own CSS bar from `present()` (`js/ex/cubematch/view.js:113-121` and the same in viewmatch, mechanisms, patterns, level, wordlinks) | row `rtMs` = the limit on a time-out | the probe's slow bar; nothing in words | bar paused by `[data-paused]` CSS |
| 10 | Stimulus durations | Pattern Memory exposure 3 s from rAF timestamps (`js/ex/patterns/view.js:148-172`); Track cue and tracking, Span sequence, Homing route from summed `timing.loop` dt clamped to 100 ms (`timing.js:44-82`) | `item.exposureMs`, `item.dur`, pace | captions ("filled for 3 seconds") | voided on frame gaps over 150 ms (Track: jumps > 1.5 sphere widths) |
| 11 | Daily Challenge day | UTC date (`daily.js:27-30`) | `rec.daily[YYYY-MM-DD UTC]` | "Daily #13", "(UTC)" on the end card | Today's panel reads UTC or the local date (`home.js:231-232`) |
| 12 | Check scheduling | 12 h between baselines, 14 days and 8 counted sessions between checks (`assess.js:127-170`) | `rec.assess[].date` (ISO) | Today and Progress "Next check in 5 days and after 3 more sessions" | sessions counted by #5 |
| 13 | Path rechecks, review spacing, rating drift | days from `now` (`modes.js:400-407, 503-523`, `schedule.js:69-80`, `estimator.js:257, 273`) | ms timestamps | "due for review: last practised 3 days ago" | day arithmetic is sound (`util.js:113-123`) |
| 14 | Lab self-experiment | weeks since `lab.start` (`js/ui/lab.js:187-199`, `assess.js:401-416`) | `rec.lab.start` | "week 2 of 6" | wall clock, as intended |
| 15 | Watch, Try, Go demos and show-me | `ctx.play` steps with ms durations (`play.js:188-250`) | `played.ms` (not saved) | none | count against the session budget (#2) |
| 16 | Backups and exports | `Date.now()` | `settings.lastBackup`; file names `parallax-backup-YYYY-MM-DD.json` | "Last backup: 13 Nov 2026, 14:05" (`app.js:216-226`) | local time; fine |

---

## 3. Time-counting findings

### T1 (S1). The "about N min left" countdown is not what ends the session; quick sessions end with minutes "left"

**Steps (manual):** Settings → Session length **10**. Today → Start today's session (Skip any Watch, Try, Go offer). Answer every item quickly (press a number key as soon as it appears, then Space). Watch the line under the exercise name.

**Expected:** the session lasts about 10 minutes and the countdown reaches "about 1 min left" before the summary; or, if the session is really a fixed number of items, the HUD says so ("item 12 of 58").

**Actual:** the countdown barely moves and the session ends when the hidden item count runs out. Measured (`pace_*.json`, `breaks_*.json`):

| Run | Budget | Real pace | Items | Wall time to the summary | HUD on the last item | Summary | `practiceMs` | Log |
|---|---|---|---|---|---|---|---|---|
| desktop, quick (`exp_pace.py fast`) | 5 min | 1.4 s per item | 29 of 29 | **42.7 s** | **"Train · about 5 min left"** | "· 0.7 min" | 42 165 | "1 min" |
| phone, touch (`exp_pace.py phone`) | 3 min | 7.2 s | 17 of 17 | 124.4 s | "about 2 min left" | "· 2.1 min" | 123 228 | "2 min" |
| desktop, slow (`exp_pace.py slow`) | 2 min | 21.2 s | 7 of 12 | 149.5 s | "about 1 min left" (8 s **after** the budget ran out) | "· 2.5 min" | 148 373 | "2 min" |

Today's panel, the intro line ("This session: Rotate, Fold and Spin, about 5 minutes.") and the HUD all spoke of 5 minutes; the session was 43 s. The progress bar under the HUD tracked the real end ("28 of 29") while the words said 5 minutes remained.

**Why:** `atEnd()` (`js/engine/modes.js:97-104`) ends the session when `plan.pos >= effTotal` (the item count) **or** when the wall clock passes `budgetMs − msPer`. `plan.total` is `budget ÷ estimated ms per item` (`schedule.js:276-297`); for exercises without enough history the estimate is 9–11 s per item (`model.js:69`, about 10.3 s for Rotate, Fold and Spin here), so anyone faster than the estimate runs out of items first. The HUD (`js/ui/play.js:1247-1263`) shows only the clock side: `Math.max(1, Math.ceil((budgetMs − (now() − plan.start)) / 60000))`. Two smaller faults in the same line: it is recomputed only in `hud()` and `afterTrial()` (no timer), so it freezes during an item (100 s on one item left it at "about 3 min left" throughout, T2); and `Math.max(1, …)` keeps showing "about 1 min left" after the budget has run out. The planning estimate itself is coarse: per-item times come from whole-second trial stamps (`model.js:355`), and gaps of 0 s are dropped (`schedule.js:155`), which biases quick exercises upward.

**Screenshot:** `shots/pace_fast_summary.png` (the summary after 43 s), `shots/pace_phone_first_item.png` (the HUD on a phone).

### T2 (S1). Pauses, hidden tabs and idle time run down the session; the pause sheet says the clock is stopped

**Steps:** Train, Session length 10 (or any). Answer two or three items. Press Esc (or Pause) and wait two minutes on the pause sheet, which says "The clock is stopped and the item is hidden, so a pause never counts as thinking time." Resume and keep answering. Variant: switch to another tab for two minutes instead; or leave the feedback strip open (do not press Next) for a minute.

**Expected:** a pause stops the session too; the countdown after Resume shows the same minutes as before the pause; the session still gives its planned practice.

**Actual (3-minute sessions, 3.7 s per item):**

- Pause sheet for 100 s at item 4 (`exp_breaks.py pause`): the HUD read "about 3 min left" all through the pause, then "about 2 min left" and "about 1 min left" at the next two items, because 100 s of the 180 s budget went under the pause sheet. The answer time of the paused item was right (3 159 ms, pause excluded).
- Hidden tab for 100 s during item 4, then hidden for 60 s while the feedback of item 7 was on screen (`exp_breaks.py hidden`): the player paused itself on the first hide (good) but not on the second (the feedback phase is not paused, `play.js:981`). On return the budget was over, so the session served one last item and ended: **8 of 17 items, about 30 s of real practice, in a "3-minute" session**. The summary said "1.4 min", of which 60 s was the hidden tab.
- No input for 100 s on item 4, then 60 s on the feedback strip of item 7, no pause (`exp_breaks.py idle`): exactly the same outcome as the hidden tab: the HUD stayed frozen at "about 3 min left" through the 100 s, the session ended after **8 of 17 items** (190 s wall, about 30 s of real activity), and the summary said "1.4 min". The idle answer was logged as a normal right answer with `rtMs` 103 157 (no idle detection, so it also enters the medians).
- Phone, 2-minute session, Pause for 100 s after the second answer (`exp_breaks.py pause2`): the HUD on and after the sheet still said "about 2 min left"; one answer after Resume the budget was gone, the next item was served as the last, and the session ended after **4 of 12 items** with 15 s of real practice ("· 0.2 min"). Screenshot: `shots/breaks_pause2_before_resume.png`. (The HUD's Pause button also keeps the label "Pause" while paused, although it resumes, S4.)

**Why:** the budget clock is `now() − plan.start` (`modes.js:102`, `play.js:1258`), wall time since the plan was created. `pause()` / `resume()` (`play.js:792-830`) stop only the answer clock (`P.pausedMs`) and the deadline timer; nothing stops or shifts `plan.start`. The visibility handler pauses only in the answer phase (`play.js:981`), so time on the feedback strip, on show-me, on cards and on the Chimera pop-up counts as session time even when the tab is hidden. The same wall clock includes the intro cards, Watch, Try, Go tutorials and the welcome pop-up after a reload (the plan is created by `router.go` at boot before `showWelcome()`, `app.js:769-776`).

**Screenshot:** `shots/breaks_pause_sheet.png` (the sheet's "The clock is stopped" while the session clock runs).

### T3 (S2). Practice minutes drop real practice and count idle time

**Steps:** any session with (a) a pause or tab switch longer than 90 s, (b) one item someone thinks about for more than 90 s, (c) a Watch, Try, Go tutorial before the first scored item, or (d) a minute on the feedback strip or another tab after an answer. Compare the summary's minutes, or `rec.sessions[i].practiceMs`, with the time actually spent.

**Expected:** practice time = time on items, feedback and show-me (and arguably tutorials), without pauses, hidden-tab time or long idle stretches.

**Actual:** `activeMs` is the sum of the gaps between consecutive answers, and a gap over 90 s is dropped **whole** (`modes.js:149-151`, `maxGapMs: 90000` at `model.js:68`):

- Pause run: 100 s pause at item 4. The 104.6 s gap to the next answer was dropped, so the 3–4 s of real work on that item vanished too; `practiceMs` 61 490 against about 66 s of real activity.
- Hidden-tab run: the 60 s hidden on the feedback strip stayed under 90 s, so it was counted: `practiceMs` 85 524 ("1.4 min") for about 30 s of real activity, nearly three times too much.
- A single slow item over 90 s, or a first item after a tutorial that took more than 90 s since the plan began (the first gap starts at `plan.start`, `modes.js:73`), counts zero. A session made only of such items has `practiceMs` 0: its summary says "· 0 min" and its Log row shows "N trials" instead of minutes (`log.js:188, 196`).
- Tutorials fall on either side of the line: in the desktop crawl, Span's Watch, Try, Go took 40 s and was counted as practice (2 scored items, "· 0.7 min"), while Homing's took 100 s and was dropped with the first scored item.
- The time between the last answer and Finish (reading the last feedback, show-me) is never counted.

**Where it matters:** the weekly goal and the Spatial Check schedule count a session with ≥ 10 answers **or ≥ 5 minutes** (`streak.js:33-35`, `assess.js:106-111`), so a session of fewer than 10 answers whose gaps mostly exceed 90 s (slow thinking, or a pause on most items) counts for nothing however long it lasted, while one with a few idle minutes under 90 s each can pass the 5-minute line; Speed's "right answers in time: N a minute" divides by this clock (`modes.js:671-674`); and `trialTimes()` uses the same 90 s cut for planning (`schedule.js:148-170`). The running total `rec.practiceMs` is stored but displayed nowhere, and the two-tab merge keeps `max(theirs, mine)` instead of re-summing the merged sessions (`js/engine/merge.js:150`), so one tab's minutes are lost.


### T4 (S2). A reload splits one sitting into two sessions, and reopening the app starts a session by itself

**Steps:** Train, answer 10 items, reload the page (or let a phone discard the background tab, or reopen a bookmark or the home-screen icon while the URL ends in `#/play?mode=train`). Close the Chimera pop-up, answer 10 more items, End session. Open Today and the Log.

**Expected:** one sitting is one session (or the person chooses to resume or to end); reopening the app does not start a session nobody asked for.

**Actual (`exp_reload.py train`):** the reload saved the first part as a finished session (10 answers, `practiceMs` 16 002), and the boot route `#/play?mode=train` immediately built a **new** plan under the pop-up ("Train · about 20 min left", "0 of 116", "This session: Rotate, Spin and Nets, about 20 minutes."). After 10 more answers the Log listed "2 sessions finished · 21 trials" and the weekly goal read **"2 of 3 sessions this week"** for about 45 s of practice; each part has 10 answers, so each counts for the weekly goal and for the "8 practice sessions" before the next Spatial Check (`assess.js:106-118`). The cut part's time after its last answer is lost. The same happens on a summary screen: its hash is still `#/play?mode=train`, so reloading or reopening the app there starts another session behind the pop-up; after closing it the person is on item 1 of a new "Train · about 20 min left" session (`exp_reload.py end`, `shots/reload_after_summary.png`).

**Why:** `pagehide` finishes and saves the running session (`play.js:1450-1462`), which is right, but the hash mirror keeps the play route (`router.js:63-85`), and boot routes straight to it before the pop-up (`app.js:769-776`). `sessionScreen()` then starts a fresh plan (`play.js:1231`), and its clock (T2) runs under the pop-up.

### T5 (S3). One session, four different minute counts; no total anywhere

The same session is reported differently on each screen (measured in the runs above):

| Screen | Code | Rule | Quick run (42.2 s of practice) | Hidden-tab run (85.5 s) |
|---|---|---|---|---|
| Today, before | `home.js:146`, `play.js:1942-1956` | the setting | "5 min" | "3 min" |
| Intro line | `play.js:1243` | the setting, rounded | "about 5 minutes" | "about 3 minutes" |
| HUD | `play.js:1258` | budget − wall time, ceil, at least 1 | "about 5 min left" at the end | "about 1 min left" |
| Summary meta | `play.js:1639`, `stats.js:58` | practice, one decimal | "· 0.7 min" | "· 1.4 min" |
| Share card | `play.js:1730` | practice, rounded, at least 1 | "29 items in 1 min" | "8 items in 1 min" |
| Log row | `log.js:188` | practice, rounded, at least 1; "N trials" when 0 | "1 min" | "1 min" |
| Progress, Today | `progress.js:579-580` | no time at all | – | – |

Answer times are formatted twice too: the verdict and the summary use two decimals below 10 s ("0.94 s", `play.js:138`), the Log and Progress one decimal ("0.9 s", `library.js:167`). `PX.util.fmtTime` (m:ss) exists (`util.js:83-89`) and is used nowhere. The settings hint speaks of "about 10 to 20 hours in all" (`settings.js:106`), but the app never tells the person their own hours: `rec.practiceMs` and `stats.totals().practiceMs` (`stats.js:173-182`) are computed and never shown, and there are no weekly minutes. The trial CSV names each row's session but carries no session length (`log.js:115-135`); only the JSON backup has `start`, `end` and `practiceMs` per session.

### T6 (S2). Daily Challenge: a reload or "End now" spends the day's scored attempt, unanswered items show as wrong, and Today mixes UTC and local days

**Steps:** Today → Play today's challenge → Start. Answer 3 items, then reload the page (or Pause → End now). Close the pop-up; look at the intro card, then Today's Daily panel; play the practice round for 2 items and End now.

**Expected:** an interrupted attempt can be resumed the same (UTC) day, or does not count until all 8 items are answered; unanswered items are shown as not answered; Today's panel shows the challenge number and the same day the engine uses.

**Actual (`exp_reload.py daily`):**
- The reload saved `rec.daily["2026-11-13"] = { n: 8, answered: 3, right: 2, outcomes: [1, 1, 0] }`. After the reload the app reopened the Daily on its own (T4) and said "Today's scored attempt is done (2/8). This round is practice."; Today showed "Played today: 2 of 8"; the share line is "Parallax Daily #13 · 2/8 · discord.gg/chmr", indistinguishable from answering all 8 and getting 6 wrong.
- The end card marks every unanswered item ✗ "wrong" (`play.js:1759-1766`): in the practice round, 2 answered, 6 never shown, all 6 drawn as red crosses. Screenshot: `shots/reload_daily_end.png`.
- Today's panel never shows the challenge number: it calls `PX.engine.daily.number(now)` with a time stamp (`home.js:234`), but `number()` takes a day key (`daily.js:35`); measured `[number(Date.now()), number(day(Date.now()))]` = `[NaN, 13]`.
- Today's "Played today" reads `rec.daily[utcDay] || rec.daily[localDay]` (`home.js:231-232`); the engine keys attempts by the UTC day only (`daily.js:27-30, 62-65`). Where the two days differ (evenings in the Americas, mornings in Asia and Oceania) Today can show yesterday's result as today's while the engine offers a new scored attempt (measured in §3, T6 time zones, below).

**Why:** `daily.finish()` writes the scored result whenever at least one item was answered (`daily.js:100-108`), and `pagehide` calls `finish()` (`play.js:1454-1462`); the end card turns "no outcome" into 0 (`play.js:1759`).

**Time zones, measured (`exp_tz.py`: Los Angeles, `Date.now` pinned to 19:00 PST on 13 Nov = 03:00 UTC on 14 Nov, after the morning's #13 was played 5/8):** Today shows "Played today: 5 of 8" and a button "See today's result"; the engine's own status is `{ day: "2026-11-14", number: 14, done: false }`, and the button opens "Daily Challenge #14 … One scored attempt a day: this one." (`shots/tz_today_daily.png`, `shots/tz_daily_intro.png`). Use `PX.engine.daily.status(rec, now)` on Today for the number, the day and the result, and say on Today when the next challenge opens in local time ("next one at 16:00").

### T7 (S2, mostly T1). Speed mode: the deadlines are right, the session length is not

**Steps:** make Speed available for Spin (a passed Path stage, or 60 settled answers), Session length 10, Library → Spin → Practise → Speed → Start; answer quickly; pause once mid-item; switch tabs once mid-item; let one item run out.

**Measured (`exp_speed.py desktop`, 2-minute budget):**
- Deadline timer and bar agree: deadline 5 226 ms, "Time is up" after 5.23 s, logged as wrong with `rtMs` 5 226; the bar was at 2 % of its length 0.26 s before the end (within the script's polling delay).
- Pause: the bar froze at 78.4 % for 4 s and resumed from 78.4 %; `pausedMs` 4 477 was excluded (answer 1 695 ms "In time"). A hidden tab paused the item and froze the bar at 85.8 % (`pausedMs` 5 465).
- The staircase notes read correctly ("In time. Next deadline 5.73 s.", "The deadline passed. Next deadline 6.78 s.").
- **But the session ended after 11 items in 42.3 s with "Speed · about 2 min left" on every item** (T1): Speed sizes its item count from the untimed per-item estimate (`modes.js:634-635`), which is far longer than a timed item. The summary said "· 0.7 min"; "Right answers in time: 12.7 a minute (82 % of 11)" divides by the practice clock of T3.
- Edge case (S4, by code): the deadline timer starts when the `present()` promise settles (`play.js:527, 436`), a few ms after the paint time stamp the answer time is measured from (`play.js:522, 615`), so an answer accepted just before the time-out can still be judged "Not right in time" (`modes.js:654`). Measure both from the same stamp.

### T8 (OK, two S4 notes). Spatial Check timers work

**Measured (`exp_check.py desktop`, Cube Match, 30 s limit):** the probe's bar and the player's limit agree (time-out after 29.9 s, logged as wrong with `rtMs` 30 000, the bar at 1.6 % half a second before); Pause froze the bar at 96.3 % for 5 s and resumed it there, and the 5 133 ms pause was left out of the answer time (2 085 ms); a hidden tab paused the item and froze the bar the same way (`pausedMs` 4 441). The HUD reads "Task 1 of 5 · item 3 of 16".

Notes:
- The intro promises "about 3 minutes each: roughly 15 minutes in all" (`js/ui/check.js:69`). With 16 items per task and limits of 20–45 s per item (`cubematch/gen.js:418`, `viewmatch/gen.js:571`, `mechanisms/gen.js:785`, `patterns/gen.js:227`, `level/gen.js:268`, `wordlinks/gen.js:553`), 3 minutes a task means about 11 s per item including the instruction card; slower, careful people will take 20–30 minutes. Say "15 to 25 minutes", or measure it and show "about N minutes" from the person's own last check (S4).
- The bars are `aria-hidden` and nothing states the limit in numbers on screen (only the hidden description, "up to 30 seconds"); a screen-reader user meets the time-out without warning (S4; time limits are essential to a timed probe, but saying them out loud is not).

### T9 (OK, one note). Stimulus display times hold

**Measured (`exp_stim.py desktop`, Free play, real speed, `presentMs` from the player and the nominal duration from the item):**

| Exercise | Nominal | Shown | Frames (median, max gap) | Verdict |
|---|---|---|---|---|
| Track, 2 s cue + 5 s tracking | 7 000 ms | 7 190 ms | 16.7 ms, 100 ms | counted (Track's own jump rule; the generic monitor flagged 41 % late frames, which Track rightly ignores) |
| Span, length 2 | 3 100 ms | 3 177 ms | 16.7 ms, 100 ms | counted |
| Homing, first route after load | 9 630 ms | 11 257 ms | 33.3 ms, **1 300 ms** | voided ("The display stuttered") |
| Phone run (`exp_stim.py phone`): Track | 7 000 ms | 7 388 ms | 16.7 ms, 333 ms | counted (a 0.05-width jump, under Track's limit) |
| Phone run: Span | 3 100 ms | 3 149 ms | 16.7 ms, 17 ms | counted |
| Phone run: Homing, first route after load | 12 315 ms | 12 446 ms | 16.7 ms, 100 ms | counted |

Pattern Memory's 3 s exposure is timed from rAF time stamps (`patterns/view.js:148-172`): in a full Spatial Check (`crawl.py desktop check`) the swap came at 3 000 ms every time and the empty grid was painted at 3 033–3 067 ms; 2 of 18 exposures were voided by the view's own 100 ms gap rule (gaps of 150 and 417 ms while the machine was loaded) and replaced, as designed. On the phone run (`crawl.py phone check`) all 16 exposures painted the empty grid at 3 033 ms and none was voided. Motion is integrated from frame time clamped to 100 ms (`timing.js:15, 51-53`), so a long frame lengthens the stimulus instead of making it jump (Homing above: +1.6 s around one 1.3 s stall), and gaps over 150 ms void the trial. That is the intended trade-off.

Note (S4, watch on real phones): the one freeze seen (1.3 s, first Homing route of the desktop run) did not recur on the phone run's first route, and the 2-CPU machine was running another audit's browsers at the time, so it is most likely load. Homing already renders the scene once before the walk starts (`homing/view.js:658-659`); if real phones show first-route voids, render every landmark once in the ready phase.


---

## 4. General bug hunt

Covered: every training exercise in Free play on desktop and on the phone with real stimulus speed (Track, Rotate, Spin, Fold, Nets, Slice, Views, Orient, Span, Hidden, Homing; Watch, Try, Go played on Rotate, Span and Homing, skipped on the rest), every mode (Train, Path, Speed, Threshold with the Spin deadline and Track Standard protocols, Free play with a timer, Daily Challenge, Spatial Check), Today, Library, Progress, Log, Lab, Settings, About, Back up (download) and Import (pasted backup, a broken file), on desktop and on a 390 × 844 touch phone. No page errors or console errors in any run (only SwiftShader's "GPU stall due to ReadPixels" driver warnings). Phone layout, Homing on phones and touch targets belong to the I2 mobile audit and are not repeated here.

### B1 (S2). Progress counts skipped and voided items as "answers"

**Steps:** Train, answer 5 items, Pause → End session. Open Progress.
**Expected:** "5 answers on 1 day" (the summary said "5 answered").
**Actual:** "6 answers on 1 day" (`exp_reload.py end`); after the reload run, "21 answers" for 20 answered; after one complete Spatial Check (80 items), "82 answers on 1 day · 1 check" (2 voided Pattern Memory items). Every trial row counts, including the skipped row that End session writes, voided (stutter) rows, Spatial Check probe rows and Threshold rows.
**Where:** `stats.totals()` returns `rec.trials.length + folded` (`js/engine/stats.js:173-182`), shown as "answers" by `js/ui/progress.js:579-580`. Count outcomes 0 and 1 only (and say "answers in training" if probes are left out), as the summary and the Log's session rows do (`log.js:73-78`).

### B2 (S3). The HUD counter runs one item ahead during the feedback

**Steps:** Free play, Length 10, answer the first item and look at the HUD while its result is shown. Same in the Daily Challenge and Threshold.
**Expected:** "item 1 of 10" until Next.
**Actual:** "Free play · item 2 of 2" above the first item's result (`shots/crawl_desktop_exercises_homing_reveal.png`); by the same code, "Daily #13 · 2 of 8" on item 1's feedback.
**Where:** `afterTrial()` calls `progress()` right after the answer (`play.js:1329`) and the text shows `done + 1` (`play.js:1251, 1254, 1259`). Show `done` items finished, or update the text at the next item.

### B3 (S3). The Sounds setting does nothing

**Steps:** Settings → Sound and keys → Sounds On; answer items.
**Expected:** "Short tones after answers" (the setting's hint).
**Actual:** silence. `settings.sound` is written (`js/ui/settings.js:122`) and stored (`js/core/store.js:194`), but no code reads it and there is no audio code in `js/` (checked with grep for `settings.sound`, `AudioContext`). Remove the toggle or implement it (a short tone after the verdict, off by default, never during a stimulus).

### B4 (S3). Two "Export trials (CSV)" buttons write two different files under the same name

**Steps:** Settings → Your data → Export trials (CSV); then Log → Export trials (CSV). Compare the headers.
**Expected:** one trial format.
**Actual:** Settings uses `store.exportCSV()` with 11 columns (`time_iso, t_sec, exercise, mode, params_code, params, seed, outcome, outcome_label, rt_ms, value`, the exercise as `rotate@1`; `js/core/store.js:57-59, 813-824`); the Log uses `PX.ui.log.csv()` with 15 columns (adds `version`, `session`, `p_pred`, `stage`; `js/ui/log.js:115-135`). Both are saved as `parallax-trials-YYYY-MM-DD.csv`, so two exports of the same day can differ without any sign. Route Settings to the Log's exporter (it is the richer one; the Lab's research export already uses it).

### B5 (S4). Today numbers the session's exercises "in order", but the session plays them in another order

**Steps:** fresh profile, Today: the plan lists "1 Rotate ~4 min, 2 Fold ~3 min, 3 Spin ~3 min" with a numbered ruler (`aria-label` "Exercises in today's session, in order", `home.js:149-163`); the intro line repeats "Rotate, Fold and Spin". Start the session.
**Actual:** 7 of 9 fresh Train sessions in this audit opened with Fold or Spin, not Rotate (`pace_fast`: Fold → Spin → Rotate; `pace_phone`: Fold → Rotate → Spin; `breaks_hidden`: Spin → Fold). Runs are drawn at random, weighted by the remaining quota (`schedule.js:319-345`).
**Fix:** either play runs in the listed order when the stage is S1–S3, or present the list as "today's mix" without numbers and without "in order".

### B6 (S4). The HUD's Pause button keeps saying "Pause" while the item is paused

**Steps:** press Pause (or Esc) during an item.
**Actual:** the pause sheet offers Resume, while the HUD button still reads "Pause Esc" and still works as a toggle (`play.js:291, 831`); on phones the two buttons sit one above the other (`shots/breaks_pause2_before_resume.png`). Label it "Resume" while paused, or disable it.

### B7 (S2). "Measured: Complete a Threshold run" is awarded for a run stopped after 3 of 30 items

**Steps:** Library → Spin → Practise → Threshold (Spin deadline, 30 items) → Start; answer 3 items; Pause → End session.
**Expected:** no achievement (the run is not complete), and the run is either discarded or saved as "stopped".
**Actual (phone, `crawl.py phone modes`):** the summary shows "Threshold: 6810.06 ms. The staircase did not settle yet…" and, under Achievements, "**Measured** — Complete a Threshold run." (`shots/crawl_phone_modes_threshold_summary.png`). The 3-item run is stored in `rec.mot['spin-deadline']` like a finished one (`n: 3, ok: false`).
**Where:** `MODES.threshold.finish` saves any run with at least one answer (`modes.js:859-875`); the achievement counts saved runs (`achievements.js:42, 86-87`). Rule 11 ("honest" achievements) is broken. Count only runs with `n >= trials` (or `ok`), and keep stopped runs out of the Lab's threshold history. The same pattern applies to "Against the clock: Finish a Speed session" (`achievements.js:52, 111-116`), which any Speed session with one answer earns.

### B8 (S4). Threshold results print raw numbers and a non-unit

"Threshold: 6810.06 ms." for the Spin deadline (`play.js:1721`, `U.round(t.threshold, 2) + ' ' + t.unit`) should read "6.8 s"; Track Standard prints "Threshold: 0.34 speed." (unit `'speed'`, `modes.js:695`), which is not a unit; rule 9 gives Track its own speed unit, which the Library already prints as "cw/s: widths of the box per second" (`library.js:459`).

### B9 (S3). Text size 150 % on a phone makes Today wider than the screen

**Steps:** 390 × 844 phone, Settings → Text size 150 %, Today.
**Expected:** no horizontal scroll (ARCHITECTURE §9: "no horizontal scroll").
**Actual:** the page is 439 px wide in a 390 px viewport; the header's "Chimera Discord" button is cut off at the right edge and exercise names break inside the word ("Rota / te") in the plan list (`shots/crawl_phone_screens_today_dark_150.png`). At 100 % the same screen is 390 px wide. (Phone layout as a whole is the I2 audit's subject; this one is listed because Settings offers 150 %.)

### B10 (S3). A Spatial Check counts as a practice session for the weekly goal

**Steps:** fresh profile, take Baseline 1 to the end (no training at all). Open Progress or Today.
**Expected:** the weekly goal counts practice; a measurement that "Parallax never trains" is not practice (the Check's own schedule counts only training sessions: "8 practice sessions", `assess.js:106-111`).
**Actual (`crawl.py desktop check`):** "Weekly goal: 1 of 3 sessions this week", Friday marked "practised", and the "Twelve days" achievement at "1 of 12", all from the Check alone. The check is saved as an ordinary session (80 answers, `practiceMs` 154 134) and `streak.counts()` ignores the mode (`streak.js:33-35`), as does the day count for "Twelve days" (`achievements.js:59-65`). Free play and Threshold runs count too, which may be intended; the Check should not. Filter by mode in `streak.counts()` (training modes, as `assess.js` does), or state the rule ("any session, including checks").

### B11 (S3). After an answer, the deadline bar jumps back to full

**Steps:** Speed (or Free play with a 5 s timer); let an item run out, or answer half-way through the deadline; look under the options while the result is shown.
**Expected:** the bar stays where the time ran out (empty after "Time is up"), or disappears.
**Actual:** the bar refills to full width next to "Time is up" (`shots/speed_phone_timeout.png`, phone; on desktop the feedback strip hides it). `respond()` removes `is-running` (`play.js:635`), which removes the CSS animation, and the fill falls back to its resting `transform: scaleX(1)` (`css/play.css:47-48`). Freeze it with `animation-play-state: paused` (as a pause does) or hide the bar at the answer.

### B12 (S4). Path asks twice before its first item

**Steps:** Library → Rotate → Practise → Path (a fresh exercise).
**Actual:** the intro card "Path · stage 1 of 10 … Settings at this stage: Angle 40°, axis vertical, 6 cubes … Back / Start" is followed at once by a second card "Path stage 1 of 10 … Settings at this stage: Angle 40°, axis vertical, 6 cubes. A short demo shows how this stage's items look … Watch the demo / Start the stage" (`shots/crawl_desktop_modes_card_stage.png`), and the session's budget clock (T2) runs through both. The intro comes from `introFor()` (`play.js:1536-1544`), the second from `stageWatch()` because the first step of a stage not yet watched carries `watch: true` (`modes.js:474-479`, `play.js:1297, 1385-1402`). Merge them: one card with "Watch the demo" and "Start".


### Checked and working

- Answer times: a 100 s pause and a 100 s hidden tab are left out of `rtMs` (3 159, 3 138 ms; the keys sheet is covered by the existing `tests/e2e/play.py`); a hidden tab during the answer phase pauses and hides the item, and it stays paused until Resume.
- Trial rows: one per item, never twice; End session logs one skipped row; a reload logs the cut session once.
- Speed deadlines, Spatial Check limits and their bars (T7, T8); "Stop the check" asks first, saves nothing, and the Log lists the answers as "not finished" (`exp_check.py desktop 2`); a complete Baseline 1 on desktop (152 s at 0.6 s per answer) and on the phone (135 s), each ending on "Check saved" with five probe lines and "Baseline 2 … from 14 Nov 2026, 02:28" (12 h later), mirrored on Today and Progress.
- The Daily Challenge in full (8 items, "5/8", share line, Today "Played today: 5 of 8"), Free play with a 5 s timer, Path, Threshold (Spin deadline, Track Standard), Train and Speed on desktop and phone; every training exercise in Free play on desktop and phone (`crawl_*_exercises.json`), with Watch, Try, Go on Rotate, Span and Homing.
- Settings: session length (Today follows: "10 min", blocks ~4/~3/~3), theme, text size, Back up (a real download, `parallax-backup-2026-11-13.json`, 20 top-level keys, "Last backup" updated), Export CSV dialog, Import of pasted text ("Progress imported." with an Undo action), a broken import refused with "Nothing was changed".
- No page errors and no console errors in any run (desktop and phone), only SwiftShader's "GPU stall due to ReadPixels" driver warnings.

---

## 5. Ranked list

| Rank | ID | Sev. | One line | Main place to fix |
|---|---|---|---|---|
| 1 | T1 | S1 | Sessions end by a hidden item count while the HUD counts minutes: quick sessions end with "about N min left" (43 s of a "5-minute" session) | `modes.js:92-104`, `play.js:1247-1263`, `schedule.js:276-297` |
| 2 | T2 | S1 | Pause sheet, hidden tab and idle time run down the session budget; the sheet says "The clock is stopped"; a session can end one item after Resume (4 of 12 items) | `modes.js:102`, `play.js:792-830, 981`, `app.js:769-776` |
| 3 | T3 | S2 | Practice minutes drop any gap over 90 s whole and count idle gaps under 90 s (30 s of work reported as 1.4 min; real work after a break lost); they feed the weekly goal, the check schedule and Speed's rate | `modes.js:149-151`, `model.js:68`, `stats.js:58` |
| 4 | T4 | S2 | A reload saves a cut session and silently starts a new one (one sitting = 2 weekly-goal sessions); reopening on a summary starts a session | `play.js:1454-1462`, `router.js:63-85`, `app.js:769-770` |
| 5 | T6 | S2 | Daily Challenge: a reload or End now spends the scored attempt as "2/8"; unanswered items drawn as wrong; Today mixes UTC and local days ("Played today" for yesterday) and never shows the number (`NaN`) | `daily.js:100-108`, `play.js:1759`, `home.js:231-234` |
| 6 | B7 | S2 | "Measured: Complete a Threshold run" for a run stopped after 3 of 30 items (also "Finish a Speed session" for any Speed session) | `modes.js:859-875`, `achievements.js:42, 52` |
| 7 | B1 | S2 | Progress counts skipped, voided and probe rows as "answers" (6 for 5, 82 for 80) | `stats.js:173-182`, `progress.js:579-580` |
| 8 | T7 | S2 | Speed sessions end by the untimed item estimate (11 items, 42 s, "about 2 min left") | `modes.js:634-635` |
| 9 | T5 | S3 | One session shows four different minute values ("0.7 min", "1 min", "about 5 min left", "5 min"); no practice total or weekly minutes anywhere | `play.js:1639, 1730`, `log.js:188`, `stats.js:173-182` |
| 10 | B10 | S3 | A Spatial Check counts as a practice session for the weekly goal and "Twelve days" | `streak.js:33-35`, `achievements.js:59-65` |
| 11 | B4 | S3 | Settings and Log export two different trial CSVs under the same file name | `store.js:813-824`, `log.js:115-135` |
| 12 | B3 | S3 | The Sounds setting does nothing | `settings.js:122` |
| 13 | B9 | S3 | 150 % text on a phone: Today 439 px wide in a 390 px screen | layout (I2) |
| 14 | B2 | S3 | The HUD counter runs one item ahead during feedback | `play.js:1251-1259, 1329` |
| 15 | B11 | S3 | After an answer the deadline bar jumps back to full ("Time is up" beside a full bar) | `play.js:635`, `css/play.css:47-48` |
| 16 | B5, B6, B8, T7 edge, T8 notes, T9 note | S4 | Today's numbered order is not the play order; Pause button label; Threshold units ("6810.06 ms", "0.34 speed"); deadline and answer clocks start from different stamps; the Check's "about 15 minutes" and silent bars | see each item |

---

## 6. Fix direction for the time model (for the v1.1 plan)

One clock, owned by the player, measured the same way everywhere:

1. **An active-time clock in `js/ui/play.js`** (`sessionClock`: `start()`, `pause(reason)`, `resume()`, `ms()`), built on `timing.now()`. It runs during items, feedback, show-me, Watch, Try, Go and cards inside a session; it stops under the pause sheet, any modal (the Chimera pop-up, Keys, More), a hidden tab in **any** phase, and after 60 s without input on the feedback strip or a card (the idle stretch beyond the cap is not counted). Nothing is drawn or saved by it during stimulus phases (rule 7): it only takes time stamps at phase changes.
2. **The engine takes elapsed active time instead of wall time** for the budget: `modes.next/answer/finish(plan, rec, now, { activeMs })`, with `atEnd()` comparing `activeMs` with `budgetMs` (`modes.js:97-104`). `plan.start` stays a wall-clock stamp for the Log only. `session.practiceMs` = the active clock (no more 90 s cut); the 90 s cut stays only in `trialTimes()` planning, where it belongs.
3. **One end rule per mode, said in the HUD.** Train, Path and Speed are time-boxed: they end at the first item boundary after the budget, and the item count becomes a safety cap (for example 3 × the estimate) instead of the usual end. The HUD then counts down honestly: "12 min left", refreshed at item boundaries and every 15 s while answering (not during a stimulus), "less than 1 min left", then "last item". Threshold, Daily, Check and Free play with a length keep "item n of N".
4. **One formatter** (`PX.util.fmtMinutes`: "under 1 min", "7 min", "1 h 05 min"; seconds only where a number of seconds is meant) for Today, the intro line, the HUD, the summary, the share card and the Log; `fmtRt` for answer times on every screen (one rule for decimals).
5. **Totals people can use:** Progress gets "Practice so far: 3 h 20 min on 14 days" and "this week: 52 min"; the merge recomputes `rec.practiceMs` from the merged sessions (`merge.js:150`).
6. **Words that stay true:** the pause sheet can keep "The clock is stopped" once the session clock stops too; the intro line says "about 20 minutes of practice"; the weekly-goal rule "10 answers or 5 minutes" then uses the same minutes the summary shows.
7. **Reloads:** do not start a session from a `#/play` hash at boot; open Today with a line "Your session was saved: 14 items, 6 min" (or offer to resume the same plan within, say, 30 minutes). Mirror the summary as `#/home` or `#/log` so a restored tab never starts a session by itself.
8. **Tests:** a Playwright run with a fake clock (`page.clock`) for pauses, hidden tabs and long idle; node tests that `activeMs` never exceeds wall time and never counts paused or hidden spans; a check that the HUD, the summary and the Log show the same minutes for one session.

---

## Appendix: re-running the measurements

All scripts take the frozen copy's `index.html` over `file://` and write to `scratchpad/v11-audit/timing/`. Run each through the slot lock, for example `/home/claude/parallax/tests/e2e/pwslot.sh python3 exp_pace.py fast` from that folder. To test a fix, point `pxlib.FROZEN` at the working tree.

| Script | What it does | Main output |
|---|---|---|
| `exp_pace.py fast \| slow \| phone` | Train at a fixed pace (1.4 s, 21 s, 7 s per item) with a 5, 2 or 3-minute budget | HUD per item vs wall time; summary, `practiceMs`, Log, Today (T1, T5) |
| `exp_breaks.py pause \| hidden \| idle \| pause2` | 100 s pause, hidden tab or idle at item 4 (60 s more on a later feedback strip); `pause2` is a 2-minute phone session paused after item 2 | when the session ends; `practiceMs`; answer times (T2, T3) |
| `exp_reload.py train \| daily \| end` | a reload mid-session; the Daily reloaded after 3 items; End session after 5 items, then a reload on the summary | sessions saved, weekly goal, the auto-started session, `rec.daily` (T4, T6, B1) |
| `exp_tz.py` | Today's Daily panel in Los Angeles at 19:00 PST (`Date.now` pinned) | "Played today" vs the engine's day (T6) |
| `exp_speed.py desktop \| phone` | Speed on Spin (unlocked by a passed Path stage written into the record): pause, hidden tab, a time-out | deadline bar samples, "Next deadline", the summary (T7, B11) |
| `exp_check.py desktop N` | the first Spatial Check task: pause, time-out, hidden tab, then "Stop the check" | probe bar samples, `rtMs`, the Log row (T8) |
| `exp_stim.py desktop \| phone` | Track, Span and Homing at real speed in Free play | `presentMs` vs nominal, frame statistics (T9) |
| `crawl.py desktop \| phone  exercises \| modes \| screens \| check` | every exercise in Free play; Train, Path, Threshold, Daily, timed Free play; every screen, Settings, Back up, Import; a full Spatial Check | `crawl_*.json`, screenshots (§4) |
