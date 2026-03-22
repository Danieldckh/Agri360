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

// GET /by-client/:clientId - list financials for a client
router.get('/by-client/:clientId', async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM financials WHERE client_id = $1 ORDER BY created_at DESC',
      [req.params.clientId]
    );
    res.json(result.rows.map(toCamelCase));
  } catch (err) {
    console.error('List financials error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /:id - single financial record
router.get('/:id', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM financials WHERE id = $1', [req.params.id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Financial record not found' });
    }
    res.json(toCamelCase(result.rows[0]));
  } catch (err) {
    console.error('Get financial error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST / - create financial record
router.post('/', async (req, res) => {
  const b = toSnakeBody(req.body);
  const { client_id, type, amount, description, currency, invoice_number, invoice_date, due_date, status } = b;

  if (!client_id || !type || amount === undefined) {
    return res.status(400).json({ error: 'client_id, type, and amount are required' });
  }

  try {
    const result = await pool.query(
      `INSERT INTO financials (client_id, type, amount, description, currency, invoice_number, invoice_date, due_date, status, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       RETURNING *`,
      [client_id, type, amount, description || null, currency || 'ZAR', invoice_number || null, invoice_date || null, due_date || null, status || 'draft', req.user.id]
    );
    res.status(201).json(toCamelCase(result.rows[0]));
  } catch (err) {
    console.error('Create financial error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PATCH /:id - update financial record
router.patch('/:id', async (req, res) => {
  const body = toSnakeBody(req.body);
  const fields = ['type', 'amount', 'description', 'currency', 'invoice_number', 'invoice_date', 'due_date', 'status'];
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
      `UPDATE financials SET ${updates.join(', ')} WHERE id = $${idx} RETURNING *`,
      values
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Financial record not found' });
    }
    res.json(toCamelCase(result.rows[0]));
  } catch (err) {
    console.error('Update financial error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// DELETE /:id - delete financial record
router.delete('/:id', async (req, res) => {
  try {
    const result = await pool.query(
      'DELETE FROM financials WHERE id = $1 RETURNING *',
      [req.params.id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Financial record not found' });
    }
    res.json(toCamelCase(result.rows[0]));
  } catch (err) {
    console.error('Delete financial error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
