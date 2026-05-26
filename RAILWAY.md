# Deploying swarmboard to Railway

Swarmboard runs as **two Railway services** built from this monorepo:

| Railway service        | Source                  | Port | Notes                                  |
| ---------------------- | ----------------------- | ---- | -------------------------------------- |
| `swarmboard-api`       | `Dockerfile.api`        | 3001 | Express + Socket.io + BullMQ workers   |
| `swarmboard-web`       | `Dockerfile.web`        | 8080 | Vite-built React SPA served by nginx   |

You also need two managed datastores:

- **MongoDB** — Use [MongoDB Atlas](https://www.mongodb.com/atlas) (recommended) or any reachable MongoDB instance.
- **Redis** — Add the official **Redis** plugin in your Railway project.

---

## 1. Prerequisites

1. Push this repository to GitHub.
2. Create a [Railway](https://railway.app) project.
3. Provision a MongoDB cluster (MongoDB Atlas → free tier is fine to start) and create a database user. Whitelist `0.0.0.0/0` (or Railway's egress IPs) for the cluster.
4. Add a **Redis** plugin to your Railway project.

---

## 2. Create the API service

1. In Railway → **+ New → Deploy from GitHub repo** → pick this repo.
2. Name the service `swarmboard-api`.
3. Open **Settings → Build**:
   - Builder: `Dockerfile`
   - Dockerfile path: `Dockerfile.api`
   - Watch paths *(optional but recommended)*: `apps/api/**`, `packages/shared/**`, `Dockerfile.api`, `pnpm-lock.yaml`
   *(or set **Config-as-Code Path** to `railway.api.json` and it will be filled in for you).*
4. Open **Settings → Networking** and click **Generate Domain** so the API gets a public URL like `https://swarmboard-api.up.railway.app`.
5. Open **Variables** and add:

   | Variable               | Value                                                                                       |
   | ---------------------- | ------------------------------------------------------------------------------------------- |
   | `DATABASE_URL`         | Your MongoDB Atlas connection string                                                        |
   | `REDIS_URL`            | `${{Redis.REDIS_URL}}` *(reference to the Redis plugin)*                                    |
   | `BETTER_AUTH_SECRET`   | A 32+ char random string (`openssl rand -hex 32`)                                           |
   | `BETTER_AUTH_URL`      | The API public URL, e.g. `https://swarmboard-api.up.railway.app`                            |
   | `FRONTEND_URL`         | The Web public URL, e.g. `https://swarmboard-web.up.railway.app` *(set this after step 3)*  |
   | `NODE_ENV`             | `production`                                                                                |
   | `OPENAI_API_KEY`       | *(optional — enables activity log summarization)*                                           |

   > `PORT` is injected by Railway automatically — do **not** set it manually.

6. Deploy. Health check `/health` should return `200`.

---

## 3. Create the Web service

1. In Railway → **+ New → Deploy from GitHub repo** → same repo.
2. Name the service `swarmboard-web`.
3. **Settings → Build**:
   - Builder: `Dockerfile`
   - Dockerfile path: `Dockerfile.web`
   - Watch paths: `apps/web/**`, `packages/shared/**`, `Dockerfile.web`, `pnpm-lock.yaml`
   *(or set **Config-as-Code Path** to `railway.web.json`).*
4. **Settings → Networking** → **Generate Domain**.
5. **Variables**:

   | Variable        | Value                                                            |
   | --------------- | ---------------------------------------------------------------- |
   | `VITE_API_URL`  | The API public URL, e.g. `https://swarmboard-api.up.railway.app` |

   > `VITE_*` variables are baked in at build time. If you change `VITE_API_URL` later, redeploy.

6. Deploy. Health check `/healthz` should return `200`.

---

## 4. Wire the two services together

After both services have public URLs:

1. Go back to **swarmboard-api → Variables** and make sure `FRONTEND_URL` is set to the Web service URL exactly (no trailing slash). You can comma-separate multiple origins if you have a custom domain too, e.g.:

   ```
   FRONTEND_URL=https://swarmboard-web.up.railway.app,https://app.example.com
   ```
2. Make sure `BETTER_AUTH_URL` exactly matches the API service URL.
3. Restart the API service if you changed any variables.

---

## 5. Verify

- Visit the Web service URL → you should see the login screen.
- Create an account, then a workspace.
- Open the browser dev tools → Network tab — `/api/...` calls should be `https://<api>.up.railway.app/api/...` and return `200`.
- Drag a task on a board — the move should persist after a refresh, and a second tab should update live (Socket.io).

---

## Cookies & cross-origin auth

Better Auth uses cookies for sessions. When the API and Web run on different domains, the API automatically sets cookies with `sameSite=none; secure=true` when `NODE_ENV=production` (configured in `apps/api/src/lib/auth.ts`). The browser will only accept those cookies over HTTPS — which Railway's generated `*.up.railway.app` domains provide automatically.

If you put both behind one custom domain (e.g. `app.example.com` for the SPA and `api.example.com` for the API), no extra configuration is required — same setup still applies.

---

## Troubleshooting

| Symptom                                              | Likely cause / fix                                                                                                                                                       |
| ---------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Web loads but login fails with CORS error            | `FRONTEND_URL` on the API service does not exactly match the Web service URL. Check protocol, host, and that there is no trailing slash.                                  |
| Login succeeds but session "forgets" on refresh      | Cookies are being blocked. Confirm `NODE_ENV=production` on the API, both services are on HTTPS, and there is no browser extension blocking 3rd-party cookies.            |
| `Cannot connect to Redis` in API logs                | The Redis plugin isn't attached, or `REDIS_URL` doesn't reference it. Use `${{Redis.REDIS_URL}}`.                                                                          |
| MongoDB connection errors                            | The MongoDB Atlas IP allowlist is blocking Railway. Set the allowlist to `0.0.0.0/0` (or restrict to Railway egress IPs).                                                  |
| Web build fails on `tsc` step                        | A type error in the web app. Run `pnpm --filter @swarmboard/web typecheck` locally to see the failure.                                                                    |
| Socket.io shows `Disconnected` even though API is up | `VITE_API_URL` on the web service is empty or wrong. Set it to the API URL and redeploy the web service.                                                                  |

---

## Updating

Railway auto-deploys on every push to your default branch. If you only changed one app, only that service rebuilds (assuming you configured Watch Paths in step 2/3).
