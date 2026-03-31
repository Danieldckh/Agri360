(function () {
  'use strict';

  var API_BASE = '/api/dashboards';

  function getHeaders() {
    var h = { 'Content-Type': 'application/json' };
    if (window.getAuthHeaders) {
      var auth = window.getAuthHeaders();
      for (var key in auth) if (auth.hasOwnProperty(key)) h[key] = auth[key];
    }
    return h;
  }

  function formatDate(iso) {
    if (!iso) return '—';
    var d = new Date(iso);
    return d.toLocaleDateString('en-ZA', { day: 'numeric', month: 'short', year: 'numeric' });
  }

  function initDashboardsPage(container) {
    var grid = container.querySelector('#dashboards-grid');
    var detailView = container.querySelector('#dashboard-detail');
    var listView = container.querySelector('.dev-page');
    var backBtn = container.querySelector('#dashboard-back-btn');

    backBtn.addEventListener('click', function () {
      detailView.style.display = 'none';
      listView.style.display = '';
    });

    fetch(API_BASE, { headers: getHeaders() })
      .then(function (res) {
        if (!res.ok) throw new Error('Failed to fetch dashboards');
        return res.json();
      })
      .then(function (dashboards) {
        if (dashboards.length === 0) {
          grid.innerHTML = '<div class="dev-db-empty">No dashboards found</div>';
          return;
        }

        var items = dashboards.map(function (db) {
          return {
            title: db.title,
            deliverableType: db.deliverableType || 'general',
            status: db.status || 'active',
            createdDate: 'Created ' + formatDate(db.createdAt),
            _raw: db
          };
        });

        bindList(grid, 'dashboard-card-tmpl', items, function (el, item) {
          var badges = el.querySelectorAll('.dev-dashboard-badge');
          if (badges[1]) badges[1].className = 'dev-dashboard-badge dev-dashboard-badge--' + item.status;

          el.addEventListener('click', function () {
            openDetail(container, item._raw);
          });
        });
      })
      .catch(function (err) {
        grid.innerHTML = '<div class="dev-db-empty">Error loading dashboards: ' + err.message + '</div>';
      });
  }

  function openDetail(container, db) {
    var listView = container.querySelector('.dev-page');
    var detailView = container.querySelector('#dashboard-detail');

    if ((db.deliverableType === 'content-calendar' || db.deliverableType === 'agri4all-posts') && window.renderContentCalendarPage) {
      var parent = container;
      while (parent.firstChild) parent.removeChild(parent.firstChild);
      window.renderContentCalendarPage(parent, db.title);
      return;
    }

    listView.style.display = 'none';
    detailView.style.display = '';

    container.querySelector('#dashboard-detail-title').textContent = db.title;

    var data = {
      id: db.id || '—',
      deliverableType: db.deliverableType || '—',
      status: db.status || '—',
      departmentId: db.departmentId || '—',
      deliverableId: db.deliverableId || '—',
      createdDate: formatDate(db.createdAt)
    };

    bindData(detailView, data);
  }

  window.initDashboardsPage = initDashboardsPage;
})();
