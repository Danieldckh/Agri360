// api/routes/admin-cleanup.js
//
// One-shot admin endpoint to hard-delete a fixed set of test fixtures
// from Postgres. Lives behind a CLEANUP_SECRET header and a hardcoded
// ID whitelist — the request body is treated as a confirmation token,
// not as the source of truth for what gets deleted.
//
// MUST be removed (file deleted + route unregistered + CLEANUP_SECRET
// env unset on Coolify) immediately after the cleanup runs. See plan
// at C:/Users/pamde/.claude/plans/rippling-stargazing-steele.md.

const { Router } = require('express');
const pool = require('../db');

const router = Router();

// Hardcoded so a malicious caller can't redirect the delete to other rows.
const TEST_BOOKING_FORM_IDS = [48, 49, 50, 51, 52, 55, 56, 57, 58, 59, 60, 61];
const TEST_CLIENT_IDS = [78, 79, 80, 81, 83, 85, 86, 87, 88, 89, 90, 91];

router.post('/hard-delete-test-fixtures', async (req, res) => {
  const expected = process.env.CLEANUP_SECRET;
  const got = req.headers['x-cleanup-secret'];
  if (!expected) {
    return res.status(403).json({ ok: false, error: 'CLEANUP_SECRET not set' });
  }
  if (got !== expected) {
    return res.status(403).json({ ok: false, error: 'Bad cleanup secret' });
  }

  // Body is a confirmation token: must echo the exact ID lists.
  const { clientIds, bookingFormIds } = req.body || {};
  const sameSet = (a, b) =>
    Array.isArray(a) &&
    Array.isArray(b) &&
    a.length === b.length &&
    a.every((v, i) => v === b[i]);
  if (!sameSet(clientIds, TEST_CLIENT_IDS) || !sameSet(bookingFormIds, TEST_BOOKING_FORM_IDS)) {
    return res.status(400).json({
      ok: false,
      error:
        'Body must echo exact hardcoded ID lists. Expected clientIds + bookingFormIds in plan order.',
      expected: { clientIds: TEST_CLIENT_IDS, bookingFormIds: TEST_BOOKING_FORM_IDS },
    });
  }

  const client = await pool.connect();
  const counts = {};
  try {
    // Pre-flight: any non-test booking_forms still tied to these clients?
    const stray = await client.query(
      `SELECT id FROM booking_forms
       WHERE client_id = ANY($1::int[]) AND id <> ALL($2::int[])`,
      [TEST_CLIENT_IDS, TEST_BOOKING_FORM_IDS]
    );
    if (stray.rows.length > 0) {
      return res.status(409).json({
        ok: false,
        error:
          'Pre-flight failed: non-test booking_forms reference these clients. Aborting to protect production data.',
        strayBookingFormIds: stray.rows.map((r) => r.id),
      });
    }

    await client.query('BEGIN');

    const exec = async (label, sql, params) => {
      const r = await client.query(sql, params);
      counts[label] = r.rowCount;
    };

    await exec(
      'booking_form_revisions',
      `DELETE FROM booking_form_revisions WHERE booking_form_id = ANY($1::int[])`,
      [TEST_BOOKING_FORM_IDS]
    );
    await exec(
      'booking_form_esign_tokens',
      `DELETE FROM booking_form_esign_tokens WHERE booking_form_id = ANY($1::int[])`,
      [TEST_BOOKING_FORM_IDS]
    );
    await exec(
      'channels',
      `DELETE FROM channels WHERE booking_form_id = ANY($1::int[])`,
      [TEST_BOOKING_FORM_IDS]
    );
    await exec(
      'booking_forms',
      `DELETE FROM booking_forms WHERE id = ANY($1::int[])`,
      [TEST_BOOKING_FORM_IDS]
    );
    // deliverables.client_id has no ON DELETE CASCADE — explicit cleanup.
    await exec(
      'deliverables_by_client',
      `DELETE FROM deliverables WHERE client_id = ANY($1::int[])`,
      [TEST_CLIENT_IDS]
    );
    await exec(
      'client_portal_tokens',
      `DELETE FROM client_portal_tokens WHERE client_id = ANY($1::int[])`,
      [TEST_CLIENT_IDS]
    );
    await exec(
      'request_forms',
      `DELETE FROM request_forms WHERE client_id = ANY($1::int[])`,
      [TEST_CLIENT_IDS]
    );
    await exec(
      'client_assets',
      `DELETE FROM client_assets WHERE client_id = ANY($1::int[])`,
      [TEST_CLIENT_IDS]
    );
    await exec(
      'portal_messages',
      `DELETE FROM portal_messages WHERE client_id = ANY($1::int[])`,
      [TEST_CLIENT_IDS]
    );
    await exec(
      'scheduled_posts',
      `DELETE FROM scheduled_posts WHERE client_id = ANY($1::int[])`,
      [TEST_CLIENT_IDS]
    );
    await exec(
      'social_credentials',
      `DELETE FROM social_credentials WHERE client_id = ANY($1::int[])`,
      [TEST_CLIENT_IDS]
    );
    await exec(
      'clients',
      `DELETE FROM clients WHERE id = ANY($1::int[])`,
      [TEST_CLIENT_IDS]
    );

    await client.query('COMMIT');
    res.json({ ok: true, counts });
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    console.error('hard-delete-test-fixtures failed:', err);
    res.status(500).json({ ok: false, error: String(err && err.message) || 'Internal error', counts });
  } finally {
    client.release();
  }
});

module.exports = router;
