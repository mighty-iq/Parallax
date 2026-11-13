#!/usr/bin/env python3
"""Figures for the guide: screenshots of every exercise and probe in the dev harness.

    tests/e2e/pwslot.sh python3 tools/shots.py              # all figures
    tests/e2e/pwslot.sh python3 tools/shots.py rotate track  # only these ids (or 'app')

Writes docs/shots/<name>.png (light theme, 720 CSS px wide at device scale 2, fixed seeds and
settings) and docs/shots/shots.json (what was made, with sizes). For each exercise: one shot
mid-question and one of its feedback or its show-me, where that teaches something; for each probe:
one shot mid-question (the Spatial Check gives no feedback). The harness's own controls and debug
lines are hidden; the trial, its feedback line and the show-me controls stay, as in the app.
An exercise whose view does not exist yet (js/ex/<id>/view.js) gets a labelled placeholder.
App screens (`app` or app-<name>; APP_NAMES below): the Chimera welcome dialog; Watch, Try, Go;
Today, Library, the player (feedback, show me), the session summary, a share card, a Spatial Check
probe, the Spatial Check report and the weekly goal in Progress, the Lab and Settings at
1366 × 768, plus Today, the Library and an item at 412 × 880 (phone). Screens that need history
get a record built in the page by the engine (tests/e2e/screens.py SIM: about six weeks of real
sessions with a simulated learner), never a hand-written one. Browser runs go through
tests/e2e/pwslot.sh (two slots per machine).
v1.1 adds Reckon (a near miss played by keys for its feedback), Knots (pull, and untie as an EXTRA shot),
the six DAT-style formats, and the screens of V11_NAMES (phones at 360 × 740 with touch: an item and its
Help, Homing and Reckon answered by their touch controls; the Section practice review; About's Test
hygiene; the Library's DAT-style group). `app` shoots them all; app-<name> one of them. """
import json
import pathlib
import sys

ROOT = pathlib.Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / 'tests' / 'e2e'))
from playwright.sync_api import sync_playwright  # noqa: E402

from common import Console, file_url, launch  # noqa: E402

OUT = ROOT / 'docs' / 'shots'
OUT.mkdir(parents=True, exist_ok=True)
WIDTH, HEIGHT, SCALE = 720, 900, 2
STATE = "(s) => window.__harness && __harness.state === s"
HIDE = ('.hx-bar, .hx-status, .hx-debug, .hx-errors:empty { display: none !important; }'
        ' .hx-main { padding-top: 14px !important; padding-bottom: 10px !important; }')
# The visible part of the harness page: from the top of <main> to the bottom of its last shown child.
CLIP = """() => { const m = document.querySelector('.hx-main'), host = document.querySelector('.hx-host');
  const r = m.getBoundingClientRect(), top = host.getBoundingClientRect().top - 6;   // the stage down (no goal or tip line)
  let bottom = r.top;
  for (const c of m.children) {
    if (c.hidden || getComputedStyle(c).display === 'none') continue;
    const b = c.getBoundingClientRect(); if (b.height > 0) bottom = Math.max(bottom, b.bottom);
  }
  return { x: Math.max(0, r.left), y: Math.max(0, top), width: Math.min(r.width, innerWidth), height: Math.ceil(bottom - top + 10) }; }"""
# Feedback and show-me figures: the trial only (its stage, verdict, captions and marked options);
# the harness's feedback bar and show-me buttons below it are left out.
CLIP_TRIAL = """() => { const m = document.querySelector('.hx-main'), t = document.querySelector('.hx-trial');
  const r = m.getBoundingClientRect(), b = t.getBoundingClientRect(), top = document.querySelector('.hx-host').getBoundingClientRect().top - 6;
  return { x: Math.max(0, r.left), y: Math.max(0, top), width: Math.min(r.width, innerWidth), height: Math.ceil(b.bottom - top + 10) }; }"""

# id, code, seed, params (level indices), variant, second shot: ('fb' | 'sm', show-me pause ms) or None.
# Settings are mid-range items that show the exercise's features; seeds were picked by looking.
EXERCISES = [
    ('track', 'ex01', 12, 'speed:10,targets:2,spheres:1,time:1', 'still', ('fb', 0)),
    ('rotate', 'ex02', 7, 'angle:4,axis:1,cubes:1', 'pick', ('sm', 1500)),
    ('spin', 'ex03', 7, 'angle:4,cells:2', 'samediff', ('sm', 1200)),
    ('fold', 'ex04', 4, 'folds:2,type:1,punches:1,idle:0', None, ('sm', 4200)),
    ('nets', 'ex05', 7, 'carried:1,shape:0,between:1', 'opposite', ('sm', 2500)),
    ('slice', 'ex06', 7, 'structure:1,cut:1,curved:0', None, ('sm', 2500)),
    ('views', 'ex07', 7, 'cubes:2,grid:0,view:1', 'toview', ('fb', 0)),
    ('orient', 'ex08', 7, 'shift:2,objects:1,tolerance:1', None, ('fb', 0)),
    ('span', 'ex09', 7, 'len:3,cross:1,turn:0', 'forward', ('fb', 0)),
    ('hidden', 'ex10', 7, 'extra:2,sim:1,size:1', None, ('fb', 0)),
    ('homing', 'ex11', 7, 'route:2,landmarks:0,tolerance:1', None, ('sm', 4200)),
    # v1.1: Reckon (its walk in fast mode; the second shot is a near miss, see reckon_miss), Knots and the
    # six DAT-style formats (one shot each: the guide gives them half a card).
    ('reckon', 'ex12', 33, 'route:3,flow:0,speed:1,tolerance:1', 'return', ('fb', 0)),
    ('knots', 'ex13', 4, 'rope:3,spacing:0', 'pull', ('sm', 1400)),
    ('openings', 'ex14', 7, 'features:1,edges:1,keyview:1,pose:0,foils:0', None, None),
    ('patviews', 'ex15', 7, 'cubes:1,grid:0,missing:0,foil:2', None, None),
    ('angles', 'ex16', 9, 'gap:1,size:2,resolve:1,pose:1', None, None),
    ('patfold', 'ex17', 7, 'folds:1,type:1,idle:0', None, None),
    ('cubes', 'ex18', 7, 'cubes:1,height:1,asked:0', None, None),
    ('form', 'ex19', 7, 'solid:1,marks:1,view:1,foil:1', None, None),
    ('cubematch', 'pr1', 7, 'rotation:1,change:0,glyphs:1', None, None),
    ('viewmatch', 'pr2', 7, 'angle:2,objects:1,foils:0', None, None),
    ('mechanisms', 'pr3', 7, 'gears:1,structure:2,question:0', None, None),
    ('patterns', 'pr4', 7, 'size:2,regularity:1', None, None),
    ('level', 'pr5', 7, 'tilt:2,task:0,gap:1', None, None),
    ('wordlinks', 'pr0', 7, 'relation:1,words:0,foils:1', None, None),
]
# Further shots of an exercise under their own names: (id, name, seed, params, variant, second).
EXTRA = [
    ('knots', 'ex13-knots-untie', 4, 'rope:0,spacing:0', 'untie', ('sm', 1300)),
]
COVER = {'rotate', 'nets', 'slice', 'views'}   # stage-only crops for the guide's cover
FAST = {'reckon'}                              # walks played at the harness's fast speed (the shots are after the walk)
LABEL = {'track': 'EX-01 · Track', 'rotate': 'EX-02 · Rotate', 'spin': 'EX-03 · Spin', 'fold': 'EX-04 · Fold',
         'nets': 'EX-05 · Nets', 'slice': 'EX-06 · Slice', 'views': 'EX-07 · Views', 'orient': 'EX-08 · Orient',
         'span': 'EX-09 · Span', 'hidden': 'EX-10 · Hidden', 'homing': 'EX-11 · Homing', 'reckon': 'EX-12 · Reckon',
         'knots': 'EX-13 · Knots', 'openings': 'EX-14 · Openings', 'patviews': 'EX-15 · Missing View',
         'angles': 'EX-16 · Angles', 'patfold': 'EX-17 · Hole Punch', 'cubes': 'EX-18 · Painted Cubes',
         'form': 'EX-19 · Form', 'cubematch': 'PR-1 · Cube Match',
         'viewmatch': 'PR-2 · View Match', 'mechanisms': 'PR-3 · Mechanisms', 'patterns': 'PR-4 · Pattern Memory',
         'level': 'PR-5 · Level', 'wordlinks': 'PR-0 · Word Links'}
# App screens. Screens that need history get a realistic record built in the page by the engine
# itself: tests/e2e/screens.py's SIM plays about six weeks of real sessions (PX.engine.modes
# start/next/answer/finish with a simulated learner), so no number on a figure is hand-written.
APP_NAMES = ['app-welcome', 'app-watch', 'app-today', 'app-today-phone', 'app-library', 'app-player-feedback',
             'app-player-showme', 'app-player-phone', 'app-summary', 'app-share', 'app-check', 'app-progress',
             'app-goal', 'app-lab', 'app-settings', 'app-library-phone']
# v1.1 screens (shoot_v11_screens): phones at 360 × 740 with touch (an item, its Help, Homing and Reckon),
# the Section practice review, About's Test hygiene and the Library's DAT-style group. They need no
# history: the record only marks every exercise as met, so no Watch, Try, Go comes first.
V11_NAMES = ['app-phone-item', 'app-phone-help', 'app-phone-landscape', 'app-homing-phone', 'app-reckon-phone',
             'app-section-review', 'app-about-hygiene', 'app-library-pat']
APP_NAMES += V11_NAMES
APP_READY = 'document.documentElement.getAttribute("data-px-ready") === "1"'
APP_SCALE = 1.5          # 1366 × 768 at 1.5: sharp at full text width in print, files of a sensible size
NICE = ('rotate', 'fold', 'nets', 'slice', 'views', 'spin')   # exercises that read well in a still picture
made = {}


def save(page, name, clip=None):
    path = OUT / f'{name}.png'
    page.screenshot(path=str(path), clip=clip or page.evaluate(CLIP))
    made[name] = {'w': None, 'h': None}
    try:
        from PIL import Image
        with Image.open(path) as im:
            made[name] = {'w': im.width, 'h': im.height}
    except Exception:  # Pillow is optional here
        pass
    print(f'  {name}.png', made[name], flush=True)


def placeholder(page, name, label, why):
    """A labelled stand-in, drawn in the guide's type, for a figure that cannot be made yet."""
    font = (ROOT / 'fonts' / 'ibm-plex-mono-latin-400-normal.woff2').as_uri()
    page.set_content(
        '<!doctype html><html><head><style>'
        f'@font-face{{font-family:Mono;src:url("{font}")}}'
        'html,body{margin:0;background:#F2F4F3}'
        '.ph{box-sizing:border-box;width:720px;height:450px;margin:0;border:2px dashed #7B838A;display:flex;'
        'flex-direction:column;align-items:center;justify-content:center;gap:10px;font-family:Mono,monospace;color:#454B52}'
        '.ph b{font-size:22px;font-weight:500;color:#1A1D21}.ph i{font-style:normal;font-size:14px}'
        f'</style></head><body><div class="ph"><b>{label}</b><i>Screenshot pending: {why}</i></div></body></html>')
    page.wait_for_timeout(200)
    save(page, name, {'x': 0, 'y': 0, 'width': 720, 'height': 450})
    made[name]['placeholder'] = True


def open_harness(page, ex, seed, params, variant):
    page.goto(file_url('tests/dev/harness.html', ex=ex, seed=seed, p=params, v=variant, theme='light', fast=1 if ex in FAST else None))
    page.add_style_tag(content=HIDE)


def reckon_miss(page):
    """A near miss on a Reckon item by keys, as a player might make it: turn about 12° past the start
    (← →, Shift for 1°), then for a return item hold ↑ for about 80 % of the way back and stop (Enter)."""
    it = page.evaluate('() => ({ key: __harness.item.keyDeg, d: __harness.item.distance, v: __harness.item.walkSpeed, ret: __harness.item.answer === "position" })')
    want = round(it['key'] + 12)
    t = ((want + 540) % 360) - 180
    k, n = ('ArrowRight', t) if t >= 0 else ('ArrowLeft', -t)
    for _ in range(int(n) // 5):
        page.keyboard.press(k)
    for _ in range(int(n) % 5):
        page.keyboard.press('Shift+' + k)
    page.wait_for_timeout(300)
    if it['ret']:
        page.keyboard.down('ArrowUp')
        page.wait_for_timeout(int(1000 * 0.8 * it['d'] / it['v']))
        page.keyboard.up('ArrowUp')
        page.wait_for_timeout(500)
    page.keyboard.press('Enter')
    page.wait_for_function(STATE, arg='reveal', timeout=15000)
    page.wait_for_timeout(900)


def wrong_answer(page, wait_ms=1600):
    page.wait_for_timeout(wait_ms)          # a plausible response time in the feedback line
    page.evaluate('() => __harness.answer(false)')
    page.wait_for_function(STATE, arg='reveal', timeout=15000)
    page.wait_for_timeout(900)


def show_me(page, pause_ms):
    page.evaluate('() => { __harness.showMe(); }')
    page.wait_for_function(STATE, arg='showme', timeout=10000)
    page.wait_for_timeout(pause_ms)
    page.locator('.hx-player-buttons .px-btn').first.click()  # Pause, so the frame and its caption hold
    page.wait_for_timeout(250)


def voided(page):
    return bool(page.evaluate('() => !!(__harness.last && __harness.last.void)'))


def shoot_exercise(page, ex, code, seed, params, variant, second, name=None):
    name = name or f'{code}-{ex}'
    if not (ROOT / 'js' / 'ex' / ex / 'view.js').exists():
        placeholder(page, name, LABEL[ex], 'its view is not built yet')
        if second:
            placeholder(page, name + ('-feedback' if second[0] == 'fb' else '-showme'), LABEL[ex], 'its view is not built yet')
        return
    tries = 6 if ex in ('homing', 'track', 'reckon') else 3   # timed 3D stimuli can stutter under software WebGL;
    for attempt in range(tries):                    # a stuttered trial says so on screen, so try again
        open_harness(page, ex, seed, params, variant)
        if ex == 'track':
            page.wait_for_function("() => PX.ex.view('track') && PX.ex.view('track').phase() === 'notice'", timeout=30000)
            page.keyboard.press('Enter')    # the motion notice before the first trial
            page.wait_for_function("() => PX.ex.view('track').phase() === 'cue'", timeout=15000)
            page.wait_for_timeout(700)      # the targets are ringed for 2 s
            save(page, name)
            page.wait_for_function(STATE, arg='respond', timeout=90000)
        elif ex == 'span':
            page.wait_for_function("() => { const r = document.querySelector('[data-phase]'); return r && r.getAttribute('data-phase') === 'watch'; }", timeout=30000)
            page.wait_for_timeout(1500)     # into the sequence: wait for a block that is lit now
            page.wait_for_function("() => !!document.querySelector('.is-lit')", timeout=15000)
            page.wait_for_timeout(150)
            save(page, name)
            page.wait_for_function(STATE, arg='respond', timeout=60000)
        elif ex == 'patterns':
            page.wait_for_function("() => window.__harness && (__harness.state === 'ready' || __harness.state === 'respond')", timeout=30000)
            page.wait_for_timeout(1200)     # the 3 s look at the pattern
            save(page, name)
            page.wait_for_function(STATE, arg='respond', timeout=30000)
        elif ex == 'homing':
            page.wait_for_function("() => window.__harness && __harness.state !== 'loading'", timeout=30000)
            page.wait_for_timeout(3600)     # on the walk, a landmark in view
            save(page, name)
            page.wait_for_function(STATE, arg='respond', timeout=120000)
        elif ex == 'reckon':                # after the walk (fast), the answer state: nothing marks the start
            page.wait_for_function(STATE, arg='respond', timeout=120000)
            page.wait_for_timeout(600)
            save(page, name)
            if second:
                reckon_miss(page)
                if voided(page) and attempt < tries - 1:
                    continue
                save(page, name + '-feedback', page.evaluate(CLIP_TRIAL))
            return
        else:
            page.wait_for_function(STATE, arg='respond', timeout=60000)
            page.wait_for_timeout(400)
            save(page, name)
            if ex in COVER:                 # the stimulus plate alone, for the cover
                host = page.evaluate("() => { const r = document.querySelector('.hx-host').getBoundingClientRect(); return { x: r.left, y: r.top, width: r.width, height: r.height }; }")
                save(page, f'cover-{ex}', host)
        if second:
            kind, ms = second
            wrong_answer(page)
            if voided(page) and attempt < tries - 1:
                print(f'  {ex}: the trial stuttered (software rendering); trying again', flush=True)
                continue
            if kind == 'fb':
                save(page, name + '-feedback', page.evaluate(CLIP_TRIAL))
            else:
                show_me(page, ms)
                save(page, name + '-showme', page.evaluate(CLIP_TRIAL))
        errs = page.evaluate('() => __harness.errors')
        if errs:
            print(f'  {ex}: harness errors {errs[:3]}', flush=True)
        return


def index_active(rel):
    """True when index.html loads `rel` outside its commented PENDING blocks."""
    import re
    html = (ROOT / 'index.html').read_text(encoding='utf-8')
    return f'src="{rel}"' in re.sub(r'<!--.*?-->', '', html, flags=re.S)


BOX = """(sel) => { const e = document.querySelector(sel); if (!e) return null;
  const d = sel === '.px-welcome-title' ? (e.closest('[role=dialog], .px-modal, dialog') || e.parentElement) : e;
  const r = d.getBoundingClientRect(); return { x: r.left, y: r.top, width: r.width, height: r.height }; }"""
STATIC_HEAD = '.px-header { position: static !important; }'   # element cut-outs: no sticky header on top
# The skip link appears only while focused (keyboard users); keep it out of still pictures.
NO_SKIP = '.px-skip { display: none !important; }'


def boot_app(page, welcome=False):
    page.goto(file_url('index.html'))
    page.wait_for_function(APP_READY, timeout=30000)
    page.evaluate('document.fonts.ready.then(() => 1)')
    page.wait_for_timeout(500)
    if welcome:
        return
    for _ in range(4):   # the Chimera pop-up, then the first-run "New here?" offer
        if not page.evaluate('PX.ui.modalOpen()'):
            break
        page.keyboard.press('Escape')
        page.wait_for_timeout(250)
    page.add_style_tag(content=NO_SKIP)
    page.evaluate('() => document.activeElement && document.activeElement.blur && document.activeElement.blur()')


def history(page, lab=False):
    """About six weeks of real engine sessions on the live record, as tests/e2e/screens.py builds it."""
    from screens import SIM
    res = page.evaluate(SIM, {'seed': 7, 'days': 45, 'perWeek': 4, 'minutes': 12, 'lab': lab})
    # A six-week user has met every exercise in the app too: mark the UI's own first-time flags
    # (Watch, Try, Go per exercise, the tour, Track's motion notice) as the player would have.
    page.evaluate("""() => { const r = PX.core.store.state, t = Date.now();
      r.tour = r.tour || {}; r.tour.done = true; r.tour.seen = r.tour.seen || {};
      PX.ex.list('train').forEach((d) => { r.tour.seen[d.id] = true; });
      r.ui = r.ui || {}; r.ui.seen = r.ui.seen || {}; r.ui.seen.motionNotice = r.ui.seen.motionNotice || t;
      PX.core.store.save(); }""")
    page.evaluate('void PX.ui.app.rerender()')
    page.wait_for_timeout(400)
    print(f'  history: {res}', flush=True)
    return res


def go_route(page, r, params=None):
    page.evaluate('([r, p]) => void PX.core.router.go(r, p || undefined, { force: true })', [r, params])
    page.wait_for_timeout(900)
    page.evaluate('() => window.scrollTo(0, 0)')
    page.wait_for_timeout(200)


def viewport(page):
    vs = page.viewport_size
    return {'x': 0, 'y': 0, 'width': vs['width'], 'height': vs['height']}


def cut(page, name, sel, max_h=None):
    """An element alone (scrolled into view, header unstuck), optionally cut to max_h CSS px."""
    page.add_style_tag(content=STATIC_HEAD)
    page.wait_for_timeout(150)
    path = OUT / f'{name}.png'
    page.locator(sel).first.screenshot(path=str(path))
    from PIL import Image
    with Image.open(path) as im:
        w, h = im.size
        if max_h and h > max_h * APP_SCALE:
            im.crop((0, 0, w, int(max_h * APP_SCALE))).save(path)
    with Image.open(path) as im:
        made[name] = {'w': im.width, 'h': im.height}
    print(f'  {name}.png', made[name], flush=True)


def click_through(page, limit=12):
    """Accept the session's cards (strategy check-ins, Track's motion notice, example offers) until an item is up."""
    for _ in range(limit):
        st = page.evaluate('window.__play ? __play.state : "idle"')
        if st == 'respond':
            return True
        box = page.locator('[data-card-box] .px-btn--primary')
        notice = page.locator('.ex-track-notice:not([hidden]) .px-btn')
        if box.count() and box.first.is_visible():
            box.first.click()
        elif notice.count() and notice.first.is_visible():
            notice.first.click()
        page.wait_for_timeout(700)
    return page.evaluate('window.__play && __play.state === "respond"')


def to_nice_item(page, tries=40):
    """Answer items right until a still-picture exercise is up (the pinned focus comes first in most plans)."""
    for _ in range(tries):
        if not click_through(page):
            page.wait_for_timeout(500)
            continue
        if page.evaluate('__play.exId') in NICE:
            return True
        page.evaluate('__play.answer(true).catch(() => 0)')
        page.wait_for_function('__play.state === "reveal" || __play.state === "showme"', timeout=15000)
        page.evaluate('__play.next()')
        page.wait_for_timeout(500)
    return False


def shoot_app_screens(b, want):
    def wanted(*names):
        return any(n in want for n in names)

    def ctx(w, h, scale):
        c = b.new_context(viewport={'width': w, 'height': h}, device_scale_factor=scale, color_scheme='light')
        return c, c.new_page()

    if wanted('app-welcome'):                       # the dialog alone, its backdrop in the guide's paper colour
        c, page = ctx(1200, 900, 2)
        boot_app(page, welcome=True)
        page.add_style_tag(content='.px-modal-backdrop { background: #F2F4F3 !important; }')
        page.wait_for_timeout(250)
        box = page.evaluate(BOX, '.px-welcome-title')
        save(page, 'app-welcome', {'x': box['x'] - 2, 'y': box['y'] - 2, 'width': box['width'] + 4, 'height': box['height'] + 4})
        c.close()
    if wanted('app-watch'):                         # a first look at Rotate: Watch, mid-demo
        c, page = ctx(1366, 768, APP_SCALE)
        boot_app(page)
        go_route(page, 'play', {'mode': 'watch', 'exId': 'rotate'})
        page.wait_for_timeout(2600)
        save(page, 'app-watch', viewport(page))
        c.close()
    if wanted('app-today', 'app-library', 'app-progress', 'app-goal', 'app-settings', 'app-player-feedback',
              'app-player-showme', 'app-summary', 'app-share', 'app-check'):
        c, page = ctx(1366, 768, APP_SCALE)
        boot_app(page)
        history(page)
        for name, r in (('app-today', 'home'), ('app-library', 'library')):
            if wanted(name):
                go_route(page, r)
                save(page, name, viewport(page))
        if wanted('app-progress'):
            go_route(page, 'progress')
            cut(page, 'app-progress', '[data-section="check"]', max_h=720)
        if wanted('app-goal'):
            go_route(page, 'progress')
            cut(page, 'app-goal', '[data-section="goal"]')
        if wanted('app-settings'):
            go_route(page, 'settings')
            cut(page, 'app-settings', '[data-section="data"]')
        if wanted('app-player-feedback', 'app-player-showme', 'app-summary', 'app-share'):
          try:
            page.reload()
            boot_app(page)
            go_route(page, 'play', {'mode': 'train', 'exId': 'rotate'})
            if to_nice_item(page):
                page.wait_for_timeout(2400)          # a plausible response time on the feedback line
                page.evaluate('__play.answer(false).catch(() => 0)')
                page.wait_for_function('__play.state === "reveal" || __play.state === "showme"', timeout=15000)
                try:                                  # after a miss, show me plays on its own (first misses)
                    page.wait_for_function('__play.state === "showme"', timeout=4000)
                except Exception:                     # or on request
                    page.evaluate('void __play.showMe()')
                    page.wait_for_function('__play.state === "showme"', timeout=8000)
                page.wait_for_timeout(1500)
                # Pause and close through the show-me's own buttons, clicked in the page: no key
                # reaches a focused button, and no hover style lands in the picture.
                SM_BTN = "(t) => { const b = [...document.querySelectorAll('.pl-showme-buttons .px-btn')].find((x) => x.textContent.trim().startsWith(t)); if (b) b.click(); return !!b; }"
                page.evaluate(SM_BTN, 'Pause')
                page.wait_for_timeout(350)
                if page.evaluate('__play.state') == 'showme':
                    save(page, 'app-player-showme', viewport(page))
                else:
                    print(f'  show me: not playing ({page.evaluate("__play.state")}); figure kept', flush=True)
                page.evaluate(SM_BTN, 'Close')        # the marked options and the verdict remain
                page.wait_for_function('__play.state === "reveal"', timeout=10000)
                page.wait_for_timeout(600)
                save(page, 'app-player-feedback', viewport(page))
                # A short real session for the summary and the share card: eleven more items, at a
                # person's pace (about 20 s an item), so the active-time clock reads a few minutes.
                for ok in (True, True, False, True, True, True, False, True, True, True, True):
                    page.evaluate('__play.next()')
                    if not click_through(page):
                        break
                    page.wait_for_timeout(17000 if ok else 23000)
                    page.evaluate(f'__play.answer({"true" if ok else "false"}).catch(() => 0)')
                    page.wait_for_function('__play.state === "reveal" || __play.state === "showme"', timeout=15000)
                    page.wait_for_timeout(300)
            page.evaluate('__play.end()')
            page.wait_for_selector('.pl-summary', timeout=20000)
            page.wait_for_timeout(800)
            save(page, 'app-summary', viewport(page))
            if wanted('app-share'):                   # the card the summary's Share button draws
                page.locator('.pl-summary button', has_text='Share').first.click()
                page.wait_for_function("() => { const i = document.querySelector('.px-share-img'); return i && i.src && i.complete && i.naturalWidth > 0; }", timeout=20000)
                data = page.evaluate("""() => { const i = document.querySelector('.px-share-img');
                  if (/^data:image\\/png/.test(i.src)) return i.src;
                  const c = document.createElement('canvas'); c.width = i.naturalWidth; c.height = i.naturalHeight;
                  c.getContext('2d').drawImage(i, 0, 0); return c.toDataURL('image/png'); }""")
                import base64
                (OUT / 'app-share.png').write_bytes(base64.b64decode(data.split(',', 1)[1]))
                made['app-share'] = {'w': None, 'h': None}
                print('  app-share.png', flush=True)
                page.keyboard.press('Escape')
                page.wait_for_timeout(300)
          except Exception as e:
            print(f'  player: FAILED {str(e)[:200]}', flush=True)
        if wanted('app-check'):                     # a probe item in the Spatial Check, no feedback
            go_route(page, 'play', {'mode': 'check'})
            for _ in range(12):
                if page.evaluate('window.__play && __play.state === "respond"'):
                    break
                skip = page.locator('[data-card-box] [data-card="skip"]')
                prim = page.locator('[data-card-box] .px-btn--primary')
                if skip.count() and skip.first.is_visible():
                    skip.first.click()                # "Skip the example" (the example is never scored)
                elif prim.count() and prim.first.is_visible():
                    prim.first.click()
                page.wait_for_timeout(700)
            page.wait_for_timeout(1500)
            save(page, 'app-check', viewport(page))
        c.close()
    if wanted('app-lab'):                           # the Lab, with the optional crossover enrolled
        c, page = ctx(1366, 768, APP_SCALE)
        boot_app(page)
        history(page, lab=True)
        go_route(page, 'lab')
        save(page, 'app-lab', viewport(page))
        c.close()
    if wanted('app-today-phone', 'app-player-phone', 'app-library-phone'):   # the phone layout
        c, page = ctx(412, 880, 2)
        boot_app(page)
        history(page)
        if wanted('app-today-phone'):
            go_route(page, 'home')
            save(page, 'app-today-phone', viewport(page))
        if wanted('app-library-phone'):
            go_route(page, 'library')
            save(page, 'app-library-phone', viewport(page))
        if wanted('app-player-phone'):
            go_route(page, 'play', {'mode': 'train', 'exId': 'fold'})
            if to_nice_item(page):
                page.wait_for_timeout(700)
                save(page, 'app-player-phone', viewport(page))
        c.close()


MET = """() => { const r = PX.core.store.state, t = Date.now();
  r.tour = r.tour || {}; r.tour.done = true; r.tour.seen = r.tour.seen || {};
  PX.ex.list('train').forEach((d) => { r.tour.seen[d.id] = true; });
  r.ui = r.ui || {}; r.ui.seen = r.ui.seen || {}; r.ui.seen.motionNotice = r.ui.seen.motionNotice || t;
  PX.core.store.save(); }"""


def free_play(page, ex, params, fast=False):
    """Free play with fixed settings (no rating changes); True once an item is up."""
    if fast:
        page.evaluate('PX.debug.fast(true)')
    go_route(page, 'play', {'mode': 'free', 'exId': ex, 'run': '1', 'trials': 10, 'params': params})
    return click_through(page, 30)


def turn_keys(page, deg):
    """Turn a Homing or Reckon answer by keys: → and ← in 5° steps, with Shift 1°."""
    t = ((round(deg) + 540) % 360) - 180
    k, n = ('ArrowRight', t) if t >= 0 else ('ArrowLeft', -t)
    for _ in range(int(n) // 5):
        page.keyboard.press(k)
        page.wait_for_timeout(30)
    for _ in range(int(n) % 5):
        page.keyboard.press('Shift+' + k)
        page.wait_for_timeout(30)
    page.wait_for_timeout(400)


def section_run(page):
    """A mini Section practice played to its review: every part, about three answers in four right."""
    page.evaluate('PX.debug.fast(true)')
    go_route(page, 'section', {'size': 'mini'})
    page.locator('[data-sec-start]').first.click()
    n = 0
    for _ in range(400):
        mode = page.evaluate('window.__section && __section.state ? __section.state.mode : null')
        if mode == 'review':
            return True
        if mode == 'intro' and page.locator('[data-card="start"]').count():
            page.locator('[data-card="start"]').first.click()
        elif mode == 'partend' and page.locator('[data-card="next"]').count():
            page.locator('[data-card="next"]').first.click()
        elif mode == 'item' and page.evaluate('window.__play && __play.state === "respond"'):
            page.wait_for_timeout(8000 + (n * 3700) % 9000)   # 8 to 17 s an item: a quick person's pace
            page.evaluate(f'__play.answer({"false" if n % 4 == 3 else "true"}).catch(() => 0)')
            n += 1
        page.wait_for_timeout(350)
    return False


def shoot_v11_screens(b, want):
    def phone():
        c = b.new_context(viewport={'width': 360, 'height': 740}, device_scale_factor=2, color_scheme='light',
                          has_touch=True, is_mobile=True)
        p = c.new_page()
        boot_app(p)
        p.evaluate(MET)
        return c, p

    if any(n in want for n in ('app-phone-item', 'app-phone-help')):   # an item on a 360 px phone, then its Help
        c, page = phone()
        if free_play(page, 'rotate', {'variant': 'pick', 'angle': 4, 'axis': 1, 'cubes': 1}):
            page.wait_for_timeout(900)
            if 'app-phone-item' in want:
                save(page, 'app-phone-item', viewport(page))
            if 'app-phone-help' in want and page.locator('.pl-hud-guide').count():
                page.locator('.pl-hud-guide').first.tap()
                page.wait_for_timeout(500)
                save(page, 'app-phone-help', viewport(page))
        else:
            print('  phone item: no item came up', flush=True)
        c.close()
    if 'app-phone-landscape' in want:               # the same item on a phone held sideways: two columns
        c = b.new_context(viewport={'width': 844, 'height': 390}, device_scale_factor=2, color_scheme='light',
                          has_touch=True, is_mobile=True)
        page = c.new_page()
        boot_app(page)
        page.evaluate(MET)
        if free_play(page, 'rotate', {'variant': 'pick', 'angle': 4, 'axis': 1, 'cubes': 1}):
            page.wait_for_timeout(900)
            save(page, 'app-phone-landscape', viewport(page))
        else:
            print('  phone landscape: no item came up', flush=True)
        c.close()
    if 'app-homing-phone' in want:                  # Homing's answer by touch controls, turned part way
        c, page = phone()
        if free_play(page, 'homing', {'route': 2, 'landmarks': 0, 'tolerance': 1}, fast=True):
            page.wait_for_timeout(600)
            turn_keys(page, 60)
            save(page, 'app-homing-phone', viewport(page))
        else:
            print('  homing phone: no item came up', flush=True)
        c.close()
    if 'app-reckon-phone' in want:                  # Reckon's walk back: turned to the start, part of the way walked
        c, page = phone()
        if free_play(page, 'reckon', {'variant': 'return', 'route': 1, 'flow': 0, 'speed': 1, 'tolerance': 1}, fast=True):
            page.wait_for_timeout(600)
            it = page.evaluate('() => ({ key: __play.item.keyDeg, d: __play.item.distance, v: __play.item.walkSpeed })')
            turn_keys(page, it['key'])
            page.keyboard.down('ArrowUp')
            page.wait_for_timeout(int(1000 * 0.55 * it['d'] / it['v']))
            page.keyboard.up('ArrowUp')
            page.wait_for_timeout(700)
            save(page, 'app-reckon-phone', viewport(page))
        else:
            print('  reckon phone: no item came up', flush=True)
        c.close()
    if any(n in want for n in ('app-section-review', 'app-about-hygiene', 'app-library-pat')):
        c = b.new_context(viewport={'width': 1366, 'height': 768}, device_scale_factor=APP_SCALE, color_scheme='light')
        page = c.new_page()
        boot_app(page)
        page.evaluate(MET)
        if 'app-about-hygiene' in want:
            go_route(page, 'about')
            cut(page, 'app-about-hygiene', '[data-section="hygiene"]')
        if 'app-library-pat' in want:               # the group's head and panel (its six cards left out)
            go_route(page, 'library')
            page.add_style_tag(content='.px-excards[data-group="pat"] { display: none !important; }')
            cut(page, 'app-library-pat', 'section.px-lib-group[data-group="pat"]')
        if 'app-section-review' in want:
            page.reload()
            boot_app(page)
            try:
                if section_run(page):
                    page.wait_for_timeout(900)
                    page.evaluate('() => window.scrollTo(0, 0)')
                    cut(page, 'app-section-review', '.sec-results')
                else:
                    print('  section: the review did not come', flush=True)
            except Exception as e:
                print(f'  section: FAILED {str(e)[:200]}', flush=True)
        c.close()


def main(args):
    only = set(args)
    with sync_playwright() as p:
        b = launch(p)
        ctx = b.new_context(viewport={'width': WIDTH, 'height': HEIGHT}, device_scale_factor=SCALE, color_scheme='light')
        page = ctx.new_page()
        cons = Console(page)
        for ex, code, seed, params, variant, second in EXERCISES:
            if only and ex not in only:
                continue
            print(ex, flush=True)
            try:
                shoot_exercise(page, ex, code, seed, params, variant, second)
            except Exception as e:  # keep going; the figure gets a placeholder
                print(f'  {ex}: FAILED {str(e)[:200]}', flush=True)
                placeholder(page, f'{code}-{ex}', LABEL[ex], 'the capture failed (see tools/shots.py output)')
        for ex, name, seed, params, variant, second in EXTRA:
            if only and ex not in only and name not in only:
                continue
            print(name, flush=True)
            try:
                shoot_exercise(page, ex, None, seed, params, variant, second, name=name)
            except Exception as e:
                print(f'  {name}: FAILED {str(e)[:200]}', flush=True)
        want = set(APP_NAMES) if (not only or 'app' in only) else {n for n in only if n.startswith('app-')}
        if want:
            print('app screens:', ', '.join(sorted(want)), flush=True)
            try:
                shoot_app_screens(b, want)
            except Exception as e:  # report and keep the figures made so far
                print(f'  app screens: FAILED {str(e)[:300]}', flush=True)
            try:
                shoot_v11_screens(b, want)
            except Exception as e:
                print(f'  v1.1 screens: FAILED {str(e)[:300]}', flush=True)
        errs = cons.errors()
        b.close()
    old = {}
    meta = OUT / 'shots.json'
    if meta.exists():
        try:
            old = json.loads(meta.read_text())
        except ValueError:
            old = {}
    old.update(made)
    meta.write_text(json.dumps(old, indent=1, sort_keys=True))
    print(f'{len(made)} figures written to docs/shots/; console errors: {errs[:5] if errs else "none"}')
    return 1 if errs else 0


if __name__ == '__main__':
    sys.exit(main(sys.argv[1:]))
