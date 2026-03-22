const path = require('path');

module.exports = {
  AUTH_ENABLED: false,
  DB: {
    host: 'localhost',
    port: 5432,
    database: 'proagri_crm',
    user: 'postgres',
    password: 'Daniel.leinad8',
  },
  JWT_SECRET: 'proagri-dev-secret-change-in-prod',
  PORT: 3001,
  UPLOAD_DIR: path.join(__dirname, 'uploads/photos'),
  ATTACHMENT_DIR: path.join(__dirname, 'uploads/attachments'),
};
