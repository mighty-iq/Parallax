const deg = (r) => r * 180 / Math.PI, rad = (d) => d * Math.PI / 180;
const fov = (w, d) => 2 * deg(Math.atan(w / 2 / d));
console.log('Lakshminarasimhan 2018 screen 149x127 cm at 67.5 cm:', fov(149, 67.5).toFixed(1), 'x', fov(127, 67.5).toFixed(1), 'deg');
console.log('Stavropoulos 2022 screen 158x94 cm at 77 cm (rear of head; eyes nearer => wider):', fov(158, 77).toFixed(1), 'x', fov(94, 77).toFixed(1), 'deg; at 60 cm:', fov(158, 60).toFixed(1), 'x', fov(94, 60).toFixed(1));
// Raised-cosine ramp 0 -> v over T s: a(t) = (pi v / 2T) sin(pi t / T): peak pi v / 2T; jerk peak pi^2 v / 2T^2
for (const [v, T, u] of [[1.8, 0.4, 'm/s'], [2.0, 0.4, 'm/s'], [1.2, 0.6, 'm/s'], [45, 0.4, 'deg/s'], [30, 0.6, 'deg/s']]) console.log(`ramp 0->${v} ${u} in ${T} s: peak accel ${(Math.PI * v / (2 * T)).toFixed(2)} ${u}/s, mean ${(v / T).toFixed(2)}`);
// Reckon fade distance (homing kit): sqrt(med*eye*pxPerRad/3) clamped 8..28; med 0.6 (blobs), eye 1.6, hfov 70
for (const [name, wCss, dpr] of [['phone portrait 360 css px, dpr 2', 360, 2], ['phone landscape 740 px, dpr 2', 740, 2], ['desktop 900 px, dpr 1', 900, 1], ['desktop 1200 px, dpr 2', 1200, 2]]) {
  const pxPerRad = wCss * dpr / rad(70), far = Math.min(28, Math.max(8, Math.sqrt(0.6 * 1.6 * pxPerRad / 3)));
  // visible ground area within far, +-35 deg, beyond the near edge (pitch -10, vfov from aspect 16:10 band)
  const vf = 2 * deg(Math.atan(Math.tan(rad(35)) / 1.6)), lower = 10 + vf / 2, near = 1.6 / Math.tan(rad(lower));
  const area = (70 / 360) * Math.PI * (far * far - near * near);
  console.log(`${name}: fade end ${far.toFixed(1)} m, near edge ${near.toFixed(1)} m, ground in view ~${area.toFixed(0)} m2 -> textured ${(0.35 * area).toFixed(0)}, sparse ${(0.12 * area).toFixed(0)} marks`);
}
// Lakshminarasimhan: 96 deg wide, eye 1 m; elements 2.5 or 0.1 per m2 within e.g. 10 m and 20 m
for (const R of [10, 20]) { const area = (96 / 360) * Math.PI * R * R; console.log(`Lak 2018 within ${R} m: area ${area.toFixed(0)} m2 -> dense ${(2.5 * area).toFixed(0)}, sparse ${(0.1 * area).toFixed(0)} elements`); }
// visual angle of a phone/desktop view
for (const [name, wcm, dcm] of [['phone portrait band 6.5 cm at 30 cm', 6.5, 30], ['phone landscape view 12 cm at 30 cm', 12, 30], ['tablet 18 cm at 40 cm', 18, 40], ['desktop view 35 cm at 60 cm', 35, 60], ['24in monitor full width 53 cm at 60 cm', 53, 60]]) console.log(`${name}: ${fov(wcm, dcm).toFixed(1)} deg of visual angle (geometric field 70 deg)`);
// Reliability: Spearman-Brown, per-trial reliability from McLaren (6 trials r < .5)
const r6 = 0.5, r1 = r6 / (6 - 5 * r6); console.log('per-trial reliability if 6 trials give .5:', r1.toFixed(3));
for (const target of [0.7, 0.8, 0.9]) console.log(`trials for reliability ${target}: ${Math.ceil(target * (1 - r1) / (r1 * (1 - target)))}`);
// fixed-distance shortcut, log-uniform d in [a,b], tolerance tau: ln((1+tau)/(1-tau))/ln(b/a)
for (const [a, b] of [[5, 20], [3, 20], [4, 30]]) console.log(`d log-uniform ${a}-${b} m:`, [0.5, 0.35, 0.25, 0.2].map((t) => (100 * Math.min(1, Math.log((1 + t) / (1 - t)) / Math.log(b / a))).toFixed(0) + '% at tau ' + t).join(', '));
