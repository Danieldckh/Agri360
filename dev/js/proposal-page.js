(function () {
  'use strict';

  var API_BASE = 'http://localhost:3001/api/booking-forms';

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
    var title = document.createElement('h2');
    title.className = 'dev-page-title';
    title.textContent = 'Proposals';
    header.appendChild(title);
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
          meta.textContent = formatDate(form.createdAt);
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
