/* EX-09 Block Span: tutorial data (pure, data only; ARCHITECTURE.md §2, PLAN.md §8; shapes as in
   js/ex/rotate/learn.js). Watch–Try–Go: goal and labelled parts → demo (view.demo replays the item
   with `captions`) → practice items (not logged) with just-in-time tips → an easy scored start.
   demo[].kind says what the seed gives (tested in tests/node/span.test.mjs): 'forward' (no turn),
   'turn' (forward with a 90° turn), 'backward' (no turn).
   Wording rules (CLAUDE.md 2, 12): about the task, never the person; no IQ or "mastered". */
(function (PX) {
  'use strict';

  PX.ex.learn('span', {
    goal: 'Watch the blocks light up one at a time, then tap them in the same order.',
    goals: {
      forward: 'Watch the blocks light up one at a time, then tap them in the same order.',
      backward: 'Watch the blocks light up one at a time, then tap them in reverse order, the last one first.',
    },
    parts: [
      { id: 'board', label: 'Board', text: 'Nine blocks on a board. They stay where they are, unless the whole board turns.' },
      { id: 'watch', label: 'Watch', text: 'Blocks light up one at a time, about one a second. Only watch: nothing to press yet.' },
      { id: 'recall', label: 'Your turn', text: 'Tap the blocks in order, or press the number on each block. Backspace takes back the last tap; Enter ends early.' },
      { id: 'turn', label: 'Turn', text: 'At some levels the board turns before your turn. The blocks travel with it: tap them where they are now.' },
    ],
    // Three blocks, no crossing: easy to follow. Seeds checked by the node test.
    demo: [
      { params: { len: 1, cross: 0, turn: 0, variant: 'forward' }, seed: 3, kind: 'forward' },
      { params: { len: 1, cross: 0, turn: 1, variant: 'forward' }, seed: 5, kind: 'turn' },
      { params: { len: 1, cross: 0, turn: 0, variant: 'backward' }, seed: 4, kind: 'backward' },
    ],
    practice: [
      { len: 0, cross: 0, turn: 0, variant: 'forward' },
      { len: 1, cross: 0, turn: 0, variant: 'forward' },
      { len: 2, cross: 0, turn: 0, variant: 'forward' },
      { len: 1, cross: 0, turn: 0, variant: 'backward' },
      { len: 1, cross: 0, turn: 1, variant: 'forward' },
    ],
    tips: [
      { id: 'backward', when: { variant: 'backward' }, text: 'Backward: tap the blocks in reverse order, starting with the last one that lit.' },
      { id: 'turn', when: { dim: 'turn', levels: [1, 2] }, text: 'This board turns after the last block. The blocks travel with it: tap them where they are after the turn.' },
      { id: 'cross', when: { dim: 'cross', levels: [1, 2] }, text: 'The path between the blocks may cross itself. Picture the lines as one drawing.' },
      { id: 'long', when: { dim: 'len', levels: [4, 5, 6, 7] }, text: 'A long sequence: split it into groups of two or three blocks and repeat the groups to yourself.' },
    ],
    // Paths with spatial structure are recalled better and crossings make recall harder (De Lillo
    // et al. 2016): seeing the order as a drawing uses that structure. Grouping a sequence into
    // chunks is the classic way to hold more items (research/B-tasks.md §7). Switching rule [DJ].
    strategies: [
      {
        id: 'imagery', title: 'See the path as a drawing',
        text: 'Join the blocks in your mind as they light up, like a pen drawing one line from block to block. Remember the drawing, then trace it.',
        steps: [
          'As each block lights, picture a line from the one before.',
          'Notice the shape the line makes: a zigzag, a hook, a loop.',
          'On your turn, trace the same line with your taps.',
        ],
        when: 'Good for paths that do not cross themselves.',
      },
      {
        id: 'analytic', title: 'Group and repeat',
        text: 'Split the sequence into small groups and name them by place, such as "top left, middle", then "bottom right, far left".',
        steps: [
          'Make a group every two or three blocks.',
          'Give each block a short place name while you watch.',
          'Repeat the groups to yourself until it is your turn.',
        ],
        when: 'Steady for long sequences and for paths that cross themselves.',
      },
      {
        id: 'switch', title: 'When to switch',
        text: 'Neither way is always better: when one stalls, try the other.',
        steps: [
          'If the drawing gets tangled (many crossings), switch to groups.',
          'If the groups blur, look for the drawing they make.',
          'With a turn, turn the whole drawing with the board, not one block at a time.',
        ],
        when: 'After two misses in a row, try the other way on the next item.',
      },
    ],
    captions: {
      board: 'Nine blocks on a board.',
      watch: 'Watch: the blocks light up one at a time.',
      path: 'This is the order the blocks lit, joined by a line.',
      turn: 'Then the board turns {n}, and every block travels with it.',
      forward: 'Your turn: tap the blocks in the same order, from 1 to the end.',
      backward: 'Backward: start with the last block that lit and go back along the line.',
      after: 'After the turn the order is the same; only the places have moved.',
      compare: 'Your taps were right up to tap {n}; the numbers show the right order.',
      none: 'The first tap was not the first block; the numbers show the right order.',
      right: 'All in the right order.',
      try: 'Now you: tap the blocks in order.',
    },
    bridge: 'Holding a short list of places in mind is part of following directions, retracing a route or learning a new screen layout. Practising here improves this task and often similar memory tasks; it has not been shown to improve everyday memory, school or work. It can also raise scores on clinical block-tapping tests, so mention your practice if you take one.',
  });
})(window.PX);
