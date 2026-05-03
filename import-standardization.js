import fs from 'fs';
import readline from 'readline';
import sql from 'mssql';
import 'dotenv/config';
const config = { server: process.env.DB_SERVER, port: 1433, database: process.env.DB_NAME, user: process.env.DB_USER, password: process.env.DB_PASSWORD, options: { encrypt: true, trustServerCertificate: false } };
async function run() {
  const pool = await sql.connect(config);
  console.log('Connected - Standardization!');
  const rl = readline.createInterface({ input: fs.createReadStream('C:\\Jupiter One USA\\identification\\V_FLIS_STANDARDIZATION.CSV') });
  let headers = null; let count = 0; let errors = 0;
  for await (const line of rl) {
    if (!headers) { headers = line.split(','); console.log('Headers:', headers); continue; }
    const cols = line.split(',');
    const niin = cols[0]?.replace(/"/g,'').trim();
    const std_data = cols[1]?.replace(/"/g,'').trim();
    if (!niin) continue;
    try {
      await pool.request()
        .input('niin', sql.NVarChar(15), niin)
        .input('std', sql.NVarChar(500), std_data || null)
        .query(`UPDATE nsn_catalog SET standardization_data=@std WHERE niin=@niin`);
      count++;
      if (count % 10000 === 0) console.log('Updated ' + count + ' rows...');
    } catch(e) { errors++; }
  }
  console.log('Done! ' + count + ' rows, ' + errors + ' errors');
  pool.close();
}
run().catch(console.error);