/* EX-13 Knots: its add-on layers (v1.2 wave 2, W2-bets; PLAN milestone 4; note T1 §4.2). Pure. For now the
   off-screen challenge (tie it, then pull): the exercise page shows it with "I did it" (offscreen events).
   Knots' comparison rounds come later; its tutorial's minimal pair (one crossing switched, the rope falls
   open) is the comparison it has today. */
(function (PX) {
  'use strict';
  var B = PX.engine && PX.engine.bets;
  if (!B || !PX.ex.get('knots')) return;
  B.register('knots', {
    offscreen: {
      id: 'knots-pull', title: 'Tie it, then pull',
      text: 'With a shoelace or a piece of string, copy a rope from an item, decide whether a knot stays when you pull the ends, then pull.',
      steps: [
        'Lay the string on a table in the shape of one of the ropes, each crossing over or under as drawn.',
        'Decide before you pull: will a knot remain?',
        'Pull both ends slowly and watch which crossings slide out.',
        'Switch one crossing, lifting the strand that was under, and try again.',
      ],
      note: 'People who score higher on spatial tests learn to tie knots a little more easily; whether practice here changes knot tying has not been tested.',
    },
  });
})(window.PX);
