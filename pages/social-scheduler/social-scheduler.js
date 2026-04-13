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

  var PLATFORM_MANUAL_CONFIG = {
    facebook: {
      requiredFields: [
        { label: 'Page ID', key: 'page_id' },
        { label: 'Access Token', key: 'access_token', secret: true }
      ],
      identityLabel: 'Page Name',
      identityPlaceholder: 'Optional display name for this page',
      handleLabel: 'Page Handle',
      handlePlaceholder: 'Optional page handle or username'
    },
    instagram: {
      requiredFields: [
        { label: 'Instagram Business Account ID', key: 'ig_user_id' },
        { label: 'Access Token', key: 'access_token', secret: true }
      ],
      identityLabel: 'Account Name',
      identityPlaceholder: 'Optional display name for this Instagram account',
      handleLabel: 'Instagram Username',
      handlePlaceholder: 'Optional username without @'
    },
    twitter: {
      requiredFields: [
        { label: 'Access Token', key: 'access_token', secret: true }
      ],
      identityLabel: 'Profile Name',
      identityPlaceholder: 'Optional display name for this X account',
      handleLabel: 'Username',
      handlePlaceholder: 'Optional username without @'
    },
    linkedin: {
      requiredFields: [
        { label: 'Person URN', key: 'person_urn' },
        { label: 'Access Token', key: 'access_token', secret: true }
      ],
      identityLabel: 'Profile Name',
      identityPlaceholder: 'Optional display name for this LinkedIn profile',
      handleLabel: 'LinkedIn ID',
      handlePlaceholder: 'Optional LinkedIn member ID'
    },
    youtube: {
      requiredFields: [
        { label: 'Channel ID', key: 'channel_id' },
        { label: 'Access Token', key: 'access_token', secret: true }
      ],
      optionalFields: [
        { label: 'Refresh Token', key: 'refresh_token', secret: true }
      ],
      identityLabel: 'Channel Name',
      identityPlaceholder: 'Optional display name for this channel',
      handleLabel: 'Channel Handle',
      handlePlaceholder: 'Optional @channel handle'
    },
    tiktok: {
      requiredFields: [
        { label: 'Open ID', key: 'open_id' },
        { label: 'Access Token', key: 'access_token', secret: true }
      ],
      optionalFields: [
        { label: 'Refresh Token', key: 'refresh_token', secret: true }
      ],
      identityLabel: 'Profile Name',
      identityPlaceholder: 'Optional display name for this TikTok account',
      handleLabel: 'TikTok Username',
      handlePlaceholder: 'Optional username without @'
    }
  };

  function getPlatformManualConfig(platform) {
    return PLATFORM_MANUAL_CONFIG[platform] || {
      requiredFields: [{ label: 'Access Token', key: 'access_token', secret: true }],
      optionalFields: [],
      identityLabel: 'Account Name',
      identityPlaceholder: 'Optional account name',
      handleLabel: 'Handle / ID',
      handlePlaceholder: 'Optional handle or ID'
    };
  }

  function buildManualCredentialState(platform) {
    var config = getPlatformManualConfig(platform);
    var credentials = {};
    (config.requiredFields || []).concat(config.optionalFields || []).forEach(function (field) {
      credentials[field.key] = '';
    });
    return credentials;
  }

  function defaultAccountName(platform, handle, identity) {
    var info = PLATFORM_INFO[platform] || { label: platform };
    return identity || handle || (info.label + ' account');
  }

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

  var VIDEO_EXTS = /\.(mp4|webm|mov|avi|mkv|m4v|ogv)(\?|$)/i;
  function isVideoUrl(url) { return VIDEO_EXTS.test(url || ''); }

  function openPostModal(post) {
    var isNew = !post || !post.id;
    var data = Object.assign({
      title: '',
      content: '',
      platforms: [],
      sourceType: state.sourceFilter !== 'all' ? state.sourceFilter : 'content-calendar',
      scheduledAt: '',
      status: 'draft',
      clientId: null
    }, post || {});

    if (!Array.isArray(data.mediaUrls)) data.mediaUrls = [];

    var form = el('div', 'sch-post-form');
    var carouselIdx = 0;

    // ─── Media carousel / video preview ────────────────────────
    var mediaSection = el('div', 'sch-carousel-section');
    var carouselViewport = el('div', 'sch-carousel-viewport');
    var carouselTrack = el('div', 'sch-carousel-track');
    carouselViewport.appendChild(carouselTrack);

    var prevArrow = el('button', 'sch-carousel-arrow sch-carousel-prev');
    prevArrow.innerHTML = '&#8249;';
    prevArrow.addEventListener('click', function () { goSlide(carouselIdx - 1); });
    var nextArrow = el('button', 'sch-carousel-arrow sch-carousel-next');
    nextArrow.innerHTML = '&#8250;';
    nextArrow.addEventListener('click', function () { goSlide(carouselIdx + 1); });

    var dotsWrap = el('div', 'sch-carousel-dots');
    var counterEl = el('div', 'sch-carousel-counter');

    // Add media row
    var addMediaRow = el('div', 'sch-carousel-add-row');
    var addUrlInput = el('input');
    addUrlInput.type = 'url';
    addUrlInput.placeholder = 'Paste image or video URL…';
    addUrlInput.className = 'sch-carousel-url-input';
    var addMediaBtn = el('button', 'sch-btn sch-btn-sm', '+ Add');
    addMediaBtn.addEventListener('click', function () {
      var v = addUrlInput.value.trim();
      if (v) {
        data.mediaUrls.push(v);
        addUrlInput.value = '';
        rebuildCarousel();
        goSlide(data.mediaUrls.length - 1);
      }
    });
    addUrlInput.addEventListener('keydown', function (e) {
      if (e.key === 'Enter') { e.preventDefault(); addMediaBtn.click(); }
    });
    addMediaRow.appendChild(addUrlInput);
    addMediaRow.appendChild(addMediaBtn);

    function rebuildCarousel() {
      while (carouselTrack.firstChild) carouselTrack.removeChild(carouselTrack.firstChild);
      while (dotsWrap.firstChild) dotsWrap.removeChild(dotsWrap.firstChild);

      if (data.mediaUrls.length === 0) {
        var placeholder = el('div', 'sch-carousel-empty');
        placeholder.appendChild(svg('M21 19V5c0-1.1-.9-2-2-2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2zM8.5 13.5l2.5 3.01L14.5 12l4.5 6H5l3.5-4.5z', 48));
        placeholder.appendChild(el('div', 'sch-carousel-empty-text', 'No media added yet'));
        carouselTrack.appendChild(placeholder);
        prevArrow.style.display = 'none';
        nextArrow.style.display = 'none';
        counterEl.textContent = '';
        return;
      }

      data.mediaUrls.forEach(function (url, idx) {
        var slide = el('div', 'sch-carousel-slide');
        if (isVideoUrl(url)) {
          var video = document.createElement('video');
          video.src = url;
          video.controls = true;
          video.preload = 'metadata';
          video.playsInline = true;
          slide.appendChild(video);
        } else {
          var img = document.createElement('img');
          img.src = url;
          img.alt = 'Media ' + (idx + 1);
          img.addEventListener('error', function () {
            img.style.display = 'none';
            var err = el('div', 'sch-carousel-img-error', 'Failed to load image');
            slide.appendChild(err);
          });
          slide.appendChild(img);
        }
        // Remove button per slide
        var rmBtn = el('button', 'sch-carousel-rm', '×');
        rmBtn.title = 'Remove this media';
        rmBtn.addEventListener('click', function (e) {
          e.stopPropagation();
          data.mediaUrls.splice(idx, 1);
          if (carouselIdx >= data.mediaUrls.length) carouselIdx = Math.max(0, data.mediaUrls.length - 1);
          rebuildCarousel();
          goSlide(carouselIdx);
        });
        slide.appendChild(rmBtn);
        carouselTrack.appendChild(slide);

        // Dot
        var dot = el('button', 'sch-carousel-dot' + (idx === carouselIdx ? ' active' : ''));
        (function (i) { dot.addEventListener('click', function () { goSlide(i); }); })(idx);
        dotsWrap.appendChild(dot);
      });

      var show = data.mediaUrls.length > 1;
      prevArrow.style.display = show ? '' : 'none';
      nextArrow.style.display = show ? '' : 'none';
      updateSlidePosition();
    }

    function goSlide(idx) {
      if (data.mediaUrls.length === 0) return;
      carouselIdx = ((idx % data.mediaUrls.length) + data.mediaUrls.length) % data.mediaUrls.length;
      updateSlidePosition();
    }

    function updateSlidePosition() {
      carouselTrack.style.transform = 'translateX(-' + (carouselIdx * 100) + '%)';
      counterEl.textContent = data.mediaUrls.length > 0
        ? (carouselIdx + 1) + ' / ' + data.mediaUrls.length
        : '';
      var dots = dotsWrap.children;
      for (var i = 0; i < dots.length; i++) {
        dots[i].classList.toggle('active', i === carouselIdx);
      }
      // Pause videos not visible
      var slides = carouselTrack.children;
      for (var j = 0; j < slides.length; j++) {
        var vid = slides[j].querySelector('video');
        if (vid && j !== carouselIdx) vid.pause();
      }
    }

    mediaSection.appendChild(carouselViewport);
    mediaSection.appendChild(prevArrow);
    mediaSection.appendChild(nextArrow);
    mediaSection.appendChild(dotsWrap);
    mediaSection.appendChild(counterEl);
    mediaSection.appendChild(addMediaRow);
    rebuildCarousel();
    form.appendChild(mediaSection);

    // ─── Title ─────────────────────────────────────────────────
    form.appendChild(field('Title',
      input('text', data.title, function (v) { data.title = v; })));

    // ─── Caption ───────────────────────────────────────────────
    form.appendChild(field('Caption',
      textarea(data.content, function (v) { data.content = v; })));

    // ─── Client (searchable dropdown) ──────────────────────────
    var clientField = el('div', 'sch-field');
    clientField.appendChild(el('label', 'sch-field-label', 'Client'));

    var clientDropdown = el('div', 'sch-search-select');
    var clientDisplay = el('div', 'sch-search-select-display');
    var currentLabel = data.clientId == null ? 'Agency (Own accounts)' : '';
    if (data.clientId != null) {
      for (var ci = 0; ci < state.clients.length; ci++) {
        if (Number(state.clients[ci].id) === Number(data.clientId)) {
          currentLabel = state.clients[ci].name;
          break;
        }
      }
    }
    clientDisplay.textContent = currentLabel || 'Select client…';
    var clientChevron = el('span', 'sch-search-select-chevron', '▾');
    clientDisplay.appendChild(clientChevron);
    clientDropdown.appendChild(clientDisplay);

    var clientPanel = el('div', 'sch-search-select-panel');
    clientPanel.style.display = 'none';
    var clientSearchInput = el('input');
    clientSearchInput.type = 'text';
    clientSearchInput.placeholder = 'Search clients…';
    clientSearchInput.className = 'sch-search-select-input';
    clientPanel.appendChild(clientSearchInput);
    var clientOptionsList = el('div', 'sch-search-select-options');
    clientPanel.appendChild(clientOptionsList);
    clientDropdown.appendChild(clientPanel);

    var allClientItems = [{ key: 'agency', label: 'Agency (Own accounts)', id: null }];
    state.clients.forEach(function (c) {
      if (c.status !== 'archived') allClientItems.push({ key: String(c.id), label: c.name, id: c.id });
    });

    function renderClientOptions(filter) {
      while (clientOptionsList.firstChild) clientOptionsList.removeChild(clientOptionsList.firstChild);
      var q = (filter || '').toLowerCase();
      allClientItems.forEach(function (item) {
        if (q && item.label.toLowerCase().indexOf(q) === -1) return;
        var isSelected = (data.clientId == null && item.id == null) ||
                         (data.clientId != null && item.id != null && Number(data.clientId) === Number(item.id));
        var opt = el('div', 'sch-search-select-option' + (isSelected ? ' selected' : ''), item.label);
        opt.addEventListener('click', function () {
          data.clientId = item.id ? Number(item.id) : null;
          clientDisplay.textContent = item.label;
          clientDisplay.appendChild(clientChevron);
          clientPanel.style.display = 'none';
          // Update platforms after client change
          var allowed = platformsForClient(data.clientId);
          data.platforms = (data.platforms || []).filter(function (p) { return allowed.indexOf(p) !== -1; });
          renderPlatforms();
        });
        clientOptionsList.appendChild(opt);
      });
    }

    clientDisplay.addEventListener('click', function () {
      var isOpen = clientPanel.style.display !== 'none';
      clientPanel.style.display = isOpen ? 'none' : 'block';
      if (!isOpen) {
        clientSearchInput.value = '';
        renderClientOptions('');
        clientSearchInput.focus();
      }
    });

    clientSearchInput.addEventListener('input', function () {
      renderClientOptions(clientSearchInput.value);
    });

    // Close on outside click
    document.addEventListener('click', function closePanel(e) {
      if (!clientDropdown.contains(e.target)) {
        clientPanel.style.display = 'none';
      }
    });

    clientField.appendChild(clientDropdown);
    form.appendChild(clientField);

    // ─── Platforms (multi-select pills) ────────────────────────
    var platField = el('div', 'sch-field');
    platField.appendChild(el('label', 'sch-field-label', 'Platforms'));
    var platWrap = el('div', 'sch-platform-select');
    platField.appendChild(platWrap);
    form.appendChild(platField);

    function renderPlatforms() {
      while (platWrap.firstChild) platWrap.removeChild(platWrap.firstChild);
      // Show all 6 platforms; connected ones are selectable, others show tooltip
      PLATFORMS.forEach(function (pl) {
        var isConnected = platformsForClient(data.clientId).indexOf(pl) !== -1;
        var isSelected = data.platforms && data.platforms.indexOf(pl) !== -1;
        var info = PLATFORM_INFO ? PLATFORM_INFO[pl] : null;

        var opt = el('div', 'sch-platform-pill' + (isSelected ? ' selected' : '') + (!isConnected ? ' disabled' : ''));

        // Platform icon
        if (info && info.icon) {
          var iconSvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
          iconSvg.setAttribute('width', '14');
          iconSvg.setAttribute('height', '14');
          iconSvg.setAttribute('viewBox', '0 0 24 24');
          iconSvg.setAttribute('fill', 'currentColor');
          var iconPath = document.createElementNS('http://www.w3.org/2000/svg', 'path');
          iconPath.setAttribute('d', info.icon);
          iconSvg.appendChild(iconPath);
          opt.appendChild(iconSvg);
        }

        var label = info ? info.label : pl;
        opt.appendChild(document.createTextNode(' ' + label));

        if (!isConnected) {
          opt.title = 'Not connected — go to Settings to connect ' + label;
        } else {
          opt.addEventListener('click', function () {
            if (!Array.isArray(data.platforms)) data.platforms = [];
            var idx = data.platforms.indexOf(pl);
            if (idx === -1) data.platforms.push(pl);
            else data.platforms.splice(idx, 1);
            renderPlatforms();
          });
        }

        platWrap.appendChild(opt);
      });
    }
    renderPlatforms();

    // ─── Scheduled For ─────────────────────────────────────────
    var schedInput = input('datetime-local', toLocalDT(data.scheduledAt), function (v) {
      data.scheduledAt = v ? new Date(v).toISOString() : null;
    });
    form.appendChild(field('Scheduled For', schedInput));

    // ─── Footer (Delete / Cancel / Save) ───────────────────────
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
          status: data.scheduledAt ? 'scheduled' : 'draft',
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
      credentials: buildManualCredentialState('facebook'),
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
    var identityFieldHost = el('div');
    var handleFieldHost = el('div');
    var identityInput = input('text', '', function (v) { newCred.accountName = v; });
    var handleInput = input('text', '', function (v) { newCred.accountHandle = v; });
    function rebuildFields() {
      var manualConfig = getPlatformManualConfig(newCred.platform);
      while (identityFieldHost.firstChild) identityFieldHost.removeChild(identityFieldHost.firstChild);
      while (handleFieldHost.firstChild) handleFieldHost.removeChild(handleFieldHost.firstChild);
      while (fieldsHost.firstChild) fieldsHost.removeChild(fieldsHost.firstChild);
      newCred.credentials = buildManualCredentialState(newCred.platform);
      identityInput.placeholder = manualConfig.identityPlaceholder || 'Optional account name';
      handleInput.placeholder = manualConfig.handlePlaceholder || 'Optional handle or ID';
      identityFieldHost.appendChild(field((manualConfig.identityLabel || 'Account Name') + ' (optional)', identityInput));
      handleFieldHost.appendChild(field((manualConfig.handleLabel || 'Handle / ID') + ' (optional)', handleInput));
      var allFields = (manualConfig.requiredFields || []).concat(manualConfig.optionalFields || []);
      allFields.forEach(function (fieldConfig) {
        fieldsHost.appendChild(field(fieldConfig.label, input(
          fieldConfig.secret ? 'password' : 'text',
          '',
          function (v) { newCred.credentials[fieldConfig.key] = v; }
        )));
      });
    }

    var platRow = el('div', 'sch-field-row');
    platRow.appendChild(field('Platform', select(PLATFORMS, newCred.platform, function (v) {
      newCred.platform = v;
      rebuildFields();
    })));
    addForm.appendChild(platRow);
    addForm.appendChild(identityFieldHost);
    addForm.appendChild(handleFieldHost);

    addForm.appendChild(fieldsHost);
    rebuildFields();

    body.appendChild(addForm);

    var modal = openModal('Social Media Credentials', body, function (footer, close) {
      var cancel = el('button', 'sch-btn', 'Close');
      cancel.addEventListener('click', close);
      footer.appendChild(cancel);

      var save = el('button', 'sch-btn sch-btn-primary', 'Save Account');
      save.addEventListener('click', function () {
        var manualConfig = getPlatformManualConfig(newCred.platform);
        var missingField = null;
        (manualConfig.requiredFields || []).some(function (fieldConfig) {
          if (!String(newCred.credentials[fieldConfig.key] || '').trim()) {
            missingField = fieldConfig.label;
            return true;
          }
          return false;
        });
        if (missingField) {
          alert(missingField + ' is required.');
          return;
        }
        newCred.accountName = defaultAccountName(newCred.platform, newCred.accountHandle, newCred.accountName && newCred.accountName.trim());
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

  // Platform display info (icons are SVG path data)
  var PLATFORM_INFO = {
    facebook:  { label: 'Facebook',  color: '#1877F2', icon: 'M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z' },
    instagram: { label: 'Instagram', color: '#E4405F', icon: 'M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z' },
    twitter:   { label: 'X / Twitter', color: '#000000', icon: 'M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z' },
    linkedin:  { label: 'LinkedIn',  color: '#0A66C2', icon: 'M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z' },
    youtube:   { label: 'YouTube',   color: '#FF0000', icon: 'M23.498 6.186a3.016 3.016 0 00-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 00.502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 002.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 002.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814z' },
    tiktok:    { label: 'TikTok',    color: '#000000', icon: 'M12.525.02c1.31-.02 2.61-.01 3.91-.02.08 1.53.63 3.09 1.75 4.17 1.12 1.11 2.7 1.62 4.24 1.79v4.03c-1.44-.05-2.89-.35-4.2-.97-.57-.26-1.1-.59-1.62-.93-.01 2.92.01 5.84-.02 8.75-.08 1.4-.54 2.79-1.35 3.94-1.31 1.92-3.58 3.17-5.91 3.21-1.43.08-2.86-.31-4.08-1.03-2.02-1.19-3.44-3.37-3.65-5.71-.02-.5-.03-1-.01-1.49.18-1.9 1.12-3.72 2.58-4.96 1.66-1.44 3.98-2.13 6.15-1.72.02 1.48-.04 2.96-.04 4.44-.99-.32-2.15-.23-3.02.37-.63.41-1.11 1.04-1.36 1.75-.21.51-.15 1.07-.14 1.61.24 1.64 1.82 3.02 3.5 2.87 1.12-.01 2.19-.66 2.77-1.61.19-.33.4-.67.41-1.06.1-1.79.06-3.57.07-5.36.01-4.03-.01-8.05.02-12.07z' }
  };

  // OAuth config cache — which platforms have server-side credentials configured
  var oauthConfigCache = null;

  function fetchOAuthConfig() {
    return fetch('/api/social-oauth/config', { headers: getHeaders() })
      .then(function (r) { return r.ok ? r.json() : { platforms: {} }; })
      .then(function (data) { oauthConfigCache = data.platforms || {}; return oauthConfigCache; })
      .catch(function () { oauthConfigCache = {}; return oauthConfigCache; });
  }

  window.renderSocialSettingsPage = function (container) {
    container.innerHTML = '';
    container.style.padding = '24px';
    container.style.overflowY = 'auto';
    container.style.boxSizing = 'border-box';

    var root = el('div', 'sch-settings-root');
    container.appendChild(root);

    // Track which clients are expanded (all collapsed by default)
    var expandedClients = {};
    var searchQuery = '';

    // Listen for OAuth popup success messages
    function onOAuthMessage(e) {
      if (e.data && e.data.type === 'social-oauth-success') {
        loadAll().then(function () { fetchOAuthConfig().then(renderSettings); });
      }
    }
    window.addEventListener('message', onOAuthMessage);

    // Cleanup listener when the page navigates away
    var observer = new MutationObserver(function () {
      if (!document.contains(root)) {
        window.removeEventListener('message', onOAuthMessage);
        observer.disconnect();
      }
    });
    observer.observe(document.body, { childList: true, subtree: true });

    function renderSettings() {
      while (root.firstChild) root.removeChild(root.firstChild);

      // Header
      var header = el('div', 'sch-settings-section-header');
      header.appendChild(el('h3', 'sch-settings-title', 'Social Media Connections'));
      root.appendChild(header);

      var desc = el('p', 'sch-settings-desc',
        'Connect social media accounts for each client. Click a client to expand, then click a platform to configure it.');
      root.appendChild(desc);

      // Search bar
      var searchWrap = el('div', 'sch-settings-search-wrap');
      var searchIcon = el('span', 'sch-settings-search-icon');
      searchIcon.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/></svg>';
      searchWrap.appendChild(searchIcon);
      var searchInput = el('input', 'sch-settings-search');
      searchInput.type = 'text';
      searchInput.placeholder = 'Search clients...';
      searchInput.value = searchQuery;
      searchInput.addEventListener('input', function () {
        searchQuery = searchInput.value;
        renderClientList();
      });
      searchWrap.appendChild(searchInput);
      root.appendChild(searchWrap);

      // Client list container
      var clientList = el('div', 'sch-settings-client-list');
      clientList.id = 'sch-settings-client-list';
      root.appendChild(clientList);

      renderClientList();
    }

    function renderClientList() {
      var clientList = document.getElementById('sch-settings-client-list');
      if (!clientList) return;
      while (clientList.firstChild) clientList.removeChild(clientList.firstChild);

      var q = searchQuery.trim().toLowerCase();

      // Agency first (always shown unless filtered out)
      if (!q || 'agency'.indexOf(q) !== -1 || 'own accounts'.indexOf(q) !== -1) {
        clientList.appendChild(buildClientCard(null, 'Agency (Own Accounts)'));
      }

      // All CRM clients
      (state.clients || []).forEach(function (c) {
        if (c.status === 'archived') return;
        if (q && (c.name || '').toLowerCase().indexOf(q) === -1) return;
        clientList.appendChild(buildClientCard(c.id, c.name));
      });

      // No results message
      if (!clientList.firstChild) {
        var noResults = el('div', 'sch-settings-no-results', 'No clients match your search.');
        clientList.appendChild(noResults);
      }
    }

    function buildClientCard(clientId, clientName) {
      var cardKey = clientId == null ? 'agency' : String(clientId);
      var isExpanded = !!expandedClients[cardKey];

      var card = el('div', 'sch-settings-client-card' + (isExpanded ? ' expanded' : ''));

      var cardHeader = el('div', 'sch-settings-client-header');
      cardHeader.style.cursor = 'pointer';

      // Chevron
      var chevron = el('span', 'sch-settings-chevron');
      chevron.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"/></svg>';
      cardHeader.appendChild(chevron);

      var nameEl = el('span', 'sch-settings-client-name', clientName);
      cardHeader.appendChild(nameEl);

      // Count connected platforms
      var connectedCount = 0;
      PLATFORMS.forEach(function (p) {
        if (findCred(clientId, p)) connectedCount++;
      });
      if (connectedCount > 0) {
        var badge = el('span', 'sch-settings-connected-badge', connectedCount + '/' + PLATFORMS.length);
        cardHeader.appendChild(badge);
      }

      // Toggle expand/collapse on header click
      cardHeader.addEventListener('click', function () {
        expandedClients[cardKey] = !expandedClients[cardKey];
        renderClientList();
      });

      card.appendChild(cardHeader);

      // Platform grid (only rendered when expanded)
      if (isExpanded) {
        var grid = el('div', 'sch-settings-platform-grid');
        PLATFORMS.forEach(function (platform) {
          grid.appendChild(buildPlatformTile(clientId, platform));
        });
        card.appendChild(grid);
      }

      return card;
    }

    function findCred(clientId, platform) {
      var key = (clientId == null) ? null : Number(clientId);
      for (var i = 0; i < state.creds.length; i++) {
        var c = state.creds[i];
        var cKey = (c.clientId == null) ? null : Number(c.clientId);
        if (cKey === key && c.platform === platform && c.isActive) return c;
      }
      return null;
    }

    function buildPlatformTile(clientId, platform) {
      var info = PLATFORM_INFO[platform] || { label: platform, color: '#666', icon: '' };
      var cred = findCred(clientId, platform);
      var isConnected = !!cred;

      var tile = el('div', 'sch-platform-tile' + (isConnected ? ' connected' : ''));
      tile.style.cursor = 'pointer';
      if (isConnected) {
        tile.style.borderColor = info.color;
      }

      // Platform icon
      var iconWrap = el('div', 'sch-platform-tile-icon');
      iconWrap.style.color = isConnected ? info.color : '';
      iconWrap.appendChild(svg(info.icon, 28));
      tile.appendChild(iconWrap);

      // Platform name
      tile.appendChild(el('div', 'sch-platform-tile-name', info.label));

      // Status text
      if (isConnected) {
        var statusEl = el('div', 'sch-platform-tile-status-text connected');
        statusEl.textContent = cred.accountName || 'Connected';
        tile.appendChild(statusEl);
      } else {
        tile.appendChild(el('div', 'sch-platform-tile-status-text', 'Not Configured'));
      }

      // Click to open config panel
      tile.addEventListener('click', function () {
        openConfigPanel(clientId, platform);
      });

      return tile;
    }

    // ── Config Panel (overlay) ──
    function openConfigPanel(clientId, platform) {
      var info = PLATFORM_INFO[platform] || { label: platform, color: '#666', icon: '' };
      var cred = findCred(clientId, platform);
      var isConnected = !!cred;
      var isOAuthConfigured = oauthConfigCache && oauthConfigCache[platform];
      var clientName = clientId == null ? 'Agency (Own Accounts)' : '';
      if (clientId != null) {
        (state.clients || []).forEach(function (c) { if (c.id === clientId) clientName = c.name; });
      }

      // Remove any existing panel
      var existing = document.querySelector('.sch-config-overlay');
      if (existing) existing.remove();

      // Overlay
      var overlay = el('div', 'sch-config-overlay');
      var panel = el('div', 'sch-config-panel');

      // Close button
      var closeBtn = el('button', 'sch-config-close');
      closeBtn.innerHTML = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 6L6 18M6 6l12 12"/></svg>';
      closeBtn.addEventListener('click', function () { overlay.remove(); });
      panel.appendChild(closeBtn);

      // Platform header with icon
      var panelHeader = el('div', 'sch-config-header');
      var bigIcon = el('div', 'sch-config-icon');
      bigIcon.style.color = info.color;
      bigIcon.appendChild(svg(info.icon, 40));
      panelHeader.appendChild(bigIcon);
      var headerText = el('div', 'sch-config-header-text');
      headerText.appendChild(el('h3', 'sch-config-title', info.label));
      headerText.appendChild(el('div', 'sch-config-subtitle', clientName));
      panelHeader.appendChild(headerText);
      panel.appendChild(panelHeader);

      // Divider
      panel.appendChild(el('hr', 'sch-config-divider'));

      if (isConnected) {
        // Connected state — show info + disconnect
        var connBadge = el('div', 'sch-config-status-badge connected');
        connBadge.textContent = 'Connected';
        panel.appendChild(connBadge);

        var infoSection = el('div', 'sch-config-info-section');
        if (cred.accountName) {
          infoSection.appendChild(el('div', 'sch-config-info-label', 'Account'));
          infoSection.appendChild(el('div', 'sch-config-info-value', cred.accountName));
        }
        if (cred.accountHandle) {
          infoSection.appendChild(el('div', 'sch-config-info-label', 'Handle'));
          infoSection.appendChild(el('div', 'sch-config-info-value', cred.accountHandle));
        }
        if (cred.lastVerifiedAt) {
          infoSection.appendChild(el('div', 'sch-config-info-label', 'Last Verified'));
          infoSection.appendChild(el('div', 'sch-config-info-value', new Date(cred.lastVerifiedAt).toLocaleDateString()));
        }
        panel.appendChild(infoSection);

        var disconnectBtn = el('button', 'sch-btn sch-btn-danger sch-config-action-btn', 'Disconnect');
        disconnectBtn.addEventListener('click', function () {
          if (!confirm('Disconnect ' + info.label + ' for ' + clientName + '?')) return;
          disconnectBtn.disabled = true;
          disconnectBtn.textContent = 'Disconnecting...';
          api('/credentials/' + cred.id, { method: 'DELETE' })
            .then(function () { return loadAll(); })
            .then(function () {
              overlay.remove();
              renderSettings();
            });
        });
        panel.appendChild(disconnectBtn);
      } else {
        // Not connected
        var notBadge = el('div', 'sch-config-status-badge');
        notBadge.textContent = 'Not Connected';
        panel.appendChild(notBadge);

        // Option 1: OAuth connect
        if (isOAuthConfigured) {
          var oauthSection = el('div', 'sch-config-section');
          oauthSection.appendChild(el('div', 'sch-config-section-title', 'Connect via OAuth'));
          oauthSection.appendChild(el('div', 'sch-config-section-desc', 'Sign in with your ' + info.label + ' account to connect automatically.'));
          var oauthBtn = el('button', 'sch-btn sch-btn-primary sch-config-action-btn', 'Connect with ' + info.label);
          oauthBtn.addEventListener('click', function () {
            oauthBtn.disabled = true;
            oauthBtn.textContent = 'Connecting...';
            var qp = clientId ? '?clientId=' + clientId : '';
            fetch('/api/social-oauth/init/' + platform + qp, { headers: getHeaders() })
              .then(function (r) { return r.json(); })
              .then(function (data) {
                if (data.error) { alert(data.error); oauthBtn.disabled = false; oauthBtn.textContent = 'Connect with ' + info.label; return; }
                var w = 600, h = 700, left = (screen.width - w) / 2, top = (screen.height - h) / 2;
                window.open(data.url, 'social_oauth_' + platform, 'width=' + w + ',height=' + h + ',left=' + left + ',top=' + top + ',toolbar=no,menubar=no');
                setTimeout(function () { oauthBtn.disabled = false; oauthBtn.textContent = 'Connect with ' + info.label; }, 3000);
              })
              .catch(function () { oauthBtn.disabled = false; oauthBtn.textContent = 'Connect with ' + info.label; });
          });
          oauthSection.appendChild(oauthBtn);
          panel.appendChild(oauthSection);

          panel.appendChild(el('div', 'sch-config-or', '— or —'));
        }

        // Option 2: Manual entry
        var manualConfig = getPlatformManualConfig(platform);
        var manualSection = el('div', 'sch-config-section');
        manualSection.appendChild(el('div', 'sch-config-section-title', 'Manual Configuration'));
        manualSection.appendChild(el('div', 'sch-config-section-desc', 'Only enter the fields this account actually needs.'));

        var nameInput = el('input', 'sch-config-input');
        nameInput.type = 'text';
        nameInput.placeholder = manualConfig.identityPlaceholder || 'Optional account name';
        manualSection.appendChild(wrapField((manualConfig.identityLabel || 'Account Name') + ' (optional)', nameInput));

        var handleInput = el('input', 'sch-config-input');
        handleInput.type = 'text';
        handleInput.placeholder = manualConfig.handlePlaceholder || 'Optional handle or ID';
        manualSection.appendChild(wrapField((manualConfig.handleLabel || 'Handle / ID') + ' (optional)', handleInput));

        var fieldInputs = [];
        var allFields = (manualConfig.requiredFields || []).concat(manualConfig.optionalFields || []);
        allFields.forEach(function (fieldConfig) {
          var inp = el('input', 'sch-config-input');
          inp.type = fieldConfig.secret ? 'password' : 'text';
          inp.placeholder = fieldConfig.label;
          fieldInputs.push({ config: fieldConfig, input: inp });
          manualSection.appendChild(wrapField(
            fieldConfig.label + ((manualConfig.requiredFields || []).indexOf(fieldConfig) !== -1 ? '' : ' (optional)'),
            inp
          ));
        });

        var saveBtn = el('button', 'sch-btn sch-btn-primary sch-config-action-btn', 'Save');
        saveBtn.addEventListener('click', function () {
          var missingInput = null;
          fieldInputs.some(function (entry) {
            var isRequired = (manualConfig.requiredFields || []).indexOf(entry.config) !== -1;
            if (isRequired && !entry.input.value.trim()) {
              missingInput = entry;
              return true;
            }
            return false;
          });
          if (missingInput) {
            missingInput.input.focus();
            missingInput.input.style.borderColor = '#ef4444';
            return;
          }
          var credentials = {};
          fieldInputs.forEach(function (entry) {
            var value = entry.input.value.trim();
            if (value) credentials[entry.config.key] = value;
          });
          var accountHandle = handleInput.value.trim();
          var accountName = defaultAccountName(platform, accountHandle, nameInput.value.trim());
          saveBtn.disabled = true;
          saveBtn.textContent = 'Saving...';
          api('/credentials', {
            method: 'POST',
            body: JSON.stringify({
              platform: platform,
              accountName: accountName,
              accountHandle: accountHandle,
              credentials: credentials,
              isActive: true,
              clientId: clientId
            })
          }).then(function () {
            return loadAll();
          }).then(function () {
            overlay.remove();
            renderSettings();
          }).catch(function (err) {
            alert('Failed to save: ' + err.message);
            saveBtn.disabled = false;
            saveBtn.textContent = 'Save';
          });
        });
        manualSection.appendChild(saveBtn);
        panel.appendChild(manualSection);
      }

      overlay.appendChild(panel);

      // Click overlay backdrop to close
      overlay.addEventListener('click', function (e) {
        if (e.target === overlay) overlay.remove();
      });

      document.body.appendChild(overlay);

      // Animate in
      requestAnimationFrame(function () { overlay.classList.add('visible'); });
    }

    function wrapField(label, input) {
      var wrap = el('div', 'sch-config-field');
      wrap.appendChild(el('label', 'sch-config-label', label));
      wrap.appendChild(input);
      return wrap;
    }

    // Load state + OAuth config, then render
    Promise.all([loadAll(), fetchOAuthConfig()]).then(function () { renderSettings(); });
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
