/* EX-13 Knots: tutorial data (pure, data only; ARCHITECTURE.md §2, docs/dev/EXERCISE-GUIDE.md §7).
   Watch–Try–Go (R2 §7.5): the gap shows which strand is under → the minimal pair (one outline, one
   crossing switched: one rope falls open, the other ties tight) → the three moves in plain words →
   Try on easy ropes, then one untie item → Go. Wording rules (CLAUDE.md 2, 12): about the task,
   never the person; no IQ or "mastered"; the bridge carries its limitation line. */
(function (PX) {
  'use strict';

  PX.ex.learn('knots', {
    goal: 'Pull both ends in your mind: does a knot remain?',
    goals: {
      pull: 'Pull both ends of the rope: does a knot remain?',
      untie: 'Which marked crossing, switched, lets the rope fall open?',
      tie: 'Which marked crossing, switched, ties a knot?',
      link: 'Are the two loops linked, or could you pull them apart?',
    },
    parts: [
      { id: 'rope', label: 'Rope', text: 'One rope. Both ends run off the plate and are pulled apart. It is perfectly slippery and cannot pass through itself.' },
      { id: 'gap', label: 'Crossing', text: 'Where two strands cross, the gap shows which one is underneath.' },
      { id: 'tags', label: 'Marks A–D', variant: 'untie', text: 'Four crossings carry a letter. Switch one in your mind (the strand underneath goes on top) and pull again.' },
      { id: 'tags-tie', label: 'Marks A–D', variant: 'tie', text: 'This rope falls open as it is. One marked crossing, switched, would tie a real knot.' },
      { id: 'loops', label: 'Two loops', variant: 'link', text: 'Two closed loops, each plain on its own. Linked loops cannot be pulled apart without cutting one.' },
      { id: 'answer', label: 'Answer', text: 'Tap Knot or No knot (Linked or Apart), or press 1 or 2. For the marks, tap a letter (on the rope or below it) or press 1–4.' },
    ],
    // Easiest level; each seed's kind is tested (tests/node/knots.test.mjs), and each one's show me
    // plays to the end.
    demo: [
      { params: { rope: 0, spacing: 0, variant: 'pull' }, seed: 1, kind: 'no-knot' },
      { params: { rope: 0, spacing: 0, variant: 'pull' }, seed: 2, kind: 'knot' },
      { params: { rope: 0, spacing: 0, variant: 'untie' }, seed: 2, kind: 'untie' },
      { params: { rope: 0, spacing: 0, variant: 'tie' }, seed: 1, kind: 'tie' },
      { params: { rope: 0, spacing: 0, variant: 'link' }, seed: 2, kind: 'linked' },
      { params: { rope: 0, spacing: 0, variant: 'link' }, seed: 9, kind: 'apart' },
    ],
    practice: [
      { rope: 0, spacing: 0, variant: 'pull' },
      { rope: 1, spacing: 0, variant: 'pull' },
      { rope: 0, spacing: 0, variant: 'untie' },
    ],
    tips: [
      { id: 'descend', when: { variant: 'pull' }, text: 'If, from one end, the rope is on top at every crossing it meets first, it falls apart.' },
      { id: 'slippery', when: { dim: 'rope', levels: [0, 1] }, text: 'The rope is perfectly slippery and cannot pass through itself: real ropes can jam, these cannot.' },
      { id: 'slide-over', when: { dim: 'rope', levels: [4, 6, 7, 8, 9] }, text: 'Nothing comes off at first? Slide a strand over a crossing (a slide-over); then a loop may come off.' },
      { id: 'tight', when: { dim: 'spacing', levels: [2] }, text: 'The strands run close here. Follow one strand with your eyes, crossing by crossing.' },
      { id: 'untie', when: { variant: 'untie' }, text: 'Switch each marked crossing in your mind and pull. A twist knot comes undone at its clasp, not at its twists.' },
      { id: 'tie', when: { variant: 'tie' }, text: 'Switch each marked crossing in your mind and pull. Only one of them leaves a knot that holds.' },
      { id: 'link', when: { variant: 'link' }, text: 'Slide off what you can. If one loop still goes over and under the other in a way nothing undoes, they are linked.' },
    ],
    // Strategy cards (R2 §7.5). Picturing: animation and imagined epistemic actions are how knot
    // diagrams are reasoned with (De Toffoli & Giardino 2014; de Koning et al. 2019). Step by step:
    // Reidemeister moves; the last line is the reduced-alternating theorem (Kauffman, Murasugi,
    // Thistlethwaite 1987), so it is true. Curve tracing slows when strands run close (Jolicoeur &
    // Ingleton 1991; Jeurissen et al. 2016): hence when to switch.
    strategies: [
      {
        id: 'imagery', title: 'Picture the pull',
        text: 'Hold one end still and pull the other in your mind. Watch which loops slide off and which ones tighten.',
        steps: [
          'Start at one end and let the rope run through your fingers.',
          'Where a loop lies on top of another strand, let it slide off.',
          'What is left when the rope is tight: a straight rope (no knot), or a knot that holds.',
        ],
        when: 'Quick on short ropes with few crossings.',
      },
      {
        id: 'analytic', title: 'Trace and remove',
        text: 'Take the rope apart move by move, as the Show me does.',
        steps: [
          'Untwist curls: a loop that crosses only itself comes out.',
          'Slide off a loop where the same strand is on top at both of its crossings.',
          'Stuck? Slide a strand over a crossing, then look for a loop to remove again.',
          'Nothing left: no knot. If what is left goes over, under, over all the way round, it is a knot.',
        ],
        when: 'Steady on long or crowded ropes.',
      },
      {
        id: 'switch', title: 'When to switch',
        text: 'Neither way is always better. Picture first; trace when the picture blurs.',
        steps: [
          'If the strands run close or you lose track of a strand, switch to tracing move by move.',
          'If tracing gets long, step back and picture the whole rope pulled tight.',
          'Counting crossings tells you nothing: a knot and a plain rope of the same shape are both here.',
        ],
        when: 'After two misses in a row, try the other way on the next item.',
      },
    ],
    captions: {
      gap: 'The gap shows which strand is underneath.',
      pair: 'Same shape, one crossing different: only the crossings decide.',
      curl: 'A curl: untwist it.',
      slide: 'This loop lies on top: lift it off.',
      slideUnder: 'This loop lies underneath: drop it out.',
      over: 'Slide this strand over the crossing.',
      none: 'Nothing is left: the rope falls open. No knot.',
      knot: 'Over, under, over all the way round: nothing can slide off. A knot remains.',
      knotCore: 'No move takes these crossings out: a knot remains.',
      broken: 'The remaining moves are the same kinds; the rope ends {end}.',
      switchKey: 'Switch crossing {tag}.',
      unties: 'Switched at {tag}, the rope falls open.',
      ties: 'Switched at {tag}, a knot holds.',
      stays: 'Switched at {tag}, the rope {what}.',
      apart: 'No crossing joins the loops now: lift one off and they come apart.',
      linked: 'The loops wind round each other {lk}: they cannot come apart.',
      linkedZero: 'They wind round each other and back, yet no move frees them: they are linked.',
      moves: 'Untwist a curl, slide off a loop on top, slide over a crossing: the three moves.',
      tagsIntro: 'Four crossings carry a letter.',
      loopsIntro: 'Two closed loops, each plain on its own.',
    },
    bridge: 'Following a rope through its crossings and picturing it pulled tight is part of sailing, climbing and surgical knot tying. People who score higher on spatial tests learn to tie knots a little faster. Practising knot diagrams has not been shown to improve knot tying or anything else.',
  });
})(window.PX);
