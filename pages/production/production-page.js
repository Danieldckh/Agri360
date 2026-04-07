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

  function formatStatus(status) {
    if (!status) return 'Pending';
    return status.replace(/_/g, ' ').replace(/\b\w/g, function (c) { return c.toUpperCase(); });
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

  // ── Follow Ups Tab (50/50 layout, template-based) ──────────────
  function renderFollowUpsTab(container) {
    while (container.firstChild) container.removeChild(container.firstChild);
    container.style.display = '';
    container.style.alignItems = '';
    container.style.justifyContent = '';
    container.style.flexDirection = '';
    container.style.height = '';
    container.style.gap = '';
    container.style.padding = '';

    loadProductionTemplates().then(function (tmplContainer) {
      var frag = cloneTemplateContent(tmplContainer, 'followUpsTabTemplate');
      if (!frag) return;
      container.appendChild(frag);

      var leftCount = container.querySelector('#fuLeftCount');
      var leftSearch = container.querySelector('#fuLeftSearch');
      var leftSheet = container.querySelector('#fuLeftSheet');
      var rightCount = container.querySelector('#fuRightCount');
      var rightSearch = container.querySelector('#fuRightSearch');
      var rightSheet = container.querySelector('#fuRightSheet');

      var leftItems = [];
      var rightItems = [];
      var leftSort = { key: null, dir: 'asc' };
      var rightSort = { key: null, dir: 'asc' };

      leftSearch.addEventListener('input', function () {
        renderLeftTable(leftItems, leftSearch.value.toLowerCase());
      });

      rightSearch.addEventListener('input', function () {
        renderRightTable(rightItems, rightSearch.value.toLowerCase());
      });

      function refreshData(month) {
        var url = API_BASE + '/by-department/production';
        if (month) url += '?month=' + month;
        fetch(url, { headers: getHeaders() })
          .then(function (res) {
            if (!res.ok) throw new Error('Failed to fetch');
            return res.json();
          })
          .then(function (deliverables) {
            leftItems = deliverables.filter(function (d) {
              return d.status === 'materials_requested';
            });
            rightItems = deliverables.filter(function (d) {
              return d.status === 'sent_for_approval';
            });
            leftCount.textContent = leftItems.length;
            rightCount.textContent = rightItems.length;
            renderLeftTable(leftItems, leftSearch.value.toLowerCase());
            renderRightTable(rightItems, rightSearch.value.toLowerCase());
          })
          .catch(function (err) {
            console.error('Follow Ups fetch error:', err);
          });
      }

      var monthCtrl = initMonthSelector(container, {prev: 'fuMonthPrev', next: 'fuMonthNext', label: 'fuMonthLabel'}, 'production', function(month) { refreshData(month); });

      function advanceStatus(itemId, nextStatus) {
        fetch(API_BASE + '/' + itemId, {
          method: 'PATCH',
          headers: getHeaders(),
          body: JSON.stringify({ status: nextStatus })
        }).then(function (res) {
          if (res.ok) refreshData(monthCtrl.getCurrentMonth());
        });
      }

      function incrementFollowUp(itemId, currentCount) {
        fetch(API_BASE + '/' + itemId, {
          method: 'PATCH',
          headers: getHeaders(),
          body: JSON.stringify({ followUpCount: currentCount + 1 })
        }).then(function (res) {
          if (res.ok) refreshData(monthCtrl.getCurrentMonth());
        });
      }

      function renderLeftTable(items, filterTerm) {
        while (leftSheet.firstChild) leftSheet.removeChild(leftSheet.firstChild);

        var filtered = items;
        if (filterTerm) {
          filtered = items.filter(function (item) {
            return (item.clientName && item.clientName.toLowerCase().indexOf(filterTerm) !== -1) ||
              (item.title && item.title.toLowerCase().indexOf(filterTerm) !== -1) ||
              (item.type && item.type.toLowerCase().indexOf(filterTerm) !== -1);
          });
        }

        if (filtered.length === 0) {
          var empty = document.createElement('div');
          empty.style.padding = '40px';
          empty.style.textAlign = 'center';
          empty.style.color = 'var(--text-muted, #999)';
          empty.textContent = 'No materials requested';
          leftSheet.appendChild(empty);
          return;
        }

        var table = document.createElement('table');
        table.className = 'production-sheet-table';

        var thead = document.createElement('thead');
        var headerRow = document.createElement('tr');
        var columns = [
          { label: 'Client', sortKey: 'clientName' },
          { label: 'Title', sortKey: 'title' },
          { label: 'Type', sortKey: 'type' },
          { label: 'Status Changed', sortKey: 'statusChangedAt' },
          { label: 'Follow Up Count', sortKey: 'followUpCount' },
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

        makeSortableHeaders(thead, columns, leftSort, function () {
          renderLeftTable(leftItems, leftSearch.value.toLowerCase());
        });

        var sorted = sortItems(filtered, leftSort.key, leftSort.dir);

        var tbody = document.createElement('tbody');
        sorted.forEach(function (item) {
          var row = document.createElement('tr');
          row.className = 'production-child-row';

          var tdClient = document.createElement('td');
          tdClient.style.fontWeight = '600';
          tdClient.textContent = item.clientName || '\u2014';
          row.appendChild(tdClient);

          var tdTitle = document.createElement('td');
          tdTitle.textContent = item.title || '\u2014';
          row.appendChild(tdTitle);

          var tdType = document.createElement('td');
          var typeBadge = document.createElement('span');
          typeBadge.className = 'production-type-badge';
          typeBadge.textContent = item.type || '\u2014';
          tdType.appendChild(typeBadge);
          row.appendChild(tdType);

          var tdChanged = document.createElement('td');
          tdChanged.textContent = formatStatusChanged(item.statusChangedAt);
          row.appendChild(tdChanged);

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
        leftSheet.appendChild(table);
      }

      function renderRightTable(items, filterTerm) {
        while (rightSheet.firstChild) rightSheet.removeChild(rightSheet.firstChild);

        var filtered = items;
        if (filterTerm) {
          filtered = items.filter(function (item) {
            return (item.clientName && item.clientName.toLowerCase().indexOf(filterTerm) !== -1) ||
              (item.title && item.title.toLowerCase().indexOf(filterTerm) !== -1) ||
              (item.type && item.type.toLowerCase().indexOf(filterTerm) !== -1);
          });
        }

        if (filtered.length === 0) {
          var empty = document.createElement('div');
          empty.style.padding = '40px';
          empty.style.textAlign = 'center';
          empty.style.color = 'var(--text-muted, #999)';
          empty.textContent = 'No items sent for approval';
          rightSheet.appendChild(empty);
          return;
        }

        var table = document.createElement('table');
        table.className = 'production-sheet-table';

        var thead = document.createElement('thead');
        var headerRow = document.createElement('tr');
        var columns = [
          { label: 'Client', sortKey: 'clientName' },
          { label: 'Title', sortKey: 'title' },
          { label: 'Type', sortKey: 'type' },
          { label: 'Status Changed', sortKey: 'statusChangedAt' },
          { label: 'Follow Up Count', sortKey: 'followUpCount' },
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

        makeSortableHeaders(thead, columns, rightSort, function () {
          renderRightTable(rightItems, rightSearch.value.toLowerCase());
        });

        var sorted = sortItems(filtered, rightSort.key, rightSort.dir);

        var tbody = document.createElement('tbody');
        sorted.forEach(function (item) {
          var row = document.createElement('tr');
          row.className = 'production-child-row';

          var tdClient = document.createElement('td');
          tdClient.style.fontWeight = '600';
          tdClient.textContent = item.clientName || '\u2014';
          row.appendChild(tdClient);

          var tdTitle = document.createElement('td');
          tdTitle.textContent = item.title || '\u2014';
          row.appendChild(tdTitle);

          var tdType = document.createElement('td');
          var typeBadge = document.createElement('span');
          typeBadge.className = 'production-type-badge';
          typeBadge.textContent = item.type || '\u2014';
          tdType.appendChild(typeBadge);
          row.appendChild(tdType);

          var tdChanged = document.createElement('td');
          tdChanged.textContent = formatStatusChanged(item.statusChangedAt);
          row.appendChild(tdChanged);

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
        });
        table.appendChild(tbody);
        rightSheet.appendChild(table);
      }

      // initMonthSelector triggers the first fetch via onMonthChange callback
    });
  }

  // ── Approvals Tab (50/50 layout, template-based) ───────────────
  function renderApprovalsTab(container) {
    while (container.firstChild) container.removeChild(container.firstChild);
    container.style.display = '';
    container.style.alignItems = '';
    container.style.justifyContent = '';
    container.style.flexDirection = '';
    container.style.height = '';
    container.style.gap = '';
    container.style.padding = '';

    loadProductionTemplates().then(function (tmplContainer) {
      var frag = cloneTemplateContent(tmplContainer, 'approvalsTabTemplate');
      if (!frag) return;
      container.appendChild(frag);

      var leftCount = container.querySelector('#appLeftCount');
      var leftSearch = container.querySelector('#appLeftSearch');
      var leftSheet = container.querySelector('#appLeftSheet');
      var rightCount = container.querySelector('#appRightCount');
      var rightSearch = container.querySelector('#appRightSearch');
      var rightSheet = container.querySelector('#appRightSheet');

      var leftItems = [];
      var rightItems = [];
      var leftSort = { key: null, dir: 'asc' };
      var rightSort = { key: null, dir: 'asc' };

      leftSearch.addEventListener('input', function () {
        renderLeftTable(leftItems, leftSearch.value.toLowerCase());
      });

      rightSearch.addEventListener('input', function () {
        renderRightTable(rightItems, rightSearch.value.toLowerCase());
      });

      function refreshData(month) {
        var url = API_BASE + '/by-department/production';
        if (month) url += '?month=' + month;
        fetch(url, { headers: getHeaders() })
          .then(function (res) {
            if (!res.ok) throw new Error('Failed to fetch');
            return res.json();
          })
          .then(function (deliverables) {
            leftItems = deliverables.filter(function (d) {
              return d.status === 'ready_for_approval';
            });
            rightItems = deliverables.filter(function (d) {
              return d.status === 'sent_for_approval';
            });
            leftCount.textContent = leftItems.length;
            rightCount.textContent = rightItems.length;
            renderLeftTable(leftItems, leftSearch.value.toLowerCase());
            renderRightTable(rightItems, rightSearch.value.toLowerCase());
          })
          .catch(function (err) {
            console.error('Approvals fetch error:', err);
          });
      }

      var monthCtrl = initMonthSelector(container, {prev: 'appMonthPrev', next: 'appMonthNext', label: 'appMonthLabel'}, 'production', function(month) { refreshData(month); });

      function advanceStatus(itemId, nextStatus) {
        fetch(API_BASE + '/' + itemId, {
          method: 'PATCH',
          headers: getHeaders(),
          body: JSON.stringify({ status: nextStatus })
        }).then(function (res) {
          if (res.ok) refreshData(monthCtrl.getCurrentMonth());
        });
      }

      function renderAssignedCell(item) {
        var td = document.createElement('td');
        var assignedId = item.assignedProduction || item.assignedTo;
        if (assignedId && window._employeeCacheLookup) {
          var emp = window._employeeCacheLookup(assignedId);
          if (emp && emp.photo_url) {
            var avatarImg = document.createElement('img');
            avatarImg.style.cssText = 'width:28px;height:28px;border-radius:50%;object-fit:cover;';
            avatarImg.src = emp.photo_url;
            avatarImg.alt = (emp.first_name || '') + ' ' + (emp.last_name || '');
            avatarImg.title = (emp.first_name || '') + ' ' + (emp.last_name || '');
            td.appendChild(avatarImg);
          } else {
            td.textContent = assignedId;
          }
        } else {
          td.textContent = '\u2014';
        }
        return td;
      }

      function renderLeftTable(items, filterTerm) {
        while (leftSheet.firstChild) leftSheet.removeChild(leftSheet.firstChild);

        var filtered = items;
        if (filterTerm) {
          filtered = items.filter(function (item) {
            return (item.clientName && item.clientName.toLowerCase().indexOf(filterTerm) !== -1) ||
              (item.title && item.title.toLowerCase().indexOf(filterTerm) !== -1) ||
              (item.type && item.type.toLowerCase().indexOf(filterTerm) !== -1);
          });
        }

        if (filtered.length === 0) {
          var empty = document.createElement('div');
          empty.style.padding = '40px';
          empty.style.textAlign = 'center';
          empty.style.color = 'var(--text-muted, #999)';
          empty.textContent = 'No items ready for approval';
          leftSheet.appendChild(empty);
          return;
        }

        var table = document.createElement('table');
        table.className = 'production-sheet-table';

        var thead = document.createElement('thead');
        var headerRow = document.createElement('tr');
        var columns = [
          { label: 'Client', sortKey: 'clientName' },
          { label: 'Title', sortKey: 'title' },
          { label: 'Type', sortKey: 'type' },
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

        makeSortableHeaders(thead, columns, leftSort, function () {
          renderLeftTable(leftItems, leftSearch.value.toLowerCase());
        });

        var sorted = sortItems(filtered, leftSort.key, leftSort.dir);

        var tbody = document.createElement('tbody');
        sorted.forEach(function (item) {
          var row = document.createElement('tr');
          row.className = 'production-child-row';

          var tdClient = document.createElement('td');
          tdClient.style.fontWeight = '600';
          tdClient.textContent = item.clientName || '\u2014';
          row.appendChild(tdClient);

          var tdTitle = document.createElement('td');
          tdTitle.textContent = item.title || '\u2014';
          row.appendChild(tdTitle);

          var tdType = document.createElement('td');
          var typeBadge = document.createElement('span');
          typeBadge.className = 'production-type-badge';
          typeBadge.textContent = item.type || '\u2014';
          tdType.appendChild(typeBadge);
          row.appendChild(tdType);

          row.appendChild(renderAssignedCell(item));

          var tdDue = document.createElement('td');
          tdDue.textContent = formatDate(item.dueDate);
          row.appendChild(tdDue);

          var tdAction = document.createElement('td');
          var btn = document.createElement('button');
          btn.className = 'proagri-sheet-row-action-btn action-advance';
          btn.title = 'Send for Approval';
          btn.appendChild(makeSvgIcon(ICON_ADVANCE));
          btn.style.opacity = '1';
          btn.addEventListener('click', (function (id) {
            return function (e) {
              e.stopPropagation();
              advanceStatus(id, 'sent_for_approval');
            };
          })(item.id));
          tdAction.appendChild(btn);
          row.appendChild(tdAction);

          tbody.appendChild(row);
        });
        table.appendChild(tbody);
        leftSheet.appendChild(table);
      }

      function renderRightTable(items, filterTerm) {
        while (rightSheet.firstChild) rightSheet.removeChild(rightSheet.firstChild);

        var filtered = items;
        if (filterTerm) {
          filtered = items.filter(function (item) {
            return (item.clientName && item.clientName.toLowerCase().indexOf(filterTerm) !== -1) ||
              (item.title && item.title.toLowerCase().indexOf(filterTerm) !== -1) ||
              (item.type && item.type.toLowerCase().indexOf(filterTerm) !== -1);
          });
        }

        if (filtered.length === 0) {
          var empty = document.createElement('div');
          empty.style.padding = '40px';
          empty.style.textAlign = 'center';
          empty.style.color = 'var(--text-muted, #999)';
          empty.textContent = 'No items sent for approval';
          rightSheet.appendChild(empty);
          return;
        }

        var table = document.createElement('table');
        table.className = 'production-sheet-table';

        var thead = document.createElement('thead');
        var headerRow = document.createElement('tr');
        var columns = [
          { label: 'Client', sortKey: 'clientName' },
          { label: 'Title', sortKey: 'title' },
          { label: 'Type', sortKey: 'type' },
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

        makeSortableHeaders(thead, columns, rightSort, function () {
          renderRightTable(rightItems, rightSearch.value.toLowerCase());
        });

        var sorted = sortItems(filtered, rightSort.key, rightSort.dir);

        var tbody = document.createElement('tbody');
        sorted.forEach(function (item) {
          var row = document.createElement('tr');
          row.className = 'production-child-row';

          var tdClient = document.createElement('td');
          tdClient.style.fontWeight = '600';
          tdClient.textContent = item.clientName || '\u2014';
          row.appendChild(tdClient);

          var tdTitle = document.createElement('td');
          tdTitle.textContent = item.title || '\u2014';
          row.appendChild(tdTitle);

          var tdType = document.createElement('td');
          var typeBadge = document.createElement('span');
          typeBadge.className = 'production-type-badge';
          typeBadge.textContent = item.type || '\u2014';
          tdType.appendChild(typeBadge);
          row.appendChild(tdType);

          row.appendChild(renderAssignedCell(item));

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
        });
        table.appendChild(tbody);
        rightSheet.appendChild(table);
      }

      // initMonthSelector triggers the first fetch via onMonthChange callback
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

    cell.appendChild(dropdown);

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

          var childRows = [];
          items.forEach(function (item) {
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
                  fetch(API_BASE + '/' + id, {
                    method: 'PATCH',
                    headers: getHeaders(),
                    body: JSON.stringify({ status: next })
                  }).then(function (res) {
                    if (res.ok) refreshAll(monthCtrl.getCurrentMonth());
                  });
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
  };

  window.renderProductionTab = renderProductionTab;
  window.renderFollowUpsTab = renderFollowUpsTab;
  window.renderApprovalsTab = renderApprovalsTab;

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
        { label: 'Title', cls: 'prod-deliv-cell prod-deliv-title' },
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

        clientRow.addEventListener('click', function () {
          collapsedClients[group.clientName] = !collapsedClients[group.clientName];
          renderTable();
        });
        sheetBody.appendChild(clientRow);

        if (isCollapsed) return;

        group.items.forEach(function (item) {
          var row = document.createElement('div');
          row.className = 'prod-deliv-row';

          // Eye icon — open deliverable dashboard
          var eyeCell = document.createElement('div');
          eyeCell.className = 'prod-deliv-cell prod-deliv-act';
          var dashboardTypes = ['sm-content-calendar', 'website-design', 'online-articles',
            'agri4all-posts', 'agri4all-videos', 'agri4all-product-uploads',
            'agri4all-newsletter-feature', 'agri4all-newsletter-banner', 'agri4all-linkedin',
            'own-social-posts', 'own-social-videos', 'own-social-linkedin', 'own-social-twitter',
            'agri4all-banners',
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
                else if (it.type === 'agri4all-posts') openA4AMultiSectionDashboard(container, it, 'posts');
                else if (it.type === 'agri4all-videos') openA4AMultiSectionDashboard(container, it, 'videos');
                else if (it.type === 'own-social-posts') openA4AMultiSectionDashboard(container, it, 'own-posts');
                else if (it.type === 'own-social-videos') openA4AMultiSectionDashboard(container, it, 'own-videos');
                else if (it.type === 'agri4all-product-uploads') openA4AImageDescriptionDashboard(container, it);
                else if (it.type === 'agri4all-newsletter-feature') openA4AImageDescriptionDashboard(container, it);
                else if (it.type === 'agri4all-newsletter-banner') openA4AImageDescriptionDashboard(container, it);
                else if (it.type === 'agri4all-banners') openA4AImageDescriptionDashboard(container, it);
                else if (it.type && it.type.indexOf('magazine') === 0) openA4AImageDescriptionDashboard(container, it);
                else if (it.type === 'agri4all-linkedin') openA4ARichTextDashboard(container, it);
                else if (it.type === 'own-social-linkedin') openA4ARichTextDashboard(container, it);
                else if (it.type === 'own-social-twitter') openA4ARichTextDashboard(container, it);
              });
            })(item);
            eyeCell.appendChild(eyeBtn);
          }
          row.appendChild(eyeCell);

          // Title
          var titleCell = document.createElement('div');
          titleCell.className = 'prod-deliv-cell prod-deliv-title';
          titleCell.textContent = item.title || '';
          row.appendChild(titleCell);

          // Type
          var typeCell = document.createElement('div');
          typeCell.className = 'prod-deliv-cell prod-deliv-type';
          typeCell.textContent = formatStatus(item.type || '');
          row.appendChild(typeCell);

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

              document.body.appendChild(dropdown);
              var rect = cellEl.getBoundingClientRect();
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
          })(statusCell, item);

          row.appendChild(statusCell);

          // Advance button
          var actCol = document.createElement('div');
          actCol.className = 'prod-deliv-cell prod-deliv-act';
          var advBtn = document.createElement('button');
          advBtn.className = 'proagri-sheet-row-action-btn action-advance';
          advBtn.type = 'button';
          advBtn.title = 'Advance status';
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
      fetch(API_BASE + '/by-department/production?month=' + ym, { headers: getHeaders() })
        .then(function (res) { return res.json(); })
        .then(function (data) {
          allData = data;
          renderTable();
        })
        .catch(function (err) {
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

  // ── Content Calendar Dashboard ─────────────────────────
  var _savedProdSidebar = null;
  var _ccContainer = null;
  var _ccRefreshFn = null;

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
    title.textContent = deliverable.title || 'Content Calendar';
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

    // Table
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
      { label: 'Changes', cls: 'cc-posts-th-changes' },
      { label: '', cls: 'cc-posts-th-act' }
    ].forEach(function (h) {
      var th = document.createElement('div');
      th.className = 'cc-posts-th ' + h.cls;
      th.textContent = h.label;
      thead.appendChild(th);
    });
    table.appendChild(thead);

    var tbody = document.createElement('div');
    tbody.className = 'cc-posts-body';
    table.appendChild(tbody);
    tableWrap.appendChild(table);
    wrapper.appendChild(tableWrap);
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

    // Caption
    var captionCell = document.createElement('div');
    captionCell.className = 'cc-posts-cell cc-posts-caption';
    var captionEditor = document.createElement('div');
    captionEditor.className = 'cc-caption-editor';
    captionEditor.contentEditable = 'true';
    captionEditor.innerHTML = post.caption || '';
    captionEditor.setAttribute('placeholder', 'Write caption...');
    captionEditor.addEventListener('blur', function () {
      post.caption = captionEditor.innerHTML;
      savePostData(deliverable.id, posts);
    });
    captionCell.appendChild(captionEditor);
    row.appendChild(captionCell);

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

    // Change Requests (per row)
    if (!post.change_requests) post.change_requests = [];
    var crCell = document.createElement('div');
    crCell.className = 'cc-posts-cell cc-posts-changes';

    function renderCR() {
      while (crCell.firstChild) crCell.removeChild(crCell.firstChild);
      post.change_requests.forEach(function (cr, crIdx) {
        var item = document.createElement('div');
        item.className = 'cc-cr-item';
        var cb = document.createElement('input');
        cb.type = 'checkbox';
        cb.checked = !!cr.done;
        cb.addEventListener('change', function () {
          cr.done = cb.checked;
          text.className = 'cc-cr-text' + (cr.done ? ' done' : '');
          savePostData(deliverable.id, posts);
        });
        item.appendChild(cb);
        var text = document.createElement('span');
        text.className = 'cc-cr-text' + (cr.done ? ' done' : '');
        text.contentEditable = 'true';
        text.textContent = cr.text || '';
        text.addEventListener('blur', function () {
          cr.text = text.textContent;
          savePostData(deliverable.id, posts);
        });
        item.appendChild(text);
        var del = document.createElement('button');
        del.className = 'cc-cr-delete';
        del.textContent = '\u00D7';
        del.addEventListener('click', function () {
          post.change_requests.splice(crIdx, 1);
          renderCR();
          savePostData(deliverable.id, posts);
        });
        item.appendChild(del);
        crCell.appendChild(item);
      });
      var addBtn = document.createElement('button');
      addBtn.className = 'cc-cr-add-inline';
      addBtn.textContent = '+';
      addBtn.title = 'Add change request';
      addBtn.addEventListener('click', function () {
        post.change_requests.push({ text: '', done: false });
        renderCR();
        var lastText = crCell.querySelector('.cc-cr-item:last-child .cc-cr-text');
        if (lastText) lastText.focus();
      });
      crCell.appendChild(addBtn);
    }
    renderCR();
    row.appendChild(crCell);

    // Delete row button
    var actCell = document.createElement('div');
    actCell.className = 'cc-posts-cell cc-posts-act';
    var delBtn = document.createElement('button');
    delBtn.className = 'cc-row-delete';
    delBtn.title = 'Remove post';
    delBtn.textContent = '\u00D7';
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
    detailsWrap.style.padding = '0 16px';

    function addDetail(label, value) {
      if (!value) return;
      var row = document.createElement('div');
      row.style.cssText = 'display:flex;justify-content:space-between;gap:6px;padding:2px 0;font-size:11px;';
      var lbl = document.createElement('span');
      lbl.style.color = 'var(--text-secondary,#64748b)';
      lbl.textContent = label;
      row.appendChild(lbl);
      var val = document.createElement('span');
      val.style.cssText = 'color:var(--text-primary,#1e293b);font-weight:500;text-align:right;';
      val.textContent = value;
      row.appendChild(val);
      detailsWrap.appendChild(row);
    }

    addDetail('Monthly Posts', meta.monthly_posts || meta.posts_per_month || '');
    addDetail('Type', 'Content Calendar');

    nav.appendChild(detailsWrap);

    // Platforms — Facebook, Instagram, Stories
    var sep4 = document.createElement('div');
    sep4.style.cssText = 'height:1px;background:rgba(128,128,128,0.12);margin:6px 16px;';
    nav.appendChild(sep4);
    var platHeader = document.createElement('div');
    platHeader.style.cssText = 'font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:0.06em;color:var(--text-secondary,#94a3b8);padding:4px 16px;';
    platHeader.textContent = 'Platforms';
    nav.appendChild(platHeader);

    var platWrap = document.createElement('div');
    platWrap.style.padding = '0 16px';
    var platforms = meta.platforms || [];
    var hasFb = platforms.some(function (p) { return p.key === 'facebook'; });
    var hasIg = platforms.some(function (p) { return p.key === 'instagram'; });
    // Stories is derived from Instagram being present
    var hasStories = hasIg;

    [{ name: 'Facebook', active: hasFb }, { name: 'Instagram', active: hasIg }, { name: 'Stories', active: hasStories }].forEach(function (pl) {
      if (!pl.active) return;
      var tag = document.createElement('div');
      tag.style.cssText = 'display:inline-block;padding:3px 10px;margin:2px 4px 2px 0;border-radius:12px;font-size:11px;font-weight:600;background:rgba(59,130,246,0.1);color:#3b82f6;';
      tag.textContent = pl.name;
      platWrap.appendChild(tag);
    });
    nav.appendChild(platWrap);
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

    // Main content
    var wrapper = document.createElement('div');
    wrapper.className = 'wd-dashboard';

    var title = document.createElement('h2');
    title.className = 'cc-dashboard-title';
    title.textContent = deliverable.title || 'Website Design';
    title.style.marginBottom = '16px';
    wrapper.appendChild(title);

    var stepsWrap = document.createElement('div');
    stepsWrap.className = 'wd-steps';

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

      stepsWrap.appendChild(stepEl);
    });

    wrapper.appendChild(stepsWrap);
    container.appendChild(wrapper);
  }

  // ══════ ONLINE ARTICLES DASHBOARD ═════════════════════════
  function openOnlineArticlesDashboard(container, deliverable) {
    _ccContainer = container;
    while (container.firstChild) container.removeChild(container.firstChild);

    var meta = deliverable.metadata || {};
    if (typeof meta === 'string') try { meta = JSON.parse(meta); } catch (e) { meta = {}; }
    if (!meta.article_text) meta.article_text = '';
    if (!meta.article_images) meta.article_images = [];

    function save() {
      fetch(API_BASE + '/' + deliverable.id, {
        method: 'PATCH', headers: getHeaders(),
        body: JSON.stringify({ metadata: { article_text: meta.article_text, article_images: meta.article_images } })
      });
    }

    // Sidebar
    setupDashboardSidebar(deliverable, function (nav) {
      addSidebarSection(nav, 'Article Details');
      var wrap = document.createElement('div');
      wrap.style.padding = '0 16px';
      addSidebarField(wrap, 'Articles', meta.amount);
      addSidebarField(wrap, 'Curated', meta.curated_amount);
      nav.appendChild(wrap);

      // Publishing platforms
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

      // Social links from booking form
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
              a.textContent = p.platform;
              sWrap.appendChild(a);
            });
            nav.appendChild(sWrap);
          }
        });
      }
    });

    // Main content
    var wrapper = document.createElement('div');
    wrapper.className = 'oa-dashboard';

    var title = document.createElement('h2');
    title.className = 'cc-dashboard-title';
    title.textContent = deliverable.title || 'Online Article';
    title.style.marginBottom = '16px';
    wrapper.appendChild(title);

    // Article text editor
    var editorCard = document.createElement('div');
    editorCard.className = 'oa-editor-card';
    var editorTitle = document.createElement('h3');
    editorTitle.className = 'oa-card-title';
    editorTitle.textContent = 'Article Text';
    editorCard.appendChild(editorTitle);
    var editor = document.createElement('div');
    editor.className = 'oa-article-editor';
    editor.contentEditable = 'true';
    editor.innerHTML = meta.article_text || '';
    editor.setAttribute('placeholder', 'Paste or write the article text here...');
    editor.addEventListener('blur', function () {
      meta.article_text = editor.innerHTML;
      save();
    });
    editorCard.appendChild(editor);
    wrapper.appendChild(editorCard);

    // Image dump
    var imgCard = document.createElement('div');
    imgCard.className = 'oa-editor-card';
    var imgTitle = document.createElement('h3');
    imgTitle.className = 'oa-card-title';
    imgTitle.textContent = 'Images';
    imgCard.appendChild(imgTitle);
    imgCard.appendChild(buildUploadArea(deliverable.id, meta.article_images, save, 'Upload images'));
    wrapper.appendChild(imgCard);

    container.appendChild(wrapper);
  }

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
    title.textContent = deliverable.title || '';
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

      // Checkbox
      var cb = document.createElement('input');
      cb.type = 'checkbox';
      cb.className = 'wd-step-checkbox';
      cb.checked = !!opts.done;
      cb.addEventListener('change', function () {
        opts.onDone(cb.checked);
        stepEl.classList.toggle('wd-step-done', cb.checked);
      });
      header.appendChild(cb);

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

    var blocksWrap = document.createElement('div');
    wrapper.appendChild(blocksWrap);
    container.appendChild(wrapper);

    function buildRichBlock(opts) {
      var card = document.createElement('div');
      card.className = 'oa-editor-card';

      var header = document.createElement('div');
      header.style.cssText = 'display:flex;align-items:center;gap:10px;margin-bottom:10px;';
      var cb = document.createElement('input');
      cb.type = 'checkbox';
      cb.className = 'wd-step-checkbox';
      cb.checked = !!opts.done;
      cb.addEventListener('change', function () {
        opts.onDone(cb.checked);
        card.classList.toggle('wd-step-done', cb.checked);
      });
      header.appendChild(cb);

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

})();
