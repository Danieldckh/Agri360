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

// Default production deliverable types
const DEFAULT_DELIVERABLES = [
  { type: 'sm-posts', title: 'SM Management - Posts' },
  { type: 'sm-videos', title: 'SM Management - Videos' },
  { type: 'sm-google-ads', title: 'SM Management - Google Ads' },
  { type: 'sm-linkedin', title: 'SM Management - LinkedIn' },
  { type: 'sm-twitter', title: 'SM Management - Twitter/X' },
  { type: 'sm-content-calendar', title: 'SM Management - Content Calendar' },
  { type: 'agri4all-posts', title: 'Agri4All - Posts' },
  { type: 'agri4all-videos', title: 'Agri4All - Videos' },
  { type: 'agri4all-product-uploads', title: 'Agri4All - Product Uploads' },
  { type: 'agri4all-newsletters', title: 'Agri4All - Newsletters' },
  { type: 'agri4all-banners', title: 'Agri4All - Banners' },
  { type: 'agri4all-linkedin', title: 'Agri4All - LinkedIn' },
  { type: 'online-articles', title: 'Online Articles' },
  { type: 'magazine', title: 'Magazine' },
  { type: 'video', title: 'Video' },
  { type: 'website-design', title: 'Website Design', initialStatus: 'request_client_materials' }
];

// Website design workflow: status → department slug mapping
const WEB_DESIGN_DEPT_MAP = {
  'request_client_materials': 'production',
  'sitemap': 'design',
  'wireframe': 'design',
  'prototype': 'design',
  'design_changes': 'design',
  'approved': 'design',
  'ready_for_approval': 'production',
  'sent_for_approval': 'production',
  'development': 'production',
  'site_developed': 'production',
  'hosting_seo': 'production',
  'complete': 'production'
};

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

    // Look up production department ID
    const deptResult = await pool.query("SELECT id FROM departments WHERE slug = 'production'");
    if (deptResult.rows.length === 0) {
      return res.status(500).json({ error: 'Production department not found' });
    }
    const departmentId = deptResult.rows[0].id;

    // Insert all 16 deliverables in a transaction
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const created = [];
      for (const d of DEFAULT_DELIVERABLES) {
        const status = d.initialStatus || 'pending';
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

  // Auto-route website-design deliverables to correct department on status change
  if (body.status && WEB_DESIGN_DEPT_MAP[body.status]) {
    const existing = await pool.query('SELECT type FROM deliverables WHERE id = $1', [req.params.id]);
    if (existing.rows.length > 0 && existing.rows[0].type === 'website-design') {
      const targetSlug = WEB_DESIGN_DEPT_MAP[body.status];
      const deptResult = await pool.query('SELECT id FROM departments WHERE slug = $1', [targetSlug]);
      if (deptResult.rows.length > 0) {
        body.department_id = deptResult.rows[0].id;
      }
    }
  }

  const fields = ['title', 'description', 'type', 'status', 'assigned_to', 'due_date', 'department_id', 'booking_form_id'];
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
