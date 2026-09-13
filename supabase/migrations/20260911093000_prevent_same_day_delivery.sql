-- Never allow an order to use the current day as its delivery/booking day.
-- The client already selects the next available day; this server-side trigger
-- prevents bypassing that rule through direct RPC/API calls as well.
CREATE OR REPLACE FUNCTION public.prevent_same_day_delivery()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  v_today integer;
BEGIN
  v_today := extract(dow from (now() AT TIME ZONE 'Asia/Aden'))::int;

  IF NEW.booking_day IS NOT NULL AND NEW.booking_day = v_today THEN
    RAISE EXCEPTION 'same_day_delivery_not_allowed';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS orders_prevent_same_day_delivery ON public.orders;
CREATE TRIGGER orders_prevent_same_day_delivery
BEFORE INSERT ON public.orders
FOR EACH ROW
EXECUTE FUNCTION public.prevent_same_day_delivery();

REVOKE ALL ON FUNCTION public.prevent_same_day_delivery() FROM PUBLIC;
