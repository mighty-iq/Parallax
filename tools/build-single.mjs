// build-single.mjs: inline index.html into one self-contained file (dist/Parallax.html).
//   node tools/build-single.mjs [--out dist/Parallax.html]
// Every active <link rel="stylesheet"> becomes a <style> (fonts and other url() assets as data
// URIs) and every active <script src> becomes an inline script, in the page's own order.
// Commented PENDING blocks are left out. The result works from disk, on any static host and
// inside sandboxed previews (srcdoc), where nothing can be loaded from a relative path.
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { gzipSync } from 'node:zlib';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const argOut = process.argv.indexOf('--out');
const OUT = path.resolve(ROOT, argOut > 0 ? process.argv[argOut + 1] : 'dist/Parallax.html');
const MIME = { '.woff2': 'font/woff2', '.woff': 'font/woff', '.png': 'image/png', '.svg': 'image/svg+xml', '.jpg': 'image/jpeg' };

function read(rel) {
  const abs = path.join(ROOT, rel);
  if (!existsSync(abs)) throw new Error('missing file referenced by index.html: ' + rel);
  return readFileSync(abs, 'utf8');
}

// url("../fonts/x.woff2") inside css/<…>.css → data URI (paths resolve against the CSS file).
function inlineCss(rel) {
  const dir = path.dirname(rel);
  return read(rel).replace(/url\(\s*(['"]?)([^'")]+)\1\s*\)/g, (m, q, url) => {
    if (/^(data:|https?:|#)/.test(url)) return m;
    const assetRel = path.normalize(path.join(dir, url));
    const ext = path.extname(assetRel).toLowerCase();
    if (!MIME[ext]) throw new Error('no MIME type for ' + assetRel);
    const b64 = readFileSync(path.join(ROOT, assetRel)).toString('base64');
    return `url("data:${MIME[ext]};base64,${b64}")`;
  });
}

// Inside an inline <script>, "</script" would end the element and "<!--" can switch the HTML
// parser into an escaped state. Both rewrites keep the JavaScript meaning ("<\/" and "<\!" are
// the same characters inside strings and regular expressions).
function safeScript(src) {
  return src.replace(/<\/script/gi, '<\\/script').replace(/<!--/g, '<\\!--');
}

let html = read('index.html');
const version = (read('js/core/px.js').match(/PX\.version\s*=\s*'([^']+)'/) || [])[1] || '?';
html = html.replace(/<!--[\s\S]*?-->/g, (c) => (/PENDING/.test(c) ? '' : c)); // drop pending blocks

let nCss = 0, nJs = 0;
html = html.replace(/<link rel="stylesheet" href="([^"]+)">/g, (m, href) => {
  nCss++;
  return `<style data-src="${href}">\n${inlineCss(href)}\n</style>`;
});
html = html.replace(/<script src="([^"]+)"><\/script>/g, (m, src) => {
  nJs++;
  return `<script data-src="${src}">\n${safeScript(read(src))}\n</script>`;
});
if (/<(link rel="stylesheet"|script src=)/.test(html)) throw new Error('a stylesheet or script was not inlined');

const stamp = `<!-- Parallax ${version}, single-file build ${new Date().toISOString().slice(0, 10)}. Built by the Chimera community on Discord: https://discord.gg/chmr. Source: index.html + tools/build-single.mjs. Code MIT; three.js MIT; IBM Plex SIL OFL 1.1. -->\n`;
html = html.replace(/^<!doctype html>\n?/i, (d) => d + stamp);

mkdirSync(path.dirname(OUT), { recursive: true });
writeFileSync(OUT, html);
const kb = (n) => (n / 1024).toFixed(0) + ' KiB';
console.log(`wrote ${path.relative(ROOT, OUT)}: ${nCss} stylesheets and ${nJs} scripts inlined, ${kb(Buffer.byteLength(html))} (${kb(gzipSync(html).length)} gzip)`);
