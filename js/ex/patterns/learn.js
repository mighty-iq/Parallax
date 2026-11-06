/* PR-4 Pattern Memory: instruction data (pure, data only; PHASE-B.md "Probes", PLAN.md §4 and §8).
   A probe is never trained: no practice items, tips or strategy cards. The one-screen instruction
   plays one worked example (view.demo) at the easiest level with a fixed seed that the Spatial
   Check never scores. Captions are read by view.demo and view.showMe. */
(function (PX) {
  'use strict';

  PX.ex.learn('patterns', {
    goal: 'Remember the pattern, then mark the squares that were filled.',
    instruction: [
      'A pattern of filled squares appears for 3 seconds. Then the grid empties.',
      'Mark every square that was filled, in any order: tap it, or move with the arrow keys and press Space. Tap again to unmark. Confirm with Enter or the Confirm button.',
      'The bar shows the time left to mark. The Check does not show whether an answer was right.',
    ],
    parts: [
      { id: 'grid', label: 'Grid', text: 'Squares from 3 × 3 up to 6 × 6; about half of them are filled.' },
      { id: 'marks', label: 'Marks', text: 'Your marks, shown with a dot. The counter says how many squares are marked.' },
      { id: 'confirm', label: 'Confirm', text: 'Enter or the Confirm button sends the marks.' },
    ],
    // The worked example: a 3 × 3 grid, 4 squares in one T-shaped group (seed 5: cells 0, 1, 2, 4).
    demo: [{ params: { size: 0, regularity: 0 }, seed: 5, kind: '0.1.2.4' }],
    practice: [],
    tips: [],
    captions: {
      look: 'Look at the pattern. It stays for 3 seconds.',
      empty: 'Now the grid is empty.',
      mark: 'Mark each square that was filled: tap it, or use the arrow keys and Space.',
      confirm: 'When you are done, press Enter or Confirm.',
      again: 'Here is the pattern again.',
      right: 'All {k} squares marked, and no others.',
      diff: 'Squares with a dashed outline were filled but not marked; a cross marks a square that was empty.',
      exposeLook: 'Look',
      exposeMark: 'Mark the squares that were filled',
    },
  });
})(window.PX);
