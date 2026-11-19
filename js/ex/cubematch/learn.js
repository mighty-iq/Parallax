/* PR-1 Cube Match: instruction data, version 2 (pure, data only; PHASE-B "Probes", PLAN.md §4 and §8; v1.2: four
   drawings, one of them the reference turned).
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
    goal: 'Which drawing shows the reference cube, turned?',
    // the task card's lines (the runner folds instruction.lines away under "More about this task")
    brief: ['Find the drawing that shows the reference cube turned. Every face has its own symbol, and a symbol keeps its place on the cube and the way it points.'],
    parts: [
      { id: 'first', label: 'Reference', text: 'A cube seen from one corner: you see three of its six faces.' },
      { id: 'options', label: 'Drawings 1 to 4', text: 'One is the reference cube turned. In each of the others two symbols have swapped places or one points another way. Faces you cannot see in the reference may carry any of the other symbols.' },
      { id: 'answer', label: 'Answer', text: 'Tap the drawing, or press its number (1 to 4).' },
      { id: 'time', label: 'Time bar', text: 'The bar under the reference shows the time left for this item. There is no hurry before it runs out.' },
    ],
    instruction: {
      title: 'Cube Match',
      lines: [
        'Each cube has six different symbols, one on each face, and you can see three faces at a time.',
        'One of the four drawings is the reference cube after turning it. Find it.',
        'A symbol keeps its place on the cube and the way it points: where two symbols have swapped places, or one points another way, it is a different cube.',
        'Some symbols look alike, so check how each one is turned, not only its shape.',
        'There is no feedback in this check. Answer as well as you can; a guess is fine when you are unsure.',
      ],
    },
    // The easiest level (a turn about the viewing corner, three faces shared, pictograms).
    demo: [
      { params: { rotation: 0, change: 0, glyphs: 0 }, seed: 1, kind: 'which' },
    ],
    captions: {
      first: 'The reference shows three faces of a cube. Every face has a different symbol.',
      options: 'Four drawings show a cube from the same corner. One of them is the reference cube turned.',
      turn: 'Watch the reference turn so that it faces the way the matching drawing does.',
      match: 'Turned like this, every face matches drawing {a}.',
      answer: 'So the answer is drawing {a}. In each of the others, two symbols have swapped places or one points another way.',
      verdict: 'Drawing {a} is the reference cube turned',
    },
  });
})(window.PX);
