import fs from 'fs';
import readline from 'readline';
import sql from 'mssql';
import 'dotenv/config';

const config = {
  server: process.env.DB_SERVER,
  port: 1433,
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  options: { encrypt: true, trustServerCertificate: false }
};

async function run() {
  const pool = await sql.connect(config);
  console.log('Connected!');
  
  const rl = readline.createInterface({
    input: fs.createReadStream('C:\\Jupiter One USA\\reference\\V_FLIS_PART.CSV')
  });
  
  let headers = null;
  let count = 0;
  let errors = 0;

  for await (const line of rl) {
    if (!headers) { headers = line.split(','); continue; }
    const cols = line.split(',');
    const nsn = cols[0]?.replace(/"/g,'').trim();
    const cage = cols[1]?.replace(/"/g,'').trim();
    const pn = cols[2]?.replace(/"/g,'').trim();
    if (!nsn || !cage || !pn) continue;

    try {
      await pool.request()
        .input('nsn', sql.NVarChar(20), nsn)
        .input('cage', sql.NVarChar(10), cage)
        .input('pn', sql.NVarChar(100), pn)
        .query('INSERT INTO nsn_parts_import (nsn, cage_code, part_number) VALUES (@nsn, @cage, @pn)');
      count++;
      if (count % 10000 === 0) console.log('Imported ' + count + ' rows...');
    } catch(e) {
      errors++;
    }
  }
  console.log('Done! ' + count + ' rows, ' + errors + ' errors');
  pool.close();
}

run().catch(console.error);