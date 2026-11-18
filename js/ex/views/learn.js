/* EX-07 Views: tutorial data (pure, data only; ARCHITECTURE.md §2, PLAN.md §8).
   Watch–Try–Go: goal and labelled parts → demo (view.demo plays it with `captions`) → practice
   items (not logged) with just-in-time tips → an easy scored start. Shapes as in
   js/ex/rotate/learn.js, plus `offscreen` (as in js/ex/fold/learn.js): an optional challenge with
   real blocks and a pencil. Wording (CLAUDE.md 2, 12): about the task, never the person. */
(function (PX) {
  'use strict';

  PX.ex.learn('views', {
    goal: 'Match a block structure with its flat views: top, front and right.',
    goals: {
      toview: 'Which line drawing is the structure seen straight on from the side the arrow marks?',
      toobject: 'Which structure has exactly these three views: top, front and right?',
      count: 'How many cubes does the structure have? Every cube shows at least one face.',
    },
    parts: [
      { id: 'structure', label: 'Structure', text: 'Unit cubes stacked on a grid, seen from the front-right corner. The thick edge of the base is the front.' },
      { id: 'arrow', label: 'Arrow', variant: 'toview', text: 'The side to look from: top, front or right. Seen straight on, depth disappears and only flat outlines remain.' },
      { id: 'drawings', label: 'Three views', variant: 'toobject', text: 'Top above front, right beside front, at the same scale, as in engineering drawings.' },
      { id: 'lines', label: 'Lines', text: 'A line marks an edge: where the surface steps nearer or farther. Flat faces at the same depth merge into one region.' },
      { id: 'answer', label: 'Answer', text: 'Tap an option or press its key (1–4).' },
    ],
    // The teaching template (v1.2, docs/research/v1.2/D2-first-band.md §3.0 C, §3.1): the rules card
    // first, the Watch at the starter level (3–4 cubes, at most 2 high, top view), the "Outline
    // first, then inner lines" card before Try 1, Try 1 with the outline already drawn, then the
    // front view at the starter level, the pre-1.2 floor (top) and its front view. Try stays in
    // toview, the variant of Train's first run; count and toobject get their own Watch (below) when
    // their first run starts. Format rules before practice: d ≈ 0.9–1.2 on the format (via R4 §4.2);
    // showing the informative view (Keehner et al. 2008, via D2 §2.3). Figures: view.drawRule.
    rules: [
      { text: 'The thick edge of the base is the front. The arrow marks the side you look from.', fig: 'front' },
      { text: 'A view is flat: lines only where the surface steps nearer or farther.', fig: 'flat' },
      { text: 'In a top view the front is at the bottom of the drawing.', fig: 'top' },
    ],
    strategyFirst: 'outline',
    // One Watch per variant (the player plays the item's own); the first is the main variant at the
    // starter level, with both foil kinds Try uses (another direction, a neighbouring structure).
    // Seeds are fixed so the answers vary their slot (Watch 3, Try 2, 4, 1, 3) and no Try item has a
    // mirror foil, which the Watch cannot show at the starter level.
    demo: [
      { params: { cubes: 0, grid: 0, view: 0, variant: 'toview' }, seed: 56, kind: 'toview' },
      { params: { cubes: 0, grid: 0, view: 0, variant: 'toobject' }, seed: 2, kind: 'toobject' },
      { params: { cubes: 0, grid: 0, view: 0, variant: 'count' }, seed: 3, kind: 'count' },
    ],
    practice: [
      { params: { cubes: 0, grid: 0, view: 0, variant: 'toview' }, seed: 73, assist: { outline: true } },
      { params: { cubes: 0, grid: 0, view: 1, variant: 'toview' }, seed: 3, tip: 'front' },
      { params: { cubes: 1, grid: 0, view: 0, variant: 'toview' }, seed: 2, tip: 'stacks' },
      { params: { cubes: 1, grid: 0, view: 1, variant: 'toview' }, seed: 6 },
    ],
    tips: [
      // The view tips only where a view is asked or drawn: when.variant may list several variants,
      // and every condition in `when` must hold (not on 'count' items, whose view level means nothing).
      { id: 'top', when: { dim: 'view', levels: [0], variant: ['toview', 'toobject'] }, text: 'From the top you see only the roofs: one cell for each column, whatever its height. The front is at the bottom of the drawing.' },
      { id: 'front', when: { dim: 'view', levels: [1], variant: ['toview', 'toobject'] }, text: 'From the front, each column of the drawing shows the tallest stack in that row, from left to right.' },
      { id: 'right', when: { dim: 'view', levels: [2], variant: ['toview', 'toobject'] }, text: 'From the right, the front of the structure is on the left of the drawing. Turn it in your mind, or walk round it.' },
      { id: 'toobject', when: { variant: 'toobject' }, text: 'Check one view at a time: rule out every structure whose top view does not fit, then use the front and the right.' },
      { id: 'count', when: { variant: 'count' }, text: 'Count column by column: the height of each stack, then add them up. No cube is hidden here.' },
      { id: 'grid', when: { dim: 'grid', levels: [1] }, text: 'A bigger grid: the same rules. Find the front edge first, then read the drawing from there.' },
      { id: 'stacks', when: { dim: 'cubes', levels: [1], variant: 'toview' }, text: 'Bigger structures now, up to four high. One drawing may be the correct one flipped left to right: check which side the front is on.' },
    ],
    // Sorby 2009: sketching views and building block models raised spatial test scores in engineering
    // students. Imagery (moving round the object) and analytic (feature by feature) strategies, and
    // switching between them, as in Hegarty 2010.
    strategies: [
      {
        // The card before Try 1 (strategyFirst; D2 §3.1): the outline first, then the inner lines.
        // Prep courses for view tasks teach elimination on one distinctive feature, then solid
        // against dotted lines (R3 §3.2); [gap] no controlled study of this order for novices was
        // found (D2 §2.3): it is drafting practice. Show-me follows the same three steps.
        id: 'outline', title: 'Outline first, then inner lines',
        text: 'Read a view in two passes: its outline, then the lines inside it.',
        steps: [
          'Find the front, then move in your mind to the side the arrow marks.',
          'Count the cells of the outline across and up; drop the drawings of another size.',
          'Then the inner lines: each one is a step between heights (top view) or depths (front and side views).',
        ],
        when: 'The way to start, and safe on any structure.',
      },
      {
        id: 'imagery', title: 'Walk round it',
        text: 'Picture yourself moving to the marked side and looking straight at the structure, so that depth flattens out.',
        steps: [
          'Find the front edge, then move in your mind to the side the arrow marks.',
          'Look straight on: nearer and farther cubes press into one flat picture.',
          'Keep the outline and the steps between levels; compare with the drawings.',
        ],
        when: 'Quick for small structures and the top view.',
      },
      {
        id: 'analytic', title: 'Read it column by column',
        text: 'Turn the structure into numbers and read each view from them.',
        steps: [
          'Write the height of every column on a top view (a height map).',
          'Front view: for each column from left to right, the tallest stack in it; right view: the same row by row, front on the left.',
          'Lines go where neighbouring heights or depths differ; check those first.',
        ],
        when: 'Steady for large structures and side views.',
      },
      {
        id: 'switch', title: 'When to switch',
        text: 'Neither way is always better: when one stalls, try the other.',
        steps: [
          'If the picture in your head slips, switch to the height map.',
          'If counting gets slow, step back and picture the view for a quick check.',
          'A mirrored drawing has the same parts in the opposite order: check which side the front is on.',
        ],
        when: 'After two misses in a row, try the other way on the next item.',
      },
    ],
    captions: {
      structure: 'This is the structure: unit cubes on a grid. The thick edge of the base is the front.',
      threeViews: 'These are the structure’s three views: top, front and right, at the same scale.',
      arrow: 'The arrow marks the side to look from.',
      optionsToview: 'Four line drawings: one is the view from that side.',
      optionsToobject: 'Four structures: one has exactly these three views.',
      optionsCount: 'Four numbers: one is the number of cubes.',
      // Show me and the Watch (toview) carry out the "Outline first, then inner lines" card; the solving
      // captions start with the card's step (n/3), name the reason and mark what they name
      // (R-reader, note D2 addendum C).
      look: '1/3 · The thick edge is the front: look from the {view}, where the arrow points.',
      move: '1/3 · Move round to the {view}: the shaded faces are what you see from there.',
      trace: 'Every edge where the surface steps nearer or farther becomes a line.',
      land: 'That is drawing {n}.',
      whyDirection: 'Drawing {n} is the view from the {from}, not from the side the arrow marks.',
      whyMirror: 'Drawing {n} is the correct view flipped left to right: check which side the front is on.',
      whyNeighbour: 'Drawing {n} belongs to a slightly different structure: compare it line by line.',
      objIntro: 'Structure {n} has all three views. Check them one at a time.',
      objMove: 'Look at structure {n} from the {view}.',
      objTrace: 'Its {view} view, line by line…',
      objMatch: '…matches the {view} drawing.',
      objWrong: 'Now structure {n}, the one chosen.',
      objDiffer: 'Structure {n} seen from the {view} does not match: the dotted edges differ.',
      countIntro: 'Count column by column: each tag shows the height of one stack.',
      countCol: 'Column by column: {sum}.',
      countTop: 'Seen from the top, the heights add up to {n} cubes.',
      countKey: '{n} cubes: option {k}.',
      tint: 'The faces you see from the {view} are shaded: the view is made of those faces.',
      outline: '2/3 · Outline: {w} × {h} cells, and no other drawing has that size.',
      outlineAll: '2/3 · Outline: {w} × {h} cells: drawings of another size drop out, and the inner lines decide the rest.',
      inner: '3/3 · Inner lines: each one is a step between {what}.',
      innerTop: 'heights',
      innerSide: 'depths',
      whyDirectionTurn: 'Drawing {n} is the view from the {from}: from there it looks like this.',
      whyMirrorFlip: 'Drawing {n} is the correct view flipped left to right.',
      whyNeighbourLines: 'Drawing {n} belongs to another structure: the marked lines differ.',
      assist: 'Step 2 done: the view is {w} × {h} cells.',
      assistLabel: 'Outline {w} × {h}',
    },
    bridge: 'Engineers, architects and machinists read three views like these every day. Practising here improves this task and often similar ones; it has not been shown to improve grades or job performance.',
    offscreen: {
      title: 'Build it, then sketch its views',
      text: 'With 6–10 blocks (dice, sugar cubes or toy bricks), build a structure from one of the items, or invent one, and draw its three views on squared paper.',
      steps: [
        'Build the structure on a sheet of squared paper; mark the front edge.',
        'Before looking, sketch the top, front and right views in pencil: top above front, right beside front.',
        'Check each view by putting your eye level with the blocks, one side at a time, and correct the sketch.',
        'Swap roles with someone: one sketches three views, the other builds the structure from them.',
      ],
      note: 'Sketching views and building block models was part of a spatial-skills course that raised spatial test scores in first-year engineering students (Sorby 2009).',
    },
  });
})(window.PX);
