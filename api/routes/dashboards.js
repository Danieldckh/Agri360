const { Router } = require('express');
const pool = require('../db');
const { requireAuth } = require('../middleware/auth');
const { toCamelCase, toSnakeBody } = require('../utils');

const router = Router();

router.use(requireAuth);

// GET / - list all dashboards
router.get('/', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM dashboards ORDER BY created_at DESC');
    res.json(result.rows.map(toCamelCase));
  } catch (err) {
    console.error('List all dashboards error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /by-type/:type - list dashboards by deliverable type
router.get('/by-type/:type', async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM dashboards WHERE deliverable_type = $1 ORDER BY created_at DESC',
      [req.params.type]
    );
    res.json(result.rows.map(toCamelCase));
  } catch (err) {
    console.error('List dashboards by type error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

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
      `INSERT INTO dashboards (title, deliverable_id, department_id, deliverable_type, config, status)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [title, deliverable_id || null, department_id || null, deliverable_type, config || null, status || 'active']
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
