const { Router } = require('express');
const crypto = require('crypto');
const pool = require('../db');
const { requireAuth } = require('../middleware/auth');
const { toCamelCase, toSnakeBody } = require('../utils');

const router = Router();

function generateToken() {
  return crypto.randomBytes(24).toString('hex');
}

// ─── Authenticated endpoints (CRM side) ──────────────────

// POST /get-or-create-token — returns existing or creates new token for a client
router.post('/get-or-create-token', requireAuth, async (req, res) => {
  const { client_id } = toSnakeBody(req.body);
  if (!client_id) return res.status(400).json({ error: 'client_id required' });

  try {
    const existing = await pool.query(
      'SELECT * FROM client_portal_tokens WHERE client_id = $1 LIMIT 1',
      [client_id]
    );
    if (existing.rows.length > 0) {
      return res.json(toCamelCase(existing.rows[0]));
    }
    const token = generateToken();
    const result = await pool.query(
      `INSERT INTO client_portal_tokens (client_id, token) VALUES ($1, $2) RETURNING *`,
      [client_id, token]
    );
    res.status(201).json(toCamelCase(result.rows[0]));
  } catch (err) {
    console.error('Portal token error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ─── Public endpoints (no auth, token-based) ─────────────

async function fetchClientByToken(token) {
  const result = await pool.query(
    `SELECT c.*, cpt.token FROM client_portal_tokens cpt
     JOIN clients c ON c.id = cpt.client_id
     WHERE cpt.token = $1`,
    [token]
  );
  return result.rows.length > 0 ? toCamelCase(result.rows[0]) : null;
}

// GET /:token/client — fetch client info by portal token
router.get('/:token/client', async (req, res) => {
  try {
    const client = await fetchClientByToken(req.params.token);
    if (!client) return res.status(404).json({ error: 'Invalid token' });
    // Update last accessed
    await pool.query('UPDATE client_portal_tokens SET last_accessed_at = NOW() WHERE token = $1', [req.params.token]);
    res.json(client);
  } catch (err) {
    console.error('Portal client fetch error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /:token/dashboard — summary data for portal dashboard
router.get('/:token/dashboard', async (req, res) => {
  try {
    const client = await fetchClientByToken(req.params.token);
    if (!client) return res.status(404).json({ error: 'Invalid token' });

    // Pending forms
    const formsResult = await pool.query(
      `SELECT * FROM request_forms WHERE client_id = $1 AND status != 'completed' ORDER BY created_at DESC`,
      [client.id]
    );
    const pendingForms = formsResult.rows.map(toCamelCase);

    // Deliverables awaiting approval
    const approvalsResult = await pool.query(
      `SELECT d.*, c.name AS client_name FROM deliverables d
       LEFT JOIN booking_forms bf ON bf.id = d.booking_form_id
       LEFT JOIN clients c ON c.id = bf.client_id
       WHERE c.id = $1 AND d.status = 'sent_for_approval'
       ORDER BY d.created_at DESC`,
      [client.id]
    );
    const pendingApprovals = approvalsResult.rows.map(toCamelCase);

    res.json({
      client,
      pendingForms,
      pendingApprovals,
      pendingFormCount: pendingForms.length,
      pendingApprovalCount: pendingApprovals.length
    });
  } catch (err) {
    console.error('Portal dashboard error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /:token/forms — list all forms for this client
router.get('/:token/forms', async (req, res) => {
  try {
    const client = await fetchClientByToken(req.params.token);
    if (!client) return res.status(404).json({ error: 'Invalid token' });
    const result = await pool.query(
      `SELECT * FROM request_forms WHERE client_id = $1 ORDER BY created_at DESC`,
      [client.id]
    );
    res.json(result.rows.map(toCamelCase));
  } catch (err) {
    console.error('Portal forms error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /:token/forms/:formToken — fetch a specific form by its token
router.get('/:token/forms/:formToken', async (req, res) => {
  try {
    const client = await fetchClientByToken(req.params.token);
    if (!client) return res.status(404).json({ error: 'Invalid token' });
    const result = await pool.query(
      `SELECT * FROM request_forms WHERE token = $1 AND client_id = $2`,
      [req.params.formToken, client.id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Form not found' });
    res.json(toCamelCase(result.rows[0]));
  } catch (err) {
    console.error('Portal form fetch error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /:token/forms/:formToken/submit — client submits form responses
router.post('/:token/forms/:formToken/submit', async (req, res) => {
  try {
    const client = await fetchClientByToken(req.params.token);
    if (!client) return res.status(404).json({ error: 'Invalid token' });
    const { responses } = req.body;
    const result = await pool.query(
      `UPDATE request_forms SET responses = $1, status = 'completed', completed_at = NOW()
       WHERE token = $2 AND client_id = $3 RETURNING *`,
      [JSON.stringify(responses || {}), req.params.formToken, client.id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Form not found' });
    res.json(toCamelCase(result.rows[0]));
  } catch (err) {
    console.error('Portal form submit error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /:token/approvals — list deliverables ready for client approval
router.get('/:token/approvals', async (req, res) => {
  try {
    const client = await fetchClientByToken(req.params.token);
    if (!client) return res.status(404).json({ error: 'Invalid token' });
    const result = await pool.query(
      `SELECT d.* FROM deliverables d
       LEFT JOIN booking_forms bf ON bf.id = d.booking_form_id
       LEFT JOIN clients c ON c.id = bf.client_id
       WHERE c.id = $1 AND d.status = 'sent_for_approval'
       ORDER BY d.delivery_month, d.created_at`,
      [client.id]
    );
    res.json(result.rows.map(toCamelCase));
  } catch (err) {
    console.error('Portal approvals error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /:token/approvals/:deliverableId/approve — client approves a deliverable
router.post('/:token/approvals/:deliverableId/approve', async (req, res) => {
  try {
    const client = await fetchClientByToken(req.params.token);
    if (!client) return res.status(404).json({ error: 'Invalid token' });
    const result = await pool.query(
      `UPDATE deliverables SET status = 'approved', updated_at = NOW()
       WHERE id = $1 RETURNING *`,
      [req.params.deliverableId]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Deliverable not found' });
    res.json(toCamelCase(result.rows[0]));
  } catch (err) {
    console.error('Portal approve error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /:token/approvals/:deliverableId/request-changes — client submits changes (max 3)
router.post('/:token/approvals/:deliverableId/request-changes', async (req, res) => {
  try {
    const client = await fetchClientByToken(req.params.token);
    if (!client) return res.status(404).json({ error: 'Invalid token' });
    const { change_notes, post_updates } = toSnakeBody(req.body);

    // Check count
    const existing = await pool.query('SELECT change_request_count, metadata FROM deliverables WHERE id = $1', [req.params.deliverableId]);
    if (existing.rows.length === 0) return res.status(404).json({ error: 'Deliverable not found' });
    const currentCount = existing.rows[0].change_request_count || 0;
    if (currentCount >= 3) {
      return res.status(400).json({ error: 'Maximum change requests (3) reached for this deliverable' });
    }

    // Merge change_notes into metadata.client_change_requests array
    let metadata = existing.rows[0].metadata || {};
    if (typeof metadata === 'string') try { metadata = JSON.parse(metadata); } catch (e) { metadata = {}; }
    if (!metadata.client_change_requests) metadata.client_change_requests = [];
    metadata.client_change_requests.push({
      submitted_at: new Date().toISOString(),
      notes: change_notes || '',
      post_updates: post_updates || null
    });

    const result = await pool.query(
      `UPDATE deliverables SET status = 'client_changes', change_request_count = change_request_count + 1,
       metadata = $1, updated_at = NOW() WHERE id = $2 RETURNING *`,
      [JSON.stringify(metadata), req.params.deliverableId]
    );
    res.json(toCamelCase(result.rows[0]));
  } catch (err) {
    console.error('Portal request changes error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ─── Request Forms (CRM side, authenticated) ─────────────

// GET /forms/templates — list templates
router.get('/forms/templates', requireAuth, async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM request_form_templates ORDER BY created_at DESC');
    res.json(result.rows.map(toCamelCase));
  } catch (err) {
    console.error('Templates list error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /forms/templates — save new template
router.post('/forms/templates', requireAuth, async (req, res) => {
  const { name, fields } = toSnakeBody(req.body);
  if (!name) return res.status(400).json({ error: 'name required' });
  try {
    const result = await pool.query(
      `INSERT INTO request_form_templates (name, fields, created_by) VALUES ($1, $2, $3) RETURNING *`,
      [name, JSON.stringify(fields || []), req.user.id]
    );
    res.status(201).json(toCamelCase(result.rows[0]));
  } catch (err) {
    console.error('Template save error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// DELETE /forms/templates/:id — delete template
router.delete('/forms/templates/:id', requireAuth, async (req, res) => {
  try {
    await pool.query('DELETE FROM request_form_templates WHERE id = $1', [req.params.id]);
    res.json({ success: true });
  } catch (err) {
    console.error('Template delete error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /forms — create a form for a client
router.post('/forms', requireAuth, async (req, res) => {
  const { client_id, deliverable_id, name, fields } = toSnakeBody(req.body);
  if (!client_id || !name) return res.status(400).json({ error: 'client_id and name required' });
  try {
    const token = generateToken();
    const result = await pool.query(
      `INSERT INTO request_forms (token, client_id, deliverable_id, name, fields, status, created_by)
       VALUES ($1, $2, $3, $4, $5, 'active', $6) RETURNING *`,
      [token, client_id, deliverable_id || null, name, JSON.stringify(fields || []), req.user.id]
    );
    res.status(201).json(toCamelCase(result.rows[0]));
  } catch (err) {
    console.error('Form create error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /forms/by-client/:clientId — list forms for a client (CRM side)
router.get('/forms/by-client/:clientId', requireAuth, async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM request_forms WHERE client_id = $1 ORDER BY created_at DESC',
      [req.params.clientId]
    );
    res.json(result.rows.map(toCamelCase));
  } catch (err) {
    console.error('Forms list error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /forms/:id — fetch a form by id (CRM side for editing)
router.get('/forms/:id', requireAuth, async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM request_forms WHERE id = $1', [req.params.id]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Form not found' });
    res.json(toCamelCase(result.rows[0]));
  } catch (err) {
    console.error('Form fetch error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PATCH /forms/:id — update a form
router.patch('/forms/:id', requireAuth, async (req, res) => {
  const body = toSnakeBody(req.body);
  const updates = [];
  const values = [];
  let idx = 1;
  ['name', 'fields', 'status'].forEach(f => {
    if (body[f] !== undefined) {
      updates.push(`${f} = $${idx++}`);
      values.push(f === 'fields' && typeof body[f] === 'object' ? JSON.stringify(body[f]) : body[f]);
    }
  });
  if (updates.length === 0) return res.status(400).json({ error: 'No fields to update' });
  values.push(req.params.id);
  try {
    const result = await pool.query(
      `UPDATE request_forms SET ${updates.join(', ')}, updated_at = NOW() WHERE id = $${idx} RETURNING *`,
      values
    ).catch(async () => {
      return await pool.query(
        `UPDATE request_forms SET ${updates.join(', ')} WHERE id = $${idx} RETURNING *`,
        values
      );
    });
    if (result.rows.length === 0) return res.status(404).json({ error: 'Form not found' });
    res.json(toCamelCase(result.rows[0]));
  } catch (err) {
    console.error('Form update error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
