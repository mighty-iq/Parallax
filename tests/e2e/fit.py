"""Phone fit: every scored item shows its stimulus and every answer control without scrolling.

PLAN M2 acceptance (docs/research/v1.1/I2-mobile-audit.md §11, tests to add). For each viewport
(touch emulation, device pixel ratio 2) and each exercise, items are played in the app itself:
  - training exercises in Free play with fixed settings: every variant at its easiest and its
    hardest settings, plus each dimension at its top level alone (the combinations that make the
    biggest stems and the most options), two items each;
  - probes in a real Spatial Check (with the optional Level probe): one pass answering every
    item right (the items climb to the hardest), and at 360 x 640 a second pass answering every
    item wrong (the easiest).
At each item's answer state the test checks that
  1. every stimulus box (the view's stages and question lines) lies inside the viewport,
  2. every visible answer control (options, Confirm, the view's own buttons, dials and boards)
     lies inside the viewport,
  3. the page itself cannot scroll (document height <= viewport height + 1 px).
360 x 640 is the strict size (CONTRACT B2); 390 x 844, 412 x 915 and 844 x 390 (landscape) run
fewer settings. A control case must fail: one item with a stage forced taller than the screen.
At 360 x 640 each training exercise's Watch, Try, Go is checked too: the demo's caption on the
screen above the pinned controls with the stage in view, and the first Try item's stage in view
as it plays. During items: no app header, overscroll none, body.px-item, touch-action manipulation.

Run:  tests/e2e/pwslot.sh python3 tests/e2e/fit.py [--sizes 360x640,844x390] [--ex rotate,fold]
      [--quick] [--root DIR] [--no-check] [--shots] [--scale 1.5]
--scale 1.5 plays the same items at 150 % text and checks only that nothing overflows sideways
(PLAN M2: no horizontal overflow at 150 % text); larger text may need a scroll.
Exit code 1 when a check fails. Report: tests/e2e/out/fit-report.json; screenshots: tests/e2e/out/fit/.
--root runs the same test against another copy of the app (the frozen v1.0 copy gives the
"before" numbers). --shim adds body.px-item itself (for copies whose player lacks the hook).
"""
import argparse, json, pathlib, sys, time
sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
from playwright.sync_api import sync_playwright
from common import ROOT, OUT, launch, Checks

READY = 'document.documentElement.getAttribute("data-px-ready") === "1"'
SIZES = {'360x640': (360, 640), '390x844': (390, 844), '412x915': (412, 915), '844x390': (844, 390)}
EXTRA = {'375x548': (375, 548)}  # an iPhone SE in Safari with its toolbars shown (on request: --sizes 375x548)
STRICT = '360x640'
PROBES = ['wordlinks', 'cubematch', 'viewmatch', 'mechanisms', 'patterns', 'level']

ap = argparse.ArgumentParser()
ap.add_argument('--sizes', default=','.join(SIZES))
SIZES.update(EXTRA)
ap.add_argument('--ex', default='')
ap.add_argument('--quick', action='store_true', help='fewer settings per exercise (development runs)')
ap.add_argument('--root', default=str(ROOT))
ap.add_argument('--shim', action='store_true', help='add body.px-item from the test (for copies without the hook)')
ap.add_argument('--no-check', action='store_true', help='skip the Spatial Check probes')
ap.add_argument('--shots', action='store_true', help='a screenshot of every item, not only the first of each exercise')
ap.add_argument('--no-wtg', action='store_true', help='skip the Watch, Try, Go checks (360 x 640 only)')
ap.add_argument('--scale', type=float, default=1.0, help='text size (Settings): at 1.5 only horizontal overflow is checked')
ap.add_argument('--tag', default='fit')
args = ap.parse_args()

APP = (pathlib.Path(args.root) / 'index.html').resolve().as_uri()
SHOTS = OUT / args.tag
SHOTS.mkdir(parents=True, exist_ok=True)
C = Checks(args.tag)
report = {'sizes': {}, 'control': None}

# Settings to try for one exercise: every variant x (easiest, hardest), then each dim at its top
# level alone (others at 0). Quick runs keep the hardest of every variant.
COMBOS_JS = r'''(o) => {
  const def = PX.ex.get(o.id); if (!def) return [];
  const vs = def.variants && def.variants.length ? def.variants : [undefined];
  const top = {}, low = {};
  def.dims.forEach(d => { top[d.key] = d.levels.length - 1; low[d.key] = 0; });
  const out = [], seen = new Set();
  function add(p, v) { const q = Object.assign({}, p); if (v !== undefined) q.variant = v; const k = JSON.stringify(q); if (!seen.has(k) && PX.ex.validParams(def, q) === true) { seen.add(k); out.push(q); } }
  vs.forEach(v => add(top, v));
  if (!o.quick) {
    vs.forEach(v => add(low, v));
    vs.forEach(v => def.dims.forEach(d => { const p = Object.assign({}, low); p[d.key] = d.levels.length - 1; add(p, v); }));
  }
  return out.slice(0, o.max || 99);
}'''

FIT_JS = r'''() => {
  const H = innerHeight, W = innerWidth, de = document.documentElement;
  function shown(el) {
    if (!el || el.closest('[hidden]')) return false;
    for (let e = el; e && e.nodeType === 1; e = e.parentElement) {
      const s = getComputedStyle(e);
      if (s.display === 'none' || s.visibility === 'hidden' || s.opacity === '0') return false;
    }
    const r = el.getBoundingClientRect();
    return r.width > 0.5 && r.height > 0.5;
  }
  function name(el) {
    const c = String(el.getAttribute('class') || '').trim().split(/\s+/).slice(0, 2).join('.');
    const t = (el.getAttribute('aria-label') || el.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 22);
    return el.tagName.toLowerCase() + (c ? '.' + c : '') + (t ? ' "' + t + '"' : '');
  }
  function box(el) { const r = el.getBoundingClientRect(); return { el: name(el), top: Math.round(r.top), bottom: Math.round(r.bottom), left: Math.round(r.left), right: Math.round(r.right) }; }
  const trial = document.querySelector('.pl-trial'), host = trial && trial.querySelector('.pl-host');
  if (!trial || !host) return { error: 'no item on screen' };
  const stimSel = '.ex-stage, .mx-question, .pm-phase, .ex-orient-q, .wl-stage, .ex-span-phase';
  const stim = [...host.querySelectorAll(stimSel)].filter(shown).map(box);
  const ctlSel = 'button, [role=slider], [role=radiogroup], input, select, .ex-span-board, .pm-svg, .ex-orient-dial, .pr-timer';
  const ctl = [...trial.querySelectorAll('.pl-grid .px-choice, .pl-confirm .px-btn, .pl-limit')].filter(shown).map(box)
    .concat([...host.querySelectorAll(ctlSel)].filter(el => shown(el) && !el.closest('.pl-pause')).map(box));
  const out = b => b.top < -0.5 || b.bottom > H + 0.5 || b.left < -0.5 || b.right > W + 0.5;
  const bad = stim.filter(out).map(b => 'stimulus ' + b.el + ' y ' + b.top + '..' + b.bottom + ' x ' + b.left + '..' + b.right)
    .concat(ctl.filter(out).map(b => 'control ' + b.el + ' y ' + b.top + '..' + b.bottom + ' x ' + b.left + '..' + b.right));
  const scrollH = Math.max(de.scrollHeight, document.body.scrollHeight);
  const lowest = Math.max(0, ...stim.concat(ctl).map(b => b.bottom));
  // Text under 13 px in the item and its status strip (SVG text by its size on the screen).
  const small = {};
  const scope = document.querySelector('.pl-player') || trial;
  const tw = document.createTreeWalker(scope, NodeFilter.SHOW_TEXT);
  for (let n; (n = tw.nextNode());) {
    const t = n.nodeValue.trim(), p = n.parentElement;
    if (!t || !p || p.closest('.px-sr') || !shown(p)) continue;
    const s = getComputedStyle(p);
    let fs = parseFloat(s.fontSize);
    if (!fs) continue;
    if (p.closest('svg') && p.getScreenCTM) { const m = p.getScreenCTM(); if (m) fs *= Math.sqrt(Math.abs(m.a * m.d - m.b * m.c)); }
    if (fs < 12.95) { const k = name(p).split(' "')[0] + ' @' + fs.toFixed(1); if (!small[k]) small[k] = t.slice(0, 16); }
  }
  const scrollW = Math.max(de.scrollWidth, document.body.scrollWidth);
  return { H, W, scrollY: Math.round(scrollY), scrollH, scrolls: scrollH > H + 1, scrollW, stim: stim.length, ctl: ctl.length, bad, lowest, small,
    header: !!(document.querySelector('.px-header') && shown(document.querySelector('.px-header'))),
    overscroll: getComputedStyle(de).overscrollBehaviorY, pxItem: document.body.classList.contains('px-item'),
    touchAction: getComputedStyle(de).touchAction,
    state: window.__play ? __play.state : null, ex: window.__play ? __play.exId : null,
    params: window.__play && __play.item ? __play.item.params : null };
}'''


def phone(b, size):
    w, h = SIZES[size]
    ctx = b.new_context(viewport={'width': w, 'height': h}, device_scale_factor=2, is_mobile=True, has_touch=True)
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
    if args.scale != 1:
        page.evaluate(f'PX.core.store.state.settings.textScale = {args.scale}; PX.ui.app.applySettings()')
    page.evaluate('''() => { const r = PX.core.store.state; r.tour = r.tour || { seen: {} }; r.tour.seen = r.tour.seen || {};
        PX.ex.list().forEach(d => { r.tour.seen[d.id] = true; }); r.ui = r.ui || {}; r.ui.seen = r.ui.seen || {}; r.ui.seen.motionNotice = Date.now(); }''')
    return ctx, page, errs


def shim(page):
    if args.shim:
        page.evaluate("document.body.classList.add('px-item')")


def state(page):
    return page.evaluate('window.__play ? __play.state : null')


def clear_cards(page):
    """Takes the primary action of an intro or offer card, or Track's motion notice."""
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


def measure(page, size, ex, label, shot):
    page.wait_for_timeout(250)  # the answer controls are live: let late layout (fonts, snapshots) settle
    m = page.evaluate(FIT_JS)
    if shot:
        path = SHOTS / f'{size}_{ex}_{label}.png'
        page.screenshot(path=str(path))
        m['shot'] = str(path)
    return m


def judge(size, ex, label, m, rows):
    if args.scale != 1 and not m.get('error'):
        wide = m['scrollW'] > SIZES[size][0]
        ok, why = not wide, ('sideways overflow: ' + str(m['scrollW']) + ' > ' + str(SIZES[size][0]) if wide else '')
        m = dict(m, small={})  # larger text is never under 13 px
    else:
        ok = not m.get('error') and not m['bad'] and not m['scrolls'] and m['stim'] > 0 and m['ctl'] > 0
        why = m.get('error') or '; '.join(m['bad'][:4]) or ('page scrolls: ' + str(m['scrollH']) + ' > ' + str(m['H']) if m['scrolls'] else '') \
            or ('no stimulus found' if not m['stim'] else 'no answer control found' if not m['ctl'] else '')
    rows.append({'ex': ex, 'item': label, 'ok': ok, 'why': why, 'lowest': m.get('lowest'), 'H': m.get('H'), 'params': m.get('params'), 'shot': m.get('shot'),
                 'small': m.get('small') or {}, 'chrome': [m.get('header'), m.get('overscroll'), m.get('pxItem'), m.get('touchAction')]})
    if size == STRICT or not ok:
        print(f'  {"ok  " if ok else "FAIL"} {size} {ex} {label} lowest {m.get("lowest")}/{m.get("H")} {why}', flush=True)
    return ok


def run_train(page, size, ex, rows):
    strict = size == STRICT
    combos = page.evaluate(COMBOS_JS, {'id': ex, 'quick': args.quick or not strict, 'max': 12 if strict else 4})
    n_items = 2 if strict and not args.quick else 1
    first = True
    for ci, params in enumerate(combos):
        page.evaluate('void __play.end()')
        page.evaluate('PX.debug.fast(true)')
        page.evaluate(f'void PX.core.router.go("play", {json.dumps({"mode": "free", "exId": ex, "run": "1", "trials": n_items + 1, "params": params})}, {{ force: true }})')
        shim(page)
        page.wait_for_timeout(150)
        for k in range(n_items):
            if not wait_respond(page):
                rows.append({'ex': ex, 'item': f'c{ci}i{k}', 'ok': False, 'why': f'never reached the answer state (state {state(page)})', 'params': params})
                print(f'  FAIL {size} {ex} c{ci}i{k}: no answer state ({state(page)})', flush=True)
                break
            m = measure(page, size, ex, f'c{ci}i{k}', first or args.shots)
            first = False
            judge(size, ex, f'c{ci}i{k}', m, rows)
            page.evaluate('__play.answer(true).catch(() => 0)')
            page.wait_for_timeout(120)
            page.evaluate('__play.next()')
    page.evaluate('void __play.end()')


def run_check(page, size, rows, right):
    """A real Spatial Check with the optional Level probe; every item answered right or wrong."""
    page.evaluate('PX.debug.fast(true)')
    page.evaluate('void PX.core.router.go("play", { mode: "check", optional: "1" }, { force: true })')
    shim(page)
    page.wait_for_timeout(300)
    seen, t0, n = {}, time.time(), 0
    tag = 'right' if right else 'wrong'
    while time.time() - t0 < 600:
        done = page.evaluate('PX.ui.check && PX.ui.check.session ? !!PX.ui.check.session.done : true')
        if done:
            break
        # cards: Start the check, Skip (expectations), Skip the example
        for sel in ('[data-card-box] [data-card="skip"]', '[data-card-box] [data-card="start"]', '[data-card-box] .px-btn--primary'):
            loc = page.locator(sel)
            if loc.count() and loc.first.is_visible():
                loc.first.click()
                page.wait_for_timeout(200)
                break
        if state(page) != 'respond':
            page.wait_for_timeout(100)
            continue
        ex = page.evaluate('__play.exId')
        k = seen.get(ex, 0)
        seen[ex] = k + 1
        if args.ex and ex not in args.ex.split(','):
            page.evaluate(f'__play.answer({str(right).lower()}).catch(() => 0)')
            page.wait_for_timeout(150)
            continue
        m = measure(page, size, ex, f'{tag}{k}', k == 0 or args.shots)
        judge(size, ex, f'{tag}{k}', m, rows)
        n += 1
        page.evaluate(f'__play.answer({str(right).lower()}).catch(() => 0)')
        page.wait_for_timeout(150)
    # The record says what the check was taken with (CONTRACT B2), so results compare like with like.
    last = page.evaluate('(PX.core.store.state.assess || []).slice(-1)[0] || null')
    w, h = SIZES[size]
    C.ok(bool(last) and last.get('display') in ('small', 'large') and last.get('viewport') == f'{w}x{h}' and last.get('input') in ('touch', 'mouse', 'pen', 'key', 'unknown'),
         f'{size}: the check record stores display, viewport and input ({ {k: (last or {}).get(k) for k in ("display", "viewport", "input")} })')
    return n


WTG_JS = r"""() => {
  const H = innerHeight;
  const box = e => { if (!e) return null; const r = e.getBoundingClientRect(); return r.height ? { top: Math.round(r.top), bottom: Math.round(r.bottom) } : null; };
  const cap = [...document.querySelectorAll('.pl-trial .ex-caption, .pl-showme .pl-caption')].find(e => e.textContent.trim() && getComputedStyle(e).display !== 'none');
  return { H, state: window.__play && __play.state, stage: box(document.querySelector('.pl-host .ex-stage')),
    caption: box(cap), bar: box(document.querySelector('.pl-showme-buttons')) };
}"""


def run_wtg(page, size, ex, rows):
    """Watch, Try, Go on a phone (PLAN M2): while the demo plays its caption is on the screen and
    above the pinned controls, and the stage is in view; the first Try item's stage is fully in
    view when it plays."""
    page.evaluate('void __play.end()')
    page.evaluate('PX.debug.fast(true)')
    page.evaluate(f"PX.core.store.state.tour.seen['{ex}'] = false")
    page.evaluate(f'void PX.core.router.go("play", {{ mode: "watch", exId: "{ex}" }}, {{ force: true }})')
    demo, t0 = None, time.time()
    while time.time() - t0 < 20:
        if state(page) == 'showme':
            m = page.evaluate(WTG_JS)
            if m['caption']:
                demo = m
                break
        page.wait_for_timeout(30)
    tried = None
    if demo is not None:
        t0 = time.time()
        while time.time() - t0 < 30 and state(page) != 'reveal':
            if state(page) == 'respond' and page.evaluate('(document.querySelector(".pl-wtg-text") || {}).textContent || ""').startswith('Now answer'):
                page.evaluate('__play.answer(true).catch(() => 0)')
            page.wait_for_timeout(60)
        page.evaluate('__play.next()')
        t0 = time.time()
        while time.time() - t0 < 30:
            if state(page) in ('present', 'respond'):
                tried = page.evaluate(WTG_JS)
                break
            page.wait_for_timeout(20)
    ok_demo = bool(demo) and 0 <= demo['caption']['top'] and demo['caption']['bottom'] <= (demo['bar']['top'] + 1 if demo['bar'] else demo['H']) \
        and bool(demo['stage']) and 0 <= demo['stage']['top'] < demo['H'] - 40
    ok_try = bool(tried) and bool(tried['stage']) and tried['stage']['top'] >= 0 and tried['stage']['bottom'] <= tried['H'] + 0.5
    rows.append({'ex': ex, 'item': 'watch', 'ok': ok_demo, 'why': '' if ok_demo else f'demo: {demo}'})
    rows.append({'ex': ex, 'item': 'try', 'ok': ok_try, 'why': '' if ok_try else f'try: {tried}'})
    for label, ok, m in (('watch', ok_demo, demo), ('try', ok_try, tried)):
        print(f'  {"ok  " if ok else "FAIL"} {size} {ex} {label} {m}', flush=True)
    page.evaluate('void __play.end()')
    page.evaluate(f"PX.core.store.state.tour.seen['{ex}'] = true")


def control_case(b):
    """A stage forced taller than the screen must fail the same checks."""
    ctx, page, errs = phone(b, STRICT)
    page.add_style_tag(content='.pl-trial .ex-stage { min-height: 120vh !important; }')
    page.evaluate('PX.debug.fast(true)')
    page.evaluate('void PX.core.router.go("play", { mode: "free", exId: "rotate", run: "1", trials: 2 }, { force: true })')
    shim(page)
    rows = []
    reached = wait_respond(page)
    m = measure(page, STRICT, 'rotate', 'control', True) if reached else {'error': 'no answer state', 'bad': [], 'scrolls': False, 'stim': 0, 'ctl': 0}
    ok = judge(STRICT, 'rotate', 'control', m, rows)
    page.evaluate('void __play.end()')
    ctx.close()
    return reached and not ok, rows[0]


with sync_playwright() as p:
    b = launch(p)
    want = [s for s in args.sizes.split(',') if s]
    for size in want:
        print(f'== {size}', flush=True)
        ctx, page, errs = phone(b, size)
        rows = []
        exs = page.evaluate("PX.ex.list('train').filter(d => PX.ui.play.canRun(d)).map(d => d.id)")
        if args.ex:
            exs = [e for e in exs if e in args.ex.split(',')]
        for ex in exs:
            try:
                if size == STRICT and not args.no_wtg and args.scale == 1:
                    run_wtg(page, size, ex, rows)
                run_train(page, size, ex, rows)
            except Exception as e:  # one exercise's failure must not hide the others
                rows.append({'ex': ex, 'item': 'run', 'ok': False, 'why': 'error: ' + str(e)[:200]})
                print(f'  FAIL {size} {ex}: {str(e)[:200]}', flush=True)
                page.evaluate('void __play.end()')
        if not args.no_check and (not args.ex or any(x in PROBES for x in args.ex.split(','))):
            ctx.close()
            ctx, page, errs2 = phone(b, size)
            n = run_check(page, size, rows, True)
            print(f'  check (right): {n} items', flush=True)
            errs += errs2
            if size == STRICT and not args.quick:
                ctx.close()
                ctx, page, errs3 = phone(b, size)
                n = run_check(page, size, rows, False)
                print(f'  check (wrong): {n} items', flush=True)
                errs += errs3
        ctx.close()
        by_ex = {}
        for r in rows:
            e = by_ex.setdefault(r['ex'], {'items': 0, 'failed': 0, 'worst': None, 'why': [], 'small': {}})
            e['items'] += 1
            e['small'].update(r.get('small') or {})
            if not r['ok']:
                e['failed'] += 1
                if len(e['why']) < 3:
                    e['why'].append(f"{r['item']} {json.dumps(r.get('params'))}: {r['why']}")
            if r.get('lowest') is not None and (e['worst'] is None or r['lowest'] > e['worst']):
                e['worst'] = r['lowest']
        report['sizes'][size] = {'exercises': by_ex, 'errors': errs[:20], 'rows': rows}
        for ex, e in by_ex.items():
            C.ok(e['failed'] == 0, f'{size} {ex}: {e["failed"]} of {e["items"]} items do not fit ({"; ".join(e["why"])})')
            # PLAN M2: no text under 13 px on a phone (SVG labels scaled with their drawing)
            C.ok(not e['small'], f'{size} {ex}: text under 13 px: {json.dumps(e["small"])[:300]}')
        C.ok(not errs, f'{size}: page errors {errs[:3]}')
        # During items: the app header steps aside, no pull-to-refresh, double-tap zoom off (CONTRACT B2 §1, §5).
        chrome = [r['chrome'] for r in rows if r.get('chrome')]
        bad_chrome = [c for c in chrome if c[0] or c[1] != 'none' or not c[2] or c[3] != 'manipulation']
        C.ok(chrome and not bad_chrome, f'{size}: during items the header is hidden, overscroll is none, body.px-item is set and touch-action is manipulation ({bad_chrome[:2]})')
    if not args.ex and args.scale == 1:
        failed_as_expected, row = control_case(b)
        report['control'] = row
        C.ok(failed_as_expected, f'control case: a stage taller than the screen must fail the fit check ({row})')
    b.close()

(OUT / f'{args.tag}-report.json').write_text(json.dumps(report, indent=1))
print('summary:')
for size, s in report['sizes'].items():
    print('  ' + size + ': ' + ', '.join(f"{ex} {e['items'] - e['failed']}/{e['items']}" for ex, e in s['exercises'].items()))
sys.exit(C.summary())
