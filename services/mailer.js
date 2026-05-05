// services/mailer.js
import nodemailer from 'nodemailer';
import { getPool, sql } from '../db/connect.js';
import 'dotenv/config';

const transporter = nodemailer.createTransport({
  host:   process.env.SMTP_HOST,
  port:   parseInt(process.env.SMTP_PORT) || 587,
  secure: false,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

// ✅ FIXED: FROM must be your verified sender domain, not SMTP_USER ("apikey")
const FROM = `"Jupiter One USA" <DTorchia@jupiteroneusa.com>`;

const COMPANY = {
  name:    'Jupiter One USA LLC',
  address: '400 N Tampa St, Suite 1550, Tampa FL',
  phone:   '+1 (347) 821-7412',
  email:   'DTorchia@jupiteroneusa.com',
};

// ── Log email to DB ───────────────────────────────────────────
async function logEmail({ to, subject, type, entityType, entityId, success, error, sentBy }) {
  try {
    const pool = await getPool();
    await pool.request()
      .input('to',         sql.NVarChar(150), to)
      .input('subject',    sql.NVarChar(255), subject)
      .input('type',       sql.NVarChar(50),  type)
      .input('entityType', sql.NVarChar(50),  entityType || null)
      .input('entityId',   sql.BigInt,        entityId || null)
      .input('success',    sql.Bit,           success ? 1 : 0)
      .input('error',      sql.NVarChar(500), error || null)
      .input('sentBy',     sql.BigInt,        sentBy || null)
      .query(`
        INSERT INTO email_log (to_email, subject, email_type, entity_type, entity_id, success, error_message, sent_by)
        VALUES (@to, @subject, @type, @entityType, @entityId, @success, @error, @sentBy)
      `);
  } catch (_) {}
}

async function send({ to, bcc, subject, html, type, entityType, entityId, sentBy }) {
  try {
    const mailOpts = { from: FROM, to, subject, html }; if (bcc) mailOpts.bcc = bcc; await transporter.sendMail(mailOpts); if (cc) mailOpts.cc = cc;
    await logEmail({ to, subject, type, entityType, entityId, success: true, sentBy });
  } catch (err) {
    await logEmail({ to, subject, type, entityType, entityId, success: false, error: err.message, sentBy });
    console.error(`Email failed [${type}] to ${to}:`, err.message);
    throw err; // re-throw so callers can catch and log
  }
}

// ── Shared layout wrapper ─────────────────────────────────────
function layout(content) {
  return `
  <div style="font-family:Arial,sans-serif;max-width:640px;margin:0 auto;background:#f5f5f5;">
    <div style="background:#0a1628;padding:20px 28px;border-bottom:3px solid #c8932a;">
      <h2 style="color:#c8932a;margin:0;font-size:18px;letter-spacing:.06em;">JUPITER ONE USA LLC</h2>
      <p style="color:#aaa;margin:4px 0 0;font-size:12px;">Aerospace &amp; Defense Component Supplier</p>
    </div>
    <div style="background:#fff;padding:28px;">
      ${content}
    </div>
    <div style="background:#0a1628;padding:14px 28px;">
      <p style="color:#555;font-size:11px;margin:0;">
        ${COMPANY.address} &nbsp;|&nbsp;
        <a href="tel:${COMPANY.phone}" style="color:#555;">${COMPANY.phone}</a> &nbsp;|&nbsp;
        <a href="mailto:${COMPANY.email}" style="color:#555;">${COMPANY.email}</a>
      </p>
    </div>
  </div>`;
}

// ── EMAIL TYPES ───────────────────────────────────────────────

export async function sendWelcomeEmail({ customer }) {
  const subject = `Welcome to Jupiter One USA, ${customer.first_name}`;
  await send({
    to: customer.email, subject,
    type: 'welcome', entityType: 'customer', entityId: customer.id,
    html: layout(`
      <p style="font-size:15px;">Hi ${customer.first_name},</p>
      <p style="font-size:14px;color:#444;line-height:1.7;">
        Welcome to Jupiter One USA. Your account is active and you can now search our NSN catalog,
        submit RFQs, and track your orders — all in one place.
      </p>
      <p style="font-size:14px;color:#444;">
        Our team is here to help you source the right part at the right price.
        Response times are typically within 24 hours of RFQ submission.
      </p>
      <div style="margin-top:24px;">
        <a href="${process.env.FRONTEND_URL}/account"
           style="background:#c8932a;color:#000;padding:12px 28px;text-decoration:none;font-weight:bold;font-size:13px;">
          GO TO MY ACCOUNT →
        </a>
      </div>
    `),
  });
}

export async function sendEmailVerification({ customer, token }) {
  const link = `${process.env.FRONTEND_URL}/verify-email?token=${token}`;
  const subject = 'Verify your Jupiter One USA email address';
  await send({
    to: customer.email, subject,
    type: 'email_verification', entityType: 'customer', entityId: customer.id,
    html: layout(`
      <p style="font-size:15px;">Hi ${customer.first_name},</p>
      <p style="font-size:14px;color:#444;line-height:1.7;">
        Please verify your email address to activate your Jupiter One USA account.
      </p>
      <div style="margin-top:24px;margin-bottom:24px;">
        <a href="${link}"
           style="background:#c8932a;color:#000;padding:12px 28px;text-decoration:none;font-weight:bold;font-size:13px;">
          VERIFY EMAIL →
        </a>
      </div>
      <p style="font-size:12px;color:#aaa;">This link expires in 24 hours.</p>
    `),
  });
}

export async function sendPasswordReset({ customer, token }) {
  const link = `${process.env.FRONTEND_URL}/reset-password?token=${token}`;
  const subject = 'Reset your Jupiter One USA password';
  await send({
    to: customer.email, subject,
    type: 'password_reset', entityType: 'customer', entityId: customer.id,
    html: layout(`
      <p style="font-size:15px;">Hi ${customer.first_name},</p>
      <p style="font-size:14px;color:#444;line-height:1.7;">
        We received a request to reset your password. Click the button below to proceed.
        If you did not request this, you can safely ignore this email.
      </p>
      <div style="margin-top:24px;margin-bottom:24px;">
        <a href="${link}"
           style="background:#c8932a;color:#000;padding:12px 28px;text-decoration:none;font-weight:bold;font-size:13px;">
          RESET PASSWORD →
        </a>
      </div>
      <p style="font-size:12px;color:#aaa;">This link expires in 1 hour.</p>
    `),
  });
}

export async function sendRfqReceivedCustomer({ customer, rfq }) {
  const subject = `RFQ Received — ${rfq.rfq_number} | Jupiter One USA`;
  await send({
    to: customer.email, subject,
    type: 'rfq_received', entityType: 'rfq', entityId: rfq.id,
    html: layout(`
      <p style="font-size:15px;">Hi ${customer.first_name},</p>
      <p style="font-size:14px;color:#444;line-height:1.7;">
        We have received your Request for Quote <strong>${rfq.rfq_number}</strong>
        containing <strong>${rfq.line_count} line item${rfq.line_count !== 1 ? 's' : ''}</strong>.
        We will begin processing your request immediately and you will
        hear back within <strong>24 hours</strong> with pricing and availability.
      </p>
      <div style="background:#f9f9f9;border-left:3px solid #c8932a;padding:14px 20px;margin:20px 0;font-size:13px;color:#666;">
        <strong>Reference:</strong> ${rfq.rfq_number}<br/>
        <strong>Priority:</strong> ${rfq.priority}<br/>
        <strong>Submitted:</strong> ${new Date().toLocaleString('en-US', { timeZone: 'America/New_York' })}
      </div>
      <p style="font-size:14px;color:#444;">
        Need it urgently? Call us directly:<br/>
        📞 <a href="tel:${COMPANY.phone}">${COMPANY.phone}</a>
      </p>
      <div style="margin-top:20px;">
        <a href="${process.env.FRONTEND_URL}/account/rfqs/${rfq.id}"
           style="background:#c8932a;color:#000;padding:12px 28px;text-decoration:none;font-weight:bold;font-size:13px;">
          TRACK MY RFQ →
        </a>
      </div>
    `),
  });
}

export async function sendRfqNotificationAdmin({ rfq, customer, lines }) {
  const lineRows = lines.map(l => `
    <tr>
      <td style="padding:8px 12px;border-bottom:1px solid #eee;font-family:monospace;">${l.nsn || l.part_number || '—'}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #eee;">${l.item_name || '—'}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #eee;text-align:center;">${l.quantity}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #eee;">${l.condition_code || '—'}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #eee;">${l.target_price ? '$' + Number(l.target_price).toFixed(2) : '—'}</td>
    </tr>
  `).join('');

  const subject = `🔔 New RFQ ${rfq.rfq_number} — ${customer.company || customer.first_name + ' ' + customer.last_name}`;
  await send({
    to: process.env.RFQ_NOTIFY_EMAIL || COMPANY.email,
    subject,
    type: 'rfq_notification', entityType: 'rfq', entityId: rfq.id,
    html: layout(`
      <h3 style="color:#c8932a;margin-top:0;">${rfq.rfq_number} — ${rfq.priority} Priority</h3>
      <table style="width:100%;font-size:13px;border-collapse:collapse;margin-bottom:20px;">
        <tr><td style="color:#888;padding:6px 0;width:130px;">Customer</td><td><strong>${customer.first_name} ${customer.last_name}</strong></td></tr>
        <tr><td style="color:#888;padding:6px 0;">Company</td><td>${customer.company || '—'}</td></tr>
        <tr><td style="color:#888;padding:6px 0;">Email</td><td><a href="mailto:${customer.email}">${customer.email}</a></td></tr>
        <tr><td style="color:#888;padding:6px 0;">Phone</td><td>${customer.phone || '—'}</td></tr>
        <tr><td style="color:#888;padding:6px 0;">Lines</td><td>${lines.length}</td></tr>
        <tr><td style="color:#888;padding:6px 0;">Notes</td><td>${rfq.notes || '—'}</td></tr>
      </table>
      <table style="width:100%;border-collapse:collapse;font-size:13px;">
        <thead>
          <tr style="background:#f0f0f0;">
            <th style="padding:8px 12px;text-align:left;">NSN / Part#</th>
            <th style="padding:8px 12px;text-align:left;">Item</th>
            <th style="padding:8px 12px;text-align:center;">Qty</th>
            <th style="padding:8px 12px;text-align:left;">Condition</th>
            <th style="padding:8px 12px;text-align:left;">Target $</th>
          </tr>
        </thead>
        <tbody>${lineRows}</tbody>
      </table>
      <div style="margin-top:20px;">
        <a href="${process.env.FRONTEND_URL}/admin/rfq/${rfq.id}"
           style="background:#c8932a;color:#000;padding:12px 28px;text-decoration:none;font-weight:bold;font-size:13px;">
          OPEN IN ADMIN →
        </a>
      </div>
    `),
  });
}

export async function sendQuoteToCustomer({ customer, quote, lines, pdfUrl, rfq, ccEmails, attachPdf }) {
  const lineRows = lines.map(l => `
    <tr>
      <td style="padding:8px 12px;border-bottom:1px solid #eee;font-family:monospace;">${l.nsn || l.part_number || '—'}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #eee;">${l.item_name || '—'}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #eee;text-align:center;">${l.quantity}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #eee;">${l.condition_code || 'NE'}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #eee;text-align:right;">$${Number(l.unit_price).toFixed(2)}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #eee;text-align:right;font-weight:bold;">$${Number(l.line_total).toFixed(2)}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #eee;color:#666;">${l.lead_time_text || (l.lead_time_days ? l.lead_time_days + ' days' : '—')}</td>
    </tr>
  `).join('');

  const subject = `Quote ${quote.quote_number} — Jupiter One USA`;
  const now = new Date();
  const quoteDate = now.toLocaleDateString('en-US', { month:'2-digit', day:'2-digit', year:'numeric' }) + ' ' + now.toLocaleTimeString('en-US', { hour:'2-digit', minute:'2-digit', timeZone:'America/New_York' }) + ' ET';
  const validDate = new Date(quote.valid_until).toLocaleDateString('en-US', { month:'2-digit', day:'2-digit', year:'numeric' });
  const personalMsg = quote.personal_message ? `<div style="background:#f0f7ff;border-left:3px solid #4a90d9;padding:14px 20px;margin-bottom:20px;font-size:14px;color:#333;line-height:1.6;">${quote.personal_message}</div>` : '';

  await send({
    to: customer.email,
    bcc: COMPANY.email,
    cc: ccEmails ? ccEmails.split(',').map(e => e.trim()).filter(Boolean).join(',') : undefined,
    subject,
    type: 'quote_sent', entityType: 'quote', entityId: quote.id,
    html: layout(`
      ${personalMsg}
      <table style="width:100%;border-collapse:collapse;font-size:12px;margin-bottom:20px;border:1px solid #ddd;">
        <tr>
          <td style="padding:10px 14px;border-right:1px solid #eee;width:50%;vertical-align:top;">
            <div style="font-size:11px;color:#888;text-transform:uppercase;letter-spacing:.05em;margin-bottom:6px;">Bill To</div>
            <strong style="font-size:13px;">${customer.first_name} ${customer.last_name}</strong><br/>
            ${customer.company ? customer.company + '<br/>' : ''}
            <a href="mailto:${customer.email}" style="color:#c8932a;">${customer.email}</a>
          </td>
          <td style="padding:10px 14px;vertical-align:top;">
            <div style="font-size:11px;color:#888;text-transform:uppercase;letter-spacing:.05em;margin-bottom:6px;">Quote Details</div>
            <table style="font-size:12px;width:100%;border-collapse:collapse;">
              <tr><td style="color:#888;padding:2px 0;width:100px;">Quote #</td><td style="font-weight:600;">${quote.quote_number}</td></tr>
              ${rfq ? '<tr><td style="color:#888;padding:2px 0;">RFQ #</td><td>' + (rfq.rfq_number||'') + '</td></tr>' : ''}
              ${rfq && rfq.customer_ref ? '<tr><td style="color:#888;padding:2px 0;">Your Ref</td><td style="font-weight:600;color:#c8932a;">' + rfq.customer_ref + '</td></tr>' : ''}
              <tr><td style="color:#888;padding:2px 0;">Status</td><td><span style="background:#c8932a;color:#000;padding:1px 8px;font-size:11px;font-weight:700;">QUOTED</span></td></tr>
              <tr><td style="color:#888;padding:2px 0;">Issued</td><td>${quoteDate}</td></tr>
              <tr><td style="color:#888;padding:2px 0;">Valid Until</td><td style="font-weight:600;">${validDate}</td></tr>
              <tr><td style="color:#888;padding:2px 0;">Priority</td><td>${rfq && rfq.priority ? rfq.priority : 'Standard'}</td></tr>
              <tr><td style="color:#888;padding:2px 0;">Sales Rep</td><td>Derek Torchia</td></tr>
            </table>
          </td>
        </tr>
      </table>
      <table style="width:100%;border-collapse:collapse;font-size:13px;margin:0 0 20px 0;border:1px solid #ddd;">
        <thead>
          <tr style="background:#0a1628;color:#fff;">
            <th style="padding:10px 12px;text-align:left;">NSN / Part#</th>
            <th style="padding:10px 12px;text-align:left;">Description</th>
            <th style="padding:10px 12px;text-align:center;">Qty</th>
            <th style="padding:10px 12px;text-align:left;">Condition</th>
            <th style="padding:10px 12px;text-align:right;">Unit Price</th>
            <th style="padding:10px 12px;text-align:right;">Total</th>
            <th style="padding:10px 12px;text-align:left;">Lead Time</th>
          </tr>
        </thead>
        <tbody>${lineRows}</tbody>
        <tfoot>
          <tr style="background:#f5f5f5;">
            <td colspan="5" style="padding:10px 12px;text-align:right;font-weight:bold;font-size:14px;">Quote Total:</td>
            <td style="padding:10px 12px;text-align:right;font-weight:bold;color:#c8932a;font-size:14px;">$${Number(quote.total_amount).toFixed(2)}</td>
            <td></td>
          </tr>
        </tfoot>
      </table>
      ${quote.notes ? '<div style="background:#fff8e7;border-left:3px solid #c8932a;padding:12px 16px;font-size:13px;color:#555;margin-bottom:16px;">' + quote.notes + '</div>' : ''}
      <div style="margin:20px 0;">
        <a href="${process.env.FRONTEND_URL}/account/quotes/${quote.id}/accept"
           style="background:#c8932a;color:#000;padding:12px 28px;text-decoration:none;font-weight:bold;font-size:13px;display:inline-block;">
          ACCEPT QUOTE &#8594;
        </a>
      </div>
      <div style="background:#f9f9f9;border:1px solid #eee;padding:14px 18px;font-size:11px;color:#777;line-height:1.9;margin-top:20px;">
        <strong style="color:#555;font-size:12px;display:block;margin-bottom:6px;">Terms &amp; Conditions</strong>
        <div><strong>Payment:</strong> Credit Card or Wire Transfer. Credit card payments subject to a 3.5% processing fee. Wire transfer details provided upon order confirmation.</div>
        <div><strong>Cancellation:</strong> All orders are non-cancellable and non-returnable once confirmed.</div>
        <div><strong>Delivery:</strong> Delivery times are estimated and not guaranteed. Delivery claims must be reported within 7 days of receipt.</div>
        <div><strong>Validity:</strong> Quote valid for 30 days. Prices subject to availability at time of order confirmation.</div>
        <div><strong>Condition Codes:</strong> NE=New, NS=New Surplus, OH=Overhaul, AR=As Removed, SV=Serviceable.</div>
      </div>
    `),
  });
}


export async function sendOrderConfirmation({ customer, order }) {
  const subject = `Order Confirmed — ${order.order_number} | Jupiter One USA`;
  await send({
    to: customer.email, subject,
    type: 'order_confirmation', entityType: 'order', entityId: order.id,
    html: layout(`
      <p style="font-size:15px;">Hi ${customer.first_name},</p>
      <p style="font-size:14px;color:#444;line-height:1.7;">
        Thank you for your order. <strong>${order.order_number}</strong> has been confirmed
        and our team will begin processing immediately.
        You will receive a shipping notification with tracking information once your order ships.
      </p>
      <div style="background:#f9f9f9;border-left:3px solid #c8932a;padding:14px 20px;margin:20px 0;font-size:13px;color:#666;">
        <strong>Order:</strong> ${order.order_number}<br/>
        <strong>Total:</strong> $${Number(order.total_amount).toFixed(2)}<br/>
        <strong>Payment:</strong> ${order.payment_terms}
      </div>
      <p style="font-size:13px;color:#444;">
        Domestic orders typically ship within 3 business days.
        International orders require 7–10 business days.
      </p>
      <div style="margin-top:20px;">
        <a href="${process.env.FRONTEND_URL}/account/orders/${order.id}"
           style="background:#c8932a;color:#000;padding:12px 28px;text-decoration:none;font-weight:bold;font-size:13px;">
          TRACK ORDER →
        </a>
      </div>
    `),
  });
}

export async function sendShipmentNotification({ customer, order, shipment }) {
  const subject = `Your Order Has Shipped — ${order.order_number} | Jupiter One USA`;
  await send({
    to: customer.email, subject,
    type: 'shipment_notification', entityType: 'shipment', entityId: shipment.id,
    html: layout(`
      <p style="font-size:15px;">Hi ${customer.first_name},</p>
      <p style="font-size:14px;color:#444;line-height:1.7;">
        Your order <strong>${order.order_number}</strong> has shipped.
      </p>
      <div style="background:#f9f9f9;border-left:3px solid #c8932a;padding:14px 20px;margin:20px 0;font-size:13px;color:#666;">
        <strong>Carrier:</strong> ${shipment.carrier}<br/>
        <strong>Tracking:</strong> ${shipment.tracking_number}<br/>
        <strong>Est. Delivery:</strong> ${shipment.estimated_delivery ? new Date(shipment.estimated_delivery).toLocaleDateString() : 'TBD'}
      </div>
      ${shipment.tracking_url
        ? `<a href="${shipment.tracking_url}" style="background:#c8932a;color:#000;padding:12px 28px;text-decoration:none;font-weight:bold;font-size:13px;">TRACK SHIPMENT →</a>`
        : ''}
    `),
  });
}

export async function sendInvoice({ customer, invoice, pdfUrl }) {
  const subject = `Invoice ${invoice.invoice_number} — Jupiter One USA`;
  await send({
    to: customer.email, subject,
    type: 'invoice', entityType: 'invoice', entityId: invoice.id,
    html: layout(`
      <p style="font-size:15px;">Hi ${customer.first_name},</p>
      <p style="font-size:14px;color:#444;line-height:1.7;">
        Please find invoice <strong>${invoice.invoice_number}</strong> for your recent order.
      </p>
      <div style="background:#f9f9f9;border-left:3px solid #c8932a;padding:14px 20px;margin:20px 0;font-size:13px;color:#666;">
        <strong>Invoice #:</strong> ${invoice.invoice_number}<br/>
        <strong>Amount Due:</strong> $${Number(invoice.total_amount).toFixed(2)}<br/>
        <strong>Due Date:</strong> ${new Date(invoice.due_date).toLocaleDateString()}<br/>
        <strong>Payment:</strong> ${invoice.payment_terms || 'Credit Card, COD, or Wire Transfer'}
      </div>
      ${pdfUrl ? `<p style="font-size:13px;">📎 <a href="${pdfUrl}">Download Invoice PDF</a></p>` : ''}
      <p style="font-size:13px;color:#444;">
        To arrange payment contact us at
        <a href="mailto:${COMPANY.email}">${COMPANY.email}</a>
        or <a href="tel:${COMPANY.phone}">${COMPANY.phone}</a>.
      </p>
    `),
  });
}  

export async function sendContactNotificationAdmin({ name, email, phone, company, subject, message }) {
  const subj = 'New Contact — ' + (subject || name);
  await send({
    to: process.env.RFQ_NOTIFY_EMAIL,
    subject: subj,
    type: 'contact',
    html: layout(`
      <h3 style="color:#c8932a;margin-top:0;">New Contact Form Submission</h3>
      <p><strong>Name:</strong> ${name}</p>
      <p><strong>Email:</strong> <a href="mailto:${email}">${email}</a></p>
      <p><strong>Phone:</strong> ${phone || '—'}</p>
      <p><strong>Company:</strong> ${company || '—'}</p>
      <p><strong>Subject:</strong> ${subject || '—'}</p>
      <p><strong>Message:</strong><br>${message}</p>
    `),
  });
}
export async function sendRfqStatusUpdate({ customer, rfq, status, message }) {
  const subj = 'RFQ ' + rfq.rfq_number + ' Update — ' + status + ' | Jupiter One USA';
  await send({
    to: customer.email, subject: subj,
    type: 'rfq_status_update', entityType: 'rfq', entityId: rfq.id,
    html: layout(`
      <p style="font-size:15px;">Hi ${customer.first_name},</p>
      <p style="font-size:14px;color:#444;line-height:1.7;">${message}</p>
      <div style="background:#f9f9f9;border-left:3px solid #c8932a;padding:14px 20px;margin:20px 0;font-size:13px;color:#666;">
        <strong>RFQ:</strong> ${rfq.rfq_number}<br/>
        <strong>New Status:</strong> ${status}
      </div>
      <div style="margin-top:20px;">
        <a href="${process.env.FRONTEND_URL}/pages/account.html?tab=rfqs" style="background:#c8932a;color:#000;padding:12px 28px;text-decoration:none;font-weight:bold;font-size:13px;">VIEW MY RFQS →</a>
      </div>
    `),
  });
}
