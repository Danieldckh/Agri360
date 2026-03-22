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

  var headerRow = document.createElement('div');
  headerRow.className = 'dept-header-row';

  var title = document.createElement('h2');
  title.textContent = dept.name || 'Department';
  headerRow.appendChild(title);

  var newBookingBtn = document.createElement('button');
  newBookingBtn.className = 'checklist-new-btn';
  newBookingBtn.textContent = '+ New Booking';
  newBookingBtn.addEventListener('click', function() {
    if (window.openChecklistWizard) window.openChecklistWizard();
  });
  headerRow.appendChild(newBookingBtn);

  header.appendChild(headerRow);

  if (dept.description) {
    var desc = document.createElement('p');
    desc.className = 'dept-description';
    desc.textContent = dept.description;
    header.appendChild(desc);
  }

  section.appendChild(header);

  // Split layout
  var split = document.createElement('div');
  split.className = 'dept-split';

  // Left panel - main sheet
  var leftPanel = document.createElement('div');
  leftPanel.className = 'dept-split-left';

  if (window.renderSheet) {
    window.renderSheet(leftPanel, {
      columns: [
        { key: 'title', label: 'Title', sortable: true, isName: true },
        { key: 'client_name', label: 'Client', sortable: true },
        { key: 'status', label: 'Status', sortable: true, type: 'status' },
        { key: 'due_date', label: 'Due Date', sortable: true, type: 'date' }
      ],
      data: deliverables,
      radialActions: [
        { id: 'dashboard', label: 'View Dashboard', action: function(row) { console.log('View dashboard:', row); } },
        { id: 'status', label: 'Change Status', action: function(row) { console.log('Change status:', row); } },
        { id: 'next', label: 'Next Step', action: function(row) { console.log('Next step:', row); }, highlight: true }
      ]
    });
  }

  split.appendChild(leftPanel);

  // Right panel - details placeholder
  var rightPanel = document.createElement('div');
  rightPanel.className = 'dept-split-right';

  var detailsTitle = document.createElement('div');
  detailsTitle.className = 'dept-details-title';
  detailsTitle.textContent = 'Details';
  rightPanel.appendChild(detailsTitle);

  var detailsEmpty = document.createElement('div');
  detailsEmpty.className = 'dept-details-empty';
  detailsEmpty.textContent = 'Select an item to view details';
  rightPanel.appendChild(detailsEmpty);

  split.appendChild(rightPanel);
  section.appendChild(split);
}
