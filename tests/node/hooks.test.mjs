/* PX.ui.hooks (v1.2 wave 2; docs/dev/CONTRACT-v1.2.md R; js/ui/hooks.js): registration, order, the
   async points (run: the first result ends the run; failures are skipped) and the sync points
   (collect: every result, lists spread), and failures reported as play:error. The placements in the
   player and the screens are checked in a browser (tests/e2e/play.py run_hooks). */
import { MANIFEST } from './run.mjs';

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
}
