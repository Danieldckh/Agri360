const { Router } = require('express');
const pool = require('../db');
const { requireAuth } = require('../middleware/auth');
const { toCamelCase, toSnakeBody } = require('../utils');

const router = Router();

router.use(requireAuth);

// GET /by-booking/:bookingFormId - list deliverables for a booking form
router.get('/by-booking/:bookingFormId', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT d.*, dept.name AS department_name
       FROM deliverables d
       LEFT JOIN departments dept ON dept.id = d.department_id
       WHERE d.booking_form_id = $1
       ORDER BY d.created_at DESC`,
      [req.params.bookingFormId]
    );
    res.json(result.rows.map(toCamelCase));
  } catch (err) {
    console.error('List deliverables by booking error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /by-department/:deptSlug - list deliverables for a department slug
// Optional query params: ?month=2026-02 OR ?monthStart=2026-02&monthEnd=2026-06
// Default: current month if no month params provided
router.get('/by-department/:deptSlug', async (req, res) => {
  try {
    const params = [req.params.deptSlug];
    let monthClause = '';

    if (req.query.month) {
      params.push(req.query.month);
      monthClause = ` AND d.delivery_month = $${params.length}`;
    } else if (req.query.monthStart && req.query.monthEnd) {
      params.push(req.query.monthStart);
      params.push(req.query.monthEnd);
      monthClause = ` AND d.delivery_month BETWEEN $${params.length - 1} AND $${params.length}`;
    } else {
      const currentMonth = new Date().toISOString().substring(0, 7);
      params.push(currentMonth);
      monthClause = ` AND d.delivery_month = $${params.length}`;
    }

    const result = await pool.query(
      `SELECT d.*, dept.name AS department_name, dept.slug AS department_slug,
              bf.title AS booking_form_title, c.name AS client_name, c.id AS client_id
       FROM deliverables d
       JOIN departments dept ON dept.id = d.department_id
       JOIN booking_forms bf ON bf.id = d.booking_form_id
       JOIN clients c ON c.id = bf.client_id
       WHERE dept.slug = $1${monthClause}
       ORDER BY d.delivery_month ASC, d.created_at DESC`,
      params
    );
    res.json(result.rows.map(toCamelCase));
  } catch (err) {
    console.error('List deliverables by department error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /:id - single deliverable with department + booking form info
router.get('/:id', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT d.*, dept.name AS department_name, dept.slug AS department_slug,
              bf.title AS booking_form_title
       FROM deliverables d
       LEFT JOIN departments dept ON dept.id = d.department_id
       LEFT JOIN booking_forms bf ON bf.id = d.booking_form_id
       WHERE d.id = $1`,
      [req.params.id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Deliverable not found' });
    }
    res.json(toCamelCase(result.rows[0]));
  } catch (err) {
    console.error('Get deliverable error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Comprehensive status → department slug routing for all types
const DEPT_MAPS = {
  'sm-posts': {
    'request_client_materials': 'production', 'materials_requested': 'production',
    'upload_materials': 'production', // legacy alias — stuck items still route
    'artwork_design': 'design', 'design_changes': 'design',
    'create_captions': 'editorial', 'editorial_review': 'editorial',
    'ready_for_approval': 'production', 'sent_for_approval': 'production', 'client_changes': 'production',
    'approved': 'social-media', 'ready_for_scheduling': 'social-media', 'scheduled': 'social-media'
  },
  'sm-content-calendar': {
    'request_focus_points': 'production', 'focus_points_requested': 'production', 'focus_points_received': 'production',
    'design': 'design', 'design_review': 'design', 'design_changes': 'design',
    'editorial': 'editorial', 'editorial_review': 'editorial',
    'ready_for_approval': 'production', 'client_changes': 'production',
    'approved': 'social-media', 'ready_for_scheduling': 'social-media', 'scheduled': 'social-media', 'posted': 'social-media'
  },
  'agri4all-posts': {
    'request_client_materials': 'production', 'materials_requested': 'production',
    'waiting_for_materials': 'production', // legacy alias
    'materials_received': 'production',
    'design': 'design', 'design_review': 'design', 'design_changes': 'design',
    'ready_for_approval': 'production', 'sent_for_approval': 'production',
    'approved': 'agri4all', 'create_links': 'agri4all',
    'ready_for_scheduling': 'social-media', 'scheduled': 'social-media',
    'create_stat_sheet': 'agri4all', 'complete': 'agri4all'
  },
  'agri4all-banners': {
    'design': 'design', 'design_review': 'design', 'design_changes': 'design',
    'ready_for_scheduling': 'social-media', 'scheduled': 'social-media', 'posted': 'social-media',
    'create_stat_sheet': 'agri4all'
  },
  'magazine': {
    'request_client_materials': 'production', 'materials_requested': 'production',
    'waiting_for_materials': 'production', // legacy alias
    'materials_received': 'production',
    'editing': 'editorial', 'design': 'design', 'design_review': 'design', 'design_changes': 'design',
    'editorial_review': 'editorial', 'editorial_changes': 'editorial',
    'ready_for_approval': 'production', 'sent_for_approval': 'production', 'client_changes': 'design',
    'approved': 'production'
  },
  'online-articles': {
    'request_client_materials': 'production', 'materials_requested': 'production',
    'waiting_for_materials': 'production', // legacy alias
    'materials_received': 'production',
    'editing': 'editorial', 'editorial_changes': 'editorial',
    'ready_for_approval': 'production', 'sent_for_approval': 'production', 'client_changes': 'editorial',
    'approved': 'editorial', 'translating': 'editorial', 'ready_to_upload': 'editorial', 'posted': 'editorial'
  },
  'website-design': {
    'request_client_materials': 'production', 'materials_requested': 'production', 'materials_received': 'production',
    'sitemap': 'design', 'wireframe': 'design', 'prototype': 'design', 'design_changes': 'design', 'approved': 'design',
    'ready_for_approval': 'production', 'sent_for_approval': 'production',
    'development': 'production', 'site_developed': 'production', 'hosting_seo': 'production', 'complete': 'production'
  },
  'video': {
    'send_request_form': 'production', 'request_form_sent': 'production', 'request_form_received': 'production', 'populating_video_dept': 'production',
    'brief_received': 'video', 'assign_and_schedule': 'video', 'production': 'video',
    'editing': 'video', 'review': 'video', 'changes_requested': 'video', 'final_delivery': 'video'
  }
};

// Aliases: types that share dept maps
const DEPT_MAP_ALIASES = {
  'sm-videos': 'sm-posts', 'sm-google-ads': 'sm-posts', 'sm-linkedin': 'sm-posts', 'sm-twitter': 'sm-posts',
  'agri4all-videos': 'agri4all-posts', 'agri4all-product-uploads': 'agri4all-posts',
  'agri4all-newsletters': 'agri4all-posts',
  'agri4all-newsletter-feature': 'agri4all-posts', 'agri4all-newsletter-banner': 'agri4all-posts',
  'agri4all-linkedin': 'agri4all-posts',
  'own-social-posts': 'sm-posts', 'own-social-videos': 'sm-posts',
  'own-social-linkedin': 'sm-posts', 'own-social-twitter': 'sm-posts',
  'magazine-sa-digital': 'magazine', 'magazine-africa-print': 'magazine',
  'magazine-africa-digital': 'magazine', 'magazine-coffee-table': 'magazine'
};

function getDeptMapForType(type) {
  const key = DEPT_MAP_ALIASES[type] || type;
  return DEPT_MAPS[key] || null;
}

// Helper: generate month array from start/end YYYY-MM strings
function getMonthRange(start, end) {
  if (!start || !end) return [];
  const months = [];
  const d = new Date(start + '-01');
  const endD = new Date(end + '-01');
  while (d <= endD) {
    months.push(d.toISOString().substring(0, 7));
    d.setMonth(d.getMonth() + 1);
  }
  return months;
}

const MONTH_NAMES = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
function formatMonth(m) {
  if (!m) return '';
  const parts = m.split('-');
  return MONTH_NAMES[parseInt(parts[1], 10) - 1] + ' ' + parts[0];
}

// POST /bulk - create deliverables from booking form checklist data (data-driven)
router.post('/bulk', async (req, res) => {
  const { booking_form_id } = toSnakeBody(req.body);

  if (!booking_form_id) {
    return res.status(400).json({ error: 'bookingFormId is required' });
  }

  try {
    // Idempotency: check if deliverables already exist for this booking form
    const existing = await pool.query(
      'SELECT * FROM deliverables WHERE booking_form_id = $1',
      [booking_form_id]
    );
    if (existing.rows.length > 0) {
      return res.json(existing.rows.map(toCamelCase));
    }

    // Fetch the booking form with form_data
    const bfResult = await pool.query(
      'SELECT bf.*, c.id AS c_id FROM booking_forms bf LEFT JOIN clients c ON c.id = bf.client_id WHERE bf.id = $1',
      [booking_form_id]
    );
    if (bfResult.rows.length === 0) {
      return res.status(404).json({ error: 'Booking form not found' });
    }
    const bf = bfResult.rows[0];
    const fd = bf.form_data || {};
    const clientId = bf.client_id;
    const allMonths = getMonthRange(bf.campaign_month_start, bf.campaign_month_end);

    // Look up all department IDs
    const deptResult = await pool.query("SELECT id, slug FROM departments");
    const deptBySlug = {};
    deptResult.rows.forEach(r => { deptBySlug[r.slug] = r.id; });
    const defaultDeptId = deptBySlug['production'];
    if (!defaultDeptId) {
      return res.status(500).json({ error: 'Production department not found' });
    }

    // Build list of deliverables to create based on enabled services in form_data
    const toCreate = [];

    function addType(type, title, initialStatus, activeMonths) {
      const months = (activeMonths && activeMonths.length) ? activeMonths : allMonths;
      months.forEach(m => {
        toCreate.push({
          type, title: title + ' \u2014 ' + formatMonth(m),
          initialStatus, deliveryMonth: m
        });
      });
    }

    // Social Media Management
    if (fd.socialMediaManagement && fd.socialMediaManagement.enabled) {
      const smMonths = fd.page2ActiveMonths && fd.page2ActiveMonths.length ? fd.page2ActiveMonths : allMonths;
      addType('sm-posts', 'SM Posts', 'request_client_materials', smMonths);
      if (fd.socialMediaManagement.contentCalendar) {
        addType('sm-content-calendar', 'Content Calendar', 'request_focus_points', smMonths);
      }
      if (fd.socialMediaManagement.googleAds) {
        addType('sm-google-ads', 'Google Ads', 'request_client_materials', smMonths);
      }
    }

    // Own Page Social Media
    if (fd.ownPageSocialMedia && fd.ownPageSocialMedia.enabled) {
      const smMonths = fd.page2ActiveMonths && fd.page2ActiveMonths.length ? fd.page2ActiveMonths : allMonths;
      addType('sm-posts', 'Own Page SM', 'request_client_materials', smMonths);
    }

    // Agri4All
    if (fd.agri4all && fd.agri4all.enabled) {
      const a4Months = fd.page3ActiveMonths && fd.page3ActiveMonths.length ? fd.page3ActiveMonths : allMonths;
      addType('agri4all-posts', 'Agri4All Posts', 'request_client_materials', a4Months);
    }

    // Online Articles
    if (fd.onlineArticles && fd.onlineArticles.enabled) {
      const oaMonths = fd.page4ActiveMonths && fd.page4ActiveMonths.length ? fd.page4ActiveMonths : allMonths;
      addType('online-articles', 'Online Articles', 'request_client_materials', oaMonths);
    }

    // Banners
    if (fd.banners && fd.banners.enabled) {
      const bnMonths = fd.page5ActiveMonths && fd.page5ActiveMonths.length ? fd.page5ActiveMonths : allMonths;
      addType('agri4all-banners', 'Banners', 'design', bnMonths);
    }

    // Magazine
    if (fd.magazine && fd.magazine.enabled) {
      const mgMonths = fd.page6ActiveMonths && fd.page6ActiveMonths.length ? fd.page6ActiveMonths : allMonths;
      addType('magazine', 'Magazine', 'request_client_materials', mgMonths);
    }

    // Video
    if (fd.video && fd.video.enabled) {
      const vdMonths = fd.page7ActiveMonths && fd.page7ActiveMonths.length ? fd.page7ActiveMonths : allMonths;
      addType('video', 'Video', 'send_request_form', vdMonths);
    }

    // Website Design
    if (fd.websiteDesign && fd.websiteDesign.enabled) {
      const wdMonths = fd.page8ActiveMonths && fd.page8ActiveMonths.length ? fd.page8ActiveMonths : allMonths;
      addType('website-design', 'Website Design', 'request_client_materials', wdMonths);
    }

    // Insert all deliverables in a transaction
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const created = [];
      const byType = {};
      for (const d of toCreate) {
        const status = d.initialStatus || 'pending';
        const deptMap = getDeptMapForType(d.type);
        const targetSlug = deptMap && deptMap[status] ? deptMap[status] : 'production';
        const departmentId = deptBySlug[targetSlug] || defaultDeptId;
        const result = await client.query(
          `INSERT INTO deliverables (booking_form_id, client_id, department_id, type, title, status, delivery_month)
           VALUES ($1, $2, $3, $4, $5, $6, $7)
           RETURNING *`,
          [booking_form_id, clientId, departmentId, d.type, d.title, status, d.deliveryMonth]
        );
        created.push(result.rows[0]);
        byType[d.type] = (byType[d.type] || 0) + 1;
      }
      await client.query('COMMIT');
      res.status(201).json({ totalCreated: created.length, byType, deliverables: created.map(toCamelCase) });
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  } catch (err) {
    console.error('Bulk create deliverables error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /create-content-calendars - create all deliverables from booking form
router.post('/create-content-calendars', async (req, res) => {
  const b = toSnakeBody(req.body);
  const bookingFormId = b.booking_form_id;

  if (!bookingFormId) {
    return res.status(400).json({ error: 'booking_form_id is required' });
  }

  try {
    // Idempotency — skip if any deliverables already exist for this booking form
    const existing = await pool.query(
      `SELECT id FROM deliverables WHERE booking_form_id = $1`,
      [bookingFormId]
    );
    if (existing.rows.length > 0) {
      return res.json({ message: 'Deliverables already exist', ids: existing.rows.map(r => r.id) });
    }

    // Fetch booking form with client info
    const bfResult = await pool.query(
      `SELECT bf.*, c.name AS client_name FROM booking_forms bf LEFT JOIN clients c ON c.id = bf.client_id WHERE bf.id = $1`,
      [bookingFormId]
    );
    if (bfResult.rows.length === 0) {
      return res.status(404).json({ error: 'Booking form not found' });
    }
    const bf = toCamelCase(bfResult.rows[0]);
    const clientName = bf.clientName || bf.title || 'Unknown Client';
    const clientId = bf.clientId;

    let formData = bf.formData || {};
    if (typeof formData === 'string') {
      try { formData = JSON.parse(formData); } catch (e) { formData = {}; }
    }

    // Look up department IDs
    const deptRows = await pool.query(`SELECT id, slug FROM departments`);
    const deptBySlug = {};
    deptRows.rows.forEach(r => { deptBySlug[r.slug] = r.id; });

    const MONTH_MAP = {
      'january': '01', 'february': '02', 'march': '03', 'april': '04',
      'may': '05', 'june': '06', 'july': '07', 'august': '08',
      'september': '09', 'october': '10', 'november': '11', 'december': '12'
    };
    function parseMonthLabel(label) {
      if (!label) return null;
      const match = label.match(/(\w+)\D*(\d{4})/);
      if (!match) return null;
      const monthNum = MONTH_MAP[match[1].toLowerCase()];
      return monthNum ? match[2] + '-' + monthNum : null;
    }

    async function createDeliv(type, title, status, deptSlug, deliveryMonth, metadata) {
      const deptId = deptBySlug[deptSlug] || null;
      const result = await pool.query(
        `INSERT INTO deliverables (booking_form_id, client_id, department_id, type, title, status, delivery_month, metadata, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW(), NOW()) RETURNING *`,
        [bookingFormId, clientId, deptId, type, title, status, deliveryMonth, JSON.stringify(metadata || {})]
      );
      return toCamelCase(result.rows[0]);
    }

    const created = [];

    // === Content Calendars ===
    const smEntries = formData.social_media_management || [];
    for (const entry of smEntries) {
      if (!entry.content_calendar) continue;
      const dm = parseMonthLabel(entry.month_label || entry.months_display);
      const ml = entry.month_label || entry.months_display || 'Unknown';
      created.push(await createDeliv(
        'sm-content-calendar',
        clientName + ' - Content Calendar - ' + ml,
        'request_focus_points', 'production', dm,
        {
          platforms: (entry.platforms || []).map(p => ({ platform: p.platform, key: p.key, link: p.link })),
          monthly_posts: entry.monthly_posts || entry.posts_per_month || null
        }
      ));
    }

    // === Google Ads ===
    for (const entry of smEntries) {
      if (!entry.google_ads || !entry.google_ads.enabled) continue;
      const dm = parseMonthLabel(entry.month_label || entry.months_display);
      const ml = entry.month_label || entry.months_display || 'Unknown';
      created.push(await createDeliv(
        'sm-google-ads',
        clientName + ' - Google Ads - ' + ml,
        'request_client_materials', 'production', dm,
        {
          initial_setup: entry.google_ads.initial_setup_text || '',
          monthly_ongoing: entry.google_ads.monthly_ongoing_text || '',
          ad_spend: entry.google_ads.ad_spend || ''
        }
      ));
    }

    // === Website Design ===
    const webEntries = formData.website || [];
    for (const entry of webEntries) {
      const dm = parseMonthLabel(entry.month_label || entry.months_display);
      const ml = entry.month_label || entry.months_display || 'Unknown';
      created.push(await createDeliv(
        'website-design',
        clientName + ' - Website Design - ' + ml,
        'request_client_materials', 'production', dm,
        {
          website_type: entry.website_type || '',
          number_of_pages: entry.number_of_pages || ''
        }
      ));
    }

    // === Magazine — separate deliverable per magazine type ===
    const MAG_TYPE_MAP = {
      'mag_sa': { type: 'magazine-sa-digital', label: 'SA Digital' },
      'mag_africa': { type: 'magazine-africa-print', label: 'Africa Print' },
      'mag_africa_digital': { type: 'magazine-africa-digital', label: 'Africa Digital' },
      'mag_coffee_table': { type: 'magazine-coffee-table', label: 'Coffee Table Book' }
    };
    const magEntries = formData.magazine || [];
    for (const entry of magEntries) {
      const dm = parseMonthLabel(entry.month_label || entry.months_display);
      const ml = entry.month_label || entry.months_display || 'Unknown';
      const magInfo = MAG_TYPE_MAP[entry.magazine_key] || { type: 'magazine', label: entry.magazine_display || entry.magazine || 'Magazine' };
      created.push(await createDeliv(
        magInfo.type,
        clientName + ' - ' + magInfo.label + ' - ' + ml,
        'request_client_materials', 'production', dm,
        {
          publication: magInfo.label,
          magazine_key: entry.magazine_key || '',
          page_size: entry.page_size || '',
          type: entry.type || '',
          positions: entry.positions || [],
          line_item: entry.line_item_text || entry.line_item || ''
        }
      ));
    }

    // === Banners ===
    const bannerEntries = formData.banners || [];
    for (const entry of bannerEntries) {
      const dm = parseMonthLabel(entry.month_label || entry.months_display);
      const ml = entry.month_label || entry.months_display || 'Unknown';
      const platforms = (entry.entries || []).map(e => e.platform).filter(Boolean);
      const impressions = {};
      (entry.entries || []).forEach(e => {
        if (e.platform && e.impressions) impressions[e.platform] = e.impressions;
      });
      const totalImpressions = (entry.entries || []).reduce((sum, e) => sum + (parseInt(e.impressions, 10) || 0), 0);
      created.push(await createDeliv(
        'agri4all-banners',
        clientName + ' - Banners - ' + ml,
        'design', 'design', dm,
        {
          platforms: platforms,
          impressions_by_platform: impressions,
          total_impressions: totalImpressions
        }
      ));
    }

    // === Video ===
    const videoEntries = formData.video || [];
    for (const entry of videoEntries) {
      const dm = parseMonthLabel(entry.month_label || entry.months_display);
      const ml = entry.month_label || entry.months_display || 'Unknown';
      const videoLabel = entry.video_type || 'Video';
      const titleSuffix = entry.video_index ? ' #' + entry.video_index : '';
      created.push(await createDeliv(
        'video',
        clientName + ' - ' + videoLabel + titleSuffix + ' - ' + ml,
        'send_request_form', 'production', dm,
        {
          video_type: entry.video_type || '',
          video_type_other: entry.video_type_other || '',
          video_duration: entry.video_duration || '',
          description: entry.description || '',
          shoot_location: entry.shoot_location || '',
          shoot_days: entry.shoot_days || '',
          shoot_hours: entry.shoot_hours || '',
          video_index: entry.video_index || '',
          photographer_included: !!entry.photographer_included,
          photographer_info: entry.photographer_info || '',
          photographer_portraits: entry.photographer_portraits || '',
          photographer_backdrop: entry.photographer_backdrop || '',
          photographer_groups: entry.photographer_groups || '',
          photographer_group_amount: entry.photographer_group_amount || '',
          photographer_days: entry.photographer_days || '',
          photographer_hours: entry.photographer_hours || '',
          photographer_flashes: !!entry.photographer_flashes
        }
      ));
    }

    // === Online Articles ===
    const oaEntries = formData.online_articles || [];
    for (const entry of oaEntries) {
      const dm = parseMonthLabel(entry.month_label || entry.months_display);
      const ml = entry.month_label || entry.months_display || 'Unknown';
      created.push(await createDeliv(
        'online-articles',
        clientName + ' - Online Articles - ' + ml,
        'request_client_materials', 'production', dm,
        {
          platforms: entry.platforms || [],
          amount: entry.amount || 0,
          curated_amount: entry.curated_amount || 0
        }
      ));
    }

    // === Agri4All ===
    // Group agri4all entries by month_label and combine countries
    const a4aEntries = formData.agri4all || [];
    const a4aByMonth = {};
    a4aEntries.forEach(e => {
      const key = e.month_label || e.months_display || 'Unknown';
      if (!a4aByMonth[key]) a4aByMonth[key] = { month_label: key, countries: [], states: [] };
      const country = e.country && e.country !== 'ALL' ? e.country : 'ALL';
      if (a4aByMonth[key].countries.indexOf(country) === -1) a4aByMonth[key].countries.push(country);
      a4aByMonth[key].states.push(e.state || {});
    });

    // Helper: merge any-state (check if any state has the field true)
    function anyHas(states, field) {
      return states.some(s => s && s[field] === true);
    }
    // Helper: max amount from any state
    function maxAmt(states, field) {
      let m = 0;
      states.forEach(s => {
        if (s && s[field]) {
          const n = parseInt(s[field], 10);
          if (!isNaN(n) && n > m) m = n;
        }
      });
      return m || '';
    }

    for (const ml in a4aByMonth) {
      const group = a4aByMonth[ml];
      const dm = parseMonthLabel(ml);
      const states = group.states;
      const countries = group.countries;

      // 1. Agri4All Posts (FB + IG posts)
      if (anyHas(states, 'facebook_posts') || anyHas(states, 'instagram_posts')) {
        const igPosts = anyHas(states, 'instagram_posts');
        const igPostsAmount = maxAmt(states, 'instagram_posts_amount');
        created.push(await createDeliv(
          'agri4all-posts',
          clientName + ' - Agri4All Posts - ' + ml,
          'request_client_materials', 'production', dm,
          {
            countries: countries,
            facebook_posts: anyHas(states, 'facebook_posts'),
            facebook_posts_amount: maxAmt(states, 'facebook_posts_amount'),
            facebook_posts_curated_amount: maxAmt(states, 'facebook_posts_curated_amount'),
            instagram_posts: igPosts,
            instagram_posts_amount: igPostsAmount,
            instagram_posts_curated_amount: maxAmt(states, 'instagram_posts_curated_amount'),
            // Instagram Stories auto-derived from IG posts (same amount)
            instagram_stories: igPosts,
            instagram_stories_amount: igPostsAmount
          }
        ));
      }

      // 2. Agri4All Product Uploads
      if (anyHas(states, 'agri4all_product_uploads') || anyHas(states, 'unlimited_product_uploads')) {
        created.push(await createDeliv(
          'agri4all-product-uploads',
          clientName + ' - Agri4All Product Uploads - ' + ml,
          'request_client_materials', 'production', dm,
          {
            countries: countries,
            product_uploads: anyHas(states, 'agri4all_product_uploads'),
            product_uploads_amount: maxAmt(states, 'agri4all_product_uploads_amount'),
            unlimited_product_uploads: anyHas(states, 'unlimited_product_uploads')
          }
        ));
      }

      // 3. Agri4All Videos (stories + video posts + TikTok + YouTube)
      const hasAnyVideo = anyHas(states, 'facebook_stories') || anyHas(states, 'instagram_stories') ||
        anyHas(states, 'facebook_video_posts') || anyHas(states, 'tiktok_shorts') ||
        anyHas(states, 'youtube_shorts') || anyHas(states, 'youtube_video');
      if (hasAnyVideo) {
        created.push(await createDeliv(
          'agri4all-videos',
          clientName + ' - Agri4All Videos - ' + ml,
          'request_client_materials', 'production', dm,
          {
            countries: countries,
            facebook_stories: anyHas(states, 'facebook_stories'),
            facebook_stories_amount: maxAmt(states, 'facebook_stories_amount'),
            instagram_stories: anyHas(states, 'instagram_stories'),
            instagram_stories_amount: maxAmt(states, 'instagram_stories_amount'),
            facebook_video_posts: anyHas(states, 'facebook_video_posts'),
            facebook_video_posts_amount: maxAmt(states, 'facebook_video_posts_amount'),
            facebook_video_posts_curated_amount: maxAmt(states, 'facebook_video_posts_curated_amount'),
            tiktok_shorts: anyHas(states, 'tiktok_shorts'),
            tiktok_amount: maxAmt(states, 'tiktok_amount'),
            youtube_shorts: anyHas(states, 'youtube_shorts'),
            youtube_shorts_amount: maxAmt(states, 'youtube_shorts_amount'),
            youtube_video: anyHas(states, 'youtube_video'),
            youtube_video_amount: maxAmt(states, 'youtube_video_amount')
          }
        ));
      }

      // 4. Newsletter Feature
      if (anyHas(states, 'newsletter_feature')) {
        created.push(await createDeliv(
          'agri4all-newsletter-feature',
          clientName + ' - Newsletter Feature - ' + ml,
          'request_client_materials', 'production', dm,
          {
            countries: countries,
            amount: maxAmt(states, 'newsletter_feature_amount')
          }
        ));
      }

      // 5. Newsletter Banner
      if (anyHas(states, 'newsletter_banner')) {
        created.push(await createDeliv(
          'agri4all-newsletter-banner',
          clientName + ' - Newsletter Banner - ' + ml,
          'request_client_materials', 'production', dm,
          {
            countries: countries,
            amount: maxAmt(states, 'newsletter_banner_amount')
          }
        ));
      }

      // 6. LinkedIn (article + company campaign)
      if (anyHas(states, 'linkedin_article') || anyHas(states, 'linkedin_company_campaign')) {
        created.push(await createDeliv(
          'agri4all-linkedin',
          clientName + ' - Agri4All LinkedIn - ' + ml,
          'request_client_materials', 'production', dm,
          {
            countries: countries,
            article: anyHas(states, 'linkedin_article'),
            company_campaign: anyHas(states, 'linkedin_company_campaign'),
            amount: maxAmt(states, 'linkedin_amount')
          }
        ));
      }
    }

    // === Own Page Social Media ===
    // From social_media_management[].own_page — one deliverable per month per type
    for (const sm of smEntries) {
      const op = sm.own_page || {};
      const dm = parseMonthLabel(sm.month_label || sm.months_display);
      const ml = sm.month_label || sm.months_display || 'Unknown';

      // 1. Own Page Posts (FB posts, IG posts, FB stories, IG stories)
      if (op.facebook_posts || op.instagram_posts || op.facebook_stories || op.instagram_stories) {
        const igPosts = !!op.instagram_posts;
        const igPostsAmt = op.instagram_posts_amount || '';
        created.push(await createDeliv(
          'own-social-posts',
          clientName + ' - Own Page Posts - ' + ml,
          'request_client_materials', 'production', dm,
          {
            facebook_posts: !!op.facebook_posts,
            facebook_posts_amount: op.facebook_posts_amount || '',
            facebook_posts_curated_amount: op.facebook_posts_curated_amount || '',
            facebook_posts_timeframe: op.facebook_posts_timeframe || '',
            facebook_stories: !!op.facebook_stories,
            facebook_stories_amount: op.facebook_stories_amount || '',
            facebook_stories_timeframe: op.facebook_stories_timeframe || '',
            instagram_posts: igPosts,
            instagram_posts_amount: igPostsAmt,
            instagram_posts_curated_amount: op.instagram_posts_curated_amount || '',
            instagram_posts_timeframe: op.instagram_posts_timeframe || '',
            // IG stories auto-derived from IG posts (same amount)
            instagram_stories: igPosts || !!op.instagram_stories,
            instagram_stories_amount: igPostsAmt || op.instagram_stories_amount || '',
            instagram_stories_timeframe: op.instagram_stories_timeframe || ''
          }
        ));
      }

      // 2. Own Page Videos
      if (op.facebook_video_posts || op.tiktok_shorts || op.youtube_shorts || op.youtube_video) {
        created.push(await createDeliv(
          'own-social-videos',
          clientName + ' - Own Page Videos - ' + ml,
          'request_client_materials', 'production', dm,
          {
            facebook_video_posts: !!op.facebook_video_posts,
            facebook_video_posts_amount: op.facebook_video_posts_amount || '',
            facebook_video_posts_curated_amount: op.facebook_video_posts_curated_amount || '',
            facebook_video_posts_timeframe: op.facebook_video_posts_timeframe || '',
            tiktok_shorts: !!op.tiktok_shorts,
            tiktok_amount: op.tiktok_amount || '',
            tiktok_timeframe: op.tiktok_timeframe || '',
            youtube_shorts: !!op.youtube_shorts,
            youtube_shorts_amount: op.youtube_shorts_amount || '',
            youtube_shorts_timeframe: op.youtube_shorts_timeframe || '',
            youtube_video: !!op.youtube_video,
            youtube_video_amount: op.youtube_video_amount || '',
            youtube_video_timeframe: op.youtube_video_timeframe || ''
          }
        ));
      }

      // 3. Own Page LinkedIn
      if (op.linkedin_article || op.linkedin_campaign) {
        created.push(await createDeliv(
          'own-social-linkedin',
          clientName + ' - Own Page LinkedIn - ' + ml,
          'request_client_materials', 'production', dm,
          {
            article: !!op.linkedin_article,
            campaign: !!op.linkedin_campaign,
            amount: op.linkedin_amount || '',
            timeframe: op.linkedin_timeframe || ''
          }
        ));
      }

      // 4. Own Page Twitter
      if (op.twitter_x_posts) {
        created.push(await createDeliv(
          'own-social-twitter',
          clientName + ' - Own Page Twitter/X - ' + ml,
          'request_client_materials', 'production', dm,
          {
            twitter_x_posts: true,
            amount: op.twitter_x_posts_amount || '',
            timeframe: op.twitter_x_posts_timeframe || ''
          }
        ));
      }
    }

    res.status(201).json({ message: 'Deliverables created', count: created.length, deliverables: created });
  } catch (err) {
    console.error('Create deliverables from booking error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST / - create deliverable
router.post('/', async (req, res) => {
  const b = toSnakeBody(req.body);
  const { booking_form_id, department_id, type, title, description, status, assigned_to, due_date } = b;

  if (!booking_form_id || !department_id || !type || !title) {
    return res.status(400).json({ error: 'booking_form_id, department_id, type, and title are required' });
  }

  try {
    const result = await pool.query(
      `INSERT INTO deliverables (booking_form_id, department_id, type, title, description, status, assigned_to, due_date)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING *`,
      [booking_form_id, department_id, type, title, description || null, status || 'pending', assigned_to || null, due_date || null]
    );
    res.status(201).json(toCamelCase(result.rows[0]));
  } catch (err) {
    console.error('Create deliverable error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PATCH /:id - update deliverable (auto-routes website-design by status)
router.patch('/:id', async (req, res) => {
  const body = toSnakeBody(req.body);

  // Auto-route deliverables to correct department on status change
  if (body.status) {
    const existing = await pool.query('SELECT type FROM deliverables WHERE id = $1', [req.params.id]);
    if (existing.rows.length > 0) {
      const deptMap = getDeptMapForType(existing.rows[0].type);
      if (deptMap && deptMap[body.status]) {
        const targetSlug = deptMap[body.status];
        const deptResult = await pool.query('SELECT id FROM departments WHERE slug = $1', [targetSlug]);
        if (deptResult.rows.length > 0) {
          body.department_id = deptResult.rows[0].id;
        }
      }
    }
  }

  // Handle metadata JSONB — merge with existing instead of replacing
  if (body.metadata !== undefined && typeof body.metadata === 'object' && body.metadata !== null) {
    try {
      const existing = await pool.query('SELECT metadata FROM deliverables WHERE id = $1', [req.params.id]);
      if (existing.rows.length > 0) {
        const current = existing.rows[0].metadata || {};
        body.metadata = JSON.stringify(Object.assign({}, current, body.metadata));
      } else {
        body.metadata = JSON.stringify(body.metadata);
      }
    } catch (e) {
      body.metadata = JSON.stringify(body.metadata);
    }
  }

  const fields = ['title', 'description', 'type', 'status', 'assigned_to', 'due_date', 'department_id', 'booking_form_id', 'follow_up_count',
    'assigned_admin', 'assigned_production', 'assigned_design', 'assigned_editorial',
    'assigned_video', 'assigned_agri4all', 'assigned_social_media', 'delivery_month', 'client_id', 'metadata'];
  const updates = [];
  const values = [];
  let idx = 1;

  for (const field of fields) {
    if (body[field] !== undefined) {
      updates.push(`${field} = $${idx}`);
      values.push(body[field]);
      idx++;
    }
  }

  // Auto-set status_changed_at when status changes
  if (body.status !== undefined) {
    updates.push('status_changed_at = NOW()');
  }

  if (updates.length === 0) {
    return res.status(400).json({ error: 'No fields to update' });
  }

  values.push(req.params.id);

  try {
    const result = await pool.query(
      `UPDATE deliverables SET ${updates.join(', ')} WHERE id = $${idx} RETURNING *`,
      values
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Deliverable not found' });
    }
    res.json(toCamelCase(result.rows[0]));
  } catch (err) {
    console.error('Update deliverable error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// DELETE /:id - delete deliverable
router.delete('/:id', async (req, res) => {
  try {
    const result = await pool.query(
      'DELETE FROM deliverables WHERE id = $1 RETURNING *',
      [req.params.id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Deliverable not found' });
    }
    res.json(toCamelCase(result.rows[0]));
  } catch (err) {
    console.error('Delete deliverable error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /:id/upload-images - upload images for a deliverable
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const imgUploadDir = path.join(__dirname, '../uploads/deliverable-images');
if (!fs.existsSync(imgUploadDir)) fs.mkdirSync(imgUploadDir, { recursive: true });

const imgStorage = multer.diskStorage({
  destination: function (req, file, cb) { cb(null, imgUploadDir); },
  filename: function (req, file, cb) {
    var ext = path.extname(file.originalname) || '.jpg';
    cb(null, 'deliv-' + req.params.id + '-' + Date.now() + '-' + Math.random().toString(36).substring(2, 6) + ext);
  }
});
const imgUpload = multer({ storage: imgStorage, limits: { fileSize: 10 * 1024 * 1024 } });

router.post('/:id/upload-images', imgUpload.array('images', 10), async (req, res) => {
  try {
    var urls = (req.files || []).map(f => '/uploads/deliverable-images/' + f.filename);
    res.json({ urls: urls });
  } catch (err) {
    console.error('Image upload error:', err);
    res.status(500).json({ error: 'Upload failed' });
  }
});

module.exports = router;
