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
const socialPublisher = require('./social-publisher');

// Ensure uploads directories exist
fs.mkdirSync(UPLOAD_DIR, { recursive: true });
fs.mkdirSync(ATTACHMENT_DIR, { recursive: true });
fs.mkdirSync(DELIVERABLE_IMAGE_DIR, { recursive: true });

const app = express();

app.use(cors());
// 25mb limit so signed/change-request PDF base64 from the esign service
// (multi-page A4 from html2pdf at quality 0.98) fits in /sign POST bodies.
app.use(express.json({ limit: '25mb' }));
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

// Serve static frontend files. JS/CSS/HTML always revalidate via etag so that
// a redeploy is picked up by clients without a hard refresh.
var ROOT_DIR = path.join(__dirname, '..');

// Per-boot build stamp used to cache-bust script/link srcs in index.html.
var BUILD_STAMP = Date.now().toString(36);

// Rewrite index.html on the fly to append ?v=<BUILD_STAMP> to every local
// <script src="..."> and <link href="..."> so a redeployed container forces
// fresh downloads even when the browser cached the file under old headers.
app.get(['/', '/index.html'], function (req, res, next) {
  try {
    var html = fs.readFileSync(path.join(ROOT_DIR, 'index.html'), 'utf8');
    html = html.replace(/(<script\s+src=")([^"?]+)(")/g, '$1$2?v=' + BUILD_STAMP + '$3');
    html = html.replace(/(<link\s+[^>]*href=")([^"?]+\.css)(")/g, '$1$2?v=' + BUILD_STAMP + '$3');
    res.setHeader('Cache-Control', 'no-cache');
    res.type('html').send(html);
  } catch (e) {
    next(e);
  }
});

app.use(express.static(ROOT_DIR, {
  etag: true,
  lastModified: true,
  setHeaders: function (res, filePath) {
    if (/\.(js|css|html)$/.test(filePath)) {
      res.setHeader('Cache-Control', 'no-cache');
    }
  }
}));

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
