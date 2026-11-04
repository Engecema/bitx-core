BEGIN;

CREATE TABLE IF NOT EXISTS public.transfers (
  id text PRIMARY KEY,
  txid text,
  client_id text,
  type text NOT NULL,
  amount_gx double precision NOT NULL,
  amount_brl double precision NOT NULL,
  counterparty text,
  source_platform text DEFAULT 'BitX Core Mainnet',
  target_platform text DEFAULT 'Global Exchange',
  status text DEFAULT 'Confirmado em Custódia',
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.clients
  ADD COLUMN IF NOT EXISTS name text,
  ADD COLUMN IF NOT EXISTS email text,
  ADD COLUMN IF NOT EXISTS status text,
  ADD COLUMN IF NOT EXISTS btxc_balance double precision NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS brl_balance double precision NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transfers ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE
  existing_policy record;
BEGIN
  FOR existing_policy IN
    SELECT tablename, policyname
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename IN ('clients', 'transfers')
  LOOP
    EXECUTE format(
      'DROP POLICY IF EXISTS %I ON public.%I',
      existing_policy.policyname,
      existing_policy.tablename
    );
  END LOOP;
END $$;

REVOKE ALL ON TABLE public.clients, public.transfers FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE public.clients, public.transfers TO authenticated;
GRANT ALL ON TABLE public.clients, public.transfers TO service_role;

CREATE POLICY "bitx_admin_read_clients" ON public.clients
  FOR SELECT TO authenticated
  USING ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

CREATE POLICY "bitx_admin_read_transfers" ON public.transfers
  FOR SELECT TO authenticated
  USING ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

COMMIT;