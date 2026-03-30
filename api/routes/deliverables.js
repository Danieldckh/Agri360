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
router.get('/by-department/:deptSlug', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT d.*, dept.name AS department_name, dept.slug AS department_slug,
              bf.title AS booking_form_title, c.name AS client_name, c.id AS client_id
       FROM deliverables d
       JOIN departments dept ON dept.id = d.department_id
       JOIN booking_forms bf ON bf.id = d.booking_form_id
       JOIN clients c ON c.id = bf.client_id
       WHERE dept.slug = $1
       ORDER BY d.created_at DESC`,
      [req.params.deptSlug]
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

// Default production deliverable types with initial statuses
const DEFAULT_DELIVERABLES = [
  { type: 'sm-posts', title: 'SM Management - Posts', initialStatus: 'request_client_materials' },
  { type: 'sm-videos', title: 'SM Management - Videos', initialStatus: 'request_client_materials' },
  { type: 'sm-google-ads', title: 'SM Management - Google Ads', initialStatus: 'request_client_materials' },
  { type: 'sm-linkedin', title: 'SM Management - LinkedIn', initialStatus: 'request_client_materials' },
  { type: 'sm-twitter', title: 'SM Management - Twitter/X', initialStatus: 'request_client_materials' },
  { type: 'sm-content-calendar', title: 'Content Calendar', initialStatus: 'request_focus_points' },
  { type: 'agri4all-posts', title: 'Agri4All - Posts', initialStatus: 'request_client_materials' },
  { type: 'agri4all-videos', title: 'Agri4All - Videos', initialStatus: 'request_client_materials' },
  { type: 'agri4all-product-uploads', title: 'Agri4All - Product Uploads', initialStatus: 'request_client_materials' },
  { type: 'agri4all-newsletters', title: 'Agri4All - Newsletters', initialStatus: 'request_client_materials' },
  { type: 'agri4all-banners', title: 'Agri4All - Banners', initialStatus: 'design' },
  { type: 'agri4all-linkedin', title: 'Agri4All - LinkedIn', initialStatus: 'request_client_materials' },
  { type: 'online-articles', title: 'Online Articles', initialStatus: 'request_client_materials' },
  { type: 'magazine', title: 'Magazine', initialStatus: 'request_client_materials' },
  { type: 'video', title: 'Video', initialStatus: 'send_request_form' },
  { type: 'website-design', title: 'Website Design', initialStatus: 'request_client_materials' }
];

// Comprehensive status → department slug routing for all types
const DEPT_MAPS = {
  'sm-posts': {
    'request_client_materials': 'production', 'upload_materials': 'production',
    'artwork_design': 'design', 'design_changes': 'design',
    'create_captions': 'editorial', 'editorial_review': 'editorial',
    'ready_for_approval': 'production', 'sent_for_approval': 'production', 'client_changes': 'production',
    'approved': 'social-media', 'ready_for_scheduling': 'social-media', 'scheduled': 'social-media'
  },
  'sm-content-calendar': {
    'request_focus_points': 'production', 'focus_points_requested': 'production', 'focus_points_received': 'production',
    'design': 'design', 'design_review': 'design', 'design_changes': 'design',
    'proofread': 'editorial', 'client_changes': 'production',
    'approved': 'social-media', 'scheduled': 'social-media', 'posted': 'social-media'
  },
  'agri4all-posts': {
    'request_client_materials': 'production', 'waiting_for_materials': 'production', 'materials_received': 'production',
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
    'request_client_materials': 'production', 'waiting_for_materials': 'production', 'materials_received': 'production',
    'editing': 'editorial', 'design': 'design', 'design_review': 'design', 'design_changes': 'design',
    'editorial_review': 'editorial', 'editorial_changes': 'editorial',
    'ready_for_approval': 'production', 'sent_for_approval': 'production', 'client_changes': 'design',
    'approved': 'production'
  },
  'online-articles': {
    'request_client_materials': 'production', 'waiting_for_materials': 'production', 'materials_received': 'production',
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
  'agri4all-newsletters': 'agri4all-posts', 'agri4all-linkedin': 'agri4all-posts'
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

    // Fallback: if no services enabled, create content calendars for all months
    if (toCreate.length === 0) {
      allMonths.forEach(m => {
        toCreate.push({
          type: 'sm-content-calendar', title: 'Content Calendar \u2014 ' + formatMonth(m),
          initialStatus: 'request_focus_points', deliveryMonth: m
        });
      });
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

  const fields = ['title', 'description', 'type', 'status', 'assigned_to', 'due_date', 'department_id', 'booking_form_id', 'follow_up_count',
    'assigned_admin', 'assigned_production', 'assigned_design', 'assigned_editorial',
    'assigned_video', 'assigned_agri4all', 'assigned_social_media', 'delivery_month', 'client_id'];
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

module.exports = router;
