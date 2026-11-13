"""E2E: test hygiene (js/ui/overlap.js, about.js, settings.js B7 sections, library.js, check.js
askOverlap; v1.1 PLAN M5, M6; R4 §6).

- The "Also in tests" notes on the exercise pages of Fold, Hidden, Views, Nets and Span (none on
  Rotate), and on a DAT-style exercise with the ADA line.
- About → Test hygiene: the shared formats, the size of practice effects, what to do, and the
  "Taking a test soon?" button that opens the helper in Settings.
- Settings: PAT focus (setting and history); the helper: ticks → the three-line answer, the day of
  the test, "Leave them out of Train until the test" (settings.testPause, the noted test), the
  active pause surviving a reload, the engine leaving the paused exercises out of Train's choice,
  "End the pause now", removing a noted test.
- PAT focus on Train: with every other exercise paused, Train runs a DAT-style exercise only while
  PAT focus is on, and is unavailable with it off (a stub DAT-style exercise is defined in the
  page when the real ones are not in this build yet).
- The Spatial Check question: never on a first check; on a later one, one tap before the first
  item, kept on the check record as overlapAnswer once the check is complete.
Screenshots: tests/e2e/out/overlap/. Run: tests/e2e/pwslot.sh python3 tests/e2e/overlap.py
"""
import datetime, json, pathlib, sys
sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
from playwright.sync_api import sync_playwright
from common import launch, Console, Checks, OUT as OUT_ROOT
from play import INDEX, READY, boot, go, card, click_card, drive, wait_state

OUT = OUT_ROOT / 'overlap'
OUT.mkdir(parents=True, exist_ok=True)
PAT = ['openings', 'patviews', 'angles', 'patfold', 'cubes', 'form']
STUB = '''(() => {
  if (PX.ex.get('pattest')) return 'pattest';
  PX.ex.define({ id: 'pattest', code: 'PAT-9', name: 'Stub format', short: 'Stub format', abilities: ['Vz'], cell: null, role: 'train', pat: true,
    answer: 'choice', nOptions: 4, base: -1, dims: [{ key: 'a', label: 'A', levels: [0, 1, 2], step: 0.5 }],
    chance: () => 0.25, generate: (rng, params) => ({ ex: 'pattest', seed: rng.seed, params, key: rng.int(0, 3) }),
    validate: () => true, score: (item, r) => ({ correct: r === item.key }) });
  PX.ex.view('pattest', { layout: 'stem+options',
    present: (item, ctx) => { ctx.host.textContent = 'Stub item ' + item.seed; return ctx.timing.nextPaint(); },
    drawOption: (el, item, i) => { el.textContent = 'Option ' + (i + 1); } });
  return 'pattest';
})()'''


def go_route(page, route):
    page.evaluate(f'void PX.core.router.go({json.dumps(route)}, null, {{ force: true }})')
    page.wait_for_timeout(300)


def notes(b, C):
    tag = 'notes'
    ctx = b.new_context(viewport={'width': 1280, 'height': 900})
    page = ctx.new_page()
    con = Console(page)
    boot(page)
    for ex in ['fold', 'hidden', 'views', 'nets', 'span']:
        go_route(page, 'exercise/' + ex)
        n = page.locator(f'[data-overlap="{ex}"]')
        C.ok(n.count() == 1 and n.inner_text().startswith('Also in tests:'), f'{tag}: {ex} shows its "Also in tests" note')
        if ex == 'fold':
            page.screenshot(path=str(OUT / 'note_fold.png'))
    go_route(page, 'exercise/rotate')
    C.ok(page.locator('[data-overlap]').count() == 0, f'{tag}: Rotate has no note')
    pat = page.evaluate('(ids) => ids.filter((id) => PX.ex.get(id))', PAT)
    if not pat:
        pat = [page.evaluate(STUB)]
    go_route(page, 'exercise/' + pat[0])
    t = page.locator(f'[data-overlap="{pat[0]}"]').inner_text()
    C.ok('Perceptual Ability Test' in t, f'{tag}: {pat[0]}: the note names the test')
    n_ada = page.locator('main').inner_text().count('not affiliated with or endorsed by the ADA')
    C.ok(n_ada == 1, f'{tag}: {pat[0]}: the page shows the ADA line once (in the note, or in the bridge beside it): {n_ada}')
    # How to play (B2's sheet) shows the note and the bridge: the ADA line once there too
    page.evaluate(f'void PX.ui.library.howTo(PX.ex.get({json.dumps(pat[0])}))')  # void: the close function must not be called
    page.wait_for_timeout(300)
    n_ada = page.locator('.px-modal').inner_text().count('not affiliated with or endorsed by the ADA') if page.locator('.px-modal').count() else -1
    C.ok(n_ada == 1, f'{tag}: {pat[0]}: How to play shows the ADA line once ({n_ada})')
    page.keyboard.press('Escape')
    page.wait_for_timeout(150)
    # How to play (B2 renders the note there when it is wired)
    hp = page.evaluate('PX.ui.overlap.noteFor("fold").text')
    C.ok(hp.startswith('Folding and punching paper'), f'{tag}: noteFor gives How to play the same text')
    # About
    go_route(page, 'about')
    ab = page.locator('[data-section="hygiene"]').inner_text()
    for frag in ['paper folding (Fold)', 'hidden shapes (Hidden)', 'counting cubes (Views)', 'cube nets (Nets)', 'block tapping (Span)',
                 'a third of a standard deviation', 'about one standard deviation', 'take the test before you practise', 'Analogy tests']:
        C.ok(frag in ab, f'{tag}: About → Test hygiene says “{frag}”')
    C.ok('Schneider, B., Becker, N.' in page.locator('[data-section="refs"]').inner_text(), f'{tag}: About lists Schneider and colleagues (2020)')
    page.locator('[data-about="testsoon"]').click()
    page.wait_for_timeout(400)
    C.ok(page.evaluate('PX.core.router.current().name') == 'settings', f'{tag}: the About button opens Settings')
    body = page.locator('[data-section="testsoon"] .px-testsoon-body')
    C.ok(body.count() == 1 and body.is_visible(), f'{tag}: … with the helper open')
    focused = page.evaluate('document.activeElement && document.activeElement.closest("[data-section=testsoon]") ? 1 : 0')
    C.ok(focused == 1, f'{tag}: … and focused')
    C.ok(len(con.errors()) == 0, f'{tag}: no console errors {con.errors()[:3]}')
    ctx.close()


def settings(b, C):
    tag = 'settings'
    ctx = b.new_context(viewport={'width': 390, 'height': 844}, has_touch=True, is_mobile=True)
    page = ctx.new_page()
    con = Console(page)
    boot(page)
    go_route(page, 'settings')
    sw = page.locator('[data-setting="patFocus"] input')
    C.ok(sw.count() == 1 and not sw.is_checked(), f'{tag}: PAT focus is off by default')
    page.locator('[data-setting="patFocus"] label').tap()
    page.wait_for_timeout(150)
    st = page.evaluate('({ on: PX.core.store.state.settings.patFocus, h: PX.core.store.state.hygiene.focus })')
    C.ok(st['on'] is True and len(st['h']) == 1 and st['h'][0][1] == 1, f'{tag}: switching it on is saved with its history {st}')
    page.locator('[data-setting="patFocus"] label').tap()
    page.wait_for_timeout(150)
    C.ok(page.evaluate('PX.core.store.state.settings.patFocus') is False, f'{tag}: and off again')

    page.locator('[data-action="testsoon-open"]').tap()
    page.wait_for_timeout(150)
    for k in ['folding', 'tapping', 'analogies']:
        page.locator(f'[data-kind="{k}"]').tap()
    page.wait_for_timeout(150)
    same = page.locator('[data-line="same"]').inner_text()
    C.ok('Fold' in same and 'Span' in same, f'{tag}: same kind of puzzle: {same}')
    C.ok('Spatial Check’s word task' in page.locator('[data-line="untrained"]').inner_text(), f'{tag}: word analogies: not trained here')
    C.ok(page.locator('[data-action="testsoon-pause"]').is_disabled(), f'{tag}: no day yet: nothing can be paused')
    day = (datetime.date.today() + datetime.timedelta(days=10)).isoformat()
    page.locator('[data-action="testsoon-date"]').fill(day)
    page.wait_for_timeout(150)
    C.ok(not page.locator('[data-action="testsoon-pause"]').is_disabled(), f'{tag}: with a day, the pause is offered')
    page.screenshot(path=str(OUT / 'settings_helper.png'), full_page=True)
    page.locator('[data-action="testsoon-pause"]').tap()
    page.wait_for_timeout(300)
    tp = page.evaluate('PX.core.store.state.settings.testPause')
    C.ok(tp and tp['until'] == day and 'fold' in tp['ids'] and 'span' in tp['ids'] and tp['what'] == ['folding', 'tapping', 'analogies'], f'{tag}: settings.testPause {tp}')
    noted = page.evaluate('PX.core.store.state.hygiene.tests')
    C.ok(len(noted) == 1 and noted[0]['date'] == day and 'fold' in noted[0]['paused'], f'{tag}: the test is noted {noted}')
    C.ok(page.locator('[data-testpause="on"]').count() == 1, f'{tag}: Settings shows the active pause')
    C.ok('Daily Challenge' in page.locator('[data-testpause="on"]').inner_text(), f'{tag}: the pause says the Daily Challenge (the same for everyone) still has them')
    out = page.evaluate('(() => { const r = PX.core.store.state, n = Date.now(), S = PX.engine.schedule; return { fold: S.auto(r, PX.ex.get("fold"), n), rotate: S.auto(r, PX.ex.get("rotate"), n), train: S.trainable(r, {}, n).map((d) => d.id) }; })()')
    C.ok(out['fold'] is False and out['rotate'] is True and 'fold' not in out['train'] and 'span' not in out['train'], f'{tag}: Train leaves the paused exercises out {out}')
    page.screenshot(path=str(OUT / 'settings_paused.png'), full_page=True)
    page.wait_for_timeout(1300)
    page.reload()
    page.wait_for_function(READY, timeout=20000)
    for _ in range(3):
        if not page.evaluate('PX.ui.modalOpen()'):
            break
        page.keyboard.press('Escape')
        page.wait_for_timeout(150)
    go_route(page, 'settings')
    C.ok(page.evaluate('PX.core.store.state.settings.testPause.until') == day and page.locator('[data-testpause="on"]').count() == 1, f'{tag}: the pause survives a reload')
    page.locator('[data-action="testpause-end"]').tap()
    page.wait_for_timeout(200)
    C.ok(page.evaluate('PX.core.store.state.settings.testPause') is None and page.evaluate('PX.engine.schedule.auto(PX.core.store.state, PX.ex.get("fold"), Date.now())') is True, f'{tag}: End the pause now: Fold is back in Train')
    # one source of truth: turned figures are related; the DAT includes Fold, and points to the focus
    page.locator('[data-action="testsoon-open"]').tap()
    page.wait_for_timeout(150)
    page.locator('[data-kind="rotation"]').tap()
    page.wait_for_timeout(150)
    C.ok(page.locator('[data-line="same"]').count() == 0 and 'Rotate' in page.locator('[data-line="related"]').inner_text(), f'{tag}: turned or mirrored figures: Rotate and Spin are related, not the same kind')
    page.locator('[data-kind="dat"]').tap()
    page.wait_for_timeout(150)
    same = page.locator('[data-line="same"]').inner_text()
    C.ok('Fold' in same, f'{tag}: the DAT: Fold is the same kind of puzzle ({same})')
    C.ok(page.locator('[data-line="focus"]').count() == 1 and 'not affiliated with or endorsed by the ADA' in page.locator('.px-testsoon-answer').inner_text(), f'{tag}: … with a pointer to the DAT-style focus and the ADA line')
    C.ok(page.locator('[data-action="testsoon-remove"]').count() == 1, f'{tag}: the noted test is listed')
    page.locator('[data-action="testsoon-remove"]').tap()
    page.wait_for_timeout(200)
    C.ok(page.evaluate('PX.core.store.state.hygiene.tests.length') == 0, f'{tag}: and can be removed')
    C.ok(len(con.errors()) == 0, f'{tag}: no console errors {con.errors()[:3]}')
    ctx.close()


def focus_train(b, C):
    tag = 'focus'
    ctx = b.new_context(viewport={'width': 1280, 'height': 860})
    page = ctx.new_page()
    con = Console(page)
    boot(page)
    pat = page.evaluate('(ids) => ids.filter((id) => { const d = PX.ex.get(id); return d && PX.ui.play.canRun(d); })', PAT)
    if not pat:
        pat = [page.evaluate(STUB)]
    others = page.evaluate('(pat) => PX.ex.list("train").filter((d) => !pat.includes(d.id) && !d.pat).map((d) => d.id)', pat)
    day = datetime.date.today().isoformat()
    page.evaluate('(o) => { const s = PX.core.store.state.settings; s.patFocus = false; s.testPause = { ids: o.ids, until: o.day, what: ["unsure"] }; }', {'ids': others, 'day': day})
    tr = page.evaluate('PX.engine.schedule.trainable(PX.core.store.state, { can: PX.ui.play.canRun }, Date.now()).map((d) => d.id)')
    C.ok(tr == [], f'{tag}: PAT focus off: no DAT-style exercise joins Train ({tr})')
    go(page, {'mode': 'train'})
    page.wait_for_timeout(400)
    C.ok('Not available' in page.locator('h1').first.inner_text(), f'{tag}: with every other exercise paused, Train has nothing to run')
    page.evaluate('PX.core.store.state.settings.patFocus = true')
    tr = page.evaluate('PX.engine.schedule.trainable(PX.core.store.state, { can: PX.ui.play.canRun }, Date.now()).map((d) => d.id)')
    C.ok(sorted(tr) == sorted(pat), f'{tag}: PAT focus on: the DAT-style exercises join Train ({tr})')
    go(page, {'mode': 'train'})
    page.wait_for_function('__play.exId !== null', timeout=10000)
    C.ok(page.evaluate('__play.exId') in pat, f'{tag}: Train runs a DAT-style exercise ({page.evaluate("__play.exId")})')
    page.screenshot(path=str(OUT / 'focus_train.png'))
    errs = [e for e in con.errors() if 'pattest' not in e]
    C.ok(len(errs) == 0, f'{tag}: no console errors {errs[:3]}')
    ctx.close()


def check_question(b, C):
    tag = 'check'
    ctx = b.new_context(viewport={'width': 1280, 'height': 860})
    page = ctx.new_page()
    con = Console(page)
    boot(page)
    # a first check never asks
    go(page, {'mode': 'check'})
    click_card(page, 'start')
    seen = []
    for _ in range(3):
        c = card(page)
        seen.append(c)
        if c == 'expect':
            page.locator('[data-expect="3"]').click()
            page.wait_for_timeout(150)
        else:
            break
    C.ok('overlap' not in seen, f'{tag}: a first check does not ask ({seen})')
    # a later check: one complete check in the record, two days old
    page.evaluate('''(() => { const r = PX.core.store.state, t = Date.now() - 2 * 86400000;
      r.assess = [{ date: new Date(t).toISOString(), form: 'A', kind: 'B1', results: { wordlinks: { right: 10, n: 16, theta: 0, se: 0.5 } } }];
      PX.engine.assess.expect(r, 3, t); PX.core.store.save(); })()''')
    go(page, {'mode': 'check'})
    click_card(page, 'start')
    C.ok(card(page) == 'overlap', f'{tag}: a later check asks the question first ({card(page)})')
    q = page.locator('[data-card-box="overlap"]').inner_text()
    C.ok('Since your last check, have you practised or taken another test with puzzles like these, or with word analogies?' in q, f'{tag}: the question as worded')
    C.ok(page.locator('[data-overlap-answer]').count() == 3, f'{tag}: three answers: No, A little, A lot')
    page.screenshot(path=str(OUT / 'check_question.png'))
    page.locator('[data-overlap-answer="little"]').click()
    page.wait_for_timeout(200)
    C.ok(page.evaluate('PX.ui.check.session.plan.check.extra.overlapAnswer') == 'little', f'{tag}: the answer waits on the check')
    C.ok(card(page) == 'probe-intro', f'{tag}: then the first task')
    ok = drive(page, '!!document.querySelector(".pl-summary")', limit=1500)
    C.ok(ok, f'{tag}: the check runs to its end')
    a = page.evaluate('PX.core.store.state.assess')
    C.ok(len(a) == 2 and a[1].get('overlapAnswer') == 'little', f'{tag}: the check record keeps overlapAnswer ({a[-1].get("overlapAnswer") if a else None})')
    C.ok(len(con.errors()) == 0, f'{tag}: no console errors {con.errors()[:3]}')
    ctx.close()


def main():
    C = Checks('overlap')
    with sync_playwright() as p:
        b = launch(p)
        try:
            for fn in (notes, settings, focus_train, check_question):
                try:
                    fn(b, C)
                except Exception as e:  # one broken part must not hide the others
                    C.ok(False, f'{fn.__name__}: {type(e).__name__}: {str(e)[:300]}')
        finally:
            b.close()
    sys.exit(C.summary())


if __name__ == '__main__':
    main()
