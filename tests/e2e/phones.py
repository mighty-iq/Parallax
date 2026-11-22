"""Phones (PLAN milestone 9, W3-phones): one check per item, at 360 x 640, other phone sizes and desktop.

  dial      O41: the arrow circle's words (ahead, left, right) in Homing and Reckon are 12 px or more on the
            screen wherever they show, at every phone size and on desktop; the circle keeps them on short
            phones only where they fit (else the readout says the same)
  holes     O55: Hole Punch's panels: two rows of two on taller phones (3 panels too), and sideways the panels
            and option sheets fit beside each other (they were 0 px wide with one or two folds); show me's large
            sheet has a size on every phone; 110 px or more per panel except at 360 x 640 (v1.1's sizes)
  knots     O48: the Knots rope plate is 320 px or more upright and on phones 380 px tall or more held sideways
            (R2's floor), and takes the height under the status strip on shorter ones
  progress  O20: Progress on a phone shows one section at a time (with the panels placed after it); seven chips
            of 44 px pick it and stay on the screen; ?ex= opens Curves; desktop keeps the whole page
  taps      O22: Settings' Confirm taps (off by default): a first touch tap on a single-choice answer marks it, a
            second tap on it answers, another answer moves the mark; keys and a mouse answer at once
  dat       O54: Form's See solution letters the solid's faces without discs (the marks stay in view), 12.5 px
            or more, covering 12 % of a solid's box or less (three discs covered about 35 % at 360 x 640); O56: Painted Cubes' hidden cubes in See solution:
            9 dashed edges each (no far corner), every number 12 px or more; 360 x 640, 390 x 844, 1366 x 768
Run:  tests/e2e/pwslot.sh python3 tests/e2e/phones.py [dial ...]   (no names: every part)
Report: tests/e2e/out/phones.json; screenshots: tests/e2e/out/phones/.
"""
import json, pathlib, sys, time
sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
from playwright.sync_api import sync_playwright
from common import ROOT, OUT, launch, Checks

APP = (ROOT / 'index.html').resolve().as_uri()
READY = 'document.documentElement.getAttribute("data-px-ready") === "1"'
DIR = OUT / 'phones'
DIR.mkdir(parents=True, exist_ok=True)
C = Checks('phones')
REPORT = {}
PARTS = [a for a in sys.argv[1:] if not a.startswith('-')]


def want(part):
    return not PARTS or part in PARTS


def open_app(b, w, h, touch=True, dark=False):
    kw = dict(viewport={'width': w, 'height': h}, device_scale_factor=2)
    if touch:
        kw.update(is_mobile=True, has_touch=True)
    if dark:
        kw['color_scheme'] = 'dark'
    ctx = b.new_context(**kw)
    page = ctx.new_page()
    errs = []
    page.on('pageerror', lambda e: errs.append(str(e)[:300]))
    page.on('console', lambda m: errs.append('console: ' + m.text[:300]) if m.type == 'error' and 'GL Driver' not in m.text and 'GPU stall' not in m.text else None)
    page.goto(APP)
    page.wait_for_function(READY, timeout=30000)
    page.evaluate('document.fonts.ready.then(() => 1)')
    for _ in range(4):
        if not page.evaluate('PX.ui.modalOpen()'):
            break
        page.keyboard.press('Escape')
        page.wait_for_timeout(150)
    page.evaluate('''() => { const r = PX.core.store.state; r.tour = r.tour || { seen: {} }; r.tour.seen = r.tour.seen || {};
        PX.ex.list().forEach(d => { r.tour.seen[d.id] = true; }); r.ui = r.ui || {}; r.ui.seen = r.ui.seen || {};
        r.ui.seen.motionNotice = Date.now(); r.ui.seen.walkNotice = Date.now(); PX.ui.hooks && PX.ui.hooks.mute(true); }''')
    return ctx, page, errs


def state(page):
    return page.evaluate('window.__play ? __play.state : null')


def clear_cards(page):
    for sel in ('[data-card-box] [data-card="skip"]', '[data-card-box] .px-btn--primary', '.ex-track-notice:not([hidden]) .px-btn', '[data-notice-start]'):
        loc = page.locator(sel)
        if loc.count() and loc.first.is_visible():
            loc.first.click()
            page.wait_for_timeout(200)
            return True
    return False


def wait_respond(page, ms=60000):
    t0 = time.time()
    while time.time() - t0 < ms / 1000:
        s = state(page)
        if s == 'respond':
            return True
        if s in (None, 'idle', 'done', 'ready', 'present', 'reveal'):
            clear_cards(page)
        page.wait_for_timeout(120)
    return False


def free_item(page, ex, params=None, trials=3):
    page.evaluate('window.__play && void __play.end()')
    page.evaluate('PX.debug.fast(true)')
    q = {'mode': 'free', 'exId': ex, 'run': '1', 'trials': trials}
    if params:
        q['params'] = params
    page.evaluate(f'void PX.core.router.go("play", {json.dumps(q)}, {{ force: true }})')
    page.wait_for_timeout(150)
    return wait_respond(page)


# Every SVG text in a scope with its size on the screen (font size x the element's screen scale).
TEXT_PX = r'''(sel) => {
  const out = [];
  document.querySelectorAll(sel).forEach(t => {
    const s = getComputedStyle(t);
    if (s.display === 'none' || s.visibility === 'hidden') return;
    const r = t.getBoundingClientRect();
    if (r.width < 0.5 || r.height < 0.5) return;
    const m = t.getScreenCTM();
    const px = parseFloat(s.fontSize) * (m ? Math.sqrt(Math.abs(m.a * m.d - m.b * m.c)) : 1);
    out.push({ text: t.textContent.trim(), px: Math.round(px * 10) / 10, left: Math.round(r.left), right: Math.round(r.right), top: Math.round(r.top), bottom: Math.round(r.bottom) });
  });
  return out;
}'''

DIAL_BOX = r'''() => { const d = document.querySelector('.pl-trial .ex-fp-dialbox'); if (!d) return null; const r = d.getBoundingClientRect();
  const ro = document.querySelector('.pl-trial .ex-fp-readout'); return { w: Math.round(r.width), readout: ro ? ro.textContent.trim().slice(0, 60) : null, innerW: innerWidth }; }'''

DIAL_SIZES = [(360, 640), (360, 700), (360, 740), (375, 667), (375, 812), (390, 844), (412, 915), (430, 932), (844, 390), (740, 360), (1366, 768), (1024, 700)]


def part_dial(b):
    rows = []
    for ex in ('homing', 'reckon'):
        for (w, h) in DIAL_SIZES:
            touch = w < 1000
            ctx, page, errs = open_app(b, w, h, touch=touch)
            reached = free_item(page, ex)
            if not C.ok(reached, f'dial {ex} {w}x{h}: an item reached its answer state'):
                ctx.close()
                continue
            page.wait_for_timeout(300)
            words = page.evaluate(TEXT_PX, '.pl-trial .ex-fp-dial text')
            box = page.evaluate(DIAL_BOX)
            small = [x for x in words if x['px'] < 12]
            row = {'ex': ex, 'size': f'{w}x{h}', 'circle': box and box['w'], 'words': [(x['text'], x['px']) for x in words]}
            rows.append(row)
            print(f'  {ex} {w}x{h}: circle {box and box["w"]} px, words {row["words"]}', flush=True)
            C.ok(not small, f'dial {ex} {w}x{h}: the circle\'s words are 12 px or more ({small})')
            # the words stay on the screen, clear of the edges
            C.ok(all(x['left'] >= 0 and x['right'] <= w for x in words), f'dial {ex} {w}x{h}: the words lie on the screen ({words})')
            if (w, h) in ((360, 640), (390, 844), (844, 390), (1366, 768), (360, 740)):
                page.screenshot(path=str(DIR / f'dial_{ex}_{w}x{h}.png'))
            C.ok(not errs, f'dial {ex} {w}x{h}: no page errors ({errs[:2]})')
            ctx.close()
    REPORT['dial'] = rows


def show_me_steps(page, prefix, right=True, max_s=40, measure=None, shots=True):
    """Answers the item on screen, opens See solution (or Why?) at normal speed and follows it to its end:
    a screenshot of each caption (taps the next button where the walkthrough waits for one), and
    measure(page) at each caption when given. Returns the list of (caption, measure)."""
    page.evaluate('PX.ui.play.config.slowMs = 1')
    page.evaluate(f'__play.answer({str(right).lower()}).catch(() => 0)')
    t0 = time.time()
    while time.time() - t0 < 10 and state(page) not in ('reveal', 'showme'):
        page.wait_for_timeout(60)
    page.evaluate('PX.debug.fast(false)')
    page.wait_for_timeout(200)
    if state(page) == 'reveal':
        btn = page.locator('[data-showme]')
        if btn.count() and btn.first.is_visible():
            btn.first.click()
    out, seen, t0 = [], set(), time.time()
    cap_js = "(() => { const c = [...document.querySelectorAll('.pl-trial .ex-caption, .pl-showme .pl-caption, .pl-caption')].map(e => e.textContent.trim()).filter(Boolean); return c.join(' | ').slice(0, 160); })()"
    while time.time() - t0 < max_s:
        st = state(page)
        if st != 'showme' and time.time() - t0 > 2:
            break
        cap = page.evaluate(cap_js)
        if cap and cap not in seen:
            seen.add(cap)
            page.wait_for_timeout(400)
            k = len(out)
            if shots:
                page.screenshot(path=str(DIR / f'{prefix}_step{k}.png'))
            out.append((cap, measure(page) if measure else None))
        nxt = page.locator('[data-showme-next]')
        if nxt.count() and nxt.first.is_visible() and nxt.first.is_enabled():
            nxt.first.click()
        page.wait_for_timeout(250)
    return out


FORM_TAGS = r"""() => {
  const out = [];
  document.querySelectorAll('.pl-trial .fm-opt-svg').forEach((svg, i) => {
    const tags = [...svg.querySelectorAll('.fm-tag')];
    if (!tags.length) return;
    const R = svg.getBoundingClientRect();
    let area = 0, discs = 0, small = [];
    tags.forEach(g => {
      const r = g.getBoundingClientRect(); area += r.width * r.height;
      if (g.querySelector('circle')) discs++;
      const t = g.querySelector('text'), m = t.getScreenCTM(), px = parseFloat(getComputedStyle(t).fontSize) * Math.sqrt(Math.abs(m.a * m.d - m.b * m.c));
      if (px < 12.5) small.push(Math.round(px * 10) / 10);
    });
    out.push({ opt: i + 1, tags: tags.length, discs, cover: Math.round(1000 * area / (R.width * R.height)) / 10, small, box: Math.round(R.width) });
  });
  return out;
}"""

CUBE_MARKS = r"""() => {
  const badges = [...document.querySelectorAll('.pl-trial .ex-cubes-marks .ex-cubes-badge')];
  const hid = badges.filter(g => g.classList.contains('is-hidden'));
  const px = g => { const t = g.querySelector('.ex-cubes-badge-n'), m = t.getScreenCTM(); return parseFloat(getComputedStyle(t).fontSize) * Math.sqrt(Math.abs(m.a * m.d - m.b * m.c)); };
  const circ = g => { const c = [...g.querySelectorAll('circle')].pop(), r = c.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2, r: r.width / 2 }; };
  let overlaps = 0;
  const C = badges.map(circ);
  for (let i = 0; i < C.length; i++) for (let j = i + 1; j < C.length; j++) {
    const d = Math.hypot(C[i].x - C[j].x, C[i].y - C[j].y);
    if (d < 0.6 * (C[i].r + C[j].r)) overlaps++;
  }
  const ghosts = [...document.querySelectorAll('.pl-trial .ex-cubes-marks .ex-cubes-ghost')].map(p => (p.getAttribute('d').match(/M/g) || []).length);
  return { badges: badges.length, hidden: hid.length, minPx: badges.length ? Math.round(10 * Math.min(...badges.map(px))) / 10 : null,
    hiddenPx: hid.length ? Math.round(10 * Math.min(...hid.map(px))) / 10 : null, overlaps, ghosts };
}"""


def part_dat(b):
    """O54 (Form's letters on the solids) and O56 (Painted Cubes' hidden cubes) in See solution."""
    rows = {}
    for (w, h) in ((360, 640), (390, 844), (1366, 768)):
        touch = w < 1000
        # Form: See solution after a right answer; the letters on the solids
        ctx, page, errs = open_app(b, w, h, touch=touch)
        if C.ok(free_item(page, 'form', {'solid': 1, 'marks': 2, 'view': 0, 'foil': 0}), f'dat form {w}x{h}: an item'):
            steps = show_me_steps(page, f'form_{w}x{h}', measure=lambda pg: pg.evaluate(FORM_TAGS), shots=w != 390)
            tagged = [m for _, ms in steps for m in (ms or [])]
            rows[f'form {w}x{h}'] = tagged
            print(f'  form {w}x{h}: {tagged}', flush=True)
            C.ok(len(tagged) > 0, f'dat form {w}x{h}: See solution letters a solid')
            C.ok(all(m['discs'] == 0 for m in tagged), f'dat form {w}x{h}: the letters on the solids carry no disc ({tagged})')
            C.ok(all(not m['small'] for m in tagged), f'dat form {w}x{h}: the letters on the solids are 12.5 px or more ({tagged})')
            C.ok(all(m['cover'] <= 12 for m in tagged), f'dat form {w}x{h}: the letters cover 12 % of a solid\'s box or less ({tagged})')
        C.ok(not errs, f'dat form {w}x{h}: no page errors ({errs[:2]})')
        ctx.close()
        # Painted Cubes: an item with hidden cubes, See solution's "every cube's number" step
        ctx, page, errs = open_app(b, w, h, touch=touch)
        hidden_js = "(() => { const it = __play.item, L = PX.ex.get('cubes').lib; return L.render(it.heights).perCube.filter(p => p.any === 0).length; })()"
        got = False
        for t in range(12):
            if not free_item(page, 'cubes', {'cubes': 3, 'height': 3, 'asked': 0}):
                break
            if page.evaluate(hidden_js):
                got = True
                break
        if C.ok(got, f'dat cubes {w}x{h}: an item with hidden cubes'):
            steps = show_me_steps(page, f'cubes_{w}x{h}', measure=lambda pg: pg.evaluate(CUBE_MARKS), shots=w != 390)
            full = [m for _, m in steps if m and m['hidden']]
            rows[f'cubes {w}x{h}'] = full[:2]
            print(f'  cubes {w}x{h}: {full[:1]}', flush=True)
            C.ok(len(full) > 0, f'dat cubes {w}x{h}: a step shows the hidden cubes')
            C.ok(all(m['hiddenPx'] >= 12 and m['minPx'] >= 12 for m in full), f'dat cubes {w}x{h}: every number is 12 px or more ({full[:1]})')
            C.ok(all(all(n == 9 for n in m['ghosts']) for m in full), f'dat cubes {w}x{h}: each hidden cube is drawn with the 9 edges a solid cube shows ({full[:1]})')
        C.ok(not errs, f'dat cubes {w}x{h}: no page errors ({errs[:2]})')
        ctx.close()
    REPORT['dat'] = rows

PF_SIZES = r"""() => {
  const strip = document.querySelector('.pl-trial .ex-patfold-strip');
  const panels = [...document.querySelectorAll('.pl-trial .ex-patfold-strip .ex-patfold-svg')].map(e => Math.round(e.getBoundingClientRect().width));
  const opts = [...document.querySelectorAll('.pl-trial .ex-patfold-opt .ex-patfold-svg')].map(e => Math.round(e.getBoundingClientRect().width));
  const de = document.documentElement, H = innerHeight;
  const ctl = [...document.querySelectorAll('.pl-trial .pl-grid .px-choice')].map(e => e.getBoundingClientRect());
  const holes = [...document.querySelectorAll('.pl-trial .ex-patfold-strip .ex-patfold-hole')].map(e => e.getBoundingClientRect().width).filter(w => w > 0);
  return { n: strip ? +strip.getAttribute('data-n') : null, panels, opts, minHole: holes.length ? Math.round(10 * Math.min(...holes)) / 10 : null,
    scrollH: Math.max(de.scrollHeight, document.body.scrollHeight), scrolls: Math.max(de.scrollHeight, document.body.scrollHeight) > H + 1, lowest: Math.round(Math.max(0, ...ctl.map(r => r.bottom))), H };
}"""


def part_holes(b, sizes=((360, 640), (390, 844), (412, 915), (844, 390), (1366, 768))):
    """O55: Hole Punch's fold panels on phones."""
    rows = []
    for (w, h) in sizes:
        touch = w < 1000
        ctx, page, errs = open_app(b, w, h, touch=touch)
        for folds in (0, 1, 2):
            params = {'folds': folds, 'type': 0, 'idle': 0, 'sheets': 0}  # version 3's 'sheets' dim (W1-band-B, granted)
            if not C.ok(free_item(page, 'patfold', params), f'holes {w}x{h} folds {folds}: an item'):
                continue
            page.wait_for_timeout(300)
            m = page.evaluate(PF_SIZES)
            m.update(size=f'{w}x{h}', folds=folds)
            rows.append(m)
            print(f'  holes {w}x{h} folds {folds}: {m}', flush=True)
            if folds == 2 or (w, h) == (360, 640):
                page.screenshot(path=str(DIR / f'holes_{w}x{h}_f{folds}.png'))
            if touch:  # phones: the item screen never scrolls (fit.py's rule); desktop pages may
                C.ok(not m['scrolls'] and m['lowest'] <= h + 1, f'holes {w}x{h} folds {folds}: the item fits without a scroll ({m})')
            if (w, h) != (360, 640):  # 360 x 640 keeps v1.1's sizes (two rows of options leave no more room)
                C.ok(min(m['panels']) >= 110, f'holes {w}x{h} folds {folds}: each panel is 110 px or more ({m["panels"]})')
        if touch and free_item(page, 'patfold', {'folds': 1, 'type': 0, 'idle': 0, 'sheets': 0}):
            # show me's single large sheet has a size on every phone (it was 0 px wide sideways)
            big = show_me_steps(page, f'holes_{w}x{h}_showme', max_s=12, shots=(w, h) == (844, 390),
                                measure=lambda pg: pg.evaluate("(() => { const e = [...document.querySelectorAll('.pl-trial .ex-patfold-big .ex-patfold-svg')].find(x => x.getBoundingClientRect().height > 0); return e ? Math.round(e.getBoundingClientRect().width) : 0; })()"))
            widths = [m for _, m in big if m]
            print(f'  holes {w}x{h} show me: big sheet {widths}', flush=True)
            C.ok(bool(widths) and min(widths) >= 100, f'holes {w}x{h}: show me draws its large sheet 100 px or more wide ({widths})')
        C.ok(not errs, f'holes {w}x{h}: no page errors ({errs[:2]})')
        ctx.close()
    REPORT['holes'] = rows
    return rows


KNOTS_JS = r"""() => {
  const st = document.querySelector('.pl-trial .ex-knots-stage'), r = st ? st.getBoundingClientRect() : null, de = document.documentElement;
  const ctl = [...document.querySelectorAll('.pl-trial .pl-grid .px-choice')].map(e => e.getBoundingClientRect());
  const hud = document.querySelector('.pl-hud, .pl-status, .pl-head'), hr = hud ? hud.getBoundingClientRect() : null;
  return { plate: r ? Math.round(r.width) : 0, plateH: r ? Math.round(r.height) : 0, top: r ? Math.round(r.top) : null, bottom: r ? Math.round(r.bottom) : null,
    hudBottom: hr ? Math.round(hr.bottom) : null, scrollH: Math.max(de.scrollHeight, document.body.scrollHeight), H: innerHeight,
    lowest: Math.round(Math.max(0, ...ctl.map(c => c.bottom))), right: Math.round(Math.max(0, ...ctl.map(c => c.right))) };
}"""
KNOTS_SIZES = [(844, 390), (932, 430), (915, 412), (740, 360), (667, 375), (360, 640), (390, 844), (1366, 768)]


def part_knots(b):
    """O48: the Knots rope plate is 320 px or more (R2's floor) on phones held sideways."""
    rows = []
    for (w, h) in KNOTS_SIZES:
        touch = w < 1000
        ctx, page, errs = open_app(b, w, h, touch=touch)
        if C.ok(free_item(page, 'knots'), f'knots {w}x{h}: an item'):
            page.wait_for_timeout(300)
            m = page.evaluate(KNOTS_JS)
            m['size'] = f'{w}x{h}'
            rows.append(m)
            print(f'  knots {w}x{h}: {m}', flush=True)
            page.screenshot(path=str(DIR / f'knots_{w}x{h}.png'))
            if touch:
                C.ok(m['scrollH'] <= h + 1 and m['bottom'] <= h + 1 and m['lowest'] <= h + 1, f'knots {w}x{h}: the item fits without a scroll ({m})')
            if not (w > h and h < 380):
                C.ok(m['plate'] >= 320, f'knots {w}x{h}: the plate is 320 px or more ({m["plate"]})')
            else:  # shorter phones held sideways: the height left under the status strip cannot hold 320 px
                C.ok(m['plate'] >= min(h - 60, 0.46 * w), f'knots {w}x{h}: the plate takes the height under the status strip or its column ({m["plate"]} of {h})')
        C.ok(not errs, f'knots {w}x{h}: no page errors ({errs[:2]})')
        ctx.close()
    REPORT['knots'] = rows


PROG_JS = r"""() => {
  const box = document.querySelector('.px-prog'), nav = document.querySelector('.px-prog-nav');
  const kids = box ? [...box.children] : [];
  const shown = kids.filter(k => k.getBoundingClientRect().height > 0).map(k => k.getAttribute('data-tab') + ':' + (k.getAttribute('data-section') || k.className.split(' ')[0]));
  const chips = nav ? [...nav.querySelectorAll('[data-jump]')].map(b => { const r = b.getBoundingClientRect(); return { id: b.dataset.jump, cur: b.getAttribute('aria-current'), h: Math.round(r.height), w: Math.round(r.width) }; }) : [];
  const de = document.documentElement;
  return { shown, chips, n: kids.length, pageH: Math.max(de.scrollHeight, document.body.scrollHeight), H: innerHeight, links: document.querySelectorAll('.px-prog-nav a[href^="#"]').length };
}"""


def part_progress(b):
    """O20: Progress on a phone shows one section at a time; the jump buttons pick it (44 px chips, never
    hash links); desktop keeps the whole page. With screens.py's simulated six-week record."""
    from screens import SIM
    rows = {}
    for (w, h) in ((360, 640), (390, 844), (1366, 768)):
        touch = w < 720
        ctx, page, errs = open_app(b, w, h, touch=touch)
        page.evaluate(SIM, {'seed': 7, 'days': 45, 'perWeek': 4, 'minutes': 12, 'lab': False})
        page.evaluate('PX.ui.hooks && PX.ui.hooks.mute(false)')  # the panels other modules place go with their section
        page.evaluate('void PX.core.router.go("progress", {}, { force: true })')
        page.wait_for_timeout(600)
        m = page.evaluate(PROG_JS)
        rows[f'{w}x{h} levels'] = m
        print(f'  progress {w}x{h}: page {m["pageH"]} px, shown {m["shown"]}', flush=True)
        page.screenshot(path=str(DIR / f'progress_{w}x{h}_levels.png'))
        C.ok(m['links'] == 0, f'progress {w}x{h}: the section buttons are buttons, no hash links')
        if touch:
            C.ok(all(x.startswith('levels:') for x in m['shown']) and len(m['shown']) >= 1, f'progress {w}x{h}: only the Levels tab shows at first ({m["shown"]})')
            C.ok(all(c['h'] >= 44 for c in m['chips']) and len(m['chips']) == 7, f'progress {w}x{h}: seven section chips of 44 px or more ({m["chips"]})')
            C.ok([c['id'] for c in m['chips'] if c['cur'] == 'true'] == ['levels'], f'progress {w}x{h}: the Levels chip is marked current')
            total = 0
            for sec in ('check', 'curves', 'bests', 'goal', 'achievements', 'data'):
                page.click(f'[data-jump="{sec}"]')
                page.wait_for_timeout(350)
                q = page.evaluate(PROG_JS)
                total = max(total, q['pageH'])
                print(f'  progress {w}x{h} {sec}: page {q["pageH"]} px, shown {q["shown"]}', flush=True)
                ok = q['shown'] and all(x.startswith(sec + ':') for x in q['shown'])
                C.ok(ok, f'progress {w}x{h}: the {sec} chip shows that section alone, with its panels ({q["shown"]})')
                C.ok([c['id'] for c in q['chips'] if c['cur'] == 'true'] == [sec], f'progress {w}x{h}: the {sec} chip is marked current')
                nav_top = page.evaluate("document.querySelector('.px-prog-nav').getBoundingClientRect().top")
                C.ok(nav_top >= 0, f'progress {w}x{h}: after {sec} the chips are on the screen (top {nav_top})')
                if sec in ('check', 'achievements'):
                    page.screenshot(path=str(DIR / f'progress_{w}x{h}_{sec}.png'))
            rows[f'{w}x{h} longest tab'] = total
            # ?ex= opens the Curves tab
            page.evaluate('void PX.core.router.go("progress", { ex: "rotate" }, { force: true })')
            page.wait_for_timeout(500)
            q = page.evaluate(PROG_JS)
            C.ok(q['shown'] and all(x.startswith('curves:') for x in q['shown']), f'progress {w}x{h}: ?ex= opens the Curves tab ({q["shown"]})')
        else:
            C.ok(len(m['shown']) == m['n'], f'progress {w}x{h}: desktop shows every section ({len(m["shown"])} of {m["n"]})')
        C.ok(not errs, f'progress {w}x{h}: no page errors ({errs[:2]})')
        ctx.close()
    REPORT['progress'] = rows


def tile_center(page, i):
    page.locator('.pl-grid .px-choice').nth(i).scroll_into_view_if_needed()
    page.wait_for_timeout(100)
    r = page.evaluate(f"(() => {{ const b = document.querySelectorAll('.pl-grid .px-choice')[{i}].getBoundingClientRect(); return [b.left + b.width / 2, b.top + b.height / 2]; }})()")
    return r[0], r[1]


def part_taps(b):
    """O22: Settings' "Confirm taps" (off by default): a first touch tap on a single-choice answer marks it, a
    second tap on the same answer gives it; another answer moves the mark; keys and a mouse answer at once;
    the answer is logged as touch with its time from the painted frame to the second tap."""
    ex = 'cubes'  # single choice, five answers
    # off by default: one tap answers
    ctx, page, errs = open_app(b, 360, 640)
    C.ok(page.evaluate('PX.core.store.state.settings.confirmTaps') is False, 'taps: Confirm taps is off by default')
    if C.ok(free_item(page, ex), 'taps 360x640: an item'):
        page.wait_for_timeout(300)
        x, y = tile_center(page, 0)
        page.touchscreen.tap(x, y)
        page.wait_for_timeout(300)
        C.ok(state(page) in ('reveal', 'showme'), f'taps off: one tap answers ({state(page)})')
    # on: tap, tap another, tap it again
    page.evaluate('PX.core.store.state.settings.confirmTaps = true')
    if C.ok(free_item(page, ex), 'taps 360x640 on: an item'):
        page.wait_for_timeout(300)
        x0, y0 = tile_center(page, 0)
        x1, y1 = tile_center(page, 1)
        page.touchscreen.tap(x0, y0)
        page.wait_for_timeout(300)
        sel = page.evaluate("[...document.querySelectorAll('.pl-grid .px-choice')].map(b => b.getAttribute('aria-pressed'))")
        C.ok(state(page) == 'respond' and sel[0] == 'true', f'taps on: a first tap marks the answer and does not answer ({state(page)}, {sel})')
        page.screenshot(path=str(DIR / 'taps_360x640_marked.png'))
        page.touchscreen.tap(x1, y1)
        page.wait_for_timeout(300)
        sel = page.evaluate("[...document.querySelectorAll('.pl-grid .px-choice')].map(b => b.getAttribute('aria-pressed'))")
        C.ok(state(page) == 'respond' and sel[1] == 'true' and sel[0] == 'false', f'taps on: a tap on another answer moves the mark ({state(page)}, {sel})')
        page.touchscreen.tap(x1, y1)
        page.wait_for_timeout(400)
        C.ok(state(page) in ('reveal', 'showme'), f'taps on: a second tap on the marked answer answers ({state(page)})')
        tr = page.evaluate("(() => { const e = window.__play && __play.last; return e ? { input: e.input, rtMs: e.rtMs, outcome: e.outcome } : null; })()")
        C.ok(bool(tr) and tr['input'] == 'touch' and (tr['rtMs'] or 0) > 0, f'taps on: the answer is logged as touch with its time ({tr})')
        print(f'  taps: last trial {tr}', flush=True)
    # on: keys answer at once
    if C.ok(free_item(page, ex), 'taps 360x640 on: a third item'):
        page.wait_for_timeout(300)
        page.keyboard.press('2')
        page.wait_for_timeout(300)
        C.ok(state(page) in ('reveal', 'showme'), f'taps on: a key answers at once ({state(page)})')
    C.ok(not errs, f'taps 360x640: no page errors ({errs[:2]})')
    ctx.close()
    # desktop with a mouse, setting on: a click answers at once; the Settings switch is there
    ctx, page, errs = open_app(b, 1366, 768, touch=False)
    page.evaluate('PX.core.store.state.settings.confirmTaps = true')
    if C.ok(free_item(page, ex), 'taps 1366x768: an item'):
        page.wait_for_timeout(300)
        x, y = tile_center(page, 0)
        page.mouse.click(x, y)
        page.wait_for_timeout(300)
        C.ok(state(page) in ('reveal', 'showme'), f'taps on, mouse: a click answers at once ({state(page)})')
    page.evaluate('window.__play && void __play.end()')
    page.evaluate('void PX.core.router.go("settings", {}, { force: true })')
    page.wait_for_timeout(500)
    sw = page.locator('[data-key="confirmTaps"], input[name="confirmTaps"], #px-set-confirmTaps')
    txt = page.evaluate("document.querySelector('main').textContent")
    C.ok('Confirm taps' in txt, 'taps: Settings has the Confirm taps switch')
    page.screenshot(path=str(DIR / 'taps_settings_1366x768.png'), full_page=False)
    C.ok(not errs, f'taps 1366x768: no page errors ({errs[:2]})')
    ctx.close()



def main():
    with sync_playwright() as p:
        b = launch(p)
        if want('dial'):
            part_dial(b)
        if want('dat'):
            part_dat(b)
        if want('holes'):
            part_holes(b)
        if want('knots'):
            part_knots(b)
        if want('progress'):
            part_progress(b)
        if want('taps'):
            part_taps(b)
        b.close()
    return C.summary(REPORT)


if __name__ == '__main__':
    sys.exit(main())
