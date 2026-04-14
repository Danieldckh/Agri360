(function () {
  'use strict';

  var API = (window.API_URL || '/api') + '/dev-tickets';
  var STATUSES = ['open', 'in_progress', 'in_review', 'completed', 'cancelled'];
  var PRIORITIES = ['low', 'medium', 'high', 'urgent'];
  var activeFilter = 'active'; // 'active' | 'completed' | 'all'
  var allTickets = [];
  var pageContainer = null;

  function headers() {
    var h = { 'Content-Type': 'application/json' };
    if (window.getAuthHeaders) {
      var auth = window.getAuthHeaders();
      for (var k in auth) { if (auth.hasOwnProperty(k)) h[k] = auth[k]; }
    }
    return h;
  }

  function fetchTickets() {
    return fetch(API, { headers: headers() })
      .then(function (r) { return r.json(); })
      .then(function (data) { allTickets = data; return data; });
  }

  function saveField(id, key, value) {
    var body = {};
    body[key] = value;
    return fetch(API + '/' + id, {
      method: 'PATCH',
      headers: headers(),
      body: JSON.stringify(body)
    }).then(function (r) { return r.json(); });
  }

  function deleteTicket(id) {
    return fetch(API + '/' + id, { method: 'DELETE', headers: headers() })
      .then(function (r) { return r.json(); });
  }

  function createTicket(data) {
    return fetch(API, {
      method: 'POST',
      headers: headers(),
      body: JSON.stringify(data)
    }).then(function (r) { return r.json(); });
  }

  function filteredTickets() {
    if (activeFilter === 'completed') return allTickets.filter(function (t) { return t.status === 'completed' || t.status === 'cancelled'; });
    if (activeFilter === 'all') return allTickets;
    return allTickets.filter(function (t) { return t.status !== 'completed' && t.status !== 'cancelled'; });
  }

  function render() {
    if (!pageContainer) return;
    pageContainer.innerHTML = '';

    var page = document.createElement('div');
    page.className = 'dev-tickets-page';

    // Header
    var hdr = document.createElement('div');
    hdr.className = 'dev-tickets-header';
    var h2 = document.createElement('h2');
    h2.textContent = 'Dev Tickets';
    hdr.appendChild(h2);
    var addBtn = document.createElement('button');
    addBtn.className = 'dev-tickets-add-btn';
    addBtn.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z"/></svg> New Ticket';
    addBtn.onclick = showCreateModal;
    hdr.appendChild(addBtn);
    page.appendChild(hdr);

    // Tabs
    var tabs = document.createElement('div');
    tabs.className = 'dev-tickets-tabs';
    ['active', 'completed', 'all'].forEach(function (f) {
      var btn = document.createElement('button');
      btn.textContent = f.charAt(0).toUpperCase() + f.slice(1);
      if (f === activeFilter) btn.className = 'active';
      btn.onclick = function () { activeFilter = f; render(); };
      tabs.appendChild(btn);
    });
    page.appendChild(tabs);

    // Sheet container
    var sheetEl = document.createElement('div');
    page.appendChild(sheetEl);

    var columns = [
      { key: 'title', label: 'Title', sortable: true, isName: true, editable: true, wrap: true },
      { key: 'description', label: 'Description', editable: true, wrap: true },
      { key: 'status', label: 'Status', sortable: true, type: 'status', editable: true, options: STATUSES },
      { key: 'priority', label: 'Priority', sortable: true, type: 'status', editable: true, options: PRIORITIES },
      { key: 'dueDate', label: 'Due Date', type: 'date', sortable: true, editable: true },
      { key: 'createdAt', label: 'Created', type: 'date', sortable: true }
    ];

    var data = filteredTickets();

    var rowActions = [
      {
        icon: 'M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z',
        tooltip: 'Delete ticket',
        onClick: function (row) {
          if (confirm('Delete ticket "' + row.title + '"?')) {
            deleteTicket(row.id).then(refresh);
          }
        }
      }
    ];

    window.renderSheet(sheetEl, {
      columns: columns,
      data: data,
      searchable: true,
      rowActions: rowActions,
      onCellSaved: function (row, key) {
        saveField(row.id, key, row[key]);
      }
    });

    pageContainer.appendChild(page);
  }

  function refresh() {
    fetchTickets().then(render);
  }

  function showCreateModal() {
    var overlay = document.createElement('div');
    overlay.className = 'dev-ticket-modal-overlay';
    overlay.onclick = function (e) { if (e.target === overlay) overlay.remove(); };

    var modal = document.createElement('div');
    modal.className = 'dev-ticket-modal';
    modal.innerHTML = '<h3>New Ticket</h3>'
      + '<label>Title<input type="text" id="dt-title" placeholder="Brief summary of the change request"></label>'
      + '<label>Description<textarea id="dt-desc" placeholder="Detailed description of what needs to change..."></textarea></label>'
      + '<label>Priority<select id="dt-priority"><option value="low">Low</option><option value="medium" selected>Medium</option><option value="high">High</option><option value="urgent">Urgent</option></select></label>'
      + '<label>Due Date<input type="date" id="dt-due-date"></label>'
      + '<div class="dev-ticket-modal-actions">'
      + '<button class="cancel-btn" id="dt-cancel">Cancel</button>'
      + '<button class="submit-btn" id="dt-submit">Create Ticket</button>'
      + '</div>';

    overlay.appendChild(modal);
    document.body.appendChild(overlay);

    modal.querySelector('#dt-cancel').onclick = function () { overlay.remove(); };
    modal.querySelector('#dt-submit').onclick = function () {
      var title = modal.querySelector('#dt-title').value.trim();
      if (!title) { modal.querySelector('#dt-title').focus(); return; }
      var desc = modal.querySelector('#dt-desc').value.trim();
      var priority = modal.querySelector('#dt-priority').value;
      var dueDate = modal.querySelector('#dt-due-date').value || null;
      createTicket({ title: title, description: desc, priority: priority, dueDate: dueDate }).then(function () {
        overlay.remove();
        refresh();
      });
    };

    setTimeout(function () { modal.querySelector('#dt-title').focus(); }, 50);
  }

  window.renderDevTicketsPage = function (container) {
    pageContainer = container;
    render(); // show empty state immediately
    refresh(); // then fetch data
  };
})();
