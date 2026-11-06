#!/usr/bin/env python3
"""The single-file build (dist/Parallax.html) from disk and inside a sandboxed srcdoc preview.

Run after `node tools/build-single.mjs`:   tests/e2e/pwslot.sh python3 tests/e2e/single.py
Checks: the app boots, the Chimera pop-up and its link, every exercise and probe registered with
a view, WebGL available, a route change keeps the frame in place, no console errors.
"""
import sys
from pathlib import Path
from playwright.sync_api import sync_playwright

sys.path.insert(0, str(Path(__file__).resolve().parent))
from common import ROOT, launch, Console, Checks, srcdoc_host, child_frame  # noqa: E402

SINGLE = ROOT / 'dist' / 'Parallax.html'
PROBE = """() => {
  const PX = window.PX, ex = PX.ex.list();
  const noView = ex.filter(d => !PX.ex.view(d.id)).map(d => d.id);
  const pop = document.querySelector('a[href="https://discord.gg/chmr"]');
  return {
    ready: document.documentElement.getAttribute('data-px-ready') === '1',
    nEx: ex.length, nTrain: PX.ex.list('train').length, nProbe: PX.ex.list('probe').length, noView,
    webgl: !!(PX.core.stage3d && PX.core.stage3d.available && PX.core.stage3d.available()),
    discord: !!pop, discordTarget: pop ? pop.getAttribute('target') : null,
    popupText: (document.body.innerText || '').includes('built by the Chimera community'),
    version: PX.version,
  };
}"""


def check_frame(c, frame, label):
    frame.wait_for_function("() => document.documentElement.getAttribute('data-px-ready') === '1'", timeout=30000)
    r = frame.evaluate(PROBE)
    c.ok(r['ready'], f'{label}: app booted')
    c.ok(r['nTrain'] == 11 and r['nProbe'] == 6, f"{label}: 11 exercises + 6 probes registered (got {r['nTrain']} + {r['nProbe']})")
    c.ok(not r['noView'], f"{label}: every exercise has a view (missing: {r['noView']})")
    c.ok(r['webgl'], f'{label}: WebGL available')
    c.ok(r['discord'] and r['discordTarget'] == '_blank', f'{label}: Chimera pop-up links to discord.gg/chmr in a new tab')
    c.ok(r['popupText'], f'{label}: pop-up says it was built by the Chimera community')
    return r


def main():
    if not SINGLE.exists():
        print('run node tools/build-single.mjs first', file=sys.stderr)
        return 2
    c = Checks('single')
    with sync_playwright() as p:
        b = launch(p)
        # 1. from disk
        page = b.new_page(viewport={'width': 412, 'height': 880})
        con = Console(page)
        page.goto(SINGLE.as_uri())
        r = check_frame(c, page.main_frame, 'file://')
        page.keyboard.press('Escape')
        page.wait_for_timeout(300)
        page.evaluate("() => PX.core.router.go('library')")
        page.wait_for_timeout(500)
        c.ok(page.url.startswith(SINGLE.as_uri()), 'file://: routing keeps the page')
        page.screenshot(path=str(ROOT / 'tests/e2e/out/single_file.png'))
        c.ok(not con.errors(), f'file://: no console errors {con.errors()[:3]}')
        page.close()
        # 2. sandboxed srcdoc preview (opaque origin: storage throws)
        host = srcdoc_host('single', SINGLE.read_text(encoding='utf-8'))
        page = b.new_page(viewport={'width': 1366, 'height': 768})
        con = Console(page)
        page.goto(host.as_uri())
        frame = child_frame(page)
        check_frame(c, frame, 'srcdoc')
        vol = frame.evaluate("() => !!document.querySelector('.px-banner, [data-volatile], .px-volatile')")
        c.ok(vol, 'srcdoc: the storage warning shows')
        frame.evaluate("() => PX.core.router.go('progress')")
        page.wait_for_timeout(500)
        c.ok(page.main_frame.child_frames and page.main_frame.child_frames[0].url.startswith('about:srcdoc'), 'srcdoc: frame never navigated away (only the hash mirror changes)')
        page.screenshot(path=str(ROOT / 'tests/e2e/out/single_srcdoc.png'))
        c.ok(not con.errors(), f'srcdoc: no console errors {con.errors()[:3]}')
        b.close()
    return c.summary({'version': r.get('version'), 'bytes': SINGLE.stat().st_size})


if __name__ == '__main__':
    sys.exit(main())
