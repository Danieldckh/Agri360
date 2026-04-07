const { Router } = require('express');
const pool = require('../db');
const { requireAuth } = require('../middleware/auth');
const { toCamelCase, toSnakeBody } = require('../utils');

const router = Router();

router.use(requireAuth);

// ---------------- Scheduled Posts ----------------

// GET /posts - list posts, optional filters: sourceType, status, from, to
router.get('/posts', async (req, res) => {
  try {
    const { sourceType, status, from, to, unscheduled } = req.query;
    const where = [];
    const values = [];
    let i = 1;

    if (sourceType) {
      where.push(`source_type = $${i++}`);
      values.push(sourceType);
    }
    if (status) {
      where.push(`status = $${i++}`);
      values.push(status);
    }
    if (unscheduled === 'true') {
      where.push(`scheduled_at IS NULL`);
    } else {
      if (from) {
        where.push(`scheduled_at >= $${i++}`);
        values.push(from);
      }
      if (to) {
        where.push(`scheduled_at <= $${i++}`);
        values.push(to);
      }
    }

    const sql = `
      SELECT sp.*, c.name AS client_name
      FROM scheduled_posts sp
      LEFT JOIN clients c ON c.id = sp.client_id
      ${where.length ? 'WHERE ' + where.join(' AND ') : ''}
      ORDER BY sp.scheduled_at NULLS FIRST, sp.created_at DESC
    `;
    const result = await pool.query(sql, values);
    res.json(result.rows.map(toCamelCase));
  } catch (err) {
    console.error('List scheduled posts error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /posts/:id
router.get('/posts/:id', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT sp.*, c.name AS client_name
       FROM scheduled_posts sp
       LEFT JOIN clients c ON c.id = sp.client_id
       WHERE sp.id = $1`,
      [req.params.id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Post not found' });
    res.json(toCamelCase(result.rows[0]));
  } catch (err) {
    console.error('Get scheduled post error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /posts - create post
router.post('/posts', async (req, res) => {
  const b = toSnakeBody(req.body);
  const {
    title, content, platforms, scheduled_at, status, source_type,
    source_id, client_id, media_urls, link_url, hashtags, notes
  } = b;

  if (!source_type) {
    return res.status(400).json({ error: 'source_type is required' });
  }

  try {
    const userId = req.user && req.user.id ? req.user.id : null;
    const result = await pool.query(
      `INSERT INTO scheduled_posts
        (title, content, platforms, scheduled_at, status, source_type, source_id, client_id, media_urls, link_url, hashtags, notes, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
       RETURNING *`,
      [
        title || '',
        content || '',
        JSON.stringify(platforms || []),
        scheduled_at || null,
        status || (scheduled_at ? 'scheduled' : 'draft'),
        source_type,
        source_id || null,
        client_id || null,
        JSON.stringify(media_urls || []),
        link_url || null,
        hashtags || null,
        notes || null,
        userId
      ]
    );
    res.status(201).json(toCamelCase(result.rows[0]));
  } catch (err) {
    console.error('Create scheduled post error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PATCH /posts/:id - update post (used for drag-to-reschedule + edits)
router.patch('/posts/:id', async (req, res) => {
  const body = toSnakeBody(req.body);
  const fields = [
    'title', 'content', 'platforms', 'scheduled_at', 'status',
    'source_type', 'source_id', 'client_id', 'media_urls',
    'link_url', 'hashtags', 'notes', 'posted_at', 'post_error'
  ];
  const jsonFields = new Set(['platforms', 'media_urls']);
  const updates = [];
  const values = [];
  let idx = 1;

  for (const f of fields) {
    if (body[f] !== undefined) {
      updates.push(`${f} = $${idx}`);
      values.push(jsonFields.has(f) ? JSON.stringify(body[f]) : body[f]);
      idx++;
    }
  }

  if (updates.length === 0) {
    return res.status(400).json({ error: 'No fields to update' });
  }

  updates.push(`updated_at = NOW()`);
  values.push(req.params.id);

  try {
    const result = await pool.query(
      `UPDATE scheduled_posts SET ${updates.join(', ')} WHERE id = $${idx} RETURNING *`,
      values
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Post not found' });
    res.json(toCamelCase(result.rows[0]));
  } catch (err) {
    console.error('Update scheduled post error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// DELETE /posts/:id
router.delete('/posts/:id', async (req, res) => {
  try {
    const result = await pool.query(
      'DELETE FROM scheduled_posts WHERE id = $1 RETURNING *',
      [req.params.id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Post not found' });
    res.json(toCamelCase(result.rows[0]));
  } catch (err) {
    console.error('Delete scheduled post error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ---------------- Social Credentials ----------------

// Helper: strip sensitive fields from credentials payload
function sanitizeCred(row) {
  if (!row) return row;
  const camel = toCamelCase(row);
  if (camel.credentials && typeof camel.credentials === 'object') {
    const masked = {};
    for (const key of Object.keys(camel.credentials)) {
      const val = camel.credentials[key];
      if (typeof val === 'string' && val.length > 4) {
        masked[key] = '••••' + val.slice(-4);
      } else {
        masked[key] = val ? '••••' : '';
      }
    }
    camel.credentials = masked;
  }
  return camel;
}

// GET /credentials - list all credentials (masked)
router.get('/credentials', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM social_credentials ORDER BY platform, account_name');
    res.json(result.rows.map(sanitizeCred));
  } catch (err) {
    console.error('List credentials error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /credentials - create credential
router.post('/credentials', async (req, res) => {
  const b = toSnakeBody(req.body);
  const { platform, account_name, account_handle, credentials, is_active } = b;

  if (!platform || !account_name) {
    return res.status(400).json({ error: 'platform and account_name are required' });
  }

  try {
    const userId = req.user && req.user.id ? req.user.id : null;
    const result = await pool.query(
      `INSERT INTO social_credentials
        (platform, account_name, account_handle, credentials, is_active, created_by)
       VALUES ($1,$2,$3,$4,$5,$6)
       RETURNING *`,
      [
        platform,
        account_name,
        account_handle || null,
        JSON.stringify(credentials || {}),
        is_active !== false,
        userId
      ]
    );
    res.status(201).json(sanitizeCred(result.rows[0]));
  } catch (err) {
    console.error('Create credential error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PATCH /credentials/:id
router.patch('/credentials/:id', async (req, res) => {
  const b = toSnakeBody(req.body);
  const fields = ['platform', 'account_name', 'account_handle', 'credentials', 'is_active', 'last_verified_at'];
  const jsonFields = new Set(['credentials']);
  const updates = [];
  const values = [];
  let idx = 1;

  for (const f of fields) {
    if (b[f] !== undefined) {
      updates.push(`${f} = $${idx}`);
      values.push(jsonFields.has(f) ? JSON.stringify(b[f]) : b[f]);
      idx++;
    }
  }

  if (updates.length === 0) {
    return res.status(400).json({ error: 'No fields to update' });
  }

  updates.push(`updated_at = NOW()`);
  values.push(req.params.id);

  try {
    const result = await pool.query(
      `UPDATE social_credentials SET ${updates.join(', ')} WHERE id = $${idx} RETURNING *`,
      values
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Credential not found' });
    res.json(sanitizeCred(result.rows[0]));
  } catch (err) {
    console.error('Update credential error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// DELETE /credentials/:id
router.delete('/credentials/:id', async (req, res) => {
  try {
    const result = await pool.query(
      'DELETE FROM social_credentials WHERE id = $1 RETURNING *',
      [req.params.id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Credential not found' });
    res.json(sanitizeCred(result.rows[0]));
  } catch (err) {
    console.error('Delete credential error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /credentials/:id/verify - mark credential as verified (stub - real verification would ping each platform)
router.post('/credentials/:id/verify', async (req, res) => {
  try {
    const result = await pool.query(
      `UPDATE social_credentials SET last_verified_at = NOW(), updated_at = NOW() WHERE id = $1 RETURNING *`,
      [req.params.id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Credential not found' });
    res.json(sanitizeCred(result.rows[0]));
  } catch (err) {
    console.error('Verify credential error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
