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

INSERT INTO qr_rewards_meta(
  key,
  value,
  updated_at
)
VALUES (
  'schema_version',
  '3',
  now()
)
ON CONFLICT (key)
DO UPDATE SET
  value = EXCLUDED.value,
  updated_at = now();
