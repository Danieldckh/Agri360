(function () {
  'use strict';

  var API_BASE = '/api/deliverables';
  var ICON_ADVANCE = 'M12 4l-1.41 1.41L16.17 11H4v2h12.17l-5.58 5.59L12 20l8-8z';

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
    return 'proagri-sheet-status-' + (status || 'pending').toLowerCase();
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

  // Fetch all deliverables across all departments
  function fetchAllDeliverables() {
    var depts = ['admin', 'production', 'design', 'editorial', 'video', 'agri4all', 'social-media'];
    return Promise.all(depts.map(function (slug) {
      return fetch(API_BASE + '/by-department/' + slug, { headers: getHeaders() })
        .then(function (res) { return res.ok ? res.json() : []; })
        .catch(function () { return []; });
    })).then(function (results) {
      var all = [];
      results.forEach(function (arr) { all = all.concat(arr); });
      // Deduplicate by id
      var seen = {};
      return all.filter(function (d) {
        if (seen[d.id]) return false;
        seen[d.id] = true;
        return true;
      });
    });
  }

  function renderAdminActionBoard(container) {
    while (container.firstChild) container.removeChild(container.firstChild);
    container.style.display = 'flex';
    container.style.alignItems = 'stretch';
    container.style.justifyContent = '';
    container.style.flexDirection = '';
    container.style.height = '';
    container.style.gap = '';
    container.style.padding = '';

    var layout = document.createElement('div');
    layout.className = 'dept-dashboard-layout';

    // ──── Main: Action Board ────
    var mainCol = document.createElement('div');
    mainCol.className = 'dept-dashboard-main';

    var mainCard = document.createElement('div');
    mainCard.className = 'dept-sheet-card';

    var mainHeader = document.createElement('div');
    mainHeader.className = 'dept-sheet-header';

    var mainTitleWrap = document.createElement('div');
    mainTitleWrap.className = 'dept-sheet-title-wrap';
    var mainH = document.createElement('h3');
    mainH.className = 'dept-sheet-title';
    mainH.textContent = 'Action Board';
    mainTitleWrap.appendChild(mainH);
    var mainCount = document.createElement('span');
    mainCount.className = 'dept-sheet-count';
    mainCount.textContent = '0';
    mainTitleWrap.appendChild(mainCount);
    mainHeader.appendChild(mainTitleWrap);

    var mainSearch = document.createElement('input');
    mainSearch.type = 'text';
    mainSearch.className = 'dept-sheet-search';
    mainSearch.placeholder = 'Search deliverables...';
    mainHeader.appendChild(mainSearch);
    mainCard.appendChild(mainHeader);

    var mainSheet = document.createElement('div');
    mainSheet.className = 'dept-sheet-container';
    mainSheet.style.overflow = 'auto';
    mainSheet.style.flex = '1';
    mainCard.appendChild(mainSheet);
    mainCol.appendChild(mainCard);
    layout.appendChild(mainCol);

    // ──── Side: Materials Requested ────
    var sideCol = document.createElement('div');
    sideCol.className = 'dept-dashboard-side';

    var sideCard = document.createElement('div');
    sideCard.className = 'dept-sheet-card dept-sheet-card-compact';

    var sideHeader = document.createElement('div');
    sideHeader.className = 'dept-sheet-header';
    var sideTitleWrap = document.createElement('div');
    sideTitleWrap.className = 'dept-sheet-title-wrap';
    var sideH = document.createElement('h3');
    sideH.className = 'dept-sheet-title';
    sideH.textContent = 'Materials Requested';
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
    sideCol.appendChild(sideCard);
    layout.appendChild(sideCol);

    container.appendChild(layout);

    var allData = [];

    mainSearch.addEventListener('input', function () {
      renderMainTable(allData, mainSearch.value.toLowerCase());
    });

    function refreshAll() {
      fetchAllDeliverables().then(function (deliverables) {
        allData = deliverables;
        mainCount.textContent = deliverables.length;
        renderMainTable(groupByClient(deliverables), mainSearch.value.toLowerCase());
        renderMaterialsSide(deliverables);
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

    // ──── Main table (grouped by client, like production) ────
    function renderMainTable(groups, filterTerm) {
      // If groups is raw array (from search re-render), re-group
      if (groups.length > 0 && groups[0] && groups[0].id !== undefined) {
        groups = groupByClient(groups);
      }
      while (mainSheet.firstChild) mainSheet.removeChild(mainSheet.firstChild);

      if (groups.length === 0) {
        var empty = document.createElement('div');
        empty.style.padding = '40px';
        empty.style.textAlign = 'center';
        empty.style.color = 'var(--text-muted, #999)';
        empty.textContent = 'No deliverables found';
        mainSheet.appendChild(empty);
        return;
      }

      var table = document.createElement('table');
      table.className = 'production-sheet-table';

      var thead = document.createElement('thead');
      var headerRow = document.createElement('tr');
      ['Title', 'Type', 'Department', 'Status', 'Assigned To', 'Due Date'].forEach(function (col) {
        var th = document.createElement('th');
        th.textContent = col;
        headerRow.appendChild(th);
      });
      thead.appendChild(headerRow);
      table.appendChild(thead);

      var tbody = document.createElement('tbody');
      var visibleCount = 0;

      groups.forEach(function (group) {
        var items = group.items;
        if (filterTerm) {
          items = items.filter(function (item) {
            return (item.title && item.title.toLowerCase().indexOf(filterTerm) !== -1) ||
              (item.type && item.type.toLowerCase().indexOf(filterTerm) !== -1) ||
              (item.departmentName && item.departmentName.toLowerCase().indexOf(filterTerm) !== -1) ||
              (group.clientName.toLowerCase().indexOf(filterTerm) !== -1);
          });
        }
        if (items.length === 0) return;
        visibleCount += items.length;

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

          var tdDept = document.createElement('td');
          var deptBadge = document.createElement('span');
          deptBadge.className = 'production-type-badge';
          deptBadge.textContent = item.departmentName || '—';
          tdDept.appendChild(deptBadge);
          row.appendChild(tdDept);

          var tdStatus = document.createElement('td');
          var statusBadge = document.createElement('span');
          statusBadge.className = 'proagri-sheet-status ' + statusClass(item.status);
          statusBadge.textContent = formatStatus(item.status);
          tdStatus.appendChild(statusBadge);
          row.appendChild(tdStatus);

          var tdAssigned = document.createElement('td');
          var assignedId = item.assignedAdmin || item.assignedTo;
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
              tdAssigned.textContent = '—';
            }
          } else {
            tdAssigned.textContent = '—';
          }
          row.appendChild(tdAssigned);

          var tdDue = document.createElement('td');
          tdDue.textContent = formatDate(item.dueDate);
          row.appendChild(tdDue);

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
      mainSheet.appendChild(table);
      mainCount.textContent = visibleCount;
    }

    // ──── Side panel: Materials Requested with advance arrows ────
    function renderMaterialsSide(allDeliverables) {
      while (sideSheet.firstChild) sideSheet.removeChild(sideSheet.firstChild);

      var materialsItems = allDeliverables.filter(function (d) {
        return d.status === 'request_client_materials' || d.status === 'materials_requested';
      });

      sideCount.textContent = materialsItems.length;

      if (materialsItems.length === 0) {
        var empty = document.createElement('div');
        empty.style.padding = '24px';
        empty.style.textAlign = 'center';
        empty.style.color = 'var(--text-muted, #999)';
        empty.style.fontSize = '12px';
        empty.textContent = 'No pending material requests';
        sideSheet.appendChild(empty);
        return;
      }

      var table = document.createElement('table');
      table.className = 'production-sheet-table';

      var thead = document.createElement('thead');
      var headerRow = document.createElement('tr');
      ['Title', 'Client', ''].forEach(function (col) {
        var th = document.createElement('th');
        th.textContent = col;
        if (col === '') th.style.width = '40px';
        headerRow.appendChild(th);
      });
      thead.appendChild(headerRow);
      table.appendChild(thead);

      var tbody = document.createElement('tbody');

      materialsItems.forEach(function (item) {
        var row = document.createElement('tr');
        row.className = 'production-child-row';

        var tdTitle = document.createElement('td');
        tdTitle.textContent = item.title || '—';
        tdTitle.style.fontSize = '12px';
        row.appendChild(tdTitle);

        var tdClient = document.createElement('td');
        tdClient.textContent = item.clientName || '—';
        tdClient.style.fontSize = '12px';
        tdClient.style.color = 'var(--text-muted, #999)';
        row.appendChild(tdClient);

        var tdAction = document.createElement('td');
        var btn = document.createElement('button');
        btn.className = 'proagri-sheet-row-action-btn action-advance';
        btn.title = 'Mark as Materials Received';
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
      sideSheet.appendChild(table);
    }

    // Pre-fetch employees then load data
    if (window._fetchEmployees) {
      window._fetchEmployees().then(refreshAll);
    } else {
      refreshAll();
    }
  }

  window.renderAdminActionBoard = renderAdminActionBoard;
})();
