CREATE TABLE public.delivery_times (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  label text NOT NULL,
  sort_order integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.delivery_times TO authenticated;
GRANT SELECT ON public.delivery_times TO anon;
GRANT ALL ON public.delivery_times TO service_role;
ALTER TABLE public.delivery_times ENABLE ROW LEVEL SECURITY;
CREATE POLICY "delivery_times public read" ON public.delivery_times FOR SELECT TO anon, authenticated USING (is_active);
CREATE POLICY "delivery_times admin all" ON public.delivery_times FOR ALL TO authenticated USING (has_role(auth.uid(), 'admin')) WITH CHECK (has_role(auth.uid(), 'admin'));
CREATE TRIGGER t_delivery_times_updated BEFORE UPDATE ON public.delivery_times FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE TABLE public.delivery_locations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  note text,
  sort_order integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.delivery_locations TO authenticated;
GRANT SELECT ON public.delivery_locations TO anon;
GRANT ALL ON public.delivery_locations TO service_role;
ALTER TABLE public.delivery_locations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "delivery_locations public read" ON public.delivery_locations FOR SELECT TO anon, authenticated USING (is_active);
CREATE POLICY "delivery_locations admin all" ON public.delivery_locations FOR ALL TO authenticated USING (has_role(auth.uid(), 'admin')) WITH CHECK (has_role(auth.uid(), 'admin'));
CREATE TRIGGER t_delivery_locations_updated BEFORE UPDATE ON public.delivery_locations FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE TABLE public.booking_days (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  day_of_week integer NOT NULL UNIQUE,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.booking_days TO authenticated;
GRANT SELECT ON public.booking_days TO anon;
GRANT ALL ON public.booking_days TO service_role;
ALTER TABLE public.booking_days ENABLE ROW LEVEL SECURITY;
CREATE POLICY "booking_days public read" ON public.booking_days FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "booking_days admin all" ON public.booking_days FOR ALL TO authenticated USING (has_role(auth.uid(), 'admin')) WITH CHECK (has_role(auth.uid(), 'admin'));
CREATE TRIGGER t_booking_days_updated BEFORE UPDATE ON public.booking_days FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

INSERT INTO public.booking_days (day_of_week, is_active) VALUES (0,true),(1,true),(2,true),(3,true),(4,true),(5,true),(6,true);

ALTER TABLE public.orders
  ADD COLUMN delivery_time text,
  ADD COLUMN delivery_location text,
  ADD COLUMN booking_day integer;

CREATE OR REPLACE FUNCTION public.place_order(_customer_name text, _customer_phone text, _address text, _notes text, _items jsonb, _delivery_time_id uuid DEFAULT NULL, _delivery_location_id uuid DEFAULT NULL, _booking_day integer DEFAULT NULL)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_order_id uuid;
  v_order_number integer;
  v_item jsonb;
  v_product public.products;
  v_addon_total numeric(10,2);
  v_qty integer;
  v_line numeric(10,2);
  v_total numeric(10,2) := 0;
  v_addons jsonb;
  v_addon jsonb;
  v_addon_row public.addons;
  v_time_label text;
  v_location_name text;
  v_day integer;
BEGIN
  IF length(btrim(coalesce(_customer_name,''))) < 2 THEN
    RAISE EXCEPTION 'invalid_name';
  END IF;
  IF length(btrim(coalesce(_customer_phone,''))) < 5 THEN
    RAISE EXCEPTION 'invalid_phone';
  END IF;
  IF _items IS NULL OR jsonb_array_length(_items) = 0 OR jsonb_array_length(_items) > 60 THEN
    RAISE EXCEPTION 'invalid_items';
  END IF;

  IF _delivery_time_id IS NOT NULL THEN
    SELECT label INTO v_time_label FROM public.delivery_times WHERE id = _delivery_time_id AND is_active;
    IF v_time_label IS NULL THEN RAISE EXCEPTION 'invalid_delivery_time'; END IF;
  END IF;

  IF _delivery_location_id IS NOT NULL THEN
    SELECT name INTO v_location_name FROM public.delivery_locations WHERE id = _delivery_location_id AND is_active;
    IF v_location_name IS NULL THEN RAISE EXCEPTION 'invalid_delivery_location'; END IF;
  END IF;

  IF _booking_day IS NOT NULL THEN
    SELECT day_of_week INTO v_day FROM public.booking_days WHERE day_of_week = _booking_day AND is_active;
    IF v_day IS NULL THEN RAISE EXCEPTION 'invalid_booking_day'; END IF;
  END IF;

  INSERT INTO public.orders (customer_name, customer_phone, address, notes, total, delivery_time, delivery_location, booking_day)
  VALUES (
    left(btrim(_customer_name), 80),
    left(btrim(_customer_phone), 20),
    nullif(left(btrim(coalesce(_address,'')), 200), ''),
    nullif(left(btrim(coalesce(_notes,'')), 300), ''),
    0,
    v_time_label,
    v_location_name,
    v_day
  )
  RETURNING id, order_number INTO v_order_id, v_order_number;

  FOR v_item IN SELECT * FROM jsonb_array_elements(_items) LOOP
    SELECT * INTO v_product FROM public.products WHERE id = (v_item->>'product_id')::uuid;
    IF v_product.id IS NULL OR NOT v_product.is_available THEN
      RAISE EXCEPTION 'invalid_product';
    END IF;

    v_qty := greatest(1, least(99, coalesce((v_item->>'quantity')::int, 1)));
    v_addon_total := 0;
    v_addons := '[]'::jsonb;

    IF v_item ? 'addon_ids' THEN
      FOR v_addon IN SELECT * FROM jsonb_array_elements(v_item->'addon_ids') LOOP
        SELECT * INTO v_addon_row FROM public.addons
          WHERE id = (v_addon #>> '{}')::uuid AND is_active
            AND EXISTS (
              SELECT 1 FROM public.product_addons pa
              WHERE pa.addon_id = addons.id AND pa.product_id = v_product.id
            );
        IF v_addon_row.id IS NULL THEN
          RAISE EXCEPTION 'invalid_addon';
        END IF;
        v_addon_total := v_addon_total + v_addon_row.price;
        v_addons := v_addons || jsonb_build_array(
          jsonb_build_object('id', v_addon_row.id, 'name', v_addon_row.name, 'price', v_addon_row.price)
        );
      END LOOP;
    END IF;

    v_line := (v_product.price + v_addon_total) * v_qty;
    v_total := v_total + v_line;

    INSERT INTO public.order_items (order_id, product_id, product_name, unit_price, quantity, addons, line_total)
    VALUES (v_order_id, v_product.id, v_product.name, v_product.price, v_qty, v_addons, v_line);
  END LOOP;

  UPDATE public.orders SET total = v_total WHERE id = v_order_id;
  RETURN v_order_number;
END;
$function$;

REVOKE ALL ON FUNCTION public.place_order(text,text,text,text,jsonb,uuid,uuid,integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.place_order(text,text,text,text,jsonb,uuid,uuid,integer) TO anon, authenticated;