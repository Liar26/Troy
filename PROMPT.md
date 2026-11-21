# TROY: prompt for another Claude chat (or any LLM)

How to use it:
- **Strong model / Claude Code:** paste the **Master prompt** once.
- **Free or small-context LLM:** paste the **Master prompt** first, then send the **Step prompts** one at a time. Don't move on until the step runs.
- The build log is part of the deal: after every step the model writes a 2–4 line entry for `BUILD_LOG.md`.

---

## Master prompt (copy everything in this block)

```
You are a senior full-stack developer and a calm, minimal designer.
Build a web app called TROY: a clean, minimal gallery of public-domain
paintings, shown in their ORIGINAL proportions (never cropped), with real
information about each work.

HOW WE WORK
- Work in numbered steps. After EACH step, stop and write a "Build Log" entry:
  "Step N - <name>. Done: <1-2 lines>. Files: <list>. Next: <one line>."
  Keep it short, like a mini documentary of the build. Then wait for me to say "next".
- Keep the code simple to modify: plain Node.js (v18+) with NO npm dependencies,
  vanilla HTML/CSS/JS with no build step, small files, short comments.
- Tell me exactly what command to run to test each step.

LOOK: CLEAN AND CALM
- Quiet, gallery-like. Lots of white space, generous margins.
- Dark theme by default with a light-theme toggle (remember the choice).
- One accent colour (soft indigo), one font family, a restrained type scale.
- No clutter, no heavy gradients, no decorative effects. The paintings are the
  stars. Subtle, smooth motion only. Fully responsive, mobile-first.

DATA SOURCE: The Metropolitan Museum of Art Open Access API (no key)
- The OLD /public/collection/v1/search endpoint was retired on 1 Oct 2026 and
  returns HTTP 410. Use the paginated one instead:
  GET https://collectionapi.metmuseum.org/public/collection/v1.1/search?hasImages=true&departmentId=11&medium=Paintings&offset=0&limit=500
  (max 500 per page; offset + limit must not exceed 10,000)
- Details per painting:
  GET https://collectionapi.metmuseum.org/public/collection/v1/objects/{objectID}
- Backend import job: fetch about 500 paintings and save them to the database.
  Keep an item ONLY if isPublicDomain is true AND primaryImageSmall exists.
  Wait at least 100 ms between requests (well under the Met's 80 req/s limit).
- Store: id, title, artist (artistDisplayName), artistBio (artistDisplayBio),
  nationality (artistNationality), date (objectDate), year (objectBeginDate),
  medium, dimensions, creditLine, museum name, objectURL,
  image (primaryImage), thumb (primaryImageSmall).
- Hot-link images from the museum's servers. Never download or store image files.
- Use ONLY the museum's own text for painting information. Never invent or
  generate art-history descriptions.

PAGES AND FEATURES
1. Home: header with the "TROY." wordmark, nav (Explore, Today, About), a theme
   toggle and a "My Saves" counter. Hero = slow rotating art-quote slider with
   dot indicators + ONE framed painting shown uncropped. Below: "Today's
   Selection" (a different painting each day, chosen deterministically from the
   date) and "Your Daily Ritual" (a daily-visit streak counter).
2. Explore: masonry grid that keeps every painting's true aspect ratio.
   Search by title or artist. Filters by century and nationality. A "saved only"
   toggle. Lazy-loaded images.
3. Painting detail: opens as a modal AND has its own shareable URL like
   /painting/436535. Shows large image, title, artist with life dates, date,
   medium, dimensions, nationality, museum, credit line, "View at the museum"
   link, "Original file" link, a Save button and a Copy-link button.
4. Saves: per visitor in localStorage. No login.
5. LATER (not now): artist pages and a timeline view.

RULES
- No accounts, no payments, no ads.
- Handle errors gracefully: if the Met API is down, serve cached data from the
  database. The import job must never wipe existing data on failure.
- Credit the Met on the About page and in each painting's detail view.

STEPS
1. Project scaffold + database layer (a simple JSON file is fine; easy to swap).
2. Met API client (throttled, retries) + import job + a way to test it offline.
3. HTTP server + JSON API (/api/paintings, /api/paintings/:id) + SPA fallback
   for /painting/:id.
4. Frontend shell: theme, header, router, saves, About page.
5. Home page: hero, quote slider, Today's Selection, Daily Ritual.
6. Explore: masonry, search, filters, saved-only, lazy loading.
7. Painting detail modal + shareable URL + copy link.
8. Test, polish, README ("what to run").

Start with Step 1 only.
```

---

## Step prompts (for small or free LLMs, send one at a time)

**Step 1 - scaffold + database**
```
Context: TROY, a minimal public-domain painting gallery (Met Open Access API).
Plain Node.js 18+, no npm dependencies, vanilla frontend.
Task: create package.json (scripts: start, import), folders (lib, scripts,
public, data) and lib/db.js: a JSON-file database with load(), save(),
upsert(items), getById(id), list(). Writes must be atomic (temp file + rename).
End with a Build Log entry (2-4 lines).
```

**Step 2 - Met client + import**
```
Add lib/met.js and scripts/import.js. Search URL:
https://collectionapi.metmuseum.org/public/collection/v1.1/search?hasImages=true&departmentId=11&medium=Paintings&offset=0&limit=500
(v1/search returns 410 now). For each id call /v1/objects/{id}. Keep only
isPublicDomain === true with a primaryImageSmall. Minimum 100 ms between
requests; retry on 403/429/5xx with backoff; skip 404. Map to the fields: id,
title, artist, artistBio, nationality, date, year, medium, dimensions,
creditLine, museum, objectURL, image, thumb. Never wipe existing data if the
API fails. Add a tiny local mock Met server in test/ so I can test offline.
End with a Build Log entry.
```

**Step 3 - server + API**
```
Add server.js using only node:http. Serve /public statically (block path
traversal). GET /api/paintings (light list for the grid), GET /api/paintings/:id
(full record; if missing, try the live Met API, else 404). Serve index.html for
/, /explore, /today, /about, /saves and /painting/:id (inject Open Graph tags
for painting pages, HTML-escaped). End with a Build Log entry.
```

**Step 4 - frontend shell**
```
Create public/index.html, styles.css, app.js. Dark default theme with a light
toggle (CSS variables, one soft-indigo accent, one font family, restrained
type scale). Header: "TROY." wordmark, nav Explore / Today / About, theme
toggle, "My Saves (n)". History-API router (no hash). Saves in localStorage.
Write the About page crediting the Met (Open Access, CC0). Build Log entry.
```

**Step 5 - home**
```
Build the Home view: hero with a slow rotating quote slider (dot indicators,
pause on hover, respects prefers-reduced-motion) next to one framed painting,
uncropped. Then "Today's Selection" (deterministic from the date) and "Your
Daily Ritual" (localStorage visit streak). Build Log entry.
```

**Step 6 - explore**
```
Build Explore: CSS-columns masonry that preserves each painting's true aspect
ratio (reserve space with aspect-ratio, correct it when the image loads),
lazy-loaded images, search (title/artist), century and nationality filters,
"saved only" toggle, result count, friendly empty state. Build Log entry.
```

**Step 7 - detail modal**
```
Build the painting detail modal at /painting/:id (deep link works on refresh,
Esc and backdrop close it, focus is handled). Show large uncropped image,
title, artist + life dates, date, medium, dimensions, nationality, museum,
credit line, View at the museum, Original file, Save, Copy link, and a Met
credit line. Build Log entry.
```

**Step 8 - test + README**
```
Test the whole flow with the mock Met server, fix bugs, and write README.md:
what to run, env vars, how the daily pick works, how to extend later (artist
pages, timeline). Final Build Log entry.
```

---

## Build Log template (the model should append entries like this)

```
### Step N - <name>
Done: <what now works, 1-2 lines>
Files: <files added or changed>
Run: <command to test>
Next: <one line>
```
