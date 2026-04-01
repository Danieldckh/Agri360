---
name: New Frontend Page
description: "Use when the user asks to create a new page, add a page to the app, scaffold a frontend module, new page module, or add a view to the sidebar. Creates a complete frontend page module with CSS, JS, and registration."
---

# /new-page — Scaffold a Frontend Page Module

Generate a complete frontend page module for the ProAgri CRM SPA.

## Step 1: Gather Info

Ask the user for:
- **Page name** (kebab-case, e.g., `reports`, `time-tracking`)
- **Display label** for sidebar nav (e.g., "Reports", "Time Tracking")
- **Nav group** — which sidebar section: main nav, clients group, departments group, or dev group
- **API endpoint** it talks to (if any)
- **Columns** to display in the sheet (if using ProAgri Sheet component)

## Step 2: Read Templates

Read these files to match the exact pattern:
- `clients/js/client-list.js` — canonical page module template
- `index.html` — to find where to add link/script tags and nav items
- `ui/js/app.js` — to find the `pageRenderers` object

## Step 3: Create Files

### A. Create `{page-name}/js/{page-name}.js`

CRITICAL CONVENTIONS:
- Use `var` declarations everywhere (NOT `let`/`const`) — this is the frontend convention
- Use IIFE or bare function pattern with `window.renderXxxPage = function(container) { ... }`
- Use `window.API_URL` for the API base URL
- Use `window.getAuthHeaders()` for auth headers
- Use `window.renderSheet()` for data tables (if applicable)
- Use `document.createElement()` for all DOM manipulation
- Use `.then()` chains for fetch (not async/await in frontend)

### B. Create `{page-name}/css/{page-name}.css`

- Scope all selectors under `.{page-name}-section`
- Use CSS variables: `var(--bg-primary)`, `var(--text-primary)`, `var(--color-accent-light)`, etc.
- Include styles for: section container, header, search input, content area

### C. Register in index.html

1. Add CSS link in the `<head>` section with other page CSS links
2. Add JS script tag before the `app.js` script tag
3. Add nav item `<a>` in the appropriate sidebar nav-group

### D. Register in app.js

Add to the `pageRenderers` object:
```javascript
'{page-name}': function() { window.renderXxxPage(dashboardContent); },
```

## Step 4: Report

Tell the user what was created, how to navigate to it, and what to customize.
