const pool = require('../db');

async function up() {
  await pool.query(`ALTER TABLE deliverables ADD COLUMN IF NOT EXISTS delivery_month VARCHAR(7)`);
  await pool.query(`ALTER TABLE deliverables ADD COLUMN IF NOT EXISTS client_id INT REFERENCES clients(id)`);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_deliverables_delivery_month ON deliverables(delivery_month)`);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_deliverables_client_id ON deliverables(client_id)`);
  console.log('Migration 009_delivery_month complete.');
}

module.exports = { up };
