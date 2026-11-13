/* PR-3 Mechanisms: view (SVG; ARCHITECTURE.md §6, docs/dev/EXERCISE-GUIDE.md).
   layout 'stem+options': the stem is the drawing (item.W × item.H units, y down), the question and
   the countdown bar; the grid holds the three answers (keys 1–3), each with an icon and a word.
   - Drawn from the item: gears are pitch circles with teeth (teeth = item teeth, reaching
     lib.TOOTH beyond and below the pitch circle), back-layer gears (layer 0) first and in a darker
     tone, front gears (layer 1) over them, then pulleys, belt runs (lib.beltRuns: open belts on the
     outer tangents, crossed belts crossing), the drum, the rope and the weight. Tooth phases are set
     so that meshing teeth interleave at every contact point (loop-closing meshes keep the
     first phase). Labels (DRIVER with its turning arrow, MARKED with a dashed ring, WEIGHT) are
     words and shapes, never colour alone.
   - Show me and the worked example (development and the instruction screen; the Spatial Check
     gives no feedback) use the solver's own model: lib.analyse(item) gives each axle's turn as an
     exact fraction of the driver's, the route, and the loops, so the motion shown is the motion
     that grades the answer.
   - The item's time limit runs as a calm bar under the drawing (one slow linear sweep); it pauses
     while the harness or an ancestor is paused and stops at reveal. */
(function (PX) {
  'use strict';

  var timing = PX.core.timing, S = PX.core.svg, h = PX.ui.h, U = PX.util;
  var def = PX.ex.get('mechanisms'), lib = def.lib, TOOTH = lib.TOOTH || 1.5;
  var DEG = 180 / Math.PI, TAU = 2 * Math.PI;
  var DRIVE_DEG_PER_S = 90; // the driver's speed in show me (degrees per second)
  var st = null;

  function learn() { return PX.ex.learn('mechanisms') || {}; }
  function fill(t, vars) { return String(t || '').replace(/\{(\w+)\}/g, function (m, k) { return vars && vars[k] !== undefined ? vars[k] : m; }); }
  function cap(key, vars) { return fill((learn().captions || {})[key], vars); }
  function dirWord(turn) { return cap(turn > 0 ? 'cw' : 'ccw'); }

  /* ---------- the model of one item (from the validator's analysis) ---------- */

  function modelOf(item) {
    var res = lib.analyse(item), axles = {}, wheels = {}, byAxle = {};
    item.axles.forEach(function (a) { axles[a.id] = a; byAxle[a.id] = []; });
    item.wheels.forEach(function (w) { wheels[w.id] = w; byAxle[w.axle].push(w); });
    // Route from the driver to the marked axle: [{ from, to, kind: mesh|open|crossed }].
    var route = [], a = item.target;
    while (res.parent && res.parent[a]) {
      var p = res.parent[a], e = res.edges[p.e];
      route.unshift({ from: p.from, to: a, kind: e.belt ? (e.sign > 0 ? 'open' : 'crossed') : 'mesh' });
      a = p.from;
    }
    return { res: res, axles: axles, wheels: wheels, byAxle: byAxle, route: route, phase: phases(item, res, axles, wheels) };
  }
  // Signed turn of an axle per driver turn (+ = clockwise on the screen).
  function turnOf(m, item, axleId) {
    var w = m.res.omega[axleId];
    return w ? item.driver.dir * w.s * w.n / w.d : 0;
  }

  // Tooth phases (radians): meshing gears interleave, tooth facing gap, at every contact point.
  function phases(item, res, axles, wheels) {
    var adj = {}, ph = {};
    item.wheels.forEach(function (w) { if (w.kind === 'gear') adj[w.id] = []; });
    (res.meshes || []).forEach(function (mm) { adj[mm[0]].push(mm[1]); adj[mm[1]].push(mm[0]); });
    var order = item.wheels.filter(function (w) { return w.kind === 'gear'; }).map(function (w) { return w.id; });
    order.sort(function (x, y) { return (wheels[x].axle === item.driver.axle ? 0 : 1) - (wheels[y].axle === item.driver.axle ? 0 : 1); });
    order.forEach(function (root) {
      if (ph[root] !== undefined) return;
      ph[root] = 0;
      var q = [root];
      for (var i = 0; i < q.length; i++) {
        var A = wheels[q[i]], ca = axles[A.axle];
        adj[A.id].forEach(function (bid) {
          if (ph[bid] !== undefined) return;
          var B = wheels[bid], cb = axles[B.axle], th = Math.atan2(cb.y - ca.y, cb.x - ca.x);
          var pa = TAU / A.teeth, pb = TAU / B.teeth;
          var u = ((th - ph[A.id]) / pa) % 1;
          if (u < 0) u += 1;
          ph[bid] = th + Math.PI - (0.5 - u) * pb;
          q.push(bid);
        });
      }
    });
    return ph;
  }

  /* ---------- drawing ---------- */

  function gearPath(w, phase) {
    var n = w.teeth, ro = w.r + TOOTH, ri = w.r - TOOTH, hp = Math.PI / n, d = '';
    for (var k = 0; k < n; k++) {
      var c = phase + k * TAU / n;
      var pts = [[c - 0.56 * hp, ri], [c - 0.3 * hp, ro], [c + 0.3 * hp, ro], [c + 0.56 * hp, ri]];
      pts.forEach(function (p, j) {
        d += (k === 0 && j === 0 ? 'M' : 'L') + U.round(p[1] * Math.cos(p[0]), 3) + ' ' + U.round(p[1] * Math.sin(p[0]), 3);
      });
    }
    return d + 'Z';
  }
  // One gear, drawn at the origin and moved to its axle; spokes make its turning visible.
  function drawGear(w, ax, phase) {
    var g = S.el('g', { class: 'mx-gear mx-layer' + w.layer, 'data-wheel': w.id, 'data-axle': w.axle, transform: 'translate(' + U.round(ax.x, 3) + ' ' + U.round(ax.y, 3) + ')' });
    var rot = S.el('g', { class: 'mx-rot' });
    rot.appendChild(S.el('path', { class: 'mx-teeth', d: gearPath(w, phase) }));
    rot.appendChild(S.el('circle', { class: 'mx-web', r: Math.max(2, w.r - TOOTH - 1.6) }));
    for (var k = 0; k < 3; k++) {
      var a = phase + k * TAU / 3, rr = Math.max(2, w.r - TOOTH - 1.6);
      rot.appendChild(S.el('line', { class: 'mx-spoke', x1: 0, y1: 0, x2: rr * Math.cos(a), y2: rr * Math.sin(a) }));
    }
    g.appendChild(rot);
    return { g: g, rot: rot };
  }
  function drawPulley(w, ax) {
    var g = S.el('g', { class: 'mx-pulley mx-' + w.kind, 'data-wheel': w.id, 'data-axle': w.axle, transform: 'translate(' + U.round(ax.x, 3) + ' ' + U.round(ax.y, 3) + ')' });
    var rot = S.el('g', { class: 'mx-rot' });
    rot.appendChild(S.el('circle', { class: 'mx-rim', r: w.r }));
    rot.appendChild(S.el('circle', { class: 'mx-groove', r: Math.max(1.5, w.r - 1.4) }));
    if (w.kind === 'drum') {
      for (var k = -2; k <= 2; k++) rot.appendChild(S.el('line', { class: 'mx-wind', x1: -w.r * 0.8, y1: k * w.r * 0.32, x2: w.r * 0.8, y2: k * w.r * 0.32 + 0.8 }));
    } else {
      rot.appendChild(S.el('line', { class: 'mx-spoke', x1: -w.r + 1.5, y1: 0, x2: w.r - 1.5, y2: 0 }));
    }
    g.appendChild(rot);
    return { g: g, rot: rot };
  }
  // A curved arrow outside the driver: the way it turns (dir 1 clockwise).
  function turnArrow(ax, r, dir) {
    var R = r + TOOTH + 3.2, a0 = -Math.PI * 0.8, a1 = -Math.PI * 0.2, s = dir > 0 ? 1 : 0;
    var p0 = [ax.x + R * Math.cos(dir > 0 ? a0 : a1), ax.y + R * Math.sin(dir > 0 ? a0 : a1)];
    var p1 = [ax.x + R * Math.cos(dir > 0 ? a1 : a0), ax.y + R * Math.sin(dir > 0 ? a1 : a0)];
    var end = dir > 0 ? a1 : a0, tx = -Math.sin(end) * dir, ty = Math.cos(end) * dir; // travel direction at the tip
    var nx = Math.cos(end), ny = Math.sin(end), L = 2.6;
    var head = [[p1[0] + tx * L, p1[1] + ty * L], [p1[0] + nx * L * 0.7, p1[1] + ny * L * 0.7], [p1[0] - nx * L * 0.7, p1[1] - ny * L * 0.7]];
    var g = S.el('g', { class: 'mx-arrow' });
    g.appendChild(S.el('path', { d: 'M' + p0[0] + ' ' + p0[1] + 'A' + R + ' ' + R + ' 0 0 ' + s + ' ' + p1[0] + ' ' + p1[1] }));
    g.appendChild(S.path(head, true, { class: 'mx-arrow-head' }));
    return g;
  }
  // Labels keep about 13 px on screen whatever the drawing's scale (st.fs drawing units; phones: no text under 13 px).
  function label(x, y, text, cls) {
    var fs = st.fs, g = S.el('g', { class: 'mx-label ' + (cls || '') });
    var w = text.length * fs * 0.64 + fs * 0.9, hh = fs * 1.55;
    var vb = st.vb;
    x = U.clamp(x, vb[0] + w / 2 + 1, vb[0] + vb[2] - w / 2 - 1);
    y = U.clamp(y, vb[1] + hh / 2 + 1, vb[1] + vb[3] - hh / 2 - 1);
    g.appendChild(S.el('rect', { x: x - w / 2, y: y - hh / 2, width: w, height: hh, rx: 1 }));
    g.appendChild(S.text(x, y + fs * 0.05, text, { 'font-size': U.round(fs, 2) }));
    return g;
  }
  // Where a label goes: above the wheel, or below it near the top edge.
  // Where a label goes: of eight spots around the wheel, the one that covers the least of other
  // wheels and never a mesh contact point, a belt run or the rope (they decide the answer).
  function labelSpot(item, ax, r, text, avoid) {
    var m = st.model, fs = st.fs, w = text.length * fs * 0.64 + fs * 0.9, hh = fs * 1.55, vb = st.vb;
    var contacts = (m.res.meshes || []).map(function (mm) {
      var A = m.wheels[mm[0]], B = m.wheels[mm[1]], ca = m.axles[A.axle], cb = m.axles[B.axle], d = Math.hypot(cb.x - ca.x, cb.y - ca.y);
      return [ca.x + (cb.x - ca.x) * A.r / d, ca.y + (cb.y - ca.y) * A.r / d];
    });
    var segs = [];
    item.belts.forEach(function (b) {
      var A = m.wheels[b.a], B = m.wheels[b.b], pa = m.axles[A.axle], pb = m.axles[B.axle];
      lib.beltRuns(pa.x, pa.y, A.r, pb.x, pb.y, B.r, b.crossed).forEach(function (rr) { segs.push(rr); });
    });
    if (item.rope) { var dw = m.wheels[item.rope.wheel], ta = m.axles[dw.axle]; segs.push([item.rope.weight[0], ta.y, item.rope.weight[0], item.rope.weight[1]]); }
    function rectDist(x, y, px, py) { var dx = Math.max(Math.abs(px - x) - w / 2, 0), dy = Math.max(Math.abs(py - y) - hh / 2, 0); return Math.hypot(dx, dy); }
    function segHits(x, y, sg) {
      for (var t = 0; t <= 1.0001; t += 0.1) if (rectDist(x, y, sg[0] + (sg[2] - sg[0]) * t, sg[1] + (sg[3] - sg[1]) * t) < 0.6) return true;
      return false;
    }
    var best = null, bestCost = Infinity, off = r + TOOTH + fs * 0.4;
    [[0, -1], [0, 1], [1, 0], [-1, 0], [0.75, -0.75], [-0.75, -0.75], [0.75, 0.75], [-0.75, 0.75]].forEach(function (dv, k) {
      var x = ax.x + dv[0] * (off + w / 2), y = ax.y + dv[1] * (off + hh / 2), cost = k * 0.01;
      if (x - w / 2 < vb[0] || x + w / 2 > vb[0] + vb[2] || y - hh / 2 < vb[1] || y + hh / 2 > vb[1] + vb[3]) cost += 40;
      item.wheels.forEach(function (ww) {
        var c = m.axles[ww.axle], dd = rectDist(x, y, c.x, c.y);
        if (dd < ww.r + TOOTH + 0.5) cost += (ww.r + TOOTH + 0.5 - dd);
      });
      contacts.forEach(function (c) { if (rectDist(x, y, c[0], c[1]) < 1.5) cost += 100; });
      segs.forEach(function (sg) { if (segHits(x, y, sg)) cost += 30; });
      // other labels and the driver's arrow, with a gap of half a letter
      (avoid || []).forEach(function (o) { if (Math.abs(o[0] - x) < (o[2] + w) / 2 + fs * 0.5 && Math.abs(o[1] - y) < (o[3] + hh) / 2 + fs * 0.5) cost += 60; });
      if (cost < bestCost) { bestCost = cost; best = [x, y, w, hh]; }
    });
    return best;
  }

  // The WEIGHT label: beside the weight, on the side (right first) that stays inside the view and
  // covers the least of the wheels. → [x, y, w, h] (centre and size, as labelSpot)
  function weightSpot(item) {
    var m = st.model, fs = st.fs, vb = st.vb, wt = item.rope.weight, w = 6 * fs * 0.64 + fs * 0.9, hh = fs * 1.55;
    var y = wt[1] + wt[3] / 2, best = null, bestCost = Infinity, dx0 = m.axles[item.driver.axle].x - wt[0];
    [1, -1].forEach(function (side, k) {
      // the side away from the driver, whose label goes near it, unless that side is worse
      var x = wt[0] + side * (wt[2] / 2 + fs * 0.6 + w / 2), cost = k * 0.01 + (side * dx0 > 0 ? 0.5 : 0);
      if (x - w / 2 < vb[0] || x + w / 2 > vb[0] + vb[2]) cost += 40;
      item.wheels.forEach(function (ww) {
        var c = m.axles[ww.axle], dx = Math.max(Math.abs(c.x - x) - w / 2, 0), dy = Math.max(Math.abs(c.y - y) - hh / 2, 0), dd = Math.hypot(dx, dy);
        if (dd < ww.r + TOOTH + 0.5) cost += (ww.r + TOOTH + 0.5 - dd);
      });
      if (cost < bestCost) { bestCost = cost; best = [x, y, w, hh]; }
    });
    return best;
  }

  // The mechanism's bounding box with room for labels, at least 96 × 64 units (small mechanisms are
  // drawn larger, filling more of the stage), inside the canvas.
  function viewBoxOf(item, m) {
    var x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    item.wheels.forEach(function (w) {
      var a = m.axles[w.axle], r = w.r + TOOTH;
      x0 = Math.min(x0, a.x - r); x1 = Math.max(x1, a.x + r); y0 = Math.min(y0, a.y - r); y1 = Math.max(y1, a.y + r);
    });
    if (item.rope) { var wt = item.rope.weight; x0 = Math.min(x0, wt[0] - wt[2] / 2 - 26); x1 = Math.max(x1, wt[0] + wt[2] / 2 + 26); y1 = Math.max(y1, wt[1] + wt[3]); }
    var pad = 9;
    x0 -= pad; y0 -= pad + 4; x1 += pad; y1 += pad;
    var w = Math.max(96, x1 - x0), hh = Math.max(64, y1 - y0), cx = (x0 + x1) / 2, cy = (y0 + y1) / 2;
    w = Math.min(item.W, Math.max(w, hh * 1.25)); hh = Math.min(item.H, hh);
    var vx = U.clamp(cx - w / 2, 0, item.W - w), vy = U.clamp(cy - hh / 2, 0, item.H - hh);
    return [vx, vy, w, hh];
  }
  function drawItem(item) {
    var m = st.model, svg = st.svg;
    PX.ui.clear(svg);
    // Show the part of the canvas the mechanism uses (geometry unchanged), then size labels to
    // about 13 CSS px from the laid-out stage (ready phase).
    st.vb = viewBoxOf(item, m);
    svg.setAttribute('viewBox', st.vb.map(function (v) { return U.round(v, 2); }).join(' '));
    var box = svg.getBoundingClientRect(), px = box.width && box.height ? Math.min(box.width / st.vb[2], box.height / st.vb[3]) : 3;
    st.fs = U.clamp(13 / px, 2, 11); // up to 11 units: a small drawing (phone held sideways, about 1.2 px per unit) keeps 13 px labels
    var back = S.el('g', { class: 'mx-back' }), frontL = S.el('g', { class: 'mx-front' }), top = S.el('g', { class: 'mx-top' }), marks = S.el('g', { class: 'mx-marks' });
    st.parts = { gears: {}, pulleys: {}, belts: [], rope: null, weight: null, rings: {} };
    item.wheels.forEach(function (w) {
      var ax = m.axles[w.axle];
      if (w.kind === 'gear') {
        var d = drawGear(w, ax, m.phase[w.id] || 0);
        (w.layer === 0 ? back : frontL).appendChild(d.g);
        st.parts.gears[w.id] = d;
      }
    });
    // Belts under their pulleys' rims: the two straight runs, then the rims drawn as wrapped.
    item.belts.forEach(function (b, i) {
      var A = m.wheels[b.a], B = m.wheels[b.b], pa = m.axles[A.axle], pb = m.axles[B.axle];
      var runs = lib.beltRuns(pa.x, pa.y, A.r, pb.x, pb.y, B.r, b.crossed);
      var g = S.el('g', { class: 'mx-belt' + (b.crossed ? ' is-crossed' : ''), 'data-belt': i });
      var lines = runs.map(function (r) { return S.el('line', { class: 'mx-run', x1: r[0], y1: r[1], x2: r[2], y2: r[3] }); });
      lines.forEach(function (l) { g.appendChild(l); });
      top.appendChild(g);
      st.parts.belts.push({ g: g, runs: runs, lines: lines, a: A, b: B });
    });
    item.wheels.forEach(function (w) {
      if (w.kind === 'gear') return;
      var d = drawPulley(w, m.axles[w.axle]);
      top.appendChild(d.g);
      st.parts.pulleys[w.id] = d;
    });
    item.belts.forEach(function (b) {
      [b.a, b.b].forEach(function (id) {
        var w = m.wheels[id], ax = m.axles[w.axle];
        top.appendChild(S.el('circle', { class: 'mx-wrap', cx: ax.x, cy: ax.y, r: w.r + 0.45 }));
      });
    });
    if (item.rope) {
      var dw = m.wheels[item.rope.wheel], tax = m.axles[dw.axle], wt = item.rope.weight;
      var rope = S.el('line', { class: 'mx-rope', x1: wt[0], y1: tax.y, x2: wt[0], y2: wt[1] });
      var weight = S.el('g', { class: 'mx-weight', transform: 'translate(0 0)' });
      weight.appendChild(S.el('rect', { x: wt[0] - wt[2] / 2, y: wt[1], width: wt[2], height: wt[3], rx: 1 }));
      weight.appendChild(S.el('line', { class: 'mx-weight-mark', x1: wt[0] - wt[2] / 2 + 2, y1: wt[1] + wt[3] / 2, x2: wt[0] + wt[2] / 2 - 2, y2: wt[1] + wt[3] / 2 }));
      top.appendChild(rope);
      top.appendChild(weight);
      st.parts.rope = rope;
      st.parts.weight = weight;
    }
    // Axle pins on top of everything.
    item.axles.forEach(function (a) { marks.appendChild(S.el('circle', { class: 'mx-pin', cx: a.x, cy: a.y, r: 1.1 })); });
    // The driver: arrow + label; the marked part: dashed ring + label (and the weight for lift).
    var dax = m.axles[item.driver.axle], dr = Math.max.apply(null, m.byAxle[item.driver.axle].map(function (w) { return w.r; }));
    marks.appendChild(turnArrow(dax, dr, item.driver.dir));
    var tax2 = m.axles[item.target], tr = Math.max.apply(null, m.byAxle[item.target].map(function (w) { return w.r; }));
    var ring = S.el('circle', { class: 'mx-ring', cx: tax2.x, cy: tax2.y, r: tr + TOOTH + 1.6 });
    marks.appendChild(ring);
    st.parts.rings.target = ring;
    var tname = item.rope ? 'DRUM' : 'MARKED';
    var R = dr + TOOTH + 3.2, arrowBox = [dax.x, dax.y - R + 1.2, 1.7 * R, 4.4]; // the turning arrow over the driver
    // The weight's label first (beside the weight), then DRIVER and MARKED/DRUM keep clear of it
    // and of each other: no two labels ever overlap.
    var lw = item.rope ? weightSpot(item) : null, keep = lw ? [arrowBox, lw] : [arrowBox];
    var ls = labelSpot(item, dax, dr, 'DRIVER', keep), lt = labelSpot(item, tax2, tr, tname, keep.concat([ls]));
    st.labels = { driver: label(ls[0], ls[1], 'DRIVER', 'mx-label--driver'), marked: label(lt[0], lt[1], tname, 'mx-label--marked') };
    marks.appendChild(st.labels.driver);
    marks.appendChild(st.labels.marked);
    if (lw) {
      st.labels.weight = label(lw[0], lw[1], 'WEIGHT', 'mx-label--weight');
      marks.appendChild(st.labels.weight);
    }
    [back, frontL, top, marks].forEach(function (g) { svg.appendChild(g); });
    st.hl = S.el('g', { class: 'mx-highlights' });
    svg.appendChild(st.hl);
  }

  /* ---------- motion and highlights (show me, demo) ---------- */

  // Turn everything as the solver says, for a driver angle of thetaDeg (+ = the driver's way).
  function setTurn(item, thetaDeg) {
    var m = st.model, th = thetaDeg * item.driver.dir, rad = th / DEG;
    Object.keys(st.parts.gears).concat(Object.keys(st.parts.pulleys)).forEach(function (id) {
      var part = st.parts.gears[id] || st.parts.pulleys[id], w = m.wheels[id];
      part.rot.setAttribute('transform', 'rotate(' + U.round(turnOf(m, item, w.axle) * thetaDeg, 3) + ')');
    });
    // Belt runs: dashes travel with the rim of the pulley they leave (v = ω × r, y down).
    st.parts.belts.forEach(function (b) {
      var A = m.axles[b.a.axle], tA = turnOf(m, item, b.a.axle);
      b.lines.forEach(function (line, k) {
        var r = b.runs[k], ux = r[2] - r[0], uy = r[3] - r[1], L = Math.sqrt(ux * ux + uy * uy) || 1;
        var vx = -tA * (r[1] - A.y), vy = tA * (r[0] - A.x), along = (vx * ux + vy * uy) / L;
        line.style.strokeDashoffset = String(U.round(-along * thetaDeg / DEG, 3));
      });
    });
    if (st.parts.rope) {
      var dw = m.wheels[item.rope.wheel], tax = m.axles[dw.axle], wt = item.rope.weight;
      var vDown = turnOf(m, item, dw.axle) * (item.rope.side === 'left' ? -dw.r : dw.r);
      var dy = U.clamp(vDown * thetaDeg / DEG, -(item.rope.length - 6), item.H - 3 - wt[3] - wt[1]);
      st.parts.rope.setAttribute('y2', U.round(wt[1] + dy, 3));
      st.parts.weight.setAttribute('transform', 'translate(0 ' + U.round(dy, 3) + ')');
    }
    void rad;
  }
  function clearMarks(item) {
    PX.ui.clear(st.hl);
    Object.keys(st.labels).forEach(function (k) { st.labels[k].classList.remove('is-pointed'); });
    focusOption(-1);
    if (item) setTurn(item, 0);
  }
  function pointLabel(name) { if (st.labels[name]) st.labels[name].classList.add('is-pointed'); }
  function ringAxles(ids, cls) {
    var m = st.model;
    ids.forEach(function (id) {
      var r = Math.max.apply(null, m.byAxle[id].map(function (w) { return w.r; }));
      st.hl.appendChild(S.el('circle', { class: 'mx-hl ' + (cls || ''), cx: m.axles[id].x, cy: m.axles[id].y, r: r + TOOTH + 2.4 }));
    });
  }
  function focusOption(i) {
    (st.opts || []).forEach(function (o, j) { var cell = o && o.closest ? o.closest('.px-choice') : null; if (cell) cell.classList.toggle('ex-focus', j === i); });
  }

  /* ---------- the countdown bar ---------- */

  function timerStart(item) {
    var ms = def.timeLimit(item.params);
    st.timer.hidden = !ms;
    st.timer.classList.remove('is-running', 'is-stopped');
    if (!ms) return;
    st.timerFill.style.animationDuration = ms + 'ms';
    void st.timerFill.offsetWidth; // restart the animation for the new item
    st.timer.classList.add('is-running');
  }
  function timerStop() { if (st) st.timer.classList.add('is-stopped'); }

  /* ---------- view functions ---------- */

  function optionText(item, i) { var t = item.options[i]; return t.charAt(0).toUpperCase() + t.slice(1); }
  function question(item) { return (learn().questions || {})[item.question] || ''; }
  function describe(item) {
    var ms = def.timeLimit(item.params), gears = item.wheels.filter(function (w) { return w.kind === 'gear'; }).length;
    return 'A mechanism with ' + gears + ' gears' + (item.belts.length ? ' and ' + item.belts.length + (item.belts.length > 1 ? ' belts' : ' belt') : '') +
      (item.rope ? ', and a weight on a rope' : '') + '. The driver turns ' + dirWord(item.driver.dir) + '. ' + question(item) + ' ' +
      item.options.map(function (o, i) { return (i + 1) + ': ' + o; }).join(', ') + (ms ? '; up to ' + Math.round(ms / 1000) + ' seconds.' : '.');
  }

  function mount(ctx) {
    var svg = S.svg(200, 140, { class: 'mx-svg', 'aria-hidden': 'true', focusable: 'false' });
    var verdict = h('div.ex-verdict.mx-verdict', { hidden: true, role: 'status' });
    var stage = h('div.ex-stage.mx-stage', h('span.ex-label', 'Mechanism'), svg, verdict);
    var q = h('p.mx-question');
    var timer = h('div.pr-timer', { 'aria-hidden': 'true', hidden: true }, h('div.pr-timer-fill'));
    var caption = h('p.ex-caption', { 'aria-live': 'polite' }), desc = h('p.px-sr');
    var root = h('div.ex-mechanisms-stem', q, stage, timer, caption, desc);
    ctx.host.appendChild(root);
    st = { ctx: ctx, root: root, svg: svg, stage: stage, q: q, verdict: verdict, timer: timer, timerFill: timer.firstChild,
      caption: caption, desc: desc, item: null, model: null, opts: [], labels: {}, parts: null, hl: null };
  }
  function newItem(item) {
    st.item = item;
    st.opts = [];
    st.model = modelOf(item);
    drawItem(item);
  }

  function present(item, ctx) {
    if (!st) mount(ctx);
    if (st.item !== item) newItem(item);
    st.root.classList.remove('is-revealed');
    st.verdict.hidden = true;
    st.verdict.textContent = '';
    st.caption.textContent = '';
    st.q.textContent = question(item);
    st.desc.textContent = describe(item);
    clearMarks(item);
    timerStart(item);
    return timing.nextPaint();
  }

  // Answer icons: the meaning is in the shape (arrow, bar, chevrons), never in colour.
  var ICONS = {
    // The driver arrow's convention: the head sits at the END of the arc and points the way the
    // motion goes. cw: from 310° round by 300° to 250°, head moving right at the top (clockwise).
    cw: 'M23.86 5.4A6 6 0 1 1 17.95 4.36M14.9 3.37L17.95 4.36L16.25 7.08',
    ccw: 'M16.14 5.4A6 6 0 1 0 22.05 4.36M23.75 7.08L22.05 4.36L25.1 3.37',
    jam: 'M26 10A6 6 0 1 1 14 10A6 6 0 1 1 26 10M15.8 5.8l8.4 8.4',
    up: 'M20 16V4M15.5 8.5L20 4l4.5 4.5',
    down: 'M20 4v12M15.5 11.5L20 16l4.5-4.5',
    faster: 'M11 4l6 6-6 6M19 4l6 6-6 6',
    same: 'M13 7.5h14M13 12.5h14',
    slower: 'M17 4l6 6-6 6',
  };
  function drawOption(el, item, i, ctx) {
    if (!st) mount(ctx);
    if (st.item !== item) newItem(item);
    var svg = S.svg(40, 20, { width: 40, height: 20, class: 'ex-glyph mx-glyph', 'aria-hidden': 'true' });
    svg.appendChild(S.el('path', { d: ICONS[item.answers[i]] || '', class: 'ex-glyph-a' }));
    var box = h('span.ex-answer.mx-answer', svg, h('span.ex-answer-text', optionText(item, i)));
    el.appendChild(box);
    st.opts[i] = box;
  }
  function optionLabel(item, i) { return optionText(item, i); }
  function gridCols() { return 3; }

  /* ---------- reveal (development; the Check shows nothing), ≤ 700 ms ---------- */

  function verdictText(item) {
    var a = item.answers[item.key], w = st.model.res.omega[item.target];
    var why = a === 'jam' ? ' (a loop with an odd number of gears)' : item.question === 'speed' ? ' (' + w.n + ' turns for every ' + w.d + ' of the driver)' : '';
    return optionText(item, item.key) + why;
  }
  function reveal(item, response, result, ctx) {
    if (!st) return Promise.resolve();
    timerStop();
    st.root.classList.add('is-revealed');
    st.verdict.textContent = (result && result.correct ? '✓ ' : '→ ') + verdictText(item);
    st.verdict.setAttribute('data-kind', 'same');
    st.verdict.hidden = false;
    var odd = (st.model.res.cycles || []).filter(function (c) { return c.odd; })[0];
    if (odd) ringAxles(odd.axles, 'is-jam');
    return timing.wait(ctx && ctx.fast ? 0 : 250);
  }

  /* ---------- show me and the worked example ---------- */

  function runSteps(list, ctx, opts) { // minimal runner when the player has no ctx.play
    var scale = ctx && ctx.fast ? 0.02 : 1;
    return new Promise(function (resolve) {
      var i = -1, start = 0, go = true;
      function begin(now) {
        i++;
        if (i >= list.length) { resolve(); return false; }
        start = now;
        if (list[i].caption && opts.caption) opts.caption(list[i].caption);
        if (list[i].enter) list[i].enter();
        return true;
      }
      timing.loop(function (dt, now) {
        if (go) { go = false; if (!begin(now)) return false; }
        var s = list[i], k = U.clamp((now - start) / Math.max(1, s.ms * scale), 0, 1);
        if (s.update) s.update(k);
        if (k >= 1) { if (s.exit) s.exit(); if (!begin(now)) return false; }
        return true;
      });
    });
  }
  function play(list, ctx, opts) {
    var o = opts || {};
    if (!o.caption) o.caption = function (text) { if (st) st.caption.textContent = text; };
    if (ctx && typeof ctx.play === 'function') return ctx.play(list, o);
    return runSteps(list, ctx, o);
  }

  // The worked solution as steps, from the solver's model: the driver, then each link of the
  // route with the rule it applies (or the odd loop that jams it), the rope, the whole mechanism
  // turning, and the answer. slow: the instruction's pace (longer steps, plus marked and keys).
  function solutionSteps(item, slow) {
    var m = st.model, res = m.res, steps = [], f = slow ? 1.6 : 1;
    function reset() { clearMarks(item); }
    steps.push({ ms: 1300 * f, caption: cap('driver', { dir: dirWord(item.driver.dir) }), enter: function () { reset(); pointLabel('driver'); ringAxles([item.driver.axle], 'is-on'); } });
    if (slow) steps.push({ ms: 1800, caption: cap('marked'), enter: function () { reset(); pointLabel('marked'); if (item.rope) pointLabel('weight'); ringAxles([item.target], 'is-on'); } });
    if (res.jam) {
      var odd = (res.cycles || []).filter(function (c) { return c.odd; })[0] || { axles: [] };
      steps.push({
        ms: 2600, caption: cap('jam'),
        enter: function () { reset(); ringAxles(odd.axles, 'is-jam'); },
        update: function (k) { setTurn(item, 3 * Math.sin(k * TAU * 2)); }, // the driver strains, nothing turns
        exit: function () { setTurn(item, 0); },
      });
      steps.push({ ms: 1600 * f, caption: cap('answerJam', { answer: item.options[item.key] }), enter: function () { reset(); ringAxles(odd.axles, 'is-jam'); focusOption(item.key); } });
    } else {
      var seen = {};
      m.route.forEach(function (link) {
        var turn = turnOf(m, item, link.to), kind = link.kind;
        steps.push({
          ms: 1000 * f, caption: cap(kind, { dir: dirWord(turn) }),
          enter: function () { reset(); ringAxles([link.from, link.to], 'is-on'); },
        });
        if (link.to !== item.target && m.byAxle[link.to].length > 1 && !seen.axle) {
          seen.axle = true;
          steps.push({ ms: 1100 * f, caption: cap('axle'), enter: function () { reset(); ringAxles([link.to], 'is-on'); } });
        }
      });
      (res.cycles || []).filter(function (c) { return !c.odd; }).slice(0, 1).forEach(function (c) {
        steps.push({ ms: 1400 * f, caption: cap('evenLoop'), enter: function () { reset(); ringAxles(c.axles, 'is-on'); } });
      });
      var turnT = turnOf(m, item, item.target);
      if (item.rope) {
        var reel = (item.rope.side === 'left' ? -1 : 1) * turnT < 0;
        steps.push({ ms: 1700 * f, caption: cap('rope', { side: item.rope.side, dir: dirWord(turnT), action: cap(reel ? 'reel' : 'payOut') }), enter: function () { reset(); pointLabel('weight'); ringAxles([item.target], 'is-on'); } });
      }
      steps.push({
        ms: 3000, caption: cap('watch'),
        enter: function () { reset(); },
        update: function (k) { setTurn(item, k * 3 * DRIVE_DEG_PER_S); }, // 3 s at the driver's speed
      });
      var w = res.omega[item.target], key = item.question === 'speed' ? 'answerSpeed' : item.question === 'lift' ? 'answerLift' : 'answerDir';
      steps.push({ ms: 1600 * f, caption: cap(key, { answer: item.options[item.key], n: w.n, d: w.d }), enter: function () { focusOption(item.key); } });
    }
    // The instruction's pace adds how to answer, before the answer: the example ends on its answer.
    if (slow) steps.splice(steps.length - 1, 0, { ms: 1500, caption: cap('keys'), enter: function () { reset(); } });
    return steps;
  }

  function showMe(item, response, ctx) {
    if (!st || st.item !== item) return Promise.resolve();
    return play(solutionSteps(item, false), ctx, { name: 'show-me' }).then(function () { if (st) clearMarks(item); });
  }

  // The one-screen instruction's worked example (learn.demo: a fixed seed the Check never scores).
  function demo(item, ctx, caption) {
    if (!st || st.item !== item) return Promise.resolve();
    timerStop();
    // It ends as it finished: the answer stated in the caption and its option marked.
    return play(solutionSteps(item, true), ctx, { name: 'demo', caption: caption || null }).then(function () { if (st) { clearMarks(item); focusOption(item.key); } });
  }

  function unmount() {
    if (!st) return;
    if (st.root.parentNode) st.root.parentNode.removeChild(st.root);
    st = null;
  }

  PX.ex.view('mechanisms', {
    layout: 'stem+options',
    css: true,
    mount: mount,
    present: present,
    drawOption: drawOption,
    optionLabel: optionLabel,
    gridCols: gridCols,
    reveal: reveal,
    showMe: showMe,
    demo: demo,
    unmount: unmount,
    // for tests: the steps show me would play, and the tooth phases
    steps: function (item, slow) { return st && st.item === item ? solutionSteps(item, !!slow) : []; },
    model: function () { return st ? st.model : null; },
  });
})(window.PX);
