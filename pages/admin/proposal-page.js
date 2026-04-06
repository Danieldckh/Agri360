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
  var _savedSidebarHTML = null;

  function showDashboardSidebar(data) {
    var nav = document.querySelector('#sidebar nav');
    if (!nav) return;

    // Save current sidebar content
    _savedSidebarHTML = nav.cloneNode(true);

    while (nav.firstChild) nav.removeChild(nav.firstChild);

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

    var sep = document.createElement('div');
    sep.style.cssText = 'height:1px;background:rgba(0,0,0,0.08);margin:8px 12px';
    nav.appendChild(sep);

    // Company info section
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

    var fields = [
      { label: 'Reg No', value: data.clientCompanyRegNo },
      { label: 'VAT', value: data.clientVatNumber },
      { label: 'Website', value: data.clientWebsite },
      { label: 'Industry', value: data.clientIndustryExpertise },
      { label: 'Email', value: data.clientEmail },
      { label: 'Phone', value: data.clientPhone },
      { label: 'Address', value: data.clientPhysicalAddress },
      { label: 'Postal', value: data.clientPostalAddress }
    ];

    fields.forEach(function (f) {
      if (!f.value) return;
      var row = document.createElement('div');
      row.className = 'sidebar-dashboard-field';
      var lbl = document.createElement('span');
      lbl.className = 'sidebar-dashboard-label';
      lbl.textContent = f.label;
      row.appendChild(lbl);
      var val = document.createElement('span');
      val.className = 'sidebar-dashboard-value';
      val.textContent = f.value;
      row.appendChild(val);
      companySection.appendChild(row);
    });

    nav.appendChild(companySection);

    // Status & campaign
    var sep2 = document.createElement('div');
    sep2.style.cssText = 'height:1px;background:rgba(0,0,0,0.08);margin:8px 12px';
    nav.appendChild(sep2);

    var statusSection = document.createElement('div');
    statusSection.className = 'sidebar-dashboard-section';
    var statusLabel = document.createElement('div');
    statusLabel.className = 'sidebar-dashboard-meta';
    statusLabel.textContent = (data.status || '').replace(/_/g, ' ');
    statusSection.appendChild(statusLabel);
    if (data.campaignMonthStart || data.campaignMonthEnd) {
      var campaign = document.createElement('div');
      campaign.className = 'sidebar-dashboard-meta';
      campaign.textContent = (data.campaignMonthStart || '?') + ' → ' + (data.campaignMonthEnd || '?');
      statusSection.appendChild(campaign);
    }
    nav.appendChild(statusSection);
  }

  function restoreDashboardSidebar() {
    var nav = document.querySelector('#sidebar nav');
    if (!nav || !_savedSidebarHTML) return;
    while (nav.firstChild) nav.removeChild(nav.firstChild);
    while (_savedSidebarHTML.firstChild) {
      nav.appendChild(_savedSidebarHTML.firstChild);
    }
    _savedSidebarHTML = null;
  }

  function parseContact(raw) {
    if (!raw) return {};
    if (typeof raw === 'string') try { return JSON.parse(raw); } catch (e) { return {}; }
    return raw;
  }

  function makeContactCard(title, contact) {
    var fields = [];
    if (contact.name) fields.push({ label: 'Name', value: contact.name });
    if (contact.email) fields.push({ label: 'Email', value: contact.email });
    if (contact.cell) fields.push({ label: 'Cell', value: contact.cell });
    if (contact.tel) fields.push({ label: 'Tel', value: contact.tel });
    if (fields.length === 0) return null;
    return makeCard(title, fields);
  }

  function renderClientDashboard(container, bookingFormId) {
    resetContainer(container);

    var wrapper = document.createElement('div');
    wrapper.className = 'client-dashboard';

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

        // Replace sidebar with company info
        showDashboardSidebar(data);

        // Card 1: Primary Contact
        var pc = parseContact(data.clientPrimaryContact);
        var pcCard = makeContactCard('Primary Contact', pc);
        if (pcCard) cardsGrid.appendChild(pcCard);

        // Card 2: Material Contact
        var mc = parseContact(data.clientMaterialContact);
        var mcCard = makeContactCard('Material Contact', mc);
        if (mcCard) cardsGrid.appendChild(mcCard);

        // Card 3: Accounts Contact
        var ac = parseContact(data.clientAccountsContact);
        var acCard = makeContactCard('Accounts Contact', ac);
        if (acCard) cardsGrid.appendChild(acCard);

        // Card 4: Booking Info
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

        // Card 5: Full Checklist JSON
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
        // Full JSON — includes all checklist sections
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

  // --- Expose tab renderers (same signature as before) ---
  window.renderProposalTab = function (container) { renderProposalTabWithSubSheets(container); };
  window.renderBookingFormTab = function (container) { renderAdminTab(container, 'Booking Form'); };
  window.renderOnboardingTab = function (container) { renderAdminTab(container, 'Onboarding'); };
  window.renderDeclinedTab = function (container) { renderAdminTab(container, 'Declined Proposal'); };

  // Design tabs — keep as stubs if still needed
  window.renderDesignProposalsTab = function (container) { renderAdminTab(container, 'Proposal'); };
  window.renderDesignWebDesignTab = function (container) {};
})();
