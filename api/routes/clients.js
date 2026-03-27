const { Router } = require('express');
const pool = require('../db');
const { requireAuth } = require('../middleware/auth');
const { toCamelCase, toSnakeBody } = require('../utils');

const router = Router();

router.use(requireAuth);

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
  const body = toSnakeBody(req.body);

  const { name } = body;

  if (!name) {
    return res.status(400).json({ error: 'Name is required' });
  }

  // JSONB contact fields - stringify if they are objects
  const jsonbFields = ['primary_contact', 'material_contact', 'accounts_contact'];
  for (const field of jsonbFields) {
    if (body[field] !== undefined && typeof body[field] === 'object' && body[field] !== null) {
      body[field] = JSON.stringify(body[field]);
    }
  }

  const columns = [
    'name', 'contact_person', 'email', 'phone', 'address', 'notes',
    'trading_name', 'company_reg_no', 'vat_number', 'website',
    'industry_expertise', 'physical_address', 'physical_postal_code',
    'postal_address', 'postal_code',
    'primary_contact', 'material_contact', 'accounts_contact'
  ];

  const insertCols = ['created_by'];
  const insertVals = [req.user.id];
  let idx = 2;

  for (const col of columns) {
    if (body[col] !== undefined) {
      insertCols.push(col);
      insertVals.push(body[col]);
      idx++;
    }
  }

  const placeholders = insertVals.map((_, i) => `$${i + 1}`).join(', ');

  try {
    const result = await pool.query(
      `INSERT INTO clients (${insertCols.join(', ')})
       VALUES (${placeholders})
       RETURNING *`,
      insertVals
    );
    res.status(201).json(toCamelCase(result.rows[0]));
  } catch (err) {
    console.error('Create client error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PATCH /:id - update client
router.patch('/:id', async (req, res) => {
  const body = toSnakeBody(req.body);
  const fields = [
    'name', 'contact_person', 'email', 'phone', 'address', 'notes',
    'trading_name', 'company_reg_no', 'vat_number', 'website',
    'industry_expertise', 'physical_address', 'physical_postal_code',
    'postal_address', 'postal_code',
    'primary_contact', 'material_contact', 'accounts_contact'
  ];
  const jsonbFields = ['primary_contact', 'material_contact', 'accounts_contact'];
  const updates = [];
  const values = [];
  let idx = 1;

  for (const field of fields) {
    if (body[field] !== undefined) {
      let val = body[field];
      if (jsonbFields.includes(field) && typeof val === 'object' && val !== null) {
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
