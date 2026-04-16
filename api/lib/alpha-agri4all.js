// Required packages (not in package.json — run: cd api && npm install node-fetch form-data):
//   node-fetch  ^2.x  (CommonJS compatible)
//   form-data   ^4.x
const fetch = require('node-fetch');
const FormData = require('form-data');
const fs = require('fs');
const path = require('path');
const pool = require('../db');
const {
  ALPHA_AGRI4ALL_BASE_URL,
  ALPHA_AGRI4ALL_EMAIL,
  ALPHA_AGRI4ALL_PASSWORD,
  ALPHA_AGRI4ALL_SELLER_ID,
} = require('../config');

let _cachedToken = null;
let _tokenExpiry = 0;

// Category cache TTL (24 hours)
const CATEGORY_CACHE_TTL_MS = 24 * 60 * 60 * 1000;

async function getAuthToken() {
  if (_cachedToken && Date.now() < _tokenExpiry) return _cachedToken;
  const res = await fetch(`${ALPHA_AGRI4ALL_BASE_URL}/api/v1/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
    body: JSON.stringify({ email: ALPHA_AGRI4ALL_EMAIL, password: ALPHA_AGRI4ALL_PASSWORD, device_name: 'proagri-crm' }),
  });
  if (!res.ok) throw new Error(`Alpha auth failed: ${res.status}`);
  const data = await res.json();
  _cachedToken = data.token || (data.data && data.data.token);
  _tokenExpiry = Date.now() + 29 * 24 * 60 * 60 * 1000; // 29 days
  return _cachedToken;
}

async function _authHeaders(extra) {
  const token = await getAuthToken();
  return Object.assign(
    { 'Authorization': `Bearer ${token}`, 'Accept': 'application/json' },
    extra || {}
  );
}

async function getCategories() {
  const res = await fetch(`${ALPHA_AGRI4ALL_BASE_URL}/api/v1/categories`, {
    headers: await _authHeaders(),
  });
  if (!res.ok) throw new Error(`Failed to fetch categories: ${res.status}`);
  return res.json();
}

async function getCategoryBySlug(slug) {
  const res = await fetch(
    `${ALPHA_AGRI4ALL_BASE_URL}/api/v1/categories/${encodeURIComponent(slug)}`,
    { headers: await _authHeaders() }
  );
  if (!res.ok) throw new Error(`Failed to fetch category ${slug}: ${res.status}`);
  return res.json();
}

// Flatten any node of a category tree into [{id, slug, name, is_leaf}, ...]
function _flattenCategoryTree(nodes, acc) {
  if (!Array.isArray(nodes)) return acc || [];
  acc = acc || [];
  for (const n of nodes) {
    if (!n || typeof n !== 'object') continue;
    acc.push({
      id: n.id,
      slug: n.slug,
      name: n.name,
      is_leaf: !!n.is_leaf,
    });
    if (Array.isArray(n.children) && n.children.length) {
      _flattenCategoryTree(n.children, acc);
    }
  }
  return acc;
}

/**
 * Return the cached category tree. If the cache is stale (> 24h) or missing,
 * refresh it from Alpha first. Returns the raw tree as stored (the shape Alpha
 * returns from GET /categories).
 */
async function getCachedCategoryTree({ force = false } = {}) {
  if (!force) {
    const existing = await pool.query(
      `SELECT full_tree_snapshot, refreshed_at
         FROM agri4all_category_cache
        WHERE full_tree_snapshot IS NOT NULL
        ORDER BY refreshed_at DESC NULLS LAST
        LIMIT 1`
    );
    const row = existing.rows[0];
    if (row && row.refreshed_at) {
      const age = Date.now() - new Date(row.refreshed_at).getTime();
      if (age < CATEGORY_CACHE_TTL_MS) {
        return row.full_tree_snapshot;
      }
    }
  }
  return refreshCategoryCache();
}

/**
 * Force a refresh: fetch tree + each leaf's fields, upsert into
 * agri4all_category_cache. Returns the raw tree.
 */
async function refreshCategoryCache() {
  const tree = await getCategories();
  // `tree` from the API can be {data: [...]} or [...]; normalise to array.
  const nodes = Array.isArray(tree) ? tree : (Array.isArray(tree && tree.data) ? tree.data : []);
  const flat = _flattenCategoryTree(nodes);
  const leaves = flat.filter(n => n.is_leaf && n.slug && Number.isInteger(n.id));

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    // Store the full-tree snapshot on a single sentinel row so we can read it
    // back quickly without reconstructing from leaves. Uses slug '__tree__'.
    await client.query(
      `INSERT INTO agri4all_category_cache (slug, agri4all_id, name, fields, full_tree_snapshot, refreshed_at)
       VALUES ('__tree__', 0, '__tree__', '[]'::jsonb, $1::jsonb, NOW())
       ON CONFLICT (slug) DO UPDATE SET
         full_tree_snapshot = EXCLUDED.full_tree_snapshot,
         refreshed_at = NOW()`,
      [JSON.stringify(tree)]
    );

    for (const leaf of leaves) {
      let fields = [];
      try {
        const detail = await getCategoryBySlug(leaf.slug);
        const data = detail && detail.data ? detail.data : detail;
        fields = (data && Array.isArray(data.fields)) ? data.fields : [];
      } catch (e) {
        // Skip field fetch on error — keep the id/slug/name at least.
        fields = [];
      }
      await client.query(
        `INSERT INTO agri4all_category_cache (slug, agri4all_id, name, fields, refreshed_at)
         VALUES ($1, $2, $3, $4::jsonb, NOW())
         ON CONFLICT (slug) DO UPDATE SET
           agri4all_id = EXCLUDED.agri4all_id,
           name = EXCLUDED.name,
           fields = EXCLUDED.fields,
           refreshed_at = NOW()`,
        [leaf.slug, leaf.id, leaf.name || leaf.slug, JSON.stringify(fields)]
      );
    }
    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    throw err;
  } finally {
    client.release();
  }
  return tree;
}

/**
 * Returns the cached fields[] for a leaf category. Triggers a refresh if the
 * cache row is missing OR the row's refreshed_at is older than the TTL.
 */
async function getCategoryFields(slug) {
  if (!slug) return [];
  const row = await pool.query(
    `SELECT fields, refreshed_at FROM agri4all_category_cache WHERE slug = $1`,
    [slug]
  );
  const r = row.rows[0];
  const fresh = r && r.refreshed_at &&
    (Date.now() - new Date(r.refreshed_at).getTime() < CATEGORY_CACHE_TTL_MS);
  if (fresh) return r.fields || [];
  // Stale or missing — refetch this one slug directly; don't do a full tree
  // refresh here (that's driven from getCachedCategoryTree / admin endpoint).
  try {
    const detail = await getCategoryBySlug(slug);
    const data = detail && detail.data ? detail.data : detail;
    const fields = (data && Array.isArray(data.fields)) ? data.fields : [];
    const id = (data && Number.isInteger(data.id)) ? data.id : (r ? (await pool.query(
      `SELECT agri4all_id FROM agri4all_category_cache WHERE slug = $1`, [slug])).rows[0]?.agri4all_id || 0 : 0);
    const name = (data && data.name) || slug;
    await pool.query(
      `INSERT INTO agri4all_category_cache (slug, agri4all_id, name, fields, refreshed_at)
       VALUES ($1, $2, $3, $4::jsonb, NOW())
       ON CONFLICT (slug) DO UPDATE SET
         agri4all_id = EXCLUDED.agri4all_id,
         name = EXCLUDED.name,
         fields = EXCLUDED.fields,
         refreshed_at = NOW()`,
      [slug, id || 0, name, JSON.stringify(fields)]
    );
    return fields;
  } catch (e) {
    return r ? (r.fields || []) : [];
  }
}

/**
 * Post a product to Alpha Agri4All.
 * @param {object} payload - Product payload (will be JSON-stringified as `payload` field)
 * @param {string[]} mediaFilePaths - Absolute paths to media files to attach
 * @param {object} [options] - { idempotencyKey?: string }
 * @returns {Promise<object>} - API response
 */
async function postProduct(payload, mediaFilePaths = [], options = {}) {
  const headers = await _authHeaders();
  if (ALPHA_AGRI4ALL_SELLER_ID) {
    headers['X-On-Behalf-Of'] = ALPHA_AGRI4ALL_SELLER_ID;
  }
  if (options.idempotencyKey) {
    headers['Idempotency-Key'] = options.idempotencyKey;
  }

  const form = new FormData();
  form.append('payload', JSON.stringify(payload));
  for (const filePath of mediaFilePaths) {
    form.append('media[]', fs.createReadStream(filePath), path.basename(filePath));
  }

  const res = await fetch(`${ALPHA_AGRI4ALL_BASE_URL}/api/v1/products`, {
    method: 'POST',
    headers: Object.assign({}, headers, form.getHeaders()),
    body: form,
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw Object.assign(new Error(`Alpha product post failed: ${res.status}`), { body, status: res.status });
  return body;
}

/**
 * Post a product for one country. Thin wrapper around `postProduct` that:
 *  - overrides `payload.location.country` with the provided ISO alpha-2
 *  - applies an idempotency key (required; caller must pass a unique one per
 *    logical operation — deliverable_id + country + body hash is the usual shape)
 *
 * @param {object} payload - Full Alpha payload (location must already be present)
 * @param {string[]} mediaFilePaths
 * @param {string} country - ISO alpha-2, overrides payload.location.country
 * @param {string} idempotencyKey
 */
async function postProductForCountry(payload, mediaFilePaths, country, idempotencyKey) {
  if (!country) throw new Error('postProductForCountry: country (ISO alpha-2) required');
  if (!idempotencyKey) throw new Error('postProductForCountry: idempotencyKey required');
  const localPayload = Object.assign({}, payload, {
    location: Object.assign({}, payload.location || {}, { country }),
  });
  return postProduct(localPayload, mediaFilePaths, { idempotencyKey });
}

// ── Sub-resource helpers (admin edit-proxy endpoints use these) ─────
async function putProduct(slug, payload) {
  const res = await fetch(`${ALPHA_AGRI4ALL_BASE_URL}/api/v1/products/${encodeURIComponent(slug)}`, {
    method: 'PUT',
    headers: await _authHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify(payload),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw Object.assign(new Error(`Alpha product PUT failed: ${res.status}`), { body, status: res.status });
  return body;
}

async function putProductLocation(slug, location) {
  const res = await fetch(`${ALPHA_AGRI4ALL_BASE_URL}/api/v1/products/${encodeURIComponent(slug)}/location`, {
    method: 'PUT',
    headers: await _authHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify(location),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw Object.assign(new Error(`Alpha location PUT failed: ${res.status}`), { body, status: res.status });
  return body;
}

async function putProductContacts(slug, contacts) {
  const res = await fetch(`${ALPHA_AGRI4ALL_BASE_URL}/api/v1/products/${encodeURIComponent(slug)}/contacts`, {
    method: 'PUT',
    headers: await _authHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify({ contacts }),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw Object.assign(new Error(`Alpha contacts PUT failed: ${res.status}`), { body, status: res.status });
  return body;
}

async function postProductMedia(slug, mediaFilePaths) {
  const form = new FormData();
  for (const filePath of mediaFilePaths) {
    form.append('media[]', fs.createReadStream(filePath), path.basename(filePath));
  }
  const res = await fetch(`${ALPHA_AGRI4ALL_BASE_URL}/api/v1/products/${encodeURIComponent(slug)}/media`, {
    method: 'POST',
    headers: Object.assign({}, await _authHeaders(), form.getHeaders()),
    body: form,
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw Object.assign(new Error(`Alpha media POST failed: ${res.status}`), { body, status: res.status });
  return body;
}

async function deleteProductMedia(slug, mediaId) {
  const res = await fetch(
    `${ALPHA_AGRI4ALL_BASE_URL}/api/v1/products/${encodeURIComponent(slug)}/media/${encodeURIComponent(mediaId)}`,
    { method: 'DELETE', headers: await _authHeaders() }
  );
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw Object.assign(new Error(`Alpha media DELETE failed: ${res.status}`), { body, status: res.status });
  return body;
}

module.exports = {
  getAuthToken,
  getCategories,
  getCategoryBySlug,
  getCachedCategoryTree,
  refreshCategoryCache,
  getCategoryFields,
  postProduct,
  postProductForCountry,
  putProduct,
  putProductLocation,
  putProductContacts,
  postProductMedia,
  deleteProductMedia,
};
