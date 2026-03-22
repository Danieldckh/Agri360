const { Router } = require('express');
const pool = require('../db');
const router = Router();

router.get('/tables', async (req, res) => {
  try {
    const result = await pool.query(
      "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' ORDER BY table_name"
    );
    res.json(result.rows.map(r => r.table_name));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/tables/:name/columns', async (req, res) => {
  try {
    const tablesResult = await pool.query(
      "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'"
    );
    const valid = tablesResult.rows.map(r => r.table_name);
    if (!valid.includes(req.params.name)) {
      return res.status(404).json({ error: 'Table not found' });
    }
    const result = await pool.query(
      "SELECT column_name, data_type, is_nullable, column_default FROM information_schema.columns WHERE table_name = $1 ORDER BY ordinal_position",
      [req.params.name]
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/tables/:name/rows', async (req, res) => {
  try {
    const tablesResult = await pool.query(
      "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'"
    );
    const valid = tablesResult.rows.map(r => r.table_name);
    if (!valid.includes(req.params.name)) {
      return res.status(404).json({ error: 'Table not found' });
    }
    const limit = Math.min(parseInt(req.query.limit) || 50, 200);
    const offset = parseInt(req.query.offset) || 0;
    const countResult = await pool.query('SELECT COUNT(*) FROM "' + req.params.name + '"');
    const result = await pool.query('SELECT * FROM "' + req.params.name + '" LIMIT $1 OFFSET $2', [limit, offset]);
    res.json({
      rows: result.rows,
      total: parseInt(countResult.rows[0].count),
      limit: limit,
      offset: offset
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
