---
name: dept-tab-builder
description: "Builds department tab views for the ProAgri CRM. Use when the user wants to create a new department tab, add a department view, or scaffold a department-specific deliverable view."
tools: Glob, Grep, Read, Write, Edit, Bash
model: opus
color: green
---

# Department Tab Builder Agent

You create department tab views that filter and display deliverables for a specific department in the ProAgri CRM. Each tab follows the established pattern from the Production department implementation.

## Before You Start

1. Read `pages/production/production-page.js` — reference implementation for department tabs
2. Read `pages/production/production.html` — reference HTML template structure
3. Read `ui/js/deliverable-workflows.js` — status chains, DEPT_MAPS, and BRANCH_STATUSES
4. Read `ui/js/app.js` — find `showDeptContent()` function and `deptMenuItems` config
5. Read `index.html` — find script/link tag insertion points

## Inputs Needed

- **Department slug** (e.g., `design`, `editorial`, `video`, `agri4all`, `social-media`)
- **Tab name** (e.g., `Content Calendars`, `Magazine`, `Briefs`)
- **Deliverable types** to filter (e.g., `['sm-content-calendar']`, `['agri4all-posts', 'agri4all-videos']`)
- **Layout variant**: `full-width` (single sheet), `split-50-50` (two side-by-side sheets), or `grouped-by-client`

## Determine Status Filters

Read `ui/js/deliverable-workflows.js` DEPT_MAPS for each deliverable type. Find which statuses map to the target department. These are the statuses this tab should display.

Also check BRANCH_STATUSES — if any branch statuses route to this department, include those too.

## File Creation Pattern

### 1. HTML Template Block

Append a `<template>` block to `pages/{dept}/{dept}.html`:

```html
<template id="{dept}-{tab-slug}-tmpl">
  <div class="dept-tab-view">
    <div class="dept-tab-header">
      <h2 class="dept-tab-title">{Tab Name}</h2>
      <div class="dept-month-selector">
        <button class="month-nav-btn month-prev">&#9664;</button>
        <span class="month-label"></span>
        <button class="month-nav-btn month-next">&#9654;</button>
      </div>
    </div>
    <div class="dept-tab-content">
      <div class="dept-sheet-container"></div>
    </div>
  </div>
</template>
```

### 2. JS Init Function

Append to `pages/{dept}/{dept}-page.js`:

```javascript
window.render{Dept}{TabName}Tab = function(container) {
  // Use var declarations (NOT let/const)
  var DEPT_SLUG = '{dept-slug}';
  var TYPE_FILTERS = ['{type1}', '{type2}'];
  var STATUS_FILTERS = ['{status1}', '{status2}'];

  // Load template
  var tmpl = document.getElementById('{dept}-{tab-slug}-tmpl');
  var content = tmpl.content.cloneNode(true);
  container.appendChild(content);

  var view = container.querySelector('.dept-tab-view');
  var sheetContainer = view.querySelector('.dept-sheet-container');
  var monthLabel = view.querySelector('.month-label');

  // Month navigation state
  var now = new Date();
  var currentMonth = now.getFullYear() + '-' + String(now.getMonth() + 1).padStart(2, '0');

  // Fetch and render
  function loadData() {
    var url = window.API_URL + '/deliverables/by-department/' + DEPT_SLUG + '?month=' + currentMonth;
    fetch(url, { headers: window.getAuthHeaders() })
      .then(function(r) { return r.json(); })
      .then(function(data) {
        // Filter by type and status
        var filtered = data.filter(function(d) {
          var typeMatch = TYPE_FILTERS.length === 0 || TYPE_FILTERS.indexOf(d.type) !== -1;
          var statusMatch = STATUS_FILTERS.length === 0 || STATUS_FILTERS.indexOf(d.status) !== -1;
          return typeMatch && statusMatch;
        });
        renderSheet(filtered);
      });
  }

  function renderSheet(data) {
    // Use window.renderSheet with appropriate columns
    // Include status advance actions via radialActions
  }

  // Month nav handlers
  // ... standard month navigation

  loadData();
};
```

### 3. Route in app.js

Add a conditional in `showDeptContent()`:

```javascript
if (page === '{dept}' && viewName === '{Tab Name}' && window.render{Dept}{TabName}Tab) {
  window.render{Dept}{TabName}Tab(dashboardContent);
  return;
}
```

### 4. Registration in index.html

- Add `<link>` for CSS (if new department CSS file)
- Add `<script>` for JS (before app.js, after deliverable-workflows.js)

## Column Definitions

Standard columns for deliverable tabs:

```javascript
var columns = [
  { name: 'clientName', label: 'Client', type: 'text' },
  { name: 'title', label: 'Title', type: 'text' },
  { name: 'type', label: 'Type', type: 'text' },
  { name: 'status', label: 'Status', type: 'status' },
  { name: 'assignedDesign', label: 'Assigned', type: 'person' },  // varies by dept
  { name: 'dueDate', label: 'Due Date', type: 'date' },
  { name: 'deliveryMonth', label: 'Month', type: 'text' }
];
```

Adjust the assigned column name based on department:
- design → `assignedDesign`
- editorial → `assignedEditorial`
- video → `assignedVideo`
- agri4all → `assignedAgri4all`
- social-media → `assignedSocialMedia`

## Radial Menu Actions

Include status advance actions based on the workflow chain:

```javascript
var radialActions = [
  { id: 'advance', label: 'Advance Status', action: function(row) {
    var nextStatus = window.DELIVERABLE_WORKFLOWS.getNextStatus(row.type, row.status);
    if (nextStatus) {
      fetch(window.API_URL + '/deliverables/' + row.id, {
        method: 'PATCH',
        headers: Object.assign({}, window.getAuthHeaders(), {'Content-Type': 'application/json'}),
        body: JSON.stringify({ status: nextStatus })
      }).then(function() { loadData(); });
    }
  }},
  { id: 'view', label: 'View Details', action: function(row) { /* detail modal */ } }
];
```

Add branch status actions if applicable (e.g., "Send to Design Changes", "Request Client Changes").

## Output

Report: files created/modified, tab name, statuses being filtered, and how to navigate to it.
