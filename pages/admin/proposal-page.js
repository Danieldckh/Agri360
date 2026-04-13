(function () {
  'use strict';

  var API_BASE = '/api/booking-forms';

  // Full status chain — single source of truth
  var STATUS_CHAIN = [
    'outline_proposal', 'design_proposal', 'design_review', 'proposal_ready',
    'sent_to_client', 'booking_form_ready', 'booking_form_sent', 'onboarding', 'onboarded'
  ];
  var ALL_STATUSES = STATUS_CHAIN.concat(['design_changes', 'client_changes', 'declined', 'approved']);

  // Tab → which statuses it shows
  var TAB_FILTERS = {
    'Proposal':         ['outline_proposal', 'design_proposal', 'design_review', 'proposal_ready', 'design_changes'],
    // Booking Form is a *document hub* — rows stay visible through their
    // entire booking-form lifecycle (ready → change_requested → sent →
    // signed). onboarding / onboarded rows also appear here so admins can
    // still see the signed PDF; those rows ALSO appear in the Onboarding
    // tab, which is the *workflow stage* lens on the same row.
    'Booking Form':     ['booking_form_ready', 'client_changes', 'change_requested', 'booking_form_sent', 'onboarding', 'onboarded'],
    'Onboarding':       ['onboarding', 'onboarded'],
    'Declined Proposal': ['declined']
  };

  // Sub-sheets within the Proposal tab
  var PROPOSAL_SUB_SHEETS = [
    { label: 'Proposal',       statuses: ['outline_proposal', 'proposal_ready'] },
    { label: 'In Design',      statuses: ['design_proposal', 'design_review', 'design_changes'] },
    { label: 'Sent to Client', statuses: ['sent_to_client'] }
  ];

  // Icons
  var ICON_ADVANCE = 'M12 4l-1.41 1.41L16.17 11H4v2h12.17l-5.58 5.59L12 20l8-8z';
  var ICON_UNDO = 'M12 20l1.41-1.41L7.83 13H20v-2H7.83l5.58-5.59L12 4l-8 8z';
  var ICON_EYE = 'M12 4.5C7 4.5 2.73 7.61 1 12c1.73 4.39 6 7.5 11 7.5s9.27-3.11 11-7.5c-1.73-4.39-6-7.5-11-7.5zM12 17c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5zm0-8c-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3-1.34-3-3-3z';
  var ICON_UPLOAD = 'M5 20h14v-2H5v2zm7-18l-5.5 5.5h3.5V14h4V7.5H17.5L12 2z';
  // skip_next (Material): jumps straight to the end bar — used to skip
  // outline_proposal rows directly to booking_form_ready, bypassing the
  // design/review/sent_to_client sequence for clients who don't need a
  // custom-designed proposal.
  var ICON_SKIP = 'M6 18l8.5-6L6 6v12zM16 6v12h2V6h-2z';
  // edit/pencil — signals "changes requested, needs revision"
  var ICON_CHANGE_REQUEST = 'M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34c-.39-.39-1.02-.39-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z';
  // refresh — retry esign generation
  var ICON_RETRY = 'M17.65 6.35C16.2 4.9 14.21 4 12 4c-4.42 0-7.99 3.58-7.99 8s3.57 8 7.99 8c3.73 0 6.84-2.55 7.73-6h-2.08c-.82 2.33-3.04 4-5.65 4-3.31 0-6-2.69-6-6s2.69-6 6-6c1.66 0 3.14.69 4.22 1.78L13 11h7V4l-2.35 2.35z';

  // Track active container for back navigation
  var _activeContainer = null;
  var _activeTabRenderer = null;

  function getHeaders() {
    var headers = { 'Content-Type': 'application/json' };
    if (window.getAuthHeaders) {
      var auth = window.getAuthHeaders();
      for (var key in auth) {
        if (auth.hasOwnProperty(key)) headers[key] = auth[key];
      }
    }
    return headers;
  }

  function getNextStatus(current) {
    var idx = STATUS_CHAIN.indexOf(current);
    if (idx === -1 || idx >= STATUS_CHAIN.length - 1) return null;
    return STATUS_CHAIN[idx + 1];
  }

  function getPrevStatus(current) {
    var idx = STATUS_CHAIN.indexOf(current);
    if (idx <= 0) return null;
    return STATUS_CHAIN[idx - 1];
  }

  // --- Shared columns ---
  // BASE_COLUMNS is used by every sheet. PROPOSAL_COLUMNS / BOOKING_FORM_COLUMNS
  // extend it with status-specific link columns:
  //   - PROPOSAL_COLUMNS    → Checklist link, only meaningful for outline_proposal rows
  //   - BOOKING_FORM_COLUMNS → 4-column document hub for the Booking Form tab:
  //         Prefilled Checklist | Unsigned Booking Form | Change Request | Signed Booking Form
  // Each link is populated only when the corresponding artifact actually
  // exists on the row; otherwise the cell renders "—".
  var BASE_COLUMNS = [
    { key: 'assignedAdmin', label: '', type: 'person', editable: true },
    { key: 'client', label: 'Client', sortable: true, isName: true },
    { key: 'status', label: 'Status', sortable: true, type: 'status', editable: true, options: ALL_STATUSES }
  ];

  var PROPOSAL_COLUMNS = [
    { key: 'assignedAdmin', label: '', type: 'person', editable: true },
    { key: 'client', label: 'Client', sortable: true, isName: true },
    { key: 'checklistUrl', label: 'Checklist', type: 'link', width: 'sm' },
    { key: 'status', label: 'Status', sortable: true, type: 'status', editable: true, options: ALL_STATUSES }
  ];

  // The Booking Form sheet is a signing-lifecycle hub. Three columns,
  // one per artifact:
  //   - Unsigned Booking Form → the link a client clicks to sign
  //   - Change Request Doc    → PDF stored when a client requested changes
  //   - Signed Booking Form   → PDF stored once the client has signed
  // The Prefilled Checklist column lives only on the Proposal sheet.
  var BOOKING_FORM_COLUMNS = BASE_COLUMNS.concat([
    { key: 'esignUrl',     label: 'Unsigned Booking Form', type: 'link', width: 'sm' },
    { key: 'changeReqUrl', label: 'Change Request Doc',    type: 'link', width: 'sm' },
    { key: 'signedUrl',    label: 'Signed Booking Form',   type: 'link', width: 'sm' }
  ]);

  // Design Proposals sheet: status + the uploaded proposal file artifact.
  var DESIGN_PROPOSAL_COLUMNS = BASE_COLUMNS.concat([
    { key: 'proposalFileUrl', label: 'Proposal File', type: 'link', width: 'sm' }
  ]);

  // Per-tab column overrides for renderAdminTab. Tabs not listed fall back
  // to BASE_COLUMNS. NOTE: the Booking Form tab does NOT go through
  // renderAdminTab — it has its own custom split-layout renderer
  // (renderBookingFormTab) that hardcodes BOOKING_FORM_COLUMNS directly.
  var TAB_COLUMNS = {};

  // Tiny helper: wrap a base64-encoded PDF in a data URL the link cell
  // renderer can drop straight into an <a href>. Browsers handle clicks
  // natively (open in a new tab). Returns '' for null/empty so the
  // renderer falls back to "—".
  function pdfDataUrl(b64) {
    if (!b64) return '';
    return 'data:application/pdf;base64,' + b64;
  }

  function mapFormToRow(form) {
    return {
      id: form.id,
      assignedAdmin: form.assignedAdmin || null,
      client: form.clientName || form.title || 'Untitled',
      status: form.status || 'outline_proposal',
      // Prefilled checklist link — populated by the checklist app at
      // submit time. Surfaced on the Proposal sub-sheet for outline_proposal
      // rows AND on the Booking Form hub regardless of status (because the
      // checklist data is relevant throughout the booking-form lifecycle).
      checklistUrl: form.checklistUrl || '',
      // Unsigned esign URL — populated by the Booking Form Esign app at
      // token creation time. Show whenever it exists.
      esignUrl: form.esignUrl || '',
      // Change-request and signed PDFs are stored as base64. Wrap them in
      // data URLs so a click on "View" opens the PDF in a new tab.
      changeReqUrl: pdfDataUrl(form.changeRequestPdf),
      signedUrl: pdfDataUrl(form.signedPdf),
      proposalFileUrl: form.proposalFileUrl || ''
    };
  }

  function getAuthOnlyHeaders() {
    var headers = {};
    if (window.getAuthHeaders) {
      var auth = window.getAuthHeaders();
      for (var key in auth) {
        if (auth.hasOwnProperty(key)) headers[key] = auth[key];
      }
    }
    return headers;
  }

  function uploadProposalFile(rowData, refreshFn) {
    if (!rowData || !rowData.id) return;
    var picker = document.createElement('input');
    picker.type = 'file';
    picker.accept = '.pdf,.doc,.docx,.ppt,.pptx,.zip,image/*';
    picker.style.display = 'none';
    document.body.appendChild(picker);
    picker.addEventListener('change', function () {
      var file = picker.files && picker.files[0];
      if (!file) {
        picker.remove();
        return;
      }
      var fd = new FormData();
      fd.append('file', file);
      fetch(API_BASE + '/' + rowData.id + '/upload-proposal-file', {
        method: 'POST',
        headers: getAuthOnlyHeaders(),
        body: fd
      })
        .then(function (res) {
          if (!res.ok) throw new Error('Upload failed');
          return res.json();
        })
        .then(function () {
          if (typeof refreshFn === 'function') refreshFn();
        })
        .catch(function (err) {
          console.error('Proposal file upload failed:', err);
          alert('Failed to upload proposal file. Please try again.');
        })
        .finally(function () {
          picker.remove();
        });
    });
    picker.click();
  }

  // --- Reusable Sheet Builder ---
  // columns defaults to BASE_COLUMNS; pass a custom set to override (e.g.
  // PROPOSAL_COLUMNS for the main Proposal sub-sheet which surfaces the
  // prefilled-checklist link).
  function buildSheet(title, refreshFn, columns, opts) {
    opts = opts || {};
    var sheetCols = columns || BASE_COLUMNS;
    var card = document.createElement('div');
    card.className = 'dept-sheet-card';

    var header = document.createElement('div');
    header.className = 'dept-sheet-header';

    var titleWrap = document.createElement('div');
    titleWrap.className = 'dept-sheet-title-wrap';

    var h = document.createElement('h3');
    h.className = 'dept-sheet-title';
    h.textContent = title;
    titleWrap.appendChild(h);

    var countBadge = document.createElement('span');
    countBadge.className = 'dept-sheet-count';
    countBadge.textContent = '0';
    titleWrap.appendChild(countBadge);

    header.appendChild(titleWrap);

    var searchInput = document.createElement('input');
    searchInput.type = 'text';
    searchInput.className = 'dept-sheet-search';
    searchInput.placeholder = 'Search ' + title.toLowerCase() + '...';
    header.appendChild(searchInput);

    card.appendChild(header);

    var sheetContainer = document.createElement('div');
    sheetContainer.className = 'dept-sheet-container';
    card.appendChild(sheetContainer);

    var allData = [];

    var leadingActions = [
      {
        icon: ICON_EYE,
        tooltip: 'View client dashboard',
        className: 'action-view',
        onClick: function (rowData) {
          if (_activeContainer) {
            renderClientDashboard(_activeContainer, rowData.id);
          }
        }
      }
    ];
    if (Array.isArray(opts.leadingActions)) {
      leadingActions = opts.leadingActions.slice();
    }

    var rowActions = [
      {
        icon: ICON_ADVANCE,
        tooltip: function (rowData) {
          var next = getNextStatus(rowData.status);
          return next ? 'Advance to ' + next.replace(/_/g, ' ') : 'No next status';
        },
        className: 'action-advance',
        onClick: function (rowData) {
          var next = getNextStatus(rowData.status);
          if (!next) return;
          fetch(API_BASE + '/' + rowData.id, {
            method: 'PATCH',
            headers: getHeaders(),
            body: JSON.stringify({ status: next })
          }).then(function (res) {
            if (!res.ok) return;
            // When advancing from onboarding to onboarded, create content calendar deliverables
            if (rowData.status === 'onboarding' && next === 'onboarded') {
              fetch('/api/deliverables/create-content-calendars', {
                method: 'POST',
                headers: getHeaders(),
                body: JSON.stringify({ bookingFormId: rowData.id })
              }).finally(function () { refreshFn(); });
            } else {
              refreshFn();
            }
          });
        }
      },
      {
        // Shortcut: skip the entire design/review/sent_to_client arc and
        // jump straight to booking_form_ready. Only visible for rows still
        // in outline_proposal — other rows see an invisible placeholder
        // that keeps the actions column width stable.
        icon: ICON_SKIP,
        tooltip: 'Skip to Booking Form Ready',
        className: 'action-skip',
        visible: function (rowData) { return rowData.status === 'outline_proposal'; },
        onClick: function (rowData) {
          if (rowData.status !== 'outline_proposal') return;
          if (!confirm('Skip straight to Booking Form Ready? This bypasses the design/review steps.')) return;
          fetch(API_BASE + '/' + rowData.id, {
            method: 'PATCH',
            headers: getHeaders(),
            body: JSON.stringify({ status: 'booking_form_ready' })
          }).then(function (res) {
            if (res.ok) refreshFn();
          });
        }
      },
      {
        icon: ICON_RETRY,
        tooltip: 'Retry esign generation',
        className: 'action-retry-esign',
        visible: function (rowData) {
          return !rowData.esignUrl && ['booking_form_ready', 'booking_form_sent', 'client_changes', 'change_requested'].indexOf(rowData.status) !== -1;
        },
        onClick: function (rowData) {
          fetch(API_BASE + '/' + rowData.id + '/send-to-esign', {
            method: 'POST',
            headers: getHeaders(),
            body: JSON.stringify({})
          }).then(function (res) {
            if (res.ok) {
              refreshFn();
            } else {
              res.json().then(function (data) {
                alert('Esign generation failed: ' + (data.error || 'Unknown error'));
              }).catch(function () { alert('Esign generation failed'); });
            }
          });
        }
      }
    ];
    if (Array.isArray(opts.extraRowActions) && opts.extraRowActions.length) {
      rowActions = opts.extraRowActions.concat(rowActions);
    }
    if (Array.isArray(opts.rowActions)) {
      rowActions = opts.rowActions.slice();
    }

    function render() {
      var filtered = allData;
      var term = searchInput.value.toLowerCase();
      if (term) {
        filtered = allData.filter(function (row) {
          return sheetCols.some(function (col) {
            var val = row[col.key];
            return val && val.toString().toLowerCase().indexOf(term) !== -1;
          });
        });
      }

      countBadge.textContent = filtered.length;

      if (window.renderSheet) {
        window.renderSheet(sheetContainer, {
          columns: sheetCols,
          data: filtered,
          searchable: false,
          apiEndpoint: '/booking-forms',
          leadingActions: leadingActions,
          rowActions: rowActions,
          onCellSaved: function (rowData, key) {
            if (key === 'status') refreshFn();
          }
        });
      }
    }

    searchInput.addEventListener('input', render);
    render();

    return { el: card, update: function (data) { allData = data; render(); } };
  }

  function resetContainer(container) {
    while (container.firstChild) container.removeChild(container.firstChild);
    container.style.display = '';
    container.style.alignItems = '';
    container.style.justifyContent = '';
    container.style.flexDirection = '';
    container.style.height = '';
    container.style.gap = '';
    container.style.padding = '';
  }

  // --- Generic tab renderer: fetch all forms, filter by statuses ---
  function renderAdminTab(container, tabName) {
    _activeContainer = container;
    _activeTabRenderer = function () { renderAdminTab(container, tabName); };
    resetContainer(container);

    var statuses = TAB_FILTERS[tabName] || [];

    var layout = document.createElement('div');
    layout.className = 'dept-dashboard-layout';
    layout.style.width = '100%';

    var mainCol = document.createElement('div');
    mainCol.className = 'dept-dashboard-main';
    mainCol.style.width = '100%';

    // Tabs can opt into a custom column set via TAB_COLUMNS (e.g. the
    // Booking Form tab adds an "Unsigned Booking Form" link column).
    var sheet = buildSheet(tabName, refreshAll, TAB_COLUMNS[tabName]);
    mainCol.appendChild(sheet.el);
    layout.appendChild(mainCol);
    container.appendChild(layout);

    function refreshAll() {
      fetch(API_BASE, { headers: getHeaders() })
        .then(function (res) {
          if (!res.ok) throw new Error('Failed to fetch');
          return res.json();
        })
        .then(function (forms) {
          var filtered = forms.filter(function (f) {
            return statuses.indexOf(f.status) !== -1;
          });
          sheet.update(filtered.map(mapFormToRow));
        })
        .catch(function (err) {
          console.error('Admin tab fetch error:', err);
        });
    }

    refreshAll();
  }

  // --- Proposal tab with grid layout ---
  function renderProposalTabWithSubSheets(container) {
    _activeContainer = container;
    _activeTabRenderer = function () { renderProposalTabWithSubSheets(container); };
    resetContainer(container);

    var grid = document.createElement('div');
    grid.className = 'proposal-grid';

    // Left column — Proposal (main, wider)
    var leftCol = document.createElement('div');
    leftCol.className = 'proposal-grid-left';

    // Right column — In Design + Sent to Client (narrower, stacked)
    var rightCol = document.createElement('div');
    rightCol.className = 'proposal-grid-right';

    var sheets = [];

    PROPOSAL_SUB_SHEETS.forEach(function (sub, idx) {
      // Only the main "Proposal" sub-sheet (idx 0) gets the Checklist column;
      // the In Design / Sent to Client sub-sheets stay on the minimal column set.
      var cols = (idx === 0) ? PROPOSAL_COLUMNS : BASE_COLUMNS;
      var sheet = buildSheet(sub.label, refreshAll, cols);
      sheets.push(sheet);

      if (idx === 0) {
        leftCol.appendChild(sheet.el);
      } else {
        rightCol.appendChild(sheet.el);
      }
    });

    grid.appendChild(leftCol);
    grid.appendChild(rightCol);
    container.appendChild(grid);

    function refreshAll() {
      fetch(API_BASE, { headers: getHeaders() })
        .then(function (res) {
          if (!res.ok) throw new Error('Failed to fetch');
          return res.json();
        })
        .then(function (forms) {
          PROPOSAL_SUB_SHEETS.forEach(function (sub, idx) {
            var filtered = forms.filter(function (f) {
              return sub.statuses.indexOf(f.status) !== -1;
            });
            var rows = filtered.map(mapFormToRow);
            sheets[idx].update(rows);
          });
        })
        .catch(function (err) {
          console.error('Proposal grid fetch error:', err);
        });
    }

    refreshAll();
  }

  // --- Client Dashboard ---
  var _savedSidebarHTML = null;
  var _jsonPre = null;
  var _dashboardData = null;

  function refreshJsonView() {
    if (!_jsonPre || !_dashboardData) return;
    fetch(API_BASE + '/' + _dashboardData.id, { headers: getHeaders() })
      .then(function (res) { return res.json(); })
      .then(function (fresh) {
        _dashboardData = fresh;
        var fd = fresh.formData || {};
        if (typeof fd === 'string') try { fd = JSON.parse(fd); } catch (e) {}
        _jsonPre.textContent = JSON.stringify(fd, null, 2);
        _jsonPre.classList.add('cell-saved');
        setTimeout(function () { _jsonPre.classList.remove('cell-saved'); }, 600);
      });
  }

  function makeSidebarEditable(label, value, onSave) {
    var row = document.createElement('div');
    row.className = 'sidebar-dashboard-field';
    var lbl = document.createElement('span');
    lbl.className = 'sidebar-dashboard-label';
    lbl.textContent = label;
    row.appendChild(lbl);
    var val = document.createElement('span');
    val.className = 'sidebar-dashboard-value sidebar-editable';
    val.textContent = value || '—';
    val.title = 'Click to edit';
    row.appendChild(val);

    val.addEventListener('click', function () {
      if (val.querySelector('input')) return;
      var current = val.textContent === '—' ? '' : val.textContent;
      var input = document.createElement('input');
      input.type = 'text';
      input.className = 'sidebar-inline-input';
      input.value = current;
      val.textContent = '';
      val.appendChild(input);
      input.focus();
      input.select();

      function commit() {
        var newVal = input.value.trim();
        val.textContent = newVal || '—';
        if (newVal !== current && onSave) {
          onSave(newVal).then(function (res) {
            if (res && res.ok) {
              val.classList.add('cell-saved');
              setTimeout(function () { val.classList.remove('cell-saved'); }, 600);
              refreshJsonView();
            } else {
              val.textContent = current || '—';
              val.classList.add('cell-error');
              setTimeout(function () { val.classList.remove('cell-error'); }, 600);
            }
          }).catch(function () { val.textContent = current || '—'; });
        }
      }
      input.addEventListener('blur', commit);
      input.addEventListener('keydown', function (e) {
        if (e.key === 'Enter') { e.preventDefault(); input.blur(); }
        if (e.key === 'Escape') { val.textContent = current || '—'; }
      });
    });
    return row;
  }

  function showDashboardSidebar(data) {
    var nav = document.querySelector('#sidebar nav');
    if (!nav) return;
    var clientId = data.clientId;

    _savedSidebarHTML = document.createDocumentFragment();
    while (nav.firstChild) _savedSidebarHTML.appendChild(nav.firstChild);
    nav.style.overflowY = 'auto';

    // Back button
    var backItem = document.createElement('a');
    backItem.className = 'nav-item';
    backItem.tabIndex = 0;
    backItem.style.cursor = 'pointer';
    var backIcon = document.createElement('span');
    backIcon.className = 'nav-icon';
    var svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('width', '20');
    svg.setAttribute('height', '20');
    svg.setAttribute('viewBox', '0 0 24 24');
    svg.setAttribute('fill', 'currentColor');
    var p = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    p.setAttribute('d', ICON_UNDO);
    svg.appendChild(p);
    backIcon.appendChild(svg);
    backItem.appendChild(backIcon);
    var backLabel = document.createElement('span');
    backLabel.className = 'nav-label';
    backLabel.textContent = 'Back';
    backItem.appendChild(backLabel);
    backItem.addEventListener('click', function () {
      restoreDashboardSidebar();
      if (_activeTabRenderer) _activeTabRenderer();
    });
    nav.appendChild(backItem);

    function addSep() {
      var s = document.createElement('div');
      s.className = 'sidebar-dashboard-sep';
      nav.appendChild(s);
    }

    function addSectionHeader(text) {
      var h = document.createElement('div');
      h.className = 'sidebar-dashboard-section-header';
      h.textContent = text;
      nav.appendChild(h);
    }

    // === Company Info (editable) ===
    addSep();
    var companySection = document.createElement('div');
    companySection.className = 'sidebar-dashboard-section';
    var companyTitle = document.createElement('div');
    companyTitle.className = 'sidebar-dashboard-title';
    companyTitle.textContent = data.clientName || data.title || 'Client';
    companySection.appendChild(companyTitle);
    if (data.clientTradingName) {
      var trading = document.createElement('div');
      trading.className = 'sidebar-dashboard-subtitle';
      trading.textContent = data.clientTradingName;
      companySection.appendChild(trading);
    }
    nav.appendChild(companySection);

    var cfWrap = document.createElement('div');
    cfWrap.className = 'sidebar-dashboard-fields-wrap';
    var companyFields = [
      { label: 'Name', value: data.clientName, key: 'name' },
      { label: 'Trading', value: data.clientTradingName, key: 'tradingName' },
      { label: 'Reg No', value: data.clientCompanyRegNo, key: 'companyRegNo' },
      { label: 'VAT', value: data.clientVatNumber, key: 'vatNumber' },
      { label: 'Website', value: data.clientWebsite, key: 'website' },
      { label: 'Industry', value: data.clientIndustryExpertise, key: 'industryExpertise' },
      { label: 'Email', value: data.clientEmail, key: 'email' },
      { label: 'Phone', value: data.clientPhone, key: 'phone' },
      { label: 'Address', value: data.clientPhysicalAddress, key: 'physicalAddress' },
      { label: 'Postal', value: data.clientPostalAddress, key: 'postalAddress' }
    ];
    companyFields.forEach(function (f) {
      cfWrap.appendChild(makeSidebarEditable(f.label, f.value, function (v) {
        return saveClientField(clientId, f.key, v);
      }));
    });
    nav.appendChild(cfWrap);

    // === Contacts (editable) ===
    function addEditableContactBlock(title, rawContact, contactKey) {
      var c = parseContact(rawContact);
      var contactData = { name: c.name || '', email: c.email || '', cell: c.cell || '', tel: c.tel || '' };

      var block = document.createElement('div');
      block.className = 'sidebar-dashboard-contact';
      var header = document.createElement('div');
      header.className = 'sidebar-dashboard-contact-title';
      header.textContent = title;
      block.appendChild(header);

      var fields = [
        { label: 'Name', field: 'name' },
        { label: 'Email', field: 'email' },
        { label: 'Cell', field: 'cell' },
        { label: 'Tel', field: 'tel' }
      ];
      fields.forEach(function (f) {
        block.appendChild(makeSidebarEditable(f.label, contactData[f.field], function (v) {
          contactData[f.field] = v;
          return saveClientField(clientId, contactKey, contactData);
        }));
      });

      nav.appendChild(block);
    }

    addSep();
    addSectionHeader('Contacts');
    addEditableContactBlock('Primary', data.clientPrimaryContact, 'primaryContact');
    addEditableContactBlock('Material', data.clientMaterialContact, 'materialContact');
    addEditableContactBlock('Accounts', data.clientAccountsContact, 'accountsContact');

    // === Booking Info (editable) ===
    addSep();
    addSectionHeader('Booking');
    var statusBadge = document.createElement('div');
    statusBadge.className = 'sidebar-dashboard-status';
    var badge = document.createElement('span');
    badge.className = 'proagri-sheet-status proagri-sheet-status-' + (data.status || '').replace(/\s/g, '_');
    badge.textContent = (data.status || '').replace(/_/g, ' ');
    badge.style.textTransform = 'capitalize';
    statusBadge.appendChild(badge);
    nav.appendChild(statusBadge);

    var bfWrap = document.createElement('div');
    bfWrap.className = 'sidebar-dashboard-fields-wrap';
    bfWrap.appendChild(makeSidebarEditable('Status', data.status, function (v) { return saveBookingField(data.id, 'status', v); }));
    bfWrap.appendChild(makeSidebarEditable('Start', data.campaignMonthStart, function (v) { return saveBookingField(data.id, 'campaignMonthStart', v); }));
    bfWrap.appendChild(makeSidebarEditable('End', data.campaignMonthEnd, function (v) { return saveBookingField(data.id, 'campaignMonthEnd', v); }));
    bfWrap.appendChild(makeSidebarEditable('Booked', data.bookedDate, function (v) { return saveBookingField(data.id, 'bookedDate', v); }));
    bfWrap.appendChild(makeSidebarEditable('Due', data.dueDate, function (v) { return saveBookingField(data.id, 'dueDate', v); }));
    bfWrap.appendChild(makeSidebarEditable('Rep', data.representative, function (v) { return saveBookingField(data.id, 'representative', v); }));
    nav.appendChild(bfWrap);
  }

  function restoreDashboardSidebar() {
    var nav = document.querySelector('#sidebar nav');
    if (!nav || !_savedSidebarHTML) return;
    nav.style.overflowY = '';
    while (nav.firstChild) nav.removeChild(nav.firstChild);
    nav.appendChild(_savedSidebarHTML);
    _savedSidebarHTML = null;
  }

  function parseContact(raw) {
    if (!raw) return {};
    if (typeof raw === 'string') try { return JSON.parse(raw); } catch (e) { return {}; }
    return raw;
  }

  // Save a field to the client record
  function saveClientField(clientId, fieldName, value) {
    var body = {};
    body[fieldName] = value;
    return fetch('/api/clients/' + clientId, {
      method: 'PATCH',
      headers: getHeaders(),
      body: JSON.stringify(body)
    });
  }

  // Save a field to the booking form record
  function saveBookingField(bookingId, fieldName, value) {
    var body = {};
    body[fieldName] = value;
    return fetch(API_BASE + '/' + bookingId, {
      method: 'PATCH',
      headers: getHeaders(),
      body: JSON.stringify(body)
    });
  }

  // Editable field row — click value to edit inline
  function makeEditableField(label, value, onSave) {
    var row = document.createElement('div');
    row.className = 'client-dashboard-field';
    var lbl = document.createElement('span');
    lbl.className = 'client-dashboard-label';
    lbl.textContent = label;
    row.appendChild(lbl);
    var val = document.createElement('span');
    val.className = 'client-dashboard-value client-dashboard-editable';
    val.textContent = value || '—';
    val.title = 'Click to edit';
    row.appendChild(val);

    val.addEventListener('click', function () {
      if (val.querySelector('input')) return;
      var current = val.textContent === '—' ? '' : val.textContent;
      var input = document.createElement('input');
      input.type = 'text';
      input.className = 'client-dashboard-inline-input';
      input.value = current;
      val.textContent = '';
      val.appendChild(input);
      input.focus();
      input.select();

      function commit() {
        var newVal = input.value.trim();
        val.textContent = newVal || '—';
        if (newVal !== current) {
          val.classList.add('cell-saving');
          onSave(newVal).then(function (res) {
            val.classList.remove('cell-saving');
            if (res && res.ok) {
              val.classList.add('cell-saved');
              setTimeout(function () { val.classList.remove('cell-saved'); }, 600);
            } else {
              val.textContent = current || '—';
              val.classList.add('cell-error');
              setTimeout(function () { val.classList.remove('cell-error'); }, 600);
            }
          }).catch(function () {
            val.classList.remove('cell-saving');
            val.textContent = current || '—';
          });
        }
      }

      input.addEventListener('blur', commit);
      input.addEventListener('keydown', function (e) {
        if (e.key === 'Enter') { e.preventDefault(); input.blur(); }
        if (e.key === 'Escape') { val.textContent = current || '—'; }
      });
    });

    return row;
  }

  // Contact card with edit + delete
  function makeContactCard(title, contact, contactKey, clientId, cardsGrid) {
    var card = document.createElement('div');
    card.className = 'client-dashboard-card';

    var headerRow = document.createElement('div');
    headerRow.className = 'client-dashboard-card-header';
    var h = document.createElement('h3');
    h.className = 'client-dashboard-card-title';
    h.textContent = title;
    headerRow.appendChild(h);

    var deleteBtn = document.createElement('button');
    deleteBtn.className = 'client-dashboard-delete-btn';
    deleteBtn.type = 'button';
    deleteBtn.title = 'Delete contact';
    deleteBtn.innerHTML = '&times;';
    deleteBtn.addEventListener('click', function () {
      showConfirmModal('Delete ' + title + '?', 'This will remove all ' + title.toLowerCase() + ' information.', function () {
        saveClientField(clientId, contactKey, null).then(function (res) {
          if (res.ok) {
            card.style.transition = 'opacity 0.2s, transform 0.2s';
            card.style.opacity = '0';
            card.style.transform = 'scale(0.95)';
            setTimeout(function () { card.remove(); }, 200);
          }
        });
      });
    });
    headerRow.appendChild(deleteBtn);
    card.appendChild(headerRow);

    var list = document.createElement('div');
    list.className = 'client-dashboard-fields';

    var contactData = { name: contact.name || '', email: contact.email || '', cell: contact.cell || '', tel: contact.tel || '' };

    function saveContact(field, newVal) {
      contactData[field] = newVal;
      return saveClientField(clientId, contactKey, contactData);
    }

    list.appendChild(makeEditableField('Name', contact.name, function (v) { return saveContact('name', v); }));
    list.appendChild(makeEditableField('Email', contact.email, function (v) { return saveContact('email', v); }));
    list.appendChild(makeEditableField('Cell', contact.cell, function (v) { return saveContact('cell', v); }));
    list.appendChild(makeEditableField('Tel', contact.tel, function (v) { return saveContact('tel', v); }));

    card.appendChild(list);
    return card;
  }

  // Add contact card button
  function makeAddContactBtn(cardsGrid, clientId, contactKey, title, insertBefore) {
    var btn = document.createElement('button');
    btn.className = 'client-dashboard-add-contact-btn';
    btn.type = 'button';
    btn.textContent = '+ Add ' + title;
    btn.addEventListener('click', function () {
      var emptyContact = { name: '', email: '', cell: '', tel: '' };
      saveClientField(clientId, contactKey, emptyContact).then(function (res) {
        if (res.ok) {
          var newCard = makeContactCard(title, emptyContact, contactKey, clientId, cardsGrid);
          cardsGrid.insertBefore(newCard, insertBefore || btn);
          btn.remove();
        }
      });
    });
    return btn;
  }

  // Confirmation modal
  function showConfirmModal(title, message, onConfirm) {
    var overlay = document.createElement('div');
    overlay.className = 'confirm-modal-overlay';

    var modal = document.createElement('div');
    modal.className = 'confirm-modal';

    var h = document.createElement('h3');
    h.className = 'confirm-modal-title';
    h.textContent = title;
    modal.appendChild(h);

    var msg = document.createElement('p');
    msg.className = 'confirm-modal-message';
    msg.textContent = message;
    modal.appendChild(msg);

    var actions = document.createElement('div');
    actions.className = 'confirm-modal-actions';

    var cancelBtn = document.createElement('button');
    cancelBtn.className = 'confirm-modal-btn confirm-modal-cancel';
    cancelBtn.type = 'button';
    cancelBtn.textContent = 'Cancel';
    cancelBtn.addEventListener('click', function () { overlay.remove(); });
    actions.appendChild(cancelBtn);

    var confirmBtn = document.createElement('button');
    confirmBtn.className = 'confirm-modal-btn confirm-modal-confirm';
    confirmBtn.type = 'button';
    confirmBtn.textContent = 'Delete';
    confirmBtn.addEventListener('click', function () {
      overlay.remove();
      onConfirm();
    });
    actions.appendChild(confirmBtn);

    modal.appendChild(actions);
    overlay.appendChild(modal);
    overlay.addEventListener('click', function (e) {
      if (e.target === overlay) overlay.remove();
    });
    document.body.appendChild(overlay);
  }

  function renderClientDashboard(container, bookingFormId) {
    resetContainer(container);

    var ICON_TRASH = 'M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z';

    var wrapper = document.createElement('div');
    wrapper.className = 'client-dashboard';

    // Title row with trash icon
    var titleRow = document.createElement('div');
    titleRow.className = 'client-dashboard-title-row';
    var titleEl = document.createElement('h2');
    titleEl.className = 'client-dashboard-title';
    titleEl.textContent = 'Loading...';
    titleRow.appendChild(titleEl);

    var trashBtn = document.createElement('button');
    trashBtn.className = 'client-dashboard-trash-btn';
    trashBtn.type = 'button';
    trashBtn.title = 'Delete booking form';
    var trashSvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    trashSvg.setAttribute('width', '18');
    trashSvg.setAttribute('height', '18');
    trashSvg.setAttribute('viewBox', '0 0 24 24');
    trashSvg.setAttribute('fill', 'currentColor');
    var trashPath = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    trashPath.setAttribute('d', ICON_TRASH);
    trashSvg.appendChild(trashPath);
    trashBtn.appendChild(trashSvg);
    trashBtn.addEventListener('click', function () {
      var clientName = titleEl.textContent || 'this booking form';
      showConfirmModal(
        'Delete Booking Form?',
        'This will permanently delete the booking form for "' + clientName + '". This action cannot be undone.',
        function () {
          fetch(API_BASE + '/' + bookingFormId, {
            method: 'DELETE',
            headers: getHeaders()
          }).then(function (res) {
            if (res.ok) {
              restoreDashboardSidebar();
              if (_activeTabRenderer) _activeTabRenderer();
            }
          });
        }
      );
    });
    titleRow.appendChild(trashBtn);
    wrapper.appendChild(titleRow);

    var cardsGrid = document.createElement('div');
    cardsGrid.className = 'client-dashboard-grid';
    wrapper.appendChild(cardsGrid);

    container.appendChild(wrapper);

    fetch(API_BASE + '/' + bookingFormId, { headers: getHeaders() })
      .then(function (res) {
        if (!res.ok) throw new Error('Failed to fetch booking form');
        return res.json();
      })
      .then(function (data) {
        _dashboardData = data;
        titleEl.textContent = data.clientName || data.title || 'Client Dashboard';

        showDashboardSidebar(data);

        var formData = data.formData || {};
        if (typeof formData === 'string') {
          try { formData = JSON.parse(formData); } catch (e) { formData = {}; }
        }

        // --- Readable cards from formData ---
        buildFormDataCards(cardsGrid, formData, data);

        // Full Checklist JSON (below the cards)
        var jsonCard = document.createElement('div');
        jsonCard.className = 'client-dashboard-card client-dashboard-card-wide';
        var jsonTitle = document.createElement('h3');
        jsonTitle.className = 'client-dashboard-card-title';
        jsonTitle.textContent = 'Checklist Data (JSON)';
        jsonCard.appendChild(jsonTitle);
        var pre = document.createElement('pre');
        pre.className = 'client-dashboard-json';
        pre.textContent = JSON.stringify(formData, null, 2);
        _jsonPre = pre;
        jsonCard.appendChild(pre);
        cardsGrid.appendChild(jsonCard);
      })
      .catch(function (err) {
        console.error('Client dashboard fetch error:', err);
        titleEl.textContent = 'Error loading dashboard';
      });
  }

  function makeCard(title, fields) {
    var card = document.createElement('div');
    card.className = 'client-dashboard-card';
    var h = document.createElement('h3');
    h.className = 'client-dashboard-card-title';
    h.textContent = title;
    card.appendChild(h);
    var list = document.createElement('div');
    list.className = 'client-dashboard-fields';
    fields.forEach(function (f) {
      if (!f.value && f.value !== 0) return;
      var row = document.createElement('div');
      row.className = 'client-dashboard-field';
      var lbl = document.createElement('span');
      lbl.className = 'client-dashboard-label';
      lbl.textContent = f.label;
      row.appendChild(lbl);
      var val = document.createElement('span');
      val.className = 'client-dashboard-value';
      val.textContent = f.value;
      row.appendChild(val);
      list.appendChild(row);
    });
    card.appendChild(list);
    return card;
  }

  // --- Build readable cards from checklist formData ---
  function prettifyKey(key) {
    return key.replace(/[_-]/g, ' ').replace(/\b\w/g, function (c) { return c.toUpperCase(); });
  }

  function flattenObject(obj) {
    var fields = [];
    if (!obj || typeof obj !== 'object') return fields;
    var skip = ['month_label', 'months_display'];
    Object.keys(obj).forEach(function (k) {
      if (skip.indexOf(k) !== -1) return;
      var val = obj[k];
      if (val === null || val === undefined || val === '' || val === false) return;
      if (val === true) { fields.push({ label: prettifyKey(k), value: 'Yes' }); return; }
      if (Array.isArray(val)) {
        // Array of strings
        var strings = val.filter(function (v) { return typeof v === 'string'; });
        if (strings.length === val.length && val.length > 0) {
          fields.push({ label: prettifyKey(k), value: val.join(', ') });
        } else {
          // Array of objects — flatten each
          val.forEach(function (item, i) {
            if (typeof item === 'object' && item !== null) {
              var sub = flattenObject(item);
              sub.forEach(function (s) { fields.push(s); });
            } else if (item) {
              fields.push({ label: prettifyKey(k) + ' ' + (i + 1), value: String(item) });
            }
          });
        }
      } else if (typeof val === 'object') {
        var sub = flattenObject(val);
        sub.forEach(function (s) { fields.push(s); });
      } else {
        fields.push({ label: prettifyKey(k), value: String(val) });
      }
    });
    return fields;
  }

  // Shorten month label: "February, 2026" -> "Feb", "May 2026" -> "May"
  function shortMonth(label) {
    if (!label) return '?';
    var m = label.replace(/,?\s*\d{4}/, '').trim();
    return m.substring(0, 3) || label;
  }

  // Tabbed card — shows month tabs at top, content switches per tab
  function makeTabbedCard(title, entries) {
    if (!Array.isArray(entries) || entries.length === 0) return null;

    var card = document.createElement('div');
    card.className = 'client-dashboard-card';
    var h = document.createElement('h3');
    h.className = 'client-dashboard-card-title';
    h.textContent = title;
    card.appendChild(h);

    if (entries.length === 1) {
      var fields = flattenClean(entries[0]);
      var list = buildFieldList(fields);
      card.appendChild(list);
      return card;
    }

    var tabBar = document.createElement('div');
    tabBar.className = 'dashboard-tab-bar';
    var contentArea = document.createElement('div');
    contentArea.className = 'dashboard-tab-content';

    entries.forEach(function (entry, idx) {
      var tabLabel = entry.month_label || entry.months_display || '#' + (idx + 1);
      var tab = document.createElement('button');
      tab.className = 'dashboard-tab' + (idx === 0 ? ' active' : '');
      tab.type = 'button';
      tab.textContent = shortMonth(tabLabel);
      tab.addEventListener('click', function () {
        tabBar.querySelectorAll('.dashboard-tab').forEach(function (t) { t.classList.remove('active'); });
        tab.classList.add('active');
        while (contentArea.firstChild) contentArea.removeChild(contentArea.firstChild);
        contentArea.appendChild(buildFieldList(flattenClean(entry)));
      });
      tabBar.appendChild(tab);
    });

    card.appendChild(tabBar);
    contentArea.appendChild(buildFieldList(flattenClean(entries[0])));
    card.appendChild(contentArea);
    return card;
  }

  function buildFieldList(fields) {
    var list = document.createElement('div');
    list.className = 'client-dashboard-fields';
    fields.forEach(function (f) {
      if (!f.value && f.value !== 0) return;
      var row = document.createElement('div');
      row.className = 'client-dashboard-field';
      var lbl = document.createElement('span');
      lbl.className = 'client-dashboard-label';
      lbl.textContent = f.label;
      row.appendChild(lbl);
      var val = document.createElement('span');
      val.className = 'client-dashboard-value';
      val.textContent = f.value;
      row.appendChild(val);
      list.appendChild(row);
    });
    return list;
  }

  // Smarter flatten — skips zero amounts, false booleans, empty nested objects
  function flattenClean(obj) {
    var fields = [];
    if (!obj || typeof obj !== 'object') return fields;
    var skip = ['month_label', 'months_display'];
    Object.keys(obj).forEach(function (k) {
      if (skip.indexOf(k) !== -1) return;
      var val = obj[k];
      if (val === null || val === undefined || val === '' || val === false || val === 0 || val === '0') return;
      if (val === true) { fields.push({ label: prettifyKey(k), value: 'Yes' }); return; }
      if (Array.isArray(val)) {
        var strings = val.filter(function (v) { return typeof v === 'string' && v; });
        if (strings.length === val.length && val.length > 0) {
          fields.push({ label: prettifyKey(k), value: val.join(', ') });
        } else {
          val.forEach(function (item) {
            if (typeof item === 'object' && item !== null) {
              flattenClean(item).forEach(function (s) { fields.push(s); });
            } else if (item) {
              fields.push({ label: prettifyKey(k), value: String(item) });
            }
          });
        }
      } else if (typeof val === 'object') {
        flattenClean(val).forEach(function (s) { fields.push(s); });
      } else {
        fields.push({ label: prettifyKey(k), value: String(val) });
      }
    });
    return fields;
  }

  function buildFormDataCards(cardsGrid, formData, bookingData) {
    if (!formData || typeof formData !== 'object') return;

    // Client info already in sidebar — skip it

    // Tabbed sections — monthly arrays
    var tabbedSections = [
      { key: 'social_media_management', title: 'Social Media Management' },
      { key: 'agri4all', title: 'Agri4All' },
      { key: 'online_articles', title: 'Online Articles' },
      { key: 'banners', title: 'Banners' },
      { key: 'magazine', title: 'Magazine / Print' },
      { key: 'video', title: 'Video' },
      { key: 'website', title: 'Website' }
    ];

    tabbedSections.forEach(function (sec) {
      var arr = formData[sec.key];
      if (!Array.isArray(arr) || arr.length === 0) return;
      var card = makeTabbedCard(sec.title, arr);
      if (card) cardsGrid.appendChild(card);
    });

    // Financial — show all fields per month, handle both formats
    var currency = formData.financial_currency || '';
    var fin = formData.financial;
    if (Array.isArray(fin) && fin.length > 0) {
      var finEntries = fin.map(function (entry) {
        var mapped = { month_label: entry.month_label, months_display: entry.months_display };
        // Show every field in the entry except month identifiers
        Object.keys(entry).forEach(function (k) {
          if (k === 'month_label' || k === 'months_display') return;
          var val = entry[k];
          if (val === null || val === undefined || val === '') return;
          mapped[prettifyKey(k)] = String(val);
        });
        return mapped;
      });
      var finCard = makeTabbedCard('Financials', finEntries);
      if (finCard) cardsGrid.appendChild(finCard);
    }

    // Financial totals
    var ft = formData.financial_totals;
    if (ft && (ft.subtotal || ft.tax || ft.total)) {
      var totalsFields = [];
      if (currency) totalsFields.push({ label: 'Currency', value: currency.trim() });
      if (ft.subtotal) totalsFields.push({ label: 'Subtotal', value: ft.subtotal });
      if (ft.tax) totalsFields.push({ label: 'VAT (15%)', value: ft.tax });
      if (ft.total) totalsFields.push({ label: 'Total', value: ft.total });
      cardsGrid.appendChild(makeCard('Financial Totals', totalsFields));
    }

    // Sign off
    var so = formData.sign_off;
    if (so && (so.date || so.representative)) {
      cardsGrid.appendChild(makeCard('Sign Off', [
        { label: 'Date', value: so.date },
        { label: 'Representative', value: so.representative }
      ]));
    }

    // Any remaining top-level keys
    var handled = ['client_information', 'social_media_management', 'agri4all',
      'online_articles', 'banners', 'magazine', 'video', 'website',
      'financial', 'financial_totals', 'financial_currency', 'sign_off'];
    Object.keys(formData).forEach(function (k) {
      if (handled.indexOf(k) !== -1) return;
      var val = formData[k];
      if (!val) return;
      if (Array.isArray(val) && val.length > 0) {
        var card = makeTabbedCard(prettifyKey(k), val);
        if (card) cardsGrid.appendChild(card);
      } else if (typeof val === 'object') {
        var fields = flattenClean(val);
        if (fields.length > 0) cardsGrid.appendChild(makeCard(prettifyKey(k), fields));
      } else {
        cardsGrid.appendChild(makeCard(prettifyKey(k), [{ label: prettifyKey(k), value: String(val) }]));
      }
    });
  }

  // --- Expose tab renderers (same signature as before) ---
  window.renderProposalTab = function (container) { renderProposalTabWithSubSheets(container); };
  window.renderBookingFormTab = function (container) {
    _activeContainer = container;
    _activeTabRenderer = function () { window.renderBookingFormTab(container); };
    resetContainer(container);

    var grid = document.createElement('div');
    grid.className = 'proposal-grid';

    var leftCol = document.createElement('div');
    leftCol.className = 'proposal-grid-left';

    var rightCol = document.createElement('div');
    rightCol.className = 'proposal-grid-right';

    // Both sheets get the BOOKING_FORM_COLUMNS set so the Unsigned /
    // Change Request / Signed link columns appear on every row.
    var bfSheet = buildSheet('Booking Form', refreshAll, BOOKING_FORM_COLUMNS);
    leftCol.appendChild(bfSheet.el);

    var sentSheet = buildSheet('Sent to Client', refreshAll, BOOKING_FORM_COLUMNS);
    rightCol.appendChild(sentSheet.el);

    grid.appendChild(leftCol);
    grid.appendChild(rightCol);
    container.appendChild(grid);

    // Left sheet is the lifecycle hub — it shows rows in every state from
    // "ready to send" through "signed". change_requested was orphaned
    // before this expansion (not in any tab); onboarding/onboarded rows
    // also appear here so the signed-PDF column has data to show — they
    // ALSO still appear in the Onboarding tab (different lens, same row).
    var bfStatuses = [
      'booking_form_ready',
      'client_changes',
      'change_requested',
      'onboarding',
      'onboarded'
    ];
    var sentStatuses = ['booking_form_sent'];

    function refreshAll() {
      fetch(API_BASE, { headers: getHeaders() })
        .then(function (res) {
          if (!res.ok) throw new Error('Failed to fetch');
          return res.json();
        })
        .then(function (forms) {
          bfSheet.update(forms.filter(function (f) {
            return bfStatuses.indexOf(f.status) !== -1;
          }).map(mapFormToRow));
          sentSheet.update(forms.filter(function (f) {
            return sentStatuses.indexOf(f.status) !== -1;
          }).map(mapFormToRow));
        })
        .catch(function (err) {
          console.error('Booking form tab fetch error:', err);
        });
    }

    refreshAll();
  };
  window.renderOnboardingTab = function (container) {
    _activeContainer = container;
    _activeTabRenderer = function () { window.renderOnboardingTab(container); };
    resetContainer(container);

    var grid = document.createElement('div');
    grid.className = 'proposal-grid';

    var leftCol = document.createElement('div');
    leftCol.className = 'proposal-grid-left';

    var rightCol = document.createElement('div');
    rightCol.className = 'proposal-grid-right';

    var onboardingSheet = buildSheet('Onboarding', refreshAll);
    leftCol.appendChild(onboardingSheet.el);

    var onboardedSheet = buildSheet('Onboarded', refreshAll);
    rightCol.appendChild(onboardedSheet.el);

    grid.appendChild(leftCol);
    grid.appendChild(rightCol);
    container.appendChild(grid);

    function refreshAll() {
      fetch(API_BASE, { headers: getHeaders() })
        .then(function (res) {
          if (!res.ok) throw new Error('Failed to fetch');
          return res.json();
        })
        .then(function (forms) {
          onboardingSheet.update(forms.filter(function (f) {
            return f.status === 'onboarding';
          }).map(mapFormToRow));
          onboardedSheet.update(forms.filter(function (f) {
            return f.status === 'onboarded';
          }).map(mapFormToRow));
        })
        .catch(function (err) {
          console.error('Onboarding tab fetch error:', err);
        });
    }

    refreshAll();
  };
  window.renderDeclinedTab = function (container) { renderAdminTab(container, 'Declined Proposal'); };

  // Design > Proposals — two-sheet layout (Design Proposals left, Design Review right)
  window.renderDesignProposalsTab = function (container) {
    _activeContainer = container;
    _activeTabRenderer = function () { window.renderDesignProposalsTab(container); };
    resetContainer(container);

    var grid = document.createElement('div');
    grid.className = 'proposal-grid';

    var leftCol = document.createElement('div');
    leftCol.className = 'proposal-grid-left';

    var rightCol = document.createElement('div');
    rightCol.className = 'proposal-grid-right';

    var designSheet = buildSheet('Design Proposals', refreshAll, DESIGN_PROPOSAL_COLUMNS, {
      extraRowActions: [
        {
          icon: ICON_UPLOAD,
          tooltip: 'Upload proposal file',
          className: 'action-upload',
          onClick: function (rowData) {
            uploadProposalFile(rowData, refreshAll);
          }
        }
      ]
    });
    designSheet.el.classList.add('design-proposals-sheet');
    leftCol.appendChild(designSheet.el);

    var reviewSheet = buildSheet('Design Review', refreshAll, null, {
      extraRowActions: [
        {
          icon: ICON_CHANGE_REQUEST,
          tooltip: 'Request changes',
          className: 'action-change-request',
          visible: function (rowData) { return rowData.status === 'design_review'; },
          onClick: function (rowData) {
            fetch(API_BASE + '/' + rowData.id, {
              method: 'PATCH',
              headers: getHeaders(),
              body: JSON.stringify({ status: 'design_changes' })
            }).then(function (res) { if (res.ok) refreshAll(); });
          }
        }
      ]
    });
    rightCol.appendChild(reviewSheet.el);

    grid.appendChild(leftCol);
    grid.appendChild(rightCol);
    container.appendChild(grid);

    var designStatuses = ['design_proposal'];
    var reviewStatuses = ['design_review', 'design_changes'];

    function refreshAll() {
      fetch(API_BASE, { headers: getHeaders() })
        .then(function (res) {
          if (!res.ok) throw new Error('Failed to fetch');
          return res.json();
        })
        .then(function (forms) {
          designSheet.update(forms.filter(function (f) {
            return designStatuses.indexOf(f.status) !== -1;
          }).map(mapFormToRow));
          reviewSheet.update(forms.filter(function (f) {
            return reviewStatuses.indexOf(f.status) !== -1;
          }).map(mapFormToRow));
        })
        .catch(function (err) {
          console.error('Design proposals fetch error:', err);
        });
    }

    refreshAll();
  };

  // renderDesignWebDesignTab lives in pages/design/design-page.js
})();
