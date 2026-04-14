const { Router } = require('express');
const pool = require('../db');
const { requireAuth } = require('../middleware/auth');
const { toCamelCase, toSnakeBody } = require('../utils');

const router = Router();

router.use(requireAuth);

// GET / - list all tickets
router.get('/', async (req, res) => {
  try {
    const { status } = req.query;
    var nameExpr = "COALESCE(e1.first_name || ' ' || e1.last_name, e1.first_name) as submitted_by_name, COALESCE(e2.first_name || ' ' || e2.last_name, e2.first_name) as assigned_to_name";
    let query = 'SELECT t.*, ' + nameExpr + ' FROM dev_tickets t LEFT JOIN employees e1 ON t.submitted_by = e1.id LEFT JOIN employees e2 ON t.assigned_to = e2.id';
    const params = [];

    if (status && status !== 'all') {
      query += ' WHERE t.status = $1';
      params.push(status);
    }

    query += ' ORDER BY t.rank_order ASC, t.created_at DESC';
    const result = await pool.query(query, params);
    res.json(result.rows.map(toCamelCase));
  } catch (err) {
    console.error('List dev tickets error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /:id - single ticket
router.get('/:id', async (req, res) => {
  try {
    var nameExpr2 = "COALESCE(e1.first_name || ' ' || e1.last_name, e1.first_name) as submitted_by_name, COALESCE(e2.first_name || ' ' || e2.last_name, e2.first_name) as assigned_to_name";
    const result = await pool.query(
      'SELECT t.*, ' + nameExpr2 + ' FROM dev_tickets t LEFT JOIN employees e1 ON t.submitted_by = e1.id LEFT JOIN employees e2 ON t.assigned_to = e2.id WHERE t.id = $1',
      [req.params.id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Ticket not found' });
    }
    res.json(toCamelCase(result.rows[0]));
  } catch (err) {
    console.error('Get dev ticket error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST / - create ticket
router.post('/', async (req, res) => {
  const body = toSnakeBody(req.body);
  const { title, description, priority, due_date } = body;

  if (!title) {
    return res.status(400).json({ error: 'Title is required' });
  }

  try {
    // Get next rank_order
    const maxRank = await pool.query('SELECT COALESCE(MAX(rank_order), 0) + 1 as next_rank FROM dev_tickets');
    const nextRank = maxRank.rows[0].next_rank;

    const result = await pool.query(
      `INSERT INTO dev_tickets (title, description, submitted_by, priority, rank_order, due_date)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [title, description || null, req.user?.id || null, priority || 'medium', nextRank, due_date || null]
    );
    res.status(201).json(toCamelCase(result.rows[0]));
  } catch (err) {
    console.error('Create dev ticket error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PATCH /reorder - bulk update rank_order
router.patch('/reorder', async (req, res) => {
  const { order } = req.body; // [{ id, rankOrder }]
  if (!Array.isArray(order)) {
    return res.status(400).json({ error: 'order array is required' });
  }

  try {
    for (const item of order) {
      await pool.query('UPDATE dev_tickets SET rank_order = $1, updated_at = NOW() WHERE id = $2', [item.rankOrder, item.id]);
    }
    res.json({ success: true });
  } catch (err) {
    console.error('Reorder dev tickets error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PATCH /:id - update ticket
router.patch('/:id', async (req, res) => {
  const body = toSnakeBody(req.body);
  const allowed = ['title', 'description', 'status', 'priority', 'rank_order', 'due_date'];
  const sets = [];
  const values = [];
  let idx = 1;

  for (const field of allowed) {
    if (body[field] !== undefined) {
      sets.push(`${field} = $${idx}`);
      values.push(body[field]);
      idx++;
    }
  }

  if (sets.length === 0) {
    return res.status(400).json({ error: 'No valid fields to update' });
  }

  sets.push(`updated_at = NOW()`);
  values.push(req.params.id);

  try {
    const result = await pool.query(
      `UPDATE dev_tickets SET ${sets.join(', ')} WHERE id = $${idx} RETURNING *`,
      values
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Ticket not found' });
    }
    res.json(toCamelCase(result.rows[0]));
  } catch (err) {
    console.error('Update dev ticket error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// DELETE /:id
router.delete('/:id', async (req, res) => {
  try {
    const result = await pool.query('DELETE FROM dev_tickets WHERE id = $1 RETURNING id', [req.params.id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Ticket not found' });
    }
    res.json({ success: true });
  } catch (err) {
    console.error('Delete dev ticket error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
