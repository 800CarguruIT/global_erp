-- 128_company_journey_reset_function.sql
-- Utility for test environments: reset full workshop/accounting journey for one company.

CREATE OR REPLACE FUNCTION admin_reset_company_journey(
  p_company_id uuid,
  p_reset_accounting_settings boolean DEFAULT true
)
RETURNS TABLE (section text, deleted_rows bigint)
LANGUAGE plpgsql
AS $$
DECLARE
  v_count bigint;
BEGIN
  -- Accounting journals and lines for this company
  DELETE FROM accounting_journal_lines jl
  USING accounting_journals j
  WHERE jl.journal_id = j.id
    AND j.company_id = p_company_id;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  section := 'accounting_journal_lines';
  deleted_rows := v_count;
  RETURN NEXT;

  DELETE FROM accounting_journals
  WHERE company_id = p_company_id;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  section := 'accounting_journals';
  deleted_rows := v_count;
  RETURN NEXT;

  -- Procurement / GRN flow
  DELETE FROM purchase_order_items poi
  USING purchase_orders po
  WHERE poi.purchase_order_id = po.id
    AND po.company_id = p_company_id;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  section := 'purchase_order_items';
  deleted_rows := v_count;
  RETURN NEXT;

  DELETE FROM purchase_orders
  WHERE company_id = p_company_id;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  section := 'purchase_orders';
  deleted_rows := v_count;
  RETURN NEXT;

  DELETE FROM inventory_order_request_items iori
  USING inventory_order_requests ior
  WHERE iori.request_id = ior.id
    AND ior.company_id = p_company_id;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  section := 'inventory_order_request_items';
  deleted_rows := v_count;
  RETURN NEXT;

  DELETE FROM inventory_order_requests
  WHERE company_id = p_company_id;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  section := 'inventory_order_requests';
  deleted_rows := v_count;
  RETURN NEXT;

  -- Invoices
  DELETE FROM invoice_items ii
  USING invoices i
  WHERE ii.invoice_id = i.id
    AND i.company_id = p_company_id;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  section := 'invoice_items';
  deleted_rows := v_count;
  RETURN NEXT;

  DELETE FROM invoices
  WHERE company_id = p_company_id;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  section := 'invoices';
  deleted_rows := v_count;
  RETURN NEXT;

  -- Work orders
  DELETE FROM work_order_media wom
  USING work_orders wo
  WHERE wom.work_order_id = wo.id
    AND wo.company_id = p_company_id;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  section := 'work_order_media';
  deleted_rows := v_count;
  RETURN NEXT;

  DELETE FROM work_order_items woi
  USING work_orders wo
  WHERE woi.work_order_id = wo.id
    AND wo.company_id = p_company_id;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  section := 'work_order_items';
  deleted_rows := v_count;
  RETURN NEXT;

  DELETE FROM work_orders
  WHERE company_id = p_company_id;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  section := 'work_orders';
  deleted_rows := v_count;
  RETURN NEXT;

  -- Quotes
  DELETE FROM quote_items qi
  USING quotes q
  WHERE qi.quote_id = q.id
    AND q.company_id = p_company_id;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  section := 'quote_items';
  deleted_rows := v_count;
  RETURN NEXT;

  DELETE FROM quotes
  WHERE company_id = p_company_id;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  section := 'quotes';
  deleted_rows := v_count;
  RETURN NEXT;

  DELETE FROM part_quotes
  WHERE company_id = p_company_id;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  section := 'part_quotes';
  deleted_rows := v_count;
  RETURN NEXT;

  -- Job cards (linked via estimate/lead)
  DELETE FROM job_cards jc
  WHERE jc.estimate_id IN (
      SELECT e.id FROM estimates e WHERE e.company_id = p_company_id
    )
    OR jc.lead_id IN (
      SELECT l.id FROM leads l WHERE l.company_id = p_company_id
    );
  GET DIAGNOSTICS v_count = ROW_COUNT;
  section := 'job_cards';
  deleted_rows := v_count;
  RETURN NEXT;

  -- Inspection flow
  DELETE FROM line_items
  WHERE company_id = p_company_id;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  section := 'line_items';
  deleted_rows := v_count;
  RETURN NEXT;

  DELETE FROM inspections
  WHERE company_id = p_company_id;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  section := 'inspections';
  deleted_rows := v_count;
  RETURN NEXT;

  -- Estimates
  DELETE FROM estimates
  WHERE company_id = p_company_id;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  section := 'estimates';
  deleted_rows := v_count;
  RETURN NEXT;

  -- CRM
  DELETE FROM lead_events
  WHERE company_id = p_company_id;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  section := 'lead_events';
  deleted_rows := v_count;
  RETURN NEXT;

  DELETE FROM leads
  WHERE company_id = p_company_id;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  section := 'leads';
  deleted_rows := v_count;
  RETURN NEXT;

  -- Inventory hard reset
  DELETE FROM inventory_movements
  WHERE company_id = p_company_id;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  section := 'inventory_movements';
  deleted_rows := v_count;
  RETURN NEXT;

  DELETE FROM inventory_stock
  WHERE company_id = p_company_id;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  section := 'inventory_stock';
  deleted_rows := v_count;
  RETURN NEXT;

  DELETE FROM parts_catalog
  WHERE company_id = p_company_id;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  section := 'parts_catalog';
  deleted_rows := v_count;
  RETURN NEXT;

  -- Optional: clear accounting mapping config
  IF p_reset_accounting_settings THEN
    UPDATE accounting_company_settings
    SET
      ar_control_account_id = NULL,
      ap_control_account_id = NULL,
      sales_revenue_account_id = NULL,
      workshop_revenue_account_id = NULL,
      rsa_revenue_account_id = NULL,
      recovery_revenue_account_id = NULL,
      cogs_account_id = NULL,
      labor_cost_account_id = NULL,
      inventory_account_id = NULL,
      wip_account_id = NULL,
      vat_output_account_id = NULL,
      vat_input_account_id = NULL,
      discount_given_account_id = NULL,
      discount_received_account_id = NULL,
      rounding_diff_account_id = NULL,
      cash_account_id = NULL,
      bank_clearing_account_id = NULL,
      updated_at = now()
    WHERE company_id = p_company_id;
    GET DIAGNOSTICS v_count = ROW_COUNT;
    section := 'accounting_company_settings_reset';
    deleted_rows := v_count;
    RETURN NEXT;
  END IF;
END;
$$;

