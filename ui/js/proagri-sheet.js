/**
 * ProAgri Sheet Component
 *
 * Usage:
 *   window.renderSheet(container, {
 *     columns: [
 *       { key: 'name', label: 'Client', sortable: true, isName: true },
 *       { key: 'status', label: 'Status', sortable: true, type: 'status' },
 *       { key: 'due_date', label: 'Due Date', sortable: true, type: 'date' },
 *     ],
 *     data: arrayOfObjects,
 *     radialActions: [ { id: 'x', label: 'X', action: fn, highlight: bool } ],
 *   });
 */
(function() {
  'use strict';

  var STATUS_ORDER = {
    'pending': 0,
    'in_progress': 1,
    'in progress': 1,
    'completed': 2,
    'done': 2,
    'overdue': 3
  };

  function renderSheet(container, config) {
    var columns = config.columns || [];
    var data = config.data || null; // null = loading, [] = empty
    var radialActions = config.radialActions || [];

    // Clear container
    while (container.firstChild) {
      container.removeChild(container.firstChild);
    }

    var sheetWrap = document.createElement('div');
    sheetWrap.className = 'proagri-sheet-wrap';

    // Loading state
    if (data === null) {
      var loadingEl = document.createElement('div');
      loadingEl.className = 'proagri-sheet-loading';
      loadingEl.textContent = 'Loading';
      sheetWrap.appendChild(loadingEl);
      container.appendChild(sheetWrap);
      return { update: function(newData) { renderSheet(container, Object.assign({}, config, { data: newData })); } };
    }

    // Empty state
    if (data.length === 0) {
      var emptyEl = document.createElement('div');
      emptyEl.className = 'proagri-sheet-empty';
      emptyEl.textContent = 'No items to display';
      sheetWrap.appendChild(emptyEl);
      container.appendChild(sheetWrap);
      return { update: function(newData) { renderSheet(container, Object.assign({}, config, { data: newData })); } };
    }

    // Sort state
    var sortKey = config._sortKey || null;
    var sortDir = config._sortDir || 'asc';

    // Sort data
    var sortedData = data.slice();
    if (sortKey) {
      var sortCol = columns.find(function(c) { return c.key === sortKey; });
      sortedData.sort(function(a, b) {
        var va = a[sortKey];
        var vb = b[sortKey];

        if (sortCol && sortCol.type === 'date') {
          va = va ? new Date(va).getTime() : 0;
          vb = vb ? new Date(vb).getTime() : 0;
        } else if (sortCol && sortCol.type === 'status') {
          va = STATUS_ORDER[(va || '').toLowerCase().replace(/\s+/g, '_')] || 99;
          vb = STATUS_ORDER[(vb || '').toLowerCase().replace(/\s+/g, '_')] || 99;
        } else {
          va = (va || '').toString().toLowerCase();
          vb = (vb || '').toString().toLowerCase();
        }

        if (va < vb) return sortDir === 'asc' ? -1 : 1;
        if (va > vb) return sortDir === 'asc' ? 1 : -1;
        return 0;
      });
    }

    // Header row
    var headerRow = document.createElement('div');
    headerRow.className = 'proagri-sheet-header';

    columns.forEach(function(col) {
      var th = document.createElement('div');
      th.className = 'proagri-sheet-header-cell' + (col.sortable ? ' sortable' : '');
      th.textContent = col.label;

      if (col.sortable) {
        var sortIcon = document.createElement('span');
        sortIcon.className = 'proagri-sheet-sort-icon' + (sortKey === col.key ? ' sort-active' : '');
        sortIcon.textContent = sortKey === col.key ? (sortDir === 'asc' ? '\u25B2' : '\u25BC') : '\u25B2';
        th.appendChild(sortIcon);

        th.addEventListener('click', function() {
          var newDir = 'asc';
          if (sortKey === col.key) {
            newDir = sortDir === 'asc' ? 'desc' : 'asc';
          }
          renderSheet(container, Object.assign({}, config, { _sortKey: col.key, _sortDir: newDir }));
        });
      }

      headerRow.appendChild(th);
    });

    // Radial trigger column header (empty)
    if (radialActions.length > 0) {
      var radialHeader = document.createElement('div');
      radialHeader.className = 'proagri-sheet-header-cell radial-col';
      headerRow.appendChild(radialHeader);
    }

    sheetWrap.appendChild(headerRow);

    // Init radial menu if actions provided
    var radialMenu = null;
    if (radialActions.length > 0 && window.RadialMenu) {
      radialMenu = new RadialMenu(sheetWrap, { actions: radialActions });
    }

    // Data rows
    sortedData.forEach(function(rowData, index) {
      var row = document.createElement('div');
      row.className = 'proagri-sheet-row';
      row.style.animationDelay = (index * 0.03) + 's';

      columns.forEach(function(col) {
        var cell = document.createElement('div');
        cell.className = 'proagri-sheet-cell' + (col.isName ? ' cell-name' : '');

        var value = rowData[col.key];

        if (col.type === 'status') {
          var badge = document.createElement('span');
          var statusKey = (value || 'pending').toLowerCase().replace(/\s+/g, '_');
          badge.className = 'proagri-sheet-status proagri-sheet-status-' + statusKey;
          badge.textContent = formatStatus(value);
          cell.appendChild(badge);
        } else if (col.type === 'date') {
          cell.textContent = value ? new Date(value).toLocaleDateString() : '-';
        } else {
          cell.textContent = value || '-';
        }

        row.appendChild(cell);
      });

      // Radial trigger
      if (radialActions.length > 0) {
        var triggerCell = document.createElement('div');
        triggerCell.className = 'proagri-sheet-cell radial-col';

        var trigger = document.createElement('span');
        trigger.className = 'radial-trigger';
        trigger.textContent = '\u22EF'; // horizontal ellipsis character
        triggerCell.appendChild(trigger);
        row.appendChild(triggerCell);

        if (radialMenu) {
          radialMenu.attachToRow(row, rowData);
        }
      }

      sheetWrap.appendChild(row);
    });

    container.appendChild(sheetWrap);

    return {
      update: function(newData) {
        renderSheet(container, Object.assign({}, config, { data: newData }));
      }
    };
  }

  function formatStatus(status) {
    if (!status) return 'Pending';
    return status.split(/[_\s]+/).map(function(w) {
      return w.charAt(0).toUpperCase() + w.slice(1).toLowerCase();
    }).join(' ');
  }

  window.renderSheet = renderSheet;
})();
