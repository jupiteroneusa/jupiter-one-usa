// routes/dibss.js
// Pulls open NSN requirements from DIBBS (DLA) and SAM.gov
// These are free government procurement boards — potential inbound leads

import { Router } from 'express';
import { getPool, sql } from '../db/connect.js';
import { requireAdmin } from '../middleware/auth.js';
import { logAudit, getIp } from '../middleware/audit.js';
import axios from 'axios';
import cron from 'node-cron';

const router = Router();

// ── DIBBS Fetch ───────────────────────────────────────────────
// DLA DIBBS posts open solicitations at:
// https://www.dibbs.bsm.dla.mil/
// Their public solicitation feed (RFC/IFB open to all)
async function fetchDibbsSolicitations() {
  try {
    // DIBBS public XML/JSON feed for open solicitations
    const response = await axios.get('https://www.dibbs.bsm.dla.mil/rss/rfc.aspx', {
      timeout: 15000,
      headers: { 'Accept': 'application/xml, text/xml' },
    });

    // Parse XML — DIBBS uses RSS format
    const rawXml = response.data;
    const items = [];

    // Simple XML extraction (no external XML parser needed)
    const itemMatches = rawXml.match(/<item>([\s\S]*?)<\/item>/g) || [];
    for (const item of itemMatches.slice(0, 50)) {
      const get = (tag) => {
        const m = item.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`));
        return m ? m[1].replace(/<!\[CDATA\[([\s\S]*?)\]\]>/, '$1').trim() : null;
      };
      items.push({
        source:     'DIBBS',
        source_ref: get('guid') || get('link'),
        title:      get('title'),
        description:get('description'),
        link:       get('link'),
        pub_date:   get('pubDate'),
      });
    }

    return items;
  } catch (err) {
    console.error('DIBBS fetch error:', err.message);
    return [];
  }
}

// ── SAM.gov Fetch ─────────────────────────────────────────────
// SAM.gov public API — no key required for basic searches
async function fetchSamOpportunities(keywords = 'NSN aerospace aviation') {
  try {
    const response = await axios.get('https://api.sam.gov/opportunities/v2/search', {
      params: {
        api_key: process.env.SAM_GOV_API_KEY || 'DEMO_KEY',
        limit: 25,
        offset: 0,
        ptype: 'o',   // solicitation type
        q: keywords,
        active: true,
      },
      timeout: 15000,
    });

    const opps = response.data?.opportunitiesData || [];
    return opps.map(o => ({
      source:      'SAM',
      source_ref:  o.noticeId,
      title:       o.title,
      description: o.description?.slice(0, 1000),
      agency:      o.organizationName,
      due_date:    o.responseDeadLine ? new Date(o.responseDeadLine) : null,
      raw_data:    JSON.stringify(o),
    }));
  } catch (err) {
    console.error('SAM.gov fetch error:', err.message);
    return [];
  }
}

// ── Parse NSN from text ───────────────────────────────────────
function extractNsn(text) {
  if (!text) return null;
  const match = text.match(/\b(\d{4}[-\s]\d{2}[-\s]\d{3}[-\s]\d{4})\b/);
  return match ? match[1].replace(/\s/g, '-') : null;
}

// ── Save to DB ────────────────────────────────────────────────
async function saveSolicitations(items) {
  if (!items.length) return 0;
  const pool = await getPool();
  let saved = 0;

  for (const item of items) {
    try {
      const title = item.title || '';
      const desc  = item.description || '';
      const nsn   = extractNsn(title) || extractNsn(desc);

      // Skip if already exists
      const existing = await pool.request()
        .input('ref', sql.NVarChar(100), item.source_ref)
        .query(`SELECT id FROM inbound_solicitations WHERE source_ref = @ref`);
      if (existing.recordset.length) continue;

      await pool.request()
        .input('source',   sql.NVarChar(30),  item.source)
        .input('ref',      sql.NVarChar(100), item.source_ref)
        .input('nsn',      sql.NVarChar(20),  nsn)
        .input('name',     sql.NVarChar(255), title.slice(0, 255))
        .input('agency',   sql.NVarChar(255), item.agency || null)
        .input('dueDate',  sql.Date,          item.due_date || null)
        .input('rawData',  sql.NVarChar(sql.MAX), item.raw_data || JSON.stringify(item))
        .query(`
          INSERT INTO inbound_solicitations (source, source_ref, nsn, item_name, agency, due_date, raw_data)
          VALUES (@source, @ref, @nsn, @name, @agency, @dueDate, @rawData)
        `);
      saved++;
    } catch (_) {}
  }

  return saved;
}

// ── GET /api/dibss — list inbound solicitations ───────────────
router.get('/', requireAdmin, async (req, res) => {
  const { status, source, limit = 50, offset = 0 } = req.query;
  try {
    const pool = await getPool();
    const r = pool.request().input('lim', sql.Int, parseInt(limit)).input('off', sql.Int, parseInt(offset));
    const conditions = [];
    if (status) { r.input('status', sql.NVarChar, status); conditions.push('status = @status'); }
    if (source) { r.input('source', sql.NVarChar, source); conditions.push('source = @source'); }
    const where = conditions.length ? 'WHERE ' + conditions.join(' AND ') : '';
    const result = await r.query(`
      SELECT id, source, source_ref, nsn, item_name, agency, due_date, status, created_at
      FROM inbound_solicitations
      ${where}
      ORDER BY due_date ASC, created_at DESC
      OFFSET @off ROWS FETCH NEXT @lim ROWS ONLY
    `);
    res.json(result.recordset);
  } catch (err) {
    res.status(500).json({ error: 'Failed to load solicitations.' });
  }
});

// ── POST /api/dibss/sync — manually trigger a sync ───────────
router.post('/sync', requireAdmin, async (req, res) => {
  try {
    const [dibbsItems, samItems] = await Promise.all([
      fetchDibbsSolicitations(),
      fetchSamOpportunities(),
    ]);

    const all = [...dibbsItems, ...samItems];
    const saved = await saveSolicitations(all);

    await logAudit({
      userType: 'admin', userId: req.adminId,
      action: 'synced', entityType: 'inbound_solicitations',
      summary: `DIBBS/SAM sync: ${all.length} fetched, ${saved} new saved`,
      ipAddress: getIp(req),
    });

    res.json({ success: true, fetched: all.length, saved_new: saved });
  } catch (err) {
    console.error('Sync error:', err);
    res.status(500).json({ error: 'Sync failed.' });
  }
});

// ── PATCH /api/dibss/:id/status ───────────────────────────────
router.patch('/:id/status', requireAdmin, async (req, res) => {
  const { status, notes } = req.body;
  try {
    const pool = await getPool();
    await pool.request()
      .input('id',         sql.BigInt,   req.params.id)
      .input('status',     sql.NVarChar, status)
      .input('notes',      sql.NVarChar(sql.MAX), notes || null)
      .input('assignedTo', sql.BigInt,   req.adminId)
      .query(`UPDATE inbound_solicitations SET status = @status, notes = @notes, assigned_to = @assignedTo, updated_at = GETDATE() WHERE id = @id`);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed.' });
  }
});

// ── Auto-sync every 6 hours ───────────────────────────────────
export function startDibbsCron() {
  cron.schedule('0 */6 * * *', async () => {
    console.log('⏰ Running DIBBS/SAM sync...');
    try {
      const [d, s] = await Promise.all([fetchDibbsSolicitations(), fetchSamOpportunities()]);
      const saved = await saveSolicitations([...d, ...s]);
      console.log(`✅ DIBBS/SAM sync complete — ${saved} new solicitations`);
    } catch (err) {
      console.error('DIBBS cron error:', err.message);
    }
  });
  console.log('⏰ DIBBS/SAM auto-sync scheduled (every 6 hours)');
}

export default router;
