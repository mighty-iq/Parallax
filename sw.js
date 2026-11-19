/* sw.js: the service worker of the GitHub Pages copy (PLAN milestone 9, O21; CLAUDE.md rule 6). Once it has
   kept a complete copy of the app's files, Parallax (and its home-screen icon) starts without a connection.
   js/ui/app.js registers it (scope './', so it works under Pages' sub-path) only from the multi-file app at the
   top of a secure http(s) page: GitHub Pages, or http://localhost in the tests. Never from file://, from a frame
   (sandboxed and srcdoc previews included) or from the single-file build, wherever that is hosted.

   The copy holds the app's own files: index.html, every stylesheet and script it loads (read from index.html
   with its comments left out, as tools/build-single.mjs reads it), the url() assets of those stylesheets (the
   fonts), the web manifest, its icons and the touch icon; same origin and inside the scope only. Nothing else is
   answered or cached: other origins, dist/ (the single-file build), docs/ (the guide) and tests/ go to the
   network as they would without a worker. Saves are never touched: the worker reads and writes Cache Storage
   only, and only caches named parallax-…@<this scope's path> (other tools may share the origin).

   Copies: each one is a cache named parallax-<PX.version>-<stamp>@<scope path>, filled whole and then marked
   complete by one last entry (MARK); a copy without its mark is never used and is deleted. The app is answered
   from the newest complete copy (cache first), so a launch always runs on one version's files, online or not.

   Updates: a few seconds after each launch (a navigation to the app) the worker asks the network for every file
   again (conditional requests: an unchanged file costs a 304). When index.html lists other files or any file
   changed, it writes a new complete copy from those answers, and the older copies are deleted; the next launch
   runs on it. So any change on the server, with or without a new version number, reaches the player at the
   launch after the one that fetched it, and nothing half-updated is ever served. A new sw.js is found by the
   browser itself (it compares the script with the network at navigations), installs, keeps the current copy
   and takes over at once (skipWaiting; no claim, so an open page keeps the files it loaded).
   Every step is wrapped: when anything fails, the worker answers from the network, as if it were not there. */
(function () {
  'use strict';

  var FORMAT = 1;                // the copy's layout: a copy marked with another format is not used
  var PREFIX = 'parallax-';
  var CHECK_DELAY = 3000;        // ms after a launch before the update check, so the page loads first
  var CHECK_GAP = 10000;         // ms: one check at most in this time (reloads in a row)
  var FILES = /^(?:js|css|fonts|vendor|icons)\/[^?#]+$/; // the paths a copy answers, with manifest.webmanifest

  var SCOPE = self.registration.scope;            // https://host/Parallax/
  var PATH = new URL(SCOPE).pathname;             // /Parallax/
  var SUFFIX = '@' + PATH;
  var MARK = SCOPE + '__parallax-copy__.json';    // never requested by the app (not one of FILES)

  function mine(name) { return name.indexOf(PREFIX) === 0 && name.slice(-SUFFIX.length) === SUFFIX; }
  function wait(ms) { return new Promise(function (ok) { setTimeout(ok, ms); }); }

  // An absolute URL → its path inside the scope (same origin), else null.
  function inScope(url) {
    var u = new URL(url);
    if (u.origin !== self.location.origin || u.pathname.indexOf(PATH) !== 0) return null;
    return u.pathname.slice(PATH.length);
  }
  // Adds the path of url (relative to base) to list once, when it is one of the app's own files.
  function add(list, url, base) {
    if (!url || /^(?:data:|blob:|#)/i.test(url)) return;
    var p = null;
    try { p = inScope(new URL(url, base).href); } catch (e) { p = null; }
    if (p && list.indexOf(p) < 0) list.push(p);
  }
  function attr(tag, name) {
    var m = new RegExp('(?:^|\\s)' + name + '\\s*=\\s*(?:"([^"]*)"|\'([^\']*)\'|([^\\s>]+))', 'i').exec(tag);
    return m ? (m[1] || m[2] || m[3] || null) : null;
  }
  // index.html → the stylesheets and scripts it loads, in its order (comments left out, like the browser).
  function listed(html) {
    var text = html.replace(/<!--[\s\S]*?-->/g, ''), tags = /<(link|script)\b([^>]*)>/gi, out = [], m;
    while ((m = tags.exec(text))) {
      var at = m[2];
      if (m[1].toLowerCase() === 'link') { if (/^stylesheet$/i.test(attr(at, 'rel') || '')) add(out, attr(at, 'href'), SCOPE + 'index.html'); } else add(out, attr(at, 'src'), SCOPE + 'index.html');
    }
    return out;
  }
  // A stylesheet → the assets its url()s name (the fonts), relative to the stylesheet.
  function assets(css, path) {
    var re = /url\(\s*(['"]?)([^'")]+)\1\s*\)/g, out = [], m;
    while ((m = re.exec(css))) add(out, m[2].trim(), SCOPE + path);
    return out;
  }

  // One file of the app from the network, revalidated (an unchanged file costs a 304). Rejects unless it is
  // a whole answer of this origin.
  function net(path) {
    return fetch(new Request(SCOPE + path, { cache: 'no-cache', credentials: 'same-origin' })).then(function (res) {
      var bad = !res || !res.ok || /^(?:opaque|opaqueredirect|cors|error)$/.test(res.type) || (res.url && inScope(res.url) === null);
      if (bad) throw new Error(path + ': ' + (res ? res.status + ' ' + res.type : 'no answer'));
      if (!res.redirected) return res;
      // a followed redirect is answered as a plain response (a navigation refuses redirected ones)
      return res.blob().then(function (b) { return new Response(b, { status: res.status, statusText: res.statusText, headers: res.headers }); });
    });
  }

  // Every file of the app as the network has it now → { version, paths (sorted), files: path → response }.
  function gather() {
    var files = {};
    function keep(p, res) { files[p] = res; }
    return net('index.html').then(function (idx) {
      keep('index.html', idx);
      return idx.clone().text();
    }).then(function (html) {
      var list = listed(html);
      if (!list.length) throw new Error('index.html lists no files');
      return Promise.all(list.map(function (p) {
        return net(p).then(function (res) {
          keep(p, res);
          if (!/\.css$/i.test(p)) return null;
          return res.clone().text().then(function (css) {
            return Promise.all(assets(css, p).map(function (a) { return net(a).then(function (r) { keep(a, r); }); }));
          });
        });
      }));
    }).then(function () {
      // the manifest, its icons and the touch icon: kept when they load (the app starts without them)
      return net('manifest.webmanifest').then(function (res) {
        keep('manifest.webmanifest', res);
        return res.clone().json().then(function (man) {
          var icons = [];
          (man && Array.isArray(man.icons) ? man.icons : []).forEach(function (ic) { if (ic && typeof ic.src === 'string') add(icons, ic.src, SCOPE + 'manifest.webmanifest'); });
          add(icons, 'icons/apple-touch-icon.png', SCOPE);
          return Promise.all(icons.map(function (p) { return net(p).then(function (r) { keep(p, r); }, function () { /* not on this host */ }); }));
        });
      }).then(null, function () { /* no manifest on this host */ });
    }).then(function () {
      var px = files['js/core/px.js'];
      return (px ? px.clone().text() : Promise.resolve('')).then(function (src) {
        var m = /PX\.version\s*=\s*'([^']+)'/.exec(src);
        return { version: m ? m[1] : 'unknown', paths: Object.keys(files).sort(), files: files };
      });
    });
  }

  // The newest complete copy → { name, version, files, made } | null. Memo for this worker's life; a launch
  // reads Cache Storage again (fresh), since another worker of this scope may have changed it.
  var cur = null;
  function current(fresh) {
    if (cur && !fresh) return Promise.resolve(cur);
    return caches.keys().then(function (names) {
      return Promise.all(names.filter(mine).map(function (name) {
        return caches.match(MARK, { cacheName: name }).then(function (m) { return m ? m.json() : null; }).then(function (j) {
          return j && j.format === FORMAT && Array.isArray(j.files) && typeof j.made === 'number' ? { name: name, version: j.version, files: j.files, made: j.made } : null;
        }, function () { return null; });
      }));
    }).then(function (list) {
      var best = null;
      list.forEach(function (x) { if (x && (!best || x.made > best.made)) best = x; });
      cur = best;
      return best;
    });
  }

  // Whether two answers for one file differ: by their ETags when both have one, else byte by byte.
  function same(old, now) {
    var a = old.headers.get('ETag'), b = now.headers.get('ETag');
    if (a && b) return Promise.resolve(a === b);
    return Promise.all([old.arrayBuffer(), now.clone().arrayBuffer()]).then(function (x) {
      if (x[0].byteLength !== x[1].byteLength) return false;
      var u = new Uint8Array(x[0]), v = new Uint8Array(x[1]);
      for (var i = 0; i < u.length; i++) if (u[i] !== v[i]) return false;
      return true;
    });
  }
  function changed(copy, got) {
    if (!copy || copy.files.join('\n') !== got.paths.join('\n')) return Promise.resolve(true);
    return Promise.all(got.paths.map(function (p) {
      return caches.match(SCOPE + p, { cacheName: copy.name, ignoreVary: true }).then(function (old) { return old ? same(old, got.files[p]) : false; });
    })).then(function (s) { return s.indexOf(false) >= 0; });
  }

  // A name no cache has yet (a copy is never written into another one).
  function freshName(version, n) {
    var name = PREFIX + version + '-' + Date.now().toString(36) + (n ? '.' + n : '') + SUFFIX;
    return caches.has(name).then(function (taken) { return taken ? freshName(version, (n || 0) + 1) : name; });
  }
  // Writes a new complete copy (the mark last); on failure deletes what it wrote and keeps the current one.
  function write(got) {
    return freshName(got.version, 0).then(function (name) { return fill(name, got); });
  }
  function fill(name, got) {
    var made = Date.now();
    return caches.open(name).then(function (c) {
      return Promise.all(got.paths.map(function (p) { return c.put(SCOPE + p, got.files[p]); })).then(function () {
        var mark = { format: FORMAT, version: got.version, files: got.paths, made: made };
        return c.put(MARK, new Response(JSON.stringify(mark), { headers: { 'Content-Type': 'application/json' } }));
      });
    }).then(function () {
      cur = { name: name, version: got.version, files: got.paths, made: made };
      return cleanup(name).then(function () { return cur; }, function () { return cur; });
    }, function (e) {
      return caches.delete(name).then(function () { throw e; }, function () { throw e; });
    });
  }
  // Deletes this scope's other copies (complete or not); other caches of the origin are not ours.
  function cleanup(keep) {
    return caches.keys().then(function (names) {
      return Promise.all(names.filter(function (n) { return mine(n) && n !== keep; }).map(function (n) { return caches.delete(n); }));
    });
  }

  // The update check: one at a time, not twice within CHECK_GAP; failures (offline) change nothing.
  var checking = null, checkedAt = 0;
  function check() {
    if (checking) return checking;
    if (Date.now() - checkedAt < CHECK_GAP) return Promise.resolve(null);
    checkedAt = Date.now();
    checking = gather().then(function (got) {
      return current(true).then(function (copy) {
        return changed(copy, got).then(function (yes) { return yes ? write(got) : copy; });
      });
    }).then(function (x) { checking = null; return x; }, function () { checking = null; return null; });
    return checking;
  }

  // 'launch': a navigation to the app (the scope or index.html, any query); 'file': one of the app's files;
  // null: not ours (the browser goes to the network as without a worker).
  function classify(req) {
    if (req.method !== 'GET' || req.headers.has('range')) return null;
    var u = new URL(req.url);
    if (u.origin !== self.location.origin || u.pathname.indexOf(PATH) !== 0) return null;
    var p = u.pathname.slice(PATH.length);
    if (req.mode === 'navigate') return p === '' || p === 'index.html' ? 'launch' : null;
    if (u.search) return null;
    return FILES.test(p) || p === 'manifest.webmanifest' ? 'file' : null;
  }
  function fromCopy(url, req, fresh) {
    return current(fresh).then(function (copy) {
      return copy ? caches.match(url, { cacheName: copy.name, ignoreVary: true }) : null;
    }).then(null, function () { return null; }).then(function (res) { return res || fetch(req); });
  }

  self.addEventListener('install', function (event) {
    // keep a complete copy of this scope when there is one (a new sw.js), else write one; then take over
    event.waitUntil(current(true).then(function (copy) { return copy || gather().then(write); }).then(function () { return self.skipWaiting(); }));
  });
  self.addEventListener('activate', function (event) {
    event.waitUntil(current(true).then(function (copy) { return copy ? cleanup(copy.name) : null; }).then(null, function () { /* nothing to drop */ }));
  });
  self.addEventListener('fetch', function (event) {
    var req = event.request, kind = null;
    try { kind = classify(req); } catch (e) { kind = null; }
    if (kind === 'launch') {
      event.respondWith(fromCopy(SCOPE + 'index.html', req, true));
      event.waitUntil(wait(CHECK_DELAY).then(check).then(null, function () { /* offline: the next launch checks */ }));
    } else if (kind === 'file') {
      event.respondWith(fromCopy(req.url, req, false));
    }
  });
})();
