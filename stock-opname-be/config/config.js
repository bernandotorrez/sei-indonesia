require('dotenv').config();

const base = {
  username: process.env.DB_USER,
  password: process.env.DB_PASS,
  database: process.env.DB_NAME,
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  dialect: process.env.DB_DIALECT || 'postgres',
  logging: false
};

module.exports = {
  development: base,
  test: { ...base, database: `${process.env.DB_NAME}_test` },
  production: { ...base, logging: false }
};
