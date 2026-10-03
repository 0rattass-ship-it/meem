ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS orders_user_id_idx ON public.orders(user_id, created_at DESC);

CREATE OR REPLACE FUNCTION public.set_order_user_id()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.user_id IS NULL THEN NEW.user_id := auth.uid(); END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS t_orders_set_user ON public.orders;
CREATE TRIGGER t_orders_set_user BEFORE INSERT ON public.orders FOR EACH ROW EXECUTE FUNCTION public.set_order_user_id();

CREATE OR REPLACE FUNCTION public.get_my_orders()
RETURNS TABLE(order_number integer, created_at timestamptz, status order_status, booking_day integer, delivery_time text, total numeric)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT o.order_number, o.created_at, o.status, o.booking_day, o.delivery_time, o.total
  FROM public.orders o WHERE auth.uid() IS NOT NULL AND o.user_id = auth.uid()
  ORDER BY o.created_at DESC LIMIT 20;
$$;
REVOKE ALL ON FUNCTION public.get_my_orders() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_my_orders() TO authenticated;

CREATE OR REPLACE FUNCTION public.get_my_order_tracking(_order_number integer)
RETURNS TABLE(order_number integer, customer_name text, total numeric, status order_status, payment_method text, payment_status text, payment_window text, booking_day integer, delivery_time text, created_at timestamptz)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT o.order_number, o.customer_name, o.total, o.status, o.payment_method, o.payment_status, o.payment_window, o.booking_day, o.delivery_time, o.created_at
  FROM public.orders o
  WHERE o.order_number = _order_number AND auth.uid() IS NOT NULL AND o.user_id = auth.uid()
  LIMIT 1;
$$;
REVOKE ALL ON FUNCTION public.get_my_order_tracking(integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_my_order_tracking(integer) TO authenticated;