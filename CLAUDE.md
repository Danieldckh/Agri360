# ProAgri CRM - Development Guidelines

## Session Isolation (MANDATORY - DO THIS FIRST)

This project supports multiple concurrent Claude Code sessions. To prevent sessions from overwriting each other's work, **every session MUST use a git worktree**.

### Before making ANY file changes:

1. **Call `EnterWorktree`** with a descriptive name based on your task
   - Example names: `fix-login-bug`, `add-employee-search`, `messaging-refactor`
   - If running `/runteam`, the command handles this automatically — do NOT enter a worktree yourself
2. All your edits happen in the isolated worktree — completely separate from other sessions
3. **Commit your work before finishing** with a descriptive commit message
4. Tell the user the **branch name** so they can merge it later

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

## Deployment

- **Platform**: Coolify (Docker-based)
- **Branch**: `worktree-remove-messaging-folders`
- **Dockerfile**: Node 20-alpine, `npm ci --production`, serves on port 3001
- Coolify API credentials in `.env` (COOLIFY_API_TOKEN, COOLIFY_BASE_URL)
- App UUID: `tows08oogko8k4wk84g40oo4`

---

## Ralph Loop

When running `/ralph-loop`, always set `max_iterations: 10`. Do not use unlimited (0) iterations.
