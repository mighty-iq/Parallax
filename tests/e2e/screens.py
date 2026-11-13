"""E2E tests of the Library, exercise page, Progress, Log, Lab and the share cards (Phase 3, Builder B).

Two records: a brand-new one (empty states, no made-up numbers) and one built by playing about
six weeks of real engine sessions in the page (PX.engine.modes start/next/answer/finish with a
simulated learner, a port of tests/node/fixtures/learner.mjs). Checks: every training exercise
in the Library, tags (attention practice, experimental), coming soon for a view that is not
registered, the practise options and their routes, the exercise page, friend-challenge codes,
share cards (both sizes, non-blank) and the share sheet, the Spatial Check report, curves,
calendar, achievements, the Log (sessions, trials, filters, CSV, import with undo), the Lab
(protocols, the crossover, research export), file:// and a sandboxed srcdoc frame, phone widths
without horizontal scroll, 44 px targets, keyboard, light and dark, no console errors.
v1.1 phones (run_phone_text): with the six-week record on a 360 x 640 touch screen, no text under
13 px (SVG text by its on-screen size) and no horizontal scroll at 100 % and 150 % text.
Screenshots: tests/e2e/out/screens/ at 1366 × 768 and 412 × 880, light and dark.

Run: tests/e2e/pwslot.sh python3 tests/e2e/screens.py   (exit code 1 when a check fails)
"""
import json, pathlib, re, sys
sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
from playwright.sync_api import sync_playwright
from common import Checks, non_blank
from shell_common import ROOT, INDEX, DISCORD, READY, attach_console, problems, inline_single, write_host, child_frame

OUT = ROOT / 'tests' / 'e2e' / 'out' / 'screens'
OUT.mkdir(parents=True, exist_ok=True)
C = Checks('screens')
ROUTES = ['library', 'exercise/rotate', 'progress', 'log', 'lab']
FULLPAGE_FIX = '.px-tabbar{position:static!important}.px-app{padding-bottom:0!important}'
TARGETS_JS = '''() => {
  const out = [];
  const sel = 'button, a[href], select, textarea, summary, input:not([type=radio]):not([type=checkbox]), .px-seg-item, .px-switch';
  for (const el of document.querySelectorAll(sel)) {
    if (el.closest('[hidden],[inert]') || el.matches('.px-refs a, .px-skip')) continue;
    const st = getComputedStyle(el), r = el.getBoundingClientRect();
    if (!r.width || !r.height || st.display === 'none' || st.visibility === 'hidden') continue;
    if (r.width < 43.5 || r.height < 43.5) out.push(`${el.tagName.toLowerCase()}.${el.className} ${Math.round(r.width)}x${Math.round(r.height)} "${(el.textContent || '').trim().slice(0, 24)}"`);
  }
  return out;
}'''

# A simulated learner playing real engine sessions on the live record, `days` days up to now.
SIM = r'''(opts) => {
  opts = opts || {};
  var PX = window.PX, E = PX.engine, store = PX.core.store, rec = store.state;
  var DAY = 86400000, days = opts.days || 42, now0 = Date.now(), T0 = now0 - days * DAY;
  var r = PX.rng(PX.rng.hash('sim-ui', opts.seed || 1));
  var general = r.normal(0, 0.5), exS = {}, probeS = {};
  function exState(def) {
    var s = exS[def.id];
    if (!s) { var rr = r.fork('ex:' + def.id); s = exS[def.id] = { theta0: PX.ex.minDifficulty(def) + 1.75 + general + rr.normal(0, 0.5), gain: Math.exp(rr.normal(Math.log(1.8), 0.3)), tau: rr.float(120, 320), n: 0 }; }
    return s;
  }
  function theta(def) { var s = exState(def); return s.theta0 + s.gain * (1 - Math.exp(-s.n / s.tau)); }
  function gainSoFar() { var g = 0, c = 0; Object.keys(exS).forEach(function (id) { var x = exS[id]; g += x.gain * (1 - Math.exp(-x.n / x.tau)); c++; }); return c ? g / c : 0; }
  function probeTheta(def, k) {
    var s = probeS[def.id];
    if (!s) s = probeS[def.id] = { t0: (PX.ex.minDifficulty(def) + PX.ex.maxDifficulty(def)) / 2 + general * 0.7 + r.normal(0, 0.4), tr: def.id === 'wordlinks' ? 0 : 0.6 };
    return s.t0 + s.tr * gainSoFar() + 0.33 * [0, 1, 1.5][Math.min(k, 2)];
  }
  function sig(x) { return 1 / (1 + Math.exp(-x)); }
  var RT = { choice: 6000, multi: 8000, yesno: 3500, angle: 7000, targets: 2500, sequence: 6000 };
  function respond(def, step, k) {
    if (r.chance(0.01)) return { outcome: 'stutter', rt: 900, correct: false };
    var g = def.chance(step.params), th = def.role === 'probe' ? probeTheta(def, k) : theta(def), b = def.difficulty(step.params);
    var ok = r.chance(0.97 * (g + (1 - g) * sig(th - b)) + 0.03 * g);
    var rt = (RT[step.answer || def.answer] || 6000) * Math.exp(0.25 * (b - th)) * Math.exp(r.normal(0, 0.3));
    if (def.role === 'train') exState(def).n += 1;
    var timeout = step.deadlineMs ? rt > step.deadlineMs : false;
    return { correct: ok && !timeout, rt: timeout ? step.deadlineMs : Math.round(rt), timeout: timeout };
  }
  function play(mode, o, at, k) {
    var o2 = { now: at, display: 'large' };
    for (var key in o) if (Object.prototype.hasOwnProperty.call(o, key)) o2[key] = o[key];
    var plan = E.modes.start(rec, mode, o2), t = at, guard = 0;
    if (plan.unavailable) return at;
    for (;;) {
      var step = E.modes.next(plan, rec, t);
      if (step.done || ++guard > 500) break;
      var def = PX.ex.get(step.exId), res = respond(def, step, k || 0);
      t += (res.rt || 0) + 2500;
      E.modes.answer(plan, rec, step, res, t);
      if (E.modes.checkinDue(rec, plan, step.exId, t)) E.modes.checkin(rec, step.exId, r.pick(['whole', 'parts', 'whole', 'unsure']), t);
    }
    E.modes.finish(plan, rec, t);
    return t + 90000;
  }
  var checks = 0;
  for (var d = 0; d < days; d++) {
    var t = T0 + d * DAY + (8 + r.int(0, 10)) * 3600e3 + r.int(0, 59) * 60000;
    if (d < 2 || (d > 2 && E.assess.due(rec, t).due)) t = play('check', {}, t, checks++);
    if (!r.chance((opts.perWeek || 4) / 7)) continue;
    t = play('train', { minutes: opts.minutes || 12 }, t);
    if (r.chance(0.3)) t = play('daily', {}, t);
    if (r.chance(0.25)) t = play('path', { exId: r.pick(['rotate', 'span', 'hidden']), minutes: 6 }, t);
    if (d > 20 && r.chance(0.2)) {
      var sp = ['rotate', 'span', 'hidden'].filter(function (id) { return E.speed.open(rec, PX.ex.get(id), { display: 'large' }).ok; });
      if (sp.length) t = play('speed', { exId: r.pick(sp), minutes: 5 }, t);
    }
    if (d % 6 === 4) t = play('threshold', { protocol: d % 12 === 4 ? 'track-standard' : 'span-length' }, t);
    if (d % 13 === 6) t = play('free', { exId: 'rotate', trials: 10 }, t);
  }
  if (opts.lab) E.lab.enroll(rec, T0 + 2 * DAY);
  rec.settings.lastBackup = now0 - 5 * DAY;
  store.save();
  return { sessions: rec.sessions.length, trials: rec.trials.length, checks: rec.assess.length, mot: Object.keys(rec.mot).filter(function (k) { return rec.mot[k].length; }) };
}'''


def ready(t):
    t.wait_for_function(READY, timeout=20000)
    t.evaluate('document.fonts.ready.then(() => 1)')


def dismiss(page):
    page.keyboard.press('Escape'); page.keyboard.press('Escape')
    page.wait_for_timeout(80)


def go(t, route):
    t.evaluate(f'void PX.core.router.go({json.dumps(route)})')
    t.wait_for_timeout(90)


def route_name(t):
    return t.evaluate('PX.core.router.current().name')


def basics(t, tag, w):
    """h1, no horizontal scroll, 44 px targets."""
    h1 = t.locator('main h1').first.inner_text() if t.locator('main h1').count() else ''
    sw = t.evaluate('document.documentElement.scrollWidth')
    small = t.evaluate(TARGETS_JS)
    C.ok(bool(h1.strip()), f'{tag}: has a heading')
    C.ok(sw <= w, f'{tag}: no horizontal scroll ({sw} > {w})')
    C.ok(not small, f'{tag}: targets ≥ 44 px {small[:4]}')


def new_user_checks(page, tag, w):
    n_train = page.evaluate("PX.ex.list('train').length")
    go(page, 'library')
    cards = page.locator('.px-excard')
    C.ok(cards.count() == n_train, f'{tag}: Library shows every training exercise ({cards.count()} of {n_train})')
    C.ok(page.locator('.px-excard .px-lvl.is-empty').count() == n_train, f'{tag}: no level shown before any practice')
    C.ok('attention practice' in page.locator('.px-excard[data-ex="track"]').inner_text(), f'{tag}: Track labelled attention practice')
    C.ok('experimental' in page.locator('.px-excard[data-ex="homing"]').inner_text(), f'{tag}: Homing labelled experimental')
    probes = page.evaluate("PX.ex.list('probe').map(d => d.id)")
    C.ok(all(page.locator(f'.px-excard[data-ex="{p}"]').count() == 0 for p in probes), f'{tag}: probes are not in the Library')
    basics(page, f'{tag} library', w)
    go(page, 'progress')
    nums = page.evaluate("[...document.querySelectorAll('.px-level-num b, .px-fp-num, .px-curve')].map(e => e.textContent).filter(t => /\\d/.test(t))")
    C.ok(not nums, f'{tag}: Progress shows no numbers before any practice {nums[:3]}')
    C.ok(page.locator('[data-section="check"] [data-status="none"]').count() == 1, f'{tag}: Spatial Check says none yet')
    C.ok(page.locator('.px-prog-start [data-action="check"]').count() == 1, f'{tag}: Progress invites the first baseline')
    C.ok(page.locator('.px-ach-item').count() == page.evaluate('PX.engine.achievements.DEFS.length'), f'{tag}: the full achievement list is shown')
    C.ok(page.locator('.px-ach-item.is-earned').count() == 0, f'{tag}: no achievement earned yet')
    basics(page, f'{tag} progress', w)
    go(page, 'log')
    C.ok(page.locator('.px-log-empty').count() == 1, f'{tag}: Log empty state')
    C.ok(page.locator('[data-action="log-import-text"]').count() == 1, f'{tag}: Log offers import on a new record')
    basics(page, f'{tag} log', w)
    go(page, 'lab')
    C.ok(page.locator('.px-lab-proto').count() == page.evaluate('Object.keys(PX.engine.threshold.PROTOCOLS).length'), f'{tag}: Lab lists every protocol')
    C.ok(page.locator('[data-action="lab-research"]').is_disabled(), f'{tag}: research export waits for trials')
    basics(page, f'{tag} lab', w)
    go(page, 'exercise/fold')
    C.ok(page.locator('[data-section="offscreen"]').count() == 1, f'{tag}: Fold shows its off-screen challenge')
    basics(page, f'{tag} exercise', w)
    go(page, 'exercise/rotate')
    C.ok(page.locator('[data-practise="speed"][aria-disabled="true"]').count() == 1, f'{tag}: Speed is locked before any practice')


def simulate(page, tag, lab=True):
    res = page.evaluate(SIM, {'seed': 7, 'days': 45, 'perWeek': 4, 'minutes': 12, 'lab': lab})
    page.evaluate('void PX.ui.app.rerender()')
    C.ok(res['sessions'] >= 20 and res['trials'] >= 1000 and res['checks'] >= 3, f'{tag}: simulated record built {res}')
    return res


def library_checks(page, tag, w, phone):
    go(page, 'library')
    n_train = page.evaluate("PX.ex.list('train').length")
    with_level = page.locator('.px-excard .px-lvl-row').count()
    C.ok(with_level >= n_train - (2 if phone else 0), f'{tag}: levels with ranges on the cards ({with_level})')
    rot = page.locator('.px-excard[data-ex="rotate"]').inner_text()
    C.ok(re.search(r'\d+\s*\n?\s*\d+–\d+', rot) is not None and 'Handles' in rot, f'{tag}: Rotate card shows level, range and settings')
    if phone:
        C.ok('rated separately by screen size' in page.locator('.px-excard[data-ex="track"]').inner_text(), f'{tag}: Track on a phone says its rating is per screen size')
    basics(page, f'{tag} library', w)
    # practise sheet → the route
    page.click('.px-excard[data-ex="rotate"] [data-card="practise"]')
    page.wait_for_selector('.px-practise-sheet')
    ids = page.evaluate("[...document.querySelectorAll('.px-practise-sheet [data-practise]')].map(b => b.dataset.practise)")
    C.ok(all(x in ids for x in ['train', 'path', 'speed', 'free', 'challenge']), f'{tag}: practise options {ids}')
    page.click('.px-practise-sheet [data-practise="train"]')
    page.wait_for_timeout(100)
    cur = page.evaluate('PX.core.router.current()')
    C.ok(cur['name'] == 'play' and cur['params'].get('mode') == 'train' and cur['params'].get('exId') == 'rotate', f'{tag}: Train with Rotate as focus routes to play {cur}')
    go(page, 'exercise/track')
    C.ok(page.locator('[data-practise="threshold:track-standard"]').count() == 1, f'{tag}: Track offers the Standard protocol')
    page.click('[data-practise="free"]')
    page.wait_for_timeout(100)
    cur = page.evaluate('PX.core.router.current()')
    C.ok(cur['name'] == 'play' and cur['params'].get('mode') == 'free' and cur['params'].get('exId') == 'track', f'{tag}: Free play opens the player setup {cur}')
    # coming soon for a view that is not registered
    page.evaluate("""() => { const o = PX.ex.view; window.__view = o; PX.ex.view = function (id) { if (id === 'fold' && arguments.length < 2) return null; return o.apply(this, arguments); }; }""")
    go(page, 'library')
    page.evaluate('void PX.ui.app.rerender()')
    fold = page.locator('.px-excard[data-ex="fold"]')
    C.ok(fold.get_attribute('data-state') == 'soon' and 'coming soon' in fold.inner_text(), f'{tag}: an unregistered view shows coming soon')
    page.click('.px-excard[data-ex="fold"] [data-card="practise"]')
    page.click('.px-practise-sheet [data-practise="train"]')
    page.wait_for_timeout(100)
    C.ok(page.locator('.px-modal.px-soon').count() == 1 and route_name(page) == 'library', f'{tag}: launching it explains instead of failing')
    page.keyboard.press('Escape')
    page.evaluate('() => { PX.ex.view = window.__view; }')
    page.evaluate('void PX.ui.app.rerender()')
    # keyboard: Tab to a card button and open it with Enter
    page.focus('.px-excard[data-ex="spin"] [data-card="practise"]')
    page.keyboard.press('Enter')
    page.wait_for_timeout(80)
    C.ok(page.locator('.px-practise-sheet').count() == 1, f'{tag}: Practise opens by keyboard')
    page.keyboard.press('Escape')
    page.wait_for_timeout(60)
    C.ok(page.evaluate('PX.ui.modalOpen()') == 0, f'{tag}: Esc closes the sheet')


def exercise_checks(page, tag, w):
    go(page, 'exercise/rotate')
    for s in ['level', 'practise', 'howto', 'strategies', 'bridge', 'settings']:
        C.ok(page.locator(f'[data-section="{s}"]').count() == 1, f'{tag}: exercise page has {s}')
    C.ok(page.locator('.px-strat').count() >= 2, f'{tag}: strategy cards')
    bridge = page.locator('[data-section="bridge"]').inner_text()
    C.ok(re.search(r'not been shown|mostly improves|little or no', bridge) is not None, f'{tag}: the where-used card carries its limitation line')
    page.click('[data-ex-action="howto"]')
    page.wait_for_timeout(120)
    C.ok(page.evaluate('PX.ui.modalOpen()') >= 1 or route_name(page) == 'play', f'{tag}: How to play opens')
    page.keyboard.press('Escape')
    go(page, 'exercise/rotate')
    basics(page, f'{tag} exercise', w)
    go(page, 'exercise/track')
    C.ok('attention practice' in page.locator('.px-ex-note').first.inner_text(), f'{tag}: Track page says attention practice')
    go(page, 'exercise/cubematch')
    C.ok('never trained' in page.locator('main').inner_text(), f'{tag}: a probe has no exercise page')


def challenge_checks(page, tag):
    code = page.evaluate("PX.ui.share.challenge.create({ exId: 'rotate', params: { angle: 2, axis: 1, cubes: 0, variant: 'pick' }, n: 8 }).code")
    d = page.evaluate(f'PX.ui.share.challenge.decode({json.dumps(code)})')
    C.ok(d['ok'] and d['exId'] == 'rotate' and d['n'] == 8 and d['params'] == {'angle': 2, 'axis': 1, 'cubes': 0, 'variant': 'pick'}, f'{tag}: challenge code round trip {code}')
    loose = '  please play ' + code.lower().replace('-', ' - ') + ' thanks'
    d2 = page.evaluate(f'PX.ui.share.challenge.decode({json.dumps(loose)})')
    C.ok(d2['ok'] and d2['code'] == code, f'{tag}: a code pasted in a sentence, in lower case, still reads')
    seeds = page.evaluate(f'[0, 1, 0].map(i => PX.ui.share.challenge.seedAt({json.dumps(code)}, i))')
    C.ok(seeds[0] == seeds[2] and seeds[0] != seeds[1] and min(seeds) >= 2 ** 31, f'{tag}: challenge seeds are fixed and shared-range {seeds}')
    parts = code.split('-')
    bad = parts[3]
    bad = ('Z' if bad[0] != 'Z' else 'Y') + bad[1:]
    typo = '-'.join(parts[:3] + [bad] + parts[4:])
    e = page.evaluate(f'PX.ui.share.challenge.decode({json.dumps(typo)})')
    C.ok(not e['ok'] and 'typo' in e['error'], f'{tag}: a typo is caught {e}')
    go(page, 'library')
    page.fill('.px-challenge-input', 'hello')
    page.click('[data-challenge="play"]')
    C.ok(page.locator('.px-challenge-msg.is-error').count() == 1, f'{tag}: a bad code gets a message')
    page.fill('.px-challenge-input', code)
    page.press('.px-challenge-input', 'Enter')
    page.wait_for_timeout(100)
    cur = page.evaluate('PX.core.router.current()')
    C.ok(cur['name'] == 'play' and cur['params'].get('challenge') == code and cur['params'].get('mode') == 'free' and cur['params'].get('trials') == 8, f'{tag}: Play a challenge routes to the player {cur.get("params")}')


def share_checks(page, tag, shots=False, name=''):
    import base64
    info = page.evaluate("""async () => {
      const a = await PX.ui.share.card({ title: 'Parallax Daily #6', lines: ['7 of 8 right'], footer: '6 Nov 2026', kind: 'daily', label: 'Daily #6', marks: [1, 1, 0, 1, 1, 1, 1, 1] });
      const b = await PX.ui.share.card({ title: 'Rotate, level 54', lines: ['Handles angle 100°, axis picture, 10 cubes.', 'Likely between 34 and 74.'], kind: 'level', size: 'square', ruler: { value: 54, lo: 34, hi: 74 } });
      return { a: [a.width, a.height, a.toDataURL('image/png')], b: [b.width, b.height, b.toDataURL('image/png')] };
    }""")
    for k, size in [('a', (1200, 630)), ('b', (1080, 1080))]:
        png = base64.b64decode(info[k][2].split(',', 1)[1])
        ok, st = non_blank(png)
        C.ok(tuple(info[k][:2]) == size and ok, f'{tag}: share card {size} drawn {st}')
        if shots:
            (OUT / f'card_{k}_{name}.png').write_bytes(png)
    page.evaluate("void PX.ui.share.open({ title: 'Parallax · Train session', lines: ['94 of 110 right', 'Rotate: level 52 → 54, within the usual noise (±6).'], footer: '6 Nov 2026', kind: 'session' })")
    page.wait_for_selector('.px-share-fig[data-ready="1"]', timeout=8000)
    sheet = page.locator('.px-modal.px-share')
    C.ok(sheet.locator('.px-share-img').get_attribute('src').startswith('data:image/png'), f'{tag}: the sheet shows the card')
    text = sheet.locator('.px-copybox-text').input_value()
    C.ok('Built by the Chimera community · discord.gg/chmr' in text and text.startswith('Parallax · Train session'), f'{tag}: the sheet offers the text')
    a = sheet.locator('a[data-chimera="join"]').evaluate('a => [a.getAttribute("href"), a.target, a.rel]')
    C.ok(a[0] == DISCORD and a[1] == '_blank' and 'noopener' in a[2], f'{tag}: Discord link {a}')
    C.ok(sheet.locator('.px-linkcopy-url').input_value() == DISCORD, f'{tag}: Discord address shown with Copy')
    return sheet


def share_sheet_file(page, tag):
    sheet = share_checks(page, tag)
    C.ok(sheet.locator('[data-share="download"]').count() == 1, f'{tag}: Download PNG offered on file://')
    with page.expect_download(timeout=8000) as dl:
        sheet.locator('[data-share="download"]').click()
    C.ok(dl.value.suggested_filename.endswith('.png'), f'{tag}: Download PNG saves a PNG ({dl.value.suggested_filename})')
    sheet.locator('[data-share="copy"]').click()
    page.wait_for_timeout(200)
    st = sheet.locator('.px-copybox-status').inner_text()
    C.ok(st.startswith('Copied') or 'blocked' in st, f'{tag}: Copy text reports ({st})')
    sheet.locator('label:has-text("Square 1080")').click()
    page.wait_for_function('document.querySelector(".px-share-fig").dataset.size === "square" && document.querySelector(".px-share-fig").getAttribute("aria-busy") === "false"', timeout=8000)
    C.ok(page.evaluate('document.querySelector(".px-share-img").naturalWidth') == 1080, f'{tag}: square size redraws the card')
    page.keyboard.press('Escape')


FORBIDDEN = re.compile(r'percentile|brain age|mastered|VSI index', re.I)
WORDS = {'beyond familiarity', 'unclear yet', 'no change'}


def progress_checks(page, tag, w):
    go(page, 'progress')
    status = page.get_attribute('[data-section="check"] .px-panel-body', 'data-status')
    C.ok(status in ('change', 'baseline-done', 'baseline'), f'{tag}: Spatial Check status {status}')
    if status == 'change':
        rows = page.locator('.px-fp-row:not(.px-fp-axisrow)').count()
        C.ok(rows >= 6, f'{tag}: interval rows for the composite, the probes and the control ({rows})')
        words = set(page.evaluate("[...document.querySelectorAll('.px-fp-row .px-fp-verdict:not(.is-control)')].map(e => e.textContent)"))
        C.ok(words and words <= WORDS, f'{tag}: only the three honest words {words}')
        C.ok(page.locator('.px-fp-row.is-composite').count() == 1 and page.locator('.px-fp-row.is-control').count() == 1, f'{tag}: composite and control rows')
        C.ok(page.locator('.px-decide tbody tr').count() >= 4, f'{tag}: why-these-words table')
        C.ok(page.locator('.px-check-table:not(.px-decide) th:has-text("Median time")').count() == 1, f'{tag}: accuracy and time shown separately')
        C.ok('95 % range' in page.locator('.px-fp-row .px-sr').first.inner_text(), f'{tag}: intervals read out for screen readers')
        C.ok(page.locator('.px-near-list li').count() >= 5, f'{tag}: trained exercises since the baseline')
    nums = page.locator('.px-prog-levels .px-level-num b').all_inner_texts()
    C.ok(sum(1 for t in nums if t.strip().isdigit()) >= 9, f'{tag}: levels with numbers ({len(nums)})')
    C.ok(page.locator('.px-prog-levels .px-level-num span').count() >= 9, f'{tag}: every level has its range')
    C.ok(page.locator('.px-abilities .px-level').count() >= 4, f'{tag}: profile by ability')
    C.ok(page.locator('.px-curve svg[role="img"][aria-label]').count() >= 5, f'{tag}: learning curves with text alternatives')
    pairs = page.evaluate('''() => {
      const lv = {};
      document.querySelectorAll('.px-prog-levels .px-level[data-ex]').forEach((li) => {
        const b = li.querySelector('.px-level-num b'), s = li.querySelector('.px-level-num span');
        if (b && s) lv[li.dataset.ex] = b.textContent + ' · ' + s.textContent;
      });
      return [...document.querySelectorAll('.px-curve[data-ex]')].map((f) => [f.dataset.ex, f.querySelector('figcaption .px-num').textContent.replace('level ', ''), lv[f.dataset.ex] || null]);
    }''')
    C.ok(pairs and all(p[1] == p[2] for p in pairs), f'{tag}: curve headings show the level and range of the Levels list {[p for p in pairs if p[1] != p[2]][:3]}')
    if status == 'change' and w < 720:
        shown = page.evaluate("[...document.querySelectorAll('.px-fp-row:not(.px-fp-axisrow) .px-fp-rowaxis')].filter((e) => e.offsetHeight > 0).length")
        C.ok(shown == rows, f'{tag}: on a phone every interval row carries its own scale ({shown} of {rows})')
    C.ok('logit' not in page.locator('main').inner_text().lower(), f'{tag}: no "logits" in the Progress text')
    C.ok(page.locator('.px-cal-rows li').count() >= 6, f'{tag}: weekly goal calendar')
    C.ok(page.locator('.px-ach-item.is-earned').count() >= 3, f'{tag}: achievements earned')
    C.ok(page.locator('.px-bests li').count() >= 1, f'{tag}: personal bests')
    C.ok('never' not in page.locator('[data-section="data"] .px-backup-line').inner_text(), f'{tag}: backup line shows the date')
    txt = page.locator('main').inner_text()
    C.ok(not FORBIDDEN.search(txt) and not re.search(r'\bIQ\b', txt), f'{tag}: no IQ, percentile, brain age or mastered')
    basics(page, f'{tag} progress', w)
    page.click('[data-jump="achievements"]')
    page.wait_for_timeout(200)
    C.ok(page.evaluate("document.activeElement.closest('[data-section]') && document.activeElement.closest('[data-section]').dataset.section") == 'achievements', f'{tag}: section index moves focus')
    go(page, 'progress?ex=rotate')
    page.wait_for_timeout(150)
    C.ok(page.locator('.px-curve').first.get_attribute('data-ex') == 'rotate', f'{tag}: ?ex= puts that curve first')
    # one rule for the next check and the weekly goal: Progress and Today say the same
    nxt = page.locator('.px-check-next b').first.inner_text().strip().rstrip('.')
    goal = page.locator('.px-goal-now').first.inner_text()
    go(page, 'home')
    st = page.locator('.px-slot--check .px-status').inner_text().strip()
    done = page.evaluate("PX.ui.home.weekStatus(PX.core.store.state, Date.now()).sessions")
    C.ok(nxt == st and not re.search(r'\b1 sessions\b|\b1 days\b', nxt), f'{tag}: Today and Progress give the same next check ({st!r} / {nxt!r})')
    C.ok(goal.strip().startswith(str(done)) and page.locator('.px-dial-n').text_content().strip() == str(done), f'{tag}: Today and Progress count the week alike ({done}; {goal!r})')


def log_checks(page, tag, w):
    go(page, 'log')
    n_sess = page.evaluate('PX.core.store.state.sessions.length')
    groups = page.evaluate('PX.ui.log.sessions(PX.core.store.state, PX.ui.log.rows(PX.core.store.state)).length')
    C.ok(groups >= n_sess and page.locator('.px-sessions > li').count() == min(25, groups), f'{tag}: sessions listed, newest first ({groups})')
    first = page.evaluate('(() => { const s = PX.ui.log.sessions(PX.core.store.state, PX.ui.log.rows(PX.core.store.state))[0]; return [s.rows.length, s.start]; })()')
    page.click('.px-sess >> nth=0 >> summary')
    page.wait_for_timeout(100)
    n_rows = page.locator('.px-sess >> nth=0 >> .px-log-table tbody tr').count()
    C.ok(n_rows == first[0] and n_rows > 0, f'{tag}: the first session lists its trials ({n_rows} of {first[0]})')
    marks = page.locator('.px-sess >> nth=0 >> .px-log-out').all_inner_texts()
    C.ok(all(re.match(r'^[✓✗–↷]\s+(right|wrong|not counted|skipped)$', m.strip()) for m in marks), f'{tag}: outcomes as mark and word {marks[:3]}')
    page.select_option('#px-log-ex', 'rotate')
    exs = page.locator('.px-sess-exs').all_inner_texts()
    C.ok(exs and all('Rotate' in x for x in exs), f'{tag}: filter by exercise')
    page.select_option('#px-log-ex', '')
    page.select_option('#px-log-mode', 'check')
    modes = page.locator('.px-sess-mode').all_inner_texts()
    C.ok(modes and all('Spatial Check' in m for m in modes), f'{tag}: filter by mode')
    page.select_option('#px-log-mode', '')
    if groups > 25:
        page.click('[data-action="log-more"]')
        C.ok(page.locator('.px-sessions > li').count() == min(50, groups), f'{tag}: Show more')
    basics(page, f'{tag} log', w)
    page.click('[data-action="log-csv"]')
    page.wait_for_selector('.px-modal.px-export')
    csv = page.locator('.px-modal.px-export .px-copybox-text').input_value()
    lines = re.split(r'\r?\n', csv.strip('\r\n'))  # a textarea's value turns CRLF into LF
    n_trials = page.evaluate('PX.core.store.state.trials.length')
    C.ok(lines[0] == 'time_iso,t_sec,exercise,version,mode,session,params_code,params,seed,outcome,outcome_label,rt_ms,value,p_pred,stage' and len(lines) == n_trials + 1, f'{tag}: CSV export ({len(lines)} lines, {n_trials} trials)')
    rot = [l for l in lines[1:] if ',rotate,' in l][:1]
    C.ok(rot and re.search(r',rotate,1,train,', rot[0]) is not None and 'angle=' in rot[0], f'{tag}: CSV rows carry exercise, version, mode and settings {rot[:1]}')
    page.keyboard.press('Escape')
    # import with undo
    backup = page.evaluate('PX.core.store.exportJSON()')
    page.evaluate('() => { PX.core.store.reset({ keepSettings: true }); PX.ui.app.rerender(); }')
    C.ok(page.locator('.px-log-empty').count() == 1, f'{tag}: reset leaves an empty Log')
    page.evaluate('(t) => { const ta = document.querySelector("[data-action=log-import-text]"); ta.value = t; }', backup)
    page.click('[data-action="log-import-paste"]')
    page.wait_for_timeout(150)
    C.ok(page.evaluate('PX.core.store.state.sessions.length') == n_sess and page.locator('.px-sessions > li').count() > 0, f'{tag}: import restores the sessions')
    C.ok(page.locator('.px-toast:has-text("Backup imported")').count() == 1, f'{tag}: import offers Undo')
    page.click('[data-action="log-undo"]')
    page.wait_for_timeout(150)
    C.ok(page.evaluate('PX.core.store.state.sessions.length') == 0 and page.locator('.px-log-empty').count() == 1, f'{tag}: undo goes back')
    r = page.evaluate('(t) => PX.core.store.importJSON(t).ok', backup)
    page.evaluate('void PX.ui.app.rerender()')
    C.ok(r and page.evaluate('PX.core.store.state.trials.length') == n_trials, f'{tag}: record back for the next checks')


def lab_checks(page, tag, w):
    go(page, 'lab')
    C.ok(page.locator('.px-lab-proto').count() == 4, f'{tag}: four protocols')
    C.ok(page.locator('.px-lab-last').count() >= 1 and page.locator('.px-lab-runs tbody tr').count() >= 1, f'{tag}: protocol history')
    C.ok(page.locator('.px-lab-fig svg[role="img"]').count() >= 1, f'{tag}: staircase charts')
    if page.locator('[data-action="lab-leave"]').count():
        C.ok(page.locator('.px-lab-steps li').count() == 5, f'{tag}: crossover schedule')
        page.click('[data-action="lab-leave"]')
        page.click('.px-modal button:has-text("Leave")')
        page.wait_for_timeout(120)
    page.click('[data-action="lab-join"]')
    page.click('.px-modal button:has-text("Join and draw the order")')
    page.wait_for_timeout(150)
    lab = page.evaluate('PX.core.store.state.lab')
    C.ok(lab['order'] in ('AB', 'BA') and lab['left'] is None and page.locator('.px-lab-steps').count() == 1, f'{tag}: joining draws an order {lab}')
    page.click('[data-action="lab-research"]')
    page.wait_for_selector('.px-modal.px-export')
    head = re.split(r'\r?\n', page.locator('.px-modal.px-export .px-copybox-text').input_value())[0]
    C.ok(head.endswith('p_pred,stage,b,g,answer') and ',version,' in head, f'{tag}: research export columns {head[-40:]}')
    page.keyboard.press('Escape')
    page.click('[data-part="check"] > summary')
    C.ok(page.locator('[data-part="check"] .px-lab-part-body').is_visible(), f'{tag}: engine explainer opens')
    txt = page.locator('main').inner_text()
    C.ok(not FORBIDDEN.search(txt), f'{tag}: Lab wording')
    basics(page, f'{tag} lab', w)


def run_file(b):
    for (w, hgt, phone) in [(1366, 768, False), (412, 880, True)]:
        tag = f'file {w}'
        ctx = b.new_context(viewport={'width': w, 'height': hgt}, permissions=['clipboard-read', 'clipboard-write'], accept_downloads=True,
                            **({'device_scale_factor': 2, 'has_touch': True} if phone else {}))
        page = ctx.new_page()
        logs = attach_console(page)
        page.goto(INDEX.as_uri()); ready(page); dismiss(page)
        new_user_checks(page, tag + ' new', w)
        simulate(page, tag)
        library_checks(page, tag, w, phone)
        exercise_checks(page, tag, w)
        challenge_checks(page, tag)
        share_sheet_file(page, tag)
        progress_checks(page, tag, w)
        log_checks(page, tag, w)
        lab_checks(page, tag, w)
        C.ok(not problems(logs), f'{tag}: no console errors {problems(logs)[:3]}')
        ctx.close()
    ctx = b.new_context(viewport={'width': 360, 'height': 640})
    page = ctx.new_page()
    logs = attach_console(page)
    page.goto(INDEX.as_uri()); ready(page); dismiss(page)
    simulate(page, 'file 360')
    for r in ROUTES + ['exercise/track']:
        go(page, r)
        basics(page, f'file 360 {r}', 360)
    C.ok(not problems(logs), f'file 360: no console errors {problems(logs)[:3]}')
    ctx.close()
    run_phone_text(b)


# Visible text under 13 px (SVG text by its size on the screen); hidden and screen-reader text skipped.
SMALL_TEXT_JS = r'''() => {
  const out = {};
  function shown(el) {
    for (let e = el; e && e.nodeType === 1; e = e.parentElement) {
      const s = getComputedStyle(e);
      if (s.display === 'none' || s.visibility === 'hidden' || s.opacity === '0') return false;
    }
    const r = el.getBoundingClientRect(); return r.width > 0 && r.height > 0;
  }
  const tw = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  for (let n; (n = tw.nextNode());) {
    const t = n.nodeValue.trim(), p = n.parentElement;
    if (!t || !p || p.closest('.px-sr, script, style, [hidden]') || !shown(p)) continue;
    let fs = parseFloat(getComputedStyle(p).fontSize);
    if (!fs) continue;
    if (p.closest('svg') && p.getScreenCTM) { const m = p.getScreenCTM(); if (m) fs *= Math.sqrt(Math.abs(m.a * m.d - m.b * m.c)); }
    if (fs < 12.95) { const k = p.tagName.toLowerCase() + '.' + String(p.getAttribute('class') || '').split(' ')[0] + ' @' + fs.toFixed(1); if (!out[k]) out[k] = t.slice(0, 20); }
  }
  return out;
}'''


def run_phone_text(b):
    """v1.1 phones (PLAN M2, B2): with six weeks of data on a 360 x 640 touch screen, no text under
    13 px on any screen, and no horizontal scroll at 100 % and 150 % text."""
    tag = 'phone 360 data'
    ctx = b.new_context(viewport={'width': 360, 'height': 640}, device_scale_factor=2, is_mobile=True, has_touch=True)
    page = ctx.new_page()
    logs = attach_console(page)
    page.goto(INDEX.as_uri()); ready(page); dismiss(page)
    simulate(page, tag, lab=True)
    for scale in (1, 1.5):
        page.evaluate(f'PX.core.store.state.settings.textScale = {scale}; PX.ui.app.applySettings()')
        for r in ROUTES + ['home', 'settings', 'about', 'exercise/fold']:
            go(page, r)
            page.wait_for_timeout(150)
            sw = page.evaluate('document.documentElement.scrollWidth')
            C.ok(sw <= 360, f'{tag} {int(scale * 100)} %: {r} has no horizontal scroll ({sw})')
            if scale == 1:
                small = page.evaluate(SMALL_TEXT_JS)
                C.ok(not small, f'{tag}: {r} has no text under 13 px {json.dumps(small)[:240]}')
    page.evaluate('PX.core.store.state.settings.textScale = 1; PX.ui.app.applySettings()')
    C.ok(not problems(logs), f'{tag}: no console errors {problems(logs)[:3]}')
    ctx.close()


def run_sandbox(b):
    host = write_host(inline_single(), OUT / 'host.html')
    ctx = b.new_context(viewport={'width': 1366, 'height': 768})
    page = ctx.new_page()
    logs = attach_console(page)
    page.goto(host.as_uri())
    fr = child_frame(page)
    ready(fr)
    fr.evaluate('window.__mark = "boot-1"')
    fr.click('.px-welcome-title')
    dismiss(page)
    tag = 'srcdoc'
    C.ok(fr.evaluate('PX.core.store.volatile') is True, f'{tag}: storage blocked, runs from memory')
    go(fr, 'library')
    C.ok(fr.locator('.px-excard').count() == fr.evaluate("PX.ex.list('train').length"), f'{tag}: Library renders')
    sheet = share_checks(fr, tag)
    C.ok(sheet.locator('[data-share="download"]').count() == 0 and 'Downloads are blocked' in sheet.inner_text(), f'{tag}: share sheet explains blocked downloads')
    page.keyboard.press('Escape')
    simulate(fr, tag)
    for r in ROUTES:
        go(fr, r)
        C.ok(fr.locator('main h1').count() >= 1, f'{tag}: {r} renders')
    code = fr.evaluate("PX.ui.share.challenge.create({ exId: 'span', params: {}, n: 6 }).code")
    go(fr, 'library')
    fr.fill('.px-challenge-input', code)
    fr.click('[data-challenge="play"]')
    fr.wait_for_timeout(100)
    same = page.main_frame.child_frames[0].evaluate('window.__mark') == 'boot-1'
    C.ok(fr.evaluate('PX.core.router.current().name') == 'play' and same, f'{tag}: a challenge starts without leaving the frame')
    C.ok(not problems(logs, ('Blocked opening',)), f'{tag}: no console errors {problems(logs)[:3]}')
    ctx.close()


def run_shots(b):
    shots = []
    for (w, hgt) in [(1366, 768), (412, 880)]:
        for theme in ['light', 'dark']:
            ctx = b.new_context(viewport={'width': w, 'height': hgt}, color_scheme=theme)
            page = ctx.new_page()
            logs = attach_console(page)
            page.goto(INDEX.as_uri()); ready(page); dismiss(page)
            page.add_style_tag(content=FULLPAGE_FIX)
            name = f'{w}x{hgt}_{theme}'
            if theme == 'light':
                for r in ['library', 'progress', 'log', 'lab']:
                    go(page, r); page.wait_for_timeout(100)
                    page.screenshot(path=str(OUT / f'{r}_new_{name}.png'), full_page=True); shots.append(f'{r}_new_{name}.png')
            simulate(page, f'shots {name}')
            for r in ROUTES:
                go(page, r); page.wait_for_timeout(120)
                if r == 'log':
                    page.click('.px-sess >> nth=0 >> summary'); page.wait_for_timeout(80)
                if r == 'lab':
                    page.click('[data-part="check"] > summary')
                label = r.replace('/', '-')
                page.screenshot(path=str(OUT / f'{label}_{name}.png'), full_page=True); shots.append(f'{label}_{name}.png')
            go(page, 'library')
            share_checks(page, f'shots {name}', True, name)
            page.wait_for_timeout(450)  # the dialog's open animation
            page.screenshot(path=str(OUT / f'share_{name}.png')); shots.append(f'share_{name}.png')
            page.keyboard.press('Escape')
            C.ok(not problems(logs), f'shots {name}: no console errors {problems(logs)[:3]}')
            ctx.close()
    return shots


def main():
    with sync_playwright() as p:
        b = p.chromium.launch(headless=True, args=['--use-angle=swiftshader', '--enable-unsafe-swiftshader'])
        run_file(b)
        run_sandbox(b)
        shots = run_shots(b)
        b.close()
    code = C.summary({'screenshots': shots, 'folder': str(OUT)})
    sys.exit(code)


if __name__ == '__main__':
    main()
