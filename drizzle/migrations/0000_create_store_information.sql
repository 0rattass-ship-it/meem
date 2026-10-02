CREATE TABLE public.store_information (
  id integer PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  content text NOT NULL DEFAULT '',
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

GRANT SELECT ON public.store_information TO anon, authenticated;
GRANT INSERT, UPDATE ON public.store_information TO authenticated;
GRANT ALL ON public.store_information TO service_role;

ALTER TABLE public.store_information ENABLE ROW LEVEL SECURITY;

CREATE POLICY "store information public read"
ON public.store_information
FOR SELECT
TO anon, authenticated
USING (id = 1);

CREATE POLICY "store information admin insert"
ON public.store_information
FOR INSERT
TO authenticated
WITH CHECK (id = 1 AND public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE POLICY "store information admin update"
ON public.store_information
FOR UPDATE
TO authenticated
USING (id = 1 AND public.has_role(auth.uid(), 'admin'::public.app_role))
WITH CHECK (id = 1 AND public.has_role(auth.uid(), 'admin'::public.app_role));