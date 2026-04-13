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

    // Phase 2 — Client social URL columns
    await client.query(`ALTER TABLE clients ADD COLUMN IF NOT EXISTS instagram VARCHAR(500)`);
    await client.query(`ALTER TABLE clients ADD COLUMN IF NOT EXISTS facebook VARCHAR(500)`);
    await client.query(`ALTER TABLE clients ADD COLUMN IF NOT EXISTS linkedin VARCHAR(500)`);
    await client.query(`ALTER TABLE clients ADD COLUMN IF NOT EXISTS twitter_x VARCHAR(500)`);

    // Phase 2 — Backfill client social URL columns from deliverables.metadata->'platforms'.
    // Idempotent: only updates NULL columns. Safe to re-run.
    try {
      const socialBackfill = await client.query(`
        WITH plats AS (
          SELECT
            d.client_id,
            LOWER(COALESCE(p->>'key', p->>'platform', '')) AS k,
            p->>'link' AS link
          FROM deliverables d
          CROSS JOIN LATERAL jsonb_array_elements(
            COALESCE(d.metadata->'platforms', '[]'::jsonb)
          ) AS p
          WHERE d.client_id IS NOT NULL
            AND (p->>'link') IS NOT NULL
            AND (p->>'link') <> ''
        ),
        ranked AS (
          SELECT
            client_id,
            CASE
              WHEN k IN ('facebook', 'fb') THEN 'facebook'
              WHEN k IN ('instagram', 'ig', 'insta') THEN 'instagram'
              WHEN k IN ('linkedin', 'li') THEN 'linkedin'
              WHEN k IN ('twitter', 'twitter_x', 'x') THEN 'twitter_x'
              ELSE NULL
            END AS col,
            link
          FROM plats
        ),
        pick AS (
          SELECT DISTINCT ON (client_id, col) client_id, col, link
          FROM ranked
          WHERE col IS NOT NULL
        )
        UPDATE clients c SET
          facebook  = COALESCE(c.facebook,  (SELECT link FROM pick WHERE pick.client_id = c.id AND pick.col = 'facebook')),
          instagram = COALESCE(c.instagram, (SELECT link FROM pick WHERE pick.client_id = c.id AND pick.col = 'instagram')),
          linkedin  = COALESCE(c.linkedin,  (SELECT link FROM pick WHERE pick.client_id = c.id AND pick.col = 'linkedin')),
          twitter_x = COALESCE(c.twitter_x, (SELECT link FROM pick WHERE pick.client_id = c.id AND pick.col = 'twitter_x'))
        WHERE (c.facebook  IS NULL AND EXISTS (SELECT 1 FROM pick WHERE pick.client_id = c.id AND pick.col = 'facebook'))
           OR (c.instagram IS NULL AND EXISTS (SELECT 1 FROM pick WHERE pick.client_id = c.id AND pick.col = 'instagram'))
           OR (c.linkedin  IS NULL AND EXISTS (SELECT 1 FROM pick WHERE pick.client_id = c.id AND pick.col = 'linkedin'))
           OR (c.twitter_x IS NULL AND EXISTS (SELECT 1 FROM pick WHERE pick.client_id = c.id AND pick.col = 'twitter_x'))
      `);
      if (socialBackfill.rowCount > 0) {
        console.log('Backfilled social URLs on ' + socialBackfill.rowCount + ' client rows from deliverable metadata');
      }
    } catch (e) {
      console.error('Client social URL backfill error:', e.message);
    }
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

    // Admin and design assignment for proposals
    await client.query(`ALTER TABLE booking_forms ADD COLUMN IF NOT EXISTS assigned_admin INT REFERENCES employees(id)`);
    await client.query(`ALTER TABLE booking_forms ADD COLUMN IF NOT EXISTS assigned_design INT REFERENCES employees(id)`);

    // Editable and e-sign URLs
    await client.query(`ALTER TABLE booking_forms ADD COLUMN IF NOT EXISTS editable_url TEXT`);
    await client.query(`ALTER TABLE booking_forms ADD COLUMN IF NOT EXISTS esign_url TEXT`);
    await client.query(`ALTER TABLE booking_forms ADD COLUMN IF NOT EXISTS checklist_url TEXT`);
    // Design proposal artifact uploaded from Admin > Design Proposals sheet
    await client.query(`ALTER TABLE booking_forms ADD COLUMN IF NOT EXISTS proposal_file_url TEXT`);
    await client.query(`ALTER TABLE booking_forms ADD COLUMN IF NOT EXISTS proposal_file_name TEXT`);
    await client.query(`ALTER TABLE booking_forms ADD COLUMN IF NOT EXISTS proposal_file_mime VARCHAR(255)`);
    await client.query(`ALTER TABLE booking_forms ADD COLUMN IF NOT EXISTS proposal_file_uploaded_at TIMESTAMPTZ`);

    // Manually uploaded booking form files (unsigned + signed)
    await client.query(`ALTER TABLE booking_forms ADD COLUMN IF NOT EXISTS unsigned_file_url TEXT`);
    await client.query(`ALTER TABLE booking_forms ADD COLUMN IF NOT EXISTS signed_file_url TEXT`);

    // E-sign data (latest-state "pointer" columns on booking_forms —
    // the append-only source of truth lives in booking_form_revisions)
    await client.query(`ALTER TABLE booking_forms ADD COLUMN IF NOT EXISTS signed_pdf TEXT`);
    await client.query(`ALTER TABLE booking_forms ADD COLUMN IF NOT EXISTS signature_data JSONB`);
    await client.query(`ALTER TABLE booking_forms ADD COLUMN IF NOT EXISTS signed_at TIMESTAMPTZ`);
    await client.query(`ALTER TABLE booking_forms ADD COLUMN IF NOT EXISTS change_request_pdf TEXT`);
    await client.query(`ALTER TABLE booking_forms ADD COLUMN IF NOT EXISTS change_notes TEXT`);

    // ── E-sign immutable revisions ────────────────────────────────────
    // Every sign / change-request event appends one row. Rows are never
    // updated or deleted — this is the legal paper trail. The Booking
    // Form Esign app (separate repo, shares this Postgres) writes here.
    await client.query(`CREATE TABLE IF NOT EXISTS booking_form_revisions (
      id SERIAL PRIMARY KEY,
      booking_form_id INT NOT NULL REFERENCES booking_forms(id) ON DELETE CASCADE,
      action VARCHAR(32) NOT NULL,
      html_snapshot TEXT,
      pdf_base64 TEXT,
      signer_name VARCHAR(255),
      signer_email VARCHAR(255),
      signature_data JSONB,
      change_notes TEXT,
      client_ip VARCHAR(64),
      user_agent TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_booking_form_revisions_bf ON booking_form_revisions(booking_form_id)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_booking_form_revisions_action ON booking_form_revisions(action)`);

    // ── E-sign tokens ─────────────────────────────────────────────────
    // Tokenized one-per-session URLs used by the Booking Form Esign app.
    // Distinct from client_portal_tokens (which are per-client and
    // persistent) — these are per-booking-form and can expire.
    await client.query(`CREATE TABLE IF NOT EXISTS booking_form_esign_tokens (
      id SERIAL PRIMARY KEY,
      booking_form_id INT NOT NULL REFERENCES booking_forms(id) ON DELETE CASCADE,
      token VARCHAR(64) UNIQUE NOT NULL,
      html_snapshot TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      expires_at TIMESTAMPTZ,
      last_accessed_at TIMESTAMPTZ
    )`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_booking_form_esign_token ON booking_form_esign_tokens(token)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_booking_form_esign_bf ON booking_form_esign_tokens(booking_form_id)`);

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

    // Phase 6 — Per-deliverable chat channel link (one channel per deliverable)
    await client.query(`ALTER TABLE channels ADD COLUMN IF NOT EXISTS deliverable_id INT REFERENCES deliverables(id) ON DELETE SET NULL`);
    await client.query(`CREATE UNIQUE INDEX IF NOT EXISTS channels_deliverable_id_unique_idx ON channels(deliverable_id) WHERE deliverable_id IS NOT NULL`);

    // Phase 6b — Per-booking-form chat channels (messages + change requests)
    await client.query(`ALTER TABLE channels ADD COLUMN IF NOT EXISTS booking_form_id INT REFERENCES booking_forms(id) ON DELETE SET NULL`);
    await client.query(`ALTER TABLE channels ADD COLUMN IF NOT EXISTS channel_purpose VARCHAR(50)`);

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

    // Phase 4 — Client Assets (form uploads, CC post images, designs, videos, banners)
    // Allowed `kind` values (documentation, not enforced):
    // form_upload | cc_post_image | design | video | banner | other
    await client.query(`CREATE TABLE IF NOT EXISTS client_assets (
      id SERIAL PRIMARY KEY,
      client_id INT REFERENCES clients(id) ON DELETE CASCADE,
      deliverable_id INT REFERENCES deliverables(id) ON DELETE SET NULL,
      kind VARCHAR(50) NOT NULL,
      url VARCHAR(1000) NOT NULL,
      thumbnail_url VARCHAR(1000),
      mime_type VARCHAR(100),
      uploaded_by INT REFERENCES employees(id),
      uploaded_at TIMESTAMPTZ DEFAULT NOW()
    )`);
    await client.query(`CREATE INDEX IF NOT EXISTS client_assets_client_kind_idx ON client_assets(client_id, kind)`);

    // Request Form Templates — reusable form structures
    await client.query(`CREATE TABLE IF NOT EXISTS request_form_templates (
      id SERIAL PRIMARY KEY,
      name VARCHAR(255) NOT NULL,
      fields JSONB DEFAULT '[]',
      created_by INT REFERENCES employees(id),
      created_at TIMESTAMPTZ DEFAULT NOW()
    )`);

    // Portal Messages — standalone chat thread between a client (via
    // portal token) and the CRM team. Kept separate from the internal
    // `messages` table to avoid schema churn on employee-centric fields.
    await client.query(`CREATE TABLE IF NOT EXISTS portal_messages (
      id SERIAL PRIMARY KEY,
      client_id INT REFERENCES clients(id) ON DELETE CASCADE,
      sender_type VARCHAR(20) NOT NULL,
      sender_employee_id INT REFERENCES employees(id) ON DELETE SET NULL,
      content TEXT NOT NULL,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_portal_messages_client ON portal_messages(client_id, created_at)`);

    // Social Media Scheduler — scheduled posts for content calendars, agri4all, own SM
    await client.query(`CREATE TABLE IF NOT EXISTS scheduled_posts (
      id SERIAL PRIMARY KEY,
      title VARCHAR(255),
      content TEXT,
      platforms JSONB DEFAULT '[]',
      scheduled_at TIMESTAMPTZ,
      status VARCHAR(20) DEFAULT 'draft',
      source_type VARCHAR(30) NOT NULL,
      source_id INT,
      client_id INT REFERENCES clients(id) ON DELETE SET NULL,
      media_urls JSONB DEFAULT '[]',
      link_url TEXT,
      hashtags TEXT,
      notes TEXT,
      created_by INT REFERENCES employees(id) ON DELETE SET NULL,
      posted_at TIMESTAMPTZ,
      post_error TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    )`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_scheduled_posts_scheduled_at ON scheduled_posts(scheduled_at)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_scheduled_posts_source ON scheduled_posts(source_type)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_scheduled_posts_status ON scheduled_posts(status)`);

    // Social credentials — per-platform account credentials used by the scheduler
    // client_id is nullable: NULL means agency-owned, otherwise the account
    // belongs to that specific client.
    await client.query(`CREATE TABLE IF NOT EXISTS social_credentials (
      id SERIAL PRIMARY KEY,
      platform VARCHAR(30) NOT NULL,
      account_name VARCHAR(255) NOT NULL,
      account_handle VARCHAR(255),
      credentials JSONB DEFAULT '{}',
      is_active BOOLEAN DEFAULT TRUE,
      last_verified_at TIMESTAMPTZ,
      client_id INT REFERENCES clients(id) ON DELETE SET NULL,
      created_by INT REFERENCES employees(id) ON DELETE SET NULL,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    )`);
    // Idempotent ALTER for existing installs that pre-date the client_id column
    await client.query(`ALTER TABLE social_credentials ADD COLUMN IF NOT EXISTS client_id INT REFERENCES clients(id) ON DELETE SET NULL`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_social_credentials_platform ON social_credentials(platform)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_social_credentials_client_id ON social_credentials(client_id)`);

    // OAuth token lifecycle columns on social_credentials
    await client.query(`ALTER TABLE social_credentials ADD COLUMN IF NOT EXISTS refresh_token TEXT`);
    await client.query(`ALTER TABLE social_credentials ADD COLUMN IF NOT EXISTS token_expires_at TIMESTAMPTZ`);
    await client.query(`ALTER TABLE social_credentials ADD COLUMN IF NOT EXISTS oauth_metadata JSONB DEFAULT '{}'`);

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

    // Content Calendar status rename: focus_points → materials (idempotent)
    // Iteration: 2026-04-08. Safe to re-run — UPDATE is a no-op once applied.
    try {
      const ccRename = await client.query(`
        UPDATE deliverables
           SET status = CASE status
             WHEN 'request_focus_points'   THEN 'request_materials'
             WHEN 'focus_points_requested' THEN 'materials_requested'
             WHEN 'focus_points_received'  THEN 'materials_received'
             ELSE status
           END
         WHERE type = 'sm-content-calendar'
           AND status IN ('request_focus_points','focus_points_requested','focus_points_received')
      `);
      if (ccRename.rowCount > 0) {
        console.log('Migrated ' + ccRename.rowCount + ' content-calendar deliverables to new materials_* statuses');
      }
    } catch (e) {
      console.error('Content calendar status rename migration error:', e.message);
    }

    // 2026-04-08 — Content calendar status rename rollback:
    // Per user request, revert to legacy focus_points_* naming for CC chain.
    // Idempotent via the WHERE status IN (...) guard — no-op after first run.
    try {
      const ccRollback = await client.query(`
        UPDATE deliverables
           SET status = CASE status
             WHEN 'request_materials'   THEN 'request_focus_points'
             WHEN 'materials_requested' THEN 'focus_points_requested'
             WHEN 'materials_received'  THEN 'focus_points_received'
             ELSE status
           END
         WHERE type = 'sm-content-calendar'
           AND status IN ('request_materials','materials_requested','materials_received')
      `);
      if (ccRollback.rowCount > 0) {
        console.log('Rolled back ' + ccRollback.rowCount + ' content-calendar statuses to focus_points_*');
      }
    } catch (e) {
      console.error('Content calendar status rename rollback error:', e.message);
    }

    // 2026-04-08 — Content calendar per-post approval status.
    // Content calendar deliverables store individual posts in metadata.posts[].
    // Introduce a per-post `status` field (default 'pending') so the client
    // portal can approve / request changes on a post-by-post basis. Idempotent:
    // only touches posts that don't already have a `status` key.
    try {
      const ccPostStatus = await client.query(`
        UPDATE deliverables
           SET metadata = jsonb_set(
             metadata,
             '{posts}',
             (SELECT jsonb_agg(
                CASE WHEN p ? 'status' THEN p
                     ELSE p || '{"status":"pending"}'::jsonb
                END
              ) FROM jsonb_array_elements(metadata->'posts') p),
             true
           )
         WHERE type = 'sm-content-calendar'
           AND metadata ? 'posts'
           AND jsonb_typeof(metadata->'posts') = 'array'
           AND jsonb_array_length(metadata->'posts') > 0
           AND EXISTS (
             SELECT 1 FROM jsonb_array_elements(metadata->'posts') p
             WHERE NOT (p ? 'status')
           )
      `);
      if (ccPostStatus.rowCount > 0) {
        console.log('Backfilled per-post status=pending on ' + ccPostStatus.rowCount + ' content-calendar deliverables');
      }
    } catch (e) {
      console.error('Content calendar per-post status migration error:', e.message);
    }

    // 2026-04-09 — Agri4all posts per-post-type sections init.
    // agri4all-posts deliverables track uploads/approvals per post type
    // (facebook_posts, instagram_posts, instagram_stories) under
    // metadata.sections[postTypeKey]. This migration ensures each ENABLED
    // post type has a section with the canonical shape
    //   { files:[], status:'pending', change_requests:[], change_request_count:0 }
    // WITHOUT clobbering existing files/change_requests that were written by
    // the pre-existing openA4AMultiSectionDashboard upload flow. Idempotent:
    // preserves whatever is already there via COALESCE on each sub-field,
    // and only defaults status to 'pending' when missing.
    try {
      const a4aRows = await client.query(
        `SELECT id, metadata FROM deliverables
          WHERE type = 'agri4all-posts'
            AND metadata IS NOT NULL`
      );
      const POST_TYPE_KEYS = ['facebook_posts', 'instagram_posts', 'instagram_stories'];
      let a4aUpdated = 0;
      for (const row of a4aRows.rows) {
        let meta = row.metadata || {};
        if (typeof meta === 'string') {
          try { meta = JSON.parse(meta); } catch (e) { meta = {}; }
        }
        const sectionsIn = (meta && typeof meta.sections === 'object' && meta.sections) ? meta.sections : {};
        const sectionsOut = Object.assign({}, sectionsIn);
        let changed = false;
        for (const key of POST_TYPE_KEYS) {
          if (meta[key] !== true) continue; // only enabled types
          const prev = (sectionsOut[key] && typeof sectionsOut[key] === 'object') ? sectionsOut[key] : {};
          const nextFiles = Array.isArray(prev.files) ? prev.files : [];
          const nextCRs = Array.isArray(prev.change_requests) ? prev.change_requests : [];
          const nextStatus = (typeof prev.status === 'string' && prev.status) ? prev.status : 'pending';
          const nextCount = (typeof prev.change_request_count === 'number')
            ? prev.change_request_count
            : nextCRs.length;
          const nextSection = {
            files: nextFiles,
            status: nextStatus,
            change_requests: nextCRs,
            change_request_count: nextCount
          };
          // Detect whether anything actually changed to avoid pointless writes.
          const prevKeys = Object.keys(prev);
          const sameShape = prevKeys.length === 4
            && Array.isArray(prev.files)
            && typeof prev.status === 'string'
            && Array.isArray(prev.change_requests)
            && typeof prev.change_request_count === 'number';
          if (!sameShape) changed = true;
          sectionsOut[key] = nextSection;
        }
        if (!changed && meta.sections && typeof meta.sections === 'object') continue;
        meta.sections = sectionsOut;
        await client.query(
          `UPDATE deliverables SET metadata = $1 WHERE id = $2`,
          [JSON.stringify(meta), row.id]
        );
        a4aUpdated++;
      }
      if (a4aUpdated > 0) {
        console.log('Initialised metadata.sections on ' + a4aUpdated + ' agri4all-posts deliverables');
      }
    } catch (e) {
      console.warn('Agri4all-posts sections init migration error:', e.message);
    }

    // Online Articles: ensure metadata has default fields so the production
    // dashboard rendering doesn't crash on null reads. Idempotent — only sets
    // fields that don't already exist.
    try {
      const oaResult = await client.query(`
        UPDATE deliverables
        SET metadata = jsonb_set(
          jsonb_set(
            jsonb_set(
              jsonb_set(
                jsonb_set(
                  COALESCE(metadata, '{}'::jsonb),
                  '{needs_translation}', COALESCE(metadata->'needs_translation', 'false'::jsonb), true
                ),
                '{amount}', COALESCE(metadata->'amount', '0'::jsonb), true
              ),
              '{curated_amount}', COALESCE(metadata->'curated_amount', '0'::jsonb), true
            ),
            '{platforms}', COALESCE(metadata->'platforms', '[]'::jsonb), true
          ),
          '{article_body}', COALESCE(metadata->'article_body', '""'::jsonb), true
        )
        WHERE type = 'online-articles'
          AND (
            NOT (metadata ? 'needs_translation') OR
            NOT (metadata ? 'amount') OR
            NOT (metadata ? 'curated_amount') OR
            NOT (metadata ? 'platforms') OR
            NOT (metadata ? 'article_body')
          )
      `);
      if (oaResult.rowCount > 0) {
        console.log(`Backfilled online-articles metadata defaults on ${oaResult.rowCount} rows`);
      }
    } catch (e) {
      console.error('Online articles metadata backfill failed:', e.message);
    }

    // Website Design status rename: sitemap/wireframe/prototype → site_map, site_developed → site_development
    try {
      const wdSiteMap = await client.query(`
        UPDATE deliverables
        SET status = 'site_map', updated_at = NOW()
        WHERE type = 'website-design'
          AND status IN ('sitemap', 'wireframe', 'prototype')
      `);
      if (wdSiteMap.rowCount > 0) {
        console.log('Website Design: renamed ' + wdSiteMap.rowCount + ' legacy sitemap/wireframe/prototype → site_map');
      }
      const wdSiteDev = await client.query(`
        UPDATE deliverables
        SET status = 'site_development', updated_at = NOW()
        WHERE type = 'website-design'
          AND status = 'site_developed'
      `);
      if (wdSiteDev.rowCount > 0) {
        console.log('Website Design: renamed ' + wdSiteDev.rowCount + ' legacy site_developed → site_development');
      }
    } catch (e) {
      console.error('Website Design status rename migration error:', e.message);
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
