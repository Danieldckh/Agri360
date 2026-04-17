(function () {
  'use strict';

  // ── My View Dashboard ────────────────────────────────────────
  // Landing page shown after login. Surfaces:
  //   1. Deliverables I own (count + per-status breakdown)
  //   2. Overdue count (assigned_to === me and due_date < today)
  //   3. Unread messages (from /messaging/unread-count-total)
  //   4. The 10 most recently updated deliverables across the
  //      seven known departments (recent activity in the agency).
  //
  // There is no /api/deliverables?assigned_to=<id> endpoint, so we
  // fetch each department's deliverables via /by-department/:slug
  // in parallel, merge, de-duplicate, then filter client-side.
  // ─────────────────────────────────────────────────────────────

  var DEPT_SLUGS = ['admin', 'production', 'design', 'editorial', 'video', 'agri4all', 'social-media'];
  var pageContainer = null;

  function apiBase() { return window.API_URL || '/api'; }

  function headers() {
    var h = {};
    if (window.getAuthHeaders) {
      var auth = window.getAuthHeaders();
      for (var k in auth) { if (auth.hasOwnProperty(k)) h[k] = auth[k]; }
    }
    return h;
  }

  function fetchJson(url) {
    return fetch(url, { headers: headers() })
      .then(function (r) {
        if (!r.ok) throw new Error(url + ' -> HTTP ' + r.status);
        return r.json();
      });
  }

  function fetchDeptDeliverables(slug) {
    // Pull a 12-month window so we're not limited to the current month only.
    var now = new Date();
    var start = new Date(now.getFullYear(), now.getMonth() - 6, 1);
    var end = new Date(now.getFullYear(), now.getMonth() + 6, 1);
    function ym(d) {
      var m = d.getMonth() + 1;
      return d.getFullYear() + '-' + (m < 10 ? '0' + m : m);
    }
    var url = apiBase() + '/deliverables/by-department/' + encodeURIComponent(slug)
      + '?monthStart=' + ym(start) + '&monthEnd=' + ym(end);
    return fetchJson(url).catch(function () { return []; });
  }

  function fetchAllDeliverables() {
    return Promise.all(DEPT_SLUGS.map(fetchDeptDeliverables))
      .then(function (buckets) {
        var seen = Object.create(null);
        var merged = [];
        buckets.forEach(function (list) {
          (list || []).forEach(function (d) {
            if (!d || seen[d.id]) return;
            seen[d.id] = true;
            merged.push(d);
          });
        });
        return merged;
      });
  }

  function fetchUnreadTotal() {
    return fetchJson(apiBase() + '/messaging/unread-count-total')
      .then(function (data) { return (data && typeof data.total === 'number') ? data.total : 0; })
      .catch(function () { return 0; });
  }

  function isOverdue(deliv, today) {
    if (!deliv || !deliv.dueDate) return false;
    if (deliv.status === 'completed' || deliv.status === 'done' || deliv.status === 'complete' ||
        deliv.status === 'posted' || deliv.status === 'approved' || deliv.status === 'cancelled') {
      return false;
    }
    var due = new Date(deliv.dueDate);
    if (isNaN(due.getTime())) return false;
    return due < today;
  }

  function prettyStatus(s) {
    if (!s) return '—';
    return String(s).replace(/_/g, ' ').replace(/\b\w/g, function (c) { return c.toUpperCase(); });
  }

  function makeStatCard(label, value, sub, variant) {
    var card = document.createElement('div');
    card.className = 'my-view-stat-card' + (variant ? ' my-view-stat-' + variant : '');
    var l = document.createElement('div');
    l.className = 'my-view-stat-label';
    l.textContent = label;
    card.appendChild(l);
    var v = document.createElement('div');
    v.className = 'my-view-stat-value';
    v.textContent = String(value);
    card.appendChild(v);
    if (sub) {
      if (typeof sub === 'string') {
        var s = document.createElement('div');
        s.className = 'my-view-stat-sub';
        s.textContent = sub;
        card.appendChild(s);
      } else {
        card.appendChild(sub);
      }
    }
    return card;
  }

  function buildStatusChips(statusCounts) {
    var keys = Object.keys(statusCounts).sort(function (a, b) {
      return statusCounts[b] - statusCounts[a];
    });
    if (keys.length === 0) return null;
    var wrap = document.createElement('div');
    wrap.className = 'my-view-status-chips';
    keys.slice(0, 5).forEach(function (k) {
      var chip = document.createElement('span');
      chip.className = 'my-view-status-chip';
      chip.textContent = prettyStatus(k) + ' · ' + statusCounts[k];
      wrap.appendChild(chip);
    });
    return wrap;
  }

  function renderError(msg) {
    if (!pageContainer) return;
    pageContainer.innerHTML = '';
    var page = document.createElement('div');
    page.className = 'my-view-page';
    var err = document.createElement('div');
    err.className = 'my-view-error';
    err.textContent = msg;
    page.appendChild(err);
    pageContainer.appendChild(page);
  }

  function render(state) {
    if (!pageContainer) return;
    pageContainer.innerHTML = '';

    var user = (window.getCurrentUser && window.getCurrentUser()) || {};
    var firstName = user.firstName || user.username || 'there';

    var page = document.createElement('div');
    page.className = 'my-view-page';

    // Header
    var hdr = document.createElement('div');
    hdr.className = 'my-view-header';
    var h2 = document.createElement('h2');
    h2.textContent = 'My View';
    hdr.appendChild(h2);
    var greeting = document.createElement('span');
    greeting.className = 'my-view-greeting';
    greeting.textContent = 'Welcome back, ' + firstName + '.';
    hdr.appendChild(greeting);
    page.appendChild(hdr);

    // Stat cards
    var stats = document.createElement('div');
    stats.className = 'my-view-stats';

    var ownedSub = buildStatusChips(state.ownedByStatus);
    stats.appendChild(makeStatCard('Deliverables I Own', state.ownedCount, ownedSub || 'Nothing assigned to you yet.', 'accent'));
    stats.appendChild(makeStatCard('Overdue', state.overdueCount,
      state.overdueCount > 0 ? 'Past due and still open' : 'All caught up',
      state.overdueCount > 0 ? 'alert' : null));
    stats.appendChild(makeStatCard('Unread Messages', state.unreadCount,
      state.unreadCount > 0 ? 'Across all channels' : 'Inbox is clear'));
    page.appendChild(stats);

    // Recent deliverables
    var section = document.createElement('div');
    section.className = 'my-view-section';

    var secHdr = document.createElement('div');
    secHdr.className = 'my-view-section-header';
    var secTitle = document.createElement('h3');
    secTitle.textContent = 'Recent Deliverables';
    secHdr.appendChild(secTitle);
    var secSub = document.createElement('span');
    secSub.className = 'my-view-section-sub';
    secSub.textContent = 'Last 10 updated across all departments';
    secHdr.appendChild(secSub);
    section.appendChild(secHdr);

    var sheetEl = document.createElement('div');
    section.appendChild(sheetEl);

    if (!state.recent || state.recent.length === 0) {
      var empty = document.createElement('div');
      empty.className = 'my-view-empty';
      empty.textContent = 'No recent deliverables to show.';
      sheetEl.appendChild(empty);
    } else if (typeof window.renderSheet === 'function') {
      var columns = [
        { key: 'title', label: 'Title', isName: true, sortable: true, wrap: true },
        { key: 'type', label: 'Type', sortable: true },
        { key: 'status', label: 'Status', type: 'status', sortable: true },
        { key: 'departmentName', label: 'Department', sortable: true },
        { key: 'clientName', label: 'Client', sortable: true },
        { key: 'dueDate', label: 'Due Date', type: 'date', sortable: true },
        { key: 'updatedAt', label: 'Updated', type: 'date', sortable: true }
      ];
      window.renderSheet(sheetEl, {
        columns: columns,
        data: state.recent,
        searchable: false
      });
    } else {
      // Degraded fallback if the sheet component didn't load.
      var table = document.createElement('table');
      table.style.width = '100%';
      table.innerHTML = '<thead><tr>'
        + '<th style="text-align:left">Title</th>'
        + '<th style="text-align:left">Status</th>'
        + '<th style="text-align:left">Department</th>'
        + '<th style="text-align:left">Client</th>'
        + '</tr></thead>';
      var tbody = document.createElement('tbody');
      state.recent.forEach(function (d) {
        var tr = document.createElement('tr');
        tr.innerHTML = '<td>' + (d.title || '—') + '</td>'
          + '<td>' + prettyStatus(d.status) + '</td>'
          + '<td>' + (d.departmentName || '—') + '</td>'
          + '<td>' + (d.clientName || '—') + '</td>';
        tbody.appendChild(tr);
      });
      table.appendChild(tbody);
      sheetEl.appendChild(table);
    }

    page.appendChild(section);
    pageContainer.appendChild(page);
  }

  function renderLoading() {
    render({
      ownedCount: 0,
      ownedByStatus: {},
      overdueCount: 0,
      unreadCount: 0,
      recent: []
    });
  }

  function refresh() {
    renderLoading();
    var user = (window.getCurrentUser && window.getCurrentUser()) || {};
    var myId = user.id;

    Promise.all([
      fetchAllDeliverables(),
      fetchUnreadTotal()
    ]).then(function (results) {
      var all = results[0] || [];
      var unread = results[1] || 0;

      var today = new Date();
      today.setHours(0, 0, 0, 0);

      var owned = all.filter(function (d) {
        return d && (d.assignedTo === myId || String(d.assignedTo) === String(myId));
      });
      var ownedByStatus = {};
      owned.forEach(function (d) {
        var k = d.status || 'unassigned';
        ownedByStatus[k] = (ownedByStatus[k] || 0) + 1;
      });
      var overdueCount = owned.filter(function (d) { return isOverdue(d, today); }).length;

      var recent = all.slice().sort(function (a, b) {
        var ta = a && a.updatedAt ? new Date(a.updatedAt).getTime() : 0;
        var tb = b && b.updatedAt ? new Date(b.updatedAt).getTime() : 0;
        return tb - ta;
      }).slice(0, 10);

      render({
        ownedCount: owned.length,
        ownedByStatus: ownedByStatus,
        overdueCount: overdueCount,
        unreadCount: unread,
        recent: recent
      });
    }).catch(function (err) {
      console.error('[my-view] failed to load dashboard', err);
      renderError('Could not load dashboard. Please refresh.');
    });
  }

  window.renderMyViewPage = function (container) {
    pageContainer = container;
    refresh();
  };
})();
