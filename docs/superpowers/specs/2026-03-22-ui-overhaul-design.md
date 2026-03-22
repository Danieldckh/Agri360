# UI Overhaul: Sidebar, Department Dashboards, Sheet Component & Radial Menu

## Overview

Restructure the ProAgri CRM UI to create consistency across department dashboards, introduce a reusable sheet component with a half-moon radial action menu, widen the sidebar, add department sub-menus, and clean up the clients page.

## 1. Sidebar Width & Department Sub-Menus

### Sidebar Width
- Change `--sidebar-width` from `200px` to `260px` to match the messaging sidebar width
- Update responsive breakpoints accordingly (scale down proportionally at 1440px, 1280px, 1024px, 900px)
- Collapsed width (`--sidebar-collapsed: 60px`) remains unchanged

### Department Sub-Menus
- When clicking a department nav item (Production, Design, Editorial, Video, Agri for All, Social Media), a sub-menu panel slides in — same pattern as the messaging sidebar (`msg-sidebar`)
- Sub-menu structure:
  - Back button + department name header (matches messaging's `msg-sidebar-header` pattern)
  - Placeholder items: "Dashboard", "Overview"
  - Items will be populated with department-specific views over time
- The sub-menu replaces the main sidebar content (not an additional panel)
- Department sub-menu and messaging sidebar are independent — clicking Messaging while in a department sub-menu closes the department sub-menu and opens messaging sidebar (and vice versa)
- Back button returns to the main sidebar navigation
- Create a shared `dept-sidebar` component so all 6 departments use the same sub-menu pattern

### Files Modified
- `ui/css/styles.css` — sidebar width variable, responsive breakpoints
- `ui/js/app.js` — department sub-menu activation/deactivation logic (mirroring `activateMessagingSidebar`/`deactivateMessagingSidebar`)
- `index.html` — add department sub-menu markup (or generate dynamically in JS)

## 2. Department Dashboards: 70/30 Split Layout

### Remove Summary Cards
- Remove the `.dept-stats` grid (Total, Pending, In Progress, Completed cards) from all department dashboards
- Remove associated CSS in `departments/css/department-shared.css`

### New Layout
- Replace with a flex row: left card (flex: 7) + right card (flex: 3), with a gap of ~16px
- Both panels sit inside `.card` containers using existing card styling (`background: var(--color-secondary)`, `border-radius: 20px`, padding)
- Left card: contains the main data sheet (sortable table via the shared sheet component)
- Right card: placeholder info panel for now (title "Details" with empty state message like "Select an item to view details"). Content will be defined per department later.

### Responsive Behavior
- Below 1024px: stack vertically (left card full width on top, right card full width below)

### Files Modified
- `departments/js/department-shared.js` — replace `renderDepartmentPage` layout logic
- `departments/css/department-shared.css` — remove stat cards, add split layout styles

## 3. Reusable Sheet Component (proagri-sheet)

### Purpose
A shared, configurable table component that ensures every sheet/table across the app looks and behaves identically.

### New Files
- `ui/js/proagri-sheet.js` — sheet rendering and sorting logic
- `ui/css/proagri-sheet.css` — sheet styling

### API
```javascript
renderSheet(container, {
  columns: [
    { key: 'name', label: 'Client', sortable: true },
    { key: 'status', label: 'Status', sortable: true, type: 'status' },
    { key: 'due', label: 'Due Date', sortable: true, type: 'date' },
  ],
  data: [...],
  radialActions: [
    { id: 'dashboard', label: 'View Dashboard', action: (row) => {} },
    { id: 'status', label: 'Change Status', action: (row) => {} },
    { id: 'next', label: 'Next Step', action: (row) => {}, highlight: true },
  ],
})
```

### Styling
- Sits inside a `.card` container
- Header row: 10px uppercase font, muted color, letter-spacing 0.5px, bottom border
- Data rows: 12px font, 12px 14px padding, subtle bottom border, hover highlight
- Status badges: colored pills (pending=orange, in_progress=blue, completed=green, overdue=red)
- Sort indicator: small arrow icon in header of sorted column (▲/▼)
- Last column: radial trigger icon (⋯) — right-aligned, 26x26px, subtle background, border-radius 6px

### Sorting
- Click any sortable column header to toggle ascending → descending → ascending
- Sort is client-side on currently loaded data
- Date columns sort chronologically, status columns sort by predefined order (pending → in_progress → completed), text columns sort alphabetically
- Empty data state: show a centered muted message ("No items to display")
- Loading state: show a subtle loading indicator while data is being fetched

### Integration Points
- Department dashboards: replace `.dept-table` with `renderSheet()`
- Client list: replace `.client-table` with `renderSheet()`
- Future pages: use the same component

## 4. Half-Moon Radial Menu

### New Files
- `ui/js/radial-menu.js` — radial menu logic and animation
- `ui/css/radial-menu.css` — radial menu styling

### Trigger
- Each sheet row has a ⋯ icon on the far right
- **Hover** (not click) the icon to activate the radial

### Behavior (step by step)
1. User hovers the ⋯ icon on a row
2. The icon visually activates (accent color border/background)
3. All content in the dashboard (other rows, headers, surrounding UI within the card) fades to ~15% opacity via CSS transition (~0.2s)
4. The active row remains at full opacity
5. The ⋯ icon shifts/translates to the left (CSS transform), making room for the radial items to fan out to the right while staying within card bounds
6. Radial action items stagger into view in a half-moon arc pattern:
   - Items appear one by one with a staggered delay (~50ms each)
   - Each item is a pill/rounded-rect button (110px wide, 30px tall, subtle background + border)
   - Items arranged in an arc — slight left margin offset creates the curve
7. Curved bezier lines (SVG `<path>` elements) connect the shifted icon to each radial item — node-editor style
   - Lines are subtle (rgba white, ~12% opacity, 1.5px stroke)
   - Small dot at the origin point (icon position)
8. Hovering a radial item highlights it (brighter background/border)
9. Clicking a radial item executes its action callback
10. Moving the mouse away from the radial area → radial items fade out, icon shifts back, dashboard un-fades

### Configurable Actions
- Each page/sheet defines its own set of radial actions via the `radialActions` config
- Actions can vary based on the row's current status
- Starting with placeholder actions: "View Dashboard", "Change Status", "Next Step"
- More actions will be added incrementally per page

### Positioning
- The radial menu must stay within the card bounds — never overflow the card edge
- If the active row is near the top or bottom of the card, the arc clamps vertically (shifts up or down as needed) to stay visible — the arc direction does not flip
- The icon shifts left by enough pixels to accommodate the widest radial item + bezier line length

## 5. Clients Page Cleanup

### Remove "Add Client" Button
- Remove the `.client-btn-add` button from `.client-header-actions`
- Remove the inline form toggle (`showForm` state) and the `.client-form` section
- Keep the search input

### Migrate to Shared Sheet
- Replace the custom `.client-table` with the shared `renderSheet()` component
- Columns: Name, Contact Person, Email, Phone, Status
- Include radial menu with placeholder actions

### Files Modified
- `clients/js/client-list.js` — remove add button/form, use renderSheet()
- `clients/css/client-list.css` — remove add button styles, form styles

## 6. Script Loading

### New script/CSS files to add to index.html
```html
<link rel="stylesheet" href="/ui/css/proagri-sheet.css">
<link rel="stylesheet" href="/ui/css/radial-menu.css">
<script src="/ui/js/proagri-sheet.js"></script>
<script src="/ui/js/radial-menu.js"></script>
```

## Design Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Sidebar width | 260px (match messaging) | User wants visual consistency between main nav and messaging |
| Dashboard split | 70/30 (flex 7/3) | Gives the main sheet enough room for data while keeping a useful side panel |
| Sub-menu items | Placeholder ("Dashboard", "Overview") | Start simple, add department-specific items as features develop |
| Radial trigger | Hover (not click) | Faster interaction — hover to preview, click to act |
| Shared components | proagri-sheet + radial-menu as separate files | Reusable across all pages, single source of truth for consistency |
| Right panel content | Placeholder for now | Will be defined per department later |
| Sort behavior | Client-side, click column headers | Sufficient for current data sizes, no server round-trip needed |
