/* ─── API Documentation Page ───
   Exports:
     window.renderDocsPage(container)         — welcome screen (no API selected)
     window.showDocsApi(container, apiKey)     — render docs for a specific API
     window.getDocsApiSections(apiKey)         — return [{id, title}] for sidebar
*/
(function () {
  function esc(s) { return String(s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }
  function m(method) { return '<span class="docs-method ' + method.toLowerCase() + '">' + method + '</span>'; }

  var apiSections = {
    checklist: [
      { id: 'cl-overview', title: 'Overview' },
      { id: 'cl-flow', title: 'Submission Flow' },
      { id: 'cl-data', title: 'Data Format' },
      { id: 'cl-id', title: 'Checklist ID' },
      { id: 'cl-prefill', title: 'Prefill URL' },
      { id: 'cl-test', title: 'Test Data' }
    ],
    'editable-booking-form': [
      { id: 'eb-overview', title: 'Overview' },
      { id: 'eb-health', title: 'Health Check' },
      { id: 'eb-create', title: 'Create / Save Page' },
      { id: 'eb-list', title: 'List All Pages' },
      { id: 'eb-view', title: 'View Generated Page' },
      { id: 'eb-delete', title: 'Delete Page' },
      { id: 'eb-send-webhook', title: 'Send to Webhook' },
      { id: 'eb-send-crm', title: 'Send to CRM' },
      { id: 'eb-send-esign', title: 'Send to E-Sign' },
      { id: 'eb-template', title: 'Template System' }
    ],
    crm: [
      { id: 'crm-overview', title: 'Overview' },
      { id: 'crm-auth', title: 'Authentication' },
      { id: 'crm-list-clients', title: 'List / Search Clients' },
      { id: 'crm-create-client', title: 'Create Client' },
      { id: 'crm-get-client', title: 'Get Client' },
      { id: 'crm-update-client', title: 'Update Client' },
      { id: 'crm-list-bf', title: 'List Booking Forms' },
      { id: 'crm-get-bf', title: 'Get Booking Form' },
      { id: 'crm-create-bf', title: 'Create / Upsert Booking Form' },
      { id: 'crm-update-bf', title: 'Update Booking Form' },
      { id: 'crm-delete-bf', title: 'Delete Booking Form' },
      { id: 'crm-send-editor', title: 'Send to Editor' },
      { id: 'crm-revisions', title: 'Revisions' },
      { id: 'crm-revision-detail', title: 'Revision Detail' }
    ],
    esign: [
      { id: 'es-overview', title: 'Overview' },
      { id: 'es-send', title: 'Send to E-Sign' },
      { id: 'es-sign', title: 'Sign / Change Request' },
      { id: 'es-tokens', title: 'Token System' },
      { id: 'es-status', title: 'Status Changes' }
    ],
    deliverables: [
      { id: 'del-overview', title: 'Overview' },
      { id: 'del-bulk', title: 'Bulk Create' },
      { id: 'del-list', title: 'List Deliverables' },
      { id: 'del-get', title: 'Get Deliverable' },
      { id: 'del-update', title: 'Update Deliverable' },
      { id: 'del-delete', title: 'Delete Deliverable' },
      { id: 'del-routing', title: 'Department Routing' },
      { id: 'del-workflows', title: 'Status Workflows' }
    ],
    voiceover: [
      { id: 'vo-overview', title: 'Overview' },
      { id: 'vo-studio', title: 'Voiceover Studio' },
      { id: 'vo-models', title: 'Choosing a Model' },
      { id: 'vo-settings', title: 'Voice Settings' },
      { id: 'vo-delivery', title: 'Delivery Control' },
      { id: 'vo-pronunciation', title: 'CMU Pronunciation' },
      { id: 'vo-dictionaries', title: 'Pronunciation Dictionaries' },
      { id: 'vo-normalization', title: 'Text Normalization' },
      { id: 'vo-tags', title: 'v3 Audio Tags' },
      { id: 'vo-troubleshooting', title: 'Troubleshooting' },
      { id: 'vo-api', title: 'API Reference' }
    ],
    coolify: [
      { id: 'cf-overview', title: 'Overview' },
      { id: 'cf-auth', title: 'Authentication' },
      { id: 'cf-list-apps', title: 'List Applications' },
      { id: 'cf-get-app', title: 'Get Application' },
      { id: 'cf-update-app', title: 'Update Application' },
      { id: 'cf-deploy', title: 'Deploy' },
      { id: 'cf-status', title: 'Deployment Status' },
      { id: 'cf-restart', title: 'Restart Application' },
      { id: 'cf-envs', title: 'Environment Variables' },
      { id: 'cf-uuids', title: 'Application UUIDs' }
    ]
  };

  function checklistContent() {
    return '<div class="docs-section" id="cl-overview"><h1>Checklist API</h1><p>The Checklist is a client-side multi-step wizard that collects campaign requirements across 11 steps. It runs as a static site and submits data to the CRM API.</p><table><tr><th>URL</th><td><code>http://kgso4o000o48kww4k4c8048c.148.230.100.16.sslip.io</code></td></tr><tr><th>Type</th><td>Static HTML + vanilla JS</td></tr><tr><th>Steps</th><td>Client Info, Social Media, Agri4All, Online, Banners, Magazine, Video, Website, Financials, Sign-off, Review</td></tr></table></div>'
    + '<div class="docs-section" id="cl-flow"><h2>Submission Flow</h2><p>When the user clicks Submit:</p><ol><li><strong>POST /api/clients</strong> — Creates the client (if not from autocomplete)</li><li><strong>POST /api/booking-forms</strong> — Creates/upserts booking form with full formData</li><li><strong>POST /api/booking-forms/:id/send-to-editor</strong> — Generates editable booking form HTML</li><li><strong>POST /api/deliverables/bulk</strong> — Creates per-month deliverables</li><li><strong>Redirect</strong> — Browser navigates to the editable booking form URL</li></ol><pre><code>const bfRes = await fetch(CRM_API + "/booking-forms", { method: "POST", body: JSON.stringify(bfBody) });\nconst bfData = await bfRes.json();\nawait fetch(CRM_API + "/booking-forms/" + bfData.id + "/send-to-editor", { method: "POST" });\nawait fetch(CRM_API + "/deliverables/bulk", { method: "POST", body: JSON.stringify({ bookingFormId: bfData.id }) });\nwindow.location.href = editableUrl;</code></pre></div>'
    + '<div class="docs-section" id="cl-data"><h2>Data Format</h2><p>The <code>formData</code> payload (snake_case):</p><pre><code>{\n  "client_information": { "company_name": "...", "campaign_start": "2026-06", ... },\n  "social_media_management": [\n    { "month_label": "All Months", "monthly_posts": 12, "content_calendar": true,\n      "own_page": { "facebook_posts": true, "facebook_posts_amount": 8, ... },\n      "google_ads": { "enabled": true, "initial_setup_text": "...", "monthly_ongoing_text": "..." } }\n  ],\n  "agri4all": [{ "month_label": "...", "country": "...", "state": { ... } }],\n  "online_articles": [{ "platforms": [...], "amount": 2 }],\n  "banners": [{ "entries": [{ "platform": "...", "impressions": 50000 }] }],\n  "magazine": [{ "magazine": "SA Digital", "page_size": "Full Page", "type": "Advert" }],\n  "video": [{ "video_type": "Corporate", "video_duration": "60 seconds" }],\n  "website": [{ "website_type": "Website Design & Development", "number_of_pages": "5-10" }],\n  "financial_totals": { "subtotal": "30000", "tax": "4500", "total": "34500" },\n  "sign_off": { "date": "2026-04-12", "representative": "Daniel" }\n}</code></pre></div>'
    + '<div class="docs-section" id="cl-id"><h2>Checklist ID Generation</h2><pre><code>input  = (clientName + "|" + campaignStart + "|" + campaignEnd).toLowerCase()\nhash   = Java-style hashCode\nresult = "CL-" + abs(hash).toString(36).toUpperCase().slice(0, 6)</code></pre></div>'
    + '<div class="docs-section" id="cl-prefill"><h2>Prefill URL</h2><p>Checklist can be reopened with prefilled data via URL hash: <code>#prefill=&lt;compressed-base64&gt;</code></p></div>'
    + '<div class="docs-section" id="cl-test"><h2>Test Data</h2><p>The "Fill Test Data" button on Step 1 populates all fields with sample data for development testing.</p></div>';
  }

  function editorContent() {
    var B = 'https://bookingformeditor.proagrihub.com';
    return '<div class="docs-section" id="eb-overview"><h1>Editable Booking Form API</h1><p>Generates, stores, and serves editable HTML booking forms from checklist data.</p><table><tr><th>Base URL</th><td><code>' + esc(B) + '</code></td></tr><tr><th>Auth</th><td>None</td></tr><tr><th>Max Body</th><td>25 MB</td></tr></table></div>'
    + '<div class="docs-section" id="eb-health"><h2>' + m('GET') + ' <span class="docs-path">/</span></h2><p>Health check.</p><pre><code>{ "status": "ok" }</code></pre></div>'
    + '<div class="docs-section" id="eb-create"><h2>' + m('POST') + ' <span class="docs-path">/create</span></h2><p>Create or overwrite a page. Snippets are injected into the base template.</p><h3>Request</h3><pre><code>{ "slug": "acme-22", "html": "&lt;table&gt;...&lt;/table&gt;" }</code></pre><h3>Response <span class="docs-status ok">200</span></h3><pre><code>{ "success": true, "url": "' + esc(B) + '/pages/acme-22.html", "slug": "acme-22" }</code></pre></div>'
    + '<div class="docs-section" id="eb-list"><h2>' + m('GET') + ' <span class="docs-path">/pages</span></h2><p>List all generated pages with metadata.</p><pre><code>{ "pages": [{ "slug": "...", "filename": "...", "url": "...", "size": 24000, "createdAt": "...", "modifiedAt": "..." }], "total": 1 }</code></pre></div>'
    + '<div class="docs-section" id="eb-view"><h2>' + m('GET') + ' <span class="docs-path">/pages/{slug}.html</span></h2><p>View a generated editable booking form page.</p></div>'
    + '<div class="docs-section" id="eb-delete"><h2>' + m('DELETE') + ' <span class="docs-path">/pages/{slug}</span></h2><p>Delete a page.</p><pre><code>{ "success": true, "deleted": "acme-22" }</code></pre><table><tr><th>Code</th><th>Reason</th></tr><tr><td>400</td><td>Invalid slug</td></tr><tr><td>404</td><td>Page not found</td></tr></table></div>'
    + '<div class="docs-section" id="eb-send-webhook"><h2>' + m('POST') + ' <span class="docs-path">/send-to-n8n</span></h2><p>Forward edited form to webhook. Used by "Send to ProAgri" button.</p><pre><code>{ "slug": "...", "url": "...", "html": "...", "header": { "logoBase64": "...", "addressHtml": "..." }, "bookingFormCompanyName": "..." }</code></pre></div>'
    + '<div class="docs-section" id="eb-send-crm"><h2>' + m('POST') + ' <span class="docs-path">/send-to-crm/{slug}</span></h2><p>Proxy edited form to CRM API (avoids CORS).</p></div>'
    + '<div class="docs-section" id="eb-send-esign"><h2>' + m('POST') + ' <span class="docs-path">/send-to-esign/{slug}</span></h2><p>Create read-only e-sign version.</p></div>'
    + '<div class="docs-section" id="eb-template"><h2>Template System</h2><p><code>templates/base.html</code> provides the page skeleton. Snippets injected at <code>&lt;!--CONTENT_SNIPPET--&gt;</code>. Features: editable cells, logo upload, header persistence via localStorage.</p></div>';
  }

  function crmContent() {
    var A = 'https://agri360.proagrihub.com/api';
    return '<div class="docs-section" id="crm-overview"><h1>CRM API</h1><p>Express 5 + PostgreSQL backend. Manages clients, booking forms, deliverables, and workflows.</p><table><tr><th>Base URL</th><td><code>' + esc(A) + '</code></td></tr><tr><th>Format</th><td>JSON (snake_case DB, camelCase API)</td></tr></table></div>'
    + '<div class="docs-section" id="crm-auth"><h2>Authentication</h2><p><code>AUTH_ENABLED=false</code> (default): no token needed. When enabled:</p><pre><code>Authorization: Bearer &lt;jwt-token&gt;</code></pre></div>'
    + '<div class="docs-section" id="crm-list-clients"><h2>' + m('GET') + ' <span class="docs-path">/api/clients</span></h2><p>List/search clients.</p><table><tr><th>Param</th><th>Description</th></tr><tr><td><code>?search=term</code></td><td>Search by name</td></tr><tr><td><code>?limit=N</code></td><td>Limit results</td></tr></table></div>'
    + '<div class="docs-section" id="crm-create-client"><h2>' + m('POST') + ' <span class="docs-path">/api/clients</span></h2><h3>Request</h3><pre><code>{\n  "name": "Acme Farms", "tradingName": "Acme",\n  "companyRegNo": "2025/001/07", "vatNumber": "412345",\n  "website": "https://acme.co.za",\n  "primaryContact": { "name": "John", "email": "john@acme.co.za", "cell": "082...", "tel": "012..." },\n  "materialContact": { ... }, "accountsContact": { ... }\n}</code></pre><h3>Response <span class="docs-status ok">201</span></h3><pre><code>{ "id": 28, "name": "Acme Farms", "status": "active", ... }</code></pre></div>'
    + '<div class="docs-section" id="crm-get-client"><h2>' + m('GET') + ' <span class="docs-path">/api/clients/:id</span></h2><p>Get single client with all contact details.</p></div>'
    + '<div class="docs-section" id="crm-update-client"><h2>' + m('PATCH') + ' <span class="docs-path">/api/clients/:id</span></h2><p>Update specific client fields.</p></div>'
    + '<div class="docs-section" id="crm-list-bf"><h2>' + m('GET') + ' <span class="docs-path">/api/booking-forms</span></h2><p>List all booking forms.</p><table><tr><th>Param</th><th>Description</th></tr><tr><td><code>?department=slug</code></td><td>Filter by department</td></tr></table></div>'
    + '<div class="docs-section" id="crm-get-bf"><h2>' + m('GET') + ' <span class="docs-path">/api/booking-forms/:id</span></h2><p>Get single booking form with full client details (47+ fields).</p></div>'
    + '<div class="docs-section" id="crm-create-bf"><h2>' + m('POST') + ' <span class="docs-path">/api/booking-forms</span></h2><p>Create or upsert. Upserts by <code>checklistId</code>.</p><h3>Request</h3><pre><code>{\n  "clientId": 28, "title": "Acme - Proposal",\n  "status": "outline_proposal", "formData": { ... },\n  "checklistId": "CL-ABC123", "checklistUrl": "https://...",\n  "campaignMonthStart": "2026-06", "campaignMonthEnd": "2026-08"\n}</code></pre><h3>Response <span class="docs-status ok">201</span>/<span class="docs-status ok">200</span></h3><pre><code>{ "id": 22, "clientId": 28, "checklistId": "CL-ABC123", ... }</code></pre><table><tr><th>Code</th><th>Reason</th></tr><tr><td>400</td><td>client_id is required</td></tr></table></div>'
    + '<div class="docs-section" id="crm-update-bf"><h2>' + m('PATCH') + ' <span class="docs-path">/api/booking-forms/:id</span></h2><p>Update fields. Auto-generates esign URL when status reaches <code>booking_form_ready</code>.</p></div>'
    + '<div class="docs-section" id="crm-delete-bf"><h2>' + m('DELETE') + ' <span class="docs-path">/api/booking-forms/:id</span></h2><pre><code>{ "success": true }</code></pre></div>'
    + '<div class="docs-section" id="crm-send-editor"><h2>' + m('POST') + ' <span class="docs-path">/api/booking-forms/:id/send-to-editor</span></h2><p>Generate editable booking form HTML. Runs format-deliverables locally, POSTs to editor service.</p><h3>No body required</h3><ol><li>Reads booking form + client from DB</li><li>Generates slug: <code>{clientName}-{id}</code></li><li>Runs format-deliverables → HTML</li><li>Wraps in company info + contacts + deliverables table + footer</li><li>POSTs to editor service <code>/create</code></li><li>Stores <code>editableUrl</code></li></ol><pre><code>{ "success": true, "editableUrl": "https://bookingformeditor.proagrihub.com/pages/acme-22.html", "slug": "acme-22" }</code></pre></div>'
    + '<div class="docs-section" id="crm-revisions"><h2>' + m('GET') + ' <span class="docs-path">/api/booking-forms/:id/revisions</span></h2><p>Immutable audit trail. Heavy fields excluded from list.</p><pre><code>[{ "id": 1, "action": "signed", "signerName": "John", "createdAt": "..." }]</code></pre></div>'
    + '<div class="docs-section" id="crm-revision-detail"><h2>' + m('GET') + ' <span class="docs-path">/api/booking-forms/:id/revisions/:revisionId</span></h2><p>Full revision with HTML snapshot and PDF.</p></div>';
  }

  function esignContent() {
    return '<div class="docs-section" id="es-overview"><h1>E-Sign API</h1><p>Handles booking form e-signatures with tokens and immutable revisions.</p><table><tr><th>Base URL</th><td><code>https://agri360.proagrihub.com/api</code></td></tr></table></div>'
    + '<div class="docs-section" id="es-send"><h2>' + m('POST') + ' <span class="docs-path">/api/booking-forms/:id/send-to-esign</span></h2><h3>Request (optional)</h3><pre><code>{ "html": "...", "slug": "custom-slug" }</code></pre><h3>Response <span class="docs-status ok">200</span></h3><pre><code>{ "success": true, "esignUrl": "https://bookingformesign.proagrihub.com/sign/...", "slug": "..." }</code></pre></div>'
    + '<div class="docs-section" id="es-sign"><h2>' + m('POST') + ' <span class="docs-path">/api/booking-forms/:id/sign</span></h2><pre><code>{\n  "action": "signed",\n  "pdfData": "base64...",\n  "signatureData": { ... },\n  "signerName": "John Doe",\n  "signerEmail": "john@acme.co.za"\n}</code></pre><p><code>action</code>: <code>"signed"</code> or <code>"change_request"</code></p></div>'
    + '<div class="docs-section" id="es-tokens"><h2>Token System</h2><p><code>booking_form_esign_tokens</code> table stores signing tokens linked to frozen HTML snapshots.</p><table><tr><th>Column</th><th>Description</th></tr><tr><td>token</td><td>Unique signing token (VARCHAR 64)</td></tr><tr><td>html_snapshot</td><td>Frozen form HTML</td></tr><tr><td>expires_at</td><td>Token expiration</td></tr></table></div>'
    + '<div class="docs-section" id="es-status"><h2>Status Changes</h2><table><tr><th>Action</th><th>Status</th><th>Department</th></tr><tr><td>signed</td><td>onboarding</td><td>admin-onboarding</td></tr><tr><td>change_request</td><td>change_requested</td><td>(unchanged)</td></tr></table></div>';
  }

  function deliverablesContent() {
    return '<div class="docs-section" id="del-overview"><h1>Deliverables API</h1><p>Individual tasks generated from booking form data — one per service per month. Flow between departments via status workflows.</p><table><tr><th>Base URL</th><td><code>https://agri360.proagrihub.com/api</code></td></tr></table></div>'
    + '<div class="docs-section" id="del-bulk"><h2>' + m('POST') + ' <span class="docs-path">/api/deliverables/bulk</span></h2><p>Create deliverables from booking form. <strong>Idempotent.</strong></p><pre><code>{ "bookingFormId": 28 }</code></pre><h3>Service Detection</h3><table><tr><th>formData Field</th><th>Type</th><th>Initial Status</th></tr><tr><td>social_media_management[]</td><td>sm-posts</td><td>request_client_materials</td></tr><tr><td>↳ content_calendar</td><td>sm-content-calendar</td><td>request_focus_points</td></tr><tr><td>↳ google_ads.enabled</td><td>sm-google-ads</td><td>request_client_materials</td></tr><tr><td>↳ own_page (any)</td><td>sm-posts (Own Page)</td><td>request_client_materials</td></tr><tr><td>agri4all[]</td><td>agri4all-posts</td><td>request_client_materials</td></tr><tr><td>online_articles[]</td><td>online-articles</td><td>request_client_materials</td></tr><tr><td>banners[]</td><td>agri4all-banners</td><td>design</td></tr><tr><td>magazine[]</td><td>magazine</td><td>request_client_materials</td></tr><tr><td>video[]</td><td>video</td><td>send_request_form</td></tr><tr><td>website[]</td><td>website-design</td><td>request_client_materials</td></tr></table><h3>Response <span class="docs-status ok">201</span></h3><pre><code>{ "totalCreated": 12, "byType": { "sm-posts": 4, ... }, "deliverables": [...] }</code></pre></div>'
    + '<div class="docs-section" id="del-list"><h2>' + m('GET') + ' <span class="docs-path">/api/deliverables</span></h2><table><tr><th>Param</th><th>Description</th></tr><tr><td>?bookingFormId=28</td><td>Filter by booking form</td></tr><tr><td>?clientId=34</td><td>Filter by client</td></tr><tr><td>?department=production</td><td>Filter by department</td></tr><tr><td>?status=design</td><td>Filter by status</td></tr></table></div>'
    + '<div class="docs-section" id="del-get"><h2>' + m('GET') + ' <span class="docs-path">/api/deliverables/:id</span></h2><p>Get single deliverable.</p></div>'
    + '<div class="docs-section" id="del-update"><h2>' + m('PATCH') + ' <span class="docs-path">/api/deliverables/:id</span></h2><p>Update status, assignedTo, dueDate, etc. Status changes auto-route to correct department.</p></div>'
    + '<div class="docs-section" id="del-delete"><h2>' + m('DELETE') + ' <span class="docs-path">/api/deliverables/:id</span></h2><p>Delete a deliverable.</p></div>'
    + '<div class="docs-section" id="del-routing"><h2>Department Routing</h2><p><code>DEPT_MAPS</code> maps type + status → department slug.</p><pre><code>"sm-content-calendar": {\n  "request_focus_points": "production",\n  "design": "design",\n  "design_review": "production",\n  "proofread": "editorial",\n  "approved": "social-media",\n  "scheduled": "social-media",\n  "posted": "social-media"\n}</code></pre></div>'
    + '<div class="docs-section" id="del-workflows"><h2>Status Workflows</h2><p>Content Calendar:</p><pre><code>request_focus_points → focus_points_received → design → design_review\n  → proofread → approved → scheduled → posted\n  ↳ design_changes → design\n  ↳ client_changes → design_review</code></pre></div>';
  }

  function coolifyContent() {
    var C = 'https://coolify.proagrihub.com/api/v1';
    return '<div class="docs-section" id="cf-overview"><h1>Coolify API</h1><p>Manages all Docker deployments. Deploy, restart, check status, manage env vars.</p><table><tr><th>Base URL</th><td><code>' + esc(C) + '</code></td></tr><tr><th>Auth</th><td>Bearer token (COOLIFY_API_TOKEN)</td></tr></table></div>'
    + '<div class="docs-section" id="cf-auth"><h2>Authentication</h2><pre><code>Authorization: Bearer &lt;COOLIFY_API_TOKEN&gt;</code></pre></div>'
    + '<div class="docs-section" id="cf-list-apps"><h2>' + m('GET') + ' <span class="docs-path">/api/v1/applications</span></h2><p>List all applications.</p><pre><code>[{ "uuid": "tows08oogko8k4wk84g40oo4", "name": "agri360-crm", "fqdn": "https://agri360.proagrihub.com" }]</code></pre></div>'
    + '<div class="docs-section" id="cf-get-app"><h2>' + m('GET') + ' <span class="docs-path">/api/v1/applications/:uuid</span></h2><p>Get full app config.</p></div>'
    + '<div class="docs-section" id="cf-update-app"><h2>' + m('PATCH') + ' <span class="docs-path">/api/v1/applications/:uuid</span></h2><pre><code>{ "domains": "https://new.com,https://old.com" }</code></pre></div>'
    + '<div class="docs-section" id="cf-deploy"><h2>' + m('POST') + ' <span class="docs-path">/api/v1/deploy?uuid=XXX</span></h2><p>Trigger deployment.</p><pre><code>{ "deployments": [{ "message": "deployment queued.", "deployment_uuid": "abc..." }] }</code></pre></div>'
    + '<div class="docs-section" id="cf-status"><h2>' + m('GET') + ' <span class="docs-path">/api/v1/deployments/:uuid</span></h2><pre><code>{ "status": "finished", "commit": "abc12345" }</code></pre><p>Statuses: <code>queued, in_progress, finished, failed</code></p></div>'
    + '<div class="docs-section" id="cf-restart"><h2>' + m('POST') + ' <span class="docs-path">/api/v1/applications/:uuid/restart</span></h2><pre><code>{ "message": "Restart request queued." }</code></pre></div>'
    + '<div class="docs-section" id="cf-envs"><h2>' + m('POST') + ' <span class="docs-path">/api/v1/applications/:uuid/envs</span></h2><pre><code>{ "key": "MY_VAR", "value": "my-value", "is_preview": false }</code></pre></div>'
    + '<div class="docs-section" id="cf-uuids"><h2>Application UUIDs</h2><table><tr><th>App</th><th>UUID</th><th>Domain</th></tr><tr><td>CRM</td><td><code>tows08oogko8k4wk84g40oo4</code></td><td>agri360.proagrihub.com</td></tr><tr><td>Checklist</td><td><code>kgso4o000o48kww4k4c8048c</code></td><td>kgso4o...sslip.io</td></tr><tr><td>Editor</td><td><code>agw8ggg000sgkgs0ok0k04wg</code></td><td>bookingformeditor.proagrihub.com</td></tr><tr><td>E-Sign</td><td><code>too4c4gww8s8kwskk848kkcs</code></td><td>bookingformesign.proagrihub.com</td></tr><tr><td>Client Lookup</td><td><code>zgk4co44o0o4804c80s0sc4w</code></td><td>clientlookup.proagrihub.com</td></tr></table></div>';
  }

  var contentBuilders = {
    'checklist': checklistContent,
    'editable-booking-form': editorContent,
    'crm': crmContent,
    'esign': esignContent,
    'deliverables': deliverablesContent,
    'coolify': coolifyContent
  };

  window.getDocsApiSections = function (apiKey) {
    return apiSections[apiKey] || [];
  };

  window.showDocsApi = function (container, apiKey) {
    while (container.firstChild) container.removeChild(container.firstChild);
    var wrap = document.createElement('div');
    wrap.className = 'docs-content';
    wrap.innerHTML = contentBuilders[apiKey] ? contentBuilders[apiKey]() : '<p>Unknown API: ' + esc(apiKey) + '</p>';
    container.appendChild(wrap);
  };

  window.renderDocsPage = function (container) {
    while (container.firstChild) container.removeChild(container.firstChild);
    var wrap = document.createElement('div');
    wrap.className = 'docs-content';
    wrap.innerHTML = '<div style="text-align:center;padding:60px 20px;">'
      + '<svg width="64" height="64" viewBox="0 0 24 24" fill="currentColor" style="opacity:0.15;margin-bottom:16px;"><path d="M14 2H6c-1.1 0-2 .9-2 2v16c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V8l-6-6zm2 16H8v-2h8v2zm0-4H8v-2h8v2zm-3-5V3.5L18.5 9H13z"/></svg>'
      + '<h2 style="color:var(--brand-navy);margin:0 0 8px;">API Documentation</h2>'
      + '<p style="color:var(--muted);max-width:400px;margin:0 auto;">Select an API from the sidebar to view its documentation.</p></div>';
    container.appendChild(wrap);
  };
})();
