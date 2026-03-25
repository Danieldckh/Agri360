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

// GET /by-deliverable/:deliverableId - list dashboards for a deliverable
router.get('/by-deliverable/:deliverableId', async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM dashboards WHERE deliverable_id = $1 ORDER BY created_at DESC',
      [req.params.deliverableId]
    );
    res.json(result.rows.map(toCamelCase));
  } catch (err) {
    console.error('List dashboards error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /:id - single dashboard
router.get('/:id', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM dashboards WHERE id = $1', [req.params.id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Dashboard not found' });
    }
    res.json(toCamelCase(result.rows[0]));
  } catch (err) {
    console.error('Get dashboard error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST / - create dashboard
router.post('/', async (req, res) => {
  const b = toSnakeBody(req.body);
  const { deliverable_id, department_id, deliverable_type, title, config, status } = b;

  if (!deliverable_type || !title) {
    return res.status(400).json({ error: 'deliverable_type and title are required' });
  }

  try {
    const result = await pool.query(
      `INSERT INTO dashboards (deliverable_id, department_id, deliverable_type, title, config, status)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [deliverable_id, department_id, deliverable_type, title, config || null, status || 'active']
    );
    res.status(201).json(toCamelCase(result.rows[0]));
  } catch (err) {
    console.error('Create dashboard error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PATCH /:id - update dashboard
router.patch('/:id', async (req, res) => {
  const body = toSnakeBody(req.body);
  const fields = ['title', 'deliverable_type', 'config', 'status', 'department_id', 'deliverable_id'];
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
      `UPDATE dashboards SET ${updates.join(', ')} WHERE id = $${idx} RETURNING *`,
      values
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Dashboard not found' });
    }
    res.json(toCamelCase(result.rows[0]));
  } catch (err) {
    console.error('Update dashboard error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// DELETE /:id - delete dashboard
router.delete('/:id', async (req, res) => {
  try {
    const result = await pool.query(
      'DELETE FROM dashboards WHERE id = $1 RETURNING *',
      [req.params.id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Dashboard not found' });
    }
    res.json(toCamelCase(result.rows[0]));
  } catch (err) {
    console.error('Delete dashboard error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
