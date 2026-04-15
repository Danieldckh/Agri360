require('dotenv').config();
process.on('uncaughtException', (err) => {
  console.error('Uncaught Exception:', err);
});
process.on('unhandledRejection', (err) => {
  console.error('Unhandled Rejection:', err);
});

const fs = require('fs');
const path = require('path');
const express = require('express');
const cors = require('cors');
const { PORT, UPLOAD_DIR, ATTACHMENT_DIR, DELIVERABLE_IMAGE_DIR, UPLOAD_ROOT, AUTH_ENABLED } = require('./config');

// Route imports
const authRoutes = require('./routes/auth');
const employeeRoutes = require('./routes/employees');
const messagingRoutes = require('./routes/messaging');
const clientRoutes = require('./routes/clients');
const clientAssetsRoutes = require('./routes/client-assets');
const bookingFormRoutes = require('./routes/booking-forms');
const deliverableRoutes = require('./routes/deliverables');
const financialRoutes = require('./routes/financials');
const departmentRoutes = require('./routes/departments');
const devRoutes = require('./routes/dev');
const devTicketRoutes = require('./routes/dev-tickets');
const portalRoutes = require('./routes/portal');
const schedulerRoutes = require('./routes/scheduler');
const socialOAuthRoutes = require('./routes/social-oauth');
// TEMPORARY: one-shot cleanup endpoint, remove with route registration below
const adminCleanupRoutes = require('./routes/admin-cleanup');
const socialPublisher = require('./social-publisher');

// Ensure uploads directories exist
fs.mkdirSync(UPLOAD_DIR, { recursive: true });
fs.mkdirSync(ATTACHMENT_DIR, { recursive: true });
fs.mkdirSync(DELIVERABLE_IMAGE_DIR, { recursive: true });

const app = express();

app.use(cors());
app.use(express.json());
app.use('/uploads', express.static(UPLOAD_ROOT));

// Health check
app.get('/health', (req, res) => res.json({ status: 'ok' }));

// Auth config endpoint
app.get('/api/auth/config', (_req, res) => {
  res.json({ authEnabled: AUTH_ENABLED });
});

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/employees', employeeRoutes);
app.use('/api/messaging', messagingRoutes);
app.use('/api/clients', clientRoutes);
app.use('/api/client-assets', clientAssetsRoutes);
app.use('/api/booking-forms', bookingFormRoutes);
app.use('/api/deliverables', deliverableRoutes);
app.use('/api/financials', financialRoutes);
app.use('/api/departments', departmentRoutes);
app.use('/api/dev-tickets', devTicketRoutes);
app.use('/api/dev', devRoutes);
app.use('/api/portal', portalRoutes);
app.use('/api/social-oauth', socialOAuthRoutes);
app.use('/api/scheduler', schedulerRoutes);
// TEMPORARY: one-shot test-fixture cleanup, remove after run
app.use('/api/admin', adminCleanupRoutes);

// Serve static frontend files
var ROOT_DIR = path.join(__dirname, '..');
app.use(express.static(ROOT_DIR));

// Fallback - serve index.html for non-API routes
app.use((req, res, next) => {
  if (req.method === 'GET' && !req.path.startsWith('/api/')) {
    res.sendFile(path.join(ROOT_DIR, 'index.html'));
  } else {
    next();
  }
});

app.listen(PORT, () => {
  console.log(`ProAgri API running on http://localhost:${PORT}`);
  socialPublisher.start();
});
