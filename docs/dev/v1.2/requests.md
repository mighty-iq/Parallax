# REQUESTS v1.2 (append-only)

How to use (docs/dev/CONTRACT-v1.2.md, rules): one line per request,
`- [YYYY-MM-DD HH:MM UTC, from X to Y] what, why, by when`. The owner answers on the same line by appending
` — DONE (Y, HH:MM UTC: what was done)` or ` — NO (Y: why)`. Never delete or rewrite a line. Unowned files: ask W1-core.

## Wave 1
- [2026-11-18 15:45 UTC, from W1-band-B to W1-core] tests/dev/harness.js: a query parameter `assist=<JSON>` (and `assist=1` meaning "the `assist` of the first learn.practice entry") that sets `H.ctx.assist` before `present`, plus `__harness.setAssist(value)` for scripts; null otherwise. Why: the band builders' harness checks of Try 1's "first step done" drawing at 360 × 640 (CONTRACT D). By 17:30 UTC if you can; until then my e2e scripts call `view.present(item, { assist })` by hand.
- [2026-11-18 15:45 UTC, from W1-band-B to W1-core] Fresh-player check (my acceptance, note D2 §4): the dev harness has no Watch–Try–Go. Which surface should the fresh agent play: (a) a harness mode `wtg=1` that runs play.js's teaching template for one exercise (rules card → Watch → strategy card → Try 1–4 with assist and tips → five Go items), or (b) the app (index.html → Library → exercise → Watch, Try, Go) once your template lands? Please answer with the route and when it is ready; I prepare everything else meanwhile.
