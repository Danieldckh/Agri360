const { Router } = require('express');
const pool = require('../db');
const { requireAuth } = require('../middleware/auth');
const { toCamelCase, toSnakeBody } = require('../utils');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const router = Router();

router.use(requireAuth);

const proposalUploadDir = path.join(__dirname, '../uploads/proposal-files');
fs.mkdirSync(proposalUploadDir, { recursive: true });

const proposalStorage = multer.diskStorage({
  destination: function (_req, _file, cb) { cb(null, proposalUploadDir); },
  filename: function (req, file, cb) {
    var ext = path.extname(file.originalname) || '';
    cb(null, 'proposal-' + req.params.id + '-' + Date.now() + '-' + Math.random().toString(36).substring(2, 6) + ext);
  }
});

const proposalUpload = multer({
  storage: proposalStorage,
  limits: { fileSize: 25 * 1024 * 1024 } // 25MB
});

// Internal helper: create the unsigned booking form (an esign URL the
// client can click to view + sign). Used by the explicit
// POST /:id/send-to-esign route AND as a side effect of PATCH /:id when
// status reaches `booking_form_ready` for the first time.
//
// The Booking Form Esign service (separate app, shares this Postgres
// instance) renders the booking form from `bookingFormId`, so the html
// payload may be empty when triggered automatically.
//
// On success: writes esign_url onto the booking_forms row and returns
// { esignUrl, slug }. On failure: throws — callers decide whether to
// swallow (PATCH side effect) or surface (explicit POST route).
async function createUnsignedBookingForm(formId, opts) {
  opts = opts || {};
  const formResult = await pool.query('SELECT * FROM booking_forms WHERE id = $1', [formId]);
  if (formResult.rows.length === 0) {
    const err = new Error('Booking form not found');
    err.code = 'NOT_FOUND';
    throw err;
  }
  const form = toCamelCase(formResult.rows[0]);
  const finalSlug = opts.slug || ('esign-' + form.id);

  const ESIGN_SERVICE = process.env.ESIGN_SERVICE_URL || 'https://esign.proagrihub.com';
  const esignRes = await fetch(ESIGN_SERVICE + '/create', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      slug: finalSlug,
      html: opts.html || '',
      bookingFormId: form.id,
      readOnly: true
    })
  });
  const esignResult = await esignRes.json().catch(() => ({}));

  const esignUrl = esignResult.url || `${ESIGN_SERVICE}/pages/${finalSlug}.html`;
  await pool.query(
    'UPDATE booking_forms SET esign_url = $1, updated_at = NOW() WHERE id = $2',
    [esignUrl, formId]
  );

  return { esignUrl, slug: finalSlug };
}

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

// GET /:id - single booking form with full client details
router.get('/:id', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT bf.*,
              c.name AS client_name, c.contact_person AS client_contact_person,
              c.trading_name AS client_trading_name, c.email AS client_email,
              c.phone AS client_phone, c.company_reg_no AS client_company_reg_no,
              c.vat_number AS client_vat_number, c.website AS client_website,
              c.industry_expertise AS client_industry_expertise,
              c.physical_address AS client_physical_address,
              c.physical_postal_code AS client_physical_postal_code,
              c.postal_address AS client_postal_address,
              c.postal_code AS client_postal_code,
              c.primary_contact AS client_primary_contact,
              c.material_contact AS client_material_contact,
              c.accounts_contact AS client_accounts_contact
       FROM booking_forms bf
       LEFT JOIN clients c ON c.id = bf.client_id
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

// POST / - create or update booking form (upsert by checklist_id).
// Also accepts checklist_url so the checklist app can ship a prefilled
// "re-open this checklist" link alongside the form data on submit.
router.post('/', async (req, res) => {
  const b = toSnakeBody(req.body);
  const { client_id, campaign_month_start, campaign_month_end, form_data, sign_off_date, representative, description, status, booked_date, due_date, checklist_id, checklist_url } = b;
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
        // Use COALESCE so an older client that doesn't send checklist_url
        // doesn't wipe a previously-stored URL.
        const result = await pool.query(
          `UPDATE booking_forms SET client_id = $1, title = $2, description = $3, status = $4,
           booked_date = $5, due_date = $6, campaign_month_start = $7, campaign_month_end = $8,
           form_data = $9, sign_off_date = $10, representative = $11,
           checklist_url = COALESCE($12, checklist_url), updated_at = NOW()
           WHERE checklist_id = $13 RETURNING *`,
          [
            client_id, title || null, description || null, status || 'draft',
            booked_date || null, due_date || null,
            campaign_month_start || null, campaign_month_end || null,
            formDataVal, sign_off_date || null, representative || null,
            checklist_url || null,
            checklist_id
          ]
        );
        return res.json(toCamelCase(result.rows[0]));
      }
    }

    // Create new
    const result = await pool.query(
      `INSERT INTO booking_forms (client_id, title, description, status, booked_date, due_date, campaign_month_start, campaign_month_end, form_data, sign_off_date, representative, checklist_id, checklist_url, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
       RETURNING *`,
      [
        client_id, title || null, description || null, status || 'draft',
        booked_date || null, due_date || null,
        campaign_month_start || null, campaign_month_end || null,
        formDataVal, sign_off_date || null, representative || null,
        checklist_id || null, checklist_url || null, req.user.id
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
  const fields = ['title', 'description', 'status', 'department', 'booked_date', 'due_date', 'campaign_month_start', 'campaign_month_end', 'form_data', 'sign_off_date', 'representative', 'decline_reason', 'editable_url', 'esign_url', 'checklist_url', 'proposal_file_url', 'proposal_file_name', 'proposal_file_mime', 'proposal_file_uploaded_at', 'assigned_admin'];
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
    let updatedRow = result.rows[0];

    // Side effect: when a booking form first reaches `booking_form_ready`,
    // automatically generate the unsigned booking form (esign URL) so the
    // "Unsigned Booking Form" link in the admin Booking Form tab is
    // populated. Idempotent: if esign_url already exists, we leave it
    // alone — re-saving status doesn't orphan an existing token.
    //
    // Best-effort: a failure of the esign service should NOT roll back
    // the status change (the PATCH is the primary operation). The error
    // is logged so it can be retried later via POST /:id/send-to-esign.
    if (updatedRow.status === 'booking_form_ready' && !updatedRow.esign_url) {
      try {
        await createUnsignedBookingForm(req.params.id);
        // Re-read so the response reflects the freshly written esign_url.
        const refreshed = await pool.query('SELECT * FROM booking_forms WHERE id = $1', [req.params.id]);
        if (refreshed.rows.length > 0) {
          updatedRow = refreshed.rows[0];
        }
      } catch (esignErr) {
        console.error('Auto-generate unsigned booking form failed for id ' + req.params.id + ':', esignErr);
      }
    }

    res.json(toCamelCase(updatedRow));
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

// POST /:id/upload-proposal-file - attach a design proposal file to a booking form
router.post('/:id/upload-proposal-file', proposalUpload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'Missing file upload' });
    }

    const current = await pool.query(
      'SELECT proposal_file_url FROM booking_forms WHERE id = $1',
      [req.params.id]
    );
    if (current.rows.length === 0) {
      fs.unlink(path.join(proposalUploadDir, req.file.filename), function () {});
      return res.status(404).json({ error: 'Booking form not found' });
    }

    const fileUrl = '/uploads/proposal-files/' + req.file.filename;
    const updated = await pool.query(
      `UPDATE booking_forms SET
         proposal_file_url = $1,
         proposal_file_name = $2,
         proposal_file_mime = $3,
         proposal_file_uploaded_at = NOW(),
         updated_at = NOW()
       WHERE id = $4
       RETURNING *`,
      [fileUrl, req.file.originalname || req.file.filename, req.file.mimetype || null, req.params.id]
    );

    // Best-effort cleanup of the previously attached proposal file.
    var prevUrl = current.rows[0] && current.rows[0].proposal_file_url;
    if (prevUrl && prevUrl.indexOf('/uploads/proposal-files/') === 0) {
      var prevName = path.basename(prevUrl);
      var prevAbs = path.join(proposalUploadDir, prevName);
      if (prevAbs !== path.join(proposalUploadDir, req.file.filename)) {
        fs.unlink(prevAbs, function () {});
      }
    }

    res.json({
      success: true,
      fileUrl: fileUrl,
      fileName: req.file.originalname || req.file.filename,
      mimeType: req.file.mimetype || null,
      bookingForm: toCamelCase(updated.rows[0])
    });
  } catch (err) {
    console.error('Upload proposal file error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /:id/send-to-editor - Generate editable booking form HTML and save it
// to the booking-form editor service.  Runs format-deliverables locally (no
// n8n) and POSTs the finished HTML snippet to POST /create on the editor.
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

    // Generate deliverable rows from checklist data
    const { formatDeliverables } = require('../lib/format-deliverables');
    const deliverableRows = formatDeliverables(formData) || '<tr><td colspan="6"><div class="editable" contenteditable="true"><p><em>No deliverable sections were selected in the checklist.</em></p></div></td></tr>';

    // Build full booking form HTML snippet with company info + deliverables table
    const { buildBookingFormSnippet } = require('../lib/build-booking-snippet');
    const html = buildBookingFormSnippet(formData, form, deliverableRows);

    // POST the HTML snippet to the editor service
    const EDITOR_URL = process.env.BOOKING_FORM_EDITOR_URL || 'https://bookingformeditor.proagrihub.com';
    console.log('[send-to-editor] slug=%s html_len=%d editor_url=%s', slug, (html || '').length, EDITOR_URL);
    const editorRes = await fetch(`${EDITOR_URL}/create`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ slug, html })
    });

    let editableUrl;
    let finalSlug = slug;
    if (editorRes.ok) {
      const editorData = await editorRes.json();
      console.log('[send-to-editor] editor response:', JSON.stringify(editorData));
      editableUrl = editorData.url || `${EDITOR_URL}/pages/${slug}.html`;
      finalSlug = editorData.slug || slug;
    } else {
      const errText = await editorRes.text();
      console.error('[send-to-editor] Editor service error:', editorRes.status, errText);
      editableUrl = `${EDITOR_URL}/pages/${slug}.html`;
    }

    // Store the editable URL
    await pool.query(
      'UPDATE booking_forms SET editable_url = $1, updated_at = NOW() WHERE id = $2',
      [editableUrl, req.params.id]
    );

    res.json({ success: true, editableUrl, slug: finalSlug });
  } catch (err) {
    console.error('Send to editor error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /:id/send-to-esign - Send edited booking form to e-sign service.
// Used by the explicit "send to esign" UI action AND as a manual retry
// path when the auto-generation in PATCH /:id failed (e.g. esign service
// down at the moment status was advanced).
router.post('/:id/send-to-esign', async (req, res) => {
  try {
    const { html, slug } = req.body || {};
    const { esignUrl, slug: finalSlug } = await createUnsignedBookingForm(req.params.id, { html, slug });
    res.json({ success: true, esignUrl, slug: finalSlug });
  } catch (err) {
    if (err && err.code === 'NOT_FOUND') {
      return res.status(404).json({ error: 'Booking form not found' });
    }
    console.error('Send to esign error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /:id/sign - Handle e-sign completion (signed or change request).
// Writes to two places:
//   1) The "latest" pointer columns on booking_forms (signed_pdf,
//      change_request_pdf, etc.) so existing queries keep working.
//   2) The append-only booking_form_revisions table — the immutable
//      audit trail. Every call creates a new row here; rows are never
//      updated or deleted.
router.post('/:id/sign', async (req, res) => {
  try {
    const { action, pdfData, signatureData, changeNotes, htmlSnapshot, signerName, signerEmail } = req.body || {};
    const result = await pool.query('SELECT * FROM booking_forms WHERE id = $1', [req.params.id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Booking form not found' });
    }

    const clientIp = (req.headers['x-forwarded-for'] || req.socket.remoteAddress || '').toString().split(',')[0].trim() || null;
    const userAgent = req.headers['user-agent'] || null;

    async function appendRevision() {
      await pool.query(
        `INSERT INTO booking_form_revisions
          (booking_form_id, action, html_snapshot, pdf_base64,
           signer_name, signer_email, signature_data, change_notes,
           client_ip, user_agent)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
        [
          req.params.id,
          action === 'signed' ? 'signed' : 'change_requested',
          htmlSnapshot || null,
          pdfData || null,
          signerName || null,
          signerEmail || null,
          signatureData ? JSON.stringify(signatureData) : null,
          changeNotes || null,
          clientIp,
          userAgent
        ]
      );
    }

    if (action === 'signed') {
      await appendRevision();
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
      await appendRevision();
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

// GET /:id/revisions - list immutable revision history for a booking form
router.get('/:id/revisions', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT id, booking_form_id, action, signer_name, signer_email,
              change_notes, client_ip, user_agent, created_at
       FROM booking_form_revisions
       WHERE booking_form_id = $1
       ORDER BY created_at DESC, id DESC`,
      [req.params.id]
    );
    res.json(result.rows.map(toCamelCase));
  } catch (err) {
    console.error('List booking form revisions error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /:id/revisions/:revisionId - fetch a specific revision with full payload
router.get('/:id/revisions/:revisionId', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT * FROM booking_form_revisions
       WHERE booking_form_id = $1 AND id = $2`,
      [req.params.id, req.params.revisionId]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Revision not found' });
    }
    res.json(toCamelCase(result.rows[0]));
  } catch (err) {
    console.error('Get booking form revision error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
