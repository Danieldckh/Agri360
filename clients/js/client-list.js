var CLIENT_API_URL = 'http://localhost:3001/api';

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
  var showForm = false;

  function authHeaders(json) {
    var h = window.getAuthHeaders ? window.getAuthHeaders() : {};
    if (json) {
      h['Content-Type'] = 'application/json';
    }
    return h;
  }

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

    var count = document.createElement('span');
    count.className = 'client-count';
    count.textContent = allClients.length;
    titleWrap.appendChild(count);

    header.appendChild(titleWrap);

    var headerActions = document.createElement('div');
    headerActions.className = 'client-header-actions';

    // Search input
    var searchInput = document.createElement('input');
    searchInput.type = 'text';
    searchInput.className = 'client-search';
    searchInput.placeholder = 'Search clients...';
    searchInput.value = searchTerm;
    searchInput.addEventListener('input', function() {
      searchTerm = searchInput.value;
      renderTable(tableBody, getFilteredClients());
    });
    headerActions.appendChild(searchInput);

    header.appendChild(headerActions);
    section.appendChild(header);

    // Table
    var filtered = getFilteredClients();

    if (allClients.length === 0) {
      var empty = document.createElement('div');
      empty.className = 'client-empty';
      empty.textContent = 'No clients yet. Add your first client to get started.';
      section.appendChild(empty);
    } else if (filtered.length === 0) {
      var empty = document.createElement('div');
      empty.className = 'client-empty';
      empty.textContent = 'No clients match your search.';
      section.appendChild(empty);
    } else {
      var tableWrap = document.createElement('div');
      tableWrap.className = 'client-table-wrap';

      var table = document.createElement('table');
      table.className = 'client-table';

      var thead = document.createElement('thead');
      var headerRow = document.createElement('tr');
      var columns = ['Name', 'Contact Person', 'Email', 'Phone', 'Status'];
      columns.forEach(function(col) {
        var th = document.createElement('th');
        th.textContent = col;
        headerRow.appendChild(th);
      });
      thead.appendChild(headerRow);
      table.appendChild(thead);

      var tableBody = document.createElement('tbody');
      renderTable(tableBody, filtered);
      table.appendChild(tableBody);

      tableWrap.appendChild(table);
      section.appendChild(tableWrap);
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

  function renderTable(tbody, clients) {
    while (tbody.firstChild) {
      tbody.removeChild(tbody.firstChild);
    }
    clients.forEach(function(client, index) {
      var tr = document.createElement('tr');
      tr.style.animationDelay = (index * 0.03) + 's';

      var tdName = document.createElement('td');
      tdName.className = 'client-cell-name';
      tdName.textContent = client.name || '';
      tr.appendChild(tdName);

      var tdContact = document.createElement('td');
      tdContact.textContent = client.contact_person || '-';
      tr.appendChild(tdContact);

      var tdEmail = document.createElement('td');
      tdEmail.textContent = client.email || '-';
      tr.appendChild(tdEmail);

      var tdPhone = document.createElement('td');
      tdPhone.textContent = client.phone || '-';
      tr.appendChild(tdPhone);

      var tdStatus = document.createElement('td');
      var statusBadge = document.createElement('span');
      var status = client.status || 'active';
      statusBadge.className = 'client-status client-status-' + status;
      statusBadge.textContent = status.charAt(0).toUpperCase() + status.slice(1);
      tdStatus.appendChild(statusBadge);
      tr.appendChild(tdStatus);

      tbody.appendChild(tr);
    });
  }

  function createAddForm() {
    var form = document.createElement('div');
    form.className = 'client-form';

    var formTitle = document.createElement('h3');
    formTitle.className = 'client-form-title';
    formTitle.textContent = 'New Client';
    form.appendChild(formTitle);

    var fields = [
      { key: 'name', label: 'Client Name', required: true },
      { key: 'contact_person', label: 'Contact Person', required: false },
      { key: 'email', label: 'Email', required: false, type: 'email' },
      { key: 'phone', label: 'Phone', required: false, type: 'tel' }
    ];

    var inputs = {};

    var grid = document.createElement('div');
    grid.className = 'client-form-grid';

    fields.forEach(function(field) {
      var group = document.createElement('div');
      group.className = 'client-form-group';

      var label = document.createElement('label');
      label.textContent = field.label;
      if (field.required) {
        var req = document.createElement('span');
        req.className = 'client-form-required';
        req.textContent = ' *';
        label.appendChild(req);
      }
      group.appendChild(label);

      var input = document.createElement('input');
      input.type = field.type || 'text';
      input.className = 'client-form-input';
      input.placeholder = field.label;
      inputs[field.key] = input;
      group.appendChild(input);

      grid.appendChild(group);
    });

    form.appendChild(grid);

    var formActions = document.createElement('div');
    formActions.className = 'client-form-actions';

    var saveBtn = document.createElement('button');
    saveBtn.className = 'client-btn-save';
    saveBtn.textContent = 'Save Client';
    saveBtn.addEventListener('click', function() {
      var name = inputs.name.value.trim();
      if (!name) {
        inputs.name.style.borderColor = '#e74c3c';
        inputs.name.focus();
        return;
      }

      var body = {
        name: name,
        contact_person: inputs.contact_person.value.trim() || null,
        email: inputs.email.value.trim() || null,
        phone: inputs.phone.value.trim() || null
      };

      saveBtn.disabled = true;
      saveBtn.textContent = 'Saving...';

      fetch(CLIENT_API_URL + '/clients', {
        method: 'POST',
        headers: authHeaders(true),
        body: JSON.stringify(body)
      })
        .then(function(res) { return res.json(); })
        .then(function(data) {
          if (data.error) {
            saveBtn.disabled = false;
            saveBtn.textContent = 'Save Client';
            alert(data.error);
            return;
          }
          showForm = false;
          loadClients();
        })
        .catch(function() {
          saveBtn.disabled = false;
          saveBtn.textContent = 'Save Client';
        });
    });
    formActions.appendChild(saveBtn);

    var cancelBtn = document.createElement('button');
    cancelBtn.className = 'client-btn-cancel';
    cancelBtn.textContent = 'Cancel';
    cancelBtn.addEventListener('click', function() {
      showForm = false;
      renderContent();
    });
    formActions.appendChild(cancelBtn);

    form.appendChild(formActions);
    return form;
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
