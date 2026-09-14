-- Show the booked delivery day/time when a customer tracks an order.
DROP FUNCTION IF EXISTS public.get_order_tracking(integer, text);

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
  booking_day integer,
  delivery_time text,
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
    o.booking_day,
    o.delivery_time,
    o.created_at
  FROM public.orders o
  WHERE o.order_number = _order_number
    AND o.tracking_token_hash = encode(digest(_tracking_token, 'sha256'), 'hex')
  LIMIT 1;
$function$;

REVOKE ALL ON FUNCTION public.get_order_tracking(integer, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_order_tracking(integer, text) TO anon, authenticated;
