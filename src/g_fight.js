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
