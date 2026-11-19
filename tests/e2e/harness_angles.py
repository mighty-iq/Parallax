"""E2E: the dev harness with Angles (EX-16, SVG). Shared flow in tests/e2e/pat_harness.py.
Run:  tests/e2e/pwslot.sh python3 tests/e2e/harness_angles.py
Own checks: four cells numbered 1–4, each drawing exactly the item's endpoints; options read as
lists of the four numbers, lettered A–D (the format's labelling; keys A–D and 1–4); each cell is a
white plate in both themes; reveal shows every angle's size; each number in a strip under its
drawing, in one place in every cell and item, Try 1's mark a ring round it, the sizes beside it, off the
drawing, and the reveal moving nothing (strip_checks, at 360 × 640, 390 × 844 and 1366 × 768);
show me ends on the cells with the sizes in view and no answer crossed out. The v1.2 starter band
(tests/e2e/band_a.py): 9° items at 360 × 640, Try 1 with the smallest angle marked and the
answers that do not start with it greyed, the rules card. Screenshots: tests/e2e/out/angles/. """
import sys

from playwright.sync_api import sync_playwright

from band_a import band_checks, reveal_stable, wtg_checks
from common import launch
from pat_harness import Pat


def stem(C, page, tag):
    d = page.evaluate("""() => {
        const it = __harness.item, cells = Array.from(document.querySelectorAll('.ex-angles-cells .ex-angles-cell'));
        const close = (a, b) => Math.abs(a - b) < 1e-4;
        const drawn = cells.map((c, i) => {
            const nums = (c.querySelector('.ex-angles-arms').getAttribute('d').match(/-?[0-9.e-]+/g) || []).map(Number);
            const g = it.angles[i];
            return nums.length === 6 && close(nums[0], g.a[0]) && close(nums[1], g.a[1]) && close(nums[2], g.v[0]) && close(nums[3], g.v[1]) && close(nums[4], g.b[0]) && close(nums[5], g.b[1]);
        });
        const box = cells.map((c) => c.getBoundingClientRect().width);
        return { n: cells.length, labels: cells.map((c) => c.querySelector('.ex-angles-n').textContent), drawn, minCell: Math.round(Math.min(...box)) };
    }""")
    C.ok(d['n'] == 4 and d['labels'] == ['1', '2', '3', '4'], f'{tag}: four cells numbered 1–4 ({d["labels"]})')
    bg = page.evaluate("() => Array.from(document.querySelectorAll('.ex-angles-cell')).map((c) => getComputedStyle(c).backgroundColor)")
    C.ok(all(x in ('rgb(255, 255, 255)', 'rgba(255, 255, 255, 1)') for x in bg), f'{tag}: every cell is a white plate ({bg[:1]})')
    C.ok(all(d['drawn']), f'{tag}: every cell draws exactly the item\'s vertex and arm ends ({d["drawn"]})')
    C.ok(d['minCell'] >= 150, f'{tag}: cells at least 150 px wide ({d["minCell"]} px)')


def options(C, page, tag):
    d = page.evaluate("""() => ({ texts: Array.from(document.querySelectorAll('.hx-grid .ex-angles-opt .ex-answer-text')).map((e) => e.textContent.replace(/\u00a0/g, ' ')),
        want: __harness.item.options.map((o) => o.map((c) => String(c + 1)).join(' – ')),
        keys: Array.from(document.querySelectorAll('.hx-grid .px-choice .px-choice-key')).map((e) => e.textContent),
        aria: Array.from(document.querySelectorAll('.hx-grid .px-choice')).map((b) => b.getAttribute('aria-label') || '') })""")
    C.ok(d['texts'] == d['want'], f'{tag}: the options read as the item\'s orderings of the angles\' numbers ({d["texts"]})')
    C.ok(d['keys'] == ['A', 'B', 'C', 'D'] and all(a.startswith('Option ' + k + ':') for a, k in zip(d['aria'], 'ABCD')), f'{tag}: the options are lettered A–D, named so for screen readers ({d["keys"]}, {d["aria"][:1]})')


def showme(C, frame, tag):
    d = frame.evaluate("""() => Array.from(document.querySelectorAll('.ex-angles-size')).map((e) => e.hidden ? '' : e.textContent)""")
    C.ok(len(d) == 4 and all(x.endswith('°') for x in d), f'{tag}: show me leaves every angle\'s size in view ({d})')
    out = frame.evaluate("() => document.querySelectorAll('.px-choice.ex-angles-out').length")
    C.ok(out == 0, f'{tag}: show me leaves no answer crossed out ({out})')


def assist(C, page, tag):
    d = page.evaluate("""() => {
        const it = __harness.item, small = it.order[0], cells = Array.from(document.querySelectorAll('.ex-angles-cell'));
        const out = Array.from(document.querySelectorAll('.hx-grid .px-choice')).map((b) => b.classList.contains('ex-angles-out'));
        return { marked: cells.map((c) => c.classList.contains('is-assist')), small, flag: !!cells[small].querySelector('.ex-angles-flag'),
                 out, want: it.options.map((o) => o[0] !== small) };
    }""")
    marked_ok = d['marked'][d['small']] and sum(d['marked']) == 1 and d['flag']
    C.ok(marked_ok and d['out'] == d['want'], f'{tag}: the smallest angle marked, the answers that do not start with it greyed ({d})')


# Lead's fresh-player run (19 Nov): labels sat on the drawings and the numbers moved between corners.
# Each number now sits in a strip under its drawing; the strip also holds Try 1's flag and the size.
GEOM = """() => Array.from(document.querySelectorAll('.ex-angles-cells .ex-angles-cell')).map((c) => {
    const r = (e) => { if (!e || e.hidden) return null; const b = e.getBoundingClientRect(); return [b.left + scrollX, b.top + scrollY, b.right + scrollX, b.bottom + scrollY].map((x) => Math.round(x * 10) / 10); };
    const cell = r(c), svg = r(c.querySelector('svg')), num = r(c.querySelector('.ex-angles-n'));
    const flag = r(c.querySelector('.ex-angles-flag')), size = r(c.querySelector('.ex-angles-size'));
    return { cell, svg, num, flag, size, off: num && cell ? [Math.round((num[0] + num[2]) / 2 - cell[0]), Math.round(num[1] - cell[1])] : null, w: cell ? cell[2] - cell[0] : 0 };
})"""


def strip_checks(b, cons, C, out_dir):
    from band_a import PHONE
    from common import Console, file_url
    items = [('gap:0,size:0,resolve:0,pose:0', 16), ('gap:1,size:0,resolve:0,pose:0', 6), ('gap:2,size:1,resolve:2,pose:1', 9), ('gap:4,size:2,resolve:1,pose:1', 21)]
    for w, hgt in ((360, 640), (390, 844), (1366, 768)):
        phone = w < 720
        ctx = b.new_context(viewport={'width': w, 'height': hgt}, **(PHONE if phone else {}))
        page = ctx.new_page()
        cons.append(Console(page))
        offs = []
        for k, (params, seed) in enumerate(items):
            tag = f'angles labels at {w}×{hgt}, item {k + 1}'
            page.goto(file_url('tests/dev/harness.html', ex='angles', seed=seed, p=params, fast=1, **({'assist': '1'} if k == 0 else {})))
            page.wait_for_function("() => window.__harness && __harness.state === 'respond'", timeout=60000)
            g = page.evaluate(GEOM)
            below = all(c['num'][1] >= c['svg'][3] - 0.5 and c['num'][3] <= c['cell'][3] + 0.5 for c in g)
            C.ok(len(g) == 4 and below, f'{tag}: every number sits under its drawing, inside its cell ({[(c["svg"][3], c["num"][1]) for c in g]})')
            same = all(abs(c['off'][0] - c['w'] / 2) <= 1.5 and abs(c['off'][1] - g[0]['off'][1]) <= 1 for c in g)
            C.ok(same, f'{tag}: every number in the same place in its cell, centred under the drawing ({[c["off"] for c in g]})')
            offs.append(g[0]['off'][1])
            if k == 0:
                fl = [c for c in g if c['flag']]
                mid = lambda r: ((r[0] + r[2]) / 2, (r[1] + r[3]) / 2)
                ok = len(fl) == 1 and fl[0]['flag'][1] >= fl[0]['svg'][3] - 0.5 and fl[0]['flag'][3] <= fl[0]['cell'][3] + 0.5 and all(abs(a - z) <= 1.5 for a, z in zip(mid(fl[0]['flag']), mid(fl[0]['num'])))
                C.ok(ok, f'{tag}: Try 1\'s mark rings the number, in the strip, off the drawing ({[(c["flag"], c["num"]) for c in fl]})')
            key = page.evaluate('() => __harness.key')
            page.locator('.hx-grid .px-choice').nth((key + k) % 4).tap() if phone else page.locator('.hx-grid .px-choice').nth((key + k) % 4).click()
            page.wait_for_function("() => __harness.state === 'reveal' || __harness.state === 'done'", timeout=10000)
            page.wait_for_timeout(150)
            a = page.evaluate(GEOM)
            sizes_ok = all(c['size'] and c['size'][1] >= c['svg'][3] - 0.5 and c['size'][3] <= c['cell'][3] + 0.5 and c['size'][2] <= c['cell'][2] + 0.5 and (c['size'][0] >= c['num'][2] + 2) for c in a)
            C.ok(sizes_ok, f'{tag}: after the answer every size sits in its strip, right of the number, off the drawing ({[c["size"] for c in a][:2]})')
            moved = [i for i, (x, y) in enumerate(zip(g, a)) if any(abs(p - q) > 0.6 for k in ('svg', 'num', 'cell') for p, q in zip(x[k], y[k]))]
            C.ok(not moved, f'{tag}: the reveal moves no drawing, number or cell (page coordinates; moved: {moved})')
            if k == 2:
                page.locator('.ex-angles-stem').screenshot(path=str(out_dir / f'angles_strip_{w}x{hgt}.png'))
        C.ok(max(offs) - min(offs) <= 1, f'angles labels at {w}×{hgt}: the numbers keep their place from item to item (top in the cell {sorted(set(offs))} px)')
        ctx.close()


class Band(Pat):
    def fit(self, b, cons):
        """Pat.fit with the player's answer rows (band_checks' player_rows): the harness draws the
        answers as 88 px tiles where the player uses 3.5rem rows, and since the numbers moved into
        strips under the drawings (19 Nov) the harness's own layout no longer stands for the
        player's at 360 × 640. The player's fit is checked by tests/e2e/fit.py --ex angles."""
        from band_a import PHONE
        from common import Console
        ctx = b.new_context(viewport={'width': 360, 'height': 640}, **PHONE)
        page = ctx.new_page()
        cons.append(Console(page))
        for name0, params, seed in self.sets:
            page.goto(self.url(seed, params))
            page.wait_for_function("() => window.__harness && __harness.state === 'respond'", timeout=30000)
            page.add_style_tag(content='.ex-caption:empty { display: none; }')
            d = page.evaluate("""() => {
                const stem = document.querySelector('.ex-angles-stem').getBoundingClientRect();
                const opts = Array.from(document.querySelectorAll('.hx-grid .px-choice')).map((e) => e.getBoundingClientRect());
                const stage = document.querySelector('.ex-angles-stage').getBoundingClientRect();
                return { stemH: Math.round(stem.height), stage: [Math.round(stage.width), Math.round(stage.height)],
                         minW: Math.round(Math.min(...opts.map((r) => r.width))), minH: Math.round(Math.min(...opts.map((r) => r.height))),
                         right: Math.round(Math.max(...opts.map((r) => r.right))) };
            }""")
            d['spanPlayer'] = d['stemH'] + 2 * 56 + 3 * 8
            self.C.ok(d['spanPlayer'] <= 568, f'angles {name0} at 360×640: stem and the player\'s two answer rows within 568 px ({d})')
            self.C.ok(d['minW'] >= 44 and d['minH'] >= 44 and d['right'] <= 360, f'angles {name0} at 360×640: answer targets ≥ 44 px, inside the screen ({d})')
            page.evaluate("() => { const s = document.querySelector('.ex-angles-stem'); window.scrollTo(0, s.getBoundingClientRect().top + scrollY - 8); }")
            self.shot(page, f'angles_{name0}_360x640.png')
        ctx.close()

    def run(self, demo, sandbox):
        cons = []
        with sync_playwright() as p:
            b = launch(p)
            self.views(b, cons)
            self.fit(b, cons)
            self.demo(b, cons, *demo)
            self.sandboxed(b, cons, *sandbox)
            band_checks(b, cons, self.C, 'angles', self.dir,
                        [('right', 'gap:0,size:0,resolve:0,pose:0', 16), ('middle', 'gap:0,size:2,resolve:1,pose:1', 7)],
                        assist_check=assist, try1=('gap:0,size:0,resolve:0,pose:0', 28), player_rows=56)
            wtg_checks(b, cons, self.C, 'angles', self.dir, '.ex-angles-cell.is-assist .ex-angles-flag')
            reveal_stable(b, cons, self.C, 'angles', self.dir)
            strip_checks(b, cons, self.C, self.dir)
            b.close()
        errors = [e for c in cons for e in c.errors()]
        self.C.ok(not errors, f'no console errors ({errors[:5]})')
        for f in self.dir.glob('_page_*.html'):
            f.unlink()
        return self.C.summary({'screenshots': sorted(p.name for p in self.dir.glob('angles_*.png'))})


if __name__ == '__main__':
    P = Band('angles', [('easy', 'gap:0', 5), ('close', 'gap:5,size:2,resolve:2,pose:1', 9), ('acute', 'gap:3,size:1,resolve:1,pose:1', 3)],
             stem_check=stem, option_check=options, showme_check=showme)
    sys.exit(P.run(demo=('gap:0', 16), sandbox=('gap:4,size:1,resolve:2,pose:1', 21)))
