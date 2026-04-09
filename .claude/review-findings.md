## Backend changes — agri4all-product-uploads (completed)

### Files touched

- `api/server.js` — added `require('dotenv').config()` as first line
- `api/config.js` — added OPENAI_API_KEY, ALPHA_AGRI4ALL_BASE_URL, ALPHA_AGRI4ALL_EMAIL, ALPHA_AGRI4ALL_PASSWORD, ALPHA_AGRI4ALL_SELLER_ID env fields
- `ui/js/deliverable-workflows.js` — de-aliased agri4all-product-uploads: added own CHAINS entry, own DEPT_MAPS entry, own BRANCH_STATUSES entry ('design_changes' loops back to 'design_review'); removed from CHAIN_ALIASES and DEPT_MAP_ALIASES
- `api/routes/deliverables.js` — added DEPT_MAPS entry for agri4all-product-uploads; removed it from DEPT_MAP_ALIASES; added POST /:id/post-to-alpha route
- `api/lib/country-codes.js` — new: ISO alpha-2 lookup table
- `api/lib/alpha-agri4all.js` — new: Alpha Agri4All API client (auth, getCategories, postProduct)
- `api/lib/openai-autofill.js` — new: OpenAI autofill helper for product name/description/category

### Action required before deploying

Run in `api/`:
```
npm install node-fetch@2 form-data openai dotenv
```

`node-fetch`, `form-data`, `openai`, and `dotenv` are not currently in api/package.json.

### Blocking items

None.

## Frontend changes — agri4all-product-uploads (completed)

### Files touched

- `pages/production/production-page.js` — F1: added "Amount" cell (from `metadata.amount`) to generic row renderer for `agri4all-product-uploads` rows, between type cell and request-materials cell. F2: added `openA4AProductUploadsDashboard` function (30% chat / 70% upload panel, materials recap, `buildUploadArea` for `product_images`, Send for Approval + Post to Agri4All action bar, change-request counter, status badge) with `window.openA4AProductUploadsDashboard` export. F3: rewired both eye-dispatch sites (`colEye` click handler and inline row eye handler) from `openA4AImageDescriptionDashboard` to `openA4AProductUploadsDashboard` for `agri4all-product-uploads` type.
- `pages/production/production-page.css` — F4: added `.status-agri4all-links`, `.status-waiting_for_materials`, `.status-request_client_materials`, `.status-ready_for_approval` solid-color pill classes.
- `ui/css/proagri-sheet.css` — F4: added `.proagri-sheet-status-agri4all-links` badge class (green, rgba palette matching existing conventions).
