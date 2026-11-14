# PLAN v1.2: backlog and proposed order (draft, not approved)

Status: draft of 14 Nov 2026. I wrote it at the v1.1 release, when the owner asked whether everything for v1.2 was in one plan. It was not: the items were spread over STATE, DECISIONS, the reviews and the research notes. This file collects all of them.

v1.2 runs under the owner's standing rules (decision D1). It starts with Phase 1 (research and a plan message), then waits for the owner's go. On approval, this file becomes docs/dev/PLAN.md, and v1.1's plan moves to PLAN-v1.1.md (gap R2).

## Sources
Each source has full detail and file references.
- **docs/dev/v1.2/standing-rules-gap.md:** Parallax checked against the standing rules. Of 67 requirements, 35 are met, 21 partly, 8 are missing and 3 conflict. IDs such as PB1, ME5 and C2.
- **docs/dev/v1.2/deferred-sweep.md:** 61 items that 1.0 and 1.1 deferred, left open, or recommended without building, each checked against the code. IDs O1 to O61. The same file lists 24 items that were done after all and 25 that were dropped by decision, so nobody re-opens them.
- **DECISIONS.md, 13 Nov:** D1 (the standing rules and the game layer come in v1.2) and D3 (the analogical test is named for v1.2).

## The aim
v1.2 makes Parallax a trainer people want to open every day, without bending the science:
- a game layer built from the harm-free versions of points, chains and challenges;
- plateaus that are detected, acted on and explained;
- every exercise tagged with the transfer bet it makes, with exposure logged, so the community's pooled exports can test the bets.

It also:
- redesigns the Spatial Check so that one person's real gain can show within weeks. In the engine's own simulation (ENGINE.md §16), 96.5 % of learners still read "unclear yet" after 60 days, even when their probe ability rises by half their training gain;
- settles the analogical-test question from 1.1 once the owner names the test;
- fixes what players hit in 1.1, deepens the 1.1 exercises and clears the polish list.

## Waiting on the owner
1. **The analogical test (D3, O23).** I need the test's name, or a link. Nothing else in v1.2 waits on it.
2. **Three forks for the v1.2 plan message.** The recommendations come from the audit (§7), and Phase 1 research will check them.
   - **How much game.** Recommended:
     - points for skill only;
     - ranks on top of the honest levels;
     - a seeded weekly challenge with a result card.
     
     Comparison happens through cards and codes in the Discord. There is no in-app leaderboard.

     There are no Duolingo-style streaks. The owner ruled them out on 14 Nov because they make practice anxious and take the fun out, so the daily chain with freezes that the audit recommended is dropped. The rule is now in the standing rules for every tool. Parallax's weekly goal keeps its forgiving weeks-in-a-row count as it is; the owner chose to keep it.
   - **How much time measurement may take.** Recommended: a trend model over all checks, a short embedded probe block of about 3 minutes every third session, and the full check once a month.
   - **Baseline first, or play first.** Recommended: a 5–6-minute baseline inside the first session, after a two-minute tutorial. The second baseline comes before the next session's rated items.
3. **Three small items for the owner.** The standing rules reserve the first two for him; the third is a tap only he can make.
   - CC BY-SA 4.0 for the README and the docs prose (L1). This is a licence change. The code stays MIT.
   - Three v1.0 lines that say more about Chimera than the fixed text (C13). Keep them, or cut each back to "built by the Chimera community on Discord":
     - LICENSE gives the copyright to "the Parallax contributors (the Chimera community, …)";
     - LICENSE-GUIDE.md says "Parallax contributors and the Chimera community";
     - the guide says "made for and with the Chimera community".
   - The v1.1.0 tag (O34). The session's proxy refuses tag pushes, so it is the owner's tap if he wants a release entry: GitHub → Releases → "Draft a new release" → tag v1.1.0 on main.

## Milestones
These are proposed; Phase 1 may reorder them. Sizes: S is under an hour, M a few hours, L a day or more.

### 0. Research and plan (Phase 1)
Notes go in docs/research/v1.2/ and record how much of every source was read. One docs/research/ACCESS.md merges the v1.0 and v1.1 lists (R5).
- **Game layer:** which mechanics raise practice without lowering learning or intrinsic motivation, and what current trainers and learning apps do. For each mechanic, a design that names the harm it avoids.
- **Measurement:** detecting one person's change within weeks. This covers trend and state-space models, information per minute, embedded probes and the practice effect. A design is proved in tests/node/sim.mjs before anything is built.
- **Plateaus:** how to detect a stall from the log, and which changes have evidence: a strategy switch, variability, spacing and rest, difficulty, speed.
- **Transfer portfolio:**
  - the list of mechanisms for `def.bet`;
  - real implementations of relational comparison and bridging;
  - at least one new or under-tested bet;
  - near and far probe designs.
- **Reckon:** one more search for a randomised path-integration training study with a transfer test, and full texts of the seven core papers that were not read in full (O45).
- **The analogical test, once named:** its formats checked for overlap against all 19 exercises and the probes.

Acceptance:
- The plan message (concept; what was kept, changed and dropped; gaps; decisions; papers that could not be opened).
- The decision board the standing rules now ask for, as a private artifact page:
  - exercise cards with a keep/drop switch and each card's transfer bet;
  - every decision as tappable options, with the recommendation selected;
  - look and feel shown rather than described, including 20–30-second playable sketches of the two or three mechanics least sure to be fun;
  - a ranking list and a text box;
  - the papers that could not be opened;
  - a phone device probe;
  - "Accept all recommendations" and "Copy my answers".
- The owner's go.

### 1. Fix first: what players hit in 1.1 (S–M each)
- **Pause and End during feedback (O4).** Both are disabled there today, so ending a session early takes Next, Pause, End.
- **Motion comfort in Homing and Reckon (O36):**
  - a one-time "stop if you feel unwell" notice before the first route;
  - a pause card after about 3 minutes of motion;
  - a gentle reduced-motion profile (1.2 m/s, 30°/s, 0.6 s ramps).
- **Section practice:**
  - the clock is saved only between items, so a reload gives back the current item's time (O9);
  - a reload during the review loses it (O10);
  - flagged item numbers shift when an item is voided (O11).
- **Tutorials:**
  - "Parts" opened during a Watch on a phone leaves the demo playing off screen (O8);
  - the Missing View Watch should hold on the dotted-line step until a tap (O52);
  - the Openings show-me should turn the outline over the solid as well (O53);
  - the new-exercise offer says "about a minute", but fresh players took 1.5–2.5 minutes per Form Try item (O6).
- **Texts:**
  - Fold's idle-fold phrase should say "up to" (O59);
  - Reckon's "after each turn" tip shows on a walk with no turns (O39);
  - Reckon's feedback wording: "0 % too far", the drift line's missing yardstick, an axis-free habit chart, and the "you" label (O40);
  - Homing's exercise page opens with a long research note right under the goal (O43);
  - the summary's median is of right answers only and does not say so (O7);
  - answer times are shown in two formats (O5);
  - decide on "DAT scores" in negations (O25).
- **Engine:** folded-day totals subtract voided and skipped probe rows too (O15).

Acceptance:
- Each fix has a test that fails on 1.1.
- The longrun suites stay clean.
- Fresh-player retests of Form and Reckon.

### 2. Standing-rules switch, the quick part (S–M)
- **CLAUDE.md:** rewritten under 150 lines (R1, S1).
  - Rules 1, 2, 9, 10, 11 and 12 are reworded, and rules 13–15 are new (audit §6).
  - The code map is brought up to date: it still says 11 exercises.
  - The developer docs get the 1.1 contract: `pat`, `experimental`, `requires`, the position answer, `ctx.practice` and `ctx.demo`, and the phone-fit variables (O32).
- **Chimera:**
  - the full welcome on first launch, and a one-tap card on later launches that blocks nothing (C2, O2);
  - the link on the first line of the README (C4);
  - an invite with Copy on both tutorial end screens (C6);
  - invites beside personal bests, achievements, Path passes and check results (C8, O3), and in the export and backup dialogs (C10);
  - the C13 lines and the prose licence (L1), as the owner decides.
- **Modes:** a "Right when" line for each mode, in the practise sheet and the Lab, and a mode suggestion on Today when the log points to one (M3).
- **Playtest mode** (standing rules, interactive check-ins). It is on in the first playable build of v1.2 and in every later test build, and sits behind a setting that is off by default at release.
  - After each exercise, three taps: fun, clarity and difficulty.
  - A note button on every screen.
  - "Copy playtest report": the ratings and notes, with the device, frame timings, errors, performance, play time and where the player quit.

Acceptance:
- The shell, section and longrun tests handle the new pop-up.
- A node test checks that every share text and every tutorial end carries the link.
- Screenshots at 360×640 and on desktop.

### 3. Plateau-breaking (L)
- **Detector (PB1).** One per exercise, reading the trial log. It fires on any of:
  - learning progress near zero over at least 60 rated answers in 3 sessions;
  - a level change that stays inside its noise band for two weeks;
  - a Path stage still not passed after N sessions.
- **Change menu (PB2).** Each change states its reason and source:
  - the other strategy card, with a check-in;
  - the interleaving stage moved;
  - a style switch for a week;
  - the weakest dimension drilled;
  - a 3–4-day rest;
  - Speed offered when the player is accurate but slow;
  - a variant swap.
- **Plateau card (PB3, C9).** It appears on the summary and on Today, says what changed and why, and follows up on whether it helped. It carries the Chimera invite. Plateau events go into the record and the export.

Acceptance:
- Simulated learners who plateau trigger the detector within the stated window.
- Learners who improve trigger it at most 5 % of the time.
- The card shows in a longrun.

### 4. Transfer bets, tagged and logged (M–L)
- **The tag (T2).** A `def.bet` field in PX.ex.define, from a fixed list. It shows on the exercise page and in How to play, and goes into the research export and the guide. A node test checks that every training exercise has one.
- **Exposure logging (T3, O17):**
  - the record logs show-me plays, strategy cards opened, and bridges and off-screen challenges viewed;
  - each trial row stores the answer mode (drag, dial, ± buttons or keys) and the phone's orientation.
- **"The bet" (S3).** A "The bet" line per exercise, and a "Test the bets with us" section in About, the Lab and the guide.
- **Real implementations of the thin bets (T1):**
  - relational comparison: paired items that share a principle, with a "what is the same?" step;
  - bridging as short applied tasks.

### 5. Game layer (L)
Built from the Phase 1 design and the answer to fork 1:
- points for skill, as difficulty-weighted right answers, never for time or logins;
- ranks or tiers on top of the honest levels;
- reasons to come back that never punish a missed day:
  - the Daily Challenge;
  - the weekly challenge below;
  - a "next time" line on the summary (the next Path stage, a review that is due);
  - new variants to try;
- no Duolingo-style streaks: no daily chain, no freezes, and no "don't lose your streak" (the owner's rule of 14 Nov). The weekly goal and its forgiving weeks-in-a-row count stay as they are, by the owner's choice;
- a seeded weekly community challenge with its own card;
- Share at personal bests and milestones (F4–F6, O1);
- "firsts", and a start-versus-now card in the first week (F2, P2);
- a game-feel pass that keeps the instrument look (LI2);
- the list of stock patterns the visual concept avoids (LI4).

Each mechanic gets a DECISIONS line naming the harm it avoids. Nothing decorative runs during a stimulus (F7).

Acceptance:
- Every mechanic stays outside `body.px-stim`.
- The shortcut and timing tests are unchanged.
- A first-week play-through passes over simulated days.

### 6. Measurement that shows a gain within weeks (L)
- **Sensitivity (ME5, O13):**
  - a trend model over all checks, instead of each check against the baselines;
  - more information per minute, with response time in the estimate;
  - embedded probe blocks between checks;
  - the probability of a real gain, shown beside the interval.
- **Near and far probes (ME1):** original and solver-checked. Mechanisms and Level are placed on the ladder.
- **Baselines (ME2):** as fork 3 decides.
- **Alternate forms:** the probes' alternate forms are equated once pilot data exists (O16).

Acceptance, proved in sim.mjs before building: with a real composite gain of 0.5 SD, at least 60 % of simulated learners read a likely gain by week 4, and at most 5 % of learners without a gain do.

This is the largest gap and the riskiest build. If no design meets the acceptance in simulation during Phase 1, it moves to v1.3, and the plan message says so.

### 7. Faster progress (L)
- Per-dimension offsets, learned from the residuals the engine already keeps, so that strong dimensions are pushed as well as weak ones (P1).
- A fluency target inside Train once accuracy has settled, using Speed's deadlines on a share of items (P1).
- Hand-set difficulty steps refitted from the community's pooled exports once enough arrive (O16). The export invite in milestone 2 asks for them.

Acceptance: targeting per dimension in sim.mjs stays inside the stated band, and shortcut accuracy does not rise.

### 8. Exercise depth (L each unless marked)
- **Reckon:**
  - the study that 1.1 deferred: rated levels with 3–4 legs and tighter tolerances, final in-place rotations, or graded continuous error, so that easy routes stop yielding to turns alone (O35);
  - a drift trend over weeks on Progress (M, O38);
  - later rungs: "point to the start now" mid-route, curved legs, active steering (O37).
- **Homing:** the solution map draws landmarks in the directions seen from the start, as in the 3D view (M, O42).
- **Reckon and Homing:** a gyroscope "magic window" variant with its own rating (O44).
- **Knots:**
  - the mirror variant ("same knot or its mirror?") with 3D tubes, and the 3D "pull tight" demo (O46);
  - R2's later ideas: a rope through a ring, three rings, Tuck, Hang, a tube look and a colour gradient (O47).
- **DAT-style:**
  - Missing View phase B: slopes, notches and through-holes (O49);
  - Openings: quarter-circle notches, interaction outlines, "face, not outline" and strict-superset foils, and a 15 % proportion level (O50);
  - Form: L-, T- and U-prisms, a net-distance dimension, a net-adjacency foil, and a show-me that animates the fold (O51);
  - Painted Cubes: decide on the visible-only strategy, which is right on about 61 % of items, and test "column tops only" (M, O57);
  - Angles: a 1.5° level on large screens, or a DECISIONS line for the 2° floor (S–M, O58);
  - Section practice: an optional tally pad for Painted Cubes (M, O12).
- **Older backlog:**
  - Orient as a 3D tabletop (O60);
  - new exercises for closure speed, spatial scanning and imagery (O61).

### 9. Phones, data and tooling (S–M each)
- **Phones:**
  - Progress in tabs or collapsed panels, with jump-to chips; it is 15–20 screens of scrolling today (O20);
  - an optional "confirm taps" setting (O22);
  - Reckon and Homing dial words under 12 px (O41);
  - the Knots rope plate on a landscape phone (O48);
  - Form's See-solution badges cover the solid (O54);
  - Hole Punch's fold panels are 80–100 px (O55);
  - the Painted Cubes overlay is busy (O56).
- **Offline:** a service worker for the GitHub Pages copy, so the home-screen icon starts offline. It is https only, never from files (O21). This is my call under rule 6, logged in DECISIONS.
- **Real phones:**
  - Homing and Reckon walks measured on mid- and low-end phones (median frame ≤ 17 ms, under 5 % slow frames) (O19);
  - a phone-against-desktop validity check for Reckon on community data (O18).
  
  Both need people with phones: the release checklist and a community call.
- **Daily:** a partial Daily attempt resumes by seed, not by position. This changes the saved Daily format, so it needs a migration (O14).
- **Tests:**
  - fit.py waits for Hole Punch's scroll under load (O27);
  - Section practice on a sideways phone (O28);
  - a whole-app accessibility and phone-usability review (O31);
  - Openings' feature visibility gets a check that is independent of the generator (O29), and Painted Cubes gets the brute-force proof over height maps (O30);
  - the slow Openings and Knots node tests sped up or split (8–15 minutes for Knots against CI's 30-minute budget) (O33).
- **Guide:**
  - the ADA reference links the validity study (O26);
  - decide whether the guide may express studies' IQ effects in IQ points, where a study measured IQ. The default is no; in-app numbers never are (O24).
- **Housekeeping (O34):**
  - CI passed on the released 224228f (checked 14 Nov);
  - the tag is with the owner (above);
  - the old v1.0 preview artifact still shows 1.0, and is updated only if the owner asks.

### 10. Voice (L)
Rewrite About, the README, the Library notes and guide chapters 1, 5 and 8 in a confident, curious "test the bets with us" voice. Lead with what Parallax trains, bets on and measures, and keep one accurate limit where a claim needs it. The test-hygiene and ADA lines stay (S5).

### 11. Verification and release
- **Two-minute start (TM2).** The fresh-agent test runs on all 19 exercises and the first Spatial Check, on phone and desktop, with the times recorded in VERIFY. Form goes first.
- **Reviews and runs:**
  - independent reviews of code, items, claims against code, the guide and a play-through;
  - long runs;
  - the real-phone checklist for the owner.
- **Release checklist:** the owner's five-minute checklist is a page of pass/fail taps, each with a note field (standing rules, interactive check-ins).
- **Release material:** the guide, the single file, the Discord post, the build log and the playbook.

## If v1.2 has to be smaller
1. **First:** milestones 0–3 (research, fixes, the quick switch and plateaus), 5 (the game layer), 10 and 11. Together they make the standing-rules switch, and milestone 4's tag (T2) comes with them.
2. **Next:** milestone 6, the largest gap. It goes in only once the simulation proves a design.
3. **Any later version:** milestones 7–9. They block nothing in the switch.
