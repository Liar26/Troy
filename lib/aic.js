// Art Institute of Chicago public API (public-domain paintings). Courtesy gap >= 1 s.
const { client } = require('./http');
const { nationality } = require('./world');
const BASE = process.env.AIC_BASE || 'https://api.artic.edu';
const OFFSET = 10_000_000; // keeps ids unique across museums
const MUSEUM = 'The Art Institute of Chicago';
const getJson = client({ gapMs: Number(process.env.AIC_GAP_MS || 1000), name: 'Art Institute of Chicago' });
const FIELDS = 'id,title,artist_title,artist_display,date_display,date_start,place_of_origin,medium_display,dimensions,credit_line,image_id,is_public_domain,thumbnail,artwork_type_title,classification_title';

async function fetchPage(page, limit = 100, artist = '') {
  const q = new URLSearchParams({
    'query[bool][must][0][term][is_public_domain]': 'true',
    'query[bool][must][1][match][artwork_type_title]': 'Painting',
    fields: FIELDS, limit: String(limit), page: String(page),
  });
  if (artist) q.set('query[bool][must][2][match][artist_title]', artist);
  const data = await getJson(`${BASE}/api/v1/artworks/search?${q}`);
  if (!data) return { items: [], pages: 0 };
  const iiif = (data.config && data.config.iiif_url) || 'https://www.artic.edu/iiif/2';
  return { items: (data.data || []).map((o) => toPainting(o, iiif)).filter(Boolean), pages: (data.pagination && data.pagination.total_pages) || 0 };
}

function toPainting(o, iiif) {
  const isPainting = /painting/i.test(`${o.artwork_type_title || ''} ${o.classification_title || ''}`);
  if (!o || o.is_public_domain !== true || !o.image_id || !isPainting) return null;
  const lines = String(o.artist_display || '').split('\n').map((x) => x.trim()).filter(Boolean);
  const bio = lines.slice(1).join(', ');
  const natLine = /^([A-Za-z' -]{3,30}),\s*(?:\d|born|active|died|c\.)/i.exec(bio);
  const t = o.thumbnail || {};
  return {
    id: OFFSET + o.id,
    title: o.title || 'Untitled',
    artist: o.artist_title || lines[0] || '',
    artistBio: bio,
    nationality: nationality(natLine ? natLine[1] : o.place_of_origin),
    date: o.date_display || '',
    year: Number.isFinite(o.date_start) ? o.date_start : null,
    medium: o.medium_display || '',
    dimensions: o.dimensions || '',
    creditLine: o.credit_line || '',
    museum: MUSEUM,
    objectURL: `https://www.artic.edu/artworks/${o.id}`,
    image: `${iiif}/${o.image_id}/full/1686,/0/default.jpg`,
    thumb: `${iiif}/${o.image_id}/full/843,/0/default.jpg`,
    ratio: t.width > 0 && t.height > 0 ? +(t.height / t.width).toFixed(4) : null,
  };
}
module.exports = { fetchPage, toPainting, MUSEUM, OFFSET };
