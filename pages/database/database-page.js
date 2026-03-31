(function () {
  'use strict';

  var API_BASE = (window.API_URL || '/api') + '/dev';
  var PAGE_SIZE = 50;

  var TABLE_MODULES = {
    'employees': 'Employees',
    'channels': 'Messaging',
    'channel_members': 'Messaging',
    'messages': 'Messaging',
    'message_mentions': 'Messaging',
    'message_attachments': 'Messaging',
    'message_stars': 'Messaging',
    'notifications': 'Messaging',
    'message_folders': 'Messaging',
    'message_folder_items': 'Messaging',
    'clients': 'Clients',
    'booking_forms': 'Clients',
    'deliverables': 'Clients',
    'dashboards': 'Clients',
    'financials': 'Clients',
    'departments': 'Departments'
  };
  var MODULE_ORDER = ['Employees', 'Messaging', 'Clients', 'Departments', 'Other'];
  var TABLE_ORDER = {
    'Clients': ['clients', 'booking_forms', 'deliverables', 'financials', 'dashboards']
  };

  function groupTablesByModule(tables) {
    var groups = {};
    var i, tableName, mod;
    for (i = 0; i < tables.length; i++) {
      tableName = tables[i];
      mod = TABLE_MODULES[tableName] || 'Other';
      if (!groups[mod]) groups[mod] = [];
      groups[mod].push(tableName);
    }
    for (mod in groups) {
      if (groups.hasOwnProperty(mod)) {
        if (TABLE_ORDER[mod]) {
          var order = TABLE_ORDER[mod];
          groups[mod].sort(function (a, b) {
            var ai = order.indexOf(a);
            var bi = order.indexOf(b);
            if (ai === -1) ai = 999;
            if (bi === -1) bi = 999;
            return ai - bi;
          });
        } else {
          groups[mod].sort();
        }
      }
    }
    var result = [];
    for (i = 0; i < MODULE_ORDER.length; i++) {
      if (groups[MODULE_ORDER[i]]) {
        result.push({ module: MODULE_ORDER[i], tables: groups[MODULE_ORDER[i]] });
      }
    }
    for (mod in groups) {
      if (groups.hasOwnProperty(mod) && MODULE_ORDER.indexOf(mod) === -1) {
        result.push({ module: mod, tables: groups[mod] });
      }
    }
    return result;
  }

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

  function truncateValue(val, max) {
    if (val === null || val === undefined) return null;
    var str = String(val);
    if (str.length > (max || 80)) return str.substring(0, max || 80) + '...';
    return str;
  }

  function isSensitiveColumn(name) {
    var lower = name.toLowerCase();
    return lower.indexOf('password') !== -1 || lower.indexOf('hash') !== -1;
  }

  function initDatabasePage(container) {
    var sidebar = container.querySelector('#db-sidebar');
    var detail = container.querySelector('#db-detail');

    var activeTable = null;
    var currentOffset = 0;
    var totalRows = 0;

    fetch(API_BASE + '/tables', { headers: getHeaders() })
      .then(function (res) { return res.json(); })
      .then(function (tables) {
        if (!Array.isArray(tables) || tables.length === 0) {
          sidebar.innerHTML = '<div class="dev-db-empty">No tables found</div>';
          return;
        }

        var groups = groupTablesByModule(tables);
        var firstBtn = null;

        groups.forEach(function (group) {
          var groupEl = document.createElement('div');
          groupEl.className = 'dev-db-group';

          var storageKey = 'devDbGroup_' + group.module;
          var isCollapsed = localStorage.getItem(storageKey) === 'true';

          if (isCollapsed) {
            groupEl.classList.add('collapsed');
          }

          var headerBtn = document.createElement('button');
          headerBtn.className = 'dev-db-group-header';
          var itemsId = 'dev-db-items-' + group.module.toLowerCase().replace(/\s+/g, '-');
          headerBtn.setAttribute('aria-expanded', String(!isCollapsed));
          headerBtn.setAttribute('aria-controls', itemsId);

          var label = document.createElement('span');
          label.className = 'dev-db-group-label';
          label.textContent = group.module;
          headerBtn.appendChild(label);

          var count = document.createElement('span');
          count.className = 'dev-db-group-count';
          count.textContent = group.tables.length;
          headerBtn.appendChild(count);

          var chevron = document.createElement('span');
          chevron.className = 'dev-db-group-chevron';
          chevron.textContent = '\u25BE';
          headerBtn.appendChild(chevron);

          headerBtn.addEventListener('click', function () {
            var collapsed = groupEl.classList.toggle('collapsed');
            headerBtn.setAttribute('aria-expanded', String(!collapsed));
            localStorage.setItem(storageKey, collapsed ? 'true' : 'false');
          });

          groupEl.appendChild(headerBtn);

          var itemsContainer = document.createElement('div');
          itemsContainer.className = 'dev-db-group-items';
          itemsContainer.id = itemsId;

          group.tables.forEach(function (tableName) {
            var btn = document.createElement('button');
            btn.className = 'dev-db-table-item';

            var icon = document.createElement('span');
            icon.textContent = '\u2637';
            icon.style.opacity = '0.4';
            btn.appendChild(icon);

            var nameSpan = document.createElement('span');
            nameSpan.textContent = tableName;
            btn.appendChild(nameSpan);

            btn.addEventListener('click', function () {
              var items = sidebar.querySelectorAll('.dev-db-table-item');
              for (var i = 0; i < items.length; i++) {
                items[i].classList.remove('active');
              }
              btn.classList.add('active');
              activeTable = tableName;
              currentOffset = 0;
              loadTableDetail(tableName);
            });

            itemsContainer.appendChild(btn);

            if (!firstBtn) {
              firstBtn = btn;
            }
          });

          groupEl.appendChild(itemsContainer);
          sidebar.appendChild(groupEl);
        });

        if (firstBtn) firstBtn.click();
      })
      .catch(function () {
        sidebar.innerHTML = '<div class="dev-db-empty">Failed to load tables</div>';
      });

    function loadTableDetail(tableName) {
      detail.textContent = '';

      var nameEl = document.createElement('h2');
      nameEl.className = 'dev-db-table-name';
      nameEl.textContent = tableName;
      detail.appendChild(nameEl);

      fetch(API_BASE + '/tables/' + encodeURIComponent(tableName) + '/columns', { headers: getHeaders() })
        .then(function (res) { return res.json(); })
        .then(function (columns) {
          if (Array.isArray(columns) && columns.length > 0) {
            renderColumns(columns);
          }
        })
        .catch(function () {});

      loadRows(tableName, 0);
    }

    function renderColumns(columns) {
      var section = document.createElement('div');
      section.className = 'dev-db-columns';

      var label = document.createElement('div');
      label.className = 'dev-db-section-label';
      label.textContent = 'Columns';
      section.appendChild(label);

      var wrap = document.createElement('div');
      wrap.className = 'dev-db-grid-wrap';

      var table = document.createElement('table');
      table.className = 'dev-db-grid';

      var thead = document.createElement('thead');
      var headRow = document.createElement('tr');
      ['Name', 'Type', 'Nullable', 'Default'].forEach(function (text) {
        var th = document.createElement('th');
        th.textContent = text;
        headRow.appendChild(th);
      });
      thead.appendChild(headRow);
      table.appendChild(thead);

      var tbody = document.createElement('tbody');
      columns.forEach(function (col) {
        var tr = document.createElement('tr');

        var tdName = document.createElement('td');
        tdName.textContent = col.column_name || col.name || '';
        tr.appendChild(tdName);

        var tdType = document.createElement('td');
        tdType.className = 'dev-db-col-type';
        tdType.textContent = col.data_type || col.type || '';
        tr.appendChild(tdType);

        var tdNull = document.createElement('td');
        tdNull.className = 'dev-db-col-nullable';
        var nullable = col.is_nullable || col.nullable;
        tdNull.textContent = nullable === 'YES' || nullable === true ? 'yes' : 'no';
        tr.appendChild(tdNull);

        var tdDefault = document.createElement('td');
        tdDefault.className = 'dev-db-col-default';
        var def = col.column_default || col.default_value;
        tdDefault.textContent = def !== null && def !== undefined ? String(def) : '-';
        tr.appendChild(tdDefault);

        tbody.appendChild(tr);
      });
      table.appendChild(tbody);

      wrap.appendChild(table);
      section.appendChild(wrap);
      detail.appendChild(section);
    }

    function loadRows(tableName, offset) {
      var rowsLabel = document.createElement('div');
      rowsLabel.className = 'dev-db-section-label';
      rowsLabel.textContent = 'Data';

      var rowsContainer = document.createElement('div');

      var prevRowsSection = detail.querySelector('[data-rows-section]');
      if (prevRowsSection) prevRowsSection.remove();

      rowsContainer.setAttribute('data-rows-section', 'true');
      rowsContainer.appendChild(rowsLabel);
      detail.appendChild(rowsContainer);

      fetch(API_BASE + '/tables/' + encodeURIComponent(tableName) + '/rows?limit=' + PAGE_SIZE + '&offset=' + offset, {
        headers: getHeaders()
      })
        .then(function (res) { return res.json(); })
        .then(function (data) {
          var rows = data.rows || data;
          totalRows = data.total || (Array.isArray(rows) ? rows.length : 0);
          var rowsArr = Array.isArray(rows) ? rows : [];

          if (rowsArr.length === 0) {
            rowsContainer.innerHTML += '<div class="dev-db-empty">No rows</div>';
            return;
          }

          var colNames = Object.keys(rowsArr[0]);

          var wrap = document.createElement('div');
          wrap.className = 'dev-db-grid-wrap';

          var table = document.createElement('table');
          table.className = 'dev-db-grid';

          var thead = document.createElement('thead');
          var headRow = document.createElement('tr');
          colNames.forEach(function (name) {
            var th = document.createElement('th');
            th.textContent = name;
            headRow.appendChild(th);
          });
          thead.appendChild(headRow);
          table.appendChild(thead);

          var tbody = document.createElement('tbody');
          rowsArr.forEach(function (row) {
            var tr = document.createElement('tr');
            colNames.forEach(function (colName) {
              var td = document.createElement('td');
              var val = row[colName];

              if (val === null || val === undefined) {
                td.textContent = 'null';
                td.style.color = '#555';
                td.style.fontStyle = 'italic';
              } else if (isSensitiveColumn(colName)) {
                td.textContent = truncateValue(val, 16);
                td.style.color = '#555';
              } else {
                td.textContent = truncateValue(val, 80);
              }

              tr.appendChild(td);
            });
            tbody.appendChild(tr);
          });
          table.appendChild(tbody);
          wrap.appendChild(table);
          rowsContainer.appendChild(wrap);

          var pagination = document.createElement('div');
          pagination.className = 'dev-db-pagination';

          var prevBtn = document.createElement('button');
          prevBtn.textContent = 'Previous';
          prevBtn.disabled = offset === 0;
          prevBtn.addEventListener('click', function () {
            currentOffset = Math.max(0, offset - PAGE_SIZE);
            loadRows(tableName, currentOffset);
          });
          pagination.appendChild(prevBtn);

          var info = document.createElement('span');
          var start = offset + 1;
          var end = offset + rowsArr.length;
          info.textContent = 'Showing ' + start + '-' + end + ' of ' + totalRows;
          pagination.appendChild(info);

          var nextBtn = document.createElement('button');
          nextBtn.textContent = 'Next';
          nextBtn.disabled = (offset + PAGE_SIZE) >= totalRows;
          nextBtn.addEventListener('click', function () {
            currentOffset = offset + PAGE_SIZE;
            loadRows(tableName, currentOffset);
          });
          pagination.appendChild(nextBtn);

          rowsContainer.appendChild(pagination);
        })
        .catch(function () {
          rowsContainer.innerHTML += '<div class="dev-db-empty">Failed to load rows</div>';
        });
    }
  }

  window.renderDatabasePage = function (container) {
    window.insertTemplate(container, '/pages/database/database.html', initDatabasePage);
  };
})();
