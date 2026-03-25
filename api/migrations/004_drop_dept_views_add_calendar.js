const pool = require('../db');

async function migrate() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Drop department_views table
    await client.query('DROP TABLE IF EXISTS department_views');

    // Make deliverable_id nullable so dashboards can exist independently
    await client.query('ALTER TABLE dashboards ALTER COLUMN deliverable_id DROP NOT NULL');

    // Seed Content Calendar dashboard (no deliverable, no specific department)
    await client.query(`
      INSERT INTO dashboards (deliverable_id, department_id, deliverable_type, title, config, status)
      SELECT NULL, d.id, 'content-calendar', 'Content Calendar', '{}', 'active'
      FROM departments d
      WHERE d.slug IN ('design', 'editorial', 'social-media')
      ON CONFLICT DO NOTHING
    `);

    await client.query('COMMIT');
    console.log('Migration 004_drop_dept_views_add_calendar complete.');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

migrate()
  .then(() => pool.end())
  .catch((err) => {
    console.error('Migration failed:', err);
    pool.end();
    process.exit(1);
  });
