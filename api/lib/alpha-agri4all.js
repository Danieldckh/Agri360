// Required packages (not in package.json — run: cd api && npm install node-fetch form-data):
//   node-fetch  ^2.x  (CommonJS compatible)
//   form-data   ^4.x
const fetch = require('node-fetch');
const FormData = require('form-data');
const fs = require('fs');
const path = require('path');
const {
  ALPHA_AGRI4ALL_BASE_URL,
  ALPHA_AGRI4ALL_EMAIL,
  ALPHA_AGRI4ALL_PASSWORD,
  ALPHA_AGRI4ALL_SELLER_ID,
} = require('../config');

let _cachedToken = null;
let _tokenExpiry = 0;

async function getAuthToken() {
  if (_cachedToken && Date.now() < _tokenExpiry) return _cachedToken;
  const res = await fetch(`${ALPHA_AGRI4ALL_BASE_URL}/api/v1/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
    body: JSON.stringify({ email: ALPHA_AGRI4ALL_EMAIL, password: ALPHA_AGRI4ALL_PASSWORD, device_name: 'proagri-crm' }),
  });
  if (!res.ok) throw new Error(`Alpha auth failed: ${res.status}`);
  const data = await res.json();
  _cachedToken = data.token || data.data?.token;
  _tokenExpiry = Date.now() + 29 * 24 * 60 * 60 * 1000; // 29 days
  return _cachedToken;
}

async function getCategories() {
  const token = await getAuthToken();
  const res = await fetch(`${ALPHA_AGRI4ALL_BASE_URL}/api/v1/categories`, {
    headers: { 'Authorization': `Bearer ${token}`, 'Accept': 'application/json' },
  });
  if (!res.ok) throw new Error(`Failed to fetch categories: ${res.status}`);
  return res.json();
}

/**
 * Post a product to Alpha Agri4All.
 * @param {object} payload - Product payload (will be JSON-stringified as `payload` field)
 * @param {string[]} mediaFilePaths - Absolute paths to media files to attach
 * @returns {Promise<object>} - API response
 */
async function postProduct(payload, mediaFilePaths = []) {
  const token = await getAuthToken();
  const headers = {
    'Authorization': `Bearer ${token}`,
    'Accept': 'application/json',
  };
  if (ALPHA_AGRI4ALL_SELLER_ID) {
    headers['X-On-Behalf-Of'] = ALPHA_AGRI4ALL_SELLER_ID;
  }

  const form = new FormData();
  form.append('payload', JSON.stringify(payload));
  for (const filePath of mediaFilePaths) {
    form.append('media[]', fs.createReadStream(filePath), path.basename(filePath));
  }

  const res = await fetch(`${ALPHA_AGRI4ALL_BASE_URL}/api/v1/products`, {
    method: 'POST',
    headers: { ...headers, ...form.getHeaders() },
    body: form,
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw Object.assign(new Error(`Alpha product post failed: ${res.status}`), { body });
  return body;
}

module.exports = { getAuthToken, getCategories, postProduct };
