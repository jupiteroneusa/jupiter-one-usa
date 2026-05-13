// patch-cc-auth-customer.cjs
// Customer-facing CC authorization e-sign:
//   1. New file: routes/ccAuth.js — public routes
//      GET /cc-auth/:token  — renders signing page with pre-filled info
//      POST /cc-auth/:token — saves signature + last4 + notifies admin
//   2. Mount in server.js (or wherever routes are wired)
//
// PCI-safe: We capture LAST 4 ONLY, never the full card number.

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// ============================================================
// 1) Create routes/ccAuth.js
// ============================================================
const ccAuthRoutes = `// routes/ccAuth.js
// Public-facing routes for customer credit-card authorization e-signature.
// PCI-safe: only the last 4 digits are stored, never the full PAN.

import express from 'express';
import { getPool, sql } from '../db/connect.js';

const router = express.Router();

function esc(s) {
  if (s == null) return '';
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
function fmtMoney(n) {
  const v = parseFloat(n || 0);
  return '$' + v.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

// ===== GET /cc-auth/:token =====
router.get('/cc-auth/:token', async (req, res) => {
  try {
    const pool = await getPool();
    const tok = req.params.token;

    const pfR = await pool.request().input('tok', sql.NVarChar(64), tok).query(\\\`
      SELECT pf.*, o.order_number, o.id AS order_id, o.ship_to_address1, o.ship_to_city,
             o.ship_to_state, o.ship_to_zip, o.ship_to_country,
             c.first_name, c.last_name, c.email, c.phone, c.company
      FROM proformas pf
      INNER JOIN orders o ON o.id = pf.order_id
      INNER JOIN customers c ON c.id = o.customer_id
      WHERE pf.auth_token = @tok
    \\\`);

    if (!pfR.recordset.length) {
      return res.status(404).send(renderPage('Link Not Found', '<div class="error-block"><h2>Authorization Link Not Found</h2><p>This link is invalid or has expired. Please contact Jupiter One USA at (347) 821-7412 or DTorchia@JupiterOneUSA.com for assistance.</p></div>'));
    }

    const pf = pfR.recordset[0];

    // Check if already signed
    const existingR = await pool.request().input('pid', sql.BigInt, pf.id)
      .query("SELECT * FROM cc_authorizations WHERE proforma_id=@pid AND status='Signed'");
    if (existingR.recordset.length) {
      const a = existingR.recordset[0];
      return res.send(renderPage('Already Signed', \\\`
        <div class="success-block">
          <div class="check-icon">\u2713</div>
          <h2>Authorization Already Submitted</h2>
          <p>This credit card authorization for proforma <strong>\\\${esc(pf.proforma_number)}</strong> was signed on <strong>\\\${new Date(a.signed_at).toLocaleString()}</strong>.</p>
          <p style="margin-top:20px;">If you need to update or resubmit your authorization, please contact us at (347) 821-7412.</p>
          <div class="info-card" style="margin-top:30px;">
            <div class="label">Total Authorized</div>
            <div class="value">\\\${fmtMoney(a.amount_authorized)}</div>
          </div>
        </div>
      \\\`));
    }

    // Render the signing form
    const fullName = [pf.first_name, pf.last_name].filter(Boolean).join(' ');
    const formHtml = \\\`
      <div class="auth-header">
        <div class="brand">
          <h1>JUPITER ONE USA</h1>
          <div class="tagline">AEROSPACE &amp; DEFENSE PARTS SUPPLY</div>
        </div>
        <div class="auth-badge">
          <div class="badge-label">CREDIT CARD AUTHORIZATION</div>
          <div class="badge-num">For \\\${esc(pf.proforma_number)}</div>
        </div>
      </div>

      <div class="amount-box">
        <div class="amount-label">Amount Authorized</div>
        <div class="amount-value">\\\${fmtMoney(pf.total)}</div>
        <div class="amount-sub">Includes 3.5% credit card convenience fee \u00B7 USD</div>
      </div>

      <form method="POST" action="/cc-auth/\\\${esc(req.params.token)}" id="ccform" onsubmit="return prepareSubmit()">

        <div class="section">
          <div class="section-num">1</div>
          <div class="section-title">Cardholder Information</div>
          <div class="grid">
            <div class="field"><label>Cardholder Name (as shown on card) <span class="req">*</span></label>
              <input type="text" name="cardholder_name" required value="\\\${esc(fullName)}"/></div>
            <div class="field"><label>Company</label>
              <input type="text" name="cardholder_company" value="\\\${esc(pf.company || '')}"/></div>
            <div class="field"><label>Title</label>
              <input type="text" name="cardholder_title" placeholder="e.g. CFO, Purchasing Manager"/></div>
            <div class="field"><label>Email</label>
              <input type="email" name="cardholder_email" value="\\\${esc(pf.email || '')}"/></div>
            <div class="field full"><label>Billing Address</label>
              <input type="text" name="billing_address1" value="\\\${esc(pf.ship_to_address1 || '')}"/></div>
            <div class="field"><label>City</label>
              <input type="text" name="billing_city" value="\\\${esc(pf.ship_to_city || '')}"/></div>
            <div class="field"><label>State</label>
              <input type="text" name="billing_state" value="\\\${esc(pf.ship_to_state || '')}"/></div>
            <div class="field"><label>ZIP <span class="req">*</span></label>
              <input type="text" name="billing_zip" required value="\\\${esc(pf.ship_to_zip || '')}"/></div>
            <div class="field"><label>Country</label>
              <input type="text" name="billing_country" value="\\\${esc(pf.ship_to_country || 'USA')}"/></div>
          </div>
        </div>

        <div class="section">
          <div class="section-num">2</div>
          <div class="section-title">Card Information</div>
          <div class="pci-notice">
            <strong>\u{1F512} Secure:</strong> For your safety, we only store the LAST 4 DIGITS of your card. A Jupiter One USA representative will call you at the number on file to securely collect the full card number for processing.
          </div>
          <div class="grid">
            <div class="field"><label>Card Type <span class="req">*</span></label>
              <select name="card_type" required>
                <option value="">Select...</option>
                <option value="Visa">Visa</option>
                <option value="MasterCard">MasterCard</option>
                <option value="American Express">American Express</option>
                <option value="Discover">Discover</option>
              </select></div>
            <div class="field"><label>Last 4 Digits of Card <span class="req">*</span></label>
              <input type="text" name="card_last4" required pattern="[0-9]{4}" maxlength="4" placeholder="1234"/></div>
            <div class="field"><label>Exp Month <span class="req">*</span></label>
              <input type="number" name="exp_month" required min="1" max="12" placeholder="MM"/></div>
            <div class="field"><label>Exp Year <span class="req">*</span></label>
              <input type="number" name="exp_year" required min="2026" max="2040" placeholder="YYYY"/></div>
          </div>
        </div>

        <div class="section">
          <div class="section-num">3</div>
          <div class="section-title">Authorization &amp; Signature</div>

          <div class="auth-text">
            By signing below, I (the cardholder) authorize <strong>Jupiter One USA LLC</strong> to charge the credit card listed above for the amount of <strong>\\\${fmtMoney(pf.total)}</strong> in payment of proforma <strong>\\\${esc(pf.proforma_number)}</strong> (Order \\\${esc(pf.order_number)}).
            <br/><br/>
            I certify that I am the authorized cardholder and have authority to make this purchase on behalf of the company listed above. I acknowledge this charge is for goods or services received and waive my right to chargeback for non-receipt unless reported in writing to Jupiter One USA LLC within ten (10) days of delivery. I have reviewed the referenced proforma and approve the total amount, which includes the disclosed 3.5% credit card convenience fee.
          </div>

          <div class="sign-area">
            <label>Sign Below <span class="req">*</span></label>
            <div class="sign-tabs">
              <button type="button" class="tab active" onclick="switchSign('draw')">Draw Signature</button>
              <button type="button" class="tab" onclick="switchSign('type')">Type Signature</button>
            </div>
            <div id="draw-pane">
              <canvas id="sigcanvas" width="600" height="160"></canvas>
              <button type="button" onclick="clearCanvas()" class="btn-clear">Clear</button>
            </div>
            <div id="type-pane" style="display:none;">
              <input type="text" id="typed-sig" placeholder="Type your full name as signature" style="font-family:'Brush Script MT',cursive;font-size:32px;"/>
            </div>
            <input type="hidden" name="signature_image" id="sig_image"/>
            <input type="hidden" name="signature_typed" id="sig_typed"/>
          </div>

          <div class="confirm-row">
            <label class="check-label">
              <input type="checkbox" required/>
              <span>I confirm all information above is accurate and I am authorized to commit this charge.</span>
            </label>
          </div>
        </div>

        <button type="submit" class="submit-btn">SUBMIT AUTHORIZATION</button>
      </form>
    \\\`;

    res.send(renderPage('Credit Card Authorization', formHtml));

  } catch (err) {
    console.error('CC auth GET error:', err);
    res.status(500).send(renderPage('Error', '<div class="error-block"><p>An error occurred. Please contact (347) 821-7412.</p><p style="font-size:11px;color:#999;">' + esc(err.message) + '</p></div>'));
  }
});

// ===== POST /cc-auth/:token =====
router.post('/cc-auth/:token', async (req, res) => {
  try {
    const pool = await getPool();
    const tok = req.params.token;
    const b = req.body;

    const pfR = await pool.request().input('tok', sql.NVarChar(64), tok)
      .query('SELECT * FROM proformas WHERE auth_token=@tok');
    if (!pfR.recordset.length) return res.status(404).send(renderPage('Link Not Found', '<div class="error-block"><h2>Link Not Found</h2></div>'));
    const pf = pfR.recordset[0];

    // Reject if already signed
    const existingR = await pool.request().input('pid', sql.BigInt, pf.id)
      .query("SELECT id FROM cc_authorizations WHERE proforma_id=@pid AND status='Signed'");
    if (existingR.recordset.length) {
      return res.redirect('/cc-auth/' + tok);
    }

    // Validate last4
    const last4 = (b.card_last4 || '').replace(/\\D/g, '').slice(-4);
    if (last4.length !== 4) {
      return res.status(400).send(renderPage('Invalid', '<div class="error-block"><p>Card last 4 must be 4 digits.</p><a href="/cc-auth/' + tok + '">Go Back</a></div>'));
    }

    const signerIp = (req.headers['x-forwarded-for'] || req.connection.remoteAddress || '').toString().split(',')[0].trim();

    // Insert authorization
    await pool.request()
      .input('oid', sql.BigInt, pf.order_id)
      .input('pid', sql.BigInt, pf.id)
      .input('ct', sql.NVarChar(20), b.card_type || null)
      .input('l4', sql.NVarChar(4), last4)
      .input('em', sql.Int, parseInt(b.exp_month) || null)
      .input('ey', sql.Int, parseInt(b.exp_year) || null)
      .input('bz', sql.NVarChar(20), b.billing_zip || null)
      .input('cn', sql.NVarChar(150), b.cardholder_name || '')
      .input('ctl', sql.NVarChar(100), b.cardholder_title || null)
      .input('ce', sql.NVarChar(150), b.cardholder_email || null)
      .input('cc', sql.NVarChar(200), b.cardholder_company || null)
      .input('ba', sql.NVarChar(200), b.billing_address1 || null)
      .input('bc', sql.NVarChar(100), b.billing_city || null)
      .input('bs', sql.NVarChar(50), b.billing_state || null)
      .input('bco', sql.NVarChar(50), b.billing_country || null)
      .input('si', sql.NVarChar(sql.MAX), b.signature_image || null)
      .input('st', sql.NVarChar(150), b.signature_typed || null)
      .input('aa', sql.Decimal(12,2), pf.total)
      .input('sat', sql.DateTime, new Date())
      .input('sip', sql.NVarChar(45), signerIp)
      .input('sua', sql.NVarChar(500), (req.headers['user-agent'] || '').slice(0, 500))
      .query(\\\`INSERT INTO cc_authorizations
        (order_id, proforma_id, card_type, card_last4, exp_month, exp_year, billing_zip,
         cardholder_name, cardholder_title, cardholder_email, cardholder_company,
         billing_address1, billing_city, billing_state, billing_country,
         signature_image, signature_typed, amount_authorized, signed_at, signer_ip, signer_user_agent, status)
        VALUES (@oid, @pid, @ct, @l4, @em, @ey, @bz, @cn, @ctl, @ce, @cc, @ba, @bc, @bs, @bco, @si, @st, @aa, @sat, @sip, @sua, 'Signed')\\\`);

    // Mark proforma authorized
    await pool.request().input('pid', sql.BigInt, pf.id).query(
      "UPDATE proformas SET status='Authorized', authorized_at=GETDATE(), updated_at=GETDATE() WHERE id=@pid"
    );

    // Notify admin
    try {
      const nodemailer = await import('nodemailer');
      const transporter = nodemailer.default.createTransport({
        host: process.env.SMTP_HOST,
        port: parseInt(process.env.SMTP_PORT) || 587,
        secure: false,
        auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
      });
      const adminEmail = process.env.ADMIN_EMAIL || 'DTorchia@jupiteroneusa.com';
      const baseUrl = process.env.PUBLIC_URL || 'https://jupiteroneusa.com';
      const adminHtml = '<div style="font-family:Arial,sans-serif;max-width:640px;margin:0 auto;">' +
        '<div style="background:#0a1628;padding:20px;border-bottom:3px solid #c8932a;">' +
        '<h2 style="color:#c8932a;margin:0;">CC AUTHORIZATION RECEIVED</h2>' +
        '<p style="color:#aaa;margin:4px 0 0;font-size:12px;">' + b.cardholder_name + ' signed for ' + pf.proforma_number + '</p>' +
        '</div>' +
        '<div style="background:#fff;padding:28px;">' +
        '<table style="width:100%;border-collapse:collapse;font-size:13px;">' +
        '<tr><td style="color:#888;padding:4px 0;width:160px;">Proforma</td><td><strong>' + pf.proforma_number + '</strong></td></tr>' +
        '<tr><td style="color:#888;padding:4px 0;">Cardholder</td><td>' + b.cardholder_name + '</td></tr>' +
        '<tr><td style="color:#888;padding:4px 0;">Company</td><td>' + (b.cardholder_company || '-') + '</td></tr>' +
        '<tr><td style="color:#888;padding:4px 0;">Card</td><td>' + (b.card_type || '-') + ' ending ' + last4 + ', exp ' + (b.exp_month || '?') + '/' + (b.exp_year || '?') + '</td></tr>' +
        '<tr><td style="color:#888;padding:4px 0;">Billing ZIP</td><td>' + (b.billing_zip || '-') + '</td></tr>' +
        '<tr><td style="color:#888;padding:4px 0;">Amount</td><td style="font-weight:bold;color:#c8932a;font-size:1.1rem;">' + fmtMoney(pf.total) + '</td></tr>' +
        '<tr><td style="color:#888;padding:4px 0;">Signer IP</td><td>' + (signerIp || '-') + '</td></tr>' +
        '</table>' +
        '<p style="margin-top:20px;"><strong>NEXT STEPS:</strong> Call the customer to collect the full card number, then process via your payment processor.</p>' +
        '<p style="margin-top:20px;"><a href="' + baseUrl + '/admin/orders/' + pf.order_id + '?tab=proforma" style="background:#c8932a;color:#0a1628;padding:10px 20px;text-decoration:none;font-weight:700;">View Order</a></p>' +
        '</div></div>';
      await transporter.sendMail({
        from: '"Jupiter One USA Auth" <' + adminEmail + '>',
        to: adminEmail,
        subject: 'CC Auth signed: ' + pf.proforma_number + ' - ' + fmtMoney(pf.total),
        html: adminHtml
      });
      console.log('CC Auth admin notification sent:', pf.proforma_number);
    } catch (emailErr) {
      console.error('CC auth admin notify error:', emailErr.message);
    }

    // Customer confirmation page
    res.send(renderPage('Authorization Submitted', \\\`
      <div class="success-block">
        <div class="check-icon">\u2713</div>
        <h2>Authorization Submitted</h2>
        <p>Thank you. Your credit card authorization for proforma <strong>\\\${esc(pf.proforma_number)}</strong> has been received.</p>
        <p>A Jupiter One USA representative will contact you shortly to securely collect the full card number for processing.</p>
        <div class="info-card" style="margin-top:30px;">
          <div class="label">Total Authorized</div>
          <div class="value">\\\${fmtMoney(pf.total)}</div>
        </div>
        <p style="margin-top:30px;font-size:13px;color:#7a8a9a;">Reference: \\\${esc(pf.proforma_number)} \u00B7 Signed \\\${new Date().toLocaleString()}</p>
      </div>
    \\\`));

  } catch (err) {
    console.error('CC auth POST error:', err);
    res.status(500).send(renderPage('Error', '<div class="error-block"><p>An error occurred submitting your authorization. Please contact (347) 821-7412.</p></div>'));
  }
});

// ===== Shared page wrapper =====
function renderPage(title, body) {
  return \\\`<!doctype html><html><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>\\\${esc(title)} \u2014 Jupiter One USA</title>
<style>
* { box-sizing: border-box; }
body { margin: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif; background: #f4f5f7; color: #1a1a1a; padding: 20px; line-height: 1.5; }
.container { max-width: 800px; margin: 0 auto; background: #fff; border-radius: 8px; overflow: hidden; box-shadow: 0 4px 20px rgba(0,0,0,0.08); }
.auth-header { background: #0a1628; color: #fff; padding: 24px 32px; display: flex; justify-content: space-between; align-items: center; border-bottom: 3px solid #c8932a; }
.brand h1 { margin: 0; font-size: 22px; color: #c8932a; letter-spacing: -0.5px; }
.brand .tagline { font-size: 9px; letter-spacing: 0.2em; color: #c8932a; margin-top: 4px; }
.auth-badge { text-align: right; }
.badge-label { font-size: 10px; letter-spacing: 0.15em; color: #7a8a9a; }
.badge-num { font-size: 18px; color: #c8932a; font-weight: 700; margin-top: 4px; font-family: 'Courier New', monospace; }
.amount-box { background: #fef9ec; border-bottom: 1px solid #f0e0c0; padding: 24px 32px; text-align: center; }
.amount-label { font-size: 11px; letter-spacing: 0.15em; color: #7a8a9a; text-transform: uppercase; }
.amount-value { font-size: 38px; font-weight: 700; color: #c8932a; margin: 8px 0 4px; }
.amount-sub { font-size: 12px; color: #7a8a9a; }
.section { padding: 28px 32px; border-top: 1px solid #eef1f5; }
.section-num { display: inline-block; width: 26px; height: 26px; background: #c8932a; color: #0a1628; border-radius: 50%; text-align: center; line-height: 26px; font-weight: 700; margin-right: 10px; }
.section-title { display: inline-block; font-size: 15px; font-weight: 600; color: #0a1628; margin-bottom: 16px; }
.grid { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; }
.field { display: flex; flex-direction: column; }
.field.full { grid-column: 1 / -1; }
.field label { font-size: 11px; letter-spacing: 0.05em; text-transform: uppercase; color: #7a8a9a; font-weight: 600; margin-bottom: 4px; }
.field .req { color: #e05050; }
.field input, .field select { padding: 10px 12px; border: 1px solid #d0d6df; border-radius: 4px; font-size: 14px; font-family: inherit; background: #fff; }
.field input:focus, .field select:focus { outline: none; border-color: #c8932a; box-shadow: 0 0 0 3px rgba(200,147,42,0.15); }
.pci-notice { background: #ecf3fb; border-left: 3px solid #1976d2; padding: 12px 14px; font-size: 13px; color: #0a1628; margin-bottom: 14px; border-radius: 0 4px 4px 0; }
.auth-text { background: #f8f9fa; padding: 16px 18px; border-radius: 4px; font-size: 13px; color: #444; margin-bottom: 18px; }
.sign-area { margin-top: 14px; }
.sign-area > label { display: block; font-size: 11px; letter-spacing: 0.05em; text-transform: uppercase; color: #7a8a9a; font-weight: 600; margin-bottom: 8px; }
.sign-tabs { display: flex; gap: 0; margin-bottom: 10px; }
.sign-tabs .tab { padding: 8px 16px; border: 1px solid #d0d6df; background: #f4f5f7; color: #7a8a9a; cursor: pointer; font-size: 13px; font-family: inherit; }
.sign-tabs .tab:first-child { border-radius: 4px 0 0 4px; }
.sign-tabs .tab:last-child { border-radius: 0 4px 4px 0; border-left: none; }
.sign-tabs .tab.active { background: #c8932a; color: #0a1628; border-color: #c8932a; font-weight: 600; }
#sigcanvas { border: 2px dashed #c8932a; width: 100%; max-width: 600px; height: 160px; background: #fffdf6; touch-action: none; display: block; border-radius: 4px; }
#typed-sig { width: 100%; padding: 24px 16px; border: 2px dashed #c8932a; background: #fffdf6; border-radius: 4px; }
.btn-clear { margin-top: 8px; background: none; border: 1px solid #d0d6df; padding: 4px 12px; border-radius: 4px; font-size: 12px; cursor: pointer; color: #7a8a9a; }
.confirm-row { margin-top: 18px; }
.check-label { display: flex; align-items: flex-start; gap: 10px; font-size: 13px; color: #444; cursor: pointer; padding: 12px; background: #f8f9fa; border-radius: 4px; }
.check-label input { margin-top: 2px; }
.submit-btn { display: block; width: 100%; margin: 0; padding: 16px; background: #c8932a; color: #0a1628; font-size: 14px; font-weight: 700; letter-spacing: 0.1em; border: none; cursor: pointer; transition: background 0.2s; }
.submit-btn:hover { background: #b8851e; }
.success-block, .error-block { padding: 50px 40px; text-align: center; }
.check-icon { font-size: 64px; color: #4caf50; line-height: 1; margin-bottom: 16px; }
.success-block h2, .error-block h2 { margin: 0 0 12px; font-size: 24px; color: #0a1628; }
.success-block p, .error-block p { color: #555; margin: 8px 0; }
.info-card { display: inline-block; padding: 18px 32px; background: #fef9ec; border: 1px solid #f0e0c0; border-radius: 4px; }
.info-card .label { font-size: 11px; letter-spacing: 0.15em; color: #7a8a9a; text-transform: uppercase; }
.info-card .value { font-size: 28px; font-weight: 700; color: #c8932a; margin-top: 6px; }
@media (max-width: 640px) { .grid { grid-template-columns: 1fr; } .auth-header { flex-direction: column; align-items: flex-start; gap: 12px; } .auth-badge { text-align: left; } .section { padding: 24px 20px; } }
</style></head>
<body>
<div class="container">
\\\${body}
</div>
<script>
var ctx, drawing = false, hasDrawn = false;
function initCanvas() {
  var c = document.getElementById('sigcanvas');
  if (!c) return;
  ctx = c.getContext('2d');
  ctx.strokeStyle = '#0a1628';
  ctx.lineWidth = 2.2;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  function getPos(e) {
    var r = c.getBoundingClientRect();
    var x = (e.touches ? e.touches[0].clientX : e.clientX) - r.left;
    var y = (e.touches ? e.touches[0].clientY : e.clientY) - r.top;
    return { x: x * (c.width / r.width), y: y * (c.height / r.height) };
  }
  function start(e) { e.preventDefault(); drawing = true; hasDrawn = true; var p = getPos(e); ctx.beginPath(); ctx.moveTo(p.x, p.y); }
  function move(e) { if (!drawing) return; e.preventDefault(); var p = getPos(e); ctx.lineTo(p.x, p.y); ctx.stroke(); }
  function end(e) { drawing = false; }
  c.addEventListener('mousedown', start); c.addEventListener('mousemove', move);
  c.addEventListener('mouseup', end); c.addEventListener('mouseleave', end);
  c.addEventListener('touchstart', start); c.addEventListener('touchmove', move); c.addEventListener('touchend', end);
}
function clearCanvas() { if (ctx) { var c = document.getElementById('sigcanvas'); ctx.clearRect(0, 0, c.width, c.height); hasDrawn = false; } }
function switchSign(mode) {
  var tabs = document.querySelectorAll('.sign-tabs .tab');
  tabs.forEach(function(t) { t.classList.remove('active'); });
  if (mode === 'draw') {
    tabs[0].classList.add('active');
    document.getElementById('draw-pane').style.display = '';
    document.getElementById('type-pane').style.display = 'none';
  } else {
    tabs[1].classList.add('active');
    document.getElementById('draw-pane').style.display = 'none';
    document.getElementById('type-pane').style.display = '';
  }
}
function prepareSubmit() {
  var typed = document.getElementById('typed-sig');
  if (typed && typed.value.trim().length > 0) {
    document.getElementById('sig_typed').value = typed.value.trim();
    return true;
  }
  if (!hasDrawn) {
    alert('Please sign by drawing on the canvas or typing your name.');
    return false;
  }
  var c = document.getElementById('sigcanvas');
  document.getElementById('sig_image').value = c.toDataURL('image/png');
  return true;
}
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initCanvas);
else initCanvas();
</script>
</body></html>\\\`;
}

export default router;
`;

fs.writeFileSync('routes/ccAuth.js', ccAuthRoutes);
console.log('+ Created routes/ccAuth.js');

// ============================================================
// 2) Mount in server.js
// ============================================================
const serverPath = 'server.js';
if (!fs.existsSync(serverPath)) {
  console.error('! server.js not found');
  process.exit(1);
}
const origServer = fs.readFileSync(serverPath, 'utf8');
let srv = origServer;

if (srv.includes('CC_AUTH_MOUNT_V1')) {
  console.log('- server.js already mounts ccAuth');
} else {
  // Find a good place to import — after other route imports
  const importPattern = /import\s+\w+\s+from\s+['"]\.\/routes\/\w+\.js['"];?/g;
  const imports = [...srv.matchAll(importPattern)];
  if (!imports.length) {
    console.error('! could not find an import pattern in server.js');
    process.exit(1);
  }
  const lastImport = imports[imports.length - 1];
  const insertAt = lastImport.index + lastImport[0].length;
  srv = srv.slice(0, insertAt) + "\nimport ccAuthRouter from './routes/ccAuth.js'; // CC_AUTH_MOUNT_V1" + srv.slice(insertAt);

  // Now mount — find the first app.use() with a router and add ours near there
  const mountIdx = srv.indexOf('app.use(');
  if (mountIdx < 0) { console.error('! no app.use() found'); process.exit(1); }
  // Find the line and inject AFTER express.json/urlencoded body parsers if any
  // Strategy: place it right before app.use('/api'... or first router mount
  const apiMount = srv.indexOf("app.use('/api");
  const adminMount = srv.indexOf("app.use('/admin");
  let target = apiMount;
  if (target < 0 || (adminMount > 0 && adminMount < target)) target = adminMount;
  if (target < 0) target = mountIdx;

  // Insert before target
  const insertion = "app.use('/', ccAuthRouter); // CC_AUTH_MOUNT_V1 - public e-sign\n";
  srv = srv.slice(0, target) + insertion + srv.slice(target);

  fs.writeFileSync(serverPath + '.ccauth.bak', origServer);
  fs.writeFileSync(serverPath, srv);
  try {
    execSync('node -c "' + serverPath + '"', { stdio: 'pipe' });
    console.log('+ Mounted ccAuthRouter at /cc-auth/:token in server.js');
  } catch (err) {
    fs.writeFileSync(serverPath, origServer);
    console.error('! server.js syntax error - REVERTED');
    console.error(err.message);
    process.exit(1);
  }
}

console.log('SUCCESS');
