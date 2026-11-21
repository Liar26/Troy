// TROY background art: quiet generative backgrounds drawn live on one canvas.
// Click "Art" in the header to change style (remembered). Styles:
//   ink      layered misty mountains, like ink wash painting
//   contours topographic map lines that slowly drift
//   cloud    a dotted point-cloud sculpture that turns slowly
//   flow     fine flowing lines, drawn once
//   glow     the day's painting, blurred into soft colour
//   waves, stars, halftone, aurora, rings: five more (ridgelines, constellation, halftone dots, watercolour, moiré)
//   off      plain
// By default a different design is drawn on every visit or refresh (never the same twice in a row).
// Click the Art button to lock one design instead.
// Everything is calm: low contrast, slow, pauses when the tab is hidden, and still for "reduce motion".
(() => {
  const canvas = document.getElementById('art');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const glowEl = document.getElementById('art-glow');
  const btn = document.getElementById('art-toggle');
  const label = document.getElementById('art-name');

  const DESIGNS = [['ink', 'Ink wash'], ['contours', 'Contours'], ['cloud', 'Point cloud'], ['flow', 'Flow lines'], ['glow', 'Painting glow'],
    ['waves', 'Ridgelines'], ['stars', 'Constellation'], ['halftone', 'Halftone'], ['aurora', 'Watercolour'], ['rings', 'Moiré rings']];
  const MODES = [['shuffle', 'Surprise me'], ...DESIGNS, ['off', 'Plain']];   // Surprise = a different design on every visit
  const still = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const finePointer = matchMedia('(pointer: fine)').matches;

  // pref = what the person chose ('shuffle' by default); mode = the design actually showing right now.
  let pref = 'shuffle';
  try { const m = localStorage.getItem('troy.art2'); if (MODES.some((x) => x[0] === m)) pref = m; } catch { /* private mode */ }
  function drawLots() {                                   // a random design, never the same as last visit
    let last = ''; try { last = localStorage.getItem('troy.art.last') || ''; } catch { /* ignore */ }
    const pool = DESIGNS.map((d) => d[0]).filter((k) => k !== last);
    const m = pool[Math.floor(Math.random() * pool.length)];
    try { localStorage.setItem('troy.art.last', m); } catch { /* ignore */ }
    return m;
  }
  let mode = pref === 'shuffle' ? drawLots() : pref;

  let W = 0, H = 0, dpr = 1, t = still ? 4 : 0, raf = 0, last = 0;
  let px = 0.5, py = 0.5, tpx = 0.5, tpy = 0.5;           // pointer (eased)
  let C = colors(), layers = [], sun = null, flowImg = null, pts = null;

  /* ---------- helpers ---------- */
  function colors() {
    const cs = getComputedStyle(document.documentElement);
    return { bg: cs.getPropertyValue('--bg').trim() || '#111', ink: cs.getPropertyValue('--text').trim() || '#222', accent: cs.getPropertyValue('--accent').trim() || '#4a7',
      light: document.documentElement.dataset.theme === 'light' };
  }
  const rgba = (hex, a) => {
    const h = hex.replace('#', ''), n = parseInt(h.length === 3 ? h.replace(/./g, '$&$&') : h, 16);
    return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
  };
  let seed = 1;
  const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;

  // Perlin noise (2D), output about -1..1
  const perm = (() => {
    const base = [...Array(256).keys()]; let s = 11;
    for (let i = 255; i > 0; i--) { s = (s * 16807) % 2147483647; const j = s % (i + 1); [base[i], base[j]] = [base[j], base[i]]; }
    return Uint8Array.from({ length: 512 }, (_, i) => base[i & 255]);
  })();
  const fade = (u) => u * u * u * (u * (u * 6 - 15) + 10);
  const grad = (h, x, y) => { switch (h & 7) { case 0: return x + y; case 1: return -x + y; case 2: return x - y; case 3: return -x - y; case 4: return x; case 5: return -x; case 6: return y; default: return -y; } };
  const noise = (x, y) => {
    const X = Math.floor(x) & 255, Y = Math.floor(y) & 255; x -= Math.floor(x); y -= Math.floor(y);
    const u = fade(x), v = fade(y), a = perm[X] + Y, b = perm[X + 1] + Y;
    const l1 = grad(perm[a], x, y) + u * (grad(perm[b], x - 1, y) - grad(perm[a], x, y));
    const l2 = grad(perm[a + 1], x, y - 1) + u * (grad(perm[b + 1], x - 1, y - 1) - grad(perm[a + 1], x, y - 1));
    return l1 + v * (l2 - l1);
  };
  const fbm = (x, y, o = 4) => { let s = 0, a = 1, f = 1, n = 0; for (let i = 0; i < o; i++) { s += a * noise(x * f, y * f); n += a; a *= 0.5; f *= 2; } return s / n; };

  /* ---------- 1. ink wash: layered misty mountains ---------- */
  function buildInk() {
    layers = [];
    const N = 6, pad = 160;
    for (let k = 0; k < N; k++) {
      const depth = k / (N - 1);                                   // 0 far ... 1 near
      const cv = document.createElement('canvas');
      cv.width = Math.round((W + pad * 2) * dpr); cv.height = Math.round(H * dpr);
      const g = cv.getContext('2d'); g.setTransform(dpr, 0, 0, dpr, 0, 0);
      const base = H * (0.42 + depth * 0.38), amp = H * (0.2 - depth * 0.08), freq = 0.0016 + depth * 0.0017;
      g.beginPath(); g.moveTo(0, H);
      for (let x = 0; x <= W + pad * 2; x += 4) {
        const n = fbm(x * freq + 3 + k * 17, k * 3.7, 4);
        g.lineTo(x, base - Math.pow(Math.max(0, n + 0.25), 1.35) * amp * 1.9);
      }
      g.lineTo(W + pad * 2, H); g.closePath();
      const a = C.light ? 0.07 + depth * 0.13 : 0.03 + depth * 0.05;
      const gr = g.createLinearGradient(0, base - amp * 1.6, 0, H);
      gr.addColorStop(0, rgba(C.ink, a * 1.5)); gr.addColorStop(0.55, rgba(C.ink, a)); gr.addColorStop(1, rgba(C.ink, 0)); // dissolves into mist
      g.fillStyle = gr; g.fill();
      layers.push({ cv, depth });
    }
    sun = { x: W * (W < 700 ? 0.7 : 0.74), y: H * 0.26, r: Math.min(W, H) * 0.075 };
  }
  function drawInk() {
    ctx.clearRect(0, 0, W, H);
    const gr = ctx.createRadialGradient(sun.x, sun.y, 0, sun.x, sun.y, sun.r * 1.15);
    gr.addColorStop(0, rgba(C.accent, C.light ? 0.3 : 0.22)); gr.addColorStop(0.85, rgba(C.accent, C.light ? 0.22 : 0.16)); gr.addColorStop(1, rgba(C.accent, 0));
    ctx.fillStyle = gr; ctx.beginPath(); ctx.arc(sun.x, sun.y, sun.r * 1.15, 0, 6.2832); ctx.fill();
    for (const L of layers) {
      const dx = -160 - (px - 0.5) * 46 * (0.3 + L.depth) + Math.sin(t * 0.05 + L.depth * 4) * 12 * L.depth;
      ctx.drawImage(L.cv, dx, 0, L.cv.width / dpr, L.cv.height / dpr);
    }
  }

  /* ---------- 2. contours: topographic lines (marching squares) ---------- */
  function drawContours() {
    ctx.clearRect(0, 0, W, H);
    const cell = 14, cols = Math.ceil(W / cell) + 1, rows = Math.ceil(H / cell) + 1, s = 0.0017;
    const f = new Float32Array(cols * rows);
    for (let j = 0; j < rows; j++) for (let i = 0; i < cols; i++) {
      const x = i * cell, y = j * cell;
      let v = fbm(x * s + t * 0.03 + 5, y * s - t * 0.02 + 9, 3);
      const dx = (x / W - px) * (W / H), dy = y / H - py;
      v += 0.32 * Math.exp(-(dx * dx + dy * dy) * 16);              // the cursor lifts the land
      f[j * cols + i] = v;
    }
    const thin = new Path2D(), bold = new Path2D();
    for (let li = 0, lv = -0.7; lv <= 0.75; lv += 0.07, li++) {
      const P = li % 5 === 0 ? bold : thin;
      for (let j = 0; j < rows - 1; j++) for (let i = 0; i < cols - 1; i++) {
        const a = f[j * cols + i], b = f[j * cols + i + 1], c = f[(j + 1) * cols + i + 1], d = f[(j + 1) * cols + i];
        const idx = (a > lv ? 8 : 0) | (b > lv ? 4 : 0) | (c > lv ? 2 : 0) | (d > lv ? 1 : 0);
        if (idx === 0 || idx === 15) continue;
        const x0 = i * cell, y0 = j * cell;
        const T = [x0 + ((lv - a) / (b - a)) * cell, y0], R = [x0 + cell, y0 + ((lv - b) / (c - b)) * cell];
        const B = [x0 + ((lv - d) / (c - d)) * cell, y0 + cell], Lf = [x0, y0 + ((lv - a) / (d - a)) * cell];
        const seg = (p, q) => { P.moveTo(p[0], p[1]); P.lineTo(q[0], q[1]); };
        switch (idx) {
          case 1: case 14: seg(Lf, B); break;
          case 2: case 13: seg(B, R); break;
          case 3: case 12: seg(Lf, R); break;
          case 4: case 11: seg(T, R); break;
          case 5: seg(T, Lf); seg(B, R); break;
          case 6: case 9: seg(T, B); break;
          case 7: case 8: seg(T, Lf); break;
          case 10: seg(T, R); seg(Lf, B); break;
        }
      }
    }
    ctx.lineJoin = 'round';
    ctx.strokeStyle = rgba(C.accent, C.light ? 0.3 : 0.22); ctx.lineWidth = 0.7; ctx.stroke(thin);
    ctx.strokeStyle = rgba(C.accent, C.light ? 0.5 : 0.4); ctx.lineWidth = 1.2; ctx.stroke(bold);
  }

  /* ---------- 3. point cloud: a dotted hourglass vortex ---------- */
  function buildCloud() {
    const nu = 150, nv = 46, out = [];
    seed = 5;
    for (let iu = 0; iu < nu; iu++) {
      const u = iu / (nu - 1), h = (u - 0.5) * 2, R = 0.16 + 0.62 * Math.pow(Math.abs(h), 1.6);
      for (let iv = 0; iv < nv; iv++) {
        const tw = (iv / nv) * 6.2832 + h * 2.4;
        const wob = 1 + 0.24 * noise(Math.cos(tw) * 1.3 + u * 3, Math.sin(tw) * 1.3 - u * 2);
        const disperse = Math.pow(Math.abs(h), 3) * 0.28;            // ends dissolve into dust
        out.push(R * wob * Math.cos(tw) + (rnd() - 0.5) * disperse, h * 0.95 + (rnd() - 0.5) * disperse * 0.8, R * wob * Math.sin(tw) + (rnd() - 0.5) * disperse);
      }
    }
    pts = Float32Array.from(out);
  }
  function drawCloud() {
    ctx.clearRect(0, 0, W, H);
    const a = t * 0.22 + (px - 0.5) * 1.1, b = 0.32 + (py - 0.5) * 0.3;
    const ca = Math.cos(a), sa = Math.sin(a), cb = Math.cos(b), sb = Math.sin(b);
    const cx = W < 700 ? W * 0.5 : W * 0.7, cy = H * 0.52, sc = Math.min(W, H) * 0.52;
    ctx.fillStyle = C.ink;
    for (let i = 0; i < pts.length; i += 3) {
      const x = pts[i], y = pts[i + 1], z = pts[i + 2];
      const x1 = x * ca + z * sa, z1 = -x * sa + z * ca;
      const y2 = y * cb - z1 * sb, z2 = y * sb + z1 * cb;
      const s = 1 / (1.8 - z2 * 0.6), depth = z2 * 0.5 + 0.5;
      ctx.globalAlpha = (C.light ? 0.2 : 0.16) + depth * (C.light ? 0.5 : 0.42);
      const r = 0.6 + depth * 1.0;
      ctx.fillRect(cx + x1 * sc * s, cy + y2 * sc * s, r, r);
    }
    ctx.globalAlpha = 1;
  }

  /* ---------- 4. flow lines: drawn once ---------- */
  function buildFlow() {
    flowImg = document.createElement('canvas');
    flowImg.width = Math.round(W * dpr); flowImg.height = Math.round(H * dpr);
    const g = flowImg.getContext('2d'); g.setTransform(dpr, 0, 0, dpr, 0, 0);
    seed = 9; g.lineWidth = 0.6; g.lineCap = 'round';
    const n = Math.round(Math.min(2600, (W * H) / 520));
    for (let p = 0; p < n; p++) {
      let x = rnd() * W, y = rnd() * H;
      g.beginPath(); g.moveTo(x, y);
      for (let s = 0; s < 110; s++) {
        const ang = fbm(x * 0.0018 + 2, y * 0.0018 + 7, 3) * 6.2832 * 1.3 + 0.6;
        x += Math.cos(ang) * 2.2; y += Math.sin(ang) * 2.2; g.lineTo(x, y);
      }
      g.strokeStyle = rgba(rnd() < 0.55 ? C.accent : C.ink, (C.light ? 0.1 : 0.08) + rnd() * 0.08);
      g.stroke();
    }
    g.globalCompositeOperation = 'destination-in';                  // soft vignette so edges stay quiet
    const v = g.createRadialGradient(W * 0.6, H * 0.45, Math.min(W, H) * 0.15, W * 0.6, H * 0.45, Math.max(W, H) * 0.75);
    v.addColorStop(0, 'rgba(0,0,0,1)'); v.addColorStop(1, 'rgba(0,0,0,0.12)');
    g.fillStyle = v; g.fillRect(0, 0, W, H);
  }
  function drawFlow() { ctx.clearRect(0, 0, W, H); ctx.drawImage(flowImg, 0, 0, W, H); }


  /* ---------- 5. ridgelines: stacked lines pushed up by a moving ridge ---------- */
  function drawWaves() {
    ctx.clearRect(0, 0, W, H);
    const rows = Math.round(Math.min(46, H / 16)), top = H * 0.2, span = H * 0.7, step = 6;
    ctx.lineWidth = 1; ctx.lineJoin = 'round';
    for (let r = 0; r < rows; r++) {
      const y0 = top + (r / (rows - 1)) * span;
      ctx.beginPath();
      for (let x = 0; x <= W + step; x += step) {
        const u = x / W, centre = Math.exp(-Math.pow((u - (0.62 + (px - 0.5) * 0.1)) * 3.2, 2));
        const n = fbm(x * 0.006 + t * 0.12, r * 0.22 + t * 0.03, 3);
        const y = y0 - (Math.max(0, n + 0.35) * centre * 120 + centre * noise(x * 0.02, r + t * 0.2) * 14);
        x === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
      }
      ctx.save(); ctx.strokeStyle = rgba(r % 6 === 0 ? C.accent : C.ink, C.light ? 0.45 : 0.4); ctx.stroke(); ctx.restore();
      ctx.lineTo(W, H); ctx.lineTo(0, H); ctx.closePath(); ctx.fillStyle = rgba(C.bg, 0.96); ctx.fill();   // hides the lines behind
    }
  }

  /* ---------- 6. constellation: drifting points joined by fine lines ---------- */
  let stars = null;
  function buildStars() {
    seed = 21; const n = Math.round(Math.min(170, (W * H) / 9000));
    stars = Array.from({ length: n }, () => ({ x: rnd() * W, y: rnd() * H, vx: (rnd() - 0.5) * 0.12, vy: (rnd() - 0.5) * 0.12, r: 0.8 + rnd() * 1.4 }));
  }
  function drawStars() {
    ctx.clearRect(0, 0, W, H);
    const mx = px * W, my = py * H, R = Math.min(230, W / 5);
    for (const s of stars) {
      s.x += s.vx; s.y += s.vy;
      if (s.x < -10) s.x = W + 10; else if (s.x > W + 10) s.x = -10;
      if (s.y < -10) s.y = H + 10; else if (s.y > H + 10) s.y = -10;
    }
    ctx.lineWidth = 0.7;
    for (let i = 0; i < stars.length; i++) for (let j = i + 1; j < stars.length; j++) {
      const a = stars[i], b = stars[j], d = Math.hypot(a.x - b.x, a.y - b.y);
      if (d < R) { ctx.strokeStyle = rgba(C.accent, (1 - d / R) * (C.light ? 0.75 : 0.6)); ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke(); }
    }
    for (const s of stars) {
      const near = Math.max(0, 1 - Math.hypot(s.x - mx, s.y - my) / 220);
      ctx.fillStyle = rgba(near > 0.2 ? C.accent : C.ink, (C.light ? 0.7 : 0.6) + near * 0.3);
      ctx.beginPath(); ctx.arc(s.x, s.y, s.r + near * 1.6, 0, 6.2832); ctx.fill();
    }
  }

  /* ---------- 7. halftone: a dot field that swells and shrinks like print ---------- */
  function drawHalftone() {
    ctx.clearRect(0, 0, W, H);
    const cell = W < 700 ? 18 : 24;
    ctx.fillStyle = rgba(C.ink, C.light ? 0.15 : 0.13);
    for (let y = cell / 2; y < H; y += cell) for (let x = cell / 2 + ((Math.round(y / cell) % 2) * cell) / 2; x < W; x += cell) {
      const n = fbm(x * 0.0021 + t * 0.03, y * 0.0021 - t * 0.02, 3) + 0.5 * (1 - Math.hypot(x / W - px, y / H - py) * 1.6);
      const r = Math.max(0, Math.min(1, n * 1.1 + 0.15)) * cell * 0.38;
      if (r < 0.5) continue;
      ctx.beginPath(); ctx.arc(x, y, r, 0, 6.2832); ctx.fill();
    }
  }

  /* ---------- 8. watercolour: soft colour clouds that slowly merge ---------- */
  const WASH = [[170, 0.9, 0.2], [20, 0.85, 0.75], [215, 0.7, 0.3], [45, 0.85, 0.85], [330, 0.6, 0.5]];
  function drawAurora() {
    ctx.clearRect(0, 0, W, H);
    const base = Math.max(W, H) * 0.42;
    WASH.forEach(([hue, a, f], i) => {
      const x = W * (0.5 + 0.42 * Math.sin(t * 0.05 * (0.6 + f) + i * 1.9) + (px - 0.5) * 0.06 * (i + 1) * 0.3);
      const y = H * (0.5 + 0.36 * Math.cos(t * 0.04 * (0.5 + f) + i * 2.7));
      const r = base * (0.7 + 0.35 * Math.sin(t * 0.03 + i));
      const g = ctx.createRadialGradient(x, y, 0, x, y, r);
      const col = (al) => `hsla(${hue},${C.light ? 45 : 38}%,${C.light ? 62 : 48}%,${al})`;
      g.addColorStop(0, col(C.light ? 0.3 * a : 0.26 * a)); g.addColorStop(1, col(0));
      ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    });
  }

  /* ---------- 9. moiré rings: two sets of circles that interfere ---------- */
  function drawRings() {
    ctx.clearRect(0, 0, W, H);
    const gap = 11, max = Math.hypot(W, H);
    const centres = [[W * 0.3 + Math.sin(t * 0.07) * 60, H * 0.5 + Math.cos(t * 0.05) * 50], [W * (0.68 + (px - 0.5) * 0.08) + Math.cos(t * 0.06) * 50, H * 0.45 + Math.sin(t * 0.08) * 60]];
    ctx.lineWidth = 0.7;
    centres.forEach(([cx, cy], k) => {
      ctx.strokeStyle = rgba(k ? C.accent : C.ink, C.light ? 0.3 : 0.26);
      ctx.beginPath();
      for (let r = gap; r < max; r += gap) { ctx.moveTo(cx + r, cy); ctx.arc(cx, cy, r, 0, 6.2832); }
      ctx.stroke();
    });
  }

  /* ---------- engine ---------- */
  const animated = () => !still && ['ink', 'contours', 'cloud', 'waves', 'stars', 'halftone', 'aurora', 'rings'].includes(mode);

  function build() {
    dpr = Math.min(devicePixelRatio || 1, ['contours', 'waves', 'halftone'].includes(mode) ? 1 : 1.5);
    W = innerWidth; H = innerHeight;
    canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    C = colors();
    if (mode === 'ink') buildInk(); else if (mode === 'cloud') buildCloud(); else if (mode === 'flow') buildFlow(); else if (mode === 'stars') buildStars();
  }
  function render() {
    if (mode === 'ink') drawInk(); else if (mode === 'contours') drawContours();
    else if (mode === 'cloud') drawCloud(); else if (mode === 'flow') drawFlow(); else if (mode === 'waves') drawWaves(); else if (mode === 'stars') drawStars();
    else if (mode === 'halftone') drawHalftone(); else if (mode === 'aurora') drawAurora(); else if (mode === 'rings') drawRings(); else ctx.clearRect(0, 0, W, H);
  }
  function loop(now) {
    raf = requestAnimationFrame(loop);
    if (document.hidden) return;
    const dt = now - last, every = (mode === 'cloud' || mode === 'stars') ? 33 : (mode === 'contours' || mode === 'waves' || mode === 'halftone') ? 55 : 66;
    if (dt < every) return;
    last = now; t += dt / 1000;
    px += (tpx - px) * 0.08; py += (tpy - py) * 0.08;
    render();
  }
  function show(m, fromUser) {
    mode = m;
    document.body.dataset.art = m;
    const shown = (DESIGNS.find((x) => x[0] === m) || [0, 'Plain'])[1];
    label.textContent = pref === 'shuffle' ? `Surprise · ${shown}` : shown;
    btn.title = (pref === 'shuffle' ? 'A new background on every visit (now: ' + shown + ')' : 'Background: ' + shown) + ' — click to change';
    cancelAnimationFrame(raf); raf = 0;
    build(); render();
    if (fromUser && !still) canvas.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 900, easing: 'ease' });
    if (animated()) raf = requestAnimationFrame(loop);
  }
  // The button steps through: Surprise me, each design (locks it), Plain.
  btn.addEventListener('click', () => {
    pref = MODES[(MODES.findIndex((x) => x[0] === pref) + 1) % MODES.length][0];
    try { localStorage.setItem('troy.art2', pref); } catch { /* ignore */ }
    show(pref === 'shuffle' ? drawLots() : pref, true);
  });
  if (finePointer && !still) addEventListener('pointermove', (e) => { tpx = e.clientX / W; tpy = e.clientY / H; }, { passive: true });

  let rz = 0;
  addEventListener('resize', () => { clearTimeout(rz); rz = setTimeout(() => { if (Math.abs(innerWidth - W) > 40 || Math.abs(innerHeight - H) > 120) { build(); render(); } }, 200); });
  new MutationObserver(() => { build(); render(); }).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });

  window.TroyArt = { setGlow(url) { if (glowEl && url) glowEl.style.backgroundImage = `url("${url}")`; } };
  show(mode, false);
})();
