/* EX-02 Rotate: mental rotation of Shepard–Metzler-style polycubes (pure; ARCHITECTURE.md §5).
   The reference exercise: later exercises copy this file's layout (docs/dev/EXERCISE-GUIDE.md).

   Variants (one rating):
     samediff  two figures; is the right one the left one turned (same) or its mirror image?
               answer yesno (key 1 = same → true, key 2 = mirror → false); chance 0.5
     pick      a reference and 4 options: 2 turned copies and 2 turned mirror images; pick the
               two copies. answer multi, nCorrect 2, right only if exactly the two copies are
               picked; chance 1/6. Always 2 + 2, so there is no odd one out.
   The variants answer differently (ARCHITECTURE §6): the definition's main answer is 'multi'
   (pick) with answers: { samediff: 'yesno', pick: 'multi' }; items carry answer, nOptions and
   nCorrect, and players use item.answer || def.answer.

   Model (shared with view.js and the tests through def.lib):
   - A figure is 4 straight arms on the cube lattice joined by 90° turns, spanning all three
     dimensions, none longer than half the steps; no cube touches a non-neighbouring cube face
     to face. In every shown picture each arm keeps ≥ 50 % of its length (no end-on arms) and
     the two arms at every bend are ≥ 40° from parallel (no L seen edge-on). It must be chiral (its
     mirror image is none of its 24 rotations) and have no rotational symmetry (so the turning
     angle is well defined; research/B-tasks.md §2 pitfalls 1–2).
   - World frame = camera frame: x right, y up, z towards the viewer; the camera looks down −z
     from (0, 0, D) with a 30° field of view. The reference is shown "from slightly above",
     like the classic drawings: a lattice rotation L, turned 30 or 40° about the vertical and
     tilted 25–35° towards the viewer (Q0 = Rx(el) Ry(az) L).
   - Turning axes: vertical = the scene's vertical seen from the pose's elevation (a turntable:
     upright arms stay upright), horizontal (1,0,0), picture (0,0,1, the line of sight),
     oblique (random, ≥ 0.3 on every camera axis). Vertical and horizontal candidates may be
     tilted by 5–10° (wobble) so compact figures still get four distinct, readable options.
   - A turned copy is shown at R·Q0. A mirror option is the camera-frame mirror image of a
     turned copy: S·R·Q0 with S = diag(−1, 1, 1), stored as the reflected cells at the proper
     rotation S·R·Q0·P. Its picture is the left–right flip of a correct picture, so silhouette
     area, visible cubes and bounding-box shape cannot tell copies from mirrors (rule 9). The
     reflection P (with its shift) is the one that keeps the most cubes in place, usually all
     but one end arm: turning the reference to the mirror's orientation then shows "the arm
     that points the other way" (item.diff), which is what show-me highlights.
   - Framing (view.js, lib.outline / lib.frameTan): pictures that are compared share one scale
     (the four options; samediff's two figures), each centred on its outline box, the largest
     filling 92 % of its frame (the stage below its labels); show-me keeps one frame for a whole
     turn. Zoom 1–3 only scales and shifts the validator's picture.
   - pick: the 4 rotations are distinct, their angles lie in A − 20 … A + 20 (shifted inwards
     at the ends of the range), so every option is within 40° of the others; which two become
     the copies is random, so the angle gives no clue.

   Item: { ex, v, seed, params, variant, answer, nOptions, nCorrect?, angle, axis, n, radius,
           shapes: [cells, mirrorCells], diff: [refIdx[], mirrorIdx[]],
           ref: { s, q }, figs: [{ s, q, deg, ax }], key, fallback? }
     cells are integer [x, y, z] in path order; q is a unit quaternion [x, y, z, w] (THREE order);
     s indexes shapes; deg/ax: the turn applied to the reference (for mirrors, before the flip). */
(function (PX) {
  'use strict';

  /* ---------- constants (literals keep every engine bit-identical; no Math.sin at runtime) ---------- */

  // [sin, cos] of k·10°, k = 0..18.
  var TRIG10 = [[0, 1], [0.17364817766693033, 0.984807753012208], [0.3420201433256687, 0.9396926207859084],
    [0.49999999999999994, 0.8660254037844387], [0.6427876096865393, 0.766044443118978],
    [0.766044443118978, 0.6427876096865394], [0.8660254037844386, 0.5000000000000001],
    [0.9396926207859083, 0.3420201433256688], [0.984807753012208, 0.17364817766693041], [1, 0],
    [0.984807753012208, -0.1736481776669303], [0.9396926207859084, -0.3420201433256687],
    [0.8660254037844387, -0.4999999999999998], [0.766044443118978, -0.6427876096865394],
    [0.6427876096865395, -0.7660444431189779], [0.49999999999999994, -0.8660254037844387],
    [0.3420201433256689, -0.9396926207859083], [0.17364817766693028, -0.984807753012208], [0, -1]];
  // Reference poses are seen from slightly above (elevation 25, 30 or 35°) and from the side
  // (azimuth ±30 or ±40°): [sin, cos]. The variety keeps turns about the vertical and the
  // horizontal axis from sweeping a lattice arm through the line of sight at fixed angles; at
  // 30° and more a turntable turn never foreshortens a level arm below half its length.
  var ELS = [[0.42261826174069944, 0.9063077870366499], [0.49999999999999994, 0.8660254037844387], [0.573576436351046, 0.8191520442889918]];
  var AZS = [[0.49999999999999994, 0.8660254037844387], [0.6427876096865393, 0.766044443118978],
    [-0.49999999999999994, 0.8660254037844387], [-0.6427876096865393, 0.766044443118978]];
  var FOV = 30;                                         // degrees, vertical (view.js uses the same)
  var TAN_HALF = 0.2679491924311227;                    // tan 15°
  var SIN_HALF = 0.25881904510252074;                   // sin 15°
  var MARGIN = 1.06;                                    // the bounding sphere fills 94 % of the frame
  var FILL = 0.92;                                      // framing: the largest picture of a frame
  var ZOOM_MAX = 3;                                     // fills 92 % of it, zoom ≤ 3

  // Visibility and similarity rules, measured in a 96 × 96 software z-buffer of the cube faces.
  var RASTER = 96;
  var MIN_PX = 12;        // every cube shows at least this many pixels …
  var MIN_FRAC = 0.10;    // … and at least 10 % of its own unoccluded picture
  var END_FRAC = 0.30;    // the two end cubes (they carry the handedness) show ≥ 30 %
  var ARM_MIN = 0.5;      // every arm keeps ≥ 50 % of its length on screen (Shepard & Metzler
                          // avoided strongly foreshortened arms); measured centre to centre
  var BEND_COS = 0.766;   // at every bend the two arms’ pictures are ≥ 40° from parallel (an
                          // L seen edge-on collapses into one bar and its depth is ambiguous)
  var SIMILAR = 0.35;     // pictures closer than this (cube units, 2D Hausdorff) count as the same

  var ANGLES = [20, 40, 60, 80, 100, 120, 140, 160, 180];
  var AXES = ['vertical', 'horizontal', 'picture', 'oblique'];
  var CUBES = [6, 8, 10, 12];
  var VARIANTS = ['samediff', 'pick'];

  /* ---------- 3 × 3 matrices, row-major, column vectors (v' = M v) ---------- */

  function mul(a, b) {
    var o = new Array(9);
    for (var r = 0; r < 3; r++) {
      for (var c = 0; c < 3; c++) o[r * 3 + c] = a[r * 3] * b[c] + a[r * 3 + 1] * b[3 + c] + a[r * 3 + 2] * b[6 + c];
    }
    return o;
  }
  function mulv(m, v) {
    return [m[0] * v[0] + m[1] * v[1] + m[2] * v[2], m[3] * v[0] + m[4] * v[1] + m[5] * v[2], m[6] * v[0] + m[7] * v[1] + m[8] * v[2]];
  }
  function det(m) {
    return m[0] * (m[4] * m[8] - m[5] * m[7]) - m[1] * (m[3] * m[8] - m[5] * m[6]) + m[2] * (m[3] * m[7] - m[4] * m[6]);
  }
  function trace(m) { return m[0] + m[4] + m[8]; }
  function transpose(m) { return [m[0], m[3], m[6], m[1], m[4], m[7], m[2], m[5], m[8]]; }
  var S_FLIP = [-1, 0, 0, 0, 1, 0, 0, 0, 1];            // camera-frame left–right mirror

  function trig(deg) {                                  // deg: a multiple of 10 in [−180, 180]
    var k = Math.round(Math.abs(deg) / 10), t = TRIG10[k];
    return deg < 0 ? [-t[0], t[1]] : t;
  }

  // Rodrigues: rotation by deg about the unit axis u.
  function rotAxis(u, deg) {
    var t = trig(deg), s = t[0], c = t[1], k = 1 - c, x = u[0], y = u[1], z = u[2];
    return [c + k * x * x, k * x * y - s * z, k * x * z + s * y,
      k * x * y + s * z, c + k * y * y, k * y * z - s * x,
      k * x * z - s * y, k * y * z + s * x, c + k * z * z];
  }
  function rx(st) { return [1, 0, 0, 0, st[1], -st[0], 0, st[0], st[1]]; }
  function ry(st) { return [st[1], 0, st[0], 0, 1, 0, -st[0], 0, st[1]]; }

  // Rotation matrix → unit quaternion [x, y, z, w] with w ≥ 0 (Shepperd's method; sqrt only).
  function toQuat(m) {
    var tr = m[0] + m[4] + m[8], x, y, z, w, s;
    if (tr > 0) {
      s = Math.sqrt(tr + 1) * 2; w = s / 4; x = (m[7] - m[5]) / s; y = (m[2] - m[6]) / s; z = (m[3] - m[1]) / s;
    } else if (m[0] > m[4] && m[0] > m[8]) {
      s = Math.sqrt(1 + m[0] - m[4] - m[8]) * 2; w = (m[7] - m[5]) / s; x = s / 4; y = (m[1] + m[3]) / s; z = (m[2] + m[6]) / s;
    } else if (m[4] > m[8]) {
      s = Math.sqrt(1 + m[4] - m[0] - m[8]) * 2; w = (m[2] - m[6]) / s; x = (m[1] + m[3]) / s; y = s / 4; z = (m[5] + m[7]) / s;
    } else {
      s = Math.sqrt(1 + m[8] - m[0] - m[4]) * 2; w = (m[3] - m[1]) / s; x = (m[2] + m[6]) / s; y = (m[5] + m[7]) / s; z = s / 4;
    }
    var l = Math.sqrt(x * x + y * y + z * z + w * w);
    if (w < 0) l = -l;
    return [x / l, y / l, z / l, w / l];
  }

  // Unit quaternion → rotation matrix (normalises first; same convention as THREE).
  function fromQuat(q) {
    var l = Math.sqrt(q[0] * q[0] + q[1] * q[1] + q[2] * q[2] + q[3] * q[3]) || 1;
    var x = q[0] / l, y = q[1] / l, z = q[2] / l, w = q[3] / l;
    return [1 - 2 * (y * y + z * z), 2 * (x * y - z * w), 2 * (x * z + y * w),
      2 * (x * y + z * w), 1 - 2 * (x * x + z * z), 2 * (y * z - x * w),
      2 * (x * z - y * w), 2 * (y * z + x * w), 1 - 2 * (x * x + y * y)];
  }

  /* ---------- the cube lattice: 24 rotations, canonical forms ---------- */

  var ROT24 = [], IMP24 = [];
  (function () {
    var perms = [[0, 1, 2], [0, 2, 1], [1, 0, 2], [1, 2, 0], [2, 0, 1], [2, 1, 0]];
    perms.forEach(function (p) {
      for (var sg = 0; sg < 8; sg++) {
        var m = [0, 0, 0, 0, 0, 0, 0, 0, 0];
        for (var r = 0; r < 3; r++) m[r * 3 + p[r]] = (sg >> r) & 1 ? -1 : 1;
        (det(m) > 0 ? ROT24 : IMP24).push(m);
      }
    });
  })();

  function apply(m, cells) {
    var out = new Array(cells.length);
    for (var i = 0; i < cells.length; i++) out[i] = mulv(m, cells[i]);
    return out;
  }

  // Translation-free, order-free key of the cells turned by the lattice matrix m (m = null: as
  // they are; flip = true: mirrored in x first). Typed-array sort, no per-cell allocation.
  var KX = new Int32Array(64), KY = new Int32Array(64), KZ = new Int32Array(64);
  function keyRot(m, cells, flip) {
    var n = cells.length, mx = Infinity, my = Infinity, mz = Infinity, i;
    for (i = 0; i < n; i++) {
      var x = flip ? -cells[i][0] : cells[i][0], y = cells[i][1], z = cells[i][2];
      var a = m ? m[0] * x + m[1] * y + m[2] * z : x, b = m ? m[3] * x + m[4] * y + m[5] * z : y, c = m ? m[6] * x + m[7] * y + m[8] * z : z;
      KX[i] = a; KY[i] = b; KZ[i] = c;
      if (a < mx) mx = a; if (b < my) my = b; if (c < mz) mz = c;
    }
    var codes = new Int32Array(n);
    for (i = 0; i < n; i++) codes[i] = ((KX[i] - mx) * 64 + (KY[i] - my)) * 64 + (KZ[i] - mz);
    codes.sort();
    return codes.join(',');
  }

  // Lattice facts in one pass of 48 keys: canonical key under the 24 rotations (equal keys ⇔
  // congruent by a rotation), the mirror image's canonical key, and the number of rotations
  // that map the figure onto itself (1 = no symmetry).
  function lattice(cells) {
    var k0 = keyRot(null, cells, false), best = null, bestM = null, sym = 0;
    for (var i = 0; i < 24; i++) {
      var k = keyRot(ROT24[i], cells, false), km = keyRot(ROT24[i], cells, true);
      if (k === k0) sym++;
      if (best === null || k < best) best = k;
      if (bestM === null || km < bestM) bestM = km;
    }
    return { canon: best, mirror: bestM, sym: sym };
  }
  function canon(cells) { return lattice(cells).canon; }
  function mirrorX(cells) { return cells.map(function (c) { return [-c[0], c[1], c[2]]; }); }
  function chiral(cells) { var l = lattice(cells); return l.canon !== l.mirror; }
  function symmetries(cells) { return lattice(cells).sym; }

  /* ---------- figures: 4 arms on the lattice ---------- */

  var DIRS = [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]];
  // Why attempts fail (diagnostics for the tests; never read by the generator).
  var STATS = { shapeRule: 0, shapeSym: 0, noShape: 0, noPose: 0, noTurns: 0, similar: 0, similarLate: 0, built: 0 };
  function code(c) { return ((c[0] + 64) * 128 + (c[1] + 64)) * 128 + (c[2] + 64); }

  // Arms of a path: [{ from, to, dir }] (cell indices; consecutive arms share the bend cube).
  function arms(cells) {
    var out = [], from = 0, dir = null;
    for (var i = 1; i < cells.length; i++) {
      var d = [cells[i][0] - cells[i - 1][0], cells[i][1] - cells[i - 1][1], cells[i][2] - cells[i - 1][2]];
      if (dir && (d[0] !== dir[0] || d[1] !== dir[1] || d[2] !== dir[2])) {
        out.push({ from: from, to: i - 1, dir: dir });
        from = i - 1;
      }
      dir = d;
    }
    if (dir) out.push({ from: from, to: cells.length - 1, dir: dir });
    return out;
  }

  // Structure rules, checked from the cells alone (validate uses this).
  function checkShape(cells, n) {
    if (!Array.isArray(cells) || cells.length !== n) return 'figure has ' + (cells && cells.length) + ' cubes, expected ' + n;
    var seen = {}, i, j;
    for (i = 0; i < cells.length; i++) {
      var c = cells[i];
      if (!Array.isArray(c) || c.length !== 3 || !c.every(function (x) { return Number.isInteger(x) && Math.abs(x) < 60; })) return 'cube ' + i + ' is not an integer lattice cell';
      if (seen[code(c)]) return 'cube ' + i + ' repeats a cell';
      seen[code(c)] = true;
    }
    for (i = 1; i < cells.length; i++) {
      var dd = Math.abs(cells[i][0] - cells[i - 1][0]) + Math.abs(cells[i][1] - cells[i - 1][1]) + Math.abs(cells[i][2] - cells[i - 1][2]);
      if (dd !== 1) return 'cubes ' + (i - 1) + ' and ' + i + ' are not face to face';
    }
    for (i = 0; i < cells.length; i++) {
      for (j = i + 2; j < cells.length; j++) {
        var m = Math.abs(cells[i][0] - cells[j][0]) + Math.abs(cells[i][1] - cells[j][1]) + Math.abs(cells[i][2] - cells[j][2]);
        if (m < 2) return 'cubes ' + i + ' and ' + j + ' touch face to face but are not neighbours';
      }
    }
    var A = arms(cells), used = [0, 0, 0], longest = maxArm(n);
    if (A.length !== 4) return 'figure has ' + A.length + ' arms, expected 4';
    for (i = 0; i < 4; i++) {
      if (A[i].to - A[i].from > longest) return 'arm ' + i + ' is longer than half the figure (' + (A[i].to - A[i].from) + ' steps)';
      used[A[i].dir[0] ? 0 : A[i].dir[1] ? 1 : 2] = 1;
      if (i && A[i].dir[0] * A[i - 1].dir[0] + A[i].dir[1] * A[i - 1].dir[1] + A[i].dir[2] * A[i - 1].dir[2] !== 0) return 'arms ' + (i - 1) + ' and ' + i + ' do not meet at 90°';
    }
    if (used[0] + used[1] + used[2] !== 3) return 'figure is flat (does not span three dimensions)';
    return true;
  }

  // No arm longer than half the steps: balanced figures like the classic ones, instead of one
  // long bar with stubs (thin figures read badly and leave the frame mostly empty).
  function maxArm(n) { return Math.floor((n - 1) / 2); }
  var COMPS = {};
  function compositions(n) {
    if (COMPS[n]) return COMPS[n];
    var steps = n - 1, hi = maxArm(n), out = [];
    for (var a = 1; a <= hi; a++) for (var b = 1; b <= hi; b++) for (var c = 1; c <= hi; c++) {
      var d = steps - a - b - c;
      if (d >= 1 && d <= hi) out.push([a, b, c, d]);
    }
    return (COMPS[n] = out);
  }

  // A random 4-arm walk with n cubes that passes every rule, or null.
  function makeShape(rng, n) {
    for (var attempt = 0; attempt < 60; attempt++) {
      // arm lengths: a random composition of n − 1 steps into 4 parts of 1 … (n − 1)/2 steps
      var lens = rng.pick(compositions(n));
      var dirs = [rng.int(0, 5)];
      for (var k = 1; k < 4; k++) {
        var prevAxis = dirs[k - 1] >> 1, choices = [];
        for (var d = 0; d < 6; d++) if ((d >> 1) !== prevAxis) choices.push(d);
        dirs.push(rng.pick(choices));
      }
      var cells = [[0, 0, 0]], p = [0, 0, 0];
      for (k = 0; k < 4; k++) {
        for (var s = 0; s < lens[k]; s++) {
          p = [p[0] + DIRS[dirs[k]][0], p[1] + DIRS[dirs[k]][1], p[2] + DIRS[dirs[k]][2]];
          cells.push(p);
        }
      }
      if (checkShape(cells, n) !== true) { STATS.shapeRule++; continue; }
      var lat = lattice(cells);
      if (lat.canon === lat.mirror || lat.sym !== 1) { STATS.shapeSym++; continue; }
      return cells;
    }
    return null;
  }
  function range(a, b) { var o = []; for (var i = a; i <= b; i++) o.push(i); return o; }

  // The mirror image that keeps the most cubes of the figure in place: an improper lattice
  // isometry P·c + t. Usually all but one end arm stay, so after turning the reference to the
  // mirror's orientation exactly that arm differs (item.diff). Ties: an end arm, then order.
  var HIST = null, HW = 49, HO = 24; // translation histogram, components in [−24, 24]
  function bestReflection(cells) {
    var n = cells.length, here = {}, best = null, i, j;
    if (!HIST) HIST = new Uint8Array(HW * HW * HW);
    for (i = 0; i < n; i++) here[code(cells[i])] = true;
    var touched = new Int32Array(n * n);
    for (var k = 0; k < 24; k++) {
      var P = IMP24[k], pc = apply(P, cells), top = 0, tBest = null, nt = 0;
      for (i = 0; i < n; i++) {
        for (j = 0; j < n; j++) {
          var tx = cells[i][0] - pc[j][0], ty = cells[i][1] - pc[j][1], tz = cells[i][2] - pc[j][2];
          var ix = ((tx + HO) * HW + (ty + HO)) * HW + (tz + HO);
          if (!HIST[ix]) touched[nt++] = ix;
          var c = ++HIST[ix];
          if (c > top) { top = c; tBest = [tx, ty, tz]; }
        }
      }
      for (i = 0; i < nt; i++) HIST[touched[i]] = 0;
      if (best && top * 2 + 1 < best.score) continue; // cannot win
      var moved = pc.map(function (v) { return [v[0] + tBest[0], v[1] + tBest[1], v[2] + tBest[2]]; });
      var there = {};
      moved.forEach(function (v) { there[code(v)] = true; });
      var dRef = [], dMir = [];
      for (i = 0; i < n; i++) {
        if (!there[code(cells[i])]) dRef.push(i);
        if (!here[code(moved[i])]) dMir.push(i);
      }
      var endArm = dRef.length > 0 && (dRef[0] === 0 || dRef[dRef.length - 1] === n - 1) &&
        dRef[dRef.length - 1] - dRef[0] === dRef.length - 1;
      var score = top * 2 + (endArm ? 1 : 0);
      if (!best || score > best.score) best = { score: score, P: P, t: tBest, cells: moved, diff: [dRef, dMir] };
    }
    return best;
  }

  /* ---------- camera and a software z-buffer of the cube faces ---------- */

  function centroid(cells) {
    var c = [0, 0, 0];
    for (var i = 0; i < cells.length; i++) { c[0] += cells[i][0]; c[1] += cells[i][1]; c[2] += cells[i][2]; }
    return [c[0] / cells.length, c[1] / cells.length, c[2] / cells.length];
  }
  // Bounding sphere of every cube corner about the centroid (the same for a mirror image).
  function radiusOf(cells) {
    var c = centroid(cells), r = 0;
    for (var i = 0; i < cells.length; i++) {
      var dx = cells[i][0] - c[0], dy = cells[i][1] - c[1], dz = cells[i][2] - c[2];
      r = Math.max(r, Math.sqrt(dx * dx + dy * dy + dz * dz));
    }
    return r + 0.8660254037844386;
  }
  // Camera distance so the bounding sphere fills a square frame (view.js widens it for tall tiles).
  function distance(radius) { return radius * MARGIN / SIN_HALF; }

  // Cube centres in the world: rotated by m about the centroid.
  function world(cells, m) {
    var c = centroid(cells);
    return cells.map(function (v) { return mulv(m, [v[0] - c[0], v[1] - c[1], v[2] - c[2]]); });
  }

  var ZB = null, IDB = null;
  var EA = [0, 0, 0, 0], EB = [0, 0, 0, 0], EC = [0, 0, 0, 0];
  // Fills one convex face (4 projected corners) with incremental edge functions; 1/depth is an
  // affine function of the screen position over a planar face, so it steps incrementally too.
  function quad(qx, qy, qw, id, size) {
    var A = 0, k;
    for (k = 0; k < 4; k++) A += qx[k] * qy[(k + 1) & 3] - qx[(k + 1) & 3] * qy[k];
    if (A > -1e-6 && A < 1e-6) return; // seen edge-on
    var sg = A > 0 ? 1 : -1;
    var d = (qx[1] - qx[0]) * (qy[2] - qy[0]) - (qx[2] - qx[0]) * (qy[1] - qy[0]);
    if (d > -1e-9 && d < 1e-9) return;
    var wx = ((qw[1] - qw[0]) * (qy[2] - qy[0]) - (qw[2] - qw[0]) * (qy[1] - qy[0])) / d;
    var wy = ((qx[1] - qx[0]) * (qw[2] - qw[0]) - (qx[2] - qx[0]) * (qw[1] - qw[0])) / d;
    var w0 = qw[0] - wx * qx[0] - wy * qy[0];
    var minX = size, maxX = -1, minY = size, maxY = -1;
    for (k = 0; k < 4; k++) {
      var j = (k + 1) & 3, ex = qx[j] - qx[k], ey = qy[j] - qy[k];
      EA[k] = sg * (ey * qx[k] - ex * qy[k]); EB[k] = -sg * ey; EC[k] = sg * ex;
      if (qx[k] < minX) minX = qx[k]; if (qx[k] > maxX) maxX = qx[k];
      if (qy[k] < minY) minY = qy[k]; if (qy[k] > maxY) maxY = qy[k];
    }
    minX = Math.max(0, Math.floor(minX)); maxX = Math.min(size - 1, Math.ceil(maxX));
    minY = Math.max(0, Math.floor(minY)); maxY = Math.min(size - 1, Math.ceil(maxY));
    // Per row, the span of pixel centres inside all four edges (e = a + b·sx ≥ 0), then a
    // depth test along the span only.
    for (let py = minY; py <= maxY; py++) {
      const sy = py + 0.5;
      let lo = minX, hi = maxX;
      for (let e = 0; e < 4 && lo <= hi; e++) {
        const a = EA[e] + EC[e] * sy, b = EB[e];
        if (b > 1e-12) { const x = Math.ceil(-a / b - 0.5); if (x > lo) lo = x; } else if (b < -1e-12) { const x = Math.floor(-a / b - 0.5); if (x < hi) hi = x; } else if (a < 0) hi = lo - 1;
      }
      if (lo > hi) continue;
      let w = w0 + wx * (lo + 0.5) + wy * sy, ix = py * size + lo;
      for (let px = lo; px <= hi; px++, ix++, w += wx) if (w > ZB[ix]) { ZB[ix] = w; IDB[ix] = id; }
    }
  }

  // Renders the visible faces of every cube (figure cells at rotation m, perspective camera of
  // the view) into a size × size id buffer. Returns per-cube visible pixels (counts), each
  // cube's own unoccluded picture area (solo), the silhouette area, its bounding box, the cube
  // centres on screen (c2) and the pixels per cube unit at the figure's centre (unit).
  function raster(cells, m, radius, size) {
    size = size || RASTER;
    if (!ZB || ZB.length !== size * size) { ZB = new Float64Array(size * size); IDB = new Int16Array(size * size); }
    ZB.fill(0); IDB.fill(-1);
    var D = distance(radius), F = size / 2 / TAN_HALF, h = size / 2, n = cells.length;
    var P = world(cells, m);
    var ax = [[m[0], m[3], m[6]], [m[1], m[4], m[7]], [m[2], m[5], m[8]]];
    var counts = new Int32Array(n), solo = new Float64Array(n), c2 = new Array(n);
    var qx = [0, 0, 0, 0], qy = [0, 0, 0, 0], qw = [0, 0, 0, 0];
    var SG = [[1, 1], [1, -1], [-1, -1], [-1, 1]];
    for (var i = 0; i < n; i++) {
      var p = P[i], dc = D - p[2];
      c2[i] = [h + F * p[0] / dc, h - F * p[1] / dc];
      for (var a = 0; a < 3; a++) {
        var b = ax[(a + 1) % 3], c = ax[(a + 2) % 3];
        for (var s = -1; s <= 1; s += 2) {
          var nx = s * ax[a][0], ny = s * ax[a][1], nz = s * ax[a][2];
          var fx = p[0] + 0.5 * nx, fy = p[1] + 0.5 * ny, fz = p[2] + 0.5 * nz;
          if (nx * -fx + ny * -fy + nz * (D - fz) <= 0) continue; // faces away from the camera
          for (var k = 0; k < 4; k++) {
            var X = fx + 0.5 * (SG[k][0] * b[0] + SG[k][1] * c[0]);
            var Y = fy + 0.5 * (SG[k][0] * b[1] + SG[k][1] * c[1]);
            var Z = fz + 0.5 * (SG[k][0] * b[2] + SG[k][1] * c[2]);
            var d = D - Z;
            qx[k] = h + F * X / d; qy[k] = h - F * Y / d; qw[k] = 1 / d;
          }
          solo[i] += Math.abs((qx[0] * qy[1] - qx[1] * qy[0]) + (qx[1] * qy[2] - qx[2] * qy[1]) +
            (qx[2] * qy[3] - qx[3] * qy[2]) + (qx[3] * qy[0] - qx[0] * qy[3])) / 2;
          quad(qx, qy, qw, i, size);
        }
      }
    }
    var areaPx = 0, x0 = size, y0 = size, x1 = -1, y1 = -1;
    for (var y = 0; y < size; y++) {
      for (var x = 0; x < size; x++) {
        var id = IDB[y * size + x];
        if (id < 0) continue;
        counts[id]++; areaPx++;
        if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y;
      }
    }
    return { counts: counts, solo: solo, area: areaPx, bbox: x1 < 0 ? null : [x0, y0, x1, y1], c2: c2, unit: F / D, D: D, world: P };
  }

  // Cube centres on screen and the scale, without rasterising (enough for picDistance).
  function project(cells, m, radius, size) {
    size = size || RASTER;
    var D = distance(radius), F = size / 2 / TAN_HALF, h = size / 2, P = world(cells, m);
    return { c2: P.map(function (p) { var d = D - p[2]; return [h + F * p[0] / d, h - F * p[1] / d]; }), unit: F / D, D: D };
  }

  // Projected length of each arm (centre of its first cube to centre of its last, perspective)
  // as a share of the length it would have across the line of sight at the same depth;
  // armShares(…, dirs) also fills dirs with each arm's direction on screen.
  function armShares(cells, m, radius, dirs) {
    var A = arms(cells), cen = centroid(cells), D = distance(radius), out = [];
    for (var i = 0; i < A.length; i++) {
      var a0 = cells[A[i].from], a1 = cells[A[i].to];
      var p0 = mulv(m, [a0[0] - cen[0], a0[1] - cen[1], a0[2] - cen[2]]);
      var p1 = mulv(m, [a1[0] - cen[0], a1[1] - cen[1], a1[2] - cen[2]]);
      var d0 = D - p0[2], d1 = D - p1[2], dm = D - (p0[2] + p1[2]) / 2;
      var dx = p1[0] / d1 - p0[0] / d0, dy = p1[1] / d1 - p0[1] / d0;
      out.push(Math.sqrt(dx * dx + dy * dy) * dm / (A[i].to - A[i].from));
      if (dirs) dirs.push([dx, dy]);
    }
    return out;
  }

  // |cos| of the angle between consecutive arms on screen, one per bend.
  function bendCos(dirs) {
    var out = [];
    for (var i = 1; i < dirs.length; i++) {
      var a = dirs[i - 1], b = dirs[i], la = Math.sqrt(a[0] * a[0] + a[1] * a[1]), lb = Math.sqrt(b[0] * b[0] + b[1] * b[1]);
      out.push(la && lb ? Math.abs(a[0] * b[0] + a[1] * b[1]) / (la * lb) : 1);
    }
    return out;
  }

  // true, or the arm that is foreshortened below half its length, or the bend seen edge-on.
  // Needs no raster.
  function armsReadable(cells, m, radius) {
    var dirs = [], sh = armShares(cells, m, radius, dirs), i;
    for (i = 0; i < sh.length; i++) {
      if (sh[i] < ARM_MIN) return 'arm ' + i + ' is foreshortened to ' + Math.round(100 * sh[i]) + ' % of its length';
    }
    var bc = bendCos(dirs);
    for (i = 0; i < bc.length; i++) if (bc[i] > BEND_COS) return 'bend ' + i + ' is seen edge-on (its arms look parallel)';
    return true;
  }

  // Framing (view.js): how large a picture is drawn and where. A picture's outline is the box
  // around every cube corner on screen, [x0, y0, x1, y1] in units of the model camera's half
  // field of view (x / ((D − z)·tan 15°); the frame of the model's raster spans −1…1).
  // Pictures that are compared share one scale, so cubes stay the same size from figure to
  // figure; each is centred on its own outline, and the scale makes the largest outline fill
  // FILL of the frame's height or width. Zooming (a narrower field of view at the same camera)
  // and centring (a shifted image plane) only scale and move the picture: what the validator
  // measured is what is shown, never smaller than in the model (zoom ≥ 1).
  function outline(cells, q, radius) {
    var m = fromQuat(q), D = distance(radius), cen = centroid(cells), b = [Infinity, Infinity, -Infinity, -Infinity];
    var e = [[m[0] / 2, m[3] / 2, m[6] / 2], [m[1] / 2, m[4] / 2, m[7] / 2], [m[2] / 2, m[5] / 2, m[8] / 2]];
    for (var i = 0; i < cells.length; i++) {
      var p = mulv(m, [cells[i][0] - cen[0], cells[i][1] - cen[1], cells[i][2] - cen[2]]);
      for (var k = 0; k < 8; k++) {
        var sa = k & 1 ? 1 : -1, sb = k & 2 ? 1 : -1, sc = k & 4 ? 1 : -1;
        var x = p[0] + sa * e[0][0] + sb * e[1][0] + sc * e[2][0];
        var y = p[1] + sa * e[0][1] + sb * e[1][1] + sc * e[2][1];
        var z = p[2] + sa * e[0][2] + sb * e[1][2] + sc * e[2][2];
        var t = (D - z) * TAN_HALF, u = x / t, v = y / t;
        if (u < b[0]) b[0] = u; if (v < b[1]) b[1] = v; if (u > b[2]) b[2] = u; if (v > b[3]) b[3] = v;
      }
    }
    return b;
  }
  function unionOutline(boxes) {
    return boxes.reduce(function (a, b) {
      return [Math.min(a[0], b[0]), Math.min(a[1], b[1]), Math.max(a[2], b[2]), Math.max(a[3], b[3])];
    }, [Infinity, Infinity, -Infinity, -Infinity]);
  }
  // Tangent of the vertical half field of view that draws these outlines at one scale, each
  // centred, in a frame of the given aspect (width / height): the largest fills FILL of the
  // frame's height or width; zoom (relative to the model, along the frame's shorter side)
  // stays within 1…ZOOM_MAX.
  function frameTan(boxes, aspect) {
    var need = 0;
    for (var i = 0; i < boxes.length; i++) {
      var b = boxes[i];
      need = Math.max(need, (b[3] - b[1]) / 2, (b[2] - b[0]) / 2 / aspect);
    }
    var lo = Math.min(1, aspect);
    return Math.min(TAN_HALF / lo, Math.max(TAN_HALF / (ZOOM_MAX * lo), TAN_HALF * need / FILL));
  }
  // The outlines show-me passes through while it turns the reference into figure k's
  // orientation (normalised quaternion interpolation follows the same arc as the view's
  // slerp), both ends included.
  function turnOutlines(item, k, steps) {
    var qa = item.ref.q, qb = item.figs[k].q, out = [], n = steps || 8;
    var sg = qa[0] * qb[0] + qa[1] * qb[1] + qa[2] * qb[2] + qa[3] * qb[3] < 0 ? -1 : 1;
    for (var j = 0; j <= n; j++) {
      var t = j / n, q = [0, 0, 0, 0], l = 0, c;
      for (c = 0; c < 4; c++) { q[c] = (1 - t) * qa[c] + t * sg * qb[c]; l += q[c] * q[c]; }
      l = Math.sqrt(l);
      for (c = 0; c < 4; c++) q[c] /= l;
      out.push(outline(item.shapes[0], q, item.radius));
    }
    return out;
  }

  // true, or why a figure at rotation m is not fully readable from the viewpoint: every cube
  // shows ≥ 12 px and ≥ 10 % of itself, both end cubes ≥ 30 %, every arm ≥ 50 % of its length,
  // every bend ≥ 40° from straight or folded on screen.
  function visibility(cells, m, radius, r) {
    var ok = armsReadable(cells, m, radius);
    if (ok !== true) return ok;
    r = r || raster(cells, m, radius, RASTER);
    var n = cells.length, i;
    for (i = 0; i < n; i++) {
      if (r.counts[i] < MIN_PX || r.counts[i] < MIN_FRAC * r.solo[i]) return 'cube ' + i + ' is hidden (' + r.counts[i] + ' px)';
    }
    if (r.counts[0] < END_FRAC * r.solo[0] || r.counts[n - 1] < END_FRAC * r.solo[n - 1]) return 'an end cube is mostly hidden';
    return true;
  }

  // 2D Hausdorff distance between two pictures' cube centres, in cube units.
  function picDistance(ra, rb) {
    function half(a, b) {
      var worst = 0;
      for (var i = 0; i < a.length; i++) {
        var best = Infinity;
        for (var j = 0; j < b.length; j++) {
          var dx = a[i][0] - b[j][0], dy = a[i][1] - b[j][1], d2 = dx * dx + dy * dy;
          if (d2 < best) best = d2;
        }
        if (best > worst) worst = best;
      }
      return worst;
    }
    return Math.sqrt(Math.max(half(ra.c2, rb.c2), half(rb.c2, ra.c2))) / ra.unit;
  }

  // Cheap picture features (what shortcut strategies would use): silhouette area, clearly
  // visible cubes (≥ half of the cube's own picture), bounding-box aspect ratio.
  function features(cells, m, radius) {
    var r = raster(cells, m, radius, RASTER), vis = 0;
    for (var i = 0; i < cells.length; i++) if (r.counts[i] >= 0.5 * r.solo[i]) vis++;
    var b = r.bbox;
    return { area: r.area, visible: vis, aspect: b ? (b[2] - b[0] + 1) / (b[3] - b[1] + 1) : 1 };
  }

  /* ---------- generation ---------- */

  function inRange(a) { return a >= 20 && a <= 180; }

  // Reference pose: a lattice rotation seen from slightly above (25°) and from the side (±35°).
  // Reference poses: a lattice rotation L seen from slightly above and from the side,
  // Q0 = Rx(elevation) · Ry(azimuth) · L (24 × 3 × 4 candidates). next() returns the next
  // visible candidate in random order, or null after `tries` candidates.
  function refPoses(rng, cells, radius, tries) {
    var order = rng.shuffle(range(0, 24 * 12 - 1)), i = 0;
    return function next() {
      while (i < tries) {
        var k = order[i++], L = ROT24[k % 24], v = (k / 24) | 0;
        var m = mul(rx(ELS[v % 3]), mul(ry(AZS[(v / 3) | 0]), L));
        if (armsReadable(cells, m, radius) !== true) continue;
        var r = raster(cells, m, radius, RASTER);
        if (visibility(cells, m, radius, r) === true) return { M: m, r: r, el: ELS[v % 3] };
      }
      return null;
    };
  }

  // The picture of the left–right mirror image: cube centres flipped about the frame's middle.
  function flipped(r) {
    var w = RASTER;
    return { c2: r.c2.map(function (p) { return [w - p[0], p[1]]; }), unit: r.unit };
  }

  // Turning axes in camera space. 'vertical' is the scene's vertical seen from the pose's
  // elevation el ([sin, cos]): a turntable, so the figure's upright arms stay upright.
  function axisVec(rng, name, el) {
    if (name === 'vertical') return el ? [0, el[1], el[0]] : [0, 1, 0];
    if (name === 'horizontal') return [1, 0, 0];
    if (name === 'picture') return [0, 0, 1];
    for (var t = 0; t < 200; t++) {
      var v = [rng.float(-1, 1), rng.float(-1, 1), rng.float(-1, 1)];
      var l = Math.sqrt(v[0] * v[0] + v[1] * v[1] + v[2] * v[2]);
      if (l > 1 || l < 0.05) continue;
      v = [v[0] / l, v[1] / l, v[2] / l];
      if (Math.abs(v[0]) >= 0.3 && Math.abs(v[1]) >= 0.3 && Math.abs(v[2]) >= 0.3) return v;
    }
    return [0.5773502691896258, 0.5773502691896258, 0.5773502691896258];
  }

  // The axis tilted by about 5–10° in a random direction: still a vertical (or horizontal)
  // turn to the eye, but each candidate gives a distinct picture, and the poses where an arm
  // would swing end-on move. Used for vertical and horizontal turns (not picture-plane ones).
  function wobble(rng, u) {
    var a = Math.abs(u[0]) < 0.9 ? [1, 0, 0] : [0, 1, 0];
    var w1 = [u[1] * a[2] - u[2] * a[1], u[2] * a[0] - u[0] * a[2], u[0] * a[1] - u[1] * a[0]];
    var l1 = Math.sqrt(w1[0] * w1[0] + w1[1] * w1[1] + w1[2] * w1[2]);
    w1 = [w1[0] / l1, w1[1] / l1, w1[2] / l1];
    var w2 = [u[1] * w1[2] - u[2] * w1[1], u[2] * w1[0] - u[0] * w1[2], u[0] * w1[1] - u[1] * w1[0]];
    var c = rng.float(-1, 1), d = rng.float(-1, 1), t = rng.float(0.09, 0.18); // tan 5° … tan 10°
    var lw = Math.sqrt(c * c + d * d) || 1;
    var v = [u[0] + t * (c * w1[0] + d * w2[0]) / lw, u[1] + t * (c * w1[1] + d * w2[1]) / lw, u[2] + t * (c * w1[2] + d * w2[2]) / lw];
    var lv = Math.sqrt(v[0] * v[0] + v[1] * v[1] + v[2] * v[2]);
    return [v[0] / lv, v[1] / lv, v[2] / lv];
  }

  // Candidate turns for 'pick': magnitudes A − 20 … A + 20 in 10° steps (at the ends of the
  // range shifted inwards, so every pair stays within 40° and the mean stays near A), both
  // senses; the turns at exactly A come first.
  function turnPool(rng, A, axisName, el) {
    var mags = [A - 20, A - 10, A, A + 10, A + 20].filter(inRange), first = [], rest = [], i;
    if (A === 20) mags.push(50, 60);
    if (A === 180) mags.unshift(140, 150);
    var others = mags.filter(function (m) { return m !== A; });
    if (axisName === 'oblique') {
      for (i = 0; i < 14; i++) (i < 2 ? first : rest).push({ deg: i < 2 ? A : rng.pick(others), u: axisVec(rng, 'oblique') });
    } else {
      var u = axisVec(rng, axisName, el), tilt = axisName !== 'picture';
      mags.forEach(function (m) {
        (m === 180 ? [1] : [1, -1]).forEach(function (sg) {
          var us = [sg * u[0], sg * u[1], sg * u[2]];
          (m === A ? first : rest).push({ deg: m, u: us });
          if (tilt) rest.push({ deg: m, u: wobble(rng, us) });
        });
      });
    }
    return rng.shuffle(first).concat(rng.shuffle(rest));
  }

  // A mirror option shows the left–right flip of the copy at M: S·M, stored as the reflected
  // cells at the proper rotation S·M·P (P² = I, so S·M·P·(P·c) = S·M·c).
  function mirrorOf(M, refl) { return mul(mul(S_FLIP, M), refl.P); }

  // One attempt; null when any rule fails (generate retries with a forked stream).
  function build(rng, p) {
    var A = ANGLES[p.angle], axisName = AXES[p.axis], n = CUBES[p.cubes];
    var cells = makeShape(rng, n);
    if (!cells) { STATS.noShape++; return null; }
    var radius = radiusOf(cells);
    var nextPose = refPoses(rng, cells, radius, 20), refl = null, pose = null, figs = null, key, i, t, r;
    // Up to three visible reference poses share the figure (and its reflection) before giving up.
    for (var pi = 0; pi < 3 && !figs; pi++) {
      pose = nextPose();
      if (!pose) { if (!pi) { STATS.noPose++; return null; } break; }
      if (!refl) refl = bestReflection(cells);
      var Q0 = pose.M;
      if (p.variant === 'pick') {
        // Roles first (which slots are copies: random, so no role gets the turns at exactly A
        // more often), then fill the slots in pool order. Rules: every cube visible; no two
        // options look alike; a mirror never looks like the reference.
        var roles = rng.shuffle([0, 0, 1, 1]), pool = turnPool(rng, A, axisName, pose.el), chosen = [];
        for (i = 0; i < pool.length && chosen.length < 4; i++) {
          var M = mul(rotAxis(pool[i].u, pool[i].deg), Q0);
          if (armsReadable(cells, M, radius) !== true) continue;
          var role = roles[chosen.length], pr = project(cells, M, radius), pic = role === 0 ? pr : flipped(pr);
          if (role === 1 && picDistance(pose.r, pic) < SIMILAR) { STATS.similar++; continue; }
          if (chosen.some(function (c) { return picDistance(c.r, pic) < SIMILAR; })) { STATS.similar++; continue; }
          r = raster(cells, M, radius, RASTER);
          if (visibility(cells, M, radius, r) !== true) continue;
          chosen.push({ s: role, M: role === 0 ? M : mirrorOf(M, refl), deg: pool[i].deg, ax: pool[i].u, r: pic });
        }
        if (chosen.length < 4) continue;
        figs = rng.shuffle(chosen);
        key = [];
        for (i = 0; i < 4; i++) if (figs[i].s === 0) key.push(i);
      } else {
        var same = rng.chance(0.5), fig = null;
        for (t = 0; t < 6 && !fig; t++) {
          var u = axisVec(rng, axisName, pose.el), sg = rng.chance(0.5) ? 1 : -1;
          u = [sg * u[0], sg * u[1], sg * u[2]];
          if (t >= 2 && axisName !== 'picture' && axisName !== 'oblique') u = wobble(rng, u); // after both exact senses
          var M2 = mul(rotAxis(u, A), Q0);
          if (armsReadable(cells, M2, radius) !== true) continue;
          var pr2 = project(cells, M2, radius);
          if (!same && picDistance(pose.r, flipped(pr2)) < SIMILAR) { STATS.similar++; continue; }
          r = raster(cells, M2, radius, RASTER);
          if (visibility(cells, M2, radius, r) !== true) continue;
          fig = { s: same ? 0 : 1, M: same ? M2 : mirrorOf(M2, refl), deg: A, ax: u, r: same ? pr2 : flipped(pr2) };
        }
        if (!fig) continue;
        figs = [fig];
        key = same;
      }
    }
    if (!figs) { STATS.noTurns++; return null; }
    Q0 = pose.M;
    // Pictures that look the same are not allowed (a mirror that looks like the reference,
    // or two options that look alike); a turned copy may look like the reference.
    var shapes = [cells, refl.cells];
    var shown = [{ s: 0, M: Q0, r: pose.r }].concat(figs), ras = shown.map(function (f) { return f.r; });
    for (i = 0; i < shown.length; i++) {
      for (t = i + 1; t < shown.length; t++) {
        if (i === 0 && shown[t].s === 0) continue;
        if (picDistance(ras[i], ras[t]) < SIMILAR) { STATS.similarLate++; return null; }
      }
    }
    var item = {
      ex: 'rotate', v: 1, seed: 0, params: { angle: p.angle, axis: p.axis, cubes: p.cubes, variant: p.variant },
      variant: p.variant, answer: p.variant === 'pick' ? 'multi' : 'yesno', nOptions: p.variant === 'pick' ? 4 : 2,
      angle: A, axis: axisName, n: n, radius: radius, shapes: shapes, diff: refl.diff,
      ref: { s: 0, q: toQuat(Q0) },
      figs: figs.map(function (f) { return { s: f.s, q: toQuat(f.M), deg: f.deg, ax: f.ax }; }),
      key: key,
    };
    if (p.variant === 'pick') item.nCorrect = 2;
    STATS.built++;
    return item;
  }

  function norm(params) {
    params = params || {};
    function lv(k, count) { var v = params[k]; return Number.isInteger(v) && v >= 0 && v < count ? v : 0; }
    return {
      angle: lv('angle', ANGLES.length), axis: lv('axis', AXES.length), cubes: lv('cubes', CUBES.length),
      variant: VARIANTS.indexOf(params.variant) >= 0 ? params.variant : VARIANTS[0],
    };
  }

  // Never throws. 50 forked attempts; then a fixed-seed search that the node tests run for
  // every params combination (a construction known to be valid).
  function generate(rng, params) {
    var p = norm(params), item, i;
    for (i = 0; i < 50; i++) {
      item = build(i === 0 ? rng : rng.fork('retry' + i), p);
      if (item && validate(item) === true) { item.seed = rng.seed; return item; }
    }
    item = fallback(p);
    item.seed = rng.seed;
    return item;
  }

  function fallback(p) {
    var r0 = PX.rng(PX.rng.hash('rotate-fallback', p.angle, p.axis, p.cubes, p.variant)), last = null;
    for (var i = 0; i < 400; i++) {
      var it = build(r0.fork('fb' + i), p);
      if (!it) continue;
      last = it;
      if (validate(it) === true) { it.fallback = true; return it; }
    }
    last.fallback = 'unvalidated'; // unreachable in the tested params range
    return last;
  }

  /* ---------- validation: re-derives everything from the cells and quaternions ---------- */

  function near(a, b, tol) { return Math.abs(a - b) <= tol; }
  function unitQuat(q) {
    return Array.isArray(q) && q.length === 4 && q.every(function (x) { return typeof x === 'number' && isFinite(x); }) &&
      near(q[0] * q[0] + q[1] * q[1] + q[2] * q[2] + q[3] * q[3], 1, 1e-6);
  }

  function check(item) {
    if (!item || item.ex !== 'rotate') return 'not a rotate item';
    var p = item.params || {}, n = CUBES[p.cubes], A = ANGLES[p.angle], axisName = AXES[p.axis];
    if (!n || !A || !axisName || VARIANTS.indexOf(p.variant) < 0) return 'params are not valid rotate params';
    if (item.angle !== A || item.axis !== axisName || item.variant !== p.variant || item.n !== n) return 'item fields do not match its params';
    var pick = p.variant === 'pick';
    if (item.answer !== (pick ? 'multi' : 'yesno') || item.nOptions !== (pick ? 4 : 2) || (pick && item.nCorrect !== 2)) return 'answer format does not match the variant';
    var shapes = item.shapes;
    if (!Array.isArray(shapes) || shapes.length !== 2) return 'item needs the figure and its mirror image';
    var ok = checkShape(shapes[0], n);
    if (ok !== true) return ok;
    var lat0 = lattice(shapes[0]);
    if (lat0.canon === lat0.mirror) return 'the figure is not chiral: its mirror image is one of its 24 rotations';
    if (lat0.sym !== 1) return 'the figure has a rotational symmetry (the angle would be ambiguous)';
    ok = checkShape(shapes[1], n);
    if (ok !== true) return 'mirror figure: ' + ok;
    var cRef = lat0.canon, cMir = lat0.mirror, cs = [cRef, canon(shapes[1])];
    if (cs[1] !== cMir) return 'the second figure is not the mirror image of the first';
    var radius = radiusOf(shapes[0]);
    if (!near(item.radius, radius, 1e-9)) return 'radius does not match the figure';
    if (!item.ref || item.ref.s !== 0 || !unitQuat(item.ref.q)) return 'the reference must show the figure at a unit quaternion';
    var figs = item.figs;
    if (!Array.isArray(figs) || figs.length !== (pick ? 4 : 1)) return 'wrong number of shown figures';
    var Mref = fromQuat(item.ref.q), copies = [], i, j;
    for (i = 0; i < figs.length; i++) {
      var f = figs[i];
      if (!f || !shapes[f.s] || !unitQuat(f.q)) return 'figure ' + i + ' is malformed';
      var c = cs[f.s];
      if (c === cRef) copies.push(i);
      else if (c !== cMir) return 'figure ' + i + ' is neither a turned copy nor a mirror image (no structural distractors)';
    }
    // The key, derived from the geometry alone (24-rotation congruence), must match.
    if (pick) {
      if (copies.length !== 2) return 'pick needs exactly two turned copies and two mirror images, found ' + copies.length + ' copies';
      if (!Array.isArray(item.key) || item.key.length !== 2 || item.key[0] !== copies[0] || item.key[1] !== copies[1]) return 'key does not match the two turned copies';
    } else if (item.key !== (copies.length === 1)) return 'key does not match the shown figures';
    // Turn bookkeeping: a copy is R·Mref; a mirror's picture is the left–right flip of R·Mref.
    var degs = [];
    for (i = 0; i < figs.length; i++) {
      var g = figs[i], u = g.ax;
      if (!(g.deg >= 20 && g.deg <= 180 && g.deg % 10 === 0)) return 'figure ' + i + ' has an invalid turn angle';
      if (!Array.isArray(u) || u.length !== 3 || !near(u[0] * u[0] + u[1] * u[1] + u[2] * u[2], 1, 1e-6)) return 'figure ' + i + ' has an invalid turn axis';
      var ax = [Math.abs(u[0]), Math.abs(u[1]), Math.abs(u[2])];
      // vertical: the scene's vertical seen from 25–35° above, tilted ≤ ~10°; horizontal: the
      // screen's horizontal, tilted ≤ ~10°; picture: the line of sight; oblique: ≥ 0.3 on all axes
      var axisOk = axisName === 'vertical' ? ax[0] <= 0.18 && ax[1] >= 0.72 && ax[2] >= 0.24
        : axisName === 'horizontal' ? ax[0] >= 0.98 : axisName === 'picture' ? near(ax[2], 1, 1e-9)
          : ax[0] >= 0.3 && ax[1] >= 0.3 && ax[2] >= 0.3;
      if (!axisOk) return 'figure ' + i + ' is not turned about a ' + axisName + ' axis';
      var RM = mul(rotAxis(u, g.deg), Mref), Mf = fromQuat(g.q);
      if (g.s === 0) {
        for (j = 0; j < 9; j++) if (!near(Mf[j], RM[j], 1e-6)) return 'figure ' + i + ' is not the reference turned by its stated turn';
      } else {
        var wa = world(shapes[1], Mf), wb = world(shapes[0], RM);
        for (j = 0; j < n; j++) {
          if (!near(wa[j][0], -wb[j][0], 1e-6) || !near(wa[j][1], wb[j][1], 1e-6) || !near(wa[j][2], wb[j][2], 1e-6)) return 'mirror ' + i + ' is not the left–right flip of a turned copy';
        }
      }
      degs.push(g.deg);
    }
    if (!pick && degs[0] !== A) return 'the turn is not the angle of the params';
    if (pick && (Math.max.apply(null, degs) - Math.min.apply(null, degs) > 40 || degs.some(function (d) { return Math.abs(d - A) > 40; }))) return 'option angles differ by more than 40°';
    // Every cube of every shown figure is visible; every arm end is readable.
    var shown = [{ s: 0, M: Mref }].concat(figs.map(function (h) { return { s: h.s, M: fromQuat(h.q) }; }));
    var ras = [];
    for (i = 0; i < shown.length; i++) {
      var r = raster(shapes[shown[i].s], shown[i].M, radius, RASTER);
      ok = visibility(shapes[shown[i].s], shown[i].M, radius, r);
      if (ok !== true) return (i ? 'figure ' + (i - 1) : 'reference') + ': ' + ok;
      ras.push(r);
    }
    // Pictures are pairwise different (a turned copy may resemble the reference).
    for (i = 0; i < shown.length; i++) {
      for (j = i + 1; j < shown.length; j++) {
        if (i === 0 && shown[j].s === 0) continue;
        if (picDistance(ras[i], ras[j]) < SIMILAR) return 'pictures ' + i + ' and ' + j + ' look the same';
      }
    }
    return true;
  }

  function validate(item) {
    try { return check(item); } catch (e) { return 'validate threw: ' + (e && e.message); }
  }

  /* ---------- scoring ---------- */

  // samediff: response true (same) / false (mirror). pick: sorted array of two option indices;
  // right only if they are exactly the two copies; value = how many copies were picked.
  function score(item, response) {
    if (item.answer === 'yesno') {
      var okYN = typeof response === 'boolean' && response === item.key;
      return { correct: okYN, detail: { response: typeof response === 'boolean' ? response : null, key: item.key } };
    }
    var picked = Array.isArray(response) ? response.filter(function (x, k, a) {
      return Number.isInteger(x) && x >= 0 && x < item.nOptions && a.indexOf(x) === k;
    }).sort(function (a, b) { return a - b; }) : [];
    var hits = picked.filter(function (x) { return item.key.indexOf(x) >= 0; }).length;
    var correct = Array.isArray(response) && response.length === 2 && picked.length === 2 && hits === 2;
    return { correct: correct, value: hits, detail: { picked: picked, key: item.key.slice() } };
  }

  /* ---------- definition ---------- */

  PX.ex.define({
    id: 'rotate', version: 1, code: 'EX-02', name: 'Mental Rotation', short: 'Rotate',
    abilities: ['Vz', 'SR'], cell: 'intrinsic-dynamic', role: 'train',
    // Variants answer differently (ARCHITECTURE §6): the main answer is 'pick'; every item
    // carries item.answer, and players use item.answer || def.answer.
    answer: 'multi', nOptions: 4, nCorrect: 2,
    answers: { samediff: 'yesno', pick: 'multi' },
    // Starting design, to be recalibrated from logged trials (research/B-tasks.md §14c, LLTM):
    // - angle 20–180° in 20° steps, +0.30 logit per step (2.4 over the range): G&K 2015 errors
    //   rose 5 % → 19 % from 0° to 150°, about 0.016 logit per degree.
    // - axis vertical → horizontal → picture → oblique (§14c order), +0.40 per level: the vertical
    //   axis is fastest (G&K); two-axis/oblique turns are hardest (MRT version C).
    // - cubes 6, 8, 10, 12, +0.20 per level: more arms to follow, a modest effect next to angle.
    // Range 4.2 logits. base −1.75: a beginner at θ = 0 (the store default) gets the easiest
    // same/mirror pair right 0.5 + 0.47·σ(1.75) ≈ 90 % of the time (pick, same b: ≈ 85 %).
    dims: [
      { key: 'angle', label: 'Angle', levels: ANGLES.slice(), step: 0.30, unit: '°' },
      { key: 'axis', label: 'Axis', levels: AXES.slice(), step: 0.40 },
      { key: 'cubes', label: 'Cubes', levels: CUBES.slice(), step: 0.20 },
    ],
    base: -1.75,
    variants: VARIANTS.slice(),
    chance: function (params) { return params && params.variant === 'pick' ? 1 / 6 : 0.5; },
    generate: generate,
    validate: validate,
    score: score,
    // The model, shared by view.js (drawing, show-me) and the tests (shortcut solvers).
    lib: {
      FOV: FOV, TAN_HALF: TAN_HALF, SIN_HALF: SIN_HALF, MARGIN: MARGIN, RASTER: RASTER, MIN_PX: MIN_PX,
      MIN_FRAC: MIN_FRAC, END_FRAC: END_FRAC, ARM_MIN: ARM_MIN, SIMILAR: SIMILAR, FILL: FILL,
      ANGLES: ANGLES, AXES: AXES, CUBES: CUBES, VARIANTS: VARIANTS, S_FLIP: S_FLIP,
      mul: mul, mulv: mulv, det: det, trace: trace, transpose: transpose, rotAxis: rotAxis, toQuat: toQuat, fromQuat: fromQuat,
      canon: canon, mirrorX: mirrorX, chiral: chiral, symmetries: symmetries, arms: arms, checkShape: checkShape,
      centroid: centroid, radiusOf: radiusOf, distance: distance, world: world, raster: raster, visibility: visibility,
      picDistance: picDistance, features: features, bestReflection: bestReflection, project: project, armsReadable: armsReadable,
      armShares: armShares, bendCos: bendCos, BEND_COS: BEND_COS, outline: outline, unionOutline: unionOutline, frameTan: frameTan, turnOutlines: turnOutlines, ZOOM_MAX: ZOOM_MAX, compositions: compositions, maxArm: maxArm,
      lattice: lattice, makeShape: makeShape, build: build, fallback: fallback, norm: norm, STATS: STATS,
    },
  });
})(window.PX);
