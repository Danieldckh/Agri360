/**
 * Adds a nullable client_id link to social_credentials so each connected
 * social account can belong to a specific client. NULL means the account
 * is agency-owned (e.g., used for "Own Social Media" posts).
 */
module.exports = async function (pool) {
  await pool.query(`
    ALTER TABLE social_credentials
    ADD COLUMN IF NOT EXISTS client_id INT REFERENCES clients(id) ON DELETE SET NULL
  `);
  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_social_credentials_client_id
    ON social_credentials(client_id)
  `);
};
