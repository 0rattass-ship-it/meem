DO $migration$
DECLARE definition text;
BEGIN
  SELECT pg_get_functiondef('public.place_order_with_receipt(text,text,text,jsonb,text,text,uuid,uuid,integer,text)'::regprocedure) INTO definition;
  definition := replace(definition, '_delivery_time_id uuid, _delivery_location_id uuid, _booking_day integer, _receipt_path text)', '_delivery_time_id uuid DEFAULT NULL::uuid, _delivery_location_id uuid DEFAULT NULL::uuid, _booking_day integer DEFAULT NULL::integer, _receipt_path text DEFAULT NULL::text)');
  EXECUTE definition;
END;
$migration$;