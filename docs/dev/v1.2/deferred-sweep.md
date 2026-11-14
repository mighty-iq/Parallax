# Deferred sweep: what v1.0 and v1.1 left open, and whether it is still open

Written 14 Nov 2026 on branch `build` at 224228f (the released 1.1.0). Input for docs/dev/PLAN-v1.2.md (STATE.md:23).

**Sources read.** docs/dev: DECISIONS, STATE, VERIFY-v1.1, RELEASE-v1.1, PLAN, REQUESTS-v1.1, CONTRACT-v1.1, GUIDE-v1.1; every file in docs/dev/reviews/ and docs/dev/progress/; docs/research/v1.1/*.md (recommendation, risk and later sections) and ACCESS.md; the v1.0 notes in /home/claude/vsi-trainer (PLAN.md, PHASE-3.md, PHASE-B.md, CLAUDE.md, and the summary or recommendation sections of research/A–D); code comments in js/, css/, tools/, tests/ (no TODO, FIXME or XXX exists; no "later" comment marks unfinished work, apart from js/ex/knots/gen.js:9).

**How each item was checked.** By grep and reading the current code, tests, docs/guide/guide.html and git history. No browser test was run, so layout items (O41, O48, O53–O56) rest on code, CSS and commit history only.

**Status.** OPEN = not done. DONE = done after all (where it is given). DROPPED = a decision rejected or accepted it as is (DECISIONS.md line, or the plan or code that states the design).
**Size.** S under an hour, M a few hours, L a day or more. Sizes are estimates of the work in this codebase, tests included.
Paths are relative to the repository root unless they start with /home/claude/vsi-trainer (the v1.0 workspace). "R1"…"R4", "I1", "I2" are docs/research/v1.1/R1-path-integration.md, R2-knots.md, R3-dat-pat.md, R4-test-overlap.md, I1-timing-bugs.md, I2-mobile-audit.md. "RV-…" files are in docs/dev/reviews/, "B1"…"G1" in docs/dev/progress/.

## Counts

61 OPEN items: UI 13 (4 of them Section practice), engine 3, data 3, phones 4, guide 3, tests 5, tooling 3, Reckon and Homing 11, Knots 3, DAT-style formats 10, Fold 1, v1.0 backlog exercises 2.
24 DONE-after-all items and 25 DROPPED (or by-design) items are listed after the OPEN table so nobody re-opens them.

## OPEN

| id | Item | Area | Source (file:line) | Size | Why it matters to a player |
|---|---|---|---|---|---|
| O1 | Game layer of the 11 Nov standing rules (D1: kept out of 1.1). The full standing-rules gap list is a separate sweep: docs/dev/v1.2/standing-rules-gap.md (STATE.md:24). | UI | DECISIONS.md:3, :16; PLAN.md:96; STATE.md:9, :33; VERIFY-v1.1.md:29 | L | More reasons to come back |
| O2 | Lighter one-tap pop-up on later launches; the full welcome still opens on every launch (D1). | UI | DECISIONS.md:3, :16; PLAN.md:96; STATE.md:33; js/ui/welcome.js:21 | S | One less screen on every open |
| O3 | Chimera invitations at high points (personal best, milestone, plateau, export) (D1). | UI | DECISIONS.md:16; PLAN.md:96 | M | Community link at the right moments |
| O4 | Pause or End while feedback shows: Pause is disabled outside present, respond and paused, so ending early takes Next, Pause, End. | UI | STATE.md:35; DECISIONS.md:54; B2.md:113, :128; RV-play-dat.md:73; js/ui/play.js:390 | M | Stopping a session is clumsy |
| O5 | Answer times in two formats: verdict and summary 2 decimals under 10 s (`fmtRt`), Log and Progress 1 decimal or none (`exinfo.secs`). | UI | RV-code-core.md:183; B1.md:111, :138; I1:320; RV-play-dat.md:135; js/ui/play.js:141; js/ui/library.js:234 | S | One answer shows two different times |
| O6 | The new-exercise offer says Watch, Try, Go takes "about a minute"; the fresh-player test took 1.5–2.5 min per Form Try item. | UI | RV-play-dat.md:196; js/ui/play.js:1716 | S | A wrong expectation on the first visit |
| O7 | Session summary "median" is the median of right answers only and does not say so. | UI | RV-play-dat.md:197; js/ui/play.js:2049 | S | Results are misread |
| O8 | Opening "Parts" during a Watch on a phone puts the list above the item without pausing the demo, so the demo plays off screen. | UI | RV-play-nav-knots.md:142; js/ui/play.js:1359-1368; css/play.css:399-400 | S | The demo is missed |
| O9 | Section practice: the clock is saved only between items, so a reload gives back the time spent on the current item. | UI (Section) | RV-section-overlap.md:181 (N12); B7.md:29; js/ui/section.js:205-209 | S | A reload wins time |
| O10 | Section practice: a reload during the review loses it; only the run summary is kept. | UI (Section) | RV-section-overlap.md:191 (N14); B7.md:29 | M | The item-by-item review is gone |
| O11 | Section practice: item numbers skip voided items, so a flagged "item 4" can become "item 3". | UI (Section) | RV-section-overlap.md:227 (N23); js/ui/section.js:347-351 | S | Flags point to the wrong number |
| O12 | Section practice: optional tally pad (columns 0–5) for Painted Cubes, as on-screen scratch paper. | UI (Section) | R3:653 | M | A counting aid like the real test's noteboard |
| O13 | A faster-resolving Spatial Check (D1). In the simulations 96.5 % of learners with real transfer still read "unclear yet" at day 60; v1.0 accepted this. | engine | DECISIONS.md:16; PLAN.md:96; docs/dev/ENGINE.md:173; /home/claude/vsi-trainer/CLAUDE.md:77 | L | Real gains become visible within weeks |
| O14 | A partial Daily attempt resumes by position in the device-filtered item list, not by seed (changing it changes the saved Daily format; "waits for a real report"). | engine | STATE.md:35; DECISIONS.md:25; B1.md:114 | M | Rare: a device that cannot run an exercise shifts the day's items |
| O15 | Folded-day answer totals subtract every probe row of the day, voided and skipped ones too. | engine | RV-code-core.md:174 (N7); B1.md:138; js/engine/stats.js:183-184 | S | Answer count slightly low after 20,000 trials |
| O16 | Refit hand-set difficulty steps from pooled exports (all exercises; Form's base and steps; Reckon, Knots and DAT-style steps), and equate the probes' alternate forms from pilot data. | data | STATE.md:35; CLAUDE.md:43; DECISIONS.md:44; B6.md:132, :135; R1:437; R2:785; R3:826; js/ui/lab.js:275; /home/claude/vsi-trainer/PLAN.md:139; /home/claude/vsi-trainer/research/B-tasks.md:180; /home/claude/vsi-trainer/research/C-progression.md:105 | L (needs community data) | Levels and success targets match real difficulty |
| O17 | Log the answer mode (drag, dial, ±buttons, keys) and the phone's orientation per trial. Homing and Reckon pass `mode` in their answer meta, but no trial column stores it. | data | I2:60, :243; R1:372; js/ex/homing/view.js:1112; js/core/store.js:68-69 | S | Pooled data can show whether drag answers are easier |
| O18 | Phone-validity pilot for Reckon: compare phone and desktop error distributions per rung on community data. | data | R1:457 | M (needs data) | Phone ratings mean the same as desktop ones |
| O19 | Measure Homing and Reckon walks on real mid- and low-end phones (median frame ≤ 17 ms, < 5 % slow frames). Every 1.1 measurement ran headless with software WebGL. | phones | R1:367, :467; I2:183; I1:198; B3.md:64 | M | Walks may stutter or be voided on slow phones |
| O20 | Progress on phones is 15–20 screens of scrolling; the audit proposed sections as tabs or collapsed panels and jump-to chips. Only the checks list is collapsible. | phones | I2:255; js/ui/progress.js:211 | M | Results are hard to find on a phone |
| O21 | A service worker for the GitHub Pages copy so the home-screen icon starts offline; the owner's call under rule 6 (no workers from files). | phones | I2:217, :250 | M | The home-screen app fails without a connection |
| O22 | Optional "confirm taps" setting for touch (a drag read as a tap answers a single-choice item). | phones | I2:258 | S | Fewer accidental answers |
| O23 | Identify the "analogical assessment test" and name it in the test-overlap notes (D3; needs the owner's link or screenshot). | guide | DECISIONS.md:13, :16; PLAN.md:80, :98; VERIFY-v1.1.md:13; STATE.md:9, :33; R4:579, :582 | S once named | The owner's ask 6, made specific |
| O24 | Owner question never asked: may the guide translate effect sizes into IQ points (SD 15)? No such translation is in the guide. | guide | R4:466, :587 | S | The community reads results in IQ points |
| O25 | "DAT scores" still appears in negations (Library card and six bridges). R3 §6 lists the phrase to avoid, R3 §10.1 recommends the content: ambiguous which rule wins. | UI (texts) | RV-section-overlap.md:129 (N1); js/ui/library.js:468; js/ex/{angles,cubes,form,openings,patfold,patviews}/learn.js bridges | S | Trademark-safe wording |
| O26 | The guide's ADA reference links the DAT page, not the validity-study PDF (optional; N12 is missing from G1's applied list). | guide | RV-guide.md:167 (N12); G1.md:12; docs/guide/guide.html:1925 | S | Readers can check the source |
| O27 | fit.py's Watch check measured Hole Punch before its scroll under load: 1 failure in the full suite, passes alone. | tests | STATE.md:39; VERIFY-v1.1.md:12 | S | A flaky suite hides real failures |
| O28 | Section practice on a phone held sideways is untested (section.py runs 390×844 and 1280×860 only). | tests | RV-section-overlap.md:242 (U1); tests/e2e/section.py:105 | S | Section chrome may not fit sideways |
| O29 | Openings: feature visibility is checked by `featuresSeen`, shared by generator and validator, so it has no independent check (rule 4). | tests | RV-dat-style-B.md:318, :527; js/ex/openings/gen.js:768, :867 | M | A hidden deciding feature would go unnoticed |
| O30 | Painted Cubes: the optional extra proof (brute-force search over height maps that render the same) is not in the tests; the independent ray cast is. | tests | R3:638 | M | Stronger proof of one right answer |
| O31 | No whole-app accessibility or phone-usability review as PLAN M8 lists; accessibility was checked inside the per-area reviews and by fit.py and harness keyboard play. Ambiguous whether that was meant to count. | tests | PLAN.md:88; VERIFY-v1.1.md:26 | M | Screen-reader and keyboard-only players |
| O32 | Developer docs not updated for 1.1: EXERCISE-GUIDE.md is unchanged since 1.0 (PLAN M7 asked for it), and neither it nor ARCHITECTURE.md describes `pat`, `experimental`, `requires`, the `position` answer, `ctx.practice`/`ctx.demo` or the phone-fit variables (`--pl-avail`, `--pl-w`, `--pl-col`). | tooling | PLAN.md:84; CONTRACT-v1.1.md:27; js/ex/registry.js:26-27, :42, :98-104; git log of docs/dev/EXERCISE-GUIDE.md (last change f10f7db) | M | Contributors build exercises from these docs |
| O33 | Slow node tests: Openings 3–7 min and Knots 8–15 min at 10,000 seeds; CI allows 30 min for the whole node suite. | tooling | B6.md:135; B4.md:7; RV-guide.md:182; .github/workflows/tests.yml:11 | M | Slower fixes |
| O34 | Release housekeeping: no v1.1.0 tag (the proxy refused it; the owner can add it under Releases); the CI result on 224228f is still to be checked (the lead checked it later on 14 Nov: passed); the v1.0 preview artifact still shows 1.0. | tooling | STATE.md:16-18 | S | A tagged release and an up-to-date preview link |
| O35 | Reckon study for v1.2: rated levels with 3–4 legs and tighter tolerances, final in-place rotations, or graded continuous error; relaxing R1's item rules; return items where "true direction + average distance" hits 52–97 %. | Reckon, Homing | DECISIONS.md:47, :50; STATE.md:34; B3.md:101-112; RV-reckon-homing.md:38 | L | Easy routes can be passed from the turns alone |
| O36 | Comfort: a one-time "stop if you feel unwell" notice before the first route outside Watch, Try, Go (today only a Watch part card and Track's motion notice exist), a pause card after about 3 min of motion, a gentle reduced-motion profile (1.2 m/s, 30°/s, 0.6 s ramps); optional field-of-view narrowing on large screens. | Reckon, Homing | RV-reckon-homing.md:261 (N14); R1:356-359, :459; B3.md:134; js/ex/reckon/learn.js:26 | M | Motion sickness |
| O37 | Later Reckon rungs: mid-route probes ("point to the start now"), curved legs, active steering ("firefly" type). | Reckon | R1:117, :344, :400, :426 | L | Trains keeping the home vector as you go |
| O38 | A drift trend over weeks (median drift with its range) on Progress. | Reckon | R1:408 | M | See accumulated error fall |
| O39 | The tip "After each turn, say to yourself where the start is" shows on Try 2, a straight walk with no turns (first tip whose trigger fits: route level 0). | Reckon | RV-play-nav-knots.md:138; B3.md:193; js/ex/reckon/learn.js:35, :40; js/ui/play.js:1466 | S | A confusing tip in the tutorial |
| O40 | Reckon feedback wording: "0 % too far" on exact answers; the drift line counts route plus walk back without saying so and gives no yardstick; the habit chart has no axis and "Filled: right" reads as a direction; the map label "you" (suggested "your answer"). | Reckon | RV-play-nav-knots.md:112, :115, :118, :122; js/ex/reckon/learn.js:141-177 | S | The most useful feedback is hard to read |
| O41 | Dial words under 12 px: on tall phones they show at 8.5 dial units on any circle from 8.5rem (136 px), while the CSS comment says that reaches 12 px only from 187 px (the tester measured about 7 px in Watch). | Reckon, Homing | RV-play-nav-knots.md:143; B3.md:193; css/ex/homing.css:143-146 | S | Legibility |
| O42 | Homing's solution map draws landmarks on a ring round the end point, so their directions disagree with the 3D view seen from the start. | Homing | RV-play-nav-knots.md:70; B3.md:193; js/ex/homing/view.js:619-627 | M | Feedback contradicts what was seen |
| O43 | Homing's exercise page puts a long note in research terms right under the goal (the tester read it before the rule; ambiguous whether "the rule" meant How to play). | Homing | RV-play-nav-knots.md:71; js/ui/library.js:50, :521 | S | Beginners meet jargon first |
| O44 | "Magic window" (gyroscope) variant with its own rating: R1 says not for 1.1, a possible later variant. | Reckon, Homing | R1:376-377; I2:232 | L | Optional; a different, easier task |
| O45 | Research follow-ups behind Reckon: one more search for a randomised path-integration training study with a transfer test; seven papers flagged as core dependencies not read in full (Klatzky 1998, Stavropoulos 2022, Lakshminarasimhan 2018, Wiener & Mallot 2006, Wiener 2011, Fernandes & Feiner 2016, Cao 2018). | Reckon | R1:228; docs/research/v1.1/ACCESS.md:24-31 | M | Flow levels, controls and strategy cards rest on unread papers |
| O46 | Knots mirror variant ("Same knot or its mirror?" with 3D tubes) and the 3D "pull tight" tutorial demo; Knots draws no 3D today. | Knots | DECISIONS.md:22; PLAN.md:49, :61; STATE.md:35; VERIFY-v1.1.md:10; B4.md:108; js/ex/knots/gen.js:9; R2:32, :742 | L | The planned fourth variant |
| O47 | R2's other later ideas: link sub-variant (rope through a ring), three-ring version, Tuck, Hang (a separate exercise), a tube look for Pull, a colour gradient along the rope. Labelled later or optional, not commitments. | Knots | R2:329, :338, :361, :367, :602, :642, :787 | L | Variety |
| O48 | The rope plate on a landscape phone may be under R2's 320 px floor (297–318 px, computed from CSS; unconfirmed). | Knots | RV-knots.md:124 (U1) | S | Crossings harder to read sideways |
| O49 | Missing View Phase B: profile solids (slopes, notches, through-holes), built on the Openings model. | Missing View | R3:536; B6.md:131 | L | Closer to the real format |
| O50 | Openings parts of R3 §8.5 not built: quarter-circle notches, interaction outlines and "face, not outline" foils (items with interactions are rejected), a strict-superset foil, a 15 % proportion level, the test report of congruent silhouettes. | Openings | R3:660, :678-679, :691, :705; B6.md:128; js/ex/openings/gen.js:770 | L | Harder top levels |
| O51 | Form parts of R3 §8.6 not built: L-, T- and U-prisms (non-convex), the net-distance dim, the net-adjacency foil, a show-me that animates the fold (it letters landmark faces). | Form | R3:715, :730-731, :749; B6.md:132 | L | Variety and a clearer show-me |
| O52 | Missing View Watch: hold on the dotted-line step until a tap. Now the step lasts 4.2 s and every caption at least 3 s; a step that waits needs the runner. | Missing View | RV-play-dat.md:124; B6.md:119-120 | M | The deciding rule is easy to miss |
| O53 | Openings show-me turns only the overlay on the chosen opening; the outline over the solid is not turned (no fix recorded after the fresh-player test). | Openings | RV-play-dat.md:100 | M | The show-me looks as if it ends wrong |
| O54 | Form: the See-solution badges (A, B, C, "✓ Folds from it") cover most of the solid on a phone (no fix recorded). | Form | RV-play-dat.md:195; js/ex/form/view.js:185 | S | The answer's evidence is hidden |
| O55 | Hole Punch fold panels are about 80–100 px on phones (no fix recorded; not re-measured). | Hole Punch | RV-play-dat.md:156 | M | Holes are hard to see |
| O56 | Painted Cubes: the overlay marking hidden cubes is busy (badges over the cubes in front; still readable). | Painted Cubes | RV-play-dat.md:174 | S | Cluttered solution |
| O57 | Painted Cubes: counting visible cubes only is right on about 61 % of items, "open for review"; "column tops only" is not in the test. | Painted Cubes | DECISIONS.md:21; RV-dat-style-A.md:287 (§11); js/ex/cubes/gen.js:299 | M | Hidden cubes decide only about 39 % of items |
| O58 | Angles: no 1.5° gap level on large screens (R3); B5 chose a 2° floor everywhere, not logged in DECISIONS (line 21 logs only the dropped 8° level and arm target). | Angles | R3:603, :610; B5.md:12 | M | Less headroom for strong desktop players |
| O59 | Fold: the idle-fold phrase says "2 folds that do not matter" where 2 folds cap it at 1 (Hole Punch's phrase now says "up to"). | Fold | RV-dat-style-A.md:345 (§15); js/ui/library.js:97 | S | A level label that is not true for some items |
| O60 | Orient: a 3D tabletop version ("later" in v1.0's task research). | Orient | /home/claude/vsi-trainer/research/B-tasks.md:160 | L | Variety in perspective taking |
| O61 | Exercises for closure speed (CS), spatial scanning (SS) and imagery (IM): v1.0 backlog. | new exercises | /home/claude/vsi-trainer/research/B-tasks.md:168 | L | Broader coverage of visuospatial abilities |

## DONE after all

| Item | Called open in | Where it is done |
|---|---|---|
| `ctx.practice` / `ctx.demo` flags (Try answers out of Reckon's habit line; no silent first walk in Watch) | REQUESTS-v1.1.md:39 (never marked DONE); B1.md:184 | js/ui/play.js:540, :845; DECISIONS.md:48 |
| Show-me after an answer scrolls the stage above the pinned bar on phones | B2.md:93 | js/ui/play.js:270-272; DECISIONS.md:32 |
| Spatial Check practice time from the active-time clock | B1.md:112 | B1.md:124; commit 39d17f8 |
| longrun.py not run after the time box | B1.md:116 | STATE.md:39 (desktop and phone long runs clean) |
| ARCHITECTURE §8 described 10-column rows and record v1 | B1.md:110 | docs/dev/ARCHITECTURE.md:150-156 |
| ENGINE.md §11 Lab cluster B without Reckon | G1.md:51 | docs/dev/ENGINE.md:131 |
| Stale header comments (Reckon speeds, the Check's "about 15 minutes") | RV-guide.md:189, :191 | js/ex/reckon/gen.js:20; js/ui/check.js:3 (commit 92df93c) |
| Knots Pull seed 530622980 failing at 2,000 items | RV-guide.md:183 | B4.md:58-70 (parallel segments report no crossing) |
| Knots "descend" tip that never applied to Pull items, first left as is | RV-knots.md:98 (N3); B4.md:112 | Replaced in the tutorial round: B4.md:91-94; js/ex/knots/learn.js:45-52 has no such tip |
| Today's plan cache ignored the focus and the test pause | RV-section-overlap.md:250 (U2) | js/ui/play.js:2420 |
| A 2 px width change could void desktop walks | RV-reckon-homing.md:269 (U1) | B3.md:121 (only changes over 20 px, or a screen-class switch) |
| Reckon trial rows kept one number (angle and distance error mixed) | RV-reckon-homing.md:187 (S5) | DECISIONS.md:43; `value2` column, js/core/store.js:68-69. Drift and walked direction are not stored as their own columns. |
| Openings' drawn solid not validated | RV-dat-style-B.md:318 (#15) | tests/node/openings.test.mjs:66-89 (closed surface, every face on the solid). The shared `featuresSeen` stays open (O29). |
| Openings foil caption "one notch, step or cut differs" | RV-dat-style-B.md:310 (#12) | js/ex/openings/learn.js:74 |
| Angles size "right" covers 70–110°; Hole Punch idle level 2 capped to 1 | RV-dat-style-A.md:341-346 (§15) | js/ui/library.js:116-119 ("angles near a right angle (70–110°)"), :102 ("up to 2 folds the punch misses"). Fold's phrase stays open (O59). |
| Angles "laser" pose (optional in R3) | R3:582 | js/ex/angles/gen.js:50, :79 (pose 'aligned': one arm horizontal) |
| A slanted fold before the Hole Punch Try items (suggested: in the Watch) | RV-play-dat.md:153, :159 | Done another way: Try 3 brings the first slanted crease with its tip; the Watch stays at the easiest level (B5.md:96-101) |
| Reckon report-only solvers (encoding-error model; distance by last leg, path, time, fixed) | R1:308-322 (§6.4) | tests/node/reckon.test.mjs:335-355 |
| Invariant cross-checks against published knot tables (optional) | R2:700 | tests/node/knots.test.mjs:49 (Rolfsen table values via the Knot Atlas) |
| A dark theme colour | I2:218 | js/ui/app.js:309-315 (theme-color follows `--paper`) |
| v1.0 optional or "later" features: off-screen challenges (Fold, Nets, Views), the delayed check about 28 days after training slows, the Lab crossover | /home/claude/vsi-trainer/PLAN.md:21, :85, :144; /home/claude/vsi-trainer/PHASE-B.md:26 | js/ex/fold/learn.js:85; js/ex/nets/learn.js:99; js/ex/views/learn.js:4-5; js/engine/assess.js:143-146; js/engine/model.js:96; js/ui/lab.js:152-160 |
| v1.0 review checklist: View Match "farthest view" per level; Nets 2×2-block rule | /home/claude/vsi-trainer/CLAUDE.md:52 | tests/node/viewmatch.test.mjs:114-140 (per-level shortcut counts); Nets rationed to 57.2 % (/home/claude/vsi-trainer/CLAUDE.md:89) |
| v1.0 note: View Match objects small on phones | /home/claude/vsi-trainer/CLAUDE.md:92 | B2.md:40, :52 (View Match fitted at 844×390 and 360×640) |
| Section review "pacing line" | R3:788 | js/ui/section.js:671-680 (time per item per part against the ~40 s pace; a table, not a line) |

## DROPPED (or kept by design)

| Item | Asked for in | Decision |
|---|---|---|
| Knots "which moves tie it" and naming knots | R2:32-34; PLAN.md:50 | DECISIONS.md:10 |
| Angles 8° gap level; arms ≥ 90 px on phones | R3:603, :609; RV-dat-style-A.md:227 (§7) | DECISIONS.md:21 (arms later raised to 0.7·L, B5.md:77-83) |
| Painted Cubes hidden-supports dim; asking N = 5 | R3:647; RV-dat-style-A.md:190, :212 | DECISIONS.md:21, :23, :28 |
| Hole Punch one-fold items and 4 options | R3:504-528 (§8.1) | DECISIONS.md:21 |
| Crease symmetry (Hole Punch, Fold) and Openings corners plus proportions reported, not bounded; most-featured face bounded at 50 % | RV-dat-style-A.md:40; RV-dat-style-B.md:98, :138 | DECISIONS.md:26, :40, :45 |
| Reckon and Homing turn-only answers not bounded; a fixed answer exempt on 11 easy cells | RV-reckon-homing.md:38 | DECISIONS.md:47, :50 (the v1.2 study is O35) |
| Knots generation: untie p95 about 42 ms, no idle pre-generation, timing test bounds only the hardest params | PLAN.md:64; RV-knots.md:116 (N7) | DECISIONS.md:41, :49 |
| Knots legibility below R2's spec (stroke 4.5 px, bend about 8 px, open gap about 33 px) | R2:605 (§5.2); RV-knots.md:111 (N6) | DECISIONS.md:41, :49 |
| Knots Try untie item on a 5_2 | PLAN.md:62; R2:836-855 (§7.5); RV-knots.md:123 (N9) | DECISIONS.md:41 |
| Knots show-me stops before a move on some items (about 7 % of link items) | B4.md:110 | DECISIONS.md:49 |
| Openings solid twice as large on phones (now about 1.4×, one shared scale) | RV-play-dat.md:103 | DECISIONS.md:55 |
| Noted tests and the Check's answer in the per-trial CSV | RV-section-overlap.md:213 (N20); R4:562 | DECISIONS.md:34 (JSON backup and research export only) |
| Train pins skipping the test pause (latent) | RV-section-overlap.md:218 (N21) | DECISIONS.md:35 (known limit; nothing in 1.1 writes pins) |
| Section: free navigation across the whole section; forms A–C | R3:786, :790 | DECISIONS.md:33 |
| "Turn upright" cards for motion items held sideways | PLAN.md:29; I2:245 (§11 #5) | DECISIONS.md:31 (two-column layouts instead) |
| Separate phone and desktop ratings for Openings and Missing View | R3:824 | DECISIONS.md:15 (Track, Reckon, Angles; Homing since 1.0) |
| Reckon as a Homing variant (R1's fallback) | R1:451-454 (§8.6) | DECISIONS.md:9 |
| The community member's original path-integration code | BRIEF.md (13 Nov) | DECISIONS.md:6 |
| Daily Challenge leaves out paused exercises | RV-section-overlap.md:77 (S4) | DECISIONS.md:29 |
| Exercise codes PAT-1…PAT-6 | CONTRACT-v1.1.md:15 | DECISIONS.md:17 |
| By design: scored DAT-style items show no question on phones | RV-play-dat.md:99 | PLAN.md:27 (goal and tips behind Help on phones) |
| By design: "See solution" after some right answers only | RV-play-dat.md:122 | Offered after a right but slow answer: js/ui/play.js:1214-1229; /home/claude/vsi-trainer/PHASE-3.md:22 |
| By design: the long "perceptual-judgement practice" tag ends in "…" in the phone HUD | RV-play-dat.md:134 | css/play.css:319 (cards show it whole) |
| By design (v1.0): Views "to object", checking one view at a time is reported, not balanced | /home/claude/vsi-trainer/CLAUDE.md:97 | js/ex/views/gen.js:341-343; tests/node/views.test.mjs:191 |
| By design: interrupted Train, Path and Speed sessions end on their summary instead of resuming | I1:323 (an option); PLAN.md:20 | js/ui/play.js:1863-1873 (the summary is restored; the Daily resumes) |

## Notes

- **Not swept here.** The v1.0 research recommendations without an open, later, future or backlog label (for example opt-in reminders, community goals and comparing tutorial variants in research/D-motivation.md) were not checked, per the brief. The gap between Parallax and the 11 Nov standing rules is in docs/dev/v1.2/standing-rules-gap.md; O1–O3 and O13 list only what DECISIONS.md:16 names.
- **Ambiguous rows.** O25 (which R3 wording rule applies), O31 (whether per-area accessibility checks were meant to count), O43 (what "the rule" meant), O48 (computed, not measured), O58 (a builder's choice never logged).
- **Seen while checking, not listed by any source (not counted above).** The repository CLAUDE.md still says "11 procedurally generated exercises" and its code map lists none of the 1.1 files (CLAUDE.md:3, :12; clock.js, section.js, overlap.js, the eight new exercises). Leftovers from the v1.0 build: placeholder screens in js/ui/app.js:487-579, the tour stub at js/ui/app.js:678, an unused `.px-panel[data-sample]` style at css/base.css:333-334, and an empty PENDING comment naming PAT-1…PAT-6 at index.html:112-114.
