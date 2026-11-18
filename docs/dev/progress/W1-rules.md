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
- 8f622c3, db70531: README line 1 (C4); CC BY-SA 4.0 for the prose (L1); LICENSE, LICENSE-GUIDE.md, the guide's credit
  lines (C13); the guide and README describe the first-launch welcome and the later card; About and the footer.
- 8124174: CLAUDE.md rewritten (R1, S1; rules 1, 2, 9–12 reworded, 3 and 5 extended, new 14–16; 55 lines).
- dcbc3a0, 0bb283b: ARCHITECTURE.md and EXERCISE-GUIDE.md describe 1.1 and the v1.2 contract (O32).
- 331f44d: Central Point's overlap note, helper kind and line (W1-central's request); Hole Punch's starter
  phrase (W1-core's); the Gentle motion label (W1-fixes').
- 53483c2, a93f772: Show the report; playtest 'auto' is off under browser automation (DECISIONS).
- 3603abe: shell.py 268 passed (card, tour end invite, backup invite, nickname, playtest copy on srcdoc,
  screenshots 1366 × 768 and 360 × 640 of welcome, card, Today, Settings, About, playtest report: looked at).
- 07371df: screens.py 382 passed (mode lines, suggestion, community export, O43 order, full share line).
- 16:25 UTC: a scratch flow played a Train session with playtest on: three taps on the summary, the report
  (ratings, performance, frames in items, sessions, trail), Today's Path suggestion; fixes in 95e5b6c.
- Requests: all answered (band-A phrases, W1-fixes' label, W1-central's overlap row, W1-core's Hole Punch phrase).
  W1-core did the share texts, invite slots, playtest hooks and the pause sheet's note button.

## Next
1. The full Node suite and tests/e2e/overlap.py after the overlap changes.
2. Later milestones (not wave 1): the guide's Central Point section (W1-central's request; milestone 10/11).

## Open problems
- tools/build-pdf.py's /Author metadata (C13) waits on W1-core (unowned file; request 16:13 UTC).
