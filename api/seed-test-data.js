/**
 * seed-test-data.js
 * Inserts realistic test deliverables across every department tab.
 * Safe to re-run: all client/booking upserts use ON CONFLICT DO NOTHING,
 * and deliverables are inserted only if fewer than 5 exist for that type+status.
 * Run: node api/seed-test-data.js
 */
const pool = require('./db');

const MONTH = new Date().toISOString().substring(0, 7); // e.g. "2026-04"

// ── Test clients ─────────────────────────────────────────────────────
const CLIENTS = [
  { name: 'Agri Solutions SA',    contact: 'Jan van der Berg',   email: 'jan@agrisolutions.co.za' },
  { name: 'GrainCo Exports',      contact: 'Maria Swanepoel',    email: 'maria@grainco.co.za'     },
  { name: 'FarmFresh Produce',    contact: 'Thabo Nkosi',        email: 'thabo@farmfresh.co.za'   },
  { name: 'Boland Dairy Group',   contact: 'Anri Louw',          email: 'anri@bolanddairy.co.za'  },
  { name: 'SA Livestock Markets', contact: 'Piet Erasmus',       email: 'piet@salivstock.co.za'   },
];

// ── Deliverable seed entries ────────────────────────────────────────
// Each entry: { type, title, status, deptSlug, metadata? }
// We'll fan these out across clients/booking forms.
const DELIVERABLES = [
  // ── PRODUCTION (materials tracking + approvals) ──────────────────
  { type: 'sm-content-calendar',   title: 'April CC',                    status: 'request_focus_points',    deptSlug: 'production' },
  { type: 'sm-content-calendar',   title: 'May CC',                      status: 'focus_points_requested',  deptSlug: 'production' },
  { type: 'sm-content-calendar',   title: 'June CC',                     status: 'focus_points_received',   deptSlug: 'production' },
  { type: 'agri4all-posts',         title: 'Agri4All April Bundle',       status: 'request_client_materials',deptSlug: 'production' },
  { type: 'agri4all-posts',         title: 'Agri4All May Bundle',         status: 'materials_requested',     deptSlug: 'production' },
  { type: 'magazine',               title: 'SA Digital — May Edition',    status: 'request_client_materials',deptSlug: 'production' },
  { type: 'magazine',               title: 'Africa Print — June Edition', status: 'materials_requested',     deptSlug: 'production' },
  { type: 'online-articles',        title: 'Planting Season Article',     status: 'request_client_materials',deptSlug: 'production' },
  { type: 'video',                  title: 'Farm Tour Video Brief',        status: 'send_request_form',       deptSlug: 'production' },
  { type: 'website-design',         title: 'New Website Redesign',        status: 'request_client_materials',deptSlug: 'production' },
  // Follow ups (materials_requested)
  { type: 'sm-content-calendar',   title: 'March CC Follow Up',           status: 'materials_requested',     deptSlug: 'production' },
  { type: 'agri4all-posts',         title: 'Q1 Agri Posts Follow Up',     status: 'materials_requested',     deptSlug: 'production' },
  // Approvals (ready_for_approval / sent_for_approval)
  { type: 'sm-content-calendar',   title: 'February CC — Approve',        status: 'ready_for_approval',      deptSlug: 'production' },
  { type: 'agri4all-posts',         title: 'March Agri Bundle — Approve', status: 'ready_for_approval',      deptSlug: 'production' },
  { type: 'sm-content-calendar',   title: 'January CC — Sent',            status: 'sent_for_approval',       deptSlug: 'production' },
  { type: 'magazine',               title: 'April Magazine — Sent',        status: 'sent_for_approval',       deptSlug: 'production' },

  // ── DESIGN ──────────────────────────────────────────────────────
  { type: 'sm-content-calendar',   title: 'April CC — Design',            status: 'design',         deptSlug: 'design' },
  { type: 'sm-content-calendar',   title: 'April CC — Design Review',     status: 'design_review',  deptSlug: 'design' },
  { type: 'sm-content-calendar',   title: 'May CC — Design Changes',      status: 'design_changes', deptSlug: 'design' },
  // Agri for All
  { type: 'agri4all-posts',         title: 'Agri4All Posts — Design',      status: 'design',         deptSlug: 'design' },
  { type: 'agri4all-posts',         title: 'Agri4All Posts — Review',      status: 'design_review',  deptSlug: 'design' },
  { type: 'agri4all-videos',        title: 'Agri4All Video — Design',      status: 'design',         deptSlug: 'design' },
  // Magazine
  { type: 'magazine',               title: 'SA Digital — Design',          status: 'design',         deptSlug: 'design' },
  { type: 'magazine-africa-print',  title: 'Africa Print — Design',        status: 'design',         deptSlug: 'design' },
  { type: 'magazine',               title: 'SA Digital — Design Review',   status: 'design_review',  deptSlug: 'design' },
  // Web Design
  { type: 'website-design',         title: 'GrainCo Site Map',             status: 'site_map',          deptSlug: 'design' },
  { type: 'website-design',         title: 'FarmFresh Development',        status: 'development',       deptSlug: 'design' },
  { type: 'website-design',         title: 'Boland Dairy Site Dev',        status: 'site_development',  deptSlug: 'design' },
  { type: 'website-design',         title: 'Agri Solutions Hosting & SEO', status: 'hosting_seo',       deptSlug: 'design' },
  // Banners
  { type: 'agri4all-banners',       title: 'April Banners — Design',       status: 'design',         deptSlug: 'design' },
  { type: 'agri4all-banners',       title: 'April Banners — Review',       status: 'design_review',  deptSlug: 'design' },

  // ── EDITORIAL ────────────────────────────────────────────────────
  { type: 'sm-content-calendar',   title: 'April CC — Editorial',          status: 'editorial',        deptSlug: 'editorial' },
  { type: 'sm-content-calendar',   title: 'April CC — Editorial Review',   status: 'editorial_review', deptSlug: 'editorial' },
  { type: 'sm-content-calendar',   title: 'May CC — Editorial',            status: 'editorial',        deptSlug: 'editorial' },
  // Online Articles
  { type: 'online-articles',        title: 'Grain Harvest Feature',         status: 'editing',          deptSlug: 'editorial' },
  { type: 'online-articles',        title: 'Dairy Market Update',           status: 'editing',          deptSlug: 'editorial' },
  { type: 'online-articles',        title: 'Livestock Trends Q2',           status: 'translating',      deptSlug: 'editorial' },
  { type: 'online-articles',        title: 'Planting Season Article',       status: 'ready_to_upload',  deptSlug: 'editorial' },
  { type: 'online-articles',        title: 'Water Management Guide',        status: 'posted',           deptSlug: 'editorial' },
  // Magazine editorial
  { type: 'magazine',               title: 'SA Digital — Editing',          status: 'editing',          deptSlug: 'editorial' },
  { type: 'magazine',               title: 'Africa Print — Editorial Review',status: 'editorial_review',deptSlug: 'editorial' },

  // ── VIDEO ────────────────────────────────────────────────────────
  { type: 'video',                  title: 'Farm Tour Brief',               status: 'brief_received',    deptSlug: 'video' },
  { type: 'video',                  title: 'Harvest Documentary Brief',     status: 'assign_and_schedule',deptSlug: 'video' },
  { type: 'video',                  title: 'Cattle Auction Recap',          status: 'production',        deptSlug: 'video' },
  { type: 'video',                  title: 'Grain Expo Highlights',         status: 'production',        deptSlug: 'video' },
  { type: 'video',                  title: 'Dairy Farm Tour',               status: 'editing',           deptSlug: 'video' },
  { type: 'video',                  title: 'Planting Season Timelapse',     status: 'editing',           deptSlug: 'video' },
  { type: 'video',                  title: 'Irrigation System Promo',       status: 'review',            deptSlug: 'video' },
  { type: 'video',                  title: 'New Silo Opening Film',         status: 'review',            deptSlug: 'video' },
  { type: 'video',                  title: 'SA Livestock Markets Reel',     status: 'changes_requested', deptSlug: 'video' },
  { type: 'video',                  title: 'Boland Dairy Brand Film',       status: 'final_delivery',    deptSlug: 'video' },

  // ── AGRI4ALL ────────────────────────────────────────────────────
  { type: 'agri4all-posts',         title: 'April Posts Bundle',            status: 'approved',          deptSlug: 'agri4all' },
  { type: 'agri4all-posts',         title: 'May Posts Bundle',              status: 'create_links',      deptSlug: 'agri4all' },
  { type: 'agri4all-videos',        title: 'April Video Posts',             status: 'approved',          deptSlug: 'agri4all' },
  { type: 'agri4all-newsletters',   title: 'April Newsletter',              status: 'approved',          deptSlug: 'agri4all' },
  { type: 'agri4all-newsletters',   title: 'May Newsletter',                status: 'create_links',      deptSlug: 'agri4all' },
  { type: 'agri4all-newsletter-feature', title: 'Feature Article April',   status: 'create_links',      deptSlug: 'agri4all' },
  { type: 'agri4all-posts',         title: 'Q1 Stats Sheet',                status: 'create_stat_sheet', deptSlug: 'agri4all' },
  { type: 'agri4all-posts',         title: 'March Posts Complete',          status: 'complete',          deptSlug: 'agri4all' },
  { type: 'agri4all-product-uploads', title: 'Seed Product Upload',         status: 'agri4all-links',    deptSlug: 'agri4all' },
  { type: 'agri4all-banners',       title: 'April Banners Live',            status: 'create_stat_sheet', deptSlug: 'agri4all' },

  // ── SOCIAL MEDIA (Google Ads — rest use scheduler) ──────────────
  { type: 'sm-google-ads',          title: 'Agri Solutions Google Ads',     status: 'artwork_design',    deptSlug: 'social-media' },
  { type: 'sm-google-ads',          title: 'GrainCo Google Ads',            status: 'ready_for_approval',deptSlug: 'social-media' },
  { type: 'sm-google-ads',          title: 'FarmFresh Google Ads',          status: 'approved',          deptSlug: 'social-media' },
  { type: 'sm-google-ads',          title: 'Boland Dairy Google Ads',       status: 'scheduled',         deptSlug: 'social-media' },
];

// ── Scheduled posts for Social Media tabs (Content Cal / Agri4All / Own SM) ──
const SCHEDULED_POSTS = [
  // Content Calendars source
  { title: 'April Facebook Post — Grain Harvest',   content: 'Bumper grain harvest expected this season. #grains',  sourceType: 'content-calendar', status: 'scheduled',  daysOffset: 2  },
  { title: 'April Instagram Reel — Dairy',          content: 'Behind the scenes at Boland Dairy. #farming',         sourceType: 'content-calendar', status: 'scheduled',  daysOffset: 4  },
  { title: 'May Facebook Post — Livestock',         content: 'Livestock market update for May. #livestock',          sourceType: 'content-calendar', status: 'draft',      daysOffset: 15 },
  { title: 'April Twitter Thread — Planting',       content: 'Planting season tips from our experts. #agri',         sourceType: 'content-calendar', status: 'published',  daysOffset: -3 },
  { title: 'May Instagram Story — Produce',         content: 'Fresh produce available from FarmFresh. #fresh',       sourceType: 'content-calendar', status: 'draft',      daysOffset: 18 },
  // Agri4All source
  { title: 'Agri4All — Seed Deal Spotlight',        content: 'New seed varieties available on agri4all.com #seeds',  sourceType: 'agri4all',         status: 'scheduled',  daysOffset: 3  },
  { title: 'Agri4All — Livestock Auction Recap',    content: 'Last week auction highlights. #auction',               sourceType: 'agri4all',         status: 'published',  daysOffset: -5 },
  { title: 'Agri4All — April Newsletter Post',      content: 'Newsletter is live on agri4all.com. #newsletter',      sourceType: 'agri4all',         status: 'draft',      daysOffset: 10 },
  { title: 'Agri4All — Equipment Feature',          content: 'Top 5 tractors for 2026. #equipment',                  sourceType: 'agri4all',         status: 'scheduled',  daysOffset: 7  },
  // Own Social Media source
  { title: 'ProAgri Own — Agency Update',           content: 'Exciting new campaigns launching this month! #proagri',sourceType: 'own-sm',           status: 'scheduled',  daysOffset: 1  },
  { title: 'ProAgri Own — Team Spotlight',          content: 'Meet the team behind ProAgri CRM. #team',              sourceType: 'own-sm',           status: 'draft',      daysOffset: 12 },
  { title: 'ProAgri Own — Case Study',              content: 'How we grew Agri Solutions reach by 40%. #casestudy',  sourceType: 'own-sm',           status: 'published',  daysOffset: -7 },
];

async function seed() {
  await pool.query('SELECT 1'); // wait for pool

  // ── 1. Fetch department slugs → IDs ─────────────────────────────
  const deptRows = await pool.query(`SELECT id, slug FROM departments`);
  const deptMap = {};
  deptRows.rows.forEach(r => { deptMap[r.slug] = r.id; });

  if (!deptMap['production']) {
    console.error('Departments not seeded yet. Run the API first (npm start) to trigger migrations.');
    process.exit(1);
  }

  // ── 2. Upsert test clients ───────────────────────────────────────
  const clientIds = [];
  for (const c of CLIENTS) {
    const res = await pool.query(
      `INSERT INTO clients (name, contact_person, email, status)
       VALUES ($1, $2, $3, 'active')
       ON CONFLICT DO NOTHING
       RETURNING id`,
      [c.name, c.contact, c.email]
    );
    if (res.rows.length > 0) {
      clientIds.push(res.rows[0].id);
    } else {
      const existing = await pool.query(`SELECT id FROM clients WHERE name = $1`, [c.name]);
      clientIds.push(existing.rows[0].id);
    }
  }
  console.log(`Clients ready: ${clientIds.length}`);

  // ── 3. Upsert one booking form per client ────────────────────────
  const bfIds = [];
  for (let i = 0; i < clientIds.length; i++) {
    const clientId = clientIds[i];
    const clientName = CLIENTS[i].name;
    const existing = await pool.query(
      `SELECT id FROM booking_forms WHERE client_id = $1 AND title = $2`,
      [clientId, `${clientName} — 2026 Campaign`]
    );
    if (existing.rows.length > 0) {
      bfIds.push(existing.rows[0].id);
    } else {
      const res = await pool.query(
        `INSERT INTO booking_forms (client_id, title, status, campaign_month_start, campaign_month_end)
         VALUES ($1, $2, 'active', '2026-01', '2026-12')
         RETURNING id`,
        [clientId, `${clientName} — 2026 Campaign`]
      );
      bfIds.push(res.rows[0].id);
    }
  }
  console.log(`Booking forms ready: ${bfIds.length}`);

  // ── 4. Insert deliverables ───────────────────────────────────────
  let inserted = 0;
  for (let i = 0; i < DELIVERABLES.length; i++) {
    const d = DELIVERABLES[i];
    const clientIdx = i % clientIds.length;
    const clientId = clientIds[clientIdx];
    const bfId = bfIds[clientIdx];
    const deptId = deptMap[d.deptSlug];

    if (!deptId) {
      console.warn(`Unknown dept slug: ${d.deptSlug}`);
      continue;
    }

    // Skip if already seeded (same type+status+title)
    const check = await pool.query(
      `SELECT id FROM deliverables WHERE type = $1 AND status = $2 AND title = $3 AND client_id = $4`,
      [d.type, d.status, d.title, clientId]
    );
    if (check.rows.length > 0) continue;

    await pool.query(
      `INSERT INTO deliverables
         (booking_form_id, department_id, client_id, type, title, status, delivery_month, metadata)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [bfId, deptId, clientId, d.type, d.title, d.status, MONTH, JSON.stringify(d.metadata || {})]
    );
    inserted++;
  }
  console.log(`Deliverables inserted: ${inserted}`);

  // ── 5. Insert scheduled posts (Social Media tabs) ────────────────
  let postsInserted = 0;
  const now = new Date();
  for (const p of SCHEDULED_POSTS) {
    const check = await pool.query(
      `SELECT id FROM scheduled_posts WHERE title = $1 AND source_type = $2`,
      [p.title, p.sourceType]
    );
    if (check.rows.length > 0) continue;

    const scheduledAt = new Date(now);
    scheduledAt.setDate(scheduledAt.getDate() + p.daysOffset);
    scheduledAt.setHours(9 + (postsInserted % 8), 0, 0, 0);

    // Spread across clients
    const clientId = clientIds[postsInserted % clientIds.length];

    await pool.query(
      `INSERT INTO scheduled_posts
         (title, content, source_type, status, scheduled_at, client_id,
          platforms, hashtags)
       VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb, $8)`,
      [
        p.title, p.content, p.sourceType, p.status,
        scheduledAt.toISOString(), clientId,
        JSON.stringify([{ key: 'facebook' }, { key: 'instagram' }]),
        '#agri #farming'
      ]
    );
    postsInserted++;
  }
  console.log(`Scheduled posts inserted: ${postsInserted}`);

  console.log('\nTest data seed complete!');
  await pool.end();
}

seed().catch(err => {
  console.error('Seed failed:', err);
  process.exit(1);
});
