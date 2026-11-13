/* PX.engine.assess: the Spatial Check (PLAN §4 and §6) and the Lab crossover (PLAN §6).
   Probes are exercises with role 'probe'. They are never trained, give no feedback and never
   change a rating. Each probe is a short adaptive test: 16 items, the next one aiming at
   p = g + (1 − g)·0.6 under the current posterior (the first two at g + (1 − g)·0.85). θ and its standard error come from the
   exact grid posterior (prior N(middle of the probe's range, 1.5²)) with the known item
   difficulties, so forms with different seeds stay comparable.

     Check sessions run through modes ('check'); this file supplies start/next/answer/finish.
     The first item of each probe carries step.probe.example: the probe's worked example
     (PX.ex.learn(id).demo[0]) for the app to play first, never scored; check items never use a
     demo seed. A timed-out item ({ timeout: true }) is scored wrong.
     due(rec, now) → { due, kind: B1 | B2 | B3 | regular | delayed | null, why, next }
     nextCheck(rec, now) → { ready, kind, dueAt, dueDate, daysLeft, sessionsLeft, why }: what every
       screen shows (sessions count by streak.counts: ≥ 10 answers or 5 minutes, training modes)
     report(rec, now) → per-probe and composite change since the baseline average, with 95 %
       intervals, next to the control's change and the expected retest gain; outcome words
       'beyond familiarity', 'unclear yet' or 'no change'
     form(index) → { form: 'A' | 'B' | 'C', cycle }   expect(rec, value, now) (asked once)
   Retest model (Scharfen et al. 2018): the gain to the 2nd test G, half as much again to the
   3rd, then flat. G is the user's own B2 − B1. Measured from the baseline average, the
   retest part still expected at later checks is max(0, G)·(1.5 − mean of 0, 1, 1.5 over the
   baselines taken): G after two baselines (B2 already sits G/2 above the average, and G/2
   more is expected), 2G/3 after three. That estimate carries its own standard error (the same
   share of √(se_B1² + se_B2²); 0 when B2 ≤ B1), which widens the familiarity comparison. */
(function (PX) {
  'use strict';

  // Local references (globals are slow to look up inside Node's vm contexts used by the tests).
  var isArray = Array.isArray, isFin = isFinite, hasOwn = Object.prototype.hasOwnProperty;

  var U = PX.util;
  var E = PX.engine;
  var C = E.config;
  var M = E.model;
  var DAY = E.DAY;
  var FORMS = ['A', 'B', 'C'];
  var TRAINING = { train: true, path: true, speed: true, threshold: true, free: true };

  function isNum(x) { return typeof x === 'number' && isFin(x); }
  function isObj(x) { return !!x && typeof x === 'object' && !isArray(x); }

  /* ---------- the grid posterior of one probe ---------- */

  var GRID = (function () {
    var g = [];
    for (var i = 0; i <= 160; i++) g.push(-8 + i * 0.1);
    return g;
  })();

  function priorCenter(def) { var r = M.range(def); return (r.min + r.max) / 2; }

  function newPost(def) {
    var m = priorCenter(def), s = C.assess.priorSd;
    return GRID.map(function (th) { return -(th - m) * (th - m) / (2 * s * s); });
  }
  function updatePost(lw, b, g, ok) {
    for (var i = 0; i < GRID.length; i++) {
      var p = M.p(GRID[i], b, g);
      lw[i] += Math.log(ok ? p : 1 - p);
    }
  }
  function summary(lw) {
    var mx = -Infinity, i;
    for (i = 0; i < lw.length; i++) if (lw[i] > mx) mx = lw[i];
    var s0 = 0, s1 = 0, s2 = 0;
    for (i = 0; i < lw.length; i++) {
      var w = Math.exp(lw[i] - mx);
      s0 += w; s1 += w * GRID[i]; s2 += w * GRID[i] * GRID[i];
    }
    var m = s1 / s0;
    return { mu: m, sd: Math.sqrt(Math.max(s2 / s0 - m * m, 1e-6)) };
  }

  /* ---------- checks in the record ---------- */

  function checks(rec) {
    var list = isArray(rec.assess) ? rec.assess.filter(function (a) { return isObj(a) && isObj(a.results) && Date.parse(a.date) >= 0; }) : [];
    return list.slice().sort(function (a, b) { return Date.parse(a.date) - Date.parse(b.date); });
  }

  function form(index) { return { form: FORMS[index % FORMS.length], cycle: Math.floor(index / FORMS.length) }; }

  function probeIds(opts) {
    var A = C.assess, ids = A.composite.concat([A.control]);
    if (opts && opts.optional) ids = ids.concat(A.optional);
    return ids;
  }

  function composite(results) {
    var xs = C.assess.composite.filter(function (id) { return results[id] && isNum(results[id].theta) && isNum(results[id].se); });
    if (!xs.length) return null;
    var th = 0, v = 0;
    xs.forEach(function (id) { th += results[id].theta; v += results[id].se * results[id].se; });
    return { theta: th / xs.length, se: Math.sqrt(v) / xs.length, probes: xs };
  }

  // A third baseline when B1 and B2 differ by more than 2 combined standard errors (composite).
  function needB3(list) {
    if (list.length < 2) return false;
    var a = composite(list[0].results), b = composite(list[1].results);
    if (!a || !b) return false;
    return Math.abs(b.theta - a.theta) > C.assess.b3Se * Math.sqrt(a.se * a.se + b.se * b.se);
  }
  function baselineCount(list) { return list.length < 2 ? list.length : needB3(list) ? Math.min(3, list.length) : 2; }

  // A training session counts by the same rule as the weekly goal (streak.counts: at least 10
  // answers or 5 minutes), in a training mode.
  function counted(s) {
    return isObj(s) && TRAINING[s.mode] === true && (E.streak ? E.streak.counts(s) :
      (s.trials || 0) >= C.streak.minTrials || (s.practiceMs || 0) >= C.streak.minMs);
  }
  function sessionsAfter(rec, t, t2) {
    var n = 0;
    (isArray(rec.sessions) ? rec.sessions : []).forEach(function (s) {
      if (counted(s) && s.start > t && (t2 === undefined || s.start <= t2)) n++;
    });
    return n;
  }
  function lastTraining(rec) {
    var t = null;
    (isArray(rec.sessions) ? rec.sessions : []).forEach(function (s) {
      if (counted(s) && (t === null || s.start > t)) t = s.start;
    });
    return t;
  }

  function due(rec, now) {
    var A = C.assess, list = checks(rec), n = list.length;
    var lastAt = n ? Date.parse(list[n - 1].date) : null;
    if (n === 0) return { due: true, kind: 'B1', why: 'Measure your starting point: about 15 minutes, no feedback.', next: now };
    if (n === 1) {
      var at = lastAt + DAY / 2;
      return { due: now >= at, kind: 'B2', why: 'A second starting check: the first one also measured getting used to the tasks.', next: at };
    }
    if (n === 2 && needB3(list)) {
      var at3 = lastAt + DAY / 2;
      return { due: now >= at3, kind: 'B3', why: 'Your two starting checks differ more than expected, so a third one makes the baseline steadier.', next: at3 };
    }
    var nb = baselineCount(list), baseEnd = Date.parse(list[nb - 1].date);
    var lt = lastTraining(rec);
    var trainedSince = sessionsAfter(rec, baseEnd) >= 4;
    var recent = sessionsAfter(rec, now - 28 * DAY, now), before = sessionsAfter(rec, now - 56 * DAY, now - 28 * DAY);
    var stopped = lt !== null && now - lt >= A.delayedDays * DAY;
    var slowed = recent <= 1 && before >= 4;
    if (trainedSince && (stopped || slowed) && now - lastAt >= 21 * DAY && lastAt < (lt === null ? now : lt) + 21 * DAY) {
      return { due: true, kind: 'delayed', why: 'A delayed check about four weeks after training slowed shows what lasts.', next: now };
    }
    var days = (now - lastAt) / DAY, since = sessionsAfter(rec, lastAt);
    var nextAt = lastAt + A.everyDays * DAY;
    var ok = days >= A.everyDays && since >= A.everySessions;
    return {
      due: ok, kind: 'regular', next: nextAt, sessionsSince: since,
      why: ok ? 'Two weeks and ' + A.everySessions + ' sessions since your last check.' :
        'Next check after ' + A.everyDays + ' days and ' + A.everySessions + ' sessions (' + Math.floor(days) + ' days, ' + since + ' sessions so far).',
    };
  }

  // The one answer to "when is my next check?" for every screen: { ready, kind, dueAt (ms),
  // dueDate (local day), daysLeft, sessionsLeft, why }. Regular checks need both 14 days and
  // 8 counted training sessions since the last check; baselines B2/B3 come 12 hours apart.
  function nextCheck(rec, now) {
    var d = due(rec, now), A = C.assess;
    var at = isNum(d.next) ? d.next : now;
    var daysLeft = d.due ? 0 : Math.max(0, Math.ceil((at - now) / DAY));
    var sessionsLeft = d.kind === 'regular' ? Math.max(0, A.everySessions - (d.sessionsSince || 0)) : 0;
    return {
      ready: d.due === true, kind: d.kind, dueAt: at, dueDate: E.day(at),
      daysLeft: daysLeft, sessionsLeft: d.due ? 0 : sessionsLeft, why: d.why,
    };
  }

  /* ---------- the check session (called by modes) ---------- */

  function start(plan, rec, opts, now) {
    var list = checks(rec), f = form(list.length), d = due(rec, now);
    var probes = probeIds(opts).filter(function (id) {
      var def = PX.ex.get(id);
      return def && def.role === 'probe' && (!plan.can || plan.can(def));
    }).map(function (id) {
      var def = PX.ex.get(id);
      return { id: id, n: 0, items: C.assess.items, lw: newPost(def), right: 0, rts: [], recent: [], voids: 0 };
    });
    if (!probes.length) { plan.unavailable = 'The Spatial Check needs its probe exercises.'; return; }
    plan.exs = probes.map(function (p) { return p.id; });
    plan.check = { index: list.length, form: f.form, cycle: f.cycle, kind: d.kind, probes: probes, cur: 0 };
    plan.total = probes.length * C.assess.items;
    plan.budgetMs = Infinity;
  }

  function current(plan) {
    var pc = plan.check;
    while (pc.cur < pc.probes.length && pc.probes[pc.cur].n >= pc.probes[pc.cur].items) pc.cur++;
    return pc.probes[pc.cur] || null;
  }

  // A probe's worked examples (learn.js demo: [{ params, seed, kind }]), shown before its items
  // and never scored; check items never use their seeds.
  function demos(id) {
    var L = typeof PX.ex.learn === 'function' ? PX.ex.learn(id) : null;
    return L && isArray(L.demo) ? L.demo.filter(isObj) : [];
  }

  function next(plan, rec) {
    var pr = current(plan);
    if (!pr) return null;
    var def = PX.ex.get(pr.id), post = summary(pr.lw), pc = plan.check;
    // The first items of each probe are easy (g + (1 − g)·0.85), so a newcomer meets an easy item
    // right after the worked example; then the usual g + (1 − g)·0.6.
    var k = pr.n < C.assess.easyFirst ? C.assess.easyK : C.assess.k;
    var r = E.select.pick(def, post, { kind: 'target', k: k, recent: { keys: pr.recent }, rng: plan.rng, policy: 'high' });
    if (!r) return null;
    pr.recent.push(r.key);
    if (pr.recent.length > C.select.avoid) pr.recent.shift();
    var ex = demos(pr.id), taken = {};
    ex.forEach(function (d) { if (isNum(d.seed)) taken[d.seed] = true; });
    var seed = E.select.sharedSeed(PX.rng.hash('px-probe', pr.id, pc.form, pc.cycle, pr.n, pr.voids));
    for (var salt = 1; taken[seed] === true && salt <= 50; salt++) {
      seed = E.select.sharedSeed(PX.rng.hash('px-probe', pr.id, pc.form, pc.cycle, pr.n, pr.voids, 'not-a-demo', salt));
    }
    var example = !pr.exampled && ex.length ? ex[0] : null; // once per probe, before its first item
    pr.exampled = true;
    return E.modes._.makeStep(plan, rec, def, r, 'probe', {
      seed: seed, noNote: true, feedback: false, banner: pr.n === 0, newRun: pr.n === 0,
      probe: { id: pr.id, index: pr.n, of: pr.items, form: pc.form, control: pr.id === C.assess.control, example: example },
    });
  }

  function byId(plan, id) {
    var ps = plan.check.probes;
    for (var i = 0; i < ps.length; i++) if (ps[i].id === id) return ps[i];
    return null;
  }

  function voidStep(plan, rec, step) {
    var pr = byId(plan, step.exId);
    if (pr) pr.voids += 1; // the replacement item gets a different seed
  }

  function answer(plan, rec, step, ok, result) {
    var pr = byId(plan, step.exId);
    if (!pr) return;
    pr.n += 1;
    if (ok) {
      pr.right += 1;
      if (result && isNum(result.rt)) pr.rts.push(result.rt);
    }
    updatePost(pr.lw, step.b, step.g, ok);
  }

  function finish(plan, rec, now, res) {
    var results = {};
    plan.check.probes.forEach(function (pr) {
      if (!pr.n) return;
      var s = summary(pr.lw);
      results[pr.id] = {
        right: pr.right, n: pr.n, theta: U.round(s.mu, 4), se: U.round(s.sd, 4),
        rtMed: pr.rts.length ? Math.round(U.median(pr.rts)) : null,
      };
    });
    if (!Object.keys(results).length) return;
    if (!isArray(rec.assess)) rec.assess = [];
    var entry = { date: new Date(now).toISOString(), form: plan.check.form, kind: plan.check.kind, results: results };
    // Extras the screen collected (v1.1: display, viewport and input of the check; the one-tap
    // overlap answer): plain JSON values only, never over the fields above.
    var extra = plan.check.extra;
    if (isObj(extra)) Object.keys(extra).forEach(function (k) {
      var v = extra[k];
      if (hasOwn.call(entry, k) || k === '__proto__' || k === 'constructor' || k === 'prototype' || !/^[A-Za-z][A-Za-z0-9_]{0,39}$/.test(k)) return;
      if (v === null || typeof v === 'string' || typeof v === 'boolean' || isNum(v)) entry[k] = typeof v === 'string' ? v.slice(0, 200) : v;
      else if (isObj(v) || isArray(v)) { try { entry[k] = JSON.parse(JSON.stringify(v)); } catch (e) { /* not JSON: dropped */ } }
    });
    rec.assess.push(entry);
    res.check = { kind: plan.check.kind, form: plan.check.form, results: results, report: report(rec, now) };
  }

  /* ---------- the change report ---------- */

  var RETEST = [0, 1, 1.5]; // retest gain at tests 1, 2, 3 in units of G = B2 − B1; flat after

  function change(base, last, id) {
    var bs = base.map(function (c) { return c.results[id]; }).filter(function (r) { return r && isNum(r.theta) && isNum(r.se); });
    var L = last.results[id];
    if (!bs.length || !L || !isNum(L.theta) || !isNum(L.se)) return { ok: false };
    var k = bs.length, bm = U.mean(bs.map(function (r) { return r.theta; }));
    var bse = Math.sqrt(U.sum(bs.map(function (r) { return r.se * r.se; }))) / k;
    var d = L.theta - bm, se = Math.sqrt(L.se * L.se + bse * bse);
    var G = k >= 2 ? bs[1].theta - bs[0].theta : null, share = 1.5 - U.mean(RETEST.slice(0, k));
    var retest = G === null ? null : Math.max(0, G) * share;
    // The familiarity estimate is measured too: G has the standard error √(se_B1² + se_B2²), so
    // r = 0.5·max(0, G) has half of it and the part compared here (share·G) share of it; none
    // when B2 ≤ B1, where the estimate is 0.
    var seG = G !== null && G > 0 ? Math.sqrt(bs[0].se * bs[0].se + bs[1].se * bs[1].se) : 0;
    var acc = function (rs) { var n = U.sum(rs.map(function (r) { return r.n; })); return n ? U.sum(rs.map(function (r) { return r.right; })) / n : null; };
    var rtb = bs.map(function (r) { return r.rtMed; }).filter(isNum);
    return {
      ok: true, change: d, se: se, lo: d - C.z * se, hi: d + C.z * se, baseline: bm, baselineSe: bse, baselines: k,
      latest: L.theta, latestSe: L.se, gain12: G, retestRemaining: G === null ? null : 0.5 * Math.max(0, G), retest: retest,
      retestRemainingSe: G === null ? null : 0.5 * seG, retestSe: G === null ? null : share * seG,
      accuracy: { baseline: acc(bs), latest: L.n ? L.right / L.n : null },
      rtMed: { baseline: rtb.length ? U.median(rtb) : null, latest: isNum(L.rtMed) ? L.rtMed : null },
    };
  }

  var TEXT = {
    'beyond familiarity': 'Larger than familiarity with the tasks and the word task would predict.',
    'unclear yet': 'At least one comparison (with familiarity or with the word task) still includes zero. This is the usual result and not the same as no progress; a change shows once it is larger than this range.',
    'no change': 'No change beyond what familiarity predicts, at this precision.',
  };

  // Both conditions, with 95 % intervals: the change clears the control's change, and it clears
  // the expected retest gain (that interval also carries the retest estimate's own standard
  // error). Otherwise 'unclear yet', or 'no change' when even the upper end of the change beyond
  // familiarity is small.
  function decide(x, ctl) {
    var z = C.z, retest = isNum(x.retest) ? x.retest : 0;
    var vr = x.change - retest, sr = Math.sqrt(x.se * x.se + (isNum(x.retestSe) ? x.retestSe * x.retestSe : 0));
    x.vsRetest = { diff: vr, se: sr, lo: vr - z * sr, hi: vr + z * sr, known: isNum(x.retest) };
    x.vsControl = null;
    if (ctl && ctl.ok) {
      var vc = x.change - ctl.change, sc = Math.sqrt(x.se * x.se + ctl.se * ctl.se);
      x.vsControl = { diff: vc, lo: vc - z * sc, hi: vc + z * sc };
    }
    if (x.vsRetest.known && x.vsRetest.lo > 0 && x.vsControl && x.vsControl.lo > 0) x.outcome = 'beyond familiarity';
    else if (x.vsRetest.known && x.vsRetest.hi < C.assess.noChange) x.outcome = 'no change';
    else x.outcome = 'unclear yet';
    x.text = TEXT[x.outcome];
    return x;
  }

  // Level change on trained exercises since the end of the baseline (near transfer, for context).
  function near(rec, since, now) {
    var day = E.day(since), out = {};
    PX.ex.list('train').forEach(function (def) {
      var e = rec.ex && rec.ex[def.id];
      if (!isObj(e) || !isArray(e.hist) || !e.hist.length) return;
      var h0 = null;
      for (var i = 0; i < e.hist.length; i++) { if (e.hist[i][0] <= day) h0 = e.hist[i]; else break; }
      if (!h0) h0 = e.hist[0];
      var a = E.est.level(def, { mu: h0[1], sd: h0[2], n: 1 }, { settings: false });
      var b = E.est.level(def, E.est.get(rec, def, null, now), { settings: false });
      out[def.id] = { from: a.level, to: b.level, change: b.level - a.level, lo: b.lo, hi: b.hi };
    });
    return out;
  }

  function report(rec, now) {
    var A = C.assess, list = checks(rec);
    var out = { status: 'none', checks: list.length, baselines: 0, probes: {}, composite: null, control: null, near: null, lines: [] };
    if (!list.length) { out.lines.push('No Spatial Check yet.'); return out; }
    var nb = baselineCount(list);
    out.baselines = nb;
    if (list.length < 2) { out.status = 'baseline'; out.lines.push('One more starting check, then changes can be shown.'); return out; }
    if (list.length <= nb) {
      out.status = needB3(list) && list.length < 3 ? 'baseline' : 'baseline-done';
      out.lines.push(out.status === 'baseline' ? 'A third starting check will steady the baseline.' : 'Starting point measured. Changes appear after your next check.');
      return out;
    }
    var base = list.slice(0, nb), last = list[list.length - 1];
    out.status = 'change';
    out.latest = { date: last.date, form: last.form };
    Object.keys(last.results).forEach(function (id) { out.probes[id] = change(base, last, id); });
    out.control = out.probes[A.control] && out.probes[A.control].ok ? out.probes[A.control] : null;
    Object.keys(out.probes).forEach(function (id) { if (id !== A.control && out.probes[id].ok) decide(out.probes[id], out.control); });
    var cp = A.composite.filter(function (id) { return out.probes[id] && out.probes[id].ok; });
    if (cp.length) {
      var d = U.mean(cp.map(function (id) { return out.probes[id].change; }));
      var se = Math.sqrt(U.sum(cp.map(function (id) { return out.probes[id].se * out.probes[id].se; }))) / cp.length;
      var rts = cp.map(function (id) { return out.probes[id].retest; });
      var known = rts.every(isNum);
      out.composite = decide({
        ok: true, probes: cp, change: d, se: se, lo: d - C.z * se, hi: d + C.z * se,
        retest: known ? U.mean(rts) : null,
        retestSe: known ? Math.sqrt(U.sum(cp.map(function (id) { var s = out.probes[id].retestSe; return s * s; }))) / cp.length : null,
      }, out.control);
    }
    out.near = near(rec, Date.parse(base[nb - 1].date), now);
    out.lines.push('Change is measured from the average of your starting checks. Familiarity with the tasks raises scores on its own (the retest gain), so it is counted before a change is called real.');
    if (out.composite) out.lines.push('Spatial probes combined: ' + out.composite.text);
    return out;
  }

  /* ---------- expectations (asked once at baseline, for the Lab) ---------- */

  function expect(rec, value, now) {
    if (!isObj(rec.spatial)) rec.spatial = { expect: null };
    if (rec.spatial.expect) return false;
    var v = Math.round(value);
    if (!(v >= 1 && v <= 5) || !isNum(now)) return false;
    rec.spatial.expect = { value: v, t: now };
    return true;
  }

  /* ---------- Lab crossover (small: assignment, phases, per-phase changes) ---------- */

  function labOf(rec) {
    if (!isObj(rec.lab)) rec.lab = { order: null, start: null, left: null };
    return rec.lab;
  }

  function enroll(rec, now) {
    var L = labOf(rec);
    if (L.order && !isNum(L.left)) return L;
    L.order = E.select.rng(rec, 'lab:' + now).chance(0.5) ? 'AB' : 'BA'; // random order
    L.start = now;
    L.left = null;
    return L;
  }
  function leave(rec, now) { var L = labOf(rec); if (L.order) L.left = now; return L; }

  function labChecks(rec) {
    var L = rec.lab, list = checks(rec), W = C.lab.weeks * 7 * DAY;
    if (!isObj(L) || !isNum(L.start)) return null;
    function near(t) {
      var best = null, bd = 7 * DAY + 1;
      list.forEach(function (c) { var d = Math.abs(Date.parse(c.date) - t); if (d < bd) { bd = d; best = c; } });
      return best;
    }
    var base = list.filter(function (c) { return Math.abs(Date.parse(c.date) - L.start) <= 7 * DAY; }).slice(0, 2);
    return { base: base, mid: near(L.start + W), end: near(L.start + 2 * W) };
  }

  function phase(rec, now) {
    var L = rec.lab;
    if (!isObj(L) || !L.order || !isNum(L.start)) return { enrolled: false };
    if (isNum(L.left)) return { enrolled: false, left: true, order: L.order };
    var W = C.lab.weeks, weeks = (now - L.start) / (7 * DAY);
    var ph = weeks < W ? 1 : weeks < 2 * W ? 2 : 'done';
    var name = ph === 1 ? L.order[0] : ph === 2 ? L.order[1] : null;
    var lc = labChecks(rec);
    return {
      enrolled: true, order: L.order, phase: ph, cluster: name ? C.lab[name].slice() : null, clusterName: name, weeks: weeks,
      checks: { base: lc.base.length, mid: !!lc.mid, end: !!lc.end },
    };
  }

  function allowed(rec, now) {
    var p = phase(rec, now);
    return p.enrolled && p.cluster ? p.cluster : null;
  }

  function diff(a, b, id) {
    var ra = a && a.results[id], rb = b && b.results[id];
    if (!ra || !rb || !isNum(ra.theta) || !isNum(rb.theta)) return null;
    return { change: rb.theta - ra.theta, se: Math.sqrt(ra.se * ra.se + rb.se * rb.se) };
  }

  // Per-phase probe changes: phase 1 = mid − baseline average, phase 2 = end − mid, and per
  // probe the contrast "change while training cluster A − change while training cluster B".
  function labChanges(rec) {
    var L = rec.lab, lc = labChecks(rec);
    if (!lc || !L.order) return null;
    var base = null;
    if (lc.base.length) {
      base = { results: {} };
      Object.keys(lc.base[0].results).forEach(function (id) {
        var rs = lc.base.map(function (c) { return c.results[id]; }).filter(function (r) { return r && isNum(r.theta); });
        if (!rs.length) return;
        base.results[id] = { theta: U.mean(rs.map(function (r) { return r.theta; })), se: Math.sqrt(U.sum(rs.map(function (r) { return r.se * r.se; }))) / rs.length };
      });
    }
    var out = { order: L.order, phases: [], contrast: {} };
    [[base, lc.mid, L.order[0]], [lc.mid, lc.end, L.order[1]]].forEach(function (x) {
      var probes = {};
      if (x[0] && x[1]) Object.keys(x[1].results).forEach(function (id) { var d = diff(x[0], x[1], id); if (d) probes[id] = d; });
      out.phases.push({ cluster: x[2], exercises: C.lab[x[2]].slice(), done: !!(x[0] && x[1]), probes: probes });
    });
    var pA = out.phases[L.order[0] === 'A' ? 0 : 1].probes, pB = out.phases[L.order[0] === 'A' ? 1 : 0].probes;
    Object.keys(pA).forEach(function (id) {
      if (pB[id]) out.contrast[id] = { aMinusB: pA[id].change - pB[id].change, se: Math.sqrt(pA[id].se * pA[id].se + pB[id].se * pB[id].se) };
    });
    return out;
  }

  E.lab = { enroll: enroll, leave: leave, phase: phase, allowed: allowed, changes: labChanges };

  E.field('spatial', function () { return { expect: null }; }, function (v) {
    if (!isObj(v)) return undefined;
    var x = v.expect;
    return { expect: isObj(x) && isNum(x.value) && x.value >= 1 && x.value <= 5 && E.fix.time(x.t) !== undefined ? { value: Math.round(x.value), t: x.t } : null };
  });
  E.field('lab', function () { return { order: null, start: null, left: null }; }, function (v) {
    if (!isObj(v)) return undefined;
    var ok = v.order === 'AB' || v.order === 'BA';
    return { order: ok ? v.order : null, start: ok && E.fix.time(v.start) !== undefined ? v.start : null, left: E.fix.time(v.left) !== undefined ? v.left : null };
  });
  void hasOwn;

  E.assess = {
    start: start, next: next, answer: answer, void: voidStep, finish: finish, due: due, nextCheck: nextCheck, report: report,
    form: form, checks: checks, composite: composite, needB3: needB3, expect: expect,
    _: { GRID: GRID, newPost: newPost, updatePost: updatePost, summary: summary, priorCenter: priorCenter },
  };
})(window.PX);
