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

## Tech Stack

- **Frontend**: Vanilla HTML/CSS/JavaScript (no framework, no build system)
- **Backend**: Express.js 5.1.0 on Node.js
- **Database**: PostgreSQL (via `pg` driver)
- **Auth**: JWT + bcrypt
- **File uploads**: Multer

---

## Project Structure

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
