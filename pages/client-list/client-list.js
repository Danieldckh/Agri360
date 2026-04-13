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

  // ============================================================
  // LIST / SHEET VIEW
  // ============================================================

  function initClientListPage(container) {
    pageContainer = container;
    // Cache the sheet HTML so we can restore it after returning from detail view.
    sheetMarkup = container.innerHTML;
    renderListView(container);
  }

  function renderListView(container) {
    // Restore cached markup so the original static shell is back in place.
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
        window.renderSheet(sheetEl, { columns: COLUMNS, data: filtered, leadingActions: leadingActions });
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
  // FEATURE A — CLIENT DETAIL / EDIT
  // ============================================================

  function openClientDetail(row) {
    if (!pageContainer || !row || row.id == null) return;
    // Fetch the full client record so we have the camelCase social fields.
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

    pageContainer.innerHTML = '';
    var page = el('div', 'client-detail-page');

    // Header
    var header = el('div', 'client-detail-header');
    var backBtn = el('button', 'client-detail-back', '\u2190 Back');
    backBtn.type = 'button';
    backBtn.addEventListener('click', function () { renderListView(pageContainer); });
    header.appendChild(backBtn);

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
    var card = el('div', 'client-details-card');

    var fields = [
      { group: 'Company', key: 'companyName', label: 'Company Name', fallbackKey: 'name' },
      { group: 'Contact', key: 'contactPerson', label: 'Primary Contact Name', fallbackKey: 'contact_person' },
      { group: 'Contact', key: 'email', label: 'Email', type: 'email' },
      { group: 'Contact', key: 'phone', label: 'Phone', type: 'tel' },
      { group: 'Web', key: 'website', label: 'Website', type: 'url' },
      { group: 'Social', key: 'instagram', label: 'Instagram', type: 'url' },
      { group: 'Social', key: 'facebook', label: 'Facebook', type: 'url' },
      { group: 'Social', key: 'linkedin', label: 'LinkedIn', type: 'url' },
      { group: 'Social', key: 'twitterX', label: 'X (Twitter)', type: 'url' }
    ];

    var currentGroup = null;
    fields.forEach(function (f) {
      if (f.group !== currentGroup) {
        currentGroup = f.group;
        var sub = el('h3', 'client-details-subheader', currentGroup);
        card.appendChild(sub);
      }

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
      card.appendChild(row);
    });

    pane.appendChild(card);
    return pane;
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
  // FEATURE B — LIBRARY TAB
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
