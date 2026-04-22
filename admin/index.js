// admin/index.js
import AdminJS from 'adminjs';
import AdminJSExpress from '@adminjs/express';
import { Adapter, Database, Resource } from '@adminjs/sql';
import 'dotenv/config';

AdminJS.registerAdapter({ Database, Resource });

export async function buildAdminRouter() {
  const db = await new Adapter('mssql', {
    connectionString: `mssql://${encodeURIComponent(process.env.DB_USER)}:${encodeURIComponent(process.env.DB_PASSWORD)}@${process.env.DB_SERVER}:${process.env.DB_PORT || 1433}/${process.env.DB_NAME}`,
    database: process.env.DB_NAME,
  }).init();

  const admin = new AdminJS({
    resources: [

      // ── RFQ PIPELINE ───────────────────────────────────────
      {
        resource: db.table('rfq_headers'),
        options: {
          navigation: { name: '📋 RFQ Pipeline', icon: 'List' },
          sort: { sortBy: 'submitted_at', direction: 'desc' },
          listProperties: ['rfq_number', 'status', 'priority', 'submitted_at', 'assigned_to'],
          filterProperties: ['status', 'priority', 'submitted_at', 'assigned_to'],
          editProperties: ['status', 'priority', 'assigned_to', 'internal_notes'],
          showProperties: ['rfq_number', 'status', 'priority', 'notes', 'internal_notes', 'assigned_to', 'submitted_at', 'ip_address'],
          properties: {
            status: {
              availableValues: [
                { label: '🆕 Submitted',    value: 'Submitted' },
                { label: '👀 Under Review', value: 'Under Review' },
                { label: '🔍 Sourcing',     value: 'Sourcing' },
                { label: '💰 Quoted',       value: 'Quoted' },
                { label: '✅ Closed',       value: 'Closed' },
                { label: '❌ Cancelled',    value: 'Cancelled' },
              ],
            },
            priority: {
              availableValues: [
                { label: 'Standard', value: 'Standard' },
                { label: '⚡ Urgent', value: 'Urgent' },
                { label: '🚨 AOG',    value: 'AOG' },
              ],
            },
            internal_notes: { type: 'textarea' },
          },
        },
      },

      {
        resource: db.table('rfq_lines'),
        options: {
          navigation: { name: '📋 RFQ Pipeline', icon: 'List' },
          listProperties: ['rfq_id', 'line_number', 'nsn', 'part_number', 'item_name', 'quantity', 'condition_code', 'target_price', 'status'],
          filterProperties: ['rfq_id', 'nsn', 'part_number', 'status'],
          editProperties: ['status', 'notes'],
          properties: {
            status: {
              availableValues: [
                { label: 'Pending',   value: 'Pending' },
                { label: 'Sourcing',  value: 'Sourcing' },
                { label: 'Sourced',   value: 'Sourced' },
                { label: 'Quoted',    value: 'Quoted' },
                { label: 'Ordered',   value: 'Ordered' },
                { label: 'Cancelled', value: 'Cancelled' },
              ],
            },
          },
        },
      },

      // ── SOURCING WORKSPACE ─────────────────────────────────
      {
        resource: db.table('sourcing_requests'),
        options: {
          navigation: { name: '🔍 Sourcing', icon: 'Search' },
          sort: { sortBy: 'created_at', direction: 'desc' },
          listProperties: ['rfq_line_id', 'status', 'assigned_to', 'due_date'],
          editProperties: ['status', 'assigned_to', 'due_date', 'notes'],
          properties: {
            status: {
              availableValues: [
                { label: 'Open',        value: 'Open' },
                { label: 'In Progress', value: 'In Progress' },
                { label: 'Sourced',     value: 'Sourced' },
                { label: 'No Stock',    value: 'No Stock' },
                { label: 'Cancelled',   value: 'Cancelled' },
              ],
            },
          },
        },
      },

      {
        resource: db.table('sourcing_quotes'),
        options: {
          navigation: { name: '🔍 Sourcing', icon: 'Search' },
          sort: { sortBy: 'created_at', direction: 'desc' },
          listProperties: ['sourcing_id', 'supplier_id', 'unit_cost', 'condition_code', 'lead_time_days', 'source_platform', 'is_selected', 'has_coc', 'has_8130'],
          filterProperties: ['supplier_id', 'source_platform', 'is_selected', 'condition_code'],
          editProperties: ['supplier_id', 'unit_cost', 'quantity_available', 'condition_code', 'lead_time_days', 'quote_expiry', 'source_platform', 'source_ref', 'has_coc', 'has_8130', 'has_trace', 'is_selected', 'notes'],
          properties: {
            source_platform: {
              availableValues: [
                { label: 'ILS / Locator', value: 'ILS' },
                { label: 'Haystack Gold', value: 'Haystack' },
                { label: 'PartsBase',     value: 'PartsBase' },
                { label: 'Direct',        value: 'Direct' },
                { label: 'Other',         value: 'Other' },
              ],
            },
            condition_code: {
              availableValues: [
                { label: 'NE — New',           value: 'NE' },
                { label: 'NS — New Surplus',   value: 'NS' },
                { label: 'OH — Overhauled',    value: 'OH' },
                { label: 'SV — Serviceable',   value: 'SV' },
                { label: 'AR — As Removed',    value: 'AR' },
                { label: 'RP — Repairable',    value: 'RP' },
              ],
            },
            notes: { type: 'textarea' },
          },
        },
      },

      // ── QUOTES ─────────────────────────────────────────────
      {
        resource: db.table('quotes'),
        options: {
          navigation: { name: '💰 Quotes', icon: 'Currency' },
          sort: { sortBy: 'created_at', direction: 'desc' },
          listProperties: ['quote_number', 'status', 'total_amount', 'total_cost', 'total_margin', 'valid_until', 'sent_at'],
          filterProperties: ['status', 'customer_id', 'created_at'],
          editProperties: ['status', 'valid_until', 'payment_terms', 'delivery_terms', 'notes', 'lost_reason_id', 'lost_notes'],
          properties: {
            status: {
              availableValues: [
                { label: '📝 Draft',    value: 'Draft' },
                { label: '📤 Sent',    value: 'Sent' },
                { label: '✅ Accepted', value: 'Accepted' },
                { label: '❌ Rejected', value: 'Rejected' },
                { label: '⏰ Expired',  value: 'Expired' },
                { label: '🔄 Revised',  value: 'Revised' },
              ],
            },
            notes: { type: 'textarea' },
            lost_notes: { type: 'textarea' },
          },
        },
      },

      {
        resource: db.table('quote_lines'),
        options: {
          navigation: { name: '💰 Quotes', icon: 'Currency' },
          listProperties: ['quote_id', 'line_number', 'nsn', 'part_number', 'quantity', 'unit_cost', 'markup_pct', 'unit_price', 'line_margin', 'margin_pct'],
          editProperties: ['unit_cost', 'markup_pct', 'unit_price', 'notes'],
        },
      },

      // ── ORDERS ─────────────────────────────────────────────
      {
        resource: db.table('orders'),
        options: {
          navigation: { name: '📦 Orders', icon: 'Box' },
          sort: { sortBy: 'confirmed_at', direction: 'desc' },
          listProperties: ['order_number', 'status', 'total_amount', 'customer_po', 'confirmed_at'],
          filterProperties: ['status', 'customer_id', 'confirmed_at'],
          editProperties: ['status', 'notes'],
          properties: {
            status: {
              availableValues: [
                { label: 'Confirmed',          value: 'Confirmed' },
                { label: 'Processing',         value: 'Processing' },
                { label: 'Partially Shipped',  value: 'Partially Shipped' },
                { label: 'Shipped',            value: 'Shipped' },
                { label: 'Delivered',          value: 'Delivered' },
                { label: 'Cancelled',          value: 'Cancelled' },
              ],
            },
          },
        },
      },

      {
        resource: db.table('purchase_orders'),
        options: {
          navigation: { name: '📦 Orders', icon: 'Box' },
          listProperties: ['po_number', 'order_id', 'supplier_id', 'status', 'total_cost', 'issued_at'],
          editProperties: ['status', 'acknowledged_at', 'expected_ship_date', 'notes'],
          properties: {
            status: {
              availableValues: [
                { label: 'Issued',       value: 'Issued' },
                { label: 'Acknowledged', value: 'Acknowledged' },
                { label: 'Shipped',      value: 'Shipped' },
                { label: 'Received',     value: 'Received' },
                { label: 'Cancelled',    value: 'Cancelled' },
              ],
            },
          },
        },
      },

      // ── SHIPMENTS ──────────────────────────────────────────
      {
        resource: db.table('shipments'),
        options: {
          navigation: { name: '🚚 Shipments', icon: 'Truck' },
          sort: { sortBy: 'created_at', direction: 'desc' },
          listProperties: ['shipment_number', 'order_id', 'carrier', 'tracking_number', 'status', 'ship_date', 'estimated_delivery'],
          editProperties: ['carrier', 'tracking_number', 'tracking_url', 'service_level', 'status', 'ship_date', 'estimated_delivery', 'actual_delivery', 'notes'],
          properties: {
            status: {
              availableValues: [
                { label: 'Pending',           value: 'Pending' },
                { label: 'Picked Up',         value: 'Picked Up' },
                { label: 'In Transit',        value: 'In Transit' },
                { label: 'Out for Delivery',  value: 'Out for Delivery' },
                { label: 'Delivered',         value: 'Delivered' },
                { label: 'Exception',         value: 'Exception' },
              ],
            },
          },
        },
      },

      // ── FINANCIALS ─────────────────────────────────────────
      {
        resource: db.table('invoices'),
        options: {
          navigation: { name: '🧾 Financials', icon: 'Receipt' },
          sort: { sortBy: 'issue_date', direction: 'desc' },
          listProperties: ['invoice_number', 'status', 'total_amount', 'amount_paid', 'balance_due', 'issue_date', 'due_date'],
          filterProperties: ['status', 'customer_id', 'due_date'],
          editProperties: ['status', 'notes'],
          properties: {
            status: {
              availableValues: [
                { label: 'Unpaid',          value: 'Unpaid' },
                { label: 'Partially Paid',  value: 'Partially Paid' },
                { label: 'Paid',            value: 'Paid' },
                { label: 'Overdue',         value: 'Overdue' },
                { label: 'Voided',          value: 'Voided' },
              ],
            },
          },
        },
      },

      {
        resource: db.table('payments'),
        options: {
          navigation: { name: '🧾 Financials', icon: 'Receipt' },
          sort: { sortBy: 'payment_date', direction: 'desc' },
          listProperties: ['invoice_id', 'amount', 'payment_method', 'reference_number', 'payment_date'],
          actions: { delete: { isAccessible: false } },
        },
      },

      {
        resource: db.table('supplier_invoices'),
        options: {
          navigation: { name: '🧾 Financials', icon: 'Receipt' },
          listProperties: ['supplier_id', 'invoice_number', 'status', 'total_amount', 'amount_paid', 'due_date'],
          editProperties: ['status', 'notes'],
        },
      },

      // ── SUPPLIERS ──────────────────────────────────────────
      {
        resource: db.table('suppliers'),
        options: {
          navigation: { name: '🏭 Suppliers', icon: 'Factory' },
          sort: { sortBy: 'is_preferred', direction: 'desc' },
          listProperties: ['company_name', 'cage_code', 'status', 'is_preferred', 'on_time_rate', 'avg_quality_score'],
          filterProperties: ['status', 'is_preferred', 'country'],
          editProperties: ['company_name', 'cage_code', 'website', 'address1', 'city', 'state', 'zip', 'country', 'status', 'is_preferred', 'notes'],
        },
      },

      {
        resource: db.table('supplier_certifications'),
        options: {
          navigation: { name: '🏭 Suppliers', icon: 'Factory' },
          listProperties: ['supplier_id', 'cert_type', 'cert_number', 'expiry_date', 'status'],
          filterProperties: ['cert_type', 'status', 'expiry_date'],
        },
      },

      {
        resource: db.table('supplier_performance'),
        options: {
          navigation: { name: '🏭 Suppliers', icon: 'Factory' },
          listProperties: ['supplier_id', 'order_id', 'on_time_delivery', 'quality_score', 'condition_accurate', 'docs_complete', 'created_at'],
        },
      },

      // ── CUSTOMERS ──────────────────────────────────────────
      {
        resource: db.table('customers'),
        options: {
          navigation: { name: '👤 Customers', icon: 'User' },
          sort: { sortBy: 'created_at', direction: 'desc' },
          listProperties: ['first_name', 'last_name', 'company', 'email', 'tier_id', 'status', 'created_at'],
          filterProperties: ['status', 'tier_id', 'created_at'],
          editProperties: ['first_name', 'last_name', 'company', 'job_title', 'email', 'phone', 'tier_id', 'status', 'notes'],
          showProperties: ['first_name', 'last_name', 'company', 'email', 'phone', 'tier_id', 'status', 'email_verified', 'created_at', 'last_login_at'],
          properties: {
            password_hash: { isVisible: false },
            email_verify_token: { isVisible: false },
            status: {
              availableValues: [
                { label: '✅ Active',    value: 'Active' },
                { label: '⛔ Suspended', value: 'Suspended' },
                { label: '⏳ Pending',   value: 'Pending' },
              ],
            },
          },
        },
      },

      // ── INBOUND LEADS (DIBBS/SAM) ─────────────────────────
      {
        resource: db.table('inbound_solicitations'),
        options: {
          navigation: { name: '📥 Inbound Leads', icon: 'Inbox' },
          sort: { sortBy: 'due_date', direction: 'asc' },
          listProperties: ['source', 'nsn', 'item_name', 'agency', 'due_date', 'status'],
          filterProperties: ['source', 'status', 'due_date'],
          editProperties: ['status', 'assigned_to', 'notes'],
          properties: {
            status: {
              availableValues: [
                { label: '🆕 New',       value: 'New' },
                { label: '👀 Reviewing', value: 'Reviewing' },
                { label: '📝 Bidding',   value: 'Bidding' },
                { label: '✅ Won',       value: 'Won' },
                { label: '❌ Lost',      value: 'Lost' },
                { label: '⏰ Expired',   value: 'Expired' },
                { label: '⏭ Skipped',   value: 'Skipped' },
              ],
            },
            raw_data: { isVisible: { list: false, show: true, edit: false, filter: false } },
          },
        },
      },

      // ── FOLLOW-UP TASKS ────────────────────────────────────
      {
        resource: db.table('follow_up_tasks'),
        options: {
          navigation: { name: '✅ Tasks', icon: 'CheckSquare' },
          sort: { sortBy: 'due_date', direction: 'asc' },
          listProperties: ['entity_type', 'entity_id', 'task_type', 'due_date', 'status', 'assigned_to'],
          filterProperties: ['status', 'task_type', 'due_date', 'assigned_to'],
          editProperties: ['status', 'due_date', 'assigned_to', 'notes'],
          properties: {
            status: {
              availableValues: [
                { label: 'Open',      value: 'Open' },
                { label: 'Done',      value: 'Done' },
                { label: 'Snoozed',   value: 'Snoozed' },
                { label: 'Cancelled', value: 'Cancelled' },
              ],
            },
          },
        },
      },

      // ── MARKET INTELLIGENCE ────────────────────────────────
      {
        resource: db.table('market_price_log'),
        options: {
          navigation: { name: '📊 Intelligence', icon: 'TrendingUp' },
          sort: { sortBy: 'observed_at', direction: 'desc' },
          listProperties: ['nsn', 'part_number', 'source_platform', 'listed_price', 'condition_code', 'observed_at'],
          filterProperties: ['nsn', 'source_platform', 'condition_code'],
          actions: { new: { isAccessible: false }, delete: { isAccessible: false } },
        },
      },

      // ── AUDIT ──────────────────────────────────────────────
      {
        resource: db.table('audit_log'),
        options: {
          navigation: { name: '🔍 Audit', icon: 'Eye' },
          sort: { sortBy: 'created_at', direction: 'desc' },
          listProperties: ['user_type', 'user_email', 'action', 'entity_type', 'entity_id', 'summary', 'ip_address', 'created_at'],
          filterProperties: ['user_type', 'action', 'entity_type', 'created_at'],
          actions: { new: { isAccessible: false }, edit: { isAccessible: false }, delete: { isAccessible: false } },
        },
      },

      {
        resource: db.table('email_log'),
        options: {
          navigation: { name: '🔍 Audit', icon: 'Eye' },
          sort: { sortBy: 'created_at', direction: 'desc' },
          listProperties: ['to_email', 'subject', 'email_type', 'success', 'created_at'],
          filterProperties: ['email_type', 'success', 'created_at', 'to_email'],
          actions: { new: { isAccessible: false }, edit: { isAccessible: false }, delete: { isAccessible: false } },
        },
      },

      // ── SETTINGS ───────────────────────────────────────────
      {
        resource: db.table('system_settings'),
        options: {
          navigation: { name: '⚙️ Settings', icon: 'Settings' },
          listProperties: ['setting_key', 'setting_value', 'description'],
          editProperties: ['setting_value'],
          actions: { new: { isAccessible: false }, delete: { isAccessible: false } },
        },
      },

    ],

    branding: {
      companyName: 'Jupiter One USA',
      logo: false,
      theme: {
        colors: {
          primary100: '#c8932a',
          primary80:  '#b8831a',
          primary60:  '#a87310',
          accent:     '#c8932a',
          hoverBg:    '#1a2535',
          bg:         '#0a1628',
          containerBg:'#111e30',
          border:     '#1e2d42',
          defaultText:'#eef1f5',
          lightText:  '#7a8a9a',
        },
      },
    },

    rootPath: '/admin',
  });

  const adminRouter = AdminJSExpress.buildAuthenticatedRouter(
    admin,
    {
      authenticate: async (email, password) => {
        if (email === process.env.ADMIN_EMAIL && password === process.env.ADMIN_PASSWORD) {
          return { email };
        }
        return null;
      },
      cookieName:     'j1-admin',
      cookiePassword: process.env.SESSION_SECRET,
    },
    null,
    { resave: false, saveUninitialized: true, secret: process.env.SESSION_SECRET }
  );

  return { admin, adminRouter };
}
