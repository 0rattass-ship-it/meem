ALTER TABLE public.products
  ADD COLUMN card_stripe_primary text NOT NULL DEFAULT 'green',
  ADD COLUMN card_stripe_secondary text NOT NULL DEFAULT 'beige';

ALTER TABLE public.products
  ADD CONSTRAINT products_card_stripe_primary_check
    CHECK (card_stripe_primary IN ('green', 'beige', 'hidden')),
  ADD CONSTRAINT products_card_stripe_secondary_check
    CHECK (card_stripe_secondary IN ('green', 'beige', 'hidden'));

ALTER TABLE public.store_information
  ADD COLUMN booking_instruction text NOT NULL DEFAULT '',
  ADD COLUMN delivery_instruction text NOT NULL DEFAULT '';

COMMENT ON COLUMN public.products.card_stripe_primary IS 'First vertical card stripe color selected by an admin.';
COMMENT ON COLUMN public.products.card_stripe_secondary IS 'Second vertical card stripe color selected by an admin.';
COMMENT ON COLUMN public.store_information.booking_instruction IS 'Customer-facing booking instruction shown in the instructions dialog.';
COMMENT ON COLUMN public.store_information.delivery_instruction IS 'Customer-facing delivery instruction shown in the instructions dialog.';