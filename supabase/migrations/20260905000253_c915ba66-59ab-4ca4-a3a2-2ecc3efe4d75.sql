DROP FUNCTION IF EXISTS public.place_order(text, text, text, text, jsonb);

REVOKE ALL ON FUNCTION public.grant_first_admin() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.touch_updated_at() FROM PUBLIC, anon, authenticated;