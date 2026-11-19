# RV-wave2: independent review of PLAN milestones 3–7 (wave 2)

Reviewer: an agent that built none of this wave. Written 2026-11-19 01:21 UTC on `build` at 63d8091 (commits a84cc94..63d8091; other builders' uncommitted edits in the tree were not read). Scope: the plateau card (M3), the bets and their layers (M4), the game layer (M5), measurement, Motion Graphs, Other Way Round and Balance (M6), per-dimension progress and fluency items (M7), against CLAUDE.md's sixteen rules and CONTRACT-v1.2's wave-2 section. Method: code, player-visible texts, CSS and tests read; no browser run, no node run.

Totals: 2 high, 6 medium, 13 low.

## Findings (most severe first)

1. **[High] Balance, the untrained check, gives feedback on the very weighting it measures and states the right answers.**
   `js/ui/measure.js:706-716` (balanceRows: "N of M within the mark", "the far dots counted at X % of their weight", "Y % of the way from the middle house to the mean"), `js/ui/measure.js:724` (the Lab text, shown beside the Start button before the first run: "the bus stop moves toward the middle house … if the far dots started to count for less in the balance point …"), `js/ui/check.js:162-165` (the same rows right after every run).
   A player learns from the Lab that the bus stop belongs at the middle house and that far dots weigh fully, and after each run how far off each bias was; the Lab invites repeat runs ("now and again"), so later runs measure correction to this feedback, not transfer.
   Breaks: PLAN Defaults ("Balance, Central Point's negative-transfer check, must stay untrained"), rule 10 (probes never trained, no feedback), and Balance's own header (`js/ex/balance/learn.js:2-4`).
   Fix: show the player only the date and number of runs (keep the numbers in the record and the export), and word the Lab line without the answers ("does practice change how you weigh far points?").

2. **[High] Rule 5 is broken on nine dimension-level cells, with no scoped exception and no owner.**
   `tests/node/shortcut-levels.test.mjs:70` lists Fold 2, Nets 4 and Slice 3 cells over chance + 10 as KNOWN (DECISIONS 2026-11-18 W2-progress: "the milestone's acceptance line still counts the KNOWN cells as failures"). Milestone 7's leading items (`js/engine/dims.js:77`, one dimension at its edge with the others at their easiest) deal single-dimension cells like these more often than before, so the exposure grows with this wave.
   Breaks: rule 5 (cheap heuristics within chance + 10 on every item pool; an exception needs a DECISIONS line and a per-level test) and PLAN milestone 7's acceptance.
   Fix: give the three generators an owner (rebalance or a scoped exception with its test) before release; until then keep leading items out of the KNOWN cells.

3. **[Medium] Daily v2's epoch 2 starts on 19 Nov 2026, before v1.2 ships, so one Daily number now means two different challenges and v1.1 results get read as ramp results.**
   `js/engine/daily.js:48` (`{ n: 2, from: '2026-11-19', ramp: true, … }`). The live v1.1 deals its mid-range Daily for every date from today; v1.2 deals the ramp for the same "Daily #N". After the upgrade, `history()` (`:156-168`), `archive()` (`:180`) and `status()` read a v1.1 entry on those dates as a ramp entry: `pointsOf()` (`:135`) turns its outcomes into ramp points for items that were never dealt (the histogram, "best X of 36 points", the share line "P of 36 points"); a v1.1 partial attempt resumed under v1.2 (`:207`) credits its old outcomes as ramp points for different items.
   Breaks: gap C11's frozen epochs ("the same items for a date whatever the version"), rule 2 (numbers match what happened).
   Fix: set epoch 2's `from` to the release day at release (a release-checklist line and a test), and count ramp points only for entries that carry `points` (or an epoch stamp written with the entry).

4. **[Medium] The game layer reads the large-display rating only, so phone players see wrong numbers for Track, Homing and Reckon.**
   `js/engine/game.js:89` (grades: the "Now" column), `:260` (withinReach), `js/ui/game.js:402, 407` (start versus now), `js/ui/atlas.js:85` (the band "at your level now"). Those three exercises are `perDisplay`; trained on a phone, their large slot is empty, and `E.est.shown` returns the prior's level, which Progress prints as "Now" beside the phone best block; within reach, the Atlas band and start versus now leave them out. The owner plays on a phone.
   Breaks: rule 2 (numbers match the record), rule 6 (phones).
   Fix: use the current display class as `js/ui/frontier.js:21-23` does (`PX.ui.exinfo.display()`), or the display with more rated answers.

5. **[Medium] A Climb practice run replays attempt A's items and can be shared as a fair height.**
   `js/engine/climb.js:80` (`att = want || st.next || letters()[0]`: after the three attempts every run is attempt A again, same seeds, answers already seen with feedback); `js/ui/climb.js:293-303` shows the share line and card for practice runs with no practice mark ("Parallax Climb #N · height 20 of 20"), under "Everyone climbs the same rungs this week, so heights compare fairly", and a practice summit still gets the 'best' invite (`c.summit` is set for practice).
   Breaks: rule 11 (comparison only through seeded codes and cards, which must be honest), rule 1 (invites at personal bests, not replays).
   Fix: no share panel and no invite after a practice run (the Daily shares only its scored result), or "(practice)" in the text and on the card.

6. **[Medium] Views' draw-the-answer reveal tells extra lines from right lines by colour alone.**
   `css/bets.css:147-149` (right: green solid; extra: red solid, same width), `js/ex/views/layers-view.js:215-223` (the verdict says "extra (red)"). Red against green is the commonest colour-vision confusion. Fold (`js/ex/fold/layers-view.js:143`) and Slice (`js/ex/slice/layers-view.js:196`) cross extras out.
   Breaks: rule 8 (colour never the only cue).
   Fix: draw extra lines dash-dotted or with a cross at their midpoint, and say "extra (crossed)".

7. **[Medium] Reach's stored high mark has no level converter, and Reckon's range is changing now.**
   No `E.rebase.register` in `js/engine/game.js` (only `js/engine/plateau.js:997` registers one), though `js/engine/rebase.js:18-19` reserves it for "grades, Reach, the Atlas" and CONTRACT-v1.2 M (the `game` row, "Stored levels") gives it to milestone 5. `rec.game.reach.high` (`js/engine/game.js:346`) is a sum of levels on the old scales: when a range changes (Reckon version 2 landed in 6c52c5f with a legs dim and a fourth tolerance level), converted bests no longer add up to it, so Reach either sticks above the sum, and new Reckon bests do not raise it, against "It rises with each new best" (`js/ui/game.js:290, 421`), or jumps without a best.
   Breaks: CONTRACT-v1.2 M; rule 2 (texts match the code).
   Fix: register a converter that moves `reach.high` by (converted best − old best) for each converted exercise, with a node test on a range change.

8. **[Medium] A Climb run that goes into the back/forward cache comes back dead, with the app's chrome hidden.**
   `js/ui/climb.js:53` (`onHide` ignores `e.persisted`) and `:242` (a 'closed' stop returns before `setChrome(false)` and before the end screen). When the page returns from the cache, `X.done` is true: taps on the item do nothing (`after()` returns at once) and the header is gone, so a reload is the only way out. `js/ui/play.js:2565` skips persisted pagehides for this reason.
   Breaks: the review's "no player left stuck" check (PLAN milestone 9, O31).
   Fix: return early when `e.persisted`, or redraw the intro on `pageshow` with `persisted`.

9. **[Low] Three bet lines state transfer as fact.** `js/engine/bets.js:57` ("other tasks use it too"), `:60` ("carry over to new problems"), `:63` ("makes the shared rule easier to spot elsewhere"). On the exercise page they sit under "The bet ·", but About and the Lab list them under the label alone (`js/ui/bets.js:80-87`), and the guide quotes them. Breaks: rule 2 (a bet stated as a bet). Fix: reword those three as bets ("we bet that …") or prefix "The bet:" in the lists.

10. **[Low] A comparison round promises an apply item that may not come.** `js/ui/bets.js:333` says "The next item is one where it decides the answer" before `applySeed` runs; when it returns null (`:360-361`) the next item is an ordinary one. Breaks: rule 2. Fix: find the apply seed first and show the line only when there is one.

11. **[Low] The plateau card says the first session of an 'other method' trial never counts.** `js/ui/plateau.js:93`; `js/engine/plateau.js:72, 692-695` drop it only when at least 80 answers remain (`verdict.minRest`). Breaks: rule 2. Fix: "usually does not count", or always drop it.

12. **[Low] Calibration notes can include voided trials.** `js/ui/bets.js:531` skips only `tr.outcome === 'stutter'`; a fallback item (voided through `result.fallback`, `js/ui/play.js:2367`) still pushes its signed error into `rec.bets.cal` and the running-bias note. Breaks: rule 7 (voided trials never count). Fix: also skip when `ctx.out.outcome` is 2 or 3.

13. **[Low] "The same for everyone" does not hold on a device that cannot run every exercise.** `js/engine/climb.js:37-40` filters by `can` before shuffling, so a device without WebGL 2 gets a different exercise at every rung; the Daily (`js/engine/daily.js:120-123`) keeps the items but its share line still says "of 36 points" when items were dropped. Breaks: rule 11 (honest seeded comparison). Fix: shuffle the full pool and skip what the device cannot run; mark such share lines.

14. **[Low] "Less than one time in ten" against `≤`.** `js/ui/game.js:299, 431`, `js/ui/atlas.js:50` say less than; `js/engine/game.js:173` handles a cell at `tail ≤ config.game.p` (one right at a guessing rate of exactly 0.1 counts). Breaks: rule 2. Fix: `<` in code, or "one time in ten or less".

15. **[Low] Numbers typed into texts beside the config that sets them.** They all match today: "Two notes are kept already" (`js/ui/game.js:354`; `config.game.notes.keep`); "the second miss ends the run", "one spare" (`js/ui/game.js:327`, `js/ui/climb.js:38, 105`; `config.game.climb.spare`); "(0–36)" and the histogram's 36 (`js/ui/game.js:375-380, 438`; `config.daily2.max`); "4 weeks and 8 sessions" (`js/ui/bets.js:89, 109, 155`; `config.bets`); "about 3.5 minutes … up to four sessions a week … days 14 and 28" (`js/ui/measure.js:611`; `config.measure`, `E.trend.config.milestones`). Breaks: rule 2 once a constant moves. Fix: build them from the config, as 1983373 did for the Climb's attempts.

16. **[Low] The Atlas band is a green frame only and missing from the cell's accessible name.** `js/ui/atlas.js:99-104` (aria-label has the state, not "at your level now" or "within reach"), `css/game.css:144`. Breaks: rule 8. Fix: add both to the aria-label and give the band a pattern as well.

17. **[Low] The Atlas chips claim tab semantics without tab behaviour.** `js/ui/atlas.js:55-60`: role tab and tablist, no `aria-controls`, no arrow keys. Breaks: rule 8 (keyboard play). Fix: plain buttons with `aria-pressed`, or the full tabs pattern.

18. **[Low] Trial texts that do not hold for everyone.** The exercise page says add-ons "come … in some periods and not in others" (`js/ui/bets.js:49`) also for a player who left the trials (then they always run); About and Settings say "half of the exercises that have it" (`js/ui/bets.js:89, 109`), while the calibration layer pairs Homing and Reckon on one strand and gives Central Point its own coin, so a period can switch all three on. Breaks: rule 2. Fix: switch the page line on `B().joined(rec)`; say "about half".

19. **[Low] A number in a Lab paragraph this wave extended matches no report.** `js/ui/lab.js:341`: "the 95 % ranges held the true ability 91.5 % of the time"; ENGINE.md §16 gives 92.2 % (1.1) and 92.8 % (18 Nov). Breaks: rule 2. Fix: take the number from ENGINE.md.

20. **[Low] The pooled export carries nothing of milestone 5.** `js/engine/record.js:140` keeps `E.pooled('game', false)` and no header was added, while CONTRACT-v1.2 M says milestone 5 adds a Daily and Climb summary without days. No privacy problem; the community cannot test what the game layer does to practice. Fix: a day-free summary (Dailies played, the ramp histogram, Climb heights by Climb number, the count of firsts).

21. **[Low] Smaller points.** (a) "Twelve days" (`js/engine/achievements.js:36`, practise on 12 days in 90) pays for practice days; it predates the wave, but milestone 5 added no DECISIONS line naming its harm as rule 11 asks of every mechanic. (b) The bridge set's last question has no right answer, yet the chosen option takes the right-answer class (`js/ui/bets.js:458`); use a neutral "chosen" style. (c) Known acceptance misses, logged in DECISIONS, for the release table: plateau detection within 800 answers 87–88 % (< 90 %), target items within ±0.10 of the edge 93.8 % (< 94 %), coverage 97.8–98.1 % (PLAN: about 95 %).

## Checked and found clean
- **Stimulus guard.** `css/game.css:7-12` hides every game element under `body.px-stim`, and the Climb's scale while an item is up. `fx.run` refuses to start, and cuts running effects, when the class appears (`js/ui/game.js:73-86`). Counters and sounds check it (`:118, :158`). Hooks run between items only. Measurement pauses the session clock ('measure'). Comparison rounds, bridge sets, plateau cards and B1 run at item:before. Draw items keep the painted-frame clock.
- **Celebrations.** Only ink and `--right`; no `--signal` in game, bets, plateau or measure CSS (Balance's marker is the stimulus). Effects are ≤ 700 ms, skipped at the quiet level and under reduced motion (attribute and media query). Climb and stamp sounds play only while the global Sound switch is on, which is off by default.
- **Pay and streaks.** Nothing pays for time or logins. Challenge points exist only in the Daily (1+…+8 = 36, matching `config.daily2.max`) and the Climb. There are no leaderboards and no days-in-a-row count anywhere (searched). No achievement says "mastered". Summit and the Top tenth fix are skill-based. Field notes ask for skill or practice only and go quietly.
- **Numbers checked against constants:**
  - grade bands and "levels 51–60" (`gradeOf`, Path tenths);
  - Reach's definition (non-PAT training exercises);
  - rank step 100;
  - Climb: 20 rungs and 3 attempts;
  - fresh start after 7 days;
  - plateau: window 640, trial 3 sessions and 120 answers, hide 14 days, drill "1 in 6" (0.2 × 0.8), aim-higher and wider-mix percentages computed;
  - dims: lead every 5th, fluency 1 in 10, from 100 answers, window 400, "three times out of four above chance" (levelRef 0.75);
  - measure: block of 14 items ≈ 3.5 min, four a week, verdicts at days 14 and 28 then every 28, bars 0.975 and 0.95, 90 % ranges, "6 to 8 in 10 right" (k 0.6 on guessing rates 0 to 0.5), +1 point = 50 → 73 %, measurement-week 4 days, Balance 12 items ≈ 3 min;
  - the Lab's 1.9 / 3.2 / 3.2 / 5.9 / 8.8 / 12.5 % match `docs/dev/v1.2/measure-sim.md`;
  - bet evidence numbers appear in note T1.
- **Wording.** No IQ, index, percentile, norm, brain age or "smarter" in the new texts. Reach says it is not an ability score. Start versus now carries its familiarity line. "Unclear yet" is not "no progress". Verdict words appear only at milestones. Calibration is flagged new and untested.
- **Privacy:**
  - new events hold tokens, numbers and UTC times only;
  - the bridge set's typed text is never stored (a boolean only);
  - `rec.bets`, `rec.plateau` and `rec.measure` have no local day keys (session ids, ISO UTC dates, epoch ms);
  - `game`, which has local week keys, is left out of the pooled export;
  - new UI state sits in `rec.ui`, never exported;
  - new settings are not pooled;
  - share texts get the full https link through `PX.ui.share.text`.
- **Chimera.** At most one invite per summary, ranked best > path > grade > plateau > achievement > check (`js/ui/play.js:1626`). There is one at the Climb's end and one at a verdict. None appears on Today, in the Atlas, in rounds or bridge sets, or inside a block. Invite texts say nothing new about Chimera.
- **Ways on.** These all have one:
  - measurement offers (Later or Skip, then Start);
  - the B1 put-off;
  - plateau cards (Got it, Hide);
  - rounds and bridge sets (a pick, then Next);
  - Climb intro, unavailable state and end screen;
  - Atlas (Progress, Today);
  - Balance results (Lab, Today).
- **Keyboard and targets.** Rounds and bridges take digits and Enter. Draw items take arrows, Space and Enter. Buttons are ≥ 44 px (`--tap`), and so are Atlas chips, note rows and draw controls.
