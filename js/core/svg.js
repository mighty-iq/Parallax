/* PX.core.svg: small SVG builders (ARCHITECTURE.md §4).
   el(tag, attrs, children?)  element in the SVG namespace; children: node, string or array
   svg(w, h, attrs)           root <svg> with viewBox "0 0 w h"; scales to its box (width 100 %,
                              height auto, aspect kept) unless attrs set width/height
   path(points, closed, attrs?)  <path> through [[x, y], …] or [{x, y}, …]
   pathData(points, closed)   the 'd' string alone
   text(x, y, str, attrs?)    <text>; text-anchor middle and dominant-baseline central by
                              default, so (x, y) is the centre of the label
   Attribute values: numbers are rounded to 3 decimals; null/undefined/false skip the
   attribute; true writes an empty value; 'class' and 'style' (object or string) accepted;
   keys starting with 'on' and holding a function become event listeners. */
(function (PX) {
  'use strict';

  var NS = 'http://www.w3.org/2000/svg';
  var XLINK = 'http://www.w3.org/1999/xlink';

  function num(v) {
    if (typeof v !== 'number') return String(v);
    if (!isFinite(v)) return '0';
    var r = Math.round(v * 1000) / 1000;
    return String(r === 0 ? 0 : r); // no '-0'
  }

  function setAttrs(node, attrs) {
    if (!attrs) return node;
    for (var k in attrs) {
      if (!Object.prototype.hasOwnProperty.call(attrs, k)) continue;
      var v = attrs[k];
      if (v === null || v === undefined || v === false) continue;
      if (k.slice(0, 2) === 'on' && typeof v === 'function') { node.addEventListener(k.slice(2).toLowerCase(), v); continue; }
      if (k === 'style' && typeof v === 'object') {
        for (var s in v) if (Object.prototype.hasOwnProperty.call(v, s)) node.style.setProperty(s, v[s]);
        continue;
      }
      if (k === 'className') k = 'class';
      var val = v === true ? '' : Array.isArray(v) ? v.map(num).join(' ') : num(v);
      if (k === 'xlink:href') node.setAttributeNS(XLINK, k, val);
      else node.setAttribute(k, val);
    }
    return node;
  }

  function append(node, c) {
    if (c === null || c === undefined || c === false) return;
    if (Array.isArray(c)) { for (var i = 0; i < c.length; i++) append(node, c[i]); return; }
    if (typeof c === 'string' || typeof c === 'number') node.appendChild(document.createTextNode(String(c)));
    else node.appendChild(c);
  }

  function el(tag, attrs, children) {
    var node = document.createElementNS(NS, tag);
    setAttrs(node, attrs);
    append(node, children);
    return node;
  }

  function svg(w, h, attrs) {
    var a = { viewBox: [0, 0, w, h], preserveAspectRatio: 'xMidYMid meet' };
    if (!attrs || (attrs.width === undefined && attrs.height === undefined)) {
      a.width = '100%';
      a.style = 'display:block;height:auto;max-width:100%';
    }
    if (attrs) for (var k in attrs) if (Object.prototype.hasOwnProperty.call(attrs, k)) a[k] = attrs[k];
    // Decorative unless the caller names it (role="img" + aria-label).
    if (a.role === undefined && a['aria-label'] === undefined) a['aria-hidden'] = 'true';
    var node = el('svg', a);
    node.setAttribute('xmlns', NS);
    return node;
  }

  function pathData(points, closed) {
    var d = '';
    for (var i = 0; i < points.length; i++) {
      var p = points[i];
      var x = Array.isArray(p) ? p[0] : p.x, y = Array.isArray(p) ? p[1] : p.y;
      d += (i ? 'L' : 'M') + num(x) + ' ' + num(y);
    }
    return d + (closed && points.length ? 'Z' : '');
  }

  function path(points, closed, attrs) {
    var a = { d: pathData(points, closed) };
    if (attrs) for (var k in attrs) if (Object.prototype.hasOwnProperty.call(attrs, k)) a[k] = attrs[k];
    return el('path', a);
  }

  function text(x, y, str, attrs) {
    var a = { x: x, y: y, 'text-anchor': 'middle', 'dominant-baseline': 'central' };
    if (attrs) for (var k in attrs) if (Object.prototype.hasOwnProperty.call(attrs, k)) a[k] = attrs[k];
    return el('text', a, String(str));
  }

  PX.core.svg = { NS: NS, el: el, svg: svg, path: path, pathData: pathData, text: text, attrs: setAttrs };
})(window.PX);
