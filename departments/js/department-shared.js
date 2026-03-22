var DEPT_API_URL = 'http://localhost:3001/api';

window.renderDepartmentPage = function(container, slug) {
  while (container.firstChild) {
    container.removeChild(container.firstChild);
  }

  container.style.display = 'block';
  container.style.alignItems = '';
  container.style.justifyContent = '';

  var section = document.createElement('div');
  section.className = 'dept-section';

  function authHeaders() {
    return window.getAuthHeaders ? window.getAuthHeaders() : {};
  }

  // Loading state
  var loading = document.createElement('div');
  loading.className = 'dept-loading';
  loading.textContent = 'Loading department...';
  section.appendChild(loading);
  container.appendChild(section);

  // Fetch department info and deliverables in parallel
  var deptPromise = fetch(DEPT_API_URL + '/departments/' + slug, {
    headers: authHeaders()
  }).then(function(res) { return res.json(); });

  var deliverablesPromise = fetch(DEPT_API_URL + '/deliverables/by-department/' + slug, {
    headers: authHeaders()
  }).then(function(res) { return res.json(); });

  Promise.all([deptPromise, deliverablesPromise])
    .then(function(results) {
      var dept = results[0];
      var deliverables = results[1];

      section.removeChild(loading);

      if (dept.error) {
        var err = document.createElement('div');
        err.className = 'dept-loading';
        err.textContent = dept.error;
        section.appendChild(err);
        return;
      }

      var deliverableList = Array.isArray(deliverables) ? deliverables : [];

      renderDepartmentContent(section, dept, deliverableList);
    })
    .catch(function() {
      section.removeChild(loading);
      var err = document.createElement('div');
      err.className = 'dept-loading';
      err.textContent = 'Failed to load department data.';
      section.appendChild(err);
    });
};

function renderDepartmentContent(section, dept, deliverables) {
  // Header
  var header = document.createElement('div');
  header.className = 'dept-header';

  var title = document.createElement('h2');
  title.textContent = dept.name || 'Department';
  header.appendChild(title);

  if (dept.description) {
    var desc = document.createElement('p');
    desc.className = 'dept-description';
    desc.textContent = dept.description;
    header.appendChild(desc);
  }

  section.appendChild(header);

  // Summary stats
  var stats = computeStats(deliverables);
  var statsContainer = document.createElement('div');
  statsContainer.className = 'dept-stats';

  var statItems = [
    { label: 'Total', value: stats.total, cls: '' },
    { label: 'Pending', value: stats.pending, cls: 'dept-stat-pending' },
    { label: 'In Progress', value: stats.in_progress, cls: 'dept-stat-progress' },
    { label: 'Completed', value: stats.completed, cls: 'dept-stat-completed' }
  ];

  statItems.forEach(function(item) {
    var card = document.createElement('div');
    card.className = 'dept-stat-card' + (item.cls ? ' ' + item.cls : '');

    var val = document.createElement('div');
    val.className = 'dept-stat-value';
    val.textContent = item.value;
    card.appendChild(val);

    var label = document.createElement('div');
    label.className = 'dept-stat-label';
    label.textContent = item.label;
    card.appendChild(label);

    statsContainer.appendChild(card);
  });

  section.appendChild(statsContainer);

  // Deliverables list
  if (deliverables.length === 0) {
    var empty = document.createElement('div');
    empty.className = 'dept-empty';
    empty.textContent = 'No deliverables yet.';
    section.appendChild(empty);
    return;
  }

  var tableWrap = document.createElement('div');
  tableWrap.className = 'dept-table-wrap';

  var table = document.createElement('table');
  table.className = 'dept-table';

  var thead = document.createElement('thead');
  var headerRow = document.createElement('tr');
  var columns = ['Title', 'Client', 'Status', 'Due Date'];
  columns.forEach(function(col) {
    var th = document.createElement('th');
    th.textContent = col;
    headerRow.appendChild(th);
  });
  thead.appendChild(headerRow);
  table.appendChild(thead);

  var tbody = document.createElement('tbody');
  deliverables.forEach(function(d, index) {
    var tr = document.createElement('tr');
    tr.style.animationDelay = (index * 0.03) + 's';

    var tdTitle = document.createElement('td');
    tdTitle.className = 'dept-cell-title';
    tdTitle.textContent = d.title || '';
    tr.appendChild(tdTitle);

    var tdClient = document.createElement('td');
    tdClient.textContent = d.client_name || '-';
    tr.appendChild(tdClient);

    var tdStatus = document.createElement('td');
    var statusBadge = document.createElement('span');
    var status = (d.status || 'pending').replace(/\s+/g, '_');
    statusBadge.className = 'dept-status dept-status-' + status;
    statusBadge.textContent = formatStatus(d.status);
    tdStatus.appendChild(statusBadge);
    tr.appendChild(tdStatus);

    var tdDue = document.createElement('td');
    tdDue.textContent = d.due_date ? new Date(d.due_date).toLocaleDateString() : '-';
    tr.appendChild(tdDue);

    tbody.appendChild(tr);
  });

  table.appendChild(tbody);
  tableWrap.appendChild(table);
  section.appendChild(tableWrap);
}

function computeStats(deliverables) {
  var stats = { total: deliverables.length, pending: 0, in_progress: 0, completed: 0 };
  deliverables.forEach(function(d) {
    var s = (d.status || '').toLowerCase().replace(/\s+/g, '_');
    if (s === 'pending') stats.pending++;
    else if (s === 'in_progress' || s === 'in progress') stats.in_progress++;
    else if (s === 'completed' || s === 'done') stats.completed++;
  });
  return stats;
}

function formatStatus(status) {
  if (!status) return 'Pending';
  return status.split(/[_\s]+/).map(function(w) {
    return w.charAt(0).toUpperCase() + w.slice(1).toLowerCase();
  }).join(' ');
}
