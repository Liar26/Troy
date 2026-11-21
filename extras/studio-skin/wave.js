// Generative art for the hero: a slow, dotted wave sheet (inspired by data-sculpture posters).
// Pure canvas, ~3,000 tiny dots at 30 fps, pauses when off-screen or when the tab is hidden.
// A still frame is drawn for "reduce motion". The cursor gently lifts the surface nearby.
window.TroyWave = {
  start(canvas) {
    if (!canvas) return null;
    const ctx = canvas.getContext('2d');
    const COLS = 100, ROWS = 36;
    const calm = matchMedia('(prefers-reduced-motion: reduce)').matches;
    let w = 0, h = 0, t = calm ? 2.2 : 0, mx = -1, mz = -1, ink = '#999', raf = 0, last = 0, onScreen = true, frames = 0;

    const resize = () => {
      const r = canvas.getBoundingClientRect(), dpr = Math.min(devicePixelRatio || 1, 2);
      w = r.width; h = r.height;
      canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };

    const draw = () => {
      if (frames++ % 90 === 0) ink = getComputedStyle(document.documentElement).getPropertyValue('--text').trim() || ink;
      ctx.clearRect(0, 0, w, h);
      ctx.fillStyle = ink;
      for (let j = 0; j < ROWS; j++) {
        const z = j / (ROWS - 1);                       // 0 = far, 1 = near
        for (let i = 0; i < COLS; i++) {
          const x = i / (COLS - 1);
          let y = Math.sin(x * 7 + t * 0.6 + z * 2.2) * Math.cos(z * 5.5 - t * 0.45)
                + 0.5 * Math.sin(x * 13 - t * 0.8) * Math.sin(z * 9 + t * 0.3);
          if (mx >= 0) { const dx = x - mx, dz = z - mz; y += Math.exp(-(dx * dx + dz * dz) * 28) * 1.3; }
          const spread = 0.75 + 0.45 * z;
          const px = w * (0.5 + (x - 0.5) * spread);
          const py = h * (0.30 + 0.52 * z) - y * h * 0.15 * (0.4 + z);
          const s = 0.7 + z * 1.2;
          ctx.globalAlpha = 0.12 + z * 0.55;
          ctx.fillRect(px, py, s, s);
        }
      }
      ctx.globalAlpha = 1;
    };

    const loop = (now) => {
      raf = requestAnimationFrame(loop);
      if (!onScreen || document.hidden || now - last < 33) return;   // ~30 fps
      last = now; t += 0.016; draw();
    };

    const onMove = (e) => {
      const r = canvas.getBoundingClientRect();
      mx = (e.clientX - r.left) / r.width;
      mz = ((e.clientY - r.top) / r.height - 0.30) / 0.52;
      if (mz < 0 || mz > 1 || mx < 0 || mx > 1) { mx = mz = -1; }
    };

    resize(); draw();
    const io = new IntersectionObserver((es) => { onScreen = es[0].isIntersecting; });
    io.observe(canvas);
    addEventListener('resize', resize);
    if (!calm) {
      if (matchMedia('(pointer: fine)').matches) addEventListener('pointermove', onMove, { passive: true });
      raf = requestAnimationFrame(loop);
    }
    return () => { cancelAnimationFrame(raf); io.disconnect(); removeEventListener('resize', resize); removeEventListener('pointermove', onMove); };
  },
};
