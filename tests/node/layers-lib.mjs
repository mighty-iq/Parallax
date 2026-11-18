/* Shared checks for the layers-*.test.mjs files (W2-bets; PLAN milestone 4, note T1 §4.1, CLAUDE.md rule 5):
   the comparison rounds' shortcut solvers, each scored over a set of rounds { r: E.bets.round(...), params }:
     fixed position (best)            always the same slot (the best of the four)
     longest / shortest statement     the option with the most / fewest characters (ties: the first)
     most words shared with the tips  the option sharing the most content words with the learn.js tips that
                                      apply to the item's settings and the exercise's goal (ties: the first)
   and FORBIDDEN, the words no layer text may use (CLAUDE.md rules 2 and 11). */
export const FORBIDDEN = /\bIQ\b|smarter|intelligen|master(ed|y)|guarantee|will (improve|raise|make)|proven|brain age|percentile/i;

const STOP = new Set(['the', 'and', 'that', 'with', 'from', 'this', 'than', 'into', 'your', 'what', 'when', 'both', 'each', 'they', 'them', 'there', 'their', 'then', 'which', 'have', 'does', 'will', 'just', 'some', 'only', 'also', 'over', 'under']);
export function words(s) {
  return String(s || '').toLowerCase().replace(/[’']/g, '').replace(/[^a-z0-9\s]/g, ' ').split(/\s+/).filter((w) => w.length >= 4 && !STOP.has(w));
}
function applies(when, p) {
  if (!when) return true;
  if (when.variant) return p.variant === when.variant;
  if (when.dim) return (when.levels || []).includes(p[when.dim]);
  return true;
}
export function tipWords(L, params) {
  const txt = ((L && L.tips) || []).filter((tip) => applies(tip.when, params || {})).map((tip) => tip.text).join(' ') + ' ' + ((L && L.goal) || '');
  return new Set(words(txt));
}
export function shortcuts(rounds, C, L) {
  const text = (id) => C.compare.statements.find((x) => x.id === id).text;
  const n = rounds.length || 1, pos = [0, 0, 0, 0];
  let longest = 0, shortest = 0, overlap = 0;
  for (const { r, params } of rounds) {
    pos[r.correct]++;
    const lens = r.opts.map((id) => text(id).length);
    if (lens.indexOf(Math.max(...lens)) === r.correct) longest++;
    if (lens.indexOf(Math.min(...lens)) === r.correct) shortest++;
    const tw = tipWords(L, params);
    const ov = r.opts.map((id) => words(text(id)).filter((w) => tw.has(w)).length);
    if (ov.indexOf(Math.max(...ov)) === r.correct) overlap++;
  }
  return { 'fixed position (best)': Math.max(...pos) / n, 'longest statement': longest / n, 'shortest statement': shortest / n, 'most words shared with the tips': overlap / n };
}
