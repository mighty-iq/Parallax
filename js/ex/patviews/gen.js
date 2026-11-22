/* EX-15 Missing View (DAT-style format): two of a block structure's top, front and end views are given in their
   fixed places; which of four drawings is the missing view? Hidden edges are dotted.
   (pure; ARCHITECTURE.md §5; design: docs/research/v1.1/R3-dat-pat.md §8.2, Phase A on cube stacks.)

   Object class (told to the player): unit cubes on a grid, every cube on the ground or on another
   cube, i.e. a height map hm[z * W + x] in its own bounding box W × D (x left → right, z back →
   front, y up, at most H high). The structures come from Views' block model (PX.ex.get('views').lib,
   read lazily: this file may load before js/ex/views/gen.js in a node load check).

   Views (third-angle layout, all three cropped to the bounding box, one scale):
     top    from +y, the front at the bottom        image (iu, iv, id) = (x, D − 1 − z, y)
     front  from +z                                   image (iu, iv, id) = (x, y, z)
     end    the right side, from +x, front on the left image (iu, iv, id) = (D − 1 − z, y, x)
   id grows toward the viewer. A unit segment of a drawing carries the edges of the solid that
   project onto it (an edge: the four cells around a lattice segment hold 1 or 3 cubes, or 2 on a
   diagonal). Style 1 (solid) when one of them is visible, i.e. unobstructed toward the viewer on at
   least one side of the segment; style 2 (dotted) when there are edges but all are hidden; 0 none.
   The filled silhouette is drawn too (a light tone), so holes in a top view are never ambiguous.

   Uniqueness (two views do not fix an object). Every item enumerates ALL height maps in the box whose
   two given views are exactly the given drawings (search(): column candidates, row prefixes, exact
   final check; bounded, and the item is rejected when the bound is hit). The key is the missing view
   of the shown structure; a foil is admitted only when no structure in the class has it, so exactly
   one option is possible. Every foil is also tested by class-free reasons, recorded in option.why
   for show me: 'hull' (the silhouette hull of the three outlines does not reproduce them), 'align'
   (its line positions differ from those the given views require: an extra line or a missing one),
   else 'search' (only the exhaustive search rules it out, typically a solid/dotted difference).

   Foils come from the structure's neighbours inside the same box (one or two columns changed) and,
   for front and end views, from flipping one line between solid and dotted; all share the key's
   size. Kinds: 'outline' (another silhouette), 'lines' (same silhouette, other lines), 'dashes'
   (same lines, other styles). Dim foil: 0 outline foils, 1 same-silhouette foils, 2 the subtlest
   (a solid/dotted foil for front and end, with the key's line layout never the most common one:
   other dashes foils, or a lines foil with its own flip; the closest one-line foils for top). Foil
   sets are chosen so the cheap solvers (line counts, area, like the others, odd one out, by lines
   only, the drawing most like a given view) hit about 1 in 4.

   validate (independent): rebuilds the voxels, enumerates the solid's edges in 3D and decides each
   one's visibility by marching voxels toward the viewer (drawRay), re-derives every drawing, re-runs
   the exhaustive search, runs a second search built on drawRay alone (searchRay: lone slices, rows
   and slice pairs drawn by drawRay prune; every leaf drawn in full), which must find the same
   structures, and re-proves every foil.

   Item: { ex: 'patviews', seed, params, W, H, D, heights: [[...]] (D rows of W), missing,
           given: { <view>: drawing, <view>: drawing }, key, options: [{ kind, why?, drawing }] }
   drawing = { w, h, segs: [[u0, v0, u1, v1, style], …] (maximal runs), fill: '0101…' (row-major
   from the bottom row) }. */
(function (PX) {
  'use strict';
  var Mth = Math, INF = 1 / 0;

  function VL() { var d = PX.ex.get('views'); if (!d) throw new Error('patviews needs js/ex/views/gen.js'); return d.lib; }

  var VIEWS = ['top', 'front', 'end'];
  var MISSING = ['end', 'front', 'top'];            // dim 'missing', easiest first (DJ)
  // dim 'cubes' (v1.2): the shown structure's cube count, enforced, so the labels hold. The structure
  // drawn first has the level's own count (N below: 4–5, 6–7, 8–9, 10–12 as in 1.1) and the one shown
  // is usually a neighbour of it, so the shown counts spread: the windows hold about 95 % of 1.1's
  // items, which keeps 1.1's foil balance (note D2 §3.7: "fix the label or the count window").
  // Level 0 is the starter band: 4–6 cubes, at most two high, the structure drawn beside the views.
  var CUBES = [[4, 6], [4, 7], [5, 10], [7, 12], [9, 15]];
  var DRAWN = [[4, 6], [4, 5], [6, 7], [8, 9], [10, 12]]; // the first structure's cube count per level
  var CUBE_LABELS = ['4–6 (starter, structure shown)', '4–7', '5–10', '7–12', '9–15'];
  // Version 3 (PLAN milestone 8, O49): the 'cubes' dim holds the object: cube stacks at levels 0–2 (the
  // structures below the format), profile solids at levels 3–6 (the format's own objects; see the solids
  // section). Version 2's cube levels 7–12 and 9–15 are left out (harder stacks are no closer to the test).
  var NCUBE = 3, NOBJ = 7;
  var GRIDS = [3, 4];
  var FOILS = ['outline', 'lines', 'dashes'];
  var HMAX = 4;
  var BUDGET = 40000;                              // search nodes per item
  var MAXSOL = 4000;

  function rint(rng, lo, hi) { return lo + Mth.floor(rng.next() * (hi - lo + 1)); }
  function rshuffle(rng, arr) {
    var out = arr.slice();
    for (var i = out.length - 1; i > 0; i--) { var j = rint(rng, 0, i), t = out[i]; out[i] = out[j]; out[j] = t; }
    return out;
  }

  /* ------------------------------------------------------------ boxes and height maps */
  // A G × G height map (rows z) → { W, H, D, hm } in its own bounding box.
  function boxOf(h) {
    var G = h.length, x0 = G, x1 = -1, z0 = G, z1 = -1, H = 0, z, x;
    for (z = 0; z < G; z++) for (x = 0; x < G; x++) if (h[z][x] > 0) {
      if (x < x0) x0 = x; if (x > x1) x1 = x; if (z < z0) z0 = z; if (z > z1) z1 = z; if (h[z][x] > H) H = h[z][x];
    }
    var W = x1 - x0 + 1, D = z1 - z0 + 1, hm = new Int8Array(W * D);
    for (z = 0; z < D; z++) for (x = 0; x < W; x++) hm[z * W + x] = h[z + z0][x + x0];
    return { W: W, H: H, D: D, hm: hm };
  }
  function rowsOf(b) {
    var out = [];
    for (var z = 0; z < b.D; z++) { var r = []; for (var x = 0; x < b.W; x++) r.push(b.hm[z * b.W + x]); out.push(r); }
    return out;
  }
  // The box's extents are exact: every side of the box is touched and the tallest column is H.
  function fills(b) {
    var W = b.W, D = b.D, hm = b.hm, mx = 0, x, z, ok;
    for (var i = 0; i < hm.length; i++) if (hm[i] > mx) mx = hm[i];
    if (mx !== b.H) return false;
    for (x = 0; x < W; x += Mth.max(1, W - 1)) { ok = false; for (z = 0; z < D; z++) if (hm[z * W + x]) ok = true; if (!ok) return false; }
    for (z = 0; z < D; z += Mth.max(1, D - 1)) { ok = false; for (x = 0; x < W; x++) if (hm[z * W + x]) ok = true; if (!ok) return false; }
    return true;
  }
  function dimsOf(dir, W, H, D) {
    return dir === 'top' ? { wi: W, hi: D, di: H } : dir === 'front' ? { wi: W, hi: H, di: D } : { wi: D, hi: H, di: W };
  }

  /* ------------------------------------------------------------ drawings (method A: by segments) */
  function edgeAt(a, b, c, e) { var n = a + b + c + e; return n === 1 || n === 3 || (n === 2 && a === e); }
  // Unit-segment drawing of one view: hs[vp * wi + iu] (horizontal, vp 0…hi), vs[iv * (wi + 1) + up]
  // (vertical, up 0…wi), fill[iv * wi + iu]; styles 0 none, 1 solid, 2 dotted.
  function drawView(b, dir) {
    var W = b.W, D = b.D, hm = b.hm, dm = dimsOf(dir, W, b.H, D), wi = dm.wi, hi = dm.hi, di = dm.di;
    function oc(iu, iv, id) {
      if (iu < 0 || iv < 0 || id < 0 || iu >= wi || iv >= hi || id >= di) return 0;
      if (dir === 'top') return id < hm[(D - 1 - iv) * W + iu] ? 1 : 0;
      if (dir === 'front') return iv < hm[id * W + iu] ? 1 : 0;
      return iv < hm[(D - 1 - iu) * W + id] ? 1 : 0;
    }
    var dep = new Int8Array(wi * hi), iu, iv, id, vp, up, dp, m, s;
    for (iv = 0; iv < hi; iv++) for (iu = 0; iu < wi; iu++) {
      var d = -1;
      for (id = di - 1; id >= 0; id--) if (oc(iu, iv, id)) { d = id + 1; break; }
      dep[iv * wi + iu] = d;
    }
    function depth(u, v) { return u < 0 || v < 0 || u >= wi || v >= hi ? -1 : dep[v * wi + u]; }
    var hs = new Uint8Array((hi + 1) * wi), vs = new Uint8Array(hi * (wi + 1)), fill = new Uint8Array(wi * hi);
    for (vp = 0; vp <= hi; vp++) for (iu = 0; iu < wi; iu++) {
      m = Mth.min(depth(iu, vp - 1), depth(iu, vp)); s = 0;
      for (dp = 0; dp <= di && s !== 1; dp++) if (edgeAt(oc(iu, vp - 1, dp - 1), oc(iu, vp, dp - 1), oc(iu, vp - 1, dp), oc(iu, vp, dp))) s = dp >= m ? 1 : 2;
      hs[vp * wi + iu] = s;
    }
    for (iv = 0; iv < hi; iv++) for (up = 0; up <= wi; up++) {
      m = Mth.min(depth(up - 1, iv), depth(up, iv)); s = 0;
      for (dp = 0; dp <= di && s !== 1; dp++) if (edgeAt(oc(up - 1, iv, dp - 1), oc(up, iv, dp - 1), oc(up - 1, iv, dp), oc(up, iv, dp))) s = dp >= m ? 1 : 2;
      vs[iv * (wi + 1) + up] = s;
    }
    for (var k = 0; k < fill.length; k++) fill[k] = dep[k] >= 0 ? 1 : 0;
    return { w: wi, h: hi, hs: hs, vs: vs, fill: fill };
  }
  function codeOf(g) { return g.w + 'x' + g.h + ':' + g.hs.join('') + ':' + g.vs.join('') + ':' + g.fill.join(''); }
  function sameGrid(a, b) {
    if (a.w !== b.w || a.h !== b.h) return false;
    var k;
    for (k = 0; k < a.hs.length; k++) if (a.hs[k] !== b.hs[k]) return false;
    for (k = 0; k < a.vs.length; k++) if (a.vs[k] !== b.vs[k]) return false;
    for (k = 0; k < a.fill.length; k++) if (a.fill[k] !== b.fill[k]) return false;
    return true;
  }
  // Stored form: maximal runs of one style, and the fill as text.
  function pub(g) {
    var segs = [], u, v, s, a;
    for (v = 0; v <= g.h; v++) for (u = 0; u < g.w; u++) {
      s = g.hs[v * g.w + u]; if (!s) continue;
      a = u; while (u + 1 < g.w && g.hs[v * g.w + u + 1] === s) u++;
      segs.push([a, v, u + 1, v, s]);
    }
    for (u = 0; u <= g.w; u++) for (v = 0; v < g.h; v++) {
      s = g.vs[v * (g.w + 1) + u]; if (!s) continue;
      a = v; while (v + 1 < g.h && g.vs[(v + 1) * (g.w + 1) + u] === s) v++;
      segs.push([u, a, u, v + 1, s]);
    }
    return { w: g.w, h: g.h, segs: segs, fill: Array.prototype.join.call(g.fill, '') };
  }
  // Stored form → unit grid (null when malformed).
  function grid(d) {
    if (!d || !(d.w >= 1 && d.w <= 8 && d.h >= 1 && d.h <= 8) || !Array.isArray(d.segs) || typeof d.fill !== 'string' || d.fill.length !== d.w * d.h) return null;
    var g = { w: d.w, h: d.h, hs: new Uint8Array((d.h + 1) * d.w), vs: new Uint8Array(d.h * (d.w + 1)), fill: new Uint8Array(d.w * d.h) };
    for (var k = 0; k < d.fill.length; k++) { if (d.fill[k] !== '0' && d.fill[k] !== '1') return null; g.fill[k] = d.fill[k] === '1' ? 1 : 0; }
    for (var i = 0; i < d.segs.length; i++) {
      var q = d.segs[i];
      if (!Array.isArray(q) || q.length !== 5 || !(q[4] === 1 || q[4] === 2)) return null;
      if (q[1] === q[3] && q[0] < q[2] && q[1] >= 0 && q[1] <= d.h && q[0] >= 0 && q[2] <= d.w) for (var u = q[0]; u < q[2]; u++) g.hs[q[1] * d.w + u] = q[4];
      else if (q[0] === q[2] && q[1] < q[3] && q[0] >= 0 && q[0] <= d.w && q[1] >= 0 && q[3] <= d.h) for (var v = q[1]; v < q[3]; v++) g.vs[v * (d.w + 1) + q[0]] = q[4];
      else return null;
    }
    return g;
  }
  // Counts for the shortcut solvers: unit segments solid, dotted; filled cells.
  function counts(g) {
    var c = { solid: 0, dotted: 0, area: 0 }, k;
    for (k = 0; k < g.hs.length; k++) { if (g.hs[k] === 1) c.solid++; else if (g.hs[k] === 2) c.dotted++; }
    for (k = 0; k < g.vs.length; k++) { if (g.vs[k] === 1) c.solid++; else if (g.vs[k] === 2) c.dotted++; }
    for (k = 0; k < g.fill.length; k++) c.area += g.fill[k];
    return c;
  }
  // Unit segments that differ (presence or style) plus fill cells that differ.
  function gdist(a, b) {
    var n = 0, k;
    for (k = 0; k < a.hs.length; k++) if (a.hs[k] !== b.hs[k]) n++;
    for (k = 0; k < a.vs.length; k++) if (a.vs[k] !== b.vs[k]) n++;
    for (k = 0; k < a.fill.length; k++) if (a.fill[k] !== b.fill[k]) n++;
    return n;
  }
  function kindOf(key, g) {
    var k;
    for (k = 0; k < key.fill.length; k++) if (key.fill[k] !== g.fill[k]) return 'outline';
    for (k = 0; k < key.hs.length; k++) if (!key.hs[k] !== !g.hs[k]) return 'lines';
    for (k = 0; k < key.vs.length; k++) if (!key.vs[k] !== !g.vs[k]) return 'lines';
    return 'dashes';
  }

  /* ------------------------------------------------------------ class-free proofs (validator too) */
  // (b) The silhouette hull: voxels whose three projections lie in the three outlines. Any solid
  // with these outlines lies inside it, so when the hull's own projections fall short, none exists.
  function hullFails(top, front, end, W, H, D) {
    var pt = new Uint8Array(W * D), pf = new Uint8Array(W * H), pe = new Uint8Array(D * H), x, y, z, k;
    for (x = 0; x < W; x++) for (y = 0; y < H; y++) for (z = 0; z < D; z++) {
      var it = (D - 1 - z) * W + x, iF = y * W + x, ie = y * D + (D - 1 - z);
      if (top.fill[it] && front.fill[iF] && end.fill[ie]) { pt[it] = 1; pf[iF] = 1; pe[ie] = 1; }
    }
    for (k = 0; k < pt.length; k++) if (pt[k] !== top.fill[k]) return true;
    for (k = 0; k < pf.length; k++) if (pf[k] !== front.fill[k]) return true;
    for (k = 0; k < pe.length; k++) if (pe[k] !== end.fill[k]) return true;
    return false;
  }
  // (c) Line alignment: every vertex of a block structure has edges along all three axes, so the
  // x of vertical lines agrees between top and front, y of horizontal lines between front and end,
  // and z between top's horizontal and end's vertical lines (checked exhaustively in the tests).
  function lineSet(g, horiz) {
    var s = {}, u, v;
    if (horiz) { for (v = 0; v <= g.h; v++) for (u = 0; u < g.w; u++) if (g.hs[v * g.w + u]) { s[v] = 1; break; } }
    else { for (u = 0; u <= g.w; u++) for (v = 0; v < g.h; v++) if (g.vs[v * (g.w + 1) + u]) { s[u] = 1; break; } }
    return Object.keys(s).sort().join(',');
  }
  function alignFails(top, front, end) {
    return lineSet(top, false) !== lineSet(front, false) || lineSet(front, true) !== lineSet(end, true) || lineSet(top, true) !== lineSet(end, false);
  }

  /* ------------------------------------------------------------ the exhaustive search */
  // One cross-section (a column over z, or a row over x): cells (d, y) filled when y < vec[d].
  // sideH[vp]: styles of the side view's horizontal segments (front for columns, end for rows),
  // sideFill[y]; topL[dp]: styles of the top view's segments across this cross-section, topFill[d].
  function crossStyles(vec, n, H) {
    function occ(y, d) { return d < 0 || d >= n || y < 0 || y >= H ? 0 : (y < vec[d] ? 1 : 0); }
    var sd = [], y, d, dp, yp, s, m;
    for (y = 0; y < H; y++) { var near = -1; for (d = n - 1; d >= 0; d--) if (vec[d] > y) { near = d + 1; break; } sd.push(near); }
    function sdep(v) { return v < 0 || v >= H ? -1 : sd[v]; }
    function tdep(dd) { return dd < 0 || dd >= n || !vec[dd] ? -1 : vec[dd]; }
    var sideH = [], topL = [], sideFill = [], topFill = [];
    for (yp = 0; yp <= H; yp++) {
      m = Mth.min(sdep(yp - 1), sdep(yp)); s = 0;
      for (dp = 0; dp <= n && s !== 1; dp++) if (edgeAt(occ(yp - 1, dp - 1), occ(yp, dp - 1), occ(yp - 1, dp), occ(yp, dp))) s = dp >= m ? 1 : 2;
      sideH.push(s);
    }
    for (dp = 0; dp <= n; dp++) {
      m = Mth.min(tdep(dp - 1), tdep(dp)); s = 0;
      for (yp = 0; yp <= H && s !== 1; yp++) if (edgeAt(occ(yp - 1, dp - 1), occ(yp, dp - 1), occ(yp - 1, dp), occ(yp, dp))) s = yp >= m ? 1 : 2;
      topL.push(s);
    }
    for (y = 0; y < H; y++) sideFill.push(sd[y] >= 0 ? 1 : 0);
    for (d = 0; d < n; d++) topFill.push(vec[d] > 0 ? 1 : 0);
    return { sideH: sideH, topL: topL, sideFill: sideFill, topFill: topFill, sd: sd };
  }
  // Styles of the side view's vertical segments between two neighbouring cross-sections A and B.
  function pairV(A, B, n, H) {
    var out = [], y, dp;
    for (y = 0; y < H; y++) {
      var m = Mth.min(A ? A.sd[y] : -1, B ? B.sd[y] : -1), s = 0;
      for (dp = 0; dp <= n && s !== 1; dp++) {
        var a0 = A && dp >= 1 && y < A.vec[dp - 1] ? 1 : 0, b0 = B && dp >= 1 && y < B.vec[dp - 1] ? 1 : 0;
        var a1 = A && dp < n && y < A.vec[dp] ? 1 : 0, b1 = B && dp < n && y < B.vec[dp] ? 1 : 0;
        if (edgeAt(a0, b0, a1, b1)) s = dp >= m ? 1 : 2;
      }
      out.push(s);
    }
    return out;
  }
  function vectors(n, H) {
    var out = [], v = [], d;
    for (d = 0; d < n; d++) v.push(0);
    for (;;) {
      out.push(v.slice());
      for (d = 0; d < n; d++) { if (v[d] < H) { v[d]++; break; } v[d] = 0; }
      if (d === n) return out;
    }
  }
  // Every height map in the W × D box, at most H high, whose views `given` ({ top?, front?, end? }
  // as unit grids) are exactly those drawings. → { sols: [hm], nodes, over }.
  function search(given, W, H, D, opts) {
    opts = opts || {};
    var budget = opts.budget || BUDGET, maxSol = opts.maxSol || MAXSOL, check = opts.check || drawView;
    var F = given.front, T = given.top, E = given.end, x, z, k;
    var colCand = [], rowCand = [], allD = vectors(D, H), allW = vectors(W, H);
    for (x = 0; x < W; x++) {
      var cl = [];
      allD.forEach(function (vec) {
        var c = crossStyles(vec, D, H), y, zp;
        if (F) {
          for (y = 0; y <= H; y++) if (c.sideH[y] !== F.hs[y * W + x]) return;
          for (y = 0; y < H; y++) if (c.sideFill[y] !== F.fill[y * W + x]) return;
        }
        if (T) {
          for (zp = 0; zp <= D; zp++) if (c.topL[zp] !== T.hs[(D - zp) * W + x]) return;
          for (zp = 0; zp < D; zp++) if (c.topFill[zp] !== T.fill[(D - 1 - zp) * W + x]) return;
        }
        c.vec = vec;
        cl.push(c);
      });
      colCand.push(cl);
    }
    var usesRows = !!(E || T), pow = [], pre = [];
    for (k = 0, pow[0] = 1; k < W; k++) pow[k + 1] = pow[k] * (H + 1);
    if (usesRows) {
      for (z = 0; z < D; z++) {
        var sets = [];
        for (k = 0; k < W; k++) sets.push(new Set());
        allW.forEach(function (vec) {
          var c = crossStyles(vec, W, H), y, xp, iu = D - 1 - z;
          if (E) {
            for (y = 0; y <= H; y++) if (c.sideH[y] !== E.hs[y * D + iu]) return;
            for (y = 0; y < H; y++) if (c.sideFill[y] !== E.fill[y * D + iu]) return;
          }
          if (T) {
            for (xp = 0; xp <= W; xp++) if (c.topL[xp] !== T.vs[(D - 1 - z) * (W + 1) + xp]) return;
            for (xp = 0; xp < W; xp++) if (c.topFill[xp] !== T.fill[(D - 1 - z) * W + xp]) return;
          }
          var code = 0;
          for (var i = 0; i < W; i++) { code += vec[i] * pow[i]; sets[i].add(code); }
        });
        pre.push(sets);
        rowCand.push(sets[W - 1].size);
      }
    }
    var hm = new Int8Array(W * D), sols = [], nodes = 0, over = false, chosen = [], rowCode = new Float64Array(D);
    var b = { W: W, H: H, D: D, hm: hm };
    function dfs(xx) {
      if (over) return;
      if (xx === W) {
        if (F && !sameGrid(check(b, 'front'), F)) return;
        if (T && !sameGrid(check(b, 'top'), T)) return;
        if (E && !sameGrid(check(b, 'end'), E)) return;
        sols.push(new Int8Array(hm));
        if (sols.length > maxSol) over = true;
        return;
      }
      var cand = colCand[xx], saved = Array.prototype.slice.call(rowCode);
      for (var i = 0; i < cand.length && !over; i++) {
        if (++nodes > budget) { over = true; return; }
        var c = cand[i], ok = true, zz;
        if (F) {
          var pv = pairV(xx > 0 ? chosen[xx - 1] : null, c, D, H);
          for (var y = 0; y < H && ok; y++) if (pv[y] !== F.vs[y * (W + 1) + xx]) ok = false;
          if (ok && xx === W - 1) { var pr = pairV(c, null, D, H); for (y = 0; y < H && ok; y++) if (pr[y] !== F.vs[y * (W + 1) + W]) ok = false; }
        }
        if (ok && usesRows) {
          for (zz = 0; zz < D && ok; zz++) { rowCode[zz] = saved[zz] + c.vec[zz] * pow[xx]; if (!pre[zz][xx].has(rowCode[zz])) ok = false; }
        }
        if (!ok) continue;
        for (zz = 0; zz < D; zz++) hm[zz * W + xx] = c.vec[zz];
        chosen[xx] = c;
        dfs(xx + 1);
      }
      for (zz = 0; zz < D; zz++) rowCode[zz] = saved[zz];
    }
    var empty = colCand.some(function (c) { return !c.length; }) || (usesRows && rowCand.some(function (n) { return !n; }));
    if (!empty) dfs(0);
    return { sols: sols, nodes: nodes, over: over };
  }
  // The missing view of every solution: code → one structure with it.
  function possibleViews(res, W, H, D, missing, draw) {
    var out = {};
    res.sols.forEach(function (hm) {
      var c = codeOf((draw || drawView)({ W: W, H: H, D: D, hm: hm }, missing));
      if (!out[c]) out[c] = hm;
    });
    return out;
  }

  /* ------------------------------------------------------------ drawings (method B: by edges, for validate) */
  // Voxels from the rows, every edge of the solid in 3D, each projected into the view and marked
  // visible when the voxels toward the viewer are empty on at least one side of its segment.
  function drawRay(rows, W, H, D, dir) {
    var vox = new Uint8Array(W * H * D), x, y, z;
    for (z = 0; z < D; z++) for (x = 0; x < W; x++) for (y = 0; y < rows[z][x]; y++) vox[(z * H + y) * W + x] = 1;
    function at(xx, yy, zz) { return xx < 0 || yy < 0 || zz < 0 || xx >= W || yy >= H || zz >= D ? 0 : vox[(zz * H + yy) * W + xx]; }
    var dm = dimsOf(dir, W, H, D), wi = dm.wi, hi = dm.hi;
    var g = { w: wi, h: hi, hs: new Uint8Array((hi + 1) * wi), vs: new Uint8Array(hi * (wi + 1)), fill: new Uint8Array(wi * hi) };
    // A world column along the view axis through (p, q), from depth plane dp toward the viewer.
    function blocked(p, q, dp) {
      var t;
      if (dir === 'front') { for (t = dp; t < D; t++) if (at(p, q, t)) return true; }
      else if (dir === 'top') { for (t = dp; t < H; t++) if (at(p, t, q)) return true; }
      else { for (t = dp; t < W; t++) if (at(t, p, q)) return true; }
      return false;
    }
    function mark(horiz, a, b, s) {
      if (horiz) { if (a < 0 || a >= wi || b < 0 || b > hi) return; var k = b * wi + a; if (g.hs[k] !== 1) g.hs[k] = s; }
      else { if (a < 0 || a > wi || b < 0 || b >= hi) return; var k2 = b * (wi + 1) + a; if (g.vs[k2] !== 1) g.vs[k2] = s; }
    }
    function is(c) { var n = c[0] + c[1] + c[2] + c[3]; return n === 1 || n === 3 || (n === 2 && c[0] === c[3]); }
    var i, j, k, xp, yp, zp;
    // Edges along x: (cell i, plane yp, plane zp).
    for (i = 0; i < W; i++) for (yp = 0; yp <= H; yp++) for (zp = 0; zp <= D; zp++) {
      if (!is([at(i, yp - 1, zp - 1), at(i, yp, zp - 1), at(i, yp - 1, zp), at(i, yp, zp)])) continue;
      if (dir === 'front') mark(true, i, yp, blocked(i, yp - 1, zp) && blocked(i, yp, zp) ? 2 : 1);
      else if (dir === 'top') mark(true, i, D - zp, blocked(i, zp - 1, yp) && blocked(i, zp, yp) ? 2 : 1);
    }
    // Edges along y: (plane xp, cell j, plane zp).
    for (xp = 0; xp <= W; xp++) for (j = 0; j < H; j++) for (zp = 0; zp <= D; zp++) {
      if (!is([at(xp - 1, j, zp - 1), at(xp, j, zp - 1), at(xp - 1, j, zp), at(xp, j, zp)])) continue;
      if (dir === 'front') mark(false, xp, j, blocked(xp - 1, j, zp) && blocked(xp, j, zp) ? 2 : 1);
      else if (dir === 'end') mark(false, D - zp, j, blocked(j, zp - 1, xp) && blocked(j, zp, xp) ? 2 : 1);
    }
    // Edges along z: (plane xp, plane yp, cell k).
    for (xp = 0; xp <= W; xp++) for (yp = 0; yp <= H; yp++) for (k = 0; k < D; k++) {
      if (!is([at(xp - 1, yp - 1, k), at(xp, yp - 1, k), at(xp - 1, yp, k), at(xp, yp, k)])) continue;
      if (dir === 'top') mark(false, xp, D - 1 - k, blocked(xp - 1, k, yp) && blocked(xp, k, yp) ? 2 : 1);
      else if (dir === 'end') mark(true, D - 1 - k, yp, blocked(yp - 1, k, xp) && blocked(yp, k, xp) ? 2 : 1);
    }
    for (j = 0; j < hi; j++) for (i = 0; i < wi; i++) {
      var f = 0;
      if (dir === 'front') f = blocked(i, j, 0) ? 1 : 0;
      else if (dir === 'top') f = blocked(i, D - 1 - j, 0) ? 1 : 0;
      else f = blocked(j, D - 1 - i, 0) ? 1 : 0;
      g.fill[j * wi + i] = f;
    }
    return g;
  }

  /* ------------------------------------------------------------ validate: a second search, on drawRay alone */
  // Shares nothing with search() (no crossStyles, pairV, drawView). A slice of the structure (the
  // column over z at one x, or the row over x at one z) is drawn alone with drawRay, and the strips of
  // the given drawings that depend on that slice alone must match it:
  //   front: column x's horizontal lines and fill (one slice); its vertical lines at x = 0 and x = W
  //          (one slice) and between two slices (the pair drawn together);
  //   top:   column x's horizontal lines and fill (slice x); row z's vertical lines and fill (row z);
  //   end:   row z's horizontal lines and fill, and its vertical lines at the back and front (row z).
  // Every edge or line-of-sight of a stack of cubes along a view lies in such a slice or pair, so the
  // strips only prune; every leaf is then drawn in full and compared with the given views.
  var rayMemo = {};
  function memo(key, make) { var v = rayMemo[key]; if (v === undefined) { v = make(); rayMemo[key] = v; } return v; }
  function colOf(g, up, n) { var out = ''; for (var iv = 0; iv < n; iv++) out += g.vs[iv * (g.w + 1) + up]; return out; }
  // A lone slice (vec over z, D = vec.length), seen from the front or the top.
  function sliceSig(vec, H, view) {
    return memo('s' + view + H + ':' + vec.join(''), function () {
      var D = vec.length, g = drawRay(vec.map(function (h) { return [h]; }), 1, H, D, view), n = view === 'front' ? H : D;
      return { hs: Array.prototype.join.call(g.hs, ''), fill: Array.prototype.join.call(g.fill, ''), v0: colOf(g, 0, n), v1: colOf(g, 1, n) };
    });
  }
  // A lone row (vec over x, W = vec.length), seen from the end or the top.
  function rowSig(vec, H, view) {
    return memo('r' + view + H + ':' + vec.join(''), function () {
      var W = vec.length, g = drawRay([vec], W, H, 1, view);
      if (view === 'top') return { vs: Array.prototype.join.call(g.vs, ''), fill: Array.prototype.join.call(g.fill, '') };
      return { hs: Array.prototype.join.call(g.hs, ''), fill: Array.prototype.join.call(g.fill, ''), v0: colOf(g, 0, H), v1: colOf(g, 1, H) };
    });
  }
  // Two neighbouring slices a (left) and b (right) seen from the front: the vertical lines between them.
  function pairSig(a, b, H) {
    return memo('p' + H + ':' + a.join('') + ':' + b.join(''), function () {
      return colOf(drawRay(a.map(function (h, z) { return [h, b[z]]; }), 2, H, a.length, 'front'), 1, H);
    });
  }
  // The given drawings' strips, in the same forms.
  function strip(g, pick, n) { var out = ''; for (var k = 0; k < n; k++) out += pick(k); return out; }
  function searchRay(given, W, H, D, budget) {
    var F = given.front, T = given.top, E = given.end, x, z, k;
    budget = budget || 400000;
    function all(n) { var out = [], v = [], d; for (d = 0; d < n; d++) v.push(0); for (;;) { out.push(v.slice()); for (d = 0; d < n; d++) { if (v[d] < H) { v[d]++; break; } v[d] = 0; } if (d === n) return out; } }
    var slices = all(D), rowsAll = all(W), cand = [];
    for (x = 0; x < W; x++) {
      var want = {};
      if (F) want.F = { hs: strip(F, function (vp) { return F.hs[vp * W + x]; }, H + 1), fill: strip(F, function (iv) { return F.fill[iv * W + x]; }, H), v0: x === 0 ? colOf(F, 0, H) : null, v1: x === W - 1 ? colOf(F, W, H) : null };
      if (T) want.T = { hs: strip(T, function (vp) { return T.hs[vp * W + x]; }, D + 1), fill: strip(T, function (iv) { return T.fill[iv * W + x]; }, D) };
      cand.push(slices.filter(function (vec) {
        var s;
        if (want.F) { s = sliceSig(vec, H, 'front'); if (s.hs !== want.F.hs || s.fill !== want.F.fill || (want.F.v0 !== null && s.v0 !== want.F.v0) || (want.F.v1 !== null && s.v1 !== want.F.v1)) return false; }
        if (want.T) { s = sliceSig(vec, H, 'top'); if (s.hs !== want.T.hs || s.fill !== want.T.fill) return false; }
        return true;
      }));
    }
    // Rows: the codes of every prefix (x = 0 … k) of a row that fits the end and top views at z.
    var pre = [], pw = [1];
    for (k = 0; k < W; k++) pw.push(pw[k] * (H + 1));
    for (z = 0; z < D; z++) {
      var u = D - 1 - z, wantE = E && { hs: strip(E, function (vp) { return E.hs[vp * D + u]; }, H + 1), fill: strip(E, function (iv) { return E.fill[iv * D + u]; }, H), v0: z === D - 1 ? colOf(E, D - 1 - z, H) : null, v1: z === 0 ? colOf(E, D - z, H) : null };
      var wantT = T && { vs: strip(T, function (up) { return T.vs[u * (W + 1) + up]; }, W + 1), fill: strip(T, function (i) { return T.fill[u * W + i]; }, W) };
      var sets = [];
      for (k = 0; k < W; k++) sets.push({});
      rowsAll.forEach(function (vec) {
        var s;
        if (wantE) { s = rowSig(vec, H, 'end'); if (s.hs !== wantE.hs || s.fill !== wantE.fill || (wantE.v0 !== null && s.v0 !== wantE.v0) || (wantE.v1 !== null && s.v1 !== wantE.v1)) return; }
        if (wantT) { s = rowSig(vec, H, 'top'); if (s.vs !== wantT.vs || s.fill !== wantT.fill) return; }
        var code = 0;
        for (var i = 0; i < W; i++) { code += vec[i] * pw[i]; sets[i][code] = 1; }
      });
      pre.push(sets);
    }
    var rows = [], sols = [], nodes = 0, over = false, codes = [], chosen = [];
    for (z = 0; z < D; z++) { rows.push([]); codes.push(0); }
    function dfs(xx) {
      if (over) return;
      if (xx === W) {
        var r = rows.map(function (row) { return row.slice(); });
        if (F && !sameGrid(drawRay(r, W, H, D, 'front'), F)) return;
        if (T && !sameGrid(drawRay(r, W, H, D, 'top'), T)) return;
        if (E && !sameGrid(drawRay(r, W, H, D, 'end'), E)) return;
        sols.push(r);
        return;
      }
      var list = cand[xx];
      for (var i = 0; i < list.length && !over; i++) {
        if (++nodes > budget) { over = true; return; }
        var vec = list[i], ok = true, saved = codes.slice(), zz;
        for (zz = 0; zz < D && ok; zz++) { codes[zz] = saved[zz] + vec[zz] * pw[xx]; if (!pre[zz][xx][codes[zz]]) ok = false; }
        if (ok && F && xx > 0 && pairSig(chosen[xx - 1], vec, H) !== colOf(F, xx, H)) ok = false;
        if (ok) {
          for (zz = 0; zz < D; zz++) rows[zz][xx] = vec[zz];
          chosen[xx] = vec;
          dfs(xx + 1);
        }
        for (zz = 0; zz < D; zz++) codes[zz] = saved[zz];
      }
    }
    if (cand.every(function (c) { return c.length; })) dfs(0);
    return { sols: sols, nodes: nodes, over: over };
  }

  /* ------------------------------------------------------------ foils */
  function connectedBox(b) {
    var W = b.W, D = b.D, seen = new Uint8Array(W * D), st = [], n = 0, got = 0, k;
    for (k = 0; k < W * D; k++) if (b.hm[k]) { n++; if (!st.length) { st.push(k); seen[k] = 1; } }
    while (st.length) {
      var c = st.pop(), cx = c % W, cz = (c - cx) / W;
      got++;
      [[1, 0], [-1, 0], [0, 1], [0, -1]].forEach(function (d) {
        var xx = cx + d[0], zz = cz + d[1], j = zz * W + xx;
        if (xx >= 0 && zz >= 0 && xx < W && zz < D && b.hm[j] && !seen[j]) { seen[j] = 1; st.push(j); }
      });
    }
    return n > 0 && got === n;
  }
  // Structures in the same box: every single column changed, and a sample of two-column changes.
  function neighbours(rng, b) {
    var out = [], n = b.W * b.D, k, v;
    function add(hm) { var c = { W: b.W, H: b.H, D: b.D, hm: hm }; if (fills(c) && connectedBox(c)) out.push(c); }
    for (k = 0; k < n; k++) for (v = 0; v <= b.H; v++) if (v !== b.hm[k]) { var a = new Int8Array(b.hm); a[k] = v; add(a); }
    for (var t = 0; t < 36; t++) {
      var a2 = new Int8Array(b.hm), p = rint(rng, 0, n - 1), q = rint(rng, 0, n - 1);
      if (p === q) continue;
      a2[p] = rint(rng, 0, b.H); a2[q] = rint(rng, 0, b.H);
      add(a2);
    }
    return out;
  }
  // One maximal run of the drawing switched between solid and dotted; never a run on the outline
  // (an outline is always seen, so a dotted outline would be a free tell).
  function onOutline(g, q) {
    function f(u, v) { return u < 0 || v < 0 || u >= g.w || v >= g.h ? 0 : g.fill[v * g.w + u]; }
    if (q[1] === q[3]) { for (var u = q[0]; u < q[2]; u++) if (f(u, q[1] - 1) !== f(u, q[1])) return true; }
    else { for (var v = q[1]; v < q[3]; v++) if (f(q[0] - 1, v) !== f(q[0], v)) return true; }
    return false;
  }
  function flips(g) {
    var out = [], d = pub(g);
    d.segs.forEach(function (s, i) {
      if (onOutline(g, s)) return;
      var e = { w: d.w, h: d.h, fill: d.fill, segs: d.segs.map(function (q, j) { return j === i ? [q[0], q[1], q[2], q[3], 3 - q[4]] : q; }) };
      out.push(grid(e));
    });
    return out;
  }

  // Shortcut solvers (share of the key among the 4 options): most / fewest solid units, most / fewest
  // dotted units, largest / smallest filled area, most like the others, odd one out.
  function pickShare(scores, high) {
    var best = high ? -INF : INF, ties = 0, i;
    for (i = 0; i < scores.length; i++) if (high ? scores[i] > best : scores[i] < best) best = scores[i];
    for (i = 0; i < scores.length; i++) if (scores[i] === best) ties++;
    return scores[0] === best ? 1 / ties : 0;
  }
  // "Lines only": the same, solid and dotted taken alike (where lines are, not how they are drawn).
  var SOLVERS = ['most solid', 'fewest solid', 'most dotted', 'fewest dotted', 'largest area', 'smallest area', 'like the others', 'odd one out',
    'like the others (lines only)', 'odd one out (lines only)', 'most like a given view',
    // v1.2 (RV-items-1.2 H2, M5): what the eye counts, the line pieces (a run of one style along a grid line;
    // unit counts were held, pieces were not: the busiest drawing was the key 84-93 % on the band), and the
    // drawing farthest from (or nearest to) its nearest neighbour
    'most pieces', 'fewest pieces', 'farthest from its nearest neighbour', 'nearest to its nearest neighbour'];
  function pieces(g) {
    var n = 0, x, y, sv, prev;
    for (y = 0; y <= g.h; y++) { prev = 0; for (x = 0; x < g.w; x++) { sv = g.hs[y * g.w + x]; if (sv && sv !== prev) n++; prev = sv; } }
    for (x = 0; x <= g.w; x++) { prev = 0; for (y = 0; y < g.h; y++) { sv = g.vs[y * (g.w + 1) + x]; if (sv && sv !== prev) n++; prev = sv; } }
    return n;
  }
  function layoutOf(g) { var out = '', k; for (k = 0; k < g.hs.length; k++) out += g.hs[k] ? 1 : 0; for (k = 0; k < g.vs.length; k++) out += g.vs[k] ? 1 : 0; return out; }
  function gdistLines(a, b) {
    var n = 0, k;
    for (k = 0; k < a.hs.length; k++) if (!a.hs[k] !== !b.hs[k]) n++;
    for (k = 0; k < a.vs.length; k++) if (!a.vs[k] !== !b.vs[k]) n++;
    return n;
  }
  // gs[0] is the key; giv: the given views (the stem-based solver: the option most like a given view
  // of the same size).
  function shares(gs, giv) {
    function sums(f) { return gs.map(function (a, i) { var s = 0; gs.forEach(function (b2, j) { if (i !== j) s += f(a, b2); }); return s; }); }
    var c = gs.map(counts), sum = sums(gdist), sumL = sums(gdistLines);
    var sol = c.map(function (x) { return x.solid; }), dot = c.map(function (x) { return x.dotted; }), ar = c.map(function (x) { return x.area; });
    var like = gs.map(function (o) { var m = 99; (giv || []).forEach(function (v) { if (v.w === o.w && v.h === o.h) m = Mth.min(m, gdist(o, v)); }); return m; });
    var pc = gs.map(pieces), nn = gs.map(function (a, i) { var m = INF; gs.forEach(function (b2, j) { if (i !== j) m = Mth.min(m, gdist(a, b2)); }); return m; });
    return [pickShare(sol, true), pickShare(sol, false), pickShare(dot, true), pickShare(dot, false), pickShare(ar, true), pickShare(ar, false), pickShare(sum, false), pickShare(sum, true),
      pickShare(sumL, false), pickShare(sumL, true), pickShare(like, false), pickShare(pc, true), pickShare(pc, false), pickShare(nn, true), pickShare(nn, false)];
  }
  var WEIGHTS = [1, 1, 1, 1, 1.8, 3, 2, 1.5, 2, 1, 2, 2.5, 2, 2, 1.5];

  // The same shares as shares(), from per-drawing counts and pairwise distances computed once per call
  // (the chooser scores a few hundred sets).
  var STRICT_MAX = 0.34; // the band drops a set where a cheap rule picks the key at better than 1 in 3
  function chooseFoils(rng, keyG, pool, need, giv, strict) {
    var idx = rshuffle(rng, pool.map(function (_, i) { return i; })).slice(0, 13), best = null, bestScore = INF, bestSh = null;
    // On the starter band every solver aims at chance itself (a share of 1/4 on each item, ties
    // included), and a set where any cheap rule finds the key half the time or more is dropped (strict):
    // its small boxes leave few drawings, and random targets would leave each setting lopsided.
    var want = SOLVERS.map(function () { return strict ? 0.25 : rng.chance(0.25) ? 1 : 0; });
    var gs = [keyG].concat(idx.map(function (i) { return pool[i].g; })), n = gs.length, C = gs.map(counts), PC = gs.map(pieces), G = [], GL = [];
    var gsol = (giv || []).map(function (v) { return counts(v).solid; });
    var like = gs.map(function (o) { var m = 99; (giv || []).forEach(function (v) { if (v.w === o.w && v.h === o.h) m = Mth.min(m, gdist(o, v)); }); return m; });
    for (var i = 0; i < n; i++) { G.push([]); GL.push([]); for (var j = 0; j < n; j++) { G[i].push(j < i ? G[j][i] : i === j ? 0 : gdist(gs[i], gs[j])); GL[i].push(j < i ? GL[j][i] : i === j ? 0 : gdistLines(gs[i], gs[j])); } }
    function sharesOf(m) { // m: indices into gs, m[0] = 0 (the key)
      function col(f) { return m.map(f); }
      function sums(M) { return m.map(function (a) { var t = 0; m.forEach(function (b2) { if (a !== b2) t += M[a][b2]; }); return t; }); }
      var sol = col(function (q) { return C[q].solid; }), dot = col(function (q) { return C[q].dotted; }), ar = col(function (q) { return C[q].area; }), su = sums(G), sl = sums(GL), lk = col(function (q) { return like[q]; });
      var pcs = col(function (q) { return PC[q]; }), nn = m.map(function (a) { var t = INF; m.forEach(function (b2) { if (a !== b2) t = Mth.min(t, G[a][b2]); }); return t; });
      var out = [pickShare(sol, true), pickShare(sol, false), pickShare(dot, true), pickShare(dot, false), pickShare(ar, true), pickShare(ar, false), pickShare(su, false), pickShare(su, true),
        pickShare(sl, false), pickShare(sl, true), pickShare(lk, false), pickShare(pcs, true), pickShare(pcs, false), pickShare(nn, true), pickShare(nn, false)];
      // the band also holds "as many solid units as a given view" (a stem-based count; tests/node)
      if (strict) out.push(pickShare(col(function (q) { return gsol.indexOf(C[q].solid) >= 0 ? 1 : 0; }), true));
      return out;
    }
    for (var a = 0; a < idx.length; a++) for (var b = a + 1; b < idx.length; b++) for (var c = b + 1; c < idx.length; c++) {
      var set = [pool[idx[a]], pool[idx[b]], pool[idx[c]]];
      if (need && !need(set)) continue;
      var sh = sharesOf([0, a + 1, b + 1, c + 1]), score = 0;
      for (var k = 0; k < sh.length; k++) if (!strict || k < 11 || k > 14) score += (WEIGHTS[k] || 1.5) * Mth.abs(sh[k] - (want[k] === undefined ? 0.25 : want[k]));
      if (score < bestScore - 1e-9) { bestScore = score; best = set; bestSh = sh; }
    }
    // The pool can leave no choice (outline foils mostly add cubes, so the key's outline tends to be
    // the smallest, and the key tends to be the drawing most like a given view of its size): such a
    // set is dropped more than half the time, and the item is drawn again.
    if (best && ((bestSh[5] >= 0.5 && !want[5]) || (bestSh[6] >= 0.5 && !want[6]) || (bestSh[10] >= 0.5 && !want[10])) && rng.chance(0.6)) return null;
    // The starter band's foils (no dotted line, no search-only foil, all from one small box) tend to
    // share what the key lacks, leaving the key the odd one out: there every lopsided set is dropped.
    // (the solvers added on 22 Nov stay out of the band's choice: in most band boxes no wrong drawing that the
    // band allows has as many line pieces as the key, and the outright rule left the band no set at all; DECISIONS)
    if (best && strict && bestSh.some(function (x, k) { return (k < 11 || k > 14) && x >= STRICT_MAX; })) return null;
    return best;
  }

  /* ------------------------------------------------------------ generate */
  var stats = { tries: 0, nulls: 0, over: 0, invalid: 0, errors: 0, fallbacks: 0, lastInvalid: null, lastError: null, nodes: 0, noFit: 0, fewCands: 0, noSet: 0, noSpec: 0, closeSet: 0, levelMiss: 0, holeHidden: 0, noSquare: 0, noX: 0, apart: 0 };
  function lvl(params, k, n) { var x = params ? params[k] : 0; return Number.isInteger(x) && x >= 0 && x < n ? x : 0; }
  function cleanParams(params) {
    return { cubes: lvl(params, 'cubes', NOBJ), grid: lvl(params, 'grid', GRIDS.length), missing: lvl(params, 'missing', MISSING.length), foil: lvl(params, 'foil', FOILS.length) };
  }
  function cubeCount(b) { var n = 0; for (var k = 0; k < b.hm.length; k++) n += b.hm[k]; return n; }
  // The starter band's structures (note D2 §3.7): 4–6 cubes, two high at most and somewhere, in a box of
  // at most 2 × 3 (grid level 1: up to 3 × 3). The note's 3–4 cubes cannot be two high in a box at least
  // two cubes wide and deep, and smaller boxes leave too few drawings for three balanced foils (DECISIONS).
  function bandBox(b, grid) { return b.H === 2 && b.W >= 2 && b.D >= 2 && Mth.max(b.W, b.D) <= 3 && (grid === 1 || Mth.min(b.W, b.D) <= 2); }
  // Every band structure, enumerated once (boxes 2 × 2, 2 × 3, 3 × 2 and, for grid level 1, 3 × 3;
  // heights 0–2), with per missing view whether its drawing has a dotted line.
  var bandLists = {};
  function bandAll(boxes) {
    var out = [];
    (boxes || [[2, 2], [2, 3], [3, 2], [3, 3]]).forEach(function (wd) { out = out.concat(bandBoxList(wd[0], wd[1])); });
    return out;
  }
  function bandBoxList(W, D) { // lazily, per box: a 3 × 3 box is 19 683 height maps
    var key = W + 'x' + D;
    if (bandLists[key]) return bandLists[key];
    var bandList = bandLists[key] = [];
    (function () {
      var n = W * D, tot = Mth.pow(3, n);
      for (var code = 0; code < tot; code++) {
        var hm = new Int8Array(n), c = code, N = 0, H = 0;
        for (var k = 0; k < n; k++) { hm[k] = c % 3; c = (c - hm[k]) / 3; N += hm[k]; if (hm[k] > H) H = hm[k]; }
        if (N < 4 || N > 6 || H !== 2) continue;
        var b = { W: W, H: 2, D: D, hm: hm };
        if (!fills(b) || !connectedBox(b)) continue;
        b.dotted = {};
        VIEWS.forEach(function (v) { b.dotted[v] = counts(drawView(b, v)).dotted > 0; });
        bandList.push(b);
      }
    })();
    return bandList;
  }
  // The missing view is three cubes wide (the top: at least 2 × 3), so there are drawings enough for
  // three foils without a dotted line.
  function wide(b, miss) { return miss === 'end' ? b.D === 3 : miss === 'front' ? b.W === 3 : b.W * b.D >= 6; }
  // Every drawing of view `miss` that a structure in a W × D box two high can have (every height map
  // that fills the box and hangs together), once per box and view: the band's foil pool.
  var bandDraw = {};
  function bandDrawings(W, D, miss) {
    var k0 = W + 'x' + D + miss;
    if (bandDraw[k0]) return bandDraw[k0];
    var out = [], seen = {}, n = W * D, tot = Mth.pow(3, n);
    for (var code = 0; code < tot; code++) {
      var hm = new Int8Array(n), c = code;
      for (var k = 0; k < n; k++) { hm[k] = c % 3; c = (c - hm[k]) / 3; }
      var b = { W: W, H: 2, D: D, hm: hm };
      if (!fills(b) || !connectedBox(b)) continue;
      var g = drawView(b, miss), cd = codeOf(g);
      if (!seen[cd]) { seen[cd] = 1; out.push({ g: g, code: cd, dotted: counts(g).dotted > 0 }); }
    }
    bandDraw[k0] = out;
    return out;
  }
  // The exhaustive search and the drawings it allows, remembered per box and pair of given views (the
  // band's boxes are few).
  var bandRes = {};
  function bandSearch(given, W, H, D, miss) {
    var k0 = W + 'x' + H + 'x' + D + miss + Object.keys(given).sort().map(function (v) { return codeOf(given[v]); }).join('|');
    if (!bandRes[k0]) { var r = search(given, W, H, D); bandRes[k0] = { res: r, poss: r.over ? null : possibleViews(r, W, H, D, miss) }; }
    return bandRes[k0];
  }
  function bandStructure(rng, grid, miss, foil) {
    // A missing front view takes the 3 × 2 box for outline foils and the 3 × 3 box for same-outline
    // foils, at either grid level: a 3 × 2 front has too few same-outline drawings, and in a 3 × 3 box
    // the key's front outline is nearly always the smallest (DECISIONS).
    // v1.2 (fresh-player run, 19 Nov: one session dealt the same starter item twice): a missing end view with
    // same-outline or solid-or-dotted foils takes the 3 × 3 box too, at either grid level, as the front view
    // does: a 2 × 3 box gave those settings four stems in all (DECISIONS).
    var boxes = miss === 'front' ? [foil ? [3, 3] : [3, 2]] : miss === 'end' && foil ? [[2, 3], [3, 3]] : [[2, 2], [2, 3], [3, 2]].concat(grid === 1 ? [[3, 3]] : []).filter(function (wd) { return wide({ W: wd[0], D: wd[1] }, miss); });
    var list = bandAll(boxes).filter(function (b) { return bandBox(b, miss === 'front' || (miss === 'end' && foil) ? 1 : grid) && (!miss || !b.dotted[miss]); });
    var b = list[rint(rng, 0, list.length - 1)];
    return { W: b.W, H: b.H, D: b.D, hm: new Int8Array(b.hm) };
  }
  function build(rng, p, relaxed) {
    var band = p.cubes === 0, G = GRIDS[p.grid], win = CUBES[p.cubes], drawn = DRAWN[p.cubes], N = rint(rng, drawn[0], Mth.min(drawn[1], G * G * HMAX));
    // A hidden parent and its neighbours in the same box: the key is one of them, and the foils come
    // from the whole family, so the key is not the structure the others were made from (its outline
    // is then neither the smallest nor the most typical one by construction). The shown structure
    // keeps the level's cube count (v1.2: the labels hold).
    // The band draws its structure straight from the enumerated list and its foils from every drawing
    // a structure in the same box can have (bandDrawings), so no parent is needed there.
    var b0 = band ? bandStructure(rng, p.grid, MISSING[p.missing], p.foil) : boxOf(VL().randomStructure(rng, G, N));
    if (!b0 || (!band && (b0.W < 2 || b0.D < 2 || b0.H < 2))) return null;
    function fits(s) { var n = cubeCount(s); return n >= win[0] && n <= win[1]; }
    var fam = band ? [] : neighbours(rng, b0), famIn = fam.filter(fits);
    var b = band ? b0 : famIn.length && rng.chance(0.85) ? famIn[rint(rng, 0, famIn.length - 1)] : fits(b0) ? b0 : null;
    if (!b) { stats.noFit++; return null; }
    var miss = MISSING[p.missing], views = {}, given = {};
    VIEWS.forEach(function (v) { views[v] = drawView(b, v); if (v !== miss) given[v] = views[v]; });
    var bs = band ? bandSearch(given, b.W, b.H, b.D, miss) : null, res = bs ? bs.res : search(given, b.W, b.H, b.D);
    stats.nodes += res.nodes;
    if (res.over) { stats.over++; return null; }
    var poss = bs ? bs.poss : possibleViews(res, b.W, b.H, b.D, miss), keyG = views[miss], keyCode = codeOf(keyG);
    if (!poss[keyCode]) return null;
    if (band && counts(keyG).dotted) return null; // the band's key has no dotted line
    var pool = [], seen = {};
    seen[keyCode] = 1;
    function admit(g, src) {
      if (!g || g.w !== keyG.w || g.h !== keyG.h) return;
      var c = codeOf(g);
      if (seen[c] || poss[c]) return;
      seen[c] = 1;
      pool.push({ g: g, code: c, kind: kindOf(keyG, g), src: src, d: gdist(keyG, g) });
    }
    if (band) { // solid lines only; the level's kind; the 40 nearest to the key before the costlier tests
      var wantOutline = FOILS[p.foil] === 'outline', near = [];
      bandDrawings(b.W, b.D, miss).forEach(function (x) {
        if (x.dotted || x.code === keyCode || poss[x.code]) return;
        if ((kindOf(keyG, x.g) === 'outline') !== wantOutline) return;
        near.push({ x: x, d: gdist(keyG, x.g) });
      });
      near.sort(function (u, v) { return u.d - v.d; }).slice(0, 40).forEach(function (u) { admit(u.x.g, 'box'); });
    }
    else [b0].concat(fam, neighbours(rng, b)).forEach(function (nb) { if (nb !== b) admit(drawView(nb, miss), 'neighbour'); });
    if (miss !== 'top' && !band) flips(keyG).forEach(function (g) { admit(g, 'flip'); });
    var level = FOILS[p.foil], cands, need = null;
    // At the dashes level a "lines" foil can come with its own flip, so the key's line layout is not
    // the only one shared by two options (the "lines only" solvers).
    if (level === 'dashes' && miss !== 'top') rshuffle(rng, pool.filter(function (o) { return o.kind === 'lines'; })).slice(0, 6).forEach(function (o) { flips(o.g).forEach(function (g) { admit(g, 'flip2'); }); });
    // The band: no foil that only the exhaustive search rejects (each fails the hull or the line test).
    // No option on the band has a dotted line (the key never does), so dotted lines are no cue there.
    if (band) pool = pool.filter(function (o) { var t = Object.assign({}, views); t[miss] = o.g; return !counts(o.g).dotted && (hullFails(t.top, t.front, t.end, b.W, b.H, b.D) || alignFails(t.top, t.front, t.end)); });
    if (level === 'outline') cands = pool.filter(function (o) { return o.kind === 'outline'; });
    else if (band) { // same outline, other lines; the subtlest level takes the closest of them
      cands = pool.filter(function (o) { return o.kind !== 'outline' && (level === 'lines' || o.d <= 3); });
      if (level === 'lines') need = function (s) { return s.filter(function (o) { return o.kind === 'lines'; }).length >= 2; };
    }
    else {
      cands = pool.filter(function (o) { return o.kind !== 'outline'; });
      if (level === 'lines') need = function (s) { return s.filter(function (o) { return o.kind === 'lines'; }).length >= 2; };
      else if (miss !== 'top') need = function (s) { // a dashes foil, and the key's line layout no more common than another's
        if (!s.some(function (o) { return o.kind === 'dashes'; })) return false;
        var groups = {}, kl = layoutOf(keyG);
        [keyG].concat(s.map(function (o) { return o.g; })).forEach(function (g) { var c = layoutOf(g); groups[c] = (groups[c] || 0) + 1; });
        return groups[kl] === 4 || Object.keys(groups).some(function (c) { return c !== kl && groups[c] >= groups[kl]; });
      };
      else cands = cands.filter(function (o) { return o.d <= 3; });
    }
    if (cands.length < 3) { stats.fewCands++; return null; }
    // The band's pool holds every drawing of the box, mostly far from the key, which would leave the
    // key the odd one out: the chooser sees the nearest eight and five others.
    if (band && cands.length > 13) {
      var near = cands.slice().sort(function (x, y) { return x.d - y.d; });
      cands = near.slice(0, 8).concat(rshuffle(rng, near.slice(8)).slice(0, 5));
    }
    var set = chooseFoils(rng, keyG, cands, need, Object.keys(given).map(function (v) { return given[v]; }), band && !relaxed);
    if (!set) { stats.noSet++; return null; }
    var perm = rshuffle(rng, [0, 1, 2, 3]), givenPub = {};
    Object.keys(given).forEach(function (v) { givenPub[v] = pub(given[v]); });
    var options = perm.map(function (i) {
      if (i === 0) return { kind: 'key', drawing: pub(keyG) };
      var o = set[i - 1], t = Object.assign({}, views);
      t[miss] = o.g;
      return { kind: o.kind, why: hullFails(t.top, t.front, t.end, b.W, b.H, b.D) ? 'hull' : alignFails(t.top, t.front, t.end) ? 'align' : 'search', drawing: pub(o.g) };
    });
    return {
      W: b.W, H: b.H, D: b.D, heights: rowsOf(b), missing: miss, given: givenPub, key: perm.indexOf(0), options: options,
      structures: res.sols.length, possible: Object.keys(poss).length,
    };
  }

  /* ------------------------------------------------------------ validate (independent) */
  function okRows(item, band) {
    var W = item.W, H = item.H, D = item.D, r = item.heights;
    if (![W, H, D].every(function (n) { return Number.isInteger(n) && n >= 1; }) || W > 4 || D > 4 || H > HMAX || (!band && (W < 2 || D < 2))) return 'bad box';
    if (!Array.isArray(r) || r.length !== D) return 'heights must have D rows';
    var hm = new Int8Array(W * D);
    for (var z = 0; z < D; z++) {
      if (!Array.isArray(r[z]) || r[z].length !== W) return 'heights row ' + z + ' must have W columns';
      for (var x = 0; x < W; x++) { var v = r[z][x]; if (!(Number.isInteger(v) && v >= 0 && v <= H)) return 'height out of range'; hm[z * W + x] = v; }
    }
    var b = { W: W, H: H, D: D, hm: hm };
    if (!fills(b)) return 'the structure does not fill its box';
    if (!connectedBox(b)) return 'the structure is not connected';
    return b;
  }
  function validate(item) {
    if (item && item.solid) return MISSING.indexOf(item.missing) < 0 ? 'unknown missing view' : validateSolid(item);
    try {
      if (!item || MISSING.indexOf(item.missing) < 0) return 'unknown missing view';
      var pp = cleanParams(item.params), band = pp.cubes === 0, b = okRows(item, band);
      if (typeof b === 'string') return b;
      var nc = cubeCount(b), win = CUBES[pp.cubes];
      if (nc < win[0] || nc > win[1]) return 'the structure has ' + nc + ' cubes, outside its level\'s ' + win.join('–');
      var bandWide = pp.grid || item.missing === 'front' || (item.missing === 'end' && pp.foil);
      if (band && !bandBox(b, bandWide ? 1 : 0)) return 'starter: at most two high, in a box of at most ' + (bandWide ? '3 × 3' : '2 × 3');
      var W = b.W, H = b.H, D = b.D, miss = item.missing, rows = item.heights, true3 = {}, given = {};
      VIEWS.forEach(function (v) { true3[v] = drawRay(rows, W, H, D, v); });
      var gv = VIEWS.filter(function (v) { return v !== miss; });
      if (!item.given || Object.keys(item.given).sort().join() !== gv.slice().sort().join()) return 'the stem must give exactly the two other views';
      for (var i = 0; i < gv.length; i++) {
        var g = grid(item.given[gv[i]]);
        if (!g || !sameGrid(g, true3[gv[i]])) return 'the ' + gv[i] + ' view in the stem is not the structure\'s';
        given[gv[i]] = g;
      }
      if (!Array.isArray(item.options) || item.options.length !== 4) return 'needs 4 options';
      if (!(Number.isInteger(item.key) && item.key >= 0 && item.key < 4)) return 'key out of range';
      var og = item.options.map(function (o) { return o && grid(o.drawing); });
      if (og.some(function (g2) { return !g2; })) return 'an option has no readable drawing';
      if (!sameGrid(og[item.key], true3[miss])) return 'the key is not the ' + miss + ' view';
      for (i = 0; i < 4; i++) for (var j = i + 1; j < 4; j++) if (gdist(og[i], og[j]) < 1) return 'options ' + i + ' and ' + j + ' are the same drawing';
      // Exactly one option is possible: every structure with the two given views, enumerated.
      var res = search(given, W, H, D);
      if (res.over) return 'the search went over its bound';
      var poss = possibleViews(res, W, H, D, miss);
      if (!poss[codeOf(true3[miss])]) return 'the search missed the key';
      // The second search (drawRay only) must find the same structures.
      var res2 = searchRay(given, W, H, D);
      if (res2.over) return 'the second search went over its bound';
      if (res2.sols.length !== res.sols.length) return 'the two searches disagree (' + res.sols.length + ' and ' + res2.sols.length + ' structures)';
      var poss2 = {};
      res2.sols.forEach(function (r) { poss2[codeOf(drawRay(r, W, H, D, miss))] = 1; });
      if (!poss2[codeOf(true3[miss])]) return 'the second search missed the key';
      for (i = 0; i < 4; i++) {
        if (i === item.key) continue;
        var o = item.options[i], t = { top: true3.top, front: true3.front, end: true3.end };
        if (og[i].w !== og[item.key].w || og[i].h !== og[item.key].h) return 'option ' + i + ' has another size';
        if (poss[codeOf(og[i])] || poss2[codeOf(og[i])]) return 'option ' + i + ' is the ' + miss + ' view of another structure with the same two views';
        if (o.kind !== kindOf(true3[miss], og[i])) return 'option ' + i + ' is not of its stated kind';
        t[miss] = og[i];
        var why = hullFails(t.top, t.front, t.end, W, H, D) ? 'hull' : alignFails(t.top, t.front, t.end) ? 'align' : 'search';
        if (o.why !== why) return 'option ' + i + ' gives the wrong reason (' + o.why + ', not ' + why + ')';
        if (band && why === 'search') return 'starter: option ' + i + ' is ruled out by the exhaustive search alone';
      }
      if (band && counts(true3[miss]).dotted) return 'starter: the key has a dotted line';
      return true;
    } catch (e) { return 'validate threw: ' + (e && e.message); }
  }
  /* ============================================================ profile solids (version 3; PLAN milestone 8, O49) */
  // Object class (said on the rules card): a block in which every cut runs straight through, along the line
  // of sight of one of the two views given. Such a solid is the intersection of two prisms, S = E1 ∩ E2,
  // each a profile (polygons on a half-unit lattice; round holes as 32-gons) pushed straight through the box
  // along one given view's axis. Every solid of the class is the intersection of the prisms of its own two
  // outlines (S lies in the prism of each of its outlines, and each outline lies in its profile), so the two
  // given views fix the solid (a hole of a profile always shows in the other given view, so the drawings tell
  // a hole from a face), and with it the missing view: exactly one option can be right by construction.
  // Axes 0 x (left → right), 1 y (up), 2 z (back → front); the box [0, W] × [0, H] × [0, D]. A profile seen
  // along axis a has plane coordinates (u, v) = PLANE[a] (a 0: (z, y); 1: (x, z); 2: (x, y)).
  //   profile { ax, loops: [{ pts: [[u, v], …], round?: { c: [u, v], r } }] } (even-odd; a round loop's points
  //   are smooth: its wall shows a line only as a contour, where the view runs along its tangent)
  //   solid   { W, H, D, prof: [profile, profile] }
  // Drawings: { w, h, segs: [[u0, v0, u1, v1, style], …], solid: true } in the view's own frame (top (x, D − z),
  // front (x, y), end (D − z, y)), maximal runs on each line, style 1 seen, 2 hidden (solid wins where both).
  var PLANE = [[2, 1], [0, 2], [0, 1]];
  var VAX = { end: 0, top: 1, front: 2 };
  function num(a, b) { return a - b; }
  function r6(x) { return Mth.round(x * 1e6) / 1e6 || 0; }
  function r4(x) { return Mth.round(x * 1e4) / 1e4 || 0; }
  function rectLoop(u0, v0, u1, v1) { return { pts: [[u0, v0], [u1, v0], [u1, v1], [u0, v1]] }; }
  function roundLoop(cu, cv, r) {
    var pts = [];
    for (var i = 0; i < 32; i++) { var a = i * Mth.PI / 16; pts.push([r6(cu + r * Mth.cos(a)), r6(cv + r * Mth.sin(a))]); }
    return { pts: pts, round: { c: [cu, cv], r: r } };
  }
  function inLoops(loops, u, v) {
    var inside = false;
    for (var l = 0; l < loops.length; l++) {
      var P = loops[l].pts, n = P.length;
      for (var i = 0, j = n - 1; i < n; j = i++) {
        var a = P[i], b = P[j];
        if ((a[1] > v) !== (b[1] > v) && u < (b[0] - a[0]) * (v - a[1]) / (b[1] - a[1]) + a[0]) inside = !inside;
      }
    }
    return inside;
  }
  // Parameters t where the 2D line p + t·d crosses the loops (half-open by side, so parity holds at vertices).
  function lineCross(loops, p, d) {
    var out = [];
    for (var l = 0; l < loops.length; l++) {
      var P = loops[l].pts, n = P.length;
      for (var i = 0, j = n - 1; i < n; j = i++) {
        var a = P[j], b = P[i];
        var sa = d[0] * (a[1] - p[1]) - d[1] * (a[0] - p[0]) > 0, sb = d[0] * (b[1] - p[1]) - d[1] * (b[0] - p[0]) > 0;
        if (sa === sb) continue;
        var e0 = b[0] - a[0], e1 = b[1] - a[1], den = d[0] * e1 - d[1] * e0;
        if (den === 0) continue;
        out.push(((a[0] - p[0]) * e1 - (a[1] - p[1]) * e0) / den);
      }
    }
    return out.sort(num);
  }
  function pairs(c) { var iv = []; for (var j = 0; j + 1 < c.length; j += 2) if (c[j + 1] > c[j]) iv.push([c[j], c[j + 1]]); return iv; }
  function andIv(A, B) {
    var out = [], i = 0, j = 0;
    while (i < A.length && j < B.length) {
      var lo = Mth.max(A[i][0], B[j][0]), hi = Mth.min(A[i][1], B[j][1]);
      if (hi > lo) out.push([lo, hi]);
      if (A[i][1] < B[j][1]) i++; else j++;
    }
    return out;
  }
  function inIv(iv, t) { for (var i = 0; i < iv.length; i++) if (iv[i][0] < t && t < iv[i][1]) return true; return false; }
  // The parameter intervals where X + t·dir is inside the solid.
  function rayIn(S, X, dir) {
    var res = null;
    for (var i = 0; i < 2; i++) {
      var pr = S.prof[i], pl = PLANE[pr.ax], p = [X[pl[0]], X[pl[1]]], d = [dir[pl[0]], dir[pl[1]]], iv;
      if (Mth.abs(d[0]) + Mth.abs(d[1]) < 1e-12) { if (!inLoops(pr.loops, p[0], p[1])) return []; iv = [[-INF, INF]]; } else iv = pairs(lineCross(pr.loops, p, d));
      res = res ? andIv(res, iv) : iv;
    }
    return res;
  }
  // The inside of a profile along the line where its plane coordinate k (0 u, 1 v) is w: intervals of the other.
  function slice1(loops, k, w) { var p = [0, 0], d = [0, 0]; p[k] = w; d[1 - k] = 1; return pairs(lineCross(loops, p, d)); }
  // Is there an edge of the solid along corner j of loop L, given where the other prism holds material around
  // it (h 0 all round, 1 only at higher, −1 only at lower values of plane axis i3)? Yes unless the material
  // around the corner line is nothing, everything or a half-plane.
  var TAU = 2 * Mth.PI;
  function arcParts(s, e) { s = ((s % TAU) + TAU) % TAU; e = ((e % TAU) + TAU) % TAU; if (e <= s) e += TAU; return e <= TAU ? [[s, e]] : [[s, TAU], [0, e - TAU]]; }
  function sectorEdge(loops, L, j, i3, h) {
    var P = L.pts, n = P.length, V = P[j], a = P[(j + 1) % n], b = P[(j + n - 1) % n];
    var t1 = Mth.atan2(a[1] - V[1], a[0] - V[0]), t2 = Mth.atan2(b[1] - V[1], b[0] - V[0]), w = (((t2 - t1) % TAU) + TAU) % TAU, mid = t1 + w / 2;
    var K = inLoops(loops, V[0] + 1e-5 * Mth.cos(mid), V[1] + 1e-5 * Mth.sin(mid)) ? arcParts(t1, t2) : arcParts(t2, t1);
    if (h) {
      var s0 = i3 === 0 ? (h > 0 ? -Mth.PI / 2 : Mth.PI / 2) : (h > 0 ? 0 : Mth.PI), H = arcParts(s0, s0 + Mth.PI), out = [];
      K.forEach(function (p) { H.forEach(function (q) { var lo = Mth.max(p[0], q[0]), hi = Mth.min(p[1], q[1]); if (hi > lo + 1e-12) out.push([lo, hi]); }); });
      K = out;
    }
    var tot = 0; K.forEach(function (p) { tot += p[1] - p[0]; });
    if (tot < 1e-9 || tot > TAU - 1e-9) return false;
    var arcs = K.length, has0 = K.some(function (p) { return p[0] < 1e-12; }), hasT = K.some(function (p) { return p[1] > TAU - 1e-12; });
    if (has0 && hasT) arcs--;
    return !(arcs === 1 && Mth.abs(tot - Mth.PI) < 1e-9);
  }
  function eachEdge(loops, fn) { loops.forEach(function (L) { var P = L.pts, n = P.length; for (var i = 0; i < n; i++) fn(P[i], P[(i + 1) % n], L); }); }
  // The solid's edges (3D segments) for a view along dir: the corner lines of each profile along its axis where
  // the solid has an edge, a round loop's contour lines (where its wall turns from facing the viewer to facing
  // away), and the lines where a wall of one prism meets a wall of the other.
  function solidEdges(S, dir) {
    var out = [];
    for (var i = 0; i < 2; i++) cornerLines(S.prof[i], S.prof[1 - i], dir, out);
    wallLines(S.prof[0], S.prof[1], out);
    return out;
  }
  function cornerLines(A, B, dir, out) {
    var k1 = A.ax, pA = PLANE[k1], k3 = 3 - k1 - B.ax, pB = PLANE[B.ax], i3 = pA.indexOf(k3), j3 = pB.indexOf(k3);
    A.loops.forEach(function (L) {
      var P = L.pts, n = P.length;
      for (var j = 0; j < n; j++) {
        var V = P[j];
        if (L.round) { // a contour only: one side of V faces the viewer, the other faces away
          var e0 = dir[pA[0]], e1 = dir[pA[1]], a = P[(j + n - 1) % n], b = P[(j + 1) % n];
          if (Mth.abs(e0) + Mth.abs(e1) < 1e-9) continue;
          if (((V[1] - a[1]) * e0 - (V[0] - a[0]) * e1) * ((b[1] - V[1]) * e0 - (b[0] - V[0]) * e1) >= 0) continue;
        }
        var lo = slice1(B.loops, j3, V[i3] - 1e-6), hi = slice1(B.loops, j3, V[i3] + 1e-6), cuts = [];
        lo.concat(hi).forEach(function (iv) { cuts.push(iv[0], iv[1]); });
        cuts.sort(num);
        for (var q = 0; q + 1 < cuts.length; q++) {
          var s0 = cuts[q], s1 = cuts[q + 1];
          if (s1 - s0 < 1e-6) continue;
          var tm = (s0 + s1) / 2, inLo = inIv(lo, tm), inHi = inIv(hi, tm);
          if (!inLo && !inHi) continue;
          if (!L.round && !sectorEdge(A.loops, L, j, i3, inLo && inHi ? 0 : inHi ? 1 : -1)) continue;
          var X0 = [0, 0, 0], X1 = [0, 0, 0];
          X0[pA[0]] = X1[pA[0]] = V[0]; X0[pA[1]] = X1[pA[1]] = V[1]; X0[k1] = s0; X1[k1] = s1;
          out.push([X0, X1]);
        }
      }
    });
  }
  function wallLines(A, B, out) {
    var k1 = A.ax, k2 = B.ax, k3 = 3 - k1 - k2, pA = PLANE[k1], pB = PLANE[k2];
    var i2 = pA.indexOf(k2), i3 = pA.indexOf(k3), j1 = pB.indexOf(k1), j3 = pB.indexOf(k3);
    eachEdge(A.loops, function (a0, a1) {
      eachEdge(B.loops, function (b0, b1) {
        var ca0 = a0[i3], ca1 = a1[i3], cb0 = b0[j3], cb1 = b1[j3], fa = Mth.abs(ca1 - ca0) < 1e-9, fb = Mth.abs(cb1 - cb0) < 1e-9;
        if (fa && fb) return;
        var X0 = [0, 0, 0], X1 = [0, 0, 0];
        if (fa) {
          if (ca0 < Mth.min(cb0, cb1) + 1e-9 || ca0 > Mth.max(cb0, cb1) - 1e-9) return; // at an end of e2: a corner line of B
          X0[k1] = X1[k1] = b0[j1] + (b1[j1] - b0[j1]) * (ca0 - cb0) / (cb1 - cb0); X0[k3] = X1[k3] = ca0; X0[k2] = a0[i2]; X1[k2] = a1[i2];
        } else if (fb) {
          if (cb0 < Mth.min(ca0, ca1) + 1e-9 || cb0 > Mth.max(ca0, ca1) - 1e-9) return; // at an end of e1: a corner line of A
          X0[k2] = X1[k2] = a0[i2] + (a1[i2] - a0[i2]) * (cb0 - ca0) / (ca1 - ca0); X0[k3] = X1[k3] = cb0; X0[k1] = b0[j1]; X1[k1] = b1[j1];
        } else {
          var lo = Mth.max(Mth.min(ca0, ca1), Mth.min(cb0, cb1)), hi = Mth.min(Mth.max(ca0, ca1), Mth.max(cb0, cb1));
          if (hi - lo < 1e-9) return;
          [X0, X1].forEach(function (X, q) {
            var c = q ? hi : lo;
            X[k3] = c; X[k2] = a0[i2] + (a1[i2] - a0[i2]) * (c - ca0) / (ca1 - ca0); X[k1] = b0[j1] + (b1[j1] - b0[j1]) * (c - cb0) / (cb1 - cb0);
          });
        }
        out.push([X0, X1]);
      });
    });
  }
  // A view: the viewer at the far + end of dir; image U = X·right + ou, V = X·up + ov; depth X·dir.
  function axisView(S, name) {
    var D = S.D;
    if (name === 'top') return { name: name, dir: [0, 1, 0], right: [1, 0, 0], up: [0, 0, -1], ou: 0, ov: D, w: S.W, h: D };
    if (name === 'front') return { name: name, dir: [0, 0, 1], right: [1, 0, 0], up: [0, 1, 0], ou: 0, ov: 0, w: S.W, h: S.H };
    return { name: name, dir: [1, 0, 0], right: [0, 0, -1], up: [0, 1, 0], ou: D, ov: 0, w: D, h: S.H };
  }
  function vdot(a, b) { return a[0] * b[0] + a[1] * b[1] + a[2] * b[2]; }
  function projP(vw, X) { return [vdot(X, vw.right) + vw.ou, vdot(X, vw.up) + vw.ov]; }
  function unproj(vw, U, V) { var a = U - vw.ou, b = V - vw.ov; return [vw.right[0] * a + vw.up[0] * b, vw.right[1] * a + vw.up[1] * b, vw.right[2] * a + vw.up[2] * b]; }
  // Hidden: material strictly nearer the viewer than the point, on both sides of the line through it.
  function hiddenAt(S, vw, a, b, M) {
    var dx = b[0] - a[0], dy = b[1] - a[1], L = Mth.hypot(dx, dy), nx = -dy / L, ny = dx / L, m = projP(vw, M), dM = vdot(M, vw.dir);
    for (var s = -1; s <= 1; s += 2) {
      var iv = rayIn(S, unproj(vw, m[0] + s * 1e-4 * nx, m[1] + s * 1e-4 * ny), vw.dir), occ = false;
      for (var i = 0; i < iv.length; i++) if (iv[i][1] > dM + 1e-6 && iv[i][1] - Mth.max(iv[i][0], dM) > 1e-6) occ = true;
      if (!occ) return false;
    }
    return true;
  }
  function cutParams(a, b, c, d, ts) {
    var r0 = b[0] - a[0], r1 = b[1] - a[1], s0 = d[0] - c[0], s1 = d[1] - c[1], rr = r0 * r0 + r1 * r1;
    var den = r0 * s1 - r1 * s0, w0 = c[0] - a[0], w1 = c[1] - a[1];
    if (Mth.abs(den) < 1e-12 * Mth.sqrt(rr * (s0 * s0 + s1 * s1))) {
      if (Mth.abs(w0 * r1 - w1 * r0) > 1e-9 * Mth.sqrt(rr)) return;
      [c, d].forEach(function (p) { var t = ((p[0] - a[0]) * r0 + (p[1] - a[1]) * r1) / rr; if (t > 1e-9 && t < 1 - 1e-9) ts.push(t); });
      return;
    }
    var t = (w0 * s1 - w1 * s0) / den, u = (w0 * r1 - w1 * r0) / den;
    if (t > 1e-9 && t < 1 - 1e-9 && u > -1e-9 && u < 1 + 1e-9) ts.push(t);
  }
  // Pieces [[u0, v0], [u1, v1], style] → maximal runs on each line, solid winning over dotted.
  function mergeRuns(pieces) {
    var groups = {}, out = [];
    pieces.forEach(function (q) {
      var a = q[0], b = q[1], dx = b[0] - a[0], dy = b[1] - a[1], L = Mth.hypot(dx, dy);
      if (L < 1e-7) return;
      dx /= L; dy /= L;
      if (dx < -1e-9 || (Mth.abs(dx) <= 1e-9 && dy < 0)) { dx = -dx; dy = -dy; }
      var off = a[0] * dy - a[1] * dx, key = r6(dx) + ',' + r6(dy) + ',' + r6(off);
      var g = groups[key] || (groups[key] = { dx: dx, dy: dy, off: off, iv: [] }), s0 = a[0] * dx + a[1] * dy, s1 = b[0] * dx + b[1] * dy;
      g.iv.push([Mth.min(s0, s1), Mth.max(s0, s1), q[2]]);
    });
    Object.keys(groups).sort().forEach(function (k) {
      var g = groups[k], xs = [], runs = [];
      g.iv.forEach(function (iv) { xs.push(iv[0], iv[1]); });
      xs.sort(num);
      for (var i = 0; i + 1 < xs.length; i++) {
        var s0 = xs[i], s1 = xs[i + 1];
        if (s1 - s0 < 1e-7) continue;
        var m = (s0 + s1) / 2, st = 0;
        g.iv.forEach(function (iv) { if (iv[0] < m && m < iv[1]) st = st === 1 || iv[2] === 1 ? 1 : 2; });
        if (!st) continue;
        var last = runs[runs.length - 1];
        if (last && last[2] === st && Mth.abs(last[1] - s0) < 1e-7) last[1] = s1; else runs.push([s0, s1, st]);
      }
      runs.forEach(function (r) {
        if (r[1] - r[0] < 2e-3) return;
        out.push([r4(r[0] * g.dx + g.off * g.dy), r4(r[0] * g.dy - g.off * g.dx), r4(r[1] * g.dx + g.off * g.dy), r4(r[1] * g.dy - g.off * g.dx), r[2]]);
      });
    });
    return out.sort(function (p, q) { for (var i = 0; i < 5; i++) if (p[i] !== q[i]) return p[i] - q[i]; return 0; });
  }
  // The hidden-line drawing of a solid in a view (vw: axisView, or any view with the same fields).
  function drawSolid(S, vw) {
    if (typeof vw === 'string') vw = axisView(S, vw);
    var segs = [], pieces = [];
    solidEdges(S, vw.dir).forEach(function (e) {
      var a = projP(vw, e[0]), b = projP(vw, e[1]);
      if (Mth.hypot(b[0] - a[0], b[1] - a[1]) > 1e-7) segs.push([a, b, e[0], e[1]]);
    });
    segs.forEach(function (s) { s.push(Mth.min(s[0][0], s[1][0]) - 1e-7, Mth.max(s[0][0], s[1][0]) + 1e-7, Mth.min(s[0][1], s[1][1]) - 1e-7, Mth.max(s[0][1], s[1][1]) + 1e-7); });
    segs.forEach(function (s, i) {
      var ts = [0, 1];
      for (var j = 0; j < segs.length; j++) {
        var o = segs[j];
        if (j !== i && o[4] <= s[5] && s[4] <= o[5] && o[6] <= s[7] && s[6] <= o[7]) cutParams(s[0], s[1], o[0], o[1], ts);
      }
      ts.sort(num);
      for (var k = 0; k + 1 < ts.length; k++) {
        var t0 = ts[k], t1 = ts[k + 1];
        if (t1 - t0 < 1e-7) continue;
        var tm = (t0 + t1) / 2, M = [0, 1, 2].map(function (c) { return s[2][c] + (s[3][c] - s[2][c]) * tm; });
        var p0 = [s[0][0] + (s[1][0] - s[0][0]) * t0, s[0][1] + (s[1][1] - s[0][1]) * t0], p1 = [s[0][0] + (s[1][0] - s[0][0]) * t1, s[0][1] + (s[1][1] - s[0][1]) * t1];
        pieces.push([p0, p1, hiddenAt(S, vw, s[0], s[1], M) ? 2 : 1]);
      }
    });
    var runs = mergeRuns(pieces), solid = runs.filter(function (q) { return q[4] === 1; });
    // a hidden line hugging a seen one (closer than a hundredth of a unit all along) cannot be seen apart from it
    runs = runs.filter(function (q) {
      if (q[4] !== 2) return true;
      for (var k = 0; k <= 4; k++) {
        var p = [q[0] + (q[2] - q[0]) * k / 4, q[1] + (q[3] - q[1]) * k / 4], near = false;
        for (var j = 0; j < solid.length && !near; j++) if (segDist2(p, solid[j]) < 0.01) near = true;
        if (!near) return true;
      }
      return false;
    });
    return { w: vw.w, h: vw.h, segs: runs, solid: true };
  }
  function segDist2(p, q) {
    var dx = q[2] - q[0], dy = q[3] - q[1], L2 = dx * dx + dy * dy, t = L2 ? Mth.max(0, Mth.min(1, ((p[0] - q[0]) * dx + (p[1] - q[1]) * dy) / L2)) : 0;
    return Mth.hypot(p[0] - q[0] - t * dx, p[1] - q[1] - t * dy);
  }
  function solidCode(g) { return g.w + 'x' + g.h + ':' + g.segs.map(function (q) { return q.join(','); }).join(';'); }
  // ---- the class's profiles. A profile spec { ax, C, O, cs, feats } holds features in neutral coordinates:
  // c along the shared axis (the missing view's line of sight; plane index cs), o along the other one.
  //   corner cut  { kind: 'step' | 'slope', ch, oh (at the high end of c, of o), sc, so (sizes along c, o) }
  //   notch       { kind: 'notch', side: 'c0' | 'c1' | 'o0' | 'o1' (the side at c = 0, c = C, o = 0, o = O),
  //                 p0, p1 (its span along the side), d (its depth) }
  //   hole        { kind: 'hole', c0, c1, o0, o1 }     round hole { kind: 'round', cc, oc, r }
  // Sizes sit on a half-unit lattice (a round hole's extremes too), at least half a unit of material is
  // left between any two features and the sides, and every line across the profile meets material
  // (so each given view's outline is its profile, and the solid is one piece).
  var HALF = 0.5;
  function profExt(S, ax, miss) { var k3 = VAX[miss], pl = PLANE[ax], ext = [S.W, S.H, S.D], cs = pl.indexOf(k3); return { C: ext[k3], O: ext[pl[1 - cs]], cs: cs }; }
  function uvOf(ps, c, o) { return ps.cs === 0 ? [c, o] : [o, c]; }
  function profLoops(ps) {
    var L = ps.cs === 0 ? ps.C : ps.O, M = ps.cs === 0 ? ps.O : ps.C, corner = [null, null, null, null], side = [null, null, null, null], holes = [];
    var SIDE = ps.cs === 0 ? { c0: 3, c1: 1, o0: 0, o1: 2 } : { c0: 0, c1: 2, o0: 3, o1: 1 }, clash = false;
    ps.feats.forEach(function (f) {
      if (f.kind === 'step' || f.kind === 'slope') {
        var uh = ps.cs === 0 ? f.ch : f.oh, vh = ps.cs === 0 ? f.oh : f.ch;
        var ck = uh ? (vh ? 2 : 1) : (vh ? 3 : 0);
        if (corner[ck]) clash = true;
        corner[ck] = { kind: f.kind, a: ps.cs === 0 ? f.sc : f.so, b: ps.cs === 0 ? f.so : f.sc };
      } else if (f.kind === 'notch') { if (side[SIDE[f.side]]) clash = true; side[SIDE[f.side]] = f; }
      else holes.push(f);
    });
    if (clash) return null;
    function cut(k) {
      var f = corner[k], cx = k === 1 || k === 2 ? L : 0, cy = k >= 2 ? M : 0;
      if (!f) return [[cx, cy]];
      var su = cx ? -1 : 1, sv = cy ? -1 : 1, A = [cx + su * f.a, cy], B = [cx, cy + sv * f.b];
      var first = k === 0 || k === 2 ? B : A, last = k === 0 || k === 2 ? A : B;
      return f.kind === 'slope' ? [first, last] : [first, [cx + su * f.a, cy + sv * f.b], last];
    }
    function notch(s) {
      var f = side[s];
      if (!f) return [];
      var p0 = f.p0, p1 = f.p1, d = f.d;
      if (s === 0) return [[p0, 0], [p0, d], [p1, d], [p1, 0]];
      if (s === 1) return [[L, p0], [L - d, p0], [L - d, p1], [L, p1]];
      if (s === 2) return [[p1, M], [p1, M - d], [p0, M - d], [p0, M]];
      return [[0, p1], [d, p1], [d, p0], [0, p0]];
    }
    var raw = [].concat(cut(0), notch(0), cut(1), notch(1), cut(2), notch(2), cut(3), notch(3)), pts = [];
    raw.forEach(function (p) { var q = pts[pts.length - 1]; if (!q || Mth.abs(q[0] - p[0]) + Mth.abs(q[1] - p[1]) > 1e-9) pts.push(p); });
    if (pts.length > 1 && Mth.abs(pts[0][0] - pts[pts.length - 1][0]) + Mth.abs(pts[0][1] - pts[pts.length - 1][1]) < 1e-9) pts.pop();
    for (var changed = true; changed;) { // drop collinear points
      changed = false;
      for (var i = 0; i < pts.length && pts.length > 3; i++) {
        var a = pts[(i + pts.length - 1) % pts.length], b = pts[i], c = pts[(i + 1) % pts.length];
        if (Mth.abs((b[0] - a[0]) * (c[1] - b[1]) - (b[1] - a[1]) * (c[0] - b[0])) < 1e-9) { pts.splice(i, 1); changed = true; break; }
      }
    }
    var loops = [{ pts: pts }];
    holes.forEach(function (f) {
      if (f.kind === 'hole') { var A = uvOf(ps, f.c0, f.o0), B = uvOf(ps, f.c1, f.o1); loops.push(rectLoop(Mth.min(A[0], B[0]), Mth.min(A[1], B[1]), Mth.max(A[0], B[0]), Mth.max(A[1], B[1]))); }
      else { var cc = uvOf(ps, f.cc, f.oc); loops.push(roundLoop(cc[0], cc[1], f.r)); }
    });
    return loops;
  }
  function segDist(p, a, b) {
    var dx = b[0] - a[0], dy = b[1] - a[1], L2 = dx * dx + dy * dy, t = L2 ? ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / L2 : 0;
    t = Mth.max(0, Mth.min(1, t));
    return Mth.hypot(p[0] - a[0] - t * dx, p[1] - a[1] - t * dy);
  }
  function segsCross(a, b, c, d) {
    function o(p, q, r) { var v = (q[0] - p[0]) * (r[1] - p[1]) - (q[1] - p[1]) * (r[0] - p[0]); return v > 1e-12 ? 1 : v < -1e-12 ? -1 : 0; }
    return o(a, b, c) * o(a, b, d) < 0 && o(c, d, a) * o(c, d, b) < 0;
  }
  // A profile of the class: simple outline inside its box touching all four sides, half a unit between
  // features, material on every line across it.
  function profOk(ps, loops) {
    if (!loops) return false;
    var L = ps.cs === 0 ? ps.C : ps.O, M = ps.cs === 0 ? ps.O : ps.C, P = loops[0].pts, i, j, k;
    if (P.length < 4) return false;
    var mn = [INF, INF], mx = [-INF, -INF];
    for (i = 0; i < P.length; i++) for (k = 0; k < 2; k++) { if (P[i][k] < mn[k]) mn[k] = P[i][k]; if (P[i][k] > mx[k]) mx[k] = P[i][k]; }
    if (Mth.abs(mn[0]) > 1e-9 || Mth.abs(mn[1]) > 1e-9 || Mth.abs(mx[0] - L) > 1e-9 || Mth.abs(mx[1] - M) > 1e-9) return false;
    var E = [];
    loops.forEach(function (lp, li) { var Q = lp.pts; for (var q = 0; q < Q.length; q++) E.push({ a: Q[q], b: Q[(q + 1) % Q.length], l: li, i: q, n: Q.length }); });
    for (i = 0; i < E.length; i++) for (j = i + 1; j < E.length; j++) {
      var e = E[i], f = E[j];
      if (e.l === f.l && loops[e.l].round) continue;
      var adj = e.l === f.l && (Mth.abs(e.i - f.i) === 1 || Mth.abs(e.i - f.i) === e.n - 1);
      if (!adj && segsCross(e.a, e.b, f.a, f.b)) return false;
    }
    for (i = 0; i < loops.length; i++) for (var pi = 0; pi < loops[i].pts.length; pi++) for (j = 0; j < E.length; j++) {
      var g = E[j];
      if (g.l === i && (loops[i].round || g.i === pi || (g.i + 1) % g.n === pi)) continue;
      if (segDist(loops[i].pts[pi], g.a, g.b) < HALF - 1e-9) return false;
    }
    for (k = 0; k < 2; k++) {
      var ext = k ? M : L;
      for (var w = 0.125; w < ext; w += 0.25) if (!slice1(loops, k, w).length) return false;
    }
    return true;
  }
  function lat(rng, lo, hi) { lo = Mth.ceil(lo * 2 - 1e-9); hi = Mth.floor(hi * 2 + 1e-9); return hi < lo ? null : rint(rng, lo, hi) / 2; }
  // One random feature of a kind in a profile of extents C × O (null when it cannot fit).
  // short: cuts at most a unit long along the sight line (the solid-or-dotted level: a cut at one end of the
  // line of sight then rarely meets the other profile's cuts, so moving it to the other end changes only
  // which of its lines are hidden).
  function newFeat(rng, kind, C, O, short) {
    var w, p0, side;
    if (kind === 'step' || kind === 'slope') {
      var f = { kind: kind, ch: rng.chance(0.5), oh: rng.chance(0.5), sc: lat(rng, 0.5, short ? 1 : C - 1), so: lat(rng, 0.5, O - 1) };
      if (kind === 'slope' && rng.chance(0.3)) { if (rng.chance(0.5) && !short) f.sc = C; else f.so = O; } // a taper along a whole side
      return f.sc && f.so ? f : null;
    }
    if (kind === 'notch') {
      side = ['c0', 'c1', 'o0', 'o1'][rint(rng, 0, 3)];
      var len = side[0] === 'c' ? O : C, deep = side[0] === 'c' ? C : O;
      w = lat(rng, 0.5, Mth.min(1.5, len - 1.5)); if (!w) return null;
      p0 = lat(rng, 0.5, len - 0.5 - w); var d = lat(rng, 0.5, short && side[0] === 'c' ? 1 : deep - 1);
      return p0 === null || !d ? null : { kind: 'notch', side: side, p0: p0, p1: p0 + w, d: d };
    }
    if (kind === 'hole') {
      var wc = lat(rng, 0.5, Mth.min(1.5, C - 1)), wo = lat(rng, 0.5, Mth.min(1.5, O - 1));
      if (!wc || !wo) return null;
      var c0 = lat(rng, 0.5, C - 0.5 - wc), o0 = lat(rng, 0.5, O - 0.5 - wo);
      return c0 === null || o0 === null ? null : { kind: 'hole', c0: c0, c1: c0 + wc, o0: o0, o1: o0 + wo };
    }
    var r = rng.chance(0.5) ? 0.5 : 0.75, cc = lat(rng, 0.5, C - 0.5 - 2 * r), oc = lat(rng, 0.5, O - 0.5 - 2 * r);
    return cc === null || oc === null ? null : { kind: 'round', cc: cc + r, oc: oc + r, r: r };
  }
  function copyFeat(f) { var g = {}; for (var k in f) g[k] = f[k]; return g; }
  function specCopy(sp) {
    return { W: sp.W, H: sp.H, D: sp.D, miss: sp.miss, prof: sp.prof.map(function (ps) { return { ax: ps.ax, C: ps.C, O: ps.O, cs: ps.cs, feats: ps.feats.map(copyFeat) }; }) };
  }
  // Holes of the two profiles never cross each other (their spans along the shared axis stay half a unit apart).
  function holesApart(sp) {
    function spans(ps) { return ps.feats.filter(function (f) { return f.kind === 'hole' || f.kind === 'round'; }).map(function (f) { return f.kind === 'hole' ? [f.c0, f.c1] : [f.cc - f.r, f.cc + f.r]; }); }
    var A = spans(sp.prof[0]), B = spans(sp.prof[1]);
    return A.every(function (a) { return B.every(function (b) { return a[1] + HALF <= b[0] + 1e-9 || b[1] + HALF <= a[0] + 1e-9; }); });
  }
  function solidOf(sp) {
    if (!holesApart(sp)) return null;
    var S = { W: sp.W, H: sp.H, D: sp.D, prof: [] };
    for (var i = 0; i < 2; i++) { var lp = profLoops(sp.prof[i]); if (!profOk(sp.prof[i], lp)) return null; S.prof.push({ ax: sp.prof[i].ax, loops: lp }); }
    return S;
  }
  // The kinds a level draws (version 3 'cubes' levels 3–6), the level's own kind first and always present.
  var SOLID_KINDS = [['step', 'notch'], ['hole', 'step', 'notch'], ['slope', 'step', 'notch', 'hole'], ['round', 'step', 'notch', 'hole', 'slope']];
  var SOLID_LABELS = ['solid: steps and notches', 'solid: a hole through', 'solid: slopes', 'solid: round holes'];
  var SIZES = [3, 3.5, 4];
  function newSpec(rng, lv, nf, miss, short) {
    var sp = { W: SIZES[rint(rng, 0, 2)], H: SIZES[rint(rng, 0, 1)], D: SIZES[rint(rng, 0, 1)], miss: miss, prof: [] };
    VIEWS.filter(function (v) { return v !== miss; }).forEach(function (v) { var e = profExt(sp, VAX[v], miss); sp.prof.push({ ax: VAX[v], C: e.C, O: e.O, cs: e.cs, feats: [] }); });
    var kinds = SOLID_KINDS[lv], want = [kinds[0]];
    while (want.length < nf) want.push(kinds[rint(rng, 0, kinds.length - 1)]);
    // one feature in each profile at least
    var where = want.map(function (_, i) { return i < 2 ? i : rint(rng, 0, 1); });
    if (rng.chance(0.5)) where = where.map(function (w, i) { return i < 2 ? 1 - w : w; });
    for (var i = 0; i < want.length; i++) {
      var ps = sp.prof[where[i]], ok = false;
      for (var t = 0; t < 30 && !ok; t++) {
        var f = newFeat(rng, want[i], ps.C, ps.O, short);
        if (!f) continue;
        ps.feats.push(f);
        if (profOk(ps, profLoops(ps)) && holesApart(sp)) ok = true; else ps.feats.pop();
      }
      if (!ok) return null;
    }
    return sp;
  }
  // The changes one feature can take (each a new spec; null where the profile breaks): mirrored along c
  // (to the other end of the missing view's line of sight) or along o, moved to the other profile, made
  // half a unit larger or smaller, moved half a unit, left out, a step made a slope or back.
  function variants(sp, pi, fi, lv) {
    var out = [], ps = sp.prof[pi], f = ps.feats[fi], C = ps.C, O = ps.O;
    function add(tag, fn, toOther) {
      var g = fn ? copyFeat(f) : null;
      if (fn && fn(g, toOther ? sp.prof[1 - pi] : ps) === false) return;
      out.push({ tag: tag, pi: pi, fi: fi, g: g, to: toOther ? 1 - pi : pi });
    }
    var isCorner = f.kind === 'step' || f.kind === 'slope';
    add('flip c', function (g) {
      if (isCorner) g.ch = !g.ch;
      else if (g.kind === 'notch') { if (g.side[0] === 'c') g.side = g.side === 'c0' ? 'c1' : 'c0'; else { var a = C - g.p1; g.p1 = C - g.p0; g.p0 = a; } }
      else if (g.kind === 'hole') { var b = C - g.c1; g.c1 = C - g.c0; g.c0 = b; } else g.cc = C - g.cc;
    });
    add('flip o', function (g) {
      if (isCorner) g.oh = !g.oh;
      else if (g.kind === 'notch') { if (g.side[0] === 'o') g.side = g.side === 'o0' ? 'o1' : 'o0'; else { var a = O - g.p1; g.p1 = O - g.p0; g.p0 = a; } }
      else if (g.kind === 'hole') { var b = O - g.o1; g.o1 = O - g.o0; g.o0 = b; } else g.oc = O - g.oc;
    });
    add('other view', function (g, q) {
      var O2 = q.O;
      if (isCorner) { if (g.so >= O) g.so = O2; else g.so = Mth.min(g.so, O2 - 1); return g.so >= 0.5; }
      if (g.kind === 'notch') { if (g.side[0] === 'c') return g.p1 <= O2 - 0.5; g.d = Mth.min(g.d, O2 - 1); return g.d >= 0.5; }
      if (g.kind === 'hole') return g.o1 <= O2 - 0.5;
      return g.oc + g.r <= O2 - 0.5;
    }, true);
    [0.5, -0.5].forEach(function (dl) {
      add(dl > 0 ? 'larger' : 'smaller', function (g) {
        if (isCorner) { if (g.sc >= C) g.so += dl; else g.sc += dl; return g.sc > 0 && g.so > 0; }
        if (g.kind === 'notch') { g.d += dl; return g.d > 0; }
        if (g.kind === 'hole') { g.c1 += dl; return g.c1 > g.c0; }
        if (g.r + dl / 2 < 0.5 || g.r + dl / 2 > 0.75) return false;
        g.r += dl / 2; g.cc += dl / 2; g.oc += dl / 2;
      });
      if (!isCorner) add(dl > 0 ? 'moved on' : 'moved back', function (g) {
        if (g.kind === 'notch') { g.p0 += dl; g.p1 += dl; } else if (g.kind === 'hole') { g.c0 += dl; g.c1 += dl; } else g.cc += dl;
      });
    });
    if (ps.feats.length > 1) add('left out', null);
    if (isCorner && lv >= 2) add(f.kind === 'step' ? 'a slope' : 'a step', function (g) { g.kind = g.kind === 'step' ? 'slope' : 'step'; });
    return out;
  }
  // A spec with changes applied (each to another feature).
  function applyVars(sp, vs) {
    var s2 = specCopy(sp), keep = s2.prof.map(function (q) { return q.feats.map(function () { return true; }); }), add = [[], []];
    vs.forEach(function (v) { keep[v.pi][v.fi] = false; if (v.g) add[v.to].push(copyFeat(v.g)); });
    s2.prof.forEach(function (q, i) { q.feats = q.feats.filter(function (_, j) { return keep[i][j]; }).concat(add[i]); });
    return s2;
  }
  // The solid is one piece (cells of a quarter unit, six-connected).
  function inSolid(S, X) { for (var i = 0; i < 2; i++) { var pl = PLANE[S.prof[i].ax]; if (!inLoops(S.prof[i].loops, X[pl[0]], X[pl[1]])) return false; } return true; }
  function connected(S) {
    var st = 0.25, nx = Mth.round(S.W / st), ny = Mth.round(S.H / st), nz = Mth.round(S.D / st), cell = new Uint8Array(nx * ny * nz), cnt = 0, first = -1, x, y, z;
    for (z = 0; z < nz; z++) for (y = 0; y < ny; y++) for (x = 0; x < nx; x++) if (inSolid(S, [(x + 0.5) * st, (y + 0.5) * st, (z + 0.5) * st])) { var k = (z * ny + y) * nx + x; cell[k] = 1; cnt++; if (first < 0) first = k; }
    if (first < 0) return false;
    var stack = [first], seen = 1; cell[first] = 2;
    while (stack.length) {
      var c = stack.pop(); x = c % nx; y = Mth.floor(c / nx) % ny; z = Mth.floor(c / (nx * ny));
      [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]].forEach(function (d) {
        var X = x + d[0], Y = y + d[1], Z = z + d[2];
        if (X < 0 || Y < 0 || Z < 0 || X >= nx || Y >= ny || Z >= nz) return;
        var q = (Z * ny + Y) * nx + X;
        if (cell[q] === 1) { cell[q] = 2; seen++; stack.push(q); }
      });
    }
    return seen === cnt;
  }
  // The outline of a view as a bitmap (quarter-unit cells, sampled at their centres).
  function outlineOf(S, name) {
    var vw = axisView(S, name), out = '';
    for (var v = 0.125; v < vw.h; v += 0.25) for (var u = 0.125; u < vw.w; u += 0.25) out += rayIn(S, unproj(vw, u, v), vw.dir).length ? '1' : '0';
    return out;
  }
  // How two drawings of one size differ: the length of line drawn in one only (pos) and drawn in both in
  // other styles (sty); with runs, the differing runs [u0, v0, u1, v1, style in a, style in b].
  function drawDiff(A, B, runs) {
    var groups = {}, pos = 0, sty = 0, out = [];
    [A, B].forEach(function (g, which) {
      g.segs.forEach(function (q) {
        var dx = q[2] - q[0], dy = q[3] - q[1], L = Mth.hypot(dx, dy);
        dx /= L; dy /= L;
        if (dx < -1e-9 || (Mth.abs(dx) <= 1e-9 && dy < 0)) { dx = -dx; dy = -dy; }
        var off = q[0] * dy - q[1] * dx, key = r6(dx) + ',' + r6(dy) + ',' + r6(off), s0 = q[0] * dx + q[1] * dy, s1 = q[2] * dx + q[3] * dy;
        var gr = groups[key] || (groups[key] = { dx: dx, dy: dy, off: off, iv: [] });
        gr.iv.push([Mth.min(s0, s1), Mth.max(s0, s1), q[4], which]);
      });
    });
    Object.keys(groups).sort().forEach(function (k) {
      var gr = groups[k], xs = [];
      gr.iv.forEach(function (x) { xs.push(x[0], x[1]); });
      xs.sort(num);
      for (var i = 0; i + 1 < xs.length; i++) {
        var a = xs[i], b = xs[i + 1];
        if (b - a < 1e-7) continue;
        var m = (a + b) / 2, sa = 0, sb = 0;
        gr.iv.forEach(function (x) { if (x[0] < m && m < x[1]) { if (x[3]) sb = x[2]; else sa = x[2]; } });
        if (sa === sb) continue;
        if (!sa || !sb) pos += b - a; else sty += b - a;
        if (runs) out.push([r4(a * gr.dx + gr.off * gr.dy), r4(a * gr.dy - gr.off * gr.dx), r4(b * gr.dx + gr.off * gr.dy), r4(b * gr.dy - gr.off * gr.dx), sa, sb]);
      }
    });
    return { pos: pos, sty: sty, runs: runs ? out : null };
  }
  // ---- items on solids. The four options are the missing views of four solids of the class made from one
  // spec by two changes X and Y to two different features (none, X, Y, both: a 2 × 2 square), and the key
  // is a corner of the square drawn at random: every option then differs from two others by one change
  // and from one by both, so the options' likeness to each other says nothing about the key, and a change
  // that adds or removes lines is as often in the key as not. A square is kept only if every corner could be
  // the key at the item's foil level (so the draw of the key's corner stays uniform):
  //   foil 0  every other option differs in its outline or lines (at least one unit of line), the easiest;
  //   foil 1  all four share one outline, and every other option differs in its lines;
  //   foil 2  all four share one outline, and the key's neighbour along one change differs only in which
  //           lines are solid and which dotted (the format's subtlest option).
  // Every two options look apart (lookApart: a unit of line cells, counting both drawings). The given views are the key
  // solid's own. A hole in a given profile must show in the other given view (else filling it would leave
  // both given views unchanged, and the drawings would not fix the solid).
  // How far apart two drawings look: line cells (a sixteenth of a unit) of one with no line of the same style in the
  // other within one cell, in units (a line moved by less than a sixteenth, or two lines that close, look alike).
  function lookApart(a, b) {
    function cells(g) {
      var m = {};
      g.segs.forEach(function (q) {
        var n = Mth.max(1, Mth.ceil(Mth.hypot(q[2] - q[0], q[3] - q[1]) * 32));
        for (var i = 0; i <= n; i++) { var k = Mth.round((q[0] + (q[2] - q[0]) * i / n) * 16) + ',' + Mth.round((q[1] + (q[3] - q[1]) * i / n) * 16); m[k] = (m[k] || 0) | q[4]; }
      });
      return m;
    }
    function near(M, key, st) {
      var p = key.split(','), u = +p[0], v = +p[1];
      for (var du = -1; du <= 1; du++) for (var dv = -1; dv <= 1; dv++) if ((M[(u + du) + ',' + (v + dv)] || 0) & st) return true;
      return false;
    }
    var A = cells(a), B = cells(b), d = 0, k;
    for (k in A) if (!near(B, k, A[k])) d++;
    for (k in B) if (!near(A, k, B[k])) d++;
    return d / 16;
  }
  function relation(a, b) {
    if (a.out !== b.out) return 'outline';
    var d = drawDiff(a.g, b.g);
    return d.pos > 1e-6 ? 'lines' : d.sty > 1e-6 ? 'dashes' : 'same';
  }
  function holesShow(sp, S, given) {
    for (var pi = 0; pi < 2; pi++) {
      var other = VIEWS.filter(function (v) { return VAX[v] === sp.prof[1 - pi].ax; })[0];
      for (var fi = 0; fi < sp.prof[pi].feats.length; fi++) {
        var f = sp.prof[pi].feats[fi];
        if (f.kind !== 'hole' && f.kind !== 'round') continue;
        var S2 = solidOf(applyVars(sp, [{ pi: pi, fi: fi, g: null, to: pi }]));
        if (!S2) return false;
        if (lookApart(drawSolid(S2, other), given[other]) < 1) return false;
      }
    }
    return true;
  }
  function buildSolid(rng, p) {
    var lv = p.cubes - 3, nf = p.grid ? 3 : 2, miss = MISSING[p.missing], fl = p.foil;
    var sp = newSpec(rng, lv, nf, miss, fl === 2);
    if (!sp) { stats.noSpec++; return null; }
    var vars = [];
    sp.prof.forEach(function (ps, pi) { ps.feats.forEach(function (f, fi) { vars = vars.concat(variants(sp, pi, fi, lv)); }); });
    if (vars.length < 2) return null;
    var memo = {};
    function obj(vs) {
      var key = vs.map(function (v) { return vars.indexOf(v); }).sort(num).join(',');
      if (key in memo) return memo[key];
      var s2 = vs.length ? applyVars(sp, vs) : sp, S = solidOf(s2), r = null;
      if (S) r = { sp: s2, S: S, g: drawSolid(S, miss), out: outlineOf(S, miss), vs: vs };
      return (memo[key] = r);
    }
    var base = obj([]);
    if (!base) return null;
    // single changes by their effect on the missing view, tried in a random order; X from those that suit
    // the level (foil 2: a change that only turns lines solid or dotted), Y from any other feature's
    vars = rshuffle(rng, vars);
    function eff(v) { if (v.eff === undefined) { var o = obj([v]); v.eff = o ? relation(base, o) : null; if (o) v.pos = drawDiff(base.g, o.g).pos; } return v.eff; }
    function suits(v) { var e = eff(v); return fl === 2 ? e === 'dashes' : fl === 1 ? e === 'lines' : e === 'outline' || (e === 'lines' && v.pos >= 1); }
    var tried = 0;
    for (var xi = 0; xi < vars.length && tried < 12; xi++) {
      var X = vars[xi];
      if ((fl === 2 && X.tag !== 'flip c') || !suits(X)) continue;
      for (var yi = 0; yi < vars.length && tried < 12; yi++) {
      var Y = vars[yi];
      if ((Y.pi === X.pi && Y.fi === X.fi) || (X.tag === 'left out' && Y.tag === 'left out') || !(fl === 2 ? eff(Y) === 'dashes' || eff(Y) === 'lines' : suits(Y))) continue; // at most one cut left out
      tried++;
      var sq = [obj([]), obj([X]), obj([Y]), obj([X, Y])];
      // every option keeps a cut of the level's own kind (a hole through, a slope, a round hole)
      if (sq.some(function (o) { return !o || !o.sp.prof.some(function (q) { return q.feats.some(function (f) { return f.kind === SOLID_KINDS[lv][0]; }); }); })) { stats.levelMiss++; continue; }
      var rel = [], ok = true, i, j;
      for (i = 0; i < 4 && ok; i++) { rel.push([]); for (j = 0; j < 4; j++) rel[i].push(i === j ? 'same' : j < i ? rel[j][i] : relation(sq[i], sq[j])); }
      for (i = 0; i < 4 && ok; i++) for (j = i + 1; j < 4; j++) if (rel[i][j] === 'same' || lookApart(sq[i].g, sq[j].g) < 1) ok = false;
      if (!ok) { stats.closeSet++; continue; }
      var outl = sq.every(function (o) { return o.out === sq[0].out; });
      for (i = 0; i < 4 && ok; i++) {
        var others = [0, 1, 2, 3].filter(function (k) { return k !== i; });
        if (fl === 0) ok = others.every(function (k) { return rel[i][k] === 'outline' || (drawDiff(sq[i].g, sq[k].g).pos >= 1 && lookApart(sq[i].g, sq[k].g) >= 2); });
        else if (fl === 1) ok = outl && others.every(function (k) { return rel[i][k] === 'lines'; });
        else ok = outl && others.some(function (k) { return rel[i][k] === 'dashes'; });
      }
      if (!ok) { stats.levelMiss++; continue; }
      var kc = rint(rng, 0, 3), K = sq[kc], given = {};
      if (!connected(K.S)) { stats.apart++; return null; } // the key solid is one piece (the class keeps it so; checked)
      VIEWS.forEach(function (v) { if (v !== miss) given[v] = drawSolid(K.S, v); });
      if (!holesShow(K.sp, K.S, given)) { stats.holeHidden++; return null; }
      var order = rshuffle(rng, [0, 1, 2, 3]);
      return {
        solid: true, W: sp.W, H: sp.H, D: sp.D, missing: miss, spec: K.sp, solidKey: K.S, given: given, key: order.indexOf(kc),
        options: order.map(function (k) {
          var ch = [X, Y].filter(function (v) { return (sq[k].vs.indexOf(v) >= 0) !== (K.vs.indexOf(v) >= 0); }).map(function (v) { return v.tag; });
          return { kind: k === kc ? 'key' : rel[kc][k], change: ch, drawing: sq[k].g };
        }),
      };
      }
    }
    if (!tried) stats.noX++; else stats.noSquare++;
    return null;
  }
  // ---- the solids' validator (independent of the drawing code above: it never enumerates edges). It reads
  // the item's stated solids (polygons; a round hole's 32 sides count as one smooth wall), and for every drawing checks by rays
  // that each drawn line sits where the solid changes across it (solid where what is seen changes, dotted
  // where only something behind does), and, along scan lines, that every such change has its line. It
  // also checks the class (profiles inside the box, touching its four sides, material on every line across
  // them, so each given view's outline is its profile), that each hole of a given profile shows in the
  // other given view, and that every option differs visibly from the key (rasterised separately).
  function vIn(loops, u, v) { // winding number within each loop, even-odd over the loops
    var inside = false;
    loops.forEach(function (L) {
      var P = L.pts, n = P.length, wn = 0;
      for (var i = 0; i < n; i++) {
        var a = P[i], b = P[(i + 1) % n], cr = (b[0] - a[0]) * (v - a[1]) - (u - a[0]) * (b[1] - a[1]);
        if (a[1] <= v) { if (b[1] > v && cr > 0) wn++; } else if (b[1] <= v && cr < 0) wn--;
      }
      if (wn !== 0) inside = !inside;
    });
    return inside;
  }
  // Where the axis ray through image point (U, V) of a view enters and leaves the solid: [{ t, round }] by depth.
  function vRay(S, view, U, V) {
    var k = VAX[view], X = [0, 0, 0];
    if (view === 'top') { X[0] = U; X[2] = S.D - V; } else if (view === 'front') { X[0] = U; X[1] = V; } else { X[2] = S.D - U; X[1] = V; }
    var lists = [];
    for (var i = 0; i < 2; i++) {
      var pr = S.prof[i], pl = PLANE[pr.ax];
      if (pr.ax === k) { if (!vIn(pr.loops, X[pl[0]], X[pl[1]])) return []; lists.push(null); continue; }
      var vi = pl.indexOf(k), fi = 1 - vi, w = X[pl[fi]], ts = [];
      pr.loops.forEach(function (L) {
        var P = L.pts, n = P.length;
        for (var j = 0; j < n; j++) {
          var a = P[j], b = P[(j + 1) % n];
          if ((a[fi] > w) !== (b[fi] > w)) ts.push({ t: a[vi] + (b[vi] - a[vi]) * (w - a[fi]) / (b[fi] - a[fi]), round: L.round ? 1 : 0 });
        }
      });
      lists.push(ts.sort(function (p, q) { return p.t - q.t; }));
    }
    var all = [].concat(lists[0] || [], lists[1] || []).sort(function (p, q) { return p.t - q.t; }), out = [], was = false;
    function inside(t) {
      for (var i = 0; i < 2; i++) { if (!lists[i]) continue; var c = 0; lists[i].forEach(function (x) { if (x.t < t) c++; }); if (c % 2 === 0) return false; }
      return true;
    }
    for (var q = 0; q < all.length; q++) {
      var t1 = q + 1 < all.length ? all[q + 1].t : INF, mid = t1 === INF ? all[q].t + 1 : (all[q].t + t1) / 2, now = t1 - all[q].t > 1e-9 && inside(mid);
      if (now !== was) { out.push(all[q]); was = now; }
    }
    if (!lists[0] && !lists[1]) out = [{ t: -INF, round: 0 }, { t: INF, round: 0 }];
    return out;
  }
  // What changes across a short step from p to q: 1 what is seen (the nearest surface: present, depth, slope),
  // 2 only something behind, 0 nothing. a, b, c, d: rays at p − (q − p), p, q, q + (q − p).
  // A round hole's wall bends at each of its 32 sides: for it only a change in the number of surfaces counts.
  function vChange(a, b, c, d) {
    if (!b.length !== !c.length) return 1;
    if (!b.length) return 0;
    function bend(r0, r1, r2, r3, i0, i1, i2, i3) { // jump or kink between r1 and r2 on surfaces i
      if (r1[i1].round || r2[i2].round) return !r1[i1].round !== !r2[i2].round || Mth.abs(r1[i1].t - r2[i2].t) > 0.05; // another surface, or a jump
      if (!r0[i0] || !r3[i3]) return Mth.abs(r1[i1].t - r2[i2].t) > 0.02;
      var pred = 2 * r1[i1].t - r0[i0].t, back = 2 * r2[i2].t - r3[i3].t;
      return Mth.abs(r2[i2].t - pred) > 2e-4 || Mth.abs(r1[i1].t - back) > 2e-4;
    }
    if (bend(a, b, c, d, a.length - 1, b.length - 1, c.length - 1, d.length - 1)) return 1;
    if (b.length !== c.length) return 2;
    for (var i = 0; i < b.length - 1; i++) if (a.length === b.length && d.length === c.length ? bend(a, b, c, d, i, i, i, i) : Mth.abs(b[i].t - c[i].t) > 0.02) return 2;
    return 0;
  }
  function vRuns(g) { return g.segs.filter(function (q) { return Mth.hypot(q[2] - q[0], q[3] - q[1]) > 1e-6; }); }
  function vDrawing(S, view, g) {
    var segs = vRuns(g), i, k;
    function R(u, v) { return vRay(S, view, u, v); }
    for (i = 0; i < segs.length; i++) {
      var q = segs[i], L = Mth.hypot(q[2] - q[0], q[3] - q[1]), nx = -(q[3] - q[1]) / L, ny = (q[2] - q[0]) / L;
      var fr = L > 0.1 ? [0.3137, 0.5219, 0.7071] : [0.5219];
      for (k = 0; k < fr.length; k++) {
        var mu = q[0] + (q[2] - q[0]) * fr[k], mv = q[1] + (q[3] - q[1]) * fr[k], ch = -1;
        // the change across the line, seen up close (smaller steps where a nearby feature crowds the wider ones)
        for (var h = 0.006; h > 0.0005 && ch !== q[4]; h /= 3) ch = vChange(R(mu - 3 * h * nx, mv - 3 * h * ny), R(mu - h * nx, mv - h * ny), R(mu + h * nx, mv + h * ny), R(mu + 3 * h * nx, mv + 3 * h * ny));
        if (ch !== q[4]) return view + ': the line ' + q.slice(0, 4).join(',') + ' is drawn ' + (q[4] === 1 ? 'solid' : 'dotted') + ' but the solid shows ' + ['nothing', 'a seen edge', 'a hidden edge'][ch] + ' there';
      }
    }
    // scan lines: every change has a line of its kind within reach
    function near(u, v, st) {
      for (var j = 0; j < segs.length; j++) { var s = segs[j]; if ((st === 1 && s[4] !== 1) || segDist([u, v], [s[0], s[1]], [s[2], s[3]]) > 0.02) continue; return true; }
      return false;
    }
    for (var dir = 0; dir < 2; dir++) {
      var len = dir ? g.h : g.w, acr = dir ? g.w : g.h;
      for (var c = 0.1737; c < acr; c += 0.2513) {
        var pts = [];
        for (var x = -0.05; x < len + 0.05; x += 0.0123) pts.push([x, dir ? R(c, x) : R(x, c)]); // from outside the box: the outline too
        for (k = 1; k + 2 < pts.length; k++) {
          var ch2 = vChange(pts[k - 1][1], pts[k][1], pts[k + 1][1], pts[k + 2][1]);
          if (!ch2) continue;
          var x0 = (pts[k][0] + pts[k + 1][0]) / 2;
          if (!(dir ? near(c, x0, ch2) : near(x0, c, ch2))) return view + ': a ' + (ch2 === 1 ? 'seen' : 'hidden') + ' edge near ' + (dir ? [c, x0] : [x0, c]).map(r4).join(',') + ' has no line';
        }
      }
    }
    return true;
  }
  // The class: each profile inside its box and touching all four sides, every line across it meets material.
  function vProfile(S, pr) {
    var pl = PLANE[pr.ax], ext = [S.W, S.H, S.D], L = ext[pl[0]], M = ext[pl[1]], lo = [INF, INF], hi = [-INF, -INF];
    pr.loops.forEach(function (lp) { lp.pts.forEach(function (p) { for (var k = 0; k < 2; k++) { lo[k] = Mth.min(lo[k], p[k]); hi[k] = Mth.max(hi[k], p[k]); } }); });
    if (Mth.abs(lo[0]) > 1e-9 || Mth.abs(lo[1]) > 1e-9 || Mth.abs(hi[0] - L) > 1e-9 || Mth.abs(hi[1] - M) > 1e-9) return 'a profile does not fill its box';
    for (var k = 0; k < 2; k++) {
      var a = k ? M : L, b = k ? L : M;
      for (var w = 0.11; w < a; w += 0.2) {
        var any = false;
        for (var x = 0.013; x < b && !any; x += 0.05) if (k ? vIn(pr.loops, x, w) : vIn(pr.loops, w, x)) any = true;
        if (!any) return 'a line across a profile meets no material';
      }
    }
    return true;
  }
  // Two drawings differ visibly: at least half a unit of line (or style) differs, rasterised on a 1/20 grid.
  function vDiffers(a, b) {
    function cells(g) {
      var m = {};
      g.segs.forEach(function (q) {
        var L = Mth.hypot(q[2] - q[0], q[3] - q[1]), n = Mth.max(1, Mth.ceil(L / 0.02));
        for (var i = 1; i < n; i++) { var u = q[0] + (q[2] - q[0]) * i / n, v = q[1] + (q[3] - q[1]) * i / n; m[Mth.round(u * 20) + ',' + Mth.round(v * 20)] = q[4]; }
      });
      return m;
    }
    var A = cells(a), B = cells(b), d = 0, k;
    for (k in A) if (B[k] !== A[k]) d++;
    for (k in B) if (!(k in A)) d++;
    return d * 0.05 >= 0.4;
  }
  function validateSolid(item) {
    try {
      var S = item.solidKey, miss = item.missing, views = VIEWS.filter(function (v) { return v !== miss; }), i, r;
      if (!S || S.prof.length !== 2) return 'no stated solid';
      if (S.prof.some(function (p) { return p.ax === VAX[miss]; })) return 'a cut runs along the missing view';
      if (views.map(function (v) { return VAX[v]; }).sort().join() !== S.prof.map(function (p) { return p.ax; }).sort().join()) return 'the profiles are not the given views';
      for (i = 0; i < 2; i++) if ((r = vProfile(S, S.prof[i])) !== true) return r;
      if (!item.options || item.options.length !== 4 || !(item.key >= 0 && item.key < 4)) return 'four options and a key';
      for (i = 0; i < views.length; i++) if ((r = vDrawing(S, views[i], item.given[views[i]])) !== true) return 'given ' + r;
      if ((r = vDrawing(S, miss, item.options[item.key].drawing)) !== true) return 'key ' + r;
      for (i = 0; i < 4; i++) if (i !== item.key && !vDiffers(item.options[i].drawing, item.options[item.key].drawing)) return 'option ' + i + ' is too close to the key';
      for (i = 0; i < 4; i++) for (var j = i + 1; j < 4; j++) if (!vDiffers(item.options[i].drawing, item.options[j].drawing)) return 'options ' + i + ' and ' + j + ' are too close';
      // each hole of a given profile shows in the other given view: without it, that view's drawing breaks
      for (i = 0; i < 2; i++) {
        var other = views.filter(function (v) { return VAX[v] !== S.prof[i].ax; })[0];
        for (var h = 1; h < S.prof[i].loops.length; h++) {
          var S2 = { W: S.W, H: S.H, D: S.D, prof: S.prof.map(function (p, k) { return k !== i ? p : { ax: p.ax, loops: p.loops.filter(function (_, q) { return q !== h; }) }; }) };
          if (vDrawing(S2, other, item.given[other]) === true) return 'hole ' + h + ' of the ' + VIEWS.filter(function (v) { return VAX[v] === S.prof[i].ax; })[0] + ' profile does not show in the ' + other + ' view';
        }
      }
      return true;
    } catch (e) { return 'validate threw: ' + (e && e.message); }
  }

  function score(item, response) { return { correct: Number.isInteger(response) && response === item.key }; }

  function attempt(rng, p, relaxed) {
    stats.tries++;
    var item;
    try { item = p.cubes >= NCUBE ? buildSolid(rng, p) : build(rng, p, relaxed); } catch (e) { stats.errors++; stats.lastError = String(e && e.stack || e); return null; }
    if (!item) { stats.nulls++; return null; }
    item.ex = 'patviews';
    return item;
  }
  function generate(rng, params) {
    // The starter band rejects lopsided foil sets outright (chooseFoils, strict), so it gets more tries,
    // the last 50 without that rule (a few band settings rarely find a balanced set).
    var p = cleanParams(params), item = null, tries = p.cubes === 0 ? 150 : p.cubes >= NCUBE ? 80 : 50;
    for (var i = 0; i < tries && !item; i++) item = attempt(i === 0 ? rng : rng.fork('retry' + i), p, i >= 100);
    if (!item) item = fallback(p);
    item.seed = rng.seed;
    item.params = params ? PX.util.deepCopy(params) : p;
    return item;
  }
  function fallback(p) {
    stats.fallbacks++;
    var tries = p.cubes >= NCUBE ? [p, { cubes: p.cubes, grid: p.grid, missing: p.missing, foil: 0 }, { cubes: NCUBE, grid: 0, missing: 0, foil: 0 }] : [p, { cubes: p.cubes, grid: 1, missing: p.missing, foil: 0 }, { cubes: 2, grid: 1, missing: 0, foil: 0 }];
    for (var t = 0; t < tries.length; t++) {
      for (var k = 0; k < 400; k++) {
        var item = attempt(PX.rng(PX.rng.hash('patviews-fallback', tries[t].cubes, tries[t].grid, tries[t].missing, tries[t].foil, k)), tries[t]);
        if (item) item.params = tries[t]; // validate reads the level (cube count, the starter band)
        if (item && validate(item) === true) { item.fallback = true; return item; }
      }
    }
    throw new Error('patviews: no valid item could be built'); // unreachable while the fallback test passes
  }

  // v1.2 (fresh-player test: a scored item was the Watch's own item, answerable from memory): an item of
  // the tutorial (params.task 'tutorial': the Watch, the Try items and the worked examples in learn.js)
  // never comes back as a rated item. A rated item whose stem is one of theirs (TUTORIAL: hashes of
  // their stems; the node test recomputes them from learn.js) is drawn again from the seed's stream.
  var TUTORIAL = [337167328, 1869791245, 968252950, 3846313730, 242981060, 892970417];
  function stemSig(item) { return PX.rng.hash('patviews-stem', JSON.stringify([item.missing, Object.keys(item.given).sort().map(function (v) { return [v, item.given[v].segs]; })])); }
  function generateFresh(rng, params) {
    var item = generate(rng, params), sig;
    if (params && params.task === 'tutorial') return item;
    sig = stemSig(item);
    for (var k = 1; k <= 8 && TUTORIAL.indexOf(sig) >= 0; k++) { item = generate(rng.fork('fresh' + k), params); item.seed = rng.seed; sig = stemSig(item); }
    lastGen = { seed: rng.seed, params: params, sig: sig };
    return item;
  }

  // v1.2 (fresh-player run, 19 Nov: one session dealt the same starter item twice, the same two views and the
  // same four drawings): a session shows no stem twice while its setting has stems it has not shown. Nothing
  // compared items, and the starter band allows 10 to 73 stems per setting (two draws shared one up to 14 % of
  // the time; cube stacks at level 1 about 1 %), while profile solids came out different in every one of 60
  // draws at each setting. The player's guard (sessionGuard, at item:before) runs for every exercise whose lib
  // has sigOf(seed, params), which reads an item's stem (the item generated last is remembered, so the
  // player's own item is not made twice). Section forms (js/engine/section.js), which would otherwise generate
  // every item of a part at its start, do the same where fewStems(params) says a setting allows few stems.
  // Openings, Form and Hole Punch export the same sigOf and their own fewStems (DECISIONS).
  var lastGen = null;
  function sigOf(seed, params) {
    var g = lastGen, s = PX.rng(seed).seed;
    if (g && g.seed === s && (g.params === params || PX.ex.paramsKey(g.params) === PX.ex.paramsKey(params))) return g.sig;
    return stemSig(generateFresh(PX.rng(s), params));
  }
  function fewStems(params) { return !!params && params.cubes < NCUBE; } // the cube stacks
  // The guard's choice for a step: seen = { stem: order } of the stems the session has shown (a larger order is
  // later); next() → a new seed from the engine, or null when the seed must stay. Returns { seed, sig, fresh,
  // tries }: the step's own seed when its stem is new; else the first of up to opts.tries new seeds (within
  // opts.ms) whose stem is new; when the setting has none left, the one whose stem was shown longest ago.
  function freshSeed(d, seed, params, seen, next, opts) {
    var o = opts || {}, tries = o.tries > 0 ? o.tries : 64, ms = o.ms > 0 ? o.ms : INF, clock = o.clock || Date.now, t0 = clock();
    var sig = d.lib.sigOf(seed, params), has = Object.prototype.hasOwnProperty;
    if (!has.call(seen, sig)) return { seed: seed, sig: sig, fresh: true, tries: 0 };
    var best = { seed: seed, sig: sig, at: seen[sig] }, k = 0;
    while (k < tries && clock() - t0 < ms) {
      var s = next();
      if (typeof s !== 'number') break;
      k++;
      var g = d.lib.sigOf(s, params);
      if (!has.call(seen, g)) return { seed: s, sig: g, fresh: true, tries: k };
      if (seen[g] < best.at) best = { seed: s, sig: g, at: seen[g] };
    }
    return { seed: best.seed, sig: best.sig, fresh: false, tries: k };
  }
  // The guard at the player's item:before (registered by js/ex/patviews/view.js; ctx: CONTRACT-v1.2 R's mode,
  // plan, rec, step, def). shown: a WeakMap plan → { n, ex: { exId: { stem: order } } }. An item whose stem the
  // session has shown takes a new seed from the engine (E.dims.seedFor where seeds name cells, else
  // E.select.seed), so the log keeps a seed that rebuilds the item shown. A Path recheck, a fixed item (as
  // play.js's FIXED_KINDS) and a comparison round's apply item keep their seed; their stems still count.
  // Returns the guard's choice (freshSeed), or null where it does not apply. opts: freshSeed's (the tests lift
  // the time limit, so their runs do not depend on the machine's speed).
  var GUARD_KEEP = { recheck: 1, probe: 1, daily: 1, threshold: 1, set: 1 }, GUARD_OPTS = { tries: 64, ms: 200 };
  function sessionGuard(ctx, shown, opts) {
    var d = ctx && ctx.def, step = ctx && ctx.step, L = d && d.lib, E = PX.engine;
    if (!shown || !L || typeof L.sigOf !== 'function' || !step || !ctx.plan || typeof step.seed !== 'number') return null;
    var S = shown.get(ctx.plan);
    if (!S) shown.set(ctx.plan, S = { n: 0, ex: {} });
    var seen = S.ex[d.id] || (S.ex[d.id] = {});
    var keep = !!step.recheck || GUARD_KEEP[step.kind] === 1 || step.layer === 'compare-apply' || !E || !E.select;
    var next = keep ? function () { return null; } : function () {
      var s = E.dims && E.dims.seedFor ? E.dims.seedFor(ctx.rec, d, step.params) : null;
      return typeof s === 'number' ? s : E.select.seed(ctx.rec);
    };
    var r = freshSeed(d, step.seed, step.params, seen, next, opts || GUARD_OPTS);
    if (r.seed !== step.seed) step.seed = r.seed;
    seen[r.sig] = ++S.n;
    return r;
  }

  /* ------------------------------------------------------------ definition */
  // Logits; P(right) = g + (1 − g − 0.03)·σ(θ − b), g = .25. base −2.2: 4–5 cubes on a 3 × 3 grid,
  // the end view missing, outline foils: ≈ .90 right at θ = 0. Steps hand-set (DJ, to be refitted
  // from pooled exports): cubes +0.5 per level (more lines to match, more hidden edges; Kurtuluş &
  // Yolcu 2013 for counting errors growing with cubes), 4 × 4 grid +0.5, missing view front +0.4 and
  // top +0.8 (two side views carry no direct footprint), foils +0.6 per level (same outline, then a
  // solid/dotted difference: the DAT's subtlest option type, R3 §3.2). Range 4.0 logits.
  // v1.2 (version 2; note D2 §3.7, §3.8): a starter level in front of 'cubes' (3–4 cubes at most two
  // high, the structure drawn beside the views, no dotted line in the key, no foil that only the
  // exhaustive search rejects), Δ = −1.6 against today's level 0 (hand-set, to be refitted from pooled
  // exports): the floor moves from −2.2 to −3.8; older combinations keep their exact difficulty. The
  // cube counts now hold for the shown structure. Range 5.6.
  // v1.2 (version 3; PLAN milestone 8, O49; note D1 §3.2, §6.5, addendum A.1 row 13): the format's own
  // objects. 'cubes' becomes the object: cube stacks at levels 0–2 (below the format), then profile solids
  // with steps and notches, a hole through, slopes, round holes (all in the test range, as the official
  // samples show them); 'grid' is the size (cubes on 3 × 3 or 4 × 4; solids made with two or three cuts, one of
  // which a change may leave out). Steps
  // for the solids hand-set (to be refitted from pooled exports): +0.2 over the largest stack level for
  // plain cuts, +0.3 for each further kind. Version 2's stack levels 7–12 and 9–15 are left out; stored
  // levels move with the range (js/engine/rebase.js). Range 5.8.
  var LEVEL_TAGS = { cubes: ['below', 'below', 'below', 'test', 'test', 'test', 'test'], grid: ['test', 'test'], missing: ['test', 'test', 'test'], foil: ['test', 'test', 'test'] };
  PX.ex.define({
    id: 'patviews', version: 3, code: 'EX-15', name: 'Missing View', short: 'Missing View',
    abilities: ['Vz'], cell: 'intrinsic-static', role: 'train', answer: 'choice', nOptions: 4, pat: true,
    bet: 'format', format: 'patviews:missing-third-view', // v1.2 wave 2 (W2-bets): PLAN milestone 4, CONTRACT-v1.2 S; note T1 §3.2
    requires: ['views'],
    starter: { dim: 'cubes', levels: 1 },
    dims: [
      { key: 'cubes', label: 'Object', levels: CUBE_LABELS.slice(0, NCUBE).map(function (s) { return 'cube stack, ' + s; }).concat(SOLID_LABELS), step: 0.5, at: [-1.6, 0, 0.5, 0.7, 1.0, 1.3, 1.6] },
      { key: 'grid', label: 'Size', levels: ['small (cubes on 3 × 3; one or two cuts)', 'large (cubes on 4 × 4; two or three cuts)'], step: 0.5 },
      { key: 'missing', label: 'Missing view', levels: MISSING.slice(), step: 0.4 },
      { key: 'foil', label: 'Foils', levels: ['outline or lines', 'same outline', 'solid or dotted'], step: 0.6 },
    ],
    testRange: {
      dims: LEVEL_TAGS,
      notes: {
        cubes: 'The official samples show blocks with steps, notches, holes, round holes and slopes, drawn in plain lines. Cube stacks are starter help below the format.',
      },
    },
    base: -2.2,
    generate: generateFresh, extraParams: ['task'], validate: validate, score: score,
    lib: {
      TUTORIAL: TUTORIAL, stemSig: stemSig, generateRaw: generate, sigOf: sigOf, fewStems: fewStems, freshSeed: freshSeed, sessionGuard: sessionGuard, GUARD_OPTS: GUARD_OPTS,
      VIEWS: VIEWS, MISSING: MISSING, CUBES: CUBES, GRIDS: GRIDS, FOILS: FOILS, HMAX: HMAX, SOLVERS: SOLVERS, stats: stats,
      boxOf: boxOf, rowsOf: rowsOf, fills: fills, connectedBox: connectedBox, drawView: drawView, drawRay: drawRay, codeOf: codeOf,
      sameGrid: sameGrid, pub: pub, grid: grid, counts: counts, gdist: gdist, kindOf: kindOf, hullFails: hullFails, alignFails: alignFails,
      lineSet: lineSet, crossStyles: crossStyles, pairV: pairV, search: search, searchRay: searchRay, possibleViews: possibleViews, neighbours: neighbours,
      flips: flips, shares: shares, pickShare: pickShare, gdistLines: gdistLines, build: build, fallback: fallback, cleanParams: cleanParams,
      cubeCount: cubeCount, bandBox: bandBox, bandStructure: bandStructure, pieces: pieces,
      // profile solids (version 3)
      NCUBE: NCUBE, NOBJ: NOBJ, LEVEL_TAGS: LEVEL_TAGS, SOLID_KINDS: SOLID_KINDS, SOLID_LABELS: SOLID_LABELS, PLANE: PLANE, VAX: VAX,
      drawSolid: drawSolid, axisView: axisView, solidEdges: solidEdges, rayIn: rayIn, inSolid: inSolid, drawDiff: drawDiff, outlineOf: outlineOf,
      profLoops: profLoops, profOk: profOk, solidOf: solidOf, newSpec: newSpec, variants: variants, applyVars: applyVars, connected: connected,
      relation: relation, lookApart: lookApart, holesShow: holesShow, buildSolid: buildSolid, validateSolid: validateSolid, vRay: vRay, vDrawing: vDrawing, vDiffers: vDiffers,
    },
  });
})(window.PX);
