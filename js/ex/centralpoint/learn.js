/* EX-20 Central Point: tutorial data (pure, data only; ARCHITECTURE.md §2, EXERCISE-GUIDE §7, CONTRACT-v1.2 D;
   design: docs/research/v1.2/C1-central-point.md §2.5, §5, PLAN.md milestone 8). The method is taught in plain
   words before the first item, as the owner asked (a gut estimate, not a calculation): count the sides for a
   first guess, then balance the pulls (every target pulls with the same strength, however far it is).
   Watch–Try–Go: the rules card → the Watch (seed 261: a group of four round an empty dot and one far target;
   the count gives the middle dot, the pulls move the spot half a dot towards the far target, and the Watch,
   once, shows the average dragged further: the declared exception of PLAN.md Defaults) → "First count, then
   balance" before Try 1 → Try 1 the kite (seed 2, its diagonals drawn: the first step done), Try 2 a group
   with one far target (seed 15), Try 3 a rated-style item (seed 14) → Go. The Watch item stays the same for
   every player (C1 §5.4; three or five targets there: five, so that counting has something to count).
   Wording rules (CLAUDE.md): about the task, never the person; no IQ or "mastered"; no promised gains; the
   average position is named in words only (the strategy cards), never drawn outside the Watch. */
(function (PX) {
  'use strict';

  PX.ex.learn('centralpoint', {
    goal: 'Tap the spot with the least total distance to all the targets.',
    goals: {
      quick: 'Tap where the pulls balance, then tap the marker again to answer. Quick answers score more.',
      exact: 'Place the spot closest to all the targets in total, nudge it, then confirm.',
    },
    minutes: 2,
    rules: [
      { text: 'Each ring is a target. Find the spot whose total distance to all the targets is the least.', fig: 'lines' },
      { text: 'Every target pulls on that spot with the same strength, however far away it is. The best spot is where the pulls balance.', fig: 'pulls' },
      { text: 'Answers sit on the dots and half-way between them. Tap to place the marker; tap it again, or Confirm, to answer.', fig: 'tap' },
      { text: 'In the quick form a bar shows the time left: a near miss still scores, a faster answer scores more.', fig: 'bar' },
    ],
    parts: [
      { id: 'board', label: 'Board', text: 'A square of 7 by 7 dots. You can answer on any dot or half-way between two dots, never off the board.' },
      { id: 'targets', label: 'Targets', text: 'The rings. Your total is the sum of the straight-line distances from your spot to every ring.' },
      { id: 'marker', label: 'Marker', text: 'Your spot. A tap places it on the nearest answer point; the board shows faint answer points round it.' },
      { id: 'quick', label: 'Quick answer', text: 'Tap the marker again, or Confirm, or press Enter. The bar under the board shows the time left.', variant: 'quick' },
      { id: 'nudge', label: 'Nudge', text: 'Drag the marker, or use the four arrow buttons (or the arrow keys) to move it half a dot. Then Confirm (Enter).', variant: 'exact' },
      { id: 'reveal', label: 'After you answer', text: 'Lines from your spot to every target, with their lengths in dots, the best spot, and how much farther your total was. Map shows lines of equal total.' },
    ],
    demo: [
      { params: { variant: 'quick', targets: 1, band: 0, task: 'watch' }, seed: 261, kind: 'watch' },
      { params: { variant: 'exact', targets: 1, band: 0, task: 'watch' }, seed: 261, kind: 'watch' },
    ],
    practice: [
      { params: { variant: 'quick', targets: 0, band: 0, task: 'kite' }, seed: 2, assist: 'diagonals', tip: 'kite' },
      { params: { variant: 'quick', targets: 1, band: 0, task: 'group' }, seed: 15, tip: 'farTarget' },
      { params: { variant: 'quick', targets: 1, band: 0, task: 'loose' }, seed: 14, tip: 'quickTap' },
    ],
    strategyFirst: 'switch',
    tips: [
      { id: 'kite', when: { dim: 'targets', levels: [0] }, text: 'Four targets: join each one to the target across from it. The best spot is where the two lines cross.' },
      { id: 'farTarget', when: { dim: 'targets', levels: [1] }, text: 'A far target pulls no harder than a near one. Do not let it drag your spot towards it.' },
      { id: 'quickTap', when: { variant: 'quick' }, text: 'Against the clock: count for a first guess, place the marker a little the way the pulls lean, then tap it again. A near miss still scores; a quick answer scores more.' },
      { id: 'exactNudge', when: { variant: 'exact' }, text: 'Place the marker, then move it half a dot at a time with the arrows. Confirm once the pulls balance.' },
      { id: 'many', when: { dim: 'targets', levels: [3, 4] }, text: 'Many targets: count the sides first, then mind the targets close to your spot. Their pulls swing most as you move.' },
      { id: 'tight', when: { dim: 'band', levels: [2] }, text: 'Only spots within a quarter of a per cent of the best total count now: one answer point, sometimes two.' },
    ],
    // No study compared strategies for this task (C1 §2.5); every card is derived from the mathematics and
    // checked numerically in the spike (C1 §4.7): the pulls cancel at the best spot (the Varignon frame);
    // the side count is the subgradient rule; four targets round a gap meet where the diagonals cross.
    strategies: [
      {
        id: 'imagery', title: 'Balance the pulls',
        text: 'Picture a string from your spot to every target, each with the same weight hanging on it. The knot settles where the pulls cancel.',
        steps: [
          'Picture an equal pull from your spot towards every target.',
          'Move the spot the way the pulls add up, until they cancel out.',
          'A far target pulls no harder than a near one. The average position leans towards far targets: it is not the answer.',
        ],
        when: 'To finish a first guess, and to check any spot.',
      },
      {
        id: 'analytic', title: 'Count the sides',
        text: 'Lay a line through your spot. If clearly more targets lie on one side of it, move that way. Turn the line and check again.',
        steps: [
          'Count the targets from the left and stop half-way: that is the middle column. Do the same from the top for the middle row. Where they cross is a first guess.',
          'Turn the line round your spot: wherever one side holds clearly more targets, move a little that way.',
          'Four targets: join each one to the target across from it. The best spot is where the two lines cross.',
        ],
        when: 'Fast, and steady with many targets.',
      },
      {
        id: 'switch', title: 'First count, then balance',
        text: 'Counting gives a quick first guess; the pulls finish it.',
        steps: [
          'Count: the middle column and the middle row of the targets cross at a first guess.',
          'Balance: picture equal pulls towards every target and move the guess the way they add up.',
          'Stop where the pulls cancel. Far targets do not get extra pull.',
        ],
        when: 'On every item, until it runs by itself.',
      },
    ],
    checkin: { whole: 'Felt where the pulls balance', parts: 'Counted the targets on each side', unsure: 'Not sure, or both' },
    captions: {
      // the board and the controls
      describe: 'A board of 7 by 7 dots with {n} targets: {list}. Answers lie on the dots and half-way between them. Move the marker with the arrow keys (it starts in the middle) and press Enter to answer.',
      targetAt: 'column {x}, row {y}',
      boardLabel: 'Board: tap to place the marker',
      markerAt: 'Marker at column {x}, row {y}',
      markerNone: 'No marker yet',
      confirm: 'Confirm',
      nudgeLeft: 'Move left half a dot',
      nudgeRight: 'Move right half a dot',
      nudgeUp: 'Move up half a dot',
      nudgeDown: 'Move down half a dot',
      move: 'Move',
      moveLabel: 'Move buttons',
      hintQuick: 'Tap to place, tap the marker again to answer.',
      hintExact: 'Tap to place, then drag or nudge, then Confirm.',
      hintKeys: 'Arrow keys move half a dot · Enter answers',
      // after the answer
      totals: 'Your total {you} · best {best} (+{pct} %)',
      totalsBest: 'Your total {best}: the least there is.',
      totalsNone: 'Best total {best}.',
      bestSpot: 'You found the best spot.',
      within: 'Not the best spot, but within {band} % of its total: close enough to count as right.',
      outside: '{pct} % farther in total than the best spot; right means within {band} % of it.',
      near: 'A near miss: {pct} % farther in total than the best spot; right means within {band} % of it. Close spots still earn round points.',
      late: 'Time ran out with the marker here: it still earns part of its closeness.',
      noAnswer: 'No answer in time. The best spot is marked.',
      you: 'you',
      best: 'best',
      youBest: 'you · best',
      map: 'Map',
      hideMap: 'Hide map',
      mapLabel: 'Show lines of equal total distance',
      bandLine: 'band',
      contourNote: 'Lines of equal total: inside the bold line counts as right; the others are {levels} farther.',
      // Why? (show me, from the same model as the score)
      whyCount: 'Start from a first guess: half-way through the targets from the left, and from the top.',
      whyPulls: 'Every target pulls on the spot with the same strength, however far away it is.',
      whyChainMove: 'Line the pulls up end to end, each one starting where the last one stops.',
      whyChain: 'They do not come back to the spot. The gap is the leftover pull: it points the way to a smaller total.',
      whyMove: 'Follow the leftover pull: the gap closes as the spot moves.',
      whyBalanced: 'Here the line of pulls closes: they cancel. This is the balance point.',
      whyClosed: 'End to end, the pulls come back to the spot: they cancel here. This is the balance point.',
      whySlide: 'Slide the farthest target along its line: its pull keeps the same strength and direction, so the balance point stays put.',
      whyBack: 'Distance changes the total, not the pull: only the directions to the targets decide the balance point.',
      whySnap: 'Answers sit on dots and half-way points: the best one is right beside the balance point.',
      // the Watch (demo); the Watch alone shows the average once
      demoTargets: 'Five targets: four round an empty dot, one far away. Find the spot with the least total distance to all five.',
      demoCount: 'First count from the left: half-way through the targets is this column.',
      demoCountRow: 'From the top, half-way is this row. Where they cross is a first guess.',
      demoPulls: 'Then balance: every target pulls on the spot with the same strength, however far away it is.',
      demoChainMove: 'Line the pulls up end to end, each one starting where the last one stops.',
      demoChain: 'They do not come back to the spot. The gap is the leftover pull, towards the far target.',
      demoMove: 'Move the spot the way the leftover pull points…',
      demoBalanced: '…until the line of pulls closes. Here they cancel: the balance point.',
      demoSnap: 'Answers sit on dots and half-way points: the best one is right beside the balance point.',
      demoAverage: 'The average position leans towards the far target. It is not the answer.',
      demoAnswerQuick: 'Your turn: tap the best spot, then tap the marker again to answer.',
      demoAnswerExact: 'Your turn: tap near the best spot, nudge it if needed, then Confirm.',
      averageLabel: 'average',
      // the rules card's pictures (aria-hidden; the rule text says it)
      ruleBar: 'time left',
    },
    bridge: 'Where should several people meet, or where should something everyone walks to go: a table, a bin, a stall? That is this task, known in planning as the Weber problem. Real choices use roads and travel times and often care about whoever travels farthest; whether practice here changes them has not been tested.',
  });
})(window.PX);
