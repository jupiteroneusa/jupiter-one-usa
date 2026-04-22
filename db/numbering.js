// db/numbering.js
// Generates sequential numbers like RFQ-2025-00001

import { getPool, sql } from './connect.js';

export async function generateNumber(prefix) {
  const pool = await getPool();
  const year = new Date().getFullYear();

  // Get the count of existing records for this prefix this year
  // We use system_settings to track the last sequence number
  const key = `${prefix}_seq_${year}`;

  const result = await pool.request()
    .input('key', sql.NVarChar, key)
    .query(`
      UPDATE system_settings
      SET setting_value = CAST(CAST(setting_value AS INT) + 1 AS NVARCHAR)
      OUTPUT INSERTED.setting_value
      WHERE setting_key = @key;

      IF @@ROWCOUNT = 0
      BEGIN
        INSERT INTO system_settings (setting_key, setting_value, description)
        VALUES (@key, '1', 'Auto sequence counter')
        SELECT '1' AS setting_value;
      END
    `);

  const seq = result.recordset[0]?.setting_value || '1';
  return `${prefix}-${year}-${String(seq).padStart(5, '0')}`;
}
