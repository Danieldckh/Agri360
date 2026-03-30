const pool = require('../db');

async function up() {
  const cols = [
    'assigned_admin',
    'assigned_production',
    'assigned_design',
    'assigned_editorial',
    'assigned_video',
    'assigned_agri4all',
    'assigned_social_media'
  ];
  for (const col of cols) {
    await pool.query(`ALTER TABLE deliverables ADD COLUMN IF NOT EXISTS ${col} INT REFERENCES employees(id)`);
  }
}

module.exports = { up };
