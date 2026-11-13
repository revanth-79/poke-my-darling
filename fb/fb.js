// Firebase layer for Poke My Darling. Exposes window.FB with the small API the app uses.
// Firestore holds pairs, games and chat; Realtime Database carries presence and live views.
import { initializeApp } from 'firebase/app';
import { getAuth, connectAuthEmulator, onAuthStateChanged, GoogleAuthProvider, signInWithPopup, signInWithEmailAndPassword, createUserWithEmailAndPassword, sendPasswordResetEmail, signOut } from 'firebase/auth';
import { initializeFirestore, connectFirestoreEmulator, persistentLocalCache, persistentMultipleTabManager, doc, collection, getDoc, setDoc, updateDoc, deleteDoc, onSnapshot, query, where, orderBy, limit, arrayUnion } from 'firebase/firestore';
import { getDatabase, connectDatabaseEmulator, ref, set, remove, onValue, onDisconnect } from 'firebase/database';

let app, auth, fs, rtdb;

// Firestore can't store an array directly inside an array, and game states use those
// (board rows, shot paths). Wrap inner arrays as {_a:[...]} on the way in, unwrap on the way out.
export function enc(v, inArray) {
  if (Array.isArray(v)) { const a = v.map(x => enc(x, true)); return inArray ? { _a: a } : a; }
  if (v && typeof v === 'object') { const o = {}; for (const k in v) if (v[k] !== undefined) o[k] = enc(v[k], false); return o; }
  return v;
}
export function dec(v) {
  if (Array.isArray(v)) return v.map(dec);
  if (v && typeof v === 'object') { const ks = Object.keys(v); if (ks.length === 1 && ks[0] === '_a' && Array.isArray(v._a)) return v._a.map(dec); const o = {}; for (const k of ks) o[k] = dec(v[k]); return o; }
  return v;
}

function init(config) {
  app = initializeApp(config); auth = getAuth(app);
  try { fs = initializeFirestore(app, { ignoreUndefinedProperties: true, localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }) }); }
  catch { fs = initializeFirestore(app, { ignoreUndefinedProperties: true }); }
  rtdb = getDatabase(app);
  if (config.emulators) { connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true }); connectFirestoreEmulator(fs, '127.0.0.1', 8080); connectDatabaseEmulator(rtdb, '127.0.0.1', 9000); }
}
// The live-play database checks this list before letting anyone read or write a room's live data.
const addLiveMember = (pid, uid) => set(ref(rtdb, `members/${pid}/${uid}`), true).catch(e => { if (!/permission/i.test(String(e && e.message))) throw e; });

const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const rand = (n, chars) => { const b = crypto.getRandomValues(new Uint8Array(n)); return Array.from(b, x => chars[x % chars.length]).join(''); };
const normCode = c => String(c || '').toUpperCase().replace(/[^A-Z0-9]/g, '');

async function profile(uid) { const s = await getDoc(doc(fs, 'users', uid)); return s.exists() ? s.data() : null; }
async function pairInfo(pid) { const s = await getDoc(doc(fs, 'pairs', pid)); return s.exists() ? s.data() : null; }

async function createPair(me) {
  const uid = auth.currentUser.uid; const pid = rand(20, 'abcdefghijklmnopqrstuvwxyz0123456789'); const code = rand(8, CODE_CHARS);
  await setDoc(doc(fs, 'pairs', pid), { members: [uid], code, createdAt: Date.now() });
  await setDoc(doc(fs, 'invites', code), { pid, by: uid, createdAt: Date.now() });
  await setDoc(doc(fs, 'pairs', pid, 'app', 'couple'), { p1: { name: me.name, emoji: me.emoji, uid }, createdAt: Date.now() });
  await addLiveMember(pid, uid);
  await setDoc(doc(fs, 'users', uid), { pid });
  return { pid, code };
}
async function joinPair(codeRaw, me) {
  const uid = auth.currentUser.uid; const code = normCode(codeRaw);
  if (code.length !== 8) throw { code: 'bad-code' };
  const inv = await getDoc(doc(fs, 'invites', code)); if (!inv.exists()) throw { code: 'bad-code' };
  const { pid, by } = inv.data(); if (by === uid) throw { code: 'own-code' };
  try { await updateDoc(doc(fs, 'pairs', pid), { members: arrayUnion(uid) }); } catch (e) { throw { code: 'code-used', cause: e }; }
  await setDoc(doc(fs, 'pairs', pid, 'app', 'couple'), { p2: { name: me.name, emoji: me.emoji, uid } }, { merge: true });
  await addLiveMember(pid, uid);
  await setDoc(doc(fs, 'users', uid), { pid });
  return { pid };
}

// ---- document store with the same small surface the app already used ----
function db(pid) {
  const base = ['pairs', pid];
  const meta = s => ({ fromCache: s.metadata.fromCache, hasPendingWrites: s.metadata.hasPendingWrites });
  const wrapDoc = s => ({ id: s.id, exists: s.exists(), data: () => (s.exists() ? dec(s.data()) : undefined), metadata: meta(s) });
  const wrapQ = s => ({ docs: s.docs.map(wrapDoc), size: s.size, empty: s.empty, docChanges: () => [], metadata: meta(s) });
  function docRef(path) {
    const r = doc(fs, ...base, ...path.split('/'));
    return { id: r.id, path,
      get: async () => wrapDoc(await getDoc(r)),
      set: d => setDoc(r, enc(d)),
      update: d => setDoc(r, enc(d), { merge: true }),
      delete: () => deleteDoc(r),
      onSnapshot: (next, err) => onSnapshot(r, s => next(wrapDoc(s)), err) };
  }
  function q(col, cons = []) {
    const build = () => query(collection(fs, ...base, ...col.split('/')), ...cons);
    return { path: col,
      where: (f, op, v) => q(col, [...cons, where(f, op, v)]),
      orderBy: (f, d = 'asc') => q(col, [...cons, orderBy(f, d)]),
      limit: n => q(col, [...cons, limit(n)]),
      onSnapshot: (next, err) => onSnapshot(build(), s => next(wrapQ(s)), err),
      doc: id => docRef(col + '/' + id) };
  }
  return { doc: docRef, collection: c => q(c) };
}

// ---- presence and live views ----
const parse = s => { try { return JSON.parse(s); } catch { return null; } };
function makeRoom(pid, sub, uid) {
  const base = `live/${pid}/${sub}`; const meRef = ref(rtdb, `${base}/p/${uid}`);
  let state = null; const offs = []; const seenEv = {};
  const push = () => { if (!state) return Promise.resolve(); onDisconnect(meRef).remove().catch(() => {}); return set(meRef, JSON.stringify(state)); };
  // after a dropped connection the server clears our presence; put it back when we return
  offs.push(onValue(ref(rtdb, '.info/connected'), s => { if (s.val() === true && state) push().catch(() => {}); }));
  return {
    presence(patch) { state = state || {}; for (const k in patch) { if (patch[k] === null || patch[k] === undefined) delete state[k]; else state[k] = patch[k]; } return push(); },
    onPeers(fn, err) { const off = onValue(ref(rtdb, `${base}/p`), s => { const v = s.val() || {}; fn({ peers: Object.entries(v).map(([k, j]) => ({ isMe: k === uid, presence: parse(j) || {} })) }); }, err); offs.push(off); return off; },
    emit(topic, data) { return set(ref(rtdb, `${base}/e/${topic}/${uid}`), JSON.stringify({ d: data, t: Date.now() })); },
    on(topic, fn, err) {
      const off = onValue(ref(rtdb, `${base}/e/${topic}`), s => { const v = s.val() || {}; for (const k in v) { const m = parse(v[k]); if (!m || m.t === seenEv[topic + k]) continue; const first = seenEv[topic + k] === undefined; seenEv[topic + k] = m.t; if (first && Date.now() - m.t > 8000) continue; fn({ isMe: k === uid, data: m.d }); } }, err);
      offs.push(off); return off;
    },
    leave() { offs.forEach(f => { try { f(); } catch {} }); state = null; onDisconnect(meRef).cancel().catch(() => {}); return remove(meRef); },
    join: name => Promise.resolve(makeRoom(pid, 'r/' + name, uid)),
  };
}

window.FB = {
  init, enc, dec, normCode,
  onAuth: cb => onAuthStateChanged(auth, cb),
  signInGoogle: () => signInWithPopup(auth, new GoogleAuthProvider()),
  signInEmail: (e, p) => signInWithEmailAndPassword(auth, e, p),
  signUpEmail: (e, p) => createUserWithEmailAndPassword(auth, e, p),
  resetPassword: e => sendPasswordResetEmail(auth, e),
  signOut: () => signOut(auth),
  profile, pairInfo, createPair, joinPair, db,
  room: (pid, uid) => makeRoom(pid, 'lobby', uid),
};
