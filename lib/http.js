// Shared polite HTTP client: one throttle per museum, retries with backoff.
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function client({ gapMs, name }) {
  let last = 0;
  const throttle = async () => {
    const wait = last + gapMs - Date.now();
    last = Math.max(Date.now(), last + gapMs);
    if (wait > 0) await sleep(wait);
  };
  // Returns parsed JSON, or null for 404. Retries 403/429/5xx with backoff.
  return async function getJson(url, tries = 5) {
    for (let i = 0; i < tries; i++) {
      await throttle();
      let res;
      try {
        res = await fetch(url, { headers: { 'User-Agent': 'TROY-gallery/0.2', Accept: 'application/json' } });
      } catch (err) {
        if (i === tries - 1) throw err;
        await sleep(500 * 2 ** i);
        continue;
      }
      if (res.ok) return res.json();
      if (res.status === 404) return null;
      if (res.status === 410) throw new Error(`${name}: HTTP 410 (endpoint retired): ${url}`);
      if ([403, 429].includes(res.status) || res.status >= 500) { await sleep(500 * 2 ** i); continue; }
      throw new Error(`${name}: HTTP ${res.status}: ${url}`);
    }
    throw new Error(`${name}: gave up after ${tries} tries: ${url}`);
  };
}
module.exports = { client, sleep };
