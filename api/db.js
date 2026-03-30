const { Pool } = require('pg');
const { DB } = require('./config');

const pool = new Pool(DB);

async function runMigrations() {
  // Client columns for checklist feature
  await pool.query(`ALTER TABLE clients ADD COLUMN IF NOT EXISTS trading_name VARCHAR(255);`);
  await pool.query(`ALTER TABLE clients ADD COLUMN IF NOT EXISTS company_reg_no VARCHAR(50);`);
  await pool.query(`ALTER TABLE clients ADD COLUMN IF NOT EXISTS vat_number VARCHAR(20);`);
  await pool.query(`ALTER TABLE clients ADD COLUMN IF NOT EXISTS website VARCHAR(500);`);
  await pool.query(`ALTER TABLE clients ADD COLUMN IF NOT EXISTS industry_expertise VARCHAR(255);`);
  await pool.query(`ALTER TABLE clients ADD COLUMN IF NOT EXISTS physical_address TEXT;`);
  await pool.query(`ALTER TABLE clients ADD COLUMN IF NOT EXISTS physical_postal_code VARCHAR(10);`);
  await pool.query(`ALTER TABLE clients ADD COLUMN IF NOT EXISTS postal_address TEXT;`);
  await pool.query(`ALTER TABLE clients ADD COLUMN IF NOT EXISTS postal_code VARCHAR(10);`);
  await pool.query(`ALTER TABLE clients ADD COLUMN IF NOT EXISTS primary_contact JSONB;`);
  await pool.query(`ALTER TABLE clients ADD COLUMN IF NOT EXISTS material_contact JSONB;`);
  await pool.query(`ALTER TABLE clients ADD COLUMN IF NOT EXISTS accounts_contact JSONB;`);

  // Booking form columns for checklist feature
  await pool.query(`ALTER TABLE booking_forms ADD COLUMN IF NOT EXISTS campaign_month_start VARCHAR(7);`);
  await pool.query(`ALTER TABLE booking_forms ADD COLUMN IF NOT EXISTS campaign_month_end VARCHAR(7);`);
  await pool.query(`ALTER TABLE booking_forms ADD COLUMN IF NOT EXISTS form_data JSONB;`);
  await pool.query(`ALTER TABLE booking_forms ADD COLUMN IF NOT EXISTS sign_off_date DATE;`);
  await pool.query(`ALTER TABLE booking_forms ADD COLUMN IF NOT EXISTS representative VARCHAR(255);`);

  // Deliverables columns for follow-up tracking
  await pool.query(`ALTER TABLE deliverables ADD COLUMN IF NOT EXISTS follow_up_count INTEGER DEFAULT 0;`);

  // Drop NOT NULL constraint on existing title column
  await pool.query(`ALTER TABLE booking_forms ALTER COLUMN title DROP NOT NULL;`);
}

runMigrations()
  .then(() => console.log('Checklist migrations applied successfully'))
  .catch(err => console.error('Migration failed:', err));

module.exports = pool;
