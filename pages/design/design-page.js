(function () {
  'use strict';

  // ── Design Department Page ────────────────────────────────────────
  // Design's tabs live in the SIDEBAR (via deptMenuItems['design']).
  // This file only exposes per-tab renderers which `ui/js/app.js`
  // dispatches from its showDeptContent() routing layer.
  //
  // The Content Calendars tab reuses production-page's own split-sheet
  // helper so the sheets look IDENTICAL to Production's Deliverables
  // sub-tab (same `.prod-deliv-*` DOM, same CC dashboard on eye click).
  // ─────────────────────────────────────────────────────────────────

  function renderDesignContentCalendarsTab(container) {
    if (typeof window.renderSplitSheetTab !== 'function') {
      console.warn('[design] window.renderSplitSheetTab not loaded yet');
      return;
    }
    var C = window.prodCols;
    // Marker class so design-page.css can (a) override the split ratio
    // to 70/30 and (b) hide the per-client group header row so CCs
    // render as a flat list.
    container.classList.add('design-cc-split-70-30');

    // Custom "type" column that prepends the client name to the
    // type label, giving us "Acme Farming Co — Content Calendar"
    // without needing a separate client cell. Replaces typeWithClientPrefix()
    // in the column array below.
    function typeWithClientPrefix() {
      return {
        label: 'Type',
        className: 'prod-deliv-type',
        render: function (item) {
          var span = document.createElement('span');
          span.className = 'production-type-badge';
          var typeLabel = item.type === 'sm-content-calendar'
            ? 'Content Calendar'
            : String(item.type || '').replace(/-/g, ' ').replace(/\b\w/g, function (c) { return c.toUpperCase(); });
          var client = item.clientName || 'Unknown client';
          span.textContent = client + ' — ' + typeLabel;
          return span;
        }
      };
    }

    window.renderSplitSheetTab(container, {
      prefix: 'designCC',
      deptSlug: 'design',
      left: {
        title: 'Design',
        searchPlaceholder: 'Search design...',
        // Design-side: both in-progress design and client-requested changes.
        filter: function (d) {
          return d.type === 'sm-content-calendar' &&
            (d.status === 'design' || d.status === 'design_changes');
        },
        columns: [
          C.eye(container),
          C.deptAvatar('design'),
          typeWithClientPrefix(),
          C.status(),
          // Default chain-previous back + auto-advance forward.
          C.actionAdvanceBack('auto')
        ],
        emptyMessage: 'No content calendars in design'
      },
      right: {
        title: 'Design Review',
        searchPlaceholder: 'Search design review...',
        filter: function (d) {
          return d.type === 'sm-content-calendar' && d.status === 'design_review';
        },
        columns: [
          C.eye(container),
          C.deptAvatar('design'),
          typeWithClientPrefix(),
          C.status(),
          C.actionAdvanceBack('auto')
        ],
        emptyMessage: 'No content calendars in design review'
      }
    });
  }

  window.renderDesignContentCalendarsTab = renderDesignContentCalendarsTab;
})();
