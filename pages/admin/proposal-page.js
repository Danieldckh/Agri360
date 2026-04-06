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

    _savedSidebarHTML = nav.cloneNode(true);
    while (nav.firstChild) nav.removeChild(nav.firstChild);
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

        // Full Checklist JSON
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

  // --- Expose tab renderers (same signature as before) ---
  window.renderProposalTab = function (container) { renderProposalTabWithSubSheets(container); };
  window.renderBookingFormTab = function (container) { renderAdminTab(container, 'Booking Form'); };
  window.renderOnboardingTab = function (container) { renderAdminTab(container, 'Onboarding'); };
  window.renderDeclinedTab = function (container) { renderAdminTab(container, 'Declined Proposal'); };

  // Design tabs — keep as stubs if still needed
  window.renderDesignProposalsTab = function (container) { renderAdminTab(container, 'Proposal'); };
  window.renderDesignWebDesignTab = function (container) {};
})();
