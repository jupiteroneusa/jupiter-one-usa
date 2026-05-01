const fs = require('fs');
let c = fs.readFileSync('public/pages/nsn-detail.html', 'utf8');

// Add NSN-Now section before Related NSNs
c = c.replace(
  "    <!-- Related NSNs in same FSC -->",
  `    <!-- NSN-Now Extended Data -->
    <div class="detail-section" id="nsnnow-section" style="display:none;">
      <div class="detail-section-header">⚡ Extended Market Data</div>
      <div id="nsnnow-content" style="padding:20px;">
        <div style="color:var(--muted);font-size:.85rem;">Loading extended data...</div>
      </div>
    </div>

    <!-- Related NSNs in same FSC -->`
);

// Add NSN-Now fetch after add-rfq-btn listener
c = c.replace(
  "} catch(err) {\n  document.getElementById('content').innerHTML",
  `// Fetch NSN-Now data
  fetch('/api/search/nsnnow/' + nsn)
    .then(r => r.json())
    .then(d => {
      if (!d || d.error) return;
      const section = document.getElementById('nsnnow-section');
      const content = document.getElementById('nsnnow-content');
      if (!section || !content) return;
      section.style.display = 'block';
      let html = '<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:2px;margin-bottom:16px;">';
      html += '<div style="background:var(--card);border:1px solid var(--border);padding:14px 16px;"><div style="font-family:var(--font-mono);font-size:.62rem;letter-spacing:.15em;text-transform:uppercase;color:var(--gold);margin-bottom:4px;">Proc Price</div><div style="font-size:.95rem;color:#4caf50;font-weight:600;">' + (d.proc_price||'—') + '</div></div>';
      html += '<div style="background:var(--card);border:1px solid var(--border);padding:14px 16px;"><div style="font-family:var(--font-mono);font-size:.62rem;letter-spacing:.15em;text-transform:uppercase;color:var(--gold);margin-bottom:4px;">Mgmt Price</div><div style="font-size:.95rem;color:var(--white);font-weight:600;">' + (d.mgmt_price||'—') + '</div></div>';
      html += '<div style="background:var(--card);border:1px solid var(--border);padding:14px 16px;"><div style="font-family:var(--font-mono);font-size:.62rem;letter-spacing:.15em;text-transform:uppercase;color:var(--gold);margin-bottom:4px;">Agency Usage</div><div style="font-size:.95rem;color:var(--white);">' + (d.agency_usage||'—') + '</div></div>';
      html += '</div>';
      if (d.dla_stock) html += '<div style="background:rgba(224,80,80,0.1);border:1px solid #e05050;padding:10px 14px;margin-bottom:16px;font-size:.85rem;color:#e05050;">' + d.dla_stock + '</div>';
      if (d.manufacturers?.length) {
        html += '<table style="width:100%;border-collapse:collapse;font-size:.85rem;"><thead><tr><th style="background:#060e1a;padding:8px 12px;text-align:left;font-size:.65rem;letter-spacing:.15em;text-transform:uppercase;color:var(--muted);border-bottom:1px solid var(--border);">Part Number</th><th style="background:#060e1a;padding:8px 12px;text-align:left;font-size:.65rem;letter-spacing:.15em;text-transform:uppercase;color:var(--muted);border-bottom:1px solid var(--border);">Company</th><th style="background:#060e1a;padding:8px 12px;text-align:left;font-size:.65rem;letter-spacing:.15em;text-transform:uppercase;color:var(--muted);border-bottom:1px solid var(--border);">CAGE</th></tr></thead><tbody>';
        d.manufacturers.forEach(m => {
          html += '<tr><td style="padding:10px 12px;border-bottom:1px solid var(--border);font-family:var(--font-mono);color:var(--gold);">' + m.part_number + '</td><td style="padding:10px 12px;border-bottom:1px solid var(--border);">' + m.company + '</td><td style="padding:10px 12px;border-bottom:1px solid var(--border);font-family:var(--font-mono);color:var(--muted);">' + m.cage + '</td></tr>';
        });
        html += '</tbody></table>';
      }
      content.innerHTML = html;
    })
    .catch(() => {});

} catch(err) {\n  document.getElementById('content').innerHTML`
);

fs.writeFileSync('public/pages/nsn-detail.html', c);
console.log('done');