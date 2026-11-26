#!/usr/bin/env python3
"""Plateau-breaking in the app (PLAN milestone 3, "the card shows in a longrun"; CONTRACT-v1.2 P and R).

A record gets a long, steady history on Fold: 16 Train sessions on 16 days, 42 rated answers each, on items near
the target at one level, right and wrong spread evenly (a low-discrepancy sequence), so the detector's slope over
the last 640 answers is flat. A bot (PX.debug.answer, 7 of every 10 right on each exercise) then plays a Train
session with Fold pinned and ends it from the pause sheet after 14 answers; the session's end runs the detector. At 1366 x 768
(mouse) and 360 x 640 (touch, DPR 2):
  - no plateau card while an item is on screen (body.px-stim);
  - the summary shows the card ([data-plateau]): the flat level and its range, the change and its reason, the
    trial period's numbers (E.config.plateau.trial), and the Chimera invite (kind plateau) right under it;
  - the record holds the event (CONTRACT-v1.2 P) with shown.summary 1;
  - Today shows the card after the session slot with its progress line;
  - Progress shows the history; the Library's Fold page shows its line;
  - no page or console errors.
Other builders' screen hooks are muted after every load (PX.ui.hooks.mute: only the 'plateau.*' handlers run), so a
measurement offered at a session's start or a comparison round cannot get in the way; the engine hooks all run.
Run: tests/e2e/pwslot.sh python3 tests/e2e/plateau.py [--only desktop,phone]
Report: tests/e2e/out/plateau.json; screenshots in tests/e2e/out/plateau/.
"""
import argparse
import pathlib
import random
import sys

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
from playwright.sync_api import sync_playwright  # noqa: E402
from common import launch, Console, Checks, ROOT, OUT as OUT_ROOT  # noqa: E402

OUT = OUT_ROOT / 'plateau'
OUT.mkdir(parents=True, exist_ok=True)
INDEX = ROOT / 'index.html'
READY = 'document.documentElement.getAttribute("data-px-ready") === "1"'
LAST = '''(() => { const l = __play.last; if (!l || !l.item) return null; return { ex: l.exId, outcome: l.outcome }; })()'''

# A flat history on Fold (see the docstring). Returns what it wrote.
SEED_JS = r'''() => {
  const E = PX.engine, S = PX.core.store, R = S.state, M = E.model, def = PX.ex.get('fold');
  const DAY = 864e5, now = Date.now(), first = now - 17 * DAY;
  const name = 'fold@' + (def.version || 1);
  let exI = R.idx.ex.indexOf(name); if (exI < 0) exI = R.idx.ex.push(name) - 1;
  let mI = R.idx.mode.indexOf('train'); if (mI < 0) mI = R.idx.mode.push('train') - 1;
  const tv = def.trainVariants || def.variants;
  const pool = M.pool(def).filter((c) => !tv || tv.indexOf(c.params.variant) >= 0);
  const theta = M.range(def).min + 2.0, k = M.styleK('balanced');
  const near = pool.filter((c) => Math.abs(M.p(theta, c.b, c.g) - M.target(c.g, k)) < 0.06);
  let n = 0, right = 0, t = first;
  for (let s = 0; s < 16; s++) {
    const st = first + s * DAY + 18 * 3600e3;
    t = st;
    for (let j = 0; j < 42; j++) {
      const c = near[(n * 7) % near.length], p = M.p(theta, c.b, c.g), x = ((n * 0.6180339887498949) % 1) < p ? 1 : 0;
      t += 9000;
      R.trials.push([Math.floor(t / 1000), exI, mI, c.code, 1000000 + n, x, 5200, null, Math.round(1000 * p), 2, 2, 1, null, 2, 0, 1, 2, 0]);
      n += 1; right += x;
    }
    R.sessions.push({ id: 'seed' + s, start: st, end: t + 2000, mode: 'train', trials: 42, right: 0, practiceMs: 380000, exs: ['fold'], ended: 'complete', display: 'large' });
  }
  const e = E.est.exEntry(R, 'fold');
  e.mu = theta; e.sd = 0.25; e.n = n; e.nRight = right; e.last = t;
  R.train.stage.fold = 2;
  S.save();
  if (typeof S.flush === 'function') S.flush();
  return { n, near: near.length, theta };
}'''


MUTE = "PX.ui.hooks && PX.ui.hooks.mute(function (id) { return /^plateau\\./.test(id); })"


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
      PX.core.store.state.ui.seen = PX.core.store.state.ui.seen || {}; PX.core.store.state.ui.seen.motionNotice = Date.now();
      PX.core.store.save();''')


def to_respond(page, ms=30000):
    for _ in range(ms // 100):
        st = page.evaluate('__play.state')
        if st == 'respond':
            return True
        if st == 'paused':
            page.evaluate('__play.resume()')
        if st in ('reveal', 'showme'):
            page.evaluate('PX.debug.fast(false); __play.next()')
        later = page.locator('[data-card="later"]')  # a measurement offered at the session's start (W2-measure): later
        if later.count() and later.first.is_visible():
            later.first.click()
            page.wait_for_timeout(200)
            continue
        card = page.locator('[data-card-box] .px-btn--primary')
        if card.count():
            page.evaluate('PX.debug.fast(false)')
            card.first.click()
        page.wait_for_timeout(100)
    return False


def run_viewport(p, C, name, ctx_opts, rnd):
    b = launch(p)
    ctx = b.new_context(**ctx_opts)
    page = ctx.new_page()
    con = Console(page)
    boot(page)
    seeded = page.evaluate(SEED_JS)
    C.ok(seeded['n'] == 672 and seeded['near'] > 0, f'{name}: a flat history of 672 answers written ({seeded})')
    page.reload()
    page.wait_for_function(READY, timeout=30000)
    page.evaluate(MUTE)
    dismiss(page)
    cfg = page.evaluate('PX.engine.config.plateau')
    hooks = page.evaluate("['summary:panels', 'today:slots', 'today:session', 'item:before', 'exercise:lines', 'progress:panels'].map(function (p) { return PX.ui.hooks.list(p).map(function (h) { return h.id; }); })")
    C.ok(all(any(i.startswith('plateau.') for i in ids) for ids in hooks), f'{name}: the plateau handlers are mounted at all six points ({hooks})')
    page.evaluate('PX.debug.fast(false); void PX.core.router.go("play", { mode: "train", exId: "fold", pin: "fold" }, { force: true })')
    fold, stim_card, per_ex = 0, False, {}
    for i in range(14):
        if not to_respond(page):
            C.ok(False, f'{name}: answer {i + 1} never reached an answer phase ({page.evaluate("__play.state")})')
            break
        if page.evaluate('document.body.classList.contains("px-stim") && !!document.querySelector("[data-plateau]")'):
            stim_card = True
        page.evaluate('PX.debug.fast(true)')
        # RC1 (W2-core): seven right of every ten answers per exercise, wrong at its 3rd, 6th and 9th, so no block of
        # 10 Fold answers reaches the level reference (9 of 10 at 4 options) and makes a personal best, whose invite
        # outranks the plateau's (CONTRACT-v1.2 R): random answers at 75 % did, about one run in four, by chance
        ex_now = page.evaluate('__play.exId') or '?'
        k = per_ex.get(ex_now, 0)
        per_ex[ex_now] = k + 1
        page.evaluate(f'PX.debug.answer({"false" if k % 10 in (2, 5, 8) else "true"})')
        page.wait_for_function('__play.state === "reveal" || __play.state === "showme" || __play.state === "done"', timeout=15000)
        last = page.evaluate(LAST)
        if last and last.get('ex') == 'fold':
            fold += 1
        page.evaluate('PX.debug.fast(false); __play.next()')
    C.ok(not stim_card, f'{name}: no plateau card while an item is on screen')
    C.ok(fold >= 10, f'{name}: {fold} Fold answers in the session (the detector needs 10)')
    to_respond(page)
    page.locator('[data-pause]').first.click()
    page.wait_for_function('__play.state === "paused"', timeout=5000)
    page.locator('[data-end]').click()
    page.wait_for_selector('.pl-summary', timeout=15000)
    page.wait_for_timeout(300)
    card = page.locator('.pl-summary [data-plateau]')
    C.ok(card.count() == 1, f'{name}: the summary shows the plateau card')
    if card.count():
        txt = card.first.inner_text()
        tr = cfg['trial']
        C.ok('has held around level' in txt and 'likely' in txt, f'{name}: the flat level and its range')
        C.ok(f'your next {tr["sessions"]} Fold sessions' in txt and f'at least {tr["answers"]} answers' in txt, f'{name}: the trial period from the config ({txt[:200]!r})')
        nxt = page.locator('.pl-summary [data-plateau] + [data-invite="plateau"]')
        C.ok(nxt.count() == 1, f'{name}: the Chimera invite (plateau) right under the card')
        card.first.scroll_into_view_if_needed()
        page.screenshot(path=str(OUT / f'{name}-summary.png'), full_page=False)
        box = card.first.bounding_box()
        vw = ctx_opts['viewport']['width']
        C.ok(box and box['x'] >= 0 and box['x'] + box['width'] <= vw + 1, f'{name}: the card fits the width ({box})')
    ev = page.evaluate('(() => { const L = PX.core.store.state.plateau.list; return L.length ? L[L.length - 1] : null; })()')
    C.ok(ev and ev['exId'] == 'fold' and ev['kind'] == 'plateau' and ev['shown']['summary'] == 1 and ev['trial']['end'] is None,
         f'{name}: the record holds the event, shown on the summary ({ev and {k: ev[k] for k in ("id", "kind", "change", "row", "drawn")}})')
    for k in ('id', 'exId', 'at', 'kind', 'n', 'sessions', 'days', 'beta', 'se', 'level', 'row', 'reason', 'change', 'detail', 'eligible', 'drawn', 'seed', 'trial', 'verdict', 'shown'):
        if not ev or k not in ev:
            C.ok(False, f'{name}: event field {k}')
    # Today
    page.evaluate('void PX.core.router.go("home", {}, { force: true })')
    page.wait_for_timeout(600)
    dismiss(page)
    t = page.locator('[data-plateau]')
    C.ok(t.count() >= 1, f'{name}: Today shows the plateau card')
    if t.count():
        C.ok('So far: 0 of' in t.first.inner_text() or 'Resting until' in t.first.inner_text(), f'{name}: Today\'s card shows the trial\'s progress')
        t.first.scroll_into_view_if_needed()
        page.screenshot(path=str(OUT / f'{name}-today.png'), full_page=False)
    # Progress and the Library page
    page.evaluate('void PX.core.router.go("progress", {}, { force: true })')
    page.wait_for_timeout(600)
    C.ok(page.locator('[data-plateau-history]').count() == 1, f'{name}: Progress shows the plateau history')
    page.evaluate('void PX.core.router.go("exercise/fold", {}, { force: true })')
    page.wait_for_timeout(600)
    line = page.locator('[data-plateau-line]')
    C.ok(line.count() >= 1 and 'Plateaus:' in line.first.inner_text(), f'{name}: the Fold page shows its plateau line')
    errs = con.errors()
    C.ok(not errs, f'{name}: no page or console errors ({errs[:3]})')
    b.close()


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--only', default='desktop,phone')
    args = ap.parse_args()
    C = Checks('plateau')
    rnd = random.Random(11)
    with sync_playwright() as p:
        if 'desktop' in args.only:
            run_viewport(p, C, 'desktop', {'viewport': {'width': 1366, 'height': 768}}, rnd)
        if 'phone' in args.only:
            run_viewport(p, C, 'phone', {'viewport': {'width': 360, 'height': 640}, 'device_scale_factor': 2, 'is_mobile': True, 'has_touch': True}, rnd)
    return C.summary()


if __name__ == '__main__':
    sys.exit(main())
