const { Router } = require('express');
const pool = require('../db');
const { requireAuth } = require('../middleware/auth');
const { toCamelCase, toSnakeBody } = require('../utils');

const router = Router();

router.use(requireAuth);

// GET /api/client-assets?clientId=X&kind=Y - list assets for a client (optional kind filter)
router.get('/', async (req, res) => {
  try {
    const { clientId, kind } = req.query;
    if (!clientId) {
      return res.status(400).json({ error: 'clientId is required' });
    }

    const params = [clientId];
    let query = 'SELECT * FROM client_assets WHERE client_id = $1';
    if (kind) {
      params.push(kind);
      query += ` AND kind = $${params.length}`;
    }
    query += ' ORDER BY uploaded_at DESC';

    const result = await pool.query(query, params);
    res.json(result.rows.map(toCamelCase));
  } catch (err) {
    console.error('List client assets error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/client-assets - create asset row
router.post('/', async (req, res) => {
  const body = toSnakeBody(req.body);
  const { client_id, deliverable_id, kind, url, thumbnail_url, mime_type, uploaded_by } = body;

  if (!client_id) return res.status(400).json({ error: 'clientId is required' });
  if (!kind) return res.status(400).json({ error: 'kind is required' });
  if (!url) return res.status(400).json({ error: 'url is required' });

  try {
    const result = await pool.query(
      `INSERT INTO client_assets
         (client_id, deliverable_id, kind, url, thumbnail_url, mime_type, uploaded_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [
        client_id,
        deliverable_id || null,
        kind,
        url,
        thumbnail_url || null,
        mime_type || null,
        uploaded_by != null ? uploaded_by : (req.user && req.user.id) || null,
      ]
    );
    res.status(201).json(toCamelCase(result.rows[0]));
  } catch (err) {
    console.error('Create client asset error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// DELETE /api/client-assets/:id - hard delete
router.delete('/:id', async (req, res) => {
  try {
    const result = await pool.query(
      'DELETE FROM client_assets WHERE id = $1 RETURNING *',
      [req.params.id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Asset not found' });
    }
    res.json(toCamelCase(result.rows[0]));
  } catch (err) {
    console.error('Delete client asset error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
