/* PR-0 Word Links: view (DOM; ARCHITECTURE.md §6, docs/dev/EXERCISE-GUIDE.md).
   layout 'stem+options': the stem reads "A is to B as C is to ?" (and the same in a:b :: c:?
   notation); the grid holds the four words (keys 1–4, two columns).
   - Everything comes from the item and the table in def.lib; explanations use the relation's
     sentence from learn.sentences, so show me (development only: the Spatial Check gives no
     feedback) says exactly what validate() checked.
   - The item's time limit runs as a calm bar under the stem (one slow linear sweep, no ticks, no
     colour change); it pauses while the harness or an ancestor is paused and stops at reveal. */
(function (PX) {
  'use strict';

  var timing = PX.core.timing, h = PX.ui.h, U = PX.util;
  var def = PX.ex.get('wordlinks'), lib = def.lib;
  var KIND_TAG = { linked: 'linked to C', stem: 'linked to A or B', family: 'same kind, other family', near: 'same family' };
  var st = null;

  function learn() { return PX.ex.learn('wordlinks') || {}; }
  function fill(t, vars) {
    return String(t || '').replace(/\{(\w+)\}/g, function (m, k) { return vars[k] !== undefined ? vars[k] : m; });
  }
  function art(w) { return (/^[aeiou]/i.test(w) ? 'an ' : 'a ') + w; }
  function capital(s) { return s.charAt(0).toUpperCase() + s.slice(1); }
  // "A young dog is called a puppy." from learn.sentences[relation].
  function sentence(rel, a, b) {
    var t = (learn().sentences || {})[rel] || '{a} → {b}';
    return t.replace(/\{([aAbB])(\*?)\}/g, function (m, k, star) {
      var w = lib.show(k.toLowerCase() === 'a' ? a : b);
      if (star) w = art(w);
      return k === 'A' || k === 'B' ? capital(w) : w;
    });
  }
  function vars(item) {
    var d = item.options[item.key];
    return { a: lib.show(item.a), b: lib.show(item.b), c: lib.show(item.c), d: lib.show(d), ab: sentence(item.relation, item.a, item.b), cd: sentence(item.relation, item.c, d) };
  }
  function cap(key, item) { return fill((learn().captions || {})[key], vars(item)); }

  /* ---------- the countdown bar ---------- */

  function timerStart(item) {
    var ms = def.timeLimit(item.params);
    st.timer.hidden = !ms;
    st.timer.classList.remove('is-running', 'is-stopped');
    if (!ms) return;
    st.timerFill.style.animationDuration = ms + 'ms';
    void st.timerFill.offsetWidth; // restart the animation for the new item
    st.timer.classList.add('is-running');
  }
  function timerStop() { if (st) st.timer.classList.add('is-stopped'); }

  /* ---------- view functions ---------- */

  function describe(item) {
    var ms = def.timeLimit(item.params), v = vars(item);
    return v.a + ' is to ' + v.b + ' as ' + v.c + ' is to what? Choose one of four words: ' +
      item.options.map(lib.show).join(', ') + ' (keys 1 to 4)' + (ms ? '; up to ' + Math.round(ms / 1000) + ' seconds.' : '.');
  }

  function mount(ctx) {
    var w = function (cls) { return h('span.wl-word.' + cls); };
    var words = { a: w('wl-a'), b: w('wl-b'), c: w('wl-c'), q: h('span.wl-word.wl-q', '?') };
    var line = h('p.wl-analogy', words.a, h('span.wl-is', ' is to '), words.b, h('span.wl-as', ' as '), words.c, h('span.wl-is', ' is to '), words.q);
    var notation = h('p.wl-notation', { 'aria-hidden': 'true' });
    var verdict = h('div.ex-verdict.wl-verdict', { hidden: true, role: 'status' });
    var stage = h('div.ex-stage.wl-stage', h('span.ex-label', 'Word links'), line, notation, verdict);
    var timer = h('div.pr-timer', { 'aria-hidden': 'true', hidden: true }, h('div.pr-timer-fill'));
    var caption = h('p.ex-caption', { 'aria-live': 'polite' }), desc = h('p.px-sr');
    var root = h('div.ex-wordlinks-stem', stage, timer, caption, desc);
    ctx.host.appendChild(root);
    st = { ctx: ctx, root: root, stage: stage, words: words, notation: notation, verdict: verdict, timer: timer,
      timerFill: timer.firstChild, caption: caption, desc: desc, item: null, opts: [] };
  }

  function newItem(item) {
    st.item = item;
    st.opts = [];
  }

  function point(names) {
    ['a', 'b', 'c', 'q'].forEach(function (k) { st.words[k].classList.toggle('is-pointed', names.indexOf(k) >= 0); });
  }
  function focusOption(i) {
    st.opts.forEach(function (o, j) { var cell = o.closest ? o.closest('.px-choice') : null; if (cell) cell.classList.toggle('ex-focus', j === i); });
  }

  function present(item, ctx) {
    if (!st) mount(ctx);
    if (st.item !== item) newItem(item);
    var v = vars(item);
    st.words.a.textContent = v.a;
    st.words.b.textContent = v.b;
    st.words.c.textContent = v.c;
    st.words.q.textContent = '?';
    st.notation.textContent = v.a + ' : ' + v.b + ' :: ' + v.c + ' : ?';
    st.root.classList.remove('is-revealed');
    st.verdict.hidden = true;
    st.verdict.textContent = '';
    st.caption.textContent = '';
    st.desc.textContent = describe(item);
    point([]);
    timerStart(item);
    return timing.nextPaint();
  }

  // Ready phase: the grid is laid out but hidden; each cell gets its word.
  function drawOption(el, item, i, ctx) {
    if (!st) mount(ctx);
    if (st.item !== item) newItem(item);
    var word = h('span.ex-answer-text.wl-opt', lib.show(item.options[i]));
    var tag = h('span.ex-tag.wl-tag', { hidden: true });
    var box = h('span.ex-answer.wl-answer', word, tag);
    el.appendChild(box);
    st.opts[i] = box;
  }
  function optionLabel(item, i) { return lib.show(item.options[i]); }
  function gridCols() { return 2; }

  /* ---------- reveal (development; the Check shows nothing), ≤ 700 ms ---------- */

  function reveal(item, response, result, ctx) {
    if (!st) return Promise.resolve();
    timerStop();
    st.root.classList.add('is-revealed');
    st.words.q.textContent = lib.show(item.options[item.key]);
    st.verdict.textContent = (result && result.correct ? '✓ ' : '→ ') + cap('verdict', item);
    st.verdict.setAttribute('data-kind', 'same');
    st.verdict.hidden = false;
    // Development aid: what each foil is (linked to C, same family, …).
    st.opts.forEach(function (o, i) {
      var tag = o.querySelector('.wl-tag');
      if (!tag || i === item.key) return;
      tag.textContent = KIND_TAG[item.kinds[i]] || item.kinds[i];
      tag.hidden = false;
    });
    return timing.wait(ctx && ctx.fast ? 0 : 250);
  }

  /* ---------- show me and the worked example ---------- */

  function runSteps(list, ctx, opts) { // minimal runner when the player has no ctx.play
    var scale = ctx && ctx.fast ? 0.02 : 1;
    return new Promise(function (resolve) {
      var i = -1, start = 0, go = true;
      function begin(now) {
        i++;
        if (i >= list.length) { resolve(); return false; }
        start = now;
        if (list[i].caption && opts.caption) opts.caption(list[i].caption);
        if (list[i].enter) list[i].enter();
        return true;
      }
      timing.loop(function (dt, now) {
        if (go) { go = false; if (!begin(now)) return false; }
        var s = list[i], k = U.clamp((now - start) / Math.max(1, s.ms * scale), 0, 1);
        if (s.update) s.update(k);
        if (k >= 1) { if (s.exit) s.exit(); if (!begin(now)) return false; }
        return true;
      });
    });
  }
  function play(list, ctx, opts) {
    var o = opts || {};
    if (!o.caption) o.caption = function (text) { if (st) st.caption.textContent = text; };
    if (ctx && typeof ctx.play === 'function') return ctx.play(list, o);
    return runSteps(list, ctx, o);
  }
  function clearMarks() { point([]); focusOption(-1); }

  function showMe(item, response, ctx) {
    if (!st || st.item !== item) return Promise.resolve();
    return play([
      { ms: 1500, caption: cap('link', item), enter: function () { clearMarks(); point(['a', 'b']); } },
      { ms: 1600, caption: cap('answer', item), enter: function () { point(['c', 'q']); focusOption(item.key); }, exit: function () {} },
    ], ctx, { name: 'show-me' }).then(clearMarks);
  }

  // The one-screen instruction's worked example (learn.demo: a fixed seed the Check never scores).
  function demo(item, ctx, caption) {
    if (!st || st.item !== item) return Promise.resolve();
    timerStop();
    return play([
      { ms: 2000, caption: cap('first', item), enter: function () { clearMarks(); point(['a', 'b']); } },
      { ms: 2200, caption: cap('link', item), enter: function () { point(['a', 'b']); } },
      { ms: 2000, caption: cap('second', item), enter: function () { focusOption(-1); point(['c', 'q']); } },
      { ms: 2600, caption: cap('answer', item), enter: function () { point(['c', 'q']); focusOption(item.key); } },
      { ms: 2000, caption: cap('others', item), enter: function () { point(['c']); focusOption(item.key); } },
      { ms: 1600, caption: cap('keys', item), enter: clearMarks },
    ], ctx, { name: 'demo', caption: caption || null }).then(clearMarks);
  }

  function unmount() {
    if (!st) return;
    if (st.root.parentNode) st.root.parentNode.removeChild(st.root);
    st = null;
  }

  PX.ex.view('wordlinks', {
    layout: 'stem+options',
    css: true,
    mount: mount,
    present: present,
    drawOption: drawOption,
    optionLabel: optionLabel,
    gridCols: gridCols,
    reveal: reveal,
    showMe: showMe,
    demo: demo,
    unmount: unmount,
    sentence: sentence, // for tests: the explanation show me uses
  });
})(window.PX);
