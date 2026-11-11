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
