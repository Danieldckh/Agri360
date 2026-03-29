(function () {
  'use strict';

  var API_BASE = '/api/deliverables';

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
    if (s === 'completed' || s === 'done') return 'status-completed';
    if (s === 'in_progress' || s === 'active') return 'status-in-progress';
    return 'status-pending';
  }

  // Group deliverables array by clientName
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

  function renderProductionTab(container) {
    while (container.firstChild) container.removeChild(container.firstChild);
    container.style.display = '';
    container.style.alignItems = '';
    container.style.justifyContent = '';
    container.style.flexDirection = '';
    container.style.height = '';
    container.style.gap = '';
    container.style.padding = '';

    var wrapper = document.createElement('div');
    wrapper.className = 'production-wrapper';

    var header = document.createElement('div');
    header.className = 'production-header';

    var title = document.createElement('h2');
    title.className = 'production-title';
    title.textContent = 'Client Communications';

    var countBadge = document.createElement('span');
    countBadge.className = 'dept-sheet-count';
    countBadge.textContent = '0';

    header.appendChild(title);
    header.appendChild(countBadge);
    wrapper.appendChild(header);

    var clientList = document.createElement('div');
    clientList.className = 'production-client-list';
    wrapper.appendChild(clientList);

    container.appendChild(wrapper);

    function refreshAll() {
      fetch(API_BASE + '/by-department/production', { headers: getHeaders() })
        .then(function (res) {
          if (!res.ok) throw new Error('Failed to fetch');
          return res.json();
        })
        .then(function (deliverables) {
          var groups = groupByClient(deliverables);
          countBadge.textContent = groups.length + (groups.length === 1 ? ' client' : ' clients');
          renderGroups(groups);
        })
        .catch(function (err) {
          console.error('Production fetch error:', err);
        });
    }

    function renderGroups(groups) {
      while (clientList.firstChild) clientList.removeChild(clientList.firstChild);

      if (groups.length === 0) {
        var empty = document.createElement('div');
        empty.className = 'production-empty';
        empty.textContent = 'No deliverables to display';
        clientList.appendChild(empty);
        return;
      }

      groups.forEach(function (group) {
        var section = document.createElement('div');
        section.className = 'production-client-section';

        // Client header (collapsible)
        var clientHeader = document.createElement('div');
        clientHeader.className = 'production-client-header';

        var clientName = document.createElement('span');
        clientName.className = 'production-client-name';
        clientName.textContent = group.clientName;

        var itemCount = document.createElement('span');
        itemCount.className = 'dept-sheet-count';
        itemCount.textContent = group.items.length;

        var chevron = document.createElement('span');
        chevron.className = 'production-chevron';
        chevron.textContent = '\u25BC';

        clientHeader.appendChild(clientName);
        clientHeader.appendChild(itemCount);
        clientHeader.appendChild(chevron);

        var content = document.createElement('div');
        content.className = 'production-client-content';

        clientHeader.addEventListener('click', function () {
          var isOpen = content.style.display !== 'none';
          content.style.display = isOpen ? 'none' : '';
          chevron.textContent = isOpen ? '\u25B6' : '\u25BC';
          section.classList.toggle('collapsed', isOpen);
        });

        // Table
        var table = document.createElement('table');
        table.className = 'production-table';

        var thead = document.createElement('thead');
        var headerRow = document.createElement('tr');
        ['Title', 'Type', 'Status', 'Assigned To', 'Due Date'].forEach(function (col) {
          var th = document.createElement('th');
          th.textContent = col;
          headerRow.appendChild(th);
        });
        thead.appendChild(headerRow);
        table.appendChild(thead);

        var tbody = document.createElement('tbody');
        group.items.forEach(function (item) {
          var row = document.createElement('tr');

          var tdTitle = document.createElement('td');
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

          tbody.appendChild(row);
        });
        table.appendChild(tbody);

        content.appendChild(table);
        section.appendChild(clientHeader);
        section.appendChild(content);
        clientList.appendChild(section);
      });
    }

    refreshAll();
  }

  window.renderProductionTab = renderProductionTab;
})();
