---
name: New Department Tab
description: "Use when the user asks to create a department tab, add a department view, scaffold a dept tab, or add a tab to a department page. Creates HTML template + JS init function + route registration for a department-specific deliverable view."
---

# /new-dept-tab — Scaffold a Department Tab

Generate a department tab view that filters and displays deliverables for a specific department and deliverable type.

## Step 1: Gather Info

Ask the user for:
- **Department slug** (e.g., `design`, `editorial`, `video`, `agri4all`, `social-media`)
- **Tab name** (e.g., `Content Calendars`, `Magazine`, `Briefs`)
- **Deliverable types** to filter (e.g., `sm-content-calendar`, `magazine`)
- **Layout** — `full-width` (single sheet), `split` (two sheets side by side), or `grouped` (grouped by client)

## Step 2: Determine Status Filters

Read `ui/js/deliverable-workflows.js` and find:
1. The DEPT_MAPS for each specified deliverable type
2. Which statuses map to the target department
3. Any BRANCH_STATUSES that route to this department

These statuses become the tab's filter criteria.

## Step 3: Read Reference Files

- `pages/production/production-page.js` — reference department tab implementation
- `pages/production/production.html` — reference HTML template structure
- `ui/js/app.js` — find `showDeptContent()` function (around line 922)
- `index.html` — find script/link insertion points

## Step 4: Check/Create Department Files

If `pages/{dept}/{dept}-page.js` doesn't exist yet, create it with the IIFE wrapper:

```javascript
(function() {
  'use strict';
  // Tab functions will be added here
})();
```

If `pages/{dept}/{dept}.html` doesn't exist, create it as empty container.
If `pages/{dept}/{dept}-page.css` doesn't exist, create it with base dept styles.

## Step 5: Generate Tab Code

### A. Append HTML template block to `pages/{dept}/{dept}.html`

Template with: header (title + month selector), sheet container, appropriate layout.

### B. Append JS render function to `pages/{dept}/{dept}-page.js`

Function `window.render{Dept}{TabName}Tab(container)` that:
- Loads the template
- Fetches `GET /api/deliverables/by-department/{dept}?month=YYYY-MM`
- Filters by type and status arrays
- Renders with `window.renderSheet()` using appropriate columns
- Includes month navigation (prev/next buttons updating currentMonth)
- Includes radial menu with "Advance Status" action using `DELIVERABLE_WORKFLOWS.getNextStatus()`

CRITICAL: Use `var` declarations, `.then()` chains, and `window.getAuthHeaders()`.

### C. Add route case in `showDeptContent()` in `ui/js/app.js`

```javascript
if (page === '{dept}' && viewName === '{Tab Name}' && window.render{Dept}{TabName}Tab) {
  window.render{Dept}{TabName}Tab(dashboardContent);
  return;
}
```

Insert BEFORE the generic `deptTypeViews` check block. Also remove the tab name from the `deptTypeViews` array if it's listed there.

### D. Register in index.html (if new department files)

Add `<link>` and `<script>` tags. Script must load after `deliverable-workflows.js` and before `app.js`.

## Step 6: Report

Tell the user:
- Files created/modified
- Statuses being filtered (from workflow definitions)
- How to navigate: sidebar → department → tab name
- Column configuration used
