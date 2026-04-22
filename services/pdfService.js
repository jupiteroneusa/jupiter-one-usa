// services/pdfService.js
// Generates quote and invoice PDFs using Puppeteer + Handlebars
// Uploads to Azure Blob Storage and returns the URL

import puppeteer from 'puppeteer';
import Handlebars from 'handlebars';
import { BlobServiceClient } from '@azure/storage-blob';
import 'dotenv/config';

// ── Azure Blob upload ─────────────────────────────────────────
async function uploadToAzure(buffer, fileName) {
  if (!process.env.AZURE_STORAGE_CONNECTION_STRING) {
    // Dev fallback — save locally
    const fs = await import('fs');
    const localPath = `./tmp/${fileName}`;
    fs.mkdirSync('./tmp', { recursive: true });
    fs.writeFileSync(localPath, buffer);
    return `http://localhost:${process.env.PORT || 3000}/tmp/${fileName}`;
  }

  const blobServiceClient = BlobServiceClient.fromConnectionString(process.env.AZURE_STORAGE_CONNECTION_STRING);
  const containerClient = blobServiceClient.getContainerClient(process.env.AZURE_STORAGE_CONTAINER || 'jupiter-one-docs');
  await containerClient.createIfNotExists({ access: 'blob' });

  const blockBlobClient = containerClient.getBlockBlobClient(fileName);
  await blockBlobClient.uploadData(buffer, { blobHTTPHeaders: { blobContentType: 'application/pdf' } });
  return blockBlobClient.url;
}

// ── QUOTE PDF ─────────────────────────────────────────────────
const QUOTE_TEMPLATE = `
<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8"/>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: Arial, sans-serif; font-size: 12px; color: #333; padding: 40px; }
  .header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 32px; }
  .company-name { font-size: 22px; font-weight: bold; color: #0a1628; letter-spacing: .04em; }
  .company-sub { font-size: 11px; color: #888; margin-top: 4px; }
  .company-details { font-size: 11px; color: #666; margin-top: 8px; line-height: 1.7; }
  .quote-title { text-align: right; }
  .quote-title h1 { font-size: 28px; color: #c8932a; font-weight: bold; letter-spacing: .06em; }
  .quote-meta { font-size: 11px; color: #666; margin-top: 6px; line-height: 1.7; }
  .divider { border: none; border-top: 2px solid #c8932a; margin: 20px 0; }
  .bill-to { margin-bottom: 24px; }
  .bill-to-label { font-size: 10px; letter-spacing: .12em; text-transform: uppercase; color: #888; margin-bottom: 6px; }
  .bill-to-name { font-size: 13px; font-weight: bold; color: #0a1628; }
  .bill-to-details { font-size: 11px; color: #666; line-height: 1.7; }
  table { width: 100%; border-collapse: collapse; margin: 20px 0; }
  th { background: #0a1628; color: #fff; padding: 10px 10px; text-align: left; font-size: 11px; letter-spacing: .06em; text-transform: uppercase; }
  td { padding: 10px; border-bottom: 1px solid #eee; font-size: 11px; vertical-align: top; }
  tr:last-child td { border-bottom: 2px solid #0a1628; }
  .td-nsn { font-family: monospace; font-size: 10px; }
  .td-right { text-align: right; }
  .td-center { text-align: center; }
  .totals { margin-left: auto; width: 260px; }
  .total-row { display: flex; justify-content: space-between; padding: 6px 0; font-size: 12px; border-bottom: 1px solid #eee; }
  .total-final { display: flex; justify-content: space-between; padding: 10px 0; font-size: 14px; font-weight: bold; color: #0a1628; border-top: 2px solid #0a1628; }
  .footer-notes { margin-top: 32px; padding: 16px; background: #f9f9f9; border-left: 3px solid #c8932a; font-size: 11px; color: #666; line-height: 1.7; }
  .footer-bar { margin-top: 32px; padding-top: 16px; border-top: 1px solid #ddd; display: flex; justify-content: space-between; font-size: 10px; color: #aaa; }
  .badge { display: inline-block; padding: 4px 12px; font-size: 10px; font-weight: bold; letter-spacing: .1em; text-transform: uppercase; }
  .badge-sent { background: #e8f4fd; color: #1a7abf; }
</style>
</head>
<body>
  <div class="header">
    <div>
      <div class="company-name">JUPITER ONE USA LLC</div>
      <div class="company-sub">NSN &amp; Aerospace Component Sourcing</div>
      <div class="company-details">
        400 N Tampa St, Suite 1550<br/>
        Tampa, FL<br/>
        +1 (347) 821-7412<br/>
        DTorchia@jupiteroneusa.com
      </div>
    </div>
    <div class="quote-title">
      <h1>QUOTATION</h1>
      <div class="quote-meta">
        <strong>Quote #:</strong> {{quote.quote_number}}<br/>
        <strong>Date:</strong> {{formatDate quote.sent_at}}<br/>
        <strong>Valid Until:</strong> {{formatDate quote.valid_until}}<br/>
        <strong>RFQ Ref:</strong> {{quote.rfq_number}}
      </div>
    </div>
  </div>

  <hr class="divider"/>

  <div class="bill-to">
    <div class="bill-to-label">Prepared For</div>
    <div class="bill-to-name">{{customer.first_name}} {{customer.last_name}}</div>
    <div class="bill-to-details">
      {{#if customer.company}}{{customer.company}}<br/>{{/if}}
      {{customer.email}}<br/>
      {{#if customer.phone}}{{customer.phone}}{{/if}}
    </div>
  </div>

  <table>
    <thead>
      <tr>
        <th>#</th>
        <th>NSN / Part Number</th>
        <th>Description</th>
        <th>Cond</th>
        <th class="td-center">Qty</th>
        <th class="td-right">Unit Price</th>
        <th class="td-right">Total</th>
      </tr>
    </thead>
    <tbody>
      {{#each lines}}
      <tr>
        <td>{{line_number}}</td>
        <td class="td-nsn">
          {{#if nsn}}<strong>{{nsn}}</strong><br/>{{/if}}
          {{#if part_number}}<span style="color:#888;">{{part_number}}</span>{{/if}}
        </td>
        <td>{{item_name}}</td>
        <td class="td-center">{{condition_code}}</td>
        <td class="td-center">{{quantity}}</td>
        <td class="td-right">${{formatMoney unit_price}}</td>
        <td class="td-right">${{formatMoney line_total}}</td>
      </tr>
      {{/each}}
    </tbody>
  </table>

  <div class="totals">
    <div class="total-row"><span>Subtotal</span><span>${{formatMoney quote.subtotal}}</span></div>
    {{#if quote.tax_amount}}
    <div class="total-row"><span>Tax</span><span>${{formatMoney quote.tax_amount}}</span></div>
    {{/if}}
    <div class="total-final"><span>TOTAL</span><span style="color:#c8932a;">${{formatMoney quote.total_amount}}</span></div>
  </div>

  {{#if quote.payment_terms}}
  <div style="margin-top:20px;font-size:11px;color:#666;">
    <strong>Payment Terms:</strong> {{quote.payment_terms}}<br/>
    {{#if quote.delivery_terms}}<strong>Delivery:</strong> {{quote.delivery_terms}}{{/if}}
  </div>
  {{/if}}

  <div class="footer-notes">
    {{quote.notes}}
  </div>

  <div class="footer-bar">
    <span>Jupiter One USA LLC — jupiteroneusa.com</span>
    <span>Quote {{quote.quote_number}} — Page 1 of 1</span>
  </div>
</body>
</html>
`;

Handlebars.registerHelper('formatDate', (date) => {
  if (!date) return '—';
  return new Date(date).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
});
Handlebars.registerHelper('formatMoney', (val) => {
  if (val === null || val === undefined) return '0.00';
  return parseFloat(val).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
});

const quoteTemplate = Handlebars.compile(QUOTE_TEMPLATE);

export async function generateQuotePdf({ quote, lines }) {
  const html = quoteTemplate({ quote, lines, customer: { first_name: quote.first_name, last_name: quote.last_name, email: quote.email, company: quote.company, phone: quote.phone } });

  const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox', '--disable-setuid-sandbox'] });
  try {
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: 'networkidle0' });
    const buffer = await page.pdf({ format: 'Letter', margin: { top: '0', right: '0', bottom: '0', left: '0' }, printBackground: true });
    const fileName = `quotes/${quote.quote_number}-${Date.now()}.pdf`;
    return await uploadToAzure(buffer, fileName);
  } finally {
    await browser.close();
  }
}

export async function generateInvoicePdf({ invoice, lines, customer }) {
  // Same structure as quote PDF but for invoices
  // Reuses the same template pattern with invoice-specific fields
  const html = quoteTemplate({
    quote: { ...invoice, quote_number: invoice.invoice_number, rfq_number: invoice.order_number, notes: `Payment due ${new Date(invoice.due_date).toLocaleDateString()}. ${invoice.notes || ''}` },
    lines: lines.map(l => ({ ...l, unit_price: l.unit_price, line_total: l.line_total })),
    customer,
  });

  const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox', '--disable-setuid-sandbox'] });
  try {
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: 'networkidle0' });
    const buffer = await page.pdf({ format: 'Letter', printBackground: true });
    const fileName = `invoices/${invoice.invoice_number}-${Date.now()}.pdf`;
    return await uploadToAzure(buffer, fileName);
  } finally {
    await browser.close();
  }
}
