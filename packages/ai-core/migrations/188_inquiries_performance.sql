-- Improve AI inquiries page load performance.

-- 1. Composite index on call_sessions for the LATERAL join (company + provider_call_id)
CREATE INDEX IF NOT EXISTS idx_call_sessions_company_provider_call
  ON call_sessions (company_id, provider_call_id);

-- 2. call_recordings: composite index for session + ordering
CREATE INDEX IF NOT EXISTS idx_call_recordings_session_created
  ON call_recordings (call_session_id, created_at DESC);

-- 3. Inquiries by from_number for grouped queries
CREATE INDEX IF NOT EXISTS idx_call_ai_inquiries_company_from_created
  ON call_ai_inquiries (company_id, from_number, created_at DESC);

-- 4. Expression indexes on customers for fast phone matching (avoids seq scan with regexp_replace)
CREATE INDEX IF NOT EXISTS idx_customers_phone_norm
  ON customers (company_id, ltrim(regexp_replace(COALESCE(phone, ''), '\D', '', 'g'), '0'));

CREATE INDEX IF NOT EXISTS idx_customers_phone_alt_norm
  ON customers (company_id, ltrim(regexp_replace(COALESCE(phone_alt, ''), '\D', '', 'g'), '0'));

CREATE INDEX IF NOT EXISTS idx_customers_whatsapp_phone_norm
  ON customers (company_id, ltrim(regexp_replace(COALESCE(whatsapp_phone, ''), '\D', '', 'g'), '0'));

-- 5. Suffix-based matching: index on right 9 digits
CREATE INDEX IF NOT EXISTS idx_customers_phone_suffix9
  ON customers (company_id, right(ltrim(regexp_replace(COALESCE(phone, ''), '\D', '', 'g'), '0'), 9));

CREATE INDEX IF NOT EXISTS idx_customers_phone_alt_suffix9
  ON customers (company_id, right(ltrim(regexp_replace(COALESCE(phone_alt, ''), '\D', '', 'g'), '0'), 9));

CREATE INDEX IF NOT EXISTS idx_customers_whatsapp_phone_suffix9
  ON customers (company_id, right(ltrim(regexp_replace(COALESCE(whatsapp_phone, ''), '\D', '', 'g'), '0'), 9));
