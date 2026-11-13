# DECISIONS (append-only; one line per decision, with its reason)

- 2026-11-13: Parallax keeps its own CLAUDE.md rules where they differ from the new standing rules (quiet game layer, pop-up on every open), because it predates them and the owner has not said to switch; the plan asks.
- 2026-11-13: All v1.1 work happens on branch `build` from main f10f7db; release is a merge to `main` after the owner's yes.
- 2026-11-13: The v1.0 research notes go in docs/research/v1.0/ so later work can cite them; new notes go in docs/research/v1.1/.
- 2026-11-13: Path integration follows a community member's critique relayed by the owner: Homing's landmarks (windmill etc.) reduce dead-reckoning error, so the new mode is egocentric dead reckoning without landmarks and trains error minimisation. The original tool's code is not wanted (owner's instruction) and is not used.
- 2026-11-13: The Discord screenshots stay out of the repository (third-party names and avatars); BRIEF.md (git-ignored) keeps the transcription.
- 2026-11-13: Time counting: one active-time clock (stops for sheets, modals, hidden tab, idle > 60 s) feeds session end, practice time, summary, Log, share and weekly goal; Train, Path and Speed are time-boxed on it (I1 found four disagreeing clocks).
- 2026-11-13: Path integration ships as a new exercise, Reckon (EX-12), not a Homing setting, because Homing's landmarks act as heading fixes and one rating would mix aided and pure integration (R1); Homing stays as the easier landmark stage.
- 2026-11-13: Knots ships as one exercise (EX-13) with variants pull, untie/tie, link, mirror; "which moves tie it" and knot naming are dropped (too close to the Knot Reasoning Task; little spatial content) (R2).
- 2026-11-13: DAT PAT formats ship as four new exercises (Angles, Painted Cubes, Openings, Form), two variants (Fold 4x4, Views "complete the views") and a Section mode; "DAT" appears only descriptively with the ADA line; no score prediction (R3).
- 2026-11-13: Proposed default: PAT exercises join Train only under an opt-in PAT focus, to keep default training and the Spatial Check clean (asked as D2).
- 2026-11-13: The analogical test could not be identified; build a general test-overlap mechanism (About section, per-exercise notes, one-tap check-in, optional helper) and name the test once the owner identifies it (R4).
- 2026-11-13: Phones: every scored item must fit 360x640 without scrolling; a test enforces it (I2).
- 2026-11-13: Defaults where the brief is silent: names Reckon, Knots, Angles, Painted Cubes, Openings, Form; Section mode full (90 items, 60 min) and mini (30 items, 20 min); Sounds setting becomes short synthesized tones, off by default; version 1.1.0 with save migration; separate phone and desktop ratings where screen size matters (Track, Reckon, Angles).
