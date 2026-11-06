/* PX.engine.stats: summaries for the session end, Progress and Log screens (PLAN §7).
   Comparisons are only with the user's own past, with an honest line about noise. Success is
   held near the target by design, so levels (not accuracy) show progress.

     summary(rec, plan, now)   end-of-session summary { trials, right, acc, per: [...], lines }
     compact(summary)          the small copy kept in rec.sessions[i].summary
     bests(rec, plan, now)     personal bests: the level shown after a whole block of 10 that reached
                               the level reference → [{ exId, level, previous, first }]
     bis(sessions, i)          balanced integration score of timed session i against the first 3
     curve(rec, def, opts)     learning curve: [{ day, level, lo, hi }] (one point per practice day)
     overview(rec, now, opts)  every training exercise: level, range, settings, stage, due…
     profile(rec, now, opts)   mean level by ability code and by Uttal cell (practised exercises)
     calendar(rec)             { dayKey: { sessions, trials, minutes } }
     totals(rec)               { sessions, trials, practiceMs, days } */
(function (PX) {
  'use strict';

  // Local references (globals are slow to look up inside Node's vm contexts used by the tests).
  var isArray = Array.isArray, isFin = isFinite, hasOwn = Object.prototype.hasOwnProperty;

  var U = PX.util;
  var E = PX.engine;
  var C = E.config;
  var M = E.model;

  function isNum(x) { return typeof x === 'number' && isFin(x); }
  function isObj(x) { return !!x && typeof x === 'object' && !isArray(x); }

  function noise(lv) { return Math.max(1, Math.round((lv.hi - lv.lo) / 2)); }

  function summary(rec, plan, now) {
    var per = [], n = 0, right = 0, rts = [], ids = plan.exs.slice();
    plan.log.forEach(function (x) { if (ids.indexOf(x.exId) < 0) ids.push(x.exId); });
    var rated = E.modes.RATED[plan.mode];
    ids.forEach(function (id) {
      var tl = plan.rated[id];
      if (!tl || !tl.n) return;
      var def = PX.ex.get(id);
      var row = { exId: id, n: tl.n, right: tl.right, acc: tl.right / tl.n, rtMed: tl.rt.length ? Math.round(U.median(tl.rt)) : null };
      var tg = plan.log.filter(function (x) { return x.exId === id && (x.oc === 0 || x.oc === 1) && isNum(x.target); });
      row.target = tg.length ? U.mean(tg.map(function (x) { return x.target; })) : null;
      if (rated && def) {
        // before: the level at the session start; after: the level now, from the same function
        // as the block-end notes, so they agree when no answer followed the last block end
        var before = plan.level0[id], after = E.modes._.levelNow(rec, def, plan);
        var ch = before ? after.exact - before.exact : 0;
        row.level = { before: before ? before.level : null, after: after.level, lo: after.lo, hi: after.hi, settings: after.settings };
        row.change = U.round(ch, 1);
        row.noise = noise(after);
        row.clear = !!before && Math.abs(ch) > row.noise;
      }
      per.push(row);
      n += tl.n; right += tl.right; rts = rts.concat(tl.rt);
    });
    var past = (isArray(rec.sessions) ? rec.sessions : []).filter(function (s) { return isObj(s) && s.mode === plan.mode && s.trials > 0; }).slice(-10);
    var out = {
      mode: plan.mode, trials: n, right: right, acc: n ? right / n : null, rtMed: rts.length ? Math.round(U.median(rts)) : null,
      minutes: U.round(plan.activeMs / 60000, 1), per: per,
      past: { sessions: past.length, accMedian: past.length ? U.median(past.map(function (s) { return s.right / s.trials; })) : null },
      lines: [],
    };
    if (rated) out.lines.push('Success is kept near your target on purpose, so your level shows progress, not the score.');
    per.forEach(function (r) {
      var def = PX.ex.get(r.exId), name = def ? def.short : r.exId;
      if (!r.level || r.level.before === null) return;
      out.lines.push(name + ': level ' + r.level.before + ' → ' + r.level.after + (r.clear ?
        ', a clear change (larger than the usual ±' + r.noise + ').' : ', within the usual session-to-session noise (±' + r.noise + ').'));
    });
    if (plan.mode === 'free') out.lines.push('Free play is logged; it does not change your levels.');
    return out;
  }

  function compact(s) {
    if (!s) return null;
    return {
      acc: s.acc === null ? null : U.round(s.acc, 3),
      ex: s.per.map(function (r) { return [r.exId, r.n, r.right, r.level ? r.level.before : null, r.level ? r.level.after : null]; }),
    };
  }

  // A personal best is the level shown at the end of a whole block of 10 rated answers whose
  // success reached the level reference g + (1 − g)·0.75: always a level the person has seen
  // after a block (modes keeps plan.blocks), so it can never contradict the level shown.
  function bests(rec, plan, now) {
    if (plan.mode !== 'train' && plan.mode !== 'path') return [];
    var out = [], blocks = isObj(plan.blocks) ? plan.blocks : {};
    Object.keys(blocks).forEach(function (id) {
      var def = PX.ex.get(id), best = null;
      if (!def) return;
      blocks[id].forEach(function (b) { if (b.reached && (!best || b.level > best.level)) best = { level: b.level, acc: b.right / 10 }; });
      if (!best) return;
      var e = E.est.exEntry(rec, id), prev = isObj(e.best.block) ? e.best.block : null;
      if (!prev || best.level > prev.level) {
        e.best.block = { level: best.level, acc: best.acc, n: 10, at: now, beats: prev ? (prev.beats || 0) + 1 : 0 };
        out.push({ exId: id, level: best.level, previous: prev ? prev.level : null, first: !prev });
      }
    });
    return out;
  }

  // sessions: [[day, pc, rtMean, n], ...]; z against the first three timed sessions, with floors
  // (SD of success ≥ 0.05, SD of time ≥ 10 % of its mean) so one or two sessions still work.
  function bis(sessions, i) {
    if (!isArray(sessions) || !sessions[i]) return null;
    var ref = sessions.slice(0, Math.min(3, sessions.length));
    var pcs = ref.map(function (s) { return s[1]; }).filter(isNum), rts = ref.map(function (s) { return s[2]; }).filter(isNum);
    var s = sessions[i];
    if (!pcs.length || !isNum(s[1])) return null;
    var z = (s[1] - U.mean(pcs)) / Math.max(U.sd(pcs), 0.05);
    if (isNum(s[2]) && rts.length) {
      var m = U.mean(rts);
      z -= (s[2] - m) / Math.max(U.sd(rts), 0.1 * m);
    }
    return U.round(z, 3);
  }

  function curve(rec, def, opts) {
    var st = E.est.slot(rec, def, opts);
    return (isArray(st.hist) ? st.hist : []).filter(function (r) { return isArray(r) && isNum(r[1]) && isNum(r[2]); }).map(function (r) {
      var lv = E.est.level(def, { mu: r[1], sd: r[2], n: 1 }, { settings: false });
      return { day: r[0], level: lv.level, lo: lv.lo, hi: lv.hi, exact: U.round(lv.exact, 2) };
    });
  }

  function overview(rec, now, opts) {
    return PX.ex.list('train').map(function (def) {
      var st = E.est.get(rec, def, opts, now), lv = E.est.level(def, st), tt = E.schedule.totals(rec, def);
      var ps = rec.path && rec.path[def.id], e = rec.ex && rec.ex[def.id];
      return {
        exId: def.id, code: def.code, name: def.name, short: def.short, abilities: def.abilities.slice(), cell: def.cell, practice: def.practice || null,
        n: tt.n, last: tt.last, level: lv.level, lo: lv.lo, hi: lv.hi, settings: lv.settings, sd: st.sd,
        stage: E.schedule.stage(rec, def.id), path: isObj(ps) && isNum(ps.stage) ? ps.stage : 1,
        due: E.schedule.due(rec, def, now), best: isObj(e) && isObj(e.best) && isObj(e.best.block) ? e.best.block : null,
        speed: E.speed.open(rec, def, opts),
      };
    });
  }

  function profile(rec, now, opts) {
    var ov = overview(rec, now, opts).filter(function (x) { return x.n > 0; });
    function agg(keyOf) {
      var acc = {};
      ov.forEach(function (x) {
        keyOf(x).forEach(function (k) {
          if (k === null || k === undefined) return;
          var w = k[1], a = acc[k[0]] || (acc[k[0]] = { w: 0, s: 0, exs: [] });
          a.w += w; a.s += w * x.level; a.exs.push(x.exId);
        });
      });
      var out = {};
      Object.keys(acc).forEach(function (k) { out[k] = { level: Math.round(acc[k].s / acc[k].w), exs: acc[k].exs }; });
      return out;
    }
    return {
      abilities: agg(function (x) { return x.abilities.map(function (a, i) { return [a, i === 0 ? 1 : 0.5]; }); }),
      cells: agg(function (x) { return x.cell ? [[x.cell, 1]] : []; }),
      note: 'Levels are per exercise; these groupings are a checklist of what you practise, not a score.',
    };
  }

  function calendar(rec) {
    var out = {};
    (isArray(rec.sessions) ? rec.sessions : []).forEach(function (s) {
      if (!isObj(s) || !isNum(s.start)) return;
      var d = E.day(s.start), c = out[d] || (out[d] = { sessions: 0, trials: 0, minutes: 0 });
      c.sessions += 1;
      c.trials += s.trials || 0;
      c.minutes = U.round(c.minutes + (s.practiceMs || 0) / 60000, 1);
    });
    return out;
  }

  function totals(rec) {
    var folded = 0;
    if (isObj(rec.trialDays)) Object.keys(rec.trialDays).forEach(function (d) { folded += rec.trialDays[d].n || 0; });
    return {
      sessions: isArray(rec.sessions) ? rec.sessions.length : 0,
      trials: (isArray(rec.trials) ? rec.trials.length : 0) + folded,
      practiceMs: isNum(rec.practiceMs) ? rec.practiceMs : 0,
      days: Object.keys(calendar(rec)).length,
    };
  }

  E.stats = { summary: summary, compact: compact, bests: bests, bis: bis, curve: curve, overview: overview, profile: profile, calendar: calendar, totals: totals };
})(window.PX);
