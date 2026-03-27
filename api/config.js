const path = require('path');

module.exports = {
  AUTH_ENABLED: process.env.AUTH_ENABLED === 'true' || false,
  DB: {
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432', 10),
    database: process.env.DB_NAME || 'proagri_crm',
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || 'Daniel.leinad8',
  },
  JWT_SECRET: process.env.JWT_SECRET || 'proagri-dev-secret-change-in-prod',
  PORT: parseInt(process.env.PORT || '3001', 10),
  UPLOAD_DIR: path.join(__dirname, 'uploads/photos'),
  ATTACHMENT_DIR: path.join(__dirname, 'uploads/attachments'),
};
