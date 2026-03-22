const { Pool } = require('pg');
const { DB } = require('./config');

const pool = new Pool(DB);

module.exports = pool;
