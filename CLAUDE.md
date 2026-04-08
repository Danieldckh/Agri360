# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this project is

ProAgri CRM is a multi-department agency management system: clients, booking forms, deliverables, internal messaging, dashboards, financials. It's built as a vanilla SPA on top of an Express + Postgres API, with no build step on either side.

Two sister repositories share this codebase's database and API surface:
- **`Danieldckh/checklist-Agri360`** — standalone booking-form wizard that POSTs to `/api/booking-forms` to upsert a booking form (upsert key: `checklist_id`, a hash of client name + campaign dates).
- **`Danieldckh/Booking-Form-Esign`** — e-sign portal that writes directly to `booking_form_revisions` (append-only paper trail) and reads `booking_form_esign_tokens` from this same Postgres instance.

Any schema change that affects `clients`, `booking_forms`, `booking_form_revisions`, or `booking_form_esign_tokens` is a **coordinated change** — the sister repos may break if you rename columns without telling them.

## Common commands

The project has **no root `package.json`** — all Node dependencies and scripts live in `api/`.

```bash
# Run the API (also serves the static frontend from the repo root)
cd api && npm start                  # → node server.js, listens on :3001

# Seed the database (admin user + base tables)
cd api && npm run seed

# Frontend: there is no build or dev server. The Express server
# serves everything in the repo root as static files. Edit → refresh.
```

There are **no tests and no linter** in this repo. Do not invent `npm test` / `npm run lint` commands.

## Architecture overview

### Backend — `api/`

Express 5 + `pg`. One route file per resource in `api/routes/*.js`, all mounted in `api/server.js`. Each route file follows the same CRUD shape: `GET /`, `GET /:id`, `POST /`, `PATCH /:id`, `DELETE /:id`. Read `api/routes/clients.js` as the canonical template — it's the clearest example of the project's pattern (dynamic PATCH builder, soft-delete via `status = 'archived'`, JSONB field stringification).

**Case conversion is non-negotiable.** The DB is snake_case; the API speaks camelCase. Every response goes through `toCamelCase()` from `api/utils.js`, and every incoming body goes through `toSnakeBody()`. Skipping this breaks the frontend silently.

**Auth is a single global switch.** `api/middleware/auth.js` exports `requireAuth` (JWT verify) and `requireAdmin` (role check). When `AUTH_ENABLED=false` in `.env` (the default), `requireAuth` becomes a no-op that injects a fake admin user — useful for local dev, dangerous in production. Check `api/config.js` for the env surface.

### Database migrations — **two parallel patterns, intentional**

There are **two** migration mechanisms and both are live:

1. **Inline migrations in `api/db.js`** — the `runMigrations()` function runs at process startup and contains every `CREATE TABLE IF NOT EXISTS` and `ALTER TABLE ... ADD COLUMN IF NOT EXISTS` ever written. This is the **canonical schema history** — if a column isn't here, Postgres won't have it in production.
2. **Numbered files in `api/migrations/*.js`** — each exports `async function(pool) { ... }`. These exist as a parallel record but are not currently auto-run by `db.js`. They read more cleanly than the inline form and are sometimes authored alongside the inline version.

When adding a schema change, **always update `api/db.js`** — that's what actually runs on deploy. Adding a matching numbered file is nice-to-have for readability but not sufficient on its own.

### Frontend — `pages/` + `ui/` + `index.html`

`index.html` is the SPA shell. It hard-loads every page's CSS and JS upfront (grep its `<link>` and `<script>` tags to see the registry). There is no router library and no module system — everything is global window-scoped functions.

Each page is a self-contained module under `pages/{name}/` with three files:
- `{name}.css` — styles scoped by class prefix
- `{name}.html` — HTML fragment (sometimes, for newer pages)
- `{name}.js` — exposes `window.renderXxxPage(container)` which `ui/js/app.js` calls when the user navigates

`ui/` holds the shared runtime:
- `ui/js/authGuard.js` — **must load first**. Defines `window.API_URL`, `window.getAuthHeaders()`, `window.getCurrentUser()`. Every other script assumes these exist.
- `ui/js/app.js` — SPA router. The `pageRenderers` object maps nav items to render functions. Adding a new page means adding an entry here plus an `index.html` nav item.
- `ui/js/proagri-sheet.js` — the interactive data-table component (`window.renderSheet(container, config)`) used throughout the app. Config takes `columns`, `data`, `radialActions`, `rowActions`, `apiEndpoint`, `onCellEdit`. Most CRUD UI in this project renders through this.
- `ui/js/deliverable-workflows.js` — frontend-side workflow state machine (`window.DELIVERABLE_WORKFLOWS`). Must stay in sync with `DEPT_MAPS`/`DEPT_MAP_ALIASES` in `api/routes/deliverables.js`.
- `ui/js/template-loader.js` + `ui/js/data-binder.js` — template-fetch + `data-bind` helpers used by some newer pages.

**Two frontend patterns coexist.** Most existing pages build DOM in JS via `document.createElement`. Some newer pages use the `insertTemplate() → bindData() → bindList()` flow with HTML template files under `pages/*/` or `templates/`. Don't try to unify them unless asked — migrating a page is a project, not a cleanup.

### Department routing and deliverable workflows

The app has seven fixed departments — `admin`, `production`, `design`, `editorial`, `video`, `agri4all`, `social-media` — seeded in `api/db.js`. Deliverables flow between them according to status chains. The content calendar is the most elaborate example: `request_materials → materials_requested → materials_received → design → design_review → proofread → approved → scheduled → posted`, with branch statuses (`design_changes`, `client_changes`) that route back to earlier stages.

**These chains exist in two places** and **must not drift**:
- `ui/js/deliverable-workflows.js` (frontend — used to render department tabs and valid transitions)
- `api/routes/deliverables.js` (backend — `DEPT_MAPS` + `DEPT_MAP_ALIASES` control server-side routing)

Adding a new status or changing routing requires editing both and verifying parity before shipping.

## Deployment

- **Platform**: Coolify (Docker). The `Dockerfile` at the repo root uses `node:20-alpine`, installs only `api/` dependencies, and runs `node api/server.js`. Nothing is built — the static frontend is served by Express from the repo root.
- **App UUID**: `tows08oogko8k4wk84g40oo4`. `COOLIFY_API_TOKEN` and `COOLIFY_BASE_URL` live in `.env`.
- **Port**: 3001 (exposed in Dockerfile).
- **Env vars that matter**: `DB_*` (host/port/name/user/password), `JWT_SECRET`, `AUTH_ENABLED`, `PORT`. Defaults in `api/config.js` are dev-safe but not production-safe.
