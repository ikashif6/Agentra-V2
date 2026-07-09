# Local development

You can run Agentra on your machine against the **same MongoDB Atlas database** used in production. No data migration is required — both environments read/write the same `agentraa_dev` database.

## Quick start

**Terminal 1 — API (port 5000)**

```bash
npm run dev
```

**Terminal 2 — Frontend (port 3000)**

```bash
npm run dev:client
```

## URLs

| Page | URL |
|------|-----|
| Workspace discovery | http://localhost:3000/auth/login |
| Workspace login (e.g. thebuildclub) | http://thebuildclub.localhost:3000/auth/login |
| API health | http://localhost:5000/api/v1/health |

Modern browsers resolve `*.localhost` to `127.0.0.1` automatically — no hosts file needed.

## Environment files

### Root `.env`

- `MONGODB_URI` — your Atlas connection string (same as Railway).
- `APP_API_URL=http://localhost:5000` — local upload URLs.
- `DISABLE_BACKGROUND_JOBS=true` — **important** when sharing prod DB so local dev does not poll email/store in parallel with Railway.
- `CREDENTIALS_ENCRYPTION_KEY` — must match Railway if you test connected email/store channels.

### `client/.env.local`

```env
NEXT_PUBLIC_API_URL=http://localhost:5000/api/v1
NEXT_PUBLIC_APP_BASE_DOMAIN=agentraa.com
```

If this points at `https://api.agentraa.com`, the UI runs locally but every API call still hits production.

## What is shared vs local

| Shared (same as production) | Local only |
|-----------------------------|------------|
| MongoDB data (tickets, users, messages) | API process on `:5000` |
| Encrypted channel credentials (if same encryption key) | Next.js dev server on `:3000` |
| | `uploads/` folder on your machine |

Uploaded files created in production are served from Railway. Messages that reference `https://api.agentraa.com/api/uploads/...` still load from production. New uploads during local dev go to your local `uploads/` folder.

## Safety when sharing production DB

- Keep `DISABLE_BACKGROUND_JOBS=true` locally.
- Be careful editing/deleting real customer data.
- Prefer creating a separate Atlas database (`agentraa_local`) for risky experiments — copy with `mongodump` / `mongorestore` if needed.

## When you're ready to deploy

```bash
git add ...
git commit -m "..."
git push
```

Railway redeploys from `main` automatically.
