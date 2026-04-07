/**
 * Adds append-only booking_form_revisions table and
 * booking_form_esign_tokens table for the Booking Form Esign app.
 *
 * The revisions table stores an immutable copy of every sign /
 * change-request event — the rows are never updated or deleted, so the
 * table serves as the legal paper trail. Callers (the Booking Form Esign
 * app, which shares this Postgres instance directly) append one row per
 * client action.
 *
 * The esign_tokens table provides tokenized one-per-session URLs so a
 * client can open their booking form without logging in.
 */
module.exports = async function (pool) {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS booking_form_revisions (
      id SERIAL PRIMARY KEY,
      booking_form_id INT NOT NULL REFERENCES booking_forms(id) ON DELETE CASCADE,
      action VARCHAR(32) NOT NULL,
      html_snapshot TEXT,
      pdf_base64 TEXT,
      signer_name VARCHAR(255),
      signer_email VARCHAR(255),
      signature_data JSONB,
      change_notes TEXT,
      client_ip VARCHAR(64),
      user_agent TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_booking_form_revisions_bf ON booking_form_revisions(booking_form_id)`);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_booking_form_revisions_action ON booking_form_revisions(action)`);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS booking_form_esign_tokens (
      id SERIAL PRIMARY KEY,
      booking_form_id INT NOT NULL REFERENCES booking_forms(id) ON DELETE CASCADE,
      token VARCHAR(64) UNIQUE NOT NULL,
      html_snapshot TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      expires_at TIMESTAMPTZ,
      last_accessed_at TIMESTAMPTZ
    )
  `);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_booking_form_esign_token ON booking_form_esign_tokens(token)`);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_booking_form_esign_bf ON booking_form_esign_tokens(booking_form_id)`);
};
