import "server-only";

import {
  randomUUID,
} from "node:crypto";

import {
  sql,
} from "drizzle-orm";

import type {
  AppDatabase,
} from "@/lib/drizzle";


export type QrRewardRulePhase =
  | "preflight"
  | "claim_gate";


export type QrRewardRuleDecision =
  | "pass"
  | "fail";


export type QrRewardRulebookSnapshot = {
  schemeId: string;
  schemeName: string;

  rulebookId: string;
  rulebookVersion: number;

  rulesHash: string;

  rewardPolicy:
    Record<string, unknown>;

  claimLimitPolicy:
    Record<string, unknown>;

  fraudPolicy:
    Record<string, unknown>;

  validityPolicy:
    Record<string, unknown>;
};


export type QrRewardRuleContext = {
  voucherId: string;

  assignmentId: string;

  campaignId: string;

  claimantKeyHash?:
    string | null;

  userId?:
    number | null;

  entityTypeId?:
    number | null;

  entityRecordId?:
    string | null;
};


export type QrRewardRuleResult = {
  decision:
    QrRewardRuleDecision;

  reasonCodes:
    string[];

  rewardAmountMinor?:
    number;
};


function object(
  value: unknown,
) {
  return (
    value &&
    typeof value ===
      "object" &&
    !Array.isArray(
      value,
    )
  )
    ? value as
        Record<
          string,
          unknown
        >
    : {};
}


function numberValue(
  value: unknown,
  fallback = 0,
) {
  const number =
    Number(
      value,
    );

  return Number.isFinite(
    number,
  )
    ? number
    : fallback;
}


function positiveInteger(
  value: unknown,
) {
  const number =
    Math.floor(
      numberValue(
        value,
        0,
      ),
    );

  return number > 0
    ? number
    : 0;
}


function stringArray(
  value: unknown,
) {
  return Array.isArray(
    value,
  )
    ? value
        .map(
          String,
        )
        .filter(
          Boolean,
        )
    : [];
}


/*
 * Safe deterministic reward calculation.
 *
 * No eval().
 * No arbitrary JavaScript.
 *
 * Formula V1:
 *
 * {
 *   type: "formula",
 *   baseAmountMinor: 5000,
 *
 *   adjustments: [
 *     {
 *       entityRecordId: "...",
 *       addAmountMinor: 2500
 *     },
 *     {
 *       entityTypeId: 7,
 *       multiplyBasisPoints: 12000
 *     }
 *   ],
 *
 *   minAmountMinor: 100,
 *   maxAmountMinor: 50000
 * }
 */
function calculateReward(
  policy:
    Record<
      string,
      unknown
    >,
  context:
    QrRewardRuleContext,
) {
  const type =
    String(
      policy.type ??
        "fixed",
    );

  if (
    type ===
      "fixed"
  ) {
    const amount =
      Math.round(
        numberValue(
          policy.amountMinor,
          0,
        ),
      );

    return amount > 0
      ? amount
      : null;
  }


  if (
    type !==
      "formula"
  ) {
    return null;
  }


  let amount =
    numberValue(
      policy.baseAmountMinor,
      0,
    );


  const adjustments =
    Array.isArray(
      policy.adjustments,
    )
      ? policy.adjustments
      : [];


  for (
    const raw of
    adjustments
  ) {
    const adjustment =
      object(
        raw,
      );

    const requiredEntityRecordId =
      adjustment.entityRecordId
        ? String(
            adjustment.entityRecordId,
          )
        : null;

    const requiredEntityTypeId =
      adjustment.entityTypeId !==
        undefined
        ? Number(
            adjustment.entityTypeId,
          )
        : null;


    if (
      requiredEntityRecordId &&
      requiredEntityRecordId !==
        context.entityRecordId
    ) {
      continue;
    }


    if (
      requiredEntityTypeId !==
        null &&
      requiredEntityTypeId !==
        Number(
          context.entityTypeId ??
            0,
        )
    ) {
      continue;
    }


    amount +=
      numberValue(
        adjustment.addAmountMinor,
        0,
      );


    const multiplier =
      numberValue(
        adjustment.multiplyBasisPoints,
        10000,
      );

    amount =
      amount *
      multiplier /
      10000;
  }


  const minimum =
    numberValue(
      policy.minAmountMinor,
      0,
    );

  const maximum =
    numberValue(
      policy.maxAmountMinor,
      Number.MAX_SAFE_INTEGER,
    );


  amount =
    Math.max(
      minimum,
      Math.min(
        maximum,
        amount,
      ),
    );


  const rounded =
    Math.round(
      amount,
    );

  return rounded > 0
    ? rounded
    : null;
}


async function countClaims(
  db: AppDatabase,
  where:
    ReturnType<
      typeof sql
    >,
) {
  const result =
    await db.execute(sql`
      SELECT
        COUNT(*)::integer
          AS count

      FROM
        qr_reward_claims cl

      WHERE
        ${where}
    `);

  return Number(
    (
      result.rows[0] as
        | {
            count?: unknown;
          }
        | undefined
    )?.count ??
      0,
  );
}


export async function evaluateQrRewardRulebook(
  db: AppDatabase,
  input: {
    phase:
      QrRewardRulePhase;

    rulebook:
      QrRewardRulebookSnapshot;

    context:
      QrRewardRuleContext;
  },
): Promise<
  QrRewardRuleResult
> {
  const {
    phase,
    rulebook,
    context,
  } =
    input;

  const reasons:
    string[] = [];


  const fraud =
    object(
      rulebook
        .fraudPolicy,
    );


  const limits =
    object(
      rulebook
        .claimLimitPolicy,
    );


  /*
   * --------------------------------------------------------
   * FRAUD / ELIGIBILITY
   * --------------------------------------------------------
   */

  if (
    fraud.requireValidEntity ===
      true &&
    fraud.requireEntity ===
      true &&
    !context.entityRecordId
  ) {
    reasons.push(
      "ENTITY_REQUIRED",
    );
  }


  const blockedEntities =
    stringArray(
      fraud.blockedEntityRecordIds,
    );

  if (
    context.entityRecordId &&
    blockedEntities.includes(
      context.entityRecordId,
    )
  ) {
    reasons.push(
      "ENTITY_BLOCKED",
    );
  }


  /*
   * --------------------------------------------------------
   * CLAIM LIMITS
   *
   * Claimant-dependent limits are naturally evaluated in
   * claim_gate. Public preflight may not know the UPI yet.
   * --------------------------------------------------------
   */

  if (
    phase ===
      "claim_gate"
  ) {
    const perClaimantPerDay =
      positiveInteger(
        limits.perClaimantPerDay,
      );

    const perClaimantPerCampaign =
      positiveInteger(
        limits.perClaimantPerCampaign,
      );

    const perEntityPerDay =
      positiveInteger(
        limits.perEntityPerDay,
      );


    if (
      (
        perClaimantPerDay >
          0 ||
        perClaimantPerCampaign >
          0
      ) &&
      !context.claimantKeyHash
    ) {
      reasons.push(
        "CLAIMANT_KEY_REQUIRED",
      );
    }


    if (
      context.claimantKeyHash &&
      perClaimantPerDay >
        0
    ) {
      const count =
        await countClaims(
          db,
          sql`
            cl.claimant_key_hash =
              ${context.claimantKeyHash}

            AND
            cl.claimed_at >=
              date_trunc(
                'day',
                now()
              )
          `,
        );

      if (
        count >=
        perClaimantPerDay
      ) {
        reasons.push(
          "CLAIMANT_DAILY_LIMIT_EXCEEDED",
        );
      }
    }


    if (
      context.claimantKeyHash &&
      perClaimantPerCampaign >
        0
    ) {
      const count =
        await countClaims(
          db,
          sql`
            cl.claimant_key_hash =
              ${context.claimantKeyHash}

            AND
            cl.campaign_id_snapshot =
              ${context.campaignId}::uuid
          `,
        );

      if (
        count >=
        perClaimantPerCampaign
      ) {
        reasons.push(
          "CLAIMANT_CAMPAIGN_LIMIT_EXCEEDED",
        );
      }
    }


    if (
      context.entityRecordId &&
      perEntityPerDay >
        0
    ) {
      const count =
        await countClaims(
          db,
          sql`
            cl.entity_record_id_snapshot =
              ${context.entityRecordId}::uuid

            AND
            cl.claimed_at >=
              date_trunc(
                'day',
                now()
              )
          `,
        );

      if (
        count >=
        perEntityPerDay
      ) {
        reasons.push(
          "ENTITY_DAILY_LIMIT_EXCEEDED",
        );
      }
    }


    const minSeconds =
      positiveInteger(
        fraud.minSecondsBetweenClaimsPerClaimant,
      );

    if (
      minSeconds >
        0 &&
      context.claimantKeyHash
    ) {
      const recent =
        await db.execute(sql`
          SELECT
            MAX(
              claimed_at
            ) AS "lastClaimedAt"

          FROM
            qr_reward_claims

          WHERE
            claimant_key_hash =
              ${context.claimantKeyHash}
        `);

      const value =
        (
          recent.rows[0] as
            | {
                lastClaimedAt?: unknown;
              }
            | undefined
        )?.lastClaimedAt;

      if (value) {
        const elapsed =
          (
            Date.now() -
            new Date(
              String(
                value,
              ),
            ).getTime()
          ) /
          1000;

        if (
          elapsed <
          minSeconds
        ) {
          reasons.push(
            "CLAIMANT_VELOCITY_REJECTED",
          );
        }
      }
    }
  }


  /*
   * --------------------------------------------------------
   * REWARD POLICY
   * --------------------------------------------------------
   */

  const reward =
    calculateReward(
      object(
        rulebook
          .rewardPolicy,
      ),
      context,
    );


  if (
    reward ===
      null
  ) {
    reasons.push(
      "REWARD_POLICY_INVALID",
    );
  }


  if (
    reasons.length
  ) {
    return {
      decision:
        "fail",

      reasonCodes:
        reasons,
    };
  }


  return {
    decision:
      "pass",

    reasonCodes:
      [],

    rewardAmountMinor:
      reward ??
      undefined,
  };
}


export async function writeQrRewardRuleEvaluation(
  db: AppDatabase,
  input: {
    voucherId?:
      string | null;

    assignmentId?:
      string | null;

    claimId?:
      string | null;

    rulebook:
      QrRewardRulebookSnapshot;

    phase:
      QrRewardRulePhase;

    decision:
      QrRewardRuleDecision;

    reasonCodes:
      string[];

    facts?:
      Record<
        string,
        unknown
      >;
  },
) {
  await db.execute(sql`
    INSERT INTO
      qr_reward_rule_evaluations (
        id,

        voucher_id,
        assignment_id,
        claim_id,

        scheme_id,
        rulebook_id,
        rulebook_version,

        phase,
        decision,

        reason_codes,
        facts,

        evaluated_at
      )

    VALUES (
      ${randomUUID()},

      ${
        input.voucherId ??
        null
      }::uuid,

      ${
        input.assignmentId ??
        null
      }::uuid,

      ${
        input.claimId ??
        null
      }::uuid,

      ${input.rulebook.schemeId}::uuid,

      ${input.rulebook.rulebookId}::uuid,

      ${input.rulebook.rulebookVersion},

      ${input.phase},

      ${input.decision},

      ${JSON.stringify(
        input.reasonCodes,
      )}::jsonb,

      ${JSON.stringify(
        input.facts ??
          {},
      )}::jsonb,

      now()
    )
  `);
}
