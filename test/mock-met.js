// OFFLINE TEST ONLY. A fake Met API so the import job and site can be tried without internet.
// Everything it returns is placeholder data ("Test Painting"), never real art history.
// Run: node test/mock-met.js   then: MET_BASE=http://localhost:4010/public/collection npm run import -- --target 20
const http = require('http');
const PORT = process.env.MOCK_PORT || 4010;
const N = 40;
const SIZES = [[3, 4], [4, 3], [1, 1], [2, 3], [16, 9], [9, 16]]; // varied aspect ratios

const hues = (i) => (i * 47) % 360;
const svg = (i, w, h) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}">
<rect width="100%" height="100%" fill="hsl(${hues(i)} 35% 55%)"/><rect x="${w * .1}" y="${h * .1}" width="${w * .8}" height="${h * .8}" fill="hsl(${hues(i) + 30} 30% 70%)"/>
<text x="50%" y="52%" text-anchor="middle" font-family="sans-serif" font-size="${Math.min(w, h) / 8}" fill="#fff">TEST ${i}</text></svg>`;

function object(i) {
  const [w, h] = SIZES[i % SIZES.length];
  const base = `http://localhost:${PORT}`;
  const year = 1400 + i * 14;
  return {
    objectID: 100000 + i,
    isPublicDomain: i % 7 !== 0,                       // some are NOT public domain
    primaryImageSmall: i % 11 === 0 ? '' : `${base}/img/${i}-small.svg`, // some have no image
    primaryImage: `${base}/img/${i}-large.svg`,
    title: `Test Painting ${i}`,
    artistDisplayName: `Test Artist ${i % 6}`,
    artistDisplayBio: `${['French', 'Dutch', 'Italian'][i % 3]}, Testville ${year - 30}–${year + 20}`,
    artistNationality: i % 2 ? ['French', 'Dutch', 'Italian'][i % 3] : '',
    objectDate: `${year}`, objectBeginDate: year,
    medium: 'Oil on canvas (test)',
    dimensions: `${h * 10} × ${w * 10} cm`,
    measurements: [{ elementName: 'Overall', elementMeasurements: { Height: h * 10, Width: w * 10 } }],
    creditLine: 'Test credit line',
    objectURL: `https://www.metmuseum.org/art/collection/search/${100000 + i}`,
  };
}

// Fake AIC and CMA responses in the same shape those APIs use (for importer tests).
const base = () => `http://localhost:${PORT}`;
const NATS = [['French', 'France'], ['Japanese', 'Japan'], ['Nigerian', 'Nigeria'], ['Indian', 'India'], ['Mexican', 'Mexico']];
function aicItem(i) {
  const [w, h] = SIZES[i % SIZES.length]; const [nat] = NATS[i % NATS.length];
  return { id: 5000 + i, title: `AIC Test Painting ${i}`, artist_title: `AIC Artist ${i % 5}`, artist_display: `AIC Artist ${i % 5}\n${nat}, ${1700 + i}–${1760 + i}`,
    date_display: `${1730 + i}`, date_start: 1730 + i, place_of_origin: NATS[i % 5][1], medium_display: 'Oil on canvas (test)', dimensions: '40 x 30 cm', credit_line: 'AIC test credit',
    image_id: `aic${i}`, is_public_domain: i % 9 !== 0, thumbnail: { width: w * 100, height: h * 100 }, artwork_type_title: 'Painting', classification_title: 'painting' };
}
function cmaItem(i) {
  const [w, h] = SIZES[(i + 2) % SIZES.length]; const [nat, country] = NATS[(i + 1) % NATS.length];
  return { id: 7000 + i, title: `CMA Test Painting ${i}`, creation_date: `${1800 + i}`, creation_date_earliest: 1800 + i,
    creators: [{ description: `CMA Artist ${i % 4} (${nat}, ${1780 + i}–${1850 + i})` }], culture: [`${country}, 19th century`], technique: 'oil on canvas (test)', measurements: 'Unframed: 50 x 40 cm',
    creditline: 'CMA test credit', url: `https://www.clevelandart.org/art/test-${i}`, share_license_status: i % 8 === 0 ? 'Copyrighted' : 'CC0',
    images: { web: { url: `${base()}/img/${i + 200}-small.svg`, width: w * 100, height: h * 100 }, print: { url: `${base()}/img/${i + 200}-large.svg` } } };
}

http.createServer((req, res) => {
  const u = new URL(req.url, 'http://x');
  let m;
  if (u.pathname === '/hook') { let b = ''; req.on('data', (c) => (b += c)); req.on('end', () => { console.log('HOOK', b); res.writeHead(200); res.end('ok'); }); return; }
  if (u.pathname === '/aic/api/v1/artworks/search') {
    const page = +u.searchParams.get('page') || 1, lim = +u.searchParams.get('limit') || 100, TOTAL = 60;
    const all = Array.from({ length: TOTAL }, (_, i) => aicItem(i)).filter((x) => x.is_public_domain);
    res.setHeader('Content-Type', 'application/json');
    return res.end(JSON.stringify({ pagination: { total: all.length, total_pages: Math.ceil(all.length / lim), current_page: page }, data: all.slice((page - 1) * lim, page * lim), config: { iiif_url: `${base()}/aiciiif` } }));
  }
  if ((m = /^\/aiciiif\/aic(\d+)\/full\/\d+,\/0\/default\.jpg$/.exec(u.pathname))) { res.setHeader('Content-Type', 'image/svg+xml'); res.setHeader('Access-Control-Allow-Origin', '*'); const [w, h] = SIZES[+m[1] % SIZES.length]; return res.end(svg(+m[1] + 100, w * 100, h * 100)); }
  if (u.pathname === '/sparql') {
    const label = /"([^"]+)"@en/.exec(u.searchParams.get('query') || '')?.[1] || 'X';
    const row = (n) => ({ p: { value: `http://www.wikidata.org/entity/Q${900000 + n}` }, pLabel: { value: `Wiki Test Painting ${n} (${label})` }, inception: { value: `+${1500 + n}-01-01T00:00:00Z` },
      image: { value: `${base()}/img/${300 + n}-large.svg` }, collLabel: { value: 'Test Louvre' }, mediumLabel: { value: 'oil paint' }, sl: { value: String(90 - n) }, born: { value: '+1480-01-01T00:00:00Z' }, died: { value: '+1550-01-01T00:00:00Z' } });
    res.setHeader('Content-Type', 'application/json');
    return res.end(JSON.stringify({ results: { bindings: label === 'Test Wiki' ? [row(1), row(2), row(2), row(3)] : [] } }));
  }
  if (u.pathname === '/cma/api/artworks/') {
    const skip = +u.searchParams.get('skip') || 0, lim = +u.searchParams.get('limit') || 100;
    const all = Array.from({ length: 45 }, (_, i) => cmaItem(i));
    res.setHeader('Content-Type', 'application/json');
    return res.end(JSON.stringify({ data: all.slice(skip, skip + lim) }));
  }
  if (u.pathname.endsWith('/v1.1/search')) {
    const off = +u.searchParams.get('offset') || 0, lim = +u.searchParams.get('limit') || 500;
    const ids = Array.from({ length: N }, (_, i) => 100000 + i).slice(off, off + lim);
    res.setHeader('Content-Type', 'application/json');
    return res.end(JSON.stringify({ total: N, objectIDs: ids }));
  }
  if (u.pathname.endsWith('/v1/search')) { res.writeHead(410); return res.end('retired'); }
  if ((m = /\/v1\/objects\/(\d+)$/.exec(u.pathname))) {
    const i = +m[1] - 100000;
    if (i < 0 || i >= N) { res.writeHead(404); return res.end('{}'); }
    res.setHeader('Content-Type', 'application/json');
    return res.end(JSON.stringify(object(i)));
  }
  if ((m = /\/img\/(\d+)-(small|large)\.svg$/.exec(u.pathname))) {
    const [w, h] = SIZES[+m[1] % SIZES.length];
    res.setHeader('Content-Type', 'image/svg+xml'); res.setHeader('Access-Control-Allow-Origin', '*');
    return res.end(svg(+m[1], w * 100, h * 100));
  }
  res.writeHead(404); res.end();
}).listen(PORT, () => console.log(`Mock Met API on http://localhost:${PORT}`));
