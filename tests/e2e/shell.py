"""E2E tests of the app shell (Phase 1b; v1.2 milestone 2).

Checks the full Chimera pop-up on the first open (text, link href/target/rel, visible address, Copy,
Esc, focus trap) and the one-tap card on later opens (v1.2: under the header, not a modal, ✕ and Esc
end it, a session ends it, it fits 360 px), the invites at the tour's end and in the backup dialog,
the Settings controls for the nickname and device details, playtest mode in a sandboxed srcdoc
(note, report copied through the clipboard fallback), the first-run tour offer (shown once),
navigation by header, phone tab bar
and More sheet without the frame navigating away, settings (theme, text size), the backup →
import → undo round trip, the download on file://, file:// and a sandboxed srcdoc frame
(storage blocked: the banner shows), no console errors, no horizontal scroll at 360 × 640,
44 px targets, visible focus, reduced motion, and takes screenshots of the pop-up, the one-tap card,
Today, Settings, About and the playtest report at 1366 × 768 and 360 × 640 in light and dark into
tests/e2e/out/shell/.
v1.1 phones (run_phones_b2): no horizontal scroll at 150 % text on 360 and 390 px, touch-action,
a notch held sideways (CDP safe-area insets: nothing in the left and right insets, the welcome
opens at its first line), the storage hint on an iPhone and not on a desktop, and the web
manifest and icons linked and loading on https (served from the repository) but not on file://.

Run: python3 tests/e2e/shell.py   (exit code 1 when a check fails; results.json in OUT)
"""
import json, pathlib, re, sys
sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
from playwright.sync_api import sync_playwright
from shell_common import (ROOT, OUT, INDEX, DISCORD, READY, Results, attach_console, problems,
                          active_assets, pending_scripts, inline_single, write_host, child_frame)

R = Results()
ROUTES = ['home', 'library', 'progress', 'log', 'lab', 'settings', 'about']
FULLPAGE_FIX = '.px-tabbar{position:static!important}.px-app{padding-bottom:0!important}'
TARGETS_JS = '''() => {
  const out = [];
  const sel = 'button, a[href], select, textarea, input:not([type=radio]):not([type=checkbox]), .px-seg-item, .px-switch';
  for (const el of document.querySelectorAll(sel)) {
    if (el.closest('[hidden],[inert]') || el.matches('.px-refs a, .px-skip')) continue;
    const st = getComputedStyle(el), r = el.getBoundingClientRect();
    if (!r.width || !r.height || st.display === 'none' || st.visibility === 'hidden') continue;
    if (r.width < 43.5 || r.height < 43.5) out.push(`${el.tagName.toLowerCase()}.${el.className} ${Math.round(r.width)}x${Math.round(r.height)} "${(el.textContent || '').trim().slice(0, 24)}"`);
  }
  return out;
}'''


def ready(t):
    t.wait_for_function(READY, timeout=20000)
    t.evaluate('document.fonts.ready.then(() => 1)')


def modals(t):
    return t.evaluate('PX.ui.modalOpen()')


def go(t, route):
    t.evaluate(f'void PX.core.router.go("{route}")')  # void: never hand Playwright a function


def welcome_checks(t, tag):
    w = '.px-modal[data-welcome]'
    R.check(f'{tag}: pop-up shown on open', t.locator(w).count() == 1)
    title = t.locator(f'{w} .px-welcome-title').inner_text()
    R.check(f'{tag}: pop-up text', title == 'Parallax was built by the Chimera community on Discord.', title)
    a = t.locator(f'{w} a[data-chimera="join"]').evaluate(
        'a => ({ href: a.getAttribute("href"), target: a.target, rel: a.rel, text: a.textContent.trim() })')
    R.check(f'{tag}: join link href', a['href'] == DISCORD, str(a))
    R.check(f'{tag}: join link target=_blank rel=noopener', a['target'] == '_blank' and 'noopener' in a['rel'], str(a))
    R.check(f'{tag}: join button label', a['text'] == 'Join the Chimera Discord', a['text'])
    url = t.locator(f'{w} .px-linkcopy-url')
    R.check(f'{tag}: address shown as text', url.input_value() == DISCORD, url.input_value())
    R.check(f'{tag}: address not clipped', url.evaluate('i => i.scrollWidth <= i.clientWidth + 1'))
    R.check(f'{tag}: Continue button', t.locator(f'{w} [data-welcome="start"]').inner_text().strip() == 'Continue to Parallax')
    vis = t.evaluate('''() => { const m = document.querySelector('.px-modal[data-welcome]'), b = m.querySelector('[data-welcome="start"]').getBoundingClientRect();
      return { top: Math.round(b.top), bottom: Math.round(b.bottom), vh: innerHeight, w: Math.round(b.width), mw: m.clientWidth }; }''')
    R.check(f'{tag}: Continue is full width and on the screen without scrolling', vis['top'] >= 0 and vis['bottom'] <= vis['vh'] and vis['w'] >= vis['mw'] - 48, str(vis))
    R.check(f'{tag}: focus starts inside the pop-up', t.evaluate(f'!!document.activeElement.closest("{w}")'))
    plate_checks(t, tag, f'{w} .px-plate-fig')


CARD = '[data-chimera-card]'


def card_checks(t, tag):
    """The one-tap card of a later open (v1.2, gap C2): under the header, the fixed line, Join in a
    new tab, not a modal, nothing trapped."""
    R.check(f'{tag}: a later open shows the one-tap card, not the full pop-up',
            t.locator(CARD).count() == 1 and t.locator('.px-modal[data-welcome]').count() == 0 and modals(t) == 0)
    if t.locator(CARD).count() != 1:
        return
    txt = t.locator(f'{CARD} .px-chimera-card-text').inner_text()
    R.check(f'{tag}: the card says who built Parallax', txt == 'Parallax was built by the Chimera community on Discord.', txt)
    a = t.locator(f'{CARD} a[data-chimera="card"]').evaluate('a => ({ href: a.getAttribute("href"), target: a.target, rel: a.rel })')
    R.check(f'{tag}: the card\'s Join opens the full address in a new tab', a['href'] == DISCORD and a['target'] == '_blank' and 'noopener' in a['rel'], str(a))
    geo = t.evaluate("""() => { const c = document.querySelector('[data-chimera-card]').getBoundingClientRect(), hd = document.querySelector('.px-header').getBoundingClientRect();
      return { top: Math.round(c.top), bottom: Math.round(c.bottom), header: Math.round(hd.bottom), vh: innerHeight, sw: document.documentElement.scrollWidth, w: innerWidth }; }""")
    R.check(f'{tag}: the card sits under the header, on screen', geo['header'] - 1 <= geo['top'] and geo['bottom'] <= geo['vh'], str(geo))
    R.check(f'{tag}: the card adds no horizontal scroll', geo['sw'] <= geo['w'], str(geo))
    R.check(f'{tag}: focus is not taken by the card', not t.evaluate('!!document.activeElement.closest("[data-chimera-card]")'))


# The specimen plate claims B is A turned 90° about a vertical axis; this community will check.
# Measured on the drawn SVG: B's cubes are A's turned +90° about the axis (same z, same distance,
# a right angle, the same sense for every cube off the axis), the dotted lines stand on the axis
# in both drawings, and every cube keeps at least one whole face visible in both drawings
# (each group's faces painted in DOM order, one colour per cube, pixels counted).
PLATE_JS = r'''(sel) => {
  const svg = document.querySelector(sel);
  if (!svg) return { error: 'no plate' };
  const F = PX.ui.figures, ax = F.AXIS, groups = [...svg.querySelectorAll('g[data-cells]')];
  if (groups.length !== 2) return { error: 'groups ' + groups.length };
  const A = JSON.parse(groups[0].dataset.cells), B = JSON.parse(groups[1].dataset.cells);
  let turned = A.length === B.length && A.length >= 8, sense = 0;
  A.forEach((c, i) => {
    const b = B[i], p = [c[0] + 0.5 - ax[0], c[1] + 0.5 - ax[1]], q = [b[0] + 0.5 - ax[0], b[1] + 0.5 - ax[1]];
    const dot = p[0] * q[0] + p[1] * q[1], cross = p[0] * q[1] - p[1] * q[0], r2 = p[0] * p[0] + p[1] * p[1];
    if (b[2] !== c[2] || Math.abs(dot) > 1e-9 || Math.abs(q[0] * q[0] + q[1] * q[1] - r2) > 1e-9) turned = false;
    if (r2 > 1e-9) { const s = Math.sign(cross); if (Math.abs(cross - s * r2) > 1e-9 || (sense && s !== sense)) turned = false; sense = s; }
  });
  const C30 = Math.cos(Math.PI / 6), axes = [];
  // where the axis lands in each drawing: the group's transform applied to the projected foot
  groups.forEach((g, gi) => {
    const m = g.transform.baseVal.consolidate().matrix, cells = gi ? B : A, u = 20;
    const proj = (x, y, z) => [(x - y) * u * C30, (x + y) * u * 0.5 - z * u];
    let x0 = Infinity, y0 = Infinity;
    g.querySelectorAll('path').forEach((p) => p.getAttribute('d').match(/-?\d+(\.\d+)?/g).map(Number).forEach((v, k, arr) => { if (k % 2 === 0) { x0 = Math.min(x0, v); y0 = Math.min(y0, arr[k + 1]); } }));
    let mx = Infinity, my = Infinity;
    cells.forEach((c) => { for (const d of [[0,0,0],[1,0,0],[0,1,0],[1,1,0],[0,0,1],[1,0,1],[0,1,1],[1,1,1]]) { const pp = proj(c[0] + d[0], c[1] + d[1], c[2] + d[2]); mx = Math.min(mx, pp[0]); my = Math.min(my, pp[1]); } });
    const foot = proj(ax[0], ax[1], 0);
    axes.push(m.a * (foot[0] - mx + x0) + m.e);
  });
  const line = svg.querySelector('.px-plate-axis').getAttribute('d').match(/M(-?[\d.]+) /g).map((s) => parseFloat(s.slice(1)));
  // visibility: paint each drawing's faces in DOM order, one colour per cube
  const vb = svg.viewBox.baseVal, S = 4, cv = document.createElement('canvas');
  cv.width = vb.width * S; cv.height = vb.height * S;
  const ctx = cv.getContext('2d', { willReadFrequently: true });
  const minFace = [];
  groups.forEach((g, gi) => {
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, cv.width, cv.height);
    const m = g.transform.baseVal.consolidate().matrix;
    ctx.setTransform(S * m.a, S * m.b, S * m.c, S * m.d, S * m.e, S * m.f);
    const faceArea = {}, n = JSON.parse(g.dataset.cells).length;
    g.querySelectorAll('path[data-cube]').forEach((p) => {
      const i = +p.dataset.cube, nums = p.getAttribute('d').match(/-?\d+(\.\d+)?/g).map(Number);
      let a = 0;
      for (let k = 0; k < nums.length; k += 2) { const j = (k + 2) % nums.length; a += nums[k] * nums[j + 1] - nums[j] * nums[k + 1]; }
      faceArea[i] = Math.max(faceArea[i] || 0, Math.abs(a) / 2 * S * S * m.a * m.d);
      ctx.fillStyle = 'rgb(' + (i + 1) * 20 + ',0,0)';
      ctx.fill(new Path2D(p.getAttribute('d')));
    });
    const px = ctx.getImageData(0, 0, cv.width, cv.height).data, cnt = new Array(n).fill(0);
    for (let k = 0; k < px.length; k += 4) if (px[k + 3] === 255 && px[k] % 20 === 0 && px[k] > 0) cnt[px[k] / 20 - 1]++;
    minFace.push(Math.min(...cnt.map((c, i) => c / (faceArea[i] || 1))));
  });
  return { turned, axes, line, minFace };
}'''


def plate_checks(t, tag, sel):
    r = t.evaluate(PLATE_JS, sel)
    R.check(f'{tag}: plate B is A turned 90° about the drawn vertical axis', not r.get('error') and r['turned'], str(r))
    if r.get('error'):
        return
    R.check(f'{tag}: plate axis lines stand on the axis in both drawings', all(abs(a - l) < 0.6 for a, l in zip(r['axes'], r['line'])), str(r))
    R.check(f'{tag}: every plate cube shows a whole face in both drawings', min(r['minFace']) >= 0.9, str(r['minFace']))


def trap_check(page, t, tag):
    inside = []
    for key in ['Tab'] * 9 + ['Shift+Tab'] * 5:
        page.keyboard.press(key)
        inside.append(t.evaluate('!!document.activeElement.closest(".px-modal")'))
    R.check(f'{tag}: focus trapped in the pop-up (Tab and Shift+Tab)', all(inside), str(inside))


def copy_check(page, t, tag, reader):
    t.click('.px-modal[data-welcome] .px-linkcopy-btn')
    t.wait_for_function('(document.querySelector(".px-modal[data-welcome] .px-linkcopy-status") || {}).textContent.indexOf("Copied") === 0', timeout=4000)
    R.check(f'{tag}: Copy says copied', True)
    clip = reader()
    R.check(f'{tag}: clipboard holds the address', clip == DISCORD, repr(clip))


def offer_flow(page, t, tag, close_key=True):
    if close_key:
        page.keyboard.press('Escape')
    else:
        t.click('.px-modal[data-welcome] .px-modal-close')
    page.wait_for_timeout(150)
    R.check(f'{tag}: {"Esc" if close_key else "✕"} closes the pop-up', t.locator('.px-modal[data-welcome]').count() == 0)
    has_offer = t.locator('.px-modal.px-offer').count() == 1
    R.check(f'{tag}: first-run tour offer appears', has_offer)
    if has_offer:
        go_txt = t.locator('.px-offer-go').inner_text().strip()
        R.check(f'{tag}: offer buttons', re.match(r'Watch, Try, Go \(\d+ min\)', go_txt) is not None and t.locator('.px-offer-skip').inner_text().strip() == 'Skip', go_txt)
        t.click('.px-offer-skip')
        page.wait_for_timeout(100)
    R.check(f'{tag}: no dialog left, focus back in the page', modals(t) == 0 and t.evaluate('!!document.activeElement.closest("main")'),
            t.evaluate('document.activeElement && document.activeElement.outerHTML.slice(0, 80)'))


def nav_checks(t, tag, scope, mark_check=None):
    for r in ROUTES:
        sel = f'{scope} [data-nav="{r}"]'
        if t.locator(sel).count() == 0 or not t.locator(sel).first.is_visible():
            continue
        t.click(sel)
        cur = t.evaluate('PX.core.router.current().name')
        h1 = t.locator('main h1').first.inner_text()
        ok = cur == r and bool(h1) and (mark_check() if mark_check else True)
        R.check(f'{tag}: {scope} → {r}', ok, f'{cur} / {h1}')


def more_checks(page, t, tag, opener, mark_check=None):
    for r in ['lab', 'settings', 'about']:
        t.click(opener)
        page.wait_for_timeout(120)
        sheet = t.locator('.px-modal.px-more')
        ok_sheet = sheet.count() == 1 and sheet.locator('.px-linkcopy-url').input_value() == DISCORD
        t.click(f'.px-more [data-more-go="{r}"]')
        page.wait_for_timeout(120)
        cur = t.evaluate('PX.core.router.current().name')
        R.check(f'{tag}: More → {r}', ok_sheet and cur == r and modals(t) == 0 and (mark_check() if mark_check else True), f'{cur} sheet={ok_sheet}')


def settings_checks(t, tag):
    go(t, 'settings')
    t.click('[data-setting="theme"] label:has-text("Dark")')
    R.check(f'{tag}: theme Dark', t.evaluate('document.documentElement.getAttribute("data-theme")') == 'dark'
            and t.evaluate('getComputedStyle(document.body).backgroundColor') == 'rgb(27, 31, 35)')
    t.click('[data-setting="theme"] label:has-text("Light")')
    R.check(f'{tag}: theme Light', t.evaluate('getComputedStyle(document.body).backgroundColor') == 'rgb(242, 244, 243)')
    t.click('[data-setting="theme"] label:has-text("Auto")')
    R.check(f'{tag}: theme Auto removes the attribute', t.evaluate('document.documentElement.hasAttribute("data-theme")') is False
            and t.evaluate('PX.core.store.state.settings.theme') == 'auto')
    t.click('[data-setting="textScale"] label:has-text("130%")')
    fs = t.evaluate('getComputedStyle(document.documentElement).fontSize')
    R.check(f'{tag}: text size 130%', fs == '20.8px' and t.evaluate('PX.core.store.state.settings.textScale') == 1.3, fs)
    t.click('[data-setting="textScale"] label:has-text("100%")')
    R.check(f'{tag}: text size back to 100%', t.evaluate('getComputedStyle(document.documentElement).fontSize') == '16px')
    # v1.2: what exports carry (the nickname is the only name; device details off by default)
    R.check(f'{tag}: device details in exports are off by default', t.evaluate('PX.core.store.state.settings.exportDevice') is False
            and t.locator('[data-setting="exportDevice"] input').is_checked() is False)
    t.fill('[data-setting-input="nickname"]', '  Kestrel  ')
    t.press('[data-setting-input="nickname"]', 'Enter')
    R.check(f'{tag}: the nickname is saved, trimmed', t.evaluate('PX.core.store.state.settings.nickname') == 'Kestrel')
    R.check(f'{tag}: share texts carry the nickname and the full link', t.evaluate('PX.ui.share.text({ title: "T" })').endswith('Played by Kestrel\nBuilt by the Chimera community on Discord: https://discord.gg/chmr'))
    t.fill('[data-setting-input="nickname"]', '')
    t.press('[data-setting-input="nickname"]', 'Enter')
    R.check(f'{tag}: the nickname can be cleared', t.evaluate('PX.core.store.state.settings.nickname') == '')


def roundtrip_checks(page, t, tag, sandboxed):
    go(t, 'settings')
    t.click('[data-setting="weeklyGoal"] label:has-text("5")')
    R.check(f'{tag}: weekly goal set to 5', t.evaluate('PX.core.store.state.settings.weeklyGoal') == 5)
    t.click('[data-action="backup"]')
    first = t.evaluate('document.activeElement.hasAttribute("data-download") || document.activeElement.hasAttribute("data-copy")')
    R.check(f'{tag}: backup dialog starts on its action, not on the text', first)
    inv = t.locator('.px-export [data-invite="backup"]')
    R.check(f'{tag}: the backup dialog invites the player in (gap C10)', inv.count() == 1
            and inv.locator('a[data-chimera="invite"]').get_attribute('href') == DISCORD
            and inv.locator('[data-invite-copy]').count() == 1)
    box = t.locator('.px-export textarea')
    text = box.input_value()
    rec = json.loads(text)
    R.check(f'{tag}: backup holds the record', rec.get('v') == t.evaluate('PX.core.store.state.v') and rec['settings']['weeklyGoal'] == 5, str(rec.get('v')))
    R.check(f'{tag}: download offered only where allowed',
            (t.locator('.px-export [data-download]').count() == 0) == sandboxed and
            (t.locator('.px-export .px-notice--warn').count() == 1) == sandboxed)
    t.click('.px-export [data-copy]')
    t.wait_for_function('document.querySelector(".px-export .px-copybox-status").textContent === "Copied."', timeout=4000)
    R.check(f'{tag}: copying the backup sets Last backup', t.evaluate('PX.core.store.state.settings.lastBackup') > 0)
    t.click('.px-export .px-modal-actions button')
    t.click('[data-setting="weeklyGoal"] label:has-text("2")')
    t.fill('[data-action="import-text"]', 'not json at all')
    t.click('[data-action="import-paste"]')
    err = t.locator('.px-import-msg.is-error').inner_text()
    R.check(f'{tag}: bad import is refused', 'not valid JSON' in err and t.evaluate('PX.core.store.state.settings.weeklyGoal') == 2, err)
    t.fill('[data-action="import-text"]', text)
    t.click('[data-action="import-paste"]')
    page.wait_for_timeout(100)
    R.check(f'{tag}: import restores the backup', t.evaluate('PX.core.store.state.settings.weeklyGoal') == 5
            and t.locator('[data-setting="weeklyGoal"] input:checked').get_attribute('value') == '5')
    R.check(f'{tag}: import toast with Undo', 'Progress imported.' in t.locator('.px-toast').last.inner_text())
    t.click('[data-action="undo"]')
    page.wait_for_timeout(100)
    R.check(f'{tag}: undo brings back the state before the import', t.evaluate('PX.core.store.state.settings.weeklyGoal') == 2
            and t.evaluate('PX.core.store.canUndo()') is False)


def run_file(b):
    tag = 'file 1366'
    ctx = b.new_context(viewport={'width': 1366, 'height': 768}, permissions=['clipboard-read', 'clipboard-write'])
    page = ctx.new_page()
    logs = attach_console(page)
    page.goto(INDEX.as_uri())
    ready(page)
    fonts = page.evaluate('[...document.fonts].filter(f => f.status === "loaded").map(f => f.family.replace(/"/g, "") + " " + f.weight).sort()')
    R.check(f'{tag}: Plex fonts load from fonts/', {'IBM Plex Sans 400', 'IBM Plex Sans 600', 'IBM Plex Mono 400', 'IBM Plex Mono 500'} <= set(fonts), str(fonts))
    welcome_checks(page, tag)
    trap_check(page, page, tag)
    copy_check(page, page, tag, lambda: page.evaluate('navigator.clipboard.readText()'))
    offer_flow(page, page, tag)
    page.keyboard.press('Tab')
    R.check(f'{tag}: keyboard focus is visible', page.evaluate('(() => { const s = getComputedStyle(document.activeElement); return s.outlineStyle === "solid" && parseFloat(s.outlineWidth) >= 2; })()'),
            page.evaluate('document.activeElement.outerHTML.slice(0, 60)'))
    page.reload()
    ready(page)
    card_checks(page, tag)
    page.click(f'{CARD} [data-chimera-card-close]')
    page.wait_for_timeout(100)
    R.check(f'{tag}: one tap on ✕ ends the card', page.locator(CARD).count() == 0)
    page.reload()
    ready(page)
    page.keyboard.press('Escape')
    page.wait_for_timeout(150)
    R.check(f'{tag}: Esc ends the card', page.locator(CARD).count() == 0)
    R.check(f'{tag}: tour offer only on the first run', modals(page) == 0 and page.locator('.px-offer').count() == 0)
    page.reload()
    ready(page)
    page.evaluate('void PX.core.router.go("play", { mode: "train" })')
    page.wait_for_timeout(400)
    R.check(f'{tag}: a session ends the card', page.locator(CARD).count() == 0)
    go(page, 'home')
    page.wait_for_timeout(200)
    R.check(f'{tag}: the card does not come back on this open', page.locator(CARD).count() == 0)
    url0 = page.url.split('#')[0]
    nav_checks(page, tag, '.px-header')
    R.check(f'{tag}: navigation never leaves the page', page.url.split('#')[0] == url0, page.url)
    settings_checks(page, tag)
    roundtrip_checks(page, page, tag, sandboxed=False)
    page.click('[data-action="backup"]')
    with page.expect_download() as info:
        page.click('.px-export [data-download]')
    name = info.value.suggested_filename
    R.check(f'{tag}: backup downloads as a file', re.fullmatch(r'parallax-backup-\d{4}-\d{2}-\d{2}\.json', name) is not None, name)
    page.keyboard.press('Escape')
    R.check(f'{tag}: storage works, no banner', page.locator('.px-banner').count() == 0)
    R.check(f'{tag}: no console errors', not problems(logs), str(problems(logs)))
    ctx.close()

    # mid width: main four in the header, the rest in More
    ctx = b.new_context(viewport={'width': 860, 'height': 900})
    page = ctx.new_page()
    logs = attach_console(page)
    page.goto(INDEX.as_uri()); ready(page)
    page.keyboard.press('Escape'); page.keyboard.press('Escape')
    nav_checks(page, 'file 860', '.px-header')
    more_checks(page, page, 'file 860', '.px-header [data-more]')
    R.check('file 860: no console errors', not problems(logs), str(problems(logs)))
    ctx.close()


def run_phone(b):
    tag = 'file 412'
    ctx = b.new_context(viewport={'width': 412, 'height': 880}, device_scale_factor=2, is_mobile=True, has_touch=True, reduced_motion='reduce')
    page = ctx.new_page()
    logs = attach_console(page)
    page.goto(INDEX.as_uri()); ready(page)
    dur = page.evaluate('parseFloat(getComputedStyle(document.querySelector(".px-modal")).animationDuration)')
    R.check(f'{tag}: reduced motion shortens the pop-up animation', dur < 0.001, str(dur))
    welcome_checks(page, tag)
    offer_flow(page, page, tag, close_key=False)
    nav_checks(page, tag, '.px-tabbar')
    more_checks(page, page, tag, '.px-tabbar [data-more]')
    R.check(f'{tag}: no console errors', not problems(logs), str(problems(logs)))
    ctx.close()

    tag = 'file 360'
    ctx = b.new_context(viewport={'width': 360, 'height': 640})
    page = ctx.new_page()
    logs = attach_console(page)
    page.goto(INDEX.as_uri()); ready(page)
    welcome_checks(page, tag)
    small = page.evaluate(TARGETS_JS)
    R.check(f'{tag}: pop-up targets ≥ 44 px', not small, str(small[:6]))
    page.keyboard.press('Escape'); page.keyboard.press('Escape')
    for r in ROUTES:
        go(page, r)
        page.wait_for_timeout(60)
        sw = page.evaluate('document.documentElement.scrollWidth')
        small = page.evaluate(TARGETS_JS)
        R.check(f'{tag}: {r} has no horizontal scroll', sw <= 360, str(sw))
        R.check(f'{tag}: {r} targets ≥ 44 px', not small, str(small[:6]))
    R.check(f'{tag}: no console errors', not problems(logs), str(problems(logs)))
    ctx.close()


def run_later(b):
    """v1.2 (gap C2): a later open at 360 × 640 shows the one-tap card, which fits and keeps every
    target ≥ 44 px; the tour's end screen carries the tutorial invite (gap C6)."""
    tag = 'later 360'
    ctx = b.new_context(viewport={'width': 360, 'height': 640}, device_scale_factor=2, is_mobile=True, has_touch=True)
    page = ctx.new_page()
    logs = attach_console(page)
    page.goto(INDEX.as_uri()); ready(page)
    page.keyboard.press('Escape'); page.wait_for_timeout(150); page.keyboard.press('Escape'); page.wait_for_timeout(150)
    R.check(f'{tag}: closing the full welcome stamps the record', page.evaluate('PX.core.store.state.ui.welcomed > 0'))
    page.evaluate('PX.core.store.flush()')
    page.reload(); ready(page)
    card_checks(page, tag)
    small = page.evaluate(TARGETS_JS)
    R.check(f'{tag}: card targets ≥ 44 px', not small, str(small[:6]))
    R.check(f'{tag}: Today\'s Start is still on the first screen', page.evaluate("(() => { const r = document.querySelector('[data-primary]').getBoundingClientRect(); return r.bottom <= innerHeight - 56 && r.top >= 0; })()"))
    box = page.locator(f'{CARD} [data-chimera-card-close]').bounding_box()
    page.touchscreen.tap(box['x'] + box['width'] / 2, box['y'] + box['height'] / 2)
    page.wait_for_timeout(150)
    R.check(f'{tag}: one tap ends it', page.locator(CARD).count() == 0 and modals(page) == 0)
    R.check(f'{tag}: playtest mode stays off under browser automation', page.evaluate('PX.ui.playtest.on()') is False and page.locator('[data-playtest="fab"]').count() == 0)
    R.check(f'{tag}: no console errors', not problems(logs), str(problems(logs)))
    ctx.close()

    tag = 'tour end'
    ctx = b.new_context(viewport={'width': 1366, 'height': 768})
    page = ctx.new_page()
    logs = attach_console(page)
    page.goto(INDEX.as_uri()); ready(page)
    page.keyboard.press('Escape'); page.wait_for_timeout(200)
    page.click('.px-offer-go'); page.wait_for_timeout(600)
    page.locator('[data-wtg-skip]').first.click()  # the first-run tutorial is one exercise: Skip the tutorial ends it
    page.wait_for_selector('[data-invite="tutorial"]', timeout=8000)
    inv = page.locator('[data-invite="tutorial"]')
    R.check(f'{tag}: the tour ends with the Chimera invite', inv.count() == 1
            and inv.locator('.px-invite-text').inner_text() == 'Parallax was built by the Chimera community on Discord. Come and say hi.')
    a = inv.locator('a[data-chimera="invite"]').evaluate('a => ({ href: a.getAttribute("href"), target: a.target, rel: a.rel })')
    R.check(f'{tag}: its link opens the full address in a new tab', a['href'] == DISCORD and a['target'] == '_blank' and 'noopener' in a['rel'], str(a))
    R.check(f'{tag}: one invite on the screen', page.locator('[data-invite]').count() == 1)
    R.check(f'{tag}: no console errors', not problems(logs), str(problems(logs)))
    ctx.close()


IPHONE_UA = ('Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) '
             'Version/18.1 Mobile/15E148 Safari/604.1')
EDGE_JS = '''(ins) => {
  // elements of the header, the page and the tab bar that reach into the left or right inset
  const W = innerWidth, out = [];
  // (the brand's hover plate reaches 6 px left of its mark by design: its mark is what must clear the inset)
  for (const el of document.querySelectorAll('.px-brand .px-mark, .px-discord, .px-tab, .px-main h1, .px-panel, .px-main .px-btn')) {
    const r = el.getBoundingClientRect(), s = getComputedStyle(el);
    if (!r.width || r.bottom < 0 || r.top > innerHeight || s.display === 'none' || s.visibility === 'hidden' || el.closest('[hidden]')) continue;
    if (r.left < ins - 0.5 || r.right > W - ins + 0.5) out.push(String(el.className.baseVal !== undefined ? el.className.baseVal : el.className).split(' ')[0] + ' "' + (el.textContent || '').trim().slice(0, 20) + '" ' + Math.round(r.left) + '..' + Math.round(r.right));
  }
  return out.slice(0, 8);
}'''


def run_phones_b2(b):
    """v1.1 phones (PLAN M2, B2): 150 % text, safe areas, touch CSS, the storage hint, the
    welcome held sideways, and the web manifest on https only."""
    for w, hgt in ((360, 640), (390, 844)):
        tag = f'phone {w} at 150 %'
        ctx = b.new_context(viewport={'width': w, 'height': hgt}, device_scale_factor=2, is_mobile=True, has_touch=True)
        page = ctx.new_page()
        logs = attach_console(page)
        page.goto(INDEX.as_uri()); ready(page)
        page.keyboard.press('Escape'); page.keyboard.press('Escape')
        page.evaluate('PX.core.store.state.settings.textScale = 1.5; PX.ui.app.applySettings()')
        for r in ROUTES:
            go(page, r)
            page.wait_for_timeout(80)
            sw = page.evaluate('document.documentElement.scrollWidth')
            R.check(f'{tag}: {r} has no horizontal scroll', sw <= w, str(sw))
        page.evaluate('PX.ui.app.showWelcome()'); page.wait_for_timeout(200)
        R.check(f'{tag}: the welcome pop-up has no horizontal scroll', page.evaluate('document.documentElement.scrollWidth') <= w)
        if w == 360:
            R.check(f'{tag}: html touch-action is manipulation', page.evaluate("getComputedStyle(document.documentElement).touchAction") == 'manipulation')
        R.check(f'{tag}: no console errors', not problems(logs), str(problems(logs)))
        ctx.close()

    # RV-play-nav-knots: on a first run the tour offer opens as the welcome closes; a tap on the tab
    # bar then closes the offer through its backdrop, and it must still reach the tab it was aimed at.
    tag = 'phone 390, first run'
    ctx = b.new_context(viewport={'width': 390, 'height': 844}, device_scale_factor=2, is_mobile=True, has_touch=True)
    page = ctx.new_page()
    logs = attach_console(page)
    page.goto(INDEX.as_uri()); ready(page)
    page.wait_for_timeout(300)
    box = page.locator('.px-modal-close').first.bounding_box()
    page.touchscreen.tap(box['x'] + box['width'] / 2, box['y'] + box['height'] / 2)
    page.wait_for_timeout(400)
    offer = page.evaluate("[...document.querySelectorAll('.px-modal-title')].map(t => t.textContent).join(' | ')")
    tab = page.locator('.px-tabbar [data-nav="library"]').bounding_box()
    page.touchscreen.tap(tab['x'] + tab['width'] / 2, tab['y'] + tab['height'] / 2)
    page.wait_for_timeout(500)
    st = page.evaluate("({ route: PX.core.router.current().route, modals: PX.ui.modalOpen() })")
    R.check(f'{tag}: after the welcome (x) and the tour offer ({offer}), one tap on Library closes the offer and opens the Library',
            st['route'] == 'library' and st['modals'] == 0, str(st))
    R.check(f'{tag}: no console errors', not problems(logs), str(problems(logs)))
    ctx.close()

    # Held sideways with a notch (47 px insets): nothing of the header, page or tab bar under it.
    tag = 'phone 844 x 390, notch'
    ctx = b.new_context(viewport={'width': 844, 'height': 390}, device_scale_factor=2, is_mobile=True, has_touch=True)
    page = ctx.new_page()
    cdp = ctx.new_cdp_session(page)
    try:
        cdp.send('Emulation.setSafeAreaInsetsOverride', {'insets': {'top': 0, 'left': 47, 'right': 47, 'bottom': 21}})
        overridden = True
    except Exception:
        overridden = False
    logs = attach_console(page)
    page.goto(INDEX.as_uri()); ready(page)
    top = page.evaluate('''() => { const t = document.querySelector('.px-welcome-title'); const r = t.getBoundingClientRect(); return [Math.round(r.top), Math.round(r.bottom)]; }''')
    R.check(f'{tag}: the welcome opens at its first line (built by the Chimera community)', top[0] >= 0 and top[1] <= 390, str(top))
    cont = page.evaluate('''() => { const b = document.querySelector('.px-modal[data-welcome] [data-welcome="start"]').getBoundingClientRect(); return [Math.round(b.top), Math.round(b.bottom)]; }''')
    R.check(f'{tag}: Continue stays on the screen held sideways', cont[0] >= 0 and cont[1] <= 390, str(cont))
    page.keyboard.press('Escape'); page.keyboard.press('Escape')
    if overridden:
        for r in ('home', 'library', 'settings'):
            go(page, r)
            page.wait_for_timeout(80)
            edge = page.evaluate(EDGE_JS, 47)
            R.check(f'{tag}: {r} keeps clear of the left and right insets', not edge, str(edge))
    R.check(f'{tag}: no console errors', not problems(logs), str(problems(logs)))
    ctx.close()

    # The storage hint: on an iPhone (Safari, not from the home screen), not on a desktop browser.
    ctx = b.new_context(viewport={'width': 390, 'height': 844}, device_scale_factor=2, is_mobile=True, has_touch=True, user_agent=IPHONE_UA)
    page = ctx.new_page()
    page.goto(INDEX.as_uri()); ready(page)
    hint = page.locator('[data-welcome="storage"]')
    R.check('iPhone: the welcome shows the storage hint', hint.count() == 1 and hint.first.is_visible())
    R.check('iPhone: the hint names the seven-day rule and the home screen', 'seven days' in (hint.first.inner_text() if hint.count() else '') and 'home screen' in (hint.first.inner_text() if hint.count() else ''))
    ctx.close()
    # Web Share where it exists (stubbed here: headless Chromium on Linux has none): Share… sends
    # the PNG and the text with the Chimera line; Download PNG and Copy stay.
    ctx = b.new_context(viewport={'width': 390, 'height': 844}, device_scale_factor=2, is_mobile=True, has_touch=True)
    ctx.add_init_script('navigator.canShare = () => true; navigator.share = (d) => { window.__shared = { n: (d.files || []).length, type: d.files && d.files[0] && d.files[0].type, name: d.files && d.files[0] && d.files[0].name, text: d.text || "" }; return Promise.resolve(); };')
    page = ctx.new_page()
    logs = attach_console(page)
    page.goto(INDEX.as_uri()); ready(page)
    page.keyboard.press('Escape'); page.keyboard.press('Escape')
    page.evaluate("void PX.ui.share.open({ title: 'Test card', lines: ['one line'], kind: 'session' })")
    page.wait_for_function('document.querySelector(".px-share-fig[data-ready]")', timeout=10000)
    page.wait_for_timeout(300)
    sheet = page.locator('[data-share-sheet]')
    R.check('Web Share: the sheet offers Share… first, and still Download PNG and Copy',
            sheet.locator('[data-share="native"]').count() == 1 and sheet.locator('[data-share="download"]').count() == 1 and sheet.locator('[data-share="copy"]').count() == 1)
    sheet.locator('[data-share="native"]').click()
    page.wait_for_timeout(300)
    shared = page.evaluate('window.__shared || null')
    R.check('Web Share: Share… sends the PNG and the text with the Chimera link', bool(shared) and shared['n'] == 1 and shared['type'] == 'image/png'
            and 'discord.gg/chmr' in shared['text'], str(shared))
    page.keyboard.press('Escape')
    # How to play carries B7's "Also in tests" note when the exercise has one, and no key line on touch.
    has_overlap = page.evaluate('!!(PX.ui.overlap && PX.ui.overlap.noteFor && PX.ui.overlap.noteFor("fold"))')
    page.evaluate('PX.core.keys.typed(false)')  # the Escapes above count as a keyboard (key hints show after a key press)
    page.evaluate('void PX.ui.play.howTo("fold")'); page.wait_for_timeout(200)
    howto = page.locator('.pl-howto')
    if has_overlap:
        R.check('How to play: shows the "Also in tests" note', 'Also in tests' in howto.inner_text())
    R.check('How to play: the key line is hidden on a touch screen', not page.locator('.pl-howto-keys').is_visible())
    R.check('Web Share and How to play: no console errors', not problems(logs), str(problems(logs)))
    ctx.close()

    ctx = b.new_context(viewport={'width': 1366, 'height': 768})
    page = ctx.new_page()
    page.goto(INDEX.as_uri()); ready(page)
    R.check('desktop: no storage hint in the welcome', page.locator('[data-welcome="storage"]').count() == 0)
    R.check('file://: no web manifest linked (Chrome would log a CORS error)', page.evaluate('!document.querySelector("link[rel=manifest]")'))
    ctx.close()

    # https (GitHub Pages), served from the repository: the manifest and the icons are linked and load.
    ctx = b.new_context(viewport={'width': 390, 'height': 844}, device_scale_factor=2, is_mobile=True, has_touch=True)
    loaded = {}

    def serve(route):
        rel = route.request.url.split('https://parallax.test/', 1)[1].split('?')[0].split('#')[0] or 'index.html'
        f = (ROOT / rel).resolve()
        if ROOT not in f.parents or not f.is_file():
            loaded[rel] = 404
            route.fulfill(status=404, body='not found')
            return
        ctype = {'.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.woff2': 'font/woff2', '.png': 'image/png',
                 '.svg': 'image/svg+xml', '.webmanifest': 'application/manifest+json'}.get(f.suffix, 'application/octet-stream')
        loaded[rel] = 200
        route.fulfill(status=200, body=f.read_bytes(), headers={'content-type': ctype})
    ctx.route('https://parallax.test/**', serve)
    page = ctx.new_page()
    logs = attach_console(page)
    page.goto('https://parallax.test/index.html'); ready(page)
    page.wait_for_timeout(800)
    href = page.evaluate('(document.querySelector("link[rel=manifest]") || {}).href || null')
    R.check('https: the web manifest is linked', href == 'https://parallax.test/manifest.webmanifest', str(href))
    man = page.evaluate('fetch("manifest.webmanifest").then(r => r.json()).catch(() => null)')
    R.check('https: the manifest names Parallax, standalone, start_url and icons 192 + 512 + maskable',
            bool(man) and man.get('short_name') == 'Parallax' and man.get('display') == 'standalone' and man.get('start_url') == './'
            and {'192x192', '512x512'} <= {i['sizes'] for i in man.get('icons', [])} and any(i.get('purpose') == 'maskable' for i in man.get('icons', [])), str(man)[:200])
    for icon in [i['src'] for i in (man or {}).get('icons', [])] + ['icons/apple-touch-icon.png']:
        ok = page.evaluate(f'fetch({json.dumps(icon)}).then(r => r.ok).catch(() => false)')
        R.check(f'https: {icon} loads', ok)
    R.check('https: the touch icon is linked', page.evaluate('!!document.querySelector("link[rel=apple-touch-icon]")'))
    R.check('https: no console errors', not problems(logs), str(problems(logs)))
    ctx.close()


def run_sandbox(b):
    host = write_host(inline_single(), OUT / 'host.html')
    probe = OUT / 'probe.html'
    probe.write_text('<!doctype html><title>probe</title>')
    for (w, hgt) in [(1366, 768), (412, 880)]:
        tag = f'srcdoc {w}'
        ctx = b.new_context(viewport={'width': w, 'height': hgt}, permissions=['clipboard-read', 'clipboard-write'])
        page = ctx.new_page()
        logs = attach_console(page)
        page.goto(host.as_uri())
        fr = child_frame(page)
        ready(fr)
        fr.evaluate('window.__bootMark = "boot-1"')
        def same_doc():
            f = page.main_frame.child_frames[0]
            return f.url.startswith('about:srcdoc') and f.evaluate('window.__bootMark') == 'boot-1'
        R.check(f'{tag}: storage blocked, the app runs from memory', fr.evaluate('PX.core.store.volatile') is True)
        R.check(f'{tag}: volatile-storage banner shows', fr.locator('.px-banner').count() == 1
                and "can't be saved" in fr.locator('.px-banner').inner_text())
        welcome_checks(fr, tag)
        fr.click('.px-welcome-title')  # gives the frame keyboard focus, like a person would
        if w == 1366:
            def read_clip():
                p2 = ctx.new_page(); p2.goto(probe.as_uri()); p2.bring_to_front()
                v = p2.evaluate('navigator.clipboard.readText()'); p2.close(); page.bring_to_front()
                return v
            copy_check(page, fr, tag, read_clip)
        offer_flow(page, fr, tag)
        allow = ()
        if w == 1366:
            nav_checks(fr, tag, '.px-header', same_doc)
            settings_checks(fr, tag)
            roundtrip_checks(page, fr, tag, sandboxed=True)
            page.keyboard.press('Escape')
            # The header link: the sandbox blocks the new tab, so the app offers the address.
            fr.click('.px-header a[data-chimera]')
            fr.wait_for_function('[...document.querySelectorAll(".px-toast")].some(t => t.textContent.indexOf("No new tab opened?") === 0)', timeout=4000)
            fr.locator('.px-toast', has_text='No new tab opened?').locator('.px-toast-action').click()
            fr.wait_for_function('[...document.querySelectorAll(".px-toast")].some(t => t.textContent.indexOf("Copied https://discord.gg/chmr") === 0)', timeout=4000)
            R.check(f'{tag}: blocked header link falls back to Copy', same_doc())
            allow = ('Blocked opening',)  # the browser's own note about the blocked tab
            # v1.2 playtest mode in a sandboxed preview: a note, then the report through the clipboard fallback
            fr.evaluate('PX.ui.playtest.set(true)')
            go(fr, 'settings')
            page.wait_for_timeout(200)
            R.check(f'{tag}: playtest mode shows its note button', fr.locator('[data-playtest="fab"]').is_visible())
            fr.click('[data-playtest="fab"]')
            fr.fill('.pt-note-text', 'A note from the sandboxed preview.')
            fr.click('[data-playtest-sheet] .px-modal-actions button:has-text("Save note")')
            page.wait_for_timeout(150)
            R.check(f'{tag}: the note is saved', fr.evaluate('PX.ui.playtest.counts().notes') == 1)
            fr.locator('[data-action="playtest-copy"]').scroll_into_view_if_needed()
            fr.click('[data-action="playtest-copy"]')
            page.wait_for_timeout(400)
            rep = read_clip()
            dialog = fr.locator('[data-playtest-report]').count()
            R.check(f'{tag}: the playtest report copies in a sandboxed preview', rep.startswith('PARALLAX PLAYTEST REPORT') and 'A note from the sandboxed preview.' in rep
                    and 'device: ua' in rep and 'framed yes (sandboxed)' in rep, (rep[:120] + f' | fallback dialog: {dialog}'))
            fr.evaluate('PX.ui.playtest.set(false)')
        else:
            nav_checks(fr, tag, '.px-tabbar', same_doc)
            more_checks(page, fr, tag, '.px-tabbar [data-more]', same_doc)
            fr.click('.px-footer [data-go="about"]')
            R.check(f'{tag}: footer About routes in place', fr.evaluate('PX.core.router.current().name') == 'about' and same_doc())
        R.check(f'{tag}: frame never navigated away', same_doc())
        R.check(f'{tag}: no console errors', not problems(logs, allow), str(problems(logs, allow)))
        ctx.close()


def run_shots(b):
    shots = []
    for (w, hgt) in [(1366, 768), (360, 640)]:
        for theme in ['light', 'dark']:
            ctx = b.new_context(viewport={'width': w, 'height': hgt}, color_scheme=theme)
            page = ctx.new_page()
            logs = attach_console(page)
            page.goto(INDEX.as_uri()); ready(page)
            page.wait_for_timeout(250)
            name = f'{w}x{hgt}_{theme}'
            page.screenshot(path=str(OUT / f'popup_{name}.png')); shots.append(f'popup_{name}.png')
            page.keyboard.press('Escape'); page.keyboard.press('Escape')
            page.evaluate('PX.core.store.flush()')
            page.reload(); ready(page)
            page.wait_for_timeout(300)
            page.screenshot(path=str(OUT / f'card_{name}.png')); shots.append(f'card_{name}.png')
            page.keyboard.press('Escape')
            page.evaluate('PX.ui.playtest.set(true)')
            page.add_style_tag(content=FULLPAGE_FIX)
            for r, label in [('home', 'today'), ('settings', 'settings'), ('about', 'about')]:
                go(page, r)
                page.wait_for_timeout(150)
                page.screenshot(path=str(OUT / f'{label}_{name}.png'), full_page=True)
                shots.append(f'{label}_{name}.png')
            page.evaluate('void PX.ui.playtest.showReport()')
            page.wait_for_timeout(200)
            page.screenshot(path=str(OUT / f'playtest_report_{name}.png')); shots.append(f'playtest_report_{name}.png')
            R.check(f'shots {name}: no console errors', not problems(logs), str(problems(logs)))
            ctx.close()
    return shots


def main():
    css, js = active_assets()
    missing = [p for p in css + js if not (ROOT / p).exists()]
    R.check('index.html: every active file exists', not missing, str(missing))
    ready_now = [p for p in pending_scripts() if (ROOT / p).exists()]
    with sync_playwright() as p:
        b = p.chromium.launch(headless=True)
        run_file(b)
        run_phone(b)
        run_phones_b2(b)
        run_later(b)
        run_sandbox(b)
        shots = run_shots(b)
        b.close()
    data = R.dump({'screenshots': shots, 'pending_scripts_that_exist': ready_now})
    print(f"\n{data['passed']} passed, {data['failed']} failed. Screenshots: {OUT}")
    if ready_now:
        print('Pending in index.html but present on disk (activate when stable):', ', '.join(ready_now))
    sys.exit(1 if data['failed'] else 0)


if __name__ == '__main__':
    main()
