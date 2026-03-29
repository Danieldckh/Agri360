const pool = require('../db');

async function up() {
  await pool.query(`ALTER TABLE booking_forms ADD COLUMN IF NOT EXISTS department VARCHAR(100) DEFAULT 'admin-proposals'`);
  await pool.query(`UPDATE booking_forms SET department = 'admin-proposals' WHERE department IS NULL`);
}

module.exports = { up };
