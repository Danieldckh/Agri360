(function () {
  'use strict';

  var COLUMNS = [
    { key: 'name', label: 'Name', sortable: true, isName: true },
    { key: 'contact_person', label: 'Contact Person', sortable: true },
    { key: 'email', label: 'Email', sortable: true },
    { key: 'phone', label: 'Phone', sortable: true },
    { key: 'status', label: 'Status', sortable: true, type: 'status' }
  ];

  var ACTIONS = [
    { id: 'dashboard', label: 'View Dashboard', action: function (row) { console.log('View client:', row); } },
    { id: 'status', label: 'Change Status', action: function (row) { console.log('Change status:', row); } }
  ];

  function initClientListPage(container) {
    var sheetEl = container.querySelector('#client-sheet');
    var countEl = container.querySelector('#client-count');
    var searchEl = container.querySelector('#client-search');
    var allClients = [];

    function renderSheet() {
      var term = searchEl.value.toLowerCase();
      var filtered = allClients;
      if (term) {
        filtered = allClients.filter(function (c) {
          return (c.name && c.name.toLowerCase().indexOf(term) !== -1) ||
            (c.contact_person && c.contact_person.toLowerCase().indexOf(term) !== -1) ||
            (c.email && c.email.toLowerCase().indexOf(term) !== -1) ||
            (c.phone && c.phone.toLowerCase().indexOf(term) !== -1);
        });
      }
      countEl.textContent = filtered.length;
      if (window.renderSheet) {
        window.renderSheet(sheetEl, { columns: COLUMNS, data: filtered, radialActions: ACTIONS });
      }
    }

    var debounceTimer;
    searchEl.addEventListener('input', function () {
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(renderSheet, 200);
    });

    var headers = window.getAuthHeaders ? window.getAuthHeaders() : {};
    fetch('/api/clients', { headers: headers })
      .then(function (r) { return r.json(); })
      .then(function (data) {
        allClients = Array.isArray(data) ? data : [];
        renderSheet();
      })
      .catch(function () {
        sheetEl.innerHTML = '<div class="client-empty">Failed to load clients.</div>';
      });
  }

  window.initClientListPage = initClientListPage;
})();
