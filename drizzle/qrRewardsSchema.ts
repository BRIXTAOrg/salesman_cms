import {
  check,
  index,
  integer,
  jsonb,
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


import {
  entityRecords,
  entityTypes,
} from "./platformVNextSchema";


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



/*
 * ==========================================================
 * SCHEME
 *
 * Reusable business policy container.
 * ==========================================================
 */
export const qrRewardSchemes = pgTable(
  "qr_reward_schemes",
  {
    id: uuid(
      "id",
    ).primaryKey(),

    name: varchar(
      "name",
      {
        length: 180,
      },
    ).notNull(),

    description: text(
      "description",
    ),

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
      "idx_qr_reward_schemes_status",
    ).on(
      table.status,
    ),
  ],
);


/*
 * ==========================================================
 * IMMUTABLE VERSIONED RULEBOOK
 *
 * NEVER update an old version.
 * Publishing changes creates version N+1.
 * ==========================================================
 */
export const qrRewardRulebooks = pgTable(
  "qr_reward_rulebooks",
  {
    id: uuid(
      "id",
    ).primaryKey(),

    schemeId: uuid(
      "scheme_id",
    )
      .notNull()
      .references(
        () =>
          qrRewardSchemes.id,
        {
          onDelete:
            "restrict",
        },
      ),

    version: integer(
      "version",
    ).notNull(),

    status: varchar(
      "status",
      {
        length: 32,
      },
    )
      .notNull()
      .default(
        "published",
      ),

    /*
     * Supported V1 reward policies:
     *
     * fixed:
     * {
     *   type: "fixed",
     *   amountMinor: 10000
     * }
     *
     * formula:
     * {
     *   type: "formula",
     *   baseAmountMinor: 5000,
     *   adjustments: [...]
     * }
     */
    rewardPolicy: jsonb(
      "reward_policy",
    )
      .$type<
        Record<string, unknown>
      >()
      .notNull(),

    claimLimitPolicy: jsonb(
      "claim_limit_policy",
    )
      .$type<
        Record<string, unknown>
      >()
      .notNull()
      .default(
        sql`'{}'::jsonb`,
      ),

    fraudPolicy: jsonb(
      "fraud_policy",
    )
      .$type<
        Record<string, unknown>
      >()
      .notNull()
      .default(
        sql`'{}'::jsonb`,
      ),

    validityPolicy: jsonb(
      "validity_policy",
    )
      .$type<
        Record<string, unknown>
      >()
      .notNull()
      .default(
        sql`'{}'::jsonb`,
      ),

    rulesHash: varchar(
      "rules_hash",
      {
        length: 64,
      },
    ).notNull(),

    createdByUserId: integer(
      "created_by_user_id",
    ),

    publishedAt: timestamp(
      "published_at",
      {
        withTimezone: true,
        mode: "string",
      },
    )
      .notNull()
      .defaultNow(),

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
      "qr_reward_rulebooks_scheme_version_key",
    ).on(
      table.schemeId,
      table.version,
    ),

    index(
      "idx_qr_reward_rulebooks_scheme",
    ).on(
      table.schemeId,
    ),
  ],
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

    /*
     * Current Campaign policy selection.
     *
     * Existing Batch Assignments retain their own immutable
     * Rulebook snapshot if the Campaign later switches.
     */
    schemeId: uuid(
      "scheme_id",
    ).references(
      () =>
        qrRewardSchemes.id,
      {
        onDelete:
          "restrict",
      },
    ),

    currentRulebookId: uuid(
      "current_rulebook_id",
    ).references(
      () =>
        qrRewardRulebooks.id,
      {
        onDelete:
          "restrict",
      },
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



/*
 * Campaign ↔ BRIXTA Entity records.
 *
 * QR Rewards does NOT create its own Dealer/Store/Mason tables.
 * These IDs point directly at BRIXTA's reusable Entity Store.
 */
export const qrRewardCampaignEntities = pgTable(
  "qr_reward_campaign_entities",
  {
    id: uuid(
      "id",
    ).primaryKey(),

    campaignId: uuid(
      "campaign_id",
    )
      .notNull()
      .references(
        () =>
          qrRewardCampaigns.id,
        {
          onDelete:
            "cascade",
        },
      ),

    entityTypeId: integer(
      "entity_type_id",
    )
      .notNull()
      .references(
        () =>
          entityTypes.id,
        {
          onDelete:
            "restrict",
        },
      ),

    entityRecordId: uuid(
      "entity_record_id",
    )
      .notNull()
      .references(
        () =>
          entityRecords.id,
        {
          onDelete:
            "restrict",
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
    uniqueIndex(
      "qr_reward_campaign_entities_campaign_record_key",
    ).on(
      table.campaignId,
      table.entityRecordId,
    ),

    index(
      "idx_qr_reward_campaign_entities_campaign",
    ).on(
      table.campaignId,
    ),

    index(
      "idx_qr_reward_campaign_entities_type",
    ).on(
      table.entityTypeId,
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
     * Exact policy contract used by this activation.
     *
     * These values DO NOT follow future Campaign updates.
     */
    schemeId: uuid(
      "scheme_id",
    ).references(
      () =>
        qrRewardSchemes.id,
      {
        onDelete:
          "restrict",
      },
    ),

    rulebookId: uuid(
      "rulebook_id",
    ).references(
      () =>
        qrRewardRulebooks.id,
      {
        onDelete:
          "restrict",
      },
    ),

    rulebookVersion: integer(
      "rulebook_version",
    ),

    rulesHash: varchar(
      "rules_hash",
      {
        length: 64,
      },
    ),

    /*
     * How this batch receives Entity attribution:
     *
     * none
     * fixed_entity
     * claimant_selects
     */
    attributionMode: varchar(
      "attribution_mode",
      {
        length: 32,
      },
    )
      .notNull()
      .default(
        "none",
      ),

    entityTypeId: integer(
      "entity_type_id",
    ).references(
      () =>
        entityTypes.id,
      {
        onDelete:
          "restrict",
      },
    ),

    entityRecordId: uuid(
      "entity_record_id",
    ).references(
      () =>
        entityRecords.id,
      {
        onDelete:
          "restrict",
      },
    ),

    /*
     * Immutable human-readable label for the assignment.
     */
    entityLabelSnapshot: varchar(
      "entity_label_snapshot",
      {
        length: 500,
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
     * Stable claimant key used by Rulebook limits.
     *
     * Today:
     *   SHA256("brixta_user:<id>")
     *
     * Public web redemption later:
     *   SHA256(normalized verified UPI / claimant identity)
     */
    claimantKeyHash: varchar(
      "claimant_key_hash",
      {
        length: 64,
      },
    ),

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
     * Exact Scheme / Rulebook used when money became owed.
     */
    schemeIdSnapshot: uuid(
      "scheme_id_snapshot",
    ).references(
      () =>
        qrRewardSchemes.id,
      {
        onDelete:
          "restrict",
      },
    ),

    schemeNameSnapshot: varchar(
      "scheme_name_snapshot",
      {
        length: 180,
      },
    ),

    rulebookIdSnapshot: uuid(
      "rulebook_id_snapshot",
    ).references(
      () =>
        qrRewardRulebooks.id,
      {
        onDelete:
          "restrict",
      },
    ),

    rulebookVersionSnapshot: integer(
      "rulebook_version_snapshot",
    ),

    rulesHashSnapshot: varchar(
      "rules_hash_snapshot",
      {
        length: 64,
      },
    ),


    /*
     * Entity attribution is snapshotted at CLAIM time.
     * Renaming/reassigning Entities later cannot rewrite history.
     */
    entityTypeIdSnapshot: integer(
      "entity_type_id_snapshot",
    ).references(
      () =>
        entityTypes.id,
      {
        onDelete:
          "restrict",
      },
    ),

    entityRecordIdSnapshot: uuid(
      "entity_record_id_snapshot",
    ).references(
      () =>
        entityRecords.id,
      {
        onDelete:
          "restrict",
      },
    ),

    entityTypeLabelSnapshot: varchar(
      "entity_type_label_snapshot",
      {
        length: 220,
      },
    ),

    entityLabelSnapshot: varchar(
      "entity_label_snapshot",
      {
        length: 500,
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



/*
 * ==========================================================
 * RULE ENGINE AUDIT
 *
 * Every PASS/FAIL decision can be inspected later.
 * ==========================================================
 */
export const qrRewardRuleEvaluations = pgTable(
  "qr_reward_rule_evaluations",
  {
    id: uuid(
      "id",
    ).primaryKey(),

    voucherId: uuid(
      "voucher_id",
    ).references(
      () =>
        qrRewardVouchers.id,
      {
        onDelete:
          "restrict",
      },
    ),

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

    claimId: uuid(
      "claim_id",
    ).references(
      () =>
        qrRewardClaims.id,
      {
        onDelete:
          "restrict",
      },
    ),

    schemeId: uuid(
      "scheme_id",
    ).references(
      () =>
        qrRewardSchemes.id,
      {
        onDelete:
          "restrict",
      },
    ),

    rulebookId: uuid(
      "rulebook_id",
    ).references(
      () =>
        qrRewardRulebooks.id,
      {
        onDelete:
          "restrict",
      },
    ),

    rulebookVersion: integer(
      "rulebook_version",
    ),

    phase: varchar(
      "phase",
      {
        length: 32,
      },
    ).notNull(),

    decision: varchar(
      "decision",
      {
        length: 16,
      },
    ).notNull(),

    reasonCodes: jsonb(
      "reason_codes",
    )
      .$type<string[]>()
      .notNull()
      .default(
        sql`'[]'::jsonb`,
      ),

    facts: jsonb(
      "facts",
    )
      .$type<
        Record<string, unknown>
      >()
      .notNull()
      .default(
        sql`'{}'::jsonb`,
      ),

    evaluatedAt: timestamp(
      "evaluated_at",
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
      "idx_qr_reward_rule_eval_voucher",
    ).on(
      table.voucherId,
    ),

    index(
      "idx_qr_reward_rule_eval_claim",
    ).on(
      table.claimId,
    ),

    index(
      "idx_qr_reward_rule_eval_time",
    ).on(
      table.evaluatedAt,
    ),
  ],
);
