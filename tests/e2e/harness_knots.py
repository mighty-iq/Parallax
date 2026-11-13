"""E2E: the dev harness with Knots (EX-13, SVG).
Run:  tests/e2e/pwslot.sh python3 tests/e2e/harness_knots.py   (two browser slots per machine)

1. desktop 1366 × 768 and phone 390 × 844 (DPR 2, touch), light and dark, every variant (pull,
   untie, tie, link) at an easy and a hard setting: the plate is non-blank; the rope is drawn with
   one top-strand casing per crossing of the item; untie and tie show four tags A–D, the others
   none; a right answer by keyboard and a wrong one by pointer (tap on the phone) score as
   expected; the truth is shown in words; show me runs to the end and ends on the validator's
   own end state (the crossings left by lib.replay; loops apart are lifted off); a tap on a tag
   answers with that tag's letter; no horizontal scroll on the phone
2. show me at normal speed takes exactly its steps' time (0.9 s, 1.4 s a move, 1.8 s a slide-over,
   2.2 s at the end), and less with reduced motion; pause, step and replay still end; the
   tutorial demo plays to the end with captions (the gap, the minimal pair) and redraws the item
3. the harness inlined into a sandboxed srcdoc iframe renders and plays by keyboard
4. no console errors
Screenshots: tests/e2e/out/knots/knots_<variant>_<set>_<viewport>_<theme>[_reveal|_wrong|_showme_end].png """
import sys

from playwright.sync_api import sync_playwright

from common import OUT, Checks, Console, child_frame, file_url, harness_single, launch, non_blank, srcdoc_host

C = Checks('harness_knots')
DIR = OUT / 'knots'
DIR.mkdir(parents=True, exist_ok=True)
READY = "() => window.__harness && __harness.state === 'respond'"
STATE = "(s) => window.__harness && __harness.state === s"
# (variant, set name, params, seed)
SETS = [
    ('pull', 'easy', 'rope:0,spacing:0', 3), ('pull', 'hard', 'rope:8,spacing:2', 5),
    ('untie', 'easy', 'rope:0,spacing:0', 4), ('untie', 'hard', 'rope:7,spacing:2', 6),
    ('tie', 'easy', 'rope:2,spacing:0', 7), ('tie', 'hard', 'rope:9,spacing:1', 8),
    ('link', 'easy', 'rope:0,spacing:0', 2), ('link', 'hard', 'rope:9,spacing:2', 11),
]

# What show me should end on, from the validator's own simplifier (def.lib.replay): for untie and
# tie the key crossing switched first; a wrong pick of untie/tie ends on the switched still.
END_JS = """() => {
    const it = __harness.item, L = PX.ex.get('knots').lib;
    let over = it.over;
    if (it.tags) { over = it.over.slice(); over[it.tags[it.key]] = !over[it.tags[it.key]]; }
    const apart = it.variant === 'link' && !it.key;
    const R = L.replay(L.curvesOf(it), over, { split: apart });
    const steps = R.steps.map((s) => s.t);
    return { left: R.end.list.length, reached: R.reached, steps: steps, apart: apart,
             lifted: apart && R.reached && R.polys.length === 2,
             ms: (it.tags ? 1600 : 900) + steps.reduce((a, t) => a + (t === 'R3' ? 1800 : 1400), 0) + 2200 };
}"""
DRAWN_JS = """() => ({ casings: document.querySelectorAll('.ex-knots-stage .ex-knots-layer .ex-knots-casing').length,
    ropes: document.querySelectorAll('.ex-knots-stage .ex-knots-rope').length,
    tags: Array.from(document.querySelectorAll('.ex-knots-stage .ex-knots-tag')).filter((t) => getComputedStyle(t.parentNode).display !== 'none').length,
    lifted: document.querySelectorAll('.ex-knots-stage .ex-knots-lifted').length,
    crossings: __harness.item.over.length, variant: __harness.item.variant })"""


def shot(target, name):
    target.screenshot(path=str(DIR / name))


def stage_ok(target, tag):
    ok, s = non_blank(target.locator('.ex-knots-stage').screenshot(), min_distinct=3, max_top=0.985)
    C.ok(ok, f'{tag}: the plate shows the rope ({s})')


def drawn_ok(target, tag):
    d = target.evaluate(DRAWN_JS)
    C.ok(d['casings'] == d['crossings'] and d['ropes'] >= d['crossings'] + 1, f'{tag}: the rope with one top-strand casing per crossing ({d})')
    want = 4 if d['variant'] in ('untie', 'tie') else 0
    C.ok(d['tags'] == want, f'{tag}: {want} tags on the plate ({d["tags"]})')
    n = target.locator('.hx-grid .px-choice').count()
    C.ok(n == (4 if want else 2), f'{tag}: {4 if want else 2} answers ({n})')


def answer_keyboard(page, frame, tag):
    key = frame.evaluate('() => (__harness.item.answer === "yesno" ? (__harness.key ? 0 : 1) : __harness.key)')
    page.keyboard.press(str(key + 1))
    frame.wait_for_function(STATE, arg='reveal', timeout=10000)
    r = frame.evaluate('() => __harness.last')
    C.ok(r['result']['correct'] is True and r['source'] == 'key', f'{tag}: a right answer by keyboard scores right ({r["result"]}, {r["source"]})')
    C.ok(r['rtMs'] >= 0, f'{tag}: the answer clock ran from the paint ({r["rtMs"]} ms)')
    verdict = frame.locator('.ex-knots-verdict').inner_text()
    C.ok(verdict.startswith('✓') and len(verdict) >= 8, f'{tag}: the truth in words ({verdict!r})')


def answer_pointer(page, frame, tag, tap=False):
    h = frame.evaluate('() => ({ key: __harness.item.answer === "yesno" ? (__harness.key ? 0 : 1) : __harness.key, n: __harness.item.nOptions })')
    cells = frame.locator('.hx-grid .px-choice')
    wrong = (h['key'] + 1) % h['n']
    (cells.nth(wrong).tap() if tap else cells.nth(wrong).click())
    frame.wait_for_function(STATE, arg='reveal', timeout=10000)
    r = frame.evaluate('() => __harness.last')
    C.ok(r['result']['correct'] is False and r['source'] == 'pointer', f'{tag}: a wrong answer by pointer scores wrong ({r["result"]}, {r["source"]})')
    marks = frame.evaluate("() => Array.from(document.querySelectorAll('.hx-grid .px-choice')).map((b) => b.className)")
    C.ok(any('is-wrong' in m for m in marks) and any('is-missed' in m for m in marks), f'{tag}: the grid marks the wrong pick and the missed answer')
    return wrong


def answer_tag(page, frame, tag, tap=False):
    """untie/tie: a tap on a tag (not the key) answers with that tag."""
    key = frame.evaluate('() => __harness.key')
    wrong = (key + 2) % 4
    disc = frame.locator(f'.ex-knots-tag[data-tag="{wrong}"] .ex-knots-tagdisc')
    (disc.tap() if tap else disc.click())
    frame.wait_for_function(STATE, arg='reveal', timeout=10000)
    r = frame.evaluate('() => __harness.last')
    C.ok(r['response'] == wrong and r['result']['correct'] is False, f'{tag}: a tap on tag {"ABCD"[wrong]} answers {"ABCD"[wrong]} ({r["response"]}, {r["source"]})')
    marks = frame.evaluate("() => Array.from(document.querySelectorAll('.ex-knots-tag')).map((t) => t.getAttribute('class'))")
    C.ok(sum('is-key' in m for m in marks) == 1 and sum('is-chosen' in m for m in marks) == 1, f'{tag}: the key tag and the chosen tag are marked ({marks})')


def show_me(frame, tag, page=None, click=None, end=None):
    before = frame.evaluate('() => __harness.played.finished')
    if click is not None:
        click.click()
    elif page is not None:
        page.keyboard.press('s')
    else:
        frame.evaluate('() => { __harness.showMe(); }')
    frame.wait_for_function('(n) => __harness.played.finished > n && __harness.state === "reveal"', arg=before, timeout=60000)
    C.ok(True, f'{tag}: show me ran to the end ({frame.evaluate("() => __harness.played.ms")} ms)')
    if end is not None:
        d = frame.evaluate(DRAWN_JS)
        cap = frame.locator('.ex-knots-under .ex-caption').inner_text()
        if end['lifted']:
            C.ok(d['lifted'] == 1, f'{tag}: show me ends with loop B lifted off ({d})')
        else:
            C.ok(d['casings'] == end['left'], f'{tag}: show me ends on the validator\'s end state ({d["casings"]} crossings left, replay {end["left"]}, reached {end["reached"]})')
        C.ok(len(cap) > 10, f'{tag}: the last caption says what happened ({cap!r})')


def desktop_and_phone(b, cons):
    for vp, tag, kw in [((1366, 768), '1366', {}), ((390, 844), '390', {'device_scale_factor': 2, 'is_mobile': True, 'has_touch': True})]:
        ctx = b.new_context(viewport={'width': vp[0], 'height': vp[1]}, **kw)
        page = ctx.new_page()
        cons.append(Console(page))
        phone = tag == '390'
        for variant, set_name, params, seed in SETS:
            for theme in ('light', 'dark'):
                name = f'knots_{variant}_{set_name}_{tag}_{theme}'
                page.goto(file_url('tests/dev/harness.html', ex='knots', seed=seed, p=params, v=variant, fast=1, theme=theme))
                page.wait_for_function(READY, timeout=30000)
                stage_ok(page, name)
                drawn_ok(page, name)
                shot(page, name + '.png')
                if phone:
                    sw = page.evaluate('() => [document.documentElement.scrollWidth, innerWidth]')
                    C.ok(sw[0] <= sw[1], f'{name}: no horizontal scroll ({sw})')
                if theme == 'light':
                    end = page.evaluate(END_JS)
                    answer_keyboard(page, page, name)
                    shot(page, name + '_reveal.png')
                    show_me(page, name, page=page, end=end)
                    shot(page, name + '_showme_end.png')
                    page.keyboard.press('Space')  # next
                    page.wait_for_function(READY, timeout=10000)
                    if variant in ('untie', 'tie'):
                        answer_tag(page, page, name, tap=phone)
                    else:
                        answer_pointer(page, page, name, tap=phone)
                    shot(page, name + '_wrong.png')
                    show_me(page, name + ' (Show me button)', click=page.locator('.hx-feedback-actions .px-btn').first)
                else:
                    page.evaluate('() => __harness.answer(false)')
                    page.wait_for_function(STATE, arg='reveal', timeout=10000)
                    shot(page, name + '_reveal.png')
                errs = page.evaluate('() => __harness.errors')
                C.ok(not errs, f'{name}: no harness errors ({errs})')
        ctx.close()


def normal_speed(b, cons):
    ctx = b.new_context(viewport={'width': 1366, 'height': 768})
    page = ctx.new_page()
    cons.append(Console(page))
    times = {}
    for variant, params, seed, rm in (('pull', 'rope:3,spacing:0', 4, 0), ('pull', 'rope:3,spacing:0', 4, 1), ('untie', 'rope:1,spacing:1', 3, 0)):
        label = f'{variant}{"_rm" if rm else ""}'
        page.goto(file_url('tests/dev/harness.html', ex='knots', seed=seed, p=params, v=variant, rm=rm))
        page.wait_for_function(READY, timeout=30000)
        end = page.evaluate(END_JS)
        page.evaluate('() => __harness.answer(true)')
        page.wait_for_function(STATE, arg='reveal', timeout=10000)
        before = page.evaluate('() => __harness.played.finished')
        page.evaluate('() => { __harness.showMe(); }')
        page.wait_for_timeout(2000)
        shot(page, f'knots_{label}_1366_light_showme.png')
        page.wait_for_function('(n) => __harness.played.finished > n', arg=before, timeout=90000)
        page.wait_for_timeout(200)
        shot(page, f'knots_{label}_1366_light_showme_end.png')
        pl = page.evaluate('() => __harness.played')
        times[label] = {'planned': round(pl['plannedMs'] / 1000, 2), 'wall': round(pl['ms'] / 1000, 2), 'moves': len(end['steps']), 'expected': round(end['ms'] / 1000, 2)}
    t = times['pull']
    C.ok(abs(t['planned'] - t['expected']) < 0.02 and t['moves'] >= 1, f'show me takes 0.9 s, then 1.4 s a move (1.8 s a slide-over), then 2.2 s ({times})')
    C.ok(abs(times['untie']['planned'] - times['untie']['expected']) < 0.02, f'untie: the switch (1.6 s), the moves, the end ({times["untie"]})')
    C.ok(times['pull_rm']['planned'] < t['planned'], f'reduced motion makes show me shorter ({times})')
    page.goto(file_url('tests/dev/harness.html', ex='knots', seed=6, p='rope:2,spacing:0', v='pull'))
    page.wait_for_function(READY, timeout=30000)
    page.evaluate('() => __harness.answer(true)')
    page.wait_for_function(STATE, arg='reveal', timeout=10000)
    page.keyboard.press('s')
    page.wait_for_function(STATE, arg='showme', timeout=5000)
    page.keyboard.press('Space')  # pause
    page.wait_for_timeout(500)
    paused = page.locator('.hx-player-buttons .px-btn').first.inner_text()
    C.ok('Resume' in paused, f'Space pauses show me ({paused!r})')
    page.keyboard.press('ArrowRight')  # step
    page.keyboard.press('r')           # replay
    page.wait_for_function(STATE, arg='reveal', timeout=90000)
    C.ok(True, 'pause, step and replay, then show me ends')
    # The tutorial demo (learn.demo[0], a knot): the gap, the minimal pair, the moves, then the
    # item's own solution; afterwards the item is drawn again to be answered.
    page.goto(file_url('tests/dev/harness.html', ex='knots', seed=1, fast=1))
    page.wait_for_function(READY, timeout=30000)
    page.evaluate("""() => { window.__caps = []; window.__labels = []; const c = document.querySelector('.hx-caption');
        new MutationObserver(() => { const t = c.textContent, l = document.querySelector('.ex-knots-label'), st = document.querySelector('.ex-knots-stage');
          if (t && __caps[__caps.length - 1] !== t) { __caps.push(t); __labels.push((l && !l.hidden ? l.textContent : '') + (st && st.classList.contains('is-copy') ? ' [dashed]' : '')); } })
          .observe(c, { childList: true, characterData: true, subtree: true }); }""")
    before = page.evaluate('() => __harness.played.finished')
    page.evaluate('() => { __harness.demo(); }')
    page.wait_for_function('(n) => __harness.played.finished > n', arg=before, timeout=60000)
    page.wait_for_timeout(300)
    caps = page.evaluate('() => window.__caps')
    labels = page.evaluate('() => window.__labels')
    learn = page.evaluate("() => PX.ex.learn('knots').captions")
    order = [learn[k] for k in ('gap', 'pair', 'copyNone', 'backToRope', 'marks', 'moves')]
    pos = [caps.index(x) if x in caps else -1 for x in order]
    C.ok(all(p >= 0 for p in pos) and pos == sorted(pos), f'the demo: the gap, the labelled copy falling open, back to your rope, the marked-crossing question, the moves ({pos})')
    lab = dict(zip(caps, labels))
    C.ok(lab.get(learn['pair'], '').startswith(learn['labelCopy']) and '[dashed]' in lab.get(learn['pair'], '') and '[dashed]' in lab.get(learn['copyNone'], ''),
         f'the copy is labelled on a dashed plate ({lab.get(learn["pair"])!r}, {lab.get(learn["copyNone"])!r})')
    C.ok(lab.get(learn['gap']) == learn['labelYours'] and lab.get(learn['backToRope']) == learn['labelYours'] and lab.get(caps[-1]) == learn['labelYours'],
         f'your rope is labelled before the copy, after it and at the end ({lab.get(learn["gap"])!r}, {lab.get(learn["backToRope"])!r}, {lab.get(caps[-1])!r})')
    C.ok(caps[-1] in (learn['knot'], learn['knotCore']), f'the demo ends on the knot that remains ({caps[-1]!r})')
    d = page.evaluate(DRAWN_JS)
    after = page.evaluate("() => { const l = document.querySelector('.ex-knots-label'), st = document.querySelector('.ex-knots-stage'); return { label: l && !l.hidden ? l.textContent : '', dashed: st.classList.contains('is-copy'), demoTags: document.querySelectorAll('.ex-knots-tag[data-demo]').length }; }")
    C.ok(d['casings'] == d['crossings'] and page.evaluate('() => __harness.item.key') is True and not after['label'] and not after['dashed'] and after['demoTags'] == 0,
         f'after the demo the knot is drawn again to be answered, with no label or demo tag ({d}, {after})')
    shot(page, 'knots_demo_end.png')
    ctx.close()
    return times


def sandboxed(b, cons):
    doc = harness_single('knots', {'seed': 21, 'p': 'rope:4,spacing:1', 'v': 'untie', 'fast': True})
    host = srcdoc_host('harness_knots', doc)
    ctx = b.new_context(viewport={'width': 1366, 'height': 768})
    page = ctx.new_page()
    cons.append(Console(page))
    page.goto(host.as_uri())
    fr = child_frame(page)
    fr.wait_for_function(READY, timeout=60000)
    env = fr.evaluate('() => ({ origin: String(self.origin), href: location.href, css: !!Array.from(document.styleSheets).find((s) => { try { return Array.from(s.cssRules).some((r) => (r.selectorText || "").indexOf(".ex-knots-casing") >= 0); } catch (e) { return false; } }) })')
    C.ok(env['origin'] == 'null' and env['href'] == 'about:srcdoc', f'srcdoc: runs in a sandboxed srcdoc frame ({env})')
    C.ok(env['css'], 'srcdoc: css/ex/knots.css is inlined')
    stage_ok(fr, 'srcdoc')
    drawn_ok(fr, 'srcdoc')
    fr.locator('.hx-goal').click()
    answer_keyboard(page, fr, 'srcdoc')
    show_me(fr, 'srcdoc', page=page)
    shot(page, 'knots_srcdoc.png')
    errs = fr.evaluate('() => __harness.errors')
    C.ok(not errs, f'srcdoc: no harness errors ({errs})')
    ctx.close()


def main():
    cons = []
    with sync_playwright() as p:
        b = launch(p)
        desktop_and_phone(b, cons)
        times = normal_speed(b, cons)
        sandboxed(b, cons)
        b.close()
    errors = [e for c in cons for e in c.errors()]
    C.ok(not errors, f'no console errors ({errors[:5]})')
    return C.summary({'showMeSeconds': times, 'screenshots': sorted(p.name for p in DIR.glob('knots_*.png'))})


if __name__ == '__main__':
    sys.exit(main())
