// ================= UI shell: boot, tabs, chat, scoreboard, game host =================
const CATS = [['all', 'All'], ['fight', 'Fights'], ['duel', 'Score duels'], ['classic', 'Classics'], ['word', 'Words & drawing']];
const CAT_LABEL = { fight: 'Fight', duel: 'Score duel', classic: 'Classic', word: 'Words' };
const STAKES = ['Loser buys coffee ☕', 'Loser sings a song 🎤', 'Winner picks the movie 🎬', 'Loser sends a voice note 🎧', 'Loser plans the next date 🌹', 'Loser owes a long hug 🤗'];
const EMOJIS = ['🌙', '⭐', '🌸', '🦋', '🐻', '🐱', '🦊', '🐼', '🍓', '🍒', '🌻', '🔥', '👑', '😎', '🦄', '🐯', '🍩', '🎀'];
const REACTS = ['❤️', '😂', '😮', '😢', '🔥', '👍'];

function gdef(type) { return GAMES[type] || { name: type, icon: '🎲', tint: '#7a5b8f', cat: 'classic' }; }
function needs(g, seat = me()) { if (!g || g.status !== 'active') return false; const d = GAMES[g.type]; return d && d.needs ? d.needs(g, seat) : g.turn === seat; }
function statusLine(g, seat = me()) {
  const d = GAMES[g.type];
  if (g.status === 'done') { if (g.winner === 'tie') return 'Tie'; return (g.winner === seat ? 'You won' : nm(g.winner) + ' won') + (g.resigned ? ' (resigned)' : ''); }
  if (d && d.line) { const l = d.line(g, seat); if (l) return l; }
  return needs(g, seat) ? 'Your move' : 'Waiting for ' + nm(other(seat));
}
const iconEl = (def, cls = 'gicon') => h('div', { class: cls, style: `background:${def.tint}22;box-shadow:inset 0 0 0 1.5px ${def.tint}55` }, def.icon);
const avatar = (seat, extra = '') => h('div', { class: 'av ' + seat + ' ' + extra }, em(seat));

// ---------- boot ----------
async function boot() {
  renderAll();
  if (window.FIREBASE_CONFIG && window.FIREBASE_CONFIG.apiKey && window.FB) return bootFirebase();
  const slowT = setTimeout(() => { S.slow = true; renderAll(); }, 10000);
  let db = null;
  try { db = window.claude && window.claude.use ? await window.claude.use('db') : null; } catch { db = null; }
  if (db) { S.mode = 'live'; S.db = db; }
  else { S.mode = 'local'; S.db = localDB(); }
  try { S.user = window.claude && window.claude.use ? await window.claude.use('user') : null; S.uid = S.user ? await S.user.id() : null; } catch {}
  startData(slowT);
  let room = null; try { room = window.claude && window.claude.use ? await window.claude.use('room') : null; } catch {}
  initRoom(room);
}
// ---------- standalone app: sign-in, pairing, then the same data listeners ----------
function bootFirebase() {
  S.mode = 'fb'; S.fbStage = 'loading';
  try { FB.init(window.FIREBASE_CONFIG); } catch (e) { console.error(e); S.fbStage = 'error'; renderAll(); return; }
  S.joinCode = FB.normCode(new URLSearchParams(location.search).get('join') || '');
  FB.onAuth(async user => {
    if (!user) { if (S.pid) { location.reload(); return; } S.fbStage = 'auth'; renderAll(); return; }
    S.uid = user.uid; S.email = user.email || ''; S.fbStage = 'loading'; renderAll();
    try { const prof = await FB.profile(user.uid); if (prof && prof.pid) enterPair(prof.pid); else { S.fbStage = 'pair'; renderAll(); } }
    catch (e) { console.error(e); S.fbStage = 'error'; renderAll(); }
  });
}
function enterPair(pid) {
  if (S.pid) return; S.pid = pid; S.db = FB.db(pid); S.fbStage = 'ready'; renderAll();
  startData(setTimeout(() => { S.slow = true; renderAll(); }, 10000));
  initRoom(FB.room(pid, S.uid));
  FB.pairInfo(pid).then(i => { S.inviteCode = (i && i.code) || ''; if (!Host.id) renderMain(); }).catch(() => {});
  if (S.joinCode) { try { history.replaceState(null, '', location.pathname); } catch {} }
}
function startData(slowT) {
  S.db.doc('app/couple').onSnapshot(s => {
    clearTimeout(slowT); S.slow = false;
    S.couple = s.exists ? s.data() : null; S.coupleLoaded = true; resolveSeat(); renderAll();
  }, e => { S.coupleLoaded = true; console.warn(e); renderAll(); });
  S.db.collection('games').orderBy('updatedAt', 'desc').limit(600).onSnapshot(snap => {
    const prev = S.gameMap; S.games = snap.docs.map(d => ({ ...d.data(), id: d.id })); S.gameMap = Object.fromEntries(S.games.map(g => [g.id, g])); S.gamesLoaded = true;
    // gentle alert when it becomes my move in a game I'm not looking at
    for (const g of S.games) { const p = prev[g.id]; if (p && S.seat && !needs(p) && needs(g) && Host.id !== g.id && g.lastBy !== S.seat) { toast(`Your move in ${gdef(g.type).name}`); sfx('pop'); } }
    Host.refresh(); if (!Host.id) renderMain(); renderTop();
  }, e => console.warn(e));
  S.db.collection('chat').where('day', '>=', dayKey(-30)).onSnapshot(snap => {
    const before = S.chatLoaded ? allMsgs().msgs.length : -1;
    const docs = {}; snap.docs.forEach(d => docs[d.id] = d.data());
    // keep optimistic copies of my own docs if they are newer
    for (const id in S.chatDocs) if (S.chatDocs[id].seat === S.seat && docs[id] && (S.chatDocs[id].msgs || []).length > (docs[id].msgs || []).length) docs[id] = S.chatDocs[id];
    S.chatDocs = docs; S.chatLoaded = true;
    const all = allMsgs().msgs; const last = all[all.length - 1];
    if (before >= 0 && all.length > before && last && last.seat !== S.seat) {
      if (last.k === 'nudge') { sfx('buzz'); document.body.classList.add('buzz'); setTimeout(() => document.body.classList.remove('buzz'), 1000); if (S.tab !== 'chat' || Host.id) toast(`${nm(last.seat)} poked you 👉`); }
      else if (last.k === 't') { sfx('msg'); if (S.tab !== 'chat' || Host.id) toast(`${nm(last.seat)}: ${(last.t || '').slice(0, 40)}`); }
      else if (last.k === 'inv' && last.gt && Host.id !== last.g) { sfx('pop'); toast(`${nm(last.seat)} challenged you to ${gdef(last.gt).name}`); }
    }
    if (S.tab === 'chat' && !Host.id) { markRead(); renderChatList(); } else renderTabs();
  }, e => console.warn(e));
}
async function initRoom(room) {
  try {
    if (!room) return;
    S.room = room;
    const where = () => Host.id ? 'game:' + gdef(S.gameMap[Host.id]?.type).name : S.tab;
    S.pushPresence = () => { if (S.seat) room.presence({ seat: S.seat, where: where() }).catch(() => {}); };
    S.pushPresence();
    room.onPeers(ch => {
      const peer = ch.peers.find(p => !p.isMe && p.presence && p.presence.seat === op());
      const was = S.online; S.online = !!peer; S.partnerWhere = peer ? String(peer.presence.where || '') : '';
      if (S.online && !was) toast(`${nm(op())} is here`);
      renderTop();
    }, () => {});
    room.on('typing', m => { if (!m.isMe && m.data && m.data.seat === op()) { S.partnerTyping = Date.now(); renderTyping(); setTimeout(renderTyping, 3200); } }, () => {});
  } catch {}
}
function resolveSeat() {
  if (!S.couple) { S.seat = null; return; }
  if (S.mode === 'fb') { const was = S.seat; S.seat = ['p1', 'p2'].find(p => S.couple[p] && S.couple[p].uid === S.uid) || null; if (S.seat && !was) setTimeout(() => S.pushPresence && S.pushPresence(), 0); return; }
  const ls = lsGet('at-seat');
  if (ls === 'p1' || ls === 'p2') { S.seat = ls; return; }
  if (S.uid) for (const p of ['p1', 'p2']) if (S.couple[p] && S.couple[p].uid === S.uid) { S.seat = p; lsSet('at-seat', p); return; }
  S.seat = null;
}
async function takeSeat(p) {
  S.seat = p; lsSet('at-seat', p); chatEls = null;
  if (S.uid && S.couple && !(S.couple[p] && S.couple[p].uid)) dbPatch('app/couple', { [p]: { uid: S.uid } }).catch(() => {});
  S.pushPresence && S.pushPresence(); renderAll();
}

// ---------- shell ----------
function renderAll() {
  let app = $('.app');
  if (!app) { app = h('div', { class: 'app' }, h('header', { class: 'top' }), h('main', { id: 'main' }), h('nav', { class: 'tabs', 'aria-label': 'Sections' })); document.body.prepend(app); }
  renderTop(); renderTabs(); renderMain();
}
function renderTop() {
  const top = $('.top'); if (!top) return;
  const ready = S.couple && S.seat;
  top.replaceChildren(h('div', { class: 'wrap' },
    h('div', { class: 'brand' }, 'Poke My ', h('span', null, 'Darling')),
    ready ? h('div', { class: 'pair', title: S.online ? `${nm(op())} is online${S.partnerWhere ? ' · ' + S.partnerWhere : ''}` : `${nm(op())} is away` },
      h('div', { class: 'av ' + me() }, em(me())), h('div', { class: 'heartline' }),
      h('div', { class: 'av ' + op() }, em(op()), h('span', { class: 'dot' + (S.online ? ' on' : '') }))) : null));
}
const ICONS = {
  play: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="6" width="20" height="12" rx="6"/><path d="M7 10v4M5 12h4"/><circle cx="16" cy="11" r=".6" fill="currentColor"/><circle cx="18" cy="13" r=".6" fill="currentColor"/></svg>',
  chat: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12a8 8 0 0 1-11.6 7.1L4 20l1.1-4.6A8 8 0 1 1 21 12z"/></svg>',
  us: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z"/></svg>',
  send: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14M13 6l6 6-6 6"/></svg>',
  back: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M15 5l-7 7 7 7"/></svg>',
};
function renderTabs() {
  const nav = $('.tabs'); if (!nav) return;
  const ready = S.couple && S.seat;
  nav.hidden = !ready;
  if (!ready) return;
  const mine = S.games.filter(g => needs(g)).length; const un = unreadCount();
  const tab = (id, label, n) => h('button', { class: 'tab', 'aria-current': S.tab === id ? 'true' : 'false', onclick: () => { S.tab = id; lsSet('at-tab', id); S.pushPresence && S.pushPresence(); renderAll(); } }, h('span', { html: ICONS[id] }), label, n ? h('span', { class: 'badge' }, n) : null);
  nav.replaceChildren(h('div', { class: 'wrap' }, tab('play', 'Play', mine), tab('chat', 'Chat', un), tab('us', 'Us')));
}
function renderMain() {
  const main = $('#main'); if (!main) return;
  if (S.tab === 'chat' && S.couple && S.seat && chatEls && chatEls.list.isConnected) { renderChatList(); return; }
  main.style.overflowY = '';
  if (S.mode === 'fb' && S.fbStage !== 'ready') {
    if (S.fbStage === 'auth') { if (!main.querySelector('#auth-email')) main.replaceChildren(renderAuth()); }
    else if (S.fbStage === 'pair') { if (!main.querySelector('#pair-name')) main.replaceChildren(renderPair()); }
    else main.replaceChildren(h('div', { class: 'wrap' }, h('div', { class: 'empty', style: 'margin-top:40px' }, S.fbStage === 'error' ? 'Couldn’t connect. Check your internet and reopen the app.' : 'Opening your game room…')));
    return;
  }
  if (S.mode === 'fb' && S.coupleLoaded && (!S.couple || !S.seat)) {
    main.replaceChildren(h('div', { class: 'wrap setup' }, h('div', { class: 'empty' }, !S.couple ? 'Setting up your room…' : 'This account isn’t part of this room.'), S.couple ? h('button', { class: 'btn ghost', onclick: () => FB.signOut().then(() => location.reload()) }, 'Sign out') : null)); return;
  }
  if (S.mode === 'loading' || !S.coupleLoaded) { main.replaceChildren(h('div', { class: 'wrap' }, h('div', { class: 'empty', style: 'margin-top:40px' }, S.slow ? 'Can’t reach your saved games yet. Check your connection; this page keeps trying.' : 'Opening your game room…'))); return; }
  if (!S.couple) { main.replaceChildren(renderSetup()); return; }
  if (!S.seat) { main.replaceChildren(renderSeatPick()); return; }
  if (S.tab === 'chat') { renderChat(main); return; }
  const scroll = main.scrollTop;
  main.replaceChildren(S.tab === 'us' ? renderUs() : renderPlay());
  main.scrollTop = scroll;
}

// ---------- sign-in and pairing (standalone app) ----------
const AUTH_ERR = { 'auth/invalid-credential': 'Wrong email or password.', 'auth/wrong-password': 'Wrong email or password.', 'auth/user-not-found': 'No account with that email. Tap Create account.', 'auth/email-already-in-use': 'That email already has an account. Tap Sign in.', 'auth/weak-password': 'Use at least 6 characters for the password.', 'auth/invalid-email': 'That email doesn’t look right.', 'auth/popup-blocked': 'The Google window was blocked. Use email and password here.', 'auth/popup-closed-by-user': 'Google sign-in was closed before finishing.', 'auth/network-request-failed': 'No connection. Try again.', 'auth/unauthorized-domain': 'This web address isn’t allowed in Firebase yet (Authentication → Settings → Authorized domains).', 'auth/operation-not-allowed': 'This sign-in method isn’t enabled in Firebase yet.', 'auth/too-many-requests': 'Too many tries. Wait a minute and try again.' };
const authMsg = e => AUTH_ERR[e && e.code] || 'Sign-in didn’t work. Try again.';
function renderAuth() {
  const iosApp = navigator.standalone === true || (/iP(hone|ad|od)/.test(navigator.userAgent) && matchMedia('(display-mode: standalone)').matches);
  const email = h('input', { class: 'inp', id: 'auth-email', type: 'email', autocomplete: 'email', placeholder: 'you@example.com' });
  const pw = h('input', { class: 'inp', id: 'auth-pw', type: 'password', autocomplete: 'current-password', placeholder: 'At least 6 characters' });
  const run = async (btn, fn) => { btn.disabled = true; try { await fn(); } catch (e) { console.warn(e); toast(authMsg(e), 4000); } btn.disabled = false; };
  const need = () => { if (!email.value.trim() || !pw.value) { toast('Enter your email and a password'); return false; } return true; };
  return h('div', { class: 'wrap setup' },
    heroSvg('🌙', '🌸', 'Two windows, one game room', 'Sign in to open yours'),
    h('div', { class: 'card' },
      iosApp ? null : h('button', { class: 'btn gold wide', onclick: e => run(e.currentTarget, () => FB.signInGoogle()) }, 'Continue with Google'),
      iosApp ? null : h('p', { class: 'faint', style: 'text-align:center;font-weight:800;font-size:12px;letter-spacing:.6px' }, 'OR USE EMAIL'),
      h('form', { style: 'display:flex;flex-direction:column;gap:12px', onsubmit: e => { e.preventDefault(); if (need()) run(e.submitter || e.target.querySelector('button'), () => FB.signInEmail(email.value.trim(), pw.value)); } },
        h('div', { class: 'field' }, h('label', { for: 'auth-email' }, 'Email'), email),
        h('div', { class: 'field' }, h('label', { for: 'auth-pw' }, 'Password'), pw),
        h('div', { class: 'row' }, h('button', { class: 'btn', type: 'submit', style: 'flex:1' }, 'Sign in'),
          h('button', { class: 'btn ghost', type: 'button', style: 'flex:1', onclick: e => { if (need()) run(e.currentTarget, () => FB.signUpEmail(email.value.trim(), pw.value)); } }, 'Create account'))),
      h('button', { class: 'link', style: 'align-self:center;font-size:13px', onclick: async () => { if (!email.value.trim()) return toast('Type your email first'); try { await FB.resetPassword(email.value.trim()); toast('Password reset email sent'); } catch (e) { toast(authMsg(e)); } } }, 'Forgot password?')),
    h('p', { class: 'note' }, 'Your games and chat are private to you and the one person you pair with.'));
}
const PAIR_ERR = { 'bad-code': 'That code doesn’t match a room. Check it and try again.', 'own-code': 'That’s your own code. Send it to your person; they enter it on their phone.', 'code-used': 'That code was already used by someone else.' };
function renderPair() {
  let emoji = '🌙'; const row = h('div', { class: 'emojis' });
  const draw = () => row.replaceChildren(...EMOJIS.map(e => h('button', { 'aria-pressed': emoji === e ? 'true' : 'false', onclick: () => { emoji = e; draw(); } }, e))); draw();
  const name = h('input', { class: 'inp', id: 'pair-name', placeholder: 'e.g. Buddu', maxlength: 20 });
  const code = h('input', { class: 'inp mono', id: 'pair-code', placeholder: 'ABCD2345', maxlength: 12, autocapitalize: 'characters', autocomplete: 'off', value: S.joinCode || '', style: 'text-transform:uppercase;letter-spacing:3px;text-align:center;font-size:18px' });
  const who = () => { const n = name.value.trim(); if (!n) { toast('Add your name first'); name.focus(); return null; } return { name: n, emoji }; };
  const run = async (btn, fn) => { const m = who(); if (!m) return; btn.disabled = true; try { const r = await fn(m); if (r.code) S.inviteCode = r.code; enterPair(r.pid); } catch (e) { console.warn(e); toast(PAIR_ERR[e && e.code] || 'That didn’t work. Check your connection and try again.', 4000); btn.disabled = false; } };
  return h('div', { class: 'wrap setup' },
    h('div', { class: 'h-sec' }, h('h2', null, 'Set up your room')),
    h('div', { class: 'card' }, h('div', { class: 'field' }, h('label', { for: 'pair-name' }, 'Your name'), name), row),
    h('div', { class: 'card' }, h('div', { class: 'h-sec' }, h('h2', null, 'Got an invite code?')),
      h('div', { class: 'field' }, h('label', { for: 'pair-code' }, 'Code from your person'), code),
      h('button', { class: 'btn wide', onclick: e => run(e.currentTarget, m => FB.joinPair(code.value, m)) }, 'Join their room')),
    h('div', { class: 'card' }, h('div', { class: 'h-sec' }, h('h2', null, 'Or start a new room')),
      h('p', { class: 'muted' }, 'You’ll get a code to send to your person.'),
      h('button', { class: 'btn gold wide', onclick: e => run(e.currentTarget, m => FB.createPair(m)) }, 'Create our room')),
    h('button', { class: 'link', style: 'align-self:center;font-size:13px', onclick: () => FB.signOut() }, `Signed in as ${S.email || 'you'} · Sign out`));
}
async function copyText(t, okMsg) { try { await navigator.clipboard.writeText(t); toast(okMsg); } catch { toast(t, 6000); } }
function inviteCard() {
  if (S.mode !== 'fb' || !S.couple || S.couple.p2 || !S.inviteCode) return null;
  const link = location.origin + location.pathname + '?join=' + S.inviteCode;
  return h('div', { class: 'card', style: 'border-color:rgba(246,197,108,.45)' }, h('div', { class: 'h-sec' }, h('h2', null, 'Invite your person')),
    h('p', { class: 'muted' }, 'Send this code. They open the app, sign in and enter it. It works once.'),
    h('div', { class: 'mono', style: 'font-size:30px;letter-spacing:5px;text-align:center;color:var(--lamp);user-select:all;-webkit-user-select:all' }, S.inviteCode),
    h('div', { class: 'row' }, h('button', { class: 'btn small', style: 'flex:1', onclick: () => copyText(S.inviteCode, 'Code copied') }, 'Copy code'), h('button', { class: 'btn small ghost', style: 'flex:1', onclick: () => copyText(link, 'Invite link copied') }, 'Copy invite link')));
}

// ---------- first run ----------
function renderSetup() {
  const pick = { a: '🌙', b: '🌸' };
  const emojiRow = key => { const row = h('div', { class: 'emojis' }); const draw = () => row.replaceChildren(...EMOJIS.map(e => h('button', { 'aria-pressed': pick[key] === e ? 'true' : 'false', onclick: () => { pick[key] = e; draw(); } }, e))); draw(); return row; };
  const a = h('input', { class: 'inp', id: 'setup-a', placeholder: 'e.g. Buddu', maxlength: 20 });
  const b = h('input', { class: 'inp', id: 'setup-b', placeholder: 'Their name', maxlength: 20 });
  const go = h('button', { class: 'btn wide', onclick: async () => {
    const na = a.value.trim(), nb = b.value.trim(); if (!na || !nb) { toast('Add both names first'); return; }
    go.disabled = true;
    const body = { p1: { name: na, emoji: pick.a, uid: S.uid || null }, p2: { name: nb, emoji: pick.b, uid: null }, createdAt: Date.now() };
    try { await dbSet('app/couple', body); S.couple = body; takeSeat('p1'); postEvent('opened Poke My Darling'); } catch { go.disabled = false; }
  } }, 'Light up the room');
  return h('div', { class: 'wrap setup' },
    heroSvg('🌙', '🌸', 'Two windows, one game room'),
    h('div', { class: 'card' },
      h('div', { class: 'field' }, h('label', { for: 'setup-a' }, 'Your name'), a), emojiRow('a'),
      h('div', { class: 'field' }, h('label', { for: 'setup-b' }, 'Your person'), b), emojiRow('b'),
      go),
    S.mode === 'local' ? h('p', { class: 'note' }, 'Preview mode: this copy saves on this device only. Open the published link to play together.') : null);
}
function renderSeatPick() {
  return h('div', { class: 'wrap setup' },
    h('div', { class: 'h-sec' }, h('h2', null, 'Who’s on this phone?')),
    h('div', { class: 'seatpick' }, ['p1', 'p2'].map(p => h('button', { onclick: () => takeSeat(p) }, h('div', { class: 'av lg ' + p }, em(p)), nm(p)))),
    h('p', { class: 'muted' }, 'Pick once on each phone. You can switch later in Us → Settings.'));
}

// ---------- hero skyline ----------
function heroSvg(e1, e2, title, sub) {
  const stars = Array.from({ length: 26 }, (_, i) => { const r = rng('st' + i); return `<circle cx="${(r() * 400).toFixed(0)}" cy="${(r() * 90).toFixed(0)}" r="${(r() * 1.1 + .3).toFixed(1)}" fill="#ffe4a8" opacity="${(r() * .5 + .2).toFixed(2)}"/>`; }).join('');
  // string of lights between the two windows (a sagging curve)
  const x1 = 92, y1 = 112, x2 = 318, y2 = 104; let bulbs = '';
  for (let i = 1; i < 18; i++) { const t = i / 18; const x = x1 + (x2 - x1) * t; const y = y1 + (y2 - y1) * t + Math.sin(Math.PI * t) * 34; bulbs += `<circle class="bulb" cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="2.6" fill="${i % 2 ? '#ffd3de' : '#f6c56c'}" style="animation-delay:${(i * .17).toFixed(2)}s"/>`; }
  const win = (x, y, e, c) => `<rect x="${x - 17}" y="${y - 17}" width="34" height="34" rx="5" fill="${c}" opacity=".95"/><rect x="${x - 26}" y="${y - 26}" width="52" height="52" rx="10" fill="${c}" opacity=".18"/><text x="${x}" y="${y + 7}" font-size="20" text-anchor="middle">${e}</text>`;
  const svg = `<svg viewBox="0 0 400 190" role="img" aria-label="Two lit windows across a night city, joined by a string of lights">
  <defs><linearGradient id="sky" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stop-color="#24173a"/><stop offset="1" stop-color="#3a2350"/></linearGradient></defs>
  <rect width="400" height="190" fill="url(#sky)"/>${stars}
  <circle cx="352" cy="38" r="15" fill="#ffe4a8" opacity=".9"/><circle cx="346" cy="33" r="14" fill="#2b1c41"/>
  <path d="M0 150 L0 120 L22 120 L22 108 L40 108 L40 128 L55 128 L55 96 L70 96 L70 80 L118 80 L118 136 L140 136 L140 118 L160 118 L160 140 L190 140 L190 126 L210 126 L210 146 L240 146 L240 122 L262 122 L262 132 L285 132 L285 74 L345 74 L345 112 L362 112 L362 100 L384 100 L384 130 L400 130 L400 190 L0 190Z" fill="#150d20"/>
  <path d="M0 190 L0 160 L30 160 L30 150 L80 150 L80 165 L130 165 L130 155 L170 155 L170 170 L230 170 L230 158 L280 158 L280 166 L330 166 L330 152 L370 152 L370 162 L400 162 L400 190Z" fill="#0f0918"/>
  ${[[78, 92], [102, 92], [78, 120], [300, 88], [330, 120], [300, 120], [62, 104], [151, 128], [251, 134], [372, 116]].map(([x, y]) => `<rect x="${x - 4}" y="${y - 5}" width="7" height="9" rx="1" fill="#f6c56c" opacity=".22"/>`).join('')}
  ${bulbs}
  ${win(92, 104, e1, '#ff8fab')}${win(318, 96, e2, '#f6c56c')}
  </svg>`;
  return h('div', { class: 'hero', html: svg }, h('div', { class: 'say' }, h('h1', null, title), sub ? h('p', null, sub) : null));
}

// ---------- Play tab ----------
function gameRow(g) {
  const d = gdef(g.type); const mine = needs(g);
  let pill;
  if (g.status === 'done') pill = g.winner === 'tie' ? h('span', { class: 'pill tie' }, 'Tie') : g.winner === me() ? h('span', { class: 'pill won' }, 'Won') : h('span', { class: 'pill lost' }, 'Lost');
  else pill = mine ? h('span', { class: 'pill go' }, 'Play') : h('span', { class: 'pill wait' }, 'Waiting');
  return h('button', { class: 'grow' + (mine ? ' mine' : ''), onclick: () => openGame(g.id) }, iconEl(d),
    h('div', { class: 't' }, h('b', null, d.name), h('span', null, statusLine(g) + (g.stake ? ' · ' + g.stake : ''), ' · ', ago(g.updatedAt))), pill);
}
function renderPlay() {
  const active = S.games.filter(g => g.status === 'active');
  const mine = active.filter(g => needs(g)); const theirs = active.filter(g => !needs(g));
  const done = S.games.filter(g => g.status === 'done').slice(0, 4);
  const title = mine.length ? `Your move, ${nm(me())}` : `Pick a game, ${nm(me())}`;
  const sub = mine.length ? `${mine.length} game${mine.length > 1 ? 's' : ''} waiting on you` : theirs.length ? `${theirs.length} waiting on ${nm(op())}` : `Challenge ${nm(op())} to something below`;
  const lib = Object.values(GAMES).filter(d => S.cat === 'all' || d.cat === S.cat);
  return h('div', { class: 'wrap' },
    heroSvg(em(me()), em(op()), title, sub),
    inviteCard(),
    S.mode === 'local' ? h('p', { class: 'note' }, 'Preview mode: games save on this device only. Use Us → Settings → “Play as” to test both sides.') : null,
    mine.length ? h('section', { class: 'rows' }, h('div', { class: 'h-sec' }, h('h2', null, 'Your move'), h('small', null, mine.length)), mine.map(gameRow)) : null,
    theirs.length ? h('section', { class: 'rows' }, h('div', { class: 'h-sec' }, h('h2', null, `${nm(op())}’s move`), h('small', null, theirs.length)), theirs.map(gameRow)) : null,
    h('section', { class: 'rows', style: 'gap:12px' },
      h('div', { class: 'h-sec' }, h('h2', null, 'Start a game'), h('small', null, Object.keys(GAMES).length + ' games')),
      h('div', { class: 'cats', role: 'toolbar' }, CATS.map(([id, l]) => h('button', { class: 'cat', 'aria-pressed': S.cat === id ? 'true' : 'false', onclick: () => { S.cat = id; renderMain(); } }, l))),
      h('div', { class: 'lib' }, lib.map(d => h('button', { class: 'tile', onclick: () => newGameSheet(d.id) }, iconEl(d), h('div', { class: 'kind' }, CAT_LABEL[d.cat] || ''), h('b', null, d.name), h('span', null, d.blurb))))),
    done.length ? h('section', { class: 'rows' }, h('div', { class: 'h-sec' }, h('h2', null, 'Lately'), h('small', null, 'More in Us')), done.map(gameRow)) : null);
}

// ---------- sheets ----------
function sheet(build) {
  const close = () => scrim.remove();
  const box = h('div', { class: 'sheet', role: 'dialog', 'aria-modal': 'true' });
  const scrim = h('div', { class: 'scrim', onclick: e => { if (e.target === scrim) close(); } }, box);
  build(box, close); document.body.append(scrim);
  const f = box.querySelector('input,button'); f && f.focus({ preventScroll: true });
  return close;
}
function newGameSheet(type, preset = {}) {
  const d = GAMES[type];
  sheet((box, close) => {
    let stake = preset.stake || ''; let first = preset.first || 'me';
    const custom = h('input', { class: 'inp', id: 'stake-custom', placeholder: 'Or write your own stake', maxlength: 60, value: STAKES.includes(stake) ? '' : stake, oninput: e => { stake = e.target.value; drawChips(); } });
    const chips = h('div', { class: 'chips' });
    const drawChips = () => chips.replaceChildren(h('button', { class: 'chip', 'aria-pressed': !stake ? 'true' : 'false', onclick: () => { stake = ''; custom.value = ''; drawChips(); } }, 'Just for fun'), ...STAKES.map(s => h('button', { class: 'chip', 'aria-pressed': stake === s ? 'true' : 'false', onclick: () => { stake = s; custom.value = ''; drawChips(); } }, s)));
    drawChips();
    const seg = h('div', { class: 'seg' });
    const drawSeg = () => seg.replaceChildren(...[['me', 'Me'], ['them', nm(op())], ['random', 'Coin flip']].map(([v, l]) => h('button', { class: 'chip', 'aria-pressed': first === v ? 'true' : 'false', onclick: () => { first = v; drawSeg(); } }, l)));
    drawSeg();
    box.append(
      h('div', { class: 'row' }, iconEl(d), h('h3', null, d.name)),
      h('div', { class: 'how' }, d.how),
      h('div', { class: 'field' }, h('span', { class: 'lbl' }, 'Stake (optional)'), chips, custom),
      d.cat !== 'duel' ? h('div', { class: 'field' }, h('span', { class: 'lbl' }, 'Who goes first'), seg) : null,
      h('button', { class: 'btn wide', onclick: async () => { close(); const f = first === 'me' ? me() : first === 'them' ? op() : (Math.random() < .5 ? 'p1' : 'p2'); await createGame(type, { stake: stake.trim(), first: f }); } }, `Challenge ${nm(op())}`));
  });
}
async function createGame(type, { stake = '', first = me() } = {}) {
  if (S.readOnly) { toast('This link is view-only for you.'); return; }
  const d = GAMES[type]; const id = uid8(); const seed = uid8(); const now = Date.now();
  const init = d.init(seed, first);
  const g = { type, status: 'active', createdAt: now, updatedAt: now, by: me(), first, seed, stake, paid: false, winner: null,
    turn: init.turn === undefined ? first : init.turn, state: init.state, lastBy: me() };
  S.gameMap[id] = { ...g, id }; S.games = [S.gameMap[id], ...S.games];
  try { await dbSet('games/' + id, g); } catch { return; }
  sfx('pop'); openGame(id);
  postEvent('', id, { k: 'inv', gt: type, st: stake || '' });
}

// ---------- live channel: who is in this game right now, and what they're doing ----------
const Live = {
  room: null, gid: null, opp: null, here: false, subs: new Set(), last: '',
  async join(gid) {
    this.gid = gid; if (!S.room || !S.room.join) return;
    try {
      const r = await S.room.join('g-' + gid.toLowerCase());
      if (this.gid !== gid) { r.leave().catch(() => {}); return; }
      this.room = r; r.presence({ seat: me(), live: null }).catch(() => {});
      r.onPeers(ch => {
        const p = ch.peers.find(x => !x.isMe && x.presence && x.presence.seat === op());
        const was = this.here; this.here = !!p; this.opp = p ? (p.presence.live ?? null) : null;
        this.subs.forEach(f => { try { f(this.opp); } catch (e) { console.error(e); } });
        if (was !== this.here && Host.id === gid) { Host.paint(S.gameMap[gid]); if (this.here) toast(`${nm(op())} joined the game`); }
      }, () => {});
    } catch (e) { console.warn('live view unavailable', e); }
  },
  send(obj) {
    if (!this.room) return; const s = JSON.stringify(obj ?? null); if (s === this.last || s.length > 3800) return;
    this.last = s; this.room.presence({ live: obj ?? null }).catch(() => {});
  },
  leave() { const r = this.room; this.room = null; this.gid = null; this.opp = null; this.here = false; this.subs.clear(); this.last = ''; if (r) r.leave().catch(() => {}); },
};
window.duelLive = null;

// ---------- game host ----------
const Host = {
  id: null, mod: null, el: null, armed: false,
  refresh() {
    if (!this.id) return; const g = S.gameMap[this.id];
    if (!g) { this.close(); return; }
    this.paint(g);
    try { this.mod && this.mod.update && this.mod.update(g); } catch (e) { console.error(e); }
  },
  paint(g) {
    const el = this.el; if (!el) return; const d = gdef(g.type);
    const pside = (seat, right) => {
      const t = g.status === 'active' && (g.turn === seat || (g.turn == null && needs(g, seat)));
      const sub = (d.side ? d.side(g, seat) : (seat === me() ? 'You' : (S.online ? 'Online' : 'Away'))) + (seat !== me() && Live.here ? ' · here now' : '');
      return h('div', { class: 'gp ' + seat + (right ? ' r' : '') + (t ? ' turn' : '') }, h('div', { class: 'av ' + seat }, em(seat)), h('div', { style: 'min-width:0' }, h('b', null, nm(seat)), h('small', null, sub)));
    };
    el.querySelector('.gplayers .wrap').replaceChildren(pside(me(), false), h('div', { class: 'gmid' }, d.mid ? d.mid(g) : 'vs'), pside(op(), true));
    const st = el.querySelector('.gstatus');
    if (!this.customStatus) { st.textContent = g.status === 'done' ? '' : statusLine(g); st.className = 'gstatus' + (needs(g) ? ' go' : ''); }
    el.querySelector('.stakebar').replaceChildren(g.stake ? h('span', null, 'Stake: ' + g.stake + (g.status === 'done' && g.paid ? ' · settled' : '')) : '');
    const res = el.querySelector('.gresult');
    if (g.status === 'done') {
      const won = g.winner === me(), tie = g.winner === 'tie';
      const loser = tie ? null : other(g.winner);
      res.replaceChildren(h('div', { class: 'result' },
        h('div', { class: 'row', style: 'justify-content:center' }, tie ? [avatar('p1', 'lg'), avatar('p2', 'lg')] : avatar(g.winner, 'lg')),
        h('h3', null, tie ? 'It’s a tie' : won ? 'You won!' : nm(g.winner) + ' won'),
        g.resigned ? h('p', { class: 'muted' }, nm(g.resigned) + ' resigned') : null,
        g.scores ? h('p', { class: 'mono muted' }, `${nm('p1')} ${g.scores.p1 ?? '–'} · ${nm('p2')} ${g.scores.p2 ?? '–'}`) : null,
        g.stake && !tie ? h('p', { style: 'font-weight:800;color:var(--lamp)' }, `${nm(loser)}: ${g.stake}`) : null,
        h('div', { class: 'gfoot' }, h('button', { class: 'btn', onclick: () => rematch(g) }, 'Rematch'), h('button', { class: 'btn ghost', onclick: () => { this.close(); S.tab = 'chat'; renderAll(); } }, 'Chat'))));
    } else res.replaceChildren();
    const foot = el.querySelector('.gtools');
    foot.replaceChildren(
      g.status === 'active' && !needs(g) ? h('button', { class: 'btn small ghost', onclick: () => { sendMsg({ k: 'nudge', g: g.id, t: d.name }); toast('Poke sent 👉'); sfx('tap'); } }, `Poke ${nm(op())} 👉`) : null,
      g.status === 'active' ? h('button', { class: 'btn small ghost', onclick: e => {
        if (!this.armed) { this.armed = true; e.target.textContent = 'Tap again to resign'; setTimeout(() => { this.armed = false; if (e.target.isConnected) e.target.textContent = 'Resign'; }, 3000); return; }
        this.armed = false; resign(g);
      } }, 'Resign') : null,
      h('button', { class: 'btn small ghost', onclick: e => {
        if (e.target.dataset.armed !== '1') { e.target.dataset.armed = '1'; e.target.textContent = 'Tap again to delete'; return; }
        S.db.doc('games/' + g.id).delete().catch(onWriteError); this.close();
      } }, 'Delete game'));
  },
  status(text, go) { const st = this.el && this.el.querySelector('.gstatus'); if (!st) return; this.customStatus = text != null; if (text != null) { st.textContent = text; st.className = 'gstatus' + (go ? ' go' : ''); } else this.refresh(); },
  open(id) {
    this.close(true); this.id = id; this.customStatus = false;
    const g = S.gameMap[id]; const d = gdef(g.type);
    const body = h('div', { class: 'wrap' });
    this.el = h('div', { class: 'layer', role: 'dialog', 'aria-label': d.name },
      h('div', { class: 'ghead' }, h('div', { class: 'wrap' },
        h('button', { class: 'iconbtn', 'aria-label': 'Back', onclick: () => this.close(), html: ICONS.back }),
        h('h2', null, d.name), h('div', { class: 'gicon', style: `width:36px;height:36px;font-size:19px;border-radius:10px;background:${d.tint}22` }, d.icon))),
      h('div', { class: 'gplayers' }, h('div', { class: 'wrap' })),
      h('div', { class: 'gbody' }, body));
    body.append(h('div', { class: 'gstatus' }), h('div', { class: 'stakebar' }), h('div', { class: 'gresult' }));
    const mount = h('div', { style: 'display:flex;flex-direction:column;gap:12px;align-items:stretch' });
    body.append(mount, h('div', { class: 'gfoot gtools', style: 'margin-top:6px' }));
    document.body.append(this.el);
    this.paint(g);
    try { this.mod = GAMES[g.type].create(mount, makeApi(id)); this.mod && this.mod.update && this.mod.update(g); Live.join(id); }
    catch (e) { console.error(e); mount.append(h('div', { class: 'empty' }, 'This game hit a snag loading. Go back and open it again.')); }
    S.pushPresence && S.pushPresence();
  },
  close(silent) {
    try { this.mod && this.mod.destroy && this.mod.destroy(); } catch {}
    Live.leave(); window.duelLive = null; this.mod = null; if (this.el) this.el.remove(); this.el = null; this.id = null;
    if (!silent) { S.pushPresence && S.pushPresence(); renderAll(); }
  },
};
function openGame(id) { if (!S.gameMap[id]) { toast('That game was deleted'); return; } Host.open(id); }
function makeApi(gid) {
  const api = {
    id: gid, me: me(), op: op(),
    g: () => S.gameMap[gid],
    name: nm, emoji: em, sfx, toast,
    myTurn: () => { const g = S.gameMap[gid]; return !!g && g.status === 'active' && g.turn === me(); },
    status: (t, go) => Host.status(t, go),
    live: { send: o => Live.send(o), on: fn => { Live.subs.add(fn); try { fn(Live.opp); } catch {} return () => Live.subs.delete(fn); }, here: () => Live.here },
    // true once for each change the other player made that this phone hasn't shown yet
    fresh(g) { if (!g || g.lastBy !== api.op) return false; const k = 'at-seen-' + gid + '-' + me(); const s_ = +(lsGet(k) || 0); if ((g.updatedAt || 0) > s_) { lsSet(k, String(g.updatedAt)); return true; } return false; },
    seenGet: k => lsGet('at-sv-' + gid + '-' + me() + '-' + k),
    seenSet: (k, v) => lsSet('at-sv-' + gid + '-' + me() + '-' + k, String(v)),
    async commit(state, turn, extra = {}) {
      const g = clone(S.gameMap[gid]); delete g.id;
      Object.assign(g, { state, turn, updatedAt: Date.now(), lastBy: me() }, extra);
      S.gameMap[gid] = { ...g, id: gid };
      await dbSet('games/' + gid, g);
    },
    async win(state, winner, extra = {}) {
      await api.commit(state, null, { status: 'done', winner, endedAt: Date.now(), ...extra });
      announce(gid);
    },
    async patch(obj) {
      const cur = S.gameMap[gid];
      const merge = (a, b) => { for (const k in b) { const v = b[k]; if (v && typeof v === 'object' && !Array.isArray(v) && a[k] && typeof a[k] === 'object' && !Array.isArray(a[k])) merge(a[k], v); else a[k] = clone(v); } return a; };
      const full = { ...obj, updatedAt: Date.now(), lastBy: me() };
      if (cur) S.gameMap[gid] = merge(clone(cur), full);
      await dbPatch('games/' + gid, full);
    },
    async finish(winner, extra = {}) { await api.patch({ status: 'done', winner, turn: null, endedAt: Date.now(), ...extra }); announce(gid); },
  };
  return api;
}
function announce(gid) {
  const g = S.gameMap[gid]; if (!g) return; const d = gdef(g.type);
  sfx(g.winner === 'tie' ? 'coin' : g.winner === me() ? 'win' : 'lose');
  postEvent('', gid, { k: 'res', gt: g.type, w: g.winner, st: g.stake || '' });
  Host.refresh();
}
async function resign(g) {
  await makeApi(g.id).finish(op(), { resigned: me() });
}
async function rematch(g) {
  const first = g.winner === 'tie' ? other(g.first || 'p1') : other(g.winner);
  await createGame(g.type, { stake: g.stake || '', first });
}

// ---------- chat ----------
let chatEls = null;
function renderChat(main) {
  markRead(); renderTabs();
  main.style.overflowY = 'hidden';
  const list = h('div', { class: 'msgs' }, h('div', { class: 'wrap' }));
  const ta = h('textarea', { id: 'chat-input', rows: 1, placeholder: `Message ${nm(op())}`, 'aria-label': 'Message',
    oninput: () => { ta.style.height = 'auto'; ta.style.height = Math.min(120, ta.scrollHeight) + 'px'; const now = Date.now(); if (S.room && now - (S.lastTypingEmit || 0) > 2500) { S.lastTypingEmit = now; S.room.emit('typing', { seat: me() }).catch(() => {}); } },
    onkeydown: e => { if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) { e.preventDefault(); send(); } } });
  const draft = lsGet('at-draft'); if (draft) ta.value = draft;
  ta.addEventListener('input', () => lsSet('at-draft', ta.value));
  const send = async () => { const t = ta.value.trim(); if (!t) return; ta.value = ''; lsSet('at-draft', ''); ta.style.height = 'auto'; await sendMsg({ k: 't', t }); };
  const typing = h('div', { class: 'typing wrap' });
  const compose = h('div', { class: 'compose' }, typing, h('div', { class: 'wrap' },
    h('button', { class: 'iconbtn', title: `Poke ${nm(op())}`, 'aria-label': `Poke ${nm(op())}`, onclick: () => { sendMsg({ k: 'nudge' }); sfx('tap'); toast('Poke sent 👉'); } }, '👉'),
    h('button', { class: 'iconbtn', title: 'Send a heart', 'aria-label': 'Send a heart', onclick: () => sendMsg({ k: 't', t: '❤️' }) }, '❤️'),
    ta, h('button', { class: 'iconbtn send', 'aria-label': 'Send', onclick: send, html: ICONS.send })));
  const wrap = h('div', { class: 'chatwrap' }, list, compose);
  main.replaceChildren(wrap);
  chatEls = { list, typing };
  renderChatList(true); renderTyping();
}
function renderTyping() { if (!chatEls) return; const on = Date.now() - S.partnerTyping < 3000; chatEls.typing.textContent = on ? `${nm(op())} is typing…` : ''; chatEls.typing.style.display = on ? '' : 'none'; }
function isEmojiOnly(t) { return t && t.length <= 8 && /^(\p{Extended_Pictographic}|‍|️|\s)+$/u.test(t); }
function renderChatList(jump) {
  if (!chatEls || !chatEls.list.isConnected) return;
  const sc = chatEls.list; const atBottom = jump || sc.scrollHeight - sc.scrollTop - sc.clientHeight < 80;
  const { msgs, re } = allMsgs(); const inner = sc.firstChild; const out = [];
  if (!msgs.length) out.push(h('div', { class: 'empty', style: 'margin-top:24px' }, `Say hi to ${nm(op())}. Game invites and results show up here too.`));
  let lastDay = '';
  for (const m of msgs) {
    const dk = dayKey(0, m.ts); if (dk !== lastDay) { lastDay = dk; out.push(h('div', { class: 'day' }, dk === dayKey() ? 'Today' : dk === dayKey(-1) ? 'Yesterday' : new Date(m.ts).toLocaleDateString([], { weekday: 'short', day: 'numeric', month: 'short' }))); }
    const mine = m.seat === me(); const who = mine ? 'You' : nm(m.seat);
    if (m.k === 'nudge') { out.push(h('div', { class: 'nudge' }, `👉 ${who} poked ${mine ? nm(op()) : 'you'}${m.t ? ' · ' + m.t : ''}`, h('span', { class: 'faint', style: 'font-weight:700' }, fmtTime(m.ts)))); continue; }
    if (m.k === 'ev' || m.k === 'inv' || m.k === 'res') {
      const g = m.g && S.gameMap[m.g]; const d = g ? gdef(g.type) : m.gt ? gdef(m.gt) : { icon: '✨', tint: '#f6c56c', name: 'a game' };
      let line = `${who} ${m.t}`;
      if (m.k === 'inv' && m.gt) line = `${who} challenged ${mine ? nm(op()) : 'you'} to ${d.name}` + (m.st ? ` · ${m.st}` : '');
      if (m.k === 'res' && m.gt) { const loser = m.w === 'tie' ? null : other(m.w); line = m.w === 'tie' ? `${d.name}: it’s a tie` : `${m.w === me() ? 'You' : nm(m.w)} beat ${loser === me() ? 'you' : nm(loser)} at ${d.name}` + (m.st ? ` · ${loser === me() ? 'You' : nm(loser)}: ${m.st}` : ''); }
      out.push(h('button', { class: 'ev', onclick: () => g ? openGame(g.id) : null }, iconEl(d), h('div', null, h('p', null, line), h('small', null, fmtTime(m.ts) + (g ? ' · ' + (g.status === 'active' ? statusLine(g) : 'Open') : '')))));
      continue;
    }
    const r = re[m.id];
    const bub = h('div', { class: 'bub' + (isEmojiOnly(m.t) ? ' big' : '') }, m.t);
    const node = h('div', { class: 'msg ' + (mine ? 'me' : 'them') }, bub, r ? h('span', { class: 'react', title: (r.by === me() ? 'You' : nm(r.by)) + ' reacted' }, r.e) : null, h('time', null, fmtTime(m.ts)));
    bub.addEventListener('click', ev => showReactBar(ev, m));
    out.push(node);
  }
  inner.replaceChildren(...out);
  if (atBottom) sc.scrollTop = sc.scrollHeight;
}
function showReactBar(ev, m) {
  document.querySelectorAll('.reactbar').forEach(x => x.remove());
  const bar = h('div', { class: 'reactbar', role: 'menu' }, REACTS.map(e => h('button', { 'aria-label': 'React ' + e, onclick: () => { bar.remove(); reactTo(m, e); } }, e)));
  document.body.append(bar);
  const r = ev.currentTarget.getBoundingClientRect(); const bw = bar.offsetWidth;
  bar.style.left = clamp(r.left + r.width / 2 - bw / 2, 8, innerWidth - bw - 8) + 'px';
  bar.style.top = Math.max(8 + (parseFloat(getComputedStyle(document.documentElement).paddingTop) || 0), r.top - 54) + 'px';
  setTimeout(() => addEventListener('pointerdown', function off(e) { if (!bar.contains(e.target)) { bar.remove(); removeEventListener('pointerdown', off); } }), 0);
}

// ---------- Us tab ----------
function renderUs() {
  const done = S.games.filter(g => g.status === 'done');
  const wins = { p1: 0, p2: 0 }; let ties = 0;
  done.forEach(g => g.winner === 'tie' ? ties++ : wins[g.winner] = (wins[g.winner] || 0) + 1);
  // streaks (games are newest first)
  const decided = done.filter(g => g.winner !== 'tie').sort((a, b) => (b.endedAt || b.updatedAt) - (a.endedAt || a.updatedAt));
  let cur = null, curN = 0; for (const g of decided) { if (cur == null) { cur = g.winner; curN = 1; } else if (g.winner === cur) curN++; else break; }
  const best = { p1: 0, p2: 0 }; { let w = null, n = 0; for (const g of decided.slice().reverse()) { if (g.winner === w) n++; else { w = g.winner; n = 1; } best[w] = Math.max(best[w], n); } }
  const byType = {}; done.forEach(g => { const t = byType[g.type] || (byType[g.type] = { p1: 0, p2: 0, tie: 0, n: 0 }); t.n++; g.winner === 'tie' ? t.tie++ : t[g.winner]++; });
  const fav = Object.entries(byType).sort((a, b) => b[1].n - a[1].n)[0];
  const byCat = {}; done.forEach(g => { const c = gdef(g.type).cat; const t = byCat[c] || (byCat[c] = { p1: 0, p2: 0 }); if (g.winner !== 'tie') t[g.winner]++; });
  const owed = done.filter(g => g.stake && g.winner !== 'tie' && !g.paid);
  const leader = wins.p1 === wins.p2 ? null : wins.p1 > wins.p2 ? 'p1' : 'p2';
  const nameIn = h('input', { class: 'inp', id: 'set-name', value: nm(me()), maxlength: 20 });
  const opIn = h('input', { class: 'inp', id: 'set-opname', value: nm(op()), maxlength: 20 });
  let myEmoji = em(me());
  const emojiRow = h('div', { class: 'emojis' });
  const drawEm = () => emojiRow.replaceChildren(...EMOJIS.map(e => h('button', { 'aria-pressed': myEmoji === e ? 'true' : 'false', onclick: () => { myEmoji = e; drawEm(); } }, e))); drawEm();
  return h('div', { class: 'wrap' },
    h('div', { class: 'score' },
      h('div', { class: 'side' }, avatar('p1', 'lg'), h('b', null, nm('p1')), h('div', { class: 'num', style: 'color:var(--p1)' }, wins.p1)),
      h('div', { class: 'vs' }, 'wins', h('br'), ties ? ties + ' tie' + (ties > 1 ? 's' : '') : ''),
      h('div', { class: 'side' }, avatar('p2', 'lg'), h('b', null, nm('p2')), h('div', { class: 'num', style: 'color:var(--p2)' }, wins.p2))),
    h('div', { class: 'stats' },
      h('div', { class: 'stat' }, h('div', { class: 'k' }, 'Leading'), h('div', { class: 'v' }, leader ? `${nm(leader)} by ${Math.abs(wins.p1 - wins.p2)}` : done.length ? 'Level' : 'No games yet')),
      h('div', { class: 'stat' }, h('div', { class: 'k' }, 'On a streak'), h('div', { class: 'v' }, cur ? `${nm(cur)} · ${curN}` : '–')),
      h('div', { class: 'stat' }, h('div', { class: 'k' }, 'Best streak'), h('div', { class: 'v' }, `${best.p1} · ${best.p2}`)),
      h('div', { class: 'stat' }, h('div', { class: 'k' }, 'Most played'), h('div', { class: 'v' }, fav ? `${gdef(fav[0]).name} (${fav[1].n})` : '–')),
      ...['fight', 'duel', 'classic', 'word'].map(c => h('div', { class: 'stat' }, h('div', { class: 'k' }, CATS.find(x => x[0] === c)[1]), h('div', { class: 'v' }, byCat[c] ? `${byCat[c].p1} – ${byCat[c].p2}` : '–')))),
    h('section', { class: 'rows' }, h('div', { class: 'h-sec' }, h('h2', null, 'Stakes owed'), h('small', null, owed.length || '')),
      owed.length ? owed.map(g => { const loser = other(g.winner); return h('div', { class: 'owe' }, iconEl(gdef(g.type)), h('p', null, `${nm(loser)}: ${g.stake}`, h('small', null, `${gdef(g.type).name} · ${ago(g.endedAt || g.updatedAt)}`)), h('button', { class: 'btn small gold', onclick: () => makeApi(g.id).patch({ paid: true }).then(() => toast('Marked as settled')) }, 'Settled')); })
        : h('div', { class: 'empty' }, 'Nobody owes anything right now. Add a stake when you start a game.')),
    Object.keys(byType).length ? h('section', { class: 'rows' }, h('div', { class: 'h-sec' }, h('h2', null, 'Game by game')),
      h('div', { class: 'tblbox' }, h('table', { class: 'table' }, h('thead', null, h('tr', null, h('th', null, 'Game'), h('th', { style: 'text-align:right' }, nm('p1')), h('th', { style: 'text-align:right' }, nm('p2')), h('th', { style: 'text-align:right' }, 'Ties'))),
        h('tbody', null, Object.entries(byType).sort((a, b) => b[1].n - a[1].n).map(([t, v]) => h('tr', null, h('td', null, gdef(t).icon + ' ' + gdef(t).name), h('td', { class: 'n' }, v.p1), h('td', { class: 'n' }, v.p2), h('td', { class: 'n' }, v.tie))))))) : null,
    done.length ? h('section', { class: 'rows' }, h('div', { class: 'h-sec' }, h('h2', null, 'History'), h('small', null, done.length + ' games')), done.slice(0, 30).map(gameRow)) : null,
    h('section', { class: 'card' }, h('div', { class: 'h-sec' }, h('h2', null, 'Settings')),
      h('div', { class: 'field' }, h('label', { for: 'set-name' }, 'Your name'), nameIn), emojiRow,
      h('div', { class: 'field' }, h('label', { for: 'set-opname' }, `${nm(op())}’s name`), opIn),
      h('button', { class: 'btn small', onclick: () => { const a = nameIn.value.trim(), b = opIn.value.trim(); if (!a || !b) return toast('Names can’t be empty'); dbPatch('app/couple', { [me()]: { name: a, emoji: myEmoji }, [op()]: { name: b } }).then(() => toast('Saved')).catch(() => {}); } }, 'Save'),
      h('div', { class: 'row' }, h('span', { class: 'lbl' }, 'Sound'), h('button', { class: 'btn small ghost', onclick: e => { SFX.on = !SFX.on; e.target.textContent = SFX.on ? 'On' : 'Off'; } }, SFX.on ? 'On' : 'Off')),
      S.mode === 'fb' ? h('div', { class: 'row' }, h('span', { class: 'muted', style: 'flex:1;min-width:0;overflow-wrap:anywhere;font-size:13px' }, 'Signed in as ' + (S.email || 'you')), h('button', { class: 'btn small ghost', onclick: () => FB.signOut().then(() => location.reload()) }, 'Sign out')) : null,
      S.mode === 'fb' ? null : h('div', { class: 'field' }, h('span', { class: 'lbl' }, 'Play as (for testing both sides)'),
        h('div', { class: 'row' }, ['p1', 'p2'].map(p => h('button', { class: 'chip', 'aria-pressed': me() === p ? 'true' : 'false', onclick: () => { takeSeat(p); toast('Now playing as ' + nm(p)); } }, em(p) + ' ' + nm(p))))),
      S.mode === 'fb' ? null : h('p', { class: 'note' }, `To bring ${nm(op())} in: Share this page and give them Contributor access, then they open the link and pick “${nm(op())}” on their phone. View-only access lets them watch but not play.`)));
}

window.addEventListener('keydown', e => { if (e.key === 'Escape') { const s = $('.scrim'); if (s) s.remove(); else if (Host.id) Host.close(); } });
