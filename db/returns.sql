-- Returns / RMA foundation. Run against jupiteroneusa before enabling the admin return workflow.
-- This migration is additive and preserves original orders, invoices, payments, and shipments.

IF OBJECT_ID('dbo.returns', 'U') IS NULL
BEGIN
  CREATE TABLE dbo.returns (
    id BIGINT IDENTITY(1,1) PRIMARY KEY,
    order_id BIGINT NOT NULL REFERENCES orders(id),
    customer_id BIGINT NOT NULL REFERENCES customers(id),
    rma_number VARCHAR(30) NOT NULL UNIQUE,
    status VARCHAR(30) NOT NULL DEFAULT 'Requested',
    reason VARCHAR(100),
    notes NVARCHAR(MAX),
    requested_at DATETIME NOT NULL DEFAULT GETDATE(),
    approved_at DATETIME,
    received_at DATETIME,
    inspected_at DATETIME,
    completed_at DATETIME,
    created_by BIGINT,
    created_at DATETIME NOT NULL DEFAULT GETDATE(),
    updated_at DATETIME NOT NULL DEFAULT GETDATE()
  );
  CREATE INDEX idx_returns_order ON dbo.returns(order_id);
  CREATE INDEX idx_returns_customer ON dbo.returns(customer_id);
  CREATE INDEX idx_returns_status ON dbo.returns(status);
END;
GO

IF OBJECT_ID('dbo.return_lines', 'U') IS NULL
BEGIN
  CREATE TABLE dbo.return_lines (
    id BIGINT IDENTITY(1,1) PRIMARY KEY,
    return_id BIGINT NOT NULL REFERENCES returns(id),
    order_line_id BIGINT NOT NULL REFERENCES order_lines(id),
    shipment_id BIGINT REFERENCES shipments(id),
    quantity_requested INT NOT NULL,
    quantity_received INT NOT NULL DEFAULT 0,
    quantity_approved INT NOT NULL DEFAULT 0,
    unit_price DECIMAL(10,2) NOT NULL DEFAULT 0,
    condition_received VARCHAR(30),
    disposition VARCHAR(30),
    reason VARCHAR(100),
    notes NVARCHAR(MAX),
    created_at DATETIME NOT NULL DEFAULT GETDATE(),
    updated_at DATETIME NOT NULL DEFAULT GETDATE(),
    CONSTRAINT uq_return_line UNIQUE(return_id, order_line_id)
  );
  CREATE INDEX idx_return_lines_return ON dbo.return_lines(return_id);
  CREATE INDEX idx_return_lines_order_line ON dbo.return_lines(order_line_id);
END;
GO

IF OBJECT_ID('dbo.return_events', 'U') IS NULL
BEGIN
  CREATE TABLE dbo.return_events (
    id BIGINT IDENTITY(1,1) PRIMARY KEY,
    return_id BIGINT NOT NULL REFERENCES returns(id),
    old_status VARCHAR(30),
    new_status VARCHAR(30) NOT NULL,
    note NVARCHAR(1000),
    created_by BIGINT,
    created_at DATETIME NOT NULL DEFAULT GETDATE()
  );
  CREATE INDEX idx_return_events_return ON dbo.return_events(return_id);
END;
GO

IF OBJECT_ID('dbo.credit_memos', 'U') IS NULL
BEGIN
  CREATE TABLE dbo.credit_memos (
    id BIGINT IDENTITY(1,1) PRIMARY KEY,
    return_id BIGINT NOT NULL REFERENCES returns(id),
    invoice_id BIGINT REFERENCES invoices(id),
    customer_id BIGINT NOT NULL REFERENCES customers(id),
    memo_number VARCHAR(30) NOT NULL UNIQUE,
    amount DECIMAL(12,2) NOT NULL DEFAULT 0,
    status VARCHAR(30) NOT NULL DEFAULT 'Draft',
    refund_method VARCHAR(30),
    refund_reference VARCHAR(100),
    notes NVARCHAR(MAX),
    issued_at DATETIME,
    processed_at DATETIME,
    created_by BIGINT,
    created_at DATETIME NOT NULL DEFAULT GETDATE(),
    updated_at DATETIME NOT NULL DEFAULT GETDATE()
  );
  CREATE INDEX idx_credit_memos_return ON dbo.credit_memos(return_id);
  CREATE INDEX idx_credit_memos_invoice ON dbo.credit_memos(invoice_id);
END;
GO
