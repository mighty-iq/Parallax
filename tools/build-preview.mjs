// build-preview.mjs: the page for a private test-build preview in the Claude artifact host.
//   node tools/build-single.mjs && node tools/build-preview.mjs [--in dist/Parallax.html] [--out dist/preview/index.html]
// Copies dist/Parallax.html, adds tools/preview-adapter.js before </body> (it saves the playtest
// report to the host's database, see its header) and writes the result to dist/preview/, which
// git ignores. It refuses a build whose playtest mode is not on by default (BUILD 'test').
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const argOut = process.argv.indexOf('--out');
const OUT = path.resolve(ROOT, argOut > 0 ? process.argv[argOut + 1] : 'dist/preview/index.html');
const argIn = process.argv.indexOf('--in');
const SINGLE = path.resolve(ROOT, argIn > 0 ? process.argv[argIn + 1] : 'dist/Parallax.html');

const html = readFileSync(SINGLE, 'utf8');
if (!/var BUILD = 'test';/.test(html)) {
  console.error('build-preview: ' + path.relative(ROOT, SINGLE) + ' is not a test build (js/ui/playtest.js BUILD must be \'test\')');
  process.exit(1);
}
const adapter = readFileSync(path.join(ROOT, 'tools/preview-adapter.js'), 'utf8')
  .replace(/<\/script/gi, '<\\/script').replace(/<!--/g, '<\\!--');
const at = html.lastIndexOf('</body>');
if (at < 0) { console.error('build-preview: no </body> in dist/Parallax.html'); process.exit(1); }
const out = html.slice(0, at) + '<script>\n' + adapter + '</script>\n' + html.slice(at);
mkdirSync(path.dirname(OUT), { recursive: true });
writeFileSync(OUT, out);
const version = (html.match(/PX\.version\s*=\s*'([^']+)'/) || [])[1] || '?';
console.log(`build-preview: ${path.relative(ROOT, OUT)} (${(out.length / 1024).toFixed(0)} KB, version ${version})`);
