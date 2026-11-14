# PLAN v1.2: backlog and proposed order (draft, not approved)

Status: draft of 14 Nov 2026, written at the v1.1 release, when the owner asked whether everything for v1.2 was in one plan. It was not: the items were spread over STATE, DECISIONS, the reviews and the research notes. This file collects all of them. v1.2 itself runs under the owner's standing rules (decision D1): Phase 1 research and a plan message, then the owner's go. On approval this file becomes docs/dev/PLAN.md, and v1.1's plan moves to PLAN-v1.1.md.

Sources, with full detail and file references:
- docs/dev/v1.2/standing-rules-gap.md: Parallax against the standing rules, 67 requirements (35 meet, 21 partly, 8 missing, 3 conflict). IDs such as PB1, ME5, C2.
- docs/dev/v1.2/deferred-sweep.md: every item deferred, left open, or recommended and not built in 1.0 and 1.1, checked against the code. IDs O1, O2, …
- DECISIONS.md, 13 Nov: D1 (standing rules and the game layer in v1.2) and D3 (the analogical test is named for v1.2).

## The aim
v1.2 makes Parallax a trainer people want to open every day without bending the science: a game layer built from the harm-free versions of points, chains and challenges; plateaus that are detected, acted on and explained; and every exercise tagged with the transfer bet it makes, with exposure logged so the community's pooled exports can test the bets. It redesigns the Spatial Check so that one person's real gain can show within weeks; today, in the engine's own simulation, 96.5 % of learners whose probe ability rises by half their training gain still read "unclear yet" after 60 days (ENGINE.md §16). It settles the analogical-test question from 1.1 once the owner names the test, and it deepens the 1.1 exercises and clears the polish list.

## Waiting on the owner
1. **The analogical test (D3):** the name of the test, or a link. Nothing else in v1.2 waits on it.
2. **Three forks for the v1.2 plan message.** Recommendations from the audit (§7), to be checked by Phase 1 research:
   - How much game: points for skill only, ranks on top of the honest levels, a gain-framed daily chain with automatic freezes, and a seeded weekly challenge with a result card. Comparison happens through cards and codes in the Discord; there is no in-app leaderboard.
   - How much time measurement may take: a trend model over all checks, a short embedded probe block (about 3 minutes) every third session, and the full check monthly.
   - Baseline first or play first: a 5–6-minute baseline inside the first session, after a two-minute tutorial, and the second baseline before the next session's rated items.
3. **Two items that need the owner's yes under the standing rules:**
   - CC BY-SA 4.0 for the README and the docs prose. This is a licence change; the code stays MIT.
   - Three v1.0 lines that say more about Chimera than the fixed text. Keep them, or cut them back to "built by the Chimera community on Discord"?
     - LICENSE: copyright "the Parallax contributors (the Chimera community, …)".
     - LICENSE-GUIDE.md: "Parallax contributors and the Chimera community".
     - The guide: "made for and with the Chimera community".

## Milestones (proposed; Phase 1 may reorder them)

### 0. Research and plan (Phase 1)
Notes go in docs/research/v1.2/, with the read depth of every source. One docs/research/ACCESS.md merges the v1.0 and v1.1 lists (gap R5).
- **Game layer:** which mechanics raise practice without lowering learning or intrinsic motivation; what current trainers and learning apps do; a design for each mechanic, naming the harm it avoids.
- **Measurement:** detecting one person's change within weeks. Covers trend and state-space models, information per minute, embedded probes and the practice effect; proved in tests/node/sim.mjs before any building.
- **Plateaus:** detecting a stall from the log, and which changes have evidence (strategy switch, variability, spacing and rest, difficulty, speed).
- **Transfer portfolio:** the list of mechanisms for `def.bet`; real implementations of relational comparison and bridging; at least one new or under-tested bet; near and far probe designs.
- **The analogical test, once named:** its formats checked for overlap against all 19 exercises and the probes.

Acceptance: the plan message (concept; what was kept, changed and dropped; gaps; decisions; unopened papers) and the owner's go.

### 1. Standing-rules switch, the quick part (S–M)
- **CLAUDE.md:** rewritten under 150 lines. Rules 1, 2, 9, 10, 11 and 12 are reworded, rules 13–15 are new (audit §6), and the code map is current; it still says 11 exercises (gap R1).
- **Chimera:**
  - the full welcome on first launch, and a one-tap card on later launches that blocks nothing (C2);
  - the link on the first line of the README (C4);
  - an invite with Copy on both tutorial end screens (C6);
  - invites beside personal bests, achievements, Path passes and check results (C8), and in the export and backup dialogs (C10);
  - the C13 lines, as the owner decides.
- **Modes:** a "Right when" line for each mode in the practise sheet and the Lab, and a mode suggestion on Today when the log points to one (M3).

Acceptance:
- The pop-up handling in the shell, section and longrun tests is updated.
- A node test checks that every share text and every tutorial end carries the link.
- Screenshots at 360×640 and on desktop.

### 2. Plateau-breaking (L)
- **Detector (PB1):** one per exercise, over the trial log. It fires when:
  - learning progress stays near zero over at least 60 rated answers in 3 sessions; or
  - the level moves only within its noise band for two weeks; or
  - a Path stage is still not passed after N sessions.
- **Change menu (PB2):** each change carries its reason and source.
  - the other strategy card, with a check-in;
  - the interleaving stage moved;
  - a style switch for a week;
  - the weakest dimension drilled;
  - a 3–4-day rest;
  - Speed offered when the player is accurate but slow;
  - a variant swap.
- **Plateau card (PB3, C9):** on the summary and on Today. It says what changed and why, and a follow-up says whether it helped. It carries the Chimera invite. Plateau events go into the record and the export.

Acceptance:
- Simulated learners who plateau trigger the detector within the stated window (sim.mjs).
- Learners who improve trigger it at most 5 % of the time.
- The card appears in a longrun.

### 3. Transfer bets, tagged and logged (M–L)
- **`def.bet`** in PX.ex.define, from a fixed list (T2). It shows on the exercise page and in How to play, and goes into the research export and the guide. A node test checks that every training exercise has one.
- **Exposure logging (T3):** show-me plays, strategy cards opened, and bridges and off-screen challenges viewed.
- **Wording (S3):** a "The bet" line per exercise, and a "Test the bets with us" section in About, the Lab and the guide.
- **Real implementations of the thin bets (T1):**
  - relational comparison: paired items that share a principle, with a "what is the same?" step;
  - bridging as short applied tasks.

### 4. Game layer (L)
Built from the Phase 1 design and fork 1:
- points for skill (difficulty-weighted right answers, never time or logins), and ranks or tiers on the honest levels;
- a gain-framed daily chain with freezes and repair;
- a seeded weekly community challenge with its card;
- Share at personal bests and milestones (F4–F6);
- "firsts", and a start-versus-now card in the first week (F2, P2);
- a game-feel pass that keeps the instrument look (LI2);
- the list of stock patterns the visual concept avoids (LI4).

Each mechanic gets one DECISIONS line naming the harm it avoids. Nothing decorative runs during a stimulus (F7).

Acceptance:
- Every mechanic stays outside `body.px-stim`.
- The shortcut and timing tests are unchanged.
- A fresh-player test of the first week, over simulated days.

### 5. Measurement that shows a gain within weeks (L)
- **Sensitivity (ME5):** a trend model over all checks instead of each check against the baselines; more information per minute, with response time in the estimate; embedded probe blocks between checks; and the probability of a real gain shown beside the interval.
- **Near and far probes (ME1):** original and solver-checked. Mechanisms and Level are placed on the ladder.
- **Baselines (ME2):** per fork 3.

Acceptance, proved in sim.mjs before building: with a real composite gain of 0.5 SD, at least 60 % of simulated learners read a likely gain by week 4, and at most 5 % of learners without a gain do.

Risk: this is the largest milestone. If no design meets the acceptance in simulation during Phase 1, it moves to v1.3, and the plan message says so.

### 6. Faster progress (L)
- Per-dimension offsets learned from the residuals the engine already keeps, so strong dimensions are pushed as well as weak ones (P1).
- A fluency target inside Train once accuracy settles, using Speed's deadlines on a share of items (P1).

Acceptance: per-dimension targeting in sim.mjs stays within the stated band, and shortcut accuracy does not rise.

### 7. Exercise depth (from the sweep)
SWEEP-DEPTH

### 8. Fixes and polish (from the sweep)
SWEEP-POLISH

### 9. Voice (L)
Rewrite About, the README, the Library notes and guide chapters 1, 5 and 8 in a confident, curious "test the bets with us" voice. Lead with what Parallax trains, bets on and measures, and keep one accurate limit where a claim needs it. The test-hygiene and ADA lines stay (S5).

### 10. Verification and release
- **Two-minute start (TM2):** the fresh-agent test on all 19 exercises and the first Spatial Check, on phone and desktop, with times recorded in VERIFY. Form goes first: it took over 2 minutes in 1.1.
- **Reviews and runs:** independent reviews (code, items, claims against code, guide, play-through), long runs, and the real-phone checklist for the owner.
- **Release material:** the guide, the single file, the Discord post, the build log and the playbook.

## If v1.2 has to be smaller
Milestones 0–4, 9 and 10 make the standing-rules switch, and they come first. Milestone 5 is the largest gap but the riskiest build, so it goes in only once the simulation proves a design. Milestones 6–8 can ship in any later version; nothing in them blocks the switch.
