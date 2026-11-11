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
