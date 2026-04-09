# Research Report: Agri4All Posts Row + Dashboard — Three Changes

Date: 2026-04-09
Researcher: researcher agent (claude-sonnet-4-6)
Scope: Row label removal, per-platform rows, Request Client Materials block

---

## 0. Current State (Baseline)

### How an agri4all-posts deliverable is created

- **Source**: `POST /api/deliverables/bulk` in `api/routes/deliverables.js:297`
- The title is auto-constructed at **`api/routes/deliverables.js:694`**:
  ```
  clientName + ' - Agri4All Posts - ' + ml
  ```
  e.g. `test5 - Agri4All Posts - April 2020`
- The `metadata` JSONB column is populated with **flat boolean + amount fields** (NOT a `platforms` array):
  - `facebook_posts` (bool), `facebook_posts_amount`, `facebook_posts_curated_amount`
  - `instagram_posts` (bool), `instagram_posts_amount`, `instagram_posts_curated_amount`
  - `instagram_stories` (bool, auto-derived = same as `instagram_posts`), `instagram_stories_amount`
  - `countries` (array)
  - Source: `api/routes/deliverables.js:696-707`

### Where the row renders (TWO paths)

**Path A — Production > Deliverables tab** (`renderProductionTab`)

- File: `pages/production/production-page.js`
- Row loop entry: line ~1954 (`group.items.forEach`)
- Agri4all-posts goes through the **standard (non-CC, non-OA) branch**
- Cell order: eye | team avatar | typeCell | platforms pills | Request Materials button | status | advance/back arrows
- `typeCell` at line **2224**: `formatTypeLabel(item.type)` → `"Agri4All Posts"` (hardcoded in map at line 78)
- `item.title` is **not rendered** in this path — a comment at line 2220 says "Title column has been dropped from the production sheet per spec"
- Platforms pills at lines **2230-2245**: reads `stdMeta.platforms` as an array — BUT the metadata stored by `createDeliv` does NOT use a `platforms` array. It uses flat `facebook_posts`/`instagram_posts` booleans. This means the platforms pills cell is always **empty** for agri4all-posts created from the booking form.

**Path B — Agri4All dept > Posts tab** (`renderDeptTypeTab`)

- Entry: `ui/js/app.js:1040-1042` routes viewName `'Posts'` to `window.renderDeptTypeTab(dashboardContent, 'agri4all', 'Posts')`
- `typeFilters['Posts']` at `production-page.js:1322` → includes `['agri4all-posts', 'agri4all-videos', 'agri4all-product-uploads', 'agri4all-linkedin']`
- Renders a `<table>` with columns: Title | Type | Status | Assigned To | Due Date | action
- **`item.title` at line 1461**: `tdTitle.textContent = item.title || '—'`
- This is where `"test5 - Agri4All Posts - April 2020"` appears as the primary label

### Dashboard (eye icon → openA4AMultiSectionDashboard)

- Eye click at line 928/2193 dispatches to `openA4AMultiSectionDashboard(container, item, 'posts')`
- Dashboard function: `pages/production/production-page.js:4772`
- Dashboard already has `fetchRequestFormRecap` at line **4858** — the recap block IS already inserted into the dashboard
- Sections rendered by dashboard are derived from **flat metadata booleans** (`meta.facebook_posts`, `meta.instagram_posts`, `meta.instagram_stories`) at lines **4791-4793**
- Title shown in dashboard (`h2.cc-dashboard-title`): `deliverable.title` at line **4836** — still shows the "test5-agri4all-posts-april-2020" name

---

## Change 1 — Remove the "test5-agri4all-posts-april-2020" style title / replace with type label

### Where it appears

| Location | File | Line | What to change |
|:---------|:-----|:-----|:---------------|
| Agri4All > Posts tab primary column | `pages/production/production-page.js` | 1461 | `item.title` → `formatTypeLabel(item.type)` or client-name only |
| renderDeptTypeTab search filter | `pages/production/production-page.js` | 1416 | Searches `item.title` — may need updating |
| renderClientGroupedSheet Title column (used by other views that include agri4all) | `pages/production/production-page.js` | 680 | Same `item.title` pattern |
| Dashboard h2 title | `pages/production/production-page.js` | 4836 | `deliverable.title` — replace with `formatTypeLabel(deliverable.type)` |

### What the user wants to show instead

The user says: "use the same kind of label used for 'Own Social Twitter' / 'Own Social LinkedIn'". Those labels come from **`formatTypeLabel(item.type)`** at line 2225 (Production tab) and `colType()` factory at line 777. For `agri4all-posts` this returns `"Agri4All Posts"` (line 78).

**Conclusion**: The replacement is `formatTypeLabel(item.type)` = `"Agri4All Posts"`. The `item.title` in Path B (renderDeptTypeTab) at line 1461 is what must change.

### Files to modify

| File | Change |
|:-----|:-------|
| `pages/production/production-page.js:1461` | Change `item.title` to `formatTypeLabel(item.type)` in the `renderDeptTypeTab` table row |
| `pages/production/production-page.js:4836` | Change `deliverable.title` in dashboard `h2` to `formatTypeLabel(deliverable.type)` |
| `pages/production/production-page.js:680` | Same swap in `renderClientGroupedSheet` (shared by other dept views) — only if that path also shows agri4all rows |

### No backend changes needed

The `title` column in the DB does not need to change (it is used as search/ID elsewhere). No schema change.

### Sister-repo implications

None. The `deliverables.title` column is not consumed by `checklist-Agri360` or `Booking-Form-Esign`.

---

## Change 2 — Show per-platform rows (selected platforms as pills/sub-rows)

### Where platform data lives in metadata

The `agri4all-posts` deliverable stores platforms as **flat booleans** in `metadata`, not as an array:

| Field | Type | Source |
|:------|:-----|:-------|
| `metadata.facebook_posts` | bool | `api/routes/deliverables.js:698` |
| `metadata.instagram_posts` | bool | `api/routes/deliverables.js:701` |
| `metadata.instagram_stories` | bool (auto = same as instagram_posts) | `api/routes/deliverables.js:705` |

**There is no `metadata.platforms` array for agri4all-posts.** The `SOCIAL_MEDIA_TYPES_WITH_PLATFORMS` flag at line 111 sets `agri4all-posts: true`, meaning the row tries to render platform pills — but it reads from `stdMeta.platforms` (an array) which is empty for these deliverables. The pills are therefore **blank** today.

### Current platforms render path (broken for agri4all-posts)

- `pages/production/production-page.js:2230-2245` — reads `stdMeta.platforms` as array, calls `formatPlatformLabel(key, item.type)`
- `formatPlatformLabel` at line 120: handles `facebook`, `instagram`, `instagram_stories`, etc.

### What must change

The platforms cell needs to read **flat booleans** from `metadata` instead of an array, OR the `createDeliv` call at `api/routes/deliverables.js:692-708` needs to also store a `platforms` array alongside the flat fields.

**Option A (backend change)**: Add a `platforms: ['facebook', 'instagram', 'instagram_stories']` array to the metadata when bulk-creating `agri4all-posts`. The platforms cell already reads this correctly.

**Option B (frontend-only)**: In the platforms cell renderer at line 2230, detect agri4all-posts and build the platform list from the flat boolean fields instead of from `.platforms`.

The `renderDeptTypeTab` table (Path B) has **no platforms column at all** — a platforms column would need to be added to `renderDeptTypeTab` at line 1401 (header) and line 1455 (row).

### Files to modify

| File | Change | Dev |
|:-----|:-------|:----|
| `pages/production/production-page.js:2230-2245` | Fix platforms cell to read flat booleans for agri4all-posts | frontend |
| `pages/production/production-page.js:1401` | Add "Platforms" column header to renderDeptTypeTab | frontend |
| `pages/production/production-page.js:1455-1461` | Add platforms pills cell to renderDeptTypeTab row | frontend |
| `api/routes/deliverables.js:696-708` | (optional) Also write `platforms` array to metadata on create | backend |
| `formatPlatformLabel` at line 120 | Already handles `facebook`, `instagram`, `instagram_stories` — no change needed | — |

### DEPT_MAPS / workflow implications

None. Platforms display is cosmetic; it does not affect status routing.

### Sister-repo implications

If **Option A** is chosen (add `platforms` array to createDeliv metadata), the `checklist-Agri360` repo provides the checklist data that flows into this function — but the change is entirely server-side and does not affect the checklist JSON format. No sister-repo coordination needed.

---

## Change 3 — Add "Request Client Materials" block at top of Agri4All Posts dashboard

### Existing pattern to copy from

This block already exists in `openA4AMultiSectionDashboard` at `pages/production/production-page.js:4850-4858`:

```
var a4aMsRecap = document.createElement('div');
a4aMsRecap.className = 'cc-materials-recap';
...
fetchRequestFormRecap(deliverable.id, a4aMsRecap);
```

**It is already there.** The `fetchRequestFormRecap` call at line **4858** already inserts the recap block above `stepsWrap`. The dashboard for agri4all-posts already has this block today.

### How the recap block works (end-to-end)

| Layer | Location | What it does |
|:------|:---------|:-------------|
| Frontend fetch | `pages/production/production-page.js:3185-3209` (`fetchRequestFormRecap`) | `GET /api/deliverables/:id/request-form` |
| Backend route | `api/routes/deliverables.js:108-157` | Queries `request_forms` WHERE `status='completed'` AND (`deliverable_id=$1` OR `client_id=$2 AND deliverable_id IS NULL`) |
| DB table | `api/db.js:318-330` | `request_forms` — columns: `id`, `token`, `client_id`, `deliverable_id`, `name`, `fields` (JSONB `[]`), `responses` (JSONB `{}`), `status`, `created_by`, `completed_at` |
| Frontend render | `pages/production/production-page.js:3211-3282` (`renderRequestFormRecap`) | Renders header + fields/responses + attached assets |
| Empty state | `pages/production/production-page.js:3193-3198` | Shows "No materials request submitted yet." |

### How the form is created (staff side)

- Staff clicks "Request Materials" button at line 2261 → opens `/form-builder.html?clientId=X&deliverableId=Y`
- Form builder calls `POST /api/portal/create-request-form` (at `api/routes/portal.js:563`) which INSERTs into `request_forms` with status `'active'` and auto-advances deliverable from `request_client_materials` → `materials_requested`

### How the form is submitted (client side)

- Client portal (`client-portal.html`) calls `POST /api/portal/:token/forms/:formToken/submit` at `api/routes/portal.js:137`
- Sets `status = 'completed'`, writes responses JSON, stamps `completed_at`
- Also auto-advances any deliverable in status `materials_requested`, `request_focus_points`, `focus_points_requested`, `request_materials` to `materials_received` (line 152-159)
- NOTE: the auto-advance at line 158 does NOT include `request_client_materials` status — this is the initial status before the form is even published. The advance from `request_client_materials` → `materials_requested` happens at form-publish time (line 572-574 of portal.js), not at form-submit time.

### The dashboard block is already implemented

The recap block already appears in `openA4AMultiSectionDashboard`. If the user is not seeing it, likely reasons:
1. No `request_forms` row exists yet for that deliverable (form not yet created by staff)
2. The block exists but shows "No materials request submitted yet." (pending form)
3. Possible CSS issue hiding the `.cc-materials-recap` div

### Files that would need changes (if block is truly missing or needs UI work)

| File | Change |
|:-----|:-------|
| `pages/production/production-page.js:4850-4858` | Already present — verify it renders visually |
| `pages/production/production-page.css` | Verify `.cc-materials-recap`, `.cc-recap-header`, `.cc-recap-qa` CSS exists and is not hidden |

### Pattern exists in other dashboards

| Dashboard | Function | Line |
|:----------|:---------|:-----|
| Content Calendar | `openContentCalendarDashboard` | 2780 |
| Online Articles | `openOnlineArticlesDashboard` | 4504 |
| Website Design (left col) | `openWebsiteDesignDashboard` | 4225 |
| A4A Image/Description | `openA4AImageDescriptionDashboard` | 5034 |
| A4A Rich Text | `openA4ARichTextDashboard` | 5154 |
| A4A Multi-Section (posts/videos) | `openA4AMultiSectionDashboard` | **4858** — already present |

All six dashboards already call `fetchRequestFormRecap`. This is the established pattern.

---

## File Map Summary

| File | Relevance |
|:-----|:----------|
| `pages/production/production-page.js` | Primary file — all three changes live here |
| `pages/production/production-page.css` | CSS for recap block classes; verify presence |
| `api/routes/deliverables.js` | Backend: `createDeliv` metadata shape (Change 2, Option A); `GET /:id/request-form` route |
| `api/routes/portal.js` | Form creation (`POST /create-request-form`) + client submission (`POST /:token/forms/:formToken/submit`) |
| `api/db.js` | Schema: `request_forms` table (lines 318-330); `deliverables.metadata` JSONB column (line 287) |
| `ui/js/app.js` | Routes `agri4all > Posts` view to `renderDeptTypeTab` (lines 355, 1040-1042) |
| `ui/js/deliverable-workflows.js` | Workflow chain for agri4all-posts (lines 26-44); no changes needed |

---

## Dev Task Split

### dev-frontend tasks

1. **Change 1a**: In `renderDeptTypeTab` (`production-page.js:1461`), replace `item.title` with `formatTypeLabel(item.type)` for the primary label column.
2. **Change 1b**: In `openA4AMultiSectionDashboard` (`production-page.js:4836`), replace `deliverable.title` in the dashboard `h2` with `formatTypeLabel(deliverable.type)`.
3. **Change 2a**: In `renderDeptTypeTab` (`production-page.js:1401`), add "Platforms" column header.
4. **Change 2b**: In `renderDeptTypeTab` row builder (`production-page.js:1455`), add platforms pills cell that reads flat booleans (`meta.facebook_posts`, `meta.instagram_posts`, `meta.instagram_stories`) and maps them to labels.
5. **Change 2c**: In the Production tab platforms cell (`production-page.js:2230`), add agri4all-posts-specific logic to read flat booleans when `stdMeta.platforms` is empty.
6. **Change 3**: Confirm `.cc-materials-recap` block renders visually in the dashboard. It is already present in code. If invisible, check CSS in `production-page.css`.

### dev-backend tasks (optional, for Change 2 Option A)

1. In `api/routes/deliverables.js:696-708`, add a `platforms` array to the `agri4all-posts` `createDeliv` metadata call alongside the existing flat booleans. Example: `platforms: ['facebook', 'instagram', 'instagram_stories'].filter(k => metadata[k])`. This makes the existing frontend platforms-array reader work without frontend changes to the Production tab.

---

## Risks, Ambiguities, and Open Questions

| # | Issue | Impact | Needs answer from user |
|:--|:------|:-------|:----------------------|
| 1 | **Two metadata formats coexist**: The Production tab platforms cell reads `metadata.platforms[]` (array), but `agri4all-posts` stores flat booleans. Both formats are in production. Choosing Option A vs B for Change 2 determines scope. | Medium | Which approach: fix frontend to read flat booleans, OR add `platforms[]` to backend createDeliv? |
| 2 | **Change 1a affects all types in renderDeptTypeTab**: Replacing `item.title` with `formatTypeLabel` means ALL types in the "Posts" tab (agri4all-videos, agri4all-product-uploads, agri4all-linkedin) lose their title column. Is that intended? | Low-medium | Confirm the title removal applies to all types in the Posts tab, or only agri4all-posts rows |
| 3 | **Change 3 is already implemented**: The recap block is already in `openA4AMultiSectionDashboard`. Was the user seeing a different state (form not yet created by staff, or CSS issue)? | Medium | Verify by creating a request-form for an agri4all-posts deliverable and opening the dashboard |
| 4 | **renderClientGroupedSheet also shows `item.title`** (line 680) — this path is used by views like "Links", "Stats" in the Agri4All dept. Should those also be changed? | Low | Confirm scope: only "Posts" tab, or all Agri4All dept tabs |
| 5 | **Portal auto-advance gap**: When client submits form, `portal.js:158` advances statuses including `request_materials` but NOT `request_client_materials`. Agri4all-posts starts at `request_client_materials`. The form-publish step (creating the form) advances it to `materials_requested`. This is working correctly — just documenting for clarity. | None | No action needed |
| 6 | **Sister-repo scope**: Neither `checklist-Agri360` nor `Booking-Form-Esign` consumes `deliverables.title` or `deliverables.metadata.platforms`. All three changes are safe from coordination standpoint. | None | — |
| 7 | **DEPT_MAPS parity**: No changes touch status routing or workflow chains. `ui/js/deliverable-workflows.js` and `api/routes/deliverables.js` DEPT_MAPS do not need updating. | None | — |
