(function () {
  'use strict';

  var COLUMNS = [
    { key: 'name', label: 'Name', sortable: true, isName: true },
    { key: 'contact_person', label: 'Contact Person', sortable: true },
    { key: 'email', label: 'Email', sortable: true },
    { key: 'phone', label: 'Phone', sortable: true },
    { key: 'status', label: 'Status', sortable: true, type: 'status' }
  ];

  var ASSET_KINDS = [
    { id: 'all', label: 'All' },
    { id: 'form_upload', label: 'Form Uploads' },
    { id: 'cc_post_image', label: 'CC Post Images' },
    { id: 'design', label: 'Designs' },
    { id: 'video', label: 'Videos' },
    { id: 'banner', label: 'Banners' },
    { id: 'other', label: 'Other' }
  ];

  var pageContainer = null;
  var sheetMarkup = null;
  var savedClientNav = null;

  function getHeaders() {
    return window.getAuthHeaders ? window.getAuthHeaders() : {};
  }

  function getPostHeaders() {
    var h = Object.assign({}, getHeaders());
    h['Content-Type'] = 'application/json';
    return h;
  }

  function formatDate(iso) {
    if (!iso) return '';
    try {
      var d = new Date(iso);
      if (isNaN(d.getTime())) return '';
      return d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
    } catch (e) { return ''; }
  }

  function el(tag, className, text) {
    var e = document.createElement(tag);
    if (className) e.className = className;
    if (text != null) e.textContent = text;
    return e;
  }

  function makeSvgIcon(pathD, size) {
    var s = size || 20;
    var svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('width', String(s));
    svg.setAttribute('height', String(s));
    svg.setAttribute('viewBox', '0 0 24 24');
    svg.setAttribute('fill', 'currentColor');
    var path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    path.setAttribute('d', pathD);
    svg.appendChild(path);
    return svg;
  }

  function makeSidebarSep() {
    var sep = document.createElement('div');
    sep.style.height = '1px';
    sep.style.background = 'rgba(128,128,128,0.12)';
    sep.style.margin = '10px 12px';
    return sep;
  }

  // ============================================================
  // LIST / SHEET VIEW
  // ============================================================

  function initClientListPage(container) {
    pageContainer = container;
    sheetMarkup = container.innerHTML;
    renderListView(container);
  }

  function renderListView(container) {
    container.innerHTML = sheetMarkup;

    var sheetEl = container.querySelector('#client-sheet');
    var countEl = container.querySelector('#client-count');
    var searchEl = container.querySelector('#client-search');
    var allClients = [];

    var leadingActions = [
      {
        icon: 'M12 4.5C7 4.5 2.73 7.61 1 12c1.73 4.39 6 7.5 11 7.5s9.27-3.11 11-7.5c-1.73-4.39-6-7.5-11-7.5zM12 17c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5zm0-8c-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3-1.34-3-3-3z',
        tooltip: 'View client dashboard',
        className: 'action-view',
        onClick: function (row) { openClientDetail(row); }
      }
    ];

    var rowActions = [
      {
        icon: 'M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z',
        tooltip: 'Delete client',
        onClick: function (row) {
          if (!confirm('Delete client "' + (row.name || 'Untitled') + '"? This will archive the client.')) return;
          fetch('/api/clients/' + row.id, { method: 'DELETE', headers: getHeaders() })
            .then(function (r) {
              if (!r.ok) throw new Error('Delete failed');
              allClients = allClients.filter(function (c) { return c.id !== row.id; });
              renderSheet();
            })
            .catch(function (e) { alert('Failed to delete client: ' + e.message); });
        }
      }
    ];

    function renderSheet() {
      var term = (searchEl.value || '').toLowerCase();
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
        window.renderSheet(sheetEl, { columns: COLUMNS, data: filtered, leadingActions: leadingActions, rowActions: rowActions });
      }
    }

    var debounceTimer;
    searchEl.addEventListener('input', function () {
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(renderSheet, 200);
    });

    fetch('/api/clients', { headers: getHeaders() })
      .then(function (r) { return r.json(); })
      .then(function (data) {
        allClients = Array.isArray(data) ? data : [];
        renderSheet();
      })
      .catch(function () {
        sheetEl.innerHTML = '<div class="client-empty">Failed to load clients.</div>';
      });
  }

  // ============================================================
  // SIDEBAR — client info panel
  // ============================================================

  var SOCIAL_ICONS = {
    facebook: 'M12 2.04c-5.5 0-10 4.49-10 10.02 0 5 3.66 9.15 8.44 9.9v-7H7.9v-2.9h2.54V9.85c0-2.52 1.49-3.93 3.78-3.93 1.09 0 2.24.2 2.24.2v2.46h-1.26c-1.24 0-1.63.78-1.63 1.57v1.88h2.78l-.45 2.9h-2.33v7a10 10 0 008.44-9.9c0-5.53-4.5-10.02-10-10.02z',
    instagram: 'M7.8 2h8.4C19.4 2 22 4.6 22 7.8v8.4a5.8 5.8 0 01-5.8 5.8H7.8C4.6 22 2 19.4 2 16.2V7.8A5.8 5.8 0 017.8 2zm-.2 2A3.6 3.6 0 004 7.6v8.8C4 18.39 5.61 20 7.6 20h8.8a3.6 3.6 0 003.6-3.6V7.6C20 5.61 18.39 4 16.4 4H7.6zm9.65 1.5a1.25 1.25 0 110 2.5 1.25 1.25 0 010-2.5zM12 7a5 5 0 110 10 5 5 0 010-10zm0 2a3 3 0 100 6 3 3 0 000-6z',
    linkedin: 'M19 3a2 2 0 012 2v14a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h14m-.5 15.5v-5.3a3.26 3.26 0 00-3.26-3.26c-.85 0-1.84.52-2.32 1.3v-1.11h-2.79v8.37h2.79v-4.93c0-.77.62-1.4 1.39-1.4a1.4 1.4 0 011.4 1.4v4.93h2.79M6.88 8.56a1.68 1.68 0 001.68-1.68c0-.93-.75-1.69-1.68-1.69a1.69 1.69 0 00-1.69 1.69c0 .93.76 1.68 1.69 1.68m1.39 9.94v-8.37H5.5v8.37h2.77z',
    twitterX: 'M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z',
    website: 'M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 17.93c-3.95-.49-7-3.85-7-7.93 0-.62.08-1.21.21-1.79L9 15v1c0 1.1.9 2 2 2v1.93zm6.9-2.54c-.26-.81-1-1.39-1.9-1.39h-1v-3c0-.55-.45-1-1-1H8v-2h2c.55 0 1-.45 1-1V7h2c1.1 0 2-.9 2-2v-.41c2.93 1.19 5 4.06 5 7.41 0 2.08-.8 3.97-2.1 5.39z'
  };

  var DEPT_COLORS = {
    admin: '#3b82f6', production: '#8b5cf6', design: '#ec4899',
    editorial: '#f59e0b', video: '#ef4444', agri4all: '#10b981', social_media: '#06b6d4'
  };

  function showClientSidebar(client) {
    var nav = document.querySelector('#sidebar nav');
    if (!nav) return;

    if (window.expandSidebarIfCollapsed) window.expandSidebarIfCollapsed();

    if (!savedClientNav) {
      savedClientNav = nav.cloneNode(true);
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
      var backIcon = el('span', 'nav-icon');
      backIcon.appendChild(makeSvgIcon('M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20v-2z'));
      backItem.appendChild(backIcon);
      backItem.appendChild(el('span', 'nav-label', 'Back'));
      backItem.addEventListener('click', function () {
        hideClientSidebar();
        renderListView(pageContainer);
      });
      nav.appendChild(backItem);

      // Client avatar + name
      var section = el('div', 'cc-sidebar-section');
      var avatar = el('div', 'cc-sidebar-avatar');
      var clientName = client.companyName || client.name || client.company_name || 'Client';
      avatar.textContent = clientName.substring(0, 2).toUpperCase();
      section.appendChild(avatar);
      section.appendChild(el('div', 'cc-sidebar-client-name', clientName));
      var statusText = (client.status || 'active').replace(/_/g, ' ');
      statusText = statusText.charAt(0).toUpperCase() + statusText.slice(1);
      if (client.industryExpertise) statusText = client.industryExpertise + ' \u2022 ' + statusText;
      section.appendChild(el('div', 'cc-sidebar-meta', statusText));
      nav.appendChild(section);

      nav.appendChild(makeSidebarSep());

      // Contact Info
      var contactInfo = [];
      var cp = client.contactPerson || client.contact_person;
      if (cp) contactInfo.push({ label: 'Contact', value: cp });
      if (client.email) contactInfo.push({ label: 'Email', value: client.email });
      if (client.phone) contactInfo.push({ label: 'Phone', value: client.phone });
      if (client.tradingName) contactInfo.push({ label: 'Trading As', value: client.tradingName });
      if (client.vatNumber) contactInfo.push({ label: 'VAT', value: client.vatNumber });

      if (contactInfo.length) {
        nav.appendChild(el('div', 'cc-sidebar-label', 'Contact Info'));
        var infoList = el('div', 'cc-sidebar-info-list');
        contactInfo.forEach(function (info) {
          var row = el('div', 'cc-sidebar-info-row');
          row.appendChild(el('span', 'cc-sidebar-info-label', info.label));
          row.appendChild(el('span', 'cc-sidebar-info-value', info.value));
          infoList.appendChild(row);
        });
        nav.appendChild(infoList);
        nav.appendChild(makeSidebarSep());
      }

      // Social Links
      var socials = [];
      if (client.facebook) socials.push({ name: 'Facebook', icon: SOCIAL_ICONS.facebook, url: client.facebook });
      if (client.instagram) socials.push({ name: 'Instagram', icon: SOCIAL_ICONS.instagram, url: client.instagram });
      if (client.linkedin) socials.push({ name: 'LinkedIn', icon: SOCIAL_ICONS.linkedin, url: client.linkedin });
      if (client.twitterX) socials.push({ name: 'X', icon: SOCIAL_ICONS.twitterX, url: client.twitterX });
      if (client.website) socials.push({ name: 'Website', icon: SOCIAL_ICONS.website, url: client.website });

      if (socials.length) {
        nav.appendChild(el('div', 'cc-sidebar-label', 'Social Links'));
        var socialList = el('div', 'cc-sidebar-social-list');
        socials.forEach(function (s) {
          var link = document.createElement('a');
          link.className = 'cc-sidebar-social-link';
          link.href = s.url;
          link.target = '_blank';
          link.rel = 'noopener';
          link.title = s.name;
          link.appendChild(makeSvgIcon(s.icon, 18));
          link.appendChild(el('span', null, s.name));
          socialList.appendChild(link);
        });
        nav.appendChild(socialList);
        nav.appendChild(makeSidebarSep());
      }

      // Team Members — fetched from deliverable assignments
      nav.appendChild(el('div', 'cc-sidebar-label', 'Team'));
      var teamList = el('div', 'cc-sidebar-team-list');
      teamList.appendChild(el('div', 'cc-sidebar-meta', 'Loading\u2026'));
      nav.appendChild(teamList);

      loadTeamMembers(client.id, teamList);

      nav.style.opacity = '1';
    }, 200);
  }

  function loadTeamMembers(clientId, teamList) {
    var empPromise = window._fetchEmployees ? window._fetchEmployees() : Promise.resolve([]);
    // Fetch booking forms, then deliverables for each
    var bfPromise = fetch('/api/booking-forms', { headers: getHeaders() })
      .then(function (r) { return r.ok ? r.json() : []; })
      .then(function (forms) {
        var clientForms = forms.filter(function (f) {
          return f.clientId === clientId || f.client_id === clientId;
        });
        if (clientForms.length === 0) return [];
        var delivPromises = clientForms.map(function (f) {
          return fetch('/api/deliverables/by-booking/' + f.id, { headers: getHeaders() })
            .then(function (r) { return r.ok ? r.json() : []; })
            .catch(function () { return []; });
        });
        return Promise.all(delivPromises).then(function (arrays) {
          var all = [];
          arrays.forEach(function (a) { all = all.concat(a); });
          return all;
        });
      })
      .catch(function () { return []; });

    Promise.all([empPromise, bfPromise]).then(function (results) {
      var employees = results[0] || [];
      var deliverables = results[1] || [];

      // Collect unique assigned employee IDs across all dept slots
      var assignedIds = {};
      var SLOTS = [
        { field: 'assignedAdmin', label: 'Admin', color: DEPT_COLORS.admin },
        { field: 'assignedProduction', label: 'Production', color: DEPT_COLORS.production },
        { field: 'assignedDesign', label: 'Design', color: DEPT_COLORS.design },
        { field: 'assignedEditorial', label: 'Editorial', color: DEPT_COLORS.editorial },
        { field: 'assignedVideo', label: 'Video', color: DEPT_COLORS.video },
        { field: 'assignedAgri4all', label: 'Agri4All', color: DEPT_COLORS.agri4all },
        { field: 'assignedSocialMedia', label: 'Social Media', color: DEPT_COLORS.social_media }
      ];

      deliverables.forEach(function (d) {
        SLOTS.forEach(function (slot) {
          var id = d[slot.field];
          if (id && !assignedIds[id]) {
            assignedIds[id] = slot;
          }
        });
      });

      var empMap = {};
      employees.forEach(function (e) { empMap[e.id] = e; });

      while (teamList.firstChild) teamList.removeChild(teamList.firstChild);

      var ids = Object.keys(assignedIds);
      if (ids.length === 0) {
        teamList.appendChild(el('div', 'cc-sidebar-meta', 'No team assigned'));
        return;
      }

      ids.forEach(function (id) {
        var emp = empMap[Number(id)];
        if (!emp) return;
        var slot = assignedIds[id];
        var row = el('div', 'cc-sidebar-team-member');
        var avatar = el('span', 'cc-sidebar-team-avatar');
        avatar.style.background = slot.color;
        var fn = emp.first_name || emp.firstName || '';
        var ln = emp.last_name || emp.lastName || '';
        avatar.textContent = ((fn[0] || '') + (ln[0] || '')).toUpperCase() || '?';
        if (emp.photo_url || emp.photoUrl) {
          var img = document.createElement('img');
          img.src = emp.photo_url || emp.photoUrl;
          img.alt = fn + ' ' + ln;
          img.style.cssText = 'width:100%;height:100%;object-fit:cover;border-radius:50%;';
          avatar.textContent = '';
          avatar.appendChild(img);
        }
        row.appendChild(avatar);
        var info = el('div', 'cc-sidebar-team-info');
        info.appendChild(el('div', 'cc-sidebar-team-name', (fn + ' ' + ln).trim() || emp.username || 'Unknown'));
        info.appendChild(el('div', 'cc-sidebar-team-role', slot.label));
        row.appendChild(info);
        teamList.appendChild(row);
      });
    });
  }

  function hideClientSidebar() {
    var nav = document.querySelector('#sidebar nav');
    if (!nav || !savedClientNav) return;

    nav.style.transition = 'opacity 0.2s ease';
    nav.style.opacity = '0';

    setTimeout(function () {
      while (nav.firstChild) nav.removeChild(nav.firstChild);
      while (savedClientNav.firstChild) {
        nav.appendChild(savedClientNav.firstChild);
      }
      savedClientNav = null;
      nav.style.opacity = '1';

      if (window.restoreSidebarCollapsed) window.restoreSidebarCollapsed();
      if (window.rebindNavItems) window.rebindNavItems();
    }, 200);
  }

  // ============================================================
  // CLIENT DETAIL VIEW
  // ============================================================

  function openClientDetail(row) {
    if (!pageContainer || !row || row.id == null) return;
    fetch('/api/clients/' + encodeURIComponent(row.id), { headers: getHeaders() })
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (client) {
        renderClientDetail(client || row);
      })
      .catch(function () {
        renderClientDetail(row);
      });
  }

  function renderClientDetail(client) {
    var state = { client: client, activeTab: 'details' };

    // Show sidebar with client info
    showClientSidebar(client);

    pageContainer.innerHTML = '';
    var page = el('div', 'client-detail-page');

    // Header — no back button needed (sidebar has it), just title + tabs
    var header = el('div', 'client-detail-header client-detail-header-no-back');
    var title = el('h2', 'client-detail-title',
      client.companyName || client.name || client.company_name || 'Client');
    header.appendChild(title);

    var tabs = el('nav', 'client-detail-tabs');
    var detailsTab = el('button', 'tab active', 'Details');
    detailsTab.type = 'button';
    var libraryTab = el('button', 'tab', 'Library');
    libraryTab.type = 'button';
    tabs.appendChild(detailsTab);
    tabs.appendChild(libraryTab);
    header.appendChild(tabs);

    page.appendChild(header);

    var content = el('div', 'client-detail-content');
    page.appendChild(content);

    pageContainer.appendChild(page);

    function switchTab(which) {
      state.activeTab = which;
      detailsTab.classList.toggle('active', which === 'details');
      libraryTab.classList.toggle('active', which === 'library');
      content.innerHTML = '';
      if (which === 'details') {
        content.appendChild(buildDetailsPane(state));
      } else {
        content.appendChild(buildLibraryPane(state));
      }
    }

    detailsTab.addEventListener('click', function () { switchTab('details'); });
    libraryTab.addEventListener('click', function () { switchTab('library'); });

    switchTab('details');
  }

  function buildDetailsPane(state) {
    var client = state.client;
    var pane = el('div', 'client-details-pane');

    // Company Information card
    var companyCard = el('div', 'client-details-card');
    companyCard.appendChild(el('h3', 'client-details-subheader', 'Company'));
    var companyFields = [
      { key: 'companyName', label: 'Company Name', fallbackKey: 'name' },
      { key: 'tradingName', label: 'Trading Name' },
      { key: 'companyRegNo', label: 'Registration No.' },
      { key: 'vatNumber', label: 'VAT Number' },
      { key: 'industryExpertise', label: 'Industry' },
      { key: 'website', label: 'Website', type: 'url' }
    ];
    companyFields.forEach(function (f) {
      companyCard.appendChild(buildFieldRow(client, f));
    });
    pane.appendChild(companyCard);

    // Primary Contact card
    var contactCard = el('div', 'client-details-card');
    contactCard.appendChild(el('h3', 'client-details-subheader', 'Primary Contact'));
    var contactFields = [
      { key: 'contactPerson', label: 'Name', fallbackKey: 'contact_person' },
      { key: 'email', label: 'Email', type: 'email' },
      { key: 'phone', label: 'Phone', type: 'tel' }
    ];
    contactFields.forEach(function (f) {
      contactCard.appendChild(buildFieldRow(client, f));
    });
    pane.appendChild(contactCard);

    // Address card
    var addressCard = el('div', 'client-details-card');
    addressCard.appendChild(el('h3', 'client-details-subheader', 'Address'));
    var addressFields = [
      { key: 'physicalAddress', label: 'Physical Address' },
      { key: 'physicalPostalCode', label: 'Postal Code' },
      { key: 'postalAddress', label: 'Postal Address' },
      { key: 'postalCode', label: 'PO Box Code' }
    ];
    addressFields.forEach(function (f) {
      addressCard.appendChild(buildFieldRow(client, f));
    });
    pane.appendChild(addressCard);

    // Social Media card
    var socialCard = el('div', 'client-details-card');
    socialCard.appendChild(el('h3', 'client-details-subheader', 'Social Media'));
    var socialFields = [
      { key: 'instagram', label: 'Instagram', type: 'url' },
      { key: 'facebook', label: 'Facebook', type: 'url' },
      { key: 'linkedin', label: 'LinkedIn', type: 'url' },
      { key: 'twitterX', label: 'X (Twitter)', type: 'url' }
    ];
    socialFields.forEach(function (f) {
      socialCard.appendChild(buildFieldRow(client, f));
    });
    pane.appendChild(socialCard);

    return pane;
  }

  function buildFieldRow(client, f) {
    var row = el('div', 'client-details-field');
    var label = el('label', 'client-details-label', f.label);
    var input = document.createElement('input');
    input.type = f.type || 'text';
    input.className = 'client-details-input';
    var val = client[f.key];
    if ((val == null || val === '') && f.fallbackKey) {
      val = client[f.fallbackKey];
    }
    input.value = val == null ? '' : val;

    input.addEventListener('blur', function () {
      var newVal = input.value.trim();
      var oldVal = client[f.key] == null ? '' : client[f.key];
      if (newVal === oldVal) return;
      saveField(client.id, f.key, newVal, input, function (ok) {
        if (ok) client[f.key] = newVal;
      });
    });

    row.appendChild(label);
    row.appendChild(input);
    return row;
  }

  function saveField(clientId, key, value, inputEl, done) {
    var body = {};
    body[key] = value;
    inputEl.classList.remove('saved', 'error');
    fetch('/api/clients/' + encodeURIComponent(clientId), {
      method: 'PATCH',
      headers: getPostHeaders(),
      body: JSON.stringify(body)
    })
      .then(function (r) {
        if (!r.ok) throw new Error('PATCH failed: ' + r.status);
        return r.json().catch(function () { return null; });
      })
      .then(function () {
        inputEl.classList.add('saved');
        setTimeout(function () { inputEl.classList.remove('saved'); }, 1200);
        if (done) done(true);
      })
      .catch(function (err) {
        console.error('[client-list] save failed', err);
        inputEl.classList.add('error');
        if (done) done(false);
      });
  }

  // ============================================================
  // LIBRARY TAB
  // ============================================================

  function buildLibraryPane(state) {
    var pane = el('div', 'client-library');

    var toolbar = el('div', 'client-library-toolbar');
    var filters = el('div', 'client-library-filters');
    var count = el('div', 'client-library-count', '0 assets');

    var currentKind = 'all';
    var assets = [];

    ASSET_KINDS.forEach(function (k) {
      var btn = el('button', 'chip' + (k.id === 'all' ? ' active' : ''), k.label);
      btn.type = 'button';
      btn.dataset.kind = k.id;
      btn.addEventListener('click', function () {
        currentKind = k.id;
        filters.querySelectorAll('.chip').forEach(function (c) { c.classList.remove('active'); });
        btn.classList.add('active');
        renderGrid();
      });
      filters.appendChild(btn);
    });

    toolbar.appendChild(filters);
    toolbar.appendChild(count);
    pane.appendChild(toolbar);

    var grid = el('div', 'client-library-grid');
    pane.appendChild(grid);

    function renderGrid() {
      grid.innerHTML = '';
      var filtered = currentKind === 'all'
        ? assets
        : assets.filter(function (a) { return a.kind === currentKind; });

      count.textContent = filtered.length + ' asset' + (filtered.length === 1 ? '' : 's');

      if (!filtered.length) {
        var empty = el('div', 'client-library-empty', 'No assets in this category');
        grid.appendChild(empty);
        return;
      }

      filtered.forEach(function (asset) {
        grid.appendChild(buildLibraryCard(asset, function () { loadAssets(); }));
      });
    }

    function loadAssets() {
      grid.innerHTML = '';
      var loading = el('div', 'client-library-empty', 'Loading\u2026');
      grid.appendChild(loading);

      fetch('/api/client-assets?clientId=' + encodeURIComponent(state.client.id), { headers: getHeaders() })
        .then(function (r) { return r.ok ? r.json() : []; })
        .then(function (data) {
          assets = Array.isArray(data) ? data : [];
          renderGrid();
        })
        .catch(function (err) {
          console.error('[client-list] asset load failed', err);
          grid.innerHTML = '';
          grid.appendChild(el('div', 'client-library-empty', 'Failed to load assets.'));
        });
    }

    loadAssets();
    return pane;
  }

  function kindLabel(kind) {
    for (var i = 0; i < ASSET_KINDS.length; i++) {
      if (ASSET_KINDS[i].id === kind) return ASSET_KINDS[i].label;
    }
    return kind || 'Asset';
  }

  function buildLibraryCard(asset, onDeleted) {
    var card = el('div', 'library-card');

    var thumbWrap = el('div', 'library-card-thumb');
    var img = document.createElement('img');
    img.src = asset.thumbnailUrl || asset.url || '';
    img.alt = kindLabel(asset.kind);
    img.loading = 'lazy';
    img.addEventListener('error', function () {
      thumbWrap.classList.add('no-image');
      img.style.display = 'none';
    });
    thumbWrap.appendChild(img);
    thumbWrap.addEventListener('click', function () { openLightbox(asset.url || asset.thumbnailUrl); });
    card.appendChild(thumbWrap);

    var meta = el('div', 'library-card-meta');
    meta.appendChild(el('span', 'library-card-kind', kindLabel(asset.kind)));
    meta.appendChild(el('span', 'library-card-date', formatDate(asset.uploadedAt)));
    card.appendChild(meta);

    var actions = el('div', 'library-card-actions');
    var dl = document.createElement('a');
    dl.className = 'download';
    dl.href = asset.url || '#';
    dl.setAttribute('download', '');
    dl.target = '_blank';
    dl.rel = 'noopener';
    dl.title = 'Download';
    dl.innerHTML = '\u2193';
    dl.addEventListener('click', function (e) { e.stopPropagation(); });
    actions.appendChild(dl);

    var del = el('button', 'delete-asset', '\u2715');
    del.type = 'button';
    del.title = 'Delete asset';
    del.addEventListener('click', function (e) {
      e.stopPropagation();
      if (!confirm('Delete this asset? This cannot be undone.')) return;
      fetch('/api/client-assets/' + encodeURIComponent(asset.id), {
        method: 'DELETE',
        headers: getHeaders()
      })
        .then(function (r) {
          if (!r.ok) throw new Error('DELETE failed: ' + r.status);
          if (onDeleted) onDeleted();
        })
        .catch(function (err) {
          console.error('[client-list] asset delete failed', err);
          alert('Failed to delete asset.');
        });
    });
    actions.appendChild(del);

    card.appendChild(actions);
    return card;
  }

  function openLightbox(src) {
    if (!src) return;
    var overlay = el('div', 'client-lightbox');
    var img = document.createElement('img');
    img.className = 'client-lightbox-img';
    img.src = src;
    var close = el('button', 'client-lightbox-close', '\u2715');
    close.type = 'button';
    function dismiss() {
      if (overlay.parentNode) overlay.parentNode.removeChild(overlay);
      document.removeEventListener('keydown', onKey);
    }
    function onKey(e) { if (e.key === 'Escape') dismiss(); }
    overlay.addEventListener('click', function (e) { if (e.target === overlay) dismiss(); });
    close.addEventListener('click', dismiss);
    document.addEventListener('keydown', onKey);
    overlay.appendChild(img);
    overlay.appendChild(close);
    document.body.appendChild(overlay);
  }

  window.initClientListPage = initClientListPage;
})();
