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

6. **Community input (relayed by the coordinator, 13 Nov).** A player who knows an earlier path-integration training tool says that the absence of landmarks is essential, because landmarks are what navigators use to *reduce* dead-reckoning error, and that Parallax's Homing ("Nav mode") sidestepped this by adding landmarks (the windmill and the others); the earlier tool relied mostly on egocentric path integration and on minimising error. He pointed to Wikipedia's "Dead reckoning": the method advances a known position by speed, heading and time, "these errors tend to compound themselves over greater distances", and accuracy is restored "by using other, more reliable methods to get a new fix part way through the journey", such as a landmark coming into view [Wikipedia, read]. The critique is right for Homing as built: its ladder starts with three landmarks, its tutorial tells people to "use them like a compass", its difficulty model prices their removal at only +0.4 logit per level, and so a learner can reach mid-levels without ever practising dead reckoning. Homing's 400 m landmarks are mainly *heading fixes* (§1.2), and heading is exactly what visual-only path integration loses (§3.5). This supports the split: **Reckon never shows a landmark or any other fix, in any item, practice item or demo; Homing keeps its landmarks as the separate, easier stage before it** (§8.1 states how).

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
- Rotation is the component most sensitive to how movement is produced. When rotations were made without the body (discordant teleporting, Kelly 2020), distance error (η²p = .66) and angular error rose and latencies grew; the authors recommend keeping body rotation. Visual-only turning without a compass is where heading updating fails (Klatzky 1998, as reported by He & McNamara 2018a; Riecke & Wiener 2007).
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
- **Heading not updated.** With visually simulated turns, people "failed to update their heading in a triangle completion task if they could not rotate their bodies" (Klatzky 1998, as reported by He & McNamara 2018a; primary not read, see ACCESS). The response then equals the correct home direction measured from the *initial* heading instead of the final one: **turn = (bearing of start) − (initial heading)**. Homing's shortcut checks do not include this answer.
- **Left–right inversions.** 6 of 16 naive people (37.5 %) consistently pointed to the mirror direction in passive, landmark-free point-to-origin trials on an 84° × 63° projection, while still being sensitive to the turn's size; the same people made no such errors when walking (Riecke & Wiener 2007). Inversion went with lower spatial ability. The authors conclude that a good projection is "not necessarily sufficient for enabling natural spatial orientation in VR if no landmarks are provided".
- **Reference-frame preference** (Gramann 2005, tunnel task, 19-inch monitor): roughly half of people are "turners" (respond as if they took on each new heading) and half "non-turners" (track the turn without adopting it). Both are accurate in their own frame (mean absolute errors 6–12° once classified). The preference was stable across days but people could use the other frame when instructed ("preferential rather than obligatory"). For Parallax this means the answer frame must be unambiguous: the dial's top is "the way you face *now*", said and drawn, and the non-turner answer is diagnosed, not merely marked wrong.
- **Overshooting the homing turn.** Desktop and HMD vision-only studies report systematic overturning of the homing direction (Scherer 2024; the 2025 preprint's mean symmetric direction error of 55.3°; Harootonian 2020 Exp 1: 34.7° overshoot while walking).

### 3.6 What makes a trial hard
| Factor | Evidence | Direction and size | Use as a dim? |
|---|---|---|---|
| **Number of legs/turns** | Sea Hero Quest: flare accuracy fell from 1 to 5 turns in every country (19,038 players; Coutrot 2018 preprint). Gramann 2005 Exp 2: errors larger for 2 and 3 turns. Wiener & Mallot 2006: with total length, total turning and turn direction held constant, more segments did *not* impair pointing (faster, slightly more accurate). Colmant 2023: 3 waypoints too hard for older adults. Klatzky 1999: the configural model fits worse beyond triangles | Harder, mostly through more total turning, more length and more to remember | Yes, as now (legs × turn size), but control total length so the dim measures complexity |
| **Path length** | Stangl 2020 (noise grows with distance); Harootonian 2020 (undershoot grows ~log, SD linearly); Kelly 2020 (large paths, larger distance errors); Wiener 2011 via He & McNamara 2018b (configural vs continuous strategies differed only on long paths, 15.3 m vs 8.3 m) | Harder with length | Folded into the route dim; keep legs 6–20 m on phones |
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

---

## 5. Existing apps, games and research tools

### 5.1 What they do
| Tool | Platform and reach | Path-integration part | Answer and scoring | Landmarks |
|---|---|---|---|---|
| **Sea Hero Quest** (Coutrot 2018 preprint; Spiers et al. review) | Phones and tablets; 2.5 million players finished level 1, 558,143 analysed; 17 languages | 15 "flare" levels: steer a boat along a river with bends to a flare gun, then shoot it back toward the start | Choose 1 of 3 proposed directions; 3, 2 or 1 stars by closeness. Accuracy fell from 1 to 5 turns | The river and its banks; no free movement |
| **SPACE** (Colombo 2024 preprint) | 10.2-inch iPad, "serious game" | Follow a robot from a rocket to two landmarks, then return unguided to where the rocket was | Mean distance between the return point and the true spot; norms by age (n = 342) | Yes (landmarks on a planet) |
| **Apple Game** (Bierbrauer 2020, not read; Colmant 2023; Akan 2026) | Desktop or scanner goggles, joystick (research) | Collect a basket, walk via 1–5 trees, drop the basket where it was; a pure subtask with only a grassy plain and a sky at infinity | Drop error; 0–3 stars by fixed distance thresholds | None in the pure subtask; a lighthouse in the landmark subtask |
| **Firefly task** (Lakshminarasimhan 2018; Noel 2020) | Projection + joystick (research) | Steer to a target that was shown for 1 s on a ground of short-lived triangles | Stop position; regression gains; a bull's-eye feedback ring sized by a staircase | None |
| **Tunnel task / Spatial Reference Frame Proclivity Test** (Gramann 2005; SILC entry) | Desktop videos; an online version on Labvanced (~20 min) | Passive passage through a tunnel or a star field with turns in yaw and pitch | Pick 1 of 2 or 4 homing arrows (classification), or adjust an arrow; side, absolute and signed errors | None |
| **Virtual SILCton** (v1.0 notes, B §10) | Desktop | Route learning on a virtual campus, then pointing between buildings | Pointing error, map placement | Yes (buildings): wayfinding, not dead reckoning |
| **Homing** (Parallax EX-11) | Browser; desktop first | Passive 2–4-leg walk on a plain | Turn to face the start (dial); right within 40/30/20° | Several → one → none |

Notes:
- Sea Hero Quest's wayfinding levels (not the flare levels) were the ones checked against real-world navigation (London r = .46, Paris r = .57); the team avoided circling tasks partly because circling "could potentially cause nausea" (Spiers et al.). Its tutorial levels are used to normalise for video-game skill, a good idea for any control-heavy task.
- No commercial brain-training app with a landmark-free path-integration game turned up in the searches made before the search budget ran out; an app-store survey was not done [gap].

### 5.2 How Parallax can go beyond them
1. **Truly landmark-free and fix-free** throughout (§8.1), which Sea Hero Quest (river banks) and SPACE (landmarks) are not.
2. **Continuous answers** (a direction to the degree, then a distance) instead of 1 of 3 directions: more information per trial and a lower guessing rate (1/3 → 6–22 %, §6).
3. **Diagnostic feedback** that names the error type (heading not updated, sides swapped, regression of turn sizes, distance under- or overshoot) and replays the route; none of the tools above explains a miss.
4. **Feedback aimed at the accumulated error** ("drift per distance walked", trend over sessions, bias estimates over the last trials), which the firefly feedback study suggests can remove systematic bias within a session (Noel 2020).
5. **Adaptive difficulty with an honest rating** (level with a range, per screen class), component rungs (turn-only, distance-only) before whole routes, solver-verified keys and shortcut tests.
6. **Phone-first controls that do not reveal the path** and comfort settings (§7).
7. **Open and offline**, with a research export so pooled data can refit the difficulty steps and the error model.

### 5.3 The player's earlier tool
I could not identify the tool or the study behind it. The coordinator asked me not to look for its code, and the web-search budget for this turn was used up before the message arrived, so I could not search for a description either. The published protocols that match what the player describes (egocentric, landmark-free, scored on minimising error) are:
- **The firefly task**: Lakshminarasimhan et al. 2018, https://www.biorxiv.org/content/10.1101/191817 (published in Neuron, 2018), and its human feedback version, Noel et al. 2020, PNAS 117:11158–11166, https://doi.org/10.1073/pnas.2000216117. A ground of short-lived triangles that "could not serve as landmarks", and feedback whose target ring shrinks by staircase as error falls: the closest match to "minimising errors".
- **The Apple Game's pure path-integration subtask**: Colmant et al. 2023, Neurobiology of Aging 131:170–181, https://www.neuro.psy.ruhr-uni-bochum.de/np/mam/colmant_et_al_2023.pdf; Akan et al. 2026, PLoS Biology 24(3):e3003661, https://www.neuro.psy.ruhr-uni-bochum.de/np/mam/akan_et_al_2026.pdf.
- **Visual homing without landmarks**: Riecke, van Veen & Bülthoff 2002, Presence 11:443–473, https://www.sfu.ca/~ber1/web/journalPapers/Riecke__02_Presence__Visual_Homing_Is_Possible_Without_Landmarks__A_Path_Integration_Study_in_Virtual_Reality.pdf.
- **Egocentric pointing in the tunnel task**: Gramann et al. 2005, JEP:HPP 31:1199–1223, https://sccn.ucsd.edu/~klaus/pubs/Gramann%20etal%202005%20JEPHPP.pdf (demos at https://sccn.ucsd.edu/~klaus/tunnel.html).
If the player can name the tool or its paper, its protocol can be compared with §8 directly.

---

## 6. Scoring and verification

### 6.1 The key and the error measures
World as in Homing: metres, x east, y north, bearings clockwise from north. The route ends at E with heading H; the start is S.
- **Home vector** k = S − E; home distance d = ‖k‖; **key direction** θ* = wrap360(bearing(k) − H) (degrees clockwise from the way one faces at the end). For a "return" item the key is the pair (θ*, d).
- **Response.** "Point": a direction θ. "Return": a direction θ, then a straight walk of length r, so the stop point is P = E + r·u(H + θ) with u(b) = (sin b, cos b). (A two-phase response, turn then walk, keeps the decomposition clean and is easier on a phone; §7.1.)
- **Angular error** e_θ = wrap180(θ − θ*), absolute value in [0°, 180°]; keep the signed value (side of the miss).
- **Distance error**: signed r − d; ratio ρ = r/d; **log ratio ℓ = ln(r/d)** (symmetric for over- and undershoot, matches the log-scale reporting noise of Stangl 2020 and the log-scale fusion of Petzschner & Glasauer 2011).
- **Position (drop) error** e_p = ‖P − S‖ = √(r² + d² − 2rd·cos e_θ) (law of cosines); **relative error** e_p/d. For small errors e_p/d ≈ √(e_θ[rad]² + (ρ − 1)²).
- **Drift rate** e_p / (path length travelled): the navigator's measure of dead-reckoning error (error per distance travelled); use it for feedback and trends (§8.1), not for scoring (see 6.3).
- Log all of them per trial (`value` = the main error, `detail` = the rest), plus the qualitative flags of 6.4.

### 6.2 Right or wrong for the adaptive engine
The engine wants a binary outcome with a predicted probability (ARCHITECTURE §7), so continuous errors are cut at a tolerance that is itself a difficulty dim (as Homing does).
- **Point items:** right when |e_θ| ≤ τ_θ (40°, 30°, 20°).
- **Return items:** right when **e_p ≤ τ_p · d**, a disk round the start whose radius is a fixed share of the home distance (τ_p = 0.5, 0.35, 0.25). One number, symmetric, readable ("within a third of the way back"), and scale-free like the noise. The disk never contains the end point (τ_p < 1), so "stay where you are" can never be right.
- What the disk allows, at the edges: with a perfect distance, an angle of 2·asin(τ_p/2) (29°, 20°, 14°); with a perfect direction, a distance ratio of 1 ± τ_p.
- **Graded feedback, binary rating.** The verdict shows the continuous errors in words and numbers ("4 m off: within a third of the way back"); the rating uses the binary outcome. CLAUDE.md rule 11 (no points) argues against the stars that Sea Hero Quest and the Apple Game use.
- **Why tolerance steps of about 0.9 logit are sensible, and when they are not.** If a learner's angular errors are roughly normal with SD σ, the hit rate is erf(τ/(σ√2)):

| σ | τ = 40° | 30° | 20° | logit steps 40→30, 30→20 |
|---|---|---|---|---|
| 15° | .99 | .95 | .82 | 1.82, 1.54 |
| 20° | .95 | .87 | .68 | 1.17, 1.10 |
| 25° | .89 | .77 | .58 | 0.88, 0.90 |
| 30° | .82 | .68 | .50 | 0.73, 0.79 |
| 40° | .68 | .55 | .38 | 0.58, 0.67 |
| 50° | .58 | .45 | .31 | 0.50, 0.61 |

So Homing's 0.9-logit tolerance step is right for a learner with σ ≈ 25° and too small for good learners (the step grows as σ shrinks). The logistic model is an approximation; pooled exports should refit the steps (CLAUDE.md, lessons). Published visual-only figures range from mean absolute errors of 6–12° (tunnel, one turn, each person scored in their own reference frame; Gramann 2005; for normal errors σ ≈ 1.25 × the mean absolute error, so σ ≈ 8–15°) to direction SDs of 26–35° (desktop and HMD homing; Scherer 2024; the 2025 preprint).

### 6.3 Chance levels
- **Point:** a uniform guess hits with probability 2τ_θ/360 (22, 17, 11 %), as in Homing. A guesser who knows the key distribution does better: with keys spread over the allowed 280° (Homing's [20°, 160°] ∪ [200°, 340°]) the best fixed answer can reach 2τ_θ/280 (29 % at 40°). The node test bounds the cross-validated best fixed answer at chance + 10 points (rule 5), as Homing's test does.
- **Return (disk):** an upper bound is the case where the guesser knows d exactly and guesses only the direction: the disk subtends a half-angle asin(τ_p) from E, so **chance ≤ 2·asin(τ_p)/360 = 16.7 %, 11.4 %, 8.0 %** for τ_p = 0.5, 0.35, 0.25. Use this bound as `chance(params)` (conservative: a real guesser does not know d).
- **Why not normalise the disk by the path length?** Dead-reckoning error grows with distance travelled, so "within 10 % of the distance walked" sounds natural, but on routes that end near the start the disk would contain the end point and "do nothing" would score right. Keep scoring relative to d and show the drift rate as feedback.

### 6.4 Shortcuts, error types and the solver tests
Every generator must keep these answers out of the tolerance by a margin (rule 5; Homing's MARGIN = 2°), and the node test reports each one's hit rate per cell:
| Answer | Formula | Requirement |
|---|---|---|
| Turn round | θ = 180° | miss (as Homing; free only where the target lies near 180°) |
| Turns reversed (path-blind) | θ = 180° − Σ turns | miss (as Homing) |
| **Heading not updated** (new) | θ = wrap360(bearing(k) − H₀) = θ* + Σ turns | miss: require \|wrap180(Σ turns)\| > τ_θ + margin, otherwise the item cannot tell heading keeping from not turning at all |
| **Mirror** (sides swapped) | θ = 360° − θ* | miss by > τ + margin: needs the key at least (τ + margin)/2 from straight ahead or behind (21° at 40°; Homing's 20° gap leaves the mirror exactly on the edge for keys at 20°) |
| Turns only (legs equal) | key of the same turns with equal legs | miss where the geometry allows (as Homing) |
| Best fixed answer | the one direction that hits most items | ≤ chance + 10 (cross-validated) |
| Encoding-error-model answer | key of the path with L′ = 0.6L + 1.2, T′ = 0.48T + 44° | *report only*: it is a typical human error, not a shortcut |
| Distance: last leg back | r = last leg | report the radial hit rate; keep it low by varying the last leg |
| Distance: proportional to path length or to outbound time | r = c·ΣL, r = c·T (best c) | report; with varied speeds the time version must stay near the fixed-distance rate |
| Distance: best fixed | r = the most common d | report |

The qualitative flags for feedback (6.1) are the same formulas: a response within tolerance of the heading-not-updated answer, of the mirror, or of 180°/reversed (when those differ from the key) gets the matching hint.

### 6.5 What the validator re-derives
Independent of the generator (Homing's pattern: `validate` recomputes from the stored legs and turns; the node test recomputes again with `Math.sin`/`Math.cos`):
- the path, final heading, home vector, key direction and home distance from the start heading, legs, turns (and arcs for curved legs: centre, radius, sweep);
- for varied speeds, that each leg's speed profile integrates to its length (∫v dt = L) and stays within the comfort limits (§7.2);
- the route never passes within 3 m of the start before the end and ends at least END_MIN away (as Homing); the home distance fits the return control's range;
- the key's distance from straight ahead and behind (6.4), and |wrap180(Σ turns)| for heading items;
- that no landmark, fix or route-tied cue exists in the item: the scene description carries no objects, its texture seed is independent of the route, and the start marker is hidden from a fixed distance on (§8.1);
- the shortcut answers of 6.4 miss by the margin.

---

## 7. Phone design

The layout problems of today's Homing on phones (the demo walk plays below the fold, captions under the pinned bar, landscape pushes the view off the screen, no void on a device turn) are measured in `docs/research/v1.1/I2-mobile-audit.md` §3, §8 and §10; this section covers what is specific to a landmark-free dead-reckoning task.

### 7.1 Controls and answers that do not reveal the path
- **During a passive route:** no controls except a visible **Pause** button that actually freezes the motion (today the player's Pause voids Homing's trial but the walk plays on unseen; §1.3). A paused trial stays void (rule 7).
- **Direction ("turn to face the start"):** drag horizontally anywhere on the 3D view to turn yourself (I2 §3's option (a); the gesture people try first on a 3D view), about 0.3° per CSS px, with −5° / −1° / +1° / +5° buttons (≥ 44 px) for fine steps and the arrow circle as a small readout (top = straight ahead). Keyboard: ← → 5°, Shift 1°. Turning the view is safe because nothing in the scene marks a place (§8.1); the start marker is gone by then.
- **Distance ("walk back"):** after confirming the direction, hold a large **Walk** button at the bottom (thumb zone, ≥ 64 px tall) or hold ↑ to walk straight on; release to stop; hold **Back** to step back a little; **Here** confirms. The return speed is varied per trial (for example ±30 % round 1.5 m/s) so that holding for a counted time does not stand in for watching the ground. Walking back uses the same visual odometer as the outbound route, as in Riecke 2002 and Scherer 2024.
- **Steering rung (firefly type):** one thumb-stick in the bottom half (up = forward speed, sideways = turn rate), velocity control with a small dead zone and ease, at most 2 m/s and 45–60°/s (Noel 2020 used 2 m/s and 90°/s on a large projection); a second Stop button. Whether inertia (acceleration control) biases responses is what Stavropoulos 2022 tested; that paper could not be opened (ACCESS), so start with plain velocity control.
- **Never shown during an item:** a north arrow or compass ticks fixed to the world, a minimap, a trail, the distance walked, leg lengths or turn sizes, a progress bar that maps onto position, or any marker of the start. The ground texture is not centred on the route (§1.2).
- **Reduced motion:** see 7.2. A fallback answer without walking back (tap where the start is on a blank top-down disc with you in the centre facing up) is possible but turns the distance answer into a map judgement; if offered, log the answer mode per trial and keep it out of the main rating [DJ].

### 7.2 Motion-sickness mitigation
| Measure | Evidence | Setting |
|---|---|---|
| Lower speeds | So 2001: nausea and vection rose from 3 to 10 m/s, then levelled (HMD, 48° field, 30 min); the slowest speed tested (3.3 m/s) was the mildest. Riecke 2002 capped rotation at 40°/s "partly to reduce simulator sickness" | Translation 1.2–2 m/s, rotation ≤ 40–45°/s (Homing uses 3 m/s and 60°/s) |
| Smooth starts and stops | Riecke 2002 used short acceleration and deceleration phases | 0.3–0.5 s raised-cosine ramps on every start and stop; positions stay exact because the key is computed from geometry |
| No snap turns or teleports in the route | They remove the rotation information the task is about; teleporting without body rotation raised errors (Kelly 2020) | Continuous rotation only |
| A rest frame | Rest frames reduced visually induced sickness (Cao 2018, as reported by Cao, Grandi & Kopper 2021; primary not read) | Keep the stage's frame, the page around it and a fixed "ahead" notch at the top centre; no full-screen immersion |
| Field of view | Larger fields give stronger vection and potentially stronger symptoms (background statement in the 2024 visual-field-occlusion preprint; not a result) | Fixed geometric field of 65–75° on every device; a phone shows it in 10–25° of visual angle, which already weakens vection; do not vignette on phones (the view is all central, and a vignette would hide the flow) |
| Dynamic field-of-view restriction during turns | Fernandes & Feiner 2016: less sickness, no loss of presence (press release only) | Optional on large screens, logged per trial because it may change difficulty |
| Short exposures | So 2001: ratings rose over the 30-minute exposure (speed changed their onset, not their rate of rise) | Most trials 10–25 s of motion, never over 30 s (shorter legs at the slower speeds, §8.3); a pause card after about 3 min of motion; a one-time "stop if you feel unwell" notice before the first route |
| Active control | Widely reported to reduce sickness in VR (not verified in this pass) | Make the return, and later the outbound route, active |
| Reduced motion | The motion is the stimulus (CLAUDE.md rule 8 applies "outside the stimulus itself") | A gentle profile (1.2 m/s, 30°/s, 0.6 s ramps), the same items; say plainly that the exercise needs on-screen motion |
| Flicker | Rule 8: nothing faster than 3 Hz. Noel 2020's target blinked at 5 Hz | Short-lived ground dots fade in and out (no hard on/off), live ≥ 0.5 s and are out of phase with each other; any target marker is steady |

### 7.3 Performance budget on mid-range phones
- **What the app already does** (ARCHITECTURE §4, `js/core/stage3d.js`, `timing.js`): one WebGL context; device pixel ratio capped at 2; antialiasing off at DPR ≥ 2 or on phone-sized screens; quality steps down to DPR 1 after two stuttered trials; dt clamped to 100 ms so a slow frame slows motion but never jumps it; a stutter is a gap > 150 ms or > 15 % frames longer than 1.5 × the median. Homing adds its own void rule (a freeze > 400 ms or > 25 % slow frames).
- **Today's Homing scene** is cheap in geometry (one ground disc, one ~17,000-triangle pebble mesh, at most three landmark groups, the ring and the flag: well under 15 draw calls). Its problem on phones is aliasing of sub-pixel pebbles (§1.6), not load.
- **Budget for the new exercise [DJ]:** ≤ 10 draw calls; ≤ 50,000 triangles; one opaque pass plus one dot layer; no shadows, no post-processing; DPR ≤ 1.5 for this stimulus on phone-sized screens (a sharper image that shimmers carries less flow); flow elements 3–20 px on screen, fading with distance before they go sub-pixel; ≤ 2 ms of JavaScript per frame with no allocations in the loop; no texture uploads or saves during motion (rule 7); render on demand outside motion.
- **The ground, two options:** (a) a static random field of blobs in one merged mesh that wraps round the camera (positions taken modulo a square tile centred on the viewer), so it never ends, never points anywhere and is re-seeded per trial; (b) limited-lifetime dots as one `Points` or `InstancedMesh`, respawned round the camera in the vertex shader from a per-dot seed and a time uniform, so the CPU does nothing per dot. Option (b) needs `ShaderMaterial` and `Points` in the vendored three.js subset (`tools/vendor-three.mjs`); check before choosing it.
- **Measure on a real mid-range Android phone** (median frame ≤ 17 ms and < 5 % slow frames during a route) before release; the I2 audit ran in headless Chromium only.

### 7.4 Portrait versus landscape
- Portrait is one-handed and how most people hold a phone (thumb zone at the bottom; I2 §10); landscape gives the wider view a first-person stimulus wants.
- Support both, each with its own layout (I2 §3, §8): portrait with a landscape-shaped view band on top (aspect 4:3 to 16:10, so the 65–75° horizontal field does not force a huge vertical one) and the controls in the bottom half; landscape with the view at full height on the left and the controls on the right, without the app header.
- Hold the canvas size during motion (Track's `holdResize`) and **void the trial if the orientation or the screen class changes** during the route or the answer (rule 7, "device turned"; no code does this today, I2 §8). Log the orientation per trial.
- Do not rely on locking the orientation: the Screen Orientation API's `lock()` generally needs full screen and is not available in iOS Safari (general knowledge; the MDN page could not be opened in this pass). A "turn your phone" card plus the void rule is the robust path.
- Ratings stay per screen class (`perDisplay`), as for Homing and Track.

### 7.5 Turning the phone itself ("magic window")
Driving the view's rotation from the gyroscope would add real body rotation cues, the very cues whose absence makes visual-only heading keeping fail (Klatzky 1998 via He & McNamara 2018a; Kelly 2020). It would make a different, easier task with its own rating (I2 §10 says the same), needs a permission prompt on iOS and a secure context, and may be blocked in sandboxed previews (general knowledge; MDN could not be opened). Not for v1.1; a possible later, separately rated variant.

---

## 8. Proposed task design: Reckon (EX-12, experimental)

### 8.1 Four commitments (from the community input, §1.7 point 6)
**(a) Every landmark and every fix is removed.** A fix is anything that tells you where you are or which way you face without integrating your own motion. Reckon has none, in scored items, practice items and the demo alike:
1. **No objects in the world, ever**: no landmarks, beacons, trees, poles or walls; the flag appears only at the reveal, after the answer.
2. **No distal or lighting cues**: one flat sky colour, a fog horizon with no structure in azimuth, unlit materials, no sun, no shading direction, no shadows.
3. **No boundaries**: an endless plain.
4. **No orientation in the ground**: randomly rotated blobs, no grid, stripes or visible period; the pattern is re-seeded every trial and wraps round the viewer, so it is never tied to the route (unlike Homing's pebble disc); in the flow-only rungs each element lives about 1 s and fades, so nothing can be tracked from start to end.
5. **No start marker after the start**: a ring under your feet during the 1.2 s lead-in, hidden once you step off it (the route ends at least 5 m away, so it cannot be seen again).
6. **No fix during the route**: no checkpoints, no map, no compass, no counters of distance or turns, no progress bar that maps onto position, and no feedback on any mid-route answer until the route is over.
7. **No fix from the interface**: the dial and the drag-to-turn work only in the body frame (top = straight ahead); nothing points north; turning the view while answering shows nothing that marks a place.
8. **No fix from the clock**: leg speeds vary (from the second speed level on) and the walk-back speed varies per trial, so seconds are not a reliable odometer (Petzschner & Glasauer 2011 varied speed ±60 % for this reason).
9. **No fix from repetition**: every route is new (procedural seeds); the feedback after an answer is a fix only for that finished route, and the next one starts from a new place facing a new direction.
The validator checks what can be checked in data: no scene objects, a texture seed independent of the route, the start hidden from a fixed distance (§6.5).

**(b) The task stays egocentric.**
- First person only during the item; the answer is given in the body frame: "turn from the way you face now", then "walk back". The dial's top is always straight ahead; the drag turns *you*, not a map.
- A "face the way you started" item isolates heading keeping, the egocentric part that visual-only path integration loses (§3.5); its key is −Σ turns.
- Tips favour continuous updating ("keep the start as a direction from you: behind, behind-left, left…") over drawing a map. This is a choice of skill: in Wiener et al. 2011 continuous updating was the faster, online mode and the configural (map) strategy the more accurate one, and continuous instructions led people to an egocentric frame (He & McNamara 2018b).
- A later rung adds mid-route probes ("point to the start now") as in Stangl 2020's four stops, which reward keeping the vector updated as you go; they get no feedback until the end.
- Feedback starts in the body frame (the view turns to face the true start and the flag appears where it is, seen from where you stand); the replay from above then turns so that you face up, as Homing's show me already ends.

**(c) Feedback trains the player to minimise accumulated error.**
- After each answer: the angular error, the distance error (as a share of the way back), and the **drift rate** (end error per distance walked, the navigator's measure of dead-reckoning error), in words and numbers; a replay from above with the true route and the player's believed home vector, and with the probe answers when there were probes, so the player sees where the error grew.
- **The player's own systematic bias**, re-estimated over the last ~20 routes (turn gain and distance gain from a fit of the encoding-error form, §3.1): "Over your last 20 routes you turned about 15 % too little and judged distances about 20 % short." This is what removed the radial bias in the firefly study (Noel 2020).
- **Named qualitative errors** (heading not updated, sides swapped, turned round, path-blind; §6.4), each with a one-line explanation and a show me.
- **A shrinking error budget**: the tolerance dims tighten as the rating rises, like Noel 2020's staircased bull's-eye; the level shows the current budget in words ("within 30°", "within a third of the way back").
- **A drift trend** over weeks (median drift with its range) on the Progress screen, so "minimising accumulated error" is visible as a number that should fall while routes get longer and the flow poorer.
- No feedback during a route (it would be a fix).

**(d) Homing keeps its landmarks as the separate, easier stage before Reckon.**
- Homing stays as it is (plus the phone fixes of I2): landmark-aided homing, where far landmarks act as heading fixes and fade to none at its top level. It trains *using* fixes; Reckon trains working *without* them.
- It is the stage before Reckon, not a level inside it: the beginner order puts Homing first; Reckon's Library card says "Hard at first? Practise Homing, where landmarks help, then come back"; Path mode can sequence Homing → Reckon. Nothing is locked.
- Homing's texts should stop presenting landmarks as part of path integration: call it "Homing · with landmarks" and say that landmarks correct dead-reckoning errors, which is why Reckon has none.

### 8.2 Definition
`id: 'reckon', code: 'EX-12', name: 'Reckon (experimental)', short: 'Reckon', abilities: ['NAV'], cell: 'extrinsic-dynamic', role: 'train', perDisplay: true`, labelled experimental like Homing.
- **Variants:** `point` (turn to face the start; answer 'angle') and `return` (turn, then walk back; a two-number answer). A third item type, `heading` (face the way you started), is used in the tutorial and practice only, so the rating stays one scale.
- **Integration cost:** the return answer needs a new answer type in the registry (for example `'vector'`, response `{ deg, dist }`), the player's response path, the harness's `answer(correct)` and the trial log's `value`; `estMs`; the Library and Daily lists (perDisplay, so out of the Daily); "11 exercises" in docs, the guide and tests; the beginner order; Lab cluster B.
- **Code reuse:** Homing's route model (`lib.route`, `steer`, `drawTarget`, the shortcut checks), its view (stage3d scene, dial, show-me map) and tests are the template; shared pure helpers could move to a common `lib` both exercises read, which is a refactor to plan, not a requirement.

### 8.3 Environment and movement
- First person, eye height 1.6 m, pitch about −10° (more ground in view), fixed horizontal field 70°, unlit. An endless plain with the ground of 8.1(a)4; flat sky; fog horizon.
- **Passive outbound route**: 2–4 straight legs of 4–12 m (total 12–28 m), on-the-spot turns between them; translation 1.8 m/s (steady) or 1.4–2.3 m/s per leg (varied, the route's mean kept near 1.8 m/s), rotation 45°/s; 0.4 s raised-cosine ramps on every start and stop. The longest route (4 legs, large turns) takes about 29 s with the lead-in; a 2-leg route about 13 s (my arithmetic: legs L/v + 0.4 s each, turns T/45 + 0.4 s each, lead-in 1.2 s).
- **Return**: drag or buttons to turn, then hold Walk (1.5 m/s ± 30 % per trial, ramps), Back for small corrections, Here to confirm (§7.1).
- Later rungs (after the first release): curved legs (turning while moving, ≤ 30°/s), mid-route probes, and an active "steer to the remembered spot" variant (firefly type, §2.1).

### 8.4 Dims, difficulty and the ladder
| Dim | Levels | Initial step (logits) | Basis |
|---|---|---|---|
| `route` | Homing's 8 levels (2 legs medium turns … 4 legs large turns), total length bounded | 0.55 per extra leg, 0.4 per turn-size step | Homing's model; Sea Hero Quest turns; §3.6 |
| `flow` | textured blobs → sparse blobs → short-lived dots | 0.35 | Lakshminarasimhan 2018 density effect; Noel 2020 |
| `speed` | steady → varied between legs → varied within legs | 0.3 | Petzschner & Glasauer 2011 (timing) |
| `tolerance` | point 40/30/20°; return τ_p 0.5/0.35/0.25 | 0.9 | §6.2 table (σ ≈ 25°) |
| variant | point → return | +0.5 | two errors must both be small |

- Base −2.25 (as Homing): the easiest item (2 legs, medium turns, textured, steady, 40°, point) gives P ≈ 0.222 + 0.748 · σ(1.85) ≈ 87 % for a beginner at θ = 0 (Homing's target band 87–90 %). Range: −1.85 to 3.25, 5.1 logits (≥ 4 required). All steps are hand-set; the pooled research export should refit them (CLAUDE.md, lessons).
- **Ladder as a learner meets it:** (0) tutorial rungs, not rated: one turn, "face the way you started"; one straight walk, "walk the same distance" with a different speed; one 2-leg route, point. (1) Point, 2 legs, textured, steady, 40°. (2) More legs and larger turns. (3) Return items join (variety). (4) Varied speed. (5) Sparse, then short-lived flow. (6) 4 legs, large turns, 20° / 0.25.
- Generator rules beyond Homing's: |wrap180(Σ turns)| > τ + 2° (heading-not-updated misses); the key at least (τ + 2°)/2 from ahead/behind (mirror misses); answers spread uniformly over the allowed directions (Homing's target steering); home distance 5–20 m; leg speeds drawn so that outbound duration correlates weakly with home distance.

### 8.5 Tutorial (Watch–Try–Go)
- **Goal:** "Watch a walk with nothing to steer by, then point to where you started. Later, walk back to it."
- **Parts:** View (you see through your own eyes); Start ring (only under your feet at the beginning); Ground (it shows that you move, nothing on it marks a place); Turn (drag the view or use the buttons; the top of the circle is the way you face now); Walk (hold to walk back, release to stop).
- **Why no landmarks** (one card, no in-world landmark): "Navigators correct dead-reckoning errors with fixes: a landmark, a star, a satellite. Here there are none, so errors from every turn and every metre add up. The skill is to keep them small." (Wording after Wikipedia's "Dead reckoning", which the player cited.)
- **Demo:** the heading rung, then a 2-leg route with captions; show me draws the route from above leg by leg with a heading needle that turns at each turn (the part people miss), then turns the map so you face up and reads off the answer. The caption must sit over the view or in the pinned bar on phones (I2 §3).
- **Try (not logged):** heading item; distance item; 2-leg point; 2-leg return.
- **Tips (just in time):** "After each turn, say where the start is: behind-left, left…"; "Speeds change now: watch the ground, not the seconds"; "The top of the circle is the way you face now, not the way you started"; "Fewer marks on the ground now: they still slide past at your speed".
- **Strategy cards** (Homing's three, rewritten): continuous ("keep the start as a direction from you"), configural ("picture the shape from above"), when to switch; cite Wiener 2011 for the trade-off.
- **Feedback** as in 8.1(c); **bridge**: "Pilots and sailors learn dead reckoning to stay oriented between fixes. Practising here improves this task; whether it helps finding your way in real places has not been studied, and walking adds body senses that a screen cannot give."

### 8.6 If a new exercise is ruled out
Homing v2 (version bump) with `variants: ['face', 'return']`, the 'return' variant forcing `landmarks: none` and the new environment, a custom difficulty with a variant offset, and the same tests. It works, but one rating then mixes landmark-aided and landmark-free homing, and the Library cannot show the dead-reckoning skill on its own.

<!-- R1-NEXT: section 9 -->
