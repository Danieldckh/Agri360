# Booking Form Pipeline — Claude Training Doc

This document explains the three external apps that cooperate with the ProAgri CRM to take a client from "fill out a checklist" to "signed booking agreement". Read it before making changes that cross these boundaries — each app lives in its own repo with its own deploy, and naming-rename/schema changes cascade fast.

## The three apps at a glance

| App | Repo | Live URL (prod) | Coolify UUID | Role |
|---|---|---|---|---|
| **Checklist wizard** | [`Danieldckh/checklist-Agri360`](https://github.com/Danieldckh/checklist-Agri360) | `https://checklist.proagrihub.com` | `kgso4o000o48kww4k4c8048c` | Intake form — salesperson fills it with the client, creates client + booking_form rows in CRM. |
| **Editable booking form** | [`Danieldckh/Editable-booking-form`](https://github.com/Danieldckh/Editable-booking-form) (local: `C:/Users/pamde/Desktop/Editable-booking-form/`) | `https://bookingformeditor.proagrihub.com` (also `bookingformeditor-old.148.230.100.16.sslip.io`) | `agw8ggg000sgkgs0ok0k04wg` | Renders the CRM's booking form HTML as an in-browser WYSIWYG with `contenteditable` cells. Salesperson polishes prices/deliverables/header and hits "Send to ProAgri". |
| **Esign booking form – OLD** | [`Danieldckh/secure-signature-page`](https://github.com/Danieldckh/secure-signature-page) (local: `C:/Users/pamde/Desktop/secure-signature-page/`). React/Vite SPA + Express. | `https://bookingformesign-old.148.230.100.16.sslip.io` | `fwscg88cs8sc44000k00go0w` | Accepts the finalized HTML from the CRM, renders it alongside T&Cs, lets the client sign electronically or request changes. |

## End-to-end data flow

```
┌──────────────────┐   1. checklist submit    ┌───────────────────┐
│  Checklist       │ ───────────────────────▶ │  CRM API          │
│  (vanilla JS)    │   POST /clients          │  /api/...         │
│                  │   POST /booking-forms    │                   │
│                  │   POST /deliverables/bulk│  Postgres:        │
│                  │                          │  - clients        │
│                  │   2. ask CRM for editor  │  - booking_forms  │
│                  │ ───────────────────────▶ │  - deliverables   │
│                  │   POST /:id/send-to-editor                   │
│                  │ ◀─────────────────────── │                   │
└──────────────────┘   editor URL             └─────────┬─────────┘
                                                        │
                       ┌────────────────────────────────┘
                       ▼
         ┌─────────────────────────────┐   3. client polishes
         │  Editable Booking Form      │      prices/deliverables
         │  (Express + base.html       │      in-browser
         │   template w/ contenteditable│
         │   cells)                    │   4. "Send to ProAgri"
         │                             │ ───────────────────────▶ CRM API
         │                             │     /send-to-n8n → internal
         │                             │     /send-to-crm/:slug  proxy
         │                             │     → POST /:id/send-to-esign
         └─────────────────────────────┘
                                                        │
                       ┌────────────────────────────────┘
                       ▼
         ┌─────────────────────────────┐   5. CRM renders
         │  CRM /api/booking-forms/    │      final snapshot HTML
         │  :id/send-to-esign          │      (build-booking-snippet.js
         │                             │       + format-deliverables.js)
         │                             │
         │                             │   6. POST to esign service
         │                             │ ───────────────────────▶ esign-old
         └─────────────────────────────┘   POST /api/esign/booking/create
                                           Headers: X-Api-Key: <ESIGN_API_SECRET>
                                           Body: { clientName, slug, html }
                                           Response: { signerUrl, slug }
                                                        │
                       ┌────────────────────────────────┘
                       ▼
         ┌─────────────────────────────┐
         │  Esign OLD (third-party)    │   7. client opens /?slug=...
         │  React SPA                  │      signs or requests changes
         │  ?slug=client-name-ID       │
         └─────────────────────────────┘
                       │
                       ▼  (via webhook or polling — unclear)
                  booking_forms.esign_url set in CRM
                  booking_forms.signed_at set when signed
```

## App 1 — Checklist (`checklist-Agri360`)

- **Stack**: single-page vanilla JS + HTML (`index.html`, `app.js`, `styles.css`). No build step.
- **What it does**: multi-step wizard that collects client information (company, contacts, industry), campaign period, and every deliverable checkbox (magazine, social media, video, Agri4All, etc.).
- **Key constant in `app.js`**: `CRM_API` — points at the CRM API host.
- **CRM calls it makes** (sequence on submit):
  1. `GET /clients?search=<name>` — look for existing client
  2. `POST /clients` — create if missing
  3. `POST /booking-forms` with `formData` JSONB — upsert on `checklist_id` (a hash of client name + campaign start/end dates)
  4. `POST /booking-forms/:id/send-to-editor` — asks the CRM to render HTML + push it into the Editable Booking Form service
  5. `POST /deliverables/bulk` — inserts the deliverable rows tied to the booking form
- **Upsert key**: `checklist_id = sha1(client_name + campaign_start + campaign_end)`. Resubmitting the same checklist **updates** the same booking form. Change this contract at your peril — sister apps rely on it.
- **Coordinated schema** (cannot rename without updating checklist): `clients.name`, `clients.trading_name`, `clients.primary_contact` (JSONB), `booking_forms.checklist_id`, `booking_forms.form_data` (JSONB).

## App 2 — Editable Booking Form (`Editable-booking-form`)

- **Stack**: Express server (`server.js`) + `templates/base.html` + `format-deliverables.js` + `public/pages/*.html` (generated). No build step.
- **What it does**: receives rendered HTML from the CRM, saves it as `/pages/<slug>.html`, and serves it with `contenteditable` cells so a human can polish prices/deliverables before sending. The **header** (logo, address, legal strip) and **all price/deliverable cells** are editable.
- **Key endpoints**:
  - `POST /create` — CRM pushes `{ slug, html }` here; server writes `public/pages/<slug>.html` and responds with the editor URL
  - `GET /pages/<slug>.html` — the editor page itself
  - `POST /send-to-n8n` — "Send to ProAgri" button hits this; server proxies to the CRM's `/api/booking-forms/:id/send-to-esign`
  - `POST /send-to-crm/:slug` — same-origin proxy for the CRM's client-data API (avoids CORS on sslip.io)
- **Page-patching quirk**: `patchPageHtml()` post-processes incoming HTML to strip the admin button, rewrite fetch URLs, inject sending-state behavior, and redirect to the e-sign URL after send. If the CRM's rendered HTML shape changes (button IDs, fetch URLs), these regexes may silently stop matching.
- **The `format-deliverables.js` in this repo is the original**. A near-identical copy lives in the CRM at `api/lib/format-deliverables.js`. They drifted slightly. Any change to deliverable rendering needs to be applied in both, or they drift more.

## App 3 — Esign Booking Form – OLD (third-party SPA)

- **Source**: [`Danieldckh/secure-signature-page`](https://github.com/Danieldckh/secure-signature-page), local at `C:/Users/pamde/Desktop/secure-signature-page/`. React + Vite + Tailwind + shadcn (TSX). The page is served from a bundled build (`/assets/index-*.js`) and the `server.js` at repo root serves the dist + the `/api/esign/...` routes.
- **Key source files**:
  - `src/App.tsx`, `src/main.tsx` — SPA entry
  - `src/pages/Index.tsx` — the signing page
  - `src/components/BookingFormHeader.tsx`, `BookingFormPlaceholder.tsx` — renders the CRM-supplied HTML
  - `src/components/TermsAndConditions.tsx` — the legal strip you see on the signing page
  - `src/components/SignatureModal.tsx`, `SignatureField.tsx`, `SignatureCertificate.tsx`, `CertificatePage.tsx` — the signing flow
  - `src/components/RevisionsPage.tsx`, `CommentSystem.tsx` — the "Revisions" sidebar for text-selection change requests
  - `server.js` — Express server; serves `dist/` and exposes `/api/esign/...` endpoints
- **What we control**: everything. Frontend (React TSX), backend (Express `server.js`), and the HTML snapshot the CRM POSTs into it. The `X-Api-Key` secret (`ESIGN_API_SECRET` / `ESIGN_ADMIN_SECRET` in CRM `.env`) gates write access.
- **To change the esign UI**: edit TSX components in `src/components/`, run the Vite build, commit, push to `Danieldckh/secure-signature-page` master, then deploy Coolify UUID `fwscg88cs8sc44000k00go0w`. This was the app I failed to locate on first pass — the broad grep eventually surfaced the built bundle at `CRM SYSTEM/proagri-client-data/api/esign-app/dist/assets/index-ConoY0oT.js` and the source at `Desktop/secure-signature-page/`.
- **API contract** (from CRM's `api/routes/booking-forms.js::send-to-esign`):
  - **Request**: `POST {ESIGN_SERVICE_URL}/api/esign/booking/create`
    - Headers: `Content-Type: application/json`, `X-Api-Key: <secret>`
    - Body: `{ clientName: string, slug: string, html: string }`
  - **Response**: `{ signerUrl: string, slug: string }`
  - CRM stores `signerUrl` in `booking_forms.esign_url`.
- **Client-facing URL shape**: `https://bookingformesign-old.148.230.100.16.sslip.io/?slug=<slug>`
- **UI structure** (observed via Playwright snapshot, not from source):
  - Company Information table (non-editable by default)
  - Contact Details table (non-editable by default)
  - Deliverables table (non-editable)
  - Full "Terms and Conditions of Acceptance" legal text
  - A "Revisions" sidebar for text-selection change requests
  - "Download PDF" and "Sign Document" buttons at the bottom
- **How to change the esign UI**: edit TSX components in `secure-signature-page/src/`, then rebuild + redeploy. If we want company info to be editable, we need to either (a) make `BookingFormPlaceholder.tsx` / `BookingFormHeader.tsx` preserve `contenteditable="true"` in the injected HTML, or (b) have the component wrap company/contact table cells with its own editable inputs. The current TSX (unverified — confirm before editing) appears to strip or ignore those attributes, so cells render as read-only `generic` nodes rather than `textbox` nodes.

## CRM endpoints that glue it together

All in `api/routes/booking-forms.js`:

- `POST /:id/send-to-editor` — renders the booking form HTML via `build-booking-snippet.js` + `format-deliverables.js`, slugifies the client name, and pushes `{ slug, html }` to the Editable Booking Form service at `EDITOR_URL`. Returns the editor URL.
- `POST /:id/send-to-esign` — same HTML rendering, then POSTs `{ clientName, slug, html }` to the OLD esign service with `X-Api-Key` auth. Stores the returned `signerUrl` on `booking_forms.esign_url`.
- The Editable Booking Form's "Send to ProAgri" button proxies into `send-to-esign` via `POST /send-to-n8n` (legacy name — the n8n webhook is long gone; it now calls the CRM directly).

## Env vars to know

In CRM `.env`:

```
COOLIFY_API_TOKEN=...                              # deploys all apps above
COOLIFY_BASE_URL=https://coolify.proagrihub.com
ESIGN_SERVICE_URL=https://bookingformesign-old...  # OLD esign (third-party)
ESIGN_API_SECRET=eyJ...                            # X-Api-Key for OLD esign
EDITOR_URL=https://bookingformeditor.proagrihub.com (or set per env)
```

## Common mistakes to avoid

1. **Renaming columns in `clients` / `booking_forms` / `deliverables` without updating `checklist-Agri360/app.js`.** The checklist submits by column name via JSONB — silent field drop.
2. **Changing the slug format.** The slug `<client-name>-<id>` is used as a URL parameter across all three downstream apps. Breaking it orphans old links.
3. **Editing `format-deliverables.js` in one repo only.** Two copies exist (CRM `api/lib/`, Editable-booking-form root). They drift unless explicitly synced.
4. **Forgetting that Coolify does NOT auto-deploy on push.** Every deploy requires an explicit `POST {COOLIFY_BASE_URL}/api/v1/deploy?uuid=<uuid>` with the bearer token. Each app has its own UUID (table at the top).

## Where to look next

- CRM rendering: `api/lib/build-booking-snippet.js`, `api/lib/format-deliverables.js`
- CRM esign dispatch: `api/routes/booking-forms.js` (search for `send-to-esign`)
- Editable form patching: `Editable-booking-form/server.js::patchPageHtml`
- Checklist submission: `checklist-Agri360/app.js` (search for `CRM_API`)
