const { Router } = require('express');
const pool = require('../db');
const { requireAuth } = require('../middleware/auth');
const { toCamelCase } = require('../utils');

const router = Router();

router.use(requireAuth);

// GET / - list all departments
router.get('/', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM departments ORDER BY id');
    res.json(result.rows.map(toCamelCase));
  } catch (err) {
    console.error('List departments error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /:slug - single department by slug
router.get('/:slug', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM departments WHERE slug = $1', [req.params.slug]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Department not found' });
    }
    res.json(toCamelCase(result.rows[0]));
  } catch (err) {
    console.error('Get department error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
