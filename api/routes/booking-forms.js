const { Router } = require('express');
const pool = require('../db');
const { requireAuth } = require('../middleware/auth');
const { toCamelCase, toSnakeBody } = require('../utils');

const router = Router();

router.use(requireAuth);

// GET / - list all booking forms with client info
router.get('/', async (req, res) => {
  try {
    let query = `SELECT bf.*, c.name AS client_name
       FROM booking_forms bf
       LEFT JOIN clients c ON c.id = bf.client_id`;
    const params = [];
    if (req.query.department) {
      query += ' WHERE bf.department = $1';
      params.push(req.query.department);
    }
    query += ' ORDER BY bf.created_at DESC';
    const result = await pool.query(query, params);
    res.json(result.rows.map(toCamelCase));
  } catch (err) {
    console.error('List all booking forms error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /by-client/:clientId - list booking forms for a client
router.get('/by-client/:clientId', async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM booking_forms WHERE client_id = $1 ORDER BY created_at DESC',
      [req.params.clientId]
    );
    res.json(result.rows.map(toCamelCase));
  } catch (err) {
    console.error('List booking forms error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /:id - single booking form with client info
router.get('/:id', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT bf.*, c.name AS client_name, c.contact_person AS client_contact_person
       FROM booking_forms bf
       JOIN clients c ON c.id = bf.client_id
       WHERE bf.id = $1`,
      [req.params.id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Booking form not found' });
    }
    res.json(toCamelCase(result.rows[0]));
  } catch (err) {
    console.error('Get booking form error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST / - create or update booking form (upsert by checklist_id)
router.post('/', async (req, res) => {
  const b = toSnakeBody(req.body);
  const { client_id, campaign_month_start, campaign_month_end, form_data, sign_off_date, representative, description, status, booked_date, due_date, checklist_id } = b;
  let { title } = b;

  if (!client_id) {
    return res.status(400).json({ error: 'client_id is required' });
  }

  // Auto-generate title from date range if not provided
  if (!title && campaign_month_start && campaign_month_end) {
    const start = campaign_month_start.substring(0, 7);
    const end = campaign_month_end.substring(0, 7);
    title = `Booking ${start} - ${end}`;
  }

  const formDataVal = (form_data !== undefined && typeof form_data === 'object' && form_data !== null)
    ? JSON.stringify(form_data)
    : (form_data || null);

  try {
    // If checklist_id provided, try to update existing
    if (checklist_id) {
      const existing = await pool.query('SELECT id FROM booking_forms WHERE checklist_id = $1', [checklist_id]);
      if (existing.rows.length > 0) {
        const result = await pool.query(
          `UPDATE booking_forms SET client_id = $1, title = $2, description = $3, status = $4,
           booked_date = $5, due_date = $6, campaign_month_start = $7, campaign_month_end = $8,
           form_data = $9, sign_off_date = $10, representative = $11, updated_at = NOW()
           WHERE checklist_id = $12 RETURNING *`,
          [
            client_id, title || null, description || null, status || 'draft',
            booked_date || null, due_date || null,
            campaign_month_start || null, campaign_month_end || null,
            formDataVal, sign_off_date || null, representative || null,
            checklist_id
          ]
        );
        return res.json(toCamelCase(result.rows[0]));
      }
    }

    // Create new
    const result = await pool.query(
      `INSERT INTO booking_forms (client_id, title, description, status, booked_date, due_date, campaign_month_start, campaign_month_end, form_data, sign_off_date, representative, checklist_id, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
       RETURNING *`,
      [
        client_id, title || null, description || null, status || 'draft',
        booked_date || null, due_date || null,
        campaign_month_start || null, campaign_month_end || null,
        formDataVal, sign_off_date || null, representative || null,
        checklist_id || null, req.user.id
      ]
    );
    res.status(201).json(toCamelCase(result.rows[0]));
  } catch (err) {
    console.error('Create booking form error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PATCH /:id - update booking form
router.patch('/:id', async (req, res) => {
  const body = toSnakeBody(req.body);
  const fields = ['title', 'description', 'status', 'department', 'booked_date', 'due_date', 'campaign_month_start', 'campaign_month_end', 'form_data', 'sign_off_date', 'representative', 'decline_reason', 'editable_url', 'esign_url', 'checklist_url'];
  const updates = [];
  const values = [];
  let idx = 1;

  for (const field of fields) {
    if (body[field] !== undefined) {
      let val = body[field];
      if (field === 'form_data' && typeof val === 'object' && val !== null) {
        val = JSON.stringify(val);
      }
      updates.push(`${field} = $${idx}`);
      values.push(val);
      idx++;
    }
  }

  if (updates.length === 0) {
    return res.status(400).json({ error: 'No fields to update' });
  }

  values.push(req.params.id);

  try {
    const result = await pool.query(
      `UPDATE booking_forms SET ${updates.join(', ')} WHERE id = $${idx} RETURNING *`,
      values
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Booking form not found' });
    }
    res.json(toCamelCase(result.rows[0]));
  } catch (err) {
    console.error('Update booking form error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// DELETE /:id - delete booking form
router.delete('/:id', async (req, res) => {
  try {
    const result = await pool.query(
      'DELETE FROM booking_forms WHERE id = $1 RETURNING *',
      [req.params.id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Booking form not found' });
    }
    res.json(toCamelCase(result.rows[0]));
  } catch (err) {
    console.error('Delete booking form error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /:id/send-to-editor - Send checklist data to editable booking form service
router.post('/:id/send-to-editor', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT bf.*, c.name as client_name, c.trading_name, c.primary_contact, c.material_contact, c.accounts_contact
       FROM booking_forms bf
       LEFT JOIN clients c ON bf.client_id = c.id
       WHERE bf.id = $1`,
      [req.params.id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Booking form not found' });
    }
    const form = toCamelCase(result.rows[0]);
    const formData = form.formData || {};
    const slug = (form.clientName || 'booking').toLowerCase().replace(/[^a-z0-9]+/g, '-') + '-' + form.id;

    // Build payload matching what the editable booking form service expects
    const payload = {
      slug: slug,
      client_information: {
        company_name: formData.companyName || form.clientName || '',
        trading_name: formData.tradingName || '',
        campaign_start: formData.campaignMonthStart || form.campaignMonthStart || '',
        campaign_end: formData.campaignMonthEnd || form.campaignMonthEnd || ''
      },
      form_data: formData,
      booking_form_id: form.id
    };

    // Send to editable booking form service via n8n webhook
    const EDITOR_WEBHOOK = process.env.N8N_BOOKING_FORM_WEBHOOK || 'https://n8n.proagrihub.com/webhook/BookingForm';
    const editorRes = await fetch(EDITOR_WEBHOOK, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const editorResult = await editorRes.text();

    // Store the editable URL
    const editableUrl = `https://bookingformeditor.proagrihub.com/pages/${slug}.html`;
    await pool.query(
      'UPDATE booking_forms SET editable_url = $1, updated_at = NOW() WHERE id = $2',
      [editableUrl, req.params.id]
    );

    res.json({ success: true, editableUrl, slug, webhookResponse: editorResult });
  } catch (err) {
    console.error('Send to editor error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /:id/send-to-esign - Send edited booking form to e-sign service
router.post('/:id/send-to-esign', async (req, res) => {
  try {
    const { html, slug } = req.body || {};
    const result = await pool.query('SELECT * FROM booking_forms WHERE id = $1', [req.params.id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Booking form not found' });
    }
    const form = toCamelCase(result.rows[0]);
    const finalSlug = slug || ('esign-' + form.id);

    // Send to e-sign service
    const ESIGN_SERVICE = process.env.ESIGN_SERVICE_URL || 'https://esign.proagrihub.com';
    const esignRes = await fetch(ESIGN_SERVICE + '/create', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        slug: finalSlug,
        html: html || '',
        bookingFormId: form.id,
        readOnly: true
      })
    });
    const esignResult = await esignRes.json();

    // Store the e-sign URL
    const esignUrl = esignResult.url || `${ESIGN_SERVICE}/pages/${finalSlug}.html`;
    await pool.query(
      'UPDATE booking_forms SET esign_url = $1, updated_at = NOW() WHERE id = $2',
      [esignUrl, req.params.id]
    );

    res.json({ success: true, esignUrl, slug: finalSlug });
  } catch (err) {
    console.error('Send to esign error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /:id/sign - Handle e-sign completion (signed or change request)
router.post('/:id/sign', async (req, res) => {
  try {
    const { action, pdfData, signatureData, changeNotes } = req.body || {};
    const result = await pool.query('SELECT * FROM booking_forms WHERE id = $1', [req.params.id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Booking form not found' });
    }

    if (action === 'signed') {
      // Save signed PDF and advance to onboarding
      await pool.query(
        `UPDATE booking_forms SET
          signed_pdf = $1, signature_data = $2, signed_at = NOW(),
          status = 'onboarding', department = 'admin-onboarding', updated_at = NOW()
        WHERE id = $3`,
        [pdfData || null, JSON.stringify(signatureData) || null, req.params.id]
      );
      res.json({ success: true, status: 'onboarding' });
    } else if (action === 'change_request') {
      // Save change request PDF
      await pool.query(
        `UPDATE booking_forms SET
          change_request_pdf = $1, change_notes = $2,
          status = 'change_requested', updated_at = NOW()
        WHERE id = $3`,
        [pdfData || null, changeNotes || null, req.params.id]
      );
      res.json({ success: true, status: 'change_requested' });
    } else {
      res.status(400).json({ error: 'Invalid action. Use "signed" or "change_request"' });
    }
  } catch (err) {
    console.error('Sign booking form error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
