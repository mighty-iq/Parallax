/* EX-18 Painted Cubes: view (SVG; ARCHITECTURE.md §6, docs/dev/EXERCISE-GUIDE.md).
   layout 'stem+options': the stem is the figure, drawn from the item's height map with the
   generator's own camera (lib.proj, lib.facesOf: a parallel projection from the front right),
   faces in three tones with outlines (colour never the only cue), and the question with N in
   large type; the options are the counts 1–5.
   - Drawing order: cubes far to near (ascending x + y + z: with the viewer at +x, +y, +z a cube
     can only hide cubes that are behind it in all three directions), each cube's exposed top,
     front and right faces. Cubes carry no marks (Cube Match's format stays with the probe).
   - A cube's number is its count of painted sides (lib.cubesOf: the same neighbour tests the
     validator recounts). Badges: a number in ink; a cube counted for the question in the accent
     with a ring (shape as well as colour); '?' on a cube left to the player; hidden cubes as
     dashed ghost cubes with dashed badges.
   - v1.2 (docs/research/v1.2/D2-first-band.md §3.3, CONTRACT-v1.2 D): Try 1's first step done
     (ctx.assist = { numbers: 2 }: every cube's number but two, which show '?'); rule figures
     (drawRule: a touching face bare, a cube under another, a hidden support); show me carries out
     the "Count by position" card on the item, its captions numbered by the card's steps: the
     figure pulled apart (faces that touch another cube bare, hatched), every cube's number (on a
     flat figure 5 minus the cubes it touches), then the cubes with the number asked, one at a
     time, hidden ones included. Reveal rings the counted cubes with their number.
   - Demo (Watch): the figure, its hidden cubes as dashed ghosts when it has any, the answers,
     then show me's steps, each caption up long enough to read (readable()).
   - Try 3 (ctx.assist = { hidden: true }): the hidden support drawn dashed, without its number,
     between the worked example (dashed and numbered) and Try 4 (nothing marked); its reveal
     numbers it. Try 4 and Try 5 ask the two questions of one figure in the test's plain drawing
     (learn.practice gives params.ask): the set row says "Question 1 of 2" with the tally, and a caption
     at the first question says what the tally is for.
   - Badges (fresh-player run, 19 Nov): each on the most interior point of its cube's visible faces
     (lib.render's raster), sized to sit inside a face; a numbered hidden cube's dashed outline is
     veiled, its number at its centre, and the other badges keep out of the veil.
   - Version 3 (PLAN milestone 8; note D1 §6.1, §6.3): answers lettered A–E for 1–5 cubes
     (optionKeys 'letters'; captions name them through ctx.optionName); the format's plain line
     drawing in the test range (white faces, ink edges, on a white plate in both themes; CONTRACT-v1.2
     W2), the three face tones kept for the starter band (flat figures, 4–6 cubes), the rule figures
     and show me; a figure with several questions keeps its drawing from one question to the next
     and shows a set row: "Question 2 of 3" (ctx.set; Section practice says "Same figure") and an
     optional tally pad (O12): six counters, 0–5 painted sides, a tap adds one, Clear empties them,
     kept for the figure's questions and emptied for a new figure. On phones the figure gives the
     set row and the open pad their height, so the answers never move. */
(function (PX) {
  'use strict';

  var timing = PX.core.timing, U = PX.util, S = PX.core.svg;
  var h = PX.ui.h;
  var def = PX.ex.get('cubes'), lib = def.lib;
  var SIDES = ['top', 'front', 'right', 'back', 'left'];
  var SPREAD = 1.4; // pulled apart: cube origins 1.4 edges apart, so touching faces show in the gaps
  var st = null, uid = 0;

  function learn() { return PX.ex.learn('cubes') || {}; }
  function cap(key, vars) {
    var s = String((learn().captions || {})[key] || '');
    Object.keys(vars || {}).forEach(function (k) { s = s.split('{' + k + '}').join(String(vars[k])); });
    return s;
  }
  function plural(n, one, many) { return n + ' ' + (n === 1 ? one : many); }
  // The Watch and worked examples (v1.2, fresh-player check: at the 3-s floor a 20-word caption was
  // gone before it was read): a caption stays up for 1 s plus 0.27 s a word (about 220 words a
  // minute), at most 8 s; a step that moves keeps its pace and holds its last frame. step.read, when
  // set, is the part of the caption that is new (the tally's next cube). Show me keeps its pace: it
  // replays steps already read, with Pause and Step.
  function readMs(text) {
    var n = String(text || '').split(/\s+/).filter(function (w) { return /[0-9A-Za-z]/.test(w); }).length;
    return Math.min(8000, 1000 + 270 * n);
  }
  function readable(list) {
    list.forEach(function (s) {
      if (!s || !s.caption) return;
      var m = s.ms || 0, need = readMs(s.read || s.caption), u = s.update;
      if (m >= need) return;
      s.ms = need;
      if (u && m > 0) s.update = function (k) { u(Math.min(1, k * need / m)); };
    });
    return list;
  }
  function tallest(H) { var m = 0; H.forEach(function (r) { r.forEach(function (v) { if (v > m) m = v; }); }); return m; }

  /* ---------- geometry ---------- */

  function pt(P) { return lib.proj(P); }
  // Corners of a face (side 0 top, 1 front, 2 right) of the unit cube whose corner is at o.
  function faceAt(o, side) {
    var x = o[0], y = o[1], z = o[2];
    if (side === 0) return [[x, y + 1, z], [x + 1, y + 1, z], [x + 1, y + 1, z + 1], [x, y + 1, z + 1]].map(pt);
    if (side === 1) return [[x, y, z + 1], [x + 1, y, z + 1], [x + 1, y + 1, z + 1], [x, y + 1, z + 1]].map(pt);
    return [[x + 1, y, z], [x + 1, y, z + 1], [x + 1, y + 1, z + 1], [x + 1, y + 1, z]].map(pt);
  }
  function origin(q, s) { return [q.x * s, q.y * s, q.z * s]; }
  // The figure's bounds (every cube corner at spread s), padded: [x, y, w, h] for the viewBox.
  function bounds(cubes, s) {
    var b = [Infinity, Infinity, -Infinity, -Infinity];
    cubes.forEach(function (q) {
      var o = origin(q, s);
      for (var i = 0; i < 8; i++) {
        var c = pt([o[0] + (i & 1), o[1] + ((i >> 1) & 1), o[2] + ((i >> 2) & 1)]);
        b[0] = Math.min(b[0], c[0]); b[1] = Math.min(b[1], c[1]); b[2] = Math.max(b[2], c[0]); b[3] = Math.max(b[3], c[1]);
      }
    });
    var m = 0.35;
    return [b[0] - m, b[1] - m, b[2] - b[0] + 2 * m, b[3] - b[1] + 2 * m];
  }

  /* ---------- drawing ---------- */

  // A hatch for bare (unpainted) faces: light ground, dark diagonal lines (shape, not colour alone).
  function hatchDef(svg) {
    var id = 'ex-cubes-hatch-' + (++uid), w = 0.16;
    var pat = S.el('pattern', { id: id, patternUnits: 'userSpaceOnUse', width: w, height: w, patternTransform: 'rotate(45)' });
    pat.appendChild(S.el('rect', { width: w, height: w, class: 'ex-cubes-bare-bg' }));
    pat.appendChild(S.el('line', { x1: 0.04, y1: 0, x2: 0.04, y2: w, class: 'ex-cubes-bare-line' }));
    svg.appendChild(S.el('defs', null, pat));
    return id;
  }
  // The figure of height map H at spread s. s = 1: the exposed top, front and right faces (the
  // others are covered by a neighbour). s > 1 (pulled apart): every top, front and right face, a
  // face that touches another cube bare.
  function figureSvg(H, s, cls) {
    var cubes = lib.cubesOf(H), vb = bounds(cubes, s);
    var svg = S.svg(vb[2], vb[3], { viewBox: vb, class: cls || 'ex-cubes-svg', width: '100%' });
    var hatch = s > 1 ? hatchDef(svg) : null;
    var order = cubes.map(function (q, i) { return i; }).sort(function (a, b) {
      var qa = cubes[a], qb = cubes[b];
      return (qa.x + qa.y + qa.z) - (qb.x + qb.y + qb.z) || qa.y - qb.y || a - b;
    });
    var g = S.el('g', { class: 'ex-cubes-figure' });
    order.forEach(function (i) {
      var q = cubes[i], o = origin(q, s);
      for (var f = 0; f < 3; f++) {
        var bare = !q.sides[f];
        if (bare && !hatch) continue;
        g.appendChild(S.path(faceAt(o, f), true, bare ? { class: 'ex-cubes-face ex-cubes-face--bare', style: 'fill:url(#' + hatch + ')' } : { class: 'ex-cubes-face ex-cubes-face--' + SIDES[f] }));
      }
    });
    svg.appendChild(g);
    svg.appendChild(S.el('g', { class: 'ex-cubes-marks' }));
    return { svg: svg, cubes: cubes, vb: vb };
  }
  // A cube outlined as a dashed ghost, for the hidden supports: the 9 edges a solid cube shows from the
  // figure's viewpoint (v1.2 O56: the 3 edges at its far corner, corner 0, made the overlay busy on a phone).
  // veil: when the ghost carries a number, its outline is filled with a light veil, so the number reads as
  // the hidden cube's and the joins of the cubes in front fade under it (fresh-player run, 19 Nov: a hidden
  // cube's number sat where four cubes meet).
  function corners(q) {
    var c = [];
    for (var i = 0; i < 8; i++) c.push(pt([q.x + (i & 1), q.y + ((i >> 1) & 1), q.z + ((i >> 2) & 1)]));
    return c;
  }
  // The outline of a cube in the picture: the convex hull of its eight corners (a hexagon), counter-clockwise.
  function hull(q) {
    var P = corners(q).slice().sort(function (a, b) { return a[0] - b[0] || a[1] - b[1]; });
    var cross = function (o, a, b) { return (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]); };
    var lo = [], up = [], i;
    for (i = 0; i < P.length; i++) { while (lo.length >= 2 && cross(lo[lo.length - 2], lo[lo.length - 1], P[i]) <= 1e-12) lo.pop(); lo.push(P[i]); }
    for (i = P.length - 1; i >= 0; i--) { while (up.length >= 2 && cross(up[up.length - 2], up[up.length - 1], P[i]) <= 1e-12) up.pop(); up.push(P[i]); }
    return lo.slice(0, -1).concat(up.slice(0, -1));
  }
  function ghost(q, veil) {
    var c = corners(q);
    var E = [[2, 3], [4, 5], [6, 7], [1, 3], [4, 6], [5, 7], [1, 5], [2, 6], [3, 7]];
    var d = E.map(function (e) { return 'M' + c[e[0]][0] + ' ' + c[e[0]][1] + 'L' + c[e[1]][0] + ' ' + c[e[1]][1]; }).join('');
    var path = S.el('path', { d: d, class: 'ex-cubes-ghost' });
    if (!veil) return path;
    var g = S.el('g', { class: 'ex-cubes-ghost-g' });
    g.appendChild(S.path(hull(q), true, { class: 'ex-cubes-veil' }));
    g.appendChild(path);
    return g;
  }
  // Inside a convex outline, or within pad of it.
  function nearHull(poly, X, Y, pad) {
    var inside = true, n = poly.length, i;
    for (i = 0; i < n; i++) {
      var a = poly[i], b = poly[(i + 1) % n];
      if ((b[0] - a[0]) * (Y - a[1]) - (b[1] - a[1]) * (X - a[0]) < 0) { inside = false; break; }
    }
    if (inside || !(pad > 0)) return inside;
    for (i = 0; i < n; i++) {
      var p = poly[i], q2 = poly[(i + 1) % n], dx = q2[0] - p[0], dy = q2[1] - p[1], L2 = dx * dx + dy * dy || 1;
      var t = Math.max(0, Math.min(1, ((X - p[0]) * dx + (Y - p[1]) * dy) / L2)), ex = p[0] + t * dx - X, ey = p[1] + t * dy - Y;
      if (ex * ex + ey * ey < pad * pad) return true;
    }
    return false;
  }
  // The most interior point of face fi's visible pixels (lib.render's raster), leaving out the pixels
  // where off(x, y) holds: { at: [x, y], clear: distance to the region's edge, in cube edges } or null.
  function facePoint(rr, fi, off) {
    var im = rr.img, s = im.scale, f = rr.faces[fi], SQ2 = Math.SQRT2;
    var bx0 = Math.max(0, Math.floor((f.box[0] - im.x0) * s) - 1), bx1 = Math.min(im.W - 1, Math.ceil((f.box[2] - im.x0) * s) + 1);
    var by0 = Math.max(0, Math.floor((f.box[1] - im.y0) * s) - 1), by1 = Math.min(im.H - 1, Math.ceil((f.box[3] - im.y0) * s) + 1);
    var w = bx1 - bx0 + 3, hh = by1 - by0 + 3, d = new Float64Array(w * hh), any = false, px, py, k;
    for (py = by0; py <= by1; py++) {
      for (px = bx0; px <= bx1; px++) {
        var on = im.own[py * im.W + px] === fi;
        if (on && off && off(im.x0 + (px + 0.5) / s, im.y0 + (py + 0.5) / s)) on = false;
        d[(py - by0 + 1) * w + (px - bx0 + 1)] = on ? 1e9 : 0;
        if (on) any = true;
      }
    }
    if (!any) return null;
    for (py = 1; py < hh - 1; py++) for (px = 1; px < w - 1; px++) {
      k = py * w + px;
      if (d[k] === 0) continue;
      d[k] = Math.min(d[k], d[k - 1] + 1, d[k - w] + 1, d[k - w - 1] + SQ2, d[k - w + 1] + SQ2);
    }
    var best = -1, bk = -1;
    for (py = hh - 2; py >= 1; py--) for (px = w - 2; px >= 1; px--) {
      k = py * w + px;
      if (d[k] === 0) continue;
      d[k] = Math.min(d[k], d[k + 1] + 1, d[k + w] + 1, d[k + w + 1] + SQ2, d[k + w - 1] + SQ2);
      if (d[k] > best) { best = d[k]; bk = k; }
    }
    var gx = bk % w, gy = Math.floor(bk / w);
    // the distance runs to the centre of the first pixel outside: half a pixel less to the region's edge
    return { at: [im.x0 + (gx - 1 + bx0 + 0.5) / s, im.y0 + (gy - 1 + by0 + 0.5) / s], clear: Math.max(0, best - 0.5) / s };
  }
  // Where a cube's badge goes and how large: a hidden cube's at its centre, inside its veiled outline; a
  // seen cube's on the most interior point of its faces' visible parts, outside the veils where a badge
  // fits there and clear of the badges placed before it, as large as the spot allows (between BADGE_MIN
  // and BADGE_R), so every badge sits on its own cube and never on a join. Ties: the front face, then the top.
  var BADGE_R = 0.22, BADGE_MIN = 0.15, RING_D = 0.07, HID_K = 0.88, FACE_PREF = [0.01, 0.02, 0];
  // A number is never under DIGIT_PX on the screen (v1.2, W1-band-B's phones.py run of 22 Nov: 9.7 px at 360 × 640,
  // the cramped spots' badges of a large figure): where the figure is drawn small, the digits keep DIGIT_PX and the
  // discs the least that holds them (DIGIT_FIT of the digit's size), so a badge grows only as much as its digit
  // needs and the placement plans for that size. floor: { font, r } in cube edges for the figure on the screen now
  // (0 where it is not laid out, as in node).
  var DIGIT_PX = 13.5, DIGIT_FIT = 0.58, floor = { font: 0, r: 0 };
  function digitFloor() {
    // the drawing's own scale on the screen (its CTM: a figure bounded by its height is drawn smaller than its width says)
    var svg = st.fig && st.fig.svg, m = svg && svg.getScreenCTM ? svg.getScreenCTM() : null;
    var s = m ? Math.sqrt(Math.abs(m.a * m.d - m.b * m.c)) : 0, f = s > 0 ? DIGIT_PX / s : 0;
    return { font: f, r: f * DIGIT_FIT };
  }
  function placeOf(c, veils, discs) {
    var q = c.q, rMin = Math.max(BADGE_MIN, floor.r), rMax = Math.max(BADGE_R, rMin);
    if (c.hidden) return { at: pt([q.x + 0.5, q.y + 0.5, q.z + 0.5]), r: Math.max(BADGE_R * HID_K, floor.r) };
    var rr = st.rr;
    // clear of the badges placed so far (the hidden cubes' first): the distance to the region's edge then
    // bounds this badge's size, so the two never overlap
    var nearHid = function (X, Y) {
      for (var j = 0; j < discs.length; j++) { var dx = X - discs[j].at[0], dy = Y - discs[j].at[1], g = discs[j].r + rMin + 0.02; if (dx * dx + dy * dy < g * g) return true; }
      return false;
    };
    var inVeil = function (pad) {
      return function (X, Y) { if (nearHid(X, Y)) return true; for (var a = 0; a < veils.length; a++) if (nearHull(veils[a], X, Y, pad)) return true; return false; };
    };
    // out of the veils with a margin, then out of them, then anywhere clear of the other badges, then anywhere:
    // the first tier where a badge of the smallest size fits; else (v1.2, 22 Nov: a seen cube's top beside a hidden
    // badge took a spot over it) the roomiest spot clear of the other badges at the smallest size (every point there
    // lies at least the smallest size from them, so the two never overlap); else the roomiest spot of all tiers
    var tiers = [inVeil(0.08), inVeil(0), nearHid, null], roomiest = null;
    for (var t = 0; t < tiers.length; t++) {
      if (t === 3 && roomiest) return { at: roomiest.at, r: rMin };
      var best = null;
      for (var fi = 0; fi < rr.faces.length; fi++) {
        var f = rr.faces[fi];
        if (f.cube !== c.i) continue;
        var r = facePoint(rr, fi, tiers[t]);
        if (!r) continue;
        var score = r.clear + FACE_PREF[f.side];
        if (!best || score > best.score) best = { at: r.at, score: score, clear: r.clear };
      }
      if (best && best.clear >= rMin) return { at: best.at, r: Math.min(rMax, best.clear) };
      if (best && (!roomiest || best.clear > roomiest.clear + 1e-9)) roomiest = best;
    }
    if (roomiest) return { at: roomiest.at, r: rMin };
    var f0 = faceAt([q.x, q.y, q.z], 0);
    return { at: [(f0[0][0] + f0[2][0]) / 2, (f0[0][1] + f0[2][1]) / 2], r: rMin };
  }
  // A badge (v1.2 fresh-player run: sized to sit inside its face; a hidden cube's a little smaller, dashed).
  // kind: 'number' (ink), 'count' (counted for the question: the accent and a ring), 'unknown' ('?').
  function badge(c, text, kind, place) {
    var at = place.at, r = place.r, k = r / BADGE_R;
    var g = S.el('g', { class: 'ex-cubes-badge ex-cubes-badge--' + kind + (c.hidden ? ' is-hidden' : ''), 'data-cube': String(c.i) });
    if (kind === 'count') g.appendChild(S.el('circle', { cx: at[0], cy: at[1], r: r + RING_D, class: 'ex-cubes-ring' }));
    g.appendChild(S.el('circle', { cx: at[0], cy: at[1], r: r }));
    // S.text centres the em box on y (dominant-baseline central), which centres a digit within 0.01 edge
    var t = S.text(at[0], at[1], String(text), { class: 'ex-cubes-badge-n' }), base = c.hidden ? 0.26 : 0.29;
    var font = Math.max(c.hidden ? base : base * Math.min(k, 1), floor.font); // never under DIGIT_PX on the screen
    if (Math.abs(font - base) > 1e-6) t.style.fontSize = font.toFixed(3) + 'px';
    g.appendChild(t);
    return g;
  }
  function marks() { var m = st.fig.svg.querySelector('.ex-cubes-marks'); PX.ui.clear(m); return m; }

  // Every cube with what the steps need, in tally order: column by column from the back left,
  // each column from the top down (as the card goes).
  function cubeList(item) {
    if (st.list && st.listItem === item) return st.list;
    var rr = st.rr = lib.render(item.heights), out = [];
    rr.cubes.forEach(function (q, i) { out.push({ q: q, i: i, vis: rr.perCube[i], hidden: rr.perCube[i].any === 0, counted: q.painted === item.ask }); });
    out.sort(function (a, b) { return a.q.z - b.q.z || a.q.x - b.q.x || b.q.y - a.q.y; });
    st.list = out; st.listItem = item;
    return out;
  }
  function counted(item) { return cubeList(item).filter(function (c) { return c.counted; }); }
  function hiddenCubes(item) { return cubeList(item).filter(function (c) { return c.hidden; }); }
  function sidesText(q) {
    var names = [];
    q.sides.forEach(function (on, s) { if (on) names.push(SIDES[s]); });
    return names.length ? names.join(', ') : 'none';
  }
  function touching(a, b) { return Math.abs(a.x - b.x) + Math.abs(a.y - b.y) + Math.abs(a.z - b.z) === 1; }

  // Numbers on the figure. opts: { counted: how many of the counted cubes (tally order) are ringed,
  // blank: [cube indices showing '?'], only: counted cubes alone, also: [cube indices shown as well
  // with only] }. Ghosts go first, so no dashed edge crosses a number.
  function numbers(item, opts) {
    var m = marks(), all = cubeList(item), k = 0, ring = {}, also = opts.also || [];
    floor = digitFloor();
    counted(item).forEach(function (c) { if (k++ < (opts.counted || 0)) ring[c.i] = true; });
    var shown = all.filter(function (c) { return opts.only ? ring[c.i] || also.indexOf(c.i) >= 0 : true; });
    var hid = shown.filter(function (c) { return c.hidden; });
    var veils = hid.map(function (c) { return hull(c.q); }), discs = [], place = {};
    hid.forEach(function (c) { m.appendChild(ghost(c.q, true)); });
    // the hidden cubes' badges first (fixed at their centres), then each seen cube's clear of those placed
    hid.concat(shown.filter(function (c) { return !c.hidden; })).forEach(function (c) {
      var pl = place[c.i] = placeOf(c, veils, discs);
      discs.push({ at: pl.at, r: pl.r + (ring[c.i] ? RING_D : 0) });
    });
    shown.forEach(function (c) {
      var blank = (opts.blank || []).indexOf(c.i) >= 0;
      m.appendChild(badge(c, blank ? '?' : c.q.painted, ring[c.i] ? 'count' : blank ? 'unknown' : 'number', place[c.i]));
    });
  }
  // Try 1's first step done (ctx.assist = { numbers: n }): every cube's number but n. Left blank:
  // the last counted cube in tally order and a cube that touches it, so the rule has to be used once
  // on a counted cube and once on another.
  function assistBlanks(item, n) {
    var all = cubeList(item), cnt = all.filter(function (c) { return c.counted && !c.hidden; }), out = [];
    var a = cnt[cnt.length - 1];
    if (a) out.push(a.i);
    var others = all.filter(function (c) { return !c.counted && !c.hidden; });
    var b = a ? others.filter(function (c) { return touching(c.q, a.q); })[0] || others[0] : others[0];
    if (b && out.length < n) out.push(b.i);
    return out;
  }

  function describe(item) {
    var n = lib.total(item.heights);
    return 'A figure of ' + plural(n, 'cube', 'cubes') + ' glued together on a ' + item.grid + ' by ' + item.grid + ' grid, at most ' +
      tallest(item.heights) + ' high, painted on every outside face except the bottom. ' +
      'How many cubes have exactly ' + plural(item.ask, 'painted side', 'painted sides') + '?';
  }

  /* ---------- view functions ---------- */

  function mount(ctx) {
    var root = h('div.ex-cubes-stem');
    var q = h('p.ex-cubes-q');
    var figure = h('div.ex-cubes-figure-box.px-plate');
    var stage = h('div.ex-stage.ex-cubes-stage', figure);
    var verdict = h('div.ex-verdict.ex-cubes-verdict', { hidden: true, role: 'status' });
    var caption = h('p.ex-caption', { 'aria-live': 'polite' });
    var desc = h('p.px-sr');
    var setRow = h('div.ex-cubes-set', { hidden: true });
    root.appendChild(stage);
    root.appendChild(setRow);
    root.appendChild(q);
    root.appendChild(h('div.ex-cubes-under', caption, verdict));
    root.appendChild(desc);
    ctx.host.appendChild(root);
    st = { ctx: ctx, root: root, stage: stage, figure: figure, q: q, verdict: verdict, caption: caption, desc: desc, item: null, optItem: null, opts: [], fig: null, pulled: null, assist: null, assistHidden: false, list: null, listItem: null,
      setRow: setRow, figKey: null, tally: [0, 0, 0, 0, 0, 0], tallyOpen: false, cut: '' };
  }
  // The name of answer i (a letter A–E in the format's labelling, else its number).
  function answerName(i) { return st && st.ctx && typeof st.ctx.optionName === 'function' ? st.ctx.optionName(i) : PX.ui.optionName(i, true); }
  // The starter band (flat figures, 4–6 cubes) keeps the face tones; the test range is drawn plain.
  function plainOf(item) { var p = item.params || {}; return !(p.cubes === 0 || p.height === 0); }
  // The figure's identity: its seed, level and heights (one figure across its set of questions).
  function figKeyOf(item) { var p = item.params || {}; return [item.seed, p.cubes, p.height, p.asked, JSON.stringify(item.heights)].join('|'); }

  /* ---------- the set row: "Question 2 of 3" and the tally pad (O12) ---------- */

  function setRow(item, ctx) {
    // A planner's set (Train, Path, Free play: ctx.set), or Section practice, which asks about a figure
    // by params.ask itself and stops when its part does, so it gets no total.
    var row = st.setRow, set = ctx && ctx.set && ctx.set.n > 1 ? ctx.set : null;
    var sec = !(ctx && ctx.set) && Number.isInteger((item.params || {}).ask) && Array.isArray(item.asks) && item.asks.length > 1;
    var several = !!(set || sec);
    PX.ui.clear(row);
    st.root.classList.toggle('has-set', !!several);
    st.root.classList.toggle('is-tally', !!several && st.tallyOpen);
    row.hidden = !several;
    if (!several) return;
    // Try asks every question of its figure (learn.practice, by params.ask), so it names the total too.
    var label = set ? 'Question ' + (set.i + 1) + ' of ' + set.n : ctx && ctx.practice ? 'Question ' + (item.pos + 1) + ' of ' + item.asks.length : 'Question ' + (item.pos + 1) + ' about this figure';
    // aria-controls only while the pad is open (it is built then; RV-a11y-1.2 L1: a closed pad's id named nothing)
    var toggle = h('button.px-btn.ex-cubes-tally-toggle', { type: 'button', 'aria-pressed': st.tallyOpen ? 'true' : 'false' }, 'Tally');
    if (st.tallyOpen) toggle.setAttribute('aria-controls', 'ex-cubes-tally');
    toggle.addEventListener('click', function () {
      var svg = st.figure.querySelector('svg'), h0 = svg ? svg.getBoundingClientRect().height : 0;
      st.tallyOpen = !st.tallyOpen;
      setRow(st.item, st.ctx);
      padRoom(h0);
      var t = st.setRow.querySelector('.ex-cubes-tally-toggle');
      if (t && t.focus) try { t.focus({ preventScroll: true }); } catch (e) { /* older engines */ }
    });
    row.appendChild(h('div.ex-cubes-set-bar', h('span.ex-cubes-set-n', label), toggle));
    if (!st.tallyOpen) return;
    var pad = h('div.ex-cubes-tally', { id: 'ex-cubes-tally', role: 'group', 'aria-label': 'Tally pad: cubes counted by painted sides' });
    st.tally.forEach(function (c, n) {
      var b = h('button.ex-cubes-tally-c', { type: 'button', 'aria-label': 'Cubes with ' + n + ' painted side' + (n === 1 ? '' : 's') + ': ' + c + '. Tap to add one.' },
        h('span.ex-cubes-tally-k', String(n)), h('span.ex-cubes-tally-v', c ? String(c) : '·'));
      b.addEventListener('click', function () { st.tally[n] = Math.min(99, st.tally[n] + 1); setRow(st.item, st.ctx); focusTally(n); });
      pad.appendChild(b);
    });
    var clear = h('button.ex-cubes-tally-clear', { type: 'button' }, 'Clear');
    clear.addEventListener('click', function () { st.tally = [0, 0, 0, 0, 0, 0]; setRow(st.item, st.ctx); focusTally('clear'); });
    pad.appendChild(clear);
    row.appendChild(pad);
  }
  // Opening the pad takes its height from the figure (closing gives it back), so the answers keep their
  // place whatever bounds the figure's size; the cut stays on this figure's drawings while the pad is open.
  function padRoom(h0) {
    var pad = st.setRow.querySelector('.ex-cubes-tally');
    st.cut = '';
    if (st.tallyOpen && pad && h0 > 0) {
      var cs = window.getComputedStyle ? window.getComputedStyle(pad) : null, ph = pad.getBoundingClientRect().height + (cs ? parseFloat(cs.marginTop) || 0 : 0);
      st.cut = Math.max(64, Math.round(h0 - ph)) + 'px';
    }
    applyCut();
  }
  function applyCut() {
    [st.fig && st.fig.svg, st.pulled && st.pulled.svg].forEach(function (svg) { if (svg) svg.style.maxHeight = st.cut || ''; });
  }
  function focusTally(which) {
    var el = which === 'clear' ? st.setRow.querySelector('.ex-cubes-tally-clear') : st.setRow.querySelectorAll('.ex-cubes-tally-c')[which];
    if (el && el.focus) try { el.focus({ preventScroll: true }); } catch (e) { /* older engines */ }
  }

  function question(item) {
    PX.ui.clear(st.q);
    st.q.appendChild(document.createTextNode('How many cubes have exactly '));
    st.q.appendChild(h('b.ex-cubes-n', String(item.ask)));
    st.q.appendChild(document.createTextNode(item.ask === 1 ? ' painted side?' : ' painted sides?'));
  }

  function present(item, ctx) {
    if (!st) mount(ctx);
    newItem(item);
    st.item = item;
    st.verdict.hidden = true;
    st.verdict.textContent = '';
    st.caption.textContent = '';
    st.root.classList.remove('is-revealed');
    var key = figKeyOf(item);
    if (key !== st.figKey || !st.fig) {
      // a new figure: a new drawing, an empty tally
      PX.ui.clear(st.figure);
      st.fig = figureSvg(item.heights, 1);
      st.figure.appendChild(st.fig.svg);
      st.figKey = key;
      st.tally = [0, 0, 0, 0, 0, 0];
      st.cut = ''; // a new figure is laid out with the pad as it is (css/ex/cubes.css budgets it on phones)
      st.list = null; st.listItem = null; st.rr = null;
    } else {
      // the same figure, a new question: the drawing stays, its marks go
      normal();
      marks();
    }
    st.pulled = null;
    st.figure.classList.toggle('is-plain', plainOf(item));
    setRow(item, ctx);
    question(item);
    var a = ctx && ctx.assist && typeof ctx.assist === 'object' ? ctx.assist : null;
    st.assist = a && a.numbers > 0 ? assistBlanks(item, a.numbers) : null;
    st.assistHidden = !!(a && a.hidden) && !st.assist && hiddenCubes(item).length > 0;
    var what = hiddenCubes(item).length === 1 ? 'The hidden cube is' : 'The hidden cubes are';
    if (st.assist) {
      numbers(item, { blank: st.assist });
      st.caption.textContent = cap('assist');
    } else if (st.assistHidden) {
      ghostHidden(item);
      st.caption.textContent = cap('assistHidden', { what: what });
    } else if (ctx && ctx.practice && !ctx.demo && st.root.classList.contains('has-set') && item.pos === 0) {
      // Try's figure set (fresh-player run, 19 Nov: sets and the tally were first met in scored items)
      var two = item.asks.length === 2;
      st.caption.textContent = cap('setFirst', { n: two ? 'Two' : String(item.asks.length), all: two ? 'both' : 'all of them' });
    }
    st.desc.textContent = describe(item) + (st.assist ? ' Every cube but ' + st.assist.length + ' shows its number of painted sides.' : '') +
      (st.assistHidden ? ' ' + cap('assistHidden', { what: what }) : '');
    return timing.nextPaint();
  }

  function newItem(item) {
    if (st.optItem === item) return;
    st.optItem = item;
    st.opts = [];
  }
  function drawOption(el, item, i, ctx) {
    if (!st) mount(ctx);
    newItem(item);
    var n = item.options[i];
    el.appendChild(h('span.ex-answer.ex-cubes-opt', h('span.ex-answer-text', String(n)), h('span.ex-cubes-unit', n === 1 ? 'cube' : 'cubes')));
    st.opts[i] = { el: el };
  }
  function optionLabel(item, i) { return 'Option ' + PX.ui.optionName(i, true) + ': ' + plural(item.options[i], 'cube', 'cubes'); }
  function gridCols() { return 5; }

  /* ---------- rule figures (the rules card; CONTRACT-v1.2 D) ---------- */

  // touch: two cubes side by side, pulled apart, the faces that touched bare; under: two stacked,
  // the lower top bare; hidden: a column of two whose lower cube is hidden by a cube in front and
  // one to its right, drawn as a dashed ghost.
  // (Height maps are square, H[z][x]; the rule figures spread wider than show me's, 1.6, so the bare
  // face shows well at 72–96 px.)
  var RULES = { touch: { H: [[1, 1], [0, 0]], s: 1.6 }, under: { H: [[2]], s: 1.6 }, hidden: { H: [[2, 1], [1, 0]], s: 1, ghosts: true } };
  function drawRule(el, fig) {
    var r = RULES[fig];
    if (!r || !el) return;
    var f = figureSvg(r.H, r.s, 'ex-cubes-rule-svg');
    if (r.ghosts) {
      var rr = lib.render(r.H), m = f.svg.querySelector('.ex-cubes-marks');
      rr.cubes.forEach(function (q, i) { if (rr.perCube[i].any === 0) m.appendChild(ghost(q)); });
    }
    el.appendChild(h('div.ex-cubes.ex-cubes-rulefig', f.svg));
  }

  /* ---------- reveal ---------- */

  function reveal(item, response, result, ctx) {
    if (!st) return Promise.resolve();
    st.root.classList.add('is-revealed');
    var list = counted(item), hid = list.filter(function (c) { return c.hidden; }).length;
    // After Try 1 every number shows (the two left blank filled in); otherwise the counted cubes,
    // and after Try 3 the hidden cube that was drawn for the player too, with its number.
    numbers(item, { counted: list.length, only: !st.assist, also: st.assistHidden ? hiddenCubes(item).map(function (c) { return c.i; }) : null });
    // One line at 360 px, in the room the stem keeps for it from the start (the answers never move);
    // the help caption of a Try item gives way to it.
    st.caption.textContent = '';
    st.verdict.textContent = '✓ ' + plural(item.count, 'cube', 'cubes') + ' with ' + plural(item.ask, 'painted side', 'painted sides') +
      (hid ? ', ' + hid + ' hidden' : '') + '.';
    st.verdict.setAttribute('data-kind', 'key');
    st.verdict.hidden = false;
    return timing.wait(ctx && ctx.fast ? 0 : 250);
  }

  /* ---------- show me: the "Count by position" card, step by step ---------- */

  function focusOption(i) {
    st.opts.forEach(function (o, j) {
      if (!o) return;
      var b = o.el.closest ? o.el.closest('.px-choice') : null;
      if (b) b.classList.toggle('ex-focus', j === i);
    });
  }
  // The figure in the stem: normal, or pulled apart (the same cubes, spread out).
  function normal() {
    if (st.pulled && st.pulled.svg.parentNode) { st.figure.replaceChild(st.fig.svg, st.pulled.svg); }
    st.figure.classList.remove('is-pulled');
  }
  function pulledApart(item) {
    if (!st.pulled) { st.pulled = figureSvg(item.heights, SPREAD); applyCut(); }
    if (st.fig.svg.parentNode) st.figure.replaceChild(st.pulled.svg, st.fig.svg);
    st.figure.classList.add('is-pulled');
  }
  function steps(item, response) {
    var list = counted(item), k = list.length, N = item.ask, flat = tallest(item.heights) === 1, out = [];
    out.push({ ms: 1500, caption: cap('question'), enter: function () { normal(); marks(); focusOption(-1); st.q.classList.add('is-pointed'); }, exit: function () { st.q.classList.remove('is-pointed'); } });
    out.push({ ms: 2800, caption: cap('explode'), enter: function () { marks(); focusOption(-1); pulledApart(item); }, exit: normal });
    out.push({ ms: 2600, caption: cap(flat ? 'numbersFlat' : 'numbers'), enter: function () { normal(); numbers(item, {}); focusOption(-1); } });
    list.forEach(function (c, j) {
      var sides = plural(c.q.painted, 'painted side', 'painted sides') + ' (' + sidesText(c.q) + ')';
      out.push({
        ms: c.hidden ? 2200 : 1600,
        caption: cap(c.hidden ? 'tallyHidden' : 'tally', { n: j + 1, k: k, N: N, sides: sides }),
        read: j > 0 && !c.hidden ? 'cube ' + (j + 1) + ' of ' + k + ', ' + sides : null,
        enter: function () { normal(); numbers(item, { counted: j + 1 }); focusOption(-1); },
      });
    });
    out.push({
      ms: 1800, caption: cap('done', { k: item.count, n: answerName(item.key), cubes: item.count === 1 ? 'cube has' : 'cubes have', sides: plural(item.ask, 'painted side', 'painted sides') }),
      enter: function () { normal(); numbers(item, { counted: k }); focusOption(item.key); },
    });
    var r = response;
    if (typeof r === 'number' && r !== item.key && r >= 0 && r < 5) {
      out.push({
        ms: 2200, caption: cap('chosen', { n: answerName(r), c: plural(item.options[r], 'cube', 'cubes'), d: item.options[r] > item.count ? 'more than' : 'fewer than' }),
        enter: function () { normal(); numbers(item, { counted: k }); focusOption(r); },
      });
    }
    return out;
  }

  function runSteps(list, ctx, opts) {
    var scale = ctx && ctx.fast ? 0.02 : 1;
    return new Promise(function (resolve) {
      var i = -1, start = 0, go = true;
      function begin(now) {
        i++;
        if (i >= list.length) { resolve(); return false; }
        start = now;
        var s = list[i];
        if (s.caption && opts && opts.caption) opts.caption(s.caption);
        if (s.enter) s.enter();
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
  // After show me or a demo the last caption goes, so the stem returns to the room it keeps.
  function done() { if (st) { normal(); focusOption(-1); st.caption.textContent = ''; if (st.item) st.figure.classList.toggle('is-plain', plainOf(st.item)); } }
  // Show me and the Watch draw the face tones as an aid (note D1 §6.1: tones stay a scaffold).
  function toned() { if (st) st.figure.classList.remove('is-plain'); }
  function showMe(item, response, ctx) {
    if (!st || st.item !== item) return Promise.resolve();
    toned();
    return play(steps(item, response), ctx, { name: 'show-me' }).then(done, done);
  }
  // The cubes nothing of which shows (supports under taller columns), as dashed ghosts.
  function ghostHidden(item) {
    var m = marks(), n = 0;
    cubeList(item).forEach(function (c) { if (c.hidden) { m.appendChild(ghost(c.q)); n++; } });
    return n;
  }
  function demo(item, ctx, caption) {
    if (!st || st.item !== item) return Promise.resolve();
    toned();
    var hid = cubeList(item).filter(function (c) { return c.hidden; }).length;
    var intro = [
      { ms: 2200, caption: cap('figure'), enter: function () { normal(); marks(); focusOption(-1); st.figure.classList.add('is-pointed'); }, exit: function () { st.figure.classList.remove('is-pointed'); } },
    ];
    if (hid) {
      intro.push({
        ms: 2600, caption: cap('hidden', { what: hid === 1 ? 'The dashed cube is' : 'The dashed cubes are', where: hid === 1 ? 'under the cube above it' : 'under the cubes above them' }),
        enter: function () { normal(); ghostHidden(item); focusOption(-1); }, exit: function () { marks(); },
      });
    }
    intro.push({ ms: 1800, caption: cap('options'), enter: function () { normal(); marks(); } });
    return play(readable(intro.concat(steps(item, null))), ctx, { name: 'demo', caption: caption || null }).then(done, done);
  }

  function unmount() {
    if (!st) return;
    if (st.root.parentNode) st.root.parentNode.removeChild(st.root);
    st = null;
  }

  PX.ex.view('cubes', {
    layout: 'stem+options',
    optionKeys: 'letters', // answers A–E for 1–5 cubes (CONTRACT-v1.2 W1)
    css: true,
    mount: mount, present: present, drawOption: drawOption, optionLabel: optionLabel, gridCols: gridCols,
    reveal: reveal, showMe: showMe, demo: demo, unmount: unmount, drawRule: drawRule,
    steps: function (item, response) { return st ? steps(item, response) : []; },
  });
})(window.PX);
