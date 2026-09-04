import {
  NextRequest,
  NextResponse,
} from "next/server";

import {
  sql,
} from "drizzle-orm";

import {
  withTenantDb,
} from "@/lib/auth";

import {
  qrRewardsSchemaStatus,
} from "@/lib/qr-rewards-db";


export const GET =
  withTenantDb(
    async (
      request: NextRequest,
      db,
    ) => {
      const schema =
        await qrRewardsSchemaStatus(
          db,
        );

      if (!schema.ready) {
        return NextResponse.json(
          {
            success: false,
            notProvisioned: true,
            error:
              "QR Rewards records are not provisioned for this tenant.",
          },
          {
            status: 503,
          },
        );
      }


      const batchId =
        request.nextUrl.searchParams
          .get(
            "batchId",
          )
          ?.trim() ??
        "";


      const requestedLimit =
        Number(
          request.nextUrl.searchParams.get(
            "limit",
          ) ?? 500,
        );


      const limit =
        Number.isFinite(
          requestedLimit,
        )
          ? Math.max(
              1,
              Math.min(
                1000,
                Math.floor(
                  requestedLimit,
                ),
              ),
            )
          : 500;


      const result =
        batchId
          ? await db.execute(sql`
              SELECT
                v.id,
                v.serial_number AS "serialNumber",
                v.status,
                v.expires_at AS "expiresAt",
                v.claimed_by_user_id AS "claimedByUserId",
                v.claimed_at AS "claimedAt",
                v.created_at AS "createdAt",

                b.id AS "batchId",
                b.batch_code AS "batchCode",
                b.reward_amount_minor AS "rewardAmountMinor",
                b.currency,

                c.id AS "campaignId",
                c.name AS "campaignName"

              FROM qr_reward_vouchers v

              INNER JOIN qr_reward_batches b
                ON b.id = v.batch_id

              INNER JOIN qr_reward_campaigns c
                ON c.id = b.campaign_id

              WHERE
                v.batch_id = ${batchId}

              ORDER BY
                v.serial_number ASC

              LIMIT ${limit}
            `)
          : await db.execute(sql`
              SELECT
                v.id,
                v.serial_number AS "serialNumber",
                v.status,
                v.expires_at AS "expiresAt",
                v.claimed_by_user_id AS "claimedByUserId",
                v.claimed_at AS "claimedAt",
                v.created_at AS "createdAt",

                b.id AS "batchId",
                b.batch_code AS "batchCode",
                b.reward_amount_minor AS "rewardAmountMinor",
                b.currency,

                c.id AS "campaignId",
                c.name AS "campaignName"

              FROM qr_reward_vouchers v

              INNER JOIN qr_reward_batches b
                ON b.id = v.batch_id

              INNER JOIN qr_reward_campaigns c
                ON c.id = b.campaign_id

              ORDER BY
                v.created_at DESC

              LIMIT ${limit}
            `);


      return NextResponse.json({
        success: true,
        vouchers:
          result.rows,
      });
    },
  );
