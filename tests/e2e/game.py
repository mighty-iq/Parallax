#!/usr/bin/env python3
"""The game layer in the app (PLAN milestone 5, option B; js/ui/game.js, climb.js, atlas.js; css/game.css).

Every other builder's screen hook is muted after each load (PX.ui.hooks.mute: only 'game.*' runs), so a
measurement or a comparison round cannot get in the way; the engine hooks all run. Per viewport
(1366 x 768 mouse; 390 x 844 and 360 x 640 touch, DPR 2):
  - Today: the Weekly Climb slot (attempts left, rules) after the Daily; nothing of the game layer while an item
    is on screen (body.px-stim and the item phases) in a Train session, the Climb or the Daily;
  - a Train session with Fold pinned (a bot answers about 85 % right, ends from the pause sheet): the summary's
    game panel (Reach and its cause, a grade stamp, firsts) when the session made them, its invite;
  - the Climb: the intro (attempts A, B, C), a run (the HUD reads "Rung r of 20", the scale hides while an item
    is on screen and steps up between rungs), the end printout after the second miss with its share line, the
    record's game.climb entry, the next attempt offered;
  - the Atlas: the grid of Fold with its handled cells, the legend; Progress: Reach and the grades table;
    Settings: the Game layer section (celebrations, Climb sounds, rank titles);
  - every panel fits the width; no page or console errors.
Run: tests/e2e/pwslot.sh python3 tests/e2e/game.py [--only desktop,phone390,phone360]
Report: tests/e2e/out/game.json; screenshots in tests/e2e/out/game/.
"""
import argparse
import pathlib
import random
import sys

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
from playwright.sync_api import sync_playwright  # noqa: E402
from common import launch, Console, Checks, ROOT, OUT as OUT_ROOT  # noqa: E402

OUT = OUT_ROOT / 'game'
OUT.mkdir(parents=True, exist_ok=True)
INDEX = ROOT / 'index.html'
READY = 'document.documentElement.getAttribute("data-px-ready") === "1"'
MUTE = "PX.ui.hooks && PX.ui.hooks.mute(function (id) { return /^game\\./.test(id); })"
# Something of the game layer visible (a box with size, not visibility:hidden) while a stimulus or an item phase is on.
GAME_VISIBLE = '''(() => {
  const els = Array.from(document.querySelectorAll('.gm-panel, .gm-slot, .gm-climb-scale, .gm-stamp-wrap, .gm-ring, .gm-scale'));
  return els.filter((e) => { const r = e.getBoundingClientRect(), cs = getComputedStyle(e); return r.width > 0 && r.height > 0 && cs.visibility !== 'hidden' && cs.display !== 'none'; }).map((e) => e.className.baseVal || e.className);
})()'''


def dismiss(page):
    for _ in range(6):
        if not page.evaluate('PX.ui.modalOpen()'):
            break
        page.keyboard.press('Escape')
        page.wait_for_timeout(250)


def boot(page):
    page.goto(INDEX.as_uri())
    page.wait_for_function(READY, timeout=30000)
    page.evaluate(MUTE)
    dismiss(page)
    page.evaluate('''PX.ex.list('train').forEach(d => { PX.core.store.state.tour.seen[d.id] = true; });
      PX.core.store.state.ui.seen = PX.core.store.state.ui.seen || {}; PX.core.store.state.ui.seen.motionNotice = Date.now(); PX.core.store.state.ui.seen.walkNotice = Date.now();
      PX.core.store.save();''')


def to_respond(page, C, name, where, ms=30000):
    for _ in range(ms // 100):
        st = page.evaluate('__play.state')
        if st in ('present', 'respond', 'ready'):
            vis = page.evaluate(GAME_VISIBLE)
            if vis:
                C.ok(False, f'{name}: {where}: game elements visible while an item is on screen ({vis[:4]})')
                return 'bad'
        if st == 'respond':
            return True
        if st == 'paused':
            page.evaluate('__play.resume()')
        if st in ('reveal', 'showme'):
            page.evaluate('PX.debug.fast(false); __play.next()')
        card = page.locator('[data-card-box] .px-btn--primary')
        if card.count() and card.first.is_visible():
            page.evaluate('PX.debug.fast(false)')
            card.first.click()
        page.wait_for_timeout(100)
    return False


def fits(page, C, name, sel, vw):
    boxes = page.evaluate(f'''Array.from(document.querySelectorAll({sel!r})).map(e => {{ const r = e.getBoundingClientRect(); return [r.left, r.right, e.scrollWidth - e.clientWidth]; }})''')
    bad = [b for b in boxes if b[0] < -1 or b[1] > vw + 1]
    C.ok(boxes and not bad, f'{name}: {sel} fits the width ({len(boxes)} boxes, {bad[:2]})')


def run_viewport(p, C, name, ctx_opts, rnd):
    b = launch(p)
    ctx = b.new_context(**ctx_opts)
    page = ctx.new_page()
    con = Console(page)
    vw = ctx_opts['viewport']['width']
    boot(page)
    hooks = page.evaluate("['summary:panels', 'today:slots', 'progress:panels', 'settings:sections', 'item:reveal'].map(p => PX.ui.hooks.list(p).map(h => h.id).filter(i => /^game\\./.test(i)))")
    C.ok(all(len(x) >= 1 for x in hooks), f'{name}: the game handlers are mounted ({hooks})')
    # Today: the Climb slot
    page.evaluate('void PX.core.router.go("home", {}, { force: true })')
    page.wait_for_timeout(500)
    slot = page.locator('[data-gm="climb"]')
    C.ok(slot.count() == 1 and 'Three attempts this week' in slot.first.inner_text(), f'{name}: Today shows the Weekly Climb with three attempts')
    order = page.evaluate("Array.from(document.querySelectorAll('.px-today > *')).map(e => e.getAttribute('data-slot') || e.getAttribute('data-gm') || '')")
    C.ok('daily' in order and 'climb' in order and order.index('climb') == order.index('daily') + 1, f'{name}: the Climb comes after the Daily ({order})')
    slot.first.scroll_into_view_if_needed()
    page.screenshot(path=str(OUT / f'{name}-today.png'), full_page=False)
    fits(page, C, name, '.gm-slot', vw)

    # A Train session with Fold pinned
    page.evaluate('PX.debug.fast(false); void PX.core.router.go("play", { mode: "train", exId: "fold", pin: "fold", count: 1 }, { force: true })')
    answers = 0
    for i in range(24):
        r = to_respond(page, C, name, 'train')
        if r is not True:
            if r is False:
                C.ok(False, f'{name}: answer {i + 1} never reached an answer phase ({page.evaluate("__play.state")})')
            break
        page.evaluate('PX.debug.fast(true)')
        page.evaluate(f'PX.debug.answer({"true" if rnd.random() < 0.85 else "false"})')
        page.wait_for_function('__play.state === "reveal" || __play.state === "showme" || __play.state === "done"', timeout=15000)
        answers += 1
        page.evaluate('PX.debug.fast(false); __play.next()')
    C.ok(answers >= 20, f'{name}: {answers} answers in the Train session')
    to_respond(page, C, name, 'train end')
    page.locator('[data-pause]').first.click()
    page.wait_for_function('__play.state === "paused"', timeout=5000)
    page.locator('[data-end]').click()
    page.wait_for_selector('.pl-summary', timeout=15000)
    page.wait_for_timeout(800)
    gm = page.evaluate('(() => { const s = __play.session; return s && s.res ? s.res.game : null; })()')
    C.ok(gm is not None and isinstance(gm.get('firsts'), list), f'{name}: the session has res.game ({gm and {k: (len(gm[k]) if isinstance(gm[k], list) else gm[k]) for k in ("firsts", "grades", "near")}})')
    panel = page.locator('.pl-summary [data-gm="summary"]')
    made = gm and (gm['firsts'] or gm['grades'] or (gm['reach'] and gm['reach']['delta'] > 0))
    C.ok(panel.count() == (1 if made else 0), f'{name}: the summary shows the game panel exactly when the session made something ({panel.count()})')
    if panel.count():
        txt = panel.first.inner_text()
        if gm['reach']['delta'] > 0:
            C.ok(f"reach {gm['reach']['after']}" in ' '.join(txt.lower().split()) and '+' + str(gm['reach']['delta']) in txt, f'{name}: Reach and its cause ({txt[:160]!r})')
        if gm['grades']:
            C.ok(page.locator('.pl-summary [data-gm="summary"] .gm-stamp').count() >= 1 and 'grade' in txt.lower() and 'levels' in txt.lower(), f'{name}: the grade stamp with its band')
            inv = page.locator('.pl-summary [data-invite="grade"], .pl-summary [data-invite="best"]')
            C.ok(inv.count() == 1, f'{name}: one Chimera invite at the grade (or the personal best that made it)')
        if gm['firsts']:
            C.ok('first' in txt.lower() and page.locator('.pl-summary [data-gm="summary"] .gm-firsts li').count() >= 1, f'{name}: the firsts are listed')
        panel.first.scroll_into_view_if_needed()
        page.wait_for_timeout(750)
        page.screenshot(path=str(OUT / f'{name}-summary.png'), full_page=False)
        fits(page, C, name, '.gm-summary', vw)

    # The Climb
    page.evaluate('void PX.core.router.go("climb", {}, { force: true })')
    page.wait_for_selector('[data-climb-start]', timeout=10000)
    C.ok(page.locator('.gm-attempts li').count() == 3, f'{name}: the Climb intro lists attempts A, B and C')
    page.screenshot(path=str(OUT / f'{name}-climb-intro.png'), full_page=False)
    fits(page, C, name, '.gm-panel', vw)
    page.evaluate('PX.core.store.state.settings.sound = true; PX.core.store.save()')
    played0 = page.evaluate('PX.ui.game.sound.played')
    page.locator('[data-climb-start]').click()
    rungs, misses, stepped, hud_ok, voided = 0, 0, 0, True, 0
    seq = [True, True, True, False, True, False]
    i = 0
    for _ in range(14):
        if i >= len(seq):
            break
        ok = seq[i]
        r = to_respond(page, C, name, 'climb')
        if r is not True:
            if r is False:
                C.ok(False, f'{name}: Climb item {i + 1} never reached an answer phase')
            break
        meta = page.evaluate('document.querySelector(".pl-hud-meta") ? document.querySelector(".pl-hud-meta").textContent : ""')
        if f'Rung {rungs + 1} of 20' not in meta:
            hud_ok = False
        if i == 0:
            hidden = page.evaluate('getComputedStyle(document.querySelector(".gm-climb-scale")).visibility')
            C.ok(hidden == 'hidden', f'{name}: the scale is hidden while rung {rungs + 1} is on screen ({hidden})')
        page.evaluate('PX.debug.fast(true)')
        page.evaluate(f'PX.debug.answer({"true" if ok else "false"})')
        page.wait_for_function('__play.state === "reveal" || __play.state === "showme" || __play.state === "done"', timeout=15000)
        last = page.evaluate('__play.last ? __play.last.outcome : null')
        if last == 'stutter':  # a voided item (a stutter on a busy machine) comes back unchanged and counts nowhere
            voided += 1
        else:
            i += 1
            if ok:
                rungs += 1
            else:
                misses += 1
        h = page.evaluate('(() => { const s = __climb.state(); return s && s.plan ? [s.plan.height, s.plan.misses] : null; })()')
        if h == [rungs, misses]:
            stepped += 1
        if i == 3:
            page.screenshot(path=str(OUT / f'{name}-climb-run.png'), full_page=False)
        page.evaluate('PX.debug.fast(false); __play.next()')
    C.ok(hud_ok, f'{name}: the item counter reads "Rung r of 20"')
    C.ok(stepped == len(seq) + voided and i == len(seq), f'{name}: the height and misses follow the answers ({stepped} of {len(seq) + voided}; {voided} voided)')
    page.wait_for_selector('[data-climb-end]', timeout=15000)
    # touch targets in the Climb's printout and Today's slots are at least 44 px high (phones)
    if ctx_opts.get('has_touch'):
        small = page.evaluate('''Array.from(document.querySelectorAll('.gm-panel button, .gm-slot button')).map(b => b.getBoundingClientRect()).filter(r => r.width > 0 && r.height < 43.5).length''')
        C.ok(small == 0, f'{name}: every button of the printout is at least 44 px high ({small} smaller)')
    end = page.locator('[data-climb-end]')
    C.ok(end.first.get_attribute('data-climb-end') == 'done' and end.first.get_attribute('data-height') == str(rungs), f'{name}: the printout after the second miss: height {rungs}')
    line = page.locator('textarea, input').filter(has_text='').evaluate_all('els => els.map(e => e.value).filter(v => /Parallax Climb/.test(v))')
    C.ok(line and line[0].startswith('Parallax Climb #') and 'https://discord.gg/chmr' in line[0], f'{name}: the share line ({line[:1]})')
    rc = page.evaluate('(() => { const c = PX.core.store.state.game.climb; const w = c.w[PX.engine.climb.week(Date.now())]; return w && w.A ? w.A : null; })()')
    C.ok(rc and rc['h'] == rungs and rc['m'] == 2 and 'p' not in rc, f'{name}: the record keeps attempt A ({rc})')
    C.ok(page.locator('text=Climb attempt B').count() == 1, f'{name}: the next attempt is offered')
    played = page.evaluate('PX.ui.game.sound.played') - played0
    C.ok(played == rungs + 1, f'{name}: with Sound on, one rising tone per rung cleared and a reward for the personal best ({played} sounds, {rungs} rungs)')
    page.evaluate('PX.core.store.state.settings.sound = false; PX.core.store.save()')
    page.screenshot(path=str(OUT / f'{name}-climb-end.png'), full_page=False)
    # the share card draws (the existing share sheet, with the Chimera line in its text)
    page.locator('[data-gm-share="climb"]').first.click()
    try:
        page.wait_for_function('(() => { const i = document.querySelector(".px-share-img"); return !!(i && i.getAttribute("src")); })()', timeout=10000)
        alt = page.evaluate('document.querySelector(".px-share-img").getAttribute("alt")')
        C.ok('height' in alt.lower() and 'discord.gg/chmr' in alt, f'{name}: the Climb card draws, with its text and the Chimera line ({alt[:120]!r})')
        if name == 'phone390':
            page.screenshot(path=str(OUT / f'{name}-climb-card.png'), full_page=False)
    except Exception as e:  # noqa: BLE001
        C.ok(False, f'{name}: the Climb card draws ({e})')
    dismiss(page)
    fits(page, C, name, '.gm-panel', vw)

    # attempt B left part-way (two rungs, then a reload) goes on at rung 3
    page.locator('text=Climb attempt B').first.click()
    for i in range(2):
        if to_respond(page, C, name, 'climb B') is not True:
            break
        page.evaluate('PX.debug.fast(true); PX.debug.answer(true)')
        page.wait_for_function('__play.state === "reveal" || __play.state === "showme" || __play.state === "done"', timeout=15000)
        page.evaluate('PX.debug.fast(false); __play.next()')
    to_respond(page, C, name, 'climb B 3')
    hb = page.evaluate('(() => { const s = __climb.state(); return s && s.plan ? s.plan.height : null; })()')
    page.reload()
    page.wait_for_function(READY, timeout=30000)
    page.evaluate(MUTE)
    dismiss(page)
    page.evaluate('void PX.core.router.go("climb", {}, { force: true })')
    page.wait_for_selector('[data-climb-start]', timeout=10000)
    kept = page.evaluate('(() => { const w = PX.core.store.state.game.climb.w[PX.engine.climb.week(Date.now())]; return w && w.B ? w.B : null; })()')
    C.ok(kept and kept.get('p') == 1 and kept['h'] == hb and page.locator('[data-climb-start="B"]').count() == 1 and 'Go on with attempt B' in page.locator('[data-climb-start]').first.inner_text(),
         f'{name}: a run left by a reload is kept and offered to go on ({kept}, height {hb})')
    page.locator('[data-climb-start]').click()
    to_respond(page, C, name, 'climb B resumed')
    meta = page.evaluate('document.querySelector(".pl-hud-meta") ? document.querySelector(".pl-hud-meta").textContent : ""')
    C.ok(f'Rung {hb + 1} of 20' in meta if isinstance(hb, int) else False, f'{name}: the run goes on at rung {hb and hb + 1} ({meta!r})')
    page.evaluate('void PX.core.router.go("home", {}, { force: true })')
    page.wait_for_timeout(400)

    # The Atlas, Progress, Settings
    page.evaluate('void PX.core.router.go("atlas", { ex: "fold" }, { force: true })')
    page.wait_for_selector('[data-atlas="fold"]', timeout=10000)
    cells = page.evaluate('''(() => { const c = Array.from(document.querySelectorAll('[data-atlas="fold"] .gm-cell[data-cell]')); return { n: c.length, handled: c.filter(e => e.getAttribute('data-state') === 'handled').length, tried: c.filter(e => e.getAttribute('data-state') === 'tried').length }; })()''')
    want = page.evaluate('(() => { const a = PX.engine.game.atlas(PX.core.store.state, PX.ex.get("fold")); return { n: a.total, handled: a.handled, tried: a.tried }; })()')
    C.ok(cells['n'] == want['n'] and cells['handled'] == want['handled'] and cells['handled'] + cells['tried'] == want['tried'], f'{name}: the Atlas grid matches the record ({cells} vs {want})')
    C.ok(want['handled'] >= 1, f'{name}: the session handled at least one Fold cell ({want})')
    page.wait_for_timeout(600)
    page.screenshot(path=str(OUT / f'{name}-atlas.png'), full_page=False)
    fits(page, C, name, '.gm-atlas-sheet', vw)
    page.evaluate('void PX.core.router.go("progress", {}, { force: true })')
    page.wait_for_timeout(700)
    pp = page.locator('[data-gm="progress"]')
    C.ok(pp.count() == 1 and 'Reach' in pp.first.inner_text() and page.locator('[data-gm="progress"] .gm-table tbody tr').count() >= 10, f'{name}: Progress shows Reach and the grades table')
    if pp.count():
        pp.first.scroll_into_view_if_needed()
        page.screenshot(path=str(OUT / f'{name}-progress.png'), full_page=False)
        fits(page, C, name, '[data-gm="progress"]', vw)
    page.evaluate('void PX.core.router.go("settings", {}, { force: true })')
    page.wait_for_timeout(600)
    sec = page.locator('[data-section="game"]')
    C.ok(sec.count() == 1 and 'Climb sounds' in sec.first.inner_text() and 'Quiet' in sec.first.inner_text(), f'{name}: Settings has the Game layer section')
    C.ok(page.evaluate('PX.core.store.state.settings.celebrate') == 'medium' and page.evaluate('PX.core.store.state.settings.climbSound') is True, f'{name}: medium celebrations and Climb sounds on by default')
    # the grade moment: the summary's panel with a grade from 5 to 6 (the stamp, its band, Reach, the invite kind)
    page.evaluate('void PX.core.router.go("home", {}, { force: true })')
    page.wait_for_timeout(400)
    inv = page.evaluate('''(() => { const x = PX.ui.game._.summaryPanel({ res: { game: { grades: [{ exId: 'fold', from: 5, to: 6, level: 55 }],
      reach: { before: 400, after: 406, delta: 6, causes: [{ exId: 'fold', from: 49, to: 55 }] }, firsts: [{ ex: 'fold', v: 1, cell: '2.1', at: Date.now() }], near: [], notes: [] } } });
      const host = document.querySelector('.px-wrap'); host.insertBefore(x.el, host.firstChild); window.scrollTo(0, 0); return x.invite; })()''')
    page.wait_for_timeout(800)
    st = page.locator('.gm-summary .gm-stamp')
    txt = page.locator('.gm-summary').first.inner_text()
    C.ok(inv == 'grade' and st.count() == 1 and 'levels 51–60' in txt.lower() and '406' in txt and 'fold, best block 49 → 55' in txt.lower(), f'{name}: the grade stamp, its band, Reach with its cause and the invite kind ({inv}, {txt[:120]!r})')
    rot = page.evaluate('getComputedStyle(document.querySelector(".gm-summary .gm-stamp")).transform')
    C.ok(rot not in ('none', ''), f'{name}: the stamp sits at its slight angle ({rot})')
    page.screenshot(path=str(OUT / f'{name}-grade.png'), full_page=False)
    errs = con.errors()
    C.ok(not errs, f'{name}: no page or console errors ({errs[:3]})')
    b.close()


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--only', default='desktop,phone390,phone360')
    args = ap.parse_args()
    C = Checks('game')
    rnd = random.Random(5)
    with sync_playwright() as p:
        if 'desktop' in args.only:
            run_viewport(p, C, 'desktop', {'viewport': {'width': 1366, 'height': 768}}, rnd)
        if 'phone390' in args.only:
            run_viewport(p, C, 'phone390', {'viewport': {'width': 390, 'height': 844}, 'device_scale_factor': 2, 'is_mobile': True, 'has_touch': True}, rnd)
        if 'phone360' in args.only:
            run_viewport(p, C, 'phone360', {'viewport': {'width': 360, 'height': 640}, 'device_scale_factor': 2, 'is_mobile': True, 'has_touch': True}, rnd)
    return C.summary()


if __name__ == '__main__':
    sys.exit(main())
