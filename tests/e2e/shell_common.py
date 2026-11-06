"""Helpers for tests/e2e/shell.py (Python Playwright, headless Chromium).

ROOT is the repo (parallax/), OUT the folder for logs and screenshots. inline_single() turns
index.html into one HTML string (CSS, fonts and active scripts inlined) for the sandboxed
srcdoc test, the way hosted previews show the single-file build. Commented-out PENDING lines
in index.html are ignored, like the browser ignores them.
"""
import base64, json, pathlib, re, html as htmllib

ROOT = pathlib.Path(__file__).resolve().parents[2]
OUT = ROOT / 'tests' / 'e2e' / 'out' / 'shell'
OUT.mkdir(parents=True, exist_ok=True)
INDEX = ROOT / 'index.html'
DISCORD = 'https://discord.gg/chmr'
READY = 'document.documentElement.getAttribute("data-px-ready") === "1"'

# Console lines that are not app problems (software WebGL in headless Chromium).
BENIGN = ('GL Driver Message', 'Automatic fallback to software WebGL', 'GPU stall due to ReadPixels')


def attach_console(page):
    logs = []
    page.on('console', lambda m: logs.append(f'{m.type}: {m.text}'[:400]))
    page.on('pageerror', lambda e: logs.append(f'pageerror: {e}'[:400]))
    page.on('crash', lambda: logs.append('pageerror: CRASH'))
    return logs


def problems(logs, allow=()):
    """Errors and warnings, minus benign ones and the patterns in allow."""
    out = []
    for line in logs:
        if not line.startswith(('error', 'pageerror', 'warning')):
            continue
        if any(b in line for b in BENIGN) or any(a in line for a in allow):
            continue
        out.append(line)
    return out


def strip_comments(text):
    return re.sub(r'<!--.*?-->', '', text, flags=re.S)


def active_assets(text=None):
    """(stylesheets, scripts) that index.html loads, in order, outside comments."""
    t = strip_comments(text if text is not None else INDEX.read_text())
    css = re.findall(r'<link\s+rel="stylesheet"\s+href="([^"]+)"\s*/?>', t)
    js = re.findall(r'<script\s+src="([^"]+)"\s*>\s*</script>', t)
    return css, js


def pending_scripts():
    """Script paths named only inside comments of index.html."""
    t = INDEX.read_text()
    inside = ' '.join(re.findall(r'<!--(.*?)-->', t, flags=re.S))
    return re.findall(r'<script\s+src="([^"]+)"', inside)


def _font_data_uris(css, css_path):
    def rep(m):
        target = (css_path.parent / m.group(1)).resolve()
        data = base64.b64encode(target.read_bytes()).decode('ascii')
        return f'url("data:font/woff2;base64,{data}")'
    return re.sub(r'url\("([^"]+\.woff2)"\)', rep, css)


def inline_single():
    """index.html with every active stylesheet and script inlined."""
    t = strip_comments(INDEX.read_text())

    def css_rep(m):
        p = ROOT / m.group(1)
        return '<style>\n' + _font_data_uris(p.read_text(), p) + '\n</style>'

    def js_rep(m):
        src = (ROOT / m.group(1)).read_text()
        if '</script' in src.lower():
            src = re.sub(r'</(script)', r'<\\/\1', src, flags=re.I)
        return '<script>\n' + src + '\n</script>'

    t = re.sub(r'<link\s+rel="stylesheet"\s+href="([^"]+)"\s*/?>', css_rep, t)
    t = re.sub(r'<script\s+src="([^"]+)"\s*>\s*</script>', js_rep, t)
    return t


def write_host(single_html, path, sandbox='allow-scripts'):
    """A host page that shows single_html in <iframe sandbox srcdoc> (like hosted previews)."""
    doc = ('<!doctype html><html lang="en"><head><meta charset="utf-8">'
           '<meta name="viewport" content="width=device-width, initial-scale=1">'
           '<title>srcdoc host</title><style>html,body{margin:0;height:100%;background:#777}'
           'iframe{display:block;border:0;width:100%;height:100vh}</style></head><body>'
           f'<iframe id="pv" title="preview" sandbox="{sandbox}" srcdoc="{htmllib.escape(single_html, quote=True)}"></iframe>'
           '</body></html>')
    path.write_text(doc)
    return path


def child_frame(page, timeout_ms=10000):
    step = 100
    for _ in range(timeout_ms // step):
        if page.main_frame.child_frames:
            return page.main_frame.child_frames[0]
        page.wait_for_timeout(step)
    raise RuntimeError('no child frame')


class Results:
    def __init__(self):
        self.rows = []

    def check(self, name, ok, detail=''):
        self.rows.append({'name': name, 'ok': bool(ok), 'detail': detail if not ok else ''})
        mark = 'PASS' if ok else 'FAIL'
        print(f'{mark}  {name}' + (f'  ({detail})' if detail and not ok else ''), flush=True)
        return ok

    @property
    def failed(self):
        return [r for r in self.rows if not r['ok']]

    def dump(self, extra=None):
        data = {'passed': len(self.rows) - len(self.failed), 'failed': len(self.failed), 'rows': self.rows}
        if extra:
            data.update(extra)
        (OUT / 'results.json').write_text(json.dumps(data, indent=1))
        return data
