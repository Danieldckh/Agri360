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
const { PORT, UPLOAD_DIR, AUTH_ENABLED } = require('./config');
const authRoutes = require('./routes/auth');
const employeeRoutes = require('./routes/employees');
const messagingRoutes = require('./routes/messaging');

// Ensure uploads directories exist
fs.mkdirSync(UPLOAD_DIR, { recursive: true });
fs.mkdirSync(path.join(__dirname, 'uploads/attachments'), { recursive: true });

const app = express();

app.use(cors());
app.use(express.json());
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

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

const clientRoutes = require('./routes/clients');
const bookingFormRoutes = require('./routes/booking-forms');
const deliverableRoutes = require('./routes/deliverables');
const dashboardRoutes = require('./routes/dashboards');
const financialRoutes = require('./routes/financials');
const departmentRoutes = require('./routes/departments');

app.use('/api/clients', clientRoutes);
app.use('/api/booking-forms', bookingFormRoutes);
app.use('/api/deliverables', deliverableRoutes);
app.use('/api/dashboards', dashboardRoutes);
app.use('/api/financials', financialRoutes);
app.use('/api/departments', departmentRoutes);

const devRoutes = require('./routes/dev');
app.use('/api/dev', devRoutes);

// Serve static frontend files
app.use(express.static(path.join(__dirname, '..')));

// SPA fallback - serve index.html for non-API routes
app.get('/{*path}', (req, res) => {
  if (!req.path.startsWith('/api/')) {
    res.sendFile(path.join(__dirname, '..', 'index.html'));
  }
});

app.listen(PORT, () => {
  console.log(`ProAgri API running on http://localhost:${PORT}`);
});
