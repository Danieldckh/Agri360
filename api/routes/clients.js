const { Router } = require('express');
const pool = require('../db');
const { requireAuth } = require('../middleware/auth');

const router = Router();

router.use(requireAuth);

function toCamelCase(row) {
  if (!row) return row;
  const result = {};
  for (const [key, value] of Object.entries(row)) {
    const camelKey = key.replace(/_([a-z])/g, (_, c) => c.toUpperCase());
    result[camelKey] = value;
  }
  return result;
}

// GET / - list all clients
router.get('/', async (req, res) => {
  try {
    const { search } = req.query;
    let query = 'SELECT * FROM clients WHERE status != $1';
    const params = ['archived'];

    if (search) {
      query += ' AND name ILIKE $2';
      params.push(`%${search}%`);
    }

    query += ' ORDER BY name';
    const result = await pool.query(query, params);
    res.json(result.rows.map(toCamelCase));
  } catch (err) {
    console.error('List clients error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /:id - single client
router.get('/:id', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM clients WHERE id = $1', [req.params.id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Client not found' });
    }
    res.json(toCamelCase(result.rows[0]));
  } catch (err) {
    console.error('Get client error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST / - create client
router.post('/', async (req, res) => {
  const { name, contact_person, contactPerson, email, phone, address, notes } = req.body;
  const contactPersonVal = contact_person || contactPerson;

  if (!name) {
    return res.status(400).json({ error: 'Name is required' });
  }

  try {
    const result = await pool.query(
      `INSERT INTO clients (name, contact_person, email, phone, address, notes, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [name, contactPersonVal || null, email || null, phone || null, address || null, notes || null, req.user.id]
    );
    res.status(201).json(toCamelCase(result.rows[0]));
  } catch (err) {
    console.error('Create client error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PATCH /:id - update client
router.patch('/:id', async (req, res) => {
  // Accept both snake_case and camelCase keys
  const body = {};
  for (const [key, value] of Object.entries(req.body)) {
    const snakeKey = key.replace(/[A-Z]/g, c => '_' + c.toLowerCase());
    body[snakeKey] = value;
  }
  const fields = ['name', 'contact_person', 'email', 'phone', 'address', 'notes'];
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
      `UPDATE clients SET ${updates.join(', ')} WHERE id = $${idx} RETURNING *`,
      values
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Client not found' });
    }
    res.json(toCamelCase(result.rows[0]));
  } catch (err) {
    console.error('Update client error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// DELETE /:id - soft delete (archive)
router.delete('/:id', async (req, res) => {
  try {
    const result = await pool.query(
      `UPDATE clients SET status = 'archived' WHERE id = $1 RETURNING *`,
      [req.params.id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Client not found' });
    }
    res.json(toCamelCase(result.rows[0]));
  } catch (err) {
    console.error('Delete client error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
