# Changelog

## 1.1.0 · 2026-11-13

The first update, built by the Chimera community on Discord (https://discord.gg/chmr).

- **One active-time clock** replaces the four timers of 1.0, which disagreed with each other and
  with the wall clock. It runs during items, feedback, show-me and tutorials, and stops for the
  pause sheet, any other sheet or dialog, a hidden tab, and after 60 seconds without input (those
  60 seconds count). Train, Path and Speed sessions, and Free play without a set number of items,
  last their length in active minutes, with an easier closing item when about one item is left;
  Speed plans from its deadlines. The HUD counts down ("about 12 min left", "less than 1 min left",
  "last item"), and the HUD, summary, Log, share card, Progress and weekly goal show the same
  minutes, written one way ("under 1 min", "7 min", "1 h 05 min"). A reload ends the session with
  what was played and never starts a new one by itself.
- **Bug fixes** from an audit that played real sessions: the Daily Challenge's scored attempt is
  spent only when all 8 items are answered, a partial attempt resumes, unanswered items show as
  "–", and the day is your local date everywhere; Progress counts only answered items; a Spatial
  Check no longer counts towards the weekly goal; Threshold and Speed achievements need a complete
  run; one CSV format; the Sounds setting works (short tones after an answer, off by default, never
  while an item plays); and smaller slips: Today at 150 % text, Today's order, the item counter
  during feedback, the deadline bar after an answer, Pause and Resume, Threshold units, Path's
  double prompt, and the Spatial Check's time estimate (now "15 to 25 minutes").
- **Phones, first-class:** every scored item of the 19 exercises and 6 probes fits a 360 × 640
  screen without scrolling, checked by a new browser test (`tests/e2e/fit.py`). During an item the
  header steps aside, one strip holds Help and Pause, and the goal and tips wait behind Help; held
  sideways, items switch to two columns; turning the phone while an item plays voids the trial.
  Text inside figures stays at 13 pixels or more; safe areas and 150 % text are respected. On
  iPhone, iPad and in-app browsers the welcome explains where progress is kept and offers backups;
  served over https, Parallax has a web manifest and icons for the home screen. Track, Homing,
  Reckon and Angles keep separate ratings for small and large screens.
- **Homing, rebuilt for touch (version 2):** slower, smoother motion (1.8 m/s, turns at 45°/s,
  0.4-second ramps), routes of 12 to 28 m, and touch controls (drag the view, a dial, and 1° and 5°
  buttons that act when you lift your finger, so swipes scroll). Landmarks are placed where the
  walk shows them, ahead along a leg wherever there is room. Routes are chosen so that answers that
  need no tracking (the turns reversed, a heading never updated) miss, and turning straight round
  or a fixed answer stays near chance wherever the routes allow. A trial is voided only when the
  walk itself was harmed, or when the screen changes shape while you answer. The strategy card's
  side error, there since 1.0, is fixed. Its trials are logged as version 2.
- **Reckon (EX-12, experimental):** path integration without landmarks. Watch a walk across an
  empty plain, with no objects, no sun and no compass, then point home or walk home. The ground's
  marks show motion but mark no place; harder levels thin them out or make them short-lived. Above
  the steady level, speeds vary from 0.5 to 2.0 m/s, so a leg's walking time says little about its
  length. After every answer: the angle error, the distance error, the drift per metre walked, and
  your habit over the last 20 routes; the trial log keeps the angle error and, on walks back, the
  distance ratio (walked ÷ true) in separate columns. On the easier routes the turns alone tell you
  much of the way home; distances matter more with bigger turns, at tighter tolerances and when you
  walk back. A community member pointed out that Homing's landmarks correct the very dead-reckoning
  errors that this training should work on; Homing stays as the landmark-aided stage before Reckon.
- **Knots (EX-13):** pull both ends, does a knot remain? Which marked crossing, switched, unties
  the rope, or ties it? Are two loops linked? Ropes of 5 to 12 crossings in three spacings. Every
  answer is proved before the item is shown: by the simplification moves that take a rope apart, by
  a determinant that shows a knot remains, or by the Jones polynomial. Show me replays the moves
  and checks every one before it is drawn; where a move cannot be drawn safely, it stops with a
  caption that says how it ends. The mirror variant was not built.
- **Six formats of an admissions test (EX-14 to EX-19):** Openings, Missing View, Angles (labelled
  perceptual-judgement practice), Hole Punch, Painted Cubes and Form practise the question formats
  of the Perceptual Ability Test (PAT) in the Dental Admission Test (DAT®). They join Train and
  Today's plan only under the opt-in DAT-style focus, which puts at least one of them in every
  session, untried ones first, and stay out of the Daily Challenge and the "every exercise"
  achievements. Practice on a format usually raises scores on that format; Parallax has not
  measured any effect on DAT scores, and PAT scores relate only modestly to dental-school grades.
  *DAT® and Dental Admission Test are marks of the American Dental Association. Parallax is not
  affiliated with or endorsed by the ADA. Every item is generated by the app; none is taken from
  the DAT.*
- **Section practice:** the six formats in the test's order against one clock, mini (5 items a
  part, 30 in all, 20 minutes) or full (15 a part, 90 in all, 60 minutes), about 40 seconds an
  item. Numbered forms hold the same items for everyone with the same exercise versions; Back,
  Flag, Skip and an item list work within the current part; warnings come at 5 and 1 minutes left.
  No feedback until the review: results and pacing per part, then the items to look at again, each
  with its show-me. It changes no level and gives no score. A full section with every part reached
  and at least half its items answered earns the new achievement "Full section" (21 in all).
- **Test hygiene:** "Also in tests" notes on Fold, Hidden, Views, Nets, Span, Knots and the six
  DAT-style formats; a Test hygiene section in About with the size of practice effects; on later
  Spatial Checks, one question about outside tests and practice since the last check, kept with
  your data and never scored; and a "Taking a test soon?" helper in Settings that lists the
  matching exercises and can leave them out of Train and Today's plan until the day of your test.
- **Your record:** format 2. A 1.0 record upgrades the first time 1.1 opens it, with nothing lost;
  a 1.0 tab still open elsewhere then runs from memory instead of overwriting the newer record.
  Every trial gains its screen class (small or large) and its input (mouse, touch, pen or keys),
  and the trials CSV has 18 columns, one of them for a second number where an exercise reports one.
  Checks record their screen, and Progress says when a check was taken on another kind of screen
  than your starting checks.
- **Also:** similar-exercise groups for the new exercises; Reckon joins the Lab's group B; the user
  guide covers every new exercise and the research behind it (`docs/Parallax-Guide.pdf`).

## 1.0.0 · 2026-11-06

The first public release, built by the Chimera community on Discord (https://discord.gg/chmr).

- **Eleven exercises**, every item procedurally generated and verified by an independent solver
  (at least 10,000 seeds per exercise in the tests, cheap shortcut solvers near chance):
  Track (3D multiple-object tracking, labelled attention practice), Rotate, Spin, Fold, Nets,
  Slice, Views, Orient, Span, Hidden and Homing (experimental).
- **The Spatial Check:** six adaptive probes that are never trained and give no feedback
  (Cube Match, View Match, Mechanisms, Pattern Memory, Level, and Word Links as a non-spatial
  control), alternate forms, two baselines, a familiarity estimate from your own retest gain, and
  the outcomes "beyond familiarity", "unclear yet" and "no change".
- **Five ways to practise and one to measure, on one record:** Train (three-exercise sessions,
  five interleaving stages, three styles), Path (ten gated stages per exercise with spaced
  rechecks), Threshold (Track Standard, Span length, Spin deadline), Speed, Free play and the
  Spatial Check; plus the Daily Challenge and friend challenge codes.
- **Learning support:** Watch, Try, Go tutorials and a first-run tour; just-in-time tips; two
  strategy cards per exercise; feedback within half a second; slow, pausable show-me animations
  drawn from the grading model; off-screen challenges for Fold, Nets and Views.
- **Honest motivation:** levels 1–100 with likely ranges and real settings, learning curves,
  personal bests (your highest level after a strong whole block of 10), a weekly goal with grace
  and free repair, 20 achievements for skills and good practice, session summaries against your
  own past, share cards with the Discord link.
- **The Lab:** Threshold protocols with their history, a research export (predicted chance,
  stage and item-model version per trial), an account of the engine, and an optional randomised
  crossover self-experiment.
- **Your data:** stored only in your browser; backup and import with undo (JSON), trials as CSV;
  a memory fallback with a warning where storage is blocked.
- **Runs everywhere:** file://, GitHub Pages, sandboxed previews and phones; a single-file build
  (`dist/Parallax.html`); keyboard play everywhere; light and dark themes.
- **Documentation:** the user guide (`docs/Parallax-Guide.pdf`, CC BY-SA 4.0), the engine notes
  (`docs/dev/ENGINE.md`) and the exercise guide for contributors (`docs/dev/EXERCISE-GUIDE.md`).
