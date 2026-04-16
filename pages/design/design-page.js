(function () {
  'use strict';

  // ── Design Department Page ────────────────────────────────────────
  // Design's tabs live in the SIDEBAR (via deptMenuItems['design']).
  // This file only exposes per-tab renderers which `ui/js/app.js`
  // dispatches from its showDeptContent() routing layer.
  //
  // The Content Calendars tab reuses production-page's own split-sheet
  // helper so the sheets look IDENTICAL to Production's Deliverables
  // sub-tab (same `.prod-deliv-*` DOM, same CC dashboard on eye click).
  // ─────────────────────────────────────────────────────────────────

  function renderDesignContentCalendarsTab(container) {
    if (typeof window.renderSplitSheetTab !== 'function') {
      console.warn('[design] window.renderSplitSheetTab not loaded yet');
      return;
    }
    var C = window.prodCols;
    // Marker class so design-page.css can override the split ratio to 70/30.
    // Client group headers are hidden via hideClientGroups: true below.
    container.classList.add('design-cc-split-70-30');

    window.renderSplitSheetTab(container, {
      prefix: 'designCC',
      deptSlug: 'design',
      hideClientGroups: true,
      left: {
        title: 'Design',
        searchPlaceholder: 'Search design...',
        // Design-side: both in-progress design and client-requested changes.
        filter: function (d) {
          return d.type === 'sm-content-calendar' &&
            (d.status === 'design' || d.status === 'design_changes');
        },
        columns: [
          C.eye(container),
          C.deptAvatar('design'),
          C.type(),
          C.status(),
          // Default chain-previous back + auto-advance forward.
          C.actionAdvanceBack('auto')
        ],
        emptyMessage: 'No content calendars in design'
      },
      right: {
        title: 'Design Review',
        searchPlaceholder: 'Search design review...',
        filter: function (d) {
          return d.type === 'sm-content-calendar' && d.status === 'design_review';
        },
        columns: [
          C.eye(container),
          C.deptAvatar('design'),
          C.type(),
          C.status(),
          C.actionAdvanceBack('auto')
        ],
        emptyMessage: 'No content calendars in design review'
      }
    });
  }

  window.renderDesignContentCalendarsTab = renderDesignContentCalendarsTab;

  function renderDesignAgriForAllTab(container) {
    if (typeof window.renderSplitSheetTab !== 'function') {
      console.warn('[design] window.renderSplitSheetTab not loaded yet');
      return;
    }
    var C = window.prodCols;
    var A4A_DESIGN_TYPES = {
      'agri4all-posts': true,
      'agri4all-videos': true,
      'agri4all-product-uploads': true,
      'agri4all-newsletters': true,
      'agri4all-newsletter-feature': true,
      'agri4all-newsletter-banner': true,
      'agri4all-banners': true
    };
    container.classList.add('design-cc-split-70-30');

    window.renderSplitSheetTab(container, {
      prefix: 'designA4A',
      deptSlug: 'design',
      hideClientGroups: true,
      left: {
        title: 'Design',
        searchPlaceholder: 'Search design...',
        filter: function (d) {
          return !!A4A_DESIGN_TYPES[d.type] &&
            (d.status === 'design' || d.status === 'design_changes');
        },
        columns: [
          C.eye(container),
          C.deptAvatar('design'),
          { key:'clientName', label:'Client', className:'prod-deliv-client', render: function(r){ var n = r.clientName || r.client_name || ''; var span = document.createElement('span'); span.className = 'design-a4a-client-name'; span.textContent = n; return span; } },
          C.type(),
          C.actionAdvance('auto')
        ],
        emptyMessage: 'No Agri4All posts in design'
      },
      right: {
        title: 'Design Review',
        searchPlaceholder: 'Search design review...',
        filter: function (d) {
          return !!A4A_DESIGN_TYPES[d.type] && d.status === 'design_review';
        },
        columns: [
          C.eye(container),
          C.deptAvatar('design'),
          { key:'clientName', label:'Client', className:'prod-deliv-client', render: function(r){ var n = r.clientName || r.client_name || ''; var span = document.createElement('span'); span.className = 'design-a4a-client-name'; span.textContent = n; return span; } },
          C.type(),
          C.actionAdvance('auto')
        ],
        emptyMessage: 'No Agri4All posts in design review'
      }
    });
  }

  window.renderDesignAgriForAllTab = renderDesignAgriForAllTab;

  // ── Design > Web Design Tab ───────────────────────────────────────
  // Flat sheet of website-design deliverables currently routed to the
  // Design department (site map, development, hosting, etc.). The eye
  // icon reuses the Production WD dashboard (exposed as
  // window.openWebsiteDesignDashboard) so clicking a row gives the
  // exact same UX as Production's Deliverables tab.
  //
  // Columns: Design person | Client/title | Pages | Type | Status.
  // Rows are fetched from /api/deliverables/by-type/website-design
  // and filtered client-side to the design-side status set.
  // ─────────────────────────────────────────────────────────────────
  var WD_DESIGN_STATUSES = [
    'site_map', 'development', 'site_development', 'hosting_seo',
    'design_changes', 'complete'
  ];

  var WD_TYPE_LABELS = {
    'website-design-development': 'Website Design and Development',
    'web-redesign': 'Web Redesign',
    'monthly-website-management': 'Monthly Website Management'
  };

  function formatWdTypeLabel(raw) {
    if (raw == null || raw === '') return '—';
    var s = String(raw).toLowerCase().replace(/[\s_]+/g, '-');
    if (WD_TYPE_LABELS[s]) return WD_TYPE_LABELS[s];
    if (s.indexOf('redesign') !== -1) return 'Web Redesign';
    if (s.indexOf('monthly') !== -1 || s.indexOf('management') !== -1) return 'Monthly Website Management';
    if (s.indexOf('website') !== -1 || s.indexOf('design') !== -1) return 'Website Design and Development';
    return String(raw);
  }

  function extractPagesCount(d) {
    var meta = d.metadata || {};
    if (typeof meta === 'string') { try { meta = JSON.parse(meta); } catch (e) { meta = {}; } }
    var bf = d.bookingForm || d.booking_form || {};
    var fd = bf.formData || bf.form_data || {};
    var candidates = [meta.pagesCount, meta.pages_count, meta.number_of_pages, meta.pages,
      fd.pages, fd.numberOfPages, fd.number_of_pages];
    for (var i = 0; i < candidates.length; i++) {
      var v = candidates[i];
      if (v != null && v !== '') return v;
    }
    return '—';
  }

  function extractWdType(d) {
    var meta = d.metadata || {};
    if (typeof meta === 'string') { try { meta = JSON.parse(meta); } catch (e) { meta = {}; } }
    var bf = d.bookingForm || d.booking_form || {};
    var fd = bf.formData || bf.form_data || {};
    return meta.websiteType || meta.website_type
      || fd.websiteType || fd.website_type
      || null;
  }

  function getHeaders() {
    return window.getAuthHeaders ? window.getAuthHeaders() : {};
  }

  function renderDesignWebDesignTab(container) {
    while (container.firstChild) container.removeChild(container.firstChild);
    container.style.display = '';
    container.style.padding = '';

    var card = document.createElement('div');
    card.className = 'dept-sheet-card design-wd-tab-card';

    var header = document.createElement('div');
    header.className = 'dept-sheet-header';
    var titleWrap = document.createElement('div');
    titleWrap.className = 'dept-sheet-title-wrap';
    var h = document.createElement('h3');
    h.className = 'dept-sheet-title';
    h.textContent = 'Web Design';
    titleWrap.appendChild(h);
    var countBadge = document.createElement('span');
    countBadge.className = 'dept-sheet-count';
    countBadge.textContent = '0';
    titleWrap.appendChild(countBadge);
    header.appendChild(titleWrap);

    var searchInput = document.createElement('input');
    searchInput.type = 'text';
    searchInput.className = 'dept-sheet-search';
    searchInput.placeholder = 'Search web design...';
    header.appendChild(searchInput);
    card.appendChild(header);

    var sheetContainer = document.createElement('div');
    sheetContainer.className = 'dept-sheet-container';
    card.appendChild(sheetContainer);
    container.appendChild(card);

    var allRows = [];

    var columns = [
      { key: 'assignedDesign', label: '', type: 'person', editable: true },
      { key: 'client',   label: 'Client / Deliverable', sortable: true, isName: true },
      { key: 'pages',    label: 'Pages', sortable: true, width: 'sm' },
      { key: 'wdType',   label: 'Type', sortable: true },
      { key: 'status',   label: 'Status', sortable: true, type: 'status', options: WD_DESIGN_STATUSES }
    ];

    var leadingActions = [{
      icon: 'M12 4.5C7 4.5 2.73 7.61 1 12c1.73 4.39 6 7.5 11 7.5s9.27-3.11 11-7.5c-1.73-4.39-6-7.5-11-7.5zM12 17c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5zm0-8c-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3-1.34-3-3-3z',
      tooltip: 'View website design dashboard',
      className: 'action-view',
      onClick: function (rowData) {
        if (rowData && rowData.__deliverable && typeof window.openWebsiteDesignDashboard === 'function') {
          window.openWebsiteDesignDashboard(container, rowData.__deliverable);
        } else {
          console.warn('[design] openWebsiteDesignDashboard not available');
        }
      }
    }];

    function mapDeliverableToRow(d) {
      return {
        id: d.id,
        assignedDesign: d.assignedDesign || d.assigned_design || null,
        client: (d.clientName || d.client_name || '') + (d.title ? ' — ' + d.title : ''),
        pages: extractPagesCount(d),
        wdType: formatWdTypeLabel(extractWdType(d)),
        status: d.status,
        __deliverable: d
      };
    }

    function render() {
      var term = (searchInput.value || '').toLowerCase();
      var filtered = term ? allRows.filter(function (r) {
        return columns.some(function (c) {
          var v = r[c.key];
          return v != null && String(v).toLowerCase().indexOf(term) !== -1;
        });
      }) : allRows;
      countBadge.textContent = filtered.length;
      if (window.renderSheet) {
        window.renderSheet(sheetContainer, {
          columns: columns,
          data: filtered,
          searchable: false,
          apiEndpoint: '/deliverables',
          leadingActions: leadingActions,
          onCellSaved: function () { fetchData(); }
        });
      }
    }
    searchInput.addEventListener('input', render);

    function fetchData() {
      var empPromise = window._fetchEmployees ? window._fetchEmployees() : Promise.resolve([]);
      Promise.all([
        empPromise,
        fetch('/api/deliverables/by-type/website-design', { headers: getHeaders() })
          .then(function (r) { return r.ok ? r.json() : []; })
      ]).then(function (results) {
        var items = Array.isArray(results[1]) ? results[1] : [];
        var designSide = items.filter(function (d) {
          return WD_DESIGN_STATUSES.indexOf(d.status) !== -1;
        });
        allRows = designSide.map(mapDeliverableToRow);
        render();
      }).catch(function (err) {
        console.error('[design] Web Design tab fetch error:', err);
        allRows = [];
        render();
      });
    }
    fetchData();
  }

  window.renderDesignWebDesignTab = renderDesignWebDesignTab;
})();
