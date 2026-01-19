--
-- PostgreSQL database dump
--

\restrict fBWCJMOBQreAeRySa5Al3ox8dRFW5KA5yU6eTFEM5S3bwrstnrxuaronlcTzGWk

-- Dumped from database version 16.11 (Debian 16.11-1.pgdg13+1)
-- Dumped by pg_dump version 16.11 (Debian 16.11-1.pgdg13+1)

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: ai_scope_type; Type: TYPE; Schema: public; Owner: autoguru
--

CREATE TYPE public.ai_scope_type AS ENUM (
    'global_all',
    'platform',
    'company'
);


ALTER TYPE public.ai_scope_type OWNER TO autoguru;

--
-- Name: apply_inventory_movement(); Type: FUNCTION; Schema: public; Owner: autoguru
--

CREATE FUNCTION public.apply_inventory_movement() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
DECLARE
  v_existing inventory_stock%ROWTYPE;
BEGIN
  SELECT * INTO v_existing
  FROM inventory_stock
  WHERE company_id = NEW.company_id
    AND part_id = NEW.part_id
    AND location_code = NEW.location_code
  FOR UPDATE;

  IF NOT FOUND THEN
    INSERT INTO inventory_stock (
      company_id,
      part_id,
      location_code,
      on_hand
    ) VALUES (
      NEW.company_id,
      NEW.part_id,
      NEW.location_code,
      CASE WHEN NEW.direction = 'in' THEN NEW.quantity ELSE -NEW.quantity END
    );
  ELSE
    UPDATE inventory_stock
    SET on_hand = v_existing.on_hand +
      CASE WHEN NEW.direction = 'in' THEN NEW.quantity ELSE -NEW.quantity END,
        updated_at = now()
    WHERE id = v_existing.id;
  END IF;

  RETURN NEW;
END;
$$;


ALTER FUNCTION public.apply_inventory_movement() OWNER TO autoguru;

--
-- Name: set_updated_at(); Type: FUNCTION; Schema: public; Owner: autoguru
--

CREATE FUNCTION public.set_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$;


ALTER FUNCTION public.set_updated_at() OWNER TO autoguru;

--
-- Name: touch_accounting_company_settings_updated_at(); Type: FUNCTION; Schema: public; Owner: autoguru
--

CREATE FUNCTION public.touch_accounting_company_settings_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;


ALTER FUNCTION public.touch_accounting_company_settings_updated_at() OWNER TO autoguru;

--
-- Name: touch_estimates_updated_at(); Type: FUNCTION; Schema: public; Owner: autoguru
--

CREATE FUNCTION public.touch_estimates_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;


ALTER FUNCTION public.touch_estimates_updated_at() OWNER TO autoguru;

--
-- Name: touch_fleet_vehicles_updated_at(); Type: FUNCTION; Schema: public; Owner: autoguru
--

CREATE FUNCTION public.touch_fleet_vehicles_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;


ALTER FUNCTION public.touch_fleet_vehicles_updated_at() OWNER TO autoguru;

--
-- Name: touch_gatepasses_updated_at(); Type: FUNCTION; Schema: public; Owner: autoguru
--

CREATE FUNCTION public.touch_gatepasses_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;


ALTER FUNCTION public.touch_gatepasses_updated_at() OWNER TO autoguru;

--
-- Name: touch_inspections_updated_at(); Type: FUNCTION; Schema: public; Owner: autoguru
--

CREATE FUNCTION public.touch_inspections_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;


ALTER FUNCTION public.touch_inspections_updated_at() OWNER TO autoguru;

--
-- Name: touch_invoices_updated_at(); Type: FUNCTION; Schema: public; Owner: autoguru
--

CREATE FUNCTION public.touch_invoices_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;


ALTER FUNCTION public.touch_invoices_updated_at() OWNER TO autoguru;

--
-- Name: touch_purchase_orders_updated_at(); Type: FUNCTION; Schema: public; Owner: autoguru
--

CREATE FUNCTION public.touch_purchase_orders_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;


ALTER FUNCTION public.touch_purchase_orders_updated_at() OWNER TO autoguru;

--
-- Name: touch_quality_checks_updated_at(); Type: FUNCTION; Schema: public; Owner: autoguru
--

CREATE FUNCTION public.touch_quality_checks_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;


ALTER FUNCTION public.touch_quality_checks_updated_at() OWNER TO autoguru;

--
-- Name: touch_quotes_updated_at(); Type: FUNCTION; Schema: public; Owner: autoguru
--

CREATE FUNCTION public.touch_quotes_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;


ALTER FUNCTION public.touch_quotes_updated_at() OWNER TO autoguru;

--
-- Name: touch_work_orders_updated_at(); Type: FUNCTION; Schema: public; Owner: autoguru
--

CREATE FUNCTION public.touch_work_orders_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;


ALTER FUNCTION public.touch_work_orders_updated_at() OWNER TO autoguru;

--
-- Name: touch_workshop_bays_updated_at(); Type: FUNCTION; Schema: public; Owner: autoguru
--

CREATE FUNCTION public.touch_workshop_bays_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;


ALTER FUNCTION public.touch_workshop_bays_updated_at() OWNER TO autoguru;

--
-- Name: trg_touch_inventory_locations_updated_at(); Type: FUNCTION; Schema: public; Owner: autoguru
--

CREATE FUNCTION public.trg_touch_inventory_locations_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$;


ALTER FUNCTION public.trg_touch_inventory_locations_updated_at() OWNER TO autoguru;

SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: accounting_accounts; Type: TABLE; Schema: public; Owner: autoguru
--

CREATE TABLE public.accounting_accounts (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    entity_id uuid NOT NULL,
    standard_id uuid,
    code text NOT NULL,
    name text NOT NULL,
    type text NOT NULL,
    sub_type text,
    normal_balance text NOT NULL,
    parent_id uuid,
    is_leaf boolean DEFAULT true NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.accounting_accounts OWNER TO autoguru;

--
-- Name: accounting_company_settings; Type: TABLE; Schema: public; Owner: autoguru
--

CREATE TABLE public.accounting_company_settings (
    company_id uuid NOT NULL,
    ar_control_account_id uuid,
    ap_control_account_id uuid,
    sales_revenue_account_id uuid,
    workshop_revenue_account_id uuid,
    rsa_revenue_account_id uuid,
    recovery_revenue_account_id uuid,
    cogs_account_id uuid,
    labor_cost_account_id uuid,
    inventory_account_id uuid,
    wip_account_id uuid,
    vat_output_account_id uuid,
    vat_input_account_id uuid,
    discount_given_account_id uuid,
    discount_received_account_id uuid,
    rounding_diff_account_id uuid,
    cash_account_id uuid,
    bank_clearing_account_id uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.accounting_company_settings OWNER TO autoguru;

--
-- Name: accounting_entities; Type: TABLE; Schema: public; Owner: autoguru
--

CREATE TABLE public.accounting_entities (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    scope text NOT NULL,
    company_id uuid,
    name text NOT NULL,
    base_currency text DEFAULT 'USD'::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.accounting_entities OWNER TO autoguru;

--
-- Name: accounting_journal_lines; Type: TABLE; Schema: public; Owner: autoguru
--

CREATE TABLE public.accounting_journal_lines (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    journal_id uuid NOT NULL,
    entity_id uuid NOT NULL,
    line_no integer NOT NULL,
    account_id uuid NOT NULL,
    description text,
    debit numeric(18,4) DEFAULT 0 NOT NULL,
    credit numeric(18,4) DEFAULT 0 NOT NULL,
    company_id uuid,
    branch_id uuid,
    vendor_id uuid,
    employee_id uuid,
    project_id uuid,
    cost_center text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.accounting_journal_lines OWNER TO autoguru;

--
-- Name: accounting_journals; Type: TABLE; Schema: public; Owner: autoguru
--

CREATE TABLE public.accounting_journals (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    entity_id uuid NOT NULL,
    journal_no text NOT NULL,
    journal_type text NOT NULL,
    date date NOT NULL,
    description text,
    reference text,
    currency text NOT NULL,
    created_by_user_id uuid,
    is_posted boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.accounting_journals OWNER TO autoguru;

--
-- Name: accounting_standard_accounts; Type: TABLE; Schema: public; Owner: autoguru
--

CREATE TABLE public.accounting_standard_accounts (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    code text NOT NULL,
    name text NOT NULL,
    type text NOT NULL,
    sub_type text,
    normal_balance text NOT NULL,
    is_leaf boolean DEFAULT true NOT NULL,
    parent_id uuid,
    notes text,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.accounting_standard_accounts OWNER TO autoguru;

--
-- Name: ai_feature_toggles; Type: TABLE; Schema: public; Owner: autoguru
--

CREATE TABLE public.ai_feature_toggles (
    id bigint NOT NULL,
    feature_key text NOT NULL,
    scope_type public.ai_scope_type NOT NULL,
    scope_id text,
    enabled boolean NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.ai_feature_toggles OWNER TO autoguru;

--
-- Name: ai_feature_toggles_id_seq; Type: SEQUENCE; Schema: public; Owner: autoguru
--

CREATE SEQUENCE public.ai_feature_toggles_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.ai_feature_toggles_id_seq OWNER TO autoguru;

--
-- Name: ai_feature_toggles_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: autoguru
--

ALTER SEQUENCE public.ai_feature_toggles_id_seq OWNED BY public.ai_feature_toggles.id;


--
-- Name: ai_global_config; Type: TABLE; Schema: public; Owner: autoguru
--

CREATE TABLE public.ai_global_config (
    id integer NOT NULL,
    master_enabled boolean DEFAULT true NOT NULL,
    ui_languages text[] DEFAULT ARRAY['en'::text] NOT NULL,
    default_ui_language text DEFAULT 'en'::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.ai_global_config OWNER TO autoguru;

--
-- Name: ai_global_config_id_seq; Type: SEQUENCE; Schema: public; Owner: autoguru
--

CREATE SEQUENCE public.ai_global_config_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.ai_global_config_id_seq OWNER TO autoguru;

--
-- Name: ai_global_config_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: autoguru
--

ALTER SEQUENCE public.ai_global_config_id_seq OWNED BY public.ai_global_config.id;


--
-- Name: ai_modules; Type: TABLE; Schema: public; Owner: autoguru
--

CREATE TABLE public.ai_modules (
    id integer NOT NULL,
    key text NOT NULL,
    label text NOT NULL,
    category text NOT NULL,
    description text,
    global_enabled boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.ai_modules OWNER TO autoguru;

--
-- Name: ai_modules_id_seq; Type: SEQUENCE; Schema: public; Owner: autoguru
--

CREATE SEQUENCE public.ai_modules_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.ai_modules_id_seq OWNER TO autoguru;

--
-- Name: ai_modules_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: autoguru
--

ALTER SEQUENCE public.ai_modules_id_seq OWNED BY public.ai_modules.id;


--
-- Name: call_recordings; Type: TABLE; Schema: public; Owner: autoguru
--

CREATE TABLE public.call_recordings (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    call_session_id uuid NOT NULL,
    provider_recording_id text NOT NULL,
    url text NOT NULL,
    duration_seconds integer,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.call_recordings OWNER TO autoguru;

--
-- Name: call_sessions; Type: TABLE; Schema: public; Owner: autoguru
--

CREATE TABLE public.call_sessions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    scope text NOT NULL,
    company_id uuid,
    branch_id uuid,
    created_by_user_id uuid NOT NULL,
    direction text NOT NULL,
    from_number text NOT NULL,
    to_number text NOT NULL,
    to_entity_type text,
    to_entity_id uuid,
    provider_key text NOT NULL,
    provider_call_id text,
    status text NOT NULL,
    started_at timestamp with time zone,
    ended_at timestamp with time zone,
    duration_seconds integer,
    metadata jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.call_sessions OWNER TO autoguru;

--
-- Name: cars; Type: TABLE; Schema: public; Owner: autoguru
--

CREATE TABLE public.cars (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    company_id uuid NOT NULL,
    code text NOT NULL,
    plate_number text NOT NULL,
    vin text,
    make text,
    model text,
    model_year integer,
    color text,
    body_type text,
    mileage numeric(12,2),
    tyre_size_front text,
    tyre_size_back text,
    registration_expiry date,
    registration_card_file_id uuid,
    is_unregistered boolean DEFAULT false NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    notes text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.cars OWNER TO autoguru;

--
-- Name: companies; Type: TABLE; Schema: public; Owner: autoguru
--

CREATE TABLE public.companies (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    code text,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    logo_file_id uuid,
    display_name text,
    legal_name text,
    trade_license_number text,
    trade_license_issue date,
    trade_license_expiry date,
    trade_license_file_id uuid,
    has_vat_tax boolean DEFAULT false NOT NULL,
    has_corporate_tax boolean DEFAULT false NOT NULL,
    vat_number text,
    vat_certificate_file_id uuid,
    corporate_tax_number text,
    corporate_tax_certificate_file_id uuid,
    owner_name text,
    owner_passport_number text,
    owner_passport_issue date,
    owner_passport_expiry date,
    company_domain text,
    company_email text,
    company_phone text,
    address_line1 text,
    address_line2 text,
    city text,
    state_region text,
    postal_code text,
    country text,
    timezone text,
    currency text
);


ALTER TABLE public.companies OWNER TO autoguru;

--
-- Name: company_contacts; Type: TABLE; Schema: public; Owner: autoguru
--

CREATE TABLE public.company_contacts (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    company_id uuid NOT NULL,
    title text,
    name text NOT NULL,
    phone text,
    email text,
    address text,
    sort_order integer DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.company_contacts OWNER TO autoguru;

--
-- Name: company_integrations; Type: TABLE; Schema: public; Owner: autoguru
--

CREATE TABLE public.company_integrations (
    id bigint NOT NULL,
    company_id bigint NOT NULL,
    channel_key text NOT NULL,
    name text NOT NULL,
    provider text NOT NULL,
    is_primary boolean DEFAULT false NOT NULL,
    enabled boolean DEFAULT true NOT NULL,
    settings jsonb DEFAULT '{}'::jsonb NOT NULL,
    metadata jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.company_integrations OWNER TO autoguru;

--
-- Name: company_integrations_id_seq; Type: SEQUENCE; Schema: public; Owner: autoguru
--

CREATE SEQUENCE public.company_integrations_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.company_integrations_id_seq OWNER TO autoguru;

--
-- Name: company_integrations_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: autoguru
--

ALTER SEQUENCE public.company_integrations_id_seq OWNED BY public.company_integrations.id;


--
-- Name: customer_car_links; Type: TABLE; Schema: public; Owner: autoguru
--

CREATE TABLE public.customer_car_links (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    company_id uuid NOT NULL,
    customer_id uuid NOT NULL,
    car_id uuid NOT NULL,
    relation_type text NOT NULL,
    priority integer DEFAULT 1 NOT NULL,
    is_primary boolean DEFAULT false NOT NULL,
    notes text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.customer_car_links OWNER TO autoguru;

--
-- Name: customers; Type: TABLE; Schema: public; Owner: autoguru
--

CREATE TABLE public.customers (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    company_id uuid NOT NULL,
    customer_type text DEFAULT 'individual'::text NOT NULL,
    code text NOT NULL,
    name text NOT NULL,
    first_name text,
    last_name text,
    date_of_birth date,
    national_id text,
    passport_no text,
    legal_name text,
    trade_license_no text,
    tax_number text,
    email text,
    phone text,
    phone_alt text,
    whatsapp_phone text,
    address text,
    notes text,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.customers OWNER TO autoguru;

--
-- Name: employee_allowances; Type: TABLE; Schema: public; Owner: autoguru
--

CREATE TABLE public.employee_allowances (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    employee_id uuid NOT NULL,
    kind text NOT NULL,
    label text,
    amount numeric(14,2) NOT NULL,
    sort_order integer DEFAULT 0 NOT NULL
);


ALTER TABLE public.employee_allowances OWNER TO autoguru;

--
-- Name: employees; Type: TABLE; Schema: public; Owner: autoguru
--

CREATE TABLE public.employees (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    auto_code text NOT NULL,
    scope text NOT NULL,
    company_id uuid,
    branch_id uuid,
    vendor_id uuid,
    first_name text NOT NULL,
    last_name text NOT NULL,
    full_name text NOT NULL,
    temp_address text,
    perm_address text,
    phone_personal text,
    phone_company text,
    email_personal text,
    email_company text,
    doc_id_number text,
    doc_id_issue date,
    doc_id_expiry date,
    doc_passport_number text,
    doc_passport_issue date,
    doc_passport_expiry date,
    doc_id_file_id uuid,
    doc_passport_file_id uuid,
    nationality text,
    title text,
    division text,
    department text,
    start_date date,
    date_of_birth date,
    basic_salary numeric(14,2) DEFAULT 0 NOT NULL,
    pension_amount numeric(14,2) DEFAULT 0 NOT NULL,
    gratuity_amount numeric(14,2) DEFAULT 0 NOT NULL,
    allowance_total numeric(14,2) DEFAULT 0 NOT NULL,
    gov_fee_total numeric(14,2) DEFAULT 0 NOT NULL,
    salary_grand_total numeric(14,2) DEFAULT 0 NOT NULL,
    visa_required boolean DEFAULT false NOT NULL,
    visa_fee numeric(14,2) DEFAULT 0 NOT NULL,
    immigration_fee numeric(14,2) DEFAULT 0 NOT NULL,
    work_permit_fee numeric(14,2) DEFAULT 0 NOT NULL,
    admin_fee numeric(14,2) DEFAULT 0 NOT NULL,
    insurance_fee numeric(14,2) DEFAULT 0 NOT NULL,
    employee_type text DEFAULT 'full_time'::text NOT NULL,
    accommodation_type text DEFAULT 'self'::text NOT NULL,
    transport_type text DEFAULT 'self'::text NOT NULL,
    working_days_per_week integer,
    working_hours_per_day numeric(5,2),
    official_day_off text,
    emergency_name text,
    emergency_phone text,
    emergency_email text,
    emergency_relation text,
    emergency_address text,
    image_file_id uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.employees OWNER TO autoguru;

--
-- Name: estimate_items; Type: TABLE; Schema: public; Owner: autoguru
--

CREATE TABLE public.estimate_items (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    estimate_id uuid NOT NULL,
    inspection_item_id uuid,
    line_no integer NOT NULL,
    part_name text NOT NULL,
    description text,
    type text DEFAULT 'genuine'::text NOT NULL,
    quantity numeric(10,2) DEFAULT 1 NOT NULL,
    cost numeric(14,2) DEFAULT 0 NOT NULL,
    sale numeric(14,2) DEFAULT 0 NOT NULL,
    gp_percent numeric(6,2),
    status text DEFAULT 'pending'::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    is_part boolean DEFAULT true NOT NULL,
    part_number text,
    part_brand text,
    part_sku text,
    procurement_status text DEFAULT 'pending'::text NOT NULL,
    ordered_qty numeric(10,2) DEFAULT 0 NOT NULL,
    received_qty numeric(10,2) DEFAULT 0 NOT NULL,
    issued_qty numeric(10,2) DEFAULT 0 NOT NULL
);


ALTER TABLE public.estimate_items OWNER TO autoguru;

--
-- Name: estimates; Type: TABLE; Schema: public; Owner: autoguru
--

CREATE TABLE public.estimates (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    company_id uuid NOT NULL,
    inspection_id uuid NOT NULL,
    lead_id uuid,
    car_id uuid,
    customer_id uuid,
    status text NOT NULL,
    currency text,
    vat_rate numeric(5,2) DEFAULT 5.00 NOT NULL,
    total_cost numeric(14,2) DEFAULT 0 NOT NULL,
    total_sale numeric(14,2) DEFAULT 0 NOT NULL,
    total_discount numeric(14,2) DEFAULT 0 NOT NULL,
    final_price numeric(14,2) DEFAULT 0 NOT NULL,
    vat_amount numeric(14,2) DEFAULT 0 NOT NULL,
    grand_total numeric(14,2) DEFAULT 0 NOT NULL,
    meta jsonb,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.estimates OWNER TO autoguru;

--
-- Name: fleet_vehicles; Type: TABLE; Schema: public; Owner: autoguru
--

CREATE TABLE public.fleet_vehicles (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    company_id uuid NOT NULL,
    branch_id uuid NOT NULL,
    code text NOT NULL,
    name text NOT NULL,
    vehicle_type text NOT NULL,
    plate_number text,
    make text,
    model text,
    model_year integer,
    capacity_jobs integer DEFAULT 1 NOT NULL,
    status text DEFAULT 'available'::text NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    inventory_location_id uuid,
    notes text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.fleet_vehicles OWNER TO autoguru;

--
-- Name: gatepasses; Type: TABLE; Schema: public; Owner: autoguru
--

CREATE TABLE public.gatepasses (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    company_id uuid NOT NULL,
    lead_id uuid NOT NULL,
    work_order_id uuid NOT NULL,
    invoice_id uuid NOT NULL,
    quality_check_id uuid,
    car_id uuid,
    customer_id uuid,
    handover_type text DEFAULT 'branch'::text NOT NULL,
    status text DEFAULT 'pending'::text NOT NULL,
    invoice_status_snapshot text NOT NULL,
    amount_due numeric(14,2) DEFAULT 0 NOT NULL,
    payment_ok boolean DEFAULT false NOT NULL,
    supervisor_id uuid,
    supervisor_approved_at timestamp with time zone,
    customer_signed boolean DEFAULT false NOT NULL,
    customer_name text,
    customer_id_number text,
    handover_form_ref text,
    customer_signature_ref text,
    final_video_ref text,
    final_note text,
    recovery_lead_id uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.gatepasses OWNER TO autoguru;

--
-- Name: inspection_items; Type: TABLE; Schema: public; Owner: autoguru
--

CREATE TABLE public.inspection_items (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    inspection_id uuid NOT NULL,
    line_no integer NOT NULL,
    category text,
    part_name text NOT NULL,
    severity text,
    required_action text,
    tech_reason text,
    layman_reason text,
    photo_refs jsonb,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.inspection_items OWNER TO autoguru;

--
-- Name: inspection_media; Type: TABLE; Schema: public; Owner: autoguru
--

CREATE TABLE public.inspection_media (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    inspection_id uuid NOT NULL,
    media_type text NOT NULL,
    angle text,
    label text,
    file_ref text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.inspection_media OWNER TO autoguru;

--
-- Name: inspection_versions; Type: TABLE; Schema: public; Owner: autoguru
--

CREATE TABLE public.inspection_versions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    inspection_id uuid NOT NULL,
    version_no integer NOT NULL,
    pdf_file_ref text NOT NULL,
    created_by_user_id uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.inspection_versions OWNER TO autoguru;

--
-- Name: inspections; Type: TABLE; Schema: public; Owner: autoguru
--

CREATE TABLE public.inspections (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    company_id uuid NOT NULL,
    lead_id uuid,
    car_id uuid,
    customer_id uuid,
    inspector_employee_id uuid,
    advisor_employee_id uuid,
    status text DEFAULT 'draft'::text NOT NULL,
    health_engine integer,
    health_transmission integer,
    health_brakes integer,
    health_suspension integer,
    health_electrical integer,
    overall_health integer,
    customer_remark text,
    agent_remark text,
    inspector_remark text,
    inspector_remark_layman text,
    ai_summary_markdown text,
    ai_summary_plain text,
    draft_payload jsonb,
    media_summary jsonb,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.inspections OWNER TO autoguru;

--
-- Name: integration_channels; Type: TABLE; Schema: public; Owner: autoguru
--

CREATE TABLE public.integration_channels (
    key text NOT NULL,
    label text NOT NULL,
    category text NOT NULL,
    description text,
    global_enabled boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.integration_channels OWNER TO autoguru;

--
-- Name: integration_dialer_metadata; Type: TABLE; Schema: public; Owner: autoguru
--

CREATE TABLE public.integration_dialer_metadata (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    dialer_id uuid NOT NULL,
    key text NOT NULL,
    value text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.integration_dialer_metadata OWNER TO autoguru;

--
-- Name: integration_dialer_webhooks; Type: TABLE; Schema: public; Owner: autoguru
--

CREATE TABLE public.integration_dialer_webhooks (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    dialer_id uuid NOT NULL,
    event text NOT NULL,
    url text NOT NULL,
    secret text,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.integration_dialer_webhooks OWNER TO autoguru;

--
-- Name: integration_dialers; Type: TABLE; Schema: public; Owner: autoguru
--

CREATE TABLE public.integration_dialers (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    provider text NOT NULL,
    label text NOT NULL,
    auth_type text NOT NULL,
    credentials jsonb DEFAULT '{}'::jsonb NOT NULL,
    is_global boolean DEFAULT false NOT NULL,
    company_id uuid,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    metadata jsonb DEFAULT '{}'::jsonb NOT NULL,
    webhooks jsonb DEFAULT '{}'::jsonb NOT NULL,
    CONSTRAINT integration_dialers_auth_type_check CHECK ((auth_type = ANY (ARRAY['api_key'::text, 'oauth2'::text, 'sip'::text])))
);


ALTER TABLE public.integration_dialers OWNER TO autoguru;

--
-- Name: integration_events; Type: TABLE; Schema: public; Owner: autoguru
--

CREATE TABLE public.integration_events (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    integration_type text NOT NULL,
    integration_id uuid NOT NULL,
    provider_key text NOT NULL,
    direction text NOT NULL,
    event_type text NOT NULL,
    payload jsonb NOT NULL,
    status text NOT NULL,
    error text,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.integration_events OWNER TO autoguru;

--
-- Name: integration_health; Type: TABLE; Schema: public; Owner: autoguru
--

CREATE TABLE public.integration_health (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    integration_type text NOT NULL,
    integration_id uuid NOT NULL,
    provider_key text NOT NULL,
    status text NOT NULL,
    last_checked_at timestamp with time zone DEFAULT now() NOT NULL,
    last_error text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.integration_health OWNER TO autoguru;

--
-- Name: inventory_locations; Type: TABLE; Schema: public; Owner: autoguru
--

CREATE TABLE public.inventory_locations (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    company_id uuid NOT NULL,
    code text NOT NULL,
    name text NOT NULL,
    location_type text NOT NULL,
    branch_id uuid,
    fleet_vehicle_id uuid,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.inventory_locations OWNER TO autoguru;

--
-- Name: inventory_movements; Type: TABLE; Schema: public; Owner: autoguru
--

CREATE TABLE public.inventory_movements (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    company_id uuid NOT NULL,
    part_id uuid NOT NULL,
    location_code text DEFAULT 'MAIN'::text NOT NULL,
    direction text NOT NULL,
    quantity numeric(14,2) NOT NULL,
    source_type text NOT NULL,
    source_id uuid,
    grn_number text,
    note text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    purchase_order_id uuid
);


ALTER TABLE public.inventory_movements OWNER TO autoguru;

--
-- Name: inventory_stock; Type: TABLE; Schema: public; Owner: autoguru
--

CREATE TABLE public.inventory_stock (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    company_id uuid NOT NULL,
    part_id uuid NOT NULL,
    location_code text DEFAULT 'MAIN'::text NOT NULL,
    on_hand numeric(14,2) DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.inventory_stock OWNER TO autoguru;

--
-- Name: invoice_items; Type: TABLE; Schema: public; Owner: autoguru
--

CREATE TABLE public.invoice_items (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    invoice_id uuid NOT NULL,
    work_order_item_id uuid,
    estimate_item_id uuid,
    line_no integer NOT NULL,
    name text NOT NULL,
    description text,
    quantity numeric(10,2) DEFAULT 1 NOT NULL,
    rate numeric(14,2) DEFAULT 0 NOT NULL,
    line_sale numeric(14,2) DEFAULT 0 NOT NULL,
    line_discount numeric(14,2) DEFAULT 0 NOT NULL,
    line_final numeric(14,2) DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.invoice_items OWNER TO autoguru;

--
-- Name: invoices; Type: TABLE; Schema: public; Owner: autoguru
--

CREATE TABLE public.invoices (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    company_id uuid NOT NULL,
    work_order_id uuid NOT NULL,
    estimate_id uuid,
    quality_check_id uuid,
    inspection_id uuid,
    lead_id uuid,
    car_id uuid,
    customer_id uuid,
    invoice_number text NOT NULL,
    invoice_date date DEFAULT CURRENT_DATE NOT NULL,
    status text DEFAULT 'draft'::text NOT NULL,
    payment_method text,
    due_date date,
    paid_at timestamp with time zone,
    total_sale numeric(14,2) DEFAULT 0 NOT NULL,
    total_discount numeric(14,2) DEFAULT 0 NOT NULL,
    final_amount numeric(14,2) DEFAULT 0 NOT NULL,
    vat_rate numeric(5,2) DEFAULT 5.00 NOT NULL,
    vat_amount numeric(14,2) DEFAULT 0 NOT NULL,
    grand_total numeric(14,2) DEFAULT 0 NOT NULL,
    terms text,
    notes text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.invoices OWNER TO autoguru;

--
-- Name: lead_events; Type: TABLE; Schema: public; Owner: autoguru
--

CREATE TABLE public.lead_events (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    lead_id uuid NOT NULL,
    company_id uuid NOT NULL,
    actor_user_id uuid,
    actor_employee_id uuid,
    event_type text NOT NULL,
    event_payload jsonb,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.lead_events OWNER TO autoguru;

--
-- Name: leads; Type: TABLE; Schema: public; Owner: autoguru
--

CREATE TABLE public.leads (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    company_id uuid NOT NULL,
    customer_id uuid,
    car_id uuid,
    agent_employee_id uuid,
    lead_type text NOT NULL,
    lead_status text NOT NULL,
    lead_stage text NOT NULL,
    source text,
    sla_minutes integer,
    first_response_at timestamp with time zone,
    last_activity_at timestamp with time zone,
    closed_at timestamp with time zone,
    health_score integer,
    sentiment_score integer,
    customer_feedback text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    agent_remark text,
    customer_remark text,
    is_locked boolean DEFAULT false NOT NULL,
    CONSTRAINT leads_lead_status_check CHECK ((lead_status = ANY (ARRAY['open'::text, 'processing'::text, 'closed_won'::text, 'lost'::text]))),
    CONSTRAINT leads_lead_type_check CHECK ((lead_type = ANY (ARRAY['rsa'::text, 'recovery'::text, 'workshop'::text])))
);


ALTER TABLE public.leads OWNER TO autoguru;

--
-- Name: parts_catalog; Type: TABLE; Schema: public; Owner: autoguru
--

CREATE TABLE public.parts_catalog (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    company_id uuid NOT NULL,
    part_number text NOT NULL,
    brand text NOT NULL,
    sku text NOT NULL,
    description text,
    qr_code text,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.parts_catalog OWNER TO autoguru;

--
-- Name: permissions; Type: TABLE; Schema: public; Owner: autoguru
--

CREATE TABLE public.permissions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    key text NOT NULL,
    description text NOT NULL
);


ALTER TABLE public.permissions OWNER TO autoguru;

--
-- Name: purchase_order_items; Type: TABLE; Schema: public; Owner: autoguru
--

CREATE TABLE public.purchase_order_items (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    purchase_order_id uuid NOT NULL,
    line_no integer NOT NULL,
    estimate_item_id uuid,
    parts_catalog_id uuid,
    name text NOT NULL,
    description text,
    quantity numeric(10,2) DEFAULT 1 NOT NULL,
    unit_cost numeric(14,2) DEFAULT 0 NOT NULL,
    total_cost numeric(14,2) DEFAULT 0 NOT NULL,
    received_qty numeric(10,2) DEFAULT 0 NOT NULL,
    status text DEFAULT 'pending'::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.purchase_order_items OWNER TO autoguru;

--
-- Name: purchase_orders; Type: TABLE; Schema: public; Owner: autoguru
--

CREATE TABLE public.purchase_orders (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    company_id uuid NOT NULL,
    vendor_id uuid,
    vendor_name text,
    vendor_contact text,
    po_number text NOT NULL,
    po_type text DEFAULT 'po'::text NOT NULL,
    source_type text DEFAULT 'manual'::text NOT NULL,
    quote_id uuid,
    status text DEFAULT 'draft'::text NOT NULL,
    currency text,
    expected_date date,
    notes text,
    total_cost numeric(14,2) DEFAULT 0 NOT NULL,
    created_by uuid,
    approved_by uuid,
    approved_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.purchase_orders OWNER TO autoguru;

--
-- Name: quality_check_items; Type: TABLE; Schema: public; Owner: autoguru
--

CREATE TABLE public.quality_check_items (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    quality_check_id uuid NOT NULL,
    work_order_item_id uuid NOT NULL,
    line_no integer NOT NULL,
    qc_status text DEFAULT 'pending'::text NOT NULL,
    qc_note text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.quality_check_items OWNER TO autoguru;

--
-- Name: quality_checks; Type: TABLE; Schema: public; Owner: autoguru
--

CREATE TABLE public.quality_checks (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    company_id uuid NOT NULL,
    work_order_id uuid NOT NULL,
    estimate_id uuid,
    inspection_id uuid,
    lead_id uuid,
    car_id uuid,
    customer_id uuid,
    status text DEFAULT 'queue'::text NOT NULL,
    test_drive_done boolean DEFAULT false NOT NULL,
    wash_done boolean DEFAULT false NOT NULL,
    qc_remarks text,
    qc_video_ref text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.quality_checks OWNER TO autoguru;

--
-- Name: quote_items; Type: TABLE; Schema: public; Owner: autoguru
--

CREATE TABLE public.quote_items (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    quote_id uuid NOT NULL,
    line_no integer NOT NULL,
    estimate_item_id uuid,
    work_order_item_id uuid,
    name text NOT NULL,
    description text,
    quantity numeric(10,2) DEFAULT 1 NOT NULL,
    unit_price numeric(14,2) DEFAULT 0 NOT NULL,
    total_price numeric(14,2) DEFAULT 0 NOT NULL,
    part_number text,
    brand text,
    part_type text,
    eta_days integer,
    labor_hours numeric(10,2),
    labor_rate numeric(14,2),
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.quote_items OWNER TO autoguru;

--
-- Name: quotes; Type: TABLE; Schema: public; Owner: autoguru
--

CREATE TABLE public.quotes (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    company_id uuid NOT NULL,
    quote_type text NOT NULL,
    status text DEFAULT 'draft'::text NOT NULL,
    estimate_id uuid,
    work_order_id uuid,
    vendor_id uuid,
    branch_id uuid,
    currency text,
    total_amount numeric(14,2) DEFAULT 0 NOT NULL,
    valid_until date,
    created_by uuid,
    approved_by uuid,
    approved_at timestamp with time zone,
    meta jsonb,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.quotes OWNER TO autoguru;

--
-- Name: role_permissions; Type: TABLE; Schema: public; Owner: autoguru
--

CREATE TABLE public.role_permissions (
    role_id uuid NOT NULL,
    permission_id uuid NOT NULL
);


ALTER TABLE public.role_permissions OWNER TO autoguru;

--
-- Name: roles; Type: TABLE; Schema: public; Owner: autoguru
--

CREATE TABLE public.roles (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    key text NOT NULL,
    scope text NOT NULL,
    company_id uuid,
    branch_id uuid,
    vendor_id uuid,
    description text,
    is_system boolean DEFAULT false NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.roles OWNER TO autoguru;

--
-- Name: user_activity_logs; Type: TABLE; Schema: public; Owner: autoguru
--

CREATE TABLE public.user_activity_logs (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    session_id uuid,
    scope text NOT NULL,
    company_id uuid,
    branch_id uuid,
    vendor_id uuid,
    "timestamp" timestamp with time zone DEFAULT now() NOT NULL,
    ip_address text,
    action_key text NOT NULL,
    entity_type text,
    entity_id uuid,
    summary text,
    metadata jsonb DEFAULT '{}'::jsonb NOT NULL
);


ALTER TABLE public.user_activity_logs OWNER TO autoguru;

--
-- Name: user_change_history; Type: TABLE; Schema: public; Owner: autoguru
--

CREATE TABLE public.user_change_history (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid,
    session_id uuid,
    scope text NOT NULL,
    company_id uuid,
    branch_id uuid,
    vendor_id uuid,
    entity_type text NOT NULL,
    entity_id uuid NOT NULL,
    change_timestamp timestamp with time zone DEFAULT now() NOT NULL,
    change_type text NOT NULL,
    change_summary text,
    before_data jsonb,
    after_data jsonb
);


ALTER TABLE public.user_change_history OWNER TO autoguru;

--
-- Name: user_risk_profiles; Type: TABLE; Schema: public; Owner: autoguru
--

CREATE TABLE public.user_risk_profiles (
    user_id uuid NOT NULL,
    overall_risk_score numeric(5,2) DEFAULT 0 NOT NULL,
    risk_level text DEFAULT 'low'::text NOT NULL,
    last_evaluated_at timestamp with time zone DEFAULT now() NOT NULL,
    has_global_admin_role boolean DEFAULT false NOT NULL,
    high_privilege_role_count integer DEFAULT 0 NOT NULL,
    total_active_sessions integer DEFAULT 0 NOT NULL,
    last_login_at timestamp with time zone,
    last_login_ip text,
    last_login_country text,
    last_failed_login_at timestamp with time zone,
    unusual_location boolean DEFAULT false NOT NULL,
    notes text
);


ALTER TABLE public.user_risk_profiles OWNER TO autoguru;

--
-- Name: user_roles; Type: TABLE; Schema: public; Owner: autoguru
--

CREATE TABLE public.user_roles (
    user_id uuid NOT NULL,
    role_id uuid NOT NULL
);


ALTER TABLE public.user_roles OWNER TO autoguru;

--
-- Name: user_sessions; Type: TABLE; Schema: public; Owner: autoguru
--

CREATE TABLE public.user_sessions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    scope text NOT NULL,
    company_id uuid,
    branch_id uuid,
    vendor_id uuid,
    started_at timestamp with time zone DEFAULT now() NOT NULL,
    last_seen_at timestamp with time zone DEFAULT now() NOT NULL,
    ip_address text,
    user_agent text,
    device_fingerprint text,
    geo_country text,
    geo_city text,
    is_active boolean DEFAULT true NOT NULL,
    last_action text,
    last_action_at timestamp with time zone
);


ALTER TABLE public.user_sessions OWNER TO autoguru;

--
-- Name: users; Type: TABLE; Schema: public; Owner: autoguru
--

CREATE TABLE public.users (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    email text,
    password_hash text,
    full_name text,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    employee_id uuid
);


ALTER TABLE public.users OWNER TO autoguru;

--
-- Name: vendor_bank_accounts; Type: TABLE; Schema: public; Owner: autoguru
--

CREATE TABLE public.vendor_bank_accounts (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    vendor_id uuid NOT NULL,
    bank_name text,
    branch_name text,
    account_name text,
    account_number text,
    iban text,
    swift text,
    currency text,
    is_default boolean DEFAULT false NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.vendor_bank_accounts OWNER TO autoguru;

--
-- Name: vendor_contacts; Type: TABLE; Schema: public; Owner: autoguru
--

CREATE TABLE public.vendor_contacts (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    vendor_id uuid NOT NULL,
    name text NOT NULL,
    phone text,
    email text,
    address text,
    sort_order integer DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.vendor_contacts OWNER TO autoguru;

--
-- Name: vendors; Type: TABLE; Schema: public; Owner: autoguru
--

CREATE TABLE public.vendors (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    company_id uuid NOT NULL,
    code text NOT NULL,
    name text NOT NULL,
    legal_name text,
    phone text,
    email text,
    address_line1 text,
    address_line2 text,
    city text,
    state_region text,
    postal_code text,
    country text,
    trade_license_number text,
    trade_license_issue date,
    trade_license_expiry date,
    trade_license_file_id uuid,
    tax_number text,
    tax_certificate_file_id uuid,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.vendors OWNER TO autoguru;

--
-- Name: work_order_items; Type: TABLE; Schema: public; Owner: autoguru
--

CREATE TABLE public.work_order_items (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    work_order_id uuid NOT NULL,
    estimate_item_id uuid NOT NULL,
    line_no integer NOT NULL,
    part_name text NOT NULL,
    description text,
    is_part boolean DEFAULT true NOT NULL,
    is_labor boolean DEFAULT false NOT NULL,
    required_qty numeric(10,2) DEFAULT 1 NOT NULL,
    issued_qty numeric(10,2) DEFAULT 0 NOT NULL,
    work_status text DEFAULT 'pending'::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.work_order_items OWNER TO autoguru;

--
-- Name: work_order_media; Type: TABLE; Schema: public; Owner: autoguru
--

CREATE TABLE public.work_order_media (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    work_order_id uuid NOT NULL,
    work_order_item_id uuid,
    kind text NOT NULL,
    file_ref text NOT NULL,
    note text,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.work_order_media OWNER TO autoguru;

--
-- Name: work_orders; Type: TABLE; Schema: public; Owner: autoguru
--

CREATE TABLE public.work_orders (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    company_id uuid NOT NULL,
    estimate_id uuid NOT NULL,
    inspection_id uuid,
    lead_id uuid,
    car_id uuid,
    customer_id uuid,
    branch_id uuid,
    status text DEFAULT 'draft'::text NOT NULL,
    queue_reason text,
    work_started_at timestamp with time zone,
    work_completed_at timestamp with time zone,
    meta jsonb,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    labor_cost numeric(14,2) DEFAULT 0 NOT NULL
);


ALTER TABLE public.work_orders OWNER TO autoguru;

--
-- Name: workshop_bays; Type: TABLE; Schema: public; Owner: autoguru
--

CREATE TABLE public.workshop_bays (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    company_id uuid NOT NULL,
    branch_id uuid NOT NULL,
    code text NOT NULL,
    name text NOT NULL,
    bay_type text DEFAULT 'mechanical'::text NOT NULL,
    capacity_cars integer DEFAULT 1 NOT NULL,
    status text DEFAULT 'available'::text NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    notes text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.workshop_bays OWNER TO autoguru;

--
-- Name: ai_feature_toggles id; Type: DEFAULT; Schema: public; Owner: autoguru
--

ALTER TABLE ONLY public.ai_feature_toggles ALTER COLUMN id SET DEFAULT nextval('public.ai_feature_toggles_id_seq'::regclass);


--
-- Name: ai_global_config id; Type: DEFAULT; Schema: public; Owner: autoguru
--

ALTER TABLE ONLY public.ai_global_config ALTER COLUMN id SET DEFAULT nextval('public.ai_global_config_id_seq'::regclass);


--
-- Name: ai_modules id; Type: DEFAULT; Schema: public; Owner: autoguru
--

ALTER TABLE ONLY public.ai_modules ALTER COLUMN id SET DEFAULT nextval('public.ai_modules_id_seq'::regclass);


--
-- Name: company_integrations id; Type: DEFAULT; Schema: public; Owner: autoguru
--

ALTER TABLE ONLY public.company_integrations ALTER COLUMN id SET DEFAULT nextval('public.company_integrations_id_seq'::regclass);


--
-- Data for Name: accounting_accounts; Type: TABLE DATA; Schema: public; Owner: autoguru
--

COPY public.accounting_accounts (id, entity_id, standard_id, code, name, type, sub_type, normal_balance, parent_id, is_leaf, is_active, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: accounting_company_settings; Type: TABLE DATA; Schema: public; Owner: autoguru
--

COPY public.accounting_company_settings (company_id, ar_control_account_id, ap_control_account_id, sales_revenue_account_id, workshop_revenue_account_id, rsa_revenue_account_id, recovery_revenue_account_id, cogs_account_id, labor_cost_account_id, inventory_account_id, wip_account_id, vat_output_account_id, vat_input_account_id, discount_given_account_id, discount_received_account_id, rounding_diff_account_id, cash_account_id, bank_clearing_account_id, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: accounting_entities; Type: TABLE DATA; Schema: public; Owner: autoguru
--

COPY public.accounting_entities (id, scope, company_id, name, base_currency, created_at, updated_at) FROM stdin;
4a0f9314-8eff-4746-abab-d9011e62f2d4	global	\N	Global Books	USD	2025-12-04 21:29:10.350501+00	2025-12-04 21:29:10.350501+00
cc638eb3-30a0-4cc3-9761-dd341326f050	global	\N	Global Books	USD	2025-12-05 14:09:40.145615+00	2025-12-05 14:09:40.145615+00
955d6e24-d8df-4f90-96a7-15ab5d462d42	global	\N	Global Books	USD	2025-12-05 22:38:53.42555+00	2025-12-05 22:38:53.42555+00
8cad68f7-7ab4-49d4-84ff-67b65960c13e	global	\N	Global Books	USD	2025-12-06 15:19:42.822586+00	2025-12-06 15:19:42.822586+00
0bf45a1d-cb70-40f4-b5cc-ad8af67ccf5d	global	\N	Global Books	USD	2025-12-06 15:28:57.99969+00	2025-12-06 15:28:57.99969+00
\.


--
-- Data for Name: accounting_journal_lines; Type: TABLE DATA; Schema: public; Owner: autoguru
--

COPY public.accounting_journal_lines (id, journal_id, entity_id, line_no, account_id, description, debit, credit, company_id, branch_id, vendor_id, employee_id, project_id, cost_center, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: accounting_journals; Type: TABLE DATA; Schema: public; Owner: autoguru
--

COPY public.accounting_journals (id, entity_id, journal_no, journal_type, date, description, reference, currency, created_by_user_id, is_posted, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: accounting_standard_accounts; Type: TABLE DATA; Schema: public; Owner: autoguru
--

COPY public.accounting_standard_accounts (id, code, name, type, sub_type, normal_balance, is_leaf, parent_id, notes, is_active, created_at, updated_at) FROM stdin;
a0d2d244-5102-485d-9f16-eef6e40f7fe8	1000	Cash	asset	cash	debit	t	\N	\N	t	2025-12-04 21:29:10.351339+00	2025-12-04 21:29:10.351339+00
be170afe-2484-46dd-8392-2f7941b9ee6c	1100	Bank	asset	bank	debit	t	\N	\N	t	2025-12-04 21:29:10.351339+00	2025-12-04 21:29:10.351339+00
020c6a88-d1a6-478d-ab0a-767493a78656	1200	Accounts Receivable	asset	current_asset	debit	t	\N	\N	t	2025-12-04 21:29:10.351339+00	2025-12-04 21:29:10.351339+00
24669c4d-c6ec-46cb-91ed-0c533d4feda3	2000	Accounts Payable	liability	current_liability	credit	t	\N	\N	t	2025-12-04 21:29:10.351339+00	2025-12-04 21:29:10.351339+00
2f3323c4-7244-46ab-8510-de4731a389ab	3000	Equity	equity	equity	credit	t	\N	\N	t	2025-12-04 21:29:10.351339+00	2025-12-04 21:29:10.351339+00
d570a857-d2fa-44e7-9639-1cdbdbbe6181	4000	Sales Revenue	income	sales	credit	t	\N	\N	t	2025-12-04 21:29:10.351339+00	2025-12-04 21:29:10.351339+00
02ec7a6e-9a7c-49a4-b4fc-f89aae6830bd	5000	Cost of Goods Sold	expense	cogs	debit	t	\N	\N	t	2025-12-04 21:29:10.351339+00	2025-12-04 21:29:10.351339+00
9dafd76f-cfc0-4cab-81b4-ee3255f52e07	6000	Operating Expenses	expense	opex	debit	t	\N	\N	t	2025-12-04 21:29:10.351339+00	2025-12-04 21:29:10.351339+00
\.


--
-- Data for Name: ai_feature_toggles; Type: TABLE DATA; Schema: public; Owner: autoguru
--

COPY public.ai_feature_toggles (id, feature_key, scope_type, scope_id, enabled, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: ai_global_config; Type: TABLE DATA; Schema: public; Owner: autoguru
--

COPY public.ai_global_config (id, master_enabled, ui_languages, default_ui_language, created_at, updated_at) FROM stdin;
1	t	{en}	en	2025-12-04 08:34:26.579111+00	2025-12-04 09:11:33.858808+00
\.


--
-- Data for Name: ai_modules; Type: TABLE DATA; Schema: public; Owner: autoguru
--

COPY public.ai_modules (id, key, label, category, description, global_enabled, created_at, updated_at) FROM stdin;
1	ai.i18n	AI Translation	i18n	Translation & localization tools	t	2025-12-04 08:34:26.579967+00	2025-12-04 09:11:33.858808+00
\.


--
-- Data for Name: call_recordings; Type: TABLE DATA; Schema: public; Owner: autoguru
--

COPY public.call_recordings (id, call_session_id, provider_recording_id, url, duration_seconds, created_at) FROM stdin;
\.


--
-- Data for Name: call_sessions; Type: TABLE DATA; Schema: public; Owner: autoguru
--

COPY public.call_sessions (id, scope, company_id, branch_id, created_by_user_id, direction, from_number, to_number, to_entity_type, to_entity_id, provider_key, provider_call_id, status, started_at, ended_at, duration_seconds, metadata, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: cars; Type: TABLE DATA; Schema: public; Owner: autoguru
--

COPY public.cars (id, company_id, code, plate_number, vin, make, model, model_year, color, body_type, mileage, tyre_size_front, tyre_size_back, registration_expiry, registration_card_file_id, is_unregistered, is_active, notes, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: companies; Type: TABLE DATA; Schema: public; Owner: autoguru
--

COPY public.companies (id, name, code, is_active, created_at, updated_at, logo_file_id, display_name, legal_name, trade_license_number, trade_license_issue, trade_license_expiry, trade_license_file_id, has_vat_tax, has_corporate_tax, vat_number, vat_certificate_file_id, corporate_tax_number, corporate_tax_certificate_file_id, owner_name, owner_passport_number, owner_passport_issue, owner_passport_expiry, company_domain, company_email, company_phone, address_line1, address_line2, city, state_region, postal_code, country, timezone, currency) FROM stdin;
\.


--
-- Data for Name: company_contacts; Type: TABLE DATA; Schema: public; Owner: autoguru
--

COPY public.company_contacts (id, company_id, title, name, phone, email, address, sort_order, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: company_integrations; Type: TABLE DATA; Schema: public; Owner: autoguru
--

COPY public.company_integrations (id, company_id, channel_key, name, provider, is_primary, enabled, settings, metadata, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: customer_car_links; Type: TABLE DATA; Schema: public; Owner: autoguru
--

COPY public.customer_car_links (id, company_id, customer_id, car_id, relation_type, priority, is_primary, notes, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: customers; Type: TABLE DATA; Schema: public; Owner: autoguru
--

COPY public.customers (id, company_id, customer_type, code, name, first_name, last_name, date_of_birth, national_id, passport_no, legal_name, trade_license_no, tax_number, email, phone, phone_alt, whatsapp_phone, address, notes, is_active, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: employee_allowances; Type: TABLE DATA; Schema: public; Owner: autoguru
--

COPY public.employee_allowances (id, employee_id, kind, label, amount, sort_order) FROM stdin;
\.


--
-- Data for Name: employees; Type: TABLE DATA; Schema: public; Owner: autoguru
--

COPY public.employees (id, auto_code, scope, company_id, branch_id, vendor_id, first_name, last_name, full_name, temp_address, perm_address, phone_personal, phone_company, email_personal, email_company, doc_id_number, doc_id_issue, doc_id_expiry, doc_passport_number, doc_passport_issue, doc_passport_expiry, doc_id_file_id, doc_passport_file_id, nationality, title, division, department, start_date, date_of_birth, basic_salary, pension_amount, gratuity_amount, allowance_total, gov_fee_total, salary_grand_total, visa_required, visa_fee, immigration_fee, work_permit_fee, admin_fee, insurance_fee, employee_type, accommodation_type, transport_type, working_days_per_week, working_hours_per_day, official_day_off, emergency_name, emergency_phone, emergency_email, emergency_relation, emergency_address, image_file_id, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: estimate_items; Type: TABLE DATA; Schema: public; Owner: autoguru
--

COPY public.estimate_items (id, estimate_id, inspection_item_id, line_no, part_name, description, type, quantity, cost, sale, gp_percent, status, created_at, updated_at, is_part, part_number, part_brand, part_sku, procurement_status, ordered_qty, received_qty, issued_qty) FROM stdin;
\.


--
-- Data for Name: estimates; Type: TABLE DATA; Schema: public; Owner: autoguru
--

COPY public.estimates (id, company_id, inspection_id, lead_id, car_id, customer_id, status, currency, vat_rate, total_cost, total_sale, total_discount, final_price, vat_amount, grand_total, meta, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: fleet_vehicles; Type: TABLE DATA; Schema: public; Owner: autoguru
--

COPY public.fleet_vehicles (id, company_id, branch_id, code, name, vehicle_type, plate_number, make, model, model_year, capacity_jobs, status, is_active, inventory_location_id, notes, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: gatepasses; Type: TABLE DATA; Schema: public; Owner: autoguru
--

COPY public.gatepasses (id, company_id, lead_id, work_order_id, invoice_id, quality_check_id, car_id, customer_id, handover_type, status, invoice_status_snapshot, amount_due, payment_ok, supervisor_id, supervisor_approved_at, customer_signed, customer_name, customer_id_number, handover_form_ref, customer_signature_ref, final_video_ref, final_note, recovery_lead_id, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: inspection_items; Type: TABLE DATA; Schema: public; Owner: autoguru
--

COPY public.inspection_items (id, inspection_id, line_no, category, part_name, severity, required_action, tech_reason, layman_reason, photo_refs, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: inspection_media; Type: TABLE DATA; Schema: public; Owner: autoguru
--

COPY public.inspection_media (id, inspection_id, media_type, angle, label, file_ref, created_at) FROM stdin;
\.


--
-- Data for Name: inspection_versions; Type: TABLE DATA; Schema: public; Owner: autoguru
--

COPY public.inspection_versions (id, inspection_id, version_no, pdf_file_ref, created_by_user_id, created_at) FROM stdin;
\.


--
-- Data for Name: inspections; Type: TABLE DATA; Schema: public; Owner: autoguru
--

COPY public.inspections (id, company_id, lead_id, car_id, customer_id, inspector_employee_id, advisor_employee_id, status, health_engine, health_transmission, health_brakes, health_suspension, health_electrical, overall_health, customer_remark, agent_remark, inspector_remark, inspector_remark_layman, ai_summary_markdown, ai_summary_plain, draft_payload, media_summary, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: integration_channels; Type: TABLE DATA; Schema: public; Owner: autoguru
--

COPY public.integration_channels (key, label, category, description, global_enabled, created_at, updated_at) FROM stdin;
email	Email	Messaging	SMTP / transactional / marketing email	t	2025-12-04 09:39:00.461491+00	2025-12-04 09:39:00.461491+00
sms	SMS	Messaging	SMS messaging via any provider (Twilio, Vonage, custom, etc.)	t	2025-12-04 09:39:00.461491+00	2025-12-04 09:39:00.461491+00
whatsapp	WhatsApp	Messaging	WhatsApp Business via any provider or WhatsApp Cloud API	t	2025-12-04 09:39:00.461491+00	2025-12-04 09:39:00.461491+00
meta	Meta (FB / IG)	Social / Ads	Meta messaging and ads (Facebook & Instagram)	t	2025-12-04 09:39:00.461491+00	2025-12-04 09:39:00.461491+00
tiktok_ads	TikTok Ads	Ads	TikTok ads campaigns & reporting	t	2025-12-04 09:39:00.461491+00	2025-12-04 09:39:00.461491+00
google_ads	Google Ads	Ads	Google Ads campaigns, budgets, reporting	t	2025-12-04 09:39:00.461491+00	2025-12-04 09:39:00.461491+00
google_analytics	Google Analytics	Analytics	Google Analytics (GA4) events and reporting	t	2025-12-04 09:39:00.461491+00	2025-12-04 09:39:00.461491+00
\.


--
-- Data for Name: integration_dialer_metadata; Type: TABLE DATA; Schema: public; Owner: autoguru
--

COPY public.integration_dialer_metadata (id, dialer_id, key, value, created_at) FROM stdin;
\.


--
-- Data for Name: integration_dialer_webhooks; Type: TABLE DATA; Schema: public; Owner: autoguru
--

COPY public.integration_dialer_webhooks (id, dialer_id, event, url, secret, created_at) FROM stdin;
\.


--
-- Data for Name: integration_dialers; Type: TABLE DATA; Schema: public; Owner: autoguru
--

COPY public.integration_dialers (id, provider, label, auth_type, credentials, is_global, company_id, is_active, created_at, updated_at, metadata, webhooks) FROM stdin;
\.


--
-- Data for Name: integration_events; Type: TABLE DATA; Schema: public; Owner: autoguru
--

COPY public.integration_events (id, integration_type, integration_id, provider_key, direction, event_type, payload, status, error, created_at) FROM stdin;
\.


--
-- Data for Name: integration_health; Type: TABLE DATA; Schema: public; Owner: autoguru
--

COPY public.integration_health (id, integration_type, integration_id, provider_key, status, last_checked_at, last_error, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: inventory_locations; Type: TABLE DATA; Schema: public; Owner: autoguru
--

COPY public.inventory_locations (id, company_id, code, name, location_type, branch_id, fleet_vehicle_id, is_active, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: inventory_movements; Type: TABLE DATA; Schema: public; Owner: autoguru
--

COPY public.inventory_movements (id, company_id, part_id, location_code, direction, quantity, source_type, source_id, grn_number, note, created_at, purchase_order_id) FROM stdin;
\.


--
-- Data for Name: inventory_stock; Type: TABLE DATA; Schema: public; Owner: autoguru
--

COPY public.inventory_stock (id, company_id, part_id, location_code, on_hand, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: invoice_items; Type: TABLE DATA; Schema: public; Owner: autoguru
--

COPY public.invoice_items (id, invoice_id, work_order_item_id, estimate_item_id, line_no, name, description, quantity, rate, line_sale, line_discount, line_final, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: invoices; Type: TABLE DATA; Schema: public; Owner: autoguru
--

COPY public.invoices (id, company_id, work_order_id, estimate_id, quality_check_id, inspection_id, lead_id, car_id, customer_id, invoice_number, invoice_date, status, payment_method, due_date, paid_at, total_sale, total_discount, final_amount, vat_rate, vat_amount, grand_total, terms, notes, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: lead_events; Type: TABLE DATA; Schema: public; Owner: autoguru
--

COPY public.lead_events (id, lead_id, company_id, actor_user_id, actor_employee_id, event_type, event_payload, created_at) FROM stdin;
\.


--
-- Data for Name: leads; Type: TABLE DATA; Schema: public; Owner: autoguru
--

COPY public.leads (id, company_id, customer_id, car_id, agent_employee_id, lead_type, lead_status, lead_stage, source, sla_minutes, first_response_at, last_activity_at, closed_at, health_score, sentiment_score, customer_feedback, created_at, updated_at, agent_remark, customer_remark, is_locked) FROM stdin;
\.


--
-- Data for Name: parts_catalog; Type: TABLE DATA; Schema: public; Owner: autoguru
--

COPY public.parts_catalog (id, company_id, part_number, brand, sku, description, qr_code, is_active, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: permissions; Type: TABLE DATA; Schema: public; Owner: autoguru
--

COPY public.permissions (id, key, description) FROM stdin;
44129c45-b459-4107-b9a9-2ad4bc4780e7	global.admin	Global platform administrator
020c3e86-6c49-433a-b7a5-5129cf5558b1	company.admin	Company administrator
66bd0d65-70e8-4304-bca2-bb90887ea8a7	hr.employees.view	View employees
efcb24a7-becd-458d-b483-4ecb5d24ea93	hr.employees.edit	Edit employees
7d59ab63-5062-43c0-8bec-af2993fdee2f	hr.employees.manage_salary	Manage employee salaries
e5f5d84c-f616-451a-8de2-6b8608ee1aa3	integrations.manage	Manage integrations
e4efa133-581b-4e42-9c8c-afa751096a1b	integrations.dialer.use	Use dialer integrations
ac8d2a1e-b30b-449e-b2fa-068ec9c43c9a	integrations.channel.use	Use channel integrations
b5a93462-62e5-41a4-ba6c-a85baeb00db9	accounting.view	View accounting data
4c088a21-21c2-41d5-a222-d7761a812448	accounting.post	Post accounting journals
a348e0c8-3361-4593-9cec-90eaef701db8	accounting.manage_chart	Manage chart of accounts
884fe102-821d-46da-8322-d3957184799c	monitoring.view	View user monitoring data
fd6b09e4-e668-49bb-92ed-8bd3d10ff223	monitoring.manage	Manage user monitoring
b6403b34-f287-4b4d-a063-927f182803cf	crm.customers.view	View customers
9542b49a-aa93-4f99-bff4-eb1d895c39ee	crm.customers.edit	Edit customers
6cf349f5-78b2-4b68-b4a3-da45f73434b1	fleet.cars.view	View cars
71fdb610-2b20-4592-ac05-862288a24271	fleet.cars.edit	Edit cars
\.


--
-- Data for Name: purchase_order_items; Type: TABLE DATA; Schema: public; Owner: autoguru
--

COPY public.purchase_order_items (id, purchase_order_id, line_no, estimate_item_id, parts_catalog_id, name, description, quantity, unit_cost, total_cost, received_qty, status, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: purchase_orders; Type: TABLE DATA; Schema: public; Owner: autoguru
--

COPY public.purchase_orders (id, company_id, vendor_id, vendor_name, vendor_contact, po_number, po_type, source_type, quote_id, status, currency, expected_date, notes, total_cost, created_by, approved_by, approved_at, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: quality_check_items; Type: TABLE DATA; Schema: public; Owner: autoguru
--

COPY public.quality_check_items (id, quality_check_id, work_order_item_id, line_no, qc_status, qc_note, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: quality_checks; Type: TABLE DATA; Schema: public; Owner: autoguru
--

COPY public.quality_checks (id, company_id, work_order_id, estimate_id, inspection_id, lead_id, car_id, customer_id, status, test_drive_done, wash_done, qc_remarks, qc_video_ref, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: quote_items; Type: TABLE DATA; Schema: public; Owner: autoguru
--

COPY public.quote_items (id, quote_id, line_no, estimate_item_id, work_order_item_id, name, description, quantity, unit_price, total_price, part_number, brand, part_type, eta_days, labor_hours, labor_rate, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: quotes; Type: TABLE DATA; Schema: public; Owner: autoguru
--

COPY public.quotes (id, company_id, quote_type, status, estimate_id, work_order_id, vendor_id, branch_id, currency, total_amount, valid_until, created_by, approved_by, approved_at, meta, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: role_permissions; Type: TABLE DATA; Schema: public; Owner: autoguru
--

COPY public.role_permissions (role_id, permission_id) FROM stdin;
16b3e817-7ab6-4ae2-8c48-c34c79b3d2bd	44129c45-b459-4107-b9a9-2ad4bc4780e7
16b3e817-7ab6-4ae2-8c48-c34c79b3d2bd	020c3e86-6c49-433a-b7a5-5129cf5558b1
16b3e817-7ab6-4ae2-8c48-c34c79b3d2bd	66bd0d65-70e8-4304-bca2-bb90887ea8a7
16b3e817-7ab6-4ae2-8c48-c34c79b3d2bd	efcb24a7-becd-458d-b483-4ecb5d24ea93
16b3e817-7ab6-4ae2-8c48-c34c79b3d2bd	7d59ab63-5062-43c0-8bec-af2993fdee2f
16b3e817-7ab6-4ae2-8c48-c34c79b3d2bd	e5f5d84c-f616-451a-8de2-6b8608ee1aa3
16b3e817-7ab6-4ae2-8c48-c34c79b3d2bd	e4efa133-581b-4e42-9c8c-afa751096a1b
16b3e817-7ab6-4ae2-8c48-c34c79b3d2bd	ac8d2a1e-b30b-449e-b2fa-068ec9c43c9a
bd60560b-7bd7-4af7-8a5e-909dce3638dc	44129c45-b459-4107-b9a9-2ad4bc4780e7
bd60560b-7bd7-4af7-8a5e-909dce3638dc	020c3e86-6c49-433a-b7a5-5129cf5558b1
bd60560b-7bd7-4af7-8a5e-909dce3638dc	66bd0d65-70e8-4304-bca2-bb90887ea8a7
bd60560b-7bd7-4af7-8a5e-909dce3638dc	efcb24a7-becd-458d-b483-4ecb5d24ea93
bd60560b-7bd7-4af7-8a5e-909dce3638dc	7d59ab63-5062-43c0-8bec-af2993fdee2f
bd60560b-7bd7-4af7-8a5e-909dce3638dc	e5f5d84c-f616-451a-8de2-6b8608ee1aa3
bd60560b-7bd7-4af7-8a5e-909dce3638dc	e4efa133-581b-4e42-9c8c-afa751096a1b
bd60560b-7bd7-4af7-8a5e-909dce3638dc	ac8d2a1e-b30b-449e-b2fa-068ec9c43c9a
628de0d1-3232-4621-aa8d-4c5856107096	66bd0d65-70e8-4304-bca2-bb90887ea8a7
628de0d1-3232-4621-aa8d-4c5856107096	efcb24a7-becd-458d-b483-4ecb5d24ea93
628de0d1-3232-4621-aa8d-4c5856107096	7d59ab63-5062-43c0-8bec-af2993fdee2f
16b3e817-7ab6-4ae2-8c48-c34c79b3d2bd	b5a93462-62e5-41a4-ba6c-a85baeb00db9
16b3e817-7ab6-4ae2-8c48-c34c79b3d2bd	4c088a21-21c2-41d5-a222-d7761a812448
16b3e817-7ab6-4ae2-8c48-c34c79b3d2bd	a348e0c8-3361-4593-9cec-90eaef701db8
bd60560b-7bd7-4af7-8a5e-909dce3638dc	b5a93462-62e5-41a4-ba6c-a85baeb00db9
bd60560b-7bd7-4af7-8a5e-909dce3638dc	4c088a21-21c2-41d5-a222-d7761a812448
bd60560b-7bd7-4af7-8a5e-909dce3638dc	a348e0c8-3361-4593-9cec-90eaef701db8
16b3e817-7ab6-4ae2-8c48-c34c79b3d2bd	884fe102-821d-46da-8322-d3957184799c
16b3e817-7ab6-4ae2-8c48-c34c79b3d2bd	fd6b09e4-e668-49bb-92ed-8bd3d10ff223
bd60560b-7bd7-4af7-8a5e-909dce3638dc	884fe102-821d-46da-8322-d3957184799c
16b3e817-7ab6-4ae2-8c48-c34c79b3d2bd	b6403b34-f287-4b4d-a063-927f182803cf
16b3e817-7ab6-4ae2-8c48-c34c79b3d2bd	9542b49a-aa93-4f99-bff4-eb1d895c39ee
16b3e817-7ab6-4ae2-8c48-c34c79b3d2bd	6cf349f5-78b2-4b68-b4a3-da45f73434b1
16b3e817-7ab6-4ae2-8c48-c34c79b3d2bd	71fdb610-2b20-4592-ac05-862288a24271
bd60560b-7bd7-4af7-8a5e-909dce3638dc	b6403b34-f287-4b4d-a063-927f182803cf
bd60560b-7bd7-4af7-8a5e-909dce3638dc	9542b49a-aa93-4f99-bff4-eb1d895c39ee
bd60560b-7bd7-4af7-8a5e-909dce3638dc	6cf349f5-78b2-4b68-b4a3-da45f73434b1
bd60560b-7bd7-4af7-8a5e-909dce3638dc	71fdb610-2b20-4592-ac05-862288a24271
bd60560b-7bd7-4af7-8a5e-909dce3638dc	fd6b09e4-e668-49bb-92ed-8bd3d10ff223
\.


--
-- Data for Name: roles; Type: TABLE DATA; Schema: public; Owner: autoguru
--

COPY public.roles (id, name, key, scope, company_id, branch_id, vendor_id, description, is_system, created_at, updated_at) FROM stdin;
16b3e817-7ab6-4ae2-8c48-c34c79b3d2bd	Global Admin	global_admin	global	\N	\N	\N	\N	t	2025-12-04 21:29:10.129883+00	2025-12-04 21:29:10.129883+00
bd60560b-7bd7-4af7-8a5e-909dce3638dc	Company Admin	company_admin	company	\N	\N	\N	\N	t	2025-12-04 21:29:10.129883+00	2025-12-04 21:29:10.129883+00
628de0d1-3232-4621-aa8d-4c5856107096	HR Manager	hr_manager	company	\N	\N	\N	\N	f	2025-12-04 21:29:10.129883+00	2025-12-04 21:29:10.129883+00
\.


--
-- Data for Name: user_activity_logs; Type: TABLE DATA; Schema: public; Owner: autoguru
--

COPY public.user_activity_logs (id, user_id, session_id, scope, company_id, branch_id, vendor_id, "timestamp", ip_address, action_key, entity_type, entity_id, summary, metadata) FROM stdin;
\.


--
-- Data for Name: user_change_history; Type: TABLE DATA; Schema: public; Owner: autoguru
--

COPY public.user_change_history (id, user_id, session_id, scope, company_id, branch_id, vendor_id, entity_type, entity_id, change_timestamp, change_type, change_summary, before_data, after_data) FROM stdin;
\.


--
-- Data for Name: user_risk_profiles; Type: TABLE DATA; Schema: public; Owner: autoguru
--

COPY public.user_risk_profiles (user_id, overall_risk_score, risk_level, last_evaluated_at, has_global_admin_role, high_privilege_role_count, total_active_sessions, last_login_at, last_login_ip, last_login_country, last_failed_login_at, unusual_location, notes) FROM stdin;
\.


--
-- Data for Name: user_roles; Type: TABLE DATA; Schema: public; Owner: autoguru
--

COPY public.user_roles (user_id, role_id) FROM stdin;
582a8d7e-c88c-4785-90b6-7eff8857aa84	16b3e817-7ab6-4ae2-8c48-c34c79b3d2bd
\.


--
-- Data for Name: user_sessions; Type: TABLE DATA; Schema: public; Owner: autoguru
--

COPY public.user_sessions (id, user_id, scope, company_id, branch_id, vendor_id, started_at, last_seen_at, ip_address, user_agent, device_fingerprint, geo_country, geo_city, is_active, last_action, last_action_at) FROM stdin;
\.


--
-- Data for Name: users; Type: TABLE DATA; Schema: public; Owner: autoguru
--

COPY public.users (id, email, password_hash, full_name, is_active, created_at, updated_at, employee_id) FROM stdin;
582a8d7e-c88c-4785-90b6-7eff8857aa84	superadmin@example.com	$2b$10$HHHxtIbp1pFcGLPp3Woi2uFqunPUzcjBGSH9nIr90tHbOqAYRG7Oy	\N	t	2025-12-05 14:12:18.889949+00	2025-12-05 14:12:18.889949+00	\N
\.


--
-- Data for Name: vendor_bank_accounts; Type: TABLE DATA; Schema: public; Owner: autoguru
--

COPY public.vendor_bank_accounts (id, vendor_id, bank_name, branch_name, account_name, account_number, iban, swift, currency, is_default, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: vendor_contacts; Type: TABLE DATA; Schema: public; Owner: autoguru
--

COPY public.vendor_contacts (id, vendor_id, name, phone, email, address, sort_order, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: vendors; Type: TABLE DATA; Schema: public; Owner: autoguru
--

COPY public.vendors (id, company_id, code, name, legal_name, phone, email, address_line1, address_line2, city, state_region, postal_code, country, trade_license_number, trade_license_issue, trade_license_expiry, trade_license_file_id, tax_number, tax_certificate_file_id, is_active, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: work_order_items; Type: TABLE DATA; Schema: public; Owner: autoguru
--

COPY public.work_order_items (id, work_order_id, estimate_item_id, line_no, part_name, description, is_part, is_labor, required_qty, issued_qty, work_status, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: work_order_media; Type: TABLE DATA; Schema: public; Owner: autoguru
--

COPY public.work_order_media (id, work_order_id, work_order_item_id, kind, file_ref, note, created_at) FROM stdin;
\.


--
-- Data for Name: work_orders; Type: TABLE DATA; Schema: public; Owner: autoguru
--

COPY public.work_orders (id, company_id, estimate_id, inspection_id, lead_id, car_id, customer_id, branch_id, status, queue_reason, work_started_at, work_completed_at, meta, created_at, updated_at, labor_cost) FROM stdin;
\.


--
-- Data for Name: workshop_bays; Type: TABLE DATA; Schema: public; Owner: autoguru
--

COPY public.workshop_bays (id, company_id, branch_id, code, name, bay_type, capacity_cars, status, is_active, notes, created_at, updated_at) FROM stdin;
\.


--
-- Name: ai_feature_toggles_id_seq; Type: SEQUENCE SET; Schema: public; Owner: autoguru
--

SELECT pg_catalog.setval('public.ai_feature_toggles_id_seq', 1, false);


--
-- Name: ai_global_config_id_seq; Type: SEQUENCE SET; Schema: public; Owner: autoguru
--

SELECT pg_catalog.setval('public.ai_global_config_id_seq', 1, true);


--
-- Name: ai_modules_id_seq; Type: SEQUENCE SET; Schema: public; Owner: autoguru
--

SELECT pg_catalog.setval('public.ai_modules_id_seq', 1, true);


--
-- Name: company_integrations_id_seq; Type: SEQUENCE SET; Schema: public; Owner: autoguru
--

SELECT pg_catalog.setval('public.company_integrations_id_seq', 1, false);


--
-- Name: accounting_accounts accounting_accounts_entity_id_code_key; Type: CONSTRAINT; Schema: public; Owner: autoguru
--

ALTER TABLE ONLY public.accounting_accounts
    ADD CONSTRAINT accounting_accounts_entity_id_code_key UNIQUE (entity_id, code);


--
-- Name: accounting_accounts accounting_accounts_pkey; Type: CONSTRAINT; Schema: public; Owner: autoguru
--

ALTER TABLE ONLY public.accounting_accounts
    ADD CONSTRAINT accounting_accounts_pkey PRIMARY KEY (id);


--
-- Name: accounting_company_settings accounting_company_settings_pkey; Type: CONSTRAINT; Schema: public; Owner: autoguru
--

ALTER TABLE ONLY public.accounting_company_settings
    ADD CONSTRAINT accounting_company_settings_pkey PRIMARY KEY (company_id);


--
-- Name: accounting_entities accounting_entities_pkey; Type: CONSTRAINT; Schema: public; Owner: autoguru
--

ALTER TABLE ONLY public.accounting_entities
    ADD CONSTRAINT accounting_entities_pkey PRIMARY KEY (id);


--
-- Name: accounting_journal_lines accounting_journal_lines_pkey; Type: CONSTRAINT; Schema: public; Owner: autoguru
--

ALTER TABLE ONLY public.accounting_journal_lines
    ADD CONSTRAINT accounting_journal_lines_pkey PRIMARY KEY (id);


--
-- Name: accounting_journals accounting_journals_entity_id_journal_no_key; Type: CONSTRAINT; Schema: public; Owner: autoguru
--

ALTER TABLE ONLY public.accounting_journals
    ADD CONSTRAINT accounting_journals_entity_id_journal_no_key UNIQUE (entity_id, journal_no);


--
-- Name: accounting_journals accounting_journals_pkey; Type: CONSTRAINT; Schema: public; Owner: autoguru
--

ALTER TABLE ONLY public.accounting_journals
    ADD CONSTRAINT accounting_journals_pkey PRIMARY KEY (id);


--
-- Name: accounting_standard_accounts accounting_standard_accounts_code_key; Type: CONSTRAINT; Schema: public; Owner: autoguru
--

ALTER TABLE ONLY public.accounting_standard_accounts
    ADD CONSTRAINT accounting_standard_accounts_code_key UNIQUE (code);


--
-- Name: accounting_standard_accounts accounting_standard_accounts_pkey; Type: CONSTRAINT; Schema: public; Owner: autoguru
--

ALTER TABLE ONLY public.accounting_standard_accounts
    ADD CONSTRAINT accounting_standard_accounts_pkey PRIMARY KEY (id);


--
-- Name: ai_feature_toggles ai_feature_toggles_feature_key_scope_type_scope_id_key; Type: CONSTRAINT; Schema: public; Owner: autoguru
--

ALTER TABLE ONLY public.ai_feature_toggles
    ADD CONSTRAINT ai_feature_toggles_feature_key_scope_type_scope_id_key UNIQUE (feature_key, scope_type, scope_id);


--
-- Name: ai_feature_toggles ai_feature_toggles_pkey; Type: CONSTRAINT; Schema: public; Owner: autoguru
--

ALTER TABLE ONLY public.ai_feature_toggles
    ADD CONSTRAINT ai_feature_toggles_pkey PRIMARY KEY (id);


--
-- Name: ai_global_config ai_global_config_pkey; Type: CONSTRAINT; Schema: public; Owner: autoguru
--

ALTER TABLE ONLY public.ai_global_config
    ADD CONSTRAINT ai_global_config_pkey PRIMARY KEY (id);


--
-- Name: ai_modules ai_modules_key_key; Type: CONSTRAINT; Schema: public; Owner: autoguru
--

ALTER TABLE ONLY public.ai_modules
    ADD CONSTRAINT ai_modules_key_key UNIQUE (key);


--
-- Name: ai_modules ai_modules_pkey; Type: CONSTRAINT; Schema: public; Owner: autoguru
--

ALTER TABLE ONLY public.ai_modules
    ADD CONSTRAINT ai_modules_pkey PRIMARY KEY (id);


--
-- Name: call_recordings call_recordings_pkey; Type: CONSTRAINT; Schema: public; Owner: autoguru
--

ALTER TABLE ONLY public.call_recordings
    ADD CONSTRAINT call_recordings_pkey PRIMARY KEY (id);


--
-- Name: call_sessions call_sessions_pkey; Type: CONSTRAINT; Schema: public; Owner: autoguru
--

ALTER TABLE ONLY public.call_sessions
    ADD CONSTRAINT call_sessions_pkey PRIMARY KEY (id);


--
-- Name: cars cars_pkey; Type: CONSTRAINT; Schema: public; Owner: autoguru
--

ALTER TABLE ONLY public.cars
    ADD CONSTRAINT cars_pkey PRIMARY KEY (id);


--
-- Name: companies companies_code_key; Type: CONSTRAINT; Schema: public; Owner: autoguru
--

ALTER TABLE ONLY public.companies
    ADD CONSTRAINT companies_code_key UNIQUE (code);


--
-- Name: companies companies_pkey; Type: CONSTRAINT; Schema: public; Owner: autoguru
--

ALTER TABLE ONLY public.companies
    ADD CONSTRAINT companies_pkey PRIMARY KEY (id);


--
-- Name: company_contacts company_contacts_pkey; Type: CONSTRAINT; Schema: public; Owner: autoguru
--

ALTER TABLE ONLY public.company_contacts
    ADD CONSTRAINT company_contacts_pkey PRIMARY KEY (id);


--
-- Name: company_integrations company_integrations_pkey; Type: CONSTRAINT; Schema: public; Owner: autoguru
--

ALTER TABLE ONLY public.company_integrations
    ADD CONSTRAINT company_integrations_pkey PRIMARY KEY (id);


--
-- Name: customer_car_links customer_car_links_pkey; Type: CONSTRAINT; Schema: public; Owner: autoguru
--

ALTER TABLE ONLY public.customer_car_links
    ADD CONSTRAINT customer_car_links_pkey PRIMARY KEY (id);


--
-- Name: customers customers_pkey; Type: CONSTRAINT; Schema: public; Owner: autoguru
--

ALTER TABLE ONLY public.customers
    ADD CONSTRAINT customers_pkey PRIMARY KEY (id);


--
-- Name: employee_allowances employee_allowances_pkey; Type: CONSTRAINT; Schema: public; Owner: autoguru
--

ALTER TABLE ONLY public.employee_allowances
    ADD CONSTRAINT employee_allowances_pkey PRIMARY KEY (id);


--
-- Name: employees employees_auto_code_key; Type: CONSTRAINT; Schema: public; Owner: autoguru
--

ALTER TABLE ONLY public.employees
    ADD CONSTRAINT employees_auto_code_key UNIQUE (auto_code);


--
-- Name: employees employees_pkey; Type: CONSTRAINT; Schema: public; Owner: autoguru
--

ALTER TABLE ONLY public.employees
    ADD CONSTRAINT employees_pkey PRIMARY KEY (id);


--
-- Name: estimate_items estimate_items_pkey; Type: CONSTRAINT; Schema: public; Owner: autoguru
--

ALTER TABLE ONLY public.estimate_items
    ADD CONSTRAINT estimate_items_pkey PRIMARY KEY (id);


--
-- Name: estimates estimates_pkey; Type: CONSTRAINT; Schema: public; Owner: autoguru
--

ALTER TABLE ONLY public.estimates
    ADD CONSTRAINT estimates_pkey PRIMARY KEY (id);


--
-- Name: fleet_vehicles fleet_vehicles_pkey; Type: CONSTRAINT; Schema: public; Owner: autoguru
--

ALTER TABLE ONLY public.fleet_vehicles
    ADD CONSTRAINT fleet_vehicles_pkey PRIMARY KEY (id);


--
-- Name: gatepasses gatepasses_pkey; Type: CONSTRAINT; Schema: public; Owner: autoguru
--

ALTER TABLE ONLY public.gatepasses
    ADD CONSTRAINT gatepasses_pkey PRIMARY KEY (id);


--
-- Name: inspection_items inspection_items_pkey; Type: CONSTRAINT; Schema: public; Owner: autoguru
--

ALTER TABLE ONLY public.inspection_items
    ADD CONSTRAINT inspection_items_pkey PRIMARY KEY (id);


--
-- Name: inspection_media inspection_media_pkey; Type: CONSTRAINT; Schema: public; Owner: autoguru
--

ALTER TABLE ONLY public.inspection_media
    ADD CONSTRAINT inspection_media_pkey PRIMARY KEY (id);


--
-- Name: inspection_versions inspection_versions_pkey; Type: CONSTRAINT; Schema: public; Owner: autoguru
--

ALTER TABLE ONLY public.inspection_versions
    ADD CONSTRAINT inspection_versions_pkey PRIMARY KEY (id);


--
-- Name: inspections inspections_pkey; Type: CONSTRAINT; Schema: public; Owner: autoguru
--

ALTER TABLE ONLY public.inspections
    ADD CONSTRAINT inspections_pkey PRIMARY KEY (id);


--
-- Name: integration_channels integration_channels_pkey; Type: CONSTRAINT; Schema: public; Owner: autoguru
--

ALTER TABLE ONLY public.integration_channels
    ADD CONSTRAINT integration_channels_pkey PRIMARY KEY (key);


--
-- Name: integration_dialer_metadata integration_dialer_metadata_pkey; Type: CONSTRAINT; Schema: public; Owner: autoguru
--

ALTER TABLE ONLY public.integration_dialer_metadata
    ADD CONSTRAINT integration_dialer_metadata_pkey PRIMARY KEY (id);


--
-- Name: integration_dialer_webhooks integration_dialer_webhooks_pkey; Type: CONSTRAINT; Schema: public; Owner: autoguru
--

ALTER TABLE ONLY public.integration_dialer_webhooks
    ADD CONSTRAINT integration_dialer_webhooks_pkey PRIMARY KEY (id);


--
-- Name: integration_dialers integration_dialers_pkey; Type: CONSTRAINT; Schema: public; Owner: autoguru
--

ALTER TABLE ONLY public.integration_dialers
    ADD CONSTRAINT integration_dialers_pkey PRIMARY KEY (id);


--
-- Name: integration_events integration_events_pkey; Type: CONSTRAINT; Schema: public; Owner: autoguru
--

ALTER TABLE ONLY public.integration_events
    ADD CONSTRAINT integration_events_pkey PRIMARY KEY (id);


--
-- Name: integration_health integration_health_pkey; Type: CONSTRAINT; Schema: public; Owner: autoguru
--

ALTER TABLE ONLY public.integration_health
    ADD CONSTRAINT integration_health_pkey PRIMARY KEY (id);


--
-- Name: inventory_locations inventory_locations_pkey; Type: CONSTRAINT; Schema: public; Owner: autoguru
--

ALTER TABLE ONLY public.inventory_locations
    ADD CONSTRAINT inventory_locations_pkey PRIMARY KEY (id);


--
-- Name: inventory_movements inventory_movements_pkey; Type: CONSTRAINT; Schema: public; Owner: autoguru
--

ALTER TABLE ONLY public.inventory_movements
    ADD CONSTRAINT inventory_movements_pkey PRIMARY KEY (id);


--
-- Name: inventory_stock inventory_stock_company_id_part_id_location_code_key; Type: CONSTRAINT; Schema: public; Owner: autoguru
--

ALTER TABLE ONLY public.inventory_stock
    ADD CONSTRAINT inventory_stock_company_id_part_id_location_code_key UNIQUE (company_id, part_id, location_code);


--
-- Name: inventory_stock inventory_stock_pkey; Type: CONSTRAINT; Schema: public; Owner: autoguru
--

ALTER TABLE ONLY public.inventory_stock
    ADD CONSTRAINT inventory_stock_pkey PRIMARY KEY (id);


--
-- Name: invoice_items invoice_items_pkey; Type: CONSTRAINT; Schema: public; Owner: autoguru
--

ALTER TABLE ONLY public.invoice_items
    ADD CONSTRAINT invoice_items_pkey PRIMARY KEY (id);


--
-- Name: invoices invoices_pkey; Type: CONSTRAINT; Schema: public; Owner: autoguru
--

ALTER TABLE ONLY public.invoices
    ADD CONSTRAINT invoices_pkey PRIMARY KEY (id);


--
-- Name: lead_events lead_events_pkey; Type: CONSTRAINT; Schema: public; Owner: autoguru
--

ALTER TABLE ONLY public.lead_events
    ADD CONSTRAINT lead_events_pkey PRIMARY KEY (id);


--
-- Name: leads leads_pkey; Type: CONSTRAINT; Schema: public; Owner: autoguru
--

ALTER TABLE ONLY public.leads
    ADD CONSTRAINT leads_pkey PRIMARY KEY (id);


--
-- Name: parts_catalog parts_catalog_company_id_part_number_brand_key; Type: CONSTRAINT; Schema: public; Owner: autoguru
--

ALTER TABLE ONLY public.parts_catalog
    ADD CONSTRAINT parts_catalog_company_id_part_number_brand_key UNIQUE (company_id, part_number, brand);


--
-- Name: parts_catalog parts_catalog_pkey; Type: CONSTRAINT; Schema: public; Owner: autoguru
--

ALTER TABLE ONLY public.parts_catalog
    ADD CONSTRAINT parts_catalog_pkey PRIMARY KEY (id);


--
-- Name: permissions permissions_key_key; Type: CONSTRAINT; Schema: public; Owner: autoguru
--

ALTER TABLE ONLY public.permissions
    ADD CONSTRAINT permissions_key_key UNIQUE (key);


--
-- Name: permissions permissions_pkey; Type: CONSTRAINT; Schema: public; Owner: autoguru
--

ALTER TABLE ONLY public.permissions
    ADD CONSTRAINT permissions_pkey PRIMARY KEY (id);


--
-- Name: purchase_order_items purchase_order_items_pkey; Type: CONSTRAINT; Schema: public; Owner: autoguru
--

ALTER TABLE ONLY public.purchase_order_items
    ADD CONSTRAINT purchase_order_items_pkey PRIMARY KEY (id);


--
-- Name: purchase_orders purchase_orders_pkey; Type: CONSTRAINT; Schema: public; Owner: autoguru
--

ALTER TABLE ONLY public.purchase_orders
    ADD CONSTRAINT purchase_orders_pkey PRIMARY KEY (id);


--
-- Name: quality_check_items quality_check_items_pkey; Type: CONSTRAINT; Schema: public; Owner: autoguru
--

ALTER TABLE ONLY public.quality_check_items
    ADD CONSTRAINT quality_check_items_pkey PRIMARY KEY (id);


--
-- Name: quality_checks quality_checks_pkey; Type: CONSTRAINT; Schema: public; Owner: autoguru
--

ALTER TABLE ONLY public.quality_checks
    ADD CONSTRAINT quality_checks_pkey PRIMARY KEY (id);


--
-- Name: quote_items quote_items_pkey; Type: CONSTRAINT; Schema: public; Owner: autoguru
--

ALTER TABLE ONLY public.quote_items
    ADD CONSTRAINT quote_items_pkey PRIMARY KEY (id);


--
-- Name: quotes quotes_pkey; Type: CONSTRAINT; Schema: public; Owner: autoguru
--

ALTER TABLE ONLY public.quotes
    ADD CONSTRAINT quotes_pkey PRIMARY KEY (id);


--
-- Name: role_permissions role_permissions_pkey; Type: CONSTRAINT; Schema: public; Owner: autoguru
--

ALTER TABLE ONLY public.role_permissions
    ADD CONSTRAINT role_permissions_pkey PRIMARY KEY (role_id, permission_id);


--
-- Name: roles roles_key_key; Type: CONSTRAINT; Schema: public; Owner: autoguru
--

ALTER TABLE ONLY public.roles
    ADD CONSTRAINT roles_key_key UNIQUE (key);


--
-- Name: roles roles_pkey; Type: CONSTRAINT; Schema: public; Owner: autoguru
--

ALTER TABLE ONLY public.roles
    ADD CONSTRAINT roles_pkey PRIMARY KEY (id);


--
-- Name: user_activity_logs user_activity_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: autoguru
--

ALTER TABLE ONLY public.user_activity_logs
    ADD CONSTRAINT user_activity_logs_pkey PRIMARY KEY (id);


--
-- Name: user_change_history user_change_history_pkey; Type: CONSTRAINT; Schema: public; Owner: autoguru
--

ALTER TABLE ONLY public.user_change_history
    ADD CONSTRAINT user_change_history_pkey PRIMARY KEY (id);


--
-- Name: user_risk_profiles user_risk_profiles_pkey; Type: CONSTRAINT; Schema: public; Owner: autoguru
--

ALTER TABLE ONLY public.user_risk_profiles
    ADD CONSTRAINT user_risk_profiles_pkey PRIMARY KEY (user_id);


--
-- Name: user_roles user_roles_pkey; Type: CONSTRAINT; Schema: public; Owner: autoguru
--

ALTER TABLE ONLY public.user_roles
    ADD CONSTRAINT user_roles_pkey PRIMARY KEY (user_id, role_id);


--
-- Name: user_sessions user_sessions_pkey; Type: CONSTRAINT; Schema: public; Owner: autoguru
--

ALTER TABLE ONLY public.user_sessions
    ADD CONSTRAINT user_sessions_pkey PRIMARY KEY (id);


--
-- Name: users users_email_key; Type: CONSTRAINT; Schema: public; Owner: autoguru
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key UNIQUE (email);


--
-- Name: users users_pkey; Type: CONSTRAINT; Schema: public; Owner: autoguru
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_pkey PRIMARY KEY (id);


--
-- Name: vendor_bank_accounts vendor_bank_accounts_pkey; Type: CONSTRAINT; Schema: public; Owner: autoguru
--

ALTER TABLE ONLY public.vendor_bank_accounts
    ADD CONSTRAINT vendor_bank_accounts_pkey PRIMARY KEY (id);


--
-- Name: vendor_contacts vendor_contacts_pkey; Type: CONSTRAINT; Schema: public; Owner: autoguru
--

ALTER TABLE ONLY public.vendor_contacts
    ADD CONSTRAINT vendor_contacts_pkey PRIMARY KEY (id);


--
-- Name: vendors vendors_pkey; Type: CONSTRAINT; Schema: public; Owner: autoguru
--

ALTER TABLE ONLY public.vendors
    ADD CONSTRAINT vendors_pkey PRIMARY KEY (id);


--
-- Name: work_order_items work_order_items_pkey; Type: CONSTRAINT; Schema: public; Owner: autoguru
--

ALTER TABLE ONLY public.work_order_items
    ADD CONSTRAINT work_order_items_pkey PRIMARY KEY (id);


--
-- Name: work_order_media work_order_media_pkey; Type: CONSTRAINT; Schema: public; Owner: autoguru
--

ALTER TABLE ONLY public.work_order_media
    ADD CONSTRAINT work_order_media_pkey PRIMARY KEY (id);


--
-- Name: work_orders work_orders_pkey; Type: CONSTRAINT; Schema: public; Owner: autoguru
--

ALTER TABLE ONLY public.work_orders
    ADD CONSTRAINT work_orders_pkey PRIMARY KEY (id);


--
-- Name: workshop_bays workshop_bays_pkey; Type: CONSTRAINT; Schema: public; Owner: autoguru
--

ALTER TABLE ONLY public.workshop_bays
    ADD CONSTRAINT workshop_bays_pkey PRIMARY KEY (id);


--
-- Name: ai_global_config_singleton_idx; Type: INDEX; Schema: public; Owner: autoguru
--

CREATE UNIQUE INDEX ai_global_config_singleton_idx ON public.ai_global_config USING btree ((true));


--
-- Name: idx_bays_company_branch; Type: INDEX; Schema: public; Owner: autoguru
--

CREATE INDEX idx_bays_company_branch ON public.workshop_bays USING btree (company_id, branch_id);


--
-- Name: idx_bays_company_code; Type: INDEX; Schema: public; Owner: autoguru
--

CREATE UNIQUE INDEX idx_bays_company_code ON public.workshop_bays USING btree (company_id, code);


--
-- Name: idx_bays_company_status; Type: INDEX; Schema: public; Owner: autoguru
--

CREATE INDEX idx_bays_company_status ON public.workshop_bays USING btree (company_id, status);


--
-- Name: idx_call_recordings_session; Type: INDEX; Schema: public; Owner: autoguru
--

CREATE INDEX idx_call_recordings_session ON public.call_recordings USING btree (call_session_id);


--
-- Name: idx_call_sessions_created_by; Type: INDEX; Schema: public; Owner: autoguru
--

CREATE INDEX idx_call_sessions_created_by ON public.call_sessions USING btree (created_by_user_id);


--
-- Name: idx_call_sessions_entity; Type: INDEX; Schema: public; Owner: autoguru
--

CREATE INDEX idx_call_sessions_entity ON public.call_sessions USING btree (to_entity_type, to_entity_id);


--
-- Name: idx_call_sessions_provider_call; Type: INDEX; Schema: public; Owner: autoguru
--

CREATE INDEX idx_call_sessions_provider_call ON public.call_sessions USING btree (provider_call_id);


--
-- Name: idx_call_sessions_scope_company_branch; Type: INDEX; Schema: public; Owner: autoguru
--

CREATE INDEX idx_call_sessions_scope_company_branch ON public.call_sessions USING btree (scope, company_id, branch_id);


--
-- Name: idx_cars_company; Type: INDEX; Schema: public; Owner: autoguru
--

CREATE INDEX idx_cars_company ON public.cars USING btree (company_id, is_active);


--
-- Name: idx_cars_company_code; Type: INDEX; Schema: public; Owner: autoguru
--

CREATE UNIQUE INDEX idx_cars_company_code ON public.cars USING btree (company_id, code);


--
-- Name: idx_cars_company_plate; Type: INDEX; Schema: public; Owner: autoguru
--

CREATE INDEX idx_cars_company_plate ON public.cars USING btree (company_id, plate_number);


--
-- Name: idx_company_contacts_company; Type: INDEX; Schema: public; Owner: autoguru
--

CREATE INDEX idx_company_contacts_company ON public.company_contacts USING btree (company_id);


--
-- Name: idx_company_integrations_company; Type: INDEX; Schema: public; Owner: autoguru
--

CREATE INDEX idx_company_integrations_company ON public.company_integrations USING btree (company_id);


--
-- Name: idx_company_integrations_company_channel; Type: INDEX; Schema: public; Owner: autoguru
--

CREATE INDEX idx_company_integrations_company_channel ON public.company_integrations USING btree (company_id, channel_key);


--
-- Name: idx_customer_car_car; Type: INDEX; Schema: public; Owner: autoguru
--

CREATE INDEX idx_customer_car_car ON public.customer_car_links USING btree (car_id);


--
-- Name: idx_customer_car_company; Type: INDEX; Schema: public; Owner: autoguru
--

CREATE INDEX idx_customer_car_company ON public.customer_car_links USING btree (company_id);


--
-- Name: idx_customer_car_customer; Type: INDEX; Schema: public; Owner: autoguru
--

CREATE INDEX idx_customer_car_customer ON public.customer_car_links USING btree (customer_id);


--
-- Name: idx_customer_car_relation; Type: INDEX; Schema: public; Owner: autoguru
--

CREATE UNIQUE INDEX idx_customer_car_relation ON public.customer_car_links USING btree (customer_id, car_id, relation_type, priority);


--
-- Name: idx_customers_company; Type: INDEX; Schema: public; Owner: autoguru
--

CREATE INDEX idx_customers_company ON public.customers USING btree (company_id, is_active);


--
-- Name: idx_customers_company_code; Type: INDEX; Schema: public; Owner: autoguru
--

CREATE UNIQUE INDEX idx_customers_company_code ON public.customers USING btree (company_id, code);


--
-- Name: idx_employee_allowances_employee_id; Type: INDEX; Schema: public; Owner: autoguru
--

CREATE INDEX idx_employee_allowances_employee_id ON public.employee_allowances USING btree (employee_id);


--
-- Name: idx_employees_scope; Type: INDEX; Schema: public; Owner: autoguru
--

CREATE INDEX idx_employees_scope ON public.employees USING btree (scope, company_id, branch_id, vendor_id);


--
-- Name: idx_entities_scope_company; Type: INDEX; Schema: public; Owner: autoguru
--

CREATE INDEX idx_entities_scope_company ON public.accounting_entities USING btree (scope, company_id);


--
-- Name: idx_estimate_items_estimate; Type: INDEX; Schema: public; Owner: autoguru
--

CREATE INDEX idx_estimate_items_estimate ON public.estimate_items USING btree (estimate_id, line_no);


--
-- Name: idx_estimates_company_status; Type: INDEX; Schema: public; Owner: autoguru
--

CREATE INDEX idx_estimates_company_status ON public.estimates USING btree (company_id, status);


--
-- Name: idx_estimates_inspection; Type: INDEX; Schema: public; Owner: autoguru
--

CREATE INDEX idx_estimates_inspection ON public.estimates USING btree (inspection_id);


--
-- Name: idx_fleet_company_branch; Type: INDEX; Schema: public; Owner: autoguru
--

CREATE INDEX idx_fleet_company_branch ON public.fleet_vehicles USING btree (company_id, branch_id);


--
-- Name: idx_fleet_company_code; Type: INDEX; Schema: public; Owner: autoguru
--

CREATE UNIQUE INDEX idx_fleet_company_code ON public.fleet_vehicles USING btree (company_id, code);


--
-- Name: idx_fleet_company_status; Type: INDEX; Schema: public; Owner: autoguru
--

CREATE INDEX idx_fleet_company_status ON public.fleet_vehicles USING btree (company_id, status);


--
-- Name: idx_gatepasses_company_status; Type: INDEX; Schema: public; Owner: autoguru
--

CREATE INDEX idx_gatepasses_company_status ON public.gatepasses USING btree (company_id, status);


--
-- Name: idx_gatepasses_invoice; Type: INDEX; Schema: public; Owner: autoguru
--

CREATE UNIQUE INDEX idx_gatepasses_invoice ON public.gatepasses USING btree (invoice_id);


--
-- Name: idx_inspection_items_inspection; Type: INDEX; Schema: public; Owner: autoguru
--

CREATE INDEX idx_inspection_items_inspection ON public.inspection_items USING btree (inspection_id, line_no);


--
-- Name: idx_inspection_media_inspection; Type: INDEX; Schema: public; Owner: autoguru
--

CREATE INDEX idx_inspection_media_inspection ON public.inspection_media USING btree (inspection_id);


--
-- Name: idx_inspection_versions_unique; Type: INDEX; Schema: public; Owner: autoguru
--

CREATE UNIQUE INDEX idx_inspection_versions_unique ON public.inspection_versions USING btree (inspection_id, version_no);


--
-- Name: idx_inspections_company_status; Type: INDEX; Schema: public; Owner: autoguru
--

CREATE INDEX idx_inspections_company_status ON public.inspections USING btree (company_id, status);


--
-- Name: idx_inspections_lead; Type: INDEX; Schema: public; Owner: autoguru
--

CREATE INDEX idx_inspections_lead ON public.inspections USING btree (lead_id);


--
-- Name: idx_integration_dialer_webhooks_dialer; Type: INDEX; Schema: public; Owner: autoguru
--

CREATE INDEX idx_integration_dialer_webhooks_dialer ON public.integration_dialer_webhooks USING btree (dialer_id);


--
-- Name: idx_integration_dialer_webhooks_event; Type: INDEX; Schema: public; Owner: autoguru
--

CREATE INDEX idx_integration_dialer_webhooks_event ON public.integration_dialer_webhooks USING btree (event);


--
-- Name: idx_integration_dialers_company; Type: INDEX; Schema: public; Owner: autoguru
--

CREATE INDEX idx_integration_dialers_company ON public.integration_dialers USING btree (company_id);


--
-- Name: idx_integration_dialers_is_global; Type: INDEX; Schema: public; Owner: autoguru
--

CREATE INDEX idx_integration_dialers_is_global ON public.integration_dialers USING btree (is_global);


--
-- Name: idx_integration_dialers_provider; Type: INDEX; Schema: public; Owner: autoguru
--

CREATE INDEX idx_integration_dialers_provider ON public.integration_dialers USING btree (provider);


--
-- Name: idx_integration_events_provider_created; Type: INDEX; Schema: public; Owner: autoguru
--

CREATE INDEX idx_integration_events_provider_created ON public.integration_events USING btree (provider_key, created_at);


--
-- Name: idx_integration_events_type_id; Type: INDEX; Schema: public; Owner: autoguru
--

CREATE INDEX idx_integration_events_type_id ON public.integration_events USING btree (integration_type, integration_id);


--
-- Name: idx_integration_health_unique; Type: INDEX; Schema: public; Owner: autoguru
--

CREATE UNIQUE INDEX idx_integration_health_unique ON public.integration_health USING btree (integration_type, integration_id);


--
-- Name: idx_inventory_locations_company_code; Type: INDEX; Schema: public; Owner: autoguru
--

CREATE UNIQUE INDEX idx_inventory_locations_company_code ON public.inventory_locations USING btree (company_id, code);


--
-- Name: idx_inventory_locations_company_type; Type: INDEX; Schema: public; Owner: autoguru
--

CREATE INDEX idx_inventory_locations_company_type ON public.inventory_locations USING btree (company_id, location_type);


--
-- Name: idx_invoice_items_invoice; Type: INDEX; Schema: public; Owner: autoguru
--

CREATE INDEX idx_invoice_items_invoice ON public.invoice_items USING btree (invoice_id, line_no);


--
-- Name: idx_invoices_company_status; Type: INDEX; Schema: public; Owner: autoguru
--

CREATE INDEX idx_invoices_company_status ON public.invoices USING btree (company_id, status);


--
-- Name: idx_invoices_number; Type: INDEX; Schema: public; Owner: autoguru
--

CREATE UNIQUE INDEX idx_invoices_number ON public.invoices USING btree (company_id, invoice_number);


--
-- Name: idx_invoices_work_order; Type: INDEX; Schema: public; Owner: autoguru
--

CREATE INDEX idx_invoices_work_order ON public.invoices USING btree (work_order_id);


--
-- Name: idx_journal_lines_entity; Type: INDEX; Schema: public; Owner: autoguru
--

CREATE INDEX idx_journal_lines_entity ON public.accounting_journal_lines USING btree (entity_id);


--
-- Name: idx_journal_lines_journal; Type: INDEX; Schema: public; Owner: autoguru
--

CREATE INDEX idx_journal_lines_journal ON public.accounting_journal_lines USING btree (journal_id);


--
-- Name: idx_lead_events_company_id; Type: INDEX; Schema: public; Owner: autoguru
--

CREATE INDEX idx_lead_events_company_id ON public.lead_events USING btree (company_id);


--
-- Name: idx_lead_events_lead_id; Type: INDEX; Schema: public; Owner: autoguru
--

CREATE INDEX idx_lead_events_lead_id ON public.lead_events USING btree (lead_id);


--
-- Name: idx_leads_agent_employee_id; Type: INDEX; Schema: public; Owner: autoguru
--

CREATE INDEX idx_leads_agent_employee_id ON public.leads USING btree (agent_employee_id);


--
-- Name: idx_leads_company_id; Type: INDEX; Schema: public; Owner: autoguru
--

CREATE INDEX idx_leads_company_id ON public.leads USING btree (company_id);


--
-- Name: idx_leads_status; Type: INDEX; Schema: public; Owner: autoguru
--

CREATE INDEX idx_leads_status ON public.leads USING btree (lead_status);


--
-- Name: idx_leads_type; Type: INDEX; Schema: public; Owner: autoguru
--

CREATE INDEX idx_leads_type ON public.leads USING btree (lead_type);


--
-- Name: idx_po_company_number; Type: INDEX; Schema: public; Owner: autoguru
--

CREATE UNIQUE INDEX idx_po_company_number ON public.purchase_orders USING btree (company_id, po_number);


--
-- Name: idx_po_company_status; Type: INDEX; Schema: public; Owner: autoguru
--

CREATE INDEX idx_po_company_status ON public.purchase_orders USING btree (company_id, status);


--
-- Name: idx_po_items_po; Type: INDEX; Schema: public; Owner: autoguru
--

CREATE INDEX idx_po_items_po ON public.purchase_order_items USING btree (purchase_order_id, line_no);


--
-- Name: idx_quality_check_items_qc; Type: INDEX; Schema: public; Owner: autoguru
--

CREATE INDEX idx_quality_check_items_qc ON public.quality_check_items USING btree (quality_check_id, line_no);


--
-- Name: idx_quality_checks_company_status; Type: INDEX; Schema: public; Owner: autoguru
--

CREATE INDEX idx_quality_checks_company_status ON public.quality_checks USING btree (company_id, status);


--
-- Name: idx_quality_checks_work_order; Type: INDEX; Schema: public; Owner: autoguru
--

CREATE UNIQUE INDEX idx_quality_checks_work_order ON public.quality_checks USING btree (work_order_id);


--
-- Name: idx_quote_items_quote; Type: INDEX; Schema: public; Owner: autoguru
--

CREATE INDEX idx_quote_items_quote ON public.quote_items USING btree (quote_id, line_no);


--
-- Name: idx_quotes_company_status; Type: INDEX; Schema: public; Owner: autoguru
--

CREATE INDEX idx_quotes_company_status ON public.quotes USING btree (company_id, quote_type, status);


--
-- Name: idx_quotes_estimate; Type: INDEX; Schema: public; Owner: autoguru
--

CREATE INDEX idx_quotes_estimate ON public.quotes USING btree (estimate_id);


--
-- Name: idx_quotes_workorder; Type: INDEX; Schema: public; Owner: autoguru
--

CREATE INDEX idx_quotes_workorder ON public.quotes USING btree (work_order_id);


--
-- Name: idx_role_permissions_role; Type: INDEX; Schema: public; Owner: autoguru
--

CREATE INDEX idx_role_permissions_role ON public.role_permissions USING btree (role_id);


--
-- Name: idx_roles_scope_company_branch_vendor; Type: INDEX; Schema: public; Owner: autoguru
--

CREATE INDEX idx_roles_scope_company_branch_vendor ON public.roles USING btree (scope, company_id, branch_id, vendor_id);


--
-- Name: idx_user_activity_action_ts; Type: INDEX; Schema: public; Owner: autoguru
--

CREATE INDEX idx_user_activity_action_ts ON public.user_activity_logs USING btree (action_key, "timestamp");


--
-- Name: idx_user_activity_scope; Type: INDEX; Schema: public; Owner: autoguru
--

CREATE INDEX idx_user_activity_scope ON public.user_activity_logs USING btree (scope, company_id, branch_id, vendor_id);


--
-- Name: idx_user_activity_user_ts; Type: INDEX; Schema: public; Owner: autoguru
--

CREATE INDEX idx_user_activity_user_ts ON public.user_activity_logs USING btree (user_id, "timestamp");


--
-- Name: idx_user_change_entity_ts; Type: INDEX; Schema: public; Owner: autoguru
--

CREATE INDEX idx_user_change_entity_ts ON public.user_change_history USING btree (entity_type, entity_id, change_timestamp);


--
-- Name: idx_user_change_user_ts; Type: INDEX; Schema: public; Owner: autoguru
--

CREATE INDEX idx_user_change_user_ts ON public.user_change_history USING btree (user_id, change_timestamp);


--
-- Name: idx_user_roles_user; Type: INDEX; Schema: public; Owner: autoguru
--

CREATE INDEX idx_user_roles_user ON public.user_roles USING btree (user_id);


--
-- Name: idx_user_sessions_scope; Type: INDEX; Schema: public; Owner: autoguru
--

CREATE INDEX idx_user_sessions_scope ON public.user_sessions USING btree (scope, company_id, branch_id, vendor_id);


--
-- Name: idx_user_sessions_user_active; Type: INDEX; Schema: public; Owner: autoguru
--

CREATE INDEX idx_user_sessions_user_active ON public.user_sessions USING btree (user_id, is_active);


--
-- Name: idx_users_email; Type: INDEX; Schema: public; Owner: autoguru
--

CREATE UNIQUE INDEX idx_users_email ON public.users USING btree (email);


--
-- Name: idx_vendor_bank_accounts_vendor; Type: INDEX; Schema: public; Owner: autoguru
--

CREATE INDEX idx_vendor_bank_accounts_vendor ON public.vendor_bank_accounts USING btree (vendor_id);


--
-- Name: idx_vendor_contacts_vendor; Type: INDEX; Schema: public; Owner: autoguru
--

CREATE INDEX idx_vendor_contacts_vendor ON public.vendor_contacts USING btree (vendor_id);


--
-- Name: idx_vendors_company_active; Type: INDEX; Schema: public; Owner: autoguru
--

CREATE INDEX idx_vendors_company_active ON public.vendors USING btree (company_id, is_active);


--
-- Name: idx_vendors_company_code; Type: INDEX; Schema: public; Owner: autoguru
--

CREATE UNIQUE INDEX idx_vendors_company_code ON public.vendors USING btree (company_id, code);


--
-- Name: idx_work_order_items_order; Type: INDEX; Schema: public; Owner: autoguru
--

CREATE INDEX idx_work_order_items_order ON public.work_order_items USING btree (work_order_id, line_no);


--
-- Name: idx_work_order_media_item; Type: INDEX; Schema: public; Owner: autoguru
--

CREATE INDEX idx_work_order_media_item ON public.work_order_media USING btree (work_order_item_id, kind);


--
-- Name: idx_work_orders_company_status; Type: INDEX; Schema: public; Owner: autoguru
--

CREATE INDEX idx_work_orders_company_status ON public.work_orders USING btree (company_id, status);


--
-- Name: idx_work_orders_estimate; Type: INDEX; Schema: public; Owner: autoguru
--

CREATE INDEX idx_work_orders_estimate ON public.work_orders USING btree (estimate_id);


--
-- Name: ux_company_integrations_primary; Type: INDEX; Schema: public; Owner: autoguru
--

CREATE UNIQUE INDEX ux_company_integrations_primary ON public.company_integrations USING btree (company_id, channel_key) WHERE (is_primary = true);


--
-- Name: ux_integration_dialer_metadata_dialer_key; Type: INDEX; Schema: public; Owner: autoguru
--

CREATE UNIQUE INDEX ux_integration_dialer_metadata_dialer_key ON public.integration_dialer_metadata USING btree (dialer_id, key);


--
-- Name: inventory_movements trg_apply_inventory_movement; Type: TRIGGER; Schema: public; Owner: autoguru
--

CREATE TRIGGER trg_apply_inventory_movement AFTER INSERT ON public.inventory_movements FOR EACH ROW EXECUTE FUNCTION public.apply_inventory_movement();


--
-- Name: integration_dialers trg_integration_dialers_set_updated_at; Type: TRIGGER; Schema: public; Owner: autoguru
--

CREATE TRIGGER trg_integration_dialers_set_updated_at BEFORE UPDATE ON public.integration_dialers FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: accounting_company_settings trg_touch_accounting_company_settings_updated_at; Type: TRIGGER; Schema: public; Owner: autoguru
--

CREATE TRIGGER trg_touch_accounting_company_settings_updated_at BEFORE UPDATE ON public.accounting_company_settings FOR EACH ROW EXECUTE FUNCTION public.touch_accounting_company_settings_updated_at();


--
-- Name: estimates trg_touch_estimates_updated_at; Type: TRIGGER; Schema: public; Owner: autoguru
--

CREATE TRIGGER trg_touch_estimates_updated_at BEFORE UPDATE ON public.estimates FOR EACH ROW EXECUTE FUNCTION public.touch_estimates_updated_at();


--
-- Name: fleet_vehicles trg_touch_fleet_vehicles_updated_at; Type: TRIGGER; Schema: public; Owner: autoguru
--

CREATE TRIGGER trg_touch_fleet_vehicles_updated_at BEFORE UPDATE ON public.fleet_vehicles FOR EACH ROW EXECUTE FUNCTION public.touch_fleet_vehicles_updated_at();


--
-- Name: gatepasses trg_touch_gatepasses_updated_at; Type: TRIGGER; Schema: public; Owner: autoguru
--

CREATE TRIGGER trg_touch_gatepasses_updated_at BEFORE UPDATE ON public.gatepasses FOR EACH ROW EXECUTE FUNCTION public.touch_gatepasses_updated_at();


--
-- Name: inspections trg_touch_inspections_updated_at; Type: TRIGGER; Schema: public; Owner: autoguru
--

CREATE TRIGGER trg_touch_inspections_updated_at BEFORE UPDATE ON public.inspections FOR EACH ROW EXECUTE FUNCTION public.touch_inspections_updated_at();


--
-- Name: inventory_locations trg_touch_inventory_locations_updated_at; Type: TRIGGER; Schema: public; Owner: autoguru
--

CREATE TRIGGER trg_touch_inventory_locations_updated_at BEFORE UPDATE ON public.inventory_locations FOR EACH ROW EXECUTE FUNCTION public.trg_touch_inventory_locations_updated_at();


--
-- Name: invoices trg_touch_invoices_updated_at; Type: TRIGGER; Schema: public; Owner: autoguru
--

CREATE TRIGGER trg_touch_invoices_updated_at BEFORE UPDATE ON public.invoices FOR EACH ROW EXECUTE FUNCTION public.touch_invoices_updated_at();


--
-- Name: purchase_orders trg_touch_purchase_orders_updated_at; Type: TRIGGER; Schema: public; Owner: autoguru
--

CREATE TRIGGER trg_touch_purchase_orders_updated_at BEFORE UPDATE ON public.purchase_orders FOR EACH ROW EXECUTE FUNCTION public.touch_purchase_orders_updated_at();


--
-- Name: quality_checks trg_touch_quality_checks_updated_at; Type: TRIGGER; Schema: public; Owner: autoguru
--

CREATE TRIGGER trg_touch_quality_checks_updated_at BEFORE UPDATE ON public.quality_checks FOR EACH ROW EXECUTE FUNCTION public.touch_quality_checks_updated_at();


--
-- Name: quotes trg_touch_quotes_updated_at; Type: TRIGGER; Schema: public; Owner: autoguru
--

CREATE TRIGGER trg_touch_quotes_updated_at BEFORE UPDATE ON public.quotes FOR EACH ROW EXECUTE FUNCTION public.touch_quotes_updated_at();


--
-- Name: work_orders trg_touch_work_orders_updated_at; Type: TRIGGER; Schema: public; Owner: autoguru
--

CREATE TRIGGER trg_touch_work_orders_updated_at BEFORE UPDATE ON public.work_orders FOR EACH ROW EXECUTE FUNCTION public.touch_work_orders_updated_at();


--
-- Name: workshop_bays trg_touch_workshop_bays_updated_at; Type: TRIGGER; Schema: public; Owner: autoguru
--

CREATE TRIGGER trg_touch_workshop_bays_updated_at BEFORE UPDATE ON public.workshop_bays FOR EACH ROW EXECUTE FUNCTION public.touch_workshop_bays_updated_at();


--
-- Name: accounting_accounts accounting_accounts_entity_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: autoguru
--

ALTER TABLE ONLY public.accounting_accounts
    ADD CONSTRAINT accounting_accounts_entity_id_fkey FOREIGN KEY (entity_id) REFERENCES public.accounting_entities(id);


--
-- Name: accounting_accounts accounting_accounts_parent_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: autoguru
--

ALTER TABLE ONLY public.accounting_accounts
    ADD CONSTRAINT accounting_accounts_parent_id_fkey FOREIGN KEY (parent_id) REFERENCES public.accounting_accounts(id);


--
-- Name: accounting_accounts accounting_accounts_standard_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: autoguru
--

ALTER TABLE ONLY public.accounting_accounts
    ADD CONSTRAINT accounting_accounts_standard_id_fkey FOREIGN KEY (standard_id) REFERENCES public.accounting_standard_accounts(id);


--
-- Name: accounting_journal_lines accounting_journal_lines_account_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: autoguru
--

ALTER TABLE ONLY public.accounting_journal_lines
    ADD CONSTRAINT accounting_journal_lines_account_id_fkey FOREIGN KEY (account_id) REFERENCES public.accounting_accounts(id);


--
-- Name: accounting_journal_lines accounting_journal_lines_journal_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: autoguru
--

ALTER TABLE ONLY public.accounting_journal_lines
    ADD CONSTRAINT accounting_journal_lines_journal_id_fkey FOREIGN KEY (journal_id) REFERENCES public.accounting_journals(id) ON DELETE CASCADE;


--
-- Name: accounting_journals accounting_journals_entity_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: autoguru
--

ALTER TABLE ONLY public.accounting_journals
    ADD CONSTRAINT accounting_journals_entity_id_fkey FOREIGN KEY (entity_id) REFERENCES public.accounting_entities(id);


--
-- Name: accounting_standard_accounts accounting_standard_accounts_parent_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: autoguru
--

ALTER TABLE ONLY public.accounting_standard_accounts
    ADD CONSTRAINT accounting_standard_accounts_parent_id_fkey FOREIGN KEY (parent_id) REFERENCES public.accounting_standard_accounts(id);


--
-- Name: call_recordings call_recordings_call_session_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: autoguru
--

ALTER TABLE ONLY public.call_recordings
    ADD CONSTRAINT call_recordings_call_session_id_fkey FOREIGN KEY (call_session_id) REFERENCES public.call_sessions(id) ON DELETE CASCADE;


--
-- Name: cars cars_company_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: autoguru
--

ALTER TABLE ONLY public.cars
    ADD CONSTRAINT cars_company_id_fkey FOREIGN KEY (company_id) REFERENCES public.companies(id) ON DELETE CASCADE;


--
-- Name: company_contacts company_contacts_company_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: autoguru
--

ALTER TABLE ONLY public.company_contacts
    ADD CONSTRAINT company_contacts_company_id_fkey FOREIGN KEY (company_id) REFERENCES public.companies(id) ON DELETE CASCADE;


--
-- Name: company_integrations company_integrations_channel_key_fkey; Type: FK CONSTRAINT; Schema: public; Owner: autoguru
--

ALTER TABLE ONLY public.company_integrations
    ADD CONSTRAINT company_integrations_channel_key_fkey FOREIGN KEY (channel_key) REFERENCES public.integration_channels(key);


--
-- Name: customer_car_links customer_car_links_car_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: autoguru
--

ALTER TABLE ONLY public.customer_car_links
    ADD CONSTRAINT customer_car_links_car_id_fkey FOREIGN KEY (car_id) REFERENCES public.cars(id) ON DELETE CASCADE;


--
-- Name: customer_car_links customer_car_links_company_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: autoguru
--

ALTER TABLE ONLY public.customer_car_links
    ADD CONSTRAINT customer_car_links_company_id_fkey FOREIGN KEY (company_id) REFERENCES public.companies(id) ON DELETE CASCADE;


--
-- Name: customer_car_links customer_car_links_customer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: autoguru
--

ALTER TABLE ONLY public.customer_car_links
    ADD CONSTRAINT customer_car_links_customer_id_fkey FOREIGN KEY (customer_id) REFERENCES public.customers(id) ON DELETE CASCADE;


--
-- Name: customers customers_company_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: autoguru
--

ALTER TABLE ONLY public.customers
    ADD CONSTRAINT customers_company_id_fkey FOREIGN KEY (company_id) REFERENCES public.companies(id) ON DELETE CASCADE;


--
-- Name: employee_allowances employee_allowances_employee_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: autoguru
--

ALTER TABLE ONLY public.employee_allowances
    ADD CONSTRAINT employee_allowances_employee_id_fkey FOREIGN KEY (employee_id) REFERENCES public.employees(id) ON DELETE CASCADE;


--
-- Name: estimate_items estimate_items_estimate_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: autoguru
--

ALTER TABLE ONLY public.estimate_items
    ADD CONSTRAINT estimate_items_estimate_id_fkey FOREIGN KEY (estimate_id) REFERENCES public.estimates(id) ON DELETE CASCADE;


--
-- Name: fleet_vehicles fleet_vehicles_inventory_location_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: autoguru
--

ALTER TABLE ONLY public.fleet_vehicles
    ADD CONSTRAINT fleet_vehicles_inventory_location_id_fkey FOREIGN KEY (inventory_location_id) REFERENCES public.inventory_locations(id);


--
-- Name: gatepasses gatepasses_invoice_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: autoguru
--

ALTER TABLE ONLY public.gatepasses
    ADD CONSTRAINT gatepasses_invoice_id_fkey FOREIGN KEY (invoice_id) REFERENCES public.invoices(id) ON DELETE CASCADE;


--
-- Name: gatepasses gatepasses_quality_check_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: autoguru
--

ALTER TABLE ONLY public.gatepasses
    ADD CONSTRAINT gatepasses_quality_check_id_fkey FOREIGN KEY (quality_check_id) REFERENCES public.quality_checks(id);


--
-- Name: gatepasses gatepasses_work_order_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: autoguru
--

ALTER TABLE ONLY public.gatepasses
    ADD CONSTRAINT gatepasses_work_order_id_fkey FOREIGN KEY (work_order_id) REFERENCES public.work_orders(id) ON DELETE CASCADE;


--
-- Name: inspection_items inspection_items_inspection_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: autoguru
--

ALTER TABLE ONLY public.inspection_items
    ADD CONSTRAINT inspection_items_inspection_id_fkey FOREIGN KEY (inspection_id) REFERENCES public.inspections(id) ON DELETE CASCADE;


--
-- Name: inspection_media inspection_media_inspection_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: autoguru
--

ALTER TABLE ONLY public.inspection_media
    ADD CONSTRAINT inspection_media_inspection_id_fkey FOREIGN KEY (inspection_id) REFERENCES public.inspections(id) ON DELETE CASCADE;


--
-- Name: inspection_versions inspection_versions_inspection_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: autoguru
--

ALTER TABLE ONLY public.inspection_versions
    ADD CONSTRAINT inspection_versions_inspection_id_fkey FOREIGN KEY (inspection_id) REFERENCES public.inspections(id) ON DELETE CASCADE;


--
-- Name: integration_dialer_metadata integration_dialer_metadata_dialer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: autoguru
--

ALTER TABLE ONLY public.integration_dialer_metadata
    ADD CONSTRAINT integration_dialer_metadata_dialer_id_fkey FOREIGN KEY (dialer_id) REFERENCES public.integration_dialers(id) ON DELETE CASCADE;


--
-- Name: integration_dialer_webhooks integration_dialer_webhooks_dialer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: autoguru
--

ALTER TABLE ONLY public.integration_dialer_webhooks
    ADD CONSTRAINT integration_dialer_webhooks_dialer_id_fkey FOREIGN KEY (dialer_id) REFERENCES public.integration_dialers(id) ON DELETE CASCADE;


--
-- Name: inventory_movements inventory_movements_part_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: autoguru
--

ALTER TABLE ONLY public.inventory_movements
    ADD CONSTRAINT inventory_movements_part_id_fkey FOREIGN KEY (part_id) REFERENCES public.parts_catalog(id);


--
-- Name: inventory_stock inventory_stock_part_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: autoguru
--

ALTER TABLE ONLY public.inventory_stock
    ADD CONSTRAINT inventory_stock_part_id_fkey FOREIGN KEY (part_id) REFERENCES public.parts_catalog(id) ON DELETE RESTRICT;


--
-- Name: invoice_items invoice_items_estimate_item_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: autoguru
--

ALTER TABLE ONLY public.invoice_items
    ADD CONSTRAINT invoice_items_estimate_item_id_fkey FOREIGN KEY (estimate_item_id) REFERENCES public.estimate_items(id) ON DELETE SET NULL;


--
-- Name: invoice_items invoice_items_invoice_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: autoguru
--

ALTER TABLE ONLY public.invoice_items
    ADD CONSTRAINT invoice_items_invoice_id_fkey FOREIGN KEY (invoice_id) REFERENCES public.invoices(id) ON DELETE CASCADE;


--
-- Name: invoice_items invoice_items_work_order_item_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: autoguru
--

ALTER TABLE ONLY public.invoice_items
    ADD CONSTRAINT invoice_items_work_order_item_id_fkey FOREIGN KEY (work_order_item_id) REFERENCES public.work_order_items(id) ON DELETE SET NULL;


--
-- Name: invoices invoices_estimate_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: autoguru
--

ALTER TABLE ONLY public.invoices
    ADD CONSTRAINT invoices_estimate_id_fkey FOREIGN KEY (estimate_id) REFERENCES public.estimates(id);


--
-- Name: invoices invoices_inspection_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: autoguru
--

ALTER TABLE ONLY public.invoices
    ADD CONSTRAINT invoices_inspection_id_fkey FOREIGN KEY (inspection_id) REFERENCES public.inspections(id);


--
-- Name: invoices invoices_quality_check_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: autoguru
--

ALTER TABLE ONLY public.invoices
    ADD CONSTRAINT invoices_quality_check_id_fkey FOREIGN KEY (quality_check_id) REFERENCES public.quality_checks(id);


--
-- Name: invoices invoices_work_order_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: autoguru
--

ALTER TABLE ONLY public.invoices
    ADD CONSTRAINT invoices_work_order_id_fkey FOREIGN KEY (work_order_id) REFERENCES public.work_orders(id);


--
-- Name: lead_events lead_events_actor_employee_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: autoguru
--

ALTER TABLE ONLY public.lead_events
    ADD CONSTRAINT lead_events_actor_employee_id_fkey FOREIGN KEY (actor_employee_id) REFERENCES public.employees(id) ON DELETE SET NULL;


--
-- Name: lead_events lead_events_actor_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: autoguru
--

ALTER TABLE ONLY public.lead_events
    ADD CONSTRAINT lead_events_actor_user_id_fkey FOREIGN KEY (actor_user_id) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: lead_events lead_events_company_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: autoguru
--

ALTER TABLE ONLY public.lead_events
    ADD CONSTRAINT lead_events_company_id_fkey FOREIGN KEY (company_id) REFERENCES public.companies(id) ON DELETE CASCADE;


--
-- Name: lead_events lead_events_lead_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: autoguru
--

ALTER TABLE ONLY public.lead_events
    ADD CONSTRAINT lead_events_lead_id_fkey FOREIGN KEY (lead_id) REFERENCES public.leads(id) ON DELETE CASCADE;


--
-- Name: leads leads_agent_employee_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: autoguru
--

ALTER TABLE ONLY public.leads
    ADD CONSTRAINT leads_agent_employee_id_fkey FOREIGN KEY (agent_employee_id) REFERENCES public.employees(id) ON DELETE SET NULL;


--
-- Name: leads leads_car_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: autoguru
--

ALTER TABLE ONLY public.leads
    ADD CONSTRAINT leads_car_id_fkey FOREIGN KEY (car_id) REFERENCES public.cars(id) ON DELETE SET NULL;


--
-- Name: leads leads_company_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: autoguru
--

ALTER TABLE ONLY public.leads
    ADD CONSTRAINT leads_company_id_fkey FOREIGN KEY (company_id) REFERENCES public.companies(id) ON DELETE CASCADE;


--
-- Name: leads leads_customer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: autoguru
--

ALTER TABLE ONLY public.leads
    ADD CONSTRAINT leads_customer_id_fkey FOREIGN KEY (customer_id) REFERENCES public.customers(id) ON DELETE SET NULL;


--
-- Name: purchase_order_items purchase_order_items_purchase_order_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: autoguru
--

ALTER TABLE ONLY public.purchase_order_items
    ADD CONSTRAINT purchase_order_items_purchase_order_id_fkey FOREIGN KEY (purchase_order_id) REFERENCES public.purchase_orders(id) ON DELETE CASCADE;


--
-- Name: quality_check_items quality_check_items_quality_check_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: autoguru
--

ALTER TABLE ONLY public.quality_check_items
    ADD CONSTRAINT quality_check_items_quality_check_id_fkey FOREIGN KEY (quality_check_id) REFERENCES public.quality_checks(id) ON DELETE CASCADE;


--
-- Name: quality_check_items quality_check_items_work_order_item_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: autoguru
--

ALTER TABLE ONLY public.quality_check_items
    ADD CONSTRAINT quality_check_items_work_order_item_id_fkey FOREIGN KEY (work_order_item_id) REFERENCES public.work_order_items(id) ON DELETE CASCADE;


--
-- Name: quality_checks quality_checks_estimate_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: autoguru
--

ALTER TABLE ONLY public.quality_checks
    ADD CONSTRAINT quality_checks_estimate_id_fkey FOREIGN KEY (estimate_id) REFERENCES public.estimates(id);


--
-- Name: quality_checks quality_checks_inspection_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: autoguru
--

ALTER TABLE ONLY public.quality_checks
    ADD CONSTRAINT quality_checks_inspection_id_fkey FOREIGN KEY (inspection_id) REFERENCES public.inspections(id);


--
-- Name: quality_checks quality_checks_work_order_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: autoguru
--

ALTER TABLE ONLY public.quality_checks
    ADD CONSTRAINT quality_checks_work_order_id_fkey FOREIGN KEY (work_order_id) REFERENCES public.work_orders(id) ON DELETE CASCADE;


--
-- Name: quote_items quote_items_quote_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: autoguru
--

ALTER TABLE ONLY public.quote_items
    ADD CONSTRAINT quote_items_quote_id_fkey FOREIGN KEY (quote_id) REFERENCES public.quotes(id) ON DELETE CASCADE;


--
-- Name: role_permissions role_permissions_permission_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: autoguru
--

ALTER TABLE ONLY public.role_permissions
    ADD CONSTRAINT role_permissions_permission_id_fkey FOREIGN KEY (permission_id) REFERENCES public.permissions(id) ON DELETE CASCADE;


--
-- Name: role_permissions role_permissions_role_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: autoguru
--

ALTER TABLE ONLY public.role_permissions
    ADD CONSTRAINT role_permissions_role_id_fkey FOREIGN KEY (role_id) REFERENCES public.roles(id) ON DELETE CASCADE;


--
-- Name: user_activity_logs user_activity_logs_session_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: autoguru
--

ALTER TABLE ONLY public.user_activity_logs
    ADD CONSTRAINT user_activity_logs_session_id_fkey FOREIGN KEY (session_id) REFERENCES public.user_sessions(id);


--
-- Name: user_activity_logs user_activity_logs_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: autoguru
--

ALTER TABLE ONLY public.user_activity_logs
    ADD CONSTRAINT user_activity_logs_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id);


--
-- Name: user_change_history user_change_history_session_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: autoguru
--

ALTER TABLE ONLY public.user_change_history
    ADD CONSTRAINT user_change_history_session_id_fkey FOREIGN KEY (session_id) REFERENCES public.user_sessions(id);


--
-- Name: user_change_history user_change_history_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: autoguru
--

ALTER TABLE ONLY public.user_change_history
    ADD CONSTRAINT user_change_history_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id);


--
-- Name: user_risk_profiles user_risk_profiles_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: autoguru
--

ALTER TABLE ONLY public.user_risk_profiles
    ADD CONSTRAINT user_risk_profiles_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id);


--
-- Name: user_roles user_roles_role_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: autoguru
--

ALTER TABLE ONLY public.user_roles
    ADD CONSTRAINT user_roles_role_id_fkey FOREIGN KEY (role_id) REFERENCES public.roles(id) ON DELETE CASCADE;


--
-- Name: user_roles user_roles_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: autoguru
--

ALTER TABLE ONLY public.user_roles
    ADD CONSTRAINT user_roles_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: user_sessions user_sessions_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: autoguru
--

ALTER TABLE ONLY public.user_sessions
    ADD CONSTRAINT user_sessions_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id);


--
-- Name: vendor_bank_accounts vendor_bank_accounts_vendor_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: autoguru
--

ALTER TABLE ONLY public.vendor_bank_accounts
    ADD CONSTRAINT vendor_bank_accounts_vendor_id_fkey FOREIGN KEY (vendor_id) REFERENCES public.vendors(id) ON DELETE CASCADE;


--
-- Name: vendor_contacts vendor_contacts_vendor_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: autoguru
--

ALTER TABLE ONLY public.vendor_contacts
    ADD CONSTRAINT vendor_contacts_vendor_id_fkey FOREIGN KEY (vendor_id) REFERENCES public.vendors(id) ON DELETE CASCADE;


--
-- Name: vendors vendors_company_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: autoguru
--

ALTER TABLE ONLY public.vendors
    ADD CONSTRAINT vendors_company_id_fkey FOREIGN KEY (company_id) REFERENCES public.companies(id) ON DELETE CASCADE;


--
-- Name: work_order_items work_order_items_estimate_item_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: autoguru
--

ALTER TABLE ONLY public.work_order_items
    ADD CONSTRAINT work_order_items_estimate_item_id_fkey FOREIGN KEY (estimate_item_id) REFERENCES public.estimate_items(id) ON DELETE RESTRICT;


--
-- Name: work_order_items work_order_items_work_order_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: autoguru
--

ALTER TABLE ONLY public.work_order_items
    ADD CONSTRAINT work_order_items_work_order_id_fkey FOREIGN KEY (work_order_id) REFERENCES public.work_orders(id) ON DELETE CASCADE;


--
-- Name: work_order_media work_order_media_work_order_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: autoguru
--

ALTER TABLE ONLY public.work_order_media
    ADD CONSTRAINT work_order_media_work_order_id_fkey FOREIGN KEY (work_order_id) REFERENCES public.work_orders(id) ON DELETE CASCADE;


--
-- Name: work_order_media work_order_media_work_order_item_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: autoguru
--

ALTER TABLE ONLY public.work_order_media
    ADD CONSTRAINT work_order_media_work_order_item_id_fkey FOREIGN KEY (work_order_item_id) REFERENCES public.work_order_items(id) ON DELETE CASCADE;


--
-- PostgreSQL database dump complete
--

\unrestrict fBWCJMOBQreAeRySa5Al3ox8dRFW5KA5yU6eTFEM5S3bwrstnrxuaronlcTzGWk

