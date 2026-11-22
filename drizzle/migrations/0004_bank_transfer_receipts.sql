ALTER TABLE public.orders ADD COLUMN payment_receipt_path text;
CREATE UNIQUE INDEX orders_unique_payment_receipt ON public.orders(payment_receipt_path) WHERE payment_receipt_path IS NOT NULL;

CREATE POLICY "receipt customer upload" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'payment-receipts' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "receipt admin read" ON storage.objects FOR SELECT TO authenticated USING (bucket_id = 'payment-receipts' AND public.has_role(auth.uid(), 'admin'));

CREATE OR REPLACE FUNCTION public.place_order_with_payment(_customer_name text, _address text, _notes text, _items jsonb, _payment_method text, _tracking_token text, _delivery_time_id uuid DEFAULT NULL, _delivery_location_id uuid DEFAULT NULL, _booking_day integer DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $function$
DECLARE
  v_order_number integer;
  v_total numeric(10,2);
  v_payment_window text;
BEGIN
  IF _payment_method NOT IN ('bank_transfer', 'pay_at_store') THEN RAISE EXCEPTION 'invalid_payment_method'; END IF;
  IF _payment_method = 'bank_transfer' THEN RAISE EXCEPTION 'receipt_required'; END IF;
  IF _tracking_token IS NULL OR length(_tracking_token) < 32 OR length(_tracking_token) > 128 THEN RAISE EXCEPTION 'invalid_tracking_token'; END IF;
  IF _payment_method = 'pay_at_store' THEN
    SELECT payment_window INTO v_payment_window FROM public.payment_settings WHERE id = 1;
    IF coalesce(btrim(v_payment_window), '') = '' THEN RAISE EXCEPTION 'payment_window_not_configured'; END IF;
  END IF;
  v_order_number := public.place_order(_customer_name, _address, _notes, _items, _delivery_time_id, _delivery_location_id, _booking_day);
  UPDATE public.orders SET payment_method = _payment_method, payment_status = CASE WHEN _payment_method = 'bank_transfer' THEN 'pending_bank_transfer' ELSE 'pending_store_payment' END, payment_window = v_payment_window, tracking_token_hash = encode(extensions.digest(_tracking_token::text, 'sha256'::text), 'hex') WHERE order_number = v_order_number;
  SELECT total INTO v_total FROM public.orders WHERE order_number = v_order_number;
  RETURN jsonb_build_object('order_number', v_order_number, 'total', v_total, 'payment_method', _payment_method, 'payment_window', v_payment_window);
END;
$function$;

CREATE FUNCTION public.place_order_with_receipt(_customer_name text, _address text, _notes text, _items jsonb, _payment_method text, _tracking_token text, _delivery_time_id uuid, _delivery_location_id uuid, _booking_day integer, _receipt_path text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $function$
DECLARE
  v_order_number integer;
  v_total numeric(10,2);
BEGIN
  IF _payment_method = 'pay_at_store' THEN
    RETURN public.place_order_with_payment(_customer_name, _address, _notes, _items, _payment_method, _tracking_token, _delivery_time_id, _delivery_location_id, _booking_day);
  END IF;
  IF _payment_method IS DISTINCT FROM 'bank_transfer' THEN RAISE EXCEPTION 'invalid_payment_method'; END IF;
  IF auth.uid() IS NULL OR coalesce(_receipt_path, '') = '' THEN RAISE EXCEPTION 'receipt_required'; END IF;
  IF _tracking_token IS NULL OR length(_tracking_token) < 32 OR length(_tracking_token) > 128 THEN RAISE EXCEPTION 'invalid_tracking_token'; END IF;
  IF split_part(_receipt_path, '/', 1) <> auth.uid()::text THEN RAISE EXCEPTION 'invalid_receipt'; END IF;
  PERFORM 1 FROM storage.objects WHERE bucket_id = 'payment-receipts' AND name = _receipt_path AND metadata->>'mimetype' IN ('image/jpeg', 'image/png', 'image/webp') AND (metadata->>'size')::bigint > 0 AND (metadata->>'size')::bigint <= 10485760 FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'receipt_not_uploaded'; END IF;
  IF EXISTS (SELECT 1 FROM public.orders WHERE payment_receipt_path = _receipt_path) THEN RAISE EXCEPTION 'receipt_already_used'; END IF;
  v_order_number := public.place_order(_customer_name, _address, _notes, _items, _delivery_time_id, _delivery_location_id, _booking_day);
  UPDATE public.orders SET payment_method = 'bank_transfer', payment_status = 'pending_bank_transfer', tracking_token_hash = encode(extensions.digest(_tracking_token::text, 'sha256'::text), 'hex'), payment_receipt_path = _receipt_path WHERE order_number = v_order_number;
  SELECT total INTO v_total FROM public.orders WHERE order_number = v_order_number;
  RETURN jsonb_build_object('order_number', v_order_number, 'total', v_total, 'payment_method', 'bank_transfer', 'payment_window', NULL);
END;
$function$;
REVOKE ALL ON FUNCTION public.place_order_with_receipt(text,text,text,jsonb,text,text,uuid,uuid,integer,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.place_order_with_receipt(text,text,text,jsonb,text,text,uuid,uuid,integer,text) TO authenticated;
