-- Manual payment methods, safe order tracking, and reliable admin statistics.
-- This migration is intentionally non-destructive: it only adds columns, a settings
-- row/table, and SECURITY DEFINER RPCs. It does not delete or reset existing data.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS public.payment_settings (
  id integer PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  account_holder_name text NOT NULL DEFAULT '',
  account_number text NOT NULL DEFAULT '',
  payment_window text NOT NULL DEFAULT '',
  updated_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO public.payment_settings (id)
VALUES (1)
ON CONFLICT (id) DO NOTHING;

GRANT SELECT ON public.payment_settings TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.payment_settings TO authenticated;
GRANT ALL ON public.payment_settings TO service_role;
ALTER TABLE public.payment_settings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "payment settings public read" ON public.payment_settings;
CREATE POLICY "payment settings public read" ON public.payment_settings
  FOR SELECT TO anon, authenticated USING (id = 1);
DROP POLICY IF EXISTS "payment settings admin write" ON public.payment_settings;
CREATE POLICY "payment settings admin write" ON public.payment_settings
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

DROP TRIGGER IF EXISTS t_payment_settings_updated ON public.payment_settings;
CREATE TRIGGER t_payment_settings_updated
BEFORE UPDATE ON public.payment_settings
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS payment_method text NOT NULL DEFAULT 'unknown',
  ADD COLUMN IF NOT EXISTS payment_status text NOT NULL DEFAULT 'unconfirmed',
  ADD COLUMN IF NOT EXISTS payment_window text,
  ADD COLUMN IF NOT EXISTS tracking_token_hash text;

ALTER TABLE public.orders
  DROP CONSTRAINT IF EXISTS orders_payment_method_check;
ALTER TABLE public.orders
  ADD CONSTRAINT orders_payment_method_check
  CHECK (payment_method IN ('unknown', 'bank_transfer', 'pay_at_store'));

ALTER TABLE public.orders
  DROP CONSTRAINT IF EXISTS orders_payment_status_check;
ALTER TABLE public.orders
  ADD CONSTRAINT orders_payment_status_check
  CHECK (payment_status IN ('unconfirmed', 'pending_bank_transfer', 'pending_store_payment', 'paid'));

CREATE UNIQUE INDEX IF NOT EXISTS orders_tracking_token_hash_key
  ON public.orders (tracking_token_hash)
  WHERE tracking_token_hash IS NOT NULL;

CREATE OR REPLACE FUNCTION public.place_order_with_payment(
  _customer_name text,
  _customer_phone text,
  _address text,
  _notes text,
  _items jsonb,
  _payment_method text,
  _tracking_token text,
  _delivery_time_id uuid DEFAULT NULL::uuid,
  _delivery_location_id uuid DEFAULT NULL::uuid,
  _booking_day integer DEFAULT NULL::integer
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_order_number integer;
  v_total numeric(10,2);
  v_payment_window text;
BEGIN
  IF _payment_method NOT IN ('bank_transfer', 'pay_at_store') THEN
    RAISE EXCEPTION 'invalid_payment_method';
  END IF;

  IF _tracking_token IS NULL OR length(_tracking_token) < 32 OR length(_tracking_token) > 128 THEN
    RAISE EXCEPTION 'invalid_tracking_token';
  END IF;

  IF _payment_method = 'pay_at_store' THEN
    SELECT payment_window INTO v_payment_window
    FROM public.payment_settings
    WHERE id = 1;
    IF coalesce(btrim(v_payment_window), '') = '' THEN
      RAISE EXCEPTION 'payment_window_not_configured';
    END IF;
  END IF;

  v_order_number := public.place_order(
    _customer_name,
    _customer_phone,
    _address,
    _notes,
    _items,
    _delivery_time_id,
    _delivery_location_id,
    _booking_day
  );

  UPDATE public.orders
  SET
    payment_method = _payment_method,
    payment_status = CASE
      WHEN _payment_method = 'bank_transfer' THEN 'pending_bank_transfer'
      ELSE 'pending_store_payment'
    END,
    payment_window = v_payment_window,
    tracking_token_hash = encode(digest(_tracking_token, 'sha256'), 'hex')
  WHERE order_number = v_order_number;

  SELECT total INTO v_total FROM public.orders WHERE order_number = v_order_number;

  RETURN jsonb_build_object(
    'order_number', v_order_number,
    'total', v_total,
    'payment_method', _payment_method,
    'payment_window', v_payment_window
  );
END;
$function$;

REVOKE ALL ON FUNCTION public.place_order_with_payment(text,text,text,text,jsonb,text,text,uuid,uuid,integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.place_order_with_payment(text,text,text,text,jsonb,text,text,uuid,uuid,integer) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.get_order_tracking(
  _order_number integer,
  _tracking_token text
)
RETURNS TABLE (
  order_number integer,
  customer_name text,
  total numeric,
  status public.order_status,
  payment_method text,
  payment_status text,
  payment_window text,
  created_at timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT
    o.order_number,
    o.customer_name,
    o.total,
    o.status,
    o.payment_method,
    o.payment_status,
    o.payment_window,
    o.created_at
  FROM public.orders o
  WHERE o.order_number = _order_number
    AND o.tracking_token_hash = encode(digest(_tracking_token, 'sha256'), 'hex')
  LIMIT 1;
$function$;

REVOKE ALL ON FUNCTION public.get_order_tracking(integer,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_order_tracking(integer,text) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.get_admin_statistics()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_month_start timestamptz := date_trunc('month', now());
  v_next_month_start timestamptz := v_month_start + interval '1 month';
  v_result jsonb;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'not_admin';
  END IF;

  WITH order_stats AS (
    SELECT
      count(*)::integer AS order_count,
      coalesce(sum(total), 0)::numeric AS revenue,
      count(*) FILTER (WHERE created_at >= v_month_start AND created_at < v_next_month_start)::integer AS month_order_count,
      coalesce(sum(total) FILTER (WHERE created_at >= v_month_start AND created_at < v_next_month_start), 0)::numeric AS month_revenue
    FROM public.orders
  ),
  visitor_stats AS (
    SELECT
      count(*)::integer AS unique_visitors,
      coalesce(sum(visit_count), 0)::bigint AS total_visits
    FROM public.visitor_sessions
  ),
  top_all AS (
    SELECT jsonb_agg(jsonb_build_array(product_name, jsonb_build_object(
      'quantity', quantity,
      'sales', sales
    )) ORDER BY quantity DESC, product_name ASC) AS value
    FROM (
      SELECT product_name, sum(quantity)::bigint AS quantity, coalesce(sum(line_total), 0)::numeric AS sales
      FROM public.order_items
      GROUP BY product_name
      ORDER BY sum(quantity) DESC, product_name ASC
      LIMIT 5
    ) x
  ),
  top_month AS (
    SELECT jsonb_agg(jsonb_build_array(product_name, jsonb_build_object(
      'quantity', quantity,
      'sales', sales
    )) ORDER BY quantity DESC, product_name ASC) AS value
    FROM (
      SELECT product_name, sum(quantity)::bigint AS quantity, coalesce(sum(line_total), 0)::numeric AS sales
      FROM public.order_items
      WHERE created_at >= v_month_start AND created_at < v_next_month_start
      GROUP BY product_name
      ORDER BY sum(quantity) DESC, product_name ASC
      LIMIT 5
    ) x
  )
  SELECT jsonb_build_object(
    'orderCount', os.order_count,
    'revenue', os.revenue,
    'monthOrderCount', os.month_order_count,
    'monthRevenue', os.month_revenue,
    'uniqueVisitors', vs.unique_visitors,
    'totalVisits', vs.total_visits,
    'topProducts', coalesce(ta.value, '[]'::jsonb),
    'monthTopProducts', coalesce(tm.value, '[]'::jsonb),
    'monthLabel', to_char(v_month_start AT TIME ZONE 'Asia/Aden', 'YYYY-MM')
  )
  INTO v_result
  FROM order_stats os, visitor_stats vs, top_all ta, top_month tm;

  RETURN v_result;
END;
$function$;

REVOKE ALL ON FUNCTION public.get_admin_statistics() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_admin_statistics() TO authenticated;
