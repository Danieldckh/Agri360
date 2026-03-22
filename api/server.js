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

// Auth config endpoint
app.get('/api/auth/config', (_req, res) => {
  res.json({ authEnabled: AUTH_ENABLED });
});

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/employees', employeeRoutes);
app.use('/api/messaging', messagingRoutes);

const devRoutes = require('./routes/dev');
app.use('/api/dev', devRoutes);

app.listen(PORT, () => {
  console.log(`ProAgri API running on http://localhost:${PORT}`);
});
