import fs from 'fs';
import readline from 'readline';
import sql from 'mssql';
import 'dotenv/config';

const config = {
  server: process.env.DB_SERVER, port: 1433,
  database: process.env.DB_NAME, user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  options: { encrypt: true, trustServerCertificate: false }
};

async function run() {
  const pool = await sql.connect(config);
  console.log('Connected!');

  const rl = readline.createInterface({
    input: fs.createReadStream('C:\\Jupiter One USA\\identification\\P_FLIS_NSN.CSV')
  });

  let headers = null, count = 0, errors = 0;

  for await (const line of rl) {
    if (!headers) { headers = line.split(',').map(h => h.replace(/"/g,'').trim()); continue; }
    const cols = line.split(',');
    const fsc       = cols[0]?.replace(/"/g,'').trim();
    const niin      = cols[1]?.replace(/"/g,'').trim();
    const item_name = cols[3]?.replace(/"/g,'').trim();
    const cancelled = cols[6]?.replace(/"/g,'').trim();
    if (!fsc || !niin) continue;

    const niin_full = fsc + niin;
    const nsn = `${fsc}-${niin.substring(0,3)}-${niin.substring(3,8)}`;
    const status = cancelled ? 'C' : 'A';

    try {
      await pool.request()
        .input('nsn',       sql.NVarChar(20),  nsn)
        .input('niin',      sql.NVarChar(15),  niin_full)
        .input('fsc',       sql.NVarChar(4),   fsc)
        .input('item_name', sql.NVarChar(255), item_name || null)
        .input('status',    sql.NVarChar(1),   status)
        .query(`
          IF NOT EXISTS (SELECT 1 FROM nsn_catalog WHERE niin=@niin)
          INSERT INTO nsn_catalog (nsn, niin, fsc, item_name, status)
          VALUES (@nsn, @niin, @fsc, @item_name, @status)
        `);
      count++;
      if (count % 10000 === 0) console.log('Imported ' + count + ' rows...');
    } catch(e) { errors++; }
  }

  console.log('Done! ' + count + ' rows, ' + errors + ' errors');
  pool.close();
}
run().catch(console.error);