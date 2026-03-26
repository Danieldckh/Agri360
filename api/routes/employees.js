const { Router } = require('express');
const multer = require('multer');
const path = require('path');
const pool = require('../db');
const { requireAuth, requireAdmin } = require('../middleware/auth');
const { UPLOAD_DIR } = require('../config');

const router = Router();

const SAFE_COLUMNS = 'id, first_name, last_name, username, role, status, photo_url, created_at';

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, UPLOAD_DIR),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `${req.params.id}-${Date.now()}${ext}`);
  },
});
const upload = multer({ storage });

router.use(requireAuth);

// GET /me - current user
router.get('/me', (req, res) => {
  res.json(req.user);
});

// GET / - list employees
router.get('/', async (req, res) => {
  try {
    let query;
    if (req.user.role === 'admin') {
      query = `SELECT ${SAFE_COLUMNS} FROM employees ORDER BY created_at DESC`;
    } else {
      query = `SELECT ${SAFE_COLUMNS} FROM employees WHERE status = 'approved' ORDER BY created_at DESC`;
    }
    const result = await pool.query(query);
    res.json(result.rows);
  } catch (err) {
    console.error('List employees error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /pending - admin only
router.get('/pending', requireAdmin, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT ${SAFE_COLUMNS} FROM employees WHERE status = 'pending' ORDER BY created_at DESC`
    );
    res.json(result.rows);
  } catch (err) {
    console.error('List pending error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /:id - single employee
router.get('/:id', async (req, res) => {
  try {
    const result = await pool.query(`SELECT ${SAFE_COLUMNS} FROM employees WHERE id = $1`, [req.params.id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Employee not found' });
    }
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Get employee error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PATCH /:id/status - admin only
router.patch('/:id/status', requireAdmin, async (req, res) => {
  const { status } = req.body;
  if (!status || !['approved', 'declined'].includes(status)) {
    return res.status(400).json({ error: 'Status must be approved or declined' });
  }

  try {
    const result = await pool.query(
      `UPDATE employees SET status = $1 WHERE id = $2 RETURNING ${SAFE_COLUMNS}`,
      [status, req.params.id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Employee not found' });
    }
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Update status error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PATCH /:id/role - admin only
router.patch('/:id/role', requireAdmin, async (req, res) => {
  const { role } = req.body;
  if (!role || !['admin', 'employee'].includes(role)) {
    return res.status(400).json({ error: 'Role must be admin or employee' });
  }

  try {
    const result = await pool.query(
      `UPDATE employees SET role = $1 WHERE id = $2 RETURNING ${SAFE_COLUMNS}`,
      [role, req.params.id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Employee not found' });
    }
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Update role error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /:id/photo - upload photo
router.post('/:id/photo', upload.single('photo'), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No photo uploaded' });
  }

  const photoUrl = `/uploads/photos/${req.file.filename}`;

  try {
    const result = await pool.query(
      `UPDATE employees SET photo_url = $1 WHERE id = $2 RETURNING ${SAFE_COLUMNS}`,
      [photoUrl, req.params.id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Employee not found' });
    }
    res.json({ photoUrl, employee: result.rows[0] });
  } catch (err) {
    console.error('Upload photo error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
