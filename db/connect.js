// db/connect.js
import sql from 'mssql';
import 'dotenv/config';

const config = {
  server:   process.env.DB_SERVER,
  port:     parseInt(process.env.DB_PORT) || 1433,
  database: process.env.DB_NAME,
  user:     process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  options: {
    encrypt:                true,   // required for Azure SQL
    trustServerCertificate: false,
    enableArithAbort:       true,
  },
  pool: {
    max: 20,
    min: 2,
    idleTimeoutMillis: 30000,
  },
  requestTimeout: 30000,
};

let pool;

export async function getPool() {
  if (!pool) {
    pool = await sql.connect(config);
  }
  return pool;
}

// Helper — run a query with automatic pool
export async function query(queryStr, inputs = []) {
  const pool = await getPool();
  const req = pool.request();
  inputs.forEach(({ name, type, value }) => req.input(name, type, value));
  return req.query(queryStr);
}

export { sql };
