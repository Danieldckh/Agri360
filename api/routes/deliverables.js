const { Router } = require('express');
const pool = require('../db');
const { requireAuth } = require('../middleware/auth');

const router = Router();

router.use(requireAuth);

function toSnakeBody(body) {
  const result = {};
  for (const [key, value] of Object.entries(body)) {
    const snakeKey = key.replace(/[A-Z]/g, c => '_' + c.toLowerCase());
    result[snakeKey] = value;
  }
  return result;
}

function toCamelCase(row) {
  if (!row) return row;
  const result = {};
  for (const [key, value] of Object.entries(row)) {
    const camelKey = key.replace(/_([a-z])/g, (_, c) => c.toUpperCase());
    result[camelKey] = value;
  }
  return result;
}

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

// PATCH /:id - update deliverable
router.patch('/:id', async (req, res) => {
  const body = toSnakeBody(req.body);
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
