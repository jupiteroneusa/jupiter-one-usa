// middleware/auth.js
import jwt from 'jsonwebtoken';
import { getPool, sql } from '../db/connect.js';

// ── Customer auth middleware ──────────────────────────────────
export async function requireCustomer(req, res, next) {
  try {
    const token = extractToken(req);
    if (!token) return res.status(401).json({ error: 'Login required.' });

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    if (decoded.type !== 'customer') return res.status(403).json({ error: 'Forbidden.' });

    // Validate session still active in DB
    const pool = await getPool();
    const result = await pool.request()
      .input('token', sql.NVarChar, token)
      .query(`
        SELECT cs.*, c.status AS account_status
        FROM customer_sessions cs
        JOIN customers c ON c.id = cs.customer_id
        WHERE cs.session_token = @token
          AND cs.expires_at > GETDATE()
          AND cs.invalidated_at IS NULL
          AND c.status = 'Active'
      `);

    if (!result.recordset.length) {
      return res.status(401).json({ error: 'Session expired. Please log in again.' });
    }

    req.customerId = decoded.id;
    req.customerEmail = decoded.email;
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Invalid token.' });
  }
}

// ── Admin auth middleware ─────────────────────────────────────
export async function requireAdmin(req, res, next) {
  try {
    const token = extractToken(req);
    if (!token) return res.status(401).json({ error: 'Admin login required.' });

    const decoded = jwt.verify(token, process.env.ADMIN_JWT_SECRET);
    if (decoded.type !== 'admin') return res.status(403).json({ error: 'Forbidden.' });

    const pool = await getPool();
    const result = await pool.request()
      .input('token', sql.NVarChar, token)
      .query(`
        SELECT as2.*, au.role, au.status AS admin_status
        FROM admin_sessions as2
        JOIN admin_users au ON au.id = as2.admin_id
        WHERE as2.session_token = @token
          AND as2.expires_at > GETDATE()
          AND as2.invalidated_at IS NULL
          AND au.status = 'Active'
      `);

    if (!result.recordset.length) {
      return res.status(401).json({ error: 'Admin session expired.' });
    }

    req.adminId = decoded.id;
    req.adminEmail = decoded.email;
    req.adminRole = result.recordset[0].role;
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Invalid admin token.' });
  }
}

// ── Optional auth — attaches customer if logged in, continues either way ──
export async function optionalCustomer(req, res, next) {
  try {
    const token = extractToken(req);
    if (!token) return next();
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.customerId = decoded.id;
    req.customerEmail = decoded.email;
  } catch (_) { /* ignore */ }
  next();
}

export async function requireAdminCookie(req, res, next) {
  try {
    const token = req.cookies?.j1_admin_token;
    if (!token) return res.status(401).json({ error: 'Admin login required.' });
    const jwt2 = await import('jsonwebtoken');
    const decoded = jwt2.default.verify(token, process.env.ADMIN_JWT_SECRET);
    if (decoded.type !== 'admin') return res.status(403).json({ error: 'Forbidden.' });
    req.adminEmail = decoded.email;
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Invalid admin token.' });
  }
}

function extractToken(req) {
  const authHeader = req.headers.authorization;
  if (authHeader?.startsWith('Bearer ')) return authHeader.slice(7);
  return req.cookies?.token || null;
}
