// Shared helpers for the N1 simulations (independent geometry: Math.sin/cos/atan2).
export const norm360 = (a) => ((a % 360) + 360) % 360;
export const norm180 = (a) => { const d = norm360(a); return d > 180 ? d - 360 : d; };
export const adiff = (a, b) => Math.abs(norm180(a - b));
const rad = (d) => d * Math.PI / 180;
const compass = (e, n) => norm360(Math.atan2(e, n) * 180 / Math.PI);
export function walk(legs, turns) { // h0 = 0; turns[i] after legs[i]; extra turns after the last leg
  let x = 0, y = 0, h = 0; const path = [[0, 0]];
  legs.forEach((L, i) => { if (i) h += turns[i - 1]; x += L * Math.sin(rad(h)); y += L * Math.cos(rad(h)); path.push([x, y]); });
  for (let j = Math.max(0, legs.length - 1); j < turns.length; j++) h += turns[j];
  return { path, key: norm360(compass(-x, -y) - h), d: Math.hypot(x, y) };
}
export function mulberry(seed) { let a = seed >>> 0; return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
// Best fixed answer from a training set (maximises hits), evaluated on a test set: 2-fold CV.
function bestOf(cands, train, hit) { let best = cands[0], bh = -1; for (const c of cands) { let h = 0; for (const it of train) if (hit(c, it)) h++; if (h > bh) { bh = h; best = c; } } return best; }
export function cv2(items, cands, hit) {
  const A = items.filter((_, i) => i % 2 === 0), B = items.filter((_, i) => i % 2 === 1);
  const a = bestOf(cands, A, hit), b = bestOf(cands, B, hit);
  let h = 0; for (const it of B) if (hit(a, it)) h++; for (const it of A) if (hit(b, it)) h++;
  return h / items.length;
}
// Turn-only kNN oracle (2-fold CV): for each test item, the answer that hits the most of the k nearest
// training items by turn sequence (exact turns, sign included); returns its hit rate.
export function knnTurnOnly(items, tol, k = 25) {
  const A = items.filter((_, i) => i % 2 === 0), B = items.filter((_, i) => i % 2 === 1);
  let h = 0;
  for (const [train, test] of [[A, B], [B, A]]) {
    for (const it of test) {
      const nb = train.map((o) => ({ o, dd: o.turns.reduce((s, t, j) => s + (t - it.turns[j]) ** 2, 0) })).sort((x, y) => x.dd - y.dd).slice(0, k);
      let best = null, bc = -1;
      for (const c of nb) { let cnt = 0; for (const n2 of nb) if (adiff(c.o.key, n2.o.key) <= tol) cnt++; if (cnt > bc) { bc = cnt; best = c.o.key; } }
      if (adiff(best, it.key) <= tol) h++;
    }
  }
  return h / items.length;
}
export function strategies(items, tol) {
  const sum = (a) => a.reduce((s, x) => s + x, 0);
  const el = items.filter((it) => adiff(walk(it.legs.map(() => 1), it.turns).key, it.key) <= tol).length / items.length;
  const f180 = items.filter((it) => adiff(180 - sum(it.turns) / 2, it.key) <= tol).length / items.length;
  const grid = []; for (let a = 0; a < 360; a += 2) grid.push(a);
  const fix = cv2(items, grid, (c, it) => adiff(c, it.key) <= tol);
  const As = []; for (let a = 0; a <= 180; a += 2) As.push(a);
  const saf = cv2(items, As, (A, it) => adiff(180 - Math.sign(norm180(sum(it.turns)) || 1) * A, it.key) <= tol);
  const knn = knnTurnOnly(items, tol);
  return { el, f180, fix, saf, knn };
}
