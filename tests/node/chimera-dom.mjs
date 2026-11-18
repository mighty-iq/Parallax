/* A small fake DOM for the Node tests of UI pieces that build elements (chimera.test.mjs,
   playtest.test.mjs): enough for PX.ui.h, PX.ui.button, PX.core.svg and the Chimera invite, the
   one-tap card and the share texts. Not a browser: no layout, no CSS, no real events beyond
   addEventListener / dispatch / click. Not a test file itself (the runner loads *.test.mjs).

   installDom(document, window) adds createElement, createElementNS, createTextNode, body,
   activeElement, contains, hasFocus and querySelector(All) to the env's fake document, so files
   that captured `window.document` at load see them. Selectors: tag, .class, #id, [attr],
   [attr="value"], compounds of these, and descendant chains separated by spaces. */

class Node {
  constructor(doc) { this.ownerDocument = doc; this.parentNode = null; this.childNodes = []; }
  get firstChild() { return this.childNodes[0] || null; }
  get lastChild() { return this.childNodes[this.childNodes.length - 1] || null; }
  appendChild(n) {
    if (n.parentNode) n.parentNode.removeChild(n);
    n.parentNode = this; this.childNodes.push(n); return n;
  }
  insertBefore(n, ref) {
    if (!ref) return this.appendChild(n);
    if (n.parentNode) n.parentNode.removeChild(n);
    const i = this.childNodes.indexOf(ref);
    n.parentNode = this; this.childNodes.splice(i < 0 ? this.childNodes.length : i, 0, n); return n;
  }
  removeChild(n) {
    const i = this.childNodes.indexOf(n);
    if (i >= 0) this.childNodes.splice(i, 1);
    n.parentNode = null; return n;
  }
  contains(n) { for (let x = n; x; x = x.parentNode) if (x === this) return true; return false; }
  get textContent() { return this.childNodes.map((c) => c.textContent).join(''); }
  set textContent(v) { this.childNodes.forEach((c) => { c.parentNode = null; }); this.childNodes = []; if (v !== '' && v != null) this.appendChild(new Text(this.ownerDocument, String(v))); }
}

class Text extends Node {
  constructor(doc, text) { super(doc); this.nodeType = 3; this.data = text; }
  get textContent() { return this.data; }
  set textContent(v) { this.data = String(v); }
}

class Element extends Node {
  constructor(doc, tag, ns) {
    super(doc);
    this.nodeType = 1; this.tagName = String(tag).toUpperCase(); this.localName = String(tag).toLowerCase(); this.namespaceURI = ns || null;
    this.attrs = new Map(); this.handlers = new Map(); this.style = { setProperty(k, v) { this[k] = v; } };
    const el = this;
    this.classList = {
      add(...c) { const s = el.classes(); c.forEach((x) => s.add(x)); el.setAttribute('class', [...s].join(' ')); },
      remove(...c) { const s = el.classes(); c.forEach((x) => s.delete(x)); el.setAttribute('class', [...s].join(' ')); },
      contains(c) { return el.classes().has(c); },
      toggle(c, on) { const has = el.classes().has(c); const want = on === undefined ? !has : !!on; if (want !== has) (want ? this.add(c) : this.remove(c)); return want; },
    };
  }
  classes() { return new Set(String(this.getAttribute('class') || '').split(/\s+/).filter(Boolean)); }
  get children() { return this.childNodes.filter((c) => c.nodeType === 1); }
  get className() { return this.getAttribute('class') || ''; }
  set className(v) { this.setAttribute('class', v); }
  get id() { return this.getAttribute('id') || ''; }
  set id(v) { this.setAttribute('id', v); }
  get hidden() { return this.hasAttribute('hidden'); }
  set hidden(v) { if (v) this.setAttribute('hidden', ''); else this.removeAttribute('hidden'); }
  setAttribute(k, v) { this.attrs.set(String(k), String(v)); }
  getAttribute(k) { return this.attrs.has(k) ? this.attrs.get(k) : null; }
  hasAttribute(k) { return this.attrs.has(k); }
  removeAttribute(k) { this.attrs.delete(k); }
  setAttributeNS(ns, k, v) { this.setAttribute(k, v); }
  addEventListener(type, fn) { if (!this.handlers.has(type)) this.handlers.set(type, []); this.handlers.get(type).push(fn); }
  removeEventListener(type, fn) { const l = this.handlers.get(type) || []; const i = l.indexOf(fn); if (i >= 0) l.splice(i, 1); }
  dispatch(type, ev = {}) {
    const e = Object.assign({ type, target: this, preventDefault() {}, stopPropagation() {} }, ev);
    for (let x = this; x; x = x.parentNode) for (const fn of [...((x.handlers && x.handlers.get(type)) || [])]) fn.call(x, e);
    return e;
  }
  click() { if (!this.hasAttribute('disabled')) this.dispatch('click'); }
  focus() { this.ownerDocument.activeElement = this; }
  blur() { if (this.ownerDocument.activeElement === this) this.ownerDocument.activeElement = this.ownerDocument.body; }
  select() {}
  setSelectionRange() {}
  getBoundingClientRect() { return { top: 0, left: 0, right: 0, bottom: 0, width: 0, height: 0 }; }
  matches(sel) { return sel.split(',').some((s) => matchChain(this, s.trim().split(/\s+/))); }
  closest(sel) { for (let x = this; x && x.nodeType === 1; x = x.parentNode) if (x.matches(sel)) return x; return null; }
  querySelectorAll(sel) { const out = []; walk(this, (n) => { if (n !== this && n.matches(sel)) out.push(n); }); return out; }
  querySelector(sel) { return this.querySelectorAll(sel)[0] || null; }
}

function walk(n, fn) { for (const c of n.childNodes) if (c.nodeType === 1) { fn(c); walk(c, fn); } }

// one compound selector: tag, .class, #id, [attr], [attr="v"]
function matchOne(el, sel) {
  const re = /([a-zA-Z][a-zA-Z0-9-]*)|\.([\w-]+)|#([\w-]+)|\[([\w-]+)(?:=(?:"([^"]*)"|'([^']*)'|([^\]]*)))?\]/g;
  let m, any = false;
  while ((m = re.exec(sel))) {
    any = true;
    if (m[1] && el.localName !== m[1].toLowerCase()) return false;
    if (m[2] && !el.classes().has(m[2])) return false;
    if (m[3] && el.id !== m[3]) return false;
    if (m[4]) {
      if (!el.hasAttribute(m[4])) return false;
      const want = m[5] ?? m[6] ?? m[7];
      if (want !== undefined && el.getAttribute(m[4]) !== want) return false;
    }
  }
  return any;
}
function matchChain(el, parts) {
  if (!matchOne(el, parts[parts.length - 1])) return false;
  if (parts.length === 1) return true;
  for (let x = el.parentNode; x && x.nodeType === 1; x = x.parentNode) if (matchChain(x, parts.slice(0, -1))) return true;
  return false;
}

export function installDom(document, window) {
  const body = new Element(document, 'body');
  const head = new Element(document, 'head');
  Object.assign(document, {
    body, head,
    documentElement: new Element(document, 'html'),
    activeElement: body,
    createElement: (tag) => new Element(document, tag),
    createElementNS: (ns, tag) => new Element(document, tag, ns),
    createTextNode: (text) => new Text(document, text),
    contains: (n) => body.contains(n) || head.contains(n),
    hasFocus: () => true,
    querySelector: (sel) => body.querySelector(sel),
    querySelectorAll: (sel) => body.querySelectorAll(sel),
    execCommand: () => true, // a copy "works" in Node: the tests check what is copied, not how
  });
  window.getComputedStyle = () => ({ getPropertyValue: () => '' });
  window.matchMedia = () => ({ matches: false, addEventListener() {}, removeEventListener() {} });
  return { body, Element, Text };
}

// All text of an element, its attributes left out.
export function textOf(el) { return el ? el.textContent : ''; }
