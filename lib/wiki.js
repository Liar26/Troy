// Famous paintings that are not in the three museums above (the Mona Lisa is in the Louvre, for example).
// Facts come from Wikidata (CC0); images are hot-linked from Wikimedia Commons, where old works are public domain.
// Only artists who died long ago are used, so the works are public domain.
const { client } = require('./http');
const { FAMOUS } = require('./famous');
const BASE = process.env.WIKI_BASE || 'https://query.wikidata.org';
const OFFSET = 30_000_000;
const getJson = client({ gapMs: Number(process.env.WIKI_GAP_MS || 1500), name: 'Wikidata' });
const ONLY_OLD = new Set(['Pablo Picasso', 'Henri Matisse']); // too recent for this source

const q = (label) => `SELECT ?p ?pLabel ?inception ?image ?collLabel ?mediumLabel ?sl ?born ?died WHERE {
  ?creator rdfs:label "${label.replace(/"/g, '')}"@en .
  ?p wdt:P170 ?creator ; wdt:P31 wd:Q3305213 ; wdt:P18 ?image ; wikibase:sitelinks ?sl .
  OPTIONAL { ?p wdt:P571 ?inception } OPTIONAL { ?p wdt:P195 ?coll } OPTIONAL { ?p wdt:P186 ?medium }
  OPTIONAL { ?creator wdt:P569 ?born } OPTIONAL { ?creator wdt:P570 ?died }
  SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
} ORDER BY DESC(?sl) LIMIT 60`;

const yearOf = (v) => { const m = /^[+-]?(\d{3,4})/.exec(v || ''); return m ? (String(v).startsWith('-') ? -m[1] : +m[1]) : null; };

async function fetchArtist(f, limit = 10) {
  const data = await getJson(`${BASE}/sparql?format=json&query=${encodeURIComponent(q(f.wd))}`);
  const rows = (data && data.results && data.results.bindings) || [];
  const seen = new Map();
  for (const r of rows) {
    const id = /Q\d+$/.exec(r.p.value)[0];
    const cur = seen.get(id) || { id, title: r.pLabel.value, image: r.image.value, year: yearOf(r.inception && r.inception.value), coll: r.collLabel && r.collLabel.value, media: new Set(), born: yearOf(r.born && r.born.value), died: yearOf(r.died && r.died.value) };
    if (r.mediumLabel) cur.media.add(r.mediumLabel.value);
    seen.set(id, cur);
  }
  return [...seen.values()].filter((o) => !/^Q\d+$/.test(o.title) && o.died && o.died <= 1950).slice(0, limit).map((o) => toPainting(o, f));
}

function toPainting(o, f) {
  const file = o.image.replace(/^http:/, 'https:');
  return {
    id: OFFSET + Number(o.id.slice(1)),
    title: o.title,
    artist: f.wd,
    artistBio: o.born && o.died ? `${f.nat}, ${o.born}–${o.died}` : f.nat,
    nationality: f.nat,
    date: o.year ? String(o.year) : '',
    year: o.year,
    medium: [...o.media].join(', '),
    dimensions: '',
    creditLine: '',
    museum: o.coll || 'Public collection',
    source: 'wikimedia',
    objectURL: `https://www.wikidata.org/wiki/${o.id}`,
    image: `${file}${file.includes('?') ? '&' : '?'}width=2400`,
    thumb: `${file}${file.includes('?') ? '&' : '?'}width=900`,
    ratio: null,
  };
}
const ARTISTS = FAMOUS.filter((f) => f.wd && !ONLY_OLD.has(f.name));
module.exports = { fetchArtist, ARTISTS, OFFSET, toPainting };
