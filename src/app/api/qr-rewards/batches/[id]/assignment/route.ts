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

import {
  qrRewardsSchemaStatus,
} from "@/lib/qr-rewards-db";


export const POST =
  withTenantDb(
    async (
      request: NextRequest,
      db,
      session,
      context: {
        params:
          Promise<{
            id: string;
          }>;
      },
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
            success: false,
            error:
              "Permission denied.",
          },
          {
            status: 403,
          },
        );
      }

      const schema =
        await qrRewardsSchemaStatus(
          db,
        );

      if (!schema.ready) {
        return NextResponse.json(
          {
            success: false,
            error:
              "QR Rewards V3 is not provisioned.",
          },
          {
            status: 503,
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

      const campaignId =
        String(
          body?.campaignId ??
            "",
        ).trim();

      if (!campaignId) {
        return NextResponse.json(
          {
            success: false,
            error:
              "campaignId is required.",
          },
          {
            status: 400,
          },
        );
      }


      /*
       * Serialize ALL assignment changes to this physical batch.
       */
      await db.execute(sql`
        SELECT
          pg_advisory_xact_lock(
            hashtextextended(
              ${`brixta:qr-batch-assignment:${batchId}`},
              0
            )
          )
      `);


      const batchResult =
        await db.execute(sql`
          SELECT
            id,
            batch_code
              AS "batchCode",
            status
          FROM qr_reward_batches
          WHERE
            id =
              ${batchId}
          LIMIT 1
        `);

      const batch =
        batchResult.rows[0] as
          | {
              id: string;
              batchCode: string;
              status: string;
            }
          | undefined;

      if (!batch) {
        return NextResponse.json(
          {
            success: false,
            error:
              "QR batch was not found.",
          },
          {
            status: 404,
          },
        );
      }

      if (
        batch.status ===
          "revoked"
      ) {
        return NextResponse.json(
          {
            success: false,
            error:
              "A revoked QR batch cannot be reassigned.",
          },
          {
            status: 409,
          },
        );
      }


      const campaignResult =
        await db.execute(sql`
          SELECT
            id,
            name,

            reward_amount_minor
              AS "rewardAmountMinor",

            currency,

            starts_at
              AS "startsAt",

            expires_at
              AS "expiresAt",

            status

          FROM qr_reward_campaigns

          WHERE
            id =
              ${campaignId}

          LIMIT 1
        `);

      const campaign =
        campaignResult.rows[0] as
          | {
              id: string;
              name: string;
              rewardAmountMinor: number;
              currency: string;
              startsAt: string;
              expiresAt: string;
              status: string;
            }
          | undefined;

      if (!campaign) {
        return NextResponse.json(
          {
            success: false,
            error:
              "Target Campaign was not found.",
          },
          {
            status: 404,
          },
        );
      }


      const now =
        Date.now();

      if (
        campaign.status !==
          "active" ||
        new Date(
          campaign.startsAt,
        ).getTime() >
          now ||
        new Date(
          campaign.expiresAt,
        ).getTime() <=
          now
      ) {
        return NextResponse.json(
          {
            success: false,
            error:
              "Target Campaign is not currently active.",
          },
          {
            status: 409,
          },
        );
      }


      const currentResult =
        await db.execute(sql`
          SELECT
            id,
            campaign_id
              AS "campaignId"

          FROM qr_reward_batch_assignments

          WHERE
            batch_id =
              ${batchId}
            AND
            status =
              'active'

          LIMIT 1
        `);

      const current =
        currentResult.rows[0] as
          | {
              id: string;
              campaignId: string;
            }
          | undefined;


      if (
        current?.campaignId ===
        campaign.id
      ) {
        return NextResponse.json({
          success: true,

          idempotent:
            true,

          assignmentId:
            current.id,

          campaignId:
            campaign.id,

          campaignName:
            campaign.name,
        });
      }


      /*
       * Count QRs that are legally reusable.
       *
       * CLAIMED is deliberately excluded.
       * REVOKED is deliberately excluded.
       */
      const reusableResult =
        await db.execute(sql`
          SELECT
            COUNT(*)::integer
              AS count

          FROM qr_reward_vouchers

          WHERE
            batch_id =
              ${batchId}

            AND
            claimed_at
              IS NULL

            AND
            status IN (
              'available',
              'expired'
            )
        `);

      const reusableCount =
        Number(
          (
            reusableResult
              .rows[0] as
              | {
                  count?: unknown;
                }
              | undefined
          )?.count ??
            0,
        );


      if (
        reusableCount <=
        0
      ) {
        return NextResponse.json(
          {
            success: false,
            error:
              "This batch has no reusable unclaimed QR codes.",
          },
          {
            status: 409,
          },
        );
      }


      /*
       * End the previous assignment.
       *
       * This happens BEFORE inserting the new one.
       */
      if (current) {
        await db.execute(sql`
          UPDATE
            qr_reward_batch_assignments

          SET
            status =
              'ended',

            deactivated_at =
              now()

          WHERE
            id =
              ${current.id}

            AND
            status =
              'active'
        `);
      }


      const assignmentId =
        randomUUID();


      /*
       * PostgreSQL's partial UNIQUE INDEX is the final
       * concurrency guarantee here.
       *
       * Even if application logic fails, the DB refuses a
       * second ACTIVE assignment for this batch.
       */
      await db.execute(sql`
        INSERT INTO
          qr_reward_batch_assignments (
            id,
            batch_id,
            campaign_id,
            reward_amount_minor,
            currency,
            expires_at,
            status,
            activated_at,
            created_by_user_id
          )

        VALUES (
          ${assignmentId},
          ${batchId},
          ${campaign.id},
          ${Number(
            campaign.rewardAmountMinor,
          )},
          ${campaign.currency},
          ${campaign.expiresAt},
          'active',
          now(),
          ${session.userId}
        )
      `);


      /*
       * Bring back ONLY unclaimed non-revoked physical QRs.
       *
       * This is the "come alive again" operation.
       *
       * A previously CLAIMED QR is never touched and therefore
       * can never regain redemption power.
       */
      await db.execute(sql`
        UPDATE
          qr_reward_vouchers

        SET
          status =
            'available',

          expires_at =
            ${campaign.expiresAt}

        WHERE
          batch_id =
            ${batchId}

          AND
          claimed_at
            IS NULL

          AND
          status IN (
            'available',
            'expired'
          )
      `);


      return NextResponse.json({
        success: true,

        assignment: {
          id:
            assignmentId,

          batchId,

          campaignId:
            campaign.id,

          campaignName:
            campaign.name,

          rewardAmountMinor:
            Number(
              campaign.rewardAmountMinor,
            ),

          currency:
            campaign.currency,

          expiresAt:
            campaign.expiresAt,

          reusableQrCount:
            reusableCount,

          status:
            "active",
        },
      });
    },
  );
