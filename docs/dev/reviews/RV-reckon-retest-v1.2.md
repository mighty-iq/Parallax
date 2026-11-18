# RV-reckon-retest-v1.2: fresh-player retest of Reckon's tutorial (wave 1)

18 Nov 2026, 16:14–16:24 UTC. Protocol: docs/research/v1.2/D2-first-band.md §4. The tester was a fresh agent that saw
the app only as screenshots (phone 390 × 844, DPR 2, touch only, empty storage) through a small driver offering tap,
hold, swipe, wait and timed frame series; it read no source, docs or DOM. Graded here by W1-fixes, who built the
changes and did not play.

## What it played
- The welcome, the Library, Reckon's card, then the tutorial: Watch, and Try 1–4. Scored items were not played: after
  "Go" at the end of Try the driver stopped answering. A reproduction showed the app was fine ("Go" opens the
  Watch, Try, Go end screen, "Start a session with Reckon"); the driver had waited without limit for a browser slot
  while two other test runs held both. The driver now waits at most 40 s and then runs without a slot.
- Try: 3 of 4 right at the first attempt (1 heading, 2 distance, 4 walk back right; 3 point wrong by 94°). Its reasons
  were mostly guesses: from sparse screenshots it could not read the turns or the distances.

## Grading (D2 §4)
| Criterion | Result |
|---|---|
| 1. A right Try answer with a right reason within 2:00 | no: first right answer about 3:10 after starting the demo, a guess |
| 2. Rules understood | yes: "a walk with nothing to steer by, then face the start or walk back to it; the ground shows how far you turned or walked; the top of the circle is the way you face" |
| 3. Try ≥ 3 of 4 | yes (3 of 4) |
| 4. Scored ≥ 4 of 5 | not played |
| 5. No blocker; captions ≥ 3 s | no: most Watch captions ran 1–2.6 s; the tutorial was hard to find from Practise |

An agent reads moving 3D scenes worse than a person (note D2 §4, limits); the human check is milestone 2's playtest mode.

## Findings and what was done
1. The Library card's Practise sheet has no Watch, Try, Go; the tester found the tutorial only through the card's
   details → How to play → "Watch the demo". Not in W1-fixes' files: request to W1-rules (docs/dev/v1.2/requests.md).
2. The Watch: the tester saw 2 of about 12 captions; the demo's answer steps passed unseen. Fixed: every Watch caption
   in Homing and Reckon stays at least 3 s (the map steps too, in the Watch only), and the line under the view says
   the demo is playing ("Watch the demo: …") until it ends, then asks for the answer. When the demo ends, the player's
   strip shows only a small "Your turn · Skip to Try" bar and Replay goes: request to W1-core.
3. Walks of 3–5 s were too short to read. Fixed for the two tutorial rungs (never rated): the turn on the spot now
   turns at 30°/s and the first straight walk goes at 1.2 m/s ± 10 % (rated items keep their speeds).
4. "Turn back" and "face the start" read as one instruction. Fixed: the turn-on-the-spot texts say "face the same way
   as at the start"; the walk-back tip is shorter.
5. Item 3's wrong answer auto-played the map from above with "Show me again"; fine. No Show me after right practice
   answers: request to W1-core.

The new tips (O39) fitted every Try item, and the new feedback (O40) read as intended: "34 % short", the drift line
naming "the route and your walk back" with the item's limit, "your answer" on the map.

Checks after the fixes: harness_homing (gentle, demo) 9/0, harness_reckon (v12, demo) 24/0, node reckon 127, homing 106.
The tutorial's flow (Watch → Try 1–4 → Go) did not change, only its pace and wording.
