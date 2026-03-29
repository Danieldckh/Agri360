(function () {
  'use strict';

  var API_BASE = '/api/booking-forms';

  // SVG icon paths for row actions
  var ICON_DELETE = 'M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z';
  var ICON_SKIP = 'M6 18l8.5-6L6 6v12zm2-8.14L11.03 12 8 14.14V9.86zM16.5 6H18v12h-1.5V6z';
  var ICON_ADVANCE = 'M12 4l-1.41 1.41L16.17 11H4v2h12.17l-5.58 5.59L12 20l8-8z';

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

  // Column configs for each sheet
  var todoColumns = [
    { key: 'client', label: 'Client', sortable: true, isName: true },
    { key: 'title', label: 'Title', sortable: true, type: 'text' },
    { key: 'representative', label: 'Representative', sortable: true, type: 'text' },
    { key: 'campaignStart', label: 'Campaign Start', sortable: true, type: 'date' },
    { key: 'campaignEnd', label: 'Campaign End', sortable: true, type: 'date' },
    { key: 'createdAt', label: 'Created', sortable: true, type: 'date' },
    { key: 'status', label: 'Status', sortable: true, type: 'status', editable: true, options: ['draft', 'pending', 'in_design', 'sent_to_client', 'approved', 'declined'] }
  ];

  var sideColumns = [
    { key: 'client', label: 'Client', sortable: true, isName: true },
    { key: 'title', label: 'Title', sortable: true, type: 'text' },
    { key: 'createdAt', label: 'Created', sortable: true, type: 'date' },
    { key: 'status', label: 'Status', sortable: true, type: 'status', editable: true, options: ['draft', 'pending', 'in_design', 'sent_to_client', 'approved', 'declined'] }
  ];

  // Map API response to sheet row data
  function mapFormToRow(form) {
    return {
      id: form.id,
      client: form.clientName || form.title || 'Untitled',
      title: form.title || '—',
      representative: form.representative || '—',
      campaignStart: form.campaignMonthStart || null,
      campaignEnd: form.campaignMonthEnd || null,
      createdAt: form.createdAt || null,
      status: form.status || 'draft'
    };
  }

  // Filter forms by status into the 3 buckets
  function splitByStatus(forms) {
    var todo = [];
    var inDesign = [];
    var sentToClient = [];

    forms.forEach(function (form) {
      var row = mapFormToRow(form);
      var s = (form.status || 'draft').toLowerCase().replace(/\s+/g, '_');
      if (s === 'in_design') {
        inDesign.push(row);
      } else if (s === 'sent_to_client' || s === 'sent') {
        sentToClient.push(row);
      } else {
        // draft, pending, or anything else goes to To Do
        todo.push(row);
      }
    });

    return { todo: todo, inDesign: inDesign, sentToClient: sentToClient };
  }

  // Reusable sheet card builder (mirrors buildSheetCard from app.js)
  function buildProposalSheet(title, columns, opts) {
    opts = opts || {};
    var card = document.createElement('div');
    card.className = 'dept-sheet-card' + (opts.compact ? ' dept-sheet-card-compact' : '');

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

    var searchInput = null;
    if (!opts.compact) {
      searchInput = document.createElement('input');
      searchInput.type = 'text';
      searchInput.className = 'dept-sheet-search';
      searchInput.placeholder = 'Search ' + title.toLowerCase() + '...';
      header.appendChild(searchInput);
    }

    card.appendChild(header);

    var sheetContainer = document.createElement('div');
    sheetContainer.className = 'dept-sheet-container';
    card.appendChild(sheetContainer);

    var allData = [];

    function render() {
      var filtered = allData;
      if (searchInput) {
        var term = searchInput.value.toLowerCase();
        if (term) {
          filtered = allData.filter(function (row) {
            return columns.some(function (col) {
              var val = row[col.key];
              return val && val.toString().toLowerCase().indexOf(term) !== -1;
            });
          });
        }
      }

      countBadge.textContent = filtered.length;

      if (window.renderSheet) {
        var sheetConfig = {
          columns: columns,
          data: filtered,
          searchable: false,
          apiEndpoint: API_BASE,
          onCellEdit: function (rowData, key, newValue) {
            if (key === 'status' && opts.onStatusChange) {
              setTimeout(function () { opts.onStatusChange(); }, 300);
            }
          }
        };
        if (opts.rowActions) sheetConfig.rowActions = opts.rowActions;
        window.renderSheet(sheetContainer, sheetConfig);
      }
    }

    if (searchInput) {
      searchInput.addEventListener('input', render);
    }
    render();

    return { el: card, update: function (data) { allData = data; render(); } };
  }

  function renderProposalTab(container) {
    while (container.firstChild) container.removeChild(container.firstChild);
    container.style.display = 'flex';
    container.style.alignItems = 'stretch';
    container.style.justifyContent = '';
    container.style.flexDirection = '';
    container.style.height = '';
    container.style.gap = '';
    container.style.padding = '';

    var layout = document.createElement('div');
    layout.className = 'dept-dashboard-layout proposal-dashboard-layout';

    // Left column — main "To Do" sheet
    var mainCol = document.createElement('div');
    mainCol.className = 'dept-dashboard-main';

    // Right column — stacked "In Design" + "Sent to Client"
    var sideCol = document.createElement('div');
    sideCol.className = 'dept-dashboard-side proposal-side-col';

    // Row actions for admin-proposals
    var proposalRowActions = [
      {
        icon: ICON_DELETE,
        tooltip: 'Delete proposal',
        className: 'action-delete',
        onClick: function (rowData) {
          if (!confirm('Delete this proposal?')) return;
          fetch(API_BASE + '/' + rowData.id, {
            method: 'DELETE',
            headers: getHeaders()
          }).then(function (res) {
            if (res.ok) refreshAll();
          });
        }
      },
      {
        icon: ICON_SKIP,
        tooltip: 'Skip to booking form dashboard',
        className: 'action-skip',
        onClick: function (rowData) {
          fetch(API_BASE + '/' + rowData.id, {
            method: 'PATCH',
            headers: getHeaders(),
            body: JSON.stringify({ department: 'booking-form-dashboard' })
          }).then(function (res) {
            if (res.ok) refreshAll();
          });
        }
      },
      {
        icon: ICON_ADVANCE,
        tooltip: 'Send to design proposals',
        className: 'action-advance',
        onClick: function (rowData) {
          fetch(API_BASE + '/' + rowData.id, {
            method: 'PATCH',
            headers: getHeaders(),
            body: JSON.stringify({ department: 'design-proposals' })
          }).then(function (res) {
            if (res.ok) refreshAll();
          });
        }
      }
    ];

    // Build the 3 sheets
    var todoSheet = buildProposalSheet('To Do', todoColumns, {
      onStatusChange: refreshAll,
      rowActions: proposalRowActions
    });
    var designSheet = buildProposalSheet('In Design', sideColumns, {
      compact: true,
      onStatusChange: refreshAll
    });
    var sentSheet = buildProposalSheet('Sent to Client', sideColumns, {
      compact: true,
      onStatusChange: refreshAll
    });

    mainCol.appendChild(todoSheet.el);
    sideCol.appendChild(designSheet.el);
    sideCol.appendChild(sentSheet.el);

    layout.appendChild(mainCol);
    layout.appendChild(sideCol);
    container.appendChild(layout);

    // Fetch and distribute data
    function refreshAll() {
      fetch(API_BASE + '?department=admin-proposals', { headers: getHeaders() })
        .then(function (res) {
          if (!res.ok) throw new Error('Failed to fetch');
          return res.json();
        })
        .then(function (forms) {
          var split = splitByStatus(forms);
          todoSheet.update(split.todo);
          designSheet.update(split.inDesign);
          sentSheet.update(split.sentToClient);
        })
        .catch(function (err) {
          console.error('Proposal fetch error:', err);
        });
    }

    // Initial load
    refreshAll();
  }

  window.renderProposalTab = renderProposalTab;

  // === Booking Form Dashboard Tab ===

  var bookingColumns = [
    { key: 'client', label: 'Client', sortable: true, isName: true },
    { key: 'title', label: 'Title', sortable: true, type: 'text' },
    { key: 'representative', label: 'Representative', sortable: true, type: 'text' },
    { key: 'campaignStart', label: 'Campaign Start', sortable: true, type: 'date' },
    { key: 'campaignEnd', label: 'Campaign End', sortable: true, type: 'date' },
    { key: 'createdAt', label: 'Created', sortable: true, type: 'date' },
    { key: 'status', label: 'Status', sortable: true, type: 'status', editable: true, options: ['draft', 'pending', 'in_design', 'sent_to_client', 'approved', 'declined'] }
  ];

  var bookingSideColumns = [
    { key: 'client', label: 'Client', sortable: true, isName: true },
    { key: 'title', label: 'Title', sortable: true, type: 'text' },
    { key: 'status', label: 'Status', sortable: true, type: 'status' }
  ];

  function renderBookingFormTab(container) {
    while (container.firstChild) container.removeChild(container.firstChild);
    container.style.display = 'flex';
    container.style.alignItems = 'stretch';
    container.style.justifyContent = '';
    container.style.flexDirection = '';
    container.style.height = '';
    container.style.gap = '';
    container.style.padding = '';

    var layout = document.createElement('div');
    layout.className = 'dept-dashboard-layout';

    var mainCol = document.createElement('div');
    mainCol.className = 'dept-dashboard-main';

    var sideCol = document.createElement('div');
    sideCol.className = 'dept-dashboard-side';

    var mainSheet = buildProposalSheet('Booking Forms', bookingColumns, {
      onStatusChange: refreshAll
    });
    var sideSheet = buildProposalSheet('Pending Bookings', bookingSideColumns, {
      compact: true,
      onStatusChange: refreshAll
    });

    mainCol.appendChild(mainSheet.el);
    sideCol.appendChild(sideSheet.el);
    layout.appendChild(mainCol);
    layout.appendChild(sideCol);
    container.appendChild(layout);

    function refreshAll() {
      fetch(API_BASE + '?department=booking-form-dashboard', { headers: getHeaders() })
        .then(function (res) {
          if (!res.ok) throw new Error('Failed to fetch');
          return res.json();
        })
        .then(function (forms) {
          var all = forms.map(mapFormToRow);
          mainSheet.update(all);
          var pending = all.filter(function (r) { return r.status === 'pending' || r.status === 'draft'; });
          sideSheet.update(pending);
        })
        .catch(function (err) {
          console.error('Booking form fetch error:', err);
        });
    }

    refreshAll();
  }

  window.renderBookingFormTab = renderBookingFormTab;
})();
