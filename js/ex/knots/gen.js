/* EX-13 Knots: does a knot remain, which crossing unties (or ties) it, are the loops linked?
   (pure; ARCHITECTURE.md §5; design and evidence: docs/research/v1.1/R2-knots.md, PLAN M4).

   Variants (one rating; harder formats sit higher on it, V_OFFSET):
     pull    "Pull both ends: does a knot remain?"  yesno (key true = a knot remains)
     untie   a knotted rope with 4 marked crossings: which one, switched, lets it fall open?  choice
     tie     an unknotted rope with 4 marked crossings: which one, switched, ties a knot?   choice
     link    two loops: are they linked (can they not be pulled apart)?  yesno (key true = linked)
   (R2's mirror variant with 3D tubes is not built yet; it can be appended to VARIANTS later.)

   Model (shared with view.js and the tests through def.lib):
   - An item's truth is its geometry: integer control points of a uniform cubic B-spline (an open
     rope whose ends run off the 320 px plate, or closed loops) and one over flag per crossing
     (crossings numbered by their first passage along the curves; the flag says the first passage
     is on top). The view draws the same spline as exact Bézier pieces.
   - Outlines are walks on a lattice whose pitch is the spacing level, so every crossing is a right
     angle at a lattice point, crossings are ≥ 36 px apart and strands keep the level's gap.
   - The validator re-derives the crossings from the samples of the spline, checks legibility, builds
     the diagram (PD convention) and classifies it by the cheap route of R2 §4.7: curls and loops on
     top come off (R1, R2) → no knot, with the moves as a certificate; else a Fox-colouring
     determinant ≠ 1 → a knot; else slide-overs (R3, a bounded search) then the same moves; else the
     Jones polynomial (≤ 24 crossings: V = 1 ⇔ unknot, Tuzun & Sikora). An open rope's ends are joined
     beyond the plate for the topology, and moves never use that outside arc (the ends stay put).
   - pull: a knot and an unknot from one outline with equal alternations, writhe and visible slides
     (cheap tells: R2 §3.1, §7.4), one shown by a coin from the seed. untie/tie: exactly one of the
     four tagged crossings changes the rope; tags are never nugatory; the tells of a switch are made
     symmetric across the four options. link: loops cross six times; a linked and an unlinked
     picture with equal counts (A-over-B count, alternations, writhe, slides); "unlinked" only by
     moves that leave no crossing between the loops, "linked" by a linking number ≠ 0 or a Jones
     polynomial unlike the unlink's (with both loops unknotted).
   - Show me (lib.replay): the same simplifier replayed on the drawn rope as local morphs.

   Item: { ex, v, seed, params, variant, answer, nOptions, spacing, n, depth?, pts | loops, over,
           tags? and options? (untie/tie: four crossing numbers in reading order), inter? (link), key,
           fallback? }  key: boolean (yesno) or the index of the right tag (choice). */
(function (PX) {
  'use strict';

  /* =====================================================================================
     1. KNOT MATHEMATICS (diagrams, moves, invariants). Everything here works on a diagram
        D = { n, link, oin, cu, co, id, alive, live, free }:
          n          crossings ever allocated (indices 0 … n − 1; removed ones have alive[x] = 0)
          link[4x+s] the slot at the other end of the edge leaving slot s of crossing x
                     slots are numbered counter-clockwise as seen on the plate (y up inside this
                     module); slot 0 = the under-strand coming in, slot 2 = the under-strand going
                     out, slots 1 and 3 = the over-strand (the PD-code convention X[a, b, c, d])
          oin[x]     the over-strand's incoming slot (1 or 3); the crossing's sign is +1 when it
                     is 3 (right-handed: over from SW to NE, under from SE to NW)
          cu[x], co[x]  component of the under / over strand (links: 0 = loop A, 1 = loop B)
          id[x]      the crossing's number in the item (moves are recorded with these)
          free       closed components without crossings (a plain loop)
          cl         an open rope's outside arc (its ends joined beyond the plate): a slot whose edge
                     holds it, or −1. Moves never use a face that touches it, so the ends stay put
     ===================================================================================== */

  /* ---------- Laurent polynomials in A: { lo, c }, c[k] = coefficient of A^(lo + k) ---------- */

  var P_ZERO = { lo: 0, c: [] };
  function ptrim(lo, c) {
    var a = 0, b = c.length;
    while (a < b && c[a] === 0) a++;
    while (b > a && c[b - 1] === 0) b--;
    return a === b ? P_ZERO : { lo: lo + a, c: c.slice(a, b) };
  }
  function padd(p, q) {
    if (!p.c.length) return q;
    if (!q.c.length) return p;
    var lo = Math.min(p.lo, q.lo), hi = Math.max(p.lo + p.c.length, q.lo + q.c.length), c = new Array(hi - lo), k;
    for (k = 0; k < c.length; k++) c[k] = 0;
    for (k = 0; k < p.c.length; k++) c[p.lo - lo + k] += p.c[k];
    for (k = 0; k < q.c.length; k++) c[q.lo - lo + k] += q.c[k];
    return ptrim(lo, c);
  }
  function pmul(p, q) {
    if (!p.c.length || !q.c.length) return P_ZERO;
    var c = new Array(p.c.length + q.c.length - 1), i, j;
    for (i = 0; i < c.length; i++) c[i] = 0;
    for (i = 0; i < p.c.length; i++) for (j = 0; j < q.c.length; j++) c[i + j] += p.c[i] * q.c[j];
    return ptrim(p.lo + q.lo, c);
  }
  function pmono(coef, e) { return coef ? { lo: e, c: [coef] } : P_ZERO; }
  function peq(p, q) {
    if (p.lo !== q.lo && (p.c.length || q.c.length)) return false;
    if (p.c.length !== q.c.length) return false;
    for (var k = 0; k < p.c.length; k++) if (p.c[k] !== q.c[k]) return false;
    return true;
  }
  function pIsOne(p) { return p.lo === 0 && p.c.length === 1 && p.c[0] === 1; }
  // The mirror image: A → 1/A.
  function pmirror(p) { return p.c.length ? { lo: -(p.lo + p.c.length - 1), c: p.c.slice().reverse() } : P_ZERO; }
  var P_LOOP = { lo: -2, c: [-1, 0, 0, 0, -1] };          // d = −A² − A⁻², one extra loop
  var LOOP_POW = [{ lo: 0, c: [1] }];
  function loopPow(k) { while (LOOP_POW.length <= k) LOOP_POW.push(pmul(LOOP_POW[LOOP_POW.length - 1], P_LOOP)); return LOOP_POW[k]; }
  // A polynomial in A as a polynomial in t = A^−4 (knots: whole powers; two loops: halves), for logs and tests.
  function tText(p) {
    var parts = [];
    for (var k = p.c.length - 1; k >= 0; k--) {
      if (!p.c[k]) continue;
      var e = -(p.lo + k) / 4;
      parts.push(p.c[k] + (e ? 't^' + e : ''));
    }
    return parts.reverse().join(' + ') || '0';
  }

  /* ---------- building a diagram from passages ---------- */

  // comps: one array per closed component of passages in travel order, { c, over, dir: [x, y] }
  // (dir: the travel direction, y up); every crossing 0 … n − 1 appears once over, once under.
  // Open ropes are closed through the outer face, so they are one component like a loop.
  function fromPassages(comps, n, open) {
    var D = newDiagram(n), und = [], ovr = [], k, i, p;
    for (k = 0; k < comps.length; k++) {
      for (i = 0; i < comps[k].length; i++) {
        p = comps[k][i];
        if (p.over) { ovr[p.c] = p.dir; D.co[p.c] = k; } else { und[p.c] = p.dir; D.cu[p.c] = k; }
      }
    }
    for (var x = 0; x < n; x++) {
      var u = und[x], o = ovr[x];
      if (!u || !o) throw new Error('crossing ' + x + ' needs one over and one under passage');
      // slot 1 is the next edge counter-clockwise from the incoming under-strand (direction −u)
      D.oin[x] = (-u[0] * o[1] + u[1] * o[0]) > 0 ? 3 : 1;
    }
    for (k = 0; k < comps.length; k++) {
      var cp = comps[k], m = cp.length;
      if (!m) { D.free++; continue; }
      for (i = 0; i < m; i++) {
        var a = outSlot(D, cp[i]), b = inSlot(D, cp[(i + 1) % m]);
        D.link[a] = b; D.link[b] = a;
      }
      if (open && open[k]) D.cl = outSlot(D, cp[m - 1]);
    }
    return D;
  }
  function inSlot(D, p) { return 4 * p.c + (p.over ? D.oin[p.c] : 0); }
  function outSlot(D, p) { return 4 * p.c + (p.over ? 4 - D.oin[p.c] : 2); }
  function newDiagram(n) {
    var D = { n: n, link: new Int32Array(4 * n), oin: new Int8Array(n), cu: new Int8Array(n), co: new Int8Array(n),
      id: new Int32Array(n), alive: new Uint8Array(n), live: n, free: 0, cl: -1 };
    for (var x = 0; x < n; x++) { D.id[x] = x; D.alive[x] = 1; }
    return D;
  }
  function cloneD(D) {
    return { n: D.n, link: D.link.slice(), oin: D.oin.slice(), cu: D.cu.slice(), co: D.co.slice(), id: D.id.slice(),
      alive: D.alive.slice(), live: D.live, free: D.free, cl: D.cl };
  }
  function onOutside(D, s) { return D.cl >= 0 && (s === D.cl || s === D.link[D.cl]); }
  // Does face f run along the outside arc? (Each corner leaves along the edge of its next slot.)
  function outsideFace(D, f) {
    if (D.cl < 0) return false;
    for (var i = 0; i < f.length; i++) if (onOutside(D, (f[i] & ~3) | ((f[i] + 1) & 3))) return true;
    return false;
  }
  function opp(s) { return (s & ~3) | ((s + 2) & 3); }
  function sgn(D, x) { return D.oin[x] === 3 ? 1 : -1; }
  function writhe(D) { var w = 0; for (var x = 0; x < D.n; x++) if (D.alive[x]) w += sgn(D, x); return w; }
  // Linking number of loops 0 and 1: half the signs of the crossings between them.
  function linking(D) {
    var s = 0;
    for (var x = 0; x < D.n; x++) if (D.alive[x] && D.cu[x] !== D.co[x]) s += sgn(D, x);
    return s / 2;
  }
  function interCount(D) {
    var k = 0;
    for (var x = 0; x < D.n; x++) if (D.alive[x] && D.cu[x] !== D.co[x]) k++;
    return k;
  }
  // The crossing switched (over and under exchanged): the same picture, the other strand on top.
  // Slots turn by one place (the old over-in becomes the new under-in), so the sign flips.
  function switched(D, x) {
    var E = cloneD(D), b = 4 * x, s0 = D.oin[x], k;
    var old = [D.link[b], D.link[b + 1], D.link[b + 2], D.link[b + 3]];
    for (k = 0; k < 4; k++) {                 // new slot j = old slot (s0 + j) mod 4
      var t = old[(s0 + k) & 3];
      E.link[b + k] = t;
    }
    for (k = 0; k < 4; k++) {
      var t2 = E.link[b + k];
      if ((t2 >> 2) === x) E.link[b + k] = b + (((t2 & 3) - s0 + 4) & 3);
      else E.link[t2] = b + k;
    }
    // the old under-strand (old slots 0 → 2) is now over: in at new slot (0 − s0) mod 4
    E.oin[x] = (4 - s0) & 3;
    var c = E.cu[x]; E.cu[x] = E.co[x]; E.co[x] = c;
    if (D.cl >= 0 && (D.cl >> 2) === x) E.cl = b + (((D.cl & 3) - s0 + 4) & 3);
    return E;
  }

  /* ---------- faces and moves ---------- */

  // A face corner (x, s) is the angle between slots s and s + 1 of crossing x; the next corner
  // of its face is where the edge leaving slot s + 1 arrives. Faces: arrays of corners.
  function faces(D) {
    var seen = new Uint8Array(4 * D.n), out = [];
    for (var x = 0; x < D.n; x++) {
      if (!D.alive[x]) continue;
      for (var s = 0; s < 4; s++) {
        var c = 4 * x + s;
        if (seen[c]) continue;
        var f = [];
        while (!seen[c]) { seen[c] = 1; f.push(c); c = D.link[(c & ~3) | ((c + 1) & 3)]; }
        out.push(f);
      }
    }
    return out;
  }
  // A corner's two slots: s (even = under) and s + 1. In a bigon (x, s), (y, t) the edge from
  // x's slot s + 1 to y's slot t keeps one strand on top at both crossings exactly when s and t
  // differ in parity: then it slides off (R2).
  function isR2(f, D) { return f.length === 2 && (f[0] >> 2) !== (f[1] >> 2) && ((f[0] ^ f[1]) & 1) === 1 && !(D && outsideFace(D, f)); }
  function isR1(f, D) { return f.length === 1 && !(D && outsideFace(D, f)); }
  // A triangle (x, s), (y, t), (z, u): strand xy uses slots x.s+1, y.t; yz: y.t+1, z.u; zx: z.u+1, x.s.
  // R3 needs a strand over (odd slots) or under (even slots) at both of its crossings.
  function triStrands(f) {
    var a = f[0], b = f[1], c = f[2];
    function nx(q) { return (q & ~3) | ((q + 1) & 3); }
    return [[nx(a), b], [nx(b), c], [nx(c), a]];
  }
  function isR3(D, f) {
    if (f.length !== 3 || outsideFace(D, f)) return false;
    var X = [f[0] >> 2, f[1] >> 2, f[2] >> 2];
    if (X[0] === X[1] || X[1] === X[2] || X[0] === X[2]) return false;
    var st = triStrands(f), ok = false, i;
    for (i = 0; i < 3; i++) if (((st[i][0] ^ st[i][1]) & 1) === 0) ok = true;
    if (!ok) return false;
    // the six edges leaving the triangle must end outside it (else the rewiring below is not a move)
    for (i = 0; i < 3; i++) {
      for (var j = 0; j < 2; j++) {
        var e = D.link[opp(st[i][j])] >> 2;
        if (e === X[0] || e === X[1] || e === X[2]) return false;
      }
    }
    return true;
  }
  // The strand of a triangle that lies on top of the other two (it is the one show-me lifts).
  function r3Top(f) {
    var st = triStrands(f);
    for (var i = 0; i < 3; i++) if ((st[i][0] & 1) && (st[i][1] & 1)) return i;
    return -1;
  }

  // Removes crossings xs and joins the strands that ran through them; strands that close up
  // inside become plain loops (free).
  function removeX(D, xs) {
    var inR = function (s) { return xs.indexOf(s >> 2) >= 0; };
    var done = {}, i, s, a;
    for (i = 0; i < xs.length; i++) {
      for (s = 0; s < 4; s++) {
        a = 4 * xs[i] + s;
        if (done[a] || inR(D.link[a])) continue;
        var p = D.link[a], cur = a, outside = onOutside(D, a);
        done[a] = 1;
        for (var guard = 0; guard < 16; guard++) {
          var o = opp(cur), nxt = D.link[o];
          done[o] = 1;
          if (onOutside(D, o)) outside = true;
          if (!inR(nxt)) { D.link[p] = nxt; D.link[nxt] = p; if (outside) D.cl = p; break; }
          done[nxt] = 1;
          cur = nxt;
        }
      }
    }
    for (i = 0; i < xs.length; i++) {        // loops lying wholly inside the removed crossings
      for (s = 0; s < 4; s++) {
        a = 4 * xs[i] + s;
        if (done[a]) continue;
        var c2 = a;
        for (var g2 = 0; g2 < 16 && !done[c2]; g2++) { if (onOutside(D, c2)) D.cl = -2; done[c2] = 1; var o2 = opp(c2); done[o2] = 1; c2 = D.link[o2]; }
        D.free++;
      }
    }
    for (i = 0; i < xs.length; i++) { D.alive[xs[i]] = 0; D.live--; }
    if (D.cl === -2 || (D.cl >= 0 && !D.alive[D.cl >> 2])) D.cl = -1;
  }
  // R3: each of the three strands swaps its inner and outer ends (see the note in R2 §4): the
  // edges that left the triangle now join the crossings in the other order, and the crossings
  // keep their slots, signs and strands.
  function applyR3(D, f) {
    var st = triStrands(f), plan = [], i;
    var cl = D.cl;
    for (i = 0; i < 3; i++) {
      var I1 = st[i][0], I2 = st[i][1], X1 = opp(I1), X2 = opp(I2);
      plan.push([X1, X2, I1, D.link[X2], I2, D.link[X1]]);
      if (cl >= 0 && (cl === X1 || cl === D.link[X1])) D.cl = D.link[X1];
      if (cl >= 0 && (cl === X2 || cl === D.link[X2])) D.cl = D.link[X2];
    }
    for (i = 0; i < 3; i++) {
      var q = plan[i];
      D.link[q[0]] = q[1]; D.link[q[1]] = q[0];
      D.link[q[2]] = q[3]; D.link[q[3]] = q[2];
      D.link[q[4]] = q[5]; D.link[q[5]] = q[4];
    }
  }

  // Greedy simplification: untwist curls (R1), slide off loops on top (R2), until neither is
  // left. Moves are recorded with the item's crossing numbers.
  function greedy(D, moves) {
    for (var guard = 0; guard < 64 && D.live > 0; guard++) {
      var F = faces(D), mv = null, i;
      for (i = 0; i < F.length && !mv; i++) if (isR1(F[i], D)) mv = { t: 'R1', x: [F[i][0] >> 2] };
      for (i = 0; i < F.length && !mv; i++) if (isR2(F[i], D)) mv = { t: 'R2', x: [F[i][0] >> 2, F[i][1] >> 2] };
      if (!mv) return;
      moves.push({ t: mv.t, x: mv.x.map(function (k) { return D.id[k]; }) });
      removeX(D, mv.x);
    }
  }
  function r3Moves(D) {
    var F = faces(D), out = [];
    for (var i = 0; i < F.length; i++) if (isR3(D, F[i])) out.push(F[i]);
    return out;
  }
  function r3Record(D, f) {
    return { t: 'R3', x: [D.id[f[0] >> 2], D.id[f[1] >> 2], D.id[f[2] >> 2]], top: r3Top(f) };
  }
  // Greedy moves, then a bounded search for slide-overs (R3, up to `depth` in a row) after which
  // the greedy moves can go on. Returns { D, moves, r3 } (r3: slide-overs used).
  function simplify(D0, depth) {
    var D = cloneD(D0), moves = [], r3 = 0;
    greedy(D, moves);
    while (D.live > 0 && depth > 0) {
      var found = r3Search(D, depth, null, 0);
      if (!found) break;
      D = found.D;
      for (var i = 0; i < found.moves.length; i++) { moves.push(found.moves[i]); if (found.moves[i].t === 'R3') r3++; }
    }
    return { D: D, moves: moves, r3: r3 };
  }
  var R3_BUDGET = { left: 0 };
  function r3Search(D, depth, avoid, level) {
    if (level === 0) R3_BUDGET.left = 400;
    var tris = r3Moves(D);
    for (var i = 0; i < tris.length; i++) {
      var key = triKey(D, tris[i]);
      if (key === avoid) continue;
      if (--R3_BUDGET.left < 0) return null;
      var E = cloneD(D), mv = [r3Record(D, tris[i])];
      applyR3(E, tris[i]);
      var n0 = E.live;
      greedy(E, mv);
      if (E.live < n0) return { D: E, moves: mv };
      if (depth > 1) {
        var deeper = r3Search(E, depth - 1, triKeyAfter(E, key), level + 1);
        if (deeper) return { D: deeper.D, moves: mv.concat(deeper.moves) };
      }
    }
    return null;
  }
  function triKey(D, f) { return [D.id[f[0] >> 2], D.id[f[1] >> 2], D.id[f[2] >> 2]].sort(function (a, b) { return a - b; }).join(','); }
  function triKeyAfter(D, key) { return key; } // undoing a slide-over uses the same three crossings

  /* ---------- invariants ---------- */

  // Compact copy without removed crossings (slots renumbered), for the state sum.
  function compact(D) {
    var map = new Int32Array(D.n), m = 0, x;
    for (x = 0; x < D.n; x++) map[x] = D.alive[x] ? m++ : -1;
    var E = newDiagram(m);
    E.free = D.free;
    if (D.cl >= 0 && D.alive[D.cl >> 2]) E.cl = 4 * map[D.cl >> 2] + (D.cl & 3);
    for (x = 0; x < D.n; x++) {
      if (!D.alive[x]) continue;
      var y = map[x];
      E.oin[y] = D.oin[x]; E.cu[y] = D.cu[x]; E.co[y] = D.co[x]; E.id[y] = D.id[x];
      for (var s = 0; s < 4; s++) { var t = D.link[4 * x + s]; E.link[4 * y + s] = 4 * map[t >> 2] + (t & 3); }
    }
    return E;
  }

  // Kauffman bracket by the state sum, normalised to the Jones polynomial in A (t = A^−4):
  // V = (−A³)^(−w) ⟨D⟩. The A-smoothing of X[a, b, c, d] joins (a, b) and (c, d) (Kauffman 1987).
  // 2^n states; n ≤ 16 here (12 crossings: about 1 ms).
  function jones(D0) {
    var D = D0.live === D0.n ? D0 : compact(D0), n = D.n, E = 2 * n;
    if (n > 16) throw new Error('jones: too many crossings (' + n + ')');
    var edge = new Int32Array(4 * n), e = 0, s;
    for (s = 0; s < 4 * n; s++) edge[s] = -1;
    for (s = 0; s < 4 * n; s++) if (edge[s] < 0) { edge[s] = e; edge[D.link[s]] = e; e++; }
    var maxL = E + 1, cnt = new Float64Array((n + 1) * (maxL + 1)), par = new Int32Array(E);
    function find(a) { while (par[a] !== a) { par[a] = par[par[a]]; a = par[a]; } return a; }
    for (var st = 0; st < (1 << n); st++) {
      for (var i = 0; i < E; i++) par[i] = i;
      var comps = E, nA = 0;
      for (var x = 0; x < n; x++) {
        var b = 4 * x, p1, q1, p2, q2;
        if ((st >> x) & 1) { p1 = edge[b]; q1 = edge[b + 3]; p2 = edge[b + 1]; q2 = edge[b + 2]; }
        else { nA++; p1 = edge[b]; q1 = edge[b + 1]; p2 = edge[b + 2]; q2 = edge[b + 3]; }
        var r1 = find(p1), r2 = find(q1);
        if (r1 !== r2) { par[r1] = r2; comps--; }
        r1 = find(p2); r2 = find(q2);
        if (r1 !== r2) { par[r1] = r2; comps--; }
      }
      cnt[nA * (maxL + 1) + comps]++;
    }
    var br = P_ZERO;
    if (n === 0) br = loopPow(Math.max(0, D.free - 1));
    for (var a = 0; a <= n; a++) {
      for (var L = 1; L <= maxL; L++) {
        var k = cnt[a * (maxL + 1) + L];
        if (!k) continue;
        br = padd(br, pmul(pmono(k, 2 * a - n), loopPow(L - 1 + D.free)));
      }
    }
    var w = writhe(D);
    return pmul(pmono(w % 2 === 0 ? 1 : -1, -3 * w), br);
  }
  var V_UNKNOT = { lo: 0, c: [1] };
  var V_UNLINK2 = { lo: -2, c: [-1, 0, 0, 0, -1] };

  // Determinant of a knot diagram from its Fox colouring matrix (rows: crossings 2·over − in − out,
  // columns: arcs), with one row and one column deleted; Bareiss elimination keeps integers exact.
  function determinant(D0) {
    var D = D0.live === D0.n ? D0 : compact(D0), n = D.n, x;
    if (n <= 1) return 1;
    var overArc = new Int32Array(n), endArc = new Int32Array(n);
    for (x = 0; x < n; x++) {                 // arc x starts at x's outgoing under-slot
      var s = D.link[4 * x + 2];
      for (var g = 0; g <= 2 * n && (s & 3) !== 0; g++) { overArc[s >> 2] = x; s = D.link[opp(s)]; }
      endArc[s >> 2] = x;
    }
    var M = [];
    for (x = 0; x < n; x++) {
      var row = new Array(n);
      for (var j = 0; j < n; j++) row[j] = 0;
      row[overArc[x]] += 2; row[endArc[x]] -= 1; row[x] -= 1;
      M.push(row);
    }
    var m = n - 1, A = [], prev = 1, sign = 1, i, k;
    for (i = 0; i < m; i++) A.push(M[i].slice(0, m));
    for (k = 0; k < m - 1; k++) {
      if (A[k][k] === 0) {
        var r = k + 1;
        while (r < m && A[r][k] === 0) r++;
        if (r === m) return 0;
        var tmp = A[k]; A[k] = A[r]; A[r] = tmp; sign = -sign;
      }
      for (i = k + 1; i < m; i++) for (j = k + 1; j < m; j++) A[i][j] = (A[i][j] * A[k][k] - A[i][k] * A[k][j]) / prev;
      prev = A[k][k];
    }
    return Math.abs(sign * A[m - 1][m - 1]);
  }

  // One loop of a two-loop diagram on its own: the crossings with the other loop are dropped
  // (the strand runs straight through them).
  function component(D0, k) {
    var D = cloneD(D0), drop = [], keep = [], x;
    for (x = 0; x < D.n; x++) {
      if (!D.alive[x]) continue;
      if (D.cu[x] === k && D.co[x] === k) keep.push(x);
      else drop.push(x);
    }
    if (drop.length) removeX(D, drop);
    // removeX turned the other loop into plain loops too: count only this loop's
    D.free = keep.length ? 0 : 1;
    return D;
  }

  /* ---------- classification ---------- */

  // The cheap route of R2 §4.7: greedy R1/R2 to nothing ⇒ unknot (certificate); else a
  // determinant ≠ 1 ⇒ knot; else slide-overs (R3) then greedy ⇒ unknot; else the Jones
  // polynomial of what is left (≤ 24 crossings: V = 1 ⇔ unknot, Tuzun & Sikora).
  // → { knot, proof: 'moves' | 'det' | 'jones', depth: 0 visible | 1 slide-over | 2 detour, moves, det }
  function classify(D0, opts) {
    var full = !opts || opts.full !== false;
    var D = cloneD(D0), moves = [];
    greedy(D, moves);
    if (D.live === 0) return { knot: false, proof: 'moves', depth: 0, moves: moves };
    var det = determinant(D);
    if (det !== 1) return { knot: true, proof: 'det', det: det, moves: moves, core: D };
    if (!full) return null;
    var s = simplify(D, 2);
    if (s.D.live === 0) return { knot: false, proof: 'moves', depth: 1, moves: moves.concat(s.moves), det: 1 };
    var V = jones(s.D);
    if (pIsOne(V)) return { knot: false, proof: 'jones', depth: 2, moves: moves.concat(s.moves), det: 1 };
    return { knot: true, proof: 'jones', det: 1, moves: moves.concat(s.moves), core: s.D };
  }
  /* =====================================================================================
     2. GEOMETRY: a rope is a uniform cubic B-spline through integer control points on a
        320 × 320 plate (x right, y down, as drawn). Open ropes start and end off the plate;
        loops are closed splines. Evaluation uses + − × ÷ only (literal basis weights), so every
        engine samples the same points; the view draws the same curve as exact Bézier pieces.
     ===================================================================================== */

  var PLATE = 320;
  var SUB = 8;                                   // samples per control interval
  // Basis weights, first and second derivatives at u = (k + ½)/SUB: samples fall between the
  // spline's knots, so a crossing at a lattice point never lands on a sample (no rounding ties).
  var BW = [], BD = [];
  (function () {
    for (var k = 0; k < SUB; k++) {
      var u = (k + 0.5) / SUB, u2 = u * u, u3 = u2 * u, v = 1 - u;
      BW.push([v * v * v / 6, (3 * u3 - 6 * u2 + 4) / 6, (-3 * u3 + 3 * u2 + 3 * u + 1) / 6, u3 / 6]);
      BD.push([-v * v / 2, (3 * u2 - 4 * u) / 2, (-3 * u2 + 2 * u + 1) / 2, u2 / 2, v, 3 * u - 2, 1 - 3 * u, u]);
    }
  })();
  var SIN_MIN = 0.573576436351046;             // sin 35°: the smallest crossing angle allowed
  var CROSS_GAP = 36;                          // px between crossings
  var TAG_GAP = 44;                            // px between crossings that carry answer tags
  var TRIPLE = 16;                             // px: no third strand this close to a crossing (2 strokes)
  var RADIUS_MIN = 8;                          // px: the tightest bend (a corner of the 25 px lattice: 8.8)
  var EDGE_IN = 20;                            // px: crossings stay this far inside the plate

  // A curve { pts: [[x, y], …], closed } → samples { x[], y[], dx[], dy[], ddx[], ddy[], t[], m, closed }
  // (analytic first and second derivatives; t: control-interval index + (k + ½)/SUB).
  function sampleCurve(cv) {
    var P = cv.pts, m = P.length, closed = !!cv.closed;
    var first = closed ? 0 : 1, last = closed ? m - 1 : m - 3, M = (last - first + 1) * SUB;
    var xs = new Float64Array(M), ys = new Float64Array(M), dxs = new Float64Array(M), dys = new Float64Array(M);
    var ddxs = new Float64Array(M), ddys = new Float64Array(M), ts = new Float64Array(M), q = 0;
    for (var i = first; i <= last; i++) {
      var a = P[closed ? (i - 1 + m) % m : i - 1], b = P[closed ? i % m : i], c = P[closed ? (i + 1) % m : i + 1], d = P[closed ? (i + 2) % m : i + 2];
      for (var k = 0; k < SUB; k++, q++) {
        var w = BW[k], g = BD[k];
        xs[q] = w[0] * a[0] + w[1] * b[0] + w[2] * c[0] + w[3] * d[0];
        ys[q] = w[0] * a[1] + w[1] * b[1] + w[2] * c[1] + w[3] * d[1];
        dxs[q] = g[0] * a[0] + g[1] * b[0] + g[2] * c[0] + g[3] * d[0];
        dys[q] = g[0] * a[1] + g[1] * b[1] + g[2] * c[1] + g[3] * d[1];
        ddxs[q] = g[4] * a[0] + g[5] * b[0] + g[6] * c[0] + g[7] * d[0];
        ddys[q] = g[4] * a[1] + g[5] * b[1] + g[6] * c[1] + g[7] * d[1];
        ts[q] = i + (k + 0.5) / SUB;
      }
    }
    return { x: xs, y: ys, dx: dxs, dy: dys, ddx: ddxs, ddy: ddys, t: ts, m: M, closed: closed };
  }
  // The same curve as cubic Bézier pieces [[x0, y0, x1, y1, x2, y2, x3, y3], …] (exact).
  function bezier(cv) {
    var P = cv.pts, m = P.length, closed = !!cv.closed, out = [];
    var first = closed ? 0 : 1, last = closed ? m - 1 : m - 3;
    function at(i) { return P[closed ? (i + m) % m : i]; }
    for (var i = first; i <= last; i++) {
      var a = at(i - 1), b = at(i), c = at(i + 1), d = at(i + 2);
      out.push([(a[0] + 4 * b[0] + c[0]) / 6, (a[1] + 4 * b[1] + c[1]) / 6, (2 * b[0] + c[0]) / 3, (2 * b[1] + c[1]) / 3,
        (b[0] + 2 * c[0]) / 3, (b[1] + 2 * c[1]) / 3, (b[0] + 4 * c[0] + d[0]) / 6, (b[1] + 4 * c[1] + d[1]) / 6]);
    }
    return out;
  }

  // Every crossing of the curves (one or two), found with a 16 px grid of segments. A crossing
  // { a: [curve, t], b: [curve, t] (a before b in curve order), x, y, sin, da, db (unit travel
  // directions, y up) } is reported once: segments are half-open and each pair is tested in the
  // grid cell that holds its intersection point.
  var CELL = 16, GO = 16, GN = 56;               // grid: 16 px cells from −256 px, 56 × 56
  function crossingsOf(curves) {
    var S = curves.map(sampleCurve), segs = [], k, j, q;
    for (k = 0; k < S.length; k++) {
      var s = S[k], nSeg = s.closed ? s.m : s.m - 1;
      for (j = 0; j < nSeg; j++) segs.push(k, j, (j + 1) % s.m);
    }
    var nS = segs.length / 3, lo = new Int32Array(nS * 4), cnt = new Int32Array(GN * GN + 1);
    function cell(v) { var c = Math.floor(v / CELL) + GO; return c < 0 ? 0 : c >= GN ? GN - 1 : c; }
    for (q = 0; q < nS; q++) {
      var A = S[segs[3 * q]], i0 = segs[3 * q + 1], i1 = segs[3 * q + 2];
      var cx0 = cell(Math.min(A.x[i0], A.x[i1])), cx1 = cell(Math.max(A.x[i0], A.x[i1]));
      var cy0 = cell(Math.min(A.y[i0], A.y[i1])), cy1 = cell(Math.max(A.y[i0], A.y[i1]));
      lo[4 * q] = cx0; lo[4 * q + 1] = cx1; lo[4 * q + 2] = cy0; lo[4 * q + 3] = cy1;
      for (var cx = cx0; cx <= cx1; cx++) for (var cy = cy0; cy <= cy1; cy++) cnt[cx * GN + cy + 1]++;
    }
    for (k = 1; k <= GN * GN; k++) cnt[k] += cnt[k - 1];
    var fill = cnt.slice(0, GN * GN), list = new Int32Array(cnt[GN * GN]);
    for (q = 0; q < nS; q++) {
      for (var ux = lo[4 * q]; ux <= lo[4 * q + 1]; ux++) for (var uy = lo[4 * q + 2]; uy <= lo[4 * q + 3]; uy++) list[fill[ux * GN + uy]++] = q;
    }
    var out = [];
    for (var gk = 0; gk < GN * GN; gk++) {
      var from = cnt[gk], to = cnt[gk + 1];
      if (to - from < 2) continue;
      var gx = (gk / GN) | 0, gy = gk - gx * GN;
      for (var u = from; u < to; u++) {
        var s1 = list[u];
        for (var v = u + 1; v < to; v++) {
          var s2 = list[v], c1 = segs[3 * s1], c2 = segs[3 * s2];
          if (c1 === c2) {
            var L = S[c1], dd = Math.abs(segs[3 * s1 + 1] - segs[3 * s2 + 1]);
            if (dd <= 1 || (L.closed && dd >= L.m - 1)) continue;
          }
          var hit = segHit(S, [c1, segs[3 * s1 + 1], segs[3 * s1 + 2]], [c2, segs[3 * s2 + 1], segs[3 * s2 + 2]]);
          if (!hit || cell(hit.x) !== gx || cell(hit.y) !== gy) continue;
          out.push(hit);
        }
      }
    }
    out.sort(function (a, b) { return a.a[0] - b.a[0] || a.a[1] - b.a[1]; });
    return { list: out, samples: S };
  }
  function segHit(S, p1, p2) {
    var A = S[p1[0]], B = S[p2[0]];
    var ax = A.x[p1[1]], ay = A.y[p1[1]], rx = A.x[p1[2]] - ax, ry = A.y[p1[2]] - ay;
    var bx = B.x[p2[1]], by = B.y[p2[1]], sx = B.x[p2[2]] - bx, sy = B.y[p2[2]] - by;
    var den = rx * sy - ry * sx;
    if (den === 0) return null;
    var qx = bx - ax, qy = by - ay, s = (qx * sy - qy * sx) / den, w = (qx * ry - qy * rx) / den;
    if (s < 0 || s >= 1 || w < 0 || w >= 1) return null;
    var lr = Math.sqrt(rx * rx + ry * ry), ls = Math.sqrt(sx * sx + sy * sy);
    var ta = A.t[p1[1]] + s / SUB, tb = B.t[p2[1]] + w / SUB;
    var ha = { c: p1[0], t: ta, seg: p1[1], d: [rx / lr, -ry / lr] }, hb = { c: p2[0], t: tb, seg: p2[1], d: [sx / ls, -sy / ls] };
    var first = ha.c < hb.c || (ha.c === hb.c && ha.t < hb.t);
    var a = first ? ha : hb, b = first ? hb : ha;
    return { a: [a.c, a.t], b: [b.c, b.t], sa: a.seg, sb: b.seg, x: ax + s * rx, y: ay + s * ry, sin: Math.abs(den) / (lr * ls), da: a.d, db: b.d };
  }

  // The diagram of curves + over flags (over[c]: the first passage of crossing c, in curve
  // order, is on top). Crossings are numbered by their first passage. → { X, D } or a reason.
  function diagramOf(curves, over) {
    var CX = crossingsOf(curves), X = CX.list;
    if (!Array.isArray(over) || over.length !== X.length) return 'the curves cross ' + X.length + ' times, the item has ' + (over ? over.length : 0) + ' over/under flags';
    var comps = curves.map(function () { return []; });
    X.forEach(function (x, c) {
      comps[x.a[0]].push({ c: c, t: x.a[1], over: !!over[c], dir: x.da, first: true });
      comps[x.b[0]].push({ c: c, t: x.b[1], over: !over[c], dir: x.db, first: false });
    });
    comps.forEach(function (cp) { cp.sort(function (p, q) { return p.t - q.t; }); });
    var D = fromPassages(comps, X.length, curves.map(function (cv) { return !cv.closed; }));
    return { X: X, D: D, comps: comps, S: CX.samples, open: curves.map(function (cv) { return !cv.closed; }) };
  }
  /* ---------- legibility (R2 §5.2, for a 320 px plate) ---------- */

  function arcLengths(s) {
    var a = [0];
    for (var j = 1; j < s.m; j++) a.push(a[j - 1] + Math.sqrt((s.x[j] - s.x[j - 1]) * (s.x[j] - s.x[j - 1]) + (s.y[j] - s.y[j - 1]) * (s.y[j] - s.y[j - 1])));
    var total = a[s.m - 1];
    if (s.closed) total += Math.sqrt((s.x[0] - s.x[s.m - 1]) * (s.x[0] - s.x[s.m - 1]) + (s.y[0] - s.y[s.m - 1]) * (s.y[0] - s.y[s.m - 1]));
    return { a: a, total: total };
  }
  function inside(x, y, m) { return x >= m && x <= PLATE - m && y >= m && y <= PLATE - m; }

  // → { gap, radius, minSep } or a reason. opts.gap: the spacing level's smallest strand gap;
  // opts.open: the curve is an open rope whose ends must leave the plate.
  function legible(dg, opts) {
    var X = dg.X, S = dg.S, i, j, k;
    for (i = 0; i < X.length; i++) {
      if (X[i].sin < SIN_MIN) return 'crossing ' + i + ' is too flat (' + (Math.asin(Math.min(1, X[i].sin)) * 180 / Math.PI).toFixed(0) + '°)';
      if (!inside(X[i].x, X[i].y, EDGE_IN)) return 'crossing ' + i + ' is too close to the edge';
    }
    var minSep = Infinity;
    for (i = 0; i < X.length; i++) {
      for (j = i + 1; j < X.length; j++) {
        var dx = X[i].x - X[j].x, dy = X[i].y - X[j].y, d = Math.sqrt(dx * dx + dy * dy);
        if (d < minSep) minSep = d;
      }
    }
    if (minSep < CROSS_GAP - 1e-6) return 'two crossings are ' + minSep.toFixed(1) + ' px apart';
    var arcs = S.map(arcLengths), pts = [], G = {}, C = 16;
    for (k = 0; k < S.length; k++) {
      for (j = 0; j < S[k].m; j++) {
        if (!inside(S[k].x[j], S[k].y[j], -4)) continue;
        var id = pts.length, gx = Math.floor(S[k].x[j] / C), gy = Math.floor(S[k].y[j] / C);
        pts.push([k, j, S[k].x[j], S[k].y[j]]);
        (G[gx * 4096 + gy] || (G[gx * 4096 + gy] = [])).push(id);
      }
    }
    function arcDist(p, q) {
      if (p[0] !== q[0]) return Infinity;
      var A = arcs[p[0]], d = Math.abs(A.a[p[1]] - A.a[q[1]]);
      return S[p[0]].closed ? Math.min(d, A.total - d) : d;
    }
    // Two points are close because their strands meet at a crossing when that crossing is about
    // as near to both of them as they are to each other.
    function explained(p, q, dd) {
      for (var c = 0; c < X.length; c++) {
        var ax = p[2] - X[c].x, ay = p[3] - X[c].y, bx = q[2] - X[c].x, by = q[3] - X[c].y, r = (dd + 4) * (dd + 4);
        if (ax * ax + ay * ay <= r && bx * bx + by * by <= r) return true;
      }
      return false;
    }
    for (i = 0; i < X.length; i++) {
      var cx = Math.floor(X[i].x / C), cy = Math.floor(X[i].y / C);
      for (var u = cx - 2; u <= cx + 2; u++) {
        for (var v = cy - 2; v <= cy + 2; v++) {
          var cell = G[u * 4096 + v];
          if (!cell) continue;
          for (j = 0; j < cell.length; j++) {
            var p = pts[cell[j]], ex2 = p[2] - X[i].x, ey2 = p[3] - X[i].y;
            if (ex2 * ex2 + ey2 * ey2 >= TRIPLE * TRIPLE) continue;
            if (ownPassage(p, X[i], arcs, S)) continue;
            return 'a third strand passes ' + Math.sqrt(ex2 * ex2 + ey2 * ey2).toFixed(1) + ' px from crossing ' + i;
          }
        }
      }
    }
    // the gap between strands that are not neighbours along the rope, away from crossings
    var gap = Infinity, R = Math.ceil((opts.gap + 8) / C);
    for (i = 0; i < pts.length; i++) {
      var p1 = pts[i], g1x = Math.floor(p1[2] / C), g1y = Math.floor(p1[3] / C);
      for (u = g1x - R; u <= g1x + R; u++) {
        for (v = g1y - R; v <= g1y + R; v++) {
          var cl = G[u * 4096 + v];
          if (!cl) continue;
          for (j = 0; j < cl.length; j++) {
            if (cl[j] <= i) continue;
            var p2 = pts[cl[j]], fx = p1[2] - p2[2], fy = p1[3] - p2[3], dd = Math.sqrt(fx * fx + fy * fy);
            if (dd >= gap) continue;
            var ad = arcDist(p1, p2);
            if (ad < 2 * dd || ad < 24) continue;
            if (explained(p1, p2, dd)) continue;
            gap = dd;
          }
        }
      }
    }
    if (gap < opts.gap) return 'two strands run ' + gap.toFixed(1) + ' px apart (this spacing needs ' + opts.gap + ')';
    // bends
    var radius = Infinity;
    for (k = 0; k < S.length; k++) {
      var s = S[k];
      for (j = 0; j < s.m; j++) {
        if (!inside(s.x[j], s.y[j], 0)) continue;
        var cr = Math.abs(s.dx[j] * s.ddy[j] - s.dy[j] * s.ddx[j]), sp = Math.sqrt(s.dx[j] * s.dx[j] + s.dy[j] * s.dy[j]);
        if (cr > 1e-12) radius = Math.min(radius, sp * sp * sp / cr);
      }
    }
    if (radius < RADIUS_MIN) return 'a bend is too tight (' + radius.toFixed(1) + ' px)';
    if (opts.open) {
      var s0 = S[0], inn = [];
      for (j = 0; j < s0.m; j++) inn.push(inside(s0.x[j], s0.y[j], 12));
      var first = inn.indexOf(true), last = inn.lastIndexOf(true);
      if (first <= 0 || last >= s0.m - 1 || inside(s0.x[0], s0.y[0], 0) || inside(s0.x[s0.m - 1], s0.y[s0.m - 1], 0)) return 'the ends must run off the plate';
      for (j = first; j <= last; j++) if (!inn[j]) return 'the rope leaves the plate between its ends';
      for (i = 0; i < X.length; i++) {
        var sa = X[i].sa, sb = X[i].sb;
        if (sa < first + 2 * SUB / 2 || sb > last - SUB) return 'a crossing sits on an end of the rope';
      }
    }
    return { gap: gap, radius: radius, minSep: minSep };
  }
  // Is sample p on one of crossing x's two passages (within 30 px of it along the rope)?
  function ownPassage(p, x, arcs, S) {
    var hits = [[x.a[0], x.sa], [x.b[0], x.sb]];
    for (var h = 0; h < 2; h++) {
      if (hits[h][0] !== p[0]) continue;
      var A = arcs[p[0]], d = Math.abs(A.a[p[1]] - A.a[hits[h][1]]);
      if (S[p[0]].closed) d = Math.min(d, A.total - d);
      if (d <= 30) return true;
    }
    return false;
  }

  /* =====================================================================================
     3. SHADOWS: a rope's outline is a walk on a lattice, smoothed by the spline. Strands
        cross only at lattice points, straight through and at right angles; a point is used at
        most twice, an edge once. The lattice pitch is the spacing level (R2 §7.2: open /
        close / tight strand gaps), so every crossing is clean and every gap is at least the
        level's. The walk crosses earlier strands until it has its crossings, then heads out.
     ===================================================================================== */

  // sep: crossings never on neighbouring lattice points (1: the four beside, 2: all eight), so that
  // they stay ≥ 36 px apart; gap: the smallest strand gap the validator accepts at this level.
  var SPACING = [
    { name: 'open', pitch: 37, L: 8, sep: 0, gap: 30, jitter: 2 },
    { name: 'close', pitch: 28, L: 10, sep: 1, gap: 24, jitter: 1 },
    { name: 'tight', pitch: 24, L: 12, sep: 2, gap: 20, jitter: 0 },
  ];
  var DIRS = [[1, 0], [0, 1], [-1, 0], [0, -1]];  // right, down, left, up (lattice: y down)

  // One walk on the lattice. spec: { open: true (from the plate edge to the plate edge) | false (a
  // loop back to its start), self: crossings of itself, inter: crossings of loops already in st }.
  // st: { vis, axis, used, owner } (cells used once / as a crossing, a used cell's straight axis
  // 1 horizontal / 2 vertical / 3 turn or end, edges used, which loop owns a cell), or null for an
  // empty lattice. The walk keeps momentum, avoids running beside other strands (long straight runs
  // cross more, and the cell beyond a crossing must be free), and backs up a few steps when it is
  // stuck or cannot finish. → { path, cross: [[cell, inter?]…], L } or null; st is updated on success.
  function walk(rng, L, st, me, spec, opts) {
    var NN = L * L, base = st || { vis: new Uint8Array(NN), axis: new Uint8Array(NN), used: new Uint8Array(NN * 2), owner: new Int8Array(NN).fill(-1) };
    var vis = base.vis.slice(), axis = base.axis.slice(), used = base.used.slice(), owner = base.owner.slice();
    var wS = opts.straight || 12, wT = opts.turn || 1, wX = opts.cross || 30, ray = opts.ray === undefined ? 3 : opts.ray;
    var side0 = opts.side === undefined ? 0.02 : opts.side, open = spec.open !== false;
    var needSelf = spec.self || 0, needInter = spec.inter || 0, nSelf = 0, nInter = 0;
    function edge(a, dir) { return dir === 0 ? a * 2 : dir === 1 ? a * 2 + 1 : dir === 2 ? (a - 1) * 2 : (a - L) * 2 + 1; }
    function step(a, dir) {
      var i = a % L, j = (a - i) / L, ni = i + DIRS[dir][0], nj = j + DIRS[dir][1];
      return ni < 0 || nj < 0 || ni >= L || nj >= L ? -1 : ni + nj * L;
    }
    function adjCross(q) {
      var qi = q % L, qj = (q - qi) / L;
      for (var dj = -1; dj <= 1; dj++) {
        for (var di = -1; di <= 1; di++) {
          if ((!di && !dj) || (opts.sep < 2 && di && dj)) continue;
          var ri = qi + di, rj = qj + dj;
          if (ri >= 0 && rj >= 0 && ri < L && rj < L && vis[ri + rj * L] === 2) return true;
        }
      }
      return false;
    }
    // start: an edge cell heading in (open), or a free inner cell with a free cell ahead (loop)
    var s0, d0;
    if (open) {
      var sd = rng.int(0, 3), pos = rng.int(1, L - 2);
      s0 = sd === 0 ? pos * L : sd === 1 ? pos : sd === 2 ? L - 1 + pos * L : pos + (L - 1) * L; d0 = sd;
      if (vis[s0] !== 0) return null;
    } else {
      var free = [];
      for (var f = 0; f < NN; f++) {
        var fi = f % L, fj = (f - fi) / L;
        if (vis[f] === 0 && fi > 0 && fj > 0 && fi < L - 1 && fj < L - 1) free.push(f);
      }
      if (!free.length) return null;
      s0 = rng.pick(free); d0 = rng.int(0, 3);
      if (step(s0, d0) < 0 || vis[step(s0, d0)] !== 0) return null;
    }
    var s0i = s0 % L, s0j = (s0 - s0i) / L;
    var path, cross, cur, d, must;
    function reset() {
      vis.set(base.vis); axis.set(base.axis); used.set(base.used); owner.set(base.owner);
      path = [s0]; cross = []; cur = s0; d = d0; must = false; nSelf = 0; nInter = 0;
      vis[s0] = 1; axis[s0] = 3; owner[s0] = me;
    }
    reset();
    function exitCell(b) {
      var bi = b % L, bj = (b - bi) / L;
      if (!(bi === 0 || bj === 0 || bi === L - 1 || bj === L - 1)) return false;
      if ((bi === 0 || bi === L - 1) && (bj === 0 || bj === L - 1)) return false;
      return Math.abs(bi - s0i) + Math.abs(bj - s0j) >= 3;
    }
    // a loop ends by stepping into s0 from a neighbour other than the cell ahead of it, never
    // arriving head-on against its first step
    function homeFrom(a) {
      for (var e = 0; e < 4; e++) {
        if (step(a, e) !== s0 || e === ((d0 + 2) & 3) || a === step(s0, d0) || used[edge(a, e)]) continue;
        return e;
      }
      return -1;
    }
    function done(b) { return open ? exitCell(b) : homeFrom(b) >= 0; }
    // the cells of a free route (no crossings) from cur to a finish, as a path, or null
    function route() {
      var prev = new Int32Array(NN).fill(-2), pdir = new Int8Array(NN), queue = [], qh = 0, ord = rng.shuffle([0, 1, 2, 3]);
      for (var t = 0; t < 4; t++) {
        var e0 = ord[t];
        if ((must && e0 !== d) || e0 === ((d + 2) & 3)) continue;
        var b0 = step(cur, e0);
        if (b0 < 0 || vis[b0] !== 0 || used[edge(cur, e0)]) continue;
        prev[b0] = -1; pdir[b0] = e0; queue.push(b0);
      }
      while (qh < queue.length) {
        var a = queue[qh++];
        if (done(a)) {
          var out = [];
          for (var x = a; x !== -1; x = prev[x]) out.push([x, pdir[x]]);
          return out.reverse();
        }
        for (var e = 0; e < 4; e++) {
          if (e === ((pdir[a] + 2) & 3)) continue;
          var b = step(a, e);
          if (b < 0 || prev[b] !== -2 || vis[b] !== 0) continue;
          prev[b] = a; pdir[b] = e; queue.push(b);
        }
      }
      return null;
    }
    function alongside(q, dir) {
      for (var e = 1; e < 4; e += 2) {
        var b = step(q, (dir + e) & 3);
        if (b >= 0 && b !== cur && vis[b] !== 0) return true;
      }
      return false;
    }
    function ahead(q, dir) {
      var k = 0, a = q;
      for (var r = 0; r < L; r++) {
        var b = step(a, dir);
        if (b < 0) break;
        if (vis[b] === 1 && axis[b] === ((dir & 1) ? 1 : 2)) { k++; a = b; continue; }
        if (vis[b] !== 0) break;
        a = b;
      }
      return k;
    }
    function move(nd, q, kind) {
      if (vis[cur] === 1 && cur !== s0) axis[cur] = nd === d ? ((d & 1) ? 2 : 1) : 3;
      used[edge(cur, nd)] = 1;
      if (kind) { vis[q] = 2; must = true; cross.push([q, kind === 2]); if (kind === 2) nInter++; else nSelf++; }
      else { vis[q] = 1; owner[q] = me; must = false; }
      path.push(q); cur = q; d = nd;
    }
    function rewind(k) {
      var keep = path.slice(0, k), kinds = {};
      for (var c2 = 0; c2 < cross.length; c2++) kinds[cross[c2][0]] = cross[c2][1] ? 2 : 1;
      reset();
      for (var z = 1; z < keep.length; z++) {
        var b = keep[z], ci = cur % L, bi = b % L, nd2 = bi > ci ? 0 : bi < ci ? 2 : b > cur ? 1 : 3;
        move(nd2, b, vis[b] === 1 && kinds[b] ? kinds[b] : 0);
      }
    }
    var budget = opts.budget || 12 * NN, back = 0, minLen = spec.minLen || 0;
    for (var g = 0; g < budget; g++) {
      var left = needSelf - nSelf + needInter - nInter;
      if (left === 0 && path.length >= minLen) {
        var tail = route();
        if (tail) {
          for (var z = 0; z < tail.length; z++) move(tail[z][1], tail[z][0], 0);
          if (open) axis[cur] = 3;
          else {
            var ed = homeFrom(cur);
            if (vis[cur] === 1 && cur !== s0) axis[cur] = ed === d ? ((d & 1) ? 2 : 1) : 3;
            used[edge(cur, ed)] = 1;
            axis[s0] = ed === d0 ? ((d0 & 1) ? 2 : 1) : 3;
          }
          if (st) { st.vis.set(vis); st.axis.set(axis); st.used.set(used); st.owner.set(owner); }
          return { path: path, cross: cross.map(function (x) { return x[0]; }), kinds: cross, L: L };
        }
        if (++back > (opts.backs || 60) || path.length < 4) return null;
        rewind(Math.max(1, path.length - rng.int(2, Math.min(14, path.length - 1))));
        continue;
      }
      var cand = [], wsum = 0;
      for (var turn = 0; turn < 3; turn++) {
        var nd = turn === 0 ? d : turn === 1 ? (d + 1) & 3 : (d + 3) & 3;
        if (must && nd !== d) continue;
        var q = step(cur, nd);
        if (q < 0 || q === s0 || used[edge(cur, nd)]) continue;
        var w = 0, kind = 0;
        if (vis[q] === 0) {
          w = (turn === 0 ? wS : wT) * (1 + ray * Math.min(ahead(q, nd), left)) * (alongside(q, nd) ? side0 : 1);
        } else if (vis[q] === 1 && axis[q] === ((nd & 1) ? 1 : 2)) {
          var inter = owner[q] !== me, q2 = step(q, nd);
          if ((inter ? nInter < needInter : nSelf < needSelf) && q2 >= 0 && q2 !== s0 && vis[q2] === 0 && !(opts.sep && adjCross(q))) { w = wX; kind = inter ? 2 : 1; }
        }
        if (w > 0) { cand.push([nd, q, kind, w]); wsum += w; }
      }
      if (!cand.length) {
        if (++back > (opts.backs || 60) || path.length < 4) return null;
        rewind(Math.max(1, path.length - rng.int(2, Math.min(14, path.length - 1))));
        continue;
      }
      var r = rng.next() * wsum, pick = cand[cand.length - 1];
      for (var o = 0; o < cand.length; o++) { r -= cand[o][3]; if (r < 0) { pick = cand[o]; break; } }
      move(pick[0], pick[1], pick[2]);
    }
    return null;
  }
  function walkOpen(rng, L, n, opts) { return walk(rng, L, null, 0, { open: true, self: n }, opts); }
  // The outward unit step at a boundary cell (corners excluded).
  function outward(c, L) {
    var i = c % L, j = (c - i) / L;
    return i === 0 ? [-1, 0] : i === L - 1 ? [1, 0] : j === 0 ? [0, -1] : [0, 1];
  }
  // Lattice path → integer control points on the plate, with ends running off it and a small
  // integer jitter (so the rope looks laid, not ruled).
  function ropePoints(rng, w, sp, jitter) {
    var L = w.L, p = sp.pitch, m = Math.floor((PLATE - (L - 1) * p) / 2), pts = [], fixed = {}, k;
    function xy(c) { var i = c % L, j = (c - i) / L; return [m + i * p, m + j * p]; }
    for (k = 0; k < w.path.length; k++) {
      if (w.cross.indexOf(w.path[k]) >= 0) { fixed[k] = 1; fixed[k - 1] = 1; fixed[k + 1] = 1; }
    }
    var a = xy(w.path[0]), oa = outward(w.path[0], L), b = xy(w.path[w.path.length - 1]), ob = outward(w.path[w.path.length - 1], L);
    pts.push([a[0] + oa[0] * 3 * p, a[1] + oa[1] * 3 * p], [a[0] + oa[0] * 1.5 * p, a[1] + oa[1] * 1.5 * p]);
    for (k = 0; k < w.path.length; k++) {
      var q = xy(w.path[k]), jx = 0, jy = 0;
      if (jitter) { jx = rng.int(-jitter, jitter); jy = rng.int(-jitter, jitter); }
      if (fixed[k]) { jx = 0; jy = 0; }
      pts.push([q[0] + jx, q[1] + jy]);
    }
    pts.push([b[0] + ob[0] * 1.5 * p, b[1] + ob[1] * 1.5 * p], [b[0] + ob[0] * 3 * p, b[1] + ob[1] * 3 * p]);
    return pts.map(function (q) { return [Math.round(q[0]), Math.round(q[1])]; });
  }
  /* =====================================================================================
     4. ITEMS
     ===================================================================================== */

  // Cheap things a player could count in a rope picture (R2 §7.4): used to match a knot and an
  // unknot drawn from one outline, and by the tests' shortcut solvers.
  //   alt / altClosed  over-under changes along the rope (without / with the closure outside)
  //   writhe           the sum of crossing signs; r1 curls; bigons; r2 loops lying on top (R2 moves)
  //   r3               slide-over triangles; mono: the rope is descending from one end (all first
  //                    meetings over, or all under: a sound "no knot" rule, R2 §3.1)
  function ropeFeatures(dg) {
    var P = dg.comps[0], m = P.length, alt = 0, k;
    for (k = 0; k + 1 < m; k++) if (P[k].over !== P[k + 1].over) alt++;
    var altClosed = alt + (m > 1 && P[m - 1].over !== P[0].over ? 1 : 0);
    var F = faces(dg.D), r1 = 0, r2 = 0, bigons = 0, r3 = 0;
    for (k = 0; k < F.length; k++) {
      if (isR1(F[k])) r1++;
      else if (F[k].length === 2) { bigons++; if (isR2(F[k])) r2++; }
      else if (isR3(dg.D, F[k])) r3++;
    }
    var firstOver = 0;
    for (k = 0; k < m; k++) if (P[k].c >= 0 && firstSeen(P, k)) firstOver += P[k].over ? 1 : 0;
    var n = dg.X.length;
    return { n: n, alt: alt, altClosed: altClosed, writhe: writhe(dg.D), r1: r1, r2: r2, bigons: bigons, r3: r3,
      mono: n > 0 && (firstOver === n || firstOver === 0) };
  }
  function firstSeen(P, k) { for (var j = 0; j < k; j++) if (P[j].c === P[k].c) return false; return true; }

  // A diagram from the shadow's passages with new over flags (geometry unchanged).
  function withOver(dg, over) {
    var comps = dg.comps.map(function (cp) {
      return cp.map(function (p) { return { c: p.c, t: p.t, dir: p.dir, first: p.first, over: p.first ? !!over[p.c] : !over[p.c] }; });
    });
    return { X: dg.X, comps: comps, D: fromPassages(comps, dg.X.length, dg.open), S: dg.S, over: over.slice() };
  }

  /* ---------- the rope ladder ---------- */

  // R2 §7.2 asked for 3 … 12 crossings; measured on this generator (docs: B4 notes), a knot and an
  // unknot with the same alternations, writhe and visible slides exist only from 5 crossings (every
  // 3-crossing knot is the alternating trefoil), and unknots that need a slide-over (R3) only from 7.
  // Unknots that need a detour were too rare to generate (≤ 4 of 40 outlines at 10–12 crossings).
  // depth: 0 = the unknot falls open by visible moves (R1, R2); 1 = it needs a slide-over first.
  var RUNGS = [
    { n: 5, depth: 0 }, { n: 6, depth: 0 }, { n: 7, depth: 0 }, { n: 8, depth: 0 }, { n: 8, depth: 1 },
    { n: 9, depth: 0 }, { n: 9, depth: 1 }, { n: 10, depth: 1 }, { n: 11, depth: 1 }, { n: 12, depth: 1 },
  ];
  var RUNG_LABELS = ['5', '6', '7', '8', '8 slide-over', '9', '9 slide-over', '10 slide-over', '11 slide-over', '12 slide-over'];

  // A legible open-rope outline with n crossings for spacing level sp → the diagram (all flags true) or null.
  // check: run the legibility rules here too (the lattice keeps them; generate validates the item).
  function ropeShadow(rng, sp, n, check) {
    for (var t = 0; t < 40; t++) {
      var w = walkOpen(rng, sp.L, n, { sep: sp.sep });
      if (!w) continue;
      var pts = ropePoints(rng, w, sp, sp.jitter), over = [];
      for (var i = 0; i < n; i++) over.push(true);
      var dg = diagramOf([{ pts: pts, closed: false }], over);
      if (typeof dg === 'string' || (check && typeof legible(dg, { gap: sp.gap, open: true }) === 'string')) continue;
      dg.pts = pts;
      return dg;
    }
    return null;
  }
  // The outline's fixed facts for fast signatures: per crossing the sign it has when its first
  // passage is on top; per bigon its crossings and whether it is a slide-off loop with all flags
  // true (switching either crossing flips that). Then alternations, writhe and visible slides of any
  // flags take O(n), with no diagram built.
  function shadowFacts(dg) {
    var n = dg.X.length, s1 = [], x, k;
    var D1 = dg.D;                                   // built with every flag true
    for (x = 0; x < n; x++) s1.push(sgn(D1, x));
    var F = faces(D1), big = [];
    for (k = 0; k < F.length; k++) if (F[k].length === 2 && (F[k][0] >> 2) !== (F[k][1] >> 2)) big.push([F[k][0] >> 2, F[k][1] >> 2, isR2(F[k]) ? 1 : 0]);
    var P = dg.comps[0].map(function (p) { return [p.c, p.first ? 1 : 0]; });
    return { n: n, s1: s1, big: big, P: P };
  }
  function fastSig(fc, over) {
    var P = fc.P, m = P.length, alt = 0, prev = -1, first = -1, k, w = 0, r2 = 0;
    for (k = 0; k < m; k++) {
      var o = over[P[k][0]] ? P[k][1] : 1 - P[k][1];
      if (k === 0) first = o; else if (o !== prev) alt++;
      prev = o;
    }
    var altClosed = alt + (m > 1 && prev !== first ? 1 : 0);
    for (k = 0; k < fc.n; k++) w += over[k] ? fc.s1[k] : -fc.s1[k];
    for (k = 0; k < fc.big.length; k++) { var b = fc.big[k]; r2 += b[2] ^ (over[b[0]] ? 0 : 1) ^ (over[b[1]] ? 0 : 1); }
    return alt + '|' + altClosed + '|' + w + '|' + r2;
  }
  // Over/under for one outline: flags (all of them when 2^n ≤ 256, else random draws) until a knot
  // and an unknot of the wanted depth share a signature (alternations, writhe, visible slides).
  // → { knot: over[], unknot: over[], sig } or null. Draws the cheap route cannot settle are skipped.
  function matchedPair(rng, dg, depth, tries) {
    var n = dg.X.length, fc = shadowFacts(dg), seenK = {}, seenU = {}, order = null, a, i;
    if (n <= 8) { order = []; for (a = 0; a < (1 << n); a++) order.push(a); order = rng.shuffle(order); }
    var total = order ? order.length : tries;
    for (a = 0; a < total; a++) {
      var over = [];
      if (order) for (i = 0; i < n; i++) over.push(((order[a] >> i) & 1) === 1);
      else for (i = 0; i < n; i++) over.push(rng.next() < 0.5);
      var sig = fastSig(fc, over);
      if (seenK[sig] && seenU[sig]) continue;
      var g = withOver(dg, over), c = classify(g.D, { full: false }), knot = null;
      if (c) knot = c.knot;
      else if (depth > 0 && !seenU[sig]) {
        var s = simplify(g.D, 2);
        if (s.D.live === 0 && s.r3 > 0) knot = false; else continue;
      } else continue;
      if (knot === false && (c ? 0 : 1) !== depth) continue;
      if (knot) { if (!seenK[sig]) seenK[sig] = over; } else if (!seenU[sig]) seenU[sig] = over;
      if (seenK[sig] && seenU[sig]) return { knot: seenK[sig], unknot: seenU[sig], sig: sig };
    }
    return null;
  }

  /* ---------- pull: "Pull both ends: does a knot remain?" ---------- */

  var VARIANTS = ['pull', 'untie', 'tie', 'link'];
  var ANSWER = { pull: 'yesno', untie: 'choice', tie: 'choice', link: 'yesno' };
  // Variants share one rating; the harder formats sit higher on it (hand-set, refit from pooled
  // exports): one crossing's effect on the whole rope (untie, tie) and loops (link) are later skills.
  var V_OFFSET = { pull: 0, untie: 0.6, tie: 0.6, link: 1.0 };

  function norm(params) {
    params = params || {};
    function lv(k, count) { var v = params[k]; return Number.isInteger(v) && v >= 0 && v < count ? v : 0; }
    return { rope: lv('rope', RUNGS.length), spacing: lv('spacing', SPACING.length),
      variant: VARIANTS.indexOf(params.variant) >= 0 ? params.variant : VARIANTS[0] };
  }
  function itemBase(p) {
    var a = ANSWER[p.variant];
    return { ex: 'knots', v: 1, params: { rope: p.rope, spacing: p.spacing, variant: p.variant }, variant: p.variant,
      answer: a, nOptions: a === 'choice' ? 4 : 2, spacing: SPACING[p.spacing].name };
  }

  // One outline gives both a knot and an unknot with the same cheap features; a coin drawn from the
  // seed alone (not from the search) decides which one is shown, so no feature can tell them apart.
  function buildPull(rng, p) {
    var sp = SPACING[p.spacing], R = RUNGS[p.rope], knot = rng.fork('class').chance(0.5);
    for (var s = 0; s < 16; s++) {
      var dg = ropeShadow(rng, sp, R.n, false);
      if (!dg) continue;
      var pair = matchedPair(rng, dg, R.depth, 160);
      if (!pair) continue;
      var it = itemBase(p);
      it.n = R.n; it.depth = R.depth; it.pts = dg.pts; it.over = (knot ? pair.knot : pair.unknot).slice(); it.key = knot;
      return it;
    }
    return null;
  }

  /* ---------- untie / tie: "Which marked crossing, switched, unties (ties) it?" ---------- */

  // A crossing is nugatory when one face meets it at two opposite corners: switching it never
  // changes the rope, which a player sees at once, so it is never tagged (R2 §4.7).
  function nugatory(D) {
    var F = faces(D), fid = new Int32Array(4 * D.n), out = [], k, x;
    for (k = 0; k < F.length; k++) for (var j = 0; j < F[k].length; j++) fid[F[k][j]] = k;
    for (x = 0; x < D.n; x++) out.push(!!D.alive[x] && (fid[4 * x] === fid[4 * x + 2] || fid[4 * x + 1] === fid[4 * x + 3]));
    return out;
  }
  function knotKind(D) {
    var c = classify(D);
    return c.knot ? 'K' : c.proof === 'moves' ? 'U' : 'J';
  }
  // What a switch does to the cheap features: Δ alternations (open and closed), Δ visible slides,
  // whether the crossing sits in a twist (an alternating bigon). Options are drawn with equal values.
  function switchFeatures(dg, fc, over, c) {
    var b = fastSig(fc, over).split('|'), o2 = over.slice();
    o2[c] = !o2[c];
    var a = fastSig(fc, o2).split('|'), tw = 0;
    for (var k = 0; k < fc.big.length; k++) {
      var g = fc.big[k];
      if ((g[0] === c || g[1] === c) && (g[2] ^ (over[g[0]] ? 0 : 1) ^ (over[g[1]] ? 0 : 1)) === 0) tw = 1;
    }
    return [(a[3] - b[3] > 0 ? 1 : 0), tw, a[0] - b[0], a[1] - b[1], a[3] - b[3]];
  }
  function tagOrder(dg, tags) {
    return tags.slice().sort(function (u, v) { var A = dg.X[u], B = dg.X[v]; return A.y - B.y || A.x - B.x; });
  }
  function farApart(dg, tags) {
    for (var i = 0; i < tags.length; i++) {
      for (var j = i + 1; j < tags.length; j++) {
        var A = dg.X[tags[i]], B = dg.X[tags[j]], dx = A.x - B.x, dy = A.y - B.y;
        if (dx * dx + dy * dy < TAG_GAP * TAG_GAP) return false;
      }
    }
    return true;
  }
  // Untie and tie need four crossings that matter, exactly one of which changes the rope: below 7
  // crossings such ropes are rare (measured), so these variants start at 7.
  function switchN(rope) { return Math.max(7, RUNGS[rope].n); }
  function buildSwitch(rng, p) {
    var sp = SPACING[p.spacing], N = switchN(p.rope), tie = p.variant === 'tie';
    var cue = rng.fork('tags'), want = { side: cue.int(0, 1), fine: cue.int(0, 1), wd: cue.int(0, 3), wo: cue.int(0, 3) }, tries = 0;
    for (var s = 0; s < 24; s++) {
      var dg = ropeShadow(rng, sp, N, false);
      if (!dg) continue;
      var nug = nugatory(dg.D), free = [], x;
      for (x = 0; x < N; x++) if (!nug[x]) free.push(x);
      if (free.length < 4) continue;                // nugatory crossings depend on the outline only
      var fc = shadowFacts(dg);
      for (var a = 0; a < 24; a++) {
        var over = [], i;
        for (i = 0; i < N; i++) over.push(rng.next() < 0.5);
        var g = withOver(dg, over), base = knotKind(g.D);
        if (tie ? base !== 'U' : base !== 'K') continue;
        if (++tries > 140) want.side = -1;           // a long search: take either half
        // the key's rank among the four by distance from the centre and by the length of the strand
        // that passes over it is drawn from the seed (each rank 1 in 4). Options nearest those ranks
        // are tried first; a rope whose best option misses them is kept only by a draw that gets
        // less likely the further it misses (always, after a long search), so "the most central"
        // and "the shortest over-strand" score near chance (tested per rung)
        var opts = tagOptions(dg, g.D, fc, over, free, want);
        if (!opts.length) continue;
        opts = rng.shuffle(opts);
        var cost = function (o) { return (o.rd < 0 ? 4 : Math.abs(o.rd - want.wd)) + (o.ro < 0 ? 4 : Math.abs(o.ro - want.wo)); };
        opts.forEach(function (o) { o.cost = cost(o); });
        opts.sort(function (u, v) { return u.cost - v.cost; });
        var memo = {};
        var kindOf = function (c) { if (memo[c] === undefined) memo[c] = knotKind(switched(g.D, c)); return memo[c]; };
        for (var k = 0; k < opts.length && k < 200; k++) {
          var t = opts[k].t, ok = tie ? kindOf(t[0]) === 'K' : kindOf(t[0]) === 'U';
          for (var j = 1; j < 4 && ok; j++) ok = kindOf(t[j]) === (tie ? 'U' : 'K');
          if (!ok) continue;
          if (opts[k].cost > 0 && tries <= 60 && rng.next() >= Math.pow(0.3, opts[k].cost)) break;
          var it = itemBase(p);
          it.n = N; it.depth = RUNGS[p.rope].depth; it.pts = dg.pts; it.over = over;
          // letters A–D in an order drawn from the seed, so the key's letter tells nothing
          it.tags = cue.shuffle(t); it.options = it.tags.slice(); it.key = it.tags.indexOf(t[0]);
          return it;
        }
      }
    }
    return null;
  }
  // Candidate tag sets [key, other, other, other] from cheap features only (no knot is classified
  // here): one (slide-off, twist) group, ≥ 44 px apart, the changes in alternations and the
  // handedness of the four in a pattern where no option stands out by count (all equal, two pairs,
  // or (alternations only) all different), the key's place in the alternation pattern in the
  // wanted half and rank (R2 §7.4: "the odd one out", "most like the others", "the biggest change"
  // and "the most central" then score at chance). rd: the key's rank by distance from the centre.
  function pattern(v) {
    var c = {}, i, keys;
    for (i = 0; i < 4; i++) c[v[i]] = (c[v[i]] || 0) + 1;
    keys = Object.keys(c);
    if (keys.length === 1) return 'all';
    if (keys.length === 4) return 'distinct';
    if (keys.length === 2 && c[keys[0]] === 2) return 'pairs';
    return null;
  }
  // The length of the strand that passes over each crossing (the stretch of rope between the
  // passages underneath before and after it; the rope's ends where there is none).
  function overLengths(dg, over) {
    var ar = dg.arc || (dg.arc = arcLengths(dg.S[0])), cp = dg.comps[0], out = {}, i, j;
    var isOver = function (p) { return p.first ? !!over[p.c] : !over[p.c]; }, at = function (p) { return ar.a[Math.floor(p.t)]; };
    for (i = 0; i < cp.length; i++) {
      if (!isOver(cp[i])) continue;
      var lo = 0, hi = ar.total;
      for (j = i - 1; j >= 0; j--) if (!isOver(cp[j])) { lo = at(cp[j]); break; }
      for (j = i + 1; j < cp.length; j++) if (!isOver(cp[j])) { hi = at(cp[j]); break; }
      out[cp[i].c] = hi - lo;
    }
    return out;
  }
  function tagOptions(dg, D, fc, over, free, want) {
    var F = {}, out = [], i, a, b, c, d, j, OL = overLengths(dg, over);
    for (i = 0; i < free.length; i++) {
      var x = free[i], f = switchFeatures(dg, fc, over, x), X = dg.X[x];
      F[x] = { g: f[0] + '|' + f[1], alt: f[2], r2: f[4], s: sgn(D, x), r: (X.x - PLATE / 2) * (X.x - PLATE / 2) + (X.y - PLATE / 2) * (X.y - PLATE / 2), o: OL[x] };
    }
    var L = free;
    for (a = 0; a < L.length; a++) for (b = a + 1; b < L.length; b++) {
      if (F[L[a]].g !== F[L[b]].g) continue;
      for (c = b + 1; c < L.length; c++) {
        if (F[L[c]].g !== F[L[a]].g) continue;
        for (d = c + 1; d < L.length; d++) {
          if (F[L[d]].g !== F[L[a]].g) continue;
          var q = [L[a], L[b], L[c], L[d]], va = q.map(function (y) { return F[y].alt; }), vs = q.map(function (y) { return F[y].s; });
          var pa = pattern(va), ps = pattern(vs);
          if (!pa || !ps || ps === 'distinct' || !farApart(dg, q)) continue;
          for (i = 0; i < 4; i++) {
            var below = 0;
            for (j = 0; j < 4; j++) if (j !== i && va[j] < va[i]) below++;
            var half = pa === 'all' ? -1 : pa === 'pairs' ? (below ? 1 : 0) : (below >= 2 ? 1 : 0);
            if (want.side >= 0 && half >= 0 && (half !== want.side || (pa === 'distinct' && (below & 1) !== want.fine))) continue;
            // a long search takes either half, but the key is still never the one extreme value
            if (want.side < 0 && pa === 'distinct' && (below === 0 || below === 3)) continue;
            // nor the one switch that adds (or removes) the most visible slides
            var hi2 = 0, lo2 = 0;
            for (j = 0; j < 4; j++) if (j !== i) { if (F[q[j]].r2 < F[q[i]].r2) hi2++; if (F[q[j]].r2 > F[q[i]].r2) lo2++; }
            if (hi2 === 3 || lo2 === 3) continue;
            // rd, ro: the key's rank by distance from the centre and by over-strand length (−1 when it
            // ties with another option: then no rank is held)
            var t = [q[i]].concat(q.filter(function (y, m) { return m !== i; })), rd = 0, ro = 0;
            for (j = 1; j < 4; j++) {
              if (F[t[j]].r < F[t[0]].r) rd++;
              if (F[t[j]].o < F[t[0]].o) ro++;
              if (F[t[j]].r === F[t[0]].r) rd = -9;
              if (Math.abs(F[t[j]].o - F[t[0]].o) < 0.5) ro = -9;
            }
            out.push({ t: t, rd: rd < 0 ? -1 : rd, ro: ro < 0 ? -1 : ro });
          }
        }
      }
    }
    return out;
  }

  /* ---------- generate, fallback ---------- */

  function buildItem(rng, p) {
    if (p.variant === 'pull') return buildPull(rng, p);
    if (p.variant === 'untie' || p.variant === 'tie') return buildSwitch(rng, p);
    return buildLink(rng, p);
  }
  // Never throws: up to 8 forked attempts (each searches many outlines), then a fixed-seed search
  // that the node tests run for every params combination.
  function generate(rng, params) {
    var p = norm(params), item, i;
    for (i = 0; i < 8; i++) {
      try { item = buildItem(i === 0 ? rng : rng.fork('retry' + i), p); } catch (e) { item = null; }
      if (item && validate(item) === true) { item.seed = rng.seed; return item; }
    }
    item = fallback(p);
    item.seed = rng.seed;
    return item;
  }
  var FALLBACKS = {};
  function fallback(p) {
    var key = p.rope + ',' + p.spacing + ',' + p.variant;
    if (FALLBACKS[key]) return JSON.parse(FALLBACKS[key]);
    var r0 = PX.rng(PX.rng.hash('knots-fallback', p.rope, p.spacing, p.variant)), last = null;
    for (var i = 0; i < 60; i++) {
      var it = null;
      try { it = buildItem(r0.fork('fb' + i), p); } catch (e) { it = null; }
      if (!it) continue;
      last = it;
      if (validate(it) === true) { it.fallback = true; FALLBACKS[key] = JSON.stringify(it); return it; }
    }
    if (!last) { last = itemBase(p); last.key = p.variant === 'untie' || p.variant === 'tie' ? 0 : false; }
    last.fallback = 'unvalidated'; // unreachable in the tested params range
    return last;
  }

  /* ---------- link: "Are these loops linked?" ---------- */

  function loopPoints(w, sp, L) {
    var p = sp.pitch, m = Math.floor((PLATE - (L - 1) * p) / 2);
    return w.path.map(function (c) { var i = c % L, j = (c - i) / L; return [m + i * p, m + j * p]; });
  }

  // How many crossings a link item has, and how many of them join the two loops (an even number).
  // Measured: with four crossings between the loops a linked and an unlinked picture with the same
  // counts exist for under a third of outlines; with six for nine in ten; eight rarely fit the close
  // lattice; and without at least two crossings of loop B with itself no pair exists. So the loops
  // cross six times and loop B crosses itself 2–5 times (8–11 crossings).
  var LINK_RUNGS = [
    { n: 8, inter: 6 }, { n: 8, inter: 6 }, { n: 8, inter: 6 }, { n: 8, inter: 6 }, { n: 9, inter: 6 },
    { n: 9, inter: 6 }, { n: 10, inter: 6 }, { n: 10, inter: 6 }, { n: 11, inter: 6 }, { n: 11, inter: 6 },
  ];
  // Loop A is a ring: the outline of a rectangle at least 3 cells wide (rounded by the spline), so
  // that loop B can cross every straight side; B weaves through it and over or under itself.
  function ringLoop(rng, L, st) {
    var w = rng.int(3, L - 3), h = rng.int(3, L - 3), x0 = rng.int(1, L - 2 - w), y0 = rng.int(1, L - 2 - h), path = [], i;
    for (i = 0; i < w; i++) path.push(x0 + i + y0 * L);
    for (i = 0; i < h; i++) path.push(x0 + w + (y0 + i) * L);
    for (i = 0; i < w; i++) path.push(x0 + w - i + (y0 + h) * L);
    for (i = 0; i < h; i++) path.push(x0 + (y0 + h - i) * L);
    var shift = rng.int(0, path.length - 1);
    path = path.slice(shift).concat(path.slice(0, shift));
    for (i = 0; i < path.length; i++) {
      var c = path[i], pv = path[(i + path.length - 1) % path.length], nx = path[(i + 1) % path.length];
      st.vis[c] = 1; st.owner[c] = 0;
      st.axis[c] = (pv % L === nx % L) ? 2 : ((pv - pv % L) === (nx - nx % L) ? 1 : 3);
      var a = c, b = nx, lo = Math.min(a, b);
      st.used[Math.abs(a - b) === 1 ? lo * 2 : lo * 2 + 1] = 1;
    }
    return { path: path, cross: [] };
  }
  // Two loops for spacing level sp → the diagram (all flags true) with .loops = [ptsA, ptsB], or null.
  function linkShadow(rng, sp, LR) {
    var L = sp.L, NN = L * L;
    for (var t = 0; t < 30; t++) {
      var st = { vis: new Uint8Array(NN), axis: new Uint8Array(NN), used: new Uint8Array(NN * 2), owner: new Int8Array(NN).fill(-1) };
      var A = ringLoop(rng, L, st);
      var B = walk(rng, L, st, 1, { open: false, self: LR.n - LR.inter, inter: LR.inter, minLen: 10 }, { sep: sp.sep });
      if (!B) continue;
      var loops = [loopPoints(A, sp, L), loopPoints(B, sp, L)], over = [];
      for (var i = 0; i < LR.n; i++) over.push(true);
      var dg = diagramOf([{ pts: loops[0], closed: true }, { pts: loops[1], closed: true }], over);
      if (typeof dg === 'string') continue;
      dg.loops = loops;
      return dg;
    }
    return null;
  }
  // A two-loop diagram's kind: 'U' unlinked (moves leave no crossing between the loops: they come
  // apart), 'L' linked (linking number ≠ 0, or a Jones polynomial unlike the unlink's while each
  // loop is unknotted, so the loops cannot be separated), or null (a loop is knotted, or nothing
  // settles it). "Unlinked" is never taken from an invariant (R2 §4.4: some links share the
  // unlink's Jones polynomial).
  function linkKind(D, noJones) {
    for (var k = 0; k < 2; k++) {
      var C = component(D, k);
      if (C.live > 0) { var c = classify(C); if (c.knot || c.proof !== 'moves') return null; }
    }
    var lk = linking(D);
    if (lk !== 0) return { kind: 'L', lk: lk };
    var s = simplify(D, 2);
    if (interCount(s.D) === 0) return { kind: 'U', moves: s.moves };
    if (!noJones && D.live <= 16 && !peq(jones(D), V_UNLINK2)) return { kind: 'L', lk: 0 };
    return null;
  }
  // Cheap counts of a two-loop picture for matching: crossings where A is on top, over-under
  // changes around each loop, writhe, and loops lying on top (visible slides).
  function linkFacts(dg) {
    var fc = shadowFacts({ X: dg.X, D: dg.D, comps: [[]] });
    fc.inter = dg.X.map(function (x) { return x.a[0] !== x.b[0]; });
    fc.P2 = dg.comps.map(function (cp) { return cp.map(function (p) { return [p.c, p.first ? 1 : 0]; }); });
    return fc;
  }
  function linkSig(fc, over) {
    var a = 0, w = 0, r2 = 0, alts = [], k, j;
    for (k = 0; k < fc.n; k++) { if (fc.inter[k] && over[k]) a++; w += over[k] ? fc.s1[k] : -fc.s1[k]; }
    for (j = 0; j < fc.P2.length; j++) {
      var P = fc.P2[j], m = P.length, alt = 0, prev = -1, first = -1;
      for (k = 0; k < m; k++) {
        var o = over[P[k][0]] ? P[k][1] : 1 - P[k][1];
        if (k === 0) first = o; else if (o !== prev) alt++;
        prev = o;
      }
      alts.push(alt + (m > 1 && prev !== first ? 1 : 0));
    }
    for (k = 0; k < fc.big.length; k++) { var b = fc.big[k]; r2 += b[2] ^ (over[b[0]] ? 0 : 1) ^ (over[b[1]] ? 0 : 1); }
    return { a: a, key: a + '|' + alts.join(',') + '|' + w + '|' + r2 };
  }
  // A linked and an unlinked assignment of one outline with the same counts (so the A-over-B
  // count is even and the parity rule, lk ≡ that count mod 2, scores at chance; R2 §3.3).
  function linkPair(rng, dg, tries) {
    var fc = linkFacts(dg), n = dg.X.length, c = fc.inter.filter(Boolean).length, seenL = {}, seenU = {}, order = null, t, i, jonesLeft = 6;
    if (n <= 8) { order = []; for (t = 0; t < (1 << n); t++) order.push(t); order = rng.shuffle(order); }
    var total = order ? order.length : tries;
    for (t = 0; t < total; t++) {
      var over = [];
      if (order) for (i = 0; i < n; i++) over.push(((order[t] >> i) & 1) === 1);
      else for (i = 0; i < n; i++) over.push(rng.next() < 0.5);
      var sg = linkSig(fc, over);
      if (sg.a === 0 || sg.a === c || (sg.a & 1) || (seenL[sg.key] && seenU[sg.key])) continue;
      var g = withOver(dg, over), lk = linkKind(g.D, jonesLeft <= 0);
      if (!lk) { jonesLeft--; continue; }
      if (lk.kind === 'L') { if (!seenL[sg.key]) seenL[sg.key] = over; } else if (!seenU[sg.key]) seenU[sg.key] = over;
      if (seenL[sg.key] && seenU[sg.key]) return { linked: seenL[sg.key], unlinked: seenU[sg.key] };
    }
    return null;
  }
  function buildLink(rng, p) {
    var sp = SPACING[p.spacing], LR = LINK_RUNGS[p.rope], linked = rng.fork('class').chance(0.5);
    for (var s = 0; s < 12; s++) {
      var dg = linkShadow(rng, sp, LR);
      if (!dg) continue;
      var pair = linkPair(rng, dg, 200);
      if (!pair) continue;
      var it = itemBase(p);
      it.n = LR.n; it.inter = LR.inter; it.loops = dg.loops; it.over = (linked ? pair.linked : pair.unlinked).slice(); it.key = linked;
      return it;
    }
    return null;
  }
  function checkLink(item) {
    var p = item.params, LR = LINK_RUNGS[p.rope], sp = SPACING[p.spacing];
    if (!Array.isArray(item.loops) || item.loops.length !== 2 || !intPts(item.loops[0], true) || !intPts(item.loops[1], true)) return 'a link item needs two loops of integer control points';
    if (item.n !== LR.n || item.inter !== LR.inter || !flags(item.over, LR.n)) return 'n, inter or the flags do not match the rope level';
    var dg = diagramOf([{ pts: item.loops[0], closed: true }, { pts: item.loops[1], closed: true }], item.over);
    if (typeof dg === 'string') return dg;
    var inter = 0, a = 0, k;
    for (k = 0; k < dg.X.length; k++) if (dg.X[k].a[0] !== dg.X[k].b[0]) { inter++; if (item.over[k]) a++; }
    if (inter !== LR.inter) return 'the loops cross each other ' + inter + ' times, the level asks ' + LR.inter;
    if (a === 0 || a === inter) return 'one loop lies wholly on top (that tells the answer at a glance)';
    var L = legible(dg, { gap: sp.gap, open: false });
    if (typeof L === 'string') return L;
    var lk = linkKind(dg.D);
    if (!lk) return 'the loops are not settled (a loop is knotted, or no proof)';
    if (typeof item.key !== 'boolean' || item.key !== (lk.kind === 'L')) return 'the key is not what the loops are';
    return true;
  }

  /* =====================================================================================
     6. SHOW ME: the validator's simplifier replayed on the drawn rope. A frame is a set of
        polylines with a height per point (+1 / −1 near each crossing from the item's flags; a
        moving top strand rises to +2). Each step derives the crossings and their over/under from
        the frame, takes the simplifier's next move on that diagram (curl, loop on top, slide-over:
        the same rule the validator used), and makes it a local edit of the polylines:
          R1  the curl shrinks into its crossing;
          R2  the arc on top slides across the bigon to just past the other strand;
          R3  the strand on top re-routes around the opposite crossing, along the other two strands.
        Replay results are checked in the node tests (each frame's crossings, the end state).
     ===================================================================================== */

  var LIFT = 12;                                  // px: a moved arc runs this far from the strand it passed

  function polyOf(cv, over, X, comp) {
    var s = sampleCurve(cv), P = { x: Array.prototype.slice.call(s.x), y: Array.prototype.slice.call(s.y), z: [], closed: s.closed };
    for (var i = 0; i < s.m; i++) P.z.push(0);
    var ar = arcLengths(s).a;
    for (var c = 0; c < X.length; c++) {
      var hits = [[X[c].a[0], X[c].sa, over[c] ? 1 : -1], [X[c].b[0], X[c].sb, over[c] ? -1 : 1]];
      for (var h = 0; h < 2; h++) {
        if (hits[h][0] !== comp) continue;
        for (var j = 0; j < s.m; j++) {
          var d = Math.abs(ar[j] - ar[hits[h][1]]);
          if (s.closed) d = Math.min(d, ar[s.m - 1] - d);
          if (d <= 16) P.z[j] = hits[h][2];
        }
      }
    }
    return P;
  }
  // Crossings of polylines with heights → { list: [{ a: [poly, t], b, sa, sb, x, y, za, zb }], D }.
  function polyCrossings(polys) {
    var S = polys.map(function (P) {
      var m = P.x.length, t = [];
      for (var i = 0; i < m; i++) t.push(i);
      return { x: P.x, y: P.y, t: t, m: m, closed: P.closed };
    });
    var segs = [], k, j, out = [];
    for (k = 0; k < S.length; k++) for (j = 0; j < (S[k].closed ? S[k].m : S[k].m - 1); j++) segs.push([k, j, (j + 1) % S[k].m]);
    var grid = {};
    for (var q = 0; q < segs.length; q++) {
      var sg = segs[q], A = S[sg[0]];
      var x0 = Math.floor(Math.min(A.x[sg[1]], A.x[sg[2]]) / 16), x1 = Math.floor(Math.max(A.x[sg[1]], A.x[sg[2]]) / 16);
      var y0 = Math.floor(Math.min(A.y[sg[1]], A.y[sg[2]]) / 16), y1 = Math.floor(Math.max(A.y[sg[1]], A.y[sg[2]]) / 16);
      for (var cx = x0; cx <= x1; cx++) for (var cy = y0; cy <= y1; cy++) (grid[cx + ',' + cy] = grid[cx + ',' + cy] || []).push(q);
    }
    for (var key in grid) {
      var L = grid[key], g = key.split(',');
      for (var u = 0; u < L.length; u++) {
        for (var v = u + 1; v < L.length; v++) {
          var p1 = segs[L[u]], p2 = segs[L[v]];
          if (p1[0] === p2[0]) {
            var dd = Math.abs(p1[1] - p2[1]);
            if (dd <= 1 || (S[p1[0]].closed && dd >= S[p1[0]].m - 1)) continue;
          }
          var hit = polyHit(S, p1, p2);
          if (!hit || Math.floor(hit.x / 16) !== +g[0] || Math.floor(hit.y / 16) !== +g[1]) continue;
          var Pa = polys[hit.a[0]], Pb = polys[hit.b[0]];
          hit.za = Pa.z[hit.sa] + (Pa.z[(hit.sa + 1) % Pa.z.length] - Pa.z[hit.sa]) * hit.fa;
          hit.zb = Pb.z[hit.sb] + (Pb.z[(hit.sb + 1) % Pb.z.length] - Pb.z[hit.sb]) * hit.fb;
          out.push(hit);
        }
      }
    }
    out.sort(function (a, b) { return a.a[0] - b.a[0] || a.a[1] - b.a[1]; });
    var comps = polys.map(function () { return []; });
    out.forEach(function (x, c) {
      comps[x.a[0]].push({ c: c, t: x.a[1], over: x.za > x.zb, dir: x.da, first: true });
      comps[x.b[0]].push({ c: c, t: x.b[1], over: x.zb > x.za, dir: x.db, first: false });
    });
    comps.forEach(function (cp) { cp.sort(function (p, q2) { return p.t - q2.t; }); });
    return { list: out, comps: comps, D: fromPassages(comps, out.length, polys.map(function (P) { return !P.closed; })) };
  }
  function polyHit(S, p1, p2) {
    var A = S[p1[0]], B = S[p2[0]];
    var ax = A.x[p1[1]], ay = A.y[p1[1]], rx = A.x[p1[2]] - ax, ry = A.y[p1[2]] - ay;
    var bx = B.x[p2[1]], by = B.y[p2[1]], sx = B.x[p2[2]] - bx, sy = B.y[p2[2]] - by;
    var den = rx * sy - ry * sx;
    if (den === 0) return null;
    var qx = bx - ax, qy = by - ay, s = (qx * sy - qy * sx) / den, w = (qx * ry - qy * rx) / den;
    if (s < 0 || s >= 1 || w < 0 || w >= 1) return null;
    var lr = Math.sqrt(rx * rx + ry * ry), ls = Math.sqrt(sx * sx + sy * sy);
    var ha = { c: p1[0], t: p1[1] + s, seg: p1[1], f: s, d: [rx / lr, -ry / lr] }, hb = { c: p2[0], t: p2[1] + w, seg: p2[1], f: w, d: [sx / ls, -sy / ls] };
    var first = ha.c < hb.c || (ha.c === hb.c && ha.t < hb.t), a = first ? ha : hb, b = first ? hb : ha;
    return { a: [a.c, a.t], b: [b.c, b.t], sa: a.seg, sb: b.seg, fa: a.f, fb: b.f, x: ax + s * rx, y: ay + s * ry, da: a.d, db: b.d };
  }

  /* ---------- the three moves as edits of one polyline ---------- */

  // The passages on poly k: [{ c, t }] sorted by t.
  function passagesOn(pc, k) {
    var out = [];
    pc.list.forEach(function (x, c) { if (x.a[0] === k) out.push({ c: c, t: x.a[1] }); if (x.b[0] === k) out.push({ c: c, t: x.b[1] }); });
    return out.sort(function (p, q) { return p.t - q.t; });
  }
  // The points of poly k strictly between passages at tA and tB along the strand, in travel order
  // from A to B, taking the side with no other passage (open ropes have one side only).
  function strandArc(polys, pc, k, tA, tB) {
    var P = polys[k], m = P.x.length, ps = passagesOn(pc, k), i, out;
    function inside(lo, hi) { return ps.some(function (p) { return p.t > lo + 1e-9 && p.t < hi - 1e-9; }); }
    if (!P.closed) {
      var lo = Math.min(tA, tB), hi = Math.max(tA, tB);
      if (inside(lo, hi)) return null;
      out = [];
      for (i = Math.floor(lo) + 1; i <= Math.floor(hi); i++) out.push(i);
      return { idx: tA <= tB ? out : out.reverse(), forward: tA <= tB };
    }
    // closed: forward from A to B (wrapping) or backward
    function fwd(a, b) { var r = []; for (i = Math.floor(a) + 1; ; i++) { var kk = i % m; if (cyc(a, kk, b, m) || (kk === Math.floor(b) % m && b - Math.floor(b) > 0 && cyc(a, kk, b + 1e-9, m))) r.push(kk); else break; if (r.length > m) break; } return r; }
    function clear(a, b) { return !ps.some(function (p) { return p.t !== a && p.t !== b && cyc(a, p.t, b, m) && Math.abs(p.t - b) > 1e-9; }); }
    if (clear(tA, tB)) return { idx: fwd(tA, tB), forward: true };
    if (clear(tB, tA)) return { idx: fwd(tB, tA).reverse(), forward: false };
    return null;
  }
  function cycT(a, t, b, m) { var x = (t - a + m) % m, y = (b - a + m) % m; return x > 0 && x < y; }
  // An edit replacing the run idx (in travel order, contiguous along the poly, possibly wrapping
  // on a loop) of poly k by pts ([[x, y, z]…] in the same travel direction).
  function runEdit(polys, k, idx, pts) {
    var P = polys[k], m = P.x.length, first = idx[0], last = idx[idx.length - 1];
    if (!P.closed || last >= first) return { poly: k, rot: 0, from: first, to: last, path: pts };
    return { poly: k, rot: first, from: 0, to: (last - first + m) % m, path: pts };
  }
  function overPassage(x) { return x.za > x.zb ? { k: x.a[0], t: x.a[1] } : { k: x.b[0], t: x.b[1] }; }
  function underPassage(x) { return x.za > x.zb ? { k: x.b[0], t: x.b[1] } : { k: x.a[0], t: x.a[1] }; }
  // Grows a run of indices at each end until its end points are ≥ LIFT + 6 px from the crossings
  // A and B where it starts and ends (at most 10 points), so that a new route never doubles back.
  // ...but never over another crossing's passage (lifting a run through a crossing where it lies
  // underneath would pass it through that strand). stops: t values of the other passages on P.
  function widen(P, idx, A, B, forward, stops) {
    var m = P.x.length, out = idx.slice(), step = forward ? 1 : -1, i, need = (LIFT + 6) * (LIFT + 6);
    function far(k, X) { var dx = P.x[k] - X.x, dy = P.y[k] - X.y; return dx * dx + dy * dy >= need; }
    function blocked(k) {
      for (var s = 0; s < (stops || []).length; s++) {
        var d = Math.abs(stops[s] - k);
        if (P.closed) d = Math.min(d, m - d);
        if (d < 2) return true;
      }
      return false;
    }
    for (i = 0; i < 10; i++) {
      var a = out[0] - step;
      if (P.closed) a = (a + m) % m;
      if (a < 0 || a >= m || out.indexOf(a) >= 0 || blocked(a)) break;
      out.unshift(a);
      if (far(a, A)) break;
    }
    for (i = 0; i < 10; i++) {
      var b = out[out.length - 1] + step;
      if (P.closed) b = (b + m) % m;
      if (b < 0 || b >= m || out.indexOf(b) >= 0 || blocked(b)) break;
      out.push(b);
      if (far(b, B)) break;
    }
    return out;
  }
  // The point of P just before the passage at t, travelling forward (or backward) along P.
  function before(P, t, forward) { var m = P.x.length, i = forward ? Math.floor(t) : Math.floor(t) + 1; return P.closed ? (i + m) % m : Math.max(0, Math.min(m - 1, i)); }
  // The other passages on poly k (not those of crossings cs).
  function stopsOn(pc, k, cs) {
    return passagesOn(pc, k).filter(function (p) { return cs.indexOf(p.c) < 0; }).map(function (p) { return p.t; });
  }
  // Points of an arc (with optional end points) offset at height z to the side of the arc where
  // `ref` lies (judged at the arc's first or last point), as far as LIFT but never more than 45 %
  // of the free room on that side (rays to the nearest other strand), so a new route runs in the
  // middle of its corridor. skip: { poly, lo, hi } indices of the moving strand not to count.
  // Loops the offset makes at tight bends are cut out.
  function offsetSide(polys, k, idx, ref, ends, z, skip) {
    var P = polys[k], xs = [], ys = [], own = {}, i;
    if (ends && ends[0]) { xs.push(ends[0][0]); ys.push(ends[0][1]); }
    for (i = 0; i < idx.length; i++) { xs.push(P.x[idx[i]]); ys.push(P.y[idx[i]]); own[idx[i]] = 1; }
    if (ends && ends[1]) { xs.push(ends[1][0]); ys.push(ends[1][1]); }
    var N = normals(xs, ys), j0 = ref[2] === 'end' ? xs.length - 1 : 0;
    var side = ((ref[0] - xs[j0]) * N[j0][0] + (ref[1] - ys[j0]) * N[j0][1]) > 0 ? 1 : -1;
    var room = Infinity;
    for (var j = 0; j < xs.length; j += 2) room = Math.min(room, rayRoom(polys, xs[j], ys[j], side * N[j][0], side * N[j][1], k, idx, skip));
    var d = Math.max(3, Math.min(LIFT, 0.45 * room)), out = untangle(xs.map(function (x, q) { return [x + side * d * N[q][0], ys[q] + side * d * N[q][1], z]; }));
    out.d = d;
    return out;
  }
  // Distance along the ray (x, y) + λ (nx, ny) to the first strand it meets, ignoring the arc
  // itself (and its neighbours) and the moving strand's run.
  function rayRoom(polys, x, y, nx, ny, k, idx, skip) {
    var best = 60, lo = idx.length ? Math.min.apply(null, idx) - 3 : -1, hi = idx.length ? Math.max.apply(null, idx) + 3 : -1;
    for (var p = 0; p < polys.length; p++) {
      var Q = polys[p], m = Q.x.length, nSeg = Q.closed ? m : m - 1;
      for (var i = 0; i < nSeg; i++) {
        if (p === k && i >= lo && i <= hi) continue;
        if (skip && p === skip.poly && i >= skip.lo - 1 && i <= skip.hi + 1) continue;
        var ax = Q.x[i], ay = Q.y[i], bx = Q.x[(i + 1) % m], by = Q.y[(i + 1) % m];
        var sx = bx - ax, sy = by - ay, den = nx * sy - ny * sx;
        if (den === 0) continue;
        var qx = ax - x, qy = ay - y, lam = (qx * sy - qy * sx) / den, w = (qx * ny - qy * nx) / den;
        if (lam > 0.5 && lam < best && w >= 0 && w <= 1) best = lam;
      }
    }
    return best;
  }
  function untangle(pts) {
    for (var pass = 0; pass < 20; pass++) {
      var cut = null;
      for (var i = 0; i + 1 < pts.length && !cut; i++) {
        for (var j = i + 2; j + 1 < pts.length && !cut; j++) {
          var a = pts[i], b = pts[i + 1], c = pts[j], d = pts[j + 1];
          var rx = b[0] - a[0], ry = b[1] - a[1], sx = d[0] - c[0], sy = d[1] - c[1], den = rx * sy - ry * sx;
          if (den === 0) continue;
          var qx = c[0] - a[0], qy = c[1] - a[1], s = (qx * sy - qy * sx) / den, w = (qx * ry - qy * rx) / den;
          if (s > 0 && s < 1 && w > 0 && w < 1) cut = [i, j, [a[0] + s * rx, a[1] + s * ry, a[2]]];
        }
      }
      if (!cut) return pts;
      pts = pts.slice(0, cut[0] + 1).concat([cut[2]], pts.slice(cut[1] + 1));
    }
    return pts;
  }
  function pathLength(pts) {
    var L = 0;
    for (var i = 1; i < pts.length; i++) L += Math.sqrt((pts[i][0] - pts[i - 1][0]) * (pts[i][0] - pts[i - 1][0]) + (pts[i][1] - pts[i - 1][1]) * (pts[i][1] - pts[i - 1][1]));
    return L;
  }
  function centroidOf(P, idx) {
    var sx = 0, sy = 0;
    idx.forEach(function (i) { sx += P.x[i]; sy += P.y[i]; });
    return [sx / Math.max(1, idx.length), sy / Math.max(1, idx.length)];
  }

  // R1: the curl (the points between the two passages of its crossing) goes, and the rope runs
  // straight through the crossing point.
  function editR1(polys, pc, c) {
    var X = pc.list[c];
    if (X.a[0] !== X.b[0]) return null;
    var arc = strandArc(polys, pc, X.a[0], X.a[1], X.b[1]);
    if (!arc || !arc.idx.length) return null;
    var pts = [[X.x, X.y, 0]];
    return arc.forward ? runEdit(polys, X.a[0], arc.idx, pts) : runEdit(polys, X.a[0], arc.idx.slice().reverse(), pts);
  }
  // R2: the arc on top lifts across the bigon past the other strand (or the bottom arc drops
  // under it): the shorter new route first (all: both routes, shortest first).
  function editR2(polys, pc, c1, c2, zr, all) {
    var X1 = pc.list[c1], X2 = pc.list[c2], found = [];
    [[overPassage, underPassage, zr[1] + 1], [underPassage, overPassage, zr[0] - 1]].forEach(function (role) {
      var m1 = role[0](X1), m2 = role[0](X2), s1 = role[1](X1), s2 = role[1](X2);
      if (m1.k !== m2.k || s1.k !== s2.k) return;
      var mov = strandArc(polys, pc, m1.k, m1.t, m2.t), stay = strandArc(polys, pc, s1.k, s1.t, s2.t);
      if (!mov || !stay) return;
      var P = polys[m1.k], S = polys[s1.k];
      var run = widen(P, mov.idx.length ? mov.idx : [Math.floor(mov.forward ? m1.t : m2.t) + 1], X1, X2, mov.forward, stopsOn(pc, m1.k, [c1, c2]));
      // the moving strand's last point before it enters the bigon at X1 lies on the far side
      var h = before(P, m1.t, mov.forward), path = offsetSide(polys, s1.k, stay.idx, [P.x[h], P.y[h]], [[X1.x, X1.y], [X2.x, X2.y]], role[2], { poly: m1.k, lo: Math.min(run[0], run[run.length - 1]), hi: Math.max(run[0], run[run.length - 1]) });
      if (!mov.forward) { run = run.slice().reverse(); path = path.slice().reverse(); }
      found.push({ len: pathLength(path), e: runEdit(polys, m1.k, run, path) });
    });
    found.sort(function (a, b) { return a.len - b.len; });
    return all ? found.map(function (x) { return x.e; }) : found.length ? found[0].e : null;
  }
  // R3: the strand on top (or the one underneath) re-routes around the opposite crossing, along
  // the far sides of the other two strands; whichever new route is shorter.
  function editR3(polys, pc, f, zr, all) {
    var st = triStrands(f), out = [];
    for (var i = 0; i < 3; i++) {
      var odd = (st[i][0] & 1) + (st[i][1] & 1);
      if (odd !== 0 && odd !== 2) continue;
      var top = odd === 2, e = r3Route(polys, pc, f, st[i], top ? overPassage : underPassage, top ? underPassage : overPassage, top ? zr[1] + 1 : zr[0] - 1);
      if (e) out.push(e);
    }
    out.sort(function (a, b) { return a.len - b.len; });
    return all ? out.map(function (x) { return x.e; }) : out.length ? out[0].e : null;
  }
  function r3Route(polys, pc, f, strand, mine, other, z) {
    var cP = strand[0] >> 2, cQ = strand[1] >> 2, cR = [f[0] >> 2, f[1] >> 2, f[2] >> 2].filter(function (x) { return x !== cP && x !== cQ; })[0];
    var XP = pc.list[cP], XQ = pc.list[cQ], XR = pc.list[cR], oP = mine(XP), oQ = mine(XQ);
    if (oP.k !== oQ.k) return null;
    var arc = strandArc(polys, pc, oP.k, oP.t, oQ.t);
    if (!arc) return null;
    var uP = other(XP), vQ = other(XQ);
    var tRu = passageNear(pc, XR, uP.k, uP.t, polys), tRv = passageNear(pc, XR, vQ.k, vQ.t, polys);
    if (tRu === null || tRv === null) return null;
    var uArc = strandArc(polys, pc, uP.k, uP.t, tRu), vArc = strandArc(polys, pc, vQ.k, tRv, vQ.t);
    if (!uArc || !vArc) return null;
    var C = [(XP.x + XQ.x + XR.x) / 3, (XP.y + XQ.y + XR.y) / 3], U = polys[uP.k], V = polys[vQ.k];
    var keepU = uArc.idx.filter(function (j) { return dist2(U, j, XR) > LIFT * LIFT; });
    var keepV = vArc.idx.filter(function (j) { return dist2(V, j, XR) > LIFT * LIFT; });
    var P0 = polys[oP.k], run0 = widen(P0, arc.idx.length ? arc.idx : [Math.floor(oP.t) + 1], XP, XQ, arc.forward, stopsOn(pc, oP.k, [cP, cQ]));
    var hd = run0[0], tl = run0[run0.length - 1], sk = { poly: oP.k, lo: Math.min(hd, tl), hi: Math.max(hd, tl) };
    // the moving strand's last point before P is on the far side of u; its first after Q, of v
    var b4 = before(P0, oP.t, arc.forward), af = before(P0, oQ.t, !arc.forward);
    var pu = offsetSide(polys, uP.k, keepU, [P0.x[b4], P0.y[b4]], [[XP.x, XP.y], null], z, sk), pv = offsetSide(polys, vQ.k, keepV, [P0.x[af], P0.y[af], 'end'], [null, [XQ.x, XQ.y]], z, sk);
    var cx = XR.x - C[0], cy = XR.y - C[1], cl = Math.sqrt(cx * cx + cy * cy) || 1, dc = 1.4 * Math.min(pu.d, pv.d);
    var path = untangle(pu.concat([[XR.x + dc * cx / cl, XR.y + dc * cy / cl, z]], pv));
    var P = polys[oP.k], run = widen(P, arc.idx.length ? arc.idx : [Math.floor(oP.t) + 1], XP, XQ, arc.forward, stopsOn(pc, oP.k, [cP, cQ]));
    if (!arc.forward) { run = run.slice().reverse(); path = path.slice().reverse(); }
    return { len: pathLength(path), e: runEdit(polys, oP.k, run, path) };
  }
  function dist2(P, j, X) { var dx = P.x[j] - X.x, dy = P.y[j] - X.y; return dx * dx + dy * dy; }
  // The t of crossing XR's passage on poly k that is next to t0 along the strand (the triangle edge).
  function passageNear(pc, XR, k, t0, polys) {
    var cand = [];
    if (XR.a[0] === k) cand.push(XR.a[1]);
    if (XR.b[0] === k) cand.push(XR.b[1]);
    for (var i = 0; i < cand.length; i++) if (strandArc(polys, pc, k, t0, cand[i])) return cand[i];
    return null;
  }

  function nextMove(D) {
    var F = faces(D), i;
    for (i = 0; i < F.length; i++) if (isR1(F[i], D)) return { t: 'R1', x: [F[i][0] >> 2], f: F[i] };
    for (i = 0; i < F.length; i++) if (isR2(F[i], D)) return { t: 'R2', x: [F[i][0] >> 2, F[i][1] >> 2], f: F[i] };
    // every slide-over after which the greedy moves go on (at once first, then after one more)
    var tris = [];
    for (i = 0; i < F.length; i++) {
      if (!isR3(D, F[i])) continue;
      var E = cloneD(D), mv = [];
      applyR3(E, F[i]);
      var n0 = E.live;
      greedy(E, mv);
      if (E.live < n0) tris.unshift(F[i]); else if (r3Search(E, 1, null, 0)) tris.push(F[i]);
    }
    return tris.length ? { t: 'R3', x: [tris[0][0] >> 2, tris[0][1] >> 2, tris[0][2] >> 2], f: tris[0], all: tris } : null;
  }
  // The simplifier replayed on the drawn curves. opts.split: stop when no crossing joins two loops.
  // → { steps: [{ t, at: [[x, y]…], edit, before, after, under }], polys, end, broken: null | reason }
  // A route is taken only when (1) the frame it leads to is exactly the diagram the validator's own
  // move gives (same signed Gauss code: the same knot or link, by construction) and (2) every frame
  // of its morph is a legal motion (legalMotion). When no route passes, the replay stops before
  // that move (broken) and the view says how the rope ends.
  function replay(curves, over, opts) {
    opts = opts || {};
    var dg = diagramOf(curves, over);
    if (typeof dg === 'string') return null;
    var polys = curves.map(function (cv, i) { return polyOf(cv, over, dg.X, i); }), steps = [], broken = null;
    if (!sameDiagram(polyCrossings(polys).D, dg.D)) return { steps: [], polys: polys, end: polyCrossings(polys), broken: 'the first frame is not the item', reached: false };
    for (var guard = 0; guard < 40; guard++) {
      var pc = polyCrossings(polys), D = pc.D;
      if (D.live === 0 || (opts.split && interCount(D) === 0)) break;
      var mv = nextMove(D), zr = zRange(polys), cands = [];
      if (!mv) break;
      if (mv.t === 'R1') cands = [[mv.x, editR1(polys, pc, mv.x[0]), null]];
      else if (mv.t === 'R2') cands = editR2(polys, pc, mv.x[0], mv.x[1], zr, true).map(function (e) { return [mv.x, e, null]; });
      else mv.all.forEach(function (f) { editR3(polys, pc, f, zr, true).forEach(function (e) { cands.push([[f[0] >> 2, f[1] >> 2, f[2] >> 2], e, f]); }); });
      var ok = null, expect = {};
      for (var ci = 0; ci < cands.length && !ok; ci++) {
        if (!cands[ci][1]) continue;
        var after = applyEdit(polys, cands[ci][1]), pa = null;
        try { pa = polyCrossings(after); } catch (err) { pa = null; }
        if (!pa || !levelFree(pa)) continue;
        var fk = cands[ci][2] ? cands[ci][2].join(',') : '-';
        if (!expect[fk]) expect[fk] = moveResult(D, mv.t, mv.x, cands[ci][2]);
        if (!sameDiagram(pa.D, expect[fk])) continue;
        var step = { t: mv.t, at: cands[ci][0].map(function (c) { return [pc.list[c].x, pc.list[c].y]; }), edit: cands[ci][1], before: polys, after: after };
        if (!legalMotion(step)) continue;
        ok = step;
      }
      if (!ok) { broken = mv.t + ': no drawn route is a legal move'; break; }
      ok.under = ok.edit.path.length > 0 && ok.edit.path[ok.edit.path.length >> 1][2] < -1;
      steps.push(ok);
      polys = ok.after;
    }
    var end = polyCrossings(polys);
    // reached: the rope (or the pair of loops) came apart, as far as the replay is meant to go
    return { steps: steps, polys: polys, end: end, broken: broken, reached: !broken && (opts.split ? interCount(end.D) === 0 : end.D.live === 0) };
  }
  // Heights so far: a moved arc goes above (or below) everything moved before it, so no two
  // crossings are ever level.
  function zRange(polys) {
    var lo = -1, hi = 1;
    polys.forEach(function (P) { for (var i = 0; i < P.z.length; i++) { if (P.z[i] < lo) lo = P.z[i]; if (P.z[i] > hi) hi = P.z[i]; } });
    return [lo, hi];
  }
  // The polylines part-way through step s (k ∈ [0, 1]): the replaced run morphs into the new path.
  function morph(step, k) { return morphParts(step, k).polys; }
  // … and where the moving run lies in them: points lo … hi of poly edit.poly (after its rotation).
  function morphParts(step, k) {
    var e = step.edit, P = step.before[e.poly], Q = e.rot ? rotateTo(P, e.rot) : P;
    var oldPts = [];
    for (var i = Math.max(0, e.from - 1); i <= Math.min(Q.x.length - 1, e.to + 1); i++) oldPts.push([Q.x[i], Q.y[i], Q.z[i]]);
    var head = e.from > 0 ? [[Q.x[e.from - 1], Q.y[e.from - 1], Q.z[e.from - 1]]] : [], tail = e.to + 1 < Q.x.length ? [[Q.x[e.to + 1], Q.y[e.to + 1], Q.z[e.to + 1]]] : [];
    var newPts = head.concat(e.path, tail), n = Math.max(oldPts.length, newPts.length, 2);
    var A = resample(oldPts, n), B = resample(newPts, n), mid = [];
    var zMove = e.path.length ? e.path[e.path.length >> 1][2] : 0, curl = Math.abs(zMove) <= 1, j;
    // A moving run climbs by a hair along its length, so it never meets itself level.
    var dz = zMove >= 0 ? 1e-3 : -1e-3;
    if (!curl) {
      if (k >= 1) return { polys: applyEdit(step.before, e), lo: e.from, hi: e.from + e.path.length - 1, zMove: zMove, curl: false };
      for (j = 1; j < n - 1; j++) mid.push([A[j][0] + (B[j][0] - A[j][0]) * k, A[j][1] + (B[j][1] - A[j][1]) * k, k > 0 ? zMove + dz * j : A[j][2]]);
      return { polys: applyEdit(step.before, { poly: e.poly, rot: e.rot, from: e.from, to: e.to, path: mid }), lo: e.from, hi: e.from + mid.length - 1, zMove: zMove, curl: false };
    }
    // A curl (R1) shrinks inside its own loop, which encloses nothing: ears of the loop are cut,
    // the smallest first, each one drawn in to its chord while the clock runs through its share of
    // the loop's area. The crossing stays put (the first and last two points of the curl are never
    // cut); at the end the loop goes and the rope runs straight through (the step's after).
    var C = curlClip(step), run = C.pts, gone = {}, target = k * C.total, cum = 0, mv = null;
    for (j = 0; j < C.order.length; j++) {
      var o = C.order[j];
      if (cum + o.area <= target && o.area > 0) { gone[o.v] = 1; cum += o.area; continue; }
      if (o.area === 0 && cum <= target && k > 0) { gone[o.v] = 1; continue; }
      mv = { v: o.v, f: o.area > 0 ? Math.max(0, Math.min(1, (target - cum) / o.area)) : 0, a: o.a, b: o.b };
      break;
    }
    if (k >= 1) { for (j = 0; j < C.order.length; j++) gone[C.order[j].v] = 1; mv = null; }
    for (j = 0; j < run.length; j++) {
      if (gone[j]) continue;
      var pt = run[j];
      if (mv && mv.v === j && mv.f > 0) {
        var pa = C.at(mv.a), pb = C.at(mv.b), mx = (pa[0] + pb[0]) / 2, my = (pa[1] + pb[1]) / 2;
        pt = [pt[0] + (mx - pt[0]) * mv.f, pt[1] + (my - pt[1]) * mv.f, pt[2]];
      }
      mid.push([pt[0], pt[1], pt[2]]);
    }
    return { polys: applyEdit(step.before, { poly: e.poly, rot: e.rot, from: e.from, to: e.to, path: mid }), lo: e.from + 2, hi: e.from + mid.length - 3, zMove: 0, curl: true };
  }
  // The ear-cutting plan of a curl, cached on its step: the run's points, and in cutting order each
  // cut point v with its neighbours a, b at that moment (−1 = the crossing point) and the area cut.
  // The polygon is the crossing point and the run; its first and last two points are never cut.
  function curlClip(step) {
    if (step.clip) return step.clip;
    var e = step.edit, P = step.before[e.poly], Q = e.rot ? rotateTo(P, e.rot) : P, X = e.path[0], i;
    var pts = [];
    for (i = e.from; i <= e.to; i++) pts.push([Q.x[i], Q.y[i], Q.z[i]]);
    var L = pts.length, at = function (v) { return v < 0 ? X : pts[v]; };
    var prev = [], next = [];
    for (i = 0; i < L; i++) { prev.push(i - 1); next.push(i + 1 < L ? i + 1 : -1); }
    var area2 = 0, ring = [-1].concat(pts.map(function (_, q) { return q; }));
    for (i = 0; i < ring.length; i++) { var p1 = at(ring[i]), p2 = at(ring[(i + 1) % ring.length]); area2 += p1[0] * p2[1] - p2[0] * p1[1]; }
    var orient = area2 >= 0 ? 1 : -1, alive = new Uint8Array(L), left = L, order = [], total = 0;
    for (i = 0; i < L; i++) alive[i] = 1;
    function earArea(v) {
      if (v < 2 || v > L - 3 || !alive[v]) return -1;
      var a = at(prev[v]), b = at(v), c = at(next[v]);
      var cr = ((b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0])) * orient;
      if (cr < 0) return -1;
      for (var q = -1; q < L; q++) {
        if (q === prev[v] || q === v || q === next[v] || (q >= 0 && !alive[q])) continue;
        if (inTri(at(q), a, b, c)) return -1;
      }
      return cr / 2;
    }
    var ear = new Float64Array(L);
    for (i = 0; i < L; i++) ear[i] = earArea(i);
    while (left > 4) {
      var best = -1;
      for (i = 2; i < L - 2; i++) if (alive[i] && ear[i] >= 0 && (best < 0 || ear[i] < ear[best])) best = i;
      if (best < 0) break;
      order.push({ v: best, a: prev[best], b: next[best], area: ear[best] });
      total += ear[best];
      alive[best] = 0; left--;
      var pv = prev[best], nv = next[best];
      if (pv >= 0) next[pv] = nv;
      if (nv >= 0) prev[nv] = pv;
      if (pv >= 0) ear[pv] = earArea(pv);
      if (nv >= 0) ear[nv] = earArea(nv);
    }
    step.clip = { pts: pts, order: order, total: total, at: at };
    return step.clip;
  }
  function inTri(p, a, b, c) {
    var d1 = (p[0] - b[0]) * (a[1] - b[1]) - (a[0] - b[0]) * (p[1] - b[1]);
    var d2 = (p[0] - c[0]) * (b[1] - c[1]) - (b[0] - c[0]) * (p[1] - c[1]);
    var d3 = (p[0] - a[0]) * (c[1] - a[1]) - (c[0] - a[0]) * (p[1] - a[1]);
    var neg = d1 < 0 || d2 < 0 || d3 < 0, pos = d1 > 0 || d2 > 0 || d3 > 0;
    return !(neg && pos);
  }

  /* ---------- checks: each replayed step is the validator's own move, by a legal motion ---------- */

  // No two strands level at a crossing (the drawing would have to guess which is on top).
  function levelFree(pc) {
    for (var i = 0; i < pc.list.length; i++) if (Math.abs(pc.list[i].za - pc.list[i].zb) < 1e-6) return false;
    return true;
  }
  // The motion of a step is legal (no strand ever passes through another):
  // - a lifted (dropped) run sits above (below) everything else at every frame, and it climbs by a
  //   hair along its length, so only its two ramps (the segments joining it to the rope that stays)
  //   can meet a strand on the wrong side or level: at 32 frames (k = 1/32 … 1) each ramp must pass
  //   over (under) every other strand it crosses, and never level with the moving strand itself;
  // - a curl shrinks by cutting ears inside its own loop, so it is legal when that loop encloses no
  //   other point of any strand.
  function legalMotion(step) {
    var e = step.edit, zMove = e.path.length ? e.path[e.path.length >> 1][2] : 0;
    return Math.abs(zMove) <= 1 ? curlEmpty(step) : rampsLegal(step, zMove > 0);
  }
  function rampsLegal(step, lift) {
    var e = step.edit;
    for (var q = 1; q <= 32; q++) {
      var M = morphParts(step, q / 32), P = M.polys[e.poly], m = P.x.length, ramps = [];
      if (M.lo >= 1) ramps.push(M.lo - 1); else if (P.closed) ramps.push(m - 1);
      if (M.hi + 1 < m || P.closed) ramps.push(M.hi);
      var inRun = function (k, seg) { return k === e.poly && ((seg >= M.lo - 1 && seg <= M.hi) || (P.closed && M.lo === 0 && seg === m - 1)); };
      for (var r = 0; r < ramps.length; r++) {
        var r0 = ramps[r], r1 = (r0 + 1) % m;
        for (var k = 0; k < M.polys.length; k++) {
          var Q = M.polys[k], mq = Q.x.length, ns = Q.closed ? mq : mq - 1;
          for (var s = 0; s < ns; s++) {
            if (k === e.poly) { var d = Math.abs(s - r0); if (Q.closed) d = Math.min(d, mq - d); if (d <= 1) continue; }
            var s1 = (s + 1) % mq, hit = segCross(P.x[r0], P.y[r0], P.x[r1], P.y[r1], Q.x[s], Q.y[s], Q.x[s1], Q.y[s1]);
            if (!hit) continue;
            var zr = P.z[r0] + (P.z[r1] - P.z[r0]) * hit[0], zo = Q.z[s] + (Q.z[s1] - Q.z[s]) * hit[1];
            if (Math.abs(zr - zo) < 1e-6) return false;
            if (inRun(k, s)) continue;
            if (lift ? zr <= zo : zr >= zo) return false;
          }
        }
      }
    }
    return true;
  }
  function segCross(ax, ay, bx, by, cx, cy, dx, dy) {
    var rx = bx - ax, ry = by - ay, sx = dx - cx, sy = dy - cy, den = rx * sy - ry * sx;
    if (den === 0) return null;
    var qx = cx - ax, qy = cy - ay, u = (qx * sy - qy * sx) / den, w = (qx * ry - qy * rx) / den;
    return u >= 0 && u <= 1 && w >= 0 && w <= 1 ? [u, w] : null;
  }
  function curlEmpty(step) {
    var C = curlClip(step), e = step.edit, ring = [C.at(-1)].concat(C.pts), x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity, i;
    for (i = 0; i < ring.length; i++) { x0 = Math.min(x0, ring[i][0]); x1 = Math.max(x1, ring[i][0]); y0 = Math.min(y0, ring[i][1]); y1 = Math.max(y1, ring[i][1]); }
    for (var k = 0; k < step.before.length; k++) {
      var P = step.before[k], m = P.x.length;
      for (i = 0; i < m; i++) {
        if (P.x[i] < x0 || P.x[i] > x1 || P.y[i] < y0 || P.y[i] > y1) continue;
        if (k === e.poly) { var ri = e.rot ? (i - e.rot + m) % m : i; if (ri >= e.from - 3 && ri <= e.to + 3) continue; }
        if (insidePoly(P.x[i], P.y[i], ring)) return false;
      }
    }
    return true;
  }
  function insidePoly(x, y, ring) {
    var inside = false;
    for (var i = 0, j = ring.length - 1; i < ring.length; j = i++) {
      var a = ring[i], b = ring[j];
      if ((a[1] > y) !== (b[1] > y) && x < (b[0] - a[0]) * (y - a[1]) / (b[1] - a[1]) + a[0]) inside = !inside;
    }
    return inside;
  }
  // The validator's own move on diagram D (R1, R2: remove the crossings; R3: rewire triangle f).
  function moveResult(D, t, xs, f) {
    var E = cloneD(D);
    if (t === 'R3') applyR3(E, f); else removeX(E, xs);
    return E;
  }
  // A diagram's signed Gauss code: per component in travel order, each passage as the crossing's
  // label (by first visit), over or under, and the crossing's sign. An open rope starts just after
  // its outside arc (its ends stay put); a loop takes the smallest code over all its starts. Equal
  // codes (and plain loops) mean the same diagram on the sphere, so the same knot or link: the
  // code fixes every crossing's slots, so the faces follow.
  function isInSlot(D, s) { var q = s & 3; return q === 0 || q === D.oin[s >> 2]; }
  function slotComp(D, s) { return (s & 1) ? D.co[s >> 2] : D.cu[s >> 2]; }
  function codeFrom(D, starts) {
    var lab = {}, nl = 0, out = '';
    for (var i = 0; i < starts.length; i++) {
      var s = starts[i], guard = 0;
      do {
        var x = s >> 2;
        if (lab[x] === undefined) lab[x] = nl++;
        out += (lab[x] < 10 ? '0' : '') + lab[x] + ((s & 3) === 0 ? 'u' : 'o') + (D.oin[x] === 3 ? '+' : '-');
        s = D.link[opp(s)];
      } while (s !== starts[i] && ++guard <= 4 * D.n);
      out += '|';
    }
    return out;
  }
  function diagramCode(D) {
    var ins = {}, x;
    for (x = 0; x < D.n; x++) {
      if (!D.alive[x]) continue;
      [4 * x, 4 * x + D.oin[x]].forEach(function (s) { var c = slotComp(D, s); (ins[c] = ins[c] || []).push(s); });
    }
    var comps = Object.keys(ins).map(Number).sort(function (a, b) { return a - b; }), fixed = {};
    if (D.cl >= 0 && D.alive[D.cl >> 2]) { var s0 = isInSlot(D, D.cl) ? D.cl : D.link[D.cl]; fixed[slotComp(D, s0)] = s0; }
    var choices = comps.map(function (c) { return fixed[c] !== undefined ? [fixed[c]] : ins[c]; }), best = null;
    (function rec(i, starts) {
      if (i === comps.length) { var code = codeFrom(D, starts); if (best === null || code < best) best = code; return; }
      for (var j = 0; j < choices[i].length; j++) rec(i + 1, starts.concat([choices[i][j]]));
    })(0, []);
    return D.free + '/' + comps.join(',') + ':' + (best || '');
  }
  function sameDiagram(A, B) { return A.live === B.live && diagramCode(A) === diagramCode(B); }
  function resample(pts, n) {
    var L = [0], i;
    for (i = 1; i < pts.length; i++) L.push(L[i - 1] + Math.sqrt((pts[i][0] - pts[i - 1][0]) * (pts[i][0] - pts[i - 1][0]) + (pts[i][1] - pts[i - 1][1]) * (pts[i][1] - pts[i - 1][1])));
    var total = L[L.length - 1] || 1, out = [], j = 0;
    for (i = 0; i < n; i++) {
      var s = total * i / (n - 1);
      while (j < pts.length - 2 && L[j + 1] < s) j++;
      var seg = (L[j + 1] - L[j]) || 1, f = Math.min(1, Math.max(0, (s - L[j]) / seg)), b = pts[Math.min(j + 1, pts.length - 1)], a = pts[j];
      out.push([a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f, f < 0.5 ? a[2] : b[2]]);
    }
    return out;
  }
  function cyc(a, k, b, m) { var x = (k - a + m) % m, y = (b - a + m) % m; return x > 0 && x <= y; }
  // Unit normals along a run of points (left of travel).
  function normals(xs, ys) {
    var n = [];
    for (var i = 0; i < xs.length; i++) {
      var a = Math.max(0, i - 1), b = Math.min(xs.length - 1, i + 1), dx = xs[b] - xs[a], dy = ys[b] - ys[a], l = Math.sqrt(dx * dx + dy * dy) || 1;
      n.push([-dy / l, dx / l]);
    }
    return n;
  }
  // A loop's points starting at index `start`.
  function rotateTo(P, start) {
    var m = P.x.length, Q = { x: [], y: [], z: [], closed: P.closed };
    for (var i = 0; i < m; i++) { var k = (start + i) % m; Q.x.push(P.x[k]); Q.y.push(P.y[k]); Q.z.push(P.z[k]); }
    return Q;
  }
  // edit { poly, rot (loops: rotate to this index first), from, to (inclusive), path } → new polylines.
  function applyEdit(polys, e) {
    return polys.map(function (P, i) {
      if (i !== e.poly) return P;
      var Q = e.rot ? rotateTo(P, e.rot) : P, R = { x: Q.x.slice(0, e.from), y: Q.y.slice(0, e.from), z: Q.z.slice(0, e.from), closed: P.closed };
      e.path.forEach(function (q) { R.x.push(q[0]); R.y.push(q[1]); R.z.push(q[2]); });
      for (var k = e.to + 1; k < Q.x.length; k++) { R.x.push(Q.x[k]); R.y.push(Q.y[k]); R.z.push(Q.z[k]); }
      return R;
    });
  }

  /* =====================================================================================
     6. THE SHARED MODEL (def.lib): the view draws and animates from it, the tests use it.
     ===================================================================================== */

  var LIB = {
    PLATE: PLATE, SUB: SUB, SPACING: SPACING, RUNGS: RUNGS, VARIANTS: VARIANTS, ANSWER: ANSWER, V_OFFSET: V_OFFSET,
    SIN_MIN: SIN_MIN, CROSS_GAP: CROSS_GAP, TAG_GAP: TAG_GAP, TRIPLE: TRIPLE, RADIUS_MIN: RADIUS_MIN,
    V_UNKNOT: V_UNKNOT, V_UNLINK2: V_UNLINK2,
    // polynomials and diagrams
    peq: peq, pIsOne: pIsOne, pmirror: pmirror, tText: tText,
    fromPassages: fromPassages, cloneD: cloneD, compact: compact, switched: switched, faces: faces,
    isR1: isR1, isR2: isR2, isR3: isR3, applyR3: applyR3, removeX: removeX, greedy: greedy, simplify: simplify,
    jones: jones, determinant: determinant, writhe: writhe, linking: linking, interCount: interCount, component: component,
    classify: classify, nugatory: nugatory, knotKind: knotKind,
    // geometry
    sampleCurve: sampleCurve, bezier: bezier, crossingsOf: crossingsOf, diagramOf: diagramOf, legible: legible,
    walkOpen: walkOpen, ropePoints: ropePoints, ropeShadow: ropeShadow,
    // items
    ropeFeatures: ropeFeatures, withOver: withOver, shadowFacts: shadowFacts, fastSig: fastSig, matchedPair: matchedPair,
    switchFeatures: switchFeatures, ropeOf: ropeOf, norm: norm, buildItem: buildItem, fallback: fallback, check: check,
    switchN: switchN, tagOrder: tagOrder, farApart: farApart, pattern: pattern, RUNG_LABELS: RUNG_LABELS, overLengths: overLengths,
    // links
    LINK_RUNGS: LINK_RUNGS, linkShadow: linkShadow, linkKind: linkKind, linkFacts: linkFacts, linkSig: linkSig, linkPair: linkPair, checkLink: checkLink,
    // show me
    LIFT: LIFT, polyOf: polyOf, polyCrossings: polyCrossings, replay: replay, morph: morph, morphParts: morphParts, nextMove: nextMove, zRange: zRange,
    levelFree: levelFree, legalMotion: legalMotion, moveResult: moveResult, diagramCode: diagramCode, sameDiagram: sameDiagram,
    curvesOf: curvesOf,
  };
  // The item's curves as the validator reads them.
  function curvesOf(item) {
    return item.loops ? item.loops.map(function (pts) { return { pts: pts, closed: true }; }) : [{ pts: item.pts, closed: false }];
  }

  /* =====================================================================================
     5. VALIDATION: everything is re-derived from the item's geometry and over/under flags.
        The crossings come from the drawn curves; the knot type from the cheap route (moves,
        determinant, Jones polynomial); the answer from that, never from the generator.
     ===================================================================================== */

  function intPts(pts, closed) {
    if (!Array.isArray(pts) || pts.length < (closed ? 4 : 6)) return false;
    for (var i = 0; i < pts.length; i++) {
      var q = pts[i];
      if (!Array.isArray(q) || q.length !== 2 || !Number.isInteger(q[0]) || !Number.isInteger(q[1]) || Math.abs(q[0]) > 1000 || Math.abs(q[1]) > 1000) return false;
    }
    return true;
  }
  function flags(over, n) {
    if (!Array.isArray(over) || over.length !== n) return false;
    for (var i = 0; i < n; i++) if (typeof over[i] !== 'boolean') return false;
    return true;
  }

  // The item's rope as a diagram, with every rule of R2 §5.2 checked. → dg or a reason.
  function ropeOf(item) {
    if (!intPts(item.pts, false)) return 'the rope needs integer control points';
    var p = item.params, sp = SPACING[p.spacing], n = p.variant === 'pull' ? RUNGS[p.rope].n : switchN(p.rope);
    if (!flags(item.over, n)) return 'the rope needs ' + n + ' over/under flags';
    var dg = diagramOf([{ pts: item.pts, closed: false }], item.over);
    if (typeof dg === 'string') return dg;
    var L = legible(dg, { gap: sp.gap, open: true });
    if (typeof L === 'string') return L;
    dg.legible = L;
    return dg;
  }

  function checkRope(item) {
    var dg = ropeOf(item);
    if (typeof dg === 'string') return dg;
    var p = item.params, R = RUNGS[p.rope], nWant = p.variant === 'pull' ? R.n : switchN(p.rope);
    if (item.n !== nWant || item.depth !== R.depth) return 'n and depth do not match the rope level';
    if (p.variant === 'pull') {
      var c = classify(dg.D);
      if (typeof item.key !== 'boolean' || item.key !== c.knot) return 'the key is not what the rope is (' + (c.knot ? 'a knot' : 'no knot') + ')';
      if (!c.knot && (c.proof !== 'moves' || c.depth !== R.depth)) return 'the unknot needs ' + (c.proof === 'moves' ? c.depth : 2) + ' kinds of move, the level asks ' + R.depth;
      return true;
    }
    // untie / tie
    var tie = p.variant === 'tie', tags = item.tags;
    if (!Array.isArray(tags) || tags.length !== 4 || !Array.isArray(item.options) || item.options.length !== 4) return 'four tagged crossings are needed';
    for (var i = 0; i < 4; i++) {
      if (!Number.isInteger(tags[i]) || tags[i] < 0 || tags[i] >= nWant || tags.indexOf(tags[i]) !== i || item.options[i] !== tags[i]) return 'tags must be four different crossings';
    }
    if (!farApart(dg, tags)) return 'two tags are closer than ' + TAG_GAP + ' px';
    var base = knotKind(dg.D);
    if (tie ? base !== 'U' : base !== 'K') return tie ? 'the rope must fall open (by moves) before the switch' : 'the rope must be a knot before the switch';
    var nug = nugatory(dg.D), changes = [];
    for (i = 0; i < 4; i++) {
      if (nug[tags[i]]) return 'tag ' + i + ' is on a crossing that cannot matter';
      var kind = knotKind(switched(dg.D, tags[i]));
      if (tie ? kind === 'K' : kind === 'U') changes.push(i);
      else if (tie ? kind !== 'U' : kind !== 'K') return 'tag ' + i + ': the switched rope is not settled by moves or invariants';
    }
    if (changes.length !== 1) return changes.length + ' tagged crossings change the rope (exactly one must)';
    if (item.key !== changes[0]) return 'the key is not the crossing that ' + (tie ? 'ties' : 'unties') + ' the rope';
    return true;
  }

  function check(item) {
    if (!item || item.ex !== 'knots') return 'not a knots item';
    var p = item.params || {};
    if (!Number.isInteger(p.rope) || p.rope < 0 || p.rope >= RUNGS.length || !Number.isInteger(p.spacing) || p.spacing < 0 || p.spacing >= SPACING.length || VARIANTS.indexOf(p.variant) < 0) return 'params are not valid knots params';
    if (item.variant !== p.variant || item.answer !== ANSWER[p.variant] || item.nOptions !== (ANSWER[p.variant] === 'choice' ? 4 : 2)) return 'the answer format does not match the variant';
    if (p.variant === 'pull' || p.variant === 'untie' || p.variant === 'tie') return checkRope(item);
    return checkLink(item);
  }
  function validate(item) {
    try { return check(item); } catch (e) { return 'validate threw: ' + (e && e.message); }
  }

  /* ---------- scoring ---------- */

  // yesno (pull: a knot remains; link: the loops are linked) → boolean; choice → the
  // tag's index. Malformed responses are wrong, never a throw.
  function score(item, response) {
    if (item.answer === 'yesno') {
      var ok = typeof response === 'boolean' && response === item.key;
      return { correct: ok, detail: { response: typeof response === 'boolean' ? response : null, key: item.key } };
    }
    var okC = Number.isInteger(response) && response >= 0 && response < 4 && response === item.key;
    return { correct: okC, detail: { response: Number.isInteger(response) ? response : null, key: item.key } };
  }

  /* ---------- definition ---------- */

  PX.ex.define({
    id: 'knots', version: 1, code: 'EX-13', name: 'Knots', short: 'Knots',
    abilities: ['Vz'], cell: 'intrinsic-dynamic', role: 'train',
    // Variants answer differently (ARCHITECTURE §6): items carry answer and nOptions.
    answer: 'yesno', answers: ANSWER,
    // Hand-set starting design (R2 §7.2), to be refitted from pooled exports:
    // - rope: 10 rungs of 0.40 logit (3.6 over the range): more rope to trace (tracing time grows
    //   with curve length, Jolicoeur et al. 1986) and, from rung 4, unknots that need a slide-over
    //   before anything comes off (RUNGS above: what this generator can match, measured).
    // - spacing: open, close, tight, 0.25 logit per level: tracing slows when other strands run
    //   near (Jolicoeur & Ingleton 1991; Jeurissen et al. 2016).
    // - variants: + V_OFFSET (one rating; untie/tie and link are later skills).
    // Range 4.1 logits + offsets. base −1.75: a beginner at θ = 0 gets the easiest pull item right
    // 0.5 + 0.47·σ(1.75) ≈ 90 % of the time.
    dims: [
      { key: 'rope', label: 'Rope', levels: RUNG_LABELS.slice(), step: 0.40 },
      { key: 'spacing', label: 'Spacing', levels: SPACING.map(function (s) { return s.name; }), step: 0.25 },
    ],
    base: -1.75,
    difficulty: function (params) {
      var p = norm(params);
      return -1.75 + 0.40 * p.rope + 0.25 * p.spacing + V_OFFSET[p.variant];
    },
    variants: VARIANTS.slice(),
    chance: function (params) { var v = params && params.variant; return v === 'untie' || v === 'tie' ? 0.25 : 0.5; },
    generate: generate,
    validate: validate,
    score: score,
    lib: LIB,
  });
})(window.PX);
