// routes/search.js
import { Router } from 'express';
import { getPool, sql } from '../db/connect.js';
import { optionalCustomer } from '../middleware/auth.js';

const router = Router();

// ── GET /api/search?q=...&type=nsn|part|description ──────────
router.get('/', optionalCustomer, async (req, res) => {
  const { q, type = 'nsn', limit = 25, offset = 0 } = req.query;

  if (!q || q.trim().length < 2)
    return res.status(400).json({ error: 'Enter at least 2 characters to search.' });

  const term = q.trim().toUpperCase();

  try {
    const pool = await getPool();
    let result;
    const lim = Math.min(parseInt(limit) || 25, 100);
    const off = parseInt(offset) || 0;

    if (type === 'nsn') {
      const clean = term.replace(/-/g, '');
      result = await pool.request()
        .input('term',  sql.NVarChar, `%${term}%`)
        .input('clean', sql.NVarChar, `%${clean}%`)
        .input('exact', sql.NVarChar, term)
        .input('lim',   sql.Int, lim)
        .input('off',   sql.Int, off)
        .query(`
          SELECT
            n.id, n.nsn, n.niin, n.fsc, n.item_name, n.status, n.ui,
            f.title AS fsc_title,
            STRING_AGG(p.cage_code + '|' + p.part_number, '~') AS parts_raw
          FROM nsn_catalog n
          LEFT JOIN fsc_lookup f ON f.fsc = n.fsc
          LEFT JOIN nsn_parts  p ON p.nsn_id = n.id
          WHERE REPLACE(n.nsn,'-','') LIKE @clean OR n.nsn LIKE @term OR n.niin LIKE @term
          GROUP BY n.id, n.nsn, n.niin, n.fsc, n.item_name, n.status, n.ui, f.title
          ORDER BY CASE WHEN n.nsn = @exact THEN 0 ELSE 1 END, n.item_name
          OFFSET @off ROWS FETCH NEXT @lim ROWS ONLY
        `);

    } else if (type === 'part') {
      result = await pool.request()
        .input('term', sql.NVarChar, `%${term}%`)
        .input('lim',  sql.Int, lim)
        .input('off',  sql.Int, off)
        .query(`
          SELECT
            n.id, n.nsn, n.niin, n.fsc, n.item_name, n.status, n.ui,
            f.title AS fsc_title,
            STRING_AGG(p.cage_code + '|' + p.part_number, '~') AS parts_raw
          FROM nsn_catalog n
          LEFT JOIN fsc_lookup f ON f.fsc = n.fsc
          INNER JOIN nsn_parts p ON p.nsn_id = n.id
          WHERE p.part_number LIKE @term
          GROUP BY n.id, n.nsn, n.niin, n.fsc, n.item_name, n.status, n.ui, f.title
          ORDER BY n.item_name
          OFFSET @off ROWS FETCH NEXT @lim ROWS ONLY
        `);

    } else {
      result = await pool.request()
        .input('term', sql.NVarChar, `%${term}%`)
        .input('lim',  sql.Int, lim)
        .input('off',  sql.Int, off)
        .query(`
          SELECT
            n.id, n.nsn, n.niin, n.fsc, n.item_name, n.status, n.ui,
            f.title AS fsc_title,
            STRING_AGG(p.cage_code + '|' + p.part_number, '~') AS parts_raw
          FROM nsn_catalog n
          LEFT JOIN fsc_lookup f ON f.fsc = n.fsc
          LEFT JOIN nsn_parts  p ON p.nsn_id = n.id
          WHERE n.item_name LIKE @term
          GROUP BY n.id, n.nsn, n.niin, n.fsc, n.item_name, n.status, n.ui, f.title
          ORDER BY n.item_name
          OFFSET @off ROWS FETCH NEXT @lim ROWS ONLY
        `);
    }

    // Log search outcome
    if (req.customerId) {
      pool.request()
        .input('cid',    sql.BigInt,    req.customerId)
        .input('term',   sql.NVarChar,  q.trim())
        .input('type',   sql.NVarChar,  type)
        .input('count',  sql.Int,       result.recordset.length)
        .input('ip',     sql.NVarChar(45), req.headers['x-forwarded-for'] || req.socket.remoteAddress)
        .query(`INSERT INTO search_outcomes (customer_id, search_term, search_type, result_count, ip_address) VALUES (@cid, @term, @type, @count, @ip)`)
        .catch(() => {});
    }

    const rows = result.recordset.map(r => ({
      ...r,
      parts: r.parts_raw
        ? r.parts_raw.split('~').map(p => {
            const [cage, partNumber] = p.split('|');
            return { cage, partNumber };
          })
        : [],
      parts_raw: undefined,
    }));

    res.json({ query: q, type, total: rows.length, count: rows.length, results: rows });

  } catch (err) {
    console.error('Search error:', err);
    res.status(500).json({ error: 'Search failed.' });
  }
});

// ── GET /api/search/nsn/:nsn — full detail ───────────────────
router.get('/nsn/:nsn', optionalCustomer, async (req, res) => {
  const nsn = req.params.nsn.trim().toUpperCase();
  try {
    const pool = await getPool();
    const n = await pool.request()
      .input('nsn', sql.NVarChar, nsn)
      .query(`
        SELECT n.*, f.title AS fsc_title, g.title AS fsg_title
        FROM nsn_catalog n
        LEFT JOIN fsc_lookup f ON f.fsc = n.fsc
        LEFT JOIN fsg_lookup g ON g.fsg = n.fsg
        WHERE n.nsn = @nsn
      `);

    if (!n.recordset.length) return res.status(404).json({ error: 'NSN not found.' });

    const parts = await pool.request()
      .input('nsn', sql.NVarChar, nsn)
      .query(`SELECT cage_code, part_number FROM nsn_parts WHERE nsn = @nsn ORDER BY cage_code`);

    res.json({ ...n.recordset[0], parts: parts.recordset });
  } catch (err) {
    res.status(500).json({ error: 'Lookup failed.' });
  }
});

// ── GET /api/search/fsg — FSG directory ──────────────────────
router.get('/fsg', async (req, res) => {
  try {
    const pool = await getPool();
    const result = await pool.request().query(`SELECT * FROM fsg_lookup ORDER BY fsg`);
    res.json(result.recordset);
  } catch (err) {
    res.status(500).json({ error: 'Failed to load FSG directory.' });
  }
});

// ── GET /api/search/fsc/:fsg — FSC classes for a group ───────
router.get('/fsc/:fsg', async (req, res) => {
  try {
    const pool = await getPool();
    const result = await pool.request()
      .input('fsg', sql.NVarChar, req.params.fsg)
      .query(`SELECT * FROM fsc_lookup WHERE fsg = @fsg ORDER BY fsc`);
    res.json(result.recordset);
  } catch (err) {
    res.status(500).json({ error: 'Failed to load FSC directory.' });
  }
});

// ── GET /api/search/class/:fsc — NSNs in a class ─────────────
router.get('/class/:fsc', async (req, res) => {
  const { limit = 50, offset = 0 } = req.query;
  try {
    const pool = await getPool();
    const result = await pool.request()
      .input('fsc', sql.NVarChar, req.params.fsc)
      .input('lim', sql.Int, parseInt(limit))
      .input('off', sql.Int, parseInt(offset))
      .query(`
        SELECT n.nsn, n.item_name, n.status, n.ui,
               STRING_AGG(p.part_number, ', ') AS part_numbers
        FROM nsn_catalog n
        LEFT JOIN nsn_parts p ON p.nsn_id = n.id
        WHERE n.fsc = @fsc
        GROUP BY n.nsn, n.item_name, n.status, n.ui
        ORDER BY n.item_name
        OFFSET @off ROWS FETCH NEXT @lim ROWS ONLY
      `);
    res.json(result.recordset);
  } catch (err) {
    res.status(500).json({ error: 'Failed to load NSN list.' });
  }
});


// ── GET /api/search/nsnnow/:nsn ── fetch from nsn-now.com ──
router.get('/nsnnow-debug/:nsn', async (req, res) => {
  try {
    const puppeteer = await import('puppeteer');
    const browser = await puppeteer.default.launch({
      args: ['--no-sandbox','--disable-setuid-sandbox','--disable-dev-shm-usage','--disable-gpu'],
      headless: true,
    });
    const page = await browser.newPage();
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36');
    await page.goto('https://www.nsn-now.com/login.aspx', { waitUntil: 'networkidle2', timeout: 30000 });
    await page.type('input[name="txtUserID"]', process.env.NSNNOW_USER || '');
    await page.type('input[name="txtPassword"]', process.env.NSNNOW_PASS || '');
    await Promise.all([
      page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 30000 }),
      page.click('input[name="btnLogin"]'),
    ]);
    const afterLogin = page.url();
    await page.goto(`https://www.nsn-now.com/search/results.aspx?q=${req.params.nsn}&searchtype=NSN`, { waitUntil: 'networkidle2', timeout: 30000 });
    await new Promise(r => setTimeout(r, 3000));
    const url = page.url();
    const html = await page.content();
    const links = await page.evaluate(() => Array.from(document.querySelectorAll('a')).map(a => a.href).filter(h => h.includes('detail')));
    await browser.close();
    res.json({ afterLogin, searchUrl: url, detailLinks: links, htmlSnippet: html.slice(0, 2000) });
  } catch(err) {
    res.json({ error: err.message });
  }
});
router.get('/nsnnow/:nsn', async (req, res) => {
  try {
    const { getNsnNowData } = await import('../services/nsnnow.js');
    const data = await getNsnNowData(req.params.nsn);
    if (!data) return res.status(404).json({ error: 'NSN not found on NSN-Now.' });
    res.json(data);
  } catch (err) {
    console.error('NSN-Now route error:', err);
    res.status(500).json({ error: 'Failed to fetch NSN-Now data.' });
  }
});
router.get('/email-test', async (req, res) => {
  try {
    const nodemailer = await import('nodemailer');
    const t = nodemailer.default.createTransport({
      host: process.env.SMTP_HOST,
      port: parseInt(process.env.SMTP_PORT),
      secure: false,
      auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
    });
    await t.verify();
    await t.sendMail({
      from: `\`"Jupiter One USA`\`" <DTorchia@jupiteroneusa.com>,
      to: process.env.RFQ_NOTIFY_EMAIL || 'DTorchia@jupiteroneusa.com',
      subject: 'Test from Azure',
      text: 'SMTP working. HOST:' + process.env.SMTP_HOST + ' USER:' + process.env.SMTP_USER
    });
    res.json({ success: true, host: process.env.SMTP_HOST, user: process.env.SMTP_USER, to: process.env.RFQ_NOTIFY_EMAIL });
  } catch(err) {
    res.json({ error: err.message, host: process.env.SMTP_HOST, user: process.env.SMTP_USER });
  }
});

export default router;
  
