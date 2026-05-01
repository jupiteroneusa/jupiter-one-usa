// services/nsnnow.js
// Server-side scraper for nsn-now.com
import https from 'https';
import http from 'http';

let sessionCookie = null;
let sessionExpiry = null;

async function fetchUrl(url, options = {}) {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url);
    const proto = urlObj.protocol === 'https:' ? https : http;
    const reqOptions = {
      hostname: urlObj.hostname,
      path: urlObj.pathname + urlObj.search,
      method: options.method || 'GET',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
        ...options.headers,
      },
    };
    const req = proto.request(reqOptions, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, body: data }));
    });
    req.on('error', reject);
    if (options.body) req.write(options.body);
    req.end();
  });
}

async function login() {
  // Check if session is still valid
  if (sessionCookie && sessionExpiry && Date.now() < sessionExpiry) {
    return sessionCookie;
  }

  console.log('NSN-Now: Logging in...');

  // Get login page first to get viewstate
  const loginPage = await fetchUrl('https://www.nsn-now.com/login.aspx');
  
  // Extract ViewState and EventValidation
  const viewStateMatch = loginPage.body.match(/id="__VIEWSTATE"\s+value="([^"]+)"/);
  const eventValidMatch = loginPage.body.match(/id="__EVENTVALIDATION"\s+value="([^"]+)"/);
  const viewStateGenMatch = loginPage.body.match(/id="__VIEWSTATEGENERATOR"\s+value="([^"]+)"/);

  const viewState = viewStateMatch ? viewStateMatch[1] : '';
  const eventValid = eventValidMatch ? eventValidMatch[1] : '';
  const viewStateGen = viewStateGenMatch ? viewStateGenMatch[1] : '';

  // Get cookies from login page
  const loginCookies = loginPage.headers['set-cookie']?.map(c => c.split(';')[0]).join('; ') || '';

  // Submit login form
  const body = new URLSearchParams({
    '__VIEWSTATE': viewState,
    '__VIEWSTATEGENERATOR': viewStateGen,
    '__EVENTVALIDATION': eventValid,
    'txtUserID': process.env.NSNNOW_USER,
    'txtPassword': process.env.NSNNOW_PASS,
    'btnLogin': 'Login',
  }).toString();

  const loginResp = await fetchUrl('https://www.nsn-now.com/login.aspx', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Content-Length': Buffer.byteLength(body),
      'Cookie': loginCookies,
      'Referer': 'https://www.nsn-now.com/login.aspx',
    },
    body,
  });

  // Extract session cookie
  const cookies = loginResp.headers['set-cookie']?.map(c => c.split(';')[0]).join('; ') || '';
  if (!cookies) throw new Error('NSN-Now login failed - no session cookie');

  sessionCookie = cookies + '; ' + loginCookies;
  sessionExpiry = Date.now() + (4 * 60 * 60 * 1000); // 4 hours
  console.log('NSN-Now: Logged in successfully');
  return sessionCookie;
}

function parseNsnData(html, nsn) {
  const result = {
    nsn,
    description: null,
    proc_price: null,
    mgmt_price: null,
    assign_date: null,
    agency_usage: null,
    codification_country: null,
    manufacturers: [],
    dla_stock: null,
  };

  // Description
  const descMatch = html.match(/GAGE[^<]*|VALVE[^<]*|BOLT[^<]*|PANEL[^<]*/i);
  
  // Try to get the main table data
  const tableMatch = html.match(/<td[^>]*>\s*\$([0-9,]+\.?\d*)\s*<\/td>/g);
  if (tableMatch) {
    const prices = tableMatch.map(m => m.replace(/<[^>]+>/g, '').trim());
    if (prices[0]) result.proc_price = prices[0];
    if (prices[1]) result.mgmt_price = prices[1];
  }

  // Extract proc price specifically
  const procMatch = html.match(/Proc\.\s*Price[\s\S]*?\$([0-9,]+\.?\d*)/i);
  if (procMatch) result.proc_price = '$' + procMatch[1];

  const mgmtMatch = html.match(/Management\s*Price[\s\S]*?\$([0-9,]+\.?\d*)/i);
  if (mgmtMatch) result.mgmt_price = '$' + mgmtMatch[1];

  // Description from summary table
  const descTableMatch = html.match(/<td[^>]*>\s*([A-Z][A-Z,\s]+[A-Z])\s*<\/td>/);
  if (descTableMatch) result.description = descTableMatch[1].trim();

  // Agency usage
  const agencyMatch = html.match(/Multi\s*Agency|Single\s*Agency|Army|Navy|Air Force/i);
  if (agencyMatch) result.agency_usage = agencyMatch[0];

  // DLA stock
  const dlaMatch = html.match(/Zero DLA stock[^<]*/i);
  if (dlaMatch) result.dla_stock = dlaMatch[0];

  // Manufacturers - extract part numbers and companies
  const mfrRegex = /([A-Z0-9\-]+)<\/a><\/td>\s*<td[^>]*>(?:<[^>]+>)*([^<]+?)(?:<\/[^>]+>)*<\/td>\s*<td[^>]*>(?:<[^>]+>)*(\d+)/g;
  let mfrMatch;
  while ((mfrMatch = mfrRegex.exec(html)) !== null) {
    result.manufacturers.push({
      part_number: mfrMatch[1],
      company: mfrMatch[2].trim(),
      cage: mfrMatch[3],
    });
  }

  return result;
}

export async function getNsnNowData(nsn) {
  try {
    const cookie = await login();
    
    // Search for the NSN
    const searchUrl = `https://www.nsn-now.com/Indexing/PublicSearch.aspx?NSN=${encodeURIComponent(nsn)}`;
    const searchResp = await fetchUrl(searchUrl, {
      headers: { 'Cookie': cookie },
    });

    // Try to get the detail page
    const detailLinkMatch = searchResp.body.match(/detail\/summary\.aspx\?nsn=[^"'\s]+/i);
    if (!detailLinkMatch) {
      // Try logged in search
      const loggedSearch = await fetchUrl(`https://www.nsn-now.com/search/results.aspx?q=${encodeURIComponent(nsn)}`, {
        headers: { 'Cookie': cookie },
      });
      const detailLink2 = loggedSearch.body.match(/detail\/summary\.aspx\?nsn=[^"'\s]+/i);
      if (detailLink2) {
        const detailResp = await fetchUrl('https://www.nsn-now.com/' + detailLink2[0], {
          headers: { 'Cookie': cookie },
        });
        return parseNsnData(detailResp.body, nsn);
      }
      return null;
    }

    const detailResp = await fetchUrl('https://www.nsn-now.com/' + detailLinkMatch[0], {
      headers: { 'Cookie': cookie },
    });

    return parseNsnData(detailResp.body, nsn);
  } catch (err) {
    console.error('NSN-Now scrape error:', err.message);
    return null;
  }
}