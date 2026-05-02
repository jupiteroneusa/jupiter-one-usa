// services/nsnnow.js
import puppeteer from 'puppeteer';

let cachedCookies = null;
let cookieExpiry = null;

async function getLoggedInPage(browser) {
  const page = await browser.newPage();
  await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36');

  // Use cached cookies if still valid
  if (cachedCookies && cookieExpiry && Date.now() < cookieExpiry) {
    await page.setCookie(...cachedCookies);
    return page;
  }

  // Login fresh
  await page.goto('https://www.nsn-now.com/login.aspx', { waitUntil: 'networkidle2', timeout: 30000 });
  await page.type('input[name="txtUserID"]', process.env.NSNNOW_USER || '');
  await page.type('input[name="txtPassword"]', process.env.NSNNOW_PASS || '');
  await Promise.all([
    page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 30000 }),
    page.click('input[name="btnLogin"]'),
  ]);

  // Cache cookies for 4 hours
  cachedCookies = await page.cookies();
  cookieExpiry = Date.now() + (4 * 60 * 60 * 1000);
  return page;
}

export async function getNsnNowData(nsn) {
  let browser;
  try {
    browser = await puppeteer.launch({
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu',
        '--no-first-run',
        '--no-zygote',
      ],
      headless: true,
    });

    const page = await getLoggedInPage(browser);

    // Search for NSN
    await page.goto(
      `https://www.nsn-now.com/Indexing/PublicSearch.aspx?NSN=${encodeURIComponent(nsn)}`,
      { waitUntil: 'networkidle2', timeout: 30000 }
    );
    await new Promise(r => setTimeout(r, 2000));

    // Find detail link
    const detailUrl = await page.evaluate(() => {
      const links = Array.from(document.querySelectorAll('a[href*="detail/summary"]'));
      return links.length ? links[0].href : null;
    });

    if (!detailUrl) {
      await browser.close();
      return null;
    }

    // Go to detail page
    await page.goto(detailUrl, { waitUntil: 'networkidle2', timeout: 30000 });
    await new Promise(r => setTimeout(r, 2000));

    // Extract all data
    const data = await page.evaluate((nsn) => {
      const getText = (sel) => document.querySelector(sel)?.innerText?.trim() || null;
      const result = {
        nsn,
        description: null,
        proc_price: null,
        mgmt_price: null,
        agency_usage: null,
        dla_stock: null,
        cancelled: null,
        manufacturers: [],
        detail_url: window.location.href,
      };

      // Get all table cells and find prices
      const allCells = Array.from(document.querySelectorAll('td'));
      let priceCount = 0;
      allCells.forEach(cell => {
        const text = cell.innerText.trim();
        if (text.match(/^\$[\d,]+\.?\d*$/)) {
          if (priceCount === 0) result.proc_price = text;
          else if (priceCount === 1) result.mgmt_price = text;
          priceCount++;
        }
        if (text.includes('Multi Agency') || text.includes('Single Agency')) {
          result.agency_usage = text;
        }
      });

      // Description
      const rows = Array.from(document.querySelectorAll('table tr'));
      rows.forEach(row => {
        const cells = row.querySelectorAll('td');
        if (cells.length >= 2) {
          const first = cells[0].innerText.trim();
          if (first.match(/^[A-Z,\s]{5,}$/) && !result.description) {
            result.description = first;
          }
        }
      });

      // DLA stock & cancelled
      const bodyText = document.body.innerText;
      const dlaMatch = bodyText.match(/Zero DLA stock[^\n]*/i);
      if (dlaMatch) result.dla_stock = dlaMatch[0].trim();
      const cancelMatch = bodyText.match(/CANCELLED[^\n]*/i);
      if (cancelMatch) result.cancelled = cancelMatch[0].trim();

      // Manufacturers table
      const mfrSection = document.querySelector('.Manufacturers, [id*="Manufacturers"]');
      const tables = document.querySelectorAll('table');
      tables.forEach(table => {
        const headers = Array.from(table.querySelectorAll('th')).map(h => h.innerText.trim().toLowerCase());
        if (headers.some(h => h.includes('part') || h.includes('cage') || h.includes('company'))) {
          const rows = Array.from(table.querySelectorAll('tr')).slice(1);
          rows.forEach(row => {
            const tds = Array.from(row.querySelectorAll('td'));
            if (tds.length >= 3) {
              const partNum = tds[0]?.innerText.trim();
              const company = tds[1]?.innerText.trim().split('\n')[0];
              const cage = tds[2]?.innerText.trim();
              if (partNum && partNum.length > 0 && !partNum.includes('©')) {
                result.manufacturers.push({ part_number: partNum, company, cage });
              }
            }
          });
        }
      });

      return result;
    }, nsn);

    await browser.close();
    return data;

  } catch (err) {
    console.error('NSN-Now Puppeteer error:', err.message);
    if (browser) await browser.close().catch(() => {});
    return null;
  }
}