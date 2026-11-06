/* PR-3 Mechanisms: instruction data (pure, data only; PHASE-B.md "Probes", PLAN.md §4 and §8).
   A probe is never trained: no practice items, tips or strategy cards. The one-screen instruction
   names the parts and plays one worked example (view.demo) at the easiest level with a fixed seed
   that the Spatial Check never scores. Captions are read by view.demo and view.showMe ({…} filled
   in by the view from the item's own model). Wording is about the task, never the person. */
(function (PX) {
  'use strict';

  PX.ex.learn('mechanisms', {
    goal: 'When the driver turns, how does the marked part move?',
    // The three kinds of question, each named, so no item asks something the screen never showed.
    instruction: [
      'Each picture shows gears, often belts, and sometimes a drum with a rope and a weight. The driver turns the way its arrow shows; the question is about the part marked with a dashed ring.',
      'Which way? Does the marked part turn clockwise or counter-clockwise, or can it not turn at all? Gears that form a loop can jam.',
      'Up or down? When the marked part is a drum, it winds the rope in (the weight goes up) or lets it out (the weight goes down), or it cannot move.',
      'Faster or slower? Compared with the driver, does the marked part turn faster, at the same speed, or slower?',
      'Take the time you need: the bar under the picture shows the time left. The Check does not show whether an answer was right.',
    ],
    parts: [
      { id: 'driver', label: 'Driver', text: 'The wheel that is turned by hand. Its arrow shows the way it turns.' },
      { id: 'marked', label: 'Marked', text: 'The part the question is about: a gear, a pulley or a winch drum.' },
      { id: 'belt', label: 'Belts', text: 'An open belt keeps the direction; a crossed belt reverses it.' },
      { id: 'answer', label: 'Answer', text: 'Three answers: keys 1 to 3, or tap one.' },
    ],
    // The worked example: 3 axles, chain level, direction question. Seed 6: the driver gear meshes
    // a gear that carries a pulley, and an open belt takes the turn to the marked pulley.
    demo: [{ params: { gears: 0, structure: 0, question: 0 }, seed: 6, kind: 'ccw' }],
    practice: [],
    tips: [],
    captions: {
      driver: 'This is the driver. It turns {dir}, as its arrow shows.',
      marked: 'This is the marked part. The question is about it.',
      mesh: 'Gears that mesh turn opposite ways: now {dir}.',
      open: 'An open belt keeps the direction: still {dir}.',
      crossed: 'A crossed belt reverses the direction: now {dir}.',
      axle: 'Wheels on one axle turn together, the same way and at the same speed.',
      watch: 'Watch the whole mechanism turn.',
      jam: 'These gears form a loop with an odd number of gears. Each would have to turn both ways at once, so nothing can move.',
      evenLoop: 'This loop has an even number of gears, so it turns freely.',
      rope: 'The rope leaves the {side} side of the drum. Turning {dir}, the drum {action} the rope.',
      reel: 'winds in',
      payOut: 'lets out',
      answerDir: 'So the marked part turns {answer}.',
      answerLift: 'So the weight goes {answer}.',
      answerSpeed: 'The marked part makes {n} turns for every {d} turns of the driver: {answer}.',
      answerJam: 'Nothing can turn: the answer is “{answer}”.',
      keys: 'Answer with the keys 1 to 3, or tap an answer.',
      cw: 'clockwise',
      ccw: 'counter-clockwise',
    },
    questions: {
      dir: 'Which way does the marked part turn?',
      lift: 'Does the weight go up or down?',
      speed: 'Compared with the driver, how fast does the marked part turn?',
    },
  });
})(window.PX);
