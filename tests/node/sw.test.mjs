/* sw.js (O21, PLAN milestone 9): the service worker's logic in a node:vm context, with an in-memory Cache Storage
   and a fake GitHub Pages host that serves the repository's own files (ETags, or none). The browser test
   tests/e2e/sw.py runs the real worker in Chromium; this file keeps its rules in the CI suite:
   - install keeps exactly the app's own files (index.html, every stylesheet and script it loads outside comments,
     the fonts their url()s name, the manifest and its icons) in one copy named after PX.version, marked last;
   - what it answers: a navigation to the app (the scope, index.html, any query) and the app's files of this
     origin and scope; never another origin, another path, dist/, docs/, tests/, a query, a POST or a range;
   - answers come from the copy with the host gone; a launch's check writes a new copy when a file changed
     (ETags, or bytes without them) or index.html lists another file, drops the old one, and keeps the copy when
     nothing changed or when the host fails part-way; a copy without its mark, of another format or of another
     scope is never used, and only this scope's copies are ever deleted;
   - a new worker keeps the complete copy it finds. */
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const SRC = fs.readFileSync(path.join(ROOT, 'sw.js'), 'utf8');
const ORIGIN = 'https://host.test', SCOPE = ORIGIN + '/Parallax/';

// ---------- fakes ----------

class FakeCache {
  constructor() { this.map = new Map(); }
  static key(k) { return typeof k === 'string' ? k : k.url; }
  async put(k, res) {
    if (this.failOn && this.failOn(FakeCache.key(k))) throw new Error('QuotaExceededError (test)');
    const body = new Uint8Array(await res.arrayBuffer());
    this.map.set(FakeCache.key(k), { body, status: res.status, headers: [...res.headers] });
  }
  async match(k) {
    const e = this.map.get(FakeCache.key(k));
    return e ? new Response(e.body, { status: e.status, headers: e.headers }) : undefined;
  }
  async keys() { return [...this.map.keys()].map((url) => ({ url })); }
}
class FakeCaches {
  constructor() { this.byName = new Map(); }
  async keys() { return [...this.byName.keys()]; }
  async open(n) { if (!this.byName.has(n)) { const c = new FakeCache(); c.failOn = this.failOn; this.byName.set(n, c); } return this.byName.get(n); }
  async has(n) { return this.byName.has(n); }
  async delete(n) { return this.byName.delete(n); }
  async match(k, o = {}) {
    if (o.cacheName !== undefined) { const c = this.byName.get(o.cacheName); return c ? c.match(k) : undefined; }
    for (const c of this.byName.values()) { const r = await c.match(k); if (r) return r; }
    return undefined;
  }
}

// A host serving the repository's files under /Parallax/; edits, an ETag switch, outages and request counts.
class Host {
  constructor() { this.over = new Map(); this.etags = true; this.down = false; this.missing = new Set(); this.n = 0; this.seen = []; this.rev = new Map(); }
  body(rel) {
    if (this.over.has(rel)) return this.over.get(rel);
    const abs = path.join(ROOT, rel);
    return fs.existsSync(abs) && fs.statSync(abs).isFile() ? fs.readFileSync(abs) : null;
  }
  edit(rel, fn) { const b = this.body(rel); this.over.set(rel, Buffer.from(fn(b.toString('utf8')))); this.rev.set(rel, (this.rev.get(rel) || 0) + 1); }
  fetch(req) {
    const url = typeof req === 'string' ? req : req.url;
    this.n++; this.seen.push(url);
    if (this.down) return Promise.reject(new TypeError('Failed to fetch (test: offline)'));
    const u = new URL(url);
    if (u.origin !== ORIGIN || !u.pathname.startsWith('/Parallax/')) return Promise.resolve(new Response('not found', { status: 404 }));
    const rel = u.pathname.slice('/Parallax/'.length) || 'index.html', b = this.missing.has(rel) ? null : this.body(rel);
    if (!b) return Promise.resolve(new Response('not found', { status: 404 }));
    const h = { 'Content-Type': 'text/plain' };
    if (this.etags) h.ETag = `"${rel}-${this.rev.get(rel) || 0}"`;
    return Promise.resolve(new Response(b, { status: 200, headers: h }));
  }
}

// A worker: sw.js evaluated in its own context over shared caches and host (a new sw.js is a second worker).
function worker(env) {
  const handlers = {}, calls = { skipWaiting: 0 };
  const self = {
    registration: { scope: SCOPE }, location: { origin: ORIGIN },
    addEventListener: (type, fn) => { handlers[type] = fn; },
    skipWaiting: () => { calls.skipWaiting++; return Promise.resolve(); },
  };
  const ctx = vm.createContext({
    self, caches: env.caches, fetch: (r) => env.host.fetch(r), Request, Response, Headers, URL,
    setTimeout: (fn) => setImmediate(fn), Date: { now: () => (env.clock += 1) }, console,
  });
  vm.runInContext(SRC, ctx, { filename: 'sw.js' });
  return { handlers, calls };
}
function env() { return { caches: new FakeCaches(), host: new Host(), clock: Date.UTC(2026, 10, 19, 12, 0, 0) }; }

async function install(w) {
  const waits = [];
  w.handlers.install({ waitUntil: (p) => waits.push(p) });
  await Promise.all(waits);
}
async function activate(w) {
  const waits = [];
  w.handlers.activate({ waitUntil: (p) => waits.push(p) });
  await Promise.all(waits);
}
// A fetch event → { answered, res (a Response or an error), waits }.
async function request(w, url, o = {}) {
  const ev = { request: { url, method: o.method || 'GET', mode: o.mode || 'no-cors', headers: new Headers(o.headers || {}) } };
  let answer = null;
  const waits = [];
  ev.respondWith = (p) => { answer = Promise.resolve(p); };
  ev.waitUntil = (p) => { waits.push(Promise.resolve(p)); };
  w.handlers.fetch(ev);
  let res = null;
  if (answer) { try { res = await answer; } catch (e) { res = e; } }
  return { answered: !!answer, res, waits };
}
const launch = async (w, q = '') => { const r = await request(w, SCOPE + q, { mode: 'navigate' }); await Promise.all(r.waits); return r; };
async function copies(E) {
  const out = [];
  for (const name of await E.caches.keys()) {
    const c = E.caches.byName.get(name), mk = await c.match(SCOPE + '__parallax-copy__.json');
    out.push({ name, mark: mk ? await mk.json() : null, n: c.map.size });
  }
  return out;
}
const text = async (r) => (r && typeof r.text === 'function' ? r.text() : null);

// The files the copy must hold, found here on their own: index.html's active stylesheets and scripts, the url()s
// of those stylesheets, the manifest, its icons and the touch icon.
function expected() {
  const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8').replace(/<!--[\s\S]*?-->/g, '');
  const css = [...html.matchAll(/<link rel="stylesheet" href="([^"]+)">/g)].map((m) => m[1]);
  const js = [...html.matchAll(/<script src="([^"]+)"><\/script>/g)].map((m) => m[1]);
  const assets = [];
  for (const f of css) {
    for (const m of fs.readFileSync(path.join(ROOT, f), 'utf8').matchAll(/url\(\s*(['"]?)([^'")]+)\1\s*\)/g)) {
      if (/^(data:|https?:|#)/.test(m[2])) continue;
      assets.push(path.posix.normalize(path.posix.join(path.posix.dirname(f), m[2])));
    }
  }
  const man = JSON.parse(fs.readFileSync(path.join(ROOT, 'manifest.webmanifest'), 'utf8'));
  const icons = man.icons.map((i) => i.src).concat(['icons/apple-touch-icon.png']);
  return [...new Set(['index.html', 'manifest.webmanifest', ...css, ...js, ...assets, ...icons])].sort();
}

export async function run(t) {
  const version = (fs.readFileSync(path.join(ROOT, 'js/core/px.js'), 'utf8').match(/PX\.version\s*=\s*'([^']+)'/) || [])[1];

  t.section('sw.js: install');
  let E = env(), w = worker(E);
  t.ok(['install', 'activate', 'fetch'].every((k) => typeof w.handlers[k] === 'function'), 'install, activate and fetch handlers');
  await install(w);
  let cs = await copies(E);
  const want = expected();
  t.ok(cs.length === 1 && cs[0].name.startsWith(`parallax-${version}-`) && cs[0].name.endsWith('@/Parallax/'), `one copy, named after PX.version (${cs[0] && cs[0].name})`);
  t.eq(cs[0].mark && cs[0].mark.files, want, `it holds the app's ${want.length} files: index.html, its stylesheets and scripts, their fonts, the manifest and its icons`);
  t.ok(cs[0].mark.format === 1 && cs[0].mark.version === version && cs[0].n === want.length + 1, 'its mark: format 1, the version, the file list (written last)');
  t.ok(want.some((f) => f.startsWith('fonts/')) && want.includes('vendor/three.min.js') && want.includes('js/ui/app.js') && !want.some((f) => /^(dist|docs|tests)\//.test(f)), 'fonts, three.js and app.js in; nothing of dist/, docs/ or tests/');
  t.ok(E.host.seen.every((u) => u.startsWith(SCOPE)), 'every request of the worker stays on this origin and inside the scope');
  t.eq(w.calls.skipWaiting, 1, 'takes over once installed (skipWaiting)');
  const raw = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
  const commented = [...(raw.match(/<!--[\s\S]*?-->/g) || []).join(' ').matchAll(/<script src="([^"]+)"/g)].map((m) => m[1]).filter((x) => !want.includes(x));
  t.ok(commented.every((x) => !cs[0].mark.files.includes(x)), `scripts named only inside comments (${commented.length}, PENDING lines) are left out`);

  t.section('sw.js: what it answers');
  const cases = [
    ['a launch at the scope', SCOPE, { mode: 'navigate' }, true],
    ['a launch at index.html with a query', SCOPE + 'index.html?c=ABC#/home', { mode: 'navigate' }, true],
    ['a script', SCOPE + 'js/core/px.js', {}, true],
    ['a font', SCOPE + want.find((f) => f.startsWith('fonts/')), { mode: 'cors' }, true],
    ['the manifest', SCOPE + 'manifest.webmanifest', {}, true],
    ['the single-file build (a page of the scope)', SCOPE + 'dist/Parallax.html', { mode: 'navigate' }, false],
    ['the guide', SCOPE + 'docs/Parallax-Guide.pdf', { mode: 'navigate' }, false],
    ['the dev harness', SCOPE + 'tests/dev/harness.html', { mode: 'navigate' }, false],
    ['sw.js itself', SCOPE + 'sw.js', {}, false],
    ['a file with a query', SCOPE + 'js/core/px.js?v=2', {}, false],
    ['another origin', 'https://cdn.test/Parallax/js/core/px.js', {}, false],
    ['another path of the origin', ORIGIN + '/Other/js/core/px.js', {}, false],
    ['a POST', SCOPE + 'js/core/px.js', { method: 'POST' }, false],
    ['a range request', SCOPE + 'vendor/three.min.js', { headers: { Range: 'bytes=0-9' } }, false],
  ];
  const wrong = [];
  for (const [what, url, o, yes] of cases) if ((await request(w, url, o)).answered !== yes) wrong.push(what);
  t.eq(wrong, [], 'answers launches and the app\'s own files, nothing else (' + cases.length + ' kinds of request)');

  t.section('sw.js: answers from the copy');
  E.host.down = true;
  E.host.edit('js/core/px.js', (s) => s + '\n// changed\n');
  let r = await launch(w);
  t.ok(/<script src="js\/ui\/app\.js"><\/script>/.test(await text(r.res)), 'a launch with the host gone gets index.html from the copy');
  r = await request(w, SCOPE + 'js/core/px.js');
  t.ok(!(await text(r.res)).includes('// changed'), 'and every file the copy holds');
  r = await request(w, SCOPE + 'js/ex/nosuch/gen.js');
  t.ok(r.answered && r.res instanceof Error, 'a file the copy lacks goes to the network (here: down)');
  E.host.down = false;

  t.section('sw.js: updates at launch');
  // the edit above (no new version number): this launch runs on the copy; its check writes the next copy
  let before = (await copies(E))[0].name;
  E.clock += 11000;
  r = await launch(w);
  cs = await copies(E);
  t.ok(cs.length === 1 && cs[0].name !== before && cs[0].name.startsWith(`parallax-${version}-`), 'a changed file (another ETag): the launch\'s check writes a new copy and drops the old one');
  r = await request(w, SCOPE + 'js/core/px.js');
  t.ok((await text(r.res)).includes('// changed'), 'the new copy answers from then on');
  before = cs[0].name;
  E.clock += 11000;
  await launch(w);
  t.eq((await copies(E)).map((c) => c.name), [before], 'nothing changed: the copy stays');
  E.host.edit('js/core/px.js', (s) => s + '\n// twice\n');
  E.clock += 3000;
  await launch(w);
  t.eq((await copies(E)).map((c) => c.name), [before], 'a second launch within 10 s does not check again');
  E.clock += 11000;
  await launch(w);
  t.ok((await copies(E))[0].name !== before, 'after 10 s it does');
  // a new version number names the copy
  before = (await copies(E))[0].name;
  E.host.edit('js/core/px.js', (s) => s.replace(`PX.version = '${version}'`, `PX.version = '${version}.next'`));
  E.clock += 11000;
  await launch(w);
  cs = await copies(E);
  t.ok(cs.length === 1 && cs[0].name.startsWith(`parallax-${version}.next-`) && cs[0].mark.version === version + '.next', `a new PX.version: the copy is named after it (${cs[0].name})`);
  // index.html lists another file
  E.host.edit('index.html', (s) => s.replace('<script src="js/ui/app.js"></script>', '<script src="js/ui/extra.js"></script>\n<script src="js/ui/app.js"></script>'));
  E.host.over.set('js/ui/extra.js', Buffer.from('/* a new file */'));
  E.clock += 11000;
  await launch(w);
  cs = await copies(E);
  t.ok(cs.length === 1 && cs[0].mark.files.includes('js/ui/extra.js') && cs[0].mark.files.length === want.length + 1, 'index.html lists a new script: the next copy holds it');
  // the host fails part-way: no new copy, the old one stays whole
  before = cs[0].name;
  E.host.edit('js/core/util.js', (s) => s + '\n// changed\n');
  E.host.missing.add('js/ui/home.js');
  E.clock += 11000;
  await launch(w);
  cs = await copies(E);
  t.ok(cs.length === 1 && cs[0].name === before && cs[0].n === cs[0].mark.files.length + 1, 'a file missing on the host: no new copy, the old one stays whole');
  E.host.missing.clear();
  // a write that fails (storage full): the half-written cache is deleted, the old copy stays
  E.caches.failOn = (k) => k.endsWith('js/ui/play.js');
  E.clock += 11000;
  await launch(w);
  cs = await copies(E);
  t.ok(cs.length === 1 && cs[0].name === before, 'a write that fails (storage full): what it wrote is deleted, the old copy stays');
  E.caches.failOn = null;
  E.clock += 11000;
  await launch(w);
  cs = await copies(E);
  t.ok(cs.length === 1 && cs[0].name !== before, 'and the next launch writes the copy');

  t.section('sw.js: without ETags');
  E = env(); E.host.etags = false; w = worker(E);
  await install(w);
  before = (await copies(E))[0].name;
  E.clock += 11000;
  await launch(w);
  t.eq((await copies(E)).map((c) => c.name), [before], 'unchanged files (compared byte by byte): the copy stays');
  E.host.edit('css/app.css', (s) => s.replace(/.$/s, ' '));
  E.clock += 11000;
  await launch(w);
  cs = await copies(E);
  t.ok(cs.length === 1 && cs[0].name !== before, 'one byte changed in a stylesheet: a new copy');

  t.section('sw.js: other caches, half copies, a new worker');
  E = env();
  const foreign = await E.caches.open('other-tool-v3');
  await foreign.put('https://host.test/Other/index.html', new Response('x'));
  const otherScope = await E.caches.open('parallax-1.1.0-abc@/Fork/');
  await otherScope.put(ORIGIN + '/Fork/index.html', new Response('y'));
  const half = await E.caches.open(`parallax-${version}-zzzz@/Parallax/`);
  await half.put(SCOPE + 'index.html', new Response('half'));
  const old = await E.caches.open('parallax-1.0.0-yyyy@/Parallax/');
  await old.put(SCOPE + '__parallax-copy__.json', new Response(JSON.stringify({ format: 2, version: '1.0.0', files: ['index.html'], made: 1 })));
  w = worker(E);
  await install(w);
  await activate(w);
  const names = await E.caches.keys();
  cs = await copies(E);
  t.ok(names.includes('other-tool-v3') && names.includes('parallax-1.1.0-abc@/Fork/'), 'another tool\'s cache and a copy of another scope on the origin stay');
  t.ok(!names.includes(`parallax-${version}-zzzz@/Parallax/`) && !names.includes('parallax-1.0.0-yyyy@/Parallax/'), 'a copy without its mark and one of another format are never used and are dropped');
  const mineNow = cs.filter((c) => c.name.endsWith('@/Parallax/'));
  t.ok(mineNow.length === 1 && mineNow[0].mark && mineNow[0].mark.format === 1, 'one complete copy of this scope');
  const n0 = E.host.n, kept = mineNow[0].name;
  const w2 = worker(E); // a new sw.js
  await install(w2);
  await activate(w2);
  t.ok(E.host.n === n0 && (await E.caches.keys()).includes(kept) && w2.calls.skipWaiting === 1, 'a new worker keeps the complete copy it finds (no download) and takes over');
  E.host.down = true;
  r = await launch(w2);
  t.ok(/js\/ui\/app\.js/.test(await text(r.res)), 'and answers launches from it with the host gone');
}
