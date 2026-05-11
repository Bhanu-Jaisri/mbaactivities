require('dotenv').config();
const { Pool } = require('pg');

const connectionString = process.env.DATABASE_URL ? process.env.DATABASE_URL.trim().replace(/^"|"$/g, '') : null;

const pool = new Pool(
  connectionString
    ? { connectionString: connectionString, ssl: { rejectUnauthorized: false } }
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
