/* Off-screen challenges (PLAN milestone 4, note T1 §4.2): every exercise that registers one gives it an id,
   a title, a text, three or more steps and a note with its limit, in the words CLAUDE.md rule 2 allows; the
   four new ones (Slice, Orient, Knots, Central Point) exist; with Fold, Nets and Views (learn.js) that is
   seven exercises with a hands-on challenge. */
import { FORBIDDEN } from './layers-lib.mjs';

export async function run(t) {
  const { PX } = t.context();
  const B = PX.engine.bets;
  t.section('off-screen challenges: content and words');
  const ids = PX.ex.list('train').map((d) => d.id);
  const own = ids.filter((id) => B.content(id) && B.content(id).offscreen);
  t.eq(own.sort(), ['centralpoint', 'knots', 'orient', 'slice'], 'Slice, Orient, Knots and Central Point have their new challenge');
  const learnOnes = ids.filter((id) => PX.ex.learn(id) && PX.ex.learn(id).offscreen);
  t.eq(learnOnes.sort(), ['fold', 'nets', 'views'], 'Fold, Nets and Views keep theirs (learn.js)');
  const seen = new Set();
  for (const id of own) {
    const o = B.content(id).offscreen;
    t.ok(/^[a-z][a-z0-9-]{0,40}$/.test(o.id) && !seen.has(o.id), id + ': a unique token id (' + o.id + ')');
    seen.add(o.id);
    t.ok(o.title && o.text && Array.isArray(o.steps) && o.steps.length >= 3 && o.note, id + ': title, text, steps and a note');
    t.ok(/not been tested|untested/.test(o.note), id + ': the note says what has not been tested (one accurate limit)');
    for (const s of [o.title, o.text, o.note, ...o.steps]) t.ok(!FORBIDDEN.test(s), id + ': no promise or IQ wording: ' + s.slice(0, 40));
  }
}
