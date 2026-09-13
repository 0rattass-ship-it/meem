-- Anonymous store visitor analytics.
-- A visitor session is identified by a random client-generated ID and expires client-side
-- after 30 minutes of inactivity. No login or personal information is required.
CREATE TABLE IF NOT EXISTS public.visitor_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id text NOT NULL UNIQUE CHECK (length(session_id) BETWEEN 16 AND 128),
  first_seen timestamptz NOT NULL DEFAULT now(),
  last_seen timestamptz NOT NULL DEFAULT now(),
  visit_count integer NOT NULL DEFAULT 1 CHECK (visit_count > 0)
);

GRANT SELECT ON public.visitor_sessions TO authenticated;
GRANT ALL ON public.visitor_sessions TO service_role;
REVOKE ALL ON public.visitor_sessions FROM anon;

ALTER TABLE public.visitor_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "visitor analytics admin read" ON public.visitor_sessions
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE OR REPLACE FUNCTION public.record_visitor_session(_session_id text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF _session_id IS NULL OR length(btrim(_session_id)) < 16 OR length(btrim(_session_id)) > 128 THEN
    RETURN;
  END IF;

  INSERT INTO public.visitor_sessions (session_id)
  VALUES (btrim(_session_id))
  ON CONFLICT (session_id) DO UPDATE
    SET last_seen = now(),
        visit_count = public.visitor_sessions.visit_count + 1;
END;
$$;

REVOKE ALL ON FUNCTION public.record_visitor_session(text) FROM PUBLIC, authenticated;
GRANT EXECUTE ON FUNCTION public.record_visitor_session(text) TO anon;
