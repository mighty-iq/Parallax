/* EX-03 Spin: its add-on layers (v1.2 wave 2, W2-bets; PLAN milestone 4; note T1 §4.1). Pure: the facts a
   comparison round states about a solved item, from the item's model. Drawing: layers-view.js.

   Principle (proved on the model, tests/node/layers-spin.test.mjs):
     mirror-never  the figures that do not match the reference are mirror images, and no turn makes a mirror
                   image match: on every item the figure is chiral (its 8 lattice forms differ), and a
                   mirror option turned back by its own turn is the reference reflected, never the reference
   Statements a solved item can make true or false: the shared turn direction, the turn's size, the
   number of squares; and three wrong rules that no item makes true (mirror images that a turn fixes, that
   turn the other way, that have another number of squares). */
(function (PX) {
  'use strict';

  var B = PX.engine && PX.engine.bets, def = PX.ex.get('spin');
  if (!B || !def) return;

  function mirrors(it) { return it.variant === 'pick' ? it.options.filter(function (o) { return o.mirror; }) : it.probe && it.probe.mirror ? [it.probe] : []; }
  function copies(it) { return it.variant === 'pick' ? it.options.filter(function (o) { return !o.mirror; }) : it.probe && !it.probe.mirror ? [it.probe] : []; }
  function never() { return false; }

  var STATEMENTS = [
    { id: 'mirror-never', text: 'The shapes that do not match are mirror images: no turn can fix it.', test: function (it) { return mirrors(it).length > 0; } },
    { id: 'mirror-turn', text: 'The mirror images would match as well, turned far enough round.', test: never },
    { id: 'mirror-way', text: 'The mirror images are turned the other way round from the matching copies.', test: never },
    { id: 'mirror-size', text: 'Each mirror image has one square more or fewer than the shape.', test: never },
    { id: 'clockwise', text: 'Every turned shape here is turned clockwise from the first one.', test: function (it) { return it.dir === 1; } },
    { id: 'big-turn', text: 'The shapes are turned more than a quarter turn.', test: function (it) { return it.angle > 90; } },
    { id: 'small-shape', text: 'The shapes are made of six squares or fewer, so there are few parts to check.', test: function (it) { return it.shape.n <= 6; } },
  ];

  B.register('spin', {
    compare: {
      principles: [
        // every item is decided by handedness (same or mirror), so the apply item is the step's own: choosing
        // one with a mirror would give away "mirror" on a same-or-mirror item
        { id: 'mirror-never', claim: 'mirror-never', anyItem: true,
          text: 'A mirror image never matches its shape, however far you turn it on the screen; only a turned copy does. Turn one back and check which side each part is on.',
          vary: function (p, r) { return { angle: r.int(0, 8), cells: r.int(0, 4), variant: p.variant }; } },
      ],
      statements: STATEMENTS,
    },
    facts: { mirrors: mirrors, copies: copies },
  });
})(window.PX);
