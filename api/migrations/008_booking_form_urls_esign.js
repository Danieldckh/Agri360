const pool = require('../db');

async function up() {
  // Editable and e-sign URLs
  await pool.query(`ALTER TABLE booking_forms ADD COLUMN IF NOT EXISTS editable_url TEXT`);
  await pool.query(`ALTER TABLE booking_forms ADD COLUMN IF NOT EXISTS esign_url TEXT`);
  await pool.query(`ALTER TABLE booking_forms ADD COLUMN IF NOT EXISTS checklist_url TEXT`);

  // E-sign data
  await pool.query(`ALTER TABLE booking_forms ADD COLUMN IF NOT EXISTS signed_pdf TEXT`);
  await pool.query(`ALTER TABLE booking_forms ADD COLUMN IF NOT EXISTS signature_data JSONB`);
  await pool.query(`ALTER TABLE booking_forms ADD COLUMN IF NOT EXISTS signed_at TIMESTAMPTZ`);
  await pool.query(`ALTER TABLE booking_forms ADD COLUMN IF NOT EXISTS change_request_pdf TEXT`);
  await pool.query(`ALTER TABLE booking_forms ADD COLUMN IF NOT EXISTS change_notes TEXT`);

  console.log('Migration 008_booking_form_urls_esign complete.');
}

module.exports = { up };
