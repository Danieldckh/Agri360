const bcrypt = require('bcrypt');
const pool = require('./db');

const SALT_ROUNDS = 10;

async function seed() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS employees (
      id SERIAL PRIMARY KEY,
      first_name VARCHAR(100) NOT NULL,
      last_name VARCHAR(100) NOT NULL,
      username VARCHAR(50) NOT NULL UNIQUE,
      password_hash VARCHAR(255) NOT NULL,
      security_question VARCHAR(255) NOT NULL,
      security_answer_hash VARCHAR(255) NOT NULL,
      role VARCHAR(20) DEFAULT 'employee',
      status VARCHAR(20) DEFAULT 'pending',
      photo_url VARCHAR(255) DEFAULT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  const passwordHash = await bcrypt.hash('Admin123!', SALT_ROUNDS);
  const answerHash = await bcrypt.hash('agri360', SALT_ROUNDS);

  await pool.query(
    `INSERT INTO employees (first_name, last_name, username, password_hash, security_question, security_answer_hash, role, status)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
     ON CONFLICT (username) DO NOTHING`,
    ['Admin', 'User', 'admin', passwordHash, 'What is the company name?', answerHash, 'admin', 'approved']
  );

  console.log('Seed complete.');
  await pool.end();
}

seed().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
