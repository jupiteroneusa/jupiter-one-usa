// routes/auth.js
import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { getPool, sql } from '../db/connect.js';
import { requireCustomer } from '../middleware/auth.js';
import { logAudit, getIp } from '../middleware/audit.js';
import { sendWelcomeEmail, sendEmailVerification, sendPasswordReset } from '../services/mailer.js';

const router = Router();

// ── POST /api/auth/register ───────────────────────────────────
router.post('/register', async (req, res) => {
  const { first_name, last_name, company, job_title, email, phone, password } = req.body;

  if (!first_name || !last_name || !email || !password)
    return res.status(400).json({ error: 'First name, last name, email and password are required.' });

  if (password.length < 8)
    return res.status(400).json({ error: 'Password must be at least 8 characters.' });

  try {
    const pool = await getPool();

    // Check email not already registered
    const existing = await pool.request()
      .input('email', sql.NVarChar, email.toLowerCase())
      .query(`SELECT id FROM customers WHERE email = @email`);

    if (existing.recordset.length)
      return res.status(409).json({ error: 'An account with this email already exists.' });

    const passwordHash = await bcrypt.hash(password, 12);
    const verifyToken = crypto.randomBytes(32).toString('hex');

    const result = await pool.request()
      .input('firstName',    sql.NVarChar(100), first_name)
      .input('lastName',     sql.NVarChar(100), last_name)
      .input('company',      sql.NVarChar(150), company || null)
      .input('jobTitle',     sql.NVarChar(100), job_title || null)
      .input('email',        sql.NVarChar(150), email.toLowerCase())
      .input('phone',        sql.NVarChar(30),  phone || null)
      .input('passwordHash', sql.NVarChar(255), passwordHash)
      .input('verifyToken',  sql.NVarChar(100), verifyToken)
      .query(`
        INSERT INTO customers (first_name, last_name, company, job_title, email, phone, password_hash, email_verify_token)
        OUTPUT INSERTED.id, INSERTED.first_name, INSERTED.last_name, INSERTED.email
        VALUES (@firstName, @lastName, @company, @jobTitle, @email, @phone, @passwordHash, @verifyToken)
      `);

    const customer = result.recordset[0];

    await logAudit({
      userType: 'customer', userId: customer.id, userEmail: customer.email,
      action: 'registered', entityType: 'customer', entityId: customer.id,
      summary: `New customer registered: ${email}`,
      ipAddress: getIp(req),
    });

    // Send emails (non-blocking)
    sendWelcomeEmail({ customer }).catch(console.error);
    sendEmailVerification({ customer, token: verifyToken }).catch(console.error);

    res.status(201).json({ success: true, message: 'Account created. Please check your email to verify your account.' });

  } catch (err) {
    console.error('Register error:', err);
    res.status(500).json({ error: 'Registration failed. Please try again.' });
  }
});

// ── POST /api/auth/login ──────────────────────────────────────
router.post('/login', async (req, res) => {
  const { email, password } = req.body;
  const ip = getIp(req);

  if (!email || !password)
    return res.status(400).json({ error: 'Email and password are required.' });

  try {
    const pool = await getPool();

    const result = await pool.request()
      .input('email', sql.NVarChar, email.toLowerCase())
      .query(`SELECT * FROM customers WHERE email = @email`);

    const customer = result.recordset[0];

    if (!customer) {
      await logAudit({ userType: 'customer', action: 'login_failed', summary: `Login failed: email not found (${email})`, ipAddress: ip });
      return res.status(401).json({ error: 'Invalid email or password.' });
    }

    if (customer.status === 'Suspended')
      return res.status(403).json({ error: 'Your account has been suspended. Contact support.' });

    const valid = await bcrypt.compare(password, customer.password_hash);
    if (!valid) {
      await logAudit({ userType: 'customer', userId: customer.id, userEmail: customer.email, action: 'login_failed', summary: 'Wrong password', ipAddress: ip });
      return res.status(401).json({ error: 'Invalid email or password.' });
    }

    // Create JWT
    const token = jwt.sign(
      { id: customer.id, email: customer.email, type: 'customer' },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
    );

    // Save session
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    await pool.request()
      .input('customerId', sql.BigInt,      customer.id)
      .input('token',      sql.NVarChar,    token)
      .input('ip',         sql.NVarChar(45),ip)
      .input('ua',         sql.NVarChar(500), req.headers['user-agent'] || null)
      .input('expiresAt',  sql.DateTime,    expiresAt)
      .query(`
        INSERT INTO customer_sessions (customer_id, session_token, ip_address, user_agent, expires_at)
        VALUES (@customerId, @token, @ip, @ua, @expiresAt)
      `);

    // Update last login
    await pool.request()
      .input('id', sql.BigInt, customer.id)
      .query(`UPDATE customers SET last_login_at = GETDATE() WHERE id = @id`);

    await logAudit({ userType: 'customer', userId: customer.id, userEmail: customer.email, action: 'logged_in', summary: 'Customer logged in', ipAddress: ip });

    res.json({
      token,
      customer: {
        id: customer.id,
        first_name: customer.first_name,
        last_name: customer.last_name,
        email: customer.email,
        company: customer.company,
      },
    });

  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'Login failed.' });
  }
});

// ── POST /api/auth/logout ─────────────────────────────────────
router.post('/logout', requireCustomer, async (req, res) => {
  try {
    const token = req.headers.authorization?.slice(7);
    const pool = await getPool();
    await pool.request()
      .input('token', sql.NVarChar, token)
      .query(`UPDATE customer_sessions SET invalidated_at = GETDATE() WHERE session_token = @token`);

    await logAudit({ userType: 'customer', userId: req.customerId, action: 'logged_out', ipAddress: getIp(req) });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Logout failed.' });
  }
});

// ── GET /api/auth/me ──────────────────────────────────────────
router.get('/me', requireCustomer, async (req, res) => {
  try {
    const pool = await getPool();
    const result = await pool.request()
      .input('id', sql.BigInt, req.customerId)
      .query(`
        SELECT id, first_name, last_name, company, job_title, email, phone,
               tier_id, status, email_verified, created_at
        FROM customers WHERE id = @id
      `);
    if (!result.recordset.length) return res.status(404).json({ error: 'Not found.' });
    res.json(result.recordset[0]);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch account.' });
  }
});

// ── GET /api/auth/verify-email ────────────────────────────────
router.get('/verify-email', async (req, res) => {
  const { token } = req.query;
  if (!token) return res.status(400).json({ error: 'Invalid link.' });

  try {
    const pool = await getPool();
    const result = await pool.request()
      .input('token', sql.NVarChar, token)
      .query(`
        UPDATE customers SET email_verified = 1, email_verify_token = NULL
        OUTPUT INSERTED.id, INSERTED.email
        WHERE email_verify_token = @token
      `);

    if (!result.recordset.length)
      return res.status(400).json({ error: 'Invalid or already used verification link.' });

    await logAudit({ userType: 'customer', userId: result.recordset[0].id, action: 'email_verified', ipAddress: getIp(req) });
    res.json({ success: true, message: 'Email verified. You can now log in.' });
  } catch (err) {
    res.status(500).json({ error: 'Verification failed.' });
  }
});

// ── POST /api/auth/forgot-password ───────────────────────────
router.post('/forgot-password', async (req, res) => {
  const { email } = req.body;
  if (!email) return res.status(400).json({ error: 'Email is required.' });

  try {
    const pool = await getPool();
    const result = await pool.request()
      .input('email', sql.NVarChar, email.toLowerCase())
      .query(`SELECT id, first_name, email FROM customers WHERE email = @email AND status = 'Active'`);

    // Always return success to prevent email enumeration
    if (!result.recordset.length)
      return res.json({ success: true, message: 'If an account exists, a reset link has been sent.' });

    const customer = result.recordset[0];
    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

    await pool.request()
      .input('customerId', sql.BigInt,   customer.id)
      .input('token',      sql.NVarChar, token)
      .input('expiresAt',  sql.DateTime, expiresAt)
      .input('ip',         sql.NVarChar(45), getIp(req))
      .query(`INSERT INTO password_resets (customer_id, reset_token, expires_at, ip_address) VALUES (@customerId, @token, @expiresAt, @ip)`);

    sendPasswordReset({ customer, token }).catch(console.error);
    res.json({ success: true, message: 'If an account exists, a reset link has been sent.' });
  } catch (err) {
    res.status(500).json({ error: 'Request failed.' });
  }
});

// ── POST /api/auth/reset-password ────────────────────────────
router.post('/reset-password', async (req, res) => {
  const { token, password } = req.body;
  if (!token || !password) return res.status(400).json({ error: 'Token and password are required.' });
  if (password.length < 8) return res.status(400).json({ error: 'Password must be at least 8 characters.' });

  try {
    const pool = await getPool();
    const result = await pool.request()
      .input('token', sql.NVarChar, token)
      .query(`
        SELECT pr.*, c.email FROM password_resets pr
        JOIN customers c ON c.id = pr.customer_id
        WHERE pr.reset_token = @token
          AND pr.expires_at > GETDATE()
          AND pr.used_at IS NULL
      `);

    if (!result.recordset.length)
      return res.status(400).json({ error: 'Invalid or expired reset link.' });

    const reset = result.recordset[0];
    const passwordHash = await bcrypt.hash(password, 12);

    await pool.request()
      .input('hash',       sql.NVarChar, passwordHash)
      .input('customerId', sql.BigInt,   reset.customer_id)
      .query(`UPDATE customers SET password_hash = @hash, updated_at = GETDATE() WHERE id = @customerId`);

    await pool.request()
      .input('token', sql.NVarChar, token)
      .query(`UPDATE password_resets SET used_at = GETDATE() WHERE reset_token = @token`);

    await logAudit({ userType: 'customer', userId: reset.customer_id, action: 'password_reset', ipAddress: getIp(req) });
    res.json({ success: true, message: 'Password updated. You can now log in.' });
  } catch (err) {
    res.status(500).json({ error: 'Password reset failed.' });
  }
});

export default router;
