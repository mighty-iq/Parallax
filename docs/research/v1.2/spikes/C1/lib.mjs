// C1 spike library: Central Point (the geometric median restricted to grid points).
// Plain Node (>= 18), no dependencies. Does not import or modify any Parallax app code.
// Coordinates are grid steps: x, y in 0..G-1. Targets are distinct grid points with weights (default 1).

/* ------------------------------------------------------------------ seeded RNG */
// cyrb128 string hash -> sfc32 generator (public-domain constructions; deterministic in Node).
function cyrb128(str) {
  let h1 = 1779033703, h2 = 3144134277, h3 = 1013904242, h4 = 2773480762;
  for (let i = 0, k; i < str.length; i++) {
    k = str.charCodeAt(i);
    h1 = h2 ^ Math.imul(h1 ^ k, 597399067);
    h2 = h3 ^ Math.imul(h2 ^ k, 2869860233);
    h3 = h4 ^ Math.imul(h3 ^ k, 951274213);
    h4 = h1 ^ Math.imul(h4 ^ k, 2716044179);
  }
  h1 = Math.imul(h3 ^ (h1 >>> 18), 597399067);
  h2 = Math.imul(h4 ^ (h2 >>> 22), 2869860233);
  h3 = Math.imul(h1 ^ (h3 >>> 17), 951274213);
  h4 = Math.imul(h2 ^ (h4 >>> 19), 2716044179);
  h1 ^= h2 ^ h3 ^ h4; h2 ^= h1; h3 ^= h1; h4 ^= h1;
  return [h1 >>> 0, h2 >>> 0, h3 >>> 0, h4 >>> 0];
}
function sfc32(a, b, c, d) {
  return function () {
    a |= 0; b |= 0; c |= 0; d |= 0;
    const t = (((a + b) | 0) + d) | 0;
    d = (d + 1) | 0;
    a = b ^ (b >>> 9);
    b = (c + (c << 3)) | 0;
    c = (c << 21) | (c >>> 11);
    c = (c + t) | 0;
    return (t >>> 0) / 4294967296;
  };
}
export function makeRng(seed) {
  const s = cyrb128(String(seed));
  const next = sfc32(s[0], s[1], s[2], s[3]);
  for (let i = 0; i < 12; i++) next();
  return {
    next,
    int(lo, hi) { return lo + Math.floor(next() * (hi - lo + 1)); },
    normal() {
      let u = 0; while (u === 0) u = next();
      const v = next();
      return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
    },
    shuffle(a) { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(next() * (i + 1)); const t = a[i]; a[i] = a[j]; a[j] = t; } return a; },
  };
}

/* ------------------------------------------------------------------ geometry */
export function dist(ax, ay, bx, by) { const dx = ax - bx, dy = ay - by; return Math.sqrt(dx * dx + dy * dy); }
export function idx(G, x, y) { return y * G + x; }
export function xy(G, i) { return [i % G, Math.floor(i / G)]; }
function clamp(v, lo, hi) { return v < lo ? lo : v > hi ? hi : v; }
// Round a continuous position to the nearest grid point (halves round up, as Math.round does), clamped.
export function snap(G, x, y) { return idx(G, clamp(Math.round(x), 0, G - 1), clamp(Math.round(y), 0, G - 1)); }

/* ------------------------------------------------------------------ the exhaustive solver */
// Total weighted distance from every grid point to the targets, the best point, the sorted order and
// the relative excess e(p) = S(p)/S* - 1. Independent of how the item was generated.
export function solve(item) {
  const { G, T, W } = item;
  const N = G * G, S = new Float64Array(N);
  for (let i = 0; i < N; i++) {
    const px = i % G, py = (i - px) / G;
    let s = 0;
    for (let j = 0; j < T.length; j++) s += W[j] * dist(px, py, T[j][0], T[j][1]);
    S[i] = s;
  }
  const order = Array.from({ length: N }, (_, i) => i).sort((a, b) => S[a] - S[b] || a - b);
  const best = order[0], Sstar = S[best];
  const E = new Float64Array(N);
  for (let i = 0; i < N; i++) E[i] = S[i] / Sstar - 1;
  // exact or floating ties for best: relative difference below 1e-12
  let nTieBest = 1; while (nTieBest < N && E[order[nTieBest]] < 1e-12) nTieBest++;
  const rank = new Int32Array(N); for (let r = 0; r < N; r++) rank[order[r]] = r + 1;
  return { S, E, order, best, Sstar, rank, nTieBest, e2: E[order[nTieBest]] };
}

/* ------------------------------------------------------------------ Weiszfeld with the Vardi–Zhang step */
// Continuous geometric median (Vardi & Zhang 2000 modification: converges from any start, handles a
// median at a target). Returns { x, y, atTarget (index or -1), resid, iters }.
export function weiszfeld(T, W, maxIter = 5000, tol = 1e-11) {
  let sw = 0, x = 0, y = 0;
  for (let j = 0; j < T.length; j++) { sw += W[j]; x += W[j] * T[j][0]; y += W[j] * T[j][1]; }
  x /= sw; y /= sw;
  let it = 0;
  for (; it < maxIter; it++) {
    let nx = 0, ny = 0, den = 0, rx = 0, ry = 0, eta = 0, at = -1;
    for (let j = 0; j < T.length; j++) {
      const d = dist(x, y, T[j][0], T[j][1]);
      if (d < 1e-13) { eta += W[j]; at = j; continue; }
      const w = W[j] / d;
      nx += w * T[j][0]; ny += w * T[j][1]; den += w;
      rx += W[j] * (T[j][0] - x) / d; ry += W[j] * (T[j][1] - y) / d;
    }
    let tx = nx / den, ty = ny / den;
    if (eta > 0) {
      const r = Math.sqrt(rx * rx + ry * ry);
      if (r <= eta) return { x, y, atTarget: at, resid: r, iters: it, vertexSlack: eta - r };
      const a = Math.max(0, 1 - eta / r), b = Math.min(1, eta / r);
      tx = a * tx + b * x; ty = a * ty + b * y;
    }
    const step = dist(x, y, tx, ty);
    x = tx; y = ty;
    if (step < tol) break;
  }
  // residual of the optimality condition: |sum of unit vectors| (0 at an interior median)
  let rx = 0, ry = 0, at = -1;
  for (let j = 0; j < T.length; j++) {
    const d = dist(x, y, T[j][0], T[j][1]);
    if (d < 1e-9) { at = j; continue; }
    rx += W[j] * (T[j][0] - x) / d; ry += W[j] * (T[j][1] - y) / d;
  }
  return { x, y, atTarget: at, resid: Math.sqrt(rx * rx + ry * ry), iters: it };
}

// The median sits at target j exactly when the other targets' pulls on j sum to no more than w_j
// (the subgradient condition). Returns that j, or -1 when the median is interior. Independent of any algorithm.
export function vertexMedian(T, W) {
  for (let j = 0; j < T.length; j++) {
    let rx = 0, ry = 0;
    for (let i = 0; i < T.length; i++) { if (i === j) continue; const d = dist(T[j][0], T[j][1], T[i][0], T[i][1]); if (d < 1e-12) continue; rx += W[i] * (T[i][0] - T[j][0]) / d; ry += W[i] * (T[i][1] - T[j][1]) / d; }
    if (Math.sqrt(rx * rx + ry * ry) <= W[j] + 1e-12) return j;
  }
  return -1;
}
// Newton refinement of an interior median (Weiszfeld converges only linearly). Hessian of S at y:
// sum_i w_i (I - u_i u_i^T) / d_i; gradient: -sum_i w_i u_i. Backtracking keeps S decreasing.
export function polish(T, W, g, steps = 30) {
  if (g.atTarget >= 0) return g;
  let x = g.x, y = g.y;
  const S = (px, py) => { let s = 0; for (let j = 0; j < T.length; j++) s += W[j] * dist(px, py, T[j][0], T[j][1]); return s; };
  for (let it = 0; it < steps; it++) {
    let gx = 0, gy = 0, hxx = 0, hxy = 0, hyy = 0, near = false;
    for (let j = 0; j < T.length; j++) {
      const dx = T[j][0] - x, dy = T[j][1] - y, d = Math.sqrt(dx * dx + dy * dy);
      if (d < 1e-12) { near = true; break; }
      const ux = dx / d, uy = dy / d; gx -= W[j] * ux; gy -= W[j] * uy;
      hxx += W[j] * (1 - ux * ux) / d; hxy -= W[j] * ux * uy / d; hyy += W[j] * (1 - uy * uy) / d;
    }
    if (near) break;
    const det = hxx * hyy - hxy * hxy; if (!(det > 1e-18)) break;
    let sx = -(hyy * gx - hxy * gy) / det, sy = -(hxx * gy - hxy * gx) / det;
    const s0 = S(x, y); let t = 1;
    while (t > 1e-6 && S(x + t * sx, y + t * sy) > s0) t /= 2;
    if (t <= 1e-6) break;
    x += t * sx; y += t * sy;
    if (Math.hypot(t * sx, t * sy) < 1e-15) break;
  }
  let rx = 0, ry = 0; for (let j = 0; j < T.length; j++) { const d = dist(x, y, T[j][0], T[j][1]); if (d > 1e-12) { rx += W[j] * (T[j][0] - x) / d; ry += W[j] * (T[j][1] - y) / d; } }
  return { x, y, atTarget: -1, resid: Math.sqrt(rx * rx + ry * ry), iters: g.iters };
}

/* ------------------------------------------------------------------ shortcut heuristics */
// Each returns a grid index. None of them reads S, the band or the key.
function wmean(T, W) {
  let sw = 0, x = 0, y = 0;
  for (let j = 0; j < T.length; j++) { sw += W[j]; x += W[j] * T[j][0]; y += W[j] * T[j][1]; }
  return [x / sw, y / sw];
}
function wmedian1(vals, W) { // weighted 1D median; on an exact half split, the midpoint of the two middle values
  const o = vals.map((v, i) => [v, W[i]]).sort((a, b) => a[0] - b[0]);
  const tot = W.reduce((a, b) => a + b, 0);
  let c = 0;
  for (let i = 0; i < o.length; i++) {
    c += o[i][1];
    if (c > tot / 2 + 1e-9) return o[i][0];
    if (Math.abs(c - tot / 2) < 1e-9) return (o[i][0] + o[i + 1][0]) / 2;
  }
  return o[o.length - 1][0];
}
function convexHull(P) { // monotone chain; returns hull points counter-clockwise
  const pts = P.slice().sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  if (pts.length <= 2) return pts;
  const cross = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const lo = [], up = [];
  for (const p of pts) { while (lo.length >= 2 && cross(lo[lo.length - 2], lo[lo.length - 1], p) <= 0) lo.pop(); lo.push(p); }
  for (let i = pts.length - 1; i >= 0; i--) { const p = pts[i]; while (up.length >= 2 && cross(up[up.length - 2], up[up.length - 1], p) <= 0) up.pop(); up.push(p); }
  up.pop(); lo.pop();
  return lo.concat(up);
}
function hullCentroid(T) { // area centroid of the convex hull; the mean of the hull points if degenerate
  const H = convexHull(T);
  if (H.length < 3) { let x = 0, y = 0; for (const p of H) { x += p[0]; y += p[1]; } return [x / H.length, y / H.length]; }
  let A = 0, cx = 0, cy = 0;
  for (let i = 0; i < H.length; i++) {
    const [x0, y0] = H[i], [x1, y1] = H[(i + 1) % H.length];
    const c = x0 * y1 - x1 * y0;
    A += c; cx += (x0 + x1) * c; cy += (y0 + y1) * c;
  }
  if (Math.abs(A) < 1e-12) { let x = 0, y = 0; for (const p of H) { x += p[0]; y += p[1]; } return [x / H.length, y / H.length]; }
  return [cx / (3 * A), cy / (3 * A)];
}
function minCircleCentre(T) { // smallest enclosing circle by brute force over pairs and triples (k <= 12)
  let best = null;
  const covers = (cx, cy, r) => T.every((p) => dist(cx, cy, p[0], p[1]) <= r + 1e-9);
  for (let i = 0; i < T.length; i++) for (let j = i + 1; j < T.length; j++) {
    const cx = (T[i][0] + T[j][0]) / 2, cy = (T[i][1] + T[j][1]) / 2, r = dist(cx, cy, T[i][0], T[i][1]);
    if ((!best || r < best[2]) && covers(cx, cy, r)) best = [cx, cy, r];
  }
  for (let i = 0; i < T.length; i++) for (let j = i + 1; j < T.length; j++) for (let k = j + 1; k < T.length; k++) {
    const [ax, ay] = T[i], [bx, by] = T[j], [qx, qy] = T[k];
    const d = 2 * (ax * (by - qy) + bx * (qy - ay) + qx * (ay - by));
    if (Math.abs(d) < 1e-12) continue;
    const ux = ((ax * ax + ay * ay) * (by - qy) + (bx * bx + by * by) * (qy - ay) + (qx * qx + qy * qy) * (ay - by)) / d;
    const uy = ((ax * ax + ay * ay) * (qx - bx) + (bx * bx + by * by) * (ax - qx) + (qx * qx + qy * qy) * (bx - ax)) / d;
    const r = dist(ux, uy, ax, ay);
    if ((!best || r < best[2]) && covers(ux, uy, r)) best = [ux, uy, r];
  }
  return best ? [best[0], best[1]] : [T[0][0], T[0][1]];
}

export const HEURISTICS = {
  // stem-blind
  gridCentre: { label: 'grid centre (stem-blind)', f: (it) => snap(it.G, (it.G - 1) / 2, (it.G - 1) / 2) },
  // "centres" of the target set
  mean: { label: 'average position', f: (it) => { const [x, y] = wmean(it.T, it.W); return snap(it.G, x, y); } },
  bbox: { label: 'middle of the bounding box', f: (it) => { const xs = it.T.map((p) => p[0]), ys = it.T.map((p) => p[1]); return snap(it.G, (Math.min(...xs) + Math.max(...xs)) / 2, (Math.min(...ys) + Math.max(...ys)) / 2); } },
  cwm: { label: 'coordinate-wise median', f: (it) => snap(it.G, wmedian1(it.T.map((p) => p[0]), it.W), wmedian1(it.T.map((p) => p[1]), it.W)) },
  circle: { label: 'centre of the smallest circle round the targets', f: (it) => { const [x, y] = minCircleCentre(it.T); return snap(it.G, x, y); } },
  hull: { label: 'centroid of the convex hull', f: (it) => { const [x, y] = hullCentroid(it.T); return snap(it.G, x, y); } },
  // targets as answers
  medoid: { label: 'medoid (target with the least total distance to the others)', f: (it) => {
    let b = -1, bs = Infinity;
    for (let i = 0; i < it.T.length; i++) { let s = 0; for (let j = 0; j < it.T.length; j++) s += it.W[j] * dist(it.T[i][0], it.T[i][1], it.T[j][0], it.T[j][1]); if (s < bs - 1e-12) { bs = s; b = i; } }
    return idx(it.G, it.T[b][0], it.T[b][1]); } },
  nearCentre: { label: 'target nearest the grid centre', f: (it) => {
    const c = (it.G - 1) / 2; let b = 0, bd = Infinity;
    for (let i = 0; i < it.T.length; i++) { const d = dist(it.T[i][0], it.T[i][1], c, c); if (d < bd - 1e-12) { bd = d; b = i; } }
    return idx(it.G, it.T[b][0], it.T[b][1]); } },
  nearMean: { label: 'target nearest the average position', f: (it) => {
    const [mx, my] = wmean(it.T, it.W); let b = 0, bd = Infinity;
    for (let i = 0; i < it.T.length; i++) { const d = dist(it.T[i][0], it.T[i][1], mx, my); if (d < bd - 1e-12) { bd = d; b = i; } }
    return idx(it.G, it.T[b][0], it.T[b][1]); } },
  // outlier-discounting shortcuts (people's "ignore the far ones")
  dense: { label: 'centre of the densest group (radius 2)', f: (it) => {
    const R = 2 + 1e-9; let b = 0, bc = -1, bs = Infinity;
    for (let i = 0; i < it.T.length; i++) {
      let c = 0, s = 0;
      for (let j = 0; j < it.T.length; j++) { const d = dist(it.T[i][0], it.T[i][1], it.T[j][0], it.T[j][1]); if (d <= R) { c += it.W[j]; s += d; } }
      if (c > bc || (c === bc && s < bs - 1e-12)) { bc = c; bs = s; b = i; }
    }
    let x = 0, y = 0, sw = 0;
    for (let j = 0; j < it.T.length; j++) { if (dist(it.T[b][0], it.T[b][1], it.T[j][0], it.T[j][1]) <= R) { x += it.W[j] * it.T[j][0]; y += it.W[j] * it.T[j][1]; sw += it.W[j]; } }
    return snap(it.G, x / sw, y / sw); } },
  trim1: { label: 'average without the farthest target', f: (it) => {
    if (it.T.length < 4) { const [x, y] = wmean(it.T, it.W); return snap(it.G, x, y); }
    const [mx, my] = wmean(it.T, it.W); let far = 0, fd = -1;
    for (let i = 0; i < it.T.length; i++) { const d = dist(it.T[i][0], it.T[i][1], mx, my); if (d > fd + 1e-12) { fd = d; far = i; } }
    const T2 = it.T.filter((_, i) => i !== far), W2 = it.W.filter((_, i) => i !== far);
    const [x, y] = wmean(T2, W2); return snap(it.G, x, y); } },
};
export const HKEYS = Object.keys(HEURISTICS);

/* ------------------------------------------------------------------ item generators */
// uniform: k distinct grid points anywhere.
// cluster: a group of m targets within radius rc of a centre, the rest anywhere at least rOut from it.
// The constraints that make items fit for training live in the caller (spike.mjs), not here.
export function genTargets(rng, G, k, family) {
  const used = new Set(), T = [];
  const add = (x, y) => { const key = y * G + x; if (x < 0 || y < 0 || x >= G || y >= G || used.has(key)) return false; used.add(key); T.push([x, y]); return true; };
  if (family === 'uniform') {
    while (T.length < k) add(rng.int(0, G - 1), rng.int(0, G - 1));
    return T;
  }
  // cluster share: between a third and two thirds of the targets (never all)
  const m = Math.max(2, Math.min(k - 1, rng.int(Math.ceil(k / 3), Math.floor((2 * k) / 3))));
  const cx = rng.int(0, G - 1), cy = rng.int(0, G - 1);
  const rc = G >= 9 ? 2 : 1.5, rOut = Math.max(2.5, G / 2.5);
  let guard = 0;
  while (T.length < m && guard++ < 1000) { const x = cx + rng.int(-2, 2), y = cy + rng.int(-2, 2); if (dist(x, y, cx, cy) <= rc) add(x, y); }
  guard = 0;
  while (T.length < k && guard++ < 5000) { const x = rng.int(0, G - 1), y = rng.int(0, G - 1); if (dist(x, y, cx, cy) >= rOut) add(x, y); }
  while (T.length < k) add(rng.int(0, G - 1), rng.int(0, G - 1)); // fallback: anywhere
  return T;
}

function addPt(T, used, G, x, y) { const key = y * G + x; if (x < 0 || y < 0 || x >= G || y >= G || used.has(key)) return false; used.add(key); T.push([x, y]); return true; }
// two: two small groups (a third of the targets each) and the rest anywhere.
export function genTwo(rng, G, k) {
  const used = new Set(), T = [];
  const a = [rng.int(0, G - 1), rng.int(0, G - 1)]; let b, g = 0;
  do { b = [rng.int(0, G - 1), rng.int(0, G - 1)]; } while (dist(a[0], a[1], b[0], b[1]) < 3 && g++ < 100);
  const na = Math.max(1, Math.floor(k / 3)), nb = Math.max(1, Math.floor(k / 3));
  g = 0; while (T.length < na && g++ < 500) addPt(T, used, G, a[0] + rng.int(-1, 1), a[1] + rng.int(-1, 1));
  g = 0; while (T.length < na + nb && g++ < 500) addPt(T, used, G, b[0] + rng.int(-1, 1), b[1] + rng.int(-1, 1));
  while (T.length < k) addPt(T, used, G, rng.int(0, G - 1), rng.int(0, G - 1));
  return T;
}
// The family mixture used by the proposed generator: uniform, one group plus spread targets, two groups.
export const FAMILIES = ['uniform', 'cluster', 'two'];
export function genMixture(rng, G, k) {
  const u = rng.next();
  if (u < 1 / 3) return { fam: 'uniform', T: genTargets(rng, G, k, 'uniform') };
  if (u < 2 / 3) return { fam: 'cluster', T: genTargets(rng, G, k, 'cluster') };
  return { fam: 'two', T: genTwo(rng, G, k) };
}

export function makeItem(G, T, W) { return { G, T, W: W || T.map(() => 1) }; }
// Targets on a coarse Gc x Gc lattice, answers on a lattice f times finer: ((Gc-1)f+1)^2 points.
// All coordinates are then in fine steps; the targets sit on multiples of f.
export function makeFineItem(Gc, f, Tc, W) { return makeItem((Gc - 1) * f + 1, Tc.map((p) => [p[0] * f, p[1] * f]), W); }

/* ------------------------------------------------------------------ partial-skill strategies and second-order guesses */
// Not shortcuts in the sense of standing rule 5: each applies the exercise's principle in a crude form
// (the average is dragged towards far targets, so correct it). Reported, not bounded. Shifts in fine steps.
export function correctedMean(it, shift) {
  const k = it.T.length; const [mx, my] = wmean(it.T, it.W);
  const dp = xy(it.G, HEURISTICS.dense.f(it)); const dd = dist(dp[0], dp[1], mx, my);
  let far = 0, fd = -1; for (let i = 0; i < k; i++) { const d = dist(it.T[i][0], it.T[i][1], mx, my); if (d > fd) { fd = d; far = i; } }
  const toward = dd < 1e-9 ? snap(it.G, mx, my) : snap(it.G, mx + shift * (dp[0] - mx) / dd, my + shift * (dp[1] - my) / dd);
  const away = fd < 1e-9 ? snap(it.G, mx, my) : snap(it.G, mx - shift * (it.T[far][0] - mx) / fd, my - shift * (it.T[far][1] - my) / fd);
  return { toward, away };
}
// One Weiszfeld step from the average: the inverse-distance weighted average (far targets count less).
export function oneWeiszfeld(it) {
  const [mx, my] = wmean(it.T, it.W); let x = 0, y = 0, s = 0;
  for (let j = 0; j < it.T.length; j++) { const d = Math.max(1e-9, dist(mx, my, it.T[j][0], it.T[j][1])); const w = it.W[j] / d; x += w * it.T[j][0]; y += w * it.T[j][1]; s += w; }
  return snap(it.G, x / s, y / s);
}
export function ringPts(G, p, r) {
  const [x, y] = xy(G, p); const out = [];
  for (let dx = -r; dx <= r; dx++) for (let dy = -r; dy <= r; dy++) {
    if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
    const X = x + dx, Y = y + dy; if (X >= 0 && Y >= 0 && X < G && Y < G) out.push(Y * G + X);
  }
  return out;
}
export function meanPoint(it) { return wmean(it.T, it.W); }

/* ------------------------------------------------------------------ scoring */
// Counted right: e(p) <= band. Partial credit: 1 inside the band, falling linearly to 0 at 4 x band.
export function credit(e, band) { return e <= band ? 1 : Math.max(0, 1 - (e - band) / (3 * band)); }
export function stepDist(G, a, b) { const [ax, ay] = xy(G, a), [bx, by] = xy(G, b); return dist(ax, ay, bx, by); }
