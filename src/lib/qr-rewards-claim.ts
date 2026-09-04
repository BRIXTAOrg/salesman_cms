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
  outcome: QrRewardClaimOutcome;

  idempotent?: boolean;

  voucherId?: string;
  claimId?: string;

  batchId?: string;
  batchCode?: string;

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

  claimedByUserId: number | null;
  claimedAt: unknown;

  batchId: string;
  batchCode: string;
  batchStatus: string;

  rewardAmountMinor: number;
  currency: string;
  batchExpiresAt: unknown;

  campaignId: string;
  campaignName: string;
  campaignStatus: string;

  campaignStartsAt: unknown;
  campaignExpiresAt: unknown;
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

  rewardAmountMinor: number;
  currency: string;

  campaignId: string;
  campaignName: string;

  expiresAt: unknown;
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
          String(value),
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
  /*
   * randomBytes(32).toString("base64url")
   * produces a 43-character URL-safe bearer secret.
   */
  return /^BRX:Q:1:[A-Za-z0-9_-]{43}$/.test(
    value,
  );
}


async function voucherByHash(
  db: AppDatabase,
  tokenHash: string,
): Promise<VoucherRecord | null> {
  const result =
    await db.execute(sql`
      SELECT
        v.id AS "voucherId",
        v.serial_number AS "serialNumber",

        v.status AS "voucherStatus",
        v.expires_at AS "voucherExpiresAt",

        v.claimed_by_user_id AS "claimedByUserId",
        v.claimed_at AS "claimedAt",

        b.id AS "batchId",
        b.batch_code AS "batchCode",
        b.status AS "batchStatus",

        b.reward_amount_minor AS "rewardAmountMinor",
        b.currency,
        b.expires_at AS "batchExpiresAt",

        c.id AS "campaignId",
        c.name AS "campaignName",
        c.status AS "campaignStatus",

        c.starts_at AS "campaignStartsAt",
        c.expires_at AS "campaignExpiresAt"

      FROM qr_reward_vouchers v

      INNER JOIN qr_reward_batches b
        ON b.id = v.batch_id

      INNER JOIN qr_reward_campaigns c
        ON c.id = b.campaign_id

      WHERE
        v.token_hash = ${tokenHash}

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
): Promise<ExistingClaimRecord | null> {
  const result =
    await db.execute(sql`
      SELECT
        cl.id AS "claimId",
        cl.request_id AS "requestId",

        cl.voucher_id AS "voucherId",

        cl.user_id AS "userId",

        cl.claimed_at AS "claimedAt",

        v.serial_number AS "serialNumber",

        b.id AS "batchId",
        b.batch_code AS "batchCode",

        b.reward_amount_minor AS "rewardAmountMinor",
        b.currency,

        c.id AS "campaignId",
        c.name AS "campaignName",

        v.expires_at AS "expiresAt"

      FROM qr_reward_claims cl

      INNER JOIN qr_reward_vouchers v
        ON v.id = cl.voucher_id

      INNER JOIN qr_reward_batches b
        ON b.id = v.batch_id

      INNER JOIN qr_reward_campaigns c
        ON c.id = b.campaign_id

      WHERE
        cl.request_id = ${requestId}

      LIMIT 1
    `);

  return (
    result.rows[0] as
      | ExistingClaimRecord
      | undefined
  ) ?? null;
}


function resultFromExistingClaim(
  claim: ExistingClaimRecord,
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

    campaignId:
      claim.campaignId,

    campaignName:
      claim.campaignName,

    serialNumber:
      Number(
        claim.serialNumber,
      ),

    rewardAmountMinor:
      Number(
        claim.rewardAmountMinor,
      ),

    currency:
      claim.currency,

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
  voucher: VoucherRecord,
  outcome: QrRewardClaimOutcome,
): QrRewardClaimResult {
  return {
    outcome,

    voucherId:
      voucher.voucherId,

    batchId:
      voucher.batchId,

    batchCode:
      voucher.batchCode,

    campaignId:
      voucher.campaignId,

    campaignName:
      voucher.campaignName,

    serialNumber:
      Number(
        voucher.serialNumber,
      ),

    rewardAmountMinor:
      Number(
        voucher.rewardAmountMinor,
      ),

    currency:
      voucher.currency,

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
        voucher.voucherExpiresAt,
      ),
  };
}


/**
 * ATOMIC QR REWARD CLAIM
 *
 * This function MUST execute inside the tenant transaction supplied by
 * withTenantDb / withTenantSchema.
 *
 * Concurrency rules:
 *
 * - Same requestId is serialized by a PostgreSQL advisory transaction lock.
 * - Same voucher is serialized by PostgreSQL row locking during UPDATE.
 * - UPDATE succeeds only while voucher status is AVAILABLE.
 * - qr_reward_claims.voucher_id is UNIQUE as a second hard invariant.
 * - qr_reward_claims.request_id is UNIQUE for idempotency.
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


  /*
   * Serialize ALL operations sharing the same idempotency request.
   *
   * This also prevents one accidental requestId from being used
   * concurrently against two different vouchers.
   */
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


  /*
   * Idempotency:
   *
   * If this request already created this SAME claim,
   * return the original success.
   */
  const existingRequest =
    await claimByRequestId(
      db,
      requestId,
    );


  if (existingRequest) {
    if (
      existingRequest.voucherId !==
      voucher.voucherId
    ) {
      return {
        outcome:
          "request_conflict",
      };
    }

    return resultFromExistingClaim(
      existingRequest,
    );
  }


  if (
    voucher.voucherStatus ===
    "claimed"
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
      "revoked" ||
    voucher.campaignStatus ===
      "revoked"
  ) {
    return stateResult(
      voucher,
      "revoked",
    );
  }


  if (
    voucher.voucherStatus ===
    "expired"
  ) {
    return stateResult(
      voucher,
      "expired",
    );
  }


  const now =
    Date.now();

  const voucherExpiry =
    new Date(
      String(
        voucher.voucherExpiresAt,
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
    voucherExpiry <= now ||
    campaignExpiry <= now
  ) {
    /*
     * Materialize the expiry state where possible.
     */
    await db.execute(sql`
      UPDATE qr_reward_vouchers
      SET
        status = 'expired'
      WHERE
        id = ${voucher.voucherId}
        AND status = 'available'
        AND expires_at <= now()
    `);

    return stateResult(
      voucher,
      "expired",
    );
  }


  if (
    campaignStart > now ||
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
   * =============================================================
   * THE CRITICAL ATOMIC OPERATION
   * =============================================================
   *
   * Two users may enter this statement simultaneously.
   *
   * PostgreSQL ensures only one transaction can successfully
   * transition AVAILABLE -> CLAIMED.
   */
  const updated =
    await db.execute(sql`
      UPDATE qr_reward_vouchers AS v

      SET
        status = 'claimed',
        claimed_by_user_id = ${userId},
        claimed_at = now()

      FROM
        qr_reward_batches AS b,
        qr_reward_campaigns AS c

      WHERE
        v.id = ${voucher.voucherId}

        AND v.batch_id = b.id

        AND b.campaign_id = c.id

        AND v.status = 'available'

        AND v.expires_at > now()

        AND b.status IN (
          'ready',
          'partially_printed',
          'printed'
        )

        AND c.status = 'active'

        AND c.starts_at <= now()

        AND c.expires_at > now()

      RETURNING
        v.id AS "voucherId",
        v.claimed_at AS "claimedAt"
    `);


  const winner =
    updated.rows[0] as
      | {
          voucherId?: unknown;
          claimedAt?: unknown;
        }
      | undefined;


  /*
   * We lost the race.
   *
   * Re-read authoritative state after PostgreSQL has serialized
   * the competing UPDATE.
   */
  if (!winner?.voucherId) {
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
      "claimed"
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
        "revoked" ||
      current.campaignStatus ===
        "revoked"
    ) {
      return stateResult(
        current,
        "revoked",
      );
    }

    const currentExpiry =
      new Date(
        String(
          current.voucherExpiresAt,
        ),
      ).getTime();

    if (
      current.voucherStatus ===
        "expired" ||
      currentExpiry <=
        Date.now()
    ) {
      return stateResult(
        current,
        "expired",
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
    new Date().toISOString();


  /*
   * UNIQUE(voucher_id) is our database-level second line of defense.
   *
   * If this INSERT cannot happen, this entire tenant transaction
   * rolls back — including the AVAILABLE -> CLAIMED update.
   */
  await db.execute(sql`
    INSERT INTO qr_reward_claims (
      id,
      voucher_id,
      user_id,
      request_id,
      claimed_at
    )
    VALUES (
      ${claimId},
      ${voucher.voucherId},
      ${userId},
      ${requestId},
      ${claimedAt}
    )
  `);


  return {
    outcome:
      "claimed",

    idempotent:
      false,

    voucherId:
      voucher.voucherId,

    claimId,

    batchId:
      voucher.batchId,

    batchCode:
      voucher.batchCode,

    campaignId:
      voucher.campaignId,

    campaignName:
      voucher.campaignName,

    serialNumber:
      Number(
        voucher.serialNumber,
      ),

    rewardAmountMinor:
      Number(
        voucher.rewardAmountMinor,
      ),

    currency:
      voucher.currency,

    claimedByUserId:
      userId,

    claimedAt,

    expiresAt:
      iso(
        voucher.voucherExpiresAt,
      ),
  };
}
