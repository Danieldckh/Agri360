var EMPLOYEES_API_URL = window.API_URL || 'http://localhost:3001/api';
var EMPLOYEES_BASE_URL = EMPLOYEES_API_URL.replace('/api', '');
var DEFAULT_PHOTO_SVG = 'data:image/svg+xml;base64,' + btoa('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="rgba(128,128,128,0.4)"><path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/></svg>');

function createEmployeeCard(emp, currentUser, onRefresh) {
  var card = document.createElement('div');
  card.className = 'employee-card';

  var isOwnCard = currentUser && currentUser.id === emp.id;
  var isAdmin = currentUser && currentUser.role === 'admin';

  // Photo
  var photoSrc = emp.photo_url
    ? EMPLOYEES_BASE_URL + emp.photo_url
    : DEFAULT_PHOTO_SVG;

  if (isOwnCard) {
    var photoWrapper = document.createElement('div');
    photoWrapper.className = 'photo-wrapper';

    var img = document.createElement('img');
    img.className = 'employee-photo';
    img.src = photoSrc;
    img.alt = emp.first_name + ' ' + emp.last_name;

    var overlay = document.createElement('div');
    overlay.className = 'photo-overlay';

    var cameraSvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    cameraSvg.setAttribute('width', '24');
    cameraSvg.setAttribute('height', '24');
    cameraSvg.setAttribute('viewBox', '0 0 24 24');
    cameraSvg.setAttribute('fill', '#fff');
    var cameraPath = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    cameraPath.setAttribute('d', 'M12 15.2a3.2 3.2 0 1 0 0-6.4 3.2 3.2 0 0 0 0 6.4zM9 2L7.17 4H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2h-3.17L15 2H9z');
    cameraSvg.appendChild(cameraPath);
    overlay.appendChild(cameraSvg);

    var fileInput = document.createElement('input');
    fileInput.type = 'file';
    fileInput.accept = 'image/*';
    fileInput.style.display = 'none';

    fileInput.addEventListener('change', function () {
      if (!fileInput.files || !fileInput.files[0]) return;
      var formData = new FormData();
      formData.append('photo', fileInput.files[0]);

      fetch(EMPLOYEES_API_URL + '/employees/' + emp.id + '/photo', {
        method: 'POST',
        headers: getAuthHeaders(),
        body: formData
      })
        .then(function (res) { return res.json(); })
        .then(function (data) {
          if (data.photo_url) {
            img.src = EMPLOYEES_BASE_URL + data.photo_url;
          }
          if (onRefresh) onRefresh();
        })
        .catch(function () { /* silently fail */ });
    });

    photoWrapper.addEventListener('click', function () {
      fileInput.click();
    });

    photoWrapper.appendChild(img);
    photoWrapper.appendChild(overlay);
    photoWrapper.appendChild(fileInput);
    card.appendChild(photoWrapper);
  } else {
    var img = document.createElement('img');
    img.className = 'employee-photo';
    img.src = photoSrc;
    img.alt = emp.first_name + ' ' + emp.last_name;
    card.appendChild(img);
  }

  // Name
  var name = document.createElement('h3');
  name.className = 'employee-name';
  name.textContent = emp.first_name + ' ' + emp.last_name;
  card.appendChild(name);

  // Role badge
  var roleBadge = document.createElement('span');
  roleBadge.className = 'employee-role ' + (emp.role === 'admin' ? 'role-admin' : 'role-employee');
  roleBadge.textContent = emp.role === 'admin' ? 'Admin' : 'Employee';
  card.appendChild(roleBadge);

  // Status badge
  var statusBadge = document.createElement('span');
  var statusClass = 'status-' + emp.status;
  statusBadge.className = 'employee-status ' + statusClass;
  statusBadge.textContent = emp.status.charAt(0).toUpperCase() + emp.status.slice(1);
  card.appendChild(statusBadge);

  // Admin actions
  if (isAdmin && !isOwnCard) {
    var actions = document.createElement('div');
    actions.className = 'admin-actions';

    if (emp.status === 'pending') {
      var approveBtn = document.createElement('button');
      approveBtn.className = 'btn-approve';
      approveBtn.textContent = 'Approve';
      approveBtn.addEventListener('click', function () {
        fetch(EMPLOYEES_API_URL + '/employees/' + emp.id + '/status', {
          method: 'PATCH',
          headers: Object.assign({ 'Content-Type': 'application/json' }, getAuthHeaders()),
          body: JSON.stringify({ status: 'approved' })
        }).then(function () { if (onRefresh) onRefresh(); });
      });
      actions.appendChild(approveBtn);

      var declineBtn = document.createElement('button');
      declineBtn.className = 'btn-decline';
      declineBtn.textContent = 'Decline';
      declineBtn.addEventListener('click', function () {
        fetch(EMPLOYEES_API_URL + '/employees/' + emp.id + '/status', {
          method: 'PATCH',
          headers: Object.assign({ 'Content-Type': 'application/json' }, getAuthHeaders()),
          body: JSON.stringify({ status: 'declined' })
        }).then(function () { if (onRefresh) onRefresh(); });
      });
      actions.appendChild(declineBtn);
    }

    var roleBtn = document.createElement('button');
    roleBtn.className = 'btn-role';
    roleBtn.textContent = emp.role === 'admin' ? 'Remove Admin' : 'Make Admin';
    roleBtn.addEventListener('click', function () {
      var newRole = emp.role === 'admin' ? 'employee' : 'admin';
      fetch(EMPLOYEES_API_URL + '/employees/' + emp.id + '/role', {
        method: 'PATCH',
        headers: Object.assign({ 'Content-Type': 'application/json' }, getAuthHeaders()),
        body: JSON.stringify({ role: newRole })
      }).then(function () { if (onRefresh) onRefresh(); });
    });
    actions.appendChild(roleBtn);

    card.appendChild(actions);
  }

  return card;
}

async function renderEmployeeSection(container) {
  while (container.firstChild) {
    container.removeChild(container.firstChild);
  }

  // Override flex centering for this section
  container.style.display = 'block';
  container.style.alignItems = '';
  container.style.justifyContent = '';

  var section = document.createElement('div');
  section.className = 'employee-section';

  var currentUser = getCurrentUser();

  // Loading state
  var loading = document.createElement('div');
  loading.className = 'employee-loading';
  loading.textContent = 'Loading employees...';
  section.appendChild(loading);
  container.appendChild(section);

  try {
    var res = await fetch(EMPLOYEES_API_URL + '/employees', {
      headers: getAuthHeaders()
    });
    var employees = await res.json();

    section.removeChild(loading);

    if (employees.error) {
      var errorMsg = document.createElement('div');
      errorMsg.className = 'employee-loading';
      errorMsg.textContent = employees.error;
      section.appendChild(errorMsg);
      return;
    }

    var allEmployees = Array.isArray(employees) ? employees : [];
    var pendingCount = allEmployees.filter(function (e) { return e.status === 'pending'; }).length;
    var filterMode = 'all';

    function renderContent() {
      // Clear section
      while (section.firstChild) {
        section.removeChild(section.firstChild);
      }

      // Header
      var header = document.createElement('div');
      header.className = 'employee-header';

      var titleWrap = document.createElement('div');
      titleWrap.style.display = 'flex';
      titleWrap.style.alignItems = 'center';

      var title = document.createElement('h2');
      title.textContent = 'Employees';
      titleWrap.appendChild(title);

      var count = document.createElement('span');
      count.className = 'employee-count';
      count.textContent = allEmployees.length;
      titleWrap.appendChild(count);

      header.appendChild(titleWrap);

      // Filter tabs (admin only)
      if (currentUser && currentUser.role === 'admin') {
        var filters = document.createElement('div');
        filters.className = 'employee-filters';

        var allBtn = document.createElement('button');
        allBtn.className = 'filter-btn' + (filterMode === 'all' ? ' active' : '');
        allBtn.textContent = 'All';
        allBtn.addEventListener('click', function () {
          filterMode = 'all';
          renderContent();
        });
        filters.appendChild(allBtn);

        var pendingBtn = document.createElement('button');
        pendingBtn.className = 'filter-btn' + (filterMode === 'pending' ? ' active' : '');
        pendingBtn.textContent = 'Pending (' + pendingCount + ')';
        pendingBtn.addEventListener('click', function () {
          filterMode = 'pending';
          renderContent();
        });
        filters.appendChild(pendingBtn);

        header.appendChild(filters);
      }

      section.appendChild(header);

      // Filter employees
      var filtered = filterMode === 'pending'
        ? allEmployees.filter(function (e) { return e.status === 'pending'; })
        : allEmployees;

      // Grid
      var grid = document.createElement('div');
      grid.className = 'employee-grid';

      filtered.forEach(function (emp, index) {
        var card = createEmployeeCard(emp, currentUser, function () {
          renderEmployeeSection(container);
        });
        card.style.animationDelay = (index * 0.05) + 's';
        grid.appendChild(card);
      });

      if (filtered.length === 0) {
        var empty = document.createElement('div');
        empty.className = 'employee-loading';
        empty.textContent = filterMode === 'pending' ? 'No pending employees.' : 'No employees found.';
        section.appendChild(empty);
      } else {
        section.appendChild(grid);
      }
    }

    renderContent();
  } catch (err) {
    section.removeChild(loading);
    var errorMsg = document.createElement('div');
    errorMsg.className = 'employee-loading';
    errorMsg.textContent = 'Failed to load employees.';
    section.appendChild(errorMsg);
  }
}

window.renderEmployeeSection = renderEmployeeSection;
