/* EX-01 Track: 3D multiple-object tracking (pure; ARCHITECTURE.md §4–§6, PLAN.md §2, §3, §5,
   research/B-tasks.md §1 and §14c). Labelled attention practice, not visuospatial training
   (CLAUDE.md rule 10): ability AT (attentional tracking) only, not visual memory; no stereo, no vendor name or units.

   Trial. N identical spheres sit still in a cube while K of them are highlighted (the cue, item.cue
   = 2 s). The highlight goes off, every sphere moves for item.dur seconds, then everything stops and
   the player picks exactly K spheres. Response: the sorted array of picked ids (0 … N − 1). Right
   only if the picks are exactly the targets; value = the number of targets found.

   World. Unit = one cube width. The volume is the cube [−0.5, 0.5]³, y up. Spheres have radius
   R = 0.055, so centres stay in [−LIM, LIM]³ with LIM = 0.445. Every sphere moves in a straight line
   at the item's constant speed (cube widths per second) and bounces elastically: off a wall the
   velocity component flips and the overshoot folds back; off another sphere, when two centres are
   closer than d_min and approaching, each approaching sphere's velocity is mirrored in the plane
   normal to the line of centres. Mirroring keeps the speed, so every sphere always moves at the same
   constant speed, as in 3D-MOT. d_min is one value per sphere count (DMIN): 6 → 0.200, 8 → 0.182,
   10 → 0.169, i.e. 0.2·(6/N)^(1/3): the space the spheres keep free around each other stays the same
   fraction of the cube at every count, and within a level every close encounter stops at the same
   distance. Every d_min is ≥ 2R + 0.059; a pair closes in by at most 2·speed/240 per step (0.033 at
   SPEED_MAX), so even a bounce found one step late leaves a gap and spheres never touch.
   Time step: fixed 240 Hz (1/240 s) from the item's initial state; positions between steps are
   interpolated linearly. positions(t) is a pure function of the item and t: the view samples it by
   elapsed time, so dropped frames never change the path. Only + − × ÷ and sqrt are used (correctly
   rounded in IEEE 754), so an item gives the same positions in every engine.

   Camera (the reference camera of validate; the view must use the same eye, target and up; the field
   of view only scales the picture, so the view may choose it to fit the canvas): the eye is at
   distance CAM_DIST = 2.5 from the centre, elevation atan(0.45) ≈ 24.2° (direction (0, 0.45, 1) at
   azimuth 0), azimuth a in degrees about +y, from +z toward +x (a = 90: eye on +x; increasing a turns
   counter-clockwise seen from above); it looks at the origin with up +y. 'still': the camera stays
   at cam.az, one of 0, 90, 180, 270 (the cube looks the same from each). 'orbit': still during the
   cue, then it turns at cam.rate = 6°/s in direction cam.dir during tracking and stays at the end
   angle for the response: azimuth at tracking time t = cam.az + cam.dir · cam.rate · t (camAz).
   Fit the field of view to the cube's bounding sphere (radius √3/2), so it never changes in an orbit.

   Validity (validate, independent of the generator's bookkeeping): the constants follow from params;
   start centres inside the volume and pairwise ≥ d_min; a full re-simulation that checks every step
   (finite, inside the volume, no two centres closer than 2R), whose end state equals item.end exactly
   and whose target–distractor bounce count equals item.enc; at the cue (camera at cam.az) and at the
   end (end angle) every pair is apart in the image: projected centre distance ≥ 1.25 × the sum of the
   projected radii, where the projected radius is that of the smallest circle around the projected
   centre that holds the sphere's whole perspective image, sin α / (cos β · cos(β + α)) with α the
   sphere's angular radius and β the angle of its centre off the optical axis (so no overlap, no
   occlusion, and room to tap); the K targets are distinct ids in range. generate enforces the same
   rules while it builds (and re-checks the accepted views with validate's projection code), so it
   does not repeat the full re-simulation; validate is the independent audit the tests run on every
   seed.

   Item (JSON; numbers survive JSON exactly):
     { ex: 'track', seed, params, key,       key = sorted target ids; params hold level indices only
       n, k, speed, dur, cue, r, dmin, hz, lim,     speed in cube widths per second; dur, cue in s
       cam: { az, dir, rate, dist, elev },  az in degrees (integer); dir −1 | 0 | +1 (0 = still);
                                            rate in °/s (0 when still); elev = tan of the elevation
       p0: [[x, y, z] × n]   start positions;  d0: [[dx, dy, dz] × n] start directions (sim normalises)
       end: [[x, y, z] × n]  positions at t = dur;  enc: target–distractor bounces during tracking
       speedValue?           the continuous speed when params.speedValue was given (see below)
       fallback?             true for the last-resort construction (never seen in tests) }

   Threshold mode. The speed levels are 0.15 × 10^(i/40) cube widths/s, i = 0 … 45 (0.025 log10
   apart, so one 0.05 log10 staircase step = 2 levels). A continuous speed s maps to the level index
   x = 40 · log10(s / 0.15) (speedLevel; levelSpeed is the inverse). The staircase passes the speed
   in params.speedValue (clamped to [SPEED_MIN, SPEED_MAX]); generate uses it, and item.params gets the
   nearest level index instead, so PX.ex.paramsCode(def, item.params) keeps working. To regenerate
   such an item, add item.speedValue back to item.params. Preset: STANDARD (8 spheres, 4 targets, 8 s,
   2 s cue, still camera, 1-up/1-down in 0.05 log10 steps, 20 trials, threshold = geometric mean of
   the speeds at the last 4 reversals).

   API: PX.ex.track (the same object as PX.ex.get('track').lib):
     sim(item) → simulator { n, steps, dur, k, p, v, at(t, out?) → Float64Array(3n) of positions at
                 tracking time t (clamped to [0, dur]), stepTo(k), step(), reset(), hits }
     positionsAt(item, t) → [[x, y, z] × n]    camAz(item, t)    camera(az) → { eye, target, up }
     project(az, flat, n) → [{ x, y, rad }] in the image plane at focal length 1 (x right, y up)
     speedLevel(s), levelSpeed(x), codeParams(params), standardParams(s), STANDARD, DIFF, constants.
   def.estMs(params): expected trial time in ms (cue + tracking + picks), for session planning.
   Difficulty: see DIFF. */
(function (PX) {
  'use strict';
  // Globals are aliased: in the node test context every global lookup is slow.
  var Mth = Math, sqrt = Mth.sqrt, floor = Mth.floor, round = Mth.round, isArr = Array.isArray;
  var isFin = isFinite, F64 = Float64Array, I32 = Int32Array;

  /* ------------------------------------------------------------ constants */
  var R = 0.055;            // sphere radius (cube widths)
  var LIM = 0.445;          // centres stay in [−LIM, LIM]: 0.5 − R
  var LIM2 = 2 * LIM;
  var HZ = 240, H = 1 / HZ; // fixed time step
  var CUE = 2;              // cue duration (s), every level
  // Speed levels: 0.15 × 10^(0.025 i) cube widths/s, i = 0 … 45, written to 6 significant digits so
  // that every engine has the same numbers (Math.pow may differ in the last bit). With the cube about
  // 10° wide on a phone and 23° on a desktop, 0.15 cw/s is about 1.5–3.5 °/s (a gentle start) and
  // 2.0 cw/s about 20–46 °/s, the top of the 1–40 °/s range in research/B-tasks.md §14c.
  var SPEEDS = [0.15, 0.158888, 0.168303, 0.178275, 0.188839, 0.200028, 0.211881, 0.224435, 0.237734,
    0.251821, 0.266742, 0.282547, 0.299289, 0.317023, 0.335808, 0.355706, 0.376783, 0.399109, 0.422757,
    0.447807, 0.474342, 0.502448, 0.53222, 0.563756, 0.597161, 0.632545, 0.670025, 0.709727, 0.751781,
    0.796327, 0.843512, 0.893493, 0.946436, 1.00252, 1.06192, 1.12484, 1.19149, 1.26209, 1.33688,
    1.41609, 1.5, 1.58888, 1.68303, 1.78275, 1.88839, 2.00028];
  var SPEED0 = 0.15, LEVELS_PER_DECADE = 40;
  // A continuous speed (params.speedValue) is clamped here: 4 cw/s is twice the top level, and up to
  // it a pair closes in by at most 0.033 per step, well inside the 0.059 between d_min and touching.
  var SPEED_MIN = 0.05, SPEED_MAX = 4;
  var TARGETS = [2, 3, 4, 5], SPHERES = [6, 8, 10], TIMES = [5, 8, 12];
  var DMIN = { 6: 0.2, 8: 0.182, 10: 0.169 };
  // Reference camera (see the header).
  var CAM_DIST = 2.5, CAM_ELEV = 0.45, ORBIT_RATE = 6;
  // 6 °/s turns the view 30–72° over a trial: slow next to the spheres (a point on the front face
  // moves about 0.05 cw/s, a third of the slowest sphere speed).
  var SEP = 1.25;                    // image-plane separation factor (validate)
  var SEP_GEN = SEP * (1 + 1e-9);    // the generator keeps a hair more, so no borderline item reaches validate

  /* Difficulty (logits; LLTM-style). All steps are design judgements (no pilot yet), logged per trial
     so pooled data can refit them. b = base + speed·i + targets·(Keff − 2) + spheres·j + time·m + orbit
     - speed 0.12 per level = 4.8 logits per decade of speed: from 90 % to 50 % right takes a 2.9×
       faster speed. The speed axis spans 5.4 of the 8.85 logits (61 %), so it is the main axis.
     - targets 0.6 per target: the speed limit falls steadily with each added target (Holcombe 2023;
       Alvarez & Franconeri 2007); 2 → 5 targets = 1.8 logits = 15 speed levels, a 2.4× slower
       speed. Keff = max(2, min(K, N − K)): errors come from target–distractor confusions, and
       K·(N − K) is the same for K and N − K, so 4 or 5 of 6 and 5 of 8 count as tracking the fewer
       distractors (players can do that; the tutorial should say so). Without this those cells
       would inflate ratings.
     - spheres 0.4 per step (6 → 8 → 10): more distractors and a smaller d_min give more and closer
       target–distractor encounters, which is what errors follow (Franconeri et al. 2010).
     - time 0.35 per step (5 → 8 → 12 s): more encounters per trial, weighted below speed.
     - orbit +0.15: a slow continuous viewpoint change (variants share one rating).
     base −2.5: the easiest item (2 of 6, 5 s, 0.15 cw/s, still; chance 1/15) is 90 % right at θ = 0:
     1/15 + (1 − 1/15 − 0.03)·σ(2.5) = 0.901. Range −2.5 … 6.35 = 8.85 logits. */
  var DIFF = { base: -2.5, speed: 0.12, targets: 0.6, spheres: 0.4, time: 0.35, orbit: 0.15 };

  /* ------------------------------------------------------------ deterministic maths */
  var PI = Mth.PI, D2R = PI / 180, LN10 = 2.302585092994046, LN2 = 0.6931471805599453;

  // sin and cos of an angle in degrees: exact reduction to a quadrant (fmod is exact, and so is
  // d − 90q for d < 360), then Taylor series to x^27 on [0, π/2). Integer degrees reduce exactly.
  function sincosDeg(deg) {
    var d = deg % 360;
    if (d < 0) d += 360;
    var q = floor(d / 90);
    if (q > 3) q = 3;
    var r = d - 90 * q, x = r * D2R, x2 = x * x;
    var s = x, c = 1, ts = x, tc = 1;
    for (var k = 1; k <= 13; k++) {
      ts *= -x2 / ((2 * k) * (2 * k + 1));
      tc *= -x2 / ((2 * k - 1) * (2 * k));
      s += ts;
      c += tc;
    }
    if (q === 0) return [s, c];
    if (q === 1) return [c, -s];
    if (q === 2) return [-s, -c];
    return [-c, s];
  }

  // e^y from + − × ÷ only: y = k·ln 2 + r, |r| ≤ ln 2 / 2, Taylor series, then exact doublings.
  function expD(y) {
    if (!(y === y)) return NaN;
    if (y > 700) return Infinity;
    if (y < -700) return 0;
    var k = round(y / LN2), r = y - k * LN2, term = 1, s = 1;
    for (var i = 1; i <= 24; i++) { term *= r / i; s += term; }
    for (; k > 0; k--) s *= 2;
    for (; k < 0; k++) s /= 2;
    return s;
  }
  function lnD(x) { return PX.rng.ln(x); } // portable natural log (core/rng.js)

  function clamp(x, lo, hi) { return x < lo ? lo : x > hi ? hi : x; }
  function q6(x) { return round(x * 1e6) / 1e6; } // 6 decimals: short JSON, exact round trips
  function comb(n, k) { var r = 1; for (var i = 1; i <= k; i++) r = r * (n - k + i) / i; return round(r); }
  // A level index: integers in range pass; other numbers are rounded and clamped; anything else is 0.
  function lvl(v, n) {
    if (typeof v !== 'number' || !isFin(v)) return 0;
    return clamp(round(v), 0, n - 1);
  }

  /* ------------------------------------------------------------ speed scale */
  function speedLevel(s) { return LEVELS_PER_DECADE * lnD(s / SPEED0) / LN10; }
  function levelSpeed(x) { return SPEED0 * expD(x * LN10 / LEVELS_PER_DECADE); }
  function nearestLevel(s) { return clamp(round(speedLevel(s)), 0, SPEEDS.length - 1); }
  function hasSpeedValue(p) { return !!p && typeof p.speedValue === 'number' && isFin(p.speedValue); }

  // Settings from params (lenient: generate never throws).
  function resolve(params) {
    var p = params || {};
    var ti = lvl(p.targets, TARGETS.length), si = lvl(p.spheres, SPHERES.length), di = lvl(p.time, TIMES.length);
    var variant = p.variant === 'orbit' ? 'orbit' : 'still';
    var vi, speed, over = null;
    if (hasSpeedValue(p)) {
      speed = over = clamp(p.speedValue, SPEED_MIN, SPEED_MAX);
      vi = nearestLevel(speed);
    } else {
      vi = lvl(p.speed, SPEEDS.length);
      speed = SPEEDS[vi];
    }
    var n = SPHERES[si];
    return {
      n: n, k: TARGETS[ti], dur: TIMES[di], speed: speed, variant: variant, dmin: DMIN[n], over: over,
      params: { speed: vi, targets: ti, spheres: si, time: di, variant: variant },
    };
  }

  // Params that PX.ex.paramsCode accepts: level indices and the variant, no speedValue.
  function codeParams(params) { return resolve(params).params; }

  /* ------------------------------------------------------------ camera and projection */
  var CE = 1 / sqrt(1 + CAM_ELEV * CAM_ELEV), SE = CAM_ELEV * CE; // cos and sin of the elevation

  // Orthonormal camera frame at azimuth az (degrees): eye e, forward f (toward the origin),
  // right r = f × up / |f × up| = (cos a, 0, −sin a), up u = r × f = (−sin e · sin a, cos e, −sin e · cos a).
  function camBasis(az) {
    var sc = sincosDeg(az), sa = sc[0], ca = sc[1];
    return {
      ex: CAM_DIST * CE * sa, ey: CAM_DIST * SE, ez: CAM_DIST * CE * ca,
      fx: -CE * sa, fy: -SE, fz: -CE * ca,
      rx: ca, rz: -sa,
      ux: -SE * sa, uy: CE, uz: -SE * ca,
    };
  }

  // Sphere i of the flat positions p seen by camera c: writes [x, y, rad] to out[3i …], the centre
  // in the image plane at focal length 1 and the radius of the smallest circle around it that holds
  // the whole image, sin α / (cos β · cos(β + α)) (the image reaches furthest on the side away from
  // the optical axis).
  function projectOne(c, p, i, out) {
    var i3 = 3 * i;
    var wx = p[i3] - c.ex, wy = p[i3 + 1] - c.ey, wz = p[i3 + 2] - c.ez;
    var z = wx * c.fx + wy * c.fy + wz * c.fz;
    var x = wx * c.rx + wz * c.rz;
    var y = wx * c.ux + wy * c.uy + wz * c.uz;
    var d = sqrt(wx * wx + wy * wy + wz * wz);
    var sa = R / d, ca = sqrt(1 - sa * sa), cb = z / d, sb = sqrt(x * x + y * y) / d;
    out[i3] = x / z;
    out[i3 + 1] = y / z;
    out[i3 + 2] = sa / (cb * (cb * ca - sb * sa));
  }
  function apart(pr, i, j, f) {
    var i3 = 3 * i, j3 = 3 * j;
    var dx = pr[i3] - pr[j3], dy = pr[i3 + 1] - pr[j3 + 1], m = f * (pr[i3 + 2] + pr[j3 + 2]);
    return dx * dx + dy * dy >= m * m;
  }
  // Generator side: are all pairs apart in the view from azimuth az? (validate has its own code.)
  function viewClear(az, p, n, scratch) {
    var c = camBasis(az), i, j;
    for (i = 0; i < n; i++) projectOne(c, p, i, scratch);
    for (i = 0; i < n; i++) for (j = i + 1; j < n; j++) if (!apart(scratch, i, j, SEP_GEN)) return false;
    return true;
  }

  // Public: flat positions → [{ x, y, rad }] in the image plane (focal length 1, x right, y up).
  // Pixels: multiply by (canvas height / 2) / tan(vertical fov / 2) and add the canvas centre.
  function project(az, flat, n) {
    var c = camBasis(az), out = new F64(3 * n), res = [];
    for (var i = 0; i < n; i++) {
      projectOne(c, flat, i, out);
      res.push({ x: out[3 * i], y: out[3 * i + 1], rad: out[3 * i + 2] });
    }
    return res;
  }
  // Eye, target and up of the reference camera at azimuth az (for the view's THREE camera).
  function camera(az) {
    var c = camBasis(az);
    return { eye: [c.ex, c.ey, c.ez], target: [0, 0, 0], up: [0, 1, 0] };
  }
  // Camera azimuth at tracking time t (s): the cue sees t ≤ 0, the response t ≥ dur.
  function camAz(item, t) {
    var cam = item.cam, tt = t > 0 ? (t < item.dur ? t : item.dur) : 0;
    return cam.az + cam.dir * cam.rate * tt;
  }
  function endAz(item) { return item.cam.az + item.cam.dir * item.cam.rate * item.dur; }

  /* ------------------------------------------------------------ physics */
  // new Sim(item): the state after step k (k / 240 s into tracking) is a pure function of the item;
  // at(t) interpolates between steps, stepping forward from the current step or from the start.
  //
  // One step, by definition: every coordinate moves by v·Δt and folds back at the walls (flipping
  // that velocity component); then, for i < j in order, a pair nearer than d_min and closing in has
  // each approaching sphere's velocity mirrored in the plane normal to the line of centres.
  // Speed-up with the same result: a sphere moves at most speed·Δt per step, so a pair found d apart
  // cannot be nearer than d_min for floor((d − d_min) / (2·speed·Δt)) steps; the pair is not looked at
  // until then. Every look that could find it nearer than d_min still happens, in the same order, so
  // the trajectory is bit-for-bit that of checking every pair at every step (tests compare both).
  function Sim(item) {
    var n = item.n, speed = item.speed, i, a;
    var p0 = new F64(3 * n), v0 = new F64(3 * n);
    for (i = 0; i < n; i++) {
      var P = item.p0[i], D = item.d0[i];
      var f = speed / sqrt(D[0] * D[0] + D[1] * D[1] + D[2] * D[2]);
      for (a = 0; a < 3; a++) {
        p0[3 * i + a] = P[a];
        v0[3 * i + a] = D[a] * f;
      }
    }
    this.n = n;
    this.speed = speed;
    this.dmin = item.dmin;
    this.dmin2 = item.dmin * item.dmin;
    // Steps per unit of distance a pair can close in, with a margin far above rounding errors.
    this.inv = 1 / (2 * speed * H * (1 + 1e-9) + 1e-12);
    this.dur = item.dur;
    this.steps = round(item.dur * HZ);
    this.p0 = p0;
    this.v0 = v0;
    this.p = new F64(3 * n);
    this.v = new F64(3 * n);
    this.prev = new F64(3 * n); // positions after step prevK (for interpolation in at)
    this.hits = new I32(n * n); // hits[i·n + j], i < j: bounces of that pair
    this.next = new I32(n * n); // next[i·n + j]: the first step at which the pair is looked at again
    this.rowNext = new I32(n);  // rowNext[i]: the smallest next[i·n + j] over j > i
    this.reset();
  }
  Sim.prototype.reset = function () {
    this.p.set(this.p0);
    this.v.set(this.v0);
    this.k = 0;
    this.prevK = -1;
    this.wall = 0;
    this.pair = 0;
    this.minD2 = Infinity; // smallest squared centre distance seen below d_min (Infinity: none)
    this.hits.fill(0);
    this.next.fill(0);
    this.rowNext.fill(0);
    return this;
  };
  Sim.prototype.step = function () {
    var p = this.p, v = this.v, n = this.n, n3 = 3 * n, a, x, i, j, walls = 0;
    var k1 = this.k + 1;
    for (a = 0; a < n3; a++) {
      x = p[a] + v[a] * H;
      if (x > LIM) { x = LIM2 - x; v[a] = -v[a]; walls++; }
      else if (x < -LIM) { x = -LIM2 - x; v[a] = -v[a]; walls++; }
      p[a] = x;
    }
    var dmin = this.dmin, dmin2 = this.dmin2, inv = this.inv, speed = this.speed;
    var hits = this.hits, next = this.next, rowNext = this.rowNext, minD2 = this.minD2;
    for (i = 0; i < n - 1; i++) {
      if (k1 < rowNext[i]) continue; // no pair (i, j > i) is due
      var i3 = 3 * i, px = p[i3], py = p[i3 + 1], pz = p[i3 + 2], row = i * n, low = 0x7fffffff;
      for (j = i + 1; j < n; j++) {
        var idx = row + j, due = next[idx];
        if (k1 < due) { if (due < low) low = due; continue; }
        var j3 = 3 * j;
        var dx = p[j3] - px, dy = p[j3 + 1] - py, dz = p[j3 + 2] - pz;
        var d2 = dx * dx + dy * dy + dz * dz;
        if (d2 >= dmin2) {
          due = next[idx] = k1 + 1 + floor((sqrt(d2) - dmin) * inv);
          if (due < low) low = due;
          continue;
        }
        next[idx] = low = k1 + 1; // within d_min: look again at the next step
        if (d2 === 0) continue;
        if (d2 < minD2) minD2 = d2;
        var d = sqrt(d2), nx = dx / d, ny = dy / d, nz = dz / d;
        var vi = v[i3] * nx + v[i3 + 1] * ny + v[i3 + 2] * nz;   // i moves toward j when vi > 0
        var vj = v[j3] * nx + v[j3 + 1] * ny + v[j3 + 2] * nz;   // j moves toward i when vj < 0
        if (vi <= vj) continue; // not closing in
        if (vi > 0) reflectV(v, i3, 2 * vi, nx, ny, nz, speed);
        if (vj < 0) reflectV(v, j3, 2 * vj, nx, ny, nz, speed);
        hits[idx]++;
        this.pair++;
      }
      rowNext[i] = low;
    }
    this.minD2 = minD2;
    this.wall += walls;
    this.k = k1;
  };
  // v ← v − w·n̂ (w = 2 v·n̂: the mirror image in the plane normal to n̂), rescaled to the speed.
  function reflectV(v, k, w, nx, ny, nz, speed) {
    var x = v[k] - w * nx, y = v[k + 1] - w * ny, z = v[k + 2] - w * nz;
    var f = speed / sqrt(x * x + y * y + z * z);
    v[k] = x * f;
    v[k + 1] = y * f;
    v[k + 2] = z * f;
  }
  Sim.prototype.stepTo = function (k) {
    k = k < 0 ? 0 : k > this.steps ? this.steps : k;
    if (k < this.k) this.reset();
    while (this.k < k) this.step();
    return this;
  };
  // Positions at tracking time t (s): t ≤ 0 → the start, t ≥ dur → the end, else interpolated
  // between steps floor(240 t) and the next. Calls with growing t (one per frame) step forward only.
  Sim.prototype.at = function (t, out) {
    var n3 = 3 * this.n, a;
    out = out || new F64(n3);
    if (!(t > 0)) {
      for (a = 0; a < n3; a++) out[a] = this.p0[a];
      return out;
    }
    var x = t * HZ, k = floor(x);
    if (k >= this.steps) {
      this.stepTo(this.steps);
      for (a = 0; a < n3; a++) out[a] = this.p[a];
      return out;
    }
    if (!(this.k === k + 1 && this.prevK === k)) {
      if (this.k > k) this.reset();
      while (this.k < k) this.step();
      this.prev.set(this.p);
      this.prevK = k;
      this.step();
    }
    var f = x - k, p = this.p, q = this.prev;
    for (a = 0; a < n3; a++) out[a] = q[a] + (p[a] - q[a]) * f;
    return out;
  };

  function nested(flat, n) {
    var out = [];
    for (var i = 0; i < n; i++) out.push([flat[3 * i], flat[3 * i + 1], flat[3 * i + 2]]);
    return out;
  }
  function flatten(list) {
    var out = new F64(3 * list.length);
    for (var i = 0; i < list.length; i++) for (var a = 0; a < 3; a++) out[3 * i + a] = list[i][a];
    return out;
  }
  function positionsAt(item, t) { return nested(new Sim(item).at(t), item.n); }

  // Bounces between a target and a distractor (close encounters that can swap them).
  function tdBounces(hits, n, key) {
    var isT = {}, s = 0, i, j;
    for (i = 0; i < key.length; i++) isT[key[i]] = true;
    for (i = 0; i < n; i++) for (j = i + 1; j < n; j++) if (!isT[i] !== !isT[j]) s += hits[i * n + j];
    return s;
  }

  /* ------------------------------------------------------------ generator */
  var stats = { attempts: 0, placeFails: 0, overlaps: 0, viewFails: 0, invalid: 0, fallbacks: 0, lastInvalid: null };
  function asc(a, b) { return a - b; }
  function ids(n) { var out = []; for (var i = 0; i < n; i++) out.push(i); return out; }

  // One try. Candidate views: the four face-on azimuths (still) or four start azimuths 90° apart
  // from a random phase (orbit), each also for the world mirrored top to bottom (y → −y). The
  // mirror is exact: negation commutes with every operation of a step (IEEE rounding is symmetric
  // and only squares and products of two mirrored terms meet), so the mirrored start runs the
  // mirrored trajectory bit for bit, and one simulation serves both. Spheres are placed one by one
  // with rejection so the start is apart in every candidate cue view (both mirror states); after
  // the simulation a candidate is drawn among those whose end view (end azimuth, orbit: both
  // directions) is apart too.
  function attempt(r, S) {
    stats.attempts++;
    var n = S.n, orbit = S.variant === 'orbit', d2min = S.dmin * S.dmin, i, j, c, t, m;
    var phi = orbit ? r.int(0, 89) : 0;
    var starts = [phi, phi + 90, phi + 180, phi + 270], nc = starts.length;
    var cams = [], proj = [];
    for (c = 0; c < nc; c++) {
      cams.push(camBasis(starts[c]));
      proj.push(new F64(3 * n), new F64(3 * n)); // proj[2c]: as is, proj[2c + 1]: mirrored
    }
    var pos = new F64(3 * n), mir = new F64(3 * n);
    for (i = 0; i < n; i++) {
      var ok = false;
      // 1000 tries per sphere: the tenth sphere, clear in 8 views, takes about 30 on average (at most
      // a few hundred in tests); a failure only costs this attempt.
      for (t = 0; t < 1000 && !ok; t++) {
        var x = q6(r.float(-LIM, LIM)), y = q6(r.float(-LIM, LIM)), z = q6(r.float(-LIM, LIM));
        ok = true;
        for (j = 0; j < i; j++) {
          var dx = x - pos[3 * j], dy = y - pos[3 * j + 1], dz = z - pos[3 * j + 2];
          if (dx * dx + dy * dy + dz * dz < d2min) { ok = false; break; }
        }
        if (!ok) continue;
        pos[3 * i] = mir[3 * i] = x;
        pos[3 * i + 1] = y;
        mir[3 * i + 1] = -y;
        pos[3 * i + 2] = mir[3 * i + 2] = z;
        for (c = 0; c < 2 * nc && ok; c++) {
          var pr = proj[c];
          projectOne(cams[c >> 1], c & 1 ? mir : pos, i, pr);
          for (j = 0; j < i; j++) if (!apart(pr, i, j, SEP_GEN)) { ok = false; break; }
        }
      }
      if (!ok) { stats.placeFails++; return null; }
    }
    // Directions uniform on the sphere (rejection in the unit ball), rounded to 6 decimals.
    var dirs = [];
    for (i = 0; i < n; i++) {
      var a, b, e, q;
      do {
        a = r.float(-1, 1);
        b = r.float(-1, 1);
        e = r.float(-1, 1);
        q = a * a + b * b + e * e;
      } while (q > 1 || q < 0.01);
      var s = 1 / sqrt(q);
      dirs.push([q6(a * s), q6(b * s), q6(e * s)]);
    }
    var key = r.shuffle(ids(n)).slice(0, S.k).sort(asc);
    var item = {
      ex: 'track', seed: 0, params: S.params, key: key,
      n: n, k: S.k, speed: S.speed, dur: S.dur, cue: CUE, r: R, dmin: S.dmin, hz: HZ, lim: LIM,
      cam: null, p0: nested(pos, n), d0: dirs, end: null, enc: 0,
    };
    var sim = new Sim(item).stepTo(round(S.dur * HZ));
    if (sim.minD2 < 4 * R * R) { stats.overlaps++; return null; } // never seen (see DMIN in the header)
    var end = sim.p, endM = new F64(3 * n), scratch = new F64(3 * n), turn = ORBIT_RATE * S.dur, cands = [];
    for (i = 0; i < 3 * n; i++) endM[i] = i % 3 === 1 ? -end[i] : end[i];
    for (c = 0; c < nc; c++) {
      for (m = 0; m < 2; m++) {
        var P = m ? endM : end;
        if (!orbit) {
          if (viewClear(starts[c], P, n, scratch)) cands.push([starts[c], 0, m]);
        } else {
          if (viewClear(starts[c] + turn, P, n, scratch)) cands.push([starts[c], 1, m]);
          if (viewClear(starts[c] - turn, P, n, scratch)) cands.push([starts[c], -1, m]);
        }
      }
    }
    if (!cands.length) { stats.viewFails++; return null; }
    var pick = cands[r.int(0, cands.length - 1)];
    if (pick[2]) {
      item.p0 = nested(mir, n);
      item.d0 = dirs.map(function (d) { return [d[0], -d[1], d[2]]; });
    }
    item.cam = { az: pick[0], dir: pick[1], rate: orbit ? ORBIT_RATE : 0, dist: CAM_DIST, elev: CAM_ELEV };
    item.end = nested(pick[2] ? endM : end, n);
    item.enc = tdBounces(sim.hits, n, key); // the mirror has the same encounters
    if (S.over !== null) item.speedValue = S.over;
    return item;
  }

  // attempt() already enforces every rule of validate (start spacing, cue and end views, no
  // overlap at any step; the walls fold every position back inside), so generate does not repeat
  // the full re-simulation: it re-checks the accepted item's cue and end views with validate's own
  // camera and projection code, which is cheap. validate (the full audit) runs on every test seed.
  function audited(item) {
    if (!item) return null;
    var n = item.n;
    if (sepRatio(flatten(item.p0), n, item.cam.az).ratio >= SEP && sepRatio(flatten(item.end), n, endAz(item)).ratio >= SEP) return item;
    stats.invalid++;
    stats.lastInvalid = 'views';
    return null;
  }

  // Up to 50 tries (rng, then rng.fork('retry' + i)); at the hardest level one try succeeds about
  // one time in two, so 50 failures are about 1e-15 likely; then the fallback.
  function generate(rng, params) {
    var S = resolve(params), item = null;
    for (var i = 0; i < 50 && !item; i++) item = audited(attempt(i === 0 ? rng : rng.fork('retry' + i), S));
    if (!item) item = fallback(rng.fork('fallback'), S);
    item.seed = rng.seed;
    return item;
  }

  // Last resort, valid by construction: the spheres sit on a 4 × 3 grid (0.22 × 0.3 apart, more than
  // any d_min) in one plane z = z0 and all move along z with the same velocity. They never meet, they
  // all reach the front or back wall together, and the grid is seen from at most 36° off its normal
  // (the orbit is centred on azimuth 0), so the image stays apart at every moment. Trivial to track:
  // item.fallback marks it, and the player should not rate it. Tested for every combination.
  var SLOTS = [];
  [-0.33, -0.11, 0.11, 0.33].forEach(function (sx) {
    [-0.3, 0, 0.3].forEach(function (sy) { SLOTS.push([sx, sy]); });
  });
  function fallback(r, S) {
    stats.fallbacks++;
    var n = S.n, orbit = S.variant === 'orbit', i;
    var slots = r.shuffle(SLOTS).slice(0, n), z0 = q6(r.float(-LIM, LIM)), sz = r.chance(0.5) ? 1 : -1;
    var dir = orbit ? (r.chance(0.5) ? 1 : -1) : 0;
    var az = orbit ? (360 - dir * ORBIT_RATE * S.dur / 2) % 360 : 0;
    var key = r.shuffle(ids(n)).slice(0, S.k).sort(asc), p0 = [], d0 = [];
    for (i = 0; i < n; i++) {
      p0.push([slots[i][0], slots[i][1], z0]);
      d0.push([0, 0, sz]);
    }
    var item = {
      ex: 'track', seed: 0, params: S.params, key: key,
      n: n, k: S.k, speed: S.speed, dur: S.dur, cue: CUE, r: R, dmin: S.dmin, hz: HZ, lim: LIM,
      cam: { az: az, dir: dir, rate: orbit ? ORBIT_RATE : 0, dist: CAM_DIST, elev: CAM_ELEV },
      p0: p0, d0: d0, end: null, enc: 0, fallback: true,
    };
    var sim = new Sim(item).stepTo(round(S.dur * HZ));
    item.end = nested(sim.p, n);
    item.enc = tdBounces(sim.hits, n, key);
    if (S.over !== null) item.speedValue = S.over;
    return item;
  }

  /* ------------------------------------------------------------ validate */
  // The reference camera again, built the way three.js lookAt builds it (zc = eye/|eye|, xc = up × zc
  // normalised, yc = zc × xc), with its own projection: validate does not use the generator's camera.
  function viewFrame(az) {
    var sc = sincosDeg(az), h = 1 / sqrt(1 + CAM_ELEV * CAM_ELEV);
    var ex = CAM_DIST * h * sc[0], ey = CAM_DIST * CAM_ELEV * h, ez = CAM_DIST * h * sc[1];
    var el = sqrt(ex * ex + ey * ey + ez * ez), zx = ex / el, zy = ey / el, zz = ez / el;
    var xl = sqrt(zz * zz + zx * zx), xx = zz / xl, xz = -zx / xl;  // up × zc = (zz, 0, −zx)
    return { e: [ex, ey, ez], x: [xx, 0, xz], y: [zy * xz, zz * xx - zx * xz, -zy * xx], z: [zx, zy, zz] };
  }
  // The smallest image-plane gap between two sphere centres, as a multiple of the sum of their
  // projected radii (clear when ≥ SEP), and the pair that has it.
  function sepRatio(flat, n, az) {
    var F = viewFrame(az), cx = new F64(n), cy = new F64(n), rad = new F64(n), i, j;
    for (i = 0; i < n; i++) {
      var qx = flat[3 * i] - F.e[0], qy = flat[3 * i + 1] - F.e[1], qz = flat[3 * i + 2] - F.e[2];
      var depth = -(qx * F.z[0] + qy * F.z[1] + qz * F.z[2]);
      var dist = sqrt(qx * qx + qy * qy + qz * qz);
      var sinA = R / dist, cosA = sqrt(1 - sinA * sinA), cosB = depth / dist;
      var sinB = sqrt(Mth.max(0, 1 - cosB * cosB)), c = cosB * cosA - sinB * sinA;
      if (!(depth > 0) || !(c > 0)) return { ratio: -Infinity, i: i, j: i }; // not in front of the camera
      cx[i] = (qx * F.x[0] + qy * F.x[1] + qz * F.x[2]) / depth;
      cy[i] = (qx * F.y[0] + qy * F.y[1] + qz * F.y[2]) / depth;
      rad[i] = sinA / (cosB * c);
    }
    var best = Infinity, bi = -1, bj = -1;
    for (i = 0; i < n; i++) {
      for (j = i + 1; j < n; j++) {
        var dx = cx[i] - cx[j], dy = cy[i] - cy[j], ratio = sqrt(dx * dx + dy * dy) / (rad[i] + rad[j]);
        if (ratio < best) { best = ratio; bi = i; bj = j; }
      }
    }
    return { ratio: best, i: bi, j: bj };
  }

  function isNum(x) { return typeof x === 'number' && isFin(x); }
  function isInt(x, lo, hi) { return typeof x === 'number' && x === floor(x) && x >= lo && x <= hi; }
  var PARAM_KEYS = { speed: SPEEDS.length, targets: TARGETS.length, spheres: SPHERES.length, time: TIMES.length };
  var hasOwn = Object.prototype.hasOwnProperty;
  function triples(list, n) {
    if (!isArr(list) || list.length !== n) return false;
    for (var i = 0; i < n; i++) {
      var e = list[i];
      if (!isArr(e) || e.length !== 3 || !isNum(e[0]) || !isNum(e[1]) || !isNum(e[2])) return false;
    }
    return true;
  }

  // Re-simulate and check every step: finite, inside the volume, no two spheres overlapping. A
  // pair found g apart cannot overlap for floor((g − 2R) / (2·speed·Δt)) steps, so it is measured
  // again only then (this schedule is validate's own, not the simulator's). Returns a reason or ''.
  // (A function of its own, so the long loop never strands validate in on-stack-replaced code.)
  function runChecked(sim) {
    var P = sim.p, n = sim.n, n3 = 3 * n, min2 = 4 * R * R, twoR = 2 * R, s, k, i, j;
    var due = new I32(n * n), rowDue = new I32(n), per = 1 / (2 * sim.speed * H * (1 + 1e-9) + 1e-12);
    for (s = 1; s <= sim.steps; s++) {
      sim.step();
      for (k = 0; k < n3; k++) {
        if (!(P[k] >= -LIM && P[k] <= LIM)) return 'trajectory: sphere ' + floor(k / 3) + ' leaves the volume or is not finite at step ' + s;
      }
      for (i = 0; i < n - 1; i++) {
        if (s < rowDue[i]) continue;
        var i3 = 3 * i, low = 0x7fffffff;
        for (j = i + 1; j < n; j++) {
          var ix = i * n + j, dd = due[ix];
          if (s < dd) { if (dd < low) low = dd; continue; }
          var j3 = 3 * j, fx = P[j3] - P[i3], fy = P[j3 + 1] - P[i3 + 1], fz = P[j3 + 2] - P[i3 + 2];
          var g2 = fx * fx + fy * fy + fz * fz;
          if (g2 < min2) return 'trajectory: spheres ' + i + ' and ' + j + ' overlap at step ' + s;
          dd = due[ix] = s + 1 + floor((sqrt(g2) - twoR) * per);
          if (dd < low) low = dd;
        }
        rowDue[i] = low;
      }
    }
    return '';
  }

  function validate(item) {
    if (!item || typeof item !== 'object') return 'item: not an object';
    if (item.ex !== 'track') return 'ex: not "track"';
    var p = item.params, k, i, j;
    if (!p || typeof p !== 'object') return 'params: missing';
    for (k in PARAM_KEYS) if (!isInt(p[k], 0, PARAM_KEYS[k] - 1)) return 'params.' + k + ': not a level index';
    if (p.variant !== 'still' && p.variant !== 'orbit') return 'params.variant: not still or orbit';
    for (k in p) {
      if (hasOwn.call(p, k) && k !== 'variant' && !hasOwn.call(PARAM_KEYS, k)) return 'params.' + k + ': unknown (item.params must suit paramsCode)';
    }
    // Settings and constants re-derived from params.
    var over = item.speedValue !== undefined;
    if (over && !(isNum(item.speedValue) && item.speedValue >= SPEED_MIN && item.speedValue <= SPEED_MAX)) return 'speedValue: not a speed in range';
    var n = SPHERES[p.spheres], kk = TARGETS[p.targets], dur = TIMES[p.time];
    var speed = over ? item.speedValue : SPEEDS[p.speed];
    if (over && nearestLevel(speed) !== p.speed) return 'params.speed: not the level nearest to speedValue';
    if (item.n !== n || item.k !== kk || item.dur !== dur || item.speed !== speed) return 'n, k, dur or speed: do not follow from params';
    if (item.dmin !== DMIN[n] || item.r !== R || item.hz !== HZ || item.lim !== LIM || item.cue !== CUE) return 'dmin, r, hz, lim or cue: not the documented constants';
    var cam = item.cam;
    if (!cam || typeof cam !== 'object' || cam.dist !== CAM_DIST || cam.elev !== CAM_ELEV) return 'cam: not the reference camera';
    if (!isInt(cam.az, 0, 359)) return 'cam.az: not an integer angle in [0, 360)';
    var dirOk = p.variant === 'still' ? cam.dir === 0 && cam.rate === 0 : (cam.dir === 1 || cam.dir === -1) && cam.rate === ORBIT_RATE;
    if (!dirOk) return 'cam: dir or rate does not match the variant';
    if (!triples(item.p0, n) || !triples(item.d0, n) || !triples(item.end, n)) return 'p0, d0 or end: not ' + n + ' finite [x, y, z]';
    var key = item.key;
    if (!isArr(key) || key.length !== kk) return 'key: not ' + kk + ' ids';
    for (i = 0; i < kk; i++) {
      if (!isInt(key[i], 0, n - 1)) return 'key: id out of range';
      if (i > 0 && !(key[i] > key[i - 1])) return 'key: ids not distinct and sorted';
    }
    if (!isInt(item.enc, 0, 1e9)) return 'enc: not a count';
    if (item.fallback !== undefined && item.fallback !== true) return 'fallback: true or absent';
    // Start: inside the volume, pairwise ≥ d_min; directions that normalise.
    var d2min = item.dmin * item.dmin;
    for (i = 0; i < n; i++) {
      var a = item.p0[i], dd = item.d0[i];
      for (k = 0; k < 3; k++) if (!(a[k] >= -LIM && a[k] <= LIM)) return 'p0: sphere ' + i + ' outside the volume';
      if (!(dd[0] * dd[0] + dd[1] * dd[1] + dd[2] * dd[2] >= 0.25)) return 'd0: direction ' + i + ' too short';
      for (j = 0; j < i; j++) {
        var b = item.p0[j], ex = a[0] - b[0], ey = a[1] - b[1], ez = a[2] - b[2];
        if (ex * ex + ey * ey + ez * ez < d2min) return 'p0: spheres ' + j + ' and ' + i + ' start closer than d_min';
      }
    }
    var sim = new Sim(item), P = sim.p, V = sim.v;
    if (sim.steps !== dur * HZ) return 'dur: not a whole number of steps';
    var why = runChecked(sim);
    if (why) return why;
    for (i = 0; i < n; i++) {
      var sp = sqrt(V[3 * i] * V[3 * i] + V[3 * i + 1] * V[3 * i + 1] + V[3 * i + 2] * V[3 * i + 2]);
      if (!(Mth.abs(sp - speed) <= 1e-9 * speed)) return 'trajectory: sphere ' + i + ' does not keep the item speed';
      for (k = 0; k < 3; k++) if (P[3 * i + k] !== item.end[i][k]) return 'end: sphere ' + i + ' differs from the re-simulation';
    }
    if (tdBounces(sim.hits, n, key) !== item.enc) return 'enc: differs from the re-simulation';
    // Cue and end views: every pair apart in the image.
    var cue = sepRatio(flatten(item.p0), n, cam.az);
    if (!(cue.ratio >= SEP)) return 'cue view: spheres ' + cue.i + ' and ' + cue.j + ' are only ' + cue.ratio.toFixed(3) + ' radii apart';
    var fin = sepRatio(P, n, endAz(item));
    if (!(fin.ratio >= SEP)) return 'end view: spheres ' + fin.i + ' and ' + fin.j + ' are only ' + fin.ratio.toFixed(3) + ' radii apart';
    return true;
  }

  /* ------------------------------------------------------------ score, difficulty, chance */
  // Right only for exactly the targets; value = targets found, less any picks beyond K.
  function score(item, response) {
    var key = item.key, n = item.n, isT = {}, seen = {}, picks = [], i;
    for (i = 0; i < key.length; i++) isT[key[i]] = true;
    var list = isArr(response) ? response : [];
    for (i = 0; i < list.length; i++) {
      var id = list[i];
      if (typeof id === 'number' && id === floor(id) && id >= 0 && id < n && !seen[id]) { seen[id] = true; picks.push(id); }
    }
    var found = [], wrong = [], missed = [];
    for (i = 0; i < picks.length; i++) (isT[picks[i]] ? found : wrong).push(picks[i]);
    for (i = 0; i < key.length; i++) if (!seen[key[i]]) missed.push(key[i]);
    found.sort(asc);
    wrong.sort(asc);
    var exact = list.length === key.length && picks.length === key.length && found.length === key.length;
    var value = Mth.max(0, found.length - Mth.max(0, picks.length - key.length));
    return { correct: exact, value: value, detail: { found: found, wrong: wrong, missed: missed } };
  }

  // DIFF (top of the file); a continuous params.speedValue counts at its fractional level index.
  function difficulty(params) {
    var p = params || {};
    var x = hasSpeedValue(p) ? speedLevel(clamp(p.speedValue, SPEED_MIN, SPEED_MAX)) : lvl(p.speed, SPEEDS.length);
    var si = lvl(p.spheres, SPHERES.length), N = SPHERES[si], K = TARGETS[lvl(p.targets, TARGETS.length)];
    var kEff = Mth.max(2, Mth.min(K, N - K));
    return DIFF.base + DIFF.speed * x + DIFF.targets * (kEff - 2) + DIFF.spheres * si +
      DIFF.time * lvl(p.time, TIMES.length) + (p.variant === 'orbit' ? DIFF.orbit : 0);
  }
  // Guessing K of N: one set in C(N, K).
  function chance(params) { var S = resolve(params); return 1 / comb(S.n, S.k); }

  /* ------------------------------------------------------------ Threshold preset */
  // 'Standard' (PLAN.md §5; Legault et al. 2013): 8 spheres, 4 targets, 8 s tracking, 2 s cue, still
  // camera; 1-up/1-down on the all-correct criterion in 0.05 log10 steps (2 levels), 20 trials;
  // threshold = geometric mean of the speeds at the last 4 reversals. The staircase keeps the
  // continuous level index x and generates with standardParams(levelSpeed(x)). It starts at level
  // 12 (0.30 cw/s), below the expected threshold, so the first trials go up.
  var STANDARD = Object.freeze({
    name: 'Standard',
    params: Object.freeze({ speed: 12, targets: 2, spheres: 1, time: 1, variant: 'still' }),
    spheres: 8, targets: 4, dur: 8, cue: CUE, variant: 'still',
    rule: '1-up/1-down', stepLog10: 0.05, stepLevels: 2, trials: 20, reversals: 4, startLevel: 12,
  });
  function standardParams(speed) {
    var s = clamp(isNum(speed) ? speed : SPEEDS[STANDARD.startLevel], SPEED_MIN, SPEED_MAX);
    return { speed: nearestLevel(s), targets: 2, spheres: 1, time: 1, variant: 'still', speedValue: s };
  }

  /* ------------------------------------------------------------ trial time */
  // Expected time from the first frame to the answer (ms) for session planning: the cue, the
  // tracking time and the picks. RESPONSE_MS + PER_TARGET_MS × K is a design guess (finding the
  // numbers and tapping K spheres, then Confirm); the engine adds its own measured extra.
  var RESPONSE_MS = 1500, PER_TARGET_MS = 700;
  function estMs(params) {
    var S = resolve(params);
    return Math.round(1000 * (CUE + S.dur) + RESPONSE_MS + PER_TARGET_MS * S.k);
  }

  /* ------------------------------------------------------------ definition */
  var lib = {
    sim: function (item) { return new Sim(item); }, Sim: Sim, positionsAt: positionsAt,
    camAz: camAz, endAz: endAz, camera: camera, project: project, sepRatio: sepRatio, viewClear: viewClear,
    speedLevel: speedLevel, levelSpeed: levelSpeed, nearestLevel: nearestLevel, codeParams: codeParams,
    standardParams: standardParams, estMs: estMs, resolve: resolve, attempt: attempt, fallback: fallback,
    tdBounces: tdBounces, runChecked: runChecked, sincosDeg: sincosDeg, expD: expD, flatten: flatten, nested: nested,
    STANDARD: STANDARD, DIFF: DIFF, SPEEDS: SPEEDS, TARGETS: TARGETS, SPHERES: SPHERES, TIMES: TIMES,
    DMIN: DMIN, R: R, LIM: LIM, HZ: HZ, CUE: CUE, CAM_DIST: CAM_DIST, CAM_ELEV: CAM_ELEV,
    ORBIT_RATE: ORBIT_RATE, SEP: SEP, SPEED_MIN: SPEED_MIN, SPEED_MAX: SPEED_MAX, stats: stats,
  };

  PX.ex.define({
    id: 'track', version: 1, code: 'EX-01', name: 'Track', short: 'Track',
    practice: 'attention', // shown as attention practice (multiple-object tracking), not visuospatial training
    abilities: ['AT'], cell: null, role: 'train', answer: 'targets', perDisplay: true, extraParams: ['speedValue'],
    dims: [
      { key: 'speed', label: 'Speed', unit: ' cw/s', levels: SPEEDS, step: DIFF.speed }, // cube widths per second
      { key: 'targets', label: 'Targets', levels: TARGETS, step: DIFF.targets },
      { key: 'spheres', label: 'Spheres', levels: SPHERES, step: DIFF.spheres },
      { key: 'time', label: 'Tracking time', unit: 's', levels: TIMES, step: DIFF.time },
    ],
    base: DIFF.base,
    difficulty: difficulty,
    variants: ['still', 'orbit'],
    chance: chance,
    estMs: estMs,
    generate: generate,
    validate: validate,
    score: score,
    lib: lib,
  });
  PX.ex.track = lib;
})(window.PX);
