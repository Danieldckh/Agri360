const { execSync } = require('child_process');
const path = require('path');

// Run migrations in order, then start server
const migrationsDir = path.join(__dirname, 'migrations');
const fs = require('fs');

async function runMigrations() {
  const pool = require('./db');
  const migrations = fs.readdirSync(migrationsDir)
    .filter(f => f.endsWith('.js'))
    .sort();

  for (const file of migrations) {
    console.log(`Running migration: ${file}`);
    try {
      const migrate = require(path.join(migrationsDir, file));
      // Migrations are self-executing, just requiring them runs them
      // Wait a bit for each to complete
      await new Promise(r => setTimeout(r, 2000));
    } catch (err) {
      console.warn(`Migration ${file} warning:`, err.message);
    }
  }

  // Wait for db.js auto-migrations too
  await new Promise(r => setTimeout(r, 3000));
  console.log('Migrations complete, starting server...');
}

// Just start the server directly - migrations run via db.js require
require('./server');
