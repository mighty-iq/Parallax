/* The Chimera link in every share text and at every tutorial end (v1.2 milestone 2 acceptance;
   CLAUDE.md rule 1; docs/dev/CONTRACT-v1.2.md H): the invite component (fixed wording, the full
   address in a new tab, Copy link, one per screen, never over a stimulus), the one-tap card of later
   launches and when the full welcome is due, every share text (the share sheet's text, challenge
   codes, the Daily line), the nickname as the only name, and a scan of the sources: every Discord
   address in a string is the full https one (the card's drawn line excepted), and every tutorial end
   places the invite. welcome.js and share.js run here on a small fake DOM (chimera-dom.mjs). */
import fs from 'node:fs';
import path from 'node:path';
import { MANIFEST, SharedStorage } from './run.mjs';
import { installDom } from './chimera-dom.mjs';

const URL = 'https://discord.gg/chmr';
const LINE = 'Built by the Chimera community on Discord: ' + URL;
const CARD_LINE = 'Built by the Chimera community · discord.gg/chmr';
const UI = ['js/core/keys.js', 'js/core/svg.js', 'js/core/ui.js', 'js/ui/welcome.js', 'js/ui/share.js'];
const KINDS = ['tutorial', 'best', 'achievement', 'path', 'check', 'grade', 'plateau', 'export', 'backup', 'milestone'];
// The fixed wording: what the owner said about Chimera, and an invitation in. Nothing more.
const WORDING = /^(Parallax was built by the Chimera community on Discord\. Come and say hi\.|(Share your best|Share the stage you passed|Share your new grade|Share it|Compare notes|Compare strategies|To help pool data, share it) in the Chimera Discord, where Parallax was built\.)$/;

function env(t) {
  const e = t.env({ files: [...MANIFEST, ...UI], exercises: false, storage: new SharedStorage() });
  t.ok(!e.loadErrors.length, 'the UI files load: ' + e.loadErrors.join(' | '));
  installDom(e.document, e.window);
  e.window.crypto = { getRandomValues(a) { a[0] = 123456789; return a; } };
  return e;
}
const tick = () => new Promise((r) => setImmediate(r));

export async function run(t) {
  await testInvite(t);
  testCard(t);
  testShareTexts(t);
  testSources(t);
}

async function testInvite(t) {
  t.section('invite');
  const { PX, document } = env(t);
  const C = PX.ui.chimera;
  t.eq(C.URL, URL, 'the address');
  t.eq(C.LINE, LINE, 'the share line names the community and the full address');
  t.eq([...C.INVITE_KINDS].sort(), [...KINDS].sort(), 'the contract’s ten kinds');
  for (const kind of KINDS) {
    const el = C.invite(kind);
    t.ok(el && el.getAttribute('data-invite') === kind, kind + ': an invite');
    if (!el) continue;
    const text = el.querySelector('.px-invite-text').textContent;
    t.ok(WORDING.test(text), kind + ': the fixed wording, nothing more about Chimera: ' + text);
    t.eq(C.inviteText(kind), text, kind + ': inviteText');
    const a = el.querySelector('a[data-chimera="invite"]');
    t.ok(a && a.getAttribute('href') === URL && a.getAttribute('target') === '_blank' && /noopener/.test(a.getAttribute('rel')), kind + ': the link opens the full address in a new tab');
    t.ok(/opens in a new tab/.test(a.getAttribute('aria-label')), kind + ': the link says it opens a new tab');
    t.ok(el.querySelector('[data-invite-copy]') && el.querySelector('[data-invite-copy]').textContent === 'Copy link', kind + ': Copy link');
  }
  t.eq(C.invite('nope'), null, 'an unknown kind gives nothing');
  t.eq(C.inviteText('nope'), '', 'an unknown kind has no line');
  document.body.classList.add('px-stim');
  t.eq(C.invite('best'), null, 'nothing while a stimulus is on screen');
  document.body.classList.remove('px-stim');
  const host = PX.ui.h('div');
  host.appendChild(C.invite('best'));
  t.eq(C.invite('check', { host }), null, 'one invite per screen');
  t.ok(C.invite('check', { host: PX.ui.h('div') }) !== null, 'a screen without one gets one');
  // Copy link: the address itself (the async clipboard is absent here, so the fallback copies)
  const el = C.invite('export');
  document.body.appendChild(el);
  el.querySelector('[data-invite-copy]').click();
  await tick(); await tick();
  t.eq(el.querySelector('.px-invite-status').textContent, 'Copied ' + URL, 'Copy link copies the full address and says so');
  t.eq(C.inviteText('tutorial'), 'Parallax was built by the Chimera community on Discord. Come and say hi.', 'the tutorial end’s line');
}

function testCard(t) {
  t.section('first launch and later launches');
  const { PX, document } = env(t);
  const W = PX.ui.welcome, R = PX.core.store.state;
  t.eq(W.fullDue(), true, 'a new record gets the full welcome');
  R.ui.welcomed = Date.now();
  t.eq(W.fullDue(), false, 'once seen, later launches get the one-tap card');
  delete R.ui.welcomed;
  R.ui.tourOffered = Date.now();
  t.eq(W.fullDue(), false, 'a 1.1 record offered the tour has seen the full welcome');
  delete R.ui.tourOffered;
  R.sessions.push({ id: 1 });
  t.eq(W.fullDue(), false, 'a record that has practised has seen it');
  R.sessions.length = 0;
  t.eq(W.fullDue(), true, 'back to a fresh record');

  const keyHandlers = [];
  const addEv = document.addEventListener, rmEv = document.removeEventListener;
  document.addEventListener = (type, fn) => { if (type === 'keydown') keyHandlers.push(fn); else addEv(type, fn); };
  document.removeEventListener = (type, fn) => { const i = keyHandlers.indexOf(fn); if (i >= 0) keyHandlers.splice(i, 1); else rmEv(type, fn); };
  const closed = [];
  let card = W.card({ onClose: (why) => closed.push(why) });
  document.body.appendChild(card);
  t.ok(card.hasAttribute('data-chimera-card') && W.cardShown(), 'the card is shown');
  t.eq(card.querySelector('.px-chimera-card-text').textContent, 'Parallax was built by the Chimera community on Discord.', 'the card says who built Parallax');
  const join = card.querySelector('a[data-chimera="card"]');
  t.ok(join && join.getAttribute('href') === URL && join.getAttribute('target') === '_blank', 'Join opens the full address in a new tab');
  t.ok(!card.closest('.px-modal') && !card.hasAttribute('aria-modal'), 'not a modal: it traps nothing');
  t.eq(W.card(), card, 'one card at a time');
  card.querySelector('[data-chimera-card-close]').click();
  t.ok(!W.cardShown() && closed[0] === 'close' && !card.parentNode, 'one tap on ✕ ends it');
  t.eq(keyHandlers.length, 0, 'its key handler goes with it');
  card = W.card({ onClose: (why) => closed.push(why) });
  document.body.appendChild(card);
  keyHandlers.forEach((fn) => fn({ key: 'Escape', target: document.body }));
  t.ok(!W.cardShown() && closed[1] === 'esc', 'Esc ends it');
  card = W.card({ onClose: (why) => closed.push(why) });
  document.body.appendChild(card);
  t.ok(W.closeCard('session') && closed[2] === 'session' && !W.cardShown(), 'the start of a session ends it');
  t.eq(W.closeCard('session'), false, 'closing twice does nothing');
  document.addEventListener = addEv; document.removeEventListener = rmEv;
}

function testShareTexts(t) {
  t.section('share texts');
  const { PX } = env(t);
  const S = PX.ui.share, R = PX.core.store.state;
  t.eq(S.CHIMERA_LINE, LINE, 'the share sheet’s line is the full one');
  t.eq(S.CARD_LINE, CARD_LINE, 'the drawn card keeps its short line (a picture, beside the footer)');
  const plain = S.text({ title: 'Session', lines: ['12 answered'] }).split('\n');
  t.eq(plain[plain.length - 1], LINE, 'a card’s text ends with the full line');
  const old = S.text({ text: 'Parallax · Session\n10 of 12 right\n' + CARD_LINE }).split('\n');
  t.eq(old[old.length - 1], LINE, 'a short-form line is upgraded to the full one');
  t.eq(old.filter((l) => /Chimera/.test(l)).length, 1, 'and never doubled');
  const daily = S.text({ text: 'Parallax Daily #12 · 6/8 · discord.gg/chmr' });
  t.ok(daily.includes(URL), 'a one-line share gets the full address');
  const full = 'Already has it: ' + URL;
  t.eq(S.text({ text: full }), full, 'a text with the full address stays as it is');
  // the nickname: the only name, and only when typed
  t.eq(S.nickname(), '', 'no nickname by default');
  t.ok(!/Played by/.test(S.text({ title: 'X' })), 'no name in a text without a nickname');
  R.settings.nickname = '  Kestrel  ';
  t.eq(S.nickname(), 'Kestrel', 'the nickname, trimmed');
  const nick = S.text({ title: 'X', lines: ['a'] }).split('\n');
  t.eq(nick.slice(-2), ['Played by Kestrel', LINE], 'the nickname goes in before the Chimera line');
  t.ok(!/Played by/.test(S.text({ title: 'X', nickname: false })), 'nickname false leaves it out');
  R.settings.nickname = '';
  // challenge codes
  PX.ex.define({
    id: 'rotate', code: 'EX-02', name: 'Rotate', short: 'Rotate', abilities: ['Vz'], cell: null, role: 'train', answer: 'choice', nOptions: 2, base: -2,
    dims: [{ key: 'a', label: 'A', levels: [0, 1], step: 0.5 }],
    chance() { return 0.5; }, generate(rng, params) { return { ex: 'rotate', seed: rng.seed, params, key: 0 }; }, validate() { return true; }, score(i, r) { return { correct: r === i.key }; },
  });
  const ch = S.challenge.create({ exId: 'rotate', params: { a: 1 }, n: 8 });
  const ct = S.challenge.text(ch);
  t.ok(ct.includes(ch.code) && ct.endsWith(LINE), 'a challenge text carries its code and the full line');
  // the Daily's own share line (js/engine/daily.js, config.daily.link)
  const E = PX.engine;
  t.ok(E && E.daily && /https:\/\/discord\.gg\/chmr/.test(E.daily.share(12, 6, 8)), 'the Daily share line carries the full address: ' + (E && E.daily ? E.daily.share(12, 6, 8) : 'no daily'));
}

// String literals of a source, comments left out (block comments; line comments that start after
// a space or at a line start, so 'https://…' inside a string stays).
function literals(src) {
  const code = src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|\s)\/\/.*$/gm, '$1');
  return code.match(/'(?:[^'\\\n]|\\.)*'|"(?:[^"\\\n]|\\.)*"|`(?:[^`\\]|\\.)*`/g) || [];
}
function jsFiles(root, dir) {
  const out = [];
  for (const d of fs.readdirSync(path.join(root, dir), { withFileTypes: true })) {
    const rel = dir + '/' + d.name;
    if (d.isDirectory()) out.push(...jsFiles(root, rel));
    else if (d.name.endsWith('.js')) out.push(rel);
  }
  return out;
}

function testSources(t) {
  t.section('sources');
  const bad = [];
  for (const rel of jsFiles(t.root, 'js')) {
    for (const lit of literals(fs.readFileSync(path.join(t.root, rel), 'utf8'))) {
      if (!/discord\.gg\/chmr/.test(lit)) continue;
      if (rel === 'js/ui/share.js' && lit.slice(1, -1) === CARD_LINE) continue; // drawn on the card
      if (!/https:\/\/discord\.gg\/chmr/.test(lit)) bad.push(rel + ': ' + lit);
    }
  }
  t.eq(bad, [], 'every Discord address in a string is the full https one (texts get copied into apps that link only full URLs)');
  const src = (rel) => fs.readFileSync(path.join(t.root, rel), 'utf8');
  t.ok(/chimera\.invite\('tutorial'/.test(src('js/ui/tour.js')), 'the tour’s end screen places the tutorial invite');
  t.ok(/invite\('tutorial'/.test(src('js/ui/play.js')), 'a standalone Watch, Try, Go ends with the tutorial invite (js/ui/play.js)');
  t.ok(/invite\('check'/.test(src('js/ui/check.js')), 'the Spatial Check result carries the check invite');
  t.ok(/chimera\.invite\(o\.invite \|\| 'export'/.test(src('js/ui/app.js')) && /invite: 'backup'/.test(src('js/ui/app.js')), 'export and backup dialogs carry the invite');
}
