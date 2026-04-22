// middleware/audit.js
import { getPool, sql } from '../db/connect.js';

export async function logAudit({
  userType = 'system',
  userId = null,
  userEmail = null,
  action,
  entityType = null,
  entityId = null,
  fieldChanged = null,
  oldValue = null,
  newValue = null,
  summary = null,
  ipAddress = null,
  userAgent = null,
}) {
  try {
    const pool = await getPool();
    await pool.request()
      .input('userType',    sql.NVarChar(10),  userType)
      .input('userId',      sql.BigInt,         userId)
      .input('userEmail',   sql.NVarChar(150),  userEmail)
      .input('action',      sql.NVarChar(50),   action)
      .input('entityType',  sql.NVarChar(50),   entityType)
      .input('entityId',    sql.BigInt,         entityId)
      .input('fieldChanged',sql.NVarChar(100),  fieldChanged)
      .input('oldValue',    sql.NVarChar(sql.MAX), oldValue ? String(oldValue) : null)
      .input('newValue',    sql.NVarChar(sql.MAX), newValue ? String(newValue) : null)
      .input('summary',     sql.NVarChar(500),  summary)
      .input('ipAddress',   sql.NVarChar(45),   ipAddress)
      .input('userAgent',   sql.NVarChar(500),  userAgent)
      .query(`
        INSERT INTO audit_log
          (user_type, user_id, user_email, action, entity_type, entity_id,
           field_changed, old_value, new_value, summary, ip_address, user_agent)
        VALUES
          (@userType, @userId, @userEmail, @action, @entityType, @entityId,
           @fieldChanged, @oldValue, @newValue, @summary, @ipAddress, @userAgent)
      `);
  } catch (err) {
    // Never crash the app because of audit logging
    console.error('Audit log failed:', err.message);
  }
}

export function getIp(req) {
  return req.headers['x-forwarded-for']?.split(',')[0] || req.socket.remoteAddress;
}
