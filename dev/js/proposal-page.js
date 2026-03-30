(function () {
  'use strict';

  var API_BASE = '/api/booking-forms';

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

  // JSON tree renderer with collapsible sections
  function renderJsonTree(data, depth) {
    depth = depth || 0;
    var wrap = document.createElement('div');
    wrap.className = 'json-tree';

    if (data === null || data === undefined) {
      var nullEl = document.createElement('span');
      nullEl.className = 'json-null';
      nullEl.textContent = 'null';
      wrap.appendChild(nullEl);
      return wrap;
    }

    if (typeof data !== 'object') {
      var valEl = document.createElement('span');
      if (typeof data === 'string') {
        valEl.className = 'json-string';
        valEl.textContent = '"' + data + '"';
      } else if (typeof data === 'number') {
        valEl.className = 'json-number';
        valEl.textContent = data;
      } else if (typeof data === 'boolean') {
        valEl.className = 'json-boolean';
        valEl.textContent = data;
      }
      wrap.appendChild(valEl);
      return wrap;
    }

    var isArray = Array.isArray(data);
    var keys = isArray ? data : Object.keys(data);
    var entries = isArray ? data.map(function (v, i) { return [i, v]; }) : Object.entries(data);

    entries.forEach(function (entry) {
      var key = entry[0];
      var value = entry[1];
      var row = document.createElement('div');
      row.className = 'json-row';
      row.style.paddingLeft = (depth * 16) + 'px';

      var isExpandable = value !== null && typeof value === 'object';

      if (isExpandable) {
        var toggle = document.createElement('span');
        toggle.className = 'json-toggle';
        toggle.textContent = '▸';
        var collapsed = depth > 1;

        var keyEl = document.createElement('span');
        keyEl.className = 'json-key';
        keyEl.textContent = isArray ? '[' + key + ']' : key;

        var preview = document.createElement('span');
        preview.className = 'json-preview';
        var childCount = Array.isArray(value) ? value.length : Object.keys(value).length;
        preview.textContent = (Array.isArray(value) ? '[' : '{') + childCount + (Array.isArray(value) ? ' items]' : ' keys}');

        var children = renderJsonTree(value, depth + 1);
        children.className += ' json-children';

        if (collapsed) {
          children.style.display = 'none';
        } else {
          toggle.textContent = '▾';
          preview.style.display = 'none';
        }

        toggle.addEventListener('click', function () {
          if (children.style.display === 'none') {
            children.style.display = '';
            toggle.textContent = '▾';
            preview.style.display = 'none';
          } else {
            children.style.display = 'none';
            toggle.textContent = '▸';
            preview.style.display = '';
          }
        });

        row.appendChild(toggle);
        row.appendChild(keyEl);
        row.appendChild(document.createTextNode(': '));
        row.appendChild(preview);
        wrap.appendChild(row);
        wrap.appendChild(children);
      } else {
        var spacer = document.createElement('span');
        spacer.className = 'json-spacer';
        row.appendChild(spacer);

        var keyEl2 = document.createElement('span');
        keyEl2.className = 'json-key';
        keyEl2.textContent = isArray ? '[' + key + ']' : key;
        row.appendChild(keyEl2);
        row.appendChild(document.createTextNode(': '));
        row.appendChild(renderJsonTree(value, depth + 1));
        wrap.appendChild(row);
      }
    });

    return wrap;
  }

  // Map JSON sections to departments and deliverable types
  function extractDeliverables(data) {
    if (!data) return [];
    var deliverables = [];

    // Social Media Management → Social Media department
    var smm = data.social_media_management || data.socialMediaManagement;
    if (smm && (Array.isArray(smm) ? smm.length > 0 : true)) {
      deliverables.push({
        department: 'Social Media',
        type: 'social-media-management',
        title: 'Social Media Management',
        detail: Array.isArray(smm) ? smm.length + ' month(s)' : 'Active',
        data: smm
      });
    }

    // Own Page Social Media → Design department
    var ownSm = data.ownPageSocialMedia || data.own_page_social_media;
    if (ownSm && (Array.isArray(ownSm) ? ownSm.length > 0 : Object.keys(ownSm).length > 0)) {
      deliverables.push({
        department: 'Design',
        type: 'own-social-media',
        title: 'Own Social Media Posts',
        detail: 'Design Department',
        data: ownSm
      });
    }

    // Agri4All → Agri4All department
    var agri = data.agri4all;
    if (agri && (Array.isArray(agri) ? agri.length > 0 : true)) {
      deliverables.push({
        department: 'Agri4All',
        type: 'agri4all',
        title: 'Agri4All',
        detail: Array.isArray(agri) ? agri.length + ' month(s)' : 'Active',
        data: agri
      });
    }

    // Online Articles → Editorial department
    var articles = data.online_articles || data.onlineArticles;
    if (articles && (Array.isArray(articles) ? articles.length > 0 : true)) {
      deliverables.push({
        department: 'Editorial',
        type: 'online-articles',
        title: 'Online Articles',
        detail: Array.isArray(articles) ? articles.length + ' month(s)' : 'Active',
        data: articles
      });
    }

    // Banners → Design department
    var banners = data.banners;
    if (banners && (Array.isArray(banners) ? banners.length > 0 : true)) {
      deliverables.push({
        department: 'Design',
        type: 'banners',
        title: 'Banners',
        detail: Array.isArray(banners) ? banners.length + ' month(s)' : 'Active',
        data: banners
      });
    }

    // Magazine → Editorial department
    var mag = data.magazine;
    if (mag && (Array.isArray(mag) ? mag.length > 0 : true)) {
      deliverables.push({
        department: 'Editorial',
        type: 'magazine',
        title: 'Magazine / Print',
        detail: Array.isArray(mag) ? mag.length + ' entry(ies)' : 'Active',
        data: mag
      });
    }

    // Video → Video department
    var video = data.video;
    if (video && (Array.isArray(video) ? video.length > 0 : true)) {
      deliverables.push({
        department: 'Video',
        type: 'video',
        title: 'Video Production',
        detail: Array.isArray(video) ? video.length + ' entry(ies)' : 'Active',
        data: video
      });
    }

    // Website → Design department
    var website = data.website || data.websiteDesign;
    if (website && (Array.isArray(website) ? website.length > 0 : true)) {
      deliverables.push({
        department: 'Design',
        type: 'website',
        title: 'Website Design',
        detail: Array.isArray(website) ? website.length + ' entry(ies)' : 'Active',
        data: website
      });
    }

    // Content Calendar (from socialLinks having platforms)
    var socialLinks = data.socialLinks || data.social_links;
    if (socialLinks && (Array.isArray(socialLinks) ? socialLinks.length > 0 : true)) {
      deliverables.push({
        department: 'Design',
        type: 'content-calendar',
        title: 'Content Calendar',
        detail: 'Social platforms linked',
        data: socialLinks
      });
    }

    return deliverables;
  }

  var deptColors = {
    'Social Media': '#3498db',
    'Design': '#9b59b6',
    'Agri4All': '#1abc9c',
    'Editorial': '#e67e22',
    'Video': '#e74c3c',
    'Production': '#2ecc71',
    'Admin': '#4285f4'
  };

  function renderDeliverablesList(deliverables, form) {
    var wrap = document.createElement('div');
    wrap.className = 'proposal-deliv-list';

    var heading = document.createElement('div');
    heading.className = 'proposal-deliv-heading';
    heading.textContent = 'Deliverables to create (' + deliverables.length + ')';
    wrap.appendChild(heading);

    // Group by department
    var grouped = {};
    deliverables.forEach(function (d) {
      if (!grouped[d.department]) grouped[d.department] = [];
      grouped[d.department].push(d);
    });

    Object.keys(grouped).forEach(function (dept) {
      var deptSection = document.createElement('div');
      deptSection.className = 'proposal-deliv-dept';

      var deptHeader = document.createElement('div');
      deptHeader.className = 'proposal-deliv-dept-header';
      var deptDot = document.createElement('span');
      deptDot.className = 'proposal-deliv-dot';
      deptDot.style.background = deptColors[dept] || '#999';
      deptHeader.appendChild(deptDot);
      var deptName = document.createElement('span');
      deptName.className = 'proposal-deliv-dept-name';
      deptName.textContent = dept;
      deptHeader.appendChild(deptName);
      var deptCount = document.createElement('span');
      deptCount.className = 'proposal-deliv-count';
      deptCount.textContent = grouped[dept].length;
      deptHeader.appendChild(deptCount);
      deptSection.appendChild(deptHeader);

      grouped[dept].forEach(function (d) {
        var row = document.createElement('div');
        row.className = 'proposal-deliv-row';

        var cb = document.createElement('input');
        cb.type = 'checkbox';
        cb.checked = true;
        cb.className = 'proposal-deliv-cb';
        row.appendChild(cb);

        var info = document.createElement('div');
        info.className = 'proposal-deliv-info';
        var titleEl = document.createElement('span');
        titleEl.className = 'proposal-deliv-title';
        titleEl.textContent = d.title;
        info.appendChild(titleEl);
        var detailEl = document.createElement('span');
        detailEl.className = 'proposal-deliv-detail';
        detailEl.textContent = d.detail;
        info.appendChild(detailEl);
        row.appendChild(info);

        var typeBadge = document.createElement('span');
        typeBadge.className = 'proposal-deliv-type';
        typeBadge.textContent = d.type;
        row.appendChild(typeBadge);

        deptSection.appendChild(row);
      });

      wrap.appendChild(deptSection);
    });

    // Create button (placeholder - doesn't create yet)
    var createBtn = document.createElement('button');
    createBtn.className = 'dev-btn dev-btn-primary';
    createBtn.style.marginTop = '12px';
    createBtn.textContent = 'Confirm & Create Selected';
    createBtn.addEventListener('click', function () {
      createBtn.textContent = 'Coming soon...';
      createBtn.disabled = true;
      setTimeout(function () {
        createBtn.textContent = 'Confirm & Create Selected';
        createBtn.disabled = false;
      }, 2000);
    });
    wrap.appendChild(createBtn);

    return wrap;
  }

  // Cache departments
  var departmentsCache = null;

  function getDepartments() {
    if (departmentsCache) return Promise.resolve(departmentsCache);
    return fetch('/api/departments', { headers: getHeaders() })
      .then(function (res) { return res.json(); })
      .then(function (depts) {
        departmentsCache = {};
        depts.forEach(function (d) {
          departmentsCache[d.slug || d.name.toLowerCase().replace(/\s+/g, '-')] = d.id;
          departmentsCache[d.name] = d.id;
        });
        return departmentsCache;
      });
  }

  function createDeliverables(form, btn) {
    var fd = form.formData;
    if (!fd) {
      alert('No form data found');
      return;
    }

    btn.textContent = 'Creating...';
    btn.disabled = true;

    getDepartments().then(function (depts) {
      var productionId = depts['production'] || depts['Production'];
      if (!productionId) {
        alert('Production department not found');
        btn.textContent = 'Create Deliverables';
        btn.disabled = false;
        return;
      }

      var smm = fd.social_media_management || fd.socialMediaManagement || [];
      if (!Array.isArray(smm)) smm = [];

      var promises = [];

      smm.forEach(function (entry) {
        if (!entry.content_calendar) return;

        var platforms = (entry.platforms || []).map(function (p) { return p.platform; });
        var monthlyPosts = entry.monthly_posts || 0;
        var monthLabel = entry.month_label || entry.months_display || '';

        var description = 'Monthly Posts: ' + monthlyPosts + '\n' +
          'Platforms: ' + (platforms.length > 0 ? platforms.join(', ') : 'None') + '\n' +
          'Period: ' + monthLabel;

        promises.push(
          fetch('/api/deliverables', {
            method: 'POST',
            headers: getHeaders(),
            body: JSON.stringify({
              bookingFormId: form.id,
              departmentId: productionId,
              type: 'content-calendar',
              title: 'Content Calendar — ' + monthLabel,
              description: description,
              status: 'pending'
            })
          }).then(function (res) {
            if (!res.ok) throw new Error('Status ' + res.status);
            return res.json();
          })
        );
      });

      if (promises.length === 0) {
        btn.textContent = 'No Content Calendars found';
        btn.disabled = true;
        setTimeout(function () {
          btn.textContent = 'Create Deliverables';
          btn.disabled = false;
        }, 2000);
        return;
      }

      return Promise.all(promises);
    }).then(function (results) {
      if (results && results.length > 0) {
        btn.textContent = 'Created ' + results.length + ' deliverable(s) ✓';
        btn.disabled = true;
      }
    }).catch(function (err) {
      console.error('Create deliverables error:', err);
      btn.textContent = 'Error — try again';
      btn.disabled = false;
    });
  }

  function renderProposalTab(container) {
    while (container.firstChild) container.removeChild(container.firstChild);
    container.style.display = 'block';
    container.style.height = 'auto';
    container.style.padding = '0';
    container.style.alignItems = '';
    container.style.justifyContent = '';

    var page = document.createElement('div');
    page.className = 'dev-page';

    // Header
    var header = document.createElement('div');
    header.className = 'dev-page-header';
    header.style.display = 'flex';
    header.style.justifyContent = 'space-between';
    header.style.alignItems = 'center';
    var title = document.createElement('h2');
    title.className = 'dev-page-title';
    title.textContent = 'Proposals';
    header.appendChild(title);

    var newBookingBtn = document.createElement('a');
    newBookingBtn.href = '/checklist/';
    newBookingBtn.className = 'dev-btn dev-btn-primary';
    newBookingBtn.textContent = 'New Booking';
    newBookingBtn.style.textDecoration = 'none';
    header.appendChild(newBookingBtn);

    page.appendChild(header);

    // Cards container
    var cardsWrap = document.createElement('div');
    cardsWrap.className = 'proposal-cards';
    cardsWrap.innerHTML = '<div class="dev-db-empty">Loading proposals...</div>';
    page.appendChild(cardsWrap);

    container.appendChild(page);

    // Fetch booking forms
    fetch(API_BASE, { headers: getHeaders() })
      .then(function (res) {
        if (!res.ok) throw new Error('Failed to fetch');
        return res.json();
      })
      .then(function (forms) {
        cardsWrap.innerHTML = '';

        if (forms.length === 0) {
          cardsWrap.innerHTML = '<div class="dev-db-empty">No proposals yet</div>';
          return;
        }

        forms.forEach(function (form, idx) {
          var card = document.createElement('div');
          card.className = 'proposal-card';
          card.style.animationDelay = (idx * 0.05) + 's';

          // Card header (always visible)
          var cardHeader = document.createElement('div');
          cardHeader.className = 'proposal-card-header';

          var left = document.createElement('div');
          left.className = 'proposal-card-left';

          var nameEl = document.createElement('div');
          nameEl.className = 'proposal-card-name';
          nameEl.textContent = form.clientName || form.title || 'Untitled';
          left.appendChild(nameEl);

          var meta = document.createElement('div');
          meta.className = 'proposal-card-meta';

          if (form.checklistId) {
            var idBadge = document.createElement('span');
            idBadge.className = 'proposal-checklist-id';
            idBadge.textContent = form.checklistId;
            meta.appendChild(idBadge);
          }

          var dateSpan = document.createElement('span');
          dateSpan.textContent = formatDate(form.createdAt);
          meta.appendChild(dateSpan);
          if (form.status) {
            var badge = document.createElement('span');
            badge.className = 'proposal-badge proposal-badge--' + form.status;
            badge.textContent = form.status;
            meta.appendChild(badge);
          }
          left.appendChild(meta);
          cardHeader.appendChild(left);

          var actions = document.createElement('div');
          actions.className = 'proposal-card-actions';

          var expandBtn = document.createElement('button');
          expandBtn.className = 'proposal-expand-btn';
          expandBtn.innerHTML = '▸ View JSON';
          actions.appendChild(expandBtn);

          var copyBtn = document.createElement('button');
          copyBtn.className = 'dev-btn dev-btn-ghost';
          copyBtn.textContent = 'Copy';
          copyBtn.style.fontSize = '11px';
          copyBtn.style.padding = '4px 10px';
          actions.appendChild(copyBtn);

          var delivBtn = document.createElement('button');
          delivBtn.className = 'dev-btn dev-btn-primary';
          delivBtn.textContent = 'Create Deliverables';
          delivBtn.style.fontSize = '11px';
          delivBtn.style.padding = '4px 12px';
          delivBtn.addEventListener('click', function () {
            createDeliverables(form, delivBtn);
          });
          actions.appendChild(delivBtn);

          cardHeader.appendChild(actions);
          card.appendChild(cardHeader);

          // JSON viewer (collapsed by default)
          var jsonWrap = document.createElement('div');
          jsonWrap.className = 'proposal-json-wrap';
          jsonWrap.style.display = 'none';

          var jsonData = form.formData || form;
          jsonWrap.appendChild(renderJsonTree(jsonData, 0));

          card.appendChild(jsonWrap);

          // Toggle expand
          var expanded = false;
          expandBtn.addEventListener('click', function () {
            expanded = !expanded;
            jsonWrap.style.display = expanded ? '' : 'none';
            expandBtn.innerHTML = expanded ? '▾ Hide JSON' : '▸ View JSON';
          });

          // Copy JSON
          copyBtn.addEventListener('click', function () {
            var jsonStr = JSON.stringify(jsonData, null, 2);
            navigator.clipboard.writeText(jsonStr).then(function () {
              copyBtn.textContent = 'Copied!';
              setTimeout(function () { copyBtn.textContent = 'Copy'; }, 2000);
            });
          });

          cardsWrap.appendChild(card);
        });
      })
      .catch(function (err) {
        cardsWrap.innerHTML = '<div class="dev-db-empty">Error: ' + err.message + '</div>';
      });
  }

  window.renderProposalTab = renderProposalTab;
})();
