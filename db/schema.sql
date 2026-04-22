-- ============================================================
-- JUPITER ONE USA LLC — Complete Database Schema
-- Run in SSMS against your Azure SQL database
-- ============================================================

-- ============================================================
-- SECTION 1: CUSTOMERS & AUTH
-- ============================================================

CREATE TABLE customer_tiers (
    id              INT IDENTITY(1,1) PRIMARY KEY,
    name            VARCHAR(50)  NOT NULL,  -- Standard, MRO, Government, Broker
    description     VARCHAR(255),
    created_at      DATETIME DEFAULT GETDATE()
);

INSERT INTO customer_tiers (name, description) VALUES
('Standard',    'Default tier for new customers'),
('MRO',         'Maintenance repair and overhaul shops — repeat buyers'),
('Government',  'US Government and DoD agencies'),
('Broker',      'Other parts brokers and distributors');

CREATE TABLE customers (
    id                  BIGINT IDENTITY(1,1) PRIMARY KEY,
    tier_id             INT REFERENCES customer_tiers(id) DEFAULT 1,
    -- Account info
    first_name          VARCHAR(100) NOT NULL,
    last_name           VARCHAR(100) NOT NULL,
    company             VARCHAR(150),
    job_title           VARCHAR(100),
    email               VARCHAR(150) NOT NULL UNIQUE,
    phone               VARCHAR(30),
    -- Billing address
    billing_address1    VARCHAR(150),
    billing_address2    VARCHAR(150),
    billing_city        VARCHAR(100),
    billing_state       VARCHAR(50),
    billing_zip         VARCHAR(20),
    billing_country     VARCHAR(50) DEFAULT 'USA',
    -- Account status
    status              VARCHAR(20) DEFAULT 'Active', -- Active, Suspended, Pending
    email_verified      BIT DEFAULT 0,
    email_verify_token  VARCHAR(100),
    password_hash       VARCHAR(255) NOT NULL,
    -- Metadata
    notes               NVARCHAR(MAX),
    created_at          DATETIME DEFAULT GETDATE(),
    updated_at          DATETIME DEFAULT GETDATE(),
    last_login_at       DATETIME
);

CREATE INDEX idx_customers_email   ON customers(email);
CREATE INDEX idx_customers_company ON customers(company);
CREATE INDEX idx_customers_status  ON customers(status);

CREATE TABLE customer_contacts (
    id              BIGINT IDENTITY(1,1) PRIMARY KEY,
    customer_id     BIGINT NOT NULL REFERENCES customers(id),
    first_name      VARCHAR(100) NOT NULL,
    last_name       VARCHAR(100) NOT NULL,
    job_title       VARCHAR(100),
    email           VARCHAR(150),
    phone           VARCHAR(30),
    is_primary      BIT DEFAULT 0,
    created_at      DATETIME DEFAULT GETDATE()
);

CREATE TABLE customer_addresses (
    id              BIGINT IDENTITY(1,1) PRIMARY KEY,
    customer_id     BIGINT NOT NULL REFERENCES customers(id),
    label           VARCHAR(50),  -- e.g. "Main Warehouse", "HQ"
    address1        VARCHAR(150),
    address2        VARCHAR(150),
    city            VARCHAR(100),
    state           VARCHAR(50),
    zip             VARCHAR(20),
    country         VARCHAR(50) DEFAULT 'USA',
    is_default      BIT DEFAULT 0,
    created_at      DATETIME DEFAULT GETDATE()
);

CREATE TABLE customer_sessions (
    id              BIGINT IDENTITY(1,1) PRIMARY KEY,
    customer_id     BIGINT NOT NULL REFERENCES customers(id),
    session_token   VARCHAR(255) NOT NULL UNIQUE,
    ip_address      VARCHAR(45),
    user_agent      VARCHAR(500),
    created_at      DATETIME DEFAULT GETDATE(),
    expires_at      DATETIME NOT NULL,
    invalidated_at  DATETIME  -- set when logged out
);

CREATE INDEX idx_sessions_token     ON customer_sessions(session_token);
CREATE INDEX idx_sessions_customer  ON customer_sessions(customer_id);

CREATE TABLE password_resets (
    id              BIGINT IDENTITY(1,1) PRIMARY KEY,
    customer_id     BIGINT NOT NULL REFERENCES customers(id),
    reset_token     VARCHAR(255) NOT NULL UNIQUE,
    expires_at      DATETIME NOT NULL,
    used_at         DATETIME,
    ip_address      VARCHAR(45),
    created_at      DATETIME DEFAULT GETDATE()
);

CREATE TABLE login_audit (
    id              BIGINT IDENTITY(1,1) PRIMARY KEY,
    customer_id     BIGINT REFERENCES customers(id),  -- NULL if email not found
    email_attempted VARCHAR(150),
    success         BIT NOT NULL,
    fail_reason     VARCHAR(100),  -- wrong_password, not_found, suspended
    ip_address      VARCHAR(45),
    user_agent      VARCHAR(500),
    created_at      DATETIME DEFAULT GETDATE()
);

CREATE INDEX idx_login_audit_customer ON login_audit(customer_id);
CREATE INDEX idx_login_audit_date     ON login_audit(created_at);

-- ============================================================
-- SECTION 2: PARTS CATALOG
-- ============================================================

CREATE TABLE fsg_lookup (
    fsg             VARCHAR(2)   PRIMARY KEY,
    title           VARCHAR(150) NOT NULL,
    notes           NVARCHAR(MAX)
);

CREATE TABLE fsc_lookup (
    fsc             VARCHAR(4)   PRIMARY KEY,
    fsg             VARCHAR(2)   REFERENCES fsg_lookup(fsg),
    title           VARCHAR(150) NOT NULL
);

CREATE TABLE nsn_catalog (
    id              BIGINT IDENTITY(1,1) PRIMARY KEY,
    nsn             VARCHAR(20)  NOT NULL,  -- e.g. 1560-00-082-4545
    niin            VARCHAR(13),            -- last 9 digits
    fsg             VARCHAR(2)   REFERENCES fsg_lookup(fsg),
    fsc             VARCHAR(4)   REFERENCES fsc_lookup(fsc),
    item_name       VARCHAR(255),
    status          VARCHAR(1)  DEFAULT 'A', -- A=Active I=Inactive
    ui              VARCHAR(10),             -- Unit of Issue e.g. EA PK
    created_at      DATETIME DEFAULT GETDATE()
);

CREATE UNIQUE INDEX idx_nsn_unique ON nsn_catalog(nsn);
CREATE INDEX idx_nsn_niin         ON nsn_catalog(niin);
CREATE INDEX idx_nsn_fsc          ON nsn_catalog(fsc);
CREATE INDEX idx_nsn_item_name    ON nsn_catalog(item_name);

CREATE TABLE nsn_parts (
    id              BIGINT IDENTITY(1,1) PRIMARY KEY,
    nsn_id          BIGINT NOT NULL REFERENCES nsn_catalog(id),
    nsn             VARCHAR(20) NOT NULL,
    cage_code       VARCHAR(10),
    part_number     VARCHAR(100),
    created_at      DATETIME DEFAULT GETDATE()
);

CREATE INDEX idx_nsn_parts_nsn        ON nsn_parts(nsn);
CREATE INDEX idx_nsn_parts_part_number ON nsn_parts(part_number);
CREATE INDEX idx_nsn_parts_cage        ON nsn_parts(cage_code);

CREATE TABLE part_conditions (
    code            VARCHAR(5)   PRIMARY KEY,
    label           VARCHAR(50)  NOT NULL,
    description     VARCHAR(255)
);

INSERT INTO part_conditions (code, label, description) VALUES
('NE',  'New',              'New unused part in original packaging'),
('NS',  'New Surplus',      'New but not in original packaging'),
('OH',  'Overhauled',       'Disassembled, inspected, repaired to serviceable'),
('SV',  'Serviceable',      'Inspected and meets performance standards'),
('AR',  'As Removed',       'Removed from aircraft, condition unknown'),
('RP',  'Repairable',       'Unserviceable but can be repaired'),
('SC',  'Scrap',            'Not repairable, for parts only');

CREATE TABLE search_outcomes (
    id              BIGINT IDENTITY(1,1) PRIMARY KEY,
    customer_id     BIGINT REFERENCES customers(id),  -- NULL if not logged in
    search_term     VARCHAR(255) NOT NULL,
    search_type     VARCHAR(20),   -- nsn, part, description
    result_count    INT,
    added_to_rfq    BIT DEFAULT 0,
    converted_to_order BIT DEFAULT 0,
    ip_address      VARCHAR(45),
    created_at      DATETIME DEFAULT GETDATE()
);

CREATE INDEX idx_search_outcomes_customer ON search_outcomes(customer_id);
CREATE INDEX idx_search_outcomes_term     ON search_outcomes(search_term);
CREATE INDEX idx_search_outcomes_date     ON search_outcomes(created_at);

-- ============================================================
-- SECTION 3: SUPPLIERS
-- ============================================================

CREATE TABLE suppliers (
    id                  BIGINT IDENTITY(1,1) PRIMARY KEY,
    company_name        VARCHAR(150) NOT NULL,
    cage_code           VARCHAR(10),
    website             VARCHAR(255),
    -- Address
    address1            VARCHAR(150),
    address2            VARCHAR(150),
    city                VARCHAR(100),
    state               VARCHAR(50),
    zip                 VARCHAR(20),
    country             VARCHAR(50),
    -- Status
    status              VARCHAR(20) DEFAULT 'Active', -- Active, Inactive, Blacklisted
    is_preferred        BIT DEFAULT 0,
    -- Performance summary (updated by triggers/app)
    total_orders        INT DEFAULT 0,
    on_time_rate        DECIMAL(5,2),  -- percentage
    avg_quality_score   DECIMAL(3,1),  -- 1.0 to 5.0
    -- Notes
    notes               NVARCHAR(MAX),
    created_at          DATETIME DEFAULT GETDATE(),
    updated_at          DATETIME DEFAULT GETDATE()
);

CREATE INDEX idx_suppliers_status    ON suppliers(status);
CREATE INDEX idx_suppliers_preferred ON suppliers(is_preferred);
CREATE INDEX idx_suppliers_cage      ON suppliers(cage_code);

CREATE TABLE supplier_contacts (
    id              BIGINT IDENTITY(1,1) PRIMARY KEY,
    supplier_id     BIGINT NOT NULL REFERENCES suppliers(id),
    first_name      VARCHAR(100) NOT NULL,
    last_name       VARCHAR(100) NOT NULL,
    job_title       VARCHAR(100),
    email           VARCHAR(150),
    phone           VARCHAR(30),
    phone_ext       VARCHAR(10),
    is_primary      BIT DEFAULT 0,
    notes           VARCHAR(500),
    created_at      DATETIME DEFAULT GETDATE()
);

CREATE TABLE supplier_certifications (
    id              BIGINT IDENTITY(1,1) PRIMARY KEY,
    supplier_id     BIGINT NOT NULL REFERENCES suppliers(id),
    cert_type       VARCHAR(50) NOT NULL,  -- AS9120, ISO9001, ASA100, FAA
    cert_number     VARCHAR(100),
    issuing_body    VARCHAR(150),
    issue_date      DATE,
    expiry_date     DATE,
    document_url    VARCHAR(500),  -- Azure Blob Storage URL
    status          VARCHAR(20) DEFAULT 'Active', -- Active, Expired, Pending
    created_at      DATETIME DEFAULT GETDATE(),
    updated_at      DATETIME DEFAULT GETDATE()
);

CREATE INDEX idx_supplier_certs_supplier ON supplier_certifications(supplier_id);
CREATE INDEX idx_supplier_certs_expiry   ON supplier_certifications(expiry_date);

CREATE TABLE supplier_performance (
    id                  BIGINT IDENTITY(1,1) PRIMARY KEY,
    supplier_id         BIGINT NOT NULL REFERENCES suppliers(id),
    order_id            BIGINT,  -- FK added after orders table created
    on_time_delivery    BIT,
    quality_score       DECIMAL(3,1),  -- 1.0 to 5.0
    condition_accurate  BIT,   -- was condition as described
    docs_complete       BIT,   -- were certs/docs provided correctly
    notes               NVARCHAR(MAX),
    rated_by            BIGINT,  -- FK to admin_users
    created_at          DATETIME DEFAULT GETDATE()
);

CREATE INDEX idx_supplier_perf_supplier ON supplier_performance(supplier_id);

CREATE TABLE supplier_audit (
    id              BIGINT IDENTITY(1,1) PRIMARY KEY,
    supplier_id     BIGINT NOT NULL REFERENCES suppliers(id),
    field_changed   VARCHAR(100),
    old_value       NVARCHAR(MAX),
    new_value       NVARCHAR(MAX),
    changed_by      BIGINT,  -- FK to admin_users
    ip_address      VARCHAR(45),
    created_at      DATETIME DEFAULT GETDATE()
);

-- ============================================================
-- SECTION 4: RFQ
-- ============================================================

CREATE TABLE rfq_headers (
    id              BIGINT IDENTITY(1,1) PRIMARY KEY,
    customer_id     BIGINT NOT NULL REFERENCES customers(id),
    rfq_number      VARCHAR(20) NOT NULL UNIQUE,  -- e.g. RFQ-2025-00001
    status          VARCHAR(30) DEFAULT 'Submitted',
    -- Submitted, Under Review, Sourcing, Quoted, Closed, Cancelled
    priority        VARCHAR(20) DEFAULT 'Standard',  -- Standard, Urgent, AOG
    notes           NVARCHAR(MAX),  -- customer notes
    internal_notes  NVARCHAR(MAX),  -- your team notes
    assigned_to     BIGINT,         -- FK to admin_users
    submitted_at    DATETIME DEFAULT GETDATE(),
    updated_at      DATETIME DEFAULT GETDATE(),
    ip_address      VARCHAR(45)
);

CREATE INDEX idx_rfq_customer  ON rfq_headers(customer_id);
CREATE INDEX idx_rfq_status    ON rfq_headers(status);
CREATE INDEX idx_rfq_number    ON rfq_headers(rfq_number);
CREATE INDEX idx_rfq_assigned  ON rfq_headers(assigned_to);
CREATE INDEX idx_rfq_submitted ON rfq_headers(submitted_at);

CREATE TABLE rfq_lines (
    id              BIGINT IDENTITY(1,1) PRIMARY KEY,
    rfq_id          BIGINT NOT NULL REFERENCES rfq_headers(id),
    line_number     INT NOT NULL,    -- 1, 2, 3...
    nsn             VARCHAR(20),
    part_number     VARCHAR(100),
    item_name       VARCHAR(255),
    condition_code  VARCHAR(5) REFERENCES part_conditions(code),
    quantity        INT NOT NULL DEFAULT 1,
    unit_of_issue   VARCHAR(10),
    target_price    DECIMAL(10,2),  -- customer's target price per unit
    needed_by       DATE,           -- customer's required date
    notes           VARCHAR(500),
    status          VARCHAR(30) DEFAULT 'Pending',
    -- Pending, Sourcing, Sourced, Quoted, Ordered, Cancelled
    created_at      DATETIME DEFAULT GETDATE()
);

CREATE INDEX idx_rfq_lines_rfq  ON rfq_lines(rfq_id);
CREATE INDEX idx_rfq_lines_nsn  ON rfq_lines(nsn);
CREATE INDEX idx_rfq_lines_pn   ON rfq_lines(part_number);

CREATE TABLE rfq_status_log (
    id              BIGINT IDENTITY(1,1) PRIMARY KEY,
    rfq_id          BIGINT NOT NULL REFERENCES rfq_headers(id),
    old_status      VARCHAR(30),
    new_status      VARCHAR(30) NOT NULL,
    changed_by      BIGINT,   -- FK to admin_users (NULL if system)
    note            VARCHAR(500),
    ip_address      VARCHAR(45),
    created_at      DATETIME DEFAULT GETDATE()
);

CREATE TABLE rfq_messages (
    id              BIGINT IDENTITY(1,1) PRIMARY KEY,
    rfq_id          BIGINT NOT NULL REFERENCES rfq_headers(id),
    sender_type     VARCHAR(10) NOT NULL,  -- customer, admin
    sender_id       BIGINT NOT NULL,
    message         NVARCHAR(MAX) NOT NULL,
    read_at         DATETIME,
    created_at      DATETIME DEFAULT GETDATE()
);

-- ============================================================
-- SECTION 5: SOURCING
-- ============================================================

CREATE TABLE sourcing_requests (
    id              BIGINT IDENTITY(1,1) PRIMARY KEY,
    rfq_line_id     BIGINT NOT NULL REFERENCES rfq_lines(id),
    rfq_id          BIGINT NOT NULL REFERENCES rfq_headers(id),
    status          VARCHAR(30) DEFAULT 'Open',
    -- Open, In Progress, Sourced, No Stock, Cancelled
    assigned_to     BIGINT,   -- FK to admin_users
    due_date        DATE,
    notes           NVARCHAR(MAX),
    created_at      DATETIME DEFAULT GETDATE(),
    updated_at      DATETIME DEFAULT GETDATE()
);

CREATE TABLE sourcing_quotes (
    id              BIGINT IDENTITY(1,1) PRIMARY KEY,
    sourcing_id     BIGINT NOT NULL REFERENCES sourcing_requests(id),
    rfq_line_id     BIGINT NOT NULL REFERENCES rfq_lines(id),
    supplier_id     BIGINT NOT NULL REFERENCES suppliers(id),
    -- What the supplier quoted us
    unit_cost       DECIMAL(10,2) NOT NULL,
    quantity_available INT,
    condition_code  VARCHAR(5) REFERENCES part_conditions(code),
    lead_time_days  INT,
    quote_expiry    DATE,
    -- Source platform where you found this
    source_platform VARCHAR(50),  -- ILS, Haystack, PartsBase, Direct, Other
    source_ref      VARCHAR(100), -- reference number from that platform
    -- Docs
    has_coc         BIT DEFAULT 0,  -- Certificate of Conformance
    has_8130        BIT DEFAULT 0,  -- FAA 8130-3
    has_trace       BIT DEFAULT 0,  -- Traceability docs
    -- Decision
    is_selected     BIT DEFAULT 0,  -- did you choose this one
    notes           NVARCHAR(MAX),
    entered_by      BIGINT,  -- FK to admin_users
    created_at      DATETIME DEFAULT GETDATE(),
    updated_at      DATETIME DEFAULT GETDATE()
);

CREATE INDEX idx_sourcing_quotes_sourcing  ON sourcing_quotes(sourcing_id);
CREATE INDEX idx_sourcing_quotes_supplier  ON sourcing_quotes(supplier_id);
CREATE INDEX idx_sourcing_quotes_selected  ON sourcing_quotes(is_selected);

CREATE TABLE sourcing_audit (
    id              BIGINT IDENTITY(1,1) PRIMARY KEY,
    sourcing_id     BIGINT REFERENCES sourcing_requests(id),
    quote_id        BIGINT REFERENCES sourcing_quotes(id),
    action          VARCHAR(50),  -- created, updated, selected, cancelled
    field_changed   VARCHAR(100),
    old_value       NVARCHAR(MAX),
    new_value       NVARCHAR(MAX),
    changed_by      BIGINT,
    created_at      DATETIME DEFAULT GETDATE()
);

CREATE TABLE market_price_log (
    id              BIGINT IDENTITY(1,1) PRIMARY KEY,
    nsn             VARCHAR(20),
    part_number     VARCHAR(100),
    source_platform VARCHAR(50),  -- ILS, Haystack, PartsBase, NSNCenter
    listed_price    DECIMAL(10,2),
    condition_code  VARCHAR(5),
    quantity_listed INT,
    observed_by     BIGINT,  -- FK to admin_users
    observed_at     DATETIME DEFAULT GETDATE()
);

CREATE INDEX idx_market_price_nsn  ON market_price_log(nsn);
CREATE INDEX idx_market_price_pn   ON market_price_log(part_number);
CREATE INDEX idx_market_price_date ON market_price_log(observed_at);

-- ============================================================
-- SECTION 6: QUOTES
-- ============================================================

CREATE TABLE quotes (
    id              BIGINT IDENTITY(1,1) PRIMARY KEY,
    rfq_id          BIGINT NOT NULL REFERENCES rfq_headers(id),
    customer_id     BIGINT NOT NULL REFERENCES customers(id),
    quote_number    VARCHAR(20) NOT NULL UNIQUE,  -- e.g. QT-2025-00001
    version         INT DEFAULT 1,
    status          VARCHAR(30) DEFAULT 'Draft',
    -- Draft, Sent, Accepted, Rejected, Expired, Revised
    -- Financials
    subtotal        DECIMAL(12,2),
    tax_rate        DECIMAL(5,2) DEFAULT 0,
    tax_amount      DECIMAL(12,2) DEFAULT 0,
    total_amount    DECIMAL(12,2),
    total_cost      DECIMAL(12,2),  -- what it costs us
    total_margin    DECIMAL(12,2),  -- our profit
    -- Dates
    valid_until     DATE,
    sent_at         DATETIME,
    accepted_at     DATETIME,
    rejected_at     DATETIME,
    -- Payment & delivery terms
    payment_terms   VARCHAR(100) DEFAULT 'Credit Card, COD, or Wire Transfer',
    delivery_terms  VARCHAR(255),
    notes           NVARCHAR(MAX),  -- your verbiage / terms
    -- PDF
    pdf_url         VARCHAR(500),   -- Azure Blob Storage URL
    created_by      BIGINT,
    created_at      DATETIME DEFAULT GETDATE(),
    updated_at      DATETIME DEFAULT GETDATE()
);

CREATE INDEX idx_quotes_rfq      ON quotes(rfq_id);
CREATE INDEX idx_quotes_customer ON quotes(customer_id);
CREATE INDEX idx_quotes_status   ON quotes(status);
CREATE INDEX idx_quotes_number   ON quotes(quote_number);

CREATE TABLE quote_lines (
    id              BIGINT IDENTITY(1,1) PRIMARY KEY,
    quote_id        BIGINT NOT NULL REFERENCES quotes(id),
    rfq_line_id     BIGINT REFERENCES rfq_lines(id),
    sourcing_quote_id BIGINT REFERENCES sourcing_quotes(id),
    line_number     INT NOT NULL,
    -- Part info
    nsn             VARCHAR(20),
    part_number     VARCHAR(100),
    item_name       VARCHAR(255),
    condition_code  VARCHAR(5) REFERENCES part_conditions(code),
    quantity        INT NOT NULL,
    unit_of_issue   VARCHAR(10),
    -- Pricing
    unit_cost       DECIMAL(10,2),   -- what we pay supplier
    markup_pct      DECIMAL(5,2),    -- your markup percentage
    unit_price      DECIMAL(10,2),   -- what customer pays
    line_total      DECIMAL(12,2),   -- unit_price * quantity
    line_cost       DECIMAL(12,2),   -- unit_cost * quantity
    line_margin     DECIMAL(12,2),   -- line_total - line_cost
    margin_pct      DECIMAL(5,2),    -- margin as percentage
    -- Delivery
    lead_time_days  INT,
    notes           VARCHAR(500),
    created_at      DATETIME DEFAULT GETDATE()
);

CREATE INDEX idx_quote_lines_quote ON quote_lines(quote_id);

CREATE TABLE quote_revisions (
    id              BIGINT IDENTITY(1,1) PRIMARY KEY,
    quote_id        BIGINT NOT NULL REFERENCES quotes(id),
    version         INT NOT NULL,
    snapshot        NVARCHAR(MAX) NOT NULL,  -- full JSON snapshot of quote at this version
    reason          VARCHAR(255),
    revised_by      BIGINT,
    created_at      DATETIME DEFAULT GETDATE()
);

CREATE TABLE quote_messages (
    id              BIGINT IDENTITY(1,1) PRIMARY KEY,
    quote_id        BIGINT NOT NULL REFERENCES quotes(id),
    sender_type     VARCHAR(10) NOT NULL,  -- customer, admin
    sender_id       BIGINT NOT NULL,
    message         NVARCHAR(MAX) NOT NULL,
    read_at         DATETIME,
    created_at      DATETIME DEFAULT GETDATE()
);

-- ============================================================
-- SECTION 7: ORDERS
-- ============================================================

CREATE TABLE orders (
    id              BIGINT IDENTITY(1,1) PRIMARY KEY,
    quote_id        BIGINT NOT NULL REFERENCES quotes(id),
    rfq_id          BIGINT NOT NULL REFERENCES rfq_headers(id),
    customer_id     BIGINT NOT NULL REFERENCES customers(id),
    order_number    VARCHAR(20) NOT NULL UNIQUE,  -- e.g. ORD-2025-00001
    customer_po     VARCHAR(100),  -- customer's own PO number
    status          VARCHAR(30) DEFAULT 'Confirmed',
    -- Confirmed, Processing, Partially Shipped, Shipped, Delivered, Cancelled
    -- Financials
    subtotal        DECIMAL(12,2),
    tax_amount      DECIMAL(12,2) DEFAULT 0,
    shipping_cost   DECIMAL(10,2) DEFAULT 0,
    total_amount    DECIMAL(12,2),
    -- Addresses
    ship_to_address1 VARCHAR(150),
    ship_to_address2 VARCHAR(150),
    ship_to_city    VARCHAR(100),
    ship_to_state   VARCHAR(50),
    ship_to_zip     VARCHAR(20),
    ship_to_country VARCHAR(50),
    -- Dates
    confirmed_at    DATETIME DEFAULT GETDATE(),
    required_by     DATE,
    updated_at      DATETIME DEFAULT GETDATE(),
    notes           NVARCHAR(MAX),
    created_by      BIGINT   -- FK to admin_users
);

CREATE INDEX idx_orders_customer ON orders(customer_id);
CREATE INDEX idx_orders_status   ON orders(status);
CREATE INDEX idx_orders_number   ON orders(order_number);
CREATE INDEX idx_orders_date     ON orders(confirmed_at);

CREATE TABLE order_lines (
    id              BIGINT IDENTITY(1,1) PRIMARY KEY,
    order_id        BIGINT NOT NULL REFERENCES orders(id),
    quote_line_id   BIGINT REFERENCES quote_lines(id),
    line_number     INT NOT NULL,
    nsn             VARCHAR(20),
    part_number     VARCHAR(100),
    item_name       VARCHAR(255),
    condition_code  VARCHAR(5) REFERENCES part_conditions(code),
    quantity_ordered   INT NOT NULL,
    quantity_received  INT DEFAULT 0,
    quantity_shipped   INT DEFAULT 0,
    unit_price      DECIMAL(10,2),
    line_total      DECIMAL(12,2),
    status          VARCHAR(30) DEFAULT 'Pending',
    -- Pending, PO Issued, Received, Shipped, Delivered, Cancelled
    notes           VARCHAR(500),
    created_at      DATETIME DEFAULT GETDATE()
);

CREATE INDEX idx_order_lines_order ON order_lines(order_id);

CREATE TABLE order_status_log (
    id              BIGINT IDENTITY(1,1) PRIMARY KEY,
    order_id        BIGINT NOT NULL REFERENCES orders(id),
    old_status      VARCHAR(30),
    new_status      VARCHAR(30) NOT NULL,
    changed_by      BIGINT,
    note            VARCHAR(500),
    ip_address      VARCHAR(45),
    created_at      DATETIME DEFAULT GETDATE()
);

CREATE TABLE purchase_orders (
    id              BIGINT IDENTITY(1,1) PRIMARY KEY,
    order_id        BIGINT NOT NULL REFERENCES orders(id),
    supplier_id     BIGINT NOT NULL REFERENCES suppliers(id),
    po_number       VARCHAR(20) NOT NULL UNIQUE,  -- e.g. PO-2025-00001
    status          VARCHAR(30) DEFAULT 'Issued',
    -- Issued, Acknowledged, Shipped, Received, Cancelled
    total_cost      DECIMAL(12,2),
    issued_at       DATETIME DEFAULT GETDATE(),
    acknowledged_at DATETIME,
    expected_ship_date DATE,
    notes           NVARCHAR(MAX),
    created_by      BIGINT
);

CREATE INDEX idx_po_order    ON purchase_orders(order_id);
CREATE INDEX idx_po_supplier ON purchase_orders(supplier_id);
CREATE INDEX idx_po_status   ON purchase_orders(status);
CREATE INDEX idx_po_number   ON purchase_orders(po_number);

CREATE TABLE purchase_order_lines (
    id                  BIGINT IDENTITY(1,1) PRIMARY KEY,
    po_id               BIGINT NOT NULL REFERENCES purchase_orders(id),
    order_line_id       BIGINT REFERENCES order_lines(id),
    sourcing_quote_id   BIGINT REFERENCES sourcing_quotes(id),
    line_number         INT NOT NULL,
    nsn                 VARCHAR(20),
    part_number         VARCHAR(100),
    item_name           VARCHAR(255),
    condition_code      VARCHAR(5) REFERENCES part_conditions(code),
    quantity_ordered    INT NOT NULL,
    quantity_received   INT DEFAULT 0,
    unit_cost           DECIMAL(10,2),
    line_cost           DECIMAL(12,2),
    notes               VARCHAR(500),
    created_at          DATETIME DEFAULT GETDATE()
);

CREATE TABLE receiving_log (
    id                  BIGINT IDENTITY(1,1) PRIMARY KEY,
    po_id               BIGINT NOT NULL REFERENCES purchase_orders(id),
    po_line_id          BIGINT NOT NULL REFERENCES purchase_order_lines(id),
    quantity_received   INT NOT NULL,
    condition_found     VARCHAR(5) REFERENCES part_conditions(code),
    condition_match     BIT,   -- did condition match what was ordered
    docs_received       BIT DEFAULT 0,
    doc_notes           VARCHAR(500),  -- which docs received
    discrepancy_notes   NVARCHAR(MAX),
    received_by         BIGINT,  -- FK to admin_users
    received_at         DATETIME DEFAULT GETDATE()
);

-- Add FK back to supplier_performance
ALTER TABLE supplier_performance
  ADD CONSTRAINT fk_sp_order FOREIGN KEY (order_id) REFERENCES orders(id);

-- ============================================================
-- SECTION 8: SHIPPING
-- ============================================================

CREATE TABLE shipments (
    id                  BIGINT IDENTITY(1,1) PRIMARY KEY,
    order_id            BIGINT NOT NULL REFERENCES orders(id),
    shipment_number     VARCHAR(20) NOT NULL UNIQUE,  -- e.g. SHP-2025-00001
    carrier             VARCHAR(100),  -- FedEx, UPS, DHL, USPS, Freight
    tracking_number     VARCHAR(100),
    tracking_url        VARCHAR(500),
    service_level       VARCHAR(100),  -- Ground, Overnight, 2-Day
    status              VARCHAR(30) DEFAULT 'Pending',
    -- Pending, Picked Up, In Transit, Out for Delivery, Delivered, Exception
    -- Addresses
    ship_from_address   VARCHAR(255),
    ship_to_address     VARCHAR(255),
    -- Financials
    shipping_cost       DECIMAL(10,2),
    -- Dates
    ship_date           DATE,
    estimated_delivery  DATE,
    actual_delivery     DATETIME,
    -- Docs
    packing_slip_url    VARCHAR(500),
    notes               NVARCHAR(MAX),
    created_by          BIGINT,
    created_at          DATETIME DEFAULT GETDATE(),
    updated_at          DATETIME DEFAULT GETDATE()
);

CREATE INDEX idx_shipments_order    ON shipments(order_id);
CREATE INDEX idx_shipments_tracking ON shipments(tracking_number);
CREATE INDEX idx_shipments_status   ON shipments(status);

CREATE TABLE shipment_lines (
    id              BIGINT IDENTITY(1,1) PRIMARY KEY,
    shipment_id     BIGINT NOT NULL REFERENCES shipments(id),
    order_line_id   BIGINT NOT NULL REFERENCES order_lines(id),
    quantity_shipped INT NOT NULL,
    created_at      DATETIME DEFAULT GETDATE()
);

CREATE TABLE shipment_events (
    id              BIGINT IDENTITY(1,1) PRIMARY KEY,
    shipment_id     BIGINT NOT NULL REFERENCES shipments(id),
    event_status    VARCHAR(100),
    event_location  VARCHAR(255),
    event_timestamp DATETIME,
    raw_data        NVARCHAR(MAX),  -- raw JSON from carrier API if integrated later
    created_at      DATETIME DEFAULT GETDATE()
);

CREATE INDEX idx_shipment_events_shipment ON shipment_events(shipment_id);

-- ============================================================
-- SECTION 9: FINANCIALS
-- ============================================================

CREATE TABLE payment_terms (
    id              INT IDENTITY(1,1) PRIMARY KEY,
    name            VARCHAR(50) NOT NULL,  -- Net 30, Net 15, COD, Prepay
    days            INT DEFAULT 0,
    description     VARCHAR(255)
);

INSERT INTO payment_terms (name, days, description) VALUES
('Credit Card',  0,  'Payment by credit card at time of order'),
('COD',          0,  'Cash on delivery'),
('Wire Transfer',0,  'Wire transfer prior to shipment'),
('Net 15',      15,  'Payment due 15 days from invoice date'),
('Net 30',      30,  'Payment due 30 days from invoice date');

CREATE TABLE invoices (
    id              BIGINT IDENTITY(1,1) PRIMARY KEY,
    order_id        BIGINT NOT NULL REFERENCES orders(id),
    customer_id     BIGINT NOT NULL REFERENCES customers(id),
    invoice_number  VARCHAR(20) NOT NULL UNIQUE,  -- e.g. INV-2025-00001
    status          VARCHAR(30) DEFAULT 'Unpaid',
    -- Unpaid, Partially Paid, Paid, Overdue, Voided
    payment_term_id INT REFERENCES payment_terms(id),
    -- Financials
    subtotal        DECIMAL(12,2) NOT NULL,
    tax_rate        DECIMAL(5,2) DEFAULT 0,
    tax_amount      DECIMAL(12,2) DEFAULT 0,
    shipping_amount DECIMAL(10,2) DEFAULT 0,
    total_amount    DECIMAL(12,2) NOT NULL,
    amount_paid     DECIMAL(12,2) DEFAULT 0,
    balance_due     DECIMAL(12,2),
    -- Dates
    issue_date      DATE NOT NULL,
    due_date        DATE NOT NULL,
    paid_date       DATE,
    -- Docs
    pdf_url         VARCHAR(500),
    notes           NVARCHAR(MAX),
    created_by      BIGINT,
    created_at      DATETIME DEFAULT GETDATE(),
    updated_at      DATETIME DEFAULT GETDATE()
);

CREATE INDEX idx_invoices_order    ON invoices(order_id);
CREATE INDEX idx_invoices_customer ON invoices(customer_id);
CREATE INDEX idx_invoices_status   ON invoices(status);
CREATE INDEX idx_invoices_due      ON invoices(due_date);
CREATE INDEX idx_invoices_number   ON invoices(invoice_number);

CREATE TABLE invoice_lines (
    id              BIGINT IDENTITY(1,1) PRIMARY KEY,
    invoice_id      BIGINT NOT NULL REFERENCES invoices(id),
    order_line_id   BIGINT REFERENCES order_lines(id),
    line_number     INT NOT NULL,
    description     VARCHAR(255) NOT NULL,
    nsn             VARCHAR(20),
    part_number     VARCHAR(100),
    condition_code  VARCHAR(5),
    quantity        INT NOT NULL,
    unit_price      DECIMAL(10,2) NOT NULL,
    line_total      DECIMAL(12,2) NOT NULL,
    created_at      DATETIME DEFAULT GETDATE()
);

CREATE TABLE payments (
    id              BIGINT IDENTITY(1,1) PRIMARY KEY,
    invoice_id      BIGINT NOT NULL REFERENCES invoices(id),
    customer_id     BIGINT NOT NULL REFERENCES customers(id),
    amount          DECIMAL(12,2) NOT NULL,
    payment_method  VARCHAR(50),  -- Credit Card, Wire Transfer, COD, Check
    reference_number VARCHAR(100), -- transaction ID, check number, wire ref
    payment_date    DATE NOT NULL,
    notes           VARCHAR(500),
    recorded_by     BIGINT,  -- FK to admin_users
    created_at      DATETIME DEFAULT GETDATE()
);

CREATE INDEX idx_payments_invoice  ON payments(invoice_id);
CREATE INDEX idx_payments_customer ON payments(customer_id);
CREATE INDEX idx_payments_date     ON payments(payment_date);

CREATE TABLE supplier_invoices (
    id              BIGINT IDENTITY(1,1) PRIMARY KEY,
    po_id           BIGINT NOT NULL REFERENCES purchase_orders(id),
    supplier_id     BIGINT NOT NULL REFERENCES suppliers(id),
    invoice_number  VARCHAR(100),  -- supplier's invoice number
    status          VARCHAR(30) DEFAULT 'Unpaid',
    -- Unpaid, Paid, Disputed
    total_amount    DECIMAL(12,2) NOT NULL,
    amount_paid     DECIMAL(12,2) DEFAULT 0,
    issue_date      DATE,
    due_date        DATE,
    pdf_url         VARCHAR(500),
    notes           VARCHAR(500),
    created_at      DATETIME DEFAULT GETDATE()
);

CREATE INDEX idx_supplier_invoices_po       ON supplier_invoices(po_id);
CREATE INDEX idx_supplier_invoices_supplier ON supplier_invoices(supplier_id);
CREATE INDEX idx_supplier_invoices_status   ON supplier_invoices(status);

CREATE TABLE supplier_payments (
    id                  BIGINT IDENTITY(1,1) PRIMARY KEY,
    supplier_invoice_id BIGINT NOT NULL REFERENCES supplier_invoices(id),
    supplier_id         BIGINT NOT NULL REFERENCES suppliers(id),
    amount              DECIMAL(12,2) NOT NULL,
    payment_method      VARCHAR(50),
    reference_number    VARCHAR(100),
    payment_date        DATE NOT NULL,
    notes               VARCHAR(500),
    recorded_by         BIGINT,
    created_at          DATETIME DEFAULT GETDATE()
);

-- ============================================================
-- SECTION 10: DOCUMENTS
-- ============================================================

CREATE TABLE documents (
    id              BIGINT IDENTITY(1,1) PRIMARY KEY,
    -- What this doc is attached to
    entity_type     VARCHAR(50) NOT NULL,
    -- customer, supplier, rfq, quote, order, po, shipment, invoice, sourcing_quote
    entity_id       BIGINT NOT NULL,
    -- Doc info
    doc_type        VARCHAR(50),
    -- CoC, 8130, PO, Invoice, PackingSlip, SupplierCert, CustomerPO, Other
    file_name       VARCHAR(255) NOT NULL,
    file_url        VARCHAR(500) NOT NULL,  -- Azure Blob Storage URL
    file_size_kb    INT,
    mime_type       VARCHAR(100),
    notes           VARCHAR(500),
    uploaded_by     BIGINT,  -- FK to admin_users or customer
    uploaded_by_type VARCHAR(10),  -- admin, customer
    created_at      DATETIME DEFAULT GETDATE()
);

CREATE INDEX idx_documents_entity ON documents(entity_type, entity_id);
CREATE INDEX idx_documents_type   ON documents(doc_type);

-- ============================================================
-- SECTION 11: FOLLOW-UP & ACTIVITY
-- ============================================================

CREATE TABLE follow_up_tasks (
    id              BIGINT IDENTITY(1,1) PRIMARY KEY,
    entity_type     VARCHAR(50),  -- rfq, quote, order, customer
    entity_id       BIGINT NOT NULL,
    task_type       VARCHAR(50),  -- quote_follow_up, payment_chase, delivery_check
    due_date        DATE NOT NULL,
    status          VARCHAR(20) DEFAULT 'Open',  -- Open, Done, Snoozed, Cancelled
    assigned_to     BIGINT,   -- FK to admin_users
    notes           VARCHAR(500),
    completed_at    DATETIME,
    completed_by    BIGINT,
    created_by      BIGINT,
    created_at      DATETIME DEFAULT GETDATE()
);

CREATE INDEX idx_follow_up_due      ON follow_up_tasks(due_date);
CREATE INDEX idx_follow_up_status   ON follow_up_tasks(status);
CREATE INDEX idx_follow_up_assigned ON follow_up_tasks(assigned_to);

CREATE TABLE lost_reasons (
    id          INT IDENTITY(1,1) PRIMARY KEY,
    reason      VARCHAR(100) NOT NULL,
    description VARCHAR(255)
);

INSERT INTO lost_reasons (reason, description) VALUES
('Price',               'Our price was too high'),
('Could Not Source',    'We could not find the part'),
('Lead Time',           'Our lead time was too long'),
('No Response',         'Customer stopped responding'),
('Went Elsewhere',      'Customer found another supplier'),
('Cancelled',           'Customer cancelled the requirement');

ALTER TABLE quotes ADD lost_reason_id INT REFERENCES lost_reasons(id);
ALTER TABLE quotes ADD lost_notes VARCHAR(500);

CREATE TABLE activity_notes (
    id              BIGINT IDENTITY(1,1) PRIMARY KEY,
    entity_type     VARCHAR(50) NOT NULL,
    -- customer, supplier, rfq, quote, order, po, shipment, invoice
    entity_id       BIGINT NOT NULL,
    note            NVARCHAR(MAX) NOT NULL,
    created_by      BIGINT NOT NULL,  -- FK to admin_users
    created_by_name VARCHAR(100),     -- denormalized for display speed
    created_at      DATETIME DEFAULT GETDATE()
);

CREATE INDEX idx_activity_notes_entity ON activity_notes(entity_type, entity_id);
CREATE INDEX idx_activity_notes_date   ON activity_notes(created_at);

CREATE TABLE supplier_lead_time_history (
    id                  BIGINT IDENTITY(1,1) PRIMARY KEY,
    supplier_id         BIGINT NOT NULL REFERENCES suppliers(id),
    po_id               BIGINT REFERENCES purchase_orders(id),
    nsn                 VARCHAR(20),
    part_number         VARCHAR(100),
    estimated_days      INT,
    actual_days         INT,
    on_time             BIT,
    created_at          DATETIME DEFAULT GETDATE()
);

-- ============================================================
-- SECTION 12: INBOUND LEADS (DIBBS / SAM.GOV)
-- ============================================================

CREATE TABLE inbound_solicitations (
    id              BIGINT IDENTITY(1,1) PRIMARY KEY,
    source          VARCHAR(30) NOT NULL,  -- DIBBS, SAM
    source_ref      VARCHAR(100),          -- their solicitation number
    nsn             VARCHAR(20),
    part_number     VARCHAR(100),
    item_name       VARCHAR(255),
    quantity        INT,
    agency          VARCHAR(255),
    due_date        DATE,
    status          VARCHAR(30) DEFAULT 'New',
    -- New, Reviewing, Bidding, Won, Lost, Expired, Skipped
    raw_data        NVARCHAR(MAX),  -- full JSON from their API
    notes           NVARCHAR(MAX),
    assigned_to     BIGINT,
    created_at      DATETIME DEFAULT GETDATE(),
    updated_at      DATETIME DEFAULT GETDATE()
);

CREATE INDEX idx_solicitations_source  ON inbound_solicitations(source);
CREATE INDEX idx_solicitations_status  ON inbound_solicitations(status);
CREATE INDEX idx_solicitations_due     ON inbound_solicitations(due_date);
CREATE INDEX idx_solicitations_nsn     ON inbound_solicitations(nsn);

-- ============================================================
-- SECTION 13: ADMIN & AUDIT
-- ============================================================

CREATE TABLE admin_users (
    id              BIGINT IDENTITY(1,1) PRIMARY KEY,
    first_name      VARCHAR(100) NOT NULL,
    last_name       VARCHAR(100) NOT NULL,
    email           VARCHAR(150) NOT NULL UNIQUE,
    password_hash   VARCHAR(255) NOT NULL,
    role            VARCHAR(30) DEFAULT 'Staff',
    -- Owner, Manager, Staff
    status          VARCHAR(20) DEFAULT 'Active',
    last_login_at   DATETIME,
    created_at      DATETIME DEFAULT GETDATE()
);

-- Seed the owner account (password set via app on first run)
INSERT INTO admin_users (first_name, last_name, email, password_hash, role)
VALUES ('Derek', 'Torchia', 'DTorchia@jupiteroneusa.com', 'SET_ON_FIRST_LOGIN', 'Owner');

CREATE TABLE admin_sessions (
    id              BIGINT IDENTITY(1,1) PRIMARY KEY,
    admin_id        BIGINT NOT NULL REFERENCES admin_users(id),
    session_token   VARCHAR(255) NOT NULL UNIQUE,
    ip_address      VARCHAR(45),
    user_agent      VARCHAR(500),
    created_at      DATETIME DEFAULT GETDATE(),
    expires_at      DATETIME NOT NULL,
    invalidated_at  DATETIME
);

CREATE TABLE admin_audit (
    id              BIGINT IDENTITY(1,1) PRIMARY KEY,
    admin_id        BIGINT REFERENCES admin_users(id),
    action          VARCHAR(100) NOT NULL,
    entity_type     VARCHAR(50),
    entity_id       BIGINT,
    details         NVARCHAR(MAX),
    ip_address      VARCHAR(45),
    created_at      DATETIME DEFAULT GETDATE()
);

CREATE INDEX idx_admin_audit_admin  ON admin_audit(admin_id);
CREATE INDEX idx_admin_audit_entity ON admin_audit(entity_type, entity_id);
CREATE INDEX idx_admin_audit_date   ON admin_audit(created_at);

CREATE TABLE audit_log (
    id              BIGINT IDENTITY(1,1) PRIMARY KEY,
    -- Who
    user_type       VARCHAR(10),   -- admin, customer, system
    user_id         BIGINT,
    user_email      VARCHAR(150),  -- denormalized for audit integrity
    -- What
    action          VARCHAR(50) NOT NULL,
    -- created, updated, deleted, status_changed, logged_in, logged_out, etc
    entity_type     VARCHAR(50),
    entity_id       BIGINT,
    -- Change detail
    field_changed   VARCHAR(100),
    old_value       NVARCHAR(MAX),
    new_value       NVARCHAR(MAX),
    summary         VARCHAR(500),  -- human readable description
    -- Context
    ip_address      VARCHAR(45),
    user_agent      VARCHAR(500),
    created_at      DATETIME DEFAULT GETDATE()
);

CREATE INDEX idx_audit_log_user   ON audit_log(user_type, user_id);
CREATE INDEX idx_audit_log_entity ON audit_log(entity_type, entity_id);
CREATE INDEX idx_audit_log_action ON audit_log(action);
CREATE INDEX idx_audit_log_date   ON audit_log(created_at);

CREATE TABLE email_log (
    id              BIGINT IDENTITY(1,1) PRIMARY KEY,
    -- Who it went to
    to_email        VARCHAR(150) NOT NULL,
    to_name         VARCHAR(150),
    -- What
    subject         VARCHAR(255) NOT NULL,
    email_type      VARCHAR(50),
    -- rfq_received, rfq_notification, quote_sent, order_confirmation,
    -- shipment_notification, invoice, payment_receipt, password_reset
    entity_type     VARCHAR(50),
    entity_id       BIGINT,
    -- Result
    success         BIT NOT NULL,
    error_message   VARCHAR(500),
    -- Metadata
    sent_by         BIGINT,  -- admin user or NULL if system
    created_at      DATETIME DEFAULT GETDATE()
);

CREATE INDEX idx_email_log_to     ON email_log(to_email);
CREATE INDEX idx_email_log_type   ON email_log(email_type);
CREATE INDEX idx_email_log_entity ON email_log(entity_type, entity_id);
CREATE INDEX idx_email_log_date   ON email_log(created_at);

CREATE TABLE system_settings (
    id              INT IDENTITY(1,1) PRIMARY KEY,
    setting_key     VARCHAR(100) NOT NULL UNIQUE,
    setting_value   NVARCHAR(MAX),
    description     VARCHAR(255),
    updated_by      BIGINT,
    updated_at      DATETIME DEFAULT GETDATE()
);

INSERT INTO system_settings (setting_key, setting_value, description) VALUES
('rfq_number_prefix',   'RFQ',  'Prefix for RFQ numbers'),
('quote_number_prefix', 'QT',   'Prefix for quote numbers'),
('order_number_prefix', 'ORD',  'Prefix for order numbers'),
('po_number_prefix',    'PO',   'Prefix for purchase order numbers'),
('invoice_number_prefix','INV', 'Prefix for invoice numbers'),
('shipment_number_prefix','SHP','Prefix for shipment numbers'),
('quote_validity_days', '30',   'Default quote validity in days'),
('rfq_notify_email', 'DTorchia@jupiteroneusa.com', 'Email for RFQ notifications'),
('company_name',     'Jupiter One USA LLC',        'Company name for docs'),
('company_address',  '400 N Tampa St, Suite 1550, Tampa FL', 'Company address'),
('company_phone',    '+1 (347) 821-7412',          'Company phone'),
('company_email',    'DTorchia@jupiteroneusa.com', 'Company email'),
('quote_footer_text','This quotation is valid for 30 days from the date of issue. Prices are subject to availability at time of order confirmation.', 'Quote PDF footer text');

GO

PRINT '============================================================';
PRINT 'Jupiter One USA — Database schema created successfully.';
PRINT '48 tables across 13 sections.';
PRINT '============================================================';
