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

// GET /by-client/:clientId - list booking forms for a client
router.get('/by-client/:clientId', async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM booking_forms WHERE client_id = $1 ORDER BY created_at DESC',
      [req.params.clientId]
    );
    res.json(result.rows.map(toCamelCase));
  } catch (err) {
    console.error('List booking forms error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /:id - single booking form with client info
router.get('/:id', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT bf.*, c.name AS client_name, c.contact_person AS client_contact_person
       FROM booking_forms bf
       JOIN clients c ON c.id = bf.client_id
       WHERE bf.id = $1`,
      [req.params.id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Booking form not found' });
    }
    res.json(toCamelCase(result.rows[0]));
  } catch (err) {
    console.error('Get booking form error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST / - create booking form
router.post('/', async (req, res) => {
  const b = toSnakeBody(req.body);
  const { client_id, title, description, status, booked_date, due_date } = b;

  if (!client_id || !title) {
    return res.status(400).json({ error: 'client_id and title are required' });
  }

  try {
    const result = await pool.query(
      `INSERT INTO booking_forms (client_id, title, description, status, booked_date, due_date, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [client_id, title, description || null, status || 'draft', booked_date || null, due_date || null, req.user.id]
    );
    res.status(201).json(toCamelCase(result.rows[0]));
  } catch (err) {
    console.error('Create booking form error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PATCH /:id - update booking form
router.patch('/:id', async (req, res) => {
  const body = toSnakeBody(req.body);
  const fields = ['title', 'description', 'status', 'booked_date', 'due_date'];
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
      `UPDATE booking_forms SET ${updates.join(', ')} WHERE id = $${idx} RETURNING *`,
      values
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Booking form not found' });
    }
    res.json(toCamelCase(result.rows[0]));
  } catch (err) {
    console.error('Update booking form error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// DELETE /:id - delete booking form
router.delete('/:id', async (req, res) => {
  try {
    const result = await pool.query(
      'DELETE FROM booking_forms WHERE id = $1 RETURNING *',
      [req.params.id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Booking form not found' });
    }
    res.json(toCamelCase(result.rows[0]));
  } catch (err) {
    console.error('Delete booking form error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
