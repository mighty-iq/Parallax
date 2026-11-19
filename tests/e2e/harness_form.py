"""E2E: the dev harness with Form (EX-19, a DAT-style format). Owner B6.
Run:  tests/e2e/pwslot.sh python3 tests/e2e/harness_form.py

1. desktop 1366 x 768 and phone 390 x 844 (DPR 2, touch), light and dark: the pattern is drawn with
   cut edges and fold lines (dashed on the starter band, plain from the plain kind on: version 3);
   four solids at one scale; a right answer by keyboard, a wrong one by
   pointer or tap; marks in their own tone with a hatch of at least 4 px; show me letters a
   landmark face in the pattern and in the right solid (after a wrong size: the edge that differs
   marked in the solid and in the pattern; after a solid of another kind: a face the pattern lacks;
   after another wrong pick: the face that cannot be marked so); no horizontal scroll
2. 360 x 640: the stem and all four solids within one screen, targets >= 44 px
3. show me at normal speed, the tutorial demo with captions; the Watch's tour of both wrong kinds; the
   worked examples (the plain kind's: fold lines lit, then shapes and sizes; a half mark's)
4. the harness inlined into a sandboxed srcdoc frame; no console errors
Screenshots: tests/e2e/out/form/form_<case>_<viewport>_<theme>[_reveal|_showme|_wrong_showme].png """
import sys

from playwright.sync_api import sync_playwright

from common import OUT, Checks, Console, file_url, launch
from patb_common import PHONE, READY, STATE, answer_keyboard, answer_pointer, fits, no_hscroll, report, sandboxed, show_me, stage_ok

C = Checks('harness_form')
EX, DIR, STEM = 'form', OUT / 'form', '.fm-stage'
DIR.mkdir(parents=True, exist_ok=True)
CASES = {  # name: (params, seed); version 3's kinds
    'band': ('solid:0,marks:0,view:0,foil:0', 12),  # v1.2: the starter band
    'plain': ('solid:0,marks:1,view:0,foil:0', 5),  # no marks, two kinds of solid (the wrong pick: another kind)
    'plainsizes': ('solid:1,marks:1,view:1,foil:1', 8),  # no marks, one kind in four proportions
    'shaded': ('solid:1,marks:2,view:1,foil:0', 6),  # two shaded faces
    'half': ('solid:2,marks:4,view:2,foil:1', 8),  # two shaded and a half mark
}
PLAIN = {'plain', 'plainsizes'}
DONE = """() => {
    const it = __harness.item, cells = document.querySelectorAll('.hx-grid .px-choice'), wrong = !__harness.last.result.correct;
    const netTags = document.querySelectorAll('.fm-svg .fm-tag').length, keyTags = cells[it.key].querySelectorAll('.fm-tag').length;
    const bad = document.querySelectorAll('.fm-tag--bad').length, pk = __harness.last.response, kind = typeof pk === 'number' ? it.options[pk].kind : '';
    const edges = document.querySelectorAll('.fm-edge-hl').length;
    const fold = document.querySelector('svg.fm-foldup'), folded = !!fold && fold.style.display !== 'none' && fold.querySelectorAll('path.px-fig-face').length >= 3;
    const other = typeof pk === 'number' && it.options[pk].solid.kind !== it.solid.kind;
    const ok = wrong ? (kind === 'shape' ? cells[pk].classList.contains('ex-focus') && (other ? bad >= 1 : edges >= 2) : bad >= 1) : (folded && cells[it.key].classList.contains('ex-focus')) || (netTags >= 1 && keyTags >= 1);
    return { ok, netTags, keyTags, bad, edges, wrong, kind, other, folded }; }"""


def go(page, case, theme='light', fast=True, seed_add=0):
    params, seed = CASES[case]
    page.goto(file_url('tests/dev/harness.html', ex=EX, seed=seed + seed_add, p=params, fast=1 if fast else None, theme=theme))
    page.wait_for_function(READY, timeout=60000)


def stem_ok(page, tag, case):
    r = page.evaluate("""() => { const f = document.querySelector('.fm-fold'), c = document.querySelector('.fm-cut');
        return { faces: document.querySelectorAll('.fm-netface').length, cut: (c || { getAttribute: () => '' }).getAttribute('d').length,
        fold: (f || { getAttribute: () => '' }).getAttribute('d').length, marks: document.querySelectorAll('.fm-svg .fm-mark').length,
        plain: !!f && f.classList.contains('fm-fold--plain'), dash: f ? getComputedStyle(f).strokeDasharray : '', foldW: f ? getComputedStyle(f).strokeWidth : '', cutW: c ? getComputedStyle(c).strokeWidth : '',
        opts: Array.from(document.querySelectorAll('.hx-grid .fm-opt-svg')).map((s) => ({ vb: s.getAttribute('viewBox').split(' ')[2], w: Math.round(s.getBoundingClientRect().width), f: s.querySelectorAll('.px-fig-face').length })) }; }""")
    marked = case not in PLAIN
    C.ok(r['faces'] >= 4 and r['cut'] > 10 and r['fold'] > 10 and (r['marks'] >= 1) == marked, f'{tag}: the pattern shows faces, cut edges, fold lines and {"marks" if marked else "no mark"} ({r["faces"]}, {r["marks"]})')
    plain = case != 'band'
    C.ok(r['plain'] == plain and ((r['dash'] in ('none', '')) == plain) and (not plain or r['foldW'] == r['cutW']), f'{tag}: fold lines {"drawn plain like cut edges" if plain else "dashed"} ({r["dash"]}, fold {r["foldW"]}, cut {r["cutW"]})')
    o = r['opts']
    C.ok(len(o) == 4 and len({x['vb'] for x in o}) == 1 and all(x['w'] >= 60 and x['f'] >= 2 for x in o), f'{tag}: four solids at one scale, each at least 60 px with two or more faces ({o})')
    # A mark has its own tone (never the far-lit face's) and a hatch of at least 4 px in every solid.
    t = page.evaluate("""() => Array.from(document.querySelectorAll('.hx-grid .fm-opt-svg')).map((s) => {
        const bg = s.querySelector('.fm-hatch-bg'), pat = s.querySelector('pattern'), probe = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        probe.setAttribute('class', 'px-fig-face px-fig-far'); s.appendChild(probe);
        const far = getComputedStyle(probe).fill; probe.remove();
        const b = s.getBoundingClientRect(), k = Math.min(b.width, b.height) / s.viewBox.baseVal.width;
        return { mark: getComputedStyle(bg).fill, far, pitch: Math.round(+pat.getAttribute('width') * k * 10) / 10 }; })""")
    C.ok(all(x['mark'] != x['far'] and x['pitch'] >= 4 for x in t), f'{tag}: marks have their own tone and a hatch of at least 4 px ({t[0]}, pitches {[x["pitch"] for x in t]})')


def desktop_and_phone(b, cons):
    for vp, tag, kw in [((1366, 768), '1366', {}), ((390, 844), '390', PHONE)]:
        ctx = b.new_context(viewport={'width': vp[0], 'height': vp[1]}, **kw)
        page = ctx.new_page()
        cons.append(Console(page))
        phone = tag == '390'
        for case in CASES:
            for theme in ('light', 'dark'):
                name = f'form_{case}_{tag}_{theme}'
                go(page, case, theme)
                stage_ok(C, page, STEM, name)
                stem_ok(page, name, case)
                page.screenshot(path=str(DIR / f'{name}.png'), full_page=True)
                if phone:
                    no_hscroll(C, page, name)
                if theme == 'light':
                    answer_keyboard(C, page, page, name)
                    page.screenshot(path=str(DIR / f'{name}_reveal.png'), full_page=True)
                    show_me(C, page, name, DONE, page=page)
                    page.screenshot(path=str(DIR / f'{name}_showme.png'), full_page=True)
                    page.keyboard.press('Space')
                    page.wait_for_function(READY, timeout=10000)
                    answer_pointer(C, page, 4, name, tap=phone)
                    show_me(C, page, name + ' (after a wrong pick)', DONE)
                    page.screenshot(path=str(DIR / f'{name}_wrong_showme.png'), full_page=True)
                errs = page.evaluate('() => __harness.errors')
                C.ok(not errs, f'{name}: no harness errors ({errs})')
        ctx.close()


def small_phone(b, cons):
    ctx = b.new_context(viewport={'width': 360, 'height': 640}, **PHONE)
    page = ctx.new_page()
    cons.append(Console(page))
    for case in CASES:
        name = f'form_{case}_360'
        go(page, case, seed_add=1)
        page.evaluate("() => document.querySelector('.fm-stage').scrollIntoView({ block: 'start' })")
        fits(C, page, STEM, name)
        no_hscroll(C, page, name)
        page.screenshot(path=str(DIR / f'{name}.png'))
    ctx.close()


def normal_speed(b, cons):
    ctx = b.new_context(viewport={'width': 1366, 'height': 768})
    page = ctx.new_page()
    cons.append(Console(page))
    go(page, 'shaded', fast=False)
    page.evaluate('() => __harness.answer(false)')
    page.wait_for_function(STATE, arg='reveal', timeout=10000)
    before = page.evaluate('() => __harness.played.finished')
    page.evaluate('() => { __harness.showMe(); }')
    page.wait_for_timeout(5600)
    page.screenshot(path=str(DIR / 'form_showme_mid.png'))
    page.wait_for_function('(n) => __harness.played.finished > n', arg=before, timeout=120000)
    pl = page.evaluate('() => __harness.played')
    # v1.2: the card's steps, a half mark's corner, the fold-up (O51) and why the pick is wrong: 2-4 s a
    # movement (EXERCISE-GUIDE), so up to about 21 s; the player can pause, step or close it
    C.ok(6000 <= pl['plannedMs'] <= 24000, f'show me plans 6-24 s at normal speed ({pl})')
    go(page, 'plain')
    before = page.evaluate('() => __harness.played.finished')
    page.evaluate('() => { __harness.demo(); }')
    page.wait_for_function('(n) => __harness.played.finished > n', arg=before, timeout=40000)
    cap = page.locator('.hx-caption').inner_text()
    C.ok(len(cap) > 10, f'the demo plays to the end with captions ({cap!r})')
    # The Watch item (learn.js demo, the starter band), v1.2: three captions (each waits for a tap in the
    # player): the wrong size with the edge that differs marked in the solid and in the pattern; the
    # shaded face and its neighbours; the check, with the shade on a wrong face crossed out, the fold-up,
    # and the end back on the right solid with no wrong solid marked. (The mirror image needs a half
    # mark: Try 3's worked example and tip bring it.)
    page.goto(file_url('tests/dev/harness.html', ex=EX, seed=5, p='solid:0,marks:0,view:0,foil:0', fast=1))
    page.wait_for_function(READY, timeout=60000)
    w = page.evaluate("""() => { const it = __harness.item, list = PX.ex.view('form').demoSteps(it), out = {};
        list.forEach((s, i) => { s.enter(); const t = s.caption || '';
          if (t.indexOf('marked edge') >= 0) out.edge = document.querySelectorAll('.fm-edge-hl').length;
          if (t.indexOf('3/3') === 0) out.marks = document.querySelectorAll('.fm-tag--bad').length; });
        const last = list[list.length - 1]; last.enter();
        const cells = document.querySelectorAll('.hx-grid .px-choice'), fold = document.querySelector('svg.fm-foldup');
        return { n: list.length, captions: list.filter((s) => s.caption).length, edge: out.edge || 0, marks: out.marks || 0, endsOnKey: cells[it.key].classList.contains('ex-focus'),
          clean: document.querySelectorAll('.fm-tag--bad, .fm-edge-hl').length === 0 && (!fold || fold.style.display === 'none') }; }""")
    C.ok(w['captions'] == 3 and w['edge'] >= 2 and w['marks'] >= 1 and w['endsOnKey'] and w['clean'], f'the Watch has three captions: a wrong-size solid (edge marked in solid and pattern), the landmark, the check with a shade on the wrong face crossed out; it ends on the answer with nothing wrong marked ({w})')
    # the worked example of the plain kind (Try 3's, version 3): three captions, the fold lines lit, the
    # solids of another kind crossed out with the wrong size's edge, the solid left (then the fold-up)
    page.goto(file_url('tests/dev/harness.html', ex=EX, seed=8, p='solid:0,marks:1,view:0,foil:0', fast=1))
    page.wait_for_function(READY, timeout=60000)
    y = page.evaluate("""() => { const it = __harness.item, list = PX.ex.view('form').demoSteps(it), out = { lit: 0, crossed: 0, edges: 0 };
        list.forEach((s) => { s.enter(); const t = s.caption || '';
          if (t.indexOf('1/3') === 0) out.lit = document.querySelectorAll('.fm-fold.is-lit').length;
          if (t.indexOf('2/3') === 0) { out.crossed = document.querySelectorAll('.hx-grid .fm-tag--bad').length; out.edges = document.querySelectorAll('.fm-edge-hl').length; } });
        const caps = list.filter((s) => s.caption).map((s) => s.caption.slice(0, 3)), cells = document.querySelectorAll('.hx-grid .px-choice');
        return { captions: caps.length, nums: caps.join(','), lit: out.lit, crossed: out.crossed, edges: out.edges, endsOnKey: cells[it.key].classList.contains('ex-focus'), unlit: document.querySelectorAll('.fm-fold.is-lit').length === 0 }; }""")
    C.ok(y['captions'] == 3 and y['nums'] == '1/3,2/3,3/3' and y['lit'] == 1 and y['crossed'] >= 2 and y['edges'] >= 2 and y['endsOnKey'] and y['unlit'], f'the plain kind\'s worked example: fold lines lit, two solids of another kind crossed out and the wrong size\'s edge marked, the solid left ({y})')
    for name, pat in (('lines', '1/3'), ('out', '2/3')):
        page.evaluate("""(pat) => { const list = PX.ex.view('form').demoSteps(__harness.item), s = list.find((x) => (x.caption || '').indexOf(pat) === 0); if (s) s.enter(); }""", pat)
        page.screenshot(path=str(DIR / f'form_plain_example_{name}.png'))
    # the worked example of a half mark (any item with one): three captions, the half mark's corner, the mirror image, the solid that keeps it
    page.goto(file_url('tests/dev/harness.html', ex=EX, seed=2, p='solid:0,marks:3,view:0,foil:0', fast=1))
    page.wait_for_function(READY, timeout=60000)
    x = page.evaluate("""() => { const it = __harness.item, list = PX.ex.view('form').demoSteps(it), out = { corner: 0, mirror: 0 };
        list.forEach((s) => { s.enter(); const t = s.caption || '';
          if (/half-shaded/.test(t)) out.corner = document.querySelectorAll('.fm-corner').length;
          if (/mirror image/.test(t)) out.mirror = document.querySelectorAll('.fm-tag--bad').length; });
        const caps = list.filter((s) => s.caption).map((s) => s.caption.slice(0, 3));
        return { captions: caps.length, nums: caps.join(','), corner: out.corner, mirror: out.mirror }; }""")
    C.ok(x['captions'] == 3 and x['nums'] == '1/3,2/3,3/3' and x['corner'] >= 1 and x['mirror'] >= 1, f'the worked example of a half mark has three captions: the dotted corner, the mirror image crossed out, the solid that keeps it ({x})')
    page.screenshot(path=str(DIR / 'form_demo_end.png'))
    page.goto(file_url('tests/dev/harness.html', ex=EX, seed=5, p='solid:0,marks:0,view:0,foil:0', fast=1))
    page.wait_for_function(READY, timeout=60000)
    for name, pat in (('wrongsize', 'marked edge'), ('marks', '3/3')):
        page.evaluate("""(pat) => { const list = PX.ex.view('form').demoSteps(__harness.item), s = list.find((x) => (x.caption || '').indexOf(pat) >= 0); if (s) s.enter(); }""", pat)
        page.screenshot(path=str(DIR / f'form_demo_{name}.png'))
    ctx.close()
    return pl


def main():
    cons = []
    with sync_playwright() as p:
        b = launch(p)
        desktop_and_phone(b, cons)
        small_phone(b, cons)
        pl = normal_speed(b, cons)
        sandboxed(C, b, cons, EX, {'seed': 41, 'p': CASES['shaded'][0], 'fast': True}, (), STEM, DONE, DIR / 'form_srcdoc.png')
        b.close()
    return report(C, cons, {'showMe': pl, 'screenshots': sorted(x.name for x in DIR.glob('form_*.png'))})


if __name__ == '__main__':
    sys.exit(main())
