/**
 * Magazine Overview page
 *
 * Shows all approved magazine deliverables grouped by publication
 * (ProAgri SA Digital, Africa Print, Africa Digital, Coffee Table Book).
 * Reads from GET /api/deliverables/by-type/magazine?status=approved.
 * Images are read from metadata.article_images (the same field the
 * production page writes to via /upload-images).
 */
(function () {
  'use strict';

  // Display order + labels for each magazine sub-type.
  // Keep order meaningful to the user: ProAgri SA first, then Africa, then Coffee Table.
  var PUBLICATIONS = [
    { key: 'magazine-sa-digital', label: 'ProAgri SA (Digital)' },
    { key: 'magazine-africa-print', label: 'ProAgri Africa (Print)' },
    { key: 'magazine-africa-digital', label: 'ProAgri Africa (Digital)' },
    { key: 'magazine-coffee-table', label: 'Coffee Table Book' }
  ];

  var MONTH_NAMES = [
    'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
    'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'
  ];

  function formatMonth(ym) {
    if (!ym || typeof ym !== 'string') return '';
    var parts = ym.split('-');
    if (parts.length !== 2) return ym;
    var mi = parseInt(parts[1], 10) - 1;
    if (isNaN(mi) || mi < 0 || mi > 11) return ym;
    return MONTH_NAMES[mi] + ' ' + parts[0];
  }

  function getAuthHeaders() {
    return window.getAuthHeaders ? window.getAuthHeaders() : {};
  }

  function renderCard(deliverable) {
    var card = document.createElement('button');
    card.className = 'mag-card';
    card.type = 'button';
    card.addEventListener('click', function () { openLightbox(deliverable); });

    // Thumbnail
    var meta = deliverable.metadata || {};
    var images = Array.isArray(meta.article_images) ? meta.article_images : [];

    var thumb = document.createElement('div');
    thumb.className = 'mag-card-thumb';
    if (images.length > 0) {
      var img = document.createElement('img');
      img.src = images[0];
      img.alt = deliverable.title || 'Magazine article';
      img.loading = 'lazy';
      thumb.appendChild(img);
      if (images.length > 1) {
        var badge = document.createElement('span');
        badge.className = 'mag-card-img-count';
        badge.textContent = '+' + (images.length - 1);
        thumb.appendChild(badge);
      }
    } else {
      thumb.classList.add('mag-card-thumb-placeholder');
      var placeholder = document.createElement('span');
      placeholder.textContent = 'No preview';
      thumb.appendChild(placeholder);
    }
    card.appendChild(thumb);

    // Body
    var body = document.createElement('div');
    body.className = 'mag-card-body';

    var title = document.createElement('h3');
    title.className = 'mag-card-title';
    title.textContent = deliverable.title || 'Untitled article';
    body.appendChild(title);

    var metaLine = document.createElement('div');
    metaLine.className = 'mag-card-meta';
    var clientName = deliverable.clientName || 'Unknown client';
    var monthDisplay = formatMonth(deliverable.deliveryMonth) || 'No month set';
    metaLine.textContent = clientName + ' · ' + monthDisplay;
    body.appendChild(metaLine);

    var excerpt = document.createElement('p');
    excerpt.className = 'mag-card-excerpt';
    var text = (meta.article_text || '').trim();
    if (text) {
      excerpt.textContent = text.length > 180 ? text.substring(0, 180) + '…' : text;
    } else {
      excerpt.textContent = 'No article text yet.';
    }
    body.appendChild(excerpt);

    card.appendChild(body);
    return card;
  }

  function openLightbox(deliverable) {
    var meta = deliverable.metadata || {};
    var images = Array.isArray(meta.article_images) ? meta.article_images : [];
    var text = (meta.article_text || '').trim();

    var overlay = document.createElement('div');
    overlay.className = 'mag-lightbox-overlay';
    overlay.addEventListener('click', function (e) {
      if (e.target === overlay) overlay.remove();
    });

    function handleEsc(e) {
      if (e.key === 'Escape') {
        overlay.remove();
        document.removeEventListener('keydown', handleEsc);
      }
    }
    document.addEventListener('keydown', handleEsc);

    var modal = document.createElement('div');
    modal.className = 'mag-lightbox-modal';

    var close = document.createElement('button');
    close.className = 'mag-lightbox-close';
    close.type = 'button';
    close.innerHTML = '&times;';
    close.setAttribute('aria-label', 'Close');
    close.addEventListener('click', function () {
      overlay.remove();
      document.removeEventListener('keydown', handleEsc);
    });
    modal.appendChild(close);

    var title = document.createElement('h2');
    title.className = 'mag-lightbox-title';
    title.textContent = deliverable.title || 'Untitled article';
    modal.appendChild(title);

    var metaLine = document.createElement('div');
    metaLine.className = 'mag-lightbox-meta';
    var pubLabel = '';
    for (var i = 0; i < PUBLICATIONS.length; i++) {
      if (PUBLICATIONS[i].key === deliverable.type) {
        pubLabel = PUBLICATIONS[i].label;
        break;
      }
    }
    var metaParts = [];
    if (deliverable.clientName) metaParts.push(deliverable.clientName);
    if (deliverable.deliveryMonth) metaParts.push(formatMonth(deliverable.deliveryMonth));
    if (pubLabel) metaParts.push(pubLabel);
    metaLine.textContent = metaParts.join(' · ');
    modal.appendChild(metaLine);

    if (images.length) {
      var gallery = document.createElement('div');
      gallery.className = 'mag-lightbox-gallery';
      images.forEach(function (url) {
        var img = document.createElement('img');
        img.src = url;
        img.className = 'mag-lightbox-img';
        img.alt = deliverable.title || 'Magazine image';
        img.loading = 'lazy';
        gallery.appendChild(img);
      });
      modal.appendChild(gallery);
    }

    if (text) {
      var body = document.createElement('div');
      body.className = 'mag-lightbox-body';
      body.textContent = text;
      modal.appendChild(body);
    }

    if (!images.length && !text) {
      var none = document.createElement('div');
      none.className = 'mag-lightbox-no-content';
      none.textContent = 'No preview content saved for this article yet.';
      modal.appendChild(none);
    }

    overlay.appendChild(modal);
    document.body.appendChild(overlay);
  }

  function renderGroups(container, deliverables) {
    // Bucket by type. Unknown sub-types or the bare 'magazine' key
    // land in a catch-all so nothing gets silently dropped.
    var groups = {};
    PUBLICATIONS.forEach(function (p) { groups[p.key] = []; });
    var other = [];

    deliverables.forEach(function (d) {
      if (groups[d.type]) {
        groups[d.type].push(d);
      } else {
        other.push(d);
      }
    });

    var anyRendered = false;

    PUBLICATIONS.forEach(function (p) {
      var items = groups[p.key];
      if (!items.length) return;
      anyRendered = true;
      container.appendChild(renderSection(p.label, items));
    });

    if (other.length) {
      anyRendered = true;
      container.appendChild(renderSection('Other Magazine Articles', other));
    }

    if (!anyRendered) {
      var empty = document.createElement('div');
      empty.className = 'mag-empty';
      empty.textContent =
        'No approved magazine articles yet. Articles will appear here once their ' +
        'deliverables reach the "approved" status in the magazine workflow.';
      container.appendChild(empty);
    }
  }

  function renderSection(label, items) {
    var section = document.createElement('section');
    section.className = 'mag-pub-section';

    var head = document.createElement('div');
    head.className = 'mag-pub-header';

    var lbl = document.createElement('h2');
    lbl.className = 'mag-pub-label';
    lbl.textContent = label;
    head.appendChild(lbl);

    var count = document.createElement('span');
    count.className = 'mag-pub-count';
    count.textContent = items.length + ' article' + (items.length === 1 ? '' : 's');
    head.appendChild(count);

    section.appendChild(head);

    var grid = document.createElement('div');
    grid.className = 'mag-card-grid';
    items.forEach(function (d) { grid.appendChild(renderCard(d)); });
    section.appendChild(grid);

    return section;
  }

  window.renderMagazineOverviewPage = function (container) {
    container.innerHTML = '';

    var header = document.createElement('div');
    header.className = 'mag-overview-header';

    var title = document.createElement('h1');
    title.className = 'mag-overview-title';
    title.textContent = 'Magazine Overview';
    header.appendChild(title);

    var subtitle = document.createElement('p');
    subtitle.className = 'mag-overview-subtitle';
    subtitle.textContent = 'All approved magazine articles, grouped by publication.';
    header.appendChild(subtitle);

    container.appendChild(header);

    var loading = document.createElement('div');
    loading.className = 'mag-overview-loading';
    loading.textContent = 'Loading approved magazine articles...';
    container.appendChild(loading);

    fetch('/api/deliverables/by-type/magazine?status=approved', { headers: getAuthHeaders() })
      .then(function (r) {
        if (!r.ok) throw new Error('HTTP ' + r.status);
        return r.json();
      })
      .then(function (deliverables) {
        loading.remove();
        renderGroups(container, deliverables);
      })
      .catch(function (err) {
        console.error('Magazine overview load error:', err);
        loading.className = 'mag-overview-error';
        loading.textContent = 'Failed to load magazine articles. Check that the API is running.';
      });
  };
})();
