(function () {
  'use strict';

  var API_BASE = '/api/deliverables';

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

  function formatStatus(status) {
    if (!status) return 'Pending';
    return status.replace(/_/g, ' ').replace(/\b\w/g, function (c) { return c.toUpperCase(); });
  }

  function formatDate(dateStr) {
    if (!dateStr) return '—';
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

  function renderProductionTab(container) {
    while (container.firstChild) container.removeChild(container.firstChild);
    container.style.display = 'flex';
    container.style.alignItems = 'stretch';
    container.style.justifyContent = '';
    container.style.flexDirection = '';
    container.style.height = '';
    container.style.gap = '';
    container.style.padding = '';

    var card = document.createElement('div');
    card.className = 'dept-sheet-card';
    card.style.width = '100%';

    var header = document.createElement('div');
    header.className = 'dept-sheet-header';

    var titleWrap = document.createElement('div');
    titleWrap.className = 'dept-sheet-title-wrap';

    var h = document.createElement('h3');
    h.className = 'dept-sheet-title';
    h.textContent = 'Client Communications';
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

    var sheetContainer = document.createElement('div');
    sheetContainer.className = 'dept-sheet-container';
    sheetContainer.style.overflow = 'auto';
    sheetContainer.style.flex = '1';
    card.appendChild(sheetContainer);

    container.appendChild(card);

    var allGroups = [];

    searchInput.addEventListener('input', function () {
      renderTable(allGroups, searchInput.value.toLowerCase());
    });

    function refreshAll() {
      fetch(API_BASE + '/by-department/production', { headers: getHeaders() })
        .then(function (res) {
          if (!res.ok) throw new Error('Failed to fetch');
          return res.json();
        })
        .then(function (deliverables) {
          allGroups = groupByClient(deliverables);
          countBadge.textContent = deliverables.length;
          renderTable(allGroups, searchInput.value.toLowerCase());
        })
        .catch(function (err) {
          console.error('Production fetch error:', err);
        });
    }

    function advanceStatus(itemId, nextStatus) {
      fetch(API_BASE + '/' + itemId, {
        method: 'PATCH',
        headers: getHeaders(),
        body: JSON.stringify({ status: nextStatus })
      }).then(function (res) {
        if (res.ok) refreshAll();
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
      ['Title', 'Type', 'Status', 'Assigned To', 'Due Date', ''].forEach(function (col) {
        var th = document.createElement('th');
        th.textContent = col;
        if (col === '') th.style.width = '40px';
        headerRow.appendChild(th);
      });
      thead.appendChild(headerRow);
      table.appendChild(thead);

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

        // Client parent row
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

        // Child rows
        var childRows = [];
        items.forEach(function (item) {
          var row = document.createElement('tr');
          row.className = 'production-child-row';

          var tdTitle = document.createElement('td');
          tdTitle.className = 'production-indented';
          tdTitle.textContent = item.title || '—';
          row.appendChild(tdTitle);

          var tdType = document.createElement('td');
          var typeBadge = document.createElement('span');
          typeBadge.className = 'production-type-badge';
          typeBadge.textContent = item.type || '—';
          tdType.appendChild(typeBadge);
          row.appendChild(tdType);

          var tdStatus = document.createElement('td');
          var statusBadge = document.createElement('span');
          statusBadge.className = 'proagri-sheet-status ' + statusClass(item.status);
          statusBadge.textContent = formatStatus(item.status);
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
            tdAssigned.textContent = '—';
          }
          row.appendChild(tdAssigned);

          var tdDue = document.createElement('td');
          tdDue.textContent = formatDate(item.dueDate);
          row.appendChild(tdDue);

          // Action column — unified workflow chain per type
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

    refreshAll();
  }

  // ── Follow Ups Tab (2-sheet layout) ────────────────────────────
  function renderFollowUpsTab(container) {
    while (container.firstChild) container.removeChild(container.firstChild);
    container.style.display = '';
    container.style.alignItems = '';
    container.style.justifyContent = '';
    container.style.flexDirection = '';
    container.style.height = '';
    container.style.gap = '';
    container.style.padding = '';

    var layout = document.createElement('div');
    layout.className = 'dept-dashboard-layout';
    container.appendChild(layout);

    // ── LEFT: Materials Requested (main sheet) ──
    var mainCol = document.createElement('div');
    mainCol.className = 'dept-dashboard-main';
    layout.appendChild(mainCol);

    var mainCard = document.createElement('div');
    mainCard.className = 'dept-sheet-card';
    mainCol.appendChild(mainCard);

    var mainHeader = document.createElement('div');
    mainHeader.className = 'dept-sheet-header';

    var mainTitleWrap = document.createElement('div');
    mainTitleWrap.className = 'dept-sheet-title-wrap';

    var mainH = document.createElement('h3');
    mainH.className = 'dept-sheet-title';
    mainH.textContent = 'Materials Requested';
    mainTitleWrap.appendChild(mainH);

    var mainCount = document.createElement('span');
    mainCount.className = 'dept-sheet-count';
    mainCount.textContent = '0';
    mainTitleWrap.appendChild(mainCount);

    mainHeader.appendChild(mainTitleWrap);

    var mainSearch = document.createElement('input');
    mainSearch.type = 'text';
    mainSearch.className = 'dept-sheet-search';
    mainSearch.placeholder = 'Search...';
    mainHeader.appendChild(mainSearch);

    mainCard.appendChild(mainHeader);

    var mainSheet = document.createElement('div');
    mainSheet.className = 'dept-sheet-container';
    mainSheet.style.overflow = 'auto';
    mainSheet.style.flex = '1';
    mainCard.appendChild(mainSheet);

    // ── RIGHT: Follow Ups (side sheet) ──
    var sideCol = document.createElement('div');
    sideCol.className = 'dept-dashboard-side';
    layout.appendChild(sideCol);

    var sideCard = document.createElement('div');
    sideCard.className = 'dept-sheet-card dept-sheet-card-compact';
    sideCol.appendChild(sideCard);

    var sideHeader = document.createElement('div');
    sideHeader.className = 'dept-sheet-header';

    var sideTitleWrap = document.createElement('div');
    sideTitleWrap.className = 'dept-sheet-title-wrap';

    var sideH = document.createElement('h3');
    sideH.className = 'dept-sheet-title';
    sideH.textContent = 'Follow Ups';
    sideTitleWrap.appendChild(sideH);

    var sideCount = document.createElement('span');
    sideCount.className = 'dept-sheet-count';
    sideCount.textContent = '0';
    sideTitleWrap.appendChild(sideCount);

    sideHeader.appendChild(sideTitleWrap);
    sideCard.appendChild(sideHeader);

    var sideSheet = document.createElement('div');
    sideSheet.className = 'dept-sheet-container';
    sideSheet.style.overflow = 'auto';
    sideSheet.style.flex = '1';
    sideCard.appendChild(sideSheet);

    // ── Data ──
    var allItems = [];

    mainSearch.addEventListener('input', function () {
      renderMainTable(allItems, mainSearch.value.toLowerCase());
    });

    function hoursWithoutContact(item) {
      if (!item.updatedAt) return 0;
      var diff = Date.now() - new Date(item.updatedAt).getTime();
      return Math.max(0, Math.floor(diff / (1000 * 60 * 60)));
    }

    function refreshData() {
      fetch(API_BASE + '/by-department/production', { headers: getHeaders() })
        .then(function (res) {
          if (!res.ok) throw new Error('Failed to fetch');
          return res.json();
        })
        .then(function (deliverables) {
          allItems = deliverables.filter(function (d) {
            return d.type === 'website-design' && d.status === 'materials_requested';
          });
          mainCount.textContent = allItems.length;
          sideCount.textContent = allItems.length;
          renderMainTable(allItems, mainSearch.value.toLowerCase());
          renderSideTable(allItems);
        })
        .catch(function (err) {
          console.error('Follow Ups fetch error:', err);
        });
    }

    function advanceStatus(itemId, nextStatus) {
      fetch(API_BASE + '/' + itemId, {
        method: 'PATCH',
        headers: getHeaders(),
        body: JSON.stringify({ status: nextStatus })
      }).then(function (res) {
        if (res.ok) refreshData();
      });
    }

    function incrementFollowUp(itemId, currentCount) {
      fetch(API_BASE + '/' + itemId, {
        method: 'PATCH',
        headers: getHeaders(),
        body: JSON.stringify({ followUpCount: currentCount + 1 })
      }).then(function (res) {
        if (res.ok) refreshData();
      });
    }

    // ── Main table: Materials Requested ──
    function renderMainTable(items, filterTerm) {
      while (mainSheet.firstChild) mainSheet.removeChild(mainSheet.firstChild);

      var filtered = items;
      if (filterTerm) {
        filtered = items.filter(function (item) {
          return (item.clientName && item.clientName.toLowerCase().indexOf(filterTerm) !== -1) ||
            (item.title && item.title.toLowerCase().indexOf(filterTerm) !== -1);
        });
      }

      if (filtered.length === 0) {
        var empty = document.createElement('div');
        empty.style.padding = '40px';
        empty.style.textAlign = 'center';
        empty.style.color = 'var(--text-muted, #999)';
        empty.textContent = 'No materials requested';
        mainSheet.appendChild(empty);
        return;
      }

      var table = document.createElement('table');
      table.className = 'production-sheet-table';

      var thead = document.createElement('thead');
      var headerRow = document.createElement('tr');
      ['Client', 'Title', 'Status', 'Hours Without Contact', 'Follow Up Count', ''].forEach(function (col) {
        var th = document.createElement('th');
        th.textContent = col;
        if (col === '') th.style.width = '40px';
        headerRow.appendChild(th);
      });
      thead.appendChild(headerRow);
      table.appendChild(thead);

      var tbody = document.createElement('tbody');
      filtered.forEach(function (item) {
        var row = document.createElement('tr');
        row.className = 'production-child-row';

        var tdClient = document.createElement('td');
        tdClient.style.fontWeight = '600';
        tdClient.textContent = item.clientName || '—';
        row.appendChild(tdClient);

        var tdTitle = document.createElement('td');
        tdTitle.textContent = item.title || '—';
        row.appendChild(tdTitle);

        var tdStatus = document.createElement('td');
        var statusBadge = document.createElement('span');
        statusBadge.className = 'proagri-sheet-status ' + statusClass(item.status);
        statusBadge.textContent = formatStatus(item.status);
        tdStatus.appendChild(statusBadge);
        row.appendChild(tdStatus);

        var tdHours = document.createElement('td');
        var hours = hoursWithoutContact(item);
        tdHours.textContent = hours + 'h';
        if (hours >= 48) tdHours.style.color = 'var(--color-error, #e53935)';
        else if (hours >= 24) tdHours.style.color = 'var(--color-warning, #f59e0b)';
        row.appendChild(tdHours);

        var tdFollowUp = document.createElement('td');
        var count = item.followUpCount || 0;
        var countBadge = document.createElement('span');
        countBadge.className = 'dept-sheet-count';
        countBadge.textContent = count;
        countBadge.style.cursor = 'pointer';
        countBadge.title = 'Click to increment follow up count';
        countBadge.addEventListener('click', (function (id, c) {
          return function (e) {
            e.stopPropagation();
            incrementFollowUp(id, c);
          };
        })(item.id, count));
        tdFollowUp.appendChild(countBadge);
        row.appendChild(tdFollowUp);

        var tdAction = document.createElement('td');
        var btn = document.createElement('button');
        btn.className = 'proagri-sheet-row-action-btn action-advance';
        btn.title = 'Advance to Materials Received';
        btn.appendChild(makeSvgIcon(ICON_ADVANCE));
        btn.style.opacity = '1';
        btn.addEventListener('click', (function (id) {
          return function (e) {
            e.stopPropagation();
            advanceStatus(id, 'materials_received');
          };
        })(item.id));
        tdAction.appendChild(btn);
        row.appendChild(tdAction);

        tbody.appendChild(row);
      });
      table.appendChild(tbody);
      mainSheet.appendChild(table);
    }

    // ── Side table: Follow Ups summary ──
    function renderSideTable(items) {
      while (sideSheet.firstChild) sideSheet.removeChild(sideSheet.firstChild);

      if (items.length === 0) {
        var empty = document.createElement('div');
        empty.style.padding = '20px';
        empty.style.textAlign = 'center';
        empty.style.color = 'var(--text-muted, #999)';
        empty.textContent = 'No follow ups';
        sideSheet.appendChild(empty);
        return;
      }

      var table = document.createElement('table');
      table.className = 'production-sheet-table';

      var thead = document.createElement('thead');
      var headerRow = document.createElement('tr');
      ['Client', 'Hours', 'Follow Ups'].forEach(function (col) {
        var th = document.createElement('th');
        th.textContent = col;
        headerRow.appendChild(th);
      });
      thead.appendChild(headerRow);
      table.appendChild(thead);

      var tbody = document.createElement('tbody');
      // Sort by hours descending (most urgent first)
      var sorted = items.slice().sort(function (a, b) {
        return hoursWithoutContact(b) - hoursWithoutContact(a);
      });

      sorted.forEach(function (item) {
        var row = document.createElement('tr');
        row.className = 'production-child-row';

        var tdClient = document.createElement('td');
        tdClient.style.fontWeight = '600';
        tdClient.style.fontSize = '12px';
        tdClient.textContent = item.clientName || '—';
        row.appendChild(tdClient);

        var tdHours = document.createElement('td');
        var hours = hoursWithoutContact(item);
        tdHours.textContent = hours + 'h';
        tdHours.style.fontSize = '12px';
        if (hours >= 48) tdHours.style.color = 'var(--color-error, #e53935)';
        else if (hours >= 24) tdHours.style.color = 'var(--color-warning, #f59e0b)';
        row.appendChild(tdHours);

        var tdCount = document.createElement('td');
        tdCount.style.fontSize = '12px';
        var sideCountBadge = document.createElement('span');
        sideCountBadge.className = 'dept-sheet-count';
        sideCountBadge.textContent = item.followUpCount || 0;
        tdCount.appendChild(sideCountBadge);
        row.appendChild(tdCount);

        tbody.appendChild(row);
      });
      table.appendChild(tbody);
      sideSheet.appendChild(table);
    }

    refreshData();
  }

  window.renderProductionTab = renderProductionTab;
  window.renderFollowUpsTab = renderFollowUpsTab;
})();
