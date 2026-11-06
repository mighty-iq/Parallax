/* PX.ui: DOM building blocks (ARCHITECTURE.md §4).
   h(tag, attrs?, ...children)  hyperscript; tag may carry classes and an id: 'button.px-btn#go'
   modal({ title, body, actions, onClose, dismissable = true, label, className }) → close(result)
   toast(msg, { kind, ms, action: { label, onClick } }) → dismiss
   confirm(msg, { title, ok, cancel, danger }) → Promise<boolean>
   button(label, { kind, onClick, go, key, title, ariaLabel, disabled, small, type, className })
   bar(value, max, { label, text, kind, band: [lo, hi] }) → element with set(value, max, band)
   ring(value, max, { label, text, size }) → <svg> with set(value, max)
   choiceGrid(n, layout) → { el, cells, buttons, select, selected, mark, onPick, pick, lock, focus, destroy }
   copyBox(text, { rows, label }) → element with setText(text); copyText(text) → Promise<boolean>
   Also: clear(el), focusables(root), modalOpen() → number of open modals.

   CSS class names (styled in css/base.css; a tiny layout-only default sheet is prepended
   to <head> so the pieces work before any CSS loads, and later sheets override it):
   .px-btn  .px-btn--primary | --secondary | --ghost | --danger  .px-btn--small  .px-kbd
   .px-modal-backdrop  .px-modal  .px-modal-title  .px-modal-body  .px-modal-actions
   .px-modal-close  html.px-modal-open (scroll lock)
   .px-toasts  .px-toast  .px-toast--info | --ok | --warn | --error  .px-toast-text  .px-toast-action
   .px-bar  .px-bar--<kind>  .px-bar-fill  .px-bar-band  .px-bar-text
   .px-ring  .px-ring-track  .px-ring-arc  .px-ring-text
   .px-choices  .px-choices--grid | --row | --col  (column count in the CSS variable --px-cols)
   .px-choice  .px-choice-key  .px-choice-body  .px-choice-mark
   states on .px-choice: .is-selected  .is-right  .is-wrong  .is-missed  .is-dim; .px-choices.is-locked
   .px-copybox  .px-copybox-text  .px-copybox-actions  .px-copybox-status */
(function (PX) {
  'use strict';

  var doc = window.document;
  var keys = PX.core.keys;
  var hasOwn = Object.prototype.hasOwnProperty;
  var PROPS = { value: 1, checked: 1, selected: 1, indeterminate: 1, muted: 1 };

  /* ---------- default sheet (layout only, lowest precedence) ---------- */

  var BASE_CSS = [
    '.px-modal-backdrop{position:fixed;inset:0;z-index:1000;display:flex;align-items:center;justify-content:center;padding:16px;background:rgba(0,0,0,.45)}',
    '.px-modal{position:relative;box-sizing:border-box;max-width:min(560px,100%);max-height:calc(100% - 32px);overflow:auto;padding:20px;background:#fff;color:#111;border-radius:8px}',
    '.px-modal-actions{display:flex;flex-wrap:wrap;gap:8px;justify-content:flex-end;margin-top:16px}',
    '.px-modal-close{position:absolute;top:4px;right:4px}',
    'html.px-modal-open,html.px-modal-open body{overflow:hidden}',
    '.px-btn,.px-choice,.px-modal-close{min-width:44px;min-height:44px}',
    '.px-toasts{position:fixed;left:0;right:0;bottom:16px;z-index:1100;display:flex;flex-direction:column;align-items:center;gap:8px;pointer-events:none;padding:0 16px}',
    '.px-toast{pointer-events:auto;max-width:100%;padding:10px 14px;background:#222;color:#fff;border-radius:6px}',
    '.px-bar{position:relative;height:8px;background:rgba(127,127,127,.25);border-radius:4px;overflow:hidden}',
    '.px-bar-fill,.px-bar-band{position:absolute;top:0;bottom:0;left:0}',
    '.px-bar-fill{background:currentColor}',
    '.px-bar-band{background:currentColor;opacity:.3}',
    '.px-choices{display:grid;grid-template-columns:repeat(var(--px-cols,2),minmax(0,1fr));gap:8px}',
    '.px-choice{position:relative;display:flex;align-items:center;justify-content:center;padding:4px}',
    '.px-choice-key{position:absolute;top:2px;left:6px;font-size:12px}',
    '.px-choice-mark{position:absolute;top:2px;right:6px;font-weight:600}',
    '.px-choice-body{flex:1;min-width:0}',
    '.px-copybox-text{box-sizing:border-box;width:100%;font-family:monospace}',
  ].join('\n');

  var baseInstalled = false;
  function installBase() {
    if (baseInstalled || !doc || !doc.head) return;
    baseInstalled = true;
    var s = doc.createElement('style');
    s.id = 'px-ui-base';
    s.textContent = BASE_CSS;
    doc.head.insertBefore(s, doc.head.firstChild); // first, so css/*.css overrides it
  }

  /* ---------- h() ---------- */

  function isAttrs(x) {
    return x !== null && typeof x === 'object' && !Array.isArray(x) && !x.nodeType &&
      Object.prototype.toString.call(x) === '[object Object]';
  }

  function appendChild(el, c) {
    if (c === null || c === undefined || c === false || c === true) return;
    if (Array.isArray(c)) { for (var i = 0; i < c.length; i++) appendChild(el, c[i]); return; }
    if (c.nodeType) el.appendChild(c);
    else el.appendChild(doc.createTextNode(String(c)));
  }

  function classList(v) {
    if (Array.isArray(v)) return v.filter(Boolean).join(' ');
    return v ? String(v) : '';
  }

  function setAttr(el, k, v) {
    if (v === null || v === undefined || v === false) return;
    if (k === 'class' || k === 'className') {
      var c = classList(v);
      if (c) el.setAttribute('class', ((el.getAttribute('class') || '') + ' ' + c).trim());
      return;
    }
    if (k === 'style') {
      if (typeof v === 'string') { el.setAttribute('style', v); return; }
      for (var s in v) {
        if (!hasOwn.call(v, s) || v[s] === null || v[s] === undefined) continue;
        if (s.slice(0, 2) === '--' || s.indexOf('-') > 0) el.style.setProperty(s, String(v[s]));
        else el.style[s] = v[s];
      }
      return;
    }
    if (k === 'dataset') { for (var d in v) if (hasOwn.call(v, d)) el.dataset[d] = v[d]; return; }
    if (k.slice(0, 2) === 'on' && typeof v === 'function') { el.addEventListener(k.slice(2).toLowerCase(), v); return; }
    if (hasOwn.call(PROPS, k)) { el[k] = v; return; }
    el.setAttribute(k, v === true ? '' : String(v));
  }

  function h(tag) {
    var m = /^([a-zA-Z][a-zA-Z0-9-]*)?((?:[.#][a-zA-Z0-9_-]+)*)$/.exec(tag || 'div');
    if (!m) throw new Error('PX.ui.h: bad tag "' + tag + '"');
    var el = doc.createElement(m[1] || 'div');
    var cls = [];
    (m[2].match(/[.#][^.#]+/g) || []).forEach(function (p) {
      if (p[0] === '#') el.id = p.slice(1);
      else cls.push(p.slice(1));
    });
    if (cls.length) el.setAttribute('class', cls.join(' '));
    var start = 1;
    if (isAttrs(arguments[1])) {
      var attrs = arguments[1];
      for (var k in attrs) if (hasOwn.call(attrs, k)) setAttr(el, k, attrs[k]);
      start = 2;
    }
    for (var i = start; i < arguments.length; i++) appendChild(el, arguments[i]);
    return el;
  }

  function clear(el) { while (el && el.firstChild) el.removeChild(el.firstChild); return el; }

  var FOCUSABLE = 'a[href],area[href],button:not([disabled]),input:not([disabled]):not([type="hidden"]),' +
    'select:not([disabled]),textarea:not([disabled]),iframe,summary,audio[controls],video[controls],' +
    '[contenteditable=""],[contenteditable="true"],[tabindex]';

  function visible(el) { return !!(el.offsetWidth || el.offsetHeight || el.getClientRects().length); }

  function focusables(root) {
    var all = root.querySelectorAll(FOCUSABLE), out = [];
    for (var i = 0; i < all.length; i++) {
      var el = all[i];
      if (el.tabIndex < 0 || el.closest('[inert],[hidden]') || !visible(el)) continue;
      out.push(el);
    }
    return out;
  }

  function focusEl(el) {
    if (!el || typeof el.focus !== 'function') return;
    try { el.focus({ preventScroll: false }); } catch (e) { try { el.focus(); } catch (e2) { /* detached */ } }
  }

  /* ---------- button ---------- */

  function button(label, opts) {
    opts = opts || {};
    var b = h('button', {
      type: opts.type || 'button',
      class: ['px-btn', 'px-btn--' + (opts.kind || 'secondary'), opts.small ? 'px-btn--small' : null, opts.className],
      title: opts.title || null,
      'aria-label': opts.ariaLabel || null,
      'aria-keyshortcuts': opts.key ? keyShortcut(opts.key) : null,
      'data-go': opts.go || null,
      disabled: !!opts.disabled,
      onclick: opts.onClick || null,
    }, label);
    if (opts.key) b.appendChild(h('kbd.px-kbd', { 'aria-hidden': 'true' }, keyLabel(opts.key)));
    return b;
  }
  function keyLabel(k) { return k === 'Escape' ? 'Esc' : k === 'Space' ? 'Space' : k.length === 1 ? k.toUpperCase() : k; }
  function keyShortcut(k) { return k === 'Space' ? 'Space' : k.length === 1 ? k.toUpperCase() : k; }

  /* ---------- modal ---------- */

  var stack = [];       // open modals, top last
  var modalSeq = 0;
  var trapInstalled = false;

  function topModal() { return stack.length ? stack[stack.length - 1] : null; }

  function installTrap() {
    if (trapInstalled) return;
    trapInstalled = true;
    // Tab and Shift+Tab cycle inside the top modal.
    doc.addEventListener('keydown', function (e) {
      var m = topModal();
      if (!m || e.key !== 'Tab') return;
      var f = focusables(m.dialog);
      if (!f.length) { e.preventDefault(); focusEl(m.dialog); return; }
      var first = f[0], last = f[f.length - 1], active = doc.activeElement;
      var inside = m.dialog.contains(active);
      if (e.shiftKey && (!inside || active === first || active === m.dialog)) { e.preventDefault(); focusEl(last); }
      else if (!e.shiftKey && (!inside || active === last)) { e.preventDefault(); focusEl(first); }
    }, true);
    // Focus that escapes the top modal (programmatic, assistive tech) is brought back.
    doc.addEventListener('focusin', function (e) {
      var m = topModal();
      if (!m || m.dialog.contains(e.target)) return;
      if (e.target.closest && e.target.closest('[data-px-live]')) return;
      var f = focusables(m.dialog);
      focusEl(f[0] || m.dialog);
    });
  }

  function modal(opts) {
    opts = opts || {};
    installBase();
    installTrap();
    var dismissable = opts.dismissable !== false;
    var id = 'px-modal-' + (++modalSeq);
    var opener = doc.activeElement && doc.activeElement !== doc.body ? doc.activeElement : null;
    var closed = false;

    var title = opts.title ? h('h2.px-modal-title', { id: id + '-title' }, opts.title) : null;
    var body = h('div.px-modal-body', { id: id + '-body' });
    appendChild(body, typeof opts.body === 'string' ? h('p', opts.body) : opts.body);

    var actionEls = [], primary = null;
    var actions = h('div.px-modal-actions');
    (opts.actions || []).forEach(function (a) {
      if (!a) return;
      if (a.nodeType) { actions.appendChild(a); actionEls.push(a); return; }
      var b = button(a.label, { kind: a.kind || (a.primary ? 'primary' : 'secondary'), key: a.key, className: a.className });
      b.addEventListener('click', function (e) {
        if (closed) return;
        if (typeof a.onClick === 'function' && a.onClick(close, e) === false) return; // false keeps it open
        close(a.value);
      });
      if (a.autofocus) b.setAttribute('data-autofocus', '');
      if (a.kind === 'primary' || a.primary) primary = primary || b;
      actions.appendChild(b);
      actionEls.push(b);
    });

    var closeBtn = dismissable ? h('button.px-modal-close', { type: 'button', 'aria-label': 'Close' }, '×') : null;
    if (closeBtn) closeBtn.addEventListener('click', function () { close(undefined); });

    var dialog = h('div.px-modal', {
      role: 'dialog', 'aria-modal': 'true', tabindex: '-1', class: opts.className || null,
      'aria-labelledby': title ? id + '-title' : null,
      'aria-label': title ? null : (opts.label || 'Dialog'),
      'aria-describedby': id + '-body',
    }, title, body, actionEls.length ? actions : null, closeBtn);
    var backdrop = h('div.px-modal-backdrop', { 'data-px-modal': id }, dialog);
    backdrop.addEventListener('mousedown', function (e) {
      if (e.target === backdrop && dismissable) close(undefined);
    });

    // Everything else becomes inert (not focusable, hidden from assistive tech) while open.
    var inerted = [];
    var kids = doc.body.children;
    for (var i = 0; i < kids.length; i++) {
      var k = kids[i];
      if (k.hasAttribute('inert') || k.hasAttribute('data-px-live') || /^(SCRIPT|STYLE|LINK|TEMPLATE)$/.test(k.tagName)) continue;
      k.setAttribute('inert', '');
      inerted.push(k);
    }
    doc.body.appendChild(backdrop);
    doc.documentElement.classList.add('px-modal-open');

    // The top layer takes every key: Escape closes when dismissable; other keys keep
    // their default action (buttons, inputs) but never reach the layers below.
    var popKeys = keys.push({
      Escape: function () { if (dismissable) close(undefined); },
      '*': function () { return false; },
    });

    var entry = { id: id, dialog: dialog, close: close };
    stack.push(entry);

    var first = dialog.querySelector('[autofocus],[data-autofocus]') || focusables(body)[0] || primary || actionEls[0] || dialog;
    focusEl(first);
    emitModal('modal:open');

    function close(result) {
      if (closed) return;
      closed = true;
      popKeys();
      var at = stack.indexOf(entry);
      if (at >= 0) stack.splice(at, 1);
      if (backdrop.parentNode) backdrop.parentNode.removeChild(backdrop);
      for (var j = 0; j < inerted.length; j++) inerted[j].removeAttribute('inert');
      if (!stack.length) doc.documentElement.classList.remove('px-modal-open');
      if (opener && doc.contains(opener)) focusEl(opener);
      else if (topModal()) focusEl(topModal().dialog);
      close.closed = true;
      if (typeof opts.onClose === 'function') {
        try { opts.onClose(result); } catch (e) { if (window.console) console.error('PX.ui.modal onClose failed:', e); }
      }
      emitModal('modal:close'); // after onClose, which may open the next modal (the tour offer)
    }
    close.closed = false;
    close.el = dialog;
    return close;
  }

  // PX.bus 'modal:open' / 'modal:close' { open: count }: the player pauses a running item under a modal.
  function emitModal(evt) {
    try { if (PX.bus) PX.bus.emit(evt, { open: stack.length }); } catch (e) { /* a listener must not break a dialog */ }
  }

  function modalOpen() { return stack.length; }

  function confirm(msg, opts) {
    opts = opts || {};
    return new Promise(function (resolve) {
      modal({
        title: opts.title || 'Please confirm',
        body: msg,
        dismissable: true,
        actions: [
          { label: opts.cancel || 'Cancel', value: false, kind: 'secondary', autofocus: !!opts.danger },
          { label: opts.ok || 'OK', value: true, kind: opts.danger ? 'danger' : 'primary', autofocus: !opts.danger },
        ],
        onClose: function (v) { resolve(v === true); },
      });
    });
  }

  /* ---------- toast ---------- */

  var toastHost = null;
  function toast(msg, opts) {
    opts = opts || {};
    if (!doc.body) { if (window.console) console.log('[toast]', msg); return function () {}; }
    installBase();
    if (!toastHost || !toastHost.parentNode) {
      toastHost = h('div.px-toasts', { role: 'status', 'aria-live': 'polite', 'data-px-live': '' });
      doc.body.appendChild(toastHost);
    }
    var kind = opts.kind || 'info';
    var t = h('div', { class: ['px-toast', 'px-toast--' + kind], role: kind === 'error' ? 'alert' : null },
      h('span.px-toast-text', String(msg)));
    var timer = null, gone = false;
    function dismiss() {
      if (gone) return;
      gone = true;
      if (timer) window.clearTimeout(timer);
      if (t.parentNode) t.parentNode.removeChild(t);
    }
    if (opts.action && opts.action.label) {
      var b = h('button.px-btn.px-btn--ghost.px-btn--small.px-toast-action', { type: 'button' }, opts.action.label);
      b.addEventListener('click', function () {
        dismiss();
        if (typeof opts.action.onClick === 'function') opts.action.onClick();
      });
      t.appendChild(b);
    }
    toastHost.appendChild(t);
    var text = String(msg);
    var ms = opts.ms > 0 ? opts.ms : Math.min(8000, 2500 + 50 * text.length);
    if (opts.ms !== 0) timer = window.setTimeout(dismiss, ms); // ms: 0 keeps it until dismissed
    return dismiss;
  }

  /* ---------- bar and ring ---------- */

  function pct(v, m) {
    if (!(m > 0) || typeof v !== 'number' || !isFinite(v)) return 0;
    return Math.max(0, Math.min(100, v / m * 100));
  }

  function bar(value, max, opts) {
    opts = opts || {};
    var fill = h('div.px-bar-fill');
    var band = h('div.px-bar-band', { hidden: true });
    var text = opts.text ? h('span.px-bar-text') : null;
    var el = h('div', {
      class: ['px-bar', opts.kind ? 'px-bar--' + opts.kind : null],
      role: 'progressbar', 'aria-valuemin': '0', 'aria-label': opts.label || null,
    }, band, fill, text);
    el.set = function (v, m, b) {
      var p = pct(v, m);
      fill.style.width = p + '%';
      el.setAttribute('aria-valuemax', String(m));
      el.setAttribute('aria-valuenow', String(typeof v === 'number' && isFinite(v) ? v : 0));
      var t = typeof opts.text === 'function' ? opts.text(v, m) : opts.text ? v + ' / ' + m : null;
      if (text) text.textContent = t;
      if (t) el.setAttribute('aria-valuetext', t);
      // Uncertainty band [lo, hi] in the same units as value.
      if (b && b.length === 2) {
        var lo = pct(Math.min(b[0], b[1]), m), hi = pct(Math.max(b[0], b[1]), m);
        band.hidden = false;
        band.style.left = lo + '%';
        band.style.width = Math.max(0, hi - lo) + '%';
      } else band.hidden = true;
      return el;
    };
    return el.set(value, max, opts.band);
  }

  function ring(value, max, opts) {
    opts = opts || {};
    var S = PX.core.svg;
    var R = 15.915494309189533; // circumference 100: dash lengths are percentages
    var root = S.svg(36, 36, {
      class: 'px-ring', role: 'img', 'aria-label': opts.label || 'progress',
      width: opts.size || 36, height: opts.size || 36,
    });
    root.removeAttribute('aria-hidden');
    var track = S.el('circle', { class: 'px-ring-track', cx: 18, cy: 18, r: R, fill: 'none', stroke: 'currentColor', 'stroke-opacity': 0.2, 'stroke-width': 3.2 });
    var arc = S.el('circle', {
      class: 'px-ring-arc', cx: 18, cy: 18, r: R, fill: 'none', stroke: 'currentColor', 'stroke-width': 3.2,
      'stroke-linecap': 'round', transform: 'rotate(-90 18 18)',
    });
    var label = opts.text !== undefined ? S.text(18, 18.5, '', { class: 'px-ring-text', 'font-size': 9, fill: 'currentColor' }) : null;
    root.appendChild(track);
    root.appendChild(arc);
    if (label) root.appendChild(label);
    root.set = function (v, m) {
      var p = pct(v, m);
      arc.setAttribute('stroke-dasharray', p.toFixed(2) + ' 100');
      arc.setAttribute('stroke-opacity', p > 0 ? '1' : '0'); // a round cap would show a dot at 0
      var t = typeof opts.text === 'function' ? opts.text(v, m) : opts.text === true ? Math.round(p) + '%' : opts.text;
      if (label) label.textContent = t == null ? '' : String(t);
      root.setAttribute('aria-label', (opts.label ? opts.label + ': ' : '') + (typeof v === 'number' ? v : 0) + ' of ' + m);
      return root;
    };
    return root.set(value, max);
  }

  /* ---------- choice grid ---------- */

  function autoCols(n) { return n <= 3 ? n : n === 4 ? 2 : n <= 6 ? 3 : n <= 8 ? 4 : 3; }

  // layout: 'auto' (default) | 'grid' | 'row' | 'col' | a column count, or an options object
  // { layout, cols, label, labels: [..] or fn(i), multi, keys (default true) }.
  // Keys: a pass-through layer takes 1–9 (Enter/Space on a focused option too); everything
  // else falls to the layer below, so push the player's own layer before creating the grid.
  function choiceGrid(n, layout) {
    installBase();
    var o = isAttrs(layout) ? layout : { layout: layout };
    var lay = o.layout === undefined ? 'auto' : o.layout;
    var kind = lay === 'row' ? 'row' : lay === 'col' ? 'col' : 'grid';
    var cols = typeof lay === 'number' ? lay : o.cols || (kind === 'row' ? n : kind === 'col' ? 1 : autoCols(n));
    var multi = !!o.multi;
    var root = h('div', {
      class: ['px-choices', 'px-choices--' + kind], role: 'group',
      'aria-label': o.label || 'Answer options', style: '--px-cols:' + cols,
    });
    var buttons = [], cells = [], marks = [], states = [], sel = multi ? [] : null;
    var locked = false, listeners = [];

    function baseLabel(i) {
      if (typeof o.labels === 'function') return o.labels(i);
      if (Array.isArray(o.labels) && o.labels[i]) return o.labels[i];
      return 'Option ' + (i + 1);
    }
    function isSel(i) { return multi ? sel.indexOf(i) >= 0 : sel === i; }
    function render(i) {
      var b = buttons[i], st = states[i];
      b.classList.toggle('is-selected', isSel(i));
      b.setAttribute('aria-pressed', isSel(i) ? 'true' : 'false');
      ['right', 'wrong', 'missed', 'dim'].forEach(function (s) { b.classList.toggle('is-' + s, st === s); });
      // A symbol as well as colour: never colour alone.
      marks[i].textContent = st === 'right' || st === 'missed' ? '✓' : st === 'wrong' ? '✗' : '';
      var suffix = st === 'right' ? ', correct' : st === 'wrong' ? ', wrong' : st === 'missed' ? ', the correct answer' : '';
      b.setAttribute('aria-label', baseLabel(i) + (isSel(i) ? ', selected' : '') + suffix);
    }

    for (var i = 0; i < n; i++) {
      var cellBody = h('div.px-choice-body');
      var markEl = h('span.px-choice-mark', { 'aria-hidden': 'true' }); // not `mark`: that is the function below
      var btn = h('button.px-choice', {
        type: 'button', 'data-index': String(i), 'data-px-keys': '', 'aria-pressed': 'false',
        'aria-keyshortcuts': i < 9 ? String(i + 1) : null,
      }, i < 9 ? h('span.px-choice-key', { 'aria-hidden': 'true' }, String(i + 1)) : null, cellBody, markEl);
      btn.addEventListener('click', (function (ix) { return function () { pick(ix, 'pointer'); }; })(i));
      buttons.push(btn); cells.push(cellBody); marks.push(markEl); states.push(null);
      root.appendChild(btn);
      render(i);
    }

    // Selects one option (multi: on = true / false / undefined toggles). null clears.
    function select(i, on) {
      if (i === null || i === undefined || i < 0) {
        sel = multi ? [] : null;
      } else if (multi) {
        var at = sel.indexOf(i), want = on === undefined ? at < 0 : !!on;
        if (want && at < 0) sel.push(i);
        if (!want && at >= 0) sel.splice(at, 1);
        sel.sort(function (a, c) { return a - c; });
      } else sel = i;
      for (var j = 0; j < n; j++) render(j);
    }
    function selected() { return multi ? sel.slice() : sel; }

    function pick(i, source) {
      if (locked || !(i >= 0 && i < n)) return false;
      select(i);
      var list = listeners.slice();
      for (var j = 0; j < list.length; j++) list[j](i, source || 'api', selected());
      return true;
    }

    // state: 'right' | 'wrong' | 'missed' (the correct option, not chosen) | 'dim' | null
    function mark(i, state) {
      if (!(i >= 0 && i < n)) return;
      states[i] = state || null;
      render(i);
    }

    function onPick(fn) {
      listeners.push(fn);
      return function () { var k = listeners.indexOf(fn); if (k >= 0) listeners.splice(k, 1); };
    }

    function lock(on) {
      locked = on !== false;
      root.classList.toggle('is-locked', locked);
      for (var j = 0; j < n; j++) {
        if (locked) buttons[j].setAttribute('aria-disabled', 'true');
        else buttons[j].removeAttribute('aria-disabled');
      }
    }

    function focusedIndex(e) {
      var t = e.target && e.target.closest ? e.target.closest('.px-choice') : null;
      return t && root.contains(t) ? +t.getAttribute('data-index') : -1;
    }

    var popKeys = null;
    if (o.keys !== false) {
      var map = {};
      for (var k = 0; k < Math.min(n, 9); k++) {
        map[String(k + 1)] = (function (ix) { return function () { return pick(ix, 'key') ? undefined : false; }; })(k);
      }
      // On a focused option: Enter/Space select it; on an already selected one they go on
      // to the player (Enter confirms). In multi, Space toggles and Enter always goes on.
      map.Enter = function (e) {
        var ix = focusedIndex(e);
        if (ix < 0 || locked || multi || isSel(ix)) return false;
        pick(ix, 'key');
      };
      map.Space = function (e) {
        var ix = focusedIndex(e);
        if (ix < 0 || locked || (!multi && isSel(ix))) return false;
        pick(ix, 'key');
      };
      popKeys = keys.push(map, { through: true });
    }

    function destroy() {
      if (popKeys) { popKeys(); popKeys = null; }
      listeners.length = 0;
    }

    return {
      el: root, cells: cells, buttons: buttons,
      select: select, selected: selected, pick: pick, mark: mark, onPick: onPick,
      lock: lock, isLocked: function () { return locked; },
      focus: function (i) { focusEl(buttons[i || 0]); },
      destroy: destroy,
    };
  }

  /* ---------- copy ---------- */

  function execCopy(textarea) {
    try {
      textarea.focus();
      textarea.select();
      textarea.setSelectionRange(0, textarea.value.length); // iOS ignores select()
      return !!doc.execCommand('copy');
    } catch (e) {
      return false;
    }
  }

  // In a sandboxed or cross-origin frame without allow="clipboard-write", calling the
  // Clipboard API logs a permissions-policy violation; ask the policy first when we can.
  function clipboardAllowed() {
    try {
      var pp = doc.permissionsPolicy || doc.featurePolicy;
      if (pp && typeof pp.allowsFeature === 'function') return pp.allowsFeature('clipboard-write');
    } catch (e) { /* unknown: try the API */ }
    return true;
  }

  // Clipboard API first (needs a secure context and, in iframes, clipboard-write
  // permission), then select + execCommand('copy'). Resolves true when copied.
  function copyText(text, textarea) {
    function fallback() {
      var ta = textarea, temp = false;
      if (!ta) {
        ta = h('textarea', { readonly: true, 'aria-hidden': 'true', style: 'position:fixed;top:0;left:0;opacity:0;width:1px;height:1px' });
        ta.value = text;
        doc.body.appendChild(ta);
        temp = true;
      }
      var ok = execCopy(ta);
      if (temp) doc.body.removeChild(ta);
      return ok;
    }
    try {
      var nav = window.navigator;
      if (nav && nav.clipboard && typeof nav.clipboard.writeText === 'function' && clipboardAllowed()) {
        return nav.clipboard.writeText(text).then(function () { return true; }, function () { return fallback(); });
      }
    } catch (e) { /* blocked: fall through */ }
    return Promise.resolve(fallback());
  }

  function copyBox(text, opts) {
    opts = opts || {};
    installBase();
    var ta = h('textarea.px-copybox-text', {
      readonly: true, rows: String(opts.rows || 8), spellcheck: 'false', autocomplete: 'off',
      'aria-label': opts.ariaLabel || 'Text to copy',
    });
    ta.value = text;
    var status = h('span.px-copybox-status', { role: 'status', 'aria-live': 'polite' });
    var btn = button(opts.label || 'Copy', { kind: 'secondary' });
    btn.addEventListener('click', function () {
      copyText(ta.value, ta).then(function (ok) {
        if (ok) status.textContent = 'Copied.';
        else {
          execCopy(ta); // leaves the text selected for a manual copy
          status.textContent = 'Copying is blocked here: the text is selected; press Ctrl+C (Cmd+C), or long-press and choose Copy.';
        }
      });
    });
    ta.addEventListener('focus', function () { try { ta.select(); } catch (e) { /* ignore */ } });
    var root = h('div.px-copybox', ta, h('div.px-copybox-actions', btn, status));
    root.setText = function (t) { ta.value = t; status.textContent = ''; return root; };
    return root;
  }

  PX.ui.h = h;
  PX.ui.clear = clear;
  PX.ui.focusables = focusables;
  PX.ui.modal = modal;
  PX.ui.modalOpen = modalOpen;
  PX.ui.toast = toast;
  PX.ui.confirm = confirm;
  PX.ui.button = button;
  PX.ui.bar = bar;
  PX.ui.ring = ring;
  PX.ui.choiceGrid = choiceGrid;
  PX.ui.copyBox = copyBox;
  PX.ui.copyText = copyText;
})(window.PX);
