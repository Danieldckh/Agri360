/* =============================================================
   Social Media Scheduler — full frontend module
   Renders into a container via window.renderSocialSchedulerPage()
   ============================================================= */
(function () {
  'use strict';

  var API = '/api/scheduler';

  // ---- source / platform definitions ----
  var SOURCES = [
    { id: 'all', label: 'All' },
    { id: 'content-calendar', label: 'Content Calendars' },
    { id: 'agri4all', label: 'Agri4All' },
    { id: 'own-sm', label: 'Own Social Media' }
  ];

  var PLATFORMS = ['facebook', 'instagram', 'twitter', 'linkedin', 'youtube', 'tiktok'];

  var PLATFORM_FIELDS = {
    facebook:  ['Page ID', 'Access Token'],
    instagram: ['Business Account ID', 'Access Token'],
    twitter:   ['API Key', 'API Secret', 'Access Token', 'Access Token Secret'],
    linkedin:  ['Organization URN', 'Access Token'],
    youtube:   ['Channel ID', 'API Key', 'OAuth Refresh Token'],
    tiktok:    ['Open ID', 'Access Token']
  };

  // ---- module state ----
  var state = {
    posts: [],
    creds: [],
    clients: [],
    sourceFilter: 'all',
    // When the scheduler is opened from a dept tab that pins it to a specific
    // source (e.g. Social Media > Content Calendars), presetSource is set
    // and the internal source switcher is hidden — the dept nav becomes the
    // source nav instead.
    presetSource: false,
    view: 'month',         // month | week | day
    cursor: new Date(),    // current focused date
    search: '',
    container: null,
    leftTab: 'unscheduled',      // 'unscheduled' | 'scheduled'
    expandedClients: {}          // { [clientId|'none']: true }
  };

  // Returns active credentials owned by a given client (or agency if clientId is null/undefined)
  function credsForClient(clientId) {
    var key = (clientId == null) ? null : Number(clientId);
    return state.creds.filter(function (c) {
      if (!c.isActive) return false;
      var cClient = (c.clientId == null) ? null : Number(c.clientId);
      return cClient === key;
    });
  }

  // Returns the unique platforms a given client has connected (active accounts only)
  function platformsForClient(clientId) {
    var seen = {};
    credsForClient(clientId).forEach(function (c) { seen[c.platform] = true; });
    return PLATFORMS.filter(function (p) { return seen[p]; });
  }

  // ---------------- helpers ----------------
  function getHeaders() {
    var h = { 'Content-Type': 'application/json' };
    if (window.getAuthHeaders) {
      var a = window.getAuthHeaders();
      for (var k in a) if (a.hasOwnProperty(k)) h[k] = a[k];
    }
    return h;
  }

  function api(path, opts) {
    opts = opts || {};
    opts.headers = getHeaders();
    return fetch(API + path, opts).then(function (r) {
      if (!r.ok) throw new Error('HTTP ' + r.status);
      return r.json();
    });
  }

  function el(tag, cls, txt) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (txt != null) e.textContent = txt;
    return e;
  }

  function svg(d, size) {
    size = size || 18;
    var s = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    s.setAttribute('width', size);
    s.setAttribute('height', size);
    s.setAttribute('viewBox', '0 0 24 24');
    s.setAttribute('fill', 'currentColor');
    var p = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    p.setAttribute('d', d);
    s.appendChild(p);
    return s;
  }

  function pad(n) { return n < 10 ? '0' + n : '' + n; }

  function ymd(d) {
    return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
  }

  function startOfMonth(d) { return new Date(d.getFullYear(), d.getMonth(), 1); }
  function endOfMonth(d) { return new Date(d.getFullYear(), d.getMonth() + 1, 0); }
  function startOfWeek(d) {
    var nd = new Date(d);
    var day = nd.getDay(); // 0 = Sun, treat Mon as week start
    var diff = (day === 0 ? -6 : 1 - day);
    nd.setDate(nd.getDate() + diff);
    nd.setHours(0, 0, 0, 0);
    return nd;
  }
  function addDays(d, n) {
    var nd = new Date(d);
    nd.setDate(nd.getDate() + n);
    return nd;
  }
  function sameDay(a, b) {
    return a.getFullYear() === b.getFullYear()
        && a.getMonth() === b.getMonth()
        && a.getDate() === b.getDate();
  }

  function formatTitle() {
    var d = state.cursor;
    var months = ['January','February','March','April','May','June',
                  'July','August','September','October','November','December'];
    if (state.view === 'month') {
      return months[d.getMonth()] + ' ' + d.getFullYear();
    }
    if (state.view === 'week') {
      var s = startOfWeek(d);
      var e = addDays(s, 6);
      return s.getDate() + ' ' + months[s.getMonth()].slice(0, 3) +
             ' – ' + e.getDate() + ' ' + months[e.getMonth()].slice(0, 3) +
             ' ' + e.getFullYear();
    }
    var dn = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
    return dn[d.getDay()] + ', ' + d.getDate() + ' ' + months[d.getMonth()] + ' ' + d.getFullYear();
  }

  function filteredPosts() {
    var src = state.sourceFilter;
    var q = state.search.trim().toLowerCase();
    return state.posts.filter(function (p) {
      if (src !== 'all' && p.sourceType !== src) return false;
      if (q) {
        var hay = ((p.title || '') + ' ' + (p.content || '') + ' ' + (p.clientName || '')).toLowerCase();
        if (hay.indexOf(q) === -1) return false;
      }
      return true;
    });
  }

  function unscheduledPosts() {
    return filteredPosts().filter(function (p) { return !p.scheduledAt; });
  }

  function postsOnDay(d) {
    return filteredPosts().filter(function (p) {
      if (!p.scheduledAt) return false;
      var dt = new Date(p.scheduledAt);
      return sameDay(dt, d);
    }).sort(function (a, b) {
      return new Date(a.scheduledAt) - new Date(b.scheduledAt);
    });
  }

  function postsInHour(d, hour) {
    return filteredPosts().filter(function (p) {
      if (!p.scheduledAt) return false;
      var dt = new Date(p.scheduledAt);
      return sameDay(dt, d) && dt.getHours() === hour;
    });
  }

  // ---------------- data fetching ----------------
  function fetchClients() {
    return fetch('/api/clients', { headers: getHeaders() })
      .then(function (r) { return r.ok ? r.json() : []; })
      .catch(function () { return []; });
  }

  function loadAll() {
    return Promise.all([
      api('/posts').catch(function () { return []; }),
      api('/credentials').catch(function () { return []; }),
      fetchClients()
    ]).then(function (res) {
      state.posts = res[0] || [];
      state.creds = res[1] || [];
      state.clients = res[2] || [];
      render();
    });
  }

  // ---------------- drag & drop ----------------
  var dragData = null;

  function makeDraggable(node, post) {
    node.draggable = true;
    node.addEventListener('dragstart', function (e) {
      dragData = post;
      node.classList.add('dragging');
      e.dataTransfer.effectAllowed = 'move';
      try { e.dataTransfer.setData('text/plain', String(post.id)); } catch (_) {}
    });
    node.addEventListener('dragend', function () {
      node.classList.remove('dragging');
      dragData = null;
    });
  }

  function makeDropTarget(node, onDrop) {
    node.addEventListener('dragover', function (e) {
      if (!dragData) return;
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
      node.classList.add('drop-target');
    });
    node.addEventListener('dragleave', function () {
      node.classList.remove('drop-target');
    });
    node.addEventListener('drop', function (e) {
      e.preventDefault();
      node.classList.remove('drop-target');
      if (!dragData) return;
      onDrop(dragData);
    });
  }

  function reschedulePost(post, newDate) {
    // Preserve time if already scheduled, else default to 09:00
    var existing = post.scheduledAt ? new Date(post.scheduledAt) : null;
    var dt = new Date(newDate);
    if (existing) {
      dt.setHours(existing.getHours(), existing.getMinutes(), 0, 0);
    } else {
      dt.setHours(9, 0, 0, 0);
    }
    return api('/posts/' + post.id, {
      method: 'PATCH',
      body: JSON.stringify({
        scheduledAt: dt.toISOString(),
        status: post.status === 'draft' ? 'scheduled' : post.status
      })
    }).then(loadAll);
  }

  function unschedulePost(post) {
    if (!post.scheduledAt) return; // already unscheduled — drop is a no-op
    if (post.status === 'posted') return; // can't unschedule something already posted
    return api('/posts/' + post.id, {
      method: 'PATCH',
      body: JSON.stringify({
        scheduledAt: null,
        status: 'draft'
      })
    }).then(loadAll);
  }

  // ---------------- rendering ----------------
  function render() {
    var c = state.container;
    if (!c) return;
    while (c.firstChild) c.removeChild(c.firstChild);

    var root = el('div', 'sch-root');
    root.appendChild(buildToolbar());

    var body = el('div', 'sch-body');
    body.appendChild(buildLeftPanel());
    body.appendChild(buildRightPanel());
    root.appendChild(body);

    c.appendChild(root);
  }

  function buildToolbar() {
    var bar = el('div', 'sch-toolbar');

    var title = el('div', 'sch-toolbar-title');
    title.appendChild(svg('M19 4h-1V2h-2v2H8V2H6v2H5c-1.11 0-1.99.9-1.99 2L3 20a2 2 0 002 2h14c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 16H5V10h14v10zM5 8V6h14v2H5zm2 4h5v5H7v-5z', 20));
    title.appendChild(document.createTextNode(' Social Media Scheduler'));
    bar.appendChild(title);

    // Source tabs — hidden when a preset source is active (the dept tab
    // nav drives the source in that case, so showing a second switcher
    // would be redundant + confusing).
    if (!state.presetSource) {
      var tabs = el('div', 'sch-source-tabs');
      SOURCES.forEach(function (s) {
        var btn = el('button', 'sch-source-tab' + (state.sourceFilter === s.id ? ' active' : ''), s.label);
        btn.addEventListener('click', function () {
          state.sourceFilter = s.id;
          render();
        });
        tabs.appendChild(btn);
      });
      bar.appendChild(tabs);
    }

    // new post button
    var newBtn = el('button', 'sch-btn sch-btn-primary');
    newBtn.appendChild(svg('M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z', 16));
    newBtn.appendChild(document.createTextNode(' New Post'));
    newBtn.addEventListener('click', function () { openPostModal(null); });
    bar.appendChild(newBtn);

    // credentials button
    var credBtn = el('button', 'sch-btn');
    credBtn.appendChild(svg('M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4zm-2 16l-4-4 1.41-1.41L10 14.17l6.59-6.59L18 9l-8 8z', 16));
    credBtn.appendChild(document.createTextNode(' Credentials'));
    credBtn.addEventListener('click', openCredentialsModal);
    bar.appendChild(credBtn);

    // view toggle
    var viewToggle = el('div', 'sch-view-toggle');
    ['month', 'week', 'day'].forEach(function (v) {
      var b = el('button', 'sch-view-btn' + (state.view === v ? ' active' : ''),
                v.charAt(0).toUpperCase() + v.slice(1));
      b.addEventListener('click', function () {
        state.view = v;
        render();
      });
      viewToggle.appendChild(b);
    });
    bar.appendChild(viewToggle);

    return bar;
  }

  function buildLeftPanel() {
    var left = el('div', 'sch-left');

    // --- Tab bar --------------------------------------------------
    var tabBar = el('div', 'sch-tab-bar');
    var unschedCount = unscheduledPosts().length;
    var schedCount = filteredPosts().filter(function (p) { return !!p.scheduledAt; }).length;

    [
      { id: 'unscheduled', label: 'Unscheduled', count: unschedCount },
      { id: 'scheduled',   label: 'Scheduled',   count: schedCount }
    ].forEach(function (tab) {
      var btn = el('button', 'sch-tab' + (state.leftTab === tab.id ? ' active' : ''));
      btn.setAttribute('data-tab', tab.id);
      btn.appendChild(document.createTextNode(tab.label + ' '));
      btn.appendChild(el('span', 'sch-tab-count', tab.count));
      btn.addEventListener('click', function () {
        if (state.leftTab === tab.id) return;
        state.leftTab = tab.id;
        render();
      });
      tabBar.appendChild(btn);
    });
    left.appendChild(tabBar);

    // --- Search (shared by both tabs) ----------------------------
    var search = el('input', 'sch-search');
    search.type = 'text';
    search.placeholder = 'Search posts...';
    search.value = state.search;
    search.addEventListener('input', function (e) {
      state.search = e.target.value;
      // Lightweight refresh: replace just the list section
      render();
    });
    left.appendChild(search);

    // --- Tab body ------------------------------------------------
    if (state.leftTab === 'unscheduled') {
      left.appendChild(buildUnscheduledTabBody());
    } else {
      left.appendChild(buildScheduledTabBody());
    }

    return left;
  }

  function buildUnscheduledTabBody() {
    var unsched = unscheduledPosts();
    var list = el('div', 'sch-unscheduled-list');
    if (unsched.length === 0) {
      list.appendChild(el('div', 'sch-empty', 'No unscheduled posts. Drop a scheduled post here to unschedule it, or create a new one.'));
    } else {
      unsched.forEach(function (p) {
        list.appendChild(buildPostCard(p));
      });
    }
    // Allow scheduled posts to be dragged back here to unschedule them
    makeDropTarget(list, function (post) { unschedulePost(post); });
    return list;
  }

  function buildScheduledTabBody() {
    var wrap = el('div', 'sch-scheduled-list');
    var scheduled = filteredPosts().filter(function (p) { return !!p.scheduledAt; });

    if (scheduled.length === 0) {
      wrap.appendChild(el('div', 'sch-empty', 'No scheduled posts yet. Drag a post onto the calendar to schedule it.'));
      return wrap;
    }

    // Group by client id. Fall back to clientName lookup via state.clients if needed.
    var groups = {}; // key -> { key, name, posts: [] }
    scheduled.forEach(function (p) {
      var key = (p.clientId == null) ? 'none' : String(p.clientId);
      if (!groups[key]) {
        var name = p.clientName;
        if (!name && p.clientId != null && Array.isArray(state.clients)) {
          var match = state.clients.find(function (c) { return Number(c.id) === Number(p.clientId); });
          if (match) name = match.name || match.clientName;
        }
        if (!name) name = (p.clientId == null) ? 'Agency / No Client' : ('Client #' + p.clientId);
        groups[key] = { key: key, name: name, posts: [] };
      }
      groups[key].posts.push(p);
    });

    // Sort groups by name, posts within each group by scheduledAt
    var groupList = Object.keys(groups).map(function (k) { return groups[k]; });
    groupList.sort(function (a, b) { return a.name.localeCompare(b.name); });
    groupList.forEach(function (g) {
      g.posts.sort(function (a, b) { return new Date(a.scheduledAt) - new Date(b.scheduledAt); });
    });

    groupList.forEach(function (g) {
      var isOpen = !!state.expandedClients[g.key];
      var toggle = el('div', 'sch-client-toggle' + (isOpen ? ' expanded' : ''));

      var header = el('div', 'sch-client-toggle-header');
      header.appendChild(el('span', 'sch-client-chevron', isOpen ? '▼' : '▶'));
      header.appendChild(el('span', 'sch-client-name', g.name));
      header.appendChild(el('span', 'sch-client-count', g.posts.length));
      header.addEventListener('click', function () {
        state.expandedClients[g.key] = !state.expandedClients[g.key];
        render();
      });
      toggle.appendChild(header);

      var body = el('div', 'sch-client-toggle-body');
      body.style.display = isOpen ? 'flex' : 'none';
      g.posts.forEach(function (p) {
        body.appendChild(buildPostCard(p));
      });
      toggle.appendChild(body);

      wrap.appendChild(toggle);
    });

    return wrap;
  }

  // Format a date as "May 5" (or "May 5, 2027" if year differs from now)
  function formatShortDate(iso) {
    if (!iso) return '—';
    var d = new Date(iso);
    if (isNaN(d.getTime())) return '—';
    var months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    var now = new Date();
    var base = months[d.getMonth()] + ' ' + d.getDate();
    if (d.getFullYear() !== now.getFullYear()) base += ', ' + d.getFullYear();
    return base;
  }

  function buildPostCard(p) {
    var card = el('div', 'sch-post-card');
    card.setAttribute('data-post-id', p.id);
    makeDraggable(card, p);

    // --- Image thumbnail ---
    var imgBox = el('div', 'sch-post-card-img');
    var firstMedia = null;
    if (Array.isArray(p.mediaUrls) && p.mediaUrls.length > 0) {
      firstMedia = p.mediaUrls[0];
    }
    if (firstMedia) {
      var img = document.createElement('img');
      img.src = firstMedia;
      img.alt = '';
      img.addEventListener('error', function () {
        imgBox.removeChild(img);
        imgBox.appendChild(svg('M21 19V5c0-1.1-.9-2-2-2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2zM8.5 13.5l2.5 3.01L14.5 12l4.5 6H5l3.5-4.5z', 22));
      });
      imgBox.appendChild(img);
    } else {
      imgBox.appendChild(svg('M21 19V5c0-1.1-.9-2-2-2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2zM8.5 13.5l2.5 3.01L14.5 12l4.5 6H5l3.5-4.5z', 22));
    }
    card.appendChild(imgBox);

    // --- Body ---
    var body = el('div', 'sch-post-card-body');

    var titleText = p.title;
    if (!titleText) {
      var c = (p.content || '').trim();
      titleText = c ? (c.length > 40 ? c.slice(0, 40) + '…' : c) : '(untitled)';
    }
    body.appendChild(el('div', 'sch-post-card-title', titleText));

    var meta = el('div', 'sch-post-card-meta');
    meta.appendChild(el('span', 'sch-post-card-date', formatShortDate(p.scheduledAt)));

    var statusKey = (p.scheduledAt ? (p.status || 'scheduled') : 'unscheduled');
    // Normalize draft/no-date to "unscheduled" visual
    if (!p.scheduledAt) statusKey = 'unscheduled';
    var statusLabel = statusKey.charAt(0).toUpperCase() + statusKey.slice(1);
    meta.appendChild(el('span', 'sch-post-card-status sch-status-' + statusKey, statusLabel));

    body.appendChild(meta);
    card.appendChild(body);

    card.addEventListener('click', function (e) {
      // Don't open if a drag finished here
      if (e.detail === 0) return;
      openPostModal(p);
    });

    return card;
  }

  function buildRightPanel() {
    var right = el('div', 'sch-right');
    right.appendChild(buildCalendarHeader());

    var body = el('div', 'sch-cal-body');
    if (state.view === 'month') body.appendChild(buildMonthView());
    else if (state.view === 'week') body.appendChild(buildWeekView());
    else body.appendChild(buildDayView());
    right.appendChild(body);

    return right;
  }

  function buildCalendarHeader() {
    var h = el('div', 'sch-cal-header');

    var nav = el('div', 'sch-cal-nav');

    var prev = el('button', 'sch-nav-btn');
    prev.appendChild(svg('M15.41 7.41L14 6l-6 6 6 6 1.41-1.41L10.83 12z', 18));
    prev.addEventListener('click', function () { stepCursor(-1); });
    nav.appendChild(prev);

    var today = el('button', 'sch-btn sch-btn-sm', 'Today');
    today.addEventListener('click', function () {
      state.cursor = new Date();
      render();
    });
    nav.appendChild(today);

    var next = el('button', 'sch-nav-btn');
    next.appendChild(svg('M8.59 16.59L13.17 12 8.59 7.41 10 6l6 6-6 6-1.41-1.41z', 18));
    next.addEventListener('click', function () { stepCursor(1); });
    nav.appendChild(next);

    h.appendChild(nav);
    h.appendChild(el('h2', 'sch-cal-title', formatTitle()));

    return h;
  }

  function stepCursor(dir) {
    var d = new Date(state.cursor);
    if (state.view === 'month') {
      d.setMonth(d.getMonth() + dir);
    } else if (state.view === 'week') {
      d.setDate(d.getDate() + 7 * dir);
    } else {
      d.setDate(d.getDate() + dir);
    }
    state.cursor = d;
    render();
  }

  // -------- month view --------
  function buildMonthView() {
    var grid = el('div', 'sch-month-grid');
    var dayNames = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
    dayNames.forEach(function (n) { grid.appendChild(el('div', 'sch-month-dayname', n)); });

    var first = startOfMonth(state.cursor);
    var firstWeekStart = startOfWeek(first);
    var today = new Date();

    for (var i = 0; i < 42; i++) {
      var day = addDays(firstWeekStart, i);
      var cell = el('div', 'sch-month-cell');
      if (day.getMonth() !== state.cursor.getMonth()) cell.classList.add('other-month');
      if (sameDay(day, today)) cell.classList.add('today');

      var num = el('div', 'sch-month-daynum', day.getDate());
      cell.appendChild(num);

      var dayPosts = postsOnDay(day);
      var maxShow = 3;
      dayPosts.slice(0, maxShow).forEach(function (p) {
        var ev = el('div', 'sch-month-event ' + p.sourceType, p.title || '(untitled)');
        if (p.status === 'posted') ev.classList.add('posted');
        makeDraggable(ev, p);
        ev.addEventListener('click', function (e) {
          e.stopPropagation();
          openPostModal(p);
        });
        cell.appendChild(ev);
      });
      if (dayPosts.length > maxShow) {
        var more = el('div', 'sch-month-more', '+' + (dayPosts.length - maxShow) + ' more');
        more.addEventListener('click', function (e) {
          e.stopPropagation();
          state.view = 'day';
          state.cursor = day;
          render();
        });
        cell.appendChild(more);
      }

      (function (cellDay) {
        makeDropTarget(cell, function (post) { reschedulePost(post, cellDay); });
        cell.addEventListener('dblclick', function () {
          var d = new Date(cellDay);
          d.setHours(9, 0, 0, 0);
          openPostModal({ scheduledAt: d.toISOString() });
        });
      })(day);

      grid.appendChild(cell);
    }
    return grid;
  }

  // -------- week view --------
  function buildWeekView() {
    var grid = el('div', 'sch-week-grid');
    var ws = startOfWeek(state.cursor);
    var today = new Date();

    grid.appendChild(el('div', 'sch-week-header'));
    var dayNames = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
    for (var i = 0; i < 7; i++) {
      var day = addDays(ws, i);
      var hdr = el('div', 'sch-week-header');
      if (sameDay(day, today)) hdr.classList.add('today');
      var dn = el('div', 'day-name', dayNames[i]);
      var num = el('div', 'day-num', day.getDate());
      hdr.appendChild(dn);
      hdr.appendChild(num);
      grid.appendChild(hdr);
    }

    // Hours 6 → 22
    for (var h = 6; h <= 22; h++) {
      var label = el('div', 'sch-week-time', (h < 10 ? '0' : '') + h + ':00');
      grid.appendChild(label);

      for (var d = 0; d < 7; d++) {
        var slot = el('div', 'sch-week-slot');
        var slotDay = addDays(ws, d);
        var slotHour = h;

        postsInHour(slotDay, h).forEach(function (p) {
          var ev = el('div', 'sch-week-event ' + p.sourceType, p.title || '(untitled)');
          makeDraggable(ev, p);
          ev.addEventListener('click', function (e) {
            e.stopPropagation();
            openPostModal(p);
          });
          slot.appendChild(ev);
        });

        (function (sd, sh) {
          makeDropTarget(slot, function (post) {
            var dt = new Date(sd);
            dt.setHours(sh, 0, 0, 0);
            return api('/posts/' + post.id, {
              method: 'PATCH',
              body: JSON.stringify({
                scheduledAt: dt.toISOString(),
                status: post.status === 'draft' ? 'scheduled' : post.status
              })
            }).then(loadAll);
          });
          slot.addEventListener('dblclick', function () {
            var dt = new Date(sd);
            dt.setHours(sh, 0, 0, 0);
            openPostModal({ scheduledAt: dt.toISOString() });
          });
        })(slotDay, slotHour);

        grid.appendChild(slot);
      }
    }
    return grid;
  }

  // -------- day view --------
  function buildDayView() {
    var grid = el('div', 'sch-day-grid');
    var day = state.cursor;
    for (var h = 6; h <= 22; h++) {
      grid.appendChild(el('div', 'sch-day-time', (h < 10 ? '0' : '') + h + ':00'));
      var slot = el('div', 'sch-day-slot');

      postsInHour(day, h).forEach(function (p) {
        var ev = el('div', 'sch-day-event ' + p.sourceType);
        var strong = el('strong', null, p.title || '(untitled)');
        ev.appendChild(strong);
        if (p.content) {
          var preview = p.content.length > 120 ? p.content.slice(0, 120) + '…' : p.content;
          ev.appendChild(document.createTextNode(preview));
        }
        makeDraggable(ev, p);
        ev.addEventListener('click', function (e) {
          e.stopPropagation();
          openPostModal(p);
        });
        slot.appendChild(ev);
      });

      (function (d, hr) {
        makeDropTarget(slot, function (post) {
          var dt = new Date(d);
          dt.setHours(hr, 0, 0, 0);
          return api('/posts/' + post.id, {
            method: 'PATCH',
            body: JSON.stringify({
              scheduledAt: dt.toISOString(),
              status: post.status === 'draft' ? 'scheduled' : post.status
            })
          }).then(loadAll);
        });
        slot.addEventListener('dblclick', function () {
          var dt = new Date(d);
          dt.setHours(hr, 0, 0, 0);
          openPostModal({ scheduledAt: dt.toISOString() });
        });
      })(day, h);

      grid.appendChild(slot);
    }
    return grid;
  }

  // ---------------- modal infrastructure ----------------
  function openModal(title, contentEl, footerBuilder) {
    var overlay = el('div', 'sch-modal-overlay');
    var modal = el('div', 'sch-modal');

    var hdr = el('div', 'sch-modal-header');
    hdr.appendChild(el('h3', 'sch-modal-title', title));
    var x = el('button', 'sch-modal-close', '×');
    x.addEventListener('click', close);
    hdr.appendChild(x);

    var body = el('div', 'sch-modal-body');
    body.appendChild(contentEl);

    modal.appendChild(hdr);
    modal.appendChild(body);
    if (footerBuilder) {
      var footer = el('div', 'sch-modal-footer');
      footerBuilder(footer, close);
      modal.appendChild(footer);
    }
    overlay.appendChild(modal);

    overlay.addEventListener('click', function (e) {
      if (e.target === overlay) close();
    });
    document.body.appendChild(overlay);

    function close() { overlay.remove(); }
    return { close: close };
  }

  // ---------------- post modal ----------------
  function openPostModal(post) {
    var isNew = !post || !post.id;
    var data = Object.assign({
      title: '',
      content: '',
      platforms: [],
      sourceType: state.sourceFilter !== 'all' ? state.sourceFilter : 'content-calendar',
      scheduledAt: '',
      linkUrl: '',
      hashtags: '',
      notes: '',
      status: 'draft',
      clientId: null
    }, post || {});

    // Ensure mediaUrls is always an array on the data object
    if (!Array.isArray(data.mediaUrls)) data.mediaUrls = [];

    var form = el('div');

    // --- Media gallery (shown at top if photos exist, or always show add row) ---
    var mediaSection = el('div', 'sch-media-section');
    var mediaLabel = el('label', 'sch-field-label', 'Photos');
    mediaSection.appendChild(mediaLabel);
    var mediaGallery = el('div', 'sch-media-gallery');

    function rebuildGallery() {
      while (mediaGallery.firstChild) mediaGallery.removeChild(mediaGallery.firstChild);
      data.mediaUrls.forEach(function (url, idx) {
        var thumb = el('div', 'sch-media-thumb');
        var img = document.createElement('img');
        img.src = url;
        img.alt = '';
        img.addEventListener('error', function () { img.style.display = 'none'; });
        thumb.appendChild(img);
        var rm = el('button', 'sch-media-thumb-rm', '×');
        rm.title = 'Remove';
        rm.addEventListener('click', function () {
          data.mediaUrls.splice(idx, 1);
          rebuildGallery();
        });
        thumb.appendChild(rm);
        mediaGallery.appendChild(thumb);
      });
      // "Add URL" mini-row
      var addRow = el('div', 'sch-media-add-row');
      var urlInput = el('input');
      urlInput.type = 'url';
      urlInput.placeholder = 'Paste image URL…';
      urlInput.className = 'sch-media-url-input';
      var addBtn = el('button', 'sch-btn sch-btn-sm', '+ Add');
      addBtn.addEventListener('click', function () {
        var v = urlInput.value.trim();
        if (v) {
          data.mediaUrls.push(v);
          rebuildGallery();
        }
      });
      addRow.appendChild(urlInput);
      addRow.appendChild(addBtn);
      mediaGallery.appendChild(addRow);
    }
    rebuildGallery();

    mediaSection.appendChild(mediaGallery);
    form.appendChild(mediaSection);

    // Title
    form.appendChild(field('Title',
      input('text', data.title, function (v) { data.title = v; })));

    // Content
    form.appendChild(field('Caption / Content',
      textarea(data.content, function (v) { data.content = v; })));

    // Client + Source row — client comes first because it gates platform options below
    var clientRow = el('div', 'sch-field-row');
    var clientOptions = ['agency'].concat(state.clients.map(function (c) { return String(c.id); }));
    var clientLabels = { agency: 'Agency (Own accounts)' };
    state.clients.forEach(function (c) { clientLabels[String(c.id)] = c.name; });
    var currentClientKey = data.clientId == null ? 'agency' : String(data.clientId);
    clientRow.appendChild(field('Client',
      select(clientOptions, currentClientKey, function (v) {
        data.clientId = (v === 'agency') ? null : Number(v);
        // Drop any previously-selected platforms that the new client doesn't have
        var allowed = platformsForClient(data.clientId);
        data.platforms = (data.platforms || []).filter(function (p) { return allowed.indexOf(p) !== -1; });
        renderPlatforms();
      }, clientLabels)));
    clientRow.appendChild(field('Source',
      select(['content-calendar', 'agri4all', 'own-sm'], data.sourceType,
        function (v) { data.sourceType = v; },
        { 'content-calendar': 'Content Calendar', 'agri4all': 'Agri4All', 'own-sm': 'Own Social Media' })));
    form.appendChild(clientRow);

    // Status row
    form.appendChild(field('Status',
      select(['draft', 'scheduled', 'posted', 'failed'], data.status,
        function (v) { data.status = v; })));

    // Platforms — filtered to the selected client's connected accounts
    var platField = el('div', 'sch-field');
    var platLabel = el('label', 'sch-field-label', 'Platforms');
    platField.appendChild(platLabel);
    var platWrap = el('div', 'sch-platform-select');
    platField.appendChild(platWrap);
    form.appendChild(platField);

    function renderPlatforms() {
      while (platWrap.firstChild) platWrap.removeChild(platWrap.firstChild);
      var allowed = platformsForClient(data.clientId);
      if (allowed.length === 0) {
        var empty = el('div', 'sch-platform-empty');
        var who = data.clientId == null
          ? 'No agency accounts connected yet.'
          : 'This client has no connected accounts yet.';
        empty.textContent = who + ' Open Credentials to add one.';
        platWrap.appendChild(empty);
        return;
      }
      allowed.forEach(function (pl) {
        var opt = el('div', 'sch-platform-opt' +
          (data.platforms && data.platforms.indexOf(pl) !== -1 ? ' selected' : ''), pl);
        opt.addEventListener('click', function () {
          if (!Array.isArray(data.platforms)) data.platforms = [];
          var idx = data.platforms.indexOf(pl);
          if (idx === -1) data.platforms.push(pl);
          else data.platforms.splice(idx, 1);
          opt.classList.toggle('selected');
        });
        platWrap.appendChild(opt);
      });
    }
    renderPlatforms();

    // Schedule + Link row
    var row2 = el('div', 'sch-field-row');
    var schedInput = input('datetime-local', toLocalDT(data.scheduledAt), function (v) {
      data.scheduledAt = v ? new Date(v).toISOString() : null;
    });
    row2.appendChild(field('Scheduled For', schedInput));
    row2.appendChild(field('Link URL',
      input('url', data.linkUrl || '', function (v) { data.linkUrl = v; })));
    form.appendChild(row2);

    // Hashtags
    form.appendChild(field('Hashtags',
      input('text', data.hashtags || '', function (v) { data.hashtags = v; })));

    // Notes
    form.appendChild(field('Notes',
      textarea(data.notes || '', function (v) { data.notes = v; })));

    var modal = openModal(isNew ? 'New Post' : 'Edit Post', form, function (footer, close) {
      if (!isNew) {
        var del = el('button', 'sch-btn sch-btn-danger', 'Delete');
        del.addEventListener('click', function () {
          if (!confirm('Delete this post?')) return;
          api('/posts/' + post.id, { method: 'DELETE' }).then(function () {
            close();
            loadAll();
          });
        });
        footer.appendChild(del);

        var spacer = el('div');
        spacer.style.flex = '1';
        footer.appendChild(spacer);
      }

      var cancel = el('button', 'sch-btn', 'Cancel');
      cancel.addEventListener('click', close);
      footer.appendChild(cancel);

      var save = el('button', 'sch-btn sch-btn-primary', isNew ? 'Create' : 'Save');
      save.addEventListener('click', function () {
        save.disabled = true;
        var payload = {
          title: data.title,
          content: data.content,
          platforms: data.platforms,
          sourceType: data.sourceType,
          scheduledAt: data.scheduledAt || null,
          linkUrl: data.linkUrl || null,
          hashtags: data.hashtags || null,
          notes: data.notes || null,
          status: data.status,
          clientId: data.clientId,
          mediaUrls: data.mediaUrls || []
        };
        var p = isNew
          ? api('/posts', { method: 'POST', body: JSON.stringify(payload) })
          : api('/posts/' + post.id, { method: 'PATCH', body: JSON.stringify(payload) });
        p.then(function () {
          close();
          loadAll();
        }).catch(function (err) {
          alert('Save failed: ' + err.message);
          save.disabled = false;
        });
      });
      footer.appendChild(save);
    });
  }

  function toLocalDT(iso) {
    if (!iso) return '';
    var d = new Date(iso);
    return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate())
         + 'T' + pad(d.getHours()) + ':' + pad(d.getMinutes());
  }

  function field(label, inputEl) {
    var wrap = el('div', 'sch-field');
    wrap.appendChild(el('label', 'sch-field-label', label));
    wrap.appendChild(inputEl);
    return wrap;
  }

  function input(type, value, onInput) {
    var i = el('input');
    i.type = type;
    i.value = value || '';
    i.addEventListener('input', function () { onInput(i.value); });
    return i;
  }

  function textarea(value, onInput) {
    var t = el('textarea');
    t.value = value || '';
    t.addEventListener('input', function () { onInput(t.value); });
    return t;
  }

  function select(options, value, onChange, labels) {
    var s = el('select');
    options.forEach(function (o) {
      var opt = el('option', null, labels && labels[o] ? labels[o] : o);
      opt.value = o;
      if (o === value) opt.selected = true;
      s.appendChild(opt);
    });
    s.addEventListener('change', function () { onChange(s.value); });
    return s;
  }

  // ---------------- credentials modal ----------------
  // The modal remembers its filter across re-renders inside the same session
  var credModalFilter = 'all'; // 'all' | 'agency' | <client id as string>

  function openCredentialsModal() {
    var body = el('div');

    // Filter row — lets the user narrow the connected-account list to a single owner
    var filterRow = el('div', 'sch-cred-filter-row');
    filterRow.appendChild(el('label', 'sch-field-label', 'Show accounts for:'));
    var filterOptions = ['all', 'agency'].concat(state.clients.map(function (c) { return String(c.id); }));
    var filterLabels = { all: 'All', agency: 'Agency (Own accounts)' };
    state.clients.forEach(function (c) { filterLabels[String(c.id)] = c.name; });
    filterRow.appendChild(select(filterOptions, credModalFilter, function (v) {
      credModalFilter = v;
      modal.close();
      openCredentialsModal();
    }, filterLabels));
    body.appendChild(filterRow);

    body.appendChild(el('h4', 'sch-section-title', 'Connected Accounts'));

    // Apply the filter to the cred list before rendering
    var visibleCreds = state.creds.filter(function (c) {
      if (credModalFilter === 'all') return true;
      if (credModalFilter === 'agency') return c.clientId == null;
      return String(c.clientId) === credModalFilter;
    });

    var list = el('div', 'sch-cred-list');
    if (visibleCreds.length === 0) {
      var msg = state.creds.length === 0
        ? 'No social accounts connected yet. Add one below to enable auto-posting.'
        : 'No accounts match this filter. Pick a different owner above, or add one below.';
      list.appendChild(el('div', 'sch-cred-empty', msg));
    } else {
      visibleCreds.forEach(function (c) {
        var item = el('div', 'sch-cred-item');

        var info = el('div', 'sch-cred-info');
        var pf = el('div', 'sch-cred-platform');
        var dot = el('span', 'sch-cred-status' + (c.isActive ? ' active' : ''));
        pf.appendChild(dot);
        pf.appendChild(document.createTextNode(' ' + c.platform));
        info.appendChild(pf);
        info.appendChild(el('div', 'sch-cred-account',
          c.accountName + (c.accountHandle ? ' (' + c.accountHandle + ')' : '')));
        // Owner badge — agency-owned accounts get a neutral badge, client-owned get an accent badge
        var ownerLabel = c.clientId == null ? 'Agency' : (c.clientName || ('Client #' + c.clientId));
        var ownerBadge = el('div',
          'sch-cred-owner' + (c.clientId == null ? ' agency' : ' client'),
          ownerLabel);
        info.appendChild(ownerBadge);
        item.appendChild(info);

        var actions = el('div', 'sch-cred-actions');
        var verify = el('button', 'sch-btn sch-btn-sm', 'Verify');
        verify.addEventListener('click', function () {
          verify.disabled = true;
          api('/credentials/' + c.id + '/verify', { method: 'POST' })
            .then(function () { loadAll().then(function () {
              modal.close();
              openCredentialsModal();
            }); });
        });
        actions.appendChild(verify);

        var del = el('button', 'sch-btn sch-btn-sm sch-btn-danger', 'Remove');
        del.addEventListener('click', function () {
          if (!confirm('Remove ' + c.platform + ' credential?')) return;
          api('/credentials/' + c.id, { method: 'DELETE' }).then(function () {
            loadAll().then(function () {
              modal.close();
              openCredentialsModal();
            });
          });
        });
        actions.appendChild(del);

        item.appendChild(actions);
        list.appendChild(item);
      });
    }
    body.appendChild(list);

    body.appendChild(el('div', 'sch-divider'));
    body.appendChild(el('h4', 'sch-section-title', 'Add New Account'));

    // Pre-select the new account's owner from the current filter, so adding
    // an account while filtered to a client defaults to that client.
    var defaultClientId = null;
    if (credModalFilter !== 'all' && credModalFilter !== 'agency') {
      defaultClientId = Number(credModalFilter);
    }

    var newCred = {
      platform: 'facebook',
      accountName: '',
      accountHandle: '',
      credentials: {},
      clientId: defaultClientId
    };

    var addForm = el('div');

    // Owner select — first field because it determines who the account belongs to
    var ownerOptions = ['agency'].concat(state.clients.map(function (c) { return String(c.id); }));
    var ownerLabels = { agency: 'Agency (Own accounts)' };
    state.clients.forEach(function (c) { ownerLabels[String(c.id)] = c.name; });
    var initialOwner = newCred.clientId == null ? 'agency' : String(newCred.clientId);
    addForm.appendChild(field('Owner', select(ownerOptions, initialOwner, function (v) {
      newCred.clientId = (v === 'agency') ? null : Number(v);
    }, ownerLabels)));

    // Platform select rebuilds field section on change
    var fieldsHost = el('div');
    function rebuildFields() {
      while (fieldsHost.firstChild) fieldsHost.removeChild(fieldsHost.firstChild);
      newCred.credentials = {};
      var fields = PLATFORM_FIELDS[newCred.platform] || ['Access Token'];
      fields.forEach(function (f) {
        var key = f.toLowerCase().replace(/[^a-z0-9]+/g, '_');
        fieldsHost.appendChild(field(f, input(
          (f.toLowerCase().indexOf('token') !== -1 || f.toLowerCase().indexOf('secret') !== -1 || f.toLowerCase().indexOf('key') !== -1) ? 'password' : 'text',
          '',
          function (v) { newCred.credentials[key] = v; }
        )));
      });
    }

    var platRow = el('div', 'sch-field-row');
    platRow.appendChild(field('Platform', select(PLATFORMS, newCred.platform, function (v) {
      newCred.platform = v;
      rebuildFields();
    })));
    platRow.appendChild(field('Account Name', input('text', '', function (v) { newCred.accountName = v; })));
    addForm.appendChild(platRow);

    addForm.appendChild(field('Handle (optional)', input('text', '', function (v) { newCred.accountHandle = v; })));

    addForm.appendChild(fieldsHost);
    rebuildFields();

    body.appendChild(addForm);

    var modal = openModal('Social Media Credentials', body, function (footer, close) {
      var cancel = el('button', 'sch-btn', 'Close');
      cancel.addEventListener('click', close);
      footer.appendChild(cancel);

      var save = el('button', 'sch-btn sch-btn-primary', 'Save Account');
      save.addEventListener('click', function () {
        if (!newCred.accountName) {
          alert('Account name is required.');
          return;
        }
        save.disabled = true;
        api('/credentials', {
          method: 'POST',
          body: JSON.stringify(newCred)
        }).then(function () {
          loadAll().then(function () {
            close();
            openCredentialsModal();
          });
        }).catch(function (err) {
          alert('Save failed: ' + err.message);
          save.disabled = false;
        });
      });
      footer.appendChild(save);
    });
  }

  // ---------------- settings page ----------------
  window.renderSocialSettingsPage = function (container) {
    container.innerHTML = '';
    container.style.padding = '24px';
    container.style.overflowY = 'auto';
    container.style.boxSizing = 'border-box';

    var root = el('div', 'sch-settings-root');
    container.appendChild(root);

    function renderSettings() {
      while (root.firstChild) root.removeChild(root.firstChild);

      // --- Clients section ---
      var clientsHeader = el('div', 'sch-settings-section-header');
      clientsHeader.appendChild(el('h3', 'sch-settings-title', 'Clients'));
      var addClientBtn = el('button', 'sch-btn sch-btn-sm sch-btn-primary', '+ Add Client');
      clientsHeader.appendChild(addClientBtn);
      root.appendChild(clientsHeader);

      // Inline add-client form (hidden until button clicked)
      var addClientForm = el('div', 'sch-settings-add-form');
      addClientForm.style.display = 'none';
      var newClientName = el('input');
      newClientName.type = 'text';
      newClientName.placeholder = 'Client name…';
      newClientName.className = 'sch-settings-input';
      var newClientEmail = el('input');
      newClientEmail.type = 'email';
      newClientEmail.placeholder = 'Email (optional)';
      newClientEmail.className = 'sch-settings-input';
      var newClientPhone = el('input');
      newClientPhone.type = 'tel';
      newClientPhone.placeholder = 'Phone (optional)';
      newClientPhone.className = 'sch-settings-input';
      var saveClientBtn = el('button', 'sch-btn sch-btn-sm sch-btn-primary', 'Save');
      var cancelClientBtn = el('button', 'sch-btn sch-btn-sm', 'Cancel');
      addClientForm.appendChild(newClientName);
      addClientForm.appendChild(newClientEmail);
      addClientForm.appendChild(newClientPhone);
      addClientForm.appendChild(saveClientBtn);
      addClientForm.appendChild(cancelClientBtn);
      root.appendChild(addClientForm);

      addClientBtn.addEventListener('click', function () {
        addClientForm.style.display = addClientForm.style.display === 'none' ? 'flex' : 'none';
        if (addClientForm.style.display !== 'none') newClientName.focus();
      });
      cancelClientBtn.addEventListener('click', function () {
        addClientForm.style.display = 'none';
        newClientName.value = '';
        newClientEmail.value = '';
        newClientPhone.value = '';
      });
      saveClientBtn.addEventListener('click', function () {
        var name = newClientName.value.trim();
        if (!name) { alert('Client name is required.'); return; }
        saveClientBtn.disabled = true;
        var h = { 'Content-Type': 'application/json' };
        if (window.getAuthHeaders) { var a = window.getAuthHeaders(); for (var k in a) h[k] = a[k]; }
        fetch('/api/clients', {
          method: 'POST',
          headers: h,
          body: JSON.stringify({ name: name, email: newClientEmail.value.trim() || null, phone: newClientPhone.value.trim() || null })
        })
        .then(function (r) { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); })
        .then(function () {
          // Reload state then re-render settings
          return loadAll();
        })
        .then(function () { renderSettings(); })
        .catch(function (err) {
          alert('Failed to create client: ' + err.message);
          saveClientBtn.disabled = false;
        });
      });

      // Client list — each card shows their social accounts
      var clientList = el('div', 'sch-settings-client-list');

      // Agency row first
      clientList.appendChild(buildClientSettingsCard(null, 'Agency (Own accounts)'));

      // All CRM clients
      state.clients.forEach(function (c) {
        clientList.appendChild(buildClientSettingsCard(c.id, c.name));
      });

      root.appendChild(clientList);
    }

    function buildClientSettingsCard(clientId, clientName) {
      var card = el('div', 'sch-settings-client-card');

      var cardHeader = el('div', 'sch-settings-client-header');
      cardHeader.appendChild(el('span', 'sch-settings-client-name', clientName));
      var addAccBtn = el('button', 'sch-btn sch-btn-sm', '+ Connect Account');
      cardHeader.appendChild(addAccBtn);
      card.appendChild(cardHeader);

      // Accounts belonging to this client
      var myAccounts = state.creds.filter(function (c) {
        if (clientId == null) return c.clientId == null;
        return Number(c.clientId) === Number(clientId);
      });

      var accList = el('div', 'sch-settings-acc-list');
      if (myAccounts.length === 0) {
        accList.appendChild(el('div', 'sch-settings-acc-empty', 'No accounts connected yet.'));
      } else {
        myAccounts.forEach(function (acc) {
          var row = el('div', 'sch-settings-acc-row');

          var dot = el('span', 'sch-cred-status' + (acc.isActive ? ' active' : ''));
          row.appendChild(dot);

          var info = el('span', 'sch-settings-acc-info');
          info.textContent = acc.platform + ' · ' + acc.accountName + (acc.accountHandle ? ' (' + acc.accountHandle + ')' : '');
          row.appendChild(info);

          var acts = el('div', 'sch-settings-acc-acts');

          var verifyBtn = el('button', 'sch-btn sch-btn-sm', 'Verify');
          verifyBtn.addEventListener('click', function () {
            verifyBtn.disabled = true;
            api('/credentials/' + acc.id + '/verify', { method: 'POST' })
              .then(function () { return loadAll(); })
              .then(function () { renderSettings(); });
          });
          acts.appendChild(verifyBtn);

          var removeBtn = el('button', 'sch-btn sch-btn-sm sch-btn-danger', 'Remove');
          removeBtn.addEventListener('click', function () {
            if (!confirm('Remove ' + acc.platform + ' account?')) return;
            api('/credentials/' + acc.id, { method: 'DELETE' })
              .then(function () { return loadAll(); })
              .then(function () { renderSettings(); });
          });
          acts.appendChild(removeBtn);

          row.appendChild(acts);
          accList.appendChild(row);
        });
      }
      card.appendChild(accList);

      // Inline add-account form (hidden until button clicked)
      var addAccForm = el('div', 'sch-settings-add-acc-form');
      addAccForm.style.display = 'none';
      var newAcc = { platform: 'facebook', accountName: '', accountHandle: '', credentials: {}, clientId: clientId };

      var platRow = el('div', 'sch-settings-add-acc-row');
      // Platform select
      var platSel = document.createElement('select');
      platSel.className = 'sch-settings-select';
      PLATFORMS.forEach(function (p) {
        var o = document.createElement('option');
        o.value = p;
        o.textContent = p.charAt(0).toUpperCase() + p.slice(1);
        platSel.appendChild(o);
      });
      platSel.addEventListener('change', function () { newAcc.platform = platSel.value; rebuildCredFields(); });
      platRow.appendChild(platSel);

      var accNameInput = el('input');
      accNameInput.type = 'text';
      accNameInput.placeholder = 'Account name';
      accNameInput.className = 'sch-settings-input';
      accNameInput.addEventListener('input', function () { newAcc.accountName = accNameInput.value; });
      platRow.appendChild(accNameInput);

      var handleInput = el('input');
      handleInput.type = 'text';
      handleInput.placeholder = 'Handle (optional)';
      handleInput.className = 'sch-settings-input';
      handleInput.addEventListener('input', function () { newAcc.accountHandle = handleInput.value; });
      platRow.appendChild(handleInput);

      addAccForm.appendChild(platRow);

      var credFieldsHost = el('div', 'sch-settings-cred-fields');
      function rebuildCredFields() {
        while (credFieldsHost.firstChild) credFieldsHost.removeChild(credFieldsHost.firstChild);
        newAcc.credentials = {};
        var flds = PLATFORM_FIELDS[newAcc.platform] || ['Access Token'];
        flds.forEach(function (f) {
          var key = f.toLowerCase().replace(/[^a-z0-9]+/g, '_');
          var isSecret = f.toLowerCase().indexOf('token') !== -1 || f.toLowerCase().indexOf('secret') !== -1 || f.toLowerCase().indexOf('key') !== -1;
          var inp = el('input');
          inp.type = isSecret ? 'password' : 'text';
          inp.placeholder = f;
          inp.className = 'sch-settings-input';
          inp.addEventListener('input', function () { newAcc.credentials[key] = inp.value; });
          credFieldsHost.appendChild(inp);
        });
      }
      rebuildCredFields();
      addAccForm.appendChild(credFieldsHost);

      var accFormBtns = el('div', 'sch-settings-form-btns');
      var saveAccBtn = el('button', 'sch-btn sch-btn-sm sch-btn-primary', 'Save Account');
      var cancelAccBtn = el('button', 'sch-btn sch-btn-sm', 'Cancel');
      saveAccBtn.addEventListener('click', function () {
        if (!newAcc.accountName.trim()) { alert('Account name is required.'); return; }
        saveAccBtn.disabled = true;
        api('/credentials', { method: 'POST', body: JSON.stringify(newAcc) })
          .then(function () { return loadAll(); })
          .then(function () { renderSettings(); })
          .catch(function (err) {
            alert('Save failed: ' + err.message);
            saveAccBtn.disabled = false;
          });
      });
      cancelAccBtn.addEventListener('click', function () {
        addAccForm.style.display = 'none';
      });
      accFormBtns.appendChild(saveAccBtn);
      accFormBtns.appendChild(cancelAccBtn);
      addAccForm.appendChild(accFormBtns);
      card.appendChild(addAccForm);

      addAccBtn.addEventListener('click', function () {
        addAccForm.style.display = addAccForm.style.display === 'none' ? 'block' : 'none';
      });

      return card;
    }

    // Load state then render (re-use loadAll which populates state.clients + state.creds)
    loadAll().then(function () { renderSettings(); });
  };

  // ---------------- public entry ----------------
  // options: { sourceFilter?: 'content-calendar'|'agri4all'|'own-sm'|'all' }
  // When a sourceFilter is passed, the scheduler locks to that source and
  // hides its internal source switcher — the caller's navigation (e.g. the
  // dept tab nav) is expected to drive source switching instead.
  window.renderSocialSchedulerPage = function (container, options) {
    options = options || {};
    state.container = container;
    state.cursor = new Date();
    if (options.sourceFilter) {
      state.sourceFilter = options.sourceFilter;
      state.presetSource = true;
    } else {
      state.sourceFilter = 'all';
      state.presetSource = false;
    }
    // initial empty render so user sees layout immediately
    render();
    loadAll();
  };
})();
