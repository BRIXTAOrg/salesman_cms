-- BRIXTA SAFE V2: one-time additive registry migration (manual execution only).
-- Does not rename schemas, change company names or invalidate existing codes.
-- All 11 existing companies retain login through their schema_name while login_code is NULL.
-- Only execute after a verified full pg_dump backup; DB might be production.
BEGIN;
SET LOCAL lock_timeout = '5s';
ALTER TABLE public.organizations ADD COLUMN IF NOT EXISTS login_code text;
CREATE UNIQUE INDEX IF NOT EXISTS organizations_effective_login_code_key
  ON public.organizations (lower(coalesce(login_code, schema_name)));
COMMIT;
