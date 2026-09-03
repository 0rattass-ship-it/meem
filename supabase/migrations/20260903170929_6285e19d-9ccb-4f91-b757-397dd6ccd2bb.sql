CREATE TYPE public.product_badge AS ENUM ('none', 'always', 'reservation');

ALTER TABLE public.products
  ADD COLUMN badge public.product_badge NOT NULL DEFAULT 'none';