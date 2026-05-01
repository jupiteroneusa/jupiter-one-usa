// services/nsnnow.js
import puppeteer from 'puppeteer-core';
import { execSync } from 'child_process';

let sessionData = null;
let sessionExpiry = null;

function getBrowserPath() {
  // Try common Chrome/Chromium paths on Azure Linux
  const paths = [
    '/usr/bin/chromium-browser',
    '/usr/bin/chromium',
    '/usr/bin/google-chrome',
    '/usr/bin/google-chrome-stable',
    process.env.CHROME_PATH,
  ].filter(Boolean);
  
  for (const p of paths) {
    try {
      execSync(`test -f ${p}`);
      return p;
    } catch {}
  }
  return null;
}

async function getBrowser() {
  const executablePath = getBrowserPath();
  return puppeteer.launch({
    executablePath: executablePath || undefined,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-gpu',
      '--no-first-run',
      '--no-zygote',
      '--single-process',
      '--disable-extensions',
    ],
    headless: true,
  });
}

export async function getNsnNowData(nsn) {
  let browser;
  try {
    browser = await getBrowser();
    const page = await browser.newPage();
    
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36');
    
    // Go to login page
    await page.goto('https://www.nsn-now.com/login.aspx', { waitUntil: 'networkidle2', timeout: 30000 });
    
    // Fill in credentials
    await page.type('input[name="txtUserID"]', process.env.NSNNOW_USER || '');
    await page.type('input[name="txtPassword"]', process.env.NSNNOW_PASS || '');
    
    // Click login and wait for navigation
    await Promise.all([
      page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 30000 }),
      page.click('input[name="btnLogin"]'),
    ]);
    
    // Now search for the NSN
    await page.goto(`https://www.nsn-now.com/Indexing/PublicSearch.aspx?NSN=${encodeURIComponent(nsn)}`, {
      waitUntil: 'networkidle2',
      timeout: 30000,
    });
    
    // Wait for results and find detail link
    await page.waitForTimeout(2000);
    
    const detailLink = await page.evaluate(() => {
      const links = Array.from(document.querySelectorAll('a[href*="detail/summary"]'));
      return links.length > 0 ? links[0].href : null;
    });
    
    if (!detailLink) {
      await browser.close();
      return null;
    }
    
    // Go to detail page
    await page.goto(detailLink, { waitUntil: 'networkidle2', timeout: 30000 });
    await page.waitForTimeout(2000);
    
    // Extract data
    const data = await page.evaluate((nsn) => {
      const result = {
        nsn,
        description: null,
        proc_price: null,
        mgmt_price: null,
        agency_usage: null,
        dla_stock: null,
        manufacturers: [],
        detail_url: window.location.href,
      };
      
      // Get main table cells
      const cells = Array.from(document.querySelectorAll('td'));
      
      cells.forEach((cell, i) => {
        const text = cell.innerText.trim();
        if (text.includes('$') && text.match(/\$[\d,]+/)) {
          const price = text.match(/\$[\d,]+\.?\d*/)?.[0];
          if (price && !result.proc_price) result.proc_price = price;
          else if (price && !result.mgmt_price) result.mgmt_price = price;
        }
        if (text === 'Multi Agency' || text === 'Single Agency') result.agency_usage = text;
      });
      
      // Description
      const descCell = document.querySelector('td.ItemName, td[class*="desc"], td[class*="Desc"]');
      if (descCell) result.description = descCell.innerText.trim();
      
      // DLA stock
      const dlaEl = document.querySelector('*[class*="DLA"], td');
      const allText = document.body.innerText;
      const dlaMatch = allText.match(/Zero DLA stock[^\n]*/i);
      if (dlaMatch) result.dla_stock = dlaMatch[0].trim();
      
      // Manufacturers table
      const mfrTable = document.querySelector('table');
      if (mfrTable) {
        const rows = Array.from(mfrTable.querySelectorAll('tr')).slice(1);
        rows.forEach(row => {
          const tds = Array.from(row.querySelectorAll('td'));
          if (tds.length >= 3) {
            const partNum = tds[0]?.innerText.trim();
            const company = tds[1]?.innerText.trim();
            const cage = tds[2]?.innerText.trim();
            if (partNum && company) {
              result.manufacturers.push({ part_number: partNum, company, cage });
            }
          }
        });
      }
      
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