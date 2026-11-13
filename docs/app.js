// ================= Core: helpers, sound, data layer =================
const GAMES = {};            // registry: id -> definition
// allow null/false placeholders in append/replaceChildren calls
for (const fn of ['append', 'replaceChildren']) { const orig = Element.prototype[fn]; Element.prototype[fn] = function (...k) { return orig.apply(this, k.flat(Infinity).filter(x => x != null && x !== false)); }; }
const $ = (s, r = document) => r.querySelector(s);
function h(tag, attrs, ...kids) {
  const el = document.createElement(tag);
  if (attrs) for (const k in attrs) {
    const v = attrs[k];
    if (v == null || v === false) continue;
    if (k === 'class') el.className = v;
    else if (k === 'style') el.style.cssText = v;
    else if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2), v);
    else if (k === 'html') el.innerHTML = v;
    else el.setAttribute(k, v === true ? '' : v);
  }
  const add = c => { if (c == null || c === false) return; if (Array.isArray(c)) c.forEach(add); else el.append(c.nodeType ? c : document.createTextNode(String(c))); };
  kids.forEach(add);
  return el;
}
const clone = o => o == null ? o : JSON.parse(JSON.stringify(o));
const other = s => s === 'p1' ? 'p2' : 'p1';
const sleep = ms => new Promise(r => setTimeout(r, ms));
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const lsGet = k => { try { return localStorage.getItem(k); } catch { return null; } };
const lsSet = (k, v) => { try { v == null ? localStorage.removeItem(k) : localStorage.setItem(k, v); } catch {} };
const uid8 = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
function dayKey(offsetDays = 0, t = Date.now()) {
  const d = new Date(t + offsetDays * 864e5);
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
}
function hashStr(s) { let h = 1779033703 ^ s.length; for (let i = 0; i < s.length; i++) { h = Math.imul(h ^ s.charCodeAt(i), 3432918353); h = h << 13 | h >>> 19; } h = Math.imul(h ^ h >>> 16, 2246822507); h = Math.imul(h ^ h >>> 13, 3266489909); return (h ^= h >>> 16) >>> 0; }
function rng(seed) { let a = hashStr(String(seed)); return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
const rint = (r, a, b) => a + Math.floor(r() * (b - a + 1));
function shuffle(arr, r = Math.random) { const a = arr.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }
function fmtTime(ts) { return new Date(ts).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }); }
function ago(ts) { const s = (Date.now() - ts) / 1000; if (s < 60) return 'just now'; if (s < 3600) return Math.floor(s / 60) + 'm ago'; if (s < 86400) return Math.floor(s / 3600) + 'h ago'; const d = Math.floor(s / 86400); return d === 1 ? 'yesterday' : d + 'd ago'; }

// ---------- sound (tiny synth) ----------
const SFX = (() => {
  let ac = null; let on = lsGet('at-sound') !== 'off';
  const ctx = () => { if (!ac) { try { ac = new (window.AudioContext || window.webkitAudioContext)(); } catch { ac = null; } } return ac; };
  function tone(f, d = .08, type = 'sine', v = .12, slide = 0, delay = 0) {
    if (!on) return; const c = ctx(); if (!c) return;
    const t = c.currentTime + delay; const o = c.createOscillator(); const g = c.createGain();
    o.type = type; o.frequency.setValueAtTime(f, t); if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(30, f + slide), t + d);
    g.gain.setValueAtTime(v, t); g.gain.exponentialRampToValueAtTime(.0001, t + d);
    o.connect(g).connect(c.destination); o.start(t); o.stop(t + d + .02);
  }
  function noise(d = .15, v = .15) { if (!on) return; const c = ctx(); if (!c) return; const b = c.createBuffer(1, c.sampleRate * d, c.sampleRate); const ch = b.getChannelData(0); for (let i = 0; i < ch.length; i++) ch[i] = (Math.random() * 2 - 1) * (1 - i / ch.length); const s = c.createBufferSource(); s.buffer = b; const g = c.createGain(); g.gain.value = v; s.connect(g).connect(c.destination); s.start(); }
  const lib = {
    tap: () => tone(660, .05, 'triangle', .08),
    pop: () => tone(520, .09, 'sine', .14, 380),
    thud: () => { tone(140, .12, 'sine', .2, -60); },
    hit: () => { noise(.12, .18); tone(180, .15, 'square', .06, -80); },
    boom: () => { noise(.45, .3); tone(90, .4, 'sine', .25, -50); },
    whoosh: () => tone(300, .18, 'sawtooth', .03, 500),
    coin: () => { tone(880, .07, 'square', .05); tone(1320, .12, 'square', .05, 0, .07); },
    win: () => [523, 659, 784, 1046].forEach((f, i) => tone(f, .2, 'triangle', .12, 0, i * .11)),
    lose: () => [392, 330, 262].forEach((f, i) => tone(f, .25, 'triangle', .1, 0, i * .14)),
    bad: () => tone(160, .2, 'square', .07, -40),
    msg: () => { tone(740, .06, 'sine', .08); tone(990, .09, 'sine', .08, 0, .06); },
    buzz: () => { for (let i = 0; i < 4; i++) tone(110, .06, 'square', .08, 0, i * .09); try { navigator.vibrate && navigator.vibrate([80, 60, 80]); } catch {} },
  };
  return { play: n => { try { lib[n] && lib[n](); } catch {} }, get on() { return on; }, set on(v) { on = v; lsSet('at-sound', v ? 'on' : 'off'); }, unlock: () => { const c = ctx(); if (c && c.state === 'suspended') c.resume(); } };
})();
const sfx = n => SFX.play(n);
addEventListener('pointerdown', () => SFX.unlock(), { once: true });

// ---------- toast ----------
function toast(msg, ms = 2200) {
  let box = $('.toasts'); if (!box) { box = h('div', { class: 'toasts', 'aria-live': 'polite' }); document.body.append(box); }
  const t = h('div', { class: 'toast' }, msg); box.append(t); setTimeout(() => t.remove(), ms);
}

// ---------- local fallback store (same API subset as the db capability) ----------
function localDB() {
  const KEY = 'acrosstown-local-db'; let store = {};
  try { store = JSON.parse(lsGet(KEY) || '{}'); } catch {}
  const subs = new Set();
  const save = () => lsSet(KEY, JSON.stringify(store));
  const notify = () => setTimeout(() => subs.forEach(f => f()), 0);
  const meta = { fromCache: false, hasPendingWrites: false };
  const snapDoc = p => { const d = store[p]; return { id: p.split('/').pop(), exists: !!d, data: () => d ? clone(d) : undefined, metadata: meta }; };
  const merge = (a, b) => { for (const k in b) { const v = b[k]; if (v && typeof v === 'object' && !Array.isArray(v) && a[k] && typeof a[k] === 'object' && !Array.isArray(a[k])) merge(a[k], v); else a[k] = v; } return a; };
  function docRef(path) {
    return { id: path.split('/').pop(), path,
      async get() { return snapDoc(path); },
      async set(d) { store[path] = clone(d); save(); notify(); },
      async update(d) { if (!store[path]) throw { code: 'invalid_argument', message: 'missing' }; merge(store[path], clone(d)); save(); notify(); },
      async delete() { delete store[path]; save(); notify(); },
      onSnapshot(n) { const f = () => n(snapDoc(path)); subs.add(f); setTimeout(f, 0); return () => subs.delete(f); },
      collection(c) { return query(path + '/' + c); } };
  }
  function query(col, filters = [], ord = null, lim = 1000) {
    const depth = col.split('/').length + 1;
    const run = () => {
      let ds = Object.keys(store).filter(p => p.startsWith(col + '/') && p.split('/').length === depth).map(snapDoc);
      ds = ds.filter(d => filters.every(([f, op, v]) => { const x = d.data()[f]; return op === '==' ? x === v : op === '>=' ? x >= v : op === '<=' ? x <= v : op === '>' ? x > v : op === '<' ? x < v : op === '!=' ? x !== v : true; }));
      if (ord) ds.sort((a, b) => { const x = a.data()[ord[0]], y = b.data()[ord[0]]; return (x < y ? -1 : x > y ? 1 : 0) * (ord[1] === 'desc' ? -1 : 1); });
      ds = ds.slice(0, lim);
      return { docs: ds, size: ds.length, empty: !ds.length, docChanges: () => [], metadata: meta };
    };
    const q = { path: col,
      where: (f, op, v) => query(col, [...filters, [f, op, v]], ord, lim),
      orderBy: (f, d = 'asc') => query(col, filters, [f, d], lim),
      limit: n => query(col, filters, ord, n),
      async get() { return run(); },
      onSnapshot(n) { const f = () => n(run()); subs.add(f); setTimeout(f, 0); return () => subs.delete(f); },
      doc: id => docRef(col + '/' + (id || uid8())),
      async add(d) { const r = q.doc(); await r.set(d); return r; } };
    return q;
  }
  return { doc: docRef, collection: c => query(c) };
}

// ---------- app state ----------
const S = {
  mode: 'loading', db: null, user: null, room: null, uid: null,
  seat: null, couple: null, coupleLoaded: false,
  games: [], gameMap: {}, gamesLoaded: false,
  chatDocs: {}, chatLoaded: false,
  online: false, partnerWhere: '', partnerTyping: 0,
  tab: lsGet('at-tab') || 'play', cat: 'all',
  readOnly: false, slow: false,
};
const me = () => S.seat;
const op = () => other(S.seat);
const P = seat => (S.couple && S.couple[seat]) || { name: S.mode === 'fb' ? '' : seat === 'p1' ? 'Player 1' : 'Player 2', emoji: seat === 'p1' ? '🌙' : '⭐' };
const nm = seat => P(seat).name || (S.mode === 'fb' ? 'your person' : seat === 'p1' ? 'Player 1' : 'Player 2');
const em = seat => P(seat).emoji || '🙂';

function onWriteError(e) {
  console.warn('write failed', e);
  const code = e && e.code;
  if (code === 'permission-denied') toast('That wasn’t saved: this account can’t write to this room.', 4000);
  else if (code === 'invalid_argument' || code === 'not_granted') { S.readOnly = true; toast('This link is view-only for you. Ask for Contributor access to play.', 4000); }
  else if (code === 'quota_exceeded') toast('Storage is full. Remove a few old games in Us → Settings.', 4000);
  else toast('Couldn’t save that move. Check your connection and try again.', 3500);
}
// one write at a time per document
const writeQ = {};
function queued(path, fn) {
  const p = (writeQ[path] || Promise.resolve()).then(fn, fn);
  writeQ[path] = p.catch(() => {});
  return p;
}
function dbSet(path, data) { return queued(path, () => S.db.doc(path).set(data)).catch(e => { onWriteError(e); throw e; }); }
function dbPatch(path, data) { return queued(path, () => S.db.doc(path).update(data)).catch(e => { onWriteError(e); throw e; }); }

// ---------- chat data ----------
// One document per day per person: chat/<day>_<seat> = {day, seat, msgs:[], re:{msgId:emoji}}
function myChatDoc(day = dayKey()) {
  const id = day + '_' + me();
  const cur = S.chatDocs[id];
  return { id, body: cur ? clone(cur) : { day, seat: me(), msgs: [], re: {} } };
}
async function sendMsg(m) {
  if (!S.seat) return;
  const msg = { id: uid8(), ts: Date.now(), ...m };
  const { id } = myChatDoc();
  // build from latest cache inside the queue so rapid sends never drop each other
  await queued('chat/' + id, async () => {
    const { body } = myChatDoc();
    body.msgs = (body.msgs || []).concat(msg).slice(-1500);
    S.chatDocs[id] = clone(body); // optimistic
    await S.db.doc('chat/' + id).set(body);
  }).catch(onWriteError);
  if (S.tab === 'chat') renderMain();
  return msg;
}
async function reactTo(msg, emoji) {
  const { id } = myChatDoc();
  await queued('chat/' + id, async () => {
    const { body } = myChatDoc();
    body.re = body.re || {};
    if (body.re[msg.id] === emoji) delete body.re[msg.id]; else body.re[msg.id] = emoji;
    S.chatDocs[id] = clone(body);
    await S.db.doc('chat/' + id).set(body);
  }).catch(onWriteError);
  renderMain();
}
function allMsgs() {
  const out = []; const re = {};
  for (const id in S.chatDocs) { const d = S.chatDocs[id]; (d.msgs || []).forEach(m => out.push({ ...m, seat: d.seat })); Object.assign(re, Object.fromEntries(Object.entries(d.re || {}).map(([k, v]) => [k, { e: v, by: d.seat }]))); }
  out.sort((a, b) => a.ts - b.ts);
  return { msgs: out, re };
}
function unreadCount() {
  if (!S.seat) return 0;
  const last = +(lsGet('at-read-' + S.seat) || 0);
  return allMsgs().msgs.filter(m => m.seat !== S.seat && m.ts > last).length;
}
function markRead() { if (S.seat) lsSet('at-read-' + S.seat, String(Date.now())); }
function postEvent(text, gid, extra = {}) { return sendMsg({ k: 'ev', t: text, g: gid || null, ...extra }); }

// ================= shared canvas helpers for games =================
function stage(el, W, H, opts = {}) {
  const wrap = h('div', { class: 'stage' }); const cv = h('canvas'); wrap.append(cv); el.append(wrap);
  const ctx = cv.getContext('2d'); const st = { cv, ctx, W, H, wrap, s: 1 };
  st.fit = () => {
    const avail = wrap.clientWidth || el.clientWidth || 360;
    const maxH = opts.maxH || Math.max(260, innerHeight * (opts.hFrac || .62));
    const w = Math.min(avail, maxH * W / H, opts.maxW || 900);
    const dpr = Math.min(devicePixelRatio || 1, 2); const s = w / W;
    cv.style.width = w + 'px'; cv.style.height = H * s + 'px';
    cv.width = Math.round(w * dpr); cv.height = Math.round(H * s * dpr);
    st.s = s; ctx.setTransform(dpr * s, 0, 0, dpr * s, 0, 0);
    opts.onFit && opts.onFit();
  };
  st.pt = e => { const r = cv.getBoundingClientRect(); return { x: (e.clientX - r.left) / r.width * W, y: (e.clientY - r.top) / r.height * H }; };
  requestAnimationFrame(st.fit); st.fit();
  const ro = new ResizeObserver(() => st.fit()); ro.observe(wrap);
  st.destroy = () => ro.disconnect();
  return st;
}
function loop(fn) {
  let on = true, last = performance.now(), id;
  const f = t => { if (!on) return; const dt = Math.min(.05, (t - last) / 1000); last = t; try { fn(dt, t); } catch (e) { console.error(e); on = false; } if (on) id = requestAnimationFrame(f); };
  id = requestAnimationFrame(f);
  return () => { on = false; cancelAnimationFrame(id); };
}
function rr(ctx, x, y, w, h_, r) { ctx.beginPath(); ctx.roundRect ? ctx.roundRect(x, y, w, h_, r) : ctx.rect(x, y, w, h_); }
function txt(ctx, s, x, y, size = 16, color = '#f9eef3', align = 'center', font = 'Nunito', weight = 900) {
  ctx.font = `${weight} ${size}px ${font}, system-ui, sans-serif`; ctx.fillStyle = color; ctx.textAlign = align; ctx.textBaseline = 'middle'; ctx.fillText(s, x, y);
}
const SEATCOL = { p1: '#ff8fab', p2: '#f6c56c' };
function nightSky(ctx, W, H, seed, top = '#1d1230', bottom = '#3a2350') {
  const g = ctx.createLinearGradient(0, 0, 0, H); g.addColorStop(0, top); g.addColorStop(1, bottom); ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  const r = rng(seed + 'stars'); ctx.fillStyle = '#ffe4a8';
  for (let i = 0; i < 50; i++) { ctx.globalAlpha = r() * .5 + .15; ctx.beginPath(); ctx.arc(r() * W, r() * H * .55, r() * 1.3 + .3, 0, 7); ctx.fill(); }
  ctx.globalAlpha = 1;
}
// floating texts and particles shared by canvas games
function fx() {
  const parts = [], texts = [];
  return {
    burst(x, y, color, n = 14, sp = 160, life = .7, grav = 300) { for (let i = 0; i < n; i++) { const a = Math.random() * 6.28, v = Math.random() * sp; parts.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - sp * .3, life, max: life, color, grav, r: 2 + Math.random() * 2.5 }); } },
    text(s, x, y, color = '#fff', size = 22) { texts.push({ s, x, y, color, size, life: 1.3 }); },
    step(dt) { for (const p of parts) { p.life -= dt; p.vy += p.grav * dt; p.x += p.vx * dt; p.y += p.vy * dt; } for (const t of texts) { t.life -= dt; t.y -= 28 * dt; } for (let i = parts.length - 1; i >= 0; i--) if (parts[i].life <= 0) parts.splice(i, 1); for (let i = texts.length - 1; i >= 0; i--) if (texts[i].life <= 0) texts.splice(i, 1); },
    draw(ctx) { for (const p of parts) { ctx.globalAlpha = Math.max(0, p.life / p.max); ctx.fillStyle = p.color; ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, 7); ctx.fill(); } ctx.globalAlpha = 1; for (const t of texts) { ctx.globalAlpha = Math.min(1, t.life * 1.5); ctx.lineWidth = 4; ctx.strokeStyle = 'rgba(20,10,28,.85)'; ctx.font = `900 ${t.size}px Nunito, system-ui, sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.strokeText(t.s, t.x, t.y); ctx.fillStyle = t.color; ctx.fillText(t.s, t.x, t.y); } ctx.globalAlpha = 1; },
    get busy() { return parts.length + texts.length > 0; },
  };
}

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

// ================= Fight games: shared turn-based artillery engine =================
const FW = 640, FH = 420;
const FIGHT = {
  archery: { speed: 860, grav: 520, windA: 90, head: 40, body: 22, label: 'arrow' },
  tanks: { speed: 720, grav: 480, windA: 60, blast: 58, blastDmg: 42, direct: 14, crater: 30, label: 'shell' },
  snow: { speed: 640, grav: 500, windA: 70, head: 30, body: 18, label: 'snowball' },
  pirates: { speed: 780, grav: 470, windA: 55, head: 38, body: 24, label: 'cannonball' },
};
function fightWorld(seed, theme) {
  const r = rng(seed + 'terrain'); const g = new Float32Array(FW + 1);
  const ph = [r() * 6.28, r() * 6.28, r() * 6.28];
  const base = FH * .8;
  for (let x = 0; x <= FW; x++) {
    let y = base;
    if (theme === 'archery') y = base - 110 * Math.exp(-(((x - 95) / 110) ** 2)) - 110 * Math.exp(-(((x - 545) / 110) ** 2)) - 18 * Math.sin(x / 47 + ph[0]) - (40 + r() * 0) * Math.exp(-(((x - 320) / 70) ** 2)) * (0.6 + 0.8 * ((hashStr(seed) % 100) / 100));
    else if (theme === 'tanks') y = base - 40 - 38 * Math.sin(x / 96 + ph[0]) - 26 * Math.sin(x / 41 + ph[1]) - 70 * Math.exp(-(((x - 320) / 95) ** 2));
    else if (theme === 'snow') y = base - 20 - 22 * Math.sin(x / 80 + ph[0]) - 12 * Math.sin(x / 33 + ph[1]) - 30 * Math.exp(-(((x - 320) / 120) ** 2));
    else y = FH + 40; // pirates: open sea
    g[x] = y;
  }
  const pos = { p1: Math.round(70 + r() * 40), p2: Math.round(FW - 70 - r() * 40) };
  const walls = theme === 'snow' ? [{ x: pos.p1 + 42, w: 16, h: 34 }, { x: pos.p2 - 58, w: 16, h: 34 }] : [];
  return { ground: g, pos, walls, sea: theme === 'pirates' ? FH * .8 : null };
}
function applyCraters(ground, craters) {
  const g = Float32Array.from(ground);
  for (const c of craters || []) for (let x = Math.max(0, Math.floor(c.x - c.r)); x <= Math.min(FW, Math.ceil(c.x + c.r)); x++) { const dy = Math.sqrt(Math.max(0, c.r * c.r - (x - c.x) ** 2)); g[x] = Math.max(g[x], Math.min(FH + 30, c.y + dy)); }
  return g;
}
const windAt = (seed, i) => Math.round((rng(seed + 'wind' + i)() * 2 - 1) * 10) / 10;
function footY(W, ground, seat) { const x = W.pos[seat]; if (W.sea) return W.sea; let y = Infinity; for (let dx = -8; dx <= 8; dx++) y = Math.min(y, ground[clamp(x + dx, 0, FW)]); return y; }
function hitboxes(theme, x, y) {
  if (theme === 'tanks') return { body: [x - 24, y - 20, x + 24, y], head: [x, y - 24, 8] };
  if (theme === 'pirates') return { body: [x - 48, y - 34, x + 48, y - 2], head: [x, y - 66, 11] };
  return { body: [x - 11, y - 46, x + 11, y], head: [x, y - 57, 10] };
}
function muzzle(theme, x, y, seat) { const dir = seat === 'p1' ? 1 : -1; if (theme === 'tanks') return [x, y - 26]; if (theme === 'pirates') return [x + dir * 30, y - 30]; if (theme === 'snow') return [x + dir * 8, y - 50]; return [x + dir * 14, y - 40]; }
function simulateShot(theme, seed, state, shooter, vx0, vy0, wind) {
  const W = fightWorld(seed, theme); const cfg = FIGHT[theme];
  const ground = applyCraters(W.ground, state.craters);
  const feet = { p1: footY(W, ground, 'p1'), p2: footY(W, ground, 'p2') };
  let [x, y] = muzzle(theme, W.pos[shooter], feet[shooter], shooter);
  let vx = vx0, vy = vy0; const dt = 1 / 120; const path = [];
  let res = { kind: 'out', x, y, dmg: { p1: 0, p2: 0 } };
  const boxes = { p1: hitboxes(theme, W.pos.p1, feet.p1), p2: hitboxes(theme, W.pos.p2, feet.p2) };
  for (let i = 0; i < 120 * 9; i++) {
    vx += wind * cfg.windA * dt; vy += cfg.grav * dt; x += vx * dt; y += vy * dt;
    if (i % 2 === 0) path.push([Math.round(x * 10) / 10, Math.round(y * 10) / 10]);
    let hitSeat = null, part = null;
    for (const s of ['p1', 'p2']) {
      if (s === shooter && i < 30) continue;
      const b = boxes[s]; const [hx, hy, hr] = b.head;
      if ((x - hx) ** 2 + (y - hy) ** 2 < hr * hr) { hitSeat = s; part = 'head'; break; }
      if (x > b.body[0] && x < b.body[2] && y > b.body[1] && y < b.body[3]) { hitSeat = s; part = 'body'; break; }
    }
    const ix = Math.round(x);
    const wallHit = W.walls.some(w => x > w.x && x < w.x + w.w && y > ground[clamp(Math.round(w.x + w.w / 2), 0, FW)] - w.h && i > 6);
    const gHit = ix >= 0 && ix <= FW && y >= ground[ix];
    const seaHit = W.sea != null && y >= W.sea + 4;
    if (hitSeat || wallHit || gHit || seaHit || x < -150 || x > FW + 150 || y > FH + 80) {
      path.push([x, y]);
      res = { kind: hitSeat ? part : wallHit ? 'wall' : gHit ? 'ground' : seaHit ? 'water' : 'out', seat: hitSeat, x: Math.round(x), y: Math.round(y), ang: Math.atan2(vy, vx), dmg: { p1: 0, p2: 0 } };
      if (theme === 'tanks' && res.kind !== 'out' && res.kind !== 'water') {
        for (const s of ['p1', 'p2']) { const cx = W.pos[s], cy = feet[s] - 10; const d = Math.hypot(cx - x, cy - y); if (d < cfg.blast) res.dmg[s] = Math.round(cfg.blastDmg * (1 - d / cfg.blast)) + (hitSeat === s ? cfg.direct : 0); }
        res.crater = { x: Math.round(x), y: Math.round(y), r: cfg.crater };
      } else if (hitSeat) res.dmg[hitSeat] = part === 'head' ? cfg.head : cfg.body;
      break;
    }
  }
  return { path, res, W, ground, feet };
}

function fightGame(id, theme, meta) {
  GAMES[id] = {
    id, cat: 'fight', ...meta,
    init: (seed, first) => ({ state: { hp: { p1: 100, p2: 100 }, shots: [], craters: [], marks: [] }, turn: first }),
    side: (g, seat) => `❤ ${g.state.hp[seat]}` + (seat === me() ? ' · you' : ''),
    mid: g => { const w = windAt(g.seed, g.state.shots.length); return `wind ${w > 0 ? '→' : w < 0 ? '←' : '·'} ${Math.abs(w * 10).toFixed(0)}`; },
    create(el, api) {
      const st = stage(el, FW, FH, { hFrac: .55 }); const ctx = st.ctx; const F = fx();
      const tip = h('p', { class: 'muted', style: 'text-align:center;font-size:13px' }, 'Drag back from anywhere and let go to fire, like a slingshot. The dotted line shows your launch; wind bends the rest.');
      el.append(tip);
      let seen = api.g().state.shots.length;
      { const g_ = api.g(); const sh = g_.state.shots; const stored = +(api.seenGet('shots') ?? -1); if (sh.length && sh[sh.length - 1].by === api.op && stored < sh.length) seen = sh.length - 1; }
      let oppAim = null; const offLive = api.live.on(o => { oppAim = o && o.a ? o.a : null; }); let anim = null; let aim = null; let busy = false; let tPhase = 0;
      let snowflakes = Array.from({ length: theme === 'snow' ? 60 : 0 }, () => ({ x: Math.random() * FW, y: Math.random() * FH, v: 20 + Math.random() * 30 }));
      const g0 = api.g();
      const view = () => { const g = api.g(); const W = fightWorld(g.seed, theme); const ground = applyCraters(W.ground, g.state.craters); return { g, W, ground, feet: { p1: footY(W, ground, 'p1'), p2: footY(W, ground, 'p2') } }; };
      let V = view();
      let shownHp = clone(g0.state.hp);
      if (seen < g0.state.shots.length) { const r_ = g0.state.shots[seen].res || {}; for (const s of ['p1', 'p2']) shownHp[s] = Math.min(100, shownHp[s] + ((r_.dmg && r_.dmg[s]) || 0)); }
      function lastPath(seat) { const g = api.g(); for (let i = g.state.shots.length - 1; i >= 0; i--) { const s = g.state.shots[i]; if (s.by === seat) { const pre = { craters: g.state.craters.slice(0, countCraters(g.state.shots.slice(0, i))) }; return simulateShot(theme, g.seed, pre, seat, s.vx, s.vy, s.w).path; } } return null; }
      function countCraters(shots) { return shots.filter(s => s.res && s.res.crater).length; }
      let ghost = lastPath(api.me);
      function playShot(shot, preState, done) {
        const sim = simulateShot(theme, api.g().seed, preState, shot.by, shot.vx, shot.vy, shot.w);
        anim = { path: sim.path, i: 0, shot, res: shot.res || sim.res, done };
        sfx(theme === 'tanks' || theme === 'pirates' ? 'thud' : 'whoosh');
      }
      function land(a) {
        const r = a.res; const col = theme === 'snow' ? '#ffffff' : theme === 'tanks' ? '#ffb15c' : theme === 'pirates' ? '#9fd3ff' : '#e9d3b0';
        if (theme === 'tanks' && r.kind !== 'out' && r.kind !== 'water') { F.burst(r.x, r.y, '#ffb15c', 26, 220); F.burst(r.x, r.y, '#ff6b7f', 14, 160); sfx('boom'); }
        else if (r.kind === 'water') { F.burst(r.x, r.y, '#9fd3ff', 18, 150); sfx('pop'); }
        else if (r.kind === 'head' || r.kind === 'body') { F.burst(r.x, r.y, theme === 'snow' ? '#fff' : '#ff6b7f', 16, 170); sfx('hit'); }
        else { F.burst(r.x, r.y, col, 10, 110); sfx('thud'); }
        for (const s of ['p1', 'p2']) if (r.dmg && r.dmg[s]) { const x = V.W.pos[s]; F.text((r.kind === 'head' ? (theme === 'tanks' ? 'DIRECT HIT ' : theme === 'pirates' ? 'CAPTAIN HIT ' : 'HEADSHOT ') : '') + '-' + r.dmg[s], x, V.feet[s] - 90, s === 'p1' ? SEATCOL.p1 : SEATCOL.p2, 20); shownHp[s] = Math.max(0, shownHp[s] - r.dmg[s]); }
        if (!r.dmg || (!r.dmg.p1 && !r.dmg.p2)) F.text(r.kind === 'water' ? 'Splash' : r.kind === 'wall' ? 'Blocked' : 'Miss', r.x, Math.min(r.y, FH - 30) - 20, '#bea8c1', 16);
      }
      async function fire(vx, vy) {
        const g = api.g(); if (!api.myTurn() || busy) return; busy = true;
        const w = windAt(g.seed, g.state.shots.length);
        const sim = simulateShot(theme, g.seed, g.state, api.me, vx, vy, w);
        const shot = { by: api.me, vx: Math.round(vx * 10) / 10, vy: Math.round(vy * 10) / 10, w, res: sim.res };
        // re-simulate with the rounded numbers so both phones agree exactly
        shot.res = simulateShot(theme, g.seed, g.state, api.me, shot.vx, shot.vy, w).res;
        const s2 = clone(g.state); s2.shots.push(shot);
        for (const s of ['p1', 'p2']) s2.hp[s] = Math.max(0, s2.hp[s] - (shot.res.dmg[s] || 0));
        if (shot.res.crater) s2.craters.push(shot.res.crater);
        if (theme === 'archery' && (shot.res.kind === 'ground' || shot.res.kind === 'wall')) { s2.marks = (s2.marks || []).concat([[shot.res.x, shot.res.y, Math.round(shot.res.ang * 100) / 100]]).slice(-12); }
        seen = s2.shots.length; api.seenSet('shots', seen); api.live.send(null);
        playShot(shot, g.state, () => {});
        const dead1 = s2.hp.p1 <= 0, dead2 = s2.hp.p2 <= 0;
        if (dead1 || dead2) { const winner = dead1 && dead2 ? 'tie' : dead1 ? 'p2' : 'p1'; await api.win(s2, winner, { scores: { p1: s2.hp.p1, p2: s2.hp.p2 } }).catch(() => {}); }
        else await api.commit(s2, api.op).catch(() => {});
        busy = false;
      }
      // input
      st.cv.addEventListener('pointerdown', e => { if (!api.myTurn() || anim || busy) return; st.cv.setPointerCapture(e.pointerId); const p = st.pt(e); aim = { x0: p.x, y0: p.y, x: p.x, y: p.y }; });
      st.cv.addEventListener('pointermove', e => { if (!aim) return; const p = st.pt(e); aim.x = p.x; aim.y = p.y; const v = aimVec(); api.live.send(v && v.pow > 0 ? { a: [Math.round(v.vx), Math.round(v.vy), Math.round(v.pow * 100), v.ang] } : null); });
      const up = () => { if (!aim) return; const v = aimVec(); aim = null; if (v && v.pow > .06) fire(v.vx, v.vy); else api.live.send(null); };
      function aimFor(seat) { if (seat === api.me) { const v = aimVec(); return aim && v && v.pow > 0 ? v : null; } return oppAim && api.g().turn === seat && !anim ? { vx: oppAim[0], vy: oppAim[1] } : null; }
      st.cv.addEventListener('pointerup', up); st.cv.addEventListener('pointercancel', () => { aim = null; api.live.send(null); });
      function aimVec() { if (!aim) return null; let dx = aim.x0 - aim.x, dy = aim.y0 - aim.y; const len = Math.hypot(dx, dy); const pow = Math.min(1, len / 170); if (len < 1) return { pow: 0 }; const sp = FIGHT[theme].speed * pow; return { vx: dx / len * sp, vy: dy / len * sp, pow, ang: Math.round(Math.atan2(-dy, Math.abs(dx)) * 180 / Math.PI) }; }

      // drawing
      function drawScene(dt) {
        tPhase += dt; const { g, W, ground, feet } = V;
        nightSky(ctx, FW, FH, g.seed, theme === 'snow' ? '#1b2340' : '#1d1230', theme === 'snow' ? '#3b4a72' : theme === 'pirates' ? '#2a2d55' : '#3a2350');
        ctx.fillStyle = '#ffe4a8'; ctx.globalAlpha = .9; ctx.beginPath(); ctx.arc(FW - 70, 60, 20, 0, 7); ctx.fill(); ctx.globalAlpha = 1;
        // ground
        if (W.sea == null) {
          ctx.beginPath(); ctx.moveTo(0, FH); for (let x = 0; x <= FW; x += 2) ctx.lineTo(x, ground[x]); ctx.lineTo(FW, FH); ctx.closePath();
          const gg = ctx.createLinearGradient(0, FH * .4, 0, FH);
          if (theme === 'snow') { gg.addColorStop(0, '#eaf1fb'); gg.addColorStop(1, '#a9b9d6'); }
          else if (theme === 'tanks') { gg.addColorStop(0, '#5b3f4f'); gg.addColorStop(1, '#2a1b2c'); }
          else { gg.addColorStop(0, '#3d2b52'); gg.addColorStop(1, '#1d1229'); }
          ctx.fillStyle = gg; ctx.fill();
          ctx.strokeStyle = theme === 'snow' ? '#ffffff' : theme === 'tanks' ? '#a0707a' : '#7fb08a'; ctx.lineWidth = 3; ctx.beginPath(); for (let x = 0; x <= FW; x += 2) x ? ctx.lineTo(x, ground[x]) : ctx.moveTo(x, ground[x]); ctx.stroke();
          for (const w of W.walls) { const gy = ground[clamp(Math.round(w.x + w.w / 2), 0, FW)]; ctx.fillStyle = '#dfe9f7'; rr(ctx, w.x, gy - w.h, w.w, w.h + 4, 5); ctx.fill(); ctx.strokeStyle = '#9fb3d1'; ctx.lineWidth = 1.5; ctx.stroke(); }
        } else {
          const sea = W.sea; const sg = ctx.createLinearGradient(0, sea - 10, 0, FH); sg.addColorStop(0, '#2c4a7a'); sg.addColorStop(1, '#141c38'); ctx.fillStyle = sg;
          ctx.beginPath(); ctx.moveTo(0, FH); for (let x = 0; x <= FW; x += 8) ctx.lineTo(x, sea + Math.sin(x / 30 + tPhase * 2) * 4); ctx.lineTo(FW, FH); ctx.fill();
          ctx.strokeStyle = 'rgba(159,211,255,.5)'; ctx.lineWidth = 2; ctx.beginPath(); for (let x = 0; x <= FW; x += 8) x ? ctx.lineTo(x, sea + Math.sin(x / 30 + tPhase * 2) * 4) : ctx.moveTo(x, sea); ctx.stroke();
        }
        // stuck arrows
        if (theme === 'archery') for (const [x, y, a] of g.state.marks || []) { ctx.save(); ctx.translate(x, y); ctx.rotate(a); ctx.strokeStyle = '#e9d3b0'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(-26, 0); ctx.lineTo(0, 0); ctx.stroke(); ctx.fillStyle = '#ff8fab'; ctx.fillRect(-28, -3, 6, 6); ctx.restore(); }
        // ghost of my last shot
        if (ghost && api.myTurn()) { ctx.fillStyle = 'rgba(255,211,222,.25)'; for (let i = 0; i < ghost.length; i += 3) { ctx.beginPath(); ctx.arc(ghost[i][0], ghost[i][1], 1.6, 0, 7); ctx.fill(); } }
        for (const s of ['p1', 'p2']) drawFighter(s, W.pos[s], feet[s], g);
        // aim preview
        const v = aimVec();
        if (aim && v && v.pow > 0) {
          const [mx, my] = muzzle(theme, W.pos[api.me], feet[api.me], api.me);
          let x = mx, y = my, vx = v.vx, vy = v.vy; ctx.fillStyle = '#ffd3de';
          for (let i = 0; i < 60; i++) { vy += FIGHT[theme].grav / 120; x += vx / 120; y += vy / 120; if (i % 4 === 0) { ctx.globalAlpha = 1 - i / 60; ctx.beginPath(); ctx.arc(x, y, 2.6, 0, 7); ctx.fill(); } }
          ctx.globalAlpha = 1;
          txt(ctx, `${Math.round(v.pow * 100)}%  ·  ${v.ang}°`, mx, my - 70, 16, '#ffe4a8');
        }
        if (oppAim && g.turn === api.op && !anim && g.status === 'active') {
          const [mx, my] = muzzle(theme, W.pos[api.op], feet[api.op], api.op);
          let x = mx, y = my, vx = oppAim[0], vy = oppAim[1]; ctx.fillStyle = SEATCOL[api.op];
          for (let i = 0; i < 60; i++) { vy += FIGHT[theme].grav / 120; x += vx / 120; y += vy / 120; if (i % 4 === 0) { ctx.globalAlpha = (1 - i / 60) * .9; ctx.beginPath(); ctx.arc(x, y, 2.6, 0, 7); ctx.fill(); } }
          ctx.globalAlpha = 1; txt(ctx, `${nm(api.op)} aiming · ${oppAim[2]}% · ${oppAim[3]}°`, mx, my - 70, 14, SEATCOL[api.op]);
        }
        // projectile
        if (anim) {
          const step = 2; anim.i = Math.min(anim.path.length - 1, anim.i + Math.max(1, Math.round(dt * 60 * step / 2 * 2)));
          const [x, y] = anim.path[anim.i]; const [px, py] = anim.path[Math.max(0, anim.i - 1)];
          ctx.save(); ctx.translate(x, y); ctx.rotate(Math.atan2(y - py, x - px));
          if (theme === 'archery') { ctx.strokeStyle = '#f3e3c8'; ctx.lineWidth = 2.2; ctx.beginPath(); ctx.moveTo(-22, 0); ctx.lineTo(4, 0); ctx.stroke(); ctx.fillStyle = '#d7dce8'; ctx.beginPath(); ctx.moveTo(7, 0); ctx.lineTo(1, -3.5); ctx.lineTo(1, 3.5); ctx.fill(); ctx.fillStyle = SEATCOL[anim.shot.by]; ctx.fillRect(-24, -3, 6, 6); }
          else if (theme === 'snow') { ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(0, 0, 6, 0, 7); ctx.fill(); }
          else { ctx.fillStyle = theme === 'tanks' ? '#ffcf8a' : '#1a1a22'; ctx.strokeStyle = '#ffe4a8'; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.arc(0, 0, theme === 'tanks' ? 5 : 6.5, 0, 7); ctx.fill(); ctx.stroke(); }
          ctx.restore();
          if (anim.i >= anim.path.length - 1) { const a = anim; anim = null; land(a); V = view(); if (a.shot.by === api.me) ghost = a.path; a.done && a.done(); setTimeout(() => api.status(null), 50); }
        }
        if (theme === 'snow') { ctx.fillStyle = 'rgba(255,255,255,.7)'; for (const f of snowflakes) { f.y += f.v * dt; f.x += Math.sin(tPhase + f.v) * .3; if (f.y > FH) { f.y = -4; f.x = Math.random() * FW; } ctx.fillRect(f.x, f.y, 2, 2); } }
        F.step(dt); F.draw(ctx);
        // wind sock
        const wnow = windAt(g.seed, g.state.shots.length);
        txt(ctx, 'WIND', FW / 2, 22, 11, '#bea8c1'); ctx.strokeStyle = '#ffe4a8'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(FW / 2 - wnow * 40, 40); ctx.lineTo(FW / 2 + wnow * 40, 40); ctx.stroke();
        if (Math.abs(wnow) > .05) { const d = Math.sign(wnow); ctx.fillStyle = '#ffe4a8'; ctx.beginPath(); ctx.moveTo(FW / 2 + wnow * 40 + d * 8, 40); ctx.lineTo(FW / 2 + wnow * 40, 34); ctx.lineTo(FW / 2 + wnow * 40, 46); ctx.fill(); }
        if (api.myTurn() && !anim && !aim && !busy && g.status === 'active') { ctx.globalAlpha = .5 + .5 * Math.sin(tPhase * 4); txt(ctx, 'Your shot: drag back & release', FW / 2, 70, 16, '#ffd3de'); ctx.globalAlpha = 1; }
      }
      function hpBar(x, y, hp, seat) { ctx.fillStyle = 'rgba(20,10,28,.7)'; rr(ctx, x - 30, y, 60, 9, 4); ctx.fill(); ctx.fillStyle = hp > 50 ? '#7fe0b6' : hp > 25 ? '#f6c56c' : '#ff6b7f'; rr(ctx, x - 29, y + 1, 58 * hp / 100, 7, 3); ctx.fill(); txt(ctx, String(hp), x, y - 9, 12, SEATCOL[seat]); }
      function drawFighter(seat, x, y, g) {
        const dir = seat === 'p1' ? 1 : -1; const c = SEATCOL[seat]; const hp = shownHp[seat];
        const bob = theme === 'pirates' ? Math.sin(tPhase * 1.6 + (seat === 'p1' ? 0 : 2)) * 3 : 0; y += bob;
        ctx.lineCap = 'round'; ctx.lineJoin = 'round';
        if (theme === 'tanks') {
          ctx.fillStyle = '#2b2236'; rr(ctx, x - 25, y - 9, 50, 10, 5); ctx.fill();
          for (let i = -18; i <= 18; i += 9) { ctx.fillStyle = '#4a3e58'; ctx.beginPath(); ctx.arc(x + i, y - 4, 3.5, 0, 7); ctx.fill(); }
          ctx.fillStyle = c; rr(ctx, x - 21, y - 21, 42, 13, 5); ctx.fill(); ctx.beginPath(); ctx.arc(x, y - 22, 10, Math.PI, 0); ctx.fill();
          let a = seat === 'p1' ? -0.6 : -Math.PI + .6; const v = aimFor(seat); if (v) a = Math.atan2(v.vy, v.vx);
          ctx.strokeStyle = c; ctx.lineWidth = 5; ctx.beginPath(); ctx.moveTo(x, y - 24); ctx.lineTo(x + Math.cos(a) * 24, y - 24 + Math.sin(a) * 24); ctx.stroke();
          txt(ctx, em(seat), x, y - 15, 11); hpBar(x, y - 58, hp, seat); return;
        }
        if (theme === 'pirates') {
          ctx.fillStyle = '#5a3a2c'; ctx.beginPath(); ctx.moveTo(x - 50, y - 30); ctx.lineTo(x + 50, y - 30); ctx.lineTo(x + 38, y); ctx.lineTo(x - 38, y); ctx.closePath(); ctx.fill();
          ctx.fillStyle = '#7a5440'; ctx.fillRect(x - 50, y - 34, 100, 6);
          ctx.fillStyle = '#20141a'; for (let i = -24; i <= 24; i += 24) { ctx.beginPath(); ctx.arc(x + i, y - 18, 4, 0, 7); ctx.fill(); }
          ctx.strokeStyle = '#3a2420'; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(x - dir * 8, y - 34); ctx.lineTo(x - dir * 8, y - 110); ctx.stroke();
          ctx.fillStyle = c; ctx.beginPath(); ctx.moveTo(x - dir * 8, y - 106); ctx.quadraticCurveTo(x + dir * 30, y - 80, x - dir * 8, y - 48); ctx.closePath(); ctx.fill();
          ctx.fillStyle = '#1b1220'; ctx.fillRect(x + dir * 22, y - 34, dir * 18, 7);
          txt(ctx, em(seat), x, y - 64, 20); hpBar(x, y - 132, hp, seat); return;
        }
        // archer / snowball kid
        const head = y - 57;
        ctx.strokeStyle = c; ctx.lineWidth = 4;
        ctx.beginPath(); ctx.moveTo(x, y - 46); ctx.lineTo(x, y - 20); ctx.moveTo(x, y - 20); ctx.lineTo(x - 8, y); ctx.moveTo(x, y - 20); ctx.lineTo(x + 8, y); ctx.stroke();
        let a = dir > 0 ? -0.5 : -Math.PI + .5; const v = aimFor(seat); if (v) a = Math.atan2(v.vy, v.vx);
        const hx = x + Math.cos(a) * 18, hy = y - 40 + Math.sin(a) * 18;
        ctx.beginPath(); ctx.moveTo(x, y - 40); ctx.lineTo(hx, hy); ctx.stroke();
        if (theme === 'archery') { ctx.strokeStyle = '#e9d3b0'; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.arc(hx - Math.cos(a) * 4, hy - Math.sin(a) * 4, 14, a - 1.2, a + 1.2); ctx.stroke(); }
        else { ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(hx, hy, 5, 0, 7); ctx.fill(); ctx.fillStyle = c; ctx.fillRect(x - 8, y - 46, 16, 5); }
        ctx.fillStyle = '#2a1c38'; ctx.beginPath(); ctx.arc(x, head, 11, 0, 7); ctx.fill(); ctx.strokeStyle = c; ctx.lineWidth = 2.5; ctx.stroke();
        txt(ctx, em(seat), x, head + 1, 13);
        if (theme === 'snow') { ctx.fillStyle = c; ctx.beginPath(); ctx.arc(x, head - 9, 8, Math.PI, 0); ctx.fill(); ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(x, head - 18, 3, 0, 7); ctx.fill(); }
        hpBar(x, y - 92, hp, seat);
      }
      const stop = loop(dt => drawScene(dt));
      return {
        update(g) {
          if (g.state.shots.length > seen && !anim) {
            const i = seen; seen = g.state.shots.length; const shot = g.state.shots[i];
            const pre = { craters: g.state.craters.slice(0, countCraters(g.state.shots.slice(0, i))) };
            playShot(shot, pre, () => { shownHp = clone(api.g().state.hp); api.seenSet('shots', seen); });
            if (shot.by === api.op) sfx('pop');
            api.status(`${nm(shot.by)} is firing…`);
          } else if (!anim) { V = view(); shownHp = clone(g.state.hp); }
          if (g.status === 'done') tip.hidden = true;
        },
        destroy() { stop(); st.destroy(); offLive(); },
      };
    },
  };
}
fightGame('archery', 'archery', { name: 'Archery Duel', icon: '🏹', tint: '#ff8fab', blurb: 'Take turns firing arrows across the valley. Headshots hurt.', how: 'Each of you stands on a hill. On your turn, drag back and let go to loose an arrow. Wind changes every shot. A body hit takes 22 health, a headshot 40. First to drop the other to zero wins.' });
fightGame('tanks', 'tanks', { name: 'Tank Wars', icon: '💥', tint: '#ffb15c', blurb: 'Lob shells over the hills. The ground breaks where they land.', how: 'Drag back and release to fire a shell. Explosions damage anything nearby, you included, and blow craters in the ground that change the next shots. Last tank standing wins.' });
fightGame('snowball', 'snow', { name: 'Snowball Fight', icon: '❄️', tint: '#91b8ff', blurb: 'Lob snowballs over the forts. A cosy fight with real aim.', how: 'You each hide behind a little snow fort. Drag back and release to lob a snowball over it. Head hits count 30, body hits 18. First to 0 loses.' });
fightGame('pirates', 'pirates', { name: 'Pirate Cannons', icon: '🏴‍☠️', tint: '#7fe0b6', blurb: 'Two ships on a rolling sea. Fire broadsides until one sinks.', how: 'Drag back and release to fire your cannon. Hitting the hull does 24 damage; hitting the captain on deck does 38. Misses splash into the sea. Sink the other ship to win.' });

// ================= Battleship =================
const BS_N = 8, BS_SHIPS = [4, 3, 3, 2, 2];
function bsRandomFleet() {
  for (let tries = 0; tries < 500; tries++) {
    const taken = new Set(); const fleet = []; let ok = true;
    for (const len of BS_SHIPS) {
      let placed = false;
      for (let t = 0; t < 200 && !placed; t++) {
        const hz = Math.random() < .5; const r = Math.floor(Math.random() * (hz ? BS_N : BS_N - len + 1)); const c = Math.floor(Math.random() * (hz ? BS_N - len + 1 : BS_N));
        const cells = Array.from({ length: len }, (_, i) => hz ? r * BS_N + c + i : (r + i) * BS_N + c);
        // keep a one-cell gap between ships
        const near = cells.some(i => { const rr_ = Math.floor(i / BS_N), cc = i % BS_N; for (let dr = -1; dr <= 1; dr++) for (let dc = -1; dc <= 1; dc++) { const r2 = rr_ + dr, c2 = cc + dc; if (r2 >= 0 && r2 < BS_N && c2 >= 0 && c2 < BS_N && taken.has(r2 * BS_N + c2)) return true; } return false; });
        if (!near) { cells.forEach(i => taken.add(i)); fleet.push(cells); placed = true; }
      }
      if (!placed) { ok = false; break; }
    }
    if (ok) return fleet;
  }
  return [];
}
GAMES.battleship = {
  id: 'battleship', cat: 'fight', name: 'Battleship', icon: '🚢', tint: '#91b8ff',
  blurb: 'Hide your fleet, hunt theirs. A hit lets you fire again.',
  how: 'Shuffle your fleet until you like it, then tap Ready. Take turns firing at the other grid. A hit lets you fire again; a miss passes the turn. Sink all 5 ships first to win.',
  init: (seed, first) => ({ state: { fleet: {}, ready: {}, shots: { p1: [], p2: [] } }, turn: null }),
  needs: (g, s) => g.status === 'active' && (!g.state.ready || !g.state.ready[s] || g.turn === s),
  line: (g, s) => { const r = g.state.ready || {}; if (!r[s]) return 'Place your fleet'; if (!r[other(s)]) return `${nm(other(s))} is placing ships`; return null; },
  side: (g, s) => { const f = g.state.fleet && g.state.fleet[s]; if (!f) return 'placing…'; const hits = new Set(g.state.shots[other(s)] || []); const sunk = f.filter(sh => sh.every(c => hits.has(c))).length; return `${f.length - sunk} ships afloat`; },
  create(el, api) {
    const box = h('div', { style: 'display:flex;flex-direction:column;gap:12px' }); el.append(box);
    let draft = null; let turnSet = false;
    const grid = (cells, size) => { const b = h('div', { class: 'board', style: `grid-template-columns:repeat(${BS_N},1fr);max-width:${size}px;gap:3px` }); cells.forEach(c => b.append(c)); return b; };
    function render(g) {
      const S_ = g.state; const meR = S_.ready && S_.ready[api.me]; const opR = S_.ready && S_.ready[api.op];
      box.replaceChildren();
      if (!meR && g.status === 'active') {
        if (!draft) draft = bsRandomFleet();
        const set = new Set(draft.flat());
        box.append(h('p', { class: 'muted', style: 'text-align:center' }, 'Your fleet: 4, 3, 3, 2 and 2 long. Shuffle until you like it.'),
          grid(Array.from({ length: BS_N * BS_N }, (_, i) => h('div', { class: 'cell', style: `background:${set.has(i) ? '#91b8ff' : '#20304f'}` })), 340),
          h('div', { class: 'gfoot' }, h('button', { class: 'btn ghost', onclick: () => { draft = bsRandomFleet(); sfx('tap'); render(api.g()); } }, 'Shuffle'),
            h('button', { class: 'btn', onclick: async () => { const f = draft; await api.patch({ state: { fleet: { [api.me]: f }, ready: { [api.me]: true } } }); const g2 = api.g(); if (g2.state.ready && g2.state.ready[api.op] && !g2.turn) await api.patch({ turn: g2.first || 'p1' }); } }, 'Ready')));
        return;
      }
      if (meR && opR && !g.turn && g.status === 'active' && !turnSet) { turnSet = true; api.patch({ turn: g.first || 'p1' }).catch(() => { turnSet = false; }); }
      const myShots = new Set(S_.shots[api.me] || []); const theirShots = new Set(S_.shots[api.op] || []);
      const theirList = S_.shots[api.op] || []; const seenN = +(api.seenGet('bs') ?? 0); const newShots = new Set(theirList.slice(seenN));
      if (newShots.size) { api.seenSet('bs', theirList.length); const hits = [...newShots].filter(i => (S_.fleet[api.me] || []).flat().includes(i)).length; sfx(hits ? 'boom' : 'pop'); toast(`${nm(api.op)} fired ${newShots.size} shot${newShots.size > 1 ? 's' : ''}${hits ? ` · ${hits} hit${hits > 1 ? 's' : ''}` : ' · all missed'}`); }
      const opFleet = (S_.fleet && S_.fleet[api.op]) || []; const opSet = new Set(opFleet.flat());
      const myFleet = (S_.fleet && S_.fleet[api.me]) || []; const mySet = new Set(myFleet.flat());
      const sunkCells = new Set(opFleet.filter(sh => sh.every(c => myShots.has(c))).flat());
      const canFire = api.myTurn() && opR;
      const target = grid(Array.from({ length: BS_N * BS_N }, (_, i) => {
        const shot = myShots.has(i); const hit = shot && opSet.has(i);
        const showAll = g.status === 'done';
        return h('button', { class: 'cell' + (i === (S_.shots[api.me] || []).slice(-1)[0] ? ' popin' : ''), 'aria-label': `Row ${Math.floor(i / BS_N) + 1} column ${i % BS_N + 1}`, style: `background:${sunkCells.has(i) ? '#e45f80' : hit ? '#ff8fab' : shot ? '#2a3a5c' : showAll && opSet.has(i) ? '#4a5f8a' : '#1c2a47'};font-size:16px`, disabled: !canFire || shot ? true : null,
          onclick: async () => {
            const s2 = clone(api.g().state); s2.shots[api.me] = [...(s2.shots[api.me] || []), i];
            const isHit = opSet.has(i); const allHit = opFleet.flat().every(c => s2.shots[api.me].includes(c));
            if (isHit) { sfx('boom'); const sunkNow = opFleet.find(sh => sh.includes(i) && sh.every(c => s2.shots[api.me].includes(c))); toast(sunkNow ? `You sank a ${sunkNow.length}-ship!` : 'Hit! Fire again'); } else sfx('pop');
            if (allHit) await api.win(s2, api.me); else await api.commit(s2, isHit ? api.me : api.op);
          } }, hit ? '✸' : shot ? '·' : '');
      }), 360);
      const mine = grid(Array.from({ length: BS_N * BS_N }, (_, i) => {
        const shot = theirShots.has(i); const ship = mySet.has(i);
        return h('div', { class: 'cell' + (newShots.has(i) ? ' flash' : ''), style: `background:${ship ? (shot ? '#e45f80' : '#6f8fc4') : shot ? '#2a3a5c' : '#1c2a47'};border-radius:4px;font-size:10px;${newShots.has(i) ? 'box-shadow:0 0 0 2px #ffe4a8' : ''}` }, shot && ship ? '✸' : shot ? '·' : '');
      }), 200);
      box.append(h('div', { class: 'lbl', style: 'text-align:center' }, `${nm(api.op)}’s waters`), target,
        h('div', { class: 'lbl', style: 'text-align:center;margin-top:6px' }, 'Your fleet'), mine);
      if (!opR) box.prepend(h('p', { class: 'note', style: 'text-align:center' }, `Waiting for ${nm(api.op)} to place ships. You can come back later.`));
    }
    return { update: render, destroy() {} };
  },
};

// ================= Score duels: each plays solo, best attempt wins =================
function duelGame(id, meta, cfg) {
  const best = arr => !arr || !arr.length ? null : cfg.lower ? Math.min(...arr) : Math.max(...arr);
  const fmt = v => v == null ? '–' : cfg.fmt ? cfg.fmt(v) : String(v);
  const tr = (g, s) => (g.state.tries && g.state.tries[s]) || [];
  GAMES[id] = {
    id, cat: 'duel', ...meta,
    init: () => ({ state: { tries: { p1: [], p2: [] } }, turn: null }),
    needs: (g, s) => g.status === 'active' && tr(g, s).length < cfg.tries,
    line: (g, s) => { const a = tr(g, s).length, b = tr(g, other(s)).length; if (a < cfg.tries) return `Your go · ${a}/${cfg.tries} played` + (b ? ` · ${nm(other(s))} best ${fmt(best(tr(g, other(s))))}` : ''); return `${nm(other(s))} has ${cfg.tries - b} left · you ${fmt(best(tr(g, s)))}`; },
    side: (g, s) => tr(g, s).length ? `best ${fmt(best(tr(g, s)))}` : 'not played yet',
    mid: () => cfg.lower ? 'low wins' : 'high wins',
    create(el, api) {
      const view = h('div', { style: 'display:flex;flex-direction:column;gap:12px' }); el.append(view);
      let running = null; let oppPlay = null; let prevOpp;
      const offLive = api.live.on(o => { const p = o && o.play ? o : null; if (JSON.stringify(p) !== JSON.stringify(oppPlay)) { oppPlay = p; if (!running) lobby(api.g()); } });
      function lobby(g) {
        if (running) return;
        const side = s => { const arr = tr(g, s); return h('div', { class: 'dside ' + s }, h('div', { class: 'av ' + s }, em(s)), h('b', null, s === api.me ? 'You' : nm(s)), h('div', { class: 'big', style: `color:${SEATCOL[s]}` }, fmt(best(arr))), h('div', { class: 'tries' }, Array.from({ length: cfg.tries }, (_, i) => h('span', null, arr[i] != null ? fmt(arr[i]) : '·')))); };
        const left = cfg.tries - tr(g, api.me).length;
        view.replaceChildren(oppPlay ? h('div', { class: 'livebox' }, h('span', { class: 'livedot' }), `${nm(api.op)} is playing attempt ${oppPlay.play} right now · ${oppPlay.sc}`) : null, h('div', { class: 'duelbox' }, side(api.me), side(api.op)),
          g.status === 'active' && left > 0 ? h('button', { class: 'btn wide', onclick: start }, cfg.tries > 1 ? `Play attempt ${cfg.tries - left + 1} of ${cfg.tries}` : 'Play') : null,
          g.status === 'active' && left === 0 ? h('p', { class: 'note', style: 'text-align:center' }, `Your score is in. ${nm(api.op)} has ${cfg.tries - tr(g, api.op).length} attempt${cfg.tries - tr(g, api.op).length === 1 ? '' : 's'} left.`) : null,
          h('p', { class: 'muted', style: 'text-align:center;font-size:13.5px' }, cfg.tip || meta.how));
      }
      function start() {
        const g = api.g(); const n = tr(g, api.me).length;
        view.replaceChildren(); const host = h('div', { style: 'display:flex;flex-direction:column;gap:10px;align-items:stretch' }); view.append(host);
        api.status(cfg.tries > 1 ? `Attempt ${n + 1} of ${cfg.tries}` : 'Go!', true);
        window.duelLive = v => api.live.send({ play: n + 1, sc: String(v).slice(0, 40) });
        running = cfg.play(host, g.seed + ':' + n, async score => {
          window.duelLive = null; api.live.send(null);
          const r = running; running = null; setTimeout(() => r && r.destroy && r.destroy(), 0);
          score = Math.round(score);
          const arr = [...tr(api.g(), api.me), score];
          view.replaceChildren(h('div', { class: 'result' }, h('h3', null, fmt(score)), h('p', { class: 'muted' }, best(arr) === score && arr.length > 1 ? 'New best!' : 'Saved')));
          sfx('coin'); api.status(null);
          try { await api.patch({ state: { tries: { [api.me]: arr } } }); } catch { return; }
          await sleep(900); finishIfDone(true); lobby(api.g());
        });
      }
      function finishIfDone(mine) {
        const g = api.g(); if (!g || g.status !== 'active') return;
        const a = tr(g, 'p1'), b = tr(g, 'p2'); if (a.length < cfg.tries || b.length < cfg.tries) return;
        const ba = best(a), bb = best(b); const w = ba === bb ? 'tie' : (cfg.lower ? (ba < bb ? 'p1' : 'p2') : (ba > bb ? 'p1' : 'p2'));
        if (mine) api.finish(w, { scores: { p1: fmt(ba), p2: fmt(bb) } });
      }
      return {
        update(g) {
          const theirs = tr(g, api.op); const fr = api.fresh(g);
          if ((prevOpp !== undefined && theirs.length > prevOpp) || (prevOpp === undefined && fr && theirs.length)) { toast(`${nm(api.op)} scored ${fmt(theirs[theirs.length - 1])}`); sfx('pop'); }
          prevOpp = theirs.length; if (!running) lobby(g);
        },
        destroy() { running && running.destroy && running.destroy(); window.duelLive = null; offLive(); },
      };
    },
  };
}
function hud(ctx, W, left, right, mid) { window.duelLive && window.duelLive(left); txt(ctx, left, 16, 26, 20, '#ffd3de', 'left'); if (right) txt(ctx, right, W - 16, 26, 16, '#ffe4a8', 'right'); if (mid) txt(ctx, mid, W / 2, 26, 15, '#bea8c1'); }
function endOverlay(ctx, W, H, msg) { ctx.fillStyle = 'rgba(22,14,30,.72)'; ctx.fillRect(0, 0, W, H); txt(ctx, msg, W / 2, H / 2, 30, '#ffd3de', 'center', 'Shrikhand', 400); }

// ---------- Knife Hit ----------
duelGame('knife', { name: 'Knife Hit', icon: '🔪', tint: '#ff8fab', blurb: 'Throw knives into a spinning log. Hit a knife and you’re out.', how: 'Tap to throw. Land every knife to break the log and reach the next stage. Apples are worth an extra point. Touch another knife and the run ends. 3 attempts, best counts.' },
  { tries: 3, play(host, seed, done) {
    const W = 360, H = 600; const st = stage(host, W, H, { hFrac: .72 }); const ctx = st.ctx; const r = rng(seed); const F = fx();
    const C = { x: 180, y: 220, R: 74 }; let stg = 0, score = 0, knives = [], apples = [], left = 0, rot = 0, t = 0, fly = null, dead = null, brk = 0, pat = null, fin = false;
    const near = (a, b, d) => { let x = Math.abs(((a - b) % 6.283 + 6.283) % 6.283); x = Math.min(x, 6.283 - x); return x < d; };
    function next() { stg++; left = 5 + Math.min(5, stg); knives = []; apples = []; const pre = Math.min(5, stg - 1 + (stg > 2 ? 1 : 0)); for (let i = 0; i < pre; i++) { let a; do a = r() * 6.283; while (knives.some(k => near(k, a, .5))); knives.push(a); } if (r() < .75) { let a; do a = r() * 6.283; while (knives.some(k => near(k, a, .5))); apples.push(a); } pat = { base: 1.5 + stg * .22, wob: stg > 2 ? .5 + r() : 0, rev: stg > 3 && r() < .6, ph: r() * 6 }; }
    next();
    const speed = () => { let s = pat.base * (1 + pat.wob * Math.sin(t * 1.4 + pat.ph)); if (pat.rev && Math.sin(t * .6 + pat.ph) < 0) s = -s; return s; };
    const tap = () => { if (fly || dead || brk > 0 || left <= 0) return; fly = { y: 540 }; left--; sfx('whoosh'); };
    st.cv.addEventListener('pointerdown', tap);
    const stop = loop(dt => {
      t += dt; if (!dead) rot += speed() * dt;
      if (fly) { fly.y -= 1700 * dt; if (fly.y <= C.y + C.R) { const a = Math.PI / 2 - rot; if (knives.some(k => near(k, a, .21))) { dead = { y: C.y + C.R, vy: 200, vx: 140, rot: 0, t: 0 }; sfx('bad'); fly = null; } else { knives.push(a); score++; sfx('thud'); F.burst(C.x, C.y + C.R, '#e9c79a', 6, 90); const ai = apples.findIndex(p => near(p, a, .24)); if (ai >= 0) { apples.splice(ai, 1); score++; F.burst(C.x, C.y + C.R + 10, '#ff6b7f', 12, 140); F.text('+1 apple', C.x, C.y + C.R + 40, '#ff8fab', 16); sfx('coin'); } fly = null; if (left === 0) { brk = .7; F.burst(C.x, C.y, '#c48a5c', 30, 260); sfx('boom'); } } } }
      if (brk > 0) { brk -= dt; if (brk <= 0) { next(); F.text('Stage ' + stg, W / 2, 420, '#ffe4a8', 24); } }
      if (dead) { dead.t += dt; dead.vy += 900 * dt; dead.y += dead.vy * dt; dead.rot += 8 * dt; if (dead.t > 1.1 && !fin) { fin = true; done(score); } }
      F.step(dt);
      // draw
      nightSky(ctx, W, H, 'knife');
      if (brk <= 0) {
        ctx.save(); ctx.translate(C.x, C.y); ctx.rotate(rot);
        for (const k of knives) { ctx.save(); ctx.rotate(k); knife(ctx, C.R - 18); ctx.restore(); }
        for (const a of apples) { ctx.save(); ctx.rotate(a); ctx.translate(C.R + 12, 0); ctx.rotate(Math.PI / 2); txt(ctx, '🍎', 0, 0, 24); ctx.restore(); }
        const g = ctx.createRadialGradient(0, 0, 10, 0, 0, C.R); g.addColorStop(0, '#d9a476'); g.addColorStop(1, '#8a5638'); ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, 0, C.R, 0, 7); ctx.fill();
        ctx.strokeStyle = 'rgba(90,50,30,.5)'; ctx.lineWidth = 2; for (let i = 1; i < 4; i++) { ctx.beginPath(); ctx.arc(0, 0, C.R * i / 4, 0, 7); ctx.stroke(); }
        ctx.restore();
      }
      if (fly) { ctx.save(); ctx.translate(C.x, fly.y); ctx.rotate(-Math.PI / 2); knife(ctx, 0); ctx.restore(); }
      if (dead) { ctx.save(); ctx.translate(C.x + dead.vx * dead.t, dead.y); ctx.rotate(-Math.PI / 2 + dead.rot); knife(ctx, 0); ctx.restore(); }
      if (!fly && !dead && left > 0) { ctx.save(); ctx.translate(C.x, 540); ctx.rotate(-Math.PI / 2); knife(ctx, 0); ctx.restore(); }
      for (let i = 0; i < left; i++) { ctx.fillStyle = '#ffd3de'; ctx.globalAlpha = .8; rr(ctx, 18, H - 30 - i * 18, 8, 13, 2); ctx.fill(); }
      ctx.globalAlpha = 1; F.draw(ctx);
      hud(ctx, W, String(score), 'Stage ' + stg);
      if (dead) endOverlay(ctx, W, H, 'Clang!');
    });
    function knife(c, off) { c.fillStyle = '#e8ecf5'; c.beginPath(); c.moveTo(off, -4); c.lineTo(off + 34, -4); c.lineTo(off + 44, 0); c.lineTo(off + 34, 4); c.lineTo(off, 4); c.fill(); c.fillStyle = '#3a2850'; rr(c, off - 30, -5, 30, 10, 3); c.fill(); c.fillStyle = '#f6c56c'; c.fillRect(off - 3, -7, 4, 14); }
    return { destroy() { stop(); st.destroy(); } };
  } });

// ---------- Stack Tower ----------
duelGame('stack', { name: 'Stack Tower', icon: '🧱', tint: '#f6c56c', blurb: 'Tap to drop each slab. Overhangs get sliced off.', how: 'A slab slides back and forth. Tap to drop it on the tower. Whatever hangs over the edge is cut off, so the tower gets narrower. Perfect drops keep the full width. 3 attempts, highest tower wins.' },
  { tries: 3, fmt: v => v + ' fl', play(host, seed, done) {
    const W = 360, H = 600, BH = 24; const st = stage(host, W, H, { hFrac: .72 }); const ctx = st.ctx; const F = fx(); const r = rng(seed);
    const tower = [{ x: 90, w: 180 }]; let cur = { x: -180, w: 180, dir: 1 }, cam = 0, over = false, combo = 0, falling = [], t = 0;
    const speed = () => 150 + tower.length * 9;
    const color = i => `hsl(${(340 + i * 9) % 360},78%,${68 - (i % 3) * 4}%)`;
    st.cv.addEventListener('pointerdown', () => {
      if (over) return; const last = tower[tower.length - 1];
      const L = Math.max(cur.x, last.x), R = Math.min(cur.x + cur.w, last.x + last.w);
      if (R - L <= 0) { over = true; falling.push({ ...cur, y: H - 60 - tower.length * BH + cam, vy: 0 }); sfx('bad'); setTimeout(() => done(tower.length - 1), 1100); return; }
      if (Math.abs(cur.x - last.x) < 5) { cur.x = last.x; combo++; sfx('coin'); F.text(combo > 1 ? 'Perfect x' + combo : 'Perfect', W / 2, 140, '#ffe4a8', 20); }
      else { combo = 0; sfx('thud'); const cutL = cur.x < L ? { x: cur.x, w: L - cur.x } : { x: R, w: cur.x + cur.w - R }; falling.push({ ...cutL, y: H - 60 - tower.length * BH + cam, vy: 0, c: tower.length }); cur.x = L; cur.w = R - L; }
      tower.push({ x: cur.x, w: cur.w });
      cur = { x: r() < .5 ? -cur.w : W, w: cur.w, dir: 0 }; cur.dir = cur.x < 0 ? 1 : -1;
    });
    const stop = loop(dt => {
      t += dt; if (!over) { cur.x += cur.dir * speed() * dt; if (cur.x > W) cur.dir = -1; if (cur.x + cur.w < 0) cur.dir = 1; }
      const target = Math.max(0, (tower.length - 14) * BH); cam += (target - cam) * Math.min(1, dt * 5);
      for (const f of falling) { f.vy += 1200 * dt; f.y += f.vy * dt; }
      F.step(dt);
      const g = ctx.createLinearGradient(0, 0, 0, H); g.addColorStop(0, `hsl(${280 - tower.length * 2},45%,16%)`); g.addColorStop(1, '#3a2350'); ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
      tower.forEach((b, i) => { const y = H - 60 - i * BH + cam; if (y < -BH || y > H) return; ctx.fillStyle = color(i); rr(ctx, b.x, y - BH, b.w, BH - 2, 4); ctx.fill(); ctx.fillStyle = 'rgba(255,255,255,.18)'; ctx.fillRect(b.x + 2, y - BH + 2, b.w - 4, 4); });
      if (!over) { const y = H - 60 - tower.length * BH + cam; ctx.fillStyle = color(tower.length); rr(ctx, cur.x, y - BH, cur.w, BH - 2, 4); ctx.fill(); }
      for (const f of falling) { ctx.fillStyle = color(f.c || tower.length); ctx.globalAlpha = .8; rr(ctx, f.x, f.y - BH, f.w, BH - 2, 4); ctx.fill(); ctx.globalAlpha = 1; }
      F.draw(ctx); hud(ctx, W, String(tower.length - 1), 'floors');
      if (over) endOverlay(ctx, W, H, (tower.length - 1) + ' floors');
    });
    return { destroy() { stop(); st.destroy(); } };
  } });

// ---------- Flappy Heart ----------
duelGame('flappy', { name: 'Flappy Heart', icon: '💗', tint: '#ff8fab', blurb: 'Tap to flutter a little heart between the lamp posts.', how: 'Tap to flap. Fly through the gaps between the lamp posts; each one you pass is a point. Touch a post, the roof or the street and the run ends. 3 attempts.' },
  { tries: 3, play(host, seed, done) {
    const W = 360, H = 600; const st = stage(host, W, H, { hFrac: .72 }); const ctx = st.ctx; const r = rng(seed); const F = fx();
    let y = 280, vy = 0, started = false, over = false, score = 0, t = 0, pipes = [], dist = 0;
    const gap = () => Math.max(132, 175 - score * 2);
    const flap = () => { if (over) return; started = true; vy = -400; sfx('tap'); };
    st.cv.addEventListener('pointerdown', flap);
    const kd = e => { if (e.code === 'Space') { e.preventDefault(); flap(); } }; addEventListener('keydown', kd);
    const stop = loop(dt => {
      t += dt;
      if (started && !over) {
        vy += 1300 * dt; y += vy * dt; dist += 150 * dt;
        if (!pipes.length || pipes[pipes.length - 1].x < W - 200) pipes.push({ x: W + 30, gy: 140 + r() * 260, g: gap(), pass: false });
        for (const p of pipes) { p.x -= 150 * dt; if (!p.pass && p.x + 26 < 90) { p.pass = true; score++; sfx('coin'); } }
        pipes = pipes.filter(p => p.x > -60);
        const hit = y < 0 || y > H - 50 || pipes.some(p => 90 + 14 > p.x - 26 && 90 - 14 < p.x + 26 && (y - 12 < p.gy - p.g / 2 || y + 12 > p.gy + p.g / 2));
        if (hit) { over = true; sfx('bad'); F.burst(90, y, '#ff8fab', 22, 180); setTimeout(() => done(score), 1000); }
      } else if (!started) y = 280 + Math.sin(t * 3) * 8;
      F.step(dt);
      nightSky(ctx, W, H, 'flappy', '#1d1230', '#43275a');
      ctx.fillStyle = '#140c1c'; for (let i = 0; i < 9; i++) { const bx = ((i * 70 - dist * .3) % (W + 70) + W + 70) % (W + 70) - 70; const bh = 60 + (i * 37) % 90; ctx.fillRect(bx, H - 50 - bh, 56, bh); }
      ctx.fillStyle = '#0e0814'; ctx.fillRect(0, H - 50, W, 50);
      for (const p of pipes) {
        for (const [y0, y1] of [[0, p.gy - p.g / 2], [p.gy + p.g / 2, H - 50]]) { ctx.fillStyle = '#2c1d3b'; ctx.fillRect(p.x - 10, y0, 20, y1 - y0); ctx.fillStyle = '#4a3463'; rr(ctx, p.x - 26, y0 === 0 ? y1 - 16 : y0, 52, 16, 6); ctx.fill(); ctx.fillStyle = 'rgba(255,228,168,.9)'; ctx.beginPath(); ctx.arc(p.x, y0 === 0 ? y1 + 3 : y0 - 3, 6, 0, 7); ctx.fill(); }
      }
      ctx.save(); ctx.translate(90, y); ctx.rotate(clamp(vy / 900, -.5, .8)); txt(ctx, '💗', 0, 0, 30); ctx.restore();
      F.draw(ctx); hud(ctx, W, String(score)); if (!started) txt(ctx, 'Tap to start', W / 2, 200, 20, '#ffd3de');
      if (over) endOverlay(ctx, W, H, score + ' points');
    });
    return { destroy() { stop(); st.destroy(); removeEventListener('keydown', kd); } };
  } });

// ---------- Reaction Duel ----------
duelGame('reaction', { name: 'Reaction Duel', icon: '⚡', tint: '#f6c56c', blurb: 'Tap the instant the lamp turns gold. Fastest average wins.', how: 'Five rounds. Wait for the panel to turn gold, then tap as fast as you can. Tapping too early adds a 500 ms penalty for that round. Lowest average wins. 3 attempts.' },
  { tries: 3, lower: true, fmt: v => v + ' ms', play(host, seed, done) {
    const r = rng(seed); let round = 0, times = [], state = 'wait', t0 = 0, timer = null;
    const pad = h('button', { style: 'width:100%;height:min(56vh,420px);border-radius:26px;font-weight:900;font-size:26px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:8px;transition:background .08s' });
    const info = h('div', { class: 'playhud' }, h('span', null, 'Round 1 of 5'), h('span', { class: 'mono' }, ''));
    host.append(info, pad);
    function arm() { state = 'wait'; pad.style.background = '#2c1d3b'; pad.style.color = '#bea8c1'; pad.replaceChildren('Wait for gold…'); info.firstChild.textContent = `Round ${round + 1} of 5`; timer = setTimeout(() => { state = 'go'; t0 = performance.now(); pad.style.background = '#f6c56c'; pad.style.color = '#2e1d05'; pad.replaceChildren('TAP!'); }, 1100 + r() * 2600); }
    pad.addEventListener('pointerdown', () => {
      if (state === 'wait') { clearTimeout(timer); times.push(500); state = 'pause'; pad.style.background = '#e45f80'; pad.style.color = '#2b0d1b'; pad.replaceChildren('Too soon! +500 ms'); sfx('bad'); setTimeout(nextR, 900); }
      else if (state === 'go') { const ms = Math.round(performance.now() - t0); times.push(ms); state = 'pause'; pad.style.background = '#7fe0b6'; pad.style.color = '#0d2a1f'; pad.replaceChildren(ms + ' ms'); sfx('pop'); info.lastChild.textContent = times.join(' · '); window.duelLive && window.duelLive(`round ${times.length}/5 · avg ${Math.round(times.reduce((a, b) => a + b, 0) / times.length)} ms`); setTimeout(nextR, 800); }
    });
    function nextR() { round++; if (round >= 5) { done(times.reduce((a, b) => a + b, 0) / times.length); return; } arm(); }
    arm();
    return { destroy() { clearTimeout(timer); } };
  } });

// ---------- Memory Match ----------
duelGame('memory', { name: 'Memory Match', icon: '🃏', tint: '#91b8ff', blurb: 'Flip pairs. Fewest moves wins. Same layout for both of you.', how: 'Flip two cards at a time to find matching pairs. Each pair of flips is one move. Clear the board in as few moves as you can. You both get the same layouts. 2 attempts.' },
  { tries: 2, lower: true, fmt: v => v + ' moves', play(host, seed, done) {
    const r = rng(seed); const pool = shuffle(['🌙', '⭐', '🌸', '🍓', '🦋', '🍩', '🎀', '🌻', '🍒', '🐻', '☕', '🎈'], r).slice(0, 8);
    const deck = shuffle([...pool, ...pool], r); const open = [], gone = new Set(); let moves = 0, lock = false; const t0 = Date.now();
    const info = h('div', { class: 'playhud' }, h('span', null, 'Moves: 0'), h('span', { class: 'mono faint' }, ''));
    const grid = h('div', { class: 'board', style: 'grid-template-columns:repeat(4,1fr);max-width:380px;gap:8px' }); host.append(info, grid);
    const iv = setInterval(() => { info.lastChild.textContent = Math.floor((Date.now() - t0) / 1000) + 's'; }, 500);
    function draw() { grid.replaceChildren(...deck.map((e, i) => { const up = open.includes(i) || gone.has(i); return h('button', { class: 'cell', 'aria-label': up ? e : 'Hidden card', style: `font-size:30px;border-radius:14px;background:${gone.has(i) ? 'rgba(127,224,182,.15)' : up ? '#ffd3de' : 'linear-gradient(145deg,#4a3463,#2c1d3b)'};border:1.5px solid ${up ? '#ff8fab' : 'rgba(255,206,224,.15)'};transition:transform .15s`, onclick: () => flip(i) }, up ? e : ''); })); }
    function flip(i) {
      if (lock || open.includes(i) || gone.has(i)) return; open.push(i); sfx('tap'); draw();
      if (open.length === 2) { moves++; info.firstChild.textContent = 'Moves: ' + moves; window.duelLive && window.duelLive(moves + ' moves'); const [a, b] = open;
        if (deck[a] === deck[b]) { gone.add(a); gone.add(b); open.length = 0; sfx('coin'); draw(); if (gone.size === deck.length) { clearInterval(iv); setTimeout(() => done(moves), 500); } }
        else { lock = true; setTimeout(() => { open.length = 0; lock = false; draw(); }, 750); } }
    }
    draw(); return { destroy() { clearInterval(iv); } };
  } });

// ---------- 2048 Race ----------
duelGame('g2048', { name: '2048 Race', icon: '🔢', tint: '#ffb15c', blurb: 'Three minutes of merging tiles. Highest score wins.', how: 'Swipe (or use arrow keys) to slide the tiles. Matching tiles merge and add to your score. You have 3 minutes, and you both get the same tile drops. One attempt.' },
  { tries: 1, play(host, seed, done) {
    const r = rng(seed); let b = Array(16).fill(0), score = 0, end = Date.now() + 180000, over = false;
    const spawn = () => { const e = b.map((v, i) => v ? -1 : i).filter(i => i >= 0); if (!e.length) return; b[e[Math.floor(r() * e.length)]] = r() < .9 ? 2 : 4; };
    spawn(); spawn();
    const info = h('div', { class: 'playhud' }, h('span', null, 'Score 0'), h('span', { class: 'mono' }, '3:00'));
    const grid = h('div', { class: 'board', style: 'grid-template-columns:repeat(4,1fr);max-width:380px;gap:8px;padding:8px;background:#20152b;border-radius:18px;touch-action:none' });
    const stopBtn = h('button', { class: 'btn ghost small', style: 'align-self:center', onclick: () => finish() }, 'Stop and submit');
    host.append(info, grid, stopBtn);
    const col = v => ({ 0: '#2c1d3b', 2: '#4a3463', 4: '#5b3f74', 8: '#e45f80', 16: '#ff8fab', 32: '#ffb15c', 64: '#f6c56c', 128: '#ffe4a8', 256: '#7fe0b6', 512: '#91b8ff', 1024: '#c9a2ff', 2048: '#ffffff' }[v] || '#ffffff');
    function draw() { grid.replaceChildren(...b.map(v => h('div', { class: 'cell', style: `border-radius:12px;background:${col(v)};color:${v >= 8 ? '#2b0d1b' : '#f9eef3'};font-weight:900;font-size:${v >= 1024 ? 20 : v >= 128 ? 24 : 28}px` }, v || ''))); info.firstChild.textContent = 'Score ' + score; window.duelLive && window.duelLive(score); }
    function slide(dir) {
      if (over) return; let moved = false;
      for (let k = 0; k < 4; k++) {
        const idx = [0, 1, 2, 3].map(i => dir === 'left' ? k * 4 + i : dir === 'right' ? k * 4 + 3 - i : dir === 'up' ? i * 4 + k : (3 - i) * 4 + k);
        const vals = idx.map(i => b[i]).filter(v => v); const out = [];
        for (let i = 0; i < vals.length; i++) { if (vals[i] === vals[i + 1]) { out.push(vals[i] * 2); score += vals[i] * 2; i++; } else out.push(vals[i]); }
        while (out.length < 4) out.push(0);
        idx.forEach((i, j) => { if (b[i] !== out[j]) moved = true; b[i] = out[j]; });
      }
      if (moved) { spawn(); sfx('tap'); draw(); if (!canMove()) finish(); }
    }
    const canMove = () => b.some(v => !v) || b.some((v, i) => (i % 4 < 3 && v === b[i + 1]) || (i < 12 && v === b[i + 4]));
    function finish() { if (over) return; over = true; clearInterval(iv); removeEventListener('keydown', kd); done(score); }
    const iv = setInterval(() => { const s = Math.max(0, Math.ceil((end - Date.now()) / 1000)); info.lastChild.textContent = Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0'); if (s <= 0) finish(); }, 250);
    const kd = e => { const m = { ArrowLeft: 'left', ArrowRight: 'right', ArrowUp: 'up', ArrowDown: 'down' }[e.key]; if (m) { e.preventDefault(); slide(m); } }; addEventListener('keydown', kd);
    let sx = 0, sy = 0; grid.addEventListener('pointerdown', e => { sx = e.clientX; sy = e.clientY; }); grid.addEventListener('pointerup', e => { const dx = e.clientX - sx, dy = e.clientY - sy; if (Math.max(Math.abs(dx), Math.abs(dy)) < 24) return; slide(Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : (dy > 0 ? 'down' : 'up')); });
    draw(); return { destroy() { clearInterval(iv); removeEventListener('keydown', kd); } };
  } });

// ---------- Basketball ----------
duelGame('hoops', { name: 'Basketball Flick', icon: '🏀', tint: '#ffb15c', blurb: '30 seconds. Flick the ball into the hoop as many times as you can.', how: 'Swipe from the ball toward the hoop to shoot: the longer and faster the swipe, the harder the throw. The ball spawns in a new spot after each shot. 30 seconds, 3 attempts.' },
  { tries: 3, play(host, seed, done) {
    const W = 360, H = 600; const st = stage(host, W, H, { hFrac: .72 }); const ctx = st.ctx; const r = rng(seed); const F = fx();
    const RIM = { l: 238, r: 298, y: 210 }, BOARD = { x: 306, y0: 120, y1: 230 };
    let ball, score = 0, tLeft = 30, over = false, drag = null, started = false;
    const reset = () => { ball = { x: 50 + r() * 130, y: 470 + r() * 70, vx: 0, vy: 0, live: false, t: 0, scored: false, rad: 15 }; };
    reset();
    st.cv.addEventListener('pointerdown', e => { if (over || ball.live) return; const p = st.pt(e); drag = { x: p.x, y: p.y, t: performance.now(), cx: p.x, cy: p.y }; });
    st.cv.addEventListener('pointermove', e => { if (drag) { const p = st.pt(e); drag.cx = p.x; drag.cy = p.y; } });
    st.cv.addEventListener('pointerup', e => { if (!drag) return; const p = st.pt(e); const dx = p.x - drag.x, dy = p.y - drag.y; drag = null; if (Math.hypot(dx, dy) < 20) return; started = true; const k = 3.1; ball.vx = clamp(dx * k, -650, 650); ball.vy = clamp(dy * k, -1100, 0); ball.live = true; sfx('whoosh'); });
    const stop = loop(dt => {
      if (started && !over) { tLeft -= dt; if (tLeft <= 0) { tLeft = 0; over = true; sfx('win'); setTimeout(() => done(score), 900); } }
      if (ball.live) {
        const sub = 4; for (let s = 0; s < sub; s++) { const d = dt / sub;
          ball.vy += 1100 * d; const py = ball.y; ball.x += ball.vx * d; ball.y += ball.vy * d; ball.t += d;
          for (const rx of [RIM.l, RIM.r]) { const dx = ball.x - rx, dy = ball.y - RIM.y, dd = Math.hypot(dx, dy); if (dd < ball.rad + 3) { const nx = dx / dd, ny = dy / dd; const dot = ball.vx * nx + ball.vy * ny; if (dot < 0) { ball.vx -= 1.7 * dot * nx; ball.vy -= 1.7 * dot * ny; sfx('tap'); } ball.x = rx + nx * (ball.rad + 3); ball.y = RIM.y + ny * (ball.rad + 3); } }
          if (ball.x + ball.rad > BOARD.x && ball.y > BOARD.y0 && ball.y < BOARD.y1 && ball.vx > 0) { ball.vx = -ball.vx * .6; ball.x = BOARD.x - ball.rad; sfx('thud'); }
          if (!ball.scored && py < RIM.y && ball.y >= RIM.y && ball.x > RIM.l + 6 && ball.x < RIM.r - 6 && ball.vy > 0) { ball.scored = true; score++; sfx('coin'); F.burst(ball.x, RIM.y + 20, '#ffe4a8', 16, 140); F.text('+1', ball.x, RIM.y - 30, '#ffe4a8', 22); }
          if (ball.y > H - 30) { ball.y = H - 30; ball.vy *= -.45; ball.vx *= .7; }
        }
        if (ball.t > 2.4 || ball.x < -40 || ball.x > W + 40) reset();
      }
      F.step(dt);
      nightSky(ctx, W, H, 'hoops', '#1d1230', '#2c1d3b');
      ctx.fillStyle = '#3a2850'; ctx.fillRect(0, H - 30 + 15, W, 30);
      ctx.fillStyle = '#ffd3de'; rr(ctx, BOARD.x, BOARD.y0, 10, BOARD.y1 - BOARD.y0, 3); ctx.fill(); ctx.fillRect(BOARD.x + 4, BOARD.y1, 4, H);
      ctx.strokeStyle = 'rgba(255,255,255,.5)'; ctx.lineWidth = 1.5; for (let i = 0; i < 6; i++) { ctx.beginPath(); ctx.moveTo(RIM.l + i * 12, RIM.y); ctx.lineTo(RIM.l + 8 + i * 9, RIM.y + 38); ctx.stroke(); }
      ctx.strokeStyle = '#ff6b3d'; ctx.lineWidth = 5; ctx.beginPath(); ctx.moveTo(RIM.l, RIM.y); ctx.lineTo(RIM.r, RIM.y); ctx.stroke();
      ctx.fillStyle = '#ff8a3d'; ctx.beginPath(); ctx.arc(ball.x, ball.y, ball.rad, 0, 7); ctx.fill(); ctx.strokeStyle = '#4a1d0c'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(ball.x, ball.y, ball.rad, 0, 7); ctx.moveTo(ball.x - ball.rad, ball.y); ctx.lineTo(ball.x + ball.rad, ball.y); ctx.moveTo(ball.x, ball.y - ball.rad); ctx.lineTo(ball.x, ball.y + ball.rad); ctx.stroke();
      if (drag) { ctx.strokeStyle = 'rgba(255,211,222,.6)'; ctx.lineWidth = 3; ctx.setLineDash([6, 6]); ctx.beginPath(); ctx.moveTo(drag.x, drag.y); ctx.lineTo(drag.cx, drag.cy); ctx.stroke(); ctx.setLineDash([]); }
      F.draw(ctx); hud(ctx, W, String(score), tLeft.toFixed(1) + 's'); if (!started) txt(ctx, 'Swipe up from the ball', W / 2, 330, 18, '#ffd3de');
      if (over) endOverlay(ctx, W, H, score + ' baskets');
    });
    return { destroy() { stop(); st.destroy(); } };
  } });

// ---------- Fruit Slice ----------
duelGame('fruit', { name: 'Fruit Slice', icon: '🍉', tint: '#7fe0b6', blurb: 'Swipe to slice fruit. Avoid the bombs. Miss three and you’re done.', how: 'Swipe across the fruit to slice it. Slicing a bomb ends the run, and letting 3 fruit fall unsliced ends it too. Slice several in one swipe for a combo bonus. 3 attempts.' },
  { tries: 3, play(host, seed, done) {
    const W = 360, H = 600; const st = stage(host, W, H, { hFrac: .72 }); const ctx = st.ctx; const r = rng(seed); const F = fx();
    const KINDS = ['🍉', '🍊', '🍎', '🍋', '🍓', '🍑', '🥝', '🍍'];
    let items = [], score = 0, lives = 3, t = 0, nextW = .8, over = false, trail = [], swipe = null;
    function wave() { const n = 1 + Math.floor(r() * Math.min(4, 1 + t / 12)); for (let i = 0; i < n; i++) { const bomb = t > 5 && r() < .14; items.push({ x: 50 + r() * 260, y: H + 30, vx: (r() - .5) * 140, vy: -(560 + r() * 170), e: bomb ? '💣' : KINDS[Math.floor(r() * KINDS.length)], bomb, cut: false, rot: 0, vr: (r() - .5) * 4 }); } nextW = Math.max(.55, 1.25 - t / 50) + r() * .4; }
    st.cv.addEventListener('pointerdown', e => { const p = st.pt(e); swipe = { last: p, n: 0 }; trail = [{ ...p, t: 0 }]; st.cv.setPointerCapture(e.pointerId); });
    st.cv.addEventListener('pointermove', e => {
      if (!swipe || over) return; const p = st.pt(e); const a = swipe.last;
      for (const it of items) { if (it.cut) continue; const dx = p.x - a.x, dy = p.y - a.y; const l2 = dx * dx + dy * dy || 1; const u = clamp(((it.x - a.x) * dx + (it.y - a.y) * dy) / l2, 0, 1); const d = Math.hypot(a.x + u * dx - it.x, a.y + u * dy - it.y);
        if (d < 26) { it.cut = true; if (it.bomb) { over = true; F.burst(it.x, it.y, '#ffb15c', 40, 300); sfx('boom'); setTimeout(() => done(score), 1000); } else { score++; swipe.n++; F.burst(it.x, it.y, '#ff8fab', 12, 160); sfx('pop'); if (swipe.n >= 3) { score++; F.text('Combo +1', it.x, it.y - 30, '#ffe4a8', 18); } } } }
      swipe.last = p; trail.push({ ...p, t: 0 }); if (trail.length > 14) trail.shift();
    });
    const endSw = () => { swipe = null; }; st.cv.addEventListener('pointerup', endSw); st.cv.addEventListener('pointercancel', endSw);
    const stop = loop(dt => {
      if (!over) { t += dt; nextW -= dt; if (nextW <= 0) wave(); }
      for (const it of items) { it.vy += 600 * dt; it.x += it.vx * dt; it.y += it.vy * dt; it.rot += it.vr * dt; if (!it.cut && !it.bomb && it.vy > 0 && it.y > H + 40) { it.cut = true; if (!over) { lives--; sfx('bad'); if (lives <= 0) { over = true; setTimeout(() => done(score), 900); } } } }
      items = items.filter(it => it.y < H + 60 && !(it.cut && it.vy > 0 && it.y > H));
      trail.forEach(p => p.t += dt); trail = trail.filter(p => p.t < .18);
      F.step(dt);
      nightSky(ctx, W, H, 'fruit', '#1a1027', '#2f1f40');
      for (const it of items) { if (it.cut && !it.bomb) continue; ctx.save(); ctx.translate(it.x, it.y); ctx.rotate(it.rot); txt(ctx, it.e, 0, 0, 44); ctx.restore(); }
      if (trail.length > 1) { ctx.strokeStyle = '#fff'; ctx.lineCap = 'round'; for (let i = 1; i < trail.length; i++) { ctx.globalAlpha = i / trail.length; ctx.lineWidth = 1 + i * .5; ctx.beginPath(); ctx.moveTo(trail[i - 1].x, trail[i - 1].y); ctx.lineTo(trail[i].x, trail[i].y); ctx.stroke(); } ctx.globalAlpha = 1; }
      F.draw(ctx); hud(ctx, W, String(score), '❤'.repeat(Math.max(0, lives)) + '♡'.repeat(3 - Math.max(0, lives)));
      if (over) endOverlay(ctx, W, H, score + ' sliced');
    });
    return { destroy() { stop(); st.destroy(); } };
  } });

// ---------- shared aiming for Archery Range and Darts ----------
function aimer(st, opts) {
  // drag moves the reticle; it wobbles; release fires
  const A = { x: opts.x, y: opts.y, hold: 0, down: false, last: null, t: Math.random() * 10 };
  st.cv.addEventListener('pointerdown', e => { if (opts.locked()) return; A.down = true; A.hold = 0; A.last = st.pt(e); st.cv.setPointerCapture(e.pointerId); });
  st.cv.addEventListener('pointermove', e => { if (!A.down) return; const p = st.pt(e); A.x = clamp(A.x + (p.x - A.last.x) * .8, 10, st.W - 10); A.y = clamp(A.y + (p.y - A.last.y) * .8, 40, st.H - 60); A.last = p; });
  st.cv.addEventListener('pointerup', () => { if (!A.down) return; A.down = false; const w = A.wob(); opts.fire(A.x + w.x, A.y + w.y); });
  A.step = dt => { A.t += dt; if (A.down) A.hold += dt; };
  A.amp = () => opts.amp(A.hold, A.down);
  A.wob = () => { const a = A.amp(); return { x: Math.sin(A.t * 1.7) * a + Math.sin(A.t * 3.1) * a * .35, y: Math.cos(A.t * 1.3) * a * .8 + Math.sin(A.t * 2.6) * a * .3 }; };
  return A;
}

// ---------- Archery Range ----------
duelGame('range', { name: 'Archery Range', icon: '🍏', tint: '#7fe0b6', blurb: '10 arrows at a target that starts moving. Steady your breath.', how: 'Press and drag to aim; the sight sways. Holding steadies it for about a second, then your arm starts shaking. Let go to shoot. Wind pushes the arrow sideways, and from arrow 5 the target moves. 10 arrows, 3 attempts.' },
  { tries: 3, play(host, seed, done) {
    const W = 360, H = 600; const st = stage(host, W, H, { hFrac: .72 }); const ctx = st.ctx; const r = rng(seed); const F = fx();
    const T = { x: 180, y: 200, R: 110 }; let n = 0, total = 0, hits = [], fly = null, over = false, t = 0, wind = 0;
    const winds = Array.from({ length: 10 }, () => Math.round((r() * 2 - 1) * 10) / 10); wind = winds[0];
    const tx = () => n >= 4 ? 180 + Math.sin(t * (0.9 + n * .08)) * 70 : 180;
    const A = aimer(st, { x: 180, y: 200, locked: () => !!fly || over, amp: (h_, down) => !down ? 26 : h_ < 1 ? 26 - h_ * 20 : Math.min(40, 6 + (h_ - 1) * 26),
      fire: (x, y) => { fly = { x0: 180, y0: 560, x1: x + wind * 22, y1: y, t: 0 }; sfx('whoosh'); } });
    const stop = loop(dt => {
      t += dt; A.step(dt); T.x = tx();
      if (fly) { fly.t += dt / .32; if (fly.t >= 1) { const d = Math.hypot(fly.x1 - T.x, fly.y1 - T.y); const pts = Math.max(0, 10 - Math.floor(d / (T.R / 10))); total += pts; hits.push({ dx: fly.x1 - T.x, dy: fly.y1 - T.y }); F.text(pts ? '+' + pts : 'Miss', fly.x1, fly.y1 - 24, pts >= 9 ? '#ffe4a8' : '#ffd3de', 22); sfx(pts >= 9 ? 'coin' : pts ? 'thud' : 'bad'); n++; fly = null; if (n >= 10) { over = true; setTimeout(() => done(total), 1100); } else wind = winds[n]; } }
      F.step(dt);
      nightSky(ctx, W, H, 'range', '#1a1430', '#2d3a3f');
      ctx.fillStyle = '#20302c'; ctx.fillRect(0, 380, W, H - 380);
      ctx.fillStyle = '#5a3a2c'; ctx.fillRect(T.x - 4, T.y + T.R - 10, 8, 380 - T.y - T.R + 10);
      const ring = ['#f9eef3', '#f9eef3', '#3a2850', '#3a2850', '#91b8ff', '#91b8ff', '#ff6b7f', '#ff6b7f', '#f6c56c', '#f6c56c'];
      for (let i = 0; i < 10; i++) { ctx.fillStyle = ring[i]; ctx.beginPath(); ctx.arc(T.x, T.y, T.R * (1 - i / 10), 0, 7); ctx.fill(); ctx.strokeStyle = 'rgba(0,0,0,.25)'; ctx.lineWidth = 1; ctx.stroke(); }
      for (const p of hits) { ctx.fillStyle = '#2b0d1b'; ctx.beginPath(); ctx.arc(T.x + p.dx, T.y + p.dy, 3, 0, 7); ctx.fill(); ctx.strokeStyle = '#ffe4a8'; ctx.lineWidth = 1.5; ctx.stroke(); }
      if (fly) { const e = fly.t; const x = fly.x0 + (fly.x1 - fly.x0) * e, y = fly.y0 + (fly.y1 - fly.y0) * e; ctx.strokeStyle = '#f3e3c8'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x - (fly.x1 - fly.x0) * .08, y + 30); ctx.stroke(); }
      else if (!over) { const w = A.wob(); const x = A.x + w.x, y = A.y + w.y; ctx.strokeStyle = A.down ? '#ffe4a8' : 'rgba(255,228,168,.6)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(x, y, 12, 0, 7); ctx.moveTo(x - 20, y); ctx.lineTo(x - 6, y); ctx.moveTo(x + 6, y); ctx.lineTo(x + 20, y); ctx.moveTo(x, y - 20); ctx.lineTo(x, y - 6); ctx.moveTo(x, y + 6); ctx.lineTo(x, y + 20); ctx.stroke(); }
      txt(ctx, `wind ${wind > 0 ? '→' : wind < 0 ? '←' : ''} ${Math.abs(wind * 10).toFixed(0)}`, W / 2, H - 40, 15, '#bea8c1');
      F.draw(ctx); hud(ctx, W, String(total), `arrow ${Math.min(10, n + 1)}/10`);
      if (over) endOverlay(ctx, W, H, total + ' points');
    });
    return { destroy() { stop(); st.destroy(); } };
  } });

// ---------- Darts ----------
const DART_ORDER = [20, 1, 18, 4, 13, 6, 10, 15, 2, 17, 3, 19, 7, 16, 8, 11, 14, 9, 12, 5];
function dartScore(dx, dy, R) {
  const d = Math.hypot(dx, dy) / R * 170; if (d > 170) return { pts: 0, label: 'Miss' };
  if (d <= 6.35) return { pts: 50, label: 'Bull!' }; if (d <= 15.9) return { pts: 25, label: '25' };
  const a = (Math.atan2(dx, -dy) * 180 / Math.PI + 360 + 9) % 360; const n = DART_ORDER[Math.floor(a / 18)];
  if (d >= 99 && d <= 107) return { pts: n * 3, label: 'T' + n }; if (d >= 162) return { pts: n * 2, label: 'D' + n }; return { pts: n, label: String(n) };
}
duelGame('darts', { name: 'Darts', icon: '🎯', tint: '#ff6b7f', blurb: 'Nine darts on a real board. Treble 20 is where the points are.', how: 'Drag to move your aim, then let go to throw. Your hand wobbles a little, so time the release. Inner ring = treble, outer ring = double, bull = 50. Nine darts, 3 attempts.' },
  { tries: 3, play(host, seed, done) {
    const W = 360, H = 600; const st = stage(host, W, H, { hFrac: .72 }); const ctx = st.ctx; const F = fx();
    const B = { x: 180, y: 250, R: 150 }; let n = 0, total = 0, darts = [], fly = null, over = false;
    const A = aimer(st, { x: 180, y: 250, locked: () => !!fly || over, amp: (h_, down) => down ? 9 + Math.min(10, h_ * 3) : 14, fire: (x, y) => { fly = { x, y, t: 0 }; sfx('whoosh'); } });
    const stop = loop(dt => {
      A.step(dt);
      if (fly) { fly.t += dt / .25; if (fly.t >= 1) { const s = dartScore(fly.x - B.x, fly.y - B.y, B.R); total += s.pts; darts.push({ x: fly.x, y: fly.y }); F.text(s.label, fly.x, fly.y - 26, s.pts >= 40 ? '#ffe4a8' : '#ffd3de', 22); sfx(s.pts >= 40 ? 'coin' : s.pts ? 'thud' : 'bad'); n++; fly = null; if (n % 3 === 0 && n < 9) setTimeout(() => { darts = []; }, 700); if (n >= 9) { over = true; setTimeout(() => done(total), 1100); } } }
      F.step(dt);
      nightSky(ctx, W, H, 'darts', '#1d1230', '#2c1d3b');
      ctx.fillStyle = '#120a18'; ctx.beginPath(); ctx.arc(B.x, B.y, B.R + 22, 0, 7); ctx.fill();
      const k = B.R / 170;
      for (let i = 0; i < 20; i++) { const a0 = (-90 - 9 + i * 18) * Math.PI / 180, a1 = a0 + 18 * Math.PI / 180; const dark = i % 2 === 0;
        const ringFill = (r0, r1, c) => { ctx.fillStyle = c; ctx.beginPath(); ctx.arc(B.x, B.y, r1 * k, a0, a1); ctx.arc(B.x, B.y, r0 * k, a1, a0, true); ctx.closePath(); ctx.fill(); };
        ringFill(15.9, 99, dark ? '#20141f' : '#f2e2c4'); ringFill(99, 107, dark ? '#e45f80' : '#3f8f6a'); ringFill(107, 162, dark ? '#20141f' : '#f2e2c4'); ringFill(162, 170, dark ? '#e45f80' : '#3f8f6a');
        const am = (a0 + a1) / 2; txt(ctx, String(DART_ORDER[i]), B.x + Math.cos(am) * (B.R + 12), B.y + Math.sin(am) * (B.R + 12), 11, '#ffd3de'); }
      ctx.fillStyle = '#3f8f6a'; ctx.beginPath(); ctx.arc(B.x, B.y, 15.9 * k, 0, 7); ctx.fill(); ctx.fillStyle = '#e45f80'; ctx.beginPath(); ctx.arc(B.x, B.y, 6.35 * k, 0, 7); ctx.fill();
      for (const d of darts) { ctx.fillStyle = '#f6c56c'; ctx.beginPath(); ctx.arc(d.x, d.y, 3.5, 0, 7); ctx.fill(); ctx.strokeStyle = '#2b0d1b'; ctx.lineWidth = 1.5; ctx.stroke(); }
      if (fly) { const s = 1 + (1 - fly.t) * 2; ctx.fillStyle = '#f6c56c'; ctx.beginPath(); ctx.arc(fly.x, fly.y + (1 - fly.t) * 120, 3 * s, 0, 7); ctx.fill(); }
      else if (!over) { const w = A.wob(); const x = A.x + w.x, y = A.y + w.y; ctx.strokeStyle = A.down ? '#ffe4a8' : 'rgba(255,228,168,.6)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(x, y, 9, 0, 7); ctx.moveTo(x - 15, y); ctx.lineTo(x + 15, y); ctx.moveTo(x, y - 15); ctx.lineTo(x, y + 15); ctx.stroke(); }
      txt(ctx, `Round ${Math.min(3, Math.floor(n / 3) + 1)} of 3 · dart ${n % 3 + 1}`, W / 2, H - 40, 14, '#bea8c1');
      F.draw(ctx); hud(ctx, W, String(total), `${9 - n} left`);
      if (over) endOverlay(ctx, W, H, total + ' points');
    });
    return { destroy() { stop(); st.destroy(); } };
  } });

// ---------- Mini Golf ----------
const GOLF_HOLES = [
  { ball: [180, 510], cup: [180, 110], poly: [[40, 60], [320, 60], [320, 560], [40, 560]], walls: [], bump: [], par: 2 },
  { ball: [95, 515], cup: [272, 120], poly: [[40, 560], [150, 560], [150, 210], [320, 210], [320, 60], [40, 60]], walls: [], bump: [], par: 3 },
  { ball: [180, 515], cup: [180, 105], poly: [[40, 60], [320, 60], [320, 560], [40, 560]], walls: [[130, 260, 230, 260], [230, 260, 230, 330], [230, 330, 130, 330], [130, 330, 130, 260]], bump: [], par: 3 },
  { ball: [90, 515], cup: [80, 110], poly: [[40, 60], [320, 60], [320, 560], [40, 560]], walls: [[40, 390, 240, 390], [120, 245, 320, 245]], bump: [], par: 3 },
  { ball: [180, 515], cup: [180, 105], poly: [[40, 60], [320, 60], [320, 560], [40, 560]], walls: [], bump: [[125, 310, 24], [235, 310, 24], [180, 220, 24], [180, 400, 18]], par: 3 },
  { ball: [180, 520], cup: [180, 105], poly: [[60, 60], [300, 60], [300, 560], [60, 560]], walls: [], bump: [], mill: { x: 180, y: 320, L: 82 }, par: 3 },
];
duelGame('golf', { name: 'Mini Golf', icon: '⛳', tint: '#7fe0b6', blurb: 'Six little holes with walls, bumpers and a windmill. Fewest strokes wins.', how: 'Drag back from the ball like a slingshot and let go to putt. Bank off the walls; mind the bumpers and the windmill on hole 6. Each hole is capped at 8 strokes. Lowest total wins. One round each, same course.' },
  { tries: 1, lower: true, fmt: v => v + ' strokes', play(host, seed, done) {
    const W = 360, H = 600; const st = stage(host, W, H, { hFrac: .72 }); const ctx = st.ctx; const F = fx();
    let hi = 0, strokes = 0, total = 0, ball, v = { x: 0, y: 0 }, aim = null, sinking = 0, t = 0, over = false, cards = [];
    const load = () => { const Hh = GOLF_HOLES[hi]; ball = { x: Hh.ball[0], y: Hh.ball[1] }; v = { x: 0, y: 0 }; strokes = 0; };
    load();
    const segs = () => { const Hh = GOLF_HOLES[hi]; const s = []; for (let i = 0; i < Hh.poly.length; i++) { const a = Hh.poly[i], b = Hh.poly[(i + 1) % Hh.poly.length]; s.push([a[0], a[1], b[0], b[1]]); } Hh.walls.forEach(w => s.push(w)); if (Hh.mill) { const a = t * 1.6; const { x, y, L } = Hh.mill; s.push([x - Math.cos(a) * L, y - Math.sin(a) * L, x + Math.cos(a) * L, y + Math.sin(a) * L]); } return s; };
    const moving = () => Math.hypot(v.x, v.y) > 4;
    st.cv.addEventListener('pointerdown', e => { if (moving() || sinking || over) return; aim = { p: st.pt(e) }; aim.c = aim.p; st.cv.setPointerCapture(e.pointerId); });
    st.cv.addEventListener('pointermove', e => { if (aim) aim.c = st.pt(e); });
    st.cv.addEventListener('pointerup', () => { if (!aim) return; const dx = aim.p.x - aim.c.x, dy = aim.p.y - aim.c.y; aim = null; const L = Math.hypot(dx, dy); if (L < 8) return; const pow = Math.min(1, L / 160); v = { x: dx / L * pow * 720, y: dy / L * pow * 720 }; strokes++; sfx('tap'); });
    function holeDone() { total += strokes; cards.push(strokes); sfx('coin'); F.text(strokes === 1 ? 'Hole in one!' : strokes <= GOLF_HOLES[hi].par ? 'Nice!' : strokes + ' strokes', W / 2, 300, '#ffe4a8', 26);
      setTimeout(() => { hi++; if (hi >= GOLF_HOLES.length) { over = true; setTimeout(() => done(total), 900); } else load(); sinking = 0; }, 900); }
    const stop = loop(dt => {
      t += dt; const Hh = GOLF_HOLES[hi] || GOLF_HOLES[GOLF_HOLES.length - 1];
      if (!sinking && !over) {
        const sub = 6; for (let s = 0; s < sub; s++) { const d = dt / sub;
          ball.x += v.x * d; ball.y += v.y * d;
          const sp = Math.hypot(v.x, v.y); if (sp > 0) { const ns = Math.max(0, sp - (90 + sp * .9) * d); v.x *= ns / sp; v.y *= ns / sp; }
          for (const [x1, y1, x2, y2] of segs()) { const dx = x2 - x1, dy = y2 - y1; const u = clamp(((ball.x - x1) * dx + (ball.y - y1) * dy) / (dx * dx + dy * dy), 0, 1); const cx = x1 + u * dx, cy = y1 + u * dy; const ex = ball.x - cx, ey = ball.y - cy; const dd = Math.hypot(ex, ey); if (dd < 8 && dd > 0) { const nx = ex / dd, ny = ey / dd; const dot = v.x * nx + v.y * ny; if (dot < 0) { v.x -= 1.8 * dot * nx; v.y -= 1.8 * dot * ny; if (Math.abs(dot) > 60) sfx('thud'); } ball.x = cx + nx * 8.01; ball.y = cy + ny * 8.01; } }
          for (const [bx, by, br] of Hh.bump) { const ex = ball.x - bx, ey = ball.y - by; const dd = Math.hypot(ex, ey); if (dd < br + 8) { const nx = ex / dd, ny = ey / dd; const dot = v.x * nx + v.y * ny; if (dot < 0) { v.x -= 2.2 * dot * nx; v.y -= 2.2 * dot * ny; sfx('pop'); } ball.x = bx + nx * (br + 8.01); ball.y = by + ny * (br + 8.01); } }
          const cd = Math.hypot(ball.x - Hh.cup[0], ball.y - Hh.cup[1]); if (cd < 11 && Math.hypot(v.x, v.y) < 380) { sinking = 1; v = { x: 0, y: 0 }; ball.x = Hh.cup[0]; ball.y = Hh.cup[1]; holeDone(); break; }
        }
        if (!moving() && !sinking && strokes >= 8) { sinking = 1; holeDone(); }
      }
      F.step(dt);
      ctx.fillStyle = '#160e1e'; ctx.fillRect(0, 0, W, H);
      ctx.beginPath(); Hh.poly.forEach(([x, y], i) => i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)); ctx.closePath(); ctx.fillStyle = '#2f6b52'; ctx.fill(); ctx.strokeStyle = '#f2e2c4'; ctx.lineWidth = 6; ctx.stroke();
      ctx.strokeStyle = 'rgba(255,255,255,.04)'; ctx.lineWidth = 14; for (let y = 70; y < 560; y += 28) { ctx.beginPath(); ctx.moveTo(40, y); ctx.lineTo(320, y); ctx.stroke(); }
      ctx.strokeStyle = '#f2e2c4'; ctx.lineWidth = 6; ctx.lineCap = 'round'; for (const [x1, y1, x2, y2] of Hh.walls) { ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke(); }
      for (const [bx, by, br] of Hh.bump) { ctx.fillStyle = '#ff8fab'; ctx.beginPath(); ctx.arc(bx, by, br, 0, 7); ctx.fill(); ctx.fillStyle = '#ffd3de'; ctx.beginPath(); ctx.arc(bx - br * .3, by - br * .3, br * .3, 0, 7); ctx.fill(); }
      if (Hh.mill) { const a = t * 1.6, { x, y, L } = Hh.mill; ctx.strokeStyle = '#f6c56c'; ctx.lineWidth = 8; ctx.beginPath(); ctx.moveTo(x - Math.cos(a) * L, y - Math.sin(a) * L); ctx.lineTo(x + Math.cos(a) * L, y + Math.sin(a) * L); ctx.stroke(); ctx.fillStyle = '#5a3a2c'; ctx.beginPath(); ctx.arc(x, y, 9, 0, 7); ctx.fill(); }
      ctx.fillStyle = '#0d0810'; ctx.beginPath(); ctx.arc(Hh.cup[0], Hh.cup[1], 11, 0, 7); ctx.fill(); ctx.strokeStyle = '#fff'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(Hh.cup[0], Hh.cup[1]); ctx.lineTo(Hh.cup[0], Hh.cup[1] - 44); ctx.stroke(); ctx.fillStyle = '#ff6b7f'; ctx.beginPath(); ctx.moveTo(Hh.cup[0], Hh.cup[1] - 44); ctx.lineTo(Hh.cup[0] + 22, Hh.cup[1] - 37); ctx.lineTo(Hh.cup[0], Hh.cup[1] - 30); ctx.fill();
      if (aim) { const dx = aim.p.x - aim.c.x, dy = aim.p.y - aim.c.y; const L = Math.hypot(dx, dy); if (L > 8) { const pow = Math.min(1, L / 160); ctx.fillStyle = '#ffe4a8'; for (let i = 1; i <= 8; i++) { ctx.globalAlpha = 1 - i / 10; ctx.beginPath(); ctx.arc(ball.x + dx / L * i * 14 * pow * 1.6, ball.y + dy / L * i * 14 * pow * 1.6, 3, 0, 7); ctx.fill(); } ctx.globalAlpha = 1; txt(ctx, Math.round(pow * 100) + '%', ball.x, ball.y + 26, 13, '#ffe4a8'); } }
      if (!sinking) { ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(ball.x, ball.y, 8, 0, 7); ctx.fill(); ctx.strokeStyle = '#bbb'; ctx.lineWidth = 1; ctx.stroke(); }
      F.draw(ctx); hud(ctx, W, `Hole ${Math.min(hi + 1, 6)}`, `${total + (sinking ? 0 : strokes)} strokes`, `par ${Hh.par} · ${strokes} here`);
      if (over) endOverlay(ctx, W, H, total + ' strokes');
    });
    return { destroy() { stop(); st.destroy(); } };
  } });

// ================= Classic turn-based games =================
const disc = (seat, size = '78%') => h('div', { style: `width:${size};height:${size};border-radius:50%;background:radial-gradient(circle at 35% 30%, #fff8 0 12%, transparent 13%), ${SEATCOL[seat]};box-shadow:inset 0 -4px 0 rgba(0,0,0,.18)` });

// animate the latest move: on first render only if it's the other player's unseen move, afterwards on every change
function moveAnim(api) { let prev; return (g, key) => { const fr = api.fresh(g); const go = prev === undefined ? fr : key !== prev; prev = key; if (go && fr) sfx('pop'); return go; }; }
function slideWrap(child, from, to, flip) { const d = i => { const k = flip ? 63 - i : i; return [k & 7, k >> 3]; }; const [fc, fr] = d(from), [tc, tr] = d(to); return h('div', { class: 'slidein', style: `position:absolute;inset:0;display:grid;place-items:center;--dx:${(fc - tc) * 100}%;--dy:${(fr - tr) * 100}%` }, child); }

// ---------- Connect 4 ----------
function c4Line(b, i) {
  const s = b[i]; const r = Math.floor(i / 7), c = i % 7;
  for (const [dr, dc] of [[0, 1], [1, 0], [1, 1], [1, -1]]) {
    const line = [i];
    for (const sg of [1, -1]) { let rr_ = r + dr * sg, cc = c + dc * sg; while (rr_ >= 0 && rr_ < 6 && cc >= 0 && cc < 7 && b[rr_ * 7 + cc] === s) { line.push(rr_ * 7 + cc); rr_ += dr * sg; cc += dc * sg; } }
    if (line.length >= 4) return line;
  }
  return null;
}
GAMES.connect4 = {
  id: 'connect4', cat: 'classic', name: 'Connect 4', icon: '🔴', tint: '#ff6b7f', blurb: 'Drop discs. Four in a row wins.',
  how: 'Take turns dropping a disc into a column. Line up four of yours across, down or diagonally to win.',
  init: (seed, first) => ({ state: { b: Array(42).fill(''), last: -1, line: null }, turn: first }),
  create(el, api) {
    const board = h('div', { class: 'board', style: 'grid-template-columns:repeat(7,1fr);max-width:420px;padding:8px;gap:6px;border-radius:20px;background:linear-gradient(160deg,#3a2850,#2c1d3b);box-shadow:inset 0 0 0 2px rgba(255,206,224,.12)' });
    el.append(board);
    const ma = moveAnim(api);
    function render(g) {
      const { b, last, line } = g.state; const win = new Set(line || []); const canPlay = api.myTurn();
      const animI = ma(g, String(last)) ? last : -1;
      const dsc = (v, i) => { const d = disc(v); if (i === animI) { d.classList.add('dropin'); d.style.setProperty('--fall', `-${(Math.floor(i / 7) + 1) * 135}%`); } return d; };
      board.replaceChildren(...b.map((v, i) => h('button', { class: 'cell', 'aria-label': `Column ${i % 7 + 1}`, style: `background:#160e1e;border-radius:50%;overflow:visible;${win.has(i) ? 'box-shadow:0 0 0 3px #ffe4a8' : ''}${i === last ? ';outline:2px dashed rgba(255,228,168,.5);outline-offset:-4px' : ''}`, disabled: !canPlay ? true : null, onclick: () => drop(i % 7) }, v ? dsc(v, i) : '')));
    }
    async function drop(c) {
      const g = api.g(); if (!api.myTurn()) return; const b = g.state.b.slice();
      let i = -1; for (let r = 5; r >= 0; r--) if (!b[r * 7 + c]) { i = r * 7 + c; break; }
      if (i < 0) { sfx('bad'); return; }
      b[i] = api.me; sfx('pop'); const line = c4Line(b, i);
      const st = { b, last: i, line };
      if (line) await api.win(st, api.me); else if (b.every(Boolean)) await api.win(st, 'tie'); else await api.commit(st, api.op);
    }
    return { update: render };
  },
};

// ---------- Tic-tac-toe (first to 3) ----------
const TTT_L = [[0, 1, 2], [3, 4, 5], [6, 7, 8], [0, 3, 6], [1, 4, 7], [2, 5, 8], [0, 4, 8], [2, 4, 6]];
GAMES.ttt = {
  id: 'ttt', cat: 'classic', name: 'Tic-tac-toe', icon: '⭕', tint: '#f6c56c', blurb: 'First to win three rounds takes the match.',
  how: 'Classic noughts and crosses, played as a match: first to win 3 rounds wins. The starting player swaps every round; drawn rounds don’t count.',
  init: (seed, first) => ({ state: { b: Array(9).fill(''), wins: { p1: 0, p2: 0 }, round: 1, starter: first, note: '' }, turn: first }),
  mid: g => `${g.state.wins.p1} – ${g.state.wins.p2}`,
  create(el, api) {
    const note = h('p', { class: 'muted', style: 'text-align:center;font-weight:800' });
    const board = h('div', { class: 'board', style: 'grid-template-columns:repeat(3,1fr);max-width:320px;gap:8px' });
    el.append(note, board);
    const mark = s => s ? h('span', { style: `font-size:min(16vw,64px);font-weight:900;color:${SEATCOL[s]};line-height:1` }, s === 'p1' ? '✕' : '◯') : '';
    const ma = moveAnim(api);
    function render(g) {
      const S_ = g.state; const animI = ma(g, S_.round + ':' + S_.last) ? S_.last : -1; note.textContent = `Round ${S_.round} · ${nm('p1')} ${S_.wins.p1} – ${S_.wins.p2} ${nm('p2')}` + (S_.note ? ' · ' + S_.note : '');
      board.replaceChildren(...S_.b.map((v, i) => h('button', { class: 'cell', 'aria-label': `Square ${i + 1}`, style: 'background:var(--dusk);border:1.5px solid var(--line-2);border-radius:16px', disabled: !api.myTurn() || v ? true : null, onclick: () => play(i) }, i === animI && v ? h('span', { class: 'popin' }, mark(v)) : mark(v))));
    }
    async function play(i) {
      const g = api.g(); const S_ = clone(g.state); S_.b[i] = api.me; S_.last = i; sfx('pop');
      const won = TTT_L.some(l => l.every(k => S_.b[k] === api.me)); const full = S_.b.every(Boolean);
      if (won || full) {
        if (won) S_.wins[api.me]++;
        if (S_.wins[api.me] >= 3) { await api.win(S_, api.me); return; }
        S_.note = won ? `${nm(api.me)} took round ${S_.round}` : `Round ${S_.round} drawn`;
        S_.round++; S_.starter = other(S_.starter); S_.b = Array(9).fill(''); S_.last = -1;
        toast(won ? 'You won the round!' : 'Drawn round'); await api.commit(S_, S_.starter);
      } else { S_.note = ''; await api.commit(S_, api.op); }
    }
    return { update: render };
  },
};

// ---------- Dots & Boxes ----------
const DB_N = 5;
GAMES.dots = {
  id: 'dots', cat: 'classic', name: 'Dots & Boxes', icon: '🔲', tint: '#91b8ff', blurb: 'Draw lines, close boxes, claim them. Close one and go again.',
  how: 'Take turns drawing one line between two dots. Close the fourth side of a box to claim it and draw again. When all 25 boxes are claimed, most boxes wins.',
  init: (seed, first) => ({ state: { h: Array((DB_N + 1) * DB_N).fill(''), v: Array(DB_N * (DB_N + 1)).fill(''), box: Array(DB_N * DB_N).fill(''), last: null }, turn: first }),
  mid: g => { const c = s => g.state.box.filter(x => x === s).length; return `${c('p1')} – ${c('p2')}`; },
  create(el, api) {
    const holder = h('div', { style: 'width:100%;max-width:400px;margin:0 auto;touch-action:manipulation' }); el.append(holder);
    const G = 60, O = 24, SZ = O * 2 + G * DB_N;
    const ma = moveAnim(api);
    function render(g) {
      const { h: H_, v: V_, box, last } = g.state; const can = api.myTurn(); let s = ''; const animL = ma(g, JSON.stringify(last));
      box.forEach((o, i) => { if (!o) return; const r = Math.floor(i / DB_N), c = i % DB_N; s += `<rect x="${O + c * G + 4}" y="${O + r * G + 4}" width="${G - 8}" height="${G - 8}" rx="8" fill="${SEATCOL[o]}" opacity=".28"/><text x="${O + c * G + G / 2}" y="${O + r * G + G / 2 + 8}" font-size="22" text-anchor="middle">${em(o)}</text>`; });
      const line = (x1, y1, x2, y2, o, kind, idx) => { const isLast = last && last[0] === kind && last[1] === idx; s += o ? `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${SEATCOL[o]}" stroke-width="${isLast ? 8 : 6}" stroke-linecap="round"${isLast && animL ? ' class="newline"' : ''}/>` : `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="rgba(255,206,224,.12)" stroke-width="3" stroke-dasharray="2 8" stroke-linecap="round"/>${can ? `<line data-k="${kind}" data-i="${idx}" x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="transparent" stroke-width="26" style="cursor:pointer"/>` : ''}`; };
      for (let r = 0; r <= DB_N; r++) for (let c = 0; c < DB_N; c++) line(O + c * G, O + r * G, O + (c + 1) * G, O + r * G, H_[r * DB_N + c], 'h', r * DB_N + c);
      for (let r = 0; r < DB_N; r++) for (let c = 0; c <= DB_N; c++) line(O + c * G, O + r * G, O + c * G, O + (r + 1) * G, V_[r * (DB_N + 1) + c], 'v', r * (DB_N + 1) + c);
      for (let r = 0; r <= DB_N; r++) for (let c = 0; c <= DB_N; c++) s += `<circle cx="${O + c * G}" cy="${O + r * G}" r="5" fill="#ffd3de"/>`;
      holder.innerHTML = `<svg viewBox="0 0 ${SZ} ${SZ}" style="width:100%;height:auto;display:block" role="img" aria-label="Dots and boxes board">${s}</svg>`;
      holder.querySelectorAll('[data-k]').forEach(n => n.addEventListener('click', () => move(n.dataset.k, +n.dataset.i)));
    }
    async function move(kind, idx) {
      if (!api.myTurn()) return; const S_ = clone(api.g().state); const arr = kind === 'h' ? S_.h : S_.v; if (arr[idx]) return;
      arr[idx] = api.me; S_.last = [kind, idx]; let got = 0;
      for (let r = 0; r < DB_N; r++) for (let c = 0; c < DB_N; c++) { const i = r * DB_N + c; if (S_.box[i]) continue; if (S_.h[r * DB_N + c] && S_.h[(r + 1) * DB_N + c] && S_.v[r * (DB_N + 1) + c] && S_.v[r * (DB_N + 1) + c + 1]) { S_.box[i] = api.me; got++; } }
      sfx(got ? 'coin' : 'tap');
      if (S_.box.every(Boolean)) { const a = S_.box.filter(x => x === 'p1').length, b = S_.box.length - a; await api.win(S_, a === b ? 'tie' : a > b ? 'p1' : 'p2', { scores: { p1: a, p2: b } }); }
      else await api.commit(S_, got ? api.me : api.op);
    }
    return { update: render };
  },
};

// ---------- Checkers ----------
function ckInit() { const b = Array(64).fill(''); for (let i = 0; i < 64; i++) { const r = i >> 3, c = i & 7; if ((r + c) % 2 === 1) { if (r < 3) b[i] = 'b'; else if (r > 4) b[i] = 'a'; } } return b; }
const ckOwner = p => p ? (p.toLowerCase() === 'a' ? 'p1' : 'p2') : null;
function ckMoves(b, seat, only = -1) {
  const caps = [], steps = [];
  for (let i = 0; i < 64; i++) {
    if (only >= 0 && i !== only) continue; const p = b[i]; if (ckOwner(p) !== seat) continue;
    const king = p === 'A' || p === 'B'; const fwd = seat === 'p1' ? -1 : 1; const dirs = king ? [[1, 1], [1, -1], [-1, 1], [-1, -1]] : [[fwd, 1], [fwd, -1]];
    const r = i >> 3, c = i & 7;
    for (const [dr, dc] of dirs) {
      const r1 = r + dr, c1 = c + dc, r2 = r + 2 * dr, c2 = c + 2 * dc;
      if (r1 < 0 || r1 > 7 || c1 < 0 || c1 > 7) continue;
      const m = r1 * 8 + c1;
      if (!b[m]) steps.push({ from: i, to: m });
      else if (ckOwner(b[m]) !== seat && r2 >= 0 && r2 <= 7 && c2 >= 0 && c2 <= 7 && !b[r2 * 8 + c2]) caps.push({ from: i, to: r2 * 8 + c2, cap: m });
    }
  }
  return caps.length ? caps : (only >= 0 ? [] : steps);
}
GAMES.checkers = {
  id: 'checkers', cat: 'classic', name: 'Checkers', icon: '⚫', tint: '#ff8fab', blurb: 'Jump pieces, crown your kings. Captures are compulsory.',
  how: 'Move diagonally forward on the dark squares. Jump over an opponent’s piece to capture it; if a capture is available you must take it, and keep jumping while you can. Reach the far row to become a king that moves both ways. Take all the other player’s pieces, or leave them with no moves, to win.',
  init: (seed, first) => ({ state: { b: ckInit(), chain: -1, last: null }, turn: first }),
  side: (g, s) => `${g.state.b.filter(p => ckOwner(p) === s).length} pieces`,
  create(el, api) {
    const board = h('div', { class: 'board', style: 'grid-template-columns:repeat(8,1fr);max-width:440px;gap:0;border-radius:14px;overflow:hidden;box-shadow:0 0 0 3px #4a3463' }); el.append(board);
    let sel = -1; const ma = moveAnim(api); let oppSel = -1;
    const offLive = api.live.on(o => { const n = o && o.sel != null ? o.sel : -1; if (n !== oppSel) { oppSel = n; render(api.g()); } });
    function render(g) {
      const { b, chain, last } = g.state; const flip = api.me === 'p2'; const my = api.myTurn(); const animM = ma(g, JSON.stringify(last)) ? last : null;
      const moves = my ? ckMoves(b, api.me, chain) : []; if (chain >= 0) sel = chain;
      const targets = new Map(moves.filter(m => m.from === sel).map(m => [m.to, m]));
      const movable = new Set(moves.map(m => m.from));
      const cells = [];
      for (let k = 0; k < 64; k++) {
        const i = flip ? 63 - k : k; const r = i >> 3, c = i & 7; const dark = (r + c) % 2 === 1; const p = b[i];
        const lastHit = last && (last[0] === i || last[1] === i);
        const cell = h('button', { class: 'cell', style: `border-radius:0;background:${dark ? (lastHit ? '#7a5470' : '#5c3f5e') : '#e9d6c8'};${sel === i ? 'box-shadow:inset 0 0 0 3px #ffe4a8' : oppSel === i && g.turn === api.op ? `box-shadow:inset 0 0 0 3px ${SEATCOL[api.op]}` : ''}`, 'aria-label': `Square ${String.fromCharCode(97 + c)}${8 - r}`,
          onclick: () => { if (targets.has(i)) go(targets.get(i)); else if (movable.has(i) && chain < 0) { sel = i; api.live.send({ sel: i }); render(api.g()); } } });
        if (p) { const d = disc(ckOwner(p), '76%'); if (p === 'A' || p === 'B') d.append(h('span', { style: 'display:grid;place-items:center;height:100%;font-size:min(4.5vw,20px)' }, '♛︎')); if (movable.has(i) && my) d.style.boxShadow += ',0 0 0 2px #fff6'; cell.append(animM && animM[1] === i ? slideWrap(d, animM[0], i, flip) : d); }
        if (targets.has(i)) cell.append(h('div', { style: 'position:absolute;width:30%;height:30%;border-radius:50%;background:#ffe4a8;opacity:.85' }));
        cells.push(cell);
      }
      board.replaceChildren(...cells);
    }
    async function go(m) {
      const S_ = clone(api.g().state); const b = S_.b; let p = b[m.from]; b[m.from] = ''; let crowned = false;
      if (m.cap != null) b[m.cap] = '';
      const r = m.to >> 3; if (p === 'a' && r === 0) { p = 'A'; crowned = true; } if (p === 'b' && r === 7) { p = 'B'; crowned = true; }
      b[m.to] = p; S_.last = [m.from, m.to]; sel = -1; api.live.send(null); sfx(m.cap != null ? 'hit' : 'tap');
      if (m.cap != null && !crowned && ckMoves(b, api.me, m.to).some(x => x.cap != null)) { S_.chain = m.to; await api.commit(S_, api.me); return; }
      S_.chain = -1;
      if (!ckMoves(b, api.op).length) await api.win(S_, api.me); else await api.commit(S_, api.op);
    }
    return { update: g => { if (!api.myTurn()) sel = -1; render(g); }, destroy: () => offLive() };
  },
};

// ---------- Chess ----------
const CH_GLYPH = { K: '♚', Q: '♛', R: '♜', B: '♝', N: '♞', P: '♟' };
function chInit() {
  const back = ['R', 'N', 'B', 'Q', 'K', 'B', 'N', 'R']; const b = Array(64).fill('');
  for (let c = 0; c < 8; c++) { b[c] = 'b' + back[c]; b[8 + c] = 'bP'; b[48 + c] = 'wP'; b[56 + c] = 'w' + back[c]; }
  return { b, cr: { wK: 1, wQ: 1, bK: 1, bQ: 1 }, ep: -1, hm: 0, hist: [], last: null };
}
function chAttacked(b, sq, by) {
  const r = sq >> 3, c = sq & 7; const at = (rr_, cc) => rr_ >= 0 && rr_ < 8 && cc >= 0 && cc < 8 ? b[rr_ * 8 + cc] : null;
  const pd = by === 'w' ? 1 : -1; if (at(r + pd, c - 1) === by + 'P' || at(r + pd, c + 1) === by + 'P') return true;
  for (const [dr, dc] of [[1, 2], [2, 1], [-1, 2], [-2, 1], [1, -2], [2, -1], [-1, -2], [-2, -1]]) if (at(r + dr, c + dc) === by + 'N') return true;
  for (let dr = -1; dr <= 1; dr++) for (let dc = -1; dc <= 1; dc++) if ((dr || dc) && at(r + dr, c + dc) === by + 'K') return true;
  for (const [dr, dc, kinds] of [[1, 0, 'RQ'], [-1, 0, 'RQ'], [0, 1, 'RQ'], [0, -1, 'RQ'], [1, 1, 'BQ'], [1, -1, 'BQ'], [-1, 1, 'BQ'], [-1, -1, 'BQ']]) {
    let rr_ = r + dr, cc = c + dc; while (rr_ >= 0 && rr_ < 8 && cc >= 0 && cc < 8) { const p = b[rr_ * 8 + cc]; if (p) { if (p[0] === by && kinds.includes(p[1])) return true; break; } rr_ += dr; cc += dc; }
  }
  return false;
}
function chPseudo(st, col) {
  const b = st.b, out = [], opp = col === 'w' ? 'b' : 'w';
  for (let i = 0; i < 64; i++) {
    const p = b[i]; if (!p || p[0] !== col) continue; const t = p[1], r = i >> 3, c = i & 7;
    const add = (to, x = {}) => out.push({ from: i, to, ...x });
    if (t === 'P') {
      const d = col === 'w' ? -1 : 1, start = col === 'w' ? 6 : 1, pr = col === 'w' ? 0 : 7; const one = i + d * 8;
      if (r + d >= 0 && r + d < 8 && !b[one]) { add(one, r + d === pr ? { promo: 1 } : {}); if (r === start && !b[i + d * 16]) add(i + d * 16, { dbl: 1 }); }
      for (const dc of [-1, 1]) { const cc = c + dc; if (cc < 0 || cc > 7 || r + d < 0 || r + d > 7) continue; const to = (r + d) * 8 + cc; if (b[to] && b[to][0] === opp) add(to, r + d === pr ? { promo: 1 } : {}); else if (to === st.ep) add(to, { enp: 1 }); }
    } else if (t === 'N' || t === 'K') {
      const offs = t === 'N' ? [[1, 2], [2, 1], [-1, 2], [-2, 1], [1, -2], [2, -1], [-1, -2], [-2, -1]] : [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]];
      for (const [dr, dc] of offs) { const rr_ = r + dr, cc = c + dc; if (rr_ < 0 || rr_ > 7 || cc < 0 || cc > 7) continue; const to = rr_ * 8 + cc; if (!b[to] || b[to][0] === opp) add(to); }
      if (t === 'K') {
        const home = col === 'w' ? 60 : 4;
        if (i === home && !chAttacked(b, home, opp)) {
          if (st.cr[col + 'K'] && !b[home + 1] && !b[home + 2] && b[home + 3] === col + 'R' && !chAttacked(b, home + 1, opp) && !chAttacked(b, home + 2, opp)) add(home + 2, { castle: 'K' });
          if (st.cr[col + 'Q'] && !b[home - 1] && !b[home - 2] && !b[home - 3] && b[home - 4] === col + 'R' && !chAttacked(b, home - 1, opp) && !chAttacked(b, home - 2, opp)) add(home - 2, { castle: 'Q' });
        }
      }
    } else {
      const dirs = t === 'R' ? [[1, 0], [-1, 0], [0, 1], [0, -1]] : t === 'B' ? [[1, 1], [1, -1], [-1, 1], [-1, -1]] : [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]];
      for (const [dr, dc] of dirs) { let rr_ = r + dr, cc = c + dc; while (rr_ >= 0 && rr_ < 8 && cc >= 0 && cc < 8) { const to = rr_ * 8 + cc; if (b[to]) { if (b[to][0] === opp) add(to); break; } add(to); rr_ += dr; cc += dc; } }
    }
  }
  return out;
}
function chApply(st, m, promo = 'Q') {
  const s = clone(st); const b = s.b; const p = b[m.from]; const col = p[0]; const cap = b[m.to] || (m.enp ? 'x' : '');
  b[m.to] = m.promo ? col + promo : p; b[m.from] = '';
  if (m.enp) b[m.to + (col === 'w' ? 8 : -8)] = '';
  if (m.castle === 'K') { b[m.to - 1] = b[m.to + 1]; b[m.to + 1] = ''; } if (m.castle === 'Q') { b[m.to + 1] = b[m.to - 2]; b[m.to - 2] = ''; }
  if (p[1] === 'K') { s.cr[col + 'K'] = 0; s.cr[col + 'Q'] = 0; }
  for (const [sq, key] of [[63, 'wK'], [56, 'wQ'], [7, 'bK'], [0, 'bQ']]) if (m.from === sq || m.to === sq) s.cr[key] = 0;
  s.ep = m.dbl ? (m.from + m.to) / 2 : -1; s.hm = p[1] === 'P' || cap ? 0 : s.hm + 1; s.last = [m.from, m.to];
  const sqn = i => String.fromCharCode(97 + (i & 7)) + (8 - (i >> 3));
  s.hist = (s.hist || []).concat(m.castle ? (m.castle === 'K' ? 'O-O' : 'O-O-O') : (p[1] === 'P' ? '' : p[1]) + (cap ? (p[1] === 'P' ? sqn(m.from)[0] : '') + 'x' : '') + sqn(m.to) + (m.promo ? '=' + promo : '')).slice(-300);
  if (cap && cap !== 'x') s.capt = (s.capt || []).concat(cap); if (m.enp) s.capt = (s.capt || []).concat((col === 'w' ? 'b' : 'w') + 'P');
  return s;
}
function chLegal(st, col) { const opp = col === 'w' ? 'b' : 'w'; return chPseudo(st, col).filter(m => { const s = chApply(st, m); const k = s.b.indexOf(col + 'K'); return !chAttacked(s.b, k, opp); }); }
GAMES.chess = {
  id: 'chess', cat: 'classic', name: 'Chess', icon: '♟️', tint: '#c9a2ff', blurb: 'The full game: castling, en passant, promotion, checkmate.',
  how: 'Standard chess rules. Whoever goes first plays white. Tap a piece to see where it can go, then tap the square. Pawns reaching the last rank let you pick a new piece. Checkmate wins; stalemate is a tie.',
  init: (seed, first) => ({ state: { ...chInit(), white: first }, turn: first }),
  side: (g, s) => (g.state.white === s ? 'White' : 'Black') + (g.status === 'active' && g.turn === s && chAttacked(g.state.b, g.state.b.indexOf((g.state.white === s ? 'w' : 'b') + 'K'), g.state.white === s ? 'b' : 'w') ? ' · check!' : ''),
  create(el, api) {
    const board = h('div', { class: 'board', style: 'grid-template-columns:repeat(8,1fr);max-width:460px;gap:0;border-radius:12px;overflow:hidden;box-shadow:0 0 0 3px #4a3463' });
    const promoBar = h('div', { class: 'gfoot', hidden: true });
    const capt = h('div', { class: 'row', style: 'justify-content:center;font-size:20px;min-height:24px;flex-wrap:wrap' });
    const hist = h('p', { class: 'mono faint', style: 'text-align:center;font-size:12.5px;overflow-wrap:anywhere' });
    el.append(capt, board, promoBar, hist);
    let sel = -1, pending = null; const ma = moveAnim(api); let oppSel = -1;
    const offLive = api.live.on(o => { const n = o && o.sel != null ? o.sel : -1; if (n !== oppSel) { oppSel = n; render(api.g()); } });
    const col = () => api.g().state.white === api.me ? 'w' : 'b';
    const glyph = p => h('span', { style: `font-size:min(9vw,42px);line-height:1;color:${p[0] === 'w' ? '#fff7ee' : '#2a1636'};text-shadow:${p[0] === 'w' ? '0 0 2px #2a1636,0 1px 0 #2a1636,0 -1px 0 #2a1636,1px 0 0 #2a1636,-1px 0 0 #2a1636' : '0 0 1px #fff7ee,0 1px 0 #ffd3de88'}` }, CH_GLYPH[p[1]] + '︎');
    function render(g) {
      const st = g.state; const mc = col(); const flip = mc === 'b'; const my = api.myTurn(); const animM = ma(g, JSON.stringify(st.last)) ? st.last : null;
      const moves = my ? chLegal(st, mc) : []; const tg = new Map(moves.filter(m => m.from === sel).map(m => [m.to, m])); const from = new Set(moves.map(m => m.from));
      const turnCol = g.turn === st.white ? 'w' : 'b'; const kq = st.b.indexOf(turnCol + 'K'); const inCheck = g.status === 'active' && chAttacked(st.b, kq, turnCol === 'w' ? 'b' : 'w');
      const cells = [];
      for (let k = 0; k < 64; k++) {
        const i = flip ? 63 - k : k; const r = i >> 3, c = i & 7; const light = (r + c) % 2 === 0; const p = st.b[i];
        const lastSq = st.last && st.last.includes(i);
        let bg = light ? '#f1ddcf' : '#a9718b'; if (lastSq) bg = light ? '#f5d58f' : '#c9975a'; if (inCheck && i === kq) bg = '#ff6b7f';
        const cell = h('button', { class: 'cell', style: `border-radius:0;background:${bg};${sel === i ? 'box-shadow:inset 0 0 0 3px #2a1636' : oppSel === i && g.turn === api.op ? `box-shadow:inset 0 0 0 3px ${SEATCOL[api.op]}` : ''}`, 'aria-label': `${String.fromCharCode(97 + c)}${8 - r}${p ? ' ' + p : ''}`,
          onclick: () => { if (tg.has(i)) choose(tg.get(i)); else if (from.has(i)) { sel = i; api.live.send({ sel: i }); render(api.g()); } else { sel = -1; api.live.send(null); render(api.g()); } } });
        if (p) cell.append(animM && animM[1] === i ? slideWrap(glyph(p), animM[0], i, flip) : glyph(p));
        if (tg.has(i)) cell.append(h('div', { style: `position:absolute;${p ? 'inset:6%;border-radius:50%;border:3px solid rgba(42,22,54,.5)' : 'width:26%;height:26%;border-radius:50%;background:rgba(42,22,54,.4)'}` }));
        if ((flip ? k % 8 === 0 : c === 0)) cell.append(h('span', { style: `position:absolute;left:3px;top:1px;font-size:10px;font-weight:900;color:${light ? '#a9718b' : '#f1ddcf'}` }, String(8 - r)));
        if ((flip ? k >= 56 : r === 7)) cell.append(h('span', { style: `position:absolute;right:3px;bottom:0;font-size:10px;font-weight:900;color:${light ? '#a9718b' : '#f1ddcf'}` }, String.fromCharCode(97 + c)));
        cells.push(cell);
      }
      board.replaceChildren(...cells);
      const cp = st.capt || []; capt.replaceChildren(...cp.map(p => h('span', { style: `color:${p[0] === 'w' ? '#fff7ee' : '#bea8c1'}` }, CH_GLYPH[p[1]] + '︎')));
      hist.textContent = (st.hist || []).map((m, i) => (i % 2 === 0 ? (i / 2 + 1) + '. ' : '') + m).slice(-16).join(' ');
      if (inCheck && my) api.status('Check! Your move', true);
    }
    function choose(m) {
      if (m.promo) { pending = m; promoBar.hidden = false; promoBar.replaceChildren(h('span', { class: 'lbl', style: 'align-self:center' }, 'Promote to'), ...['Q', 'R', 'B', 'N'].map(t => h('button', { class: 'btn small ghost', style: 'font-size:22px', onclick: () => { promoBar.hidden = true; go(pending, t); } }, CH_GLYPH[t] + '︎'))); return; }
      go(m, 'Q');
    }
    async function go(m, promo) {
      sel = -1; api.live.send(null); const st = chApply(api.g().state, m, promo); const oc = col() === 'w' ? 'b' : 'w';
      sfx(st.capt && st.capt.length > (api.g().state.capt || []).length ? 'hit' : 'tap');
      const reply = chLegal(st, oc); const ok = st.b.indexOf(oc + 'K'); const check = chAttacked(st.b, ok, col());
      const pieces = st.b.filter(Boolean); const bare = pieces.every(p => p[1] === 'K' || p[1] === 'B' || p[1] === 'N') && pieces.length <= 3;
      if (!reply.length) { if (check) { toast('Checkmate!'); await api.win(st, api.me); } else { toast('Stalemate'); await api.win(st, 'tie'); } }
      else if (bare) { toast('Not enough pieces left to mate: draw'); await api.win(st, 'tie'); }
      else if (st.hm >= 100) { toast('50 moves without a capture: draw'); await api.win(st, 'tie'); }
      else await api.commit(st, api.op);
      api.status(null);
    }
    return { update: g => { if (!api.myTurn()) sel = -1; render(g); }, destroy: () => offLive() };
  },
};

// ---------- Ludo for two ----------
const LUDO_PATH = (() => {
  const p = []; const seg = (a, b, fixed, horiz) => { const s = a <= b ? 1 : -1; for (let i = a; s > 0 ? i <= b : i >= b; i += s) p.push(horiz ? [i, fixed] : [fixed, i]); };
  seg(1, 5, 6, true); seg(5, 0, 6, false); p.push([7, 0]); seg(0, 5, 8, false); seg(9, 14, 6, true); p.push([14, 7]); seg(14, 9, 8, true); seg(9, 14, 8, false); p.push([7, 14]); seg(14, 9, 6, false); seg(5, 0, 8, true); p.push([0, 7]); p.push([0, 6]);
  return p;
})();
const LUDO_START = { p1: 0, p2: 26 }, LUDO_SAFE = new Set([0, 8, 13, 21, 26, 34, 39, 47]);
const LUDO_HOME = { p1: [[1, 7], [2, 7], [3, 7], [4, 7], [5, 7]], p2: [[13, 7], [12, 7], [11, 7], [10, 7], [9, 7]] };
const LUDO_BASE = { p1: [[1.5, 1.5], [3.5, 1.5], [1.5, 3.5], [3.5, 3.5]], p2: [[10.5, 10.5], [12.5, 10.5], [10.5, 12.5], [12.5, 12.5]] };
const ludoAbs = (seat, prog) => (LUDO_START[seat] + prog) % 52;
function ludoCell(seat, prog, k) { if (prog < 0) return LUDO_BASE[seat][k]; if (prog >= 56) return [7, 7]; if (prog >= 51) return LUDO_HOME[seat][prog - 51]; return LUDO_PATH[ludoAbs(seat, prog)]; }
GAMES.ludo = {
  id: 'ludo', cat: 'classic', name: 'Ludo', icon: '🎲', tint: '#7fe0b6', blurb: 'Race four tokens home. Roll a 6 to leave base, and knock the other back.',
  how: 'Roll the dice, then tap a token to move it. You need a 6 to bring a token out. Rolling a 6, capturing a token or bringing one home gives you another roll. Landing on the other player’s token sends it back to base, except on the star squares. Get all four home to win.',
  init: (seed, first) => ({ state: { tok: { p1: [-1, -1, -1, -1], p2: [-1, -1, -1, -1] }, dice: null, last: null }, turn: first }),
  side: (g, s) => `${g.state.tok[s].filter(x => x >= 56).length}/4 home`,
  mid: g => g.state.last ? `${nm(g.state.last.by)} rolled ${g.state.last.n}` : 'vs',
  create(el, api) {
    const W = 360, H = 360, CS = W / 15; const st = stage(el, W, H, { hFrac: .6 }); const ctx = st.ctx;
    const ctl = h('div', { class: 'gfoot' }); el.append(ctl);
    let rolling = 0, shownDice = null, t = 0, tokAnim = null; let prevMv; let oppRolling = false;
    const offLive = api.live.on(o => { oppRolling = !!(o && o.rolling); });
    const movable = (g, n) => g.state.tok[api.me].map((p, k) => (p < 0 && n === 6) || (p >= 0 && p < 56 && p + n <= 56) ? k : -1).filter(k => k >= 0);
    function controls(g) {
      ctl.replaceChildren();
      if (!api.myTurn()) return;
      if (g.state.dice == null) ctl.append(h('button', { class: 'btn gold', onclick: roll }, 'Roll the dice'));
      else { const mv = movable(g, g.state.dice); ctl.append(h('p', { class: 'muted', style: 'font-weight:800' }, mv.length ? `You rolled ${g.state.dice}. Tap a glowing token.` : `You rolled ${g.state.dice}. No moves.`)); }
    }
    async function roll() {
      const g = api.g(); if (!api.myTurn() || g.state.dice != null) return;
      const n = 1 + Math.floor(Math.random() * 6); rolling = .6; sfx('tap'); api.live.send({ rolling: 1 }); setTimeout(() => api.live.send(null), 700);
      const S_ = clone(g.state); S_.dice = n; S_.last = { by: api.me, n };
      await api.commit(S_, api.me);
      if (!movable(api.g(), n).length) { await sleep(1200); const S2 = clone(api.g().state); S2.dice = null; await api.commit(S2, api.op); }
    }
    async function move(k) {
      const g = api.g(); const n = g.state.dice; if (!api.myTurn() || n == null || !movable(g, n).includes(k)) return;
      const S_ = clone(g.state); const cur = S_.tok[api.me][k]; const np = cur < 0 ? 0 : cur + n; S_.tok[api.me][k] = np; S_.mv = { seat: api.me, k, from: cur, to: np, t: Date.now() }; let extra = n === 6;
      if (np <= 50) { const a = ludoAbs(api.me, np); if (!LUDO_SAFE.has(a)) S_.tok[api.op] = S_.tok[api.op].map(p => { if (p >= 0 && p <= 50 && ludoAbs(api.op, p) === a) { extra = true; sfx('hit'); toast(`Knocked ${nm(api.op)}’s token back!`); return -1; } return p; }); }
      if (np === 56) { extra = true; sfx('coin'); }
      else sfx('pop');
      S_.dice = null;
      if (S_.tok[api.me].every(p => p >= 56)) await api.win(S_, api.me); else await api.commit(S_, extra ? api.me : api.op);
    }
    st.cv.addEventListener('pointerdown', e => {
      const g = api.g(); if (!api.myTurn() || g.state.dice == null) return; const p = st.pt(e); const mv = movable(g, g.state.dice);
      let best = -1, bd = 1e9; mv.forEach(k => { const [cx, cy] = ludoCell(api.me, g.state.tok[api.me][k], k); const d = Math.hypot((cx + .5) * CS - p.x, (cy + .5) * CS - p.y); if (d < bd) { bd = d; best = k; } });
      if (best >= 0 && bd < CS * 1.4) move(best);
    });
    const stop = loop(dt => {
      t += dt; if (rolling > 0) rolling -= dt; const g = api.g(); if (!g) return;
      ctx.fillStyle = '#f4e6dc'; ctx.fillRect(0, 0, W, H);
      const quad = (x, y, c) => { ctx.fillStyle = c; ctx.fillRect(x * CS, y * CS, 6 * CS, 6 * CS); ctx.fillStyle = '#fff6ee'; rr(ctx, (x + 1) * CS, (y + 1) * CS, 4 * CS, 4 * CS, 10); ctx.fill(); };
      quad(0, 0, SEATCOL.p1); quad(9, 9, SEATCOL.p2); quad(9, 0, '#c7b6cf'); quad(0, 9, '#c7b6cf');
      LUDO_PATH.forEach(([c, r], i) => { ctx.fillStyle = i === 0 ? SEATCOL.p1 : i === 26 ? SEATCOL.p2 : '#fffaf5'; ctx.fillRect(c * CS + 1, r * CS + 1, CS - 2, CS - 2); ctx.strokeStyle = 'rgba(42,22,54,.18)'; ctx.lineWidth = 1; ctx.strokeRect(c * CS + .5, r * CS + .5, CS - 1, CS - 1); if (LUDO_SAFE.has(i) && i !== 0 && i !== 26) txt(ctx, '★', (c + .5) * CS, (r + .55) * CS, 13, '#c9975a'); });
      for (const s of ['p1', 'p2']) LUDO_HOME[s].forEach(([c, r]) => { ctx.fillStyle = SEATCOL[s]; ctx.globalAlpha = .7; ctx.fillRect(c * CS + 1, r * CS + 1, CS - 2, CS - 2); ctx.globalAlpha = 1; });
      ctx.fillStyle = SEATCOL.p1; ctx.beginPath(); ctx.moveTo(6 * CS, 6 * CS); ctx.lineTo(7.5 * CS, 7.5 * CS); ctx.lineTo(6 * CS, 9 * CS); ctx.fill();
      ctx.fillStyle = SEATCOL.p2; ctx.beginPath(); ctx.moveTo(9 * CS, 6 * CS); ctx.lineTo(7.5 * CS, 7.5 * CS); ctx.lineTo(9 * CS, 9 * CS); ctx.fill();
      ctx.fillStyle = '#c7b6cf'; ctx.beginPath(); ctx.moveTo(6 * CS, 6 * CS); ctx.lineTo(7.5 * CS, 7.5 * CS); ctx.lineTo(9 * CS, 6 * CS); ctx.fill(); ctx.beginPath(); ctx.moveTo(6 * CS, 9 * CS); ctx.lineTo(7.5 * CS, 7.5 * CS); ctx.lineTo(9 * CS, 9 * CS); ctx.fill();
      const mv = api.myTurn() && g.state.dice != null ? new Set(movable(g, g.state.dice)) : new Set();
      const count = {};
      if (tokAnim) { const el_ = (performance.now() - tokAnim.t0) / 1000; const steps = tokAnim.from < 0 ? 1 : tokAnim.to - tokAnim.from; if (el_ > steps * .13 + .1) tokAnim = null; }
      if (oppRolling && rolling <= 0) rolling = .2;
      for (const s of ['p1', 'p2']) g.state.tok[s].forEach((p0, k) => { let p = p0; if (tokAnim && tokAnim.seat === s && tokAnim.k === k) { const el_ = (performance.now() - tokAnim.t0) / 1000; p = tokAnim.from < 0 ? (el_ < .15 ? -1 : 0) : Math.min(tokAnim.to, tokAnim.from + Math.floor(el_ / .13)); } const [c, r] = ludoCell(s, p, k); const key = c + ',' + r; const n = count[key] = (count[key] || 0) + 1; const off = (n - 1) * 4;
        const x = (c + .5) * CS + off, y = (r + .5) * CS - off; const glow = s === api.me && mv.has(k);
        if (glow) { ctx.fillStyle = 'rgba(255,228,168,' + (.5 + .4 * Math.sin(t * 6)) + ')'; ctx.beginPath(); ctx.arc(x, y, CS * .58, 0, 7); ctx.fill(); }
        ctx.fillStyle = SEATCOL[s]; ctx.strokeStyle = '#2a1636'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(x, y, CS * .38, 0, 7); ctx.fill(); ctx.stroke(); txt(ctx, em(s), x, y + 1, CS * .42); });
      const dv = rolling > 0 ? 1 + Math.floor(Math.random() * 6) : (g.state.dice ?? (g.state.last && g.state.last.n));
      if (dv) { ctx.fillStyle = '#fffaf5'; ctx.strokeStyle = '#2a1636'; ctx.lineWidth = 2; rr(ctx, 7.5 * CS - 15, 7.5 * CS - 15, 30, 30, 7); ctx.fill(); ctx.stroke(); const pips = { 1: [[0, 0]], 2: [[-1, -1], [1, 1]], 3: [[-1, -1], [0, 0], [1, 1]], 4: [[-1, -1], [1, -1], [-1, 1], [1, 1]], 5: [[-1, -1], [1, -1], [0, 0], [-1, 1], [1, 1]], 6: [[-1, -1], [1, -1], [-1, 0], [1, 0], [-1, 1], [1, 1]] }[dv]; ctx.fillStyle = '#2a1636'; pips.forEach(([a, b]) => { ctx.beginPath(); ctx.arc(7.5 * CS + a * 8, 7.5 * CS + b * 8, 3, 0, 7); ctx.fill(); }); }
    });
    function checkAnim(g) {
      const mv = g.state.mv; const key = mv ? mv.t + ':' + mv.seat : ''; const fr = api.fresh(g);
      const go = prevMv === undefined ? (fr && mv && mv.seat === api.op) : key !== prevMv; prevMv = key;
      if (go && mv) { tokAnim = { ...mv, t0: performance.now() }; if (mv.seat === api.op) sfx('pop'); }
      if (fr && g.state.last && g.state.last.by === api.op && g.state.dice != null) rolling = .5;
    }
    return { update: g => { checkAnim(g); controls(g); }, destroy() { stop(); st.destroy(); offLive(); } };
  },
};

// ================= 8-Ball Pool =================
const PW = 360, PH = 640, PR = 10, PB = { x0: 28, y0: 28, x1: 332, y1: 612 };
const POCKETS = [[33, 33, 17], [327, 33, 17], [33, 607, 17], [327, 607, 17], [23, 320, 18], [337, 320, 18]];
const BALLCOL = ['#fffaf2', '#f6c56c', '#6f8fe0', '#ff6b7f', '#a77be0', '#ffb15c', '#3f8f6a', '#8a3b4b', '#1a1220'];
function poolRack(seed) {
  const r = rng(seed + 'rack'); const rest = shuffle([2, 3, 4, 5, 6, 7, 10, 11, 12, 13, 14, 15], r);
  // back corners: one solid, one stripe; 8 in the middle; apex = 1 or 9
  const order = []; const slots = 15; for (let i = 0; i < slots; i++) order.push(0);
  const idx = (row, j) => row * (row + 1) / 2 + j;
  order[idx(0, 0)] = r() < .5 ? 1 : 9; order[idx(2, 1)] = 8; order[idx(4, 0)] = order[0] === 1 ? 15 : 7; order[idx(4, 4)] = order[0] === 1 ? 9 : 1;
  if (order[idx(4, 4)] === order[0]) order[idx(4, 4)] = order[0] === 1 ? 9 : 1;
  const used = new Set(order.filter(Boolean)); let q = rest.concat([1, 9, 7, 15]).filter(n => !used.has(n));
  for (let i = 0; i < slots; i++) if (!order[i]) { order[i] = q.shift(); }
  const balls = [[0, 180, 480, 1]]; let k = 0; const d = PR * 2 + .6;
  for (let row = 0; row < 5; row++) for (let j = 0; j <= row; j++) balls.push([order[k++], Math.round((180 + (j - row / 2) * d) * 10) / 10, Math.round((190 - row * d * .866) * 10) / 10, 1]);
  return balls;
}
function poolSim(balls0, vx, vy, record) {
  const B = balls0.map(b => ({ n: b[0], x: b[1], y: b[2], on: !!b[3], vx: 0, vy: 0 }));
  const cue = B.find(b => b.n === 0); cue.vx = vx; cue.vy = vy;
  const dt = 1 / 240; let first = null; const potted = []; const frames = []; let rails = 0;
  for (let step = 0; step < 240 * 25; step++) {
    let moving = false;
    for (const b of B) { if (!b.on) continue; b.x += b.vx * dt; b.y += b.vy * dt; const sp = Math.sqrt(b.vx * b.vx + b.vy * b.vy); if (sp > 0) { const ns = Math.max(0, sp - (40 + sp * .42) * dt); b.vx = b.vx / sp * ns; b.vy = b.vy / sp * ns; if (ns > 0) moving = true; } }
    for (let i = 0; i < B.length; i++) { const a = B[i]; if (!a.on) continue; for (let j = i + 1; j < B.length; j++) { const b = B[j]; if (!b.on) continue; const dx = b.x - a.x, dy = b.y - a.y; const d2 = dx * dx + dy * dy; if (d2 < 4 * PR * PR && d2 > 0) { const d = Math.sqrt(d2); const nx = dx / d, ny = dy / d; const ov = (2 * PR - d) / 2; a.x -= nx * ov; a.y -= ny * ov; b.x += nx * ov; b.y += ny * ov; const rv = (a.vx - b.vx) * nx + (a.vy - b.vy) * ny; if (rv > 0) { const imp = rv * .96; a.vx -= imp * nx; a.vy -= imp * ny; b.vx += imp * nx; b.vy += imp * ny; if (first == null && (a.n === 0 || b.n === 0)) first = a.n === 0 ? b.n : a.n; } } } }
    for (const b of B) {
      if (!b.on) continue;
      for (const [px, py, pr] of POCKETS) { const dx = b.x - px, dy = b.y - py; if (dx * dx + dy * dy < pr * pr) { b.on = false; b.vx = b.vy = 0; potted.push(b.n); break; } }
      if (!b.on) continue;
      if (b.x < PB.x0 + PR) { b.x = PB.x0 + PR; b.vx = -b.vx * .82; rails++; } if (b.x > PB.x1 - PR) { b.x = PB.x1 - PR; b.vx = -b.vx * .82; rails++; }
      if (b.y < PB.y0 + PR) { b.y = PB.y0 + PR; b.vy = -b.vy * .82; rails++; } if (b.y > PB.y1 - PR) { b.y = PB.y1 - PR; b.vy = -b.vy * .82; rails++; }
    }
    if (record && step % 4 === 0) frames.push(B.map(b => [b.x, b.y, b.on]));
    if (!moving) break;
  }
  return { balls: B.map(b => [b.n, Math.round(b.x * 10) / 10, Math.round(b.y * 10) / 10, b.on ? 1 : 0]), first, potted, frames };
}
GAMES.pool = {
  id: 'pool', cat: 'classic', name: '8-Ball Pool', icon: '🎱', tint: '#3f8f6a', blurb: 'Solids or stripes, proper physics, sink the 8 last.',
  how: 'Drag on the table to aim, set the power, and tap Shoot. The first ball you pot after the break decides your group: solids (1–7) or stripes (9–15). Pot one of yours to keep shooting. Fouls (potting the white, missing every ball, or hitting the other group first) give the other player ball in hand. Clear your group, then sink the 8 to win. Sink the 8 early and you lose.',
  init: (seed, first) => ({ state: { balls: poolRack(seed), groups: { p1: null, p2: null }, bih: false, n: 0, shot: null, msg: 'Break!' }, turn: first }),
  side: (g, s) => { const gr = g.state.groups[s]; if (!gr) return 'open table'; const left = g.state.balls.filter(b => b[3] && (gr === 'solid' ? b[0] >= 1 && b[0] <= 7 : b[0] >= 9)).length; return `${gr}s · ${left} left`; },
  create(el, api) {
    const st = stage(el, PW, PH, { hFrac: .66 }); const ctx = st.ctx; const F = fx();
    const msg = h('p', { class: 'muted', style: 'text-align:center;font-weight:800;min-height:20px' });
    const power = h('input', { type: 'range', min: '8', max: '100', value: '55', id: 'pool-power', style: 'flex:1;accent-color:#ff8fab' });
    const shootB = h('button', { class: 'btn', onclick: () => shoot() }, 'Shoot');
    const ctl = h('div', { class: 'row', style: 'max-width:420px;width:100%;margin:0 auto' }, h('label', { class: 'lbl', for: 'pool-power' }, 'Power'), power, shootB);
    el.append(msg, ctl);
    let seenN = api.g().state.n;
    { const g_ = api.g(); if (g_.state.shot && g_.state.shot.by === api.op && +(api.seenGet('n') ?? -1) < g_.state.n) seenN = g_.state.n - 1; }
    let oppLive = null; const offLive = api.live.on(o => { oppLive = o && o.a != null ? o : null; });
    const sendLive = () => { if (!api.myTurn()) return; const c = cueBall(); api.live.send({ a: Math.round(aimA * 1000) / 1000, p: +power.value, c: c && c[3] ? [Math.round(c[1]), Math.round(c[2])] : null }); };
    power.addEventListener('input', sendLive);
    let anim = null; let aimA = -Math.PI / 2; let busy = false; let placing = null;
    let view = api.g().state.balls.map(b => b.slice());
    const myGroup = () => api.g().state.groups[api.me];
    const isGroup = (gr, n) => gr === 'solid' ? n >= 1 && n <= 7 : gr === 'stripe' ? n >= 9 && n <= 15 : false;
    function cueBall() { return view.find(b => b[0] === 0); }
    function freeSpot(x, y) { return x > PB.x0 + PR && x < PB.x1 - PR && y > PB.y0 + PR && y < PB.y1 - PR && view.every(b => !b[3] || b[0] === 0 || Math.hypot(b[1] - x, b[2] - y) > 2 * PR + 1); }
    st.cv.addEventListener('pointerdown', e => { if (!api.myTurn() || anim || busy) return; const p = st.pt(e); const g = api.g(); if (g.state.bih) { placing = true; moveCue(p); } else aimAt(p); st.cv.setPointerCapture(e.pointerId); });
    st.cv.addEventListener('pointermove', e => { if (!api.myTurn() || anim || busy || !(e.buttons || e.pointerType === 'touch')) return; const p = st.pt(e); if (placing) moveCue(p); else aimAt(p); });
    st.cv.addEventListener('pointerup', () => { placing = null; });
    function moveCue(p) { const g = api.g(); const minY = g.state.n === 0 ? 470 : PB.y0 + PR; const x = clamp(p.x, PB.x0 + PR + 1, PB.x1 - PR - 1), y = clamp(p.y, minY, PB.y1 - PR - 1); if (freeSpot(x, y)) { const c = cueBall(); c[1] = x; c[2] = y; c[3] = 1; sendLive(); } }
    function aimAt(p) { const c = cueBall(); if (!c || !c[3]) return; aimA = Math.atan2(p.y - c[2], p.x - c[1]); sendLive(); }
    async function shoot() {
      const g = api.g(); if (!api.myTurn() || anim || busy) return; const c = cueBall(); if (!c || !c[3]) { toast('Tap the table to place the white ball'); return; }
      busy = true; const pw = +power.value / 100; const sp = 160 + pw * 1150;
      const vx = Math.round(Math.cos(aimA) * sp * 100) / 100, vy = Math.round(Math.sin(aimA) * sp * 100) / 100;
      const from = view.map(b => b.slice()); const sim = poolSim(from, vx, vy, true); sfx('thud');
      seenN = g.state.n + 1; api.seenSet('n', seenN); api.live.send(null);
      anim = { frames: sim.frames, i: 0, done: async () => { await settle(from, vx, vy, sim); busy = false; } };
    }
    async function settle(from, vx, vy, sim) {
      const g = api.g(); const S_ = clone(g.state); const me_ = api.me, op_ = api.op; const gr = S_.groups[me_];
      const potted = sim.potted; const cuePot = potted.includes(0); const eight = potted.includes(8); const isBreak = S_.n === 0;
      const remainingBefore = n => gr ? from.filter(b => b[3] && isGroup(gr, b[0])).length : 7;
      const cleared = gr && remainingBefore() === 0;
      let foul = cuePot || sim.first == null;
      if (!foul && !isBreak) { if (gr) foul = cleared ? sim.first !== 8 : !isGroup(gr, sim.first); else foul = sim.first === 8; }
      S_.balls = sim.balls; S_.n++; S_.shot = { by: me_, vx, vy, from }; S_.bih = false;
      if (cuePot) { const c = S_.balls.find(b => b[0] === 0); c[3] = 0; }
      let text = '';
      if (eight) {
        if (cleared && !foul) { S_.msg = `${nm(me_)} sank the 8!`; await api.win(S_, me_); return; }
        S_.msg = `${nm(me_)} sank the 8 too early`; toast('The 8 went down early. That’s the game.'); await api.win(S_, op_); return;
      }
      if (!foul && !gr && !isBreak) { const fp = potted.find(n => n !== 0 && n !== 8); if (fp) { S_.groups[me_] = fp <= 7 ? 'solid' : 'stripe'; S_.groups[op_] = fp <= 7 ? 'stripe' : 'solid'; text = `${nm(me_)} takes ${S_.groups[me_]}s. `; } }
      if (isBreak && !foul && !gr) { /* open table after the break */ }
      const g2 = S_.groups[me_];
      const keep = !foul && (g2 ? potted.some(n => isGroup(g2, n)) : potted.some(n => n !== 0 && n !== 8));
      if (foul) { S_.bih = true; text += cuePot ? 'Scratch! ' : sim.first == null ? 'No ball hit. ' : 'Wrong ball first. '; text += `${nm(op_)} has ball in hand.`; }
      else if (keep) text += `${nm(me_)} potted ${potted.filter(n => n).length} and shoots again.`;
      else text += potted.length ? 'Nothing of yours went down.' : 'No pot.';
      S_.msg = text; sfx(foul ? 'bad' : keep ? 'coin' : 'tap');
      await api.commit(S_, keep ? me_ : op_);
    }
    function firstContact(c, a) {
      // ray from cue ball along angle; return distance to first ball contact
      const dx = Math.cos(a), dy = Math.sin(a); let best = null;
      for (const b of view) { if (!b[3] || b[0] === 0) continue; const fx_ = b[1] - c[1], fy = b[2] - c[2]; const t = fx_ * dx + fy * dy; if (t <= 0) continue; const perp2 = fx_ * fx_ + fy * fy - t * t; const R2 = 4 * PR * PR; if (perp2 > R2) continue; const d = t - Math.sqrt(R2 - perp2); if (!best || d < best.d) best = { d, b }; }
      return best;
    }
    const stop = loop(dt => {
      F.step(dt); const g = api.g(); if (!g) return;
      if (anim) { anim.i += 1; if (anim.i >= anim.frames.length) { const a = anim; anim = null; view = api.g().state.n >= seenN && !a.local ? api.g().state.balls.map(b => b.slice()) : view; a.done && a.done(); } else { const f = anim.frames[anim.i]; view.forEach((b, k) => { b[1] = f[k][0]; b[2] = f[k][1]; if (!f[k][2] && b[3]) { b[3] = 0; sfx('pop'); F.burst(b[1], b[2], BALLCOL[b[0] % 8 || (b[0] === 8 ? 8 : 0)], 10, 90); } }); } }
      // table
      ctx.fillStyle = '#4a2f24'; rr(ctx, 0, 0, PW, PH, 26); ctx.fill(); ctx.fillStyle = '#5f3d2e'; rr(ctx, 8, 8, PW - 16, PH - 16, 20); ctx.fill();
      const felt = ctx.createRadialGradient(PW / 2, PH / 2, 60, PW / 2, PH / 2, 420); felt.addColorStop(0, '#24705f'); felt.addColorStop(1, '#174a40'); ctx.fillStyle = felt; ctx.fillRect(PB.x0 - 6, PB.y0 - 6, PB.x1 - PB.x0 + 12, PB.y1 - PB.y0 + 12);
      ctx.strokeStyle = 'rgba(255,255,255,.08)'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(PB.x0, 470); ctx.lineTo(PB.x1, 470); ctx.stroke();
      for (const [px, py, pr] of POCKETS) { ctx.fillStyle = '#0b0710'; ctx.beginPath(); ctx.arc(px, py, pr, 0, 7); ctx.fill(); }
      for (const [x, y] of [[100, 18], [180, 18], [260, 18], [100, 622], [180, 622], [260, 622], [18, 170], [18, 470], [342, 170], [342, 470]]) { ctx.fillStyle = '#f2e2c4'; ctx.beginPath(); ctx.arc(x, y, 2.5, 0, 7); ctx.fill(); }
      // aim guide
      let c = cueBall(); let AA = aimA, PWR = +power.value / 100, show = false, who = api.me;
      if (api.myTurn() && !anim && !busy && c && c[3] && g.status === 'active') show = true;
      else if (oppLive && g.turn === api.op && !anim && g.status === 'active') { AA = oppLive.a; PWR = (oppLive.p || 50) / 100; if (oppLive.c) c = [0, oppLive.c[0], oppLive.c[1], 1]; show = !!(c && c[3]); who = api.op;
        if (oppLive.c) { ctx.fillStyle = '#fffaf2'; ctx.beginPath(); ctx.arc(c[1], c[2], PR, 0, 7); ctx.fill(); }
        txt(ctx, `${nm(api.op)} is lining up · ${Math.round(PWR * 100)}%`, PW / 2, 60, 14, SEATCOL[api.op]); }
      if (show) {
        const aimA = AA;
        const fc = firstContact(c, aimA); const L = fc ? fc.d : 700; const ex = c[1] + Math.cos(aimA) * L, ey = c[2] + Math.sin(aimA) * L;
        ctx.strokeStyle = 'rgba(255,255,255,.55)'; ctx.setLineDash([5, 6]); ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(c[1], c[2]); ctx.lineTo(ex, ey); ctx.stroke(); ctx.setLineDash([]);
        if (fc) { ctx.strokeStyle = 'rgba(255,255,255,.7)'; ctx.beginPath(); ctx.arc(ex, ey, PR, 0, 7); ctx.stroke(); const nx = fc.b[1] - ex, ny = fc.b[2] - ey, nl = Math.hypot(nx, ny); ctx.strokeStyle = 'rgba(255,228,168,.7)'; ctx.beginPath(); ctx.moveTo(fc.b[1], fc.b[2]); ctx.lineTo(fc.b[1] + nx / nl * 60, fc.b[2] + ny / nl * 60); ctx.stroke(); }
        const pw = PWR; const back = 18 + pw * 40; ctx.strokeStyle = '#e9c79a'; ctx.lineWidth = 6; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(c[1] - Math.cos(aimA) * back, c[2] - Math.sin(aimA) * back); ctx.lineTo(c[1] - Math.cos(aimA) * (back + 170), c[2] - Math.sin(aimA) * (back + 170)); ctx.stroke(); ctx.strokeStyle = '#fff'; ctx.lineWidth = 6; ctx.beginPath(); ctx.moveTo(c[1] - Math.cos(aimA) * back, c[2] - Math.sin(aimA) * back); ctx.lineTo(c[1] - Math.cos(aimA) * (back + 8), c[2] - Math.sin(aimA) * (back + 8)); ctx.stroke();
      }
      for (const b of view) {
        if (!b[3]) continue; const [n, x, y] = b; const base = n === 0 ? BALLCOL[0] : n === 8 ? BALLCOL[8] : BALLCOL[n > 8 ? n - 8 : n];
        ctx.fillStyle = n > 8 ? '#fffaf2' : base; ctx.beginPath(); ctx.arc(x, y, PR, 0, 7); ctx.fill();
        if (n > 8) { ctx.save(); ctx.beginPath(); ctx.arc(x, y, PR, 0, 7); ctx.clip(); ctx.fillStyle = base; ctx.fillRect(x - PR, y - 5.5, PR * 2, 11); ctx.restore(); }
        if (n) { ctx.fillStyle = '#fffaf2'; ctx.beginPath(); ctx.arc(x, y, 4.6, 0, 7); ctx.fill(); txt(ctx, String(n), x, y + .5, 6.5, '#1a1220'); }
        ctx.fillStyle = 'rgba(255,255,255,.45)'; ctx.beginPath(); ctx.arc(x - 3.5, y - 3.5, 2.4, 0, 7); ctx.fill();
      }
      // potted rails
      const pot = view.filter(b => !b[3] && b[0] !== 0);
      pot.forEach((b, i) => { const n = b[0]; const x = 50 + i * 18; ctx.fillStyle = n > 8 ? '#fffaf2' : n === 8 ? BALLCOL[8] : BALLCOL[n]; ctx.globalAlpha = .9; ctx.beginPath(); ctx.arc(x, PH - 8, 6, 0, 7); ctx.fill(); if (n > 8) { ctx.fillStyle = BALLCOL[n - 8]; ctx.fillRect(x - 6, PH - 10, 12, 4); } ctx.globalAlpha = 1; });
      if (api.myTurn() && g.state.bih && !anim) txt(ctx, 'Ball in hand: drag to place the white', PW / 2, PH / 2, 15, '#ffe4a8');
      F.draw(ctx);
    });
    function render(g) {
      msg.textContent = g.state.msg || ''; const my = api.myTurn(); ctl.style.visibility = my ? 'visible' : 'hidden'; shootB.disabled = !my;
      if (g.state.n > seenN && g.state.shot && !anim) {
        seenN = g.state.n; const sh = g.state.shot; view = sh.from.map(b => b.slice()); const sim = poolSim(sh.from, sh.vx, sh.vy, true); sfx('thud');
        anim = { frames: sim.frames, i: 0, done: () => { view = api.g().state.balls.map(b => b.slice()); api.seenSet('n', seenN); } };
        api.status(`${nm(sh.by)} is shooting…`);
        setTimeout(() => api.status(null), sim.frames.length * 16 + 300);
      } else if (!anim && !busy) {
        view = g.state.balls.map(b => b.slice());
        if (my && g.state.bih && !cueBall()[3]) { const c = cueBall(); for (const [x, y] of [[180, 480], [140, 480], [220, 480], [180, 540]]) if (freeSpot(x, y)) { c[1] = x; c[2] = y; c[3] = 1; break; } }
      }
    }
    return { update: render, destroy() { stop(); st.destroy(); offLive(); } };
  },
};

// ================= Word games and Draw & Guess =================
let DICT = null, dictP = null;
function loadDict() {
  if (dictP) return dictP;
  dictP = (async () => {
    try {
      const el = document.getElementById('dictdata'); if (!el || typeof DecompressionStream === 'undefined') return null;
      const bin = Uint8Array.from(atob(el.textContent.trim()), c => c.charCodeAt(0));
      const text = await new Response(new Blob([bin]).stream().pipeThrough(new DecompressionStream('gzip'))).text();
      DICT = new Set(text.split(' '));
    } catch (e) { console.warn('dictionary unavailable', e); DICT = null; }
    return DICT;
  })();
  return dictP;
}
const isWord = w => !DICT || DICT.has(w);
function keyboard(onKey, states = {}) {
  const rows = ['qwertyuiop', 'asdfghjkl', '⏎zxcvbnm⌫'];
  return h('div', { class: 'kbd' }, rows.map(r => h('div', null, [...r].map(k => h('button', { class: (k === '⏎' || k === '⌫' ? 'wide ' : '') + (states[k] || ''), 'aria-label': k === '⏎' ? 'Enter' : k === '⌫' ? 'Delete' : k, onclick: () => onKey(k === '⏎' ? 'Enter' : k === '⌫' ? 'Backspace' : k) }, k === '⏎' ? 'Enter' : k)))));
}
function scoreGuess(guess, ans) {
  const res = Array(5).fill('x'); const left = {};
  for (let i = 0; i < 5; i++) { if (guess[i] === ans[i]) res[i] = 'g'; else left[ans[i]] = (left[ans[i]] || 0) + 1; }
  for (let i = 0; i < 5; i++) if (res[i] !== 'g' && left[guess[i]]) { res[i] = 'y'; left[guess[i]]--; }
  return res;
}

// ---------- Word Duel ----------
const wdDone = (g, s) => { const sec = g.state.secret && g.state.secret[other(s)]; const gs = (g.state.guesses && g.state.guesses[s]) || []; return !!sec && (gs.includes(sec) || gs.length >= 6); };
const wdScore = (g, s) => { const sec = g.state.secret[other(s)]; const gs = g.state.guesses[s] || []; return gs.includes(sec) ? gs.indexOf(sec) + 1 : 7; };
GAMES.wordduel = {
  id: 'wordduel', cat: 'word', name: 'Word Duel', icon: '🔤', tint: '#c9a2ff', blurb: 'Pick a secret 5-letter word for each other. Fewer guesses wins.',
  how: 'Each of you secretly picks a 5-letter word. Then you each try to guess the other’s word in 6 tries: green means right letter, right spot; yellow means the letter is in the word somewhere. Whoever needs fewer guesses wins.',
  init: () => ({ state: { secret: {}, guesses: { p1: [], p2: [] } }, turn: null }),
  needs: (g, s) => g.status === 'active' && (!(g.state.secret && g.state.secret[s]) || (!!(g.state.secret && g.state.secret[other(s)]) && !wdDone(g, s))),
  line: (g, s) => { const sec = g.state.secret || {}; if (!sec[s]) return 'Pick your secret word'; if (!sec[other(s)]) return `${nm(other(s))} is picking a word`; if (!wdDone(g, s)) return `Guess ${nm(other(s))}’s word`; return `${nm(other(s))} is still guessing`; },
  side: (g, s) => { const gs = (g.state.guesses && g.state.guesses[s]) || []; return wdDone(g, s) ? (wdScore(g, s) === 7 ? 'missed it' : `got it in ${wdScore(g, s)}`) : `${gs.length}/6 guesses`; },
  create(el, api) {
    const box = h('div', { style: 'display:flex;flex-direction:column;gap:10px' }); el.append(box);
    let typed = '', busy = false; loadDict().then(() => render(api.g()));
    let oppT = ''; const offLive = api.live.on(o => { const t = (o && o.t) || ''; if (t !== oppT) { oppT = t; render(api.g()); } });
    const kd = e => { if (e.target.closest && e.target.closest('input,textarea')) return; if (e.key === 'Enter' || e.key === 'Backspace' || /^[a-z]$/i.test(e.key)) { e.preventDefault(); key(e.key.length === 1 ? e.key.toLowerCase() : e.key); } };
    addEventListener('keydown', kd);
    function key(k) {
      const g = api.g(); if (g.status !== 'active' || busy) return;
      const sec = g.state.secret || {}; const mode = !sec[api.me] ? 'secret' : (sec[api.op] && !wdDone(g, api.me)) ? 'guess' : null; if (!mode) return;
      if (k === 'Backspace') typed = typed.slice(0, -1);
      else if (k === 'Enter') submit(mode);
      else if (typed.length < 5) typed += k;
      if (mode === 'guess') api.live.send(typed ? { t: typed } : null);
      render(api.g());
    }
    async function submit(mode) {
      if (typed.length !== 5) { toast('Five letters, please'); return; }
      await loadDict(); if (!isWord(typed)) { toast('Not in the word list'); sfx('bad'); return; }
      busy = true; const w = typed; typed = ''; api.live.send(null);
      try {
        if (mode === 'secret') { await api.patch({ state: { secret: { [api.me]: w } } }); sfx('coin'); toast('Locked in. No peeking!'); }
        else {
          const gs = [...(api.g().state.guesses[api.me] || []), w]; await api.patch({ state: { guesses: { [api.me]: gs } } });
          const g = api.g(); sfx(w === g.state.secret[api.op] ? 'win' : 'tap');
          if (wdDone(g, api.me) && wdDone(g, api.op)) { const a = wdScore(g, 'p1'), b = wdScore(g, 'p2'); await api.finish(a === b ? 'tie' : a < b ? 'p1' : 'p2', { scores: { p1: a === 7 ? 'X' : a, p2: b === 7 ? 'X' : b } }); }
        }
      } finally { busy = false; render(api.g()); }
    }
    function rows(guesses, ans, live) {
      const out = [];
      for (let i = 0; i < 6; i++) {
        const gw = guesses[i]; const isLive = !gw && live && i === guesses.length; const word = gw || (isLive ? typed : '');
        const sc = gw ? scoreGuess(gw, ans) : null;
        out.push(h('div', { class: 'wrow' }, Array.from({ length: 5 }, (_, j) => h('div', { class: 'wcell ' + (sc ? sc[j] : '') }, word[j] || ''))));
      }
      return h('div', { style: 'display:flex;flex-direction:column;gap:5px' }, out);
    }
    function render(g) {
      const sec = g.state.secret || {}; const mine = g.state.guesses[api.me] || []; const theirs = g.state.guesses[api.op] || [];
      box.replaceChildren();
      if (!sec[api.me] && g.status === 'active') {
        box.append(h('p', { style: 'text-align:center;font-weight:800' }, `Pick a 5-letter word for ${nm(api.op)} to guess`),
          h('div', { class: 'wrow' }, Array.from({ length: 5 }, (_, j) => h('div', { class: 'wcell' }, typed[j] || ''))), keyboard(key));
        return;
      }
      if (!sec[api.op] && g.status === 'active') { box.append(h('p', { class: 'note', style: 'text-align:center' }, `Your word is ${sec[api.me].toUpperCase()}. Waiting for ${nm(api.op)} to pick theirs.`)); return; }
      const ans = sec[api.op]; const live = g.status === 'active' && !wdDone(g, api.me);
      const states = {}; mine.forEach(w => scoreGuess(w, ans).forEach((s, i) => { const k = w[i]; if (s === 'g' || (s === 'y' && states[k] !== 'g') || (!states[k])) states[k] = s === 'g' ? 'g' : s === 'y' ? (states[k] === 'g' ? 'g' : 'y') : (states[k] || 'x'); }));
      box.append(h('p', { class: 'lbl', style: 'text-align:center' }, `Guess ${nm(api.op)}’s word`), rows(mine, ans, live));
      if (live) box.append(keyboard(key, states));
      else box.append(h('p', { style: 'text-align:center;font-weight:800' }, mine.includes(ans) ? `Got it in ${mine.indexOf(ans) + 1}!` : `The word was ${ans.toUpperCase()}`));
      box.append(h('div', { class: 'card', style: 'gap:8px' }, h('p', { class: 'lbl' }, `${nm(api.op)} guessing your word ${sec[api.me].toUpperCase()}`),
        h('div', { style: 'display:flex;flex-direction:column;gap:3px;max-width:150px;margin:0 auto;width:100%' }, theirs.map(w => h('div', { class: 'wrow', style: 'gap:3px' }, scoreGuess(w, sec[api.me]).map(s => h('div', { class: 'wcell ' + s, style: 'font-size:0;border-radius:4px;border-width:1px' })))), theirs.length ? null : h('p', { class: 'faint', style: 'text-align:center;font-size:13px' }, 'No guesses yet')), oppT ? h('div', { class: 'livebox' }, h('span', { class: 'livedot' }), `${nm(api.op)} is typing: ${oppT.toUpperCase()}`) : null));
    }
    return { update: render, destroy() { removeEventListener('keydown', kd); offLive(); } };
  },
};

// ---------- Word Chain ----------
const CHAIN_START = ['apple', 'river', 'candle', 'garden', 'pillow', 'sunset', 'orange', 'rocket', 'window', 'basket', 'coffee', 'island', 'pencil', 'dream', 'music', 'tiger', 'heart', 'cloud', 'mango', 'violin'];
const chainMin = n => Math.min(6, 3 + Math.floor(n / 10));
GAMES.wordchain = {
  id: 'wordchain', cat: 'word', name: 'Word Chain', icon: '🔗', tint: '#7fe0b6', blurb: 'Each word starts with the last letter of the one before.',
  how: 'Take turns adding a real English word that starts with the last letter of the previous word. No repeats, and the minimum length grows as the chain gets longer. Longer words score more. Passing costs a life; lose all 3 and you lose. After 15 words each, the higher score wins.',
  init: seed => ({ state: { words: [{ w: CHAIN_START[hashStr(seed) % CHAIN_START.length], by: null }], lives: { p1: 3, p2: 3 }, pts: { p1: 0, p2: 0 } }, turn: undefined }),
  side: (g, s) => `${g.state.pts[s]} pts · ${'❤'.repeat(g.state.lives[s])}`,
  create(el, api) {
    const chain = h('div', { class: 'chips', style: 'justify-content:center' });
    const prompt = h('div', { style: 'text-align:center' });
    const inp = h('input', { class: 'inp', id: 'chain-input', autocomplete: 'off', autocapitalize: 'none', spellcheck: 'false', placeholder: 'Your word', maxlength: 20, style: 'font-size:18px;text-align:center' });
    const go = h('button', { class: 'btn', onclick: () => submit() }, 'Play word');
    const pass = h('button', { class: 'btn ghost small', onclick: () => doPass() }, 'Pass (lose a life)');
    const form = h('form', { style: 'display:flex;flex-direction:column;gap:8px;max-width:360px;margin:0 auto;width:100%', onsubmit: e => { e.preventDefault(); submit(); } }, inp, h('div', { class: 'gfoot' }, go, pass));
    const liveEl = h('div', { class: 'livebox', hidden: true }); const ma = moveAnim(api);
    inp.addEventListener('input', () => api.live.send(inp.value.trim() ? { t: inp.value.trim().slice(0, 20) } : null));
    const offLive = api.live.on(o => { const t = o && o.t; liveEl.hidden = !t; if (t) liveEl.replaceChildren(h('span', { class: 'livedot' }), `${nm(api.op)} is typing: ${t}`); });
    el.append(prompt, liveEl, chain, form); loadDict();
    async function submit() {
      if (!api.myTurn()) return; const w = inp.value.trim().toLowerCase().replace(/[^a-z]/g, ''); const S_ = clone(api.g().state);
      const last = S_.words[S_.words.length - 1].w; const need = last[last.length - 1]; const min = chainMin(S_.words.length);
      if (!w) return; if (w[0] !== need) { toast(`It has to start with “${need.toUpperCase()}”`); sfx('bad'); return; }
      if (w.length < min) { toast(`At least ${min} letters now`); sfx('bad'); return; }
      if (S_.words.some(x => x.w === w)) { toast('Already used'); sfx('bad'); return; }
      await loadDict(); if (!isWord(w)) { toast('Not in the word list'); sfx('bad'); return; }
      inp.value = ''; api.live.send(null); S_.words.push({ w, by: api.me }); S_.pts[api.me] += w.length; sfx('coin');
      const played = S_.words.filter(x => x.by).length;
      if (played >= 30) { const a = S_.pts.p1, b = S_.pts.p2; await api.win(S_, a === b ? 'tie' : a > b ? 'p1' : 'p2', { scores: { p1: a, p2: b } }); }
      else await api.commit(S_, api.op);
    }
    async function doPass() {
      if (!api.myTurn()) return; const S_ = clone(api.g().state); S_.lives[api.me]--; sfx('bad'); api.live.send(null);
      if (S_.lives[api.me] <= 0) await api.win(S_, api.op, { scores: { p1: S_.pts.p1, p2: S_.pts.p2 } }); else await api.commit(S_, api.op);
    }
    function render(g) {
      const ws = g.state.words; const last = ws[ws.length - 1].w; const need = last[last.length - 1];
      prompt.replaceChildren(h('p', { class: 'lbl' }, g.status === 'active' ? (api.myTurn() ? 'Your word starts with' : `${nm(g.turn)}’s word starts with`) : 'Final chain'),
        g.status === 'active' ? h('div', { style: 'font-family:var(--f-display);font-size:64px;line-height:1.1;color:var(--lamp)' }, need.toUpperCase()) : null,
        g.status === 'active' ? h('p', { class: 'faint', style: 'font-size:13px;font-weight:700' }, `At least ${chainMin(ws.length)} letters · ${ws.filter(x => x.by).length}/30 words played`) : null);
      const pop = ma(g, String(ws.length)); const vis = ws.slice(-18);
      chain.replaceChildren(...vis.map((x, j) => h('span', { class: 'chip' + (pop && j === vis.length - 1 ? ' popin' : ''), style: x.by ? `border-color:${SEATCOL[x.by]}55;color:${SEATCOL[x.by]}` : '' }, x.w)));
      form.hidden = !api.myTurn();
    }
    return { update: render, destroy: () => offLive() };
  },
};
GAMES.wordchain.init = (seed, first) => ({ state: { words: [{ w: CHAIN_START[hashStr(seed) % CHAIN_START.length], by: null }], lives: { p1: 3, p2: 3 }, pts: { p1: 0, p2: 0 } }, turn: first });

// ---------- Draw & Guess ----------
const DRAW_WORDS = ('cat,dog,house,tree,sun,moon,star,car,bicycle,pizza,cake,ice cream,heart,flower,fish,bird,rainbow,umbrella,guitar,phone,clock,glasses,hat,shoe,boat,plane,train,rocket,apple,banana,coffee,cup,book,key,lamp,chair,bed,door,mountain,beach,cloud,snowman,spider,butterfly,snake,elephant,giraffe,monkey,rabbit,turtle,octopus,crown,ring,gift,balloon,candle,camera,television,laptop,robot,ghost,dragon,castle,bridge,tent,fire,kite,sandwich,burger,donut,cookie,carrot,mushroom,pineapple,watermelon,cherry,popcorn,scissors,pencil,envelope,toothbrush,bathtub,sock,dress,backpack,anchor,lighthouse,volcano,island,palm tree,cactus,leaf,sunflower,rose,bee,ladybug,owl,penguin,whale,shark,crab,frog,duck,pig,cow,horse,chicken,egg,noodles,sushi,taco,hot dog,fries,teapot,fork,spoon,bowl,piano,drum,microphone,headphones,football,basketball,cricket bat,trophy,swing,ladder,hammer,bucket,broom,magnet,light bulb,battery,rain,lightning,snowflake,mermaid,unicorn,alien,pirate,wizard,kiss,hug,wedding,love letter,selfie,auto rickshaw,samosa,chai,dosa,diya,rangoli,taj mahal,moustache,beard,lipstick,perfume,sunglasses,ferris wheel,rollercoaster,fireworks,hot air balloon,treasure,map,compass,skateboard,surfboard,tractor,bus,helicopter,submarine').split(',');
const DG_ROUNDS = 6, DG_COLORS = ['#2a1636', '#e45f80', '#f6a03c', '#3f8f6a', '#4f74d9', '#a77be0', '#8a5638'];
const dgDrawer = (g, r = g.state.round) => r % 2 === 0 ? g.first : other(g.first);
const normWord = s => s.toLowerCase().replace(/[^a-z]/g, '');
GAMES.draw = {
  id: 'draw', cat: 'word', name: 'Draw & Guess', icon: '✏️', tint: '#ffb15c', blurb: 'One draws, the other guesses later from the replay.',
  how: 'Six rounds, taking turns. The artist picks one of three words and draws it, then sends it. The guesser watches the drawing replay and gets 3 guesses: 3 points for the first try, 2 for the second, 1 for the third, and the artist gets 1 point whenever it’s guessed. Most points after 6 rounds wins.',
  init: (seed, first) => ({ state: { round: 0, phase: 'draw', word: null, strokes: [], tries: [], pts: { p1: 0, p2: 0 }, lastRound: null }, turn: first }),
  side: (g, s) => `${g.state.pts[s]} pts`,
  mid: g => `round ${Math.min(DG_ROUNDS, g.state.round + 1)}/${DG_ROUNDS}`,
  create(el, api) {
    const box = h('div', { style: 'display:flex;flex-direction:column;gap:10px;align-items:stretch' }); el.append(box);
    const SZ = 320; let strokes = [], cur = null, color = DG_COLORS[0], width = 4, picked = null, replayStop = null, mode = '', lastKey = '';
    let liveSt = null, liveLbl = null, guessLive = null, oppLive = null, sendT = null;
    const sendStrokes = () => { if (sendT) return; sendT = setTimeout(() => { sendT = null; if (mode !== 'draw') return; const tail = []; let size = 0; for (let i = strokes.length - 1; i >= 0; i--) { const n = JSON.stringify(strokes[i]).length; if (size + n > 3400) break; size += n; tail.unshift(strokes[i]); } api.live.send({ s: tail }); }, 90); };
    const offLive = api.live.on(o => { oppLive = o;
      if (mode === 'wait' && liveSt) { drawStrokes(liveSt.ctx, (o && o.s) || []); if (liveLbl) liveLbl.hidden = !(o && o.s && o.s.length); }
      if (guessLive) { const t = o && o.t; guessLive.hidden = !t; if (t) guessLive.replaceChildren(h('span', { class: 'livedot' }), `${nm(api.op)} is typing: ${t}`); } });
    function paper(canvasW) { const st = stage(box, SZ, SZ, { hFrac: .5, maxW: 460 }); return st; }
    function drawStrokes(ctx, list, upto = Infinity) {
      ctx.fillStyle = '#fffaf2'; ctx.fillRect(0, 0, SZ, SZ); let n = 0;
      for (const s of list) { const p = s.p; if (p.length < 2) continue; ctx.strokeStyle = s.c; ctx.lineWidth = s.w; ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.beginPath(); ctx.moveTo(p[0], p[1]); if (p.length === 2) ctx.lineTo(p[0] + .1, p[1]); for (let i = 2; i < p.length; i += 2) { if (n++ > upto) { ctx.stroke(); return false; } ctx.lineTo(p[i], p[i + 1]); } ctx.stroke(); }
      return true;
    }
    const lastBanner = g => { const L = g.state.lastRound; if (!L) return null; return h('p', { class: 'note', style: 'text-align:center' }, `Last round: ${nm(L.by)} drew “${L.word}” · ` + (L.got ? `${nm(other(L.by))} got it on try ${L.got}` : 'nobody guessed it')); };
    function drawView(g) {
      box.replaceChildren(); if (lastBanner(g)) box.append(lastBanner(g));
      const choices = shuffle(DRAW_WORDS, rng(g.seed + 'r' + g.state.round)).slice(0, 3);
      if (!picked) { box.append(h('p', { style: 'text-align:center;font-weight:800' }, 'Pick a word to draw'), h('div', { class: 'gfoot' }, choices.map(w => h('button', { class: 'btn ghost', onclick: () => { picked = w; strokes = []; drawView(api.g()); } }, w)))); return; }
      box.append(h('p', { style: 'text-align:center;font-weight:800' }, 'Draw: ', h('span', { style: 'color:var(--lamp)' }, picked)));
      const st = paper(); const ctx = st.ctx; const redraw = () => drawStrokes(ctx, strokes); st.fit = (f => () => { f(); redraw(); })(st.fit); st.fit();
      const total = () => strokes.reduce((a, s) => a + s.p.length, 0);
      st.cv.addEventListener('pointerdown', e => { if (total() > 9000) { toast('That’s a lot of ink! Send it.'); return; } const p = st.pt(e); cur = { c: color, w: width, p: [Math.round(p.x), Math.round(p.y)] }; strokes.push(cur); st.cv.setPointerCapture(e.pointerId); redraw(); sendStrokes(); });
      st.cv.addEventListener('pointermove', e => { if (!cur) return; const p = st.pt(e); const n = cur.p.length; if (Math.hypot(p.x - cur.p[n - 2], p.y - cur.p[n - 1]) < 2.5) return; cur.p.push(Math.round(clamp(p.x, 0, SZ)), Math.round(clamp(p.y, 0, SZ))); redraw(); sendStrokes(); });
      const end = () => { cur = null; }; st.cv.addEventListener('pointerup', end); st.cv.addEventListener('pointercancel', end);
      const pal = h('div', { class: 'row', style: 'justify-content:center' });
      const drawPal = () => pal.replaceChildren(...DG_COLORS.map(c => h('button', { 'aria-label': 'Colour', style: `width:30px;height:30px;border-radius:50%;background:${c};border:3px solid ${c === color ? '#ffe4a8' : 'transparent'}`, onclick: () => { color = c; drawPal(); } })),
        h('button', { class: 'chip', 'aria-pressed': width === 4 ? 'true' : 'false', onclick: () => { width = 4; drawPal(); } }, 'Thin'), h('button', { class: 'chip', 'aria-pressed': width === 10 ? 'true' : 'false', onclick: () => { width = 10; drawPal(); } }, 'Thick'));
      drawPal();
      box.append(pal, h('div', { class: 'gfoot' }, h('button', { class: 'btn ghost small', onclick: () => { strokes.pop(); redraw(); sendStrokes(); } }, 'Undo'), h('button', { class: 'btn ghost small', onclick: () => { strokes = []; redraw(); sendStrokes(); } }, 'Clear'),
        h('button', { class: 'btn', onclick: async () => { if (!strokes.length) { toast('Draw something first'); return; } const S_ = clone(api.g().state); S_.word = picked; S_.strokes = strokes; S_.tries = []; S_.phase = 'guess'; picked = null; strokes = []; sfx('coin'); clearTimeout(sendT); sendT = null; api.live.send(null); await api.commit(S_, api.op); } }, 'Send drawing')));
    }
    function guessView(g) {
      box.replaceChildren(); const st = paper(); const ctx = st.ctx; const list = g.state.strokes; const totalPts = list.reduce((a, s) => a + s.p.length / 2, 0);
      st.fit = (f => () => { f(); if (!replayStop) drawStrokes(ctx, list); })(st.fit);
      let shown = 0; replayStop && replayStop(); replayStop = loop(dt => { shown += Math.max(totalPts / 3.5, 40) * dt; if (drawStrokes(ctx, list, shown)) { replayStop && replayStop(); replayStop = null; } });
      const triesLeft = 3 - g.state.tries.length; const isGuesser = api.myTurn();
      box.append(h('div', { class: 'tries', style: 'justify-content:center' }, g.state.tries.map(t => h('span', { style: 'text-decoration:line-through' }, t))));
      if (isGuesser) {
        const inp = h('input', { class: 'inp', id: 'dg-guess', autocomplete: 'off', placeholder: `Your guess (${triesLeft} ${triesLeft === 1 ? 'try' : 'tries'} left)`, maxlength: 30, style: 'text-align:center;font-size:17px', oninput: e => api.live.send(e.target.value.trim() ? { t: e.target.value.trim().slice(0, 30) } : null) });
        const f = h('form', { style: 'display:flex;gap:8px;max-width:380px;margin:0 auto;width:100%', onsubmit: async e => {
          e.preventDefault(); const guess = inp.value.trim(); if (!guess) return; inp.value = ''; api.live.send(null);
          const S_ = clone(api.g().state); const ok = normWord(guess) === normWord(S_.word) || normWord(guess) === normWord(S_.word) + 's'; S_.tries.push(guess);
          const drawer = dgDrawer(api.g());
          if (ok || S_.tries.length >= 3) {
            const got = ok ? S_.tries.length : 0; if (ok) { S_.pts[api.me] += 4 - got; S_.pts[drawer] += 1; sfx('win'); toast(`Yes! It was ${S_.word}`); } else { sfx('lose'); toast(`It was “${S_.word}”`); }
            S_.lastRound = { word: S_.word, by: drawer, got }; S_.round++; S_.phase = 'draw'; S_.word = null; S_.strokes = []; S_.tries = [];
            if (S_.round >= DG_ROUNDS) { const a = S_.pts.p1, b = S_.pts.p2; await api.win(S_, a === b ? 'tie' : a > b ? 'p1' : 'p2', { scores: { p1: a, p2: b } }); }
            else await api.commit(S_, dgDrawer(api.g(), S_.round));
          } else { sfx('bad'); toast('Not quite'); await api.commit(S_, api.me); }
        } }, inp, h('button', { class: 'btn' }, 'Guess'));
        box.append(f);
      } else { guessLive = h('div', { class: 'livebox', hidden: true }); box.append(h('p', { class: 'muted', style: 'text-align:center' }, `You drew “${g.state.word}”. ${nm(api.op)} gets 3 guesses.`), guessLive); const t = oppLive && oppLive.t; if (t) { guessLive.hidden = false; guessLive.replaceChildren(h('span', { class: 'livedot' }), `${nm(api.op)} is typing: ${t}`); } }
    }
    function render(g) {
      const key = g.state.round + ':' + g.state.phase + ':' + (g.state.tries || []).length + ':' + g.status + ':' + g.turn;
      if (key === lastKey && mode) return; lastKey = key; liveSt = null; liveLbl = null; guessLive = null;
      if (g.status === 'done') { replayStop && replayStop(); mode = 'done'; box.replaceChildren(); const L = lastBanner(g); if (L) box.append(L); return; }
      if (g.state.phase === 'draw') { if (dgDrawer(g) === api.me) { if (mode !== 'draw') { mode = 'draw'; drawView(g); } } else { mode = 'wait'; box.replaceChildren(); const L = lastBanner(g); if (L) box.append(L); box.append(h('div', { class: 'empty' }, `${nm(api.op)} is drawing something for you…`)); liveLbl = h('div', { class: 'livebox', hidden: true }, h('span', { class: 'livedot' }), 'Live: watch it being drawn'); box.append(liveLbl); liveSt = paper(); const ls = liveSt; ls.fit = (f => () => { f(); drawStrokes(ls.ctx, (oppLive && oppLive.s) || []); })(ls.fit); ls.fit(); liveLbl.hidden = !(oppLive && oppLive.s && oppLive.s.length); } }
      else { mode = 'guess'; guessView(g); }
    }
    return { update: render, destroy() { replayStop && replayStop(); offLive(); clearTimeout(sendT); } };
  },
};

boot();
