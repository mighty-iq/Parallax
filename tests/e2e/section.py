"""E2E: Section practice (js/ui/section.js, js/engine/section.js; v1.1 PLAN M5; R3 §9).

A mini section end to end on a phone (390×844, touch) and a desktop (1280×860, mouse and keys):
the setup (sizes, form, parts, rules, the ADA line), a part's instructions with the clock stopped,
items without feedback, Skip, Flag, Back (the earlier answer shown as chosen), the item strip, a
pause that stops the section clock, a voided item replaced at the end of its part, the end-of-part
card, a reload that resumes the run where it was, "End the section" from the pause sheet, and the
review (results and pacing, the items to look at again, each replayed with the answer marked and
its show-me). The record: trials with mode 'section', no rating change, one session, the run
summary, the next form. A second short run checks that time running out ends the section, and
that reading a part's instructions does not use its time. On the phone the item, its options and
the controls fit the screen without scrolling.

Until three DAT-style exercises can run here, stand-ins (Fold, Views, Slice, Hidden, Nets) take
their place through the test knob PX.engine.section.config.parts.
Screenshots: tests/e2e/out/section/. Run: tests/e2e/pwslot.sh python3 tests/e2e/section.py
"""
import json, pathlib, sys
sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
from playwright.sync_api import sync_playwright
from common import launch, Console, Checks, OUT as OUT_ROOT, ROOT

OUT = OUT_ROOT / 'section'
OUT.mkdir(parents=True, exist_ok=True)
INDEX = ROOT / 'index.html'
READY = 'document.documentElement.getAttribute("data-px-ready") === "1"'
PAT = ['openings', 'patviews', 'angles', 'patfold', 'cubes', 'form']
STAND_INS = ['fold', 'views', 'slice', 'hidden', 'nets']


def boot(page, url=None):
    page.goto(url or INDEX.as_uri())
    page.wait_for_function(READY, timeout=20000)
    for _ in range(4):  # the Chimera pop-up (every open), the first-run offer
        if not page.evaluate('PX.ui.modalOpen()'):
            break
        page.keyboard.press('Escape')
        page.wait_for_timeout(150)
    page.evaluate('PX.debug.fast(true)')


def knobs(page, parts, pace=None):
    page.evaluate('(o) => { PX.engine.section.config.parts = o.parts; PX.engine.section.config.paceMs = o.pace; }', {'parts': parts, 'pace': pace})


def choose_parts(page):
    real = page.evaluate('(ids) => ids.filter((id) => { const d = PX.ex.get(id); return d && d.role === "train" && PX.ui.play.canRun(d); })', PAT)
    return (real, 'real') if len(real) >= 3 else (STAND_INS, 'stand-ins')


def sec(page):
    return page.evaluate('(() => { const s = __section.state; return s ? Object.assign({}, s, { run: undefined }) : null; })()')


def run_state(page):
    return page.evaluate('__section.state && __section.state.run ? JSON.parse(JSON.stringify(__section.state.run)) : null')


def wait_mode(page, mode, ms=10000):
    page.wait_for_function(f'__section.state && __section.state.mode === {json.dumps(mode)}', timeout=ms)


def wait_respond(page, ms=10000):
    page.wait_for_function('__play.state === "respond"', timeout=ms)


def press(page, sel, phone):
    loc = page.locator(sel).first
    if phone:
        loc.tap()
    else:
        loc.click()
    page.wait_for_timeout(120)


def answer_key(page, phone, right=True):
    """Answers the item on screen through its option buttons (the right one or another)."""
    wait_respond(page)
    k = page.evaluate('__play.key')
    n = page.locator('.pl-grid .px-choice').count()
    if isinstance(k, bool):  # yes/no as two options
        idx = (0 if k else 1) if right else (1 if k else 0)
    elif isinstance(k, int):
        idx = k if right else (k + 1) % max(2, n)
    else:
        page.evaluate(f'__play.answer({"true" if right else "false"})')
        page.wait_for_timeout(150)
        return
    press(page, f'.pl-grid .px-choice[data-index="{idx}"]', phone)
    page.wait_for_timeout(150)


def fits(page):
    """On a phone: the item's stimulus, its options and the controls row are inside the screen."""
    return page.evaluate('''(() => {
      const vh = innerHeight, r = (s) => { const e = document.querySelector(s); return e ? e.getBoundingClientRect() : null; };
      const host = r('.pl-host'), grid = r('.pl-grid'), ctl = r('.sec-controls');
      return { vh, host: host && [host.top, host.bottom], grid: grid && [grid.top, grid.bottom], ctl: ctl && [ctl.top, ctl.bottom],
               ok: !!(host && grid && ctl) && host.top >= 0 && grid.bottom <= ctl.top + 1 && ctl.bottom <= vh + 1,
               scroll: document.scrollingElement.scrollTop };
    })()''')


def main_run(b, C, tag, phone):
    vp = {'width': 390, 'height': 844} if phone else {'width': 1280, 'height': 860}
    ctx = b.new_context(viewport=vp, has_touch=phone, is_mobile=phone)
    page = ctx.new_page()
    con = Console(page)
    boot(page)
    parts, kind = choose_parts(page)
    knobs(page, parts)
    ex_before = page.evaluate('JSON.stringify(PX.core.store.state.ex)')
    trials0 = page.evaluate('PX.core.store.state.trials.length')

    # setup
    page.evaluate('void PX.core.router.go("section", { size: "mini" })')
    page.wait_for_timeout(300)
    C.ok(page.locator('[data-sec-start]').count() == 1, f'{tag}: the setup screen has Start ({kind}: {parts})')
    txt = page.locator('.sec-setup').inner_text()
    n_items = 5 * len(parts)
    C.ok(f'{n_items} items' in txt, f'{tag}: the setup names the mini size: {n_items} items')
    C.ok('does not predict your score on the real test' in txt and 'not affiliated with or endorsed by the ADA' in txt, f'{tag}: no score prediction, and the ADA line')
    lead = page.locator('.px-screen-head .px-lead').first.inner_text()
    C.ok(lead.find('Dental Admission Test') >= 0 and lead.find('Dental Admission Test') < lead.find('DAT'), f'{tag}: the test is spelled out before "DAT"')
    C.ok(page.locator('[data-sec-form] option').first.inner_text().startswith('Form 1'), f'{tag}: the first form is Form 1')
    C.ok('new to you' in txt and page.locator('.sec-new [data-go="library"]').count() == 1, f'{tag}: formats never practised are marked, with a way to learn them first')
    page.screenshot(path=str(OUT / f'{tag}_setup.png'), full_page=True)
    press(page, '[data-sec-start]', phone)
    wait_mode(page, 'intro')
    s = sec(page)
    C.ok(s['running'] is False, f'{tag}: the clock is stopped while the part instructions are open')
    page.screenshot(path=str(OUT / f'{tag}_intro.png'))
    page.wait_for_timeout(800)
    C.ok(sec(page)['usedMs'] < 300, f'{tag}: reading the instructions uses no section time ({sec(page)["usedMs"]:.0f} ms)')
    press(page, '[data-card="start"]', phone)
    wait_mode(page, 'item')
    wait_respond(page)
    C.ok(sec(page)['running'] is True, f'{tag}: the clock runs during items')
    t = page.locator('[data-sec-timer]').inner_text()
    C.ok(':' in t, f'{tag}: the HUD shows the time left ({t})')
    C.ok(page.locator('.pl-verdict:not(:empty)').count() == 0, f'{tag}: no feedback')
    if phone:
        f = fits(page)
        C.ok(f['ok'], f'{tag}: the item, its options and the controls fit the screen {f}')
    page.screenshot(path=str(OUT / f'{tag}_item.png'))

    # item 1 right → moves on; flag and skip item 2; back twice: item 1 shows its answer
    key1 = page.evaluate('__play.key')
    answer_key(page, phone, True)
    page.wait_for_function('__section.state.index === 1', timeout=5000)
    C.ok(True, f'{tag}: choosing an answer moves on to item 2')
    C.ok(page.locator('.pl-verdict:not(:empty)').count() == 0, f'{tag}: still no feedback after answering')
    wait_respond(page)
    press(page, '[data-sec-flag]', phone)
    C.ok(page.locator('[data-sec-flag]').get_attribute('aria-pressed') == 'true', f'{tag}: Flag marks item 2')
    if phone:
        press(page, '[data-sec-items]', phone)
    C.ok(page.locator('.sec-strip [data-sec-item].is-flagged').count() == 1 and page.locator('.sec-strip [data-sec-item].is-answered').count() == 1, f'{tag}: the strip shows one answered and one flagged item')
    C.ok(page.locator('.sec-strip [data-sec-item].is-answered .sec-chip-dot').count() == 1 and page.locator('.sec-strip [data-sec-item]:not(.is-answered) .sec-chip-dot').count() == 0, f'{tag}: an answered item carries a mark, not colour alone')
    page.screenshot(path=str(OUT / f'{tag}_strip.png'))
    if phone:
        press(page, '[data-sec-next]', phone)
    else:
        page.keyboard.press('ArrowRight')  # keys: → skips
    page.wait_for_function('__section.state.index === 2', timeout=5000)
    C.ok(True, f'{tag}: Skip moves on, leaving item 2 unanswered')
    wait_respond(page)
    if phone:
        press(page, '[data-sec-back]', phone)
    else:
        page.keyboard.press('ArrowLeft')
    page.wait_for_function('__section.state.index === 1', timeout=5000)
    wait_respond(page)
    press(page, '[data-sec-back]', phone)
    page.wait_for_function('__section.state.index === 0', timeout=5000)
    wait_respond(page)
    sel = page.evaluate('[...document.querySelectorAll(".pl-grid .px-choice")].findIndex((b) => b.classList.contains("is-selected"))')
    C.ok(isinstance(key1, int) and sel == key1 or not isinstance(key1, int), f'{tag}: back on item 1, its answer is shown as chosen ({sel} = {key1})')
    C.ok(page.locator('[data-sec-next]').inner_text().startswith('Next'), f'{tag}: an answered item offers Next, not Skip')
    press(page, '[data-sec-next]', phone)
    page.wait_for_function('__section.state.index === 1', timeout=5000)
    answer_key(page, phone, False)  # item 2 wrong
    page.wait_for_function('__section.state.index === 2', timeout=5000)

    # a void on item 3: not counted, replaced at the end of the part
    wait_respond(page)
    page.evaluate('PX.bus.emit("trial:void", { reason: "turned" })')
    answer_key(page, phone, True)
    page.wait_for_timeout(300)
    r = run_state(page)
    items = r['parts'][0]['items']
    C.ok(items[2]['status'] == 'void' and len(items) == 6 and items[5].get('rep') is True, f'{tag}: the voided item is replaced at the end of its part ({[x["status"] for x in items]})')

    # a pause stops the section clock
    wait_respond(page)
    press(page, '[data-pause]', phone)
    page.wait_for_timeout(200)
    u0 = sec(page)['usedMs']
    C.ok(sec(page)['running'] is False, f'{tag}: Pause stops the section clock')
    page.wait_for_timeout(1500)
    u1 = sec(page)['usedMs']
    C.ok(abs(u1 - u0) < 50, f'{tag}: no time passes while paused ({u0:.0f} → {u1:.0f} ms)')
    page.screenshot(path=str(OUT / f'{tag}_paused.png'))
    press(page, '[data-resume]', phone)
    wait_respond(page)
    C.ok(sec(page)['running'] is True, f'{tag}: Resume starts it again')

    # the rest of the part: items 4, 5 and the replacement
    for _ in range(3):
        if sec(page)['mode'] != 'item':
            break
        answer_key(page, phone, True)
        page.wait_for_timeout(200)
    wait_mode(page, 'partend')
    card = page.locator('[data-card-box="sec-partend"]').inner_text()
    C.ok('Flagged: item 2' in card and 'cannot come back' in card, f'{tag}: the end-of-part card lists the flagged item and says the part closes')
    focus = page.evaluate('document.activeElement && document.activeElement.getAttribute("data-card")')
    C.ok(focus == 'back' and page.locator('[data-card-box="sec-partend"] [data-card="back"]').get_attribute('class').find('primary') >= 0, f'{tag}: with an item flagged, the default goes back to it, not on ({focus})')
    page.screenshot(path=str(OUT / f'{tag}_partend.png'))
    press(page, '[data-card="next"]', phone)
    wait_mode(page, 'intro')
    rows = page.evaluate('(n) => { const s = PX.core.store.state, m = s.idx.mode.indexOf("section"); return s.trials.slice(n).map((r) => [r[2] === m, r[5]]); }', trials0)
    C.ok(len(rows) == 6 and all(x[0] for x in rows), f'{tag}: closing part 1 logged its 6 shown items with mode "section" {rows}')
    C.ok(sorted(x[1] for x in rows) == [0, 1, 1, 1, 1, 2], f'{tag}: outcomes: 4 right, 1 wrong, 1 void {sorted(x[1] for x in rows)}')

    # part 2: one answer, then a reload resumes the run
    press(page, '[data-card="start"]', phone)
    wait_mode(page, 'item')
    answer_key(page, phone, True)
    page.wait_for_function('__section.state.index === 1', timeout=5000)
    wait_respond(page)
    used_before = sec(page)['usedMs']
    page.wait_for_timeout(1300)  # the debounced save
    page.reload()
    page.wait_for_function(READY, timeout=20000)
    for _ in range(4):
        if not page.evaluate('PX.ui.modalOpen()'):
            break
        page.keyboard.press('Escape')
        page.wait_for_timeout(150)
    page.evaluate('PX.debug.fast(true)')
    knobs(page, parts)
    on_section = page.evaluate('PX.core.router.current().name')
    if on_section != 'section':
        page.evaluate('void PX.core.router.go("section")')
        page.wait_for_timeout(300)
    C.ok(page.locator('[data-sec-resume]').count() == 1, f'{tag}: after a reload the section offers to resume (route {on_section})')
    page.screenshot(path=str(OUT / f'{tag}_resume.png'))
    press(page, '[data-sec-resume]', phone)
    wait_mode(page, 'intro')
    press(page, '[data-card="start"]', phone)
    wait_mode(page, 'item')
    s = sec(page)
    C.ok(s['part'] == 1 and s['index'] == 1, f'{tag}: it resumes at part 2, item 2 ({s["part"]}, {s["index"]})')
    C.ok(s['usedMs'] >= used_before - 1500, f'{tag}: the clock keeps the time already used ({used_before:.0f} → {s["usedMs"]:.0f} ms)')

    # End the section from the pause sheet → the review
    wait_respond(page)
    press(page, '[data-pause]', phone)
    press(page, '[data-end]', phone)
    page.wait_for_timeout(200)
    C.ok(page.locator('.px-modal').count() == 1, f'{tag}: ending asks first')
    page.locator('.px-modal .px-btn--primary, .px-modal .px-btn--danger').first.click()
    wait_mode(page, 'review')
    rv = page.locator('[data-sec-review]').inner_text()
    out = page.evaluate('(() => { const s = PX.core.store.state; return { run: s.section.runs[s.section.runs.length - 1], next: s.section.next, live: s.section.live, sess: s.sessions[s.sessions.length - 1] }; })()')
    run = out['run']
    C.ok(run['ended'] == 'user' and run['size'] == 'mini' and run['form'] == 1, f'{tag}: the run summary is kept ({run["ended"]}, form {run["form"]})')
    C.ok(f'{run["right"]} of {run["n"]}' in rv, f'{tag}: the review shows right of n ({run["right"]} of {run["n"]})')
    C.ok(run['right'] == 5 and run['answered'] == 6, f'{tag}: 5 right of 6 answered ({run["right"]}/{run["answered"]})')
    C.ok(out['next']['mini'] == 2 and out['live'] is None, f'{tag}: the next mini form is 2; nothing is left live')
    C.ok(out['sess']['mode'] == 'section' and out['sess']['trials'] == 6, f'{tag}: one session with mode "section" and 6 answers')
    C.ok(page.evaluate('JSON.stringify(PX.core.store.state.ex)') == ex_before, f'{tag}: no rating changed')
    C.ok('not reached' in rv and 'does not turn them into a score or a prediction for the Dental Admission Test' in rv, f'{tag}: parts not reached are marked; no score prediction')
    shown = page.evaluate('__section.state.run.parts.reduce((n, P) => n + P.items.filter((x) => x.status === "seen" || x.status === "answered").length, 0)')
    C.ok(page.locator('[data-sec-chip]').count() <= shown and page.evaluate('[...document.querySelectorAll("[data-sec-chip]")].every((b) => { const [p, i] = b.getAttribute("data-sec-chip").split(":").map(Number); const it = __section.state.run.parts[p].items[i]; return it.status === "seen" || it.status === "answered"; })'), f'{tag}: the review lists only items that were shown')
    page.screenshot(path=str(OUT / f'{tag}_review.png'), full_page=True)

    # the review: a wrong item replays with the answer marked and plays its show-me
    chip = page.locator('[data-sec-chip].is-wrong').first
    C.ok(chip.count() == 1, f'{tag}: the wrong answer is among the items to look at again')
    if phone:
        chip.tap()
    else:
        chip.click()
    page.wait_for_function('__play.state === "reveal" || __play.state === "showme"', timeout=8000)
    marks = page.evaluate('[...document.querySelectorAll(".sec-stage .px-choice")].map((b) => b.className.match(/is-(right|wrong|missed)/) ? RegExp.$1 : "")')
    C.ok('wrong' in marks and ('missed' in marks or 'right' in marks), f'{tag}: the replayed answer is marked wrong and the right one shown {marks}')
    page.wait_for_timeout(600)
    st = page.evaluate('__play.state')
    C.ok(st in ('showme', 'reveal'), f'{tag}: its show-me plays ({st})')
    page.screenshot(path=str(OUT / f'{tag}_review_item.png'))
    # the Log lists the run as a session; the setup screen names the last section
    page.evaluate('void PX.core.router.go("log")')
    page.wait_for_timeout(400)
    C.ok('Section practice' in page.locator('main').inner_text(), f'{tag}: the Log lists the section as "Section practice"')
    page.evaluate('void PX.core.router.go("section", { size: "mini" })')
    page.wait_for_timeout(300)
    C.ok('Your last section: mini, form 1' in page.locator('.sec-setup').inner_text(), f'{tag}: the setup screen names the last section')
    C.ok('Form 2 (new to you)' in page.locator('[data-sec-form]').inner_text(), f'{tag}: … and offers form 2 as new')
    C.ok(len(con.errors()) == 0, f'{tag}: no console errors {con.errors()[:3]}')
    ctx.close()


def time_up(b, C):
    tag = 'timeup'
    ctx = b.new_context(viewport={'width': 1280, 'height': 860})
    page = ctx.new_page()
    con = Console(page)
    boot(page)
    parts, kind = choose_parts(page)
    knobs(page, parts, pace=160)  # 5 items a part × 160 ms
    page.evaluate('void PX.core.router.go("section", { size: "mini" })')
    page.wait_for_timeout(300)
    budget = page.evaluate('PX.engine.section.shape("mini").budgetMs')
    page.locator('[data-sec-start]').click()
    wait_mode(page, 'intro')
    page.wait_for_timeout(budget + 1500)
    C.ok(sec(page)['mode'] == 'intro', f'{tag}: the instructions can stay open longer than the whole budget ({budget} ms)')
    page.locator('[data-card="start"]').click()
    page.wait_for_function('__section.state && __section.state.mode === "review"', timeout=budget + 8000)
    res = page.evaluate('__section.state.result')
    C.ok(res['ended'] == 'time', f'{tag}: time running out ends the section ({res["ended"]})')
    C.ok(res['usedMs'] <= budget + 50, f'{tag}: used time stops at the budget ({res["usedMs"]} ≤ {budget})')
    C.ok('The time ran out.' in page.locator('.px-screen-head').inner_text(), f'{tag}: the review says the time ran out')
    C.ok(len(con.errors()) == 0, f'{tag}: no console errors {con.errors()[:3]}')
    ctx.close()


def main():
    C = Checks('section')
    with sync_playwright() as p:
        b = launch(p)
        try:
            main_run(b, C, 'phone', True)
            main_run(b, C, 'desktop', False)
            time_up(b, C)
        finally:
            b.close()
    sys.exit(C.summary())


if __name__ == '__main__':
    main()
