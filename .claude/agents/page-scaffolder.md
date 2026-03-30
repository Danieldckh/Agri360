---
name: page-scaffolder
description: "Scaffolds new frontend page modules for the ProAgri CRM SPA. Use when the user wants to create a new page, view, or section in the app."
tools: Glob, Grep, Read, Write, Edit
model: opus
color: cyan
---

# Page Scaffolder Agent

You generate complete frontend page modules for the ProAgri CRM SPA, following the exact pattern used in `clients/js/client-list.js`.

## Before You Start

1. Read `clients/js/client-list.js` — canonical page template
2. Read `ui/js/app.js` — find the `pageRenderers` object to add the new page
3. Read `index.html` — to see where to add link/script tags and nav items
4. Determine: page name (kebab-case), display label, nav group, API endpoint (if any)

## The Frontend Page Pattern

### Directory Structure
Create: `{page-name}/css/{page-name}.css` and `{page-name}/js/{page-name}.js`

### JavaScript Pattern (IIFE + window export)

CRITICAL: Use `var` declarations (not `let`/`const`) to match existing codebase convention.

```javascript
var PAGE_API_URL = window.API_URL || '/api';

window.renderXxxPage = function(container) {
  while (container.firstChild) {
    container.removeChild(container.firstChild);
  }

  container.style.display = 'block';
  container.style.alignItems = '';
  container.style.justifyContent = '';

  var section = document.createElement('div');
  section.className = '{page-name}-section';

  var allItems = [];
  var searchTerm = '';

  function authHeaders(json) {
    var h = window.getAuthHeaders ? window.getAuthHeaders() : {};
    if (json) {
      h['Content-Type'] = 'application/json';
    }
    return h;
  }

  var sheetContainer = null;

  function renderContent() {
    while (section.firstChild) {
      section.removeChild(section.firstChild);
    }
    // Build header with title + search
    // Build sheet container
    // Call renderSheetOnly()
  }

  function renderSheetOnly() {
    var filtered = getFilteredItems();
    if (window.renderSheet && sheetContainer) {
      window.renderSheet(sheetContainer, {
        columns: [ /* column definitions */ ],
        data: filtered
      });
    }
  }

  function getFilteredItems() {
    if (!searchTerm) return allItems;
    var term = searchTerm.toLowerCase();
    return allItems.filter(function(item) {
      // filter logic
    });
  }

  function loadData() {
    // Show loading state
    // fetch(PAGE_API_URL + '/endpoint', { headers: authHeaders(false) })
    // .then -> allItems = data, renderContent()
    // .catch -> show error
  }

  container.appendChild(section);
  loadData();
};
```

### CSS Pattern
- Use CSS variables from `ui/css/styles.css`: `var(--bg-primary)`, `var(--text-primary)`, etc.
- Scope all selectors under `.{page-name}-section`
- Include header, search, and content area styles

### Registration Steps (MUST DO ALL)

1. **index.html** — Add CSS link: `<link rel="stylesheet" href="{page-name}/css/{page-name}.css">`
2. **index.html** — Add JS script: `<script src="{page-name}/js/{page-name}.js"></script>` (before app.js)
3. **index.html** — Add nav item in appropriate nav-group:
   ```html
   <a class="nav-item" data-page="{page-name}">
     <svg><!-- icon --></svg>
     <span>{Display Label}</span>
   </a>
   ```
4. **ui/js/app.js** — Add to `pageRenderers` object:
   ```javascript
   '{page-name}': function() { window.renderXxxPage(dashboardContent); },
   ```

## Output

Report: files created, registrations added, and what the user should verify.
