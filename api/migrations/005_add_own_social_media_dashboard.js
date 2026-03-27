const pool = require('../db');

async function migrate() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    await client.query(`
      INSERT INTO dashboards (title, deliverable_id, department_id, deliverable_type, config, status)
      VALUES ('Own Social Media-Posts (Design Department)', NULL, NULL, 'own-social-media', '{}', 'active')
    `);

    await client.query('COMMIT');
    console.log('Migration 005_add_own_social_media_dashboard complete.');
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
