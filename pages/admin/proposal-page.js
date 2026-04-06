(function () {
  'use strict';

  var API_BASE = '/api/booking-forms';

  // Full status chain — single source of truth
  var STATUS_CHAIN = [
    'outline_proposal', 'design_proposal', 'design_review', 'proposal_ready',
    'sent_to_client', 'approved', 'booking_form_sent', 'onboarding', 'onboarded'
  ];
  var ALL_STATUSES = STATUS_CHAIN.concat(['design_changes', 'declined']);

  // Tab → which statuses it shows
  var TAB_FILTERS = {
    'Proposal':         ['outline_proposal', 'design_proposal', 'design_review', 'proposal_ready', 'design_changes'],
    'Booking Form':     ['sent_to_client', 'approved', 'booking_form_sent'],
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
  var sheetColumns = [
    { key: 'client', label: 'Client', sortable: true, isName: true },
    { key: 'status', label: 'Status', sortable: true, type: 'status', editable: true, options: ALL_STATUSES }
  ];

  function mapFormToRow(form) {
    return {
      id: form.id,
      client: form.clientName || form.title || 'Untitled',
      status: form.status || 'outline_proposal'
    };
  }

  // --- Reusable Sheet Builder ---
  function buildSheet(title, refreshFn) {
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

    var rowActions = [
      {
        icon: ICON_UNDO,
        tooltip: 'Previous status',
        className: 'action-undo',
        onClick: function (rowData) {
          var prev = getPrevStatus(rowData.status);
          if (!prev) return;
          fetch(API_BASE + '/' + rowData.id, {
            method: 'PATCH',
            headers: getHeaders(),
            body: JSON.stringify({ status: prev })
          }).then(function (res) {
            if (res.ok) refreshFn();
          });
        }
      },
      {
        icon: ICON_ADVANCE,
        tooltip: 'Next status',
        className: 'action-advance',
        onClick: function (rowData) {
          var next = getNextStatus(rowData.status);
          if (!next) return;
          fetch(API_BASE + '/' + rowData.id, {
            method: 'PATCH',
            headers: getHeaders(),
            body: JSON.stringify({ status: next })
          }).then(function (res) {
            if (res.ok) refreshFn();
          });
        }
      }
    ];

    function render() {
      var filtered = allData;
      var term = searchInput.value.toLowerCase();
      if (term) {
        filtered = allData.filter(function (row) {
          return sheetColumns.some(function (col) {
            var val = row[col.key];
            return val && val.toString().toLowerCase().indexOf(term) !== -1;
          });
        });
      }

      countBadge.textContent = filtered.length;

      if (window.renderSheet) {
        window.renderSheet(sheetContainer, {
          columns: sheetColumns,
          data: filtered,
          searchable: false,
          apiEndpoint: API_BASE,
          leadingActions: leadingActions,
          rowActions: rowActions,
          onCellEdit: function (rowData, key, newValue) {
            if (key === 'status') {
              setTimeout(function () { refreshFn(); }, 300);
            }
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

    var sheet = buildSheet(tabName, refreshAll);
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
      var sheet = buildSheet(sub.label, refreshAll);
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
  function renderClientDashboard(container, bookingFormId) {
    resetContainer(container);

    var wrapper = document.createElement('div');
    wrapper.className = 'client-dashboard';

    // Back button
    var backBtn = document.createElement('button');
    backBtn.className = 'client-dashboard-back';
    backBtn.type = 'button';
    var backArrow = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    backArrow.setAttribute('width', '16');
    backArrow.setAttribute('height', '16');
    backArrow.setAttribute('viewBox', '0 0 24 24');
    backArrow.setAttribute('fill', 'currentColor');
    var backPath = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    backPath.setAttribute('d', ICON_UNDO);
    backArrow.appendChild(backPath);
    backBtn.appendChild(backArrow);
    backBtn.appendChild(document.createTextNode(' Back'));
    backBtn.addEventListener('click', function () {
      if (_activeTabRenderer) _activeTabRenderer();
    });
    wrapper.appendChild(backBtn);

    // Title (placeholder until data loads)
    var titleEl = document.createElement('h2');
    titleEl.className = 'client-dashboard-title';
    titleEl.textContent = 'Loading...';
    wrapper.appendChild(titleEl);

    // Cards container
    var cardsGrid = document.createElement('div');
    cardsGrid.className = 'client-dashboard-grid';
    wrapper.appendChild(cardsGrid);

    container.appendChild(wrapper);

    // Fetch booking form with full client details
    fetch(API_BASE + '/' + bookingFormId, { headers: getHeaders() })
      .then(function (res) {
        if (!res.ok) throw new Error('Failed to fetch booking form');
        return res.json();
      })
      .then(function (data) {
        titleEl.textContent = data.clientName || data.title || 'Client Dashboard';

        // Card 1: Company Information
        var companyCard = makeCard('Company Information', [
          { label: 'Company Name', value: data.clientName },
          { label: 'Trading Name', value: data.clientTradingName },
          { label: 'Reg No', value: data.clientCompanyRegNo },
          { label: 'VAT Number', value: data.clientVatNumber },
          { label: 'Website', value: data.clientWebsite },
          { label: 'Industry', value: data.clientIndustryExpertise },
          { label: 'Physical Address', value: data.clientPhysicalAddress },
          { label: 'Physical Postal Code', value: data.clientPhysicalPostalCode },
          { label: 'Postal Address', value: data.clientPostalAddress },
          { label: 'Postal Code', value: data.clientPostalCode },
          { label: 'Email', value: data.clientEmail },
          { label: 'Phone', value: data.clientPhone }
        ]);
        cardsGrid.appendChild(companyCard);

        // Card 2: Contact Details
        var contacts = [];
        var pc = data.clientPrimaryContact || {};
        if (typeof pc === 'string') try { pc = JSON.parse(pc); } catch (e) { pc = {}; }
        if (pc.name || pc.email || pc.cell || pc.tel) {
          contacts.push({ label: 'Primary Contact', value: '' });
          if (pc.name) contacts.push({ label: '  Name', value: pc.name });
          if (pc.email) contacts.push({ label: '  Email', value: pc.email });
          if (pc.cell) contacts.push({ label: '  Cell', value: pc.cell });
          if (pc.tel) contacts.push({ label: '  Tel', value: pc.tel });
        }
        var mc = data.clientMaterialContact || {};
        if (typeof mc === 'string') try { mc = JSON.parse(mc); } catch (e) { mc = {}; }
        if (mc.name || mc.email || mc.cell || mc.tel) {
          contacts.push({ label: 'Material Contact', value: '' });
          if (mc.name) contacts.push({ label: '  Name', value: mc.name });
          if (mc.email) contacts.push({ label: '  Email', value: mc.email });
          if (mc.cell) contacts.push({ label: '  Cell', value: mc.cell });
          if (mc.tel) contacts.push({ label: '  Tel', value: mc.tel });
        }
        var ac = data.clientAccountsContact || {};
        if (typeof ac === 'string') try { ac = JSON.parse(ac); } catch (e) { ac = {}; }
        if (ac.name || ac.email || ac.cell || ac.tel) {
          contacts.push({ label: 'Accounts Contact', value: '' });
          if (ac.name) contacts.push({ label: '  Name', value: ac.name });
          if (ac.email) contacts.push({ label: '  Email', value: ac.email });
          if (ac.cell) contacts.push({ label: '  Cell', value: ac.cell });
          if (ac.tel) contacts.push({ label: '  Tel', value: ac.tel });
        }
        if (contacts.length === 0) {
          contacts.push({ label: 'Contact Person', value: data.clientContactPerson || 'N/A' });
        }
        var contactCard = makeCard('Contact Details', contacts);
        cardsGrid.appendChild(contactCard);

        // Card 3: Booking Info
        var bookingCard = makeCard('Booking Information', [
          { label: 'Status', value: data.status },
          { label: 'Campaign Start', value: data.campaignMonthStart },
          { label: 'Campaign End', value: data.campaignMonthEnd },
          { label: 'Booked Date', value: data.bookedDate },
          { label: 'Due Date', value: data.dueDate },
          { label: 'Checklist ID', value: data.checklistId },
          { label: 'Representative', value: data.representative }
        ]);
        cardsGrid.appendChild(bookingCard);

        // Card 4: Raw JSON (formData)
        var jsonCard = document.createElement('div');
        jsonCard.className = 'client-dashboard-card client-dashboard-card-wide';
        var jsonTitle = document.createElement('h3');
        jsonTitle.className = 'client-dashboard-card-title';
        jsonTitle.textContent = 'Checklist Data (JSON)';
        jsonCard.appendChild(jsonTitle);
        var pre = document.createElement('pre');
        pre.className = 'client-dashboard-json';
        var formData = data.formData || {};
        if (typeof formData === 'string') {
          try { formData = JSON.parse(formData); } catch (e) { /* keep as string */ }
        }
        pre.textContent = JSON.stringify(formData, null, 2);
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
      if (f.label.startsWith('  ')) {
        row.style.paddingLeft = '12px';
        f.label = f.label.trim();
      } else if (!f.value && f.label) {
        // Section header (e.g. "Primary Contact")
        row.className = 'client-dashboard-field client-dashboard-field-header';
      }
      var lbl = document.createElement('span');
      lbl.className = 'client-dashboard-label';
      lbl.textContent = f.label;
      row.appendChild(lbl);
      if (f.value) {
        var val = document.createElement('span');
        val.className = 'client-dashboard-value';
        val.textContent = f.value;
        row.appendChild(val);
      }
      list.appendChild(row);
    });
    card.appendChild(list);
    return card;
  }

  // --- Expose tab renderers (same signature as before) ---
  window.renderProposalTab = function (container) { renderProposalTabWithSubSheets(container); };
  window.renderBookingFormTab = function (container) { renderAdminTab(container, 'Booking Form'); };
  window.renderOnboardingTab = function (container) { renderAdminTab(container, 'Onboarding'); };
  window.renderDeclinedTab = function (container) { renderAdminTab(container, 'Declined Proposal'); };

  // Design tabs — keep as stubs if still needed
  window.renderDesignProposalsTab = function (container) { renderAdminTab(container, 'Proposal'); };
  window.renderDesignWebDesignTab = function (container) {};
})();
