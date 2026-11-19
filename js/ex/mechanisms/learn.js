/* PR-3 Mechanisms: instruction data (pure, data only; PHASE-B.md "Probes", PLAN.md §4 and §8).
   A probe is never trained: no practice items, tips or strategy cards. The one-screen instruction
   names the parts and plays one worked example (view.demo) at the easiest level with a fixed seed
   that the Spatial Check never scores. Captions are read by view.demo and view.showMe ({…} filled
   in by the view from the item's own model). Wording is about the task, never the person. */
(function (PX) {
  'use strict';

  PX.ex.learn('mechanisms', {
    goal: 'When the driver turns, which way and how fast does the marked part turn?',
    // Version 2 (v1.2): one question with five answers, named on the card, so no item asks something the screen never
    // showed.
    // the task card's lines in a Spatial Check (js/ui/measure.js folds the instruction away under "More about this
    // task"): what the first item needs, its own question being on the screen with it
    brief: ['The driver turns the way its arrow shows. For the part marked with a dashed ring, pick which way it turns and whether it turns faster or slower than the driver, or that it cannot turn at all.'],
    instruction: [
      'Each picture shows gears and often belts. The driver turns the way its arrow shows; the question is about the part marked with a dashed ring.',
      'Which way, and how fast? The marked part turns clockwise or counter-clockwise, and faster or slower than the driver; or it cannot turn at all, because gears that form a loop can jam.',
      'Take the time you need: the bar under the picture shows the time left. The Check does not show whether an answer was right.',
    ],
    parts: [
      { id: 'driver', label: 'Driver', text: 'The wheel that is turned by hand. Its arrow shows the way it turns.' },
      { id: 'marked', label: 'Marked', text: 'The part the question is about: a gear or a pulley.' },
      { id: 'belt', label: 'Belts', text: 'An open belt keeps the direction; a crossed belt reverses it.' },
      { id: 'answer', label: 'Answer', text: 'Five answers: keys 1 to 5, or tap one.' },
    ],
    // The worked example (version 2): 3 axles, chain level, an open belt on the route; the marked part turns
    // counter-clockwise and 4 times for every 3 turns of the driver.
    demo: [{ params: { gears: 0, structure: 0 }, seed: 3, kind: 'ccw-faster' }],
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
      answerDirSpeed: 'The marked part makes {n} turns for every {d} turns of the driver: {answer}.',
      answerJam: 'Nothing can turn: the answer is “{answer}”.',
      keys: 'Answer with the keys 1 to 5, or tap an answer.',
      cw: 'clockwise',
      ccw: 'counter-clockwise',
    },
    questions: {
      dir: 'Which way does the marked part turn?',
      lift: 'Does the weight go up or down?',
      speed: 'Compared with the driver, how fast does the marked part turn?',
      dirspeed: 'Which way does the marked part turn, and is it faster or slower than the driver?',
    },
  });
})(window.PX);
