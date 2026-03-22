# UI Overhaul Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restructure the ProAgri CRM UI with a wider sidebar, department sub-menus, 70/30 dashboard layouts, a reusable sheet component, and a half-moon radial action menu.

**Architecture:** Shared components (`proagri-sheet` and `radial-menu`) provide consistent table rendering and row-level actions across all pages. Department sub-menus follow the existing messaging sidebar pattern (hide main sidebar, show department sidebar). The dashboard layout uses a flex 7/3 split with both panels in cards.

**Tech Stack:** Vanilla HTML/CSS/JavaScript (no framework, no build system), Express.js backend, PostgreSQL

**Spec:** `docs/superpowers/specs/2026-03-22-ui-overhaul-design.md`

---

## File Structure

### New Files
| File | Responsibility |
|------|---------------|
| `ui/js/proagri-sheet.js` | Reusable sheet/table component with sorting, empty/loading states, and radial trigger icon per row |
| `ui/css/proagri-sheet.css` | Sheet styling: header, rows, status badges, sort indicators |
| `ui/js/radial-menu.js` | Half-moon radial menu: hover trigger, fade effect, bezier lines, staggered items |
| `ui/css/radial-menu.css` | Radial menu styling: fade overlay, item pills, bezier SVG, animations |

### Modified Files
| File | Changes |
|------|---------|
| `ui/css/styles.css:21` | Change `--sidebar-width` from `200px` to `260px`, update responsive breakpoints |
| `ui/js/app.js:336-553` | Add department sub-menu activation/deactivation, update `transitionToPage` |
| `index.html:15-21,138-149,161-176` | Add department sidebar markup, add new CSS/JS script tags |
| `departments/js/department-shared.js:63-170` | Replace stats cards + table with 70/30 split layout using `renderSheet()` |
| `departments/css/department-shared.css:24-42,71-105` | Remove stat card + old table styles, add split layout styles |
| `clients/js/client-list.js:27-107,158-263` | Remove add button/form, use `renderSheet()` |
| `clients/css/client-list.css:57-72,148-154` | Remove add button + form styles |

---

### Task 1: Widen Sidebar to 260px

**Files:**
- Modify: `ui/css/styles.css:21-23` (variable declaration)
- Modify: `ui/css/styles.css:733-890` (responsive breakpoints)

- [ ] **Step 1: Change --sidebar-width variable**

In `ui/css/styles.css`, line 21, change:
```css
--sidebar-width: 200px;
```
to:
```css
--sidebar-width: 260px;
```

- [ ] **Step 2: Update responsive breakpoints**

Update the media query tier values proportionally in `ui/css/styles.css`:
- Line ~735 (1440px): `--sidebar-width: 250px;` (was 190px)
- Line ~742 (1280px): `--sidebar-width: 240px;` (was 180px)
- Line ~752 (1024px): `--sidebar-width: 220px;` (was 170px)
- Line ~769 (900px): `--sidebar-width: 200px;` (was 160px)
- 768px and below: no change (already collapses to icon-only)

- [ ] **Step 3: Verify in browser**

Open the app in the browser. Confirm the sidebar is wider and matches the messaging sidebar width. Check at different viewport sizes that responsive behavior still works.

- [ ] **Step 4: Commit**

```bash
git add ui/css/styles.css
git commit -m "feat: widen sidebar to 260px to match messaging sidebar"
```

---

### Task 2: Create Radial Menu Component

**Files:**
- Create: `ui/css/radial-menu.css`
- Create: `ui/js/radial-menu.js`

- [ ] **Step 1: Create radial-menu.css**

Create `ui/css/radial-menu.css`:
```css
/* ===== Radial Menu ===== */

/* Fade overlay — applied to the sheet container when radial is active */
.radial-active .proagri-sheet-row {
  opacity: 0.15;
  transition: opacity 0.2s ease;
  pointer-events: none;
}

.radial-active .proagri-sheet-header {
  opacity: 0.15;
  transition: opacity 0.2s ease;
  pointer-events: none;
}

.radial-active .proagri-sheet-row.radial-row-active {
  opacity: 1;
  pointer-events: auto;
}

/* Trigger icon */
.radial-trigger {
  width: 26px;
  height: 26px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  background: rgba(128, 128, 128, 0.1);
  border: 1px solid transparent;
  border-radius: 6px;
  color: var(--text-muted);
  font-size: 14px;
  cursor: pointer;
  transition: all 0.2s ease;
  position: relative;
  z-index: 2;
}

.radial-trigger:hover {
  background: rgba(245, 166, 35, 0.2);
  border-color: rgba(245, 166, 35, 0.4);
  color: var(--color-accent-light);
}

/* Trigger shifts left when active */
.radial-trigger.radial-trigger-active {
  background: rgba(245, 166, 35, 0.25);
  border-color: rgba(245, 166, 35, 0.5);
  color: var(--color-accent-light);
  transform: translateX(-180px);
  transition: transform 0.25s ease, background 0.2s, border-color 0.2s, color 0.2s;
}

/* Radial container */
.radial-container {
  position: absolute;
  right: 8px;
  top: 50%;
  transform: translateY(-50%);
  z-index: 10;
  pointer-events: none;
}

.radial-container.radial-visible {
  pointer-events: auto;
}

/* SVG bezier lines */
.radial-lines {
  position: absolute;
  top: 50%;
  right: 0;
  transform: translateY(-50%);
  pointer-events: none;
}

/* Radial action items */
.radial-item {
  position: absolute;
  width: 110px;
  height: 30px;
  background: rgba(128, 128, 128, 0.12);
  border: 1px solid rgba(128, 128, 128, 0.2);
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 11px;
  color: var(--text-secondary);
  cursor: pointer;
  opacity: 0;
  transform: translateX(-10px);
  transition: opacity 0.15s ease, transform 0.15s ease, background 0.15s ease, border-color 0.15s ease;
  backdrop-filter: blur(4px);
  white-space: nowrap;
}

.radial-item.radial-item-visible {
  opacity: 1;
  transform: translateX(0);
}

.radial-item:hover {
  background: rgba(245, 166, 35, 0.15);
  border-color: rgba(245, 166, 35, 0.4);
  color: var(--color-accent-light);
}

.radial-item.radial-item-highlight {
  background: rgba(52, 152, 219, 0.15);
  border-color: rgba(52, 152, 219, 0.3);
  color: #3498db;
}

.radial-item.radial-item-highlight:hover {
  background: rgba(52, 152, 219, 0.25);
  border-color: rgba(52, 152, 219, 0.5);
}
```

- [ ] **Step 2: Create radial-menu.js**

Create `ui/js/radial-menu.js`. Use `textContent` for all text rendering (never `innerHTML`):

```javascript
/**
 * Radial Menu Component
 *
 * Usage:
 *   var radial = new RadialMenu(sheetContainer, {
 *     actions: [
 *       { id: 'dashboard', label: 'View Dashboard', action: function(rowData) {} },
 *       { id: 'status', label: 'Change Status', action: function(rowData) {} },
 *       { id: 'next', label: 'Next Step', action: function(rowData) {}, highlight: true },
 *     ]
 *   });
 *   radial.attachToRow(rowElement, rowData);
 */
(function() {
  'use strict';

  function RadialMenu(sheetContainer, config) {
    this.sheetContainer = sheetContainer;
    this.actions = config.actions || [];
    this.activeRow = null;
    this.radialEl = null;
    this._onMouseLeave = null;
  }

  RadialMenu.prototype.attachToRow = function(rowEl, rowData) {
    var self = this;
    var trigger = rowEl.querySelector('.radial-trigger');
    if (!trigger) return;

    trigger.addEventListener('mouseenter', function() {
      self.open(rowEl, rowData);
    });
  };

  RadialMenu.prototype.open = function(rowEl, rowData) {
    if (this.activeRow === rowEl) return;
    this.close();

    var self = this;
    this.activeRow = rowEl;

    // Add active class to sheet container (fades other rows)
    this.sheetContainer.classList.add('radial-active');
    rowEl.classList.add('radial-row-active');

    // Activate trigger icon (shifts left)
    var trigger = rowEl.querySelector('.radial-trigger');
    if (trigger) trigger.classList.add('radial-trigger-active');

    // Create radial container
    this.radialEl = document.createElement('div');
    this.radialEl.className = 'radial-container';
    rowEl.style.position = 'relative';
    rowEl.appendChild(this.radialEl);

    // Calculate positions and clamp within card bounds
    var actions = this.actions;
    var totalItems = actions.length;
    var arcSpread = Math.min(totalItems * 40, 200);
    var startY = -(arcSpread / 2);
    var itemSpacing = totalItems > 1 ? arcSpread / (totalItems - 1) : 0;

    // Clamp: check if radial would go outside the sheet container
    var sheetRect = this.sheetContainer.getBoundingClientRect();
    var rowRect = rowEl.getBoundingClientRect();
    var rowCenterY = rowRect.top + rowRect.height / 2;
    var topEdge = rowCenterY + startY - 15;
    var bottomEdge = rowCenterY + startY + arcSpread + 45;

    var clampOffset = 0;
    if (topEdge < sheetRect.top) {
      clampOffset = sheetRect.top - topEdge;
    } else if (bottomEdge > sheetRect.bottom) {
      clampOffset = sheetRect.bottom - bottomEdge;
    }

    // Create SVG for bezier lines
    var svgNS = 'http://www.w3.org/2000/svg';
    var svgWidth = 200;
    var svgHeight = arcSpread + 60;
    var svg = document.createElementNS(svgNS, 'svg');
    svg.setAttribute('width', svgWidth);
    svg.setAttribute('height', svgHeight);
    svg.setAttribute('viewBox', '0 0 ' + svgWidth + ' ' + svgHeight);
    svg.className.baseVal = 'radial-lines';
    svg.style.right = '0';
    svg.style.top = (startY + clampOffset - 15) + 'px';
    svg.style.position = 'absolute';
    svg.style.pointerEvents = 'none';

    var originX = 20;
    var originY = -startY + 15 - clampOffset;

    // Origin dot
    var dot = document.createElementNS(svgNS, 'circle');
    dot.setAttribute('cx', originX);
    dot.setAttribute('cy', originY);
    dot.setAttribute('r', 3);
    dot.setAttribute('fill', 'rgba(245, 166, 35, 0.4)');
    svg.appendChild(dot);

    // Create items and bezier paths
    actions.forEach(function(action, index) {
      var itemY = startY + (index * itemSpacing) + clampOffset;
      var arcOffset = self._arcOffset(index, totalItems);

      // Bezier path
      var endX = svgWidth - 55;
      var endY = 15 + (index * itemSpacing);
      var cp1x = originX + 50;
      var cp1y = originY;
      var cp2x = endX - 40;
      var cp2y = endY;

      var path = document.createElementNS(svgNS, 'path');
      path.setAttribute('d', 'M ' + originX + ',' + originY +
        ' C ' + cp1x + ',' + cp1y + ' ' + cp2x + ',' + cp2y + ' ' + endX + ',' + endY);
      path.setAttribute('stroke', 'rgba(255, 255, 255, 0.12)');
      path.setAttribute('stroke-width', '1.5');
      path.setAttribute('fill', 'none');
      svg.appendChild(path);

      // Radial item
      var item = document.createElement('div');
      item.className = 'radial-item' + (action.highlight ? ' radial-item-highlight' : '');
      item.textContent = action.label;
      item.style.right = '8px';
      item.style.top = (itemY - 15) + 'px';
      item.style.marginLeft = arcOffset + 'px';
      item.style.position = 'absolute';

      // Stagger animation
      setTimeout(function() {
        item.classList.add('radial-item-visible');
      }, 50 + (index * 50));

      item.addEventListener('click', function(e) {
        e.stopPropagation();
        self.close();
        if (action.action) action.action(rowData);
      });

      self.radialEl.appendChild(item);
    });

    this.radialEl.appendChild(svg);

    // Show after a frame
    requestAnimationFrame(function() {
      self.radialEl.classList.add('radial-visible');
    });

    // Close on mouse leave from the row area
    this._onMouseLeave = function(e) {
      var relatedTarget = e.relatedTarget;
      if (relatedTarget && (rowEl.contains(relatedTarget) || (self.radialEl && self.radialEl.contains(relatedTarget)))) {
        return;
      }
      self.close();
    };
    rowEl.addEventListener('mouseleave', this._onMouseLeave);
  };

  RadialMenu.prototype._arcOffset = function(index, total) {
    if (total <= 1) return 0;
    var mid = (total - 1) / 2;
    var distance = Math.abs(index - mid);
    var maxOffset = 12;
    return (1 - (distance / mid)) * maxOffset;
  };

  RadialMenu.prototype.close = function() {
    if (!this.activeRow) return;

    this.sheetContainer.classList.remove('radial-active');
    this.activeRow.classList.remove('radial-row-active');

    var trigger = this.activeRow.querySelector('.radial-trigger');
    if (trigger) trigger.classList.remove('radial-trigger-active');

    if (this.radialEl && this.radialEl.parentNode) {
      this.radialEl.parentNode.removeChild(this.radialEl);
    }

    if (this._onMouseLeave) {
      this.activeRow.removeEventListener('mouseleave', this._onMouseLeave);
    }

    this.radialEl = null;
    this.activeRow = null;
    this._onMouseLeave = null;
  };

  window.RadialMenu = RadialMenu;
})();
```

- [ ] **Step 3: Verify files exist**

```bash
ls ui/js/radial-menu.js ui/css/radial-menu.css
```
Expected: both files listed.

- [ ] **Step 4: Commit**

```bash
git add ui/js/radial-menu.js ui/css/radial-menu.css
git commit -m "feat: add half-moon radial menu component"
```

---

### Task 3: Create Reusable Sheet Component

**Files:**
- Create: `ui/css/proagri-sheet.css`
- Create: `ui/js/proagri-sheet.js`

- [ ] **Step 1: Create proagri-sheet.css**

Create `ui/css/proagri-sheet.css`:
```css
/* ===== ProAgri Sheet Component ===== */

.proagri-sheet {
  width: 100%;
  border-collapse: collapse;
}

.proagri-sheet-header {
  display: flex;
  padding: 8px 14px;
  border-bottom: 1px solid rgba(128, 128, 128, 0.15);
  transition: opacity 0.2s ease;
}

.proagri-sheet-header-cell {
  font-size: 10px;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  color: var(--text-muted);
  font-weight: 600;
  flex: 1;
  cursor: default;
  display: flex;
  align-items: center;
  gap: 4px;
  user-select: none;
}

.proagri-sheet-header-cell.sortable {
  cursor: pointer;
}

.proagri-sheet-header-cell.sortable:hover {
  color: var(--text-secondary);
}

.proagri-sheet-sort-icon {
  font-size: 10px;
  opacity: 0.5;
}

.proagri-sheet-sort-icon.sort-active {
  opacity: 1;
  color: var(--color-accent-light);
}

.proagri-sheet-header-cell.radial-col {
  flex: 0 0 40px;
}

/* Rows */
.proagri-sheet-row {
  display: flex;
  padding: 12px 14px;
  border-bottom: 1px solid rgba(128, 128, 128, 0.08);
  align-items: center;
  transition: opacity 0.2s ease, background 0.15s ease;
  animation: sheetRowIn 0.25s ease both;
}

.proagri-sheet-row:hover {
  background: rgba(128, 128, 128, 0.05);
}

@keyframes sheetRowIn {
  from {
    opacity: 0;
    transform: translateY(6px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.proagri-sheet-cell {
  font-size: 12px;
  color: var(--text-secondary);
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.proagri-sheet-cell.cell-name {
  color: var(--text-primary);
  font-weight: 500;
}

.proagri-sheet-cell.radial-col {
  flex: 0 0 40px;
  text-align: right;
}

/* Status badges */
.proagri-sheet-status {
  display: inline-block;
  padding: 2px 10px;
  border-radius: 10px;
  font-size: 10px;
  font-weight: 500;
  text-transform: capitalize;
}

.proagri-sheet-status-pending {
  background: rgba(245, 166, 35, 0.15);
  color: #f5a623;
}

.proagri-sheet-status-in_progress {
  background: rgba(52, 152, 219, 0.15);
  color: #3498db;
}

.proagri-sheet-status-completed,
.proagri-sheet-status-done {
  background: rgba(39, 174, 96, 0.15);
  color: #27ae60;
}

.proagri-sheet-status-overdue {
  background: rgba(231, 76, 60, 0.15);
  color: #e74c3c;
}

.proagri-sheet-status-active {
  background: rgba(39, 174, 96, 0.15);
  color: #27ae60;
}

.proagri-sheet-status-inactive {
  background: rgba(128, 128, 128, 0.15);
  color: #888;
}

.proagri-sheet-status-lead {
  background: rgba(245, 166, 35, 0.15);
  color: #f5a623;
}

/* Empty and loading states */
.proagri-sheet-empty,
.proagri-sheet-loading {
  padding: 40px 20px;
  text-align: center;
  color: var(--text-muted);
  font-size: 13px;
}

.proagri-sheet-loading::after {
  content: '';
  display: inline-block;
  width: 16px;
  height: 16px;
  border: 2px solid rgba(128, 128, 128, 0.2);
  border-top-color: var(--text-muted);
  border-radius: 50%;
  animation: sheetSpin 0.6s linear infinite;
  margin-left: 8px;
  vertical-align: middle;
}

@keyframes sheetSpin {
  to { transform: rotate(360deg); }
}
```

- [ ] **Step 2: Create proagri-sheet.js**

Create `ui/js/proagri-sheet.js`. Use `textContent` for all text rendering (never use innerHTML):

```javascript
/**
 * ProAgri Sheet Component
 *
 * Usage:
 *   window.renderSheet(container, {
 *     columns: [
 *       { key: 'name', label: 'Client', sortable: true, isName: true },
 *       { key: 'status', label: 'Status', sortable: true, type: 'status' },
 *       { key: 'due_date', label: 'Due Date', sortable: true, type: 'date' },
 *     ],
 *     data: arrayOfObjects,
 *     radialActions: [ { id: 'x', label: 'X', action: fn, highlight: bool } ],
 *   });
 */
(function() {
  'use strict';

  var STATUS_ORDER = {
    'pending': 0,
    'in_progress': 1,
    'in progress': 1,
    'completed': 2,
    'done': 2,
    'overdue': 3
  };

  function renderSheet(container, config) {
    var columns = config.columns || [];
    var data = config.data || null; // null = loading, [] = empty
    var radialActions = config.radialActions || [];

    // Clear container
    while (container.firstChild) {
      container.removeChild(container.firstChild);
    }

    var sheetWrap = document.createElement('div');
    sheetWrap.className = 'proagri-sheet-wrap';

    // Loading state
    if (data === null) {
      var loadingEl = document.createElement('div');
      loadingEl.className = 'proagri-sheet-loading';
      loadingEl.textContent = 'Loading';
      sheetWrap.appendChild(loadingEl);
      container.appendChild(sheetWrap);
      return { update: function(newData) { renderSheet(container, Object.assign({}, config, { data: newData })); } };
    }

    // Empty state
    if (data.length === 0) {
      var emptyEl = document.createElement('div');
      emptyEl.className = 'proagri-sheet-empty';
      emptyEl.textContent = 'No items to display';
      sheetWrap.appendChild(emptyEl);
      container.appendChild(sheetWrap);
      return { update: function(newData) { renderSheet(container, Object.assign({}, config, { data: newData })); } };
    }

    // Sort state
    var sortKey = config._sortKey || null;
    var sortDir = config._sortDir || 'asc';

    // Sort data
    var sortedData = data.slice();
    if (sortKey) {
      var sortCol = columns.find(function(c) { return c.key === sortKey; });
      sortedData.sort(function(a, b) {
        var va = a[sortKey];
        var vb = b[sortKey];

        if (sortCol && sortCol.type === 'date') {
          va = va ? new Date(va).getTime() : 0;
          vb = vb ? new Date(vb).getTime() : 0;
        } else if (sortCol && sortCol.type === 'status') {
          va = STATUS_ORDER[(va || '').toLowerCase().replace(/\s+/g, '_')] || 99;
          vb = STATUS_ORDER[(vb || '').toLowerCase().replace(/\s+/g, '_')] || 99;
        } else {
          va = (va || '').toString().toLowerCase();
          vb = (vb || '').toString().toLowerCase();
        }

        if (va < vb) return sortDir === 'asc' ? -1 : 1;
        if (va > vb) return sortDir === 'asc' ? 1 : -1;
        return 0;
      });
    }

    // Header row
    var headerRow = document.createElement('div');
    headerRow.className = 'proagri-sheet-header';

    columns.forEach(function(col) {
      var th = document.createElement('div');
      th.className = 'proagri-sheet-header-cell' + (col.sortable ? ' sortable' : '');
      th.textContent = col.label;

      if (col.sortable) {
        var sortIcon = document.createElement('span');
        sortIcon.className = 'proagri-sheet-sort-icon' + (sortKey === col.key ? ' sort-active' : '');
        sortIcon.textContent = sortKey === col.key ? (sortDir === 'asc' ? '\u25B2' : '\u25BC') : '\u25B2';
        th.appendChild(sortIcon);

        th.addEventListener('click', function() {
          var newDir = 'asc';
          if (sortKey === col.key) {
            newDir = sortDir === 'asc' ? 'desc' : 'asc';
          }
          renderSheet(container, Object.assign({}, config, { _sortKey: col.key, _sortDir: newDir }));
        });
      }

      headerRow.appendChild(th);
    });

    // Radial trigger column header (empty)
    if (radialActions.length > 0) {
      var radialHeader = document.createElement('div');
      radialHeader.className = 'proagri-sheet-header-cell radial-col';
      headerRow.appendChild(radialHeader);
    }

    sheetWrap.appendChild(headerRow);

    // Init radial menu if actions provided
    var radialMenu = null;
    if (radialActions.length > 0 && window.RadialMenu) {
      radialMenu = new RadialMenu(sheetWrap, { actions: radialActions });
    }

    // Data rows
    sortedData.forEach(function(rowData, index) {
      var row = document.createElement('div');
      row.className = 'proagri-sheet-row';
      row.style.animationDelay = (index * 0.03) + 's';

      columns.forEach(function(col) {
        var cell = document.createElement('div');
        cell.className = 'proagri-sheet-cell' + (col.isName ? ' cell-name' : '');

        var value = rowData[col.key];

        if (col.type === 'status') {
          var badge = document.createElement('span');
          var statusKey = (value || 'pending').toLowerCase().replace(/\s+/g, '_');
          badge.className = 'proagri-sheet-status proagri-sheet-status-' + statusKey;
          badge.textContent = formatStatus(value);
          cell.appendChild(badge);
        } else if (col.type === 'date') {
          cell.textContent = value ? new Date(value).toLocaleDateString() : '-';
        } else {
          cell.textContent = value || '-';
        }

        row.appendChild(cell);
      });

      // Radial trigger
      if (radialActions.length > 0) {
        var triggerCell = document.createElement('div');
        triggerCell.className = 'proagri-sheet-cell radial-col';

        var trigger = document.createElement('span');
        trigger.className = 'radial-trigger';
        trigger.textContent = '\u22EF'; // horizontal ellipsis character
        triggerCell.appendChild(trigger);
        row.appendChild(triggerCell);

        if (radialMenu) {
          radialMenu.attachToRow(row, rowData);
        }
      }

      sheetWrap.appendChild(row);
    });

    container.appendChild(sheetWrap);

    return {
      update: function(newData) {
        renderSheet(container, Object.assign({}, config, { data: newData }));
      }
    };
  }

  function formatStatus(status) {
    if (!status) return 'Pending';
    return status.split(/[_\s]+/).map(function(w) {
      return w.charAt(0).toUpperCase() + w.slice(1).toLowerCase();
    }).join(' ');
  }

  window.renderSheet = renderSheet;
})();
```

- [ ] **Step 3: Verify files exist**

```bash
ls ui/js/proagri-sheet.js ui/css/proagri-sheet.css
```
Expected: both files listed.

- [ ] **Step 4: Commit**

```bash
git add ui/js/proagri-sheet.js ui/css/proagri-sheet.css
git commit -m "feat: add reusable proagri-sheet table component with sorting"
```

---

### Task 4: Add New Script/CSS Tags to index.html

**Files:**
- Modify: `index.html:15-21` (CSS links)
- Modify: `index.html:161-176` (script tags)

- [ ] **Step 1: Add CSS links**

In `index.html`, after line 15 (`departments/css/department-shared.css`), add:
```html
  <link rel="stylesheet" href="ui/css/proagri-sheet.css">
  <link rel="stylesheet" href="ui/css/radial-menu.css">
```

- [ ] **Step 2: Add script tags**

In `index.html`, after line 168 (`clients/js/client-list.js`) and before line 169 (`departments/js/department-shared.js`), add:
```html
  <script src="ui/js/radial-menu.js"></script>
  <script src="ui/js/proagri-sheet.js"></script>
```

Note: `radial-menu.js` must load before `proagri-sheet.js` (sheet depends on RadialMenu), and both must load before `department-shared.js` and `client-list.js`.

- [ ] **Step 3: Verify in browser**

Open the app, check the browser console for any 404 errors on the new files. All four new files should load without errors.

- [ ] **Step 4: Commit**

```bash
git add index.html
git commit -m "feat: add proagri-sheet and radial-menu script/css to index.html"
```

---

### Task 5: Add Department Sidebar Markup and Logic

**Files:**
- Modify: `index.html:138-149` (add department sidebar after messaging sidebar)
- Modify: `ui/js/app.js:336-553` (add department sub-menu activation/deactivation)
- Modify: `ui/css/styles.css` (add department sidebar styles)

- [ ] **Step 1: Add department sidebar markup to index.html**

In `index.html`, after the messaging sidebar closing tag (after line 149 `</aside>`), add:
```html
    <aside class="dept-sidebar" id="deptSidebar" style="display:none;">
      <div class="msg-sidebar-header">
        <button class="msg-back-btn" id="deptBackBtn" aria-label="Back to menu">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20v-2z"/></svg>
        </button>
        <span class="msg-sidebar-title" id="deptSidebarTitle">Department</span>
      </div>
      <div class="dept-sidebar-content" id="deptSidebarContent">
        <div class="dept-sidebar-items">
          <a class="dept-sidebar-item active" data-dept-view="dashboard" tabindex="0">
            <span class="nav-icon"><svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M3 13h8V3H3v10zm0 8h8v-6H3v6zm10 0h8V11h-8v10zm0-18v6h8V3h-8z"/></svg></span>
            <span class="nav-label">Dashboard</span>
          </a>
          <a class="dept-sidebar-item" data-dept-view="overview" tabindex="0">
            <span class="nav-icon"><svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-5 14H7v-2h7v2zm3-4H7v-2h10v2zm0-4H7V7h10v2z"/></svg></span>
            <span class="nav-label">Overview</span>
          </a>
        </div>
      </div>
    </aside>
```

- [ ] **Step 2: Add department sidebar CSS**

In `ui/css/styles.css`, add after the sidebar section (before the media queries):

```css
/* ===== Department Sidebar ===== */
.dept-sidebar {
  width: var(--sidebar-width);
  background: var(--color-secondary);
  display: flex;
  flex-direction: column;
  padding: 16px 0 16px 12px;
  overflow-y: auto;
  flex-shrink: 0;
  transition: width var(--sidebar-transition);
}

.dept-sidebar-items {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 8px 12px 0 0;
}

.dept-sidebar-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 12px;
  border-radius: 10px;
  color: var(--text-secondary);
  font-size: 13px;
  cursor: pointer;
  text-decoration: none;
  transition: background 0.15s ease, color 0.15s ease;
}

.dept-sidebar-item:hover {
  background: rgba(128, 128, 128, 0.1);
  color: var(--text-primary);
}

.dept-sidebar-item.active {
  background: var(--color-accent-light);
  color: #fff;
}
```

- [ ] **Step 3: Add activation/deactivation logic in app.js**

In `ui/js/app.js`, add department sidebar functions. Insert before the `transitionToPage` function (before line 362):

```javascript
  // Department sidebar activation
  var deptPages = ['production', 'design', 'editorial', 'video', 'agri4all', 'social-media'];
  var deptNames = {
    'production': 'Production',
    'design': 'Design',
    'editorial': 'Editorial',
    'video': 'Video',
    'agri4all': 'Agri4All',
    'social-media': 'Social Media'
  };
  var currentDeptPage = null;

  function activateDeptSidebar(page) {
    var mainSidebar = document.getElementById('sidebar');
    var deptSidebar = document.getElementById('deptSidebar');
    var deptTitle = document.getElementById('deptSidebarTitle');

    if (mainSidebar) mainSidebar.style.display = 'none';
    if (deptSidebar) deptSidebar.style.display = 'flex';
    if (deptTitle) deptTitle.textContent = deptNames[page] || 'Department';

    currentDeptPage = page;

    var backBtn = document.getElementById('deptBackBtn');
    if (backBtn) {
      backBtn.onclick = function() {
        deactivateDeptSidebar();
        // Navigate back to my-view
        var myViewItem = document.querySelector('.nav-item[data-page="my-view"]');
        if (myViewItem) myViewItem.click();
      };
    }
  }

  function deactivateDeptSidebar() {
    var mainSidebar = document.getElementById('sidebar');
    var deptSidebar = document.getElementById('deptSidebar');

    if (mainSidebar) mainSidebar.style.display = '';
    if (deptSidebar) deptSidebar.style.display = 'none';

    currentDeptPage = null;
  }
```

- [ ] **Step 4: Update transitionToPage cleanup logic**

In `ui/js/app.js`, inside the `transitionToPage` function, after the messaging cleanup block (lines 366-369), add:

```javascript
    // Cleanup previous page if it was a department
    if (deptPages.indexOf(currentPage) !== -1 && deptPages.indexOf(page) === -1) {
      deactivateDeptSidebar();
    }
```

- [ ] **Step 5: Add activateDeptSidebar calls to department page blocks**

Inside `handleExitComplete`, add `activateDeptSidebar` call at the start of each department page block. For each of the 6 departments, add the call as the first line inside the `if` block:

For `production` (line ~456): add `activateDeptSidebar('production');` before the renderProductionPage call.
For `design` (line ~467): add `activateDeptSidebar('design');`
For `editorial` (line ~478): add `activateDeptSidebar('editorial');`
For `video` (line ~489): add `activateDeptSidebar('video');`
For `agri4all` (line ~500): add `activateDeptSidebar('agri4all');`
For `social-media` (line ~511): add `activateDeptSidebar('social-media');`

- [ ] **Step 6: Verify in browser**

Click a department nav item. Confirm:
- Main sidebar hides, department sidebar appears with correct name
- "Dashboard" and "Overview" items are shown
- Back button returns to main sidebar and navigates to My View
- Clicking Messaging while in a department sidebar closes it and opens messaging sidebar

- [ ] **Step 7: Commit**

```bash
git add index.html ui/js/app.js ui/css/styles.css
git commit -m "feat: add department sub-menu sidebars with back navigation"
```

---

### Task 6: Update Department Dashboards to 70/30 Split Layout

**Files:**
- Modify: `departments/js/department-shared.js:63-170`
- Modify: `departments/css/department-shared.css:24-42,71-105`

- [ ] **Step 1: Update department-shared.css**

In `departments/css/department-shared.css`:

Remove these style blocks:
- `.dept-stats` (lines 24-29)
- `.dept-stat-card` and related styles (lines 31-42)
- `.dept-table-wrap` (lines 71-73)
- `.dept-table` (line 75)
- `.dept-table thead th` (lines 80-89)
- `.dept-table tbody tr` (lines 91-98)
- `.dept-table tbody td` (lines 100-105)
- Any `.dept-stat-*` color variant styles
- Any responsive overrides for the stat cards

Add the new split layout styles:
```css
/* ===== Department Split Layout ===== */
.dept-split {
  display: flex;
  gap: 16px;
  flex: 1;
}

.dept-split-left {
  flex: 7;
  background: var(--color-secondary);
  border-radius: 20px;
  padding: 20px;
  overflow-y: auto;
}

.dept-split-right {
  flex: 3;
  background: var(--color-secondary);
  border-radius: 20px;
  padding: 20px;
  overflow-y: auto;
}

.dept-details-title {
  font-size: 14px;
  font-weight: 600;
  color: var(--text-primary);
  margin-bottom: 12px;
}

.dept-details-empty {
  font-size: 12px;
  color: var(--text-muted);
}

@media (max-width: 1024px) {
  .dept-split {
    flex-direction: column;
  }
  .dept-split-left,
  .dept-split-right {
    flex: none;
  }
}
```

- [ ] **Step 2: Rewrite renderDepartmentContent**

In `departments/js/department-shared.js`, replace the `renderDepartmentContent` function (lines 63-170) with:

```javascript
function renderDepartmentContent(section, dept, deliverables) {
  // Header
  var header = document.createElement('div');
  header.className = 'dept-header';

  var title = document.createElement('h2');
  title.textContent = dept.name || 'Department';
  header.appendChild(title);

  if (dept.description) {
    var desc = document.createElement('p');
    desc.className = 'dept-description';
    desc.textContent = dept.description;
    header.appendChild(desc);
  }

  section.appendChild(header);

  // Split layout
  var split = document.createElement('div');
  split.className = 'dept-split';

  // Left panel - main sheet
  var leftPanel = document.createElement('div');
  leftPanel.className = 'dept-split-left';

  if (window.renderSheet) {
    window.renderSheet(leftPanel, {
      columns: [
        { key: 'title', label: 'Title', sortable: true, isName: true },
        { key: 'client_name', label: 'Client', sortable: true },
        { key: 'status', label: 'Status', sortable: true, type: 'status' },
        { key: 'due_date', label: 'Due Date', sortable: true, type: 'date' }
      ],
      data: deliverables,
      radialActions: [
        { id: 'dashboard', label: 'View Dashboard', action: function(row) { console.log('View dashboard:', row); } },
        { id: 'status', label: 'Change Status', action: function(row) { console.log('Change status:', row); } },
        { id: 'next', label: 'Next Step', action: function(row) { console.log('Next step:', row); }, highlight: true }
      ]
    });
  }

  split.appendChild(leftPanel);

  // Right panel - details placeholder
  var rightPanel = document.createElement('div');
  rightPanel.className = 'dept-split-right';

  var detailsTitle = document.createElement('div');
  detailsTitle.className = 'dept-details-title';
  detailsTitle.textContent = 'Details';
  rightPanel.appendChild(detailsTitle);

  var detailsEmpty = document.createElement('div');
  detailsEmpty.className = 'dept-details-empty';
  detailsEmpty.textContent = 'Select an item to view details';
  rightPanel.appendChild(detailsEmpty);

  split.appendChild(rightPanel);
  section.appendChild(split);
}
```

- [ ] **Step 3: Remove computeStats function**

Delete the `computeStats` function (lines 172-181) from `department-shared.js`. The `formatStatus` function can also be removed since `proagri-sheet.js` has its own.

- [ ] **Step 4: Verify in browser**

Navigate to any department page. Confirm:
- No summary cards visible
- 70/30 split layout with left sheet and right details panel
- Column sorting works
- Radial menu opens on hover
- Below 1024px viewport, cards stack vertically

- [ ] **Step 5: Commit**

```bash
git add departments/js/department-shared.js departments/css/department-shared.css
git commit -m "feat: replace department dashboard with 70/30 split layout using shared sheet"
```

---

### Task 7: Clean Up Clients Page

**Files:**
- Modify: `clients/js/client-list.js:17,27-263`
- Modify: `clients/css/client-list.css:57-72,75-114,148-154`

- [ ] **Step 1: Rewrite client-list.js**

Replace the contents of `clients/js/client-list.js` with:

```javascript
var CLIENT_API_URL = 'http://localhost:3001/api';

window.renderClientListPage = function(container) {
  while (container.firstChild) {
    container.removeChild(container.firstChild);
  }

  container.style.display = 'block';
  container.style.alignItems = '';
  container.style.justifyContent = '';

  var section = document.createElement('div');
  section.className = 'client-section';

  var allClients = [];
  var searchTerm = '';

  function authHeaders(json) {
    var h = window.getAuthHeaders ? window.getAuthHeaders() : {};
    if (json) {
      h['Content-Type'] = 'application/json';
    }
    return h;
  }

  function renderContent() {
    while (section.firstChild) {
      section.removeChild(section.firstChild);
    }

    // Header
    var header = document.createElement('div');
    header.className = 'client-header';

    var titleWrap = document.createElement('div');
    titleWrap.style.display = 'flex';
    titleWrap.style.alignItems = 'center';

    var title = document.createElement('h2');
    title.textContent = 'Clients';
    titleWrap.appendChild(title);

    var count = document.createElement('span');
    count.className = 'client-count';
    count.textContent = allClients.length;
    titleWrap.appendChild(count);

    header.appendChild(titleWrap);

    var headerActions = document.createElement('div');
    headerActions.className = 'client-header-actions';

    var searchInput = document.createElement('input');
    searchInput.type = 'text';
    searchInput.className = 'client-search';
    searchInput.placeholder = 'Search clients...';
    searchInput.value = searchTerm;
    searchInput.addEventListener('input', function() {
      searchTerm = searchInput.value;
      renderContent();
    });
    headerActions.appendChild(searchInput);

    header.appendChild(headerActions);
    section.appendChild(header);

    // Sheet
    var filtered = getFilteredClients();
    var sheetContainer = document.createElement('div');
    sheetContainer.className = 'client-sheet-container';

    if (window.renderSheet) {
      window.renderSheet(sheetContainer, {
        columns: [
          { key: 'name', label: 'Name', sortable: true, isName: true },
          { key: 'contact_person', label: 'Contact Person', sortable: true },
          { key: 'email', label: 'Email', sortable: true },
          { key: 'phone', label: 'Phone', sortable: true },
          { key: 'status', label: 'Status', sortable: true, type: 'status' }
        ],
        data: filtered,
        radialActions: [
          { id: 'dashboard', label: 'View Dashboard', action: function(row) { console.log('View client:', row); } },
          { id: 'status', label: 'Change Status', action: function(row) { console.log('Change status:', row); } }
        ]
      });
    }

    section.appendChild(sheetContainer);
  }

  function getFilteredClients() {
    if (!searchTerm) return allClients;
    var term = searchTerm.toLowerCase();
    return allClients.filter(function(c) {
      return (c.name && c.name.toLowerCase().indexOf(term) !== -1) ||
        (c.contact_person && c.contact_person.toLowerCase().indexOf(term) !== -1) ||
        (c.email && c.email.toLowerCase().indexOf(term) !== -1) ||
        (c.phone && c.phone.toLowerCase().indexOf(term) !== -1) ||
        (c.status && c.status.toLowerCase().indexOf(term) !== -1);
    });
  }

  function loadClients() {
    var loading = document.createElement('div');
    loading.className = 'client-empty';
    loading.textContent = 'Loading clients...';
    while (section.firstChild) {
      section.removeChild(section.firstChild);
    }
    section.appendChild(loading);

    fetch(CLIENT_API_URL + '/clients', {
      headers: authHeaders(false)
    })
      .then(function(res) { return res.json(); })
      .then(function(data) {
        if (data.error) {
          section.removeChild(loading);
          var err = document.createElement('div');
          err.className = 'client-empty';
          err.textContent = data.error;
          section.appendChild(err);
          return;
        }
        allClients = Array.isArray(data) ? data : [];
        renderContent();
      })
      .catch(function() {
        section.removeChild(loading);
        var err = document.createElement('div');
        err.className = 'client-empty';
        err.textContent = 'Failed to load clients.';
        section.appendChild(err);
      });
  }

  container.appendChild(section);
  loadClients();
};
```

- [ ] **Step 2: Clean up client-list.css**

In `clients/css/client-list.css`, remove:
- `.client-btn-add` styles (lines 57-72)
- `.client-table-wrap`, `.client-table`, `.client-table thead th`, `.client-table tbody tr`, `.client-table tbody td`, `.client-cell-name` styles (lines 75-114)
- `.client-form`, `.client-form-title`, `.client-form-grid`, `.client-form-group`, `.client-form-input`, `.client-form-required`, `.client-form-actions`, `.client-btn-save`, `.client-btn-cancel` styles (lines 148+)
- `.client-status` badge styles (these are now handled by `proagri-sheet-status-*` classes)

Keep:
- `.client-section` styles
- `.client-header` and `.client-header-actions` styles
- `.client-search` styles
- `.client-count` styles
- `.client-empty` styles

- [ ] **Step 3: Verify in browser**

Navigate to the Clients page. Confirm:
- No "Add Client" button
- Clients displayed using the shared sheet component
- Search still works
- Column sorting works
- Radial menu appears on row hover
- Status badges look correct

- [ ] **Step 4: Commit**

```bash
git add clients/js/client-list.js clients/css/client-list.css
git commit -m "feat: remove add client button, migrate clients to shared sheet component"
```

---

### Task 8: Final Integration Testing

**Files:**
- No file changes — testing only

- [ ] **Step 1: Test sidebar width**

Verify the sidebar is 260px wide at full viewport. Resize browser to check responsive breakpoints.

- [ ] **Step 2: Test department sub-menus**

Click each of the 6 departments. For each:
- Department sidebar appears with correct title
- "Dashboard" and "Overview" items shown
- Back button returns to main sidebar
- Switching between departments updates sidebar title

- [ ] **Step 3: Test department dashboards**

For each department:
- No summary cards visible
- 70/30 split layout with sheets in left card, details placeholder in right card
- Column sorting works (click headers)
- Radial menu opens on hover with correct behavior (fade, shift, bezier lines)
- Radial closes when mouse leaves

- [ ] **Step 4: Test clients page**

- No add client button
- Sheet with sortable columns
- Search filters correctly
- Radial menu works

- [ ] **Step 5: Test messaging**

- Clicking Messaging from a department page closes dept sidebar, opens messaging sidebar
- Clicking a department from messaging closes messaging sidebar, opens dept sidebar
- Messaging functionality unchanged

- [ ] **Step 6: Test responsive behavior**

- Below 1024px: department split stacks vertically
- Below 768px: sidebar collapses to icon-only mode
- Department sidebar hides properly on mobile

- [ ] **Step 7: Test both themes**

Toggle between dark and light mode. Verify all new components look correct in both themes.

- [ ] **Step 8: Final commit if any fixes needed**

If any issues were found and fixed during testing, commit the fixes:
```bash
git add -A
git commit -m "fix: address integration issues from UI overhaul testing"
```
