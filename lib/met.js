// Met Open Access API client: throttled (>=100 ms between requests) with retries.
const BASE = process.env.MET_BASE || 'https://collectionapi.metmuseum.org/public/collection';
const MIN_GAP_MS = Number(process.env.MET_GAP_MS || 120); // never below 100
const MUSEUM = 'The Metropolitan Museum of Art';

const { client } = require('./http');
const { nationality: normNat } = require('./world');
const getJson = client({ gapMs: Math.max(MIN_GAP_MS, 100), name: 'Met' }); // never below 100 ms

// Departments searched (medium=Paintings in each): the Met's paintings from around the world.
const DEPARTMENTS = [[11, 'European Paintings'], [21, 'Modern and Contemporary Art'], [1, 'The American Wing'], [6, 'Asian Art'], [14, 'Islamic Art'], [5, 'Arts of Africa, Oceania and the Americas']];

// One page of object IDs (v1.1 paginated search; offset + limit <= 10000).
async function searchPage(offset, limit = 500, dept = 11) {
  const url = `${BASE}/v1.1/search?hasImages=true&departmentId=${dept}&medium=Paintings&offset=${offset}&limit=${limit}`;
  const data = await getJson(url);
  return (data && data.objectIDs) || [];
}

// Object ids whose artist/culture matches a name (paintings only).
async function searchArtist(name) {
  const data = await getJson(`${BASE}/v1.1/search?hasImages=true&artistOrCulture=true&medium=Paintings&q=${encodeURIComponent(name)}`);
  return (data && data.objectIDs) || [];
}

const fetchObject = (id) => getJson(`${BASE}/v1/objects/${id}`, 3);

// Height/width ratio from the museum's own measurements (used only to reserve
// space in the grid before an image loads). Falls back to the dimensions text.
function ratioOf(o) {
  const overall = (o.measurements || []).find((m) => m.elementName === 'Overall');
  const h0 = overall && overall.elementMeasurements && overall.elementMeasurements.Height;
  const w0 = overall && overall.elementMeasurements && overall.elementMeasurements.Width;
  if (h0 > 0 && w0 > 0) return +(h0 / w0).toFixed(4);
  const m = /\(([\d.]+)\s*[×x]\s*([\d.]+)\s*cm\)/.exec(o.dimensions || '');
  if (m && +m[1] > 0 && +m[2] > 0) return +(+m[1] / +m[2]).toFixed(4);
  return null;
}

// Fallback: the museum's bio text usually starts with the nationality ("French, Paris 1832-1883").
function nationalityOf(o) {
  if (o.artistNationality) return normNat(o.artistNationality);
  const first = (o.artistDisplayBio || '').split(',')[0].trim();
  return normNat(/^[A-Za-z' -]{3,30}$/.test(first) ? first : o.culture);
}

// Keep ONLY public-domain items that have a small image. Otherwise null.
function toPainting(o) {
  if (!o || o.isPublicDomain !== true || !o.primaryImageSmall) return null;
  return {
    id: o.objectID,
    title: o.title || 'Untitled',
    artist: o.artistDisplayName || '',
    artistBio: o.artistDisplayBio || '',
    nationality: nationalityOf(o),
    date: o.objectDate || '',
    year: Number.isFinite(o.objectBeginDate) ? o.objectBeginDate : null,
    medium: o.medium || '',
    dimensions: o.dimensions || '',
    creditLine: o.creditLine || '',
    museum: MUSEUM,
    objectURL: o.objectURL || '',
    image: o.primaryImage || o.primaryImageSmall,
    thumb: o.primaryImageSmall,
    ratio: ratioOf(o), // derived, for layout only
  };
}

module.exports = { DEPARTMENTS, searchPage, searchArtist, fetchObject, toPainting, MUSEUM };
