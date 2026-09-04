import {
  check,
  index,
  integer,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";

import {
  sql,
} from "drizzle-orm";


export const qrRewardsMeta = pgTable(
  "qr_rewards_meta",
  {
    key: varchar("key", {
      length: 120,
    }).primaryKey(),

    value: text("value").notNull(),

    updatedAt: timestamp(
      "updated_at",
      {
        withTimezone: true,
        mode: "string",
      },
    )
      .notNull()
      .defaultNow(),
  },
);


export const qrRewardCampaigns = pgTable(
  "qr_reward_campaigns",
  {
    id: uuid("id")
      .primaryKey(),

    name: varchar(
      "name",
      {
        length: 180,
      },
    ).notNull(),

    description: text(
      "description",
    ),

    rewardAmountMinor: integer(
      "reward_amount_minor",
    ).notNull(),

    currency: varchar(
      "currency",
      {
        length: 3,
      },
    )
      .notNull()
      .default("INR"),

    startsAt: timestamp(
      "starts_at",
      {
        withTimezone: true,
        mode: "string",
      },
    ).notNull(),

    expiresAt: timestamp(
      "expires_at",
      {
        withTimezone: true,
        mode: "string",
      },
    ).notNull(),

    status: varchar(
      "status",
      {
        length: 32,
      },
    )
      .notNull()
      .default("active"),

    createdByUserId: integer(
      "created_by_user_id",
    ),

    createdAt: timestamp(
      "created_at",
      {
        withTimezone: true,
        mode: "string",
      },
    )
      .notNull()
      .defaultNow(),

    updatedAt: timestamp(
      "updated_at",
      {
        withTimezone: true,
        mode: "string",
      },
    )
      .notNull()
      .defaultNow(),
  },

  (table) => [
    index(
      "idx_qr_reward_campaigns_status",
    ).on(
      table.status,
    ),

    index(
      "idx_qr_reward_campaigns_expiry",
    ).on(
      table.expiresAt,
    ),

    check(
      "qr_reward_campaign_reward_positive",
      sql`${table.rewardAmountMinor} > 0`,
    ),

    check(
      "qr_reward_campaign_dates_valid",
      sql`${table.expiresAt} > ${table.startsAt}`,
    ),
  ],
);


export const qrRewardBatches = pgTable(
  "qr_reward_batches",
  {
    id: uuid("id")
      .primaryKey(),

    campaignId: uuid(
      "campaign_id",
    )
      .notNull()
      .references(
        () => qrRewardCampaigns.id,
        {
          onDelete: "restrict",
        },
      ),

    batchCode: varchar(
      "batch_code",
      {
        length: 80,
      },
    ).notNull(),

    quantity: integer(
      "quantity",
    ).notNull(),

    /*
     * Snapshot the monetary contract at generation.
     *
     * Changing a Campaign later must never change the value
     * of already-minted vouchers.
     */
    rewardAmountMinor: integer(
      "reward_amount_minor",
    ).notNull(),

    currency: varchar(
      "currency",
      {
        length: 3,
      },
    )
      .notNull()
      .default("INR"),

    expiresAt: timestamp(
      "expires_at",
      {
        withTimezone: true,
        mode: "string",
      },
    ).notNull(),

    status: varchar(
      "status",
      {
        length: 32,
      },
    )
      .notNull()
      .default("ready"),

    createdByUserId: integer(
      "created_by_user_id",
    ),

    createdAt: timestamp(
      "created_at",
      {
        withTimezone: true,
        mode: "string",
      },
    )
      .notNull()
      .defaultNow(),
  },

  (table) => [
    uniqueIndex(
      "qr_reward_batches_batch_code_key",
    ).on(
      table.batchCode,
    ),

    index(
      "idx_qr_reward_batches_campaign",
    ).on(
      table.campaignId,
    ),

    index(
      "idx_qr_reward_batches_status",
    ).on(
      table.status,
    ),

    check(
      "qr_reward_batch_quantity_positive",
      sql`${table.quantity} > 0`,
    ),

    check(
      "qr_reward_batch_reward_positive",
      sql`${table.rewardAmountMinor} > 0`,
    ),
  ],
);


export const qrRewardVouchers = pgTable(
  "qr_reward_vouchers",
  {
    id: uuid("id")
      .primaryKey(),

    batchId: uuid(
      "batch_id",
    )
      .notNull()
      .references(
        () => qrRewardBatches.id,
        {
          onDelete: "restrict",
        },
      ),

    serialNumber: integer(
      "serial_number",
    ).notNull(),

    /*
     * IMPORTANT:
     *
     * The QR's bearer secret is NOT persisted.
     * Only SHA-256(payload) is stored.
     */
    tokenHash: varchar(
      "token_hash",
      {
        length: 64,
      },
    ).notNull(),

    status: varchar(
      "status",
      {
        length: 32,
      },
    )
      .notNull()
      .default("available"),

    expiresAt: timestamp(
      "expires_at",
      {
        withTimezone: true,
        mode: "string",
      },
    ).notNull(),

    claimedByUserId: integer(
      "claimed_by_user_id",
    ),

    claimedAt: timestamp(
      "claimed_at",
      {
        withTimezone: true,
        mode: "string",
      },
    ),

    createdAt: timestamp(
      "created_at",
      {
        withTimezone: true,
        mode: "string",
      },
    )
      .notNull()
      .defaultNow(),
  },

  (table) => [
    uniqueIndex(
      "qr_reward_vouchers_token_hash_key",
    ).on(
      table.tokenHash,
    ),

    uniqueIndex(
      "qr_reward_vouchers_batch_serial_key",
    ).on(
      table.batchId,
      table.serialNumber,
    ),

    index(
      "idx_qr_reward_vouchers_batch",
    ).on(
      table.batchId,
    ),

    index(
      "idx_qr_reward_vouchers_status",
    ).on(
      table.status,
    ),

    index(
      "idx_qr_reward_vouchers_claimant",
    ).on(
      table.claimedByUserId,
    ),

    index(
      "idx_qr_reward_vouchers_expiry",
    ).on(
      table.expiresAt,
    ),
  ],
);



export const qrRewardBatchAssignments = pgTable(
  "qr_reward_batch_assignments",
  {
    id: uuid(
      "id",
    ).primaryKey(),

    batchId: uuid(
      "batch_id",
    )
      .notNull()
      .references(
        () =>
          qrRewardBatches.id,
        {
          onDelete:
            "restrict",
        },
      ),

    campaignId: uuid(
      "campaign_id",
    )
      .notNull()
      .references(
        () =>
          qrRewardCampaigns.id,
        {
          onDelete:
            "restrict",
        },
      ),

    /*
     * Commercial snapshot for THIS activation.
     *
     * Reassigning the same physical QR batch later may
     * give the remaining unused QRs a different reward.
     */
    rewardAmountMinor: integer(
      "reward_amount_minor",
    ).notNull(),

    currency: varchar(
      "currency",
      {
        length: 3,
      },
    )
      .notNull()
      .default(
        "INR",
      ),

    expiresAt: timestamp(
      "expires_at",
      {
        withTimezone: true,
        mode: "string",
      },
    ).notNull(),

    status: varchar(
      "status",
      {
        length: 32,
      },
    )
      .notNull()
      .default(
        "active",
      ),

    activatedAt: timestamp(
      "activated_at",
      {
        withTimezone: true,
        mode: "string",
      },
    )
      .notNull()
      .defaultNow(),

    deactivatedAt: timestamp(
      "deactivated_at",
      {
        withTimezone: true,
        mode: "string",
      },
    ),

    createdByUserId: integer(
      "created_by_user_id",
    ),

    createdAt: timestamp(
      "created_at",
      {
        withTimezone: true,
        mode: "string",
      },
    )
      .notNull()
      .defaultNow(),
  },

  (table) => [
    index(
      "idx_qr_reward_batch_assignments_batch",
    ).on(
      table.batchId,
    ),

    index(
      "idx_qr_reward_batch_assignments_campaign",
    ).on(
      table.campaignId,
    ),

    index(
      "idx_qr_reward_batch_assignments_status",
    ).on(
      table.status,
    ),

    /*
     * CRITICAL INVARIANT:
     *
     * A physical QR batch may never be simultaneously
     * active under two Campaigns.
     */
    uniqueIndex(
      "qr_reward_batch_assignments_one_active_per_batch",
    )
      .on(
        table.batchId,
      )
      .where(
        sql`${table.status} = 'active'`,
      ),

    check(
      "qr_reward_batch_assignment_reward_positive",
      sql`${table.rewardAmountMinor} > 0`,
    ),
  ],
);



export const qrRewardClaims = pgTable(
  "qr_reward_claims",
  {
    id: uuid("id")
      .primaryKey(),

    /*
     * UNIQUE voucher_id is one of the hard guarantees
     * that prevents a successful double redemption.
     */
    voucherId: uuid(
      "voucher_id",
    )
      .notNull()
      .references(
        () => qrRewardVouchers.id,
        {
          onDelete: "restrict",
        },
      ),

    userId: integer(
      "user_id",
    ).notNull(),

    /*
     * Snapshot which Campaign assignment actually produced
     * this financial entitlement.
     *
     * Nullable only for legacy claims created before V3.
     */
    assignmentId: uuid(
      "assignment_id",
    ).references(
      () =>
        qrRewardBatchAssignments.id,
      {
        onDelete:
          "restrict",
      },
    ),

    campaignIdSnapshot: uuid(
      "campaign_id_snapshot",
    ).references(
      () =>
        qrRewardCampaigns.id,
      {
        onDelete:
          "restrict",
      },
    ),

    rewardAmountMinorSnapshot: integer(
      "reward_amount_minor_snapshot",
    ),

    currencySnapshot: varchar(
      "currency_snapshot",
      {
        length: 3,
      },
    ),

    /*
     * Client/backend idempotency identifier.
     */
    requestId: varchar(
      "request_id",
      {
        length: 160,
      },
    ).notNull(),

    claimedAt: timestamp(
      "claimed_at",
      {
        withTimezone: true,
        mode: "string",
      },
    )
      .notNull()
      .defaultNow(),
  },

  (table) => [
    uniqueIndex(
      "qr_reward_claims_voucher_key",
    ).on(
      table.voucherId,
    ),

    uniqueIndex(
      "qr_reward_claims_request_key",
    ).on(
      table.requestId,
    ),

    index(
      "idx_qr_reward_claims_user",
    ).on(
      table.userId,
    ),

    index(
      "idx_qr_reward_claims_claimed_at",
    ).on(
      table.claimedAt,
    ),
  ],
);
