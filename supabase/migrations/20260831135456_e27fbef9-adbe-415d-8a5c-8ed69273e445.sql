DROP POLICY IF EXISTS "orders guest insert" ON public.orders;
DROP POLICY IF EXISTS "order_items guest insert" ON public.order_items;
REVOKE INSERT ON public.orders FROM anon;
REVOKE INSERT ON public.order_items FROM anon;

CREATE OR REPLACE FUNCTION public.place_order(
  _customer_name text,
  _customer_phone text,
  _address text,
  _notes text,
  _items jsonb
) RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
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

  INSERT INTO public.orders (customer_name, customer_phone, address, notes, total)
  VALUES (
    left(btrim(_customer_name), 80),
    left(btrim(_customer_phone), 20),
    nullif(left(btrim(coalesce(_address,'')), 200), ''),
    nullif(left(btrim(coalesce(_notes,'')), 300), ''),
    0
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
$$;

REVOKE ALL ON FUNCTION public.place_order(text, text, text, text, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.place_order(text, text, text, text, jsonb) TO anon, authenticated;