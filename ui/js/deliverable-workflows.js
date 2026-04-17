/**
 * Unified deliverable status chains.
 *
 * Each deliverable TYPE has one ordered chain of statuses.
 * The advance arrow always moves to the next entry in the chain.
 * Some types have branch statuses (e.g. design_changes) that loop back.
 *
 * Each type also has a DEPT_MAP: status → department slug for auto-routing.
 */
(function () {
  'use strict';

  // ── Status Chains ──────────────────────────────────────

  var CHAINS = {
    // Content Calendar (sm-content-calendar)
    'sm-content-calendar': [
      'request_focus_points', 'focus_points_requested', 'focus_points_received',
      'design', 'design_review',
      'editorial', 'editorial_review',
      'ready_for_approval', 'sent_for_approval', 'approved',
      'ready_for_scheduling', 'scheduled', 'posted'
    ],

    // Agri4All types share the same chain
    'agri4all-posts': [
      'request_client_materials', 'materials_requested', 'materials_received',
      'design', 'design_review', 'ready_for_approval', 'sent_for_approval',
      'approved', 'create_links', 'ready_for_scheduling', 'scheduled',
      'create_stat_sheet', 'complete'
    ],

    // Product Uploads — own chain with alpha upload terminal
    'agri4all-product-uploads': [
      'request_client_materials', 'waiting_for_materials', 'materials_received',
      'design', 'design_review', 'ready_for_approval', 'sent_for_approval',
      'approved', 'agri4all-links'
    ],

    // Print / Magazine
    'magazine': [
      'request_client_materials', 'materials_requested', 'materials_received',
      'editing', 'design', 'design_review', 'editorial_review',
      'ready_for_approval', 'sent_for_approval', 'approved'
    ],

    // Online Articles
    'online-articles': [
      'request_client_materials', 'materials_requested', 'materials_received',
      'editing', 'ready_for_approval', 'sent_for_approval',
      'approved', 'translating', 'ready_to_upload', 'posted'
    ],

    // Banners
    'agri4all-banners': [
      'design', 'design_review', 'ready_for_scheduling',
      'scheduled', 'posted', 'create_stat_sheet'
    ],

    // Web Design
    // Materials/approval phases live in Production; site_map and
    // design/dev phases live in Design. See DEPT_MAPS below for
    // per-status routing — must stay in lockstep with the backend
    // entries in api/routes/deliverables.js.
    'website-design': [
      'request_client_materials', 'materials_requested', 'materials_received',
      'site_map',
      'ready_for_approval', 'sent_for_approval', 'approved',
      'development', 'site_development', 'hosting_seo', 'complete'
    ],

    // Video
    'video': [
      'send_request_form', 'request_form_sent', 'request_form_received',
      'populating_video_dept', 'brief_received', 'assign_and_schedule',
      'production', 'editing', 'review', 'final_delivery'
    ],

    // SM Management types (posts, videos, google ads, linkedin, twitter)
    'sm-posts': [
      'request_client_materials', 'materials_requested', 'artwork_design',
      'create_captions', 'editorial_review', 'ready_for_approval',
      'sent_for_approval', 'approved', 'ready_for_scheduling', 'scheduled'
    ],

    // Own Social Twitter — short editorial chain
    'own-social-twitter': [
      'request_client_materials', 'materials_requested', 'materials_received',
      'editorial',
      'ready_for_scheduling', 'scheduled', 'posted'
    ],

    // Own Social LinkedIn — same editorial chain, no materials_received
    'own-social-linkedin': [
      'request_client_materials', 'materials_requested',
      'editorial',
      'ready_for_scheduling', 'scheduled', 'posted'
    ],

    // Agri4All LinkedIn — same editorial chain as own-social-linkedin
    'agri4all-linkedin': [
      'request_client_materials', 'materials_requested',
      'editorial',
      'ready_for_scheduling', 'scheduled', 'posted'
    ],

    // Agri4All Twitter — same editorial chain as own-social-twitter
    'agri4all-twitter': [
      'request_client_materials', 'materials_requested', 'materials_received',
      'editorial',
      'ready_for_scheduling', 'scheduled', 'posted'
    ]
  };

  // Types that share the same chain as another type
  var CHAIN_ALIASES = {
    'sm-videos': 'sm-posts',
    'sm-google-ads': 'sm-posts',
    'sm-linkedin': 'sm-posts',
    'sm-twitter': 'sm-posts',
    'agri4all-videos': 'agri4all-posts',
    'agri4all-newsletters': 'agri4all-posts',
    'agri4all-newsletter-feature': 'agri4all-posts',
    'agri4all-newsletter-banner': 'agri4all-posts',
    'own-social-posts': 'sm-posts',
    'own-social-videos': 'sm-posts',
    'magazine-sa-digital': 'magazine',
    'magazine-africa-print': 'magazine',
    'magazine-africa-digital': 'magazine',
    'magazine-coffee-table': 'magazine'
  };

  // ── Department Routing Maps ────────────────────────────

  var DEPT_MAPS = {
    'sm-content-calendar': {
      'request_focus_points': 'production',
      'focus_points_requested': 'production',
      'focus_points_received': 'production',
      // legacy aliases — post-rollback rows still route until db.js migration runs
      'request_materials': 'production',
      'materials_requested': 'production',
      'materials_received': 'production',
      'design': 'design',
      'design_review': 'design',
      'design_changes': 'design',
      'editorial': 'editorial',
      'editorial_review': 'editorial',
      'ready_for_approval': 'production',
      'sent_for_approval': 'production',
      'approved': 'social-media',
      'client_changes': 'production',
      'ready_for_scheduling': 'social-media',
      'scheduled': 'social-media',
      'posted': 'social-media'
    },

    'agri4all-posts': {
      'request_client_materials': 'production',
      'materials_requested': 'production',
      'waiting_for_materials': 'production', // legacy alias — stuck items still route
      'materials_received': 'production',
      'design': 'design',
      'design_review': 'design',
      'design_changes': 'design',
      'ready_for_approval': 'production',
      'sent_for_approval': 'production',
      'approved': 'agri4all',
      'create_links': 'agri4all',
      'ready_for_scheduling': 'social-media',
      'scheduled': 'social-media',
      'create_stat_sheet': 'agri4all',
      'complete': 'agri4all'
    },

    'magazine': {
      'request_client_materials': 'production',
      'materials_requested': 'production',
      'waiting_for_materials': 'production', // legacy alias
      'materials_received': 'production',
      'editing': 'editorial',
      'design': 'design',
      'design_review': 'design',
      'design_changes': 'design',
      'editorial_review': 'editorial',
      'editorial_changes': 'editorial',
      'ready_for_approval': 'production',
      'sent_for_approval': 'production',
      'client_changes': 'design',
      'approved': 'production'
    },

    'online-articles': {
      'request_client_materials': 'production',
      'materials_requested': 'production',
      'waiting_for_materials': 'production', // legacy alias
      'materials_received': 'editorial',
      'editing': 'editorial',
      'editorial_review': 'editorial',
      'editorial_changes': 'editorial',
      'ready_for_approval': 'production',
      'sent_for_approval': 'production',
      'client_changes': 'editorial',
      'approved': 'editorial',
      'translating': 'editorial',
      'ready_to_upload': 'editorial',
      'posted': 'editorial'
    },

    'agri4all-product-uploads': {
      'request_client_materials': 'production',
      'waiting_for_materials': 'production',
      'materials_received': 'production',
      'design': 'design',
      'design_review': 'design',
      'design_changes': 'design',
      'client_changes': 'design',
      'ready_for_approval': 'production',
      'sent_for_approval': 'production',
      'approved': 'production',
      'agri4all-links': 'agri4all'
    },

    'agri4all-banners': {
      'design': 'design',
      'design_review': 'design',
      'design_changes': 'design',
      'ready_for_scheduling': 'social-media',
      'scheduled': 'social-media',
      'posted': 'social-media',
      'create_stat_sheet': 'agri4all'
    },

    'website-design': {
      'request_client_materials': 'production',
      'materials_requested': 'production',
      'materials_received': 'production',
      'site_map': 'design',
      'ready_for_approval': 'production',
      'sent_for_approval': 'production',
      'approved': 'production',
      'development': 'design',
      'site_development': 'design',
      'hosting_seo': 'design',
      'design_changes': 'design',
      'complete': 'design',
      // Legacy status aliases (in-flight rows from the pre-restructure schema).
      // These route to the same department as their canonical replacements.
      'sitemap': 'design',          // legacy → site_map
      'wireframe': 'design',        // legacy → site_map
      'prototype': 'design',        // legacy → site_map
      'site_developed': 'design'    // legacy → site_development
    },

    'video': {
      'send_request_form': 'production',
      'request_form_sent': 'production',
      'request_form_received': 'production',
      'populating_video_dept': 'production',
      'brief_received': 'video',
      'assign_and_schedule': 'video',
      'production': 'video',
      'editing': 'video',
      'review': 'video',
      'changes_requested': 'video',
      'final_delivery': 'video'
    },

    'sm-posts': {
      'request_client_materials': 'production',
      'materials_requested': 'production',
      'upload_materials': 'production', // legacy alias
      'artwork_design': 'design',
      'design_changes': 'design',
      'create_captions': 'editorial',
      'editorial_review': 'editorial',
      'ready_for_approval': 'production',
      'sent_for_approval': 'production',
      'client_changes': 'production',
      'approved': 'social-media',
      'ready_for_scheduling': 'social-media',
      'scheduled': 'social-media'
    },

    'own-social-twitter': {
      'request_client_materials': 'production',
      'materials_requested': 'production',
      'materials_received': 'production',
      'editorial': 'editorial',
      'ready_for_scheduling': 'social-media',
      'scheduled': 'social-media',
      'posted': 'social-media'
    },

    'own-social-linkedin': {
      'request_client_materials': 'production',
      'materials_requested': 'production',
      'editorial': 'editorial',
      'ready_for_scheduling': 'social-media',
      'scheduled': 'social-media',
      'posted': 'social-media'
    },

    'agri4all-linkedin': {
      'request_client_materials': 'production',
      'materials_requested': 'production',
      'editorial': 'editorial',
      'ready_for_scheduling': 'social-media',
      'scheduled': 'social-media',
      'posted': 'social-media'
    },

    'agri4all-twitter': {
      'request_client_materials': 'production',
      'materials_requested': 'production',
      'materials_received': 'production',
      'editorial': 'editorial',
      'ready_for_scheduling': 'social-media',
      'scheduled': 'social-media',
      'posted': 'social-media'
    }
  };

  // Aliases share dept maps too
  var DEPT_MAP_ALIASES = {
    'sm-videos': 'sm-posts',
    'sm-google-ads': 'sm-posts',
    'sm-linkedin': 'sm-posts',
    'sm-twitter': 'sm-posts',
    'agri4all-videos': 'agri4all-posts',
    'agri4all-newsletters': 'agri4all-posts',
    'agri4all-newsletter-feature': 'agri4all-posts',
    'agri4all-newsletter-banner': 'agri4all-posts',
    'own-social-posts': 'sm-posts',
    'own-social-videos': 'sm-posts',
    'magazine-sa-digital': 'magazine',
    'magazine-africa-print': 'magazine',
    'magazine-africa-digital': 'magazine',
    'magazine-coffee-table': 'magazine'
  };

  // ── Branch Statuses (loops back) ───────────────────────

  var BRANCH_STATUSES = {
    'website-design': { 'design_changes': 'development' },
    'sm-content-calendar': { 'design_changes': 'design', 'client_changes': 'design' },
    'sm-posts': { 'design_changes': 'artwork_design', 'client_changes': 'ready_for_approval' },
    'agri4all-posts': { 'design_changes': 'design' },
    'agri4all-product-uploads': { 'design_changes': 'design_review', 'client_changes': 'design' },
    'magazine': { 'design_changes': 'design', 'editorial_changes': 'design', 'client_changes': 'design' },
    'online-articles': { 'editorial_changes': 'editing', 'client_changes': 'editing' },
    'agri4all-banners': { 'design_changes': 'design' },
    'video': { 'changes_requested': 'editing' }
  };

  // ── Helpers ────────────────────────────────────────────

  function getChain(type) {
    var key = CHAIN_ALIASES[type] || type;
    return CHAINS[key] || ['pending', 'in_progress', 'completed'];
  }

  function getDeptMap(type) {
    var key = DEPT_MAP_ALIASES[type] || type;
    return DEPT_MAPS[key] || null;
  }

  function getBranches(type) {
    var key = CHAIN_ALIASES[type] || type;
    return BRANCH_STATUSES[key] || {};
  }

  // Build next-status lookup from chain
  function buildNextMap(chain) {
    var map = {};
    for (var i = 0; i < chain.length; i++) {
      if (i < chain.length - 1) {
        var cur = chain[i];
        var nxt = chain[i + 1];
        var label = nxt.replace(/_/g, ' ').replace(/\b\w/g, function (c) { return c.toUpperCase(); });
        map[cur] = { next: nxt, tooltip: 'Advance to: ' + label };
      } else {
        map[chain[i]] = null; // terminal
      }
    }
    return map;
  }

  /**
   * Get the next-status info for a deliverable.
   * @param {string} type   - deliverable type
   * @param {string} status - current status
   * @returns {{ next: string, tooltip: string } | null}
   */
  function getNextStatus(type, status) {
    var branches = getBranches(type);
    if (branches[status]) {
      var target = branches[status];
      var label = target.replace(/_/g, ' ').replace(/\b\w/g, function (c) { return c.toUpperCase(); });
      return { next: target, tooltip: 'Return to: ' + label };
    }
    var chain = getChain(type);
    var map = buildNextMap(chain);
    return map[status] || null;
  }

  /**
   * Get the full ordered status chain for a deliverable type.
   * Includes branch statuses for dropdown display.
   * @param {string} type - deliverable type
   * @returns {string[]}
   */
  function getStatusChain(type) {
    var chain = getChain(type).slice();
    var branches = getBranches(type);
    var branchKeys = Object.keys(branches);
    for (var i = 0; i < branchKeys.length; i++) {
      if (chain.indexOf(branchKeys[i]) === -1) {
        chain.push(branchKeys[i]);
      }
    }
    return chain;
  }

  /**
   * Get the department slug a deliverable should be routed to for a given status.
   * @param {string} type   - deliverable type
   * @param {string} status - target status
   * @returns {string|null} - department slug or null if no routing defined
   */
  function getDepartmentForStatus(type, status) {
    var map = getDeptMap(type);
    if (!map) return null;
    return map[status] || null;
  }

  /**
   * Get initial status for a deliverable type.
   * @param {string} type - deliverable type
   * @returns {string}
   */
  function getInitialStatus(type) {
    var chain = getChain(type);
    return chain[0] || 'pending';
  }

  // Special-case labels that don't fit Title Case (acronyms, ampersands).
  var STATUS_LABEL_OVERRIDES = {
    'hosting_seo': 'Hosting & SEO',
    'site_map': 'Site Map',
    'site_development': 'Site Development'
  };

  // Human-readable status label (snake_case → Title Case)
  function formatStatusLabel(status) {
    if (!status) return '';
    if (STATUS_LABEL_OVERRIDES[status]) return STATUS_LABEL_OVERRIDES[status];
    return String(status).replace(/_/g, ' ').replace(/\b\w/g, function (c) { return c.toUpperCase(); });
  }

  /**
   * Build the dynamic tooltip text for an advance arrow given a deliverable.
   * Returns "Advance to: {Next Status Label}" or "Return to: {Label}" for branch
   * statuses, or empty string if there is no next status.
   * Used by all department views via the shared sheet component.
   * @param {string} type   - deliverable type
   * @param {string} status - current status
   * @returns {string}
   */
  function getAdvanceTooltip(type, status) {
    var wf = getNextStatus(type, status);
    if (!wf || !wf.next) return '';
    var label = formatStatusLabel(wf.next);
    // Branch statuses use "Return to" prefix from getNextStatus, preserve that intent
    if (wf.tooltip && wf.tooltip.indexOf('Return to') === 0) {
      return 'Return to: ' + label;
    }
    return 'Advance to: ' + label;
  }

  // Expose on window
  window.DELIVERABLE_WORKFLOWS = {
    getNextStatus: getNextStatus,
    getStatusChain: getStatusChain,
    getDepartmentForStatus: getDepartmentForStatus,
    getInitialStatus: getInitialStatus,
    getDeptMap: getDeptMap,
    formatStatusLabel: formatStatusLabel,
    getAdvanceTooltip: getAdvanceTooltip
  };
})();
