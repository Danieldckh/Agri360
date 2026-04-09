# Research Report: Agri4all Posts Workflow Implementation

Date: 2026-04-09
Researcher: researcher agent (claude-sonnet-4-6)
Purpose: Single source of truth for backend + frontend dev agents building the Agri4all Posts per-post-type upload dashboard, green-checkmark indicator, and social-media tab integration.

---

## 1. Post Types Master List (from checklist JSON)

Source file: `docs/full_checklist_json_example.json`, `"agri4all"` array starting at line 353.

The Agri4all section in the checklist JSON is an **array of month-country objects**, each with a `state` sub-object. The `state` object contains the post-type flags and amounts. The exact keys present in every state object are:

| Checklist key | Enabled flag | Amount key | Curated amount key |
|:---|:---|:---|:---|
| Facebook Posts | `facebook_posts` (bool) | `facebook_posts_amount` (string) | `facebook_posts_curated_amount` (string) |
| Facebook Stories | `facebook_stories` (bool) | `facebook_stories_amount` (string) | — |
| Facebook Video Posts | `facebook_video_posts` (bool) | `facebook_video_posts_amount` (string) | `facebook_video_posts_curated_amount` (string) |
| Facebook Instant Experience | `facebook_instant_experience` (bool) | `facebook_instant_experience_amount` (string) | `facebook_instant_experience_curated_amount` (string) |
| Instagram Posts | `instagram_posts` (bool) | `instagram_posts_amount` (string) | `instagram_posts_curated_amount` (string) |
| Instagram Stories | `instagram_stories` (bool) | `instagram_stories_amount` (string) | — |
| TikTok Shorts | `tiktok_shorts` (bool) | `tiktok_amount` (string) | — |
| YouTube Shorts | `youtube_shorts` (bool) | `youtube_shorts_amount` (string) | — |
| YouTube Video | `youtube_video` (bool) | `youtube_video_amount` (string) | — |
| Product Uploads | `agri4all_product_uploads` (bool) | `agri4all_product_uploads_amount` (string) | — |
| Unlimited Product Uploads | `unlimited_product_uploads` (bool) | — | — |
| LinkedIn Article | `linkedin_article` (bool) | — | — |
| LinkedIn Company Campaign | `linkedin_company_campaign` (bool) | `linkedin_amount` (string) | — |
| Newsletter Feature | `newsletter_feature` (bool) | `newsletter_feature_amount` (string) | — |
| Newsletter Banner | `newsletter_banner` (bool) | `newsletter_banner_amount` (string) | — |

Exact JSON excerpt for one state object (`docs/full_checklist_json_example.json:358-392`):
```json
"state": {
  "facebook_posts": true,
  "facebook_posts_amount": "4",
  "facebook_posts_curated_amount": "3",
  "facebook_stories": true,
  "facebook_stories_amount": "4",
  "facebook_video_posts": true,
  "facebook_video_posts_amount": "5",
  "facebook_video_posts_curated_amount": "3",
  "facebook_instant_experience": false,
  "facebook_instant_experience_amount": "",
  "facebook_instant_experience_curated_amount": "",
  "instagram_posts": true,
  "instagram_posts_amount": "5",
  "instagram_posts_curated_amount": "3",
  "instagram_stories": true,
  "instagram_stories_amount": "5",
  "tiktok_shorts": true,
  "tiktok_amount": "5",
  "youtube_shorts": true,
  "youtube_shorts_amount": "5",
  "youtube_video": true,
  "youtube_video_amount": "4",
  "unlimited_product_uploads": true,
  "unlimited_product_uploads_message": "...",
  "agri4all_product_uploads": true,
  "agri4all_product_uploads_amount": "4",
  "linkedin_article": true,
  "linkedin_company_campaign": true,
  "linkedin_amount": "4",
  "newsletter_feature": true,
  "newsletter_feature_amount": "4",
  "newsletter_banner": false,
  "newsletter_banner_amount": ""
}
```

**Critical note for the new feature:** The feature spec says "Facebook Post, Instagram Post, Instagram Story". The checklist has MORE types than that. The `agri4all-posts` deliverable type (as created by `create-content-calendars` bulk endpoint) stores only **Facebook Posts + Instagram Posts + Instagram Stories** in its metadata — it explicitly excludes videos, TikTok, YouTube from `agri4all-posts` (those go into a separate `agri4all-videos` deliverable). See `api/routes/deliverables.js:688-709` for the exact metadata written at creation time. The feature's post-type multi-select should therefore be drawn from what is stored in `deliverable.metadata`, not the raw checklist. The three types the spec mentions (Facebook Post, Instagram Post, Instagram Story) match exactly what the `agri4all-posts` bulk-create writes.

**`amount` vs `curated_amount` meaning:** The checklist encodes `amount` as the total posts contracted and `curated_amount` as the number of those posts that are "curated" (agency-produced) vs. client-supplied. Both are stored as strings in the JSON (e.g. `"4"`, not `4`). The backend's `maxAmt()` helper in `create-content-calendars` parses them with `parseInt`. The CRM already stores these in `deliverable.metadata.facebook_posts_amount`, `deliverable.metadata.facebook_posts_curated_amount`, etc.

---

## 2. Content-Calendar Workflow Blueprint

### 2a. Backend DEPT_MAPS entry (`api/routes/deliverables.js`)

Lines 191-199 (the canonical backend map for `sm-content-calendar`):
```js
'sm-content-calendar': {
  'request_focus_points': 'production', 'focus_points_requested': 'production', 'focus_points_received': 'production',
  // legacy aliases — post-rollback rows still route until db.js migration runs
  'request_materials': 'production', 'materials_requested': 'production', 'materials_received': 'production',
  'design': 'design', 'design_review': 'design', 'design_changes': 'design',
  'editorial': 'editorial', 'editorial_review': 'editorial',
  'ready_for_approval': 'production', 'sent_for_approval': 'production', 'client_changes': 'production',
  'approved': 'social-media', 'ready_for_scheduling': 'social-media', 'scheduled': 'social-media', 'posted': 'social-media'
},
```

**Already-existing `agri4all-posts` backend DEPT_MAP** (`api/routes/deliverables.js:200-209`):
```js
'agri4all-posts': {
  'request_client_materials': 'production', 'materials_requested': 'production',
  'waiting_for_materials': 'production', // legacy alias
  'materials_received': 'production',
  'design': 'design', 'design_review': 'design', 'design_changes': 'design',
  'ready_for_approval': 'production', 'sent_for_approval': 'production',
  'approved': 'agri4all', 'create_links': 'agri4all',
  'ready_for_scheduling': 'social-media', 'scheduled': 'social-media',
  'create_stat_sheet': 'agri4all', 'complete': 'agri4all'
},
```

**Note:** The existing backend DEPT_MAP already routes `approved` → `agri4all`, NOT `social-media`. The spec says "lands in social-media dept's Agri4all tab". This is a **discrepancy that needs resolution** — see Section 10 (Gotchas).

### 2b. Frontend DELIVERABLE_WORKFLOWS (`ui/js/deliverable-workflows.js`)

Chain for `sm-content-calendar` (lines 17-23):
```js
'sm-content-calendar': [
  'request_focus_points', 'focus_points_requested', 'focus_points_received',
  'design', 'design_review',
  'editorial', 'editorial_review',
  'ready_for_approval', 'sent_for_approval', 'approved',
  'ready_for_scheduling', 'scheduled', 'posted'
],
```

**Already-existing `agri4all-posts` chain** (`ui/js/deliverable-workflows.js:26-31`):
```js
'agri4all-posts': [
  'request_client_materials', 'materials_requested', 'materials_received',
  'design', 'design_review', 'ready_for_approval', 'sent_for_approval',
  'approved', 'create_links', 'ready_for_scheduling', 'scheduled',
  'create_stat_sheet', 'complete'
],
```

This chain does NOT include `focus_points_*` (correct for Agri4all — uses `materials_*` naming). The frontend chain already matches the spec's `request_materials → ... → sent_for_approval → approved` flow. The new feature only needs to add per-post approval UX without changing the chain itself.

**`DEPT_MAPS` for `agri4all-posts`** (`ui/js/deliverable-workflows.js:127-143`):
```js
'agri4all-posts': {
  'request_client_materials': 'production',
  'materials_requested': 'production',
  'waiting_for_materials': 'production',
  'materials_received': 'production',
  'design': 'design',
  'design_review': 'design',
  'design_changes': 'design',
  'ready_for_approval': 'production',
  'sent_for_approval': 'production',
  'approved': 'agri4all',     // routes to agri4all dept, not social-media
  'create_links': 'agri4all',
  'ready_for_scheduling': 'social-media',
  'scheduled': 'social-media',
  'create_stat_sheet': 'agri4all',
  'complete': 'agri4all'
},
```

**CHAIN_ALIASES for `agri4all-posts`** (`ui/js/deliverable-workflows.js:86-92`):
```js
'agri4all-videos': 'agri4all-posts',
'agri4all-product-uploads': 'agri4all-posts',
'agri4all-newsletters': 'agri4all-posts',
'agri4all-newsletter-feature': 'agri4all-posts',
'agri4all-newsletter-banner': 'agri4all-posts',
'agri4all-linkedin': 'agri4all-posts',
```

### 2c. DB migrations (`api/db.js`)

Relevant migrations in `runMigrations()`:

| Line | Statement | Purpose |
|:-----|:----------|:--------|
| 93-98 | `CREATE TABLE IF NOT EXISTS deliverables (...)` | Base deliverables table |
| 287 | `ALTER TABLE deliverables ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}'` | JSONB metadata column |
| 294-298 | Loop adding `assigned_admin`, `assigned_production`, `assigned_design`, `assigned_editorial`, `assigned_video`, `assigned_agri4all`, `assigned_social_media` | Per-dept assignment cols |
| 337-348 | `CREATE TABLE IF NOT EXISTS client_assets (...)` with `kind`, `deliverable_id`, `url`, `mime_type` | Upload tracking table |
| 373-395 | `CREATE TABLE IF NOT EXISTS scheduled_posts (...)` | Scheduler table |
| 432-434 | Seed dashboards including `('Agri4All-Posts', 'agri4all-posts', '{}', 'active')` | Dashboard seed |
| 479-511 | Per-post `status=pending` migration on `sm-content-calendar` metadata.posts[] | CC post status init (template) |

No Agri4all-posts-specific post-level migration exists yet. The per-post status backfill at lines 479-511 is CC-specific (`WHERE type = 'sm-content-calendar'`).

### 2d. Post-level schema for content calendars

Content calendar posts are stored in **`deliverables.metadata` as a JSONB array under key `posts`**. Each post object in the array has the shape (inferred from `openContentCalendarDashboard` and portal.js):

```json
{
  "date": "2026-02-15",
  "caption": "<p>HTML caption via Quill</p>",
  "images": ["/uploads/deliverable-images/deliv-42-...jpg"],
  "status": "pending",
  "change_requests": [
    {
      "id": 1712345678000,
      "text": "Please change the color",
      "images": [],
      "created_at": "2026-04-09T...",
      "created_by": "client"
    }
  ]
}
```

Sources: `pages/production/production-page.js:2483-2491` (CC post shape), `api/routes/portal.js:395-407` (change_request append).

There is no separate `content_calendar_posts` table. Everything is in `deliverables.metadata.posts[]`.

### 2e. Agri4all posts: what's currently stored in metadata

The bulk-create endpoint at `api/routes/deliverables.js:688-708` writes this metadata for `agri4all-posts`:
```json
{
  "countries": ["ALL", "Algeria", ...],
  "facebook_posts": true,
  "facebook_posts_amount": 4,
  "facebook_posts_curated_amount": 3,
  "instagram_posts": true,
  "instagram_posts_amount": 5,
  "instagram_posts_curated_amount": 3,
  "instagram_stories": true,
  "instagram_stories_amount": 5
}
```

There is **no `posts[]` array in `agri4all-posts` metadata today** — that structure exists only for CC. The new feature needs to add a per-post-type upload structure to `metadata`.

---

## 3. Per-Post Approval Pattern (from commit 06f0787)

Commit `06f0787` introduced the following. All citations are from the post-commit file state on disk.

### 3a. Schema addition

`api/db.js:479-511`: Idempotent migration that walks `metadata->'posts'` JSONB arrays for `sm-content-calendar` deliverables and sets `status='pending'` on any post missing it. Uses `jsonb_set` + `jsonb_agg` + `CASE WHEN p ? 'status'` guard. This runs every startup but is a no-op after the first application.

### 3b. Portal approval endpoints

**Approve a single post:** `POST /api/portal/:token/approvals/:deliverableId/posts/:postIdx/approve` (`api/routes/portal.js:281-354`)
- Validates token → client ownership
- Reads `metadata.posts[postIdx]`, sets `status = 'approved'`
- If ALL posts now approved: flips `deliverable.status = 'approved'`
- Best-effort inserts a `scheduled_posts` row: `source_type='content-calendar'`, `scheduled_at = post.date 09:00 UTC`, `status='scheduled'` if dated else `'unscheduled'`, `platforms` derived from `metadata.platforms`

**Request changes on a single post:** `POST /api/portal/:token/approvals/:deliverableId/posts/:postIdx/request-changes` (`api/routes/portal.js:360-425`)
- Same 3-revision cap as deliverable-level (`change_request_count`)
- Appends `{id, text, images, created_at, created_by:'client'}` to `post.change_requests`
- Optionally overwrites `post.caption` if `body.caption` present
- Sets `post.status = 'changes_requested'` AND `deliverable.status = 'design_changes'`

### 3c. Portal UX (`client-portal.html`)

`renderApprovals()` at line 1510 branches on `d.type === 'sm-content-calendar'` → calls `buildCcApprovalCard(d)` (line 1675).

`buildCcApprovalCard()` at line 1675:
- Renders a `.cp-cc-card` div with header (title + "N of 3 change requests remaining")
- Renders a `.cp-cc-grid` of `.cp-cc-post` cards, each with: image thumbnail, caption snippet (truncated to 80 chars), status badge (Pending/Approved/Changes Requested)
- Click on any post card → `openCcModal(state, idx)` (line 1736): full image + editable caption textarea + change-request textarea + "Approve Post" / "Request Changes (N of 3)" buttons

The CSS classes used: `.cp-cc-card`, `.cp-cc-header`, `.cp-cc-revisions`, `.cp-cc-grid`, `.cp-cc-post`, `.cp-cc-post-img`, `.cp-cc-post-caption`, `.cp-cc-post-status`, `.cp-cc-modal-overlay`, `.cp-cc-modal-panel`, `.cp-cc-modal-body`, `.cp-cc-modal-media`, `.cp-cc-modal-form`, `.cp-cc-approve-btn`, `.cp-cc-request-btn`.

All scoped to `client-portal.html` CSS block at lines 762-1005.

---

## 4. Eye-Icon Dashboard Fade-Out Mechanism

There is **no CSS fade on the left nav** when opening a dashboard. The mechanism is a JavaScript **sidebar replacement**: the existing nav DOM nodes are moved into a DocumentFragment (`_savedProdSidebar`), and new dashboard-specific nodes (Back button + deliverable metadata) are inserted in their place. Restoring happens by moving the fragment back.

### The pattern

**Entry point** (`pages/production/production-page.js:3334-3362` — `setupCCSidebar`, for CC dashboards):
1. `_savedProdSidebar = document.createDocumentFragment()` — save current nav
2. `while (nav.firstChild) _savedProdSidebar.appendChild(nav.firstChild)` — drain nav into fragment
3. Inject: Back button, separator, client name, month, status badge, details

**Generic version** (`pages/production/production-page.js:3609-3658` — `setupDashboardSidebar`, used by all non-CC dashboards):
- Same fragment swap. Takes a `buildContent(nav)` callback to inject type-specific sidebar fields.

**Restore on Back click** (`pages/production/production-page.js:3354-3361`):
```js
backItem.addEventListener('click', function () {
  stopCCChatPoll();
  nav.style.overflowY = '';
  while (nav.firstChild) nav.removeChild(nav.firstChild);
  nav.appendChild(_savedProdSidebar);
  _savedProdSidebar = null;
  if (_ccContainer) renderProductionDeliverablesTab(_ccContainer);
});
```

**Eye icon dispatch** (`pages/production/production-page.js:858-879`):
The `colEye()` function defines a column that renders an eye-icon button. The `dashboardTypes` list at line 846 shows which types get the eye button. `agri4all-posts` is already in that list. Click handler calls:
- `agri4all-posts` → `openA4AMultiSectionDashboard(c, it, 'posts')` (line 865)

`openA4AMultiSectionDashboard` is at `pages/production/production-page.js:4306`. It clears the container and builds the existing multi-section upload dashboard (one block per post type from `sectionConfig`). This is the **existing** dashboard for `agri4all-posts` — the new feature needs to either modify or replace it with a per-post upload UI.

**The same pattern is reused in `renderDeptTypeTab` rows** (`pages/production/production-page.js:1247+`): the generic dept tab table also renders an eye icon per row using the same `colEye(tabContainer)` helper.

---

## 5. Agri4all Department Current State

### 5a. File system

`pages/agri4all/` — **does not exist**. Confirmed: `ls pages/` shows no `agri4all/` directory.

### 5b. Nav registration

`index.html:128-130`: Agri4all nav item exists:
```html
<a class="nav-item" data-page="agri4all" tabindex="0">
  <span class="nav-label">Agri4All</span>
</a>
```

### 5c. App routing

`ui/js/app.js:339`: `agri4all` is in `deptPages` array.

`ui/js/app.js:355`: `deptMenuItems['agri4all']` = `['Posts', 'Newsletters', 'Links', 'Stats']`

`ui/js/app.js:346`: `deptNames['agri4all']` = `'Agri4All'`

`ui/js/app.js:536`: `'agri4all': 'assignedAgri4all'` — the dept-level assignment column key.

`ui/js/app.js:1034-1035`: When a tab in `deptTypeViews` is clicked (Posts, Newsletters, Links, Stats are all in this list), `showDeptContent` calls `window.renderDeptTypeTab(dashboardContent, page, viewName)`.

**Type filters in `renderDeptTypeTab`** (`pages/production/production-page.js:1247-1265`):
```js
'Posts':       ['agri4all-posts', 'agri4all-videos', 'agri4all-product-uploads', 'agri4all-linkedin'],
'Newsletters': ['agri4all-newsletters'],
'Links':       ['agri4all-posts', 'agri4all-videos', 'agri4all-product-uploads', 'agri4all-newsletters', 'agri4all-linkedin'],
'Stats':       ['agri4all-posts', 'agri4all-videos', 'agri4all-product-uploads', 'agri4all-newsletters', 'agri4all-banners', 'agri4all-linkedin'],
```

So the `agri4all` department's "Posts" tab **already shows `agri4all-posts` rows** via the generic `renderDeptTypeTab` flow. However, this renders a plain deliverables table, not the new per-post-type dashboard.

### 5d. Backend

`api/db.js:124`: Department seeded as `('Agri4All', 'agri4all')`.

`api/routes/deliverables.js:200-209`: Full `DEPT_MAP` for `agri4all-posts` already routes `approved` and `create_links` → `agri4all` dept.

No Agri4all-specific route files exist. The deliverable type is fully handled by the generic deliverables router.

---

## 6. Social-Media Department Tab Structure

### 6a. Tab definitions

`ui/js/app.js:356`: `deptMenuItems['social-media']` = `['Content Calendars', 'Agri for All', 'Own Social Media', 'Google Ads']`

### 6b. How tabs are rendered

`ui/js/app.js:1014-1028` (inside `showDeptContent`): When `page === 'social-media'`, there is a special early-return that **launches the social scheduler** preset to a source filter:
```js
var SM_SOURCE_MAP = {
  'Content Calendars': 'content-calendar',
  'Agri for All': 'agri4all',
  'Own Social Media': 'own-sm'
};
var presetSource = SM_SOURCE_MAP[viewName];
if (presetSource) {
  window.renderSocialSchedulerPage(dashboardContent, { sourceFilter: presetSource });
  return;
}
```

So **"Agri for All" in social-media already opens the scheduler preset to `sourceFilter: 'agri4all'`**. This is the existing tab. No new tab needs to be added for the social-media department — the existing "Agri for All" tab IS the Agri4all scheduler entry point.

### 6c. How approved items currently arrive in the scheduler

For content calendars: portal approval endpoint (`api/routes/portal.js:315-347`) inserts a `scheduled_posts` row with `source_type='content-calendar'`. The scheduler's `GET /api/scheduler/posts` endpoint filters by `sourceType` query param (`api/routes/scheduler.js:21-23`). The scheduler frontend reads posts and filters by `state.sourceFilter` (`pages/social-scheduler/social-scheduler.js:153`).

For `agri4all-posts` today: **no `scheduled_posts` insert happens on approval**. The portal approval endpoint at `api/routes/portal.js:192-209` does `UPDATE deliverables SET status='approved'` but inserts nothing into `scheduled_posts`. The per-post approval endpoints do insert into `scheduled_posts` with `source_type='content-calendar'` — that `source_type` value would need to be `'agri4all'` for Agri4all posts to appear in the scheduler's Agri4all tab.

---

## 7. Scheduler Integration Point

### 7a. The scheduler component

Single component: `pages/social-scheduler/social-scheduler.js` (1173 lines). Exposes `window.renderSocialSchedulerPage(container, options)`. `options.sourceFilter` pins the source tab.

`SOURCES` defined at lines 11-16:
```js
var SOURCES = [
  { id: 'all',              label: 'All' },
  { id: 'content-calendar', label: 'Content Calendars' },
  { id: 'agri4all',         label: 'Agri4All' },
  { id: 'own-sm',           label: 'Own Social Media' }
];
```

`source_type` values that the scheduler understands: `'content-calendar'`, `'agri4all'`, `'own-sm'`. Source filter at line 153 does `p.sourceType !== src`.

### 7b. How posts are created in `scheduled_posts`

New posts are created:
1. **By client portal approval** (`api/routes/portal.js:330-344`) — inserts with `source_type='content-calendar'` and `source_id = deliverable.id`
2. **Manually via scheduler UI** (`api/routes/scheduler.js:74-110`) — `POST /api/scheduler/posts` with `source_type` from body

For Agri4all posts, the portal approval endpoint needs to be extended to insert a `scheduled_posts` row with `source_type='agri4all'`.

### 7c. `scheduled_posts` table columns (`api/db.js:373-395`)

```
id, title, content, platforms (JSONB array), scheduled_at, status,
source_type (NOT NULL), source_id, client_id, media_urls (JSONB),
link_url, hashtags, notes, created_by, posted_at, post_error,
created_at, updated_at
```

No `post_type` column exists today. The scheduler renders cards generically — it does not need to know which Agri4all post type a scheduled post came from.

---

## 8. Request-Materials Form Data Access

### 8a. Storage

Request form answers are stored in the `request_forms` table (`api/db.js:318-331`):
- `fields` JSONB — field definitions
- `responses` JSONB — client's answers
- `deliverable_id` — links to a specific deliverable (nullable)
- `client_id` — fallback if no per-deliverable form exists
- `status` — `'draft'` / `'completed'`

### 8b. Access endpoint

`GET /api/deliverables/:id/request-form` (`api/routes/deliverables.js:108-157`):
- Looks up the deliverable's `client_id`
- Returns the latest `completed` `request_forms` row tied to `deliverable_id = $1` OR `(client_id = $2 AND deliverable_id IS NULL)` — per-deliverable form takes priority, falls back to client-level form
- Also returns `client_assets` with `kind = 'form_upload'` for that client

### 8c. Frontend display

`fetchRequestFormRecap(deliverableId, container)` at `pages/production/production-page.js:3111-3135` calls this endpoint. On success it calls `renderRequestFormRecap(container, data)` at line 3137, which renders field labels + responses as a Q&A list and shows attached assets as thumbnails.

This is already called at the top of both `openContentCalendarDashboard` (line 2706) and `openA4AMultiSectionDashboard` (line 4430). **The new Agri4all posts dashboard can reuse `fetchRequestFormRecap` unchanged** — it already handles the "materials recap at top" requirement.

---

## 9. Image Upload Mechanics + Proposed Post-Type Bucketing Schema

### 9a. Current upload endpoint

`POST /api/deliverables/:id/upload-images` (`api/routes/deliverables.js:1042-1081`):
- Uses `multer.diskStorage` → saves to `api/uploads/deliverable-images/`
- Returns `{ urls: ['/uploads/deliverable-images/...'] }`
- Best-effort mirrors each upload into `client_assets` with `kind='cc_post_image'`, `deliverable_id`, `client_id`, `mime_type`

The endpoint has **no concept of post type**. It accepts up to 10 files per request (`limits: { fileSize: 10MB, count: 10 }`).

### 9b. How existing dashboards track uploads per post

**Content calendar:** Each post in `metadata.posts[i].images` is an array of URL strings. The dashboard tracks uploaded URLs in the `posts` JSONB array directly. Upload panel (`cc-img-upload` label) appends returned URLs to `posts[i].images` and calls `savePostData()` which PATCHes `metadata.posts` via `PATCH /api/deliverables/:id`.

**`agri4all-posts` (existing `openA4AMultiSectionDashboard`):** Each "section" (`facebook_posts`, `instagram_posts`, `instagram_stories`) has `meta.sections[key].files` — an array of URL strings stored in `metadata.sections`. Upload via `buildUploadArea(deliverable.id, step.files, save, 'Upload...')` which also appends URLs and PATCHes `metadata`.

### 9c. Green-checkmark indicator requirement

The feature requires: for each selected post type, show a green checkmark when `uploaded_image_count >= amount`.

The amount per post type is already in `metadata` (e.g. `metadata.instagram_posts_amount = 5`). The uploaded count needs to be derivable per post type.

### 9d. Smallest schema change — two options

**Option A (no DB change — store post_type in metadata JSONB):**
Extend `metadata.sections[postTypeKey].files` to be the authoritative array. This is exactly what the existing `openA4AMultiSectionDashboard` already does. The green-checkmark check is then:
```js
meta.sections['instagram_posts'].files.length >= meta.instagram_posts_amount
```
No DB migration needed. The check is purely in-memory against the JSONB value.

**Option B (add `post_type` column to `client_assets`):**
Add `ALTER TABLE client_assets ADD COLUMN IF NOT EXISTS post_type VARCHAR(50)` in `api/db.js`. The upload endpoint would accept an optional `post_type` body field and write it to `client_assets`. Enables server-side queries like `SELECT COUNT(*) FROM client_assets WHERE deliverable_id=$1 AND post_type='instagram_posts'`.

**Recommendation (evidence-based):** Option A matches the existing pattern precisely. Option B adds complexity but enables aggregate queries. Given that the CC per-post pattern stores everything in `metadata.posts[]` JSONB, and the Agri4all multi-section dashboard already stores files in `metadata.sections[key].files`, **Option A requires zero schema changes** and is consistent with the codebase's established approach. If the `client_assets` mirror matters for other purposes (e.g. the client library page reads `kind='cc_post_image'`), then Option B's `post_type` column could be added additionally, but it is not required for the checkmark logic itself.

---

## 10. Gotchas / Parity Warnings

| # | Finding | Source |
|:--|:--------|:-------|
| 1 | **Workflow chain discrepancy**: The existing `agri4all-posts` chain in `ui/js/deliverable-workflows.js:26-31` already includes `sent_for_approval` between `ready_for_approval` and `approved`. The spec says this is a new step to add — it already exists. No chain edit needed unless the chain needs other adjustments. | `ui/js/deliverable-workflows.js:26-31` |
| 2 | **`approved` routes to `agri4all` dept, not `social-media`**: Both the frontend DEPT_MAP (`ui/js/deliverable-workflows.js:137`) and backend DEPT_MAP (`api/routes/deliverables.js:206`) route `approved → agri4all`. The spec says "lands in social-media dept's Agri4all tab → scheduler". The social-media "Agri for All" tab opens the scheduler filtered by `sourceFilter:'agri4all'`. But the deliverable itself will be in the `agri4all` dept after approval, not `social-media`. The scheduler reads `scheduled_posts` table, not `deliverables` by dept, so this is not necessarily broken — but the spec expectation that the approved deliverable "appears in the social-media Agri4all tab" may need clarification. | `ui/js/app.js:1017`, `ui/js/deliverable-workflows.js:137`, `api/routes/deliverables.js:206` |
| 3 | **Portal per-post approval is CC-only today**: `client-portal.html:1520` only routes `sm-content-calendar` to `buildCcApprovalCard`. All other types including `agri4all-posts` fall through to the generic card that approves the whole deliverable at once. Implementing per-post approval for Agri4all posts requires a new branch here. | `client-portal.html:1518-1523` |
| 4 | **No `scheduled_posts` insert on Agri4all post approval today**: `api/routes/portal.js:192-209` (deliverable-level approve) and `api/routes/portal.js:281-354` (per-post approve, CC-only) both need to be updated to insert `scheduled_posts` rows with `source_type='agri4all'` for Agri4all posts. Without this, approved items never appear in the scheduler's Agri4all tab. | `api/routes/portal.js:192-209`, `pages/social-scheduler/social-scheduler.js:153` |
| 5 | **`facebook_instant_experience` in checklist but not in agri4all-posts metadata**: The checklist JSON has `facebook_instant_experience` as a post type, but the bulk-create for `agri4all-posts` (`api/routes/deliverables.js:688-708`) does not write this field to metadata. If the feature's multi-select needs to include it, the metadata structure and bulk-create must be updated. | `api/routes/deliverables.js:688-708`, `docs/full_checklist_json_example.json:368` |
| 6 | **`toCamelCase()` is shallow**: `api/utils.js:1-9` only converts top-level keys. Nested JSONB objects (e.g. `metadata.facebook_posts_amount`) are returned as-is in DB snake_case. Frontend code always reads these keys as snake_case from `metadata`. Do not apply `toCamelCase` inside metadata objects. | `api/utils.js:1-9` |
| 7 | **AUTH_ENABLED is `false` by default**: `api/config.js:4` — `AUTH_ENABLED: process.env.AUTH_ENABLED === 'true' || false`. The `.env` file on disk has no `AUTH_ENABLED` key, so auth is disabled in dev. New API endpoints will work in dev without auth headers, but production requires them. Do not hardcode auth skip assumptions in new code. | `api/config.js:4`, `.env` (no `AUTH_ENABLED` key present) |
| 8 | **`openA4AMultiSectionDashboard` already exists for `agri4all-posts`**: Eye click on `agri4all-posts` already calls `openA4AMultiSectionDashboard(c, it, 'posts')` at `pages/production/production-page.js:865`. This renders per-section upload blocks. The new feature's dashboard replaces or extends this. Dev agents must decide whether to modify `openA4AMultiSectionDashboard` or create a new `openAgri4AllPostsDashboard`. Modifying the existing function risks breaking the current multi-section layout for videos/own-posts which share the function. **Recommend a separate function.** | `pages/production/production-page.js:865`, `pages/production/production-page.js:4306-4388` |
| 9 | **The Design dept's "Agri for All" tab already exists**: `ui/js/app.js:352` shows design's tabs include `'Agri for All'`. This calls `renderDeptTypeTab` which renders types `['agri4all-posts', 'agri4all-videos', 'agri4all-product-uploads', 'agri4all-newsletters', 'agri4all-linkedin']`. If the new feature needs design to see the new dashboard, the eye-icon dispatch in design's tab rendering already goes through production's `colEye()` helper (via `renderSplitSheetTab` / `renderClientGroupedSheet`). | `pages/production/production-page.js:1250`, `ui/js/app.js:352` |
| 10 | **`.env` contains plain-text secrets** (tokens, passwords, API keys). Do not commit this file. It is already in the untracked file list in git status but is not in `.gitignore` as far as can be confirmed from this investigation. | `.env` |

---

## What the Dev Agents Need to Do

### Backend agent

1. **`api/db.js`** — Add idempotent per-post-type status migration for `agri4all-posts` deliverables (analogous to the CC migration at lines 479-511). For each `agri4all-posts` deliverable with `metadata.sections`, ensure each section has a `status` field. Also consider adding a `posts` structure if you choose to model individual upload slots (one per post-type amount unit) rather than the current flat files array.

2. **`api/routes/portal.js`** — Add a new branch or separate endpoints for per-post-type approval of `agri4all-posts` deliverables (parallel to the existing per-post CC endpoints at lines 275-425). Key differences from CC: post index is replaced by post-type key (e.g. `facebook_posts`); on approval, insert `scheduled_posts` with `source_type='agri4all'`. The all-approved check is: all enabled post types in metadata have `status='approved'`.

3. **`api/routes/deliverables.js`** — No DEPT_MAP changes needed (already correct). No chain changes needed in backend. Verify the upload endpoint does not need a `post_type` parameter; if you choose Option B for the schema, add the `post_type` column to `client_assets` here and accept it in `POST /:id/upload-images`.

4. **`api/db.js`** (if Option B chosen) — Add `ALTER TABLE client_assets ADD COLUMN IF NOT EXISTS post_type VARCHAR(50)` migration.

### Frontend agent

1. **`pages/production/production-page.js`** — Create a new `openAgri4AllPostsDashboard(container, deliverable)` function. Structure:
   - Call `setupDashboardSidebar(deliverable, fn)` for the sidebar swap
   - At top: call `fetchRequestFormRecap(deliverable.id, recap)` (already works)
   - Right side: render one upload block per enabled post type (read from `metadata.facebook_posts`, `metadata.instagram_posts`, `metadata.instagram_stories` and their `_amount` fields)
   - Each upload block shows: post type label, `amount` and `curated_amount`, upload area (`buildUploadArea`), green checkmark indicator when `files.length >= amount`
   - Save files to `metadata.sections[postTypeKey].files` (existing structure — no schema change)
   - Add this function to the `window.openContentCalendarDashboard` / `window.prodCols` export block at lines 2376-2462 so Design can reuse it

2. **`pages/production/production-page.js:865`** — Change `openA4AMultiSectionDashboard(c, it, 'posts')` to `openAgri4AllPostsDashboard(c, it)` for `agri4all-posts` eye-click dispatch (both at line 865 and line 2131).

3. **`client-portal.html`** — Add a new branch in `renderApprovals()` (line 1518-1523) for `d.type === 'agri4all-posts'` → call a new `buildA4aPostsApprovalCard(d)` function. Model it on `buildCcApprovalCard` but use post-type sections (facebook_posts, instagram_posts, instagram_stories) rather than a flat posts array. Each section gets its own approve/request-changes UI calling the new portal endpoints.

4. **`ui/js/deliverable-workflows.js`** — No changes needed (chain and DEPT_MAP already correct for `agri4all-posts`).

5. **`ui/js/app.js`** — No changes needed for routing. The "Agri for All" tab in social-media already opens the scheduler with `sourceFilter:'agri4all'`. Agri4all dept's "Posts" tab already renders `agri4all-posts` via `renderDeptTypeTab`.

6. **`pages/social-scheduler/social-scheduler.js`** — No changes needed for the tab itself. The scheduler already handles `sourceFilter:'agri4all'` and `source_type='agri4all'` in `scheduled_posts`. Approved Agri4all posts will appear here once the portal endpoint inserts them.

7. **Consider** whether to add a dedicated `pages/agri4all/agri4all-page.js` (similar to `pages/design/design-page.js`) to give the Agri4all dept a richer view than the generic `renderDeptTypeTab` table. The spec does not explicitly require this — but the existing design dept page is a precedent.
