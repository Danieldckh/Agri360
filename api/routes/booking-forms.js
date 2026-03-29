const { Router } = require('express');
const pool = require('../db');
const { requireAuth } = require('../middleware/auth');
const { toCamelCase, toSnakeBody } = require('../utils');

const router = Router();

router.use(requireAuth);

// GET / - list all booking forms with client info
router.get('/', async (req, res) => {
  try {
    let query = `SELECT bf.*, c.name AS client_name
       FROM booking_forms bf
       LEFT JOIN clients c ON c.id = bf.client_id`;
    const params = [];
    if (req.query.department) {
      query += ' WHERE bf.department = $1';
      params.push(req.query.department);
    }
    query += ' ORDER BY bf.created_at DESC';
    const result = await pool.query(query, params);
    res.json(result.rows.map(toCamelCase));
  } catch (err) {
    console.error('List all booking forms error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

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

// POST / - create or update booking form (upsert by checklist_id)
router.post('/', async (req, res) => {
  const b = toSnakeBody(req.body);
  const { client_id, campaign_month_start, campaign_month_end, form_data, sign_off_date, representative, description, status, booked_date, due_date, checklist_id } = b;
  let { title } = b;

  if (!client_id) {
    return res.status(400).json({ error: 'client_id is required' });
  }

  // Auto-generate title from date range if not provided
  if (!title && campaign_month_start && campaign_month_end) {
    const start = campaign_month_start.substring(0, 7);
    const end = campaign_month_end.substring(0, 7);
    title = `Booking ${start} - ${end}`;
  }

  const formDataVal = (form_data !== undefined && typeof form_data === 'object' && form_data !== null)
    ? JSON.stringify(form_data)
    : (form_data || null);

  try {
    // If checklist_id provided, try to update existing
    if (checklist_id) {
      const existing = await pool.query('SELECT id FROM booking_forms WHERE checklist_id = $1', [checklist_id]);
      if (existing.rows.length > 0) {
        const result = await pool.query(
          `UPDATE booking_forms SET client_id = $1, title = $2, description = $3, status = $4,
           booked_date = $5, due_date = $6, campaign_month_start = $7, campaign_month_end = $8,
           form_data = $9, sign_off_date = $10, representative = $11, updated_at = NOW()
           WHERE checklist_id = $12 RETURNING *`,
          [
            client_id, title || null, description || null, status || 'draft',
            booked_date || null, due_date || null,
            campaign_month_start || null, campaign_month_end || null,
            formDataVal, sign_off_date || null, representative || null,
            checklist_id
          ]
        );
        return res.json(toCamelCase(result.rows[0]));
      }
    }

    // Create new
    const result = await pool.query(
      `INSERT INTO booking_forms (client_id, title, description, status, booked_date, due_date, campaign_month_start, campaign_month_end, form_data, sign_off_date, representative, checklist_id, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
       RETURNING *`,
      [
        client_id, title || null, description || null, status || 'draft',
        booked_date || null, due_date || null,
        campaign_month_start || null, campaign_month_end || null,
        formDataVal, sign_off_date || null, representative || null,
        checklist_id || null, req.user.id
      ]
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
  const fields = ['title', 'description', 'status', 'department', 'booked_date', 'due_date', 'campaign_month_start', 'campaign_month_end', 'form_data', 'sign_off_date', 'representative'];
  const updates = [];
  const values = [];
  let idx = 1;

  for (const field of fields) {
    if (body[field] !== undefined) {
      let val = body[field];
      if (field === 'form_data' && typeof val === 'object' && val !== null) {
        val = JSON.stringify(val);
      }
      updates.push(`${field} = $${idx}`);
      values.push(val);
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
