var CLIENT_API_URL = window.API_URL || 'http://localhost:3001/api';

window.renderClientListPage = function(container) {
  while (container.firstChild) {
    container.removeChild(container.firstChild);
  }

  container.style.display = 'block';
  container.style.alignItems = '';
  container.style.justifyContent = '';

  var section = document.createElement('div');
  section.className = 'client-section';

  var allClients = [];
  var searchTerm = '';

  function authHeaders(json) {
    var h = window.getAuthHeaders ? window.getAuthHeaders() : {};
    if (json) {
      h['Content-Type'] = 'application/json';
    }
    return h;
  }

  var sheetContainer = null;
  var countBadge = null;

  function renderContent() {
    while (section.firstChild) {
      section.removeChild(section.firstChild);
    }

    // Header
    var header = document.createElement('div');
    header.className = 'client-header';

    var titleWrap = document.createElement('div');
    titleWrap.style.display = 'flex';
    titleWrap.style.alignItems = 'center';

    var title = document.createElement('h2');
    title.textContent = 'Clients';
    titleWrap.appendChild(title);

    countBadge = document.createElement('span');
    countBadge.className = 'client-count';
    countBadge.textContent = allClients.length;
    titleWrap.appendChild(countBadge);

    header.appendChild(titleWrap);

    var headerActions = document.createElement('div');
    headerActions.className = 'client-header-actions';

    var searchInput = document.createElement('input');
    searchInput.type = 'text';
    searchInput.className = 'client-search';
    searchInput.placeholder = 'Search clients...';
    searchInput.value = searchTerm;
    searchInput.addEventListener('input', function() {
      searchTerm = searchInput.value;
      renderSheetOnly();
    });
    headerActions.appendChild(searchInput);

    header.appendChild(headerActions);
    section.appendChild(header);

    // Sheet container (persists across search updates)
    sheetContainer = document.createElement('div');
    sheetContainer.className = 'client-sheet-container';
    section.appendChild(sheetContainer);

    renderSheetOnly();
  }

  function renderSheetOnly() {
    var filtered = getFilteredClients();

    if (window.renderSheet && sheetContainer) {
      window.renderSheet(sheetContainer, {
        columns: [
          { key: 'name', label: 'Name', sortable: true, isName: true },
          { key: 'contact_person', label: 'Contact Person', sortable: true },
          { key: 'email', label: 'Email', sortable: true },
          { key: 'phone', label: 'Phone', sortable: true },
          { key: 'status', label: 'Status', sortable: true, type: 'status' }
        ],
        data: filtered,
        radialActions: [
          { id: 'dashboard', label: 'View Dashboard', action: function(row) { console.log('View client:', row); } },
          { id: 'status', label: 'Change Status', action: function(row) { console.log('Change status:', row); } }
        ]
      });
    }
  }

  function getFilteredClients() {
    if (!searchTerm) return allClients;
    var term = searchTerm.toLowerCase();
    return allClients.filter(function(c) {
      return (c.name && c.name.toLowerCase().indexOf(term) !== -1) ||
        (c.contact_person && c.contact_person.toLowerCase().indexOf(term) !== -1) ||
        (c.email && c.email.toLowerCase().indexOf(term) !== -1) ||
        (c.phone && c.phone.toLowerCase().indexOf(term) !== -1) ||
        (c.status && c.status.toLowerCase().indexOf(term) !== -1);
    });
  }

  function loadClients() {
    var loading = document.createElement('div');
    loading.className = 'client-empty';
    loading.textContent = 'Loading clients...';
    while (section.firstChild) {
      section.removeChild(section.firstChild);
    }
    section.appendChild(loading);

    fetch(CLIENT_API_URL + '/clients', {
      headers: authHeaders(false)
    })
      .then(function(res) { return res.json(); })
      .then(function(data) {
        if (data.error) {
          section.removeChild(loading);
          var err = document.createElement('div');
          err.className = 'client-empty';
          err.textContent = data.error;
          section.appendChild(err);
          return;
        }
        allClients = Array.isArray(data) ? data : [];
        renderContent();
      })
      .catch(function() {
        section.removeChild(loading);
        var err = document.createElement('div');
        err.className = 'client-empty';
        err.textContent = 'Failed to load clients.';
        section.appendChild(err);
      });
  }

  container.appendChild(section);
  loadClients();
};
