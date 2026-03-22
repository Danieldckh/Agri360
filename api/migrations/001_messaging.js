const pool = require('../db');

async function migrate() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Channels
    await client.query(`
      CREATE TABLE IF NOT EXISTS channels (
        id SERIAL PRIMARY KEY,
        name VARCHAR(200),
        description TEXT,
        type VARCHAR(20) NOT NULL DEFAULT 'channel',
        emoji VARCHAR(10),
        icon VARCHAR(50),
        parent_id INTEGER REFERENCES channels(id) ON DELETE CASCADE,
        created_by INTEGER NOT NULL REFERENCES employees(id),
        is_archived BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Channel members
    await client.query(`
      CREATE TABLE IF NOT EXISTS channel_members (
        id SERIAL PRIMARY KEY,
        channel_id INTEGER NOT NULL REFERENCES channels(id) ON DELETE CASCADE,
        employee_id INTEGER NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
        role VARCHAR(20) DEFAULT 'member',
        last_read_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        joined_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(channel_id, employee_id)
      )
    `);

    // Messages
    await client.query(`
      CREATE TABLE IF NOT EXISTS messages (
        id SERIAL PRIMARY KEY,
        channel_id INTEGER NOT NULL REFERENCES channels(id) ON DELETE CASCADE,
        sender_id INTEGER NOT NULL REFERENCES employees(id),
        content TEXT NOT NULL,
        parent_message_id INTEGER REFERENCES messages(id) ON DELETE SET NULL,
        status VARCHAR(20) DEFAULT 'sent',
        is_pinned BOOLEAN DEFAULT FALSE,
        is_deleted BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Message mentions
    await client.query(`
      CREATE TABLE IF NOT EXISTS message_mentions (
        id SERIAL PRIMARY KEY,
        message_id INTEGER NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
        employee_id INTEGER NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
        is_read BOOLEAN DEFAULT FALSE,
        UNIQUE(message_id, employee_id)
      )
    `);

    // Message attachments
    await client.query(`
      CREATE TABLE IF NOT EXISTS message_attachments (
        id SERIAL PRIMARY KEY,
        message_id INTEGER NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
        filename VARCHAR(255) NOT NULL,
        original_name VARCHAR(255) NOT NULL,
        file_size INTEGER NOT NULL,
        mime_type VARCHAR(100) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Message stars
    await client.query(`
      CREATE TABLE IF NOT EXISTS message_stars (
        id SERIAL PRIMARY KEY,
        message_id INTEGER NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
        employee_id INTEGER NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(message_id, employee_id)
      )
    `);

    // Notifications
    await client.query(`
      CREATE TABLE IF NOT EXISTS notifications (
        id SERIAL PRIMARY KEY,
        employee_id INTEGER NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
        type VARCHAR(30) NOT NULL,
        reference_type VARCHAR(30),
        reference_id INTEGER,
        content TEXT,
        is_read BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Indexes
    await client.query(`CREATE INDEX IF NOT EXISTS idx_channels_parent_id ON channels(parent_id)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_channels_created_by ON channels(created_by)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_channels_type ON channels(type)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_channel_members_channel_id ON channel_members(channel_id)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_channel_members_employee_id ON channel_members(employee_id)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_messages_channel_id ON messages(channel_id)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_messages_sender_id ON messages(sender_id)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_messages_parent_message_id ON messages(parent_message_id)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_messages_created_at ON messages(created_at)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_message_mentions_message_id ON message_mentions(message_id)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_message_mentions_employee_id ON message_mentions(employee_id)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_message_attachments_message_id ON message_attachments(message_id)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_message_stars_message_id ON message_stars(message_id)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_message_stars_employee_id ON message_stars(employee_id)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_notifications_employee_id ON notifications(employee_id)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_notifications_is_read ON notifications(is_read)`);

    // Seed data
    // General channel
    const general = await client.query(
      `INSERT INTO channels (name, description, type, emoji, created_by)
       VALUES ('General', 'Company-wide announcements and discussions', 'channel', '💬', 1)
       ON CONFLICT DO NOTHING
       RETURNING id`
    );
    const generalId = general.rows.length ? general.rows[0].id : (await client.query(`SELECT id FROM channels WHERE name='General' AND type='channel' LIMIT 1`)).rows[0]?.id;

    if (generalId) {
      // Add all 6 employees to General
      for (let empId = 1; empId <= 6; empId++) {
        await client.query(
          `INSERT INTO channel_members (channel_id, employee_id, role)
           VALUES ($1, $2, $3)
           ON CONFLICT (channel_id, employee_id) DO NOTHING`,
          [generalId, empId, empId === 1 ? 'owner' : 'member']
        );
      }

      // Test messages in General
      await client.query(
        `INSERT INTO messages (channel_id, sender_id, content) VALUES ($1, 1, 'Welcome to the General channel! This is where we share company-wide updates.')`,
        [generalId]
      );
      await client.query(
        `INSERT INTO messages (channel_id, sender_id, content) VALUES ($1, 2, 'Thanks for setting this up! Looking forward to better team communication.')`,
        [generalId]
      );
      await client.query(
        `INSERT INTO messages (channel_id, sender_id, content) VALUES ($1, 3, 'Quick reminder: crop reports are due by end of week.')`,
        [generalId]
      );
      await client.query(
        `INSERT INTO messages (channel_id, sender_id, content) VALUES ($1, 4, 'Has anyone seen the latest weather forecast? We might need to adjust our irrigation schedule.')`,
        [generalId]
      );
      await client.query(
        `INSERT INTO messages (channel_id, sender_id, content) VALUES ($1, 5, 'I will pull the forecast data and share it here shortly.')`,
        [generalId]
      );
    }

    // Crop Planning channel
    const cropPlanning = await client.query(
      `INSERT INTO channels (name, description, type, emoji, created_by)
       VALUES ('Crop Planning', 'Seasonal crop planning and field management', 'channel', '🌾', 1)
       ON CONFLICT DO NOTHING
       RETURNING id`
    );
    const cropId = cropPlanning.rows.length ? cropPlanning.rows[0].id : null;

    if (cropId) {
      for (const empId of [1, 2, 3]) {
        await client.query(
          `INSERT INTO channel_members (channel_id, employee_id, role)
           VALUES ($1, $2, $3)
           ON CONFLICT (channel_id, employee_id) DO NOTHING`,
          [cropId, empId, empId === 1 ? 'owner' : 'member']
        );
      }
    }

    // Marketing channel
    const marketing = await client.query(
      `INSERT INTO channels (name, description, type, emoji, created_by)
       VALUES ('Marketing', 'Marketing campaigns and brand strategy', 'channel', '📢', 1)
       ON CONFLICT DO NOTHING
       RETURNING id`
    );
    const marketingId = marketing.rows.length ? marketing.rows[0].id : null;

    if (marketingId) {
      for (const empId of [1, 4, 5]) {
        await client.query(
          `INSERT INTO channel_members (channel_id, employee_id, role)
           VALUES ($1, $2, $3)
           ON CONFLICT (channel_id, employee_id) DO NOTHING`,
          [marketingId, empId, empId === 1 ? 'owner' : 'member']
        );
      }

      // Social Media sub-channel
      const socialMedia = await client.query(
        `INSERT INTO channels (name, description, type, emoji, parent_id, created_by)
         VALUES ('Social Media', 'Social media content and scheduling', 'channel', '📱', $1, 1)
         ON CONFLICT DO NOTHING
         RETURNING id`,
        [marketingId]
      );
      const socialId = socialMedia.rows.length ? socialMedia.rows[0].id : null;

      if (socialId) {
        for (const empId of [1, 4, 5]) {
          await client.query(
            `INSERT INTO channel_members (channel_id, employee_id, role)
             VALUES ($1, $2, $3)
             ON CONFLICT (channel_id, employee_id) DO NOTHING`,
            [socialId, empId, empId === 1 ? 'owner' : 'member']
          );
        }
      }
    }

    // DM between employee 1 and 2
    const dm = await client.query(
      `INSERT INTO channels (type, created_by)
       VALUES ('dm', 1)
       ON CONFLICT DO NOTHING
       RETURNING id`
    );
    const dmId = dm.rows.length ? dm.rows[0].id : null;

    if (dmId) {
      await client.query(
        `INSERT INTO channel_members (channel_id, employee_id, role)
         VALUES ($1, $2, 'member')
         ON CONFLICT (channel_id, employee_id) DO NOTHING`,
        [dmId, 1]
      );
      await client.query(
        `INSERT INTO channel_members (channel_id, employee_id, role)
         VALUES ($1, $2, 'member')
         ON CONFLICT (channel_id, employee_id) DO NOTHING`,
        [dmId, 2]
      );
    }

    await client.query('COMMIT');
    console.log('Migration 001_messaging complete.');
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
