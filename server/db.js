const { Pool } = require('pg');

const pool = new Pool({
  user: 'postgres', // default user, can be configured if different
  host: 'localhost',
  database: 'amirtha',
  password: '1234',
  port: 5432,
});

module.exports = {
  query: (text, params) => pool.query(text, params),
};
