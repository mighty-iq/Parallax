/* PR-5 Level: instruction data (pure, data only; PHASE-B "Probes", PLAN.md §4 and §8).
   A probe is never trained: no practice items, no tips, no strategy cards and no feedback in the
   Spatial Check. Before its first item the Check shows one screen: `instruction` plus the worked
   example (`demo[0]`, played by view.demo with `captions`) at the easiest level, from a fixed seed
   that the Check never scores (its items take seeds from PX.rng.hash('px-probe', …)).
   Shapes as in js/ex/cubematch/learn.js. Wording: about the task, never the person. */
(function (PX) {
  'use strict';

  PX.ex.learn('level', {
    goal: 'Which picture shows the water surface (or the hanging string) correctly?',
    parts: [
      { id: 'upright', label: 'Upright', text: 'The glass standing upright, partly full (or the frame upright, with a weight hanging on a string from a pin).' },
      { id: 'tilted', label: 'Tilted', text: 'The same glass or frame, tilted.' },
      { id: 'options', label: 'Pictures', text: 'Four pictures of the tilted glass or frame, each with a different line.' },
      { id: 'answer', label: 'Answer', text: 'Pick the picture that shows the line correctly: tap it or press 1–4.' },
      { id: 'time', label: 'Time bar', text: 'The bar under the drawing shows the time left for this item.' },
    ],
    instruction: {
      title: 'Level',
      lines: [
        'A glass with some water in it is tilted; or a frame with a weight hanging inside it is tilted.',
        'Pick the picture that shows the water surface, or the string, the way it would really be.',
        'Some pictures show the line the way people often draw it by mistake.',
        'There is no feedback in this check. Answer as well as you can; a guess is fine when you are unsure.',
      ],
    },
    // The easiest level (a small tilt, the nearest wrong line 16° away), one of each task.
    demo: [
      { params: { tilt: 0, task: 0, gap: 0 }, seed: 1, kind: 'water' },
      { params: { tilt: 0, task: 1, gap: 0 }, seed: 1, kind: 'plumb' },
    ],
    captions: {
      uprightWater: 'Here is the glass upright, partly full of water.',
      uprightPlumb: 'Here is the frame upright, with a weight hanging on a string from a pin.',
      tiltedWater: 'Now the same glass is tilted.',
      tiltedPlumb: 'Now the same frame is tilted; the pin stays where it is.',
      options: 'Each picture shows a different line. Only one is right.',
      guideWater: 'Water settles level with the ground however the glass is tilted: the dashed line is level.',
      guidePlumb: 'A weight always hangs straight down: the dashed line goes straight down from the pin.',
      matchWater: 'Picture {a} has its water surface on the level line.',
      matchPlumb: 'Picture {a} has its string on the straight-down line.',
      answer: 'So the answer is picture {a}.',
      tagLevel: 'Level',
      tagDown: 'Straight down',
      kind_frame: 'Lined up with the container',
      kind_side: 'Square to a side wall',
      kind_half: 'Halfway',
      kind_over: 'Turned too far back',
      kind_beyond: 'Past the container',
      kind_steep: 'Twice the tilt',
      kind_near: 'Slightly off',
      verdictWater: 'Picture {a} shows the level water surface',
      verdictPlumb: 'Picture {a} shows the string hanging straight down',
    },
  });
})(window.PX);
