(function () {
  'use strict';

  var API_BASE = '/api/dashboards';

  function formatDate(iso) {
    if (!iso) return '—';
    var d = new Date(iso);
    return d.toLocaleDateString('en-ZA', { day: 'numeric', month: 'short', year: 'numeric' });
  }

  function initDashboardsPage(container) {
    var grid = container.querySelector('#dashboards-grid');
    var detailView = container.querySelector('#dashboard-detail');
    var listView = container.querySelector('#dashboards-list');
    var backBtn = container.querySelector('#dashboard-back-btn');
    var dashboardsById = {};

    backBtn.addEventListener('click', function () {
      detailView.classList.add('hidden');
      listView.classList.remove('hidden');
    });

    var headers = window.getAuthHeaders ? window.getAuthHeaders() : {};
    fetch(API_BASE, { headers: headers })
      .then(function (res) {
        if (!res.ok) throw new Error('Failed to fetch dashboards');
        return res.json();
      })
      .then(function (dashboards) {
        if (dashboards.length === 0) {
          grid.innerHTML = '<div class="dev-db-empty">No dashboards found</div>';
          return;
        }

        dashboards.forEach(function (db) { dashboardsById[db.id] = db; });

        var items = dashboards.map(function (db) {
          return {
            id: String(db.id),
            title: db.title,
            deliverableType: db.deliverableType || 'general',
            status: db.status || 'active',
            createdDate: 'Created ' + formatDate(db.createdAt)
          };
        });

        bindList(grid, 'dashboard-card-tmpl', items, function (el, item) {
          var badge = el.querySelector('.dev-dashboard-badge:last-child');
          if (badge) badge.className = 'dev-dashboard-badge dev-dashboard-badge--' + item.status;

          el.addEventListener('click', function () {
            openDetail(container, dashboardsById[item.id]);
          });
        });
      })
      .catch(function (err) {
        grid.innerHTML = '<div class="dev-db-empty">Error: ' + err.message + '</div>';
      });
  }

  function openDetail(container, db) {
    var listView = container.querySelector('#dashboards-list');
    var detailView = container.querySelector('#dashboard-detail');

    if ((db.deliverableType === 'content-calendar' || db.deliverableType === 'agri4all-posts') && window.renderContentCalendarPage) {
      while (container.firstChild) container.removeChild(container.firstChild);
      window.renderContentCalendarPage(container, db.title);
      return;
    }

    listView.classList.add('hidden');
    detailView.classList.remove('hidden');

    container.querySelector('#dashboard-detail-title').textContent = db.title;

    bindData(detailView, {
      id: db.id || '—',
      deliverableType: db.deliverableType || '—',
      status: db.status || '—',
      departmentId: db.departmentId || '—',
      deliverableId: db.deliverableId || '—',
      createdDate: formatDate(db.createdAt)
    });
  }

  window.initDashboardsPage = initDashboardsPage;
})();
