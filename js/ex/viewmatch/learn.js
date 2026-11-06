/* PR-2 View Match: instruction data (pure, data only; PHASE-B "Probes", PLAN.md §4 and §8).
   A probe is never trained: no practice items, no tips, no strategy cards and no feedback in the
   Spatial Check. Before its first item the Check shows one screen: `instruction` plus the worked
   example (`demo[0]`, played by view.demo with `captions`) at the easiest level, from a fixed seed
   that the Check never scores (its items take seeds from PX.rng.hash('px-probe', …)).
   Shapes as in js/ex/cubematch/learn.js. Wording: about the task, never the person. */
(function (PX) {
  'use strict';

  PX.ex.learn('viewmatch', {
    goal: 'Which picture shows the table as seen from the flag?',
    parts: [
      { id: 'overview', label: 'Overview', text: 'The table from your side, seen from above at an angle.' },
      { id: 'flag', label: 'Flag', text: 'A place at the edge of the table. Imagine standing there and looking at the middle of the table.' },
      { id: 'options', label: 'Pictures', text: 'Four photos taken from four places around the table, at eye height. One is from the flag.' },
      { id: 'answer', label: 'Answer', text: 'Pick the picture from the flag: tap it or press 1–4.' },
      { id: 'time', label: 'Time bar', text: 'The bar under the overview shows the time left for this item.' },
    ],
    instruction: {
      title: 'View Match',
      lines: [
        'A table with a few objects is shown from your side. A flag stands at the edge of the table.',
        'Imagine walking round to the flag and looking at the middle of the table: which of the four pictures would you see?',
        'Look at which objects are on the left and on the right, and which ones stand in front of others.',
        'There is no feedback in this check. Answer as well as you can; a guess is fine when you are unsure.',
      ],
    },
    // The easiest level (the flag about 45° round from your side, 3 objects, far-apart pictures).
    demo: [
      { params: { angle: 0, objects: 0, foils: 0 }, seed: 4, kind: 'flag-right' },
    ],
    captions: {
      overview: 'This is the table seen from your side.',
      flag: 'The flag marks a place at the edge of the table.',
      options: 'The four pictures were taken from four places around the table. One of them is from the flag.',
      walk: 'Walk round to the flag and look at the middle of the table.',
      match: 'From the flag the table looks like picture {a}: the same objects left and right, the same ones in front.',
      answer: 'So the answer is picture {a}.',
      tagKey: 'From the flag',
      tagOther: 'Another place',
      verdict: 'Picture {a} is the view from the flag',
    },
  });
})(window.PX);
