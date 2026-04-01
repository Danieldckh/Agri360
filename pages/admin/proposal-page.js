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

  // --- Proposal tab with sub-sheets ---
  function renderProposalTabWithSubSheets(container) {
    resetContainer(container);

    var wrapper = document.createElement('div');
    wrapper.className = 'dept-dashboard-layout';
    wrapper.style.width = '100%';

    var mainCol = document.createElement('div');
    mainCol.className = 'dept-dashboard-main';
    mainCol.style.width = '100%';

    // Sub-tab bar
    var tabBar = document.createElement('div');
    tabBar.className = 'proposal-sub-tabs';

    var sheetContainer = document.createElement('div');
    sheetContainer.className = 'proposal-sub-sheet-content';

    var sheets = [];
    var activeIndex = 0;

    PROPOSAL_SUB_SHEETS.forEach(function (sub, idx) {
      // Create tab button
      var btn = document.createElement('button');
      btn.className = 'proposal-sub-tab' + (idx === 0 ? ' active' : '');
      btn.textContent = sub.label;

      var badge = document.createElement('span');
      badge.className = 'proposal-sub-tab-count';
      badge.textContent = '0';
      btn.appendChild(badge);

      btn.addEventListener('click', function () {
        activateSubTab(idx);
      });
      tabBar.appendChild(btn);

      // Create sheet for this sub-tab
      var sheet = buildSheet(sub.label, refreshAll);
      sheet.el.style.display = idx === 0 ? '' : 'none';
      sheet.badge = badge;
      sheetContainer.appendChild(sheet.el);
      sheets.push(sheet);
    });

    mainCol.appendChild(tabBar);
    mainCol.appendChild(sheetContainer);
    wrapper.appendChild(mainCol);
    container.appendChild(wrapper);

    function activateSubTab(idx) {
      activeIndex = idx;
      var buttons = tabBar.querySelectorAll('.proposal-sub-tab');
      for (var i = 0; i < buttons.length; i++) {
        buttons[i].classList.toggle('active', i === idx);
      }
      sheets.forEach(function (s, i) {
        s.el.style.display = i === idx ? '' : 'none';
      });
    }

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
            sheets[idx].badge.textContent = rows.length;
          });
        })
        .catch(function (err) {
          console.error('Proposal sub-sheet fetch error:', err);
        });
    }

    refreshAll();
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
