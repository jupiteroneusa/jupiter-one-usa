// services/pdfService.js
// PDF generation temporarily disabled - puppeteer removed for Azure compatibility

import Handlebars from 'handlebars';
import { BlobServiceClient } from '@azure/storage-blob';
import 'dotenv/config';

Handlebars.registerHelper('formatDate', (date) => {
  if (!date) return '—';
  return new Date(date).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
});

Handlebars.registerHelper('formatMoney', (val) => {
  if (val === null || val === undefined) return '0.00';
  return parseFloat(val).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
});

export async function generateQuotePdf({ quote, lines }) {
  console.warn('PDF generation disabled - puppeteer not available');
  return null;
}

export async function generateInvoicePdf({ invoice, lines, customer }) {
  console.warn('PDF generation disabled - puppeteer not available');
  return null;
}