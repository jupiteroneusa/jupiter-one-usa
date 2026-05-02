// services/nsnnow.js
import puppeteer from 'puppeteer';

let cachedCookies = null;
let cookieExpiry = null;

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

    const page = await browser.newPage();
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36');

    // Go to login page
    await page.goto('https://www.nsn-now.com/login.aspx', { waitUntil: 'networkidle2', timeout: 30000 });

    // Fill login form - use cached cookies if available
    if (cachedCookies && cookieExpiry && Date.now() < cookieExpiry) {
      await page.setCookie(...cachedCookies);
      await page.goto('https://www.nsn-now.com/search/search.aspx', { waitUntil: 'networkidle2', timeout: 30000 });
    } else {
      // Find and fill username - try multiple selectors
      await page.evaluate((user, pass) => {
        const inputs = Array.from(document.querySelectorAll('input[type="text"], input:not([type="password"]):not([type="submit"]):not([type="hidden"])'));
        const passInputs = Array.from(document.querySelectorAll('input[type="password"]'));
        if (inputs.length > 0) inputs[inputs.length - 1].value = user;
        if (passInputs.length > 0) passInputs[0].value = pass;
      }, process.env.NSNNOW_USER || '', process.env.NSNNOW_PASS || '');

      // Click login button
      await Promise.all([
        page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 30000 }),
        page.evaluate(() => {
          const btns = Array.from(document.querySelectorAll('input[type="submit"], input[value="Login"], button'));
          if (btns.length > 0) btns[0].click();
        }),
      ]);

      // Cache cookies
      cachedCookies = await page.cookies();
      cookieExpiry = Date.now() + (4 * 60 * 60 * 1000);
    }

    // Now go to search page
    await page.goto('https://www.nsn-now.com/search/search.aspx', { waitUntil: 'networkidle2', timeout: 30000 });
    await new Promise(r => setTimeout(r, 1000));

    // Fill NSN search field and submit
    await page.evaluate((nsn) => {
      const inputs = Array.from(document.querySelectorAll('input[type="text"]'));
      if (inputs[0]) inputs[0].value = nsn;
    }, nsn);

    await Promise.all([
      page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 30000 }),
      page.evaluate(() => {
        const searchBtn = document.querySelector('input[value="Search"], input[type="submit"]');
        if (searchBtn) searchBtn.click();
      }),
    ]);

    await new Promise(r => setTimeout(r, 3000));

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

    // Extract data
    const data = await page.evaluate((nsn) => {
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

      // Get prices from table
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

      // Description - look for item name in header table
      const headerRows = document.querySelectorAll('table tr');
      headerRows.forEach(row => {
        const cells = row.querySelectorAll('td');
        if (cells.length >= 2) {
          const text = cells[1]?.innerText?.trim();
          if (text && text.match(/^[A-Z][A-Z,\s]{4,}$/) && !result.description) {
            result.description = text;
          }
        }
      });

      // DLA stock & cancelled
      const bodyText = document.body.innerText;
      const dlaMatch = bodyText.match(/Zero DLA stock[^\n]*/i);
      if (dlaMatch) result.dla_stock = dlaMatch[0].trim();
      const cancelMatch = bodyText.match(/CANCELLED[^\n]*/i);
      if (cancelMatch) result.cancelled = cancelMatch[0].trim();

      // Manufacturers
      const tables = document.querySelectorAll('table');
      tables.forEach(table => {
        const headers = Array.from(table.querySelectorAll('th')).map(h => h.innerText.trim().toLowerCase());
        if (headers.some(h => h.includes('part') || h.includes('cage'))) {
          const rows = Array.from(table.querySelectorAll('tr')).slice(1);
          rows.forEach(row => {
            const tds = Array.from(row.querySelectorAll('td'));
            if (tds.length >= 3) {
              const partNum = tds[0]?.innerText?.trim();
              const company = tds[1]?.innerText?.trim()?.split('\n')[0];
              const cage = tds[2]?.innerText?.trim();
              if (partNum && partNum.length > 0 && !partNum.includes('©') && !partNum.includes('Legend')) {
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
    console.error('NSN-Now error:', err.message);
    if (browser) await browser.close().catch(() => {});
    return null;
  }
}