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
const PAGES = /^\/(explore|today|about|saves|artists|timeline|c|privacy|terms|contact)?\/?$|^\/artist\/[a-z0-9-]+\/?$|^\/painting\/\d+\/?$/;

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
    "default-src 'self'", `script-src 'self'${hash}`, "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com", "font-src https://fonts.gstatic.com",
    "img-src 'self' data: blob: https: http:", "connect-src 'self'", "object-src 'none'", "base-uri 'self'", "form-action 'self'", "frame-ancestors 'none'",
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

function servePage(req, res, url, code = 200) {
  let html = fs.readFileSync(path.join(PUBLIC, 'index.html'), 'utf8');
  const m = /^\/painting\/(\d+)/.exec(url.pathname);
  const p = m && db.getById(m[1]);
  if (p) { // Open Graph tags so shared links get a preview
    const desc = [p.artist, p.date].filter(Boolean).join(', ');
    const tags = `<title>${esc(p.title)} · TROY</title>
<meta property="og:title" content="${esc(p.title)}">
<meta property="og:description" content="${esc(desc)}">
<meta property="og:image" content="${esc(p.thumb)}">`;
    html = html.replace('<title>TROY</title>', tags);
  }
  res.writeHead(code, { 'Content-Type': MIME['.html'], 'Content-Security-Policy': csp() });
  res.end(html);
}

// Search engines: robots.txt and sitemap.xml. Set TROY_URL=https://your-site.example for correct addresses.
function seo(req, res, url) {
  const base = (process.env.TROY_URL || `http://${req.headers.host}`).replace(/\/+$/, '');
  if (url.pathname === '/robots.txt') { res.writeHead(200, { 'Content-Type': 'text/plain' }); return res.end(`User-agent: *\nAllow: /\nSitemap: ${base}/sitemap.xml\n`); }
  const paths = ['/', '/explore', '/artists', '/timeline', '/today', '/about', '/privacy', '/contact', ...visible().map((p) => `/painting/${p.id}`)];
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
  if (!SUPPORT_EMAIL) console.log('Tip: set TROY_EMAIL=you@example.com so visitors can reach you (shown on the Contact page).');
});
