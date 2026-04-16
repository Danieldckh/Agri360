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
  // close (X) — delete row
  var ICON_DELETE_X = 'M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z';

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
    // Branch statuses rejoin the main chain
    if (current === 'design_changes') return 'design_review';
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

  // The Booking Form sheet: proposal upload + unsigned/signed booking form files + change requests.
  var BOOKING_FORM_COLUMNS = BASE_COLUMNS.concat([
    { key: 'proposalFileUrl', label: 'Proposal', type: 'upload', uploadEndpoint: '/api/booking-forms/{id}/upload-proposal-file', width: 'md' },
    { key: 'unsignedFileUrl', label: 'Unsigned Booking Form', type: 'upload', uploadType: 'unsigned', width: 'lg' },
    { key: 'signedFileUrl',   label: 'Signed Booking Form',   type: 'upload', uploadType: 'signed',   width: 'lg' },
    { key: 'changeRequestFileUrl', label: 'Change Request',   type: 'upload', width: 'md' }
  ]);

  // Sent to Client sheet: client name only (no other properties).
  var SENT_TO_CLIENT_COLUMNS = [
    { key: 'client', label: 'Client', sortable: true, isName: true }
  ];

  // Design sheets use assignedDesign (the designer), not assignedAdmin
  var DESIGN_BASE_COLUMNS = [
    { key: 'assignedDesign', label: '', type: 'person', editable: true },
    { key: 'client', label: 'Client', sortable: true, isName: true },
    { key: 'status', label: 'Status', sortable: true, type: 'status', editable: true, options: ALL_STATUSES }
  ];

  // Design Proposals sheet: status + the uploaded proposal file artifact.
  var DESIGN_PROPOSAL_COLUMNS = DESIGN_BASE_COLUMNS.concat([
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
    var s = String(b64);
    // The esign service POSTs a full data URI (e.g. "data:application/pdf;base64,...")
    // while older callers send just the base64 payload. Don't double-prefix.
    if (s.startsWith('data:')) return s;
    return 'data:application/pdf;base64,' + s;
  }

  function mapFormToRow(form) {
    return {
      id: form.id,
      assignedAdmin: form.assignedAdmin || null,
      assignedDesign: form.assignedDesign || null,
      client: form.clientName || form.title || 'Untitled',
      status: form.status || 'outline_proposal',
      // Prefilled checklist link — populated by the checklist app at
      // submit time. Surfaced on the Proposal sub-sheet for outline_proposal
      // rows AND on the Booking Form hub regardless of status (because the
      // checklist data is relevant throughout the booking-form lifecycle).
      checklistUrl: form.checklistUrl || '',
      // Unsigned booking form: manual upload OR generated e-sign URL
      unsignedFileUrl: form.unsignedFileUrl || form.esignUrl || '',
      // Signed: prefer the streamed binary at /api/booking-forms/:id/signed-pdf
      // when signedPdf base64 is stored. The legacy signed_file_url column
      // gets populated with the esign *signing* URL (not the signed PDF) by
      // the /sign route, so we can't trust it as a "view signed result"
      // link — the actual signed PDF lives in signed_pdf.
      signedFileUrl: form.signedPdf
        ? (window.API_URL || '') + '/booking-forms/' + form.id + '/signed-pdf'
        : (form.signedFileUrl || ''),
      proposalFileUrl: form.proposalFileUrl || '',
      changeNotes: form.changeNotes || '',
      // Same treatment for change-request PDFs.
      changeRequestFileUrl: form.changeRequestPdf
        ? (window.API_URL || '') + '/booking-forms/' + form.id + '/change-request-pdf'
        : ''
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
    if (!opts.hideSearch) header.appendChild(searchInput);

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

    var rowActions = [];
    if (!opts.hideDelete) {
      rowActions.push({
        icon: ICON_DELETE_X,
        tooltip: 'Delete proposal & deliverables',
        className: 'action-delete',
        onClick: function (rowData) {
          var clientName = rowData.client || rowData.clientName || 'this proposal';
          showConfirmModal(
            'Delete Proposal?',
            'This will permanently delete the proposal for "' + clientName + '" and all associated deliverables. This action cannot be undone.',
            function () {
              fetch(API_BASE + '/' + rowData.id, {
                method: 'DELETE',
                headers: getHeaders()
              }).then(function (res) {
                if (res.ok) refreshFn();
              });
            }
          );
        }
      });
    }
    rowActions.push(
      {
        icon: ICON_ADVANCE,
        tooltip: function (rowData) {
          var next = getNextStatus(rowData.status);
          return next ? 'Advance to ' + next.replace(/_/g, ' ') : 'No next status';
        },
        className: 'action-advance',
        visible: function (rowData) { return !!getNextStatus(rowData.status); },
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
      }
    );
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
          },
          onUploadComplete: function () { refreshFn(); }
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
  var _dashboardData = null;
  var _dashboardPollingTimers = [];

  var MSG_API = '/api/messaging';
  var DEFAULT_AVATAR_SVG = 'data:image/svg+xml;base64,' + btoa('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="rgba(128,128,128,0.4)"><path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/></svg>');
  var _employeeCache = null;

  function fetchEmployeeList() {
    if (_employeeCache) return Promise.resolve(_employeeCache);
    return fetch('/api/employees', { headers: getHeaders() })
      .then(function (r) { return r.json(); })
      .then(function (data) { _employeeCache = Array.isArray(data) ? data : []; return _employeeCache; })
      .catch(function () { return []; });
  }

  function dashFormatTime(dateStr) {
    if (!dateStr) return '';
    var d = new Date(dateStr);
    var now = new Date();
    var diff = now - d;
    if (diff < 60000) return 'just now';
    if (diff < 3600000) return Math.floor(diff / 60000) + 'm ago';
    if (diff < 86400000) return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    return d.toLocaleDateString();
  }

  function stopDashboardPolling() {
    _dashboardPollingTimers.forEach(function (t) { clearInterval(t); });
    _dashboardPollingTimers = [];
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
      stopDashboardPolling();
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

    // === Company Info (editable, hide empty) ===
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
    var hasCompanyField = false;
    companyFields.forEach(function (f) {
      if (!f.value) return;
      hasCompanyField = true;
      cfWrap.appendChild(makeSidebarEditable(f.label, f.value, function (v) {
        return saveClientField(clientId, f.key, v);
      }));
    });
    if (hasCompanyField) nav.appendChild(cfWrap);

    // === Contacts (editable, hide empty sections) ===
    function hasContactData(rawContact) {
      var c = parseContact(rawContact);
      return !!(c.name || c.email || c.cell || c.tel);
    }

    var hasPrimary = hasContactData(data.clientPrimaryContact);
    var hasMaterial = hasContactData(data.clientMaterialContact);
    var hasAccounts = hasContactData(data.clientAccountsContact);

    if (hasPrimary || hasMaterial || hasAccounts) {
      addSep();
      addSectionHeader('Contacts');

      function addEditableContactBlock(title, rawContact, contactKey) {
        var c = parseContact(rawContact);
        if (!c.name && !c.email && !c.cell && !c.tel) return;
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
          if (!contactData[f.field]) return;
          block.appendChild(makeSidebarEditable(f.label, contactData[f.field], function (v) {
            contactData[f.field] = v;
            return saveClientField(clientId, contactKey, contactData);
          }));
        });

        nav.appendChild(block);
      }

      if (hasPrimary) addEditableContactBlock('Primary', data.clientPrimaryContact, 'primaryContact');
      if (hasMaterial) addEditableContactBlock('Material', data.clientMaterialContact, 'materialContact');
      if (hasAccounts) addEditableContactBlock('Accounts', data.clientAccountsContact, 'accountsContact');
    }

    // === Booking Info (editable, hide empty) ===
    var bookingFields = [
      { label: 'Status', value: data.status, key: 'status' },
      { label: 'Start', value: data.campaignMonthStart, key: 'campaignMonthStart' },
      { label: 'End', value: data.campaignMonthEnd, key: 'campaignMonthEnd' },
      { label: 'Booked', value: data.bookedDate, key: 'bookedDate' },
      { label: 'Due', value: data.dueDate, key: 'dueDate' },
      { label: 'Rep', value: data.representative, key: 'representative' }
    ];
    var hasBookingField = bookingFields.some(function (f) { return !!f.value; });

    if (hasBookingField) {
      addSep();
      addSectionHeader('Booking');

      if (data.status) {
        var statusBadge = document.createElement('div');
        statusBadge.className = 'sidebar-dashboard-status';
        var badge = document.createElement('span');
        badge.className = 'proagri-sheet-status proagri-sheet-status-' + (data.status || '').replace(/\s/g, '_');
        badge.textContent = (data.status || '').replace(/_/g, ' ');
        badge.style.textTransform = 'capitalize';
        statusBadge.appendChild(badge);
        nav.appendChild(statusBadge);
      }

      var bfWrap = document.createElement('div');
      bfWrap.className = 'sidebar-dashboard-fields-wrap';
      bookingFields.forEach(function (f) {
        if (!f.value) return;
        bfWrap.appendChild(makeSidebarEditable(f.label, f.value, function (v) { return saveBookingField(data.id, f.key, v); }));
      });
      nav.appendChild(bfWrap);
    }
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

  // Change-notes modal — lets the reviewer describe what needs changing
  // before moving the row to design_changes.
  function showChangeNotesModal(onSubmit) {
    var overlay = document.createElement('div');
    overlay.className = 'confirm-modal-overlay';

    var modal = document.createElement('div');
    modal.className = 'confirm-modal';

    var h = document.createElement('h3');
    h.className = 'confirm-modal-title';
    h.textContent = 'Request Design Changes';
    modal.appendChild(h);

    var textarea = document.createElement('textarea');
    textarea.className = 'confirm-modal-textarea';
    textarea.placeholder = 'Describe the changes needed…';
    textarea.rows = 4;
    textarea.style.cssText = 'width:100%;resize:vertical;margin:8px 0 12px;padding:8px;border:1px solid var(--border-color,#ddd);border-radius:6px;font:inherit;';
    modal.appendChild(textarea);

    var actions = document.createElement('div');
    actions.className = 'confirm-modal-actions';

    var cancelBtn = document.createElement('button');
    cancelBtn.className = 'confirm-modal-btn confirm-modal-cancel';
    cancelBtn.type = 'button';
    cancelBtn.textContent = 'Cancel';
    cancelBtn.addEventListener('click', function () { overlay.remove(); });
    actions.appendChild(cancelBtn);

    var submitBtn = document.createElement('button');
    submitBtn.className = 'confirm-modal-btn confirm-modal-confirm';
    submitBtn.type = 'button';
    submitBtn.textContent = 'Submit';
    submitBtn.addEventListener('click', function () {
      var notes = textarea.value.trim();
      if (!notes) { textarea.focus(); return; }
      overlay.remove();
      onSubmit(notes);
    });
    actions.appendChild(submitBtn);

    modal.appendChild(actions);
    overlay.appendChild(modal);
    overlay.addEventListener('click', function (e) {
      if (e.target === overlay) overlay.remove();
    });
    document.body.appendChild(overlay);
    setTimeout(function () { textarea.focus(); }, 50);
  }

  // --- SVG helper ---
  function makeDashSvg(pathD, size) {
    var svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('width', String(size || 16));
    svg.setAttribute('height', String(size || 16));
    svg.setAttribute('viewBox', '0 0 24 24');
    svg.setAttribute('fill', 'currentColor');
    var p = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    p.setAttribute('d', pathD);
    svg.appendChild(p);
    return svg;
  }

  // --- File Upload Card ---
  function buildUploadCard(title, fileUrl, fileName, uploadFn) {
    var card = document.createElement('div');
    card.className = 'cd-upload-card';

    var h = document.createElement('div');
    h.className = 'cd-upload-card-title';
    h.textContent = title;
    card.appendChild(h);

    // Show existing file if present
    if (fileUrl) {
      var info = document.createElement('div');
      info.className = 'cd-upload-file-info';
      var fileIcon = makeDashSvg('M14 2H6c-1.1 0-2 .9-2 2v16c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V8l-6-6zm-1 7V3.5L18.5 9H13z', 18);
      fileIcon.classList.add('cd-upload-file-icon');
      info.appendChild(fileIcon);
      var nameSpan = document.createElement('span');
      nameSpan.className = 'cd-upload-file-name';
      nameSpan.textContent = fileName || 'Uploaded file';
      info.appendChild(nameSpan);
      var dlBtn = document.createElement('a');
      dlBtn.className = 'cd-upload-file-download';
      dlBtn.href = fileUrl;
      dlBtn.target = '_blank';
      dlBtn.rel = 'noopener noreferrer';
      dlBtn.title = 'Download / View';
      dlBtn.appendChild(makeDashSvg('M19 9h-4V3H9v6H5l7 7 7-7zM5 18v2h14v-2H5z', 16));
      info.appendChild(dlBtn);
      card.appendChild(info);
    }

    // Upload button
    var uploadBtn = document.createElement('button');
    uploadBtn.className = 'cd-upload-btn';
    uploadBtn.type = 'button';
    uploadBtn.appendChild(makeDashSvg('M5 20h14v-2H5v2zm7-18l-5.5 5.5h3.5V14h4V7.5H17.5L12 2z', 16));
    var btnText = document.createElement('span');
    btnText.textContent = fileUrl ? 'Replace file' : 'Upload file';
    uploadBtn.appendChild(btnText);

    uploadBtn.addEventListener('click', function () {
      var input = document.createElement('input');
      input.type = 'file';
      input.accept = '.pdf,.doc,.docx,.png,.jpg,.jpeg';
      input.addEventListener('change', function () {
        if (!input.files || !input.files[0]) return;
        uploadBtn.classList.add('uploading');
        btnText.textContent = 'Uploading...';
        uploadFn(input.files[0]).then(function () {
          uploadBtn.classList.remove('uploading');
          btnText.textContent = 'Uploaded!';
          setTimeout(function () { btnText.textContent = 'Replace file'; }, 1500);
        }).catch(function () {
          uploadBtn.classList.remove('uploading');
          btnText.textContent = 'Upload failed';
          setTimeout(function () { btnText.textContent = fileUrl ? 'Replace file' : 'Upload file'; }, 2000);
        });
      });
      input.click();
    });

    card.appendChild(uploadBtn);
    return card;
  }

  // --- Document Card (view-only, no upload) ---
  function buildDocCard(title, url, linkText) {
    var card = document.createElement('div');
    card.className = 'cd-upload-card';

    var h = document.createElement('div');
    h.className = 'cd-upload-card-title';
    h.textContent = title;
    card.appendChild(h);

    if (url && linkText) {
      var info = document.createElement('div');
      info.className = 'cd-upload-file-info';
      var fileIcon = makeDashSvg('M14 2H6c-1.1 0-2 .9-2 2v16c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V8l-6-6zm-1 7V3.5L18.5 9H13z', 18);
      fileIcon.classList.add('cd-upload-file-icon');
      info.appendChild(fileIcon);
      var nameSpan = document.createElement('span');
      nameSpan.className = 'cd-upload-file-name';
      nameSpan.textContent = linkText;
      info.appendChild(nameSpan);
      var viewBtn = document.createElement('a');
      viewBtn.className = 'cd-upload-file-download';
      viewBtn.href = url;
      viewBtn.target = '_blank';
      viewBtn.rel = 'noopener noreferrer';
      viewBtn.title = 'Open';
      viewBtn.appendChild(makeDashSvg('M12 4.5C7 4.5 2.73 7.61 1 12c1.73 4.39 6 7.5 11 7.5s9.27-3.11 11-7.5c-1.73-4.39-6-7.5-11-7.5zM12 17c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5zm0-8c-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3-1.34-3-3-3z', 16));
      info.appendChild(viewBtn);
      card.appendChild(info);
    } else {
      var empty = document.createElement('div');
      empty.style.cssText = 'font-size:13px;color:var(--text-secondary,#94a3b8);padding:12px 0;text-align:center;';
      empty.textContent = 'Not yet available';
      card.appendChild(empty);
    }

    return card;
  }

  // --- Messenger Component (embedded, WhatsApp-style) ---
  var COMMON_EMOJI = [
    '\ud83d\ude00','\ud83d\ude02','\ud83d\ude0d','\ud83d\ude4f','\ud83d\udc4d','\ud83d\udc4e',
    '\ud83d\udd25','\u2764\ufe0f','\ud83d\ude22','\ud83d\ude31','\ud83d\ude0e','\ud83e\udd14',
    '\ud83d\ude4c','\ud83d\udcaf','\u2705','\u274c','\ud83d\udce3','\ud83c\udf89',
    '\ud83d\udc40','\u270d\ufe0f','\ud83d\udcc4','\ud83d\udcce','\u23f0','\ud83d\ude80'
  ];

  function buildMessenger(bookingFormId, purpose, title) {
    var channelId = null;
    var lastMsgId = 0;
    // Track @mentions: [{name, id, start, end}] — positions in textarea
    var pendingMentions = [];

    var card = document.createElement('div');
    card.className = 'cd-messenger';

    // Header
    var header = document.createElement('div');
    header.className = 'cd-messenger-header';
    var titleEl = document.createElement('div');
    titleEl.className = 'cd-messenger-title';
    titleEl.textContent = title;
    header.appendChild(titleEl);
    card.appendChild(header);

    // Messages area
    var messagesDiv = document.createElement('div');
    messagesDiv.className = 'cd-messenger-messages';
    var emptyMsg = document.createElement('div');
    emptyMsg.className = 'cd-messenger-empty';
    emptyMsg.textContent = 'No messages yet';
    messagesDiv.appendChild(emptyMsg);
    card.appendChild(messagesDiv);

    // Input bar
    var inputBar = document.createElement('div');
    inputBar.className = 'cd-messenger-input';
    inputBar.style.position = 'relative';

    var emojiBtn = document.createElement('button');
    emojiBtn.className = 'cd-messenger-btn';
    emojiBtn.type = 'button';
    emojiBtn.title = 'Emoji';
    emojiBtn.textContent = '\ud83d\ude00';
    emojiBtn.style.fontSize = '16px';
    inputBar.appendChild(emojiBtn);

    var attachBtn = document.createElement('button');
    attachBtn.className = 'cd-messenger-btn';
    attachBtn.type = 'button';
    attachBtn.title = 'Attach files';
    attachBtn.appendChild(makeDashSvg('M16.5 6v11.5c0 2.21-1.79 4-4 4s-4-1.79-4-4V5c0-1.38 1.12-2.5 2.5-2.5s2.5 1.12 2.5 2.5v10.5c0 .55-.45 1-1 1s-1-.45-1-1V6H9.5v9.5c0 1.38 1.12 2.5 2.5 2.5s2.5-1.12 2.5-2.5V5c0-2.21-1.79-4-4-4S6.5 2.79 6.5 5v12.5c0 3.04 2.46 5.5 5.5 5.5s5.5-2.46 5.5-5.5V6H16.5z', 18));
    inputBar.appendChild(attachBtn);

    var textarea = document.createElement('textarea');
    textarea.className = 'cd-messenger-textarea';
    textarea.placeholder = 'Type a message...';
    textarea.rows = 1;
    inputBar.appendChild(textarea);

    var sendBtn = document.createElement('button');
    sendBtn.className = 'cd-messenger-btn';
    sendBtn.type = 'button';
    sendBtn.title = 'Send';
    sendBtn.appendChild(makeDashSvg('M2.01 21L23 12 2.01 3 2 10l15 2-15 2z', 18));
    inputBar.appendChild(sendBtn);

    // Mention dropdown
    var mentionDropdown = document.createElement('div');
    mentionDropdown.className = 'cd-mention-dropdown';
    mentionDropdown.style.display = 'none';
    inputBar.appendChild(mentionDropdown);

    // Emoji picker (simple grid)
    var emojiPicker = document.createElement('div');
    emojiPicker.className = 'cd-mention-dropdown';
    emojiPicker.style.display = 'none';
    emojiPicker.style.cssText += 'display:none;padding:8px;flex-wrap:wrap;gap:4px;bottom:100%;position:absolute;left:0;right:0;background:var(--card-bg,#fff);border:1px solid var(--border-color,#e2e8f0);border-radius:8px;box-shadow:0 4px 16px rgba(0,0,0,0.12);z-index:50;';
    COMMON_EMOJI.forEach(function (em) {
      var btn = document.createElement('button');
      btn.type = 'button';
      btn.textContent = em;
      btn.style.cssText = 'background:none;border:none;font-size:20px;cursor:pointer;padding:4px;border-radius:4px;line-height:1;';
      btn.addEventListener('click', function () {
        var pos = textarea.selectionStart || textarea.value.length;
        textarea.value = textarea.value.substring(0, pos) + em + textarea.value.substring(pos);
        textarea.focus();
        emojiPicker.style.display = 'none';
      });
      emojiPicker.appendChild(btn);
    });
    inputBar.appendChild(emojiPicker);

    card.appendChild(inputBar);

    // Emoji toggle
    emojiBtn.addEventListener('click', function () {
      emojiPicker.style.display = emojiPicker.style.display === 'none' ? 'flex' : 'none';
      mentionDropdown.style.display = 'none';
    });

    // Auto-resize textarea
    textarea.addEventListener('input', function () {
      textarea.style.height = 'auto';
      textarea.style.height = Math.min(textarea.scrollHeight, 100) + 'px';
      emojiPicker.style.display = 'none';
      handleMention(textarea, mentionDropdown);
    });

    // Mention handling — shows dropdown, inserts clean @Name in textarea
    function handleMention(ta, dropdown) {
      var val = ta.value;
      var cursorPos = ta.selectionStart;
      var textBefore = val.substring(0, cursorPos);
      var atMatch = textBefore.match(/@(\w*)$/);
      if (!atMatch) { dropdown.style.display = 'none'; return; }
      var query = atMatch[1].toLowerCase();
      fetchEmployeeList().then(function (employees) {
        var filtered = employees.filter(function (emp) {
          var full = ((emp.firstName || emp.first_name || '') + ' ' + (emp.lastName || emp.last_name || '')).toLowerCase();
          return full.indexOf(query) !== -1 || (emp.username || '').toLowerCase().indexOf(query) !== -1;
        }).slice(0, 6);
        if (filtered.length === 0) { dropdown.style.display = 'none'; return; }
        while (dropdown.firstChild) dropdown.removeChild(dropdown.firstChild);
        filtered.forEach(function (emp) {
          var item = document.createElement('div');
          item.className = 'cd-mention-item';
          var av = document.createElement('div');
          av.className = 'cd-mention-avatar';
          if (emp.photoUrl || emp.photo_url) {
            var img = document.createElement('img');
            img.src = '/uploads/photos/' + (emp.photoUrl || emp.photo_url);
            av.appendChild(img);
          } else {
            av.appendChild(makeDashSvg('M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z', 14));
          }
          item.appendChild(av);
          var nameSpan = document.createElement('span');
          var empName = (emp.firstName || emp.first_name || '') + ' ' + (emp.lastName || emp.last_name || '');
          nameSpan.textContent = empName;
          item.appendChild(nameSpan);
          item.addEventListener('click', function () {
            // Insert clean @Name in textarea, store mapping for send
            var displayText = '@' + empName.trim();
            var before = ta.value.substring(0, cursorPos).replace(/@\w*$/, '');
            var after = ta.value.substring(cursorPos);
            ta.value = before + displayText + ' ' + after;
            pendingMentions.push({ name: empName.trim(), id: emp.id });
            ta.focus();
            dropdown.style.display = 'none';
          });
          dropdown.appendChild(item);
        });
        dropdown.style.display = '';
      });
    }

    // Convert clean @Name mentions to markdown format for API
    function buildContentWithMentions(text) {
      var result = text;
      pendingMentions.forEach(function (m) {
        var pattern = '@' + m.name;
        var replacement = '@[' + m.name + '](employee:' + m.id + ')';
        result = result.replace(pattern, replacement);
      });
      return result;
    }

    // Send message
    function sendMessage() {
      var rawText = textarea.value.trim();
      if (!rawText || !channelId) return;
      var content = buildContentWithMentions(rawText);
      textarea.value = '';
      textarea.style.height = 'auto';
      pendingMentions = [];

      fetch(MSG_API + '/channels/' + channelId + '/messages', {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({ content: content })
      }).then(function (r) { return r.json(); })
        .then(function (msg) {
          if (msg && msg.id) {
            appendBubble(msg, true);
            lastMsgId = msg.id;
          }
        });
    }

    textarea.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); }
    });
    sendBtn.addEventListener('click', sendMessage);

    // Attach files — multiple, auto-sends
    function sendFiles(files) {
      if (!channelId || !files || files.length === 0) return;
      var content = buildContentWithMentions(textarea.value.trim()) || '';
      textarea.value = '';
      textarea.style.height = 'auto';
      pendingMentions = [];
      // Send each file as a separate message (API accepts one file per message)
      Array.prototype.forEach.call(files, function (file, idx) {
        var fd = new FormData();
        fd.append('content', idx === 0 ? (content || file.name) : file.name);
        fd.append('file', file);
        var h = {};
        if (window.getAuthHeaders) {
          var auth = window.getAuthHeaders();
          for (var k in auth) { if (auth.hasOwnProperty(k)) h[k] = auth[k]; }
        }
        fetch(MSG_API + '/channels/' + channelId + '/messages', {
          method: 'POST',
          headers: h,
          body: fd
        }).then(function (r) { return r.json(); })
          .then(function (msg) {
            if (msg && msg.id) {
              appendBubble(msg, true);
              lastMsgId = msg.id;
            }
          });
      });
    }

    attachBtn.addEventListener('click', function () {
      if (!channelId) return;
      var fileInput = document.createElement('input');
      fileInput.type = 'file';
      fileInput.multiple = true;
      fileInput.accept = 'image/*,.pdf,.doc,.docx,.xls,.xlsx,.txt';
      fileInput.addEventListener('change', function () {
        if (fileInput.files && fileInput.files.length > 0) sendFiles(fileInput.files);
      });
      fileInput.click();
    });

    // Bubble rendering
    function appendBubble(msg, scrollToBottom) {
      var empty = messagesDiv.querySelector('.cd-messenger-empty');
      if (empty) empty.remove();

      var user = window.getCurrentUser ? window.getCurrentUser() : { id: 1 };
      var isOwn = msg.senderId ? (msg.senderId === user.id) : (msg.sender_id === user.id);

      var bubble = document.createElement('div');
      bubble.className = 'cd-bubble' + (isOwn ? ' cd-bubble-own' : '');
      bubble.dataset.messageId = msg.id;

      if (!isOwn) {
        var avatar = document.createElement('img');
        avatar.className = 'cd-bubble-avatar';
        avatar.alt = '';
        var photoUrl = msg.senderPhotoUrl || msg.sender_photo_url;
        avatar.src = photoUrl ? '/uploads/photos/' + photoUrl : DEFAULT_AVATAR_SVG;
        bubble.appendChild(avatar);
      }

      var body = document.createElement('div');
      body.className = 'cd-bubble-body';

      var meta = document.createElement('div');
      meta.className = 'cd-bubble-meta';
      var sender = document.createElement('span');
      sender.className = 'cd-bubble-sender';
      var fn = msg.senderFirstName || msg.sender_first_name || '';
      var ln = msg.senderLastName || msg.sender_last_name || '';
      sender.textContent = fn + ' ' + ln;
      meta.appendChild(sender);
      var ts = document.createElement('span');
      ts.className = 'cd-bubble-time';
      ts.textContent = dashFormatTime(msg.createdAt || msg.created_at);
      meta.appendChild(ts);
      body.appendChild(meta);

      // Content — render @mentions as clean names
      var contentEl = document.createElement('div');
      contentEl.className = 'cd-bubble-content';
      var content = msg.content || '';
      var mentionRegex = /@\[([^\]]+)\]\(employee:(\d+)\)/g;
      var lastIdx = 0;
      var mMatch;
      while ((mMatch = mentionRegex.exec(content)) !== null) {
        if (mMatch.index > lastIdx) contentEl.appendChild(document.createTextNode(content.substring(lastIdx, mMatch.index)));
        var mentionSpan = document.createElement('span');
        mentionSpan.style.cssText = 'font-weight:600;color:var(--accent-color,#3b82f6)';
        mentionSpan.textContent = '@' + mMatch[1];
        contentEl.appendChild(mentionSpan);
        lastIdx = mMatch.index + mMatch[0].length;
      }
      if (lastIdx < content.length) contentEl.appendChild(document.createTextNode(content.substring(lastIdx)));
      if (!contentEl.firstChild) contentEl.appendChild(document.createTextNode(content));
      body.appendChild(contentEl);

      // Attachments — images inline (WhatsApp-style), files as links
      var attachments = msg.attachments;
      if (attachments && Array.isArray(attachments) && attachments.length > 0) {
        attachments.forEach(function (att) {
          var attEl = document.createElement('div');
          attEl.className = 'cd-bubble-attachment';
          var mime = att.mimeType || att.mime_type || '';
          var url = '/uploads/attachments/' + att.filename;

          if (mime.indexOf('image/') === 0) {
            // Inline image preview like WhatsApp
            var img = document.createElement('img');
            img.src = url;
            img.alt = att.originalName || att.original_name || 'Image';
            img.style.cssText = 'max-width:220px;max-height:200px;border-radius:6px;cursor:pointer;display:block;margin-top:4px;';
            img.addEventListener('click', function () { window.open(url, '_blank'); });
            attEl.appendChild(img);
          } else {
            var link = document.createElement('a');
            link.href = url;
            link.target = '_blank';
            link.rel = 'noopener noreferrer';
            link.appendChild(makeDashSvg('M14 2H6c-1.1 0-2 .9-2 2v16c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V8l-6-6zm-1 7V3.5L18.5 9H13z', 12));
            var fname = document.createElement('span');
            fname.textContent = att.originalName || att.original_name || att.filename;
            link.appendChild(fname);
            attEl.appendChild(link);
          }

          body.appendChild(attEl);
        });
      }

      bubble.appendChild(body);
      messagesDiv.appendChild(bubble);
      if (scrollToBottom) messagesDiv.scrollTop = messagesDiv.scrollHeight;
    }

    // Initialize: create/find channel, load messages, start polling
    function init() {
      fetch(MSG_API + '/channels/for-booking-form', {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({ bookingFormId: bookingFormId, purpose: purpose })
      }).then(function (r) { return r.json(); })
        .then(function (ch) {
          if (!ch || !ch.id) return;
          channelId = ch.id;
          // Load existing messages
          return fetch(MSG_API + '/channels/' + channelId + '/messages?limit=50', { headers: getHeaders() });
        })
        .then(function (r) { if (r) return r.json(); })
        .then(function (messages) {
          if (!messages || !Array.isArray(messages)) return;
          while (messagesDiv.firstChild) messagesDiv.removeChild(messagesDiv.firstChild);
          if (messages.length === 0) {
            var empty = document.createElement('div');
            empty.className = 'cd-messenger-empty';
            empty.textContent = 'No messages yet';
            messagesDiv.appendChild(empty);
          } else {
            messages.forEach(function (msg) { appendBubble(msg, false); });
            lastMsgId = messages[messages.length - 1].id;
            messagesDiv.scrollTop = messagesDiv.scrollHeight;
          }
          // Poll for new messages every 5s
          var timer = setInterval(function () {
            if (!channelId) return;
            fetch(MSG_API + '/channels/' + channelId + '/messages?after=' + lastMsgId + '&limit=20', { headers: getHeaders() })
              .then(function (r) { return r.json(); })
              .then(function (newMsgs) {
                if (!Array.isArray(newMsgs) || newMsgs.length === 0) return;
                newMsgs.forEach(function (msg) {
                  if (!messagesDiv.querySelector('[data-message-id="' + msg.id + '"]')) {
                    appendBubble(msg, true);
                    lastMsgId = msg.id;
                  }
                });
              }).catch(function () {});
          }, 5000);
          _dashboardPollingTimers.push(timer);
        })
        .catch(function (err) { console.error('Messenger init error:', err); });
    }

    init();
    return card;
  }

  // --- Team List ---
  function buildTeamSection(data) {
    var card = document.createElement('div');
    card.className = 'cd-team';

    var h = document.createElement('div');
    h.className = 'cd-team-title';
    h.textContent = 'Team';
    card.appendChild(h);

    var list = document.createElement('div');
    list.className = 'cd-team-list';
    card.appendChild(list);

    // Gather team member IDs and roles
    var members = [];
    if (data.assignedAdmin) members.push({ id: data.assignedAdmin, role: 'Admin' });

    // Check for design assignment (from deliverables or booking form)
    // We'll fetch from the API to get latest assignments
    var rep = data.representative || '';
    var formData = data.formData || {};
    if (typeof formData === 'string') try { formData = JSON.parse(formData); } catch (e) { formData = {}; }
    if (!rep && formData.sign_off) rep = formData.sign_off.representative || '';

    // Fetch employee details for team members
    fetchEmployeeList().then(function (employees) {
      var empMap = {};
      employees.forEach(function (e) { empMap[e.id] = e; });

      // Admin
      if (data.assignedAdmin && empMap[data.assignedAdmin]) {
        addTeamMember(list, empMap[data.assignedAdmin], 'Admin');
      }

      // Design — check deliverables for this booking form
      fetch('/api/deliverables/by-booking/' + data.id, { headers: getHeaders() })
        .then(function (r) { return r.json(); })
        .then(function (delivs) {
          if (!Array.isArray(delivs)) return;
          var designId = null;
          for (var i = 0; i < delivs.length; i++) {
            if (delivs[i].assignedDesign || delivs[i].assigned_design) {
              designId = delivs[i].assignedDesign || delivs[i].assigned_design;
              break;
            }
          }
          if (designId && empMap[designId]) {
            addTeamMember(list, empMap[designId], 'Design');
          }
        }).catch(function () {});

      // Sales Rep (text-based, not an employee ID)
      if (rep) {
        addTeamMemberText(list, rep, 'Sales Rep');
      }
    });

    return card;
  }

  function addTeamMember(container, emp, role) {
    var member = document.createElement('div');
    member.className = 'cd-team-member';

    var avatar = document.createElement('div');
    avatar.className = 'cd-team-avatar';
    if (emp.photoUrl || emp.photo_url) {
      var img = document.createElement('img');
      img.src = '/uploads/photos/' + (emp.photoUrl || emp.photo_url);
      img.alt = '';
      avatar.appendChild(img);
    } else {
      avatar.appendChild(makeDashSvg('M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z', 22));
    }
    member.appendChild(avatar);

    var name = document.createElement('div');
    name.className = 'cd-team-name';
    name.textContent = (emp.firstName || emp.first_name || '') + ' ' + (emp.lastName || emp.last_name || '');
    member.appendChild(name);

    var roleEl = document.createElement('div');
    roleEl.className = 'cd-team-role';
    roleEl.textContent = role;
    member.appendChild(roleEl);

    container.appendChild(member);
  }

  function addTeamMemberText(container, nameText, role) {
    var member = document.createElement('div');
    member.className = 'cd-team-member';

    var avatar = document.createElement('div');
    avatar.className = 'cd-team-avatar';
    // Generate initials
    var initials = nameText.split(' ').map(function (w) { return w.charAt(0).toUpperCase(); }).join('').substring(0, 2);
    var initialsEl = document.createElement('span');
    initialsEl.style.cssText = 'font-size:14px;font-weight:600;color:var(--text-secondary,#64748b)';
    initialsEl.textContent = initials;
    avatar.appendChild(initialsEl);
    member.appendChild(avatar);

    var name = document.createElement('div');
    name.className = 'cd-team-name';
    name.textContent = nameText;
    member.appendChild(name);

    var roleEl = document.createElement('div');
    roleEl.className = 'cd-team-role';
    roleEl.textContent = role;
    member.appendChild(roleEl);

    container.appendChild(member);
  }

  // --- Main Dashboard Renderer ---
  function renderClientDashboard(container, bookingFormId) {
    resetContainer(container);
    stopDashboardPolling();

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
              stopDashboardPolling();
              restoreDashboardSidebar();
              if (_activeTabRenderer) _activeTabRenderer();
            }
          });
        }
      );
    });
    titleRow.appendChild(trashBtn);
    wrapper.appendChild(titleRow);

    var grid = document.createElement('div');
    grid.className = 'client-dashboard-grid';

    var leftCol = document.createElement('div');
    leftCol.className = 'client-dashboard-left';

    var rightCol = document.createElement('div');
    rightCol.className = 'client-dashboard-right';

    grid.appendChild(leftCol);
    grid.appendChild(rightCol);
    wrapper.appendChild(grid);
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

        // === LEFT COLUMN ===

        // Change Requests messenger
        leftCol.appendChild(buildMessenger(bookingFormId, 'change_requests', 'Change Requests'));

        // Messages messenger
        leftCol.appendChild(buildMessenger(bookingFormId, 'messages', 'Messages'));

        // Team list
        leftCol.appendChild(buildTeamSection(data));

        // === RIGHT COLUMN ===

        // Proposal file upload
        rightCol.appendChild(buildUploadCard(
          'Proposal',
          data.proposalFileUrl,
          data.proposalFileName,
          function (file) {
            var fd = new FormData();
            fd.append('file', file);
            var h = {};
            if (window.getAuthHeaders) {
              var auth = window.getAuthHeaders();
              for (var k in auth) { if (auth.hasOwnProperty(k)) h[k] = auth[k]; }
            }
            return fetch(API_BASE + '/' + bookingFormId + '/upload-proposal-file', {
              method: 'POST', headers: h, body: fd
            }).then(function (r) { if (!r.ok) throw new Error('Upload failed'); });
          }
        ));

        // Booking Form — show existing esign link or a Generate button
        var bfUrl = data.unsignedFileUrl || data.esignUrl;
        if (bfUrl) {
          rightCol.appendChild(buildDocCard(
            'Booking Form',
            bfUrl,
            data.unsignedFileUrl ? 'View Booking Form' : 'Open Signature Page'
          ));
        } else {
          var genCard = document.createElement('div');
          genCard.className = 'cd-upload-card';
          var genTitle = document.createElement('div');
          genTitle.className = 'cd-upload-card-title';
          genTitle.textContent = 'Booking Form';
          genCard.appendChild(genTitle);
          var genBtn = document.createElement('button');
          genBtn.className = 'cd-upload-file-download';
          genBtn.style.cssText = 'display:inline-flex;align-items:center;gap:6px;padding:8px 16px;border:none;border-radius:6px;background:var(--primary,#2563eb);color:#fff;font-size:13px;cursor:pointer;margin:12px 0;';
          genBtn.textContent = 'Generate E-sign Link';
          genBtn.onclick = function () {
            genBtn.disabled = true;
            genBtn.textContent = 'Generating…';
            var h = window.getAuthHeaders ? window.getAuthHeaders() : {};
            h['Content-Type'] = 'application/json';
            fetch(API_BASE + '/' + bookingFormId + '/send-to-esign', {
              method: 'POST', headers: h
            })
              .then(function (r) { return r.json(); })
              .then(function (result) {
                if (result.url) {
                  // Replace the generate card with a proper doc card
                  var newCard = buildDocCard('Booking Form', result.url, 'Open Signature Page');
                  genCard.parentNode.replaceChild(newCard, genCard);
                } else {
                  genBtn.disabled = false;
                  genBtn.textContent = 'Generate E-sign Link';
                  alert('Error: ' + (result.error || 'Unknown error'));
                }
              })
              .catch(function (err) {
                genBtn.disabled = false;
                genBtn.textContent = 'Generate E-sign Link';
                alert('Failed to generate link: ' + err.message);
              });
          };
          genCard.appendChild(genBtn);
          rightCol.appendChild(genCard);
        }

        // Signed Booking Form — show signed PDF if available
        var signedUrl = data.signedFileUrl || '';
        if (!signedUrl && data.signedPdf) signedUrl = 'data:application/pdf;base64,' + data.signedPdf;
        rightCol.appendChild(buildDocCard(
          'Signed Booking Form',
          signedUrl,
          signedUrl ? 'View Signed Booking Form' : null
        ));
      })
      .catch(function (err) {
        console.error('Client dashboard fetch error:', err);
        titleEl.textContent = 'Error loading dashboard';
      });
  }

  // --- Expose tab renderers (same signature as before) ---
  window.renderProposalTab = function (container) { renderProposalTabWithSubSheets(container); };
  window.renderBookingFormTab = function (container) {
    _activeContainer = container;
    _activeTabRenderer = function () { window.renderBookingFormTab(container); };
    resetContainer(container);

    var grid = document.createElement('div');
    grid.className = 'proposal-grid proposal-grid--booking';

    var leftCol = document.createElement('div');
    leftCol.className = 'proposal-grid-left';

    var rightCol = document.createElement('div');
    rightCol.className = 'proposal-grid-right';

    var bfSheet = buildSheet('Booking Form', refreshAll, BOOKING_FORM_COLUMNS);
    leftCol.appendChild(bfSheet.el);

    var sentSheet = buildSheet('Sent to Client', refreshAll, SENT_TO_CLIENT_COLUMNS, { hideSearch: true });
    rightCol.appendChild(sentSheet.el);

    grid.appendChild(leftCol);
    grid.appendChild(rightCol);
    container.appendChild(grid);

    var bfStatuses = ['booking_form_ready'];
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
      hideDelete: true,
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

    var reviewSheet = buildSheet('Design Review', refreshAll, DESIGN_BASE_COLUMNS, {
      hideDelete: true,
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

    var designStatuses = ['design_proposal', 'design_changes'];
    var reviewStatuses = ['design_review'];

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
