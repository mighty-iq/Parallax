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
  - the Log names the Climb's sessions "Weekly Climb" (rows and the mode filter);
  - desktop: the game layer's card kinds (grade, climb, reach, atlas, startnow) each draw their own picture in
    both sizes, in ink and green, never the accent (cards in tests/e2e/out/game/card-<kind>-<size>.png);
  - every panel fits the width; no page or console errors.
O14 (390 x 844, with phone390 or --only resume): a test build's save in the middle of a Daily (positions only, no
seeds) loads with the seeds of its date and goes on by seed: the answered items never come again.
Run: tests/e2e/pwslot.sh python3 tests/e2e/game.py [--only desktop,phone390,phone360,resume]
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


CARD_PICS = {
    'grade': "{ grade: 6, best: 55 }",
    'climb': "{ height: 13, rungs: 20, notches: [9, 14], best: 13 }",
    'reach': "{ max: 1400, parts: [31, 45, 22, 0, 55, 40, 12, 60, 18, 33, 0, 27, 41, 9] }",
    'atlas': "{ cols: 5, rows: 3, cells: { '0.0': 2, '1.0': 2, '2.0': 1, '0.1': 2, '1.1': 1, '3.2': 1 } }",
    'startnow': "{ rows: [['Fold', 22, 41], ['Rotate', 30, 38], ['Central Point', 18, 35], ['Spin', 44, 40], ['Nets', 12, 29]] }",
}


def cards(page, C, name):
    """The game layer's card kinds (share.js PICS): each draws its own picture in both sizes, never in the accent."""
    import base64
    for kind, pic in CARD_PICS.items():
        for size in ('wide', 'square'):
            res = page.evaluate(f'''(async () => {{
              const o = {{ kind: '{kind}', size: '{size}', theme: 'light', title: 'A {kind} card', lines: ['One line under the picture.'], footer: 'Parallax 1.2', pic: {pic} }};
              const a = await PX.ui.share.card(o), b = await PX.ui.share.card(Object.assign({{}}, o, {{ pic: null }}));
              const W = a.width, H = a.height, g = a.getContext('2d').getImageData(0, 0, W, H).data;
              const top = {size == 'wide' and 280 or 360}, bot = {size == 'wide' and 470 or 860};
              let accent = 0, ink = 0;
              for (let y = top; y < bot; y += 2) for (let x = 72; x < W - 72; x += 2) {{
                const i = (y * W + x) * 4, r = g[i], gg = g[i + 1], bb = g[i + 2];
                if (Math.abs(r - 11) < 14 && Math.abs(gg - 106) < 14 && Math.abs(bb - 134) < 14) accent++;
                if (r < 60 && gg < 60 && bb < 70) ink++;
              }}
              return {{ w: W, h: H, differs: a.toDataURL() !== b.toDataURL(), accent, ink, url: a.toDataURL('image/png') }};
            }})()''')
            want = (1200, 630) if size == 'wide' else (1080, 1080)
            C.ok((res['w'], res['h']) == want and res['differs'] and res['ink'] > 200 and res['accent'] == 0,
                 f'{name}: the {kind} card ({size}) draws its own picture in ink, never the accent ({res["ink"]} ink, {res["accent"]} accent samples)')
            (OUT / f'card-{kind}-{size}.png').write_bytes(base64.b64decode(res['url'].split(',', 1)[1]))


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
    C.ok(slot.count() == 1 and '3 attempts this week' in slot.first.inner_text(), f'{name}: Today shows the Weekly Climb with three attempts')
    order = page.evaluate("Array.from(document.querySelectorAll('.px-today > *')).map(e => e.getAttribute('data-slot') || e.getAttribute('data-gm') || '')")
    C.ok('daily' in order and 'climb' in order and order.index('climb') == order.index('daily') + 1, f'{name}: the Climb comes after the Daily ({order})')
    slot.first.scroll_into_view_if_needed()
    page.screenshot(path=str(OUT / f'{name}-today.png'), full_page=False)
    fits(page, C, name, '.gm-slot', vw)

    # A Train session with Fold pinned
    page.evaluate('PX.debug.fast(false); void PX.core.router.go("play", { mode: "train", exId: "fold", pin: "fold", count: 1 }, { force: true })')
    answers, block_first, ticks, swept = 0, False, [0, 0], False
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
        if page.evaluate('!!document.querySelector(".gm-block-firsts")'):
            block_first = True
        v = page.evaluate('(() => { const v = document.querySelector(".pl-verdict"); return v ? [v.getAttribute("data-kind"), !!v.querySelector(".pl-verdict-icon.gm-tick")] : null; })()')
        if v and v[0] == 'right':
            ticks[0] += 1
            ticks[1] += 1 if v[1] else 0
        if page.evaluate('!!document.querySelector(".px-bar[style*=\'--gm-from\']")'):
            swept = True
        page.evaluate('PX.debug.fast(false); __play.next()')
    C.ok(answers >= 20, f'{name}: {answers} answers in the Train session')
    to_respond(page, C, name, 'train end')
    page.locator('[data-pause]').first.click()
    page.wait_for_function('__play.state === "paused"', timeout=5000)
    page.locator('[data-end]').click()
    page.wait_for_selector('.pl-summary', timeout=15000)
    page.wait_for_timeout(800)
    gm = page.evaluate('(() => { const s = __play.session; return s && s.res ? s.res.game : null; })()')
    print(f'{name}: a first shown as a note between items after a block end: {block_first} (informational: a first made in the last block shows on the summary only)')
    C.ok(ticks[0] > 0 and ticks[1] == ticks[0], f'{name}: every right verdict gets the plotter tick (item:reveal: {ticks[1]} of {ticks[0]})')
    print(f'{name}: a level bar swept at a block end: {swept} (informational: only when a block moved the shown level)')
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

    # Daily v2 (desktop): today's Daily is a ramp with points; its share line carries them and the mark row
    if name == 'desktop':
        # the ramp starts at release (config.daily2.epochs[1].from ships null): this page starts it today
        page.evaluate('PX.engine.config.daily2.epochs[1].from = PX.engine.daily.day(Date.now())')
        page.evaluate('PX.debug.fast(false); void PX.core.router.go("play", { mode: "daily" }, { force: true })')
        n = 0
        for i in range(12):
            r = to_respond(page, C, name, 'daily')
            if r is not True:
                break
            page.evaluate('PX.debug.fast(true)')
            page.evaluate(f'PX.debug.answer({"true" if i % 3 else "false"})')
            page.wait_for_function('__play.state === "reveal" || __play.state === "showme" || __play.state === "done"', timeout=15000)
            if page.evaluate('__play.last ? __play.last.outcome : null') != 'stutter':  # a voided item comes back
                n += 1
            page.evaluate('PX.debug.fast(false); __play.next()')
        try:
            page.wait_for_selector('.pl-daily', timeout=15000)
            line = page.evaluate('''Array.from(document.querySelectorAll('textarea, input')).map(e => e.value).filter(v => /Parallax Daily/.test(v))[0] || ""''')
            pts = page.evaluate('(() => { const r = PX.core.store.state.daily[PX.engine.daily.day(Date.now())]; return r ? [r.points, r.right, r.outcomes] : null; })()')
            want = sum(i + 1 for i, o in enumerate(pts[2]) if o == 1) if pts else None
            C.ok(n == 8 and pts and pts[0] == want and f'{want} of 36 points' in line and 'https://discord.gg/chmr' in line, f'{name}: the Daily ramp: {n} items, points {pts and pts[0]} (1 + 2 + … for the right items), share line {line!r}')
            page.screenshot(path=str(OUT / f'{name}-daily.png'), full_page=False)
        except Exception as e:  # noqa: BLE001
            C.ok(False, f'{name}: the Daily ended with its share line ({e})')

    # The Climb
    page.evaluate('void PX.core.router.go("climb", {}, { force: true })')
    page.wait_for_selector('[data-climb-start]', timeout=10000)
    C.ok(page.locator('.gm-attempts li').count() == 3, f'{name}: the Climb intro lists attempts A, B and C')
    page.screenshot(path=str(OUT / f'{name}-climb-intro.png'), full_page=False)
    fits(page, C, name, '.gm-panel', vw)
    page.evaluate('PX.core.store.state.settings.sound = true; PX.core.store.save()')
    if name == 'desktop':  # playtest mode on (a test build's default; off under automation unless switched on)
        page.evaluate("PX.ui.playtest && PX.ui.playtest.set && PX.ui.playtest.set(true)")
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
    if name == 'desktop':
        C.ok(page.locator('.pt-rate[data-rate="climb"]').count() == 1, f'{name}: playtest mode: the printout carries the three taps for the Climb')
        page.evaluate("PX.ui.playtest && PX.ui.playtest.set && PX.ui.playtest.set(false)")
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
            page.wait_for_timeout(500)  # the sheet's fade-in ends first
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
    # a page kept in the back/forward cache (pagehide with persisted) comes back to a live run, header hidden
    # only while the run goes on
    page.evaluate("window.dispatchEvent(new PageTransitionEvent('pagehide', { persisted: true }))")
    live = page.evaluate('(() => { const s = __climb.state(); return [s && s.done, document.documentElement.getAttribute("data-chrome"), __play.state]; })()')
    C.ok(live[0] is False and live[1] == 'focus' and live[2] == 'respond', f'{name}: after a back/forward-cache pagehide the run goes on ({live})')
    hb = page.evaluate('(() => { const s = __climb.state(); return s && s.plan ? s.plan.height : null; })()')
    page.evaluate("window.dispatchEvent(new PageTransitionEvent('pagehide', { persisted: false }))")
    gone = page.evaluate('(() => { const s = __climb.state(); return [s && s.done, document.documentElement.getAttribute("data-chrome")]; })()')
    C.ok(gone[0] is True and gone[1] is None, f'{name}: a page that really goes ends the run and gives the header back ({gone})')
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

    # a practice run (desktop): after the week's attempts, items of its own; no share line, card or invite
    if name == 'desktop':
        page.evaluate('''(() => { const c = PX.engine.game.game(PX.core.store.state).climb, wk = PX.engine.climb.week(Date.now()); c.w = c.w || {}; c.w[wk] = c.w[wk] || {};
          PX.engine.climb.letters().forEach((a) => { c.w[wk][a] = { r: 4, h: 3, m: 2, n: [3, 4], t: Date.now() }; }); PX.core.store.save(); })()''')
        page.evaluate('void PX.core.router.go("climb", {}, { force: true })')
        page.wait_for_selector('[data-climb-start="practice"]', timeout=10000)
        page.locator('[data-climb-start]').click()
        for i in range(6):
            r = to_respond(page, C, name, 'practice')
            if r is not True:
                break
            page.evaluate('PX.debug.fast(true); PX.debug.answer(false)')
            page.wait_for_function('__play.state === "reveal" || __play.state === "showme" || __play.state === "done"', timeout=15000)
            page.evaluate('PX.debug.fast(false); __play.next()')
            if page.locator('[data-climb-end]').count():
                break
        page.wait_for_selector('[data-climb-end]', timeout=15000)
        C.ok(page.locator('[data-climb-end="practice"]').count() == 1 and page.locator('[data-gm-share="climb"]').count() == 0 and page.locator('[data-invite]').count() == 0,
             f'{name}: a practice run ends without a share line, card or invite')
        page.evaluate('void PX.core.router.go("home", {}, { force: true })')
        page.wait_for_timeout(400)

    # The Log names the Climb's sessions "Weekly Climb", in its rows and its mode filter
    page.evaluate('void PX.core.router.go("log", {}, { force: true })')
    page.wait_for_timeout(600)
    lg = page.evaluate('''(() => ({ rows: Array.from(document.querySelectorAll('.px-sess[data-mode="climb"] .px-sess-mode')).map(e => e.textContent),
      opts: Array.from(document.querySelectorAll('select option')).map(o => o.textContent) }))()''')
    C.ok(lg['rows'] and all(r.startswith('Weekly Climb') for r in lg['rows']) and 'Weekly Climb' in lg['opts'], f'{name}: the Log calls the Climb "Weekly Climb" ({lg["rows"][:2]}, filter {[o for o in lg["opts"] if "Climb" in o]})')
    if lg['rows']:
        page.locator('.px-sess[data-mode="climb"]').first.scroll_into_view_if_needed()
        page.screenshot(path=str(OUT / f'{name}-log.png'), full_page=False)

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
    page.evaluate('void PX.core.router.go("exercise/fold", {}, { force: true })')
    page.wait_for_timeout(600)
    ex = page.locator('[data-gm="exercise"]')
    C.ok(ex.count() == 1 and 'atlas' in ex.first.inner_text().lower() and 'cells handled' in ex.first.inner_text(), f'{name}: the Fold page shows its records and Atlas count')
    if ex.count():
        ex.first.locator('button').first.click()
        page.wait_for_timeout(500)
        C.ok(page.locator('[data-atlas="fold"]').count() == 1, f'{name}: its button opens Fold\'s Atlas')
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
    band = page.locator('.gm-summary .gm-stamp-band').first.inner_text()
    C.ok(band.startswith('Levels 51–60. For example: ') and 'typical' not in band.lower(), f'{name}: the stamp gives its band\'s settings as an example, as the player does ({band!r})')
    page.screenshot(path=str(OUT / f'{name}-grade.png'), full_page=False)
    # Angles (version 3): a first names its cell by gap × pose (def.atlas); a first saved under version 2 (gap × size,
    # whose 9° level ignores the size) stays in the record but out of the list
    af = page.evaluate('''(() => { const x = PX.ui.game._.summaryPanel({ res: { game: { grades: [], reach: { before: 1, after: 1, delta: 0, causes: [] },
      firsts: [{ ex: 'angles', v: PX.ex.get('angles').version, cell: '0.0', at: Date.now() }, { ex: 'angles', v: 2, cell: '0.1', at: Date.now() }], near: [], notes: [] } } });
      return x ? Array.from(x.el.querySelectorAll('.gm-firsts li')).map(li => li.textContent) : null; })()''')
    C.ok(af and len(af) == 1 and af[0].count('right angle') == 1 and '9°' in af[0], f'{name}: an Angles first reads once, and one of version 2 is left out ({af})')
    # quiet and reduced motion: effects show their end state at once (fx.run refuses to animate)
    q = page.evaluate('''(() => { const S = PX.core.store.state.settings, keep = [S.celebrate, S.reducedMotion], out = [];
      const el = () => { const d = document.createElement('div'); document.body.appendChild(d); return d; };
      S.celebrate = 'quiet'; out.push(PX.ui.game.fx.run(el(), 'gm-fx-type', 300));
      S.celebrate = 'medium'; S.reducedMotion = 'on'; document.documentElement.setAttribute('data-motion', 'reduce'); out.push(PX.ui.game.fx.run(el(), 'gm-fx-type', 300));
      S.reducedMotion = keep[1]; document.documentElement.removeAttribute('data-motion'); out.push(PX.ui.game.fx.run(el(), 'gm-fx-type', 300));
      document.body.classList.add('px-stim'); out.push(PX.ui.game.fx.run(el(), 'gm-fx-type', 300)); document.body.classList.remove('px-stim');
      S.celebrate = keep[0]; return out; })()''')
    C.ok(q == [False, False, True, False], f'{name}: no motion at the quiet level, under reduced motion or during a stimulus; motion at medium otherwise ({q})')
    # the needle sweep on a level bar (play.js calls it at a block end and on the summary)
    sw = page.evaluate('''(() => { const b = PX.ui.bar(50, 100, { kind: 'signal' }); document.querySelector('.px-wrap').appendChild(b);
      const ran = PX.ui.game.sweep(b, 40, 50); return [ran, b.classList.contains('gm-fx-sweep'), b.style.getPropertyValue('--gm-from')]; })()''')
    page.wait_for_timeout(750)
    done = page.evaluate('(() => { const b = document.querySelectorAll(".px-wrap > .px-bar"); const x = b[b.length - 1]; return [x.classList.contains("gm-fx-sweep"), x.classList.contains("gm-fx-done")]; })()')
    C.ok(sw[0] is True and sw[1] is True and sw[2].strip() == '0.8' and done == [False, True], f'{name}: the needle sweeps from 40 to 50 and ends within 700 ms ({sw}, {done})')
    if name == 'desktop':
        cards(page, C, name)
    errs = con.errors()
    C.ok(not errs, f'{name}: no page or console errors ({errs[:3]})')
    b.close()


def run_daily_resume(p, C, name, ctx_opts):
    """O14: a 1.2 test build's save in the middle of a Daily (positions only, no seeds) loads with its seeds and goes
    on by seed: the three answered items never come again, the other five do, and the attempt is spent."""
    b = launch(p)
    ctx = b.new_context(**ctx_opts)
    page = ctx.new_page()
    con = Console(page)
    boot(page)
    # what test build 3 wrote after three answers (right, wrong, right) and End now
    page.evaluate('''(() => { const R = PX.core.store.state, D = PX.engine.daily, day = D.day(Date.now());
      R.daily[day] = { n: 8, answered: 3, right: 2, t: Date.now() - 3600e3, number: D.number(day), outcomes: [1, 0, 1, null, null, null, null, null], ep: D.epoch(day).n, partial: true };
      PX.core.store.flush(); })()''')
    page.reload()
    page.wait_for_function(READY, timeout=30000)
    page.evaluate(MUTE)
    dismiss(page)
    seeds = page.evaluate('(() => { const D = PX.engine.daily, day = D.day(Date.now()), e = PX.core.store.state.daily[day]; return [e.seeds || null, D.daySeeds(day)]; })()')
    C.ok(seeds[0] == seeds[1], f'{name}: the save from a test build gets the seeds of its date when it loads ({seeds[0] and len(seeds[0])} seeds)')
    t0 = page.evaluate('Math.floor(Date.now() / 1000)')
    page.evaluate('PX.debug.fast(false); void PX.core.router.go("play", { mode: "daily" }, { force: true })')
    page.wait_for_timeout(600)
    intro = page.evaluate('document.body.innerText')
    C.ok('goes on where it stopped: 3 of 8 answered' in intro, f'{name}: the Daily says it goes on where it stopped ({" ".join(intro.split())[:160]!r})')
    page.screenshot(path=str(OUT / f'{name}-daily-resume.png'), full_page=False)
    n = 0
    for i in range(12):
        r = to_respond(page, C, name, 'daily resumed')
        if r is not True:
            break
        page.evaluate('PX.debug.fast(true)')
        page.evaluate('PX.debug.answer(true)')
        page.wait_for_function('__play.state === "reveal" || __play.state === "showme" || __play.state === "done"', timeout=15000)
        n += 1
        page.evaluate('PX.debug.fast(false); __play.next()')
    try:
        page.wait_for_selector('.pl-daily', timeout=15000)
    except Exception as e:  # noqa: BLE001
        C.ok(False, f'{name}: the resumed Daily ends on its result ({e})')
    got = page.evaluate(f'''(() => {{ const R = PX.core.store.state, D = PX.engine.daily, day = D.day(Date.now()), e = R.daily[day], nm = PX.engine.log.names(R);
      const rows = R.trials.filter((r) => r[0] >= {t0} && nm.mode[r[2]] === 'daily' && (r[5] === 0 || r[5] === 1)).map((r) => r[4]);
      return {{ rows, all: D.daySeeds(day), entry: e }}; }})()''')
    later = got['all'][3:]
    C.ok(sorted(got['rows']) == sorted(later), f'{name}: it dealt the five unanswered items and none of the three answered ({len(got["rows"])} answers, {n} taps)')
    e = got['entry']
    C.ok(e and not e.get('partial') and e['answered'] == 8 and e['right'] == 2 + len(got['rows']) and e['seeds'] == got['all'] and e['outcomes'][:3] == [1, 0, 1],
         f'{name}: the attempt is spent with its first three answers kept on their items ({e and {k: e[k] for k in ("answered", "right", "outcomes")}})')
    page.screenshot(path=str(OUT / f'{name}-daily-resumed-end.png'), full_page=False)
    errs = con.errors()
    C.ok(not errs, f'{name}: no page or console errors in the resumed Daily ({errs[:3]})')
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
        if 'phone390' in args.only or 'resume' in args.only:
            run_daily_resume(p, C, 'resume390', {'viewport': {'width': 390, 'height': 844}, 'device_scale_factor': 2, 'is_mobile': True, 'has_touch': True})
        if 'phone360' in args.only:
            run_viewport(p, C, 'phone360', {'viewport': {'width': 360, 'height': 640}, 'device_scale_factor': 2, 'is_mobile': True, 'has_touch': True}, rnd)
    return C.summary()


if __name__ == '__main__':
    sys.exit(main())
