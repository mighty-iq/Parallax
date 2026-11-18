/* Reserved formats (PLAN milestone 6, the ladder; note T1 §5.4; CONTRACT-v1.2 S): the measurement probes keep
   formats that no training material uses, so a probe stays a test of carry-over and never of practice.
   Every probe declares its format ids (`def.format`: a token, or { <variant>: token }), and every id is on the
   frozen list below; no training exercise, layer content (compare rounds, bridge sets) or Daily pool uses one.
   Declared exception (PLAN, Central Point): its one-time tutorial Watch is the same for every player and keeps the
   balance point in words only; no Central Point item, reveal, "Why?", Try item or bridge marks the average
   position, so Balance (Lab) stays untrained. Show-me animations are feedback, not questions (note T1 §5.4: the
   pilot compares turn-strand gains with show-me plays). */

// The frozen list: probe → its reserved format ids, with what each one covers (note T1 §5.4).
export const RESERVED = {
  otherway: {
    'otherway:turn-axis-arrow': 'the instructed turn: a figure with an axis, a curved arrow and an angle → the turned figure',
    'otherway:sheet-to-fold-sequence': 'an unfolded sheet with holes → the fold-and-punch sequence that made it',
    'otherway:section-to-solid-plane': 'a cut face → the solid and plane that give it',
    'otherway:cube-to-net': 'a coloured cube → the net that folds into it',
    'otherway:view-to-direction': 'a view → the direction it was drawn from',
    'otherway:arrow-circle-to-position': 'an arrow circle of directions → the position on a map',
  },
  motiongraphs: {
    'motiongraphs:strobe-picture': 'strobe pictures of a moving object',
    'motiongraphs:graph-over-time': 'position or velocity graphs over time',
    'motiongraphs:moving-frame': 'motion seen from a moving frame of reference',
  },
  mechanisms: { 'mechanisms:gears-belts-pulleys': 'gears, belts and pulleys' },
  level: { 'level:liquid-plumb-tilted-frame': 'liquid surfaces and plumb lines in tilted frames' },
  cubematch: { 'cubematch:symbol-cubes-same-different': 'cubes with oriented symbols, same or different' },
  viewmatch: { 'viewmatch:scene-from-marked-spot': 'perspective pictures of a scene from a marked spot' },
  patterns: { 'patterns:grid-pattern-recall': 'grid patterns shown briefly, then recalled' },
  wordlinks: { 'wordlinks:word-analogy': 'word analogies' },
  balance: {
    'balance:balance-point': 'the balance point of dots (centroid) or a line of houses (median)',
    'balance:average-marker': 'any marker of the average position',
  },
};

function tokens(f) {
  if (typeof f === 'string') return [f];
  if (f && typeof f === 'object' && !Array.isArray(f)) return Object.values(f).filter((x) => typeof x === 'string');
  return [];
}
// every `format` field anywhere inside a value (layer content declares its rounds' and sets' formats there)
function formatFields(v, out = [], depth = 0) {
  if (!v || typeof v !== 'object' || depth > 8) return out;
  if (Array.isArray(v)) { v.forEach((x) => formatFields(x, out, depth + 1)); return out; }
  for (const [k, x] of Object.entries(v)) {
    if (k === 'format') out.push(...tokens(x));
    else formatFields(x, out, depth + 1);
  }
  return out;
}

export async function run(t) {
  const env = t.context({});
  const PX = env.PX;
  const all = new Map();
  for (const [probe, ids] of Object.entries(RESERVED)) for (const id of Object.keys(ids)) all.set(id, probe);
  t.ok(all.size === 17 && [...all.keys()].every((id) => /^[a-z]+:[a-z-]+$/.test(id) && id.startsWith(all.get(id) + ':')), 'the frozen list: 17 ids, each named after its probe');

  t.section('probes declare their reserved formats');
  const probes = PX.ex.list('probe');
  t.ok(probes.length >= 6, `the probes are loaded (${probes.map((d) => d.id).join(', ')})`);
  for (const d of probes) {
    const ts = tokens(d.format), own = RESERVED[d.id];
    t.ok(own && ts.length > 0 && ts.every((x) => x in own), `${d.id}: format ${JSON.stringify(d.format)} is on its reserved list`);
  }

  t.section('no training material uses a reserved format');
  const train = PX.ex.list().filter((d) => d.role !== 'probe');
  t.ok(train.length >= 20, `the training exercises are loaded (${train.length})`);
  for (const d of train) {
    const ts = tokens(d.format);
    t.ok(ts.length > 0, `${d.id}: declares its format (${JSON.stringify(d.format)})`);
    const bad = ts.filter((x) => all.has(x) || [...Object.keys(RESERVED)].some((p) => x.startsWith(p + ':')));
    t.ok(bad.length === 0, `${d.id}: no reserved format ${bad.length ? JSON.stringify(bad) : ''}`);
  }
  const B = PX.engine.bets;
  if (B && typeof B.content === 'function') {
    const used = [];
    for (const d of train) { const c = B.content(d.id); if (c) used.push(...formatFields(c).map((x) => d.id + ' → ' + x)); }
    const bad = used.filter((x) => all.has(x.split(' → ')[1]));
    t.ok(bad.length === 0, `layer content (compare rounds, bridge sets): no reserved format (${used.length} declared${bad.length ? '; ' + bad.join(', ') : ''})`);
  }
  if (B && typeof B.formats === 'function') {
    const tab = B.formats(), bad = [];
    for (const [key, f] of Object.entries(tab)) {
      const id = key.split('@')[0], d = PX.ex.get(id);
      if (d && d.role === 'probe') continue;
      tokens(f).forEach((x) => { if (all.has(x)) bad.push(key + ': ' + x); });
    }
    t.ok(bad.length === 0, `the export header's formats table: training rows use no reserved id ${bad.join(', ')}`);
  }

  t.section('probes are never trained');
  t.eq(PX.ex.list('train').filter((d) => d.role === 'probe').length, 0, 'no probe is a training exercise');
  if (PX.engine.daily && typeof PX.engine.daily.pool === 'function') t.ok(PX.engine.daily.pool().every((d) => d.role !== 'probe'), 'no probe in the Daily Challenge pool');
  const sec = PX.engine.section;
  if (sec && Array.isArray(sec.SECTIONS)) t.ok(sec.SECTIONS.every((s) => (s.exs || []).every((id) => !RESERVED[id])), 'no probe in Section practice');
}
