# Deployment — Windows Server (office intranet)

Single-origin setup: one Node process serves the React build **and** the API on
port 5000. Users reach the app at `http://<server>:5000`.

## 1. Install on the server (one time)

- **Node.js LTS** (v20+) — https://nodejs.org
- **MongoDB Community Server** — during install choose **"Run as a Network/Windows Service"** so it auto-starts on boot.
- **NSSM** (to run Node as a service) — https://nssm.cc  → put `nssm.exe` somewhere on PATH.
- **Git** (optional) — to pull the code.

## 2. Get the code

```powershell
# via git
git clone <repo-url> C:\apps\VegamRevenueManagement
# ...or copy the project folder over (exclude node_modules)
```

## 3. Configure

```powershell
cd C:\apps\VegamRevenueManagement\server
copy .env.production.example .env
```
Edit `.env` and set a strong `JWT_SECRET`, the `SEED_ADMIN_*` values, and
`CLIENT_URL` to `http://<server-hostname-or-ip>:5000`.

## 4. Install deps & build

```powershell
cd C:\apps\VegamRevenueManagement
npm run install:all
npm run build          # builds server (tsc) + client (vite → client/dist)
```

## 5. Seed the first admin user

```powershell
npm run seed --workspace=server
```
This creates a `finance_admin` from the `SEED_ADMIN_*` env vars. Log in and
change the password immediately.

## 6. Run as a Windows service (survives reboots/crashes)

```powershell
nssm install VegamRevenue "C:\Program Files\nodejs\node.exe" "dist\index.js"
nssm set VegamRevenue AppDirectory "C:\apps\VegamRevenueManagement\server"
nssm set VegamRevenue AppEnvironmentExtra NODE_ENV=production
nssm start VegamRevenue
```
Logs: `nssm set VegamRevenue AppStdout C:\apps\logs\vegam.out.log` (and `AppStderr`).

## 7. Open the firewall

```powershell
New-NetFirewallRule -DisplayName "Vegam Revenue 5000" -Direction Inbound `
  -Protocol TCP -LocalPort 5000 -Action Allow
```

Users now browse to **`http://<server-hostname>:5000`**.

## Updating to a new version

```powershell
cd C:\apps\VegamRevenueManagement
git pull                      # or copy new files
npm run install:all
npm run build
nssm restart VegamRevenue
```

## Backups

Schedule a daily `mongodump` (Task Scheduler):
```powershell
mongodump --db vegam_revenue --out "C:\backups\vegam\%date%"
```
Also back up `server\uploads\` (uploaded documents) and `server\.env`.

## Notes / later hardening

- **Port 80** (drop `:5000` from the URL): set `PORT=80` in `.env` (and firewall rule to 80). Make sure nothing else uses 80 (e.g. IIS).
- **HTTPS**: front the app with IIS or nginx as a reverse proxy holding an internal certificate; proxy to `localhost:5000`.
