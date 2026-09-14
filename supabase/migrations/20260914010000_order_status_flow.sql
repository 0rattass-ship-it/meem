-- Extended order status flow.
-- Existing enum values are intentionally kept so existing orders remain valid.
ALTER TYPE public.order_status ADD VALUE IF NOT EXISTS 'received';
ALTER TYPE public.order_status ADD VALUE IF NOT EXISTS 'reviewing';
ALTER TYPE public.order_status ADD VALUE IF NOT EXISTS 'accepted';
ALTER TYPE public.order_status ADD VALUE IF NOT EXISTS 'delivered';
