# Checklist — New Client Booking Form Builder

## Overview

A 10-page wizard form that captures all deliverables a ProAgri Media client wants. On submit, it either creates a new client + booking form, or adds/updates a booking form under an existing client. The wizard opens as a modal overlay from a "New Booking" button on the Admin department page.

## Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Architecture | Single monolithic JS + CSS file | Matches codebase conventions (messaging.js is 2233 lines); wizard state stays in one closure |
| Wizard appearance | Modal overlay | Keeps Admin page context visible; natural for form workflow |
| Client matching | Typeahead autocomplete on Company Name | Pre-fills known details for existing clients; new client if no match selected |
| Copy/Paste scope | Between months within same page only | Simpler; cross-page copy not needed |
| Fill Test Data | Always visible | Useful for demos, not just dev |
| Financials pricing | Manual entry | No auto-calculation from deliverables |
| Date range matching | Same client + same date range = update existing booking form | Different date range = new booking form |

## File Structure

### New Files
- `checklist/js/checklist.js` — All wizard logic, 10 pages, modal, state management, admin page renderer
- `checklist/css/checklist.css` — All styles with dark/light theme support

### Modified Files
- `index.html` — Add `<link>` + `<script>` tags; add "Admin" nav item in sidebar under Departments group
- `ui/js/app.js` — Add `admin` page routing calling `window.renderAdminPage(container)`

## Architecture

### Entry Point

```
window.renderAdminPage(container)
```

Renders the Admin department page with:
- Header: "Admin" title
- Top-right: "New Booking" button (accent gradient)
- Content area: placeholder for future admin features

### Modal System

Clicking "New Booking" calls `openChecklistWizard()` which:
1. Creates a full-screen overlay (`checklist-overlay`) with dimmed backdrop
2. Renders a large centered modal card (~90vw × ~90vh)
3. Modal contains: header bar (title + step indicator + close X), scrollable content area, footer bar (Back/Next buttons + Fill Test Data)
4. Close (X or Escape) triggers confirmation dialog if form has data
5. Modal appended to `document.body`, not inside the dashboard container

### State Object

All wizard state lives in a single `formData` object inside the `openChecklistWizard` closure:

```javascript
var formData = {
  // Page 1: Client Info
  companyName: '',
  tradingName: '',
  companyRegNo: '',
  vatNumber: '',
  website: '',
  industryExpertise: '',
  physicalAddress: '',
  physicalPostalCode: '',
  postalAddress: '',
  postalCode: '',
  primaryContact: { name: '', email: '', cell: '', tel: '' },
  materialContact: { name: '', email: '', cell: '', tel: '' },
  accountsContact: { name: '', email: '', cell: '', tel: '' },
  projectSummary: '',
  campaignMonthStart: '',
  campaignMonthEnd: '',
  existingClientId: null, // set if typeahead matches existing client

  // Active months per page (each page has its own selection)
  page2ActiveMonths: [],   // derived from campaign dates, user toggles per page
  page3ActiveMonths: [],
  page4ActiveMonths: [],
  page5ActiveMonths: [],
  page6ActiveMonths: [],
  page7ActiveMonths: [],
  page8ActiveMonths: [],
  page9ActiveMonths: [],

  // Page 2: Social Media & Own Page
  socialLinks: { facebook: '', instagram: '', linkedin: '', youtube: '', tiktok: '', twitter: '' },
  socialMediaManagement: {
    enabled: false,
    platforms: { facebook: false, instagram: false, linkedin: false, youtube: false, tiktok: false, twitter: false },
    monthlyPosts: 10,
    adSpend: 0,
    googleAds: false,
    contentCalendar: false
  },
  ownPageSocialMedia: {
    enabled: false,
    items: [
      // Each: { type, enabled, amount, curated, timeframe }
      // e.g. { type: 'facebookPosts', enabled: false, amount: 0, curated: 0, timeframe: '' }
    ]
  },

  // Page 3: Countries & Agri4All
  selectedCountries: ['South Africa'],
  agri4all: {
    enabled: false,
    items: [
      // Same pattern: { type, enabled, amount, curated }
    ]
  },

  // Page 4: Online Articles
  onlineArticles: {
    enabled: false,
    proAgriMedia: false,
    proAgriCoZa: false,
    amount: 1,
    curated: 0
  },

  // Page 5: Banners
  banners: {
    enabled: false,
    agri4all: false,
    proAgri: false
  },

  // Page 6: Magazine
  magazine: {
    enabled: false,
    entries: [
      // Each: { saDigital, africaPrint, africaDigital, coffeeTableBook }
    ]
  },

  // Page 7: Video
  video: {
    enabled: false,
    entries: [
      // Each: { videoType, videoDuration, photographerIncluded, shootDays, shootHours, location, description }
    ]
  },

  // Page 8: Website Design
  websiteDesign: {
    enabled: false,
    type: '',        // 'design', 'redesign', 'management'
    numberOfPages: '' // '1-5', '5-10', '10+'
  },

  // Page 9: Financials
  currency: 'R',
  monthlyFinancials: {
    // keyed by month string, e.g. '2026-02'
    // each: { enabled, basePrice: 0, discount: 0, subtotal: 0 }
  },

  // Page 10: Sign-Off
  signOffDate: '',
  representative: ''
};
```

### Active Months System

`campaignMonthStart` and `campaignMonthEnd` from Page 1 generate an array of month strings (e.g., `['2026-02', '2026-03', '2026-04']`). This array:
- Populates the "Select Active Months" checkbox list on Pages 2–9
- Each page can have its own subset of active months toggled
- Per-page active months stored in the state object as `page2ActiveMonths` through `page9ActiveMonths` arrays

### Page Rendering

Each page is a function: `renderPage1(container, formData)` through `renderPage10(container, formData)`.

Each function:
1. Clears the modal content area
2. Builds the page DOM using `document.createElement`
3. Reads current values from `formData` to populate fields
4. Attaches `input`/`change` event listeners that write back to `formData` in real-time
5. Returns nothing — side-effect only (mutates container)

### Navigation

- `currentPage` variable tracks active page (1–10)
- **Next** button: validates current page (if required fields), saves state, increments `currentPage`, calls `renderPageN`
- **Back** button: saves state, decrements `currentPage`, calls `renderPageN`
- **Step indicator** in header: shows "Page X of 10" with clickable dots/numbers for direct navigation (only to previously visited pages)
- Alt+Left/Right keyboard shortcuts for Back/Next

### Validation

- **Page 1 only** has hard validation: Company Name, Campaign Month Start, Campaign Month End required
- Other pages have no required fields — sections are optional
- On validation failure: red error banner at top listing missing fields, auto-scroll to first error
- Next button is always clickable (validation runs on click, not disabled state)

### Toggleable Sections

Pattern for sections like Social Media Management, Agri4All, Online Articles, etc.:

1. Section heading has a checkbox — master toggle
2. When unchecked: all child inputs are `disabled` and visually dimmed (opacity: 0.5)
3. When checked: children become enabled
4. State stored in `formData.sectionName.enabled`

### Copy/Paste System

Each toggleable section has Copy (clipboard icon) and Paste (paste icon) buttons in the section header.

- **Copy**: serializes the current section's `formData` subset to a module-level `clipboard` variable
- **Paste**: deserializes `clipboard` into the current section, re-renders the section
- Paste button is disabled (greyed out) until Copy has been used at least once
- Clipboard is typed — can only paste Social Media config into Social Media sections, etc.

### Typeahead / Autocomplete (Company Name)

On Page 1, the Company Name input has typeahead:
1. On each keystroke (debounced 300ms), fetch `GET /api/clients?search=<query>`
2. Display dropdown list of matching clients below the input
3. If user selects a client: set `existingClientId`, pre-fill known fields (trading name, contacts, addresses, etc.)
4. If user types a name not in the list and moves on: `existingClientId` stays null (new client)
5. Dropdown dismisses on blur or Escape

### Dynamic Tabs (Magazine, Video)

Pages 6 and 7 support multiple entries via tabs:
1. Tab bar with "Magazine 1" (or "Video 1") + "Add Magazine" button
2. Each tab maps to an entry in `formData.magazine.entries[]` or `formData.video.entries[]`
3. Clicking a tab renders that entry's fields
4. Tabs can be removed (X on tab) with confirmation
5. "+ Add" button appends a new entry with defaults

### Fill Test Data

A button in the footer that, when clicked:
1. Populates `formData` with realistic sample data for the current page
2. Re-renders the current page to show the filled data
3. Uses South African context (SA addresses, ZA phone numbers, Rand currency)

## Pages Detail

### Page 1: Client Information
- Company Details: Company Name (required, typeahead), Trading Name, Company Reg No, VAT Number, Website, Industry/Expertise
- Addresses: Physical Address, Physical Postal Code, Postal Address, Postal Code
- Primary Contact: Name, Email, Cell, Tel
- Material Contact: same structure
- Accounts Contact: same structure
- Project Summary: textarea
- Campaign Month Start: month picker (required)
- Campaign Month End: month picker (required)

### Page 2: Social Media & Own Page Social Media
- Active Months checkboxes (derived from Page 1 dates)
- Social Account Links: Facebook, Instagram, LinkedIn, YouTube, TikTok, Twitter/X (all URL inputs)
- Social Media Management (toggleable): platform checkboxes, Monthly Posts (number, default 10), Ad Spend (number, default 0), Google Ads checkbox, Content Calendar checkbox
- Own Page Social Media (toggleable): rows for Facebook Posts, Facebook Stories, Facebook Video Posts, Instagram Posts, Instagram Stories, TikTok Shorts, YouTube Shorts, YouTube Video, LinkedIn Article (+ Campaign checkbox), Twitter/X Posts — each with checkbox, amount, curated (where applicable), timeframe

### Page 3: Countries & Agri4All
- Active Months checkboxes
- Country grid: ~50 checkboxes (South Africa default checked), + Add Country button
- Agri4All (toggleable): Facebook Posts, Facebook Stories, Facebook Video Posts, Instagram Posts, Instagram Stories, TikTok Shorts, YouTube Shorts, YouTube Video, LinkedIn Article + Company Campaign, Newsletter Feature, Newsletter Banner, Unlimited Product Uploads, Agri4All Product Uploads — each with checkbox, amount, curated where applicable
- Country filter tabs at bottom

### Page 4: Online Articles
- Active Months checkboxes
- Online Articles (toggleable): ProAgriMedia.com checkbox, ProAgri.co.za checkbox, Amount (number, default 1), Curated (number, default 0)

### Page 5: Banners
- Active Months checkboxes
- Banners (toggleable): Agri4All checkbox, ProAgri checkbox

### Page 6: Magazine
- Active Months checkboxes
- Magazine (toggleable): SA Digital, Africa Print, Africa Digital, Coffee Table Book checkboxes
- Tab system for multiple magazine entries

### Page 7: Video
- Active Months checkboxes
- Video (toggleable): Video Type (14 radio options), Video Duration (5 radio options), Photographer Included checkbox, Shoot Duration Days/Hours, Location text, Description textarea
- Tab system for multiple video entries

### Page 8: Website Design
- Active Months checkboxes
- Website Design (toggleable): Type radio (Design & Dev, Redesign, Monthly Management), Number of Pages radio (1-5, 5-10, 10+)

### Page 9: Financials
- Active Months checkboxes
- Per-month cards (one per active month): each toggleable with Base Price, Discount, Subtotal (auto-calculated: base - discount)
- Financial Totals: Currency (default "R"), Subtotal (sum of all month subtotals), Tax at 15%, Grand Total

### Page 10: Sign-Off
- Date picker
- Representative text field
- Submit button (replaces Next)

## Submit Flow

On Page 10 submit:

1. Collect all `formData`
2. If `existingClientId` is set:
   - Check if a booking form with the same date range exists for this client
   - If yes: `PATCH /api/booking-forms/:id` (update)
   - If no: `POST /api/booking-forms` with `client_id` (create new booking form)
3. If `existingClientId` is null:
   - `POST /api/clients` to create the client
   - Then `POST /api/booking-forms` with the new `client_id`
4. Show success message with link to client/booking form
5. Close the modal

## API Endpoints

### Existing (used as-is)
- `GET /api/clients?search=<query>` — for typeahead (already supports search query param)

### Modified (backend changes required)
- `POST /api/clients` — extend to accept full wizard client fields (trading name, company reg, VAT, website, industry, physical/postal addresses with postal codes, three contact persons). Requires adding columns to `clients` table: `trading_name`, `company_reg_no`, `vat_number`, `website`, `industry_expertise`, `physical_address`, `physical_postal_code`, `postal_address`, `postal_code`, `primary_contact JSONB`, `material_contact JSONB`, `accounts_contact JSONB`. Remove `title` as required field from validation.
- `POST /api/booking-forms` — replace current handler to accept `{ client_id, campaign_month_start, campaign_month_end, form_data, sign_off_date, representative }`. Remove `title` requirement. Store checklist data as JSONB in `form_data` column.
- `PATCH /api/booking-forms/:id` — extend updatable fields to include `campaign_month_start`, `campaign_month_end`, `form_data`, `sign_off_date`, `representative`
- `GET /api/booking-forms/by-client/:clientId` — already exists, use this URL (not query string variant) to list booking forms for a client and check date range matches

The booking form payload will be stored as a JSONB column in the database — the full `formData` object minus client fields. This avoids needing 50+ columns and allows the form structure to evolve without migrations.

Financials subtotals are computed on the frontend only (base - discount) and stored as-is in the JSONB. No server-side recomputation — the frontend is the source of truth for financial calculations.

## Database

### Clients table — add columns
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

### Booking forms table — add columns (or create if not exists)
```sql
ALTER TABLE booking_forms ADD COLUMN IF NOT EXISTS campaign_month_start VARCHAR(7);
ALTER TABLE booking_forms ADD COLUMN IF NOT EXISTS campaign_month_end VARCHAR(7);
ALTER TABLE booking_forms ADD COLUMN IF NOT EXISTS form_data JSONB;
ALTER TABLE booking_forms ADD COLUMN IF NOT EXISTS sign_off_date DATE;
ALTER TABLE booking_forms ADD COLUMN IF NOT EXISTS representative VARCHAR(255);
```

If the `booking_forms` table doesn't exist yet:
```sql
CREATE TABLE IF NOT EXISTS booking_forms (
  id SERIAL PRIMARY KEY,
  client_id INTEGER REFERENCES clients(id) ON DELETE CASCADE,
  campaign_month_start VARCHAR(7) NOT NULL,
  campaign_month_end VARCHAR(7) NOT NULL,
  form_data JSONB NOT NULL,
  status VARCHAR(50) DEFAULT 'draft',
  sign_off_date DATE,
  representative VARCHAR(255),
  created_by INTEGER REFERENCES employees(id),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
```

The `campaign_month_start` + `campaign_month_end` + `client_id` combination determines whether to update or create.

## Styling

- Follow existing CSS variable system (`--color-primary`, `--color-accent-light`, etc.)
- Dark/light theme support via `[data-theme="light"]` selectors
- Modal backdrop: `rgba(0, 0, 0, 0.6)`
- Modal card: dark background matching sidebar (`var(--color-secondary)`)
- Form inputs: `.client-form-input` pattern (translucent background, accent border on focus)
- Buttons: accent gradient for primary action (Next/Submit), outlined for secondary (Back)
- Step indicator: numbered dots, current highlighted with accent color
- Toggleable sections: checkbox in heading, disabled children get `opacity: 0.5`
- Pill/chip style month selectors
- Animations: `slideUpFadeIn` for page transitions within the modal
- Two-column grid layout for form fields where appropriate
- Responsive: stack to single column on narrow viewports

## Keyboard Shortcuts

- `Alt+Left` / `Alt+Right` — Back / Next
- `Escape` — Close modal (with confirmation if data exists)
- `Tab` / `Shift+Tab` — Standard form navigation
