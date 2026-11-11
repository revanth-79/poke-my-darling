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
