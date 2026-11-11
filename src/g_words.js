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
