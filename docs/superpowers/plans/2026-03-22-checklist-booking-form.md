# Checklist Booking Form Builder — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a 10-page wizard modal that captures client booking deliverables and creates/updates clients + booking forms in the database.

**Architecture:** Single monolithic `checklist.js` + `checklist.css` files. Modal overlay opened from an Admin department page. Wizard state lives in a single closure-scoped `formData` object. Backend uses JSONB column for flexible form data storage.

**Tech Stack:** Vanilla HTML/CSS/JavaScript (frontend), Express.js + PostgreSQL (backend), no build system.

**Spec:** `docs/superpowers/specs/2026-03-22-checklist-booking-form-design.md`

---

## File Map

| File | Action | Responsibility |
|------|--------|---------------|
| `checklist/js/checklist.js` | Create | All wizard logic: Admin page renderer, modal system, 10 page renderers, state management, navigation, validation, typeahead, copy/paste, fill test data, submit flow |
| `checklist/css/checklist.css` | Create | All styles: modal, wizard pages, form inputs, toggleable sections, month pills, tabs, dark/light theme |
| `index.html` | Modify (lines 23, 107-108, 200) | Add CSS link, Admin nav item in Departments group, JS script tag |
| `ui/js/app.js` | Modify (lines 363, 365-371, 573) | Add 'admin' to deptPages array, deptNames, and page transition handler |
| `api/routes/clients.js` | Modify (lines 55-75 POST handler, lines 78-117 PATCH handler) | Extend POST/PATCH to accept new client fields |
| `api/routes/booking-forms.js` | Modify (lines 62-83 POST handler, lines 85-120 PATCH handler) | Extend POST to accept checklist JSONB, extend PATCH fields |
| `api/db.js` | Modify | Add migration for new columns on clients + booking_forms tables |

---

### Task 1: Database Migration — Add New Columns

**Files:**
- Modify: `api/db.js`

This task adds the new columns needed for the checklist feature to both the `clients` and `booking_forms` tables. The migration runs automatically on server start using `ADD COLUMN IF NOT EXISTS` so it is idempotent.

- [ ] **Step 1: Read `api/db.js` to understand current structure**

- [ ] **Step 2: Add migration function after pool creation**

Add a `runMigrations` async function that executes the following SQL statements via `pool.query`:

```sql
ALTER TABLE clients ADD COLUMN IF NOT EXISTS trading_name VARCHAR(255);
ALTER TABLE clients ADD COLUMN IF NOT EXISTS company_reg_no VARCHAR(50);
ALTER TABLE clients ADD COLUMN IF NOT EXISTS vat_number VARCHAR(20);
ALTER TABLE clients ADD COLUMN IF NOT EXISTS website VARCHAR(500);
ALTER TABLE clients ADD COLUMN IF NOT EXISTS industry_expertise VARCHAR(255);
ALTER TABLE clients ADD COLUMN IF NOT EXISTS physical_address TEXT;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS physical_postal_code VARCHAR(10);
ALTER TABLE clients ADD COLUMN IF NOT EXISTS postal_address TEXT;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS postal_code VARCHAR(10);
ALTER TABLE clients ADD COLUMN IF NOT EXISTS primary_contact JSONB;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS material_contact JSONB;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS accounts_contact JSONB;
```

```sql
ALTER TABLE booking_forms ADD COLUMN IF NOT EXISTS campaign_month_start VARCHAR(7);
ALTER TABLE booking_forms ADD COLUMN IF NOT EXISTS campaign_month_end VARCHAR(7);
ALTER TABLE booking_forms ADD COLUMN IF NOT EXISTS form_data JSONB;
ALTER TABLE booking_forms ADD COLUMN IF NOT EXISTS sign_off_date DATE;
ALTER TABLE booking_forms ADD COLUMN IF NOT EXISTS representative VARCHAR(255);
```

Also drop the NOT NULL constraint on the existing `title` column (the checklist auto-generates the title):

```sql
ALTER TABLE booking_forms ALTER COLUMN title DROP NOT NULL;
```

Call `runMigrations()` at module level with proper error handling:

```javascript
runMigrations()
  .then(() => console.log('Checklist migrations applied successfully'))
  .catch(err => console.error('Migration failed:', err));
```

- [ ] **Step 3: Test migration by restarting the API server**

Run: `cd api && node server.js`
Expected: "Checklist migrations applied successfully" in console, no errors.

- [ ] **Step 4: Commit**

```bash
git add api/db.js
git commit -m "feat: add database migration for checklist client and booking form columns"
```

---

### Task 2: Extend Backend API Routes

**Files:**
- Modify: `api/routes/clients.js` (lines 55-75 POST handler, lines 78-117 PATCH handler)
- Modify: `api/routes/booking-forms.js` (lines 62-83 POST handler, lines 85-120 PATCH handler)

This task updates the backend routes to accept the new fields from the checklist wizard.

- [ ] **Step 1: Update `POST /api/clients` to accept new fields**

Replace the POST handler in `api/routes/clients.js` (lines 54-75). The new handler should:
- Convert all incoming keys to snake_case
- Accept: `name` (required), `contact_person`, `email`, `phone`, `address`, `notes`, `trading_name`, `company_reg_no`, `vat_number`, `website`, `industry_expertise`, `physical_address`, `physical_postal_code`, `postal_address`, `postal_code`, `primary_contact` (JSONB), `material_contact` (JSONB), `accounts_contact` (JSONB)
- JSON.stringify the JSONB contact fields before inserting
- Return 400 if `name` is missing

- [ ] **Step 2: Update PATCH `/api/clients` to include new fields**

In `api/routes/clients.js`, extend the `fields` array on line 85 to include all new column names. Handle JSON.stringify for JSONB fields (`primary_contact`, `material_contact`, `accounts_contact`) when they are objects.

- [ ] **Step 3: Update `POST /api/booking-forms` to accept checklist data**

Replace the POST handler in `api/routes/booking-forms.js` (lines 62-83). The new handler should:
- Accept: `client_id` (required), `campaign_month_start`, `campaign_month_end`, `form_data` (JSONB), `sign_off_date`, `representative`, `title` (optional, auto-generated from date range if not provided)
- JSON.stringify `form_data` before inserting
- Remove `title` as a required field

- [ ] **Step 4: Update `PATCH /api/booking-forms` to include new fields**

Extend the `fields` array on line 88 to include: `campaign_month_start`, `campaign_month_end`, `form_data`, `sign_off_date`, `representative`. Handle JSON.stringify for `form_data` when it is an object.

- [ ] **Step 5: Test the API changes**

Restart the server and test with curl:
- POST a client with new fields — expect 201 with all fields returned
- POST a booking form with `formData` JSONB — expect 201 with form_data stored

- [ ] **Step 6: Commit**

```bash
git add api/routes/clients.js api/routes/booking-forms.js
git commit -m "feat: extend client and booking form APIs for checklist wizard"
```

---

### Task 3: Create Admin Nav Item and Page Routing

**Files:**
- Modify: `index.html` (lines 23, 107-108, 200)
- Modify: `ui/js/app.js` (lines 363, 365-371, 573)

This task adds the Admin department to the sidebar navigation and registers the page transition handler.

- [ ] **Step 1: Add Admin nav item to sidebar in `index.html`**

After the Social Media nav item (line 107), before the closing `</div>` of the departments group (line 108), add a new `<a class="nav-item" data-page="admin">` with a settings gear SVG icon and label "Admin".

SVG path for gear icon: `M19.14 12.94c.04-.3.06-.61.06-.94 0-.32-.02-.64-.07-.94l2.03-1.58a.49.49 0 00.12-.61l-1.92-3.32a.488.488 0 00-.59-.22l-2.39.96c-.5-.38-1.03-.7-1.62-.94l-.36-2.54a.484.484 0 00-.48-.41h-3.84c-.24 0-.43.17-.47.41l-.36 2.54c-.59.24-1.13.57-1.62.94l-2.39-.96c-.22-.08-.47 0-.59.22L2.74 8.87c-.12.21-.08.47.12.61l2.03 1.58c-.05.3-.07.62-.07.94s.02.64.07.94l-2.03 1.58a.49.49 0 00-.12.61l1.92 3.32c.12.22.37.29.59.22l2.39-.96c.5.38 1.03.7 1.62.94l.36 2.54c.05.24.24.41.48.41h3.84c.24 0 .44-.17.47-.41l.36-2.54c.59-.24 1.13-.56 1.62-.94l2.39.96c.22.08.47 0 .59-.22l1.92-3.32c.12-.22.07-.47-.12-.61l-2.01-1.58zM12 15.6c-1.98 0-3.6-1.62-3.6-3.6s1.62-3.6 3.6-3.6 3.6 1.62 3.6 3.6-1.62 3.6-3.6 3.6z`

- [ ] **Step 2: Add CSS and JS links in `index.html`**

After line 23 (the social-media CSS link), add: `<link rel="stylesheet" href="checklist/css/checklist.css">`

After line 200 (the social-media JS script), before the app.js script, add: `<script src="checklist/js/checklist.js"></script>`

- [ ] **Step 3: Add Admin to deptPages and deptNames in `app.js`**

In `ui/js/app.js`:
- Line 363: add `'admin'` to the `deptPages` array
- Lines 364-371: add `'admin': 'Admin'` to the `deptNames` object

- [ ] **Step 4: Add Admin page transition handler in `app.js`**

After the `social-media` block (after line 573), add this exact block:

```javascript
      if (page === 'admin') {
        activateDeptSidebar('admin');
        if (window.renderAdminPage) window.renderAdminPage(dashboardContent);
        dashboardContent.classList.add('page-enter');
        dashboardContent.addEventListener('animationend', function onEnter() {
          dashboardContent.removeEventListener('animationend', onEnter);
          dashboardContent.classList.remove('page-enter');
          isTransitioning = false;
        });
        return;
      }
```

**Critical:** The `isTransitioning = false` line is required — without it, navigation locks up after visiting Admin.

- [ ] **Step 5: Commit**

```bash
git add index.html ui/js/app.js
git commit -m "feat: add Admin department page to sidebar navigation"
```

---

### Task 4: Create Checklist CSS Foundation

**Files:**
- Create: `checklist/css/checklist.css`

This task creates the complete stylesheet for the checklist wizard modal, including dark/light theme support. All styles use the existing CSS variable system.

- [ ] **Step 1: Create directory**

```bash
mkdir -p checklist/css
```

- [ ] **Step 2: Write `checklist/css/checklist.css`**

Create the file with styles for all of the following components. Use the existing CSS variable system (`--color-primary`, `--color-secondary`, `--color-accent-light`, `--color-accent-dark`, `--text-primary`, `--text-secondary`, `--text-muted`). Include `[data-theme="light"]` overrides for every component.

Components to style:

1. **Admin page** — `.checklist-admin-header` (flex row, space-between, align-items center, margin-bottom 24px), `.checklist-new-btn` (accent gradient button matching `.client-btn-add` pattern)
2. **Modal overlay** — `.checklist-overlay` (position fixed, inset 0, z-index 1000, display flex, align-items/justify-content center, background rgba(0,0,0,0.6)), `.checklist-modal` (width 90vw, height 90vh, max-width 1200px, display flex, flex-direction column, background var(--color-secondary), border-radius 12px, overflow hidden)
3. **Modal header** — `.checklist-modal-header` (display flex, align-items center, padding 16px 24px, border-bottom 1px solid rgba(128,128,128,0.2)), `.checklist-modal-title` (font-size 18px, font-weight 600, color var(--text-primary)), `.checklist-step-dots` (flex 1, display flex, justify-content center, gap 8px), `.checklist-step-dot` (width 28px, height 28px, border-radius 50%, border 2px solid rgba(128,128,128,0.3), background transparent, color var(--text-muted), font-size 12px, cursor pointer), `.checklist-step-dot.active` (border-color var(--color-accent-light), background var(--color-accent-light), color white), `.checklist-step-dot.visited` (border-color var(--color-accent-light), color var(--color-accent-light)), `.checklist-close-btn` (background none, border none, color var(--text-muted), font-size 24px, cursor pointer, padding 4px 8px)
4. **Modal content** — `.checklist-modal-content` (flex 1, overflow-y auto, padding 24px)
5. **Modal footer** — `.checklist-modal-footer` (display flex, justify-content space-between, align-items center, padding 16px 24px, border-top 1px solid rgba(128,128,128,0.2)), `.checklist-back-btn` (background transparent, border 2px solid rgba(128,128,128,0.3), color var(--text-primary), border-radius 8px, padding 8px 24px, cursor pointer), `.checklist-next-btn` (accent gradient background, color white, border none, border-radius 8px, padding 8px 24px, cursor pointer, font-weight 600), `.checklist-fill-btn` (background transparent, border 1px solid rgba(128,128,128,0.2), color var(--text-secondary), border-radius 8px, padding 8px 16px, cursor pointer, font-size 12px)
6. **Form elements** — `.checklist-form-grid` (display grid, grid-template-columns repeat(2, 1fr), gap 16px), `.checklist-form-group` (display flex, flex-direction column, gap 4px), `.checklist-form-group.full-width` (grid-column span 2), `.checklist-label` (font-size 13px, color var(--text-secondary), font-weight 500), `.checklist-input` / `.checklist-textarea` / `.checklist-select` (background rgba(128,128,128,0.08), border 1px solid rgba(128,128,128,0.2), color var(--text-primary), border-radius 8px, padding 8px 12px, font-size 14px, transition border-color 0.15s), `.checklist-input:focus` (border-color var(--color-accent-light), outline none), `.checklist-textarea` (min-height 80px, resize vertical)
7. **Section headings** — `.checklist-section` (margin-bottom 24px), `.checklist-section-title` (font-size 16px, font-weight 600, color var(--text-primary), margin-bottom 16px, border-bottom 2px solid rgba(128,128,128,0.15), padding-bottom 8px), `.checklist-section-header` (display flex, align-items center, gap 12px, margin-bottom 16px), `.checklist-section-toggle` (width 18px, height 18px, accent-color var(--color-accent-light)), `.checklist-section-body.disabled` (opacity 0.5, pointer-events none)
8. **Copy/Paste buttons** — `.checklist-copy-btn` / `.checklist-paste-btn` (background none, border 1px solid rgba(128,128,128,0.2), color var(--text-muted), border-radius 6px, padding 4px 8px, cursor pointer, font-size 11px, margin-left auto), `.checklist-paste-btn:disabled` (opacity 0.3, cursor not-allowed)
9. **Month pills** — `.checklist-month-pills` (display flex, flex-wrap wrap, gap 8px, margin-bottom 16px), `.checklist-month-pill` (display flex, align-items center, gap 6px, padding 6px 14px, border-radius 20px, border 1px solid rgba(128,128,128,0.2), background transparent, color var(--text-secondary), cursor pointer, font-size 13px, transition all 0.15s), `.checklist-month-pill.active` (border-color var(--color-accent-light), background rgba(245,166,35,0.15), color var(--color-accent-light)), `.checklist-month-pill-select-all` (font-weight 600)
10. **Tabs** — `.checklist-tabs` (display flex, gap 0, border-bottom 2px solid rgba(128,128,128,0.15), margin-bottom 16px), `.checklist-tab` (padding 8px 16px, border none, background transparent, color var(--text-muted), cursor pointer, border-bottom 2px solid transparent, margin-bottom -2px, font-size 14px), `.checklist-tab.active` (color var(--color-accent-light), border-bottom-color var(--color-accent-light)), `.checklist-tab-close` (margin-left 8px, font-size 12px, color var(--text-muted)), `.checklist-tab-add` (padding 8px 16px, background transparent, border none, color var(--color-accent-light), cursor pointer, font-size 14px)
11. **Typeahead** — `.checklist-typeahead-wrap` (position relative), `.checklist-typeahead-dropdown` (position absolute, top 100%, left 0, right 0, background var(--color-secondary), border 1px solid rgba(128,128,128,0.2), border-radius 8px, max-height 200px, overflow-y auto, z-index 10, box-shadow 0 4px 12px rgba(0,0,0,0.3)), `.checklist-typeahead-item` (padding 8px 12px, cursor pointer, color var(--text-primary), font-size 14px), `.checklist-typeahead-item:hover` (background rgba(128,128,128,0.1))
12. **Validation** — `.checklist-error-banner` (background rgba(220,53,69,0.15), border 1px solid rgba(220,53,69,0.3), color #ff6b6b, border-radius 8px, padding 12px 16px, margin-bottom 16px, font-size 13px)
13. **Country grid** — `.checklist-country-grid` (display grid, grid-template-columns repeat(auto-fill, minmax(180px, 1fr)), gap 8px), `.checklist-country-item` (display flex, align-items center, gap 8px, padding 6px 8px, font-size 13px, color var(--text-primary))
14. **Financial cards** — `.checklist-financial-card` (background rgba(128,128,128,0.05), border 1px solid rgba(128,128,128,0.15), border-radius 8px, padding 16px, margin-bottom 12px), `.checklist-financial-totals` (background rgba(245,166,35,0.08), border 1px solid rgba(245,166,35,0.2), border-radius 8px, padding 20px, margin-top 24px)
15. **Confirmation dialog** — `.checklist-confirm-overlay` (position fixed, inset 0, z-index 1001, display flex, align-items center, justify-content center, background rgba(0,0,0,0.5)), `.checklist-confirm-dialog` (background var(--color-secondary), border-radius 12px, padding 24px, max-width 400px, text-align center), `.checklist-confirm-actions` (display flex, gap 12px, justify-content center, margin-top 16px)
16. **Light theme overrides** — `[data-theme="light"]` selectors for: `.checklist-modal` background white, `.checklist-typeahead-dropdown` background white, `.checklist-confirm-dialog` background white, input backgrounds `rgba(0,0,0,0.04)`, border colors `rgba(0,0,0,0.15)`, text colors using theme variables
17. **Radio group** — `.checklist-radio-group` (display flex, flex-direction column, gap 8px), `.checklist-radio-label` (display flex, align-items center, gap 8px, cursor pointer, color var(--text-primary), font-size 14px)
18. **Responsive** — `@media (max-width: 768px)` `.checklist-form-grid` becomes single column, `.checklist-modal` becomes 98vw/95vh

- [ ] **Step 3: Commit**

```bash
git add checklist/css/checklist.css
git commit -m "feat: add checklist wizard CSS with dark/light theme support"
```

---

### Task 5: Create Checklist JS — Admin Page + Modal Shell + Navigation

**Files:**
- Create: `checklist/js/checklist.js`

This task creates the JS file with the Admin page renderer, modal open/close system, wizard navigation (Back/Next/step dots), keyboard shortcuts, and empty page stubs. No form content yet — just the infrastructure.

- [ ] **Step 1: Create directory**

```bash
mkdir -p checklist/js
```

- [ ] **Step 2: Write the initial `checklist/js/checklist.js`**

Create the file wrapped in an IIFE. Structure:

**Constants:**
- `API_URL = 'http://localhost:3001/api'`
- `authHeaders(json)` helper that returns auth headers from `window.getAuthHeaders()`

**Admin Page:**
- `window.renderAdminPage(container)` — clears container, sets `display: 'block'`, creates header with "Admin" title and "New Booking" accent gradient button. Button click calls `openChecklistWizard()`.

**Modal System — `openChecklistWizard(existingFormData)`:**
- Local variables: `currentPage = 1`, `maxVisitedPage = 1`, `formData`, `clipboard = { type: null, data: null }`
- Creates overlay div (`.checklist-overlay`) and modal div (`.checklist-modal`)
- Modal header: title span, step dots container, close button (X character via textContent, NOT innerHTML)
- Modal content: scrollable content area
- Modal footer: Back button, Fill Test Data button, Next button
- Appends overlay to `document.body`
- Keyboard listener: Escape calls `confirmClose()`, Alt+Left calls `goBack()`, Alt+Right calls `goNext()`
- `goBack()`: decrement page, re-render
- `goNext()`: validate page 1 if needed, increment page (or call `submitWizard` on page 10), update `maxVisitedPage`, re-render
- `renderCurrentPage()`: clears content, calls the appropriate `renderPageN` function, updates step dots and footer buttons
- `updateStepDots()`: creates numbered buttons 1-10, applies `.active` and `.visited` classes, enables click-to-navigate for visited pages
- `updateFooterButtons()`: hides Back on page 1, changes Next text to "Submit" on page 10
- `confirmClose()`: if formData has data, shows confirmation dialog (built with createElement, NOT innerHTML) with Cancel/Close buttons. If no data, closes immediately.
- `closeWizard()`: removes keyboard listener, removes overlay from DOM

**Default Form Data — `createDefaultFormData()`:**
Returns the full formData object as specified in the design spec, with all fields initialized to defaults.

**Item creators:**
- `createOwnPageItems()` — returns array of 10 objects for Own Page Social Media types: facebookPosts, facebookStories, facebookVideoPosts, instagramPosts, instagramStories, tiktokShorts, youtubeShorts, youtubeVideo, linkedinArticle, twitterPosts. Each: `{ type, label, enabled: false, amount: 0, curated: 0, timeframe: '', hasCurated: true/false, hasCampaign: false }`
- `createAgri4AllItems()` — returns array of 13 objects for Agri4All types. Each: `{ type, label, enabled: false, amount: 0, curated: 0, hasCurated: true/false }`
- `createMagazineEntry()` — returns `{ saDigital: false, africaPrint: false, africaDigital: false, coffeeTableBook: false }`
- `createVideoEntry()` — returns `{ videoType: '', videoDuration: '', photographerIncluded: false, shootDays: 0, shootHours: 0, location: '', description: '' }`

**Page stubs:**
- `renderPage1` through `renderPage10` — each creates a `<p>` element with textContent "Page N: [name] — coming soon" and appends it to container (using createElement + textContent, NOT innerHTML)

**Stub functions:**
- `validatePage1(formData, container)` — returns true (stub)
- `fillTestData(page, formData)` — no-op (stub)
- `submitWizard(formData, onClose)` — calls `onClose()` (stub)

**IMPORTANT:** Do NOT use innerHTML anywhere. Build all DOM with `document.createElement`, `textContent`, and `appendChild`. This prevents XSS vulnerabilities.

- [ ] **Step 3: Verify the modal opens**

Open the CRM in a browser, navigate to Admin, click "New Booking". The modal should appear with step dots, navigation buttons, and placeholder text. Verify: Back hidden on page 1, Next navigates forward, step dots update, Escape shows confirmation if data exists.

- [ ] **Step 4: Commit**

```bash
git add checklist/js/checklist.js
git commit -m "feat: add checklist wizard modal shell with navigation and admin page"
```

---

### Task 6: Implement Shared Helpers

**Files:**
- Modify: `checklist/js/checklist.js`

Fill in the shared helper functions that will be used across multiple pages.

- [ ] **Step 1: Implement `getActiveMonthsList(formData)`**

Generates an array of `"YYYY-MM"` strings from `formData.campaignMonthStart` to `formData.campaignMonthEnd`. Parse the month strings, iterate month-by-month, push formatted strings. Return empty array if either date is missing.

- [ ] **Step 2: Implement `renderActiveMonthsSelector(container, formData, pageKey)`**

Creates a "Select Active Months" section:
- Title: "Select Active Months"
- "Select All" pill checkbox
- One pill checkbox per month from `getActiveMonthsList(formData)`
- Each pill shows month name + year (e.g., "February 2026")
- Clicking a pill toggles it in `formData[pageKey]` array
- "Select All" toggles all months on/off
- Uses `.checklist-month-pills` and `.checklist-month-pill` classes

- [ ] **Step 3: Implement `renderToggleableSection(container, title, dataObj, renderBody, clipboard, sectionType)`**

Creates a section with:
- Header row: checkbox (bound to `dataObj.enabled`), title text, Copy button, Paste button
- Body div with class `.checklist-section-body`
- When checkbox unchecked: body gets `.disabled` class
- Copy button: saves `JSON.parse(JSON.stringify(dataObj))` to `clipboard.data`, sets `clipboard.type` to `sectionType`
- Paste button: disabled until `clipboard.type === sectionType`, on click merges `clipboard.data` into `dataObj` and re-renders
- Calls `renderBody(bodyDiv, dataObj)` to populate section content

- [ ] **Step 4: Implement `createFormGroup(labelText, inputType, value, onChange, opts)`**

Returns a `.checklist-form-group` div containing:
- Label element with `labelText`
- Input element with `type`, `value`, `placeholder` (from opts), `disabled` (from opts)
- For `inputType === 'textarea'`: creates textarea instead
- For `inputType === 'select'`: creates select with `opts.options` array
- For `inputType === 'number'`: adds `min`/`max` from opts
- Attaches `input` or `change` event listener that calls `onChange(newValue)`

- [ ] **Step 5: Implement `createOwnPageItems()` and `createAgri4AllItems()`**

`createOwnPageItems()` returns:
```
facebookPosts (hasCurated: true), facebookStories (hasCurated: false),
facebookVideoPosts (hasCurated: true), instagramPosts (hasCurated: true),
instagramStories (hasCurated: false), tiktokShorts (hasCurated: false),
youtubeShorts (hasCurated: false), youtubeVideo (hasCurated: false),
linkedinArticle (hasCurated: false, hasCampaign: true), twitterPosts (hasCurated: false)
```

`createAgri4AllItems()` returns the same first 9 items plus:
```
newsletterFeature (hasCurated: false), newsletterBanner (hasCurated: false),
unlimitedProductUploads (standalone checkbox, no amount), agri4allProductUploads (hasCurated: false)
```

- [ ] **Step 6: Verify helpers render correctly by temporarily testing from a page stub**

- [ ] **Step 7: Commit**

```bash
git add checklist/js/checklist.js
git commit -m "feat: implement shared wizard helpers (months, toggles, form groups)"
```

---

### Task 7: Implement Page 1 — Client Information

**Files:**
- Modify: `checklist/js/checklist.js`

Replace the `renderPage1` stub. This is the most complex page due to typeahead.

- [ ] **Step 1: Implement `renderPage1(container, formData, clipboard)`**

Build with `document.createElement` only. Sections:

1. **Company Details** — section title "Company Details", 2-col grid:
   - Company Name: text input with typeahead wrapper (required, show asterisk in label)
   - Trading Name: text input
   - Company Reg No: text input, placeholder "2025/000001/07"
   - VAT Number: text input, placeholder "4123456789"
   - Website: url input, placeholder "https://"
   - Industry / Expertise: text input

2. **Addresses** — section title "Addresses", 2-col grid:
   - Physical Address, Physical Postal Code, Postal Address, Postal Code

3. **Primary Contact Person** — section title, 2-col grid:
   - Name, Email (type email), Cell Number (type tel), Tel Number (type tel)
   - All bound to `formData.primaryContact`

4. **Material Contact Person** — same structure, bound to `formData.materialContact`

5. **Accounts Contact Person** — same structure, bound to `formData.accountsContact`

6. **Project Summary** — section title, full-width textarea bound to `formData.projectSummary`

7. **Campaign Dates** — section title, 2-col grid:
   - Campaign Month Start: input type "month" (required)
   - Campaign Month End: input type "month" (required)

All inputs read from `formData` on render and write back on `input` events.

- [ ] **Step 2: Implement typeahead for Company Name**

- Wrap Company Name input in a `.checklist-typeahead-wrap` div
- On input (debounced 300ms using setTimeout/clearTimeout), fetch `GET /api/clients?search=<value>`
- If results: create `.checklist-typeahead-dropdown` div with `.checklist-typeahead-item` children (using textContent for the client name)
- On item click: set `formData.existingClientId = client.id`, pre-fill all known fields from the client object, re-render the page
- On input blur (with 200ms delay for click registration): remove dropdown
- On Escape while dropdown visible: remove dropdown

- [ ] **Step 3: Implement `validatePage1(formData, container)`**

Check that `formData.companyName`, `formData.campaignMonthStart`, `formData.campaignMonthEnd` are non-empty. If any missing:
- Remove any existing `.checklist-error-banner`
- Create error banner div with textContent listing missing fields
- Prepend to container
- Scroll container to top
- Return false

If all valid, remove any existing error banner, return true.

- [ ] **Step 4: Implement `fillTestData` case for page 1**

Set: companyName "Agri Solutions (Pty) Ltd", tradingName "AgriSol", companyRegNo "2025/123456/07", vatNumber "4987654321", website "https://agrisolutions.co.za", industryExpertise "Crop Protection & Seeds", physicalAddress "123 Farm Road, Centurion, Gauteng", physicalPostalCode "0157", postalAddress "PO Box 456, Centurion", postalCode "0046", primaryContact {name: "Jan van der Merwe", email: "jan@agrisol.co.za", cell: "082 555 1234", tel: "012 345 6789"}, materialContact and accountsContact with similar SA data, projectSummary "Full digital marketing campaign...", campaignMonthStart "2026-02", campaignMonthEnd "2026-06".

- [ ] **Step 5: Test in browser**

Verify: fields populate from formData, typeahead fetches and shows results, selecting a client pre-fills, validation blocks Next, Fill Test Data works, navigating away and back preserves data.

- [ ] **Step 6: Commit**

```bash
git add checklist/js/checklist.js
git commit -m "feat: implement Page 1 — Client Information with typeahead"
```

---

### Task 8: Implement Page 2 — Social Media & Own Page Social Media

**Files:**
- Modify: `checklist/js/checklist.js`

- [ ] **Step 1: Implement `renderPage2(container, formData, clipboard)`**

Sections:

1. **Active Months** — use `renderActiveMonthsSelector(container, formData, 'page2ActiveMonths')`

2. **Social Account Links** — section title, 2-col grid with 6 URL inputs:
   - Facebook, Instagram, LinkedIn, YouTube, TikTok, Twitter/X
   - Each with appropriate placeholder (e.g., "https://facebook.com/...")
   - Bound to `formData.socialLinks`

3. **Social Media Management** — toggleable section using `renderToggleableSection`:
   - 6 platform checkboxes (Facebook, Instagram, LinkedIn, YouTube, TikTok, Twitter/X) bound to `formData.socialMediaManagement.platforms`
   - Monthly Posts: number input, default 10
   - Ad Spend: number input, default 0
   - Google Ads: checkbox
   - Content Calendar: checkbox

4. **Own Page Social Media** — toggleable section:
   - Render each item from `formData.ownPageSocialMedia.items` as a row with:
     - Checkbox (enabled toggle)
     - Amount: number input
     - Curated: number input (only if `item.hasCurated`)
     - Timeframe: text input
     - Campaign checkbox (only for LinkedIn Article if `item.hasCampaign`)
   - All disabled when parent section is disabled

- [ ] **Step 2: Implement copy/paste for both toggleable sections**

Pass `clipboard` and `sectionType` strings ('socialMediaManagement', 'ownPageSocialMedia') to `renderToggleableSection`.

- [ ] **Step 3: Add fill test data for page 2**

Set social links to example URLs, enable Social Media Management with Facebook + Instagram + LinkedIn checked, monthlyPosts 12, adSpend 5000, enable Own Page with a few items checked with amounts.

- [ ] **Step 4: Test in browser**

Verify: month selector works, toggleable sections enable/disable children, copy/paste works between sections of the same type, values persist on navigation.

- [ ] **Step 5: Commit**

```bash
git add checklist/js/checklist.js
git commit -m "feat: implement Page 2 — Social Media & Own Page Social Media"
```

---

### Task 9: Implement Page 3 — Countries & Agri4All

**Files:**
- Modify: `checklist/js/checklist.js`

- [ ] **Step 1: Implement `renderPage3(container, formData, clipboard)`**

Sections:

1. **Active Months** — `renderActiveMonthsSelector(container, formData, 'page3ActiveMonths')`

2. **Select Countries** — section title, country grid using `.checklist-country-grid`:
   - Render ~50 country checkboxes from a hardcoded array
   - South Africa is checked by default (in formData.selectedCountries)
   - Each checkbox toggles the country in `formData.selectedCountries`
   - "+ Add Country" button at end: creates a simple prompt (using a small inline form with text input + Add button, NOT `window.prompt`) that adds a custom country to the grid

   Country list: Algeria, Angola, Bahrain, Benin, Botswana, Brazil, Burkina Faso, Cameroon, Canada, CAR, Cyprus, Cote d'Ivoire, Egypt, Eswatini, Ethiopia, Europe, France, Ghana, Guinea, Jordan, Kenya, Kuwait, Lesotho, Liberia, Libya, Madagascar, Malawi, Mali, Mauritius, Mexico, Morocco, Mozambique, Namibia, Nigeria, Qatar, Republic of the Congo, Rwanda, Saudi Arabia, Senegal, South Africa, Spain, Sudan, Tanzania, Togo, Tunisia, USA, Uganda, United Arab Emirates, Zambia, Zimbabwe

3. **Agri4All** — toggleable section with 13 item rows from `formData.agri4all.items`:
   - Each row: checkbox, amount input, curated input (where applicable)
   - LinkedIn Article row has an extra "Company Campaign" checkbox
   - "Unlimited Product Uploads" is a standalone checkbox (no amount field)

4. **Country filter tabs** at bottom of Agri4All section:
   - "All" tab + one tab per selected country
   - Tabs are display-only for now (filtering by country is a future enhancement)

- [ ] **Step 2: Add fill test data for page 3**

Select South Africa, Namibia, Botswana, Kenya. Enable Agri4All with a few items checked.

- [ ] **Step 3: Test and commit**

```bash
git add checklist/js/checklist.js
git commit -m "feat: implement Page 3 — Countries & Agri4All"
```

---

### Task 10: Implement Pages 4-5 — Online Articles & Banners

**Files:**
- Modify: `checklist/js/checklist.js`

These are the simplest pages.

- [ ] **Step 1: Implement `renderPage4(container, formData, clipboard)`**

1. Active Months selector
2. Online Articles toggleable section:
   - ProAgriMedia.com checkbox
   - ProAgri.co.za checkbox
   - Amount: number input (default 1)
   - Curated: number input (default 0)

- [ ] **Step 2: Implement `renderPage5(container, formData, clipboard)`**

1. Active Months selector
2. Banners toggleable section:
   - Agri4All checkbox
   - ProAgri checkbox

- [ ] **Step 3: Add fill test data for pages 4 and 5**

Page 4: enable articles, check both platforms, amount 3, curated 1.
Page 5: enable banners, check both.

- [ ] **Step 4: Test and commit**

```bash
git add checklist/js/checklist.js
git commit -m "feat: implement Pages 4-5 — Online Articles & Banners"
```

---

### Task 11: Implement Page 6 — Magazine

**Files:**
- Modify: `checklist/js/checklist.js`

- [ ] **Step 1: Implement `renderPage6(container, formData, clipboard)`**

1. Active Months selector
2. Magazine toggleable section with tab system:
   - Tab bar using `.checklist-tabs`: one `.checklist-tab` per entry ("Magazine 1", "Magazine 2", etc.)
   - Active tab has `.active` class
   - Each non-first tab has a close button (X) — clicking shows inline confirmation before removing the entry
   - "+ Add Magazine" button (`.checklist-tab-add`) appends new entry via `createMagazineEntry()` and switches to it
   - Tab content: 4 checkboxes for SA Digital, Africa Print, Africa Digital, Coffee Table Book
   - Track active tab index in a local variable

- [ ] **Step 2: Add fill test data for page 6**

Add 2 magazine entries, first with SA Digital + Africa Digital checked, second with Africa Print checked.

- [ ] **Step 3: Test and commit**

```bash
git add checklist/js/checklist.js
git commit -m "feat: implement Page 6 — Magazine with dynamic tabs"
```

---

### Task 12: Implement Page 7 — Video

**Files:**
- Modify: `checklist/js/checklist.js`

- [ ] **Step 1: Implement `renderPage7(container, formData, clipboard)`**

1. Active Months selector
2. Video toggleable section with tab system (same pattern as Magazine):
   - Tab bar with Video entries
   - Tab content for each entry:
     - Video Type: radio group with 14 options (Promotional/Advertising, Informative/Educational, Testimonial/Case Study, Entertainment/Creative, Interactive/Event Coverage, Hype/Invitation, Highlights/Recap, Practical demonstrations, Proven results, Problem solving, New technologies and innovation, Tips and best practices, Humoristic short from ads, Photographer, Other)
     - Video Duration: radio group with 5 options (1-2 min, 3-5 min, 5-10 min, 10-15 min, 15+ min)
     - Photographer Included: checkbox
     - Video Shoot Duration — Days: number input
     - Video Shoot Duration — Hours: number input
     - Video Shoot Location: text input
     - Video Description: textarea with placeholder "Add any additional details..."

- [ ] **Step 2: Add fill test data for page 7**

Add 1 video entry: type "Promotional / Advertising", duration "3-5 min", photographer included, 2 days, location "Stellenbosch Wine Estate", description filled.

- [ ] **Step 3: Test and commit**

```bash
git add checklist/js/checklist.js
git commit -m "feat: implement Page 7 — Video with dynamic tabs"
```

---

### Task 13: Implement Page 8 — Website Design

**Files:**
- Modify: `checklist/js/checklist.js`

- [ ] **Step 1: Implement `renderPage8(container, formData, clipboard)`**

1. Active Months selector
2. Website Design toggleable section:
   - Select Type: radio group with 3 options (Website Design & Development, Website Redesign, Monthly Website Management)
   - Number of Pages: radio group with 3 options (1-5, 5-10, 10+)
   - Both bound to `formData.websiteDesign.type` and `formData.websiteDesign.numberOfPages`

- [ ] **Step 2: Add fill test data for page 8**

Enable, type "Website Redesign", pages "5-10".

- [ ] **Step 3: Test and commit**

```bash
git add checklist/js/checklist.js
git commit -m "feat: implement Page 8 — Website Design"
```

---

### Task 14: Implement Page 9 — Financials

**Files:**
- Modify: `checklist/js/checklist.js`

- [ ] **Step 1: Implement `renderPage9(container, formData, clipboard)`**

1. Active Months selector
2. Per-month financial cards:
   - One `.checklist-financial-card` per active month (from `getActiveMonthsList`)
   - Each card has: month title, enable checkbox, Base Price input (currency), Discount input (currency, default R0), Subtotal (read-only, auto-calculated)
   - Card disabled when checkbox unchecked
   - Copy/Paste between month cards (same section type 'monthlyFinancials')
   - Values stored in `formData.monthlyFinancials[monthKey]`

3. Financial Totals section (`.checklist-financial-totals`):
   - Currency: text input (default "R")
   - Subtotal: read-only, sum of all month subtotals
   - Tax (15%): read-only, calculated
   - Total: read-only, calculated

- [ ] **Step 2: Implement real-time financial calculations**

Create a `recalcFinancials` function that:
- For each enabled month: `subtotal = basePrice - discount`
- Overall subtotal = sum of all month subtotals
- Tax = subtotal * 0.15
- Total = subtotal + tax
- Update all displayed values

Call `recalcFinancials` on every Base Price or Discount input event, and on month enable/disable toggle.

- [ ] **Step 3: Add fill test data for page 9**

Enable all months, set base prices between R15000-R25000, discounts of R0-R2000.

- [ ] **Step 4: Test and commit**

```bash
git add checklist/js/checklist.js
git commit -m "feat: implement Page 9 — Financials with auto-calculation"
```

---

### Task 15: Implement Page 10 — Sign-Off + Submit Flow

**Files:**
- Modify: `checklist/js/checklist.js`

- [ ] **Step 1: Implement `renderPage10(container, formData, clipboard)`**

Simple page with:
- Date: input type "date" bound to `formData.signOffDate`
- Representative: text input bound to `formData.representative`

- [ ] **Step 2: Implement `submitWizard(formData, onClose)`**

The full submit flow:

1. Build client payload from formData (name, tradingName, companyRegNo, etc.)
2. Build booking form payload: `{ campaignMonthStart, campaignMonthEnd, formData: <everything except client fields>, signOffDate, representative }`
3. If `formData.existingClientId` is set:
   a. Fetch existing booking forms: `GET /api/booking-forms/by-client/${existingClientId}`
   b. Find one with matching `campaignMonthStart` AND `campaignMonthEnd`
   c. If match found: `PATCH /api/booking-forms/${matchId}` with updated form_data
   d. If no match: `POST /api/booking-forms` with `clientId` + form_data
4. If `formData.existingClientId` is null:
   a. `POST /api/clients` with client fields — get new `clientId` from response
   b. `POST /api/booking-forms` with new `clientId` + form_data
5. On success: show a success message (green banner with textContent), then call `onClose()` after 2 seconds
6. On error: show error banner with the error message

All fetch calls use `authHeaders(true)` and proper error handling.

- [ ] **Step 3: Add fill test data for page 10**

Set signOffDate to today, representative to "Pieter de Villiers".

- [ ] **Step 4: Test full end-to-end flow**

1. Open wizard, click Fill Test Data on every page, submit — verify client + booking form created
2. Open wizard again, type the test company name — verify typeahead shows it
3. Select existing client, same date range — verify PATCH updates existing booking form
4. Select existing client, different date range — verify new booking form created

- [ ] **Step 5: Commit**

```bash
git add checklist/js/checklist.js
git commit -m "feat: implement Page 10 — Sign-Off and submit flow"
```

---

### Task 16: Polish and Final Integration Test

**Files:**
- Modify: `checklist/js/checklist.js`
- Modify: `checklist/css/checklist.css`

- [ ] **Step 1: Test all 10 pages with Fill Test Data**

Click Fill Test Data on every page, verify all fields populate.

- [ ] **Step 2: Test dark and light themes**

Toggle theme, verify all elements have proper contrast in both modes.

- [ ] **Step 3: Test copy/paste within months**

On financials page, copy one month's settings, paste to another.

- [ ] **Step 4: Test keyboard shortcuts**

Alt+Left/Right, Escape, Tab/Shift+Tab.

- [ ] **Step 5: Fix any visual/functional issues found**

- [ ] **Step 6: Final commit**

```bash
git add checklist/js/checklist.js checklist/css/checklist.css
git commit -m "feat: polish checklist wizard — theme support, copy/paste, keyboard nav"
```
