/**
 * Unified deliverable status chains.
 *
 * Each deliverable TYPE has one ordered chain of statuses that is the same
 * regardless of which department is viewing it.  The advance arrow always
 * moves to the next entry in the chain.
 *
 * Special entries:
 *   design_changes  — not in the main chain; advance goes back to prototype.
 */
(function () {
  'use strict';

  // Website-design: full pipeline from materials to launch
  var WEB_DESIGN_CHAIN = [
    'request_client_materials',
    'materials_requested',
    'materials_received',
    'sitemap',
    'wireframe',
    'prototype',
    'ready_for_approval',
    'sent_for_approval',
    'approved',
    'development',
    'site_developed',
    'hosting_seo',
    'complete'
  ];

  // Generic chain for every other deliverable type
  var GENERIC_CHAIN = [
    'pending',
    'in_progress',
    'completed'
  ];

  // Website-design: status → department slug (for API auto-routing)
  var WEB_DESIGN_DEPT_MAP = {
    'request_client_materials': 'production',
    'materials_requested':      'production',
    'materials_received':       'production',
    'sitemap':                  'design',
    'wireframe':                'design',
    'prototype':                'design',
    'ready_for_approval':       'production',
    'sent_for_approval':        'production',
    'approved':                 'design',
    'design_changes':           'design',
    'development':              'production',
    'site_developed':           'production',
    'hosting_seo':              'production',
    'complete':                 'production'
  };

  // Build a lookup: status → { next, tooltip } from an ordered chain
  function buildNextMap(chain) {
    var map = {};
    for (var i = 0; i < chain.length; i++) {
      if (i < chain.length - 1) {
        var cur = chain[i];
        var nxt = chain[i + 1];
        var label = nxt.replace(/_/g, ' ').replace(/\b\w/g, function (c) { return c.toUpperCase(); });
        map[cur] = { next: nxt, tooltip: 'Advance to ' + label };
      } else {
        map[chain[i]] = null; // terminal
      }
    }
    return map;
  }

  var webDesignNext = buildNextMap(WEB_DESIGN_CHAIN);
  // Special branch: design_changes loops back to prototype
  webDesignNext['design_changes'] = { next: 'prototype', tooltip: 'Return to Prototype' };

  var genericNext = buildNextMap(GENERIC_CHAIN);
  // Overdue can resume
  genericNext['overdue'] = { next: 'in_progress', tooltip: 'Resume — mark as In Progress' };

  /**
   * Get the next-status info for a deliverable.
   * @param {string} type   - deliverable type (e.g. 'website-design')
   * @param {string} status - current status
   * @returns {{ next: string, tooltip: string } | null}
   */
  function getNextStatus(type, status) {
    var map = type === 'website-design' ? webDesignNext : genericNext;
    return map[status] || null;
  }

  /**
   * Get the full ordered status chain for a deliverable type.
   * @param {string} type - deliverable type
   * @returns {string[]}
   */
  function getStatusChain(type) {
    if (type === 'website-design') {
      // Include design_changes as a possible status (shown in dropdowns)
      return WEB_DESIGN_CHAIN.concat(['design_changes']);
    }
    return GENERIC_CHAIN.slice();
  }

  // Expose on window
  window.DELIVERABLE_WORKFLOWS = {
    getNextStatus: getNextStatus,
    getStatusChain: getStatusChain,
    WEB_DESIGN_DEPT_MAP: WEB_DESIGN_DEPT_MAP
  };
})();
