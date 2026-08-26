-- BRIXTA PUBLIC CONTROL PLANE BOOTSTRAP v2
-- RUN ONCE as the database owner / Supabase SQL Editor.
--
-- After this one bootstrap, normal company signup provisions tenants automatically.
-- brixta_control is an internal DB schema; do NOT expose it through Supabase API schemas.

CREATE SCHEMA IF NOT EXISTS brixta_control;

CREATE TABLE IF NOT EXISTS public.accounts (
  id serial PRIMARY KEY,
  name varchar(220) NOT NULL,
  billing_email varchar(255),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.account_memberships (
  account_id integer NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  member_email varchar(255) NOT NULL,
  role varchar(50) NOT NULL DEFAULT 'owner',
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (account_id, member_email)
);

CREATE TABLE IF NOT EXISTS public.organization_subscriptions (
  organization_id integer PRIMARY KEY REFERENCES public.organizations(id) ON DELETE CASCADE,
  plan_key varchar(120),
  status varchar(40) NOT NULL DEFAULT 'active',
  billing_provider varchar(80),
  external_subscription_id varchar(255),
  configuration jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.organizations
  ADD COLUMN IF NOT EXISTS account_id integer;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'organizations_account_id_fkey'
  ) THEN
    ALTER TABLE public.organizations
      ADD CONSTRAINT organizations_account_id_fkey
      FOREIGN KEY (account_id)
      REFERENCES public.accounts(id)
      ON DELETE SET NULL;
  END IF;
END
$$;

CREATE INDEX IF NOT EXISTS idx_organizations_account_id
  ON public.organizations(account_id);
CREATE INDEX IF NOT EXISTS idx_account_memberships_email
  ON public.account_memberships((lower(member_email)));

CREATE TABLE IF NOT EXISTS public.schema_registry (
  organization_id integer PRIMARY KEY REFERENCES public.organizations(id) ON DELETE CASCADE,
  schema_name varchar(63) NOT NULL UNIQUE,
  platform_version integer NOT NULL DEFAULT 2,
  status varchar(30) NOT NULL DEFAULT 'ready',
  created_at timestamptz NOT NULL DEFAULT now(),
  last_migrated_at timestamptz NOT NULL DEFAULT now(),
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb
);

CREATE OR REPLACE FUNCTION brixta_control.claim_account_for_email(
  p_email text,
  p_suggested_name text
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, brixta_control
AS $$
DECLARE
  v_email text := lower(trim(p_email));
  v_account_id integer;
BEGIN
  SELECT am.account_id
    INTO v_account_id
    FROM public.account_memberships am
   WHERE lower(am.member_email) = v_email
   ORDER BY am.account_id
   LIMIT 1;

  IF v_account_id IS NULL THEN
    INSERT INTO public.accounts(name, billing_email)
    VALUES (
      COALESCE(NULLIF(trim(p_suggested_name), ''), 'BRIXTA Account'),
      v_email
    )
    RETURNING id INTO v_account_id;

    INSERT INTO public.account_memberships(account_id, member_email, role)
    VALUES (v_account_id, v_email, 'owner')
    ON CONFLICT DO NOTHING;
  END IF;

  UPDATE public.organizations
     SET account_id = v_account_id
   WHERE account_id IS NULL
     AND lower(admin_email) = v_email;

  RETURN v_account_id;
END
$$;

CREATE OR REPLACE FUNCTION brixta_control.register_organization(
  p_company_name text,
  p_schema_name text,
  p_phone text,
  p_company_email text,
  p_office_address text,
  p_admin_name text,
  p_admin_email text
)
RETURNS TABLE(out_organization_id integer, out_account_id integer)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, brixta_control
AS $$
DECLARE
  v_account_id integer;
  v_organization_id integer;
BEGIN
  IF p_schema_name !~ '^[a-z][a-z0-9_]{0,62}$' THEN
    RAISE EXCEPTION 'Invalid BRIXTA schema name';
  END IF;

  v_account_id := brixta_control.claim_account_for_email(
    p_admin_email,
    p_company_name
  );

  INSERT INTO public.organizations(
    name,
    account_id,
    schema_name,
    phone_number,
    email,
    office_address,
    admin_name,
    admin_email,
    is_provisioned
  )
  VALUES (
    trim(p_company_name),
    v_account_id,
    p_schema_name,
    trim(p_phone),
    NULLIF(trim(p_company_email), ''),
    trim(p_office_address),
    trim(p_admin_name),
    lower(trim(p_admin_email)),
    true
  )
  RETURNING id INTO v_organization_id;

  INSERT INTO public.organization_entitlements(
    organization_id,
    feature_key,
    enabled,
    source
  )
  VALUES
    (v_organization_id, 'responsibility.create', true, 'signup_default'),
    (v_organization_id, 'workflow.customize', true, 'signup_default')
  ON CONFLICT (organization_id, feature_key)
  DO UPDATE SET
    enabled = EXCLUDED.enabled,
    source = EXCLUDED.source,
    updated_at = now();

  INSERT INTO public.schema_registry(
    organization_id,
    schema_name,
    platform_version,
    status,
    last_migrated_at,
    metadata
  )
  VALUES (
    v_organization_id,
    p_schema_name,
    2,
    'ready',
    now(),
    jsonb_build_object('provisioner', 'tenant-platform-v2')
  )
  ON CONFLICT (organization_id)
  DO UPDATE SET
    schema_name = EXCLUDED.schema_name,
    platform_version = EXCLUDED.platform_version,
    status = 'ready',
    last_migrated_at = now();

  RETURN QUERY SELECT v_organization_id, v_account_id;
END
$$;

CREATE OR REPLACE FUNCTION brixta_control.mark_schema_ready(
  p_organization_id integer,
  p_schema_name text,
  p_platform_version integer
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, brixta_control
AS $$
BEGIN
  INSERT INTO public.schema_registry(
    organization_id,
    schema_name,
    platform_version,
    status,
    last_migrated_at
  )
  VALUES (
    p_organization_id,
    p_schema_name,
    p_platform_version,
    'ready',
    now()
  )
  ON CONFLICT (organization_id)
  DO UPDATE SET
    schema_name = EXCLUDED.schema_name,
    platform_version = EXCLUDED.platform_version,
    status = 'ready',
    last_migrated_at = now();
END
$$;

CREATE OR REPLACE FUNCTION brixta_control.list_organizations_for_email(
  p_email text
)
RETURNS TABLE(
  id integer,
  name text,
  schema_name text,
  is_provisioned boolean,
  platform_version integer,
  registry_status text
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = pg_catalog, public, brixta_control
AS $$
  SELECT
    o.id,
    o.name,
    o.schema_name,
    o.is_provisioned,
    COALESCE(sr.platform_version, 0),
    COALESCE(sr.status, 'legacy')
  FROM public.account_memberships am
  JOIN public.organizations o
    ON o.account_id = am.account_id
  LEFT JOIN public.schema_registry sr
    ON sr.organization_id = o.id
  WHERE lower(am.member_email) = lower(trim(p_email))
  ORDER BY o.name;
$$;

CREATE OR REPLACE FUNCTION brixta_control.find_organization_for_email(
  p_email text,
  p_organization_id integer
)
RETURNS TABLE(
  id integer,
  name text,
  schema_name text
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = pg_catalog, public, brixta_control
AS $$
  SELECT o.id, o.name, o.schema_name
  FROM public.account_memberships am
  JOIN public.organizations o
    ON o.account_id = am.account_id
  WHERE lower(am.member_email) = lower(trim(p_email))
    AND o.id = p_organization_id
  LIMIT 1;
$$;

-- For the current phase, the CMS uses a direct DB connection.
-- Keep brixta_control OUT of Supabase exposed API schemas.
-- Once you standardize an exact app DB role, replace PUBLIC below with that role.
REVOKE ALL ON FUNCTION brixta_control.claim_account_for_email(text,text) FROM PUBLIC;
REVOKE ALL ON FUNCTION brixta_control.register_organization(text,text,text,text,text,text,text) FROM PUBLIC;
REVOKE ALL ON FUNCTION brixta_control.mark_schema_ready(integer,text,integer) FROM PUBLIC;
REVOKE ALL ON FUNCTION brixta_control.list_organizations_for_email(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION brixta_control.find_organization_for_email(text,integer) FROM PUBLIC;

GRANT USAGE ON SCHEMA brixta_control TO PUBLIC;
GRANT EXECUTE ON FUNCTION brixta_control.claim_account_for_email(text,text) TO PUBLIC;
GRANT EXECUTE ON FUNCTION brixta_control.register_organization(text,text,text,text,text,text,text) TO PUBLIC;
GRANT EXECUTE ON FUNCTION brixta_control.mark_schema_ready(integer,text,integer) TO PUBLIC;
GRANT EXECUTE ON FUNCTION brixta_control.list_organizations_for_email(text) TO PUBLIC;
GRANT EXECUTE ON FUNCTION brixta_control.find_organization_for_email(text,integer) TO PUBLIC;