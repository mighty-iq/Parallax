/* PX.ui.hooks (v1.2 wave 2; docs/dev/CONTRACT-v1.2.md R; js/ui/hooks.js): registration, order, the
   async points (run: the first result ends the run; failures are skipped) and the sync points
   (collect: every result, lists spread), and failures reported as play:error. The placements in the
   player and the screens are checked in a browser (tests/e2e/play.py run_hooks). */
import { MANIFEST } from './run.mjs';
import { installDom } from './chimera-dom.mjs';

const FILE = 'js/ui/hooks.js';

function env(t) {
  const e = t.context({ files: [...MANIFEST, FILE], exercises: false });
  t.ok(!e.loadErrors.length, 'hooks.js loads in Node: ' + e.loadErrors.join(' | '));
  return e;
}

export async function run(t) {
  t.section('ui hooks: points and registration');
  {
    const { PX } = env(t), H = PX.ui.hooks;
    t.eq(Object.keys(H.POINTS).sort(), ['about:sections', 'exercise:lines', 'item:before', 'item:notes', 'item:reveal', 'lab:panels', 'progress:panels', 'session:start', 'settings:sections', 'summary:panels', 'today:session', 'today:slots'], 'the points of the contract');
    t.eq(Object.keys(H.POINTS).filter((k) => H.POINTS[k].async).sort(), ['item:before', 'session:start'], 'two are async');
    t.throws(() => H.on('nope', () => null, { id: 'x' }), /unknown point/, 'an unknown point is refused');
    t.throws(() => H.on('today:slots', () => null, {}), /opts\.id/, 'an id is required');
    t.throws(() => H.on('today:slots', 7, { id: 'x' }), /needs a function/, 'a function is required');
    const off = H.on('today:slots', () => 'b', { id: 'b', order: 20 });
    H.on('today:slots', () => 'a', { id: 'a', order: 10 });
    H.on('today:slots', () => 'c', { id: 'c' });
    H.on('today:slots', () => 'd', { id: 'd', order: 20 });
    t.throws(() => H.on('today:slots', () => null, { id: 'a' }), /already registered/, 'an id is registered once per point');
    t.eq(H.list('today:slots').map((h) => h.id), ['a', 'b', 'd', 'c'], 'lower order first, ties in registration order, default 50');
    t.eq(H.collect('today:slots', {}), ['a', 'b', 'd', 'c'], 'collect() returns every result in that order');
    off();
    t.eq(H.collect('today:slots', {}), ['a', 'd', 'c'], 'off() removes a handler');
    t.eq(H.list('item:notes'), [], 'a point without handlers lists none');
    t.eq(H.collect('item:notes', {}), [], 'and collects nothing');
  }

  t.section('ui hooks: collect (sync points)');
  {
    const e = env(t), H = e.PX.ui.hooks;
    const seen = [];
    H.on('summary:panels', (ctx) => { seen.push(ctx.mode); return null; }, { id: 'none' });
    H.on('summary:panels', () => undefined, { id: 'undef' });
    H.on('summary:panels', () => [{ el: 1 }, null, { el: 2 }], { id: 'list' });
    H.on('summary:panels', () => { throw new Error('panel broke'); }, { id: 'broken' });
    H.on('summary:panels', () => ({ el: 3, invite: 'plateau' }), { id: 'one' });
    const out = H.collect('summary:panels', { mode: 'train' });
    t.eq(out, [{ el: 1 }, { el: 2 }, { el: 3, invite: 'plateau' }], 'null and undefined are skipped, lists spread, a throw skipped');
    t.eq(seen, ['train'], 'handlers get the context');
    const errs = e.events.filter((x) => x.evt === 'play:error');
    t.eq(errs.map((x) => x.data.where), ['hook:summary:panels:broken'], 'a failure is reported as play:error with the point and the id');
    t.ok(/panel broke/.test(errs[0].data.message), 'and its message');
    t.throws(() => H.collect('session:start', {}), /async point/, 'collect() refuses an async point');
  }

  t.section('ui hooks: run (async points)');
  {
    const e = env(t), H = e.PX.ui.hooks;
    const order = [];
    H.on('item:before', (ctx) => { order.push('a'); ctx.step.seed = 99; return null; }, { id: 'a', order: 10 });
    H.on('item:before', () => { order.push('b'); return Promise.reject(new Error('round broke')); }, { id: 'b', order: 20 });
    H.on('item:before', () => { order.push('c'); throw new Error('sync broke'); }, { id: 'c', order: 30 });
    H.on('item:before', () => { order.push('d'); return new Promise((res) => setTimeout(() => res(undefined), 5)); }, { id: 'd', order: 40 });
    H.on('item:before', () => { order.push('e'); return Promise.resolve(null); }, { id: 'e', order: 50 });
    const ctx = { step: { seed: 1 } };
    const v = await H.run('item:before', ctx);
    t.eq(v, null, 'when every handler goes on, run() resolves null');
    t.eq(order, ['a', 'b', 'c', 'd', 'e'], 'every handler ran, in order, failures skipped');
    t.eq(ctx.step.seed, 99, 'a handler may change the context it is given (the next item’s seed)');
    t.eq(e.events.filter((x) => x.evt === 'play:error').map((x) => x.data.where), ['hook:item:before:b', 'hook:item:before:c'], 'rejections and throws are reported');
    H.on('item:before', () => { order.push('f'); return 'end'; }, { id: 'f', order: 60 });
    H.on('item:before', () => { order.push('g'); return null; }, { id: 'g', order: 70 });
    order.length = 0;
    t.eq(await H.run('item:before', ctx), 'end', "the first result ends the run ('end' ends the session)");
    t.eq(order, ['a', 'b', 'c', 'd', 'e', 'f'], 'later handlers do not run');
    t.eq(await H.run('session:start', {}), null, 'a point without handlers resolves null');
    await t.rejects(H.run('today:slots', {}), /sync point/, 'run() refuses a sync point');
  }

  t.section('ui hooks: place and screen (the screens\' call sites)');
  {
    const e = t.env({ files: [...MANIFEST, FILE], exercises: false });
    installDom(e.document, e.window);
    const { PX, document: d } = e, H = PX.ui.hooks;
    const mk = (tag, attrs, title) => {
      const el = d.createElement(tag);
      for (const [k, v] of Object.entries(attrs || {})) el.setAttribute(k, v);
      if (title) { const head = d.createElement('div'), tt = d.createElement('h3'); tt.setAttribute('class', 'px-panel-title'); tt.textContent = title; head.appendChild(tt); el.appendChild(head); }
      return el;
    };
    const box = d.createElement('div');
    const session = mk('div', { 'data-slot': 'session' }), suggest = mk('div', { 'data-slot': 'suggest', hidden: '' });
    const check = mk('section', { 'data-section': 'check', id: 'px-prog-check' }), training = mk('section', {}, 'Training');
    const about = d.createElement('section'), h2 = d.createElement('h2'); h2.textContent = 'Your data'; about.appendChild(h2);
    const foot = mk('p', { class: 'foot' });
    [session, suggest, check, training, about, foot].forEach((x) => box.appendChild(x));
    const el = (name) => mk('div', { 'data-t': name });
    const A = el('A'), B = el('B'), C = el('C'), D = el('D'), E2 = el('E'), F = el('F'), G = el('G'), Hh = el('H'), I = el('I'), J = el('J');
    const replaced = [];
    const placed = H.place(box, [
      { el: A, after: 'session', order: 20 }, { el: B, after: 'session', order: 10 }, { el: C, replace: 'suggest' }, { el: D, replace: 'suggest' },
      { el: E2, after: 'Training' }, { el: F }, { el: G, after: 'nope' }, Hh, { el: I, replace: 'check' }, { el: J, after: 'Your data' }, null, { el: 'x' }, { after: 'session' },
    ], { before: foot, onReplace: (n, old, name) => replaced.push([n.getAttribute('data-t'), name]) });
    const names = box.children.map((x) => x.getAttribute('data-t') || x.getAttribute('data-slot') || x.getAttribute('data-section') || (x === training ? 'Training' : x === about ? 'about' : x === foot ? 'foot' : '?'));
    t.eq(names, ['session', 'B', 'A', 'C', 'D', 'I', 'Training', 'E', 'about', 'J', 'F', 'G', 'H', 'foot'],
      'after follows the named part in order; replace takes its place (a second one follows it); the rest, and unknown names, go before opts.before');
    t.eq(placed.length, 10, 'place() returns the elements placed (invalid results are skipped)');
    t.ok(!suggest.parentNode && !check.parentNode, 'a replaced part leaves the screen');
    t.eq([C.getAttribute('data-slot'), I.getAttribute('data-section'), I.id, check.id], ['suggest', 'check', 'px-prog-check', ''], 'the replacement takes the slot name, the section name and the id (jump links keep working)');
    t.eq(replaced, [['C', 'suggest'], ['I', 'check']], 'onReplace is called once per part replaced');

    const box2 = d.createElement('div'), p1 = mk('section', {}, 'Research export'), p2 = mk('section', {}, 'How the engine works');
    box2.appendChild(p1); box2.appendChild(p2);
    H.on('lab:panels', (ctx) => ({ el: el('bets-' + ctx.tag), after: 'Research export' }), { id: 'bets.lab' });
    H.on('lab:panels', () => { throw new Error('lab panel broke'); }, { id: 'broken.lab' });
    H.on('lab:panels', () => el('end'), { id: 'end.lab' });
    const got = H.screen('lab:panels', box2, { tag: 'x' });
    t.eq(box2.children.map((x) => x.getAttribute('data-t') || (x === p1 ? 'export' : 'engine')), ['export', 'bets-x', 'engine', 'end'], 'screen() collects and places: after a title, the rest at the end');
    t.eq(got.length, 2, 'a failing handler places nothing');
    t.eq(e.events.filter((x) => x.evt === 'play:error').map((x) => x.data.where), ['hook:lab:panels:broken.lab'], 'and is reported');
  }
}
