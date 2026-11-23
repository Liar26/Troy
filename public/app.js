// TROY frontend: vanilla JS, no build step. Sections: helpers, state, data, views, modal, boot.
(() => {
  'use strict';

  /* ---------- helpers ---------- */
  const $ = (s, r = document) => r.querySelector(s);
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const store = {
    get(k, d) { try { const v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch { return d; } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* private mode */ } },
  };
  const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const ordinal = (n) => n + (['th', 'st', 'nd', 'rd'][(n % 100 >> 3) ^ 1 && n % 10 < 4 ? n % 10 : 0]);
  const centuryOf = (y) => (y > 0 ? Math.ceil(y / 100) : null);
  const plainClick = (e) => e.button === 0 && !e.metaKey && !e.ctrlKey && !e.shiftKey && !e.altKey;

  // Daily pick: same painting for everyone on a given local date (FNV-1a hash of "salt:date").
  const dateKey = (d = new Date()) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  const hash = (s) => { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; };
  const pick = (list, salt) => list[hash(`${salt}:${dateKey()}`) % list.length];

  // Quotes are widely attributed; edit freely. (Not museum text, so safe to curate.)
  const QUOTES = [
    ['Every child is an artist. The problem is how to remain an artist once we grow up.', 'Pablo Picasso (attributed)'],
    ['Art is not what you see, but what you make others see.', 'Edgar Degas (attributed)'],
    ['I dream my painting and then I paint my dream.', 'Vincent van Gogh (attributed)'],
    ['Creativity takes courage.', 'Henri Matisse (attributed)'],
    ['Painting is poetry that is seen rather than felt.', 'Leonardo da Vinci (attributed)'],
  ];

  /* ---------- state ---------- */
  const state = {
    paintings: [], byId: new Map(), error: false,
    saves: new Set(store.get('troy.saves', [])),
    filters: { q: '', century: '', nat: '', region: '', museum: '', masters: false, savedOnly: false, sort: '', colour: '' },
    cols: store.get('troy.cols', []), col: 'saves', colours: store.get('troy.colors', {}),
    ctx: [], cur: null, zoom: null, show: null, refresh: null,
    bgPath: null, title: 'TROY', cleanup: null, modalId: null, lastFocus: null,
  };
  const view = $('#view');
  const modalRoot = $('#modal-root');

  /* ---------- saves ---------- */
  const isSaved = (id) => state.saves.has(id);
  function toggleSave(id) {
    state.saves.has(id) ? state.saves.delete(id) : state.saves.add(id);
    store.set('troy.saves', [...state.saves]);
    syncSaves();
    if (state.bgPath === '/saves' && !state.modalId) renderPage('/saves'); // refresh the list
  }
  function syncSaves() {
    $('#saves-count').textContent = state.saves.size;
    document.querySelectorAll('[data-save]').forEach((b) => {
      const on = isSaved(+b.dataset.save);
      b.setAttribute('aria-pressed', on);
      const l = $('.lbl', b); if (l) l.textContent = on ? 'Saved' : 'Save';
      if (!l) b.setAttribute('aria-label', on ? 'Remove from saves' : 'Save painting');
    });
  }
  const bookmark = '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"><path d="M6 3h12v18l-6-4.5L6 21z"/></svg>';
  const saveBtn = (id) => `<button class="btn" data-save="${id}" aria-pressed="${isSaved(id)}">${bookmark}<span class="lbl">${isSaved(id) ? 'Saved' : 'Save'}</span></button>`;


  /* ---------- lists the person is browsing (for next/previous, slideshow) ---------- */
  const setCtx = (list) => { state.ctx = list.map((p) => p.id); };
  const ctxIds = () => (state.ctx.length ? state.ctx : state.paintings.map((p) => p.id));
  async function copyText(text) {
    try { await navigator.clipboard.writeText(text); return true; } catch {
      const t = document.createElement('textarea'); t.value = text; t.style.cssText = 'position:fixed;opacity:0'; document.body.appendChild(t); t.select();
      let ok = false; try { ok = document.execCommand('copy'); } catch { /* ignore */ } t.remove(); return ok;
    }
  }
  const flash = (btn, msg, back) => { const old = back || btn.textContent; btn.textContent = msg; setTimeout(() => { btn.textContent = old; }, 1600); };
  const download = (name, text, type = 'application/json') => {
    const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([text], { type })); a.download = name; document.body.appendChild(a); a.click();
    setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 500);
  };


  /* ---------- share (site or painting) ---------- */
  let shareEl = null;
  function closeShare() { shareEl?.remove(); shareEl = null; }
  function openShare(kind) {
    closeShare();
    const cur = kind === 'painting' && state.cur;
    const url = cur ? `${location.origin}/painting/${cur.id}` : `${location.origin}/`;
    const title = cur ? cur.title : 'TROY';
    const text = cur ? `${cur.title}${cur.artist ? ' · ' + cur.artist : ''} on TROY` : 'TROY: a calm gallery of public-domain paintings from museums around the world';
    const mobile = matchMedia('(pointer:coarse)').matches;
    if (mobile && navigator.share) { navigator.share({ title, text, url }).catch(() => {}); return; }
    const u = encodeURIComponent(url), t = encodeURIComponent(text);
    const links = [
      ['WhatsApp', `https://wa.me/?text=${t}%20${u}`],
      ['Telegram', `https://t.me/share/url?url=${u}&text=${t}`],
      ['X', `https://twitter.com/intent/tweet?text=${t}&url=${u}`],
      ['Facebook', `https://www.facebook.com/sharer/sharer.php?u=${u}`],
      ['Reddit', `https://www.reddit.com/submit?url=${u}&title=${t}`],
      ['Pinterest', `https://pinterest.com/pin/create/button/?url=${u}&description=${t}${cur?.thumb ? '&media=' + encodeURIComponent(cur.thumb) : ''}`],
      ['Email', `mailto:?subject=${encodeURIComponent(title)}&body=${t}%0A${u}`],
    ];
    shareEl = document.createElement('div');
    shareEl.className = 'share-back';
    shareEl.innerHTML = `<div class="share-sheet" role="dialog" aria-modal="true" aria-label="Share">
      <button class="icon-btn share-x" data-share-close aria-label="Close">✕</button>
      <h3>${cur ? 'Share this painting' : 'Share TROY'}</h3>
      <div class="share-copy"><input readonly value="${esc(url)}" aria-label="Link"><button class="btn btn-primary" data-share-copy>Copy</button></div>
      <div class="share-links">${links.map(([n, h]) => `<a class="btn" href="${esc(h)}" target="_blank" rel="noopener noreferrer">${n}</a>`).join('')}${navigator.share ? '<button class="btn" data-share-native>More…</button>' : ''}</div>
    </div>`;
    document.body.appendChild(shareEl);
    const input = shareEl.querySelector('input'); input.select();
    shareEl.addEventListener('click', (e) => {
      if (e.target === shareEl || e.target.closest('[data-share-close]')) closeShare();
      else if (e.target.closest('[data-share-copy]')) { const b = e.target.closest('button'); copyText(url).then((ok) => flash(b, ok ? 'Copied' : 'Press Ctrl+C', 'Copy')); }
      else if (e.target.closest('[data-share-native]')) navigator.share({ title, text, url }).catch(() => {});
    });
    shareEl.querySelector('[data-share-copy]').focus();
  }

  /* ---------- feedback page ---------- */
  function feedbackView() {
    return `
      <div class="container page-head"><h1>Feedback</h1><p>Tell us what to improve, what is broken, or what you enjoyed. It helps more than you think.</p></div>
      <div class="container prose">
        <form id="fb" class="fb" novalidate>
          <div class="fb-row" role="radiogroup" aria-label="Rating">
            <span class="muted">How is TROY?</span>
            ${[1, 2, 3, 4, 5].map((n) => `<button type="button" class="star" data-star="${n}" aria-label="${n} of 5">★</button>`).join('')}
          </div>
          <label>What kind of message?
            <select name="type"><option value="idea">An idea</option><option value="problem">Something is broken</option><option value="praise">Praise</option><option value="other">Other</option></select></label>
          <label>Your message
            <textarea name="message" rows="6" maxlength="2000" required placeholder="Write here…"></textarea></label>
          <label>Email (optional, only if you want a reply)
            <input name="email" type="email" maxlength="120" autocomplete="email"></label>
          <input class="hp" name="website" tabindex="-1" autocomplete="off" aria-hidden="true">
          <p class="muted fb-note">We save only what you type here, plus the page you were on. No tracking. <a href="/privacy" data-link>Privacy</a></p>
          <button class="btn btn-primary" type="submit" id="fb-send">Send feedback</button>
          <p id="fb-msg" role="status" class="fb-msg"></p>
        </form>
      </div>`;
  }
  function wireFeedback() {
    const f = $('#fb'); if (!f) return;
    let rating = 0;
    const from = sessionStorage.getItem('troy.fbfrom') || '';
    f.addEventListener('click', (e) => {
      const b = e.target.closest('[data-star]'); if (!b) return;
      rating = +b.dataset.star; f.querySelectorAll('.star').forEach((s) => s.classList.toggle('on', +s.dataset.star <= rating));
    });
    f.addEventListener('submit', async (e) => {
      e.preventDefault();
      const msg = $('#fb-msg'), btn = $('#fb-send'), d = Object.fromEntries(new FormData(f));
      if ((d.message || '').trim().length < 3) { msg.textContent = 'Please write a short message first.'; return; }
      btn.disabled = true; msg.textContent = 'Sending…';
      try {
        const r = await fetch('/api/feedback', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...d, rating, page: from }) });
        const j = await r.json().catch(() => ({}));
        if (!r.ok) throw new Error(j.error || 'failed');
        f.innerHTML = '<p class="fb-thanks">Thank you. Your feedback was sent.</p><p><a class="btn" href="/" data-link>Back to the gallery</a></p>';
      } catch (err) {
        btn.disabled = false;
        msg.innerHTML = `${esc(err.message === 'failed' || err.message === 'Failed to fetch' ? 'Could not send right now.' : err.message)}${state.email ? ` <a href="mailto:${esc(state.email)}?subject=TROY%20feedback&body=${encodeURIComponent(d.message)}">Send by email instead</a>` : ''}`;
      }
    });
  }

  /* ---------- collections (Saved + named lists) ---------- */
  const saveCols = () => store.set('troy.cols', state.cols);
  const colById = (id) => state.cols.find((c) => c.id === id);
  function createCollection(name, ids = []) {
    name = String(name || '').trim().slice(0, 40); if (!name) return null;
    const c = { id: 'c' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5), name, ids: [...new Set(ids)] };
    state.cols.push(c); saveCols(); return c;
  }
  const currentIds = () => (state.col === 'saves' || !colById(state.col) ? [...state.saves] : colById(state.col).ids);
  function toggleInCollection(cid, pid) {
    if (cid === 'saves') return toggleSave(pid);
    const c = colById(cid); if (!c) return;
    const i = c.ids.indexOf(pid); if (i >= 0) c.ids.splice(i, 1); else c.ids.push(pid);
    saveCols();
  }

  /* ---------- colours: read from each painting's image, kept in this browser ---------- */
  const COLOURS = [['red', '#b5483f'], ['orange', '#cc8138'], ['yellow', '#d1b94a'], ['green', '#5f8c57'], ['blue', '#4a78a8'], ['purple', '#83619b'], ['brown', '#7a5538'], ['dark', '#1c1c1c'], ['light', '#e9e5db'], ['grey', '#8a8a86']];
  function dominant(d) {
    const c = {};
    for (let i = 0; i < d.length; i += 4) {
      const r = d[i] / 255, g = d[i + 1] / 255, b = d[i + 2] / 255, mx = Math.max(r, g, b), mn = Math.min(r, g, b), l = (mx + mn) / 2, dl = mx - mn;
      const sat = dl === 0 ? 0 : dl / (1 - Math.abs(2 * l - 1));
      let h = 0; if (dl) { h = mx === r ? ((g - b) / dl) % 6 : mx === g ? (b - r) / dl + 2 : (r - g) / dl + 4; h = (h * 60 + 360) % 360; }
      let k, w = 1;
      if (l < 0.18) { k = 'dark'; w = 0.5; } else if (l > 0.85 && sat < 0.5) { k = 'light'; w = 0.6; } else if (sat < 0.16) { k = 'grey'; w = 0.5; }
      else if (h < 15 || h >= 345) k = 'red'; else if (h < 45) k = l < 0.42 && sat < 0.7 ? 'brown' : 'orange';
      else if (h < 70) k = l < 0.4 ? 'brown' : 'yellow'; else if (h < 170) k = 'green'; else if (h < 260) k = 'blue'; else k = 'purple';
      c[k] = (c[k] || 0) + w;
    }
    return Object.entries(c).sort((a, b) => b[1] - a[1]).slice(0, 2).map((e) => e[0]);
  }
  let analysing = false;
  function analyseColours() {
    if (analysing) return;
    const todo = state.paintings.filter((p) => !state.colours[p.id]);
    const status = (t) => { const el = $('#colour-status'); if (el) el.textContent = t; };
    if (!todo.length) return;
    analysing = true;
    let i = 0, done = 0, fail = 0, running = 0, lastPaint = 0;
    const cv = document.createElement('canvas'); cv.width = cv.height = 24;
    const g = cv.getContext('2d', { willReadFrequently: true });
    const total = state.paintings.length;
    const progress = (final) => {
      const known = total - todo.length + done;
      if (final) { store.set('troy.colors', state.colours); state.refresh?.(); }
      else if (done - lastPaint >= 20) { lastPaint = done; store.set('troy.colors', state.colours); state.refresh?.(); }
      status(final ? (done ? '' : 'Colour reading isn’t available here.') : `Reading colours… ${known} of ${total}`);
    };
    const next = () => {
      if ((fail >= 5 && !done) || i >= todo.length) { if (!running) { analysing = false; progress(true); } return; }
      const p = todo[i++]; running++;
      const img = new Image();
      const fin = () => { running--; progress(false); next(); };
      img.onload = () => { try { g.drawImage(img, 0, 0, 24, 24); state.colours[p.id] = dominant(g.getImageData(0, 0, 24, 24).data); done++; } catch { fail++; } fin(); };
      img.onerror = () => { fail++; fin(); };
      img.src = '/img?u=' + encodeURIComponent(p.thumb);
    };
    status('Reading colours…');
    for (let k = 0; k < 3; k++) next();
  }

  /* ---------- theme ---------- */
  $('#theme-toggle').addEventListener('click', () => {
    const next = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
    document.documentElement.dataset.theme = next;
    store.set('troy.theme', next);
  });

  /* ---------- daily ritual (visit streak) ---------- */
  function visit() {
    const r = store.get('troy.ritual', { last: null, streak: 0, total: 0, best: 0 });
    const today = dateKey();
    if (r.last !== today) {
      const y = new Date(); y.setDate(y.getDate() - 1);
      r.streak = r.last === dateKey(y) ? r.streak + 1 : 1;
      r.total += 1; r.best = Math.max(r.best, r.streak); r.last = today;
      store.set('troy.ritual', r);
    }
    return r;
  }
  const ritual = visit();

  /* ---------- data ---------- */
  fetch('/api/site').then((r) => r.json()).then((d) => { state.email = d.email || ''; if (state.bgPath === '/contact') renderPage('/contact'); }).catch(() => {});
  const ready = fetch('/api/paintings')
    .then((r) => { if (!r.ok) throw new Error(r.status); return r.json(); })
    .then((list) => { state.paintings = list; state.byId = new Map(list.map((p) => [p.id, p])); if (list.length && window.TroyArt) window.TroyArt.setGlow(pick(list, 'today').thumb); })
    .catch(() => { state.error = true; });

  /* ---------- view helpers ---------- */
  const emptyGallery = () => `<div class="container empty">${state.error
    ? 'The gallery server could not be reached. Please try again in a moment.'
    : 'The gallery is empty. Run <code>npm run import</code> in the project folder, then refresh.'}</div>`;

  const frame = (p, { eager = false } = {}) => `
    <figure class="frame-wrap">
      <a class="frame" href="/painting/${p.id}" data-open="${p.id}" aria-label="Open ${esc(p.title)}">
        <img src="${esc(p.thumb)}" alt="${esc(p.title)}${p.artist ? ' by ' + esc(p.artist) : ''}" ${eager ? '' : 'loading="lazy"'} decoding="async">
      </a>
    </figure>`;

  // Fade images in once loaded (runs for any img inside a container).
  function watchImages(root) {
    root.addEventListener('load', (e) => {
      if (e.target.tagName !== 'IMG') return;
      e.target.classList.add('loaded');
      const ph = e.target.closest('.ph');
      if (ph) { ph.classList.add('loaded'); if (e.target.naturalWidth) ph.style.aspectRatio = `${e.target.naturalWidth} / ${e.target.naturalHeight}`; } // true ratio, never cropped
    }, true);
    root.querySelectorAll('img').forEach((i) => { if (i.complete && i.naturalWidth) i.dispatchEvent(new Event('load')); });
  }

  /* ---------- views ---------- */
  function homeView() {
    const list = state.paintings;
    if (!list.length) return emptyGallery();
    const today = pick(list, 'today');
    if (state.heroPick == null) { const pool = list.filter((p) => p.famous); const from = pool.length ? pool : list; state.heroPick = list.indexOf(from[Math.floor(Math.random() * from.length)]); } // a master's work if we have one; new each visit
    let hero = list[state.heroPick % list.length];
    if (hero.id === today.id && list.length > 1) hero = list[(list.indexOf(hero) + 1) % list.length];
    state.heroId = hero.id;
    return `
      <section class="container hero">
        <div class="hero-copy" id="slider">
          <p class="eyebrow">A quiet gallery of public-domain paintings</p>
          <div class="quotes">${QUOTES.map(([t, a], i) => `<figure class="quote${i ? '' : ' is-active'}"><blockquote>“${esc(t)}”</blockquote><figcaption>${esc(a)}</figcaption></figure>`).join('')}</div>
          <div class="dots">${QUOTES.map((_, i) => `<button class="dot-btn" aria-label="Show quote ${i + 1}" aria-current="${i === 0}"></button>`).join('')}</div>
          <div class="hero-actions"><a class="btn btn-primary" href="/explore" data-link>Explore the collection</a></div>
        </div>
        <div>${frame(hero, { eager: true })}<p class="caption" style="margin:14px auto 0"><strong>${esc(hero.title)}</strong>${hero.artist ? ', ' + esc(hero.artist) : ''}</p></div>
      </section>
      ${todaySection(today)}
      ${ritualSection()}`;
  }


  // Gentle fade-in as sections scroll into view.
  function initReveal() {
    if (!('IntersectionObserver' in window)) return;
    const io = new IntersectionObserver((entries) => entries.forEach((e) => {
      if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); }
    }), { threshold: 0.08, rootMargin: '0px 0px -5% 0px' });
    view.querySelectorAll('.hero, .section, .page-head, .divider').forEach((el) => { el.classList.add('reveal'); io.observe(el); });
  }

  function todaySection(p, tight = false) {
    const label = new Date().toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' });
    return `
      <section class="container section"${tight ? ' style="padding-top:0"' : ''}>
        <header class="section-head"><h2>Today’s Selection</h2><span class="muted">${esc(label)}</span></header>
        <div class="today-grid">
          ${frame(p)}
          <div class="today-info">
            <h3>${esc(p.title)}</h3>
            ${p.artist ? `<p class="by">${esc(p.artist)}</p>` : ''}
            <p class="meta">${esc([p.date, p.nationality].filter(Boolean).join(' · '))}</p>
            <div class="hero-actions" style="margin-top:10px">
              <a class="btn btn-primary" href="/painting/${p.id}" data-open="${p.id}">View details</a>
              ${saveBtn(p.id)}
            </div>
          </div>
        </div>
      </section>`;
  }

  function ritualSection() {
    return `
      <section class="container section">
        <header class="section-head"><h2>Your Daily Ritual</h2></header>
        <div class="ritual-body">
          <p class="streak"><span class="num">${ritual.streak}</span><span class="unit">day streak</span></p>
          <p class="muted">${ritual.total} ${ritual.total === 1 ? 'day' : 'days'} visited in total · best streak ${ritual.best}. Come back tomorrow to keep it going.</p>
        </div>
      </section>`;
  }

  function todayView() {
    if (!state.paintings.length) return emptyGallery();
    return `<div class="container page-head"><h1>Today</h1><p>One painting, chosen for today. It changes at midnight.</p></div>${todaySection(pick(state.paintings, 'today'), true)}${ritualSection()}`;
  }

  function aboutView() {
    return `
      <div class="container page-head"><h1>About</h1></div>
      <div class="container prose">
        <p>TROY is a calm place to look at paintings. Each work is shown in its original proportions, never cropped, with the information the museum itself publishes.</p>
        <h2>Credit</h2>
        <p>Every painting, image and piece of information comes from the open-access programs of <a href="https://www.metmuseum.org/about-the-met/policies-and-documents/open-access" target="_blank" rel="noopener">The Metropolitan Museum of Art</a>, <a href="https://www.artic.edu/open-access" target="_blank" rel="noopener">The Art Institute of Chicago</a> and <a href="https://www.clevelandart.org/open-access" target="_blank" rel="noopener">The Cleveland Museum of Art</a>. Only works the museums mark as public domain (CC0) are shown. Images are loaded directly from the museums’ servers and are not stored here. Titles, artist details, dates, media, dimensions and credit lines are the museums’ own words; the only things TROY adds are grouped nationalities and regions, so you can browse them.</p>
        <p>A few famous paintings that none of these museums own (the Mona Lisa is in the Louvre, for example) come from <a href="https://www.wikidata.org" target="_blank" rel="noopener">Wikidata</a> (facts, CC0) and <a href="https://commons.wikimedia.org" target="_blank" rel="noopener">Wikimedia Commons</a> (public-domain images). They are marked with the museum that holds them.</p>
        <h2>Privacy</h2>
        <p>No accounts, no ads, no tracking. Your saves, theme choice and daily streak live only in this browser.</p>
        <h2>The collection</h2>
        <p id="about-status" class="muted">${state.paintings.length} paintings.</p>
      </div>`;
  }

    /* ---------- privacy, terms, contact ---------- */
  function privacyView() {
    return `
      <div class="container page-head"><h1>Privacy &amp; safety</h1><p>The short version: no accounts, no ads, no tracking, no cookies.</p></div>
      <div class="container prose">
        <h2>What TROY collects</h2>
        <p>Nothing about you is sent to us or stored on our server, except a message you choose to send through the <a href="/feedback" data-link>Feedback</a> form (your message, optional email, rating and the page you were on, used only to improve TROY or reply to you). There are no accounts, no sign-up, no analytics, no advertising and no cookies.</p>
        <h2>What stays in your browser</h2>
        <p>To remember your choices, TROY saves a few small items in your own browser (local storage): your saved paintings and collections, light or dark theme, your background choice, your daily-visit streak, and the colours it has read from paintings. They never leave your device unless you export them or share a link yourself. You can erase everything by clearing this site’s data in your browser settings.</p>
        <h2>Third parties, honestly</h2>
        <p>The paintings are loaded directly from the museums’ own servers, and the text font (Inter) comes from Google Fonts. When your browser fetches those, the museum or Google can see your internet address, as with any website. TROY asks your browser not to tell them which page you were on. No third-party scripts, trackers or ads are allowed to run on this site.</p>
        <h2>Ads</h2>
        <p>There are none, and TROY’s security rules block ad and tracking scripts from loading at all.</p>
        <h2>Safety</h2>
        <ul>
          <li>Links to the museums open in a new tab and cannot control this page.</li>
          <li>Share links contain only painting numbers and a collection name, never personal data.</li>
          <li>Imported files are checked before use. Only a TROY export file is accepted.</li>
          <li>Only a TROY server administrator can change what the gallery shows.</li>
        </ul>
        <h2>Children</h2>
        <p>TROY shows historic paintings from museum collections. Some artworks depict nudity, violence or religious scenes, as museums do. TROY does not collect anything from anyone, including children.</p>
        <h2>Questions or concerns</h2>
        <p>See <a href="/contact" data-link>Contact</a>. If a painting should not be shown, tell us its page address and we will review and remove it.</p>
      </div>`;
  }
  function termsView() {
    return `
      <div class="container page-head"><h1>Terms of use</h1></div>
      <div class="container prose">
        <p>TROY is a free gallery for looking at public-domain paintings. By using it you agree to these plain terms.</p>
        <h2>Content</h2>
        <p>Paintings, images and details come from the museums credited on each painting and on the <a href="/about" data-link>About</a> page, under their public-domain (CC0) open-access programs, and from Wikimedia Commons and Wikidata for a few famous works. Each museum or project remains the source. Details are shown as the sources publish them and can contain mistakes.</p>
        <h2>Use</h2>
        <p>You may look, save, share links and print for your own use. Please do not overload the site with automated requests. Public-domain images may be reused under the rules of the museum that published them; check the museum link on each painting if you plan to publish one.</p>
        <h2>No guarantees</h2>
        <p>TROY is provided as it is, without promises that it will always be available or free of errors. Links to other websites are for your convenience; we do not control them.</p>
        <h2>Changes</h2>
        <p>These terms may be updated from time to time. The latest version is always on this page.</p>
      </div>`;
  }
  function contactView() {
    const mail = (subject, body) => `mailto:${state.email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    return `
      <div class="container page-head"><h1>Contact</h1><p>Questions, a wrong detail, or a painting that should not be here? We read every message.</p></div>
      <div class="container prose">
        ${state.email
          ? `<p><a class="btn btn-primary" href="${esc(mail('TROY: question', ''))}">Email ${esc(state.email)}</a></p>`
          : '<p class="muted">The contact address has not been set up yet. (Site owner: set <code>TROY_EMAIL</code> and restart the server.)</p>'}
        <p><a class="btn" href="/feedback" data-link>Send feedback</a></p>
        <h2>Report a painting</h2>
        <p>Open the painting, copy its link, and send it with a short note: wrong information, broken image, or a rights concern. Every painting window also has a “Report a problem” link that fills this in for you.</p>
        <h2>Common questions</h2>
        <p><strong>Why is a famous painting missing?</strong> TROY only shows works that museums publish as public domain with a usable image, and each museum owns different paintings. Many famous works are in museums that do not publish open data.</p>
        <p><strong>How do I remove my saves?</strong> They live only in your browser. Delete a collection on the Saves page, or clear this site’s data in your browser settings.</p>
        <p><strong>The page looks wrong or won’t load.</strong> Refresh with Ctrl+F5. If it still fails, tell us your browser and what you saw.</p>
        <p><strong>Is my data safe?</strong> We do not collect it. See <a href="/privacy" data-link>Privacy &amp; safety</a>.</p>
      </div>`;
  }

  /* Explore (and Saves: the same grid for Saved + your collections) */
  const SORTS = [['', 'Mixed (new every visit)'], ['old', 'Oldest first'], ['new', 'Newest first'], ['artist', 'Artist A–Z']];
  const shuffleKey = new Map();
  function sortList(list, mode) {
    const out = [...list];
    if (mode === 'old') out.sort((a, b) => (a.year || 9999) - (b.year || 9999));
    else if (mode === 'new') out.sort((a, b) => (b.year || 0) - (a.year || 0));
    else if (mode === 'artist') out.sort((a, b) => (a.artist || '~').localeCompare(b.artist || '~') || (a.year || 0) - (b.year || 0));
    else { out.forEach((p) => { if (!shuffleKey.has(p.id)) shuffleKey.set(p.id, Math.random()); }); out.sort((a, b) => shuffleKey.get(a.id) - shuffleKey.get(b.id)); }
    return out;
  }

  function collectionBar() {
    if (!colById(state.col) && state.col !== 'saves') state.col = 'saves';
    const tabs = [['saves', 'Saved', state.saves.size], ...state.cols.map((c) => [c.id, c.name, c.ids.length])];
    return `
      <div class="col-bar" role="group" aria-label="Collections">${tabs.map(([id, n, c]) => `<button class="tab" data-col="${esc(id)}" aria-pressed="${state.col === id}">${esc(n)} <span>${c}</span></button>`).join('')}<button class="tab tab-new" id="col-new">+ New collection</button></div>
      <div class="col-actions">
        <button class="btn" data-slideshow>Slideshow</button>
        <button class="btn" id="col-share">Copy share link</button>
        ${state.col !== 'saves' ? '<button class="btn" id="col-rename">Rename</button><button class="btn" id="col-del">Delete</button>' : ''}
      </div>`;
  }
  const backupBox = () => `
    <section class="backup">
      <h2>Take your collections with you</h2>
      <p class="muted">There are no accounts, so everything lives in this browser. Export a file and import it on another device to move your saves and collections.</p>
      <div class="col-actions"><button class="btn" id="col-export">Export file</button><label class="btn" for="col-import">Import file</label><input type="file" id="col-import" accept="application/json,.json" hidden><span class="muted" id="backup-msg" aria-live="polite"></span></div>
    </section>`;

  function exploreView(savedPage = false) {
    if (!state.paintings.length) return emptyGallery();
    const f = state.filters;
    const centuries = [...new Set(state.paintings.map((p) => centuryOf(p.year)).filter(Boolean))].sort((a, b) => a - b);
    const nats = [...new Set(state.paintings.map((p) => p.nationality).filter(Boolean))].sort((a, b) => a.localeCompare(b));
    const regions = [...new Set(state.paintings.map((p) => p.region).filter(Boolean))].sort();
    const museums = [...new Set(state.paintings.map((p) => p.museum).filter(Boolean))].sort();
    return `
      <div class="container">
        <div class="page-head" style="padding-bottom:24px"><h1>${savedPage ? 'My Saves' : 'Explore'}</h1>${savedPage ? '<p>Kept on this device only.</p>' : ''}</div>
        ${savedPage ? collectionBar() : `
        <div class="toolbar">
          <div class="q-wrap"><input class="field" id="q" type="search" autocomplete="off" placeholder="Search title, artist, medium…" aria-label="Search" value="${esc(f.q)}"><div class="sugg" id="sugg" hidden></div></div>
          <select class="field" id="century" aria-label="Century"><option value="">All centuries</option>${centuries.map((c) => `<option value="${c}"${String(c) === f.century ? ' selected' : ''}>${ordinal(c)} century</option>`).join('')}</select>
          <select class="field" id="region" aria-label="Region"><option value="">Whole world</option>${regions.map((r) => `<option${r === f.region ? ' selected' : ''}>${esc(r)}</option>`).join('')}</select>
          <select class="field" id="nat" aria-label="Nationality"><option value="">All nationalities</option>${nats.map((n) => `<option${n === f.nat ? ' selected' : ''}>${esc(n)}</option>`).join('')}</select>
          ${museums.length > 1 ? `<select class="field" id="museum" aria-label="Museum"><option value="">All museums</option>${museums.map((m) => `<option${m === f.museum ? ' selected' : ''}>${esc(m)}</option>`).join('')}</select>` : ''}
          <select class="field" id="sort" aria-label="Sort">${SORTS.map(([v, l]) => `<option value="${v}"${v === f.sort ? ' selected' : ''}>${l}</option>`).join('')}</select>
          <button class="btn" id="masters" role="switch" aria-checked="${f.masters}" aria-pressed="${f.masters}" title="Leonardo, Rembrandt, Van Gogh, Monet and other famous painters">Masters only</button>
          <button class="btn" id="savedOnly" role="switch" aria-checked="${f.savedOnly}" aria-pressed="${f.savedOnly}">Saved only</button>
        </div>
        <div class="tool-row">
          <div class="chips" role="group" aria-label="Colour"><span class="muted">Colour</span>${COLOURS.map(([n, c]) => `<button class="chip" data-colour="${n}" aria-pressed="${f.colour === n}" aria-label="Colour: ${n}" title="${n}"><i style="background:${c}"></i></button>`).join('')}<span class="muted" id="colour-status" aria-live="polite"></span></div>
          <button class="btn" data-slideshow>Slideshow</button>
        </div>`}
        <p class="count" id="count" aria-live="polite"></p>
        <div class="masonry" id="grid"></div>
        ${savedPage ? backupBox() : ''}
      </div>`;
  }

  const card = (p) => `
    <figure class="card">
      <a class="ph" href="/painting/${p.id}" data-open="${p.id}" style="aspect-ratio:${p.ratio ? (1 / p.ratio).toFixed(4) : '0.8'}" aria-label="Open ${esc(p.title)}">
        <img src="${esc(p.thumb)}" alt="${esc(p.title)}${p.artist ? ' by ' + esc(p.artist) : ''}" loading="lazy" decoding="async">
      </a>
      <figcaption>
        <div><a class="t" href="/painting/${p.id}" data-open="${p.id}">${esc(p.title)}</a><span class="m">${esc([p.artist, p.date].filter(Boolean).join(' · '))}</span></div>
        <button class="icon-btn" data-save="${p.id}" aria-pressed="${isSaved(p.id)}" aria-label="${isSaved(p.id) ? 'Remove from saves' : 'Save painting'}">${bookmark}</button>
      </figcaption>
    </figure>`;

  function wireExplore(savedPage) {
    const grid = $('#grid'); if (!grid) return;
    const f = state.filters;
    watchImages(grid);
    const members = savedPage ? new Set(currentIds()) : null;
    const hay = (p) => `${p.title} ${p.artist} ${p.medium || ''} ${p.nationality} ${p.region || ''} ${p.museum || ''} ${p.date}`.toLowerCase();
    const update = () => {
      const terms = f.q.trim().toLowerCase().split(/\s+/).filter(Boolean);
      let out = state.paintings.filter((p) => savedPage ? members.has(p.id) :
        (!terms.length || terms.every((t) => hay(p).includes(t))) &&
        (!f.century || centuryOf(p.year) === +f.century) &&
        (!f.nat || p.nationality === f.nat) &&
        (!f.region || p.region === f.region) &&
        (!f.museum || p.museum === f.museum) &&
        (!f.masters || p.famous) &&
        (!f.savedOnly || isSaved(p.id)) &&
        (!f.colour || (state.colours[p.id] || []).includes(f.colour)));
      if (!savedPage) out = sortList(out, f.sort);
      setCtx(out);
      grid.innerHTML = out.map(card).join('');
      $('#count').textContent = out.length
        ? `${out.length} ${out.length === 1 ? 'painting' : 'paintings'}`
        : savedPage ? 'Nothing here yet. Tap the bookmark on any painting, or use “Add to collection” in its window.'
          : f.colour && analysing ? 'Still reading colours…' : 'No paintings match your search.';
    };
    state.refresh = update;
    if (!savedPage) {
      const q = $('#q'), sg = $('#sugg');
      const hq = $('#hq'), hsg = $('#hsugg'), hwrap = $('#hdr-search'), tb = $('.toolbar');
      let t;
      const suggest = (sgEl = sg) => {
        const w = f.q.trim().toLowerCase();
        if (w.length < 2) { sgEl.hidden = true; return; }
        const arts = [...new Set(state.paintings.map((p) => p.artist).filter((a) => a && a.toLowerCase().includes(w)))].slice(0, 4);
        const titles = state.paintings.filter((p) => p.title.toLowerCase().includes(w)).slice(0, 4).map((p) => p.title);
        const items = [...arts.map((a) => ['Artist', a]), ...titles.map((x) => ['Title', x])];
        sgEl.innerHTML = items.map(([k, v]) => `<button type="button" class="sg-item" data-sg="${esc(v)}"><span>${k}</span>${esc(v)}</button>`).join('');
        sgEl.hidden = !items.length;
      };
      // The page search box and the one in the top bar are the same search: they mirror each other.
      const wire = (input, sgEl, other) => {
        input.addEventListener('input', (e) => { f.q = e.target.value; other.value = f.q; clearTimeout(t); t = setTimeout(update, 120); suggest(sgEl); });
        input.addEventListener('blur', () => setTimeout(() => { sgEl.hidden = true; }, 150));
        input.addEventListener('keydown', (e) => { if (e.key === 'Escape') sgEl.hidden = true; });
        sgEl.addEventListener('pointerdown', (e) => {
          const b = e.target.closest('[data-sg]'); if (!b) return;
          e.preventDefault(); f.q = b.dataset.sg; q.value = f.q; hq.value = f.q; sgEl.hidden = true; update();
        });
      };
      wire(q, sg, hq); wire(hq, hsg, q);
      // When the filters scroll out of sight, a search box slides into the top bar.
      if ('IntersectionObserver' in window && tb) {
        const io = new IntersectionObserver(([en]) => {
          const away = !en.isIntersecting && en.boundingClientRect.top < 0;
          if (away) hq.value = f.q;
          hwrap.hidden = !away; document.body.classList.toggle('hdr-searching', away);
          if (!away) hsg.hidden = true;
        }, { rootMargin: '-72px 0px 0px 0px' });
        io.observe(tb);
        state.cleanup = () => { io.disconnect(); hwrap.hidden = true; document.body.classList.remove('hdr-searching'); };
      }
      $('#century').addEventListener('change', (e) => { f.century = e.target.value; update(); });
      $('#nat').addEventListener('change', (e) => { f.nat = e.target.value; update(); });
      $('#region').addEventListener('change', (e) => { f.region = e.target.value; update(); });
      $('#museum')?.addEventListener('change', (e) => { f.museum = e.target.value; update(); });
      $('#sort').addEventListener('change', (e) => { f.sort = e.target.value; update(); });
      $('#masters').addEventListener('click', (e) => { f.masters = !f.masters; e.currentTarget.setAttribute('aria-checked', f.masters); e.currentTarget.setAttribute('aria-pressed', f.masters); update(); });
      $('#savedOnly').addEventListener('click', (e) => { f.savedOnly = !f.savedOnly; e.currentTarget.setAttribute('aria-checked', f.savedOnly); e.currentTarget.setAttribute('aria-pressed', f.savedOnly); update(); });
      document.querySelectorAll('[data-colour]').forEach((b) => b.addEventListener('click', () => {
        f.colour = f.colour === b.dataset.colour ? '' : b.dataset.colour;
        document.querySelectorAll('[data-colour]').forEach((x) => x.setAttribute('aria-pressed', x.dataset.colour === f.colour));
        if (f.colour) analyseColours();
        update();
      }));
      if (f.colour) analyseColours();
    }
    update();
  }

  /* Shared collection (a link someone sent: /c?n=Name&ids=1,2,3) */
  function sharedView() {
    const sp = new URLSearchParams(location.search);
    const name = (sp.get('n') || 'Shared collection').slice(0, 60);
    const list = (sp.get('ids') || '').split(',').map(Number).filter(Boolean).slice(0, 500).map((id) => state.byId.get(id)).filter(Boolean);
    setCtx(list);
    if (!list.length) return '<div class="container empty">This shared collection has no paintings we can show. <a href="/explore" data-link>Explore the gallery</a></div>';
    return `<div class="container"><div class="page-head" style="padding-bottom:24px"><p class="eyebrow">Shared with you</p><h1>${esc(name)}</h1></div>
      <div class="col-actions"><button class="btn btn-primary" id="shared-keep">Keep as my collection</button><button class="btn" data-slideshow>Slideshow</button></div>
      <p class="count">${list.length} ${list.length === 1 ? 'painting' : 'paintings'}</p><div class="masonry" id="grid">${list.map(card).join('')}</div></div>`;
  }

  /* Artists index, artist page, timeline (all built from the museum's own fields) */
  const slug = (n) => n.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  function artistGroups() {
    const g = new Map();
    for (const p of state.paintings) {
      if (!p.artist) continue;
      const k = slug(p.artist); if (!k) continue;
      if (!g.has(k)) g.set(k, { slug: k, name: p.artist, nationality: p.nationality, list: [] });
      g.get(k).list.push(p);
    }
    return [...g.values()].sort((a, b) => (b.list[0].famous ? 1 : 0) - (a.list[0].famous ? 1 : 0) || b.list.length - a.list.length || a.name.localeCompare(b.name));
  }
  function artistsView() {
    if (!state.paintings.length) return emptyGallery();
    const rows = artistGroups().map((a) => `
      <li><a class="artist-row" href="/artist/${a.slug}" data-link>
        <span class="an">${esc(a.name)}</span>
        <span class="am">${esc(a.nationality || '')}</span>
        <span class="ac">${a.list.length} ${a.list.length === 1 ? 'painting' : 'paintings'}</span>
        <span class="at">${a.list.slice(0, 4).map((p) => `<img src="${esc(p.thumb)}" alt="" loading="lazy" decoding="async">`).join('')}</span>
      </a></li>`).join('');
    return `<div class="container"><div class="page-head" style="padding-bottom:24px"><h1>Artists</h1><p>Famous painters first, then everyone else with a painting in the gallery.</p></div><ul class="artist-list">${rows}</ul></div>`;
  }
  function artistView(sl) {
    const a = artistGroups().find((x) => x.slug === sl);
    if (!a) return '<div class="container empty">Artist not found. <a href="/artists" data-link>See all artists</a></div>';
    const list = [...a.list].sort((x, y) => (x.year || 0) - (y.year || 0));
    const bio = list[0].artistBio; setCtx(list);
    return `<div class="container"><div class="page-head" style="padding-bottom:24px"><p class="eyebrow"><a href="/artists" data-link>← All artists</a></p><h1>${esc(a.name)}</h1>${bio ? `<p>${esc(bio)}</p>` : ''}</div>
      <div class="col-actions"><button class="btn" data-slideshow>Slideshow</button></div><p class="count">${list.length} ${list.length === 1 ? 'painting' : 'paintings'}</p><div class="masonry" id="grid">${list.map(card).join('')}</div></div>`;
  }
  function timelineView() {
    if (!state.paintings.length) return emptyGallery();
    const by = new Map();
    for (const p of state.paintings) { const c = centuryOf(p.year); if (!c) continue; if (!by.has(c)) by.set(c, []); by.get(c).push(p); }
    setCtx([...by.keys()].sort((a, b) => a - b).flatMap((c) => [...by.get(c)].sort((x, y) => x.year - y.year)));
    const secs = [...by.keys()].sort((a, b) => a - b).map((c) => {
      const list = by.get(c).sort((x, y) => x.year - y.year);
      return `<section class="tl-sec"><header class="section-head"><h2>${ordinal(c)} century</h2><span class="muted">${list.length} ${list.length === 1 ? 'painting' : 'paintings'}</span></header>
        <div class="tl-strip">${list.map((p) => `<a class="tl-item" href="/painting/${p.id}" data-open="${p.id}" title="${esc(p.title)}">
          <img src="${esc(p.thumb)}" alt="${esc(p.title)}${p.artist ? ' by ' + esc(p.artist) : ''}" loading="lazy" decoding="async" style="aspect-ratio:${p.ratio ? (1 / p.ratio).toFixed(4) : '0.8'}"><span>${esc(p.date || p.year)}</span></a>`).join('')}</div></section>`;
    }).join('');
    return `<div class="container"><div class="page-head" style="padding-bottom:24px"><h1>Timeline</h1><p>The collection through the centuries. Scroll each row sideways.</p></div>${secs}</div>`;
  }

  /* Quote slider: slow, pauses on hover/focus, no autoplay with reduced motion. */
  function startSlider(root) {
    const qs = [...root.querySelectorAll('.quote')], dots = [...root.querySelectorAll('.dot-btn')];
    let i = 0, timer = null;
    const show = (n) => { i = (n + qs.length) % qs.length; qs.forEach((q, k) => q.classList.toggle('is-active', k === i)); dots.forEach((d, k) => d.setAttribute('aria-current', k === i)); };
    const stop = () => clearInterval(timer);
    const play = () => { stop(); if (!reduceMotion) timer = setInterval(() => show(i + 1), 8000); };
    dots.forEach((d, k) => d.addEventListener('click', () => { show(k); play(); }));
    ['mouseenter', 'focusin'].forEach((ev) => root.addEventListener(ev, stop));
    ['mouseleave', 'focusout'].forEach((ev) => root.addEventListener(ev, play));
    play();
    return stop;
  }

  /* ---------- router ---------- */
  const PAGES = {
    '/': { title: 'TROY', render: homeView, after() { const s = $('#slider'); if (s) state.cleanup = startSlider(s); watchImages(view); } },
    '/explore': { title: 'Explore · TROY', render: () => exploreView(false), after: () => wireExplore(false) },
    '/saves': { title: 'My Saves · TROY', render: () => exploreView(true), after: () => wireExplore(true) },
    '/today': { title: 'Today · TROY', render: todayView, after: () => watchImages(view) },
    '/artists': { title: 'Artists · TROY', render: artistsView, after: () => watchImages(view) },
    '/timeline': { title: 'Timeline · TROY', render: timelineView, after: () => watchImages(view) },
    '/c': { title: 'Shared collection · TROY', render: sharedView, after: () => watchImages(view) },
    '/about': { title: 'About · TROY', render: aboutView, after() {} },
    '/privacy': { title: 'Privacy & safety · TROY', render: privacyView, after() {} },
    '/terms': { title: 'Terms · TROY', render: termsView, after() {} },
    '/contact': { title: 'Contact · TROY', render: contactView, after() {} },
    '/feedback': { title: 'Feedback · TROY', render: feedbackView, after: wireFeedback },
  };

  function renderPage(path) {
    if (path === '/feedback' && state.bgPath && state.bgPath !== '/feedback') { try { sessionStorage.setItem('troy.fbfrom', state.bgPath); } catch { /* ignore */ } }
    state.cleanup?.(); state.cleanup = null; state.refresh = null;
    const am = /^\/artist\/([a-z0-9-]+)$/.exec(path);
    const page = am ? { title: 'Artist · TROY', render: () => artistView(am[1]), after: () => watchImages(view) } : PAGES[path] || { title: 'Not found · TROY', render: () => '<div class="container empty">Page not found. <a href="/" data-link>Go home</a></div>', after() {} };
    state.bgPath = path; state.title = page.title;
    document.title = page.title;
    view.innerHTML = page.render();
    page.after();
    initReveal();
    document.querySelectorAll('[data-nav]').forEach((a) => {
      if (a.dataset.nav === path) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current');
    });
    syncSaves();
  }

  async function route() {
    await ready;
    const path = location.pathname.replace(/\/+$/, '') || '/';
    const m = /^\/painting\/(\d+)$/.exec(path);
    if (m) { if (state.bgPath === null) renderPage('/explore'); showModal(+m[1]); return; }
    hideModal();
    if (state.bgPath !== path) renderPage(path);
  }

  function navigate(path) { if (path !== location.pathname) history.pushState({}, '', path); window.scrollTo(0, 0); route(); }
  const openPainting = (id) => { history.pushState({ modal: true }, '', `/painting/${id}`); route(); };
  function closeModal() {
    if (history.state && history.state.modal) history.back();
    else { history.replaceState({}, '', state.bgPath && state.bgPath !== '/' ? state.bgPath : (state.bgPath || '/explore')); route(); }
  }


  /* ---------- painting window extras ---------- */
  function relatedHtml(p) {
    const c = centuryOf(p.year);
    const scored = state.paintings.filter((q) => q.id !== p.id).map((q) => {
      let sc = 0;
      if (p.artist && q.artist === p.artist) sc += 4;
      if (p.nationality && q.nationality === p.nationality) sc += 1;
      if (c && centuryOf(q.year) === c) sc += 1;
      return [q, sc + (p.year && q.year ? 1 - Math.min(1, Math.abs(p.year - q.year) / 200) : 0)];
    }).filter(([, sc]) => sc >= 1.5).sort((a, b) => b[1] - a[1]).slice(0, 8);
    if (!scored.length) return '';
    return `<div class="related"><h3>More like this</h3><div class="rel-row">${scored.map(([q]) => `<a href="/painting/${q.id}" data-open="${q.id}" title="${esc(q.title)}"><img src="${esc(q.thumb)}" alt="${esc(q.title)}" loading="lazy"></a>`).join('')}</div></div>`;
  }

  function wireInfoExtras(p) {
    const pop = $('#col-pop'), addBtn = $('#add-col');
    const renderPop = () => {
      const rows = [['saves', 'Saved', state.saves.has(p.id)], ...state.cols.map((c) => [c.id, c.name, c.ids.includes(p.id)])];
      pop.innerHTML = rows.map(([id, n, on]) => `<button class="pop-item" data-pick="${esc(id)}" aria-pressed="${on}"><span class="tick">${on ? '✓' : ''}</span>${esc(n)}</button>`).join('') + '<button class="pop-item pop-new" data-pick="__new">+ New collection…</button>';
    };
    addBtn.addEventListener('click', () => { renderPop(); pop.hidden = !pop.hidden; addBtn.setAttribute('aria-expanded', !pop.hidden); });
    pop.addEventListener('click', (e) => {
      const b = e.target.closest('[data-pick]'); if (!b) return;
      if (b.dataset.pick === '__new') {
        const c = createCollection(prompt('Name your collection'), [p.id]);
        if (c) { state.col = c.id; flash(addBtn, 'Added', 'Add to collection'); }
      } else toggleInCollection(b.dataset.pick, p.id);
      renderPop();
    });
    $('#print')?.addEventListener('click', () => window.print());
    $('#dl')?.addEventListener('click', async (e) => {
      const btn = e.currentTarget; flash(btn, 'Downloading…', 'Download');
      try {
        const r = await fetch(p.image); if (!r.ok) throw 0;
        const ext = (r.headers.get('content-type') || '').includes('png') ? 'png' : 'jpg';
        const a = document.createElement('a'); a.href = URL.createObjectURL(await r.blob()); a.download = `${slug(p.title) || 'painting'}-${p.id}.${ext}`; document.body.appendChild(a); a.click(); a.remove();
      } catch { window.open(p.image, '_blank', 'noopener'); } // the museum's server may not allow in-page downloads
    });
  }

  function step(d) {
    const ids = ctxIds(), i = ids.indexOf(state.modalId);
    if (state.modalId === null || ids.length < 2) return;
    const n = ids[((i < 0 ? 0 : i) + d + ids.length) % ids.length];
    history.replaceState({ modal: true }, '', `/painting/${n}`);
    route();
  }
  function watchSwipe(el) {
    let x0 = null, y0 = 0;
    el.addEventListener('touchstart', (e) => { x0 = e.touches[0].clientX; y0 = e.touches[0].clientY; }, { passive: true });
    el.addEventListener('touchend', (e) => {
      if (x0 === null) return;
      const dx = e.changedTouches[0].clientX - x0, dy = e.changedTouches[0].clientY - y0; x0 = null;
      if (Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy) * 1.5) step(dx < 0 ? 1 : -1);
    }, { passive: true });
  }

  /* ---------- zoom (wheel / pinch / drag / double-click) ---------- */
  function openZoom(p) {
    closeZoom();
    const el = document.createElement('div'); el.className = 'zoom'; el.setAttribute('role', 'dialog'); el.setAttribute('aria-label', 'Zoomed painting');
    el.innerHTML = `<img alt="${esc(p.title)}" draggable="false" src="${esc(p.thumb)}"><div class="zoom-ctl"><button data-z="out" aria-label="Zoom out">−</button><button data-z="in" aria-label="Zoom in">+</button><button data-z="reset">Reset</button><button data-z="close" aria-label="Close zoom">✕</button></div><p class="zoom-hint" id="zoom-hint">Scroll or pinch to zoom · drag to move · double-click to toggle</p>`;
    document.body.appendChild(el);
    const img = $('img', el); let s = 1, tx = 0, ty = 0;
    const apply = () => { img.style.transform = `translate(${tx}px,${ty}px) scale(${s})`; };
    const zoomAt = (ns, cx, cy) => {
      ns = Math.min(8, Math.max(1, ns));
      const r = el.getBoundingClientRect(), px = cx - r.left - r.width / 2, py = cy - r.top - r.height / 2;
      tx = px - (px - tx) * (ns / s); ty = py - (py - ty) * (ns / s); s = ns;
      if (s === 1) { tx = 0; ty = 0; }
      apply();
    };
    const mid = () => { const r = el.getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2]; };
    if (p.image && p.image !== p.thumb) { // swap in the museum's full-resolution file when it arrives
      const big = new Image();
      big.onload = () => { img.src = p.image; const h = $('#zoom-hint'); if (h) h.textContent = 'Full resolution · scroll or pinch to zoom · drag to move'; };
      big.onerror = () => { const h = $('#zoom-hint'); if (h) h.textContent = 'Showing the web version · scroll or pinch to zoom'; };
      big.src = p.image;
    }
    const pts = new Map(); let d0 = 0, s0 = 1;
    el.addEventListener('pointerdown', (e) => {
      if (e.target.closest('.zoom-ctl')) return;
      el.setPointerCapture(e.pointerId); pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (pts.size === 2) { const [a, b] = [...pts.values()]; d0 = Math.hypot(a.x - b.x, a.y - b.y); s0 = s; }
    });
    el.addEventListener('pointermove', (e) => {
      const prev = pts.get(e.pointerId); if (!prev) return;
      pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (pts.size === 2) { const [a, b] = [...pts.values()]; zoomAt(s0 * Math.hypot(a.x - b.x, a.y - b.y) / d0, (a.x + b.x) / 2, (a.y + b.y) / 2); }
      else if (s > 1) { tx += e.clientX - prev.x; ty += e.clientY - prev.y; apply(); }
    });
    ['pointerup', 'pointercancel'].forEach((ev) => el.addEventListener(ev, (e) => pts.delete(e.pointerId)));
    el.addEventListener('wheel', (e) => { e.preventDefault(); zoomAt(s * Math.exp(-e.deltaY * 0.0016), e.clientX, e.clientY); }, { passive: false });
    el.addEventListener('dblclick', (e) => zoomAt(s > 1 ? 1 : 2.6, e.clientX, e.clientY));
    el.addEventListener('click', (e) => {
      const z = e.target.closest('[data-z]');
      if (z) { const [cx, cy] = mid(); ({ in: () => zoomAt(s * 1.5, cx, cy), out: () => zoomAt(s / 1.5, cx, cy), reset: () => zoomAt(1, cx, cy), close: closeZoom })[z.dataset.z](); }
      else if (e.target === el && s === 1) closeZoom();
    });
    state.zoom = { close: closeZoom, zoomBy: (k) => { const [cx, cy] = mid(); zoomAt(s * k, cx, cy); }, el };
    $('[data-z="close"]', el).focus();
  }
  function closeZoom() { if (!state.zoom) return; state.zoom.el.remove(); state.zoom = null; }

  /* ---------- slideshow ---------- */
  function startSlideshow(ids) {
    const list = (ids && ids.length ? ids : state.paintings.map((p) => p.id)).map((id) => state.byId.get(id)).filter(Boolean);
    if (!list.length) return;
    closeSlideshow();
    const el = document.createElement('div'); el.className = 'show'; el.setAttribute('role', 'dialog'); el.setAttribute('aria-label', 'Slideshow');
    el.innerHTML = `<img alt=""><div class="show-cap"><strong></strong><span></span></div>
      <div class="show-ctl"><button data-s="prev" aria-label="Previous">‹</button><button data-s="play" aria-label="Pause">❚❚</button><button data-s="next" aria-label="Next">›</button><button data-s="close" aria-label="Close slideshow">✕</button></div>`;
    document.body.appendChild(el);
    const img = $('img', el), strong = $('strong', el), span = $('.show-cap span', el), playBtn = $('[data-s="play"]', el);
    let i = 0, timer = null, playing = true, entered = false;
    const draw = () => {
      const p = list[i]; strong.textContent = p.title; span.textContent = [p.artist, p.date].filter(Boolean).join(' · ');
      img.alt = `${p.title}${p.artist ? ' by ' + p.artist : ''}`;
      const n = list[(i + 1) % list.length]; if (n) new Image().src = n.thumb;
      img.src = p.thumb;
    };
    const go = (n) => {
      i = (n + list.length) % list.length;
      if (reduceMotion) { draw(); return; }
      img.classList.add('out'); setTimeout(() => { draw(); img.classList.remove('out'); }, 450);
    };
    const arm = () => { clearInterval(timer); if (playing) timer = setInterval(() => go(i + 1), 7000); };
    const toggle = () => { playing = !playing; playBtn.textContent = playing ? '❚❚' : '▶'; playBtn.setAttribute('aria-label', playing ? 'Pause' : 'Play'); arm(); };
    const close = () => { clearInterval(timer); el.remove(); state.show = null; document.removeEventListener('fullscreenchange', onFs); if (document.fullscreenElement) document.exitFullscreen?.().catch(() => {}); };
    const onFs = () => { if (entered && !document.fullscreenElement) close(); else if (document.fullscreenElement) entered = true; };
    document.addEventListener('fullscreenchange', onFs);
    el.addEventListener('click', (e) => {
      const b = e.target.closest('[data-s]'); if (!b) return;
      if (b.dataset.s === 'prev') { go(i - 1); arm(); } else if (b.dataset.s === 'next') { go(i + 1); arm(); } else if (b.dataset.s === 'play') toggle(); else close();
    });
    state.show = { close, go: (d) => { go(i + d); arm(); }, toggle };
    draw(); arm();
    el.requestFullscreen?.().catch(() => {});
    $('[data-s="close"]', el).focus();
  }
  function closeSlideshow() { state.show?.close(); }

  /* ---------- painting detail modal ---------- */
  async function showModal(id) {
    if (state.modalId === id) return;
    hideModal(true);
    state.modalId = id; state.lastFocus = document.activeElement;
    document.body.style.overflow = 'hidden';
    modalRoot.innerHTML = `
      <div class="modal" role="dialog" aria-modal="true" aria-labelledby="m-title">
        <div class="modal-backdrop" data-close></div>
        <article class="modal-panel">
          <button class="icon-btn modal-close" data-close aria-label="Close">
            <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg>
          </button>
          <div class="modal-media" id="m-media"></div>
          ${ctxIds().length > 1 ? '<button class="m-nav prev" data-step="-1" aria-label="Previous painting">‹</button><button class="m-nav next" data-step="1" aria-label="Next painting">›</button>' : ''}
          <div class="modal-info" id="m-info"><h2 id="m-title">Loading…</h2></div>
        </article>
      </div>`;
    $('.modal-close', modalRoot).focus();

    const lite = state.byId.get(id);
    if (lite) fillMedia(lite);
    watchSwipe($('#m-media'));
    { const ids = ctxIds(), i = ids.indexOf(id); // warm the neighbours so stepping feels instant
      [1, -1].forEach((d) => { const n = state.byId.get(ids[(i + d + ids.length) % ids.length]); if (n && i >= 0) new Image().src = n.thumb; }); }
    let p = null;
    try { const r = await fetch(`/api/paintings/${id}`); if (r.ok) p = await r.json(); } catch { /* offline */ }
    if (state.modalId !== id) return; // closed while loading
    if (!p) { $('#m-info').innerHTML = '<h2 id="m-title">Painting not found</h2><p class="muted">We couldn’t load this painting. It may not be in the gallery yet.</p>'; return; }
    if (!lite) fillMedia(p);
    fillInfo(p);
    document.title = `${p.title} · TROY`;
  }

  function fillMedia(p) {
    state.cur = p;
    $('#m-media').innerHTML = `<button class="zoom-hit" data-zoom aria-label="Zoom in on the painting" title="Click to zoom"><img src="${esc(p.thumb)}" alt="${esc(p.title)}${p.artist ? ' by ' + esc(p.artist) : ''}"></button>`;
  }

  function fillInfo(p) {
    const rows = [['Date', p.date], ['Medium', p.medium], ['Dimensions', p.dimensions], ['Nationality', p.nationality], ['Museum', p.museum], ['Credit line', p.creditLine]]
      .filter(([, v]) => v).map(([k, v]) => `<div><dt>${k}</dt><dd>${esc(v)}</dd></div>`).join('');
    $('#m-info').innerHTML = `
      <div>
        <h2 id="m-title">${esc(p.title)}</h2>
        <p class="artist-line" style="margin-top:14px">${p.artist && slug(p.artist) ? `<a href="/artist/${slug(p.artist)}" data-link data-close>${esc(p.artist)}</a>` : esc(p.artist || 'Artist unknown')}</p>
        ${p.artistBio ? `<p class="artist-bio">${esc(p.artistBio)}</p>` : ''}
      </div>
      <dl class="facts">${rows}</dl>
      <div class="actions">
        ${saveBtn(p.id)}
        <button class="btn" data-zoom>Zoom</button>
        <span class="pop-wrap"><button class="btn" id="add-col" aria-expanded="false">Add to collection</button><div class="col-pop" id="col-pop" hidden></div></span>
        <button class="btn" data-share="painting">Share</button>
        <button class="btn" id="copy-link">Copy link</button>
        ${p.objectURL ? `<a class="btn" href="${esc(p.objectURL)}" target="_blank" rel="noopener">View at the museum ↗</a>` : ''}
        ${p.image ? `<button class="btn" id="dl">Download</button><a class="btn" href="${esc(p.image)}" target="_blank" rel="noopener">Original file ↗</a>` : ''}
        <button class="btn" id="print">Print</button>
        ${state.email ? `<a class="btn" href="mailto:${esc(state.email)}?subject=${encodeURIComponent('TROY painting ' + p.id)}&body=${encodeURIComponent(`I'd like to report a problem with: ${location.origin}/painting/${p.id}\n\nWhat's wrong:\n`)}">Report a problem</a>` : '<a class="btn" href="/contact" data-link data-close>Report a problem</a>'}
      </div>
      ${relatedHtml(p)}
      <p class="credit">${p.source === 'wikimedia'
        ? `In the collection of ${esc(p.museum)}. Image: <a href="https://commons.wikimedia.org" target="_blank" rel="noopener">Wikimedia Commons</a> (public domain). Information: <a href="${esc(p.objectURL)}" target="_blank" rel="noopener">Wikidata</a> (CC0).`
        : `Image and information: <a href="${esc(p.objectURL || '#')}" target="_blank" rel="noopener">${esc(p.museum || 'The museum')}</a>. Public domain (CC0).`}</p>`;
    state.cur = p;
    wireInfoExtras(p);
    $('#copy-link').addEventListener('click', async (e) => {
      const btn = e.currentTarget, url = `${location.origin}/painting/${p.id}`;
      let ok = false;
      try { await navigator.clipboard.writeText(url); ok = true; } catch {
        const t = document.createElement('textarea'); t.value = url; t.style.cssText = 'position:fixed;opacity:0'; document.body.appendChild(t); t.select();
        try { ok = document.execCommand('copy'); } catch { /* ignore */ } t.remove();
      }
      btn.textContent = ok ? 'Link copied' : 'Copy failed'; setTimeout(() => { btn.textContent = 'Copy link'; }, 1600);
    });
    syncSaves();
  }

  function hideModal(keepScrollLock) {
    if (state.modalId === null) return;
    state.modalId = null; modalRoot.innerHTML = ''; closeZoom();
    if (!keepScrollLock) document.body.style.overflow = '';
    document.title = state.title;
    state.lastFocus?.focus?.();
    if (state.bgPath === '/saves') renderPage('/saves'); // reflect unsaves made inside the modal
  }

  /* ---------- global events ---------- */
  document.addEventListener('click', (e) => {
    const link = e.target.closest('a[data-link]');
    if (link && plainClick(e)) { e.preventDefault(); navigate(link.getAttribute('href')); return; }
    const t = e.target;
    const shBtn = t.closest('[data-share]'); if (shBtn) { openShare(shBtn.dataset.share); return; }
    const zoomBtn = t.closest('[data-zoom]'); if (zoomBtn && state.cur) { openZoom(state.cur); return; }
    const stepBtn = t.closest('[data-step]'); if (stepBtn) { step(+stepBtn.dataset.step); return; }
    if (t.closest('[data-slideshow]')) { startSlideshow(state.ctx); return; }
    const tab = t.closest('[data-col]'); if (tab) { state.col = tab.dataset.col; renderPage('/saves'); return; }
    if (t.closest('#col-new')) { const c = createCollection(prompt('Name your collection')); if (c) { state.col = c.id; renderPage('/saves'); } return; }
    if (t.closest('#col-rename')) { const c = colById(state.col), n = c && prompt('Rename collection', c.name); if (n && n.trim()) { c.name = n.trim().slice(0, 40); saveCols(); renderPage('/saves'); } return; }
    if (t.closest('#col-del')) { const c = colById(state.col); if (c && confirm(`Delete “${c.name}”? The paintings stay in the gallery.`)) { state.cols = state.cols.filter((x) => x !== c); saveCols(); state.col = 'saves'; renderPage('/saves'); } return; }
    if (t.closest('#col-share')) {
      const ids = currentIds(), name = state.col === 'saves' ? 'My saves' : colById(state.col).name, btn = t.closest('#col-share');
      copyText(`${location.origin}/c?n=${encodeURIComponent(name)}&ids=${ids.join(',')}`).then((ok) => flash(btn, ok ? 'Link copied' : 'Copy failed', 'Copy share link')); return;
    }
    if (t.closest('#col-export')) { download('troy-collections.json', JSON.stringify({ app: 'troy', saves: [...state.saves], collections: state.cols }, null, 2)); return; }
    if (t.closest('#shared-keep')) {
      const sp = new URLSearchParams(location.search), ids = (sp.get('ids') || '').split(',').map(Number).filter(Boolean);
      const c = createCollection(sp.get('n') || 'Shared collection', ids); if (c) { state.col = c.id; navigate('/saves'); } return;
    }
    const open = e.target.closest('[data-open]');
    if (open && plainClick(e)) { e.preventDefault(); openPainting(+open.dataset.open); return; }
    const save = e.target.closest('[data-save]');
    if (save) { toggleSave(+save.dataset.save); return; }
    if (e.target.closest('[data-close]')) closeModal();
  });

  document.addEventListener('change', (e) => {
    if (e.target.id !== 'col-import') return;
    const file = e.target.files[0]; if (!file) return;
    const msg = $('#backup-msg');
    file.text().then((txt) => {
      const d = JSON.parse(txt), ok = (a) => Array.isArray(a) ? a.filter((n) => Number.isInteger(n)) : [];
      if (d.app !== 'troy') throw 0;
      ok(d.saves).forEach((id) => state.saves.add(id)); store.set('troy.saves', [...state.saves]);
      (Array.isArray(d.collections) ? d.collections : []).forEach((c) => {
        if (!c || typeof c.name !== 'string' || colById(c.id)) return;
        state.cols.push({ id: String(c.id || 'c' + Date.now().toString(36)), name: c.name.slice(0, 40), ids: ok(c.ids) });
      });
      saveCols(); syncSaves(); renderPage('/saves');
      const m = $('#backup-msg'); if (m) m.textContent = 'Imported.';
    }).catch(() => { if (msg) msg.textContent = 'That file isn’t a TROY export.'; });
  });

  document.addEventListener('keydown', (e) => {
    if (shareEl) { if (e.key === 'Escape') { closeShare(); e.stopPropagation(); } return; }
    if (state.zoom) {
      if (e.key === 'Escape') { closeZoom(); e.stopPropagation(); } else if (e.key === '+' || e.key === '=') state.zoom.zoomBy(1.4); else if (e.key === '-') state.zoom.zoomBy(1 / 1.4);
      return;
    }
    if (state.show) {
      if (e.key === 'Escape') state.show.close(); else if (e.key === 'ArrowRight') state.show.go(1); else if (e.key === 'ArrowLeft') state.show.go(-1); else if (e.key === ' ') { e.preventDefault(); state.show.toggle(); }
      return;
    }
    if (state.modalId === null) return;
    if (e.key === 'Escape') { closeModal(); return; }
    if (e.key === 'ArrowRight') { step(1); return; }
    if (e.key === 'ArrowLeft') { step(-1); return; }
    if (e.key === 'Tab') { // keep focus inside the dialog
      const f = [...modalRoot.querySelectorAll('a[href], button')].filter((x) => x.offsetParent !== null);
      if (!f.length) return;
      const first = f[0], last = f[f.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    }
  });

  window.addEventListener('popstate', route);

  /* ---------- boot ---------- */
  syncSaves();
  route();
})();
