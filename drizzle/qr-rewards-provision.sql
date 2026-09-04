-- BRIXTA QR REWARDS TENANT SUBSTRATE V1
--
-- Execute with search_path set to:
--
--   "<tenant_schema>", public
--
-- Bearer voucher secrets are NOT stored.
-- Only SHA-256 hashes of QR payloads are persisted.


CREATE TABLE IF NOT EXISTS qr_rewards_meta (
  key varchar(120) PRIMARY KEY,
  value text NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);

--> statement-breakpoint

CREATE TABLE IF NOT EXISTS qr_reward_campaigns (
  id uuid PRIMARY KEY,

  name varchar(180) NOT NULL,

  description text,

  reward_amount_minor integer NOT NULL
    CHECK (reward_amount_minor > 0),

  currency varchar(3) NOT NULL DEFAULT 'INR',

  starts_at timestamptz NOT NULL,

  expires_at timestamptz NOT NULL,

  status varchar(32) NOT NULL DEFAULT 'active'
    CHECK (
      status IN (
        'draft',
        'active',
        'paused',
        'completed',
        'revoked'
      )
    ),

  created_by_user_id integer,

  created_at timestamptz NOT NULL DEFAULT now(),

  updated_at timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT qr_reward_campaign_dates_valid
    CHECK (expires_at > starts_at)
);

--> statement-breakpoint

CREATE INDEX IF NOT EXISTS idx_qr_reward_campaigns_status
  ON qr_reward_campaigns(status);

--> statement-breakpoint

CREATE INDEX IF NOT EXISTS idx_qr_reward_campaigns_expiry
  ON qr_reward_campaigns(expires_at);

--> statement-breakpoint

CREATE TABLE IF NOT EXISTS qr_reward_batches (
  id uuid PRIMARY KEY,

  campaign_id uuid NOT NULL
    REFERENCES qr_reward_campaigns(id)
    ON DELETE RESTRICT,

  batch_code varchar(80) NOT NULL UNIQUE,

  quantity integer NOT NULL
    CHECK (quantity > 0),

  reward_amount_minor integer NOT NULL
    CHECK (reward_amount_minor > 0),

  currency varchar(3) NOT NULL DEFAULT 'INR',

  expires_at timestamptz NOT NULL,

  status varchar(32) NOT NULL DEFAULT 'ready'
    CHECK (
      status IN (
        'generating',
        'ready',
        'partially_printed',
        'printed',
        'revoked'
      )
    ),

  created_by_user_id integer,

  created_at timestamptz NOT NULL DEFAULT now()
);

--> statement-breakpoint

CREATE INDEX IF NOT EXISTS idx_qr_reward_batches_campaign
  ON qr_reward_batches(campaign_id);

--> statement-breakpoint

CREATE INDEX IF NOT EXISTS idx_qr_reward_batches_status
  ON qr_reward_batches(status);

--> statement-breakpoint

CREATE TABLE IF NOT EXISTS qr_reward_vouchers (
  id uuid PRIMARY KEY,

  batch_id uuid NOT NULL
    REFERENCES qr_reward_batches(id)
    ON DELETE RESTRICT,

  serial_number integer NOT NULL,

  token_hash varchar(64) NOT NULL UNIQUE,

  status varchar(32) NOT NULL DEFAULT 'available'
    CHECK (
      status IN (
        'available',
        'claimed',
        'expired',
        'revoked'
      )
    ),

  expires_at timestamptz NOT NULL,

  claimed_by_user_id integer,

  claimed_at timestamptz,

  created_at timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT qr_reward_vouchers_batch_serial_key
    UNIQUE(batch_id, serial_number)
);

--> statement-breakpoint

CREATE INDEX IF NOT EXISTS idx_qr_reward_vouchers_batch
  ON qr_reward_vouchers(batch_id);

--> statement-breakpoint

CREATE INDEX IF NOT EXISTS idx_qr_reward_vouchers_status
  ON qr_reward_vouchers(status);

--> statement-breakpoint

CREATE INDEX IF NOT EXISTS idx_qr_reward_vouchers_claimant
  ON qr_reward_vouchers(claimed_by_user_id);

--> statement-breakpoint

CREATE INDEX IF NOT EXISTS idx_qr_reward_vouchers_expiry
  ON qr_reward_vouchers(expires_at);

--> statement-breakpoint

CREATE TABLE IF NOT EXISTS qr_reward_claims (
  id uuid PRIMARY KEY,

  voucher_id uuid NOT NULL UNIQUE
    REFERENCES qr_reward_vouchers(id)
    ON DELETE RESTRICT,

  user_id integer NOT NULL,

  request_id varchar(160) NOT NULL UNIQUE,

  claimed_at timestamptz NOT NULL DEFAULT now()
);

--> statement-breakpoint

CREATE INDEX IF NOT EXISTS idx_qr_reward_claims_user
  ON qr_reward_claims(user_id);

--> statement-breakpoint

CREATE INDEX IF NOT EXISTS idx_qr_reward_claims_claimed_at
  ON qr_reward_claims(claimed_at);

--> statement-breakpoint


-- ==========================================================
-- QR REWARDS V3
--
-- Physical QR batches are reusable while individual QRs
-- remain strictly single-use.
--
-- A batch may have many HISTORICAL Campaign assignments,
-- but at most ONE ACTIVE assignment at a time.
-- ==========================================================


CREATE TABLE IF NOT EXISTS qr_reward_batch_assignments (
  id uuid PRIMARY KEY,

  batch_id uuid NOT NULL
    REFERENCES qr_reward_batches(id)
    ON DELETE RESTRICT,

  campaign_id uuid NOT NULL
    REFERENCES qr_reward_campaigns(id)
    ON DELETE RESTRICT,

  reward_amount_minor integer NOT NULL
    CHECK (
      reward_amount_minor > 0
    ),

  currency varchar(3)
    NOT NULL
    DEFAULT 'INR',

  expires_at timestamptz
    NOT NULL,

  status varchar(32)
    NOT NULL
    DEFAULT 'active'
    CHECK (
      status IN (
        'active',
        'ended',
        'expired',
        'revoked'
      )
    ),

  activated_at timestamptz
    NOT NULL
    DEFAULT now(),

  deactivated_at timestamptz,

  created_by_user_id integer,

  created_at timestamptz
    NOT NULL
    DEFAULT now()
);

--> statement-breakpoint

CREATE INDEX IF NOT EXISTS
  idx_qr_reward_batch_assignments_batch
ON qr_reward_batch_assignments(batch_id);

--> statement-breakpoint

CREATE INDEX IF NOT EXISTS
  idx_qr_reward_batch_assignments_campaign
ON qr_reward_batch_assignments(campaign_id);

--> statement-breakpoint

CREATE INDEX IF NOT EXISTS
  idx_qr_reward_batch_assignments_status
ON qr_reward_batch_assignments(status);

--> statement-breakpoint

/*
 * HARD DATABASE INVARIANT.
 *
 * PostgreSQL itself prevents a batch from having two
 * simultaneous ACTIVE Campaign assignments.
 */
CREATE UNIQUE INDEX IF NOT EXISTS
  qr_reward_batch_assignments_one_active_per_batch
ON qr_reward_batch_assignments(batch_id)
WHERE status = 'active';

--> statement-breakpoint


ALTER TABLE qr_reward_claims
  ADD COLUMN IF NOT EXISTS assignment_id uuid;

--> statement-breakpoint

ALTER TABLE qr_reward_claims
  ADD COLUMN IF NOT EXISTS campaign_id_snapshot uuid;

--> statement-breakpoint

ALTER TABLE qr_reward_claims
  ADD COLUMN IF NOT EXISTS reward_amount_minor_snapshot integer;

--> statement-breakpoint

ALTER TABLE qr_reward_claims
  ADD COLUMN IF NOT EXISTS currency_snapshot varchar(3);

--> statement-breakpoint


DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE
      conname =
        'qr_reward_claims_assignment_id_fkey'
  ) THEN
    ALTER TABLE qr_reward_claims
      ADD CONSTRAINT
        qr_reward_claims_assignment_id_fkey
      FOREIGN KEY (
        assignment_id
      )
      REFERENCES
        qr_reward_batch_assignments(id)
      ON DELETE RESTRICT;
  END IF;
END
$$;

--> statement-breakpoint


DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE
      conname =
        'qr_reward_claims_campaign_snapshot_fkey'
  ) THEN
    ALTER TABLE qr_reward_claims
      ADD CONSTRAINT
        qr_reward_claims_campaign_snapshot_fkey
      FOREIGN KEY (
        campaign_id_snapshot
      )
      REFERENCES
        qr_reward_campaigns(id)
      ON DELETE RESTRICT;
  END IF;
END
$$;

--> statement-breakpoint


/*
 * Upgrade old batches.
 *
 * Every existing batch receives exactly one initial
 * assignment matching its historic/original Campaign.
 *
 * md5(... )::uuid gives us a deterministic migration UUID,
 * so rerunning provisioning is idempotent.
 */
INSERT INTO qr_reward_batch_assignments (
  id,
  batch_id,
  campaign_id,
  reward_amount_minor,
  currency,
  expires_at,
  status,
  activated_at,
  created_by_user_id,
  created_at
)
SELECT
  md5(
    b.id::text ||
    ':brixta-initial-assignment'
  )::uuid,

  b.id,

  b.campaign_id,

  b.reward_amount_minor,

  b.currency,

  b.expires_at,

  CASE
    WHEN
      c.status = 'active'
      AND c.starts_at <= now()
      AND c.expires_at > now()
      AND b.status <> 'revoked'
    THEN 'active'
    ELSE 'ended'
  END,

  b.created_at,

  b.created_by_user_id,

  b.created_at

FROM qr_reward_batches b

INNER JOIN qr_reward_campaigns c
  ON c.id =
    b.campaign_id

WHERE NOT EXISTS (
  SELECT 1
  FROM qr_reward_batch_assignments a
  WHERE
    a.batch_id =
      b.id
);

--> statement-breakpoint


/*
 * Preserve old claim history before the new assignment
 * model becomes authoritative.
 */
UPDATE qr_reward_claims cl

SET
  assignment_id =
    COALESCE(
      cl.assignment_id,
      a.id
    ),

  campaign_id_snapshot =
    COALESCE(
      cl.campaign_id_snapshot,
      b.campaign_id
    ),

  reward_amount_minor_snapshot =
    COALESCE(
      cl.reward_amount_minor_snapshot,
      b.reward_amount_minor
    ),

  currency_snapshot =
    COALESCE(
      cl.currency_snapshot,
      b.currency
    )

FROM
  qr_reward_vouchers v,
  qr_reward_batches b,
  qr_reward_batch_assignments a

WHERE
  cl.voucher_id =
    v.id

  AND
  v.batch_id =
    b.id

  AND
  a.batch_id =
    b.id

  AND
  a.campaign_id =
    b.campaign_id

  AND
  cl.assignment_id
    IS NULL;

--> statement-breakpoint


-- ==========================================================
-- QR REWARDS V4
--
-- Reusable BRIXTA Entity attribution:
--
-- Campaign
--   ↕
-- Entity records
--   ↓
-- QR Batch Assignment
--   ↓
-- Claim snapshot
-- ==========================================================


CREATE TABLE IF NOT EXISTS
  qr_reward_campaign_entities (
    id uuid PRIMARY KEY,

    campaign_id uuid NOT NULL
      REFERENCES qr_reward_campaigns(id)
      ON DELETE CASCADE,

    entity_type_id integer NOT NULL
      REFERENCES entity_types(id)
      ON DELETE RESTRICT,

    entity_record_id uuid NOT NULL
      REFERENCES entity_records(id)
      ON DELETE RESTRICT,

    created_by_user_id integer,

    created_at timestamptz
      NOT NULL
      DEFAULT now()
  );

--> statement-breakpoint

CREATE UNIQUE INDEX IF NOT EXISTS
  qr_reward_campaign_entities_campaign_record_key
ON qr_reward_campaign_entities(
  campaign_id,
  entity_record_id
);

--> statement-breakpoint

CREATE INDEX IF NOT EXISTS
  idx_qr_reward_campaign_entities_campaign
ON qr_reward_campaign_entities(
  campaign_id
);

--> statement-breakpoint

CREATE INDEX IF NOT EXISTS
  idx_qr_reward_campaign_entities_type
ON qr_reward_campaign_entities(
  entity_type_id
);

--> statement-breakpoint


ALTER TABLE qr_reward_batch_assignments
  ADD COLUMN IF NOT EXISTS
    attribution_mode varchar(32)
    NOT NULL
    DEFAULT 'none';

--> statement-breakpoint

ALTER TABLE qr_reward_batch_assignments
  ADD COLUMN IF NOT EXISTS
    entity_type_id integer;

--> statement-breakpoint

ALTER TABLE qr_reward_batch_assignments
  ADD COLUMN IF NOT EXISTS
    entity_record_id uuid;

--> statement-breakpoint

ALTER TABLE qr_reward_batch_assignments
  ADD COLUMN IF NOT EXISTS
    entity_label_snapshot varchar(500);

--> statement-breakpoint


DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname =
      'qr_reward_batch_assignments_entity_type_fkey'
  ) THEN
    ALTER TABLE qr_reward_batch_assignments
      ADD CONSTRAINT
        qr_reward_batch_assignments_entity_type_fkey
      FOREIGN KEY (
        entity_type_id
      )
      REFERENCES entity_types(id)
      ON DELETE RESTRICT;
  END IF;
END
$$;

--> statement-breakpoint


DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname =
      'qr_reward_batch_assignments_entity_record_fkey'
  ) THEN
    ALTER TABLE qr_reward_batch_assignments
      ADD CONSTRAINT
        qr_reward_batch_assignments_entity_record_fkey
      FOREIGN KEY (
        entity_record_id
      )
      REFERENCES entity_records(id)
      ON DELETE RESTRICT;
  END IF;
END
$$;

--> statement-breakpoint


ALTER TABLE qr_reward_claims
  ADD COLUMN IF NOT EXISTS
    entity_type_id_snapshot integer;

--> statement-breakpoint

ALTER TABLE qr_reward_claims
  ADD COLUMN IF NOT EXISTS
    entity_record_id_snapshot uuid;

--> statement-breakpoint

ALTER TABLE qr_reward_claims
  ADD COLUMN IF NOT EXISTS
    entity_type_label_snapshot varchar(220);

--> statement-breakpoint

ALTER TABLE qr_reward_claims
  ADD COLUMN IF NOT EXISTS
    entity_label_snapshot varchar(500);

--> statement-breakpoint


DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname =
      'qr_reward_claims_entity_type_snapshot_fkey'
  ) THEN
    ALTER TABLE qr_reward_claims
      ADD CONSTRAINT
        qr_reward_claims_entity_type_snapshot_fkey
      FOREIGN KEY (
        entity_type_id_snapshot
      )
      REFERENCES entity_types(id)
      ON DELETE RESTRICT;
  END IF;
END
$$;

--> statement-breakpoint


DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname =
      'qr_reward_claims_entity_record_snapshot_fkey'
  ) THEN
    ALTER TABLE qr_reward_claims
      ADD CONSTRAINT
        qr_reward_claims_entity_record_snapshot_fkey
      FOREIGN KEY (
        entity_record_id_snapshot
      )
      REFERENCES entity_records(id)
      ON DELETE RESTRICT;
  END IF;
END
$$;

--> statement-breakpoint


DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname =
      'qr_reward_batch_assignments_attribution_mode_check'
  ) THEN
    ALTER TABLE qr_reward_batch_assignments
      ADD CONSTRAINT
        qr_reward_batch_assignments_attribution_mode_check
      CHECK (
        attribution_mode IN (
          'none',
          'fixed_entity',
          'claimant_selects'
        )
      );
  END IF;
END
$$;

--> statement-breakpoint


-- ==========================================================
-- QR REWARDS V5
--
-- Scheme
-- Reward policy/formula
-- Claim limits
-- Fraud policy
-- Immutable versioned Rulebook
-- Rule evaluation audit
-- ==========================================================


CREATE TABLE IF NOT EXISTS
  qr_reward_schemes (
    id uuid PRIMARY KEY,

    name varchar(180)
      NOT NULL,

    description text,

    status varchar(32)
      NOT NULL
      DEFAULT 'active',

    created_by_user_id integer,

    created_at timestamptz
      NOT NULL
      DEFAULT now(),

    updated_at timestamptz
      NOT NULL
      DEFAULT now()
  );

--> statement-breakpoint


CREATE TABLE IF NOT EXISTS
  qr_reward_rulebooks (
    id uuid PRIMARY KEY,

    scheme_id uuid
      NOT NULL
      REFERENCES qr_reward_schemes(id)
      ON DELETE RESTRICT,

    version integer
      NOT NULL,

    status varchar(32)
      NOT NULL
      DEFAULT 'published',

    reward_policy jsonb
      NOT NULL,

    claim_limit_policy jsonb
      NOT NULL
      DEFAULT '{}'::jsonb,

    fraud_policy jsonb
      NOT NULL
      DEFAULT '{}'::jsonb,

    validity_policy jsonb
      NOT NULL
      DEFAULT '{}'::jsonb,

    rules_hash varchar(64)
      NOT NULL,

    created_by_user_id integer,

    published_at timestamptz
      NOT NULL
      DEFAULT now(),

    created_at timestamptz
      NOT NULL
      DEFAULT now()
  );

--> statement-breakpoint


CREATE UNIQUE INDEX IF NOT EXISTS
  qr_reward_rulebooks_scheme_version_key
ON qr_reward_rulebooks(
  scheme_id,
  version
);

--> statement-breakpoint


ALTER TABLE qr_reward_campaigns
  ADD COLUMN IF NOT EXISTS
    scheme_id uuid;

--> statement-breakpoint

ALTER TABLE qr_reward_campaigns
  ADD COLUMN IF NOT EXISTS
    current_rulebook_id uuid;

--> statement-breakpoint


DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname =
      'qr_reward_campaigns_scheme_id_fkey'
  ) THEN
    ALTER TABLE qr_reward_campaigns
      ADD CONSTRAINT
        qr_reward_campaigns_scheme_id_fkey
      FOREIGN KEY (
        scheme_id
      )
      REFERENCES qr_reward_schemes(id)
      ON DELETE RESTRICT;
  END IF;
END
$$;

--> statement-breakpoint


DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname =
      'qr_reward_campaigns_current_rulebook_id_fkey'
  ) THEN
    ALTER TABLE qr_reward_campaigns
      ADD CONSTRAINT
        qr_reward_campaigns_current_rulebook_id_fkey
      FOREIGN KEY (
        current_rulebook_id
      )
      REFERENCES qr_reward_rulebooks(id)
      ON DELETE RESTRICT;
  END IF;
END
$$;

--> statement-breakpoint


ALTER TABLE qr_reward_batch_assignments
  ADD COLUMN IF NOT EXISTS
    scheme_id uuid;

--> statement-breakpoint

ALTER TABLE qr_reward_batch_assignments
  ADD COLUMN IF NOT EXISTS
    rulebook_id uuid;

--> statement-breakpoint

ALTER TABLE qr_reward_batch_assignments
  ADD COLUMN IF NOT EXISTS
    rulebook_version integer;

--> statement-breakpoint

ALTER TABLE qr_reward_batch_assignments
  ADD COLUMN IF NOT EXISTS
    rules_hash varchar(64);

--> statement-breakpoint


DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname =
      'qr_reward_batch_assignments_scheme_id_fkey'
  ) THEN
    ALTER TABLE qr_reward_batch_assignments
      ADD CONSTRAINT
        qr_reward_batch_assignments_scheme_id_fkey
      FOREIGN KEY (
        scheme_id
      )
      REFERENCES qr_reward_schemes(id)
      ON DELETE RESTRICT;
  END IF;
END
$$;

--> statement-breakpoint


DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname =
      'qr_reward_batch_assignments_rulebook_id_fkey'
  ) THEN
    ALTER TABLE qr_reward_batch_assignments
      ADD CONSTRAINT
        qr_reward_batch_assignments_rulebook_id_fkey
      FOREIGN KEY (
        rulebook_id
      )
      REFERENCES qr_reward_rulebooks(id)
      ON DELETE RESTRICT;
  END IF;
END
$$;

--> statement-breakpoint


ALTER TABLE qr_reward_claims
  ADD COLUMN IF NOT EXISTS
    claimant_key_hash varchar(64);

--> statement-breakpoint

ALTER TABLE qr_reward_claims
  ADD COLUMN IF NOT EXISTS
    scheme_id_snapshot uuid;

--> statement-breakpoint

ALTER TABLE qr_reward_claims
  ADD COLUMN IF NOT EXISTS
    scheme_name_snapshot varchar(180);

--> statement-breakpoint

ALTER TABLE qr_reward_claims
  ADD COLUMN IF NOT EXISTS
    rulebook_id_snapshot uuid;

--> statement-breakpoint

ALTER TABLE qr_reward_claims
  ADD COLUMN IF NOT EXISTS
    rulebook_version_snapshot integer;

--> statement-breakpoint

ALTER TABLE qr_reward_claims
  ADD COLUMN IF NOT EXISTS
    rules_hash_snapshot varchar(64);

--> statement-breakpoint


DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname =
      'qr_reward_claims_scheme_snapshot_fkey'
  ) THEN
    ALTER TABLE qr_reward_claims
      ADD CONSTRAINT
        qr_reward_claims_scheme_snapshot_fkey
      FOREIGN KEY (
        scheme_id_snapshot
      )
      REFERENCES qr_reward_schemes(id)
      ON DELETE RESTRICT;
  END IF;
END
$$;

--> statement-breakpoint


DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname =
      'qr_reward_claims_rulebook_snapshot_fkey'
  ) THEN
    ALTER TABLE qr_reward_claims
      ADD CONSTRAINT
        qr_reward_claims_rulebook_snapshot_fkey
      FOREIGN KEY (
        rulebook_id_snapshot
      )
      REFERENCES qr_reward_rulebooks(id)
      ON DELETE RESTRICT;
  END IF;
END
$$;

--> statement-breakpoint


CREATE INDEX IF NOT EXISTS
  idx_qr_reward_claims_claimant_key
ON qr_reward_claims(
  claimant_key_hash
);

--> statement-breakpoint


/*
 * Upgrade every existing Campaign into an explicit Scheme
 * with an immutable Rulebook V1.
 */
INSERT INTO qr_reward_schemes (
  id,
  name,
  description,
  status,
  created_by_user_id,
  created_at,
  updated_at
)
SELECT
  md5(
    c.id::text ||
    ':brixta-default-scheme'
  )::uuid,

  c.name ||
    ' Scheme',

  'Automatically created during QR Rewards V5 upgrade.',

  'active',

  c.created_by_user_id,

  c.created_at,

  c.updated_at

FROM qr_reward_campaigns c

WHERE NOT EXISTS (
  SELECT 1
  FROM qr_reward_schemes s
  WHERE
    s.id =
      md5(
        c.id::text ||
        ':brixta-default-scheme'
      )::uuid
);

--> statement-breakpoint


INSERT INTO qr_reward_rulebooks (
  id,
  scheme_id,
  version,
  status,
  reward_policy,
  claim_limit_policy,
  fraud_policy,
  validity_policy,
  rules_hash,
  created_by_user_id,
  published_at,
  created_at
)
SELECT
  md5(
    c.id::text ||
    ':brixta-rulebook-v1'
  )::uuid,

  md5(
    c.id::text ||
    ':brixta-default-scheme'
  )::uuid,

  1,

  'published',

  jsonb_build_object(
    'type',
      'fixed',

    'amountMinor',
      c.reward_amount_minor
  ),

  jsonb_build_object(
    'perQrLifetime',
      1
  ),

  jsonb_build_object(
    'rejectDuplicateQr',
      true,

    'requireActiveAssignment',
      true,

    'requireValidEntity',
      true
  ),

  jsonb_build_object(
    'source',
      'campaign_and_assignment'
  ),

  md5(
    c.id::text ||
    ':' ||
    c.reward_amount_minor::text ||
    ':rules-v1'
  ) ||
  md5(
    c.id::text ||
    ':rules-v1-secondary'
  ),

  c.created_by_user_id,

  c.created_at,

  c.created_at

FROM qr_reward_campaigns c

WHERE NOT EXISTS (
  SELECT 1
  FROM qr_reward_rulebooks rb
  WHERE
    rb.id =
      md5(
        c.id::text ||
        ':brixta-rulebook-v1'
      )::uuid
);

--> statement-breakpoint


UPDATE qr_reward_campaigns c

SET
  scheme_id =
    COALESCE(
      c.scheme_id,

      md5(
        c.id::text ||
        ':brixta-default-scheme'
      )::uuid
    ),

  current_rulebook_id =
    COALESCE(
      c.current_rulebook_id,

      md5(
        c.id::text ||
        ':brixta-rulebook-v1'
      )::uuid
    )

WHERE
  c.scheme_id IS NULL
  OR
  c.current_rulebook_id IS NULL;

--> statement-breakpoint


UPDATE qr_reward_batch_assignments a

SET
  scheme_id =
    COALESCE(
      a.scheme_id,
      c.scheme_id
    ),

  rulebook_id =
    COALESCE(
      a.rulebook_id,
      c.current_rulebook_id
    ),

  rulebook_version =
    COALESCE(
      a.rulebook_version,
      rb.version
    ),

  rules_hash =
    COALESCE(
      a.rules_hash,
      rb.rules_hash
    )

FROM
  qr_reward_campaigns c,
  qr_reward_rulebooks rb

WHERE
  a.campaign_id =
    c.id

  AND
  rb.id =
    c.current_rulebook_id

  AND (
    a.scheme_id IS NULL
    OR
    a.rulebook_id IS NULL
    OR
    a.rulebook_version IS NULL
    OR
    a.rules_hash IS NULL
  );

--> statement-breakpoint


UPDATE qr_reward_claims cl

SET
  scheme_id_snapshot =
    COALESCE(
      cl.scheme_id_snapshot,
      a.scheme_id
    ),

  scheme_name_snapshot =
    COALESCE(
      cl.scheme_name_snapshot,
      s.name
    ),

  rulebook_id_snapshot =
    COALESCE(
      cl.rulebook_id_snapshot,
      a.rulebook_id
    ),

  rulebook_version_snapshot =
    COALESCE(
      cl.rulebook_version_snapshot,
      a.rulebook_version
    ),

  rules_hash_snapshot =
    COALESCE(
      cl.rules_hash_snapshot,
      a.rules_hash
    )

FROM
  qr_reward_batch_assignments a,
  qr_reward_schemes s

WHERE
  cl.assignment_id =
    a.id

  AND
  s.id =
    a.scheme_id

  AND (
    cl.scheme_id_snapshot IS NULL
    OR
    cl.rulebook_id_snapshot IS NULL
  );

--> statement-breakpoint


/*
 * Automatically create a default Scheme/Rulebook for future
 * Campaigns created by the existing CMS form.
 */
CREATE OR REPLACE FUNCTION
  qr_rewards_attach_default_rulebook()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  v_scheme_id uuid;
  v_rulebook_id uuid;
  v_hash varchar(64);
BEGIN
  IF
    NEW.scheme_id IS NOT NULL
    AND
    NEW.current_rulebook_id IS NOT NULL
  THEN
    RETURN NEW;
  END IF;

  v_scheme_id :=
    md5(
      NEW.id::text ||
      ':brixta-default-scheme'
    )::uuid;

  v_rulebook_id :=
    md5(
      NEW.id::text ||
      ':brixta-rulebook-v1'
    )::uuid;

  v_hash :=
    md5(
      NEW.id::text ||
      ':' ||
      NEW.reward_amount_minor::text ||
      ':rules-v1'
    ) ||
    md5(
      NEW.id::text ||
      ':rules-v1-secondary'
    );

  INSERT INTO qr_reward_schemes (
    id,
    name,
    description,
    status,
    created_by_user_id
  )
  VALUES (
    v_scheme_id,
    NEW.name || ' Scheme',
    'Automatically created for Campaign.',
    'active',
    NEW.created_by_user_id
  )
  ON CONFLICT (
    id
  )
  DO NOTHING;

  INSERT INTO qr_reward_rulebooks (
    id,
    scheme_id,
    version,
    status,
    reward_policy,
    claim_limit_policy,
    fraud_policy,
    validity_policy,
    rules_hash,
    created_by_user_id
  )
  VALUES (
    v_rulebook_id,
    v_scheme_id,
    1,
    'published',

    jsonb_build_object(
      'type',
        'fixed',

      'amountMinor',
        NEW.reward_amount_minor
    ),

    jsonb_build_object(
      'perQrLifetime',
        1
    ),

    jsonb_build_object(
      'rejectDuplicateQr',
        true,

      'requireActiveAssignment',
        true,

      'requireValidEntity',
        true
    ),

    jsonb_build_object(
      'source',
        'campaign_and_assignment'
    ),

    v_hash,

    NEW.created_by_user_id
  )
  ON CONFLICT (
    id
  )
  DO NOTHING;

  UPDATE qr_reward_campaigns
  SET
    scheme_id =
      v_scheme_id,

    current_rulebook_id =
      v_rulebook_id

  WHERE
    id =
      NEW.id;

  RETURN NEW;
END
$$;

--> statement-breakpoint


DROP TRIGGER IF EXISTS
  qr_rewards_campaign_default_rulebook
ON qr_reward_campaigns;

--> statement-breakpoint


CREATE TRIGGER
  qr_rewards_campaign_default_rulebook

AFTER INSERT
ON qr_reward_campaigns

FOR EACH ROW

EXECUTE FUNCTION
  qr_rewards_attach_default_rulebook();

--> statement-breakpoint


/*
 * Any newly created / reassigned physical QR batch snapshots
 * the Campaign's CURRENT Rulebook automatically.
 */
CREATE OR REPLACE FUNCTION
  qr_rewards_snapshot_assignment_rulebook()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF
    NEW.scheme_id IS NULL
    OR
    NEW.rulebook_id IS NULL
  THEN
    SELECT
      c.scheme_id,
      c.current_rulebook_id,
      rb.version,
      rb.rules_hash

    INTO
      NEW.scheme_id,
      NEW.rulebook_id,
      NEW.rulebook_version,
      NEW.rules_hash

    FROM
      qr_reward_campaigns c

    INNER JOIN
      qr_reward_rulebooks rb
        ON rb.id =
          c.current_rulebook_id

    WHERE
      c.id =
        NEW.campaign_id;
  END IF;

  RETURN NEW;
END
$$;

--> statement-breakpoint


DROP TRIGGER IF EXISTS
  qr_rewards_assignment_rulebook_snapshot
ON qr_reward_batch_assignments;

--> statement-breakpoint


CREATE TRIGGER
  qr_rewards_assignment_rulebook_snapshot

BEFORE INSERT
ON qr_reward_batch_assignments

FOR EACH ROW

EXECUTE FUNCTION
  qr_rewards_snapshot_assignment_rulebook();

--> statement-breakpoint


CREATE TABLE IF NOT EXISTS
  qr_reward_rule_evaluations (
    id uuid PRIMARY KEY,

    voucher_id uuid
      REFERENCES qr_reward_vouchers(id)
      ON DELETE RESTRICT,

    assignment_id uuid
      REFERENCES qr_reward_batch_assignments(id)
      ON DELETE RESTRICT,

    claim_id uuid
      REFERENCES qr_reward_claims(id)
      ON DELETE RESTRICT,

    scheme_id uuid
      REFERENCES qr_reward_schemes(id)
      ON DELETE RESTRICT,

    rulebook_id uuid
      REFERENCES qr_reward_rulebooks(id)
      ON DELETE RESTRICT,

    rulebook_version integer,

    phase varchar(32)
      NOT NULL,

    decision varchar(16)
      NOT NULL,

    reason_codes jsonb
      NOT NULL
      DEFAULT '[]'::jsonb,

    facts jsonb
      NOT NULL
      DEFAULT '{}'::jsonb,

    evaluated_at timestamptz
      NOT NULL
      DEFAULT now()
  );

--> statement-breakpoint


CREATE INDEX IF NOT EXISTS
  idx_qr_reward_rule_eval_voucher
ON qr_reward_rule_evaluations(
  voucher_id
);

--> statement-breakpoint

CREATE INDEX IF NOT EXISTS
  idx_qr_reward_rule_eval_claim
ON qr_reward_rule_evaluations(
  claim_id
);

--> statement-breakpoint

CREATE INDEX IF NOT EXISTS
  idx_qr_reward_rule_eval_time
ON qr_reward_rule_evaluations(
  evaluated_at
);

--> statement-breakpoint

INSERT INTO qr_rewards_meta(
  key,
  value,
  updated_at
)
VALUES (
  'schema_version',
  '5',
  now()
)
ON CONFLICT (key)
DO UPDATE SET
  value = EXCLUDED.value,
  updated_at = now();
