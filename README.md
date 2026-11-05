# dbsql-monitor ✨

> **Author and attribution:** dbsql-monitor was created by **Zac Davies**
> ([zacdav-db/dbsql-monitor](https://github.com/zacdav-db/dbsql-monitor)), and is published here with
> his permission. This copy is based on upstream commit `64df42b`, plus a `catalog.yaml` so it can run
> as a child app inside the App Catalog. Credit for the app belongs to Zac.

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

### As a child of the [App Catalog](https://github.com/The-Real-Jeremy/app-catalog)
```bash
rsync -a --exclude .git --exclude node_modules dbsql-monitor/ <app-catalog>/child_apps/dbsql_monitor/
cd <app-catalog> && npm run deploy      # runs this repo's databricks.yml build (needs uv + bun on that machine)
```
The catalog runs the built `.build/` app under `/apps/dbsql_monitor/` (root mode, because it has a
client-side router), binds the `sql` user-authorization scope from `databricks.yml`, and takes the
card text from `catalog.yaml`. It runs as the signed-in viewer (on-behalf-of); no ids need changing
per workspace, since warehouses and query history are read live.

### Air-gapped / UI only (no CLI, PyPI, npm or internet in the workspace)
The four pins (fastapi, uvicorn,
pydantic-settings, databricks-sdk) are newer than the copies the Apps runtime pre-installs, so their
wheels must come from inside the workspace. On a connected machine, from an App Catalog checkout
with this repo in `child_apps/dbsql_monitor/`:
```bash
scripts/build_airgap_packages.sh dbsql_monitor   # builds .build/ and vendors its linux/py3.11 wheels into the zip
```
That zip (about 11 MB) holds the built app plus its 28 vendored wheels. Then, in the workspace UI:
1. Upload `child-dbsql_monitor.zip` to a UC volume (Catalog Explorer → volume → *Upload to this volume*).
2. Run the catalog's `install_catalog.py` notebook with that zip. It writes the app into
   `<catalog source folder>/child_apps/dbsql_monitor/` and copies the wheels into the catalog's wheelhouse volume.
3. Make sure the catalog app has the `sql` user-authorization scope (add it **before** deploying), then click **Deploy**.

The catalog installs the wheels offline at deploy time (see the catalog's `docs/AIRGAP.md`).
