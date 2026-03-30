(function () {
  'use strict';

  var API_BASE = '/api/deliverables';

  // SVG icons
  var ICON_ADVANCE = 'M12 4l-1.41 1.41L16.17 11H4v2h12.17l-5.58 5.59L12 20l8-8z';

  // Website design workflow: next status for production-visible statuses
  var WEB_DESIGN_NEXT = {
    'request_client_materials': { next: 'sitemap', tooltip: 'Advance to Sitemap (Design)' },
    'ready_for_approval': { next: 'sent_for_approval', tooltip: 'Send for client approval' },
    'sent_for_approval': null, // split: approve or design changes — handled elsewhere
    'development': { next: 'site_developed', tooltip: 'Mark as developed' },
    'site_developed': { next: 'hosting_seo', tooltip: 'Move to Hosting & SEO' },
    'hosting_seo': { next: 'complete', tooltip: 'Mark as complete' },
    'complete': null
  };

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
    var s = (status || 'pending').toLowerCase();
    if (s === 'completed' || s === 'done' || s === 'complete') return 'status-completed';
    if (s === 'in_progress' || s === 'active' || s === 'development' || s === 'site_developed' || s === 'hosting_seo') return 'status-in-progress';
    return 'status-pending';
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

    function advanceWebDesign(itemId, nextStatus) {
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
          tdAssigned.textContent = item.assignedTo || '—';
          row.appendChild(tdAssigned);

          var tdDue = document.createElement('td');
          tdDue.textContent = formatDate(item.dueDate);
          row.appendChild(tdDue);

          // Action column
          var tdAction = document.createElement('td');
          if (item.type === 'website-design') {
            var wf = WEB_DESIGN_NEXT[item.status];
            if (wf) {
              var btn = document.createElement('button');
              btn.className = 'proagri-sheet-row-action-btn action-advance';
              btn.title = wf.tooltip;
              btn.appendChild(makeSvgIcon(ICON_ADVANCE));
              btn.style.opacity = '1';
              btn.addEventListener('click', (function (id, next) {
                return function (e) {
                  e.stopPropagation();
                  advanceWebDesign(id, next);
                };
              })(item.id, wf.next));
              tdAction.appendChild(btn);
            }
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

  window.renderProductionTab = renderProductionTab;
})();
