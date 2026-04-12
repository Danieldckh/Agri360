document.addEventListener('DOMContentLoaded', () => {
  // Restore saved style overrides (skip text color vars — those are managed by applySettings in styles-page.js)
  const savedOverrides = JSON.parse(localStorage.getItem('proagri-style-overrides') || '{}');
  const themeManaged = ['--text-primary', '--text-secondary', '--text-muted'];
  Object.keys(savedOverrides).forEach(key => {
    if (themeManaged.indexOf(key) === -1) {
      document.documentElement.style.setProperty(key, savedOverrides[key]);
    }
  });

  var isDevEnv = ['localhost', '127.0.0.1', ''].indexOf(window.location.hostname) !== -1;

  const sidebar = document.getElementById('sidebar');
  const collapseBtn = document.getElementById('collapseBtn');
  const dashboardContent = document.getElementById('dashboardContent');
  const navItems = document.querySelectorAll('.nav-item');
  let isTransitioning = false;
  var devPages = [];
  let currentPage = localStorage.getItem('proagri-active-page') || 'my-view';

  // ===== User Menu =====
  const userAvatarBtn = document.getElementById('userAvatarBtn');
  const userAvatarImg = document.getElementById('userAvatarImg');
  const userMenu = document.getElementById('userMenu');
  let userDropdown = null;
  let currentUserData = null;

  function loadCurrentUser() {
    var user = window.getCurrentUser ? window.getCurrentUser() : null;
    var userId = user && user.id ? user.id : 1;
    fetch(API_URL + '/employees/' + userId, {
      headers: Object.assign({ 'Content-Type': 'application/json' }, window.getAuthHeaders ? window.getAuthHeaders() : {})
    })
      .then(function (res) { return res.ok ? res.json() : null; })
      .then(function (data) {
        if (!data) return;
        currentUserData = data;
        updateAvatarImage(data.photoUrl);
        if (userDropdown) refreshDropdownContent();
      })
      .catch(function () { /* silently fail */ });
  }

  function updateAvatarImage(photoUrl) {
    var placeholder = userAvatarBtn.querySelector('.user-avatar-placeholder');
    if (photoUrl) {
      userAvatarImg.src = API_URL.replace('/api', '') + photoUrl;
      userAvatarImg.style.display = 'block';
      if (placeholder) placeholder.style.display = 'none';
    } else {
      userAvatarImg.style.display = 'none';
      if (placeholder) placeholder.style.display = '';
    }
  }

  function createDropdown() {
    if (userDropdown) {
      userDropdown.remove();
      userDropdown = null;
    }

    var dd = document.createElement('div');
    dd.className = 'user-dropdown';

    // Photo section
    var photoWrap = document.createElement('div');
    photoWrap.className = 'user-dropdown-photo-wrap';

    var photoDiv = document.createElement('div');
    photoDiv.className = 'user-dropdown-photo';

    if (currentUserData && currentUserData.photoUrl) {
      var img = document.createElement('img');
      img.className = 'user-dropdown-photo-img';
      img.src = API_URL.replace('/api', '') + currentUserData.photoUrl;
      img.alt = 'Profile photo';
      photoDiv.appendChild(img);
    } else {
      var placeholderDiv = document.createElement('div');
      placeholderDiv.className = 'user-dropdown-photo-placeholder';
      var svgNS = 'http://www.w3.org/2000/svg';
      var svg = document.createElementNS(svgNS, 'svg');
      svg.setAttribute('width', '32');
      svg.setAttribute('height', '32');
      svg.setAttribute('viewBox', '0 0 24 24');
      svg.setAttribute('fill', 'currentColor');
      var path = document.createElementNS(svgNS, 'path');
      path.setAttribute('d', 'M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z');
      svg.appendChild(path);
      placeholderDiv.appendChild(svg);
      photoDiv.appendChild(placeholderDiv);
    }

    // Camera overlay
    var overlay = document.createElement('div');
    overlay.className = 'user-dropdown-photo-overlay';
    var camSvgNS = 'http://www.w3.org/2000/svg';
    var camSvg = document.createElementNS(camSvgNS, 'svg');
    camSvg.setAttribute('width', '20');
    camSvg.setAttribute('height', '20');
    camSvg.setAttribute('viewBox', '0 0 24 24');
    camSvg.setAttribute('fill', 'white');
    var camPath = document.createElementNS(camSvgNS, 'path');
    camPath.setAttribute('d', 'M12 15.2a3.2 3.2 0 100-6.4 3.2 3.2 0 000 6.4zM9 2L7.17 4H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2h-3.17L15 2H9z');
    camSvg.appendChild(camPath);
    overlay.appendChild(camSvg);
    photoDiv.appendChild(overlay);

    // File input for photo upload
    var fileInput = document.createElement('input');
    fileInput.type = 'file';
    fileInput.accept = 'image/*';
    fileInput.style.display = 'none';
    photoDiv.appendChild(fileInput);

    photoDiv.addEventListener('click', function () {
      fileInput.click();
    });

    fileInput.addEventListener('change', function () {
      if (!fileInput.files || !fileInput.files[0]) return;
      var user = window.getCurrentUser ? window.getCurrentUser() : null;
      var userId = user && user.id ? user.id : 1;
      var formData = new FormData();
      formData.append('photo', fileInput.files[0]);
      fetch(API_URL + '/employees/' + userId + '/photo', {
        method: 'POST',
        headers: window.getAuthHeaders ? window.getAuthHeaders() : {},
        body: formData
      })
        .then(function (res) { return res.ok ? res.json() : null; })
        .then(function (data) {
          if (data && data.photoUrl) {
            currentUserData.photoUrl = data.photoUrl;
            updateAvatarImage(data.photoUrl);
            refreshDropdownContent();
          }
        })
        .catch(function () { /* silently fail */ });
    });

    photoWrap.appendChild(photoDiv);
    dd.appendChild(photoWrap);

    // Info section
    var info = document.createElement('div');
    info.className = 'user-dropdown-info';

    var nameEl = document.createElement('div');
    nameEl.className = 'user-dropdown-name';
    nameEl.textContent = currentUserData
      ? (currentUserData.firstName || '') + ' ' + (currentUserData.lastName || '')
      : 'Loading...';
    info.appendChild(nameEl);

    var usernameEl = document.createElement('div');
    usernameEl.className = 'user-dropdown-username';
    usernameEl.textContent = currentUserData && currentUserData.username
      ? '@' + currentUserData.username
      : '';
    info.appendChild(usernameEl);

    if (currentUserData && currentUserData.role) {
      var roleEl = document.createElement('span');
      roleEl.className = 'user-dropdown-role';
      roleEl.textContent = currentUserData.role;
      info.appendChild(roleEl);
    }

    dd.appendChild(info);

    // Divider
    var divider1 = document.createElement('div');
    divider1.className = 'user-dropdown-divider';
    dd.appendChild(divider1);

    // Edit Profile button
    var editBtn = document.createElement('button');
    editBtn.className = 'user-dropdown-action';
    var editSvgNS = 'http://www.w3.org/2000/svg';
    var editSvg = document.createElementNS(editSvgNS, 'svg');
    editSvg.setAttribute('width', '18');
    editSvg.setAttribute('height', '18');
    editSvg.setAttribute('viewBox', '0 0 24 24');
    editSvg.setAttribute('fill', 'currentColor');
    var editPath = document.createElementNS(editSvgNS, 'path');
    editPath.setAttribute('d', 'M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04a1.003 1.003 0 000-1.42l-2.34-2.34a1.003 1.003 0 00-1.42 0l-1.83 1.83 3.75 3.75 1.84-1.82z');
    editSvg.appendChild(editPath);
    editBtn.appendChild(editSvg);
    var editLabel = document.createElement('span');
    editLabel.textContent = 'Edit Profile';
    editBtn.appendChild(editLabel);
    dd.appendChild(editBtn);

    // Divider
    var divider2 = document.createElement('div');
    divider2.className = 'user-dropdown-divider';
    dd.appendChild(divider2);

    // Sign Out
    var signoutBtn = document.createElement('button');
    signoutBtn.className = 'user-dropdown-action signout';
    var signoutSvgNS = 'http://www.w3.org/2000/svg';
    var signoutSvg = document.createElementNS(signoutSvgNS, 'svg');
    signoutSvg.setAttribute('width', '18');
    signoutSvg.setAttribute('height', '18');
    signoutSvg.setAttribute('viewBox', '0 0 24 24');
    signoutSvg.setAttribute('fill', 'currentColor');
    var signoutPath = document.createElementNS(signoutSvgNS, 'path');
    signoutPath.setAttribute('d', 'M17 7l-1.41 1.41L18.17 11H8v2h10.17l-2.58 2.58L17 17l5-5-5-5zM4 5h8V3H4c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h8v-2H4V5z');
    signoutSvg.appendChild(signoutPath);
    signoutBtn.appendChild(signoutSvg);
    var signoutLabel = document.createElement('span');
    signoutLabel.textContent = 'Sign Out';
    signoutBtn.appendChild(signoutLabel);
    signoutBtn.addEventListener('click', function () {
      localStorage.removeItem('token');
      window.location.href = 'login.html';
    });
    dd.appendChild(signoutBtn);

    userMenu.appendChild(dd);
    userDropdown = dd;
    return dd;
  }

  function refreshDropdownContent() {
    if (userDropdown) {
      var wasOpen = userDropdown.classList.contains('open');
      userDropdown.remove();
      userDropdown = null;
      var newDd = createDropdown();
      if (wasOpen) {
        requestAnimationFrame(function () { newDd.classList.add('open'); });
      }
    }
  }

  function toggleDropdown() {
    if (!userDropdown) createDropdown();
    var isOpen = userDropdown.classList.contains('open');
    if (isOpen) {
      userDropdown.classList.remove('open');
    } else {
      userDropdown.classList.add('open');
    }
  }

  userAvatarBtn.addEventListener('click', function (e) {
    e.stopPropagation();
    toggleDropdown();
  });

  document.addEventListener('click', function (e) {
    if (userDropdown && userDropdown.classList.contains('open')) {
      if (!userMenu.contains(e.target)) {
        userDropdown.classList.remove('open');
      }
    }
  });

  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && userDropdown && userDropdown.classList.contains('open')) {
      userDropdown.classList.remove('open');
      userAvatarBtn.focus();
    }
  });

  loadCurrentUser();

  // Toggle sidebar collapse
  collapseBtn.addEventListener('click', () => {
    sidebar.classList.toggle('collapsed');
    const isCollapsed = sidebar.classList.contains('collapsed');
    collapseBtn.setAttribute('aria-expanded', String(!isCollapsed));
  });

  // Nav group toggles
  const navGroups = document.querySelectorAll('.nav-group-header');
  const savedGroups = JSON.parse(localStorage.getItem('proagri-nav-groups') || '{}');
  // Apply saved collapsed state
  document.querySelectorAll('.nav-group').forEach(group => {
    const key = group.dataset.group;
    if (savedGroups[key]) {
      group.classList.add('collapsed');
      group.querySelector('.nav-group-header').setAttribute('aria-expanded', 'false');
    }
  });

  navGroups.forEach(header => {
    header.addEventListener('click', () => {
      const group = header.closest('.nav-group');
      group.classList.toggle('collapsed');
      const isCollapsed = group.classList.contains('collapsed');
      header.setAttribute('aria-expanded', String(!isCollapsed));
      // Persist
      const state = JSON.parse(localStorage.getItem('proagri-nav-groups') || '{}');
      state[group.dataset.group] = isCollapsed;
      localStorage.setItem('proagri-nav-groups', JSON.stringify(state));
    });
  });

  // Navigation with page transitions
  navItems.forEach(item => {
    item.addEventListener('click', () => {
      const currentActive = document.querySelector('.nav-item.active');
      if (isTransitioning) return;

      // Update active state
      navItems.forEach(n => {
        n.classList.remove('active');
        n.removeAttribute('aria-current');
      });
      item.classList.add('active');
      item.setAttribute('aria-current', 'page');

      // Animate page transition
      const page = item.dataset.page;
      transitionToPage(page);
    });

    item.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        item.click();
      }
    });
  });

  // Department config
  var deptPages = ['admin', 'production', 'design', 'editorial', 'video', 'agri4all', 'social-media'];
  var deptNames = {
    'admin': 'Admin',
    'production': 'Production',
    'design': 'Design',
    'editorial': 'Editorial',
    'video': 'Video',
    'agri4all': 'Agri4All',
    'social-media': 'Social Media'
  };
  var deptMenuItems = {
    'admin': ['Proposal', 'Booking Form', 'Onboarding', 'Declined Proposal'],
    'production': ['Deliverables', 'Follow Ups', 'Approvals'],
    'design': ['Content Calendars', 'Agri for All', 'Magazine', 'Web Design', 'Banners', 'Proposals'],
    'editorial': ['Content Calendars', 'Online Articles', 'Magazine', 'Ready to Upload'],
    'video': ['Briefs', 'Production', 'Editing', 'Review'],
    'agri4all': ['Posts', 'Newsletters', 'Links', 'Stats'],
    'social-media': ['Content Calendars', 'Agri for All', 'Own Social Media', 'Google Ads', 'Settings']
  };
  var currentDeptPage = null;
  var currentDeptView = null;
  var savedNavHTML = null;

  function makeSvgIcon(pathD) {
    var svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('width', '20');
    svg.setAttribute('height', '20');
    svg.setAttribute('viewBox', '0 0 24 24');
    svg.setAttribute('fill', 'currentColor');
    var path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    path.setAttribute('d', pathD);
    svg.appendChild(path);
    return svg;
  }

  var wasSidebarCollapsed = false;

  function expandSidebarIfCollapsed() {
    if (sidebar.classList.contains('collapsed')) {
      wasSidebarCollapsed = true;
      sidebar.classList.remove('collapsed');
      collapseBtn.setAttribute('aria-expanded', 'true');
    }
    // Hide collapse button in sub-menus
    collapseBtn.parentElement.style.display = 'none';
  }

  function restoreSidebarCollapsed() {
    // Show collapse button again
    collapseBtn.parentElement.style.display = '';
    if (wasSidebarCollapsed) {
      sidebar.classList.add('collapsed');
      collapseBtn.setAttribute('aria-expanded', 'false');
      wasSidebarCollapsed = false;
    }
  }

  function showDeptSubMenu(page) {
    var nav = document.querySelector('#sidebar nav');
    if (!nav) return;

    expandSidebarIfCollapsed();

    if (!savedNavHTML) {
      savedNavHTML = nav.cloneNode(true);
    }

    currentDeptPage = page;
    var items = deptMenuItems[page] || ['Overview'];
    var savedView = localStorage.getItem('proagri-dept-tab-' + page);
    var activeIdx = savedView ? items.indexOf(savedView) : 0;
    if (activeIdx < 0) activeIdx = 0;
    currentDeptView = items[activeIdx];

    nav.style.transition = 'opacity 0.2s ease';
    nav.style.opacity = '0';

    setTimeout(function () {
      while (nav.firstChild) nav.removeChild(nav.firstChild);

      var backItem = document.createElement('a');
      backItem.className = 'nav-item';
      backItem.tabIndex = 0;
      backItem.style.cursor = 'pointer';
      var backIcon = document.createElement('span');
      backIcon.className = 'nav-icon';
      backIcon.appendChild(makeSvgIcon('M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20v-2z'));
      backItem.appendChild(backIcon);
      var backLabel = document.createElement('span');
      backLabel.className = 'nav-label';
      backLabel.textContent = deptNames[page] || page;
      backItem.appendChild(backLabel);
      backItem.addEventListener('click', function () {
        hideDeptSubMenu();
        var myViewItem = document.querySelector('.nav-item[data-page="my-view"]');
        if (myViewItem) myViewItem.click();
      });
      nav.appendChild(backItem);

      var sep = document.createElement('div');
      sep.style.height = '1px';
      sep.style.background = 'rgba(0,0,0,0.08)';
      sep.style.margin = '8px 12px';
      nav.appendChild(sep);

      // Forms toggle group for Admin department
      if (page === 'admin') {
        var formsGroup = document.createElement('div');
        formsGroup.className = 'nav-group';
        formsGroup.setAttribute('data-group', 'forms');

        var formsHeader = document.createElement('button');
        formsHeader.className = 'nav-group-header';
        formsHeader.setAttribute('aria-expanded', 'true');
        formsHeader.innerHTML = '<span class="nav-group-label">Forms</span>' +
          '<svg class="nav-group-chevron" width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M7.41 8.59L12 13.17l4.59-4.58L18 10l-6 6-6-6z"/></svg>';
        formsHeader.addEventListener('click', function () {
          formsGroup.classList.toggle('collapsed');
          formsHeader.setAttribute('aria-expanded', !formsGroup.classList.contains('collapsed'));
        });
        formsGroup.appendChild(formsHeader);

        var formsItems = document.createElement('div');
        formsItems.className = 'nav-group-items';

        var bookingItem = document.createElement('a');
        bookingItem.href = 'http://kgso4o000o48kww4k4c8048c.148.230.100.16.sslip.io/';
        bookingItem.target = '_blank';
        bookingItem.rel = 'noopener';
        bookingItem.className = 'nav-item';
        bookingItem.tabIndex = 0;
        var bookingIcon = document.createElement('span');
        bookingIcon.className = 'nav-icon';
        bookingIcon.innerHTML = '<svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M19 3h-1V1h-2v2H8V1H6v2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm0 16H5V8h14v11zM9 10H7v2h2v-2zm4 0h-2v2h2v-2zm4 0h-2v2h2v-2z"/></svg>';
        bookingItem.appendChild(bookingIcon);
        var bookingLabel = document.createElement('span');
        bookingLabel.className = 'nav-label';
        bookingLabel.textContent = 'New Booking';
        bookingItem.appendChild(bookingLabel);
        formsItems.appendChild(bookingItem);

        formsGroup.appendChild(formsItems);
        nav.appendChild(formsGroup);
      }

      items.forEach(function (viewName, idx) {
        var item = document.createElement('a');
        item.className = 'nav-item' + (idx === activeIdx ? ' active' : '');
        item.tabIndex = 0;
        item.style.cursor = 'pointer';
        var label = document.createElement('span');
        label.className = 'nav-label';
        label.textContent = viewName;
        item.appendChild(label);
        item.addEventListener('click', function () {
          currentDeptView = viewName;
          localStorage.setItem('proagri-dept-tab-' + page, viewName);
          nav.querySelectorAll('.nav-item').forEach(function (n) { n.classList.remove('active'); });
          item.classList.add('active');
          showDeptContent(page, viewName);
        });
        nav.appendChild(item);
      });

      nav.style.opacity = '1';
    }, 200);
  }

  function hideDeptSubMenu() {
    var nav = document.querySelector('#sidebar nav');
    if (!nav || !savedNavHTML) return;

    nav.style.transition = 'opacity 0.2s ease';
    nav.style.opacity = '0';

    setTimeout(function () {
      while (nav.firstChild) nav.removeChild(nav.firstChild);
      while (savedNavHTML.firstChild) {
        nav.appendChild(savedNavHTML.firstChild);
      }
      savedNavHTML = null;
      currentDeptPage = null;
      currentDeptView = null;
      nav.style.opacity = '1';

      restoreSidebarCollapsed();
      rebindNavItems();
    }, 200);
  }

  // Department slug → assigned column key mapping (camelCase to match API response)
  var deptAssignedKey = {
    'admin': 'assignedAdmin',
    'production': 'assignedProduction',
    'design': 'assignedDesign',
    'editorial': 'assignedEditorial',
    'video': 'assignedVideo',
    'agri4all': 'assignedAgri4all',
    'social-media': 'assignedSocialMedia'
  };

  // Resolve generic assigned_to columns to department-specific ones
  function resolveAssignedColumns(columns, deptSlug) {
    var assignKey = deptAssignedKey[deptSlug];
    if (!assignKey) return columns;
    return columns.map(function(col) {
      // Replace generic assigned_to with dept-specific key
      if (col.key === 'assigned_to') {
        return Object.assign({}, col, { key: assignKey, type: 'person', editable: true });
      }
      return col;
    });
  }

  // Tab-specific column configurations for department sheets
  var deptTabColumns = {
    '_default': [
      { key: 'name', label: 'Name', sortable: true, isName: true, type: 'text', editable: true },
      { key: 'client', label: 'Client', sortable: true },
      { key: 'assigned_to', label: 'Assigned To', sortable: true, type: 'person', editable: true },
      { key: 'status', label: 'Status', sortable: true, type: 'status', editable: true, options: ['pending', 'in_progress', 'completed', 'overdue'] },
      { key: 'due_date', label: 'Due Date', sortable: true, type: 'date', editable: true }
    ],
    'Proposal': [
      { key: 'client', label: 'Client', sortable: true, isName: true },
      { key: 'proposal_type', label: 'Type', sortable: true },
      { key: 'value', label: 'Value', sortable: true },
      { key: 'submitted_date', label: 'Submitted', sortable: true, type: 'date' },
      { key: 'status', label: 'Status', sortable: true, type: 'status' }
    ],
    'Booking Form': [
      { key: 'client', label: 'Client', sortable: true, isName: true },
      { key: 'booking_type', label: 'Type', sortable: true },
      { key: 'start_date', label: 'Start Date', sortable: true, type: 'date' },
      { key: 'end_date', label: 'End Date', sortable: true, type: 'date' },
      { key: 'status', label: 'Status', sortable: true, type: 'status' }
    ],
    'Onboarding': [
      { key: 'client', label: 'Client', sortable: true, isName: true },
      { key: 'assignedAdmin', label: 'Assigned To', sortable: true, type: 'person', editable: true },
      { key: 'progress', label: 'Progress', sortable: true },
      { key: 'start_date', label: 'Start Date', sortable: true, type: 'date' },
      { key: 'status', label: 'Status', sortable: true, type: 'status' }
    ],
    'Onboarded': [
      { key: 'client', label: 'Client', sortable: true, isName: true },
      { key: 'onboarded_date', label: 'Onboarded Date', sortable: true, type: 'date' },
      { key: 'account_manager', label: 'Account Manager', sortable: true },
      { key: 'status', label: 'Status', sortable: true, type: 'status' }
    ],
    'Declined Proposal': [
      { key: 'client', label: 'Client', sortable: true, isName: true },
      { key: 'proposal_type', label: 'Type', sortable: true },
      { key: 'reason', label: 'Reason', sortable: true },
      { key: 'declined_date', label: 'Declined Date', sortable: true, type: 'date' }
    ],
    'Action Board': [
      { key: 'task', label: 'Task', sortable: true, isName: true, type: 'text', editable: true },
      { key: 'client', label: 'Client', sortable: true },
      { key: 'assignedProduction', label: 'Assigned To', sortable: true, type: 'person', editable: true },
      { key: 'priority', label: 'Priority', sortable: true, type: 'status', editable: true, options: ['low', 'medium', 'high', 'urgent'] },
      { key: 'due_date', label: 'Due Date', sortable: true, type: 'date', editable: true },
      { key: 'status', label: 'Status', sortable: true, type: 'status', editable: true, options: ['pending', 'in_progress', 'completed', 'overdue'] }
    ],
    'Overview': [
      { key: 'project', label: 'Project', sortable: true, isName: true },
      { key: 'client', label: 'Client', sortable: true },
      { key: 'department', label: 'Department', sortable: true },
      { key: 'progress', label: 'Progress', sortable: true },
      { key: 'status', label: 'Status', sortable: true, type: 'status' }
    ],
    'Follow Ups': [
      { key: 'item', label: 'Item', sortable: true, isName: true },
      { key: 'client', label: 'Client', sortable: true },
      { key: 'assignedProduction', label: 'Assigned To', sortable: true, type: 'person', editable: true },
      { key: 'follow_up_date', label: 'Follow Up Date', sortable: true, type: 'date' },
      { key: 'status', label: 'Status', sortable: true, type: 'status' }
    ],
    'Content Calendars': [
      { key: 'title', label: 'Title', sortable: true, isName: true, type: 'text', editable: true },
      { key: 'client', label: 'Client', sortable: true },
      { key: 'platform', label: 'Platform', sortable: true, type: 'status', editable: true, options: ['facebook', 'instagram', 'twitter', 'linkedin', 'website'] },
      { key: 'publish_date', label: 'Publish Date', sortable: true, type: 'date', editable: true },
      { key: 'status', label: 'Status', sortable: true, type: 'status', editable: true, options: ['draft', 'pending', 'in_progress', 'completed'] }
    ],
    'Magazine': [
      { key: 'title', label: 'Title', sortable: true, isName: true, type: 'text', editable: true },
      { key: 'edition', label: 'Edition', sortable: true, type: 'text', editable: true },
      { key: 'assignedDesign', label: 'Assigned To', sortable: true, type: 'person', editable: true },
      { key: 'deadline', label: 'Deadline', sortable: true, type: 'date', editable: true },
      { key: 'status', label: 'Status', sortable: true, type: 'status', editable: true, options: ['pending', 'in_progress', 'completed', 'overdue'] }
    ],
    'Agri for All': [
      { key: 'title', label: 'Title', sortable: true, isName: true },
      { key: 'category', label: 'Category', sortable: true },
      { key: 'assignedAgri4all', label: 'Assigned To', sortable: true, type: 'person', editable: true },
      { key: 'deadline', label: 'Deadline', sortable: true, type: 'date' },
      { key: 'status', label: 'Status', sortable: true, type: 'status' }
    ],
    'Web Design': [
      { key: 'project', label: 'Project', sortable: true, isName: true },
      { key: 'client', label: 'Client', sortable: true },
      { key: 'assignedDesign', label: 'Assigned To', sortable: true, type: 'person', editable: true },
      { key: 'deadline', label: 'Deadline', sortable: true, type: 'date' },
      { key: 'status', label: 'Status', sortable: true, type: 'status' }
    ],
    'Own SM': [
      { key: 'title', label: 'Title', sortable: true, isName: true },
      { key: 'platform', label: 'Platform', sortable: true },
      { key: 'assignedDesign', label: 'Assigned To', sortable: true, type: 'person', editable: true },
      { key: 'publish_date', label: 'Publish Date', sortable: true, type: 'date' },
      { key: 'status', label: 'Status', sortable: true, type: 'status' }
    ],
    'Internal Tasks': [
      { key: 'task', label: 'Task', sortable: true, isName: true, type: 'text', editable: true },
      { key: 'assignedDesign', label: 'Assigned To', sortable: true, type: 'person', editable: true },
      { key: 'priority', label: 'Priority', sortable: true, type: 'status', editable: true, options: ['low', 'medium', 'high', 'urgent'] },
      { key: 'due_date', label: 'Due Date', sortable: true, type: 'date', editable: true },
      { key: 'status', label: 'Status', sortable: true, type: 'status', editable: true, options: ['pending', 'in_progress', 'completed', 'overdue'] }
    ],
    'Proposals': [
      { key: 'client', label: 'Client', sortable: true, isName: true },
      { key: 'type', label: 'Type', sortable: true },
      { key: 'value', label: 'Value', sortable: true },
      { key: 'deadline', label: 'Deadline', sortable: true, type: 'date' },
      { key: 'status', label: 'Status', sortable: true, type: 'status' }
    ],
    'Online Articles': [
      { key: 'title', label: 'Title', sortable: true, isName: true },
      { key: 'author', label: 'Author', sortable: true },
      { key: 'category', label: 'Category', sortable: true },
      { key: 'publish_date', label: 'Publish Date', sortable: true, type: 'date' },
      { key: 'status', label: 'Status', sortable: true, type: 'status' }
    ],
    'Dashboard': [
      { key: 'title', label: 'Title', sortable: true, isName: true },
      { key: 'client', label: 'Client', sortable: true },
      { key: 'type', label: 'Type', sortable: true },
      { key: 'due_date', label: 'Due Date', sortable: true, type: 'date' },
      { key: 'status', label: 'Status', sortable: true, type: 'status' }
    ],
    'Calendar': [
      { key: 'event', label: 'Event', sortable: true, isName: true },
      { key: 'client', label: 'Client', sortable: true },
      { key: 'date', label: 'Date', sortable: true, type: 'date' },
      { key: 'assigned_to', label: 'Assigned To', sortable: true, type: 'person', editable: true },
      { key: 'status', label: 'Status', sortable: true, type: 'status' }
    ],
    'Tasks': [
      { key: 'task', label: 'Task', sortable: true, isName: true, type: 'text', editable: true },
      { key: 'client', label: 'Client', sortable: true },
      { key: 'assigned_to', label: 'Assigned To', sortable: true, type: 'person', editable: true },
      { key: 'due_date', label: 'Due Date', sortable: true, type: 'date', editable: true },
      { key: 'status', label: 'Status', sortable: true, type: 'status', editable: true, options: ['pending', 'in_progress', 'completed', 'overdue'] }
    ],
    'Budgets': [
      { key: 'project', label: 'Project', sortable: true, isName: true, type: 'text', editable: true },
      { key: 'client', label: 'Client', sortable: true },
      { key: 'budget', label: 'Budget', sortable: true, type: 'number', editable: true },
      { key: 'spent', label: 'Spent', sortable: true, type: 'number', editable: true },
      { key: 'status', label: 'Status', sortable: true, type: 'status', editable: true, options: ['active', 'completed', 'overdue'] }
    ],
    'Team & Freelancers': [
      { key: 'name', label: 'Name', sortable: true, isName: true },
      { key: 'role', label: 'Role', sortable: true },
      { key: 'type', label: 'Type', sortable: true },
      { key: 'availability', label: 'Availability', sortable: true },
      { key: 'status', label: 'Status', sortable: true, type: 'status' }
    ],
    'Listings': [
      { key: 'title', label: 'Title', sortable: true, isName: true },
      { key: 'category', label: 'Category', sortable: true },
      { key: 'region', label: 'Region', sortable: true },
      { key: 'listed_date', label: 'Listed Date', sortable: true, type: 'date' },
      { key: 'status', label: 'Status', sortable: true, type: 'status' }
    ],
    'Newsletters': [
      { key: 'title', label: 'Title', sortable: true, isName: true },
      { key: 'edition', label: 'Edition', sortable: true },
      { key: 'send_date', label: 'Send Date', sortable: true, type: 'date' },
      { key: 'recipients', label: 'Recipients', sortable: true },
      { key: 'status', label: 'Status', sortable: true, type: 'status' }
    ],
    'Social Media': [
      { key: 'title', label: 'Title', sortable: true, isName: true },
      { key: 'platform', label: 'Platform', sortable: true },
      { key: 'assigned_to', label: 'Assigned To', sortable: true, type: 'person', editable: true },
      { key: 'publish_date', label: 'Publish Date', sortable: true, type: 'date' },
      { key: 'status', label: 'Status', sortable: true, type: 'status' }
    ],
    'Banners': [
      { key: 'title', label: 'Title', sortable: true, isName: true },
      { key: 'client', label: 'Client', sortable: true },
      { key: 'size', label: 'Size', sortable: true },
      { key: 'deadline', label: 'Deadline', sortable: true, type: 'date' },
      { key: 'status', label: 'Status', sortable: true, type: 'status' }
    ],
    'Stats': [
      { key: 'platform', label: 'Platform', sortable: true, isName: true },
      { key: 'metric', label: 'Metric', sortable: true },
      { key: 'value', label: 'Value', sortable: true },
      { key: 'period', label: 'Period', sortable: true },
      { key: 'trend', label: 'Trend', sortable: true }
    ],
    'Settings': [
      { key: 'setting', label: 'Setting', sortable: true, isName: true },
      { key: 'value', label: 'Value', sortable: true },
      { key: 'category', label: 'Category', sortable: true },
      { key: 'last_updated', label: 'Last Updated', sortable: true, type: 'date' }
    ]
  };

  // Right-side panel column configs per tab
  var deptSideColumns = {
    '_default': [
      { key: 'item', label: 'Item', sortable: true, isName: true },
      { key: 'status', label: 'Status', sortable: true, type: 'status' }
    ],
    'Proposal': [
      { key: 'client', label: 'Client', sortable: true, isName: true },
      { key: 'status', label: 'Status', sortable: true, type: 'status' }
    ],
    'Booking Form': [
      { key: 'client', label: 'Client', sortable: true, isName: true },
      { key: 'status', label: 'Status', sortable: true, type: 'status' }
    ],
    'Onboarding': [
      { key: 'client', label: 'Client', sortable: true, isName: true },
      { key: 'progress', label: 'Progress', sortable: true }
    ],
    'Action Board': [
      { key: 'task', label: 'Task', sortable: true, isName: true },
      { key: 'priority', label: 'Priority', sortable: true }
    ],
    'Overview': [
      { key: 'project', label: 'Project', sortable: true, isName: true },
      { key: 'status', label: 'Status', sortable: true, type: 'status' }
    ],
    'Follow Ups': [
      { key: 'item', label: 'Item', sortable: true, isName: true },
      { key: 'follow_up_date', label: 'Date', sortable: true, type: 'date' }
    ],
    'Content Calendars': [
      { key: 'title', label: 'Title', sortable: true, isName: true },
      { key: 'publish_date', label: 'Date', sortable: true, type: 'date' }
    ],
    'Magazine': [
      { key: 'title', label: 'Title', sortable: true, isName: true },
      { key: 'deadline', label: 'Deadline', sortable: true, type: 'date' }
    ],
    'Dashboard': [
      { key: 'title', label: 'Title', sortable: true, isName: true },
      { key: 'status', label: 'Status', sortable: true, type: 'status' }
    ],
    'Tasks': [
      { key: 'task', label: 'Task', sortable: true, isName: true },
      { key: 'due_date', label: 'Due', sortable: true, type: 'date' }
    ],
    'Budgets': [
      { key: 'project', label: 'Project', sortable: true, isName: true },
      { key: 'spent', label: 'Spent', sortable: true }
    ],
    'Listings': [
      { key: 'title', label: 'Title', sortable: true, isName: true },
      { key: 'status', label: 'Status', sortable: true, type: 'status' }
    ],
    'Newsletters': [
      { key: 'title', label: 'Title', sortable: true, isName: true },
      { key: 'send_date', label: 'Send Date', sortable: true, type: 'date' }
    ]
  };

  // Side panel title per tab
  var deptSideTitles = {
    'Proposal': 'Recent Activity',
    'Booking Form': 'Pending Bookings',
    'Onboarding': 'Progress Tracker',
    'Onboarded': 'Recent Additions',
    'Declined Proposal': 'Declined History',
    'Action Board': 'Priorities',
    'Overview': 'Status Summary',
    'Follow Ups': 'Upcoming',
    'Content Calendars': 'Upcoming Posts',
    'Magazine': 'Deadlines',
    'Agri for All': 'Deadlines',
    'Web Design': 'Active Projects',
    'Own SM': 'Scheduled',
    'Internal Tasks': 'Urgent',
    'Proposals': 'Pending',
    'Online Articles': 'Drafts',
    'Dashboard': 'Quick View',
    'Calendar': 'This Week',
    'Tasks': 'Due Soon',
    'Budgets': 'Budget Summary',
    'Team & Freelancers': 'Availability',
    'Listings': 'Recent',
    'Newsletters': 'Scheduled',
    'Social Media': 'Queue',
    'Banners': 'In Progress',
    'Stats': 'Highlights',
    'Settings': 'Recent Changes'
  };

  // Build a sheet card with title, optional search, and sheet container
  function buildSheetCard(title, columns, opts) {
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
          filtered = allData.filter(function(row) {
            return columns.some(function(col) {
              var val = row[col.key];
              return val && val.toString().toLowerCase().indexOf(term) !== -1;
            });
          });
        }
      }

      countBadge.textContent = filtered.length;

      if (window.renderSheet) {
        window.renderSheet(sheetContainer, {
          columns: columns,
          data: filtered,
          searchable: false,
          radialActions: opts.compact ? [] : [
            { id: 'view', label: 'View Details', action: function(row) { } },
            { id: 'edit', label: 'Edit', action: function(row) { } }
          ],
          apiEndpoint: opts.apiEndpoint || null,
          onCellEdit: opts.onCellEdit || null
        });
      }
    }

    if (searchInput) {
      searchInput.addEventListener('input', render);
    }
    render();

    return { el: card, update: function(data) { allData = data; render(); } };
  }

  function showDeptContent(page, viewName) {
    while (dashboardContent.firstChild) {
      dashboardContent.removeChild(dashboardContent.firstChild);
    }

    // Route Admin > Proposal to the proposal tab
    if (page === 'admin' && viewName === 'Proposal' && window.renderProposalTab) {
      window.renderProposalTab(dashboardContent);
      return;
    }

    // Route Admin > Booking Form to the booking form tab
    if (page === 'admin' && viewName === 'Booking Form' && window.renderBookingFormTab) {
      window.renderBookingFormTab(dashboardContent);
      return;
    }

    // Route Admin > Onboarding to the onboarding tab
    if (page === 'admin' && viewName === 'Onboarding' && window.renderOnboardingTab) {
      window.renderOnboardingTab(dashboardContent);
      return;
    }

    // Route Admin > Declined Proposal to the declined tab
    if (page === 'admin' && viewName === 'Declined Proposal' && window.renderDeclinedTab) {
      window.renderDeclinedTab(dashboardContent);
      return;
    }


    // Route Production > Deliverables to unified deliverables view
    if (page === 'production' && viewName === 'Deliverables' && window.renderProductionDeliverablesTab) {
      window.renderProductionDeliverablesTab(dashboardContent);
      return;
    }

    // Route Production > Follow Ups
    if (page === 'production' && viewName === 'Follow Ups' && window.renderFollowUpsTab) {
      window.renderFollowUpsTab(dashboardContent);
      return;
    }

    // Route Production > Approvals
    if (page === 'production' && viewName === 'Approvals' && window.renderApprovalsTab) {
      window.renderApprovalsTab(dashboardContent);
      return;
    }

    // Route Design > Content Calendars to the Production-styled split sheet
    if (page === 'design' && viewName === 'Content Calendars' && window.renderDesignContentCalendarsTab) {
      window.renderDesignContentCalendarsTab(dashboardContent);
      return;
    }

    // Route Editorial > Content Calendars to the Production-styled split sheet
    if (page === 'editorial' && viewName === 'Content Calendars' && window.renderEditorialContentCalendarsTab) {
      window.renderEditorialContentCalendarsTab(dashboardContent);
      return;
    }

    // Route Editorial > Online Articles to 70/30 split (Editing | Translating)
    if (page === 'editorial' && viewName === 'Online Articles') {
      if (window.renderEditorialOnlineArticlesTab) {
        window.renderEditorialOnlineArticlesTab(dashboardContent);
        return;
      }
    }

    // Route Editorial > Ready to Upload to full-width ready_to_upload sheet
    if (page === 'editorial' && viewName === 'Ready to Upload') {
      if (window.renderEditorialReadyToUploadTab) {
        window.renderEditorialReadyToUploadTab(dashboardContent);
        return;
      }
    }

    // Route Design > Proposals to live  view
    if (page === 'design' && viewName === 'Proposals' && window.renderDesignProposalsTab) {
      window.renderDesignProposalsTab(dashboardContent);
      return;
    }

    // Route Design > Web Design to web design workflow view
    if (page === 'design' && viewName === 'Web Design' && window.renderDesignWebDesignTab) {
      window.renderDesignWebDesignTab(dashboardContent);
      return;
    }

    // Social Media department: every tab IS the scheduler, preset to a source.
    // Content Calendars → content-calendar, Agri for All → agri4all,
    // Own Social Media → own-sm. The scheduler hides its internal source
    // switcher when a preset is active so the dept tabs are the nav.
    if (page === 'social-media') {
      if (viewName === 'Settings' && window.renderSocialSettingsPage) {
        dashboardContent.style.display = 'block';
        dashboardContent.style.padding = '0';
        dashboardContent.style.height = '100%';
        window.renderSocialSettingsPage(dashboardContent);
        return;
      }
      if (window.renderSocialSchedulerPage) {
        var SM_SOURCE_MAP = {
          'Content Calendars': 'content-calendar',
          'Agri for All': 'agri4all',
          'Own Social Media': 'own-sm'
        };
        var presetSource = SM_SOURCE_MAP[viewName];
        if (presetSource) {
          dashboardContent.style.display = 'block';
          dashboardContent.style.padding = '0';
          dashboardContent.style.height = '100%';
          window.renderSocialSchedulerPage(dashboardContent, { sourceFilter: presetSource });
          return;
        }
      }
    }

    // Route department tabs to generic type-filtered view
    var deptTypeViews = ['Content Calendars', 'Agri for All', 'Magazine', 'Banners', 'Online Articles',
      'Briefs', 'Production', 'Editing', 'Review', 'Posts', 'Newsletters', 'Links', 'Stats', 'Scheduling',
      'Google Ads'];
    if (deptTypeViews.indexOf(viewName) !== -1 && window.renderDeptTypeTab) {
      window.renderDeptTypeTab(dashboardContent, page, viewName);
      return;
    }

    dashboardContent.style.display = 'flex';
    dashboardContent.style.alignItems = 'stretch';
    dashboardContent.style.justifyContent = '';
    dashboardContent.style.flexDirection = '';
    dashboardContent.style.height = '';
    dashboardContent.style.gap = '';
    dashboardContent.style.padding = '';

    var layout = document.createElement('div');
    layout.className = 'dept-dashboard-layout';

    // Main sheet (left, ~80%)
    var mainCol = document.createElement('div');
    mainCol.className = 'dept-dashboard-main';
    var mainColumns = resolveAssignedColumns(deptTabColumns[viewName] || deptTabColumns['_default'], page);
    var mainCard = buildSheetCard(viewName, mainColumns);
    mainCol.appendChild(mainCard.el);
    layout.appendChild(mainCol);

    // Side sheet (right, ~20%)
    var sideCol = document.createElement('div');
    sideCol.className = 'dept-dashboard-side';
    var sideTitle = deptSideTitles[viewName] || 'Summary';
    var sideColumns = deptSideColumns[viewName] || deptSideColumns['_default'];
    var sideCard = buildSheetCard(sideTitle, sideColumns, { compact: true });
    sideCol.appendChild(sideCard.el);
    layout.appendChild(sideCol);

    dashboardContent.appendChild(layout);
  }

  function rebindNavItems() {
    var items = document.querySelectorAll('.nav-item[data-page]');
    items.forEach(function (item) {
      item.addEventListener('click', function () {
        var currentActive = document.querySelector('.nav-item.active');
        if (isTransitioning) return;

        items.forEach(function (n) {
          n.classList.remove('active');
          n.removeAttribute('aria-current');
        });
        item.classList.add('active');
        item.setAttribute('aria-current', 'page');

        transitionToPage(item.dataset.page);
      });

      item.addEventListener('keydown', function (e) {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          item.click();
        }
      });
    });
  }

  window.rebindNavItems = rebindNavItems;
  window.expandSidebarIfCollapsed = expandSidebarIfCollapsed;
  window.restoreSidebarCollapsed = restoreSidebarCollapsed;

  // Page renderer registry — add new pages here
  var pageRenderers = {
    'employees': function () { renderEmployeeSection(dashboardContent); },
    'messaging': function () {
      if (window.activateMessagingSidebar) window.activateMessagingSidebar();
      if (window.renderMessagingSection) window.renderMessagingSection(dashboardContent);
    },
    'styles': function () { if (window.renderStylesPage) window.renderStylesPage(dashboardContent); },
    'components': function () { if (window.renderComponentsPage) window.renderComponentsPage(dashboardContent); },
    'database': function () { if (window.renderDatabasePage) window.renderDatabasePage(dashboardContent); },
    'client-list': function () { window.insertTemplate(dashboardContent, '/pages/client-list/client-list.html', window.initClientListPage); },
    'dashboards': function () { window.insertTemplate(dashboardContent, '/pages/dashboards/dashboards.html', window.initDashboardsPage); },
    'magazine-overview': function () { if (window.renderMagazineOverviewPage) window.renderMagazineOverviewPage(dashboardContent); },
    'docs': function () { if (window.renderDocsPage) window.renderDocsPage(dashboardContent); }
    // NOTE: 'design' and 'editorial' are NOT in pageRenderers on purpose.
    // They are department pages handled by the deptPages flow (sidebar
    // subnav). Individual tabs (e.g. 'Content Calendars') are routed
    // inside showDeptContent() below.
  };

  function finishPageEnter() {
    dashboardContent.classList.add('page-enter');
    dashboardContent.addEventListener('animationend', function onEnter() {
      dashboardContent.removeEventListener('animationend', onEnter);
      dashboardContent.classList.remove('page-enter');
      isTransitioning = false;
    });
  }


  // Content Calendar sidebar sub-menu
  function showContentCalendarMenu(clientName) {
    var nav = document.querySelector('#sidebar nav');
    if (!nav) return;

    expandSidebarIfCollapsed();

    if (!savedNavHTML) {
      savedNavHTML = nav.cloneNode(true);
    }

    nav.style.transition = 'opacity 0.2s ease';
    nav.style.opacity = '0';

    setTimeout(function () {
      while (nav.firstChild) nav.removeChild(nav.firstChild);

      // Back button
      var backItem = document.createElement('a');
      backItem.className = 'nav-item';
      backItem.tabIndex = 0;
      backItem.style.cursor = 'pointer';
      var backIcon = document.createElement('span');
      backIcon.className = 'nav-icon';
      backIcon.appendChild(makeSvgIcon('M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20v-2z'));
      backItem.appendChild(backIcon);
      var backLabel = document.createElement('span');
      backLabel.className = 'nav-label';
      backLabel.textContent = 'Back';
      backItem.appendChild(backLabel);
      backItem.addEventListener('click', function () {
        hideContentCalendarMenu();
        var myViewItem = document.querySelector('.nav-item[data-page="my-view"]');
        if (myViewItem) myViewItem.click();
      });
      nav.appendChild(backItem);

      // --- Client Name ---
      var clientSection = document.createElement('div');
      clientSection.className = 'cc-sidebar-section';
      var clientAvatar = document.createElement('div');
      clientAvatar.className = 'cc-sidebar-avatar';
      clientAvatar.textContent = (clientName || 'C').substring(0, 2).toUpperCase();
      clientSection.appendChild(clientAvatar);
      var clientNameEl = document.createElement('div');
      clientNameEl.className = 'cc-sidebar-client-name';
      clientNameEl.textContent = clientName || 'Client Name';
      clientSection.appendChild(clientNameEl);
      var clientIndustry = document.createElement('div');
      clientIndustry.className = 'cc-sidebar-meta';
      clientIndustry.textContent = 'Agriculture • Active';
      clientSection.appendChild(clientIndustry);
      nav.appendChild(clientSection);

      nav.appendChild(makeSidebarSep());

      // --- Social Links ---
      var socialLabel = document.createElement('div');
      socialLabel.className = 'cc-sidebar-label';
      socialLabel.textContent = 'Social Links';
      nav.appendChild(socialLabel);

      var socials = [
        { name: 'Facebook', icon: 'M12 2.04c-5.5 0-10 4.49-10 10.02 0 5 3.66 9.15 8.44 9.9v-7H7.9v-2.9h2.54V9.85c0-2.52 1.49-3.93 3.78-3.93 1.09 0 2.24.2 2.24.2v2.46h-1.26c-1.24 0-1.63.78-1.63 1.57v1.88h2.78l-.45 2.9h-2.33v7a10 10 0 008.44-9.9c0-5.53-4.5-10.02-10-10.02z', url: '#' },
        { name: 'Instagram', icon: 'M7.8 2h8.4C19.4 2 22 4.6 22 7.8v8.4a5.8 5.8 0 01-5.8 5.8H7.8C4.6 22 2 19.4 2 16.2V7.8A5.8 5.8 0 017.8 2zm-.2 2A3.6 3.6 0 004 7.6v8.8C4 18.39 5.61 20 7.6 20h8.8a3.6 3.6 0 003.6-3.6V7.6C20 5.61 18.39 4 16.4 4H7.6zm9.65 1.5a1.25 1.25 0 110 2.5 1.25 1.25 0 010-2.5zM12 7a5 5 0 110 10 5 5 0 010-10zm0 2a3 3 0 100 6 3 3 0 000-6z', url: '#' },
        { name: 'Website', icon: 'M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 17.93c-3.95-.49-7-3.85-7-7.93 0-.62.08-1.21.21-1.79L9 15v1c0 1.1.9 2 2 2v1.93zm6.9-2.54c-.26-.81-1-1.39-1.9-1.39h-1v-3c0-.55-.45-1-1-1H8v-2h2c.55 0 1-.45 1-1V7h2c1.1 0 2-.9 2-2v-.41c2.93 1.19 5 4.06 5 7.41 0 2.08-.8 3.97-2.1 5.39z', url: '#' }
      ];

      var socialList = document.createElement('div');
      socialList.className = 'cc-sidebar-social-list';
      socials.forEach(function (s) {
        var link = document.createElement('a');
        link.className = 'cc-sidebar-social-link';
        link.href = s.url;
        link.title = s.name;
        link.innerHTML = '<svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="' + s.icon + '"/></svg>';
        var linkLabel = document.createElement('span');
        linkLabel.textContent = s.name;
        link.appendChild(linkLabel);
        socialList.appendChild(link);
      });
      nav.appendChild(socialList);

      nav.appendChild(makeSidebarSep());

      // --- Calendar Info ---
      var infoLabel = document.createElement('div');
      infoLabel.className = 'cc-sidebar-label';
      infoLabel.textContent = 'Calendar Info';
      nav.appendChild(infoLabel);

      var infoList = document.createElement('div');
      infoList.className = 'cc-sidebar-info-list';
      var infoItems = [
        { label: 'Status', value: 'Active' },
        { label: 'Posts/Month', value: '12' },
        { label: 'Next Due', value: 'Mar 28, 2026' },
        { label: 'Platform', value: 'FB, IG, Web' }
      ];
      infoItems.forEach(function (info) {
        var row = document.createElement('div');
        row.className = 'cc-sidebar-info-row';
        row.innerHTML = '<span class="cc-sidebar-info-label">' + info.label + '</span>' +
          '<span class="cc-sidebar-info-value">' + info.value + '</span>';
        infoList.appendChild(row);
      });
      nav.appendChild(infoList);

      nav.appendChild(makeSidebarSep());

      // --- Team Members ---
      var teamLabel = document.createElement('div');
      teamLabel.className = 'cc-sidebar-label';
      teamLabel.textContent = 'Team Members';
      nav.appendChild(teamLabel);

      var teamList = document.createElement('div');
      teamList.className = 'cc-sidebar-team-list';
      var members = [
        { name: 'Jane Smith', role: 'Content Manager', initials: 'JS', color: '#4285f4' },
        { name: 'Sandra Fourie', role: 'Designer', initials: 'SF', color: '#9b59b6' },
        { name: 'Pieter Louw', role: 'Copywriter', initials: 'PL', color: '#1abc9c' }
      ];
      members.forEach(function (m) {
        var row = document.createElement('div');
        row.className = 'cc-sidebar-team-member';
        var avatar = document.createElement('span');
        avatar.className = 'cc-sidebar-team-avatar';
        avatar.style.background = m.color;
        avatar.textContent = m.initials;
        row.appendChild(avatar);
        var info = document.createElement('div');
        info.className = 'cc-sidebar-team-info';
        info.innerHTML = '<div class="cc-sidebar-team-name">' + m.name + '</div>' +
          '<div class="cc-sidebar-team-role">' + m.role + '</div>';
        row.appendChild(info);
        teamList.appendChild(row);
      });
      nav.appendChild(teamList);

      nav.style.opacity = '1';
    }, 200);
  }

  function makeSidebarSep() {
    var sep = document.createElement('div');
    sep.style.height = '1px';
    sep.style.background = 'rgba(128,128,128,0.12)';
    sep.style.margin = '10px 12px';
    return sep;
  }

  function hideContentCalendarMenu() {
    var nav = document.querySelector('#sidebar nav');
    if (!nav || !savedNavHTML) return;

    nav.style.transition = 'opacity 0.2s ease';
    nav.style.opacity = '0';

    setTimeout(function () {
      while (nav.firstChild) nav.removeChild(nav.firstChild);
      while (savedNavHTML.firstChild) {
        nav.appendChild(savedNavHTML.firstChild);
      }
      savedNavHTML = null;
      nav.style.opacity = '1';

      restoreSidebarCollapsed();
      rebindNavItems();
    }, 200);
  }

  window.showContentCalendarMenu = showContentCalendarMenu;
  window.hideContentCalendarMenu = hideContentCalendarMenu;

  function transitionToPage(page) {
    isTransitioning = true;

    // Cleanup previous page if it was messaging
    if (currentPage === 'messaging' && page !== 'messaging') {
      if (window.deactivateMessagingSidebar) window.deactivateMessagingSidebar();
      if (window.cleanupMessaging) window.cleanupMessaging();
    }

    // Cleanup previous page if it was a department
    if (currentDeptPage && deptPages.indexOf(page) === -1) {
      hideDeptSubMenu();
    }

    dashboardContent.classList.add('page-exit');

    const safetyTimeout = setTimeout(() => {
      handleExitComplete();
    }, 400);

    function handleExitComplete() {
      clearTimeout(safetyTimeout);
      dashboardContent.removeEventListener('animationend', onExit);
      dashboardContent.classList.remove('page-exit');

      while (dashboardContent.firstChild) {
        dashboardContent.removeChild(dashboardContent.firstChild);
      }

      currentPage = page;
      localStorage.setItem('proagri-active-page', page);

      // Check page renderer registry
      if (pageRenderers[page]) {
        pageRenderers[page]();
        finishPageEnter();
        return;
      }

      // Department pages
      if (deptPages.indexOf(page) !== -1) {
        showDeptSubMenu(page);
        var deptItems = deptMenuItems[page] || ['Overview'];
        var savedDeptView = localStorage.getItem('proagri-dept-tab-' + page);
        var restoredView = (savedDeptView && deptItems.indexOf(savedDeptView) !== -1) ? savedDeptView : deptItems[0];
        showDeptContent(page, restoredView);
        finishPageEnter();
        return;
      }

      // Default: show placeholder
      dashboardContent.style.display = '';
      dashboardContent.style.alignItems = '';
      dashboardContent.style.justifyContent = '';
      dashboardContent.style.flexDirection = '';
      dashboardContent.style.height = '';
      dashboardContent.style.gap = '';
      dashboardContent.style.padding = '';

      const placeholder = document.createElement('span');
      placeholder.className = 'page-placeholder';
      placeholder.textContent = page === 'my-view' ? 'My View' : page;
      dashboardContent.appendChild(placeholder);

      finishPageEnter();
    }

    function onExit() { handleExitComplete(); }
    dashboardContent.addEventListener('animationend', onExit);
  }

  // Restore last active page on load
  if (currentPage && currentPage !== 'my-view') {
    var savedItem = document.querySelector('.nav-item[data-page="' + currentPage + '"]');
    if (savedItem) {
      savedItem.click();
    }
  }

  // ── Phase 6: Global nav unread badge for Messaging ──────────
  function pollUnreadBadge() {
    var headers = window.getAuthHeaders ? window.getAuthHeaders() : {};
    fetch((window.API_URL || '/api') + '/messaging/unread-count-total', { headers: headers })
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (data) {
        var total = (data && typeof data.total === 'number') ? data.total : 0;
        var badges = document.querySelectorAll('.nav-unread-badge');
        badges.forEach(function (b) {
          b.textContent = total > 99 ? '99+' : String(total);
          b.style.display = total > 0 ? 'inline-flex' : 'none';
        });
      })
      .catch(function () {});
  }
  pollUnreadBadge();
  setInterval(pollUnreadBadge, 60000);
});
