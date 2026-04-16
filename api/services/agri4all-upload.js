// Agri4All Product Uploads — orchestration service.
//
// Given an approved `agri4all-product-uploads` deliverable, this module:
//   1. resolves a leaf category (via the existing single-pass autofill; the
//      vision upgrade is deferred),
//   2. builds a per-country Alpha payload,
//   3. POSTs to Alpha once per target country (idempotent per country),
//   4. upserts a row in `agri4all_upload_jobs` per country,
//   5. transitions the deliverable to `agri4all-links` on success.
//
// Failures for one country do not abort the loop — each country's row captures
// its own success/error state so the UI can show partial progress and retry
// individual countries.

const crypto = require('crypto');
const path = require('path');
const pool = require('../db');
const {
  getCachedCategoryTree,
  postProductForCountry,
} = require('../lib/alpha-agri4all');
const { autofillProductFields } = require('../lib/openai-autofill');
const { toIsoAlpha2 } = require('../lib/country-codes');
const { UPLOAD_DIR } = require('../config');

function _hashPayload(obj) {
  return crypto.createHash('sha1').update(JSON.stringify(obj)).digest('hex').slice(0, 12);
}

/**
 * Resolve the list of ISO alpha-2 countries to post to.
 * Order of preference:
 *   1. deliverable.metadata.countries (array of names or codes)
 *   2. client.agri4all_target_countries (JSONB array of ISO codes)
 *   3. fallback: ['ZA']
 */
function _resolveCountries(deliverable, clientRow) {
  const meta = deliverable.metadata || {};
  const fromMeta = Array.isArray(meta.countries) ? meta.countries : [];
  if (fromMeta.length) {
    return Array.from(new Set(fromMeta.map(c => toIsoAlpha2(c) || c).filter(c => typeof c === 'string' && c.length === 2)));
  }
  const fromClient = clientRow && Array.isArray(clientRow.agri4all_target_countries)
    ? clientRow.agri4all_target_countries
    : [];
  if (fromClient.length) {
    return Array.from(new Set(fromClient.map(c => (typeof c === 'string' ? c.toUpperCase() : '')).filter(c => c.length === 2)));
  }
  return ['ZA'];
}

function _collectMediaFilePaths(deliverable) {
  const meta = deliverable.metadata || {};
  const sections = meta.sections || [];
  const paths = [];
  // Canonical source = metadata.sections[].files[]. Sections may also be an
  // object keyed by post type (agri4all-posts pattern); support both.
  const iterable = Array.isArray(sections)
    ? sections
    : Object.values(sections || {});
  for (const section of iterable) {
    if (!section || typeof section !== 'object') continue;
    const files = Array.isArray(section.files) ? section.files : [];
    for (const file of files) {
      const filename = file.filename || file.url;
      if (filename) paths.push(path.join(UPLOAD_DIR, filename));
    }
  }
  return paths;
}

function _buildContacts(clientRow) {
  const contacts = [];
  const pc = clientRow && clientRow.primary_contact;
  const mc = clientRow && clientRow.material_contact;
  for (const c of [pc, mc]) {
    if (!c || typeof c !== 'object') continue;
    const name = c.name || c.full_name || '';
    const email = c.email || '';
    const phone = c.phone || c.mobile || '';
    if (!name && !email && !phone) continue;
    contacts.push({
      name,
      email,
      phone,
      preferred_contact: c.preferred_contact || (email ? 'email' : 'phone'),
    });
  }
  if (!contacts.length && clientRow) {
    // Fallback to the clients table flat columns.
    if (clientRow.contact_person || clientRow.email || clientRow.phone) {
      contacts.push({
        name: clientRow.contact_person || clientRow.name || '',
        email: clientRow.email || '',
        phone: clientRow.phone || '',
        preferred_contact: clientRow.email ? 'email' : 'phone',
      });
    }
  }
  return contacts;
}

/**
 * Run the full upload pipeline for a single deliverable.
 * Safe to call multiple times: jobs are upserted per (deliverable_id, country).
 * Does not throw on per-country failure — returns a summary.
 *
 * @param {number|string} deliverableId
 * @returns {Promise<{totalCountries:number, posted:number, errored:number, jobs:Array}>}
 */
async function runUploadForDeliverable(deliverableId) {
  // 1. Fetch deliverable + booking form + client
  const delivRes = await pool.query(
    `SELECT d.*, bf.form_data AS booking_form_data, c.*
       FROM deliverables d
       LEFT JOIN booking_forms bf ON bf.id = d.booking_form_id
       LEFT JOIN clients c ON c.id = COALESCE(d.client_id, bf.client_id)
      WHERE d.id = $1`,
    [deliverableId]
  );
  if (delivRes.rows.length === 0) {
    throw new Error('Deliverable not found');
  }
  const row = delivRes.rows[0];
  if (row.type !== 'agri4all-product-uploads') {
    throw new Error('Deliverable is not of type agri4all-product-uploads');
  }

  // The join above aliases clients.* on top of deliverable columns — so
  // `row.id` is now the client id if join hit. Re-fetch cleanly to keep
  // things obvious.
  const delivOnly = await pool.query(
    `SELECT * FROM deliverables WHERE id = $1`,
    [deliverableId]
  );
  const deliverable = delivOnly.rows[0];
  const clientId = deliverable.client_id;
  let clientRow = null;
  if (clientId) {
    const r = await pool.query(`SELECT * FROM clients WHERE id = $1`, [clientId]);
    clientRow = r.rows[0] || null;
  }
  const bfRes = await pool.query(
    `SELECT form_data FROM booking_forms WHERE id = $1`,
    [deliverable.booking_form_id]
  );
  const bookingFormData = (bfRes.rows[0] && bfRes.rows[0].form_data) || {};

  // 2. Category resolve via lazy-refreshed cache + existing single-pass autofill.
  const categoriesTree = await getCachedCategoryTree();
  const autofilled = await autofillProductFields({
    requestFormData: bookingFormData,
    categoriesTree,
  });

  // 3. Media file paths (canonical = metadata.sections[].files[]).
  const mediaFilePaths = _collectMediaFilePaths(deliverable);

  // 4. Build base payload (location.country is overridden per country by postProductForCountry).
  const meta = deliverable.metadata || {};
  const contacts = _buildContacts(clientRow);
  const basePayload = {
    name: autofilled.name,
    description: autofilled.description,
    category_id: autofilled.category_id,
    price: { type: 'price_on_request' },
    location: {
      country: 'ZA',
      state: (clientRow && clientRow.province) || meta.state || '',
      city: (clientRow && clientRow.city) || meta.city || '',
      zip: (clientRow && clientRow.physical_postal_code) || meta.zip || '',
      address: (clientRow && clientRow.physical_address) || meta.address || '',
    },
    contacts,
  };

  // 5. Per-country loop.
  const countries = _resolveCountries(deliverable, clientRow);
  const summary = { totalCountries: countries.length, posted: 0, errored: 0, jobs: [] };
  const payloadHash = _hashPayload({ p: basePayload, m: mediaFilePaths });

  for (const country of countries) {
    const idempotencyKey = `deliv-${deliverable.id}-${country}-${payloadHash}`;
    // Upsert a pending row first so partial failures have a home.
    const jobRes = await pool.query(
      `INSERT INTO agri4all_upload_jobs (deliverable_id, country, job_status, idempotency_key)
       VALUES ($1, $2, 'pending', $3)
       RETURNING *`,
      [deliverable.id, country, idempotencyKey]
    );
    let jobId = jobRes.rows[0].id;

    try {
      const resp = await postProductForCountry(basePayload, mediaFilePaths, country, idempotencyKey);
      const data = (resp && resp.data) ? resp.data : resp;
      const productId = data && data.id ? data.id : null;
      const slug = data && data.slug ? data.slug : null;
      const publicUrl = data && (data.public_url || data.publicUrl) ? (data.public_url || data.publicUrl) : null;
      const agri4allStatus = data && data.status ? data.status : null;

      const updated = await pool.query(
        `UPDATE agri4all_upload_jobs
            SET agri4all_product_id = $1,
                agri4all_slug = $2,
                public_url = $3,
                agri4all_status = $4,
                job_status = 'posted',
                error_detail = NULL,
                updated_at = NOW()
          WHERE id = $5
          RETURNING *`,
        [productId, slug, publicUrl, agri4allStatus, jobId]
      );
      summary.posted++;
      summary.jobs.push(updated.rows[0]);
    } catch (err) {
      const detail = err && err.body ? JSON.stringify(err.body) : (err && err.message) || String(err);
      const updated = await pool.query(
        `UPDATE agri4all_upload_jobs
            SET job_status = 'error',
                error_detail = $1,
                updated_at = NOW()
          WHERE id = $2
          RETURNING *`,
        [detail, jobId]
      );
      summary.errored++;
      summary.jobs.push(updated.rows[0]);
      console.error(`[agri4all-upload] deliverable ${deliverable.id} country ${country} failed:`, detail);
    }
  }

  // 6. Transition deliverable status only if at least one country posted
  //    successfully. Keeps the row in 'approved' otherwise so retries can fire.
  if (summary.posted > 0 && deliverable.status === 'approved') {
    await pool.query(
      `UPDATE deliverables SET status = 'agri4all-links', updated_at = NOW() WHERE id = $1`,
      [deliverable.id]
    );
  }

  return summary;
}

/**
 * Retry a single failed job row — re-runs the pipeline but only for this
 * row's country. Writes the outcome back into the same job row (not a new row).
 */
async function retryJob(jobId) {
  const row = await pool.query(
    `SELECT * FROM agri4all_upload_jobs WHERE id = $1`,
    [jobId]
  );
  if (row.rows.length === 0) throw new Error('Upload job not found');
  const job = row.rows[0];

  const delivOnly = await pool.query(`SELECT * FROM deliverables WHERE id = $1`, [job.deliverable_id]);
  if (delivOnly.rows.length === 0) throw new Error('Deliverable not found');
  const deliverable = delivOnly.rows[0];
  let clientRow = null;
  if (deliverable.client_id) {
    const r = await pool.query(`SELECT * FROM clients WHERE id = $1`, [deliverable.client_id]);
    clientRow = r.rows[0] || null;
  }
  const bfRes = await pool.query(`SELECT form_data FROM booking_forms WHERE id = $1`, [deliverable.booking_form_id]);
  const bookingFormData = (bfRes.rows[0] && bfRes.rows[0].form_data) || {};

  const categoriesTree = await getCachedCategoryTree();
  const autofilled = await autofillProductFields({ requestFormData: bookingFormData, categoriesTree });
  const mediaFilePaths = _collectMediaFilePaths(deliverable);
  const meta = deliverable.metadata || {};
  const contacts = _buildContacts(clientRow);
  const basePayload = {
    name: autofilled.name,
    description: autofilled.description,
    category_id: autofilled.category_id,
    price: { type: 'price_on_request' },
    location: {
      country: job.country,
      state: (clientRow && clientRow.province) || meta.state || '',
      city: (clientRow && clientRow.city) || meta.city || '',
      zip: (clientRow && clientRow.physical_postal_code) || meta.zip || '',
      address: (clientRow && clientRow.physical_address) || meta.address || '',
    },
    contacts,
  };

  // New idempotency key for retry — the previous one may have been consumed by
  // a prior (failed) attempt within Alpha's 24h window; a fresh key avoids the
  // documented multipart idempotency-conflict pitfall.
  const idempotencyKey = `deliv-${deliverable.id}-${job.country}-retry-${_hashPayload({ p: basePayload, m: mediaFilePaths, t: Date.now() })}`;

  try {
    const resp = await postProductForCountry(basePayload, mediaFilePaths, job.country, idempotencyKey);
    const data = (resp && resp.data) ? resp.data : resp;
    const productId = data && data.id ? data.id : null;
    const slug = data && data.slug ? data.slug : null;
    const publicUrl = data && (data.public_url || data.publicUrl) ? (data.public_url || data.publicUrl) : null;
    const agri4allStatus = data && data.status ? data.status : null;
    const updated = await pool.query(
      `UPDATE agri4all_upload_jobs
          SET agri4all_product_id = $1, agri4all_slug = $2, public_url = $3, agri4all_status = $4,
              job_status = 'posted', error_detail = NULL, idempotency_key = $5, updated_at = NOW()
        WHERE id = $6 RETURNING *`,
      [productId, slug, publicUrl, agri4allStatus, idempotencyKey, job.id]
    );
    // Promote deliverable if still 'approved' and now has a posted job.
    if (deliverable.status === 'approved') {
      await pool.query(
        `UPDATE deliverables SET status = 'agri4all-links', updated_at = NOW() WHERE id = $1`,
        [deliverable.id]
      );
    }
    return updated.rows[0];
  } catch (err) {
    const detail = err && err.body ? JSON.stringify(err.body) : (err && err.message) || String(err);
    const updated = await pool.query(
      `UPDATE agri4all_upload_jobs
          SET job_status = 'error', error_detail = $1, idempotency_key = $2, updated_at = NOW()
        WHERE id = $3 RETURNING *`,
      [detail, idempotencyKey, job.id]
    );
    return updated.rows[0];
  }
}

module.exports = {
  runUploadForDeliverable,
  retryJob,
};
