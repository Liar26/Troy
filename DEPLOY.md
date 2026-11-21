# Putting TROY on the internet

TROY is one Node process with a JSON file for data. Any host that runs Node works.

## Easiest: Render.com (free tier works)
1. Put the project on GitHub (include `data/paintings.json` after running `npm run import` locally, so the site starts full).
2. Render > New > Web Service > pick the repo. Build command: leave empty. Start command: `npm start`.
3. Add an environment variable `TROY_URL` = your site address (used by sitemap.xml).
4. Open the address. Done. Submit `https://your-site/sitemap.xml` to Google Search Console.

## Other hosts
Railway, Fly.io and any VPS work the same way. A `Dockerfile` is included.
- Keep `data/` on a persistent disk if you want to re-import on the server.
- To refresh the collection: `npm run import` (it is polite to the Met, so it takes a few minutes).

## When to move to a real database
The JSON file is fine for the ~1,000 paintings in this gallery. Consider SQLite only if you grow past tens of thousands of works.

## Not included on purpose
Accounts and sync. Saves and collections live in each browser; the Saves page has Export/Import to move them between devices.

## Before you go public (checklist)
1. Set `TROY_EMAIL` (Contact page and report links) and `TROY_URL` (sitemap).
2. Use HTTPS (Render, Railway and Fly give it automatically).
3. Read /privacy and /terms once and adjust the wording to match you. These are plain-language drafts, not legal advice; if you add ads, payments or accounts later, get them reviewed.
4. Keep a backup of `data/paintings.json` and `data/hidden.json`.
