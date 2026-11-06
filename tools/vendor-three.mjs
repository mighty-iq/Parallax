// tools/vendor-three.mjs: bundle a trimmed three.js as a classic-script IIFE (window.THREE).
//
//   npm run vendor                        → vendor/three.min.js + vendor/LICENSE-three.txt (+ size report)
//   node tools/vendor-three.mjs --full    → also vendor/three.full.min.js (plain `export *`), for comparison only
//   node tools/vendor-three.mjs --analyze → which input files take the bytes
//
// Classic script on purpose: <script type="module"> fails on file:// (CORS, opaque origin) and in
// sandboxed srcdoc previews (ARCHITECTURE.md §1). three and esbuild are pinned in package.json.
// Adapted from spike/vendor-three.mjs (spike/RESULTS.md); AnaglyphEffect dropped (no stereo in v1).
import { build } from 'esbuild';
import { writeFileSync, readFileSync, mkdirSync } from 'node:fs';
import { gzipSync, brotliCompressSync } from 'node:zlib';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..');
// three's "exports" map hides its package.json, so read it from disk.
const readPkg = (name) => JSON.parse(readFileSync(path.join(root, 'node_modules', name, 'package.json'), 'utf8'));
const threeVersion = readPkg('three').version;

// Everything the app needs. Add names here, never `export *` (that defeats tree shaking).
// Grouped by purpose so later exercise authors can see what is already available. Measured
// costs of names left out (30 Oct): Sprite + SpriteMaterial 7.3 KiB, Points + PointsMaterial
// 2.1 KiB, MeshPhongMaterial 1.9 KiB, PointLight 0.6 KiB; labels can be CanvasTexture planes.
const CORE = [
  // renderer, scenes, cameras (stage3d owns the one WebGLRenderer)
  'WebGLRenderer', 'WebGLRenderTarget', 'Scene', 'Fog', 'PerspectiveCamera', 'OrthographicCamera', 'StereoCamera',
  // scene graph and drawables
  'Object3D', 'Group', 'Mesh', 'InstancedMesh', 'Line', 'LineLoop', 'LineSegments',
  // geometry (Track, Slice, Views, Orient, Homing, Nets, Fold)
  'BufferGeometry', 'BufferAttribute', 'Float32BufferAttribute', 'EdgesGeometry',
  'BoxGeometry', 'SphereGeometry', 'CylinderGeometry', 'ConeGeometry', 'PlaneGeometry', 'CircleGeometry',
  'RingGeometry', 'TorusGeometry', 'LatheGeometry', 'ExtrudeGeometry', 'ShapeGeometry', 'Shape', 'Path',
  // materials
  'MeshBasicMaterial', 'MeshLambertMaterial', 'MeshStandardMaterial', 'LineBasicMaterial', 'LineDashedMaterial',
  // lights
  'AmbientLight', 'HemisphereLight', 'DirectionalLight',
  // maths and picking
  'Vector2', 'Vector3', 'Vector4', 'Quaternion', 'Matrix3', 'Matrix4', 'Euler', 'Color', 'Spherical',
  'Plane', 'Ray', 'Raycaster', 'Box3', 'Sphere', 'Triangle', 'Line3', 'MathUtils',
  // textures (made in code: no loaders, nothing is fetched at runtime)
  'CanvasTexture', 'DataTexture',
  // constants
  'REVISION', 'SRGBColorSpace', 'LinearSRGBColorSpace', 'NoColorSpace', 'FrontSide', 'BackSide', 'DoubleSide',
];

const banner = `/* three.js r${threeVersion.split('.')[1]} (${threeVersion}) subset, MIT License, https://threejs.org - built by tools/vendor-three.mjs */`;

async function bundle(contents, outfile) {
  const res = await build({
    stdin: { contents, resolveDir: root, sourcefile: 'three-entry.js', loader: 'js' },
    metafile: process.argv.includes('--analyze'),
    outfile,
    bundle: true,
    format: 'iife',
    globalName: 'THREE',
    minify: true,
    // es2020 lowers class static blocks (Safari < 16.4, used by three r16x+ core) and
    // leaves nothing newer than iOS 14 / Chrome 80 can parse.
    target: ['es2020'],
    legalComments: 'none',
    banner: { js: banner },
    absWorkingDir: root,
    logLevel: 'warning',
  });
  if (res.metafile) {
    const inputs = Object.entries(res.metafile.outputs)[0][1].inputs;
    const top = Object.entries(inputs).map(([f, v]) => [f.replace(/.*node_modules\/three\//, ''), v.bytesInOutput])
      .sort((a, b) => b[1] - a[1]).slice(0, 15);
    console.log(`top inputs of ${path.basename(outfile)} (bytes in minified output):`);
    for (const [f, b] of top) console.log(`  ${String(b).padStart(7)}  ${f}`);
  }
  const buf = readFileSync(outfile);
  // The single-file build inlines this bundle in a <script>: "</script" would end it early and
  // "<!--" can switch the HTML tokenizer into the double-escaped state.
  const text = buf.toString('utf8');
  if (/<\/script/i.test(text) || text.includes('<!--')) throw new Error(`${outfile} contains </script or <!-- and cannot be inlined`);
  return { file: path.relative(root, outfile), min: buf.length, gzip: gzipSync(buf, { level: 9 }).length,
           brotli: brotliCompressSync(buf).length };
}

const outDir = path.join(root, 'vendor');
mkdirSync(outDir, { recursive: true });
const kb = (n) => (n / 1024).toFixed(1) + ' KiB';
const results = [await bundle(`export { ${CORE.join(', ')} } from 'three';\n`, path.join(outDir, 'three.min.js'))];
if (process.argv.includes('--full')) results.push(await bundle(`export * from 'three';\n`, path.join(outDir, 'three.full.min.js')));

// three.js is MIT: ship its licence next to the bundle.
writeFileSync(path.join(outDir, 'LICENSE-three.txt'), readFileSync(path.join(root, 'node_modules/three/LICENSE')));

console.log(`three ${threeVersion}, esbuild ${readPkg('esbuild').version}, ${CORE.length} names`);
for (const r of results) console.log(`${r.file}: min ${kb(r.min)} (${r.min} B), gzip ${kb(r.gzip)}, brotli ${kb(r.brotli)}`);
