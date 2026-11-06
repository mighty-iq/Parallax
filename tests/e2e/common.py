"""Shared helpers for the Parallax Playwright tests (Python, headless Chromium).

    launch(p)                   Chromium as in spike/RESULTS.md: Playwright's defaults already give
                                WebGL 2 on SwiftShader (it adds --enable-unsafe-swiftshader); adding
                                --use-angle=swiftshader is harmless and keeps it explicit
    file_url(path, **query)     file:// URL of a repo file (path relative to parallax/) with a query
    Console(page)               records console messages and page errors; errors() leaves out the
                                known SwiftShader driver noise
    img_stats(png) / non_blank(png)   distinct colours and top-colour share (a blank picture has one
                                colour on ≥ 99.7 % of its pixels)
    inline_page(html_path, ...) one self-contained document: scripts, stylesheets and fonts inlined
    srcdoc_host(name, doc)      a host page that shows a document as <iframe sandbox="allow-scripts"
                                srcdoc=…>, like sandboxed previews (opaque origin, no storage)
    harness_single(ex, cfg)     the dev harness with exercise `ex` inlined (for srcdoc and single-file runs)
    Checks                      pass/fail recorder: ok(cond, msg), summary(), exit code
    OUT                         tests/e2e/out/ (screenshots and reports; git-ignored)
At most two Playwright sessions at once on the build machine (CLAUDE.md, context economy). """
import base64
import html
import io
import json
import pathlib
import re
import sys

ROOT = pathlib.Path(__file__).resolve().parents[2]
OUT = ROOT / 'tests' / 'e2e' / 'out'
OUT.mkdir(parents=True, exist_ok=True)

LAUNCH_ARGS = ['--use-angle=swiftshader', '--enable-unsafe-swiftshader']

# Messages SwiftShader prints on its own (spike/RESULTS.md): not page errors.
NOISE = (
    'GPU stall due to ReadPixels',
    'Automatic fallback to software WebGL has been deprecated',
    'GL Driver Message',
    'WebGL: INVALID_OPERATION',  # none expected; listed so a driver quirk shows as a warning
)


def launch(p, **kw):
    return p.chromium.launch(headless=True, args=LAUNCH_ARGS, **kw)


def file_url(path, **query):
    url = (ROOT / path).as_uri()
    q = '&'.join(f'{k}={v}' for k, v in query.items() if v is not None)
    return url + ('?' + q if q else '')


class Console:
    """Console messages and page errors of a page (all its frames)."""

    def __init__(self, page):
        self.lines = []
        page.on('console', lambda m: self.lines.append((m.type, m.text[:400])))
        page.on('pageerror', lambda e: self.lines.append(('pageerror', str(e)[:400])))
        page.on('crash', lambda: self.lines.append(('pageerror', 'page crashed')))

    def errors(self):
        return [f'{t}: {x}' for t, x in self.lines if t in ('error', 'pageerror') and not any(n in x for n in NOISE)]

    def warnings(self):
        return [f'{t}: {x}' for t, x in self.lines if t == 'warning' and not any(n in x for n in NOISE)]


def img_stats(png):
    import numpy as np
    from PIL import Image
    a = np.asarray(Image.open(io.BytesIO(png)).convert('RGB')).astype(np.int32)
    packed = (a[..., 0] << 16) | (a[..., 1] << 8) | a[..., 2]
    vals, counts = np.unique(packed, return_counts=True)
    return {'w': int(a.shape[1]), 'h': int(a.shape[0]), 'distinct': int(vals.size), 'top': round(float(counts.max() / packed.size), 4)}


def non_blank(png, min_distinct=24, max_top=0.985):
    s = img_stats(png)
    return s['distinct'] >= min_distinct and s['top'] <= max_top, s


class Checks:
    def __init__(self, name):
        self.name, self.passed, self.failed = name, 0, []

    def ok(self, cond, msg):
        if cond:
            self.passed += 1
        else:
            self.failed.append(msg)
            print('  FAIL', msg, flush=True)
        return bool(cond)

    def summary(self, extra=None):
        report = {'test': self.name, 'passed': self.passed, 'failed': self.failed}
        if extra:
            report.update(extra)
        (OUT / f'{self.name}.json').write_text(json.dumps(report, indent=1))
        status = 'FAILED' if self.failed else 'ok'
        print(f'{status}: {self.name}: {self.passed} passed, {len(self.failed)} failed')
        return 1 if self.failed else 0


# ---------- inlining (sandboxed srcdoc frames cannot load anything from disk) ----------

SCRIPT_RE = re.compile(r'<script src="([^"]+)"></script>')
LINK_RE = re.compile(r'<link rel="stylesheet" href="([^"]+)">')
URL_RE = re.compile(r'url\("?([^")]+)"?\)')
MIME = {'.woff2': 'font/woff2', '.woff': 'font/woff', '.png': 'image/png', '.svg': 'image/svg+xml'}


def _safe_js(js, src):
    # An inline script ends at the first "</script"; "<!--" can confuse the HTML tokenizer.
    if re.search(r'</script', js, re.I) or '<!--' in js:
        raise ValueError(f'{src} contains </script or <!-- and cannot be inlined')
    return js


def _css_inline(path):
    css = path.read_text(encoding='utf-8')

    def data_uri(m):
        ref = m.group(1)
        if ref.startswith('data:'):
            return m.group(0)
        f = (path.parent / ref).resolve()
        if not f.exists():
            return m.group(0)
        b64 = base64.b64encode(f.read_bytes()).decode('ascii')
        return f'url("data:{MIME.get(f.suffix, "application/octet-stream")};base64,{b64}")'
    return URL_RE.sub(data_uri, css).replace('</style', '<\\/style')


def inline_page(html_path, extra_scripts=(), before='harness.js', cfg=None, extra_css=()):
    """html_path: page to inline (relative to parallax/). extra_scripts: repo-relative files
    inlined just before the script whose src ends with `before`. cfg: JSON for PX_HARNESS_CFG."""
    page = ROOT / html_path
    doc = page.read_text(encoding='utf-8')

    def link(m):
        return '<style>/* inlined: %s */\n%s\n</style>' % (m.group(1), _css_inline((page.parent / m.group(1)).resolve()))
    doc = LINK_RE.sub(link, doc)
    extra_style = ''.join('<style>/* inlined: %s */\n%s\n</style>\n' % (c, _css_inline(ROOT / c)) for c in extra_css)
    if extra_style:
        doc = doc.replace('</head>', extra_style + '</head>', 1)

    def script(m):
        src = m.group(1)
        js = _safe_js((page.parent / src).resolve().read_text(encoding='utf-8'), src)
        out = '<script>/* inlined: %s */\n%s\n</script>' % (src, js)
        if src.endswith(before):
            pre = ''.join('<script>/* inlined: %s */\n%s\n</script>\n' % (f, _safe_js((ROOT / f).read_text(encoding='utf-8'), f)) for f in extra_scripts)
            out = pre + out
        return out
    doc = SCRIPT_RE.sub(script, doc)
    if cfg is not None:
        doc = doc.replace('<script>', '<script>window.PX_HARNESS_CFG = %s;</script>\n<script>' % json.dumps(cfg), 1)
    return doc


def srcdoc_host(name, single_doc):
    host = ('<!doctype html><html lang="en"><head><meta charset="utf-8">'
            '<meta name="viewport" content="width=device-width, initial-scale=1">'
            '<title>Sandboxed srcdoc host</title>'
            '<style>html,body{margin:0;height:100%;background:#777}iframe{display:block;border:0;width:100%;height:100vh}</style>'
            '</head><body><iframe id="pv" title="preview" sandbox="allow-scripts" srcdoc="'
            + html.escape(single_doc, quote=True) + '"></iframe></body></html>')
    path = OUT / f'{name}.host.html'
    path.write_text(host, encoding='utf-8')
    return path


def harness_single(ex, cfg):
    """The harness with exercise `ex` inlined; css/ex/<ex>.css is inlined when it exists."""
    files = [f'js/ex/{ex}/{f}' for f in ('gen.js', 'learn.js', 'view.js') if (ROOT / f'js/ex/{ex}/{f}').exists()]
    css = [f'css/ex/{ex}.css'] if (ROOT / f'css/ex/{ex}.css').exists() else []
    cfg = dict(cfg, ex=ex, inlinedCss=True)
    return inline_page('tests/dev/harness.html', extra_scripts=files, cfg=cfg, extra_css=css)


def child_frame(page, timeout_ms=15000):
    for _ in range(timeout_ms // 100):
        if page.main_frame.child_frames:
            return page.main_frame.child_frames[0]
        page.wait_for_timeout(100)
    raise RuntimeError('no child frame')


def active_scripts(html_text):
    """<script src> of a page outside HTML comments (the active ones)."""
    text = re.sub(r'<!--.*?-->', '', html_text, flags=re.S)
    return SCRIPT_RE.findall(text)


if __name__ == '__main__':
    print('helpers only; run a test such as tests/e2e/harness_rotate.py', file=sys.stderr)
