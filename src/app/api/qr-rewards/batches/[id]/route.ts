import {
  randomUUID,
} from "node:crypto";

import {
  NextRequest,
  NextResponse,
} from "next/server";

import {
  sql,
} from "drizzle-orm";

import {
  hasPermission,
  withTenantDb,
} from "@/lib/auth";


type Context = {
  params:
    Promise<{
      id: string;
    }>;
};


async function lockBatch(
  db: Parameters<
    Parameters<typeof withTenantDb>[0]
  >[1],
  batchId: string,
) {
  await db.execute(sql`
    SELECT
      pg_advisory_xact_lock(
        hashtextextended(
          ${`brixta:qr-batch-admin:${batchId}`},
          0
        )
      )
  `);
}


async function batchState(
  db: Parameters<
    Parameters<typeof withTenantDb>[0]
  >[1],
  batchId: string,
) {
  const result =
    await db.execute(sql`
      SELECT
        b.id,

        b.batch_code
          AS "batchCode",

        b.status,

        a.id
          AS "activeAssignmentId",

        a.expires_at
          AS "assignmentExpiresAt",

        c.expires_at
          AS "campaignExpiresAt",

        (
          SELECT
            COUNT(*)::integer

          FROM
            qr_reward_vouchers v

          WHERE
            v.batch_id =
              b.id
        )
          AS "voucherCount",

        (
          SELECT
            COUNT(*)::integer

          FROM
            qr_reward_claims cl

          INNER JOIN
            qr_reward_vouchers v
              ON v.id =
                cl.voucher_id

          WHERE
            v.batch_id =
              b.id
        )
          AS "claimCount",

        (
          SELECT
            COUNT(*)::integer

          FROM
            qr_reward_voucher_entity_bindings veb

          INNER JOIN
            qr_reward_vouchers v
              ON v.id =
                veb.voucher_id

          WHERE
            v.batch_id =
              b.id
        )
          AS "bindingCount",

        (
          SELECT
            COUNT(*)::integer

          FROM
            qr_reward_batch_assignments history

          WHERE
            history.batch_id =
              b.id
        )
          AS "assignmentCount"

      FROM
        qr_reward_batches b

      LEFT JOIN
        qr_reward_batch_assignments a
          ON a.batch_id =
            b.id

          AND a.status =
            'active'

      LEFT JOIN
        qr_reward_campaigns c
          ON c.id =
            a.campaign_id

      WHERE
        b.id =
          ${batchId}::uuid

      LIMIT 1
    `);

  return (
    result.rows[0] as
      | {
          id:
            string;

          batchCode:
            string;

          status:
            string;

          activeAssignmentId:
            string | null;

          assignmentExpiresAt:
            unknown | null;

          campaignExpiresAt:
            unknown | null;

          voucherCount:
            number;

          claimCount:
            number;

          bindingCount:
            number;

          assignmentCount:
            number;
        }
      | undefined
  ) ?? null;
}


async function audit(
  db: Parameters<
    Parameters<typeof withTenantDb>[0]
  >[1],
  input: {
    batchId:
      string;

    batchCode:
      string;

    eventType:
      string;

    actorUserId:
      number | null;

    details:
      Record<
        string,
        unknown
      >;
  },
) {
  await db.execute(sql`
    INSERT INTO
      qr_reward_batch_audit_events (
        id,
        batch_id,
        batch_code_snapshot,
        event_type,
        actor_user_id,
        details,
        created_at
      )

    VALUES (
      ${randomUUID()}::uuid,

      ${input.batchId}::uuid,

      ${input.batchCode},

      ${input.eventType},

      ${input.actorUserId},

      ${JSON.stringify(
        input.details,
      )}::jsonb,

      now()
    )
  `);
}


/*
 * EDIT CURRENT BATCH EXPIRY
 *
 * Claimed QRs are immutable.
 *
 * We update:
 *   ACTIVE assignment expiry
 *   unclaimed available/expired Voucher expiry
 *
 * We do NOT rewrite historical assignment rows or claims.
 */
export const PATCH =
  withTenantDb<Context>(
    async (
      request:
        NextRequest,
      db,
      session,
      context,
    ) => {
      if (
        !hasPermission(
          session.permissions,
          [
            "WRITE",
            "UPDATE",
            "ALL_ACCESS",
          ],
        )
      ) {
        return NextResponse.json(
          {
            success:
              false,

            error:
              "Permission denied.",
          },
          {
            status:
              403,
          },
        );
      }

      const {
        id: batchId,
      } =
        await context.params;

      const body =
        await request
          .json()
          .catch(
            () => null,
          );

      const raw =
        String(
          body?.expiresAt ??
            "",
        ).trim();

      const parsed =
        new Date(
          raw,
        );

      if (
        !raw ||
        Number.isNaN(
          parsed.getTime(),
        )
      ) {
        return NextResponse.json(
          {
            success:
              false,

            error:
              "A valid expiresAt value is required.",
          },
          {
            status:
              400,
          },
        );
      }

      if (
        parsed.getTime() <=
          Date.now()
      ) {
        return NextResponse.json(
          {
            success:
              false,

            error:
              "Batch expiry must be in the future. Use Revoke to stop a Batch immediately.",
          },
          {
            status:
              400,
          },
        );
      }

      await lockBatch(
        db,
        batchId,
      );

      const batch =
        await batchState(
          db,
          batchId,
        );

      if (!batch) {
        return NextResponse.json(
          {
            success:
              false,

            error:
              "Batch not found.",
          },
          {
            status:
              404,
          },
        );
      }

      if (
        batch.status ===
          "revoked"
      ) {
        return NextResponse.json(
          {
            success:
              false,

            error:
              "A revoked Batch cannot have its expiry changed.",
          },
          {
            status:
              409,
          },
        );
      }

      if (
        !batch
          .activeAssignmentId
      ) {
        return NextResponse.json(
          {
            success:
              false,

            error:
              "This Batch has no active Campaign assignment.",
          },
          {
            status:
              409,
          },
        );
      }

      const campaignExpiry =
        batch
          .campaignExpiresAt
          ? new Date(
              String(
                batch
                  .campaignExpiresAt,
              ),
            )
          : null;

      if (
        campaignExpiry &&
        Number.isFinite(
          campaignExpiry
            .getTime(),
        ) &&
        parsed.getTime() >
          campaignExpiry
            .getTime()
      ) {
        return NextResponse.json(
          {
            success:
              false,

            error:
              `Batch expiry cannot exceed the current Campaign expiry (${campaignExpiry.toISOString()}).`,
          },
          {
            status:
              409,
          },
        );
      }

      const expiresAt =
        parsed
          .toISOString();

      const oldExpiresAt =
        batch
          .assignmentExpiresAt
          ? new Date(
              String(
                batch
                  .assignmentExpiresAt,
              ),
            )
              .toISOString()
          : null;

      await db.execute(sql`
        UPDATE
          qr_reward_batch_assignments

        SET
          expires_at =
            ${expiresAt}

        WHERE
          id =
            ${batch.activeAssignmentId}::uuid

          AND status =
            'active'
      `);

      const changed =
        await db.execute(sql`
          UPDATE
            qr_reward_vouchers

          SET
            expires_at =
              ${expiresAt},

            /*
             * Extending a previously time-expired QR
             * can make it usable again.
             *
             * Revoked QRs are NEVER resurrected.
             */
            status =
              CASE
                WHEN status =
                  'expired'
                THEN
                  'available'

                ELSE
                  status
              END

          WHERE
            batch_id =
              ${batchId}::uuid

            AND claimed_at
              IS NULL

            AND status IN (
              'available',
              'expired'
            )

          RETURNING
            id
        `);

      await audit(
        db,
        {
          batchId,

          batchCode:
            batch.batchCode,

          eventType:
            "expiry_changed",

          actorUserId:
            session.userId ??
            null,

          details: {
            oldExpiresAt,
            newExpiresAt:
              expiresAt,

            affectedUnclaimedQrCount:
              changed.rows.length,

            claimCount:
              Number(
                batch
                  .claimCount ??
                0,
              ),
          },
        },
      );

      return NextResponse.json({
        success:
          true,

        batch: {
          id:
            batchId,

          batchCode:
            batch.batchCode,

          expiresAt,

          affectedUnclaimedQrCount:
            changed.rows.length,
        },
      });
    },
  );


/*
 * REVOKE
 *
 * This is the preferred destructive operation.
 *
 * History remains:
 *   Batch
 *   assignments
 *   Dealer/Entity bindings
 *   claims
 *   payouts
 *
 * Only remaining unclaimed QRs become unusable.
 */
export const POST =
  withTenantDb<Context>(
    async (
      request:
        NextRequest,
      db,
      session,
      context,
    ) => {
      if (
        !hasPermission(
          session.permissions,
          [
            "WRITE",
            "UPDATE",
            "ALL_ACCESS",
          ],
        )
      ) {
        return NextResponse.json(
          {
            success:
              false,

            error:
              "Permission denied.",
          },
          {
            status:
              403,
          },
        );
      }

      const {
        id: batchId,
      } =
        await context.params;

      const body =
        await request
          .json()
          .catch(
            () => null,
          );

      if (
        String(
          body?.action ??
            "",
        ) !==
        "revoke"
      ) {
        return NextResponse.json(
          {
            success:
              false,

            error:
              "Unknown Batch action.",
          },
          {
            status:
              400,
          },
        );
      }

      await lockBatch(
        db,
        batchId,
      );

      const batch =
        await batchState(
          db,
          batchId,
        );

      if (!batch) {
        return NextResponse.json(
          {
            success:
              false,

            error:
              "Batch not found.",
          },
          {
            status:
              404,
          },
        );
      }

      if (
        batch.status ===
          "revoked"
      ) {
        return NextResponse.json({
          success:
            true,

          idempotent:
            true,

          batch: {
            id:
              batchId,

            status:
              "revoked",
          },
        });
      }

      await db.execute(sql`
        UPDATE
          qr_reward_batches

        SET
          status =
            'revoked'

        WHERE
          id =
            ${batchId}::uuid
      `);

      await db.execute(sql`
        UPDATE
          qr_reward_batch_assignments

        SET
          status =
            'revoked',

          deactivated_at =
            now()

        WHERE
          batch_id =
            ${batchId}::uuid

          AND status =
            'active'
      `);

      const revoked =
        await db.execute(sql`
          UPDATE
            qr_reward_vouchers

          SET
            status =
              'revoked'

          WHERE
            batch_id =
              ${batchId}::uuid

            AND claimed_at
              IS NULL

            AND status IN (
              'available',
              'expired'
            )

          RETURNING
            id
        `);

      await audit(
        db,
        {
          batchId,

          batchCode:
            batch.batchCode,

          eventType:
            "revoked",

          actorUserId:
            session.userId ??
            null,

          details: {
            revokedUnclaimedQrCount:
              revoked.rows.length,

            claimCount:
              Number(
                batch
                  .claimCount ??
                0,
              ),

            bindingHistoryPreserved:
              true,
          },
        },
      );

      return NextResponse.json({
        success:
          true,

        batch: {
          id:
            batchId,

          batchCode:
            batch.batchCode,

          status:
            "revoked",

          revokedUnclaimedQrCount:
            revoked.rows.length,

          claimCount:
            Number(
              batch
                .claimCount ??
              0,
            ),
        },
      });
    },
  );


/*
 * SAFE HARD DELETE
 *
 * This exists primarily for unused/test Batches.
 *
 * HARD RULE:
 *   if one successful claim exists, deletion is forbidden.
 *
 * The V7 audit tombstone survives deletion.
 */
export const DELETE =
  withTenantDb<Context>(
    async (
      request:
        NextRequest,
      db,
      session,
      context,
    ) => {
      if (
        !hasPermission(
          session.permissions,
          [
            "DELETE",
            "ALL_ACCESS",
          ],
        )
      ) {
        return NextResponse.json(
          {
            success:
              false,

            error:
              "Permission denied.",
          },
          {
            status:
              403,
          },
        );
      }

      const {
        id: batchId,
      } =
        await context.params;

      await lockBatch(
        db,
        batchId,
      );

      const batch =
        await batchState(
          db,
          batchId,
        );

      if (!batch) {
        return NextResponse.json(
          {
            success:
              false,

            error:
              "Batch not found.",
          },
          {
            status:
              404,
          },
        );
      }

      const confirmation =
        String(
          request.nextUrl
            .searchParams
            .get(
              "confirm",
            ) ??
            "",
        );

      if (
        confirmation !==
          batch.batchCode
      ) {
        return NextResponse.json(
          {
            success:
              false,

            error:
              "Batch-code confirmation does not match.",
          },
          {
            status:
              400,
          },
        );
      }

      const claimCount =
        Number(
          batch
            .claimCount ??
          0,
        );

      if (
        claimCount >
        0
      ) {
        return NextResponse.json(
          {
            success:
              false,

            error:
              "This Batch has claimed QR codes and is immutable. Revoke the remaining unclaimed QRs instead.",
          },
          {
            status:
              409,
          },
        );
      }

      /*
       * Write tombstone BEFORE deleting the live Batch.
       */
      await audit(
        db,
        {
          batchId,

          batchCode:
            batch.batchCode,

          eventType:
            "hard_deleted",

          actorUserId:
            session.userId ??
            null,

          details: {
            previousStatus:
              batch.status,

            voucherCount:
              Number(
                batch
                  .voucherCount ??
                0,
              ),

            bindingCount:
              Number(
                batch
                  .bindingCount ??
                0,
              ),

            assignmentCount:
              Number(
                batch
                  .assignmentCount ??
                0,
              ),

            claimCount:
              0,
          },
        },
      );

      /*
       * Preflight rule evaluations may exist even when
       * no financial Claim exists, so delete those first.
       */
      await db.execute(sql`
        DELETE FROM
          qr_reward_rule_evaluations

        WHERE
          voucher_id IN (
            SELECT
              id

            FROM
              qr_reward_vouchers

            WHERE
              batch_id =
                ${batchId}::uuid
          )

          OR

          assignment_id IN (
            SELECT
              id

            FROM
              qr_reward_batch_assignments

            WHERE
              batch_id =
                ${batchId}::uuid
          )
      `);

      await db.execute(sql`
        DELETE FROM
          qr_reward_voucher_entity_bindings

        WHERE
          voucher_id IN (
            SELECT
              id

            FROM
              qr_reward_vouchers

            WHERE
              batch_id =
                ${batchId}::uuid
          )
      `);

      await db.execute(sql`
        DELETE FROM
          qr_reward_vouchers

        WHERE
          batch_id =
            ${batchId}::uuid
      `);

      await db.execute(sql`
        DELETE FROM
          qr_reward_batch_assignments

        WHERE
          batch_id =
            ${batchId}::uuid
      `);

      await db.execute(sql`
        DELETE FROM
          qr_reward_batches

        WHERE
          id =
            ${batchId}::uuid
      `);

      return NextResponse.json({
        success:
          true,

        deleted: {
          id:
            batchId,

          batchCode:
            batch.batchCode,

          auditTombstone:
            true,
        },
      });
    },
  );
