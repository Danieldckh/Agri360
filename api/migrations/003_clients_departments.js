const pool = require('../db');

async function migrate() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Departments
    await client.query(`
      CREATE TABLE IF NOT EXISTS departments (
        id SERIAL PRIMARY KEY,
        name VARCHAR(100) NOT NULL UNIQUE,
        slug VARCHAR(100) NOT NULL UNIQUE,
        description TEXT,
        icon VARCHAR(50),
        color VARCHAR(7),
        display_order INTEGER DEFAULT 0,
        is_active BOOLEAN DEFAULT TRUE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Clients
    await client.query(`
      CREATE TABLE IF NOT EXISTS clients (
        id SERIAL PRIMARY KEY,
        name VARCHAR(200) NOT NULL,
        contact_person VARCHAR(200),
        email VARCHAR(255),
        phone VARCHAR(50),
        address TEXT,
        notes TEXT,
        status VARCHAR(20) DEFAULT 'active',
        created_by INTEGER REFERENCES employees(id),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Booking forms
    await client.query(`
      CREATE TABLE IF NOT EXISTS booking_forms (
        id SERIAL PRIMARY KEY,
        client_id INTEGER NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
        title VARCHAR(255) NOT NULL,
        description TEXT,
        status VARCHAR(30) DEFAULT 'draft',
        booked_date DATE,
        due_date DATE,
        created_by INTEGER REFERENCES employees(id),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Deliverables
    await client.query(`
      CREATE TABLE IF NOT EXISTS deliverables (
        id SERIAL PRIMARY KEY,
        booking_form_id INTEGER NOT NULL REFERENCES booking_forms(id) ON DELETE CASCADE,
        department_id INTEGER NOT NULL REFERENCES departments(id),
        type VARCHAR(100) NOT NULL,
        title VARCHAR(255) NOT NULL,
        description TEXT,
        status VARCHAR(30) DEFAULT 'pending',
        assigned_to INTEGER REFERENCES employees(id),
        due_date DATE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Dashboards
    await client.query(`
      CREATE TABLE IF NOT EXISTS dashboards (
        id SERIAL PRIMARY KEY,
        deliverable_id INTEGER REFERENCES deliverables(id) ON DELETE CASCADE,
        department_id INTEGER NOT NULL REFERENCES departments(id),
        deliverable_type VARCHAR(100) NOT NULL,
        title VARCHAR(255) NOT NULL,
        config JSONB DEFAULT '{}',
        status VARCHAR(30) DEFAULT 'active',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Financials
    await client.query(`
      CREATE TABLE IF NOT EXISTS financials (
        id SERIAL PRIMARY KEY,
        client_id INTEGER NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
        type VARCHAR(30) NOT NULL,
        description TEXT,
        amount DECIMAL(12,2) NOT NULL,
        currency VARCHAR(3) DEFAULT 'ZAR',
        invoice_number VARCHAR(100),
        invoice_date DATE,
        due_date DATE,
        status VARCHAR(30) DEFAULT 'pending',
        created_by INTEGER REFERENCES employees(id),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);


    // Indexes
    await client.query(`CREATE INDEX IF NOT EXISTS idx_booking_forms_client_id ON booking_forms(client_id)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_deliverables_booking_form_id ON deliverables(booking_form_id)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_deliverables_department_id ON deliverables(department_id)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_deliverables_assigned_to ON deliverables(assigned_to)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_dashboards_deliverable_id ON dashboards(deliverable_id)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_dashboards_department_id ON dashboards(department_id)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_dashboards_dept_type ON dashboards(department_id, deliverable_type)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_financials_client_id ON financials(client_id)`);

    // Seed data — departments
    await client.query(`
      INSERT INTO departments (name, slug, display_order)
      VALUES
        ('Production', 'production', 1),
        ('Design', 'design', 2),
        ('Editorial', 'editorial', 3),
        ('Video', 'video', 4),
        ('Agri4All', 'agri4all', 5),
        ('Social Media', 'social-media', 6)
      ON CONFLICT DO NOTHING
    `);

    await client.query('COMMIT');
    console.log('Migration 003_clients_departments complete.');
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
