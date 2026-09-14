-- Phone is intentionally not part of checkout anymore.
-- The existing customer_phone database column is preserved for historical data;
-- it is not requested, written, or displayed by the current checkout/admin UI.
-- The existing RPC keeps its optional phone parameter for backward compatibility.

-- Ensure empty/omitted phone can never block order creation.
CREATE OR REPLACE FUNCTION public.place_order_with_payment(
  _customer_name text,
  _customer_phone text DEFAULT NULL,
  _address text DEFAULT '',
  _notes text DEFAULT '',
  _items jsonb DEFAULT '[]'::jsonb,
  _payment_method text DEFAULT 'bank_transfer',
  _tracking_token text DEFAULT NULL,
  _delivery_time_id uuid DEFAULT NULL,
  _delivery_location_id uuid DEFAULT NULL,
  _booking_day integer DEFAULT NULL
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
    NULL,
    coalesce(_address, ''),
    coalesce(_notes, ''),
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

  SELECT total INTO v_total
  FROM public.orders
  WHERE order_number = v_order_number;

  IF v_total IS NULL THEN
    RAISE EXCEPTION 'order_not_created';
  END IF;

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
