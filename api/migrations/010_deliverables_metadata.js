module.exports = async function (pool) {
  await pool.query(`ALTER TABLE deliverables ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}'`);
};
