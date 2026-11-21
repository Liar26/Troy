// Cleveland Museum of Art Open Access API (CC0 paintings).
const { client } = require('./http');
const { nationality } = require('./world');
const BASE = process.env.CMA_BASE || 'https://openaccess-api.clevelandart.org';
const OFFSET = 20_000_000;
const MUSEUM = 'The Cleveland Museum of Art';
const getJson = client({ gapMs: Number(process.env.CMA_GAP_MS || 300), name: 'Cleveland Museum of Art' });
const FIELDS = 'id,title,creation_date,creation_date_earliest,creators,culture,technique,measurements,creditline,url,images,share_license_status';

async function fetchPage(skip, limit = 100, artist = '') {
  const q = new URLSearchParams({ type: 'Painting', cc0: '1', has_image: '1', fields: FIELDS, limit: String(limit), skip: String(skip) });
  if (artist) q.set('artists', artist);
  const data = await getJson(`${BASE}/api/artworks/?${q}`);
  const rows = (data && data.data) || [];
  return { items: rows.map(toPainting).filter(Boolean), count: rows.length };
}

function toPainting(o) {
  const web = o && o.images && o.images.web;
  if (!o || o.share_license_status !== 'CC0' || !web || !web.url) return null;
  const c = (o.creators || [])[0];
  const m = c && /^(.*?)\s*\((.*)\)\s*$/.exec(c.description || '');
  const artist = c ? (m ? m[1] : c.description || '') : '';
  const bio = m ? m[2] : '';
  const w = +web.width, h = +web.height;
  return {
    id: OFFSET + o.id,
    title: o.title || 'Untitled',
    artist: artist.trim(),
    artistBio: bio,
    nationality: nationality(bio.split(',')[0] || (o.culture || [])[0]),
    date: o.creation_date || '',
    year: Number.isFinite(+o.creation_date_earliest) ? +o.creation_date_earliest : null,
    medium: o.technique || '',
    dimensions: o.measurements || '',
    creditLine: o.creditline || '',
    museum: MUSEUM,
    objectURL: o.url || 'https://www.clevelandart.org',
    image: (o.images.print && o.images.print.url) || web.url,
    thumb: web.url,
    ratio: w > 0 && h > 0 ? +(h / w).toFixed(4) : null,
  };
}
module.exports = { fetchPage, toPainting, MUSEUM, OFFSET };
