const { Pool } = require('pg');
const { DB } = require('./config');

const pool = new Pool(DB);

pool.on('error', (err) => {
  console.error('Unexpected pool error:', err.message);
});

async function runMigrations() {
  // Wait for DB to be ready
  for (let i = 0; i < 10; i++) {
    try {
      await pool.query('SELECT 1');
      break;
    } catch (err) {
      console.log('Waiting for database... attempt ' + (i + 1));
      await new Promise(r => setTimeout(r, 3000));
    }
  }
  const client = await pool.connect();
  try {
    // Create base tables if they don't exist
    await client.query(`CREATE TABLE IF NOT EXISTS employees (
      id SERIAL PRIMARY KEY, first_name VARCHAR(100), last_name VARCHAR(100),
      username VARCHAR(100) UNIQUE, email VARCHAR(255), phone VARCHAR(50),
      role VARCHAR(50) DEFAULT 'employee', status VARCHAR(20) DEFAULT 'active',
      password_hash TEXT, photo_url TEXT, created_at TIMESTAMPTZ DEFAULT NOW(), updated_at TIMESTAMPTZ DEFAULT NOW()
    )`);
    await client.query(`CREATE TABLE IF NOT EXISTS channels (
      id SERIAL PRIMARY KEY, name VARCHAR(255), description TEXT, emoji VARCHAR(10),
      icon TEXT, type VARCHAR(20) DEFAULT 'channel', parent_id INT REFERENCES channels(id) ON DELETE CASCADE,
      created_by INT REFERENCES employees(id), created_at TIMESTAMPTZ DEFAULT NOW(), updated_at TIMESTAMPTZ DEFAULT NOW()
    )`);
    await client.query(`CREATE TABLE IF NOT EXISTS channel_members (
      id SERIAL PRIMARY KEY, channel_id INT REFERENCES channels(id) ON DELETE CASCADE,
      employee_id INT REFERENCES employees(id) ON DELETE CASCADE, role VARCHAR(20) DEFAULT 'member',
      last_read_at TIMESTAMPTZ DEFAULT NOW(), created_at TIMESTAMPTZ DEFAULT NOW(),
      UNIQUE(channel_id, employee_id)
    )`);
    await client.query(`CREATE TABLE IF NOT EXISTS messages (
      id SERIAL PRIMARY KEY, channel_id INT REFERENCES channels(id) ON DELETE CASCADE,
      sender_id INT REFERENCES employees(id), content TEXT, parent_message_id INT REFERENCES messages(id) ON DELETE SET NULL,
      is_deleted BOOLEAN DEFAULT FALSE, is_pinned BOOLEAN DEFAULT FALSE,
      status VARCHAR(20) DEFAULT 'sent',
      created_at TIMESTAMPTZ DEFAULT NOW(), updated_at TIMESTAMPTZ DEFAULT NOW()
    )`);
    await client.query(`CREATE TABLE IF NOT EXISTS message_mentions (
      id SERIAL PRIMARY KEY, message_id INT REFERENCES messages(id) ON DELETE CASCADE,
      employee_id INT REFERENCES employees(id) ON DELETE CASCADE, created_at TIMESTAMPTZ DEFAULT NOW()
    )`);
    await client.query(`CREATE TABLE IF NOT EXISTS message_attachments (
      id SERIAL PRIMARY KEY, message_id INT REFERENCES messages(id) ON DELETE CASCADE,
      filename TEXT NOT NULL, original_name TEXT, file_size INT, mime_type VARCHAR(255),
      created_at TIMESTAMPTZ DEFAULT NOW()
    )`);
    await client.query(`CREATE TABLE IF NOT EXISTS message_stars (
      id SERIAL PRIMARY KEY, message_id INT REFERENCES messages(id) ON DELETE CASCADE,
      employee_id INT REFERENCES employees(id) ON DELETE CASCADE, created_at TIMESTAMPTZ DEFAULT NOW(),
      UNIQUE(message_id, employee_id)
    )`);
    await client.query(`CREATE TABLE IF NOT EXISTS notifications (
      id SERIAL PRIMARY KEY, employee_id INT REFERENCES employees(id) ON DELETE CASCADE,
      type VARCHAR(50), title TEXT, body TEXT, reference_type VARCHAR(50), reference_id INT,
      is_read BOOLEAN DEFAULT FALSE, created_at TIMESTAMPTZ DEFAULT NOW()
    )`);
    await client.query(`CREATE TABLE IF NOT EXISTS message_folders (
      id SERIAL PRIMARY KEY, employee_id INT REFERENCES employees(id) ON DELETE CASCADE,
      name VARCHAR(255) NOT NULL, color VARCHAR(7), icon VARCHAR(50),
      created_at TIMESTAMPTZ DEFAULT NOW(), updated_at TIMESTAMPTZ DEFAULT NOW()
    )`);
    await client.query(`CREATE TABLE IF NOT EXISTS message_folder_items (
      id SERIAL PRIMARY KEY, folder_id INT REFERENCES message_folders(id) ON DELETE CASCADE,
      message_id INT REFERENCES messages(id) ON DELETE CASCADE, created_at TIMESTAMPTZ DEFAULT NOW(),
      UNIQUE(folder_id, message_id)
    )`);
    await client.query(`CREATE TABLE IF NOT EXISTS clients (
      id SERIAL PRIMARY KEY, name VARCHAR(255) NOT NULL, contact_person VARCHAR(255),
      email VARCHAR(255), phone VARCHAR(50), address TEXT, notes TEXT,
      status VARCHAR(20) DEFAULT 'active', created_by INT REFERENCES employees(id),
      created_at TIMESTAMPTZ DEFAULT NOW(), updated_at TIMESTAMPTZ DEFAULT NOW()
    )`);
    await client.query(`CREATE TABLE IF NOT EXISTS booking_forms (
      id SERIAL PRIMARY KEY, client_id INT REFERENCES clients(id) ON DELETE CASCADE,
      title VARCHAR(255), description TEXT, status VARCHAR(20) DEFAULT 'draft',
      booked_date DATE, due_date DATE, created_by INT REFERENCES employees(id),
      created_at TIMESTAMPTZ DEFAULT NOW(), updated_at TIMESTAMPTZ DEFAULT NOW()
    )`);
    await client.query(`CREATE TABLE IF NOT EXISTS departments (
      id SERIAL PRIMARY KEY, name VARCHAR(100) NOT NULL UNIQUE, description TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW(), updated_at TIMESTAMPTZ DEFAULT NOW()
    )`);
    await client.query(`CREATE TABLE IF NOT EXISTS deliverables (
      id SERIAL PRIMARY KEY, booking_form_id INT REFERENCES booking_forms(id) ON DELETE CASCADE,
      department_id INT REFERENCES departments(id), type VARCHAR(100), title VARCHAR(255),
      description TEXT, status VARCHAR(50) DEFAULT 'pending', assigned_to INT REFERENCES employees(id),
      due_date DATE, created_at TIMESTAMPTZ DEFAULT NOW(), updated_at TIMESTAMPTZ DEFAULT NOW()
    )`);
    await client.query(`CREATE TABLE IF NOT EXISTS dashboards (
      id SERIAL PRIMARY KEY, title VARCHAR(255) NOT NULL,
      deliverable_id INT REFERENCES deliverables(id) ON DELETE CASCADE,
      department_id INT REFERENCES departments(id),
      deliverable_type VARCHAR(100) NOT NULL, config JSONB, status VARCHAR(20) DEFAULT 'active',
      created_at TIMESTAMPTZ DEFAULT NOW(), updated_at TIMESTAMPTZ DEFAULT NOW()
    )`);
    await client.query(`CREATE TABLE IF NOT EXISTS financials (
      id SERIAL PRIMARY KEY, booking_form_id INT REFERENCES booking_forms(id) ON DELETE CASCADE,
      type VARCHAR(50), amount DECIMAL(12,2), currency VARCHAR(3) DEFAULT 'ZAR',
      description TEXT, created_at TIMESTAMPTZ DEFAULT NOW()
    )`);

    // Departments slug column
    await client.query(`ALTER TABLE departments ADD COLUMN IF NOT EXISTS slug VARCHAR(100)`);

    // Seed departments
    var deptCheck = await client.query(`SELECT COUNT(*) FROM departments`);
    if (parseInt(deptCheck.rows[0].count) === 0) {
      await client.query(`INSERT INTO departments (name, slug) VALUES
        ('Admin', 'admin'),
        ('Production', 'production'),
        ('Design', 'design'),
        ('Editorial', 'editorial'),
        ('Video', 'video'),
        ('Agri4All', 'agri4all'),
        ('Social Media', 'social-media')
      `);
    }

    // Booking form checklist_id for upsert
    await client.query(`ALTER TABLE booking_forms ADD COLUMN IF NOT EXISTS checklist_id VARCHAR(20) UNIQUE`);

    // Messages status column
    await client.query(`ALTER TABLE messages ADD COLUMN IF NOT EXISTS status VARCHAR(20) DEFAULT 'sent'`);

    // Checklist-Agri360 columns
    await client.query(`ALTER TABLE clients ADD COLUMN IF NOT EXISTS trading_name VARCHAR(255)`);
    await client.query(`ALTER TABLE clients ADD COLUMN IF NOT EXISTS company_reg_no VARCHAR(50)`);
    await client.query(`ALTER TABLE clients ADD COLUMN IF NOT EXISTS vat_number VARCHAR(20)`);
    await client.query(`ALTER TABLE clients ADD COLUMN IF NOT EXISTS website VARCHAR(500)`);
    await client.query(`ALTER TABLE clients ADD COLUMN IF NOT EXISTS industry_expertise VARCHAR(255)`);
    await client.query(`ALTER TABLE clients ADD COLUMN IF NOT EXISTS physical_address TEXT`);
    await client.query(`ALTER TABLE clients ADD COLUMN IF NOT EXISTS physical_postal_code VARCHAR(10)`);
    await client.query(`ALTER TABLE clients ADD COLUMN IF NOT EXISTS postal_address TEXT`);
    await client.query(`ALTER TABLE clients ADD COLUMN IF NOT EXISTS postal_code VARCHAR(10)`);
    await client.query(`ALTER TABLE clients ADD COLUMN IF NOT EXISTS primary_contact JSONB`);
    await client.query(`ALTER TABLE clients ADD COLUMN IF NOT EXISTS material_contact JSONB`);
    await client.query(`ALTER TABLE clients ADD COLUMN IF NOT EXISTS accounts_contact JSONB`);
    await client.query(`ALTER TABLE booking_forms ADD COLUMN IF NOT EXISTS campaign_month_start VARCHAR(7)`);
    await client.query(`ALTER TABLE booking_forms ADD COLUMN IF NOT EXISTS campaign_month_end VARCHAR(7)`);
    await client.query(`ALTER TABLE booking_forms ADD COLUMN IF NOT EXISTS form_data JSONB`);
    await client.query(`ALTER TABLE booking_forms ADD COLUMN IF NOT EXISTS sign_off_date DATE`);
    await client.query(`ALTER TABLE booking_forms ADD COLUMN IF NOT EXISTS representative VARCHAR(255)`);
    await client.query(`ALTER TABLE booking_forms ALTER COLUMN title DROP NOT NULL`);

    // Department workflow routing column
    await client.query(`ALTER TABLE booking_forms ADD COLUMN IF NOT EXISTS department VARCHAR(100) DEFAULT 'admin-proposals'`);
    await client.query(`UPDATE booking_forms SET department = 'admin-proposals' WHERE department IS NULL`);

    // Decline reason for proposals/booking forms
    await client.query(`ALTER TABLE booking_forms ADD COLUMN IF NOT EXISTS decline_reason TEXT`);

    // Admin assignment for proposals
    await client.query(`ALTER TABLE booking_forms ADD COLUMN IF NOT EXISTS assigned_admin INT REFERENCES employees(id)`);

    // Editable and e-sign URLs
    await client.query(`ALTER TABLE booking_forms ADD COLUMN IF NOT EXISTS editable_url TEXT`);
    await client.query(`ALTER TABLE booking_forms ADD COLUMN IF NOT EXISTS esign_url TEXT`);
    await client.query(`ALTER TABLE booking_forms ADD COLUMN IF NOT EXISTS checklist_url TEXT`);

    // E-sign data
    await client.query(`ALTER TABLE booking_forms ADD COLUMN IF NOT EXISTS signed_pdf TEXT`);
    await client.query(`ALTER TABLE booking_forms ADD COLUMN IF NOT EXISTS signature_data JSONB`);
    await client.query(`ALTER TABLE booking_forms ADD COLUMN IF NOT EXISTS signed_at TIMESTAMPTZ`);
    await client.query(`ALTER TABLE booking_forms ADD COLUMN IF NOT EXISTS change_request_pdf TEXT`);
    await client.query(`ALTER TABLE booking_forms ADD COLUMN IF NOT EXISTS change_notes TEXT`);

    // Make dashboard foreign keys nullable
    await client.query(`ALTER TABLE dashboards ALTER COLUMN deliverable_id DROP NOT NULL`).catch(() => {});
    await client.query(`ALTER TABLE dashboards ALTER COLUMN department_id DROP NOT NULL`).catch(() => {});

    // Deliverables: delivery month for per-month grouping
    await client.query(`ALTER TABLE deliverables ADD COLUMN IF NOT EXISTS delivery_month VARCHAR(7)`);
    await client.query(`ALTER TABLE deliverables ADD COLUMN IF NOT EXISTS client_id INT REFERENCES clients(id)`);

    // Deliverables columns for follow-up tracking
    await client.query(`ALTER TABLE deliverables ADD COLUMN IF NOT EXISTS follow_up_count INTEGER DEFAULT 0`);
    await client.query(`ALTER TABLE deliverables ADD COLUMN IF NOT EXISTS status_changed_at TIMESTAMPTZ`);
    await client.query(`UPDATE deliverables SET status_changed_at = updated_at WHERE status_changed_at IS NULL`);

    // Deliverables: JSONB metadata for type-specific data (platforms, posts count, etc.)
    await client.query(`ALTER TABLE deliverables ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}'`);

    // Widen status columns — many statuses exceed VARCHAR(20)
    await client.query(`ALTER TABLE deliverables ALTER COLUMN status TYPE VARCHAR(50)`);
    await client.query(`ALTER TABLE booking_forms ALTER COLUMN status TYPE VARCHAR(50)`);

    // Department-specific assignment columns
    const deptAssignedCols = ['assigned_admin', 'assigned_production', 'assigned_design',
      'assigned_editorial', 'assigned_video', 'assigned_agri4all', 'assigned_social_media'];
    for (const col of deptAssignedCols) {
      await client.query(`ALTER TABLE deliverables ADD COLUMN IF NOT EXISTS ${col} INT REFERENCES employees(id)`);
    }

    // Change request counter per deliverable (3 max enforced at API level)
    await client.query(`ALTER TABLE deliverables ADD COLUMN IF NOT EXISTS change_request_count INTEGER DEFAULT 0`);

    // Client Portal Tokens — public access for clients
    await client.query(`CREATE TABLE IF NOT EXISTS client_portal_tokens (
      id SERIAL PRIMARY KEY,
      client_id INT REFERENCES clients(id) ON DELETE CASCADE,
      token VARCHAR(64) UNIQUE NOT NULL,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      last_accessed_at TIMESTAMPTZ
    )`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_client_portal_token ON client_portal_tokens(token)`);

    // Request Forms — built by production, completed by client
    await client.query(`CREATE TABLE IF NOT EXISTS request_forms (
      id SERIAL PRIMARY KEY,
      token VARCHAR(64) UNIQUE NOT NULL,
      client_id INT REFERENCES clients(id) ON DELETE CASCADE,
      deliverable_id INT REFERENCES deliverables(id) ON DELETE SET NULL,
      name VARCHAR(255),
      fields JSONB DEFAULT '[]',
      responses JSONB DEFAULT '{}',
      status VARCHAR(20) DEFAULT 'draft',
      created_by INT REFERENCES employees(id),
      created_at TIMESTAMPTZ DEFAULT NOW(),
      completed_at TIMESTAMPTZ
    )`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_request_forms_token ON request_forms(token)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_request_forms_client ON request_forms(client_id)`);

    // Request Form Templates — reusable form structures
    await client.query(`CREATE TABLE IF NOT EXISTS request_form_templates (
      id SERIAL PRIMARY KEY,
      name VARCHAR(255) NOT NULL,
      fields JSONB DEFAULT '[]',
      created_by INT REFERENCES employees(id),
      created_at TIMESTAMPTZ DEFAULT NOW()
    )`);

    // Seed admin employee
    const empCheck = await client.query(`SELECT COUNT(*) FROM employees`);
    if (parseInt(empCheck.rows[0].count) === 0) {
      await client.query(`INSERT INTO employees (id, first_name, last_name, username, email, role, status)
        VALUES (1, 'Admin', 'User', 'admin', 'admin@agri360.co.za', 'admin', 'active')`);
      await client.query(`SELECT setval('employees_id_seq', 1)`);
    }

    // Seed dashboards
    const existing = await client.query(`SELECT COUNT(*) FROM dashboards`);
    if (parseInt(existing.rows[0].count) === 0) {
      await client.query(`INSERT INTO dashboards (title, deliverable_type, config, status) VALUES
        ('Content Calendar', 'content-calendar', '{}', 'active'),
        ('Own Social Media-Posts (Design Department)', 'own-social-media', '{}', 'active'),
        ('Agri4All-Posts', 'agri4all-posts', '{}', 'active')
      `);
    }

    console.log('All migrations applied successfully');
  } catch (err) {
    console.error('Migration error:', err.message);
  } finally {
    try { client.release(); } catch (e) {}
  }
}

runMigrations().catch(err => console.error('Migration startup error:', err.message));

module.exports = pool;
