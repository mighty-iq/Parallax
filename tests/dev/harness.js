/* Parallax dev harness: a mini player that mounts one exercise view without the app shell
   (ARCHITECTURE.md §6, §12; docs/dev/EXERCISE-GUIDE.md).

   tests/dev/harness.html?ex=rotate&seed=123&p=angle:3,axis:1&v=pick&fast=1&theme=dark&rm=1
     ex      exercise id (loads js/ex/<id>/gen.js, learn.js, view.js in order, then
             css/ex/<id>.css when the view definition says css: true)
     seed    item seed (default: random); New item adds 1
     p       dim:level pairs (level indices); missing dims are 0
     v       variant;  fast=1 short animations (tests);  rm=1 reduced motion;  theme=light|dark
   In a sandboxed srcdoc frame there is no query string and nothing can be loaded from disk:
   the page is inlined (tests/e2e/common.py) and window.PX_HARNESS_CFG = { ex, seed, p, v, … }
   replaces the query; exercise files already present are not loaded again.

   Flow, as ui/play.js will do it: ready (generate, validate, build the choice grid hidden,
   drawOption for every option) → present (grid shown in the same frame; the answer clock
   starts at the paint timestamp present resolves with) → respond (grid, or the view's collect)
   → reveal (the harness marks its grid; view.reveal marks the stem) → show me / next.
   Keys: 1–9 options · Enter confirm (pick-two) or next · Space next · Esc pause · S show me ·
   N new item · T theme · during show me: Space pause, → step, R replay, Esc close.
   window.__harness = { item, key, state, last, errors, played, answer(correct), next(params, seed),
   showMe(), demo(), setTheme(name), config } (promises resolve when the step is done; played
   counts started and finished show-me / demo runs and the last run's duration). */
(function (PX) {
  'use strict';

  var win = window, doc = win.document;
  var h = PX.ui.h, keys = PX.core.keys, timing = PX.core.timing, S3 = PX.core.stage3d;
  var ID_RE = /^[a-z][a-z0-9-]{0,39}$/;

  /* ---------- config ---------- */

  function parseP(text) {
    var out = {};
    String(text || '').split(',').forEach(function (pair) {
      // Decimals are for extra params (def.extraParams, e.g. Track's speedValue); dims take indices.
      var m = /^\s*([A-Za-z][A-Za-z0-9_]*)\s*[:=]\s*(\d+(?:\.\d+)?)\s*$/.exec(pair);
      if (m) out[m[1]] = +m[2];
    });
    return out;
  }

  function readConfig() {
    var cfg = { ex: 'rotate', seed: null, p: {}, v: null, fast: false, rm: false, theme: null };
    var q = '';
    try { q = String(win.location.search || ''); } catch (e) { q = ''; }
    q.replace(/^\?/, '').split('&').forEach(function (kv) {
      var i = kv.indexOf('='), k = i < 0 ? kv : kv.slice(0, i), v = i < 0 ? '' : decodeURIComponent(kv.slice(i + 1).replace(/\+/g, ' '));
      if (k === 'ex') cfg.ex = v;
      else if (k === 'seed') cfg.seed = v === '' ? null : Number(v) >>> 0;
      else if (k === 'p') cfg.p = parseP(v);
      else if (k === 'v') cfg.v = v || null;
      else if (k === 'fast') cfg.fast = v !== '0';
      else if (k === 'rm') cfg.rm = v !== '0';
      else if (k === 'theme') cfg.theme = v === 'dark' || v === 'light' ? v : null;
    });
    var inj = win.PX_HARNESS_CFG;
    if (inj && typeof inj === 'object') {
      for (var k in inj) if (Object.prototype.hasOwnProperty.call(inj, k)) cfg[k] = k === 'p' && typeof inj.p === 'string' ? parseP(inj.p) : inj[k];
    }
    if (cfg.seed === null || !isFinite(cfg.seed)) cfg.seed = Math.floor(Math.random() * 1e6); // dev default only
    return cfg;
  }

  var cfg = readConfig();

  /* ---------- state ---------- */

  var H = {
    state: 'loading', def: null, view: null, learn: null, item: null, params: null, seed: cfg.seed,
    grid: null, offGrid: null, paintTs: 0, pauseStart: 0, pausedMs: 0, last: null, ctx: null,
    shown: {}, waiters: [], genMs: 0, valid: null, played: { started: 0, finished: 0, ms: 0, plannedMs: 0 },
  };
  var el = {}; // page elements

  function setState(s) {
    H.state = s;
    doc.documentElement.setAttribute('data-hx-state', s);
    if (el.state) el.state.textContent = s;
    var w = H.waiters.slice();
    H.waiters = H.waiters.filter(function (x) { return x.state !== s; });
    w.forEach(function (x) { if (x.state === s) x.resolve(s); });
  }
  function when(s) {
    if (H.state === s) return Promise.resolve(s);
    return new Promise(function (resolve) { H.waiters.push({ state: s, resolve: resolve }); });
  }

  /* ---------- errors on the page ---------- */

  function errors() { return win.PX_HARNESS_ERRORS || (win.PX_HARNESS_ERRORS = []); }
  function fail(msg) { errors().push(String(msg)); showErrors(); }
  function showErrors() {
    if (!el.errors) return;
    var list = errors();
    el.errors.hidden = !list.length;
    PX.ui.clear(el.errors);
    if (list.length) {
      el.errors.appendChild(h('strong', 'Errors'));
      el.errors.appendChild(h('ul', list.slice(-8).map(function (m) { return h('li', m); })));
    }
  }
  win.PX_HARNESS_SHOW = showErrors;

  /* ---------- loading the exercise ---------- */

  function loadScript(src) {
    return new Promise(function (resolve, reject) {
      var s = doc.createElement('script');
      s.src = src;
      s.async = false;
      s.onload = function () { resolve(src); };
      s.onerror = function () { reject(new Error('could not load ' + src)); };
      doc.body.appendChild(s);
    });
  }
  function loadStyle(href) {
    return new Promise(function (resolve, reject) {
      var l = doc.createElement('link');
      l.rel = 'stylesheet';
      l.href = href;
      l.onload = function () { resolve(href); };
      l.onerror = function () { reject(new Error('could not load ' + href)); };
      doc.head.appendChild(l);
    });
  }

  // gen.js, learn.js, view.js in this order (ARCHITECTURE §3), each after the previous one ran.
  function loadExercise(id) {
    if (!ID_RE.test(id)) return Promise.reject(new Error('bad exercise id ' + JSON.stringify(id)));
    if (PX.ex.get(id) && PX.ex.view(id)) return Promise.resolve('inlined');
    var base = '../../js/ex/' + id + '/';
    var files = ['gen.js', 'learn.js', 'view.js'].filter(function (f) {
      return !(f === 'gen.js' && PX.ex.get(id)) && !(f === 'learn.js' && PX.ex.learn(id)) && !(f === 'view.js' && PX.ex.view(id));
    });
    return files.reduce(function (p, f) { return p.then(function () { return loadScript(base + f); }); }, Promise.resolve())
      .then(function () {
        var v = PX.ex.view(id);
        if (!PX.ex.get(id)) throw new Error('js/ex/' + id + '/gen.js loaded but did not define "' + id + '"');
        if (!v) throw new Error('js/ex/' + id + '/view.js loaded but did not register a view');
        if (v.css === true && !cfg.inlinedCss) return loadStyle('../../css/ex/' + id + '.css');
        return null;
      });
  }

  /* ---------- page ---------- */

  function fmtLevel(dim, v) { return typeof v === 'number' ? v + (dim.unit || '') : String(v); }

  function buildPage() {
    var def = H.def;
    el.errors = h('div.hx-errors', { role: 'alert', hidden: true });
    el.state = h('span.hx-state', H.state);
    el.selects = {};
    var fields = [];
    if (def.variants) {
      el.variant = h('select', { 'aria-label': 'Variant' }, def.variants.map(function (v) { return h('option', { value: v }, v); }));
      fields.push(h('label.hx-field', h('span', 'Variant'), el.variant));
    }
    def.dims.forEach(function (dim) {
      var s = h('select', { 'aria-label': dim.label }, dim.levels.map(function (v, i) { return h('option', { value: String(i) }, fmtLevel(dim, v)); }));
      el.selects[dim.key] = s;
      fields.push(h('label.hx-field', h('span', dim.label), s));
    });
    el.seed = h('input', { type: 'number', min: '0', step: '1', inputmode: 'numeric', 'aria-label': 'Seed', value: String(H.seed) });
    fields.push(h('label.hx-field', h('span', 'Seed'), el.seed));
    var btn = function (label, key, fn, extra) { return PX.ui.button(label, Object.assign({ kind: 'secondary', small: true, key: key, onClick: fn }, extra || {})); };
    el.newBtn = btn('New item', 'n', function () { next(null, H.seed + 1); });
    el.themeBtn = btn('Theme', 't', function () { setTheme(currentTheme() === 'dark' ? 'light' : 'dark'); });
    el.fastBtn = btn('Fast', null, function () { cfg.fast = !cfg.fast; el.fastBtn.setAttribute('aria-pressed', String(cfg.fast)); if (H.ctx) H.ctx.fast = cfg.fast; });
    el.fastBtn.setAttribute('aria-pressed', String(!!cfg.fast));
    el.demoBtn = btn('Demo', null, function () { runDemo(); });
    [el.variant].concat(Object.keys(el.selects).map(function (k) { return el.selects[k]; })).forEach(function (s) {
      if (s) s.addEventListener('change', function () { next(readControls(), H.seed); });
    });
    el.seed.addEventListener('change', function () { next(readControls(), Number(el.seed.value) >>> 0); });

    // One row of controls on wide screens; a disclosure on phones, so the trial stays in view.
    var body = h('div.hx-controls-body', fields, el.newBtn, el.demoBtn, el.themeBtn, el.fastBtn);
    el.controls = (win.innerWidth || 1024) > 720 ? h('div.hx-controls', body) : h('details.hx-controls', h('summary', 'Controls'), body);
    var title = h('div.hx-title',
      h('span.hx-code', def.code), h('span.hx-name', def.name), h('span.hx-abil', def.abilities.join(' ')), el.state);
    el.host = h('div.hx-host');
    el.tip = h('p.hx-tip', { hidden: true, role: 'note' });
    el.goal = h('p.hx-goal');
    el.grid = h('div.hx-grid');
    el.confirm = PX.ui.button('Confirm', { kind: 'primary', key: 'Enter', onClick: function () { confirmMulti('pointer'); } });
    el.confirm.hidden = true;
    el.pause = h('div.hx-pause', { hidden: true }, h('p', 'Paused'), PX.ui.button('Resume', { kind: 'primary', key: 'Escape', onClick: function () { togglePause(); } }));
    el.trial = h('section.hx-trial', { 'aria-label': 'Trial' }, el.goal, el.tip, el.host, el.grid, h('div.hx-actions', el.confirm), el.pause);
    el.trial.classList.add('ex-' + def.id);
    el.result = h('p.hx-result', { 'aria-live': 'polite' });
    el.showBtn = PX.ui.button('Show me', { kind: 'secondary', key: 's', onClick: function () { runShowMe(); } });
    el.nextBtn = PX.ui.button('Next', { kind: 'primary', key: 'Space', onClick: function () { next(null, H.seed + 1); } });
    el.feedback = h('section.hx-feedback', { hidden: true }, el.result, h('div.hx-feedback-actions', el.showBtn, el.nextBtn));
    el.caption = h('p.hx-caption', { 'aria-live': 'polite' });
    el.pPause = PX.ui.button('Pause', { kind: 'secondary', small: true, key: 'Space', onClick: function () { playerCmd('pause'); } });
    el.pStep = PX.ui.button('Step', { kind: 'secondary', small: true, key: '→', onClick: function () { playerCmd('step'); } });
    el.pReplay = PX.ui.button('Replay', { kind: 'secondary', small: true, key: 'r', onClick: function () { playerCmd('replay'); } });
    el.pClose = PX.ui.button('Close', { kind: 'ghost', small: true, key: 'Escape', onClick: function () { playerCmd('close'); } });
    el.player = h('section.hx-player', { hidden: true, 'aria-label': 'Show me controls' }, el.caption, h('div.hx-player-buttons', el.pPause, el.pStep, el.pReplay, el.pClose));
    el.status = h('p.hx-status');
    el.json = h('pre.hx-json');
    var dbg = h('details.hx-debug', h('summary', 'Item'), el.json);
    var main = h('main.hx-main', el.errors, el.trial, el.player, el.feedback, el.status, dbg);
    doc.body.appendChild(h('header.hx-bar', title, el.controls));
    doc.body.appendChild(main);
    showErrors();
  }

  function readControls() {
    var p = {};
    H.def.dims.forEach(function (dim) { p[dim.key] = Number(el.selects[dim.key].value) || 0; });
    if (el.variant) p.variant = el.variant.value;
    return p;
  }
  function writeControls(p) {
    H.def.dims.forEach(function (dim) { el.selects[dim.key].value = String(p[dim.key] || 0); });
    if (el.variant && p.variant) el.variant.value = p.variant;
    el.seed.value = String(H.seed);
  }

  function currentTheme() {
    var t = doc.documentElement.getAttribute('data-theme');
    if (t) return t;
    try { return win.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'; } catch (e) { return 'light'; }
  }
  function setTheme(name) {
    doc.documentElement.setAttribute('data-theme', name === 'dark' ? 'dark' : 'light');
    if (H.ctx) H.ctx.theme = currentTheme();
    if (S3 && S3.available()) S3.refreshTheme();
    return currentTheme();
  }
  function reducedMotion() {
    if (cfg.rm) return true;
    try { return win.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) { return false; }
  }

  /* ---------- one trial ---------- */

  // ARCHITECTURE §6: variants may answer differently; the item says how (item.answer).
  function answerType(item) { return item.answer || (H.def.answers && H.def.answers[item.params && item.params.variant]) || H.def.answer; }
  function nOptions(item) { return item.nOptions || H.def.nOptions || 2; }
  function nCorrect(item) { return item.nCorrect || H.def.nCorrect || 1; }

  function tipFor(item) {
    var L = H.learn;
    if (!L || !Array.isArray(L.tips)) return null;
    for (var i = 0; i < L.tips.length; i++) {
      var t = L.tips[i], w = t.when || {};
      if (H.shown[t.id]) continue;
      if (w.variant && w.variant === item.params.variant) return t;
      if (w.dim && (w.levels || []).indexOf(item.params[w.dim]) >= 0) return t;
    }
    return null;
  }

  function destroyGrid() {
    if (H.offGrid) { H.offGrid(); H.offGrid = null; }
    if (H.grid) { H.grid.destroy(); H.grid = null; }
    PX.ui.clear(el.grid);
  }

  // Ready → present → respond. Resolves when the answer clock runs (state 'respond').
  function next(params, seed) {
    if (H.state === 'showme') playerCmd('close');
    if (H.state === 'loading' || H.state === 'error' || H.state === 'unavailable') return Promise.resolve(H.state);
    var def = H.def, view = H.view;
    if (params) H.params = PX.ex.validParams(def, params) === true ? params : fillParams(params);
    if (seed !== undefined && seed !== null) H.seed = seed >>> 0;
    setState('ready');
    H.voided = false;
    H.voidReason = null;
    el.feedback.hidden = true;
    el.player.hidden = true;
    el.pause.hidden = true;
    H.pauseStart = 0; H.pausedMs = 0;
    // generate and validate
    var t0 = timing.now(), item;
    try { item = def.generate(PX.rng(H.seed), H.params); } catch (e) { fail('generate threw: ' + e.message); setState('error'); return Promise.resolve('error'); }
    H.genMs = timing.now() - t0;
    H.valid = def.validate(item);
    if (H.valid !== true) fail('validate: ' + H.valid);
    H.item = item;
    writeControls(H.params);
    el.json.textContent = JSON.stringify(item, null, 1).slice(0, 20000);
    // the grid, hidden but laid out, so drawOption can measure its cells (ready phase)
    el.trial.style.visibility = 'hidden';
    destroyGrid();
    var type = answerType(item), n = nOptions(item);
    var goals = H.learn && H.learn.goals;
    el.goal.textContent = (goals && goals[item.params.variant]) || (H.learn && H.learn.goal) || '';
    var tip = tipFor(item);
    el.tip.hidden = !tip;
    el.tip.textContent = tip ? tip.text : '';
    if (tip) H.shown[tip.id] = true;
    if (view.layout === 'stem+options') {
      H.grid = PX.ui.choiceGrid(n, {
        cols: view.gridCols ? view.gridCols(item) : undefined,
        multi: type === 'multi',
        label: 'Answer options',
        labels: function (i) { return view.optionLabel ? view.optionLabel(item, i) : 'Option ' + (i + 1); },
      });
      el.grid.appendChild(H.grid.el);
      for (var i = 0; i < n; i++) view.drawOption(H.grid.cells[i], item, i, H.ctx);
      H.offGrid = H.grid.onPick(function (ix, source) { onPick(ix, source); });
    }
    el.confirm.hidden = type !== 'multi';
    el.confirm.disabled = true;
    // present: the stem and the grid appear in the same frame
    el.trial.style.visibility = '';
    return Promise.resolve(view.present(item, H.ctx)).then(function (paint) {
      H.paintTs = typeof paint === 'number' ? paint : timing.now();
      if (H.item !== item) return H.state;
      setState('respond');
      status();
      if (view.layout === 'custom') view.collect(item, H.ctx, function (r, meta) { respond(r, 'view', meta); });
      return 'respond';
    });
  }

  function fillParams(p) {
    var out = {};
    H.def.dims.forEach(function (d) { var v = p[d.key]; out[d.key] = Number.isInteger(v) && v >= 0 && v < d.levels.length ? v : 0; });
    if (H.def.variants) out.variant = H.def.variants.indexOf(p.variant) >= 0 ? p.variant : H.def.variants[0];
    // Extra params (Track's continuous speedValue for Threshold runs) pass through unchanged.
    (H.def.extraParams || []).forEach(function (k) { if (p[k] !== undefined) out[k] = p[k]; });
    return out;
  }

  function onPick(ix, source) {
    if (H.state !== 'respond') return;
    var type = answerType(H.item);
    if (type === 'yesno') respond(ix === 0, source);
    else if (type === 'choice') respond(ix, source);
    else if (type === 'multi') el.confirm.disabled = H.grid.selected().length !== nCorrect(H.item);
  }

  function confirmMulti(source) {
    if (H.state !== 'respond' || !H.grid) return false;
    var sel = H.grid.selected();
    if (sel.length !== nCorrect(H.item)) return false;
    respond(sel, source);
    return true;
  }

  // meta: what a custom view sends with its response for the log (Track: { frames, jump, late, void }).
  function respond(response, source, meta) {
    if (H.state !== 'respond') return Promise.resolve(null);
    var now = timing.now(), item = H.item;
    if (H.pauseStart) { H.pausedMs += now - H.pauseStart; H.pauseStart = 0; }
    setState('reveal');
    var result = H.def.score(item, response);
    // A trial during which the 3D context was lost, or that the view reported void ('trial:void'),
    // never counts (ARCHITECTURE §4).
    H.last = { response: response, result: result, rtMs: Math.round(now - H.paintTs - H.pausedMs), source: source || 'api', seed: H.seed, params: H.params, void: !!H.voided, voidReason: H.voidReason || null, meta: meta || null };
    if (H.grid) { H.grid.lock(true); markGrid(item, response, result); }
    el.confirm.hidden = true;
    var done = H.view.reveal ? H.view.reveal(item, response, result, H.ctx) : null;
    el.result.textContent = (result.correct ? '✓ Right' : '✗ Not this time: the right answer is marked') + ' · ' + (H.last.rtMs / 1000).toFixed(2) + ' s' +
      (H.voided ? ' · ' + (H.voidReason ? 'void (' + H.voidReason + ')' : 'the 3D view was interrupted') + ', so this trial does not count' : '');
    el.result.setAttribute('data-kind', result.correct ? 'right' : 'wrong');
    el.feedback.hidden = false;
    status();
    return Promise.resolve(done).then(function () { return result; });
  }

  function markGrid(item, response, result) {
    var g = H.grid, type = answerType(item), n = nOptions(item), key = item.key, i;
    var picked = type === 'yesno' ? [response ? 0 : 1] : type === 'multi' ? (response || []) : [response];
    var right = type === 'yesno' ? [key ? 0 : 1] : type === 'multi' ? key : [key];
    for (i = 0; i < n; i++) {
      var p = picked.indexOf(i) >= 0, r = right.indexOf(i) >= 0;
      g.mark(i, p && r ? 'right' : p ? 'wrong' : r ? 'missed' : 'dim');
    }
  }

  function togglePause() {
    if (H.state !== 'respond' && H.state !== 'paused') return;
    if (H.state === 'respond') {
      if (!H.pauseStart) H.pauseStart = timing.now(); // a second pause keeps the first start
      el.pause.hidden = false;
      setState('paused');
    } else {
      H.pausedMs += timing.now() - H.pauseStart;
      H.pauseStart = 0;
      el.pause.hidden = true;
      setState('respond');
    }
  }

  function status() {
    var it = H.item;
    el.status.textContent = it ? [
      'seed ' + H.seed, PX.ex.paramsKey(it.params), 'generated in ' + H.genMs.toFixed(1) + ' ms',
      'validate ' + (H.valid === true ? '✓' : '✗ ' + H.valid),
      H.last && H.last.seed === H.seed ? 'answer ' + JSON.stringify(H.last.response) + ' → ' + (H.last.result.correct ? 'right' : 'wrong') : 'key ' + JSON.stringify(it.key),
    ].join(' · ') : '';
  }

  /* ---------- the step runner the views use for show me and demo (ctx.play) ---------- */

  // steps: [{ ms, caption?, enter?(), update?(k ∈ [0, 1]), exit?() }]. Pause, Step (finish this
  // step and hold), Replay (from the first step), Close (finish every step at once). fast: 2 %
  // of the time; reduced motion: 75 % of the time, and updates jump in keyframes about 400 ms
  // apart (≤ 2.5 Hz) instead of moving smoothly. Time comes from rAF dt (clamped to 100 ms).
  var player = null;
  function play(steps, opts) {
    opts = opts || {};
    if (player) player.close();
    return new Promise(function (resolve) {
      var i = 0, t = 0, paused = false, done = false, stop = null, prev = H.state;
      // reduced motion: 75 % of the time and keyframes instead of smooth motion
      var rm = reducedMotion(), scale = cfg.fast ? 0.02 : rm ? 0.75 : 1;
      var caption = opts.caption || function (text) { el.caption.textContent = text; };
      function dur() { return Math.max(1, (steps[i].ms || 0) * scale); }
      var lastK = -1;
      function enter(k) {
        i = k; t = 0; lastK = 0;
        var s = steps[i];
        if (s.caption) caption(s.caption);
        if (s.enter) s.enter();
        if (s.update) s.update(0);
      }
      function finish() { var s = steps[i]; if (s.update) s.update(1); if (s.exit) s.exit(); }
      function end() {
        if (done) return;
        done = true;
        H.played.finished++;
        H.played.ms = Math.round(timing.now() - t0play);
        if (stop) stop();
        player = null;
        el.player.hidden = true;
        el.pPause.firstChild.textContent = 'Pause';
        // Back to the state before this play. A 'showme' its caller set (the tutorial demo) is the
        // caller's to end, so the demo item stays answerable (runDemo).
        if (H.state === 'showme' && prev !== 'showme') setState(prev);
        resolve();
      }
      function frame(dt) {
        if (done) return false;
        if (paused) return true;
        t += dt;
        var d = dur(), k = Math.min(1, t / d);
        if (rm && k < 1) { var nk = Math.max(1, Math.round(d / 400)); k = Math.floor(k * nk) / nk; }
        if (steps[i].update && k !== lastK) steps[i].update(k); // keyframes: draw only on change
        lastK = k;
        if (t >= d) {
          finish();
          if (i + 1 < steps.length) enter(i + 1); else { end(); return false; }
        }
        return true;
      }
      function run() { if (!stop || done) return; }
      player = {
        pause: function () { paused = !paused; el.pPause.firstChild.textContent = paused ? 'Resume' : 'Pause'; },
        step: function () {
          finish();
          if (i + 1 < steps.length) { enter(i + 1); paused = true; el.pPause.firstChild.textContent = 'Resume'; } else end();
        },
        replay: function () { paused = false; el.pPause.firstChild.textContent = 'Pause'; enter(0); },
        close: function () { while (!done) { finish(); if (i + 1 < steps.length) { i++; var s = steps[i]; if (s.enter) s.enter(); } else end(); } },
      };
      var t0play = timing.now();
      H.played.started++;
      H.played.plannedMs = Math.round(steps.reduce(function (a, st) { return a + Math.max(1, (st.ms || 0) * scale); }, 0));
      if (!steps.length) { end(); return; }
      if (prev !== 'showme') setState('showme');
      el.player.hidden = false;
      enter(0);
      stop = timing.loop(function (dt) { return frame(dt); });
      run();
    });
  }
  function playerCmd(cmd) { if (player && player[cmd]) player[cmd](); }

  function runShowMe() {
    if (H.state !== 'reveal' || !H.view.showMe) return Promise.resolve(false);
    var resp = H.last ? H.last.response : null;
    return Promise.resolve(H.view.showMe(H.item, resp, H.ctx)).then(function () { return true; });
  }

  // Tutorial demo: a fresh item from learn.demo, played with captions under the stem. The demo
  // owns the 'showme' state (ctx.play leaves it alone) and hands its item back answerable:
  // state 'respond', with the answer clock restarted when the demo ends (or is closed).
  function runDemo() {
    var d = H.learn && Array.isArray(H.learn.demo) ? H.learn.demo[0] : null;
    if (!d || !H.view.demo) { fail('this exercise has no demo (learn.demo / view.demo)'); return Promise.resolve(false); }
    var started = next(d.params, d.seed), item = H.item; // next() sets H.item before it returns
    return started.then(function (s) {
      if (s !== 'respond' || H.item !== item) return false;
      function back() {
        if (H.item !== item || H.state !== 'showme') return; // a newer item took over
        H.paintTs = timing.now(); H.pausedMs = 0; H.pauseStart = 0;
        setState('respond');
        status();
      }
      setState('showme');
      return Promise.resolve().then(function () {
        return H.view.demo(item, H.ctx, function (text) { el.caption.textContent = text; });
      }).then(function () { back(); return true; }, function (e) {
        fail('view.demo failed: ' + (e && e.message ? e.message : e));
        back();
        return false;
      });
    });
  }

  /* ---------- keys ---------- */

  function installBus() {
    PX.bus.on('stage3d:lost', function () {
      if (H.state === 'ready' || H.state === 'respond' || H.state === 'paused') H.voided = true;
      status();
    });
    // A view's own void rule (Track: a visible jump, late frames, a pause, a fallback item).
    PX.bus.on('trial:void', function (e) {
      if (H.state !== 'ready' && H.state !== 'respond' && H.state !== 'paused') return;
      if (e && e.seed !== undefined && H.item && e.seed !== H.item.seed) return; // an old trial
      H.voided = true;
      if (!H.voidReason) H.voidReason = (e && e.reason) || 'void';
      status();
    });
    PX.bus.on('stage3d:dead', function () { fail('the 3D view was lost and did not come back (stage3d.restart() would rebuild it)'); });
  }

  function installKeys() {
    keys.push({
      Enter: function () {
        if (H.state === 'respond') return confirmMulti('key') ? undefined : false;
        if (H.state === 'reveal') { next(null, H.seed + 1); return undefined; }
        return false;
      },
      Space: function () {
        if (H.state === 'showme') { playerCmd('pause'); return undefined; }
        if (H.state === 'reveal') { next(null, H.seed + 1); return undefined; }
        return false;
      },
      Escape: function () {
        if (H.state === 'showme') { playerCmd('close'); return undefined; }
        if (H.state === 'respond' || H.state === 'paused') { togglePause(); return undefined; }
        return false;
      },
      ArrowRight: function () { if (H.state === 'showme') { playerCmd('step'); return undefined; } return false; },
      r: function () { if (H.state === 'showme') { playerCmd('replay'); return undefined; } return false; },
      s: function () { if (H.state === 'reveal') { runShowMe(); return undefined; } return false; },
      n: function () { if (H.state !== 'showme') { next(null, H.seed + 1); return undefined; } return false; },
      t: function () { setTheme(currentTheme() === 'dark' ? 'light' : 'dark'); },
    });
  }

  /* ---------- test API ---------- */

  // A response that is right (or wrong) for the current item. With a choice grid it goes through
  // the grid exactly as a click would; a custom layout gets it through the respond path its
  // view's collect() callback uses (source 'api', meta { input: 'api' }).
  function answer(correct) {
    if (H.state !== 'respond' || (!H.grid && H.view.layout !== 'custom')) return Promise.reject(new Error('not answering now (state ' + H.state + ')'));
    var item = H.item, type = answerType(item), key = item.key, before = H.last;
    if (H.grid) {
      var n = nOptions(item), pick;
      if (type === 'yesno') pick = [(correct ? key : !key) ? 0 : 1];
      else if (type === 'choice') pick = [correct ? key : (key + 1) % n];
      else {
        var wrong = []; for (var i = 0; i < n; i++) if (key.indexOf(i) < 0) wrong.push(i);
        pick = correct ? key.slice() : [key[0], wrong[0]];
      }
      pick.forEach(function (ix) { H.grid.pick(ix, 'api'); });
      if (type === 'multi') confirmMulti('api');
    } else {
      var resp = correct ? (Array.isArray(key) ? key.slice() : key) : wrongResponse(item, type);
      if (resp === undefined) return Promise.reject(new Error('answer(false): no wrong response for answer type ' + type));
      respond(resp, 'api', { input: 'api' });
    }
    return when('reveal').then(function () { return H.last !== before ? H.last.result : null; });
  }

  // A wrong response of the item's own answer type, one step from the key: targets swap one id
  // for the first id outside the key (a key never holds every id); a sequence swaps two positions
  // that differ; an angle misses by the tolerance + 20°; yes/no, choice and multi as the grid does.
  function wrongResponse(item, type) {
    var key = item.key, out, i, j, t, free = 0;
    if (type === 'yesno') return !key;
    if (type === 'choice') return (key + 1) % nOptions(item);
    if (type === 'angle') {
      var a = (key + Math.min((item.tolerance || 0) + 20, 180)) % 360;
      return Math.round((a < 0 ? a + 360 : a) * 100) / 100;
    }
    if (!Array.isArray(key) || !key.length) return undefined;
    if (type === 'sequence') {
      out = key.slice();
      for (i = 0; i < out.length; i++) {
        for (j = i + 1; j < out.length; j++) if (out[i] !== out[j]) { t = out[i]; out[i] = out[j]; out[j] = t; return out; }
      }
      out[0] = out[0] === 0 ? 1 : 0; // a single position (or all alike): change the first
      return out;
    }
    while (key.indexOf(free) >= 0) free++;
    if (type === 'multi') return [key[0], free];
    if (type === 'targets') return key.slice(0, -1).concat(free).sort(function (x, y) { return x - y; });
    return undefined;
  }

  win.__harness = {
    get item() { return H.item; },
    get key() { return H.item ? H.item.key : null; },
    get state() { return H.state; },
    get last() { return H.last; },
    get errors() { return errors().slice(); },
    get config() { return cfg; },
    get played() { return Object.assign({}, H.played); },
    answer: answer,
    next: function (params, seed) { return next(params ? fillParams(params) : null, seed === undefined ? H.seed + 1 : seed); },
    showMe: runShowMe,
    demo: runDemo,
    setTheme: setTheme,
    when: when,
  };
  PX.debug.current = function () { return H.item ? { exId: H.def.id, item: H.item, key: H.item.key } : null; };
  PX.debug.answer = function (c) { answer(c); return true; };
  PX.debug.fast = function (on) { cfg.fast = !!on; if (H.ctx) H.ctx.fast = cfg.fast; PX.debug.isFast = cfg.fast; return cfg.fast; };

  /* ---------- boot ---------- */

  function boot() {
    if (cfg.theme) doc.documentElement.setAttribute('data-theme', cfg.theme);
    if (cfg.rm) doc.documentElement.setAttribute('data-motion', 'reduce');
    loadExercise(cfg.ex).then(function () {
      H.def = PX.ex.get(cfg.ex);
      H.view = PX.ex.view(cfg.ex);
      H.learn = PX.ex.learn(cfg.ex);
      buildPage();
      installKeys();
      installBus();
      var p = fillParams(Object.assign({}, cfg.p, cfg.v ? { variant: cfg.v } : {}));
      H.params = p;
      if (H.view.needs === 'webgl' && !S3.available()) {
        el.host.appendChild(h('p.hx-unavailable', { role: 'alert' }, 'This exercise needs 3D graphics, which are not available here: ' + S3.reason() + '.'));
        setState('unavailable');
        return null;
      }
      H.ctx = {
        host: el.host, stage3d: S3, svg: PX.core.svg, ui: PX.ui, keys: keys, timing: timing,
        theme: currentTheme(), settings: { reducedMotion: reducedMotion() ? 'on' : 'off', keyHints: true },
        fast: !!cfg.fast, reducedMotion: reducedMotion(), play: play,
      };
      if (H.view.mount) H.view.mount(H.ctx);
      setState('mounted');
      return next(p, H.seed);
    }).catch(function (e) {
      if (!el.errors) { el.errors = h('div.hx-errors', { role: 'alert' }); doc.body.appendChild(el.errors); }
      fail(e && e.message ? e.message : e);
      setState('error');
    });
  }

  if (doc.readyState === 'loading') doc.addEventListener('DOMContentLoaded', boot); else boot();
})(window.PX);
