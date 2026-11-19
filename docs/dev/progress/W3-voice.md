# W3-voice: progress log (PLAN milestone 10, voice; the guide brought to 1.2)

Started 2026-11-19 12:15 UTC. Task from the lead: About, the README, the Library notes and guide chapters 1, 5
and 8 in the "test the bets with us" voice (CLAUDE.md rules 1-3, 10-13; RULES "The bar", "Stance on
transfer"); every other chapter of the guide brought to 1.2's facts; figures and the PDF last; a 1.2.0
CHANGELOG entry (dated by the lead at release); `--shard` in CLAUDE.md's commands. Then a self-check: the
six-word quote scan against BRIEF.md, and a list of claims with the code behind each.

## Files
- Mine: README.md, CHANGELOG.md, js/ui/about.js (texts), docs/guide/guide.html, docs/guide/guide.css,
  CLAUDE.md (commands section only), this log.
- js/ui/library.js: texts only (W2-core owns the code); each edit is listed in docs/dev/v1.2/requests.md.
- tools/shots.py and tools/build-pdf.py: the guide's figures and the PDF's metadata (unowned since wave 1;
  the lead gave me the figures and the PDF); listed in requests.md as FYI.

## Intent (before the multi-file change)
1. README, About, Library notes: what Parallax trains, bets on and measures in 1.2; one accurate limit
   where a claim needs it; no section opening with what training cannot do. Keep the hooks' anchors
   (About's data-section values 'claims', 'hygiene', 'refs'; overlap.py's phrases; bets.py's order).
2. The guide: "What's new in 1.2"; chapters 1, 5, 8 rewritten; the rest to 1.2's facts; Missing View last.
3. Figures (shots.py) and the PDF (build-pdf.py), pages looked at.
4. Self-check: quote scan; claims with code.

## Log
- 2026-11-19 12:20 UTC, step 1: README rewritten (what it trains, bets on, measures; the game; test hygiene in
  one paragraph; `--shard` in the commands; game.py and bets.py in the browser list), About (lead names the bets and
  the check; 'claims' retitled "What practice does, and how Parallax measures it", three bullets instead of five, the
  limit once; Track: one label line, the evidence through the bet; the tool line folded into Test hygiene; Your data:
  the community export without a name or device details unless ticked), the Library notes (requests.md line to
  W2-core), CLAUDE.md's commands (`--shard k/n`). Anchors kept: About's data-section values (claims, hygiene, refs;
  bets.js places "Test the bets with us" after claims), overlap.py's phrases, O.ANALOGY, data-about="testsoon".
- 2026-11-19 12:25 UTC, the coordinator's two items (PLAN milestone 9, O24 and O26): O26, the guide's ADA
  reference links the DAT Validity Study (March 2026): its address is not in the research notes (R3 line 851 gives
  "ada.org/…/education/dat_validity_study.pdf"); found on the ADA's "newsletters and resources" page of the DAT
  section (one search, one fetch, 19 Nov): https://www.ada.org/-/media/project/ada-organization/ada/ada-org/files/education/dat_validity_study.pdf
  (the page adds a cache query, rev=…&hash=…, left out). O24: no effect size is converted into IQ points anywhere in
  the guide; checked by a scan at the end (see Self-check).
- 2026-11-19 12:26 UTC, the coordinator's spot check of fa49a67: calibration is "a bet whose transfer no study
  has tested yet" (note T1 lines 21, 175: the bias is corrected within a session, Noel et al. 2020). README fixed;
  js/ui/bets.js (W2-bets stopped; FYI to the lead in requests.md): About's sentence and the exercise page's tag
  ("new, transfer untested"); the guide's marked page. node bets 589/0.
- 2026-11-19 12:26 UTC, guide step 1: cover and contents for 1.2.0 (date "November 2026": the lead adjusts at
  release if it slips), "What's new in 1.2" (two pages replace 1.1's: eight panels, "Also in 1.2", the record),
  chapter 1 rewritten as "What Parallax is" (trains, bets, measures; what the numbers and labels mean; how we word
  claims). The run head reads 1.2.0. Page references to pages still to write (ex-centralpoint, dims, plateaus,
  check) read "?" until those pages exist.
- 2026-11-19 12:34 UTC, guide step 2: chapter 2 (the first session: one tutorial, then Baseline 1 or
  Later, then Train; Baseline 2 and the blocks; a first week; a session with the stretch ring, cards between items
  and the 1.2 summary; phones: Progress tabs, the pinned reading strip, Confirm taps; Settings as the app's
  sections). Chapter 3: the ability codes (LE for Central Point, MA for both far probes), the 2 × 2 now reaches all
  four cells (Central Point's def.cell is extrinsic-static; Pattern Memory and Level stay untrained there), a
  "Bet" line on every card (def.bet and the hosted layers), Views' starter level, Homing's map from the start,
  Reckon version 2 and motion comfort on the navigation page (play.js MOTION 180 000 / 300 000 ms; gentle 2/3 speed,
  0.6 s ramps, 40 s), Central Point's page (new: card, the method, why the average is not the answer, what is known),
  the DAT-style section (range tags; the focus; one limit with the validity study as context) with the six formats as
  full cards, two a page (version 3 of Openings, Angles, Hole Punch, Painted Cubes and Form from the definitions'
  dims and testRange; Missing View drafted from the working copy's version 3, to be checked last).
- 2026-11-19 12:36 UTC, guide step 3: chapter 4. The modes table (Train on every setting and plateaus;
  Daily v2's ramp and points from release day, share line from daily.js; the weekly Climb; Section practice under
  test conditions); the engine page (set questions unrated, stretch1 before 10 answers, starter items at level 1,
  Angles and Central Point in no similar group: model.js groups); a new page "Your edge on every setting" and
  "Plateaus get a change" (ENGINE §19, §20; progress-sim.md §0, §2; plateau-sim numbers); "Which mode, when" in
  the app's MODE_WHEN words; the simulation panel with 1.2's runs (ENGINE §18, §24).
