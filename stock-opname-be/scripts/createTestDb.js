require('dotenv').config();
const { Client } = require('pg');

async function main() {
  const dbName = `${process.env.DB_NAME}_test`;

  const client = new Client({
    host: process.env.DB_HOST,
    port: process.env.DB_PORT,
    user: process.env.DB_USER,
    password: process.env.DB_PASS,
    database: 'postgres'
  });

  await client.connect();

  const { rows } = await client.query('SELECT 1 FROM pg_database WHERE datname = $1', [dbName]);

  if (rows.length === 0) {
    await client.query(`CREATE DATABASE "${dbName}"`);
    console.log(`Created test database "${dbName}"`);
  } else {
    console.log(`Test database "${dbName}" already exists`);
  }

  await client.end();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
