# Launch TROY (about 15 minutes, free)

You need: a free GitHub account and a free Render account (sign in to Render with GitHub).

## 1. Put the project on GitHub (PowerShell, inside the troy folder)
```powershell
git init
git add .
git commit -m "TROY"
git branch -M main
```
Then on github.com: New repository > name it `troy` > Create (leave it empty, no README). Copy the two lines GitHub shows under "push an existing repository":
```powershell
git remote add origin https://github.com/YOUR-NAME/troy.git
git push -u origin main
```
`data/paintings.json` (your imported paintings) goes up with it. That is on purpose: the host starts with the gallery already full.

## 2. Create the site on Render
1. render.com > New > Blueprint > pick the `troy` repo > Apply.
2. It asks for two values: `TROY_EMAIL` (your support email) and `TROY_URL` (leave blank for now, add it in step 3).
3. Wait for "Live". Your address looks like `https://troy-xxxx.onrender.com`.

## 3. Finish
- Render > troy > Environment > set `TROY_URL` to your address > Save (it restarts).
- Open the site. Check: paintings load, Art button, Contact page shows your email, /sitemap.xml opens.

## Good to know
- Free Render sleeps after ~15 minutes without visitors; the first visit then takes ~30 seconds to wake it. A paid plan (about $7/month) removes this.
- Own domain (troy.com etc.): buy one, then Render > Settings > Custom Domains and follow the DNS steps. Update `TROY_URL`.
- To add more paintings later: run `npm run import` on your computer, then `git add data; git commit -m "more paintings"; git push`. Render redeploys by itself.
- To hide a painting: edit `data/hidden.json` and push the same way.
- Submit `https://YOUR-ADDRESS/sitemap.xml` to Google Search Console so people can find you.
