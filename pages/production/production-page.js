(function () {
  'use strict';

  var API_BASE = '/api/deliverables';

  // ── Month selector helper ────────────────────────
  function initMonthSelector(container, ids, deptSlug, onMonthChange) {
    var prevBtn = container.querySelector('#' + ids.prev);
    var nextBtn = container.querySelector('#' + ids.next);
    var label = container.querySelector('#' + ids.label);
    var months = [];
    var currentIndex = 0;

    var MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December'];

    function formatMonth(ym) {
      var parts = ym.split('-');
      return MONTH_NAMES[parseInt(parts[1], 10) - 1] + ' ' + parts[0];
    }

    function currentYM() {
      var now = new Date();
      return now.getFullYear() + '-' + String(now.getMonth() + 1).padStart(2, '0');
    }

    function updateUI() {
      if (months.length === 0) {
        label.textContent = formatMonth(currentYM());
        prevBtn.disabled = true;
        nextBtn.disabled = true;
        return;
      }
      label.textContent = formatMonth(months[currentIndex]);
      prevBtn.disabled = currentIndex >= months.length - 1;
      nextBtn.disabled = currentIndex <= 0;
    }

    prevBtn.addEventListener('click', function () {
      if (currentIndex < months.length - 1) {
        currentIndex++;
        updateUI();
        onMonthChange(months[currentIndex]);
      }
    });

    nextBtn.addEventListener('click', function () {
      if (currentIndex > 0) {
        currentIndex--;
        updateUI();
        onMonthChange(months[currentIndex]);
      }
    });

    // Fetch available months and initialize
    fetch('/api/deliverables/available-months/' + deptSlug, { headers: getHeaders() })
      .then(function (res) { return res.json(); })
      .then(function (data) {
        months = data; // already sorted DESC from API
        if (months.length > 0) {
          var idx = months.indexOf(currentYM());
          currentIndex = idx !== -1 ? idx : 0;
          updateUI();
          onMonthChange(months[currentIndex]);
        } else {
          // No months in DB — show current month, load all data unfiltered
          updateUI();
          onMonthChange(null);
        }
      })
      .catch(function () {
        label.textContent = formatMonth(currentYM());
        onMonthChange(null);
      });

    return {
      getCurrentMonth: function () { return months[currentIndex] || null; }
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
})();
