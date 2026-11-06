/* PR-1 Cube Match: instruction data (pure, data only; PHASE-B "Probes", PLAN.md §4 and §8).
   A probe is never trained: no practice items, no tips, no strategy cards and no feedback in the
   Spatial Check. Before its first item the Check shows one screen: `instruction` plus the worked
   example (`demo[0]`, played by view.demo with `captions`) at the easiest level, from a fixed seed
   that the Check never scores (its items take seeds from PX.rng.hash('px-probe', …)).
     goal                  one line (the harness shows it above the stem)
     parts[]               { id, label, text } labels for the parts of the screen
     instruction           { title, lines[] } the one-screen instruction
     demo[]                { params, seed, kind } worked examples; kind = what the seed gives (tested)
     captions              texts that view.demo and view.showMe put on screen ({a}: a value)
   Wording rules (CLAUDE.md 2, 11, 12): about the task, never the person; no feedback words such as
   "well done" in the Check; no IQ, "smarter" or "mastered". */
(function (PX) {
  'use strict';

  PX.ex.learn('cubematch', {
    goal: 'Could the second drawing be the first cube, turned?',
    parts: [
      { id: 'first', label: 'Drawing 1', text: 'A cube seen from one corner: you see three of its six faces.' },
      { id: 'second', label: 'Drawing 2', text: 'The same cube turned, or a different cube. Faces you cannot see may carry any of the other symbols.' },
      { id: 'answer', label: 'Answer', text: 'Same cube (key 1) or Different cubes (key 2).' },
      { id: 'time', label: 'Time bar', text: 'The bar under the drawings shows the time left for this item. There is no hurry before it runs out.' },
    ],
    instruction: {
      title: 'Cube Match',
      lines: [
        'Each cube has six different symbols, one on each face, and you can see three faces at a time.',
        'Decide whether the second drawing could be the first cube after turning it.',
        'A symbol keeps its place on the cube and the way it points: if two symbols have swapped places, or one points another way, it is a different cube.',
        'Some symbols look alike, so check how each one is turned, not only its shape.',
        'There is no feedback in this check. Answer as well as you can; a guess is fine when you are unsure.',
      ],
    },
    // The easiest level (a turn about the viewing corner, three faces shared, pictograms).
    demo: [
      { params: { rotation: 0, change: 0, glyphs: 0 }, seed: 1, kind: 'same' },
      { params: { rotation: 0, change: 0, glyphs: 0 }, seed: 2, kind: 'different' },
    ],
    captions: {
      first: 'Drawing 1 shows three faces of a cube. Every face has a different symbol.',
      second: 'Drawing 2 shows a cube from the same corner: the same cube turned, or a different one?',
      turn: 'Watch the first cube turn so that it faces the way the second one does.',
      same: 'Turned like this, every face matches the second drawing: it is the same cube.',
      swapped: 'Turned like this, the marked faces do not match: two symbols have swapped places, so no turn can make them match.',
      turned: 'Turned like this, the marked face does not match: its symbol points another way, so no turn can make it match.',
      answerSame: 'So the answer is Same cube (key 1).',
      answerDifferent: 'So the answer is Different cubes (key 2).',
      verdictSame: 'Same cube, turned',
      verdictSwap: 'Different: two symbols swapped places',
      verdictTurn: 'Different: one symbol points another way',
    },
  });
})(window.PX);
