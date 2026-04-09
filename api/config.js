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
  OPENAI_API_KEY: process.env.OPENAI_API_KEY || '',
  ALPHA_AGRI4ALL_BASE_URL: process.env.ALPHA_AGRI4ALL_BASE_URL || 'https://alpha.agri4all.com',
  ALPHA_AGRI4ALL_EMAIL: process.env.ALPHA_AGRI4ALL_EMAIL || '',
  ALPHA_AGRI4ALL_PASSWORD: process.env.ALPHA_AGRI4ALL_PASSWORD || '',
  ALPHA_AGRI4ALL_SELLER_ID: process.env.ALPHA_AGRI4ALL_SELLER_ID || '',
};
