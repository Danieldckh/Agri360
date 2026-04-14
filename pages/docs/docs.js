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

  function voiceoverContent() {
    return '<div class="docs-section" id="vo-overview"><h1>Voice Over Agent — ElevenLabs Guide</h1>'
    + '<p>Practical reference for creating professional voiceovers using ElevenLabs. Covers the Voiceover Studio workflow, voice settings, pronunciation control (CMU/SSML), and best practices for natural-sounding audio.</p>'
    + '<table><tr><th>Platform</th><td><a href="https://elevenlabs.io" target="_blank">elevenlabs.io</a></td></tr>'
    + '<tr><th>API Base</th><td><code>https://api.elevenlabs.io/v1</code></td></tr>'
    + '<tr><th>Languages</th><td>70+ (v3), 29 (Multilingual v2), 32 (Flash v2.5)</td></tr>'
    + '<tr><th>Voice Library</th><td>3,000+ community voices + cloning</td></tr></table></div>'
    // ── Voiceover Studio ──
    + '<div class="docs-section" id="vo-studio"><h2>Voiceover Studio Workflow</h2>'
    + '<h3>Quick Start</h3>'
    + '<ol><li>Open <strong>Voiceover Studio</strong> from the ElevenLabs dashboard</li>'
    + '<li>Upload a CSV script or type directly in the editor</li>'
    + '<li>Assign a voice to each speaker/track</li>'
    + '<li>Click <strong>Generate</strong> to synthesize each clip</li>'
    + '<li>Arrange clips on the timeline, add SFX if needed</li>'
    + '<li>Click <strong>Export</strong> — choose MP3, WAV, etc.</li></ol>'
    + '<h3>CSV Import Formats</h3>'
    + '<table><tr><th>Format</th><th>Columns</th></tr>'
    + '<tr><td>Basic</td><td><code>speaker</code>, <code>line</code></td></tr>'
    + '<tr><td>Timed</td><td><code>speaker</code>, <code>line</code>, <code>start_time</code>, <code>end_time</code></td></tr></table>'
    + '<h3>Timeline &amp; Clips</h3>'
    + '<ul><li>Each row = a <strong>track</strong> (one speaker or SFX channel)</li>'
    + '<li>Click anywhere on a track to create a new <strong>clip</strong></li>'
    + '<li><strong>Dynamic Duration</strong> (default): clip length adapts to text + voice for natural pacing</li>'
    + '<li>Disable Dynamic Duration to manually set clip start/end times</li></ul>'
    + '<h3>Sound Effects</h3>'
    + '<ol><li>Add a <strong>SFX track</strong></li><li>Click on it to create a SFX clip</li>'
    + '<li>Write a prompt (e.g. "gentle rain on a window")</li><li>Click <strong>Generate</strong></li></ol>'
    + '<h3>Export Formats</h3>'
    + '<table><tr><th>Format</th><th>Details</th></tr>'
    + '<tr><td>MP3</td><td>22.05–44.1 kHz, 32–192 kbps</td></tr>'
    + '<tr><td>WAV</td><td>Lossless, larger files</td></tr>'
    + '<tr><td>PCM</td><td>16–44.1 kHz, 16-bit</td></tr>'
    + '<tr><td>Opus</td><td>48 kHz, 32–192 kbps</td></tr></table></div>'
    // ── Models ──
    + '<div class="docs-section" id="vo-models"><h2>Choosing a Model</h2>'
    + '<table><tr><th>Model</th><th>Languages</th><th>Char Limit</th><th>Best For</th></tr>'
    + '<tr><td><strong>Eleven v3</strong></td><td>70+</td><td>5,000</td><td>Most expressive; dramatic delivery, dialogue</td></tr>'
    + '<tr><td><strong>Eleven Multilingual v2</strong></td><td>29</td><td>10,000</td><td>Highest quality; long-form, stable narration</td></tr>'
    + '<tr><td><strong>Eleven Flash v2.5</strong></td><td>32</td><td>40,000</td><td>Real-time (~75ms); cost-effective</td></tr>'
    + '<tr><td><strong>Eleven Flash v2</strong></td><td>—</td><td>—</td><td>Supports SSML phoneme tags</td></tr>'
    + '<tr><td><strong>Eleven English v1</strong></td><td>1</td><td>—</td><td>Legacy; supports SSML phoneme tags</td></tr></table>'
    + '<h3>Rule of Thumb</h3>'
    + '<ul><li>Long narrations → <strong>Multilingual v2</strong> (most stable)</li>'
    + '<li>Expressive dialogue → <strong>v3</strong> (best emotion)</li>'
    + '<li>Bulk / real-time → <strong>Flash v2.5</strong> (fastest, cheapest)</li>'
    + '<li>Need phoneme control → <strong>Flash v2</strong> (only model supporting <code>&lt;phoneme&gt;</code> tags)</li></ul></div>'
    // ── Voice Settings ──
    + '<div class="docs-section" id="vo-settings"><h2>Voice Settings</h2>'
    + '<table><tr><th>Setting</th><th>Range</th><th>Default</th><th>What It Does</th></tr>'
    + '<tr><td><strong>Stability</strong></td><td>0–1</td><td>~0.5</td><td>Higher = more consistent; lower = more expressive but variable</td></tr>'
    + '<tr><td><strong>Similarity Boost</strong></td><td>0–1</td><td>~0.75</td><td>Higher = closer to original voice; lower = more creative</td></tr>'
    + '<tr><td><strong>Style</strong></td><td>0–1</td><td>0</td><td>Amplifies speaker\'s original style; higher = more dramatic</td></tr>'
    + '<tr><td><strong>Speed</strong></td><td>0.7–1.2</td><td>1.0</td><td>Playback rate; extreme values may reduce quality</td></tr>'
    + '<tr><td><strong>Speaker Boost</strong></td><td>bool</td><td>true</td><td>Enhances voice clarity; disable for faster processing</td></tr></table>'
    + '<h3>Recommended Starting Points</h3>'
    + '<table><tr><th>Use Case</th><th>Stability</th><th>Similarity</th><th>Style</th><th>Speed</th></tr>'
    + '<tr><td>Standard narration</td><td>0.50</td><td>0.75</td><td>0.00</td><td>1.0</td></tr>'
    + '<tr><td>Expressive dialogue</td><td>0.30</td><td>0.75</td><td>0.40</td><td>1.0</td></tr>'
    + '<tr><td>Consistent branding</td><td>0.70</td><td>0.85</td><td>0.00</td><td>1.0</td></tr>'
    + '<tr><td>Fast promo read</td><td>0.50</td><td>0.75</td><td>0.20</td><td>1.1</td></tr></table>'
    + '<h3>v3 Stability Presets</h3>'
    + '<table><tr><th>Preset</th><th>Behavior</th></tr>'
    + '<tr><td><strong>Creative</strong></td><td>Most expressive, but prone to occasional hallucinations</td></tr>'
    + '<tr><td><strong>Natural</strong></td><td>Balanced — closest to original voice</td></tr>'
    + '<tr><td><strong>Robust</strong></td><td>Highly stable but less responsive to directional prompts</td></tr></table></div>'
    // ── Delivery Control ──
    + '<div class="docs-section" id="vo-delivery"><h2>Delivery Control</h2>'
    + '<h3>Pauses</h3>'
    + '<p><strong>Models with SSML support</strong> (Flash v2, English v1):</p>'
    + '<pre><code>&lt;break time="1.5s" /&gt;</code></pre>'
    + '<ul><li>Maximum 3 seconds per break</li><li>Too many break tags in one generation can cause instability</li></ul>'
    + '<p><strong>v3 and other models</strong> (no SSML breaks):</p>'
    + '<ul><li>Ellipses <code>...</code> for a weighted pause</li>'
    + '<li>Dashes <code>—</code> or <code>--</code> for a shorter pause</li>'
    + '<li>Line breaks to separate thoughts</li></ul>'
    + '<h3>Emotion</h3>'
    + '<p>Emotion is driven by <strong>text context</strong>, not settings sliders:</p>'
    + '<ul><li>Add narrative cues: <em>"she whispered nervously"</em>, <em>"he announced proudly"</em></li>'
    + '<li>Explicit dialogue tags yield more predictable results than context alone</li>'
    + '<li>Match voice to emotion — a calm voice won\'t shout convincingly</li>'
    + '<li>Generate with cues, then remove them from the final script if needed</li></ul>'
    + '<h3>Pacing</h3>'
    + '<ul><li>Adjust <strong>Speed</strong> (0.7–1.2) for global pace</li>'
    + '<li>Commas = brief pauses, periods = full stops</li>'
    + '<li>CAPITALIZATION adds emphasis on specific words</li></ul></div>'
    // ── CMU Pronunciation ──
    + '<div class="docs-section" id="vo-pronunciation"><h2>CMU Pronunciation Guide (SSML Phoneme Control)</h2>'
    + '<div style="background:var(--bg-warning,#fff3cd);border:1px solid var(--border-warning,#ffc107);border-radius:8px;padding:12px 16px;margin-bottom:16px;">'
    + '<strong>Important:</strong> Phoneme tags only work with <strong>Eleven Flash v2</strong> and <strong>Eleven English v1</strong>. Other models silently ignore them. Phoneme tags only work for <strong>English</strong> — for other languages, use alias tags.</div>'
    + '<h3>What Is CMU?</h3>'
    + '<p>CMU (Carnegie Mellon Pronouncing Dictionary) represents words as sequences of <strong>ARPABET phonemes</strong> — a standardized sound notation system.</p>'
    + '<p>Example: <code>"hello"</code> → <code>HH AH0 L OW1</code></p>'
    + '<h3>SSML Phoneme Tag Structure</h3>'
    + '<pre><code>&lt;phoneme alphabet="cmu-arpabet" ph="HH AH0 L OW1"&gt;hello&lt;/phoneme&gt;</code></pre>'
    + '<table><tr><th>Attribute</th><th>Value</th><th>Purpose</th></tr>'
    + '<tr><td><code>alphabet</code></td><td><code>"cmu-arpabet"</code> or <code>"ipa"</code></td><td>Which phoneme system</td></tr>'
    + '<tr><td><code>ph</code></td><td>phoneme string</td><td>The pronunciation</td></tr>'
    + '<tr><td>Inner text</td><td>the word</td><td>Fallback / display text</td></tr></table>'
    + '<h3>Consonants</h3>'
    + '<table><tr><th>Sound</th><th>CMU</th><th>Example</th></tr>'
    + '<tr><td>b</td><td>B</td><td><strong>b</strong>at</td></tr>'
    + '<tr><td>d</td><td>D</td><td><strong>d</strong>og</td></tr>'
    + '<tr><td>f</td><td>F</td><td><strong>f</strong>an</td></tr>'
    + '<tr><td>g</td><td>G</td><td><strong>g</strong>oat</td></tr>'
    + '<tr><td>h</td><td>HH</td><td><strong>h</strong>at</td></tr>'
    + '<tr><td>j (jar)</td><td>JH</td><td><strong>j</strong>oy</td></tr>'
    + '<tr><td>k</td><td>K</td><td><strong>k</strong>ite</td></tr>'
    + '<tr><td>l</td><td>L</td><td><strong>l</strong>eg</td></tr>'
    + '<tr><td>m</td><td>M</td><td><strong>m</strong>an</td></tr>'
    + '<tr><td>n</td><td>N</td><td><strong>n</strong>et</td></tr>'
    + '<tr><td>ng</td><td>NG</td><td>si<strong>ng</strong></td></tr>'
    + '<tr><td>p</td><td>P</td><td><strong>p</strong>en</td></tr>'
    + '<tr><td>r</td><td>R</td><td><strong>r</strong>ed</td></tr>'
    + '<tr><td>s</td><td>S</td><td><strong>s</strong>un</td></tr>'
    + '<tr><td>sh</td><td>SH</td><td><strong>sh</strong>ip</td></tr>'
    + '<tr><td>t</td><td>T</td><td><strong>t</strong>op</td></tr>'
    + '<tr><td>th (thin)</td><td>TH</td><td><strong>th</strong>ink</td></tr>'
    + '<tr><td>th (this)</td><td>DH</td><td><strong>th</strong>is</td></tr>'
    + '<tr><td>v</td><td>V</td><td><strong>v</strong>an</td></tr>'
    + '<tr><td>w</td><td>W</td><td><strong>w</strong>et</td></tr>'
    + '<tr><td>y</td><td>Y</td><td><strong>y</strong>es</td></tr>'
    + '<tr><td>z</td><td>Z</td><td><strong>z</strong>oo</td></tr>'
    + '<tr><td>zh</td><td>ZH</td><td>mea<strong>s</strong>ure</td></tr>'
    + '<tr><td>ch</td><td>CH</td><td><strong>ch</strong>in</td></tr></table>'
    + '<h3>Vowels (with Stress Markers)</h3>'
    + '<table><tr><th>Sound</th><th>CMU</th><th>Example</th></tr>'
    + '<tr><td>ah (sofa)</td><td>AH0 / AH1</td><td><strong>a</strong>bout</td></tr>'
    + '<tr><td>ae (cat)</td><td>AE1</td><td>c<strong>a</strong>t</td></tr>'
    + '<tr><td>ee (see)</td><td>IY1</td><td>s<strong>ee</strong></td></tr>'
    + '<tr><td>eh (bed)</td><td>EH1</td><td>b<strong>e</strong>d</td></tr>'
    + '<tr><td>ih (sit)</td><td>IH1</td><td>s<strong>i</strong>t</td></tr>'
    + '<tr><td>oh (go)</td><td>OW1</td><td>g<strong>o</strong></td></tr>'
    + '<tr><td>oo (blue)</td><td>UW1</td><td>bl<strong>ue</strong></td></tr>'
    + '<tr><td>uh (put)</td><td>UH1</td><td>p<strong>u</strong>t</td></tr>'
    + '<tr><td>aw (saw)</td><td>AO1</td><td>s<strong>aw</strong></td></tr>'
    + '<tr><td>er (bird)</td><td>ER1</td><td>b<strong>ir</strong>d</td></tr>'
    + '<tr><td>ay (my)</td><td>AY1</td><td>m<strong>y</strong></td></tr>'
    + '<tr><td>oy (boy)</td><td>OY1</td><td>b<strong>oy</strong></td></tr>'
    + '<tr><td>ow (cow)</td><td>AW1</td><td>c<strong>ow</strong></td></tr></table>'
    + '<h3>Stress Markers</h3>'
    + '<table><tr><th>Marker</th><th>Meaning</th><th>Example</th></tr>'
    + '<tr><td><code>0</code></td><td>No stress (unstressed)</td><td><code>AH0</code> in "about"</td></tr>'
    + '<tr><td><code>1</code></td><td>Primary stress</td><td><code>AE1</code> in "cat"</td></tr>'
    + '<tr><td><code>2</code></td><td>Secondary stress</td><td><code>AE2</code> in "trapezoid"</td></tr></table>'
    + '<h3>Step-by-Step: Crafting a Phoneme Tag</h3>'
    + '<ol><li><strong>Break the word into syllables:</strong> "ProAgri" → Pro-Ag-ri</li>'
    + '<li><strong>Map each sound to CMU phonemes:</strong> → <code>P R OW1 AE1 G R IY0</code></li>'
    + '<li><strong>Wrap in SSML:</strong></li></ol>'
    + '<pre><code>&lt;phoneme alphabet="cmu-arpabet" ph="P R OW1 AE1 G R IY0"&gt;ProAgri&lt;/phoneme&gt;</code></pre>'
    + '<h3>Practical Examples</h3>'
    + '<table><tr><th>Word</th><th>SSML</th></tr>'
    + '<tr><td>Daniel</td><td><code>&lt;phoneme alphabet="cmu-arpabet" ph="D AE1 N Y AH0 L"&gt;Daniel&lt;/phoneme&gt;</code></td></tr>'
    + '<tr><td>Nike</td><td><code>&lt;phoneme alphabet="cmu-arpabet" ph="N AY1 K IY0"&gt;Nike&lt;/phoneme&gt;</code></td></tr>'
    + '<tr><td>Xander</td><td><code>&lt;phoneme alphabet="cmu-arpabet" ph="Z AH0 N D ER1"&gt;Xander&lt;/phoneme&gt;</code></td></tr>'
    + '<tr><td>Agri</td><td><code>&lt;phoneme alphabet="cmu-arpabet" ph="AE1 G R IY0"&gt;Agri&lt;/phoneme&gt;</code></td></tr>'
    + '<tr><td>trapezii</td><td><code>&lt;phoneme alphabet="cmu-arpabet" ph="T R AE2 P AH0 Z IY1 AY0"&gt;trapezii&lt;/phoneme&gt;</code></td></tr></table>'
    + '<h3>Tips for Accuracy</h3>'
    + '<ul><li>Start simple — approximate from the closest known word</li>'
    + '<li>Adjust <strong>stress first</strong>, then vowels — stress errors are more noticeable</li>'
    + '<li>Test iteratively — TTS engines may interpret slightly differently between voices</li>'
    + '<li>One phoneme tag per word — each word needs its own wrapper</li>'
    + '<li><strong>CMU over IPA</strong> — CMU Arpabet produces more consistent results with current ElevenLabs models</li></ul>'
    + '<h3>Common Mistakes</h3>'
    + '<table><tr><th>Issue</th><th>Fix</th></tr>'
    + '<tr><td>Missing stress marker</td><td>Add <code>1</code> to the primary syllable vowel</td></tr>'
    + '<tr><td>Overcomplicated phonemes</td><td>Simplify to the closest natural sound</td></tr>'
    + '<tr><td>Wrong vowel</td><td>Swap between AH / AE / EH — common confusions</td></tr>'
    + '<tr><td>Tag ignored</td><td>Check you\'re using Flash v2 or English v1 model</td></tr>'
    + '<tr><td>Non-English word</td><td>Use alias tags instead of phoneme tags</td></tr></table>'
    + '<h3>Debug Strategy</h3>'
    + '<ol><li>Start with the closest real word</li>'
    + '<li>Modify one phoneme at a time</li>'
    + '<li>Adjust stress first, then vowels</li>'
    + '<li>Re-test after each change</li></ol></div>'
    // ── Pronunciation Dictionaries ──
    + '<div class="docs-section" id="vo-dictionaries"><h2>Pronunciation Dictionaries</h2>'
    + '<p>For words that are frequently mispronounced, create a <strong>pronunciation dictionary</strong> instead of adding inline tags every time.</p>'
    + '<h3>PLS File Format (XML)</h3>'
    + '<pre><code>&lt;?xml version="1.0" encoding="UTF-8"?&gt;\n&lt;lexicon version="1.0"\n  xmlns="http://www.w3.org/2005/01/pronunciation-lexicon"\n  alphabet="cmu-arpabet" xml:lang="en-US"&gt;\n  &lt;lexeme&gt;\n    &lt;grapheme&gt;ProAgri&lt;/grapheme&gt;\n    &lt;phoneme&gt;P R OW1 AE1 G R IY0&lt;/phoneme&gt;\n  &lt;/lexeme&gt;\n  &lt;lexeme&gt;\n    &lt;grapheme&gt;Claughton&lt;/grapheme&gt;\n    &lt;alias&gt;Cloffton&lt;/alias&gt;\n  &lt;/lexeme&gt;\n&lt;/lexicon&gt;</code></pre>'
    + '<h3>Key Rules</h3>'
    + '<ul><li><strong>First match wins</strong> — system checks start to end, uses only the first match</li>'
    + '<li><strong>Case-sensitive</strong> — create separate entries for "ProAgri" and "proagri" if needed</li>'
    + '<li>Up to <strong>3 dictionaries</strong> per API call via <code>pronunciation_dictionary_locators</code></li>'
    + '<li><strong>Alias tags work across all models</strong> — use them when phoneme tags aren\'t supported</li>'
    + '<li>Upload via ElevenLabs Studio or the API</li></ul></div>'
    // ── Text Normalization ──
    + '<div class="docs-section" id="vo-normalization"><h2>Text Normalization</h2>'
    + '<p>TTS models work best with <strong>written-out, alphabetical text</strong>. Digits, symbols, and abbreviations often cause mispronunciations.</p>'
    + '<table><tr><th>Raw Text</th><th>Normalized</th></tr>'
    + '<tr><td><code>$42.50</code></td><td>forty-two dollars and fifty cents</td></tr>'
    + '<tr><td><code>123-456-7890</code></td><td>one two three, four five six, seven eight nine zero</td></tr>'
    + '<tr><td><code>9:23 AM</code></td><td>nine twenty-three A M</td></tr>'
    + '<tr><td><code>Dr. Smith</code></td><td>Doctor Smith</td></tr>'
    + '<tr><td><code>5kg</code></td><td>five kilograms</td></tr>'
    + '<tr><td><code>25%</code></td><td>twenty-five percent</td></tr></table>'
    + '<h3>LLM Pre-processing Prompt</h3>'
    + '<pre><code>Convert all numbers, currencies, dates, abbreviations, and symbols\ninto their fully spoken forms suitable for text-to-speech narration.\n"$42.50" → "forty-two dollars and fifty cents"\n"Dr." → "Doctor"</code></pre></div>'
    // ── v3 Audio Tags ──
    + '<div class="docs-section" id="vo-tags"><h2>Eleven v3 Audio Tags</h2>'
    + '<p>v3 introduces <strong>audio tags</strong> — inline text markers that control emotion and sound effects without SSML. <em>v3 only — other models ignore these.</em></p>'
    + '<h3>Emotion Tags</h3>'
    + '<pre><code>[whispers] I never knew it could be this way.\n[sarcastic] Oh, what a surprise.\n[excited] We just hit our target!\n[laughing] That was the funniest thing I\'ve ever heard.\n[sad] I\'m sorry to hear that.\n[angry] This is completely unacceptable.</code></pre>'
    + '<h3>Sound Effect Tags</h3>'
    + '<pre><code>[applause]\n[gunshot]\n[doorbell]\n[thunder]</code></pre>'
    + '<h3>Important Notes</h3>'
    + '<ul><li>Tag effectiveness <strong>depends on the voice</strong> — some respond better than others</li>'
    + '<li>Match the tag to the voice\'s natural range</li>'
    + '<li>Neutral voices provide the widest range of tag responsiveness</li></ul></div>'
    // ── Troubleshooting ──
    + '<div class="docs-section" id="vo-troubleshooting"><h2>Troubleshooting</h2>'
    + '<table><tr><th>Problem</th><th>Likely Cause</th><th>Solution</th></tr>'
    + '<tr><td>Inconsistent voice between clips</td><td>Stability too low</td><td>Increase Stability to 0.6–0.7</td></tr>'
    + '<tr><td>Voice sounds robotic</td><td>Similarity too high</td><td>Lower Similarity Boost to 0.65</td></tr>'
    + '<tr><td>Words mispronounced</td><td>No phoneme control</td><td>Add CMU phoneme tags (Flash v2 only) or use alias dictionary</td></tr>'
    + '<tr><td>Numbers read incorrectly</td><td>Not normalized</td><td>Write out numbers as words</td></tr>'
    + '<tr><td>Phoneme tags ignored</td><td>Wrong model</td><td>Switch to Eleven Flash v2</td></tr>'
    + '<tr><td>Pauses not working</td><td>Using &lt;break&gt; on v3</td><td>Use ellipses <code>...</code> or dashes <code>--</code></td></tr>'
    + '<tr><td>Emotion sounds flat</td><td>Voice doesn\'t match</td><td>Choose voice with wider emotional range; use audio tags on v3</td></tr>'
    + '<tr><td>Hallucinated words</td><td>Too many break tags / long text</td><td>Shorten generation; increase Stability</td></tr>'
    + '<tr><td>Speed sounds unnatural</td><td>Extreme speed value</td><td>Keep Speed between 0.8–1.15</td></tr></table></div>'
    // ── API Reference ──
    + '<div class="docs-section" id="vo-api"><h2>API Quick Reference</h2>'
    + '<h3>' + m('POST') + ' <span class="docs-path">/v1/text-to-speech/{voice_id}</span></h3>'
    + '<p>Generate speech from text.</p>'
    + '<h3>Headers</h3>'
    + '<pre><code>xi-api-key: YOUR_API_KEY\nContent-Type: application/json</code></pre>'
    + '<h3>Request Body</h3>'
    + '<pre><code>{\n  "text": "Your script text here",\n  "model_id": "eleven_multilingual_v2",\n  "voice_settings": {\n    "stability": 0.5,\n    "similarity_boost": 0.75,\n    "style": 0.0,\n    "speed": 1.0,\n    "use_speaker_boost": true\n  }\n}</code></pre>'
    + '<h3>Parameters</h3>'
    + '<table><tr><th>Field</th><th>Type</th><th>Required</th><th>Notes</th></tr>'
    + '<tr><td><code>text</code></td><td>string</td><td>Yes</td><td>Content to synthesize</td></tr>'
    + '<tr><td><code>model_id</code></td><td>string</td><td>No</td><td>Default: <code>eleven_multilingual_v2</code></td></tr>'
    + '<tr><td><code>voice_settings</code></td><td>object</td><td>No</td><td>stability, similarity_boost, style, speed, use_speaker_boost</td></tr>'
    + '<tr><td><code>language_code</code></td><td>string</td><td>No</td><td>ISO 639-1 language code</td></tr>'
    + '<tr><td><code>pronunciation_dictionary_locators</code></td><td>array</td><td>No</td><td>Up to 3 custom pronunciation rules</td></tr>'
    + '<tr><td><code>seed</code></td><td>integer</td><td>No</td><td>For deterministic output (0–4294967295)</td></tr></table>'
    + '<h3>Query Parameters</h3>'
    + '<table><tr><th>Param</th><th>Description</th></tr>'
    + '<tr><td><code>output_format</code></td><td>Default <code>mp3_44100_128</code>. Options: alaw, mp3, opus, pcm, ulaw, wav variants</td></tr>'
    + '<tr><td><code>optimize_streaming_latency</code></td><td>0–4 (higher = faster, lower quality)</td></tr></table>'
    + '<h3>Response</h3>'
    + '<p><strong>200</strong> — Binary audio file (<code>application/octet-stream</code>)</p>'
    + '<p><strong>422</strong> — Validation error with details</p></div>';
  }

  var contentBuilders = {
    'checklist': checklistContent,
    'editable-booking-form': editorContent,
    'crm': crmContent,
    'esign': esignContent,
    'deliverables': deliverablesContent,
    'coolify': coolifyContent,
    'voiceover': voiceoverContent
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
