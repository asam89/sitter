-- Lock the database down against Supabase's auto-generated REST API.
--
-- Supabase exposes every table in the `public` schema over PostgREST to anyone
-- holding the project URL and the (publishable) anon key. This app never uses
-- that API — it talks to Postgres directly as the `postgres` role, which
-- bypasses row-level security — so we enable RLS with no policies and drop the
-- API roles' access entirely.
--
-- Re-applied on every boot (see docker-entrypoint.sh) so tables added by a
-- later migration are covered without a manual step.
DO $$
DECLARE t record;
BEGIN
  FOR t IN SELECT tablename FROM pg_tables WHERE schemaname = 'public' LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t.tablename);
  END LOOP;
END $$;

DO $$
BEGIN
  -- These roles only exist on Supabase; skip the grants elsewhere (local dev).
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    REVOKE ALL ON ALL TABLES IN SCHEMA public FROM anon, authenticated;
    REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM anon, authenticated;
    REVOKE ALL ON ALL FUNCTIONS IN SCHEMA public FROM anon, authenticated;
    REVOKE USAGE ON SCHEMA public FROM anon, authenticated;
    ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON TABLES FROM anon, authenticated;
    ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON SEQUENCES FROM anon, authenticated;
  END IF;
END $$;
