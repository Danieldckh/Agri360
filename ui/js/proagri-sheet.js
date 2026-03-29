/**
 * ProAgri Sheet Component — Rich Property Types
 *
 * Usage:
 *   var handle = window.renderSheet(container, {
 *     columns: [
 *       { key: 'title', label: 'Title', sortable: true, isName: true, type: 'text', editable: true },
 *       { key: 'status', label: 'Status', sortable: true, type: 'status', editable: true,
 *         options: ['pending', 'in_progress', 'completed'] },
 *       { key: 'tags', label: 'Tags', type: 'multiselect', editable: true, options: ['a','b'] },
 *       { key: 'due_date', label: 'Due', sortable: true, type: 'date', editable: true },
 *       { key: 'assigned_to', label: 'Assigned', type: 'person', editable: true, multiple: true },
 *       { key: 'budget', label: 'Budget', type: 'number', sortable: true, editable: true },
 *       { key: 'done', label: 'Done', type: 'checkbox', editable: true, width: 'sm' },
 *     ],
 *     data: arrayOfObjects,          // null=loading, []=empty
 *     radialActions: [...],          // row action buttons
 *     searchable: true,              // built-in search bar
 *     onCellEdit: fn(rowData, key, newValue),
 *     apiEndpoint: '/api/deliverables',
 *   });
 *   handle.update(newData);
 */
(function () {
  'use strict';

  var STATUS_ORDER = {
    'pending': 0, 'draft': 0, 'lead': 0,
    'in_progress': 1, 'in progress': 1, 'active': 1,
    'completed': 2, 'done': 2,
    'overdue': 3, 'inactive': 4,
    'low': 0, 'medium': 1, 'high': 2, 'urgent': 3
  };

  var MONTHS = ['January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'];
  var DAYS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

  var PERSON_SVG_PATH = 'M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z';
  var CHECK_SVG_PATH = 'M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z';

  // === Employee cache ===
  var employeeCache = null;
  var employeeCacheTime = 0;
  var CACHE_TTL = 5 * 60 * 1000;

  function fetchEmployees() {
    var now = Date.now();
    if (employeeCache && (now - employeeCacheTime) < CACHE_TTL) {
      return Promise.resolve(employeeCache);
    }
    var url = (window.API_URL || '/api') + '/employees';
    var headers = window.getAuthHeaders ? window.getAuthHeaders() : {};
    return fetch(url, { headers: headers })
      .then(function (r) { return r.json(); })
      .then(function (data) {
        employeeCache = Array.isArray(data) ? data : [];
        employeeCacheTime = Date.now();
        return employeeCache;
      })
      .catch(function () { return employeeCache || []; });
  }

  function getEmployeeById(id) {
    if (!employeeCache) return null;
    for (var i = 0; i < employeeCache.length; i++) {
      if (employeeCache[i].id === id) return employeeCache[i];
    }
    return null;
  }

  // === Active editor singleton ===
  var activeEditor = null;
  var activeEditorCleanup = null;

  function closeActiveEditor() {
    if (activeEditor) {
      if (activeEditor.parentNode) activeEditor.parentNode.removeChild(activeEditor);
      activeEditor = null;
    }
    if (activeEditorCleanup) {
      activeEditorCleanup();
      activeEditorCleanup = null;
    }
  }

  document.addEventListener('mousedown', function (e) {
    if (activeEditor && !activeEditor.contains(e.target)) {
      var editingCell = document.querySelector('.proagri-sheet-cell.cell-editing');
      if (editingCell && editingCell.contains(e.target)) return;
      closeActiveEditor();
    }
  });

  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') closeActiveEditor();
  });

  // === Editor positioning ===
  function positionEditor(editorEl, cellEl) {
    var rect = cellEl.getBoundingClientRect();
    document.body.appendChild(editorEl);
    editorEl.style.top = (rect.bottom + 4) + 'px';
    editorEl.style.left = rect.left + 'px';
    activeEditor = editorEl;

    requestAnimationFrame(function () {
      var edRect = editorEl.getBoundingClientRect();
      if (edRect.right > window.innerWidth - 8) {
        editorEl.style.left = Math.max(8, window.innerWidth - edRect.width - 8) + 'px';
      }
      if (edRect.bottom > window.innerHeight - 8) {
        editorEl.style.top = Math.max(8, rect.top - edRect.height - 4) + 'px';
      }
    });
  }

  // === SVG helpers ===
  function makeSvgEl(pathD, size) {
    var ns = 'http://www.w3.org/2000/svg';
    var svg = document.createElementNS(ns, 'svg');
    svg.setAttribute('width', String(size || 12));
    svg.setAttribute('height', String(size || 12));
    svg.setAttribute('viewBox', '0 0 24 24');
    svg.setAttribute('fill', 'currentColor');
    var path = document.createElementNS(ns, 'path');
    path.setAttribute('d', pathD);
    svg.appendChild(path);
    return svg;
  }

  function makeCheckSvg(size) {
    return makeSvgEl(CHECK_SVG_PATH, size || 10);
  }

  // === Format helpers ===
  function formatStatus(status) {
    if (!status) return 'Pending';
    return status.split(/[_\s]+/).map(function (w) {
      return w.charAt(0).toUpperCase() + w.slice(1).toLowerCase();
    }).join(' ');
  }

  function formatDate(dateStr) {
    if (!dateStr) return '-';
    var d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    return d.toLocaleDateString();
  }

  function formatNumber(val) {
    if (val === null || val === undefined || val === '') return '-';
    var n = Number(val);
    if (isNaN(n)) return String(val);
    return n.toLocaleString();
  }

  function statusKey(val) {
    return (val || 'pending').toLowerCase().replace(/\s+/g, '_');
  }

  // === Cell Renderers ===
  var cellRenderers = {
    text: function (cell, value) {
      cell.textContent = value || '-';
    },

    status: function (cell, value) {
      var badge = document.createElement('span');
      badge.className = 'proagri-sheet-status proagri-sheet-status-' + statusKey(value);
      badge.textContent = formatStatus(value);
      cell.appendChild(badge);
    },

    multiselect: function (cell, value) {
      var arr = Array.isArray(value) ? value : [];
      if (arr.length === 0) { cell.textContent = '-'; return; }
      var wrap = document.createElement('div');
      wrap.className = 'proagri-sheet-tags';
      var max = 3;
      for (var i = 0; i < Math.min(arr.length, max); i++) {
        var tag = document.createElement('span');
        tag.className = 'proagri-sheet-tag';
        tag.textContent = formatStatus(arr[i]);
        wrap.appendChild(tag);
      }
      if (arr.length > max) {
        var ov = document.createElement('span');
        ov.className = 'proagri-sheet-tag-overflow';
        ov.textContent = '+' + (arr.length - max);
        wrap.appendChild(ov);
      }
      cell.appendChild(wrap);
    },

    date: function (cell, value) {
      cell.textContent = formatDate(value);
    },

    person: function (cell, value) {
      var ids = Array.isArray(value) ? value : (value ? [value] : []);
      if (ids.length === 0) { cell.textContent = '-'; return; }
      var wrap = document.createElement('div');
      wrap.className = 'proagri-sheet-persons';
      var max = 3;
      for (var i = 0; i < Math.min(ids.length, max); i++) {
        var emp = getEmployeeById(ids[i]);
        if (emp && emp.photo_url) {
          var img = document.createElement('img');
          img.className = 'proagri-sheet-person-avatar';
          img.src = emp.photo_url;
          img.alt = (emp.first_name || '') + ' ' + (emp.last_name || '');
          attachPersonTooltip(img, emp);
          wrap.appendChild(img);
        } else {
          var ph = document.createElement('div');
          ph.className = 'proagri-sheet-person-avatar-placeholder';
          ph.appendChild(makeSvgEl(PERSON_SVG_PATH, 14));
          if (emp) attachPersonTooltip(ph, emp);
          wrap.appendChild(ph);
        }
      }
      if (ids.length > max) {
        var ovEl = document.createElement('div');
        ovEl.className = 'proagri-sheet-person-overflow';
        ovEl.textContent = '+' + (ids.length - max);
        wrap.appendChild(ovEl);
      }
      cell.appendChild(wrap);
    },

    number: function (cell, value) {
      cell.className += ' proagri-sheet-cell-number';
      cell.textContent = formatNumber(value);
    },

    checkbox: function (cell, value) {
      var box = document.createElement('div');
      box.className = 'proagri-sheet-checkbox' + (value ? ' checked' : '');
      box.appendChild(makeCheckSvg(12));
      cell.appendChild(box);
    }
  };

  // === Person tooltip ===
  function attachPersonTooltip(el, emp) {
    var tooltip = null;
    el.addEventListener('mouseenter', function () {
      tooltip = document.createElement('div');
      tooltip.className = 'proagri-sheet-person-tooltip';
      var nameEl = document.createElement('div');
      nameEl.className = 'proagri-sheet-person-tooltip-name';
      nameEl.textContent = (emp.first_name || '') + ' ' + (emp.last_name || '');
      tooltip.appendChild(nameEl);
      var roleEl = document.createElement('div');
      roleEl.className = 'proagri-sheet-person-tooltip-role';
      roleEl.textContent = (emp.role || 'Employee');
      tooltip.appendChild(roleEl);
      document.body.appendChild(tooltip);
      var rect = el.getBoundingClientRect();
      tooltip.style.left = rect.left + 'px';
      tooltip.style.top = (rect.top - tooltip.offsetHeight - 6) + 'px';
    });
    el.addEventListener('mouseleave', function () {
      if (tooltip && tooltip.parentNode) tooltip.parentNode.removeChild(tooltip);
      tooltip = null;
    });
  }

  // === Cell Editors ===
  function openTextEditor(cell, value, col, rowData, onSave) {
    cell.classList.add('cell-editing');
    var original = cell.textContent;
    cell.textContent = '';
    var input = document.createElement('input');
    input.className = 'proagri-sheet-text-input';
    input.type = 'text';
    input.value = value || '';
    cell.appendChild(input);
    input.focus();
    input.select();

    function save() {
      var newVal = input.value.trim();
      cell.classList.remove('cell-editing');
      cell.textContent = '';
      if (newVal !== (value || '')) {
        onSave(newVal);
      } else {
        cell.textContent = original;
      }
    }

    input.addEventListener('blur', save);
    input.addEventListener('keydown', function (e) {
      if (e.key === 'Enter') { e.preventDefault(); input.blur(); }
      if (e.key === 'Escape') { input.value = value || ''; input.blur(); }
    });

    activeEditorCleanup = function () {
      cell.classList.remove('cell-editing');
      if (input.parentNode) cell.textContent = original;
    };
  }

  function openStatusEditor(cell, value, col, rowData, onSave) {
    closeActiveEditor();
    cell.classList.add('cell-editing');
    var editor = document.createElement('div');
    editor.className = 'proagri-sheet-editor proagri-sheet-select-dropdown';
    var options = col.options || ['pending', 'in_progress', 'completed', 'overdue'];

    options.forEach(function (opt) {
      var row = document.createElement('div');
      row.className = 'proagri-sheet-select-option' + (opt === value ? ' selected' : '');
      var check = document.createElement('span');
      check.className = 'proagri-sheet-select-check';
      check.textContent = opt === value ? '\u2713' : '';
      row.appendChild(check);
      var badge = document.createElement('span');
      badge.className = 'proagri-sheet-status proagri-sheet-status-' + statusKey(opt);
      badge.textContent = formatStatus(opt);
      row.appendChild(badge);
      row.addEventListener('click', function () {
        cell.classList.remove('cell-editing');
        closeActiveEditor();
        onSave(opt);
      });
      editor.appendChild(row);
    });

    positionEditor(editor, cell);
    activeEditorCleanup = function () { cell.classList.remove('cell-editing'); };
  }

  function openMultiselectEditor(cell, value, col, rowData, onSave) {
    closeActiveEditor();
    cell.classList.add('cell-editing');
    var selected = Array.isArray(value) ? value.slice() : [];
    var options = col.options || [];
    var editor = document.createElement('div');
    editor.className = 'proagri-sheet-editor proagri-sheet-multiselect-dropdown';

    function renderOpts() {
      while (editor.firstChild) editor.removeChild(editor.firstChild);
      options.forEach(function (opt) {
        var isSel = selected.indexOf(opt) !== -1;
        var row = document.createElement('div');
        row.className = 'proagri-sheet-multiselect-option';
        var check = document.createElement('div');
        check.className = 'proagri-sheet-multiselect-check' + (isSel ? ' checked' : '');
        check.appendChild(makeCheckSvg(10));
        row.appendChild(check);
        var label = document.createElement('span');
        label.className = 'proagri-sheet-tag';
        label.textContent = formatStatus(opt);
        row.appendChild(label);
        row.addEventListener('click', function () {
          var idx = selected.indexOf(opt);
          if (idx !== -1) selected.splice(idx, 1); else selected.push(opt);
          renderOpts();
        });
        editor.appendChild(row);
      });
    }

    renderOpts();
    positionEditor(editor, cell);
    activeEditorCleanup = function () {
      cell.classList.remove('cell-editing');
      if (JSON.stringify(selected) !== JSON.stringify(Array.isArray(value) ? value : [])) onSave(selected);
    };
  }

  function openDateEditor(cell, value, col, rowData, onSave) {
    closeActiveEditor();
    cell.classList.add('cell-editing');
    var selected = value ? new Date(value) : null;
    if (selected && isNaN(selected.getTime())) selected = null;
    var viewDate = selected ? new Date(selected) : new Date();
    var editor = document.createElement('div');
    editor.className = 'proagri-sheet-editor proagri-sheet-datepicker';

    function render() {
      while (editor.firstChild) editor.removeChild(editor.firstChild);
      var hdr = document.createElement('div');
      hdr.className = 'proagri-sheet-datepicker-header';
      var prevBtn = document.createElement('button');
      prevBtn.className = 'proagri-sheet-datepicker-nav';
      prevBtn.textContent = '\u2039';
      prevBtn.addEventListener('click', function () { viewDate.setMonth(viewDate.getMonth() - 1); render(); });
      hdr.appendChild(prevBtn);
      var title = document.createElement('span');
      title.className = 'proagri-sheet-datepicker-title';
      title.textContent = MONTHS[viewDate.getMonth()] + ' ' + viewDate.getFullYear();
      hdr.appendChild(title);
      var nextBtn = document.createElement('button');
      nextBtn.className = 'proagri-sheet-datepicker-nav';
      nextBtn.textContent = '\u203A';
      nextBtn.addEventListener('click', function () { viewDate.setMonth(viewDate.getMonth() + 1); render(); });
      hdr.appendChild(nextBtn);
      editor.appendChild(hdr);

      var wkd = document.createElement('div');
      wkd.className = 'proagri-sheet-datepicker-weekdays';
      DAYS.forEach(function (d) {
        var el = document.createElement('div');
        el.className = 'proagri-sheet-datepicker-weekday';
        el.textContent = d;
        wkd.appendChild(el);
      });
      editor.appendChild(wkd);

      var grid = document.createElement('div');
      grid.className = 'proagri-sheet-datepicker-grid';
      var year = viewDate.getFullYear(), month = viewDate.getMonth();
      var firstDay = new Date(year, month, 1).getDay();
      var daysInMonth = new Date(year, month + 1, 0).getDate();
      var today = new Date();
      var prevDays = new Date(year, month, 0).getDate();

      for (var p = firstDay - 1; p >= 0; p--) {
        var pd = document.createElement('button');
        pd.className = 'proagri-sheet-datepicker-day other-month';
        pd.textContent = String(prevDays - p);
        pd.disabled = true;
        grid.appendChild(pd);
      }

      for (var d = 1; d <= daysInMonth; d++) {
        var btn = document.createElement('button');
        btn.className = 'proagri-sheet-datepicker-day';
        btn.textContent = String(d);
        if (d === today.getDate() && month === today.getMonth() && year === today.getFullYear()) btn.classList.add('today');
        if (selected && d === selected.getDate() && month === selected.getMonth() && year === selected.getFullYear()) btn.classList.add('selected');
        (function (day) {
          btn.addEventListener('click', function () {
            var ds = year + '-' + String(month + 1).padStart(2, '0') + '-' + String(day).padStart(2, '0');
            cell.classList.remove('cell-editing');
            closeActiveEditor();
            onSave(ds);
          });
        })(d);
        grid.appendChild(btn);
      }

      var total = firstDay + daysInMonth;
      var rem = (7 - (total % 7)) % 7;
      for (var n = 1; n <= rem; n++) {
        var nd = document.createElement('button');
        nd.className = 'proagri-sheet-datepicker-day other-month';
        nd.textContent = String(n);
        nd.disabled = true;
        grid.appendChild(nd);
      }
      editor.appendChild(grid);

      var actions = document.createElement('div');
      actions.className = 'proagri-sheet-datepicker-actions';
      var todayBtn = document.createElement('button');
      todayBtn.className = 'proagri-sheet-datepicker-btn proagri-sheet-datepicker-btn-primary';
      todayBtn.textContent = 'Today';
      todayBtn.addEventListener('click', function () {
        var t = new Date();
        var ds = t.getFullYear() + '-' + String(t.getMonth() + 1).padStart(2, '0') + '-' + String(t.getDate()).padStart(2, '0');
        cell.classList.remove('cell-editing'); closeActiveEditor(); onSave(ds);
      });
      actions.appendChild(todayBtn);
      var clearBtn = document.createElement('button');
      clearBtn.className = 'proagri-sheet-datepicker-btn';
      clearBtn.textContent = 'Clear';
      clearBtn.addEventListener('click', function () {
        cell.classList.remove('cell-editing'); closeActiveEditor(); onSave(null);
      });
      actions.appendChild(clearBtn);
      editor.appendChild(actions);
    }

    render();
    positionEditor(editor, cell);
    activeEditorCleanup = function () { cell.classList.remove('cell-editing'); };
  }

  function openPersonEditor(cell, value, col, rowData, onSave) {
    closeActiveEditor();
    cell.classList.add('cell-editing');
    var multiple = col.multiple !== false;
    var selected = Array.isArray(value) ? value.slice() : (value ? [value] : []);
    var editor = document.createElement('div');
    editor.className = 'proagri-sheet-editor proagri-sheet-person-picker';

    var searchWrap = document.createElement('div');
    searchWrap.className = 'proagri-sheet-person-picker-search';
    var searchInput = document.createElement('input');
    searchInput.placeholder = 'Search people...';
    searchWrap.appendChild(searchInput);
    editor.appendChild(searchWrap);

    var list = document.createElement('div');
    list.className = 'proagri-sheet-person-picker-list';
    editor.appendChild(list);

    function renderList(employees, filter) {
      while (list.firstChild) list.removeChild(list.firstChild);
      var filtered = employees;
      if (filter) {
        var term = filter.toLowerCase();
        filtered = employees.filter(function (e) {
          return (((e.first_name || '') + ' ' + (e.last_name || '')).toLowerCase().indexOf(term) !== -1) ||
            ((e.username || '').toLowerCase().indexOf(term) !== -1);
        });
      }
      if (filtered.length === 0) {
        var empty = document.createElement('div');
        empty.className = 'proagri-sheet-person-picker-empty';
        empty.textContent = filter ? 'No matches' : 'No employees';
        list.appendChild(empty);
        return;
      }
      filtered.forEach(function (emp) {
        var isSel = selected.indexOf(emp.id) !== -1;
        var item = document.createElement('div');
        item.className = 'proagri-sheet-person-picker-item' + (isSel ? ' selected' : '');
        if (emp.photo_url) {
          var img = document.createElement('img');
          img.className = 'proagri-sheet-person-picker-avatar';
          img.src = emp.photo_url;
          img.alt = '';
          item.appendChild(img);
        } else {
          var ph = document.createElement('div');
          ph.className = 'proagri-sheet-person-picker-avatar-placeholder';
          ph.appendChild(makeSvgEl(PERSON_SVG_PATH, 16));
          item.appendChild(ph);
        }
        var info = document.createElement('div');
        info.className = 'proagri-sheet-person-picker-info';
        var nm = document.createElement('div');
        nm.className = 'proagri-sheet-person-picker-name';
        nm.textContent = (emp.first_name || '') + ' ' + (emp.last_name || '');
        info.appendChild(nm);
        var rl = document.createElement('div');
        rl.className = 'proagri-sheet-person-picker-role';
        rl.textContent = emp.role || 'Employee';
        info.appendChild(rl);
        item.appendChild(info);
        var chk = document.createElement('div');
        chk.className = 'proagri-sheet-person-picker-check' + (isSel ? ' checked' : '');
        chk.appendChild(makeCheckSvg(10));
        item.appendChild(chk);
        item.addEventListener('click', function () {
          if (multiple) {
            var idx = selected.indexOf(emp.id);
            if (idx !== -1) selected.splice(idx, 1); else selected.push(emp.id);
            renderList(employees, searchInput.value);
          } else {
            cell.classList.remove('cell-editing');
            closeActiveEditor();
            onSave([emp.id]);
          }
        });
        list.appendChild(item);
      });
    }

    var loadingEl = document.createElement('div');
    loadingEl.className = 'proagri-sheet-person-picker-empty';
    loadingEl.textContent = 'Loading...';
    list.appendChild(loadingEl);

    fetchEmployees().then(function (employees) {
      renderList(employees, '');
      searchInput.addEventListener('input', function () { renderList(employees, searchInput.value); });
    });

    positionEditor(editor, cell);
    setTimeout(function () { searchInput.focus(); }, 50);

    activeEditorCleanup = function () {
      cell.classList.remove('cell-editing');
      var original = Array.isArray(value) ? value : (value ? [value] : []);
      if (JSON.stringify(selected) !== JSON.stringify(original)) onSave(selected);
    };
  }

  function openNumberEditor(cell, value, col, rowData, onSave) {
    cell.classList.add('cell-editing');
    cell.textContent = '';
    var input = document.createElement('input');
    input.className = 'proagri-sheet-text-input';
    input.type = 'number';
    input.style.textAlign = 'right';
    input.value = (value !== null && value !== undefined) ? String(value) : '';
    cell.appendChild(input);
    input.focus();
    input.select();

    function save() {
      var raw = input.value.trim();
      var newVal = raw === '' ? null : Number(raw);
      cell.classList.remove('cell-editing');
      cell.textContent = '';
      if (newVal !== value) onSave(newVal);
      else cellRenderers.number(cell, value);
    }

    input.addEventListener('blur', save);
    input.addEventListener('keydown', function (e) {
      if (e.key === 'Enter') { e.preventDefault(); input.blur(); }
      if (e.key === 'Escape') { input.value = value || ''; input.blur(); }
    });
    activeEditorCleanup = function () {
      cell.classList.remove('cell-editing');
      cell.textContent = '';
      cellRenderers.number(cell, value);
    };
  }

  // === Sort ===
  function sortData(data, key, dir, columns) {
    if (!key) return data;
    var sorted = data.slice();
    var col = null;
    for (var i = 0; i < columns.length; i++) { if (columns[i].key === key) { col = columns[i]; break; } }
    var type = col ? (col.type || 'text') : 'text';

    sorted.sort(function (a, b) {
      var va = a[key], vb = b[key];
      if (type === 'date') {
        va = va ? new Date(va).getTime() : 0; vb = vb ? new Date(vb).getTime() : 0;
      } else if (type === 'status') {
        va = STATUS_ORDER[statusKey(va)] !== undefined ? STATUS_ORDER[statusKey(va)] : 99;
        vb = STATUS_ORDER[statusKey(vb)] !== undefined ? STATUS_ORDER[statusKey(vb)] : 99;
      } else if (type === 'number') {
        va = (va !== null && va !== undefined) ? Number(va) : -Infinity;
        vb = (vb !== null && vb !== undefined) ? Number(vb) : -Infinity;
      } else if (type === 'checkbox') {
        va = va ? 1 : 0; vb = vb ? 1 : 0;
      } else if (type === 'person') {
        var ea = Array.isArray(va) && va[0] ? getEmployeeById(va[0]) : null;
        var eb = Array.isArray(vb) && vb[0] ? getEmployeeById(vb[0]) : null;
        va = ea ? ((ea.first_name || '') + ' ' + (ea.last_name || '')).toLowerCase() : '';
        vb = eb ? ((eb.first_name || '') + ' ' + (eb.last_name || '')).toLowerCase() : '';
      } else if (type === 'multiselect') {
        va = Array.isArray(va) && va[0] ? va[0].toLowerCase() : '';
        vb = Array.isArray(vb) && vb[0] ? vb[0].toLowerCase() : '';
      } else {
        va = (va || '').toString().toLowerCase(); vb = (vb || '').toString().toLowerCase();
      }
      if (va < vb) return dir === 'asc' ? -1 : 1;
      if (va > vb) return dir === 'asc' ? 1 : -1;
      return 0;
    });
    return sorted;
  }

  // === Search ===
  function filterData(data, term, columns) {
    if (!term) return data;
    var lower = term.toLowerCase();
    return data.filter(function (row) {
      for (var i = 0; i < columns.length; i++) {
        var col = columns[i], val = row[col.key], type = col.type || 'text', text = '';
        if (type === 'person') {
          var ids = Array.isArray(val) ? val : (val ? [val] : []);
          for (var j = 0; j < ids.length; j++) {
            var emp = getEmployeeById(ids[j]);
            if (emp) text += (emp.first_name || '') + ' ' + (emp.last_name || '') + ' ';
          }
        } else if (type === 'multiselect') { text = Array.isArray(val) ? val.join(' ') : '';
        } else if (type === 'date') { text = formatDate(val);
        } else if (type === 'status') { text = formatStatus(val);
        } else { text = (val || '').toString(); }
        if (text.toLowerCase().indexOf(lower) !== -1) return true;
      }
      return false;
    });
  }

  // === Main Render ===
  function renderSheet(container, config) {
    var columns = config.columns || [];
    var data = config.data;
    var radialActions = config.radialActions || [];
    var rowActions = config.rowActions || [];
    var searchable = config.searchable || false;
    var onCellEdit = config.onCellEdit || null;
    var apiEndpoint = config.apiEndpoint || null;
    var sortKey = config._sortKey || null;
    var sortDir = config._sortDir || 'asc';
    var searchTerm = config._searchTerm || '';

    // Reuse existing search input if present to preserve focus
    var existingSearch = container.querySelector('.proagri-sheet-search');
    var existingToolbar = container.querySelector('.proagri-sheet-toolbar');

    while (container.firstChild) container.removeChild(container.firstChild);
    var wrap = document.createElement('div');
    wrap.className = 'proagri-sheet-wrap';

    // Loading
    if (data === null || data === undefined) {
      var ld = document.createElement('div');
      ld.className = 'proagri-sheet-loading';
      ld.textContent = 'Loading';
      wrap.appendChild(ld);
      container.appendChild(wrap);
      return { update: function (d) { renderSheet(container, Object.assign({}, config, { data: d })); } };
    }

    // Search — reuse the existing input element to keep focus
    var si = null;
    if (searchable) {
      if (existingSearch && existingToolbar) {
        si = existingSearch;
        wrap.appendChild(existingToolbar);
      } else {
        var tb = document.createElement('div');
        tb.className = 'proagri-sheet-toolbar';
        si = document.createElement('input');
        si.className = 'proagri-sheet-search';
        si.type = 'text';
        si.placeholder = 'Search...';
        si.value = searchTerm;
        var dt = null;
        si.addEventListener('input', function () {
          clearTimeout(dt);
          dt = setTimeout(function () {
            renderSheet(container, Object.assign({}, config, { _searchTerm: si.value, _sortKey: sortKey, _sortDir: sortDir }));
          }, 200);
        });
        tb.appendChild(si);
        wrap.appendChild(tb);
      }
    }

    var filtered = filterData(data, searchTerm, columns);
    var sorted = sortData(filtered, sortKey, sortDir, columns);

    // Empty
    if (sorted.length === 0) {
      var em = document.createElement('div');
      em.className = 'proagri-sheet-empty';
      em.textContent = searchTerm ? 'No matching items' : 'No items to display';
      wrap.appendChild(em);
      container.appendChild(wrap);
      return { update: function (d) { renderSheet(container, Object.assign({}, config, { data: d })); } };
    }

    // Header
    var hr = document.createElement('div');
    hr.className = 'proagri-sheet-header';
    columns.forEach(function (col) {
      var th = document.createElement('div');
      var cls = 'proagri-sheet-header-cell';
      if (col.sortable) cls += ' sortable';
      if (col.width === 'sm') cls += ' cell-sm';
      else if (col.width === 'md') cls += ' cell-md';
      th.className = cls;
      th.textContent = col.label;
      if (col.sortable) {
        var si2 = document.createElement('span');
        si2.className = 'proagri-sheet-sort-icon' + (sortKey === col.key ? ' sort-active' : '');
        si2.textContent = sortKey === col.key ? (sortDir === 'asc' ? '\u25B2' : '\u25BC') : '\u25B2';
        th.appendChild(si2);
        th.addEventListener('click', function () {
          var nd = 'asc';
          if (sortKey === col.key) nd = sortDir === 'asc' ? 'desc' : 'asc';
          renderSheet(container, Object.assign({}, config, { _sortKey: col.key, _sortDir: nd, _searchTerm: searchTerm }));
        });
      }
      hr.appendChild(th);
    });
    if (rowActions.length > 0) {
      var ah = document.createElement('div');
      ah.className = 'proagri-sheet-header-cell proagri-sheet-actions-col';
      ah.style.flex = '0 0 ' + (rowActions.length * 28 + 8) + 'px';
      hr.appendChild(ah);
    }
    if (radialActions.length > 0) {
      var rh = document.createElement('div');
      rh.className = 'proagri-sheet-header-cell radial-col';
      hr.appendChild(rh);
    }
    wrap.appendChild(hr);

    var radialMenu = null;
    if (radialActions.length > 0 && window.RadialMenu) {
      radialMenu = new RadialMenu(wrap, { actions: radialActions });
    }

    function handleSave(rowData, col, newValue, cell) {
      var oldValue = rowData[col.key];
      rowData[col.key] = newValue;
      while (cell.firstChild) cell.removeChild(cell.firstChild);
      cell.textContent = '';
      var renderer = cellRenderers[col.type || 'text'] || cellRenderers.text;
      renderer(cell, newValue, col);
      if (onCellEdit) onCellEdit(rowData, col.key, newValue);
      if (apiEndpoint && rowData.id) {
        var url = (window.API_URL || '/api') + apiEndpoint + '/' + rowData.id;
        var hdrs = Object.assign({ 'Content-Type': 'application/json' }, window.getAuthHeaders ? window.getAuthHeaders() : {});
        var body = {};
        body[col.key] = newValue;
        fetch(url, { method: 'PATCH', headers: hdrs, body: JSON.stringify(body) })
          .then(function (res) {
            if (res.ok) { cell.classList.add('cell-saved'); setTimeout(function () { cell.classList.remove('cell-saved'); }, 600); }
            else { throw new Error('fail'); }
          })
          .catch(function () {
            rowData[col.key] = oldValue;
            while (cell.firstChild) cell.removeChild(cell.firstChild);
            cell.textContent = '';
            renderer(cell, oldValue, col);
            cell.classList.add('cell-error');
            setTimeout(function () { cell.classList.remove('cell-error'); }, 600);
          });
      } else {
        cell.classList.add('cell-saved');
        setTimeout(function () { cell.classList.remove('cell-saved'); }, 600);
      }
    }

    // Rows
    sorted.forEach(function (rowData, index) {
      var row = document.createElement('div');
      row.className = 'proagri-sheet-row';
      row.style.animationDelay = (index * 0.03) + 's';

      columns.forEach(function (col) {
        var cell = document.createElement('div');
        var cls = 'proagri-sheet-cell';
        if (col.isName) cls += ' cell-name';
        if (col.editable) cls += ' cell-editable';
        if (col.width === 'sm') cls += ' cell-sm';
        else if (col.width === 'md') cls += ' cell-md';
        cell.className = cls;
        var type = col.type || 'text';
        (cellRenderers[type] || cellRenderers.text)(cell, rowData[col.key], col);

        if (col.editable) {
          cell.addEventListener('click', function (e) {
            e.stopPropagation();
            var cv = rowData[col.key];
            var sf = function (nv) { handleSave(rowData, col, nv, cell); };
            if (type === 'checkbox') { sf(!cv); return; }
            if (type === 'text') openTextEditor(cell, cv, col, rowData, sf);
            else if (type === 'status') openStatusEditor(cell, cv, col, rowData, sf);
            else if (type === 'multiselect') openMultiselectEditor(cell, cv, col, rowData, sf);
            else if (type === 'date') openDateEditor(cell, cv, col, rowData, sf);
            else if (type === 'person') openPersonEditor(cell, cv, col, rowData, sf);
            else if (type === 'number') openNumberEditor(cell, cv, col, rowData, sf);
          });
        }
        row.appendChild(cell);
      });

      if (rowActions.length > 0) {
        var actionsCell = document.createElement('div');
        actionsCell.className = 'proagri-sheet-cell proagri-sheet-actions-col';
        actionsCell.style.flex = '0 0 ' + (rowActions.length * 28 + 8) + 'px';
        var actionsWrap = document.createElement('div');
        actionsWrap.className = 'proagri-sheet-row-actions';
        rowActions.forEach(function (action) {
          var btn = document.createElement('button');
          btn.className = 'proagri-sheet-row-action-btn' + (action.className ? ' ' + action.className : '');
          btn.title = action.tooltip || '';
          btn.type = 'button';
          if (action.icon) {
            btn.appendChild(makeSvgEl(action.icon, 14));
          }
          btn.addEventListener('click', function (e) {
            e.stopPropagation();
            if (action.onClick) action.onClick(rowData);
          });
          actionsWrap.appendChild(btn);
        });
        actionsCell.appendChild(actionsWrap);
        row.appendChild(actionsCell);
      }

      if (radialActions.length > 0) {
        var tc = document.createElement('div');
        tc.className = 'proagri-sheet-cell radial-col';
        var tr = document.createElement('span');
        tr.className = 'radial-trigger';
        tr.textContent = '\u22EF';
        tc.appendChild(tr);
        row.appendChild(tc);
        if (radialMenu) radialMenu.attachToRow(row, rowData);
      }
      wrap.appendChild(row);
    });

    container.appendChild(wrap);
    return {
      update: function (d) {
        renderSheet(container, Object.assign({}, config, { data: d, _sortKey: sortKey, _sortDir: sortDir, _searchTerm: searchTerm }));
      }
    };
  }

  window.renderSheet = renderSheet;
})();
