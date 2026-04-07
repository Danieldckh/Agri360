module.exports = async function (pool) {
  await pool.query(`ALTER TABLE deliverables ALTER COLUMN status TYPE VARCHAR(50)`);
  await pool.query(`ALTER TABLE booking_forms ALTER COLUMN status TYPE VARCHAR(50)`);
  await pool.query(`ALTER TABLE clients ALTER COLUMN status TYPE VARCHAR(50)`);
};
