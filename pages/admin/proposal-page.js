(function () {
  'use strict';

  var API_BASE = '/api/booking-forms';

  var ICON_DELETE = 'M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z';
  var ICON_SKIP = 'M6 18l8.5-6L6 6v12zm2-8.14L11.03 12 8 14.14V9.86zM16.5 6H18v12h-1.5V6z';
  var ICON_ADVANCE = 'M12 4l-1.41 1.41L16.17 11H4v2h12.17l-5.58 5.59L12 20l8-8z';
  var ICON_DECLINE = 'M12 2C6.47 2 2 6.47 2 12s4.47 10 10 10 10-4.47 10-10S17.53 2 12 2zm5 13.59L15.59 17 12 13.41 8.41 17 7 15.59 10.59 12 7 8.41 8.41 7 12 10.59 15.59 7 17 8.41 13.41 12 17 15.59z';
  var ICON_APPROVE = 'M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41L9 16.17z';
  var ICON_VIEW = 'M12 4.5C7 4.5 2.73 7.61 1 12c1.73 4.39 6 7.5 11 7.5s9.27-3.11 11-7.5c-1.73-4.39-6-7.5-11-7.5zM12 17c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5zm0-8c-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3-1.34-3-3-3z';

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

  // --- Decline Reason Modal (template-based) ---
  function showDeclineModal(onConfirm) {
    window.loadTemplate('pages/decline-modal.html').then(function (html) {
      var wrapper = document.createElement('div');
      wrapper.innerHTML = html;
      var overlay = wrapper.firstElementChild;

      var textarea = overlay.querySelector('.decline-modal-textarea');
      var cancelBtn = overlay.querySelector('.decline-modal-cancel');
      var confirmBtn = overlay.querySelector('.decline-modal-confirm');

      cancelBtn.addEventListener('click', function () {
        document.body.removeChild(overlay);
      });

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

      document.body.appendChild(overlay);
      setTimeout(function () { textarea.focus(); }, 50);
    });
  }

  // --- Month name helper ---
  var MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  function formatCampaignRange(start, end) {
    if (!start || !end) return '—';
    var sp = start.split('-'), ep = end.split('-');
    var sm = MONTH_NAMES[parseInt(sp[1], 10) - 1] || '';
    var em = MONTH_NAMES[parseInt(ep[1], 10) - 1] || '';
    return sm + ' ' + sp[0] + ' — ' + em + ' ' + ep[0];
  }

  // --- Column Configs ---

  var todoColumns = [
    { key: 'assignedAdmin', label: 'Admin', sortable: true, type: 'person', editable: true },
    { key: 'client', label: 'Client', sortable: true, isName: true },
    { key: 'bookingForm', label: 'Booking Form', sortable: true, type: 'text' },
    { key: 'checklistUrl', label: 'Checklist', sortable: true, type: 'link' },
    { key: 'status', label: 'Status', sortable: true, type: 'status', editable: true, options: ['outline_proposal', 'proposal_ready', 'sent_to_client', 'client_approved', 'declined'] }
  ];

  var sideColumns = [
    { key: 'client', label: 'Client', sortable: true, isName: true },
    { key: 'bookingForm', label: 'Booking Form', sortable: true, type: 'text' },
    { key: 'status', label: 'Status', sortable: true, type: 'status', editable: true, options: ['outline_proposal', 'proposal_ready', 'sent_to_client', 'client_approved', 'declined'] }
  ];

  var bookingColumns = [
    { key: 'assignedAdmin', label: 'Admin', sortable: true, type: 'person', editable: true },
    { key: 'client', label: 'Client', sortable: true, isName: true },
    { key: 'esignUrl', label: 'E-Sign Form', sortable: false, type: 'link' },
    { key: 'checklistUrl', label: 'Checklist', sortable: false, type: 'link' },
    { key: 'status', label: 'Status', sortable: true, type: 'status', editable: true, options: ['sent_to_client', 'client_approved', 'declined'] }
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
      assignedAdmin: form.assignedAdmin || form.createdBy || null,
      client: form.clientName || form.title || 'Untitled',
      title: form.title || '—',
      bookingForm: formatCampaignRange(form.campaignMonthStart, form.campaignMonthEnd),
      representative: form.representative || '—',
      campaignStart: form.campaignMonthStart || null,
      campaignEnd: form.campaignMonthEnd || null,
      checklistUrl: form.checklistUrl || '',
      esignUrl: form.esignUrl || '',
      createdAt: form.createdAt || null,
      status: form.status || 'draft',
      declineReason: form.declineReason || ''
    };
  }

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
  // 1. PROPOSAL TAB
  // =============================================

  function renderProposalTab(container) {
    resetContainer(container);

    // New Booking button
    var topBar = document.createElement('div');
    topBar.style.display = 'flex';
    topBar.style.justifyContent = 'flex-end';
    topBar.style.marginBottom = '12px';

    var newBookingBtn = document.createElement('button');
    newBookingBtn.className = 'checklist-btn-primary';
    newBookingBtn.textContent = 'New Booking';
    newBookingBtn.style.padding = '8px 20px';
    newBookingBtn.style.borderRadius = '6px';
    newBookingBtn.style.border = 'none';
    newBookingBtn.style.cursor = 'pointer';
    newBookingBtn.style.fontWeight = '600';
    newBookingBtn.style.color = '#fff';
    newBookingBtn.style.background = 'var(--accent-gradient, linear-gradient(to top, #f5a623, #d4791a))';
    newBookingBtn.addEventListener('click', function () {
      if (window.openChecklistForClient) {
        window.openChecklistForClient();
      } else {
        alert('Checklist wizard not loaded');
      }
    });
    topBar.appendChild(newBookingBtn);
    container.appendChild(topBar);

    var layout = document.createElement('div');
    layout.className = 'dept-dashboard-layout proposal-dashboard-layout';

    var mainCol = document.createElement('div');
    mainCol.className = 'dept-dashboard-main';

    var sideCol = document.createElement('div');
    sideCol.className = 'dept-dashboard-side proposal-side-col';

    // --- To Do row actions: View | Delete | Skip to Booking Form | Send to Design ---
    var proposalRowActions = [
      {
        icon: ICON_VIEW,
        tooltip: 'View checklist JSON',
        className: 'action-view',
        onClick: function (rowData) {
          if (window.viewChecklistJson) {
            window.viewChecklistJson(rowData.id);
          }
        }
      },
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
  // 2. BOOKING FORM TAB
  // =============================================

  function renderBookingFormTab(container) {
    resetContainer(container);

    // Single-column layout: "Sent to Client" only
    var layout = document.createElement('div');
    layout.className = 'dept-dashboard-layout';

    var mainCol = document.createElement('div');
    mainCol.className = 'dept-dashboard-main';
    mainCol.style.width = '100%';

    // --- Row actions: Approve → Onboarding | Decline ---
    var bookingActions = [
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

    var mainSheet = buildProposalSheet('Sent to Client', bookingColumns, {
      onStatusChange: refreshAll,
      rowActions: bookingActions
    });

    mainCol.appendChild(mainSheet.el);
    layout.appendChild(mainCol);
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
        })
        .catch(function (err) {
          console.error('Booking form fetch error:', err);
        });
    }

    refreshAll();
  }

  window.renderBookingFormTab = renderBookingFormTab;

  // =============================================
  // 3. ONBOARDING TAB
  // =============================================

  function renderOnboardingTab(container) {
    resetContainer(container);

    var layout = document.createElement('div');
    layout.className = 'dept-dashboard-layout';

    var mainCol = document.createElement('div');
    mainCol.className = 'dept-dashboard-main';

    var sideCol = document.createElement('div');
    sideCol.className = 'dept-dashboard-side';

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
      },
      {
        icon: ICON_DELETE,
        tooltip: 'Delete',
        className: 'action-delete',
        onClick: function (rowData) {
          if (!confirm('Delete this onboarding entry?')) return;
          fetch(API_BASE + '/' + rowData.id, {
            method: 'DELETE',
            headers: getHeaders()
          }).then(function (res) {
            if (res.ok) refreshAll();
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
  // 5. DECLINED PROPOSAL TAB
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
  // 6. DESIGN PROPOSALS TAB
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
  // 7. DESIGN WEB DESIGN TAB
  // =============================================

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

    var monthCtrl;
    var mainSheet = buildProposalSheet('Web Design Projects', webDesignColumns, {
      onStatusChange: function () { refreshAll(monthCtrl ? monthCtrl.getCurrentMonth() : null); },
      rowActions: makeRowActions(function () { refreshAll(monthCtrl ? monthCtrl.getCurrentMonth() : null); })
    });

    mainCol.appendChild(mainSheet.el);
    layout.appendChild(mainCol);

    // Wrap in dept-tab-wrap so month selector stacks above the sheet
    var wrap = document.createElement('div');
    wrap.className = 'dept-tab-wrap';
    var monthEl = document.createElement('div');
    monthEl.className = 'dept-month-selector';
    monthEl.innerHTML = '<button class="dept-month-nav dept-month-prev" id="designMonthPrev" title="Previous month">&#9664;</button>' +
      '<span class="dept-month-label" id="designMonthLabel">Loading...</span>' +
      '<button class="dept-month-nav dept-month-next" id="designMonthNext" title="Next month">&#9654;</button>';
    wrap.appendChild(monthEl);
    wrap.appendChild(layout);
    container.appendChild(wrap);

    function refreshAll(month) {
      var url = '/api/deliverables/by-department/design';
      if (month) url += '?month=' + month;
      fetch(url, { headers: getHeaders() })
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

    monthCtrl = window.initMonthSelector(container, {prev: 'designMonthPrev', next: 'designMonthNext', label: 'designMonthLabel'}, 'design', function(month) { refreshAll(month); });
  }

  window.renderDesignWebDesignTab = renderDesignWebDesignTab;
})();
