# BiomassIQ Deployment Guide

Deploy target: **Vercel** (frontend) + **Railway** (backend + Postgres).

## Prerequisites

- GitHub account (both platforms connect via GitHub)
- Vercel account (vercel.com)
- Railway account (railway.app)
- CLIs installed locally:
  - `vercel` — `npm i -g vercel`
  - `railway` — `brew install railway`

## One-time setup

### 1. Push to GitHub

```bash
cd biomass-iq
git init
git add .
git commit -m "Initial BiomassIQ v1.0"
gh repo create biomass-iq --private --source=. --push
```

(If you don't have `gh`, create the repo manually on github.com and `git push`.)

### 2. Deploy the backend + database on Railway

```bash
cd backend
railway login
railway init   # creates a new project, link this backend directory
railway add    # add Postgres plugin
railway up     # deploys from the current directory
```

Railway auto-detects the Dockerfile and deploys. `DATABASE_URL` is injected automatically when you add the Postgres plugin.

Set the CORS origin env var to your Vercel URL (once the frontend is deployed):

```bash
railway variables set BIOMASSIQ_CORS_ORIGINS=https://biomass-iq.vercel.app,http://localhost:3000
```

Note the public backend URL Railway gives you (e.g. `https://biomass-iq-backend.up.railway.app`).

### 3. Deploy the frontend on Vercel

```bash
cd frontend
vercel login
vercel   # first-time interactive setup, pick team + project name
```

Set the API URL env var to point to the Railway backend:

```bash
vercel env add NEXT_PUBLIC_API_URL production
# when prompted, paste: https://biomass-iq-backend.up.railway.app
```

Then deploy to production:

```bash
vercel --prod
```

### 4. Seed the PHYLIS data

The first deploy will create the schema but won't auto-ingest PHYLIS data unless `parsed_samples.json` is in the deployment. Two options:

**Option A — Include scraped data in the repo (simplest)**

The scraped data is at `backend/app/adapters/phylis/raw_data/parsed_samples.json` (~10 MB). Include it in the deployment and the startup script will auto-ingest on first run.

**Option B — Trigger a scrape remotely**

```bash
railway run python -m app.adapters.phylis.scraper
```

This scrapes PHYLIS from the Railway container and saves locally — then the init script ingests it.

## Subsequent deploys

Push to `main` — both Vercel and Railway auto-deploy.

Manual redeploy:

```bash
# Frontend
cd frontend && vercel --prod

# Backend
cd backend && railway up
```

## Local development

```bash
# Terminal 1 — Postgres
brew services start postgresql@16

# Terminal 2 — Backend
cd backend
pip install -r requirements.txt
PYTHONPATH=. uvicorn app.main:app --reload --port 8000

# Terminal 3 — Frontend
cd frontend
npm install
npm run dev
```

## Environment variables

### Backend (Railway)

| Variable | Description |
|----------|-------------|
| `DATABASE_URL` | Auto-injected by Railway Postgres plugin |
| `BIOMASSIQ_CORS_ORIGINS` | Comma-separated allowed origins for CORS |
| `BIOMASSIQ_SKIP_INGEST` | Set to `1` to skip PHYLIS ingestion on startup |
| `PORT` | Auto-injected by Railway |

### Frontend (Vercel)

| Variable | Description |
|----------|-------------|
| `NEXT_PUBLIC_API_URL` | Full URL to the Railway backend (e.g. `https://biomass-iq-backend.up.railway.app`) |

## Attribution & licensing

PHYLIS data is © TNO, used under their terms at https://phyllis.nl. Attribution is preserved in every record and in the UI footer. Users should cite PHYLIS as the primary source in any published work derived from this platform.
