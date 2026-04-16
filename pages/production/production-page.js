(function () {
  'use strict';

  var API_BASE = '/api/deliverables';

  // ── Month selector helper ────────────────────────
  function initMonthSelector(container, ids, deptSlug, onMonthChange) {
    var prevBtn = container.querySelector('#' + ids.prev);
    var nextBtn = container.querySelector('#' + ids.next);
    var label = container.querySelector('#' + ids.label);

    var MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December'];

    // Current month as YYYY-MM
    var now = new Date();
    var currentYear = now.getFullYear();
    var currentMonth = now.getMonth() + 1; // 1-based

    function pad(n) { return n < 10 ? '0' + n : '' + n; }
    function getYM() { return currentYear + '-' + pad(currentMonth); }
    function formatLabel() { return MONTH_NAMES[currentMonth - 1] + ' ' + currentYear; }

    function updateUI() {
      label.textContent = formatLabel();
    }

    function stepMonth(delta) {
      currentMonth += delta;
      if (currentMonth > 12) { currentMonth = 1; currentYear++; }
      if (currentMonth < 1) { currentMonth = 12; currentYear--; }
      updateUI();
      onMonthChange(getYM());
    }

    prevBtn.addEventListener('click', function () { stepMonth(-1); });
    nextBtn.addEventListener('click', function () { stepMonth(1); });

    // Initialize with current month
    updateUI();
    onMonthChange(getYM());

    return {
      getCurrentMonth: function () { return getYM(); }
    };
  }
  window.initMonthSelector = initMonthSelector;

  // SVG icons
  var ICON_ADVANCE = 'M12 4l-1.41 1.41L16.17 11H4v2h12.17l-5.58 5.59L12 20l8-8z';

  // Unified workflows from shared definition
  var workflows = window.DELIVERABLE_WORKFLOWS;

  function getHeaders() {
    var headers = { 'Content-Type': 'application/json' };
    if (window.getAuthHeaders) {
      var auth = window.getAuthHeaders();
      for (var key in auth) {
        if (auth.hasOwnProperty(key)) headers[key] = auth[key];
      }
    }
    return headers;
  }

  var STATUS_LABELS = {
    'agri4all-links': 'Agri4All Links',
    'waiting_for_materials': 'Waiting for Materials',
    'request_client_materials': 'Request Client Materials',
    'ready_for_approval': 'Ready for Approval',
    'sent_for_approval': 'Sent for Approval'
  };

  function formatStatus(status) {
    if (!status) return 'Pending';
    if (STATUS_LABELS[status]) return STATUS_LABELS[status];
    return status.replace(/_/g, ' ').replace(/\b\w/g, function (c) { return c.toUpperCase(); });
  }

  // Maps deliverable type slugs to human-readable labels.
  // Special-cases proper-noun acronyms that title-case wouldn't handle.
  function formatTypeLabel(type) {
    if (!type) return '';
    var s = String(type).toLowerCase();
    var map = {
      'sm-content-calendar': 'Content Calendar',
      'agri4all-posts': 'Agri4All Posts',
      'agri4all-videos': 'Agri4All Videos',
      'agri4all-product-uploads': 'Agri4All Product Uploads',
      'agri4all-newsletters': 'Agri4All Newsletters',
      'agri4all-newsletter-feature': 'Agri4All Newsletter Feature',
      'agri4all-newsletter-banner': 'Agri4All Newsletter Banner',
      'agri4all-linkedin': 'Agri4All LinkedIn',
      'agri4all-banners': 'Agri4All Banners',
      'own-social-posts': 'Own Social Posts',
      'own-social-videos': 'Own Social Videos',
      'own-social-linkedin': 'Own Social LinkedIn',
      'own-social-twitter': 'Own Social Twitter',
      'sm-posts': 'Social Media Posts',
      'sm-videos': 'Social Media Videos',
      'sm-google-ads': 'Google Ads',
      'sm-linkedin': 'Social Media LinkedIn',
      'sm-twitter': 'Social Media Twitter',
      'online-articles': 'Online Article',
      'website-design': 'Website Design',
      'video': 'Video',
      'magazine': 'Magazine',
      'magazine-sa-digital': 'Magazine SA Digital',
      'magazine-africa-print': 'Magazine Africa Print',
      'magazine-africa-digital': 'Magazine Africa Digital',
      'magazine-coffee-table': 'Magazine Coffee Table'
    };
    if (map[s]) return map[s];
    return s.split(/[-_]/).map(function (w) {
      return w.charAt(0).toUpperCase() + w.slice(1);
    }).join(' ');
  }

  // Which deliverable types render a platforms cell in the standard row.
  var SOCIAL_MEDIA_TYPES_WITH_PLATFORMS = {
    'agri4all-posts': true,
    'agri4all-videos': true,
    'own-social-posts': true,
    'own-social-videos': true,
    'sm-posts': true,
    'sm-videos': true
  };

  function formatPlatformLabel(key, deliverableType) {
    var k = String(key || '').toLowerCase();
    var suffix = '';
    if (deliverableType && deliverableType.indexOf('videos') !== -1) suffix = ' Videos';
    else if (deliverableType && deliverableType.indexOf('posts') !== -1) suffix = ' Posts';
    if (k === 'facebook') return 'Facebook' + suffix;
    if (k === 'instagram') return 'Instagram' + suffix;
    if (k === 'instagram_stories') return 'Instagram Stories';
    if (k === 'linkedin') return 'LinkedIn' + suffix;
    if (k === 'twitter' || k === 'twitter_x' || k === 'x') return 'X' + suffix;
    if (k === 'tiktok') return 'TikTok' + suffix;
    return k.charAt(0).toUpperCase() + k.slice(1) + suffix;
  }

  function formatDate(dateStr) {
    if (!dateStr) return '\u2014';
    var d = new Date(dateStr);
    return (d.getMonth() + 1) + '/' + d.getDate() + '/' + d.getFullYear();
  }

  function statusClass(status) {
    var s = (status || 'pending').toLowerCase().replace(/\s+/g, '_');
    return 'proagri-sheet-status-' + s;
  }

  function groupByClient(deliverables) {
    var groups = {};
    var order = [];
    deliverables.forEach(function (d) {
      var name = d.clientName || 'Unknown Client';
      if (!groups[name]) {
        groups[name] = { clientName: name, clientId: d.clientId, items: [] };
        order.push(name);
      }
      groups[name].items.push(d);
    });
    return order.map(function (name) { return groups[name]; });
  }

  var MONTH_NAMES = ['January','February','March','April','May','June','July','August','September','October','November','December'];
  function formatCCMonthYear(deliverable) {
    var dm = deliverable && deliverable.deliveryMonth;
    if (dm) {
      var s = String(dm);
      // YYYY-MM or YYYY-MM-DD
      var m = s.match(/^(\d{4})-(\d{2})/);
      if (m) {
        var mi = parseInt(m[2], 10) - 1;
        if (mi >= 0 && mi < 12) return MONTH_NAMES[mi] + ' ' + m[1];
      }
      // Try Date parse
      var d = new Date(s);
      if (!isNaN(d.getTime())) return MONTH_NAMES[d.getMonth()] + ' ' + d.getFullYear();
    }
    // Fallback: parse from title ("... - Content Calendar - May 2026")
    var t = (deliverable && deliverable.title) || '';
    var tm = t.match(/([A-Za-z]+)\s+(\d{4})\s*$/);
    if (tm) return tm[1].charAt(0).toUpperCase() + tm[1].slice(1).toLowerCase() + ' ' + tm[2];
    return '';
  }

  function makeSvgIcon(pathD) {
    var svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('width', '16');
    svg.setAttribute('height', '16');
    svg.setAttribute('viewBox', '0 0 24 24');
    svg.setAttribute('fill', 'currentColor');
    var path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    path.setAttribute('d', pathD);
    svg.appendChild(path);
    return svg;
  }

  // ── Sort Helpers ───────────────────────────────────────────────

  function formatStatusChanged(dateStr) {
    if (!dateStr) return '\u2014';
    var d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    var now = new Date();
    var diffMs = now - d;
    var diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    var diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    var relative;
    if (diffDays > 0) relative = diffDays + 'd ago';
    else if (diffHours > 0) relative = diffHours + 'h ago';
    else relative = 'just now';
    return formatDate(dateStr) + ' (' + relative + ')';
  }

  function sortItems(items, sortKey, sortDir) {
    if (!sortKey) return items;
    return items.slice().sort(function (a, b) {
      var va = a[sortKey];
      var vb = b[sortKey];
      if (va == null && vb == null) return 0;
      if (va == null) return 1;
      if (vb == null) return -1;
      if (sortKey === 'dueDate' || sortKey === 'statusChangedAt') {
        va = va ? new Date(va).getTime() : 0;
        vb = vb ? new Date(vb).getTime() : 0;
        return sortDir === 'asc' ? va - vb : vb - va;
      }
      if (typeof va === 'number' && typeof vb === 'number') {
        return sortDir === 'asc' ? va - vb : vb - va;
      }
      va = String(va).toLowerCase();
      vb = String(vb).toLowerCase();
      if (va < vb) return sortDir === 'asc' ? -1 : 1;
      if (va > vb) return sortDir === 'asc' ? 1 : -1;
      return 0;
    });
  }

  function makeSortableHeaders(thead, columns, sortState, onSort) {
    var ths = thead.querySelectorAll('th');
    columns.forEach(function (col, i) {
      if (!col.sortKey) return;
      ths[i].classList.add('sortable');
      if (sortState.key === col.sortKey) {
        ths[i].classList.add(sortState.dir === 'asc' ? 'sort-asc' : 'sort-desc');
      }
      ths[i].addEventListener('click', function () {
        if (sortState.key === col.sortKey) {
          sortState.dir = sortState.dir === 'asc' ? 'desc' : 'asc';
        } else {
          sortState.key = col.sortKey;
          sortState.dir = 'asc';
        }
        onSort();
      });
    });
  }

  // ── Helper: load production template and extract a specific <template> by id ──
  var productionTemplateLoaded = null;
  function loadProductionTemplates() {
    if (productionTemplateLoaded) return productionTemplateLoaded;
    productionTemplateLoaded = window.loadTemplate('/pages/production/production.html').then(function (html) {
      var tmp = document.createElement('div');
      tmp.innerHTML = html;
      return tmp;
    });
    return productionTemplateLoaded;
  }

  function cloneTemplateContent(templateContainer, templateId) {
    var tmpl = templateContainer.querySelector('#' + templateId);
    if (tmpl) return tmpl.content.cloneNode(true);
    return null;
  }

  // ── Generic client-grouped sheet renderer ─────────────────────────
  // Shared by all production tabs. Builds a sheet card with grouped-
  // by-client rows, chevron toggles, client-level buttons, and
  // per-cell render callbacks. Two modes:
  //
  // 1. Full mode (default) — builds its own wrapper + month selector
  //    + fetches /api/deliverables/by-department/:slug. Used by the
  //    Production Deliverables tab (one sheet, full width).
  //
  // 2. Embedded mode (skipMonthSelector: true) — builds ONLY the card,
  //    doesn't fetch. Caller passes data via setData(items). Used by
  //    50/50 tabs (Follow Ups, Approvals) where one shared month
  //    selector above drives two sheets below.
  //
  // Returns { refresh(ym), setData(items) }.
  //
  // options: {
  //   title: string,
  //   searchPlaceholder?: string,
  //   deptSlug?: string ('production'),
  //   statusFilter: function(item) => boolean,
  //   columns: [{ label, className?, render?: function(item, refresh) => string|Node }],
  //   emptyMessage?: string,
  //   showClientButtons?: boolean,
  //   skipMonthSelector?: boolean
  // }
  function renderClientGroupedSheet(container, options) {
    options = options || {};
    var title = options.title || 'Sheet';
    var searchPlaceholder = options.searchPlaceholder || 'Search...';
    var statusFilter = options.statusFilter || function () { return true; };
    var deptSlug = options.deptSlug || 'production';
    var columns = options.columns || [];
    var emptyMessage = options.emptyMessage || 'No items to display';
    var showClientButtons = !!options.showClientButtons;
    var skipMonthSelector = !!options.skipMonthSelector;
    var hideClientGroups = !!options.hideClientGroups;

    while (container.firstChild) container.removeChild(container.firstChild);

    var wrapper, prevBtn, nextBtn, monthLabel;
    if (!skipMonthSelector) {
      wrapper = document.createElement('div');
      wrapper.style.cssText = 'width:100%;height:100%;display:flex;flex-direction:column;overflow:hidden;';

      var monthBar = document.createElement('div');
      monthBar.className = 'dept-month-selector';
      var uid = 'cgs_' + Math.random().toString(36).slice(2, 10);
      prevBtn = document.createElement('button');
      prevBtn.id = uid + '_prev';
      prevBtn.className = 'dept-month-nav';
      prevBtn.textContent = '\u25C0';
      monthLabel = document.createElement('span');
      monthLabel.id = uid + '_label';
      monthLabel.className = 'dept-month-label';
      nextBtn = document.createElement('button');
      nextBtn.id = uid + '_next';
      nextBtn.className = 'dept-month-nav';
      nextBtn.textContent = '\u25B6';
      monthBar.appendChild(prevBtn);
      monthBar.appendChild(monthLabel);
      monthBar.appendChild(nextBtn);
      wrapper.appendChild(monthBar);
    } else {
      // Embedded mode — caller owns the wrapper/layout
      wrapper = container;
    }

    // Sheet card — reuse dept-sheet-card styling
    var card = document.createElement('div');
    card.className = 'dept-sheet-card';
    card.style.flex = '1';
    card.style.minHeight = '0';
    card.style.overflow = 'hidden';

    var headerBar = document.createElement('div');
    headerBar.className = 'dept-sheet-header';
    var titleWrap = document.createElement('div');
    titleWrap.className = 'dept-sheet-title-wrap';
    var titleEl = document.createElement('h3');
    titleEl.className = 'dept-sheet-title';
    titleEl.textContent = title;
    titleWrap.appendChild(titleEl);
    var countBadge = document.createElement('span');
    countBadge.className = 'dept-sheet-count';
    countBadge.textContent = '0';
    titleWrap.appendChild(countBadge);
    headerBar.appendChild(titleWrap);

    var searchInput = document.createElement('input');
    searchInput.type = 'text';
    searchInput.className = 'dept-sheet-search';
    searchInput.placeholder = searchPlaceholder;
    headerBar.appendChild(searchInput);
    card.appendChild(headerBar);

    var sheetBody = document.createElement('div');
    sheetBody.style.cssText = 'flex:1;overflow-y:auto;min-height:0;';
    card.appendChild(sheetBody);
    if (skipMonthSelector) {
      // Embedded mode — append card directly to caller-provided container
      container.appendChild(card);
    } else {
      wrapper.appendChild(card);
      container.appendChild(wrapper);
    }

    var allData = [];
    var collapsedClients = {};
    var currentYM = '';

    function renderTable() {
      while (sheetBody.firstChild) sheetBody.removeChild(sheetBody.firstChild);

      var term = (searchInput.value || '').toLowerCase();
      var filtered = allData.filter(statusFilter);
      if (term) {
        filtered = filtered.filter(function (d) {
          return (d.title || '').toLowerCase().indexOf(term) !== -1 ||
            (d.clientName || '').toLowerCase().indexOf(term) !== -1 ||
            (d.status || '').toLowerCase().indexOf(term) !== -1 ||
            (d.type || '').toLowerCase().indexOf(term) !== -1;
        });
      }

      countBadge.textContent = filtered.length;
      var groups = groupByClient(filtered);

      if (groups.length === 0) {
        var empty = document.createElement('div');
        empty.className = 'proagri-sheet-empty';
        empty.style.padding = '40px';
        empty.style.textAlign = 'center';
        empty.style.color = 'var(--text-muted, #999)';
        empty.textContent = emptyMessage;
        sheetBody.appendChild(empty);
        return;
      }

      // Column header row
      var headerRow = document.createElement('div');
      headerRow.className = 'prod-deliv-row prod-deliv-header';
      headerRow.style.display = 'none';
      columns.forEach(function (col) {
        var cell = document.createElement('div');
        cell.className = 'prod-deliv-cell' + (col.className ? ' ' + col.className : '');
        cell.textContent = col.label || '';
        headerRow.appendChild(cell);
      });
      sheetBody.appendChild(headerRow);

      groups.forEach(function (group) {
        var isCollapsed = !!collapsedClients[group.clientName];

        // Client group header row — only rendered when hideClientGroups is false
        if (!hideClientGroups) {
          var clientRow = document.createElement('div');
          clientRow.className = 'prod-deliv-client-row';
          var chevron = document.createElement('span');
          chevron.className = 'prod-deliv-chevron' + (isCollapsed ? ' collapsed' : '');
          chevron.textContent = isCollapsed ? '\u25B6' : '\u25BC';
          clientRow.appendChild(chevron);
          var clientLabel = document.createElement('span');
          clientLabel.className = 'prod-deliv-client-name';
          clientLabel.textContent = group.clientName;
          clientRow.appendChild(clientLabel);
          var clientCount = document.createElement('span');
          clientCount.className = 'prod-deliv-client-count';
          clientCount.textContent = group.items.length;
          clientRow.appendChild(clientCount);

          if (showClientButtons && group.clientId) {
            var spacer = document.createElement('span');
            spacer.style.flex = '1';
            clientRow.appendChild(spacer);

            // Per-deliverable "Request Materials" buttons now live inside each
            // row via colRequestMaterials() — the per-client-group button has
            // been removed so the form can be associated with a specific
            // deliverableId. Only "Open Portal" remains at the client level.

            var portalBtn = document.createElement('button');
            portalBtn.className = 'prod-client-btn prod-client-btn-primary';
            portalBtn.textContent = 'Open Portal';
            (function (cid) {
              portalBtn.addEventListener('click', function (e) {
                e.stopPropagation();
                fetch('/api/portal/get-or-create-token', {
                  method: 'POST',
                  headers: getHeaders(),
                  body: JSON.stringify({ clientId: cid })
                }).then(function (r) { return r.json(); }).then(function (data) {
                  if (data.token) window.open('/client-portal.html?token=' + data.token, '_blank');
                });
              });
            })(group.clientId);
            clientRow.appendChild(portalBtn);
          }

          clientRow.addEventListener('click', function () {
            collapsedClients[group.clientName] = !collapsedClients[group.clientName];
            renderTable();
          });
          sheetBody.appendChild(clientRow);

          // If collapsed, skip item rows for this group
          if (isCollapsed) return;
        }

        group.items.forEach(function (item) {
          var row = document.createElement('div');
          row.className = 'prod-deliv-row';

          // When hideClientGroups is true, prepend a client name cell as the first cell
          if (hideClientGroups) {
            var clientNameCell = document.createElement('div');
            clientNameCell.className = 'prod-deliv-cell prod-deliv-client-name';
            clientNameCell.textContent = item.clientName || '';
            row.appendChild(clientNameCell);
          }

          columns.forEach(function (col) {
            var cell = document.createElement('div');
            cell.className = 'prod-deliv-cell' + (col.className ? ' ' + col.className : '');
            var content = col.render ? col.render(item, refresh) : '';
            if (content == null || content === '') {
              // leave cell empty
            } else if (typeof content === 'string') {
              cell.textContent = content;
            } else if (content.nodeType) {
              cell.appendChild(content);
            }
            row.appendChild(cell);
          });

          sheetBody.appendChild(row);
        });
      });
    }

    function refresh(ym) {
      if (ym) currentYM = ym;
      var url = '/api/deliverables/by-department/' + deptSlug + (currentYM ? '?month=' + currentYM : '');
      var empPromise = window._fetchEmployees ? window._fetchEmployees() : Promise.resolve([]);
      Promise.all([
        empPromise,
        fetch(url, { headers: getHeaders() }).then(function (r) { return r.json(); })
      ]).then(function (results) {
        allData = results[1] || [];
        renderTable();
      }).catch(function (err) {
        console.error('Client-grouped sheet fetch error:', err);
      });
    }

    function setData(items) {
      allData = items || [];
      renderTable();
    }

    searchInput.addEventListener('input', renderTable);

    if (!skipMonthSelector) {
      // initMonthSelector triggers the first fetch via refresh() callback
      initMonthSelector(wrapper, { prev: prevBtn.id, next: nextBtn.id, label: monthLabel.id }, deptSlug, refresh);
    }

    return { refresh: refresh, setData: setData };
  }

  // ── Client Communications Tab (template-based) ──────────────────
  function renderProductionTab(container) {
    while (container.firstChild) container.removeChild(container.firstChild);
    container.style.display = '';
    container.style.alignItems = '';
    container.style.justifyContent = '';
    container.style.flexDirection = '';
    container.style.height = '';
    container.style.gap = '';
    container.style.padding = '';

    loadProductionTemplates().then(function (tmplContainer) {
      var frag = cloneTemplateContent(tmplContainer, 'productionTabTemplate');
      if (!frag) return;
      container.appendChild(frag);

      var countBadge = container.querySelector('#prodTabCount');
      var searchInput = container.querySelector('#prodTabSearch');
      var sheetContainer = container.querySelector('#prodTabSheet');

      var allGroups = [];
      var clientCommSort = { key: null, dir: 'asc' };

      searchInput.addEventListener('input', function () {
        renderTable(allGroups, searchInput.value.toLowerCase());
      });

      function refreshAll(month) {
        var url = API_BASE + '/by-department/production';
        if (month) url += '?month=' + month;
        fetch(url, { headers: getHeaders() })
          .then(function (res) {
            if (!res.ok) throw new Error('Failed to fetch');
            return res.json();
          })
          .then(function (deliverables) {
            var filtered = deliverables.filter(function (d) {
              return d.status === 'request_client_materials';
            });
            allGroups = groupByClient(filtered);
            countBadge.textContent = filtered.length;
            renderTable(allGroups, searchInput.value.toLowerCase());
          })
          .catch(function (err) {
            console.error('Production fetch error:', err);
          });
      }

      var monthCtrl = initMonthSelector(container, {prev: 'prodMonthPrev', next: 'prodMonthNext', label: 'prodMonthLabel'}, 'production', function(month) { refreshAll(month); });

      function advanceStatus(itemId, nextStatus) {
        fetch(API_BASE + '/' + itemId, {
          method: 'PATCH',
          headers: getHeaders(),
          body: JSON.stringify({ status: nextStatus })
        }).then(function (res) {
          if (res.ok) refreshAll(monthCtrl.getCurrentMonth());
        });
      }

      function renderTable(groups, filterTerm) {
        while (sheetContainer.firstChild) sheetContainer.removeChild(sheetContainer.firstChild);

        if (groups.length === 0) {
          var empty = document.createElement('div');
          empty.style.padding = '40px';
          empty.style.textAlign = 'center';
          empty.style.color = 'var(--text-muted, #999)';
          empty.textContent = 'No items to display';
          sheetContainer.appendChild(empty);
          return;
        }

        var table = document.createElement('table');
        table.className = 'production-sheet-table';

        var thead = document.createElement('thead');
        var headerRow = document.createElement('tr');
        var columns = [
          { label: 'Title', sortKey: 'title' },
          { label: 'Type', sortKey: 'type' },
          { label: 'Status', sortKey: 'status' },
          { label: 'Assigned To', sortKey: null },
          { label: 'Due Date', sortKey: 'dueDate' },
          { label: '', sortKey: null }
        ];
        columns.forEach(function (col) {
          var th = document.createElement('th');
          th.textContent = col.label;
          if (col.label === '') th.style.width = '40px';
          headerRow.appendChild(th);
        });
        thead.appendChild(headerRow);
        table.appendChild(thead);

        makeSortableHeaders(thead, columns, clientCommSort, function () {
          renderTable(allGroups, searchInput.value.toLowerCase());
        });

        var tbody = document.createElement('tbody');

        groups.forEach(function (group) {
          var items = group.items;
          if (filterTerm) {
            items = items.filter(function (item) {
              return (item.title && item.title.toLowerCase().indexOf(filterTerm) !== -1) ||
                (item.type && item.type.toLowerCase().indexOf(filterTerm) !== -1) ||
                (group.clientName.toLowerCase().indexOf(filterTerm) !== -1);
            });
          }
          if (items.length === 0) return;

          var clientRow = document.createElement('tr');
          clientRow.className = 'production-client-row';
          clientRow.style.cursor = 'pointer';

          var clientCell = document.createElement('td');
          clientCell.colSpan = 6;

          var clientWrap = document.createElement('div');
          clientWrap.style.display = 'flex';
          clientWrap.style.alignItems = 'center';
          clientWrap.style.gap = '8px';

          var chevron = document.createElement('span');
          chevron.className = 'production-chevron';
          chevron.textContent = '\u25BC';

          var nameSpan = document.createElement('span');
          nameSpan.className = 'production-client-name';
          nameSpan.textContent = group.clientName;

          var badge = document.createElement('span');
          badge.className = 'dept-sheet-count';
          badge.textContent = items.length;

          clientWrap.appendChild(chevron);
          clientWrap.appendChild(nameSpan);
          clientWrap.appendChild(badge);
          clientCell.appendChild(clientWrap);
          clientRow.appendChild(clientCell);
          tbody.appendChild(clientRow);

          var sortedItems = sortItems(items, clientCommSort.key, clientCommSort.dir);
          var childRows = [];
          sortedItems.forEach(function (item) {
            var row = document.createElement('tr');
            row.className = 'production-child-row';

            var tdTitle = document.createElement('td');
            tdTitle.className = 'production-indented';
            tdTitle.textContent = item.title || '\u2014';
            row.appendChild(tdTitle);

            var tdType = document.createElement('td');
            var typeBadge = document.createElement('span');
            typeBadge.className = 'production-type-badge';
            typeBadge.textContent = item.type || '\u2014';
            tdType.appendChild(typeBadge);
            row.appendChild(tdType);

            var tdStatus = document.createElement('td');
            tdStatus.style.position = 'relative';
            var statusBadge = document.createElement('span');
            statusBadge.className = 'proagri-sheet-status ' + statusClass(item.status);
            statusBadge.textContent = formatStatus(item.status);
            statusBadge.style.cursor = 'pointer';
            statusBadge.addEventListener('click', (function (itm, bdg, cel) {
              return function (e) {
                e.stopPropagation();
                showStatusDropdown(itm, bdg, cel, refreshAll);
              };
            })(item, statusBadge, tdStatus));
            tdStatus.appendChild(statusBadge);
            row.appendChild(tdStatus);

            var tdAssigned = document.createElement('td');
            var assignedId = item.assignedProduction || item.assignedTo;
            if (assignedId && window._employeeCacheLookup) {
              var emp = window._employeeCacheLookup(assignedId);
              if (emp && emp.photo_url) {
                var avatarImg = document.createElement('img');
                avatarImg.style.cssText = 'width:28px;height:28px;border-radius:50%;object-fit:cover;';
                avatarImg.src = emp.photo_url;
                avatarImg.alt = (emp.first_name || '') + ' ' + (emp.last_name || '');
                avatarImg.title = (emp.first_name || '') + ' ' + (emp.last_name || '');
                tdAssigned.appendChild(avatarImg);
              } else {
                tdAssigned.textContent = assignedId;
              }
            } else {
              tdAssigned.textContent = '\u2014';
            }
            row.appendChild(tdAssigned);

            var tdDue = document.createElement('td');
            tdDue.textContent = formatDate(item.dueDate);
            row.appendChild(tdDue);

            var tdAction = document.createElement('td');
            var wf = workflows.getNextStatus(item.type, item.status);
            if (wf) {
              var btn = document.createElement('button');
              btn.className = 'proagri-sheet-row-action-btn action-advance';
              btn.title = wf.tooltip;
              btn.appendChild(makeSvgIcon(ICON_ADVANCE));
              btn.style.opacity = '1';
              btn.addEventListener('click', (function (id, next) {
                return function (e) {
                  e.stopPropagation();
                  advanceStatus(id, next);
                };
              })(item.id, wf.next));
              tdAction.appendChild(btn);
            }
            row.appendChild(tdAction);

            tbody.appendChild(row);
            childRows.push(row);
          });

          clientRow.addEventListener('click', (function (rows, chev) {
            return function () {
              var isOpen = rows[0] && rows[0].style.display !== 'none';
              rows.forEach(function (r) { r.style.display = isOpen ? 'none' : ''; });
              chev.textContent = isOpen ? '\u25B6' : '\u25BC';
            };
          })(childRows, chevron));
        });

        table.appendChild(tbody);
        sheetContainer.appendChild(table);
      }

      // initMonthSelector triggers the first fetch via onMonthChange callback
    });
  }

  // ── Shared column renderers for 50/50 tabs ──────────────────────
  // These factories produce column specs used by the client-grouped
  // sheet helper. Each returns a { label, className?, render } tuple.

  function colTitle() {
    return { label: 'Title', className: 'prod-deliv-title', render: function (item) {
      return item.title || '';
    }};
  }

  function colType() {
    return { label: 'Type', className: 'prod-deliv-type', render: function (item) {
      var badge = document.createElement('span');
      badge.className = 'production-type-badge';
      badge.textContent = formatTypeLabel(item.type || '');
      return badge;
    }};
  }

  function colStatus() {
    return { label: 'Status', className: 'prod-deliv-status-cell', render: function (item, refresh) {
      var badge = document.createElement('span');
      badge.className = 'proagri-sheet-status ' + statusClass(item.status);
      badge.textContent = formatStatus(item.status);
      badge.style.cursor = 'pointer';
      badge.addEventListener('click', function (e) {
        e.stopPropagation();
        var existing = document.querySelector('.prod-deliv-status-dropdown');
        if (existing) existing.remove();

        var chain = workflows ? workflows.getStatusChain(item.type) : [];
        if (chain.length === 0) return;
        var dropdown = document.createElement('div');
        dropdown.className = 'prod-deliv-status-dropdown';
        chain.forEach(function (st) {
          var opt = document.createElement('div');
          opt.className = 'prod-deliv-status-opt' + (st === item.status ? ' active' : '');
          var optBadge = document.createElement('span');
          optBadge.className = 'proagri-sheet-status ' + statusClass(st);
          optBadge.textContent = formatStatus(st);
          opt.appendChild(optBadge);
          opt.addEventListener('click', function (ev) {
            ev.stopPropagation();
            dropdown.remove();
            if (st === item.status) return;
            fetch('/api/deliverables/' + item.id, {
              method: 'PATCH',
              headers: getHeaders(),
              body: JSON.stringify({ status: st })
            }).then(function (res) { if (res.ok && refresh) refresh(); });
          });
          dropdown.appendChild(opt);
        });
        document.body.appendChild(dropdown);
        var rect = badge.getBoundingClientRect();
        dropdown.style.position = 'fixed';
        dropdown.style.top = rect.bottom + 4 + 'px';
        dropdown.style.left = rect.left + 'px';
        setTimeout(function () {
          document.addEventListener('click', function closeDD() {
            dropdown.remove();
            document.removeEventListener('click', closeDD);
          });
        }, 0);
      });
      return badge;
    }};
  }

  function colStatusChanged(label) {
    return { label: label || 'Status Changed', render: function (item) {
      return formatStatusChanged(item.statusChangedAt);
    }};
  }

  // Short date column — renders item[fieldName] as "2PM July 1" style.
  // Hour (12h, no minutes) + AM/PM attached, single space, full month name,
  // space, day of month (no leading zero). Empty string if field missing.
  function colShortDate(fieldName, labelText) {
    var MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December'];
    return { label: labelText || 'Sent', render: function (item) {
      var raw = item && item[fieldName];
      if (!raw) return '';
      var d = new Date(raw);
      if (isNaN(d.getTime())) return '';
      var h = d.getHours();
      var ampm = h >= 12 ? 'PM' : 'AM';
      var hr12 = h % 12;
      if (hr12 === 0) hr12 = 12;
      var min = d.getMinutes();
      var minStr = min < 10 ? '0' + min : String(min);
      return hr12 + ':' + minStr + ampm + ' ' + MONTH_NAMES[d.getMonth()] + ' ' + d.getDate();
    }};
  }

  function colFollowUpCount() {
    return { label: 'Follow Ups', render: function (item, refresh) {
      var count = item.followUpCount || 0;
      var badge = document.createElement('span');
      badge.className = 'dept-sheet-count';
      badge.textContent = count;
      badge.style.cursor = 'pointer';
      badge.title = 'Click to increment follow up count';
      badge.addEventListener('click', function (e) {
        e.stopPropagation();
        fetch('/api/deliverables/' + item.id, {
          method: 'PATCH',
          headers: getHeaders(),
          body: JSON.stringify({ followUpCount: count + 1 })
        }).then(function (res) { if (res.ok && refresh) refresh(); });
      });
      return badge;
    }};
  }

  // Per-deliverable "Request Materials" button column — opens the form
  // builder pre-scoped to this specific deliverable (not just the client).
  // The built form is then associated with deliverableId on submit so that
  // request-form responses can be looked up from the deliverable's own
  // dashboard (CC + online-article recap).
  function colRequestMaterials() {
    return { label: '', className: 'prod-deliv-req-mat', render: function (item) {
      var btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'prod-deliv-req-mat-btn';
      btn.textContent = 'Request Materials';
      btn.addEventListener('click', function (e) {
        e.stopPropagation();
        var cid = item.clientId || '';
        window.open('/form-builder.html?clientId=' + cid + '&deliverableId=' + item.id, '_blank');
      });
      return btn;
    }};
  }

  // Eye icon column — opens the deliverable dashboard for the row.
  // Mirrors the eye button in the Deliverables tab (see row renderer for
  // the canonical if/else chain). `tabContainer` is the tab's root element,
  // which the dashboard-open functions clear + take over.
  function colEye(tabContainer) {
    return { label: '', className: 'prod-deliv-act', render: function (item) {
      var dashboardTypes = ['sm-content-calendar', 'website-design', 'online-articles',
        'agri4all-posts', 'agri4all-videos', 'agri4all-product-uploads',
        'agri4all-newsletter-feature', 'agri4all-newsletter-banner', 'agri4all-linkedin',
        'own-social-posts', 'own-social-videos', 'own-social-linkedin', 'own-social-twitter',
        'agri4all-banners', 'video',
        'magazine-sa-digital', 'magazine-africa-print', 'magazine-africa-digital', 'magazine-coffee-table'];
      if (dashboardTypes.indexOf(item.type) === -1) return '';
      var btn = document.createElement('button');
      btn.className = 'proagri-sheet-row-action-btn action-view';
      btn.type = 'button';
      btn.title = 'View dashboard';
      btn.appendChild(makeSvgIcon('M12 4.5C7 4.5 2.73 7.61 1 12c1.73 4.39 6 7.5 11 7.5s9.27-3.11 11-7.5c-1.73-4.39-6-7.5-11-7.5zM12 17c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5zm0-8c-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3-1.34-3-3-3z'));
      btn.addEventListener('click', function (e) {
        e.stopPropagation();
        var it = item;
        var c = tabContainer;
        if (it.type === 'sm-content-calendar') openContentCalendarDashboard(c, it);
        else if (it.type === 'website-design') openWebsiteDesignDashboard(c, it);
        else if (it.type === 'online-articles') openOnlineArticlesDashboard(c, it);
        else if (it.type === 'agri4all-posts') openAgri4AllPostsDashboard(c, it);
        else if (it.type === 'agri4all-videos') openA4AMultiSectionDashboard(c, it, 'videos');
        else if (it.type === 'agri4all-product-uploads') openA4AProductUploadsDashboard(c, it);
        else if (it.type === 'own-social-posts') openA4AMultiSectionDashboard(c, it, 'own-posts');
        else if (it.type === 'own-social-videos') openA4AMultiSectionDashboard(c, it, 'own-videos');
        else if (it.type === 'agri4all-newsletter-feature') openA4AImageDescriptionDashboard(c, it);
        else if (it.type === 'agri4all-newsletter-banner') openA4AImageDescriptionDashboard(c, it);
        else if (it.type === 'agri4all-banners') openA4AImageDescriptionDashboard(c, it);
        else if (it.type && it.type.indexOf('magazine') === 0) openA4AImageDescriptionDashboard(c, it);
        else if (it.type === 'agri4all-linkedin') openA4ARichTextDashboard(c, it);
        else if (it.type === 'own-social-linkedin') openA4ARichTextDashboard(c, it);
        else if (it.type === 'own-social-twitter') openA4ARichTextDashboard(c, it);
        else if (it.type === 'video') openVideoDashboard(c, it);
      });
      return btn;
    }};
  }

  function colActionAdvance(nextStatusOrAuto, tooltipText) {
    return { label: '', className: 'prod-deliv-act', render: function (item, refresh) {
      var target, tooltip;
      if (nextStatusOrAuto === 'auto') {
        var wf = workflows && workflows.getNextStatus(item.type, item.status);
        if (!wf) return '';
        target = wf.next;
        tooltip = tooltipText || wf.tooltip;
      } else {
        target = nextStatusOrAuto;
        tooltip = tooltipText || ('Advance to: ' + formatStatus(target));
      }
      var btn = document.createElement('button');
      btn.className = 'proagri-sheet-row-action-btn action-advance';
      btn.title = tooltip;
      btn.appendChild(makeSvgIcon(ICON_ADVANCE));
      btn.style.opacity = '1';
      btn.addEventListener('click', function (e) {
        e.stopPropagation();
        fetch('/api/deliverables/' + item.id, {
          method: 'PATCH',
          headers: getHeaders(),
          body: JSON.stringify({ status: target })
        }).then(function (res) { if (res.ok && refresh) refresh(); });
      });
      return btn;
    }};
  }

  // Combined advance-arrows column — renders a send-back button (when the
  // current status has a send-back target) alongside the forward advance
  // button in a single cell. Mirrors the Deliverables tab row renderer.
  function colActionAdvanceBack(nextStatusOrAuto, tooltipText) {
    return { label: '', className: 'prod-deliv-act', render: function (item, refresh) {
      var wrap = document.createElement('div');
      wrap.style.display = 'inline-flex';
      wrap.style.gap = '4px';

      // Back button — in Follow Ups / Approvals we want literal "previous
      // status in the workflow chain" semantics (undo one step), not the
      // design_changes/client_changes branch that getSendBackTarget returns
      // for the Deliverables tab.
      var backTarget = null;
      if (workflows && workflows.getStatusChain) {
        var chain = workflows.getStatusChain(item.type) || [];
        var idx = chain.indexOf(item.status);
        if (idx > 0) backTarget = chain[idx - 1];
      }
      if (backTarget) {
        var backBtn = document.createElement('button');
        backBtn.className = 'proagri-sheet-row-action-btn action-undo';
        backBtn.type = 'button';
        backBtn.title = 'Send back for changes (' + formatStatus(backTarget) + ')';
        backBtn.appendChild(makeSvgIcon('M12 20l1.41-1.41L7.83 13H20v-2H7.83l5.58-5.59L12 4l-8 8z'));
        (function (it, target) {
          backBtn.addEventListener('click', function (e) {
            e.stopPropagation();
            fetch('/api/deliverables/' + it.id, {
              method: 'PATCH', headers: getHeaders(),
              body: JSON.stringify({ status: target })
            }).then(function (res) { if (res.ok && refresh) refresh(); });
          });
        })(item, backTarget);
        wrap.appendChild(backBtn);
      }

      // Forward advance button — same semantics as colActionAdvance
      var target, tooltip;
      if (nextStatusOrAuto === 'auto') {
        var wf = workflows && workflows.getNextStatus(item.type, item.status);
        if (!wf) {
          // No advance — return just the back button (or empty string).
          return backTarget ? wrap : '';
        }
        target = wf.next;
        tooltip = tooltipText || wf.tooltip;
      } else {
        target = nextStatusOrAuto;
        tooltip = tooltipText || ('Advance to: ' + formatStatus(target));
      }
      var advBtn = document.createElement('button');
      advBtn.className = 'proagri-sheet-row-action-btn action-advance';
      advBtn.type = 'button';
      advBtn.title = tooltip;
      advBtn.appendChild(makeSvgIcon(ICON_ADVANCE));
      advBtn.addEventListener('click', function (e) {
        e.stopPropagation();
        fetch('/api/deliverables/' + item.id, {
          method: 'PATCH',
          headers: getHeaders(),
          body: JSON.stringify({ status: target })
        }).then(function (res) { if (res.ok && refresh) refresh(); });
      });
      wrap.appendChild(advBtn);
      return wrap;
    }};
  }

  // ── Split-sheet tab helper (50/50 layout, shared month selector) ──
  // Builds a month selector at the top and two renderClientGroupedSheet
  // halves side-by-side. Both halves share one fetch per month change.
  //
  // options: {
  //   prefix: string — unique id prefix for DOM elements (e.g. 'fu', 'app'),
  //   deptSlug?: string ('production'),
  //   left/right: {
  //     title, filter, columns, emptyMessage, showClientButtons?
  //   }
  // }
  function renderSplitSheetTab(container, options) {
    options = options || {};
    var prefix = options.prefix || 'split';
    var deptSlug = options.deptSlug || 'production';

    while (container.firstChild) container.removeChild(container.firstChild);
    container.style.display = '';
    container.style.alignItems = '';
    container.style.justifyContent = '';
    container.style.flexDirection = '';
    container.style.height = '';
    container.style.gap = '';
    container.style.padding = '';

    var wrap = document.createElement('div');
    wrap.className = 'dept-tab-wrap';

    // Shared month selector
    var monthBar = document.createElement('div');
    monthBar.className = 'dept-month-selector';
    monthBar.id = prefix + 'MonthSelector';
    var prevBtn = document.createElement('button');
    prevBtn.id = prefix + 'MonthPrev';
    prevBtn.className = 'dept-month-nav dept-month-prev';
    prevBtn.title = 'Previous month';
    prevBtn.innerHTML = '&#9664;';
    var monthLabel = document.createElement('span');
    monthLabel.id = prefix + 'MonthLabel';
    monthLabel.className = 'dept-month-label';
    var nextBtn = document.createElement('button');
    nextBtn.id = prefix + 'MonthNext';
    nextBtn.className = 'dept-month-nav dept-month-next';
    nextBtn.title = 'Next month';
    nextBtn.innerHTML = '&#9654;';
    monthBar.appendChild(prevBtn);
    monthBar.appendChild(monthLabel);
    monthBar.appendChild(nextBtn);
    wrap.appendChild(monthBar);

    // 50/50 dashboard layout
    var layout = document.createElement('div');
    layout.className = 'dept-dashboard-layout';

    var leftHalf = document.createElement('div');
    leftHalf.className = 'dept-dashboard-half';
    layout.appendChild(leftHalf);

    var rightHalf = document.createElement('div');
    rightHalf.className = 'dept-dashboard-half';
    layout.appendChild(rightHalf);

    wrap.appendChild(layout);
    container.appendChild(wrap);

    // Create both halves as embedded sheets (no month selector)
    var leftSheet = renderClientGroupedSheet(leftHalf, {
      title: options.left.title,
      searchPlaceholder: options.left.searchPlaceholder || 'Search...',
      statusFilter: options.left.filter,
      columns: options.left.columns,
      emptyMessage: options.left.emptyMessage,
      showClientButtons: !!options.left.showClientButtons,
      hideClientGroups: !!options.hideClientGroups,
      skipMonthSelector: true
    });

    var rightSheet = renderClientGroupedSheet(rightHalf, {
      title: options.right.title,
      searchPlaceholder: options.right.searchPlaceholder || 'Search...',
      statusFilter: options.right.filter,
      columns: options.right.columns,
      emptyMessage: options.right.emptyMessage,
      showClientButtons: !!options.right.showClientButtons,
      hideClientGroups: !!options.hideClientGroups,
      skipMonthSelector: true
    });

    // Shared fetch — one network call, both halves render their filtered slice
    function sharedRefresh(ym) {
      var url = '/api/deliverables/by-department/' + deptSlug + (ym ? '?month=' + ym : '');
      var empPromise = window._fetchEmployees ? window._fetchEmployees() : Promise.resolve([]);
      Promise.all([
        empPromise,
        fetch(url, { headers: getHeaders() }).then(function (r) { return r.json(); })
      ]).then(function (results) {
        var data = results[1] || [];
        leftSheet.setData(data);
        rightSheet.setData(data);
      }).catch(function (err) {
        console.error('Split-sheet fetch error:', err);
      });
    }

    // Wire up the shared month selector → re-fetch on change
    initMonthSelector(wrap, {
      prev: prevBtn.id,
      next: nextBtn.id,
      label: monthLabel.id
    }, deptSlug, sharedRefresh);
  }

  // ── Follow Ups Tab — 50/50 split: Request Materials | Materials Requested ──
  // Left  : items still in `request_client_materials` (a form needs to be sent)
  //         OR content calendars at `request_focus_points` (the CC-chain equivalent).
  // Right : items already requested and waiting on the client.
  //         Includes content calendars at `focus_points_requested` (CC-chain equivalent).
  function renderFollowUpsTab(container) {
    renderSplitSheetTab(container, {
      prefix: 'fu',
      left: {
        title: 'Request Materials',
        searchPlaceholder: 'Search request materials...',
        filter: function (d) {
          return d.status === 'request_client_materials' ||
            d.status === 'request_focus_points';
        },
        // Left sheet: no "Sent" date — the form hasn't been sent yet.
        // Per-deliverable Request Materials button lives here instead of
        // on the client group header.
        columns: [
          colEye(container),
          colType(),
          colFollowUpCount(),
          colStatus(),
          colRequestMaterials(),
          colActionAdvanceBack('auto')
        ],
        emptyMessage: 'No items waiting for a materials request',
        showClientButtons: true
      },
      right: {
        title: 'Materials Requested',
        searchPlaceholder: 'Search materials requested...',
        filter: function (d) {
          // Canonical status after form publish + legacy stragglers +
          // CC-chain's focus_points_requested.
          return d.status === 'materials_requested' ||
            d.status === 'waiting_for_materials' ||
            d.status === 'upload_materials' ||
            d.status === 'focus_points_requested';
        },
        // Right sheet: show "Sent" date — the form has been sent to the client.
        columns: [
          colEye(container),
          colType(),
          colShortDate('statusChangedAt', 'Sent'),
          colFollowUpCount(),
          colStatus(),
          colActionAdvanceBack('auto')
        ],
        emptyMessage: 'No materials requested',
        showClientButtons: true
      }
    });
  }

  // ── Approvals Tab — 50/50 layout, uses renderClientGroupedSheet ──
  function renderApprovalsTab(container) {
    renderSplitSheetTab(container, {
      prefix: 'app',
      left: {
        title: 'Send for Approval',
        filter: function (d) { return d.status === 'ready_for_approval'; },
        // Left sheet: no "Sent" date — not yet sent to the client.
        columns: [
          colEye(container),
          colType(),
          colFollowUpCount(),
          colStatus(),
          colActionAdvanceBack('auto')
        ],
        emptyMessage: 'No items ready for approval'
      },
      right: {
        title: 'Sent for Approval',
        filter: function (d) { return d.status === 'sent_for_approval'; },
        // Right sheet: show "Sent" date — the deliverable is with the client.
        columns: [
          colEye(container),
          colType(),
          colShortDate('statusChangedAt', 'Sent'),
          colFollowUpCount(),
          colStatus(),
          colActionAdvanceBack('auto')
        ],
        emptyMessage: 'No items sent for approval'
      }
    });
  }

  // ── Status Dropdown ─────────────────────────────────────────────
  function showStatusDropdown(item, badge, cell, onRefresh) {
    var existing = document.querySelector('.status-dropdown-menu');
    if (existing) existing.remove();

    var chain = workflows.getStatusChain(item.type);
    if (!chain || chain.length === 0) return;

    var dropdown = document.createElement('div');
    dropdown.className = 'status-dropdown-menu';

    chain.forEach(function (st) {
      var option = document.createElement('div');
      option.className = 'status-dropdown-option';
      if (st === item.status) option.classList.add('status-dropdown-active');
      option.textContent = formatStatus(st);
      option.addEventListener('click', function (e) {
        e.stopPropagation();
        dropdown.remove();
        if (st === item.status) return;
        fetch(API_BASE + '/' + item.id, {
          method: 'PATCH',
          headers: getHeaders(),
          body: JSON.stringify({ status: st })
        }).then(function (res) {
          if (res.ok) onRefresh();
        });
      });
      dropdown.appendChild(option);
    });

    // Append first so we can measure, then clamp to viewport.
    dropdown.style.position = 'fixed';
    dropdown.style.visibility = 'hidden';
    dropdown.style.top = '0px';
    dropdown.style.left = '0px';
    document.body.appendChild(dropdown);
    var rect = cell.getBoundingClientRect();
    var ddRect = dropdown.getBoundingClientRect();
    var ddH = ddRect.height;
    var ddW = ddRect.width;
    var top;
    if (rect.bottom + 4 + ddH > window.innerHeight && rect.top - 4 - ddH >= 0) {
      top = rect.top - 4 - ddH;
    } else {
      top = rect.bottom + 4;
    }
    var left = rect.left;
    if (left + ddW > window.innerWidth - 8) {
      left = Math.max(8, window.innerWidth - ddW - 8);
    }
    dropdown.style.top = top + 'px';
    dropdown.style.left = left + 'px';
    dropdown.style.visibility = 'visible';

    function closeDropdown(e) {
      if (!dropdown.contains(e.target) && e.target !== badge) {
        dropdown.remove();
        document.removeEventListener('click', closeDropdown, true);
      }
    }
    setTimeout(function () {
      document.addEventListener('click', closeDropdown, true);
    }, 0);
  }

  // ── Generic Department Type Tab (template-based) ───────────────
  window.renderDeptTypeTab = function (container, deptSlug, viewName) {
    var typeFilters = {
      'Content Calendars': ['sm-content-calendar', 'sm-posts', 'sm-videos', 'sm-google-ads', 'sm-linkedin', 'sm-twitter'],
      'Agri for All': ['agri4all-posts', 'agri4all-videos', 'agri4all-product-uploads', 'agri4all-newsletters', 'agri4all-linkedin'],
      'Magazine': ['magazine'],
      'Web Design': ['website-design'],
      'Banners': ['agri4all-banners'],
      'Online Articles': ['online-articles'],
      'Briefs': ['video'],
      'Production': ['video'],
      'Editing': ['video'],
      'Review': ['video'],
      'Posts': ['agri4all-posts', 'agri4all-videos', 'agri4all-product-uploads', 'agri4all-linkedin'],
      'Newsletters': ['agri4all-newsletters'],
      'Links': ['agri4all-posts', 'agri4all-videos', 'agri4all-product-uploads', 'agri4all-newsletters', 'agri4all-linkedin'],
      'Stats': ['agri4all-posts', 'agri4all-videos', 'agri4all-product-uploads', 'agri4all-newsletters', 'agri4all-banners', 'agri4all-linkedin'],
      'Scheduling': ['sm-content-calendar', 'sm-posts', 'sm-videos', 'sm-google-ads', 'sm-linkedin', 'sm-twitter', 'agri4all-banners'],
      'Google Ads': ['sm-google-ads'],
      'Proposals': ['proposal']
    };

    var allowedTypes = typeFilters[viewName] || [];

    while (container.firstChild) container.removeChild(container.firstChild);
    container.style.display = '';
    container.style.alignItems = '';
    container.style.justifyContent = '';
    container.style.flexDirection = '';
    container.style.height = '';
    container.style.gap = '';
    container.style.padding = '';

    loadProductionTemplates().then(function (tmplContainer) {
      var frag = cloneTemplateContent(tmplContainer, 'deptTypeTabTemplate');
      if (!frag) return;
      container.appendChild(frag);

      var titleEl = container.querySelector('#deptTypeTitle');
      var countBadge = container.querySelector('#deptTypeCount');
      var searchInput = container.querySelector('#deptTypeSearch');
      var sheetContainer = container.querySelector('#deptTypeSheet');

      titleEl.textContent = viewName;

      var allGroups = [];

      searchInput.addEventListener('input', function () {
        renderDeptTable(allGroups, searchInput.value.toLowerCase());
      });

      function refreshAll(month) {
        var url = API_BASE + '/by-department/' + deptSlug;
        if (month) url += '?month=' + month;
        fetch(url, { headers: getHeaders() })
          .then(function (res) {
            if (!res.ok) throw new Error('Failed to fetch');
            return res.json();
          })
          .then(function (deliverables) {
            var filtered = deliverables.filter(function (d) {
              return allowedTypes.indexOf(d.type) !== -1;
            });
            allGroups = groupByClient(filtered);
            countBadge.textContent = filtered.length;
            renderDeptTable(allGroups, searchInput.value.toLowerCase());
          })
          .catch(function (err) {
            console.error('Dept tab fetch error:', err);
          });
      }

      var monthCtrl = initMonthSelector(container, {prev: 'deptTypeMonthPrev', next: 'deptTypeMonthNext', label: 'deptTypeMonthLabel'}, deptSlug, function(month) { refreshAll(month); });

      function renderDeptTable(groups, filterTerm) {
        while (sheetContainer.firstChild) sheetContainer.removeChild(sheetContainer.firstChild);

        // Flatten all items from all groups, applying the search filter
        var flatItems = [];
        groups.forEach(function (group) {
          group.items.forEach(function (item) {
            if (!filterTerm ||
              (item.title && item.title.toLowerCase().indexOf(filterTerm) !== -1) ||
              (item.type && item.type.toLowerCase().indexOf(filterTerm) !== -1) ||
              (group.clientName && group.clientName.toLowerCase().indexOf(filterTerm) !== -1)) {
              flatItems.push(item);
            }
          });
        });

        if (flatItems.length === 0) {
          var empty = document.createElement('div');
          empty.style.padding = '40px';
          empty.style.textAlign = 'center';
          empty.style.color = 'var(--text-muted, #999)';
          empty.textContent = 'No items to display';
          sheetContainer.appendChild(empty);
          return;
        }

        flatItems.forEach(function (item) {
          var row = document.createElement('div');
          row.className = 'prod-deliv-row';

          // 1. Eye icon
          var eyeCell = document.createElement('div');
          eyeCell.className = 'prod-deliv-cell prod-deliv-act';
          var dashboardTypes = ['sm-content-calendar', 'website-design', 'online-articles',
            'agri4all-posts', 'agri4all-videos', 'agri4all-product-uploads',
            'agri4all-newsletter-feature', 'agri4all-newsletter-banner', 'agri4all-linkedin',
            'own-social-posts', 'own-social-videos', 'own-social-linkedin', 'own-social-twitter',
            'agri4all-banners', 'video',
            'magazine-sa-digital', 'magazine-africa-print', 'magazine-africa-digital', 'magazine-coffee-table'];
          if (dashboardTypes.indexOf(item.type) !== -1) {
            var eyeBtn = document.createElement('button');
            eyeBtn.className = 'proagri-sheet-row-action-btn action-view';
            eyeBtn.type = 'button';
            eyeBtn.title = 'View dashboard';
            eyeBtn.appendChild(makeSvgIcon('M12 4.5C7 4.5 2.73 7.61 1 12c1.73 4.39 6 7.5 11 7.5s9.27-3.11 11-7.5c-1.73-4.39-6-7.5-11-7.5zM12 17c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5zm0-8c-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3-1.34-3-3-3z'));
            (function (it) {
              eyeBtn.addEventListener('click', function (e) {
                e.stopPropagation();
                var c = container;
                if (it.type === 'sm-content-calendar') openContentCalendarDashboard(c, it);
                else if (it.type === 'website-design') openWebsiteDesignDashboard(c, it);
                else if (it.type === 'online-articles') openOnlineArticleDashboard(c, it);
                else if (it.type === 'agri4all-posts') openAgri4AllPostsDashboard(c, it);
                else if (it.type === 'agri4all-videos') openA4AMultiSectionDashboard(c, it, 'videos');
                else if (it.type === 'agri4all-product-uploads') openA4AProductUploadsDashboard(c, it);
                else if (it.type === 'own-social-posts') openA4AMultiSectionDashboard(c, it, 'own-posts');
                else if (it.type === 'own-social-videos') openA4AMultiSectionDashboard(c, it, 'own-videos');
                else if (it.type === 'agri4all-newsletter-feature') openA4AImageDescriptionDashboard(c, it);
                else if (it.type === 'agri4all-newsletter-banner') openA4AImageDescriptionDashboard(c, it);
                else if (it.type === 'agri4all-banners') openA4AImageDescriptionDashboard(c, it);
                else if (it.type && it.type.indexOf('magazine') === 0) openA4AImageDescriptionDashboard(c, it);
                else if (it.type === 'agri4all-linkedin') openA4ARichTextDashboard(c, it);
                else if (it.type === 'own-social-linkedin') openA4ARichTextDashboard(c, it);
                else if (it.type === 'own-social-twitter') openA4ARichTextDashboard(c, it);
                else if (it.type === 'video') openVideoDashboard(c, it);
              });
            })(item);
            eyeCell.appendChild(eyeBtn);
          } else {
            // Invisible placeholder to preserve column alignment
            var eyePlaceholder = document.createElement('button');
            eyePlaceholder.className = 'proagri-sheet-row-action-btn action-view';
            eyePlaceholder.type = 'button';
            eyePlaceholder.disabled = true;
            eyePlaceholder.style.visibility = 'hidden';
            eyePlaceholder.appendChild(makeSvgIcon('M12 4.5C7 4.5 2.73 7.61 1 12c1.73 4.39 6 7.5 11 7.5s9.27-3.11 11-7.5c-1.73-4.39-6-7.5-11-7.5zM12 17c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5zm0-8c-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3-1.34-3-3-3z'));
            eyeCell.appendChild(eyePlaceholder);
          }
          row.appendChild(eyeCell);

          // 2. Avatar
          var teamCell = document.createElement('div');
          teamCell.className = 'prod-deliv-cell prod-deliv-team';
          teamCell.appendChild(buildDeptAvatarRow(item, function () {
            refreshAll(monthCtrl.getCurrentMonth());
          }, deptSlug));
          row.appendChild(teamCell);

          // 3. Client name
          var clientCell = document.createElement('div');
          clientCell.className = 'prod-deliv-cell prod-deliv-client-name';
          clientCell.textContent = item.clientName || '';
          row.appendChild(clientCell);

          // 4. Type badge
          var typeCell = document.createElement('div');
          typeCell.className = 'prod-deliv-cell prod-deliv-type';
          var typeBadge = document.createElement('span');
          typeBadge.className = 'production-type-badge';
          typeBadge.textContent = formatTypeLabel(item.type || '');
          typeCell.appendChild(typeBadge);
          row.appendChild(typeCell);

          // 5. Platforms pills
          var platformsCell = document.createElement('div');
          platformsCell.className = 'prod-deliv-cell prod-deliv-platforms';
          var deptMeta = item.metadata || {};
          var deptPlatformKeys = [];
          if (item.type === 'agri4all-posts') {
            if (deptMeta.facebook_posts) deptPlatformKeys.push('facebook');
            if (deptMeta.instagram_posts) deptPlatformKeys.push('instagram');
            if (deptMeta.instagram_stories) deptPlatformKeys.push('instagram_stories');
          } else if (Array.isArray(deptMeta.platforms)) {
            deptMeta.platforms.forEach(function (p) {
              var key = (typeof p === 'string') ? p : (p && p.key) || '';
              if (key) deptPlatformKeys.push(key);
            });
          }
          deptPlatformKeys.forEach(function (key) {
            var label = formatPlatformLabel(key, item.type);
            if (!label) return;
            var pill = document.createElement('span');
            pill.className = 'prod-deliv-platform-tag';
            pill.style.marginRight = '4px';
            pill.textContent = label;
            platformsCell.appendChild(pill);
          });
          row.appendChild(platformsCell);

          // 6. Status badge (clickable)
          var statusCell = document.createElement('div');
          statusCell.className = 'prod-deliv-cell prod-deliv-status-cell';
          statusCell.style.position = 'relative';
          var statusBadge = document.createElement('span');
          statusBadge.className = 'proagri-sheet-status ' + statusClass(item.status);
          statusBadge.textContent = formatStatus(item.status);
          statusBadge.style.cursor = 'pointer';
          (function (itm, bdg, cel) {
            statusBadge.addEventListener('click', function (e) {
              e.stopPropagation();
              showStatusDropdown(itm, bdg, cel, refreshAll);
            });
          })(item, statusBadge, statusCell);
          statusCell.appendChild(statusBadge);
          row.appendChild(statusCell);

          // 7. Advance arrow
          var actionCell = document.createElement('div');
          actionCell.className = 'prod-deliv-cell prod-deliv-act';
          var wf = workflows && workflows.getNextStatus(item.type, item.status);
          if (wf) {
            var advBtn = document.createElement('button');
            advBtn.className = 'proagri-sheet-row-action-btn action-advance';
            advBtn.type = 'button';
            advBtn.title = wf.tooltip;
            advBtn.appendChild(makeSvgIcon(ICON_ADVANCE));
            (function (id, next, ctrl) {
              advBtn.addEventListener('click', function (e) {
                e.stopPropagation();
                fetch(API_BASE + '/' + id, {
                  method: 'PATCH',
                  headers: getHeaders(),
                  body: JSON.stringify({ status: next })
                }).then(function (res) {
                  if (res.ok) refreshAll(ctrl.getCurrentMonth());
                });
              });
            })(item.id, wf.next, monthCtrl);
            actionCell.appendChild(advBtn);
          }
          row.appendChild(actionCell);

          sheetContainer.appendChild(row);
        });
      }

      // initMonthSelector triggers the first fetch via onMonthChange callback
    });
  };

  window.renderProductionTab = renderProductionTab;
  window.renderFollowUpsTab = renderFollowUpsTab;
  window.renderApprovalsTab = renderApprovalsTab;

  // ── Department person assignment config ────────────────
  var DEPT_SLOTS = [
    { field: 'assignedAdmin',       api: 'assigned_admin',        label: 'Admin',        color: '#3b82f6' },
    { field: 'assignedProduction',  api: 'assigned_production',   label: 'Production',   color: '#8b5cf6' },
    { field: 'assignedDesign',      api: 'assigned_design',       label: 'Design',       color: '#ec4899' },
    { field: 'assignedEditorial',   api: 'assigned_editorial',    label: 'Editorial',    color: '#f59e0b' },
    { field: 'assignedVideo',       api: 'assigned_video',        label: 'Video',        color: '#ef4444' },
    { field: 'assignedAgri4all',    api: 'assigned_agri4all',     label: 'Agri4All',     color: '#10b981' },
    { field: 'assignedSocialMedia', api: 'assigned_social_media', label: 'Social Media', color: '#06b6d4' }
  ];

  // Avatar: photo if available, otherwise colored initials circle
  // Normalize employee field names (API returns snake_case)
  function empFirst(e) { return e && (e.first_name || e.firstName) || ''; }
  function empLast(e) { return e && (e.last_name || e.lastName) || ''; }
  function empPhoto(e) { return e && (e.photo_url || e.photoUrl) || ''; }
  function empFullName(e) {
    if (!e) return '';
    return (empFirst(e) + ' ' + empLast(e)).trim() || (e.username || '');
  }
  function empInitials(e) {
    if (!e) return '?';
    var f = empFirst(e);
    var l = empLast(e);
    if (f || l) return ((f[0] || '') + (l[0] || '')).toUpperCase();
    var u = (e.username || '').trim();
    return u ? u.substring(0, 2).toUpperCase() : '?';
  }

  function buildAvatar(employee, size, deptColor) {
    var el = document.createElement('div');
    el.className = 'dept-avatar';
    var px = (size || 22) + 'px';
    el.style.cssText = 'width:' + px + ';height:' + px + ';';
    var photo = empPhoto(employee);
    if (employee && photo) {
      var img = document.createElement('img');
      img.src = photo;
      img.alt = empFullName(employee);
      el.appendChild(img);
    } else if (employee) {
      el.textContent = empInitials(employee);
      el.style.background = deptColor || '#64748b';
      el.style.color = '#fff';
      // Scale font by size
      el.style.fontSize = (size >= 28 ? '11px' : '9px');
    } else {
      el.className += ' dept-avatar-empty';
      el.textContent = '+';
      el.style.borderColor = deptColor || '#cbd5e1';
      el.style.color = deptColor || '#94a3b8';
    }
    if (employee) {
      el.title = empFullName(employee);
    }
    return el;
  }

  // Employee picker modal — searchable list with current user first
  function openEmployeePicker(deptLabel, currentId, onSelect) {
    var existing = document.querySelector('.emp-picker-overlay');
    if (existing) existing.remove();

    var overlay = document.createElement('div');
    overlay.className = 'emp-picker-overlay';
    var modal = document.createElement('div');
    modal.className = 'emp-picker-modal';

    var title = document.createElement('h3');
    title.className = 'emp-picker-title';
    title.textContent = 'Assign ' + deptLabel;
    modal.appendChild(title);

    var searchInput = document.createElement('input');
    searchInput.type = 'text';
    searchInput.className = 'emp-picker-search';
    searchInput.placeholder = 'Search employees...';
    modal.appendChild(searchInput);

    var listEl = document.createElement('div');
    listEl.className = 'emp-picker-list';
    modal.appendChild(listEl);

    overlay.appendChild(modal);
    overlay.addEventListener('click', function (e) { if (e.target === overlay) overlay.remove(); });
    document.body.appendChild(overlay);

    (window._fetchEmployees ? window._fetchEmployees() : fetch('/api/employees', { headers: getHeaders() }).then(function (r) { return r.json(); }))
      .then(function (employees) {
        var currentUser = null;
        if (window.getCurrentUser) currentUser = window.getCurrentUser();
        // Sort: current user first, then alphabetically
        var sorted = employees.slice().sort(function (a, b) {
          if (currentUser) {
            if (a.id === currentUser.id) return -1;
            if (b.id === currentUser.id) return 1;
          }
          return empFullName(a).localeCompare(empFullName(b));
        });

        function renderList(filter) {
          while (listEl.firstChild) listEl.removeChild(listEl.firstChild);
          var filtered = sorted;
          if (filter) {
            var f = filter.toLowerCase();
            filtered = sorted.filter(function (e) {
              var name = (empFullName(e) + ' ' + (e.username || '') + ' ' + (e.role || '')).toLowerCase();
              return name.indexOf(f) !== -1;
            });
          }

          // "Unassign" option
          var clearRow = document.createElement('div');
          clearRow.className = 'emp-picker-item emp-picker-clear';
          clearRow.textContent = '\u2715  Unassign';
          clearRow.addEventListener('click', function () {
            onSelect(null);
            overlay.remove();
          });
          listEl.appendChild(clearRow);

          filtered.forEach(function (emp) {
            var row = document.createElement('div');
            row.className = 'emp-picker-item' + (emp.id === currentId ? ' active' : '');
            row.appendChild(buildAvatar(emp, 28, '#64748b'));
            var info = document.createElement('div');
            info.className = 'emp-picker-info';
            var name = document.createElement('div');
            name.className = 'emp-picker-name';
            name.textContent = empFullName(emp) || emp.username;
            info.appendChild(name);
            var role = document.createElement('div');
            role.className = 'emp-picker-role';
            role.textContent = emp.role || '';
            info.appendChild(role);
            row.appendChild(info);
            if (currentUser && emp.id === currentUser.id) {
              var you = document.createElement('span');
              you.className = 'emp-picker-you';
              you.textContent = 'You';
              row.appendChild(you);
            }
            row.addEventListener('click', function () {
              onSelect(emp.id);
              overlay.remove();
            });
            listEl.appendChild(row);
          });
        }
        renderList('');
        searchInput.addEventListener('input', function () { renderList(searchInput.value); });
        searchInput.focus();
      });
  }

  // Build the 7-avatar cell for a deliverable row
  // Get the "send back" target status for a review/approval status
  // Returns null if not a review status
  function getSendBackTarget(status) {
    var map = {
      'design_review': 'design_changes',
      'editorial_review': 'editorial_changes',
      'ready_for_approval': 'design_changes',
      'sent_for_approval': 'client_changes',
      'client_approved': 'client_changes',
      'review': 'changes_requested'
    };
    return map[status] || null;
  }

  // Map dept slug to slot (for filtering by context)
  function getSlotForDeptSlug(slug) {
    // Match slug variations: 'production' → production slot, 'social-media' → socialMedia, etc.
    var normalized = (slug || '').toLowerCase().replace(/-/g, '');
    for (var i = 0; i < DEPT_SLOTS.length; i++) {
      var s = DEPT_SLOTS[i];
      if (s.api.replace('assigned_', '').replace(/_/g, '') === normalized) return s;
    }
    return null;
  }

  // Build avatar cell — shows only the slot(s) matching the given dept context
  // If deptContext is 'all', shows all 7. Otherwise shows just that dept's slot.
  function buildDeptAvatarRow(deliverable, onUpdate, deptContext) {
    var wrap = document.createElement('div');
    wrap.className = 'dept-avatar-row';

    var slots;
    if (deptContext === 'all') {
      slots = DEPT_SLOTS;
    } else {
      var slot = getSlotForDeptSlug(deptContext);
      slots = slot ? [slot] : DEPT_SLOTS;
    }

    slots.forEach(function (slot) {
      var assignedId = deliverable[slot.field];
      var emp = assignedId && window._employeeCacheLookup ? window._employeeCacheLookup(assignedId) : null;
      var avatar = buildAvatar(emp, 22, slot.color);
      avatar.addEventListener('click', function (e) {
        e.stopPropagation();
        openEmployeePicker(slot.label, assignedId, function (newId) {
          var body = {};
          body[slot.api] = newId;
          fetch(API_BASE + '/' + deliverable.id, {
            method: 'PATCH', headers: getHeaders(),
            body: JSON.stringify(body)
          }).then(function (res) {
            if (res.ok) {
              deliverable[slot.field] = newId;
              if (onUpdate) onUpdate();
            }
          });
        });
      });
      wrap.appendChild(avatar);
    });
    return wrap;
  }

  // ── Unified Production Deliverables Tab ─────────────────────
  function renderProductionDeliverablesTab(container) {
    while (container.firstChild) container.removeChild(container.firstChild);

    var wrapper = document.createElement('div');
    wrapper.style.cssText = 'width:100%;height:100%;display:flex;flex-direction:column;overflow:hidden;';

    // Month selector
    var monthBar = document.createElement('div');
    monthBar.className = 'dept-month-selector';
    var prevBtn = document.createElement('button');
    prevBtn.id = 'prodDelivPrev';
    prevBtn.className = 'dept-month-nav';
    prevBtn.textContent = '\u25C0';
    var monthLabel = document.createElement('span');
    monthLabel.id = 'prodDelivLabel';
    monthLabel.className = 'dept-month-label';
    var nextBtn = document.createElement('button');
    nextBtn.id = 'prodDelivNext';
    nextBtn.className = 'dept-month-nav';
    nextBtn.textContent = '\u25B6';
    monthBar.appendChild(prevBtn);
    monthBar.appendChild(monthLabel);
    monthBar.appendChild(nextBtn);
    wrapper.appendChild(monthBar);

    // Sheet card
    var card = document.createElement('div');
    card.className = 'dept-sheet-card';
    card.style.flex = '1';
    card.style.minHeight = '0';
    card.style.overflow = 'hidden';

    var header = document.createElement('div');
    header.className = 'dept-sheet-header';
    var titleWrap = document.createElement('div');
    titleWrap.className = 'dept-sheet-title-wrap';
    var h = document.createElement('h3');
    h.className = 'dept-sheet-title';
    h.textContent = 'Deliverables';
    titleWrap.appendChild(h);
    var countBadge = document.createElement('span');
    countBadge.className = 'dept-sheet-count';
    countBadge.textContent = '0';
    titleWrap.appendChild(countBadge);
    header.appendChild(titleWrap);

    var searchInput = document.createElement('input');
    searchInput.type = 'text';
    searchInput.className = 'dept-sheet-search';
    searchInput.placeholder = 'Search deliverables...';
    header.appendChild(searchInput);
    card.appendChild(header);

    var sheetBody = document.createElement('div');
    sheetBody.style.cssText = 'flex:1;overflow-y:auto;min-height:0;';
    card.appendChild(sheetBody);
    wrapper.appendChild(card);
    container.appendChild(wrapper);

    var allData = [];
    var collapsedClients = {};

    function advanceStatus(itemId, type, currentStatus) {
      if (!workflows) return;
      var next = workflows.getNextStatus(type, currentStatus);
      if (!next || !next.next) return;
      fetch(API_BASE + '/' + itemId, {
        method: 'PATCH',
        headers: getHeaders(),
        body: JSON.stringify({ status: next.next })
      }).then(function (res) {
        if (res.ok) monthSelector.getCurrentMonth && fetchData(monthSelector.getCurrentMonth());
      });
    }

    function renderTable() {
      while (sheetBody.firstChild) sheetBody.removeChild(sheetBody.firstChild);

      var term = searchInput.value.toLowerCase();
      var filtered = allData;
      if (term) {
        filtered = allData.filter(function (d) {
          return (d.title || '').toLowerCase().indexOf(term) !== -1 ||
            (d.clientName || '').toLowerCase().indexOf(term) !== -1 ||
            (d.status || '').toLowerCase().indexOf(term) !== -1 ||
            (d.type || '').toLowerCase().indexOf(term) !== -1;
        });
      }

      countBadge.textContent = filtered.length;
      var groups = groupByClient(filtered);

      if (groups.length === 0) {
        var empty = document.createElement('div');
        empty.className = 'proagri-sheet-empty';
        empty.textContent = 'No deliverables to display';
        sheetBody.appendChild(empty);
        return;
      }

      // Column header — classes must match data row cells
      var headerRow = document.createElement('div');
      headerRow.className = 'prod-deliv-row prod-deliv-header';
      var headerCols = [
        { label: '', cls: 'prod-deliv-cell prod-deliv-act' },
        { label: 'Team', cls: 'prod-deliv-cell prod-deliv-team' },
        { label: 'Type', cls: 'prod-deliv-cell prod-deliv-type' },
        { label: 'Status', cls: 'prod-deliv-cell' }
      ];
      headerCols.forEach(function (col) {
        var cell = document.createElement('div');
        cell.className = col.cls;
        cell.textContent = col.label;
        headerRow.appendChild(cell);
      });
      var actCell = document.createElement('div');
      actCell.className = 'prod-deliv-cell prod-deliv-act';
      headerRow.appendChild(actCell);
      sheetBody.appendChild(headerRow);

      groups.forEach(function (group) {
        var isCollapsed = !!collapsedClients[group.clientName];

        // Client header row
        var clientRow = document.createElement('div');
        clientRow.className = 'prod-deliv-client-row';
        var chevron = document.createElement('span');
        chevron.className = 'prod-deliv-chevron' + (isCollapsed ? ' collapsed' : '');
        chevron.textContent = isCollapsed ? '\u25B6' : '\u25BC';
        clientRow.appendChild(chevron);
        var clientLabel = document.createElement('span');
        clientLabel.className = 'prod-deliv-client-name';
        clientLabel.textContent = group.clientName;
        clientRow.appendChild(clientLabel);
        var clientCount = document.createElement('span');
        clientCount.className = 'prod-deliv-client-count';
        clientCount.textContent = group.items.length;
        clientRow.appendChild(clientCount);

        // Client action button: Open Portal only.
        // Per-deliverable "Request Materials" buttons live inside each row
        // (added by the per-row reqMatBtn block below) so each form is
        // associated with a specific deliverable.
        if (group.clientId) {
          var spacer = document.createElement('span');
          spacer.style.flex = '1';
          clientRow.appendChild(spacer);

          var portalBtn = document.createElement('button');
          portalBtn.className = 'prod-client-btn prod-client-btn-primary';
          portalBtn.textContent = 'Open Portal';
          (function (cid) {
            portalBtn.addEventListener('click', function (e) {
              e.stopPropagation();
              // Get or create portal token
              fetch('/api/portal/get-or-create-token', {
                method: 'POST',
                headers: getHeaders(),
                body: JSON.stringify({ clientId: cid })
              }).then(function (r) { return r.json(); }).then(function (data) {
                if (data.token) window.open('/client-portal.html?token=' + data.token, '_blank');
              });
            });
          })(group.clientId);
          clientRow.appendChild(portalBtn);
        }

        clientRow.addEventListener('click', function () {
          collapsedClients[group.clientName] = !collapsedClients[group.clientName];
          renderTable();
        });
        sheetBody.appendChild(clientRow);

        if (isCollapsed) return;

        group.items.forEach(function (item) {
          var row = document.createElement('div');
          row.className = 'prod-deliv-row';
          // Content calendar rows in Production are simplified: they show
          // ONLY eye, avatar, the literal label "Content Calendar", status,
          // and the advance arrow. Any other column (title, send-back button)
          // is intentionally hidden for this type in this department.
          var isContentCalendar = (item.type === 'sm-content-calendar');
          var isOnlineArticles = (item.type === 'online-articles');
          if (isContentCalendar) row.classList.add('prod-deliv-row-cc');
          if (isOnlineArticles) row.classList.add('prod-deliv-row-oa');

          // ── Online Articles: fully custom row ────────────────────
          // Spec row order:
          //   eye | production avatar | "Online Article" label |
          //   platforms pills | amount | curated amount |
          //   Needs Translation toggle | status | advance/back arrows
          if (isOnlineArticles) {
            // Eye
            var oaEyeCell = document.createElement('div');
            oaEyeCell.className = 'prod-deliv-cell prod-deliv-act';
            var oaEyeBtn = document.createElement('button');
            oaEyeBtn.className = 'proagri-sheet-row-action-btn action-view';
            oaEyeBtn.type = 'button';
            oaEyeBtn.title = 'View online article';
            oaEyeBtn.appendChild(makeSvgIcon('M12 4.5C7 4.5 2.73 7.61 1 12c1.73 4.39 6 7.5 11 7.5s9.27-3.11 11-7.5c-1.73-4.39-6-7.5-11-7.5zM12 17c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5zm0-8c-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3-1.34-3-3-3z'));
            (function (it) {
              oaEyeBtn.addEventListener('click', function (e) {
                e.stopPropagation();
                openOnlineArticleDashboard(container, it);
              });
            })(item);
            oaEyeCell.appendChild(oaEyeBtn);
            row.appendChild(oaEyeCell);

            // Production avatar
            var oaTeamCell = document.createElement('div');
            oaTeamCell.className = 'prod-deliv-cell prod-deliv-team';
            oaTeamCell.appendChild(buildDeptAvatarRow(item, function () {
              fetchData(currentYM);
            }, 'production'));
            row.appendChild(oaTeamCell);

            // Label
            var oaLabelCell = document.createElement('div');
            oaLabelCell.className = 'prod-deliv-cell prod-deliv-type';
            oaLabelCell.textContent = 'Online Article';
            row.appendChild(oaLabelCell);

            // Platforms — backend seeds metadata.platforms as [] (strings)
            var oaPlatCell = document.createElement('div');
            oaPlatCell.className = 'prod-deliv-cell prod-deliv-platforms';
            var oaPlats = (item.metadata && Array.isArray(item.metadata.platforms)) ? item.metadata.platforms : [];
            oaPlats.forEach(function (p) {
              if (!p) return;
              var chip = document.createElement('span');
              chip.className = 'prod-deliv-platform-tag';
              chip.textContent = String(p);
              oaPlatCell.appendChild(chip);
            });
            row.appendChild(oaPlatCell);

            // Amount
            var oaAmtCell = document.createElement('div');
            oaAmtCell.className = 'prod-deliv-cell prod-deliv-amount';
            oaAmtCell.textContent = 'Amount: ' + String((item.metadata && item.metadata.amount) || 0);
            row.appendChild(oaAmtCell);

            // Curated amount
            var oaCurCell = document.createElement('div');
            oaCurCell.className = 'prod-deliv-cell prod-deliv-curated';
            oaCurCell.textContent = 'Curated: ' + String((item.metadata && item.metadata.curated_amount) || 0);
            row.appendChild(oaCurCell);

            // Needs Translation toggle
            var oaTransCell = document.createElement('div');
            oaTransCell.className = 'prod-deliv-cell prod-deliv-translate';
            var oaTransBtn = document.createElement('button');
            oaTransBtn.type = 'button';
            oaTransBtn.className = 'prod-deliv-translate-btn';
            oaTransBtn.textContent = 'Needs Translation';
            function applyTransState(on) {
              if (on) oaTransBtn.classList.add('is-on');
              else oaTransBtn.classList.remove('is-on');
            }
            applyTransState(!!(item.metadata && item.metadata.needs_translation));
            oaTransBtn.addEventListener('click', function (e) {
              e.stopPropagation();
              var current = !!(item.metadata && item.metadata.needs_translation);
              var next = !current;
              // Optimistic toggle
              if (!item.metadata) item.metadata = {};
              item.metadata.needs_translation = next;
              applyTransState(next);
              fetch(API_BASE + '/' + item.id, {
                method: 'PATCH',
                headers: getHeaders(),
                body: JSON.stringify({ metadata: { needs_translation: next } })
              }).then(function (res) {
                if (!res.ok) {
                  // Rollback on failure
                  item.metadata.needs_translation = current;
                  applyTransState(current);
                }
              }).catch(function () {
                item.metadata.needs_translation = current;
                applyTransState(current);
              });
            });
            oaTransCell.appendChild(oaTransBtn);
            row.appendChild(oaTransCell);

            // Spacer — pushes status + action to far right
            var oaSpacer = document.createElement('div');
            oaSpacer.className = 'prod-deliv-cell prod-deliv-spacer';
            row.appendChild(oaSpacer);

            // Status — reuse the same cell + dropdown pattern as the
            // default row below. We inline it here (no shared helper) so
            // the OA branch can stand alone.
            var oaStatusCell = document.createElement('div');
            oaStatusCell.className = 'prod-deliv-cell prod-deliv-status-cell';
            var oaBadge = document.createElement('span');
            oaBadge.className = 'proagri-sheet-status ' + statusClass(item.status);
            oaBadge.textContent = formatStatus(item.status);
            oaStatusCell.appendChild(oaBadge);
            (function (cellEl, itemRef) {
              cellEl.addEventListener('click', function (e) {
                e.stopPropagation();
                var existing = document.querySelector('.prod-deliv-status-dropdown');
                if (existing) existing.remove();
                var chain = workflows ? workflows.getStatusChain(itemRef.type) : [];
                if (chain.length === 0) return;
                var dropdown = document.createElement('div');
                dropdown.className = 'prod-deliv-status-dropdown';
                chain.forEach(function (st) {
                  var opt = document.createElement('div');
                  opt.className = 'prod-deliv-status-opt' + (st === itemRef.status ? ' active' : '');
                  var optBadge = document.createElement('span');
                  optBadge.className = 'proagri-sheet-status ' + statusClass(st);
                  optBadge.textContent = formatStatus(st);
                  opt.appendChild(optBadge);
                  opt.addEventListener('click', function (ev) {
                    ev.stopPropagation();
                    dropdown.remove();
                    if (st === itemRef.status) return;
                    fetch(API_BASE + '/' + itemRef.id, {
                      method: 'PATCH', headers: getHeaders(),
                      body: JSON.stringify({ status: st })
                    }).then(function (res) { if (res.ok) fetchData(currentYM); });
                  });
                  dropdown.appendChild(opt);
                });
                dropdown.style.position = 'fixed';
                dropdown.style.visibility = 'hidden';
                dropdown.style.top = '0px';
                dropdown.style.left = '0px';
                document.body.appendChild(dropdown);
                var rect = cellEl.getBoundingClientRect();
                var ddRect = dropdown.getBoundingClientRect();
                var top;
                if (rect.bottom + 4 + ddRect.height > window.innerHeight && rect.top - 4 - ddRect.height >= 0) {
                  top = rect.top - 4 - ddRect.height;
                } else {
                  top = rect.bottom + 4;
                }
                var left = rect.left;
                if (left + ddRect.width > window.innerWidth - 8) {
                  left = Math.max(8, window.innerWidth - ddRect.width - 8);
                }
                dropdown.style.top = top + 'px';
                dropdown.style.left = left + 'px';
                dropdown.style.visibility = 'visible';
                setTimeout(function () {
                  document.addEventListener('click', function closeDD() {
                    dropdown.remove();
                    document.removeEventListener('click', closeDD);
                  });
                }, 0);
              });
            })(oaStatusCell, item);
            row.appendChild(oaStatusCell);

            // Request Materials button — between status and advance arrows
            if (item.status === 'request_client_materials') {
              var oaReqMatCell = document.createElement('div');
              oaReqMatCell.className = 'prod-deliv-cell prod-deliv-req-mat';
              var oaReqMatBtn = document.createElement('button');
              oaReqMatBtn.type = 'button';
              oaReqMatBtn.className = 'prod-deliv-req-mat-btn';
              oaReqMatBtn.textContent = 'Request Materials';
              (function (it) {
                oaReqMatBtn.addEventListener('click', function (e) {
                  e.stopPropagation();
                  window.open('/form-builder.html?clientId=' + (it.clientId || '') + '&deliverableId=' + it.id, '_blank');
                });
              })(item);
              oaReqMatCell.appendChild(oaReqMatBtn);
              row.appendChild(oaReqMatCell);
            }

            // Advance + back arrows (reuse existing workflow helpers)
            var oaActCol = document.createElement('div');
            oaActCol.className = 'prod-deliv-cell prod-deliv-act';
            var oaBackTarget = getSendBackTarget(item.status);
            if (oaBackTarget) {
              var oaBackBtn = document.createElement('button');
              oaBackBtn.className = 'proagri-sheet-row-action-btn action-undo';
              oaBackBtn.type = 'button';
              oaBackBtn.title = 'Send back for changes (' + formatStatus(oaBackTarget) + ')';
              oaBackBtn.appendChild(makeSvgIcon('M12 20l1.41-1.41L7.83 13H20v-2H7.83l5.58-5.59L12 4l-8 8z'));
              (function (it, target) {
                oaBackBtn.addEventListener('click', function (e) {
                  e.stopPropagation();
                  fetch(API_BASE + '/' + it.id, {
                    method: 'PATCH', headers: getHeaders(),
                    body: JSON.stringify({ status: target })
                  }).then(function (res) { if (res.ok) fetchData(currentYM); });
                });
              })(item, oaBackTarget);
              oaActCol.appendChild(oaBackBtn);
            }
            var oaAdvBtn = document.createElement('button');
            oaAdvBtn.className = 'proagri-sheet-row-action-btn action-advance';
            oaAdvBtn.type = 'button';
            var oaAdvTip = (workflows && workflows.getAdvanceTooltip)
              ? workflows.getAdvanceTooltip(item.type, item.status) : '';
            oaAdvBtn.title = oaAdvTip;
            if (!oaAdvTip) oaAdvBtn.style.visibility = 'hidden';
            oaAdvBtn.appendChild(makeSvgIcon(ICON_ADVANCE));
            oaAdvBtn.addEventListener('click', function (e) {
              e.stopPropagation();
              advanceStatus(item.id, item.type, item.status);
            });
            oaActCol.appendChild(oaAdvBtn);
            row.appendChild(oaActCol);

            sheetBody.appendChild(row);
            return;
          }

          // Eye icon — open deliverable dashboard
          var eyeCell = document.createElement('div');
          eyeCell.className = 'prod-deliv-cell prod-deliv-act';
          var dashboardTypes = ['sm-content-calendar', 'website-design', 'online-articles',
            'agri4all-posts', 'agri4all-videos', 'agri4all-product-uploads',
            'agri4all-newsletter-feature', 'agri4all-newsletter-banner', 'agri4all-linkedin',
            'own-social-posts', 'own-social-videos', 'own-social-linkedin', 'own-social-twitter',
            'agri4all-banners', 'video',
            'magazine-sa-digital', 'magazine-africa-print', 'magazine-africa-digital', 'magazine-coffee-table'];
          if (dashboardTypes.indexOf(item.type) !== -1) {
            var eyeBtn = document.createElement('button');
            eyeBtn.className = 'proagri-sheet-row-action-btn action-view';
            eyeBtn.type = 'button';
            eyeBtn.title = 'View dashboard';
            eyeBtn.appendChild(makeSvgIcon('M12 4.5C7 4.5 2.73 7.61 1 12c1.73 4.39 6 7.5 11 7.5s9.27-3.11 11-7.5c-1.73-4.39-6-7.5-11-7.5zM12 17c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5zm0-8c-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3-1.34-3-3-3z'));
            (function (it) {
              eyeBtn.addEventListener('click', function (e) {
                e.stopPropagation();
                if (it.type === 'sm-content-calendar') openContentCalendarDashboard(container, it);
                else if (it.type === 'website-design') openWebsiteDesignDashboard(container, it);
                else if (it.type === 'online-articles') openOnlineArticlesDashboard(container, it);
                else if (it.type === 'agri4all-posts') openAgri4AllPostsDashboard(container, it);
                else if (it.type === 'agri4all-videos') openA4AMultiSectionDashboard(container, it, 'videos');
                else if (it.type === 'own-social-posts') openA4AMultiSectionDashboard(container, it, 'own-posts');
                else if (it.type === 'own-social-videos') openA4AMultiSectionDashboard(container, it, 'own-videos');
                else if (it.type === 'agri4all-product-uploads') openA4AProductUploadsDashboard(container, it);
                else if (it.type === 'agri4all-newsletter-feature') openA4AImageDescriptionDashboard(container, it);
                else if (it.type === 'agri4all-newsletter-banner') openA4AImageDescriptionDashboard(container, it);
                else if (it.type === 'agri4all-banners') openA4AImageDescriptionDashboard(container, it);
                else if (it.type && it.type.indexOf('magazine') === 0) openA4AImageDescriptionDashboard(container, it);
                else if (it.type === 'agri4all-linkedin') openA4ARichTextDashboard(container, it);
                else if (it.type === 'own-social-linkedin') openA4ARichTextDashboard(container, it);
                else if (it.type === 'own-social-twitter') openA4ARichTextDashboard(container, it);
                else if (it.type === 'video') openVideoDashboard(container, it);
              });
            })(item);
            eyeCell.appendChild(eyeBtn);
          }
          row.appendChild(eyeCell);

          // Team avatar — only the current dept's slot (production for this tab)
          var teamCell = document.createElement('div');
          teamCell.className = 'prod-deliv-cell prod-deliv-team';
          teamCell.appendChild(buildDeptAvatarRow(item, function () {
            fetchData(currentYM);
          }, 'production'));
          row.appendChild(teamCell);

          // Title column has been dropped from the production sheet per spec.
          // Type — for content calendar rows this cell shows the literal
          // label "Content Calendar" instead of the raw type slug.
          var typeCell = document.createElement('div');
          typeCell.className = 'prod-deliv-cell prod-deliv-type';
          typeCell.textContent = isContentCalendar ? 'Content Calendar' : formatTypeLabel(item.type);
          row.appendChild(typeCell);

          // Platforms cell — standard rows for social-media deliverable types only.
          // CC and OA rows have their own platform handling below / in custom branches.
          if (!isContentCalendar && SOCIAL_MEDIA_TYPES_WITH_PLATFORMS[item.type]) {
            var stdPlatCell = document.createElement('div');
            stdPlatCell.className = 'prod-deliv-cell prod-deliv-platforms';
            var stdMeta = item.metadata || {};
            var stdPlatformKeys = [];
            if (Array.isArray(stdMeta.platforms) && stdMeta.platforms.length > 0) {
              stdMeta.platforms.forEach(function (p) {
                var key = (typeof p === 'string') ? p : (p && p.key) || '';
                if (key) stdPlatformKeys.push(key);
              });
            } else if (item.type === 'agri4all-posts') {
              // agri4all-posts stores flat booleans instead of a platforms[] array
              if (stdMeta.facebook_posts) stdPlatformKeys.push('facebook');
              if (stdMeta.instagram_posts) stdPlatformKeys.push('instagram');
              if (stdMeta.instagram_stories) stdPlatformKeys.push('instagram_stories');
            }
            stdPlatformKeys.forEach(function (key) {
              var label = formatPlatformLabel(key, item.type);
              if (!label) return;
              var pill = document.createElement('span');
              pill.className = 'prod-deliv-platform-tag';
              pill.textContent = label;
              stdPlatCell.appendChild(pill);
            });
            row.appendChild(stdPlatCell);
          }

          // Amount column — agri4all-product-uploads rows show the contracted amount.
          if (item.type === 'agri4all-product-uploads') {
            var aPUAmtCell = document.createElement('div');
            aPUAmtCell.className = 'prod-deliv-cell prod-deliv-amount';
            aPUAmtCell.textContent = 'Amount: ' + String((item.metadata && (item.metadata.product_uploads_amount || item.metadata.amount)) || 0);
            row.appendChild(aPUAmtCell);
          }

          // Spacer: pushes right cluster (req-mat + status + actions) to far right
          if (!isContentCalendar) {
            var spacerCell = document.createElement('div');
            spacerCell.className = 'prod-deliv-cell prod-deliv-spacer';
            row.appendChild(spacerCell);
          }

          // CC-only: inline read-only platforms chips + monthly posts count.
          if (isContentCalendar) {
            var platCell = document.createElement('div');
            platCell.className = 'prod-deliv-cell prod-deliv-platforms';
            var platforms = (item.metadata && item.metadata.platforms) || [];
            var platLabels = {
              facebook: 'Facebook',
              instagram: 'Instagram',
              instagram_stories: 'Stories'
            };
            platforms.forEach(function (p) {
              if (!p || !platLabels[p.key]) return;
              var chip = document.createElement('span');
              chip.className = 'prod-deliv-platform-tag';
              chip.textContent = platLabels[p.key];
              platCell.appendChild(chip);
            });
            row.appendChild(platCell);

            var postsCell = document.createElement('div');
            postsCell.className = 'prod-deliv-cell prod-deliv-posts';
            var mp = item.metadata && item.metadata.monthly_posts;
            postsCell.textContent = (mp != null && mp !== '') ? ('Posts: ' + mp) : '';
            row.appendChild(postsCell);
          }

          // Status — clickable dropdown
          var statusCell = document.createElement('div');
          statusCell.className = 'prod-deliv-cell prod-deliv-status-cell';
          var badge = document.createElement('span');
          badge.className = 'proagri-sheet-status ' + statusClass(item.status);
          badge.textContent = formatStatus(item.status);
          statusCell.appendChild(badge);

          (function (cellEl, itemRef) {
            cellEl.addEventListener('click', function (e) {
              e.stopPropagation();
              var existing = document.querySelector('.prod-deliv-status-dropdown');
              if (existing) existing.remove();

              var chain = workflows ? workflows.getStatusChain(itemRef.type) : [];
              if (chain.length === 0) return;

              var dropdown = document.createElement('div');
              dropdown.className = 'prod-deliv-status-dropdown';

              chain.forEach(function (st) {
                var opt = document.createElement('div');
                opt.className = 'prod-deliv-status-opt' + (st === itemRef.status ? ' active' : '');
                var optBadge = document.createElement('span');
                optBadge.className = 'proagri-sheet-status ' + statusClass(st);
                optBadge.textContent = formatStatus(st);
                opt.appendChild(optBadge);
                opt.addEventListener('click', function (ev) {
                  ev.stopPropagation();
                  dropdown.remove();
                  if (st === itemRef.status) return;
                  fetch(API_BASE + '/' + itemRef.id, {
                    method: 'PATCH',
                    headers: getHeaders(),
                    body: JSON.stringify({ status: st })
                  }).then(function (res) {
                    if (res.ok) fetchData(currentYM);
                  });
                });
                dropdown.appendChild(opt);
              });

              // Append first so we can measure, then clamp to viewport.
              dropdown.style.position = 'fixed';
              dropdown.style.visibility = 'hidden';
              dropdown.style.top = '0px';
              dropdown.style.left = '0px';
              document.body.appendChild(dropdown);
              var rect = cellEl.getBoundingClientRect();
              var ddRect = dropdown.getBoundingClientRect();
              var ddH = ddRect.height;
              var ddW = ddRect.width;
              var top;
              if (rect.bottom + 4 + ddH > window.innerHeight && rect.top - 4 - ddH >= 0) {
                top = rect.top - 4 - ddH;
              } else {
                top = rect.bottom + 4;
              }
              var left = rect.left;
              if (left + ddW > window.innerWidth - 8) {
                left = Math.max(8, window.innerWidth - ddW - 8);
              }
              dropdown.style.top = top + 'px';
              dropdown.style.left = left + 'px';
              dropdown.style.visibility = 'visible';

              setTimeout(function () {
                document.addEventListener('click', function closeDD() {
                  dropdown.remove();
                  document.removeEventListener('click', closeDD);
                });
              }, 0);
            });
          })(statusCell, item);

          row.appendChild(statusCell);

          // Per-deliverable "Request Materials" button — sits between status
          // and the advance arrow. OA rows are handled in isOnlineArticles block.
          var reqMatCell = document.createElement('div');
          reqMatCell.className = 'prod-deliv-cell prod-deliv-req-mat';
          var reqMatBtn = document.createElement('button');
          reqMatBtn.type = 'button';
          reqMatBtn.className = 'prod-deliv-req-mat-btn';
          reqMatBtn.textContent = isContentCalendar ? 'Request Focus Points' : 'Request Materials';
          (function (it) {
            reqMatBtn.addEventListener('click', function (e) {
              e.stopPropagation();
              window.open('/form-builder.html?clientId=' + (it.clientId || '') + '&deliverableId=' + it.id, '_blank');
            });
          })(item);
          reqMatCell.appendChild(reqMatBtn);
          row.appendChild(reqMatCell);

          // Send-back button (only for review/approval statuses).
          var sendBackTarget = getSendBackTarget(item.status);
          var actCol = document.createElement('div');
          actCol.className = 'prod-deliv-cell prod-deliv-act';
          if (sendBackTarget) {
            var backBtn = document.createElement('button');
            backBtn.className = 'proagri-sheet-row-action-btn action-undo';
            backBtn.type = 'button';
            backBtn.title = 'Send back for changes (' + formatStatus(sendBackTarget) + ')';
            backBtn.appendChild(makeSvgIcon('M12 20l1.41-1.41L7.83 13H20v-2H7.83l5.58-5.59L12 4l-8 8z'));
            (function (it, target) {
              backBtn.addEventListener('click', function (e) {
                e.stopPropagation();
                fetch(API_BASE + '/' + it.id, {
                  method: 'PATCH', headers: getHeaders(),
                  body: JSON.stringify({ status: target })
                }).then(function (res) { if (res.ok) fetchData(currentYM); });
              });
            })(item, sendBackTarget);
            actCol.appendChild(backBtn);
          }
          var advBtn = document.createElement('button');
          advBtn.className = 'proagri-sheet-row-action-btn action-advance';
          advBtn.type = 'button';
          // Dynamic tooltip — shows the human-readable name of the target status
          // (e.g. "Advance to: Materials Requested"). Falls back to generic label
          // when there is no workflow entry for the current type/status.
          var advTip = (workflows && workflows.getAdvanceTooltip)
            ? workflows.getAdvanceTooltip(item.type, item.status)
            : '';
          advBtn.title = advTip;
          // Hide the advance button entirely on terminal statuses so it doesn't
          // look like a dead action.
          if (!advTip) advBtn.style.visibility = 'hidden';
          advBtn.appendChild(makeSvgIcon(ICON_ADVANCE));
          advBtn.addEventListener('click', function (e) {
            e.stopPropagation();
            advanceStatus(item.id, item.type, item.status);
          });
          actCol.appendChild(advBtn);
          row.appendChild(actCol);

          sheetBody.appendChild(row);
        });
      });
    }

    searchInput.addEventListener('input', renderTable);

    var currentYM = '';
    function fetchData(ym) {
      currentYM = ym;
      // Ensure employee cache is populated before rendering
      var empPromise = window._fetchEmployees ? window._fetchEmployees() : Promise.resolve([]);
      Promise.all([
        empPromise,
        fetch(API_BASE + '/by-department/production?month=' + ym, { headers: getHeaders() }).then(function (r) { return r.json(); })
      ]).then(function (results) {
        allData = results[1];
        renderTable();
      }).catch(function (err) {
        console.error('Production deliverables fetch error:', err);
      });
    }

    var monthSelector = initMonthSelector(wrapper, {
      prev: 'prodDelivPrev',
      next: 'prodDelivNext',
      label: 'prodDelivLabel'
    }, 'production', fetchData);
  }

  window.renderProductionDeliverablesTab = renderProductionDeliverablesTab;

  // ── Production > Website Design tab ─────────────────────────────────
  // Flat sheet of website-design deliverables currently on the Production
  // side of the chain (before Design takes over at site_map). Mirrors the
  // Design tab's `renderDesignWebDesignTab` implementation so both depts
  // share the exact same UX — just a different status filter.
  // ────────────────────────────────────────────────────────────────────
  var WD_PROD_STATUSES = [
    'request_client_materials', 'materials_requested', 'materials_received',
    'ready_for_approval', 'sent_for_approval', 'approved'
  ];

  var WD_PROD_TYPE_LABELS = {
    'website_design_development': 'Website Design and Development',
    'website-design-development': 'Website Design and Development',
    'web_redesign': 'Web Redesign',
    'web-redesign': 'Web Redesign',
    'monthly_website_management': 'Monthly Website Management',
    'monthly-website-management': 'Monthly Website Management'
  };

  function formatWdProdTypeLabel(raw) {
    if (raw == null || raw === '') return '\u2014';
    var s = String(raw).trim();
    if (WD_PROD_TYPE_LABELS[s]) return WD_PROD_TYPE_LABELS[s];
    var norm = s.toLowerCase().replace(/[\s_]+/g, '-');
    if (WD_PROD_TYPE_LABELS[norm]) return WD_PROD_TYPE_LABELS[norm];
    // Already a human label? Pass through common display strings.
    if (/website design/i.test(s)) return 'Website Design and Development';
    if (/redesign/i.test(s)) return 'Web Redesign';
    if (/monthly|management/i.test(s)) return 'Monthly Website Management';
    return s;
  }

  function extractWdProdPages(d) {
    var meta = d.metadata || {};
    if (typeof meta === 'string') { try { meta = JSON.parse(meta); } catch (e) { meta = {}; } }
    var bf = d.bookingForm || d.booking_form || {};
    var fd = bf.formData || bf.form_data || {};
    var candidates = [meta.pagesCount, meta.pages_count, meta.pages, meta.number_of_pages,
      fd.pages, fd.pagesCount, fd.number_of_pages];
    for (var i = 0; i < candidates.length; i++) {
      var v = candidates[i];
      if (v != null && v !== '') return v;
    }
    return '\u2014';
  }

  function extractWdProdType(d) {
    var meta = d.metadata || {};
    if (typeof meta === 'string') { try { meta = JSON.parse(meta); } catch (e) { meta = {}; } }
    var bf = d.bookingForm || d.booking_form || {};
    var fd = bf.formData || bf.form_data || {};
    return meta.websiteType || meta.website_type
      || fd.websiteType || fd.website_type
      || null;
  }

  function resolveWdProdName(d) {
    var id = d.assignedProduction || d.assigned_production || d.assignedTo || d.assigned_to;
    if (!id) return '\u2014';
    if (window._employeeCacheLookup) {
      var emp = window._employeeCacheLookup(id);
      if (emp) {
        var nm = ((emp.first_name || emp.firstName || '') + ' ' + (emp.last_name || emp.lastName || '')).trim();
        if (nm) return nm;
      }
    }
    return '\u2014';
  }



  // ── Expose reusable helpers for sibling dept pages (design, editorial) ──
  // These mirror Production's deliverables sheet exactly, so any dept that
  // wants the same `.prod-deliv-*` DOM + same CC dashboard can reuse them
  // without duplicating markup/CSS.
  window.openContentCalendarDashboard = openContentCalendarDashboard;
  window.openOnlineArticleDashboard = openOnlineArticleDashboard;
  window.openOnlineArticlesDashboard = openOnlineArticleDashboard;
  window.openWebsiteDesignDashboard = openWebsiteDesignDashboard;
  window.renderClientGroupedSheet = renderClientGroupedSheet;
  window.renderSplitSheetTab = renderSplitSheetTab;
  window.prodCols = {
    eye: colEye,
    type: colType,
    status: colStatus,
    shortDate: colShortDate,
    requestMaterials: colRequestMaterials,
    actionAdvance: colActionAdvance,
    actionAdvanceBack: colActionAdvanceBack,
    // New: dept-specific avatar column — renders the slot for the given
    // dept slug (e.g. 'design' → assignedDesign). Clicking opens the
    // inline employee picker, same as Production's team column.
    deptAvatar: function (deptSlug) {
      return {
        label: 'Team',
        className: 'prod-deliv-team',
        render: function (item, refresh) {
          return buildDeptAvatarRow(item, function () {
            if (refresh) refresh();
          }, deptSlug);
        }
      };
    },
    // New: action column that sends a deliverable back to a fixed target
    // status (used for Editorial → design_changes) AND advances forward
    // via the normal workflow. Falls back to the chain-previous when
    // backTargetStatus is null.
    actionAdvanceBackTo: function (backTargetStatus, nextStatusOrAuto, tooltipText) {
      return {
        label: '',
        className: 'prod-deliv-act',
        render: function (item, refresh) {
          var wrap = document.createElement('div');
          wrap.style.display = 'inline-flex';
          wrap.style.gap = '4px';

          if (backTargetStatus) {
            var backBtn = document.createElement('button');
            backBtn.className = 'proagri-sheet-row-action-btn action-undo';
            backBtn.type = 'button';
            backBtn.title = 'Send back for changes (' + formatStatus(backTargetStatus) + ')';
            backBtn.appendChild(makeSvgIcon('M12 20l1.41-1.41L7.83 13H20v-2H7.83l5.58-5.59L12 4l-8 8z'));
            (function (it, target) {
              backBtn.addEventListener('click', function (e) {
                e.stopPropagation();
                fetch('/api/deliverables/' + it.id, {
                  method: 'PATCH', headers: getHeaders(),
                  body: JSON.stringify({ status: target })
                }).then(function (res) { if (res.ok && refresh) refresh(); });
              });
            })(item, backTargetStatus);
            wrap.appendChild(backBtn);
          }

          var target, tooltip;
          if (nextStatusOrAuto === 'auto') {
            var wf = workflows && workflows.getNextStatus(item.type, item.status);
            if (!wf) return backTargetStatus ? wrap : '';
            target = wf.next;
            tooltip = tooltipText || wf.tooltip;
          } else {
            target = nextStatusOrAuto;
            tooltip = tooltipText || ('Advance to: ' + formatStatus(target));
          }
          var advBtn = document.createElement('button');
          advBtn.className = 'proagri-sheet-row-action-btn action-advance';
          advBtn.type = 'button';
          advBtn.title = tooltip;
          advBtn.appendChild(makeSvgIcon(ICON_ADVANCE));
          advBtn.addEventListener('click', function (e) {
            e.stopPropagation();
            fetch('/api/deliverables/' + item.id, {
              method: 'PATCH',
              headers: getHeaders(),
              body: JSON.stringify({ status: target })
            }).then(function (res) { if (res.ok && refresh) refresh(); });
          });
          wrap.appendChild(advBtn);
          return wrap;
        }
      };
    }
  };

  // ── Content Calendar Dashboard ─────────────────────────
  var _savedProdSidebar = null;
  var _ccContainer = null;
  var _ccRefreshFn = null;
  var _ccChatPoll = null;

  function stopCCChatPoll() {
    if (_ccChatPoll) {
      clearInterval(_ccChatPoll);
      _ccChatPoll = null;
    }
  }

  function openContentCalendarDashboard(container, deliverable) {
    _ccContainer = container;
    while (container.firstChild) container.removeChild(container.firstChild);

    var meta = deliverable.metadata || {};
    if (typeof meta === 'string') try { meta = JSON.parse(meta); } catch (e) { meta = {}; }
    var posts = meta.posts || [];
    var monthlyPostsCount = meta.monthly_posts || meta.posts_per_month || 0;

    // Auto-populate posts if empty
    if (posts.length === 0 && monthlyPostsCount > 0) {
      for (var i = 0; i < monthlyPostsCount; i++) {
        posts.push({ date: '', caption: '', images: [], change_requests: [] });
      }
    }

    setupCCSidebar(deliverable, meta);

    var wrapper = document.createElement('div');
    wrapper.className = 'cc-dashboard';

    // Title row
    var titleRow = document.createElement('div');
    titleRow.className = 'cc-dashboard-title-row';
    var title = document.createElement('h2');
    title.className = 'cc-dashboard-title';
    title.textContent = 'Content Calendar, ' + formatCCMonthYear(deliverable);
    titleRow.appendChild(title);
    var addRowBtn = document.createElement('button');
    addRowBtn.className = 'cc-add-row-btn';
    addRowBtn.textContent = '+ Add Post';
    addRowBtn.addEventListener('click', function () {
      posts.push({ date: '', caption: '', images: [], change_requests: [] });
      renderAllRows();
      savePostData(deliverable.id, posts);
    });
    titleRow.appendChild(addRowBtn);
    wrapper.appendChild(titleRow);

    // Materials recap (request-form responses + assets) — fetched async
    var recap = document.createElement('div');
    recap.className = 'cc-materials-recap';
    var recapEmpty = document.createElement('div');
    recapEmpty.className = 'cc-recap-loading';
    recapEmpty.textContent = 'Loading materials...';
    recap.appendChild(recapEmpty);
    wrapper.appendChild(recap);
    fetchRequestFormRecap(deliverable.id, recap);

    // ── Team chat (cd-messenger style with emoji + file uploads) ──────
    stopCCChatPoll();
    var COMMON_EMOJI_CC = [
      '\ud83d\ude00','\ud83d\ude02','\ud83d\ude0d','\ud83d\ude4f','\ud83d\udc4d','\ud83d\udc4e',
      '\ud83d\udd25','\u2764\ufe0f','\ud83d\ude22','\ud83d\ude31','\ud83d\ude0e','\ud83e\udd14',
      '\ud83d\ude4c','\ud83d\udcaf','\u2705','\u274c','\ud83d\udce3','\ud83c\udf89',
      '\ud83d\udc40','\u270d\ufe0f','\ud83d\udcc4','\ud83d\udcce','\u23f0','\ud83d\ude80'
    ];

    var chat = document.createElement('div');
    chat.className = 'cd-messenger';

    var chatHeaderEl = document.createElement('div');
    chatHeaderEl.className = 'cd-messenger-header';
    var chatTitleEl = document.createElement('div');
    chatTitleEl.className = 'cd-messenger-title';
    chatTitleEl.textContent = 'Team Chat';
    chatHeaderEl.appendChild(chatTitleEl);
    chat.appendChild(chatHeaderEl);

    var chatList = document.createElement('div');
    chatList.className = 'cd-messenger-messages';
    var chatEmpty = document.createElement('div');
    chatEmpty.className = 'cd-messenger-empty';
    chatEmpty.textContent = 'Loading chat...';
    chatList.appendChild(chatEmpty);
    chat.appendChild(chatList);

    // Input bar — emoji + attach + textarea + send
    var chatInputWrap = document.createElement('div');
    chatInputWrap.className = 'cd-messenger-input';
    chatInputWrap.style.position = 'relative';

    var emojiBtn = document.createElement('button');
    emojiBtn.className = 'cd-messenger-btn';
    emojiBtn.type = 'button';
    emojiBtn.title = 'Emoji';
    emojiBtn.textContent = '\ud83d\ude00';
    emojiBtn.style.fontSize = '16px';
    chatInputWrap.appendChild(emojiBtn);

    var attachBtn = document.createElement('button');
    attachBtn.className = 'cd-messenger-btn';
    attachBtn.type = 'button';
    attachBtn.title = 'Attach files';
    attachBtn.innerHTML = '<svg viewBox="0 0 24 24" width="18" height="18"><path fill="currentColor" d="M16.5 6v11.5c0 2.21-1.79 4-4 4s-4-1.79-4-4V5c0-1.38 1.12-2.5 2.5-2.5s2.5 1.12 2.5 2.5v10.5c0 .55-.45 1-1 1s-1-.45-1-1V6H9.5v9.5c0 1.38 1.12 2.5 2.5 2.5s2.5-1.12 2.5-2.5V5c0-2.21-1.79-4-4-4S6.5 2.79 6.5 5v12.5c0 3.04 2.46 5.5 5.5 5.5s5.5-2.46 5.5-5.5V6H16.5z"/></svg>';
    chatInputWrap.appendChild(attachBtn);

    var chatInput = document.createElement('textarea');
    chatInput.className = 'cd-messenger-textarea';
    chatInput.placeholder = 'Type a message...';
    chatInput.rows = 1;
    chatInput.disabled = true;

    var chatSend = document.createElement('button');
    chatSend.className = 'cd-messenger-btn';
    chatSend.type = 'button';
    chatSend.title = 'Send';
    chatSend.innerHTML = '<svg viewBox="0 0 24 24" width="18" height="18"><path fill="currentColor" d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/></svg>';
    chatSend.disabled = true;

    chatInputWrap.appendChild(chatInput);
    chatInputWrap.appendChild(chatSend);

    // Emoji picker
    var emojiPicker = document.createElement('div');
    emojiPicker.style.cssText = 'display:none;padding:8px;flex-wrap:wrap;gap:4px;bottom:100%;position:absolute;left:0;right:0;background:var(--card-bg,#fff);border:1px solid var(--border-color,#e2e8f0);border-radius:8px;box-shadow:0 4px 16px rgba(0,0,0,0.12);z-index:50;';
    COMMON_EMOJI_CC.forEach(function (em) {
      var btn = document.createElement('button');
      btn.type = 'button';
      btn.textContent = em;
      btn.style.cssText = 'background:none;border:none;font-size:20px;cursor:pointer;padding:4px;border-radius:4px;line-height:1;';
      btn.addEventListener('click', function () {
        var pos = chatInput.selectionStart || chatInput.value.length;
        chatInput.value = chatInput.value.substring(0, pos) + em + chatInput.value.substring(pos);
        chatInput.focus();
        emojiPicker.style.display = 'none';
      });
      emojiPicker.appendChild(btn);
    });
    chatInputWrap.appendChild(emojiPicker);
    chat.appendChild(chatInputWrap);

    emojiBtn.addEventListener('click', function () {
      emojiPicker.style.display = emojiPicker.style.display === 'none' ? 'flex' : 'none';
    });

    chatInput.addEventListener('input', function () {
      chatInput.style.height = 'auto';
      chatInput.style.height = Math.min(chatInput.scrollHeight, 100) + 'px';
      emojiPicker.style.display = 'none';
    });

    // Bottom row: chat (left) | posts card (right)
    var bottomRow = document.createElement('div');
    bottomRow.className = 'cc-bottom-row';
    bottomRow.appendChild(chat);
    wrapper.appendChild(bottomRow);

    var ccChannelId = null;
    var ccLastMessageId = 0;

    function fmtChatTime(iso) {
      if (!iso) return '';
      try {
        var d = new Date(iso);
        var now = new Date();
        var opts = (d.toDateString() === now.toDateString())
          ? { hour: '2-digit', minute: '2-digit' }
          : { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' };
        return d.toLocaleString(undefined, opts);
      } catch (e) { return ''; }
    }

    function ccAppendBubble(m, scrollToBottom) {
      // Remove empty placeholder
      var emptyEl = chatList.querySelector('.cd-messenger-empty');
      if (emptyEl) emptyEl.remove();
      // Skip duplicate
      if (chatList.querySelector('[data-message-id="' + m.id + '"]')) return;
      if (m.id > ccLastMessageId) ccLastMessageId = m.id;

      var senderId = m.sender_id || m.senderId;
      var cu = window.getCurrentUser ? window.getCurrentUser() : null;
      var isOwn = cu && cu.id && String(senderId) === String(cu.id);

      var bubble = document.createElement('div');
      bubble.className = 'cd-bubble' + (isOwn ? ' cd-bubble-own' : '');
      bubble.dataset.messageId = m.id;

      if (!isOwn) {
        var avatar = document.createElement('img');
        avatar.className = 'cd-bubble-avatar';
        avatar.alt = '';
        var photoUrl = m.senderPhotoUrl || m.sender_photo_url;
        avatar.src = photoUrl ? '/uploads/photos/' + photoUrl : 'data:image/svg+xml,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="%2394a3b8"><path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/></svg>');
        bubble.appendChild(avatar);
      }

      var body = document.createElement('div');
      body.className = 'cd-bubble-body';

      var meta = document.createElement('div');
      meta.className = 'cd-bubble-meta';
      var sender = document.createElement('span');
      sender.className = 'cd-bubble-sender';
      var first = m.sender_first_name || m.senderFirstName || '';
      var last = m.sender_last_name || m.senderLastName || '';
      sender.textContent = (first + ' ' + last).trim() || 'Unknown';
      meta.appendChild(sender);
      var ts = document.createElement('span');
      ts.className = 'cd-bubble-time';
      ts.textContent = fmtChatTime(m.created_at || m.createdAt);
      meta.appendChild(ts);
      body.appendChild(meta);

      var contentEl = document.createElement('div');
      contentEl.className = 'cd-bubble-content';
      contentEl.textContent = m.content || '';
      body.appendChild(contentEl);

      // Attachments — images inline, files as links
      var attachments = m.attachments;
      if (attachments && Array.isArray(attachments) && attachments.length > 0) {
        attachments.forEach(function (att) {
          var attEl = document.createElement('div');
          attEl.className = 'cd-bubble-attachment';
          var mime = att.mimeType || att.mime_type || '';
          var url = '/uploads/attachments/' + att.filename;
          if (mime.indexOf('image/') === 0) {
            var img = document.createElement('img');
            img.src = url;
            img.alt = att.originalName || att.original_name || 'Image';
            img.style.cssText = 'max-width:220px;max-height:200px;border-radius:6px;cursor:pointer;display:block;margin-top:4px;';
            img.addEventListener('click', function () { window.open(url, '_blank'); });
            attEl.appendChild(img);
          } else {
            var link = document.createElement('a');
            link.href = url;
            link.target = '_blank';
            link.rel = 'noopener noreferrer';
            link.innerHTML = '<svg viewBox="0 0 24 24" width="12" height="12"><path fill="currentColor" d="M14 2H6c-1.1 0-2 .9-2 2v16c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V8l-6-6zm-1 7V3.5L18.5 9H13z"/></svg>';
            var fname = document.createElement('span');
            fname.textContent = att.originalName || att.original_name || att.filename;
            link.appendChild(fname);
            attEl.appendChild(link);
          }
          body.appendChild(attEl);
        });
      }

      bubble.appendChild(body);
      chatList.appendChild(bubble);
      if (scrollToBottom) chatList.scrollTop = chatList.scrollHeight;
    }

    function scrollChatToBottom() {
      chatList.scrollTop = chatList.scrollHeight;
    }

    function loadInitialMessages() {
      if (!ccChannelId) return;
      fetch('/api/messaging/channels/' + ccChannelId + '/messages?limit=50', { headers: getHeaders() })
        .then(function (r) { return r.ok ? r.json() : []; })
        .then(function (msgs) {
          while (chatList.firstChild) chatList.removeChild(chatList.firstChild);
          ccLastMessageId = 0;
          if (!msgs || !msgs.length) {
            var empty = document.createElement('div');
            empty.className = 'cd-messenger-empty';
            empty.textContent = 'No messages yet';
            chatList.appendChild(empty);
          } else {
            msgs.forEach(function (m) { ccAppendBubble(m, false); });
            scrollChatToBottom();
          }
        })
        .catch(function () {});
    }

    function pollNewMessages() {
      if (!ccChannelId) return;
      var url = '/api/messaging/channels/' + ccChannelId + '/messages?after=' + ccLastMessageId;
      fetch(url, { headers: getHeaders() })
        .then(function (r) { return r.ok ? r.json() : []; })
        .then(function (msgs) {
          if (!msgs || !msgs.length) return;
          var before = chatList.scrollHeight;
          msgs.forEach(function (m) { ccAppendBubble(m, false); });
          if (chatList.scrollTop + chatList.clientHeight >= before - 40) scrollChatToBottom();
        })
        .catch(function () {});
    }

    function sendChatMessage() {
      var content = (chatInput.value || '').trim();
      if (!content || !ccChannelId) return;
      chatInput.value = '';
      chatInput.style.height = 'auto';
      fetch('/api/messaging/channels/' + ccChannelId + '/messages', {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({ content: content })
      })
        .then(function (r) { return r.ok ? r.json() : null; })
        .then(function (m) {
          if (m) { ccAppendBubble(m, true); }
        })
        .catch(function () {});
    }

    function sendChatFiles(files) {
      if (!ccChannelId || !files || files.length === 0) return;
      var textContent = (chatInput.value || '').trim();
      chatInput.value = '';
      chatInput.style.height = 'auto';
      Array.prototype.forEach.call(files, function (file, idx) {
        var fd = new FormData();
        fd.append('content', idx === 0 ? (textContent || file.name) : file.name);
        fd.append('file', file);
        var h = {};
        if (window.getAuthHeaders) {
          var auth = window.getAuthHeaders();
          for (var k in auth) { if (auth.hasOwnProperty(k)) h[k] = auth[k]; }
        }
        fetch('/api/messaging/channels/' + ccChannelId + '/messages', {
          method: 'POST', headers: h, body: fd
        })
          .then(function (r) { return r.ok ? r.json() : null; })
          .then(function (m) { if (m) ccAppendBubble(m, true); })
          .catch(function () {});
      });
    }

    chatSend.addEventListener('click', sendChatMessage);
    chatInput.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendChatMessage(); }
    });
    attachBtn.addEventListener('click', function () {
      if (!ccChannelId) return;
      var fileInput = document.createElement('input');
      fileInput.type = 'file';
      fileInput.multiple = true;
      fileInput.accept = 'image/*,.pdf,.doc,.docx,.xls,.xlsx,.txt';
      fileInput.addEventListener('change', function () {
        if (fileInput.files && fileInput.files.length > 0) sendChatFiles(fileInput.files);
      });
      fileInput.click();
    });

    // Resolve (or create) the channel for this deliverable
    fetch('/api/messaging/channels/for-deliverable', {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({ deliverableId: deliverable.id })
    })
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (ch) {
        if (!ch || !ch.id) {
          while (chatList.firstChild) chatList.removeChild(chatList.firstChild);
          var errRow = document.createElement('div');
          errRow.className = 'cd-messenger-empty';
          errRow.textContent = 'Chat unavailable';
          chatList.appendChild(errRow);
          return;
        }
        ccChannelId = ch.id;
        chatInput.disabled = false;
        chatSend.disabled = false;
        loadInitialMessages();
        stopCCChatPoll();
        _ccChatPoll = setInterval(pollNewMessages, 15000);
      })
      .catch(function () {});

    // Table wrapped in a card
    var card = document.createElement('div');
    card.className = 'cc-posts-card';

    var tableWrap = document.createElement('div');
    tableWrap.className = 'cc-posts-table-wrap';

    var table = document.createElement('div');
    table.className = 'cc-posts-table';

    // Header
    var thead = document.createElement('div');
    thead.className = 'cc-posts-header';
    [
      { label: '#', cls: 'cc-posts-th-num' },
      { label: 'Date', cls: 'cc-posts-th-date' },
      { label: 'Caption', cls: 'cc-posts-th-caption' },
      { label: 'Images', cls: 'cc-posts-th-images' },
      { icon: 'M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34a.996.996 0 0 0-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z', cls: 'cc-posts-th-changes', title: 'Changes' },
      { label: '', cls: 'cc-posts-th-act' }
    ].forEach(function (h) {
      var th = document.createElement('div');
      th.className = 'cc-posts-th ' + h.cls;
      if (h.icon) {
        th.appendChild(makeSvgIcon(h.icon));
        if (h.title) th.title = h.title;
      } else {
        th.textContent = h.label;
      }
      thead.appendChild(th);
    });
    table.appendChild(thead);

    var tbody = document.createElement('div');
    tbody.className = 'cc-posts-body';
    table.appendChild(tbody);
    tableWrap.appendChild(table);
    card.appendChild(tableWrap);
    bottomRow.appendChild(card);
    container.appendChild(wrapper);

    function renderAllRows() {
      while (tbody.firstChild) tbody.removeChild(tbody.firstChild);
      posts.forEach(function (post, idx) {
        tbody.appendChild(buildPostRow(post, idx, deliverable, posts));
      });
    }
    renderAllRows();
  }

  function buildPostRow(post, idx, deliverable, posts) {
    var row = document.createElement('div');
    row.className = 'cc-posts-row';

    // #
    var numCell = document.createElement('div');
    numCell.className = 'cc-posts-cell cc-posts-num';
    numCell.textContent = idx + 1;
    row.appendChild(numCell);

    // Date
    var dateCell = document.createElement('div');
    dateCell.className = 'cc-posts-cell cc-posts-date';
    var dateInput = document.createElement('input');
    dateInput.type = 'date';
    dateInput.className = 'cc-input';
    dateInput.value = post.date || '';
    dateInput.addEventListener('change', function () {
      post.date = dateInput.value;
      savePostData(deliverable.id, posts);
    });
    dateCell.appendChild(dateInput);
    row.appendChild(dateCell);

    // Caption — Quill rich text editor (with contentEditable fallback)
    var captionCell = document.createElement('div');
    captionCell.className = 'cc-posts-cell cc-posts-caption';
    var capWrap = document.createElement('div');
    capWrap.className = 'cc-caption-quill';
    captionCell.appendChild(capWrap);
    row.appendChild(captionCell);

    if (window.Quill) {
      // Defer instantiation until the wrapper is in the DOM (Quill needs it).
      setTimeout(function () {
        var quill = new Quill(capWrap, {
          theme: 'snow',
          modules: {
            toolbar: [
              ['bold', 'italic', 'underline'],
              [{ 'list': 'ordered' }, { 'list': 'bullet' }],
              ['link', 'clean']
            ]
          },
          placeholder: 'Write caption...'
        });
        quill.root.innerHTML = post.caption || '';
        var saveTimer = null;
        quill.on('text-change', function () {
          if (saveTimer) clearTimeout(saveTimer);
          saveTimer = setTimeout(function () {
            post.caption = quill.root.innerHTML;
            savePostData(deliverable.id, posts);
          }, 300);
        });
      }, 0);
    } else {
      // Fallback: contentEditable div with blur-save
      var captionEditor = document.createElement('div');
      captionEditor.className = 'cc-caption-editor';
      captionEditor.contentEditable = 'true';
      captionEditor.innerHTML = post.caption || '';
      captionEditor.setAttribute('placeholder', 'Write caption...');
      captionEditor.addEventListener('blur', function () {
        post.caption = captionEditor.innerHTML;
        savePostData(deliverable.id, posts);
      });
      capWrap.appendChild(captionEditor);
    }

    // Images
    var imgCell = document.createElement('div');
    imgCell.className = 'cc-posts-cell cc-posts-images';
    var imgGrid = document.createElement('div');
    imgGrid.className = 'cc-img-grid';

    function renderImages() {
      while (imgGrid.firstChild) imgGrid.removeChild(imgGrid.firstChild);
      (post.images || []).forEach(function (url, imgIdx) {
        var thumb = document.createElement('div');
        thumb.className = 'cc-img-thumb';
        var img = document.createElement('img');
        img.src = url;
        img.addEventListener('click', function () { openLightbox(url); });
        thumb.appendChild(img);
        var removeBtn = document.createElement('button');
        removeBtn.className = 'cc-img-remove';
        removeBtn.textContent = '\u00D7';
        removeBtn.addEventListener('click', function (e) {
          e.stopPropagation();
          post.images.splice(imgIdx, 1);
          renderImages();
          savePostData(deliverable.id, posts);
        });
        thumb.appendChild(removeBtn);
        imgGrid.appendChild(thumb);
      });
      var uploadBtn = document.createElement('label');
      uploadBtn.className = 'cc-img-upload';
      uploadBtn.textContent = '+';
      var fileInput = document.createElement('input');
      fileInput.type = 'file';
      fileInput.accept = 'image/*';
      fileInput.multiple = true;
      fileInput.style.display = 'none';
      fileInput.addEventListener('change', function () {
        var files = Array.from(fileInput.files);
        if (files.length === 0) return;
        var fd = new FormData();
        files.forEach(function (f) { fd.append('images', f); });
        fetch('/api/deliverables/' + deliverable.id + '/upload-images', {
          method: 'POST',
          headers: window.getAuthHeaders ? window.getAuthHeaders() : {},
          body: fd
        }).then(function (r) { return r.json(); })
          .then(function (result) {
            if (result.urls) {
              post.images = (post.images || []).concat(result.urls);
              renderImages();
              savePostData(deliverable.id, posts);
            }
          });
      });
      uploadBtn.appendChild(fileInput);
      imgGrid.appendChild(uploadBtn);
    }
    renderImages();
    imgCell.appendChild(imgGrid);
    row.appendChild(imgCell);

    // Change Requests (per row) — clickable cell opens modal
    if (!post.change_requests) post.change_requests = [];
    var crCell = document.createElement('div');
    crCell.className = 'cc-posts-cell cc-posts-changes';

    function renderCR() {
      while (crCell.firstChild) crCell.removeChild(crCell.firstChild);
      var trigger = document.createElement('button');
      trigger.type = 'button';
      trigger.className = 'cc-cr-trigger';
      trigger.title = 'Open change requests';
      trigger.appendChild(makeSvgIcon('M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34a.996.996 0 0 0-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z'));
      var badge = document.createElement('span');
      badge.className = 'cc-cr-count';
      badge.textContent = String(post.change_requests.length);
      if (post.change_requests.length === 0) badge.classList.add('is-empty');
      trigger.appendChild(badge);
      trigger.addEventListener('click', function () {
        openChangeRequestModal(post, deliverable, posts, renderCR);
      });
      crCell.appendChild(trigger);
    }
    renderCR();
    row.appendChild(crCell);

    // Delete row button
    var actCell = document.createElement('div');
    actCell.className = 'cc-posts-cell cc-posts-act';
    var delBtn = document.createElement('button');
    delBtn.className = 'cc-row-delete';
    delBtn.title = 'Remove post';
    delBtn.appendChild(makeSvgIcon('M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z'));
    delBtn.addEventListener('click', function () {
      posts.splice(idx, 1);
      // Re-render all rows (re-indexes)
      var tbody = row.parentNode;
      while (tbody.firstChild) tbody.removeChild(tbody.firstChild);
      posts.forEach(function (p, i) {
        tbody.appendChild(buildPostRow(p, i, deliverable, posts));
      });
      savePostData(deliverable.id, posts);
    });
    actCell.appendChild(delBtn);
    row.appendChild(actCell);

    return row;
  }

  function savePostData(deliverableId, posts) {
    fetch(API_BASE + '/' + deliverableId, {
      method: 'PATCH',
      headers: getHeaders(),
      body: JSON.stringify({ metadata: { posts: posts } })
    });
  }

  // Materials Recap — fetches the client's submitted request-form and renders it
  function fetchRequestFormRecap(deliverableId, container) {
    fetch('/api/deliverables/' + deliverableId + '/request-form', { headers: getHeaders() })
      .then(function (r) {
        if (r.status === 404) return { __notFound: true };
        return r.json();
      })
      .then(function (data) {
        while (container.firstChild) container.removeChild(container.firstChild);
        if (!data || data.__notFound || data.error) {
          var empty = document.createElement('div');
          empty.className = 'cc-recap-empty';
          empty.textContent = 'No materials request submitted yet.';
          container.appendChild(empty);
          return;
        }
        renderRequestFormRecap(container, data);
      })
      .catch(function () {
        while (container.firstChild) container.removeChild(container.firstChild);
        var empty = document.createElement('div');
        empty.className = 'cc-recap-empty';
        empty.textContent = 'No materials request submitted yet.';
        container.appendChild(empty);
      });
  }

  function renderRequestFormRecap(container, data) {
    var form = (data && data.form) || {};
    var rawFields = Array.isArray(form.fields) ? form.fields : [];
    var responses = form.responses || {};
    if (typeof responses === 'string') {
      try { responses = JSON.parse(responses); } catch (e) { responses = {}; }
    }
    var assets = Array.isArray(data.assets) ? data.assets : [];
    var unclaimedFileAssets = assets.slice();

    function isImageAsset(asset) {
      if (!asset || !asset.url) return false;
      var mime = (asset.mimeType || asset.mime_type || '').toLowerCase();
      return mime.indexOf('image/') === 0 || /\.(jpg|jpeg|png|gif|webp|svg)$/i.test(asset.url);
    }

    function claimFileAssets(count) {
      var claimed = [];
      var needed = Math.max(0, Number(count) || 0);
      for (var i = 0; i < unclaimedFileAssets.length && claimed.length < needed; i += 1) {
        var asset = unclaimedFileAssets[i];
        if (!asset || isImageAsset(asset)) continue;
        claimed.push(asset);
        unclaimedFileAssets[i] = null;
      }
      return claimed;
    }

    // Support both legacy flat field arrays and newer card+fields structures.
    function normalizeFormQuestions(raw) {
      var out = [];
      (raw || []).forEach(function (entry, cardIdx) {
        if (entry && Array.isArray(entry.fields)) {
          entry.fields.forEach(function (f, fieldIdx) {
            if (!f) return;
            var primaryKey = (f.id != null) ? String(f.id)
              : ((f.name != null) ? String(f.name) : (cardIdx + '_' + fieldIdx));
            var fallbackLegacyKey = cardIdx + '_' + fieldIdx;
            var questionText = entry.question || f.label || f.name || f.id || '';
            if (entry.question && entry.fields.length > 1 && f.label) {
              questionText = entry.question + ' - ' + f.label;
            }
            out.push({
              question: questionText,
              fieldType: f.fieldType || f.type || 'text',
              keys: [primaryKey, fallbackLegacyKey]
            });
          });
        } else {
          var legacyKey = (entry && entry.id != null) ? String(entry.id)
            : ((entry && entry.name != null) ? String(entry.name) : (cardIdx + '_0'));
          out.push({
            question: (entry && (entry.question || entry.label || entry.name || entry.id)) || '',
            fieldType: (entry && (entry.fieldType || entry.type)) || 'text',
            keys: [legacyKey, cardIdx + '_0']
          });
        }
      });
      return out;
    }
    var questions = normalizeFormQuestions(rawFields);

    var header = document.createElement('div');
    header.className = 'cc-recap-header';
    var title = document.createElement('h3');
    title.className = 'cc-recap-title';
    title.textContent = 'Materials Request';
    header.appendChild(title);
    if (form.completedAt) {
      var ts = document.createElement('span');
      ts.className = 'cc-recap-timestamp';
      try {
        ts.textContent = 'Submitted ' + new Date(form.completedAt).toLocaleString();
      } catch (e) { ts.textContent = ''; }
      header.appendChild(ts);
    }
    container.appendChild(header);

    // Responses — Q&A pairs from field definitions
    if (questions.length > 0 || (responses && typeof responses === 'object' && Object.keys(responses).length > 0)) {
      var respWrap = document.createElement('div');
      respWrap.className = 'cc-recap-responses';
      if (questions.length > 0) {
        questions.forEach(function (qItem) {
          if (!qItem) return;
          var value;
          (qItem.keys || []).some(function (k) {
            if (k == null || k === '') return false;
            if (Object.prototype.hasOwnProperty.call(responses, k)) {
              value = responses[k];
              return true;
            }
            return false;
          });
          respWrap.appendChild(buildRecapQA(qItem.question || '', value, qItem.fieldType || 'text', claimFileAssets));
        });
      } else {
        Object.keys(responses).forEach(function (k) {
          respWrap.appendChild(buildRecapQA(k, responses[k], 'text', claimFileAssets));
        });
      }
      container.appendChild(respWrap);
    }

    // Attached assets — images as thumbnails, other files as links
    if (assets.length > 0) {
      var assetsHdr = document.createElement('div');
      assetsHdr.className = 'cc-recap-assets-header';
      assetsHdr.textContent = 'Attached files (' + assets.length + ')';
      container.appendChild(assetsHdr);
      var strip = document.createElement('div');
      strip.className = 'cc-recap-assets';
      assets.forEach(function (asset) {
        if (!asset || !asset.url) return;
        var mime = (asset.mimeType || asset.mime_type || '').toLowerCase();
        var isImage = mime.indexOf('image/') === 0 || /\.(jpg|jpeg|png|gif|webp|svg)$/i.test(asset.url);
        if (isImage) {
          var thumb = document.createElement('button');
          thumb.type = 'button';
          thumb.className = 'cc-recap-thumb';
          var img = document.createElement('img');
          img.src = asset.thumbnailUrl || asset.url;
          img.alt = '';
          thumb.appendChild(img);
          thumb.addEventListener('click', function () { openLightbox(asset.url); });
          strip.appendChild(thumb);
        } else {
          var fileLink = document.createElement('a');
          fileLink.href = asset.url;
          fileLink.target = '_blank';
          fileLink.rel = 'noopener noreferrer';
          fileLink.className = 'cc-recap-file-link';
          fileLink.innerHTML = '<svg viewBox="0 0 24 24" width="14" height="14"><path fill="currentColor" d="M14 2H6c-1.1 0-2 .9-2 2v16c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V8l-6-6zm-1 7V3.5L18.5 9H13z"/></svg>';
          var fname = document.createElement('span');
          var name = asset.url.split('/').pop() || 'File';
          fname.textContent = name.length > 30 ? name.substring(0, 27) + '...' : name;
          fileLink.appendChild(fname);
          strip.appendChild(fileLink);
        }
      });
      container.appendChild(strip);
    }
  }

  function buildRecapQA(question, answer, fieldType, claimFileAssets) {
    var row = document.createElement('div');
    row.className = 'cc-recap-qa';
    var q = document.createElement('div');
    q.className = 'cc-recap-question';
    q.textContent = question || '';
    row.appendChild(q);
    var a = document.createElement('div');
    a.className = 'cc-recap-answer';

    if (answer == null || answer === '') {
      a.textContent = '\u2014';
    } else if (fieldType === 'file') {
      var names = Array.isArray(answer) ? answer : [answer];
      var linkedAssets = typeof claimFileAssets === 'function' ? claimFileAssets(names.length) : [];
      names.forEach(function (n) {
        if (!n) return;
        var linkedAsset = linkedAssets.length > 0 && linkedAssets[0] ? linkedAssets.shift() : null;
        var fileUrl = linkedAsset && linkedAsset.url ? linkedAsset.url : '';
        var linkedMime = String((linkedAsset && (linkedAsset.mimeType || linkedAsset.mime_type)) || '').toLowerCase();
        var linkedRef = String((linkedAsset && linkedAsset.url) || n).toLowerCase();
        var isImageFile = linkedMime.indexOf('image/') === 0 || /\.(jpg|jpeg|png|gif|webp|svg|bmp|heic|heif|avif)$/i.test(linkedRef);
        if (fileUrl && isImageFile) {
          var thumbBtn = document.createElement('button');
          thumbBtn.type = 'button';
          thumbBtn.className = 'cc-recap-thumb';
          var thumbImg = document.createElement('img');
          thumbImg.src = (linkedAsset && linkedAsset.thumbnailUrl) || fileUrl;
          thumbImg.alt = String(n);
          thumbBtn.appendChild(thumbImg);
          thumbBtn.addEventListener('click', function () { openLightbox(fileUrl); });
          a.appendChild(thumbBtn);
          return;
        }
        var chip = fileUrl ? document.createElement('a') : document.createElement('span');
        chip.className = fileUrl ? 'cc-recap-file-link' : 'cc-recap-file-chip';
        if (fileUrl) {
          chip.href = fileUrl;
          chip.target = '_blank';
          chip.rel = 'noopener noreferrer';
        }
        chip.innerHTML = '<svg viewBox="0 0 24 24" width="12" height="12" style="flex-shrink:0"><path fill="currentColor" d="M14 2H6c-1.1 0-2 .9-2 2v16c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V8l-6-6zm-1 7V3.5L18.5 9H13z"/></svg>';
        var s = document.createElement('span');
        s.textContent = String(n);
        chip.appendChild(s);
        a.appendChild(chip);
      });
    } else if (Array.isArray(answer)) {
      a.textContent = answer.filter(function (v) { return v != null && v !== ''; }).join(', ') || '\u2014';
    } else if (typeof answer === 'string' && /\.(jpg|jpeg|png|gif|webp|svg)$/i.test(answer)) {
      // Image URL answer — render inline thumbnail
      var img = document.createElement('img');
      img.src = answer;
      img.alt = '';
      img.style.cssText = 'max-width:120px;max-height:100px;border-radius:6px;cursor:pointer;display:block;margin-top:4px;';
      img.addEventListener('click', function () { openLightbox(answer); });
      a.appendChild(img);
    } else if (typeof answer === 'object') {
      try { a.textContent = JSON.stringify(answer); } catch (e) { a.textContent = String(answer); }
    } else {
      a.textContent = String(answer);
    }

    row.appendChild(a);
    return row;
  }

  // Change Request Modal — opens for a single post
  function openChangeRequestModal(post, deliverable, posts, onClose) {
    if (!post.change_requests) post.change_requests = [];
    var selectedIdx = post.change_requests.length > 0 ? 0 : -1;
    var carouselIdx = 0;

    var overlay = document.createElement('div');
    overlay.className = 'cc-cr-modal-overlay';
    overlay.addEventListener('click', function (e) {
      if (e.target === overlay) closeModal();
    });

    var panel = document.createElement('div');
    panel.className = 'cc-cr-modal-panel';
    overlay.appendChild(panel);

    // Header
    var header = document.createElement('div');
    header.className = 'cc-cr-modal-header';
    var h = document.createElement('h3');
    h.textContent = 'Change Requests';
    header.appendChild(h);
    var closeBtn = document.createElement('button');
    closeBtn.type = 'button';
    closeBtn.className = 'cc-cr-modal-close';
    closeBtn.setAttribute('aria-label', 'Close');
    closeBtn.textContent = '\u00D7';
    closeBtn.addEventListener('click', closeModal);
    header.appendChild(closeBtn);
    panel.appendChild(header);

    // Body (two columns)
    var body = document.createElement('div');
    body.className = 'cc-cr-modal-body';
    panel.appendChild(body);

    var carouselSide = document.createElement('div');
    carouselSide.className = 'cc-cr-modal-carousel';
    body.appendChild(carouselSide);

    var formSide = document.createElement('div');
    formSide.className = 'cc-cr-modal-form';
    body.appendChild(formSide);

    // List (below body)
    var listWrap = document.createElement('div');
    listWrap.className = 'cc-cr-modal-list';
    panel.appendChild(listWrap);

    document.body.appendChild(overlay);

    function closeModal() {
      overlay.remove();
      if (typeof onClose === 'function') onClose();
    }

    function isLegacy(cr) {
      // Legacy checklist entries: {text, done} with no id/images/created_at
      return cr && (cr.id == null) && !Array.isArray(cr.images);
    }

    function renderCarousel() {
      while (carouselSide.firstChild) carouselSide.removeChild(carouselSide.firstChild);
      var images = [];
      if (selectedIdx >= 0 && post.change_requests[selectedIdx]) {
        var cr = post.change_requests[selectedIdx];
        if (Array.isArray(cr.images)) images = cr.images.slice();
      }
      if (images.length === 0) {
        var placeholder = document.createElement('div');
        placeholder.className = 'cc-cr-carousel-placeholder';
        placeholder.textContent = 'No attachments';
        carouselSide.appendChild(placeholder);
        return;
      }
      if (carouselIdx >= images.length) carouselIdx = 0;
      var stage = document.createElement('div');
      stage.className = 'cc-cr-carousel-stage';
      var img = document.createElement('img');
      img.src = images[carouselIdx];
      img.className = 'cc-cr-carousel-img';
      stage.appendChild(img);
      if (images.length > 1) {
        var prev = document.createElement('button');
        prev.type = 'button';
        prev.className = 'cc-cr-carousel-nav cc-cr-carousel-prev';
        prev.textContent = '\u2039';
        prev.addEventListener('click', function () {
          carouselIdx = (carouselIdx - 1 + images.length) % images.length;
          renderCarousel();
        });
        stage.appendChild(prev);
        var next = document.createElement('button');
        next.type = 'button';
        next.className = 'cc-cr-carousel-nav cc-cr-carousel-next';
        next.textContent = '\u203A';
        next.addEventListener('click', function () {
          carouselIdx = (carouselIdx + 1) % images.length;
          renderCarousel();
        });
        stage.appendChild(next);
        var counter = document.createElement('div');
        counter.className = 'cc-cr-carousel-counter';
        counter.textContent = (carouselIdx + 1) + ' / ' + images.length;
        stage.appendChild(counter);
      }
      carouselSide.appendChild(stage);
    }

    function renderForm() {
      while (formSide.firstChild) formSide.removeChild(formSide.firstChild);
      if (selectedIdx === -1) {
        // New change request form
        var ta = document.createElement('textarea');
        ta.className = 'cc-cr-form-textarea';
        ta.placeholder = 'Describe the change request...';
        formSide.appendChild(ta);

        var fileLabel = document.createElement('label');
        fileLabel.className = 'cc-cr-form-file-label';
        fileLabel.textContent = 'Attach images';
        var fileInput = document.createElement('input');
        fileInput.type = 'file';
        fileInput.accept = 'image/*';
        fileInput.multiple = true;
        fileInput.className = 'cc-cr-form-file';
        fileLabel.appendChild(fileInput);
        formSide.appendChild(fileLabel);

        var selectedFilesEl = document.createElement('div');
        selectedFilesEl.className = 'cc-cr-form-selected';
        formSide.appendChild(selectedFilesEl);
        fileInput.addEventListener('change', function () {
          var files = Array.from(fileInput.files || []);
          selectedFilesEl.textContent = files.length
            ? files.length + ' file' + (files.length === 1 ? '' : 's') + ' selected'
            : '';
        });

        var submit = document.createElement('button');
        submit.type = 'button';
        submit.className = 'cc-cr-form-submit';
        submit.textContent = 'Submit';
        submit.addEventListener('click', function () {
          var text = (ta.value || '').trim();
          if (!text && (!fileInput.files || fileInput.files.length === 0)) return;
          submit.disabled = true;
          submit.textContent = 'Uploading...';

          function appendCR(urls) {
            var cr = {
              id: Date.now() + Math.random(),
              text: text,
              images: urls || [],
              created_at: new Date().toISOString(),
              created_by: (window.getCurrentUser && window.getCurrentUser()) ? window.getCurrentUser().username : null
            };
            post.change_requests.push(cr);
            selectedIdx = post.change_requests.length - 1;
            carouselIdx = 0;
            savePostData(deliverable.id, posts);
            renderAll();
          }

          var files = Array.from(fileInput.files || []);
          if (files.length === 0) {
            appendCR([]);
            return;
          }
          var fd = new FormData();
          files.forEach(function (f) { fd.append('images', f); });
          fetch('/api/deliverables/' + deliverable.id + '/upload-images', {
            method: 'POST',
            headers: window.getAuthHeaders ? window.getAuthHeaders() : {},
            body: fd
          }).then(function (r) { return r.json(); })
            .then(function (result) {
              appendCR((result && result.urls) ? result.urls : []);
            })
            .catch(function () {
              submit.disabled = false;
              submit.textContent = 'Submit';
            });
        });
        formSide.appendChild(submit);
      } else {
        // Read-only view of existing change request
        var cr = post.change_requests[selectedIdx];
        if (!cr) {
          selectedIdx = -1;
          renderForm();
          return;
        }
        var meta = document.createElement('div');
        meta.className = 'cc-cr-form-meta';
        var metaBits = [];
        if (cr.created_by) metaBits.push(cr.created_by);
        if (cr.created_at) {
          try { metaBits.push(new Date(cr.created_at).toLocaleString()); } catch (e) {}
        }
        meta.textContent = metaBits.join(' \u2022 ');
        if (metaBits.length) formSide.appendChild(meta);

        var textView = document.createElement('div');
        textView.className = 'cc-cr-form-text-view';
        textView.textContent = cr.text || '';
        formSide.appendChild(textView);

        if (isLegacy(cr)) {
          var legacyNote = document.createElement('div');
          legacyNote.className = 'cc-cr-form-legacy-note';
          legacyNote.textContent = 'Legacy checklist item';
          formSide.appendChild(legacyNote);
        }

        var delBtn = document.createElement('button');
        delBtn.type = 'button';
        delBtn.className = 'cc-cr-form-delete';
        delBtn.appendChild(makeSvgIcon('M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z'));
        var delLbl = document.createElement('span');
        delLbl.textContent = 'Delete';
        delBtn.appendChild(delLbl);
        delBtn.addEventListener('click', function () {
          if (!window.confirm('Delete this change request?')) return;
          post.change_requests.splice(selectedIdx, 1);
          savePostData(deliverable.id, posts);
          if (post.change_requests.length === 0) {
            selectedIdx = -1;
          } else if (selectedIdx >= post.change_requests.length) {
            selectedIdx = post.change_requests.length - 1;
          }
          carouselIdx = 0;
          renderAll();
        });
        formSide.appendChild(delBtn);

        var newBtn = document.createElement('button');
        newBtn.type = 'button';
        newBtn.className = 'cc-cr-form-new';
        newBtn.textContent = '+ New change request';
        newBtn.addEventListener('click', function () {
          selectedIdx = -1;
          carouselIdx = 0;
          renderAll();
        });
        formSide.appendChild(newBtn);
      }
    }

    function renderList() {
      while (listWrap.firstChild) listWrap.removeChild(listWrap.firstChild);
      if (post.change_requests.length === 0) {
        var empty = document.createElement('div');
        empty.className = 'cc-cr-modal-list-empty';
        empty.textContent = 'No change requests yet';
        listWrap.appendChild(empty);
        return;
      }
      post.change_requests.forEach(function (cr, i) {
        var chip = document.createElement('button');
        chip.type = 'button';
        chip.className = 'cc-cr-chip' + (i === selectedIdx ? ' is-selected' : '');
        var preview = (cr.text || '').replace(/\s+/g, ' ').trim().slice(0, 30);
        chip.textContent = '#' + (i + 1) + (preview ? ' - ' + preview : '');
        chip.addEventListener('click', function () {
          selectedIdx = i;
          carouselIdx = 0;
          renderAll();
        });
        listWrap.appendChild(chip);
      });
    }

    function renderAll() {
      renderCarousel();
      renderForm();
      renderList();
    }

    renderAll();
  }

  function setupCCSidebar(deliverable, meta) {
    var nav = document.querySelector('#sidebar nav');
    if (!nav) return;
    _savedProdSidebar = document.createDocumentFragment();
    while (nav.firstChild) _savedProdSidebar.appendChild(nav.firstChild);
    nav.style.overflowY = 'auto';

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
      stopCCChatPoll();
      nav.style.overflowY = '';
      while (nav.firstChild) nav.removeChild(nav.firstChild);
      nav.appendChild(_savedProdSidebar);
      _savedProdSidebar = null;
      if (_ccContainer) renderProductionDeliverablesTab(_ccContainer);
    });
    nav.appendChild(backItem);

    // Separator
    var sep = document.createElement('div');
    sep.style.cssText = 'height:1px;background:rgba(128,128,128,0.12);margin:6px 16px;';
    nav.appendChild(sep);

    // Client & title
    var section = document.createElement('div');
    section.style.padding = '4px 16px';
    var nameEl = document.createElement('div');
    nameEl.style.cssText = 'font-size:14px;font-weight:700;color:var(--text-primary,#1e293b);margin-bottom:2px;';
    nameEl.textContent = deliverable.clientName || deliverable.title || '';
    section.appendChild(nameEl);
    var monthEl = document.createElement('div');
    monthEl.style.cssText = 'font-size:11px;color:var(--text-secondary,#64748b);margin-bottom:8px;';
    monthEl.textContent = deliverable.deliveryMonth || '';
    section.appendChild(monthEl);
    nav.appendChild(section);

    // Status
    var sep2 = document.createElement('div');
    sep2.style.cssText = 'height:1px;background:rgba(128,128,128,0.12);margin:6px 16px;';
    nav.appendChild(sep2);
    var statusWrap = document.createElement('div');
    statusWrap.style.padding = '4px 16px';
    var statusBadge = document.createElement('span');
    statusBadge.className = 'proagri-sheet-status ' + statusClass(deliverable.status);
    statusBadge.textContent = formatStatus(deliverable.status);
    statusWrap.appendChild(statusBadge);
    nav.appendChild(statusWrap);

    // Posts count
    var sep3 = document.createElement('div');
    sep3.style.cssText = 'height:1px;background:rgba(128,128,128,0.12);margin:6px 16px;';
    nav.appendChild(sep3);
    var headerEl = document.createElement('div');
    headerEl.style.cssText = 'font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:0.06em;color:var(--text-secondary,#94a3b8);padding:4px 16px;';
    headerEl.textContent = 'Details';
    nav.appendChild(headerEl);

    var detailsWrap = document.createElement('div');
    detailsWrap.style.padding = '0 16px 4px';

    // Monthly Posts (read-only)
    var mpVal = (meta && (meta.monthly_posts != null ? meta.monthly_posts : meta.posts_per_month));
    if (mpVal != null && mpVal !== '') {
      var mpRow = document.createElement('div');
      mpRow.style.cssText = 'display:flex;justify-content:space-between;gap:6px;padding:2px 0;font-size:11px;';
      var mpLbl = document.createElement('span');
      mpLbl.style.color = 'var(--text-secondary,#64748b)';
      mpLbl.textContent = 'Monthly Posts';
      mpRow.appendChild(mpLbl);
      var mpVl = document.createElement('span');
      mpVl.style.cssText = 'color:var(--text-primary,#1e293b);font-weight:600;text-align:right;';
      mpVl.textContent = String(mpVal);
      mpRow.appendChild(mpVl);
      detailsWrap.appendChild(mpRow);
    }

    // Platforms (read-only pill list). Stories only if instagram present.
    var platforms = (meta && Array.isArray(meta.platforms)) ? meta.platforms : [];
    var hasFB = false, hasIG = false, hasStories = false;
    platforms.forEach(function (p) {
      if (!p) return;
      var k = p.key || '';
      if (k === 'facebook') hasFB = true;
      else if (k === 'instagram') hasIG = true;
      else if (k === 'instagram_stories' || k === 'stories') hasStories = true;
    });
    // Rule: Stories shown only if instagram present
    var showStories = hasIG && (hasStories || hasIG);
    // Per spec: "Stories" appears ONLY if an entry with key === 'instagram' exists
    showStories = hasIG;

    var platformLabels = [];
    if (hasFB) platformLabels.push('Facebook');
    if (hasIG) platformLabels.push('Instagram');
    if (showStories) platformLabels.push('Stories');

    if (platformLabels.length > 0) {
      var platRow = document.createElement('div');
      platRow.style.cssText = 'display:flex;justify-content:space-between;align-items:flex-start;gap:8px;padding:4px 0;font-size:11px;';
      var platLbl = document.createElement('span');
      platLbl.style.color = 'var(--text-secondary,#64748b)';
      platLbl.textContent = 'Platforms';
      platRow.appendChild(platLbl);
      var pillWrap = document.createElement('span');
      pillWrap.style.cssText = 'display:flex;flex-wrap:wrap;gap:4px;justify-content:flex-end;';
      platformLabels.forEach(function (lbl) {
        var pill = document.createElement('span');
        pill.textContent = lbl;
        pill.style.cssText = 'display:inline-block;padding:2px 8px;font-size:10px;font-weight:600;color:var(--text-primary,#1e293b);background:rgba(128,128,128,0.10);border-radius:10px;';
        pillWrap.appendChild(pill);
      });
      platRow.appendChild(pillWrap);
      detailsWrap.appendChild(platRow);
    }

    nav.appendChild(detailsWrap);

    // Website + social links — populated once client fetched
    var linksHeader = null, linksWrap = null;
    function ensureLinksSection() {
      if (linksHeader) return;
      var sep4 = document.createElement('div');
      sep4.style.cssText = 'height:1px;background:rgba(128,128,128,0.12);margin:6px 16px;';
      nav.appendChild(sep4);
      linksHeader = document.createElement('div');
      linksHeader.style.cssText = 'font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:0.06em;color:var(--text-secondary,#94a3b8);padding:4px 16px;';
      linksHeader.textContent = 'Links';
      nav.appendChild(linksHeader);
      linksWrap = document.createElement('div');
      linksWrap.style.padding = '0 16px 6px';
      nav.appendChild(linksWrap);
    }
    function addLinkRow(label, href) {
      if (!href) return;
      ensureLinksSection();
      var row = document.createElement('div');
      row.style.cssText = 'display:flex;gap:6px;padding:2px 0;font-size:11px;align-items:baseline;';
      var lbl = document.createElement('span');
      lbl.style.cssText = 'color:var(--text-secondary,#64748b);flex-shrink:0;';
      lbl.textContent = label + ':';
      row.appendChild(lbl);
      var a = document.createElement('a');
      a.href = /^https?:\/\//i.test(href) ? href : ('https://' + href);
      a.target = '_blank';
      a.rel = 'noopener noreferrer';
      a.textContent = href;
      a.style.cssText = 'color:var(--accent,#3b82f6);text-decoration:none;word-break:break-all;font-weight:500;';
      row.appendChild(a);
      linksWrap.appendChild(row);
    }

    // Helper: look up a meta.platforms[].link for a given key as a fallback
    function platformLinkFallback(key) {
      for (var i = 0; i < platforms.length; i++) {
        var p = platforms[i];
        if (!p || !p.link) continue;
        if ((p.key || '').toLowerCase() === key) return p.link;
      }
      return null;
    }

    // Fetch client once and render Links section with website + social URLs
    if (deliverable.clientId) {
      fetch('/api/clients/' + deliverable.clientId, { headers: getHeaders() })
        .then(function (r) { return r.json(); })
        .then(function (client) {
          if (!client || client.error) client = {};
          // Order: Website, Instagram, Facebook, LinkedIn, X
          var website = client.website || null;
          var instagram = (client.instagram != null && client.instagram !== '')
            ? client.instagram : platformLinkFallback('instagram');
          var facebook = (client.facebook != null && client.facebook !== '')
            ? client.facebook : platformLinkFallback('facebook');
          var linkedin = (client.linkedin != null && client.linkedin !== '')
            ? client.linkedin : platformLinkFallback('linkedin');
          var twitterX = (client.twitterX != null && client.twitterX !== '')
            ? client.twitterX : (platformLinkFallback('twitter_x') || platformLinkFallback('twitter') || platformLinkFallback('x'));
          addLinkRow('Website', website);
          addLinkRow('Instagram', instagram);
          addLinkRow('Facebook', facebook);
          addLinkRow('LinkedIn', linkedin);
          addLinkRow('X', twitterX);
        })
        .catch(function () {
          // On fetch failure, still render whatever we can from meta.platforms
          addLinkRow('Instagram', platformLinkFallback('instagram'));
          addLinkRow('Facebook', platformLinkFallback('facebook'));
          addLinkRow('LinkedIn', platformLinkFallback('linkedin'));
          addLinkRow('X', platformLinkFallback('twitter_x') || platformLinkFallback('twitter') || platformLinkFallback('x'));
        });
    } else {
      // No client id — render fallback social links synchronously
      addLinkRow('Instagram', platformLinkFallback('instagram'));
      addLinkRow('Facebook', platformLinkFallback('facebook'));
      addLinkRow('LinkedIn', platformLinkFallback('linkedin'));
      addLinkRow('X', platformLinkFallback('twitter_x') || platformLinkFallback('twitter') || platformLinkFallback('x'));
    }

    // Assigned Team section — show only assigned slots
    var teamSlots = DEPT_SLOTS.filter(function (s) { return deliverable[s.field]; });
    if (teamSlots.length > 0) {
      var sepT = document.createElement('div');
      sepT.style.cssText = 'height:1px;background:rgba(128,128,128,0.12);margin:6px 16px;';
      nav.appendChild(sepT);
      var teamHdr = document.createElement('div');
      teamHdr.style.cssText = 'font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:0.06em;color:var(--text-secondary,#94a3b8);padding:4px 16px;';
      teamHdr.textContent = 'Team';
      nav.appendChild(teamHdr);
      var teamWrap = document.createElement('div');
      teamWrap.style.padding = '0 16px 6px';
      teamSlots.forEach(function (slot) {
        var emp = window._employeeCacheLookup ? window._employeeCacheLookup(deliverable[slot.field]) : null;
        if (!emp) return;
        var row = document.createElement('div');
        row.style.cssText = 'display:flex;align-items:center;gap:8px;padding:3px 0;';
        row.appendChild(buildAvatar(emp, 22, slot.color));
        var info = document.createElement('div');
        info.style.cssText = 'flex:1;min-width:0;';
        var name = document.createElement('div');
        name.style.cssText = 'font-size:11px;font-weight:600;color:var(--text-primary,#1e293b);';
        name.textContent = empFullName(emp) || emp.username;
        info.appendChild(name);
        var role = document.createElement('div');
        role.style.cssText = 'font-size:10px;color:var(--text-secondary,#64748b);';
        role.textContent = slot.label;
        info.appendChild(role);
        row.appendChild(info);
        teamWrap.appendChild(row);
      });
      nav.appendChild(teamWrap);
    }
  }

  // Lightbox
  function openLightbox(url) {
    var overlay = document.createElement('div');
    overlay.className = 'cc-lightbox';
    var img = document.createElement('img');
    img.src = url;
    img.className = 'cc-lightbox-img';
    overlay.appendChild(img);
    var closeBtn = document.createElement('button');
    closeBtn.className = 'cc-lightbox-close';
    closeBtn.textContent = '\u00D7';
    closeBtn.addEventListener('click', function () { overlay.remove(); });
    overlay.appendChild(closeBtn);
    overlay.addEventListener('click', function (e) { if (e.target === overlay) overlay.remove(); });
    document.body.appendChild(overlay);
  }

  // Shared: fetch booking form data for dashboards
  function fetchBookingFormData(bookingFormId, callback) {
    fetch('/api/booking-forms/' + bookingFormId, { headers: getHeaders() })
      .then(function (r) { return r.json(); })
      .then(function (bf) {
        var fd = bf.formData || {};
        if (typeof fd === 'string') try { fd = JSON.parse(fd); } catch (e) { fd = {}; }
        callback(fd, bf);
      })
      .catch(function () { callback({}, {}); });
  }

  // Shared: build sidebar back button + details
  function setupDashboardSidebar(deliverable, buildContent) {
    var nav = document.querySelector('#sidebar nav');
    if (!nav) return;
    _savedProdSidebar = document.createDocumentFragment();
    while (nav.firstChild) _savedProdSidebar.appendChild(nav.firstChild);
    nav.style.overflowY = 'auto';

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
      stopCCChatPoll();
      nav.style.overflowY = '';
      while (nav.firstChild) nav.removeChild(nav.firstChild);
      nav.appendChild(_savedProdSidebar);
      _savedProdSidebar = null;
      if (_ccContainer) renderProductionDeliverablesTab(_ccContainer);
    });
    nav.appendChild(backItem);

    var sep = document.createElement('div');
    sep.style.cssText = 'height:1px;background:rgba(128,128,128,0.12);margin:6px 16px;';
    nav.appendChild(sep);

    // Client + status
    var sec = document.createElement('div');
    sec.style.padding = '4px 16px';
    var nameEl = document.createElement('div');
    nameEl.style.cssText = 'font-size:14px;font-weight:700;color:var(--text-primary,#1e293b);margin-bottom:2px;';
    nameEl.textContent = deliverable.clientName || deliverable.title || '';
    sec.appendChild(nameEl);
    var monthEl = document.createElement('div');
    monthEl.style.cssText = 'font-size:11px;color:var(--text-secondary,#64748b);margin-bottom:6px;';
    monthEl.textContent = deliverable.deliveryMonth || '';
    sec.appendChild(monthEl);
    var badge = document.createElement('span');
    badge.className = 'proagri-sheet-status ' + statusClass(deliverable.status);
    badge.textContent = formatStatus(deliverable.status);
    sec.appendChild(badge);
    nav.appendChild(sec);

    // Assigned Team section — show only assigned slots
    var teamSlots = DEPT_SLOTS.filter(function (s) { return deliverable[s.field]; });
    if (teamSlots.length > 0) {
      addSidebarSection(nav, 'Assigned Team');
      var teamWrap = document.createElement('div');
      teamWrap.style.padding = '0 16px 4px';
      teamSlots.forEach(function (slot) {
        var emp = window._employeeCacheLookup ? window._employeeCacheLookup(deliverable[slot.field]) : null;
        if (!emp) return;
        var row = document.createElement('div');
        row.style.cssText = 'display:flex;align-items:center;gap:8px;padding:3px 0;';
        row.appendChild(buildAvatar(emp, 22, slot.color));
        var info = document.createElement('div');
        info.style.cssText = 'flex:1;min-width:0;';
        var name = document.createElement('div');
        name.style.cssText = 'font-size:11px;font-weight:600;color:var(--text-primary,#1e293b);';
        name.textContent = empFullName(emp) || emp.username;
        info.appendChild(name);
        var role = document.createElement('div');
        role.style.cssText = 'font-size:10px;color:var(--text-secondary,#64748b);';
        role.textContent = slot.label;
        info.appendChild(role);
        row.appendChild(info);
        teamWrap.appendChild(row);
      });
      nav.appendChild(teamWrap);
    }

    // Fetch client details and show
    if (deliverable.clientId) {
      fetch('/api/clients/' + deliverable.clientId, { headers: getHeaders() })
        .then(function (r) { return r.json(); })
        .then(function (client) {
          if (!client || client.error) return;
          addSidebarSection(nav, 'Client Info');
          var wrap = document.createElement('div');
          wrap.style.padding = '0 16px 4px';
          addSidebarField(wrap, 'Name', client.name);
          addSidebarField(wrap, 'Trading', client.tradingName);
          addSidebarField(wrap, 'Email', client.email);
          addSidebarField(wrap, 'Phone', client.phone);
          addSidebarField(wrap, 'Website', client.website);
          nav.appendChild(wrap);

          // Contact details
          var contacts = [
            { label: 'Primary', data: client.primaryContact },
            { label: 'Material', data: client.materialContact },
            { label: 'Accounts', data: client.accountsContact }
          ];
          var hasAnyContact = contacts.some(function (c) {
            var d = c.data;
            if (typeof d === 'string') try { d = JSON.parse(d); } catch (e) { d = {}; }
            return d && (d.name || d.email || d.cell || d.tel);
          });
          if (hasAnyContact) {
            addSidebarSection(nav, 'Contacts');
            contacts.forEach(function (c) {
              var d = c.data;
              if (typeof d === 'string') try { d = JSON.parse(d); } catch (e) { d = {}; }
              if (!d || (!d.name && !d.email && !d.cell)) return;
              var block = document.createElement('div');
              block.style.cssText = 'padding:4px 16px 6px;';
              var lbl = document.createElement('div');
              lbl.style.cssText = 'font-size:10px;font-weight:600;text-transform:uppercase;color:var(--text-secondary,#94a3b8);margin-bottom:2px;';
              lbl.textContent = c.label;
              block.appendChild(lbl);
              if (d.name) {
                var n = document.createElement('div');
                n.style.cssText = 'font-size:12px;font-weight:600;color:var(--text-primary,#1e293b);';
                n.textContent = d.name;
                block.appendChild(n);
              }
              if (d.email) {
                var e2 = document.createElement('div');
                e2.style.cssText = 'font-size:11px;color:var(--text-secondary,#64748b);';
                e2.textContent = d.email;
                block.appendChild(e2);
              }
              if (d.cell) {
                var cell2 = document.createElement('div');
                cell2.style.cssText = 'font-size:11px;color:var(--text-secondary,#64748b);';
                cell2.textContent = d.cell;
                block.appendChild(cell2);
              }
              nav.appendChild(block);
            });
          }
        });
    }

    buildContent(nav);
  }

  function addSidebarSection(nav, title) {
    var sep = document.createElement('div');
    sep.style.cssText = 'height:1px;background:rgba(128,128,128,0.12);margin:6px 16px;';
    nav.appendChild(sep);
    var h = document.createElement('div');
    h.style.cssText = 'font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:0.06em;color:var(--text-secondary,#94a3b8);padding:4px 16px;';
    h.textContent = title;
    nav.appendChild(h);
  }

  function addSidebarField(parent, label, value) {
    if (!value) return;
    var row = document.createElement('div');
    row.style.cssText = 'display:flex;justify-content:space-between;gap:6px;padding:2px 0;font-size:11px;';
    var lbl = document.createElement('span');
    lbl.style.color = 'var(--text-secondary,#64748b)';
    lbl.textContent = label;
    row.appendChild(lbl);
    var val = document.createElement('span');
    val.style.cssText = 'color:var(--text-primary,#1e293b);font-weight:500;text-align:right;word-break:break-word;';
    val.textContent = value;
    row.appendChild(val);
    parent.appendChild(row);
  }

  // Shared: file upload area builder
  function buildUploadArea(deliverableId, files, onUpdate, label) {
    var wrap = document.createElement('div');
    wrap.className = 'wd-upload-area';

    var grid = document.createElement('div');
    grid.className = 'cc-img-grid';

    function render() {
      while (grid.firstChild) grid.removeChild(grid.firstChild);
      (files || []).forEach(function (url, i) {
        var thumb = document.createElement('div');
        thumb.className = 'wd-file-thumb';
        var isImage = /\.(jpg|jpeg|png|gif|webp|svg)$/i.test(url);
        if (isImage) {
          var img = document.createElement('img');
          img.src = url;
          img.addEventListener('click', function () { openLightbox(url); });
          // Fallback: if the image file is missing on disk (common after a
          // redeploy with no persistent uploads volume), replace the <img>
          // with a visible filename link so operators can see WHAT vanished.
          img.addEventListener('error', function () {
            var fallback = document.createElement('a');
            fallback.href = url;
            fallback.target = '_blank';
            fallback.rel = 'noopener';
            fallback.className = 'wd-file-link';
            fallback.style.cssText = 'display:flex;flex-direction:column;gap:6px;align-items:center;justify-content:center;padding:10px;font-size:11px;color:#b45309;text-align:center;word-break:break-all;';
            fallback.innerHTML = '<span style="font-size:18px">⚠</span>' +
              '<span style="font-weight:700;">File missing</span>' +
              '<span style="opacity:0.8">' + (url.split('/').pop()) + '</span>';
            if (img.parentNode) img.parentNode.replaceChild(fallback, img);
          });
          thumb.appendChild(img);
        } else {
          var link = document.createElement('a');
          link.href = url;
          link.target = '_blank';
          link.textContent = url.split('/').pop();
          link.className = 'wd-file-link';
          thumb.appendChild(link);
        }
        var rm = document.createElement('button');
        rm.className = 'cc-img-remove';
        rm.textContent = '\u00D7';
        rm.addEventListener('click', function (e) {
          e.stopPropagation();
          files.splice(i, 1);
          render();
          onUpdate();
        });
        thumb.appendChild(rm);
        grid.appendChild(thumb);
      });

      var uploadBtn = document.createElement('label');
      uploadBtn.className = 'cc-img-upload';
      uploadBtn.textContent = '+';
      uploadBtn.title = label || 'Upload files';
      var fileInput = document.createElement('input');
      fileInput.type = 'file';
      fileInput.accept = 'image/*,.pdf,.doc,.docx,.xd,.fig,.sketch';
      fileInput.multiple = true;
      fileInput.style.display = 'none';
      fileInput.addEventListener('change', function () {
        var fList = Array.from(fileInput.files);
        if (fList.length === 0) return;
        var fd = new FormData();
        fList.forEach(function (f) { fd.append('images', f); });
        fetch('/api/deliverables/' + deliverableId + '/upload-images', {
          method: 'POST',
          headers: window.getAuthHeaders ? window.getAuthHeaders() : {},
          body: fd
        }).then(function (r) { return r.json(); })
          .then(function (result) {
            if (result.urls) {
              result.urls.forEach(function (u) { files.push(u); });
              render();
              onUpdate();
            }
          });
      });
      uploadBtn.appendChild(fileInput);
      grid.appendChild(uploadBtn);
    }
    render();
    wrap.appendChild(grid);
    return wrap;
  }

  // ══════ WEBSITE DESIGN DASHBOARD ══════════════════════════
  function openWebsiteDesignDashboard(container, deliverable) {
    _ccContainer = container;
    while (container.firstChild) container.removeChild(container.firstChild);

    var meta = deliverable.metadata || {};
    if (typeof meta === 'string') try { meta = JSON.parse(meta); } catch (e) { meta = {}; }
    if (!meta.steps) {
      meta.steps = [
        { name: 'Meeting Notes / Brief', description: '', files: [] },
        { name: 'Sitemap', description: '', files: [] },
        { name: 'Wireframe', description: '', files: [] },
        { name: 'Prototype / Design', description: '', files: [] },
        { name: 'Development', description: '', files: [] },
        { name: 'Hosting & SEO', description: '', files: [] }
      ];
    }

    function save() {
      fetch(API_BASE + '/' + deliverable.id, {
        method: 'PATCH', headers: getHeaders(),
        body: JSON.stringify({ metadata: { steps: meta.steps } })
      });
    }

    // Sidebar
    setupDashboardSidebar(deliverable, function (nav) {
      addSidebarSection(nav, 'Website Details');
      var wrap = document.createElement('div');
      wrap.style.padding = '0 16px';
      addSidebarField(wrap, 'Type', meta.website_type);
      addSidebarField(wrap, 'Pages', meta.number_of_pages);
      nav.appendChild(wrap);

      // Fetch booking form for extra client info
      if (deliverable.bookingFormId) {
        fetchBookingFormData(deliverable.bookingFormId, function (fd) {
          var ci = fd.client_information || {};
          if (ci.website) {
            addSidebarSection(nav, 'Client Website');
            var wWrap = document.createElement('div');
            wWrap.style.padding = '0 16px';
            var link = document.createElement('a');
            link.href = ci.website;
            link.target = '_blank';
            link.textContent = ci.website;
            link.style.cssText = 'font-size:11px;color:var(--accent-color,#3b82f6);word-break:break-all;';
            wWrap.appendChild(link);
            nav.appendChild(wWrap);
          }
          // Social links
          var sm = (fd.social_media_management || [])[0];
          if (sm && sm.platforms && sm.platforms.length > 0) {
            addSidebarSection(nav, 'Social Media');
            var sWrap = document.createElement('div');
            sWrap.style.padding = '0 16px';
            sm.platforms.forEach(function (p) {
              if (!p.link) return;
              var a = document.createElement('a');
              a.href = p.link;
              a.target = '_blank';
              a.style.cssText = 'display:block;font-size:11px;color:var(--accent-color,#3b82f6);margin:2px 0;word-break:break-all;';
              a.textContent = p.platform + ': ' + p.link;
              sWrap.appendChild(a);
            });
            nav.appendChild(sWrap);
          }
          // Project description
          if (ci.project_description) {
            addSidebarSection(nav, 'Project Brief');
            var bWrap = document.createElement('div');
            bWrap.style.cssText = 'padding:0 16px;font-size:11px;color:var(--text-primary,#1e293b);line-height:1.4;';
            bWrap.textContent = ci.project_description;
            nav.appendChild(bWrap);
          }
        });
      }
    });

    // Rename legacy "Sitemap" label to "Site Map" for display (data key unchanged)
    meta.steps.forEach(function (s) {
      if (s && s.name === 'Sitemap') s.name = 'Site Map';
    });

    // Main content — two-column layout (materials + chat on left, steps on right)
    var wrapper = document.createElement('div');
    wrapper.className = 'wd-dashboard';

    // Header
    var headerEl = document.createElement('div');
    headerEl.className = 'wd-header';
    var h2 = document.createElement('h2');
    h2.className = 'wd-header-title';
    h2.textContent = 'Website Design';
    var sub = document.createElement('div');
    sub.className = 'wd-header-sub';
    sub.textContent = deliverable.clientName || deliverable.client_name || deliverable.title || '';
    headerEl.appendChild(h2);
    headerEl.appendChild(sub);
    wrapper.appendChild(headerEl);

    // Body: left (70%) + right (30%)
    var body = document.createElement('div');
    body.className = 'wd-body';

    var leftCol = document.createElement('div');
    leftCol.className = 'wd-left';

    // ── Materials recap ──
    var recap = document.createElement('div');
    recap.className = 'wd-materials-recap cc-materials-recap';
    var recapLoading = document.createElement('div');
    recapLoading.className = 'cc-recap-loading';
    recapLoading.textContent = 'Loading materials...';
    recap.appendChild(recapLoading);
    leftCol.appendChild(recap);
    fetchRequestFormRecap(deliverable.id, recap);

    // ── Messages section with "show in main messages" toggle ──
    var msgWrap = document.createElement('div');
    msgWrap.className = 'wd-messages-wrap';

    var linkLabel = document.createElement('label');
    linkLabel.className = 'wd-link-messages';
    var linkCb = document.createElement('input');
    linkCb.type = 'checkbox';
    var linkText = document.createElement('span');
    linkText.textContent = 'Show in main messages';
    linkLabel.appendChild(linkCb);
    linkLabel.appendChild(linkText);
    msgWrap.appendChild(linkLabel);

    // Per-deliverable chat — styled to match the proposal-page messenger
    stopCCChatPoll();
    var chat = document.createElement('div');
    chat.className = 'cd-messenger';

    var chatHeaderEl = document.createElement('div');
    chatHeaderEl.className = 'cd-messenger-header';
    var chatTitleEl = document.createElement('div');
    chatTitleEl.className = 'cd-messenger-title';
    chatTitleEl.textContent = 'Team Chat';
    chatHeaderEl.appendChild(chatTitleEl);
    chat.appendChild(chatHeaderEl);

    var chatList = document.createElement('div');
    chatList.className = 'cd-messenger-messages';
    var chatEmpty = document.createElement('div');
    chatEmpty.className = 'cd-messenger-empty';
    chatEmpty.textContent = 'Loading chat...';
    chatList.appendChild(chatEmpty);
    chat.appendChild(chatList);

    var chatInputWrap = document.createElement('div');
    chatInputWrap.className = 'cd-messenger-input';
    var chatInput = document.createElement('textarea');
    chatInput.className = 'cd-messenger-textarea';
    chatInput.placeholder = 'Type a message...';
    chatInput.rows = 1;
    chatInput.disabled = true;
    var chatSend = document.createElement('button');
    chatSend.className = 'cd-messenger-btn';
    chatSend.type = 'button';
    chatSend.title = 'Send';
    chatSend.innerHTML = '<svg viewBox="0 0 24 24" width="18" height="18"><path fill="currentColor" d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/></svg>';
    chatSend.disabled = true;
    chatInputWrap.appendChild(chatInput);
    chatInputWrap.appendChild(chatSend);
    chat.appendChild(chatInputWrap);
    msgWrap.appendChild(chat);
    leftCol.appendChild(msgWrap);

    // Auto-resize textarea
    chatInput.addEventListener('input', function () {
      chatInput.style.height = 'auto';
      chatInput.style.height = Math.min(chatInput.scrollHeight, 100) + 'px';
    });

    var wdChannelId = null;
    var wdLastMessageId = 0;
    var wdKnownIds = Object.create(null);

    function wdFmtChatTime(iso) {
      if (!iso) return '';
      try {
        var d = new Date(iso);
        var now = new Date();
        var opts = (d.toDateString() === now.toDateString())
          ? { hour: '2-digit', minute: '2-digit' }
          : { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' };
        return d.toLocaleString(undefined, opts);
      } catch (e) { return ''; }
    }

    function wdRenderChatMessage(m) {
      if (!m || wdKnownIds[m.id]) return;
      wdKnownIds[m.id] = true;
      if (m.id > wdLastMessageId) wdLastMessageId = m.id;

      var senderId = m.sender_id || m.senderId;
      var cu = window.getCurrentUser ? window.getCurrentUser() : null;
      var isOwn = cu && cu.id && String(senderId) === String(cu.id);

      var bubble = document.createElement('div');
      bubble.className = 'cd-bubble' + (isOwn ? ' cd-bubble-own' : '');

      var body = document.createElement('div');
      body.className = 'cd-bubble-body';

      var meta = document.createElement('div');
      meta.className = 'cd-bubble-meta';
      var sender = document.createElement('span');
      sender.className = 'cd-bubble-sender';
      var first = m.sender_first_name || m.senderFirstName || '';
      var last = m.sender_last_name || m.senderLastName || '';
      sender.textContent = (first + ' ' + last).trim() || 'Unknown';
      meta.appendChild(sender);
      var ts = document.createElement('span');
      ts.className = 'cd-bubble-time';
      ts.textContent = wdFmtChatTime(m.created_at || m.createdAt);
      meta.appendChild(ts);
      body.appendChild(meta);

      var contentEl = document.createElement('div');
      contentEl.className = 'cd-bubble-content';
      contentEl.textContent = m.content || '';
      body.appendChild(contentEl);

      bubble.appendChild(body);
      chatList.appendChild(bubble);
    }

    function wdScrollBottom() { chatList.scrollTop = chatList.scrollHeight; }

    function wdLoadInitial() {
      if (!wdChannelId) return;
      fetch('/api/messaging/channels/' + wdChannelId + '/messages?limit=50', { headers: getHeaders() })
        .then(function (r) { return r.ok ? r.json() : []; })
        .then(function (msgs) {
          while (chatList.firstChild) chatList.removeChild(chatList.firstChild);
          wdKnownIds = Object.create(null);
          wdLastMessageId = 0;
          if (!msgs || !msgs.length) {
            var empty = document.createElement('div');
            empty.className = 'cd-messenger-empty';
            empty.textContent = 'No messages yet';
            chatList.appendChild(empty);
          } else {
            msgs.forEach(wdRenderChatMessage);
          }
          wdScrollBottom();
        })
        .catch(function () {});
    }

    function wdPollNew() {
      if (!wdChannelId) return;
      fetch('/api/messaging/channels/' + wdChannelId + '/messages?after=' + wdLastMessageId, { headers: getHeaders() })
        .then(function (r) { return r.ok ? r.json() : []; })
        .then(function (msgs) {
          if (!msgs || !msgs.length) return;
          // Clear "No messages yet" placeholder if present
          var emptyEl = chatList.querySelector('.cd-messenger-empty');
          if (emptyEl) emptyEl.remove();
          var before = chatList.scrollHeight;
          msgs.forEach(wdRenderChatMessage);
          if (chatList.scrollTop + chatList.clientHeight >= before - 40) wdScrollBottom();
        })
        .catch(function () {});
    }

    function wdSend() {
      var content = (chatInput.value || '').trim();
      if (!content || !wdChannelId) return;
      chatSend.disabled = true;
      fetch('/api/messaging/channels/' + wdChannelId + '/messages', {
        method: 'POST', headers: getHeaders(),
        body: JSON.stringify({ content: content })
      })
        .then(function (r) { return r.ok ? r.json() : null; })
        .then(function (m) {
          chatSend.disabled = false;
          if (m) { chatInput.value = ''; wdRenderChatMessage(m); wdScrollBottom(); }
        })
        .catch(function () { chatSend.disabled = false; });
    }

    chatSend.addEventListener('click', wdSend);
    chatInput.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); wdSend(); }
    });

    fetch('/api/messaging/channels/for-deliverable', {
      method: 'POST', headers: getHeaders(),
      body: JSON.stringify({ deliverableId: deliverable.id })
    })
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (ch) {
        if (!ch || !ch.id) {
          while (chatList.firstChild) chatList.removeChild(chatList.firstChild);
          var errRow = document.createElement('div');
          errRow.className = 'cd-messenger-empty';
          errRow.textContent = 'Chat unavailable';
          chatList.appendChild(errRow);
          return;
        }
        wdChannelId = ch.id;
        // Reflect any existing linkToMain state if the API returned it.
        if (typeof ch.link_to_main !== 'undefined') linkCb.checked = !!ch.link_to_main;
        else if (typeof ch.linkToMain !== 'undefined') linkCb.checked = !!ch.linkToMain;
        chatInput.disabled = false;
        chatSend.disabled = false;
        wdLoadInitial();
        stopCCChatPoll();
        _ccChatPoll = setInterval(wdPollNew, 15000);
      })
      .catch(function () {});

    linkCb.addEventListener('change', function () {
      // TODO: backend may not yet support linkToMain on
      // /api/messaging/channels/for-deliverable — if it returns non-OK we
      // just log and leave the checkbox state in place.
      fetch('/api/messaging/channels/for-deliverable', {
        method: 'POST', headers: getHeaders(),
        body: JSON.stringify({ deliverableId: deliverable.id, linkToMain: linkCb.checked })
      }).then(function (r) {
        if (!r.ok) console.warn('[wd] linkToMain not supported by backend yet');
      }).catch(function () {
        console.warn('[wd] linkToMain request failed');
      });
    });

    body.appendChild(leftCol);

    // ── Right column: step cards ──
    var rightCol = document.createElement('div');
    rightCol.className = 'wd-right';

    meta.steps.forEach(function (step, idx) {
      var stepEl = document.createElement('div');
      stepEl.className = 'wd-step';

      var stepHeader = document.createElement('div');
      stepHeader.className = 'wd-step-header';
      var stepNum = document.createElement('span');
      stepNum.className = 'wd-step-num';
      stepNum.textContent = idx + 1;
      stepHeader.appendChild(stepNum);
      var stepTitle = document.createElement('span');
      stepTitle.className = 'wd-step-title';
      stepTitle.textContent = step.name;
      stepHeader.appendChild(stepTitle);
      stepEl.appendChild(stepHeader);

      var descEditor = document.createElement('div');
      descEditor.className = 'cc-caption-editor';
      descEditor.contentEditable = 'true';
      descEditor.innerHTML = step.description || '';
      descEditor.setAttribute('placeholder', 'Add notes...');
      descEditor.addEventListener('blur', function () {
        step.description = descEditor.innerHTML;
        save();
      });
      stepEl.appendChild(descEditor);

      stepEl.appendChild(buildUploadArea(deliverable.id, step.files, save, 'Upload ' + step.name + ' files'));

      rightCol.appendChild(stepEl);
    });

    body.appendChild(rightCol);
    wrapper.appendChild(body);
    container.appendChild(wrapper);
  }

  // ══════ ONLINE ARTICLE DASHBOARD ═════════════════════════
  // Mirrors openContentCalendarDashboard structure: materials recap +
  // bottom row (team chat | Quill article editor). Backed by
  // metadata.article_body (set/seeded by the backend).
  function openOnlineArticleDashboard(container, deliverable) {
    _ccContainer = container;
    while (container.firstChild) container.removeChild(container.firstChild);

    var meta = deliverable.metadata || {};
    if (typeof meta === 'string') try { meta = JSON.parse(meta); } catch (e) { meta = {}; }

    // Sidebar — reuse the generic dashboard sidebar (back button wired to
    // renderProductionDeliverablesTab by setupDashboardSidebar).
    setupDashboardSidebar(deliverable, function (nav) {
      addSidebarSection(nav, 'Article Details');
      var wrap = document.createElement('div');
      wrap.style.padding = '0 16px';
      addSidebarField(wrap, 'Articles', meta.amount);
      addSidebarField(wrap, 'Curated', meta.curated_amount);
      addSidebarField(wrap, 'Translation', meta.needs_translation ? 'Needed' : '');
      nav.appendChild(wrap);

      if (meta.platforms && meta.platforms.length) {
        addSidebarSection(nav, 'Publish To');
        var pWrap = document.createElement('div');
        pWrap.style.padding = '0 16px';
        meta.platforms.forEach(function (p) {
          var tag = document.createElement('div');
          tag.style.cssText = 'display:inline-block;padding:3px 10px;margin:2px 4px 2px 0;border-radius:12px;font-size:11px;font-weight:600;background:rgba(59,130,246,0.1);color:#3b82f6;';
          tag.textContent = p;
          pWrap.appendChild(tag);
        });
        nav.appendChild(pWrap);
      }
    });

    var wrapper = document.createElement('div');
    wrapper.className = 'oa-dashboard';

    // Header
    var header = document.createElement('div');
    header.className = 'oa-header';
    var title = document.createElement('h2');
    title.className = 'oa-title';
    title.textContent = 'Online Article \u2014 ' + (deliverable.clientName || deliverable.title || '');
    header.appendChild(title);
    wrapper.appendChild(header);

    // Materials recap — reuse the CC helper (fetches the request-form
    // answers + uploaded assets tied to this deliverable).
    var recap = document.createElement('div');
    recap.className = 'oa-materials-recap cc-materials-recap';
    var recapEmpty = document.createElement('div');
    recapEmpty.className = 'cc-recap-loading';
    recapEmpty.textContent = 'Loading materials...';
    recap.appendChild(recapEmpty);
    wrapper.appendChild(recap);
    fetchRequestFormRecap(deliverable.id, recap);

    // Bottom row: chat (left ~30%) | article card (right ~70%)
    var bottomRow = document.createElement('div');
    bottomRow.className = 'oa-bottom-row';

    // ── Chat box (reuse cc-chat-* classes + polling logic) ──
    stopCCChatPoll();
    var chat = document.createElement('div');
    chat.className = 'cc-chat-box oa-chat-box';
    var chatHeader = document.createElement('div');
    chatHeader.className = 'cc-chat-header';
    chatHeader.textContent = 'Team Chat';
    chat.appendChild(chatHeader);

    var chatList = document.createElement('div');
    chatList.className = 'cc-chat-list';
    var chatLoading = document.createElement('div');
    chatLoading.className = 'cc-chat-msg-header';
    chatLoading.textContent = 'Loading chat...';
    chatList.appendChild(chatLoading);
    chat.appendChild(chatList);

    var chatInputWrap = document.createElement('div');
    chatInputWrap.className = 'cc-chat-input-wrap';
    var chatInput = document.createElement('textarea');
    chatInput.className = 'cc-chat-input';
    chatInput.placeholder = 'Type a message...';
    chatInput.disabled = true;
    var chatSend = document.createElement('button');
    chatSend.className = 'cc-chat-send';
    chatSend.textContent = 'Send';
    chatSend.disabled = true;
    chatInputWrap.appendChild(chatInput);
    chatInputWrap.appendChild(chatSend);
    chat.appendChild(chatInputWrap);
    bottomRow.appendChild(chat);

    var oaChannelId = null;
    var oaLastMessageId = 0;
    var oaKnownIds = Object.create(null);

    function fmtChatTime(iso) {
      if (!iso) return '';
      try {
        var d = new Date(iso);
        var now = new Date();
        var opts = (d.toDateString() === now.toDateString())
          ? { hour: '2-digit', minute: '2-digit' }
          : { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' };
        return d.toLocaleString(undefined, opts);
      } catch (e) { return ''; }
    }

    function renderChatMessage(m) {
      if (!m || oaKnownIds[m.id]) return;
      oaKnownIds[m.id] = true;
      if (m.id > oaLastMessageId) oaLastMessageId = m.id;
      var row = document.createElement('div');
      row.className = 'cc-chat-msg';
      var hdr = document.createElement('div');
      hdr.className = 'cc-chat-msg-header';
      var who = document.createElement('strong');
      var first = m.sender_first_name || m.senderFirstName || '';
      var last = m.sender_last_name || m.senderLastName || '';
      who.textContent = (first + ' ' + last).trim() || 'Unknown';
      hdr.appendChild(who);
      var ts = document.createElement('span');
      ts.textContent = fmtChatTime(m.created_at || m.createdAt);
      hdr.appendChild(ts);
      row.appendChild(hdr);
      var body = document.createElement('div');
      body.className = 'cc-chat-msg-body';
      body.textContent = m.content || '';
      row.appendChild(body);
      chatList.appendChild(row);
    }

    function scrollChatToBottom() {
      chatList.scrollTop = chatList.scrollHeight;
    }

    function loadInitialMessages() {
      if (!oaChannelId) return;
      fetch('/api/messaging/channels/' + oaChannelId + '/messages?limit=50', { headers: getHeaders() })
        .then(function (r) { return r.ok ? r.json() : []; })
        .then(function (msgs) {
          while (chatList.firstChild) chatList.removeChild(chatList.firstChild);
          oaKnownIds = Object.create(null);
          oaLastMessageId = 0;
          (msgs || []).forEach(renderChatMessage);
          scrollChatToBottom();
        })
        .catch(function () {});
    }

    function pollNewMessages() {
      if (!oaChannelId) return;
      var url = '/api/messaging/channels/' + oaChannelId + '/messages?after=' + oaLastMessageId;
      fetch(url, { headers: getHeaders() })
        .then(function (r) { return r.ok ? r.json() : []; })
        .then(function (msgs) {
          if (!msgs || !msgs.length) return;
          var before = chatList.scrollHeight;
          msgs.forEach(renderChatMessage);
          if (chatList.scrollTop + chatList.clientHeight >= before - 40) {
            scrollChatToBottom();
          }
        })
        .catch(function () {});
    }

    function sendChatMessage() {
      var content = (chatInput.value || '').trim();
      if (!content || !oaChannelId) return;
      chatSend.disabled = true;
      fetch('/api/messaging/channels/' + oaChannelId + '/messages', {
        method: 'POST', headers: getHeaders(),
        body: JSON.stringify({ content: content })
      })
        .then(function (r) { return r.ok ? r.json() : null; })
        .then(function (m) {
          chatSend.disabled = false;
          if (m) {
            chatInput.value = '';
            renderChatMessage(m);
            scrollChatToBottom();
          }
        })
        .catch(function () { chatSend.disabled = false; });
    }

    chatSend.addEventListener('click', sendChatMessage);
    chatInput.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        sendChatMessage();
      }
    });

    fetch('/api/messaging/channels/for-deliverable', {
      method: 'POST', headers: getHeaders(),
      body: JSON.stringify({ deliverableId: deliverable.id })
    })
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (ch) {
        if (!ch || !ch.id) {
          while (chatList.firstChild) chatList.removeChild(chatList.firstChild);
          var errRow = document.createElement('div');
          errRow.className = 'cc-chat-msg-header';
          errRow.textContent = 'Chat unavailable';
          chatList.appendChild(errRow);
          return;
        }
        oaChannelId = ch.id;
        chatInput.disabled = false;
        chatSend.disabled = false;
        loadInitialMessages();
        stopCCChatPoll();
        _ccChatPoll = setInterval(pollNewMessages, 15000);
      })
      .catch(function () {});

    // ── Article card (right) ──
    var articleCard = document.createElement('div');
    articleCard.className = 'oa-article-card cc-posts-card';
    var articleHeader = document.createElement('div');
    articleHeader.className = 'oa-article-header';
    articleHeader.textContent = 'Article';
    articleCard.appendChild(articleHeader);

    var editorEl = document.createElement('div');
    editorEl.className = 'oa-article-editor';
    articleCard.appendChild(editorEl);
    bottomRow.appendChild(articleCard);

    wrapper.appendChild(bottomRow);
    container.appendChild(wrapper);

    // ── Quill init (deferred so editorEl is in the DOM) ──
    if (window.Quill) {
      setTimeout(function () {
        var quill = new Quill(editorEl, {
          theme: 'snow',
          modules: {
            toolbar: [
              [{ 'header': [1, 2, 3, false] }],
              ['bold', 'italic', 'underline', 'strike'],
              [{ 'list': 'ordered' }, { 'list': 'bullet' }],
              ['blockquote', 'link', 'image'],
              ['clean']
            ]
          },
          placeholder: 'Write or paste your article...'
        });
        quill.root.innerHTML = (meta && meta.article_body) || '';

        var saveTimer = null;
        quill.on('text-change', function () {
          if (saveTimer) clearTimeout(saveTimer);
          saveTimer = setTimeout(function () {
            var html = quill.root.innerHTML;
            fetch(API_BASE + '/' + deliverable.id, {
              method: 'PATCH', headers: getHeaders(),
              body: JSON.stringify({ metadata: { article_body: html } })
            });
          }, 500);
        });

        // Override the default "insert by URL" image handler so toolbar
        // image clicks upload a local file and embed the returned URL.
        quill.getModule('toolbar').addHandler('image', function () {
          var input = document.createElement('input');
          input.type = 'file';
          input.accept = 'image/*';
          input.onchange = function () {
            if (!input.files || !input.files[0]) return;
            var fd = new FormData();
            fd.append('images', input.files[0]);
            fetch('/api/deliverables/' + deliverable.id + '/upload-images', {
              method: 'POST',
              headers: window.getAuthHeaders ? window.getAuthHeaders() : {},
              body: fd
            }).then(function (r) { return r.json(); }).then(function (data) {
              var url = (data && data.urls && data.urls[0]) || null;
              if (url) {
                var range = quill.getSelection(true);
                quill.insertEmbed(range.index, 'image', url);
                quill.setSelection(range.index + 1);
              }
            }).catch(function () {});
          };
          input.click();
        });
      }, 0);
    } else {
      // Fallback — contenteditable div
      editorEl.contentEditable = 'true';
      editorEl.innerHTML = (meta && meta.article_body) || '';
      editorEl.addEventListener('blur', function () {
        fetch(API_BASE + '/' + deliverable.id, {
          method: 'PATCH', headers: getHeaders(),
          body: JSON.stringify({ metadata: { article_body: editorEl.innerHTML } })
        });
      });
    }
  }

  // Back-compat alias — older call sites (colEye, inline eye handlers for
  // departments other than Production) still use the plural name.
  var openOnlineArticlesDashboard = openOnlineArticleDashboard;

  // ══════ AGRI4ALL SHARED: Countries sidebar section ══════
  function addCountriesToSidebar(nav, countries) {
    if (!countries || countries.length === 0) return;
    addSidebarSection(nav, 'Countries');
    var wrap = document.createElement('div');
    wrap.style.padding = '0 16px';
    countries.forEach(function (c) {
      var tag = document.createElement('div');
      tag.style.cssText = 'display:inline-block;padding:3px 10px;margin:2px 4px 2px 0;border-radius:12px;font-size:11px;font-weight:600;background:rgba(46,204,113,0.1);color:#27ae60;';
      tag.textContent = c;
      wrap.appendChild(tag);
    });
    nav.appendChild(wrap);
  }

  // ══════ AGRI4ALL POSTS PER-POST-TYPE DASHBOARD ══════
  // Dedicated dashboard for `agri4all-posts` deliverables. Renders one row
  // per enabled post type (Facebook Post, Instagram Post, Instagram Story),
  // each with an upload block on the right and a completeness indicator on
  // the left that turns green once the uploaded file count reaches the
  // contracted amount. Includes a materials-recap at the top and an action
  // bar at the bottom with Resize + Send-for-Approval transitions.
  function openAgri4AllPostsDashboard(container, deliverable) {
    _ccContainer = container;
    while (container.firstChild) container.removeChild(container.firstChild);

    var meta = deliverable.metadata || {};
    if (typeof meta === 'string') try { meta = JSON.parse(meta); } catch (e) { meta = {}; }
    if (!meta.sections) meta.sections = {};
    deliverable.metadata = meta;

    // Scoped styles (kept inline so the whole dashboard lives in one place).
    var styleBlock = document.createElement('style');
    styleBlock.textContent = [
      '.a4a-posts-dashboard { display:flex; flex-direction:column; gap:18px; padding:20px 24px 120px; }',
      '.a4a-posts-header { display:flex; align-items:center; justify-content:space-between; gap:16px; }',
      '.a4a-posts-title { font-size:20px; font-weight:800; color:var(--text-primary,#1e293b); margin:0; }',
      '.a4a-posts-recap { border-radius:12px; background:var(--surface-alt,#f8fafc); border:1px solid var(--border-color,#e2e8f0); padding:14px 18px; min-height:40px; }',
      '.a4a-posts-dashboard-grid { display:grid; grid-template-columns:minmax(260px,1fr) minmax(320px,1.35fr); gap:22px; align-items:start; }',
      '.a4a-posts-col { display:flex; flex-direction:column; gap:14px; }',
      '.a4a-posts-col-title { font-size:11px; font-weight:700; text-transform:uppercase; letter-spacing:0.06em; color:var(--text-secondary,#94a3b8); margin:0 0 6px 2px; }',
      '.a4a-section-row { display:flex; align-items:center; gap:12px; padding:14px 16px; border:1px solid var(--border-color,#e2e8f0); border-radius:12px; background:var(--surface,#ffffff); transition:border-color 0.18s, background 0.18s; }',
      '.a4a-section-row.a4a-section-complete { border-color:#10B981; background:rgba(16,185,129,0.06); }',
      '.a4a-section-check { width:22px; height:22px; border-radius:50%; display:flex; align-items:center; justify-content:center; flex-shrink:0; background:#e2e8f0; color:#94a3b8; font-size:13px; font-weight:800; }',
      '.a4a-section-row.a4a-section-complete .a4a-section-check { background:#10B981; color:#ffffff; }',
      '.a4a-pill { display:inline-flex; align-items:center; padding:5px 12px; border-radius:999px; font-size:11px; font-weight:700; color:#ffffff; letter-spacing:0.02em; white-space:nowrap; }',
      '.a4a-pill-fb { background:#1877F2; }',
      '.a4a-pill-ig { background:linear-gradient(135deg,#833ab4 0%,#fd1d1d 50%,#fcb045 100%); }',
      '.a4a-pill-ig-story { background:#E1306C; }',
      '.a4a-section-meta { display:flex; flex-direction:column; gap:2px; flex:1; min-width:0; }',
      '.a4a-section-amount { font-size:12px; color:var(--text-secondary,#64748b); font-weight:600; }',
      '.a4a-section-amount strong { color:var(--text-primary,#1e293b); font-weight:800; }',
      '.a4a-section-row.a4a-section-complete .a4a-section-amount strong { color:#10B981; }',
      '.a4a-upload-block { border:1px solid var(--border-color,#e2e8f0); border-radius:12px; background:var(--surface,#ffffff); padding:14px 16px; display:flex; flex-direction:column; gap:10px; }',
      '.a4a-upload-header { display:flex; align-items:center; justify-content:space-between; gap:10px; }',
      '.a4a-upload-label { font-size:12px; font-weight:700; color:var(--text-primary,#1e293b); }',
      '.a4a-upload-counter { font-size:11px; color:var(--text-secondary,#64748b); font-weight:600; }',
      '.a4a-posts-actions { position:sticky; bottom:0; display:flex; justify-content:flex-end; gap:12px; padding:16px 0 0; margin-top:8px; background:linear-gradient(180deg,rgba(255,255,255,0) 0%,var(--bg-color,#f1f5f9) 40%); }',
      '.a4a-posts-actions button { padding:10px 22px; border-radius:10px; font-size:13px; font-weight:700; cursor:pointer; border:1px solid transparent; transition:all 0.18s; }',
      '.a4a-posts-actions .a4a-btn-secondary { background:var(--surface,#ffffff); color:var(--text-primary,#1e293b); border-color:var(--border-color,#cbd5e1); }',
      '.a4a-posts-actions .a4a-btn-secondary:hover:not(:disabled) { background:var(--surface-alt,#f1f5f9); }',
      '.a4a-posts-actions .a4a-btn-primary { background:#10B981; color:#ffffff; border-color:#10B981; }',
      '.a4a-posts-actions .a4a-btn-primary:hover:not(:disabled) { filter:brightness(1.06); }',
      '.a4a-posts-actions button:disabled { opacity:0.5; cursor:not-allowed; }',
      '.a4a-posts-toast { position:fixed; left:50%; bottom:32px; transform:translateX(-50%); background:#10B981; color:#ffffff; padding:12px 20px; border-radius:12px; font-size:13px; font-weight:700; box-shadow:0 10px 30px rgba(16,185,129,0.35); z-index:5000; }'
    ].join('\n');
    container.appendChild(styleBlock);

    // Sidebar — reuse the multi-section sidebar layout (post amounts + countries).
    var POST_TYPES = [
      { key: 'facebook_posts',    label: 'Facebook Post',    pillClass: 'a4a-pill-fb' },
      { key: 'instagram_posts',   label: 'Instagram Post',   pillClass: 'a4a-pill-ig' },
      { key: 'instagram_stories', label: 'Instagram Story',  pillClass: 'a4a-pill-ig-story' }
    ];
    var enabledTypes = POST_TYPES.filter(function (t) { return meta[t.key] === true; });

    setupDashboardSidebar(deliverable, function (nav) {
      addSidebarSection(nav, 'Post Amounts');
      var wrap = document.createElement('div');
      wrap.style.padding = '0 16px';
      enabledTypes.forEach(function (t) {
        var amt = meta[t.key + '_amount'];
        var curated = meta[t.key + '_curated_amount'];
        var parts = [];
        if (amt) parts.push(String(amt));
        if (curated) parts.push('(+' + curated + ' curated)');
        addSidebarField(wrap, t.label, parts.join(' '));
      });
      nav.appendChild(wrap);
      addCountriesToSidebar(nav, meta.countries);
    });

    // Main pane
    var wrapper = document.createElement('div');
    wrapper.className = 'a4a-posts-dashboard';

    var headerRow = document.createElement('div');
    headerRow.className = 'a4a-posts-header';
    var title = document.createElement('h2');
    title.className = 'a4a-posts-title';
    title.textContent = deliverable.title || 'Agri4All Posts';
    headerRow.appendChild(title);
    wrapper.appendChild(headerRow);

    // Materials recap
    var recap = document.createElement('div');
    recap.className = 'a4a-posts-recap';
    var recapLoading = document.createElement('div');
    recapLoading.className = 'cc-recap-loading';
    recapLoading.textContent = 'Loading materials...';
    recap.appendChild(recapLoading);
    wrapper.appendChild(recap);
    fetchRequestFormRecap(deliverable.id, recap);

    // Two-column grid
    var grid = document.createElement('div');
    grid.className = 'a4a-posts-dashboard-grid';

    var leftCol = document.createElement('div');
    leftCol.className = 'a4a-posts-col';
    var leftTitle = document.createElement('div');
    leftTitle.className = 'a4a-posts-col-title';
    leftTitle.textContent = 'Deliverables';
    leftCol.appendChild(leftTitle);

    var rightCol = document.createElement('div');
    rightCol.className = 'a4a-posts-col';
    var rightTitle = document.createElement('div');
    rightTitle.className = 'a4a-posts-col-title';
    rightTitle.textContent = 'Uploads';
    rightCol.appendChild(rightTitle);

    grid.appendChild(leftCol);
    grid.appendChild(rightCol);
    wrapper.appendChild(grid);

    // Empty-state guard
    if (enabledTypes.length === 0) {
      var empty = document.createElement('div');
      empty.style.cssText = 'padding:24px;text-align:center;color:var(--text-muted,#94a3b8);font-size:13px;';
      empty.textContent = 'No post types enabled on this deliverable.';
      leftCol.appendChild(empty);
    }

    // PATCH helper — persists the whole metadata object.
    function saveMetadata() {
      return fetch(API_BASE + '/' + deliverable.id, {
        method: 'PATCH',
        headers: getHeaders(),
        body: JSON.stringify({ metadata: meta })
      });
    }

    // Track per-type DOM so we can update the complete state after uploads.
    var rowRefs = {};

    enabledTypes.forEach(function (t) {
      if (!meta.sections[t.key]) meta.sections[t.key] = { files: [], status: 'pending', change_request_count: 0 };
      if (!Array.isArray(meta.sections[t.key].files)) meta.sections[t.key].files = [];
      var section = meta.sections[t.key];

      var amountInt = parseInt(meta[t.key + '_amount'] || 0, 10) || 0;
      var curatedRaw = meta[t.key + '_curated_amount'];

      // ── Left col: summary row ────────────────────────────
      var row = document.createElement('div');
      row.className = 'a4a-section-row';

      var check = document.createElement('span');
      check.className = 'a4a-section-check';
      check.textContent = '\u2713';
      row.appendChild(check);

      var metaWrap = document.createElement('div');
      metaWrap.className = 'a4a-section-meta';

      var pillRow = document.createElement('div');
      pillRow.style.cssText = 'display:flex;align-items:center;gap:8px;';
      var pill = document.createElement('span');
      pill.className = 'a4a-pill ' + t.pillClass;
      pill.textContent = t.label;
      pillRow.appendChild(pill);
      metaWrap.appendChild(pillRow);

      var amtLine = document.createElement('div');
      amtLine.className = 'a4a-section-amount';
      var amtBits = ['Amount: <strong>' + (amountInt || '0') + '</strong>'];
      if (curatedRaw) amtBits.push('Curated: <strong>' + curatedRaw + '</strong>');
      amtLine.innerHTML = amtBits.join(' &middot; ');
      metaWrap.appendChild(amtLine);

      var progressLine = document.createElement('div');
      progressLine.className = 'a4a-section-amount';
      metaWrap.appendChild(progressLine);

      row.appendChild(metaWrap);
      leftCol.appendChild(row);

      // ── Right col: upload block ──────────────────────────
      var block = document.createElement('div');
      block.className = 'a4a-upload-block';
      var blockHeader = document.createElement('div');
      blockHeader.className = 'a4a-upload-header';
      var blockLabel = document.createElement('div');
      blockLabel.className = 'a4a-upload-label';
      blockLabel.textContent = t.label + (amountInt ? ' — ' + amountInt : '');
      blockHeader.appendChild(blockLabel);
      var blockCounter = document.createElement('div');
      blockCounter.className = 'a4a-upload-counter';
      blockHeader.appendChild(blockCounter);
      block.appendChild(blockHeader);

      // Upload area: wraps buildUploadArea and refreshes the row state
      // after any upload/delete finishes saving.
      var uploadArea = buildUploadArea(deliverable.id, section.files, function () {
        saveMetadata();
        refreshRow(t.key);
      }, 'Upload ' + t.label);
      block.appendChild(uploadArea);
      rightCol.appendChild(block);

      rowRefs[t.key] = {
        row: row,
        progress: progressLine,
        counter: blockCounter,
        amount: amountInt
      };

      refreshRow(t.key);
    });

    function refreshRow(key) {
      var ref = rowRefs[key];
      if (!ref) return;
      var section = meta.sections[key] || { files: [] };
      var count = (section.files || []).length;
      var target = ref.amount || 0;
      var complete = target > 0 && count >= target;
      ref.row.classList.toggle('a4a-section-complete', complete);
      ref.progress.innerHTML = 'Uploaded: <strong>' + count + '</strong>' + (target ? ' / ' + target : '');
      ref.counter.textContent = count + (target ? ' / ' + target : '') + ' uploaded';
    }

    // ── Action bar ────────────────────────────────────
    var actions = document.createElement('div');
    actions.className = 'a4a-posts-actions';

    var resizeBtn = document.createElement('button');
    resizeBtn.type = 'button';
    resizeBtn.className = 'a4a-btn-secondary';
    resizeBtn.textContent = 'Resize';
    resizeBtn.title = 'Mark resizing as complete and move to ready for approval.';
    resizeBtn.disabled = deliverable.status !== 'design_review';
    resizeBtn.addEventListener('click', function () {
      resizeBtn.disabled = true;
      fetch(API_BASE + '/' + deliverable.id, {
        method: 'PATCH',
        headers: getHeaders(),
        body: JSON.stringify({ status: 'ready_for_approval' })
      }).then(function (r) { return r.json(); })
        .then(function (updated) {
          if (updated && updated.id) {
            deliverable.status = updated.status || 'ready_for_approval';
            showA4aToast('Marked as ready for approval');
            openAgri4AllPostsDashboard(container, deliverable);
          } else {
            resizeBtn.disabled = false;
          }
        })
        .catch(function () { resizeBtn.disabled = false; });
    });
    actions.appendChild(resizeBtn);

    var sendBtn = document.createElement('button');
    sendBtn.type = 'button';
    sendBtn.className = 'a4a-btn-primary';
    sendBtn.textContent = 'Send for Approval';
    sendBtn.title = 'Send to the client portal for approval.';
    sendBtn.addEventListener('click', function () {
      sendBtn.disabled = true;
      fetch(API_BASE + '/' + deliverable.id, {
        method: 'PATCH',
        headers: getHeaders(),
        body: JSON.stringify({ status: 'sent_for_approval' })
      }).then(function (r) { return r.json(); })
        .then(function (updated) {
          if (updated && updated.id) {
            deliverable.status = updated.status || 'sent_for_approval';
            showA4aToast('Sent to client portal');
            openAgri4AllPostsDashboard(container, deliverable);
          } else {
            sendBtn.disabled = false;
          }
        })
        .catch(function () { sendBtn.disabled = false; });
    });
    actions.appendChild(sendBtn);

    wrapper.appendChild(actions);
    container.appendChild(wrapper);

    function showA4aToast(msg) {
      var t = document.createElement('div');
      t.className = 'a4a-posts-toast';
      t.textContent = msg;
      document.body.appendChild(t);
      setTimeout(function () { if (t.parentNode) t.parentNode.removeChild(t); }, 2400);
    }
  }
  window.openAgri4AllPostsDashboard = openAgri4AllPostsDashboard;

  // ══════ A4A PRODUCT UPLOADS DASHBOARD ══════
  // 30% left chat panel / 70% right file upload panel.
  function openA4AProductUploadsDashboard(container, deliverable) {
    _ccContainer = container;
    while (container.firstChild) container.removeChild(container.firstChild);
    container.style.display = 'block';
    container.style.padding = '0';
    container.style.height = '100%';
    container.style.minHeight = 'calc(100vh - 88px)';
    container.style.overflow = 'hidden';

    var meta = deliverable.metadata || {};
    if (typeof meta === 'string') try { meta = JSON.parse(meta); } catch (e) { meta = {}; }
    deliverable.metadata = meta;

    // Scoped styles
    var styleBlock = document.createElement('style');
    styleBlock.textContent = [
      '.a4apu-dashboard { display:flex; flex-direction:column; gap:0; height:100%; min-height:calc(100vh - 88px); background:var(--surface-alt,#f1f5f9); }',
      '.a4apu-header-shell { padding:18px 24px 0; }',
      '.a4apu-header { display:flex; align-items:center; justify-content:space-between; gap:16px; padding:16px 20px; background:var(--surface,#ffffff); border:1px solid var(--border-color,#e2e8f0); border-radius:14px; box-shadow:0 4px 14px rgba(15,23,42,0.05); }',
      '.a4apu-header-left { display:flex; flex-direction:column; gap:2px; min-width:0; }',
      '.a4apu-title { font-size:18px; font-weight:800; color:var(--text-primary,#1e293b); margin:0; letter-spacing:-0.01em; }',
      '.a4apu-subtitle { font-size:12px; font-weight:600; color:var(--text-secondary,#64748b); letter-spacing:0.04em; text-transform:uppercase; }',
      '.a4apu-status-badge { display:inline-flex; align-items:center; padding:5px 14px; border-radius:999px; font-size:12px; font-weight:700; background:var(--surface-alt,#f1f5f9); color:var(--text-secondary,#64748b); }',
      '.a4apu-cr-counter { font-size:12px; color:var(--text-secondary,#64748b); font-weight:600; }',
      '.a4apu-body { display:flex; flex:1; min-height:0; height:100%; overflow:hidden; padding:16px 24px 0; gap:16px; }',
      '.a4apu-chat-panel { width:34%; min-width:320px; padding:0; border-right:none; display:flex; flex-direction:column; overflow:hidden; background:none; }',
      '.a4apu-chat-panel .cd-messenger { margin:0; min-height:0; border-radius:18px; border:1px solid rgba(148,163,184,0.22); box-shadow:0 16px 40px rgba(15,23,42,0.08); background:rgba(255,255,255,0.82); backdrop-filter:blur(10px); }',
      '.a4apu-chat-panel .cd-messenger-header { padding:16px 18px; background:linear-gradient(180deg,rgba(248,250,252,0.96),rgba(255,255,255,0.90)); border-bottom:1px solid rgba(148,163,184,0.18); }',
      '.a4apu-chat-panel .cd-messenger-title { font-size:12px; letter-spacing:0.08em; color:#0f172a; }',
      '.a4apu-chat-panel .cd-messenger-messages { flex:1; min-height:260px; padding:18px 16px 16px; gap:10px; background:linear-gradient(180deg,rgba(241,245,249,0.72),rgba(255,255,255,0.92)); }',
      '.a4apu-chat-panel .cd-messenger-empty { color:#64748b; font-size:12px; }',
      '.a4apu-chat-panel .cd-bubble { max-width:88%; }',
      '.a4apu-chat-panel .cd-bubble-body { padding:10px 12px; border-radius:16px; background:#ffffff; border:1px solid rgba(148,163,184,0.18); box-shadow:0 8px 18px rgba(15,23,42,0.05); }',
      '.a4apu-chat-panel .cd-bubble-own .cd-bubble-body { background:linear-gradient(135deg,#0f766e 0%,#0f9f8a 100%); border-color:rgba(15,118,110,0.42); box-shadow:0 10px 24px rgba(15,118,110,0.24); }',
      '.a4apu-chat-panel .cd-bubble-meta { margin-bottom:4px; }',
      '.a4apu-chat-panel .cd-bubble-sender { font-size:10px; letter-spacing:0.02em; color:#334155; }',
      '.a4apu-chat-panel .cd-bubble-own .cd-bubble-sender { color:rgba(255,255,255,0.88); }',
      '.a4apu-chat-panel .cd-bubble-time { font-size:10px; color:#94a3b8; }',
      '.a4apu-chat-panel .cd-bubble-own .cd-bubble-time { color:rgba(255,255,255,0.68); }',
      '.a4apu-chat-panel .cd-bubble-content { font-size:13px; line-height:1.5; color:#0f172a; }',
      '.a4apu-chat-panel .cd-bubble-own .cd-bubble-content { color:#ffffff; }',
      '.a4apu-chat-panel .cd-bubble-attachment { margin-top:8px; }',
      '.a4apu-chat-panel .cd-bubble-attachment a { padding:6px 8px; border-radius:10px; background:rgba(15,23,42,0.05); color:#0f172a; }',
      '.a4apu-chat-panel .cd-bubble-own .cd-bubble-attachment a { background:rgba(255,255,255,0.16); color:#ffffff; }',
      '.a4apu-chat-panel .cd-messenger-input { padding:14px; gap:8px; border-top:1px solid rgba(148,163,184,0.18); background:linear-gradient(180deg,rgba(255,255,255,0.98),rgba(248,250,252,0.96)); }',
      '.a4apu-chat-panel .cd-messenger-textarea { min-height:42px; border-radius:14px; padding:10px 12px; background:#ffffff; border:1px solid rgba(148,163,184,0.26); box-shadow:inset 0 1px 2px rgba(15,23,42,0.04); }',
      '.a4apu-chat-panel .cd-messenger-textarea:focus { border-color:#14b8a6; box-shadow:0 0 0 3px rgba(20,184,166,0.12); }',
      '.a4apu-chat-panel .cd-messenger-btn { width:36px; height:36px; border-radius:12px; color:#475569; background:rgba(148,163,184,0.10); }',
      '.a4apu-chat-panel .cd-messenger-btn:hover { color:#0f766e; background:rgba(20,184,166,0.12); }',
      '.a4apu-chat-panel .cd-mention-dropdown { left:44px; right:52px; bottom:calc(100% + 8px); border-radius:14px; border-color:rgba(148,163,184,0.22); box-shadow:0 16px 32px rgba(15,23,42,0.12); }',
      '.a4apu-chat-panel .cd-mention-item { padding:10px 12px; }',
      '.a4apu-right-panel { flex:1; display:flex; flex-direction:column; overflow-y:auto; padding:0 0 24px; gap:16px; min-width:0; }',
      '.a4apu-card { border-radius:14px; background:var(--surface,#ffffff); border:1px solid var(--border-color,#e2e8f0); box-shadow:0 4px 14px rgba(15,23,42,0.04); overflow:hidden; }',
      '.a4apu-card-header { display:flex; align-items:center; justify-content:space-between; gap:12px; padding:14px 18px; border-bottom:1px solid var(--border-color,#e2e8f0); background:var(--surface,#ffffff); }',
      '.a4apu-card-title { margin:0; font-size:13px; font-weight:800; color:var(--text-primary,#1e293b); letter-spacing:0.02em; text-transform:uppercase; display:flex; align-items:center; gap:8px; }',
      '.a4apu-card-title-accent { display:inline-block; width:4px; height:14px; border-radius:3px; background:#0f766e; }',
      '.a4apu-card-body { padding:16px 18px; }',
      '.a4apu-card-body.a4apu-card-body-flush { padding:0; }',
      '.a4apu-recap { border-radius:0; background:transparent; border:none; padding:0; min-height:32px; color:var(--text-primary,#1e293b); font-size:13px; line-height:1.55; }',
      '.a4apu-recap .cc-recap-loading { color:var(--text-secondary,#64748b); font-size:12px; }',
      '.a4apu-upload-hint { margin:0 0 12px; font-size:12px; color:var(--text-secondary,#64748b); display:flex; align-items:center; gap:8px; }',
      '.a4apu-upload-hint strong { color:var(--text-primary,#1e293b); font-weight:700; }',
      '.a4apu-card .wd-upload-area { background:transparent; border:none; padding:0; }',
      '.a4apu-card .cc-img-upload { min-height:150px; border:2px dashed rgba(15,118,110,0.4) !important; border-radius:12px; background:rgba(20,184,166,0.05); color:#0f766e; font-size:34px; display:flex; align-items:center; justify-content:center; transition:all 0.18s; cursor:pointer; }',
      '.a4apu-card .cc-img-upload:hover { background:rgba(20,184,166,0.10); border-color:#0f766e !important; }',
      '.a4apu-jobs-section { margin-top:0 !important; border:none !important; border-radius:0 !important; background:transparent !important; }',
      '.a4apu-jobs-empty { display:flex; flex-direction:column; align-items:center; justify-content:center; gap:8px; padding:32px 16px; color:var(--text-secondary,#64748b); font-size:12px; text-align:center; }',
      '.a4apu-jobs-empty-icon { width:44px; height:44px; border-radius:50%; background:var(--surface-alt,#f1f5f9); color:#94a3b8; display:flex; align-items:center; justify-content:center; font-size:22px; }',
      '.a4apu-actions-shelf { position:sticky; bottom:0; margin-top:auto; background:var(--surface,#ffffff); border-top:1px solid var(--border-color,#e2e8f0); box-shadow:0 -6px 20px rgba(15,23,42,0.06); z-index:3; }',
      '.a4apu-actions { display:flex; justify-content:flex-end; align-items:center; gap:12px; padding:14px 24px; background:none; }',
      '.a4apu-actions button { padding:10px 22px; border-radius:10px; font-size:13px; font-weight:700; cursor:pointer; border:1px solid transparent; transition:all 0.18s; }',
      '.a4apu-btn-secondary { background:var(--surface,#ffffff); color:var(--text-primary,#1e293b); border-color:var(--border-color,#cbd5e1) !important; }',
      '.a4apu-btn-secondary:hover:not(:disabled) { background:var(--surface-alt,#f1f5f9); }',
      '.a4apu-btn-primary { background:#10B981; color:#ffffff; border-color:#10B981 !important; }',
      '.a4apu-btn-primary:hover:not(:disabled) { filter:brightness(1.06); }',
      '.a4apu-btn-danger { background:#ef4444; color:#ffffff; border-color:#ef4444 !important; }',
      '.a4apu-btn-danger:hover:not(:disabled) { filter:brightness(1.06); }',
      '.a4apu-actions button:disabled { opacity:1; cursor:pointer; }',
      '.a4apu-toast { position:fixed; left:50%; bottom:32px; transform:translateX(-50%); background:#10B981; color:#ffffff; padding:12px 20px; border-radius:12px; font-size:13px; font-weight:700; box-shadow:0 10px 30px rgba(16,185,129,0.35); z-index:5000; }'
    ].join('\n');
    container.appendChild(styleBlock);

    function showToast(msg, color) {
      var t = document.createElement('div');
      t.className = 'a4apu-toast';
      if (color) t.style.background = color;
      t.textContent = msg;
      document.body.appendChild(t);
      setTimeout(function () { if (t.parentNode) t.parentNode.removeChild(t); }, 2400);
    }

    // Sidebar
    setupDashboardSidebar(deliverable, function (nav) {
      addSidebarSection(nav, 'Product Info');
      var wrap = document.createElement('div');
      wrap.style.padding = '0 16px';
      addSidebarField(wrap, 'Amount', String(meta.product_uploads_amount || meta.amount || 0));
      nav.appendChild(wrap);
      addCountriesToSidebar(nav, meta.countries);
    });

    // Outer wrapper
    var wrapper = document.createElement('div');
    wrapper.className = 'a4apu-dashboard';

    // Header (wrapped in a shell so the title sits inside a card)
    var headerShell = document.createElement('div');
    headerShell.className = 'a4apu-header-shell';
    var headerRow = document.createElement('div');
    headerRow.className = 'a4apu-header';

    var headerLeft = document.createElement('div');
    headerLeft.className = 'a4apu-header-left';
    var subtitleEl = document.createElement('div');
    subtitleEl.className = 'a4apu-subtitle';
    subtitleEl.textContent = 'Agri4All Product Uploads';
    headerLeft.appendChild(subtitleEl);
    var titleEl = document.createElement('h2');
    titleEl.className = 'a4apu-title';
    titleEl.textContent = deliverable.title || 'Agri4All Product Uploads';
    headerLeft.appendChild(titleEl);
    headerRow.appendChild(headerLeft);

    var headerRight = document.createElement('div');
    headerRight.style.cssText = 'display:flex;align-items:center;gap:12px;';

    var crCount = (meta.change_requests && meta.change_requests.length) || 0;
    var crCounter = document.createElement('span');
    crCounter.className = 'a4apu-cr-counter';
    crCounter.textContent = crCount + ' / 3 change requests used';
    headerRight.appendChild(crCounter);

    var statusBadge = document.createElement('span');
    statusBadge.className = 'a4apu-status-badge proagri-sheet-status ' + statusClass(deliverable.status);
    statusBadge.textContent = formatStatus(deliverable.status);
    headerRight.appendChild(statusBadge);

    headerRow.appendChild(headerRight);
    headerShell.appendChild(headerRow);
    wrapper.appendChild(headerShell);

    // Body (chat + right panel)
    var body = document.createElement('div');
    body.className = 'a4apu-body';

    // ── Left: Chat (30%) ──────────────────────────────
    var chatPanel = document.createElement('div');
    chatPanel.className = 'a4apu-chat-panel';

    var COMMON_EMOJI_A4A = [
      '😀','😂','😍','🙏','👍','👎','🔥','❤️','😅','😎','🤔','🙌',
      '✅','❌','📣','🎉','👀','✍️','📄','📎','⏰','🚀'
    ];
    var chat = document.createElement('div');
    chat.className = 'cd-messenger';

    var chatHeaderEl = document.createElement('div');
    chatHeaderEl.className = 'cd-messenger-header';
    var chatTitleEl = document.createElement('div');
    chatTitleEl.className = 'cd-messenger-title';
    chatTitleEl.textContent = 'Team Chat';
    chatHeaderEl.appendChild(chatTitleEl);
    chat.appendChild(chatHeaderEl);

    var chatList = document.createElement('div');
    chatList.className = 'cd-messenger-messages';
    var chatLoading = document.createElement('div');
    chatLoading.className = 'cd-messenger-empty';
    chatLoading.textContent = 'Loading chat...';
    chatList.appendChild(chatLoading);
    chat.appendChild(chatList);

    var chatInputWrap = document.createElement('div');
    chatInputWrap.className = 'cd-messenger-input';
    chatInputWrap.style.position = 'relative';

    var emojiBtn = document.createElement('button');
    emojiBtn.className = 'cd-messenger-btn';
    emojiBtn.type = 'button';
    emojiBtn.title = 'Emoji';
    emojiBtn.textContent = '😀';
    emojiBtn.style.fontSize = '16px';
    chatInputWrap.appendChild(emojiBtn);

    var attachBtn = document.createElement('button');
    attachBtn.className = 'cd-messenger-btn';
    attachBtn.type = 'button';
    attachBtn.title = 'Attach files';
    attachBtn.innerHTML = '<svg viewBox="0 0 24 24" width="18" height="18"><path fill="currentColor" d="M16.5 6v11.5c0 2.21-1.79 4-4 4s-4-1.79-4-4V5c0-1.38 1.12-2.5 2.5-2.5s2.5 1.12 2.5 2.5v10.5c0 .55-.45 1-1 1s-1-.45-1-1V6H9.5v9.5c0 1.38 1.12 2.5 2.5 2.5s2.5-1.12 2.5-2.5V5c0-2.21-1.79-4-4-4S6.5 2.79 6.5 5v12.5c0 3.04 2.46 5.5 5.5 5.5s5.5-2.46 5.5-5.5V6H16.5z"/></svg>';
    chatInputWrap.appendChild(attachBtn);

    var chatInput = document.createElement('textarea');
    chatInput.className = 'cd-messenger-textarea';
    chatInput.placeholder = 'Type a message...';
    chatInput.rows = 1;
    chatInput.disabled = true;

    var chatSend = document.createElement('button');
    chatSend.className = 'cd-messenger-btn';
    chatSend.type = 'button';
    chatSend.title = 'Send';
    chatSend.innerHTML = '<svg viewBox="0 0 24 24" width="18" height="18"><path fill="currentColor" d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/></svg>';
    chatSend.disabled = true;

    chatInputWrap.appendChild(chatInput);
    chatInputWrap.appendChild(chatSend);

    var mentionDropdown = document.createElement('div');
    mentionDropdown.className = 'cd-mention-dropdown';
    mentionDropdown.style.display = 'none';
    chatInputWrap.appendChild(mentionDropdown);

    var emojiPicker = document.createElement('div');
    emojiPicker.style.cssText = 'display:none;padding:8px;flex-wrap:wrap;gap:4px;bottom:100%;position:absolute;left:0;right:0;background:var(--card-bg,#fff);border:1px solid var(--border-color,#e2e8f0);border-radius:8px;box-shadow:0 4px 16px rgba(0,0,0,0.12);z-index:50;';
    COMMON_EMOJI_A4A.forEach(function (em) {
      var btn = document.createElement('button');
      btn.type = 'button';
      btn.textContent = em;
      btn.style.cssText = 'background:none;border:none;font-size:20px;cursor:pointer;padding:4px;border-radius:4px;line-height:1;';
      btn.addEventListener('click', function () {
        var pos = chatInput.selectionStart || chatInput.value.length;
        chatInput.value = chatInput.value.substring(0, pos) + em + chatInput.value.substring(pos);
        chatInput.focus();
        emojiPicker.style.display = 'none';
      });
      emojiPicker.appendChild(btn);
    });
    chatInputWrap.appendChild(emojiPicker);
    chat.appendChild(chatInputWrap);
    chatPanel.appendChild(chat);

    emojiBtn.addEventListener('click', function () {
      emojiPicker.style.display = emojiPicker.style.display === 'none' ? 'flex' : 'none';
    });
    chatInput.addEventListener('input', function () {
      chatInput.style.height = 'auto';
      chatInput.style.height = Math.min(chatInput.scrollHeight, 100) + 'px';
      emojiPicker.style.display = 'none';
      handleMentionTrigger(chatInput, mentionDropdown);
    });

    body.appendChild(chatPanel);

    // ── Right: Recap + Upload (70%) ───────────────────
    var rightPanel = document.createElement('div');
    rightPanel.className = 'a4apu-right-panel';

    // Request form recap (wrapped as a card)
    var recapCard = document.createElement('div');
    recapCard.className = 'a4apu-card';
    var recapHeader = document.createElement('div');
    recapHeader.className = 'a4apu-card-header';
    var recapTitle = document.createElement('h3');
    recapTitle.className = 'a4apu-card-title';
    recapTitle.innerHTML = '<span class="a4apu-card-title-accent"></span>Materials Request';
    recapHeader.appendChild(recapTitle);
    recapCard.appendChild(recapHeader);
    var recapBody = document.createElement('div');
    recapBody.className = 'a4apu-card-body';
    var recap = document.createElement('div');
    recap.className = 'a4apu-recap';
    var recapLoading = document.createElement('div');
    recapLoading.className = 'cc-recap-loading';
    recapLoading.textContent = 'Loading materials...';
    recap.appendChild(recapLoading);
    recapBody.appendChild(recap);
    recapCard.appendChild(recapBody);
    rightPanel.appendChild(recapCard);
    fetchRequestFormRecap(deliverable.id, recap);

    // Upload area
    if (!meta.product_images) meta.product_images = { files: [] };
    if (!Array.isArray(meta.product_images.files)) meta.product_images.files = [];

    function saveMetadata() {
      return fetch(API_BASE + '/' + deliverable.id, {
        method: 'PATCH',
        headers: getHeaders(),
        body: JSON.stringify({ metadata: meta })
      });
    }

    var uploadArea = buildUploadArea(deliverable.id, meta.product_images.files, function () {
      saveMetadata();
    }, 'Upload Product Images');

    var uploadCard = document.createElement('div');
    uploadCard.className = 'a4apu-card';
    var uploadHeader = document.createElement('div');
    uploadHeader.className = 'a4apu-card-header';
    var uploadTitle = document.createElement('h3');
    uploadTitle.className = 'a4apu-card-title';
    uploadTitle.innerHTML = '<span class="a4apu-card-title-accent"></span>Product Images';
    uploadHeader.appendChild(uploadTitle);
    uploadCard.appendChild(uploadHeader);
    var uploadBody = document.createElement('div');
    uploadBody.className = 'a4apu-card-body';
    var uploadHint = document.createElement('p');
    uploadHint.className = 'a4apu-upload-hint';
    uploadHint.innerHTML = '<strong>Click the + tile</strong> to upload product images. Accepted: JPG, PNG, WebP, PDF.';
    uploadBody.appendChild(uploadHint);
    uploadBody.appendChild(uploadArea);
    uploadCard.appendChild(uploadBody);
    rightPanel.appendChild(uploadCard);

    // ── Agri4All Upload Jobs table ────────────────────
    var jobsCard = document.createElement('div');
    jobsCard.className = 'a4apu-card';
    var jobsHeader = document.createElement('div');
    jobsHeader.className = 'a4apu-card-header';
    var jobsTitleEl = document.createElement('h3');
    jobsTitleEl.className = 'a4apu-card-title';
    jobsTitleEl.innerHTML = '<span class="a4apu-card-title-accent"></span>Agri4All Upload Jobs';
    jobsHeader.appendChild(jobsTitleEl);
    var jobsRefreshBtn = document.createElement('button');
    jobsRefreshBtn.type = 'button';
    jobsRefreshBtn.textContent = 'Refresh';
    jobsRefreshBtn.style.cssText = 'padding:5px 12px;font-size:11px;font-weight:700;border-radius:8px;border:1px solid var(--border-color,#cbd5e1);background:var(--surface-alt,#f1f5f9);color:var(--text-primary,#1e293b);cursor:pointer;';
    jobsHeader.appendChild(jobsRefreshBtn);
    jobsCard.appendChild(jobsHeader);
    var jobsBody = document.createElement('div');
    jobsBody.className = 'a4apu-card-body a4apu-card-body-flush';
    jobsCard.appendChild(jobsBody);
    // Legacy alias — preserved so downstream code that references jobsSection still works
    var jobsSection = jobsCard;
    rightPanel.appendChild(jobsCard);

    function flagEmoji(cc) {
      if (!cc || cc.length !== 2) return '';
      var OFFSET = 127397;
      try {
        return String.fromCodePoint(cc.toUpperCase().charCodeAt(0) + OFFSET) +
               String.fromCodePoint(cc.toUpperCase().charCodeAt(1) + OFFSET);
      } catch (e) { return ''; }
    }

    function renderJobStatusChip(status) {
      var s = document.createElement('span');
      var st = String(status || '').toLowerCase();
      var bg = '#e2e8f0', fg = '#334155';
      if (st === 'posted') { bg = '#dcfce7'; fg = '#166534'; }
      else if (st === 'error') { bg = '#fee2e2'; fg = '#991b1b'; }
      else if (st === 'pending') { bg = '#fef3c7'; fg = '#92400e'; }
      s.style.cssText = 'display:inline-block;padding:3px 10px;border-radius:999px;font-size:11px;font-weight:700;background:' + bg + ';color:' + fg + ';';
      s.textContent = st || '—';
      return s;
    }

    function renderA4aStatusChip(status) {
      var s = document.createElement('span');
      var st = String(status || '').toLowerCase();
      var bg = '#e2e8f0', fg = '#334155';
      if (st === 'approved') { bg = '#dcfce7'; fg = '#166534'; }
      else if (st === 'pending') { bg = '#fef3c7'; fg = '#92400e'; }
      else if (st === 'rejected') { bg = '#fee2e2'; fg = '#991b1b'; }
      s.style.cssText = 'display:inline-block;padding:3px 10px;border-radius:999px;font-size:11px;font-weight:600;background:' + bg + ';color:' + fg + ';';
      s.textContent = st || '—';
      return s;
    }

    function loadJobs() {
      while (jobsBody.firstChild) jobsBody.removeChild(jobsBody.firstChild);
      var loading = document.createElement('div');
      loading.style.cssText = 'padding:16px;color:#64748b;font-size:12px;';
      loading.textContent = 'Loading jobs...';
      jobsBody.appendChild(loading);
      fetch(API_BASE + '/agri4all/jobs?deliverableId=' + deliverable.id, {
        headers: window.getAuthHeaders ? window.getAuthHeaders() : {}
      }).then(function (r) { return r.ok ? r.json() : { data: [] }; })
        .then(function (res) {
          while (jobsBody.firstChild) jobsBody.removeChild(jobsBody.firstChild);
          var jobs = (res && res.data) || [];
          if (!jobs.length) {
            var empty = document.createElement('div');
            empty.className = 'a4apu-jobs-empty';
            var emptyIcon = document.createElement('div');
            emptyIcon.className = 'a4apu-jobs-empty-icon';
            emptyIcon.textContent = '\u2601';
            empty.appendChild(emptyIcon);
            var emptyText = document.createElement('div');
            emptyText.textContent = 'No upload jobs yet. Post to Agri4All to create jobs per country.';
            empty.appendChild(emptyText);
            jobsBody.appendChild(empty);
            return;
          }
          var table = document.createElement('table');
          table.style.cssText = 'width:100%;border-collapse:collapse;font-size:12px;';
          var thead = document.createElement('thead');
          thead.innerHTML = '<tr style="background:var(--surface-alt,#f8fafc);text-align:left;">' +
            '<th style="padding:8px 12px;font-weight:700;color:#475569;">Country</th>' +
            '<th style="padding:8px 12px;font-weight:700;color:#475569;">Job</th>' +
            '<th style="padding:8px 12px;font-weight:700;color:#475569;">Agri4All</th>' +
            '<th style="padding:8px 12px;font-weight:700;color:#475569;">Slug / URL</th>' +
            '<th style="padding:8px 12px;font-weight:700;color:#475569;text-align:right;">Actions</th>' +
            '</tr>';
          table.appendChild(thead);
          var tbody = document.createElement('tbody');
          jobs.forEach(function (job) { tbody.appendChild(buildJobRow(job)); });
          table.appendChild(tbody);
          jobsBody.appendChild(table);
        })
        .catch(function () {
          while (jobsBody.firstChild) jobsBody.removeChild(jobsBody.firstChild);
          var err = document.createElement('div');
          err.style.cssText = 'padding:16px;color:#991b1b;font-size:12px;';
          err.textContent = 'Failed to load jobs.';
          jobsBody.appendChild(err);
        });
    }

    function buildJobRow(job) {
      var tr = document.createElement('tr');
      tr.style.cssText = 'border-top:1px solid var(--border-color,#e2e8f0);';

      var tdCountry = document.createElement('td');
      tdCountry.style.cssText = 'padding:10px 12px;white-space:nowrap;';
      var cc = String(job.country || '').toUpperCase();
      tdCountry.innerHTML = '<span style="font-size:16px;margin-right:6px;">' + flagEmoji(cc) + '</span><strong>' + cc + '</strong>';
      tr.appendChild(tdCountry);

      var tdJob = document.createElement('td');
      tdJob.style.cssText = 'padding:10px 12px;';
      tdJob.appendChild(renderJobStatusChip(job.jobStatus));
      tr.appendChild(tdJob);

      var tdA4a = document.createElement('td');
      tdA4a.style.cssText = 'padding:10px 12px;';
      tdA4a.appendChild(renderA4aStatusChip(job.agri4allStatus));
      tr.appendChild(tdA4a);

      var tdSlug = document.createElement('td');
      tdSlug.style.cssText = 'padding:10px 12px;font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;font-size:11px;color:#334155;word-break:break-all;';
      if (job.publicUrl) {
        var a = document.createElement('a');
        a.href = job.publicUrl;
        a.target = '_blank';
        a.rel = 'noopener noreferrer';
        a.textContent = job.agri4allSlug || job.publicUrl;
        a.style.color = '#0f766e';
        tdSlug.appendChild(a);
      } else if (job.agri4allSlug) {
        tdSlug.textContent = job.agri4allSlug;
      } else {
        tdSlug.textContent = '—';
      }
      tr.appendChild(tdSlug);

      var tdActions = document.createElement('td');
      tdActions.style.cssText = 'padding:10px 12px;text-align:right;white-space:nowrap;';

      if (String(job.jobStatus || '').toLowerCase() === 'error') {
        var retryBtn = document.createElement('button');
        retryBtn.type = 'button';
        retryBtn.textContent = 'Retry';
        retryBtn.style.cssText = 'padding:5px 12px;font-size:11px;font-weight:700;border-radius:6px;border:1px solid #ef4444;background:#ef4444;color:#fff;cursor:pointer;margin-right:6px;';
        retryBtn.addEventListener('click', function () {
          retryBtn.disabled = true;
          retryBtn.textContent = 'Retrying...';
          fetch(API_BASE + '/agri4all/jobs/' + job.id + '/retry', {
            method: 'POST',
            headers: getHeaders()
          }).then(function (r) { return r.ok ? r.json() : Promise.reject(r); })
            .then(function () { showToast('Retry queued'); loadJobs(); })
            .catch(function () {
              retryBtn.disabled = false;
              retryBtn.textContent = 'Retry';
              showToast('Retry failed', '#ef4444');
            });
        });
        tdActions.appendChild(retryBtn);
      }

      if (job.agri4allSlug) {
        var editBtn = document.createElement('button');
        editBtn.type = 'button';
        editBtn.textContent = 'Edit on Agri4All';
        editBtn.style.cssText = 'padding:5px 12px;font-size:11px;font-weight:700;border-radius:6px;border:1px solid #0f766e;background:#fff;color:#0f766e;cursor:pointer;';
        editBtn.addEventListener('click', function () { openA4aEditModal(job); });
        tdActions.appendChild(editBtn);
      }

      tr.appendChild(tdActions);

      // Error detail expandable row
      if (job.errorDetail) {
        var errTr = document.createElement('tr');
        errTr.style.display = 'none';
        var errTd = document.createElement('td');
        errTd.colSpan = 5;
        errTd.style.cssText = 'padding:12px 16px;background:#fef2f2;color:#7f1d1d;font-size:11px;font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;white-space:pre-wrap;word-break:break-word;';
        errTd.textContent = job.errorDetail;
        errTr.appendChild(errTd);

        var toggleBtn = document.createElement('button');
        toggleBtn.type = 'button';
        toggleBtn.textContent = 'Show error';
        toggleBtn.style.cssText = 'padding:5px 10px;font-size:11px;font-weight:600;border-radius:6px;border:1px solid #fecaca;background:#fff;color:#991b1b;cursor:pointer;margin-right:6px;';
        toggleBtn.addEventListener('click', function () {
          var open = errTr.style.display !== 'none';
          errTr.style.display = open ? 'none' : 'table-row';
          toggleBtn.textContent = open ? 'Show error' : 'Hide error';
        });
        tdActions.insertBefore(toggleBtn, tdActions.firstChild);

        // Defer appending errTr until caller attaches tr
        tr._errorRow = errTr;
      }

      return tr;
    }

    // After buildJobRow returns, the caller needs to append _errorRow; override loadJobs:
    var _origLoadJobs = loadJobs;
    loadJobs = function () {
      while (jobsBody.firstChild) jobsBody.removeChild(jobsBody.firstChild);
      var loading = document.createElement('div');
      loading.style.cssText = 'padding:16px;color:#64748b;font-size:12px;';
      loading.textContent = 'Loading jobs...';
      jobsBody.appendChild(loading);
      fetch(API_BASE + '/agri4all/jobs?deliverableId=' + deliverable.id, {
        headers: window.getAuthHeaders ? window.getAuthHeaders() : {}
      }).then(function (r) { return r.ok ? r.json() : { data: [] }; })
        .then(function (res) {
          while (jobsBody.firstChild) jobsBody.removeChild(jobsBody.firstChild);
          var jobs = (res && res.data) || [];
          if (!jobs.length) {
            var empty = document.createElement('div');
            empty.className = 'a4apu-jobs-empty';
            var emptyIcon = document.createElement('div');
            emptyIcon.className = 'a4apu-jobs-empty-icon';
            emptyIcon.textContent = '\u2601';
            empty.appendChild(emptyIcon);
            var emptyText = document.createElement('div');
            emptyText.textContent = 'No upload jobs yet. Post to Agri4All to create jobs per country.';
            empty.appendChild(emptyText);
            jobsBody.appendChild(empty);
            return;
          }
          var table = document.createElement('table');
          table.style.cssText = 'width:100%;border-collapse:collapse;font-size:12px;';
          var thead = document.createElement('thead');
          thead.innerHTML = '<tr style="background:var(--surface-alt,#f8fafc);text-align:left;">' +
            '<th style="padding:8px 12px;font-weight:700;color:#475569;">Country</th>' +
            '<th style="padding:8px 12px;font-weight:700;color:#475569;">Job</th>' +
            '<th style="padding:8px 12px;font-weight:700;color:#475569;">Agri4All</th>' +
            '<th style="padding:8px 12px;font-weight:700;color:#475569;">Slug / URL</th>' +
            '<th style="padding:8px 12px;font-weight:700;color:#475569;text-align:right;">Actions</th>' +
            '</tr>';
          table.appendChild(thead);
          var tbody = document.createElement('tbody');
          jobs.forEach(function (job) {
            var row = buildJobRow(job);
            tbody.appendChild(row);
            if (row._errorRow) tbody.appendChild(row._errorRow);
          });
          table.appendChild(tbody);
          jobsBody.appendChild(table);
        })
        .catch(function () {
          while (jobsBody.firstChild) jobsBody.removeChild(jobsBody.firstChild);
          var err = document.createElement('div');
          err.style.cssText = 'padding:16px;color:#991b1b;font-size:12px;';
          err.textContent = 'Failed to load jobs.';
          jobsBody.appendChild(err);
        });
    };

    jobsRefreshBtn.addEventListener('click', function () { loadJobs(); });
    loadJobs();

    // ── Amber re-approval warning modal ───────────────
    function confirmReapproval(onConfirm) {
      var overlay = document.createElement('div');
      overlay.style.cssText = 'position:fixed;inset:0;background:rgba(15,23,42,0.55);display:flex;align-items:center;justify-content:center;z-index:6000;';
      var box = document.createElement('div');
      box.style.cssText = 'background:#fff;border-radius:14px;padding:22px 24px;max-width:420px;width:90%;box-shadow:0 24px 60px rgba(15,23,42,0.35);border-top:4px solid #f59e0b;';
      var title = document.createElement('h3');
      title.textContent = 'Re-approval required';
      title.style.cssText = 'margin:0 0 10px;font-size:16px;font-weight:800;color:#92400e;';
      box.appendChild(title);
      var msg = document.createElement('p');
      msg.textContent = 'This will reset Agri4All approval to pending on the Agri4All admin side. Continue?';
      msg.style.cssText = 'margin:0 0 18px;font-size:13px;color:#334155;line-height:1.5;';
      box.appendChild(msg);
      var btnRow = document.createElement('div');
      btnRow.style.cssText = 'display:flex;justify-content:flex-end;gap:10px;';
      var cancel = document.createElement('button');
      cancel.type = 'button';
      cancel.textContent = 'Cancel';
      cancel.style.cssText = 'padding:8px 16px;border-radius:8px;border:1px solid #cbd5e1;background:#fff;color:#1e293b;font-weight:700;font-size:12px;cursor:pointer;';
      cancel.addEventListener('click', function () { document.body.removeChild(overlay); });
      var confirm = document.createElement('button');
      confirm.type = 'button';
      confirm.textContent = 'Confirm';
      confirm.style.cssText = 'padding:8px 16px;border-radius:8px;border:1px solid #f59e0b;background:#f59e0b;color:#fff;font-weight:700;font-size:12px;cursor:pointer;';
      confirm.addEventListener('click', function () { document.body.removeChild(overlay); onConfirm(); });
      btnRow.appendChild(cancel);
      btnRow.appendChild(confirm);
      box.appendChild(btnRow);
      overlay.appendChild(box);
      document.body.appendChild(overlay);
    }

    // ── Four-tab edit modal ───────────────────────────
    function openA4aEditModal(job) {
      var overlay = document.createElement('div');
      overlay.style.cssText = 'position:fixed;inset:0;background:rgba(15,23,42,0.55);display:flex;align-items:center;justify-content:center;z-index:5800;';

      var modal = document.createElement('div');
      modal.style.cssText = 'background:#fff;border-radius:16px;width:90%;max-width:720px;max-height:88vh;display:flex;flex-direction:column;overflow:hidden;box-shadow:0 30px 80px rgba(15,23,42,0.4);';

      // Header
      var header = document.createElement('div');
      header.style.cssText = 'padding:16px 22px;border-bottom:1px solid #e2e8f0;display:flex;align-items:center;justify-content:space-between;';
      var h = document.createElement('h3');
      h.textContent = 'Edit on Agri4All — ' + String(job.country || '').toUpperCase();
      h.style.cssText = 'margin:0;font-size:15px;font-weight:800;color:#1e293b;';
      header.appendChild(h);
      var closeBtn = document.createElement('button');
      closeBtn.type = 'button';
      closeBtn.textContent = '×';
      closeBtn.style.cssText = 'background:none;border:none;font-size:26px;line-height:1;color:#64748b;cursor:pointer;';
      closeBtn.addEventListener('click', function () { document.body.removeChild(overlay); });
      header.appendChild(closeBtn);
      modal.appendChild(header);

      // Slug line
      var slugLine = document.createElement('div');
      slugLine.style.cssText = 'padding:8px 22px;font-size:11px;color:#64748b;background:#f8fafc;font-family:ui-monospace,Menlo,Consolas,monospace;word-break:break-all;';
      slugLine.textContent = 'Slug: ' + (job.agri4allSlug || '—');
      modal.appendChild(slugLine);

      // Tabs
      var tabs = document.createElement('div');
      tabs.style.cssText = 'display:flex;border-bottom:1px solid #e2e8f0;background:#fff;';
      var tabContent = document.createElement('div');
      tabContent.style.cssText = 'flex:1;overflow-y:auto;padding:20px 22px;';

      var TAB_DEFS = [
        { key: 'details', label: 'Details', warn: true },
        { key: 'pricing', label: 'Pricing', warn: true },
        { key: 'location', label: 'Location', warn: true },
        { key: 'contacts', label: 'Contacts', warn: false },
        { key: 'media', label: 'Media', warn: false }
      ];
      var tabBtns = {};
      TAB_DEFS.forEach(function (t) {
        var b = document.createElement('button');
        b.type = 'button';
        b.textContent = t.label;
        b.style.cssText = 'flex:1;padding:12px 8px;background:none;border:none;border-bottom:2px solid transparent;font-size:12px;font-weight:700;color:#64748b;cursor:pointer;letter-spacing:0.02em;';
        b.addEventListener('click', function () { selectTab(t.key); });
        tabs.appendChild(b);
        tabBtns[t.key] = b;
      });

      modal.appendChild(tabs);
      modal.appendChild(tabContent);
      overlay.appendChild(modal);
      document.body.appendChild(overlay);

      function selectTab(key) {
        Object.keys(tabBtns).forEach(function (k) {
          var active = k === key;
          tabBtns[k].style.color = active ? '#0f766e' : '#64748b';
          tabBtns[k].style.borderBottomColor = active ? '#0f766e' : 'transparent';
        });
        while (tabContent.firstChild) tabContent.removeChild(tabContent.firstChild);
        if (key === 'details') renderDetailsTab();
        else if (key === 'pricing') renderPricingTab();
        else if (key === 'location') renderLocationTab();
        else if (key === 'contacts') renderContactsTab();
        else if (key === 'media') renderMediaTab();
      }

      function labeledInput(label, value, opts) {
        opts = opts || {};
        var wrap = document.createElement('label');
        wrap.style.cssText = 'display:block;margin-bottom:12px;font-size:12px;font-weight:700;color:#334155;';
        var lbl = document.createElement('div');
        lbl.textContent = label;
        lbl.style.cssText = 'margin-bottom:4px;';
        wrap.appendChild(lbl);
        var input;
        if (opts.textarea) {
          input = document.createElement('textarea');
          input.rows = opts.rows || 4;
        } else {
          input = document.createElement('input');
          input.type = opts.type || 'text';
        }
        if (value != null) input.value = value;
        input.style.cssText = 'width:100%;padding:8px 10px;border-radius:8px;border:1px solid #cbd5e1;font-size:12px;font-family:inherit;box-sizing:border-box;';
        wrap.appendChild(input);
        wrap._input = input;
        return wrap;
      }

      function submitBtn(label, onClick, opts) {
        opts = opts || {};
        var b = document.createElement('button');
        b.type = 'button';
        b.textContent = label;
        var color = opts.warn ? '#f59e0b' : '#10B981';
        b.style.cssText = 'margin-top:10px;padding:10px 20px;border-radius:10px;border:1px solid ' + color + ';background:' + color + ';color:#fff;font-weight:700;font-size:13px;cursor:pointer;';
        b.addEventListener('click', onClick);
        return b;
      }

      function warnBanner() {
        var w = document.createElement('div');
        w.style.cssText = 'padding:10px 14px;border-radius:10px;background:#fef3c7;color:#92400e;border:1px solid #fde68a;font-size:12px;font-weight:600;margin-bottom:14px;';
        w.textContent = 'Editing these fields will trigger Agri4All re-approval.';
        return w;
      }

      function reloadAfterEdit() {
        loadJobs();
      }

      function renderDetailsTab() {
        tabContent.appendChild(warnBanner());
        var name = labeledInput('Name', '');
        var desc = labeledInput('Description', '', { textarea: true, rows: 6 });
        var categoryId = labeledInput('Category ID (leaf)', '', { type: 'number' });
        var fields = labeledInput('Fields (JSON)', '{}', { textarea: true, rows: 4 });
        tabContent.appendChild(name);
        tabContent.appendChild(desc);
        tabContent.appendChild(categoryId);
        tabContent.appendChild(fields);
        tabContent.appendChild(submitBtn('Save Details', function () {
          confirmReapproval(function () {
            var body = {};
            if (name._input.value) body.name = name._input.value;
            if (desc._input.value) body.description = desc._input.value;
            if (categoryId._input.value) body.categoryId = parseInt(categoryId._input.value, 10);
            try { body.fields = JSON.parse(fields._input.value || '{}'); } catch (e) { showToast('Invalid fields JSON', '#ef4444'); return; }
            fetch(API_BASE + '/agri4all/jobs/' + job.id + '/product', {
              method: 'PUT',
              headers: getHeaders(),
              body: JSON.stringify(body)
            }).then(function (r) { return r.ok ? r.json() : Promise.reject(r); })
              .then(function () { showToast('Details saved — approval reset to pending'); document.body.removeChild(overlay); reloadAfterEdit(); })
              .catch(function () { showToast('Save failed', '#ef4444'); });
          });
        }, { warn: true }));
      }

      function renderPricingTab() {
        tabContent.appendChild(warnBanner());
        var note = document.createElement('div');
        note.style.cssText = 'font-size:12px;color:#64748b;margin-bottom:10px;';
        note.textContent = 'Price type defaults to price_on_request. Change amount in cents (R1 = 100).';
        tabContent.appendChild(note);
        var type = labeledInput('Price type', 'price_on_request');
        var vat = labeledInput('VAT', 'vat_not_applicable');
        var amt = labeledInput('Amount (cents, optional)', '', { type: 'number' });
        var currency = labeledInput('Currency (ISO)', 'ZAR');
        tabContent.appendChild(type);
        tabContent.appendChild(vat);
        tabContent.appendChild(amt);
        tabContent.appendChild(currency);
        tabContent.appendChild(submitBtn('Save Pricing', function () {
          confirmReapproval(function () {
            var price = { type: type._input.value || 'price_on_request', vat: vat._input.value || 'vat_not_applicable' };
            if (amt._input.value) price.amount = parseInt(amt._input.value, 10);
            if (currency._input.value) price.currency = currency._input.value;
            fetch(API_BASE + '/agri4all/jobs/' + job.id + '/product', {
              method: 'PUT',
              headers: getHeaders(),
              body: JSON.stringify({ price: price })
            }).then(function (r) { return r.ok ? r.json() : Promise.reject(r); })
              .then(function () { showToast('Pricing saved — approval reset to pending'); document.body.removeChild(overlay); reloadAfterEdit(); })
              .catch(function () { showToast('Save failed', '#ef4444'); });
          });
        }, { warn: true }));
      }

      function renderLocationTab() {
        tabContent.appendChild(warnBanner());
        var country = labeledInput('Country (ISO alpha-2)', String(job.country || '').toUpperCase());
        var state = labeledInput('State / Province', '');
        var city = labeledInput('City', '');
        var zip = labeledInput('Postal / ZIP', '');
        var lat = labeledInput('Latitude', '', { type: 'number' });
        var lng = labeledInput('Longitude', '', { type: 'number' });
        tabContent.appendChild(country);
        tabContent.appendChild(state);
        tabContent.appendChild(city);
        tabContent.appendChild(zip);
        tabContent.appendChild(lat);
        tabContent.appendChild(lng);
        tabContent.appendChild(submitBtn('Save Location', function () {
          confirmReapproval(function () {
            var body = {
              country: country._input.value,
              state: state._input.value,
              city: city._input.value,
              zip: zip._input.value,
              latitude: parseFloat(lat._input.value) || null,
              longitude: parseFloat(lng._input.value) || null
            };
            fetch(API_BASE + '/agri4all/jobs/' + job.id + '/location', {
              method: 'PUT',
              headers: getHeaders(),
              body: JSON.stringify(body)
            }).then(function (r) { return r.ok ? r.json() : Promise.reject(r); })
              .then(function () { showToast('Location saved — approval reset to pending'); document.body.removeChild(overlay); reloadAfterEdit(); })
              .catch(function () { showToast('Save failed', '#ef4444'); });
          });
        }, { warn: true }));
      }

      function renderContactsTab() {
        var info = document.createElement('div');
        info.style.cssText = 'padding:10px 14px;border-radius:10px;background:#dcfce7;color:#166534;border:1px solid #bbf7d0;font-size:12px;font-weight:600;margin-bottom:14px;';
        info.textContent = 'Safe edit — contact changes do not trigger re-approval.';
        tabContent.appendChild(info);

        var list = document.createElement('div');
        tabContent.appendChild(list);
        var contacts = [];

        function renderList() {
          while (list.firstChild) list.removeChild(list.firstChild);
          contacts.forEach(function (c, idx) {
            var row = document.createElement('div');
            row.style.cssText = 'border:1px solid #e2e8f0;border-radius:10px;padding:12px;margin-bottom:10px;position:relative;';
            var rm = document.createElement('button');
            rm.type = 'button';
            rm.textContent = 'Remove';
            rm.style.cssText = 'position:absolute;top:8px;right:8px;padding:3px 8px;font-size:10px;border-radius:6px;border:1px solid #fecaca;background:#fff;color:#991b1b;cursor:pointer;';
            rm.addEventListener('click', function () { contacts.splice(idx, 1); renderList(); });
            row.appendChild(rm);
            var nm = labeledInput('Name', c.name || '');
            var em = labeledInput('Email', c.email || '', { type: 'email' });
            var ph = labeledInput('Phone', c.phone || '');
            var pref = labeledInput('Preferred contact (email|phone|whatsapp)', c.preferredContact || c.preferred_contact || 'email');
            nm._input.addEventListener('input', function () { c.name = nm._input.value; });
            em._input.addEventListener('input', function () { c.email = em._input.value; });
            ph._input.addEventListener('input', function () { c.phone = ph._input.value; });
            pref._input.addEventListener('input', function () { c.preferredContact = pref._input.value; });
            row.appendChild(nm);
            row.appendChild(em);
            row.appendChild(ph);
            row.appendChild(pref);
            list.appendChild(row);
          });
        }

        var addBtn = document.createElement('button');
        addBtn.type = 'button';
        addBtn.textContent = '+ Add contact';
        addBtn.style.cssText = 'padding:6px 12px;border-radius:8px;border:1px dashed #cbd5e1;background:#fff;color:#334155;font-weight:700;font-size:11px;cursor:pointer;margin-bottom:12px;';
        addBtn.addEventListener('click', function () {
          contacts.push({ name: '', email: '', phone: '', preferredContact: 'email' });
          renderList();
        });
        tabContent.appendChild(addBtn);

        // Start with one empty row
        contacts.push({ name: '', email: '', phone: '', preferredContact: 'email' });
        renderList();

        tabContent.appendChild(submitBtn('Save Contacts', function () {
          fetch(API_BASE + '/agri4all/jobs/' + job.id + '/contacts', {
            method: 'PUT',
            headers: getHeaders(),
            body: JSON.stringify({ contacts: contacts })
          }).then(function (r) { return r.ok ? r.json() : Promise.reject(r); })
            .then(function () { showToast('Contacts saved'); document.body.removeChild(overlay); reloadAfterEdit(); })
            .catch(function () { showToast('Save failed', '#ef4444'); });
        }, { warn: false }));
      }

      function renderMediaTab() {
        var info = document.createElement('div');
        info.style.cssText = 'padding:10px 14px;border-radius:10px;background:#dcfce7;color:#166534;border:1px solid #bbf7d0;font-size:12px;font-weight:600;margin-bottom:14px;';
        info.textContent = 'Safe edit — media changes do not trigger re-approval.';
        tabContent.appendChild(info);

        var addHint = document.createElement('div');
        addHint.style.cssText = 'font-size:12px;color:#334155;margin-bottom:8px;font-weight:700;';
        addHint.textContent = 'Add media — upload images; they will be pushed to Agri4All.';
        tabContent.appendChild(addHint);

        var pendingFilenames = [];
        var pendingList = document.createElement('div');
        pendingList.style.cssText = 'margin-bottom:10px;font-size:11px;color:#475569;';
        tabContent.appendChild(pendingList);
        function renderPending() {
          while (pendingList.firstChild) pendingList.removeChild(pendingList.firstChild);
          pendingFilenames.forEach(function (f) {
            var chip = document.createElement('span');
            chip.textContent = f;
            chip.style.cssText = 'display:inline-block;padding:3px 10px;margin:2px;border-radius:999px;background:#e0f2fe;color:#075985;font-family:ui-monospace,Menlo,monospace;font-size:10px;';
            pendingList.appendChild(chip);
          });
        }

        var fileLabel = document.createElement('label');
        fileLabel.style.cssText = 'display:inline-block;padding:8px 14px;border-radius:8px;border:1px dashed #cbd5e1;background:#fff;color:#334155;font-weight:700;font-size:12px;cursor:pointer;margin-bottom:12px;';
        fileLabel.textContent = 'Select images';
        var fileInput = document.createElement('input');
        fileInput.type = 'file';
        fileInput.multiple = true;
        fileInput.accept = 'image/*,.pdf';
        fileInput.style.display = 'none';
        fileInput.addEventListener('change', function () {
          var fList = Array.from(fileInput.files || []);
          if (!fList.length) return;
          var fd = new FormData();
          fList.forEach(function (f) { fd.append('images', f); });
          fileLabel.textContent = 'Uploading...';
          fetch('/api/deliverables/' + deliverable.id + '/upload-images', {
            method: 'POST',
            headers: window.getAuthHeaders ? window.getAuthHeaders() : {},
            body: fd
          }).then(function (r) { return r.ok ? r.json() : Promise.reject(r); })
            .then(function (res) {
              (res.urls || []).forEach(function (u) {
                // Use filename derived from URL; backend joins with UPLOAD_DIR.
                var fname = u.split('/').pop();
                pendingFilenames.push(fname);
              });
              renderPending();
              fileLabel.textContent = 'Select images';
            })
            .catch(function () { fileLabel.textContent = 'Select images'; showToast('Upload failed', '#ef4444'); });
        });
        fileLabel.appendChild(fileInput);
        tabContent.appendChild(fileLabel);

        tabContent.appendChild(submitBtn('Push media to Agri4All', function () {
          if (!pendingFilenames.length) { showToast('No files selected', '#ef4444'); return; }
          fetch(API_BASE + '/agri4all/jobs/' + job.id + '/media', {
            method: 'POST',
            headers: getHeaders(),
            body: JSON.stringify({ filenames: pendingFilenames })
          }).then(function (r) { return r.ok ? r.json() : Promise.reject(r); })
            .then(function () { showToast('Media uploaded'); document.body.removeChild(overlay); reloadAfterEdit(); })
            .catch(function () { showToast('Media push failed', '#ef4444'); });
        }, { warn: false }));

        // Delete media section
        var delWrap = document.createElement('div');
        delWrap.style.cssText = 'margin-top:20px;padding-top:16px;border-top:1px dashed #e2e8f0;';
        var delTitle = document.createElement('div');
        delTitle.textContent = 'Delete media by ID';
        delTitle.style.cssText = 'font-size:12px;font-weight:700;color:#334155;margin-bottom:8px;';
        delWrap.appendChild(delTitle);
        var delId = labeledInput('Media ID', '', { type: 'number' });
        delWrap.appendChild(delId);
        var delBtn = document.createElement('button');
        delBtn.type = 'button';
        delBtn.textContent = 'Delete media';
        delBtn.style.cssText = 'padding:8px 14px;border-radius:8px;border:1px solid #ef4444;background:#fff;color:#991b1b;font-weight:700;font-size:12px;cursor:pointer;';
        delBtn.addEventListener('click', function () {
          var mid = delId._input.value;
          if (!mid) { showToast('Enter media ID', '#ef4444'); return; }
          fetch(API_BASE + '/agri4all/jobs/' + job.id + '/media/' + encodeURIComponent(mid), {
            method: 'DELETE',
            headers: getHeaders()
          }).then(function (r) { return r.ok ? r.json() : Promise.reject(r); })
            .then(function () { showToast('Media deleted'); reloadAfterEdit(); })
            .catch(function () { showToast('Delete failed', '#ef4444'); });
        });
        delWrap.appendChild(delBtn);
        tabContent.appendChild(delWrap);
      }

      selectTab('details');
    }

    body.appendChild(rightPanel);
    wrapper.appendChild(body);
    container.appendChild(wrapper);

    // ── Chat bootstrap (same pattern as CC dashboard) ─
    stopCCChatPoll();
    var a4apuChannelId = null;
    var a4apuLastId = 0;
    var a4apuKnownIds = Object.create(null);

    function fmtTime(iso) {
      if (!iso) return '';
      try {
        var d = new Date(iso);
        var now = new Date();
        var opts = (d.toDateString() === now.toDateString())
          ? { hour: '2-digit', minute: '2-digit' }
          : { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' };
        return d.toLocaleString(undefined, opts);
      } catch (e) { return ''; }
    }

    function isChatImageAttachment(att) {
      if (!att) return false;
      var mime = String(att.mimeType || att.mime_type || '').toLowerCase();
      if (mime.indexOf('image/') === 0) return true;
      var ref = String(att.originalName || att.original_name || att.filename || '').toLowerCase();
      return /\.(jpg|jpeg|png|gif|webp|svg|bmp|heic|heif|avif)$/i.test(ref);
    }

    function buildChatFileLink(url, att) {
      var link = document.createElement('a');
      link.href = url;
      link.target = '_blank';
      link.rel = 'noopener noreferrer';
      link.innerHTML = '<svg viewBox="0 0 24 24" width="12" height="12"><path fill="currentColor" d="M14 2H6c-1.1 0-2 .9-2 2v16c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V8l-6-6zm-1 7V3.5L18.5 9H13z"/></svg>';
      var fname = document.createElement('span');
      fname.textContent = att.originalName || att.original_name || att.filename || 'File';
      link.appendChild(fname);
      return link;
    }

    function renderChatMentionContent(el, content) {
      var mentionRegex = /@\[([^\]]+)\]\(employee:(\d+)\)/g;
      var lastIndex = 0;
      var match;
      while ((match = mentionRegex.exec(content || '')) !== null) {
        if (match.index > lastIndex) {
          el.appendChild(document.createTextNode(String(content).substring(lastIndex, match.index)));
        }
        var mentionSpan = document.createElement('span');
        mentionSpan.textContent = '@' + match[1];
        mentionSpan.dataset.employeeId = match[2];
        mentionSpan.style.cssText = 'display:inline-block;padding:1px 6px;border-radius:999px;background:rgba(59,130,246,0.12);color:#1d4ed8;font-weight:600;';
        el.appendChild(mentionSpan);
        lastIndex = match.index + match[0].length;
      }
      if (lastIndex < String(content || '').length) {
        el.appendChild(document.createTextNode(String(content).substring(lastIndex)));
      }
      if (!el.firstChild) el.appendChild(document.createTextNode(content || ''));
    }

    function handleMentionTrigger(textarea, dropdown) {
      var val = textarea.value || '';
      var cursorPos = textarea.selectionStart || 0;
      var textBeforeCursor = val.substring(0, cursorPos);
      var atMatch = textBeforeCursor.match(/@(\w*)$/);
      if (!atMatch) {
        dropdown.style.display = 'none';
        return;
      }
      var query = atMatch[1].toLowerCase();
      var empPromise = window._fetchEmployees ? window._fetchEmployees() : fetch('/api/employees', { headers: getHeaders() }).then(function (r) { return r.ok ? r.json() : []; });
      empPromise.then(function (employees) {
        var filtered = (employees || []).filter(function (emp) {
          var full = (((emp.first_name || emp.firstName || '') + ' ' + (emp.last_name || emp.lastName || '')).trim()).toLowerCase();
          var username = String(emp.username || '').toLowerCase();
          return !query || full.indexOf(query) !== -1 || username.indexOf(query) !== -1;
        }).slice(0, 8);
        while (dropdown.firstChild) dropdown.removeChild(dropdown.firstChild);
        if (filtered.length === 0) {
          dropdown.style.display = 'none';
          return;
        }
        filtered.forEach(function (emp) {
          var item = document.createElement('div');
          item.className = 'cd-mention-item';
          var avatar = document.createElement('div');
          avatar.className = 'cd-mention-avatar';
          var photo = emp.photo_url || emp.photoUrl;
          if (photo) {
            var img = document.createElement('img');
            img.src = '/uploads/photos/' + photo;
            img.alt = '';
            avatar.appendChild(img);
          } else {
            var initials = (((emp.first_name || emp.firstName || '')[0] || '') + ((emp.last_name || emp.lastName || '')[0] || '')).toUpperCase() || '@';
            avatar.textContent = initials;
          }
          item.appendChild(avatar);
          var label = document.createElement('span');
          label.textContent = ((emp.first_name || emp.firstName || '') + ' ' + (emp.last_name || emp.lastName || '')).trim() || emp.username || 'User';
          item.appendChild(label);
          item.addEventListener('click', function () {
            insertMention(textarea, atMatch, emp);
            dropdown.style.display = 'none';
          });
          dropdown.appendChild(item);
        });
        dropdown.style.display = '';
      }).catch(function () {
        dropdown.style.display = 'none';
      });
    }

    function insertMention(textarea, atMatch, emp) {
      var val = textarea.value || '';
      var cursorPos = textarea.selectionStart || 0;
      var beforeAt = val.substring(0, cursorPos - atMatch[0].length);
      var afterCursor = val.substring(cursorPos);
      var fullName = ((emp.first_name || emp.firstName || '') + ' ' + (emp.last_name || emp.lastName || '')).trim() || emp.username || 'User';
      var mention = '@[' + fullName + '](employee:' + emp.id + ') ';
      textarea.value = beforeAt + mention + afterCursor;
      var newPos = beforeAt.length + mention.length;
      textarea.selectionStart = newPos;
      textarea.selectionEnd = newPos;
      textarea.focus();
    }

    function renderMsg(m, scrollToBottom) {
      if (!m || a4apuKnownIds[m.id]) return;
      a4apuKnownIds[m.id] = true;
      if (m.id > a4apuLastId) a4apuLastId = m.id;

      var emptyEl = chatList.querySelector('.cd-messenger-empty');
      if (emptyEl) emptyEl.remove();

      var senderId = m.sender_id || m.senderId;
      var cu = window.getCurrentUser ? window.getCurrentUser() : null;
      var isOwn = cu && cu.id && String(senderId) === String(cu.id);

      var bubble = document.createElement('div');
      bubble.className = 'cd-bubble' + (isOwn ? ' cd-bubble-own' : '');
      bubble.dataset.messageId = m.id;

      if (!isOwn) {
        var avatar = document.createElement('img');
        avatar.className = 'cd-bubble-avatar';
        avatar.alt = '';
        var photoUrl = m.senderPhotoUrl || m.sender_photo_url;
        avatar.src = photoUrl ? '/uploads/photos/' + photoUrl : 'data:image/svg+xml,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="%2394a3b8"><path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/></svg>');
        bubble.appendChild(avatar);
      }

      var body2 = document.createElement('div');
      body2.className = 'cd-bubble-body';

      var hdr = document.createElement('div');
      hdr.className = 'cd-bubble-meta';
      var who = document.createElement('span');
      who.className = 'cd-bubble-sender';
      who.textContent = ((m.sender_first_name || m.senderFirstName || '') + ' ' + (m.sender_last_name || m.senderLastName || '')).trim() || 'Unknown';
      hdr.appendChild(who);
      var ts = document.createElement('span');
      ts.className = 'cd-bubble-time';
      ts.textContent = fmtTime(m.created_at || m.createdAt);
      hdr.appendChild(ts);
      body2.appendChild(hdr);

      var contentEl = document.createElement('div');
      contentEl.className = 'cd-bubble-content';
      renderChatMentionContent(contentEl, m.content || '');
      body2.appendChild(contentEl);

      var attachments = m.attachments;
      if (attachments && Array.isArray(attachments) && attachments.length > 0) {
        attachments.forEach(function (att) {
          var attEl = document.createElement('div');
          attEl.className = 'cd-bubble-attachment';
          var url = '/uploads/attachments/' + att.filename;
          if (isChatImageAttachment(att)) {
            var imageLink = document.createElement('a');
            imageLink.href = url;
            imageLink.target = '_blank';
            imageLink.rel = 'noopener noreferrer';
            var img = document.createElement('img');
            img.src = url;
            img.alt = att.originalName || att.original_name || 'Image';
            img.style.cssText = 'max-width:220px;max-height:200px;border-radius:6px;cursor:pointer;display:block;margin-top:4px;';
            img.addEventListener('error', function () {
              while (attEl.firstChild) attEl.removeChild(attEl.firstChild);
              attEl.appendChild(buildChatFileLink(url, att));
            });
            imageLink.appendChild(img);
            attEl.appendChild(imageLink);
          } else {
            attEl.appendChild(buildChatFileLink(url, att));
          }
          body2.appendChild(attEl);
        });
      }

      bubble.appendChild(body2);
      chatList.appendChild(bubble);
      if (scrollToBottom) scrollBottom();
    }

    function scrollBottom() { chatList.scrollTop = chatList.scrollHeight; }

    function loadMsgs() {
      if (!a4apuChannelId) return;
      fetch('/api/messaging/channels/' + a4apuChannelId + '/messages?limit=50', { headers: getHeaders() })
        .then(function (r) { return r.ok ? r.json() : []; })
        .then(function (msgs) {
          while (chatList.firstChild) chatList.removeChild(chatList.firstChild);
          a4apuKnownIds = Object.create(null);
          a4apuLastId = 0;
          if (!msgs || !msgs.length) {
            var empty = document.createElement('div');
            empty.className = 'cd-messenger-empty';
            empty.textContent = 'No messages yet';
            chatList.appendChild(empty);
          } else {
            msgs.forEach(function (m) { renderMsg(m, false); });
          }
          scrollBottom();
        }).catch(function () {});
    }

    function pollMsgs() {
      if (!a4apuChannelId) return;
      fetch('/api/messaging/channels/' + a4apuChannelId + '/messages?after=' + a4apuLastId, { headers: getHeaders() })
        .then(function (r) { return r.ok ? r.json() : []; })
        .then(function (msgs) {
          if (!msgs || !msgs.length) return;
          var before = chatList.scrollHeight;
          msgs.forEach(function (m) { renderMsg(m, false); });
          if (chatList.scrollTop + chatList.clientHeight >= before - 40) scrollBottom();
        }).catch(function () {});
    }

    function sendMsg() {
      var content = (chatInput.value || '').trim();
      if (!content || !a4apuChannelId) return;
      var mentionRegex = /@\[[^\]]+\]\(employee:(\d+)\)/g;
      var mentions = [];
      var match;
      while ((match = mentionRegex.exec(content)) !== null) mentions.push(parseInt(match[1], 10));
      chatInput.value = '';
      chatInput.style.height = 'auto';
      mentionDropdown.style.display = 'none';
      fetch('/api/messaging/channels/' + a4apuChannelId + '/messages', {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({ content: content, mentions: mentions })
      }).then(function (r) { return r.ok ? r.json() : null; })
        .then(function (m) {
          if (m) renderMsg(m, true);
        }).catch(function () {});
    }

    function sendMsgFiles(files) {
      if (!a4apuChannelId || !files || files.length === 0) return;
      var textContent = (chatInput.value || '').trim();
      chatInput.value = '';
      chatInput.style.height = 'auto';
      Array.prototype.forEach.call(files, function (file, idx) {
        var fd = new FormData();
        fd.append('content', idx === 0 ? (textContent || file.name) : file.name);
        fd.append('file', file);
        var h = {};
        if (window.getAuthHeaders) {
          var auth = window.getAuthHeaders();
          for (var k in auth) if (auth.hasOwnProperty(k)) h[k] = auth[k];
        }
        fetch('/api/messaging/channels/' + a4apuChannelId + '/messages', {
          method: 'POST',
          headers: h,
          body: fd
        }).then(function (r) { return r.ok ? r.json() : null; })
          .then(function (m) { if (m) renderMsg(m, true); })
          .catch(function () {});
      });
    }

    chatSend.addEventListener('click', sendMsg);
    chatInput.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && mentionDropdown.style.display !== 'none') {
        mentionDropdown.style.display = 'none';
        return;
      }
      if (e.key === 'Enter' && mentionDropdown.style.display !== 'none') {
        var firstMention = mentionDropdown.querySelector('.cd-mention-item');
        if (firstMention) {
          e.preventDefault();
          firstMention.click();
          return;
        }
      }
      if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMsg(); }
    });
    attachBtn.addEventListener('click', function () {
      if (!a4apuChannelId) return;
      var fileInput = document.createElement('input');
      fileInput.type = 'file';
      fileInput.multiple = true;
      fileInput.accept = 'image/*,.pdf,.doc,.docx,.xls,.xlsx,.txt';
      fileInput.addEventListener('change', function () {
        if (fileInput.files && fileInput.files.length > 0) sendMsgFiles(fileInput.files);
      });
      fileInput.click();
    });

    fetch('/api/messaging/channels/for-deliverable', {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({ deliverableId: deliverable.id })
    }).then(function (r) { return r.ok ? r.json() : null; })
      .then(function (ch) {
        if (!ch || !ch.id) {
          while (chatList.firstChild) chatList.removeChild(chatList.firstChild);
          var errRow = document.createElement('div');
          errRow.className = 'cd-messenger-empty';
          errRow.textContent = 'Chat unavailable';
          chatList.appendChild(errRow);
          return;
        }
        a4apuChannelId = ch.id;
        chatInput.disabled = false;
        chatSend.disabled = false;
        loadMsgs();
        stopCCChatPoll();
        _ccChatPoll = setInterval(pollMsgs, 15000);
      }).catch(function () {});
  }
  window.openA4AProductUploadsDashboard = openA4AProductUploadsDashboard;

  // ══════ A4A MULTI-SECTION FILE UPLOAD DASHBOARD (posts/videos) ══════
  function openA4AMultiSectionDashboard(container, deliverable, kind) {
    _ccContainer = container;
    while (container.firstChild) container.removeChild(container.firstChild);

    var meta = deliverable.metadata || {};
    if (typeof meta === 'string') try { meta = JSON.parse(meta); } catch (e) { meta = {}; }
    if (!meta.sections) meta.sections = {};
    if (!meta.extra_sections) meta.extra_sections = [];

    function save() {
      fetch(API_BASE + '/' + deliverable.id, {
        method: 'PATCH', headers: getHeaders(),
        body: JSON.stringify({ metadata: { sections: meta.sections, extra_sections: meta.extra_sections } })
      });
    }

    // Build sections config based on kind
    var sectionConfig = [];
    if (kind === 'posts') {
      if (meta.facebook_posts) sectionConfig.push({ key: 'facebook_posts', label: 'Facebook Posts', amount: meta.facebook_posts_amount, curated: meta.facebook_posts_curated_amount });
      if (meta.instagram_posts) sectionConfig.push({ key: 'instagram_posts', label: 'Instagram Posts', amount: meta.instagram_posts_amount, curated: meta.instagram_posts_curated_amount });
      if (meta.instagram_stories) sectionConfig.push({ key: 'instagram_stories', label: 'Instagram Stories', amount: meta.instagram_stories_amount });
    } else if (kind === 'videos') {
      if (meta.facebook_stories) sectionConfig.push({ key: 'facebook_stories', label: 'Facebook Stories', amount: meta.facebook_stories_amount });
      if (meta.instagram_stories) sectionConfig.push({ key: 'instagram_stories', label: 'Instagram Stories', amount: meta.instagram_stories_amount });
      if (meta.facebook_video_posts) sectionConfig.push({ key: 'facebook_video_posts', label: 'Facebook Video Posts', amount: meta.facebook_video_posts_amount, curated: meta.facebook_video_posts_curated_amount });
      if (meta.tiktok_shorts) sectionConfig.push({ key: 'tiktok_shorts', label: 'TikTok Shorts', amount: meta.tiktok_amount });
      if (meta.youtube_shorts) sectionConfig.push({ key: 'youtube_shorts', label: 'YouTube Shorts', amount: meta.youtube_shorts_amount });
      if (meta.youtube_video) sectionConfig.push({ key: 'youtube_video', label: 'YouTube Videos', amount: meta.youtube_video_amount });
    } else if (kind === 'own-posts') {
      if (meta.facebook_posts) sectionConfig.push({ key: 'facebook_posts', label: 'Facebook Posts', amount: meta.facebook_posts_amount, curated: meta.facebook_posts_curated_amount, timeframe: meta.facebook_posts_timeframe });
      if (meta.facebook_stories) sectionConfig.push({ key: 'facebook_stories', label: 'Facebook Stories', amount: meta.facebook_stories_amount, timeframe: meta.facebook_stories_timeframe });
      if (meta.instagram_posts) sectionConfig.push({ key: 'instagram_posts', label: 'Instagram Posts', amount: meta.instagram_posts_amount, curated: meta.instagram_posts_curated_amount, timeframe: meta.instagram_posts_timeframe });
      if (meta.instagram_stories) sectionConfig.push({ key: 'instagram_stories', label: 'Instagram Stories', amount: meta.instagram_stories_amount, timeframe: meta.instagram_stories_timeframe });
    } else if (kind === 'own-videos') {
      if (meta.facebook_video_posts) sectionConfig.push({ key: 'facebook_video_posts', label: 'Facebook Video Posts', amount: meta.facebook_video_posts_amount, curated: meta.facebook_video_posts_curated_amount, timeframe: meta.facebook_video_posts_timeframe });
      if (meta.tiktok_shorts) sectionConfig.push({ key: 'tiktok_shorts', label: 'TikTok Shorts', amount: meta.tiktok_amount, timeframe: meta.tiktok_timeframe });
      if (meta.youtube_shorts) sectionConfig.push({ key: 'youtube_shorts', label: 'YouTube Shorts', amount: meta.youtube_shorts_amount, timeframe: meta.youtube_shorts_timeframe });
      if (meta.youtube_video) sectionConfig.push({ key: 'youtube_video', label: 'YouTube Videos', amount: meta.youtube_video_amount, timeframe: meta.youtube_video_timeframe });
    }

    setupDashboardSidebar(deliverable, function (nav) {
      var sectionTitle = (kind === 'posts' || kind === 'own-posts') ? 'Post Amounts' : 'Video Amounts';
      addSidebarSection(nav, sectionTitle);
      var wrap = document.createElement('div');
      wrap.style.padding = '0 16px';
      sectionConfig.forEach(function (s) {
        var parts = [];
        if (s.amount) parts.push(s.amount);
        if (s.curated) parts.push('(+' + s.curated + ' curated)');
        if (s.timeframe) parts.push('(' + s.timeframe + ')');
        addSidebarField(wrap, s.label, parts.join(' '));
      });
      nav.appendChild(wrap);
      addCountriesToSidebar(nav, meta.countries);
    });

    var wrapper = document.createElement('div');
    wrapper.className = 'wd-dashboard';

    var titleRow = document.createElement('div');
    titleRow.style.cssText = 'display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;';
    var title = document.createElement('h2');
    title.className = 'cc-dashboard-title';
    title.textContent = formatTypeLabel(deliverable.type);
    titleRow.appendChild(title);

    var addBlockBtn = document.createElement('button');
    addBlockBtn.className = 'cc-add-row-btn';
    addBlockBtn.textContent = '+ Add Block';
    addBlockBtn.addEventListener('click', function () {
      meta.extra_sections.push({ name: 'New Block', files: [], done: false });
      renderAll();
      save();
    });
    titleRow.appendChild(addBlockBtn);
    wrapper.appendChild(titleRow);

    // Materials recap (request-form responses + assets) — fetched async
    var a4aMsRecap = document.createElement('div');
    a4aMsRecap.className = 'cc-materials-recap';
    var a4aMsRecapLoading = document.createElement('div');
    a4aMsRecapLoading.className = 'cc-recap-loading';
    a4aMsRecapLoading.textContent = 'Loading materials...';
    a4aMsRecap.appendChild(a4aMsRecapLoading);
    wrapper.appendChild(a4aMsRecap);
    fetchRequestFormRecap(deliverable.id, a4aMsRecap);

    var stepsWrap = document.createElement('div');
    stepsWrap.className = 'wd-steps';
    wrapper.appendChild(stepsWrap);
    container.appendChild(wrapper);

    function buildStep(opts) {
      // opts: { num, label, amount, curated, timeframe, files, done, editable, onRename, onDone, onDelete }
      var stepEl = document.createElement('div');
      stepEl.className = 'wd-step';

      var header = document.createElement('div');
      header.className = 'wd-step-header';

      var num = document.createElement('span');
      num.className = 'wd-step-num';
      num.textContent = opts.num;
      header.appendChild(num);

      var titleEl = document.createElement(opts.editable ? 'span' : 'span');
      titleEl.className = 'wd-step-title';
      if (opts.editable) {
        titleEl.contentEditable = 'true';
        titleEl.textContent = opts.label;
        titleEl.addEventListener('blur', function () {
          opts.onRename(titleEl.textContent);
        });
      } else {
        var amtText = '';
        if (opts.amount) amtText += ' — ' + opts.amount;
        if (opts.curated) amtText += ' (+' + opts.curated + ' curated)';
        if (opts.timeframe) amtText += ' · ' + opts.timeframe;
        titleEl.textContent = opts.label + amtText;
      }
      header.appendChild(titleEl);

      if (opts.onDelete) {
        var delBtn = document.createElement('button');
        delBtn.className = 'wd-step-delete';
        delBtn.textContent = '\u00D7';
        delBtn.title = 'Delete block';
        delBtn.addEventListener('click', function () { opts.onDelete(); });
        header.appendChild(delBtn);
      }

      stepEl.appendChild(header);
      if (opts.done) stepEl.classList.add('wd-step-done');

      stepEl.appendChild(buildUploadArea(deliverable.id, opts.files, save, 'Upload ' + opts.label));
      return stepEl;
    }

    function renderAll() {
      while (stepsWrap.firstChild) stepsWrap.removeChild(stepsWrap.firstChild);
      var counter = 1;

      if (sectionConfig.length === 0 && meta.extra_sections.length === 0) {
        var empty = document.createElement('div');
        empty.style.cssText = 'padding:20px;text-align:center;color:var(--text-muted,#94a3b8);';
        empty.textContent = 'No sections. Click + Add Block to add one.';
        stepsWrap.appendChild(empty);
        return;
      }

      // Built-in sections
      sectionConfig.forEach(function (sec) {
        if (!meta.sections[sec.key]) meta.sections[sec.key] = { files: [], done: false };
        (function (s) {
          stepsWrap.appendChild(buildStep({
            num: counter++,
            label: s.label,
            amount: s.amount, curated: s.curated, timeframe: s.timeframe,
            files: meta.sections[s.key].files,
            done: meta.sections[s.key].done,
            editable: false,
            onDone: function (v) { meta.sections[s.key].done = v; save(); }
          }));
        })(sec);
      });

      // Extra sections
      meta.extra_sections.forEach(function (xs, idx) {
        if (!xs.files) xs.files = [];
        stepsWrap.appendChild(buildStep({
          num: counter++,
          label: xs.name || 'New Block',
          files: xs.files,
          done: xs.done,
          editable: true,
          onRename: function (v) { xs.name = v; save(); },
          onDone: function (v) { xs.done = v; save(); },
          onDelete: function () { meta.extra_sections.splice(idx, 1); renderAll(); save(); }
        }));
      });
    }
    renderAll();
  }

  // ══════ A4A IMAGE + DESCRIPTION DASHBOARD (product uploads, newsletters) ══════
  function openA4AImageDescriptionDashboard(container, deliverable) {
    _ccContainer = container;
    while (container.firstChild) container.removeChild(container.firstChild);

    var meta = deliverable.metadata || {};
    if (typeof meta === 'string') try { meta = JSON.parse(meta); } catch (e) { meta = {}; }
    if (!meta.items) meta.items = [];

    function save() {
      fetch(API_BASE + '/' + deliverable.id, {
        method: 'PATCH', headers: getHeaders(),
        body: JSON.stringify({ metadata: { items: meta.items } })
      });
    }

    setupDashboardSidebar(deliverable, function (nav) {
      addSidebarSection(nav, 'Details');
      var wrap = document.createElement('div');
      wrap.style.padding = '0 16px';
      if (meta.amount) addSidebarField(wrap, 'Amount', meta.amount);
      if (meta.product_uploads_amount) addSidebarField(wrap, 'Product Uploads', meta.product_uploads_amount);
      if (meta.unlimited_product_uploads) addSidebarField(wrap, 'Unlimited', 'Yes');
      // Video-specific fields
      if (meta.video_type) addSidebarField(wrap, 'Video Type', meta.video_type);
      if (meta.video_duration) addSidebarField(wrap, 'Duration', meta.video_duration);
      if (meta.shoot_location) addSidebarField(wrap, 'Location', meta.shoot_location);
      if (meta.shoot_days) addSidebarField(wrap, 'Days', meta.shoot_days);
      if (meta.shoot_hours) addSidebarField(wrap, 'Hours', meta.shoot_hours);
      if (meta.photographer_included) addSidebarField(wrap, 'Photographer', 'Yes');
      if (meta.photographer_portraits) addSidebarField(wrap, 'Portraits', meta.photographer_portraits);
      if (meta.photographer_backdrop) addSidebarField(wrap, 'Backdrop', meta.photographer_backdrop);
      if (meta.photographer_groups) addSidebarField(wrap, 'Groups', meta.photographer_groups);
      if (meta.photographer_group_amount) addSidebarField(wrap, 'Group Size', meta.photographer_group_amount);
      if (meta.description && !meta.video_type) addSidebarField(wrap, 'Description', meta.description);
      nav.appendChild(wrap);

      // Show video description as its own section if present
      if (meta.description && meta.video_type) {
        addSidebarSection(nav, 'Video Brief');
        var descWrap = document.createElement('div');
        descWrap.style.cssText = 'padding:0 16px;font-size:11px;color:var(--text-primary,#1e293b);line-height:1.5;white-space:pre-wrap;';
        descWrap.textContent = meta.description;
        nav.appendChild(descWrap);
      }

      addCountriesToSidebar(nav, meta.countries);
    });

    var wrapper = document.createElement('div');
    wrapper.className = 'oa-dashboard';

    var titleRow = document.createElement('div');
    titleRow.style.cssText = 'display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;';
    var title = document.createElement('h2');
    title.className = 'cc-dashboard-title';
    title.textContent = deliverable.title || '';
    titleRow.appendChild(title);
    var addBtn = document.createElement('button');
    addBtn.className = 'cc-add-row-btn';
    addBtn.textContent = '+ Add Item';
    addBtn.addEventListener('click', function () {
      meta.items.push({ images: [], description: '' });
      renderItems();
      save();
    });
    titleRow.appendChild(addBtn);
    wrapper.appendChild(titleRow);

    // Materials recap (request-form responses + assets) — fetched async
    var a4aImgRecap = document.createElement('div');
    a4aImgRecap.className = 'cc-materials-recap';
    var a4aImgRecapLoading = document.createElement('div');
    a4aImgRecapLoading.className = 'cc-recap-loading';
    a4aImgRecapLoading.textContent = 'Loading materials...';
    a4aImgRecap.appendChild(a4aImgRecapLoading);
    wrapper.appendChild(a4aImgRecap);
    fetchRequestFormRecap(deliverable.id, a4aImgRecap);

    var itemsWrap = document.createElement('div');
    itemsWrap.className = 'a4a-items';

    function renderItems() {
      while (itemsWrap.firstChild) itemsWrap.removeChild(itemsWrap.firstChild);
      if (meta.items.length === 0) {
        var empty = document.createElement('div');
        empty.style.cssText = 'padding:20px;text-align:center;color:var(--text-muted,#94a3b8);';
        empty.textContent = 'No items yet. Click + Add Item to start.';
        itemsWrap.appendChild(empty);
        return;
      }
      meta.items.forEach(function (item, idx) {
        if (!item.images) item.images = [];
        var card = document.createElement('div');
        card.className = 'a4a-item-card';

        var delBtn = document.createElement('button');
        delBtn.className = 'cc-row-delete';
        delBtn.textContent = '\u00D7';
        delBtn.style.cssText = 'position:absolute;top:10px;right:10px;font-size:18px;';
        delBtn.addEventListener('click', function () {
          meta.items.splice(idx, 1);
          renderItems();
          save();
        });
        card.appendChild(delBtn);

        var numLbl = document.createElement('div');
        numLbl.style.cssText = 'font-size:11px;font-weight:700;text-transform:uppercase;color:var(--text-secondary,#64748b);margin-bottom:8px;';
        numLbl.textContent = 'Item ' + (idx + 1);
        card.appendChild(numLbl);

        var imgWrap = buildUploadArea(deliverable.id, item.images, save, 'Upload images');
        card.appendChild(imgWrap);

        var descLabel = document.createElement('div');
        descLabel.style.cssText = 'font-size:11px;font-weight:600;color:var(--text-secondary,#64748b);margin:10px 0 4px;';
        descLabel.textContent = 'Description';
        card.appendChild(descLabel);

        var desc = document.createElement('div');
        desc.className = 'cc-caption-editor';
        desc.contentEditable = 'true';
        desc.innerHTML = item.description || '';
        desc.setAttribute('placeholder', 'Write description...');
        desc.addEventListener('blur', function () {
          item.description = desc.innerHTML;
          save();
        });
        card.appendChild(desc);

        itemsWrap.appendChild(card);
      });
    }
    renderItems();
    wrapper.appendChild(itemsWrap);
    container.appendChild(wrapper);
  }

  // ══════ A4A RICH TEXT DASHBOARD (LinkedIn) ══════
  function openA4ARichTextDashboard(container, deliverable) {
    _ccContainer = container;
    while (container.firstChild) container.removeChild(container.firstChild);

    var meta = deliverable.metadata || {};
    if (typeof meta === 'string') try { meta = JSON.parse(meta); } catch (e) { meta = {}; }
    if (!meta.article_text) meta.article_text = '';
    if (!meta.extra_blocks) meta.extra_blocks = [];

    function save() {
      fetch(API_BASE + '/' + deliverable.id, {
        method: 'PATCH', headers: getHeaders(),
        body: JSON.stringify({ metadata: { article_text: meta.article_text, extra_blocks: meta.extra_blocks } })
      });
    }

    setupDashboardSidebar(deliverable, function (nav) {
      addSidebarSection(nav, 'Details');
      var wrap = document.createElement('div');
      wrap.style.padding = '0 16px';
      if (meta.article) addSidebarField(wrap, 'Article', 'Yes');
      if (meta.company_campaign || meta.campaign) addSidebarField(wrap, 'Campaign', 'Yes');
      if (meta.twitter_x_posts) addSidebarField(wrap, 'Posts', 'Yes');
      if (meta.amount) addSidebarField(wrap, 'Amount', meta.amount);
      if (meta.timeframe) addSidebarField(wrap, 'Timeframe', meta.timeframe);
      nav.appendChild(wrap);
      addCountriesToSidebar(nav, meta.countries);
    });

    var wrapper = document.createElement('div');
    wrapper.className = 'oa-dashboard';

    var titleRow = document.createElement('div');
    titleRow.style.cssText = 'display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;';
    var title = document.createElement('h2');
    title.className = 'cc-dashboard-title';
    title.textContent = deliverable.title || '';
    titleRow.appendChild(title);
    var addBlockBtn = document.createElement('button');
    addBlockBtn.className = 'cc-add-row-btn';
    addBlockBtn.textContent = '+ Add Block';
    addBlockBtn.addEventListener('click', function () {
      meta.extra_blocks.push({ name: 'New Block', text: '', done: false });
      renderAll();
      save();
    });
    titleRow.appendChild(addBlockBtn);
    wrapper.appendChild(titleRow);

    // Materials recap (request-form responses + assets) — fetched async
    var a4aRtRecap = document.createElement('div');
    a4aRtRecap.className = 'cc-materials-recap';
    var a4aRtRecapLoading = document.createElement('div');
    a4aRtRecapLoading.className = 'cc-recap-loading';
    a4aRtRecapLoading.textContent = 'Loading materials...';
    a4aRtRecap.appendChild(a4aRtRecapLoading);
    wrapper.appendChild(a4aRtRecap);
    fetchRequestFormRecap(deliverable.id, a4aRtRecap);

    var blocksWrap = document.createElement('div');
    wrapper.appendChild(blocksWrap);
    container.appendChild(wrapper);

    function buildRichBlock(opts) {
      var card = document.createElement('div');
      card.className = 'oa-editor-card';

      var header = document.createElement('div');
      header.style.cssText = 'display:flex;align-items:center;gap:10px;margin-bottom:10px;';

      var titleEl = document.createElement(opts.editable ? 'span' : 'h3');
      titleEl.className = opts.editable ? 'wd-step-title' : 'oa-card-title';
      titleEl.style.margin = '0';
      titleEl.style.flex = '1';
      if (opts.editable) {
        titleEl.contentEditable = 'true';
        titleEl.textContent = opts.label;
        titleEl.addEventListener('blur', function () { opts.onRename(titleEl.textContent); });
      } else {
        titleEl.textContent = opts.label;
      }
      header.appendChild(titleEl);

      if (opts.onDelete) {
        var delBtn = document.createElement('button');
        delBtn.className = 'wd-step-delete';
        delBtn.textContent = '\u00D7';
        delBtn.addEventListener('click', function () { opts.onDelete(); });
        header.appendChild(delBtn);
      }
      card.appendChild(header);
      if (opts.done) card.classList.add('wd-step-done');

      // Toolbar with insert image
      var toolbar = document.createElement('div');
      toolbar.className = 'a4a-rt-toolbar';
      var insertImgBtn = document.createElement('label');
      insertImgBtn.className = 'a4a-rt-btn';
      insertImgBtn.textContent = '+ Image';
      var fileInput = document.createElement('input');
      fileInput.type = 'file';
      fileInput.accept = 'image/*';
      fileInput.style.display = 'none';
      fileInput.addEventListener('change', function () {
        if (!fileInput.files || fileInput.files.length === 0) return;
        var fd = new FormData();
        Array.from(fileInput.files).forEach(function (f) { fd.append('images', f); });
        fetch('/api/deliverables/' + deliverable.id + '/upload-images', {
          method: 'POST',
          headers: window.getAuthHeaders ? window.getAuthHeaders() : {},
          body: fd
        }).then(function (r) { return r.json(); })
          .then(function (result) {
            if (result.urls) {
              result.urls.forEach(function (u) {
                var img = '<img src="' + u + '" style="max-width:100%;margin:8px 0;border-radius:6px;">';
                editor.focus();
                document.execCommand('insertHTML', false, img);
              });
              opts.onTextChange(editor.innerHTML);
            }
          });
        fileInput.value = '';
      });
      insertImgBtn.appendChild(fileInput);
      toolbar.appendChild(insertImgBtn);
      card.appendChild(toolbar);

      var editor = document.createElement('div');
      editor.className = 'oa-article-editor';
      editor.contentEditable = 'true';
      editor.innerHTML = opts.text || '';
      editor.setAttribute('placeholder', opts.placeholder || 'Write content here...');
      editor.addEventListener('blur', function () { opts.onTextChange(editor.innerHTML); });
      card.appendChild(editor);

      return card;
    }

    function renderAll() {
      while (blocksWrap.firstChild) blocksWrap.removeChild(blocksWrap.firstChild);

      // Main block
      blocksWrap.appendChild(buildRichBlock({
        label: 'Main Content',
        text: meta.article_text,
        done: meta.main_done,
        editable: false,
        placeholder: 'Write content here...',
        onDone: function (v) { meta.main_done = v; save(); },
        onTextChange: function (v) { meta.article_text = v; save(); }
      }));

      // Extra blocks
      meta.extra_blocks.forEach(function (xb, idx) {
        blocksWrap.appendChild(buildRichBlock({
          label: xb.name || 'New Block',
          text: xb.text,
          done: xb.done,
          editable: true,
          placeholder: 'Write content here...',
          onRename: function (v) { xb.name = v; save(); },
          onDone: function (v) { xb.done = v; save(); },
          onTextChange: function (v) { xb.text = v; save(); },
          onDelete: function () { meta.extra_blocks.splice(idx, 1); renderAll(); save(); }
        }));
      });
    }
    renderAll();
  }

  // ══════ VIDEO DASHBOARD ════════════════════════════════
  function openVideoDashboard(container, deliverable) {
    _ccContainer = container;
    while (container.firstChild) container.removeChild(container.firstChild);

    var meta = deliverable.metadata || {};
    if (typeof meta === 'string') try { meta = JSON.parse(meta); } catch (e) { meta = {}; }
    if (!meta.stages) {
      meta.stages = [
        { name: 'Pre-Production / Brief', description: '', files: [], done: false },
        { name: 'Storyboard', description: '', files: [], done: false },
        { name: 'Raw Footage', description: '', files: [], done: false },
        { name: 'First Edit', description: '', files: [], done: false },
        { name: 'Review & Changes', description: '', files: [], done: false },
        { name: 'Final Delivery', description: '', files: [], done: false }
      ];
    }

    function save() {
      fetch(API_BASE + '/' + deliverable.id, {
        method: 'PATCH', headers: getHeaders(),
        body: JSON.stringify({ metadata: { stages: meta.stages } })
      });
    }

    // Sidebar — full video info
    setupDashboardSidebar(deliverable, function (nav) {
      addSidebarSection(nav, 'Video Details');
      var wrap = document.createElement('div');
      wrap.style.padding = '0 16px';
      if (meta.video_type) addSidebarField(wrap, 'Type', meta.video_type);
      if (meta.video_type_other) addSidebarField(wrap, 'Other', meta.video_type_other);
      if (meta.video_duration) addSidebarField(wrap, 'Duration', meta.video_duration);
      if (meta.video_index) addSidebarField(wrap, 'Video #', meta.video_index);
      nav.appendChild(wrap);

      addSidebarSection(nav, 'Shoot Details');
      var shootWrap = document.createElement('div');
      shootWrap.style.padding = '0 16px';
      if (meta.shoot_location) addSidebarField(shootWrap, 'Location', meta.shoot_location);
      if (meta.shoot_days) addSidebarField(shootWrap, 'Days', meta.shoot_days);
      if (meta.shoot_hours) addSidebarField(shootWrap, 'Hours', meta.shoot_hours);
      nav.appendChild(shootWrap);

      if (meta.photographer_included || meta.photographer_info) {
        addSidebarSection(nav, 'Photographer');
        var pWrap = document.createElement('div');
        pWrap.style.padding = '0 16px';
        if (meta.photographer_portraits) addSidebarField(pWrap, 'Portraits', meta.photographer_portraits);
        if (meta.photographer_backdrop) addSidebarField(pWrap, 'Backdrop', meta.photographer_backdrop);
        if (meta.photographer_groups) addSidebarField(pWrap, 'Groups', meta.photographer_groups);
        if (meta.photographer_group_amount) addSidebarField(pWrap, 'Group Size', meta.photographer_group_amount);
        if (meta.photographer_days) addSidebarField(pWrap, 'Days', meta.photographer_days);
        if (meta.photographer_hours) addSidebarField(pWrap, 'Hours', meta.photographer_hours);
        if (meta.photographer_flashes) addSidebarField(pWrap, 'Flashes', 'Yes');
        nav.appendChild(pWrap);
      }

      if (meta.description) {
        addSidebarSection(nav, 'Brief');
        var descWrap = document.createElement('div');
        descWrap.style.cssText = 'padding:0 16px 8px;font-size:11px;color:var(--text-primary,#1e293b);line-height:1.5;white-space:pre-wrap;';
        descWrap.textContent = meta.description;
        nav.appendChild(descWrap);
      }
    });

    // Main content — stages
    var wrapper = document.createElement('div');
    wrapper.className = 'wd-dashboard';

    var titleRow = document.createElement('div');
    titleRow.style.cssText = 'display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;';
    var title = document.createElement('h2');
    title.className = 'cc-dashboard-title';
    title.textContent = deliverable.title || 'Video';
    titleRow.appendChild(title);
    wrapper.appendChild(titleRow);

    // Materials recap
    var recap = document.createElement('div');
    recap.className = 'cc-materials-recap';
    var recapLoading = document.createElement('div');
    recapLoading.className = 'cc-recap-loading';
    recapLoading.textContent = 'Loading materials...';
    recap.appendChild(recapLoading);
    wrapper.appendChild(recap);
    fetchRequestFormRecap(deliverable.id, recap);

    var stagesWrap = document.createElement('div');
    stagesWrap.className = 'wd-steps';
    wrapper.appendChild(stagesWrap);
    container.appendChild(wrapper);

    function renderStages() {
      while (stagesWrap.firstChild) stagesWrap.removeChild(stagesWrap.firstChild);
      meta.stages.forEach(function (stage, idx) {
        if (!stage.files) stage.files = [];
        var stepEl = document.createElement('div');
        stepEl.className = 'wd-step';

        var header = document.createElement('div');
        header.className = 'wd-step-header';

        var num = document.createElement('span');
        num.className = 'wd-step-num';
        num.textContent = idx + 1;
        header.appendChild(num);

        var titleEl = document.createElement('span');
        titleEl.className = 'wd-step-title';
        titleEl.textContent = stage.name;
        header.appendChild(titleEl);

        stepEl.appendChild(header);

        var descEditor = document.createElement('div');
        descEditor.className = 'cc-caption-editor';
        descEditor.contentEditable = 'true';
        descEditor.innerHTML = stage.description || '';
        descEditor.setAttribute('placeholder', 'Add notes for ' + stage.name + '...');
        descEditor.addEventListener('blur', function () {
          stage.description = descEditor.innerHTML;
          save();
        });
        stepEl.appendChild(descEditor);

        stepEl.appendChild(buildUploadArea(deliverable.id, stage.files, save, 'Upload ' + stage.name + ' files'));
        stagesWrap.appendChild(stepEl);
      });
    }
    renderStages();
  }

})();
