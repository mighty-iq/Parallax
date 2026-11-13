# R1. Path integration without landmarks (dead reckoning) for Parallax

Research notes for the v1.1 brief, item 2: "Implement path integration mode with no landmarks, with dead reckoning", and item 5: "make homing usable on [phones]". Written 2026-11-13 by a research subagent. No app files were changed.

**How to read the source tags.** Every source carries one tag saying how much of it was read:
- **[full]**: the whole article was available and read (fetched as HTML or PDF and read section by section; the sections that matter for a claim are named where useful).
- **[abstract]**: only the abstract or the publisher's summary page was read.
- **[secondary: X]**: known only through source X; the claim is X's report of it.
- **[DJ]**: design judgement (mine), not a finding.

Sources that could not be opened are listed in the ACCESS section at the end. Papers that a core design decision rests on, and that were not read in full, are flagged there with their DOI or link and exactly what is needed from them.

Contents
1. What exists today (Homing, EX-11) and the recommendation
2. Paradigms
3. Error models and what makes a trial hard
4. Training and transfer evidence
5. Existing apps and games
6. Scoring and verification
7. Phone design
8. Proposed task design (summary)
9. Open risks
References · ACCESS

---

## 1. What exists today: Homing (EX-11)

Files read in full: `js/ex/homing/gen.js` (382 lines), `learn.js` (126), `view.js` (851), `css/ex/homing.css` (98), `tests/node/homing.test.mjs` (296), `tests/e2e/harness_homing.py` (386); `js/ex/registry.js`; `docs/dev/ARCHITECTURE.md` §1–§12; `docs/dev/EXERCISE-GUIDE.md`; the Homing parts of `docs/dev/DESIGN-PLAN.md`, `docs/dev/ENGINE.md`, `docs/research/v1.0/B-tasks.md` §10 and §14, `js/ui/play.js`, `js/ui/library.js`, `js/core/stage3d.js`, `js/core/timing.js`, `js/engine/estimator.js`.

### 1.1 Definition
- `id: 'homing', version: 1, code: 'EX-11', name: 'Homing (experimental)'`, `abilities: ['NAV']`, `cell: 'extrinsic-dynamic'`, `role: 'train'`, `answer: 'angle'`, `perDisplay: true` (ratings kept per screen class: 'small' when the short side is under 600 CSS px).
- It is labelled experimental everywhere: the player's label line ("Homing is experimental and works best on a larger screen"), the Library tags ("experimental", "larger screens") and a Library note ("its item model is new and untested, and it works best on a larger screen held at a steady distance"). The Daily Challenge leaves it out (perDisplay). It comes last in the beginner order and sits in Lab cluster B.

### 1.2 The environment and its cues
- **Viewpoint.** First person at eye height 1.6 m, pitch −7°, a fixed horizontal field of view of 74° (the vertical field follows from the aspect ratio, capped at 80°).
- **Ground.** A flat plain (a 900 m disc, unlit `MeshBasicMaterial`, so no shading and no sun direction). On it, about 5,650 small irregular pentagons ("pebbles", 0.1–0.24 m across, random position and rotation, 0.32 per m²) inside a 75 m disc centred on the centroid of the route's corner points: one static mesh of about 17,000 triangles. The comment says why there is no grid: grid lines would give a compass modulo 90°.
- **Sky and horizon.** The sky is one flat colour. Linear fog from 18 m to 190 m blends the plain into the sky, so the horizon is a soft band with no azimuthal structure. There is no lighting, sun, shadow or sky gradient that could act as a compass.
- **Start.** A 4 m ring on the ground, visible only while the viewer is within 4.5 m of the start (the route always ends at least 5 m away), and a flag shown only at reveal.
- **Landmarks** (a difficulty dim): several (3), one, or none. They are distant silhouettes (mountain, radio mast, windmill, spire, dome) on a 400 m circle round the start, at least 60° apart, unfogged. On a route of at most 72 m they shift by at most about 10° of bearing, so they work mainly as a compass (heading cue) and a little as a position cue.
- So the "none" level is already landmark-free in the strict sense: what remains is the optic flow of the static ground texture (which also allows tracking individual pebbles) and the horizon (pitch and roll reference only). One residual, very weak cue: the pebble disc is centred on the route, not on the viewer, so its far edge lies towards the route's centroid; pebbles are sub-pixel and fogged well before that edge, so this is negligible [DJ], but a new design should centre the texture on the viewer.

### 1.3 Movement and controls
- **Passive transport.** The viewer stands in the start ring for 1 s, then the camera is carried along 2–4 straight legs (6–18 m each) at a constant 3 m/s (a jog; brisk walking is about 1.4 m/s), with on-the-spot turns at a constant 60°/s between legs. Translation and rotation never overlap (no curved paths); speeds start and stop instantly (no acceleration ramps). Motion is integrated from the frame clock (`timing.loop`, dt clamped to 100 ms), so a slow frame slows the route but never jumps it.
- Turn sizes are a level: small 30–60°, medium 60–120°, large 120–160°, each left or right at random.
- The person controls nothing during the route. Esc (or Space when paused) pauses the walk inside the view and voids the trial. A freeze over 400 ms, more than 25 % slow frames or a lost WebGL context voids it as a stutter.
- On a phone there is no key: the player's HUD Pause button voids the trial and hides the item under the pause sheet, but it does not stop the view's walk loop (the loop only checks the view's own `st.paused`, which only the Esc/Space keys set), so the route plays on unseen. Harmless for measurement (the trial is void) but it means a phone user cannot pause and see the rest of the route [code reading].
- Turning the device during the route is neither held nor voided by Homing (Track sets `holdResize` during its stimulus; Homing does not). A resize changes the aspect ratio and so the vertical field, mid-route [code reading; the I2 mobile audit should confirm on a device].

### 1.4 The answer, the scoring and the difficulty
- **Answer.** After the route, an arrow circle (SVG dial; its top is the final heading). Drag or tap sets the arrow; ← → turn it 5°, Shift 1°; Enter or Confirm sends it. The 3D view turns with the arrow (160 ms ease), which is safe because nothing in the scene marks the start. The response is an integer 0–359 (degrees clockwise from the final heading).
- **Key.** The bearing of the start from the end point minus the final heading. The item also stores the distance back (`item.distance`, metres) "for a later distance question", but nothing asks for it.
- **Scoring.** `correct` when the absolute angular error is within the tolerance (40°, 30° or 20°); `value` = the absolute error; `detail.signed` = the signed error. `chance = 2 × tol / 360` (22, 17, 11 %).
- **Answer spreading and shortcut control.** Each item draws a target answer uniformly from [20°, 160°] ∪ [200°, 340°] and steers the last leg so the key lands within 8° of it; the key is never within 20° of straight ahead or behind. Two path-blind answers must miss by more than the tolerance + 2°: "turn around" (180°) and "the turns reversed" (180° − Σ turns, as if every leg had followed the first heading). Lower priority: "the turns only, legs taken as equal" should miss too. The 2-legs-with-small-turns cell is left out because it can never defeat both shortcuts. The node test checks all of this on 10 000+ items, plus the cross-validated best fixed answer (≤ chance + 10 where answers can spread).
- **Dims.** `route` (8 levels: 2 legs medium turns, 3 small, 2 large, 3 medium, 4 small, 3 large, 4 medium, 4 large), `landmarks` (several, one, none), `tolerance` (40/30/20°). Custom difficulty: −2.25 + 0.55 per extra leg + 0.4 per turn-size step + 0.4 per landmark level + 0.9 per tolerance level, range 4.1 logits. All steps are hand-set; none is calibrated on data.
- **Not implemented from the v1.0 plan:** a delay before the answer (B-tasks §14c listed "delay 0–10 s") and the distance error ("absolute angular and distance error").
- `estMs` = 1 s lead-in + the route (mean leg 12 m at 3 m/s, mean turn of the band at 60°/s) + 5 s to answer: about 15 s (2 legs) to 29 s (4 legs, large turns) per trial.

### 1.5 The tutorial (Watch–Try–Go)
- Goal line: "Watch a short walk, then turn to face where you started." Labelled parts: View, Start (ring), Landmarks, Arrow circle.
- Demo: one item at the easiest cell (seed 1: 7 m, 101° right, 9 m; the start ends 137° to the right). It replays the route with captions, then "show me" (the route drawn from above leg by leg, then the map turned so the final heading is up and the angle read off), then the turn to face the start.
- Practice: 4 unlogged items (route 0–3, landmarks several → one, tolerance 40 → 30°). Just-in-time tips: keep track after each turn; use far landmarks as a compass; "no landmarks now: only the turns tell you which way you face"; picture the route from above; Shift for 1° steps.
- Strategy cards: imagery ("draw the map in your head"), analytic ("track the start like a compass needle": update the start's direction after every leg and turn), and when to switch. The comment notes that no training study of these strategies was found.
- Feedback after each answer: the error in degrees with ✓/✗, the true direction and distance ("The start was 137° to your right, 12 m away"), the tolerance wedge, and three diagnostic hints: "reversed" (the path-blind 180° − Σ turns), "around" (180°), and "sides" (left and right swapped). Show me is available after every item.
- Bridge text: "Finding the way back to a car or a trailhead without a map uses the same kind of tracking. Practising here improves this task; whether it helps real wayfinding has not been studied."

### 1.6 What makes it hard or impossible on a phone
From the code and geometry; the I2 mobile audit tests it on devices. Numbers below assume a 360–412 CSS px wide phone held at 30–40 cm.
1. **A minified world.** The 3D stage is `min(70vw, 40vh)` tall on narrow screens (252 px on a 360 × 640 phone, 288 px on 412 × 880), and the horizontal field is fixed at 74°. A portrait phone's view is about 6–7 cm wide, about 10–13° of visual angle at 30–35 cm, so the world is minified about 6× compared with a natural view (on a 24-inch desktop monitor at 60 cm the stage spans about 40–45°, a factor of about 1.7). Angular speeds on the retina shrink by the same factor: a 60°/s turn moves the image at about 10°/s.
2. **The flow carrier vanishes.** At about 4.9 px per degree, a 0.35 m pebble 10 m away is about 10 × 1.6 px; at 20 m it is under half a pixel high. With antialiasing off on phone-sized screens (stage3d's rule), the far pebbles alias and shimmer as they move. On the no-landmark level the optic flow is the only cue, and on a phone it lives in the lower third of a small view.
3. **Passive, fast, visual-only motion in the hand.** 3 m/s and 60°/s, with instant starts and stops, no rest frame, and no comfort setting (reduced motion is not applied to the stimulus, by design). Small screens give less vection and less sickness than large ones, but a hand-held screen in a moving gaze is its own conflict [DJ; see §7].
4. **The answer control.** The dial is `min(50vw, 27vh, 15rem)`: about 173 px on 360 × 640 and 206 px on 412 × 880. Its rim radius is then about 60–72 px, so 1° is about 1.0–1.3 px; the finger covers the arrow while dragging, and there is no fine step on touch (Shift is keyboard-only). At 20° tolerance the target arc is about ±20–25 px wide. Usable, but imprecise and tiring.
5. **No pause on touch** during the route (above), and no handling of a device turn during the route.
6. **The layout** puts a short 3D band at the top and the dial below in portrait; in landscape (e.g. 800 × 360) the wide layout applies, with a stage at least 240 px tall plus the HUD, which can overflow the height [I2 to confirm].
7. **Long trials.** 15–29 s per trial with a passive 6–23 s route: long for a phone session, and every void costs a whole route.

None of these make it impossible; together they make the no-landmark level a test of how well one can read a tiny, shimmering flow field, which is not the skill intended [DJ].

### 1.7 Recommendation: a new exercise, built from Homing's parts
**Recommendation: build dead reckoning as a new exercise ("Reckon", EX-12, NAV, experimental), sharing Homing's route model and 3D view code, and fix Homing's phone problems separately. Do not add it as a variant or a landmark level of Homing.** Reasons (the evidence behind each is in §2–§7):
1. **A different construct.** Homing's landmark levels turn heading-keeping into reading a compass. Pure dead reckoning has to keep heading from rotation flow alone, which is exactly where visual-only path integration fails (people often respond as if they had not turned; §2.4, §3.4). One rating that mixes "with a compass" and "without" levels hides that skill behind the landmark ladder. A separate rating shows it.
2. **A different answer.** Dead reckoning is about position, not only direction: the new task asks for direction and distance (return to the start, or stop on the remembered spot). Distance errors behave as a separate ability (§3, §6). Folding a second response type into Homing's 'angle' answer would change its scale and its chance level, which a variant is not supposed to do (ARCHITECTURE §5: variants "vary the task without changing difficulty much").
3. **Different controls and motion.** The phone design (§7) lets the person drive the return and, in later rungs, the outbound path; Homing is passive. Active control changes both the error pattern (§2.5) and comfort (§7.2).
4. **Clean logs and tutorial.** A new id starts its own "reckon@1" rows and its own Watch–Try–Go; Homing's version, ratings and logs stay valid.
5. **Owner's wording.** "Mode" in the brief reads as "a way to practise", not one of the engine's progression modes; the Library can show Reckon next to Homing ("Homing · with landmarks", "Reckon · no landmarks") so it feels like a mode of navigation practice [DJ].

Costs: one more exercise in the rotation (the "11 exercises" text, the beginner order, the scheduler tests and the guide change), and a second NAV exercise in Lab cluster B. If adding an exercise is ruled out, the fallback is Homing v2 with `variants: ['face', 'return']`, the 'return' variant forcing landmarks to none, a custom difficulty with a variant offset, and a version bump; it is workable but mixes two scales in one rating (see §8.8).

---

## 2. Paradigms

### 2.1 The task family at a glance
| Paradigm | What the person does | Response | Key known in advance? | Studies read (tag in References) |
|---|---|---|---|---|
| **Triangle completion** | Travels two legs with a turn between, then returns to the start | Walk/steer back (direction + distance), or turn and point | Yes (geometry) | Loomis 1993 via Klatzky 1999; Riecke 2002; Harootonian 2020; Chrastil & Warren 2021; Scherer 2024; McLaren 2022; Embodied-navigation preprint 2025 |
| **Return to origin, multi-leg** | Travels 2–5 legs (or a curved path), returns to the start | Travel back and press "home" (or drop an object) | Yes | Stangl 2020 (curved 4-leg paths, verbal distance + body turn at 4 stops); Apple Game (Colmant 2023; Akan 2026); SPACE (Colombo 2024) |
| **Pointing to origin** | Passively transported along 1–5 segments | Points (arrow, joystick, dial) to the start; no travel | Yes | Riecke & Wiener 2007; Wiener & Mallot 2006; Gramann 2005 (tunnel); He & McNamara 2018; Kelly 2020; Sea Hero Quest flare levels (3-way choice) |
| **Loop closure** | Moves along a curved loop | Judges whether (or when) the loop closed at the start | Yes | Chrastil 2017 (binary judgement, 59 % vs 50 % chance) |
| **Distance and angle reproduction** | Sees a translation (or a turn), then reproduces it | Travels/turns the same amount and stops | Yes (1D) | Riecke 2002 (TURN&GO); Petzschner & Glasauer 2011; Chrastil & Warren 2017; Lappe 2007 (adjust-target vs move-to-target) |
| **Steer to a remembered target** ("firefly") | A target flashes on the ground and disappears; the person steers to it with a joystick | Stops where they think it was | Yes (target position) | Lakshminarasimhan 2018 (preprint); Noel 2020 |

Notes on each:
- **Triangle completion** is the reference paradigm. With blindfolded walking, responses regress toward the mean: low values overestimated, high ones underestimated (Loomis 1993, as summarised by Klatzky 1999). With optic flow only (Riecke 2002, a 180° × 50° half-cylinder, active mouse control), naive people could do it: turn errors 3–15 % of the turn, distance errors 7–31 %, distance strongly regressed (gain 0.60 for isosceles triangles). In the 2025 free-walking preprint (HMD, rich ground texture, no landmarks, 18.5 m legs, 90° turns), the vision-only joystick condition had a mean position error of 22.5 m against 10.6 m with walking added, a 6.3 m distance overshoot and a direction SD of 34.7°.
- **Return to origin with more legs** is what "dead reckoning" means in practice. The Apple Game (desktop, joystick, an endless grassy plain with the sky at infinity; the pure path integration subtask has no landmark at all) asks people to collect a basket, walk via 1–5 trees, then drop the basket where it was picked up; feedback is 0–3 stars by drop error (Akan 2026: < 1600, < 3200, < 6400 virtual m). In 279 adults aged 18–80, the 3-tree condition was too hard for older people and was dropped (Colmant 2023).
- **Pointing to origin** separates knowing where the start is from getting there. Chrastil & Warren 2021 found that most triangle-completion error comes from *executing* the return, not from encoding the outbound path ("Errors in triangle completion might not arise from failing to know where you are, but from an inability to get back home"). A pointing response therefore measures the integration itself more cleanly; a travel response adds a distance answer and an execution component.
- **Loop closure** with a yes/no answer is weak: Chrastil 2017 found 59 % correct against 50 % chance on passive circular videos, and its authors suggest production errors instead of forced choice. A "press when you are back" version is better but invites timing strategies on constant-speed circles [DJ].
- **Distance and angle reproduction** isolate the two components. Petzschner & Glasauer 2011 varied speed by up to ±60 % between the sample and the reproduction "to exclude time estimation strategies"; responses were pulled toward the centre of the stimulus range, more so for wider ranges. Lappe 2007 found that the same visual motion gives underestimation when judging distance travelled from the start (adjust-target) and overestimation when moving to a remembered target (move-to-target), both explained by one leaky integrator.
- **Steering to a remembered target** is the most phone-ready of these: a short trial (3–6 s), simple two-axis control, an answer that is a stop position, and a key fixed before the person moves. Human version (Noel 2020): a target of 20 cm radius shown for 1 s at 1–6 m and ±42.5°, a ground of short-lived triangles, joystick limits 2 m/s and 90°/s.

### 2.2 Passive transport and active movement
- **Passive transport** gives full control of the stimulus: the path, its speeds and its key are fixed by the item, so it is solver-verifiable (Homing today; Wiener & Mallot 2006; Gramann 2005; Riecke & Wiener 2007; Chrastil 2017; Stangl 2020 used a guiding baton).
- **Active movement** (Riecke 2002 mouse; Scherer 2024 arrow keys; Apple Game joystick; firefly joystick) is closer to real navigation, adds motor (efference) information and usually reduces sickness [DJ; §7.2], but the outbound path is then partly the person's own, so the key must be computed from the logged trajectory or fixed in advance by a target (firefly, Apple Game).
- Active and passive gave similar biases in the firefly task: a passive-transport version "still produced overshooting" (radial gain 1.38) (Lakshminarasimhan 2018 preprint).
- Rotation is the component most sensitive to how movement is produced. When rotations were made without the body (discordant teleporting, Kelly 2020), distance error (η²p = .66) and angular error rose and latencies grew; the authors recommend keeping body rotation. Visual-only turning without a compass is where heading updating fails (Klatzky 1998, as reported by He & McNamara 2018; Riecke & Wiener 2007).
- **Design consequence [DJ].** Keep the outbound path passive in the early rungs (exact control, verifiable, nothing to learn about controls) and make the *return* active (turn, then travel back). Add active outbound steering (the firefly format) as a later rung once the controls are familiar.

### 2.3 Visual-only set-ups in VR and desktop studies
| Study | Display and field of view | Scene | Motion and control |
|---|---|---|---|
| Riecke 2002 | Half-cylinder screen, 180° × 50°, eyes at 1.25 m, 36 Hz, mono | Ground and four semi-transparent upper planes of random blobs, blurred beyond ~10 m; no landmarks | Active (mouse), up to 5 m/s and 40°/s, short acceleration ramps |
| Riecke & Wiener 2007 | Projection, 84° × 63° | Textured ground plane, no landmarks | Passive; game-pad pointing |
| Gramann 2005 (tunnel) | 19-inch monitor | Tunnel with textured floor and walls | Passive; mouse-adjusted 3D homing arrow |
| Wiener & Mallot 2006 | Back-projection VR | not read | Passive; pointing |
| Chrastil 2017 | Desktop videos (fMRI) | Textured ground and ~150 poles taller than the screen, re-randomised per video | Passive, 30 frames/s |
| Petzschner & Glasauer 2011 | 1280 × 800 monitor | "Stone desert": textured ground, 200 random stones, sky dome; texture orientation and stones randomised per trial | Joystick; speed varied ±60 % |
| Noel 2020 (firefly, humans) | Projection 149 × 127 cm at 67.5 cm (about 96° × 87°, my arithmetic), red–green anaglyph | Ground of triangles 8.5 × 18.5 cm, 2.5 per m², 250 ms lifetime, re-oriented at each appearance "so they could not serve as landmarks" | Joystick, ≤ 2 m/s, ≤ 90°/s |
| Scherer 2024 | Participants' own desktop computers (remote) | Grass tufts re-randomised per trial; overhead "sun" (no shadow direction) | Arrow keys; 2.5 m/s; active outbound following an arrow |
| Colmant 2023 / Akan 2026 (Apple Game) | 15-inch screen / MR goggles | Endless grassy plain, sky at infinity, invisible circular limit | Joystick |
| Embodied-navigation preprint 2025 | Meta Quest 3 | Rich ground texture, optional 400 identical trees | Joystick (vision condition) |
| Stangl 2020 | Oculus DK2 + walking | Seamless ground tiles; distal landmarks at infinity (heading cue) | Walking, guided |
| Sea Hero Quest | Phones and tablets | A river between banks | Tap left/right to turn, swipe to speed up; flare = 3-way choice |

Two points from these set-ups:
- **The display frame is a cue.** Riecke 2002 thinks the screen's edges and the visible body act as a reference frame ("display geometry, the reference frame provided by the display boundaries, and the visibility of one's own body" should be "carefully considered"); reducing the field of view while the frame stayed visible "only slightly decreased homing performance". Scherer 2024 excluded one participant for "using the computer display's rim as an external cue". On a phone the frame is always there; it can serve as a ruler for turns (one screen width = one field of view), which is a legitimate visual strategy, not a landmark [DJ].
- **Nothing in the literature tests landmark-free visual path integration on a phone screen.** Sea Hero Quest's flare levels run on phones but travel along a river (the banks are local cues) and offer three answers; SPACE runs on an iPad with landmarks. This is a gap: the phone version must be piloted (§9).

### 2.4 What "no landmarks" means in practice, and which cues remain
**Remove (each is a heading or position cue):**
- Distinct objects and beacons; distal landmarks (mountains, towers). Lakshminarasimhan 2018: adding a distant mountain background removed most of the angular bias (angular gain 1.1 instead of about 1.6–2.1) but left the radial bias unchanged, so a far landmark mainly fixes heading.
- The sun, lighting direction, shadows, a sky gradient or clouds with a direction: any of these is a compass. Scherer 2024 lit the scene from directly overhead for this reason; Homing uses unlit materials and a flat sky.
- Boundaries and walls: they anchor position (Kelly 2020: nearby walls allowed piloting and shrank the teleporting penalty; Segen 2025: boundaries anchor object locations).
- Oriented textures: grid lines or stripes give a compass modulo 90° (Homing's comment); texture orientation should be random per trial (Petzschner & Glasauer 2011).
- Trackable static elements: a static ground lets one track individual pebbles near the start; limited-lifetime elements (Noel 2020: 250 ms, re-oriented each time) remove even this and leave pure flow.
- A texture region tied to the route (Homing's pebble disc is centred on the route; §1.2).

**What remains (and is the point):**
- Translational optic flow: the direction of travel relative to the ground and the speed in eye heights per second (the horizon and the ground's texture gradient give the scale).
- Rotational optic flow: turn rate, independent of depth.
- The horizon: pitch and roll reference only, no azimuth.
- The display frame: a rest frame and a possible ruler for turns.
- Time and motor signals: at a constant speed, distance = speed × time, so timing can stand in for flow; in active control, joystick deflection × time is a motor odometer. Counter both by varying speed and control gain within and between trials (Petzschner & Glasauer 2011: ±60 %).

So a strict dead-reckoning item has: a flat ground of limited-lifetime (or per-trial re-randomised) elements, a uniform sky and soft horizon, unlit shading, no objects after the start marker disappears, and variable speeds.

---

## 3. Error models and what makes a trial hard

### 3.1 The encoding-error model (Fujita et al. 1993)
- **Idea.** All systematic error arises when the outbound path is encoded; computing and executing the return are accurate. Four assumptions (as listed by Harootonian 2020): a Euclidean internal representation, each straight leg encoded as one length, each turn as one angle, and no systematic error in computing or executing the homeward path. It is configural: the path is stored and the home vector computed at the end.
- **Form.** Linear encoding functions: encoded length L′ = a_L·L + b_L and encoded turn T′ = a_T·T + b_T. Fitted to blindfolded walking (Loomis 1993: legs 2, 4, 6 m; turns 60°, 90°, 120°): **a_L = 0.60, b_L = 1.2 m; a_T = 0.48, b_T = 44°** (the original used the inner angle, intercept 50°), predicted against observed signed error r = 0.92 (Klatzky 1999, which reports these values). Slopes below 1 with positive intercepts are regression toward the mean: short legs and small turns are overestimated, long legs and large turns underestimated.
- **Limits.** Fits were "considerably worse" for paths more complex than a triangle (Klatzky 1999); the model is restricted to two-leg triangles and "does not perform well with 3 segmented paths" (Harootonian 2020); Chrastil & Warren 2021 found it predicted turn errors in the wrong direction for their walked triangles (r = 0.23, negative slope) and that an execution-only model fitted as well or better.
- **Use in Parallax [DJ].** As a diagnostic, not as the key: for each item, the model's predicted response (with parameters refitted on Parallax's own pooled data, since the published values come from blind walking at 2–6 m) says where a "typical regression" answer would land. Feedback can then tell regression errors (normal, shrink with practice) from qualitative ones (side or heading errors, §3.5).

### 3.2 Vector addition with leg weights (Harootonian et al. 2020)
- Home vector **x̃_D = −(β_A·x_A + β_B·x_B) + ε**, with Gaussian noise whose SD grows with the outbound vectors: **σ = σ̃·√(‖x_A‖² + ‖x_B‖²)**. A second model adds an exponentially decaying memory of previous trials (weight β_λ, decay α ∈ [0, 1]).
- Fitted weights were below 1 and unequal (Exp 1: β_A = 0.30, β_B = 0.81; Exp 2: β_A = 0.49, β_B = 0.58): the first leg is under-weighted more than the second (recency).
- Walking on an omnidirectional treadmill (HTC Vive, legs up to ~250 m): distance undershoot grew with distance, roughly logarithmically ("similar to Weber–Fechner"), and its SD grew linearly. The history term mattered in Exp 1 (trial-to-trial regression), less in Exp 2.
- The vector form extends to n legs with one weight per leg (not tested there).

### 3.3 Leaky integration
- **Lappe, Jenkin & Harris 2007** (abstract and appendix read): distance from the start p(x) = (k/α)(1 − e^(−αx)) when judging distance travelled; distance to a goal D(x) = D₀e^(−αx) − (k/α)(1 − e^(−αx)) when moving to a remembered target. One leak α and one gain k explain underestimation in the first task and overestimation in the second. The integration runs over space, not time.
- In the firefly task the best-fitting integration time constants were much longer than the trials, so the leak added little (Lakshminarasimhan 2018 preprint). In Stangl 2020 the leak explained under 3 % of squared error. Leak matters for long paths and long trials, not for 5–20 s trials [DJ from both].

### 3.4 Bayesian accounts and noise accumulation
- **Slow-speed prior (Lakshminarasimhan et al. 2018).** An exponential prior over velocity, a likelihood whose variance grows with speed, perfect integration. Velocity is underestimated, so people travel and turn too far when steering to a remembered target: radial gain 1.19 ± 0.07, angular gain 1.78 ± 0.16 (above 1 = overshoot). Undershoot appeared only for distant targets (32 m). **Sparser ground texture increased the bias** (radial 1.27 → 1.46; angular 1.58 → 2.13). This model beat a leaky integrator (about 1.35 times more likely per trial). Four of seven people rotated first and then moved straight, the others moved along curves; both had similar biases.
- **Iterative Bayesian estimation (Petzschner & Glasauer 2011).** In distance and angle reproduction, responses are a weighted average (on a log scale) of the measurement and a prior that is updated every trial like a Kalman filter (steady-state prior weight about 0.33–0.40; time constants 0.2–2.1 trials). The wider the range of distances or angles in a block, the stronger the pull toward its centre; the variability grows linearly with the magnitude (r = 0.95–0.97).
- **Noise decomposition (Stangl et al. 2020).** Position estimate as a drift–diffusion (Ornstein–Uhlenbeck) process: dx̂/dt = −β·x̂ + α·v + b + σ₀·ξ(t), with σ₀ scaling with speed (so noise grows with distance travelled), plus radial (log-scale) and angular reporting noise. Shares of squared error: **accumulating noise 50–55 %, velocity gain bias 25–26 %, radial reporting noise 14–15 %, angular reporting noise 12–13 %, additive bias and leak under 3 % each**. Errors scaled with distance, not time (stop trials of ~89 s and non-stop trials of ~35 s had similar errors). The older adults' deficit was explained by accumulating noise alone. Their set-up had distal landmarks at infinity (a compass), so it speaks to translation and position noise, not heading keeping.

### 3.5 Qualitative errors in visual-only path integration
These are not graded misses but wrong answers of a kind; feedback has to name them.
- **Heading not updated.** With visually simulated turns, people "failed to update their heading in a triangle completion task if they could not rotate their bodies" (Klatzky 1998, as reported by He & McNamara 2018; primary not read, see ACCESS). The response then equals the correct home direction measured from the *initial* heading instead of the final one: **turn = (bearing of start) − (initial heading)**. Homing's shortcut checks do not include this answer.
- **Left–right inversions.** 6 of 16 naive people (37.5 %) consistently pointed to the mirror direction in passive, landmark-free point-to-origin trials on an 84° × 63° projection, while still being sensitive to the turn's size; the same people made no such errors when walking (Riecke & Wiener 2007). Inversion went with lower spatial ability. The authors conclude that a good projection is "not necessarily sufficient for enabling natural spatial orientation in VR if no landmarks are provided".
- **Reference-frame preference** (Gramann 2005, tunnel task, 19-inch monitor): roughly half of people are "turners" (respond as if they took on each new heading) and half "non-turners" (track the turn without adopting it). Both are accurate in their own frame (mean absolute errors 6–12° once classified). The preference was stable across days but people could use the other frame when instructed ("preferential rather than obligatory"). For Parallax this means the answer frame must be unambiguous: the dial's top is "the way you face *now*", said and drawn, and the non-turner answer is diagnosed, not merely marked wrong.
- **Overshooting the homing turn.** Desktop and HMD vision-only studies report systematic overturning of the homing direction (Scherer 2024; the 2025 preprint's mean symmetric direction error of 55.3°; Harootonian 2020 Exp 1: 34.7° overshoot while walking).

### 3.6 What makes a trial hard
| Factor | Evidence | Direction and size | Use as a dim? |
|---|---|---|---|
| **Number of legs/turns** | Sea Hero Quest: flare accuracy fell from 1 to 5 turns in every country (19,038 players; Coutrot 2018 preprint). Gramann 2005 Exp 2: errors larger for 2 and 3 turns. Wiener & Mallot 2006: with total length, total turning and turn direction held constant, more segments did *not* impair pointing (faster, slightly more accurate). Colmant 2023: 3 waypoints too hard for older adults. Klatzky 1999: the configural model fits worse beyond triangles | Harder, mostly through more total turning, more length and more to remember | Yes, as now (legs × turn size), but control total length so the dim measures complexity |
| **Path length** | Stangl 2020 (noise grows with distance); Harootonian 2020 (undershoot grows ~log, SD linearly); Kelly 2020 (large paths, larger distance errors); Wiener 2011 via He & McNamara 2018 (configural vs continuous strategies differed only on long paths, 15.3 m vs 8.3 m) | Harder with length | Folded into the route dim; keep legs 6–20 m on phones |
| **Turn angles** | Chrastil & Warren 2017, 2021: small turns overturned, large underturned; homing turns of ~120–135° most accurate, 90° overshot by 15–20°, ~160° underturned; Klatzky 1999 turn slope 0.48 | Regression to the mean; extreme turns hardest | Turn size bands as now; spread answers so no habitual turn pays |
| **Speed and speed changes** | So 2001: nausea rose from 3 to 10 m/s (HMD); Petzschner & Glasauer 2011 varied speed ±60 % to stop timing; Riecke 2002: errors uncorrelated with velocity when velocities were randomised (0.75–1.5× translation, 0.5–2× rotation) | Constant speed allows timing shortcuts; variable speed forces integrating velocity | Yes: "constant → variable speed" |
| **Optic-flow quality** | Lakshminarasimhan 2018: sparser ground, larger bias; Noel 2020: limited-lifetime elements | Sparser or shorter-lived flow is harder | Yes: "textured → sparse → short-lived dots" (late rungs) |
| **Delay before answering** | Stangl 2020: errors scale with distance, not time; no study read manipulates a delay in visual path integration | Small effect expected (no evidence read) | No; it lengthens trials for little gain |
| **Rotation versus translation** | Chrastil 2017: curved loop judgements (59 %) harder than translation-only (68 %) or rotation-only (70 %) judgements; firefly: angular bias (1.49–1.78) much larger than radial (1.10–1.19) (Noel 2020; Lakshminarasimhan 2018); a far landmark removes most angular but not radial bias; the 2025 preprint: vision-only hurt distance most, direction was not significantly affected by condition but was overturned | Without a compass, heading is the fragile part; distance regresses to the mean | Rotation-only and translation-only items as the first tutorial rungs; curved paths (rotation and translation together) as a late rung |
| **Stimulus range and order** | Petzschner & Glasauer 2011: wider ranges, stronger central tendency; the prior updates trial by trial | Mixing very different lengths in a block raises bias | Keep a block's lengths in a band; log the previous trial's magnitudes |
| **Response mode** | Chrastil & Warren 2021: execution error dominates walked returns; Kelly 2020: response latency; Gramann 2005: map format vs arrow format | A travel-back response is noisier than pointing | Yes: "point → point + distance" |

**Summary for the ladder [DJ].** The strongest and best-supported difficulty drivers are total turning without a compass, the number of legs, path length, and whether distance is asked. Flow quality and variable speed are well-motivated later rungs. Delay is not worth a dim. Every factor's step size is unknown for phones and must be refitted from pooled data (the engine's simulations show targeting holds under misspecified steps; ENGINE.md).

---

## 4. Training and transfer evidence

### 4.1 Does practice with feedback improve path integration?
**Within the task, yes, at least within a session; how long it lasts is untested.**
- **Noel et al. 2020** (firefly task, humans, 2 blocks × 150 trials): in block 2 a bull's-eye of six rings was drawn on the floor after each stop (its outer radius set by a 1-up/2-down staircase) and a green or red arrowhead marked the true target. In controls the radial gain went from 1.10 ± 0.06 (overshoot) to **0.97 ± 0.02 (no bias)**, the angular gain from 1.49 ± 0.05 to **1.09 ± 0.02** (bias reduced, not gone), endpoint variability fell, and trials got shorter (5.42 → 3.70 s). Modelling put the gain in a smaller growth of sensory noise with speed, not in a change of the speed prior. Feedback was always in the second block, so practice and feedback are confounded (my reading of the design as reported).
- **Riecke et al. 2002**: 20 training trials with feedback (a top-down view of the trial for 2 s) before testing; no learning between the two test blocks (test had no feedback).
- **Scherer et al. 2024** (desktop, no feedback, 4–5 sessions of 30–45 min): a small trend of lower position error over sessions (likelihood-ratio p ≈ .0003; BIC not improved), "small compared to the effect of object number".
- **McLaren et al. 2022** (triangle completion, real and HMD, two sessions the same day, 6 trials each): in VR the angle of deviation fell by 20 % and the endpoint error by 6.8 cm; test–retest correlations were poor (r < .5) for endpoint and angle error, moderate only for distance travelled (r = .55–.66). A handful of trials gives an unreliable score.
- **Akan et al. 2026** (Apple Game, 0–3 star feedback per trial, two sessions a week apart, 32 + 32 trials): no testing-day effect on drop error (F = 0.39, p = .53). Coarse feedback over few trials did not produce a measurable session-to-session gain there.
- **Gramann et al. 2005**: with instructions and practice, people could use their non-preferred reference frame with comparable accuracy; the preference itself was stable.
- **Recalibration.** Du, Mou & Zhang (2020; abstract and notes read) adapted people to a 0.7 visual rotation gain while they physically turned; the adaptation showed in later blind walking but not in a video-only (visual) path. Vision can recalibrate locomotion when both are present; nothing here shows that vision-only practice transfers to walking.

### 4.2 Is there transfer to wayfinding or to other spatial tests?
**Not shown for path integration training. Navigation training transfers little beyond itself.**
- **Lövdén et al. 2012** (the largest navigation training study read): 42 sessions of 50 min over about 4 months, searching a virtual zoo while walking on a treadmill, with time feedback. Navigation improved by 1.42 SD (young) and 3.34 SD (older men) against a walking-only control, partly kept at a 4-month follow-up. Transfer: only a non-significant trend on the Guilford–Zimmerman spatial orientation test (+0.29 SD, p = .072); no other transfer test moved (Raven, mental rotation, route and location memory, working memory). Hippocampal volume stayed stable in navigators and declined in walkers.
- **Xu et al. 2024** (49 older adults, one 10-minute VR wayfinding session with teleporting, a building replica): faster and shorter routes on *new* routes in the same building (duration HR 1.71; distance HR 2.03), no effect on pointing or distance-estimation errors; preliminary and narrow.
- **Correlations, not transfer:** visual homing errors correlated with paper spatial tests in Riecke 2002 (Schlauchfiguren and Würfel Erkennen; r up to −.79, but n = 10–14); left–right inverters had lower spatial ability (Riecke & Wiener 2007); in SPACE (n = 342, iPad), path-integration error loaded on one factor with pointing error and map drawing, separate from perspective taking (Colombo 2024 preprint); Chrastil 2017's loop-closure accuracy did not correlate with the sense-of-direction scale, the Road Map Test or a perspective-taking test (n = 26). Sea Hero Quest's wayfinding levels predicted real-world wayfinding in London (r = .46) and Paris (r = .57) while its tutorial did not (r = .06); the flare levels were not validated separately in what I read (Spiers et al. review).
- **Screen versus body.** Path integration on a screen is a harder, partly different task from walking: in the 2025 free-walking preprint, adding walking to vision halved the position error (22.5 → 10.6 m); discordant teleporting (no body rotation) inflated errors (Kelly 2020); Riecke & Wiener's inverters made no side errors when walking. Training on a screen may improve screen path integration without changing walking navigation [DJ].

### 4.3 Recent work (2020–2026) and what is under-tested
- Recent: Stangl 2020 (noise, not bias, explains aging deficits); Harootonian 2020 (vector addition beats the encoding-error model); Noel 2020 (feedback removes radial bias); Chrastil & Warren 2021 (execution error); McLaren 2022 (poor reliability with few trials); Segen 2022 review (path integration deficits in aging and early Alzheimer's disease; abstract only); Colmant 2023 and Akan 2026 (Apple Game; desktop, pure path integration without landmarks); Scherer 2024 (remote desktop homing); Colombo 2024 (SPACE, iPad); the 2025 free-walking preprint.
- **Under-tested (gaps):**
  1. No randomised study of *path integration* training with a transfer test was found (the search budget for this turn ran out after the searches listed in References; a follow-up search is worth one more try with terms like "path integration training" + "transfer" + "randomized").
  2. No study of visual-only path integration on phone-sized screens.
  3. Whether feedback reduces the accumulating noise that dominates error (Stangl 2020) or only the gain bias, and whether gains last beyond a session.
  4. Whether training heading-keeping (the qualitative errors in §3.5) transfers to other orientation tasks such as Orient or the View Match probe.
- **Honest wording for the app (CLAUDE.md rule 2) [DJ]:** "Practising here improves this task. In a lab version of this task, feedback reduced systematic overshoot within one session. Whether it helps finding your way in real places has not been studied; walking adds body senses that a screen cannot give."

<!-- R1-NEXT: section 5 -->
