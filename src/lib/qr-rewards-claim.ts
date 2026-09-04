import "server-only";

import {
  createHash,
  randomUUID,
} from "node:crypto";

import {
  sql,
} from "drizzle-orm";

import type {
  AppDatabase,
} from "@/lib/drizzle";


export type QrRewardClaimOutcome =
  | "claimed"
  | "already_claimed"
  | "expired"
  | "revoked"
  | "unavailable"
  | "invalid"
  | "request_conflict"
  | "entity_required"
  | "entity_invalid";


export type QrRewardClaimResult = {
  outcome:
    QrRewardClaimOutcome;

  idempotent?: boolean;

  voucherId?: string;
  claimId?: string;

  batchId?: string;
  batchCode?: string;

  assignmentId?: string;

  campaignId?: string;
  campaignName?: string;

  entityTypeId?: number;
  entityTypeName?: string;

  entityRecordId?: string;
  entityLabel?: string;

  attributionMode?: string;

  serialNumber?: number;

  rewardAmountMinor?: number;
  currency?: string;

  claimedByUserId?: number;
  claimedAt?: string;

  expiresAt?: string;
};


type VoucherRecord = {
  voucherId: string;
  serialNumber: number;

  voucherStatus: string;
  voucherExpiresAt: unknown;

  claimedByUserId:
    | number
    | null;

  claimedAt:
    | unknown
    | null;

  batchId: string;
  batchCode: string;
  batchStatus: string;

  assignmentId:
    | string
    | null;

  assignmentStatus:
    | string
    | null;

  attributionMode:
    | string
    | null;

  assignmentExpiresAt:
    | unknown
    | null;

  rewardAmountMinor:
    | number
    | null;

  currency:
    | string
    | null;

  campaignId:
    | string
    | null;

  campaignName:
    | string
    | null;

  campaignStatus:
    | string
    | null;

  campaignStartsAt:
    | unknown
    | null;

  campaignExpiresAt:
    | unknown
    | null;

  entityTypeId:
    | number
    | null;

  entityTypeName:
    | string
    | null;

  entityRecordId:
    | string
    | null;

  entityLabel:
    | string
    | null;
};


type ResolvedEntity = {
  entityTypeId: number;
  entityTypeName: string;

  entityRecordId: string;
  entityLabel: string;
};


function sha256(
  value: string,
) {
  return createHash(
    "sha256",
  )
    .update(
      value,
      "utf8",
    )
    .digest(
      "hex",
    );
}


function iso(
  value: unknown,
): string | undefined {
  if (!value) {
    return undefined;
  }

  const date =
    value instanceof Date
      ? value
      : new Date(
          String(
            value,
          ),
        );

  if (
    Number.isNaN(
      date.getTime(),
    )
  ) {
    return undefined;
  }

  return date.toISOString();
}


export function isQrRewardPayload(
  value: string,
) {
  return /^BRX:Q:1:[A-Za-z0-9_-]{43}$/.test(
    value,
  );
}


async function voucherByHash(
  db: AppDatabase,
  tokenHash: string,
): Promise<
  VoucherRecord | null
> {
  const result =
    await db.execute(sql`
      SELECT
        v.id
          AS "voucherId",

        v.serial_number
          AS "serialNumber",

        v.status
          AS "voucherStatus",

        v.expires_at
          AS "voucherExpiresAt",

        v.claimed_by_user_id
          AS "claimedByUserId",

        v.claimed_at
          AS "claimedAt",

        b.id
          AS "batchId",

        b.batch_code
          AS "batchCode",

        b.status
          AS "batchStatus",

        a.id
          AS "assignmentId",

        a.status
          AS "assignmentStatus",

        a.attribution_mode
          AS "attributionMode",

        a.expires_at
          AS "assignmentExpiresAt",

        a.reward_amount_minor
          AS "rewardAmountMinor",

        a.currency,

        c.id
          AS "campaignId",

        c.name
          AS "campaignName",

        c.status
          AS "campaignStatus",

        c.starts_at
          AS "campaignStartsAt",

        c.expires_at
          AS "campaignExpiresAt",

        a.entity_type_id
          AS "entityTypeId",

        et.title
          AS "entityTypeName",

        a.entity_record_id
          AS "entityRecordId",

        a.entity_label_snapshot
          AS "entityLabel"

      FROM
        qr_reward_vouchers v

      INNER JOIN
        qr_reward_batches b
          ON b.id =
            v.batch_id

      LEFT JOIN
        qr_reward_batch_assignments a
          ON
            a.batch_id =
              b.id

            AND
            a.status =
              'active'

      LEFT JOIN
        qr_reward_campaigns c
          ON c.id =
            a.campaign_id

      LEFT JOIN
        entity_types et
          ON et.id =
            a.entity_type_id

      WHERE
        v.token_hash =
          ${tokenHash}

      LIMIT 1
    `);

  return (
    result.rows[0] as
      | VoucherRecord
      | undefined
  ) ??
    null;
}


async function claimByVoucher(
  db: AppDatabase,
  voucherId: string,
) {
  const result =
    await db.execute(sql`
      SELECT
        cl.id
          AS "claimId",

        cl.voucher_id
          AS "voucherId",

        cl.user_id
          AS "userId",

        cl.claimed_at
          AS "claimedAt",

        cl.assignment_id
          AS "assignmentId",

        cl.campaign_id_snapshot
          AS "campaignId",

        c.name
          AS "campaignName",

        cl.reward_amount_minor_snapshot
          AS "rewardAmountMinor",

        cl.currency_snapshot
          AS currency,

        cl.entity_type_id_snapshot
          AS "entityTypeId",

        cl.entity_type_label_snapshot
          AS "entityTypeName",

        cl.entity_record_id_snapshot
          AS "entityRecordId",

        cl.entity_label_snapshot
          AS "entityLabel",

        v.serial_number
          AS "serialNumber",

        b.id
          AS "batchId",

        b.batch_code
          AS "batchCode"

      FROM
        qr_reward_claims cl

      INNER JOIN
        qr_reward_vouchers v
          ON v.id =
            cl.voucher_id

      INNER JOIN
        qr_reward_batches b
          ON b.id =
            v.batch_id

      LEFT JOIN
        qr_reward_campaigns c
          ON c.id =
            cl.campaign_id_snapshot

      WHERE
        cl.voucher_id =
          ${voucherId}::uuid

      LIMIT 1
    `);

  return result.rows[0] as
    | Record<
        string,
        unknown
      >
    | undefined;
}


async function resolveEntity(
  db: AppDatabase,
  voucher: VoucherRecord,
  requestedEntityRecordId:
    | string
    | null
    | undefined,
): Promise<
  | {
      entity:
        | ResolvedEntity
        | null;
    }
  | {
      error:
        "entity_required"
        | "entity_invalid";
    }
> {
  if (
    voucher.attributionMode ===
      "none" ||
    !voucher.attributionMode
  ) {
    return {
      entity:
        null,
    };
  }


  if (
    voucher.attributionMode ===
      "fixed_entity"
  ) {
    if (
      !voucher.entityRecordId ||
      !voucher.entityTypeId ||
      !voucher.entityTypeName ||
      !voucher.entityLabel
    ) {
      return {
        error:
          "entity_invalid",
      };
    }

    return {
      entity: {
        entityTypeId:
          Number(
            voucher.entityTypeId,
          ),

        entityTypeName:
          voucher.entityTypeName,

        entityRecordId:
          voucher.entityRecordId,

        entityLabel:
          voucher.entityLabel,
      },
    };
  }


  const entityId =
    String(
      requestedEntityRecordId ??
        "",
    ).trim();

  if (!entityId) {
    return {
      error:
        "entity_required",
    };
  }

  const result =
    await db.execute(sql`
      SELECT
        er.id,

        et.id
          AS "entityTypeId",

        et.title
          AS "entityTypeName",

        COALESCE(
          (
            SELECT
              NULLIF(
                er.data ->> f.key,
                ''
              )

            FROM
              jsonb_array_elements_text(
                et.searchable_fields
              ) AS f(key)

            WHERE
              NULLIF(
                er.data ->> f.key,
                ''
              ) IS NOT NULL

            LIMIT 1
          ),

          NULLIF(
            er.data ->> 'name',
            ''
          ),

          NULLIF(
            er.data ->> 'title',
            ''
          ),

          er.external_key,

          er.id::text
        ) AS "entityLabel"

      FROM
        qr_reward_campaign_entities ce

      INNER JOIN
        entity_records er
          ON er.id =
            ce.entity_record_id

      INNER JOIN
        entity_types et
          ON et.id =
            ce.entity_type_id

      WHERE
        ce.campaign_id =
          ${voucher.campaignId}::uuid

        AND
        er.id =
          ${entityId}::uuid

        AND
        er.status =
          'active'

        AND
        et.is_active =
          true

      LIMIT 1
    `);

  const row =
    result.rows[0] as
      | {
          id: string;
          entityTypeId: number;
          entityTypeName: string;
          entityLabel: string;
        }
      | undefined;

  if (!row) {
    return {
      error:
        "entity_invalid",
    };
  }

  return {
    entity: {
      entityTypeId:
        Number(
          row.entityTypeId,
        ),

      entityTypeName:
        String(
          row.entityTypeName,
        ),

      entityRecordId:
        String(
          row.id,
        ),

      entityLabel:
        String(
          row.entityLabel,
        ),
    },
  };
}


function historicalResult(
  row:
    Record<
      string,
      unknown
    >,
): QrRewardClaimResult {
  return {
    outcome:
      "already_claimed",

    claimId:
      row.claimId
        ? String(
            row.claimId,
          )
        : undefined,

    voucherId:
      row.voucherId
        ? String(
            row.voucherId,
          )
        : undefined,

    batchId:
      row.batchId
        ? String(
            row.batchId,
          )
        : undefined,

    batchCode:
      row.batchCode
        ? String(
            row.batchCode,
          )
        : undefined,

    assignmentId:
      row.assignmentId
        ? String(
            row.assignmentId,
          )
        : undefined,

    campaignId:
      row.campaignId
        ? String(
            row.campaignId,
          )
        : undefined,

    campaignName:
      row.campaignName
        ? String(
            row.campaignName,
          )
        : undefined,

    entityTypeId:
      row.entityTypeId
        ? Number(
            row.entityTypeId,
          )
        : undefined,

    entityTypeName:
      row.entityTypeName
        ? String(
            row.entityTypeName,
          )
        : undefined,

    entityRecordId:
      row.entityRecordId
        ? String(
            row.entityRecordId,
          )
        : undefined,

    entityLabel:
      row.entityLabel
        ? String(
            row.entityLabel,
          )
        : undefined,

    serialNumber:
      row.serialNumber
        ? Number(
            row.serialNumber,
          )
        : undefined,

    rewardAmountMinor:
      row.rewardAmountMinor
        ? Number(
            row.rewardAmountMinor,
          )
        : undefined,

    currency:
      row.currency
        ? String(
            row.currency,
          )
        : undefined,

    claimedByUserId:
      row.userId
        ? Number(
            row.userId,
          )
        : undefined,

    claimedAt:
      iso(
        row.claimedAt,
      ),
  };
}


export async function claimQrReward(
  db: AppDatabase,
  input: {
    qrPayload: string;
    requestId: string;
    userId: number;

    /*
     * Used only when the assignment says claimant_selects.
     */
    entityRecordId?:
      | string
      | null;
  },
): Promise<QrRewardClaimResult> {
  const qrPayload =
    input.qrPayload.trim();

  const requestId =
    input.requestId.trim();

  const userId =
    Number(
      input.userId,
    );

  if (
    !Number.isInteger(
      userId,
    ) ||
    userId <= 0
  ) {
    throw new Error(
      "Authenticated user ID is invalid.",
    );
  }

  if (
    requestId.length < 8 ||
    requestId.length > 160
  ) {
    return {
      outcome:
        "request_conflict",
    };
  }

  if (
    !isQrRewardPayload(
      qrPayload,
    )
  ) {
    return {
      outcome:
        "invalid",
    };
  }

  await db.execute(sql`
    SELECT
      pg_advisory_xact_lock(
        hashtextextended(
          ${`brixta:qr-claim:${requestId}`},
          0
        )
      )
  `);

  const voucher =
    await voucherByHash(
      db,
      sha256(
        qrPayload,
      ),
    );

  if (!voucher) {
    return {
      outcome:
        "invalid",
    };
  }

  if (
    voucher.voucherStatus ===
      "claimed" ||
    voucher.claimedAt
  ) {
    const historical =
      await claimByVoucher(
        db,
        voucher.voucherId,
      );

    if (historical) {
      return historicalResult(
        historical,
      );
    }

    return {
      outcome:
        "already_claimed",
      voucherId:
        voucher.voucherId,
    };
  }

  if (
    voucher.voucherStatus ===
      "revoked" ||
    voucher.batchStatus ===
      "revoked"
  ) {
    return {
      outcome:
        "revoked",
      voucherId:
        voucher.voucherId,
    };
  }

  if (
    !voucher.assignmentId ||
    voucher.assignmentStatus !==
      "active" ||
    !voucher.campaignId
  ) {
    return {
      outcome:
        "unavailable",
      voucherId:
        voucher.voucherId,
    };
  }

  const now =
    Date.now();

  const assignmentExpiry =
    new Date(
      String(
        voucher.assignmentExpiresAt,
      ),
    ).getTime();

  const campaignExpiry =
    new Date(
      String(
        voucher.campaignExpiresAt,
      ),
    ).getTime();

  const campaignStart =
    new Date(
      String(
        voucher.campaignStartsAt,
      ),
    ).getTime();

  if (
    assignmentExpiry <=
      now ||
    campaignExpiry <=
      now
  ) {
    await db.execute(sql`
      UPDATE
        qr_reward_vouchers

      SET
        status =
          'expired'

      WHERE
        id =
          ${voucher.voucherId}::uuid

        AND
        claimed_at
          IS NULL

        AND
        status =
          'available'
    `);

    return {
      outcome:
        "expired",

      voucherId:
        voucher.voucherId,
    };
  }

  if (
    campaignStart >
      now ||
    voucher.campaignStatus !==
      "active" ||
    ![
      "ready",
      "partially_printed",
      "printed",
    ].includes(
      voucher.batchStatus,
    )
  ) {
    return {
      outcome:
        "unavailable",

      voucherId:
        voucher.voucherId,
    };
  }

  const entityResolution =
    await resolveEntity(
      db,
      voucher,
      input.entityRecordId,
    );

  if (
    "error" in
    entityResolution
  ) {
    return {
      outcome:
        entityResolution.error,

      voucherId:
        voucher.voucherId,

      campaignId:
        voucher.campaignId,

      campaignName:
        voucher.campaignName ??
        undefined,

      attributionMode:
        voucher.attributionMode ??
        undefined,

      rewardAmountMinor:
        voucher.rewardAmountMinor
          ? Number(
              voucher.rewardAmountMinor,
            )
          : undefined,

      currency:
        voucher.currency ??
        undefined,
    };
  }

  const entity =
    entityResolution.entity;

  const updated =
    await db.execute(sql`
      UPDATE
        qr_reward_vouchers AS v

      SET
        status =
          'claimed',

        claimed_by_user_id =
          ${userId},

        claimed_at =
          now()

      FROM
        qr_reward_batches AS b,
        qr_reward_batch_assignments AS a,
        qr_reward_campaigns AS c

      WHERE
        v.id =
          ${voucher.voucherId}::uuid

        AND
        v.batch_id =
          b.id

        AND
        a.id =
          ${voucher.assignmentId}::uuid

        AND
        a.batch_id =
          b.id

        AND
        a.status =
          'active'

        AND
        a.campaign_id =
          c.id

        AND
        v.status =
          'available'

        AND
        v.claimed_at
          IS NULL

        AND
        v.expires_at >
          now()

        AND
        a.expires_at >
          now()

        AND
        b.status IN (
          'ready',
          'partially_printed',
          'printed'
        )

        AND
        c.status =
          'active'

        AND
        c.starts_at <=
          now()

        AND
        c.expires_at >
          now()

      RETURNING
        v.id,

        v.claimed_at
          AS "claimedAt"
    `);

  const winner =
    updated.rows[0] as
      | {
          id?: unknown;
          claimedAt?: unknown;
        }
      | undefined;

  if (!winner?.id) {
    const historical =
      await claimByVoucher(
        db,
        voucher.voucherId,
      );

    if (historical) {
      return historicalResult(
        historical,
      );
    }

    return {
      outcome:
        "unavailable",
    };
  }

  const claimId =
    randomUUID();

  const claimedAt =
    iso(
      winner.claimedAt,
    ) ??
    new Date()
      .toISOString();

  await db.execute(sql`
    INSERT INTO
      qr_reward_claims (
        id,
        voucher_id,
        user_id,
        request_id,

        assignment_id,

        campaign_id_snapshot,
        reward_amount_minor_snapshot,
        currency_snapshot,

        entity_type_id_snapshot,
        entity_record_id_snapshot,

        entity_type_label_snapshot,
        entity_label_snapshot,

        claimed_at
      )

    VALUES (
      ${claimId},

      ${voucher.voucherId}::uuid,

      ${userId},

      ${requestId},

      ${voucher.assignmentId}::uuid,

      ${voucher.campaignId}::uuid,

      ${Number(
        voucher.rewardAmountMinor,
      )},

      ${voucher.currency},

      ${
        entity
          ?.entityTypeId ??
        null
      },

      ${
        entity
          ?.entityRecordId ??
        null
      }::uuid,

      ${
        entity
          ?.entityTypeName ??
        null
      },

      ${
        entity
          ?.entityLabel ??
        null
      },

      ${claimedAt}
    )
  `);

  return {
    outcome:
      "claimed",

    voucherId:
      voucher.voucherId,

    claimId,

    batchId:
      voucher.batchId,

    batchCode:
      voucher.batchCode,

    assignmentId:
      voucher.assignmentId,

    campaignId:
      voucher.campaignId,

    campaignName:
      voucher.campaignName ??
      undefined,

    attributionMode:
      voucher.attributionMode ??
      undefined,

    entityTypeId:
      entity
        ?.entityTypeId,

    entityTypeName:
      entity
        ?.entityTypeName,

    entityRecordId:
      entity
        ?.entityRecordId,

    entityLabel:
      entity
        ?.entityLabel,

    serialNumber:
      Number(
        voucher.serialNumber,
      ),

    rewardAmountMinor:
      Number(
        voucher.rewardAmountMinor,
      ),

    currency:
      voucher.currency ??
      undefined,

    claimedByUserId:
      userId,

    claimedAt,

    expiresAt:
      iso(
        voucher.assignmentExpiresAt,
      ),
  };
}
