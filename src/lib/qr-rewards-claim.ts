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
  | "request_conflict";


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
};


type ExistingClaimRecord = {
  claimId: string;

  requestId: string;

  voucherId: string;

  userId: number;

  claimedAt: unknown;

  serialNumber: number;

  batchId: string;
  batchCode: string;

  assignmentId:
    | string
    | null;

  campaignId:
    | string
    | null;

  campaignName:
    | string
    | null;

  rewardAmountMinor:
    | number
    | null;

  currency:
    | string
    | null;

  expiresAt:
    | unknown
    | null;
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
          AS "campaignExpiresAt"

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

      WHERE
        v.token_hash =
          ${tokenHash}

      LIMIT 1
    `);

  return (
    result.rows[0] as
      | VoucherRecord
      | undefined
  ) ?? null;
}


async function claimByRequestId(
  db: AppDatabase,
  requestId: string,
): Promise<
  ExistingClaimRecord | null
> {
  const result =
    await db.execute(sql`
      SELECT
        cl.id
          AS "claimId",

        cl.request_id
          AS "requestId",

        cl.voucher_id
          AS "voucherId",

        cl.user_id
          AS "userId",

        cl.claimed_at
          AS "claimedAt",

        v.serial_number
          AS "serialNumber",

        b.id
          AS "batchId",

        b.batch_code
          AS "batchCode",

        cl.assignment_id
          AS "assignmentId",

        COALESCE(
          cl.campaign_id_snapshot,
          b.campaign_id
        ) AS "campaignId",

        c.name
          AS "campaignName",

        COALESCE(
          cl.reward_amount_minor_snapshot,
          b.reward_amount_minor
        ) AS "rewardAmountMinor",

        COALESCE(
          cl.currency_snapshot,
          b.currency
        ) AS currency,

        v.expires_at
          AS "expiresAt"

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
            COALESCE(
              cl.campaign_id_snapshot,
              b.campaign_id
            )

      WHERE
        cl.request_id =
          ${requestId}

      LIMIT 1
    `);

  return (
    result.rows[0] as
      | ExistingClaimRecord
      | undefined
  ) ?? null;
}


function fromExisting(
  claim:
    ExistingClaimRecord,
): QrRewardClaimResult {
  return {
    outcome:
      "claimed",

    idempotent:
      true,

    voucherId:
      claim.voucherId,

    claimId:
      claim.claimId,

    batchId:
      claim.batchId,

    batchCode:
      claim.batchCode,

    assignmentId:
      claim.assignmentId ??
      undefined,

    campaignId:
      claim.campaignId ??
      undefined,

    campaignName:
      claim.campaignName ??
      undefined,

    serialNumber:
      Number(
        claim.serialNumber,
      ),

    rewardAmountMinor:
      claim.rewardAmountMinor ===
        null
        ? undefined
        : Number(
            claim.rewardAmountMinor,
          ),

    currency:
      claim.currency ??
      undefined,

    claimedByUserId:
      Number(
        claim.userId,
      ),

    claimedAt:
      iso(
        claim.claimedAt,
      ),

    expiresAt:
      iso(
        claim.expiresAt,
      ),
  };
}


function stateResult(
  voucher:
    VoucherRecord,
  outcome:
    QrRewardClaimOutcome,
): QrRewardClaimResult {
  return {
    outcome,

    voucherId:
      voucher.voucherId,

    batchId:
      voucher.batchId,

    batchCode:
      voucher.batchCode,

    assignmentId:
      voucher.assignmentId ??
      undefined,

    campaignId:
      voucher.campaignId ??
      undefined,

    campaignName:
      voucher.campaignName ??
      undefined,

    serialNumber:
      Number(
        voucher.serialNumber,
      ),

    rewardAmountMinor:
      voucher.rewardAmountMinor ===
        null
        ? undefined
        : Number(
            voucher.rewardAmountMinor,
          ),

    currency:
      voucher.currency ??
      undefined,

    claimedByUserId:
      voucher.claimedByUserId
        ? Number(
            voucher.claimedByUserId,
          )
        : undefined,

    claimedAt:
      iso(
        voucher.claimedAt,
      ),

    expiresAt:
      iso(
        voucher.assignmentExpiresAt ??
          voucher.voucherExpiresAt,
      ),
  };
}


/*
 * ============================================================
 * ATOMIC QR CLAIM V3
 * ============================================================
 *
 * QR ownership remains permanent once claimed.
 *
 * Batch Campaign assignment may change ONLY for remaining
 * unused physical QRs.
 */
export async function claimQrReward(
  db: AppDatabase,
  input: {
    qrPayload: string;
    requestId: string;
    userId: number;
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


  const tokenHash =
    sha256(
      qrPayload,
    );


  const voucher =
    await voucherByHash(
      db,
      tokenHash,
    );


  if (!voucher) {
    return {
      outcome:
        "invalid",
    };
  }


  const existing =
    await claimByRequestId(
      db,
      requestId,
    );


  if (existing) {
    if (
      existing.voucherId !==
      voucher.voucherId
    ) {
      return {
        outcome:
          "request_conflict",
      };
    }

    return fromExisting(
      existing,
    );
  }


  /*
   * Permanent one-time ownership beats every assignment rule.
   */
  if (
    voucher.voucherStatus ===
      "claimed" ||
    voucher.claimedAt
  ) {
    return stateResult(
      voucher,
      "already_claimed",
    );
  }


  if (
    voucher.voucherStatus ===
      "revoked" ||
    voucher.batchStatus ===
      "revoked"
  ) {
    return stateResult(
      voucher,
      "revoked",
    );
  }


  /*
   * No current Campaign activation.
   */
  if (
    !voucher.assignmentId ||
    voucher.assignmentStatus !==
      "active" ||
    !voucher.campaignId
  ) {
    return stateResult(
      voucher,
      "unavailable",
    );
  }


  if (
    voucher.campaignStatus ===
      "revoked"
  ) {
    return stateResult(
      voucher,
      "revoked",
    );
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
          ${voucher.voucherId}

        AND
        claimed_at
          IS NULL

        AND
        status =
          'available'
    `);

    return stateResult(
      voucher,
      "expired",
    );
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
    return stateResult(
      voucher,
      "unavailable",
    );
  }


  /*
   * ==========================================================
   * CRITICAL CLAIM UPDATE
   *
   * Current ACTIVE assignment must still exist at the exact
   * instant PostgreSQL performs AVAILABLE -> CLAIMED.
   * ==========================================================
   */
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
          ${voucher.voucherId}

        AND
        v.batch_id =
          b.id

        AND
        a.id =
          ${voucher.assignmentId}

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
        v.id
          AS "voucherId",

        v.claimed_at
          AS "claimedAt"
    `);


  const winner =
    updated.rows[0] as
      | {
          voucherId?: unknown;
          claimedAt?: unknown;
        }
      | undefined;


  if (
    !winner?.voucherId
  ) {
    const current =
      await voucherByHash(
        db,
        tokenHash,
      );

    if (!current) {
      return {
        outcome:
          "invalid",
      };
    }

    if (
      current.voucherStatus ===
        "claimed" ||
      current.claimedAt
    ) {
      return stateResult(
        current,
        "already_claimed",
      );
    }

    if (
      current.voucherStatus ===
        "revoked" ||
      current.batchStatus ===
        "revoked"
    ) {
      return stateResult(
        current,
        "revoked",
      );
    }

    return stateResult(
      current,
      "unavailable",
    );
  }


  const claimId =
    randomUUID();

  const claimedAt =
    iso(
      winner.claimedAt,
    ) ??
    new Date()
      .toISOString();


  /*
   * Snapshot the active Campaign assignment.
   *
   * From this point forward, future reassignment cannot
   * alter what this claimant won.
   */
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

        claimed_at
      )

    VALUES (
      ${claimId},

      ${voucher.voucherId},

      ${userId},

      ${requestId},

      ${voucher.assignmentId},

      ${voucher.campaignId},

      ${Number(
        voucher.rewardAmountMinor,
      )},

      ${voucher.currency},

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
