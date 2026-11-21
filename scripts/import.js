// Import job: node scripts/import.js [--target 400] [--sources famous,wiki,met,aic,cma] [--refresh]
// Pulls public-domain paintings from several open-access museums and saves them to the DB.
// Each museum is independent: if one is down or changes its API, the others still import.
// Safe to re-run: existing data is never wiped on failure.
const db = require('../lib/db');
const met = require('../lib/met');
const aic = require('../lib/aic');
const cma = require('../lib/cma');
const wiki = require('../lib/wiki');
const { FAMOUS, famousOf } = require('../lib/famous');
const extra = (process.env.TROY_FAMOUS_EXTRA || '').split(',').filter(Boolean).map((n) => ({ name: n, re: new RegExp(n, 'i'), not: null, wd: n, nat: 'Test' })); // for offline tests

const args = process.argv.slice(2);
const flag = (n, d) => { const i = args.indexOf(n); return i < 0 ? d : args[i + 1] ?? true; };
const REFRESH = args.includes('--refresh');
const SOURCES = String(flag('--sources', 'famous,wiki,met,aic,cma')).split(',').map((s) => s.trim());
const TARGET = { met: 600, aic: 400, cma: 400 };
if (flag('--target', null)) for (const k of Object.keys(TARGET)) TARGET[k] = Number(flag('--target')); // per museum

const save = (() => { let b = []; return { add(p) { b.push(p); if (b.length >= 25) this.flush(); }, flush() { if (b.length) { db.upsert(b); b = []; } } }; })();

// Run fn over items with a few requests in flight (start times are still spaced out by the throttle).
async function pool(items, n, fn) {
  let i = 0;
  await Promise.all(Array.from({ length: Math.min(n, items.length) }, async () => { while (i < items.length) await fn(items[i++]); }));
}

async function importMet(have) {
  const share = Math.ceil(TARGET.met / met.DEPARTMENTS.length);
  let total = 0;
  for (const [dept, label] of met.DEPARTMENTS) {
    let kept = 0, skipped = 0;
    try {
      for (let offset = 0; offset + 500 <= 10000 && kept < share; offset += 500) {
        const ids = await met.searchPage(offset, 500, dept);
        if (!ids.length) break;
        let pos = 0;
        while (pos < ids.length && kept < share) {
          const chunk = ids.slice(pos, pos + Math.max(share - kept, 1)); pos += chunk.length; // only as many as still needed
          await pool(chunk, 5, async (id) => {
            if (have.has(id)) { kept++; return; }
            try { const p = met.toPainting(await met.fetchObject(id)); if (p) { save.add(p); kept++; } else skipped++; }
            catch (err) { skipped++; console.warn(`  skip ${id}: ${err.message}`); }
          });
          console.log(`Met / ${label}: ${kept}/${share}`);
        }
      }
    } catch (err) { console.warn(`  Met / ${label}: ${err.message}`); }
    console.log(`Met / ${label}: done, kept ${kept}, skipped ${skipped}`);
    total += kept;
  }
  return total;
}

// Search every museum BY ARTIST so the best-known painters are never missed.
async function importFamous(have) {
  const list = [...FAMOUS, ...extra];
  const found = {};
  const add = (p) => { if (!have.has(p.id)) save.add(p); };
  const metRun = async () => {
    for (const f of list) {
      let n = 0;
      try {
        const ids = (await met.searchArtist(f.name)).slice(0, 30);
        await pool(ids, 5, async (id) => {
          try { const p = met.toPainting(await met.fetchObject(id)); if (p && famousOf(p.artist)?.name === f.name || (p && extra.some((e) => e.name === f.name && e.re.test(p.artist)))) { add(p); n++; } } catch { /* skip */ }
        });
      } catch (err) { console.warn(`  Met / ${f.name}: ${err.message}`); }
      found[f.name] = (found[f.name] || 0) + n;
    }
    console.log('Met masters done');
  };
  const pagedRun = (label, fetchFn) => async () => {
    for (const f of list) {
      try { const r = await fetchFn(f.name); const mine = r.items.filter((p) => famousOf(p.artist)?.name === f.name || extra.some((e) => e.name === f.name && e.re.test(p.artist))); mine.forEach(add); found[f.name] = (found[f.name] || 0) + mine.length; }
      catch (err) { console.warn(`  ${label} / ${f.name}: ${err.message}`); }
    }
    console.log(`${label} masters done`);
  };
  await Promise.all([metRun(), pagedRun('Art Institute of Chicago', (n) => aic.fetchPage(1, 40, n))(), pagedRun('Cleveland Museum of Art', (n) => cma.fetchPage(0, 40, n))()]);
  const total = Object.values(found).reduce((a, b) => a + b, 0);
  console.log('Masters per artist:', Object.entries(found).filter(([, v]) => v).map(([k, v]) => `${k} ${v}`).join(', ') || 'none');
  return total;
}

// Famous paintings held elsewhere (Louvre, Prado, ...), from Wikidata + Wikimedia Commons.
async function importWiki(have) {
  let total = 0; const names = [];
  const list = [...wiki.ARTISTS, ...extra.map((e) => ({ ...e }))];
  for (const f of list) {
    try { const items = await wiki.fetchArtist(f, 10); items.forEach((p) => { if (!have.has(p.id)) save.add(p); }); total += items.length; if (items.length) names.push(`${f.wd} ${items.length}`); else console.log(`  Wikimedia: nothing for "${f.wd}"`); }
    catch (err) { console.warn(`  Wikimedia / ${f.wd}: ${err.message}`); }
  }
  console.log('Wikimedia per artist:', names.join(', ') || 'none');
  return total;
}

async function importPaged(name, target, have, pageFn) {
  let kept = 0, page = 0;
  while (kept < target) {
    const { items, last } = await pageFn(page);
    for (const p of items) { if (kept >= target) break; if (!have.has(p.id)) save.add(p); kept++; }
    page++;
    console.log(`${name}: page ${page}, kept ${kept}`);
    if (last) break;
  }
  return kept;
}

process.on('SIGINT', () => { save.flush(); console.log(`\nStopped. Saved so far: ${db.list().length} paintings. Run again to continue.`); process.exit(0); });

async function main() {
  const have = new Set(REFRESH ? [] : db.list().map((p) => p.id));
  console.log(`DB: ${db.list().length} paintings. Sources: ${SOURCES.join(', ')}. ${REFRESH ? '(refresh)' : ''}`);
  const report = {};
  // The museums are different servers, so they import at the same time.
  await Promise.all(SOURCES.map(async (src) => {
    try {
      if (src === 'famous') report.famous = await importFamous(have);
      else if (src === 'wiki') report.wiki = await importWiki(have);
      else if (src === 'met') report.met = await importMet(have);
      else if (src === 'aic') report.aic = await importPaged('Art Institute of Chicago', TARGET.aic, have, async (pg) => { const r = await aic.fetchPage(pg + 1); return { items: r.items, last: pg + 1 >= Math.min(r.pages, 10) }; });
      else if (src === 'cma') report.cma = await importPaged('Cleveland Museum of Art', TARGET.cma, have, async (pg) => { const r = await cma.fetchPage(pg * 100); return { items: r.items, last: r.count < 100 }; });
      else console.warn(`Unknown source "${src}" (use famous, wiki, met, aic, cma)`);
    } catch (err) {
      report[src] = `failed: ${err.message}`;
      console.warn(`\n${src} stopped: ${err.message}\n(Everything already saved is kept. Other museums continue.)\n`);
    }
  }));
  save.flush();
  console.log('\nSummary:', JSON.stringify(report));
  console.log(`DB now has ${db.list().length} paintings.`);
}

main().catch((err) => { console.error(`\nImport stopped: ${err.message}`); console.error(`DB still has ${db.list().length} paintings.`); process.exit(1); });
