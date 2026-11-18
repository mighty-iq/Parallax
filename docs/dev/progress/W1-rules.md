# W1-rules progress (wave 1: milestone 2, the standing-rules switch)

Owns: see docs/dev/CONTRACT-v1.2.md "File ownership" (W1-rules row). Requests: docs/dev/v1.2/requests.md.

## Done
- 15:35 UTC: requests to W1-core (share texts, pop-up, invite slots) and W1-fixes (section.py).
- 681a1a8: full welcome on the first launch only, one-tap card under the header later (C2, O2);
  `PX.ui.chimera.invite` (10 kinds, fixed wording, link + Copy link, one per screen, null over a stimulus);
  invites in export and backup dialogs (C10); share texts carry the full https line; nickname on cards.
- 1c47bdd: invites at the tour's end (C6) and on the Spatial Check result (C8).
- 050552c: playtest mode (js/ui/playtest.js, css/playtest.css; BUILD flag; three taps; note button; report;
  copy fallback); Settings (gentle motion, nickname, device details, playtest); Lab community export;
  hygiene pooled rule; analogy line (D3) in the helper and About; node tests chimera + playtest; index.html
  activation of playtest.js / playtest.css.
- bff9e9a: modes' "right when" lines (practise sheet, Lab) and Today's suggestion card (M3); levelText and
  starter line on Today and in the Library; Central Point catalog line, phrases, variant names; O5 (Library
  answer times), O43, O59; band-A's starter phrases; storage hint on Today; O25 + D3 + pooled-hygiene tests.
- 30f8272: DECISIONS lines.

## Next (in order)
1. README line 1 + licences (L1, C13), LICENSE, LICENSE-GUIDE.md, the guide's source texts (pop-up, credits).
2. CLAUDE.md rewrite (R1, S1, rules 14–16), ARCHITECTURE.md and EXERCISE-GUIDE.md (O32).
3. shell.py for the new pop-up + playtest copy on srcdoc; screens.py; screenshots 360 × 640 and desktop.

## Open problems
- The pause sheet's playtest note button waits on W1-core (request 15:55 UTC).
