// trace-sourcing.cjs
// SQL trace: latest order → its lines → their sources → would-be PO contents

const sqls = `
-- ============================================================
-- TRACE: Latest order's sourcing chain
-- ============================================================

PRINT '----- Latest order -----';
DECLARE @oid BIGINT;
SELECT TOP 1 @oid = id FROM orders ORDER BY id DESC;
SELECT id, order_number, status, subtotal, total_amount, quote_id, created_at
FROM orders WHERE id = @oid;

PRINT '----- Order lines for this order -----';
SELECT id, line_number, nsn, part_number, item_name, condition_code,
       quantity_ordered, unit_price, line_total, supplier_id, supplier_cost
FROM order_lines WHERE order_id = @oid ORDER BY line_number;

PRINT '----- Order line sources (what create-PO will read) -----';
SELECT ols.id, ols.order_line_id, ol.line_number AS oline_num,
       ols.supplier_id, s.company_name AS supplier_name,
       ols.allocated_qty, ols.unit_cost, ols.supplier_lead_time_days,
       ols.lead_time_text, ols.supplier_po_line_id,
       CASE WHEN ols.supplier_po_line_id IS NULL THEN 'Pending' ELSE 'PO already exists' END AS status
FROM order_line_sources ols
INNER JOIN order_lines ol ON ol.id = ols.order_line_id
LEFT JOIN suppliers s ON s.id = ols.supplier_id
WHERE ol.order_id = @oid
ORDER BY ols.supplier_id, ol.line_number;

PRINT '----- For comparison: source quote lines -----';
DECLARE @qid BIGINT;
SELECT @qid = quote_id FROM orders WHERE id = @oid;
PRINT 'Source quote id:';
PRINT @qid;

SELECT qls.id, qls.quote_line_id, ql.line_number AS qline_num,
       qls.supplier_id, s.company_name AS supplier_name,
       qls.allocated_qty, qls.unit_cost, qls.supplier_lead_time_days, qls.lead_time_text
FROM quote_line_sources qls
INNER JOIN quote_lines ql ON ql.id = qls.quote_line_id
LEFT JOIN suppliers s ON s.id = qls.supplier_id
WHERE ql.quote_id = @qid
ORDER BY qls.supplier_id, ql.line_number;
`;

console.log(sqls);
