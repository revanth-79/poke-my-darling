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
