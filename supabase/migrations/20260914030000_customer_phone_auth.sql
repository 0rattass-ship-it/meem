-- Customer phone authentication and account-linked orders.
-- Existing orders remain intact; user_id is nullable so old orders are not changed.

CREATE TABLE IF NOT EXISTS public.customer_profiles (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  phone text NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE ON public.customer_profiles TO authenticated;
ALTER TABLE public.customer_profiles ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "customer profiles own read" ON public.customer_profiles;
CREATE POLICY "customer profiles own read" ON public.customer_profiles FOR SELECT TO authenticated USING (user_id = auth.uid());
DROP POLICY IF EXISTS "customer profiles own insert" ON public.customer_profiles;
CREATE POLICY "customer profiles own insert" ON public.customer_profiles FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
DROP POLICY IF EXISTS "customer profiles own update" ON public.customer_profiles;
CREATE POLICY "customer profiles own update" ON public.customer_profiles FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS orders_user_id_created_at_idx ON public.orders (user_id, created_at DESC);

CREATE OR REPLACE FUNCTION public.set_order_user_id()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.user_id IS NULL THEN
    NEW.user_id := auth.uid();
  END IF;
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS t_orders_set_user_id ON public.orders;
CREATE TRIGGER t_orders_set_user_id
BEFORE INSERT ON public.orders
FOR EACH ROW EXECUTE FUNCTION public.set_order_user_id();

DROP POLICY IF EXISTS "orders customer read" ON public.orders;
CREATE POLICY "orders customer read" ON public.orders
FOR SELECT TO authenticated
USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

CREATE OR REPLACE FUNCTION public.get_my_order_tracking(_order_number integer)
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
  SELECT o.order_number, o.customer_name, o.total, o.status,
         o.payment_method, o.payment_status, o.payment_window,
         o.booking_day, o.delivery_time, o.created_at
  FROM public.orders o
  WHERE o.order_number = _order_number
    AND o.user_id = auth.uid()
  LIMIT 1;
$function$;

REVOKE ALL ON FUNCTION public.get_my_order_tracking(integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_my_order_tracking(integer) TO authenticated;
