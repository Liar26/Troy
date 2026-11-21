# TROY.

A calm gallery of public-domain paintings from The Metropolitan Museum of Art, shown in their original proportions (never cropped), with the museum's own information.

## Run it

You need **Node.js 18 or newer** (`node -v`). There is nothing to install.

```bash
cd troy
npm run import     # fetches ~500 paintings from the Met into data/paintings.json (about 1-2 minutes)
npm start          # open http://localhost:3000
```

- `npm run import -- --target 200` imports fewer. `-- --refresh` re-fetches everything.
- Safe to re-run or interrupt: saved data is never wiped. If the Met is down the site keeps serving what is already in `data/paintings.json`.
- Change the port: `PORT=8080 npm start`.

## Try it with no internet (fake data)

```bash
npm run mock                                   # terminal 1: fake Met API on :4010
MET_BASE=http://localhost:4010/public/collection TROY_DB=data/test.json npm run import -- --target 30   # terminal 2
TROY_DB=data/test.json npm start
```
The mock returns placeholder "Test Painting" items only. Never use it for real data.

## What is where

| File | Job |
|---|---|
| `scripts/import.js` | The import job. Keeps only `isPublicDomain` items that have `primaryImageSmall`. |
| `lib/met.js` | Met API client: 100+ ms between requests, retries on 403/429/5xx, field mapping. |
| `lib/db.js` | The "database": one JSON file, atomic writes. Swap for SQLite later by keeping `load/save/upsert/list/getById`. |
| `server.js` | Static files + `/api/paintings`, `/api/paintings/:id`, `/api/status`. Serves `index.html` for `/painting/:id`, with Open Graph tags. |
| `public/app.js` | The whole frontend (router, views, modal, saves). |
| `public/styles.css` | Theme variables (colours at the top), type scale, layout. |

## Good to know

- **Images** are hot-linked from the Met. The grid and the detail view use `primaryImageSmall` (the Met's "web-large" file, a sensible size). **Original file** links to `primaryImage`, which can be many MB.
- **Aspect ratio:** the import stores `ratio` (height/width) from the museum's measurements to reserve space in the grid; the real image ratio takes over as soon as it loads.
- **Nationality:** uses `artistNationality`; if the museum leaves it blank, the first word of `artistDisplayBio` ("French, Paris 1832...") is used.
- **Today's Selection** = hash of today's local date, so everyone sees the same painting that day. Hero painting uses a different salt.
- **Saves, theme, streak** live in `localStorage` (keys `troy.saves`, `troy.theme`, `troy.ritual`).
- **Quotes** in the slider are widely attributed lines marked "(attributed)". Edit `QUOTES` in `app.js`.
- The search URL is `v1.1/search?...departmentId=11&medium=Paintings` exactly as in the brief. The cloud sandbox I built this in could not reach the Met, so the live import is untested here; if the first run fails, the error message names the URL and status.

## Later

Artist pages and a timeline: all data is already in the DB (`artist`, `year`). Add `/artist/:name` and `/timeline` routes in `PAGES` in `app.js` and a page in `server.js`'s `PAGES` regex.

## Credit

Images and information: The Metropolitan Museum of Art, Open Access (CC0).

## The look (studio skin)

Calm editorial style: hairline column grid, tiny monospaced labels, the hero painting annotated with thin leader lines (the museum's own title, artist, date, medium and size), and a slow dotted wave drawn on a canvas (`public/wave.js`).

- Colours: the two blocks at the top of `public/studio.css` (light = paper + ink, dark = deep ink). `--accent` is the one muted sage colour; change it to restyle. `--wave` sets how strong the wave is (0 hides it).
- Fonts: Inter + IBM Plex Mono (Google Fonts, need internet).
- Earlier looks are kept in `extras/calm-skin/` (linen and umber) and `extras/greek-skin/` (ornate Greek). To use one, copy its files into `public/` and change the `studio.css` link in `index.html`.

## Background art
Use the **Art** button in the header to switch between Ink wash, Contours, Point cloud, Flow lines, Painting glow and Plain. The choice is saved in your browser. Colours live in `public/art.css`; the drawing code is in `public/art.js`. To change the default, edit `let mode = 'ink'` in art.js.

## More features
Next/previous in the painting window (arrow keys or swipe), zoom, print, download, slideshow, sort, colour filter, collections with share links and export/import (Saves page), Artists and Timeline pages. To put it online, see DEPLOY.md.

## Paintings from around the world
`npm run import` now reads six Met departments (European, Modern, American, Asian, Islamic, Africa/Oceania/Americas), the Art Institute of Chicago and the Cleveland Museum of Art, about 1,400 paintings. Options: `node scripts/import.js --target 800` (per museum), `--sources met,aic` (pick museums). Explore has Region, Nationality and Museum filters.

## Backgrounds
There are 10 background designs. By default a different one is chosen every time the site is opened or refreshed (never the same twice in a row, and it does not change while you stay on the page). The Art button in the header: Surprise me, then each design (locks it), then Plain. To change the default, edit `let pref = 'shuffle'` in public/art.js.

## Contact, privacy and safety
- Pages: /privacy (privacy and safety), /terms, /contact. Footer links to them.
- Set your support address before going public: `$env:TROY_EMAIL="you@example.com"; npm start` (PowerShell) or the `TROY_EMAIL` environment variable on your host. It appears on the Contact page and in every painting's "Report a problem" link.
- To hide a painting (rights request, wrong record): add its number to `data/hidden.json`, for example `[12345, 10005001]`. No restart needed.
- The server sends security headers (including a rule that blocks any outside script, so no ad or tracking script can run), limits request rates, and `/img` only serves images already in the gallery.
