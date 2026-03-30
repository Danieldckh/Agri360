(function () {
  'use strict';

  var API_BASE = '/api/booking-forms';

  // SVG icon paths for row actions
  var ICON_DELETE = 'M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z';
  var ICON_SKIP = 'M6 18l8.5-6L6 6v12zm2-8.14L11.03 12 8 14.14V9.86zM16.5 6H18v12h-1.5V6z';
  var ICON_ADVANCE = 'M12 4l-1.41 1.41L16.17 11H4v2h12.17l-5.58 5.59L12 20l8-8z';
  var ICON_DECLINE = 'M12 2C6.47 2 2 6.47 2 12s4.47 10 10 10 10-4.47 10-10S17.53 2 12 2zm5 13.59L15.59 17 12 13.41 8.41 17 7 15.59 10.59 12 7 8.41 8.41 7 12 10.59 15.59 7 17 8.41 13.41 12 17 15.59z';
  var ICON_APPROVE = 'M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41L9 16.17z';

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

  // --- Decline Reason Modal ---
  function showDeclineModal(onConfirm) {
    var overlay = document.createElement('div');
    overlay.className = 'decline-modal-overlay';

    var modal = document.createElement('div');
    modal.className = 'decline-modal';

    var title = document.createElement('h3');
    title.textContent = 'Reason for Decline';
    modal.appendChild(title);

    var textarea = document.createElement('textarea');
    textarea.className = 'decline-modal-textarea';
    textarea.placeholder = 'Enter the reason for declining this proposal...';
    textarea.rows = 4;
    modal.appendChild(textarea);

    var btnRow = document.createElement('div');
    btnRow.className = 'decline-modal-buttons';

    var cancelBtn = document.createElement('button');
    cancelBtn.className = 'decline-modal-btn decline-modal-cancel';
    cancelBtn.textContent = 'Cancel';
    cancelBtn.addEventListener('click', function () {
      document.body.removeChild(overlay);
    });

    var confirmBtn = document.createElement('button');
    confirmBtn.className = 'decline-modal-btn decline-modal-confirm';
    confirmBtn.textContent = 'Decline';
    confirmBtn.addEventListener('click', function () {
      var reason = textarea.value.trim();
      if (!reason) {
        textarea.style.borderColor = '#e74c3c';
        textarea.placeholder = 'A reason is required...';
        return;
      }
      document.body.removeChild(overlay);
      onConfirm(reason);
    });

    btnRow.appendChild(cancelBtn);
    btnRow.appendChild(confirmBtn);
    modal.appendChild(btnRow);
    overlay.appendChild(modal);
    document.body.appendChild(overlay);

    setTimeout(function () { textarea.focus(); }, 50);
  }

  // --- Column Configs ---

  var todoColumns = [
    { key: 'client', label: 'Client', sortable: true, isName: true },
    { key: 'title', label: 'Title', sortable: true, type: 'text' },
    { key: 'representative', label: 'Representative', sortable: true, type: 'text' },
    { key: 'campaignStart', label: 'Campaign Start', sortable: true, type: 'date' },
    { key: 'campaignEnd', label: 'Campaign End', sortable: true, type: 'date' },
    { key: 'createdAt', label: 'Created', sortable: true, type: 'date' },
    { key: 'status', label: 'Status', sortable: true, type: 'status', editable: true, options: ['outline_proposal', 'proposal_ready', 'sent_to_client', 'client_approved', 'declined'] }
  ];

  var sideColumns = [
    { key: 'client', label: 'Client', sortable: true, isName: true },
    { key: 'title', label: 'Title', sortable: true, type: 'text' },
    { key: 'createdAt', label: 'Created', sortable: true, type: 'date' },
    { key: 'status', label: 'Status', sortable: true, type: 'status', editable: true, options: ['outline_proposal', 'proposal_ready', 'sent_to_client', 'client_approved', 'declined'] }
  ];

  var bookingColumns = [
    { key: 'client', label: 'Client', sortable: true, isName: true },
    { key: 'title', label: 'Title', sortable: true, type: 'text' },
    { key: 'representative', label: 'Representative', sortable: true, type: 'text' },
    { key: 'campaignStart', label: 'Campaign Start', sortable: true, type: 'date' },
    { key: 'campaignEnd', label: 'Campaign End', sortable: true, type: 'date' },
    { key: 'createdAt', label: 'Created', sortable: true, type: 'date' },
    { key: 'status', label: 'Status', sortable: true, type: 'status', editable: true, options: ['client_approved', 'sent_to_client', 'declined'] }
  ];

  var bookingSideColumns = [
    { key: 'client', label: 'Client', sortable: true, isName: true },
    { key: 'title', label: 'Title', sortable: true, type: 'text' },
    { key: 'createdAt', label: 'Created', sortable: true, type: 'date' },
    { key: 'status', label: 'Status', sortable: true, type: 'status' }
  ];

  var onboardingColumns = [
    { key: 'client', label: 'Client', sortable: true, isName: true },
    { key: 'title', label: 'Title', sortable: true, type: 'text' },
    { key: 'representative', label: 'Representative', sortable: true, type: 'text' },
    { key: 'createdAt', label: 'Created', sortable: true, type: 'date' },
    { key: 'status', label: 'Status', sortable: true, type: 'status' }
  ];

  var onboardingSideColumns = [
    { key: 'client', label: 'Client', sortable: true, isName: true },
    { key: 'title', label: 'Title', sortable: true, type: 'text' },
    { key: 'createdAt', label: 'Created', sortable: true, type: 'date' }
  ];

  var declinedColumns = [
    { key: 'client', label: 'Client', sortable: true, isName: true },
    { key: 'title', label: 'Title', sortable: true, type: 'text' },
    { key: 'declineReason', label: 'Reason', sortable: true, type: 'text' },
    { key: 'createdAt', label: 'Created', sortable: true, type: 'date' },
    { key: 'status', label: 'Status', sortable: true, type: 'status' }
  ];

  var declinedSideColumns = [
    { key: 'client', label: 'Client', sortable: true, isName: true },
    { key: 'declineReason', label: 'Reason', sortable: true, type: 'text' },
    { key: 'createdAt', label: 'Created', sortable: true, type: 'date' }
  ];

  // --- Row Mappers ---

  function mapFormToRow(form) {
    return {
      id: form.id,
      client: form.clientName || form.title || 'Untitled',
      title: form.title || '—',
      representative: form.representative || '—',
      campaignStart: form.campaignMonthStart || null,
      campaignEnd: form.campaignMonthEnd || null,
      createdAt: form.createdAt || null,
      status: form.status || 'draft',
      declineReason: form.declineReason || ''
    };
  }

  // Filter forms by status into the 3 proposal buckets
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
        todo.push(row);
      }
    });

    return { todo: todo, inDesign: inDesign, sentToClient: sentToClient };
  }

  // --- Reusable Sheet Builder ---

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

  // Helper to reset container styles
  function resetContainer(container) {
    while (container.firstChild) container.removeChild(container.firstChild);
    container.style.display = 'flex';
    container.style.alignItems = 'stretch';
    container.style.justifyContent = '';
    container.style.flexDirection = '';
    container.style.height = '';
    container.style.gap = '';
    container.style.padding = '';
  }

  // =============================================
  // 1. PROPOSAL TAB (Admin > Proposal)
  // =============================================

  function renderProposalTab(container) {
    resetContainer(container);

    var layout = document.createElement('div');
    layout.className = 'dept-dashboard-layout proposal-dashboard-layout';

    var mainCol = document.createElement('div');
    mainCol.className = 'dept-dashboard-main';

    var sideCol = document.createElement('div');
    sideCol.className = 'dept-dashboard-side proposal-side-col';

    // --- To Do row actions: Delete | Skip to Booking Form | Send to Design ---
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
        tooltip: 'Skip to booking form',
        className: 'action-skip',
        onClick: function (rowData) {
          fetch(API_BASE + '/' + rowData.id, {
            method: 'PATCH',
            headers: getHeaders(),
            body: JSON.stringify({ department: 'booking-form-dashboard', status: 'client_approved' })
          }).then(function (res) {
            if (res.ok) refreshAll();
          });
        }
      },
      {
        icon: ICON_ADVANCE,
        tooltip: 'Send to design',
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

    // --- Sent to Client row actions: Approve → Booking Form | Decline ---
    var sentToClientActions = [
      {
        icon: ICON_APPROVE,
        tooltip: 'Approve — move to booking form',
        className: 'action-approve',
        onClick: function (rowData) {
          fetch(API_BASE + '/' + rowData.id, {
            method: 'PATCH',
            headers: getHeaders(),
            body: JSON.stringify({ department: 'booking-form-dashboard', status: 'client_approved' })
          }).then(function (res) {
            if (res.ok) refreshAll();
          });
        }
      },
      {
        icon: ICON_DECLINE,
        tooltip: 'Decline proposal',
        className: 'action-decline',
        onClick: function (rowData) {
          showDeclineModal(function (reason) {
            fetch(API_BASE + '/' + rowData.id, {
              method: 'PATCH',
              headers: getHeaders(),
              body: JSON.stringify({ department: 'admin-declined', status: 'declined', declineReason: reason })
            }).then(function (res) {
              if (res.ok) refreshAll();
            });
          });
        }
      }
    ];

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
      onStatusChange: refreshAll,
      rowActions: sentToClientActions
    });

    mainCol.appendChild(todoSheet.el);
    sideCol.appendChild(designSheet.el);
    sideCol.appendChild(sentSheet.el);

    layout.appendChild(mainCol);
    layout.appendChild(sideCol);
    container.appendChild(layout);

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

    refreshAll();
  }

  window.renderProposalTab = renderProposalTab;

  // =============================================
  // 2. BOOKING FORM TAB (Admin > Booking Form)
  // =============================================

  function renderBookingFormTab(container) {
    resetContainer(container);

    var layout = document.createElement('div');
    layout.className = 'dept-dashboard-layout';

    var mainCol = document.createElement('div');
    mainCol.className = 'dept-dashboard-main';

    var sideCol = document.createElement('div');
    sideCol.className = 'dept-dashboard-side';

    // --- Booking Forms row actions: Advance → Sent to Client ---
    var bookingFormActions = [
      {
        icon: ICON_ADVANCE,
        tooltip: 'Send to client',
        className: 'action-advance',
        onClick: function (rowData) {
          fetch(API_BASE + '/' + rowData.id, {
            method: 'PATCH',
            headers: getHeaders(),
            body: JSON.stringify({ status: 'sent_to_client' })
          }).then(function (res) {
            if (res.ok) refreshAll();
          });
        }
      }
    ];

    // --- Sent to Client row actions: Approve → Onboarding | Decline ---
    var bookingSentActions = [
      {
        icon: ICON_APPROVE,
        tooltip: 'Approve — move to onboarding',
        className: 'action-approve',
        onClick: function (rowData) {
          fetch(API_BASE + '/' + rowData.id, {
            method: 'PATCH',
            headers: getHeaders(),
            body: JSON.stringify({ department: 'admin-onboarding', status: 'onboarding' })
          }).then(function (res) {
            if (res.ok) refreshAll();
          });
        }
      },
      {
        icon: ICON_DECLINE,
        tooltip: 'Decline booking',
        className: 'action-decline',
        onClick: function (rowData) {
          showDeclineModal(function (reason) {
            fetch(API_BASE + '/' + rowData.id, {
              method: 'PATCH',
              headers: getHeaders(),
              body: JSON.stringify({ department: 'admin-declined', status: 'declined', declineReason: reason })
            }).then(function (res) {
              if (res.ok) refreshAll();
            });
          });
        }
      }
    ];

    var mainSheet = buildProposalSheet('Booking Forms', bookingColumns, {
      onStatusChange: refreshAll,
      rowActions: bookingFormActions
    });
    var sideSheet = buildProposalSheet('Sent to Client', bookingSideColumns, {
      compact: true,
      onStatusChange: refreshAll,
      rowActions: bookingSentActions
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
          var clientApproved = all.filter(function (r) { return r.status === 'client_approved'; });
          var sentToClient = all.filter(function (r) { return r.status === 'sent_to_client'; });
          mainSheet.update(clientApproved);
          sideSheet.update(sentToClient);
        })
        .catch(function (err) {
          console.error('Booking form fetch error:', err);
        });
    }

    refreshAll();
  }

  window.renderBookingFormTab = renderBookingFormTab;

  // =============================================
  // 3. ONBOARDING TAB (Onboarding left + Onboarded right)
  // =============================================

  function renderOnboardingTab(container) {
    resetContainer(container);

    var layout = document.createElement('div');
    layout.className = 'dept-dashboard-layout';

    var mainCol = document.createElement('div');
    mainCol.className = 'dept-dashboard-main';

    var sideCol = document.createElement('div');
    sideCol.className = 'dept-dashboard-side';

    // --- Onboarding row actions: Advance → Onboarded ---
    var onboardingActions = [
      {
        icon: ICON_APPROVE,
        tooltip: 'Mark as onboarded',
        className: 'action-approve',
        onClick: function (rowData) {
          fetch(API_BASE + '/' + rowData.id, {
            method: 'PATCH',
            headers: getHeaders(),
            body: JSON.stringify({ department: 'admin-onboarded', status: 'onboarded' })
          }).then(function (res) {
            if (!res.ok) return;
            return fetch('/api/deliverables/bulk', {
              method: 'POST',
              headers: getHeaders(),
              body: JSON.stringify({ bookingFormId: rowData.id })
            });
          }).then(function (res) {
            if (res && res.ok) refreshAll();
          });
        }
      }
    ];

    var onboardingSheet = buildProposalSheet('Onboarding', onboardingSideColumns, {
      compact: true,
      onStatusChange: refreshAll,
      rowActions: onboardingActions
    });
    var onboardedSheet = buildProposalSheet('Onboarded', onboardingColumns, {});

    sideCol.appendChild(onboardingSheet.el);
    mainCol.appendChild(onboardedSheet.el);
    layout.appendChild(sideCol);
    layout.appendChild(mainCol);
    container.appendChild(layout);

    function refreshAll() {
      var onboardingReq = fetch(API_BASE + '?department=admin-onboarding', { headers: getHeaders() })
        .then(function (res) { return res.ok ? res.json() : []; });
      var onboardedReq = fetch(API_BASE + '?department=admin-onboarded', { headers: getHeaders() })
        .then(function (res) { return res.ok ? res.json() : []; });

      Promise.all([onboardingReq, onboardedReq])
        .then(function (results) {
          onboardingSheet.update(results[0].map(mapFormToRow));
          onboardedSheet.update(results[1].map(mapFormToRow));
        })
        .catch(function (err) {
          console.error('Onboarding fetch error:', err);
        });
    }

    refreshAll();
  }

  window.renderOnboardingTab = renderOnboardingTab;

  // =============================================
  // 5. DECLINED PROPOSAL TAB (Admin > Declined)
  // =============================================

  function renderDeclinedTab(container) {
    resetContainer(container);

    var layout = document.createElement('div');
    layout.className = 'dept-dashboard-layout';

    var mainCol = document.createElement('div');
    mainCol.className = 'dept-dashboard-main';

    var sideCol = document.createElement('div');
    sideCol.className = 'dept-dashboard-side';

    var mainSheet = buildProposalSheet('Declined Proposals', declinedColumns, {});
    var sideSheet = buildProposalSheet('Declined History', declinedSideColumns, {
      compact: true
    });

    mainCol.appendChild(mainSheet.el);
    sideCol.appendChild(sideSheet.el);
    layout.appendChild(mainCol);
    layout.appendChild(sideCol);
    container.appendChild(layout);

    function refreshAll() {
      fetch(API_BASE + '?department=admin-declined', { headers: getHeaders() })
        .then(function (res) {
          if (!res.ok) throw new Error('Failed to fetch');
          return res.json();
        })
        .then(function (forms) {
          var all = forms.map(mapFormToRow);
          mainSheet.update(all);
          sideSheet.update(all.slice(0, 10));
        })
        .catch(function (err) {
          console.error('Declined fetch error:', err);
        });
    }

    refreshAll();
  }

  window.renderDeclinedTab = renderDeclinedTab;

  // =============================================
  // 6. DESIGN PROPOSALS TAB (Design > Proposals)
  // =============================================

  var designProposalColumns = [
    { key: 'client', label: 'Client', sortable: true, isName: true },
    { key: 'title', label: 'Title', sortable: true, type: 'text' },
    { key: 'representative', label: 'Representative', sortable: true, type: 'text' },
    { key: 'campaignStart', label: 'Campaign Start', sortable: true, type: 'date' },
    { key: 'campaignEnd', label: 'Campaign End', sortable: true, type: 'date' },
    { key: 'createdAt', label: 'Created', sortable: true, type: 'date' },
    { key: 'status', label: 'Status', sortable: true, type: 'status', editable: true, options: ['outline_proposal', 'proposal_ready', 'sent_to_client', 'client_approved', 'declined'] }
  ];

  var designProposalSideColumns = [
    { key: 'client', label: 'Client', sortable: true, isName: true },
    { key: 'title', label: 'Title', sortable: true, type: 'text' },
    { key: 'createdAt', label: 'Created', sortable: true, type: 'date' },
    { key: 'status', label: 'Status', sortable: true, type: 'status', editable: true, options: ['outline_proposal', 'proposal_ready', 'sent_to_client', 'client_approved', 'declined'] }
  ];

  function renderDesignProposalsTab(container) {
    resetContainer(container);

    var layout = document.createElement('div');
    layout.className = 'dept-dashboard-layout proposal-dashboard-layout';

    var mainCol = document.createElement('div');
    mainCol.className = 'dept-dashboard-main';

    var sideCol = document.createElement('div');
    sideCol.className = 'dept-dashboard-side';

    // --- Design Proposal row actions: Advance → move to Design Review ---
    var designActions = [
      {
        icon: ICON_ADVANCE,
        tooltip: 'Send to design review',
        className: 'action-advance',
        onClick: function (rowData) {
          fetch(API_BASE + '/' + rowData.id, {
            method: 'PATCH',
            headers: getHeaders(),
            body: JSON.stringify({ status: 'proposal_ready' })
          }).then(function (res) {
            if (res.ok) refreshAll();
          });
        }
      }
    ];

    // --- Design Review row actions: Request Changes | Approve ---
    var reviewActions = [
      {
        icon: ICON_DELETE,
        tooltip: 'Request design changes',
        className: 'action-delete',
        onClick: function (rowData) {
          fetch(API_BASE + '/' + rowData.id, {
            method: 'PATCH',
            headers: getHeaders(),
            body: JSON.stringify({ status: 'in_design' })
          }).then(function (res) {
            if (res.ok) refreshAll();
          });
        }
      },
      {
        icon: ICON_APPROVE,
        tooltip: 'Approve — send to admin as proposal ready',
        className: 'action-approve',
        onClick: function (rowData) {
          fetch(API_BASE + '/' + rowData.id, {
            method: 'PATCH',
            headers: getHeaders(),
            body: JSON.stringify({ department: 'admin-proposals', status: 'sent_to_client' })
          }).then(function (res) {
            if (res.ok) refreshAll();
          });
        }
      }
    ];

    var designSheet = buildProposalSheet('Design Proposal', designProposalColumns, {
      onStatusChange: refreshAll,
      rowActions: designActions
    });
    var reviewSheet = buildProposalSheet('Design Review', designProposalSideColumns, {
      compact: true,
      onStatusChange: refreshAll,
      rowActions: reviewActions
    });

    mainCol.appendChild(designSheet.el);
    sideCol.appendChild(reviewSheet.el);
    layout.appendChild(mainCol);
    layout.appendChild(sideCol);
    container.appendChild(layout);

    function refreshAll() {
      fetch(API_BASE + '?department=design-proposals', { headers: getHeaders() })
        .then(function (res) {
          if (!res.ok) throw new Error('Failed to fetch');
          return res.json();
        })
        .then(function (forms) {
          var all = forms.map(mapFormToRow);
          var designing = all.filter(function (r) {
            var s = r.status.toLowerCase().replace(/\s+/g, '_');
            return s !== 'proposal_ready';
          });
          var reviewing = all.filter(function (r) {
            var s = r.status.toLowerCase().replace(/\s+/g, '_');
            return s === 'proposal_ready';
          });
          designSheet.update(designing);
          reviewSheet.update(reviewing);
        })
        .catch(function (err) {
          console.error('Design proposals fetch error:', err);
        });
    }

    refreshAll();
  }

  window.renderDesignProposalsTab = renderDesignProposalsTab;

  // =============================================
  // 7. DESIGN WEB DESIGN TAB (Design > Web Design)
  // =============================================

  // Unified workflow from shared definition
  var workflows = window.DELIVERABLE_WORKFLOWS;

  var webDesignColumns = [
    { key: 'client', label: 'Client', sortable: true, isName: true },
    { key: 'title', label: 'Title', sortable: true, type: 'text' },
    { key: 'createdAt', label: 'Created', sortable: true, type: 'date' },
    { key: 'status', label: 'Status', sortable: true, type: 'status', editable: true,
      options: workflows.getStatusChain('website-design') }
  ];

  function renderDesignWebDesignTab(container) {
    resetContainer(container);

    var layout = document.createElement('div');
    layout.className = 'dept-dashboard-layout';

    var mainCol = document.createElement('div');
    mainCol.className = 'dept-dashboard-main';

    // Row actions with advance based on current status
    function makeRowActions(refreshFn) {
      return [
        {
          icon: ICON_ADVANCE,
          tooltip: 'Advance',
          className: 'action-advance',
          onClick: function (rowData) {
            var wf = workflows.getNextStatus('website-design', rowData.status);
            if (!wf) return;
            fetch('/api/deliverables/' + rowData.id, {
              method: 'PATCH',
              headers: getHeaders(),
              body: JSON.stringify({ status: wf.next })
            }).then(function (res) {
              if (res.ok) refreshFn();
            });
          }
        }
      ];
    }

    var mainSheet = buildProposalSheet('Web Design Projects', webDesignColumns, {
      onStatusChange: refreshAll,
      rowActions: makeRowActions(function () { refreshAll(); })
    });

    mainCol.appendChild(mainSheet.el);
    layout.appendChild(mainCol);
    container.appendChild(layout);

    function refreshAll() {
      // Fetch deliverables from design department with type website-design
      fetch('/api/deliverables/by-department/design', { headers: getHeaders() })
        .then(function (res) {
          if (!res.ok) throw new Error('Failed to fetch');
          return res.json();
        })
        .then(function (deliverables) {
          var webDesign = deliverables.filter(function (d) { return d.type === 'website-design'; });
          var rows = webDesign.map(function (d) {
            return {
              id: d.id,
              client: d.clientName || 'Unknown',
              title: d.bookingFormTitle || d.title || '—',
              createdAt: d.createdAt || null,
              status: d.status || 'pending'
            };
          });
          mainSheet.update(rows);
        })
        .catch(function (err) {
          console.error('Design web design fetch error:', err);
        });
    }

    refreshAll();
  }

  window.renderDesignWebDesignTab = renderDesignWebDesignTab;
})();
