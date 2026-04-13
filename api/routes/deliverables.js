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

// GET /by-type/:typeSlug - list deliverables by type family with optional status filter
// When typeSlug is a DEPT_MAP_ALIASES parent (e.g. 'magazine'), expand to all aliased sub-types.
// Optional ?status=approved query param filters by deliverable status.
router.get('/by-type/:typeSlug', async (req, res) => {
  try {
    const typeSlug = req.params.typeSlug;
    // Expand to all sub-types that alias to this family
    const types = [typeSlug];
    for (const alias in DEPT_MAP_ALIASES) {
      if (DEPT_MAP_ALIASES[alias] === typeSlug) types.push(alias);
    }

    const params = [types];
    let statusClause = '';
    if (req.query.status) {
      params.push(req.query.status);
      statusClause = ` AND d.status = $${params.length}`;
    }

    const result = await pool.query(
      `SELECT d.*, dept.name AS department_name, dept.slug AS department_slug,
              bf.title AS booking_form_title, c.name AS client_name, c.id AS client_id
       FROM deliverables d
       LEFT JOIN departments dept ON dept.id = d.department_id
       LEFT JOIN booking_forms bf ON bf.id = d.booking_form_id
       LEFT JOIN clients c ON c.id = bf.client_id
       WHERE d.type = ANY($1)${statusClause}
       ORDER BY d.delivery_month DESC NULLS LAST, d.updated_at DESC`,
      params
    );
    res.json(result.rows.map(toCamelCase));
  } catch (err) {
    console.error('List deliverables by type error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /:id/request-form - Phase 5 materials recap
// Returns the latest completed request_forms row tied to this deliverable
// (or to the deliverable's client if no per-deliverable form exists), plus
// any client_assets of kind=form_upload for that client.
router.get('/:id/request-form', async (req, res) => {
  try {
    const delivRes = await pool.query(
      'SELECT id, client_id FROM deliverables WHERE id = $1',
      [req.params.id]
    );
    if (delivRes.rows.length === 0) {
      return res.status(404).json({ error: 'Deliverable not found' });
    }
    const { client_id } = delivRes.rows[0];

    const formRes = await pool.query(
      `SELECT *
         FROM request_forms
        WHERE status = 'completed'
          AND (
            deliverable_id = $1
            OR (client_id = $2 AND deliverable_id IS NULL)
          )
        ORDER BY completed_at DESC NULLS LAST, created_at DESC
        LIMIT 1`,
      [req.params.id, client_id]
    );

    if (formRes.rows.length === 0) {
      return res.status(404).json({
        error: 'No completed request form found for this deliverable or client'
      });
    }

    let assets = [];
    if (client_id) {
      const assetsRes = await pool.query(
        `SELECT * FROM client_assets
          WHERE client_id = $1 AND kind = 'form_upload'
          ORDER BY uploaded_at DESC`,
        [client_id]
      );
      assets = assetsRes.rows.map(toCamelCase);
    }

    res.json({
      form: toCamelCase(formRes.rows[0]),
      assets: assets
    });
  } catch (err) {
    console.error('Get request-form recap error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /:id/post-to-alpha - upload approved agri4all-product-uploads deliverable to Alpha Agri4All
router.post('/:id/post-to-alpha', async (req, res) => {
  const { getCategories, postProduct } = require('../lib/alpha-agri4all');
  const { autofillProductFields } = require('../lib/openai-autofill');
  const { toIsoAlpha2 } = require('../lib/country-codes');
  const { UPLOAD_DIR } = require('../config');
  const path = require('path');

  try {
    // 1. Fetch deliverable; verify type and status
    const delivRes = await pool.query(
      `SELECT d.*, bf.form_data AS booking_form_data
       FROM deliverables d
       LEFT JOIN booking_forms bf ON bf.id = d.booking_form_id
       WHERE d.id = $1`,
      [req.params.id]
    );
    if (delivRes.rows.length === 0) {
      return res.status(404).json({ data: null, error: 'Deliverable not found' });
    }
    const deliverable = delivRes.rows[0];
    if (deliverable.type !== 'agri4all-product-uploads') {
      return res.status(400).json({ data: null, error: 'Deliverable is not of type agri4all-product-uploads' });
    }
    if (deliverable.status !== 'approved') {
      return res.status(400).json({ data: null, error: 'Deliverable must be in approved status to post to Alpha' });
    }

    const metadata = deliverable.metadata || {};
    const bookingFormData = deliverable.booking_form_data || {};

    // 2. Fetch categories from Alpha
    const categoriesTree = await getCategories();

    // 3. Autofill product fields via OpenAI
    const autofilled = await autofillProductFields({
      requestFormData: bookingFormData,
      categoriesTree,
    });

    // 4. Collect media file paths from metadata.sections
    const mediaFilePaths = [];
    const sections = metadata.sections || [];
    for (const section of sections) {
      const files = section.files || [];
      for (const file of files) {
        const filename = file.filename || file.url;
        if (filename) {
          mediaFilePaths.push(path.join(UPLOAD_DIR, filename));
        }
      }
    }

    // 5. Build Alpha payload
    const additionalLocations = (metadata.countries || [])
      .map(c => ({ country: toIsoAlpha2(c) }))
      .filter(l => l.country);

    const alphaPayload = {
      name: autofilled.name,
      description: autofilled.description,
      category_id: autofilled.category_id,
      price: { type: 'price_on_request' },
      location: {
        country: 'ZA',
        address: metadata.address || '',
      },
      additional_locations: additionalLocations,
    };

    // 6. Post to Alpha
    const alphaResponse = await postProduct(alphaPayload, mediaFilePaths);

    // 7. Update deliverable status and store alpha_product_id
    const alphaProductId = (alphaResponse.data && alphaResponse.data.id) || alphaResponse.id || null;
    const updatedMetadata = { ...metadata, alpha_product_id: alphaProductId };
    await pool.query(
      `UPDATE deliverables SET status = 'agri4all-links', metadata = $1, updated_at = NOW() WHERE id = $2`,
      [JSON.stringify(updatedMetadata), req.params.id]
    );

    return res.json({ data: { success: true, alphaProduct: alphaResponse }, error: null });
  } catch (err) {
    console.error('post-to-alpha error:', err);
    return res.status(502).json({ data: null, error: err.message || 'Failed to post product to Alpha Agri4All' });
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
    // legacy aliases — post-rollback rows still route until db.js migration runs
    'request_materials': 'production', 'materials_requested': 'production', 'materials_received': 'production',
    'design': 'design', 'design_review': 'design', 'design_changes': 'design',
    'editorial': 'editorial', 'editorial_review': 'editorial',
    'ready_for_approval': 'production', 'sent_for_approval': 'production', 'client_changes': 'production',
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
  'agri4all-product-uploads': {
    'request_client_materials': 'production',
    'waiting_for_materials': 'production',
    'materials_received': 'production',
    'design': 'design', 'design_review': 'design', 'design_changes': 'design',
    'ready_for_approval': 'admin',
    'sent_for_approval': 'admin',
    'approved': 'admin',
    'agri4all-links': 'agri4all'
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
    'materials_received': 'editorial',
    'editing': 'editorial', 'editorial_review': 'editorial', 'editorial_changes': 'editorial',
    'ready_for_approval': 'production', 'sent_for_approval': 'production', 'client_changes': 'editorial',
    'approved': 'editorial', 'translating': 'editorial', 'ready_to_upload': 'editorial', 'posted': 'editorial'
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
    // These must route to the same department as their canonical replacements.
    'sitemap': 'design',          // legacy → site_map
    'wireframe': 'design',        // legacy → site_map
    'prototype': 'design',        // legacy → site_map
    'site_developed': 'design'    // legacy → site_development
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
  'agri4all-videos': 'agri4all-posts',
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

    // Social Media Management — enabled if array has entries
    const smmArr = fd.social_media_management || [];
    if (smmArr.length > 0) {
      addType('sm-posts', 'SM Posts', 'request_client_materials', allMonths);
      if (smmArr.some(e => e.content_calendar)) {
        addType('sm-content-calendar', 'Content Calendar', 'request_focus_points', allMonths);
      }
      if (smmArr.some(e => e.google_ads && e.google_ads.enabled)) {
        addType('sm-google-ads', 'Google Ads', 'request_client_materials', allMonths);
      }
      // Own Page Social Media
      const hasOwnPage = smmArr.some(e => {
        const o = e.own_page || {};
        return o.facebook_posts || o.instagram_posts || o.tiktok_shorts ||
               o.youtube_shorts || o.youtube_video || o.linkedin_article;
      });
      if (hasOwnPage) {
        addType('sm-posts', 'Own Page SM', 'request_client_materials', allMonths);
      }
    }

    // Agri4All
    if ((fd.agri4all || []).length > 0) {
      addType('agri4all-posts', 'Agri4All Posts', 'request_client_materials', allMonths);
    }

    // Online Articles
    if ((fd.online_articles || []).length > 0) {
      addType('online-articles', 'Online Articles', 'request_client_materials', allMonths);
    }

    // Banners
    if ((fd.banners || []).length > 0) {
      addType('agri4all-banners', 'Banners', 'design', allMonths);
    }

    // Magazine
    if ((fd.magazine || []).length > 0) {
      addType('magazine', 'Magazine', 'request_client_materials', allMonths);
    }

    // Video
    if ((fd.video || []).length > 0) {
      addType('video', 'Video', 'send_request_form', allMonths);
    }

    // Website
    if ((fd.website || []).length > 0) {
      addType('website-design', 'Website Design', 'request_client_materials', allMonths);
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

    const MONTH_NAMES_FULL = ['January','February','March','April','May','June',
      'July','August','September','October','November','December'];

    // Returns an array of { month: 'YYYY-MM', label: 'Month YYYY' } objects.
    // For specific month labels (e.g. "May 2026") returns a single entry.
    // For "All Months" or unparseable labels, expands the booking form's
    // campaign_month_start..campaign_month_end range so one deliverable is
    // created per month. Falls back to current month if range is missing.
    function getDeliveryMonths(label) {
      const parsed = parseMonthLabel(label);
      if (parsed) return [{ month: parsed, label: label }];

      // Expand campaign range for "All Months" or unparseable labels
      const start = bf.campaignMonthStart;
      const end = bf.campaignMonthEnd;
      if (start && end) {
        const months = [];
        let [sy, sm] = start.split('-').map(Number);
        const [ey, em] = end.split('-').map(Number);
        while (sy < ey || (sy === ey && sm <= em)) {
          const ym = sy + '-' + (sm < 10 ? '0' + sm : '' + sm);
          months.push({ month: ym, label: MONTH_NAMES_FULL[sm - 1] + ' ' + sy });
          sm++;
          if (sm > 12) { sm = 1; sy++; }
        }
        if (months.length > 0) return months;
      }

      // Final fallback — current month
      const cur = new Date().toISOString().substring(0, 7);
      return [{ month: cur, label: label || 'Unknown' }];
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
      const months = getDeliveryMonths(entry.month_label || entry.months_display);
      for (const { month, label } of months) {
        created.push(await createDeliv(
          'sm-content-calendar',
          clientName + ' - Content Calendar - ' + label,
          'request_focus_points', 'production', month,
          {
            platforms: (entry.platforms || []).map(p => ({ platform: p.platform, key: p.key, link: p.link })),
            monthly_posts: entry.monthly_posts || entry.posts_per_month || null
          }
        ));
      }
    }

    // === Google Ads ===
    // Check both inside SM entries AND at the form_data top level
    let createdGoogleAds = false;
    for (const entry of smEntries) {
      if (!entry.google_ads || !entry.google_ads.enabled) continue;
      createdGoogleAds = true;
      const months = getDeliveryMonths(entry.month_label || entry.months_display);
      for (const { month, label } of months) {
        created.push(await createDeliv(
          'sm-google-ads',
          clientName + ' - Google Ads - ' + label,
          'request_client_materials', 'production', month,
          {
            initial_setup: entry.google_ads.initial_setup_text || '',
            monthly_ongoing: entry.google_ads.monthly_ongoing_text || '',
            ad_spend: entry.google_ads.ad_spend || ''
          }
        ));
      }
    }
    // Top-level google_ads (checklist wizard stores it at form_data root)
    if (!createdGoogleAds && formData.google_ads && formData.google_ads.enabled) {
      const refLabel = (smEntries[0] && (smEntries[0].month_label || smEntries[0].months_display)) || null;
      const months = getDeliveryMonths(refLabel);
      for (const { month, label } of months) {
        created.push(await createDeliv(
          'sm-google-ads',
          clientName + ' - Google Ads - ' + label,
          'request_client_materials', 'production', month,
          {
            initial_setup: formData.google_ads.initial_text || formData.google_ads.initial_setup_text || '',
            monthly_ongoing: formData.google_ads.monthly_text || formData.google_ads.monthly_ongoing_text || '',
            ad_spend: formData.google_ads.ad_spend || ''
          }
        ));
      }
    }

    // === Website Design ===
    const webEntries = formData.website || [];
    for (const entry of webEntries) {
      const months = getDeliveryMonths(entry.month_label || entry.months_display);
      for (const { month, label } of months) {
        created.push(await createDeliv(
          'website-design',
          clientName + ' - Website Design - ' + label,
          'request_client_materials', 'production', month,
          {
            website_type: entry.website_type || '',
            number_of_pages: entry.number_of_pages || ''
          }
        ));
      }
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
      const months = getDeliveryMonths(entry.month_label || entry.months_display);
      const magInfo = MAG_TYPE_MAP[entry.magazine_key] || { type: 'magazine', label: entry.magazine_display || entry.magazine || 'Magazine' };
      for (const { month, label } of months) {
        created.push(await createDeliv(
          magInfo.type,
          clientName + ' - ' + magInfo.label + ' - ' + label,
          'request_client_materials', 'production', month,
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
    }

    // === Banners ===
    const bannerEntries = formData.banners || [];
    for (const entry of bannerEntries) {
      const months = getDeliveryMonths(entry.month_label || entry.months_display);
      const platforms = (entry.entries || []).map(e => e.platform).filter(Boolean);
      const impressions = {};
      (entry.entries || []).forEach(e => {
        if (e.platform && e.impressions) impressions[e.platform] = e.impressions;
      });
      const totalImpressions = (entry.entries || []).reduce((sum, e) => sum + (parseInt(e.impressions, 10) || 0), 0);
      for (const { month, label } of months) {
        created.push(await createDeliv(
          'agri4all-banners',
          clientName + ' - Banners - ' + label,
          'design', 'design', month,
          {
            platforms: platforms,
            impressions_by_platform: impressions,
            total_impressions: totalImpressions
          }
        ));
      }
    }

    // === Video ===
    const videoEntries = formData.video || [];
    for (const entry of videoEntries) {
      const months = getDeliveryMonths(entry.month_label || entry.months_display);
      const videoLabel = entry.video_type || 'Video';
      const titleSuffix = entry.video_index ? ' #' + entry.video_index : '';
      for (const { month, label } of months) {
        created.push(await createDeliv(
          'video',
          clientName + ' - ' + videoLabel + titleSuffix + ' - ' + label,
          'send_request_form', 'production', month,
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
    }

    // === Online Articles ===
    const oaEntries = formData.online_articles || [];
    for (const entry of oaEntries) {
      const months = getDeliveryMonths(entry.month_label || entry.months_display);
      for (const { month, label } of months) {
        created.push(await createDeliv(
          'online-articles',
          clientName + ' - Online Articles - ' + label,
          'request_client_materials', 'production', month,
          {
            platforms: entry.platforms || [],
            amount: entry.amount || 0,
            curated_amount: entry.curated_amount || 0
          }
        ));
      }
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
      const delivMonths = getDeliveryMonths(ml);
      const states = group.states;
      const countries = group.countries;

      for (const { month: dm, label: monthLabel } of delivMonths) {

      // 1. Agri4All Posts (FB + IG posts + IG stories)
      if (anyHas(states, 'facebook_posts') || anyHas(states, 'instagram_posts') || anyHas(states, 'instagram_stories')) {
        created.push(await createDeliv(
          'agri4all-posts',
          clientName + ' - Agri4All Posts - ' + monthLabel,
          'request_client_materials', 'production', dm,
          {
            countries: countries,
            facebook_posts: anyHas(states, 'facebook_posts'),
            facebook_posts_amount: maxAmt(states, 'facebook_posts_amount'),
            facebook_posts_curated_amount: maxAmt(states, 'facebook_posts_curated_amount'),
            instagram_posts: anyHas(states, 'instagram_posts'),
            instagram_posts_amount: maxAmt(states, 'instagram_posts_amount'),
            instagram_posts_curated_amount: maxAmt(states, 'instagram_posts_curated_amount'),
            // Instagram Stories belong with posts, read directly from states
            instagram_stories: anyHas(states, 'instagram_stories'),
            instagram_stories_amount: maxAmt(states, 'instagram_stories_amount')
          }
        ));
      }

      // 2. Agri4All Product Uploads
      if (anyHas(states, 'agri4all_product_uploads') || anyHas(states, 'unlimited_product_uploads')) {
        created.push(await createDeliv(
          'agri4all-product-uploads',
          clientName + ' - Agri4All Product Uploads - ' + monthLabel,
          'request_client_materials', 'production', dm,
          {
            countries: countries,
            product_uploads: anyHas(states, 'agri4all_product_uploads'),
            product_uploads_amount: maxAmt(states, 'agri4all_product_uploads_amount'),
            unlimited_product_uploads: anyHas(states, 'unlimited_product_uploads')
          }
        ));
      }

      // 3. Agri4All Videos (FB stories + video posts + TikTok + YouTube)
      // Note: instagram_stories belongs to agri4all-posts, not videos.
      const hasAnyVideo = anyHas(states, 'facebook_stories') ||
        anyHas(states, 'facebook_video_posts') || anyHas(states, 'tiktok_shorts') ||
        anyHas(states, 'youtube_shorts') || anyHas(states, 'youtube_video');
      if (hasAnyVideo) {
        created.push(await createDeliv(
          'agri4all-videos',
          clientName + ' - Agri4All Videos - ' + monthLabel,
          'request_client_materials', 'production', dm,
          {
            countries: countries,
            facebook_stories: anyHas(states, 'facebook_stories'),
            facebook_stories_amount: maxAmt(states, 'facebook_stories_amount'),
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
          clientName + ' - Newsletter Feature - ' + monthLabel,
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
          clientName + ' - Newsletter Banner - ' + monthLabel,
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
          clientName + ' - Agri4All LinkedIn - ' + monthLabel,
          'request_client_materials', 'production', dm,
          {
            countries: countries,
            article: anyHas(states, 'linkedin_article'),
            company_campaign: anyHas(states, 'linkedin_company_campaign'),
            amount: maxAmt(states, 'linkedin_amount')
          }
        ));
      }

      } // end delivMonths loop
    }

    // === Own Page Social Media ===
    // From social_media_management[].own_page — one deliverable per month per type
    for (const sm of smEntries) {
      const op = sm.own_page || {};
      const ownMonths = getDeliveryMonths(sm.month_label || sm.months_display);

      for (const { month: ownDm, label: ownLabel } of ownMonths) {

      // 1. Own Page Posts (FB posts, IG posts, FB stories, IG stories)
      if (op.facebook_posts || op.instagram_posts || op.facebook_stories || op.instagram_stories) {
        const igPosts = !!op.instagram_posts;
        const igPostsAmt = op.instagram_posts_amount || '';
        created.push(await createDeliv(
          'own-social-posts',
          clientName + ' - Own Page Posts - ' + ownLabel,
          'request_client_materials', 'production', ownDm,
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
          clientName + ' - Own Page Videos - ' + ownLabel,
          'request_client_materials', 'production', ownDm,
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
          clientName + ' - Own Page LinkedIn - ' + ownLabel,
          'request_client_materials', 'production', ownDm,
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
          clientName + ' - Own Page Twitter/X - ' + ownLabel,
          'request_client_materials', 'production', ownDm,
          {
            twitter_x_posts: true,
            amount: op.twitter_x_posts_amount || '',
            timeframe: op.twitter_x_posts_timeframe || ''
          }
        ));
      }

      } // end ownMonths loop
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

  // Online Articles: when advancing TO 'translating' from 'approved',
  // honor the metadata.needs_translation flag. If false, skip translating
  // and go straight to ready_to_upload.
  if (body.status === 'translating') {
    const existing = await pool.query('SELECT type, status, metadata FROM deliverables WHERE id = $1', [req.params.id]);
    if (existing.rows.length > 0) {
      const d = existing.rows[0];
      if (d.type === 'online-articles' && d.status === 'approved') {
        let meta = d.metadata || {};
        if (typeof meta === 'string') try { meta = JSON.parse(meta); } catch (e) { meta = {}; }
        if (meta.needs_translation !== true) {
          // Skip translating — go straight to ready_to_upload.
          body.status = 'ready_to_upload';
        }
      }
    }
  }

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

    // Phase 4 — silently mirror uploads into client_assets (kind=cc_post_image).
    // Failure here must NOT fail the upload response.
    (async () => {
      try {
        if (!urls.length) return;
        const delivRes = await pool.query(
          'SELECT client_id FROM deliverables WHERE id = $1',
          [req.params.id]
        );
        const clientId = delivRes.rows[0] && delivRes.rows[0].client_id;
        if (!clientId) return;
        const uploaderId = (req.user && req.user.id) || null;
        for (let i = 0; i < urls.length; i++) {
          const f = (req.files || [])[i] || {};
          try {
            await pool.query(
              `INSERT INTO client_assets
                 (client_id, deliverable_id, kind, url, mime_type, uploaded_by)
               VALUES ($1, $2, 'cc_post_image', $3, $4, $5)`,
              [clientId, req.params.id, urls[i], f.mimetype || null, uploaderId]
            );
          } catch (innerErr) {
            console.error('client_assets insert failed for deliverable ' + req.params.id + ':', innerErr.message);
          }
        }
      } catch (mirrorErr) {
        console.error('client_assets mirror error:', mirrorErr.message);
      }
    })();

    res.json({ urls: urls });
  } catch (err) {
    console.error('Image upload error:', err);
    res.status(500).json({ error: 'Upload failed' });
  }
});

module.exports = router;
