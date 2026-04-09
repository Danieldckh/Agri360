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

    // Global auto-advance: any in-flight deliverable owned by this client that
    // is waiting on materials/focus points transitions to materials_received.
    // Scoped strictly to this client; no-op if nothing matches.
    const advance = await pool.query(
      `UPDATE deliverables
         SET status = 'materials_received',
             status_changed_at = NOW(),
             updated_at = NOW()
       WHERE client_id = $1
         AND status IN ('materials_requested', 'request_focus_points', 'focus_points_requested', 'request_materials')`,
      [client.id]
    );
    if (advance.rowCount > 0) {
      console.log('Auto-advanced', advance.rowCount, 'deliverables to materials_received for client', client.id);
    }

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

// POST /:token/approvals/:deliverableId/approve — client approves a deliverable.
// Scoped by client_id so a valid token can only approve its own client's rows.
router.post('/:token/approvals/:deliverableId/approve', async (req, res) => {
  try {
    const client = await fetchClientByToken(req.params.token);
    if (!client) return res.status(404).json({ error: 'Invalid token' });
    const result = await pool.query(
      `UPDATE deliverables SET status = 'approved', updated_at = NOW()
       WHERE id = $1 AND client_id = $2 RETURNING *`,
      [req.params.deliverableId, client.id]
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

    // Check count — scoped by client_id so a token can only touch its own rows.
    const existing = await pool.query(
      'SELECT change_request_count, metadata FROM deliverables WHERE id = $1 AND client_id = $2',
      [req.params.deliverableId, client.id]
    );
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
       metadata = $1, updated_at = NOW() WHERE id = $2 AND client_id = $3 RETURNING *`,
      [JSON.stringify(metadata), req.params.deliverableId, client.id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Deliverable not found' });
    res.json(toCamelCase(result.rows[0]));
  } catch (err) {
    console.error('Portal request changes error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ─── Per-post approval endpoints (content calendar) ─────
// Content calendar deliverables contain many posts in metadata.posts[].
// The client portal can approve or request changes on each post individually.
// Both routes are scoped by client_id via the token so a valid token can only
// touch its own client's deliverables.

function stripHtml(s) {
  return String(s || '').replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
}

function derivePlatforms(metadata) {
  // Best-effort: read metadata.platforms — may be an object of booleans
  // ({facebook: true, instagram: false}) or an array of strings. Normalise
  // to an array of platform slugs.
  const p = metadata && metadata.platforms;
  if (!p) return [];
  if (Array.isArray(p)) return p.filter(x => typeof x === 'string');
  if (typeof p === 'object') {
    return Object.keys(p).filter(k => p[k]);
  }
  return [];
}

// POST /:token/approvals/:deliverableId/posts/:postIdx/approve
// Approves a single post inside a content calendar deliverable. If every post
// on the deliverable is now approved, the deliverable itself flips to
// 'approved'. On success we also insert a scheduled_posts row so the social
// media scheduler can pick it up — failure of that insert is logged but does
// not fail the approval (the post-status change is the primary contract).
router.post('/:token/approvals/:deliverableId/posts/:postIdx/approve', async (req, res) => {
  try {
    const client = await fetchClientByToken(req.params.token);
    if (!client) return res.status(404).json({ error: 'Invalid token' });

    const existing = await pool.query(
      'SELECT * FROM deliverables WHERE id = $1 AND client_id = $2',
      [req.params.deliverableId, client.id]
    );
    if (existing.rows.length === 0) return res.status(404).json({ error: 'Deliverable not found' });
    const deliverable = existing.rows[0];

    let metadata = deliverable.metadata || {};
    if (typeof metadata === 'string') try { metadata = JSON.parse(metadata); } catch (e) { metadata = {}; }
    const posts = Array.isArray(metadata.posts) ? metadata.posts : [];

    const postIdx = parseInt(req.params.postIdx, 10);
    if (Number.isNaN(postIdx) || postIdx < 0 || postIdx >= posts.length) {
      return res.status(400).json({ error: 'Invalid postIdx' });
    }

    posts[postIdx] = Object.assign({}, posts[postIdx], { status: 'approved' });
    metadata.posts = posts;

    const allApproved = posts.length > 0 && posts.every(p => p && p.status === 'approved');
    const newStatus = allApproved ? 'approved' : deliverable.status;

    const result = await pool.query(
      `UPDATE deliverables SET metadata = $1, status = $2, updated_at = NOW()
       WHERE id = $3 AND client_id = $4 RETURNING *`,
      [JSON.stringify(metadata), newStatus, req.params.deliverableId, client.id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Deliverable not found' });

    // Best-effort: enqueue a scheduled_posts row. Failure here must not break
    // the approve contract.
    try {
      const post = posts[postIdx];
      const title = (deliverable.title || 'Content Calendar Post') + ' — post ' + (postIdx + 1);
      const content = stripHtml(post.caption);
      const platforms = derivePlatforms(metadata);
      const mediaUrls = Array.isArray(post.images) ? post.images : [];
      let scheduledAt = null;
      let spStatus = 'unscheduled';
      if (post.date) {
        // Normalise to ISO timestamp at 09:00 UTC on the given date.
        scheduledAt = String(post.date).slice(0, 10) + ' 09:00:00+00';
        spStatus = 'scheduled';
      }
      await pool.query(
        `INSERT INTO scheduled_posts
           (title, content, platforms, scheduled_at, status, source_type, source_id, client_id, media_urls, created_by)
         VALUES ($1, $2, $3, $4, $5, 'content-calendar', $6, $7, $8, NULL)`,
        [
          title,
          content,
          JSON.stringify(platforms),
          scheduledAt,
          spStatus,
          deliverable.id,
          deliverable.client_id,
          JSON.stringify(mediaUrls)
        ]
      );
    } catch (spErr) {
      console.error('scheduled_posts insert failed for post approval:', spErr.message);
    }

    res.json(toCamelCase(result.rows[0]));
  } catch (err) {
    console.error('Portal post approve error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /:token/approvals/:deliverableId/posts/:postIdx/request-changes
// Client requests changes on a single post. Same 3-revision hard cap as the
// deliverable-level endpoint. On success the whole deliverable loops back to
// 'design_changes' per spec (design picks up the per-post change note).
router.post('/:token/approvals/:deliverableId/posts/:postIdx/request-changes', async (req, res) => {
  try {
    const client = await fetchClientByToken(req.params.token);
    if (!client) return res.status(404).json({ error: 'Invalid token' });

    const body = req.body || {};
    const text = typeof body.text === 'string' ? body.text : '';
    const caption = typeof body.caption === 'string' ? body.caption : null;
    const images = Array.isArray(body.images) ? body.images : [];
    if (!text && caption === null) {
      return res.status(400).json({ error: 'Either text or caption is required' });
    }

    const existing = await pool.query(
      'SELECT * FROM deliverables WHERE id = $1 AND client_id = $2',
      [req.params.deliverableId, client.id]
    );
    if (existing.rows.length === 0) return res.status(404).json({ error: 'Deliverable not found' });
    const deliverable = existing.rows[0];

    const currentCount = deliverable.change_request_count || 0;
    if (currentCount >= 3) {
      return res.status(400).json({ error: 'Maximum change requests (3) reached for this deliverable' });
    }

    let metadata = deliverable.metadata || {};
    if (typeof metadata === 'string') try { metadata = JSON.parse(metadata); } catch (e) { metadata = {}; }
    const posts = Array.isArray(metadata.posts) ? metadata.posts : [];

    const postIdx = parseInt(req.params.postIdx, 10);
    if (Number.isNaN(postIdx) || postIdx < 0 || postIdx >= posts.length) {
      return res.status(400).json({ error: 'Invalid postIdx' });
    }

    const post = Object.assign({}, posts[postIdx]);
    post.change_requests = Array.isArray(post.change_requests) ? post.change_requests.slice() : [];
    post.change_requests.push({
      id: Date.now(),
      text: text || '',
      images: images,
      created_at: new Date().toISOString(),
      created_by: 'client'
    });
    if (caption !== null) {
      post.caption = caption;
    }
    post.status = 'changes_requested';
    posts[postIdx] = post;
    metadata.posts = posts;

    const result = await pool.query(
      `UPDATE deliverables
          SET metadata = $1,
              status = 'design_changes',
              change_request_count = change_request_count + 1,
              updated_at = NOW()
        WHERE id = $2 AND client_id = $3 RETURNING *`,
      [JSON.stringify(metadata), req.params.deliverableId, client.id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Deliverable not found' });
    res.json(toCamelCase(result.rows[0]));
  } catch (err) {
    console.error('Portal post request-changes error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ─── Portal Chat Messages ────────────────────────────────
// A lightweight chat thread per client, stored in portal_messages.
// The portal side (public, token-based) and the CRM side (authenticated)
// read/write the same rows for a given client_id.

// GET /:token/messages — public: fetch chat history for this client.
// Includes the sender's employee name (for CRM replies) so the portal
// can render "Sarah — 2h ago" style entries without extra joins on the
// client side. Ordered oldest-first for natural chat flow.
router.get('/:token/messages', async (req, res) => {
  try {
    const client = await fetchClientByToken(req.params.token);
    if (!client) return res.status(404).json({ error: 'Invalid token' });
    const result = await pool.query(
      `SELECT pm.*, e.first_name AS sender_first_name, e.last_name AS sender_last_name, e.photo_url AS sender_photo_url
       FROM portal_messages pm
       LEFT JOIN employees e ON e.id = pm.sender_employee_id
       WHERE pm.client_id = $1
       ORDER BY pm.created_at ASC`,
      [client.id]
    );
    res.json(result.rows.map(toCamelCase));
  } catch (err) {
    console.error('Portal messages list error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /:token/messages — public: client sends a message.
// Sender is recorded as 'client' with NULL employee id.
router.post('/:token/messages', async (req, res) => {
  try {
    const client = await fetchClientByToken(req.params.token);
    if (!client) return res.status(404).json({ error: 'Invalid token' });
    const { content } = req.body;
    if (!content || !String(content).trim()) {
      return res.status(400).json({ error: 'Message content required' });
    }
    const result = await pool.query(
      `INSERT INTO portal_messages (client_id, sender_type, content)
       VALUES ($1, 'client', $2) RETURNING *`,
      [client.id, String(content).trim()]
    );
    res.status(201).json(toCamelCase(result.rows[0]));
  } catch (err) {
    console.error('Portal message send error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /messages/by-client/:clientId — authenticated: list messages for a client
// (for the CRM-side chat UI).
router.get('/messages/by-client/:clientId', requireAuth, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT pm.*, e.first_name AS sender_first_name, e.last_name AS sender_last_name, e.photo_url AS sender_photo_url
       FROM portal_messages pm
       LEFT JOIN employees e ON e.id = pm.sender_employee_id
       WHERE pm.client_id = $1
       ORDER BY pm.created_at ASC`,
      [req.params.clientId]
    );
    res.json(result.rows.map(toCamelCase));
  } catch (err) {
    console.error('CRM portal messages list error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /messages/by-client/:clientId — authenticated: CRM employee replies
// to the portal chat. Sender is recorded as the current employee.
router.post('/messages/by-client/:clientId', requireAuth, async (req, res) => {
  try {
    const { content } = req.body;
    if (!content || !String(content).trim()) {
      return res.status(400).json({ error: 'Message content required' });
    }
    const result = await pool.query(
      `INSERT INTO portal_messages (client_id, sender_type, sender_employee_id, content)
       VALUES ($1, 'employee', $2, $3) RETURNING *`,
      [req.params.clientId, req.user.id, String(content).trim()]
    );
    res.status(201).json(toCamelCase(result.rows[0]));
  } catch (err) {
    console.error('CRM portal message send error:', err);
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

    // Auto-advance linked deliverable from request_client_materials → materials_requested
    // The form publish IS the "date requested" — stamp statusChangedAt = NOW().
    if (deliverable_id) {
      await pool.query(
        `UPDATE deliverables
         SET status = 'materials_requested', status_changed_at = NOW(), updated_at = NOW()
         WHERE id = $1 AND status = 'request_client_materials'`,
        [deliverable_id]
      );
    }

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
