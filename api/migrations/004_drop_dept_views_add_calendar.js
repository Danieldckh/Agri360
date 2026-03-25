const pool = require('../db');

async function migrate() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Drop department_views table
    await client.query('DROP TABLE IF EXISTS department_views');

    // Make deliverable_id and department_id nullable so dashboards can exist independently
    await client.query('ALTER TABLE dashboards ALTER COLUMN deliverable_id DROP NOT NULL');
    await client.query('ALTER TABLE dashboards ALTER COLUMN department_id DROP NOT NULL');

    // Seed a single Content Calendar dashboard
    await client.query(`
      INSERT INTO dashboards (title, deliverable_id, department_id, deliverable_type, config, status)
      VALUES ('Content Calendar', NULL, NULL, 'content-calendar', '{}', 'active')
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
