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
