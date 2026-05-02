const fs = require('fs');
let c = fs.readFileSync('services/nsnnow.js', 'utf8');

// Wait longer for results and try clicking search button
c = c.replace(
  "await new Promise(r => setTimeout(r, 2000));\n\n    // Find detail link",
  `await new Promise(r => setTimeout(r, 4000));
    
    // Try filling in the search box and clicking search
    try {
      await page.evaluate((nsn) => {
        const input = document.querySelector('input[name="txtNSN"], input[id*="NSN"], input[type="text"]');
        if (input) { input.value = nsn; }
      }, nsn);
      await page.click('input[type="submit"], input[value="Search"], button[type="submit"]').catch(() => {});
      await new Promise(r => setTimeout(r, 4000));
    } catch(e) {}

    // Find detail link`
);

fs.writeFileSync('services/nsnnow.js', c);
console.log('done');