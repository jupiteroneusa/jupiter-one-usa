// admin/uiHelpers.js
// Shared UI helper functions used across admin order/invoice/supplier-po pages.
// Plain HTML strings (no JSX), CSS comes from admin/index.js styles.

// ===== Formatters =====
export function currency(n) {
  const v = parseFloat(n || 0);
  return '$' + v.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function shortDate(d) {
  if (!d) return '&mdash;';
  return new Date(d).toLocaleDateString();
}

export function shortDateTime(d) {
  if (!d) return '&mdash;';
  return new Date(d).toLocaleString();
}

// ===== Badges =====
export function priorityBadge(p) {
  const map = {
    'Standard': { color: '#7a8a9a', bg: '#1e2d42' },
    'Urgent':   { color: '#c8932a', bg: 'rgba(200,147,42,0.15)' },
    'AOG':      { color: '#e05050', bg: 'rgba(224,80,80,0.15)' }
  };
  const s = map[p] || map['Standard'];
  return '<span style="display:inline-block;font-size:.65rem;letter-spacing:.08em;text-transform:uppercase;padding:3px 8px;border:1px solid ' + s.color + ';color:' + s.color + ';background:' + s.bg + ';">' + (p || 'Standard') + '</span>';
}

export function statusBadge(s) {
  const map = {
    'Submitted':'blue','Pending Approval':'gold','Under Review':'blue','Sourcing':'gold','Quoted':'gold',
    'Closed':'green','Cancelled':'red','Active':'green','New':'blue','Sent':'blue',
    'Accepted':'green','Rejected':'red','Expired':'gray','Confirmed':'green',
    'Processing':'blue','Ready to Ship':'gold','Shipped':'gold','Delivered':'green',
    'Paid':'green','Unpaid':'red','Partially Paid':'gold','Overdue':'red',
    'Draft':'gray','Standard':'gray','Urgent':'gold','AOG':'red'
  };
  const colors = {
    blue:  { color: '#5ab4e8', bg: 'rgba(90,180,232,0.1)' },
    gold:  { color: '#c8932a', bg: 'rgba(200,147,42,0.1)' },
    green: { color: '#4caf50', bg: 'rgba(76,175,80,0.1)' },
    red:   { color: '#e05050', bg: 'rgba(224,80,80,0.1)' },
    gray:  { color: '#7a8a9a', bg: 'transparent' }
  };
  const c = colors[map[s] || 'gray'];
  return '<span style="display:inline-block;font-size:.65rem;letter-spacing:.08em;text-transform:uppercase;padding:3px 8px;border:1px solid ' + c.color + ';color:' + c.color + ';background:' + c.bg + ';white-space:nowrap;">' + (s || '\u2014') + '</span>';
}

// ===== Lifecycle Timeline =====
// Renders a horizontal timeline showing order lifecycle stages
// Stages with timestamps are gold/done, stages without are gray/pending
export function lifecycleTimeline(order) {
  const stages = [
    { key: 'confirmed_at',     label: 'Confirmed' },
    { key: 'paid_at',          label: 'Paid' },
    { key: 'ready_to_ship_at', label: 'Ready to Ship' },
    { key: 'shipped_at',       label: 'Shipped' },
    { key: 'delivered_at',     label: 'Delivered' }
  ];
  if (order.cancelled_at) {
    stages.push({ key: 'cancelled_at', label: 'Cancelled', danger: true });
  }

  let html = '<div style="display:flex;align-items:center;justify-content:space-between;padding:16px 8px;background:#0a1628;border:1px solid #1e2d42;margin-bottom:16px;overflow-x:auto;">';
  stages.forEach(function(stage, idx) {
    const ts = order[stage.key];
    const done = !!ts;
    const color = stage.danger ? '#e05050' : (done ? '#c8932a' : '#7a8a9a');
    const bg = done ? color : 'transparent';
    const border = stage.danger ? '#e05050' : (done ? '#c8932a' : '#2a3a4a');

    // Connector line (skip on first item)
    if (idx > 0) {
      const prevDone = !!order[stages[idx-1].key];
      const lineColor = prevDone && done ? '#c8932a' : '#2a3a4a';
      html += '<div style="flex:1;height:2px;background:' + lineColor + ';margin:0 4px;min-width:20px;"></div>';
    }

    html += '<div style="display:flex;flex-direction:column;align-items:center;min-width:80px;">';
    html += '<div style="width:24px;height:24px;border-radius:50%;background:' + bg + ';border:2px solid ' + border + ';display:flex;align-items:center;justify-content:center;color:#0a1628;font-size:.7rem;font-weight:700;">';
    html += done ? '\u2713' : (idx + 1);
    html += '</div>';
    html += '<div style="font-size:.7rem;color:' + color + ';font-weight:600;letter-spacing:.05em;text-transform:uppercase;margin-top:6px;text-align:center;">' + stage.label + '</div>';
    if (done) {
      html += '<div style="font-size:.65rem;color:#7a8a9a;margin-top:2px;">' + shortDate(ts) + '</div>';
    }
    html += '</div>';
  });
  html += '</div>';
  return html;
}

// ===== Field rendering helpers =====
export function detailItem(label, value) {
  return '<div class="detail-item"><div class="detail-label">' + label + '</div><div class="detail-value">' + (value || '&mdash;') + '</div></div>';
}

export function inputField(label, name, value, type = 'text', extra = '') {
  return '<div style="margin-bottom:12px;">' +
    '<div style="font-size:.68rem;color:#7a8a9a;letter-spacing:.1em;text-transform:uppercase;margin-bottom:4px;">' + label + '</div>' +
    '<input type="' + type + '" name="' + name + '" value="' + (value == null ? '' : String(value).replace(/"/g, '&quot;')) + '" ' + extra + ' style="width:100%;background:#0a1628;border:1px solid #1e2d42;color:#eef1f5;padding:8px 12px;font-size:.85rem;"/>' +
    '</div>';
}

export function selectField(label, name, value, options) {
  let html = '<div style="margin-bottom:12px;">';
  html += '<div style="font-size:.68rem;color:#7a8a9a;letter-spacing:.1em;text-transform:uppercase;margin-bottom:4px;">' + label + '</div>';
  html += '<select name="' + name + '" style="width:100%;background:#0a1628;border:1px solid #1e2d42;color:#eef1f5;padding:8px 12px;font-size:.85rem;">';
  options.forEach(function(opt) {
    const v = typeof opt === 'object' ? opt.value : opt;
    const lbl = typeof opt === 'object' ? opt.label : opt;
    html += '<option value="' + v + '"' + (value === v ? ' selected' : '') + '>' + lbl + '</option>';
  });
  html += '</select></div>';
  return html;
}

export function textareaField(label, name, value, rows = 3) {
  return '<div style="margin-bottom:12px;">' +
    '<div style="font-size:.68rem;color:#7a8a9a;letter-spacing:.1em;text-transform:uppercase;margin-bottom:4px;">' + label + '</div>' +
    '<textarea name="' + name + '" rows="' + rows + '" style="width:100%;background:#0a1628;border:1px solid #1e2d42;color:#eef1f5;padding:8px 12px;font-size:.85rem;resize:vertical;font-family:inherit;">' + (value || '') + '</textarea>' +
    '</div>';
}

export function checkboxField(label, name, checked) {
  return '<label style="display:flex;align-items:center;gap:8px;cursor:pointer;font-size:.85rem;margin-bottom:8px;">' +
    '<input type="checkbox" name="' + name + '" value="1"' + (checked ? ' checked' : '') + ' style="width:auto;accent-color:#c8932a;"/> ' + label +
    '</label>';
}
