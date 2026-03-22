const pool = require('../db');

async function migrate() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    await client.query(`
      CREATE TABLE IF NOT EXISTS message_folders (
          id SERIAL PRIMARY KEY,
          name VARCHAR(200) NOT NULL,
          emoji VARCHAR(10),
          icon VARCHAR(50),
          employee_id INTEGER NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
          sort_order INTEGER DEFAULT 0,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS message_folder_items (
          id SERIAL PRIMARY KEY,
          folder_id INTEGER NOT NULL REFERENCES message_folders(id) ON DELETE CASCADE,
          channel_id INTEGER REFERENCES channels(id) ON DELETE CASCADE,
          message_id INTEGER REFERENCES messages(id) ON DELETE CASCADE,
          added_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await client.query(`CREATE INDEX IF NOT EXISTS idx_message_folders_employee ON message_folders(employee_id)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_folder_items_folder ON message_folder_items(folder_id)`);

    await client.query('COMMIT');
    console.log('Migration 002_custom_folders complete.');
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
