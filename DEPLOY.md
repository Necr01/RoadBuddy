# RoadBuddy — Deployment Guide (Railway)

This guide deploys the full system — frontend, backend API, and MySQL database —
to Railway as a single project. Free tier is sufficient for a capstone demo.

---

## Prerequisites

- A [Railway account](https://railway.app) (sign up free with GitHub)
- [Git](https://git-scm.com/downloads) installed on your machine
- Your project folder structure complete and working locally

---

## Step 1 — Push your project to GitHub

Open Command Prompt in your `RoadBuddy/` root folder:

```cmd
git init
git add .
git commit -m "Initial commit — RoadBuddy Phase 6"
```

Go to [github.com](https://github.com), create a **new repository** called `RoadBuddy`,
then connect and push:

```cmd
git remote add origin https://github.com/YOUR_USERNAME/RoadBuddy.git
git branch -M main
git push -u origin main
```

---

## Step 2 — Create a Railway project

1. Go to [railway.app](https://railway.app) and log in
2. Click **New Project**
3. Choose **Deploy from GitHub repo**
4. Select your `RoadBuddy` repository
5. Railway will detect Node.js and start building automatically

---

## Step 3 — Add a MySQL database

Inside your Railway project dashboard:

1. Click **+ New** → **Database** → **Add MySQL**
2. Railway creates a MySQL instance and links it to your project
3. Click on the MySQL service → **Variables** tab
4. You will see auto-generated variables:
   `MYSQLHOST`, `MYSQLUSER`, `MYSQLPASSWORD`, `MYSQLDATABASE`, `MYSQLPORT`

---

## Step 4 — Set environment variables

Click on your **Node.js service** (not the MySQL one) → **Variables** tab → **Add Variable**:

| Variable | Value |
|---|---|
| `NODE_ENV` | `production` |
| `JWT_SECRET` | *(run the command below to generate)* |
| `DB_HOST` | *(paste value from `MYSQLHOST`)* |
| `DB_PORT` | *(paste value from `MYSQLPORT`)* |
| `DB_USER` | *(paste value from `MYSQLUSER`)* |
| `DB_PASSWORD` | *(paste value from `MYSQLPASSWORD`)* |
| `DB_NAME` | *(paste value from `MYSQLDATABASE`)* |
| `DB_SSL` | `true` |
| `ALLOWED_ORIGINS` | *(your Railway public URL, added in Step 5)* |

**Generate your JWT_SECRET** — run this in Command Prompt and copy the output:
```cmd
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
```

---

## Step 5 — Get your public URL and set ALLOWED_ORIGINS

1. In Railway, click your Node.js service → **Settings** → **Networking**
2. Click **Generate Domain** → Railway gives you a URL like `roadbuddy-production.up.railway.app`
3. Go back to **Variables** and set:
   ```
   ALLOWED_ORIGINS=https://roadbuddy-production.up.railway.app
   ```
4. Railway will redeploy automatically

---

## Step 6 — Verify deployment

Open your Railway URL in a browser:

```
https://roadbuddy-production.up.railway.app/api/health
```

Should return:
```json
{"status":"ok","version":"1.0.0","phase":6,"env":"production"}
```

Then open the full site:
```
https://roadbuddy-production.up.railway.app
```

Your RoadBuddy landing page should appear. Log in using the seeded demo accounts
(auto-created on first run):

| Role | Email | Password |
|---|---|---|
| Motorist | maria@test.com | password123 |
| Provider | autofix@test.com | password123 |
| Admin | admin@roadbuddy.ph | Admin@1234 |

---

## Step 7 — Update your frontend API URL (if needed)

The `api.js` file auto-detects the correct URL when the frontend is served by
the same backend (same domain). No changes needed in most cases.

If you ever host the frontend separately (e.g., Netlify), add this line to all
HTML files before `<script src="js/api.js">`:

```html
<script>window.RB_API_BASE = 'https://roadbuddy-production.up.railway.app';</script>
```

---

## Troubleshooting

**Build fails on Railway**
Check the build logs in Railway dashboard. Most common cause: missing `package.json`
in the root or `backend/` folder. Make sure both are committed to Git.

**`Cannot connect to MySQL`**
Double-check the `DB_*` variables match exactly what Railway shows in the MySQL
service Variables tab. Make sure `DB_SSL=true` is set.

**`JWT_SECRET` errors**
Make sure the variable is set in Railway and does not have extra spaces or quotes.

**Pages load but login fails**
Open browser DevTools → Console → look for the error. If it says `CORS`, make sure
`ALLOWED_ORIGINS` matches your Railway URL exactly (no trailing slash).

**Reset the database**
Delete all rows via Railway's MySQL console, or add a `?reset=1` query parameter
logic, or simply remove and re-add the MySQL service — Railway will recreate it fresh
and the seed data will be re-inserted on next server start.

---

## Local development (still works unchanged)

```cmd
cd backend
copy .env.example .env
npm install
node server.js
```

Uses SQLite locally (`roadbuddy.db`) and MySQL on Railway — no code changes needed.
