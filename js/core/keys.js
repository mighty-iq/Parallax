/* PX.core.keys: layered keyboard handlers (ARCHITECTURE.md §4).
   push(map, opts?) → pop
     map: { '1': fn, Enter: fn, Escape: fn, ArrowLeft: fn, a: fn, '?': fn, '*': fn, repeat }
     Only the top layer receives keys: a modal pushes a layer, so the game below gets
     nothing while it is open. Extension: opts.through = true makes a pass-through layer;
     keys it does not handle continue to the layer below (a choice grid takes 1–9 and
     leaves Enter, Space and Escape to the player underneath).
   Handlers get (event, name). Returning false means "not handled": the event keeps its
   default action and, in a pass-through layer, goes on to the next layer. Anything else
   consumes the key (preventDefault). '*' catches keys without their own entry.
   Held keys: repeats are consumed and ignored unless map.repeat is true or lists the key
   (map.repeat = ['ArrowLeft', 'ArrowRight']).
   Key names: Enter, Escape, Space, Tab, Backspace, ArrowLeft/Right/Up/Down, '0'–'9' (top
   row and numpad), letters in lower case (also with Shift or Caps Lock), other printable
   characters as typed ('?', '+').
   Never taken: keys with Ctrl, Alt or Meta (browser shortcuts); every key except Escape
   while typing in an input, textarea, select or contenteditable; arrows on range and
   radio inputs; Enter and Space on a focused button, link, checkbox or summary (native
   activation), unless the element carries data-px-keys (then the layers decide). */
(function (PX) {
  'use strict';

  var layers = [];
  var installed = false;
  var hasOwn = Object.prototype.hasOwnProperty;

  var ALIASES = {
    ' ': 'Space', Spacebar: 'Space', Esc: 'Escape', Return: 'Enter',
    Left: 'ArrowLeft', Right: 'ArrowRight', Up: 'ArrowUp', Down: 'ArrowDown',
  };
  var TEXT_INPUTS = /^(text|search|email|url|tel|password|number|date|datetime-local|month|week|time)$/;
  var ARROW = /^(ArrowLeft|ArrowRight|ArrowUp|ArrowDown|Home|End|PageUp|PageDown)$/;

  function normalise(e) {
    var k = e.key;
    if (k === undefined || k === null || k === 'Unidentified' || k === '') {
      // Old engines: derive the name from the physical key.
      var c = e.code || '';
      if (/^(Digit|Numpad)\d$/.test(c)) return c.slice(-1);
      if (/^Key[A-Z]$/.test(c)) return c.slice(3).toLowerCase();
      if (c === 'NumpadEnter') return 'Enter';
      return c;
    }
    if (hasOwn.call(ALIASES, k)) return ALIASES[k];
    if (k.length === 1) return k.toLowerCase();
    return k;
  }

  function tagOf(t) { return t && t.tagName ? String(t.tagName).toUpperCase() : ''; }
  function typeOf(t) { return String(t.type || (t.getAttribute && t.getAttribute('type')) || 'text').toLowerCase(); }

  // True when the element takes typed text (then only Escape reaches the layers).
  function isTyping(t) {
    var tag = tagOf(t);
    if (tag === 'TEXTAREA' || tag === 'SELECT') return true;
    if (tag === 'INPUT') return TEXT_INPUTS.test(typeOf(t));
    return !!(t && t.isContentEditable);
  }

  // Should this key stay with the focused element instead of the layers?
  function nativeKey(t, name) {
    if (!t || !t.tagName) return false;
    if (name === 'Escape') return false;
    if (isTyping(t)) return true;
    var tag = tagOf(t);
    if (tag === 'INPUT' && /^(range|radio)$/.test(typeOf(t)) && ARROW.test(name)) return true;
    if (name !== 'Enter' && name !== 'Space') return false;
    if (t.hasAttribute && t.hasAttribute('data-px-keys')) return false;
    if (tag === 'BUTTON' || tag === 'SUMMARY' || (tag === 'A' && t.hasAttribute('href'))) return true;
    if (tag === 'INPUT') return true; // checkbox, radio, button, submit, file, colour…
    var role = t.getAttribute ? t.getAttribute('role') : null;
    return /^(button|link|checkbox|radio|switch|menuitem|tab|option)$/.test(role || '');
  }

  function wantsRepeat(map, name) {
    var r = map.repeat;
    return r === true || (Array.isArray(r) && r.indexOf(name) >= 0);
  }

  function handle(e) {
    if (!layers.length || e.defaultPrevented) return;
    if (e.ctrlKey || e.altKey || e.metaKey) return;
    var name = normalise(e);
    if (!name || nativeKey(e.target, name)) return;
    for (var i = layers.length - 1; i >= 0; i--) {
      var layer = layers[i], map = layer.map;
      var fn = hasOwn.call(map, name) ? map[name] : map['*'];
      if (typeof fn === 'function') {
        if (e.repeat && !wantsRepeat(map, name)) { e.preventDefault(); return; }
        if (fn(e, name) !== false) { e.preventDefault(); return; }
      }
      if (!layer.through) return;
    }
  }

  function install() {
    var doc = window.document;
    if (installed || !doc || !doc.addEventListener) return;
    doc.addEventListener('keydown', handle);
    installed = true;
  }

  function push(map, opts) {
    install();
    var layer = { map: map || {}, through: !!(opts && opts.through) };
    layers.push(layer);
    return function pop() {
      var i = layers.indexOf(layer);
      if (i >= 0) layers.splice(i, 1);
    };
  }

  function depth() { return layers.length; }
  function clear() { layers.length = 0; } // tests and emergency resets only

  PX.core.keys = {
    push: push, depth: depth, clear: clear, handle: handle,
    normalise: normalise, isTyping: isTyping, nativeKey: nativeKey,
  };
})(window.PX);
