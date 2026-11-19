"""O21 (PLAN milestone 9): the service worker of the GitHub Pages copy (sw.js, registered by js/ui/app.js).

The app is served over http://localhost under a sub-path (/Parallax/, as GitHub Pages serves it), with ETags,
304s and Cache-Control max-age=600 like Pages, from a scratch copy in tests/e2e/out/sw/ (git-ignored): one server
and one port per part, so each part starts on a fresh origin. The copy is made from the working tree, or from
the folder in SW_APP_ROOT. Parts:
- offline: the worker registers with the scope /Parallax/ and keeps one copy, named after PX.version, holding
  index.html, every stylesheet and script it loads, the fonts, the manifest and its icons, and nothing of another
  origin or outside the scope; then, with the server stopped and the browser offline, a reload boots the app
  from the copy, the record saved before is there, and a Train item of Rotate (three.js) plays and is logged;
  a page of the scope that is not the app (dist/Parallax.html) is not answered from the copy;
- updates: a change on the server without a new version number reaches the page at the launch after the one
  that fetched it (that launch still runs on the old files), then a new version number (the copy's name
  follows PX.version); the older copy is dropped each time; a new sw.js takes over and keeps the copy, which
  still starts the app offline;
- install (the lead's follow-up): a synthetic beforeinstallprompt is held (preventDefault) and kept in
  PX.ui.app.install; Settings → Your data shows "Install Parallax on this device" only while it is available (44 px,
  no sideways scroll at 360 px); the tap prompts once and the row goes; a dismissed prompt, appinstalled and a
  prompt with nothing held; nothing in the player when the browser offers install during a session;
- never registered: index.html from file://; the app in a same-origin frame; the single-file build
  (tools/build-single.mjs) in a sandboxed srcdoc frame as the previews show it, in a same-origin srcdoc frame,
  served at the top over http://localhost and opened from file://. Each: PX.ui.app.sw says why, register() is
  never called, the origin has no registration, and the console has no error.
Run: tests/e2e/pwslot.sh python3 tests/e2e/sw.py
"""
import functools, http.server, json, os, pathlib, shutil, subprocess, sys, threading, time
sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
from playwright.sync_api import sync_playwright
from common import launch, Console, Checks, ROOT, OUT as OUT_ROOT
from shell_common import active_assets, write_host, child_frame

OUT = OUT_ROOT / 'sw'
OUT.mkdir(parents=True, exist_ok=True)
SRC = pathlib.Path(os.environ.get('SW_APP_ROOT') or ROOT)
READY = 'document.documentElement.getAttribute("data-px-ready") === "1"'
SW_DONE = 'PX.ui.app && PX.ui.app.sw && ["off", "registered", "failed"].indexOf(PX.ui.app.sw.state) >= 0'
# Counts calls of navigator.serviceWorker.register in every frame (installed before the page's scripts).
COUNT_REGISTER = '''(() => {
  window.__swCalls = 0;
  try {
    const c = navigator.serviceWorker;
    if (c && typeof c.register === 'function') { const f = c.register.bind(c); c.register = function () { window.__swCalls++; return f.apply(null, arguments); }; }
  } catch (e) { /* no service workers here */ }
})()'''
REGS = '''(async () => {
  try { return navigator.serviceWorker && navigator.serviceWorker.getRegistrations ? (await navigator.serviceWorker.getRegistrations()).map(r => r.scope) : []; }
  catch (e) { return []; }
})()'''
COPIES = '''(async () => {
  const out = [];
  for (const name of (await caches.keys()).filter(n => n.indexOf('parallax-') === 0)) {
    const c = await caches.open(name), keys = (await c.keys()).map(r => r.url);
    const m = keys.find(k => /__parallax-copy__\\.json$/.test(k));
    out.push({ name, keys, mark: m ? await (await c.match(m)).json() : null });
  }
  return out;
})()'''
ICONS = ['icons/apple-touch-icon.png', 'icons/icon-192.png', 'icons/icon-512.png', 'icons/icon-maskable-512.png', 'icons/icon.svg']
GAP_S = 10.5          # sw.js CHECK_GAP (10 s) and a margin
CHECK_WAIT_MS = 6000  # CHECK_DELAY (3 s) and the check itself
FONTS = sorted('fonts/' + f.name for f in (SRC / 'fonts').glob('*.woff2'))


class Report(Checks):
    """Checks with a detail shown on failure, and every passing line printed."""

    def ok(self, cond, msg, detail=''):
        if cond:
            print('  ok  ', msg, flush=True)
        return super().ok(cond, msg if cond or not detail else f'{msg} :: {detail}')


class PagesLike(http.server.SimpleHTTPRequestHandler):
    """Static files like GitHub Pages: ETag (mtime and size), 304 on If-None-Match, Cache-Control max-age=600."""
    extensions_map = dict(http.server.SimpleHTTPRequestHandler.extensions_map, **{
        '.js': 'text/javascript', '.css': 'text/css', '.woff2': 'font/woff2', '.webmanifest': 'application/manifest+json',
        '.svg': 'image/svg+xml', '.png': 'image/png', '.html': 'text/html'})

    def log_message(self, *a):
        pass

    def send_head(self):
        self._etag = None
        path = self.translate_path(self.path)
        if os.path.isfile(path):
            st = os.stat(path)
            self._etag = '"%x-%x"' % (st.st_mtime_ns, st.st_size)
            if self.headers.get('If-None-Match') == self._etag:
                self.send_response(304)
                self.end_headers()
                return None
        return super().send_head()

    def end_headers(self):
        if getattr(self, '_etag', None):
            self.send_header('ETag', self._etag)
        self.send_header('Cache-Control', 'max-age=600')
        super().end_headers()


class Site:
    """A copy of the app at http://localhost:<port>/Parallax/ (a fresh origin), served until stop()."""

    def __init__(self, name, single=None):
        self.root = OUT / name / 'site'
        if self.root.exists():
            shutil.rmtree(self.root)
        self.app = self.root / 'Parallax'
        self.app.mkdir(parents=True)
        for f in ('index.html', 'sw.js', 'manifest.webmanifest'):
            shutil.copy2(SRC / f, self.app / f)
        for d in ('js', 'css', 'fonts', 'vendor', 'icons'):
            shutil.copytree(SRC / d, self.app / d)
        if single:
            (self.app / 'dist').mkdir()
            shutil.copy2(single, self.app / 'dist' / 'Parallax.html')
        self.httpd = http.server.ThreadingHTTPServer(('127.0.0.1', 0), functools.partial(PagesLike, directory=str(self.root)))
        self.url = f'http://localhost:{self.httpd.server_address[1]}/Parallax/'
        threading.Thread(target=self.httpd.serve_forever, daemon=True).start()
        self.up = True

    def edit(self, rel, fn):
        p = self.app / rel
        p.write_text(fn(p.read_text()))

    def write(self, rel, text):
        (self.app / rel).write_text(text)

    def stop(self):
        if self.up:
            self.httpd.shutdown()
            self.httpd.server_close()
            self.up = False


def expected_files():
    css, js = active_assets((SRC / 'index.html').read_text())
    return sorted(set(['index.html', 'manifest.webmanifest'] + css + js + FONTS + ICONS))


def boot(page, url=None):
    if url:
        page.goto(url)
    page.wait_for_function(READY, timeout=30000)
    page.evaluate('document.fonts.ready.then(() => 1)')
    for _ in range(4):  # the Chimera pop-up, then the first-run offer
        if not page.evaluate('PX.ui.modalOpen()'):
            break
        page.keyboard.press('Escape')
        page.wait_for_timeout(150)


def launch_page(ctx, url, cons):
    """A launch: a new page (a new document, as from the home-screen icon) with the browser's own HTTP and
    memory caches off (DevTools' "Disable cache", which still goes through the worker). A reload in the same tab
    may take a script from the memory cache while the server's max-age=600 holds, which says nothing about
    the worker; every file of such a page comes from the worker or the network."""
    page = ctx.new_page()
    cdp = ctx.new_cdp_session(page)
    cdp.send('Network.enable')
    cdp.send('Network.setCacheDisabled', {'cacheDisabled': True})
    cons.append(Console(page))
    boot(page, url)
    return page


def errors_of(cons, allow=()):
    return [e for c in cons for e in c.errors() if not any(x in e for x in allow)]


def sw_state(target, ms=15000):
    target.wait_for_function(SW_DONE, timeout=ms)
    return target.evaluate('Object.assign({}, PX.ui.app.sw)')


def copies(page):
    return page.evaluate(COPIES)


def wait_copy(page, pred, ms=30000):
    """Polls the copies until pred(list) holds; returns the list (or the last one seen)."""
    last = None
    for _ in range(ms // 250):
        last = copies(page)
        if pred(last):
            return last
        page.wait_for_timeout(250)
    return last


def play_one(page, C, tag):
    """A Train item of Rotate (three.js), answered right with the keys: the app is playable."""
    page.evaluate('''PX.ui.hooks && PX.ui.hooks.mute(true); PX.debug.fast(true);
      PX.ex.list('train').forEach(d => { PX.core.store.state.tour.seen[d.id] = true; });''')
    before = page.evaluate('PX.core.store.state.trials.length')
    page.evaluate('void PX.core.router.go("play", { mode: "train", exId: "rotate", count: 1 }, { force: true })')
    for _ in range(150):  # cards between items take their primary button
        if page.evaluate('__play.state') == 'respond' and not page.locator('[data-card-box]').count():
            break
        if page.locator('[data-card-box] .px-btn--primary').count():
            page.locator('[data-card-box] .px-btn--primary').first.click()
        page.wait_for_timeout(100)
    C.ok(page.evaluate('__play.state') == 'respond' and page.evaluate('__play.exId') == 'rotate', f'{tag}: a Train item of Rotate is up (three.js from the copy)')
    it = page.evaluate('({ key: __play.key, answer: __play.item.answer || PX.ex.get(__play.exId).answer })')
    keys = ['1' if it['key'] else '2'] if it['answer'] == 'yesno' else [str(i + 1) for i in it['key']] + ['Enter'] if it['answer'] == 'multi' else [str(it['key'] + 1)]
    for k in keys:
        page.keyboard.press(k)
    page.wait_for_function('__play.state === "reveal" || __play.state === "showme"', timeout=10000)
    kind = page.evaluate('(document.querySelector(".pl-verdict") || { dataset: {} }).dataset.kind')
    after = page.evaluate('PX.core.store.state.trials.length')
    C.ok(kind == 'right' and after == before + 1, f'{tag}: answered right with the keys and logged ({kind}, rows {before} -> {after})')


def part_offline(b, C, single):
    tag = 'offline'
    site = Site('offline', single=single)
    ctx = b.new_context(viewport={'width': 390, 'height': 844}, device_scale_factor=2, is_mobile=True, has_touch=True)
    page = ctx.new_page()
    con = Console(page)
    boot(page, site.url)
    st = sw_state(page)
    C.ok(st.get('state') == 'registered' and st.get('scope') == site.url, f'{tag}: registered from the app with the scope {site.url} (relative ./)', str(st))
    page.evaluate('navigator.serviceWorker.ready.then(() => 1)')
    version = page.evaluate('PX.version')
    cs = copies(page)
    want = expected_files()
    mark = cs[0]['mark'] if len(cs) == 1 else None
    C.ok(len(cs) == 1 and cs[0]['name'].startswith(f'parallax-{version}-') and cs[0]['name'].endswith('@/Parallax/'),
         f'{tag}: one copy, named after PX.version ({cs[0]["name"] if cs else None})', str([c['name'] for c in cs]))
    C.ok(bool(mark) and mark.get('format') == 1 and mark.get('version') == version and mark.get('files') == want,
         f'{tag}: the copy holds index.html, the {len(want) - 2 - len(FONTS) - len(ICONS)} stylesheets and scripts it loads, {len(FONTS)} fonts, the manifest and {len(ICONS)} icons',
         str(sorted(set(want) ^ set((mark or {}).get('files') or [])))[:300])
    keys = cs[0]['keys'] if cs else []
    C.ok(len(keys) == len(want) + 1 and all(k.startswith(site.url) for k in keys), f'{tag}: every entry is of this origin and inside the scope ({len(keys)} entries, the mark included)')
    C.ok(not any('/dist/' in k or '/docs/' in k or '/tests/' in k for k in keys), f'{tag}: nothing of dist/, docs/ or tests/')
    # a save made online, then the server stops and the browser goes offline
    page.evaluate('PX.core.store.state.settings.nickname = "Kestrel"; PX.core.store.save(); PX.core.store.flush()')
    ls_before = page.evaluate('Object.keys(localStorage).sort()')
    site.stop()
    ctx.set_offline(True)
    page.close()
    cons = [con]
    page = launch_page(ctx, site.url, cons)
    C.ok(page.evaluate('!!navigator.serviceWorker.controller'), f'{tag}: a launch with the server stopped and the browser offline is answered by the worker')
    C.ok(page.evaluate('PX.version') == version and page.evaluate(READY), f'{tag}: the app booted from the copy ({version})')
    C.ok(page.evaluate('PX.core.store.state.settings.nickname') == 'Kestrel' and page.evaluate('Object.keys(localStorage).sort()') == ls_before and page.evaluate('!PX.core.store.volatile'),
         f'{tag}: the saved record is untouched and still saved in this browser')
    play_one(page, C, tag)
    page.screenshot(path=str(OUT / 'offline_rotate_390.png'))
    page.reload()
    boot(page)
    C.ok(page.evaluate('!!navigator.serviceWorker.controller') and page.evaluate('PX.version') == version and page.evaluate('PX.core.store.state.trials.length') == 1,
         f'{tag}: a reload in the same tab, still offline, boots too, with the answer kept')
    errs = errors_of(cons)
    C.ok(not errs, f'{tag}: no console errors, online or offline', str(errs[:4]))
    # a page of the scope that is not the app goes to the network: offline it does not load
    p2 = ctx.new_page()
    try:
        p2.goto(site.url + 'dist/Parallax.html', timeout=8000)
        booted = p2.evaluate('!!(window.PX && PX.version)')
    except Exception:
        booted = False
    C.ok(not booted, f'{tag}: dist/Parallax.html (the single-file build, in the scope) is not answered from the copy')
    ctx.close()


def part_updates(b, C):
    tag = 'updates'
    site = Site('updates')
    ctx = b.new_context(viewport={'width': 1280, 'height': 800})
    cons = []
    page = launch_page(ctx, site.url, cons)
    st = sw_state(page)
    page.evaluate('navigator.serviceWorker.ready.then(() => 1)')
    v0 = page.evaluate('PX.version')
    c0 = copies(page)
    C.ok(st.get('state') == 'registered' and len(c0) == 1, f'{tag}: registered, one copy', str(st))

    def relaunch(gap=True):
        nonlocal page
        page.close()
        if gap:
            time.sleep(GAP_S)  # the worker checks at most once in 10 s
        page = launch_page(ctx, site.url, cons)
        return page

    # 1. a change without a new version number
    site.edit('js/core/px.js', lambda s: s + "\nPX.swProbe = 'one';\n")
    relaunch(gap=False)
    C.ok(page.evaluate('window.PX.swProbe === undefined') and page.evaluate('!!navigator.serviceWorker.controller'),
         f'{tag}: the launch after a change still runs on the copy\'s files (cache first: one version a launch)')
    c1 = wait_copy(page, lambda cs: len(cs) == 1 and cs[0]['name'] != c0[0]['name'])
    C.ok(len(c1) == 1 and c1[0]['name'] != c0[0]['name'] and c1[0]['name'].startswith(f'parallax-{v0}-'),
         f'{tag}: that launch\'s check wrote a new copy and dropped the old one ({c1[0]["name"] if c1 else None})', str([c['name'] for c in c1 or []]))
    relaunch(gap=False)
    C.ok(page.evaluate('window.PX.swProbe') == 'one', f'{tag}: the next launch runs on the changed file (no new version number needed)')
    # 2. a new version number
    v1 = v0 + '.sw'
    site.edit('js/core/px.js', lambda s: s.replace(f"PX.version = '{v0}'", f"PX.version = '{v1}'"))
    relaunch()
    C.ok(page.evaluate('PX.version') == v0, f'{tag}: the launch after a new version still runs on {v0}')
    c2 = wait_copy(page, lambda cs: len(cs) == 1 and cs[0]['name'].startswith(f'parallax-{v1}-'))
    C.ok(len(c2) == 1 and c2[0]['name'].startswith(f'parallax-{v1}-') and c2[0]['mark']['version'] == v1,
         f'{tag}: the new copy is named after the new PX.version and the old one is gone ({c2[0]["name"] if c2 else None})', str([c['name'] for c in c2 or []]))
    relaunch(gap=False)
    C.ok(page.evaluate('PX.version') == v1 and page.evaluate('window.PX.swProbe') == 'one', f'{tag}: the next launch runs on {v1}')
    # 3. nothing changed: a launch's check keeps the copy as it is
    relaunch()
    page.wait_for_timeout(CHECK_WAIT_MS)
    c3 = copies(page)
    C.ok(len(c3) == 1 and c3[0]['name'] == c2[0]['name'], f'{tag}: with nothing changed on the server a launch keeps the copy', str([c['name'] for c in c3]))
    # 4. a new sw.js: the browser installs it, it takes over and keeps the copy
    page.evaluate('navigator.serviceWorker.getRegistration().then(r => { window.__oldWorker = r.active; })')
    site.edit('sw.js', lambda s: s + '\n// a new worker (tests/e2e/sw.py)\n')
    page.evaluate('navigator.serviceWorker.getRegistration().then(r => r.update()).catch(() => 0)')
    page.wait_for_function('navigator.serviceWorker.getRegistration().then(r => !!r && !!r.active && r.active !== window.__oldWorker && r.active.state === "activated")', timeout=20000)
    c4 = copies(page)
    C.ok(len(c4) == 1 and c4[0]['name'] == c2[0]['name'], f'{tag}: a new sw.js takes over and keeps the copy', str([c['name'] for c in c4]))
    site.stop()
    ctx.set_offline(True)
    relaunch(gap=False)
    C.ok(page.evaluate('PX.version') == v1 and page.evaluate('!!navigator.serviceWorker.controller'), f'{tag}: the new worker starts the app offline from the kept copy')
    errs = errors_of(cons)
    C.ok(not errs, f'{tag}: no console errors', str(errs[:4]))
    ctx.close()


# A synthetic beforeinstallprompt, as Chrome fires it once the page is installable: prompt() counts its calls.
OFFER = '''(outcome) => {
  const e = new Event('beforeinstallprompt', { cancelable: true });
  window.__prompts = window.__prompts || 0;
  e.prompt = () => { window.__prompts++; return Promise.resolve(); };
  e.userChoice = Promise.resolve({ outcome, platform: 'web' });
  window.dispatchEvent(e);
  return e.defaultPrevented;
}'''
INSTALL = 'PX.ui.app.install'


def part_install(b, C):
    tag = 'install'
    site = Site('install')
    ctx = b.new_context(viewport={'width': 360, 'height': 640}, device_scale_factor=2, is_mobile=True, has_touch=True)
    cons = []
    page = launch_page(ctx, site.url, cons)
    sw_state(page)
    C.ok(page.evaluate(f'!!{INSTALL} && {INSTALL}.available === false && typeof {INSTALL}.prompt === "function"'),
         f'{tag}: PX.ui.app.install is there, not available before the browser offers it')
    C.ok(page.evaluate(f'{INSTALL}.prompt()') == 'unavailable', f'{tag}: prompt() with nothing held says unavailable')
    page.evaluate('void PX.core.router.go("settings")')
    page.wait_for_timeout(250)
    row = page.locator('[data-action="install"]')
    C.ok(row.count() == 1 and not row.is_visible(), f'{tag}: Settings: the row is there and hidden')
    C.ok(page.evaluate(OFFER, 'accepted') is True and page.evaluate(f'{INSTALL}.available') is True,
         f'{tag}: the browser\'s beforeinstallprompt is held (preventDefault: no install bar of its own) and kept')
    page.wait_for_timeout(100)
    C.ok(row.is_visible() and row.inner_text().strip() == 'Install Parallax on this device', f'{tag}: the row "Install Parallax on this device" shows in Your data')
    row.scroll_into_view_if_needed()
    bb = row.bounding_box() or {}
    C.ok(bb.get('height', 0) >= 44 and bb.get('width', 0) >= 44 and page.evaluate('document.documentElement.scrollWidth <= window.innerWidth'),
         f'{tag}: a 44 px target, no sideways scroll at 360 px ({round(bb.get("width", 0))} x {round(bb.get("height", 0))})')
    C.ok(page.evaluate('!!document.querySelector(\'[data-section="data"] [data-action="install"]\')'), f'{tag}: in the Your data section')
    page.screenshot(path=str(OUT / 'install_row_360.png'))
    row.click()
    page.wait_for_function(f'!{INSTALL}.available', timeout=5000)
    page.wait_for_timeout(100)
    C.ok(page.evaluate('window.__prompts') == 1 and not row.is_visible(), f'{tag}: a tap shows the browser\'s prompt once; the row goes (a held event prompts once)')
    page.evaluate(OFFER, 'dismissed')
    C.ok(page.evaluate(f'{INSTALL}.prompt()') == 'dismissed' and page.evaluate(f'{INSTALL}.available') is False, f'{tag}: a dismissed prompt says so and clears it')
    page.evaluate(OFFER, 'accepted')
    page.wait_for_timeout(100)
    shown = row.is_visible()
    page.evaluate('window.dispatchEvent(new Event("appinstalled"))')
    page.wait_for_timeout(100)
    C.ok(shown and page.evaluate(f'{INSTALL}.available') is False and not row.is_visible(), f'{tag}: appinstalled clears it and the row goes')
    # during a session: held, nothing in the player, no prompt
    page.evaluate('''PX.ui.hooks && PX.ui.hooks.mute(true); PX.debug.fast(true);
      PX.ex.list('train').forEach(d => { PX.core.store.state.tour.seen[d.id] = true; });''')
    page.evaluate('void PX.core.router.go("play", { mode: "train", exId: "rotate", count: 1 }, { force: true })')
    page.wait_for_function('__play.state === "respond"', timeout=15000)
    n0 = page.evaluate('window.__prompts')
    held = page.evaluate(OFFER, 'accepted')
    page.wait_for_timeout(300)
    C.ok(held and page.evaluate('__play.state') == 'respond' and page.locator('[data-action="install"]').count() == 0 and page.evaluate('window.__prompts') == n0,
         f'{tag}: offered during an item: held, the item stays up, nothing of it in the player, no prompt')
    errs = errors_of(cons)
    C.ok(not errs, f'{tag}: no console errors', str(errs[:4]))
    ctx.close()
    site.stop()


def never(C, tag, target, page, why):
    """target (a page or frame running the app): never registered, says why; the origin has no registration."""
    st = sw_state(target)
    target.wait_for_timeout(3500)  # past the 1.5 s after load at which the app would register
    C.ok(st.get('state') == 'off' and st.get('why') in why, f'{tag}: not registered ({st.get("why")})', str(st))
    C.ok(target.evaluate('window.__swCalls') == 0, f'{tag}: register() never called')
    C.ok(target.evaluate(OFFER, 'accepted') is True and target.evaluate('PX.ui.app.install.available') is True, f'{tag}: an install offer is held here too (no error)')
    C.ok(page.evaluate(REGS) == [], f'{tag}: no service worker on the origin')


def part_never(b, C, single):
    site = Site('never', single=single)
    hosts = OUT / 'never' / 'hosts'
    hosts.mkdir(parents=True, exist_ok=True)
    html = pathlib.Path(single).read_text()
    site.write('frame-host.html', '<!doctype html><title>frame host</title><iframe src="index.html" style="width:390px;height:780px;border:0"></iframe>')
    write_host(html, site.app / 'srcdoc-host.html')                                    # sandbox="allow-scripts": opaque origin
    write_host(html, site.app / 'srcdoc-same.html', sandbox='allow-scripts allow-same-origin')  # this origin
    write_host(html, hosts / 'srcdoc-file.html')
    cases = [
        ('file:// index.html', (SRC / 'index.html').as_uri(), False, ('protocol',)),
        ('a same-origin frame', site.url + 'frame-host.html', True, ('frame',)),
        ('the single-file build in a sandboxed srcdoc frame (http host)', site.url + 'srcdoc-host.html', True, ('protocol', 'frame')),
        ('the single-file build in a same-origin srcdoc frame', site.url + 'srcdoc-same.html', True, ('protocol', 'frame')),
        ('the single-file build in a sandboxed srcdoc frame (file:// host)', hosts.joinpath('srcdoc-file.html').as_uri(), True, ('protocol', 'frame')),
        ('the single-file build at the top over http://localhost', site.url + 'dist/Parallax.html', False, ('single-file',)),
        ('the single-file build from file://', pathlib.Path(single).as_uri(), False, ('protocol',)),
    ]
    for tag, url, framed, why in cases:
        ctx = b.new_context(viewport={'width': 1024, 'height': 820})
        ctx.add_init_script(COUNT_REGISTER)
        page = ctx.new_page()
        con = Console(page)
        page.goto(url)
        target = child_frame(page) if framed else page
        target.wait_for_function(READY, timeout=30000)
        never(C, tag, target, page, why)
        C.ok(not con.errors(), f'{tag}: no console errors', str(con.errors()[:3]))
        ctx.close()
    site.stop()


def main():
    C = Report('sw')
    single = OUT / 'single' / 'Parallax.html'
    single.parent.mkdir(parents=True, exist_ok=True)
    subprocess.run(['node', str(SRC / 'tools' / 'build-single.mjs'), '--out', str(single)], cwd=str(SRC), check=True, capture_output=True)
    with sync_playwright() as p:
        b = launch(p)
        for part in (lambda: part_offline(b, C, single), lambda: part_updates(b, C), lambda: part_install(b, C), lambda: part_never(b, C, single)):
            try:
                part()
            except Exception as e:  # one part's failure must not hide the others' results
                C.ok(False, f'a part threw: {type(e).__name__}: {str(e)[:300]}')
        b.close()
    sys.exit(C.summary({'out': str(OUT)}))


if __name__ == '__main__':
    main()
