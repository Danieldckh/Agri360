document.addEventListener('DOMContentLoaded', () => {
  // Restore saved style overrides (skip text color vars — those are managed by applySettings in styles-page.js)
  const savedOverrides = JSON.parse(localStorage.getItem('proagri-style-overrides') || '{}');
  const themeManaged = ['--text-primary', '--text-secondary', '--text-muted'];
  Object.keys(savedOverrides).forEach(key => {
    if (themeManaged.indexOf(key) === -1) {
      document.documentElement.style.setProperty(key, savedOverrides[key]);
    }
  });

  const sidebar = document.getElementById('sidebar');
  const collapseBtn = document.getElementById('collapseBtn');
  const dashboardContent = document.getElementById('dashboardContent');
  const navItems = document.querySelectorAll('.nav-item');
  let isTransitioning = false;
  let currentPage = 'my-view';

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
      if (currentActive === item || isTransitioning) return;

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
    'admin': ['Proposal', 'Booking Form', 'Onboarding', 'Onboarded', 'Declined Proposal'],
    'production': ['Action Board', 'Overview', 'Follow Ups'],
    'design': ['Content Calendars', 'Magazine', 'Agri for All', 'Web Design', 'Own SM', 'Internal Tasks', 'Proposals'],
    'editorial': ['Content Calendars', 'Agri for All', 'Magazine', 'Online Articles'],
    'video': ['Dashboard', 'Calendar', 'Tasks', 'Budgets', 'Team & Freelancers'],
    'agri4all': ['Listings', 'Newsletters', 'Social Media', 'Banners'],
    'social-media': ['Dashboard', 'Content Calendars', 'Agri for All', 'Stats', 'Settings']
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
  }

  function restoreSidebarCollapsed() {
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
          if (currentDeptView === viewName) return;
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

  function showDeptContent(page, viewName) {
    while (dashboardContent.firstChild) {
      dashboardContent.removeChild(dashboardContent.firstChild);
    }
    var placeholder = document.createElement('span');
    placeholder.className = 'page-placeholder';
    placeholder.textContent = (deptNames[page] || page) + ' Department - ' + viewName;
    dashboardContent.appendChild(placeholder);
    dashboardContent.style.display = '';
    dashboardContent.style.alignItems = '';
    dashboardContent.style.justifyContent = '';
    dashboardContent.style.flexDirection = '';
    dashboardContent.style.height = '';
    dashboardContent.style.gap = '';
    dashboardContent.style.padding = '';
  }

  function rebindNavItems() {
    var items = document.querySelectorAll('.nav-item[data-page]');
    items.forEach(function (item) {
      item.addEventListener('click', function () {
        var currentActive = document.querySelector('.nav-item.active');
        if (currentActive === item || isTransitioning) return;

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

      if (page === 'employees') {
        renderEmployeeSection(dashboardContent);
        dashboardContent.classList.add('page-enter');
        dashboardContent.addEventListener('animationend', function onEnter() {
          dashboardContent.removeEventListener('animationend', onEnter);
          dashboardContent.classList.remove('page-enter');
          isTransitioning = false;
        });
        return;
      }

      if (page === 'messaging') {
        if (window.activateMessagingSidebar) window.activateMessagingSidebar();
        if (window.renderMessagingSection) window.renderMessagingSection(dashboardContent);
        dashboardContent.classList.add('page-enter');
        dashboardContent.addEventListener('animationend', function onEnter() {
          dashboardContent.removeEventListener('animationend', onEnter);
          dashboardContent.classList.remove('page-enter');
          isTransitioning = false;
        });
        return;
      }

      if (page === 'styles') {
        if (window.renderStylesPage) window.renderStylesPage(dashboardContent);
        dashboardContent.classList.add('page-enter');
        dashboardContent.addEventListener('animationend', function onEnter() {
          dashboardContent.removeEventListener('animationend', onEnter);
          dashboardContent.classList.remove('page-enter');
          isTransitioning = false;
        });
        return;
      }

      if (page === 'components') {
        if (window.renderComponentsPage) window.renderComponentsPage(dashboardContent);
        dashboardContent.classList.add('page-enter');
        dashboardContent.addEventListener('animationend', function onEnter() {
          dashboardContent.removeEventListener('animationend', onEnter);
          dashboardContent.classList.remove('page-enter');
          isTransitioning = false;
        });
        return;
      }

      if (page === 'database') {
        if (window.renderDatabasePage) window.renderDatabasePage(dashboardContent);
        dashboardContent.classList.add('page-enter');
        dashboardContent.addEventListener('animationend', function onEnter() {
          dashboardContent.removeEventListener('animationend', onEnter);
          dashboardContent.classList.remove('page-enter');
          isTransitioning = false;
        });
        return;
      }

      if (page === 'client-list') {
        if (window.renderClientListPage) window.renderClientListPage(dashboardContent);
        dashboardContent.classList.add('page-enter');
        dashboardContent.addEventListener('animationend', function onEnter() {
          dashboardContent.removeEventListener('animationend', onEnter);
          dashboardContent.classList.remove('page-enter');
          isTransitioning = false;
        });
        return;
      }

      if (deptPages.indexOf(page) !== -1) {
        showDeptSubMenu(page);
        var deptItems = deptMenuItems[page] || ['Overview'];
        var savedDeptView = localStorage.getItem('proagri-dept-tab-' + page);
        var restoredView = (savedDeptView && deptItems.indexOf(savedDeptView) !== -1) ? savedDeptView : deptItems[0];
        showDeptContent(page, restoredView);
        dashboardContent.classList.add('page-enter');
        dashboardContent.addEventListener('animationend', function onEnter() {
          dashboardContent.removeEventListener('animationend', onEnter);
          dashboardContent.classList.remove('page-enter');
          isTransitioning = false;
        });
        return;
      }

      // Reset container styles for other pages
      dashboardContent.style.display = '';
      dashboardContent.style.alignItems = '';
      dashboardContent.style.justifyContent = '';
      dashboardContent.style.flexDirection = '';
      dashboardContent.style.height = '';
      dashboardContent.style.gap = '';
      dashboardContent.style.padding = '';

      const placeholder = document.createElement('span');
      placeholder.className = 'page-placeholder';

      switch (page) {
        case 'my-view':
          placeholder.textContent = 'My View';
          break;
        default:
          placeholder.textContent = page;
      }

      dashboardContent.appendChild(placeholder);

      dashboardContent.classList.add('page-enter');
      dashboardContent.addEventListener('animationend', function onEnter() {
        dashboardContent.removeEventListener('animationend', onEnter);
        dashboardContent.classList.remove('page-enter');
        isTransitioning = false;
      });
    }

    function onExit() { handleExitComplete(); }
    dashboardContent.addEventListener('animationend', onExit);
  }
});
