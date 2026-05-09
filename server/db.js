const { Pool } = require('pg');

const pool = new Pool(
  process.env.DATABASE_URL 
    ? { connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } }
    : {
        user: 'postgres',
        host: 'localhost',
        database: 'amirtha',
        password: '1234',
        port: 5432,
      }
);

module.exports = {
  query: (text, params) => pool.query(text, params),
};
