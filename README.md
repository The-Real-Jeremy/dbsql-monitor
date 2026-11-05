# dbsql-monitor ✨

> **Author and attribution:** dbsql-monitor was created by **Zac Davies**
> ([zacdav-db/dbsql-monitor](https://github.com/zacdav-db/dbsql-monitor)), and is published here with
> his permission. This copy is based on upstream commit `64df42b`, plus a `catalog.yaml` so it can run
> as a child app inside the App Catalog. Credit for the app belongs to Zac.

## Install (browser only: no terminal, no CLI, works air-gapped)

Everything the app needs is in this repo: the built app in `.build/` and its 28 Python wheels in `.build/wheels/` (installed with `--no-index`). It uses the `sql` user-authorization scope, which the notebook adds; each viewer approves it once. Two ways to install it; both use the `DEPLOY` notebook.

### A) Install on its own (a standalone Databricks App)
1. On this GitHub page: **Code → Download ZIP** (`dbsql-monitor-main.zip`). No need to unzip it.
2. In Databricks: **Workspace** → a folder (e.g. your home) → **⋮ → Import** → drop the `.zip` → **Import**.
   Databricks unzips it into `dbsql-monitor-main/`.
3. Open **`dbsql-monitor-main/DEPLOY`**, attach **Serverless**, set **mode = `standalone`** (and `standalone_app_name`
   if you want a different name), then **Run all**.
4. The last cell prints the **app URL**.

### B) Install as a child of the [App Catalog](https://github.com/The-Real-Jeremy/app-catalog)
1. Install the App Catalog first (its README, same four steps), so `app-catalog-main/` is in your workspace.
2. On this GitHub page: **Code → Download ZIP** (`dbsql-monitor-main.zip`).
3. In Databricks: open **the same folder that holds `app-catalog-main/`** → **⋮ → Import** → drop the `.zip`.
   It unzips into `dbsql-monitor-main/` next to the catalog.
4. Open **`dbsql-monitor-main/DEPLOY`**, attach **Serverless**, leave **mode = `child`** (`catalog_folder` is filled in
   for you), then **Run all**. It copies the app into the catalog's `child_apps/dbsql_monitor/`, adds the scopes the app
   needs to the catalog app, and redeploys the catalog. The last cell prints `<catalog URL>/apps/dbsql_monitor/`.

**Budget policies:** child mode never creates an app; it redeploys the existing catalog, so a workspace policy
requirement cannot stop it. For standalone mode in a workspace that requires a budget policy, set the
`budget_policy_id` widget, or create the app in the UI first (pick the policy, add the scopes this app needs), then
Run all.

To update either way: import the new ZIP and run `DEPLOY` again. The previous copy is kept, never deleted.

---

> [!NOTE]  
> This app is vibe-coded and for demonstration purposes.


> A modern full-stack application built with [`apx`](https://github.com/databricks-solutions/apx) 🚀

## 🛠️ Tech Stack

This application leverages a powerful, modern tech stack:

- **Backend** 🐍 Python + [FastAPI](https://fastapi.tiangolo.com/)
- **Frontend** ⚛️ React + [shadcn/ui](https://ui.shadcn.com/)
- **API Client** 🔄 Auto-generated with [orval](https://orval.dev/) from OpenAPI schema

## 🚀 Quick Start

### Development Mode

Start all development servers (backend, frontend, and OpenAPI watcher) in detached mode:

```bash
uv run apx dev start
```

This will start an apx development server, which in it's turn runs backend, frontend and OpenAPI watcher. 
All servers run in the background, with logs kept in-memory of the apx dev server.

### 📊 Monitoring & Logs

```bash
# View all logs
uv run apx dev logs

# Stream logs in real-time
uv run apx dev logs -f

# Check server status
uv run apx dev status

# Stop all servers
uv run apx dev stop
```

## ✅ Code Quality

Run type checking and linting for both TypeScript and Python:

```bash
uv run apx dev check
```

## 📦 Build

Create a production-ready build:

```bash
uv run apx build
```

## 🚢 Deployment

Deploy to Databricks:

```bash
databricks bundle deploy -p <your-profile>
```

---

<p align="center">Built with ❤️ using <a href="https://github.com/databricks-solutions/apx">apx</a></p>

## 🧩 In the App Catalog, and air-gapped

### As a child of the [App Catalog](https://github.com/The-Real-Jeremy/app-catalog) (CLI alternative)
```bash
rsync -a --exclude .git --exclude node_modules dbsql-monitor/ <app-catalog>/child_apps/dbsql_monitor/
cd <app-catalog> && npm run deploy      # runs this repo's databricks.yml build (needs uv + bun on that machine)
```
The catalog runs the built `.build/` app under `/apps/dbsql_monitor/` (root mode, because it has a
client-side router), binds the `sql` user-authorization scope from `databricks.yml`, and takes the
card text from `catalog.yaml`. It runs as the signed-in viewer (on-behalf-of); no ids need changing
per workspace, since warehouses and query history are read live.

### Air-gapped / UI only
See **Install** at the top: the `DEPLOY` notebook does both paths from the browser, and the wheels it
needs are committed in `.build/wheels/`.
