(function () {
  'use strict';

  var API_BASE = '/api/dashboards';

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

  function formatDate(iso) {
    if (!iso) return '—';
    var d = new Date(iso);
    return d.toLocaleDateString('en-ZA', { day: 'numeric', month: 'short', year: 'numeric' });
  }

  function renderDashboardsPage(container) {
    container.style.display = '';
    container.style.alignItems = '';
    container.style.justifyContent = '';
    container.style.flexDirection = '';
    container.style.height = '';
    container.style.gap = '';
    container.style.padding = '';

    var page = document.createElement('div');
    page.className = 'dev-page';

    // Header
    var header = document.createElement('div');
    header.className = 'dev-page-header';
    var title = document.createElement('h2');
    title.className = 'dev-page-title';
    title.textContent = 'Dashboards';
    header.appendChild(title);
    page.appendChild(header);

    // Loading state
    var grid = document.createElement('div');
    grid.className = 'dev-dashboards-grid';
    grid.innerHTML = '<div class="dev-db-empty">Loading dashboards...</div>';
    page.appendChild(grid);

    container.appendChild(page);

    // Fetch dashboards
    fetch(API_BASE, { headers: getHeaders() })
      .then(function (res) {
        if (!res.ok) throw new Error('Failed to fetch dashboards');
        return res.json();
      })
      .then(function (dashboards) {
        grid.innerHTML = '';

        if (dashboards.length === 0) {
          grid.innerHTML = '<div class="dev-db-empty">No dashboards found</div>';
          return;
        }

        dashboards.forEach(function (db) {
          var card = document.createElement('div');
          card.className = 'dev-dashboard-card';
          card.addEventListener('click', function () {
            if ((db.deliverableType === 'content-calendar' || db.deliverableType === 'agri4all-posts') && window.renderContentCalendarPage) {
              while (container.firstChild) container.removeChild(container.firstChild);
              window.renderContentCalendarPage(container, db.title);
            } else {
              openDashboard(container, db);
            }
          });

          var cardTitle = document.createElement('div');
          cardTitle.className = 'dev-dashboard-card-title';
          cardTitle.textContent = db.title;
          card.appendChild(cardTitle);

          var meta = document.createElement('div');
          meta.className = 'dev-dashboard-card-meta';

          var typeBadge = document.createElement('span');
          typeBadge.className = 'dev-dashboard-badge';
          typeBadge.textContent = db.deliverableType || 'general';
          meta.appendChild(typeBadge);

          var statusBadge = document.createElement('span');
          statusBadge.className = 'dev-dashboard-badge dev-dashboard-badge--' + (db.status || 'active');
          statusBadge.textContent = db.status || 'active';
          meta.appendChild(statusBadge);

          card.appendChild(meta);

          var date = document.createElement('div');
          date.className = 'dev-dashboard-card-date';
          date.textContent = 'Created ' + formatDate(db.createdAt);
          card.appendChild(date);

          grid.appendChild(card);
        });
      })
      .catch(function (err) {
        grid.innerHTML = '<div class="dev-db-empty">Error loading dashboards: ' + err.message + '</div>';
      });
  }

  function openDashboard(container, db) {
    while (container.firstChild) container.removeChild(container.firstChild);

    container.style.display = '';
    container.style.alignItems = '';
    container.style.justifyContent = '';
    container.style.flexDirection = '';
    container.style.height = '';
    container.style.gap = '';
    container.style.padding = '';

    var page = document.createElement('div');
    page.className = 'dev-page';

    // Header with back button
    var header = document.createElement('div');
    header.className = 'dev-page-header';

    var titleWrap = document.createElement('div');
    titleWrap.style.display = 'flex';
    titleWrap.style.alignItems = 'center';
    titleWrap.style.gap = '12px';

    var backBtn = document.createElement('button');
    backBtn.className = 'dev-btn dev-btn-ghost';
    backBtn.innerHTML = '&larr; Back';
    backBtn.addEventListener('click', function () {
      while (container.firstChild) container.removeChild(container.firstChild);
      renderDashboardsPage(container);
    });
    titleWrap.appendChild(backBtn);

    var title = document.createElement('h2');
    title.className = 'dev-page-title';
    title.textContent = db.title;
    titleWrap.appendChild(title);

    header.appendChild(titleWrap);
    page.appendChild(header);

    // Dashboard detail - placeholder for template building
    var content = document.createElement('div');
    content.className = 'dev-dashboard-detail';

    var info = document.createElement('div');
    info.className = 'dev-section';
    info.innerHTML =
      '<div class="dev-section-title">Dashboard Info</div>' +
      '<table class="dev-var-list">' +
      '<tr><td class="dev-var-name">ID</td><td class="dev-var-value">' + db.id + '</td></tr>' +
      '<tr><td class="dev-var-name">Type</td><td class="dev-var-value">' + (db.deliverableType || '—') + '</td></tr>' +
      '<tr><td class="dev-var-name">Status</td><td class="dev-var-value">' + (db.status || '—') + '</td></tr>' +
      '<tr><td class="dev-var-name">Department ID</td><td class="dev-var-value">' + (db.departmentId || '—') + '</td></tr>' +
      '<tr><td class="dev-var-name">Deliverable ID</td><td class="dev-var-value">' + (db.deliverableId || '—') + '</td></tr>' +
      '<tr><td class="dev-var-name">Created</td><td class="dev-var-value">' + formatDate(db.createdAt) + '</td></tr>' +
      '</table>';
    content.appendChild(info);

    var templateArea = document.createElement('div');
    templateArea.className = 'dev-section';
    templateArea.innerHTML =
      '<div class="dev-section-title">Template Preview</div>' +
      '<div class="dev-dashboard-template-placeholder">' +
      '<span class="page-placeholder">Dashboard template area — build your layout here</span>' +
      '</div>';
    content.appendChild(templateArea);

    page.appendChild(content);
    container.appendChild(page);
  }

  window.renderDashboardsPage = renderDashboardsPage;
})();
