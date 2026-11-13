"""Shared helpers for the DAT-style harness tests of B6 (Openings EX-14, Missing View EX-15, Form EX-19).

The dev harness loads only js/ex/<id>/{gen,learn,view}.js from disk, so an exercise that reads
another one's model (Missing View reads Views' block model) is opened as one inlined harness page
written to tests/e2e/out/<ex>/ and loaded from file:// (the same page as a sandboxed srcdoc frame is
tested separately). Every flow: stage non-blank, four or five options, a right answer by keyboard,
a wrong one by pointer or tap, show me to the end, no horizontal scroll, and at 360 x 640 the
stem and every answer control within one screen."""
import json

from common import OUT, Checks, Console, child_frame, inline_page, non_blank, srcdoc_host

READY = "() => window.__harness && __harness.state === 'respond'"
STATE = "(s) => window.__harness && __harness.state === s"
PHONE = {'device_scale_factor': 2, 'is_mobile': True, 'has_touch': True}


def page_doc(ex, cfg, deps=()):
    files = [f'js/ex/{d}/gen.js' for d in deps] + [f'js/ex/{ex}/{f}' for f in ('gen.js', 'learn.js', 'view.js')]
    return inline_page('tests/dev/harness.html', extra_scripts=files, cfg=dict(cfg, ex=ex, inlinedCss=True), extra_css=[f'css/ex/{ex}.css'])


def page_url(ex, cfg, deps=(), name='page'):
    d = OUT / ex
    d.mkdir(parents=True, exist_ok=True)
    f = d / f'harness_{name}.html'
    f.write_text(page_doc(ex, cfg, deps), encoding='utf-8')
    return f.as_uri()


def open_item(page, ex, cfg, deps=(), name='page'):
    page.goto(page_url(ex, cfg, deps, name))
    page.wait_for_function(READY, timeout=60000)


def stage_ok(C, target, sel, tag):
    ok, s = non_blank(target.locator(sel).screenshot(), min_distinct=6, max_top=0.985)
    C.ok(ok, f'{tag}: the stem is drawn ({s})')


def answer_keyboard(C, page, frame, tag):
    key = frame.evaluate('() => __harness.key')
    page.keyboard.press(str(key + 1))
    frame.wait_for_function(STATE, arg='reveal', timeout=10000)
    r = frame.evaluate('() => __harness.last')
    C.ok(r['result']['correct'] is True and r['source'] == 'key', f'{tag}: a right answer by keyboard scores right ({r["result"]}, {r["source"]})')


def answer_pointer(C, frame, n, tag, tap=False):
    key = frame.evaluate('() => __harness.key')
    cell = frame.locator('.hx-grid .px-choice').nth((key + 1) % n)
    cell.tap() if tap else cell.click()
    frame.wait_for_function(STATE, arg='reveal', timeout=10000)
    r = frame.evaluate('() => __harness.last')
    C.ok(r['result']['correct'] is False and r['source'] == 'pointer', f'{tag}: a wrong answer by {"tap" if tap else "pointer"} scores wrong ({r["result"]}, {r["source"]})')


def show_me(C, frame, tag, done_js, page=None):
    before = frame.evaluate('() => __harness.played.finished')
    if page is not None:
        page.keyboard.press('s')
    else:
        frame.evaluate('() => { __harness.showMe(); }')
    frame.wait_for_function('(n) => __harness.played.finished > n && __harness.state === "reveal"', arg=before, timeout=60000)
    ms = frame.evaluate('() => __harness.played.ms')
    end = frame.evaluate(done_js)
    C.ok(bool(end and end.get('ok')), f'{tag}: show me ran to the end ({ms} ms) and ends on the model\'s answer ({end})')


def no_hscroll(C, page, tag):
    sw = page.evaluate('() => [document.documentElement.scrollWidth, innerWidth]')
    C.ok(sw[0] <= sw[1], f'{tag}: no horizontal scroll ({sw})')


def fits(C, page, stem_sel, tag, budget=572):
    """At 360 x 640 the stem and every option fit one screen: the player's chrome takes the rest."""
    r = page.evaluate("""(sel) => {
        const s = document.querySelector(sel).getBoundingClientRect(), cells = Array.from(document.querySelectorAll('.hx-grid .px-choice'));
        const bottom = Math.max(...cells.map((c) => c.getBoundingClientRect().bottom)), minW = Math.min(...cells.map((c) => c.getBoundingClientRect().width));
        const minH = Math.min(...cells.map((c) => c.getBoundingClientRect().height));
        return { span: Math.round(bottom - s.top), stem: Math.round(s.height), minW: Math.round(minW), minH: Math.round(minH) }; }""", stem_sel)
    C.ok(r['span'] <= budget and r['minW'] >= 44 and r['minH'] >= 44, f'{tag}: stem and options span {r["span"]} px (≤ {budget}) with targets ≥ 44 px ({r})')
    return r


def sandboxed(C, b, cons, ex, cfg, deps, stem_sel, done_js, shot):
    doc = page_doc(ex, cfg, deps)
    host = srcdoc_host(f'harness_{ex}_srcdoc', doc)
    ctx = b.new_context(viewport={'width': 1366, 'height': 768})
    page = ctx.new_page()
    cons.append(Console(page))
    page.goto(host.as_uri())
    fr = child_frame(page)
    fr.wait_for_function(READY, timeout=60000)
    env = fr.evaluate('() => ({ origin: String(self.origin), href: location.href })')
    C.ok(env['origin'] == 'null' and env['href'] == 'about:srcdoc', f'srcdoc {ex}: runs in a sandboxed srcdoc frame ({env})')
    stage_ok(C, fr, stem_sel, f'srcdoc {ex}')
    fr.locator('.hx-goal').click()
    answer_keyboard(C, page, fr, f'srcdoc {ex}')
    show_me(C, fr, f'srcdoc {ex}', done_js, page=page)
    page.screenshot(path=str(shot))
    errs = fr.evaluate('() => __harness.errors')
    C.ok(not errs, f'srcdoc {ex}: no harness errors ({errs})')
    ctx.close()


def report(C, cons, extra):
    errors = [e for c in cons for e in c.errors()]
    C.ok(not errors, f'no console errors ({errors[:5]})')
    return C.summary(extra)


__all__ = ['READY', 'STATE', 'PHONE', 'page_doc', 'page_url', 'open_item', 'stage_ok', 'answer_keyboard', 'answer_pointer',
           'show_me', 'no_hscroll', 'fits', 'sandboxed', 'report', 'Checks', 'Console', 'json']
