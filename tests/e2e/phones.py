"""Phones (PLAN milestone 9, W3-phones): one check per item, at 360 x 640, other phone sizes and desktop.

  dial      O41: the arrow circle's words (ahead, left, right) in Homing and Reckon are 12 px or more on the
            screen wherever they show, at every phone size and on desktop; the circle keeps them on short
            phones only where they fit (else the readout says the same)
Run:  tests/e2e/pwslot.sh python3 tests/e2e/phones.py [dial ...]   (no names: every part)
Report: tests/e2e/out/phones.json; screenshots: tests/e2e/out/phones/.
"""
import json, pathlib, sys, time
sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
from playwright.sync_api import sync_playwright
from common import ROOT, OUT, launch, Checks

APP = (ROOT / 'index.html').resolve().as_uri()
READY = 'document.documentElement.getAttribute("data-px-ready") === "1"'
DIR = OUT / 'phones'
DIR.mkdir(parents=True, exist_ok=True)
C = Checks('phones')
REPORT = {}
PARTS = [a for a in sys.argv[1:] if not a.startswith('-')]


def want(part):
    return not PARTS or part in PARTS


def open_app(b, w, h, touch=True, dark=False):
    kw = dict(viewport={'width': w, 'height': h}, device_scale_factor=2)
    if touch:
        kw.update(is_mobile=True, has_touch=True)
    if dark:
        kw['color_scheme'] = 'dark'
    ctx = b.new_context(**kw)
    page = ctx.new_page()
    errs = []
    page.on('pageerror', lambda e: errs.append(str(e)[:300]))
    page.on('console', lambda m: errs.append('console: ' + m.text[:300]) if m.type == 'error' and 'GL Driver' not in m.text and 'GPU stall' not in m.text else None)
    page.goto(APP)
    page.wait_for_function(READY, timeout=30000)
    page.evaluate('document.fonts.ready.then(() => 1)')
    for _ in range(4):
        if not page.evaluate('PX.ui.modalOpen()'):
            break
        page.keyboard.press('Escape')
        page.wait_for_timeout(150)
    page.evaluate('''() => { const r = PX.core.store.state; r.tour = r.tour || { seen: {} }; r.tour.seen = r.tour.seen || {};
        PX.ex.list().forEach(d => { r.tour.seen[d.id] = true; }); r.ui = r.ui || {}; r.ui.seen = r.ui.seen || {};
        r.ui.seen.motionNotice = Date.now(); r.ui.seen.walkNotice = Date.now(); PX.ui.hooks && PX.ui.hooks.mute(true); }''')
    return ctx, page, errs


def state(page):
    return page.evaluate('window.__play ? __play.state : null')


def clear_cards(page):
    for sel in ('[data-card-box] [data-card="skip"]', '[data-card-box] .px-btn--primary', '.ex-track-notice:not([hidden]) .px-btn', '[data-notice-start]'):
        loc = page.locator(sel)
        if loc.count() and loc.first.is_visible():
            loc.first.click()
            page.wait_for_timeout(200)
            return True
    return False


def wait_respond(page, ms=60000):
    t0 = time.time()
    while time.time() - t0 < ms / 1000:
        s = state(page)
        if s == 'respond':
            return True
        if s in (None, 'idle', 'done', 'ready', 'present', 'reveal'):
            clear_cards(page)
        page.wait_for_timeout(120)
    return False


def free_item(page, ex, params=None, trials=3):
    page.evaluate('window.__play && void __play.end()')
    page.evaluate('PX.debug.fast(true)')
    q = {'mode': 'free', 'exId': ex, 'run': '1', 'trials': trials}
    if params:
        q['params'] = params
    page.evaluate(f'void PX.core.router.go("play", {json.dumps(q)}, {{ force: true }})')
    page.wait_for_timeout(150)
    return wait_respond(page)


# Every SVG text in a scope with its size on the screen (font size x the element's screen scale).
TEXT_PX = r'''(sel) => {
  const out = [];
  document.querySelectorAll(sel).forEach(t => {
    const s = getComputedStyle(t);
    if (s.display === 'none' || s.visibility === 'hidden') return;
    const r = t.getBoundingClientRect();
    if (r.width < 0.5 || r.height < 0.5) return;
    const m = t.getScreenCTM();
    const px = parseFloat(s.fontSize) * (m ? Math.sqrt(Math.abs(m.a * m.d - m.b * m.c)) : 1);
    out.push({ text: t.textContent.trim(), px: Math.round(px * 10) / 10, left: Math.round(r.left), right: Math.round(r.right), top: Math.round(r.top), bottom: Math.round(r.bottom) });
  });
  return out;
}'''

DIAL_BOX = r'''() => { const d = document.querySelector('.pl-trial .ex-fp-dialbox'); if (!d) return null; const r = d.getBoundingClientRect();
  const ro = document.querySelector('.pl-trial .ex-fp-readout'); return { w: Math.round(r.width), readout: ro ? ro.textContent.trim().slice(0, 60) : null, innerW: innerWidth }; }'''

DIAL_SIZES = [(360, 640), (360, 700), (360, 740), (375, 667), (375, 812), (390, 844), (412, 915), (430, 932), (844, 390), (740, 360), (1366, 768), (1024, 700)]


def part_dial(b):
    rows = []
    for ex in ('homing', 'reckon'):
        for (w, h) in DIAL_SIZES:
            touch = w < 1000
            ctx, page, errs = open_app(b, w, h, touch=touch)
            reached = free_item(page, ex)
            if not C.ok(reached, f'dial {ex} {w}x{h}: an item reached its answer state'):
                ctx.close()
                continue
            page.wait_for_timeout(300)
            words = page.evaluate(TEXT_PX, '.pl-trial .ex-fp-dial text')
            box = page.evaluate(DIAL_BOX)
            small = [x for x in words if x['px'] < 12]
            row = {'ex': ex, 'size': f'{w}x{h}', 'circle': box and box['w'], 'words': [(x['text'], x['px']) for x in words]}
            rows.append(row)
            print(f'  {ex} {w}x{h}: circle {box and box["w"]} px, words {row["words"]}', flush=True)
            C.ok(not small, f'dial {ex} {w}x{h}: the circle\'s words are 12 px or more ({small})')
            # the words stay on the screen, clear of the edges
            C.ok(all(x['left'] >= 0 and x['right'] <= w for x in words), f'dial {ex} {w}x{h}: the words lie on the screen ({words})')
            if (w, h) in ((360, 640), (390, 844), (844, 390), (1366, 768), (360, 740)):
                page.screenshot(path=str(DIR / f'dial_{ex}_{w}x{h}.png'))
            C.ok(not errs, f'dial {ex} {w}x{h}: no page errors ({errs[:2]})')
            ctx.close()
    REPORT['dial'] = rows


def main():
    with sync_playwright() as p:
        b = launch(p)
        if want('dial'):
            part_dial(b)
        b.close()
    return C.summary(REPORT)


if __name__ == '__main__':
    sys.exit(main())
