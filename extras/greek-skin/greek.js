// Interactive background: stars in the painted sky glow near the cursor, a soft gold light follows it,
// and the vault + columns drift with mouse and scroll. Pure decoration; calm for reduced-motion users.
(() => {
  const bg = document.querySelector('.bg');
  if (!bg) return;

  // --- stars (same pattern every visit; denser near the top of the sky) ---
  const field = document.createElement('div');
  field.className = 'bg-stars';
  bg.insertBefore(field, bg.querySelector('.bg-glow'));
  let seed = 7;
  const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  const stars = [];
  for (let i = 0; i < 72; i++) {
    const el = document.createElement('i');
    el.className = 'star';
    const fx = rnd(), fy = Math.pow(rnd(), 1.5);
    el.style.cssText = `left:${(fx * 100).toFixed(2)}%;top:${(fy * 80).toFixed(2)}%;` +
      `--s:${3 + Math.floor(rnd() * 8)}px;--o:${(0.35 + rnd() * 0.65).toFixed(2)};--d:${(-rnd() * 7).toFixed(1)}s`;
    field.appendChild(el);
    stars.push({ el, fx, fy: fy * 0.8, b: 0 });
  }

  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  // --- cursor light, parallax, star glow ---
  let x = innerWidth / 2, y = innerHeight * 0.18, tx = x, ty = y, raf = 0;
  const near = matchMedia('(pointer: fine)').matches;

  const tick = () => {
    raf = 0;
    x += (tx - x) * 0.07; y += (ty - y) * 0.07;
    bg.style.setProperty('--mx', x.toFixed(1) + 'px');
    bg.style.setProperty('--my', y.toFixed(1) + 'px');
    bg.style.setProperty('--px', (x / innerWidth - 0.5).toFixed(3));
    bg.style.setProperty('--sy', Math.round(scrollY));
    if (near) {
      for (const s of stars) {
        const d = Math.hypot(s.fx * innerWidth - x, s.fy * innerHeight - y);
        const b = Math.max(0, 1 - d / 230) * 0.6;
        if (Math.abs(b - s.b) > 0.02) { s.b = b; s.el.style.setProperty('--b', b.toFixed(2)); }
      }
    }
    if (Math.abs(tx - x) > 0.5 || Math.abs(ty - y) > 0.5) raf = requestAnimationFrame(tick);
  };
  const kick = () => { if (!raf) raf = requestAnimationFrame(tick); };

  if (near) addEventListener('pointermove', (e) => { tx = e.clientX; ty = e.clientY; kick(); }, { passive: true });
  addEventListener('scroll', kick, { passive: true });
  kick();
})();
