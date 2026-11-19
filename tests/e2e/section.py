"""E2E: Section practice (js/ui/section.js, js/engine/section.js; v1.1 PLAN M5; R3 §9; v1.2 PLAN milestone 8).

A mini section end to end on a phone (390×844, touch) and a desktop (1280×860, mouse and keys). v1.2, test
conditions (note docs/research/v1.2/D1-pat-formats.md addendum A.4): the setup (sizes, form, parts, rules, the
guessing line, the ADA line); every part's instructions on one page before the clock starts (the clock stopped,
no time used); one clock across all parts that stops while an item is prepared (a 1.5 s generator moves it far
less); items without feedback; Mark, Strike (tap while striking, right-click, Shift with a letter; kept on the
item, said to screen readers), Skip and Back (the earlier answer shown as chosen); a pause that stops the clock;
a voided item replaced at the end of its part, with numbers that never shift (O11); the next part straight
after the last item of one, and Back across parts; the review list (marked and unanswered items of every
part, the guessing line, a chip that opens its item, the way back); a reload that resumes the run where it
was with its time kept (O9); "End the section" from the review list, which names the unanswered items; the
review (results and pacing, the items to look at again, each replayed with the answer marked and its
show-me), which comes back after a reload and is offered on the setup screen later (O10). The record: trials
with mode 'section' logged when the section ends, no rating change, one session, the run summary, the next
form. A second short run checks that time running out ends the section, and that the instructions use none
of its time. On the phone the item, its options and the controls fit the screen without scrolling.
v1.2 O28: the same on a phone held sideways (844×390, 740×360): the instructions fit the width, every item of
a part fits the screen with its five controls (at least 44 px), and the review list fits.

Until three DAT-style exercises can run here, stand-ins (Fold, Views, Slice, Hidden, Nets) take
their place through the test knob PX.engine.section.config.parts.
Screenshots: tests/e2e/out/section/. Run: tests/e2e/pwslot.sh python3 tests/e2e/section.py [sideways]
"""
import json, os, pathlib, sys
sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
from playwright.sync_api import sync_playwright
from common import launch, Console, Checks, OUT as OUT_ROOT, ROOT

OUT = OUT_ROOT / 'section'
OUT.mkdir(parents=True, exist_ok=True)
INDEX = ROOT / 'index.html'
READY = 'document.documentElement.getAttribute("data-px-ready") === "1"'
PAT = ['openings', 'patviews', 'angles', 'patfold', 'cubes', 'form']
STAND_INS = ['fold', 'views', 'slice', 'hidden', 'nets']


def popups(page):
    """The Chimera welcome (a modal on a record's first launch) and the first-run offer close with Escape;
    later launches show the one-tap card under the header (v1.2 gap C2), closed by its ✕."""
    for _ in range(4):
        if not page.evaluate('PX.ui.modalOpen()'):
            break
        page.keyboard.press('Escape')
        page.wait_for_timeout(150)
    card = page.locator('[data-chimera-card] [data-chimera-card-close]')
    if card.count() and card.first.is_visible():
        card.first.click()
        page.wait_for_timeout(150)


def boot(page, url=None):
    page.goto(url or INDEX.as_uri())
    page.wait_for_function(READY, timeout=20000)
    popups(page)
    page.evaluate('PX.debug.fast(true)')


def knobs(page, parts, pace=None):
    page.evaluate('(o) => { PX.engine.section.config.parts = o.parts; PX.engine.section.config.paceMs = o.pace; }', {'parts': parts, 'pace': pace})


def choose_parts(page):
    # SECTION_PARTS=stand-ins forces the stand-ins (while the DAT-style exercises change version under a run,
    # as during a build wave: a reload then loads newer exercises, and a kept review is rightly dropped)
    real = page.evaluate('(ids) => ids.filter((id) => { const d = PX.ex.get(id); return d && d.role === "train" && PX.ui.play.canRun(d); })', PAT)
    if os.environ.get('SECTION_PARTS') == 'stand-ins':
        return STAND_INS, 'stand-ins'
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


def list_filter(page, value, phone):
    """The review list's Show filter (a segmented control: radio inputs inside labels)."""
    lab = page.locator('[data-sec-list] .px-seg-item', has=page.locator(f'input[value="{value}"]')).first
    if phone:
        lab.tap()
    else:
        lab.click()
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
    C.ok('does not predict a score on the Dental Admission Test' in txt and 'not affiliated with or endorsed by the ADA' in txt, f'{tag}: no score prediction, and the ADA line')
    lead = page.locator('.px-screen-head .px-lead').first.inner_text()
    C.ok(lead.find('Dental Admission Test') >= 0 and lead.find('Dental Admission Test') < lead.find('DAT'), f'{tag}: the test is spelled out before "DAT"')
    C.ok(page.locator('[data-sec-form] option').first.inner_text().startswith('Form 1'), f'{tag}: the first form is Form 1')
    C.ok('new to you' in txt and page.locator('.sec-new [data-go="library"]').count() == 1, f'{tag}: formats never practised are marked, with a way to learn them first')
    page.screenshot(path=str(OUT / f'{tag}_setup.png'), full_page=True)
    press(page, '[data-sec-start]', phone)
    # v1.2 test conditions (PLAN milestone 8): every part's instructions on one page, before the clock starts
    wait_mode(page, 'instructions')
    s = sec(page)
    C.ok(s['running'] is False, f'{tag}: the clock is stopped while the instructions are open')
    ins = page.locator('[data-card-box="sec-instructions"]').inner_text()
    C.ok(page.locator('[data-sec-instr]').count() == len(parts) + 1, f'{tag}: the instructions hold every part ({len(parts)}) and the rules of the section')
    C.ok('Guessing is not penalised' in ins and 'not affiliated with or endorsed by the ADA' in ins and 'before test day' in ins,
         f'{tag}: they say guessing is not penalised, carry the ADA line, and say why they come first')
    page.screenshot(path=str(OUT / f'{tag}_instructions.png'), full_page=True)
    if phone:  # RV-play-dat: "Start part 1" showed a keyboard hint on a phone
        C.ok(page.evaluate('[...document.querySelectorAll("[data-card-box] .px-kbd")].every((k) => getComputedStyle(k).display === "none")'),
             f'{tag}: no key hints on the instructions on a touch screen')
    page.wait_for_timeout(800)
    C.ok(sec(page)['usedMs'] < 300, f'{tag}: reading the instructions uses no section time ({sec(page)["usedMs"]:.0f} ms)')
    page.locator('[data-card="start"]').scroll_into_view_if_needed()
    press(page, '[data-card="start"]', phone)
    wait_mode(page, 'item')
    wait_respond(page)
    C.ok(sec(page)['running'] is True and run_state(page)['begun'] is True, f'{tag}: Start the clock: the clock runs during items')
    t = page.locator('[data-sec-timer]').inner_text()
    C.ok(':' in t, f'{tag}: the HUD shows the time left ({t})')
    C.ok(page.locator('.pl-verdict:not(:empty)').count() == 0, f'{tag}: no feedback')
    C.ok('px-btn--primary' not in (page.locator('[data-sec-next]').get_attribute('class') or ''), f'{tag}: Skip is not styled as the main button')
    if phone:
        f = fits(page)
        C.ok(f['ok'], f'{tag}: the item, its options and the controls fit the screen {f}')
    page.screenshot(path=str(OUT / f'{tag}_item.png'))

    # the clock stops while an item is prepared: item 2's generator takes 1.5 s, and the clock moves far less
    page.evaluate("""(id) => { const d = PX.ex.get(id), g = d.generate; window.__slowGen = [d, g];
        d.generate = function (r, p) { const t = performance.now(); while (performance.now() - t < 1500) {} d.generate = g; return g.call(this, r, p); }; }""", parts[0])
    u_before = sec(page)['usedMs']
    key1 = page.evaluate('__play.key')
    answer_key(page, phone, True)
    page.wait_for_function('__section.state.index === 1', timeout=8000)
    wait_respond(page)
    u_after = sec(page)['usedMs']
    page.evaluate('(() => { if (window.__slowGen) { window.__slowGen[0].generate = window.__slowGen[1]; } })()')
    C.ok(u_after - u_before < 900, f'{tag}: the section clock stops while an item is prepared (1.5 s of preparation, the clock moved {u_after - u_before:.0f} ms)')
    C.ok(True, f'{tag}: choosing an answer moves on to item 2')
    C.ok(page.locator('.pl-verdict:not(:empty)').count() == 0, f'{tag}: still no feedback after answering')

    # Mark, then Strike: options crossed out by tap, by Shift with a letter, by right-click; kept on the item
    press(page, '[data-sec-flag]', phone)
    C.ok(page.locator('[data-sec-flag]').get_attribute('aria-pressed') == 'true', f'{tag}: Mark marks item 2')
    n_opt = page.locator('.pl-grid .px-choice').count()
    press(page, '[data-sec-strike]', phone)
    C.ok(page.locator('[data-sec-strike]').get_attribute('aria-pressed') == 'true' and sec(page)['striking'], f'{tag}: Strike turns striking on')
    press(page, '.pl-grid .px-choice[data-index="0"]', phone)
    st0 = run_state(page)['parts'][0]['items'][1].get('struck')
    C.ok(st0 == [0] and sec(page)['index'] == 1 and page.locator('.pl-grid .px-choice[data-index="0"].is-struck').count() == 1,
         f'{tag}: while striking, a tap crosses an option out and answers nothing ({st0})')
    C.ok(page.locator('.pl-grid .px-choice[data-index="0"]').get_attribute('aria-describedby') == 'sec-struck-desc', f'{tag}: a struck option says so to a screen reader')
    press(page, '[data-sec-strike]', phone)
    C.ok(page.locator('[data-sec-strike]').get_attribute('aria-pressed') == 'false', f'{tag}: Strike again turns it off')
    if not phone:
        letters = page.evaluate('!!(PX.ui.play.current() && PX.ui.play.current().ctx && PX.ui.play.current().ctx.letters)')
        page.locator('.pl-grid .px-choice[data-index="2"]').click(button='right')
        page.wait_for_timeout(100)
        if letters:
            page.keyboard.press('Shift+B')
            page.wait_for_timeout(100)
        st1 = run_state(page)['parts'][0]['items'][1].get('struck')
        C.ok(st1 == ([0, 1, 2] if letters else [0, 2]) and sec(page)['index'] == 1, f'{tag}: a right-click{" and Shift+B" if letters else ""} strike options too, answering nothing ({st1})')
        # keys: X turns striking on and off, an option key strikes while it is on; M unmarks and marks
        page.keyboard.press('x')
        page.wait_for_timeout(100)
        on = sec(page)['striking']
        page.keyboard.press(str(min(4, n_opt)))
        page.wait_for_timeout(100)
        page.keyboard.press('x')
        page.wait_for_timeout(100)
        st2 = run_state(page)['parts'][0]['items'][1].get('struck') or []
        C.ok(on and (min(4, n_opt) - 1) in st2 and not sec(page)['striking'] and sec(page)['index'] == 1, f'{tag}: X turns striking on and off, and an option key strikes while it is on, answering nothing ({st2})')
        page.keyboard.press('m')
        page.wait_for_timeout(100)
        un = page.locator('[data-sec-flag]').get_attribute('aria-pressed')
        page.keyboard.press('m')
        page.wait_for_timeout(100)
        C.ok(un == 'false' and page.locator('[data-sec-flag]').get_attribute('aria-pressed') == 'true', f'{tag}: M unmarks and marks the item')
    page.screenshot(path=str(OUT / f'{tag}_struck.png'))
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
    page.wait_for_timeout(150)
    C.ok(page.locator('.pl-grid .px-choice.is-struck').count() == (1 if phone else len(run_state(page)['parts'][0]['items'][1].get('struck') or [])), f'{tag}: back on item 2, its struck options are still crossed out')
    press(page, '[data-sec-back]', phone)
    page.wait_for_function('__section.state.index === 0', timeout=5000)
    wait_respond(page)
    sel = page.evaluate('[...document.querySelectorAll(".pl-grid .px-choice")].findIndex((b) => b.classList.contains("is-selected"))')
    C.ok(isinstance(key1, int) and sel == key1 or not isinstance(key1, int), f'{tag}: back on item 1, its answer is shown as chosen ({sel} = {key1})')
    C.ok(page.locator('[data-sec-next]').inner_text().startswith('Next'), f'{tag}: an answered item offers Next, not Skip')
    C.ok(page.locator('[data-sec-back]').is_disabled(), f'{tag}: nothing before the first item')
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
    # v1.2 O11: numbers never shift: after the void of item 3, item 4 is still "item 4 of 5" (1.1: "item 3 of 5")
    wait_respond(page)
    meta = page.locator('.pl-hud-meta').first.inner_text()
    C.ok(sec(page)['index'] == 3 and 'item 4 of 5' in meta, f'{tag}: after a void, the next item keeps its number ({meta!r})')

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

    # the rest of the part: items 4, 5 and the replacement, which carries the number of item 3 (v1.2 O11); then
    # on into part 2 with no card between (one clock, free navigation)
    metas = []
    for _ in range(3):
        if sec(page)['mode'] != 'item':
            break
        wait_respond(page)
        metas.append(page.locator('.pl-hud-meta').first.inner_text().split('·')[-1].strip())
        answer_key(page, phone, True)
        page.wait_for_timeout(200)
    C.ok(metas == ['item 4 of 5', 'item 5 of 5', 'item 3 of 5'], f'{tag}: items 4 and 5 keep their numbers; the replacement at the end is item 3 ({metas})')
    page.wait_for_function('__section.state.mode === "item" && __section.state.part === 1', timeout=8000)
    wait_respond(page)
    meta2 = page.locator('.pl-hud-meta').first.inner_text()
    C.ok('Part 2 of' in meta2 and 'item 1 of 5' in meta2, f'{tag}: the next answer opens part 2 at once, no card between ({meta2!r})')
    C.ok(page.evaluate('(n) => PX.core.store.state.trials.length - n', trials0) == 0, f'{tag}: nothing is logged before the section ends')
    # Back from part 2's first item goes to part 1's last one (the replacement)
    press(page, '[data-sec-back]', phone)
    page.wait_for_function('__section.state.part === 0 && __section.state.index === 5', timeout=5000)
    C.ok(True, f'{tag}: Back from part 2 returns to part 1 (free navigation across parts)')
    wait_respond(page)

    # the review list: marked and unanswered items of every part; a chip goes to its item
    press(page, '[data-sec-items]', phone)
    wait_mode(page, 'list')
    lst = page.locator('[data-sec-list]').inner_text()
    C.ok(sec(page)['running'] is True and 'Review' in lst and 'Marked (1)' in lst and 'Unanswered' in lst, f'{tag}: Review lists marked and unanswered items while the clock runs')
    C.ok('Guessing is not penalised' in lst, f'{tag}: with unanswered items, the list says guessing is not penalised')
    page.screenshot(path=str(OUT / f'{tag}_list.png'), full_page=True)
    list_filter(page, 'marked', phone)
    chip = page.locator('[data-sec-list] [data-sec-item="0:1"]')
    C.ok(chip.count() == 1 and 'marked' in (chip.get_attribute('aria-label') or ''), f'{tag}: the marked item 2 of part 1 is listed as marked')
    if phone:
        chip.tap()
    else:
        chip.click()
    page.wait_for_function('__section.state.mode === "item" && __section.state.part === 0 && __section.state.index === 1', timeout=5000)
    C.ok(True, f'{tag}: a chip opens its item')
    wait_respond(page)
    press(page, '[data-sec-items]', phone)
    wait_mode(page, 'list')
    ret = page.locator('[data-sec-return]')
    C.ok(ret.count() == 1 and 'part 1, item 2' in ret.inner_text(), f'{tag}: the list offers the way back to the item ({ret.inner_text() if ret.count() else None!r})')
    C.ok(not page.locator('.pl-guide').first.is_visible() if page.locator('.pl-guide').count() else True, f'{tag}: the last item\u2019s goal line is not over the list')
    list_filter(page, 'unanswered', phone)
    press(page, '[data-sec-list] [data-sec-item="1:0"]', phone)  # part 2's first item, never answered
    page.wait_for_function('__section.state.mode === "item" && __section.state.part === 1 && __section.state.index === 0', timeout=5000)
    wait_respond(page)

    # part 2: one answer, 2.5 s on item 2, then a reload at once resumes the run with that time kept (v1.2 O9:
    # in 1.1 the clock was saved only between items, so the reload gave the 2.5 s back)
    answer_key(page, phone, True)
    page.wait_for_function('__section.state.index === 1', timeout=5000)
    wait_respond(page)
    page.wait_for_timeout(2500)
    used_before = sec(page)['usedMs']
    page.reload()
    page.wait_for_function(READY, timeout=20000)
    popups(page)
    page.evaluate('PX.debug.fast(true)')
    knobs(page, parts)
    on_section = page.evaluate('PX.core.router.current().name')
    if on_section != 'section':
        page.evaluate('void PX.core.router.go("section")')
        page.wait_for_timeout(300)
    C.ok(page.locator('[data-sec-resume]').count() == 1, f'{tag}: after a reload the section offers to resume (route {on_section})')
    page.screenshot(path=str(OUT / f'{tag}_resume.png'))
    press(page, '[data-sec-resume]', phone)
    wait_mode(page, 'resume-card')
    press(page, '[data-card="start"]', phone)
    wait_mode(page, 'item')
    s = sec(page)
    C.ok(s['part'] == 1 and s['index'] == 1, f'{tag}: it resumes at part 2, item 2 ({s["part"]}, {s["index"]})')
    C.ok(s['usedMs'] >= used_before - 300, f'{tag}: a reload keeps the time spent on the current item ({used_before:.0f} → {s["usedMs"]:.0f} ms)')

    # what part 2 holds now: its first answer counts unless the item was voided by the environment (a frame
    # stutter at a 3D part's first item on a loaded machine; rule 7), which the expected totals then leave out
    p2 = [x for x in run_state(page)['parts'][1]['items'] if x['status'] == 'answered']
    p2_right, p2_void = sum(1 for x in p2 if x['correct']), [x.get('voidReason') for x in run_state(page)['parts'][1]['items'] if x['status'] == 'void']

    # End the section from the review list → a confirmation → the review
    wait_respond(page)
    press(page, '[data-sec-items]', phone)
    wait_mode(page, 'list')
    press(page, '[data-sec-end]', phone)
    page.wait_for_timeout(200)
    C.ok(page.locator('.px-modal').count() == 1 and 'not answered' in page.locator('.px-modal').inner_text(), f'{tag}: ending asks first, naming the unanswered items')
    page.locator('.px-modal .px-btn--primary, .px-modal .px-btn--danger').first.click()
    wait_mode(page, 'review')
    rows = page.evaluate('(n) => { const s = PX.core.store.state, m = s.idx.mode.indexOf("section"); return s.trials.slice(n).map((r) => [r[2] === m, r[5]]); }', trials0)
    C.ok(len(rows) >= 7 and all(x[0] for x in rows), f'{tag}: the section’s shown items are logged when it ends, with mode "section" ({len(rows)} rows)')
    C.ok(sorted(x[1] for x in rows).count(2) >= 1 and sorted(x[1] for x in rows).count(1) >= 4, f'{tag}: outcomes include the right answers and the void {sorted(x[1] for x in rows)}')
    rv = page.locator('[data-sec-review]').inner_text()
    out = page.evaluate('(() => { const s = PX.core.store.state; return { run: s.section.runs[s.section.runs.length - 1], next: s.section.next, live: s.section.live, sess: s.sessions[s.sessions.length - 1] }; })()')
    run = out['run']
    C.ok(run['ended'] == 'user' and run['size'] == 'mini' and run['form'] == 1, f'{tag}: the run summary is kept ({run["ended"]}, form {run["form"]})')
    C.ok(f'{run["right"]} of {run["n"]}' in rv, f'{tag}: the review shows right of n ({run["right"]} of {run["n"]})')
    C.ok(run['right'] == 4 + p2_right and run['answered'] == 5 + len(p2), f'{tag}: {4 + p2_right} right of {5 + len(p2)} answered ({run["right"]}/{run["answered"]}; voids in part 2: {p2_void})')
    C.ok(out['next']['mini'] == 2 and out['live'] is None, f'{tag}: the next mini form is 2; nothing is left live')
    C.ok(out['sess']['mode'] == 'section' and out['sess']['trials'] == 5 + len(p2), f'{tag}: one session with mode "section" and {5 + len(p2)} answers ({out["sess"]["trials"]})')
    C.ok(page.evaluate('JSON.stringify(PX.core.store.state.ex)') == ex_before, f'{tag}: no rating changed')
    C.ok('not reached' in rv and 'does not turn them into a score or a prediction for the Dental Admission Test' in rv, f'{tag}: parts not reached are marked; no score prediction')
    shown = page.evaluate('__section.state.run.parts.reduce((n, P) => n + P.items.filter((x) => x.status === "seen" || x.status === "answered").length, 0)')
    C.ok(page.locator('[data-sec-chip]').count() <= shown and page.evaluate('[...document.querySelectorAll("[data-sec-chip]")].every((b) => { const [p, i] = b.getAttribute("data-sec-chip").split(":").map(Number); const it = __section.state.run.parts[p].items[i]; return it.status === "seen" || it.status === "answered"; })'), f'{tag}: the review lists only items that were shown')
    page.screenshot(path=str(OUT / f'{tag}_review.png'), full_page=True)

    # v1.2 O10: a reload during the review brings the review back (1.1: the setup screen)
    rv_counts = page.locator('.sec-totals').inner_text()
    page.wait_for_timeout(1300)  # the debounced save of the review's state
    page.reload()
    page.wait_for_function(READY, timeout=20000)
    popups(page)
    page.evaluate('PX.debug.fast(true)')
    knobs(page, parts)
    if page.evaluate('PX.core.router.current().name') != 'section':
        page.evaluate('void PX.core.router.go("section")')
    page.wait_for_timeout(400)
    back = page.locator('.sec-totals').inner_text() if page.locator('.sec-totals').count() else None
    why = '' if back else page.evaluate("""() => { const S = PX.engine.section, r = PX.core.store.state, L = S.last(r);
        return JSON.stringify({ kept: !!L, open: L && L.open, versions: L ? L.parts.map((p) => [p.exId, p.version, (PX.ex.get(p.exId) || {}).version]) : null, mode: __section.state && __section.state.mode }); }""")
    C.ok(page.locator('[data-sec-review]').count() == 1 and back == rv_counts and page.locator('[data-sec-chip]').count() >= 1,
         f'{tag}: after a reload the review is back, with its results and items ({back!r}{" " + why if why else ""})')

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
    if phone:
        # RV-play-dat, Section 1-2: the review's Next and its show-me controls are on top (above the
        # tab bar, never under it); the results table labels each number
        ONTOP = '''(sel) => [...document.querySelectorAll(sel)].filter((b) => b.getBoundingClientRect().height).map((b) => { const r = b.getBoundingClientRect();
            const el = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2); return !!(el && b.contains(el)); })'''
        page.wait_for_function('__play.state === "reveal"', timeout=8000)
        nxt = page.evaluate(ONTOP, '.sec-stage [data-next]')
        C.ok(nxt == [True], f'{tag}: the review item’s Next is not under the tab bar {nxt}')
        page.evaluate('PX.debug.fast(false)')
        page.locator('.sec-stage [data-showme]').tap()
        page.wait_for_function('__play.state === "showme"', timeout=8000)
        page.wait_for_timeout(300)
        bar = page.evaluate(ONTOP, '.sec-stage .pl-showme-buttons .px-btn')
        C.ok(len(bar) == 4 and all(bar), f'{tag}: the review’s show-me controls are on top, not under the tab bar {bar}')
        page.screenshot(path=str(OUT / f'{tag}_review_showme.png'))
        page.locator('.sec-stage .pl-showme-buttons .px-btn').nth(3).tap()  # Close
        page.evaluate('PX.debug.fast(true)')
        cells = page.evaluate('''[...document.querySelectorAll('.sec-table tbody tr')].map((tr) => [...tr.querySelectorAll('td[data-label]')].map((td) => {
            const r = td.getBoundingClientRect(); return [Math.round(r.left), Math.round(r.right), Math.round(r.top)]; }))''')
        apart = all(a[1] <= b[0] + 1 or a[2] != b[2] for row in cells for a, b in zip(row, row[1:]))
        C.ok(any(cells) and apart and page.locator('.sec-table td[data-label="Time"]').count() >= 1, f'{tag}: the results table keeps its numbers apart and labelled {cells[:1]}')
    if page.locator('[data-sec-chip].is-open').count():
        lab = page.locator('[data-sec-chip].is-open').first.get_attribute('aria-label') or ''
        C.ok('not answered' in lab and 'skipped' not in lab, f'{tag}: an item without an answer reads "not answered" ({lab})')
    # the Log lists the run as a session; the setup screen names the last section
    page.evaluate('void PX.core.router.go("log")')
    page.wait_for_timeout(400)
    C.ok('Section practice' in page.locator('main').inner_text(), f'{tag}: the Log lists the section as "Section practice"')
    page.evaluate('void PX.core.router.go("section", { size: "mini" })')
    page.wait_for_timeout(300)
    C.ok('Your last section: mini, form 1' in page.locator('.sec-setup').inner_text(), f'{tag}: the setup screen names the last section')
    C.ok('Form 2 (new to you)' in page.locator('[data-sec-form]').inner_text(), f'{tag}: … and offers form 2 as new')
    # v1.2 O10: once left, the review is offered from the setup screen, also after a reload
    page.reload()
    page.wait_for_function(READY, timeout=20000)
    popups(page)
    knobs(page, parts)
    if page.evaluate('PX.core.router.current().name') != 'section':
        page.evaluate('void PX.core.router.go("section", { size: "mini" })')
    page.wait_for_timeout(400)
    C.ok(page.locator('[data-sec-start]').count() == 1 and page.locator('[data-sec-lastreview]').count() == 1, f'{tag}: a review once left stays closed after a reload; the setup screen offers it')
    press(page, '[data-sec-lastreview]', phone)
    page.wait_for_timeout(300)
    C.ok(page.locator('[data-sec-review]').count() == 1 and page.locator('[data-sec-chip]').count() >= 1, f'{tag}: "Open its review" opens it')
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
    wait_mode(page, 'instructions')
    page.wait_for_timeout(budget + 1500)
    C.ok(sec(page)['mode'] == 'instructions', f'{tag}: the instructions can stay open longer than the whole budget ({budget} ms)')
    page.locator('[data-card="start"]').click()
    page.wait_for_function('__section.state && __section.state.mode === "review"', timeout=budget + 8000)
    res = page.evaluate('__section.state.result')
    C.ok(res['ended'] == 'time', f'{tag}: time running out ends the section ({res["ended"]})')
    C.ok(res['usedMs'] <= budget + 50, f'{tag}: used time stops at the budget ({res["usedMs"]} ≤ {budget})')
    C.ok('The time ran out.' in page.locator('.px-screen-head').inner_text(), f'{tag}: the review says the time ran out')
    C.ok(len(con.errors()) == 0, f'{tag}: no console errors {con.errors()[:3]}')
    ctx.close()


def sideways(b, C, sizes=((844, 390), (740, 360))):
    """v1.2 O28 (W3-phones): a mini section on a phone held sideways: the setup and the instructions fit sideways
    (nothing wider than the screen; the instructions are a page to read, so Start the clock comes after them),
    and every item of the first part shows its stimulus, its options and the controls row (Back, Mark, Strike,
    Review, Skip, each at least 44 px) on the screen without scrolling, through answers, a mark, Skip and Back;
    the pause sheet opens and resumes; the review list fits; the part goes on into the next."""
    for w, hgt in sizes:
        tag = f'sideways {w}x{hgt}'
        ctx = b.new_context(viewport={'width': w, 'height': hgt}, has_touch=True, is_mobile=True, device_scale_factor=2)
        page = ctx.new_page()
        con = Console(page)
        boot(page)
        parts, kind = choose_parts(page)
        knobs(page, parts)
        page.evaluate('void PX.core.router.go("section", { size: "mini" })')
        page.wait_for_timeout(300)
        wide = page.evaluate('Math.max(document.documentElement.scrollWidth, document.body.scrollWidth)')
        C.ok(page.locator('[data-sec-start]').count() == 1 and wide <= w + 1, f'{tag}: the setup screen has Start and nothing wider than the screen ({wide})')
        page.screenshot(path=str(OUT / f'sideways_{w}x{hgt}_setup.png'))
        press(page, '[data-sec-start]', True)
        wait_mode(page, 'instructions')
        wide = page.evaluate('Math.max(document.documentElement.scrollWidth, document.body.scrollWidth)')
        page.screenshot(path=str(OUT / f'sideways_{w}x{hgt}_intro.png'))
        page.locator('[data-card="start"]').scroll_into_view_if_needed()
        page.wait_for_timeout(150)
        card = page.evaluate('(() => { const b = document.querySelector(\'[data-card="start"]\'); if (!b) return null; const r = b.getBoundingClientRect(); return [Math.round(r.top), Math.round(r.bottom), Math.round(r.height)]; })()')
        C.ok(wide <= w + 1 and card is not None and card[0] >= 0 and card[1] <= hgt + 1 and card[2] >= 44, f'{tag}: the instructions fit the width, and Start the clock follows them ({wide}; {card})')
        page.screenshot(path=str(OUT / f'sideways_{w}x{hgt}_intro_end.png'))
        press(page, '[data-card="start"]', True)
        wait_mode(page, 'item')
        bad, seen = [], 0
        for k in range(5):
            wait_respond(page)
            page.wait_for_timeout(200)
            f = fits(page)
            seen += 1
            if not f['ok'] or f['scroll'] > 1:
                bad.append((k, page.evaluate('__play.exId'), f))
            if k == 0:
                page.screenshot(path=str(OUT / f'sideways_{w}x{hgt}_item.png'))
                small = page.evaluate('[...document.querySelectorAll(".sec-controls .px-btn")].map((b) => Math.round(b.getBoundingClientRect().height)).filter((x) => x < 44)')
                C.ok(page.locator('.sec-controls .px-btn').count() == 5 and not small, f'{tag}: five controls under the item, each at least 44 px ({small})')
                press(page, '[data-sec-flag]', True)
                C.ok(page.locator('[data-sec-flag]').get_attribute('aria-pressed') == 'true', f'{tag}: Flag marks the item')
                press(page, '[data-sec-next]', True)  # Skip
                wait_respond(page)
                press(page, '[data-sec-back]', True)
                page.wait_for_function('__section.state.index === 0', timeout=5000)
                wait_respond(page)
                page.evaluate('PX.ui.play.current() && PX.ui.play.current().pause && PX.ui.play.current().pause()')
                page.wait_for_timeout(300)
                sheet = page.evaluate('(() => { const e = document.querySelector(\'.pl-pause:not([hidden]), [data-pause-sheet]\'); if (!e) return null; const r = e.getBoundingClientRect(); return [r.top, r.bottom]; })()')
                if sheet:
                    page.screenshot(path=str(OUT / f'sideways_{w}x{hgt}_pause.png'))
                    C.ok(sheet[1] <= hgt + 1, f'{tag}: the pause sheet lies on the screen ({sheet})')
                    page.evaluate('PX.ui.play.current() && PX.ui.play.current().resume && PX.ui.play.current().resume()')
                    page.wait_for_timeout(300)
                    wait_respond(page)
            answer_key(page, True, True)
            page.wait_for_timeout(200)
            if sec(page)['mode'] != 'item':
                break
        C.ok(seen >= 3 and not bad, f'{tag}: every item of the part fits the screen without scrolling ({seen} items; {bad[:2]})')
        page.wait_for_timeout(300)
        st2 = sec(page)
        C.ok(st2['mode'] in ('item', 'list', 'review') and (st2['mode'] != 'item' or st2['part'] >= 1), f'{tag}: the part goes on into the next ({st2["mode"]}, part {st2["part"]})')
        page.screenshot(path=str(OUT / f'sideways_{w}x{hgt}_after.png'))
        if st2['mode'] == 'item':
            wait_respond(page)
            press(page, '[data-sec-items]', True)
            wait_mode(page, 'list')
            wide = page.evaluate('Math.max(document.documentElement.scrollWidth, document.body.scrollWidth)')
            chips = page.evaluate('[...document.querySelectorAll("[data-sec-list] [data-sec-item]")].map((b) => Math.round(b.getBoundingClientRect().height))')
            C.ok(wide <= w + 1 and chips and min(chips) >= 44, f'{tag}: the review list fits the width, its items at least 44 px ({wide}; {chips[:3]})')
            page.screenshot(path=str(OUT / f'sideways_{w}x{hgt}_list.png'), full_page=True)
        C.ok(not con.errors(), f'{tag}: no console errors ({con.errors()[:3]})')
        ctx.close()


def main():
    C = Checks('section')
    only = [a for a in sys.argv[1:] if not a.startswith('-')]
    with sync_playwright() as p:
        b = launch(p)
        try:
            if only == ['sideways']:  # v1.2 O28: `section.py sideways` runs only the sideways part
                sideways(b, C)
                sys.exit(C.summary())
            main_run(b, C, 'phone', True)
            main_run(b, C, 'desktop', False)
            sideways(b, C)
            time_up(b, C)
        finally:
            b.close()
    sys.exit(C.summary())


if __name__ == '__main__':
    main()
