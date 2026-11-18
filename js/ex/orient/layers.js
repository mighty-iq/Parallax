/* EX-08 Orient: its add-on layers (v1.2 wave 2, W2-bets; PLAN milestone 4; note T1 §4.1, §4.2). Pure: the facts
   a comparison round states about a solved map, from the item's positions, and the off-screen challenge.
   Drawing: layers-view.js.

   Principle (proved on the model, tests/node/layers-orient.test.mjs):
     swap   facing down the map (a heading more than 90° from the map's up) puts the map's top behind you;
            facing straight down, your right is the screen's left for every target (the side of a target is
            the sign of the cross product of the facing and the target's direction; checked on every item). */
(function (PX) {
  'use strict';

  var B = PX.engine && PX.engine.bets, def = PX.ex.get('orient');
  if (!B || !def) return;
  var lib = def.lib;

  function A(it) { return it.objects[it.at]; }
  function dist(p, q) { var dx = p.x - q.x, dy = p.y - q.y; return Math.sqrt(dx * dx + dy * dy); }
  function norm360(a) { return ((a % 360) + 360) % 360; }
  // The answer's side: right of the facing (0–180°) or left; the target's side as the screen shows it from
  // the stand point (its bearing from map up: right half 0–180°).
  function rightOfYou(it) { var k = norm360(it.key); return k > 0 && k < 180; }
  function rightOnScreen(it) { var b = norm360(it.targetBearing); return b > 0 && b < 180; }
  function down(it) { return Math.abs(it.heading) > 90; }
  function never() { return false; }

  var STATEMENTS = [
    { id: 'swap', text: 'You face down the map, so the top of the map is behind your back.', test: down },
    { id: 'face-up', text: 'You face up the map, the same way as the top of the screen.', test: function (it) { return Math.abs(it.heading) < 45; } },
    { id: 'egocentric', text: 'Left and right on the screen stay your left and right facing down.', test: never },
    { id: 'right-side', text: 'The third object is on your right-hand side.', test: rightOfYou },
    { id: 'behind', text: 'The third object lies behind you, past a quarter turn from ahead.', test: function (it) { var k = norm360(it.key); return k > 90 && k < 270; } },
    { id: 'nearer', text: 'The third object is nearer to you than the one you face.', test: function (it) { return dist(A(it), it.objects[it.target]) < dist(A(it), it.objects[it.facing]); } },
    { id: 'many', text: 'The map shows seven or more objects to choose from.', test: function (it) { return it.objects.length >= 7; } },
  ];

  B.register('orient', {
    compare: {
      principles: [
        { id: 'swap', claim: 'swap', anyItem: true, applies: function (p) { return !p || p.shift >= 2; },
          text: 'Facing down the map, its top is behind you. Turn the map round in your mind before you point: facing straight down, your left is the screen’s right.' },
      ],
      statements: STATEMENTS,
    },
    offscreen: {
      id: 'orient-map', title: 'Turn a map on a walk',
      text: 'On a walk with a printed or phone map, point to a place before you turn the map, then check.',
      steps: [
        'Stop where you can see two landmarks that are on the map, such as a church and a bridge.',
        'Without turning the map, face one landmark and point to a third place you cannot see.',
        'Now turn the map so the landmark you face is at its top, and check where you pointed.',
        'Try it facing back the way you came: that is where left and right swap.',
      ],
      note: 'Rotation practice went with better perspective taking in one study; whether this exercise changes map use outdoors has not been tested.',
    },
    facts: { rightOfYou: rightOfYou, rightOnScreen: rightOnScreen, down: down },
  });
})(window.PX);
