/* PR-8 Balance: instruction data (pure, data only; PLAN milestone 6, a Lab check; note T1 §5.2).
   A Lab check is never trained: no practice items, no tips, no feedback, and no worked example, because an
   answered example would teach the very weighting the check measures (the bus stop's middle house, the far dots'
   pull). The words define each task and nothing more; before each kind's first item the check shows its line from
   `explain`. Wording: about the task, never the person. */
(function (PX) {
  'use strict';

  PX.ex.learn('balance', {
    goal: 'Tap the balance point, or the best spot for a bus stop.',
    goals: {
      centroid: 'Tap the balance point of the dots, then confirm.',
      median: 'Tap the best spot for the bus stop, then confirm.',
    },
    instruction: {
      title: 'Balance',
      lines: [
        'Two kinds of question, one tap each: the balance point of some dots on a board, and the best spot for a bus stop on a street.',
        'There is no feedback and no sums are needed: answer by eye, as well as you can. Tap, adjust if you like (drag, or the arrow keys), then Confirm.',
      ],
    },
    explain: {
      centroid: ['Dots lie on a light, flat board. Tap the balance point: the spot where the board would balance on a pin if every dot weighed the same.'],
      median: ['Houses stand along a straight street. Tap where the bus stop should go so that the total walk, every house\'s walk to the stop added up, is as short as possible.'],
    },
  });
})(window.PX);
