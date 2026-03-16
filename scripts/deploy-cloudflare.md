# Deploy Market Pulse to Cloudflare Pages

Market Pulse is a **static site** (HTML + JS + JSON). Cloudflare Pages serves it
directly from a GitHub repo — no build step needed.

---

## One-time Setup (do this once)

### Step 1 — Push repo to GitHub

Run these commands from your project root (`d:\projects\market-pulse`):

```bash
git remote add origin https://github.com/YOUR_USERNAME/market-pulse.git
git branch -M main
git push -u origin main
```

> If the remote already exists, skip the first line.

---

### Step 2 — Connect to Cloudflare Pages

1. Go to [dash.cloudflare.com](https://dash.cloudflare.com) → **Workers & Pages** → **Create application** → **Pages** → **Connect to Git**
2. Authorise GitHub and select the `market-pulse` repo
3. Configure build settings:

| Setting | Value |
|---|---|
| Production branch | `main` |
| Build command | *(leave empty — no build needed)* |
| Build output directory | `/` *(root of repo)* |
| Root directory | *(leave empty)* |

4. Click **Save and Deploy** — your site goes live at `https://market-pulse.pages.dev` (or a custom domain you configure)

---

## Daily Workflow — Deploy New Report

After running `python scripts/process_raw.py` to generate new reports, run these
commands to push changes and trigger an automatic Cloudflare Pages deployment.

### Full deploy (new report day)

```bash
# 1. Stage the new/updated files
git add data/raw/YYYY-MM-DD.json
git add data/reports/YYYY-MM-DD.json
git add data/manifest.json

# 2. Commit with a descriptive message
git commit -m "report: add YYYY-MM-DD market pulse report"

# 3. Push to GitHub — Cloudflare Pages auto-deploys within ~30 seconds
git push
```

Replace `YYYY-MM-DD` with the actual date (e.g. `2026-03-16`).

---

### Today's reports (Mar 15 & 16) — copy-paste ready

```bash
git add data/reports/2026-03-15.json data/reports/2026-03-16.json data/manifest.json data/raw/2026-03-15.json data/raw/2026-03-16.json
git commit -m "report: add 2026-03-15 and 2026-03-16 market pulse reports"
git push
```

---

### Website code changes only

```bash
git add assets/css/styles.css assets/js/app.js assets/js/renderer.js index.html
git add scripts/process_raw.py scripts/watch_raw.py
git commit -m "feat: add Stocks tab, sticky nav, scroll-to-top, Global and India tabs"
git push
```

---

### Stage everything at once (quickest option)

```bash
git add -A
git commit -m "report: YYYY-MM-DD + site improvements"
git push
```

> **Note:** `git add -A` stages all tracked and untracked changes. Safe to use here
> since this repo has no secrets — all files are public research reports and static
> site assets.

---

## Automating daily deploys with watch_raw.py

You can combine report generation and git push into one shell script.
Create `scripts/publish.bat` (Windows) or `scripts/publish.sh`:

### publish.bat (Windows)

```bat
@echo off
cd /d d:\projects\market-pulse
python scripts\process_raw.py
git add data\reports\*.json data\manifest.json data\raw\*.json
git commit -m "report: daily update %date%"
git push
echo Done. Cloudflare Pages will deploy in ~30 seconds.
```

Run it from any terminal:

```
d:\projects\market-pulse\scripts\publish.bat
```

---

## Checking deploy status

After `git push`, go to:
**Cloudflare Dashboard** → **Workers & Pages** → `market-pulse` → **Deployments**

Or use the Cloudflare Pages URL directly — it updates within ~30 seconds of push.

---

## Custom domain (optional)

In Cloudflare Pages → **Custom domains** → add your domain (e.g. `marketpulse.yourdomain.com`).
If your domain DNS is already on Cloudflare, it activates in seconds.
