// TROY server: static files + tiny JSON API. No dependencies. Run: node server.js
const http = require('http');
const fs = require('fs');
const path = require('path');
const db = require('./lib/db');
const met = require('./lib/met');
const { region } = require('./lib/world');
const { isFamous } = require('./lib/famous');

const PORT = process.env.PORT || 3000;
const PUBLIC = path.join(__dirname, 'public');
const MIME = {
  '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8', '.json': 'application/json',
  '.svg': 'image/svg+xml', '.ico': 'image/x-icon', '.png': 'image/png',
};
const PAGES = /^\/(explore|today|about|saves|artists|timeline|c|privacy|terms|contact|feedback)?\/?$|^\/artist\/[a-z0-9-]+\/?$|^\/painting\/\d+\/?$/;

const crypto = require('crypto');
const SUPPORT_EMAIL = process.env.TROY_EMAIL || '';   // shown on the Contact page; set it before you go public

// Paintings the owner has chosen to hide (a takedown or a bad record): put their ids in data/hidden.json, e.g. [12345, 20000001]
const HIDDEN_FILE = path.join(path.dirname(db.FILE), 'hidden.json');
let hidden = new Set(), hiddenStamp = -1;
function hiddenSet() {
  try { const m = fs.statSync(HIDDEN_FILE).mtimeMs; if (m !== hiddenStamp) { hidden = new Set(JSON.parse(fs.readFileSync(HIDDEN_FILE, 'utf8')).map(Number)); hiddenStamp = m; } }
  catch { hidden = new Set(); hiddenStamp = -1; }
  return hidden;
}
const visible = () => { const h = hiddenSet(); return h.size ? db.list().filter((p) => !h.has(p.id)) : db.list(); };

// Basic abuse guard: per-address request budget (in memory).
const hits = new Map();
function limited(req, key, max) {
  const ip = (req.headers['x-forwarded-for'] || req.socket.remoteAddress || '').toString().split(',')[0].trim();
  const k = `${key}:${ip}`, now = Date.now(), e = hits.get(k);
  if (!e || now - e.t > 60000) { hits.set(k, { t: now, n: 1 }); return false; }
  return ++e.n > max;
}
setInterval(() => { const now = Date.now(); for (const [k, e] of hits) if (now - e.t > 60000) hits.delete(k); }, 60000).unref();

// Security headers on every response. No third-party scripts are allowed to run, which also means no ad scripts.
function secure(res) {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'no-referrer');               // museums' image servers never see which page you were on
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=(), payment=(), interest-cohort=()');
  res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
}
function csp() {
  let hash = '';
  try { const m = /<script>([\s\S]*?)<\/script>/.exec(fs.readFileSync(path.join(PUBLIC, 'index.html'), 'utf8')); if (m) hash = ` 'sha256-${crypto.createHash('sha256').update(m[1]).digest('base64')}'`; } catch { /* ignore */ }
  return [
    "default-src 'self'", `script-src 'self' https://gc.zgo.at${hash}`, "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com", "font-src https://fonts.gstatic.com",
    "img-src 'self' data: blob: https: http: https://troy.goatcounter.com", "connect-src 'self' https://troy.goatcounter.com", "object-src 'none'", "base-uri 'self'", "form-action 'self'", "frame-ancestors 'none'",
  ].join('; ');
}

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const json = (res, code, data) => {
  res.writeHead(code, { 'Content-Type': 'application/json', 'Cache-Control': 'no-cache' });
  res.end(JSON.stringify(data));
};

// Light record for the grid (full record is fetched on demand).
const lite = (p) => ({ id: p.id, title: p.title, artist: p.artist, nationality: p.nationality,
  date: p.date, year: p.year, medium: p.medium, museum: p.museum, region: region(p.nationality), famous: isFamous(p.artist) || undefined, thumb: p.thumb, ratio: p.ratio });

async function api(req, res, url) {
  if (url.pathname === '/api/paintings') return json(res, 200, visible().map(lite));
  if (url.pathname === '/api/site') return json(res, 200, { email: SUPPORT_EMAIL });
  if (url.pathname === '/api/status') return json(res, 200, { ...db.meta(), source: 'database' });

  const m = /^\/api\/paintings\/(\d+)$/.exec(url.pathname);
  if (!m) return json(res, 404, { error: 'Not found' });

  if (hiddenSet().has(Number(m[1]))) return json(res, 404, { error: 'Painting not found' });
  const cached = db.getById(m[1]);
  if (cached) return json(res, 200, cached);

  // Not in the DB: try the live Met API once. If it is down, answer 404 (never crash).
  try {
    const p = met.toPainting(await met.fetchObject(m[1]));
    if (p) return json(res, 200, p);
  } catch { /* Met unreachable */ }
  return json(res, 404, { error: 'Painting not found' });
}

// Public address used in the sitemap, canonical and Open Graph tags. Always https for real sites
// (Render's proxy makes the request look like http, so the request protocol is never used).
// Order: TROY_URL, then Render's own RENDER_EXTERNAL_URL, then the Host header (http only for localhost).
function baseUrl(req) {
  let b = process.env.TROY_URL || process.env.RENDER_EXTERNAL_URL || '';
  if (!b) { const h = String(req.headers.host || 'localhost'); b = `${/^(localhost|127\.|\[::1\])/.test(h) ? 'http' : 'https'}://${h}`; }
  if (!/^https?:\/\//.test(b)) b = 'https://' + b;
  if (!/^http:\/\/(localhost|127\.)/.test(b)) b = b.replace(/^http:\/\//, 'https://');
  return b.replace(/\/+$/, '');
}
function servePage(req, res, url, code = 200) {
  let html = fs.readFileSync(path.join(PUBLIC, 'index.html'), 'utf8');
  const base = baseUrl(req);
  const m = /^\/painting\/(\d+)/.exec(url.pathname);
  const p = m && !hiddenSet().has(Number(m[1])) && db.getById(m[1]);
  // Titles/descriptions/images for link previews (WhatsApp, X, Facebook ...) so shared links look good.
  const title = p ? `${p.title} · TROY` : 'TROY';
  const desc = p ? [p.artist, p.date, p.museum].filter(Boolean).join(', ') : 'A calm gallery of public-domain paintings from museums around the world, shown in their original proportions.';
  const image = p ? p.thumb : `${base}/logo.png`;
  const tags = `<title>${esc(title)}</title>
<meta property="og:site_name" content="TROY">
<meta property="og:type" content="website">
<meta property="og:title" content="${esc(p ? p.title : 'TROY: paintings from around the world')}">
<meta property="og:description" content="${esc(desc)}">
<meta property="og:image" content="${esc(image)}">
<meta property="og:url" content="${esc(base + url.pathname)}">
<link rel="canonical" href="${esc(base + url.pathname)}">
<meta name="twitter:card" content="${p ? 'summary_large_image' : 'summary'}">`;
  html = html.replace('<title>TROY</title>', tags);
  res.writeHead(code, { 'Content-Type': MIME['.html'], 'Content-Security-Policy': csp() });
  res.end(html);
}

// ---- site feedback ----
// Saved to data/feedback.jsonl and forwarded (if you set them) to an email service or chat webhook:
//   TROY_WEB3FORMS_KEY = free key from web3forms.com (emails each message to you)
//   TROY_FEEDBACK_WEBHOOK = a Discord or Slack incoming-webhook address
// Note: free hosting can wipe local files on restart, so set one of the two above.
const FEEDBACK_FILE = path.join(path.dirname(db.FILE), 'feedback.jsonl');
function readBody(req, max = 10000) {
  return new Promise((resolve, reject) => {
    let n = 0; const chunks = [];
    req.on('data', (c) => { n += c.length; if (n > max) { reject(new Error('too large')); req.destroy(); } else chunks.push(c); });
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });
}
const clip = (v, n) => String(v ?? '').replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, '').trim().slice(0, n);
async function feedback(req, res) {
  if (limited(req, 'feedback', 5)) return json(res, 429, { error: 'Please wait a minute before sending more.' });
  let d; try { d = JSON.parse(await readBody(req)); } catch { return json(res, 400, { error: 'Bad request' }); }
  if (d.website) return json(res, 200, { ok: true });                        // hidden spam trap: bots fill it in, people never see it
  const f = { at: new Date().toISOString(), type: clip(d.type, 20) || 'idea', rating: Math.min(5, Math.max(0, Number(d.rating) || 0)), message: clip(d.message, 2000), email: clip(d.email, 120), page: clip(d.page, 200) };
  if (f.message.length < 3) return json(res, 400, { error: 'Please write a short message.' });
  try { fs.mkdirSync(path.dirname(FEEDBACK_FILE), { recursive: true }); fs.appendFileSync(FEEDBACK_FILE, JSON.stringify(f) + '\n'); } catch { /* disk may be read-only */ }
  const text = `TROY feedback (${f.type}${f.rating ? `, ${f.rating}/5` : ''})${f.page ? ` on ${f.page}` : ''}\n${f.message}${f.email ? `\nReply to: ${f.email}` : ''}`;
  const jobs = [];
  if (process.env.TROY_WEB3FORMS_KEY) jobs.push(fetch('https://api.web3forms.com/submit', { method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({ access_key: process.env.TROY_WEB3FORMS_KEY, subject: `TROY feedback: ${f.type}`, from_name: 'TROY site', email: f.email || undefined, message: text }) }));
  if (process.env.TROY_FEEDBACK_WEBHOOK) jobs.push(fetch(process.env.TROY_FEEDBACK_WEBHOOK, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ content: text.slice(0, 1900), text }) }));
  await Promise.allSettled(jobs);
  json(res, 200, { ok: true });
}

// Search engines: robots.txt and sitemap.xml. Set TROY_URL=https://your-site.example for correct addresses.
function seo(req, res, url) {
  const base = baseUrl(req);
  if (url.pathname === '/robots.txt') { res.writeHead(200, { 'Content-Type': 'text/plain' }); return res.end(`User-agent: *\nAllow: /\nSitemap: ${base}/sitemap.xml\n`); }
  const paths = ['/', '/explore', '/artists', '/timeline', '/today', '/about', '/privacy', '/contact', '/feedback', ...visible().map((p) => `/painting/${p.id}`)];
  res.writeHead(200, { 'Content-Type': 'application/xml; charset=utf-8' });
  res.end(`<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${paths.map((x) => `  <url><loc>${esc(base + x)}</loc></url>`).join('\n')}\n</urlset>\n`);
}

// Same-origin copy of a painting's image so the browser may read its pixels (colour filter).
// Only addresses that are already in the gallery are allowed, so this is not an open proxy. Nothing is stored.
let imgSet = null, imgStamp = null;
async function imgProxy(req, res, url) {
  const u = url.searchParams.get('u') || '';
  const stamp = db.meta().updatedAt;
  if (limited(req, 'img', 900)) { res.writeHead(429); return res.end('Slow down'); }
  if (!imgSet || stamp !== imgStamp) { imgSet = new Set(db.list().flatMap((p) => [p.thumb, p.image])); imgStamp = stamp; }
  if (!imgSet.has(u)) { res.writeHead(403); return res.end('Not a gallery image'); }
  try {
    const r = await fetch(u, { headers: { 'User-Agent': 'TROY-gallery/0.2' } });
    if (!r.ok) { res.writeHead(502); return res.end('Upstream error'); }
    const buf = Buffer.from(await r.arrayBuffer());
    res.writeHead(200, { 'Content-Type': r.headers.get('content-type') || 'image/jpeg', 'Cache-Control': 'public, max-age=604800' });
    res.end(buf);
  } catch { res.writeHead(502); res.end('Upstream error'); }
}

function serveStatic(req, res, url) {
  const file = path.normalize(path.join(PUBLIC, decodeURIComponent(url.pathname)));
  if (!file.startsWith(PUBLIC + path.sep)) { res.writeHead(403); return res.end('Forbidden'); } // path traversal guard
  fs.readFile(file, (err, buf) => {
    if (err) { res.writeHead(404); return res.end('Not found'); }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-cache' });
    res.end(buf);
  });
}

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, 'http://localhost');
    secure(res);
    if (url.pathname === '/api/feedback' && req.method === 'POST') return await feedback(req, res);
    if (url.pathname.startsWith('/api/')) { if (limited(req, 'api', 600)) return json(res, 429, { error: 'Too many requests' }); return await api(req, res, url); }
    if (url.pathname === '/img') return await imgProxy(req, res, url);
    if (url.pathname === '/robots.txt' || url.pathname === '/sitemap.xml') return seo(req, res, url);
    if (PAGES.test(url.pathname)) return servePage(req, res, url);
    if (!path.extname(url.pathname) && /text\/html/.test(req.headers.accept || '')) return servePage(req, res, url, 404); // friendly "page not found"
    return serveStatic(req, res, url);
  } catch (err) {
    console.error(err);
    json(res, 500, { error: 'Server error' });
  }
});

server.listen(PORT, () => {
  console.log(`TROY running at http://localhost:${PORT}  (${db.list().length} paintings in DB)`);
  if (!db.list().length) console.log('No paintings yet. Run: npm run import');
  if (!process.env.TROY_WEB3FORMS_KEY && !process.env.TROY_FEEDBACK_WEBHOOK) console.log('Tip: set TROY_WEB3FORMS_KEY (free at web3forms.com) so feedback reaches your email.');
  if (!SUPPORT_EMAIL) console.log('Tip: set TROY_EMAIL=you@example.com so visitors can reach you (shown on the Contact page).');
});
