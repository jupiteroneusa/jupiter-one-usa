-- Voiding support for payments (INVOICE_PAYMENT_SYNC_v1).
--
-- The old "generate invoice as Paid in Full" path inserted a synthetic 'Pre-paid'
-- payment even when the real payment was already recorded on the order, so some
-- orders carried the same money twice. Duplicates are retired by voiding rather
-- than deleting, so the audit trail survives. Every sum over payments must filter
-- on voided_at IS NULL.
--
-- Safe to re-run.

IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS
               WHERE TABLE_NAME = 'payments' AND COLUMN_NAME = 'voided_at')
BEGIN
    ALTER TABLE payments ADD voided_at DATETIME NULL;
END
GO

IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS
               WHERE TABLE_NAME = 'payments' AND COLUMN_NAME = 'void_reason')
BEGIN
    ALTER TABLE payments ADD void_reason NVARCHAR(255) NULL;
END
GO
