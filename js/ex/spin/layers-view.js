/* EX-03 Spin: drawing for the add-on layers (v1.2 wave 2, W2-bets; js/ex/spin/layers.js).
   PX.ui.betsViews.spin.solved(host, item, opts) draws a solved item: the shape on top, a turned copy (✓)
   and a mirror image ("mirror") below, at the item's own scale; mark(true) lays the copy, turned to the
   mirror's angle, over the mirror as a dashed outline, so the flip shows. Ink and green only. */
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
  function path(poly) { return poly.map(function (p, i) { return (i ? 'L' : 'M') + p[0].toFixed(3) + ' ' + p[1].toFixed(3); }).join(' ') + ' Z'; }
  function turn(poly, deg, lib) { var sc = lib.sincos(deg); return poly.map(function (p) { return lib.rotate(p, sc); }); }
  function text(x, y, s, cls) { var t = E('text', { x: x, y: y, class: cls, 'text-anchor': 'middle' }); t.textContent = s; return t; }

  V.spin = {
    solved: function (host, item) {
      var lib = PX.ex.get('spin').lib, F = PX.engine.bets.content('spin').facts;
      var R = item.shape.radius * 1.14, S = 2 * R, gap = 0.35 * S;
      var mir = F.mirrors(item)[0] || null, cop = F.copies(item)[0] || null;
      // the copy for the second slot: an option, or the reference turned like the mirror (samediff mirror items)
      var copyPoly = cop ? cop.poly : mir ? turn(item.ref.poly, mir.rot - item.ref.rot, lib) : null;
      var W = 2 * S + gap, H = 3.08 * S;
      var svg = E('svg', { viewBox: [-W / 2, -0.15 * S, W, H].map(function (x) { return x.toFixed(3); }).join(' '), class: 'px-bets-fig bets-spin', role: 'img',
        'aria-label': 'The shape, a turned copy marked as a match and a mirror image marked as no match' });
      function fig(poly, cx, cy, cls) { return E('g', { transform: 'translate(' + cx.toFixed(3) + ' ' + cy.toFixed(3) + ')' }, [E('path', { d: path(poly), class: cls })]); }
      var fs = (S * 0.16).toFixed(3);
      svg.appendChild(fig(item.ref.poly, 0, R, 'bets-spin-shape'));
      svg.appendChild(text(0, S + 0.22 * S, 'shape', 'bets-spin-label')).setAttribute('font-size', fs);
      var y2 = S + 0.55 * S + R, xL = -(S + gap) / 2, xR = (S + gap) / 2;
      if (copyPoly) {
        svg.appendChild(fig(copyPoly, xL, y2, 'bets-spin-copy'));
        svg.appendChild(text(xL, y2 + R + 0.2 * S, '✓ copy', 'bets-spin-label is-ok')).setAttribute('font-size', fs);
      }
      var markG = E('g', { class: 'bets-spin-markg' });
      markG.style.display = 'none';
      if (mir) {
        svg.appendChild(fig(mir.poly, xR, y2, 'bets-spin-mirror'));
        svg.appendChild(text(xR, y2 + R + 0.2 * S, '✗ mirror', 'bets-spin-label')).setAttribute('font-size', fs);
        markG.appendChild(fig(turn(item.ref.poly, mir.rot - item.ref.rot, lib), xR, y2, 'bets-spin-ghost'));
      }
      svg.appendChild(markG);
      host.classList.add('is-tall');
      host.appendChild(svg);
      return { mark: function (on) { markG.style.display = on ? '' : 'none'; } };
    },
  };
})(window.PX);
