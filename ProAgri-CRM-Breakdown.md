# ProAgri CRM — Complete Technical Breakdown

> **Audience:** Development team | **Status:** ~50% built | **Updated:** April 3, 2026

---

## 1. What This Is

ProAgri CRM manages the full lifecycle of client work for ProAgri, an agricultural marketing and media company. It tracks clients, booking forms, and deliverables (content calendars, social media posts, magazine articles, videos, web designs) through multi-department approval workflows across seven departments: Admin, Production, Design, Editorial, Video, Agri4All, and Social Media.

The system also includes internal messaging, employee management, financial tracking, dashboards, and a dev tooling suite. An external checklist wizard (separate repo) feeds new client data into the CRM via API.

---

## 2. Tech Stack

- **Frontend:** Vanilla HTML/CSS/JS — no framework, no bundler, no build step
- **Backend:** Express.js 5.1.0 on Node.js 20
- **Database:** PostgreSQL via `pg` driver
- **Auth:** JWT (jsonwebtoken, 8-hour expiry) + bcrypt (salt rounds: 10)
- **File uploads:** Multer (photos: `uploads/photos/`, attachments: `uploads/attachments/`)
- **CORS:** cors middleware
- **Container:** Docker (Node 20-alpine, with python3/make/g++ for native deps)
- **Deployment:** Coolify (Docker PaaS), auto-deploy on push
- **Integrations:** n8n (workflow automation), OpenAI API

---

## 3. Project Structure (Every File)

```
/
├── index.html                          Main SPA shell — sidebar, header, content area, all <script> and <link> tags
├── login.html                          Standalone login form → POST /api/auth/login
├── signup.html                         Standalone signup form → POST /api/auth/signup
├── forgot-password.html                Two-step password reset (verify username → answer security question)
├── checklist.json                      Full client onboarding data structure (company info, social media plans, monthly breakdowns)
├── Dockerfile                          Node 20-alpine, installs python3/make/g++, npm ci --production, EXPOSE 3001
├── .gitignore                          Ignores: node_modules, .env*, *.log, worktrees, uploads/*, .DS_Store, *.png
├── CLAUDE.md                           Development guidelines and architecture docs
│
├── api/
│   ├── server.js                       Express app: CORS, JSON parsing, static /uploads, 10 route mounts, SPA fallback
│   ├── config.js                       DB pool config (host/port/db/user/pass), JWT_SECRET, AUTH_ENABLED flag, upload paths
│   ├── db.js                           PostgreSQL pool + 16 CREATE TABLE + ALTER TABLE migrations + seed data
│   ├── utils.js                        toCamelCase(row) and toSnakeBody(body) for DB↔API field conversion
│   ├── seed.js                         Creates employees table + seeds admin user (admin/Admin123!)
│   ├── start.js                        Runs migration files in order with delays, then starts server
│   ├── middleware/
│   │   └── auth.js                     requireAuth (JWT verify; bypasses when AUTH_ENABLED=false with mock admin)
│   │                                   requireAdmin (checks role === 'admin', returns 403 otherwise)
│   ├── routes/
│   │   ├── auth.js                     POST /signup (pending status), /login (JWT), /forgot/verify-username, /forgot/reset
│   │   ├── employees.js                GET /me, /, /pending; PATCH /:id/status, /:id/role; POST /:id/photo (multer)
│   │   ├── messaging.js                1004 lines: channels, messages, stars, pins, folders, notifications, search, DMs
│   │   ├── clients.js                  CRUD with JSONB contact fields; soft-delete via status='archived'
│   │   ├── booking-forms.js            CRUD + upsert by checklist_id; send-to-editor, send-to-esign, sign endpoints
│   │   ├── deliverables.js             CRUD + bulk create; DEPT_MAPS routing; month filtering; 16 default types
│   │   ├── dashboards.js               CRUD with JSONB config; by-type and by-deliverable queries
│   │   ├── financials.js               CRUD; currency default ZAR; by-client queries
│   │   ├── departments.js              GET / (list all), GET /:slug
│   │   └── dev.js                      GET /tables, /tables/:name/columns, /tables/:name/rows (no auth required)
│   └── migrations/
│       ├── 001_messaging.js            channels, channel_members, messages, message_mentions, message_attachments,
│       │                               message_stars, notifications + 16 indexes + seed channels/messages
│       ├── 002_custom_folders.js        message_folders, message_folder_items + indexes
│       ├── 003_clients_departments.js   departments, clients, booking_forms, deliverables, dashboards, financials
│       │                               + 8 indexes + seed 6 departments
│       ├── 004_drop_dept_views.js       DROP department_views; ALTER dashboards nullables; seed Content Calendar dashboard
│       ├── 005_own_social_media.js      Seed "Own Social Media-Posts" dashboard
│       ├── 006_booking_dept.js          ALTER booking_forms ADD department (default 'admin-proposals')
│       ├── 007_dept_assigned.js         ALTER deliverables ADD 7 assigned_* columns (one per department)
│       ├── 008_esign_urls.js            ALTER booking_forms ADD editable_url, esign_url, checklist_url, signed_pdf,
│       │                               signature_data (JSONB), signed_at, change_request_pdf, change_notes
│       └── 009_delivery_month.js        ALTER deliverables ADD delivery_month, client_id + indexes
│
├── templates/
│   └── pages/
│       └── decline-modal.html          Modal overlay: textarea for decline reason + Cancel/Decline buttons
│
├── ui/
│   ├── css/
│   │   ├── styles.css                  1151 lines: CSS variables, layout, sidebar, nav, cards, dept dashboard,
│   │   │                               dept sheets, month selector, animations, 8-tier responsive breakpoints
│   │   ├── proagri-sheet.css           Sheet/table component: headers, cells, sort indicators, cell editors,
│   │   │                               status badges, person avatars, multiselect tags, date pickers
│   │   └── radial-menu.css             Stacked context menu: animation, positioning, highlight actions
│   └── js/
│       ├── authGuard.js                732 bytes: window.API_URL='/api', getAuthHeaders(), getCurrentUser()
│       │                               (parses JWT payload; falls back to {id:1, username:'admin', role:'admin'})
│       ├── app.js                      1328 lines: SPA router, pageRenderers, dept config, sidebar collapse,
│       │                               user dropdown, avatar upload, dev mode detection, localStorage state
│       ├── template-loader.js          IIFE with cache: loadTemplate(path), insertTemplate(container, path, initFn),
│       │                               clearTemplateCache()
│       ├── data-binder.js              bindData(container, data) — [data-bind="key"] → textContent
│       │                               bindAttr(container, data) — [data-bind-attr="src:key,alt:key"] → setAttribute
│       │                               bindList(target, templateId, items, bindFn) — clone <template> per item
│       ├── proagri-sheet.js            39505 bytes: renderSheet(container, config) — interactive data table
│       │                               Cell types: text, status, multiselect, date, link, person, number, checkbox
│       │                               Cell editors: text input, status dropdown, multiselect checkboxes,
│       │                               calendar date picker, person search/selector
│       │                               Features: sort (type-aware), search (debounced 200ms), employee cache (5min TTL),
│       │                               radial menu integration, viewport-clamped editor positioning
│       ├── radial-menu.js              5229 bytes: RadialMenu constructor, attachToRow(), open(), close(),
│       │                               staggered animation (40ms per item), Escape/click-outside to close
│       └── deliverable-workflows.js    11402 bytes: CHAINS, CHAIN_ALIASES, DEPT_MAPS, BRANCH_STATUSES objects
│                                       Helpers: getChain(), getDeptMap(), getBranches(), getNextStatus(),
│                                       getDepartmentForStatus(), getInitialStatus()
│
├── auth/
│   ├── css/auth.css                    Login/signup/forgot page styles
│   └── js/auth.js                      189 lines: login form → POST /login → store JWT → redirect;
│                                       signup form → POST /signup; forgot → 2-step (verify username → reset password)
│
├── pages/
│   ├── employees/
│   │   ├── employees.css               Employee card grid, photo overlay, role/status badges, filter buttons
│   │   └── employees.js                229 lines: createEmployeeCard() — photo upload (own card), approve/decline
│   │                                   (pending), role toggle (admin); initEmployeePage() — grid render, filter
│   ├── messaging/
│   │   ├── messaging.css               Two-pane layout (conversation list + chat view), mobile responsive
│   │   ├── messaging.js                1749 lines: renderMessagingSection() — full messaging UI
│   │   │                               Features: channel list with unread badges, DM creation, message sending,
│   │   │                               3-second polling, search (150ms debounce), mobile back button,
│   │   │                               conversation filters (all/channels/dms/clients), relative timestamps
│   │   └── emojiIconPicker.js          299 lines: 5 emoji categories (Smileys, Nature/Agriculture, Food, Objects,
│   │                                   Symbols), 25+ SVG icons (chat, group, star, folder, leaf, sun, tractor, wheat),
│   │                                   buildPicker(onSelect) with tabs + search
│   ├── client-list/
│   │   ├── client-list.css             Client list specific styles
│   │   └── client-list.js              59 lines: COLUMNS (name, contact_person, email, phone, status),
│   │                                   ACTIONS array, initClientListPage() → renderSheet(searchable: true)
│   ├── admin/
│   │   └── proposal-page.js            Admin proposals: renders ProAgri sheets for proposal pipeline,
│   │                                   booking forms, onboarding, and declined proposals
│   ├── production/
│   │   ├── production-page.css         Production department styles
│   │   └── production-page.js          Production dept: client communications, follow-ups, approvals views
│   ├── content-calendar/
│   │   └── content-calendar-page.js    Content calendar dashboard with month navigation
│   ├── dashboards/
│   │   └── dashboards-page.js          88 lines: dashboard cards list/detail toggle;
│   │                                   routes content-calendar/agri4all types to specialized views
│   ├── styles/
│   │   └── styles-page.js              Dev tool: CSS variable editor, font/color customization,
│   │                                   saves overrides to localStorage('proagri-style-overrides')
│   ├── components/
│   │   └── components-page.js          44 lines: Dev tool: avatar SVG generator, component demos
│   └── database/
│       └── database-page.js            Dev tool: table browser → GET /api/dev/tables, columns, rows
│
├── dev/
│   └── css/dev.css                     Dev page shared styles
│
└── docs/
    ├── deliverable-workflows/
    │   └── content-calendar.md         Mermaid stateDiagram + department routing table + detailed flow description
    ├── agent-teams-reference.md        Claude Code agent teams reference guide
    ├── proagri-workflow.html           Workflow visualization (HTML)
    ├── proagri-workflow.mmd            Workflow Mermaid source
    └── proagri-workflow.svg            Workflow diagram (SVG)
```

---

## 4. index.html — The SPA Shell

### Script Load Order

```html
1. ui/js/template-loader.js          ← Template cache + fetch
2. ui/js/data-binder.js              ← bindData/bindList/bindAttr
3. ui/js/authGuard.js                ← window.API_URL, getAuthHeaders(), getCurrentUser()
4. pages/employees/employees.js
5. pages/messaging/emojiIconPicker.js
6. pages/messaging/messaging.js
7. pages/styles/styles-page.js
8. pages/components/components-page.js
9. pages/database/database-page.js
10. pages/dashboards/dashboards-page.js
11. pages/content-calendar/content-calendar-page.js
12. ui/js/deliverable-workflows.js
13. pages/admin/proposal-page.js
14. pages/production/production-page.js
15. ui/js/radial-menu.js
16. ui/js/proagri-sheet.js
17. pages/client-list/client-list.js
18. ui/js/app.js                      ← MUST be last (orchestrates everything)
```

### Sidebar Nav Structure

```
Main (collapsible group)
├── My View          data-page="my-view"
├── Messaging        data-page="messaging"
├── Employees        data-page="employees"
├── Client List      data-page="client-list"
├── Content Calendar data-page="content-calendar"

Departments (collapsible group)
├── Admin            data-page="admin"
├── Production       data-page="production"
├── Design           data-page="design"
├── Editorial        data-page="editorial"
├── Video            data-page="video"
├── Agri4All         data-page="agri4all"
├── Social Media     data-page="social-media"

Dev Tools (collapsible group, visible only on localhost)
├── Styles           data-page="styles"
├── Components       data-page="components"
├── Database         data-page="database"
├── Dashboards       data-page="dashboards"
```

### Header

Top bar with "Agri360" logo (Orbitron font, gradient on "360") on the left and user avatar button on the right. Clicking the avatar opens a dropdown showing: photo (with upload overlay), name, username, role badge, and sign-out button.

---

## 5. Frontend Architecture

### Two Page Patterns

**Legacy (most pages):** Modules create DOM via `document.createElement()` and expose `window.renderXxxPage(container)`. Examples: employees, messaging, styles, components, database.

**Template (newer pages):** HTML fetched via template-loader, then an init function populates data. Examples: client-list, admin proposal tabs.

```js
// Legacy:  'employees': function() { window.renderEmployeeSection(dashboardContent); }
// Template: 'client-list': function() { insertTemplate(dashboardContent, 'pages/client-list.html', window.initClientListPage); }
```

All new pages should use the template pattern.

### Page Transitions

`app.js` applies CSS animations when switching pages: `pageExit` (0.2s fade-down) then `pageEnter` (0.25s fade-up). Respects `prefers-reduced-motion`.

### Department Sub-Menu System

Clicking a department replaces the main sidebar with department-specific tabs via a sliding transition. Department config in `app.js`:

- **deptPages**: slug → array of page slugs
- **deptNames**: slug → display name
- **deptMenuItems**: slug → array of `{label, icon, page}` objects

Admin department tabs: Proposal, Booking Form, Onboarding, Declined Proposal.
Production department tabs: Client Communications, Follow Ups, Approvals.
Other departments: configured but UIs not yet built.

### Month Navigation

Department pages with deliverable data show a month selector: `◀ [Month YYYY] ▶`. Navigating months sends `?month=YYYY-MM` to the API. Persisted in component state.

### State in localStorage

| Key | Purpose |
|-----|---------|
| `token` | JWT auth token |
| `proagri-active-page` | Last active page slug |
| `proagri-nav-groups` | Which nav groups are collapsed |
| `proagri-style-overrides` | Custom theme/font/color overrides |

---

## 6. CSS Architecture

### CSS Variables (`:root`)

```css
--color-primary: #dce1e8        /* Background */
--color-secondary: #ffffff       /* Card/surface */
--color-accent-light: #f5a623   /* Orange accent */
--color-accent-dark: #d4791a    /* Dark orange */
--accent-gradient: linear-gradient(to top, accent-light, accent-dark)
--font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif
--font-size-heading: 32px
--font-size-subtitle: 20px
--font-size-body: 14px
--font-size-small: 12px
--text-primary: #1a1a1a
--text-secondary: #444444
--text-muted: #666666
--sidebar-width: 260px
--sidebar-collapsed: 60px
--sidebar-transition: 0.25s ease
```

### Responsive Breakpoints (8 tiers)

| Tier | Width | Key Changes |
|------|-------|-------------|
| 1 | Default | Full sidebar (260px) |
| 2 | ≤1440px | Sidebar 250px |
| 3 | ≤1280px | Sidebar 240px, reduced card padding |
| 4 | ≤1024px | Sidebar 220px, smaller logo |
| 5 | ≤900px | Sidebar 200px |
| 6 | ≤768px | Sidebar collapses to icon-only (60px), nav labels hidden, department grid stacks |
| 7 | ≤480px | Sidebar 50px, header 40px |
| 8 | ≤360px | Sidebar 44px, minimal padding |

### Animations

- `slideUpFadeIn` — header (0.4s), sidebar (0.5s), card (0.5s delay 0.1s) on page load
- `pageExit` — 0.2s fade down when switching pages
- `pageEnter` — 0.25s fade up for incoming page
- Radial menu items: staggered 40ms delay per action button

---

## 7. Database Schema (All 16 Tables)

### employees
id SERIAL PK, first_name, last_name, username (UNIQUE), email, phone, role VARCHAR, status VARCHAR, password_hash, photo_url, security_question, security_answer_hash, created_at, updated_at.

Seed: admin user (id=1, username='admin', password='Admin123!', role='admin', status='active', security_question='What is the company name?', security_answer='agri360').

### channels
id SERIAL PK, name, description, emoji, icon, type VARCHAR (default 'channel'), parent_id INT FK→channels, created_by INT FK→employees, is_archived BOOLEAN (default false), created_at, updated_at.

Seed: General, Crop Planning, Marketing channels with messages.

### channel_members
id SERIAL PK, channel_id FK CASCADE, employee_id FK CASCADE, role VARCHAR (default 'member'), last_read_at TIMESTAMP, joined_at TIMESTAMP. UNIQUE(channel_id, employee_id).

### messages
id SERIAL PK, channel_id FK CASCADE, sender_id FK→employees, content TEXT, parent_message_id FK→messages SET NULL, status VARCHAR (default 'sent'), is_pinned BOOLEAN (default false), is_deleted BOOLEAN (default false), created_at, updated_at.

### message_mentions
id SERIAL PK, message_id FK CASCADE, employee_id FK CASCADE, is_read BOOLEAN (default false), created_at. UNIQUE(message_id, employee_id).

### message_attachments
id SERIAL PK, message_id FK CASCADE, filename, original_name, file_size INT, mime_type, created_at.

### message_stars
id SERIAL PK, message_id FK CASCADE, employee_id FK CASCADE, created_at. UNIQUE(message_id, employee_id).

### message_folders
id SERIAL PK, employee_id FK CASCADE, name, emoji, icon, sort_order INT, created_at.

### message_folder_items
id SERIAL PK, folder_id FK CASCADE, channel_id FK, message_id FK, added_at.

### notifications
id SERIAL PK, employee_id FK CASCADE, type, reference_type, reference_id INT, content TEXT, is_read BOOLEAN (default false), created_at.

### clients
id SERIAL PK, name, trading_name, company_reg_no, vat_number, website, industry_expertise, contact_person, email, phone, physical_address TEXT, physical_postal_code, postal_address TEXT, postal_code, primary_contact JSONB, material_contact JSONB, accounts_contact JSONB, address TEXT (legacy), notes TEXT, status VARCHAR (default 'active'), created_by FK→employees, created_at, updated_at.

JSONB contact structure: `{name, email, phone}`.

### booking_forms
id SERIAL PK, client_id FK CASCADE, checklist_id VARCHAR UNIQUE, title, description TEXT, status VARCHAR (default 'draft'), department VARCHAR (default 'admin-proposals'), booked_date DATE, due_date DATE, campaign_month_start VARCHAR, campaign_month_end VARCHAR, form_data JSONB, assigned_admin FK→employees, representative VARCHAR, decline_reason TEXT, editable_url, esign_url, checklist_url, signed_pdf, signature_data JSONB, signed_at TIMESTAMPTZ, sign_off_date DATE, change_request_pdf, change_notes TEXT, created_by FK→employees, created_at, updated_at.

Upsert key: `checklist_id` = hash of clientName + campaignStart + campaignEnd.

### departments
id SERIAL PK, name VARCHAR UNIQUE, slug VARCHAR UNIQUE, description TEXT, icon, color, display_order INT, is_active BOOLEAN, created_at, updated_at.

Seed (7): Admin, Production, Design, Editorial, Video, Agri4All, Social Media.

### deliverables
id SERIAL PK, booking_form_id FK CASCADE, client_id FK→clients, department_id FK→departments, type VARCHAR, title, description TEXT, status VARCHAR (default 'pending'), delivery_month VARCHAR(7), assigned_to FK→employees, assigned_admin FK, assigned_production FK, assigned_design FK, assigned_editorial FK, assigned_video FK, assigned_agri4all FK, assigned_social_media FK (all FK→employees), due_date DATE, follow_up_count INT, status_changed_at TIMESTAMP, created_at, updated_at.

### dashboards
id SERIAL PK, title, deliverable_id INT FK (nullable), department_id INT FK (nullable), deliverable_type VARCHAR, config JSONB (default '{}'), status VARCHAR (default 'active'), created_at, updated_at.

Seed (3): Content Calendar, Own Social Media-Posts, Agri4All-Posts.

### financials
id SERIAL PK, client_id FK CASCADE, type VARCHAR, description TEXT, amount DECIMAL(12,2), currency VARCHAR (default 'ZAR'), invoice_number, invoice_date DATE, due_date DATE, status VARCHAR (default 'pending'), created_by FK→employees, created_at, updated_at.

---

## 8. API Reference (Every Endpoint)

Base URL: `/api`. Auth: `Authorization: Bearer <JWT>`. Responses: JSON with camelCase fields.

### Auth (no auth required)

| Method | Path | Body | Returns | Notes |
|--------|------|------|---------|-------|
| POST | /auth/signup | firstName, lastName, username, password, securityQuestion, securityAnswer | {employee} | Status set to 'pending'. 409 if username exists |
| POST | /auth/login | username, password | {token, user} | JWT 8-hour expiry. 403 if not approved. 401 if bad creds |
| POST | /auth/forgot/verify-username | username | {securityQuestion} | 404 if not found |
| POST | /auth/forgot/reset | username, securityAnswer, newPassword | {message} | Answer compared lowercase. 401 if wrong |

### Employees (auth required)

| Method | Path | Body | Returns | Notes |
|--------|------|------|---------|-------|
| GET | /employees/me | — | {employee} | Current user from JWT |
| GET | /employees | — | [{employee}] | Admins see all. Others see only approved |
| GET | /employees/pending | — | [{employee}] | Admin only. Pending employees |
| GET | /employees/:id | — | {employee} | SAFE_COLUMNS only (no password/security) |
| PATCH | /employees/:id/status | {status} | {employee} | Admin only. 'approved' or 'declined' |
| PATCH | /employees/:id/role | {role} | {employee} | Admin only. 'admin' or 'employee' |
| POST | /employees/:id/photo | FormData (file) | {employee} | Multer. Stored as {id}-{timestamp}{ext} |

### Messaging (auth required)

**Channels:**

| Method | Path | Body | Returns | Notes |
|--------|------|------|---------|-------|
| POST | /messaging/channels | name, description?, emoji?, icon?, type?, parentId?, memberIds[] | {channel} | Creator = owner. Adds members in transaction |
| GET | /messaging/channels | — | [{channel}] | User's channels + unread counts + latest message + DM partner info |
| GET | /messaging/channels/:id | — | {channel} | requireChannelMember. Includes member_count, created_by_info |
| PATCH | /messaging/channels/:id | name?, emoji?, icon?, description? | {channel} | Owner/admin only |
| POST | /messaging/channels/:id/archive | — | {channel} | Owner/admin only. Sets is_archived=true |
| POST | /messaging/channels/:id/members | memberIds[] | {members} | Owner/admin only |
| POST | /messaging/channels/:id/invite | employeeId | {channel} | Converts DM to group with combined names |
| DELETE | /messaging/channels/:id/members/:eid | — | {success} | Owner/admin only. Cannot remove owner |
| GET | /messaging/channels/:id/members | — | [{member}] | Owner first, then alphabetical |

**Messages:**

| Method | Path | Body | Returns | Notes |
|--------|------|------|---------|-------|
| GET | /messaging/channels/:id/messages | ?limit=50&before=&after= | [{message}] | Max 200. Cursor pagination. Updates last_read_at |
| POST | /messaging/channels/:id/messages | content, mentions[]?, parentMessageId? | {message} | Parses @username mentions. Creates notifications |
| PATCH | /messaging/messages/:id | content | {message} | Sender only |
| DELETE | /messaging/messages/:id | — | {success} | Soft delete. Sender/owner/admin |
| POST | /messaging/messages/:id/star | — | {starred} | Toggle. Membership required |
| POST | /messaging/messages/:id/pin | — | {pinned} | Toggle. Owner/admin only |
| POST | /messaging/messages/:id/attachments | FormData (file) | {attachment} | 10MB limit. Stored as {timestamp}-{random}{ext} |

**Folders, Notifications, Search:**

| Method | Path | Returns | Notes |
|--------|------|---------|-------|
| GET | /messaging/folders/:folder | [{messages}] | Folders: inbox, starred, sent (limit 100), drafts, archive |
| GET | /messaging/notifications | [{notification}] | Limit 50, newest first |
| POST | /messaging/notifications/read | {success} | Body: {all: true} or {notificationIds: []} |
| GET | /messaging/notifications/count | {count} | Unread count |
| GET | /messaging/unread-counts | [{channelId, count}] | Per-channel unread |
| GET | /messaging/search?q= | {channels, messages, employees} | ILIKE search, limit 20 each |
| GET | /messaging/dm/:employeeId | {channel} | Find or create DM |

### Clients (auth required)

| Method | Path | Body | Returns | Notes |
|--------|------|------|---------|-------|
| GET | /clients | ?search= | [{client}] | Excludes archived. ILIKE name search |
| GET | /clients/:id | — | {client} | All fields including JSONB contacts |
| POST | /clients | name (required), +20 optional fields | {client} | JSONB contacts stored as JSON strings |
| PATCH | /clients/:id | any fields | {client} | Dynamic SET from provided fields |
| DELETE | /clients/:id | — | {success} | Soft delete: status='archived' |

### Booking Forms (auth required)

| Method | Path | Body | Returns | Notes |
|--------|------|------|---------|-------|
| GET | /booking-forms | ?department= | [{form + client_name}] | Optional department filter |
| GET | /booking-forms/by-client/:cid | — | [{form}] | Forms for one client |
| GET | /booking-forms/:id | — | {form + client info} | Joins client_name, client_contact_person |
| POST | /booking-forms | client_id (required), +12 optional | {form} | UPSERT by checklist_id. Auto-generates title from dates |
| PATCH | /booking-forms/:id | any fields | {form} | 17 updatable fields including JSONB form_data |
| DELETE | /booking-forms/:id | — | {success} | Hard delete |
| POST | /booking-forms/:id/send-to-editor | — | {editableUrl} | POSTs to N8N webhook. Updates editable_url |
| POST | /booking-forms/:id/send-to-esign | — | {esignUrl} | POSTs HTML to ESIGN_SERVICE_URL/create |
| POST | /booking-forms/:id/sign | action, signed_pdf?, signature_data?, change_request_pdf?, change_notes? | {form} | action='signed': saves sig, sets status='onboarding'. action='change_request': saves changes |

### Deliverables (auth required)

| Method | Path | Body | Returns | Notes |
|--------|------|------|---------|-------|
| GET | /deliverables/by-booking/:bfId | — | [{deliverable + dept_name}] | |
| GET | /deliverables/by-department/:slug | ?month=YYYY-MM | [{deliverable + booking + client info}] | Defaults to current month |
| GET | /deliverables/:id | — | {deliverable + dept + booking} | |
| POST | /deliverables/bulk | {bookingFormId} | {totalCreated, byType, deliverables} | Creates from form_data services. Transaction-wrapped |
| POST | /deliverables | booking_form_id, department_id, type, title | {deliverable} | |
| PATCH | /deliverables/:id | any of 14 fields | {deliverable} | Auto-routes dept by status via DEPT_MAPS. Auto-sets status_changed_at |
| DELETE | /deliverables/:id | — | {success} | Hard delete |

**Bulk create logic:** Checks form_data for enabled services (socialMediaManagement, ownPageSocialMedia, agri4all, onlineArticles, banners, magazine, video, websiteDesign). For each enabled service, creates deliverables for each active month in the campaign range. Falls back to content calendars if no services enabled.

### Dashboards, Departments, Financials, Dev

**Dashboards:** Standard CRUD + GET /by-type/:type, GET /by-deliverable/:id.
**Departments:** GET / (list), GET /:slug (single).
**Financials:** CRUD by client. Currency default ZAR. GET /by-client/:cid.
**Dev:** GET /tables, GET /tables/:name/columns (data_type, is_nullable, column_default), GET /tables/:name/rows (?limit=50&offset=0, max 200).

---

## 9. Deliverable Types & Workflow Chains

### 16 Default Deliverable Types

| Type Key | Group | Initial Status |
|----------|-------|----------------|
| sm-posts | Social Media | request_client_materials |
| sm-videos | Social Media | request_client_materials |
| sm-google-ads | Social Media | request_client_materials |
| sm-linkedin | Social Media | request_client_materials |
| sm-twitter | Social Media | request_client_materials |
| sm-content-calendar | Social Media | request_focus_points |
| agri4all-posts | Agri4All | request_client_materials |
| agri4all-videos | Agri4All | request_client_materials |
| agri4all-product-uploads | Agri4All | request_client_materials |
| agri4all-newsletters | Agri4All | request_client_materials |
| agri4all-banners | Agri4All | design |
| agri4all-linkedin | Agri4All | request_client_materials |
| online-articles | Other | request_client_materials |
| magazine | Other | request_client_materials |
| video | Other | send_request_form |
| website-design | Other | request_client_materials |

### Status Chains

**sm-content-calendar:**
`request_focus_points → focus_points_requested → focus_points_received → design → design_review → proofread → approved → scheduled → posted`
Branches: design_changes→design, client_changes→design

**sm-posts (also sm-videos, sm-google-ads, sm-linkedin, sm-twitter):**
`request_client_materials → upload_materials → artwork_design → create_captions → editorial_review → ready_for_approval → sent_for_approval → approved → ready_for_scheduling → scheduled`
Branches: design_changes, client_changes

**agri4all-posts (also agri4all-videos, product-uploads, newsletters, linkedin):**
`request_client_materials → waiting_for_materials → materials_received → design → design_review → ready_for_approval → sent_for_approval → approved → create_links → ready_for_scheduling → scheduled → create_stat_sheet → complete`
Branches: design_changes→design

**agri4all-banners:**
`design → design_review → ready_for_scheduling → scheduled → posted → create_stat_sheet`
Branches: design_changes→design

**magazine:**
`request_client_materials → waiting_for_materials → materials_received → editing → design → design_review → editorial_review → ready_for_approval → sent_for_approval → approved`
Branches: design_changes, editorial_changes, client_changes

**online-articles:**
`request_client_materials → waiting_for_materials → materials_received → editing → ready_for_approval → sent_for_approval → approved → translating → ready_to_upload → posted`
Branches: editorial_changes, client_changes

**website-design:**
`request_client_materials → materials_requested → materials_received → sitemap → wireframe → prototype → ready_for_approval → sent_for_approval → approved → development → site_developed → hosting_seo → complete`
Branches: design_changes→prototype

**video:**
`send_request_form → request_form_sent → request_form_received → populating_video_dept → brief_received → assign_and_schedule → production → editing → review → final_delivery`
Branches: changes_requested→editing

### Department Routing (DEPT_MAPS)

Each status in each deliverable type maps to a department. When a deliverable's status changes via PATCH, the backend auto-looks up the responsible department and updates `department_id` accordingly.

Example for sm-content-calendar:
- request_focus_points, focus_points_requested, focus_points_received → **Production**
- design, design_review, design_changes → **Design**
- proofread → **Editorial**
- approved, client_changes, scheduled, posted → **Social Media**

---

## 10. ProAgri Sheet Component (Detail)

`renderSheet(container, config)` — the core reusable table component.

### Config Object

```js
{
  columns: [{name, label, type, options}],  // Column definitions
  data: [{...}],                            // Row data array
  searchable: true,                         // Show search input
  radialActions: [{id, label, action(row), highlight}],  // Context menu
  rowActions: [{...}],                       // Inline buttons
  onCellEdit: function(rowData, colName, newValue) {},   // Edit callback
  apiEndpoint: '/api/...',                   // Optional persistence endpoint
  _sortKey: null,                            // Current sort column
  _sortDir: 'asc',                           // Sort direction
  _searchTerm: ''                            // Active search filter
}
```

### Cell Types & Their Editors

| Type | Renders As | Editor |
|------|-----------|--------|
| text | Plain string | Input field with save/cancel |
| status | Color-coded badge | Dropdown of valid status values with color preview |
| multiselect | Tag badges (overflow: +N) | Checkbox list of available options |
| date | Formatted MM/DD/YYYY | Calendar picker with month nav, today button, clear button |
| link | Clickable anchor | — |
| person | Avatar(s) with name tooltip | Search input + employee list with "Unassign" option |
| number | Right-aligned numeric | — |
| checkbox | SVG checkmark or empty | — |

### Sort Logic (Type-Aware)

Dates → timestamps. Statuses → STATUS_ORDER priority (0-4). Numbers → floats. Persons → first name. Text → case-insensitive alphabetical.

### Employee Cache

`fetchEmployees()` caches all employees for 5 minutes. Used by person cell renderer and person editor.

---

## 11. Messaging System (Detail)

1749-line module. WhatsApp-style two-pane layout.

### Conversation List (Left Pane)

- Loads all user's channels via GET /messaging/channels
- Shows: avatar (emoji/icon/photo), name, timestamp (relative: "2m ago"), message preview, unread badge
- Filter buttons: All, Channels, DMs, Clients
- Search: 150ms debounce, filters by name
- Sorted by latest message timestamp descending
- "New" button menu: New Channel, New Direct Message

### Chat View (Right Pane)

- Header: back button (mobile), channel avatar, name, member count, people toggle
- Messages: scrollable list, each with sender avatar/name, content, timestamp
- Threaded messages: indented under parent
- Input: text area + send button
- People panel (toggle): member list with add button

### Polling

3-second interval fetches new messages for the active channel. Stops when navigating away.

### Mobile

Viewport ≤768px: conversation pane fills screen, chat view replaces it on channel select, back button returns to list.

---

## 12. Authentication Flow

1. User signs up → stored with status='pending'
2. Admin approves via PATCH /employees/:id/status → status='approved'
3. User logs in → POST /auth/login → receives JWT (8-hour expiry)
4. JWT stored in localStorage as `token`
5. All API requests include `Authorization: Bearer <token>`
6. Backend `requireAuth` middleware verifies JWT; when AUTH_ENABLED=false, all requests get mock admin (id=1)
7. Password reset: verify username → get security question → answer question → set new password

---

## 13. External Checklist Integration

Separate repo: `https://github.com/Danieldckh/checklist-Agri360`

**Flow:** Client fills out checklist wizard → submits to POST /api/booking-forms → upserted by `checklist_id` (hash of clientName + campaignStart + campaignEnd) → creates client record if new → booking form created with status='outline_proposal', department='admin-proposals' → Admin reviews in the Proposal pipeline → Approved → bulk deliverables created per enabled service → each deliverable enters its type's workflow chain.

**checklist.json structure:** Company info (name, trading name, reg no, VAT, website, industry, addresses, 3 contact types), social media management breakdown (monthly by platform), "Own Page" content specs (posts/stories/videos per platform), content type details, monthly calendars with platform-specific requirements.

---

## 14. Deployment

| Setting | Value |
|---------|-------|
| Platform | Coolify (Docker PaaS) |
| Image | Node 20-alpine + python3/make/g++ |
| Port | 3001 |
| Build | `npm ci --production` |
| App UUID | tows08oogko8k4wk84g40oo4 |
| Dockerfile | Copies full project, installs API deps only, runs `node api/server.js` |
| SPA fallback | Non-API GET requests serve index.html |
| Static files | `/uploads` directory served at `/uploads` path |

### Environment Variables

DATABASE_URL or individual DB_HOST/DB_PORT/DB_NAME/DB_USER/DB_PASS, JWT_SECRET, AUTH_ENABLED, COOLIFY_API_TOKEN, COOLIFY_BASE_URL, GITHUB_TOKEN, N8N_API_KEY, N8N_BASE_URL, OPENAI_API_KEY.

---

## 15. What's Built vs. What's Left

### Fully Built

- SPA framework (template-loader, data-binder, router, sidebar, page transitions, theme variables)
- Auth system (signup with pending approval, login, JWT, password reset via security question)
- Employee CRUD (cards, photo upload, approve/decline, role toggle)
- Client CRUD (25+ fields including JSONB contacts, soft-delete archive)
- Booking form system (CRUD, upsert by checklist_id, form_data JSONB, e-sign endpoints)
- Deliverable system (CRUD, 16 types, status chains, department auto-routing, bulk create, month filter)
- Messaging (channels, DMs, threads, attachments 10MB, stars, pins, folders, notifications, search, 3s polling)
- Emoji/icon picker (5 categories, 25+ custom SVG icons)
- ProAgri Sheet component (6 cell types, 5 inline editors, type-aware sort, search, radial menu, employee cache)
- Financial records CRUD
- Dashboard CRUD with JSONB config
- Department data model (7 seeded departments)
- Dev tools (database browser, component showcase, theme editor)
- Decline modal template
- Docker deployment
- 9 database migrations
- Content calendar workflow documentation (Mermaid diagrams)

### Partially Built

- Admin department UI: proposal-page.js exists with ProAgri Sheet views for proposal pipeline
- Production department UI: production-page.js exists with basic views
- Content calendar page: JS module exists, interactive calendar in progress
- Dashboards page: list/detail toggle works, routes to calendar for specific types
- E-signature: backend endpoints exist (send-to-esign, sign), no frontend signing UI
- Template system: loader works, but only 1 template file exists (decline-modal.html). Most pages still use legacy DOM pattern

### Not Yet Built

- Design, Editorial, Video, Agri4All, Social Media department page UIs
- Reporting/analytics dashboards (charts, KPIs, summaries)
- Email notifications (n8n configured but triggers not wired)
- Client portal (no external-facing view)
- Real-time updates (no WebSockets; messaging uses 3s polling)
- Audit logging
- Leave management / scheduling
- Time tracking
- Advanced search across entities
- File management beyond attachments/photos
- Mobile-responsive optimization for department views
- Bulk operations on deliverables (beyond bulk create)

---

## 16. Conventions

**HTML templates:** New pages use `data-bind`, `data-bind-attr`, `<template>` elements. Legacy pages use `document.createElement()`.

**JS modules:** IIFEs with `window.xxx` exports. Init functions: `window.initXxxPage(container)` or `window.renderXxxPage(container)`.

**API patterns:** DB snake_case → API camelCase via `toCamelCase()`/`toSnakeBody()`. Dynamic PATCH: SET clauses built from provided fields only. Standard CRUD: GET list / GET :id / POST / PATCH :id / DELETE :id.

**CSS:** All styling via classes. State via `.active`, `.loading`, `.error`, `.collapsed`. Theme via CSS variables. Responsive via media queries.

**Migrations:** Inline in db.js (CREATE TABLE IF NOT EXISTS, ALTER TABLE ADD COLUMN IF NOT EXISTS) + numbered files in api/migrations/ (run via start.js).

**Git:** Worktrees for concurrent sessions. Branch naming: `worktree-{task-name}`.

**Dev mode:** Pages with `data-page` matching styles/components/database/dashboards only shown when hostname is localhost or 127.0.0.1.
