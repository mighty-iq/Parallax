#!/usr/bin/env node
/* Parallax node tests (ARCHITECTURE.md §12).   node tests/node/run.mjs [name-filter …]

   1. Load check: the pure files (MANIFEST below, then every js/ex/<id>/gen.js, then every
      js/ex/<id>/learn.js, ids sorted) run as classic scripts in a node:vm context whose
      `window` is a plain object: no document, no timers, no storage, and Math.random throws.
      Load errors, globals other than PX, and Math.random in their source are failures.
   2. Every tests/node/*.test.mjs (sorted, filtered by the arguments) exports
      `async function run(t)`. The t object:
        t.ok(cond, msg)   t.eq(actual, expected, msg) (deep, works across realms)
        t.near(a, b, tol, msg)   t.throws(fn, pattern?, msg) → error   t.rejects(p, pattern?, msg)
        t.section(name)   prefixes later failure messages
        t.PX              PX of a fresh pure context for this file (define test exercises freely)
        t.context(opts)   another fresh context (see createContext)
        t.env(opts)       a context that also loads store.js with a fake localStorage, a
                          minimal fake document, fake timers and a fake clock
        t.root            the repo root (parallax/)
   Exported for other scripts (sim.mjs): ROOT, MANIFEST, pureFiles, createContext,
   FakeClock, SharedStorage, deepDiff. */
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { performance } from 'node:perf_hooks';

const HERE = path.dirname(fileURLToPath(import.meta.url));
export const ROOT = path.resolve(HERE, '../..');

/* ---------- manifest ---------- */

// Pure files in the order of ARCHITECTURE.md §3. Later agents extend it: engine files go
// in the ENGINE block in load order (§2 lists model, estimator, select, staircase, bandit,
// schedule, modes, assess, xp, achievements, streak, daily, stats). bus.js is DOM-free and
// loaded so that engine code may emit events. Exercise files are discovered, not listed.
export const MANIFEST = [
  'js/core/px.js',
  'js/core/util.js',
  'js/core/rng.js',
  'js/core/bus.js',
  // ENGINE (load order):
  'js/engine/model.js',
  'js/engine/estimator.js',
  'js/engine/select.js',
  'js/engine/staircase.js',
  'js/engine/bandit.js',
  'js/engine/schedule.js',
  'js/engine/modes.js',
  'js/engine/assess.js',
  'js/engine/achievements.js',
  'js/engine/streak.js',
  'js/engine/daily.js',
  'js/engine/stats.js',
  'js/engine/merge.js',
  'js/engine/section.js',
  // ENGINE end
  'js/ex/registry.js',
];

// Loaded only by t.env() / createContext({ store: true }), right after bus.js.
export const STORE_FILE = 'js/core/store.js';

function exerciseFiles(name) {
  const dir = path.join(ROOT, 'js/ex');
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => d.name)
    .sort()
    .map((id) => `js/ex/${id}/${name}`)
    .filter((rel) => fs.existsSync(path.join(ROOT, rel)));
}

export function pureFiles() {
  return [...MANIFEST, ...exerciseFiles('gen.js'), ...exerciseFiles('learn.js')];
}

/* ---------- fakes ---------- */

export const T0 = Date.UTC(2026, 9, 30, 12, 0, 0); // fake clock start

// setTimeout / clearTimeout / Date.now under test control: tick(ms) runs due timers in order.
export class FakeClock {
  constructor(now = T0) { this.now = now; this.timers = []; this.seq = 0; }
  setTimeout(fn, ms) {
    const id = ++this.seq;
    this.timers.push({ id, at: this.now + Math.max(0, Number(ms) || 0), fn });
    return id;
  }
  clearTimeout(id) { this.timers = this.timers.filter((x) => x.id !== id); }
  pending() { return this.timers.length; }
  tick(ms = 0) {
    const end = this.now + ms;
    for (let guard = 0; ; guard++) {
      if (guard > 100000) throw new Error('FakeClock.tick: timers keep rescheduling themselves');
      let next = null;
      for (const x of this.timers) {
        if (x.at <= end && (!next || x.at < next.at || (x.at === next.at && x.id < next.id))) next = x;
      }
      if (!next) break;
      this.timers.splice(this.timers.indexOf(next), 1);
      this.now = Math.max(this.now, next.at);
      next.fn();
    }
    this.now = end;
  }
}

// One localStorage shared by several fake tabs. A write fires a `storage` event in every
// other tab, delivered through that tab's clock (tick(0)), as browsers deliver it later.
// failWrites makes setItem throw QuotaExceededError; muted drops the events.
export class SharedStorage {
  constructor(init = {}) {
    this.map = new Map(Object.entries(init));
    this.failWrites = false;
    this.muted = false;
    this.tabs = [];
    this.writes = 0;
  }
  attach(tab) {
    const self = this;
    const facade = {
      get length() { return self.map.size; },
      key(i) { const k = [...self.map.keys()][i]; return k === undefined ? null : k; },
      getItem(k) { k = String(k); return self.map.has(k) ? self.map.get(k) : null; },
      setItem(k, v) { self.set(tab, String(k), String(v)); },
      removeItem(k) { self.set(tab, String(k), null); },
      clear() { for (const k of [...self.map.keys()]) self.set(tab, k, null); },
    };
    this.tabs.push({ tab, facade });
    return facade;
  }
  get(k) { return this.map.has(k) ? this.map.get(k) : null; }
  set(origin, k, v) {
    if (v !== null && this.failWrites) {
      const e = new Error('The quota has been exceeded.');
      e.name = 'QuotaExceededError';
      throw e;
    }
    const old = this.get(k);
    if (v === null) this.map.delete(k); else this.map.set(k, v);
    this.writes++;
    if (old === v || this.muted) return; // browsers fire only on a change
    for (const { tab, facade } of this.tabs) {
      if (tab === origin) continue;
      tab.clock.setTimeout(() => tab.dispatch('storage', { key: k, oldValue: old, newValue: v, storageArea: facade }), 0);
    }
  }
}

function eventTarget() {
  const handlers = new Map();
  return {
    add(type, fn) { if (!handlers.has(type)) handlers.set(type, []); handlers.get(type).push(fn); },
    remove(type, fn) {
      const list = handlers.get(type);
      const i = list ? list.indexOf(fn) : -1;
      if (i >= 0) list.splice(i, 1);
    },
    dispatch(type, ev = {}) {
      for (const fn of [...(handlers.get(type) || [])]) fn(Object.assign({ type }, ev));
    },
    count(type) { return (handlers.get(type) || []).length; },
  };
}

/* ---------- contexts ---------- */

const POISON = "Math.random = function () { throw new Error('Math.random is not allowed in Parallax pure files: use PX.rng'); };";

/* createContext(opts) → { ctx, window, PX, files, events, run(code), loadErrors }
   opts.files: list of repo-relative files (default pureFiles()); opts.exercises: false loads
   the MANIFEST alone (no exercise files: for tests that define their own); opts.store: also load
   store.js with fakes, adding { clock, storage, document, dispatch(type, ev), setHidden(h) }.
   opts.storage (with store): 'ok' (default: a fresh SharedStorage), a SharedStorage to
   share with other tabs, 'throw' (reading window.localStorage throws SecurityError, as in
   a sandboxed iframe) or 'null'. opts.now: fake clock start (ms). opts.afterStore(PX, env):
   runs right after store.js loads, before the files after it (register store fields and
   settings there, as a later script would). events: every PX.bus event, recorded from the
   moment bus.js loads. opts.strict (default true): throw on a load error. */
// Core files and the registry must load for any test to mean anything; engine and exercise
// files only fail the tests that use them.
export function isStrictFile(rel) { return rel.startsWith('js/core/') || rel === 'js/ex/registry.js'; }

// Global lookups inside a node:vm context go through the sandbox's interceptors and cost about
// 60× more than in a browser (2.7 s vs 46 ms per million Math calls), which distorts timings
// and slows every test. Binding the hot built-ins as parameters makes them plain local lookups.
// The prefix shares line 1 with the source, so stack-trace line numbers stay the same.
const HOT = ['Math', 'Infinity', 'NaN', 'isFinite', 'isNaN', 'Number', 'Object', 'Array', 'JSON', 'String', 'Error', 'RangeError', 'TypeError'];
export function wrapSource(src) {
  return '(function (' + HOT.join(', ') + ') {' + src + '\n})(' + HOT.join(', ') + ');';
}

// 'js/ex/<id>/gen.js' → '<id>'; null for the registry and every non-exercise file.
export function exerciseIdOf(rel) {
  const m = /^js\/ex\/([a-z][a-z0-9-]*)\/[^/]+\.js$/.exec(rel);
  return m ? m[1] : null;
}

export function createContext(opts = {}) {
  const sandbox = { console };
  sandbox.window = sandbox;
  const out = { window: sandbox, events: [], loadErrors: [] };

  if (opts.store) {
    const clock = new FakeClock(opts.now ?? T0);
    const target = eventTarget();
    const docTarget = eventTarget();
    sandbox.setTimeout = (fn, ms) => clock.setTimeout(fn, ms);
    sandbox.clearTimeout = (id) => clock.clearTimeout(id);
    sandbox.addEventListener = target.add;
    sandbox.removeEventListener = target.remove;
    const document = {
      hidden: false,
      visibilityState: 'visible',
      addEventListener: docTarget.add,
      removeEventListener: docTarget.remove,
    };
    sandbox.document = document;
    const tab = { clock, dispatch: target.dispatch };
    const mode = opts.storage ?? 'ok';
    if (mode === 'throw') {
      Object.defineProperty(sandbox, 'localStorage', {
        configurable: true,
        enumerable: true,
        get() {
          const e = new Error("Failed to read the 'localStorage' property from 'Window': The document is sandboxed and lacks the 'allow-same-origin' flag.");
          e.name = 'SecurityError';
          throw e;
        },
      });
    } else if (mode === 'null') {
      sandbox.localStorage = null;
    } else {
      out.storage = mode instanceof SharedStorage ? mode : new SharedStorage();
      sandbox.localStorage = out.storage.attach(tab);
    }
    Object.assign(out, {
      clock,
      document,
      dispatch: target.dispatch,
      listeners: target.count,
      setHidden(h) {
        document.hidden = !!h;
        document.visibilityState = h ? 'hidden' : 'visible';
        docTarget.dispatch('visibilitychange');
      },
    });
  }

  const ctx = vm.createContext(sandbox);
  out.ctx = ctx;
  out.run = (code) => vm.runInContext(code, ctx);
  vm.runInContext(POISON, ctx);
  if (opts.store) vm.runInContext('Date', ctx).now = () => out.clock.now;

  let files = opts.files ? [...opts.files] : opts.exercises === false ? [...MANIFEST] : pureFiles();
  if (opts.store && !files.includes(STORE_FILE)) {
    const at = files.indexOf('js/core/bus.js');
    files.splice(at < 0 ? files.length : at + 1, 0, STORE_FILE);
  }
  out.files = files;

  const allowed = new Set([...Object.keys(sandbox), 'PX']);
  for (const rel of files) {
    const abs = path.join(ROOT, rel);
    try {
      if (!fs.existsSync(abs)) throw new Error('listed in the manifest but missing');
      vm.runInContext(wrapSource(fs.readFileSync(abs, 'utf8')), ctx, { filename: abs });
    } catch (e) {
      out.loadErrors.push(`${rel}: ${e && e.stack ? e.stack.split('\n').slice(0, 3).join(' | ') : e}`);
      // A broken engine or exercise file (often one another agent is still writing) must not
      // break every other test: record it and go on. Only core files and the registry throw.
      const exId = exerciseIdOf(rel);
      if (exId) { out.exerciseErrors = out.exerciseErrors || {}; out.exerciseErrors[exId] = String(e && e.message); }
      if (isStrictFile(rel) && opts.strict !== false) throw new Error(`loading ${rel} failed: ${e && e.message}`, { cause: e });
    }
    for (const k of Object.keys(sandbox)) {
      if (!allowed.has(k)) {
        out.loadErrors.push(`${rel}: defines the global "${k}" (only window.PX is allowed)`);
        allowed.add(k);
      }
    }
    if (rel === 'js/core/bus.js' && sandbox.PX && sandbox.PX.bus) {
      sandbox.PX.bus.on('*', (evt, data) => out.events.push({ evt, data }));
    }
    if (rel === STORE_FILE && typeof opts.afterStore === 'function') opts.afterStore(sandbox.PX, out);
  }
  out.PX = sandbox.PX;
  return out;
}

/* ---------- assertions ---------- */

function fmt(v) {
  if (v === undefined) return 'undefined';
  if (typeof v === 'number') return Object.is(v, -0) ? '-0' : String(v);
  if (typeof v === 'function') return `[function ${v.name || 'anonymous'}]`;
  let s;
  try { s = JSON.stringify(v); } catch { s = String(v); }
  if (s === undefined) s = String(v);
  return s.length > 120 ? s.slice(0, 117) + '…' : s;
}

// First difference between two values as text, or null when deeply equal. Plain objects
// compare by own keys (order ignored); prototypes are ignored, so values from a vm
// context compare equal to the same values made here. NaN equals NaN; 0 equals −0.
export function deepDiff(a, b, at = '') {
  const here = at || 'value';
  if (a === b) return null;
  if (typeof a === 'number' && typeof b === 'number') {
    return Number.isNaN(a) && Number.isNaN(b) ? null : `${here}: ${fmt(a)} !== ${fmt(b)}`;
  }
  if (a === null || b === null || typeof a !== 'object' || typeof b !== 'object') {
    return `${here}: ${fmt(a)} !== ${fmt(b)}`;
  }
  const isArr = Array.isArray(a);
  if (isArr !== Array.isArray(b)) return `${here}: ${isArr ? 'array' : 'object'} vs ${isArr ? 'object' : 'array'}`;
  if (isArr) {
    if (a.length !== b.length) return `${at}.length: ${a.length} !== ${b.length}`;
    for (let i = 0; i < a.length; i++) {
      const d = deepDiff(a[i], b[i], `${at}[${i}]`);
      if (d) return d;
    }
    return null;
  }
  const tag = Object.prototype.toString;
  if (tag.call(a) === '[object Date]' || tag.call(b) === '[object Date]') {
    return tag.call(a) === tag.call(b) && a.getTime() === b.getTime() ? null : `${here}: ${fmt(a)} !== ${fmt(b)}`;
  }
  const ka = Object.keys(a), kb = Object.keys(b);
  for (const k of ka) if (!Object.prototype.hasOwnProperty.call(b, k)) return `${at}.${k}: unexpected key (value ${fmt(a[k])})`;
  for (const k of kb) if (!Object.prototype.hasOwnProperty.call(a, k)) return `${at}.${k}: missing (expected ${fmt(b[k])})`;
  for (const k of ka) {
    const d = deepDiff(a[k], b[k], `${at}.${k}`);
    if (d) return d;
  }
  return null;
}

function makeT() {
  const t = { passed: 0, failed: 0, failures: [], root: ROOT, prefix: '' };
  function fail(msg, detail) {
    t.failed++;
    if (t.failures.length < 25) t.failures.push((t.prefix ? `[${t.prefix}] ` : '') + (msg || 'check failed') + (detail ? ` — ${detail}` : ''));
    return false;
  }
  t.fail = (msg) => fail(msg);
  t.section = (name) => { t.prefix = name || ''; };
  t.ok = (cond, msg) => (cond ? (t.passed++, true) : fail(msg || 'ok() failed'));
  t.eq = (actual, expected, msg) => {
    const d = deepDiff(actual, expected);
    return d === null ? (t.passed++, true) : fail(msg || 'eq() failed', d);
  };
  t.near = (a, b, tol, msg) => {
    const good = typeof a === 'number' && typeof b === 'number' && Math.abs(a - b) <= tol;
    return good ? (t.passed++, true) : fail(msg || 'near() failed', `${fmt(a)} vs ${fmt(b)} (tolerance ${tol})`);
  };
  function matches(e, pattern) {
    if (!pattern) return true;
    const text = String(e && e.message !== undefined ? e.message : e);
    return pattern instanceof RegExp ? pattern.test(text) : text.includes(String(pattern));
  }
  t.throws = (fn, pattern, msg) => {
    try { fn(); } catch (e) {
      if (matches(e, pattern)) { t.passed++; return e; }
      fail(msg || 'throws(): wrong error', `got "${e && e.message}", wanted ${pattern}`);
      return e;
    }
    fail(msg || 'throws(): nothing was thrown');
    return null;
  };
  t.rejects = async (p, pattern, msg) => {
    try { await (typeof p === 'function' ? p() : p); } catch (e) {
      if (matches(e, pattern)) { t.passed++; return e; }
      fail(msg || 'rejects(): wrong error', `got "${e && e.message}", wanted ${pattern}`);
      return e;
    }
    fail(msg || 'rejects(): the promise resolved');
    return null;
  };
  t.context = (opts) => createContext(opts);
  t.env = (opts = {}) => createContext({ ...opts, store: true });
  return t;
}

/* ---------- main ---------- */

function stripComments(src) {
  return src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:\\'"])\/\/.*$/gm, '$1');
}

function loadCheck(filters = []) {
  const t = makeT();
  const files = pureFiles();
  let env = null;
  try {
    env = createContext({ strict: false });
  } catch (e) {
    t.fail('the vm context could not be created: ' + e.message);
  }
  if (env) {
    // With name filters (node tests/node/run.mjs track), broken files of other exercises are
    // shown as warnings, so each author can see their own exercise green while others write.
    for (const err of env.loadErrors) {
      const exId = exerciseIdOf(err.split(':')[0]);
      if (filters.length && exId && !filters.some((x) => exId.includes(x) || x.includes(exId))) {
        console.log(`       ! warning (not counted with a filter): ${err.slice(0, 220)}`);
      } else t.fail(err);
    }
    t.ok(env.PX && env.PX.ex && typeof env.PX.ex.define === 'function', 'PX.ex.define exists after loading');
  }
  for (const rel of files) {
    const abs = path.join(ROOT, rel);
    if (!fs.existsSync(abs)) continue;
    const src = stripComments(fs.readFileSync(abs, 'utf8'));
    t.ok(!/\bMath\.random\b/.test(src), `${rel} uses Math.random (pure files must use PX.rng)`);
    const iife = /^\s*\(function\s*\(PX\)\s*\{\s*['"]use strict['"];/m.test(src) && /\}\)\(window\.PX\);?\s*$/.test(src);
    t.ok(iife || rel === 'js/core/px.js', `${rel} is not a 'use strict' IIFE on window.PX: (function (PX) { 'use strict'; … })(window.PX);`);
  }
  // Engine files on disk but missing from the manifest are not tested: say so.
  const engineDir = path.join(ROOT, 'js/engine');
  if (fs.existsSync(engineDir)) {
    for (const f of fs.readdirSync(engineDir).filter((x) => x.endsWith('.js')).sort()) {
      if (!MANIFEST.includes(`js/engine/${f}`)) t.fail(`js/engine/${f} exists but is not in the MANIFEST of tests/node/run.mjs`);
    }
  }
  return { t, files };
}

function report(name, t, ms) {
  const status = t.failed ? 'FAIL' : 'ok  ';
  const counts = t.failed ? `${t.passed} passed, ${t.failed} failed` : `${t.passed} checks`;
  console.log(`${status} ${name.padEnd(28)} ${counts.padEnd(26)} ${(ms / 1000).toFixed(2)} s`);
  for (const f of t.failures) console.log(`       ✗ ${f}`);
  if (t.failed > t.failures.length) console.log(`       … and ${t.failed - t.failures.length} more`);
}

async function main(argv) {
  const filters = argv.filter((a) => !a.startsWith('-'));
  const started = performance.now();
  let passed = 0, failed = 0, failedFiles = 0;

  const t0 = performance.now();
  const { t: lt, files } = loadCheck(filters);
  report(`load (${files.length} files)`, lt, performance.now() - t0);
  passed += lt.passed; failed += lt.failed; if (lt.failed) failedFiles++;

  const tests = fs.readdirSync(HERE)
    .filter((f) => f.endsWith('.test.mjs'))
    .sort()
    .filter((f) => !filters.length || filters.some((x) => f.includes(x)));
  if (!tests.length) console.log('no test files match', filters.join(' '));

  let current = null;
  process.on('unhandledRejection', (e) => {
    if (current) current.fail('unhandled rejection: ' + (e && e.stack ? e.stack.split('\n').slice(0, 3).join(' | ') : e));
    else console.error('unhandled rejection:', e);
  });

  for (const f of tests) {
    const t = makeT();
    current = t;
    const start = performance.now();
    try {
      t.PX = createContext().PX;
      const mod = await import(pathToFileURL(path.join(HERE, f)).href);
      if (typeof mod.run !== 'function') t.fail('does not export async function run(t)');
      else await mod.run(t);
    } catch (e) {
      t.fail('threw: ' + (e && e.stack ? e.stack.split('\n').slice(0, 6).join('\n         ') : e));
    }
    current = null;
    report(f, t, performance.now() - start);
    passed += t.passed; failed += t.failed; if (t.failed) failedFiles++;
  }

  const secs = ((performance.now() - started) / 1000).toFixed(1);
  console.log(failed
    ? `\nFAILED: ${failed} of ${passed + failed} checks in ${failedFiles} file(s) (${secs} s)`
    : `\nAll ${passed} checks passed (${tests.length} test file(s), ${secs} s)`);
  process.exit(failed ? 1 : 0);
}

if (process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url) {
  main(process.argv.slice(2));
}
