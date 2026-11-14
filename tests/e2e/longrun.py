#!/usr/bin/env python3
"""Long live run (PLAN.md §12.4; CLAUDE.md: "a bot playing 300+ trials per mode catches loops
that unit tests miss").

A bot plays the real app (index.html from file://) through its screens (Today, Library, Lab,
Settings, Log, the session cards and summaries) and answers with PX.debug.answer: about 75 %
right after short think times (0.15–0.9 s). Fast mode is switched on only for animations
(reveal, show me, demos and worked examples) and off again before the next item, so stimuli
always play at their real speed (Track's tracking, Span's sequence, Homing's route, Pattern
Memory's exposure). Viewports: 1366 × 768 (mouse) and 412 × 880 (touch, DPR 2).

Per viewport, at least --per trials in each of: Train, Path, Speed (on an exercise the bot first
unlocks by playing), Threshold (Track Standard, Span length, Spin deadline), Free play and the
Daily Challenge; then two complete Spatial Checks. Mixed in: pauses and resumes, emergency
skips, End session from the pause sheet, show me and "Why?" during reveals, strategy cards and
check-ins, a page reload in the middle of a session; and a shorter run inside the sandboxed
srcdoc host (storage blocked).

Asserts: no page or console errors; no stall (every trial ends within 3 × its estMs + 10 s,
where estMs is def.estMs(params) or the engine's default for the answer type, and the screen
never sits 60 s without progress); a summary after every session; the exported record
re-imports cleanly (file:// by download and file input; srcdoc by copy and paste); the record
stays under 2 MB.

Run:    tests/e2e/pwslot.sh python3 tests/e2e/longrun.py [--per 300] [--only desktop,phone,srcdoc]
                                                         [--modes train,path,...] [--seed 1]
Report: tests/e2e/out/longrun.json; screenshots of odd states in tests/e2e/out/longrun/.
"""
import argparse
import json
import pathlib
import random
import sys
import time

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
from playwright.sync_api import sync_playwright  # noqa: E402
from common import launch, Console, Checks, ROOT, OUT as OUT_ROOT  # noqa: E402
from shell_common import inline_single, write_host, child_frame  # noqa: E402

OUT = OUT_ROOT / 'longrun'
OUT.mkdir(parents=True, exist_ok=True)
INDEX = ROOT / 'index.html'
READY = 'document.documentElement.getAttribute("data-px-ready") === "1"'
MODES = ['train', 'path', 'speed', 'threshold', 'free', 'daily', 'check']
PROTOCOLS = ['track-standard', 'span-length', 'spin-deadline']
RIGHT = 0.75            # share of right answers
STALL_S = 60            # no progress for this long is a stall
MAX_RECORD = 2 * 1024 * 1024

# Installed in the page after every (re)load: a compact state snapshot and the answer path.
BOT_JS = r'''() => {
  if (window.__bot) return 'kept';
  const q = (s) => document.querySelector(s);
  const vis = (el) => !!el && !el.closest('[hidden]') && el.getClientRects().length > 0;
  function estOf(P) {
    try {
      const def = P.def, item = P.item;
      let v = def && typeof def.estMs === 'function' ? def.estMs(item.params) : null;
      if (!(v > 0)) { const d = PX.engine.config.session.trialMs; v = d[item.answer || def.answer] || 9000; }
      return v;
    } catch (e) { return 9000; }
  }
  window.__bot = {
    snap() {
      const P = PX.ui.play.current(), r = PX.core.router.current(), rec = PX.core.store.state;
      const card = q('[data-card-box]');
      const sb = q('.pl-feedback:not([hidden]) [data-showme]');
      const nb = q('.ex-track-notice:not([hidden]) .px-btn');
      const ck = q('.pl-note [data-card="start"]');
      const ci = [...document.querySelectorAll('[data-note="checkin"] [data-checkin]')].filter(vis);
      const so = [...document.querySelectorAll('[data-note="strategy"]:not([hidden]) .px-btn')].filter(vis);
      const h1 = [...document.querySelectorAll('h1')].filter(vis)[0];
      const S = window.__play ? __play.session : null;
      return {
        route: r ? r.route : null, rmode: r && r.params ? (r.params.mode || null) : null,
        st: P ? P.state : 'idle', tok: P ? P.token : -1, ex: P ? P.exId : null,
        seed: P && P.item ? P.item.seed : null, last: !!(P && P.last),
        fb: P && P.cfg ? P.cfg.feedback !== false : true, practice: !!(P && P.cfg && P.cfg.practice),
        est: P && P.item ? estOf(P) : null, demo: !!(P && P.played && P.played.started > P.played.finished),
        card: card ? card.getAttribute('data-card-box') : null,
        cards: card ? [...card.querySelectorAll('[data-card]')].map(b => b.getAttribute('data-card')) : [],
        expect: !!q('[data-expect]'),
        summary: !!q('.pl-summary'), daily: !!q('.pl-daily'), sessionCard: !!q('[data-card="session"]'),
        show: sb && vis(sb) ? sb.textContent.trim() : null,
        notice: !!(nb && vis(nb)), checkStart: !!(ck && vis(ck)), checkin: ci.length, strategy: so.length,
        modal: PX.ui.modalOpen(), h1: h1 ? h1.textContent.trim().slice(0, 80) : '',
        rows: rec.trials.length, sessions: rec.sessions.length, checks: (rec.assess || []).length,
        played: P ? P.played.started + '/' + P.played.finished : '', wtg: !!q('[data-wtg]'),
        sess: S ? { answered: S.answered, done: S.done, voidRun: S.voidRun } : null,
        devnotice: !!q('.pl-notice'), volatile: !!PX.core.store.volatile,
      };
    },
    // Fast mode only for what follows an answer (reveal, show me); never while a stimulus plays.
    answer(c) {
      const P = PX.ui.play.current();
      if (!P || P.state !== 'respond') return false;
      if (P.cfg && P.cfg.feedback !== false) PX.debug.fast(true);
      return PX.debug.answer(!!c);
    },
    next() { PX.debug.fast(false); return __play.next(); },
    fast(on) { return PX.debug.fast(!!on); },
    size() {
      let json = -1, ls = -1;
      try { json = JSON.stringify(PX.core.store.state).length; } catch (e) { json = -1; }
      try { const v = localStorage.getItem('parallax.v1'); ls = v ? v.length : 0; } catch (e) { ls = -2; }
      return { json: json, ls: ls };
    },
    health() {
      let heap = null, gl = null;
      try { heap = performance.memory ? Math.round(performance.memory.usedJSHeapSize / 104857.6) / 10 : null; } catch (e) { heap = null; }
      try {
        const S3 = PX.core.stage3d, r = S3 && S3.available() ? S3.renderer() : null;
        if (r && r.info) gl = { geo: r.info.memory.geometries, tex: r.info.memory.textures, progs: r.info.programs ? r.info.programs.length : null };
      } catch (e) { gl = null; }
      return { heapMB: heap, nodes: document.getElementsByTagName('*').length, gl: gl };
    },
    counts(mode) {
      const r = PX.core.store.state, mi = r.idx.mode.indexOf(mode), out = { rows: 0, right: 0, wrong: 0, voided: 0, skipped: 0 };
      if (mi < 0) return out;
      for (const t of r.trials) if (t[2] === mi) { out.rows++; out[['wrong', 'right', 'voided', 'skipped'][t[5]] || 'wrong']++; }
      return out;
    },
  };
  return 'new';
}'''


def now():
    return time.monotonic()


class Stall(Exception):
    pass


class Bot:
    """Plays whatever screen is up, one small step per call of step()."""

    def __init__(self, page, frame, tag, rnd, touch, con, C, rep):
        self.page, self.f, self.tag, self.R, self.touch, self.con, self.C, self.rep = page, frame, tag, rnd, touch, con, C, rep
        self.mode = None
        self.trial = None          # the trial being timed: { tok, t0, est, ex, mode, flagged }
        self.resp = None           # the plan for the current answer phase
        self.rv = None             # the plan for the current reveal
        self.pz = None             # our own pause: { tok, until, skip, end, how }
        self.sig, self.sig_t = None, now()
        self.force_skip = False    # the next answer phase ends with an emergency skip
        self.force_end = False     # the next answer phase ends the session from the pause sheet
        self.force_skip_at = None  # answered count at which force_skip turns on (once)
        self.allow_end = True
        self.stats = {}
        self.errors_seen = 0
        self.shots = 0

    # ---------- page helpers ----------
    def ev(self, js, arg=None):
        return self.f.evaluate(js, arg) if arg is not None else self.f.evaluate(js)

    def install(self):
        # v1.1: Train, Path and Speed are time-boxed on active time; 45 s sessions keep the bot's
        # pace (v1.0 sessions ended on an item count) while still exercising the time box
        self.ev('PX.ui.play && PX.ui.play.config && (PX.ui.play.config.budgetMs = 45000)')
        return self.ev(BOT_JS)

    def snap(self):
        return self.ev('__bot.snap()')

    def st(self, key, n=1):
        m = self.stats.setdefault(self.mode or '-', {})
        m[key] = m.get(key, 0) + n

    def click(self, sel, timeout=6000):
        loc = self.f.locator(sel).first
        if self.touch:
            loc.tap(timeout=timeout)
        else:
            loc.click(timeout=timeout)

    def try_click(self, sel, timeout=4000):
        try:
            self.click(sel, timeout)
            return True
        except Exception as e:  # covered, detached or gone: the next step looks again
            self.note('click failed: %s (%s)' % (sel, str(e).split('\n')[0][:120]))
            return False

    def press(self, key):
        self.page.keyboard.press(key)

    def note(self, msg):
        lst = self.rep.setdefault('notes', [])
        if len(lst) < 200:
            lst.append(f'{self.tag}/{self.mode}: {msg}')

    def shot(self, name, full=False):
        if self.shots >= 40:
            return None
        self.shots += 1
        path = OUT / f'{self.rep.get("run", "longrun")}_{self.tag}_{self.shots:02d}_{name}.png'
        try:
            self.page.screenshot(path=str(path), full_page=full)
        except Exception:
            return None
        self.rep.setdefault('screenshots', []).append(path.name)
        return path.name

    def check_errors(self, where):
        errs = self.con.errors()
        if len(errs) > self.errors_seen:
            new = errs[self.errors_seen:]
            self.errors_seen = len(errs)
            self.rep.setdefault('errors', []).extend(f'{self.tag}/{self.mode} {where}: {e}' for e in new[:10])
            self.shot('error')
            return new
        return []

    def stall(self, msg, s=None):
        self.rep.setdefault('stalls', []).append(f'{self.tag}/{self.mode}: {msg}')
        self.shot('stall')
        self.note('stall: ' + msg + (' state ' + json.dumps(s)[:300] if s else ''))

    # ---------- timing: every trial ends within 3 × estMs + 10 s; the screen keeps moving ----------
    def clock(self, s):
        t, n = self.trial, now()
        active = s['st'] in ('ready', 'present', 'respond', 'paused') and not s['last'] and s['seed'] is not None
        if t and (s['tok'] != t['tok'] or not active):
            dt = n - t['t0']
            bound = 3 * t['est'] / 1000.0 + 10
            tt = self.rep.setdefault('trialTimes', {}).setdefault(self.tag, {}).setdefault(t['mode'] or '-', {'n': 0, 'sum': 0.0, 'max': 0.0, 'maxRatio': 0.0, 'over': 0})
            tt['n'] += 1
            tt['sum'] += dt
            tt['max'] = max(tt['max'], round(dt, 2))
            tt['maxRatio'] = max(tt['maxRatio'], round(dt / bound, 3))
            if dt > bound:
                tt['over'] += 1
                if not t.get('flagged'):
                    self.stall(f'trial {t["ex"]} took {dt:.1f} s (bound {bound:.1f} s)')
            self.trial = t = None
        if active and t is None:
            self.trial = {'tok': s['tok'], 't0': n, 'est': s['est'] or 9000, 'ex': s['ex'], 'mode': self.mode}
        elif t and not t.get('flagged') and n - t['t0'] > 3 * t['est'] / 1000.0 + 10:
            t['flagged'] = True
            self.stall(f'trial {t["ex"]} still running after {n - t["t0"]:.1f} s (state {s["st"]})', s)

    def watchdog(self, s):
        sig = (s['route'], s['st'], s['tok'], s['card'], s['summary'], s['rows'], s['played'], s['modal'], s['show'], s['checkStart'], s['h1'])
        if sig != self.sig:
            self.sig, self.sig_t = sig, now()
            return False
        if now() - self.sig_t > STALL_S:
            self.stall(f'no progress for {STALL_S} s', s)
            self.sig_t = now()
            return True
        return False

    # ---------- one step on whatever is up ----------
    def step(self):
        """Returns 'end' when a session result screen is up, 'off' when no session runs."""
        s = self.snap()
        self.clock(s)
        if self.watchdog(s):
            self.recover(s)
            return None
        if s['modal']:
            self.press('Escape')  # the welcome pop-up after a reload, the keys sheet, strategy cards
            self.st('modals')
            return None
        if s['summary'] or s['daily']:
            return 'end'
        if s['expect']:  # the Spatial Check's expectations question (a card without a primary)
            self.try_click('[data-expect="%d"]' % self.R.randint(1, 5))
            self.st('expect')
            return None
        if s['card']:
            self.on_card(s)
            return None
        if s['checkStart']:
            self.ev('__bot.fast(false)')
            self.try_click('.pl-note [data-card="start"]')
            return None
        if s['notice']:
            self.ev('__bot.fast(false)')
            self.try_click('.ex-track-notice:not([hidden]) .px-btn')
            return None
        st = s['st']
        if st == 'respond':
            self.on_respond(s)
        elif st == 'paused':
            self.on_paused(s)
        elif st == 'reveal':
            self.on_reveal(s)
        elif st == 'showme':
            self.on_showme(s)
        elif st in ('present', 'ready') and not s['demo']:
            self.on_present(s)
        elif st in ('idle', 'done', 'unavailable') and s['route'] != 'play':
            return 'off'
        elif st == 'idle' and s['route'] == 'play':
            if s['sessionCard'] or 'Not available' in s['h1'] or 'Check stopped' in s['h1'] or 'Check ended' in s['h1']:
                return 'end'
        return None

    def recover(self, s):
        st = s['st']
        if st == 'respond':
            self.ev('__bot.answer(true)')
        elif st in ('reveal', 'showme'):
            self.ev('__bot.next()')
        elif st == 'paused':
            self.try_click('[data-resume]')
        else:
            self.press('Escape')

    def on_card(self, s):
        cid, opts = s['card'], s['cards']
        R = self.R.random()
        choice = None
        if cid == 'wtg-offer':
            choice = 'go' if R < 0.35 else 'skip'
        elif cid == 'stage':
            choice = 'watch' if R < 0.5 else 'start'
        elif cid in ('intro', 'check-intro'):
            choice = 'start'
        elif cid == 'probe-intro':
            choice = 'example' if ('example' in opts and R < 0.6) else ('skip' if 'skip' in opts else 'start')
        elif cid == 'baseline':
            choice = 'later'
        elif cid == 'overlap':
            # v1.1: later Spatial Checks ask one question first (check.js askOverlap); its answers are
            # buttons in the card's body, Skip is the card's only action
            ans = ['no', 'little', 'lot'][int(R * 3) % 3]
            self.st('card:overlap:' + ans)
            if R < 0.8 and self.try_click(f'[data-card-box] [data-overlap-answer="{ans}"]'):
                return
            choice = 'skip'
        if choice not in opts:
            choice = None
        demo = choice in ('go', 'watch', 'example')
        self.ev('__bot.fast(%s)' % ('true' if demo else 'false'))  # demos are animations
        self.st('card:' + cid + ':' + str(choice))
        if choice:
            self.try_click(f'[data-card-box] [data-card="{choice}"]')
        else:
            self.try_click('[data-card-box] .px-btn--primary')

    def on_present(self, s):
        # rarely, Esc while the item plays: the player voids it (paused while it played)
        p = self.pz
        if p and p.get('present') and now() >= p['until']:
            # the view took Esc and paused itself (Track's and Homing's moving stimuli): Esc again
            self.pz = None
            self.press('Escape')
            self.st('viewResume')
            return
        if self.mode in ('check', 'daily') or self.pz or s['practice']:
            return
        if self.resp is None or self.resp.get('tok') != s['tok']:
            self.resp = {'tok': s['tok'], 'decided': True, 'at': None}
            if self.R.random() < 0.006:
                self.press('Escape')
                self.st('pausePresent')
                self.pz = {'tok': s['tok'], 'until': now() + self.R.uniform(0.3, 1.2), 'skip': False, 'end': False, 'present': True}

    def on_respond(self, s):
        n = now()
        r = self.resp
        if r is None or r.get('tok') != s['tok'] or r.get('at') is None:
            x = self.R.random()
            act = 'answer'
            if self.force_end and self.allow_end and not s['practice']:
                act, self.force_end = 'end', False
            elif self.force_skip and not s['practice']:
                act, self.force_skip = 'skip', False
            elif x < 0.04:
                act = 'pause'
            elif x < 0.05 and not s['practice']:
                act = 'skip'
            elif x < 0.055:
                act = 'keys'
            elif x < 0.058:
                act = 'more'  # the More sheet over a running item (a modal pauses it)
            r = self.resp = {'tok': s['tok'], 'at': n + self.R.uniform(0.15, 0.9), 'act': act, 'right': self.R.random() < RIGHT, 'tries': 0}
        if n < r['at']:
            return
        act = r['act']
        if act in ('pause', 'skip', 'end'):
            r['act'] = 'answer'
            r['at'] = n + self.R.uniform(0.1, 0.5)
            how = self.R.choice(['key', 'button'])
            if how == 'key':
                self.press('Escape')
            else:
                self.try_click('.pl-player:not([hidden]) [data-pause]')
            self.pz = {'tok': s['tok'], 'until': n + self.R.uniform(0.2, 1.5), 'skip': act == 'skip', 'end': act == 'end'}
            self.st({'pause': 'pauses', 'skip': 'skips', 'end': 'ends'}[act])
            return
        if act == 'keys':
            r['act'] = 'answer'
            self.press('?')
            self.st('keysSheet')
            return
        if act == 'more':
            r['act'] = 'answer'
            if self.f.locator('[data-more]:visible').count() and self.try_click('[data-more]:visible'):
                self.st('moreSheet')
            return
        r['tries'] += 1
        if r['tries'] > 3:
            r['right'] = not r['right']  # no wrong (or right) response exists for this item: the other one
        self.ev('__bot.answer(%s)' % ('true' if r['right'] else 'false'))
        r['at'] = n + 1.0  # if the answer did not land, try again in a second
        self.st('answers')

    def on_paused(self, s):
        p = self.pz
        if p is None:
            self.note('paused without the bot (visibility?)')
            self.try_click('[data-resume]')
            return
        if now() < p['until']:
            return
        self.pz = None
        if p['end']:
            self.try_click('[data-end]')
        elif p['skip']:
            self.try_click('[data-skip]')
        elif self.R.random() < 0.5:
            self.press('Escape')
        else:
            self.try_click('[data-resume]')

    def on_reveal(self, s):
        n = now()
        v = self.rv
        if v is None or v['tok'] != s['tok']:
            show, x = s['show'], self.R.random()
            want = False
            if show:
                if show.startswith('Why'):
                    want = x < 0.5
                elif show.startswith('See solution'):
                    want = x < 0.3
                else:
                    want = x < 0.08
            v = self.rv = {'tok': s['tok'], 'at': n + self.R.uniform(0.05, 0.35), 'show': want, 'clicked': False, 'why': bool(show and show.startswith('Why'))}
            if s['checkin'] and self.R.random() < 0.8:
                self.try_click('[data-note="checkin"] [data-checkin="%s"]' % self.R.choice(['whole', 'parts', 'unsure']))
                self.st('checkins')
            if s['strategy'] and self.R.random() < 0.3:
                self.try_click('[data-note="strategy"] .px-btn')
                self.st('strategyCards')
                return
        if n < v['at']:
            return
        if v['show'] and not v['clicked']:
            v['clicked'] = True
            v['at'] = n + 0.2
            if self.R.random() < 0.5:
                self.press('s')
            else:
                self.try_click('.pl-feedback [data-showme]')
            self.st('why' if v['why'] else 'showMe')
            return
        self.ev('__bot.next()')
        v['at'] = n + 0.8

    def on_showme(self, s):
        v = self.rv
        if v is None or v['tok'] != s['tok']:
            v = self.rv = {'tok': s['tok'], 'at': now() + 0.3, 'show': False, 'clicked': True, 'why': False}
        if 'showT' not in v:
            v['showT'] = now()
            v['cut'] = self.R.random() < 0.25
        el = now() - v['showT']
        if v['cut'] and el > 0.4:  # close it early: Esc or Next
            v['cut'] = False
            if self.R.random() < 0.5:
                self.press('Escape')
            else:
                self.ev('__bot.next()')
            self.st('showMeCut')
        elif el > 25:
            self.stall('show me still playing after 25 s', s)
            self.ev('__bot.next()')

    # ---------- sessions ----------
    def run_session(self, mode, end_after=None, reload_after=None, limit_s=1800):
        """Plays one session (started by the caller) to its result screen."""
        self.mode = mode
        self.resp = self.rv = self.pz = None
        self.trial = None
        for _ in range(80):  # the starter's click lands on the play screen
            if self.ev('PX.core.router.current().name') == 'play':
                break
            self.page.wait_for_timeout(100)
        else:
            self.note('the session screen did not open')
            return {'mode': mode, 'rows': 0, 'sessions': 0, 'checks': 0, 'result': 'nostart', 'h1': '', 'secs': 0}
        s0 = self.snap()
        base = {'rows': s0['rows'], 'sessions': s0['sessions'], 'checks': s0['checks']}
        t0, res = now(), None
        reloaded = None
        self.sig, self.sig_t = None, now()
        while True:
            if now() - t0 > limit_s:
                self.stall(f'session still running after {limit_s} s')
                break
            r = self.step()
            if r == 'end':
                res = 'end'
                break
            if r == 'off':
                res = 'off'
                break
            S = self.snap_sess()
            if S is not None:
                if self.force_skip_at is not None and S['answered'] >= self.force_skip_at:
                    self.force_skip, self.force_skip_at = True, None
                if end_after is not None and S['answered'] >= end_after:
                    self.force_end, end_after = True, None
                if reload_after is not None and S['answered'] >= reload_after and self.f.evaluate('__play.state') == 'respond':
                    reloaded = self.reload_mid_session(mode)
                    reload_after = None
            self.page.wait_for_timeout(50)
        s1 = self.snap()
        out = {'mode': mode, 'rows': s1['rows'] - base['rows'], 'sessions': s1['sessions'] - base['sessions'],
               'checks': s1['checks'] - base['checks'], 'result': res, 'h1': s1['h1'], 'secs': round(now() - t0, 1)}
        if reloaded:
            out['reload'] = reloaded
        m = self.stats.setdefault(mode, {})
        m['sessions'] = m.get('sessions', 0) + 1
        ok = res == 'end'
        if mode == 'check':
            ok = ok and s1['summary'] and 'Check saved' in s1['h1'] and out['checks'] == 1
        elif out['rows'] > 0:
            ok = ok and (s1['summary'] or s1['daily'])
        if not ok:
            self.rep.setdefault('missingSummary', []).append(f'{self.tag}: {json.dumps(out)}')
            self.shot('nosummary_' + mode, full=True)
        m['summaries'] = m.get('summaries', 0) + (1 if ok else 0)
        try:
            hl = self.ev('__bot.health()')
            gl = hl.get('gl') or {}
            self.rep.setdefault('health', {}).setdefault(self.tag, []).append([mode, hl.get('heapMB'), hl.get('nodes'), gl.get('geo'), gl.get('tex'), gl.get('progs')])
        except Exception:
            pass
        self.check_errors('session ' + mode)
        return out

    def snap_sess(self):
        try:
            return self.f.evaluate('window.__play && __play.session && __play.session.answered !== undefined ? __play.session : (PX.ui.check && PX.ui.check.session ? { answered: PX.ui.check.session.answered } : null)')
        except Exception:
            return None

    def reload_mid_session(self, mode):
        """A page reload while an item waits for its answer: what was answered stays saved."""
        before = self.ev('({ rows: PX.core.store.state.trials.length, sessions: PX.core.store.state.sessions.length, answered: __play.session ? __play.session.answered : null })')
        self.shot('before_reload')
        self.page.reload()
        self.page.wait_for_function(READY, timeout=30000)
        self.install()
        for _ in range(6):
            if not self.ev('PX.ui.modalOpen()'):
                break
            self.press('Escape')
            self.page.wait_for_timeout(200)
        after = self.ev('({ rows: PX.core.store.state.trials.length, sessions: PX.core.store.state.sessions.length, route: PX.core.router.current().route, mode: (PX.core.router.current().params || {}).mode || null })')
        self.st('reloads')
        rep = {'before': before, 'after': after}
        self.rep.setdefault('reloads', []).append(f'{self.tag}/{mode}: {json.dumps(rep)}')
        self.C.ok(after['rows'] >= before['rows'], f'{self.tag} {mode}: a reload mid-session keeps every answered trial ({before["rows"]} → {after["rows"]})')
        self.C.ok(after['route'] == 'play' and after['mode'] == mode, f'{self.tag} {mode}: after the reload the app is back on the {mode} screen ({after["route"]}, {after["mode"]})')
        if before['answered']:
            self.C.ok(after['sessions'] == before['sessions'] + 1, f'{self.tag} {mode}: the session cut by the reload is saved ({before["answered"]} answered; sessions {before["sessions"]} → {after["sessions"]})')
        self.shot('after_reload')
        return rep

    # ---------- navigation through the shell ----------
    def nav(self, route):
        sel = f'[data-nav="{route}"]:visible'
        if self.f.locator(sel).count():
            if self.try_click(sel):
                self.page.wait_for_timeout(250)
                return 'ui'
        if self.f.locator('[data-more]:visible').count() and self.try_click('[data-more]:visible'):
            self.page.wait_for_timeout(350)
            sel = f'[data-more-go="{route}"]:visible'
            if self.f.locator(sel).count() and self.try_click(sel):
                self.page.wait_for_timeout(250)
                return 'ui'
            self.press('Escape')
        self.ev(f'void PX.core.router.go({json.dumps(route)})')
        self.st('navFallback')
        self.page.wait_for_timeout(250)
        return 'router'

    def open_exercise(self, exId):
        self.nav('library')
        sel = f'[data-go="exercise/{exId}"]:visible'
        if not (self.f.locator(sel).count() and self.try_click(sel)):
            self.ev(f'void PX.core.router.go("exercise/{exId}")')
            self.st('navFallback')
        self.page.wait_for_timeout(300)

    def practise(self, exId, what):
        """Library → the exercise → Practise → `what` (path, speed, free, threshold:<id>)."""
        self.open_exercise(exId)
        sel = f'[data-section="practise"] [data-practise="{what}"]'
        if self.f.locator(sel).count() == 0:
            self.note(f'no practise option {what} for {exId}')
            return False
        if self.f.locator(sel).first.get_attribute('aria-disabled') == 'true':
            self.note(f'practise option {what} for {exId} is not open')
            return False
        self.f.locator(sel).first.scroll_into_view_if_needed()
        ok = self.try_click(sel)
        self.page.wait_for_timeout(250)
        return ok

    def again(self):
        """The summary's Again / Another session / Play again for practice."""
        sel = '[data-again]:visible'
        if self.f.locator(sel).count():
            self.f.locator(sel).first.scroll_into_view_if_needed()
            if self.try_click(sel):
                self.page.wait_for_timeout(250)
                return True
        return False

    def ready_exercises(self):
        self.nav('library')
        self.page.wait_for_timeout(200)
        return self.ev('[...document.querySelectorAll("article.px-excard[data-state=ready]")].map(a => a.getAttribute("data-ex"))')

    def counts(self, mode):
        return self.ev(f'__bot.counts({json.dumps(mode)})')

    def answered(self, mode):
        c = self.counts(mode)
        return c['right'] + c['wrong']

    # ---------- starting each mode through the UI ----------
    def today(self, mode):
        self.nav('home')
        sel = f'[data-go="play?mode={mode}"]:visible'
        if self.f.locator(sel).count():
            self.f.locator(sel).first.scroll_into_view_if_needed()
            if self.try_click(sel):
                self.page.wait_for_timeout(250)
                return True
        self.ev(f'void PX.core.router.go("play", {{ mode: "{mode}" }}, {{ force: true }})')
        self.st('navFallback')
        return True

    def free_setup(self):
        R, f = self.R, self.f
        f.wait_for_selector('.pl-free', timeout=8000)
        if R.random() < 0.5:
            self.try_click('[data-setting="free-mode"] label:has-text("Fixed settings")')
            self.page.wait_for_timeout(150)
            for i in range(f.locator('.pl-free-dims select').count()):
                sel = f.locator('.pl-free-dims select').nth(i)
                n = sel.locator('option').count()
                # the easier two thirds of each setting: fixed hard settings would make every item hard
                sel.select_option(index=R.randint(0, max(0, (2 * n) // 3 - 1)))
            self.st('freeFixed')
        timer = R.choice(['Off', 'Off', '10 s', '20 s', '30 s'])
        self.try_click(f'[data-setting="free-timer"] label:has-text("{timer}")')
        items = R.choice(['10 items', '20 items', '30 items'])
        self.try_click(f'[data-setting="free-items"] label:has-text("{items}")')
        self.ev('__bot.fast(false)')
        return self.try_click('[data-free-start]')

    def speed_open(self):
        return self.ev('''(() => { const r = PX.core.store.state, disp = PX.engine.est.displayClass(innerWidth, innerHeight);
          return PX.ex.list('train').filter(d => PX.ui.play.canRun(d, true)).map(d => {
            let o = { ok: false }; try { o = PX.engine.speed.open(r, d, { display: disp }); } catch (e) { o = { ok: false, why: String(e) }; }
            return [d.id, !!o.ok, o.why || '']; }); })()''')

    def drive(self, mode, per, starter, skip_first=True, reload_at=None, end_share=0.3, max_sessions=400):
        """Sessions of `mode` until `per` answered trials (right or wrong) are logged in it."""
        n0, k, outs, fails = self.answered(mode), 0, [], 0
        t0 = now()
        while self.answered(mode) - n0 < per and k < max_sessions and fails < 6:
            self.ev('__bot.fast(false)')
            if not starter(k):
                self.note(f'session {k} did not start')
                self.nav('home')
                k += 1
                fails += 1
                continue
            end_after = None
            if mode not in ('check', 'daily') and self.R.random() < end_share:
                end_after = self.R.randint(8, 40)
            if skip_first and k == 0:
                self.force_skip_at = 3
            out = self.run_session(mode, end_after=end_after, reload_after=reload_at if k == 1 else None)
            outs.append(out)
            k += 1
            fails = fails + 1 if out['result'] == 'nostart' or out['rows'] == 0 else 0
            if out['result'] != 'end':
                self.nav('home')
        c = self.counts(mode)
        c.update({'sessions': len(outs), 'answered': c['right'] + c['wrong'] - n0, 'minutes': round((now() - t0) / 60, 1)})
        self.rep.setdefault('modes', {}).setdefault(self.tag, {})[mode] = c
        self.C.ok(c['answered'] >= per, f'{self.tag} {mode}: at least {per} answered trials ({c["answered"]} in {len(outs)} sessions)')
        return outs

    # ---------- export, import ----------
    DEEP_EQ = '''([a, b]) => {
      const strip = (x) => { x = JSON.parse(x); delete x.rev; delete x.updated; return x; };
      const eq = (x, y) => {
        if (x === y) return true;
        if (typeof x !== typeof y || x === null || y === null || typeof x !== 'object') return Number.isNaN(x) && Number.isNaN(y);
        if (Array.isArray(x) !== Array.isArray(y)) return false;
        const kx = Object.keys(x), ky = Object.keys(y);
        if (kx.length !== ky.length) return false;
        return kx.every(k => Object.prototype.hasOwnProperty.call(y, k) && eq(x[k], y[k]));
      };
      return eq(strip(a), strip(b));
    }'''

    def export_import(self, sandboxed):
        self.mode = 'export'
        self.nav('log')
        self.page.wait_for_timeout(300)
        self.try_click('[data-action="log-backup"]')
        self.page.wait_for_timeout(500)
        text, path = None, None
        if not sandboxed:
            with self.page.expect_download(timeout=20000) as dl:
                self.try_click('.px-modal [data-download]')
            path = dl.value.path()
            text = pathlib.Path(path).read_text(encoding='utf-8')
        else:
            text = self.f.locator('.px-modal textarea, .px-modal .px-copybox-text').first.input_value()
        self.press('Escape')
        self.page.wait_for_timeout(300)
        size = len(text.encode('utf-8'))
        rows = len(json.loads(text).get('trials', []))
        if sandboxed:
            self.f.locator('[data-action="log-import-text"]').fill(text)
            self.try_click('[data-action="log-import-paste"]')
        else:
            self.f.locator('[data-action="log-import-file"]').set_input_files(path)
        self.page.wait_for_timeout(1200)
        body = self.ev('document.body.innerText')
        same = self.ev(self.DEEP_EQ, [text, self.ev('PX.core.store.exportJSON()')])
        msg = 'Backup imported.' in body
        repaired = 'repaired or left out' in body
        self.C.ok(msg and not repaired, f'{self.tag}: the exported record re-imports cleanly (imported {msg}, repairs {repaired})')
        self.C.ok(same, f'{self.tag}: the re-imported record equals the export ({rows} trials, {size} bytes)')
        self.C.ok(size < MAX_RECORD, f'{self.tag}: the record stays under 2 MB ({size} bytes)')
        self.rep.setdefault('export', {})[self.tag] = {'bytes': size, 'trials': rows, 'imported': msg, 'repairs': repaired, 'same': same}
        self.shot('log_after_import', full=False)
        self.check_errors('export/import')
        return size


def boot(page, bot, url=None):
    page.goto(url or INDEX.as_uri())
    page.wait_for_function(READY, timeout=30000)
    bot.install()
    for _ in range(6):  # the Chimera pop-up, then the first-run offer (Skip)
        if not bot.ev('PX.ui.modalOpen()'):
            break
        page.keyboard.press('Escape')
        page.wait_for_timeout(250)


def unlock_speed(bot, rnd):
    """Speed opens once a Path stage passes or after 60 settled answers: play Path until it does."""
    for i in range(12):
        open_ = [x[0] for x in bot.speed_open() if x[1]]
        if open_:
            return open_
        best = bot.ev('''(() => { const r = PX.core.store.state; let b = null, n = -1;
          PX.ex.list('train').forEach(d => { const e = r.ex[d.id]; const k = e && e.n ? e.n : 0; if (PX.ui.play.canRun(d, true) && d.id !== 'track' && d.id !== 'homing' && k > n) { n = k; b = d.id; } }); return b; })()''')
        bot.note(f'Speed still locked; one more Path session on {best}')
        if bot.practise(best, 'path'):
            bot.run_session('path')
    return [x[0] for x in bot.speed_open() if x[1]]


def run_viewport(b, C, rep, name, args):
    rnd = random.Random(f'{args.seed}-{name}')
    if name == 'desktop':
        ctx = b.new_context(viewport={'width': 1366, 'height': 768}, accept_downloads=True)
        touch = False
    else:
        ctx = b.new_context(viewport={'width': 412, 'height': 880}, device_scale_factor=2, is_mobile=True, has_touch=True, accept_downloads=True)
        touch = True
    page = ctx.new_page()
    con = Console(page)
    bot = Bot(page, page.main_frame, name, rnd, touch, con, C, rep)
    t0 = now()
    boot(page, bot)
    bot.nav('settings')
    bot.try_click('[data-setting="sessionMin"] label:has-text("10")')  # the shortest the screen offers
    per = args.per
    locked = [x[0] for x in bot.speed_open() if x[1]]
    C.ok(not locked, f'{name}: Speed is locked for every exercise at the start (open: {locked})')
    exs = bot.ready_exercises()
    rep.setdefault('exercises', {})[name] = exs
    sizes = {}
    for mode in args.modes:
        bot.mode = mode
        tm = now()
        if mode == 'train':
            bot.drive('train', per, lambda k: (k > 0 and rnd.random() < 0.7 and bot.again()) or bot.today('train'), reload_at=6)
        elif mode == 'path':
            def start_path(k):
                if k > 0 and rnd.random() < 0.4 and bot.again():
                    return True
                return bot.practise(exs[k % len(exs)], 'path')
            bot.drive('path', per, start_path, reload_at=5)
        elif mode == 'speed':
            opened = unlock_speed(bot, rnd)
            rep.setdefault('speedOpen', {})[name] = opened
            C.ok(bool(opened), f'{name}: play unlocked Speed for an exercise ({opened})')
            if opened:
                pick = [x for x in opened if x not in ('track', 'homing')] or opened

                def start_speed(k):
                    if k > 0 and rnd.random() < 0.6 and bot.again():
                        return True
                    return bot.practise(pick[k % len(pick)], 'speed')
                bot.drive('speed', per, start_speed)
        elif mode == 'threshold':
            def start_thr(k):
                # two Track Standard runs (20 real-speed trials each), then Span length and Spin deadline
                pid = PROTOCOLS[k % 3] if k < 6 else PROTOCOLS[1 + k % 2]
                bot.nav('lab')
                sel = f'[data-protocol="{pid}"]'
                if not bot.f.locator(sel).count():
                    return False
                bot.f.locator(sel).first.scroll_into_view_if_needed()
                return bot.try_click(sel)
            bot.drive('threshold', per, start_thr, end_share=0.05)
            rep.setdefault('thresholdRuns', {})[name] = bot.ev('Object.fromEntries(Object.entries(PX.core.store.state.mot || {}).map(([k, v]) => [k, Array.isArray(v) ? v.length : 0]))')
        elif mode == 'free':
            def start_free(k):
                if k > 0 and rnd.random() < 0.3 and bot.again():
                    return True
                if not bot.practise(exs[(k * 5) % len(exs)], 'free'):
                    return False
                return bot.free_setup()
            bot.drive('free', per, start_free)
        elif mode == 'daily':
            bot.drive('daily', per, lambda k: (k > 0 and bot.again()) or bot.today('daily'), end_share=0)
            rep.setdefault('daily', {})[name] = bot.ev('PX.core.store.state.daily')
        elif mode == 'check':
            bot.allow_end = False
            done = 0
            for i in range(4):
                if done >= 2:
                    break
                bot.today('check')
                out = bot.run_session('check')
                done += 1 if out['checks'] == 1 else 0
            bot.allow_end = True
            kinds = bot.ev('(PX.core.store.state.assess || []).map(a => a.kind)')
            rep.setdefault('checks', {})[name] = kinds
            C.ok(done >= 2, f'{name}: two complete Spatial Checks ({kinds})')
        sizes[mode] = bot.ev('__bot.size()')
        bot.shot('end_' + mode, full=True)
        print(f'  {name} {mode}: {json.dumps(rep.get("modes", {}).get(name, {}).get(mode, {}))} in {(now() - tm) / 60:.1f} min', flush=True)
    rep.setdefault('recordSize', {})[name] = sizes
    bot.export_import(False)
    hl = rep.get('health', {}).get(name, [])
    if hl:
        first, last = hl[0], hl[-1]
        C.ok((last[3] or 0) < 1500 and (last[4] or 0) < 300, f'{name}: WebGL geometries and textures stay bounded ({first[3:5]} → {last[3:5]})')
        C.ok((last[2] or 0) < 20000, f'{name}: DOM nodes stay bounded ({first[2]} → {last[2]})')
    rep.setdefault('stats', {})[name] = bot.stats
    rep.setdefault('minutes', {})[name] = round((now() - t0) / 60, 1)
    errs = con.errors()
    C.ok(not errs, f'{name}: no page or console errors ({len(errs)}: {errs[:3]})')
    ctx.close()


def run_srcdoc(b, C, rep, args):
    """A shorter run inside the sandboxed srcdoc host: storage blocked, downloads blocked."""
    name = 'srcdoc'
    rnd = random.Random(f'{args.seed}-{name}')
    host = write_host(inline_single(), OUT / 'host.html')
    ctx = b.new_context(viewport={'width': 1366, 'height': 768})
    page = ctx.new_page()
    con = Console(page)
    page.goto(host.as_uri())
    fr = child_frame(page)
    fr.wait_for_function(READY, timeout=30000)
    fr.evaluate('window.__bootMark = "b1"')
    bot = Bot(page, fr, name, rnd, False, con, C, rep)
    bot.install()
    for _ in range(6):
        if not bot.ev('PX.ui.modalOpen()'):
            break
        page.keyboard.press('Escape')
        page.wait_for_timeout(250)
    C.ok(bot.ev('PX.core.store.volatile') is True, f'{name}: storage blocked, the record lives in memory')
    per = max(20, args.per // 6)
    bot.drive('train', per, lambda k: (k > 0 and bot.again()) or bot.today('train'))
    bot.drive('daily', 8, lambda k: (k > 0 and bot.again()) or bot.today('daily'), end_share=0)
    exs = bot.ready_exercises()

    def start_free(k):
        return bot.practise(exs[k % len(exs)], 'free') and bot.free_setup()
    bot.drive('free', 10, start_free)
    bot.export_import(True)
    f2 = page.main_frame.child_frames[0]
    C.ok(f2.url.startswith('about:srcdoc') and f2.evaluate('window.__bootMark') == 'b1', f'{name}: the frame never navigated away')
    rep.setdefault('stats', {})[name] = bot.stats
    errs = con.errors()
    C.ok(not errs, f'{name}: no page or console errors ({len(errs)}: {errs[:3]})')
    ctx.close()


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--per', type=int, default=300, help='answered trials per mode and viewport')
    ap.add_argument('--only', default='desktop,phone,srcdoc')
    ap.add_argument('--modes', default=','.join(MODES))
    ap.add_argument('--seed', default='1')
    ap.add_argument('--report', default='longrun', help='report name: tests/e2e/out/<report>.json (runs over 2 h go in chunks)')
    args = ap.parse_args()
    args.modes = [m for m in args.modes.split(',') if m in MODES]
    C = Checks(args.report)
    rep = {'per': args.per, 'modes': {}, 'run': args.report, 'only': args.only, 'modesRun': args.modes}
    t0 = now()
    with sync_playwright() as p:
        b = launch(p)
        for name in args.only.split(','):
            try:
                if name == 'srcdoc':
                    run_srcdoc(b, C, rep, args)
                elif name in ('desktop', 'phone'):
                    run_viewport(b, C, rep, name, args)
            except Exception as e:
                C.ok(False, f'{name} crashed: {str(e)[:400]}')
            finally:
                (OUT_ROOT / f'{args.report}_partial.json').write_text(json.dumps(rep, indent=1, default=str))
        b.close()
    for k in ('stalls', 'missingSummary', 'errors'):
        C.ok(not rep.get(k), f'no {k}: {rep.get(k, [])[:4]}')
    for tag, per_mode in rep.get('trialTimes', {}).items():
        for mode, tt in per_mode.items():
            tt['mean'] = round(tt['sum'] / max(1, tt['n']), 2)
            del tt['sum']
    rep['minutesTotal'] = round((now() - t0) / 60, 1)
    sys.exit(C.summary(rep))


if __name__ == '__main__':
    main()
