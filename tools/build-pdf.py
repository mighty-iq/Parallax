#!/usr/bin/env python3
"""Render the user guide to docs/Parallax-Guide.pdf and check it.

    tests/e2e/pwslot.sh python3 tools/build-pdf.py [--png DIR] [--force]

1. Opens docs/guide/guide.html in headless Chromium (Playwright), waits for its fonts, images and
   page furniture (data-ready), and checks the print layout: every page is a fixed A4 sheet, so any
   element that sticks out of its page or its exercise card is reported, and the build stops
   (--force writes the PDF anyway).
2. Prints it with page.pdf: A4 from the CSS, backgrounds on, a document outline from the headings,
   tagged PDF.
3. Checks the PDF with pypdf: every external link of the page is a clickable link annotation with
   its URL, the page count is sensible (28 to 40), placeholder figures are listed; then adds the
   document metadata.
4. --png DIR: rasterises every page at 60 dpi with pdftoppm (for looking at the layout).
Figures come from tools/shots.py (docs/shots/). Runs through tests/e2e/pwslot.sh (two browser slots). """
import json
import pathlib
import shutil
import subprocess
import sys

ROOT = pathlib.Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / 'tests' / 'e2e'))
from playwright.sync_api import sync_playwright  # noqa: E402

from common import Console, launch  # noqa: E402

HTML = ROOT / 'docs' / 'guide' / 'guide.html'
PDF = ROOT / 'docs' / 'Parallax-Guide.pdf'
PAGES_OK = (28, 40)
META = {
    '/Title': 'Parallax: user guide',
    '/Author': 'Parallax contributors and the Chimera community (discord.gg/chmr)',
    '/Subject': 'What Parallax does, how to use it, and the research behind it. Version 1.0.0.',
    '/Keywords': 'Parallax, visuospatial, spatial ability, mental rotation, training, transfer, Chimera',
    '/Creator': 'tools/build-pdf.py (Chromium via Playwright)',
}

# Elements that stick out of their sheet (or of a fixed-height exercise card), in print layout.
OVERFLOW = """() => {
  const out = [], tol = 0.75;
  const boxes = Array.from(document.querySelectorAll('section.page')).map((pg, i) => ({ pg, i }));
  function name(e) {
    const t = (e.textContent || '').trim().replace(/\\s+/g, ' ').slice(0, 60);
    return e.tagName.toLowerCase() + (e.className && typeof e.className === 'string' ? '.' + e.className.split(' ')[0] : '') + (t ? ' "' + t + '"' : '');
  }
  for (const { pg, i } of boxes) {
    const P = pg.getBoundingClientRect();
    const cs = getComputedStyle(pg);
    const inner = { top: P.top + parseFloat(cs.paddingTop), bottom: P.bottom - parseFloat(cs.paddingBottom),
                    left: P.left + parseFloat(cs.paddingLeft), right: P.right - parseFloat(cs.paddingRight) };
    const content = pg.querySelector('.content');
    if (!content) continue;
    let worst = null, by = tol;     // the element that sticks out furthest (corner ticks are drawn outside on purpose)
    for (const e of content.querySelectorAll('*')) {
      if (e.classList.contains('tk')) continue;
      const r = e.getBoundingClientRect();
      if (!r.width && !r.height) continue;
      const d = Math.max(r.bottom - inner.bottom, r.right - inner.right, inner.left - r.left);
      if (d > by) { by = d; worst = e; }
    }
    if (worst) out.push({ page: i + 1, what: name(worst), by_mm: Math.round(by * 25.4 / 96 * 10) / 10 });
    for (const card of pg.querySelectorAll('.ex-card')) {
      const C = card.getBoundingClientRect();
      let worst = null, by = tol;
      for (const e of card.querySelectorAll('*')) {
        if (e.classList.contains('tk')) continue;
        const r = e.getBoundingClientRect();
        if ((r.width || r.height) && r.bottom - C.bottom > by) { by = r.bottom - C.bottom; worst = e; }
      }
      if (worst) out.push({ page: i + 1, card: card.id || 'extra', what: name(worst), by_mm: Math.round(by * 25.4 / 96 * 10) / 10 });
    }
  }
  return out;
}"""
# Free space at the bottom of each sheet (mm), to balance pages.
SLACK = """() => Array.from(document.querySelectorAll('section.page')).map((pg, i) => {
  const c = pg.querySelector('.content'); if (!c) return null;
  const cs = getComputedStyle(pg), P = pg.getBoundingClientRect();
  const bottom = P.bottom - parseFloat(cs.paddingBottom);
  let last = P.top;
  for (const e of c.children) { const r = e.getBoundingClientRect(); if (r.height) last = Math.max(last, r.bottom); }
  return Math.round((bottom - last) * 25.4 / 96);
})"""


def check_pdf(path, urls):
    from pypdf import PdfReader, PdfWriter
    reader = PdfReader(str(path))
    found, internal = {}, 0
    for i, page in enumerate(reader.pages):
        for a in page.get('/Annots') or []:
            o = a.get_object()
            if o.get('/Subtype') != '/Link':
                continue
            act = o.get('/A')
            uri = act.get_object().get('/URI') if act is not None else None
            if uri:
                found.setdefault(str(uri), []).append(i + 1)
            else:
                internal += 1
    norm = lambda u: u.rstrip('/')
    have = {norm(u) for u in found}
    missing = sorted({u for u in urls if norm(u) not in have})
    writer = PdfWriter(clone_from=reader)
    writer.add_metadata(META)
    with open(path, 'wb') as f:
        writer.write(f)
    return len(reader.pages), found, internal, missing


def main(args):
    png_dir = args[args.index('--png') + 1] if '--png' in args else None
    force = '--force' in args
    with sync_playwright() as p:
        b = launch(p)
        page = b.new_page()
        cons = Console(page)
        page.goto(HTML.as_uri())
        page.emulate_media(media='print')
        page.wait_for_function("() => document.documentElement.getAttribute('data-ready') === '1'", timeout=60000)
        page.wait_for_timeout(300)
        broken = page.evaluate("() => Array.from(document.images).filter(i => !i.naturalWidth).map(i => i.getAttribute('src'))")
        over = page.evaluate(OVERFLOW)
        slack = page.evaluate(SLACK)
        urls = page.evaluate("() => Array.from(new Set(Array.from(document.querySelectorAll('a[href]')).map(a => a.href).filter(h => /^https?:/.test(h))))")
        pending = page.evaluate("() => Array.from(document.querySelectorAll('figure.pending img')).map(i => i.getAttribute('src').split('/').pop())")
        npages = page.evaluate("() => document.querySelectorAll('section.page').length")
        print(f'{npages} sheets; free space at the bottom (mm): {slack}')
        if broken:
            print('MISSING IMAGES:', broken)
        for o in over:
            print('OVERFLOW:', json.dumps(o, ensure_ascii=False))
        if (over or broken) and not force:
            b.close()
            print('not written: fix the layout above (or pass --force)')
            return 1
        page.pdf(path=str(PDF), prefer_css_page_size=True, print_background=True, outline=True, tagged=True,
                 margin={'top': '0', 'right': '0', 'bottom': '0', 'left': '0'})
        errs = cons.errors()
        b.close()
    n, found, internal, missing = check_pdf(PDF, urls)
    print(f'{PDF.relative_to(ROOT)}: {n} pages, {PDF.stat().st_size / 1024:.0f} KiB')
    print(f'links: {len(urls)} external URLs in the guide, {sum(len(v) for v in found.values())} external link annotations, {internal} internal')
    if missing:
        print('NOT CLICKABLE:', missing)
    if not PAGES_OK[0] <= n <= PAGES_OK[1]:
        print(f'PAGE COUNT {n} is outside {PAGES_OK}')
    if pending:
        print('figure slots still showing placeholders:', ', '.join(pending))
    if errs:
        print('console errors:', errs[:5])
    if png_dir:
        out = pathlib.Path(png_dir)
        out.mkdir(parents=True, exist_ok=True)
        if shutil.which('pdftoppm'):
            subprocess.run(['pdftoppm', '-r', '60', '-png', str(PDF), str(out / 'page')], check=True)
            print(f'pages rasterised to {out}')
        else:
            print('pdftoppm not found: no page images')
    return 1 if (missing or errs) else 0


if __name__ == '__main__':
    sys.exit(main(sys.argv[1:]))
