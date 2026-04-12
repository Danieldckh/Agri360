/* ─── API Documentation Page ─── */
(function () {
  var CRM_BASE = 'https://agri360.proagrihub.com';
  var EDITOR_BASE = 'https://bookingformeditor.proagrihub.com';

  // ── Section definitions per tab ──
  var tabs = {
    checklist: {
      label: 'Checklist API',
      sections: [
        { id: 'cl-overview',    title: 'Overview' },
        { id: 'cl-auth',        title: 'Authentication' },
        { id: 'cl-create-client', title: 'Create Client' },
        { id: 'cl-create-bf',   title: 'Create / Upsert Booking Form' },
        { id: 'cl-list-bf',     title: 'List Booking Forms' },
        { id: 'cl-get-bf',      title: 'Get Booking Form' },
        { id: 'cl-update-bf',   title: 'Update Booking Form' },
        { id: 'cl-send-editor', title: 'Send to Editor' },
        { id: 'cl-send-esign',  title: 'Send to E-Sign' },
        { id: 'cl-sign',        title: 'Sign / Change Request' },
        { id: 'cl-revisions',   title: 'Revisions' },
        { id: 'cl-checklist-id', title: 'Checklist ID Generation' },
        { id: 'cl-flow',        title: 'End-to-End Flow' }
      ]
    },
    editor: {
      label: 'Editable Booking Form API',
      sections: [
        { id: 'ed-overview',   title: 'Overview' },
        { id: 'ed-health',     title: 'Health Check' },
        { id: 'ed-create',     title: 'Create / Save Page' },
        { id: 'ed-view',       title: 'View Generated Page' },
        { id: 'ed-send-n8n',   title: 'Send to Webhook' },
        { id: 'ed-send-crm',   title: 'Send to CRM' },
        { id: 'ed-flow',       title: 'End-to-End Flow' }
      ]
    }
  };

  // ── Helpers ──
  function esc(s) { return String(s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }
  function method(m) { return '<span class="docs-method ' + m.toLowerCase() + '">' + m + '</span>'; }

  // ── Content builders ──
  function checklistContent() {
    return ''
    // Overview
    + '<div class="docs-section" id="cl-overview">'
    + '<h1>Checklist API</h1>'
    + '<p>The Checklist API is part of the ProAgri CRM backend. It manages booking forms created from the checklist wizard, handles client creation, and triggers editable booking form generation.</p>'
    + '<table><tr><th>Base URL</th><td><code>' + esc(CRM_BASE) + '/api</code></td></tr>'
    + '<tr><th>Format</th><td>JSON (Content-Type: application/json)</td></tr>'
    + '<tr><th>Auth</th><td>Bearer token when AUTH_ENABLED=true (currently disabled)</td></tr></table>'
    + '</div>'

    // Auth
    + '<div class="docs-section" id="cl-auth">'
    + '<h2>Authentication</h2>'
    + '<p>When <code>AUTH_ENABLED=false</code> (the default), all endpoints are accessible without a token. A fake admin user is injected automatically.</p>'
    + '<p>When <code>AUTH_ENABLED=true</code>, include a Bearer token in the Authorization header:</p>'
    + '<pre><code>Authorization: Bearer &lt;your-jwt-token&gt;</code></pre>'
    + '</div>'

    // Create Client
    + '<div class="docs-section" id="cl-create-client">'
    + '<h2>' + method('POST') + ' <span class="docs-path">/api/clients</span></h2>'
    + '<p>Create a new client. Called by the checklist wizard when the user enters a new company (not selected from autocomplete).</p>'
    + '<h3>Request Body</h3>'
    + '<pre><code>{\n  "name": "Acme Farms",\n  "tradingName": "Acme",\n  "companyRegNo": "2025/000001/07",\n  "vatNumber": "4123456789",\n  "website": "https://acme.co.za",\n  "industryExpertise": "Agriculture",\n  "physicalAddress": "1 Farm Road, Pretoria",\n  "physicalPostalCode": "0001",\n  "postalAddress": "PO Box 123, Pretoria",\n  "postalCode": "0001",\n  "primaryContact": {\n    "name": "John Doe",\n    "email": "john@acme.co.za",\n    "cell": "0821234567",\n    "tel": "0121234567"\n  },\n  "materialContact": { "name": "", "email": "", "cell": "", "tel": "" },\n  "accountsContact": { "name": "", "email": "", "cell": "", "tel": "" }\n}</code></pre>'
    + '<h3>Response <span class="docs-status ok">201 Created</span></h3>'
    + '<pre><code>{\n  "id": 28,\n  "name": "Acme Farms",\n  "tradingName": "Acme",\n  "status": "active",\n  ...\n}</code></pre>'
    + '<h3>Errors</h3>'
    + '<table><tr><th>Code</th><th>Reason</th></tr>'
    + '<tr><td>400</td><td><code>name</code> is required</td></tr></table>'
    + '</div>'

    // Create/Upsert Booking Form
    + '<div class="docs-section" id="cl-create-bf">'
    + '<h2>' + method('POST') + ' <span class="docs-path">/api/booking-forms</span></h2>'
    + '<p>Create or update a booking form. If <code>checklistId</code> matches an existing row, it performs an <strong>upsert</strong> (update). Otherwise it creates a new row.</p>'
    + '<h3>Request Body</h3>'
    + '<pre><code>{\n  "clientId": 28,                         // REQUIRED\n  "title": "Acme Farms - Proposal",\n  "status": "outline_proposal",\n  "formData": { ... },                    // Full checklist payload (JSONB)\n  "checklistId": "CL-ABC123",             // Upsert key\n  "checklistUrl": "https://checklist...", // Link back to checklist\n  "campaignMonthStart": "2026-02",\n  "campaignMonthEnd": "2026-05"\n}</code></pre>'
    + '<h3>Response <span class="docs-status ok">201 Created</span> or <span class="docs-status ok">200 OK</span> (upsert)</h3>'
    + '<pre><code>{\n  "id": 22,\n  "clientId": 28,\n  "title": "Acme Farms - Proposal",\n  "status": "outline_proposal",\n  "checklistId": "CL-ABC123",\n  "editableUrl": null,\n  "formData": { ... },\n  ...\n}</code></pre>'
    + '<h3>Errors</h3>'
    + '<table><tr><th>Code</th><th>Reason</th></tr>'
    + '<tr><td>400</td><td><code>client_id is required</code></td></tr></table>'
    + '</div>'

    // List Booking Forms
    + '<div class="docs-section" id="cl-list-bf">'
    + '<h2>' + method('GET') + ' <span class="docs-path">/api/booking-forms</span></h2>'
    + '<p>List all booking forms, ordered by most recent first.</p>'
    + '<h3>Query Parameters</h3>'
    + '<table><tr><th>Param</th><th>Type</th><th>Description</th></tr>'
    + '<tr><td><code>department</code></td><td>string</td><td>Optional. Filter by department slug.</td></tr></table>'
    + '<h3>Response <span class="docs-status ok">200 OK</span></h3>'
    + '<pre><code>[\n  {\n    "id": 22,\n    "clientId": 28,\n    "clientName": "Acme Farms",\n    "title": "Acme Farms - Proposal",\n    "status": "outline_proposal",\n    "editableUrl": "https://bookingformeditor.proagrihub.com/pages/acme-farms-22.html",\n    ...\n  }\n]</code></pre>'
    + '</div>'

    // Get Booking Form
    + '<div class="docs-section" id="cl-get-bf">'
    + '<h2>' + method('GET') + ' <span class="docs-path">/api/booking-forms/:id</span></h2>'
    + '<p>Get a single booking form by ID, including full client details.</p>'
    + '<h3>Response <span class="docs-status ok">200 OK</span></h3>'
    + '<p>Returns the booking form object with 47+ fields including all client contact info.</p>'
    + '<h3>Errors</h3>'
    + '<table><tr><th>Code</th><th>Reason</th></tr>'
    + '<tr><td>404</td><td>Booking form not found</td></tr></table>'
    + '</div>'

    // Update Booking Form
    + '<div class="docs-section" id="cl-update-bf">'
    + '<h2>' + method('PATCH') + ' <span class="docs-path">/api/booking-forms/:id</span></h2>'
    + '<p>Update specific fields on a booking form. Only include fields you want to change.</p>'
    + '<h3>Updatable Fields</h3>'
    + '<p><code>title</code>, <code>description</code>, <code>status</code>, <code>department</code>, <code>booked_date</code>, <code>due_date</code>, <code>campaign_month_start</code>, <code>campaign_month_end</code>, <code>form_data</code>, <code>sign_off_date</code>, <code>representative</code>, <code>decline_reason</code>, <code>editable_url</code>, <code>esign_url</code>, <code>checklist_url</code>, <code>assigned_admin</code></p>'
    + '<h3>Side Effect</h3>'
    + '<p>When <code>status</code> is set to <code>booking_form_ready</code> and no <code>esign_url</code> exists, the system automatically generates the unsigned e-sign URL (best-effort).</p>'
    + '</div>'

    // Send to Editor
    + '<div class="docs-section" id="cl-send-editor">'
    + '<h2>' + method('POST') + ' <span class="docs-path">/api/booking-forms/:id/send-to-editor</span></h2>'
    + '<p>Generate the editable booking form HTML from the checklist data stored in <code>formData</code>. This transforms the checklist payload into a formatted HTML table and saves it to the booking form editor service.</p>'
    + '<h3>Request Body</h3>'
    + '<p>No body required. The route reads data from the database.</p>'
    + '<h3>What Happens</h3>'
    + '<ol><li>Reads the booking form + client data from the DB</li>'
    + '<li>Generates a slug: <code>{clientName}-{id}</code></li>'
    + '<li>Runs format-deliverables to transform checklist data into HTML table rows</li>'
    + '<li>POSTs the HTML to <code>' + esc(EDITOR_BASE) + '/create</code></li>'
    + '<li>Stores the <code>editableUrl</code> on the booking form row</li></ol>'
    + '<h3>Response <span class="docs-status ok">200 OK</span></h3>'
    + '<pre><code>{\n  "success": true,\n  "editableUrl": "' + esc(EDITOR_BASE) + '/pages/acme-farms-22.html",\n  "slug": "acme-farms-22"\n}</code></pre>'
    + '</div>'

    // Send to E-Sign
    + '<div class="docs-section" id="cl-send-esign">'
    + '<h2>' + method('POST') + ' <span class="docs-path">/api/booking-forms/:id/send-to-esign</span></h2>'
    + '<p>Generate an unsigned booking form for e-signature. Sends HTML to the e-sign service.</p>'
    + '<h3>Request Body (optional)</h3>'
    + '<pre><code>{\n  "html": "&lt;html&gt;...&lt;/html&gt;",   // Custom HTML (optional)\n  "slug": "custom-slug"              // Custom slug (optional)\n}</code></pre>'
    + '<h3>Response <span class="docs-status ok">200 OK</span></h3>'
    + '<pre><code>{\n  "success": true,\n  "esignUrl": "https://bookingformesign.proagrihub.com/sign/acme-farms-22",\n  "slug": "acme-farms-22"\n}</code></pre>'
    + '</div>'

    // Sign
    + '<div class="docs-section" id="cl-sign">'
    + '<h2>' + method('POST') + ' <span class="docs-path">/api/booking-forms/:id/sign</span></h2>'
    + '<p>Handle e-sign completion. Creates an immutable revision record and updates the booking form status.</p>'
    + '<h3>Request Body</h3>'
    + '<pre><code>{\n  "action": "signed",            // "signed" or "change_request"\n  "pdfData": "base64...",        // PDF as base64\n  "signatureData": { ... },      // Signature metadata\n  "changeNotes": "",             // Notes (for change_request)\n  "signerName": "John Doe",\n  "signerEmail": "john@acme.co.za"\n}</code></pre>'
    + '<h3>Side Effects</h3>'
    + '<table><tr><th>Action</th><th>Status Change</th><th>Department</th></tr>'
    + '<tr><td><code>signed</code></td><td>→ <code>onboarding</code></td><td>→ <code>admin-onboarding</code></td></tr>'
    + '<tr><td><code>change_request</code></td><td>→ <code>change_requested</code></td><td>(unchanged)</td></tr></table>'
    + '</div>'

    // Revisions
    + '<div class="docs-section" id="cl-revisions">'
    + '<h2>' + method('GET') + ' <span class="docs-path">/api/booking-forms/:id/revisions</span></h2>'
    + '<p>List the immutable audit trail of sign/change-request events for a booking form.</p>'
    + '<h3>Response <span class="docs-status ok">200 OK</span></h3>'
    + '<pre><code>[\n  {\n    "id": 1,\n    "bookingFormId": 22,\n    "action": "signed",\n    "signerName": "John Doe",\n    "signerEmail": "john@acme.co.za",\n    "changeNotes": null,\n    "clientIp": "196.x.x.x",\n    "createdAt": "2026-04-12T10:00:00Z"\n  }\n]</code></pre>'
    + '<p><strong>Note:</strong> Heavy fields (<code>htmlSnapshot</code>, <code>pdfBase64</code>) are excluded from the list. Use <code>GET /api/booking-forms/:id/revisions/:revisionId</code> for the full payload.</p>'
    + '</div>'

    // Checklist ID
    + '<div class="docs-section" id="cl-checklist-id">'
    + '<h2>Checklist ID Generation</h2>'
    + '<p>The checklist wizard generates a deterministic ID used as the upsert key for booking forms. This ensures resubmitting the same checklist updates the existing record.</p>'
    + '<h3>Algorithm</h3>'
    + '<pre><code>input  = (clientName + "|" + campaignStart + "|" + campaignEnd).toLowerCase()\nhash   = Java-style hashCode (shift-5 multiply-add loop)\nresult = "CL-" + abs(hash).toString(36).toUpperCase().slice(0, 6)\n\nExample: "acme farms|2026-02|2026-05" → CL-1A2B3C</code></pre>'
    + '</div>'

    // End-to-End Flow
    + '<div class="docs-section" id="cl-flow">'
    + '<h2>End-to-End Flow</h2>'
    + '<p>The complete flow when a user fills out and submits the checklist wizard:</p>'
    + '<ol>'
    + '<li><strong>Checklist wizard</strong> collects all form data across 10 steps</li>'
    + '<li><strong>POST /api/clients</strong> — creates the client (if new, not from autocomplete)</li>'
    + '<li><strong>POST /api/booking-forms</strong> — creates/upserts the booking form with the full payload in <code>formData</code></li>'
    + '<li><strong>POST /api/booking-forms/:id/send-to-editor</strong> — generates the editable booking form HTML and saves it to the editor service</li>'
    + '<li><strong>Redirect</strong> — the checklist wizard redirects to the editable booking form URL</li>'
    + '<li>The user can edit the booking form and send it to ProAgri</li>'
    + '</ol>'
    + '<p>Both the <code>checklistUrl</code> (for reopening the checklist) and <code>editableUrl</code> (for the generated form) are stored permanently on the booking form record.</p>'
    + '</div>';
  }

  function editorContent() {
    return ''
    // Overview
    + '<div class="docs-section" id="ed-overview">'
    + '<h1>Editable Booking Form API</h1>'
    + '<p>The Editable Booking Form service generates, stores, and serves editable HTML booking forms. It receives HTML snippets from the CRM and wraps them in a styled template with editable fields.</p>'
    + '<table><tr><th>Base URL</th><td><code>' + esc(EDITOR_BASE) + '</code></td></tr>'
    + '<tr><th>Format</th><td>JSON (Content-Type: application/json)</td></tr>'
    + '<tr><th>Auth</th><td>None required (public service)</td></tr>'
    + '<tr><th>Max Body</th><td>25 MB</td></tr></table>'
    + '</div>'

    // Health Check
    + '<div class="docs-section" id="ed-health">'
    + '<h2>' + method('GET') + ' <span class="docs-path">/</span></h2>'
    + '<p>Health check endpoint.</p>'
    + '<h3>Response <span class="docs-status ok">200 OK</span></h3>'
    + '<pre><code>{ "status": "ok" }</code></pre>'
    + '</div>'

    // Create/Save
    + '<div class="docs-section" id="ed-create">'
    + '<h2>' + method('POST') + ' <span class="docs-path">/create</span></h2>'
    + '<p>Create or overwrite an editable booking form page. If the HTML is a snippet (no <code>&lt;html&gt;</code> tag), it is injected into the base template at the <code>&lt;!--CONTENT_SNIPPET--&gt;</code> marker.</p>'
    + '<h3>Request Body</h3>'
    + '<pre><code>{\n  "slug": "acme-farms-22",\n  "html": "&lt;table class=\\"booking-table\\"&gt;...&lt;/table&gt;"\n}</code></pre>'
    + '<h3>Slug Sanitization</h3>'
    + '<p>The slug is lowercased, non-alphanumeric characters replaced with hyphens, <code>.html</code> extension stripped.</p>'
    + '<h3>Response <span class="docs-status ok">200 OK</span></h3>'
    + '<pre><code>{\n  "success": true,\n  "url": "' + esc(EDITOR_BASE) + '/pages/acme-farms-22.html",\n  "slug": "acme-farms-22"\n}</code></pre>'
    + '<h3>Template Injection</h3>'
    + '<p>When the HTML doesn\'t contain <code>&lt;html</code>, <code>&lt;head</code>, or <code>&lt;body</code> tags, the service wraps it in <code>templates/base.html</code>. The template provides:</p>'
    + '<ul><li>ProAgri branding banner</li><li>Editable header (logo, address, legal strip)</li><li>Editable table cells with focus styling</li><li>"Send booking form to ProAgri" button</li><li>LocalStorage persistence for header edits</li></ul>'
    + '</div>'

    // View
    + '<div class="docs-section" id="ed-view">'
    + '<h2>' + method('GET') + ' <span class="docs-path">/pages/{slug}.html</span></h2>'
    + '<p>View a generated editable booking form page. This is the URL that clients interact with.</p>'
    + '<h3>Response <span class="docs-status ok">200 OK</span></h3>'
    + '<p>Returns the full HTML page with editable content, ProAgri branding, and the "Send to ProAgri" button.</p>'
    + '<h3>404</h3>'
    + '<p>If the slug doesn\'t exist, returns <code>Cannot GET /pages/{slug}.html</code>.</p>'
    + '</div>'

    // Send to Webhook
    + '<div class="docs-section" id="ed-send-n8n">'
    + '<h2>' + method('POST') + ' <span class="docs-path">/send-to-n8n</span></h2>'
    + '<p>Forward the edited booking form data to an external webhook. Used by the "Send booking form to ProAgri" button on generated pages.</p>'
    + '<h3>Request Body</h3>'
    + '<pre><code>{\n  "slug": "acme-farms-22",\n  "url": "' + esc(EDITOR_BASE) + '/pages/acme-farms-22.html",\n  "html": "&lt;div id=\\"booking-form-root\\"&gt;...&lt;/div&gt;",\n  "header": {\n    "logoBase64": "data:image/png;base64,...",\n    "logoFileName": "logo.png",\n    "addressHtml": "PO Box ...",\n    "legalStripText": "Agri Media Africa..."\n  },\n  "bookingFormCompanyName": "Acme Farms"\n}</code></pre>'
    + '<h3>Response <span class="docs-status ok">200 OK</span></h3>'
    + '<pre><code>{ "success": true, "status": 200, "response": "..." }</code></pre>'
    + '</div>'

    // Send to CRM
    + '<div class="docs-section" id="ed-send-crm">'
    + '<h2>' + method('POST') + ' <span class="docs-path">/send-to-crm/:slug</span></h2>'
    + '<p>Proxy the edited booking form to the CRM API. Avoids browser CORS issues with direct CRM calls.</p>'
    + '<h3>Request Body</h3>'
    + '<pre><code>{\n  "html": "&lt;div&gt;...&lt;/div&gt;",\n  "header": { ... },\n  "bookingFormCompanyName": "Acme Farms"\n}</code></pre>'
    + '<h3>Response</h3>'
    + '<p>Passes through the CRM API response.</p>'
    + '</div>'

    // End-to-End Flow
    + '<div class="docs-section" id="ed-flow">'
    + '<h2>End-to-End Flow</h2>'
    + '<p>How the editable booking form is generated and used:</p>'
    + '<ol>'
    + '<li><strong>CRM</strong> calls <code>POST /api/booking-forms/:id/send-to-editor</code></li>'
    + '<li>CRM runs <code>format-deliverables</code> to transform checklist data into HTML table rows</li>'
    + '<li>CRM calls <code>POST ' + esc(EDITOR_BASE) + '/create</code> with the slug and HTML snippet</li>'
    + '<li>Editor service injects HTML into <code>templates/base.html</code> and saves to <code>/public/pages/{slug}.html</code></li>'
    + '<li>The generated page is immediately accessible at <code>' + esc(EDITOR_BASE) + '/pages/{slug}.html</code></li>'
    + '<li>User edits the form (logo, address, content, pricing columns)</li>'
    + '<li>User clicks "Send booking form to ProAgri" which calls <code>POST /send-to-n8n</code></li>'
    + '</ol>'
    + '<h3>Page Features</h3>'
    + '<ul>'
    + '<li>All table cells are <code>contenteditable</code> — click to edit</li>'
    + '<li>Header (logo, address, legal strip) is editable and persists via localStorage</li>'
    + '<li>Logo upload via click on the logo placeholder</li>'
    + '<li>Edits auto-save when the page is sent back to ProAgri</li>'
    + '</ul>'
    + '</div>';
  }

  // ── Render ──
  function renderDocsPage(container) {
    while (container.firstChild) container.removeChild(container.firstChild);

    var page = document.createElement('div');
    page.className = 'docs-page';

    // Tab bar
    var tabBar = document.createElement('div');
    tabBar.className = 'docs-tabs';
    var tabKeys = Object.keys(tabs);
    tabKeys.forEach(function (key) {
      var btn = document.createElement('button');
      btn.className = 'docs-tab' + (key === 'checklist' ? ' active' : '');
      btn.textContent = tabs[key].label;
      btn.dataset.tab = key;
      btn.addEventListener('click', function () { switchTab(key); });
      tabBar.appendChild(btn);
    });
    page.appendChild(tabBar);

    // Body (sidebar + content)
    var body = document.createElement('div');
    body.className = 'docs-body';

    var sidebar = document.createElement('nav');
    sidebar.className = 'docs-sidebar';
    sidebar.id = 'docs-sidebar';

    var content = document.createElement('div');
    content.className = 'docs-content';
    content.id = 'docs-content';

    body.appendChild(sidebar);
    body.appendChild(content);
    page.appendChild(body);
    container.appendChild(page);

    // Initial render
    switchTab('checklist');

    function switchTab(key) {
      // Update tab buttons
      tabBar.querySelectorAll('.docs-tab').forEach(function (btn) {
        btn.classList.toggle('active', btn.dataset.tab === key);
      });

      // Update sidebar
      sidebar.innerHTML = '';
      tabs[key].sections.forEach(function (sec) {
        var a = document.createElement('a');
        a.textContent = sec.title;
        a.dataset.section = sec.id;
        a.addEventListener('click', function () {
          var el = document.getElementById(sec.id);
          if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
          sidebar.querySelectorAll('a').forEach(function (x) { x.classList.remove('active'); });
          a.classList.add('active');
        });
        sidebar.appendChild(a);
      });
      // Activate first sidebar item
      var first = sidebar.querySelector('a');
      if (first) first.classList.add('active');

      // Update content
      content.innerHTML = key === 'checklist' ? checklistContent() : editorContent();

      // Scroll spy
      content.addEventListener('scroll', function () {
        var scrollTop = content.scrollTop;
        var active = null;
        tabs[key].sections.forEach(function (sec) {
          var el = document.getElementById(sec.id);
          if (el && el.offsetTop - 40 <= scrollTop) active = sec.id;
        });
        if (active) {
          sidebar.querySelectorAll('a').forEach(function (a) {
            a.classList.toggle('active', a.dataset.section === active);
          });
        }
      });
    }
  }

  window.renderDocsPage = renderDocsPage;
})();
