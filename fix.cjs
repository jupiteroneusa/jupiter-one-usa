const fs = require('fs');

// Fix contact.html
let c = fs.readFileSync('public/pages/contact.html', 'utf8');
c = c.replace(/\s*\$\{\[[\s\S]*?\]\.map\(\(\[label,val,href\]\)[\s\S]*?\)\.join\(''\)\}/, `
      <div>
        <div style="font-family:var(--font-mono);font-size:.62rem;letter-spacing:.15em;text-transform:uppercase;color:var(--gold);margin-bottom:4px;">Email</div>
        <a href="mailto:DTorchia@jupiteroneusa.com" style="font-size:.95rem;color:var(--white);">DTorchia@jupiteroneusa.com</a>
      </div>
      <div>
        <div style="font-family:var(--font-mono);font-size:.62rem;letter-spacing:.15em;text-transform:uppercase;color:var(--gold);margin-bottom:4px;">Phone</div>
        <a href="tel:+13478217412" style="font-size:.95rem;color:var(--white);">+1 (347) 821-7412</a>
      </div>
      <div>
        <div style="font-family:var(--font-mono);font-size:.62rem;letter-spacing:.15em;text-transform:uppercase;color:var(--gold);margin-bottom:4px;">Address</div>
        <div style="font-size:.95rem;color:var(--white);">400 N Tampa St, Suite 1550, Tampa FL</div>
      </div>`);
fs.writeFileSync('public/pages/contact.html', c);
console.log('contact done');

// Fix about.html - Simple Process steps
let a = fs.readFileSync('public/pages/about.html', 'utf8');
a = a.replace(/\s*\$\{\[[\s\S]*?\['01'[\s\S]*?\)\.join\(''\)\}/, `
          <div style="display:flex;gap:16px;align-items:flex-start;">
            <div style="background:var(--gold);color:var(--navy);font-family:var(--font-display);font-weight:700;font-size:.85rem;padding:6px 12px;flex-shrink:0;">01</div>
            <div><div style="font-family:var(--font-display);font-weight:700;font-size:1rem;letter-spacing:.06em;margin-bottom:4px;">Search</div><div style="font-size:.88rem;color:var(--muted);">Search our 14M+ NSN catalog by NSN, part number, or description.</div></div>
          </div>
          <div style="display:flex;gap:16px;align-items:flex-start;">
            <div style="background:var(--gold);color:var(--navy);font-family:var(--font-display);font-weight:700;font-size:.85rem;padding:6px 12px;flex-shrink:0;">02</div>
            <div><div style="font-family:var(--font-display);font-weight:700;font-size:1rem;letter-spacing:.06em;margin-bottom:4px;">Request</div><div style="font-size:.88rem;color:var(--muted);">Add parts to your RFQ cart, set quantities and target prices, submit.</div></div>
          </div>
          <div style="display:flex;gap:16px;align-items:flex-start;">
            <div style="background:var(--gold);color:var(--navy);font-family:var(--font-display);font-weight:700;font-size:.85rem;padding:6px 12px;flex-shrink:0;">03</div>
            <div><div style="font-family:var(--font-display);font-weight:700;font-size:1rem;letter-spacing:.06em;margin-bottom:4px;">Source</div><div style="font-size:.88rem;color:var(--muted);">Our team sources from verified suppliers and builds your quote.</div></div>
          </div>
          <div style="display:flex;gap:16px;align-items:flex-start;">
            <div style="background:var(--gold);color:var(--navy);font-family:var(--font-display);font-weight:700;font-size:.85rem;padding:6px 12px;flex-shrink:0;">04</div>
            <div><div style="font-family:var(--font-display);font-weight:700;font-size:1rem;letter-spacing:.06em;margin-bottom:4px;">Deliver</div><div style="font-size:.88rem;color:var(--muted);">Accept the quote, place the order. We handle the rest.</div></div>
          </div>`);

// Fix about.html - What You Can Expect
a = a.replace(/\s*\$\{\[[\s\S]*?'Response to all RFQs[\s\S]*?\)\.join\(''\)\}/, `
          <div style="display:flex;gap:10px;align-items:flex-start;"><span style="color:var(--gold);flex-shrink:0;">&#10003;</span><span style="font-size:.9rem;color:var(--muted);">Response to all RFQs within 24 business hours</span></div>
          <div style="display:flex;gap:10px;align-items:flex-start;"><span style="color:var(--gold);flex-shrink:0;">&#10003;</span><span style="font-size:.9rem;color:var(--muted);">Transparent pricing with no hidden fees</span></div>
          <div style="display:flex;gap:10px;align-items:flex-start;"><span style="color:var(--gold);flex-shrink:0;">&#10003;</span><span style="font-size:.9rem;color:var(--muted);">Parts sourced only from certified, verified suppliers</span></div>
          <div style="display:flex;gap:10px;align-items:flex-start;"><span style="color:var(--gold);flex-shrink:0;">&#10003;</span><span style="font-size:.9rem;color:var(--muted);">Traceability documentation provided where available</span></div>
          <div style="display:flex;gap:10px;align-items:flex-start;"><span style="color:var(--gold);flex-shrink:0;">&#10003;</span><span style="font-size:.9rem;color:var(--muted);">Clear communication from quote through delivery</span></div>
          <div style="display:flex;gap:10px;align-items:flex-start;"><span style="color:var(--gold);flex-shrink:0;">&#10003;</span><span style="font-size:.9rem;color:var(--muted);">Expedited sourcing available for AOG and urgent needs</span></div>
          <div style="display:flex;gap:10px;align-items:flex-start;"><span style="color:var(--gold);flex-shrink:0;">&#10003;</span><span style="font-size:.9rem;color:var(--muted);">All applicable US export control laws followed</span></div>`);
fs.writeFileSync('public/pages/about.html', a);
console.log('about done');

// Fix faq.html
let f = fs.readFileSync('public/pages/faq.html', 'utf8');
const faqHTML = `
  <div class="faq-section">
    <div class="faq-section-title">Website &amp; Account</div>
    <div class="faq-item"><div class="faq-q" onclick="this.parentElement.classList.toggle('open')">What is the cost of registration?<span>+</span></div><div class="faq-a">Jupiter One USA offers free account registration and a free-to-use procurement sourcing service.</div></div>
    <div class="faq-item"><div class="faq-q" onclick="this.parentElement.classList.toggle('open')">Is every NSN in your database actually in stock?<span>+</span></div><div class="faq-a">Parts listed in our catalog are sourced through our supplier community and are not necessarily held in our physical inventory. When you submit an RFQ, we source the part on your behalf.</div></div>
    <div class="faq-item"><div class="faq-q" onclick="this.parentElement.classList.toggle('open')">How do I request a quote?<span>+</span></div><div class="faq-a">Search for any NSN or part number, click Add to RFQ, set quantities and target prices, then click Submit RFQ. Your representative will respond with pricing shortly.</div></div>
  </div>
  <div class="faq-section">
    <div class="faq-section-title">Purchasing &amp; Delivery</div>
    <div class="faq-item"><div class="faq-q" onclick="this.parentElement.classList.toggle('open')">How long before delivery from the point I place an order?<span>+</span></div><div class="faq-a">Domestic orders typically deliver within 3 business days. International orders require 7-10 business days. Exact lead times are confirmed at time of quote.</div></div>
    <div class="faq-item"><div class="faq-q" onclick="this.parentElement.classList.toggle('open')">How do I know the parts will be correct?<span>+</span></div><div class="faq-a">All parts are verified against your order specs. Certificates of Conformance and FAA 8130-3 forms are provided where available.</div></div>
    <div class="faq-item"><div class="faq-q" onclick="this.parentElement.classList.toggle('open')">What condition are the parts in?<span>+</span></div><div class="faq-a">Condition is specified on every quote: New (NE), New Surplus (NS), Overhauled (OH), Serviceable (SV), or As Removed (AR).</div></div>
    <div class="faq-item"><div class="faq-q" onclick="this.parentElement.classList.toggle('open')">What is the warranty on parts?<span>+</span></div><div class="faq-a">The original manufacturer warranty applies in most cases. Overhauled or serviceable parts carry condition-appropriate warranties specified in your quote.</div></div>
  </div>
  <div class="faq-section">
    <div class="faq-section-title">Payment</div>
    <div class="faq-item"><div class="faq-q" onclick="this.parentElement.classList.toggle('open')">How do I pay for parts?<span>+</span></div><div class="faq-a">Initial orders are payable by Credit Card, COD, or Wire Transfer.</div></div>
    <div class="faq-item"><div class="faq-q" onclick="this.parentElement.classList.toggle('open')">Can I get payment terms?<span>+</span></div><div class="faq-a">Payment terms may be extended to repeat customers following a successful payment history. Contact your representative to discuss eligibility.</div></div>
    <div class="faq-item"><div class="faq-q" onclick="this.parentElement.classList.toggle('open')">Are there any hidden fees?<span>+</span></div><div class="faq-a">No. We provide transparent, all-inclusive pricing. The price you see is the price you pay.</div></div>
  </div>
  <div class="faq-section">
    <div class="faq-section-title">Export &amp; Compliance</div>
    <div class="faq-item"><div class="faq-q" onclick="this.parentElement.classList.toggle('open')">Does Jupiter One USA comply with export regulations?<span>+</span></div><div class="faq-a">Yes. Jupiter One USA complies with all applicable US export control laws including ITAR and EAR.</div></div>
    <div class="faq-item"><div class="faq-q" onclick="this.parentElement.classList.toggle('open')">Can you ship internationally?<span>+</span></div><div class="faq-a">Yes, we ship worldwide subject to applicable export control regulations. International lead times are typically 7-10 business days.</div></div>
  </div>`;
f = f.replace(/\s*\$\{\[[\s\S]*?\]\.map\(\(\{ section[\s\S]*?\)\.join\(''\)\}/, faqHTML);
fs.writeFileSync('public/pages/faq.html', f);
console.log('faq done');