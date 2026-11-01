-- BRIXTA company-code separation. MANUAL/ONE-TIME database migration.
-- Run against the SHARED public control-plane database, not a tenant schema.
-- Back up the PostgreSQL database before applying.
-- This does NOT rename any schema or move records. New sign-up rows default
-- to their schema_name until an administrator chooses a different login_code.
BEGIN;
ALTER TABLE public.organizations ADD COLUMN IF NOT EXISTS login_code text;
CREATE UNIQUE INDEX IF NOT EXISTS organizations_effective_login_code_key
  ON public.organizations (lower(coalesce(login_code, schema_name)));
COMMIT;
