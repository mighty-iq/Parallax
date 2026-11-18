/* EX-06 Slice: its add-on layers (v1.2 wave 2, W2-bets; PLAN milestone 4; note T1 §4.2). Pure. For now the
   off-screen challenge, the hands-on side of Slice's bridging bet: the exercise page shows it with
   "I did it" (offscreen events). Comparison rounds and the "Scans and cuts" bridge set come later. */
(function (PX) {
  'use strict';
  var B = PX.engine && PX.engine.bets;
  if (!B || !PX.ex.get('slice')) return;
  B.register('slice', {
    offscreen: {
      id: 'slice-cut', title: 'Cut a vegetable at a slant',
      text: 'Cut a carrot, a potato or a block of clay, and draw the shape of the cut face before you look at it.',
      steps: [
        'Use a board and a sharp knife, and cut away from your fingers.',
        'Before each cut, draw the face you expect: first a slice straight across, then one at a slant.',
        'Cut, hold the piece face up and compare it with your drawing.',
        'Cut a round carrot at a slant: the face is an oval, and it gets longer the more you slant.',
      ],
      note: 'Whether hands-on practice like this changes how you read scans or drawings has not been tested.',
    },
  });
})(window.PX);
