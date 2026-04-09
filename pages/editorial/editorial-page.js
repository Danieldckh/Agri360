(function () {
  'use strict';

  // ── Editorial Department Page ──────────────────────────────────────
  // Editorial's tabs live in the SIDEBAR (via deptMenuItems['editorial']).
  // This file exposes per-tab renderers that ui/js/app.js dispatches.
  //
  // Content Calendars: reuses production-page's split-sheet helper so
  // the sheets match Production's `.prod-deliv-*` styling exactly.
  //
  // Editorial back-button override: clicking the send-back arrow on an
  // editorial row sends the deliverable to `design_changes` (branch
  // status), NOT the chain-previous step. This routes it back to design
  // for revisions.
  // ──────────────────────────────────────────────────────────────────

  function renderEditorialContentCalendarsTab(container) {
    if (typeof window.renderSplitSheetTab !== 'function') {
      console.warn('[editorial] window.renderSplitSheetTab not loaded yet');
      return;
    }
    var C = window.prodCols;

    window.renderSplitSheetTab(container, {
      prefix: 'editorialCC',
      deptSlug: 'editorial',
      hideClientGroups: true,
      left: {
        title: 'Editorial',
        searchPlaceholder: 'Search editorial...',
        filter: function (d) {
          return d.type === 'sm-content-calendar' && d.status === 'editorial';
        },
        columns: [
          C.eye(container),
          C.deptAvatar('editorial'),
          C.type(),
          C.status(),
          // Editorial back button: route to design_changes (not chain-prev).
          C.actionAdvanceBackTo('design_changes', 'auto')
        ],
        emptyMessage: 'No content calendars in editorial'
      },
      right: {
        title: 'Editorial Review',
        searchPlaceholder: 'Search editorial review...',
        filter: function (d) {
          return d.type === 'sm-content-calendar' && d.status === 'editorial_review';
        },
        columns: [
          C.eye(container),
          C.deptAvatar('editorial'),
          C.type(),
          C.status(),
          C.actionAdvanceBackTo('design_changes', 'auto')
        ],
        emptyMessage: 'No content calendars in editorial review'
      }
    });
  }

  window.renderEditorialContentCalendarsTab = renderEditorialContentCalendarsTab;

  // ── Editorial > Online Articles Tab ──────────────────────────────
  // 70/30 split: Editing (left) | Translating (right). Reuses the
  // Production split-sheet helper for styling parity. The marker class
  // `editorial-oa-split-70-30` lets editorial-page.css override the
  // default 50/50 ratio and hide client group headers so rows render
  // as a flat list.
  function renderEditorialOnlineArticlesTab(container) {
    if (typeof window.renderSplitSheetTab !== 'function') {
      console.warn('[editorial] window.renderSplitSheetTab not loaded yet');
      return;
    }
    var C = window.prodCols;
    container.classList.add('editorial-oa-split-70-30');

    window.renderSplitSheetTab(container, {
      prefix: 'edOA',
      deptSlug: 'editorial',
      hideClientGroups: true,
      left: {
        title: 'Editing',
        searchPlaceholder: 'Search editing...',
        filter: function (d) {
          return d.type === 'online-articles' && d.status === 'editing';
        },
        columns: [
          C.eye(container),
          C.deptAvatar('editorial'),
          C.type(),
          C.status(),
          C.actionAdvanceBack('auto')
        ],
        emptyMessage: 'No online articles in editing'
      },
      right: {
        title: 'Translating',
        searchPlaceholder: 'Search translating...',
        filter: function (d) {
          return d.type === 'online-articles' && d.status === 'translating';
        },
        columns: [
          C.eye(container),
          C.deptAvatar('editorial'),
          C.type(),
          C.status(),
          C.actionAdvanceBack('auto')
        ],
        emptyMessage: 'No online articles translating'
      }
    });
  }

  window.renderEditorialOnlineArticlesTab = renderEditorialOnlineArticlesTab;

  // ── Editorial > Ready to Upload Tab ──────────────────────────────
  // Full-width single sheet of online articles at `ready_to_upload`,
  // with a per-row "Mark Uploaded" button that PATCHes status=posted.
  function renderEditorialReadyToUploadTab(container) {
    if (typeof window.renderClientGroupedSheet !== 'function') {
      console.warn('[editorial] window.renderClientGroupedSheet not loaded yet');
      return;
    }
    var C = window.prodCols;

    while (container.firstChild) container.removeChild(container.firstChild);
    container.style.display = '';
    container.style.alignItems = '';
    container.style.justifyContent = '';
    container.style.flexDirection = '';
    container.style.height = '';
    container.style.gap = '';
    container.style.padding = '';
    container.classList.add('editorial-ready-upload-tab');

    // Custom "Mark Uploaded" action column
    function colMarkUploaded() {
      return {
        label: '',
        className: 'prod-deliv-act',
        render: function (item, refresh) {
          var btn = document.createElement('button');
          btn.className = 'editorial-upload-btn';
          btn.textContent = 'Mark Uploaded';
          btn.addEventListener('click', function (e) {
            e.stopPropagation();
            var headers = { 'Content-Type': 'application/json' };
            if (window.getAuthHeaders) {
              var auth = window.getAuthHeaders();
              for (var k in auth) { if (Object.prototype.hasOwnProperty.call(auth, k)) headers[k] = auth[k]; }
            }
            fetch('/api/deliverables/' + item.id, {
              method: 'PATCH',
              headers: headers,
              body: JSON.stringify({ status: 'posted' })
            }).then(function () { if (refresh) refresh(); });
          });
          return btn;
        }
      };
    }

    window.renderClientGroupedSheet(container, {
      title: 'Ready to Upload',
      searchPlaceholder: 'Search ready to upload...',
      deptSlug: 'editorial',
      statusFilter: function (d) {
        return d.type === 'online-articles' && d.status === 'ready_to_upload';
      },
      columns: [
        C.eye(container),
        C.deptAvatar('editorial'),
        C.type(),
        C.status(),
        colMarkUploaded()
      ],
      emptyMessage: 'No online articles ready to upload',
      hideClientGroups: true,
      skipMonthSelector: false
    });
  }

  window.renderEditorialReadyToUploadTab = renderEditorialReadyToUploadTab;
})();
