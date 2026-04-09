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
})();
