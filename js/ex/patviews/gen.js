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
   (a line has no partner coordinate in the neighbouring view), else 'search' (only the exhaustive
   search rules it out, typically a solid/dotted difference).

   Foils come from the structure's neighbours inside the same box (one or two columns changed) and,
   for front and end views, from flipping one line between solid and dotted; all share the key's
   size. Kinds: 'outline' (another silhouette), 'lines' (same silhouette, other lines), 'dashes'
   (same lines, other styles). Dim foil: 0 outline foils, 1 same-silhouette foils, 2 the subtlest
   (a solid/dotted foil for front and end; the closest one-line foils for top). Foil sets are
   chosen so the cheap solvers (line counts, area, like the others, odd one out) hit about 1 in 4.

   validate (independent): rebuilds the voxels, enumerates the solid's edges in 3D and decides each
   one's visibility by marching voxels toward the viewer (drawRay), re-derives every drawing, re-runs
   the exhaustive search and re-proves every foil.

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
  var CUBES = [[4, 5], [6, 7], [8, 9], [10, 12]];  // dim 'cubes'
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
    var vox = {}, x, y, z;
    for (z = 0; z < D; z++) for (x = 0; x < W; x++) for (y = 0; y < rows[z][x]; y++) vox[x + ',' + y + ',' + z] = 1;
    function at(xx, yy, zz) { return vox[xx + ',' + yy + ',' + zz] ? 1 : 0; }
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
  var SOLVERS = ['most solid', 'fewest solid', 'most dotted', 'fewest dotted', 'largest area', 'smallest area', 'like the others', 'odd one out'];
  function shares(gs) { // gs[0] is the key
    var c = gs.map(counts), sum = gs.map(function (a, i) { var s = 0; gs.forEach(function (b2, j) { if (i !== j) s += gdist(a, b2); }); return s; });
    var sol = c.map(function (x) { return x.solid; }), dot = c.map(function (x) { return x.dotted; }), ar = c.map(function (x) { return x.area; });
    return [pickShare(sol, true), pickShare(sol, false), pickShare(dot, true), pickShare(dot, false), pickShare(ar, true), pickShare(ar, false), pickShare(sum, false), pickShare(sum, true)];
  }
  var WEIGHTS = [1, 1, 1, 1, 1.8, 3, 2, 1.5];
  function chooseFoils(rng, keyG, pool, need) {
    var idx = rshuffle(rng, pool.map(function (_, i) { return i; })).slice(0, 13), best = null, bestScore = INF, bestSh = null;
    var want = SOLVERS.map(function () { return rng.chance(0.25) ? 1 : 0; });
    for (var a = 0; a < idx.length; a++) for (var b = a + 1; b < idx.length; b++) for (var c = b + 1; c < idx.length; c++) {
      var set = [pool[idx[a]], pool[idx[b]], pool[idx[c]]];
      if (need && !need(set)) continue;
      var sh = shares([keyG].concat(set.map(function (o) { return o.g; }))), score = 0;
      for (var k = 0; k < sh.length; k++) score += WEIGHTS[k] * Mth.abs(sh[k] - want[k]);
      if (score < bestScore - 1e-9) { bestScore = score; best = set; bestSh = sh; }
    }
    // The pool can leave no choice (outline foils mostly add cubes, so the key's outline tends to be
    // the smallest): such a set is dropped half the time, and the item is drawn again.
    if (best && ((bestSh[5] >= 0.5 && !want[5]) || (bestSh[6] >= 0.5 && !want[6])) && rng.chance(0.6)) return null;
    return best;
  }

  /* ------------------------------------------------------------ generate */
  var stats = { tries: 0, nulls: 0, over: 0, invalid: 0, errors: 0, fallbacks: 0, lastInvalid: null, lastError: null, nodes: 0 };
  function lvl(params, k, n) { var x = params ? params[k] : 0; return Number.isInteger(x) && x >= 0 && x < n ? x : 0; }
  function cleanParams(params) {
    return { cubes: lvl(params, 'cubes', CUBES.length), grid: lvl(params, 'grid', GRIDS.length), missing: lvl(params, 'missing', MISSING.length), foil: lvl(params, 'foil', FOILS.length) };
  }
  function build(rng, p) {
    var G = GRIDS[p.grid], win = CUBES[p.cubes], N = rint(rng, win[0], Mth.min(win[1], G * G * HMAX));
    // A hidden parent and its neighbours in the same box: the key is one of them, and the foils come
    // from the whole family, so the key is not the structure the others were made from (its outline
    // is then neither the smallest nor the most typical one by construction).
    var b0 = boxOf(VL().randomStructure(rng, G, N));
    if (b0.W < 2 || b0.D < 2 || b0.H < 2) return null;
    var fam = neighbours(rng, b0), b = fam.length && rng.chance(0.85) ? fam[rint(rng, 0, fam.length - 1)] : b0;
    var miss = MISSING[p.missing], views = {}, given = {};
    VIEWS.forEach(function (v) { views[v] = drawView(b, v); if (v !== miss) given[v] = views[v]; });
    var res = search(given, b.W, b.H, b.D);
    stats.nodes += res.nodes;
    if (res.over) { stats.over++; return null; }
    var poss = possibleViews(res, b.W, b.H, b.D, miss), keyG = views[miss], keyCode = codeOf(keyG);
    if (!poss[keyCode]) return null;
    var pool = [], seen = {};
    seen[keyCode] = 1;
    function admit(g, src) {
      if (!g || g.w !== keyG.w || g.h !== keyG.h) return;
      var c = codeOf(g);
      if (seen[c] || poss[c]) return;
      seen[c] = 1;
      pool.push({ g: g, code: c, kind: kindOf(keyG, g), src: src, d: gdist(keyG, g) });
    }
    [b0].concat(fam, neighbours(rng, b)).forEach(function (nb) { if (nb !== b) admit(drawView(nb, miss), 'neighbour'); });
    if (miss !== 'top') flips(keyG).forEach(function (g) { admit(g, 'flip'); });
    var level = FOILS[p.foil], cands, need = null;
    if (level === 'outline') cands = pool.filter(function (o) { return o.kind === 'outline'; });
    else {
      cands = pool.filter(function (o) { return o.kind !== 'outline'; });
      if (level === 'lines') need = function (s) { return s.filter(function (o) { return o.kind === 'lines'; }).length >= 2; };
      else if (miss !== 'top') need = function (s) { return s.some(function (o) { return o.kind === 'dashes'; }); };
      else cands = cands.filter(function (o) { return o.d <= 3; });
    }
    if (cands.length < 3) return null;
    var set = chooseFoils(rng, keyG, cands, need);
    if (!set) return null;
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
  function okRows(item) {
    var W = item.W, H = item.H, D = item.D, r = item.heights;
    if (![W, H, D].every(function (n) { return Number.isInteger(n) && n >= 1; }) || W > 4 || D > 4 || H > HMAX || W < 2 || D < 2) return 'bad box';
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
    try {
      if (!item || MISSING.indexOf(item.missing) < 0) return 'unknown missing view';
      var b = okRows(item);
      if (typeof b === 'string') return b;
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
      for (i = 0; i < 4; i++) {
        if (i === item.key) continue;
        var o = item.options[i], t = { top: true3.top, front: true3.front, end: true3.end };
        if (og[i].w !== og[item.key].w || og[i].h !== og[item.key].h) return 'option ' + i + ' has another size';
        if (poss[codeOf(og[i])]) return 'option ' + i + ' is the ' + miss + ' view of another structure with the same two views';
        if (o.kind !== kindOf(true3[miss], og[i])) return 'option ' + i + ' is not of its stated kind';
        t[miss] = og[i];
        var why = hullFails(t.top, t.front, t.end, W, H, D) ? 'hull' : alignFails(t.top, t.front, t.end) ? 'align' : 'search';
        if (o.why !== why) return 'option ' + i + ' gives the wrong reason (' + o.why + ', not ' + why + ')';
      }
      return true;
    } catch (e) { return 'validate threw: ' + (e && e.message); }
  }
  function score(item, response) { return { correct: Number.isInteger(response) && response === item.key }; }

  function attempt(rng, p) {
    stats.tries++;
    var item;
    try { item = build(rng, p); } catch (e) { stats.errors++; stats.lastError = String(e && e.stack || e); return null; }
    if (!item) { stats.nulls++; return null; }
    item.ex = 'patviews';
    return item;
  }
  function generate(rng, params) {
    var p = cleanParams(params), item = null;
    for (var i = 0; i < 50 && !item; i++) item = attempt(i === 0 ? rng : rng.fork('retry' + i), p);
    if (!item) item = fallback(p);
    item.seed = rng.seed;
    item.params = params ? PX.util.deepCopy(params) : p;
    return item;
  }
  function fallback(p) {
    stats.fallbacks++;
    var tries = [p, { cubes: p.cubes, grid: 1, missing: p.missing, foil: 0 }, { cubes: 1, grid: 1, missing: 0, foil: 0 }];
    for (var t = 0; t < tries.length; t++) {
      for (var k = 0; k < 400; k++) {
        var item = attempt(PX.rng(PX.rng.hash('patviews-fallback', tries[t].cubes, tries[t].grid, tries[t].missing, tries[t].foil, k)), tries[t]);
        if (item && validate(item) === true) { item.fallback = true; return item; }
      }
    }
    throw new Error('patviews: no valid item could be built'); // unreachable while the fallback test passes
  }

  /* ------------------------------------------------------------ definition */
  // Logits; P(right) = g + (1 − g − 0.03)·σ(θ − b), g = .25. base −2.2: 4–5 cubes on a 3 × 3 grid,
  // the end view missing, outline foils: ≈ .90 right at θ = 0. Steps hand-set (DJ, to be refitted
  // from pooled exports): cubes +0.5 per level (more lines to match, more hidden edges; Kurtuluş &
  // Yolcu 2013 for counting errors growing with cubes), 4 × 4 grid +0.5, missing view front +0.4 and
  // top +0.8 (two side views carry no direct footprint), foils +0.6 per level (same outline, then a
  // solid/dotted difference: the DAT's subtlest option type, R3 §3.2). Range 4.0 logits.
  PX.ex.define({
    id: 'patviews', version: 1, code: 'EX-15', name: 'Missing View', short: 'Missing View',
    abilities: ['Vz'], cell: 'intrinsic-static', role: 'train', answer: 'choice', nOptions: 4, pat: true,
    requires: ['views'],
    dims: [
      { key: 'cubes', label: 'Cubes', levels: ['4–5', '6–7', '8–9', '10–12'], step: 0.5 },
      { key: 'grid', label: 'Grid', levels: ['3 × 3', '4 × 4'], step: 0.5 },
      { key: 'missing', label: 'Missing view', levels: MISSING.slice(), step: 0.4 },
      { key: 'foil', label: 'Foils', levels: ['outline', 'same outline', 'solid or dotted'], step: 0.6 },
    ],
    base: -2.2,
    generate: generate, validate: validate, score: score,
    lib: {
      VIEWS: VIEWS, MISSING: MISSING, CUBES: CUBES, GRIDS: GRIDS, FOILS: FOILS, HMAX: HMAX, SOLVERS: SOLVERS, stats: stats,
      boxOf: boxOf, rowsOf: rowsOf, fills: fills, connectedBox: connectedBox, drawView: drawView, drawRay: drawRay, codeOf: codeOf,
      sameGrid: sameGrid, pub: pub, grid: grid, counts: counts, gdist: gdist, kindOf: kindOf, hullFails: hullFails, alignFails: alignFails,
      lineSet: lineSet, crossStyles: crossStyles, pairV: pairV, search: search, possibleViews: possibleViews, neighbours: neighbours,
      flips: flips, shares: shares, pickShare: pickShare, build: build, fallback: fallback, cleanParams: cleanParams,
    },
  });
})(window.PX);
