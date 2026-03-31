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

// GET /available-months/:deptSlug - distinct campaign months for a department's deliverables
router.get('/available-months/:deptSlug', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT DISTINCT bf.campaign_month_start
       FROM deliverables d
       JOIN departments dept ON dept.id = d.department_id
       JOIN booking_forms bf ON bf.id = d.booking_form_id
       WHERE dept.slug = $1 AND bf.campaign_month_start IS NOT NULL
       ORDER BY bf.campaign_month_start DESC`,
      [req.params.deptSlug]
    );
    res.json(result.rows.map(r => r.campaign_month_start));
  } catch (err) {
    console.error('List available months error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /by-department/:deptSlug - list deliverables for a department slug
// Optional query param: ?month=YYYY-MM to filter by campaign month
router.get('/by-department/:deptSlug', async (req, res) => {
  try {
    const { month } = req.query;
    let query = `SELECT d.*, dept.name AS department_name, dept.slug AS department_slug,
              bf.title AS booking_form_title, c.name AS client_name, c.id AS client_id
       FROM deliverables d
       JOIN departments dept ON dept.id = d.department_id
       JOIN booking_forms bf ON bf.id = d.booking_form_id
       JOIN clients c ON c.id = bf.client_id
       WHERE dept.slug = $1`;
    const params = [req.params.deptSlug];

    if (month) {
      query += ` AND bf.campaign_month_start = $2`;
      params.push(month);
    }

    query += ` ORDER BY d.created_at DESC`;

    const result = await pool.query(query, params);
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
  { type: 'sm-content-calendar', title: 'SM Management - Content Calendar', initialStatus: 'request_client_materials' },
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
    'request_client_materials': 'production', 'upload_materials': 'production',
    'artwork_design': 'design', 'design_changes': 'design',
    'create_captions': 'editorial', 'editorial_review': 'editorial',
    'ready_for_approval': 'production', 'sent_for_approval': 'production', 'client_changes': 'production',
    'approved': 'social-media', 'ready_for_scheduling': 'social-media', 'scheduled': 'social-media'
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

// POST /bulk - create all production deliverables for a booking form
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

    // Look up all department IDs
    const deptResult = await pool.query("SELECT id, slug FROM departments");
    const deptBySlug = {};
    deptResult.rows.forEach(r => { deptBySlug[r.slug] = r.id; });
    const defaultDeptId = deptBySlug['production'];
    if (!defaultDeptId) {
      return res.status(500).json({ error: 'Production department not found' });
    }

    // Insert all 16 deliverables in a transaction, routing to correct department
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const created = [];
      for (const d of DEFAULT_DELIVERABLES) {
        const status = d.initialStatus || 'pending';
        const deptMap = getDeptMapForType(d.type);
        const targetSlug = deptMap && deptMap[status] ? deptMap[status] : 'production';
        const departmentId = deptBySlug[targetSlug] || defaultDeptId;
        const result = await client.query(
          `INSERT INTO deliverables (booking_form_id, department_id, type, title, status)
           VALUES ($1, $2, $3, $4, $5)
           RETURNING *`,
          [booking_form_id, departmentId, d.type, d.title, status]
        );
        created.push(result.rows[0]);
      }
      await client.query('COMMIT');
      res.status(201).json(created.map(toCamelCase));
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
    'assigned_video', 'assigned_agri4all', 'assigned_social_media'];
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
