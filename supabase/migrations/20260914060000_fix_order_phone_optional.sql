-- FINAL checkout fix:
-- The phone number is optional. Empty phone values are stored as NULL.
-- This migration does not delete or rebuild existing data.

ALTER TABLE public.orders
  ALTER COLUMN customer_phone DROP NOT NULL;

-- IMPORTANT: place_order itself must also stop rejecting an empty phone.
CREATE OR REPLACE FUNCTION public.place_order(
  _customer_name text,
  _customer_phone text,
  _address text,
  _notes text,
  _items jsonb,
  _delivery_time_id uuid DEFAULT NULL,
  _delivery_location_id uuid DEFAULT NULL,
  _booking_day integer DEFAULT NULL
)
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
  v_time_day integer;
  v_location_name text;
  v_day integer;
  v_today integer;
  v_check_day integer;
  v_has_days boolean;
  v_has_times boolean;
  v_addon_count integer;
BEGIN
  IF length(btrim(coalesce(_customer_name,''))) < 2 THEN
    RAISE EXCEPTION 'invalid_name';
  END IF;

  IF _items IS NULL OR jsonb_array_length(_items) = 0 OR jsonb_array_length(_items) > 60 THEN
    RAISE EXCEPTION 'invalid_items';
  END IF;

  v_today := extract(dow from (now() AT TIME ZONE 'Asia/Aden'))::int;

  IF _delivery_time_id IS NOT NULL THEN
    SELECT label, day_of_week
    INTO v_time_label, v_time_day
    FROM public.delivery_times
    WHERE id = _delivery_time_id AND is_active;

    IF v_time_label IS NULL THEN
      RAISE EXCEPTION 'invalid_delivery_time';
    END IF;
  END IF;

  IF _delivery_location_id IS NOT NULL THEN
    SELECT name
    INTO v_location_name
    FROM public.delivery_locations
    WHERE id = _delivery_location_id AND is_active;

    IF v_location_name IS NULL THEN
      RAISE EXCEPTION 'invalid_delivery_location';
    END IF;
  END IF;

  v_day := coalesce(v_time_day, _booking_day);

  IF v_day IS NOT NULL AND (v_day < 0 OR v_day > 6) THEN
    RAISE EXCEPTION 'invalid_booking_day';
  END IF;

  v_check_day := coalesce(v_day, v_today);

  INSERT INTO public.orders (
    customer_name,
    customer_phone,
    address,
    notes,
    total,
    delivery_time,
    delivery_location,
    booking_day
  )
  VALUES (
    left(btrim(_customer_name), 80),
    nullif(left(btrim(coalesce(_customer_phone, '')), 20), ''),
    nullif(left(btrim(coalesce(_address,'')), 200), ''),
    nullif(left(btrim(coalesce(_notes,'')), 300), ''),
    0,
    v_time_label,
    v_location_name,
    v_day
  )
  RETURNING id, order_number INTO v_order_id, v_order_number;

  FOR v_item IN SELECT * FROM jsonb_array_elements(_items) LOOP
    SELECT * INTO v_product
    FROM public.products
    WHERE id = (v_item->>'product_id')::uuid;

    IF v_product.id IS NULL OR NOT v_product.is_available THEN
      RAISE EXCEPTION 'invalid_product';
    END IF;

    SELECT EXISTS (
      SELECT 1
      FROM public.product_booking_days
      WHERE product_id = v_product.id
    ) INTO v_has_days;

    IF v_has_days AND NOT EXISTS (
      SELECT 1
      FROM public.product_booking_days
      WHERE product_id = v_product.id
        AND day_of_week = v_check_day
    ) THEN
      RAISE EXCEPTION 'product_day_unavailable';
    END IF;

    SELECT EXISTS (
      SELECT 1
      FROM public.product_delivery_times pdt
      JOIN public.delivery_times dt
        ON dt.id = pdt.delivery_time_id
       AND dt.is_active
      WHERE pdt.product_id = v_product.id
    ) INTO v_has_times;

    IF v_has_times THEN
      IF _delivery_time_id IS NULL OR NOT EXISTS (
        SELECT 1
        FROM public.product_delivery_times
        WHERE product_id = v_product.id
          AND delivery_time_id = _delivery_time_id
      ) THEN
        RAISE EXCEPTION 'product_time_unavailable';
      END IF;
    END IF;

    v_qty := greatest(1, least(99, coalesce((v_item->>'quantity')::int, 1)));
    v_addon_total := 0;
    v_addons := '[]'::jsonb;
    v_addon_count := 0;

    IF v_item ? 'addon_ids' THEN
      FOR v_addon IN SELECT * FROM jsonb_array_elements(v_item->'addon_ids') LOOP
        SELECT * INTO v_addon_row
        FROM public.addons
        WHERE id = (v_addon #>> '{}')::uuid
          AND is_active
          AND EXISTS (
            SELECT 1
            FROM public.product_addons pa
            WHERE pa.addon_id = addons.id
              AND pa.product_id = v_product.id
          );

        IF v_addon_row.id IS NULL THEN
          RAISE EXCEPTION 'invalid_addon';
        END IF;

        v_addon_count := v_addon_count + 1;
        v_addon_total := v_addon_total + v_addon_row.price;
        v_addons := v_addons || jsonb_build_array(
          jsonb_build_object(
            'id', v_addon_row.id,
            'name', v_addon_row.name,
            'price', v_addon_row.price
          )
        );
      END LOOP;
    END IF;

    IF v_product.addons_required
       AND v_addon_count = 0
       AND EXISTS (
         SELECT 1
         FROM public.product_addons pa
         JOIN public.addons a
           ON a.id = pa.addon_id
          AND a.is_active
         WHERE pa.product_id = v_product.id
       )
    THEN
      RAISE EXCEPTION 'addon_required';
    END IF;

    v_line := (v_product.price + v_addon_total) * v_qty;
    v_total := v_total + v_line;

    INSERT INTO public.order_items (
      order_id,
      product_id,
      product_name,
      unit_price,
      quantity,
      addons,
      line_total
    )
    VALUES (
      v_order_id,
      v_product.id,
      v_product.name,
      v_product.price,
      v_qty,
      v_addons,
      v_line
    );
  END LOOP;

  UPDATE public.orders
  SET total = v_total
  WHERE id = v_order_id;

  RETURN v_order_number;
END;
$function$;

REVOKE ALL ON FUNCTION public.place_order(text,text,text,text,jsonb,uuid,uuid,integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.place_order(text,text,text,text,jsonb,uuid,uuid,integer) TO anon, authenticated;

-- Keep the payment wrapper compatible with the checkout client.
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
    nullif(btrim(coalesce(_customer_phone, '')), ''),
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
