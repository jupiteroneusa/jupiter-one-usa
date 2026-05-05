const fs = require('fs');
let a = fs.readFileSync('admin/index.js', 'utf8');
const lines = a.split('\n');

// Find line 1078 (0-indexed 1077) - Send Quote to Customer button
const sendIdx = lines.findIndex((l, i) => i >= 1070 && i <= 1085 && l.includes('Send Quote to Customer'));
console.log('Send button at line:', sendIdx + 1, JSON.stringify(lines[sendIdx]));

if (sendIdx > -1) {
  // Replace the single button line with buttons + save draft + beforeunload script
  const cancelIdx = lines.findIndex((l, i) => i >= sendIdx && i <= sendIdx + 5 && l.includes('Cancel'));
  console.log('Cancel at line:', cancelIdx + 1);
  
  if (cancelIdx > -1) {
    lines[sendIdx] = "      html += '<div style=\"display:flex;gap:10px;\">';";
    lines[sendIdx] += "\n      html += '<button type=\"submit\" class=\"btn btn-gold\" style=\"padding:12px 28px;\">Send Quote to Customer &rarr;</button>';";
    lines[sendIdx] += "\n      html += '<button type=\"button\" class=\"btn btn-outline\" style=\"padding:12px 20px;border-color:#4caf50;color:#4caf50;\" id=\"save-draft-btn\" onclick=\"saveDraft()\">Save Draft</button>';";
    lines[cancelIdx] = "      html += '<a href=\"/admin/rfqs/' + rfq.id + '\" class=\"btn btn-outline\" style=\"padding:12px 20px;\">Back to RFQ</a></div>';";
    console.log('Buttons: FIXED');
  }
}

// Find the script line and add beforeunload + saveDraft function
const scriptIdx = lines.findIndex((l, i) => i >= 1048 && i <= 1058 && l.includes("addRowScript = 'let qc="));
console.log('Script at line:', scriptIdx + 1);

if (scriptIdx > -1) {
  // Add saveDraft and beforeunload before the addRowScript
  const beforeunloadJS = "      const draftScript = 'let isDirty=false;document.querySelectorAll(\"input,textarea\").forEach(function(el){el.addEventListener(\"input\",function(){isDirty=true;});});window.addEventListener(\"beforeunload\",function(e){if(isDirty){e.preventDefault();e.returnValue=\"\";}});function saveDraft(){isDirty=false;const form=document.querySelector(\"form\");const fd=new FormData(form);fetch(\"/admin/rfqs/'+rfq.id+'/quote-draft\",{method:\"POST\",body:fd}).then(function(r){return r.json();}).then(function(d){const btn=document.getElementById(\"save-draft-btn\");if(btn){btn.textContent=d.ok?\"Draft Saved \\u2713\":\"Save Failed\";btn.style.color=d.ok?\"#4caf50\":\"#e05050\";}setTimeout(function(){if(btn&&d.ok){btn.textContent=\"Save Draft\";btn.style.color=\"\";}},3000);}).catch(function(){isDirty=true;});}';";
  lines.splice(scriptIdx, 0, beforeunloadJS);
  
  // Now find the html += script line (shifted by 1)
  const htmlScriptIdx = lines.findIndex((l, i) => i >= scriptIdx + 1 && i <= scriptIdx + 10 && l.includes("html += '<script>'"));
  if (htmlScriptIdx > -1) {
    lines[htmlScriptIdx] = lines[htmlScriptIdx].replace("html += '<script>'", "html += '<script>' + draftScript +");
    console.log('Script injection: FIXED');
  } else {
    // Find the script tag differently  
    const scriptTagIdx = lines.findIndex((l, i) => i >= scriptIdx && i <= scriptIdx + 10 && l.includes("'<script>'"));
    if (scriptTagIdx > -1) {
      lines[scriptTagIdx] = lines[scriptTagIdx].replace("'<script>'", "'<script>' + draftScript");
      console.log('Script tag: FIXED');
    } else console.log('Script tag: NOT FOUND');
  }
  console.log('Draft JS: ADDED');
}

fs.writeFileSync('admin/index.js', lines.join('\n'));
console.log('Done.');
