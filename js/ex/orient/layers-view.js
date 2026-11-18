/* EX-08 Orient: drawing for the add-on layers (v1.2 wave 2, W2-bets; js/ex/orient/layers.js).
   PX.ui.betsViews.orient.solved(host, item, opts) draws a solved map: the objects, where you stand (a filled
   dot), the object you face (a ring, with the facing line) and the third object (green ring, with the answer
   arrow); mark(true) adds your left and right at the stand point and a dashed arrow to the map's top, which
   points behind you. Ink and green only. Map units 0–100, y down. */
(function (PX) {
  'use strict';

  var NS = 'http://www.w3.org/2000/svg';
  var V = PX.ui.betsViews = PX.ui.betsViews || {};
  function E(tag, attrs, kids) {
    var el = document.createElementNS(NS, tag);
    for (var k in attrs) if (Object.prototype.hasOwnProperty.call(attrs, k)) el.setAttribute(k, attrs[k]);
    (kids || []).forEach(function (c) { if (c) el.appendChild(c); });
    return el;
  }
  function text(x, y, s, cls) { var t = E('text', { x: x.toFixed(2), y: y.toFixed(2), class: cls, 'text-anchor': 'middle', 'dominant-baseline': 'central' }); t.textContent = s; return t; }
  function head(x0, y0, x1, y1, cls) {
    var dx = x1 - x0, dy = y1 - y0, d = Math.sqrt(dx * dx + dy * dy) || 1, ux = dx / d, uy = dy / d, a = 5, w = 2.6;
    return E('path', { d: 'M' + x1.toFixed(2) + ' ' + y1.toFixed(2) + ' L' + (x1 - ux * a - uy * w).toFixed(2) + ' ' + (y1 - uy * a + ux * w).toFixed(2) + ' L' + (x1 - ux * a + uy * w).toFixed(2) + ' ' + (y1 - uy * a - ux * w).toFixed(2) + ' Z', class: cls });
  }

  V.orient = {
    solved: function (host, item) {
      var O = item.objects, A = O[item.at], Bf = O[item.facing], Cg = O[item.target];
      var svg = E('svg', { viewBox: '-4 -4 108 108', class: 'px-bets-fig bets-or', role: 'img',
        'aria-label': 'A map: you stand at ' + A.name + ' facing ' + Bf.name + '; the arrow points to ' + Cg.name });
      svg.appendChild(E('rect', { x: 0, y: 0, width: 100, height: 100, class: 'bets-or-map' }));
      O.forEach(function (o, i) { if (i !== item.at && i !== item.facing && i !== item.target) svg.appendChild(E('circle', { cx: o.x, cy: o.y, r: 2.4, class: 'bets-or-obj' })); });
      svg.appendChild(E('line', { x1: A.x, y1: A.y, x2: Bf.x, y2: Bf.y, class: 'bets-or-face' }));
      var dx = Cg.x - A.x, dy = Cg.y - A.y, d = Math.sqrt(dx * dx + dy * dy) || 1, end = Math.max(0, d - 5);
      var ex = A.x + dx / d * end, ey = A.y + dy / d * end;
      svg.appendChild(E('line', { x1: A.x, y1: A.y, x2: ex, y2: ey, class: 'bets-or-ans' }));
      svg.appendChild(head(A.x, A.y, ex, ey, 'bets-or-anshead'));
      svg.appendChild(E('circle', { cx: Bf.x, cy: Bf.y, r: 3.6, class: 'bets-or-facing' }));
      svg.appendChild(E('circle', { cx: Cg.x, cy: Cg.y, r: 3.6, class: 'bets-or-target' }));
      svg.appendChild(E('circle', { cx: A.x, cy: A.y, r: 3.2, class: 'bets-or-you' }));
      // the rule: your left and right at the stand point, and the map's top behind you
      var markG = E('g', { class: 'bets-or-markg' });
      markG.style.display = 'none';
      var fx = Bf.x - A.x, fy = Bf.y - A.y, fl = Math.sqrt(fx * fx + fy * fy) || 1;
      fx /= fl; fy /= fl;
      var rx = -fy, ry = fx; // your right (y down)
      markG.appendChild(text(A.x + rx * 9, A.y + ry * 9, 'R', 'bets-or-side'));
      markG.appendChild(text(A.x - rx * 9, A.y - ry * 9, 'L', 'bets-or-side'));
      var ty = Math.max(4, A.y - 16);
      markG.appendChild(E('line', { x1: A.x, y1: A.y - 4, x2: A.x, y2: ty + 4, class: 'bets-or-top' }));
      markG.appendChild(head(A.x, A.y - 4, A.x, ty, 'bets-or-tophead'));
      markG.appendChild(text(A.x + 7, ty + 2, 'top', 'bets-or-toplabel'));
      svg.appendChild(markG);
      host.appendChild(svg);
      return { mark: function (on) { markG.style.display = on ? '' : 'none'; } };
    },
  };
})(window.PX);
