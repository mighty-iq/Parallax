/* PR-7 Motion Graphs: instruction data (pure, data only; PLAN milestone 6; note T1 §5.2).
   A probe is never trained: no practice items, no tips and no feedback. Before the first item the Check shows
   `instruction`; before each kind's first item on first contact, that kind's worked example (`demo` with
   params.variant, played by view.demo with `explain`), from fixed seeds the Check never scores. No physics is needed:
   the examples say what a graph over time is. Wording: about the task, never the person. */
(function (PX) {
  'use strict';

  PX.ex.learn('motiongraphs', {
    goal: 'Match a cart\'s motion with its graph or its picture.',
    // the card's text: what the first item needs (the instruction folds away under "More about this task")
    brief: ['A cart rolls along a straight track. A strobe picture shows where it was at seven flashes, one second apart (the dots are numbered); a graph shows the same motion over time, with time running to the right.'],
    instruction: {
      title: 'Motion Graphs',
      lines: [
        'A cart rolls along a straight track. A strobe picture shows where it was at seven flashes, one second apart: the dots are numbered in order.',
        'Some questions show the motion as a graph over time instead: time runs to the right, and the line shows where the cart was (or how fast it went) at each moment.',
        'There is no feedback in this check, and no physics is needed. Answer as well as you can; a guess is fine when you are unsure.',
      ],
    },
    // each kind's one line, shown under the question of its first item in the Check (js/ui/measure.js): short enough
    // for two lines on a small phone; the worked examples read `explain`
    kinds: {
      pos: 'Each dot is one second later: far apart means fast, close together slow.',
      vel: 'The gaps between the dots show the speed: a wide gap is a fast second.',
      strobe: 'Read the graph left to right, one step per flash: steep means fast.',
      frame: 'From the bus, each dot moves back by how far the bus has gone so far.',
    },
    demo: [
      { params: { variant: 'pos', level: 0 }, seed: 21, kind: 'pos' },
      { params: { variant: 'vel', level: 0 }, seed: 22, kind: 'vel' },
      { params: { variant: 'strobe', level: 0 }, seed: 23, kind: 'strobe' },
      { params: { variant: 'frame', level: 0 }, seed: 24, kind: 'frame' },
    ],
    explain: {
      pos: ['Read the dots in order: each one is a second later. Where they are far apart the cart was fast; close together, slow; on top of each other, standing still.', 'The position graph climbs while the cart moves right, falls while it moves left and stays flat while it stands; it is steep where the cart is fast.'],
      vel: ['The gaps between the dots show the speed: a wide gap is a fast second, a small gap a slow one.', 'The velocity graph is high while the cart moves right fast, on the dashed line while it stands still and below it while it moves left.'],
      strobe: ['Read the graph from left to right: one step for each flash. Steep means the cart covered a lot of track in that second.', 'Look for the picture whose gaps grow and shrink the way the graph is steep or flat, and goes the same way along the track.'],
      frame: ['From the bus, each dot moves back by how far the bus has gone: not at all at flash 1, one bus step at flash 2, two at flash 3, and so on.', 'So the cart seems to move less than it does, or even backwards: take each dot and move it back by the bus\'s steps so far.'],
    },
  });
})(window.PX);
