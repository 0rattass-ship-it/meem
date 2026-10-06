ALTER TABLE public.store_information
  ADD COLUMN green_booking_instruction text NOT NULL DEFAULT '',
  ADD COLUMN green_delivery_instruction text NOT NULL DEFAULT '',
  ADD COLUMN beige_booking_instruction text NOT NULL DEFAULT '',
  ADD COLUMN beige_delivery_instruction text NOT NULL DEFAULT '';

COMMENT ON COLUMN public.store_information.booking_instruction IS 'DEPRECATED: replaced by green_booking_instruction and beige_booking_instruction';
COMMENT ON COLUMN public.store_information.delivery_instruction IS 'DEPRECATED: replaced by green_delivery_instruction and beige_delivery_instruction';