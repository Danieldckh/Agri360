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
    sourceFilter: 'all',
    // When the scheduler is opened from a dept tab that pins it to a specific
    // source (e.g. Social Media > Content Calendars), presetSource is set
    // and the internal source switcher is hidden — the dept nav becomes the
    // source nav instead.
    presetSource: false,
    view: 'month',         // month | week | day
    cursor: new Date(),    // current focused date
    search: '',
    container: null
  };

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
  function loadAll() {
    return Promise.all([
      api('/posts').catch(function () { return []; }),
      api('/credentials').catch(function () { return []; })
    ]).then(function (res) {
      state.posts = res[0] || [];
      state.creds = res[1] || [];
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

    var header = el('div', 'sch-left-header');
    var t = el('h3', 'sch-left-title');
    t.appendChild(svg('M14 6V4h-4v2h4zM4 8v11h16V8H4zm16-2c1.11 0 2 .89 2 2v11c0 1.11-.89 2-2 2H4c-1.11 0-2-.89-2-2l.01-11C2.01 6.89 2.89 6 4 6h4V4c0-1.11.89-2 2-2h4c1.11 0 2 .89 2 2v2h4z', 16));
    t.appendChild(document.createTextNode(' Unscheduled'));
    var unsched = unscheduledPosts();
    var badge = el('span', 'sch-badge', unsched.length);
    t.appendChild(badge);
    header.appendChild(t);
    left.appendChild(header);

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

    var list = el('div', 'sch-unscheduled-list');
    if (unsched.length === 0) {
      list.appendChild(el('div', 'sch-empty', 'No unscheduled posts. Create one to get started.'));
    } else {
      unsched.forEach(function (p) {
        list.appendChild(buildPostCard(p));
      });
    }
    left.appendChild(list);

    return left;
  }

  function buildPostCard(p) {
    var card = el('div', 'sch-post-card');
    makeDraggable(card, p);

    var head = el('div', 'sch-post-card-head');
    head.appendChild(el('h4', 'sch-post-title', p.title || '(untitled)'));
    head.appendChild(el('span', 'sch-source-dot ' + p.sourceType));
    card.appendChild(head);

    if (p.content) {
      card.appendChild(el('p', 'sch-post-content', p.content));
    }

    var meta = el('div', 'sch-post-meta');
    var plats = Array.isArray(p.platforms) ? p.platforms : [];
    plats.forEach(function (pl) {
      meta.appendChild(el('span', 'sch-platform-chip ' + pl, pl));
    });
    if (p.clientName) {
      meta.appendChild(el('span', 'sch-post-client', p.clientName));
    }
    card.appendChild(meta);

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
      status: 'draft'
    }, post || {});

    var form = el('div');

    // Title
    form.appendChild(field('Title',
      input('text', data.title, function (v) { data.title = v; })));

    // Content
    form.appendChild(field('Caption / Content',
      textarea(data.content, function (v) { data.content = v; })));

    // Source + Status row
    var row = el('div', 'sch-field-row');
    row.appendChild(field('Source',
      select(['content-calendar', 'agri4all', 'own-sm'], data.sourceType,
        function (v) { data.sourceType = v; },
        { 'content-calendar': 'Content Calendar', 'agri4all': 'Agri4All', 'own-sm': 'Own Social Media' })));
    row.appendChild(field('Status',
      select(['draft', 'scheduled', 'posted', 'failed'], data.status,
        function (v) { data.status = v; })));
    form.appendChild(row);

    // Platforms
    var platField = el('div', 'sch-field');
    platField.appendChild(el('label', 'sch-field-label', 'Platforms'));
    var platWrap = el('div', 'sch-platform-select');
    PLATFORMS.forEach(function (pl) {
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
    platField.appendChild(platWrap);
    form.appendChild(platField);

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
          status: data.status
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
  function openCredentialsModal() {
    var body = el('div');

    body.appendChild(el('h4', 'sch-section-title', 'Connected Accounts'));

    var list = el('div', 'sch-cred-list');
    if (state.creds.length === 0) {
      list.appendChild(el('div', 'sch-cred-empty', 'No social accounts connected yet. Add one below to enable auto-posting.'));
    } else {
      state.creds.forEach(function (c) {
        var item = el('div', 'sch-cred-item');

        var info = el('div', 'sch-cred-info');
        var pf = el('div', 'sch-cred-platform');
        var dot = el('span', 'sch-cred-status' + (c.isActive ? ' active' : ''));
        pf.appendChild(dot);
        pf.appendChild(document.createTextNode(' ' + c.platform));
        info.appendChild(pf);
        info.appendChild(el('div', 'sch-cred-account',
          c.accountName + (c.accountHandle ? ' (' + c.accountHandle + ')' : '')));
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

    var newCred = {
      platform: 'facebook',
      accountName: '',
      accountHandle: '',
      credentials: {}
    };

    var addForm = el('div');

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
