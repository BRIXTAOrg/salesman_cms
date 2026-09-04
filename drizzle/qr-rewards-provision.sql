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

INSERT INTO qr_rewards_meta(
  key,
  value,
  updated_at
)
VALUES (
  'schema_version',
  '1',
  now()
)
ON CONFLICT (key)
DO UPDATE SET
  value = EXCLUDED.value,
  updated_at = now();
