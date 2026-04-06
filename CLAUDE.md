# ProAgri CRM - Development Guidelines

## Session Isolation (MANDATORY - DO THIS FIRST)

This project supports multiple concurrent Claude Code sessions. To prevent sessions from overwriting each other's work, **every session MUST use a git worktree**.

### Before making ANY file changes:

1. **Call `EnterWorktree`** with a descriptive name based on your task
   - Example names: `fix-login-bug`, `add-employee-search`, `messaging-refactor`
   - If running `/runteam`, the command handles this automatically — do NOT enter a worktree yourself
2. All your edits happen in the isolated worktree — completely separate from other sessions
3. **Commit your work before finishing** with a descriptive commit message
4. **Automatically merge and clean up** when done — do NOT ask the user to merge later. Exit the worktree, checkout master, run `git merge --no-ff <branch>`, then delete the worktree and branch (`git worktree remove` + `git branch -d`)

### Do NOT skip this step. If you edit files without entering a worktree first, you risk overwriting another session's work.

---

## Merging & Cleanup

- `/merge-session <branch-name>` — Merge a session's branch into main
- `/list-sessions` — Show all active worktree sessions
- `/cleanup-sessions` — Remove merged/stale worktrees

---

## Architecture Overview

### HTML-First Frontend (Template-Based)

The frontend uses **HTML templates with CSS styling and minimal JavaScript**:

1. **HTML templates** (`/templates/`) define all page structure and layout
2. **CSS** handles all styling, states, and animations
3. **JavaScript** handles ONLY: data fetching, event binding, and populating templates with data

**Golden rule: Never use `document.createElement()` for page layout. All structure lives in HTML templates.**

### How Pages Work

```
User clicks nav item
  → app.js router calls insertTemplate(container, 'pages/xxx.html', initFn)
  → template-loader.js fetches the HTML file (cached after first load)
  → HTML is inserted into #dashboardContent via innerHTML
  → initXxxPage(container) runs:
      1. Fetches data from API
      2. Uses bindData() / bindList() to populate the template
      3. Attaches event listeners to interactive elements
```

### How Department Pages Work

```
User clicks department (e.g. Admin)
  → app.js shows dept sub-menu sidebar
  → User clicks tab (e.g. Onboarding)
  → showDeptContent() calls insertTemplate(container, 'dept/admin-onboarding.html', initFn)
  → initAdminOnboardingTab(container) runs: fetches data, populates sheets
```

---

## Project Structure

```
/templates/                    HTML page templates (loaded via fetch)
  pages/                       Full page templates (employees, messaging, etc.)
  dept/                        Department tab templates (admin-proposal, etc.)
  partials/                    Reusable fragments (modals, sidebar menus)
  components/                  <template> elements for repeating items (cards, rows)

/api/                          Node.js/Express backend (PostgreSQL)
  routes/                      REST API endpoints
  middleware/                  Auth middleware
  migrations/                  DB migrations
  config.js                    DB credentials, JWT secret

/ui/                           Core UI framework
  css/styles.css               Global styles, sidebar, nav, CSS variables
  css/proagri-sheet.css        Sheet/table component styles
  js/template-loader.js        Fetch + cache + insert HTML templates
  js/data-binder.js            data-bind attribute helpers
  js/app.js                    SPA router, sidebar, dept sub-menus
  js/proagri-sheet.js          Interactive table/sheet component
  js/authGuard.js              JWT auth helpers (getAuthHeaders, getCurrentUser)
  js/deliverable-workflows.js  Workflow state definitions (data only)
  js/radial-menu.js            Context menu component

/auth/                         Login, signup, forgot-password pages
/employees/                    Employee module (CSS + JS)
/messaging/                    Messaging module (CSS + JS)
/clients/                      Client list module (CSS + JS)
/dev/                          Dev tools & department page modules
```

---

## Adding a New Page

1. **Create the HTML template** at `/templates/pages/your-page.html`:
   ```html
   <div class="dev-page">
     <div class="dev-page-header">
       <h2 class="dev-page-title">Page Title</h2>
     </div>
     <div id="content-area">
       <!-- Use data-bind for dynamic text -->
       <span data-bind="count"></span>
     </div>

     <!-- Use <template> for repeating items -->
     <template id="item-tmpl">
       <div class="item-card">
         <h3 data-bind="name"></h3>
         <img data-bind-attr="src:photoUrl">
       </div>
     </template>
   </div>
   ```

2. **Write the init function** in the appropriate JS file:
   ```js
   window.initYourPage = function(container) {
     fetch('/api/your-endpoint', { headers: getAuthHeaders() })
       .then(function(r) { return r.json(); })
       .then(function(data) {
         bindList(container.querySelector('#content-area'), 'item-tmpl', data);
       });
   };
   ```

3. **Register in `app.js`** pageRenderers:
   ```js
   'your-page': function() {
     insertTemplate(dashboardContent, 'pages/your-page.html', window.initYourPage);
   }
   ```

4. **Add nav item** in `index.html` sidebar.

## Adding a Department Tab

1. Create HTML template at `/templates/dept/dept-tabname.html`
2. Write init function: `window.initDeptTabname = function(container) { ... }`
3. Add routing in `showDeptContent()` in `app.js`

---

## Conventions

### HTML Template Rules
- All layout/structure goes in `.html` template files — never create layout in JS
- Use `data-bind="fieldName"` for text content that JS will populate
- Use `data-bind-attr="src:photoUrl,alt:name"` for attribute bindings
- Use `<template id="xxx-tmpl">` for repeating items (lists, grids, table rows)
- Use semantic HTML: `<section>`, `<article>`, `<nav>`, `<header>`
- Use CSS classes for all styling — never set `element.style.xxx` in JS

### JavaScript Rules
- JS does ONLY: fetch data, populate templates, attach event listeners
- No `document.createElement()` for layout elements
- Page init functions follow: `window.initXxxPage = function(container) { ... }`
- Use `window.insertTemplate()` for loading page templates
- Use `window.bindData()` and `window.bindList()` for data population
- State changes use CSS classes (add/remove `.active`, `.loading`, `.error`)

### CSS Rules
- State changes use CSS classes (`.active`, `.loading`, `.error`, `.collapsed`)
- Animations use CSS transitions/keyframes
- Theme variables defined in `:root` in `styles.css`
- Responsive behavior uses CSS media queries

---

## Key Components

### Template Loader (`ui/js/template-loader.js`)
- `loadTemplate(path)` — fetch and cache an HTML template, returns `Promise<string>`
- `insertTemplate(container, path, initFn)` — load + insert + call init function
- `clearTemplateCache()` — clear cache (for dev/debugging)

### Data Binder (`ui/js/data-binder.js`)
- `bindData(container, data)` — fill `[data-bind]` elements with `data[key]`
- `bindAttr(container, data)` — set attributes via `[data-bind-attr="attr:key"]`
- `bindList(target, templateId, items, bindFn)` — clone `<template>` per item

### ProAgri Sheet (`ui/js/proagri-sheet.js`)
- `window.renderSheet(container, config)` — render an interactive data table
- Config: `{ columns, data, searchable, radialActions, rowActions, apiEndpoint, onCellEdit }`
- Supports inline editing, sorting, search, person selectors, date pickers

### Auth (`ui/js/authGuard.js`)
- `window.getAuthHeaders()` — returns `{ Authorization: 'Bearer ...' }`
- `window.getCurrentUser()` — parses JWT payload from localStorage
- `window.API_URL` — `/api`

---

## API Patterns

- Base URL: `/api`
- Auth: JWT Bearer token from `localStorage.getItem('token')`
- All responses: JSON with camelCase field names
- Standard fetch pattern:
  ```js
  fetch('/api/endpoint', { headers: getAuthHeaders() })
    .then(function(r) { return r.json(); })
    .then(function(data) { /* populate template */ });
  ```

### Key Endpoints
- `GET /api/employees` — list employees
- `GET /api/clients` — list clients
- `GET /api/booking-forms?department=xxx` — booking forms filtered by department
- `GET /api/deliverables/by-department/:slug` — deliverables for a department
- `PATCH /api/deliverables/:id` — update deliverable fields
- `GET /api/dashboards` — list dashboards
- `GET /api/messaging/channels` — list chat channels

---

## Tech Stack

- **Frontend**: Vanilla HTML/CSS/JavaScript (no framework, no build system)
- **Backend**: Express.js 5.1.0 on Node.js
- **Database**: PostgreSQL (via `pg` driver)
- **Auth**: JWT + bcrypt
- **File uploads**: Multer

---

## Checklist (Separate Repo)

The **New Client Booking Form Builder** (checklist wizard) lives in a separate repo:
- **Repo**: `https://github.com/Danieldckh/checklist-Agri360`
- **Tech**: Standalone HTML/CSS/JS (no framework, no build step — same as the CRM)
- **Relationship**: The checklist submits to the CRM API to create clients and booking forms
- **CRM API URL**: Hardcoded in `app.js` as `CRM_API` constant — points to the Coolify deployment
- **Upsert logic**: Booking forms are upserted by `checklistId`, which is a hash of `clientName + campaignStart + campaignEnd`. Same client + same campaign date range = update existing, different dates = new booking form.
- **Status**: Checklist submissions create booking forms with status `outline_proposal` (the first stage in the admin proposal pipeline)

---

## Deployment

- **Platform**: Coolify (Docker-based)
- **Branch**: `master`
- **Dockerfile**: Node 20-alpine, `npm ci --production`, serves on port 3001
- Coolify API credentials in `.env` (COOLIFY_API_TOKEN, COOLIFY_BASE_URL)
- App UUID: `tows08oogko8k4wk84g40oo4`


```
/                           Root — static HTML pages served directly
├── index.html              Main SPA shell (sidebar nav + content area)
├── login.html              Login page (standalone, uses auth/js/auth.js)
├── signup.html             Signup page (standalone, uses auth/js/auth.js)
├── forgot-password.html    Password reset (standalone, uses auth/js/auth.js)
│
├── api/                    Backend — Express.js API server
│   ├── server.js           Express app setup, all route mounts
│   ├── config.js           DB credentials, JWT secret, ports, paths
│   ├── db.js               PostgreSQL pool + inline migrations
│   ├── utils.js            Shared helpers: toCamelCase(), toSnakeBody()
│   ├── seed.js             Database seeder (creates employees table + admin user)
│   ├── middleware/
│   │   └── auth.js         requireAuth (JWT verify), requireAdmin middleware
│   ├── routes/
│   │   ├── auth.js         POST /signup, /login, /forgot/*
│   │   ├── employees.js    CRUD + photo upload for employees
│   │   ├── messaging.js    Channels, messages, stars, folders, attachments
│   │   ├── clients.js      CRUD for clients (soft-delete via archive)
│   │   ├── booking-forms.js CRUD for booking forms
│   │   ├── deliverables.js CRUD for deliverables
│   │   ├── dashboards.js   CRUD for dashboards
│   │   ├── financials.js   CRUD for financial records
│   │   ├── departments.js  List/get departments
│   │   └── dev.js          Dev tools: list tables, columns, rows
│   └── migrations/         Numbered SQL migrations (run via db.js)
│
├── ui/                     Core UI framework
│   ├── css/
│   │   ├── styles.css      Global styles, CSS variables, theme (light/dark)
│   │   ├── proagri-sheet.css  Reusable data sheet/table component
│   │   └── radial-menu.css    Right-click radial context menu
│   └── js/
│       ├── authGuard.js    Loaded FIRST — defines window.API_URL, getAuthHeaders(), getCurrentUser()
│       ├── app.js          Main SPA router — sidebar nav, page transitions, department sub-menus
│       ├── proagri-sheet.js  Reusable sheet/table component (window.renderSheet)
│       └── radial-menu.js    Radial context menu component
│
├── auth/                   Authentication UI (login/signup/forgot pages only)
│   ├── css/auth.css        Auth page styles
│   └── js/auth.js          Login, signup, forgot-password form handlers
│
├── employees/              Employee management module
│   ├── css/employees.css   Employee card grid styles
│   └── js/employees.js     Employee cards, admin actions (window.renderEmployeeSection)
│
├── messaging/              Messaging system (WhatsApp-style)
│   ├── css/messaging.css   Messaging layout styles
│   └── js/
│       ├── messaging.js    Full messaging UI (window.renderMessagingSection)
│       └── emojiIconPicker.js  Emoji picker component
│
├── clients/                Client management module
│   ├── css/client-list.css Client list styles
│   └── js/client-list.js   Client list with search + sheet (window.renderClientListPage)
│
├── checklist/              Booking form checklist/wizard
│   ├── css/checklist.css   Checklist styles
│   └── js/checklist.js     Multi-step booking form wizard (window.openChecklistForClient)
│
├── dev/                    Developer tools pages
│   ├── css/dev.css         Dev page styles
│   └── js/
│       ├── styles-page.js  Theme/font/color settings editor (window.renderStylesPage)
│       ├── components-page.js  Component showcase (window.renderComponentsPage)
│       └── database-page.js   Database browser (window.renderDatabasePage)
│
└── docs/                   Design specs and implementation plans (reference only)
```

---

## Architecture & Patterns

### Frontend SPA (no build step)

- **Single page**: `index.html` loads ALL CSS and JS files upfront
- **Script load order matters**: `authGuard.js` must load first (defines globals), `app.js` must load last (orchestrates everything)
- **Page modules**: Each module exposes a `window.renderXxxPage(container)` function that app.js calls
- **Page registry**: New pages are added to the `pageRenderers` object in `app.js` — no need to duplicate animation code
- **Global state**: `window.API_URL`, `window.getAuthHeaders()`, `window.getCurrentUser()` — set by authGuard.js
- **Theme**: CSS variables in `:root` of styles.css, toggled via `[data-theme="dark"]` attribute
- **Persistence**: `localStorage` for theme settings, style overrides, active page, nav group state, department tabs

### Backend API

- **All routes** under `/api/*`, defined in `api/routes/`
- **Case conversion**: DB uses snake_case, API responses use camelCase — handled by `toCamelCase()` / `toSnakeBody()` in `api/utils.js`
- **Auth middleware**: `requireAuth` (JWT verify or bypass when AUTH_ENABLED=false), `requireAdmin` (role check)
- **Standard CRUD pattern**: Each route file follows GET (list) / GET :id / POST / PATCH :id / DELETE :id
- **Dynamic PATCH**: All PATCH routes build SET clauses dynamically from provided fields only

### Department Pages

- Department pages (admin, production, design, editorial, video, agri4all, social-media) use a **sub-menu system** in app.js
- Clicking a department replaces the sidebar nav with department-specific views
- Back button restores the original sidebar
- Department config is in `deptPages`, `deptNames`, `deptMenuItems` objects in app.js

### Content Calendar Workflow

Content calendars follow this status chain:
`request_focus_points → focus_points_requested → focus_points_received → design → design_review → proofread → approved → scheduled → posted`

**Branch statuses**: `design_changes` → design, `client_changes` → design

**Flow**: Production asks client for focus points and images → Design creates designs, captions, post dates → Editorial proofreads (sends back to design if unhappy) → Client approves (may request changes → back to design → editorial → client) → Social Media schedules → Auto-posted via automation.

**Dept routing**: production (focus points) → design (artwork) → editorial (proofread) → social-media (schedule/post)

See full Mermaid diagram: `docs/deliverable-workflows/content-calendar.md`

### Deliverable Workflows

Status chains, department routing maps, and branch statuses are defined in:
- **Frontend**: `ui/js/deliverable-workflows.js` — exposed via `window.DELIVERABLE_WORKFLOWS`
- **Backend**: `api/routes/deliverables.js` — `DEPT_MAPS` and `DEPT_MAP_ALIASES` objects
- **Documentation**: `docs/deliverable-workflows/` — Mermaid diagrams per workflow

---

## Key Conventions

1. **No frameworks** — all DOM manipulation is vanilla `document.createElement()` + event listeners
2. **No build system** — edit files directly, refresh browser to test
3. **CSS variables** — use `var(--name)` for all colors/fonts, defined in `ui/css/styles.css`
4. **Module pattern** — frontend modules use IIFEs `(function() { ... })()` with `window.xxx` exports
5. **API URL** — always reference `window.API_URL` (set by authGuard.js), with fallback `'http://localhost:3001/api'`
6. **Migrations** — inline in `api/db.js` (ALTER TABLE ADD COLUMN IF NOT EXISTS) + numbered files in `api/migrations/`

---

## Adding a New Page

1. Create `your-page/css/your-page.css` and `your-page/js/your-page.js`
2. In your JS file, expose `window.renderYourPage = function(container) { ... }`
3. Add CSS `<link>` and JS `<script>` to `index.html`
4. Add `data-page="your-page"` nav item to the sidebar in `index.html`
5. Register in `pageRenderers` in `ui/js/app.js`: `'your-page': function() { window.renderYourPage(dashboardContent); }`

## Adding a New API Route

1. Create `api/routes/your-route.js` following the CRUD pattern (see any existing route)
2. Use `const { toCamelCase, toSnakeBody } = require('../utils');` for case conversion
3. Add `const yourRoutes = require('./routes/your-route');` in `api/server.js`
4. Mount with `app.use('/api/your-route', yourRoutes);`

---

## Ralph Loop

When running `/ralph-loop`, always set `max_iterations: 10`. Do not use unlimited (0) iterations.
