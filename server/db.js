require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool(
  process.env.DATABASE_URL 
    ? { connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } }
    : {
        user: process.env.DB_USER || 'postgres',
        host: process.env.DB_HOST || 'localhost',
        database: process.env.DB_NAME || 'amirtha',
        password: process.env.DB_PASSWORD || '1234',
        port: process.env.DB_PORT || 5432,
      }
);

module.exports = {
  query: (text, params) => pool.query(text, params),
};
