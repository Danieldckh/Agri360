(function () {
  'use strict';

  // ── Design Department Page ────────────────────────────────────────
  // Greenfield department page with a top subnav:
  //   • Content Calendars (75/25 split: Design | Design Review)
  //   • Design Review     (stub)
  //   • All Deliverables  (stub)
  //
  // Reuses global CSS/helpers from production-page and shared runtime:
  //   - window.DELIVERABLE_WORKFLOWS.getStatusChain / getNextStatus
  //   - window._fetchEmployees / window._employeeCacheLookup (if present)
  //   - window.getAuthHeaders / window.getCurrentUser
  //   - .dept-sheet-card / .proagri-sheet-status-* / .dept-month-selector CSS
  // ─────────────────────────────────────────────────────────────────

  var API_BASE = '/api/deliverables';
  var MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'];
  var SHORT_MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
    'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  var ICON_ADVANCE = 'M12 4l-1.41 1.41L16.17 11H4v2h12.17l-5.58 5.59L12 20l8-8z';
  var ICON_BACK = 'M12 20l1.41-1.41L7.83 13H20v-2H7.83l5.58-5.59L12 4l-8 8z';
  var ICON_EYE = 'M12 4.5C7 4.5 2.73 7.61 1 12c1.73 4.39 6 7.5 11 7.5s9.27-3.11 11-7.5c-1.73-4.39-6-7.5-11-7.5zM12 17c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5zm0-8c-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3-1.34-3-3-3z';

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

  function formatStatus(status) {
    if (!status) return 'Pending';
    return status.replace(/_/g, ' ').replace(/\b\w/g, function (c) { return c.toUpperCase(); });
  }

  function statusClass(status) {
    var s = (status || 'pending').toLowerCase().replace(/\s+/g, '_');
    return 'proagri-sheet-status-' + s;
  }

  function empFullName(e) {
    if (!e) return '';
    return ((e.first_name || e.firstName || '') + ' ' + (e.last_name || e.lastName || '')).trim() || e.username || '';
  }

  function empInitials(e) {
    if (!e) return '';
    var fn = e.first_name || e.firstName || '';
    var ln = e.last_name || e.lastName || '';
    var i = (fn.charAt(0) || '') + (ln.charAt(0) || '');
    if (!i && e.username) i = e.username.charAt(0).toUpperCase();
    return i.toUpperCase();
  }

  // Format date like "Dec 31"
  function formatShortDate(dateStr) {
    if (!dateStr) return '';
    var d = new Date(dateStr);
    if (isNaN(d.getTime())) return '';
    return SHORT_MONTHS[d.getMonth()] + ' ' + d.getDate();
  }

  // End-of-month fallback from a YYYY-MM (or YYYY-MM-DD) string
  function endOfMonthFromYM(ym) {
    if (!ym) return '';
    var m = String(ym).match(/^(\d{4})-(\d{2})/);
    if (!m) return '';
    var year = parseInt(m[1], 10);
    var month = parseInt(m[2], 10);
    // Day 0 of next month = last day of current month
    var d = new Date(year, month, 0);
    return SHORT_MONTHS[d.getMonth()] + ' ' + d.getDate();
  }

  function deliverableDeadline(item) {
    if (item.dueDate) return formatShortDate(item.dueDate);
    if (item.deliveryMonth) return endOfMonthFromYM(item.deliveryMonth);
    return '—';
  }

  // ── Shared month selector ───────────────────────────────────────
  function buildMonthSelector(onMonthChange) {
    var bar = document.createElement('div');
    bar.className = 'dept-month-selector';
    var prev = document.createElement('button');
    prev.className = 'dept-month-nav';
    prev.type = 'button';
    prev.textContent = '\u25C0';
    var label = document.createElement('span');
    label.className = 'dept-month-label';
    var next = document.createElement('button');
    next.className = 'dept-month-nav';
    next.type = 'button';
    next.textContent = '\u25B6';
    bar.appendChild(prev);
    bar.appendChild(label);
    bar.appendChild(next);

    var now = new Date();
    var year = now.getFullYear();
    var month = now.getMonth() + 1;

    function pad(n) { return n < 10 ? '0' + n : '' + n; }
    function ym() { return year + '-' + pad(month); }
    function update() {
      label.textContent = MONTH_NAMES[month - 1] + ' ' + year;
      onMonthChange(ym());
    }
    prev.addEventListener('click', function () {
      month--;
      if (month < 1) { month = 12; year--; }
      update();
    });
    next.addEventListener('click', function () {
      month++;
      if (month > 12) { month = 1; year++; }
      update();
    });

    // Kick off with current month
    setTimeout(update, 0);

    return { el: bar, getMonth: ym };
  }

  // ── Employee picker modal (inlined — not exposed by production-page) ──
  function openEmployeePicker(currentId, onSelect) {
    var existing = document.querySelector('.emp-picker-overlay');
    if (existing) existing.remove();

    var overlay = document.createElement('div');
    overlay.className = 'emp-picker-overlay';
    var modal = document.createElement('div');
    modal.className = 'emp-picker-modal';

    var title = document.createElement('h3');
    title.className = 'emp-picker-title';
    title.textContent = 'Assign Designer';
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

    var empPromise = window._fetchEmployees
      ? window._fetchEmployees()
      : fetch('/api/employees', { headers: getHeaders() }).then(function (r) { return r.json(); });

    empPromise.then(function (employees) {
      var currentUser = window.getCurrentUser ? window.getCurrentUser() : null;
      var sorted = (employees || []).slice().sort(function (a, b) {
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

          var av = document.createElement('div');
          av.className = 'design-cc-avatar';
          if (emp.photo_url) {
            var img = document.createElement('img');
            img.src = emp.photo_url;
            img.alt = empFullName(emp);
            av.appendChild(img);
          } else {
            av.textContent = empInitials(emp);
          }
          row.appendChild(av);

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
    }).catch(function (err) {
      console.error('[design] employee fetch failed:', err);
    });
  }

  // ── One design sheet (design or design_review) ──────────────────
  // Returns { el, setData(items) }
  function buildDesignSheet(options) {
    options = options || {};
    var title = options.title || 'Sheet';
    var targetStatus = options.targetStatus;
    var onRefresh = options.onRefresh || function () {};
    var tabContainer = options.tabContainer;

    var card = document.createElement('div');
    card.className = 'dept-sheet-card design-cc-sheet';

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
    card.appendChild(headerBar);

    var body = document.createElement('div');
    body.className = 'design-cc-body';
    card.appendChild(body);

    var currentItems = [];

    function render() {
      while (body.firstChild) body.removeChild(body.firstChild);
      countBadge.textContent = currentItems.length;

      if (currentItems.length === 0) {
        var empty = document.createElement('div');
        empty.className = 'design-cc-empty';
        empty.textContent = 'No items';
        body.appendChild(empty);
        return;
      }

      currentItems.forEach(function (item) {
        body.appendChild(buildRow(item));
      });
    }

    function buildRow(item) {
      var row = document.createElement('div');
      row.className = 'design-cc-row';

      // 1. Eye icon
      var eyeCell = document.createElement('div');
      eyeCell.className = 'design-cc-cell design-cc-cell-eye';
      var eyeBtn = document.createElement('button');
      eyeBtn.type = 'button';
      eyeBtn.className = 'design-cc-icon-btn';
      eyeBtn.title = 'Open dashboard';
      eyeBtn.appendChild(makeSvgIcon(ICON_EYE));
      eyeBtn.addEventListener('click', function (e) {
        e.stopPropagation();
        if (typeof window.openContentCalendarDashboard === 'function') {
          window.openContentCalendarDashboard(tabContainer, item);
        } else {
          console.warn('[design] window.openContentCalendarDashboard not exposed — eye click no-op');
        }
      });
      eyeCell.appendChild(eyeBtn);
      row.appendChild(eyeCell);

      // 2. Designer avatar
      var avCell = document.createElement('div');
      avCell.className = 'design-cc-cell design-cc-cell-avatar';
      var assignedId = item.assignedDesign;
      var av = document.createElement('button');
      av.type = 'button';
      av.className = 'design-cc-avatar';
      var emp = (assignedId && window._employeeCacheLookup) ? window._employeeCacheLookup(assignedId) : null;
      if (emp && emp.photo_url) {
        var img = document.createElement('img');
        img.src = emp.photo_url;
        img.alt = empFullName(emp);
        av.appendChild(img);
        av.title = empFullName(emp);
      } else if (emp) {
        av.textContent = empInitials(emp);
        av.title = empFullName(emp);
      } else {
        av.classList.add('design-cc-avatar-empty');
        av.textContent = '+';
        av.title = 'Assign designer';
      }
      av.addEventListener('click', function (e) {
        e.stopPropagation();
        openEmployeePicker(assignedId, function (newId) {
          fetch(API_BASE + '/' + item.id, {
            method: 'PATCH',
            headers: getHeaders(),
            body: JSON.stringify({ assignedDesign: newId })
          }).then(function (res) {
            if (res.ok) onRefresh();
          });
        });
      });
      avCell.appendChild(av);
      row.appendChild(avCell);

      // 3. Client name
      var clientCell = document.createElement('div');
      clientCell.className = 'design-cc-cell design-cc-cell-client';
      clientCell.textContent = item.clientName || '—';
      clientCell.title = item.clientName || '';
      row.appendChild(clientCell);

      // 4. Deadline
      var dueCell = document.createElement('div');
      dueCell.className = 'design-cc-cell design-cc-cell-deadline';
      dueCell.textContent = deliverableDeadline(item);
      row.appendChild(dueCell);

      // 5. Status badge
      var statusCell = document.createElement('div');
      statusCell.className = 'design-cc-cell design-cc-cell-status';
      var badge = document.createElement('span');
      badge.className = 'proagri-sheet-status ' + statusClass(item.status);
      badge.textContent = formatStatus(item.status);
      statusCell.appendChild(badge);
      row.appendChild(statusCell);

      // 6. Advance + back arrows
      var actCell = document.createElement('div');
      actCell.className = 'design-cc-cell design-cc-cell-actions';

      var wf = window.DELIVERABLE_WORKFLOWS;
      var chain = (wf && wf.getStatusChain) ? (wf.getStatusChain(item.type) || []) : [];
      var idx = chain.indexOf(item.status);

      // Back button
      if (idx > 0) {
        var backTarget = chain[idx - 1];
        var backBtn = document.createElement('button');
        backBtn.type = 'button';
        backBtn.className = 'design-cc-icon-btn design-cc-back-btn';
        backBtn.title = 'Send back: ' + formatStatus(backTarget);
        backBtn.appendChild(makeSvgIcon(ICON_BACK));
        backBtn.addEventListener('click', function (e) {
          e.stopPropagation();
          fetch(API_BASE + '/' + item.id, {
            method: 'PATCH',
            headers: getHeaders(),
            body: JSON.stringify({ status: backTarget })
          }).then(function (res) { if (res.ok) onRefresh(); });
        });
        actCell.appendChild(backBtn);
      }

      // Forward button — use workflow helper so branch handling matches
      var nextInfo = (wf && wf.getNextStatus) ? wf.getNextStatus(item.type, item.status) : null;
      if (nextInfo && nextInfo.next) {
        var fwdBtn = document.createElement('button');
        fwdBtn.type = 'button';
        fwdBtn.className = 'design-cc-icon-btn design-cc-fwd-btn';
        fwdBtn.title = nextInfo.tooltip || ('Advance to: ' + formatStatus(nextInfo.next));
        fwdBtn.appendChild(makeSvgIcon(ICON_ADVANCE));
        fwdBtn.addEventListener('click', function (e) {
          e.stopPropagation();
          fetch(API_BASE + '/' + item.id, {
            method: 'PATCH',
            headers: getHeaders(),
            body: JSON.stringify({ status: nextInfo.next })
          }).then(function (res) { if (res.ok) onRefresh(); });
        });
        actCell.appendChild(fwdBtn);
      }

      row.appendChild(actCell);

      return row;
    }

    function setData(items) {
      currentItems = (items || []).filter(function (it) {
        return it.type === 'sm-content-calendar' && it.status === targetStatus;
      });
      render();
    }

    return { el: card, setData: setData, getTarget: function () { return targetStatus; } };
  }

  // ── Content Calendars tab ───────────────────────────────────────
  function renderDesignCCTab(container) {
    while (container.firstChild) container.removeChild(container.firstChild);

    var wrapper = document.createElement('div');
    wrapper.className = 'design-cc-wrapper';

    var layout = document.createElement('div');
    layout.className = 'design-cc-layout';

    var leftCol = document.createElement('div');
    leftCol.className = 'design-cc-col design-cc-col-left';
    var rightCol = document.createElement('div');
    rightCol.className = 'design-cc-col design-cc-col-right';

    layout.appendChild(leftCol);
    layout.appendChild(rightCol);

    var currentMonth = '';
    var leftSheet, rightSheet;

    function fetchAndFill() {
      if (!currentMonth) return;
      var url = API_BASE + '/by-department/design?month=' + currentMonth;
      var empPromise = window._fetchEmployees ? window._fetchEmployees() : Promise.resolve([]);
      Promise.all([
        empPromise,
        fetch(url, { headers: getHeaders() }).then(function (r) { return r.json(); })
      ]).then(function (results) {
        var items = results[1] || [];
        leftSheet.setData(items);
        rightSheet.setData(items);
      }).catch(function (err) {
        console.error('[design] fetch error:', err);
      });
    }

    var selector = buildMonthSelector(function (ym) {
      currentMonth = ym;
      fetchAndFill();
    });
    wrapper.appendChild(selector.el);
    wrapper.appendChild(layout);

    leftSheet = buildDesignSheet({
      title: 'Design',
      targetStatus: 'design',
      tabContainer: container,
      onRefresh: fetchAndFill
    });
    rightSheet = buildDesignSheet({
      title: 'Design Review',
      targetStatus: 'design_review',
      tabContainer: container,
      onRefresh: fetchAndFill
    });

    leftCol.appendChild(leftSheet.el);
    rightCol.appendChild(rightSheet.el);

    container.appendChild(wrapper);
  }

  // ── Stub tabs ──────────────────────────────────────────────────
  function renderDesignReviewStub(container) {
    while (container.firstChild) container.removeChild(container.firstChild);
    var card = document.createElement('div');
    card.className = 'design-stub-card';
    card.textContent = 'Design Review — coming soon';
    container.appendChild(card);
  }

  function renderAllDeliverablesStub(container) {
    while (container.firstChild) container.removeChild(container.firstChild);
    var card = document.createElement('div');
    card.className = 'design-stub-card';
    card.textContent = 'All Deliverables — coming soon';
    container.appendChild(card);
  }

  // ── Main page renderer ─────────────────────────────────────────
  function renderDesignPage(container) {
    while (container.firstChild) container.removeChild(container.firstChild);

    // Reset flex styles the dept dashboard may have set
    container.style.display = 'block';
    container.style.padding = '0';
    container.style.height = '100%';

    var page = document.createElement('div');
    page.className = 'design-page';

    var subnav = document.createElement('nav');
    subnav.className = 'design-subnav';

    var tabs = [
      { key: 'content-calendars', label: 'Content Calendars', render: renderDesignCCTab },
      { key: 'review', label: 'Design Review', render: renderDesignReviewStub },
      { key: 'all', label: 'All Deliverables', render: renderAllDeliverablesStub }
    ];

    var content = document.createElement('div');
    content.className = 'design-content';

    var tabButtons = [];
    tabs.forEach(function (tab) {
      var btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'design-tab';
      btn.dataset.tab = tab.key;
      btn.textContent = tab.label;
      btn.addEventListener('click', function () {
        tabButtons.forEach(function (b) { b.classList.remove('active'); });
        btn.classList.add('active');
        tab.render(content);
      });
      subnav.appendChild(btn);
      tabButtons.push(btn);
    });

    page.appendChild(subnav);
    page.appendChild(content);
    container.appendChild(page);

    // Default: first tab
    tabButtons[0].classList.add('active');
    tabs[0].render(content);
  }

  window.renderDesignPage = renderDesignPage;
})();
