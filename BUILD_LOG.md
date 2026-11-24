# TROY: build log

A short documentary of how TROY was built, one entry per step.

### Step 0 - The prompt
Done: Turned the brief into a master prompt plus eight small step prompts, so any Claude chat or free LLM can rebuild or extend TROY one step at a time, logging each step.
Files: `PROMPT.md`
Next: Scaffold and data layer.

### Step 1 - Scaffold and database
Done: Chose plain Node 22 with zero dependencies, so nothing needs installing. The "database" is one JSON file with atomic writes (temp file, then rename), so a crash can't corrupt it.
Files: `package.json`, `lib/db.js`
Next: Talk to the Met.

### Step 2 - Met client and import job
Done: Client uses the new paginated `v1.1/search` (the old one returns 410), waits 120 ms between requests, and retries 403/429/5xx with backoff. The import keeps only public-domain items with a small image, saves every 25, and never wipes data if the API fails. Stores a derived `ratio` for layout and falls back to the bio's first word for missing nationality.
Files: `lib/met.js`, `scripts/import.js`
Run: `npm run import`
Next: Serve it.

### Step 3 - Server and API
Done: `node:http` server with `/api/paintings` (light list), `/api/paintings/:id` (full record, live-Met fallback, else 404) and `/api/status`. `/painting/:id` returns the app with Open Graph tags so shared links preview. Path-traversal guarded.
Files: `server.js`
Run: `npm start`
Next: The look.

### Step 4 - Frontend shell
Done: Calm design: dark default with light toggle, one soft-indigo accent, Inter as the only font, small type scale. Header with `TROY.` wordmark, nav, theme toggle and My Saves counter. History-API router, About page crediting the Met.
Files: `public/index.html`, `public/styles.css`, `public/app.js`
Next: Home and Explore.

### Step 5 - Home, Explore, detail modal
Done: Home has a slow quote slider with dots and one framed, uncropped painting, then Today's Selection (hash of the date) and Daily Ritual (visit streak). Explore is a masonry grid that reserves space from the museum's measurements and corrects to the real ratio on load; search, century and nationality filters, saved-only, lazy images. The detail opens as a modal and as its own URL, with all museum fields, both links, Save, Copy link and Met credit.
Files: `public/app.js`, `public/styles.css`
Next: Test it.

### Step 6 - Testing
Done: The cloud sandbox can't reach the Met, so I built a fake Met API (`test/mock-met.js`) and ran the real import against it: it dropped non-public-domain and image-less items as intended. A Chromium run checked home, slider, explore, search/filters, ratios, modal, save, copy link, Esc, deep link, Saves, Today, About, light theme and a 390px mobile layout. All passed. The live Met import itself is untested here.
Files: `test/mock-met.js`
Next: You run `npm run import` on your machine; later add artist pages and a timeline.

### Step 7 - Logo
Done: Made the supplied logo (light art on black) transparent, so it sits on the page background. Added it beside the TROY. wordmark and as the browser-tab icon. On the light theme a CSS filter turns it dark.
Files: `public/logo.png`, `public/favicon.png`, `public/index.html`, `public/styles.css`
Next: Run the site, check the import, then SQLite / artist pages / timeline.

### Step 8 - Greek skin
Done: Light theme is ivory + antique gold, dark theme is warm black + soft gold. Greek key (meander) borders on the top, footer, dividers and detail pop-up; stitched gold line under the header; double-line gilded frames on paintings. Background: faint marble veining, two fluted columns that drift with the mouse and scroll, and a soft gold light that follows the cursor. Sections fade in as you scroll. Headings use Cormorant Garamond (serif); everything else stays Inter. Motion is skipped for "reduce motion"; the glow only runs with a mouse.
Files: `public/greek.css` (all colours and ornaments), `public/greek.js` (cursor glow, parallax), `public/index.html`, `public/app.js` (dividers, fade-in)
Undo: delete the `greek.css` and `greek.js` lines in `index.html` to get the plain look back.
Next: Run the site, check the import, then SQLite / artist pages / timeline.

### Step 9 - Frieze borders and painted-ceiling background
Done: Replaced the marble with a painted-ceiling look: golden sky, slowly drifting clouds, nested Gothic pointed ribs with small bosses, and stars that glow near the cursor. Borders now carry a frieze of tiny black-figure scenes: marching Spartan-style hoplites, chariots at a gallop, duels with a fallen warrior, a king on his throne giving orders, and the Trojan horse hauled on wheels. The frieze runs along the top and footer, between sections, and over the detail pop-up. The meander lines were made finer and rounder, and motion eased out.
Files: `public/frieze.svg` (the figures), `public/greek.css`, `public/greek.js`, `public/index.html`
Option: to use your own fresco image as the sky, save it as `public/ceiling.jpg` and enable the commented block at the bottom of `greek.css`.
Next: Run the site, check the import, then SQLite / artist pages / timeline.

### Step 10 - Calm skin
Done: Removed the ornate Greek borders, columns, stars and clouds. The site is now minimal and easy on the eyes: warm linen (light) and soft umber (dark), one muted ochre accent, serif headings, paintings hung with a thin mat and a soft shadow, a faint canvas grain and a gentle warm wash at the top. Motion is only a slow fade-in. The Greek version is archived in `extras/greek-skin/`.
Files: `public/calm.css`, `public/index.html`, `public/app.js`, `extras/greek-skin/*`
Next: Run the site, then SQLite / artist pages / timeline.

### Step 11 - Studio skin (editorial art look)
Done: Matched the style of the reference images: a hairline column grid, tiny monospaced labels, numbered nav, live local time, and "N° 001" numbering on every painting. The hero painting is annotated with thin leader lines carrying the museum's own title, artist, date, medium and size. A slow dotted wave sheet (generative art on a canvas) sits behind the hero and lifts gently near the cursor; it pauses off-screen and shows a still frame for "reduce motion". Hover on a painting shows small crop-mark corners. Detail pop-up is a clean table of hairline rows. One quiet sage accent on paper (light) and deep ink (dark). The previous calm and Greek looks are archived in `extras/`.
Files: `public/studio.css`, `public/wave.js`, `public/index.html`, `public/app.js`, `extras/calm-skin/*`
Next: Run the site, then SQLite / artist pages / timeline.

## Step 12: Background art
Replaced the editorial skin with a quiet interface over generative backgrounds: ink-wash mountains, topographic contours, a dotted point-cloud, flow lines, and a blurred "painting glow" of today's pick. The header's Art button cycles them and remembers the choice. Motion is slow, pauses when the tab is hidden, and stops with "reduce motion". Files: public/art.js, public/art.css.

## Step 13: Artists and Timeline
Added /artists (everyone in the gallery, with a few thumbnails), /artist/:slug (their paintings oldest first, with the museum's bio line), and /timeline (one sideways-scrolling row per century). The artist name in the painting window now links to the artist page. Built only from the museum's own fields. Files: public/app.js, art.css, index.html (nav), server.js (routes).

## Step 14: The big feature pass
Painting window: next/previous (arrows, swipe, buttons), "More like this", zoom (wheel, pinch, drag, double-click; loads the museum's full-size file), Download, Print (prints only the painting and caption). Explore: sort, colour filter (colours are read from the images in your browser, once, then remembered), search over title/artist/medium/nationality/date with suggestions, Slideshow. Saves: named collections, share links, export/import file. Hosting: sitemap.xml, robots.txt, Dockerfile, DEPLOY.md. Accounts left out on purpose.

## Step 15: Paintings from around the world
Import now covers 6 Met departments plus the Art Institute of Chicago and the Cleveland Museum of Art (all public domain / CC0). Each museum imports independently, so one being down does not stop the rest. Added lib/world.js to unify nationality labels and derive a region, plus Region and Museum filters, per-museum credits in the painting window, and updated About/footer credit. Files: lib/aic.js, lib/cma.js, lib/http.js, lib/world.js, scripts/import.js, public/app.js.

## Step 16: Ten backgrounds, new one each visit
Added five designs (ridgelines, constellation, halftone, watercolour, moiré rings) to the five existing ones. The site now draws one at random on each visit or refresh, never repeating the last. The Art button can lock a favourite instead. File: public/art.js.

## Step 17: Faster import
Museums now import at the same time, the Met uses 5 requests in flight (still at least 100 ms between starts), retries are shorter, progress prints often, and Ctrl+C saves what it has. File: scripts/import.js, lib/http.js.

## Step 18: Search in the top bar, fresh paintings each visit
On Explore, when the filters scroll out of sight a search box appears in the top bar (the two boxes mirror each other). Explore's default order and the home picture are now new on every visit (Today's Selection stays the same all day). The colour filter was blocked by the museums' image servers, so images now come through /img on TROY's own server (only addresses already in the gallery, nothing stored). Files: public/app.js, art.css, index.html, server.js.

## Step 19: The famous painters
Why they were missing: the import took the first paintings each museum listed, not the famous ones, and the three museums own few Leonardo/Michelangelo paintings. Now (1) the import searches every museum by ~66 famous painters' names, (2) a new Wikimedia source adds famous paintings held elsewhere (Louvre, Prado...) from Wikidata with Commons images, (3) a Masters only filter, masters first on the Artists page, and the home picture prefers a master's work. Files: lib/famous.js, lib/wiki.js, scripts/import.js, public/app.js, server.js.

## Step 20: Customer care, privacy, safety
Added Privacy & safety, Terms and Contact pages (footer links), a Report a problem link in every painting window (needs TROY_EMAIL), a friendly not-found page, security headers with a Content-Security-Policy (no outside scripts, so no ads), a request-rate limit, and data/hidden.json to take a painting down instantly. Files: server.js, public/app.js, public/index.html, README.md.

## Step 21: Share buttons + site feedback
- Share: header icon, footer "Share TROY", and a Share button on every painting. Phones open the native share menu; desktop gets a sheet (copy link, WhatsApp, Telegram, X, Facebook, Reddit, Pinterest, Email).
- Link previews: every page now has Open Graph/Twitter tags (paintings use their own image) so shared links look good.
- Feedback: /feedback page (stars, type, message, optional email, hidden spam trap). POST /api/feedback is rate-limited (5/min), saved to data/feedback.jsonl and forwarded to TROY_WEB3FORMS_KEY (email) and/or TROY_FEEDBACK_WEBHOOK (Discord/Slack). Privacy page updated.

## Step 22: https everywhere in sitemap / canonical / Open Graph
- One `baseUrl()` in server.js now feeds the sitemap, robots.txt, `og:url` and a new `<link rel="canonical">`. It uses TROY_URL, then Render's RENDER_EXTERNAL_URL, then the Host header, and always forces https except on localhost (the request protocol is never used, because Render's proxy reports http).
